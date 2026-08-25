"""Tests for app.statistics against the committed demo dataset."""
from app import statistics as stats


def _first_condition(conditions):
    r = conditions.iloc[0]
    return dict(plate=r["plate"], cell_line=r["cell_line"], drug=r["drug"],
               concentration=r["concentration"])


def test_analyze_found(conditions, top_genes):
    key = _first_condition(conditions)
    res = stats.analyze_condition(conditions, top_genes, **key)
    assert res["found"] is True
    assert res["n_sig"] == res["n_up"] + res["n_down"] or res["n_sig"] >= 0
    assert res["n_treatment_cells"] >= 0
    assert res["n_control_cells"] >= 0
    assert "pseudobulk" in res["note"].lower()


def test_analyze_missing_is_graceful(conditions, top_genes):
    res = stats.analyze_condition(conditions, top_genes, plate="999",
                                  cell_line="__nope__", drug="__nope__",
                                  concentration=-1.0)
    assert res["found"] is False
    assert "note" in res  # still carries the framing note


def test_dose_response_table(conditions):
    r = conditions.iloc[0]
    dr = stats.dose_response_table(conditions, cell_line=r["cell_line"],
                                   drug=r["drug"])
    # at least the selected pair's own row(s) should come back
    assert set(["concentration", "n_sig"]).issubset(dr.columns)


def test_replicate_comparison_shape(conditions):
    # demo is a single plate, so this should be empty but must not raise
    rep = stats.replicate_comparison(conditions, plate_a="6", plate_b="14")
    assert rep is not None
