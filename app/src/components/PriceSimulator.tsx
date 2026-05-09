import { useEffect, useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';

interface Props {
  priceUSD: number;
  onPriceChange: (v: number) => void;
  onResetPrice?: () => void;
  rate: number;
  onRateChange: (v: number) => void;
  onResetRate?: () => void;
  isLive?: boolean;
  isLoading?: boolean;
  isRateLive?: boolean;
  isRateLoading?: boolean;
}

function LiveDot({ loading, live }: { loading?: boolean; live?: boolean }) {
  if (loading) return <span className="text-xs text-surface-400">טוען...</span>;
  if (live) return <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />;
  return <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" title="ידני" />;
}

export default function PriceSimulator({
  priceUSD, onPriceChange, onResetPrice,
  rate, onRateChange, onResetRate,
  isLive, isLoading, isRateLive, isRateLoading,
}: Props) {
  const [open, setOpen] = useState(false);

  // Local draft state — updates instantly for smooth slider visuals.
  // Parent (and all downstream calculations) only update on pointer-up or blur.
  const [draftPrice, setDraftPrice] = useState(priceUSD);
  const [draftRate, setDraftRate] = useState(rate);

  // Sync draft when parent changes (e.g. live price arrives, or reset to live)
  useEffect(() => { setDraftPrice(priceUSD); }, [priceUSD]);
  useEffect(() => { setDraftRate(rate); }, [rate]);

  const priceILS = (priceUSD * rate).toFixed(2);
  const priceOverridden = !isLive && !isLoading;
  const rateOverridden = !isRateLive && !isRateLoading;

  return (
    <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 overflow-hidden">
      {/* Header — always visible, click to toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-3.5 text-right hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-wrap">
          {/* Price pill */}
          <span className="flex items-center gap-1.5 text-sm font-semibold text-surface-800 dark:text-surface-100">
            <LiveDot loading={isLoading} live={isLive} />
            FROG&nbsp;
            <span className="text-primary-600 dark:text-primary-400">${priceUSD.toFixed(2)}</span>
          </span>
          <span className="text-surface-300 dark:text-surface-600 text-xs">·</span>
          {/* Rate pill */}
          <span className="flex items-center gap-1.5 text-sm font-semibold text-surface-800 dark:text-surface-100">
            <LiveDot loading={isRateLoading} live={isRateLive} />
            <span className="text-primary-600 dark:text-primary-400">₪{rate.toFixed(3)}</span>
            <span className="text-xs font-normal text-surface-500">/$</span>
          </span>
          <span className="text-surface-300 dark:text-surface-600 text-xs">·</span>
          {/* ILS price */}
          <span className="text-sm text-surface-500 dark:text-surface-400">
            מחיר מניה:&nbsp;
            <span className="font-semibold text-surface-700 dark:text-surface-200">₪{priceILS}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-surface-400 dark:text-surface-500">{open ? 'סגור' : 'ערוך'}</span>
          <ChevronDown
            size={16}
            className={`text-surface-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Expandable simulator */}
      {open && (
        <div className="px-5 pb-5 pt-1 space-y-5 border-t border-surface-100 dark:border-surface-800">
          <div className="grid md:grid-cols-2 gap-5">
            {/* Price column */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-surface-600 dark:text-surface-400">מחיר FROG</label>
                <div className="flex items-center gap-2">
                  {priceOverridden && onResetPrice && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onResetPrice(); }}
                      className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                      title="חזור למחיר חי"
                    >
                      <RefreshCw size={11} />
                      חזור לחי
                    </button>
                  )}
                  <span className="font-bold text-lg">${priceUSD.toFixed(2)}</span>
                </div>
              </div>
              <input
                type="range"
                min={20}
                max={150}
                step={0.5}
                value={Math.min(150, Math.max(20, draftPrice))}
                onChange={(e) => setDraftPrice(Number(e.target.value))}
                onPointerUp={(e) => onPriceChange(Number((e.target as HTMLInputElement).value))}
                className="w-full accent-primary-500"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  step={0.5}
                  value={draftPrice}
                  onChange={(e) => { const v = Number(e.target.value); if (v > 0) setDraftPrice(v); }}
                  onBlur={() => { if (draftPrice > 0) onPriceChange(draftPrice); }}
                  className="w-24 px-2 py-1 text-sm rounded border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900"
                />
                <span className="text-xs text-surface-500">USD</span>
              </div>
            </div>

            {/* Rate column */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-surface-600 dark:text-surface-400">שער ₪/$</label>
                <div className="flex items-center gap-2">
                  {rateOverridden && onResetRate && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onResetRate(); }}
                      className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                      title="חזור לשער חי"
                    >
                      <RefreshCw size={11} />
                      חזור לחי
                    </button>
                  )}
                  <span className="font-bold text-lg">{rate.toFixed(3)}</span>
                </div>
              </div>
              <input
                type="range"
                min={2.5}
                max={4.0}
                step={0.01}
                value={Math.min(4.0, Math.max(2.5, draftRate))}
                onChange={(e) => setDraftRate(Number(e.target.value))}
                onPointerUp={(e) => onRateChange(Number((e.target as HTMLInputElement).value))}
                className="w-full accent-primary-500"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0.1}
                  step={0.001}
                  value={draftRate}
                  onChange={(e) => { const v = Number(e.target.value); if (v > 0) setDraftRate(v); }}
                  onBlur={() => { if (draftRate > 0) onRateChange(draftRate); }}
                  className="w-24 px-2 py-1 text-sm rounded border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900"
                />
                <span className="text-xs text-surface-500">₪ ל-$1</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
