import { useMemo } from 'react';
import { format, isAfter, startOfMonth } from 'date-fns';
import type { ParsedData } from '../lib/types';
import { isCapitalTrack, rsuNetPerShare } from '../lib/taxCalc';
import { formatILS, formatNumber, formatMonthYearHe } from '../lib/format';

interface Props {
  data: ParsedData;
  priceUSD: number;
  rate: number;
  marginalRate: number;
  cgRate: number;
}

interface MonthRow {
  monthKey: string;
  monthLabel: string;
  grants: Set<string>;
  tracks: Set<'הוני' | 'רגיל'>;
  qty: number;
  netILS: number;
}

export default function FutureVestsTable({ data, priceUSD, rate, marginalRate, cgRate }: Props) {
  const { rows, totalShares, totalNet } = useMemo(() => {
    const today = new Date();
    const monthMap = new Map<string, MonthRow>();
    for (const g of data.rsus) {
      for (const v of g.vestSchedule) {
        if (v.qty <= 0 || !isAfter(v.vestDate, today)) continue;
        const cap = isCapitalTrack(g.grantDate, v.vestDate);
        const net = rsuNetPerShare(g.fmvAtGrant, priceUSD, marginalRate, cgRate, cap);
        const monthStart = startOfMonth(v.vestDate);
        const monthKey = format(monthStart, 'yyyy-MM');
        const cur = monthMap.get(monthKey) ?? {
          monthKey,
          monthLabel: formatMonthYearHe(monthStart),
          grants: new Set<string>(),
          tracks: new Set<'הוני' | 'רגיל'>(),
          qty: 0,
          netILS: 0,
        };
        cur.grants.add(g.grantNumber);
        cur.tracks.add(cap ? 'הוני' : 'רגיל');
        cur.qty += v.qty;
        cur.netILS += v.qty * net * rate;
        monthMap.set(monthKey, cur);
      }
    }
    const collected = Array.from(monthMap.values()).sort((a, b) =>
      a.monthKey.localeCompare(b.monthKey)
    );
    return {
      rows: collected,
      totalShares: collected.reduce((s, r) => s + r.qty, 0),
      totalNet: collected.reduce((s, r) => s + r.netILS, 0),
    };
  }, [data, priceUSD, rate, marginalRate, cgRate]);

  if (rows.length === 0) {
    return <p className="text-sm text-surface-500">אין מניות עם הבשלה עתידית.</p>;
  }

  return (
    <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-50 dark:bg-surface-800/50">
          <tr>
            <th className="py-2.5 px-3 text-right font-semibold text-surface-600 dark:text-surface-400 text-xs">חודש הבשלה</th>
            <th className="py-2.5 px-3 text-right font-semibold text-surface-600 dark:text-surface-400 text-xs">Grants</th>
            <th className="py-2.5 px-3 text-right font-semibold text-surface-600 dark:text-surface-400 text-xs">מסלול</th>
            <th className="py-2.5 px-3 text-right font-semibold text-surface-600 dark:text-surface-400 text-xs">מניות</th>
            <th className="py-2.5 px-3 text-right font-semibold text-surface-600 dark:text-surface-400 text-xs">נטו (₪)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
          {rows.map((row) => {
            const grantsArr = Array.from(row.grants);
            const grantsLabel =
              grantsArr.length === 1 ? grantsArr[0] : `${grantsArr.length} מענקים`;
            const grantsTitle = grantsArr.join(', ');
            const mixed = row.tracks.size > 1;
            const onlyTrack = mixed ? null : Array.from(row.tracks)[0];
            return (
              <tr key={row.monthKey} className="hover:bg-surface-50 dark:hover:bg-surface-800/30">
                <td className="py-2 px-3">{row.monthLabel}</td>
                <td
                  className="py-2 px-3 font-mono text-xs text-surface-600 dark:text-surface-400"
                  title={grantsTitle}
                >
                  {grantsLabel}
                </td>
                <td className="py-2 px-3">
                  {mixed ? (
                    <span className="px-2 py-0.5 text-xs rounded font-medium bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400">
                      מעורב
                    </span>
                  ) : (
                    <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                      onlyTrack === 'הוני'
                        ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                        : 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                    }`}>
                      {onlyTrack}
                    </span>
                  )}
                </td>
                <td className="py-2 px-3">{formatNumber(row.qty)}</td>
                <td className="py-2 px-3 font-medium">{formatILS(row.netILS)}</td>
              </tr>
            );
          })}
          <tr className="font-bold border-t-2 border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-800/30">
            <td className="py-2.5 px-3" colSpan={3}>סה"כ</td>
            <td className="py-2.5 px-3">{formatNumber(totalShares)}</td>
            <td className="py-2.5 px-3">{formatILS(totalNet)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
