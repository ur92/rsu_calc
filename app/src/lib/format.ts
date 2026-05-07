import type { ValueType } from 'recharts/types/component/DefaultTooltipContent';

const ilsFormatter = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });
const numberFormatter = new Intl.NumberFormat('he-IL');
const pctFormatter = new Intl.NumberFormat('he-IL', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatILS(value: number): string {
  return ilsFormatter.format(value);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatPct(value: number): string {
  return pctFormatter.format(value);
}

export function formatCompactILS(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M ₪`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K ₪`;
  }
  return `${value} ₪`;
}

export function tooltipILS(v: ValueType | undefined): string {
  return formatILS(Number(v ?? 0));
}

export function formatDateHe(d: Date): string {
  return d.toLocaleDateString('he-IL', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatMonthYearHe(d: Date): string {
  return d.toLocaleDateString('he-IL', { year: 'numeric', month: 'short' });
}
