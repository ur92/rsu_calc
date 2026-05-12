import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import type { ParsedData } from '../lib/types';
import {
  isCapitalTrack, rsuNetPerShare, rsuEffectiveTaxRate,
  optionNetPerShare, optionEffectiveTaxRate,
  esppNetPerShare, esppEffectiveTaxRate,
  rsuTaxBreakdown, optionTaxBreakdown, esppTaxBreakdown,
  computeSurtax, rsuLotIncome, optionLotIncome, esppLotIncome, SURTAX_THRESHOLD_NIS,
  type TaxBreakdown,
} from '../lib/taxCalc';
import { jfrogIncomeFromSalePlan } from '../lib/surtaxFromSalePlan';
import { formatILS } from '../lib/format';
import TaxBreakdownTooltip from './TaxBreakdownTooltip';

// ── Slider tick labels (decorative reference marks) ─────────────────────────
const TICK_LABELS = ['0', '25%', '50%', '75%', '100%'] as const;

// ── "אני רוצה לקבל נטו" — humorous over-budget messages ──────────────────────
const OVER_BUDGET_MSGS = [
  'מי אתה חושב שאתה? עומר אדם?',
  'מספר יפה. גם הציפיות שלך',
  'גם אם FROG ב-500$, עדיין לא',
  'כנראה הייתה צריך להיות מייסד, לא עובד',
  'אולי הייתה כדאי לעבוד ב-Google',
  'הבוס שלך מרוויח את זה. לא אתה',
  'מאיפה בדיוק חשבת שזה יגיע?',
  'איה איה למה ככה?',
];



interface Props {
  data: ParsedData;
  priceUSD: number;
  rate: number;
  marginalRate: number;
  cgRate: number;
  salaryNIS: number;
  salePlan: Record<string, number>;
  onSalePlanChange: (key: string, qty: number) => void;
  otherCapitalIncomeNIS: number;
}

interface RawLot {
  key: string;
  label: string;
  type: 'RSU הוני' | 'RSU רגיל' | 'אופציות' | 'ESPP';
  maxShares: number;
  netPerShare: number;
  baseEffectiveTaxRate: number;
  lotTotalNIS: number;
  lotCapitalNIS: number;
  buildBreakdown: (qty: number) => TaxBreakdown;
}

interface RowItem extends RawLot {
  planQty: number;
  grossILS: number;
  netILS: number;
  taxILS: number;
  breakdown: TaxBreakdown;
  effectiveTaxRate: number;
  marginalSurtaxNIS: number;
}

export default function AvailableNowTable({
  data, priceUSD, rate, marginalRate, cgRate, salaryNIS, salePlan,
  onSalePlanChange, otherCapitalIncomeNIS,
}: Props) {
  const rawLots = useMemo((): RawLot[] => {
    const next: RawLot[] = [];

    for (const g of data.rsus) {
      if (g.blockedQty <= 0) continue;
      const cap = isCapitalTrack(g.grantDate);
      const net = rsuNetPerShare(g.fmvAtGrant, priceUSD, marginalRate, cgRate, cap);
      const lb = rsuLotIncome(g.fmvAtGrant, priceUSD, g.blockedQty, rate, cap);
      next.push({
        key: `rsu-${g.grantNumber}`,
        label: `RSU ${g.grantNumber} (${g.grantDate.toLocaleDateString('he-IL', { year: 'numeric', month: 'short' })})`,
        type: cap ? 'RSU הוני' : 'RSU רגיל',
        maxShares: g.blockedQty,
        netPerShare: net,
        baseEffectiveTaxRate: rsuEffectiveTaxRate(g.fmvAtGrant, priceUSD, marginalRate, cgRate, cap),
        lotTotalNIS: lb.totalIncomeNIS,
        lotCapitalNIS: lb.capitalIncomeNIS,
        buildBreakdown: (qty) =>
          rsuTaxBreakdown(g.fmvAtGrant, priceUSD, marginalRate, cgRate, cap, qty, rate),
      });
    }

    for (const o of data.options) {
      if (o.exercisableQty <= 0 || priceUSD <= o.exercisePrice) continue;
      const net = optionNetPerShare(o.exercisePrice, priceUSD, cgRate);
      const lb = optionLotIncome(o.exercisePrice, priceUSD, o.exercisableQty, rate);
      next.push({
        key: `opt-${o.grantNumber}`,
        label: `אופציות ${o.grantNumber} (${o.grantDate.toLocaleDateString('he-IL', { year: 'numeric', month: 'short' })})`,
        type: 'אופציות',
        maxShares: o.exercisableQty,
        netPerShare: net,
        baseEffectiveTaxRate: optionEffectiveTaxRate(o.exercisePrice, priceUSD, cgRate),
        lotTotalNIS: lb.totalIncomeNIS,
        lotCapitalNIS: lb.capitalIncomeNIS,
        buildBreakdown: (qty) => optionTaxBreakdown(o.exercisePrice, priceUSD, cgRate, qty, rate),
      });
    }

    for (const e of data.espp) {
      if (e.blockedQty <= 0) continue;
      const cap = isCapitalTrack(e.grantDate);
      const net = esppNetPerShare(e.purchasePrice, e.purchaseDateFmv, priceUSD, marginalRate, cgRate, cap);
      const lb = esppLotIncome(e.purchaseDateFmv, priceUSD, e.blockedQty, rate, cap);
      next.push({
        key: `espp-${e.purchaseDate.getTime()}`,
        label: `ESPP ${e.purchaseDate.toLocaleDateString('he-IL', { year: 'numeric', month: 'short' })}`,
        type: 'ESPP',
        maxShares: e.blockedQty,
        netPerShare: net,
        baseEffectiveTaxRate: esppEffectiveTaxRate(
          e.purchasePrice, e.purchaseDateFmv, priceUSD, marginalRate, cgRate, cap,
        ),
        lotTotalNIS: lb.totalIncomeNIS,
        lotCapitalNIS: lb.capitalIncomeNIS,
        buildBreakdown: (qty) =>
          esppTaxBreakdown(
            e.purchasePrice, e.purchaseDateFmv, priceUSD, marginalRate, cgRate, cap, qty, rate,
          ),
      });
    }

    return next;
  }, [data, priceUSD, rate, marginalRate, cgRate]);

  const jfrogAgg = useMemo(
    () => jfrogIncomeFromSalePlan(data, salePlan, priceUSD, rate),
    [data, salePlan, priceUSD, rate],
  );

  const portfolioSurtax = useMemo(
    () =>
      computeSurtax({
        salaryNIS,
        jfrogSaleTotalIncomeNIS: jfrogAgg.totalNIS,
        jfrogSaleCapitalSourceNIS: jfrogAgg.capitalSourceNIS,
        otherCapitalIncomeNIS,
      }),
    [salaryNIS, jfrogAgg, otherCapitalIncomeNIS],
  );

  const rowsUnsorted = useMemo((): RowItem[] => {
    const scale = (fullLot: number, qty: number, maxShares: number) =>
      maxShares > 0 ? (fullLot * qty) / maxShares : 0;

    return rawLots.map((lot) => {
      const raw = salePlan[lot.key];
      const planQty =
        raw === undefined ? 0 : Math.min(lot.maxShares, Math.max(0, raw));
      const grossILS = scale(lot.lotTotalNIS, planQty, lot.maxShares);
      const netILS = lot.netPerShare * planQty * rate;
      const taxILS = grossILS - netILS;

      const surWith = portfolioSurtax.totalNIS;
      const tPortion = scale(lot.lotTotalNIS, planQty, lot.maxShares);
      const cPortion = scale(lot.lotCapitalNIS, planQty, lot.maxShares);
      const surWithout = computeSurtax({
        salaryNIS,
        jfrogSaleTotalIncomeNIS: jfrogAgg.totalNIS - tPortion,
        jfrogSaleCapitalSourceNIS: jfrogAgg.capitalSourceNIS - cPortion,
        otherCapitalIncomeNIS,
      }).totalNIS;
      const marginalSurtaxNIS = Math.max(0, surWith - surWithout);

      const baseBd = lot.buildBreakdown(planQty);
      const marginalPct = grossILS > 0 ? marginalSurtaxNIS / grossILS : 0;
      const breakdown: TaxBreakdown = {
        ...baseBd,
        surtaxLine:
          planQty > 0 && marginalSurtaxNIS > 0.005
            ? `יסף שולי על lot זה: ${formatILS(marginalSurtaxNIS)} (${(marginalPct * 100).toFixed(1)}%)`
            : undefined,
      };

      return {
        ...lot,
        planQty,
        grossILS,
        netILS,
        taxILS,
        breakdown,
        marginalSurtaxNIS,
        effectiveTaxRate:
          grossILS > 0
            ? lot.baseEffectiveTaxRate + marginalSurtaxNIS / grossILS
            : lot.baseEffectiveTaxRate,
      };
    });
  }, [
    rawLots,
    salePlan,
    rate,
    portfolioSurtax.totalNIS,
    jfrogAgg.totalNIS,
    jfrogAgg.capitalSourceNIS,
    salaryNIS,
    otherCapitalIncomeNIS,
  ]);

  // Stable sort order — determined once from rawLots (base rate, no marginal surtax),
  // so slider changes never re-order the cards.
  const stableOrder = useMemo(
    () =>
      [...rawLots]
        .sort((a, b) => a.baseEffectiveTaxRate - b.baseEffectiveTaxRate)
        .map((l) => l.key),
    [rawLots],
  );

  const rows = useMemo(() => {
    const byKey = new Map(rowsUnsorted.map((r) => [r.key, r]));
    return stableOrder.map((k) => byKey.get(k)).filter((r): r is RowItem => r !== undefined);
  }, [rowsUnsorted, stableOrder]);

  const totals = useMemo(() => {
    const shares = rowsUnsorted.reduce((s, i) => s + i.planQty, 0);
    const grossILS = rowsUnsorted.reduce((s, i) => s + i.grossILS, 0);
    const netILS = rowsUnsorted.reduce((s, i) => s + i.netILS, 0);
    return { shares, grossILS, netILS };
  }, [rowsUnsorted]);

  const selectAll = useCallback(() => {
    for (const lot of rawLots) onSalePlanChange(lot.key, lot.maxShares);
  }, [rawLots, onSalePlanChange]);

  const clearAll = useCallback(() => {
    for (const lot of rawLots) onSalePlanChange(lot.key, 0);
  }, [rawLots, onSalePlanChange]);


  // ── "אני רוצה לקבל נטו" state + handler ─────────────────────────────────
  const [wantOpen, setWantOpen] = useState(false);
  const [wantValue, setWantValue] = useState('');
  const [wantError, setWantError] = useState<string | null>(null);
  const wantDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (wantDebounceRef.current) clearTimeout(wantDebounceRef.current); }, []);

  const handleWantNet = useCallback((rawInput: string) => {
    const target = parseFloat(rawInput.replace(/,/g, '')) * 1000;
    if (isNaN(target) || target <= 0) {
      setWantError('אנא הזן סכום תקין');
      return;
    }

    // Compute maximum true net achievable (pre-surtax minus full portfolio surtax)
    const fullPlan = rawLots.reduce<Record<string, number>>((acc, l) => {
      acc[l.key] = l.maxShares;
      return acc;
    }, {});
    const fullAgg = jfrogIncomeFromSalePlan(data, fullPlan, priceUSD, rate);
    const fullSur = computeSurtax({
      salaryNIS,
      jfrogSaleTotalIncomeNIS: fullAgg.totalNIS,
      jfrogSaleCapitalSourceNIS: fullAgg.capitalSourceNIS,
      otherCapitalIncomeNIS,
    });
    const fullNetILS =
      rawLots.reduce((s, l) => s + l.netPerShare * l.maxShares * rate, 0) - fullSur.totalNIS;

    if (target > fullNetILS) {
      setWantError(OVER_BUDGET_MSGS[Math.floor(Math.random() * OVER_BUDGET_MSGS.length)]);
      return;
    }

    // Helper: compute true net (after full portfolio surtax) for a given plan
    const computeActualNet = (plan: Record<string, number>): number => {
      const agg = jfrogIncomeFromSalePlan(data, plan, priceUSD, rate);
      const sur = computeSurtax({
        salaryNIS,
        jfrogSaleTotalIncomeNIS: agg.totalNIS,
        jfrogSaleCapitalSourceNIS: agg.capitalSourceNIS,
        otherCapitalIncomeNIS,
      });
      const preNet = rawLots.reduce((s, l) => s + l.netPerShare * (plan[l.key] ?? 0) * rate, 0);
      return preNet - sur.totalNIS;
    };

    const sorted = [...rawLots].sort((a, b) => a.baseEffectiveTaxRate - b.baseEffectiveTaxRate);
    const plan: Record<string, number> = Object.fromEntries(rawLots.map(l => [l.key, 0]));

    // First pass: greedy using pre-surtax net per share as approximation
    let remaining = target;
    for (const lot of sorted) {
      const netPS = lot.netPerShare * rate;
      if (netPS <= 0 || remaining <= 0) continue;
      const qty = Math.min(Math.ceil(remaining / netPS), lot.maxShares);
      plan[lot.key] = qty;
      remaining -= netPS * qty;
    }

    // Top-up pass: surtax reduces actual net below the target — add shares to compensate
    let actualNet = computeActualNet(plan);
    let iter = 0;
    while (actualNet < target - 1 && iter < 5) {
      iter++;
      let improved = false;
      for (const lot of sorted) {
        if (actualNet >= target - 1) break;
        const currentQty = plan[lot.key];
        if (currentQty >= lot.maxShares) continue;
        const netPS = lot.netPerShare * rate;
        if (netPS <= 0) continue;
        const shortage = target - actualNet;
        const additionalQty = Math.min(Math.ceil(shortage / netPS), lot.maxShares - currentQty);
        plan[lot.key] = currentQty + additionalQty;
        const newNet = computeActualNet(plan);
        if (newNet > actualNet) improved = true;
        actualNet = newNet;
      }
      if (!improved) break;
    }

    // Apply the final plan
    for (const lot of rawLots) {
      onSalePlanChange(lot.key, plan[lot.key] ?? 0);
    }

    setWantError(null);
  }, [rawLots, data, priceUSD, rate, salaryNIS, otherCapitalIncomeNIS, onSalePlanChange]);

  if (rawLots.length === 0) {
    return <p className="text-sm text-surface-500">אין מניות זמינות למכירה כרגע.</p>;
  }

  const selectedTotalQty = totals.shares;

  // ── Tax summary panel — extracted so it can be placed in the sidebar ──────
  const taxSummaryPanel = (() => {
    const baseTaxILS = totals.grossILS - totals.netILS;
    const totalTaxILS = baseTaxILS + portfolioSurtax.totalNIS;
    const trueNetILS = totals.netILS - portfolioSurtax.totalNIS;
    const totalTaxPct = totals.grossILS > 0 ? (totalTaxILS / totals.grossILS) * 100 : 0;
    const excessTotal = Math.max(0, portfolioSurtax.totalIncomeNIS - SURTAX_THRESHOLD_NIS);
    const excessCap   = Math.max(0, portfolioSurtax.capitalIncomeTotalNIS - SURTAX_THRESHOLD_NIS);

    return (
      <div className="rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-900/60 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-surface-100 dark:bg-surface-800/60 border-b border-surface-200 dark:border-surface-700">
          <span className="text-xs font-semibold text-surface-600 dark:text-surface-300 uppercase tracking-wide">
            סיכום מס — תוכנית המכירה
          </span>
          <span className="text-xs text-surface-500">
            {totals.shares.toLocaleString()} מניות · ברוטו {formatILS(totals.grossILS)}
          </span>
        </div>
        <div className="divide-y divide-surface-100 dark:divide-surface-800">
          <TaxLine
            label="מס בסיס (102 / רגיל / רווח הון)"
            hint="מסלול הוני 25%, פירותי לפי שיעור שולי"
            amount={-baseTaxILS}
            pct={totals.grossILS > 0 ? baseTaxILS / totals.grossILS : 0}
            color="rose"
          />
          {portfolioSurtax.yasaf3NIS > 0 && (
            <TaxLine
              label="מס יסף 3% — כולל"
              hint={`הכנסה כוללת ${formatILS(portfolioSurtax.totalIncomeNIS)} · עודף מעל ${formatILS(SURTAX_THRESHOLD_NIS)}: ${formatILS(excessTotal)}`}
              amount={-portfolioSurtax.yasaf3NIS}
              pct={totals.grossILS > 0 ? portfolioSurtax.yasaf3NIS / totals.grossILS : 0}
              color="amber"
            />
          )}
          {portfolioSurtax.yasaf2NIS > 0 && (
            <TaxLine
              label="מס יסף 2% — הוני"
              hint={`הכנסה הונית ${formatILS(portfolioSurtax.capitalIncomeTotalNIS)} · עודף: ${formatILS(excessCap)}`}
              amount={-portfolioSurtax.yasaf2NIS}
              pct={totals.grossILS > 0 ? portfolioSurtax.yasaf2NIS / totals.grossILS : 0}
              color="amber"
            />
          )}
          <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-emerald-50/60 dark:bg-emerald-950/20">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">נטו לאחר כל המסים</p>
            <div className="text-left shrink-0">
              <p className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{formatILS(trueNetILS)}</p>
              <p className="text-[10px] text-surface-400 text-left">
                סה״כ מס {formatILS(totalTaxILS)} ({totalTaxPct.toFixed(0)}% מהברוטו)
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  })();

  return (
    <div className="space-y-2">
      {/* Toolbar — full width, includes "אני רוצה לקבל נטו" inline */}
      <div className="flex flex-col gap-1 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Want-net: collapsed button or expanded inline form */}
            {!wantOpen ? (
              <button
                type="button"
                onClick={() => { setWantOpen(true); setWantError(null); }}
                className="px-3 py-1.5 rounded-lg border border-primary-400 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 font-medium"
              >
                אני רוצה לקבל נטו...
              </button>
            ) : (
              <div className="flex items-center gap-1.5 self-stretch">
                <span className="text-surface-600 dark:text-surface-400 font-medium">אני רוצה לקבל נטו</span>
                <input
                  type="number"
                  dir="ltr"
                  placeholder="0"
                  step={10}
                  value={wantValue}
                  onChange={(e) => {
                    const v = e.target.value;
                    setWantValue(v);
                    if (wantDebounceRef.current) clearTimeout(wantDebounceRef.current);
                    wantDebounceRef.current = setTimeout(() => handleWantNet(v), 50);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setWantOpen(false); setWantError(null); setWantValue(''); }
                  }}
                  autoFocus
                  className="w-20 px-2 py-1 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-200 tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <span className="text-surface-500 dark:text-surface-400 text-xs">אלפי ₪</span>
                <button
                  type="button"
                  onClick={() => { setWantOpen(false); setWantError(null); setWantValue(''); }}
                  className="px-2 py-1 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 text-base leading-none"
                  aria-label="סגור"
                >
                  ×
                </button>
              </div>
            )}
            {/* Divider between want-net and the select-all/reset buttons */}
            <span className="w-px h-5 bg-surface-200 dark:bg-surface-700 self-center" aria-hidden="true" />
            <button
              type="button"
              onClick={selectAll}
              className="px-3 py-1.5 rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-800 text-surface-800 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700"
            >
              בחר הכל
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="px-3 py-1.5 rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-800 text-surface-800 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700"
            >
              אפס
            </button>
          </div>
          <span className="text-surface-600 dark:text-surface-400 tabular-nums">
            נבחרו למכירה: <span className="font-semibold text-surface-800 dark:text-surface-200">{selectedTotalQty.toLocaleString()}</span> מניות
          </span>
        </div>
        {wantError && (
          <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{wantError}</p>
        )}
      </div>

      {/* Two-column on large screens: lots left, summary right (sticky) */}
      <div className="lg:flex lg:gap-5 lg:items-start">
        {/* Lot cards */}
        {/* Lot cards column */}
        <div className="flex-1 min-w-0 space-y-2">
          {rows.map((item, idx) => {
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
                className="flex flex-col gap-3 p-3 rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 sm:flex-row sm:items-center"
              >
                {/* On mobile: badge + name/slider sit in a row.
                    On sm+: sm:contents makes this wrapper transparent so badge and
                    name div become direct children of the outer flex row. */}
                <div className="flex items-start gap-3 sm:contents">
                  <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold text-white ${badgeColor}`}>
                    {rank}
                  </div>
                  <div className="flex-1 min-w-0 sm:flex-none sm:shrink-0 sm:w-52 text-right">
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{item.label}</p>
                    <p className="text-xs text-surface-500 mb-2">
                      {item.type} · {item.maxShares.toLocaleString()} זמינות
                    </p>
                    {/* Step slider — 0 / 25% / 50% / 75% / 100% */}
                    <LotSlider
                      planQty={item.planQty}
                      maxShares={item.maxShares}
                      lotKey={item.key}
                      onSalePlanChange={onSalePlanChange}
                    />
                  </div>
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
                        <span className="tabular-nums">
                          {formatILS(item.taxILS)} ({(item.effectiveTaxRate * 100).toFixed(0)}%)
                        </span>
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
        </div>{/* end lot cards column */}

        {/* Tax summary — right column on lg, stacks below on mobile */}
        <div className="mt-3 lg:mt-0 lg:w-72 xl:w-80 shrink-0 lg:sticky lg:top-20">
          {taxSummaryPanel}
        </div>
      </div>{/* end two-column wrapper */}
    </div>
  );
}

const SLIDER_THROTTLE_MS = 100;

function LotSlider({
  planQty, maxShares, lotKey, onSalePlanChange,
}: {
  planQty: number;
  maxShares: number;
  lotKey: string;
  onSalePlanChange: (key: string, qty: number) => void;
}) {
  const committedPct = maxShares > 0 ? Math.round(planQty / maxShares * 100) : 0;
  const [localPct, setLocalPct] = useState(committedPct);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLocalPct(committedPct); }, [committedPct]);

  const localQty = Math.round(maxShares * localPct / 100);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFiredRef = useRef<number>(0);

  // Cancel pending timer on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const commit = useCallback((val: number) => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    lastFiredRef.current = Date.now();
    onSalePlanChange(lotKey, Math.round(maxShares * val / 100));
  }, [lotKey, maxShares, onSalePlanChange]);

  const throttledCommit = useCallback((val: number) => {
    const elapsed = Date.now() - lastFiredRef.current;
    if (elapsed >= SLIDER_THROTTLE_MS) {
      commit(val);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => commit(val), SLIDER_THROTTLE_MS - elapsed);
    }
  }, [commit]);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-surface-400 dark:text-surface-500">
        <span>כמות למכירה</span>
        <span className="tabular-nums font-medium text-surface-600 dark:text-surface-300">
          {localPct}%
          {localQty > 0 && (
            <span className="text-surface-400 dark:text-surface-500"> ({localQty.toLocaleString()})</span>
          )}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={localPct}
        onChange={(e) => { const v = Number(e.target.value); setLocalPct(v); throttledCommit(v); }}
        onMouseUp={(e) => commit(Number((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => commit(Number((e.target as HTMLInputElement).value))}
        className="w-full accent-primary-500 cursor-pointer"
        style={{ WebkitAppearance: 'slider-horizontal' }}
      />
      <div className="flex justify-between text-[9px] text-surface-300 dark:text-surface-600 select-none">
        {TICK_LABELS.map((l) => <span key={l}>{l}</span>)}
      </div>
    </div>
  );
}

function TaxLine({
  label, hint, amount, pct, color,
}: {
  label: string;
  hint: string;
  amount: number; // negative = tax
  pct: number;    // fraction of grossILS
  color: 'rose' | 'amber';
}) {
  const colorCls = color === 'rose'
    ? 'text-rose-700 dark:text-rose-400'
    : 'text-amber-700 dark:text-amber-400';
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2">
      <div className="min-w-0">
        <p className={`text-sm font-medium ${colorCls}`}>{label}</p>
        <p className="text-[11px] text-surface-400 dark:text-surface-500 leading-relaxed">{hint}</p>
      </div>
      <div className="text-left shrink-0">
        <p className={`text-sm font-semibold tabular-nums ${colorCls}`}>{formatILS(amount)}</p>
        <p className="text-[10px] text-surface-400 text-left">({(pct * 100).toFixed(1)}% מהברוטו)</p>
      </div>
    </div>
  );
}
