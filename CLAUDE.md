# KnowledgeCommon — Claude Code Instructions

## 🔑 Sensitive API keys — read first

**KnowledgeCommon is a library and never holds a Gemini API key.** Every internal Gemini call (Wikipedia RAG embedding ranking, date/time normalization) goes through the consumer-supplied `gemini` broker:

```ts
initializeKnowledgeCommon({
  gemini: {
    invokeGemini(req)  { /* consumer's server-side proxy */ },
    embedContent(req)  { /* consumer's server-side proxy */ },
  },
  // ... other config
});
```

The `gemini` field is **required** by `KnowledgeCommonConfig` (the previous `geminiApiKey: string` field was deleted in 1.0.0). Internal modules call `getKnowledgeConfig().gemini.invokeGemini(...)` / `.embedContent(...)`; they never `new GoogleGenAI({ apiKey })`.

**Do not** add a `geminiApiKey?: string` "convenience" field "just for tests / dev". The whole point of dropping it was that the easier path always wins, and a single forgotten reference forces every consumer to bundle a key. Tests mock the broker (see `src/__tests__/services/dateTimeUtils.test.ts` for the pattern).

Public helper signatures (`computeTimeDifference`, `computeTimeOffset`, `normalizeDate`) **do not take an `apiKey` parameter**. Adding one back would push the key-handling burden onto consumers in a way that nudges them toward bundling. Use the broker via `getKnowledgeConfig().gemini` instead.

**Two automated guards stop accidental regressions:**

1. **ESLint** (`eslint.config.js`) — `no-restricted-syntax` errors on:
   - ANY read of `import.meta.env.*` in `src/**` (a library bundling an env var forces the value into every consumer)
   - `process.env.GEMINI_* / *_API_KEY / *_SECRET / *_TOKEN` (the library never reads keys directly)
2. **Post-build bundle scan** (`scripts/check-bundle-for-secrets.mjs`, run as part of `npm run build:lib`) — greps the published `dist/` for known secret shapes and **fails on any match** (no allowlist).

If either guard fires, **fix the leak**; do not weaken the rule.

## After any material change

Before considering a task complete, ensure all of the following are done:

1. **Tests** — verify tests exist for the changed behavior and all tests pass:
   ```bash
   npm test -- --run
   ```
2. **Type check**:
   ```bash
   npx tsc --noEmit
   ```
3. **Commit** — commit all changed files with a descriptive message
4. **Push** — push to `origin/main`

## Dev commands

```bash
npm install                # install dependencies
npm test -- --run          # run all tests once
npm run test:watch         # watch mode
npx tsc --noEmit           # type-check only
npm run build:lib          # build the ESM library bundle into dist/
```

## Publishing

Publish is triggered by pushing a `v*` tag (or publishing a GitHub Release).
`publish.yml` runs type-check + tests, builds the library, and publishes to
npmjs.org via **npm Trusted Publishing (OIDC)** — there is no `NPM_TOKEN`
secret and there must never be one. The package owner configures the Trusted
Publisher once on npmjs.com (see README → "Releasing"). The workflow also
fails if the tag does not match `package.json`'s version.

```bash
# bump version in package.json + add a CHANGELOG.md entry, commit, push, then:
git tag -a v1.3.1 -m "v1.3.1"
git push origin v1.3.1
```

Default Gemini model IDs live in `DEFAULT_MODELS` (`src/services/config.ts`)
and are mirrored in `models.json`; update both together after checking
https://ai.google.dev/gemini-api/docs/models. `npm run check:models` verifies
the list against the live API when `GEMINI_API_KEY` is set.

## Architecture notes

### What KnowledgeCommon is

A pure TypeScript npm library (`@andyfooblah/knowledge-common`) — no React, no
Firebase initialization. It provides Gemini `FunctionDeclaration` objects and
their async implementations for general-purpose knowledge tools:

- **Maps** (`maps.ts`) — place search and distance via Google Maps Geocoding API
- **Weather** (`weather.ts`) — current conditions via Google Maps Weather API
- **Wikipedia** (`wikipedia.ts`) — RAG search with optional Firestore embedding cache
- **Jokes** (`jokes.ts`) — random jokes via JokeAPI (no API key)
- **Date/Time** (`dateTime.ts` + `dateTimeUtils.ts`) — natural-language date arithmetic via Gemini

### Initialization

Consumers call `initializeKnowledgeCommon(config)` once at startup:

```ts
import { initializeKnowledgeCommon } from '@andyfooblah/knowledge-common';
import { invokeGemini, embedGemini } from './services/geminiBroker'; // consumer's server-side proxies

initializeKnowledgeCommon({
  gemini: { invokeGemini, embedContent: embedGemini },
                               // required — server-side broker for every Gemini call
                               //   (Wikipedia RAG + date/time tools); no API key in the client
  firestore: db,               // optional — for Wikipedia embedding cache
                               //   omit to skip caching (Wikipedia still works, just slower)
  toolOverrides: { searchPlace, getDistanceBetweenPlaces, getWeather },
                               // required for Maps + Weather tools — server-side proxies;
                               //   without them those tools report "not configured"
});
```

### Firestore ownership

KnowledgeCommon does NOT initialize Firebase or own a Firebase project. The
`firestore` instance in config must be provided by the consuming application,
which is responsible for all Firebase initialization and security rules.

The Wikipedia tool writes to the `wikipedia_cache` top-level collection in
whichever Firestore database the application provides.

### Adding new tools

1. Create `src/services/tools/myTool.ts` — export a `FunctionDeclaration` and
   an async implementation function; reach Gemini only via `getKnowledgeConfig().gemini`
   and pick model IDs via `getModel(...)` (never hardcode a model string in a tool)
2. Export from `src/lib.ts`
3. Add to `allKnowledgeTools` in `src/lib.ts`
4. Add tests in `src/__tests__/services/tools/myTool.test.ts`

### License headers

All source files carry an Apache 2.0 header (Copyright 2026 Andrew Brook). Add the header to any new `.ts` file:
```
// Copyright 2026 Andrew Brook
//
// Licensed under the Apache License, Version 2.0 (the "License");
// ...
```
