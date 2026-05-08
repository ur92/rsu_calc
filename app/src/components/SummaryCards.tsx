import type { ParsedData } from '../lib/types';
import {
  rsuNetPerShare, optionNetPerShare, esppNetPerShare, isCapitalTrack,
} from '../lib/taxCalc';
import { formatILS, formatNumber } from '../lib/format';

interface Props {
  data: ParsedData;
  priceUSD: number;
  rate: number;
  marginalRate: number;
  cgRate: number;
}

export default function SummaryCards({ data, priceUSD, rate, marginalRate, cgRate }: Props) {
  let rsuNetILS = 0;
  let rsuShares = 0;
  for (const g of data.rsus) {
    const cap = isCapitalTrack(g.grantDate);
    const net = rsuNetPerShare(g.fmvAtGrant, priceUSD, marginalRate, cgRate, cap);
    rsuNetILS += g.blockedQty * net * rate;
    rsuShares += g.blockedQty;
  }

  let optionNetILS = 0;
  let optionShares = 0;
  for (const o of data.options) {
    const net = optionNetPerShare(o.exercisePrice, priceUSD, cgRate);
    optionNetILS += o.exercisableQty * net * rate;
    optionShares += o.exercisableQty;
  }

  let esppNetILS = 0;
  let esppShares = 0;
  for (const e of data.espp) {
    const cap = isCapitalTrack(e.grantDate);
    const net = esppNetPerShare(e.purchasePrice, e.purchaseDateFmv, priceUSD, marginalRate, cgRate, cap);
    esppNetILS += e.blockedQty * net * rate;
    esppShares += e.blockedQty;
  }

  const totalNet = rsuNetILS + optionNetILS + esppNetILS;
  const totalShares = rsuShares + optionShares + esppShares;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
      <Card label="RSU מוחזק (נטו)" value={formatILS(rsuNetILS)} sub={`${formatNumber(rsuShares)} מניות`} accent="blue" />
      <Card label="אופציות (נטו)" value={formatILS(optionNetILS)} sub={`${formatNumber(optionShares)} מניות`} accent="purple" />
      <Card label="ESPP (נטו)" value={formatILS(esppNetILS)} sub={`${formatNumber(esppShares)} מניות`} accent="cyan" />
      <Card label="סה״כ נטו" value={formatILS(totalNet)} sub={`${formatNumber(totalShares)} מניות`} accent="green" highlight />
    </div>
  );
}

const ACCENT: Record<string, string> = {
  blue: 'text-blue-600 dark:text-blue-400',
  purple: 'text-purple-600 dark:text-purple-400',
  cyan: 'text-cyan-600 dark:text-cyan-400',
  green: 'text-emerald-600 dark:text-emerald-400',
};

function Card({ label, value, sub, accent, highlight }: { label: string; value: string; sub: string; accent: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 border ${
      highlight
        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30'
        : 'border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900'
    }`}>
      <p className="text-sm text-surface-500 dark:text-surface-400">{label}</p>
      <p className={`mt-2 font-bold ${highlight ? 'text-3xl' : 'text-2xl'} ${ACCENT[accent]}`}>{value}</p>
      <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">{sub}</p>
    </div>
  );
}
