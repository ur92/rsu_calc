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
}

interface AvailRow {
  label: string;
  track: 'הוני' | 'רגיל';
  shares: number;
  grossILS: number;
  netILS: number;
}

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#64748b'];

export default function PortfolioOverview({ data, priceUSD, rate, marginalRate }: Props) {
  const today = new Date();
  const horizon = addMonths(today, 12);

  const { availRows, availTotal, vestTotal, futureNet, futureGross, futureShares, quarterlyData } = useMemo(() => {
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
      optNet += qty * optionNetPerShare(o.exercisePrice, priceUSD) * rate;
    }

    for (const g of data.rsus) {
      if (g.blockedQty <= 0) continue;
      const cap = isCapitalTrack(g.grantDate);
      const net = rsuNetPerShare(g.fmvAtGrant, priceUSD, marginalRate, cap);
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
      const net = esppNetPerShare(e.purchasePrice, e.purchaseDateFmv, priceUSD, marginalRate, cap);
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

    const rows: AvailRow[] = [
      optShares > 0    && { label: 'אופציות', track: 'הוני' as const, shares: optShares,    grossILS: optGross,    netILS: optNet },
      rsuCapShares > 0 && { label: 'RSU הוני', track: 'הוני' as const, shares: rsuCapShares, grossILS: rsuCapGross, netILS: rsuCapNet },
      rsuOrdShares > 0 && { label: 'RSU רגיל', track: 'רגיל' as const, shares: rsuOrdShares, grossILS: rsuOrdGross, netILS: rsuOrdNet },
      esppCapShares > 0 && { label: 'ESPP הוני', track: 'הוני' as const, shares: esppCapShares, grossILS: esppCapGross, netILS: esppCapNet },
      esppOrdShares > 0 && { label: 'ESPP רגיל', track: 'רגיל' as const, shares: esppOrdShares, grossILS: esppOrdGross, netILS: esppOrdNet },
    ].filter(Boolean) as AvailRow[];

    const availTotal = {
      shares: rows.reduce((s, r) => s + r.shares, 0),
      grossILS: rows.reduce((s, r) => s + r.grossILS, 0),
      netILS: rows.reduce((s, r) => s + r.netILS, 0),
    };

    // ── Vesting next 12 months + future ───────────────────────────────────
    const quarterMap = new Map<string, { label: string; netILS: number }>();
    let vestNetTotal = 0, vestGrossTotal = 0, vestSharesTotal = 0;
    let futureNetTotal = 0, futureGrossTotal = 0, futureSharesTotal = 0;

    for (const g of data.rsus) {
      const cap = isCapitalTrack(g.grantDate);
      const net = rsuNetPerShare(g.fmvAtGrant, priceUSD, marginalRate, cap);
      for (const v of g.vestSchedule) {
        if (v.qty <= 0 || !isAfter(v.vestDate, today)) continue;
        const grossILS = v.qty * priceUSD * rate;
        const netILS = v.qty * net * rate;
        if (!isAfter(v.vestDate, horizon)) {
          vestNetTotal += netILS;
          vestGrossTotal += grossILS;
          vestSharesTotal += v.qty;
          const q = getQuarter(v.vestDate);
          const yr = getYear(v.vestDate);
          const key = `${yr}-Q${q}`;
          const cur = quarterMap.get(key) ?? { label: `Q${q} ${yr}`, netILS: 0 };
          cur.netILS += netILS;
          quarterMap.set(key, cur);
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
      availRows: rows,
      availTotal,
      vestTotal: { netILS: vestNetTotal, grossILS: vestGrossTotal, shares: vestSharesTotal },
      futureNet: futureNetTotal,
      futureGross: futureGrossTotal,
      futureShares: futureSharesTotal,
      quarterlyData,
    };
  }, [data, priceUSD, rate, marginalRate]);

  const pieData = [
    { name: 'זמין עכשיו', value: Math.round(availTotal.netILS) },
    { name: 'מבשיל 12 חודשים', value: Math.round(vestTotal.netILS) },
    { name: 'טרם הבשלה', value: Math.round(futureNet) },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
        <StatCard
          label="זמין עכשיו למכירה"
          net={availTotal.netILS}
          gross={availTotal.grossILS}
          shares={availTotal.shares}
          color="blue"
        />
        <StatCard
          label="יבשיל ב-12 חודשים הקרובים"
          net={vestTotal.netILS}
          gross={vestTotal.grossILS}
          shares={vestTotal.shares}
          color="purple"
        />
        <StatCard
          label='סה"כ (זמין + הבשלות קרובות)'
          net={availTotal.netILS + vestTotal.netILS}
          gross={availTotal.grossILS + vestTotal.grossILS}
          shares={availTotal.shares + vestTotal.shares}
          color="green"
          highlight
        />
        <StatCard
          label="עתיד לבשל (מעבר ל-12 חודשים)"
          net={futureNet}
          gross={futureGross}
          shares={futureShares}
          color="gray"
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
          <h3 className="font-semibold text-surface-800 dark:text-surface-200 mb-4">הבשלות לפי רבעון</h3>
          {quarterlyData.length === 0 ? (
            <p className="text-sm text-surface-500 pt-8 text-center">אין הבשלות ב-12 החודשים הקרובים</p>
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

      {/* Available now breakdown table */}
      <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-800">
          <h3 className="font-semibold text-surface-800 dark:text-surface-200">מניות זמינות עכשיו</h3>
        </div>
        <div className="overflow-x-auto">
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
              {availRows.map((row) => (
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
                <td className="py-3 px-4">{availTotal.shares.toLocaleString()}</td>
                <td className="py-3 px-4 text-surface-600 dark:text-surface-400">{formatILS(availTotal.grossILS)}</td>
                <td className="py-3 px-4">{formatILS(availTotal.netILS)}</td>
              </tr>
            </tbody>
          </table>
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
