import { differenceInMonths } from 'date-fns';

/**
 * Israeli combined marginal tax rate (income tax + Bituach Leumi + Mas Briut + surtax).
 * Approximations used as defaults; individual situations vary.
 */
export function marginalRate(annualSalaryNIS: number): number {
  if (annualSalaryNIS < 350_000) return 0.40;
  if (annualSalaryNIS < 700_000) return 0.41;
  return 0.53;
}

/** Section 102 capital track requires 24+ months from grant date to current date. */
export function isCapitalTrack(grantDate: Date): boolean {
  return differenceInMonths(new Date(), grantDate) >= 24;
}

/** Capital gains rate (including 3% surtax) on stock proceeds. */
export const CAPITAL_GAINS_RATE = 0.28;

/**
 * Net per share for an RSU grant.
 * Capital track: FMV at grant taxed as employment income (marginal),
 * appreciation taxed as capital gains.
 * Ordinary track: full sale price taxed as employment income.
 */
export function rsuNetPerShare(
  fmvAtGrant: number,
  salePrice: number,
  rate: number,
  capitalTrack: boolean,
): number {
  if (capitalTrack) {
    const empTax = fmvAtGrant * rate;
    const cgTax = Math.max(0, salePrice - fmvAtGrant) * CAPITAL_GAINS_RATE;
    return Math.max(0, salePrice - empTax - cgTax);
  }
  return salePrice * (1 - rate);
}

export function rsuEffectiveTaxRate(
  fmvAtGrant: number,
  salePrice: number,
  rate: number,
  capitalTrack: boolean,
): number {
  if (salePrice <= 0) return 0;
  const net = rsuNetPerShare(fmvAtGrant, salePrice, rate, capitalTrack);
  return 1 - net / salePrice;
}

/**
 * Net per share for an NQ option (assumes pre-IPO grant where strike ≈ FMV at grant,
 * so employment-income component is ~0 and entire spread is capital gain).
 */
export function optionNetPerShare(strike: number, salePrice: number): number {
  if (salePrice <= strike) return 0;
  return (salePrice - strike) * (1 - CAPITAL_GAINS_RATE);
}

export function optionEffectiveTaxRate(strike: number, salePrice: number): number {
  if (salePrice <= 0) return 0;
  if (salePrice <= strike) return 1;
  const net = optionNetPerShare(strike, salePrice);
  return 1 - net / salePrice;
}

/**
 * Net per share for ESPP.
 * Discount portion (purchaseDateFmv − purchasePrice) always taxed at marginal rate.
 * Appreciation above purchaseDateFmv: capital gains (28%) if capital track (24+ months
 * from grant date), otherwise marginal rate.
 */
export function esppNetPerShare(
  purchasePrice: number,
  purchaseDateFmv: number,
  salePrice: number,
  marginalRate: number,
  capitalTrack: boolean,
): number {
  const discount = Math.max(0, purchaseDateFmv - purchasePrice);
  const appreciation = Math.max(0, salePrice - purchaseDateFmv);
  const appreciationTax = capitalTrack ? CAPITAL_GAINS_RATE : marginalRate;
  return Math.max(0, salePrice - discount * marginalRate - appreciation * appreciationTax);
}

export function esppEffectiveTaxRate(
  purchasePrice: number,
  purchaseDateFmv: number,
  salePrice: number,
  marginalRate: number,
  capitalTrack: boolean,
): number {
  if (salePrice <= 0) return 0;
  const net = esppNetPerShare(purchasePrice, purchaseDateFmv, salePrice, marginalRate, capitalTrack);
  return 1 - net / salePrice;
}
