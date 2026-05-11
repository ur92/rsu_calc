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

The statutory flat rate on the **capital-gain portion** of a 102 honi sale is **25%**, or **30%** only for **controlling shareholders** (10%+ holdings, ever).

**מס יסף** (additional tax under section 121ב, including the 3% general and 2% capital surtax since 2025) is **not** included in `cg_rate`. It is computed **at portfolio level** on annual taxable income (salary + simulated sales + other capital income) — see `compute_surtax` / `computeSurtax` in the implementations.

```
cg_rate = 0.25                                  # default
cg_rate = 0.30                                  # controlling shareholder only
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

## מס יסף לפי סעיף 121ב (תיקון 276 + הוראת ביצוע 5/2025)

כללים אלה משקפים את **מס היסף הנוסף** ברמת **שנת מס**, מעבר לשיעורי מס ההכנסה השגרתיים. החישוב ביישום (`compute_surtax` / `computeSurtax`) הוא **ברמת התיק** (משכורת + סימולציית מכירות + הכנסה הונית אחרת), לא per-lot.

### סף

- **721,560 ₪** לשנת מס — **קפוא לשנים 2025–2027** במקורות הרשמיים לעניין יסף זה.

### שני מרכיבים (בסכומים עודפים מעל הסף — כל אחד בנפרד)

1. **3%** על **סך ההכנסה החייבת** (כולל משכורת, הכנסות ממכירת ניירות ערך לפי החישוב החל על המשתמש, דיבידנד, ריבית, שכר דירה וכו' — לפי הגדרת המחוקק והוראות הביצוע).
2. **2% (חדש מ־2025)** על **סך ההכנסה החייבת ממקור הוני** — כלומר הכנסות **שאינן** משכורת / עסק / מאמץ אישי כהגדרת החידוד במסמך (למשל דיבידנד, ריבית, רווח הון; **במסלול 102 הוני** הכנסה מ-RSU נכללת במקור הוני לעניין 2% לפי הפירוט בהוראת הביצוע).

המרכיבים **מחושבים באופן עצמאי** (עודף כללי למול הסף לעומת עודף הוני למול אותו סף).

### דוגמאות מספריות (מהוראת הביצוע — עיגולים לפי המסמך)

| דוגמה | משכורת | דיבידנד | ריבית | סה״כ חייב | הוני | יסף 3% | יסף 2% | סה״כ יסף |
|--------|--------|---------|-------|-----------|------|--------|--------|----------|
| 3.1 | 400,000 | 200,000 | 100,000 | 700,000 | 300,000 | 0 | 0 | 0 |
| 3.2 | 400,000 | 400,000 | 300,000 | 1,100,000 | 700,000 | 11,353.20 | 0 | 11,353.20 |
| 3.3 | 400,000 | 500,000 | 600,000 | 1,500,000 | 1,100,000 | 23,353.20 | 7,568.80 | 30,922.00 |

בדוגמאות: יסף 3% = 3% × max(0, סה״כ חייב − 721,560); יסף 2% = 2% × max(0, סה״כ הוני − 721,560).

### הערות ליישום במחשבון

- היסף אינו משנה את **שיעור רווח ההון** על כל מניה (25% / 30% לבעל שליטה בלבד); הוא נוסף **בנפרד** לפי בסיסים שנתיים.
- סכומי המכירה מהתיק JFrog נסכמים לשני בסיסים: **ברוטו לכל הלוטים** (למען 3%) לעומת **רכיב מקור הוני מלוטים במסלול הוני / אופציות / ESPP הוני** (למען 2%), בתוספת שדה "הכנסה הונית אחרת".

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

Two regimes by monthly income (rates effective from February 2025 / 2026 ceiling):

| Component | Reduced (≤ 7,703 ₪/month) | Full (7,703 – 51,910 ₪/month) |
|---|---|---|
| Bituach Leumi | 1.04% | 7.00% |
| Mas Briut (health) | 3.23% | 5.17% |
| **Combined** | **4.27%** | **12.17%** |

Income above the **monthly ceiling of 51,910 ₪ (2026)** is not subject to BL/health.

**Ceiling rule for equity income:** the RSU/option/ESPP פירותי (ordinary-income) portion is added to the month's ordinary salary for BL/health purposes. If the employee's regular monthly salary already equals or exceeds the monthly ceiling (51,910 ₪), the equity income adds **zero** additional BL/health — only marginal income tax applies. For example, an employee earning 60,000 ₪/month pays no BL/health on any RSU sale in that month.

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

**JFrog's RSU pricing method**: JFrog prices RSUs using the **20-trading-day trailing average closing price** ending on the day before the Compensation Committee meets to approve grants. The app automatically fetches this value from Yahoo Finance historical data using the grant date parsed from eTrade, via `/api/fmv-at-grant`. The FMV cell in the Grants table shows a `20d` badge when auto-calculated, a `vest` badge when falling back to the first-vest proxy (e.g. pre-IPO dates or network errors), and a `ידני` badge after manual edits.

**ITA definition (for reference)**: The Israeli Tax Authority defines the FMV-at-grant for listed-parent 102 honi grants as the **average closing price over the 30 trading days preceding the grant date**. In practice JFrog's 20-day figure is used in the app as it matches the grant agreement price and is close to the ITA's value.

**Fallback**: eTrade does not export grant-date FMV in `ByBenefitType_expanded`. If the `/api/fmv-at-grant` fetch fails (pre-IPO grant date, network error), the first vest event price is used as a proxy — this is usually higher than the true grant FMV and over-estimates the ordinary-income portion.
