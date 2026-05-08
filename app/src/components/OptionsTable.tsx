import type { OptionGrant } from '../lib/types';
import { optionNetPerShare, optionEffectiveTaxRate } from '../lib/taxCalc';
import { formatILS, formatNumber } from '../lib/format';

interface Props {
  options: OptionGrant[];
  priceUSD: number;
  rate: number;
  cgRate: number;
}

export default function OptionsTable({ options, priceUSD, rate, cgRate }: Props) {
  const sorted = [...options].sort((a, b) => a.grantDate.getTime() - b.grantDate.getTime());

  if (sorted.length === 0) {
    return <p className="text-sm text-surface-500">לא נמצאו אופציות בקובץ.</p>;
  }

  return (
    <div className="overflow-x-auto scrollbar-thin rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900">
      <table className="w-full text-sm">
        <thead className="bg-surface-50 dark:bg-surface-800/50">
          <tr>
            <Th>Grant #</Th>
            <Th>תאריך הענקה</Th>
            <Th>מחיר מימוש ($)</Th>
            <Th>תפוגה</Th>
            <Th>Exercisable</Th>
            <Th>Blocked</Th>
            <Th>נטו/מניה ($)</Th>
            <Th>מס אפקטיבי</Th>
            <Th>שווי נטו (₪)</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
          {sorted.map((o) => {
            const underwater = priceUSD <= o.exercisePrice;
            const net = optionNetPerShare(o.exercisePrice, priceUSD, cgRate);
            const effRate = optionEffectiveTaxRate(o.exercisePrice, priceUSD, cgRate);
            const totalNet = o.exercisableQty * net * rate;
            return (
              <tr key={o.grantNumber} className="hover:bg-surface-50 dark:hover:bg-surface-800/30">
                <td className="py-3 px-3 font-mono text-xs">{o.grantNumber}</td>
                <td className="py-3 px-3">{o.grantDate.toLocaleDateString('he-IL')}</td>
                <td className="py-3 px-3 font-mono">${o.exercisePrice.toFixed(2)}</td>
                <td className="py-3 px-3 text-surface-500 text-xs">
                  {o.expirationDate ? o.expirationDate.toLocaleDateString('he-IL') : '—'}
                </td>
                <td className="py-3 px-3 font-medium">{formatNumber(o.exercisableQty)}</td>
                <td className="py-3 px-3">{formatNumber(o.blockedQty)}</td>
                <td className="py-3 px-3 font-mono">
                  {underwater ? (
                    <span className="text-red-600 dark:text-red-400 text-xs">מתחת למימוש</span>
                  ) : (
                    `$${net.toFixed(2)}`
                  )}
                </td>
                <td className="py-3 px-3">{underwater ? '—' : `${(effRate * 100).toFixed(0)}%`}</td>
                <td className="py-3 px-3 font-bold">{underwater ? formatILS(0) : formatILS(totalNet)}</td>
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
