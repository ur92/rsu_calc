import { describe, expect, it } from 'vitest';
import {
  bituachLeumiEmployee,
  capitalGainsRate,
  computeSurtax,
  esppNetPerShare,
  incomeTaxMarginalRate,
  isCapitalTrack,
  marginalRate,
  optionNetPerShare,
  rsuNetPerShare,
  BL_HEALTH_FULL_TOTAL,
  BL_HEALTH_REDUCED_TOTAL,
  BL_MONTHLY_CEILING,
  BL_REDUCED_CEILING,
  CAPITAL_GAINS_RATE_BASE,
  CAPITAL_GAINS_RATE_HIGH,
  SURTAX_THRESHOLD_NIS,
} from '../taxCalc';

describe('bituachLeumiEmployee', () => {
  it('zero income', () => {
    expect(bituachLeumiEmployee(0)).toBe(0);
  });

  it('within reduced band', () => {
    expect(bituachLeumiEmployee(5_000)).toBeCloseTo(5_000 * BL_HEALTH_REDUCED_TOTAL, 4);
  });

  it('full band', () => {
    const expected = BL_REDUCED_CEILING * BL_HEALTH_REDUCED_TOTAL + (30_000 - BL_REDUCED_CEILING) * BL_HEALTH_FULL_TOTAL;
    expect(bituachLeumiEmployee(30_000)).toBeCloseTo(expected, 4);
  });

  it('at ceiling', () => {
    const expected = BL_REDUCED_CEILING * BL_HEALTH_REDUCED_TOTAL + (BL_MONTHLY_CEILING - BL_REDUCED_CEILING) * BL_HEALTH_FULL_TOTAL;
    expect(bituachLeumiEmployee(BL_MONTHLY_CEILING)).toBeCloseTo(expected, 4);
  });

  it('above ceiling (no extra contribution)', () => {
    const atCeiling = bituachLeumiEmployee(BL_MONTHLY_CEILING);
    expect(bituachLeumiEmployee(60_000)).toBeCloseTo(atCeiling, 4);
    expect(bituachLeumiEmployee(100_000)).toBeCloseTo(atCeiling, 4);
  });
});

describe('incomeTaxMarginalRate', () => {
  it('returns the rate of the bracket containing the last NIS (piecewise tops)', () => {
    expect(incomeTaxMarginalRate(84120)).toBe(0.1);
    expect(incomeTaxMarginalRate(84121)).toBe(0.14);
    expect(incomeTaxMarginalRate(120720)).toBe(0.14);
    expect(incomeTaxMarginalRate(120721)).toBe(0.2);
    expect(incomeTaxMarginalRate(228000)).toBe(0.2);
    expect(incomeTaxMarginalRate(228001)).toBe(0.31);
    expect(incomeTaxMarginalRate(301200)).toBe(0.31);
    expect(incomeTaxMarginalRate(301201)).toBe(0.35);
    expect(incomeTaxMarginalRate(560280)).toBe(0.35);
    expect(incomeTaxMarginalRate(560281)).toBe(0.47);
    expect(incomeTaxMarginalRate(721560)).toBe(0.47);
    expect(incomeTaxMarginalRate(721561)).toBe(0.5);
  });
});

describe('marginalRate (BL monthly ceiling rule)', () => {
  it('below BL monthly ceiling adds full BL/health to income tax', () => {
    const annual = 300_000;
    expect(annual / 12).toBeLessThan(BL_MONTHLY_CEILING);
    const it = incomeTaxMarginalRate(annual);
    expect(marginalRate(annual)).toBeCloseTo(it + BL_HEALTH_FULL_TOTAL, 10);
  });

  it('at/above BL monthly ceiling: only income tax, no BL on equity slice', () => {
    const annualAtCeiling = BL_MONTHLY_CEILING * 12;
    expect(marginalRate(annualAtCeiling)).toBe(incomeTaxMarginalRate(annualAtCeiling));
    const annualAbove = 1_000_000;
    expect(annualAbove / 12).toBeGreaterThanOrEqual(BL_MONTHLY_CEILING);
    expect(marginalRate(annualAbove)).toBe(incomeTaxMarginalRate(annualAbove));
  });
});

describe('computeSurtax (הוראת ביצוע 5/2025)', () => {
  it('example 3.1 — below threshold', () => {
    const r = computeSurtax({
      salaryNIS: 400_000,
      jfrogSaleTotalIncomeNIS: 0,
      jfrogSaleCapitalSourceNIS: 0,
      otherCapitalIncomeNIS: 300_000,
    });
    expect(r.totalIncomeNIS).toBeCloseTo(700_000, 4);
    expect(r.capitalIncomeTotalNIS).toBeCloseTo(300_000, 4);
    expect(r.yasaf3NIS).toBeCloseTo(0, 2);
    expect(r.yasaf2NIS).toBeCloseTo(0, 2);
    expect(r.totalNIS).toBeCloseTo(0, 2);
  });

  it('example 3.2 — only general yasaf (3%)', () => {
    const r = computeSurtax({
      salaryNIS: 400_000,
      jfrogSaleTotalIncomeNIS: 0,
      jfrogSaleCapitalSourceNIS: 0,
      otherCapitalIncomeNIS: 700_000,
    });
    expect(r.totalIncomeNIS).toBeCloseTo(1_100_000, 4);
    expect(r.capitalIncomeTotalNIS).toBeCloseTo(700_000, 4);
    const exp3 = 0.03 * (1_100_000 - SURTAX_THRESHOLD_NIS);
    expect(r.yasaf3NIS).toBeCloseTo(exp3, 2);
    expect(r.yasaf3NIS).toBeCloseTo(11_353.2, 2);
    expect(r.yasaf2NIS).toBeCloseTo(0, 2);
    expect(r.totalNIS).toBeCloseTo(11_353.2, 2);
  });

  it('example 3.3 — both yasaf components', () => {
    const r = computeSurtax({
      salaryNIS: 400_000,
      jfrogSaleTotalIncomeNIS: 0,
      jfrogSaleCapitalSourceNIS: 0,
      otherCapitalIncomeNIS: 1_100_000,
    });
    expect(r.totalIncomeNIS).toBeCloseTo(1_500_000, 4);
    expect(r.capitalIncomeTotalNIS).toBeCloseTo(1_100_000, 4);
    const exp3 = 0.03 * (1_500_000 - SURTAX_THRESHOLD_NIS);
    const exp2 = 0.02 * (1_100_000 - SURTAX_THRESHOLD_NIS);
    expect(r.yasaf3NIS).toBeCloseTo(exp3, 2);
    expect(r.yasaf3NIS).toBeCloseTo(23_353.2, 2);
    expect(r.yasaf2NIS).toBeCloseTo(exp2, 2);
    expect(r.yasaf2NIS).toBeCloseTo(7_568.8, 2);
    expect(r.totalNIS).toBeCloseTo(30_922.0, 2);
  });

  it('total income exactly at threshold → no surtax', () => {
    const r = computeSurtax({
      salaryNIS: SURTAX_THRESHOLD_NIS,
      jfrogSaleTotalIncomeNIS: 0,
      jfrogSaleCapitalSourceNIS: 0,
      otherCapitalIncomeNIS: 0,
    });
    expect(r.yasaf3NIS).toBeCloseTo(0, 6);
    expect(r.yasaf2NIS).toBeCloseTo(0, 6);
  });

  it('capital-only exactly at threshold → yasaf2 zero', () => {
    const r = computeSurtax({
      salaryNIS: 0,
      jfrogSaleTotalIncomeNIS: 0,
      jfrogSaleCapitalSourceNIS: 0,
      otherCapitalIncomeNIS: SURTAX_THRESHOLD_NIS,
    });
    expect(r.yasaf2NIS).toBeCloseTo(0, 6);
  });
});

describe('isCapitalTrack', () => {
  const g = new Date(Date.UTC(2024, 2, 15));

  it('just before qualifying date (end of grant year + 2)', () => {
    expect(isCapitalTrack(g, new Date(Date.UTC(2026, 2, 14)))).toBe(false);
  });

  it('calendar 24 months from grant still ordinary', () => {
    expect(isCapitalTrack(g, new Date(Date.UTC(2026, 2, 15)))).toBe(false);
  });

  it('qualifying date inclusive (2026-12-31)', () => {
    expect(isCapitalTrack(g, new Date(Date.UTC(2026, 11, 31)))).toBe(true);
  });

  it('after qualifying date', () => {
    expect(isCapitalTrack(g, new Date(Date.UTC(2027, 0, 1)))).toBe(true);
  });

  it('grant at year-end: qualifying still end of year + 2', () => {
    expect(isCapitalTrack(new Date(Date.UTC(2024, 11, 31)), new Date(Date.UTC(2026, 11, 31)))).toBe(true);
  });
});

describe('rsuNetPerShare', () => {
  it('capital track above FMV (low cg)', () => {
    expect(rsuNetPerShare(10, 50, 0.47, 0.25, true)).toBeCloseTo(35.3, 4);
  });

  it('capital track above FMV (high cg)', () => {
    expect(rsuNetPerShare(10, 50, 0.47, 0.3, true)).toBeCloseTo(33.3, 4);
  });

  it('ordinary track', () => {
    expect(rsuNetPerShare(10, 50, 0.47, 0.25, false)).toBeCloseTo(26.5, 4);
  });

  it('capital track sell-below-FMV cap', () => {
    expect(rsuNetPerShare(10, 8, 0.5, 0.25, true)).toBeCloseTo(4.0, 4);
  });

  it('price == FMV (no capital component)', () => {
    expect(rsuNetPerShare(10, 10, 0.47, 0.25, true)).toBeCloseTo(10 - 10 * 0.47, 4);
  });
});

describe('optionNetPerShare', () => {
  it('ITM (low cg)', () => {
    expect(optionNetPerShare(10, 50, 0.25)).toBeCloseTo(30.0, 4);
  });

  it('ITM (high cg)', () => {
    expect(optionNetPerShare(10, 50, 0.3)).toBeCloseTo(28.0, 4);
  });

  it('underwater', () => {
    expect(optionNetPerShare(15, 10, 0.25)).toBe(0);
  });

  it('ATM', () => {
    expect(optionNetPerShare(10, 10, 0.25)).toBe(0);
  });
});

describe('esppNetPerShare (capital track matches Python default path)', () => {
  it('price ≥ purchase FMV (capital track)', () => {
    expect(esppNetPerShare(8.5, 10, 12, 0.47, 0.25, true)).toBeCloseTo(10.795, 4);
  });

  it('price < purchase FMV (sell-below-FMV cap)', () => {
    expect(esppNetPerShare(8.5, 10, 9, 0.5, 0.25, true)).toBeCloseTo(8.75, 4);
  });

  it('price == purchase FMV', () => {
    expect(esppNetPerShare(8.5, 10, 10, 0.47, 0.25, true)).toBeCloseTo(10 - 1.5 * 0.47, 4);
  });

  it('price < purchase price', () => {
    expect(esppNetPerShare(8.5, 10, 8, 0.5, 0.25, true)).toBeCloseTo(8.0, 4);
  });

  it('price ≥ purchase FMV but ordinary track uses marginal on appreciation', () => {
    const cap = esppNetPerShare(8.5, 10, 12, 0.47, 0.25, true);
    const ord = esppNetPerShare(8.5, 10, 12, 0.47, 0.25, false);
    expect(ord).toBeLessThan(cap);
    expect(ord).toBeCloseTo(12 - 1.5 * 0.47 - 2 * 0.47, 4);
  });
});

describe('capitalGainsRate', () => {
  it('default 25%', () => {
    expect(capitalGainsRate(500_000)).toBe(CAPITAL_GAINS_RATE_BASE);
    expect(capitalGainsRate(721_561)).toBe(CAPITAL_GAINS_RATE_BASE);
    expect(capitalGainsRate(SURTAX_THRESHOLD_NIS)).toBe(CAPITAL_GAINS_RATE_BASE);
  });

  it('controlling shareholder 30%', () => {
    expect(capitalGainsRate(100_000, true)).toBe(CAPITAL_GAINS_RATE_HIGH);
    expect(capitalGainsRate(2_000_000, true)).toBe(CAPITAL_GAINS_RATE_HIGH);
  });
});

describe('sentinel constants', () => {
  it('match 2026 tax rules / Python tax_calc', () => {
    expect(SURTAX_THRESHOLD_NIS).toBe(721_560);
    expect(CAPITAL_GAINS_RATE_BASE).toBe(0.25);
    expect(CAPITAL_GAINS_RATE_HIGH).toBe(0.3);
    expect(BL_MONTHLY_CEILING).toBe(51_910);
    expect(BL_REDUCED_CEILING).toBe(7_703);
    expect(BL_HEALTH_REDUCED_TOTAL).toBeCloseTo(0.0427, 6);
    expect(BL_HEALTH_FULL_TOTAL).toBeCloseTo(0.1217, 6);
  });
});
