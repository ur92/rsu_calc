import { useMemo } from 'react';
import type { ParsedData } from '../lib/types';
import {
  isCapitalTrack, rsuNetPerShare, optionNetPerShare, esppNetPerShare,
} from '../lib/taxCalc';
import { formatILS } from '../lib/format';

interface Props {
  data: ParsedData;
  priceUSD: number;
  rate: number;
  marginalRate: number;
  cgRate: number;
}

interface AvailRow {
  label: string;
  track: 'הוני' | 'רגיל';
  shares: number;
  grossILS: number;
  netILS: number;
}

export default function AvailableNowTable({ data, priceUSD, rate, marginalRate, cgRate }: Props) {
  const { rows, total } = useMemo(() => {
    let optShares = 0, optGross = 0, optNet = 0;
    let rsuCapShares = 0, rsuCapGross = 0, rsuCapNet = 0;
    let rsuOrdShares = 0, rsuOrdGross = 0, rsuOrdNet = 0;
    let esppCapShares = 0, esppCapGross = 0, esppCapNet = 0;
    let esppOrdShares = 0, esppOrdGross = 0, esppOrdNet = 0;

    for (const o of data.options) {
      const qty = o.blockedQty > 0 ? o.blockedQty : o.exercisableQty;
      if (qty <= 0 || priceUSD <= o.exercisePrice) continue;
      optShares += qty;
      optGross += qty * priceUSD * rate;
      optNet += qty * optionNetPerShare(o.exercisePrice, priceUSD, cgRate) * rate;
    }

    for (const g of data.rsus) {
      if (g.blockedQty <= 0) continue;
      const cap = isCapitalTrack(g.grantDate);
      const net = rsuNetPerShare(g.fmvAtGrant, priceUSD, marginalRate, cgRate, cap);
      if (cap) {
        rsuCapShares += g.blockedQty;
        rsuCapGross += g.blockedQty * priceUSD * rate;
        rsuCapNet += g.blockedQty * net * rate;
      } else {
        rsuOrdShares += g.blockedQty;
        rsuOrdGross += g.blockedQty * priceUSD * rate;
        rsuOrdNet += g.blockedQty * net * rate;
      }
    }

    for (const e of data.espp) {
      if (e.blockedQty <= 0) continue;
      const cap = isCapitalTrack(e.grantDate);
      const net = esppNetPerShare(e.purchasePrice, e.purchaseDateFmv, priceUSD, marginalRate, cgRate, cap);
      if (cap) {
        esppCapShares += e.blockedQty;
        esppCapGross += e.blockedQty * priceUSD * rate;
        esppCapNet += e.blockedQty * net * rate;
      } else {
        esppOrdShares += e.blockedQty;
        esppOrdGross += e.blockedQty * priceUSD * rate;
        esppOrdNet += e.blockedQty * net * rate;
      }
    }

    const computedRows: AvailRow[] = [
      optShares > 0    && { label: 'אופציות', track: 'הוני' as const, shares: optShares,    grossILS: optGross,    netILS: optNet },
      rsuCapShares > 0 && { label: 'RSU הוני', track: 'הוני' as const, shares: rsuCapShares, grossILS: rsuCapGross, netILS: rsuCapNet },
      rsuOrdShares > 0 && { label: 'RSU רגיל', track: 'רגיל' as const, shares: rsuOrdShares, grossILS: rsuOrdGross, netILS: rsuOrdNet },
      esppCapShares > 0 && { label: 'ESPP הוני', track: 'הוני' as const, shares: esppCapShares, grossILS: esppCapGross, netILS: esppCapNet },
      esppOrdShares > 0 && { label: 'ESPP רגיל', track: 'רגיל' as const, shares: esppOrdShares, grossILS: esppOrdGross, netILS: esppOrdNet },
    ].filter(Boolean) as AvailRow[];

    return {
      rows: computedRows,
      total: {
        shares: computedRows.reduce((s, r) => s + r.shares, 0),
        grossILS: computedRows.reduce((s, r) => s + r.grossILS, 0),
        netILS: computedRows.reduce((s, r) => s + r.netILS, 0),
      },
    };
  }, [data, priceUSD, rate, marginalRate, cgRate]);

  if (rows.length === 0) {
    return <p className="text-sm text-surface-500">אין מניות זמינות עכשיו (אין Blocked).</p>;
  }

  return (
    <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-50 dark:bg-surface-800/50">
          <tr>
            <th className="py-3 px-4 text-right font-semibold text-surface-600 dark:text-surface-400 text-xs">מקור</th>
            <th className="py-3 px-4 text-right font-semibold text-surface-600 dark:text-surface-400 text-xs">מסלול</th>
            <th className="py-3 px-4 text-right font-semibold text-surface-600 dark:text-surface-400 text-xs">מניות</th>
            <th className="py-3 px-4 text-right font-semibold text-surface-600 dark:text-surface-400 text-xs">ברוטו</th>
            <th className="py-3 px-4 text-right font-semibold text-surface-600 dark:text-surface-400 text-xs">נטו</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
          {rows.map((row) => (
            <tr key={row.label} className="hover:bg-surface-50 dark:hover:bg-surface-800/30">
              <td className="py-3 px-4 font-medium text-surface-800 dark:text-surface-200">{row.label}</td>
              <td className="py-3 px-4">
                <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                  row.track === 'הוני'
                    ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                    : 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                }`}>
                  {row.track}
                </span>
              </td>
              <td className="py-3 px-4">{row.shares.toLocaleString()}</td>
              <td className="py-3 px-4 text-surface-600 dark:text-surface-400">{formatILS(row.grossILS)}</td>
              <td className="py-3 px-4 font-bold">{formatILS(row.netILS)}</td>
            </tr>
          ))}
          <tr className="font-bold border-t-2 border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-800/30">
            <td className="py-3 px-4" colSpan={2}>סה"כ</td>
            <td className="py-3 px-4">{total.shares.toLocaleString()}</td>
            <td className="py-3 px-4 text-surface-600 dark:text-surface-400">{formatILS(total.grossILS)}</td>
            <td className="py-3 px-4">{formatILS(total.netILS)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
