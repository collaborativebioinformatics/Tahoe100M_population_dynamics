"""Tahoe-100M Explorer — a public interface to precomputed drug-perturbation
differential expression (Group 6 hackathon project).

Run locally:
    export TAHOE_WEB_DATA_DIR=/path/to/web_data   # optional; else uses data/demo
    streamlit run streamlit_app.py

The app reads only small precomputed pseudobulk DE tables (condition summaries
and top DE genes). It never loads the 100M-cell expression matrix or the ~89 GB
DE dataset.

The UI is built inside ``main()``, guarded by ``if __name__ == "__main__"``.
Streamlit runs the script as ``__main__`` so the app renders normally, while
``import streamlit_app`` stays side-effect-free for tests.
"""
from __future__ import annotations

import pandas as pd
import streamlit as st

from app import DATASET_URL, GROUP, MVP_PLATES, __version__
from app import data_loader as dl
from app import plots
from app import statistics as stats


# --------------------------------------------------------------------------- #
# Cached data access (compact tables only)
# --------------------------------------------------------------------------- #
@st.cache_data(show_spinner=False)
def load_data() -> dict:
    data_dir, is_demo = dl.resolve_data_dir()
    return {
        "dir": str(data_dir),
        "is_demo": is_demo,
        "conditions": dl.load_condition_summary(data_dir),
        "top_genes": dl.load_top_de_genes(data_dir),
        "drug_meta": dl.load_metadata("drug", data_dir),
        "cell_meta": dl.load_metadata("cell_line", data_dir),
        "sample_meta": dl.load_metadata("sample", data_dir),
        "gene_meta": dl.load_metadata("gene", data_dir),
    }


def _pubchem_link(cid) -> str:
    if cid is None or (isinstance(cid, float) and pd.isna(cid)):
        return "—"
    cid = int(cid) if float(cid).is_integer() else cid
    return f"[PubChem CID {cid}](https://pubchem.ncbi.nlm.nih.gov/compound/{cid})"


def _cellosaurus_link(cid) -> str:
    if not cid or pd.isna(cid):
        return "—"
    return f"[{cid}](https://www.cellosaurus.org/{cid})"


def _depmap_link(cid) -> str:
    if not cid or pd.isna(cid):
        return "—"
    return f"[{cid}](https://depmap.org/portal/cell_line/{cid})"


def _header(D: dict, conditions: pd.DataFrame) -> None:
    st.title("🧫 Tahoe-100M Explorer")
    st.caption(
        f"{GROUP} · Tahoe-100M hackathon · a public window into "
        f"drug-perturbation differential expression · [dataset]({DATASET_URL})"
    )
    if D["is_demo"]:
        st.warning(
            "**Demo mode** — showing a tiny bundled sample so the app runs "
            "without the full download. Set `TAHOE_WEB_DATA_DIR` to the Argon "
            "build output for the full plates 6/14 MVP.",
            icon="🧪",
        )
    with st.sidebar:
        st.header("About")
        st.markdown(
            "This tool lets non-bioinformaticians browse the **Tahoe-100M** "
            "drug screen: ~50 cancer cell lines × ~379 drugs, profiled by "
            "single-cell RNA-seq. We summarise **precomputed pseudobulk "
            "differential expression** (treated vs DMSO control) into compact, "
            "queryable tables."
        )
        st.markdown(f"**MVP scope:** replicate plates {', '.join(MVP_PLATES)}.")
        st.info(stats.PRECOMPUTED_NOTE, icon="ℹ️")
        st.caption(f"app v{__version__} · data: `{D['dir']}`")


def _tab_explore(D: dict, conditions: pd.DataFrame) -> None:
    st.subheader("Browse the screen")
    c1, c2, c3 = st.columns(3)
    browse_by = c1.radio("Browse by", ["Drug", "Cell line"], horizontal=True)
    plates = dl.list_values(conditions, "plate")
    plate_sel = c2.multiselect("Plate", plates, default=plates)
    view = conditions[conditions["plate"].isin(plate_sel)] if plate_sel else conditions

    if browse_by == "Drug":
        drugs = dl.list_values(view, "drug")
        pick = c3.selectbox("Drug", drugs) if drugs else None
        view = view[view["drug"] == pick] if pick else view
    else:
        cells = dl.list_values(view, "cell_line")
        pick = c3.selectbox("Cell line", cells) if cells else None
        view = view[view["cell_line"] == pick] if pick else view

    doses = dl.list_values(view, "concentration")
    if doses:
        dsel = st.multiselect("Concentration", doses, default=doses)
        if dsel:
            view = view[view["concentration"].isin(dsel)]

    st.markdown(f"**{len(view)} condition(s)** match your selection.")
    label_col = "cell_line" if browse_by == "Drug" else "drug"

    g1, g2 = st.columns(2)
    g1.markdown("**Significant DE genes per condition**")
    g1.plotly_chart(plots.sig_deg_bar(view, label_col=label_col),
                    use_container_width=True)
    g2.markdown("**Up- vs down-regulated genes**")
    g2.plotly_chart(plots.up_down_bar(view, label_col=label_col),
                    use_container_width=True)

    if pick is not None:
        st.markdown("**Dose response**")
        if browse_by == "Drug":
            cl_opts = dl.list_values(view, "cell_line")
            cl = st.selectbox("Cell line for dose-response", cl_opts) if cl_opts else None
            dr = stats.dose_response_table(conditions, cell_line=cl, drug=pick) if cl else pd.DataFrame()
        else:
            dr_opts = dl.list_values(view, "drug")
            dg = st.selectbox("Drug for dose-response", dr_opts) if dr_opts else None
            dr = stats.dose_response_table(conditions, cell_line=pick, drug=dg) if dg else pd.DataFrame()
        if len(dr) > 1:
            st.plotly_chart(plots.dose_response(dr), use_container_width=True)
        else:
            st.caption("Only one concentration available for this pair — no dose curve.")

    st.markdown("---")
    st.markdown("**Replicate concordance (plate 6 vs 14)**")
    rep = stats.replicate_comparison(conditions, plate_a="6", plate_b="14",
                                     metric="n_sig")
    if rep.empty:
        st.caption("Both replicate plates 6 and 14 are needed for this view "
                   "(not available in demo mode).")
    else:
        st.plotly_chart(plots.replicate_scatter(rep, metric="n_sig"),
                        use_container_width=True)

    with st.expander("Show matching conditions as a table"):
        st.dataframe(view, use_container_width=True, hide_index=True)


def _tab_stats(D: dict, conditions: pd.DataFrame) -> None:
    st.subheader("Precomputed DE for one condition")
    st.caption(stats.PRECOMPUTED_NOTE)

    s1, s2, s3, s4 = st.columns(4)
    drug = s1.selectbox("Drug", dl.list_values(conditions, "drug"), key="s_drug")
    sub = conditions[conditions["drug"] == drug] if drug else conditions
    cell = s2.selectbox("Cell line", dl.list_values(sub, "cell_line"), key="s_cell")
    sub2 = sub[sub["cell_line"] == cell] if cell else sub
    plate = s3.selectbox("Plate", dl.list_values(sub2, "plate"), key="s_plate")
    sub3 = sub2[sub2["plate"] == plate] if plate else sub2
    conc = s4.selectbox("Concentration", dl.list_values(sub3, "concentration"),
                        key="s_conc")

    if st.button("▶ Run statistical analysis", type="primary"):
        res = stats.analyze_condition(conditions, D["top_genes"], plate=plate,
                                      cell_line=cell, drug=drug, concentration=conc)
        if not res["found"]:
            st.info(res["message"])
        else:
            m = st.columns(4)
            m[0].metric("Significant genes", f"{res['n_sig']:,}",
                        help=f"padj ≤ {res['sig_padj']}")
            m[1].metric("Up-regulated", f"{res['n_up']:,}")
            m[2].metric("Down-regulated", f"{res['n_down']:,}")
            m[3].metric("Genes tested", f"{res['n_genes_tested']:,}")
            n = st.columns(4)
            n[0].metric("Treatment cells", f"{res['n_treatment_cells']:,}")
            n[1].metric("Control cells", f"{res['n_control_cells']:,}")
            mabs = res["median_abs_sig_log2fc"]
            xabs = res["max_abs_sig_log2fc"]
            n[2].metric("Median |log2FC| (sig)",
                        f"{mabs:.2f}" if mabs is not None else "—")
            n[3].metric("Max |log2FC| (sig)",
                        f"{xabs:.2f}" if xabs is not None else "—")

            st.markdown("**Top DE genes** (effect size, uncertainty, significance)")
            st.plotly_chart(plots.top_genes_bar(res["top_genes"]),
                            use_container_width=True)
            show_cols = ["gene_name", "direction", "log2FoldChange", "lfcSE",
                         "stat", "pvalue", "padj", "baseMean"]
            tg = res["top_genes"]
            st.dataframe(tg[[c for c in show_cols if c in tg.columns]],
                         use_container_width=True, hide_index=True)
            st.caption("`lfcSE` is the standard error of the log2 fold change — "
                       "the uncertainty on each effect size.")
    else:
        st.caption("Pick a drug, cell line, plate and dose, then run the analysis.")


def _tab_meta(D: dict, conditions: pd.DataFrame) -> None:
    st.subheader("Drug, cell-line & provenance metadata")

    mcol1, mcol2 = st.columns(2)
    with mcol1:
        st.markdown("### Drug")
        dmeta = D["drug_meta"]
        drug_m = st.selectbox("Drug", dl.list_values(conditions, "drug"),
                              key="m_drug")
        if not dmeta.empty and "drug" in dmeta.columns:
            r = dmeta[dmeta["drug"] == drug_m]
            if not r.empty:
                r = r.iloc[0]
                st.markdown(f"- **Targets:** {r.get('targets', '—')}")
                st.markdown(f"- **MOA (broad):** {r.get('moa-broad', '—')}")
                st.markdown(f"- **MOA (fine):** {r.get('moa-fine', '—')}")
                st.markdown(f"- **Human-approved:** {r.get('human-approved', '—')}")
                st.markdown(f"- **PubChem:** {_pubchem_link(r.get('pubchem_cid'))}")
            else:
                st.caption("No drug metadata row for this drug.")
        else:
            st.caption("Drug metadata table not loaded (not in demo).")

    with mcol2:
        st.markdown("### Cell line")
        cmeta = D["cell_meta"]
        cell_m = st.selectbox("Cell line", dl.list_values(conditions, "cell_line"),
                              key="m_cell")
        crow = conditions[conditions["cell_line"] == cell_m]
        cello = depmap = None
        if not crow.empty:
            cello = crow.iloc[0].get("cellosaurus_id")
            depmap = crow.iloc[0].get("depmap_id")
        st.markdown(f"- **Cellosaurus:** {_cellosaurus_link(cello)}")
        st.markdown(f"- **DepMap:** {_depmap_link(depmap)}")
        if not cmeta.empty and "cell_name" in cmeta.columns:
            r = cmeta[cmeta["cell_name"] == cell_m]
            if not r.empty:
                organ = r.iloc[0].get("Organ", "—")
                st.markdown(f"- **Organ:** {organ}")
                drivers = ", ".join(sorted(set(
                    str(x) for x in r.get("Driver_Gene_Symbol", pd.Series()).dropna())))
                st.markdown(f"- **Driver genes:** {drivers or '—'}")

    st.markdown("---")
    st.markdown("### Sample / provenance")
    smeta = D["sample_meta"]
    if not smeta.empty:
        st.caption("Per-sample QC and dose annotation from the Tahoe-100M release.")
        st.dataframe(smeta.head(200), use_container_width=True, hide_index=True)
    else:
        st.caption("Sample metadata table not loaded (not in demo).")
    st.markdown(
        f"Source dataset: [tahoebio/Tahoe-100M]({DATASET_URL}) · "
        "single-cell RNA-seq drug perturbation atlas. Cell counts are single "
        "cells; statistics are pseudobulk per condition."
    )


def main() -> None:
    st.set_page_config(page_title="Tahoe-100M Explorer", page_icon="🧫",
                       layout="wide")
    D = load_data()
    conditions = D["conditions"]
    _header(D, conditions)
    if conditions.empty:
        st.error("No condition data found. Build the web tables or check "
                 "`TAHOE_WEB_DATA_DIR`.")
        st.stop()
    tab_explore, tab_stats, tab_meta = st.tabs(
        ["🔎 Explore data", "📊 Statistical analysis", "🧬 Metadata"])
    with tab_explore:
        _tab_explore(D, conditions)
    with tab_stats:
        _tab_stats(D, conditions)
    with tab_meta:
        _tab_meta(D, conditions)


if __name__ == "__main__":
    main()
