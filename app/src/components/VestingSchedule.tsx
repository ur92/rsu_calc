import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { addMonths, format, isAfter, startOfMonth } from 'date-fns';
import type { ParsedData } from '../lib/types';
import { isCapitalTrack, rsuNetPerShare } from '../lib/taxCalc';
import { formatILS, tooltipILS } from '../lib/format';

interface Props {
  data: ParsedData;
  priceUSD: number;
  rate: number;
  marginalRate: number;
  cgRate: number;
}

interface UpcomingVest {
  date: Date;
  monthKey: string;
  monthLabel: string;
  grant: string;
  shares: number;
  track: 'הוני' | 'רגיל';
  netILS: number;
}

export default function VestingSchedule({ data, priceUSD, rate, marginalRate, cgRate }: Props) {
  const today = new Date();
  const horizon = addMonths(today, 12);

  const events: UpcomingVest[] = [];
  for (const g of data.rsus) {
    const cap = isCapitalTrack(g.grantDate);
    const net = rsuNetPerShare(g.fmvAtGrant, priceUSD, marginalRate, cgRate, cap);
    for (const v of g.vestSchedule) {
      if (v.qty <= 0) continue;
      if (!isAfter(v.vestDate, today)) continue;
      if (isAfter(v.vestDate, horizon)) continue;
      const monthStart = startOfMonth(v.vestDate);
      events.push({
        date: v.vestDate,
        monthKey: format(monthStart, 'yyyy-MM'),
        monthLabel: monthStart.toLocaleDateString('he-IL', { year: 'numeric', month: 'short' }),
        grant: g.grantNumber,
        shares: v.qty,
        track: cap ? 'הוני' : 'רגיל',
        netILS: v.qty * net * rate,
      });
    }
  }

  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  const monthMap = new Map<string, { label: string; הוני: number; רגיל: number }>();
  for (const e of events) {
    const cur = monthMap.get(e.monthKey) ?? { label: e.monthLabel, הוני: 0, רגיל: 0 };
    cur[e.track] += e.netILS;
    monthMap.set(e.monthKey, cur);
  }
  const chartData = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => v);

  if (events.length === 0) {
    return <p className="text-sm text-surface-500">אין הבשלות צפויות ב-12 החודשים הקרובים.</p>;
  }

  const totalNet = events.reduce((s, e) => s + e.netILS, 0);
  const totalShares = events.reduce((s, e) => s + e.shares, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5">
        <div className="flex items-baseline justify-between mb-4">
          <h4 className="font-semibold text-surface-800 dark:text-surface-200">נטו צפוי לפי חודש</h4>
          <p className="text-sm text-surface-500">
            סה״כ ב-12 חודשים: <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatILS(totalNet)}</span>
            {' · '}{totalShares.toLocaleString()} מניות
          </p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="label" fontSize={12} />
            <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} fontSize={12} />
            <Tooltip formatter={tooltipILS} />
            <Legend />
            <Bar dataKey="הוני" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
            <Bar dataKey="רגיל" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto scrollbar-thin max-w-full rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead className="bg-surface-50 dark:bg-surface-800/50">
            <tr>
              <Th>תאריך</Th>
              <Th>Grant</Th>
              <Th>מסלול</Th>
              <Th>מניות</Th>
              <Th>נטו (₪)</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
            {events.map((e, i) => (
              <tr key={i} className="hover:bg-surface-50 dark:hover:bg-surface-800/30">
                <td className="py-2.5 px-3">{e.date.toLocaleDateString('he-IL')}</td>
                <td className="py-2.5 px-3 font-mono text-xs">{e.grant}</td>
                <td className="py-2.5 px-3">
                  <span className={`px-2 py-0.5 text-xs rounded ${
                    e.track === 'הוני'
                      ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                  }`}>
                    {e.track}
                  </span>
                </td>
                <td className="py-2.5 px-3">{e.shares.toLocaleString()}</td>
                <td className="py-2.5 px-3 font-medium">{formatILS(e.netILS)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="py-2.5 px-3 text-right font-semibold text-surface-600 dark:text-surface-400 text-xs uppercase tracking-wide">{children}</th>;
}
