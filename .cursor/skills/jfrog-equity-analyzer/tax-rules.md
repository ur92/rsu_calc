# Israeli Tax Rules — Equity Compensation (Section 102)

This is a working reference for the `jfrog-equity-analyzer` skill. It is not legal or tax advice. The numeric constants and formulas here are mirrored verbatim in [`tax_calc.py`](tax_calc.py); change one and update the other.

## Section 102 — the four tracks

Section 102 of the Israeli Income Tax Ordinance defines four possible treatments. The track is selected by the **company** when the ESOP plan is filed with the Israeli Tax Authority (ITA); the employee cannot change it after the fact.

| Track | Tax on appreciation | Holding period (trustee) | Notes |
|---|---|---|---|
| **102 הוני (capital gains, with trustee)** | 25% flat (or 30% — see below) | 24 months from end of grant tax year | Most common for tech employees. Best for the employee. |
| **102 פירותי (income, with trustee)** | Marginal income tax + ביטוח לאומי + בריאות | 24 months from end of grant tax year | Employer gets a deduction. Rarely used. |
| **102 ללא נאמן (non-trustee)** | Marginal income tax + BL + health | None | Uncommon. |
| **3(i) (non-102)** | Marginal income tax + BL + health | None | Foreign companies without an approved 102 plan, or non-compliant plans. |

**The 24-month clock starts at the end of the tax year of grant**, not the calendar grant date. Example: a grant on **2024-03-15** completes the 24-month period on **2026-12-31**, not 2026-03-15. Sales before that fall back to the marginal-rate track even if the company elected the capital-gains track.

## Capital gains rate (102 הוני)

The 25% flat rate has two surcharges:

- **Surtax (יסף) on annual income above 721,560 ₪ (2026 threshold)** — 3% general yasaf + 2% additional yasaf on capital income, since 2025. Combined rate on capital gains above the threshold = **30%**.
- **Controlling shareholder (10%+ holdings, ever)** — 30% flat regardless of income level.

```
cg_rate = 0.25                                  # below threshold, not controlling
cg_rate = 0.30                                  # above 721,560 ₪/year, OR controlling shareholder
```

## Per-share net formulas

`marginal` is the user's combined marginal rate (income tax + BL + health, see tables below). `cg_rate` is from the rule above. All formulas assume a single share and a single sale event; the analyzer multiplies by quantity.

### RSU under 102 הוני (publicly listed parent)

For listed companies the 102 honi gain is split: the FMV-at-grant portion is ordinary income (taxed at marginal rates) and the appreciation above it is capital gain.

**Important sell-below-FMV cap** (learned from real eTrade trustee reports): when `price < fmv_grant`, the marginal-income portion is capped at the actual proceeds. There is no synthetic capital loss inside Section 102 — the capital component clamps to zero rather than going negative.

```
if price >= fmv_grant:
    net = price - fmv_grant * marginal - (price - fmv_grant) * cg_rate
else:
    net = price * (1 - marginal)                # all proceeds taxed as ordinary income
```

For private (non-listed) companies under 102 honi, there is no FMV-at-grant split; the entire gain is taxed at `cg_rate`.

### RSU under 102 פירותי / 102 ללא נאמן / 3(i), or any sale before the 24-month clock

```
net = price * (1 - marginal)
```

### NQ Options (pre-IPO, strike ≈ FMV at grant)

Under 102 honi for listed parents, the employment-income component is approximately zero (strike ≈ grant FMV) and the entire spread is capital gain.

```
net = max(0, price - strike) * (1 - cg_rate)
```

### ESPP

JFrog's ESPP buys at the lower of grant-date FMV and purchase-date FMV minus a 15% discount. Israeli tax treats the discount as ordinary income and the appreciation above purchase-date FMV as capital gain.

**Sell-below-FMV cap** (mirror of the RSU rule): when `price < purchase_fmv`, the discount-as-marginal portion is `max(0, price − purchase_price)` rather than the theoretical `purchase_fmv − purchase_price`. Capital gain is zero.

```
if price >= purchase_fmv:
    discount     = max(0, purchase_fmv - purchase_price)
    appreciation = price - purchase_fmv
    net = price - discount * marginal - appreciation * cg_rate
else:
    discount = max(0, price - purchase_price)
    net = price - discount * marginal
```

## Income tax brackets — 2026

Annual brackets (NIS):

| Annual gross | Bracket rate |
|---|---|
| up to 84,120 | 10% |
| 84,121 – 120,720 | 14% |
| 120,721 – 228,000 | 20% |
| 228,001 – 301,200 | 31% |
| 301,201 – 560,280 | 35% |
| 560,281 – 721,560 | 47% |
| above 721,560 | 50% (47% + 3% yasaf) |

These are the precise piecewise brackets used by `marginal_tax_on(annual_income)` in `tax_calc.py`.

## Bituach Leumi + Mas Briut (employee share)

Two regimes by monthly income:

| Component | Reduced (≤ 7,703 ₪/month) | Full (7,703 – 51,910 ₪/month) |
|---|---|---|
| Bituach Leumi | 0.4% | 7.0% |
| Mas Briut (health) | 3.1% | 5.0% |
| **Combined** | **3.5%** | **12.0%** |

Income above the **monthly ceiling of 51,910 ₪ (2026)** is not subject to BL/health. For a lump-sum RSU/option event, the marginal-income portion is added to the month's ordinary salary; if the regular salary already exceeds the ceiling, BL/health on the equity portion is effectively zero.

## Combined marginal rate — quick lookup

For canvas/dashboard work where speed matters more than precision, use:

| Annual salary (NIS) | Combined marginal (income tax + BL + health + yasaf) |
|---|---|
| < 350,000 | ~40% |
| 350,000 – 700,000 | ~41% |
| ≥ 700,000 | ~53% |

For accurate numbers use `marginal_tax_on(annual_income) + bituach_leumi_employee(monthly_income)` from [`tax_calc.py`](tax_calc.py).

## eTrade trustee withholding convention

When the trustee (eTrade for JFrog) processes a sale, it withholds at conservative flat rates so as not to under-withhold:

- **62% on the marginal-income portion** (top marginal bracket + BL/health buffer)
- **28% on the capital-gain portion** (25% + 3% yasaf, the pre-2025 rate)

The withheld amount appears on the next payslip as `מקדמה/הפרעה` (a credit against the month's tax bill), and the marginal-income portion appears as `שווי מס פירותי` (added to the month's gross). The actual economic tax for the employee is recomputed at the user's real bracket — over-withholding is refunded through the payslip reconciliation.

> Note: the 28% trustee rate has not been raised to 30% even though the capital surtax was bumped to 5% in 2025. Trustees still under-withhold for high earners by 2 percentage points on the capital portion; the gap is settled at year-end via the personal annual return.

## Sale priority

When liquidating, sort all sellable lots by **effective tax rate ascending** to minimize total tax paid:

```
effective_tax_rate = 1 - (net_per_share / sale_price)
```

The lowest effective rate is the most efficient sale.

## FMV at grant — practical note

The ITA defines the FMV-at-grant for listed-parent 102 honi grants as the **average closing price over the 30 trading days preceding the grant date**. eTrade does not export this value in `ByBenefitType_expanded`. The skill's `parse_etrade.py` approximates it using the price at the **first vest event** of each grant, which is usually higher than the true 30-day average and therefore over-estimates the ordinary-income portion. For accurate planning, look up the actual 30-day average separately and pass it in.
