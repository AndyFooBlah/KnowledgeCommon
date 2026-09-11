#!/usr/bin/env node
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
 * Verify that every model ID in `models.json` still exists on the Gemini API.
 *
 * Why: the library calls Gemini only through the consumer's broker, so unit
 * tests mock every model call and cannot notice when Google retires a model
 * (gemini-3.1-flash-lite-preview was shut down on 2026-05-25 and the
 * date/time tools silently broke for ~3.5 months — issue #13).
 *
 * Behaviour:
 *   - GEMINI_API_KEY unset  → prints a notice and exits 0 (nothing to check).
 *   - GEMINI_API_KEY set    → GET /v1beta/models and fails (exit 1) if any
 *                             ID in models.json is missing from the listing.
 *
 * The key is read from the environment of THIS script only — it is a
 * maintainer/CI tool, never part of the published library (`files: [dist]`).
 * It is never printed or logged.
 *
 * Run as: `GEMINI_API_KEY=... node scripts/check-models.mjs`
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'models.json'), 'utf8'));
const expected = manifest.models;

if (!Array.isArray(expected) || expected.length === 0) {
  console.error('[check-models] models.json has no "models" array');
  process.exit(1);
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.log(
    `[check-models] GEMINI_API_KEY not set — skipping live verification of ${expected.length} model ID(s) (last verified ${manifest.verified}).`,
  );
  process.exit(0);
}

const live = new Set();
let pageToken;
do {
  const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
  url.searchParams.set('pageSize', '1000');
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  // Key goes in a header, not the query string, so it never lands in a log line.
  const res = await fetch(url, { headers: { 'x-goog-api-key': apiKey } });
  if (!res.ok) {
    console.error(`[check-models] Gemini API responded ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const body = await res.json();
  for (const m of body.models ?? []) live.add(String(m.name).replace(/^models\//, ''));
  pageToken = body.nextPageToken;
} while (pageToken);

const missing = expected.filter((id) => !live.has(id));
if (missing.length > 0) {
  console.error(`[check-models] ${missing.length} model ID(s) in models.json are NOT served by the Gemini API:`);
  for (const id of missing) console.error(`  - ${id}`);
  console.error('Update DEFAULT_MODELS in src/services/config.ts and models.json (see https://ai.google.dev/gemini-api/docs/models).');
  process.exit(1);
}
console.log(`[check-models] OK — all ${expected.length} model ID(s) in models.json are live (${live.size} models listed).`);
