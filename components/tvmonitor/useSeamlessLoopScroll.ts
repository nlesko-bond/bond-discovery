'use client';

import { useEffect, useState, type MutableRefObject } from 'react';
import type { TvMonitorScheduleBlock } from '@/types/tvmonitor';

/**
 * Seamless auto-scroll loop, shared by every schedule view (column grid,
 * unified feed). Columns that overflow render their content TWICE; once the
 * first copy has scrolled fully past, scrollTop silently shifts back by
 * exactly one copy's height — pixel-identical content makes the reset
 * invisible, so the board reads as a continuous ticker, never a jump.
 *
 * Callers render each column's content twice themselves (a visible copy plus
 * an aria-hidden one) whenever this hook reports that column as looping —
 * see TvScheduleGrid / TvScheduleFeed for the render-twice pattern.
 *
 * `synchronized` mode keeps one shared clock across all keys (matching
 * columns' original behavior); with a single key it's equivalent either way.
 */
export function useSeamlessLoopScroll<K>(
  columnRefs: MutableRefObject<Map<K, HTMLDivElement>>,
  settings: Pick<TvMonitorScheduleBlock, 'autoScroll' | 'scrollSpeed' | 'scrollPauseSeconds' | 'scrollMode'>,
  /** Recompute overflow when content changes (event count, text size, layout mode, ...). */
  signature: string,
): Set<K> {
  const [loopingKeys, setLoopingKeys] = useState<Set<K>>(new Set());

  useEffect(() => {
    if (!settings.autoScroll) {
      setLoopingKeys(new Set());
      return;
    }
    const measure = () => {
      const next = new Set<K>();
      columnRefs.current.forEach((el, key) => {
        const copy = el.firstElementChild as HTMLElement | null;
        const copyHeight = copy?.offsetHeight ?? el.scrollHeight;
        if (copyHeight > el.clientHeight + 4) next.add(key);
      });
      setLoopingKeys((prev) => {
        if (prev.size === next.size && Array.from(next).every((key) => prev.has(key))) return prev;
        return next;
      });
    };
    // After paint, and again on resize (font loads / TV rotation).
    const t = setTimeout(measure, 50);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signature stands in for content deps
  }, [settings.autoScroll, signature]);

  useEffect(() => {
    if (!settings.autoScroll || loopingKeys.size === 0) return;

    const pxPerSecond = settings.scrollSpeed * 24;
    const pauseMs = settings.scrollPauseSeconds * 1000;
    const synchronized = settings.scrollMode === 'synchronized';

    interface ScrollState {
      progress: number;
      pauseUntil: number;
    }
    const states = new Map<K, ScrollState>();
    const syncState: ScrollState = { progress: 0, pauseUntil: performance.now() + pauseMs };

    const copyHeightOf = (el: HTMLDivElement) => {
      const copy = el.firstElementChild as HTMLElement | null;
      return copy?.offsetHeight ?? 0;
    };

    const advance = (state: ScrollState, wrapAt: number, nowMs: number, dt: number) => {
      if (nowMs < state.pauseUntil || wrapAt <= 0) return;
      state.progress += pxPerSecond * dt;
      if (state.progress >= wrapAt) {
        // Seamless wrap: the second copy's top is now exactly where the
        // first copy's top was — shift back invisibly and pause there.
        state.progress -= wrapAt;
        state.pauseUntil = nowMs + pauseMs;
      }
    };

    let raf = 0;
    let last = performance.now();

    const tick = (nowMs: number) => {
      const dt = Math.min(0.1, (nowMs - last) / 1000);
      last = nowMs;

      const columns = Array.from(columnRefs.current.entries()).filter(([key]) => loopingKeys.has(key));

      if (synchronized) {
        // One shared clock: all columns move at the same speed; each wraps
        // on its own copy height so shorter columns simply cycle sooner.
        const primaryWrap = Math.max(0, ...columns.map(([, el]) => copyHeightOf(el)));
        advance(syncState, primaryWrap, nowMs, dt);
        columns.forEach(([, el]) => {
          const wrap = copyHeightOf(el);
          if (wrap > 0) el.scrollTop = syncState.progress % wrap;
        });
      } else {
        columns.forEach(([key, el]) => {
          const wrap = copyHeightOf(el);
          if (wrap <= 0) return;
          let state = states.get(key);
          if (!state) {
            state = { progress: 0, pauseUntil: nowMs + pauseMs };
            states.set(key, state);
          }
          advance(state, wrap, nowMs, dt);
          el.scrollTop = state.progress;
        });
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      columnRefs.current.forEach((el) => {
        el.scrollTop = 0;
      });
    };
  }, [settings.autoScroll, settings.scrollSpeed, settings.scrollMode, settings.scrollPauseSeconds, loopingKeys]);

  return loopingKeys;
}
