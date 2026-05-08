import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { addMonths, isAfter, getQuarter, getYear } from 'date-fns';
import type { ParsedData } from '../lib/types';
import {
  isCapitalTrack, rsuNetPerShare, optionNetPerShare, esppNetPerShare,
} from '../lib/taxCalc';
import { formatILS, tooltipILS } from '../lib/format';

interface Props {
  data: ParsedData;
  priceUSD: number;
  rate: number;
  marginalRate: number;
  cgRate: number;
}

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#64748b'];

export default function PortfolioOverview({ data, priceUSD, rate, marginalRate, cgRate }: Props) {
  const today = new Date();
  const horizon = addMonths(today, 12);

  const { availTotal, vestTotal, futureNet, futureGross, futureShares, quarterlyData } = useMemo(() => {
    // ── Available now (blocked shares / exercisable options) ──────────────
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

    const availTotal = {
      shares: optShares + rsuCapShares + rsuOrdShares + esppCapShares + esppOrdShares,
      grossILS: optGross + rsuCapGross + rsuOrdGross + esppCapGross + esppOrdGross,
      netILS: optNet + rsuCapNet + rsuOrdNet + esppCapNet + esppOrdNet,
    };

    // ── Vesting next 12 months + future ───────────────────────────────────
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
      {/* Stat cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
        <StatCard
          label="זמין עכשיו למכירה"
          net={availTotal.netILS}
          gross={availTotal.grossILS}
          shares={availTotal.shares}
          color="blue"
        />
        <StatCard
          label="יבשיל בעתיד"
          net={vestTotal.netILS + futureNet}
          gross={vestTotal.grossILS + futureGross}
          shares={vestTotal.shares + futureShares}
          color="purple"
        />
      </div>

      {/* Pie + quarterly bar */}
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
  label, net, gross, shares, color, highlight,
}: { label: string; net: number; gross: number; shares: number; color: string; highlight?: boolean }) {
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
      </div>
    </div>
  );
}
