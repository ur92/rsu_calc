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
   - Whether it is on the capital track (24+ months from grant date) or ordinary track
   - Net per share at the user's price + rate
   - Effective tax rate
   - Total net ILS for blocked/exercisable shares

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

Full reference in [tax-rules.md](tax-rules.md). Key formulas:

| Type | Formula |
|---|---|
| RSU הוני (24+ months) | `net = price - fmv_grant × marginal - max(0, price - fmv_grant) × 0.28` |
| RSU רגיל (<24 months) | `net = price × (1 - marginal)` |
| Options NQ pre-IPO | `net = max(0, price - strike) × 0.72` |
| ESPP | `net = price - max(0, fmv_purchase - purchase_price) × marginal - max(0, price - fmv_purchase) × 0.28` |

Marginal rate by annual NIS salary:
- < 350,000 → 40%
- 350,000–700,000 → 41%
- ≥ 700,000 → 53%

## FMV at grant caveat

The eTrade `ByBenefitType_expanded` file does NOT export the grant-date FMV used by the Israeli tax authority (typically the average price over the 30 trading days before grant). The parser uses the price at the **first vest event** as a proxy — usually higher than the true grant FMV (overestimates the employment-income portion, understates net).

Ask the user to provide actual grant FMVs if accuracy matters, or note this limitation in the canvas.

## Sale priority rule

Sort all sellable lots (blocked RSU, exercisable options, blocked ESPP) by effective tax rate ascending. The lowest tax rate is the most efficient to sell first.
