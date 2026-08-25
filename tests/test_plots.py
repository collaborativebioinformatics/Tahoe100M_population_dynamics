"""Tests for app.plots — every figure builder must return a Plotly Figure and
must degrade gracefully on empty input."""
import pandas as pd
import plotly.graph_objects as go

from app import plots
from app import statistics as stats


def test_sig_deg_bar(conditions):
    fig = plots.sig_deg_bar(conditions, label_col="drug")
    assert isinstance(fig, go.Figure)


def test_up_down_bar(conditions):
    fig = plots.up_down_bar(conditions, label_col="drug")
    assert isinstance(fig, go.Figure)


def test_top_genes_bar(top_genes):
    fig = plots.top_genes_bar(top_genes)
    assert isinstance(fig, go.Figure)


def test_empty_inputs_do_not_raise():
    empty = pd.DataFrame()
    assert isinstance(plots.sig_deg_bar(empty), go.Figure)
    assert isinstance(plots.up_down_bar(empty), go.Figure)
    assert isinstance(plots.top_genes_bar(empty), go.Figure)
    assert isinstance(plots.dose_response(empty), go.Figure)
    assert isinstance(plots.replicate_scatter(empty), go.Figure)


def test_dose_response_with_data(conditions):
    r = conditions.iloc[0]
    dr = stats.dose_response_table(conditions, cell_line=r["cell_line"],
                                   drug=r["drug"])
    assert isinstance(plots.dose_response(dr), go.Figure)
