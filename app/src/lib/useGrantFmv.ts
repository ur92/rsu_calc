import { useEffect, useState } from 'react';
import type { RsuGrant } from './types';

interface FmvResponse {
  fmv: number;
  tradingDays: number;
  method: string;
}

/**
 * For each unique grant date in `rsus`, fetches the 20-trading-day trailing
 * average closing price of FROG from /api/fmv-at-grant (JFrog's RSU pricing
 * method). Returns a map of YYYY-MM-DD → calculated FMV.
 *
 * The effect only re-runs when the set of grant dates changes (i.e. a new
 * file is loaded), not when FMV values are manually edited.
 */
export function useGrantFmv(rsus: RsuGrant[]): {
  fmvByDate: Record<string, number>;
  isLoading: boolean;
} {
  const [fmvByDate, setFmvByDate] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Stable key: only re-fetch when the set of grant dates changes
  const grantsKey = [...new Set(rsus.map((g) => g.grantDate.toISOString().slice(0, 10)))]
    .sort()
    .join('|');

  useEffect(() => {
    if (!grantsKey) return;

    const dates = grantsKey.split('|').filter(Boolean);
    if (dates.length === 0) return;

    let cancelled = false;

    async function fetchAll() {
      setIsLoading(true);
      const results = await Promise.all(
        dates.map(async (dateStr) => {
          try {
            const res = await fetch(`/api/fmv-at-grant?grantDate=${dateStr}`);
            if (!res.ok) return { dateStr, fmv: null };
            const data = (await res.json()) as FmvResponse;
            return { dateStr, fmv: typeof data.fmv === 'number' && data.fmv > 0 ? data.fmv : null };
          } catch {
            return { dateStr, fmv: null };
          }
        }),
      );

      if (cancelled) return;

      const map: Record<string, number> = {};
      for (const { dateStr, fmv } of results) {
        if (fmv !== null) map[dateStr] = fmv;
      }
      setFmvByDate(map);
      setIsLoading(false);
    }

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [grantsKey]); // grantsKey is derived from grant dates, not the rsus array reference

  return { fmvByDate, isLoading };
}
