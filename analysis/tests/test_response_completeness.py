import math

import numpy as np
import pandas as pd
import pytest

from analysis.response_completeness import (
    dmso_reference_interval,
    robust_shift,
    summarize_condition,
    wilson_interval,
)
from analysis.run_response_completeness import analyze_table


def test_reference_interval_and_wilson_bounds():
    assert dmso_reference_interval([0, 1, 2, 3, 4], alpha=0.2) == pytest.approx((0.4, 3.6))
    low, high = wilson_interval(0, 10, confidence_level=0.95)
    assert low == 0.0
    assert 0 < high < 1
    with pytest.raises(ValueError, match="confidence_level"):
        wilson_interval(1, 10, confidence_level=1.0)


def test_summarize_condition_known_values():
    result = summarize_condition(
        treated_scores=[0, 1, 5, 6],
        matched_control_scores=[0, 1, 2, 3, 4],
        calibration_control_scores=[0, 1, 2, 3, 4],
        alpha=0.2,
    )
    assert result.n_treated == 4
    assert result.residual_fraction == pytest.approx(0.25)
    assert result.response_coverage == pytest.approx(0.75)
    assert result.dispersion_ratio == pytest.approx(2.5)
    assert result.residual_ci_low <= result.residual_fraction <= result.residual_ci_high
    assert result.coverage_ci_low <= result.response_coverage <= result.coverage_ci_high


def test_zero_control_dispersion_is_flagged():
    result = summarize_condition([1, 2, 3], [1, 1, 1], [0, 1, 2])
    assert math.isnan(result.response_magnitude)
    assert math.isnan(result.dispersion_ratio)
    assert result.warning is not None


def test_batch_analysis_emits_negative_control():
    frame = pd.DataFrame(
        {
            "plate": ["plate6"] * 12,
            "sample": ["dmso_a"] * 4 + ["dmso_b"] * 4 + ["drug_sample"] * 4,
            "drug": ["DMSO"] * 8 + ["DrugX"] * 4,
            "cell_line_id": ["CL1"] * 12,
            "dose": [0.0] * 8 + [1.0] * 4,
            "response_score": [0, 1, 2, 3, 0.2, 1.2, 2.2, 3.2, 4, 5, 6, 7],
        }
    )
    results, warnings = analyze_table(
        frame,
        plate="plate6",
        score_column="response_score",
        plate_column="plate",
        sample_column="sample",
        treatment_column="drug",
        dmso_label="DMSO",
        calibration_sample="dmso_a",
        matched_control_sample="dmso_b",
        group_columns=["cell_line_id", "drug", "dose"],
        alpha=0.2,
        min_cells=3,
    )
    assert warnings == []
    assert len(results) == 1
    assert results.loc[0, "is_demo"] == False  # noqa: E712
    assert isinstance(results.loc[0, "negative_control"], dict)
    assert results.loc[0, "n_treated"] == 4


def test_batch_rejects_missing_columns():
    with pytest.raises(ValueError, match="Missing required columns"):
        analyze_table(
            pd.DataFrame({"plate": ["plate6"]}),
            plate="plate6",
            score_column="response_score",
            plate_column="plate",
            sample_column="sample",
            treatment_column="drug",
            dmso_label="DMSO",
            calibration_sample="a",
            matched_control_sample="b",
            group_columns=["cell_line_id", "drug", "dose"],
            alpha=0.05,
            min_cells=3,
        )


def test_summarize_condition_honors_frozen_reference_interval():
    result = summarize_condition(
        treated_scores=[0, 1, 2, 3],
        matched_control_scores=[0, 1, 2, 3],
        calibration_control_scores=[100, 101, 102, 103],
        alpha=0.05,
        reference_interval=(0.5, 2.5),
    )
    assert result.dmso_reference_low == pytest.approx(0.5)
    assert result.dmso_reference_high == pytest.approx(2.5)
    assert result.residual_fraction == pytest.approx(0.5)
