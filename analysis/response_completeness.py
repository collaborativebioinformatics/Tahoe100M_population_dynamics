"""Baseline utilities for condition-level response-completeness analysis.

These functions operate on an already defined one-dimensional per-cell response
score. They do not select genes, normalize counts, or infer a biological state.
Those choices must be frozen using development data before validation.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from math import sqrt
from statistics import NormalDist
from typing import Iterable

import numpy as np


def _finite_1d(values: Iterable[float], name: str) -> np.ndarray:
    x = np.asarray(list(values) if not isinstance(values, np.ndarray) else values, dtype=float)
    if x.ndim != 1:
        raise ValueError(f"{name} must be one-dimensional")
    x = x[np.isfinite(x)]
    if x.size == 0:
        raise ValueError(f"{name} contains no finite values")
    return x


def mad(values: Iterable[float]) -> float:
    """Return the unscaled median absolute deviation."""
    x = _finite_1d(values, "values")
    center = np.median(x)
    return float(np.median(np.abs(x - center)))


def robust_shift(treated: Iterable[float], control: Iterable[float]) -> float:
    """Median shift standardized by 1.4826 × control MAD.

    Returns NaN when control dispersion is zero; callers should flag the
    condition rather than replacing the undefined value with zero.
    """
    t = _finite_1d(treated, "treated")
    c = _finite_1d(control, "control")
    scale = 1.4826 * mad(c)
    if scale == 0:
        return float("nan")
    return float((np.median(t) - np.median(c)) / scale)


def dmso_reference_interval(
    calibration_control: Iterable[float], alpha: float = 0.05
) -> tuple[float, float]:
    """Central (1-alpha) empirical DMSO reference interval."""
    if not 0 < alpha < 1:
        raise ValueError("alpha must lie strictly between 0 and 1")
    c = _finite_1d(calibration_control, "calibration_control")
    low, high = np.quantile(c, [alpha / 2, 1 - alpha / 2])
    return float(low), float(high)


def wilson_interval(
    successes: int,
    total: int,
    *,
    confidence_level: float = 0.95,
) -> tuple[float, float]:
    """Wilson score interval for a binomial proportion."""
    if not 0 < confidence_level < 1:
        raise ValueError("confidence_level must lie strictly between 0 and 1")
    z = NormalDist().inv_cdf(0.5 + confidence_level / 2)
    if total <= 0:
        raise ValueError("total must be positive")
    if not 0 <= successes <= total:
        raise ValueError("successes must be between zero and total")
    p = successes / total
    denom = 1 + z * z / total
    center = (p + z * z / (2 * total)) / denom
    half = z * sqrt((p * (1 - p) + z * z / (4 * total)) / total) / denom
    return max(0.0, center - half) if successes else 0.0, min(1.0, center + half)


def reference_membership(
    scores: Iterable[float], reference_interval: tuple[float, float]
) -> np.ndarray:
    """Boolean indicator that each finite score lies in the DMSO region."""
    x = _finite_1d(scores, "scores")
    low, high = reference_interval
    if not np.isfinite(low) or not np.isfinite(high) or low > high:
        raise ValueError("reference_interval must contain finite ordered bounds")
    return (x >= low) & (x <= high)


@dataclass(frozen=True)
class CompletenessResult:
    n_treated: int
    n_control: int
    response_magnitude: float
    residual_fraction: float
    residual_ci_low: float
    residual_ci_high: float
    response_coverage: float
    coverage_ci_low: float
    coverage_ci_high: float
    dispersion_ratio: float
    dmso_reference_low: float
    dmso_reference_high: float
    alpha: float
    confidence_level: float
    warning: str | None

    def to_dict(self) -> dict:
        return asdict(self)


def summarize_condition(
    treated_scores: Iterable[float],
    matched_control_scores: Iterable[float],
    calibration_control_scores: Iterable[float],
    alpha: float = 0.05,
    confidence_level: float = 0.95,
    reference_interval: tuple[float, float] | None = None,
) -> CompletenessResult:
    """Compute baseline magnitude, coverage, and dispersion estimands.

    `calibration_control_scores` should come from a prespecified DMSO
    calibration sample. Use a distinct DMSO sample for negative-control
    evaluation whenever the experimental design permits.
    """
    t = _finite_1d(treated_scores, "treated_scores")
    c = _finite_1d(matched_control_scores, "matched_control_scores")
    ref = (
        dmso_reference_interval(calibration_control_scores, alpha=alpha)
        if reference_interval is None
        else tuple(map(float, reference_interval))
    )
    # Validate externally frozen intervals through the same membership helper.
    reference_membership(np.asarray([ref[0], ref[1]]), ref)

    inside = reference_membership(t, ref)
    n_inside = int(inside.sum())
    residual = n_inside / t.size
    residual_ci = wilson_interval(n_inside, int(t.size), confidence_level=confidence_level)
    coverage = 1.0 - residual
    coverage_ci = (1.0 - residual_ci[1], 1.0 - residual_ci[0])

    control_mad = mad(c)
    treated_mad = mad(t)
    warning = None
    if control_mad == 0:
        dispersion = float("nan")
        warning = "Matched-control MAD is zero; standardized shift and dispersion ratio are undefined."
    else:
        dispersion = treated_mad / control_mad

    return CompletenessResult(
        n_treated=int(t.size),
        n_control=int(c.size),
        response_magnitude=robust_shift(t, c),
        residual_fraction=float(residual),
        residual_ci_low=float(residual_ci[0]),
        residual_ci_high=float(residual_ci[1]),
        response_coverage=float(coverage),
        coverage_ci_low=float(coverage_ci[0]),
        coverage_ci_high=float(coverage_ci[1]),
        dispersion_ratio=float(dispersion),
        dmso_reference_low=ref[0],
        dmso_reference_high=ref[1],
        alpha=float(alpha),
        confidence_level=float(confidence_level),
        warning=warning,
    )
