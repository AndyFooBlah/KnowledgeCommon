# KnowledgeCommon

`@andyfooblah/knowledge-common` — shared knowledge and utility tool library for Gemini Live voice apps. Provides five categories of Gemini function-calling tools (weather, maps, jokes, Wikipedia RAG, and date/time), with a built-in override system for server-side proxying.

Used by [CarBot](https://github.com/AndyFooBlah/CarBot) and [LegacyBot](https://github.com/AndyFooBlah/LegacyBot).

---

## Quick start

```bash
npm install @andyfooblah/knowledge-common
```

Call `initializeKnowledgeCommon` once at app startup before using any tools. KnowledgeCommon does **not** accept a long-lived Gemini API key — every Gemini call goes through a server-side broker that you supply:

```typescript
import { initializeKnowledgeCommon } from '@andyfooblah/knowledge-common';
import { invokeGemini, embedGemini } from './services/geminiBroker'; // your own server-side wrappers

initializeKnowledgeCommon({
  // Required: thin wrappers around your own Cloud Function callables that
  // hold GEMINI_API_KEY in Secret Manager. The browser never holds the key.
  gemini: { invokeGemini, embedContent: embedGemini },
  firestore: db,                                          // optional — enables Wikipedia caching
});
```

See the [Tool overrides](#tool-overrides) section below for how to wire Maps/Weather through server-side proxies as well — KnowledgeCommon expects every external credential to live server-side.

Then pass `allKnowledgeTools` to the Gemini Live API alongside your own tool declarations, and dispatch tool calls to the matching implementation functions by name:

```typescript
import {
  allKnowledgeTools,
  getWeather,
  searchPlace,
  getDistanceBetweenPlaces,
  getJoke,
  searchWikipedia,
  getTimeDifference,
  getTimeOffset,
} from '@andyfooblah/knowledge-common';

const { startSession } = useSession({
  userId: user.uid,
  systemInstruction,
  tools: [...allKnowledgeTools, ...myAppTools],
  onToolCall: async (name: string, args: Record<string, any>): Promise<string> => {
    switch (name) {
      // Add your own app's tool cases first, then the KnowledgeCommon tools:
      case 'getWeather':
        return getWeather(args.location);
      case 'searchPlace':
        return searchPlace(args.query);
      case 'getDistanceBetweenPlaces':
        return getDistanceBetweenPlaces(args.from, args.to);
      case 'getJoke':
        return getJoke(args.category);
      case 'searchWikipedia':
        return searchWikipedia({ question: args.question, maxChunks: args.maxChunks, maxAgeDays: args.maxAgeDays });
      case 'computeTimeDifference':
        return getTimeDifference(args.dateA, args.dateB, args.currentDateTime);
      case 'computeTimeOffset':
        return getTimeOffset(args.date, args.offset, args.currentDateTime);
      default:
        return `Unknown tool: ${name}`;
    }
  },
});
```

---

## Tool categories

### Weather

Fetches current weather for a location. Requires a `toolOverrides.getWeather` function that calls a server-side Maps Weather API proxy.

| Export | Description |
|--------|-------------|
| `weatherTool` | `FunctionDeclaration` to pass to Gemini |
| `getWeather(location)` | Fetch current weather as a human-readable string |

### Maps

Geocoding and distance calculation. Requires `toolOverrides.searchPlace` and `toolOverrides.getDistanceBetweenPlaces` that call server-side Maps Geocoding proxies.

| Export | Description |
|--------|-------------|
| `mapsTool` | `FunctionDeclaration` for place search |
| `distanceTool` | `FunctionDeclaration` for distance between places |
| `searchPlace(query)` | Resolve a place name to a human-readable address |
| `getDistanceBetweenPlaces(from, to)` | Return a human-readable distance string |

### Jokes

Fetches a safe-for-work joke from [JokeAPI](https://jokeapi.dev). No API key required.

| Export | Description |
|--------|-------------|
| `jokeTool` | `FunctionDeclaration` to pass to Gemini |
| `getJoke(category?)` | Fetch a joke (`"general"`, `"pun"`, `"programming"`, `"misc"`, or random) |

### Wikipedia RAG

Searches Wikipedia and uses Gemini embeddings to rank and return the most relevant passage. Caches article embeddings in Firestore (`wikipedia_cache` collection) when `firestore` is configured.

| Export | Description |
|--------|-------------|
| `wikipediaTool` | `FunctionDeclaration` to pass to Gemini |
| `searchWikipedia({ question, maxChunks?, maxAgeDays? })` | Search Wikipedia and return the best matching passages |

### DateTime

Handles fuzzy date arithmetic — useful for voice apps where users say things like "how old was she in 1985?" or "when was that, 40 years ago?".

| Export | Description |
|--------|-------------|
| `computeTimeDifferenceTool` | `FunctionDeclaration` for time difference queries |
| `computeTimeOffsetTool` | `FunctionDeclaration` for time offset queries |
| `getTimeDifference(dateA, dateB, currentDateTime)` | Compute the duration between two natural-language date expressions |
| `getTimeOffset(date, offset, currentDateTime)` | Compute a date relative to a base date expression |

---

## Tool overrides

KnowledgeCommon never holds an external API key directly — Maps, Weather, and Wikipedia cache writes all flow through consumer-supplied callbacks. Pass them via `toolOverrides`:

Each override completely replaces the corresponding tool's network call. The signature matches what the Gemini tool handler already passes, so existing wrapper functions can be plugged in directly.

```typescript
// LegacyBot: proxy every external call through Firebase callable functions
import { searchPlace, getDistanceBetweenPlaces, getWeather, getJoke }
  from './services/externalSearch'; // these call httpsCallable internally
import { invokeGemini, embedGemini } from './services/geminiBroker';

initializeKnowledgeCommon({
  gemini: { invokeGemini, embedContent: embedGemini },
  firestore: db,
  toolOverrides: {
    searchPlace,
    getDistanceBetweenPlaces,
    getWeather,
    getJoke,    // Jokes is keyless, but can also be proxied if desired
  },
});
```

The `toolOverrides` interface:

```typescript
interface KnowledgeToolOverrides {
  searchPlace?: (query: string) => Promise<string>;
  getDistanceBetweenPlaces?: (from: string, to: string) => Promise<string>;
  getWeather?: (location: string) => Promise<string>;
  getJoke?: (category?: string) => Promise<string>;
}
```

---

## API reference

### `initializeKnowledgeCommon(config)`

Must be called once at app startup before any tools are used.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `gemini` | `KnowledgeGeminiBroker` | Yes | Server-side Gemini broker — `{ invokeGemini, embedContent }`. The library never holds a long-lived key; consumers wire these to their own Cloud Function callables that hold `GEMINI_API_KEY` in Secret Manager. |
| `firestore` | `Firestore` | No | Initialized Firestore instance — enables Wikipedia embedding cache |
| `toolOverrides` | `KnowledgeToolOverrides` | No | Replace direct API calls with your own server-side proxies (Maps, Weather, Wikipedia cache write) |
| `cacheWikipediaArticle` | `(articleId, title) => Promise<{ chunkCount }>` | No | Server-side Wikipedia cache filler — required when Firestore rules deny client writes to `wikipedia_cache` (recommended posture) |
| `debug` | `boolean` | No | Enables verbose logs that may include user query text. Off by default. |

### `allKnowledgeTools`

A `FunctionDeclaration[]` containing all five tool categories, ready to spread into your Gemini tools array.

---

## Peer dependencies

```json
{
  "@google/genai": "^1.0.0",
  "firebase": "^12.0.0"
}
```

The consuming app is responsible for Firebase initialization. Pass the initialized `Firestore` instance to `initializeKnowledgeCommon` — do not call `initializeApp` inside KC.

---

## Version history

### v1.2.0

- **Removed** the dead `mapsApiKey` config field — nothing in the library read it since the direct-browser Maps/Weather paths were removed; Maps and Weather are override-only (`toolOverrides`)
- Fetched third-party text (Wikipedia passages, jokes) is now returned to the model inside a clearly labeled untrusted-data block
- Wikipedia timing/progress logs are now gated behind the `debug` config flag
- `offset_seconds` returned by the date-offset LLM call is validated (finite number) before use
- Dependency cleanup: `@google/genai` and `firebase` are peer dependencies only (bounded `^` ranges), no longer duplicated in `dependencies`
- Added the Apache 2.0 `LICENSE` file; CI/publish workflows pin actions by commit SHA and align on Node 22

### v1.1.0

- Wikipedia candidate selection now ranks articles by embedding cosine similarity — replaces the slow LLM relevance filter with a single batched embedding call

### v1.0.1

- Wikipedia relevance filter: tolerate trailing junk after the JSON array in the LLM response

### v1.0.0

- **Breaking:** `geminiApiKey` removed from `KnowledgeCommonConfig`. All Gemini calls go through the required `gemini` broker (`{ invokeGemini, embedContent }`) supplied by the consumer — the library never holds a Gemini API key
- Direct-browser Google Maps/Weather calls removed; Maps and Weather require `toolOverrides` server-side proxies
- Added `cacheWikipediaArticle` server-side cache-filler hook and client-side rate limits for Wikipedia and Jokes

### v0.3.0

- Initial release
- Five tool categories: Weather, Maps (searchPlace + getDistanceBetweenPlaces), Jokes, Wikipedia RAG, DateTime
- `toolOverrides` support for server-side proxying
- Firestore-backed Wikipedia embedding cache
- `allKnowledgeTools` convenience export

---

## License

Apache 2.0 — see [LICENSE](LICENSE).
