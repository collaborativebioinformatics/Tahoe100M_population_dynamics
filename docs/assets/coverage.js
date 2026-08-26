/* Coverage & QC page. */
(function () {
  "use strict";
  var D = window.TahoeData;
  var el = function (id) { return document.getElementById(id); };
  function met(l, v, s) { return '<div class="metric"><span>' + l + '</span><strong>' + v + '</strong><small>' + (s || "") + '</small></div>'; }

  function table(id, head, rows) {
    el(id).querySelector("thead").innerHTML = "<tr>" + head.map(function (h) { return "<th" + (h.num ? " class='num'" : "") + ">" + h.label + "</th>"; }).join("") + "</tr>";
    el(id).querySelector("tbody").innerHTML = rows.map(function (r) {
      return "<tr>" + head.map(function (h) { return "<td" + (h.num ? " class='num'" : "") + ">" + r[h.key] + "</td>"; }).join("") + "</tr>";
    }).join("");
  }

  Promise.all([D.meta(), D.catalog()]).then(function (r) {
    var m = r[0], cat = r[1], v = m.validation || {};
    el("top-metrics").innerHTML =
      met("Conditions", (m.n_conditions || 0).toLocaleString(), "cell × drug × dose × plate") +
      met("Cell lines", m.n_cell_lines, "") + met("Drugs", m.n_drugs, "") +
      met("Plates", m.n_plates, "") + met("Doses", (m.doses_uM || []).map(function (d) { return (+d) + "µM"; }).join(", "), "");

    el("val-metrics").innerHTML =
      met("Recall@1", pct(v.recall_at_1), "self recovered") +
      met("Recall@10", pct(v.recall_at_10), "") +
      met("Recall@50", pct(v.recall_at_50), "") +
      met("Reversal@10", pct(v.reversal_recall_at_10), "sign-flip recovered") +
      met("Sampled", (v.n_sampled || 0), "conditions, seed " + (v.seed || 42));
    var repMsg = "";
    if (v.replicate_median_topk_cosine != null) {
      repMsg = "Replicate plates agree far more than random pairs: median top-K cosine " +
        v.replicate_median_topk_cosine.toFixed(3) + " for replicates vs " +
        (v.random_median_topk_cosine != null ? v.random_median_topk_cosine.toFixed(3) : "—") + " for random pairs";
      if (v.replicate_gt_random_mannwhitney_p != null) repMsg += " (Mann–Whitney p=" + fmtP(v.replicate_gt_random_mannwhitney_p) + ")";
      repMsg += ". Higher is more reliable; this is a top-K signature agreement, not full-transcriptome.";
    }
    el("rep-note").textContent = repMsg;

    // dose table
    var doseCounts = {};
    cat.cell_lines; // ensure loaded
    // derive per-dose counts from catalog drugs/cells is not enough; use conditions.json lazily
    D.conditions().then(function (c) {
      var byDose = {}, byCell = {}, byDrug = {};
      c.list.forEach(function (x) {
        var d = (+x.concentration) + " " + x.concentration_unit;
        byDose[d] = (byDose[d] || 0) + 1;
        byCell[x.cell_line] = (byCell[x.cell_line] || 0) + 1;
        byDrug[x.drug] = (byDrug[x.drug] || 0) + 1;
      });
      table("dose-table", [{ label: "Dose", key: "d" }, { label: "Conditions", key: "n", num: true }],
        Object.keys(byDose).sort(function (a, b) { return parseFloat(a) - parseFloat(b); }).map(function (d) { return { d: d, n: byDose[d].toLocaleString() }; }));
      table("cell-table", [{ label: "Cell line", key: "d" }, { label: "Conditions", key: "n", num: true }],
        top(byCell, 15));
      table("drug-table", [{ label: "Drug", key: "d" }, { label: "Conditions", key: "n", num: true }],
        top(byDrug, 15));
    });
  }).catch(function () {
    el("top-metrics").innerHTML = '<div class="empty-state error">Could not load dataset from <code>' + D.base + "</code>.</div>";
  });

  function top(obj, n) {
    return Object.keys(obj).map(function (k) { return { d: k, n: obj[k] }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, n)
      .map(function (r) { return { d: r.d, n: r.n.toLocaleString() }; });
  }
  function pct(x) { return x == null ? "—" : (x * 100).toFixed(1) + "%"; }
  function fmtP(p) { return p < 1e-4 ? p.toExponential(1) : p.toFixed(4); }
})();
