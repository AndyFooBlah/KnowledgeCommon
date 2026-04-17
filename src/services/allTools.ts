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

import { weatherTool } from './tools/weather';
import { mapsTool, distanceTool } from './tools/maps';
import { jokeTool } from './tools/jokes';
import { wikipediaTool } from './tools/wikipedia';
import { computeTimeDifferenceTool, computeTimeOffsetTool } from './tools/dateTime';

/**
 * All standard KnowledgeCommon tools, ready to pass to the Gemini Live API.
 * Applications can use a subset or extend with their own tool definitions.
 */
export const allKnowledgeTools = [
  weatherTool,
  mapsTool,
  distanceTool,
  jokeTool,
  wikipediaTool,
  computeTimeDifferenceTool,
  computeTimeOffsetTool,
];
