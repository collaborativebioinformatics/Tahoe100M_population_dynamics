/* Explore — Module 1: drug×cell-line transcriptional response ranking. */
(function () {
  "use strict";
  var S = { mode: "drug", anchor: null, dose: null, best: false, data: null, catalog: null };
  var el = function (id) { return document.getElementById(id); };

  function readURL() {
    var q = new URLSearchParams(location.search);
    if (q.get("mode")) S.mode = q.get("mode");
    if (q.get("anchor")) S.anchor = q.get("anchor");
    if (q.get("dose")) S.dose = q.get("dose");
    if (q.get("best") === "1") S.best = true;
  }
  function writeURL() {
    var q = new URLSearchParams();
    q.set("mode", S.mode); if (S.anchor) q.set("anchor", S.anchor);
    if (S.dose) q.set("dose", S.dose); if (S.best) q.set("best", "1");
    history.replaceState(null, "", "?" + q.toString());
  }

  function setMode(m) {
    S.mode = m; S.best = false; el("best-dose").checked = false;
    el("mode-drug").setAttribute("aria-pressed", m === "drug");
    el("mode-cell").setAttribute("aria-pressed", m === "cell");
    el("anchor-label").textContent = m === "drug" ? "Drug" : "Cell line";
    fillAnchors();
  }

  function fillAnchors() {
    var items = (S.mode === "drug" ? S.catalog.drugs : S.catalog.cell_lines)
      .slice().sort(function (a, b) { return a.id.localeCompare(b.id); });
    var sel = el("anchor-select");
    sel.innerHTML = items.map(function (it) {
      var extra = S.mode === "drug" ? (it.target ? " · " + it.target : "") : (it.organ ? " · " + it.organ : "");
      return '<option value="' + it.id.replace(/"/g, "&quot;") + '">' + it.id + extra + "</option>";
    }).join("");
    if (S.anchor && items.some(function (i) { return i.id === S.anchor; })) sel.value = S.anchor;
    S.anchor = sel.value;
    load();
  }

  async function load() {
    var slug = window.TahoeData.slug(S.anchor);
    el("rank-empty").hidden = true;
    try {
      S.data = S.mode === "drug" ? await window.TahoeData.exploreDrug(slug)
                                 : await window.TahoeData.exploreCell(slug);
    } catch (e) { S.data = null; showEmpty("Not computed for this selection."); return; }
    fillDoses(); render();
  }

  function fillDoses() {
    var doses = Object.keys(S.data.doses).sort(function (a, b) {
      return parseFloat(a) - parseFloat(b);
    });
    var sel = el("dose-select");
    sel.innerHTML = doses.map(function (d) {
      var n = S.data.doses[d].length;
      return '<option value="' + d + '">' + d + " (" + n + " targets)</option>";
    }).join("");
    if (S.dose && doses.indexOf(S.dose) >= 0) sel.value = S.dose; else S.dose = doses[0];
    sel.value = S.dose;
    el("dose-select").disabled = S.best;
  }

  function bestObserved() {
    // per target, keep the row with max rms across all doses
    var best = {};
    Object.keys(S.data.doses).forEach(function (dk) {
      S.data.doses[dk].forEach(function (r) {
        var key = S.mode === "drug" ? r.cell_line : r.drug;
        if (!best[key] || r.rms > best[key].rms) {
          best[key] = Object.assign({}, r, { dose_key: dk });
        }
      });
    });
    return Object.keys(best).map(function (k) { return best[k]; })
      .sort(function (a, b) { return b.rms - a.rms; })
      .map(function (r, i) { return Object.assign({}, r, { rank: i + 1 }); });
  }

  function currentRows() {
    if (S.best) return bestObserved();
    return (S.data.doses[S.dose] || []).slice();
  }

  function showEmpty(msg) {
    el("rank-table").querySelector("tbody").innerHTML = "";
    el("rank-table").querySelector("thead").innerHTML = "";
    var e = el("rank-empty"); e.hidden = false; e.textContent = msg;
    el("summary-metrics").innerHTML = "";
  }

  function render() {
    writeURL();
    var rows = currentRows();
    if (!rows.length) { showEmpty("Not computed for this selection."); return; }
    var isDrug = S.mode === "drug";
    var targetCol = isDrug ? "Cell line" : "Drug";
    el("rank-title").textContent = isDrug
      ? "Cell lines ranked by response to " + S.anchor
      : "Drugs ranked by response in " + S.anchor;
    el("rank-note").textContent = S.best ? "best observed dose per target" :
      "dose " + S.dose + " · treated vs matched DMSO";

    // summary metrics
    var top = rows[0];
    var med = rows.map(function (r) { return r.rms; }).sort(function (a, b) { return a - b; });
    var median = med[Math.floor(med.length / 2)];
    el("summary-metrics").innerHTML = [
      metric("Targets ranked", rows.length, ""),
      metric("Strongest response", top.rms.toFixed(3), (isDrug ? top.cell_line : top.drug)),
      metric("Median RMS log2FC", median.toFixed(3), "across targets"),
      metric("Top significant genes", (top.n_sig || 0).toLocaleString(), "FDR<0.05, strongest target")
    ].join("");

    var head = "<tr><th>#</th><th>" + targetCol + "</th>" +
      (S.best ? "<th>Dose</th>" : "") +
      '<th class="num">RMS log2FC</th><th class="num">|log2FC| max</th>' +
      '<th class="num">Sig genes</th><th class="num">Up</th><th class="num">Down</th>' +
      "<th>Replicate</th><th>Links</th></tr>";
    el("rank-table").querySelector("thead").innerHTML = head;
    var maxRms = rows[0].rms || 1;
    var body = rows.map(function (r) {
      var name = isDrug ? r.cell_line : r.drug;
      var extra = isDrug ? (r.organ || "") : (r.moa || "");
      var rep = window.TahoeData.repBadge(r.rep_rho, r.rep_cos);
      var barw = Math.max(2, Math.round(100 * r.rms / maxRms));
      return "<tr>" +
        "<td>" + r.rank + "</td>" +
        "<td><b>" + name + "</b>" + (extra ? '<br><span class="muted" style="font-size:11px">' + extra + "</span>" : "") + "</td>" +
        (S.best ? "<td>" + r.dose_key + "</td>" : "") +
        '<td class="num bar-cell"><span class="bar" style="width:' + barw + '%"></span><span class="val">' + r.rms.toFixed(3) + "</span></td>" +
        '<td class="num">' + (r.respL2 != null ? "" : "") + (r.max_abs != null ? r.max_abs.toFixed(2) : "—") + "</td>" +
        '<td class="num">' + (r.n_sig || 0).toLocaleString() + "</td>" +
        '<td class="num">' + (r.n_up || 0) + "</td>" +
        '<td class="num">' + (r.n_down || 0) + "</td>" +
        '<td><span class="badge ' + rep.cls + '">' + rep.label + "</span></td>" +
        "<td>" + links(r, isDrug) + "</td>" +
        "</tr>";
    }).join("");
    el("rank-table").querySelector("tbody").innerHTML = body;
  }

  function links(r, isDrug) {
    var out = [];
    out.push('<a href="compare.html?a=' + encodeURIComponent(r.condition_id) + '" title="Open in Compare">compare ↗</a>');
    return out.join(" · ");
  }
  function metric(label, val, sub) {
    return '<div class="metric"><span>' + label + "</span><strong>" + val + "</strong><small>" + (sub || "") + "</small></div>";
  }

  function toCSV(rows, isDrug) {
    var cols = ["rank", isDrug ? "cell_line" : "drug", "dose_key", "rms_log2fc_robust",
      "response_magnitude_l2", "max_abs_log2fc", "n_sig", "n_up", "n_down", "condition_id"];
    var lines = [cols.join(",")];
    rows.forEach(function (r) {
      lines.push([r.rank, (isDrug ? r.cell_line : r.drug), (r.dose_key || S.dose),
        r.rms, r.respL2, r.max_abs, r.n_sig, r.n_up, r.n_down, r.condition_id].join(","));
    });
    return lines.join("\n");
  }

  function download(name, text, type) {
    var blob = new Blob([text], { type: type || "text/plain" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  async function init() {
    readURL();
    try {
      S.catalog = await window.TahoeData.catalog();
    } catch (e) {
      document.querySelector(".tool-grid").innerHTML =
        '<div class="empty-state error">Could not load dataset from <code>' + window.TahoeData.base +
        "</code>. Configure the data base URL (see Methods → Deployment).</div>";
      return;
    }
    el("mode-drug").onclick = function () { setMode("drug"); };
    el("mode-cell").onclick = function () { setMode("cell"); };
    el("anchor-select").onchange = function () { S.anchor = this.value; load(); };
    el("dose-select").onchange = function () { S.dose = this.value; render(); };
    el("best-dose").onchange = function () { S.best = this.checked; fillDoses(); render(); };
    el("share-btn").onclick = function () {
      writeURL(); navigator.clipboard && navigator.clipboard.writeText(location.href);
      el("share-btn").textContent = "Link copied"; setTimeout(function () { el("share-btn").textContent = "Share link"; }, 1500);
    };
    el("csv-btn").onclick = function () {
      download("tahoe_ranking_" + window.TahoeData.slug(S.anchor) + ".csv", toCSV(currentRows(), S.mode === "drug"), "text/csv");
    };
    setMode(S.mode);
  }
  function cidKey(x) { return x.cond_idx; }
  document.addEventListener("DOMContentLoaded", init);
})();
