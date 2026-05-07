import { formatNumber } from '../lib/format';

interface Props {
  value: number;
  onChange: (v: number) => void;
  marginalRate: number;
}

export default function SalaryInput({ value, onChange, marginalRate }: Props) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
        שכר שנתי ברוטו (₪)
      </label>
      <input
        type="number"
        min={0}
        step={10000}
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder="לדוגמה: 600,000"
        className="w-full px-4 py-2.5 rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      />
      {value > 0 && (
        <p className="text-xs text-surface-500 dark:text-surface-400">
          שיעור מס שולי משוקלל: <span className="font-semibold text-primary-600 dark:text-primary-400">
            {(marginalRate * 100).toFixed(0)}%
          </span>
          {' · '}
          שכר חודשי: ~{formatNumber(Math.round(value / 12))} ₪
        </p>
      )}
    </div>
  );
}
