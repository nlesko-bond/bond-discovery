/**
 * Weather chip for TV Monitor headers — city/ZIP text geocoded to lat/lon,
 * then a current-conditions forecast, both via Open-Meteo's free public API
 * (no key required): https://open-meteo.com/en/docs/geocoding-api
 *
 * Weather is decorative, not load-bearing — any failure (bad location text,
 * Open-Meteo hiccup) resolves to null rather than throwing, so it can never
 * take down the schedule response the rest of the page depends on.
 */

import { cachedSWR } from '@/lib/cache';
import type { TvMonitorWeatherPayload } from '@/types/tvmonitor';

const GEOCODE_BASE = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast';
const FETCH_TIMEOUT_MS = 10_000;

// Weather changes slowly enough that a live TV doesn't need it fresher than
// this; the stale shadow rides out an Open-Meteo hiccup without blanking the chip.
const WEATHER_CACHE_TTL_SECONDS = 15 * 60;
const WEATHER_STALE_TTL_SECONDS = 60 * 60 * 6;

const WEATHER_CODE_INFO: Record<number, { condition: string; icon: string }> = {
  0: { condition: 'Clear', icon: '☀️' },
  1: { condition: 'Mostly clear', icon: '🌤️' },
  2: { condition: 'Partly cloudy', icon: '⛅' },
  3: { condition: 'Overcast', icon: '☁️' },
  45: { condition: 'Fog', icon: '🌫️' },
  48: { condition: 'Fog', icon: '🌫️' },
  51: { condition: 'Light drizzle', icon: '🌦️' },
  53: { condition: 'Drizzle', icon: '🌦️' },
  55: { condition: 'Heavy drizzle', icon: '🌧️' },
  56: { condition: 'Freezing drizzle', icon: '🌧️' },
  57: { condition: 'Freezing drizzle', icon: '🌧️' },
  61: { condition: 'Light rain', icon: '🌦️' },
  63: { condition: 'Rain', icon: '🌧️' },
  65: { condition: 'Heavy rain', icon: '🌧️' },
  66: { condition: 'Freezing rain', icon: '🌧️' },
  67: { condition: 'Freezing rain', icon: '🌧️' },
  71: { condition: 'Light snow', icon: '🌨️' },
  73: { condition: 'Snow', icon: '❄️' },
  75: { condition: 'Heavy snow', icon: '❄️' },
  77: { condition: 'Snow grains', icon: '❄️' },
  80: { condition: 'Rain showers', icon: '🌦️' },
  81: { condition: 'Rain showers', icon: '🌧️' },
  82: { condition: 'Violent showers', icon: '⛈️' },
  85: { condition: 'Snow showers', icon: '🌨️' },
  86: { condition: 'Snow showers', icon: '🌨️' },
  95: { condition: 'Thunderstorm', icon: '⛈️' },
  96: { condition: 'Thunderstorm', icon: '⛈️' },
  99: { condition: 'Thunderstorm', icon: '⛈️' },
};

function describeWeatherCode(code: number): { condition: string; icon: string } {
  return WEATHER_CODE_INFO[code] ?? { condition: 'Weather', icon: '🌡️' };
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return (await response.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timeout);
  }
}

async function geocodeLocation(query: string): Promise<{ lat: number; lon: number; label: string }> {
  const params = new URLSearchParams({ name: query, count: '1', language: 'en', format: 'json' });
  const json = await fetchJson(`${GEOCODE_BASE}?${params}`);
  const results = Array.isArray(json.results) ? json.results : [];
  const result = results[0] as Record<string, unknown> | undefined;
  if (!result) throw new Error(`No location found for "${query}"`);
  const label = [result.name, result.admin1, result.country_code].filter(Boolean).join(', ');
  return { lat: Number(result.latitude), lon: Number(result.longitude), label: label || query };
}

async function fetchWeatherForLocation(query: string): Promise<TvMonitorWeatherPayload> {
  const geo = await geocodeLocation(query);
  const params = new URLSearchParams({
    latitude: String(geo.lat),
    longitude: String(geo.lon),
    current: 'temperature_2m,weather_code',
    temperature_unit: 'fahrenheit',
    timezone: 'auto',
  });
  const json = await fetchJson(`${FORECAST_BASE}?${params}`);
  const current = (json.current ?? {}) as Record<string, unknown>;
  const weatherCode = Number(current.weather_code);
  const { condition, icon } = describeWeatherCode(weatherCode);
  return {
    location: geo.label,
    temperatureF: Math.round(Number(current.temperature_2m)),
    weatherCode,
    condition,
    icon,
    fetchedAt: new Date().toISOString(),
  };
}

export function tvMonitorWeatherCacheKey(location: string): string {
  return `tvmonitor:weather:${location.trim().toLowerCase()}`;
}

/**
 * Cached geocode + forecast for a free-text location. Returns null on any
 * failure (unknown location, Open-Meteo unreachable) — callers should treat
 * that as "no weather chip this poll", never as an error to surface.
 */
export async function getTvMonitorWeather(location: string): Promise<TvMonitorWeatherPayload | null> {
  const trimmed = location.trim();
  if (!trimmed) return null;
  try {
    return await cachedSWR(tvMonitorWeatherCacheKey(trimmed), () => fetchWeatherForLocation(trimmed), {
      ttl: WEATHER_CACHE_TTL_SECONDS,
      staleTtl: WEATHER_STALE_TTL_SECONDS,
    });
  } catch (error) {
    console.error('[TvMonitorWeather] fetch failed for', trimmed, error);
    return null;
  }
}
