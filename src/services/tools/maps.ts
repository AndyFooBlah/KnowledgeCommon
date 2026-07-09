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
 * Maps tools for KnowledgeCommon.
 *
 * Provides place search and distance calculation. Results are returned as
 * human-readable strings suitable for use in voice conversation — no
 * coordinates are exposed to the AI.
 *
 * Requires: `toolOverrides.searchPlace` and `toolOverrides.getDistanceBetweenPlaces`
 * in KnowledgeCommonConfig — consumer-supplied server-side proxies (e.g. Firebase
 * callables wrapping the Google Maps Geocoding API). Without them, both tools
 * return a "not configured" message.
 */

import { FunctionDeclaration, Type } from '@google/genai';
import { getKnowledgeConfig } from '../config';

// ---------------------------------------------------------------------------
// Tool declarations
// ---------------------------------------------------------------------------

/** Gemini function declaration for place search. */
export const mapsTool: FunctionDeclaration = {
  name: 'searchPlace',
  description: 'Look up a location or address. Returns a description of where the place is. Use when the user mentions a specific location you want geographic context for.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'The place name or address to search for (e.g. "Eiffel Tower", "downtown Chicago", "Route 66").',
      },
    },
    required: ['query'],
  },
};

/** Gemini function declaration for distance calculation. */
export const distanceTool: FunctionDeclaration = {
  name: 'getDistanceBetweenPlaces',
  description: 'Calculate the straight-line distance between two places. Use when the user references how far apart two locations are.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      from: {
        type: Type.STRING,
        description: 'The starting location.',
      },
      to: {
        type: Type.STRING,
        description: 'The destination location.',
      },
    },
    required: ['from', 'to'],
  },
};

// ---------------------------------------------------------------------------
// Implementations
// ---------------------------------------------------------------------------

/**
 * There is deliberately no direct-browser Google Maps fetch here: it would
 * require shipping a Maps API key in the client bundle, where it can be
 * scraped and abused. Consumers MUST supply `toolOverrides.searchPlace` /
 * `getDistanceBetweenPlaces` (typically a Firebase callable that proxies
 * Maps server-side).
 */

const NO_OVERRIDE_MSG =
  'Maps lookup is not configured (no server-side proxy provided). ' +
  'Tell the user this feature is unavailable.';

/** Look up a place and return a human-readable description. */
export async function searchPlace(query: string): Promise<string> {
  const config = getKnowledgeConfig();
  if (config.toolOverrides?.searchPlace) return config.toolOverrides.searchPlace(query);
  return NO_OVERRIDE_MSG;
}

/** Calculate the straight-line distance between two places. */
export async function getDistanceBetweenPlaces(from: string, to: string): Promise<string> {
  const config = getKnowledgeConfig();
  if (config.toolOverrides?.getDistanceBetweenPlaces) return config.toolOverrides.getDistanceBetweenPlaces(from, to);
  return NO_OVERRIDE_MSG;
}
