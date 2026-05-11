/**
 * Israeli equity-compensation tax math. Mirrors `tax_calc.py` in
 * `.cursor/skills/jfrog-equity-analyzer/`. Constants and rules updated for
 * 2026 tax year — change one place, change both.
 */

export const SURTAX_THRESHOLD_NIS = 721_560;
export const CAPITAL_GAINS_RATE_BASE = 0.25;
export const CAPITAL_GAINS_RATE_HIGH = 0.30;

// Bituach Leumi + Mas Briut (employee share) — 2026 rates
export const BL_REDUCED_CEILING = 7_703;
export const BL_MONTHLY_CEILING = 51_910;
export const BL_HEALTH_REDUCED_TOTAL = 0.0427; // BL 1.04% + health 3.23%
export const BL_HEALTH_FULL_TOTAL = 0.1217;    // BL 7.00% + health 5.17%

/**
 * Combined BL + health tax on a single month's income (employee share, 2026).
 *
 * Reduced rates (4.27%) apply to the first 7,703 ₪, full rates (12.17%)
 * from 7,703 ₪ up to the monthly ceiling of 51,910 ₪. No contribution above
 * the ceiling.
 */
export function bituachLeumiEmployee(monthlyIncomeNIS: number): number {
  if (monthlyIncomeNIS <= 0) return 0;
  const reduced = Math.min(monthlyIncomeNIS, BL_REDUCED_CEILING);
  const aboveReduced = Math.max(
    0,
    Math.min(monthlyIncomeNIS, BL_MONTHLY_CEILING) - BL_REDUCED_CEILING,
  );
  return reduced * BL_HEALTH_REDUCED_TOTAL + aboveReduced * BL_HEALTH_FULL_TOTAL;
}

// 2026 piecewise income-tax brackets (income tax only, before BL/health)
const INCOME_TAX_BRACKETS_2026: Array<[number, number]> = [
  [84_120, 0.10],
  [120_720, 0.14],
  [228_000, 0.20],
  [301_200, 0.31],
  [560_280, 0.35],
  [721_560, 0.47],
  [Infinity, 0.50], // 47% + 3% yasaf at the top
];

/**
 * Marginal income-tax rate (NOT including BL/health) at a given annual gross.
 * Returns the rate of the bracket in which the last NIS of income falls.
 */
export function incomeTaxMarginalRate(annualSalaryNIS: number): number {
  for (const [top, rate] of INCOME_TAX_BRACKETS_2026) {
    if (annualSalaryNIS <= top) return rate;
  }
  return 0.50;
}

/**
 * Combined marginal rate for פירותי (ordinary-income) equity: income tax +
 * BL/health applicable to equity income.
 *
 * BL/health ceiling rule: if the employee's regular monthly salary
 * (annualSalaryNIS / 12) already equals or exceeds the monthly ceiling
 * (51,910 ₪ in 2026), the RSU/option/ESPP ordinary-income portion carries
 * zero additional BL/health. Only income tax applies.
 *
 * For salaries below the ceiling, BL/health at the full rate (12.17%) is
 * added — all JFrog employees earn well above the reduced-rate threshold
 * (7,703 ₪/month) so only the full rate is relevant.
 */
export function marginalRate(annualSalaryNIS: number): number {
  const itRate = incomeTaxMarginalRate(annualSalaryNIS);
  const monthlySalary = annualSalaryNIS / 12;
  const blRate = monthlySalary >= BL_MONTHLY_CEILING ? 0 : BL_HEALTH_FULL_TOTAL;
  return itRate + blRate;
}

/**
 * Effective capital-gains rate for a Section 102 honi sale.
 * 25% by default, 30% only for controlling shareholders (10%+ holdings, ever).
 * Portfolio-level מס יסף (3% + 2% since 2025) is computed separately via `computeSurtax`.
 */
export function capitalGainsRate(
  _annualSalaryNIS: number,
  controllingShareholder = false,
): number {
  if (controllingShareholder) return CAPITAL_GAINS_RATE_HIGH;
  return CAPITAL_GAINS_RATE_BASE;
}

/** Inputs for portfolio-level יסף per section 121ב (הוראת ביצוע 5/2025). */
export interface SurtaxInput {
  salaryNIS: number;
  /** Gross taxable proceeds from simulated JFrog sales — all tracks (employment + capital), NIS. */
  jfrogSaleTotalIncomeNIS: number;
  /** Capital-source gross from JFrog sales only (capital-track 102 הוני RSU, options spread, ESPP הוני), NIS. */
  jfrogSaleCapitalSourceNIS: number;
  otherCapitalIncomeNIS?: number;
}

export interface SurtaxResult {
  totalIncomeNIS: number;
  capitalIncomeTotalNIS: number;
  yasaf3NIS: number;
  yasaf2NIS: number;
  totalNIS: number;
}

const SURTAX_GENERAL_RATE = 0.03;
const SURTAX_CAPITAL_EXTRA_RATE = 0.02;

export function computeSurtax(input: SurtaxInput): SurtaxResult {
  const other = input.otherCapitalIncomeNIS ?? 0;
  const totalIncomeNIS = input.salaryNIS + input.jfrogSaleTotalIncomeNIS + other;
  const capitalIncomeTotalNIS = input.jfrogSaleCapitalSourceNIS + other;
  const yasaf3NIS = SURTAX_GENERAL_RATE * Math.max(0, totalIncomeNIS - SURTAX_THRESHOLD_NIS);
  const yasaf2NIS = SURTAX_CAPITAL_EXTRA_RATE * Math.max(0, capitalIncomeTotalNIS - SURTAX_THRESHOLD_NIS);
  const totalNIS = yasaf3NIS + yasaf2NIS;
  return { totalIncomeNIS, capitalIncomeTotalNIS, yasaf3NIS, yasaf2NIS, totalNIS };
}

/** Per-lot gross buckets for יסף: total (3% base) vs capital-source (2% base, ex salary). */
export interface LotIncomeBreakdown {
  totalIncomeNIS: number;
  capitalIncomeNIS: number;
}

export function rsuLotIncome(
  _fmvAtGrant: number,
  salePrice: number,
  qty: number,
  fx: number,
  capitalTrack: boolean,
): LotIncomeBreakdown {
  const totalIncomeNIS = salePrice * qty * fx;
  return {
    totalIncomeNIS,
    capitalIncomeNIS: capitalTrack ? totalIncomeNIS : 0,
  };
}

export function optionLotIncome(
  strike: number,
  salePrice: number,
  qty: number,
  fx: number,
): LotIncomeBreakdown {
  const spread = Math.max(0, salePrice - strike);
  const v = spread * qty * fx;
  return { totalIncomeNIS: v, capitalIncomeNIS: v };
}

export function esppLotIncome(
  _purchaseDateFmv: number,
  salePrice: number,
  qty: number,
  fx: number,
  capitalTrack: boolean,
): LotIncomeBreakdown {
  const totalIncomeNIS = salePrice * qty * fx;
  return {
    totalIncomeNIS,
    capitalIncomeNIS: capitalTrack ? totalIncomeNIS : 0,
  };
}

/**
 * Section 102 capital track requires 24 months from the END OF THE TAX YEAR
 * of grant — not 24 calendar months from the grant date. A grant on
 * 2024-03-15 qualifies for capital treatment from 2026-12-31.
 */
export function isCapitalTrack(grantDate: Date, today: Date = new Date()): boolean {
  const qualifying = new Date(grantDate.getFullYear() + 2, 11, 31);
  return today.getTime() >= qualifying.getTime();
}

/**
 * Net per share for an RSU grant.
 *
 * Capital track + price ≥ FMV-at-grant: FMV portion taxed at marginal,
 * appreciation taxed at the capital-gains rate.
 *
 * Capital track + price < FMV-at-grant (sell-below-FMV cap): all proceeds
 * taxed at marginal, capital component clamps to zero — no synthetic
 * capital loss is recognized inside Section 102.
 *
 * Ordinary track: full sale price taxed at marginal.
 */
export function rsuNetPerShare(
  fmvAtGrant: number,
  salePrice: number,
  rate: number,
  cgRate: number,
  capitalTrack: boolean,
): number {
  if (!capitalTrack) return salePrice * (1 - rate);
  if (salePrice < fmvAtGrant) return salePrice * (1 - rate);
  const empTax = fmvAtGrant * rate;
  const cgTax = (salePrice - fmvAtGrant) * cgRate;
  return Math.max(0, salePrice - empTax - cgTax);
}

export function rsuEffectiveTaxRate(
  fmvAtGrant: number,
  salePrice: number,
  rate: number,
  cgRate: number,
  capitalTrack: boolean,
): number {
  if (salePrice <= 0) return 0;
  const net = rsuNetPerShare(fmvAtGrant, salePrice, rate, cgRate, capitalTrack);
  return 1 - net / salePrice;
}

/**
 * Net per share for an NQ option (assumes pre-IPO grant where strike ≈ FMV at
 * grant, so the employment-income component is ~0 and the entire spread is
 * capital gain).
 */
export function optionNetPerShare(strike: number, salePrice: number, cgRate: number): number {
  if (salePrice <= strike) return 0;
  return (salePrice - strike) * (1 - cgRate);
}

export function optionEffectiveTaxRate(strike: number, salePrice: number, cgRate: number): number {
  const spread = salePrice - strike;
  if (spread <= 0) return 0;
  // Tax is cgRate% of the spread only — the strike is the cost basis paid out-of-pocket.
  // Effective rate is always cgRate relative to the gross profit (spread).
  return cgRate;
}

/**
 * Net per share for ESPP.
 *
 * Sale ≥ purchase-date FMV: discount portion taxed at marginal, appreciation
 * above purchase-date FMV at the capital-gains rate (capital track) or
 * marginal (ordinary track).
 *
 * Sale < purchase-date FMV (sell-below-FMV cap): the discount-as-marginal
 * portion is the actual realized gain max(0, sale − purchase_price), not the
 * theoretical 15% discount. Capital component clamps to zero.
 */
export function esppNetPerShare(
  purchasePrice: number,
  purchaseDateFmv: number,
  salePrice: number,
  marginal: number,
  cgRate: number,
  capitalTrack: boolean,
): number {
  if (salePrice < purchaseDateFmv) {
    const discount = Math.max(0, salePrice - purchasePrice);
    return Math.max(0, salePrice - discount * marginal);
  }
  const discount = Math.max(0, purchaseDateFmv - purchasePrice);
  const appreciation = salePrice - purchaseDateFmv;
  const appreciationRate = capitalTrack ? cgRate : marginal;
  return Math.max(0, salePrice - discount * marginal - appreciation * appreciationRate);
}

export function esppEffectiveTaxRate(
  purchasePrice: number,
  purchaseDateFmv: number,
  salePrice: number,
  marginal: number,
  cgRate: number,
  capitalTrack: boolean,
): number {
  if (salePrice <= 0) return 0;
  const net = esppNetPerShare(purchasePrice, purchaseDateFmv, salePrice, marginal, cgRate, capitalTrack);
  return 1 - net / salePrice;
}

export interface TaxBreakdown {
  title: string;
  lines: string[];
  note?: string;
  /** Marginal portfolio יסף attributable to this lot, if shown in the tooltip. */
  surtaxLine?: string;
}

const fmtILS0 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
const fmtILS2 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 });
const fmtUSD = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function pct(r: number): string {
  return `${(r * 100).toFixed(0)}%`;
}

export function rsuTaxBreakdown(
  fmvAtGrant: number,
  salePrice: number,
  rate: number,
  cgRate: number,
  capitalTrack: boolean,
  qty: number,
  fx: number,
): TaxBreakdown {
  const lines: string[] = [];
  if (capitalTrack && salePrice >= fmvAtGrant) {
    const empPerShareNIS = fmvAtGrant * rate * fx;
    const apprPerShareNIS = (salePrice - fmvAtGrant) * cgRate * fx;
    const totalEmp = empPerShareNIS * qty;
    const totalAppr = apprPerShareNIS * qty;
    lines.push(`חלק פירותי: $${fmtUSD.format(fmvAtGrant)} × ${pct(rate)} = ${fmtILS2.format(empPerShareNIS)} ₪/מניה`);
    lines.push(`רווח הון: $${fmtUSD.format(salePrice - fmvAtGrant)} × ${pct(cgRate)} = ${fmtILS2.format(apprPerShareNIS)} ₪/מניה`);
    lines.push(`סה"כ × ${fmtILS0.format(qty)} מניות = ${fmtILS0.format(totalEmp + totalAppr)} ₪`);
    return {
      title: 'חישוב מס — RSU מסלול הוני',
      lines,
      note: `חלק ה-FMV-במענק כהכנסה פירותית; העלייה מעל זה כרווח הון ${pct(cgRate)}.`,
    };
  }
  if (capitalTrack && salePrice < fmvAtGrant) {
    const taxPerShareNIS = salePrice * rate * fx;
    lines.push(`כל המכירה במס שולי: $${fmtUSD.format(salePrice)} × ${pct(rate)} = ${fmtILS2.format(taxPerShareNIS)} ₪/מניה`);
    lines.push(`סה"כ × ${fmtILS0.format(qty)} = ${fmtILS0.format(taxPerShareNIS * qty)} ₪`);
    return {
      title: 'חישוב מס — RSU מסלול הוני (price < FMV)',
      lines,
      note: 'מחיר המכירה נמוך מה-FMV במענק → אין רווח הון להכיר; כל הסכום פירותי.',
    };
  }
  const taxPerShareNIS = salePrice * rate * fx;
  lines.push(`כל המכירה במס שולי: $${fmtUSD.format(salePrice)} × ${pct(rate)} = ${fmtILS2.format(taxPerShareNIS)} ₪/מניה`);
  lines.push(`סה"כ × ${fmtILS0.format(qty)} = ${fmtILS0.format(taxPerShareNIS * qty)} ₪`);
  return {
    title: 'חישוב מס — RSU מסלול רגיל',
    lines,
    note: 'פחות מ-24 חודשים מתום שנת המס של ההענקה → אין מסלול הוני, הכל פירותי.',
  };
}

export function optionTaxBreakdown(
  strike: number,
  salePrice: number,
  cgRate: number,
  qty: number,
  fx: number,
): TaxBreakdown {
  const spread = Math.max(0, salePrice - strike);
  const taxPerShareNIS = spread * cgRate * fx;
  return {
    title: 'חישוב מס — אופציות NQ',
    lines: [
      `Spread: $${fmtUSD.format(salePrice)} − $${fmtUSD.format(strike)} = $${fmtUSD.format(spread)}`,
      `מס רווח הון: $${fmtUSD.format(spread)} × ${pct(cgRate)} = ${fmtILS2.format(taxPerShareNIS)} ₪/מניה`,
      `סה"כ × ${fmtILS0.format(qty)} = ${fmtILS0.format(taxPerShareNIS * qty)} ₪`,
    ],
    note: `לפני הנפקה: strike ≈ FMV במענק, ולכן רוב/כל הספרד נחשב רווח הון ${pct(cgRate)}.`,
  };
}

export function esppTaxBreakdown(
  purchasePrice: number,
  purchaseDateFmv: number,
  salePrice: number,
  marginalRateValue: number,
  cgRate: number,
  capitalTrack: boolean,
  qty: number,
  fx: number,
): TaxBreakdown {
  if (salePrice < purchaseDateFmv) {
    const discount = Math.max(0, salePrice - purchasePrice);
    const taxPerShareNIS = discount * marginalRateValue * fx;
    return {
      title: 'חישוב מס — ESPP (price < FMV)',
      lines: [
        `הרווח בפועל: $${fmtUSD.format(salePrice)} − $${fmtUSD.format(purchasePrice)} = $${fmtUSD.format(discount)}`,
        `מס שולי על ההפרש: × ${pct(marginalRateValue)} = ${fmtILS2.format(taxPerShareNIS)} ₪/מניה`,
        `סה"כ × ${fmtILS0.format(qty)} = ${fmtILS0.format(taxPerShareNIS * qty)} ₪`,
      ],
      note: 'מחיר המכירה נמוך מה-FMV ברכישה → ההכנסה הפירותית מוגבלת לרווח בפועל, אין רווח הון.',
    };
  }
  const discount = Math.max(0, purchaseDateFmv - purchasePrice);
  const appreciation = Math.max(0, salePrice - purchaseDateFmv);
  const apprRate = capitalTrack ? cgRate : marginalRateValue;
  const discountTaxNIS = discount * marginalRateValue * fx;
  const apprTaxNIS = appreciation * apprRate * fx;
  const total = (discountTaxNIS + apprTaxNIS) * qty;
  const lines = [
    `הנחה: $${fmtUSD.format(discount)} × ${pct(marginalRateValue)} = ${fmtILS2.format(discountTaxNIS)} ₪/מניה`,
    `עליית ערך: $${fmtUSD.format(appreciation)} × ${pct(apprRate)}${capitalTrack ? ' (הון)' : ' (שולי)'} = ${fmtILS2.format(apprTaxNIS)} ₪/מניה`,
    `סה"כ × ${fmtILS0.format(qty)} = ${fmtILS0.format(total)} ₪`,
  ];
  return {
    title: capitalTrack ? 'חישוב מס — ESPP מסלול הוני' : 'חישוב מס — ESPP מסלול רגיל',
    lines,
    note: 'השיעור האפקטיבי המוצג מחושב יחסית לברוטו המכירה (כולל ה-cost basis). השיעור על הרווח עצמו קרוב לשיעור השולי.',
  };
}
