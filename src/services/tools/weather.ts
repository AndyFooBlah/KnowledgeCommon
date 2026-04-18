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
 * Weather tool for KnowledgeCommon.
 *
 * Uses the Google Maps Geocoding API to resolve a location name to
 * coordinates, then the Google Maps Weather API to fetch current conditions.
 *
 * Requires: mapsApiKey in KnowledgeCommonConfig with Geocoding API and Weather API enabled.
 */

import { FunctionDeclaration, Type } from '@google/genai';
import { getKnowledgeConfig } from '../config';

/** Gemini function declaration for the weather tool. */
export const weatherTool: FunctionDeclaration = {
  name: 'getWeather',
  description: 'Get the current weather for a location. Call this when the user asks about weather or mentions going somewhere.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      location: {
        type: Type.STRING,
        description: 'The city or place name to get weather for (e.g. "San Francisco", "Tokyo").',
      },
    },
    required: ['location'],
  },
};

/**
 * H4 fix: the direct-browser Google Weather fetch was removed. The Google
 * Weather API does not send CORS headers, so browser-direct calls were
 * already guaranteed to fail — the direct path was a silent-broken tool.
 * Consumers MUST now supply `toolOverrides.getWeather` (typically a
 * Firebase callable that proxies Weather server-side).
 */

/** Execute the weather tool. Returns a human-readable weather summary. */
export async function getWeather(location: string): Promise<string> {
  const config = getKnowledgeConfig();
  if (config.toolOverrides?.getWeather) return config.toolOverrides.getWeather(location);
  return 'Weather lookup is not configured (no server-side proxy provided). Tell the user this feature is unavailable.';
}
