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

/** Configuration for KnowledgeCommon. */
export interface KnowledgeCommonConfig {
  /** Google Gemini API key. Required for Wikipedia filtering/embeddings and date/time tools. */
  geminiApiKey: string;
  /** Google Maps API key. Required for Maps and Weather tools; both degrade gracefully without it. */
  mapsApiKey?: string;
  /**
   * Initialized Firestore instance from the consuming application.
   * Used by the Wikipedia tool to cache article embeddings in the
   * `wikipedia_cache` top-level collection.
   * If omitted, Wikipedia searches skip caching (slower but still functional).
   */
  firestore?: Firestore;
}

let _config: KnowledgeCommonConfig | null = null;

/**
 * Initialize KnowledgeCommon with your application's configuration.
 *
 * Must be called once before using any KnowledgeCommon tools.
 * Call this in your app entry point alongside any other initialization.
 *
 * @example
 * ```ts
 * import { initializeKnowledgeCommon } from '@andyfooblah/knowledgecommon';
 * import { db } from './firebase'; // your app's initialized Firestore instance
 *
 * initializeKnowledgeCommon({
 *   geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY,
 *   mapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
 *   firestore: db,
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
