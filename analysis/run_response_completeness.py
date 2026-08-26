#!/usr/bin/env python3
"""Batch response-completeness analysis for precomputed per-cell score tables.

The CLI consumes CSV or Parquet tables. It does not normalize expression or
learn the response representation. The score column must have been defined and
frozen on development data before plate-14 validation.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

try:
    from .response_completeness import summarize_condition
except ImportError:  # permits `python analysis/run_response_completeness.py`
    from response_completeness import summarize_condition


def _read_table(path: Path) -> pd.DataFrame:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(path)
    if suffix in {".parquet", ".pq"}:
        return pd.read_parquet(path)
    raise ValueError("Input must be CSV or Parquet")


def _require_columns(frame: pd.DataFrame, columns: list[str]) -> None:
    missing = sorted(set(columns) - set(frame.columns))
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")


def _json_number(value: float) -> float | None:
    value = float(value)
    return value if np.isfinite(value) else None


def _result_record(
    group_values: tuple[Any, ...],
    group_columns: list[str],
    result: Any,
    *,
    plate: str,
    calibration_sample: str,
    matched_control_sample: str,
    score_column: str,
    alpha: float,
) -> dict[str, Any]:
    record = dict(zip(group_columns, group_values, strict=True))
    metrics = result.to_dict()
    for key in ("response_magnitude", "dispersion_ratio"):
        metrics[key] = _json_number(metrics[key])
    record.update(metrics)
    record.update(
        {
            "plate": plate,
            "calibration_control_sample": calibration_sample,
            "matched_control_sample": matched_control_sample,
            "score_column": score_column,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "method": "response_completeness_baseline_v1",
            "is_demo": False,
            "alpha": alpha,
        }
    )
    return record


def analyze_table(
    frame: pd.DataFrame,
    *,
    plate: str,
    score_column: str,
    plate_column: str,
    sample_column: str,
    treatment_column: str,
    dmso_label: str,
    calibration_sample: str,
    matched_control_sample: str,
    group_columns: list[str],
    alpha: float,
    min_cells: int,
) -> tuple[pd.DataFrame, list[str]]:
    required = [
        score_column,
        plate_column,
        sample_column,
        treatment_column,
        *group_columns,
    ]
    _require_columns(frame, required)
    current = frame.loc[frame[plate_column].astype(str) == str(plate)].copy()
    current[score_column] = pd.to_numeric(current[score_column], errors="coerce")
    current = current.loc[current[score_column].notna()]
    if current.empty:
        raise ValueError(f"No finite scores found for plate {plate!r}")

    controls = current.loc[current[treatment_column].astype(str) == dmso_label]
    calibration = controls.loc[controls[sample_column].astype(str) == calibration_sample, score_column]
    matched = controls.loc[controls[sample_column].astype(str) == matched_control_sample, score_column]
    if len(calibration) < min_cells:
        raise ValueError(
            f"Calibration DMSO sample {calibration_sample!r} has {len(calibration)} cells; "
            f"minimum is {min_cells}"
        )
    if len(matched) < min_cells:
        raise ValueError(
            f"Matched DMSO sample {matched_control_sample!r} has {len(matched)} cells; "
            f"minimum is {min_cells}"
        )

    treated = current.loc[current[treatment_column].astype(str) != dmso_label]
    records: list[dict[str, Any]] = []
    warnings: list[str] = []
    grouper = group_columns[0] if len(group_columns) == 1 else group_columns
    for raw_key, subset in treated.groupby(grouper, dropna=False, observed=True):
        group_values = raw_key if isinstance(raw_key, tuple) else (raw_key,)
        if len(subset) < min_cells:
            warnings.append(
                f"Skipped {dict(zip(group_columns, group_values, strict=True))}: "
                f"{len(subset)} treated cells < {min_cells}"
            )
            continue
        result = summarize_condition(
            treated_scores=subset[score_column].to_numpy(),
            matched_control_scores=matched.to_numpy(),
            calibration_control_scores=calibration.to_numpy(),
            alpha=alpha,
        )
        records.append(
            _result_record(
                group_values,
                group_columns,
                result,
                plate=str(plate),
                calibration_sample=calibration_sample,
                matched_control_sample=matched_control_sample,
                score_column=score_column,
                alpha=alpha,
            )
        )

    # Required DMSO-vs-DMSO negative control.
    negative = summarize_condition(
        treated_scores=matched.to_numpy(),
        matched_control_scores=calibration.to_numpy(),
        calibration_control_scores=calibration.to_numpy(),
        alpha=alpha,
    ).to_dict()
    negative = {key: (_json_number(value) if isinstance(value, (int, float)) else value) for key, value in negative.items()}
    for record in records:
        record["negative_control"] = negative
    return pd.DataFrame.from_records(records), warnings


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--plate", required=True)
    parser.add_argument("--score-column", default="response_score")
    parser.add_argument("--plate-column", default="plate")
    parser.add_argument("--sample-column", default="sample")
    parser.add_argument("--treatment-column", default="drug")
    parser.add_argument("--dmso-label", default="DMSO")
    parser.add_argument("--calibration-sample", required=True)
    parser.add_argument("--matched-control-sample", required=True)
    parser.add_argument(
        "--group-columns",
        nargs="+",
        default=["cell_line_id", "drug", "dose"],
        help="Columns defining each treated condition",
    )
    parser.add_argument("--alpha", type=float, default=0.05)
    parser.add_argument("--min-cells", type=int, default=30)
    parser.add_argument("--warnings-output", type=Path)
    args = parser.parse_args()

    frame = _read_table(args.input)
    results, warnings = analyze_table(
        frame,
        plate=args.plate,
        score_column=args.score_column,
        plate_column=args.plate_column,
        sample_column=args.sample_column,
        treatment_column=args.treatment_column,
        dmso_label=args.dmso_label,
        calibration_sample=args.calibration_sample,
        matched_control_sample=args.matched_control_sample,
        group_columns=args.group_columns,
        alpha=args.alpha,
        min_cells=args.min_cells,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    if args.output.suffix.lower() == ".csv":
        results.to_csv(args.output, index=False)
    else:
        results.to_json(args.output, orient="records", indent=2)
    if args.warnings_output:
        args.warnings_output.write_text(json.dumps(warnings, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(results)} condition results to {args.output}")
    if warnings:
        print(f"Skipped {len(warnings)} conditions; see warnings output if requested")


if __name__ == "__main__":
    main()
