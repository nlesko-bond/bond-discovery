import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTvMonitorWeather, tvMonitorWeatherCacheKey } from '@/lib/tvmonitor-weather';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('getTvMonitorWeather', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('geocodes the location then fetches current conditions, mapping the weather code to an icon', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ results: [{ name: 'Elk Grove Village', admin1: 'Illinois', country_code: 'US', latitude: 42.0, longitude: -88.0 }] }),
      )
      .mockResolvedValueOnce(jsonResponse({ current: { temperature_2m: 41.4, weather_code: 3 } }));
    vi.stubGlobal('fetch', fetchMock);

    const weather = await getTvMonitorWeather(`elk grove village test ${Math.floor(Math.random() * 1e9)}`);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('geocoding-api.open-meteo.com');
    expect(fetchMock.mock.calls[1][0]).toContain('api.open-meteo.com/v1/forecast');
    expect(weather).toMatchObject({
      location: 'Elk Grove Village, Illinois, US',
      temperatureF: 41,
      weatherCode: 3,
      condition: 'Overcast',
      icon: '☁️',
    });
  });

  it('caches by location so a second call within the TTL does not refetch', async () => {
    const location = `cache-test-${Math.floor(Math.random() * 1e9)}`;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ results: [{ name: 'Testville', latitude: 1, longitude: 2 }] }))
      .mockResolvedValueOnce(jsonResponse({ current: { temperature_2m: 70, weather_code: 0 } }));
    vi.stubGlobal('fetch', fetchMock);

    const first = await getTvMonitorWeather(location);
    const second = await getTvMonitorWeather(location);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(second).toEqual(first);
  });

  it('returns null (not a throw) when geocoding finds nothing', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ results: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const weather = await getTvMonitorWeather(`no-such-place-${Math.floor(Math.random() * 1e9)}`);
    expect(weather).toBeNull();
  });

  it('returns null when Open-Meteo is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );
    const weather = await getTvMonitorWeather(`unreachable-${Math.floor(Math.random() * 1e9)}`);
    expect(weather).toBeNull();
  });

  it('returns null for a blank location without calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await getTvMonitorWeather('   ')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('builds a stable, lowercased cache key', () => {
    expect(tvMonitorWeatherCacheKey('  Elk Grove, IL  ')).toBe(tvMonitorWeatherCacheKey('elk grove, il'));
  });
});
