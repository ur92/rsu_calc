import { useMemo } from 'react';
import type { ParsedData } from '../lib/types';
import {
  isCapitalTrack, rsuNetPerShare, rsuEffectiveTaxRate,
  optionNetPerShare, optionEffectiveTaxRate,
  esppNetPerShare, esppEffectiveTaxRate,
  rsuTaxBreakdown, optionTaxBreakdown, esppTaxBreakdown,
  type TaxBreakdown,
} from '../lib/taxCalc';
import { formatILS } from '../lib/format';
import TaxBreakdownTooltip from './TaxBreakdownTooltip';

interface Props {
  data: ParsedData;
  priceUSD: number;
  rate: number;
  marginalRate: number;
  cgRate: number;
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
  breakdown: TaxBreakdown;
}

export default function AvailableNowTable({ data, priceUSD, rate, marginalRate, cgRate }: Props) {
  const { items, totals } = useMemo(() => {
    const next: Item[] = [];

    for (const g of data.rsus) {
      if (g.blockedQty <= 0) continue;
      const cap = isCapitalTrack(g.grantDate);
      const net = rsuNetPerShare(g.fmvAtGrant, priceUSD, marginalRate, cgRate, cap);
      const grossILS = priceUSD * g.blockedQty * rate;
      const netILS = net * g.blockedQty * rate;
      next.push({
        key: `rsu-${g.grantNumber}`,
        label: `RSU ${g.grantNumber} (${g.grantDate.toLocaleDateString('he-IL', { year: 'numeric', month: 'short' })})`,
        type: cap ? 'RSU הוני' : 'RSU רגיל',
        shares: g.blockedQty,
        netPerShare: net,
        effectiveTaxRate: rsuEffectiveTaxRate(g.fmvAtGrant, priceUSD, marginalRate, cgRate, cap),
        grossILS,
        netILS,
        taxILS: grossILS - netILS,
        breakdown: rsuTaxBreakdown(g.fmvAtGrant, priceUSD, marginalRate, cgRate, cap, g.blockedQty, rate),
      });
    }

    for (const o of data.options) {
      if (o.exercisableQty <= 0 || priceUSD <= o.exercisePrice) continue;
      const net = optionNetPerShare(o.exercisePrice, priceUSD, cgRate);
      const grossILS = (priceUSD - o.exercisePrice) * o.exercisableQty * rate;
      const netILS = net * o.exercisableQty * rate;
      next.push({
        key: `opt-${o.grantNumber}`,
        label: `אופציות ${o.grantNumber} (${o.grantDate.toLocaleDateString('he-IL', { year: 'numeric', month: 'short' })})`,
        type: 'אופציות',
        shares: o.exercisableQty,
        netPerShare: net,
        effectiveTaxRate: optionEffectiveTaxRate(o.exercisePrice, priceUSD, cgRate),
        grossILS,
        netILS,
        taxILS: grossILS - netILS,
        breakdown: optionTaxBreakdown(o.exercisePrice, priceUSD, cgRate, o.exercisableQty, rate),
      });
    }

    for (const e of data.espp) {
      if (e.blockedQty <= 0) continue;
      const cap = isCapitalTrack(e.grantDate);
      const net = esppNetPerShare(e.purchasePrice, e.purchaseDateFmv, priceUSD, marginalRate, cgRate, cap);
      const grossILS = priceUSD * e.blockedQty * rate;
      const netILS = net * e.blockedQty * rate;
      next.push({
        key: `espp-${e.purchaseDate.getTime()}`,
        label: `ESPP ${e.purchaseDate.toLocaleDateString('he-IL', { year: 'numeric', month: 'short' })}`,
        type: 'ESPP',
        shares: e.blockedQty,
        netPerShare: net,
        effectiveTaxRate: esppEffectiveTaxRate(e.purchasePrice, e.purchaseDateFmv, priceUSD, marginalRate, cgRate, cap),
        grossILS,
        netILS,
        taxILS: grossILS - netILS,
        breakdown: esppTaxBreakdown(e.purchasePrice, e.purchaseDateFmv, priceUSD, marginalRate, cgRate, cap, e.blockedQty, rate),
      });
    }

    next.sort((a, b) => a.effectiveTaxRate - b.effectiveTaxRate);

    const totals = {
      shares: next.reduce((s, i) => s + i.shares, 0),
      grossILS: next.reduce((s, i) => s + i.grossILS, 0),
      netILS: next.reduce((s, i) => s + i.netILS, 0),
    };

    return { items: next, totals };
  }, [data, priceUSD, rate, marginalRate, cgRate]);

  if (items.length === 0) {
    return <p className="text-sm text-surface-500">אין מניות זמינות למכירה כרגע.</p>;
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
        const netPct =
          item.grossILS > 0
            ? Math.round((item.netILS / item.grossILS) * 100)
            : 0;
        const taxPct = 100 - netPct;

        return (
          <div
            key={item.key}
            className="flex items-center gap-3 p-3 rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900"
          >
            <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold text-white ${badgeColor}`}>
              {rank}
            </div>
            <div className="shrink-0 w-52 text-right">
              <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{item.label}</p>
              <p className="text-xs text-surface-500">{item.type} · {item.shares.toLocaleString()} מניות</p>
            </div>
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <div className="grid grid-cols-3 gap-3 sm:gap-6 text-left">
                <div>
                  <p className="text-xs text-surface-500 mb-0.5">נטו</p>
                  <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{formatILS(item.netILS)}</p>
                </div>
                <div>
                  <p className="text-xs text-surface-500 mb-0.5">ברוטו</p>
                  <p className="text-sm font-medium tabular-nums text-surface-800 dark:text-surface-200">{formatILS(item.grossILS)}</p>
                </div>
                <div>
                  <p className="text-xs text-surface-500 mb-0.5">מס (%)</p>
                  <p className="text-xs text-rose-600 dark:text-rose-400 inline-flex flex-wrap items-center gap-1">
                    <TaxBreakdownTooltip breakdown={item.breakdown} />
                    <span className="tabular-nums">{formatILS(item.taxILS)} ({(item.effectiveTaxRate * 100).toFixed(0)}%)</span>
                  </p>
                </div>
              </div>
              <div className="h-0.5 w-full rounded-full overflow-hidden bg-surface-100 dark:bg-surface-800 flex">
                <div className="h-full bg-emerald-500 shrink-0" style={{ width: `${netPct}%` }} />
                <div className="h-full bg-rose-400 shrink-0" style={{ width: `${taxPct}%` }} />
              </div>
            </div>
          </div>
        );
      })}
      <div className="pt-3 border-t border-surface-200 dark:border-surface-800 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-sm text-surface-600 dark:text-surface-400">
        <span><span className="text-surface-500">מניות:</span> <span className="font-semibold text-surface-800 dark:text-surface-200">{totals.shares.toLocaleString()}</span></span>
        <span><span className="text-surface-500">ברוטו:</span> <span className="font-semibold text-surface-800 dark:text-surface-200">{formatILS(totals.grossILS)}</span></span>
        <span><span className="text-surface-500">נטו:</span> <span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatILS(totals.netILS)}</span></span>
      </div>
    </div>
  );
}
