import type { ParsedData } from '../lib/types';
import {
  isCapitalTrack, rsuNetPerShare, rsuEffectiveTaxRate,
  optionNetPerShare, optionEffectiveTaxRate,
  esppNetPerShare, esppEffectiveTaxRate,
} from '../lib/taxCalc';
import { formatILS } from '../lib/format';

interface Props {
  data: ParsedData;
  priceUSD: number;
  rate: number;
  marginalRate: number;
}

interface Item {
  key: string;
  label: string;
  type: 'RSU הוני' | 'RSU רגיל' | 'אופציות' | 'ESPP';
  shares: number;
  netPerShare: number;
  effectiveTaxRate: number;
  grossILS: number;
  netILS: number;
  taxILS: number;
}

export default function SalePriority({ data, priceUSD, rate, marginalRate }: Props) {
  const items: Item[] = [];

  for (const g of data.rsus) {
    if (g.blockedQty <= 0) continue;
    const cap = isCapitalTrack(g.grantDate);
    const net = rsuNetPerShare(g.fmvAtGrant, priceUSD, marginalRate, cap);
    const grossILS = priceUSD * g.blockedQty * rate;
    const netILS = net * g.blockedQty * rate;
    items.push({
      key: `rsu-${g.grantNumber}`,
      label: `RSU ${g.grantNumber} (${g.grantDate.toLocaleDateString('he-IL', { year: 'numeric', month: 'short' })})`,
      type: cap ? 'RSU הוני' : 'RSU רגיל',
      shares: g.blockedQty,
      netPerShare: net,
      effectiveTaxRate: rsuEffectiveTaxRate(g.fmvAtGrant, priceUSD, marginalRate, cap),
      grossILS,
      netILS,
      taxILS: grossILS - netILS,
    });
  }

  for (const o of data.options) {
    if (o.exercisableQty <= 0 || priceUSD <= o.exercisePrice) continue;
    const net = optionNetPerShare(o.exercisePrice, priceUSD);
    // For options, gross = spread (sale - strike) since strike is the cost basis paid on exercise.
    const grossILS = (priceUSD - o.exercisePrice) * o.exercisableQty * rate;
    const netILS = net * o.exercisableQty * rate;
    items.push({
      key: `opt-${o.grantNumber}`,
      label: `אופציות ${o.grantNumber} (${o.grantDate.toLocaleDateString('he-IL', { year: 'numeric', month: 'short' })})`,
      type: 'אופציות',
      shares: o.exercisableQty,
      netPerShare: net,
      effectiveTaxRate: optionEffectiveTaxRate(o.exercisePrice, priceUSD),
      grossILS,
      netILS,
      taxILS: grossILS - netILS,
    });
  }

  for (const e of data.espp) {
    if (e.blockedQty <= 0) continue;
    const cap = isCapitalTrack(e.grantDate);
    const net = esppNetPerShare(e.purchasePrice, e.purchaseDateFmv, priceUSD, marginalRate, cap);
    const grossILS = priceUSD * e.blockedQty * rate;
    const netILS = net * e.blockedQty * rate;
    items.push({
      key: `espp-${e.purchaseDate.getTime()}`,
      label: `ESPP ${e.purchaseDate.toLocaleDateString('he-IL', { year: 'numeric', month: 'short' })}`,
      type: 'ESPP',
      shares: e.blockedQty,
      netPerShare: net,
      effectiveTaxRate: esppEffectiveTaxRate(e.purchasePrice, e.purchaseDateFmv, priceUSD, marginalRate, cap),
      grossILS,
      netILS,
      taxILS: grossILS - netILS,
    });
  }

  items.sort((a, b) => a.effectiveTaxRate - b.effectiveTaxRate);

  if (items.length === 0) {
    return <p className="text-sm text-surface-500">אין מניות זמינות למכירה כרגע (אין Blocked).</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item, idx) => {
        const rank = idx + 1;
        const badgeColor =
          rank === 1 ? 'bg-emerald-500'
          : rank === 2 ? 'bg-blue-500'
          : rank === 3 ? 'bg-amber-500'
          : 'bg-surface-400 dark:bg-surface-600';
        return (
          <div
            key={item.key}
            className="flex items-center gap-3 p-3 rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${badgeColor}`}>
              {rank}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{item.label}</p>
              <p className="text-xs text-surface-500">{item.type} · {item.shares.toLocaleString()} מניות</p>
            </div>
            <div className="text-left shrink-0 space-y-0.5">
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                {formatILS(item.netILS)} <span className="text-xs font-normal text-surface-500">נטו</span>
              </p>
              <p className="text-xs text-surface-500">
                ברוטו: {formatILS(item.grossILS)}
              </p>
              <p className="text-xs text-rose-600 dark:text-rose-400">
                מס: {formatILS(item.taxILS)} ({(item.effectiveTaxRate * 100).toFixed(0)}%)
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
