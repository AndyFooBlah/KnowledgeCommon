// Copyright 2026 Andrew Brook
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Wikipedia RAG tool for KnowledgeCommon.
 *
 * Searches Wikipedia and returns semantically relevant chunks from the best
 * matching articles, using Firestore-cached embeddings for efficiency.
 *
 * The Firestore instance is injected via KnowledgeCommonConfig. If no Firestore
 * instance is provided, caching is skipped — searches work but are slower.
 *
 * Flow per call:
 *   1. Wikipedia OpenSearch → 5 candidate article titles
 *   2. Fetch short summaries for all 5 candidates (parallel)
 *   3. Embed [question, ...summaries] in one batch and rank candidates by
 *      cosine similarity, keeping the top 3 — avoids a slow LLM relevance
 *      filter and downloading/embedding irrelevant full articles
 *   4. For each confirmed article (in parallel), check
 *      `wikipedia_cache/{articleId}` freshness (skipped if no Firestore)
 *   5. If stale or missing: fetch full article, chunk, batch-embed, store
 *   6. Client-side cosine similarity (reusing the question embedding) against
 *      cached chunk embeddings
 *   7. Return top chunks grouped by article, ordered by chunkIndex
 *
 * Firestore schema (written into the application's Firestore database):
 *   wikipedia_cache/{articleId}          → { title, fetchedAt, chunkCount }
 *   wikipedia_cache/{articleId}/chunks/{chunkIndex}
 *                                        → { text, chunkIndex, embedding: number[] }
 *
 * articleId = Wikipedia title with spaces replaced by underscores (lowercase).
 */

import { FunctionDeclaration, Type } from '@google/genai';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { getKnowledgeConfig } from '../config';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHUNK_CHARS = 2048;          // ≈ 512 tokens (4 chars/token estimate)
const OVERLAP_CHARS = 400;         // ≈ 100 tokens overlap
const SEARCH_CANDIDATES = 5;       // articles fetched from OpenSearch
const MAX_CONFIRMED_ARTICLES = 3;  // articles passed to the full RAG pipeline
const EMBED_MODEL = 'gemini-embedding-001';

// M8: client-side rate limit mirroring jokes.ts. Each search costs a
// Gemini embedding call plus up to 3 article fetch+embed pipelines, so a
// runaway model loop can pile up real API charges. The cooldown catches
// model tool-call loops; the daily cap bounds a legitimate-but-chatty
// session to a reasonable Gemini spend.
const WIKI_COOLDOWN_MS = 1_500;
const WIKI_DAILY_CAP = 200;
const WIKI_USAGE_KEY = 'kc.wikiUsage';
let lastWikiCallAt = 0;

export function _resetWikiStateForTesting(): void {
  lastWikiCallAt = 0;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(WIKI_USAGE_KEY);
    } catch {
      // ignore
    }
  }
}

function incrementAndCheckDailyWikiCap(): { allowed: boolean; used: number; cap: number } {
  const today = new Date().toISOString().slice(0, 10);
  let used = 0;
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(WIKI_USAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { date?: string; count?: number };
        if (parsed.date === today) used = Number(parsed.count) || 0;
      }
      if (used >= WIKI_DAILY_CAP) {
        return { allowed: false, used, cap: WIKI_DAILY_CAP };
      }
      localStorage.setItem(WIKI_USAGE_KEY, JSON.stringify({ date: today, count: used + 1 }));
    } catch {
      // localStorage disabled (private mode, SSR). Cooldown still bounds loop abuse.
    }
  }
  return { allowed: true, used: used + 1, cap: WIKI_DAILY_CAP };
}

// ---------------------------------------------------------------------------
// Tool declaration
// ---------------------------------------------------------------------------

/** Gemini function declaration for the Wikipedia RAG tool. */
export const wikipediaTool: FunctionDeclaration = {
  name: 'searchWikipedia',
  description:
    'Look up a topic on Wikipedia and return relevant factual passages. ' +
    'Use when the user asks about a historical event, person, place, or any ' +
    'factual topic you want more depth on. Use the passages to inform your ' +
    'response — do not read them aloud verbatim.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      question: {
        type: Type.STRING,
        description: 'The specific question or topic to look up on Wikipedia.',
      },
      maxChunks: {
        type: Type.NUMBER,
        description: 'Maximum number of text passages to return (default 4).',
      },
      maxAgeDays: {
        type: Type.NUMBER,
        description:
          'Maximum age of cached article content in days. Use a small value ' +
          '(e.g. 1) for current-events topics that change often; use a large ' +
          'value (e.g. 30) or omit for stable historical facts (default 7).',
      },
    },
    required: ['question'],
  },
};

// ---------------------------------------------------------------------------
// Main implementation
// ---------------------------------------------------------------------------

/** Search Wikipedia using RAG and return relevant passages. */
export async function searchWikipedia(args: {
  question: string;
  maxChunks?: number;
  maxAgeDays?: number;
  /** Skip all Firestore reads and writes. Chunks are computed on the fly and
   *  discarded. Useful for integration tests or when no Firestore is configured. */
  noCache?: boolean;
}): Promise<string> {
  const { question, maxChunks = 4, maxAgeDays = 7, noCache = false } = args;

  // M8: rate-limit gate before any API calls. Same message shape as the
  // jokes/geoProxy throttles so the model treats it as a normal tool response.
  const now = Date.now();
  if (now - lastWikiCallAt < WIKI_COOLDOWN_MS) {
    return "Let's pace the Wikipedia lookups — give it a moment before the next search.";
  }
  lastWikiCallAt = now;

  const quota = incrementAndCheckDailyWikiCap();
  if (!quota.allowed) {
    return `Rate limit reached: we've run ${quota.cap} Wikipedia searches today. Tell the user we've used up today's research budget and can look things up again tomorrow.`;
  }

  const db = getKnowledgeConfig().firestore;
  const skipCache = noCache || !db;

  const t0 = Date.now();
  const debug = getKnowledgeConfig().debug === true;
  if (debug) {
    console.log(`[Wikipedia] Starting RAG search for: "${question}" (cache: ${skipCache ? 'disabled' : 'enabled'})`);
  } else {
    console.log(`[Wikipedia] Starting RAG search (cache: ${skipCache ? 'disabled' : 'enabled'})`);
  }

  try {
    // --- 1. OpenSearch: find 5 candidate titles ---
    let candidates: string[];
    try {
      candidates = await openSearch(question, SEARCH_CANDIDATES);
    } catch (err) {
      console.error(`[Wikipedia] OpenSearch failed (${Date.now() - t0}ms):`, err);
      return `Wikipedia search unavailable: OpenSearch timed out or failed.`;
    }
    if (debug) {
      console.log(`[Wikipedia] OpenSearch (${Date.now() - t0}ms) → ${candidates.length} candidates: ${candidates.join(', ')}`);
    } else {
      console.log(`[Wikipedia] OpenSearch (${Date.now() - t0}ms) → ${candidates.length} candidates`);
    }
    if (candidates.length === 0) {
      return `No Wikipedia articles found for "${question}".`;
    }

    // --- 2. Fetch short summaries for all candidates (parallel) ---
    const tSummaries = Date.now();
    let summaries: Array<ArticleSummary | null>;
    try {
      summaries = await Promise.all(candidates.map(fetchSummary));
    } catch (err) {
      console.error(`[Wikipedia] Summary fetch failed (${Date.now() - tSummaries}ms):`, err);
      return `Wikipedia search unavailable: summary fetch failed.`;
    }
    console.log(`[Wikipedia] Fetched ${summaries.filter(Boolean).length} summaries (${Date.now() - tSummaries}ms)`);

    // --- 3+4. Rank candidates by embedding similarity (not a slow LLM filter) ---
    // Embed [question, ...summaries] in a SINGLE batch, then rank candidates by
    // cosine similarity of question↔summary. This replaces a ~9s Gemini
    // relevance-filter call AND the separate question embed with one embedding
    // round-trip — a large latency win for a real-time voice tool. `qVec` (the
    // first embedding) is reused below to score article chunks.
    const tRank = Date.now();
    const rankInputs = [question, ...candidates.map((title, i) => summaries[i]?.extract || title)];
    const rankEmbeddings = await embedTexts(rankInputs);
    const qVec = rankEmbeddings[0];
    if (!qVec) {
      return 'Unable to embed question for Wikipedia search.';
    }
    const confirmedTitles = candidates
      .map((title, i) => ({
        title,
        score: rankEmbeddings[i + 1] ? cosineSimilarity(qVec, rankEmbeddings[i + 1]!) : -1,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_CONFIRMED_ARTICLES)
      .filter((c) => c.score > 0)
      .map((c) => c.title);
    console.log(
      `[Wikipedia] Ranked candidates by embedding (${Date.now() - tRank}ms) → ` +
      `kept ${confirmedTitles.length}/${candidates.length}${debug ? ': ' + confirmedTitles.join(', ') : ''}`,
    );

    if (confirmedTitles.length === 0) {
      return `No Wikipedia articles were found to be relevant to "${question}".`;
    }

    // --- 5. For each confirmed article: ensure cache is fresh, then score chunks ---
    const maxAgeMs = maxAgeDays * 86400 * 1000;
    const allScoredChunks: Array<{
      articleTitle: string;
      chunkIndex: number;
      text: string;
      score: number;
    }> = [];

    // Fetch/embed all confirmed articles concurrently — they're independent, and
    // an uncached article fetch+embed is the other big latency cost.
    const perArticle = await Promise.all(
      confirmedTitles.map(async (title) => {
        const articleId = titleToId(title);
        try {
          const chunks = skipCache
            ? await fetchArticleChunksNoCacheInternal(title)
            : await getOrFetchArticleChunks(db!, articleId, title, maxAgeMs);
          return { title, chunks };
        } catch (err) {
          console.error(`[Wikipedia] Article fetch failed for "${title}":`, err);
          return { title, chunks: [] as { text: string; chunkIndex: number; embedding: number[] }[] };
        }
      }),
    );

    for (const { title, chunks } of perArticle) {
      for (const chunk of chunks) {
        const score = cosineSimilarity(qVec, chunk.embedding);
        allScoredChunks.push({ articleTitle: title, chunkIndex: chunk.chunkIndex, text: chunk.text, score });
      }
    }

    if (allScoredChunks.length === 0) {
      return `Found Wikipedia articles for "${question}" but could not retrieve content.`;
    }

    // --- 6. Select top-k chunks, then regroup by article ordered by chunkIndex ---
    const topChunks = allScoredChunks
      .sort((a, b) => b.score - a.score)
      .slice(0, maxChunks);

    const byArticle = new Map<string, typeof topChunks>();
    for (const chunk of topChunks) {
      const group = byArticle.get(chunk.articleTitle) ?? [];
      group.push(chunk);
      byArticle.set(chunk.articleTitle, group);
    }

    const sections: string[] = [];
    for (const [articleTitle, chunks] of byArticle) {
      const sorted = chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
      const passages = sorted.map((c) => c.text).join('\n\n');
      sections.push(`## ${articleTitle}\n\n${passages}`);
    }

    console.log(
      `[Wikipedia] RAG complete (${Date.now() - t0}ms total). ` +
      `Articles: ${byArticle.size}, chunks returned: ${topChunks.length}`,
    );

    return sections.join('\n\n---\n\n');
  } catch (err) {
    console.error('[Wikipedia] RAG search failed:', err);
    return `Unable to retrieve Wikipedia information: ${String(err)}`;
  }
}

// ---------------------------------------------------------------------------
// Wikipedia API helpers
// ---------------------------------------------------------------------------

/** Fetch with an AbortController timeout. Throws if the request takes longer than `ms`. */
async function fetchWithTimeout(url: string, options: RequestInit = {}, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch article text, chunk, and embed without touching Firestore. */
async function fetchArticleChunksNoCacheInternal(title: string): Promise<CachedChunk[]> {
  const text = await fetchArticleText(title);
  if (!text) return [];
  const rawChunks = chunkText(text);
  if (rawChunks.length === 0) return [];
  if (getKnowledgeConfig().debug === true) {
    console.log(`[Wikipedia] No-cache: split "${title}" into ${rawChunks.length} chunks`);
  }
  const embeddings = await embedTexts(rawChunks);
  return rawChunks.map((t, i) => ({ text: t, chunkIndex: i, embedding: embeddings[i] ?? [] }));
}

/**
 * Full-text search Wikipedia and return up to `limit` article titles.
 */
export async function openSearch(query: string, limit: number): Promise<string[]> {
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&list=search` +
    `&srsearch=${encodeURIComponent(query)}&srlimit=${limit}&format=json&origin=*`;
  const res = await fetchWithTimeout(url);
  const data = await res.json();
  const results = data?.query?.search as Array<{ title: string }> | undefined;
  return (results ?? []).map((r) => r.title);
}

interface ArticleSummary {
  title: string;
  description: string;
  extract: string;
}

/** Fetch the short summary for a Wikipedia article via the REST summary API. */
export async function fetchSummary(title: string): Promise<ArticleSummary | null> {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title ?? title,
      description: data.description ?? '',
      extract: data.extract ?? '',
    };
  } catch {
    return null;
  }
}

/** Fetch the full plaintext of a Wikipedia article via the extracts API. */
async function fetchArticleText(title: string): Promise<string | null> {
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exlimit=1` +
    `&titles=${encodeURIComponent(title)}&format=json&origin=*`;
  const res = await fetchWithTimeout(url, {}, 15000);
  const data = await res.json();
  const pages = data?.query?.pages as Record<string, { extract?: string }> | undefined;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  if (!page?.extract) return null;

  return page.extract
    .replace(/<\/?(h[1-6]|p|ul|ol|li|b|i|a|span|div|br)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

/** Split text into overlapping chunks at paragraph boundaries where possible. */
export function chunkText(text: string): string[] {
  const paragraphs = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 1 > CHUNK_CHARS && current.length > 0) {
      chunks.push(current.trim());
      const overlapStart = Math.max(0, current.length - OVERLAP_CHARS);
      current = current.slice(overlapStart) + '\n' + para;
    } else {
      current = current ? current + '\n' + para : para;
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Firestore cache
// ---------------------------------------------------------------------------

interface CachedChunk {
  text: string;
  chunkIndex: number;
  embedding: number[];
}

/** Convert a Wikipedia title to a Firestore-safe document ID. */
export function titleToId(title: string): string {
  return title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '-');
}

/**
 * Return cached chunks for an article, fetching and caching if necessary.
 * Refreshes the cache if older than maxAgeMs milliseconds.
 */
async function getOrFetchArticleChunks(
  db: Firestore,
  articleId: string,
  title: string,
  maxAgeMs: number,
): Promise<CachedChunk[]> {
  const articleRef = doc(db, 'wikipedia_cache', articleId);
  const debug = getKnowledgeConfig().debug === true;
  const titleLabel = debug ? `"${title}"` : `article#${articleId.slice(0, 8)}`;

  const tCheck = Date.now();
  const snap = await getDoc(articleRef);
  console.log(`[Wikipedia] Cache check for ${titleLabel} (${Date.now() - tCheck}ms)`);

  if (snap.exists()) {
    const data = snap.data() as { fetchedAt: Timestamp; chunkCount: number };
    const ageMs = Date.now() - data.fetchedAt.toMillis();
    if (ageMs < maxAgeMs) {
      const tLoad = Date.now();
      const chunks = await loadChunks(db, articleId, data.chunkCount);
      console.log(`[Wikipedia] Loaded ${chunks.length} cached chunks for ${titleLabel} (${Date.now() - tLoad}ms)`);
      return chunks;
    }
    console.log(`[Wikipedia] Cache stale for ${titleLabel} (${Math.round(ageMs / 86400000)}d old), refreshing`);
  } else {
    console.log(`[Wikipedia] No cache for ${titleLabel}, fetching`);
  }

  return fetchAndCacheArticle(db, articleId, title, articleRef);
}

/** Load all chunks from the Firestore subcollection. */
async function loadChunks(db: Firestore, articleId: string, chunkCount: number): Promise<CachedChunk[]> {
  const chunksRef = collection(db, 'wikipedia_cache', articleId, 'chunks');
  const snap = await getDocs(chunksRef);
  return snap.docs
    .map((d) => d.data() as CachedChunk)
    .sort((a, b) => a.chunkIndex - b.chunkIndex)
    .slice(0, chunkCount);
}

/** Fetch article text, chunk it, embed all chunks, and store in Firestore. */
async function fetchAndCacheArticle(
  db: Firestore,
  articleId: string,
  title: string,
  articleRef: ReturnType<typeof doc>,
): Promise<CachedChunk[]> {
  const cfg = getKnowledgeConfig();
  const debug = cfg.debug === true;
  const titleLabel = debug ? `"${title}"` : `article#${articleId.slice(0, 8)}`;

  // H2 mitigation: when a server-side cache filler is configured, delegate
  // the write to it. The Cloud Function re-fetches the article from Wikipedia
  // with the admin SDK, guaranteeing cache integrity. The client then reads
  // the freshly-written chunks back. When no override is present, fall through
  // to the legacy client-write path (which will fail silently under strict
  // firestore.rules — the search still works, it just doesn't cache).
  if (cfg.cacheWikipediaArticle) {
    const tServer = Date.now();
    try {
      const { chunkCount } = await cfg.cacheWikipediaArticle(articleId, title);
      console.log(`[Wikipedia] Server-cached ${titleLabel} (${Date.now() - tServer}ms, ${chunkCount} chunks)`);
      if (chunkCount === 0) return [];
      return loadChunks(db, articleId, chunkCount);
    } catch (err) {
      console.warn(`[Wikipedia] Server-side cache filler failed for ${titleLabel}, falling back:`, err);
      // fall through to direct fetch+embed (no write) so the search still returns something
      const text = await fetchArticleText(title);
      if (!text) return [];
      const rawChunks = chunkText(text);
      if (rawChunks.length === 0) return [];
      const embeddings = await embedTexts(rawChunks);
      return rawChunks.map((t, i) => ({ text: t, chunkIndex: i, embedding: embeddings[i] ?? [] }));
    }
  }

  const tFetch = Date.now();
  const text = await fetchArticleText(title);
  console.log(`[Wikipedia] Fetched article ${titleLabel} (${Date.now() - tFetch}ms)`);
  if (!text) return [];

  const rawChunks = chunkText(text);
  if (rawChunks.length === 0) return [];
  console.log(`[Wikipedia] Split into ${rawChunks.length} chunks`);

  const tEmbed = Date.now();
  const embeddings = await embedTexts(rawChunks);
  console.log(`[Wikipedia] Batch-embedded ${rawChunks.length} chunks (${Date.now() - tEmbed}ms)`);

  await setDoc(articleRef, {
    title,
    fetchedAt: Timestamp.now(),
    chunkCount: rawChunks.length,
  });

  const chunks: CachedChunk[] = [];
  const chunksRef = collection(db, 'wikipedia_cache', articleId, 'chunks');
  const tStore = Date.now();
  await Promise.all(
    rawChunks.map(async (chunkText, i) => {
      const embedding = embeddings[i] ?? [];
      const chunk: CachedChunk = { text: chunkText, chunkIndex: i, embedding };
      await setDoc(doc(chunksRef, String(i)), chunk);
      chunks.push(chunk);
    }),
  );
  console.log(`[Wikipedia] Stored ${chunks.length} chunks for ${titleLabel} (${Date.now() - tStore}ms)`);

  return chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
}

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------

async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const { gemini } = getKnowledgeConfig();

  const timeoutMs = 10000 + texts.length * 2000;
  const response = await Promise.race([
    gemini.embedContent({
      model: EMBED_MODEL,
      contents: texts,
    }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Gemini embedContent timed out after ${timeoutMs}ms for ${texts.length} texts`)),
        timeoutMs,
      ),
    ),
  ]);

  return response.embeddings ?? [];
}

// ---------------------------------------------------------------------------
// Math
// ---------------------------------------------------------------------------

/** Cosine similarity between two vectors. Returns 0 if either is zero-length. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
