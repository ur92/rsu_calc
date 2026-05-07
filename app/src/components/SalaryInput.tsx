interface Props {
  value: number;
  onChange: (v: number) => void;
  marginalRate: number;
}

export default function SalaryInput({ value, onChange, marginalRate }: Props) {
  const valueK = value / 1000;

  return (
    <div className="space-y-2">
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
      {value > 0 && (
        <p className="text-xs text-surface-500 dark:text-surface-400">
          שיעור מס שולי משוקלל: <span className="font-semibold text-primary-600 dark:text-primary-400">
            {(marginalRate * 100).toFixed(0)}%
          </span>
          {' · '}
          שכר חודשי: ~{Math.round(value / 12 / 1000)} אש״ח
        </p>
      )}
    </div>
  );
}
