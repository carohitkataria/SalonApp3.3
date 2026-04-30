import { useEffect, useRef } from 'react';

/**
 * Auto-refresh hook — runs `callback` on a schedule + when the tab becomes visible.
 *
 * Behaviour:
 *  - Skips ticks while the tab is hidden (saves mobile battery / API calls).
 *  - Re-runs immediately when the tab becomes visible again, so users always see
 *    fresh data the moment they come back.
 *  - Does NOT call the callback on first mount — the component is expected to fetch
 *    its initial data via its own effect.
 *
 * Usage:
 *   useAutoRefresh(() => {
 *     fetchSomething();
 *   }, 15000, [dep1, dep2]);
 */
export default function useAutoRefresh(callback, intervalMs = 15000, deps = []) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!intervalMs || intervalMs <= 0) return undefined;
    const tick = () => {
      try {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        cbRef.current && cbRef.current();
      } catch (e) {
        // swallow — auto-refresh must never crash a page
      }
    };
    const id = setInterval(tick, intervalMs);
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);
}
