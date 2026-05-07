# Israeli Tax Rules — Equity Compensation (Section 102)

This is a working reference for the `jfrog-equity-analyzer` skill. It is not legal or tax advice.

## Section 102 — capital track vs ordinary track

Israeli employee equity granted through a Section 102 trustee plan is taxed differently depending on the holding period from the **grant date**:

- **Capital track (מסלול הוני)** — 24+ months from grant date to sale.
  - The portion equal to **FMV at grant** is taxed as employment income at the employee's marginal rate.
  - Any appreciation above the grant FMV is taxed as **capital gains at 28%** (25% capital gains + 3% surtax).
- **Ordinary track (מסלול רגיל)** — less than 24 months from grant date.
  - The full sale price is taxed as employment income at the marginal rate. No capital gains treatment.

Per-share formulas:

```
# Capital track
net_per_share = price - fmv_grant * marginal - max(0, price - fmv_grant) * 0.28

# Ordinary track
net_per_share = price * (1 - marginal)
```

## NQ Options (pre-IPO)

JFrog options granted before the September 2020 IPO are NQ stock options with strike price equal to FMV at grant. Under Section 102:

- Employment-income component is approximately zero (strike ≈ grant FMV)
- Entire spread is taxed as capital gains at 28%

```
net_per_share = max(0, price - strike) * (1 - 0.28)
              = max(0, price - strike) * 0.72
```

## ESPP

JFrog ESPP buys at the lower of grant-date FMV and purchase-date FMV minus a 15% discount. Under Israeli tax:

- The discount portion (`purchase_date_fmv - purchase_price`) is taxed as employment income at marginal rate.
- Appreciation above the purchase-date FMV is taxed as capital gains at 28%.

```
discount = max(0, purchase_date_fmv - purchase_price)
appreciation = max(0, price - purchase_date_fmv)
net_per_share = price - discount * marginal - appreciation * 0.28
```

## Marginal rate tiers

The combined Israeli marginal rate (income tax + Bituach Leumi + Mas Briut + 3% surtax above the threshold) by annual gross salary in NIS:

| Annual salary (NIS) | Combined marginal rate |
|---|---|
| < 350,000 | ~40% |
| 350,000 – 700,000 | ~41% |
| ≥ 700,000 | ~53% |

These are conservative defaults. Individual situations vary based on deductions, credits, and exact bracket boundaries.

## Capital gains rate

A flat 25% capital gains rate plus 3% surtax (for high earners) = **28%** on stock proceeds above the FMV-at-grant basis (capital track) or above the ESPP purchase-date FMV (ESPP appreciation).

## Sale priority

When liquidating, sort all sellable lots by **effective tax rate ascending** to minimize total tax paid. Effective tax rate per lot:

```
effective_tax_rate = 1 - (net_per_share / sale_price)
```

The lowest effective rate is the most efficient sale.

## FMV at grant — practical note

The Israeli tax authority defines grant-date FMV as the **average closing price over the 30 trading days before the grant date** (for capital track grants under the trustee plan). eTrade does not export this value directly in `ByBenefitType_expanded`. The parser approximates it from the price at the **first vest event** of each grant, but this is usually higher than the true grant FMV. For accurate tax planning, look up the actual 30-day average from another source.
