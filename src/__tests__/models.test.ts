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
 * Guards the default model IDs against the checked-in allow-list.
 *
 * Unit tests mock every Gemini call, so they cannot notice when Google retires
 * a model (issue #13). `models.json` is the single place a maintainer updates
 * after checking https://ai.google.dev/gemini-api/docs/models, and
 * `scripts/check-models.mjs` verifies that file against the live API whenever
 * GEMINI_API_KEY is available (optional CI step). This test closes the loop:
 * the code cannot default to an ID that was not deliberately allow-listed.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_MODELS } from '../services/config';
import { DATETIME_MODEL } from '../services/dateTimeUtils';

const manifest = JSON.parse(readFileSync(resolve(__dirname, '../../models.json'), 'utf8')) as {
  verified: string;
  models: string[];
};

describe('models.json allow-list', () => {
  it('lists every default model ID the library calls', () => {
    for (const [kind, id] of Object.entries(DEFAULT_MODELS)) {
      expect(manifest.models, `DEFAULT_MODELS.${kind} = ${id} must be in models.json`).toContain(id);
    }
  });

  it('carries no stale entries (every allow-listed ID is a current default)', () => {
    const defaults = new Set(Object.values(DEFAULT_MODELS));
    for (const id of manifest.models) {
      expect(defaults.has(id), `${id} is in models.json but no longer a default`).toBe(true);
    }
  });

  it('keeps DATETIME_MODEL (compat export) equal to the configured default', () => {
    expect(DATETIME_MODEL).toBe(DEFAULT_MODELS.dateTime);
  });

  it('records when the list was last verified against the live API', () => {
    expect(manifest.verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
