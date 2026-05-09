import { CircleHelp } from 'lucide-react';
import type { TaxBreakdown } from '../lib/taxCalc';

interface Props {
  breakdown: TaxBreakdown;
}

export default function TaxBreakdownTooltip({ breakdown }: Props) {
  return (
    <span className="relative inline-flex align-middle group/tt">
      <button
        type="button"
        aria-label="פירוט החישוב"
        className="inline-flex w-4 h-4 items-center justify-center rounded-full text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        onClick={(e) => e.preventDefault()}
      >
        <CircleHelp className="w-3.5 h-3.5" />
      </button>
      <span
        role="tooltip"
        className="invisible opacity-0 group-hover/tt:visible group-hover/tt:opacity-100 group-focus-within/tt:visible group-focus-within/tt:opacity-100 transition-opacity duration-150 absolute z-30 left-0 top-full mt-1 w-72 max-w-[calc(100vw-2rem)] p-3 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 shadow-xl text-right pointer-events-none"
      >
        <span className="block text-xs font-semibold text-surface-800 dark:text-surface-100 mb-1.5">
          {breakdown.title}
        </span>
        {breakdown.lines.map((line, i) => (
          <span
            key={i}
            className="block text-[11px] leading-5 text-surface-600 dark:text-surface-300 font-mono"
          >
            {line}
          </span>
        ))}
        {breakdown.note ? (
          <span className="block mt-2 pt-2 border-t border-surface-200 dark:border-surface-700 text-[10px] leading-4 text-surface-500 dark:text-surface-400 font-normal">
            {breakdown.note}
          </span>
        ) : null}
        {breakdown.surtaxLine ? (
          <span className="block mt-1.5 text-[10px] leading-4 text-amber-700 dark:text-amber-400 font-medium">
            {breakdown.surtaxLine}
          </span>
        ) : null}
      </span>
    </span>
  );
}
