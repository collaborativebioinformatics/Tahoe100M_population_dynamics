"""Tests for app.data_loader against the committed demo dataset."""
from app import data_loader as dl

COND_COLS = {
    "plate", "cell_line", "cellosaurus_id", "depmap_id", "drug",
    "concentration", "concentration_unit", "n_treatment_cells",
    "n_control_cells", "n_genes_tested", "n_sig", "n_up", "n_down",
    "median_abs_sig_log2fc", "max_abs_sig_log2fc",
}
TOP_COLS = {
    "gene_name", "baseMean", "log2FoldChange", "lfcSE", "stat", "pvalue",
    "padj", "plate", "cell_line", "cellosaurus_id", "depmap_id", "drug",
    "concentration", "concentration_unit", "n_treatment_cells",
    "n_control_cells", "direction",
}


def test_resolve_falls_back_to_demo():
    data_dir, is_demo = dl.resolve_data_dir()
    assert is_demo is True
    assert data_dir == dl.DEMO_DIR


def test_condition_summary_schema(conditions):
    assert not conditions.empty, "demo condition_summary should have rows"
    assert COND_COLS.issubset(conditions.columns)


def test_top_genes_schema(top_genes):
    assert not top_genes.empty, "demo top_de_genes should have rows"
    assert TOP_COLS.issubset(top_genes.columns)
    assert set(top_genes["direction"].unique()).issubset({"up", "down"})


def test_counts_are_consistent(conditions):
    # up + down significant counts must never exceed the total significant count
    assert (conditions["n_up"] + conditions["n_down"] <= conditions["n_sig"]).all()
    assert (conditions["n_sig"] <= conditions["n_genes_tested"]).all()


def test_list_and_filter(conditions):
    drugs = dl.list_values(conditions, "drug")
    assert drugs, "expected at least one drug in demo"
    one = dl.filter_conditions(conditions, drug=drugs[0])
    assert (one["drug"] == drugs[0]).all()


def test_missing_metadata_returns_empty():
    # demo may or may not ship every metadata table; loader must not raise
    for name in ("drug", "cell_line", "sample", "gene"):
        df = dl.load_metadata(name)
        assert df is not None
