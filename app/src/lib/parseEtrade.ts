import * as XLSX from 'xlsx';
import type { EsppPurchase, OptionGrant, ParsedData, RsuGrant } from './types';

type Row = unknown[];

// ─── Date parsing ──────────────────────────────────────────────────────────
const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
    return null;
  }
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s || s === 'NA' || s === '—') return null;
  // 04-AUG-2021
  const m1 = /^(\d{1,2})-([A-Z]{3})-(\d{4})$/i.exec(s);
  if (m1) {
    const month = MONTHS[m1[2].toUpperCase()];
    if (month !== undefined) return new Date(Date.UTC(+m1[3], month, +m1[1]));
  }
  // 09/01/2022
  const m2 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m2) return new Date(Date.UTC(+m2[3], +m2[1] - 1, +m2[2]));
  // ISO
  const t = Date.parse(s);
  if (!isNaN(t)) return new Date(t);
  return null;
}

function parseDollar(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  const cleaned = value.replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parsePercent(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value > 1 ? value / 100 : value;
  if (typeof value !== 'string') return 0;
  const cleaned = value.replace(/[%\s]/g, '');
  const n = parseFloat(cleaned);
  if (isNaN(n)) return 0;
  return n > 1 ? n / 100 : n;
}

function num(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function str(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

// ─── ESPP ──────────────────────────────────────────────────────────────────
function parseEspp(rows: Row[]): EsppPurchase[] {
  const result: EsppPurchase[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (str(r[0]) !== 'Purchase') continue;
    const purchaseDate = parseDate(r[2]);
    const grantDate = parseDate(r[10]);
    if (!purchaseDate) continue;
    result.push({
      purchaseDate,
      grantDate: grantDate ?? purchaseDate,
      purchasePrice: num(r[3]),
      purchasedQty: num(r[4]),
      blockedQty: num(r[12]) || num(r[7]),
      discountPct: parsePercent(r[15]),
      grantDateFmv: parseDollar(r[16]),
      purchaseDateFmv: parseDollar(r[17]),
    });
  }
  return result;
}

// ─── Restricted Stock (RSU) ────────────────────────────────────────────────
// Grant row columns:
//   0 Record Type, 2 Grant Date, 4 Granted Qty., 6 Vested Qty., 7 Unvested Qty.,
//   9 Sellable Qty. (fallback when not blocked), 11 Grant Number, 14 Blocked Qty.
// Vest Schedule row columns:
//   0 Record Type, 11 Grant Number, 19 Vest Date, 21 Granted/Vesting Qty.,
//   25 Vested Qty., 26 Released Qty, 57 FMV at vest (mislabeled "Dividend Market Value at Release")
function parseRestrictedStock(rows: Row[]): RsuGrant[] {
  const grants: RsuGrant[] = [];
  let current: RsuGrant | null = null;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const recType = str(r[0]);

    if (recType === 'Grant') {
      const grantDate = parseDate(r[2]);
      if (!grantDate) continue;
      current = {
        grantNumber: str(r[11]),
        grantDate,
        fmvAtGrant: 0,
        grantedQty: num(r[4]),
        vestedQty: num(r[6]),
        unvestedQty: num(r[7]),
        blockedQty: num(r[14]) || num(r[9]),
        vestSchedule: [],
      };
      grants.push(current);
    } else if (recType === 'Vest Schedule' && current) {
      const vestDate = parseDate(r[19]);
      if (!vestDate) continue;
      const qty = num(r[21]);
      const fmvAtVest = num(r[57]) || undefined;
      current.vestSchedule.push({ vestDate, qty, fmvAtVest });
    }
  }

  // Approximate FMV at grant from the earliest vest event (eTrade does not export grant-date FMV).
  // Users can override per grant in the UI.
  for (const g of grants) {
    if (g.vestSchedule.length === 0) continue;
    const sorted = [...g.vestSchedule].sort((a, b) => a.vestDate.getTime() - b.vestDate.getTime());
    const first = sorted.find((v) => v.fmvAtVest && v.fmvAtVest > 0);
    if (first?.fmvAtVest) g.fmvAtGrant = first.fmvAtVest;
  }

  return grants;
}

// ─── Options ───────────────────────────────────────────────────────────────
// Grant row columns:
//   0 Record Type, 2 Grant Date, 3 Granted Qty., 4 Exercise Price,
//   6 Exercisable Qty., 9 Grant Number, 14 Blocked Options Qty., 15 Blocked Share Qty.
// Vest Schedule row columns:
//   0 Record Type, 9 Grant Number, 19 Vest Date, 20 Vesting Qty.,
//   23 Exercisable Qty., 24 Blocked Qty., 27 Expiration Date
function parseOptions(rows: Row[]): OptionGrant[] {
  const grants: OptionGrant[] = [];
  let current: OptionGrant | null = null;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const recType = str(r[0]);

    if (recType === 'Grant') {
      const grantDate = parseDate(r[2]);
      if (!grantDate) continue;
      current = {
        grantNumber: str(r[9]),
        grantDate,
        exercisePrice: num(r[4]),
        grantedQty: num(r[3]),
        exercisableQty: num(r[6]),
        blockedQty: num(r[14]) || num(r[15]),
        vestSchedule: [],
      };
      grants.push(current);
    } else if (recType === 'Vest Schedule' && current) {
      const vestDate = parseDate(r[19]);
      if (!vestDate) continue;
      const qty = num(r[20]);
      const exp = parseDate(r[27]);
      if (exp && !current.expirationDate) current.expirationDate = exp;
      current.vestSchedule.push({ vestDate, qty });
    }
  }

  return grants;
}

// ─── Public API ────────────────────────────────────────────────────────────
export async function parseEtradeFile(file: File): Promise<ParsedData> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });

  const findSheet = (...names: string[]): Row[] => {
    for (const name of names) {
      const ws = wb.Sheets[name];
      if (ws) return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, blankrows: false });
    }
    return [];
  };

  const esppRows = findSheet('ESPP');
  const rsuRows = findSheet('Restricted Stock', 'Restricted Stock & Performance');
  const optRows = findSheet('Options', 'Stock Options');

  return {
    espp: parseEspp(esppRows),
    rsus: parseRestrictedStock(rsuRows),
    options: parseOptions(optRows),
  };
}
