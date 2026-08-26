<div align="center">

<h1>Tahoe-100M Perturbation Explorer</h1>

<p><strong>A public, dose-aware interface for population-level single-cell perturbation modeling.</strong></p>

<p>
  <a href="https://collaborativebioinformatics.github.io/Tahoe100M_population_dynamics/">
    <img alt="Launch live prototype" src="https://img.shields.io/badge/LAUNCH-LIVE%20PROTOTYPE-2563EB?style=for-the-badge&logo=githubpages&logoColor=white">
  </a>
  <img alt="Tahoe-100M" src="https://img.shields.io/badge/DATA-TAHOE--100M-0F766E?style=for-the-badge">
  <img alt="Prototype status" src="https://img.shields.io/badge/STATUS-INTERFACE%20PROTOTYPE-D97706?style=for-the-badge">
</p>

<p>Explore by drug or cell line, refine by dose and feature, launch a team analysis module, and inspect returned plots, tables, and linked metadata.</p>

</div>

> [!IMPORTANT]
> The public website currently uses deterministic **illustrative demo data**. It demonstrates the interface and integration contract; it does not present completed Tahoe-100M scientific results.

## Live interface

<div align="center">
  <a href="https://collaborativebioinformatics.github.io/Tahoe100M_population_dynamics/">
    <img src="docs/assets/dashboard-preview.png" alt="Tahoe-100M Perturbation Explorer dashboard preview" width="100%">
  </a>
  <p><a href="https://collaborativebioinformatics.github.io/Tahoe100M_population_dynamics/"><strong>Open the interactive prototype →</strong></a></p>
  <p><strong>Interface and website design by Xia (Candice) Wu.</strong></p>
</div>

The prototype is a static GitHub Pages site, so it needs no AWS account, paid hosting, or custom domain. The browser receives compact, precomputed result objects rather than the 100-million-cell expression matrix.

## What the interface supports

| Explore | Analyze | Interpret | Share |
|---|---|---|---|
| Browse by **drug** or **cell line** | Send the selected condition to an available analysis module | Compare dose-aware response patterns | View interactive plots and result tables |
| Filter by **dose**, **gene**, or **pathway** | Connect population statistics, PCA, and trajectory services | Inspect candidate residual non-responder populations | Follow linked drug, cell-line, and sample metadata |

## System workflow

![Tahoe-100M Group 6 system workflow](docs/group6-workflow.svg)

<div align="center">
  <a href="docs/group6-workflow.svg">Open full-size diagram</a> ·
  <a href="docs/group6-workflow.mmd">Edit Mermaid source</a> ·
  <a href="docs/group6-workflow.png">Download presentation PNG</a>
</div>

### Module responsibilities

| Module | Receives | Returns |
|---|---|---|
| **Public interface** | Drug, cell line, dose, gene, pathway, and requested analysis | Interactive views, linked metadata, result tables, and analysis requests |
| **Population statistics** | Selected condition and expression summaries | Effect size, heterogeneity, differential expression, uncertainty, and candidate non-responder signals |
| **PCA analysis** | Selected drug and cell-line condition | PCA coordinates and visualization |
| **Dose trajectory** | DMSO and available drug concentrations | Dose-aware transcriptional trajectory and plot |

The population-statistics module is specified in [`docs/RESPONSE_COMPLETENESS.md`](docs/RESPONSE_COMPLETENESS.md), with baseline utilities under [`analysis/`](analysis/).

## Integration contract

The UI is intentionally separated from heavy computation. Each team analysis can accept the same condition request and return a standardized result object.

```json
{
  "cell_line": "A549",
  "drug": "Trametinib",
  "dose_um": 1.0,
  "feature": "MAPK signaling",
  "analysis": "population"
}
```

This lets the interface switch from demo responses to HPC-generated JSON/Parquet summaries without redesigning the website.

Team-facing files are documented in the [`docs/data` integration guide](docs/data/README.md), with versioned [catalog](docs/schemas/catalog.schema.json) and [result](docs/schemas/result.schema.json) JSON schemas.

## Current scope

- [x] Responsive public interface prototype
- [x] Drug, cell-line, dose, feature, and analysis selectors
- [x] Interactive demo charts and linked metadata panel
- [x] Shareable query URLs and standardized JSON/CSV/SVG downloads
- [x] File-backed catalog and precomputed-result loading with demo fallback
- [x] Editable architecture diagram and presentation export
- [ ] Connect precomputed Tahoe-100M result artifacts
- [ ] Connect production PCA, trajectory, and population-statistics outputs
- [ ] Validate all displayed results against the final analysis pipeline

## Sources, citation, and downloads

| Resource | Link |
|---|---|
| Original Tahoe-100M paper | [Zhang et al., bioRxiv 2025](https://doi.org/10.1101/2025.02.20.639398) |
| Public expression data and metadata | [Tahoe-100M on Hugging Face](https://huggingface.co/datasets/tahoebio/Tahoe-100M) |
| Official h5ad / AnnData access | [Arc Virtual Cell Atlas](https://github.com/ArcInstitute/arc-virtual-cell-atlas/tree/main/tahoe-100M) |
| DNAnexus dataset and notebook guide | [DNAnexus Academy](https://academy.dnanexus.com/public-datasets-on-the-dnanexus-platform/single-cell/tahoe-100m) |
| Downloadable citation | [`docs/tahoe100m-citations.bib`](docs/tahoe100m-citations.bib) |
| Demo integration artifacts | [Catalog](docs/data/catalog.json) · [Example result](docs/data/results/a549-trametinib-1-mapk-population.json) · [Workflow SVG](docs/group6-workflow.svg) |

The Tahoe-100M data are distributed under [**CC0 1.0**](https://creativecommons.org/publicdomain/zero/1.0/); this repository's code is under the [**MIT License**](LICENSE). Please cite the original Tahoe-100M paper when using the dataset. Current website downloads are demo/integration artifacts, not validated scientific findings.

## Acknowledgements

This Group 6 prototype was developed during the [8th Pan-Structural Variation Hackathon in the Cloud](https://fritzsedlazeck.github.io/blog/2026/hackathon-2026/), held August 25–28, 2026. The event was hosted by Baylor College of Medicine and Rice University in collaboration with the GREGoR and SMAHT consortia.

We acknowledge the Tahoe-100M authors and the teams at Tahoe Bio/Tahoe Therapeutics, Parse Biosciences, and Ultima Genomics for generating the atlas; Arc Institute and Hugging Face for public data access; and DNAnexus for public-dataset and notebook resources used by hackathon participants. Organization names identify provenance and do not imply validation or endorsement of this prototype's scientific results.

## Group 6

| Team member | Current focus |
| :--- | :--- |
| **Don Baldwin** — Lead | Sequence-data access and project coordination |
| Abolaji Shiwoku | Statistical models for population dynamics |
| Anna Sokolova | Response-completeness scoring, DMSO calibration, QC checks, and plate 6/14 validation |
| Cecilia Mathó | PCA tool |
| Tuneer R. Mallick | Trajectory tool |
| Xia (Candice) Wu | Interface and website design |
| Gerald McCollum | Writing and documentation |

## Run locally

No build step is required.

```bash
python3 -m http.server 8000 --directory docs
```

Then open `http://localhost:8000`. The site is plain HTML, CSS, and JavaScript so it can be reviewed quickly and deployed anywhere.

## Research focus

> Can we identify residual cell subpopulations that may be non-responders to a perturbation?

## License

This project is available under the [MIT License](LICENSE).
