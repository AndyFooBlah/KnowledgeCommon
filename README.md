# KnowledgeCommon

`@andyfooblah/knowledge-common` — shared knowledge and utility tool library for Gemini Live voice apps. Provides five categories of Gemini function-calling tools (weather, maps, jokes, Wikipedia RAG, and date/time), with a built-in override system for server-side proxying.

Used by [CarBot](https://github.com/AndyFooBlah/CarBot) and [LegacyBot](https://github.com/AndyFooBlah/LegacyBot).

---

## Quick start

```bash
npm install @andyfooblah/knowledge-common
```

Call `initializeKnowledgeCommon` once at app startup before using any tools:

```typescript
import { initializeKnowledgeCommon } from '@andyfooblah/knowledge-common';

initializeKnowledgeCommon({
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY,
  mapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY, // optional
  firestore: db,                                         // optional — enables Wikipedia caching
});
```

Then pass `allKnowledgeTools` to the Gemini Live API alongside your own tool declarations:

```typescript
import { allKnowledgeTools } from '@andyfooblah/knowledge-common';

const { startSession } = useSession({
  userId: user.uid,
  systemInstruction,
  tools: [...allKnowledgeTools, ...myAppTools],
  onToolCall: async (name, args) => {
    // KC tool calls are dispatched automatically when you use the KC handler helpers.
    // Add your own cases first, then fall through to KC.
    return dispatchKnowledgeTool(name, args);
  },
});
```

---

## Tool categories

### Weather

Fetches current weather for a location. Requires `mapsApiKey` (Google Maps Weather API) or a `toolOverrides.getWeather` function.

| Export | Description |
|--------|-------------|
| `weatherTool` | `FunctionDeclaration` to pass to Gemini |
| `getWeather(location)` | Fetch current weather as a human-readable string |

### Maps

Geocoding and distance calculation. Requires `mapsApiKey` (Google Maps Geocoding API) or overrides.

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
| `searchWikipedia(query)` | Search Wikipedia and return the best matching passage |

### DateTime

Handles fuzzy date arithmetic — useful for voice apps where users say things like "how old was she in 1985?" or "when was that, 40 years ago?".

| Export | Description |
|--------|-------------|
| `computeTimeDifferenceTool` | `FunctionDeclaration` for time difference queries |
| `computeTimeOffsetTool` | `FunctionDeclaration` for time offset queries |
| `getTimeDifference(from, to)` | Compute the duration between two dates |
| `getTimeOffset(base, offset)` | Compute a date relative to a base |

---

## Tool overrides

By default, Maps and Weather tools call Google's APIs directly from the browser — which exposes the Maps key in the client bundle. Apps that want server-side proxying (key security, CORS compliance) can provide override functions via `toolOverrides`.

Each override completely replaces the corresponding tool's network call. The signature matches what the Gemini tool handler already passes, so existing wrapper functions can be plugged in directly.

```typescript
// LegacyBot: proxy Maps + Weather through Firebase callable functions
import { searchPlace, getDistanceBetweenPlaces, getWeather, getJoke }
  from './services/externalSearch'; // these call httpsCallable internally

initializeKnowledgeCommon({
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY,
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
| `geminiApiKey` | `string` | Yes | Gemini API key — used for Wikipedia embedding and date/time tools |
| `mapsApiKey` | `string` | No | Google Maps API key — required for Maps and Weather without overrides |
| `firestore` | `Firestore` | No | Initialized Firestore instance — enables Wikipedia embedding cache |
| `toolOverrides` | `KnowledgeToolOverrides` | No | Replace direct API calls with your own proxy functions |

### `allKnowledgeTools`

A `FunctionDeclaration[]` containing all five tool categories, ready to spread into your Gemini tools array.

---

## Peer dependencies

```json
{
  "@google/genai": ">=1.0.0",
  "firebase": ">=12.0.0"
}
```

The consuming app is responsible for Firebase initialization. Pass the initialized `Firestore` instance to `initializeKnowledgeCommon` — do not call `initializeApp` inside KC.

---

## Version history

### v0.3.0

- Initial release
- Five tool categories: Weather, Maps (searchPlace + getDistanceBetweenPlaces), Jokes, Wikipedia RAG, DateTime
- `toolOverrides` support for server-side proxying
- Firestore-backed Wikipedia embedding cache
- `allKnowledgeTools` convenience export

---

## License

Apache 2.0 — see [LICENSE](LICENSE).
