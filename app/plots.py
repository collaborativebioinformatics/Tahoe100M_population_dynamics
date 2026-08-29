"""Plotly figures for the Tahoe-100M public UI Explore tab.

All functions take plain pandas DataFrames (from ``app.data_loader`` /
``app.statistics``) and return ``plotly.graph_objects.Figure`` objects, so they
can be rendered with ``st.plotly_chart`` or exported/tested headlessly.
"""
from __future__ import annotations

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

# A restrained, color-blind-safe palette (up = warm, down = cool, neutral grey).
UP_COLOR = "#C2453B"
DOWN_COLOR = "#3E6D9C"
NEUTRAL = "#7A7F87"


def _empty(msg: str) -> go.Figure:
    fig = go.Figure()
    fig.add_annotation(text=msg, showarrow=False,
                       xref="paper", yref="paper", x=0.5, y=0.5,
                       font=dict(size=14, color=NEUTRAL))
    fig.update_layout(xaxis=dict(visible=False), yaxis=dict(visible=False),
                      template="simple_white", height=300)
    return fig


def sig_deg_bar(summary: pd.DataFrame, *, label_col="drug",
                top: int = 20) -> go.Figure:
    """Bar chart of significant-DEG counts per condition (top by count)."""
    if summary.empty or "n_sig" not in summary.columns:
        return _empty("No significant-DEG counts available")
    df = summary.copy()
    df["label"] = (df[label_col].astype(str)
                   + "  ·  " + df.get("cell_line", "").astype(str)
                   + " (plate " + df.get("plate", "").astype(str) + ")")
    df = df.sort_values("n_sig", ascending=False).head(top)
    fig = px.bar(df, x="n_sig", y="label", orientation="h",
                 labels={"n_sig": "Significant DE genes (padj ≤ 0.05)",
                         "label": ""},
                 color_discrete_sequence=[DOWN_COLOR])
    fig.update_layout(template="simple_white", height=max(300, 26 * len(df)),
                      yaxis=dict(autorange="reversed"), margin=dict(l=10, r=10))
    return fig


def up_down_bar(summary: pd.DataFrame, *, label_col="drug",
                top: int = 20) -> go.Figure:
    """Grouped up- vs down-regulated significant-gene counts per condition."""
    if summary.empty or not {"n_up", "n_down"}.issubset(summary.columns):
        return _empty("No up/down counts available")
    df = summary.copy()
    df["label"] = (df[label_col].astype(str)
                   + "  ·  " + df.get("cell_line", "").astype(str)
                   + " (plate " + df.get("plate", "").astype(str) + ")")
    df["total"] = df["n_up"] + df["n_down"]
    df = df.sort_values("total", ascending=False).head(top)
    fig = go.Figure()
    fig.add_bar(y=df["label"], x=df["n_up"], name="Up", orientation="h",
                marker_color=UP_COLOR)
    fig.add_bar(y=df["label"], x=-df["n_down"], name="Down", orientation="h",
                marker_color=DOWN_COLOR)
    fig.update_layout(template="simple_white", barmode="relative",
                      height=max(300, 26 * len(df)),
                      xaxis_title="← down    significant genes    up →",
                      yaxis=dict(autorange="reversed"), margin=dict(l=10, r=10))
    return fig


def top_genes_bar(top_genes: pd.DataFrame, *, n: int = 25) -> go.Figure:
    """Diverging bar of the top up/down genes by log2 fold change."""
    if top_genes.empty or "log2FoldChange" not in top_genes.columns:
        return _empty("No top DE genes for this condition")
    df = top_genes.copy()
    up = df[df.get("direction") == "up"].nlargest(n, "log2FoldChange")
    down = df[df.get("direction") == "down"].nsmallest(n, "log2FoldChange")
    df = pd.concat([down, up]).sort_values("log2FoldChange")
    colors = [UP_COLOR if v > 0 else DOWN_COLOR for v in df["log2FoldChange"]]
    fig = go.Figure(go.Bar(
        x=df["log2FoldChange"], y=df["gene_name"], orientation="h",
        marker_color=colors,
        customdata=df[["padj", "baseMean"]].to_numpy() if "padj" in df else None,
        hovertemplate=("%{y}<br>log2FC=%{x:.2f}"
                       + ("<br>padj=%{customdata[0]:.2e}"
                          "<br>baseMean=%{customdata[1]:.1f}"
                          if "padj" in df else "") + "<extra></extra>"),
    ))
    fig.update_layout(template="simple_white", height=max(320, 16 * len(df)),
                      xaxis_title="log2 fold change (treated vs DMSO)",
                      yaxis_title="", margin=dict(l=10, r=10))
    return fig


def dose_response(dose_df: pd.DataFrame, *, metric="n_sig") -> go.Figure:
    """Significant-DEG counts vs concentration (one line per plate)."""
    if dose_df.empty or metric not in dose_df.columns:
        return _empty("No multi-dose data for this cell line × drug")
    unit = ""
    if "concentration_unit" in dose_df.columns and not dose_df.empty:
        unit = str(dose_df["concentration_unit"].dropna().iloc[0]) \
            if dose_df["concentration_unit"].notna().any() else ""
    fig = px.line(dose_df.sort_values("concentration"),
                  x="concentration", y=metric,
                  color="plate" if "plate" in dose_df.columns else None,
                  markers=True,
                  labels={"concentration": f"Concentration ({unit})",
                          metric: metric})
    fig.update_layout(template="simple_white", height=380, margin=dict(l=10, r=10))
    return fig


def replicate_scatter(rep_df: pd.DataFrame, *, metric="n_sig",
                      plate_a="6", plate_b="14") -> go.Figure:
    """Concordance scatter of a metric between two replicate plates."""
    xa, xb = f"{metric}_{plate_a}", f"{metric}_{plate_b}"
    if rep_df.empty or xa not in rep_df.columns or xb not in rep_df.columns:
        return _empty(f"No shared conditions between plates {plate_a} and {plate_b}")
    fig = px.scatter(rep_df, x=xa, y=xb,
                     hover_data=[c for c in ("cell_line", "drug", "concentration")
                                 if c in rep_df.columns],
                     labels={xa: f"plate {plate_a}: {metric}",
                             xb: f"plate {plate_b}: {metric}"},
                     color_discrete_sequence=[NEUTRAL])
    lim = float(pd.concat([rep_df[xa], rep_df[xb]]).max() or 1)
    fig.add_trace(go.Scatter(x=[0, lim], y=[0, lim], mode="lines",
                             line=dict(dash="dash", color=UP_COLOR),
                             name="y = x", showlegend=True))
    fig.update_layout(template="simple_white", height=460, margin=dict(l=10, r=10))
    return fig
