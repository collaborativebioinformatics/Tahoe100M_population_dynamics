# Interface data contract

The public website consumes compact result files, not the full Tahoe-100M
expression matrix. This keeps GitHub Pages fast and lets each analysis module
run independently on HPC infrastructure.

## Files

- `catalog.json` defines the selectable cell lines, drugs, doses, features, and
  analysis modules.
- `result-index.json` maps a normalized query key to a result file.
- `results/*.json` contains one standardized, precomputed analysis response.
- `../schemas/catalog.schema.json` and `../schemas/result.schema.json` define
  the versioned JSON contracts.

## Query key

Join these fields with `|` in this order:

```text
cell_line|drug|dose_um|feature|analysis
```

Example:

```text
A549|Trametinib|1|MAPK signaling|population
```

## Adding a team result

1. Export an aggregate result that follows `result.schema.json`.
2. Place it in `results/` with a lowercase, descriptive filename.
3. Add its normalized query key and file path to `result-index.json`.
4. Add new selector values to `catalog.json` when necessary.
5. Test with `python3 -m http.server 8000 --directory docs`.

If a query has no indexed result, the current prototype deliberately falls
back to a deterministic illustrative response and labels it as demo data.

Never publish the raw expression matrix, access credentials, controlled data,
or cell-level identifiers through this directory.
