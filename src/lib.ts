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
 * KnowledgeCommon library entry point.
 *
 * Re-exports the public API for npm package consumers.
 * Start here: call `initializeKnowledgeCommon(config)` before using any tools.
 */

// Initialization
export { initializeKnowledgeCommon, getKnowledgeConfig } from './services/config';
export type { KnowledgeCommonConfig } from './services/config';

// Tools
export { weatherTool, getWeather } from './services/tools/weather';
export { mapsTool, distanceTool, searchPlace, getDistanceBetweenPlaces } from './services/tools/maps';
export { jokeTool, getJoke } from './services/tools/jokes';
export { wikipediaTool, searchWikipedia, openSearch, fetchSummary, chunkText, titleToId, cosineSimilarity } from './services/tools/wikipedia';
export {
  computeTimeDifferenceTool,
  computeTimeOffsetTool,
  getTimeDifference,
  getTimeOffset,
} from './services/tools/dateTime';

// Date/time utilities (for advanced use — implement your own tool wrappers or call directly)
export {
  computeTimeDifference,
  computeTimeOffset,
  normalizeDate,
  parseBestEstimate,
  diffInSeconds,
  diffInDays,
  formatDuration,
  formatDate,
  DATETIME_MODEL,
} from './services/dateTimeUtils';
export type {
  NormalizedDate,
  DateTimePoint,
  TimeDiffResult,
  TimeOffsetResult,
  DateConfidence,
  DateResolution,
} from './services/dateTimeUtils';

/**
 * All standard KnowledgeCommon tools, ready to pass to the Gemini Live API.
 * Applications can use a subset or extend with their own tool definitions.
 */
export { allKnowledgeTools } from './services/allTools';
