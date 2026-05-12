import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseEtradeXlsx } from '../parseEtrade';

function emptyRow(cols = 60): unknown[] {
  const r: unknown[] = new Array(cols);
  for (let i = 0; i < cols; i++) r[i] = '';
  return r;
}

function workbookBuffer(sheets: Record<string, unknown[][]>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  if (out instanceof ArrayBuffer) return out;
  const u8 = out as Uint8Array;
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

describe('parseEtradeXlsx — c28c543 blocked / sellable fallback', () => {
  it('RSU: col 14 Blocked Qty non-zero uses col 14', () => {
    const hdr = emptyRow();
    hdr[0] = 'Row Type';
    const g = emptyRow();
    g[0] = 'Grant';
    g[2] = '01-MAR-2021';
    g[4] = 900;
    g[6] = 700;
    g[7] = 200;
    g[9] = 999;
    g[11] = 'RSU-X';
    g[14] = 600;

    const { rsus } = parseEtradeXlsx(workbookBuffer({ 'Restricted Stock': [hdr, g] }));
    expect(rsus).toHaveLength(1);
    expect(rsus[0]!.blockedQty).toBe(600);
  });

  it('RSU: col 14 zero/empty and col 9 Sellable Qty non-zero uses col 9', () => {
    const hdr = emptyRow();
    hdr[0] = 'Row Type';
    const g = emptyRow();
    g[0] = 'Grant';
    g[2] = '01-MAR-2021';
    g[4] = 100;
    g[6] = 0;
    g[7] = 0;
    g[9] = 500;
    g[11] = 'RSU-Y';
    g[14] = 0;

    const { rsus } = parseEtradeXlsx(workbookBuffer({ 'Restricted Stock': [hdr, g] }));
    expect(rsus[0]!.blockedQty).toBe(500);
  });

  it('RSU: both col 14 and col 9 zero → blockedQty 0', () => {
    const hdr = emptyRow();
    const g = emptyRow();
    g[0] = 'Grant';
    g[2] = '01-MAR-2021';
    g[4] = 10;
    g[6] = 0;
    g[7] = 10;
    g[9] = 0;
    g[11] = 'RSU-Z';
    g[14] = 0;

    const { rsus } = parseEtradeXlsx(workbookBuffer({ 'Restricted Stock': [hdr, g] }));
    expect(rsus[0]!.blockedQty).toBe(0);
  });

  it('ESPP: col 12 Blocked Qty non-zero uses col 12', () => {
    const hdr = emptyRow();
    hdr[0] = 'Row Type';
    const p = emptyRow();
    p[0] = 'Purchase';
    p[2] = '30-SEP-2023';
    p[3] = 15;
    p[4] = 150;
    p[7] = 999;
    p[10] = '01-APR-2023';
    p[12] = 150;

    const { espp } = parseEtradeXlsx(workbookBuffer({ ESPP: [hdr, p] }));
    expect(espp).toHaveLength(1);
    expect(espp[0]!.blockedQty).toBe(150);
  });

  it('ESPP: col 12 zero/empty and col 7 Sellable Qty non-zero uses col 7', () => {
    const hdr = emptyRow();
    const p = emptyRow();
    p[0] = 'Purchase';
    p[2] = '30-SEP-2023';
    p[3] = 15;
    p[4] = 150;
    p[7] = 100;
    p[10] = '01-APR-2023';
    p[12] = 0;

    const { espp } = parseEtradeXlsx(workbookBuffer({ ESPP: [hdr, p] }));
    expect(espp[0]!.blockedQty).toBe(100);
  });

  it('ESPP: both col 12 and col 7 zero → blockedQty 0', () => {
    const hdr = emptyRow();
    const p = emptyRow();
    p[0] = 'Purchase';
    p[2] = '30-SEP-2023';
    p[3] = 15;
    p[4] = 150;
    p[7] = 0;
    p[10] = '01-APR-2023';
    p[12] = 0;

    const { espp } = parseEtradeXlsx(workbookBuffer({ ESPP: [hdr, p] }));
    expect(espp[0]!.blockedQty).toBe(0);
  });
});

describe('parseEtradeXlsx — grant date formats', () => {
  function rsuWithGrantDate(cell: unknown) {
    const hdr = emptyRow();
    const g = emptyRow();
    g[0] = 'Grant';
    g[2] = cell;
    g[4] = 1;
    g[6] = 0;
    g[7] = 1;
    g[11] = 'G';
    g[14] = 0;
    return parseEtradeXlsx(workbookBuffer({ 'Restricted Stock': [hdr, g] })).rsus[0]!.grantDate;
  }

  it('parses ISO date string', () => {
    const d = rsuWithGrantDate('2021-03-01');
    expect(d.toISOString().slice(0, 10)).toBe('2021-03-01');
  });

  it('parses DD-MON-YYYY', () => {
    const d = rsuWithGrantDate('04-AUG-2021');
    expect(d.toISOString().slice(0, 10)).toBe('2021-08-04');
  });

  it('parses MM/DD/YYYY', () => {
    const d = rsuWithGrantDate('09/01/2022');
    expect(d.toISOString().slice(0, 10)).toBe('2022-09-01');
  });

  it('null / empty / NA grant date skips grant', () => {
    const hdr = emptyRow();
    for (const bad of [null, '', 'NA', '—'] as const) {
      const g = emptyRow();
      g[0] = 'Grant';
      g[2] = bad;
      g[11] = 'SKIP';
      g[14] = 1;
      const { rsus } = parseEtradeXlsx(workbookBuffer({ 'Restricted Stock': [hdr, g] }));
      expect(rsus).toHaveLength(0);
    }
  });

  it('parses Excel serial date code in grant date cell', () => {
    // 2021-03-01 in Excel 1900 date system
    const serial = 44256;
    const d = rsuWithGrantDate(serial);
    expect(d.toISOString().slice(0, 10)).toBe('2021-03-01');
  });
});

describe('parseEtradeXlsx — sheet round-trips (demo-shaped rows)', () => {
  it('RSU: RSU-2021-001 grant, blocked qty, vest schedule', () => {
    const hdr = emptyRow();
    hdr[0] = 'Row Type';
    const g = emptyRow();
    g[0] = 'Grant';
    g[2] = '01-MAR-2021';
    g[4] = 900;
    g[6] = 700;
    g[7] = 200;
    g[11] = 'RSU-2021-001';
    g[14] = 600;

    const vests: unknown[][] = [
      hdr,
      g,
      vestRow('01-MAR-2022', 200, 15),
      vestRow('01-MAR-2023', 200, 17),
      vestRow('01-MAR-2024', 200, 20),
      vestRow('01-MAR-2025', 100, 22),
      vestRow('01-SEP-2026', 100),
      vestRow('01-MAR-2027', 100),
    ];

    const { rsus } = parseEtradeXlsx(workbookBuffer({ 'Restricted Stock': vests }));
    expect(rsus).toHaveLength(1);
    const r = rsus[0]!;
    expect(r.grantNumber).toBe('RSU-2021-001');
    expect(r.grantDate.toISOString().slice(0, 10)).toBe('2021-03-01');
    expect(r.blockedQty).toBe(600);
    expect(r.vestSchedule).toHaveLength(6);
    expect(r.fmvAtGrant).toBe(15);
  });

  it('Options: OPT-2019-001 strike and exercisable qty', () => {
    const hdr = emptyRow();
    hdr[0] = 'Row Type';
    const g = emptyRow();
    g[0] = 'Grant';
    g[2] = '01-JUN-2019';
    g[3] = 2000;
    g[4] = 20;
    g[6] = 500;
    g[9] = 'OPT-2019-001';

    const { options } = parseEtradeXlsx(
      workbookBuffer({
        'Stock Options': [hdr, g],
        'Restricted Stock': [emptyRow()],
        ESPP: [emptyRow()],
      }),
    );
    expect(options).toHaveLength(1);
    expect(options[0]!.grantNumber).toBe('OPT-2019-001');
    expect(options[0]!.exercisePrice).toBe(20);
    expect(options[0]!.exercisableQty).toBe(500);
  });

  it('ESPP: 2023-09 purchase row', () => {
    const hdr = emptyRow();
    hdr[0] = 'Row Type';
    const p = emptyRow();
    p[0] = 'Purchase';
    p[2] = '30-SEP-2023';
    p[3] = 15;
    p[4] = 150;
    p[10] = '01-APR-2023';
    p[12] = 150;
    p[15] = 0.15;
    p[16] = 18;
    p[17] = 19;

    const { espp } = parseEtradeXlsx(
      workbookBuffer({
        ESPP: [hdr, p],
        'Restricted Stock': [emptyRow()],
        'Stock Options': [emptyRow()],
      }),
    );
    expect(espp).toHaveLength(1);
    const e = espp[0]!;
    expect(e.purchaseDate.toISOString().slice(0, 10)).toBe('2023-09-30');
    expect(e.purchasePrice).toBe(15);
    expect(e.blockedQty).toBe(150);
  });
});

function vestRow(vestDate: string, qty: number, fmv?: number): unknown[] {
  const r = emptyRow();
  r[0] = 'Vest Schedule';
  r[19] = vestDate;
  r[21] = qty;
  if (fmv !== undefined) r[57] = fmv;
  return r;
}
