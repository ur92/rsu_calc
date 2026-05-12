import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { EsppPurchase, OptionGrant, ParsedData, RsuGrant } from '../types';
import { buildFullSalePlan, jfrogIncomeFromSalePlan, mergeSalePlanKeys } from '../surtaxFromSalePlan';

function demoLikeFixture(): ParsedData {
  const rsu: RsuGrant = {
    grantNumber: 'RSU-2021-001',
    grantDate: new Date(Date.UTC(2021, 2, 1)),
    fmvAtGrant: 15,
    grantedQty: 900,
    vestedQty: 700,
    unvestedQty: 200,
    blockedQty: 600,
    vestSchedule: [],
  };
  const opt: OptionGrant = {
    grantNumber: 'OPT-2019-001',
    grantDate: new Date(Date.UTC(2019, 5, 1)),
    exercisePrice: 20,
    grantedQty: 2000,
    exercisableQty: 500,
    blockedQty: 0,
    vestSchedule: [],
  };
  const espp: EsppPurchase = {
    purchaseDate: new Date(Date.UTC(2023, 8, 30)),
    grantDate: new Date(Date.UTC(2023, 3, 1)),
    purchasePrice: 15,
    grantDateFmv: 18,
    purchaseDateFmv: 19,
    purchasedQty: 150,
    blockedQty: 150,
    discountPct: 0.15,
  };
  return { rsus: [rsu], options: [opt], espp: [espp] };
}

describe('buildFullSalePlan', () => {
  it('includes blocked RSUs, ITM options, blocked ESPP; skips OTM options', () => {
    const otm: OptionGrant = {
      grantNumber: 'OPT-DEEP-OTM',
      grantDate: new Date(Date.UTC(2020, 0, 1)),
      exercisePrice: 60,
      grantedQty: 100,
      exercisableQty: 10,
      blockedQty: 0,
      vestSchedule: [],
    };
    const base = demoLikeFixture();
    const data: ParsedData = {
      ...base,
      options: [...base.options, otm],
    };
    const plan = buildFullSalePlan(data, 50);
    expect(plan['rsu-RSU-2021-001']).toBe(600);
    expect(plan['opt-OPT-2019-001']).toBe(500);
    expect(plan[`espp-${data.espp[0]!.purchaseDate.getTime()}`]).toBe(150);
    expect(plan['opt-OPT-DEEP-OTM']).toBeUndefined();
  });
});

describe('mergeSalePlanKeys', () => {
  it('adds new keys without clobbering existing values', () => {
    const prev = { 'rsu-A': 5, 'opt-B': 10 };
    const defaults = { 'rsu-A': 999, 'opt-B': 888, 'espp-X': 3 };
    const merged = mergeSalePlanKeys(prev, defaults);
    expect(merged['rsu-A']).toBe(5);
    expect(merged['opt-B']).toBe(10);
    expect(merged['espp-X']).toBe(3);
  });
});

describe('jfrogIncomeFromSalePlan', () => {
  // Freeze time: RSU-2021-001 qualifies for capital track after 2023-12-31;
  // ESPP grantDate 2023-04-01 qualifies after 2025-12-31.
  // A fixed date well past both ensures deterministic capital-track results
  // regardless of when the test suite runs.
  beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2027-01-01')); });
  afterAll(() => { vi.useRealTimers(); });

  it('matches synthetic demo-scale totals at $50 and rate 3.6', () => {
    const data = demoLikeFixture();
    const plan = buildFullSalePlan(data, 50);
    const { totalNIS, capitalSourceNIS } = jfrogIncomeFromSalePlan(data, plan, 50, 3.6);

    const expectedTotal =
      600 * 50 * 3.6 + // RSU gross
      (50 - 20) * 500 * 3.6 + // option spread
      150 * 50 * 3.6; // ESPP gross

    expect(expectedTotal).toBe(189_000);
    expect(Math.abs(totalNIS - expectedTotal) / expectedTotal).toBeLessThan(0.01);
    expect(Math.abs(capitalSourceNIS - expectedTotal) / expectedTotal).toBeLessThan(0.01);
  });
});
