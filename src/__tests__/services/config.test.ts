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

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initializeKnowledgeCommon,
  getKnowledgeConfig,
  getModel,
  DEFAULT_MODELS,
  _resetKnowledgeConfigForTesting,
} from '../../services/config';

describe('KnowledgeCommon config singleton', () => {
  beforeEach(() => {
    _resetKnowledgeConfigForTesting();
  });

  it('throws with an actionable message before init', () => {
    expect(() => getKnowledgeConfig()).toThrow(
      /KnowledgeCommon is not initialized. Call initializeKnowledgeCommon/,
    );
  });

  it('returns the value set by initializeKnowledgeCommon', () => {
    const broker = { invokeGemini: vi.fn(), embedContent: vi.fn() };
    initializeKnowledgeCommon({ gemini: broker });
    expect(getKnowledgeConfig().gemini).toBe(broker);
  });

  it('uses globalThis so separate module instances share the same config', async () => {
    // Re-import the module dynamically — in a real consumer bundle this could
    // resolve to a different instance (e.g. preserveSymlinks + nested symlink).
    // The globalThis Symbol.for key guarantees cross-instance singleton.
    const broker = { invokeGemini: vi.fn(), embedContent: vi.fn() };
    initializeKnowledgeCommon({ gemini: broker });
    const freshModule = await import('../../services/config?t=' + Date.now());
    expect(freshModule.getKnowledgeConfig().gemini).toBe(broker);
  });
});

describe('model ID resolution (models override)', () => {
  const broker = { invokeGemini: vi.fn(), embedContent: vi.fn() };

  beforeEach(() => {
    _resetKnowledgeConfigForTesting();
  });

  it('falls back to DEFAULT_MODELS when no override is configured', () => {
    initializeKnowledgeCommon({ gemini: broker });
    expect(getModel('dateTime')).toBe(DEFAULT_MODELS.dateTime);
    expect(getModel('embedding')).toBe(DEFAULT_MODELS.embedding);
  });

  it('returns the consumer override for the overridden kind only', () => {
    initializeKnowledgeCommon({ gemini: broker, models: { dateTime: 'gemini-9.9-flash-lite' } });
    expect(getModel('dateTime')).toBe('gemini-9.9-flash-lite');
    expect(getModel('embedding')).toBe(DEFAULT_MODELS.embedding);
  });

  it('treats an empty-string override as unset', () => {
    initializeKnowledgeCommon({ gemini: broker, models: { dateTime: '' } });
    expect(getModel('dateTime')).toBe(DEFAULT_MODELS.dateTime);
  });

  it('never defaults to a retired model ID', () => {
    // gemini-3.1-flash-lite-preview was shut down 2026-05-25 (issue #13).
    for (const id of Object.values(DEFAULT_MODELS)) {
      expect(id).not.toMatch(/-preview$/);
      expect(id).not.toBe('gemini-3.1-flash-lite-preview');
    }
  });
});
