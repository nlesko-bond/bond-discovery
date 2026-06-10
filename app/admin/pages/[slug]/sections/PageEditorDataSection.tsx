'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { BOND_ENV_OPTIONS, DEFAULT_BOND_ENV, type BondEnv } from '@/lib/bond-env';
import { formatRelativeTime } from '../page-config-utils';
import type { IPageEditorSectionProps } from '../page-config-types';

interface ICacheStatus {
  cronLastRun: { at?: string; warmed?: number; errors?: string[]; skipped?: number } | null;
  lastRefreshed: number | null;
}

export function PageEditorDataSection({ config, setConfig }: IPageEditorSectionProps) {
  const [status, setStatus] = useState<ICacheStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [warming, setWarming] = useState(false);
  const [warmMessage, setWarmMessage] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/cache-status?slug=${encodeURIComponent(config.slug)}`);
      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
      setStatus(await res.json());
      setStatusError(false);
    } catch {
      setStatus(null);
      setStatusError(true);
    }
  }, [config.slug]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const refreshNow = async () => {
    setWarming(true);
    setWarmMessage(null);
    try {
      const res = await fetch(`/api/admin/warm?slug=${encodeURIComponent(config.slug)}`, {
        method: 'POST',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setWarmMessage(body?.error || `Refresh failed (${res.status})`);
      } else if (body?.result === 'timeout') {
        setWarmMessage('Warm timed out — the next cron run will pick this page up.');
      } else {
        setWarmMessage('Cache refreshed.');
        await fetchStatus();
      }
    } catch {
      setWarmMessage('Refresh failed — network error.');
    } finally {
      setWarming(false);
    }
  };

  const lastWarmed = formatRelativeTime(status?.lastRefreshed ?? null);
  const cronLastRun = formatRelativeTime(status?.cronLastRun?.at ?? null);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Data &amp; Caching</h2>
        <p className="mt-1 text-sm text-gray-600">
          How fresh this page&apos;s program and schedule data is, and which Bond environment it
          reads from.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Cache status</h3>
            <p className="mt-1 text-sm text-gray-600">
              Last warmed (this page):{' '}
              <span className="font-medium text-gray-900">{lastWarmed || 'unknown'}</span>
            </p>
            <p className="text-sm text-gray-600">
              Warm cron last ran:{' '}
              <span className="font-medium text-gray-900">{cronLastRun || 'unknown'}</span>
              {status?.cronLastRun?.errors && status.cronLastRun.errors.length > 0 && (
                <span className="ml-2 text-amber-700">
                  ({status.cronLastRun.errors.length} slug(s) errored on the last run)
                </span>
              )}
            </p>
            {statusError && (
              <p className="mt-1 text-xs text-gray-500">
                Cache status unavailable (KV not configured or request failed).
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn-secondary flex shrink-0 items-center gap-2"
            onClick={refreshNow}
            disabled={warming}
          >
            <RefreshCw size={16} className={warming ? 'animate-spin' : undefined} />
            {warming ? 'Refreshing…' : 'Refresh now'}
          </button>
        </div>
        {warmMessage && <p className="mt-3 text-sm text-gray-700">{warmMessage}</p>}
      </div>

      <div>
        <h3 className="mb-4 font-semibold text-gray-900">Cache &amp; performance</h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="label">Cache TTL (seconds)</label>
            <input
              type="number"
              className="input"
              placeholder="300"
              value={config.cacheTtl || 300}
              onChange={(event) =>
                setConfig({ ...config, cacheTtl: parseInt(event.target.value, 10) || 300 })
              }
            />
            <p className="mt-1 text-xs text-gray-500">
              How long API responses for this page are cached. Default: 300 (5 minutes).
            </p>
          </div>

          <div>
            <label className="label">Availability cache TTL (seconds)</label>
            <input
              type="number"
              min={15}
              className="input"
              placeholder="60"
              value={config.features.availabilityCacheTtl || 60}
              onChange={(event) =>
                setConfig({
                  ...config,
                  features: {
                    ...config.features,
                    availabilityCacheTtl: parseInt(event.target.value, 10) || 60,
                  },
                })
              }
            />
            <p className="mt-1 text-xs text-gray-500">
              How long spots-remaining counts may be stale. Default: 60.
            </p>
          </div>

          <div>
            <label className="label">Cache warm policy</label>
            <select
              className="input"
              value={config.features.discoveryRefreshPolicy || '15min'}
              onChange={(event) =>
                setConfig({
                  ...config,
                  features: {
                    ...config.features,
                    discoveryRefreshPolicy: event.target.value as
                      | '5min'
                      | '15min'
                      | '30min'
                      | '60min',
                  },
                })
              }
            >
              <option value="5min">Every 5 minutes</option>
              <option value="15min">Every 15 minutes (default)</option>
              <option value="30min">Every 30 minutes</option>
              <option value="60min">Every 60 minutes</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              How often the background cron re-fetches this page&apos;s schedule from Bond.
            </p>
          </div>

          <div>
            <label className="label">Event horizon (months)</label>
            <input
              type="number"
              min={1}
              max={24}
              className="input"
              placeholder="3"
              value={config.features.eventHorizonMonths ?? 3}
              onChange={(event) =>
                setConfig({
                  ...config,
                  features: {
                    ...config.features,
                    eventHorizonMonths: parseInt(event.target.value, 10) || 3,
                  },
                })
              }
            />
            <p className="mt-1 text-xs text-gray-500">
              How many months of upcoming events the schedule shows. Default: 3.
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={config.features.discoveryCacheEnabled !== false}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    features: { ...config.features, discoveryCacheEnabled: event.target.checked },
                  })
                }
              />
              <div>
                <span className="font-medium">Enable cache-first schedule</span>
                <p className="text-xs text-gray-500">
                  Default: on. Uses warmed cache for fast loads with fresh availability overlay.
                </p>
              </div>
            </label>
            <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              Turning this off makes every visit hit the Bond API directly — the live page gets
              slower and may be rate-limited. Leave on unless debugging stale data.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 font-semibold text-gray-900">Bond environment</h3>
        <div>
          <label className="label">Bond env</label>
          <select
            className="input"
            value={config.features.bondEnv || DEFAULT_BOND_ENV}
            onChange={(event) =>
              setConfig({
                ...config,
                features: { ...config.features, bondEnv: event.target.value as BondEnv },
              })
            }
          >
            {BOND_ENV_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Which Bond API environment this page reads programs and schedules from. Default:{' '}
            {DEFAULT_BOND_ENV}.
          </p>
          <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            Changing this swaps ALL data on the live page to another environment. Only change for
            test pages.
          </p>
        </div>
      </div>
    </div>
  );
}
