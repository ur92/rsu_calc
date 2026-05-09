"""
Israeli equity-compensation tax math, derived from tax-rules.md.

Pure functions, no I/O, no external deps. Every constant and formula here
mirrors the documentation in tax-rules.md verbatim — change one and update
the other, otherwise the sentinel tests in test_tax_calc.py will fail.

All amounts are in NIS unless otherwise noted. Annual figures use the 2026
brackets and ceilings.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal, TypedDict

Track = Literal["capital", "ordinary"]


SURTAX_THRESHOLD: float = 721_560.0
SURTAX_GENERAL_RATE: float = 0.03
SURTAX_CAPITAL_EXTRA_RATE: float = 0.02

CAPITAL_GAINS_RATE_BASE: float = 0.25
CAPITAL_GAINS_RATE_HIGH: float = 0.30

ETRADE_TRUSTEE_MARGINAL_WITHHOLD: float = 0.62
ETRADE_TRUSTEE_CAPITAL_WITHHOLD: float = 0.28


INCOME_TAX_BRACKETS_2026: list[tuple[float, float]] = [
    (84_120.0, 0.10),
    (120_720.0, 0.14),
    (228_000.0, 0.20),
    (301_200.0, 0.31),
    (560_280.0, 0.35),
    (721_560.0, 0.47),
    (float("inf"), 0.50),
]


BL_REDUCED_CEILING: float = 7_703.0
BL_MONTHLY_CEILING: float = 51_910.0
BL_REDUCED_RATE: float = 0.004
HEALTH_REDUCED_RATE: float = 0.031
BL_FULL_RATE: float = 0.07
HEALTH_FULL_RATE: float = 0.05
BL_HEALTH_REDUCED_TOTAL: float = BL_REDUCED_RATE + HEALTH_REDUCED_RATE
BL_HEALTH_FULL_TOTAL: float = BL_FULL_RATE + HEALTH_FULL_RATE


def marginal_tax_on(annual_income_nis: float) -> float:
    """Annual income tax (incl. 3% yasaf above 721,560) on a given annual gross.

    Piecewise sum across the 2026 brackets. Returns 0 for non-positive income.
    """
    if annual_income_nis <= 0:
        return 0.0
    tax = 0.0
    prev_top = 0.0
    for top, rate in INCOME_TAX_BRACKETS_2026:
        if annual_income_nis <= top:
            tax += (annual_income_nis - prev_top) * rate
            return tax
        tax += (top - prev_top) * rate
        prev_top = top
    return tax


def capital_gains_rate(
    _annual_income_nis: float,
    controlling_shareholder: bool = False,
) -> float:
    """Effective capital-gains rate for a Section 102 honi sale.

    25% by default, 30% only for controlling shareholders (10%+ holdings ever).
    Portfolio-level מס יסף (3% + 2% since 2025) is computed separately via
    `compute_surtax`.
    """
    if controlling_shareholder:
        return CAPITAL_GAINS_RATE_HIGH
    return CAPITAL_GAINS_RATE_BASE


@dataclass(frozen=True)
class SurtaxResult:
    total_income_nis: float
    capital_income_total_nis: float
    yasaf3_nis: float
    yasaf2_nis: float
    total_nis: float


def compute_surtax(
    salary_nis: float,
    jfrog_sale_total_income_nis: float,
    jfrog_sale_capital_source_nis: float,
    other_capital_income_nis: float = 0.0,
) -> SurtaxResult:
    """Portfolio יסף per section 121ב (הוראת ביצוע 5/2025): 3% on total, 2% on capital."""
    other = other_capital_income_nis
    total_income = salary_nis + jfrog_sale_total_income_nis + other
    capital_total = jfrog_sale_capital_source_nis + other
    yasaf3 = SURTAX_GENERAL_RATE * max(0.0, total_income - SURTAX_THRESHOLD)
    yasaf2 = SURTAX_CAPITAL_EXTRA_RATE * max(0.0, capital_total - SURTAX_THRESHOLD)
    total_yasaf = yasaf3 + yasaf2
    return SurtaxResult(
        total_income_nis=total_income,
        capital_income_total_nis=capital_total,
        yasaf3_nis=yasaf3,
        yasaf2_nis=yasaf2,
        total_nis=total_yasaf,
    )


class LotIncomeBreakdown(TypedDict):
    total_income_nis: float
    capital_income_nis: float


def rsu_lot_income(
    fmv_at_grant: float,
    sale_price: float,
    qty: float,
    fx: float,
    capital_track: bool,
) -> LotIncomeBreakdown:
    del fmv_at_grant
    total_income = sale_price * qty * fx
    cap = total_income if capital_track else 0.0
    return LotIncomeBreakdown(total_income_nis=total_income, capital_income_nis=cap)


def option_lot_income(
    strike: float, sale_price: float, qty: float, fx: float
) -> LotIncomeBreakdown:
    spread = max(0.0, sale_price - strike)
    v = spread * qty * fx
    return LotIncomeBreakdown(total_income_nis=v, capital_income_nis=v)


def espp_lot_income(
    purchase_date_fmv: float,
    sale_price: float,
    qty: float,
    fx: float,
    capital_track: bool,
) -> LotIncomeBreakdown:
    del purchase_date_fmv
    total_income = sale_price * qty * fx
    cap = total_income if capital_track else 0.0
    return LotIncomeBreakdown(total_income_nis=total_income, capital_income_nis=cap)


def holding_track(grant_date: date, sale_date: date) -> Track:
    """24-month rule for 102 trustee tracks.

    The clock starts at the END of the tax year of grant. A grant on
    2024-03-15 completes the 24-month period on 2026-12-31, not 2026-03-15.
    Sales on or after that date qualify for the capital-gains track.
    """
    end_of_grant_year = date(grant_date.year, 12, 31)
    qualifying_year = end_of_grant_year.year + 2
    qualifying_date = date(qualifying_year, 12, 31)
    if sale_date >= qualifying_date:
        return "capital"
    return "ordinary"


def bituach_leumi_employee(monthly_income_nis: float) -> float:
    """Combined BL + health tax on a single month's income (employee share).

    Reduced rates apply to the first 7,703 NIS, full rates between 7,703 and
    the monthly ceiling of 51,910 NIS, no contribution above the ceiling.
    """
    if monthly_income_nis <= 0:
        return 0.0
    reduced = min(monthly_income_nis, BL_REDUCED_CEILING)
    above_reduced = max(0.0, min(monthly_income_nis, BL_MONTHLY_CEILING) - BL_REDUCED_CEILING)
    return reduced * BL_HEALTH_REDUCED_TOTAL + above_reduced * BL_HEALTH_FULL_TOTAL


def rsu_net_per_share(
    price: float,
    fmv_grant: float,
    marginal: float,
    cg_rate: float,
    track: Track = "capital",
) -> float:
    """Net per share for one RSU sale.

    On the ordinary track (or any 102 path before the 24-month clock has
    elapsed) the entire sale price is taxed at the marginal rate.

    On the capital track the gain is split between FMV-at-grant (taxed at
    marginal) and the appreciation above it (taxed at cg_rate). When the
    sale price is at or below FMV-at-grant the rule collapses: all proceeds
    become ordinary income, and the capital component clamps to zero — the
    sell-below-FMV cap.
    """
    if track == "ordinary":
        return price * (1 - marginal)
    if price >= fmv_grant:
        return price - fmv_grant * marginal - (price - fmv_grant) * cg_rate
    return price * (1 - marginal)


def options_net_per_share(price: float, strike: float, cg_rate: float) -> float:
    """Net per share for one NQ option sale under 102 honi.

    Strike ≈ FMV at grant for pre-IPO options, so the entire spread is
    capital gain. Underwater options return zero.
    """
    return max(0.0, price - strike) * (1 - cg_rate)


def espp_net_per_share(
    price: float,
    purchase_price: float,
    purchase_fmv: float,
    marginal: float,
    cg_rate: float,
) -> float:
    """Net per share for one ESPP sale.

    Discount portion (purchase_fmv − purchase_price) is taxed at marginal,
    appreciation above purchase_fmv is taxed at cg_rate.

    Sell-below-FMV cap: when price < purchase_fmv the marginal-as-discount
    portion is the actual realized gain max(0, price − purchase_price)
    rather than the theoretical discount. Capital gain clamps to zero.
    """
    if price >= purchase_fmv:
        discount = max(0.0, purchase_fmv - purchase_price)
        appreciation = price - purchase_fmv
        return price - discount * marginal - appreciation * cg_rate
    discount = max(0.0, price - purchase_price)
    return price - discount * marginal
