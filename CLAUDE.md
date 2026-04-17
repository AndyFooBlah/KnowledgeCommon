# KnowledgeCommon — Claude Code Instructions

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

Publish is triggered by pushing a `v*` tag (e.g. `v0.2.0`). The CI workflow
runs tests, builds the library, and publishes to GitHub Packages automatically.

```bash
# bump version in package.json first, then:
git tag v0.2.0
git push origin v0.2.0
```

## Architecture notes

### What KnowledgeCommon is

A pure TypeScript npm library (`@andyfooblah/knowledgecommon`) — no React, no
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
import { initializeKnowledgeCommon } from '@andyfooblah/knowledgecommon';

initializeKnowledgeCommon({
  geminiApiKey: 'AIza...',     // required — for Wikipedia + date/time tools
  mapsApiKey: 'AIza...',       // optional — for Maps + Weather tools
  firestore: db,               // optional — for Wikipedia embedding cache
                               //   omit to skip caching (Wikipedia still works, just slower)
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
   an async implementation function; use `getKnowledgeConfig()` for API keys
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
