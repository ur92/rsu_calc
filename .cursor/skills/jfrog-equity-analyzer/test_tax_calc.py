"""Deterministic regression tests for tax_calc.py.

Run from the workspace root:

    python3 -m unittest discover -s .cursor/skills/jfrog-equity-analyzer -p test_tax_calc.py -v

Or from the skill directory:

    python3 -m unittest test_tax_calc.py -v

These tests pin every formula, bracket boundary, and surtax constant
defined in tax-rules.md / tax_calc.py. Any drift fails loudly with a
clear delta so the change can be reviewed before propagating.

Runnable from repo root:

    PYTHONPATH=.cursor/skills/jfrog-equity-analyzer python3 -m unittest \\
        discover -s .cursor/skills/jfrog-equity-analyzer -p test_tax_calc.py -v
"""
from __future__ import annotations

import sys
import unittest
from datetime import date
from pathlib import Path

_skill_dir = Path(__file__).resolve().parent
if str(_skill_dir) not in sys.path:
    sys.path.insert(0, str(_skill_dir))

import tax_calc as tc


class TestBracketsAndSurtax(unittest.TestCase):
    """Income tax piecewise computation across the 2026 brackets."""

    def test_zero_income(self) -> None:
        self.assertEqual(tc.marginal_tax_on(0), 0.0)
        self.assertEqual(tc.marginal_tax_on(-100), 0.0)

    def test_bracket_1_top(self) -> None:
        self.assertAlmostEqual(tc.marginal_tax_on(84_120), 8_412.00, places=2)

    def test_bracket_2_top(self) -> None:
        self.assertAlmostEqual(tc.marginal_tax_on(120_720), 13_536.00, places=2)

    def test_bracket_3_top(self) -> None:
        self.assertAlmostEqual(tc.marginal_tax_on(228_000), 34_992.00, places=2)

    def test_bracket_4_top(self) -> None:
        self.assertAlmostEqual(tc.marginal_tax_on(301_200), 57_684.00, places=2)

    def test_bracket_5_top(self) -> None:
        self.assertAlmostEqual(tc.marginal_tax_on(560_280), 148_362.00, places=2)

    def test_bracket_6_top_yasaf_threshold(self) -> None:
        self.assertAlmostEqual(tc.marginal_tax_on(721_560), 224_163.60, places=2)

    def test_yasaf_kicks_in_above_threshold(self) -> None:
        delta = tc.marginal_tax_on(721_560 + 1_000) - tc.marginal_tax_on(721_560)
        self.assertAlmostEqual(delta, 1_000 * 0.50, places=2)

    def test_high_income(self) -> None:
        expected = 224_163.60 + (1_000_000 - 721_560) * 0.50
        self.assertAlmostEqual(tc.marginal_tax_on(1_000_000), expected, places=2)


class TestCapitalGainsRate(unittest.TestCase):
    def test_below_threshold_not_controlling(self) -> None:
        self.assertEqual(tc.capital_gains_rate(500_000), 0.25)

    def test_above_threshold_not_controlling(self) -> None:
        self.assertEqual(tc.capital_gains_rate(721_561), 0.25)

    def test_at_threshold_is_base(self) -> None:
        self.assertEqual(tc.capital_gains_rate(721_560), 0.25)

    def test_controlling_shareholder_low_income(self) -> None:
        self.assertEqual(
            tc.capital_gains_rate(100_000, controlling_shareholder=True), 0.30
        )

    def test_controlling_shareholder_high_income(self) -> None:
        self.assertEqual(
            tc.capital_gains_rate(2_000_000, controlling_shareholder=True), 0.30
        )


class TestHoldingTrack(unittest.TestCase):
    """24-month clock from end of tax year of grant."""

    def test_just_before_qualifying_date(self) -> None:
        self.assertEqual(
            tc.holding_track(date(2024, 3, 15), date(2026, 3, 14)), "ordinary"
        )

    def test_calendar_24_months_still_ordinary(self) -> None:
        self.assertEqual(
            tc.holding_track(date(2024, 3, 15), date(2026, 3, 15)), "ordinary"
        )

    def test_qualifying_date_inclusive(self) -> None:
        self.assertEqual(
            tc.holding_track(date(2024, 3, 15), date(2026, 12, 31)), "capital"
        )

    def test_after_qualifying_date(self) -> None:
        self.assertEqual(
            tc.holding_track(date(2024, 3, 15), date(2027, 1, 1)), "capital"
        )

    def test_grant_at_year_end_same_clock(self) -> None:
        self.assertEqual(
            tc.holding_track(date(2024, 12, 31), date(2026, 12, 31)), "capital"
        )

    def test_grant_at_year_start_same_clock(self) -> None:
        self.assertEqual(
            tc.holding_track(date(2024, 1, 1), date(2026, 12, 30)), "ordinary"
        )


class TestRsuNetPerShare(unittest.TestCase):
    def test_capital_track_above_fmv_low_earner(self) -> None:
        net = tc.rsu_net_per_share(
            price=50, fmv_grant=10, marginal=0.47, cg_rate=0.25
        )
        self.assertAlmostEqual(net, 35.30, places=4)

    def test_capital_track_above_fmv_high_earner(self) -> None:
        net = tc.rsu_net_per_share(
            price=50, fmv_grant=10, marginal=0.47, cg_rate=0.30
        )
        self.assertAlmostEqual(net, 33.30, places=4)

    def test_ordinary_track(self) -> None:
        net = tc.rsu_net_per_share(
            price=50, fmv_grant=10, marginal=0.47, cg_rate=0.25, track="ordinary"
        )
        self.assertAlmostEqual(net, 26.50, places=4)

    def test_sell_below_fmv_cap(self) -> None:
        net = tc.rsu_net_per_share(
            price=8, fmv_grant=10, marginal=0.50, cg_rate=0.25
        )
        self.assertAlmostEqual(net, 4.00, places=4)

    def test_sell_equal_fmv_no_capital_component(self) -> None:
        net = tc.rsu_net_per_share(
            price=10, fmv_grant=10, marginal=0.47, cg_rate=0.25
        )
        self.assertAlmostEqual(net, 10 - 10 * 0.47, places=4)


class TestOptionsNetPerShare(unittest.TestCase):
    def test_in_the_money_low_earner(self) -> None:
        self.assertAlmostEqual(
            tc.options_net_per_share(price=50, strike=10, cg_rate=0.25), 30.0, places=4
        )

    def test_in_the_money_high_earner(self) -> None:
        self.assertAlmostEqual(
            tc.options_net_per_share(price=50, strike=10, cg_rate=0.30), 28.0, places=4
        )

    def test_underwater(self) -> None:
        self.assertEqual(
            tc.options_net_per_share(price=10, strike=15, cg_rate=0.25), 0.0
        )

    def test_at_the_money(self) -> None:
        self.assertEqual(
            tc.options_net_per_share(price=10, strike=10, cg_rate=0.25), 0.0
        )


class TestComputeSurtax(unittest.TestCase):
    """הוראת ביצוע 5/2025 — דוגמאות 3.1–3.3 (משכורת + דיבידנד + ריבית כ-other)."""

    def test_example_3_1_below_threshold(self) -> None:
        r = tc.compute_surtax(
            salary_nis=400_000,
            jfrog_sale_total_income_nis=0,
            jfrog_sale_capital_source_nis=0,
            other_capital_income_nis=300_000,
        )
        self.assertAlmostEqual(r.total_income_nis, 700_000, places=4)
        self.assertAlmostEqual(r.capital_income_total_nis, 300_000, places=4)
        self.assertAlmostEqual(r.yasaf3_nis, 0.0, places=2)
        self.assertAlmostEqual(r.yasaf2_nis, 0.0, places=2)
        self.assertAlmostEqual(r.total_nis, 0.0, places=2)

    def test_example_3_2_only_general_yasaf(self) -> None:
        r = tc.compute_surtax(
            salary_nis=400_000,
            jfrog_sale_total_income_nis=0,
            jfrog_sale_capital_source_nis=0,
            other_capital_income_nis=700_000,
        )
        self.assertAlmostEqual(r.total_income_nis, 1_100_000, places=4)
        self.assertAlmostEqual(r.capital_income_total_nis, 700_000, places=4)
        exp3 = tc.SURTAX_GENERAL_RATE * (1_100_000 - tc.SURTAX_THRESHOLD)
        self.assertAlmostEqual(r.yasaf3_nis, exp3, places=2)
        self.assertAlmostEqual(r.yasaf3_nis, 11_353.20, places=2)
        self.assertAlmostEqual(r.yasaf2_nis, 0.0, places=2)
        self.assertAlmostEqual(r.total_nis, 11_353.20, places=2)

    def test_example_3_3_both_surtax_components(self) -> None:
        r = tc.compute_surtax(
            salary_nis=400_000,
            jfrog_sale_total_income_nis=0,
            jfrog_sale_capital_source_nis=0,
            other_capital_income_nis=1_100_000,
        )
        self.assertAlmostEqual(r.total_income_nis, 1_500_000, places=4)
        self.assertAlmostEqual(r.capital_income_total_nis, 1_100_000, places=4)
        exp3 = tc.SURTAX_GENERAL_RATE * (1_500_000 - tc.SURTAX_THRESHOLD)
        exp2 = tc.SURTAX_CAPITAL_EXTRA_RATE * (1_100_000 - tc.SURTAX_THRESHOLD)
        self.assertAlmostEqual(r.yasaf3_nis, exp3, places=2)
        self.assertAlmostEqual(r.yasaf3_nis, 23_353.20, places=2)
        self.assertAlmostEqual(r.yasaf2_nis, exp2, places=2)
        self.assertAlmostEqual(r.yasaf2_nis, 7_568.80, places=2)
        self.assertAlmostEqual(r.total_nis, 30_922.0, places=2)

    def test_total_exactly_at_threshold(self) -> None:
        r = tc.compute_surtax(
            salary_nis=tc.SURTAX_THRESHOLD,
            jfrog_sale_total_income_nis=0,
            jfrog_sale_capital_source_nis=0,
            other_capital_income_nis=0,
        )
        self.assertAlmostEqual(r.yasaf3_nis, 0.0, places=6)
        self.assertAlmostEqual(r.yasaf2_nis, 0.0, places=6)

    def test_capital_exactly_at_threshold(self) -> None:
        r = tc.compute_surtax(
            salary_nis=0,
            jfrog_sale_total_income_nis=0,
            jfrog_sale_capital_source_nis=0,
            other_capital_income_nis=tc.SURTAX_THRESHOLD,
        )
        self.assertAlmostEqual(r.yasaf2_nis, 0.0, places=6)

    def test_controlling_shareholder_cg_rate_unchanged(self) -> None:
        self.assertEqual(
            tc.capital_gains_rate(100_000, controlling_shareholder=True), 0.30
        )


class TestEsppNetPerShare(unittest.TestCase):
    def test_above_fmv_purchase(self) -> None:
        net = tc.espp_net_per_share(
            price=12, purchase_price=8.5, purchase_fmv=10, marginal=0.47, cg_rate=0.25
        )
        self.assertAlmostEqual(net, 10.795, places=4)

    def test_sell_below_fmv_purchase_cap(self) -> None:
        net = tc.espp_net_per_share(
            price=9, purchase_price=8.5, purchase_fmv=10, marginal=0.50, cg_rate=0.25
        )
        self.assertAlmostEqual(net, 8.75, places=4)

    def test_sell_equal_fmv_purchase(self) -> None:
        net = tc.espp_net_per_share(
            price=10, purchase_price=8.5, purchase_fmv=10, marginal=0.47, cg_rate=0.25
        )
        self.assertAlmostEqual(net, 10 - 1.5 * 0.47, places=4)

    def test_sell_below_purchase_price(self) -> None:
        net = tc.espp_net_per_share(
            price=8, purchase_price=8.5, purchase_fmv=10, marginal=0.50, cg_rate=0.25
        )
        self.assertAlmostEqual(net, 8.0, places=4)


class TestBituachLeumi(unittest.TestCase):
    def test_zero_income(self) -> None:
        self.assertEqual(tc.bituach_leumi_employee(0), 0.0)

    def test_within_reduced_band(self) -> None:
        self.assertAlmostEqual(tc.bituach_leumi_employee(5_000), 5_000 * 0.035, places=4)

    def test_full_band(self) -> None:
        expected = 7_703 * 0.035 + (30_000 - 7_703) * 0.12
        self.assertAlmostEqual(tc.bituach_leumi_employee(30_000), expected, places=4)

    def test_at_ceiling(self) -> None:
        expected = 7_703 * 0.035 + (51_910 - 7_703) * 0.12
        self.assertAlmostEqual(tc.bituach_leumi_employee(51_910), expected, places=4)

    def test_above_ceiling_no_extra(self) -> None:
        at_ceiling = tc.bituach_leumi_employee(51_910)
        self.assertAlmostEqual(tc.bituach_leumi_employee(60_000), at_ceiling, places=4)
        self.assertAlmostEqual(tc.bituach_leumi_employee(100_000), at_ceiling, places=4)


class TestSentinelConstants(unittest.TestCase):
    """Constants that have shifted in the past and must not silently regress."""

    def test_capital_gains_high_rate_is_30pct(self) -> None:
        self.assertEqual(tc.CAPITAL_GAINS_RATE_HIGH, 0.30)

    def test_capital_gains_base_rate_is_25pct(self) -> None:
        self.assertEqual(tc.CAPITAL_GAINS_RATE_BASE, 0.25)

    def test_surtax_threshold_2026(self) -> None:
        self.assertEqual(tc.SURTAX_THRESHOLD, 721_560)

    def test_bl_monthly_ceiling_2026(self) -> None:
        self.assertEqual(tc.BL_MONTHLY_CEILING, 51_910)

    def test_bl_reduced_ceiling(self) -> None:
        self.assertEqual(tc.BL_REDUCED_CEILING, 7_703)

    def test_etrade_trustee_withholding_rates(self) -> None:
        self.assertEqual(tc.ETRADE_TRUSTEE_MARGINAL_WITHHOLD, 0.62)
        self.assertEqual(tc.ETRADE_TRUSTEE_CAPITAL_WITHHOLD, 0.28)


if __name__ == "__main__":
    unittest.main()
