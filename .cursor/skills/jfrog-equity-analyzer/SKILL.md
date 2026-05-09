---
name: jfrog-equity-analyzer
description: Analyzes JFrog (FROG) employee equity from an eTrade ByBenefitType_expanded xlsx file. Computes Israeli Section 102 tax liability per RSU/option/ESPP grant and builds an interactive canvas dashboard with sale-priority ranking. Use when the user provides an eTrade xlsx file or asks for tax analysis, net value, or sale prioritization for JFrog stock.
---

# JFrog Equity Analyzer

This skill turns a raw eTrade export into a tax-aware equity dashboard for Israeli JFrog employees.

## Inputs to gather from the user

1. Path to the eTrade xlsx (filename usually `ByBenefitType_expanded*.xlsx`)
2. Annual gross salary in NIS (determines marginal tax bracket)
3. Current FROG share price USD (or use live from Yahoo Finance)
4. USD/ILS exchange rate (default 3.6)
5. Optional: FMV at grant per RSU grant (eTrade does not export this directly — see "FMV at grant caveat" below)

## Workflow

1. Run the parser:
   ```bash
   python3 .cursor/skills/jfrog-equity-analyzer/parse_etrade.py "<xlsx_path>"
   ```
   It prints JSON with `rsus`, `options`, `espp` arrays. Each RSU grant includes `vestSchedule[]` with future vest events and a heuristic `fmvAtGrant` taken from the first vest's `Released Amount`.

2. Apply the tax rules in [tax-rules.md](tax-rules.md) to compute, for each grant:
   - Whether it is on the capital track or ordinary track via `holding_track(grant_date, sale_date)` (24-month clock measured from the **end of the tax year of grant**, not the calendar grant date)
   - Net per share at the user's price + rate
   - Effective tax rate
   - Total net ILS for blocked/exercisable shares

   The four Section 102 tracks (102 הוני / 102 פירותי / 102 ללא נאמן / 3(i)) and the choice between them are summarized in [tax-rules.md](tax-rules.md). Track is set by the company, not the employee.

3. Produce a Cursor canvas at the workspace's `canvases/` directory. Filename: `jfrog-equity-<YYYY-MM-DD>.canvas.tsx`. The canvas must:
   - Inline all parsed data and computed values (no fetch, no network)
   - Use `useState` for price + rate sliders so the user can simulate
   - Show: summary stat cards, RSU table, options table, ESPP table, sale-priority list, upcoming vests

## Canvas structure

Use components from `cursor/canvas` only. Suggested layout:

```
Stack
├─ H1: "ניתוח אקוויטי — JFrog FROG"
├─ Grid 2 cols: price slider + rate slider
├─ Grid 4 cols: 4 stat cards (RSU net / Options net / ESPP net / Total)
├─ H2: "RSU Grants"
│  └─ Table (Grant | Date | FMV | Track | Blocked | Net/share | Total ₪)
├─ H2: "אופציות"
│  └─ Table (Grant | Date | Strike | Exercisable | Net/share | Total ₪)
├─ H2: "ESPP"
│  └─ Table (Date | Qty | Price | Net/share | Total ₪)
├─ H2: "סדר עדיפות למכירה"
│  └─ Numbered list sorted by effective tax rate ascending
└─ H2: "הבשלות קרובות (12 חודשים)"
   └─ Table of upcoming vest events
```

## Tax rules summary

Full reference in [tax-rules.md](tax-rules.md), tested implementation in [tax_calc.py](tax_calc.py). Key formulas:

| Type | Formula |
|---|---|
| RSU הוני (capital track, `price ≥ fmv_grant`) | `net = price - fmv_grant × marginal - (price - fmv_grant) × cg_rate` |
| RSU הוני (capital track, `price < fmv_grant`) | `net = price × (1 - marginal)` — sell-below-FMV cap |
| RSU רגיל (ordinary track) | `net = price × (1 - marginal)` |
| Options NQ pre-IPO | `net = max(0, price - strike) × (1 - cg_rate)` |
| ESPP (`price ≥ fmv_purchase`) | `net = price - (fmv_purchase - purchase_price) × marginal - (price - fmv_purchase) × cg_rate` |
| ESPP (`price < fmv_purchase`) | `net = price - max(0, price - purchase_price) × marginal` — sell-below-FMV cap |

`cg_rate = 0.25` normally; **`0.30` only for controlling shareholders**. Portfolio **מס יסף** (3% + 2% since 2025, threshold 721,560 ₪) is a **separate annual calculation** — see [tax-rules.md](tax-rules.md) section 121ב and `compute_surtax()` in [tax_calc.py](tax_calc.py).

Marginal rate quick lookup by annual NIS salary (use [tax-rules.md](tax-rules.md) and `marginal_tax_on()` in [tax_calc.py](tax_calc.py) for precise 2026 brackets):
- < 350,000 → 40%
- 350,000–700,000 → 41%
- ≥ 700,000 → 53%

## FMV at grant caveat

The eTrade `ByBenefitType_expanded` file does NOT export the grant-date FMV used by the Israeli tax authority (typically the average price over the 30 trading days before grant). The parser uses the price at the **first vest event** as a proxy — usually higher than the true grant FMV (overestimates the employment-income portion, understates net).

Ask the user to provide actual grant FMVs if accuracy matters, or note this limitation in the canvas.

## Sale priority rule

Sort sellable lots by **effective tax rate ascending**. In the web app, that rate includes **marginal portfolio יסף** (change in combined 3%+2% יסף when the lot is included in the sale plan), divided by the lot’s gross NIS — so lots that push annual income across the יסף thresholds rank worse.

## Tests

The formulas, brackets, and surtax constants are pinned by a deterministic stdlib `unittest` suite. Run from the workspace root:

```bash
python3 -m unittest discover -s .cursor/skills/jfrog-equity-analyzer -p test_tax_calc.py -v
```

Or from the skill directory:

```bash
python3 -m unittest test_tax_calc.py -v
```

Sentinel assertions guard the values that have shifted historically (`CAPITAL_GAINS_RATE_HIGH = 0.30`, `SURTAX_THRESHOLD = 721_560`, `BL_MONTHLY_CEILING = 51_910`, eTrade trustee withholding 62%/28%). If any of these drift, the relevant test fails and the change must be reflected in both `tax_calc.py` and `tax-rules.md` together.
