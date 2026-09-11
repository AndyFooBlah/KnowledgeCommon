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
 * KnowledgeCommon initialization and configuration.
 *
 * Consumers call `initializeKnowledgeCommon(config)` once at app startup
 * before using any tools. All internal services use `getKnowledgeConfig()`
 * to read these values at call time.
 *
 * KnowledgeCommon does NOT initialize Firebase. The consuming application
 * is responsible for all Firebase initialization; pass the initialized
 * Firestore instance here if you want Wikipedia embedding caching.
 */

import type { Firestore } from 'firebase/firestore';

/**
 * Optional function overrides for Maps, Weather, and Jokes tools.
 *
 * KnowledgeCommon never calls Google Maps or the Weather API directly and
 * never holds a Maps API key — the Maps and Weather tools only work when the
 * consuming app supplies these overrides (typically thin wrappers around its
 * own server-side proxies, e.g. Firebase callable functions). Without an
 * override, those tools return a "not configured" message. Jokes (JokeAPI,
 * keyless) works without an override but can also be proxied if desired.
 *
 * Each override completely replaces the corresponding tool's network call.
 * The signatures match what the Gemini tool handler already passes, so
 * existing wrapper functions can be plugged in directly.
 *
 * @example LegacyBot using Firebase callable functions as the proxy:
 * ```ts
 * import { searchPlace, getDistanceBetweenPlaces, getWeather, getJoke }
 *   from './services/externalSearch';
 * import { invokeGemini, embedGemini } from './services/geminiBroker';
 *
 * initializeKnowledgeCommon({
 *   gemini: { invokeGemini, embedContent: embedGemini },
 *   firestore: db,
 *   toolOverrides: { searchPlace, getDistanceBetweenPlaces, getWeather, getJoke },
 * });
 * ```
 */
export interface KnowledgeToolOverrides {
  /** Override for place geocoding. Return a human-readable address string. */
  searchPlace?: (query: string) => Promise<string>;
  /** Override for distance calculation. Return a human-readable distance string. */
  getDistanceBetweenPlaces?: (from: string, to: string) => Promise<string>;
  /** Override for weather lookup. Return a human-readable weather string. */
  getWeather?: (location: string) => Promise<string>;
  /** Override for joke fetching. Return a plain-text joke. */
  getJoke?: (category?: string) => Promise<string>;
}

/**
 * Server-side broker for Gemini calls. Required by `KnowledgeCommonConfig`.
 *
 * KnowledgeCommon **never** holds a Gemini API key directly. Every Gemini call
 * — embedding for Wikipedia RAG candidate ranking and chunk scoring,
 * natural-language date parsing — goes through this broker, which the consuming application
 * implements as a thin wrapper around its own Cloud Functions / serverless
 * endpoints. The long-lived `GEMINI_API_KEY` lives only in the consumer's
 * server-side secret store (e.g. Firebase Secret Manager) and never reaches
 * the browser bundle.
 *
 * @example LegacyBot wires its own Cloud Function callables into this shape:
 * ```ts
 * import { invokeGemini, embedGemini } from './services/geminiBroker';
 *
 * initializeKnowledgeCommon({
 *   gemini: { invokeGemini, embedContent: embedGemini },
 *   firestore: db,
 *   ...
 * });
 * ```
 */
export interface KnowledgeGeminiBroker {
  /**
   * Server-side proxy for `ai.models.generateContent`. The consumer's
   * implementation must enforce its own auth + rate-limit + model allow-list
   * before forwarding to Gemini.
   */
  invokeGemini(req: {
    model: string;
    contents: unknown;
    config?: Record<string, unknown>;
  }): Promise<{ text: string; candidates?: unknown; usageMetadata?: unknown }>;

  /**
   * Server-side proxy for `ai.models.embedContent`. Returns one embedding
   * vector per input text in `contents`, in the same order.
   */
  embedContent(req: {
    model: string;
    contents: string[];
  }): Promise<{ embeddings: number[][] }>;
}

/** Configuration for KnowledgeCommon. */
export interface KnowledgeCommonConfig {
  /**
   * Server-side broker for every Gemini call KnowledgeCommon makes.
   * **Required.** A Gemini API key is never held by this library or its host
   * bundle — see `KnowledgeGeminiBroker`.
   */
  gemini: KnowledgeGeminiBroker;
  /**
   * Initialized Firestore instance from the consuming application.
   * Used by the Wikipedia tool to cache article embeddings in the
   * `wikipedia_cache` top-level collection.
   * If omitted, Wikipedia searches skip caching (slower but still functional).
   */
  firestore?: Firestore;
  /**
   * Optional function overrides for Maps, Weather, and Jokes tools.
   * When provided, the override is called instead of the default direct API
   * implementation. Use this to route calls through a server-side proxy
   * (e.g. a Firebase Cloud Function) for API key security or CORS compliance.
   * See `KnowledgeToolOverrides` for details.
   */
  toolOverrides?: KnowledgeToolOverrides;
  /**
   * When true, enables verbose debug logging that may include user query text
   * and Wikipedia article titles. OFF by default to prevent PII leakage into
   * production consoles and error-reporting pipelines.
   */
  debug?: boolean;
  /**
   * Server-side Wikipedia cache filler — exists so the shared article cache
   * cannot be poisoned by any authenticated client.
   *
   * When consumer apps deny client writes to `wikipedia_cache` in Firestore
   * rules — the recommended posture, since any authenticated user could
   * otherwise overwrite a popular article with poisoned content and inject
   * prompts into other users' Gemini tool calls — they MUST provide this
   * override so cache fills go through a Cloud Function that fetches from
   * Wikipedia server-side before writing with the admin SDK.
   *
   * Signature: given an articleId (from `titleToId(title)`) and title,
   * fetch + chunk + embed + write the article into
   * `wikipedia_cache/{articleId}`. Returns `chunkCount` so the client
   * knows how many chunks to load.
   *
   * When absent: KnowledgeCommon falls back to client-side cache writes.
   * Those will fail silently if rules deny writes, and the search will
   * still work (fetching fresh each call) — just slower and more expensive.
   */
  cacheWikipediaArticle?: (
    articleId: string,
    title: string,
  ) => Promise<{ chunkCount: number }>;
  /**
   * Optional Gemini model-ID overrides. Every field defaults to the constant
   * in `DEFAULT_MODELS` (see also `DATETIME_MODEL` / `EMBEDDING_MODEL`).
   * Set these to move to a newer model — or away from a shut-down one —
   * without waiting for a KnowledgeCommon release. Model IDs are resolved at
   * call time, so an override applies to every subsequent tool call.
   *
   * Note: `embedding` changes the vector space of the Wikipedia cache;
   * embeddings from different models are not comparable, so change it only
   * together with clearing (or versioning) `wikipedia_cache`.
   */
  models?: KnowledgeModelOverrides;
}

/** Gemini model IDs KnowledgeCommon calls through the broker. */
export interface KnowledgeModelOverrides {
  /** Model for natural-language date/time normalization (fast, cheap, structured output). */
  dateTime?: string;
  /** Embedding model for Wikipedia RAG candidate ranking and chunk scoring. */
  embedding?: string;
}

/**
 * Default model IDs. Verified against https://ai.google.dev/gemini-api/docs/models
 * on 2026-09-10; `models.json` at the repo root is the allow-list that
 * `scripts/check-models.mjs` re-verifies against the live API.
 */
export const DEFAULT_MODELS: Readonly<Required<KnowledgeModelOverrides>> = Object.freeze({
  dateTime: 'gemini-3.5-flash-lite',
  embedding: 'gemini-embedding-001',
});

/**
 * Resolve a model ID at call time: the consumer's `models` override if set,
 * otherwise the library default. Does not require initialization to have
 * happened for the default to be returned — but every caller in this library
 * needs the broker anyway, so in practice `getKnowledgeConfig()` has run.
 */
export function getModel(kind: keyof KnowledgeModelOverrides): string {
  const config = (globalThis as Record<symbol, unknown>)[GLOBAL_CONFIG_KEY] as
    | KnowledgeCommonConfig
    | undefined;
  return config?.models?.[kind] || DEFAULT_MODELS[kind];
}

/**
 * Unique key for storing config on globalThis.
 *
 * Using globalThis rather than a module-level variable ensures the singleton
 * survives across bundler chunk boundaries and duplicate module instances.
 * When a consuming app uses Vite with `preserveSymlinks: true` (e.g. for
 * `file:` npm deps), a nested-symlink package can resolve to two distinct
 * module IDs; a module-level `_config` would have two separate instances
 * while this globalThis approach keeps a single authoritative value.
 *
 * A registry-based Symbol (Symbol.for) is used instead of a string property
 * so third-party code scanning Object.keys(globalThis) does not surface the
 * config, but cross-instance lookup still works.
 */
const GLOBAL_CONFIG_KEY = Symbol.for('@andyfooblah/knowledge-common/config');

/**
 * Initialize KnowledgeCommon with your application's configuration.
 *
 * Must be called once before using any KnowledgeCommon tools.
 * Call this in your app entry point alongside any other initialization.
 *
 * @example
 * ```ts
 * import { invokeGemini, embedGemini } from './services/geminiBroker';
 * import { searchPlace, getDistanceBetweenPlaces, getWeather, getJoke }
 *   from './services/externalSearch';
 *
 * initializeKnowledgeCommon({
 *   gemini: { invokeGemini, embedContent: embedGemini },
 *   firestore: db,
 *   toolOverrides: { searchPlace, getDistanceBetweenPlaces, getWeather, getJoke },
 * });
 * ```
 */
export function initializeKnowledgeCommon(config: KnowledgeCommonConfig): void {
  (globalThis as Record<symbol, unknown>)[GLOBAL_CONFIG_KEY] = config;
}

/**
 * Returns the active KnowledgeCommon configuration.
 * Throws if `initializeKnowledgeCommon()` has not been called yet.
 */
export function getKnowledgeConfig(): KnowledgeCommonConfig {
  const config = (globalThis as Record<symbol, unknown>)[GLOBAL_CONFIG_KEY] as
    | KnowledgeCommonConfig
    | undefined;
  if (!config) {
    throw new Error(
      'KnowledgeCommon is not initialized. Call initializeKnowledgeCommon(config) before using any tools.',
    );
  }
  return config;
}

/**
 * Test-only helper to reset KnowledgeCommon's global config, isolating tests
 * that mutate it. Not re-exported from lib.ts.
 */
export function _resetKnowledgeConfigForTesting(): void {
  delete (globalThis as Record<symbol, unknown>)[GLOBAL_CONFIG_KEY];
}
