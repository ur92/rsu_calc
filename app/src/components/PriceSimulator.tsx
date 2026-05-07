interface Props {
  priceUSD: number;
  onPriceChange: (v: number) => void;
  rate: number;
  onRateChange: (v: number) => void;
  isLive?: boolean;
  isLoading?: boolean;
}

export default function PriceSimulator({
  priceUSD, onPriceChange, rate, onRateChange, isLive, isLoading,
}: Props) {
  return (
    <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5 space-y-5">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-surface-800 dark:text-surface-200">סימולטור מחיר ושער</h3>
        {isLoading && <span className="text-xs text-surface-400">טוען מחיר חי...</span>}
        {!isLoading && isLive && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
            מחיר חי
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label className="text-sm text-surface-600 dark:text-surface-400">מחיר FROG</label>
            <span className="font-bold text-lg">${priceUSD.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={20}
            max={150}
            step={0.5}
            value={Math.min(150, Math.max(20, priceUSD))}
            onChange={(e) => onPriceChange(Number(e.target.value))}
            className="w-full accent-primary-500"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              step={0.5}
              value={priceUSD}
              onChange={(e) => { const v = Number(e.target.value); if (v > 0) onPriceChange(v); }}
              className="w-24 px-2 py-1 text-sm rounded border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900"
            />
            <span className="text-xs text-surface-500">USD</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label className="text-sm text-surface-600 dark:text-surface-400">שער ₪/$</label>
            <span className="font-bold text-lg">{rate.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={3.0}
            max={4.5}
            step={0.01}
            value={Math.min(4.5, Math.max(3.0, rate))}
            onChange={(e) => onRateChange(Number(e.target.value))}
            className="w-full accent-primary-500"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0.1}
              step={0.01}
              value={rate}
              onChange={(e) => { const v = Number(e.target.value); if (v > 0) onRateChange(v); }}
              className="w-24 px-2 py-1 text-sm rounded border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900"
            />
            <span className="text-xs text-surface-500">₪ ל-$1</span>
          </div>
        </div>
      </div>

      <div className="text-sm text-surface-500 dark:text-surface-400 pt-2 border-t border-surface-100 dark:border-surface-800">
        מחיר מניה בשקלים: <span className="font-semibold text-surface-800 dark:text-surface-200">
          ₪{(priceUSD * rate).toFixed(2)}
        </span>
      </div>
    </div>
  );
}
