import type { ParsedData } from './types';
import { isCapitalTrack, rsuLotIncome, optionLotIncome, esppLotIncome } from './taxCalc';

/** Default sale plan: all blocked / exercisable (ITM) quantities at full availability. */
export function buildFullSalePlan(data: ParsedData, priceUSD: number): Record<string, number> {
  const next: Record<string, number> = {};
  for (const g of data.rsus) {
    if (g.blockedQty > 0) next[`rsu-${g.grantNumber}`] = g.blockedQty;
  }
  for (const o of data.options) {
    if (o.exercisableQty > 0 && priceUSD > o.exercisePrice) {
      next[`opt-${o.grantNumber}`] = o.exercisableQty;
    }
  }
  for (const e of data.espp) {
    if (e.blockedQty > 0) next[`espp-${e.purchaseDate.getTime()}`] = e.blockedQty;
  }
  return next;
}

/** When price moves (new ITM options), add keys without clobbering user edits. */
export function mergeSalePlanKeys(
  prev: Record<string, number>,
  defaults: Record<string, number>,
): Record<string, number> {
  const out = { ...prev };
  for (const [k, v] of Object.entries(defaults)) {
    if (out[k] === undefined) out[k] = v;
  }
  return out;
}

/** Aggregate JFrog sale grosses (NIS) for portfolio יסף from the current `salePlan`. */
export function jfrogIncomeFromSalePlan(
  data: ParsedData,
  salePlan: Record<string, number>,
  priceUSD: number,
  rate: number,
): { totalNIS: number; capitalSourceNIS: number } {
  let totalNIS = 0;
  let capitalSourceNIS = 0;

  for (const g of data.rsus) {
    const key = `rsu-${g.grantNumber}`;
    const maxQ = g.blockedQty;
    const raw = salePlan[key];
    const qty =
      raw === undefined ? 0 : Math.min(maxQ, Math.max(0, raw));
    if (qty <= 0) continue;
    const cap = isCapitalTrack(g.grantDate);
    const b = rsuLotIncome(g.fmvAtGrant, priceUSD, qty, rate, cap);
    totalNIS += b.totalIncomeNIS;
    capitalSourceNIS += b.capitalIncomeNIS;
  }

  for (const o of data.options) {
    if (priceUSD <= o.exercisePrice) continue;
    const key = `opt-${o.grantNumber}`;
    const maxQ = o.exercisableQty;
    const raw = salePlan[key];
    const qty =
      raw === undefined ? 0 : Math.min(maxQ, Math.max(0, raw));
    if (qty <= 0) continue;
    const b = optionLotIncome(o.exercisePrice, priceUSD, qty, rate);
    totalNIS += b.totalIncomeNIS;
    capitalSourceNIS += b.capitalIncomeNIS;
  }

  for (const e of data.espp) {
    const key = `espp-${e.purchaseDate.getTime()}`;
    const maxQ = e.blockedQty;
    const raw = salePlan[key];
    const qty =
      raw === undefined ? 0 : Math.min(maxQ, Math.max(0, raw));
    if (qty <= 0) continue;
    const cap = isCapitalTrack(e.grantDate);
    const b = esppLotIncome(e.purchaseDateFmv, priceUSD, qty, rate, cap);
    totalNIS += b.totalIncomeNIS;
    capitalSourceNIS += b.capitalIncomeNIS;
  }

  return { totalNIS, capitalSourceNIS };
}
