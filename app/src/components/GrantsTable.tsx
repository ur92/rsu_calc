import type { FmvSource, RsuGrant } from '../lib/types';
import { isCapitalTrack, rsuNetPerShare, rsuEffectiveTaxRate } from '../lib/taxCalc';
import { formatILS, formatNumber } from '../lib/format';

interface Props {
  rsus: RsuGrant[];
  priceUSD: number;
  rate: number;
  marginalRate: number;
  cgRate: number;
  onEditFmv?: (grantNumber: string, fmv: number) => void;
  fmvLoading?: boolean;
}

function FmvSourceBadge({ source, loading }: { source?: FmvSource; loading: boolean }) {
  if (loading && !source) {
    return (
      <span className="inline-block w-2 h-2 rounded-full bg-surface-300 dark:bg-surface-600 animate-pulse ml-1" title="מחשב FMV..." />
    );
  }
  if (source === 'calculated') {
    return (
      <span
        className="inline-block text-[10px] px-1 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 ml-1 leading-none"
        title="ממוצע 20 ימי מסחר לפני תאריך ההענקה (שיטת JFrog)"
      >
        20d
      </span>
    );
  }
  if (source === 'manual') {
    return (
      <span
        className="inline-block text-[10px] px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 ml-1 leading-none"
        title="ערך שהוזן ידנית"
      >
        ידני
      </span>
    );
  }
  // vest-proxy or undefined
  return (
    <span
      className="inline-block text-[10px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 ml-1 leading-none"
      title="eTrade לא מייצא FMV ביום הענקה — לקוח מה-vest הראשון (פחות מדויק)"
    >
      vest
    </span>
  );
}

export default function GrantsTable({ rsus, priceUSD, rate, marginalRate, cgRate, onEditFmv, fmvLoading = false }: Props) {
  const sorted = [...rsus].sort((a, b) => a.grantDate.getTime() - b.grantDate.getTime());

  if (sorted.length === 0) {
    return <p className="text-sm text-surface-500">לא נמצאו RSU grants בקובץ.</p>;
  }

  return (
    <div className="overflow-x-auto scrollbar-thin rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900">
      <table className="w-full text-sm">
        <thead className="bg-surface-50 dark:bg-surface-800/50">
          <tr>
            <Th>Grant #</Th>
            <Th>תאריך הענקה</Th>
            <Th>FMV הענקה ($)</Th>
            <Th>מסלול</Th>
            <Th>Vested</Th>
            <Th>Blocked</Th>
            <Th>Unvested</Th>
            <Th>נטו/מניה ($)</Th>
            <Th>מס אפקטיבי</Th>
            <Th>שווי Blocked נטו (₪)</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
          {sorted.map((g) => {
            const cap = isCapitalTrack(g.grantDate);
            const net = rsuNetPerShare(g.fmvAtGrant, priceUSD, marginalRate, cgRate, cap);
            const effRate = rsuEffectiveTaxRate(g.fmvAtGrant, priceUSD, marginalRate, cgRate, cap);
            const totalNet = g.blockedQty * net * rate;
            return (
              <tr key={g.grantNumber} className="hover:bg-surface-50 dark:hover:bg-surface-800/30">
                <td className="py-3 px-3 font-mono text-xs">{g.grantNumber}</td>
                <td className="py-3 px-3">{g.grantDate.toLocaleDateString('he-IL')}</td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-1">
                    {onEditFmv ? (
                      <input
                        type="number"
                        step={0.01}
                        value={g.fmvAtGrant || ''}
                        onChange={(e) => onEditFmv(g.grantNumber, Number(e.target.value))}
                        className="w-20 px-2 py-1 text-sm rounded border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900"
                      />
                    ) : (
                      <span className="font-mono">${g.fmvAtGrant.toFixed(2)}</span>
                    )}
                    <FmvSourceBadge source={g.fmvSource} loading={fmvLoading} />
                  </div>
                </td>
                <td className="py-3 px-3">
                  <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                    cap
                      ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                  }`}>
                    {cap ? 'הוני' : 'רגיל'}
                  </span>
                </td>
                <td className="py-3 px-3">{formatNumber(g.vestedQty)}</td>
                <td className="py-3 px-3 font-medium">{formatNumber(g.blockedQty)}</td>
                <td className="py-3 px-3 text-surface-500">{formatNumber(g.unvestedQty)}</td>
                <td className="py-3 px-3 font-mono">${net.toFixed(2)}</td>
                <td className="py-3 px-3">{(effRate * 100).toFixed(0)}%</td>
                <td className="py-3 px-3 font-bold">{formatILS(totalNet)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="py-3 px-3 text-right font-semibold text-surface-600 dark:text-surface-400 text-xs uppercase tracking-wide">{children}</th>;
}
