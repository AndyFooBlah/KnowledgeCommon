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
import { getJoke } from '../../services/tools/jokes';
import { searchPlace, getDistanceBetweenPlaces } from '../../services/tools/maps';
import { getWeather } from '../../services/tools/weather';

// ---------------------------------------------------------------------------
// jokes.ts
// ---------------------------------------------------------------------------

describe('getJoke', () => {
  beforeEach(() => {
    initializeKnowledgeCommon({ geminiApiKey: 'test-key' });
    vi.unstubAllGlobals();
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
});

// ---------------------------------------------------------------------------
// maps.ts
// ---------------------------------------------------------------------------

describe('searchPlace', () => {
  beforeEach(() => {
    initializeKnowledgeCommon({ geminiApiKey: 'test-key', mapsApiKey: 'maps-key' });
    vi.unstubAllGlobals();
  });

  it('without override: mocks geocode fetch and returns formatted address', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({
        status: 'OK',
        results: [{
          formatted_address: 'New York, NY, USA',
          geometry: { location: { lat: 40.7128, lng: -74.0060 } },
        }],
      }),
    }));

    const result = await searchPlace('New York, NY');
    expect(result).toContain('New York, NY, USA');
  });

  it('with toolOverride: calls override and does NOT call fetch', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const override = vi.fn().mockResolvedValue('override address result');
    initializeKnowledgeCommon({
      geminiApiKey: 'test-key',
      mapsApiKey: 'maps-key',
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
    initializeKnowledgeCommon({ geminiApiKey: 'test-key', mapsApiKey: 'maps-key' });
    vi.unstubAllGlobals();
  });

  it('without override: mocks two geocode calls and returns distance string', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'OK',
          results: [{
            formatted_address: 'New York, NY, USA',
            geometry: { location: { lat: 40.7128, lng: -74.0060 } },
          }],
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'OK',
          results: [{
            formatted_address: 'Los Angeles, CA, USA',
            geometry: { location: { lat: 34.0522, lng: -118.2437 } },
          }],
        }),
      }),
    );

    const result = await getDistanceBetweenPlaces('New York, NY', 'Los Angeles, CA');
    expect(result).toContain('miles');
    expect(result).toContain('km');
    expect(result).toContain('New York, NY, USA');
    expect(result).toContain('Los Angeles, CA, USA');
  });

  it('with toolOverride: calls override and does NOT call fetch', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const override = vi.fn().mockResolvedValue('override distance result');
    initializeKnowledgeCommon({
      geminiApiKey: 'test-key',
      mapsApiKey: 'maps-key',
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

  it('without mapsApiKey: returns "not available" string', async () => {
    // Already initialized without mapsApiKey in beforeEach
    const result = await getWeather('San Francisco');
    expect(result).toContain('not available');
  });

  it('without override but with mapsApiKey: mocks geocode + weather calls and returns formatted string', async () => {
    initializeKnowledgeCommon({ geminiApiKey: 'test-key', mapsApiKey: 'maps-key' });

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        // Geocode response
        json: async () => ({
          status: 'OK',
          results: [{
            formatted_address: 'San Francisco, CA, USA',
            geometry: { location: { lat: 37.7749, lng: -122.4194 } },
          }],
        }),
      })
      .mockResolvedValueOnce({
        // Weather API response
        ok: true,
        json: async () => ({
          weatherCondition: { description: { text: 'Partly cloudy' } },
          temperature: { degrees: 15 },
          relativeHumidity: 72,
          wind: { speed: { value: 20 } },
        }),
      }),
    );

    const result = await getWeather('San Francisco');
    expect(result).toContain('San Francisco, CA, USA');
    expect(result).toContain('Partly cloudy');
    expect(result).toContain('59°F');
    expect(result).toContain('15°C');
  });
});
