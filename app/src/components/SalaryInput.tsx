import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  value: number;
  onChange: (v: number) => void;
  marginalRate: number;
  otherCapitalIncomeNIS: number;
  onOtherCapitalIncomeChange: (v: number) => void;
  /** When true the card is rendered inline (no collapsible wrapper) — used on the landing page */
  inline?: boolean;
}

export default function SalaryInput({
  value, onChange, marginalRate,
  otherCapitalIncomeNIS, onOtherCapitalIncomeChange,
  inline = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const valueK = value / 1000;
  const otherK = otherCapitalIncomeNIS / 1000;

  const summaryLine = value > 0
    ? `שכר ${valueK.toLocaleString('he-IL')} אש״ח · מס שולי ${(marginalRate * 100).toFixed(0)}%${otherCapitalIncomeNIS > 0 ? ` · הוני אחר ${otherK.toLocaleString('he-IL')} אש״ח` : ''}`
    : 'לא הוגדר שכר';

  const fields = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
          שכר שנתי ברוטו
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step={100}
            value={valueK || ''}
            onChange={(e) => onChange(Number(e.target.value) * 1000)}
            placeholder="300"
            className="w-full px-4 py-2.5 rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <span className="text-sm font-medium text-surface-600 dark:text-surface-400 shrink-0">אש״ח</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
          הכנסה הונית אחרת (שנתית)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step={1}
            value={otherK || ''}
            onChange={(e) => onOtherCapitalIncomeChange(Math.max(0, Number(e.target.value) * 1000))}
            placeholder="0"
            className="w-full px-4 py-2.5 rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <span className="text-sm font-medium text-surface-600 dark:text-surface-400 shrink-0">אש״ח</span>
        </div>
        <p className="text-[11px] text-surface-500 dark:text-surface-400 leading-relaxed">
          דיבידנד, ריבית, שכ״ד וכד׳ — לצורך חישוב מס יסף 2%
        </p>
      </div>

      {value > 0 && (
        <p className="text-xs text-surface-500 dark:text-surface-400">
          שיעור מס שולי משוקלל:{' '}
          <span className="font-semibold text-primary-600 dark:text-primary-400">
            {(marginalRate * 100).toFixed(0)}%
          </span>
          {' · '}
          שכר חודשי: ~{Math.round(value / 12 / 1000)} אש״ח
        </p>
      )}
    </div>
  );

  // On the landing page render fields directly (no card wrapper)
  if (inline) return fields;

  return (
    <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 overflow-hidden">
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-3.5 text-right hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <span className="text-sm font-semibold text-surface-700 dark:text-surface-200 shrink-0">
            שכר ומקורות הכנסה
          </span>
          <span className="text-surface-300 dark:text-surface-600 text-xs shrink-0">·</span>
          <span className="text-sm text-surface-500 dark:text-surface-400 truncate">{summaryLine}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-surface-400 dark:text-surface-500">{open ? 'סגור' : 'ערוך'}</span>
          <ChevronDown
            size={16}
            className={`text-surface-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Expandable fields */}
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-surface-100 dark:border-surface-800">
          {fields}
        </div>
      )}
    </div>
  );
}
