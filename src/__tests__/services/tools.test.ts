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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initializeKnowledgeCommon } from '../../services/config';
import { getJoke, _resetJokeStateForTesting } from '../../services/tools/jokes';
import { searchPlace, getDistanceBetweenPlaces } from '../../services/tools/maps';
import { getWeather } from '../../services/tools/weather';

// ---------------------------------------------------------------------------
// jokes.ts
// ---------------------------------------------------------------------------

describe('getJoke', () => {
  beforeEach(() => {
    initializeKnowledgeCommon({ geminiApiKey: 'test-key' });
    vi.unstubAllGlobals();
    _resetJokeStateForTesting();
  });

  it('without override: fetches and returns twopart joke formatted as "setup ... delivery"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({
        type: 'twopart',
        setup: 'Why did the chicken cross the road?',
        delivery: 'To get to the other side.',
      }),
    }));

    const result = await getJoke();
    expect(result).toBe('Why did the chicken cross the road? ... To get to the other side.');
  });

  it('with category "programming": includes category in URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({
        type: 'twopart',
        setup: 'Why do programmers prefer dark mode?',
        delivery: 'Because light attracts bugs.',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await getJoke('programming');

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/programming');
  });

  it('with toolOverride: calls override and does NOT call fetch', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const override = vi.fn().mockResolvedValue('override joke');
    initializeKnowledgeCommon({
      geminiApiKey: 'test-key',
      toolOverrides: { getJoke: override },
    });

    const result = await getJoke();
    expect(override).toHaveBeenCalledOnce();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).toBe('override joke');
  });

  it('with fetch error: returns fallback string', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    const result = await getJoke();
    expect(result).toContain("comedy database");
  });

  it('cooldown: a second call within 2s returns a throttle message without fetching', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({ type: 'single', joke: 'First joke.' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await getJoke();
    const second = await getJoke();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(second.toLowerCase()).toContain("overdo");
  });

  it('daily cap: when localStorage shows 30 calls today, returns rate-limit message without fetching', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const store: Record<string, string> = {
      'kc.jokeUsage': JSON.stringify({ date: today, count: 30 }),
    };
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    });
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const result = await getJoke();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.toLowerCase()).toContain('rate limit');
    expect(result).toContain('30');
  });
});

// ---------------------------------------------------------------------------
// maps.ts
// ---------------------------------------------------------------------------

describe('searchPlace', () => {
  beforeEach(() => {
    initializeKnowledgeCommon({ geminiApiKey: 'test-key' });
    vi.unstubAllGlobals();
  });

  it('without override: returns a not-configured message and does NOT call fetch', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const result = await searchPlace('New York, NY');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.toLowerCase()).toContain('not configured');
  });

  it('with toolOverride: calls override and does NOT call fetch', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const override = vi.fn().mockResolvedValue('override address result');
    initializeKnowledgeCommon({
      geminiApiKey: 'test-key',
      toolOverrides: { searchPlace: override },
    });

    const result = await searchPlace('New York, NY');
    expect(override).toHaveBeenCalledWith('New York, NY');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).toBe('override address result');
  });
});

describe('getDistanceBetweenPlaces', () => {
  beforeEach(() => {
    initializeKnowledgeCommon({ geminiApiKey: 'test-key' });
    vi.unstubAllGlobals();
  });

  it('without override: returns a not-configured message and does NOT call fetch', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const result = await getDistanceBetweenPlaces('New York, NY', 'Los Angeles, CA');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.toLowerCase()).toContain('not configured');
  });

  it('with toolOverride: calls override and does NOT call fetch', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const override = vi.fn().mockResolvedValue('override distance result');
    initializeKnowledgeCommon({
      geminiApiKey: 'test-key',
      toolOverrides: { getDistanceBetweenPlaces: override },
    });

    const result = await getDistanceBetweenPlaces('New York, NY', 'Los Angeles, CA');
    expect(override).toHaveBeenCalledWith('New York, NY', 'Los Angeles, CA');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).toBe('override distance result');
  });
});

// ---------------------------------------------------------------------------
// weather.ts
// ---------------------------------------------------------------------------

describe('getWeather', () => {
  beforeEach(() => {
    initializeKnowledgeCommon({ geminiApiKey: 'test-key' });
    vi.unstubAllGlobals();
  });

  it('with toolOverride: calls override and does NOT call fetch', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const override = vi.fn().mockResolvedValue('override weather result');
    initializeKnowledgeCommon({
      geminiApiKey: 'test-key',
      toolOverrides: { getWeather: override },
    });

    const result = await getWeather('San Francisco');
    expect(override).toHaveBeenCalledWith('San Francisco');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).toBe('override weather result');
  });

  it('without override: returns a not-configured message and does NOT call fetch', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const result = await getWeather('San Francisco');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.toLowerCase()).toContain('not configured');
  });
});
