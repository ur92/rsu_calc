import type { EsppPurchase } from '../lib/types';
import { esppNetPerShare, esppEffectiveTaxRate } from '../lib/taxCalc';
import { formatILS, formatNumber } from '../lib/format';

interface Props {
  espp: EsppPurchase[];
  priceUSD: number;
  rate: number;
  marginalRate: number;
}

export default function EsppTable({ espp, priceUSD, rate, marginalRate }: Props) {
  const sorted = [...espp].sort((a, b) => a.purchaseDate.getTime() - b.purchaseDate.getTime());

  if (sorted.length === 0) {
    return <p className="text-sm text-surface-500">לא נמצאו רכישות ESPP בקובץ.</p>;
  }

  return (
    <div className="overflow-x-auto scrollbar-thin rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900">
      <table className="w-full text-sm">
        <thead className="bg-surface-50 dark:bg-surface-800/50">
          <tr>
            <Th>תאריך רכישה</Th>
            <Th>מניות</Th>
            <Th>Blocked</Th>
            <Th>מחיר רכישה ($)</Th>
            <Th>FMV ביום רכישה ($)</Th>
            <Th>הנחה</Th>
            <Th>נטו/מניה ($)</Th>
            <Th>מס אפקטיבי</Th>
            <Th>שווי Blocked נטו (₪)</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
          {sorted.map((e, i) => {
            const net = esppNetPerShare(e.purchasePrice, e.purchaseDateFmv, priceUSD, marginalRate);
            const effRate = esppEffectiveTaxRate(e.purchasePrice, e.purchaseDateFmv, priceUSD, marginalRate);
            const totalNet = e.blockedQty * net * rate;
            return (
              <tr key={i} className="hover:bg-surface-50 dark:hover:bg-surface-800/30">
                <td className="py-3 px-3">{e.purchaseDate.toLocaleDateString('he-IL')}</td>
                <td className="py-3 px-3">{formatNumber(e.purchasedQty)}</td>
                <td className="py-3 px-3 font-medium">{formatNumber(e.blockedQty)}</td>
                <td className="py-3 px-3 font-mono">${e.purchasePrice.toFixed(2)}</td>
                <td className="py-3 px-3 font-mono">${e.purchaseDateFmv.toFixed(2)}</td>
                <td className="py-3 px-3">{(e.discountPct * 100).toFixed(0)}%</td>
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
