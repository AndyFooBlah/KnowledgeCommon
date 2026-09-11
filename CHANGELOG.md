# Changelog

All notable changes to `@andyfooblah/knowledge-common`. Versions follow
[semver](https://semver.org/); entries before 1.3.0 were moved here from the
README's "Version history".

## 1.3.1 (2026-09-10)

- **Fixed:** the date/time tools (`computeTimeDifference`, `computeTimeOffset`,
  `normalizeDate`) called `gemini-3.1-flash-lite-preview`, which Google shut
  down on 2026-05-25 — every call had been failing since. The default is now
  the stable `gemini-3.5-flash-lite` (#13).
- **Added:** `models?: { dateTime?: string; embedding?: string }` on
  `KnowledgeCommonConfig`. Model IDs are resolved at call time, so consumers can
  move to a newer model — or off a retired one — without waiting for a release.
  `DEFAULT_MODELS` is exported alongside the existing `DATETIME_MODEL` (which
  now aliases `DEFAULT_MODELS.dateTime`). `KnowledgeGeminiBroker` and
  `KnowledgeModelOverrides` types are exported.
- **Added:** `models.json` allow-list + unit test, and `npm run check:models`
  (`scripts/check-models.mjs`) which verifies the allow-list against the live
  Gemini `/v1beta/models` endpoint when `GEMINI_API_KEY` is set (optional CI
  step) — so a future model shutdown is caught rather than silently mocked away.
- **Changed:** `publish.yml` now publishes via npm Trusted Publishing (OIDC) with
  provenance; no `NPM_TOKEN` secret is needed or accepted. Triggers on `v*`
  tags and published GitHub Releases, and refuses a tag that does not match
  `package.json` (#14).
- `package.json` gains `license`, `repository`, `homepage`, `bugs`, `engines`.
- Docs: README peer-dependency block corrected to `^1.0.0 || ^2.0.0`; added
  "Releasing" section; version history moved to this file.
- Dev deps: vite 6 → 8, js-yaml, websocket-driver (Dependabot #9, #10, #11).

## 1.3.0 (2026-08-29) — not published to npm

- **Breaking (shipped as a minor by mistake):** `getKnowledgeConfig` is no
  longer exported from the package entry point (#4). It was an internal
  accessor whose return value exposed consumer-supplied broker functions and the
  Firestore handle to any code importing the package. Consumers should hold
  their own references to what they pass to `initializeKnowledgeCommon`.
  Neither LegacyBot nor CarBot called it. The tagged release never reached
  npm because the publish workflow had no credentials; 1.3.1 is the first
  published version containing this change.

## 1.2.1 (2026-07-10)

- Widened the `@google/genai` peer range to `^1.0.0 || ^2.0.0` — the library only uses type-level exports (`FunctionDeclaration`, `Type`) that are identical across both majors, and consumers (e.g. VoiceCommon) are on v2

## 1.2.0 (2026-07-10)

- **Removed** the dead `mapsApiKey` config field — nothing in the library read it since the direct-browser Maps/Weather paths were removed; Maps and Weather are override-only (`toolOverrides`)
- Fetched third-party text (Wikipedia passages, jokes) is now returned to the model inside a clearly labeled untrusted-data block
- Wikipedia timing/progress logs are now gated behind the `debug` config flag
- `offset_seconds` returned by the date-offset LLM call is validated (finite number) before use
- Dependency cleanup: `@google/genai` and `firebase` are peer dependencies only (bounded `^` ranges), no longer duplicated in `dependencies`
- Added the Apache 2.0 `LICENSE` file; CI/publish workflows pin actions by commit SHA and align on Node 22

## 1.1.0

- Wikipedia candidate selection now ranks articles by embedding cosine similarity — replaces the slow LLM relevance filter with a single batched embedding call

## 1.0.1

- Wikipedia relevance filter: tolerate trailing junk after the JSON array in the LLM response

## 1.0.0

- **Breaking:** `geminiApiKey` removed from `KnowledgeCommonConfig`. All Gemini calls go through the required `gemini` broker (`{ invokeGemini, embedContent }`) supplied by the consumer — the library never holds a Gemini API key
- Direct-browser Google Maps/Weather calls removed; Maps and Weather require `toolOverrides` server-side proxies
- Added `cacheWikipediaArticle` server-side cache-filler hook and client-side rate limits for Wikipedia and Jokes

## 0.3.0

- Initial release
- Five tool categories: Weather, Maps (searchPlace + getDistanceBetweenPlaces), Jokes, Wikipedia RAG, DateTime
- `toolOverrides` support for server-side proxying
- Firestore-backed Wikipedia embedding cache
- `allKnowledgeTools` convenience export
