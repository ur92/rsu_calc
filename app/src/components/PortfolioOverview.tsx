import { useMemo } from 'react';
import { CircleHelp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { addMonths, isAfter, getQuarter, getYear } from 'date-fns';
import type { ParsedData } from '../lib/types';
import {
  isCapitalTrack, rsuNetPerShare, optionNetPerShare, esppNetPerShare,
  computeSurtax, SURTAX_THRESHOLD_NIS,
} from '../lib/taxCalc';
import { jfrogIncomeFromSalePlan, buildFullSalePlan } from '../lib/surtaxFromSalePlan';
import { formatILS, tooltipILS } from '../lib/format';

interface Props {
  data: ParsedData;
  priceUSD: number;
  rate: number;
  marginalRate: number;
  cgRate: number;
  salaryNIS: number;
  otherCapitalIncomeNIS: number;
}

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#64748b'];

export default function PortfolioOverview({
  data, priceUSD, rate, marginalRate, cgRate, salaryNIS, otherCapitalIncomeNIS,
}: Props) {
  const today = new Date();
  const horizon = addMonths(today, 12);

  // Surtax assuming ALL available holdings are sold (for both "זמין עכשיו" and "מס יסף" cards)
  const fullSaleSurtax = useMemo(() => {
    const fullPlan = buildFullSalePlan(data, priceUSD);
    const j = jfrogIncomeFromSalePlan(data, fullPlan, priceUSD, rate);
    return computeSurtax({
      salaryNIS,
      jfrogSaleTotalIncomeNIS: j.totalNIS,
      jfrogSaleCapitalSourceNIS: j.capitalSourceNIS,
      otherCapitalIncomeNIS,
    });
  }, [data, priceUSD, rate, salaryNIS, otherCapitalIncomeNIS]);

  const { availTotal, vestTotal, futureNet, futureGross, futureShares, quarterlyData } = useMemo(() => {
    // availTotal always reflects the TOTAL available holdings (blockedQty / exercisableQty),
    // independent of salePlan. salePlan only affects the surtax card.
    let optShares = 0, optGross = 0, optNet = 0;
    let rsuCapShares = 0, rsuCapGross = 0, rsuCapNet = 0;
    let rsuOrdShares = 0, rsuOrdGross = 0, rsuOrdNet = 0;
    let esppCapShares = 0, esppCapGross = 0, esppCapNet = 0;
    let esppOrdShares = 0, esppOrdGross = 0, esppOrdNet = 0;

    for (const o of data.options) {
      const qty = o.blockedQty > 0 ? o.blockedQty : o.exercisableQty;
      if (qty <= 0 || priceUSD <= o.exercisePrice) continue;
      optShares += qty;
      optGross += qty * (priceUSD - o.exercisePrice) * rate;
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

    const availTotal = {
      shares: optShares + rsuCapShares + rsuOrdShares + esppCapShares + esppOrdShares,
      grossILS: optGross + rsuCapGross + rsuOrdGross + esppCapGross + esppOrdGross,
      netILS: optNet + rsuCapNet + rsuOrdNet + esppCapNet + esppOrdNet,
    };

    const quarterMap = new Map<string, { label: string; netILS: number }>();
    let vestNetTotal = 0, vestGrossTotal = 0, vestSharesTotal = 0;
    let futureNetTotal = 0, futureGrossTotal = 0, futureSharesTotal = 0;

    for (const g of data.rsus) {
      for (const v of g.vestSchedule) {
        if (v.qty <= 0 || !isAfter(v.vestDate, today)) continue;
        const cap = isCapitalTrack(g.grantDate, v.vestDate);
        const net = rsuNetPerShare(g.fmvAtGrant, priceUSD, marginalRate, cgRate, cap);
        const grossILS = v.qty * priceUSD * rate;
        const netILS = v.qty * net * rate;

        const q = getQuarter(v.vestDate);
        const yr = getYear(v.vestDate);
        const key = `${yr}-Q${q}`;
        const cur = quarterMap.get(key) ?? { label: `Q${q} ${yr % 100}`, netILS: 0 };
        cur.netILS += netILS;
        quarterMap.set(key, cur);

        if (!isAfter(v.vestDate, horizon)) {
          vestNetTotal += netILS;
          vestGrossTotal += grossILS;
          vestSharesTotal += v.qty;
        } else {
          futureNetTotal += netILS;
          futureGrossTotal += grossILS;
          futureSharesTotal += v.qty;
        }
      }
    }

    let cumulative = 0;
    const quarterlyData = Array.from(quarterMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => {
        cumulative += v.netILS;
        return { name: v.label, 'נטו ברבעון': Math.round(v.netILS), מצטבר: Math.round(cumulative) };
      });

    return {
      availTotal,
      vestTotal: { netILS: vestNetTotal, grossILS: vestGrossTotal, shares: vestSharesTotal },
      futureNet: futureNetTotal,
      futureGross: futureGrossTotal,
      futureShares: futureSharesTotal,
      quarterlyData,
    };
  }, [data, priceUSD, rate, marginalRate, cgRate, today, horizon]);

  const pieData = [
    { name: 'זמין עכשיו', value: Math.round(availTotal.netILS) },
    { name: 'יבשיל בעתיד', value: Math.round(vestTotal.netILS + futureNet) },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4">
        <StatCard
          label="זמין עכשיו למכירה"
          net={availTotal.netILS - fullSaleSurtax.totalNIS}
          gross={availTotal.grossILS}
          shares={availTotal.shares}
          color="blue"
          surtaxNIS={fullSaleSurtax.totalNIS}
        />
        <StatCard
          label="יבשיל בעתיד"
          net={vestTotal.netILS + futureNet}
          gross={vestTotal.grossILS + futureGross}
          shares={vestTotal.shares + futureShares}
          color="purple"
        />
        <div className="rounded-2xl p-5 border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900">
          <p className="text-sm text-surface-500 dark:text-surface-400 inline-flex items-center gap-1.5">
            מס יסף 2025+
            <span className="relative inline-flex group/st">
              <button
                type="button"
                aria-label="פירוט מס יסף"
                className="inline-flex text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                onClick={(e) => e.preventDefault()}
              >
                <CircleHelp className="w-4 h-4" />
              </button>
              <span
                role="tooltip"
                className="invisible opacity-0 group-hover/st:visible group-hover/st:opacity-100 group-focus-within/st:visible group-focus-within/st:opacity-100 transition-opacity duration-150 absolute z-30 right-0 top-full mt-1 w-80 max-w-[calc(100vw-2rem)] p-3 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 shadow-xl text-right pointer-events-none text-xs leading-5 text-surface-700 dark:text-surface-300"
              >
                <span className="block font-semibold text-surface-900 dark:text-surface-100 mb-1">מס יסף — פירוט (מכירה מלאה)</span>
                <span className="block">הכנסה חייבת כוללת: {formatILS(fullSaleSurtax.totalIncomeNIS)}</span>
                <span className="block">עודף כולל מעל {formatILS(SURTAX_THRESHOLD_NIS)}: {formatILS(Math.max(0, fullSaleSurtax.totalIncomeNIS - SURTAX_THRESHOLD_NIS))}</span>
                <span className="block mt-1">הכנסה ממקור הוני: {formatILS(fullSaleSurtax.capitalIncomeTotalNIS)}</span>
                <span className="block">עודף הוני מעל {formatILS(SURTAX_THRESHOLD_NIS)}: {formatILS(Math.max(0, fullSaleSurtax.capitalIncomeTotalNIS - SURTAX_THRESHOLD_NIS))}</span>
                <span className="block mt-1">3% על עודף כולל: {formatILS(fullSaleSurtax.yasaf3NIS)}</span>
                <span className="block">2% על עודף הוני: {formatILS(fullSaleSurtax.yasaf2NIS)}</span>
                <span className="block mt-1 font-semibold">סה״כ יסף: {formatILS(fullSaleSurtax.totalNIS)}</span>
              </span>
            </span>
          </p>
          <p className="mt-2 font-bold text-2xl text-amber-700 dark:text-amber-400 tabular-nums">
            {formatILS(fullSaleSurtax.totalNIS)}
          </p>
          <p className="mt-1.5 text-xs text-surface-400 dark:text-surface-500">
            אם כל מה שזמין נמכר — שכר + כל ה-lots + הכנסה הונית אחרת
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5">
          <h3 className="font-semibold text-surface-800 dark:text-surface-200 mb-4">חלוקת נכסים</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                labelLine={false}
                fontSize={11}
              >
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={tooltipILS} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5">
          <h3 className="font-semibold text-surface-800 dark:text-surface-200 mb-4">הבשלות עתידיות לפי רבעון</h3>
          {quarterlyData.length === 0 ? (
            <p className="text-sm text-surface-500 pt-8 text-center">אין הבשלות עתידיות</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={quarterlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} fontSize={12} />
                <Tooltip formatter={tooltipILS} />
                <Legend />
                <Bar dataKey="נטו ברבעון" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="מצטבר" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

    </div>
  );
}

function StatCard({
  label, net, gross, shares, color, highlight, surtaxNIS,
}: { label: string; net: number; gross: number; shares: number; color: string; highlight?: boolean; surtaxNIS?: number }) {
  const COLORS: Record<string, string> = {
    blue:   'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    green:  'text-emerald-600 dark:text-emerald-400',
    gray:   'text-surface-500 dark:text-surface-400',
  };
  return (
    <div className={`rounded-2xl p-5 border ${
      highlight
        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30'
        : 'border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900'
    }`}>
      <p className="text-sm text-surface-500 dark:text-surface-400">{label}</p>
      <p className={`mt-2 font-bold ${highlight ? 'text-3xl' : 'text-2xl'} ${COLORS[color]}`}>{formatILS(net)}</p>
      <div className="mt-1.5 space-y-0.5">
        <p className="text-xs text-surface-400 dark:text-surface-500">
          ברוטו: <span className="font-medium">{formatILS(gross)}</span>
        </p>
        <p className="text-xs text-surface-400 dark:text-surface-500">
          {shares.toLocaleString()} מניות
        </p>
        {surtaxNIS !== undefined && surtaxNIS > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            כולל יסף: <span className="font-medium">{formatILS(surtaxNIS)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
