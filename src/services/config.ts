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
 * By default, KnowledgeCommon calls Google Maps and JokeAPI directly from the
 * browser using `mapsApiKey`. This exposes the Maps key in the client bundle and
 * requires CORS-compatible endpoints (Google's Weather API is browser-blocked).
 *
 * Apps that need server-side proxying (API key security, CORS) can provide
 * override functions here. Each override completely replaces the corresponding
 * tool's network call. The signatures match what the Gemini tool handler
 * already passes, so existing `externalSearch.ts` wrappers can be plugged in
 * directly.
 *
 * @example LegacyBot using Firebase callable functions as the proxy:
 * ```ts
 * import { searchPlace, getDistanceBetweenPlaces, getWeather, getJoke }
 *   from './services/externalSearch';
 *
 * initializeKnowledgeCommon({
 *   geminiApiKey: '...',
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

/** Configuration for KnowledgeCommon. */
export interface KnowledgeCommonConfig {
  /** Google Gemini API key. Required for Wikipedia filtering/embeddings and date/time tools. */
  geminiApiKey: string;
  /**
   * Google Maps API key. Required for Maps and Weather tools when NOT using
   * toolOverrides. Both tools degrade gracefully when neither key nor override
   * is configured.
   */
  mapsApiKey?: string;
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
}

let _config: KnowledgeCommonConfig | null = null;

/**
 * Initialize KnowledgeCommon with your application's configuration.
 *
 * Must be called once before using any KnowledgeCommon tools.
 * Call this in your app entry point alongside any other initialization.
 *
 * @example Direct API access (e.g. CarBot):
 * ```ts
 * initializeKnowledgeCommon({
 *   geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY,
 *   mapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
 *   firestore: db,
 * });
 * ```
 *
 * @example Server-side proxy (e.g. LegacyBot via Firebase callable):
 * ```ts
 * import { searchPlace, getDistanceBetweenPlaces, getWeather, getJoke }
 *   from './services/externalSearch';
 * initializeKnowledgeCommon({
 *   geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY,
 *   firestore: db,
 *   toolOverrides: { searchPlace, getDistanceBetweenPlaces, getWeather, getJoke },
 * });
 * ```
 */
export function initializeKnowledgeCommon(config: KnowledgeCommonConfig): void {
  _config = config;
}

/**
 * Returns the active KnowledgeCommon configuration.
 * Throws if `initializeKnowledgeCommon()` has not been called yet.
 */
export function getKnowledgeConfig(): KnowledgeCommonConfig {
  if (!_config) {
    throw new Error(
      'KnowledgeCommon is not initialized. Call initializeKnowledgeCommon(config) before using any tools.',
    );
  }
  return _config;
}
