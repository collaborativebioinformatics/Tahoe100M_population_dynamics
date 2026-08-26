/* Compare — Module 2: two-condition comparison. */
(function () {
  "use strict";
  var D = window.TahoeData;
  var conds = null, byKey = {}, cellList = [], drugList = [];
  var sel = { A: { cell: null, drug: null, dose: null, idx: null }, B: { cell: null, drug: null, dose: null, idx: null } };
  var el = function (id) { return document.getElementById(id); };

  function condKey(c) { return c.cell_line + "|" + c.drug + "|" + (+c.concentration) + "|" + c.plate; }

  function buildIndex() {
    conds.list.forEach(function (c) {
      byKey[condKey(c)] = c;
      (byKey["cd|" + c.cell_line + "|" + c.drug] = byKey["cd|" + c.cell_line + "|" + c.drug] || []).push(c);
    });
    cellList = Array.from(new Set(conds.list.map(function (c) { return c.cell_line; }))).sort();
    drugList = Array.from(new Set(conds.list.map(function (c) { return c.drug; }))).sort();
  }

  function optionize(arr, val) {
    return arr.map(function (x) { return '<option value="' + String(x).replace(/"/g, "&quot;") + '"' + (String(x) === String(val) ? " selected" : "") + ">" + x + "</option>"; }).join("");
  }

  function dosesFor(cell, drug) {
    var arr = byKey["cd|" + cell + "|" + drug] || [];
    return arr.slice().sort(function (a, b) { return a.concentration - b.concentration || String(a.plate).localeCompare(String(b.plate)); });
  }

  function renderSelector(which) {
    var s = sel[which];
    var cell = s.cell || cellList[0];
    var drug = s.drug || (byKey["cd|" + cell + "|" + drugList[0]] ? drugList[0] : firstDrugFor(cell));
    var doseArr = dosesFor(cell, drug);
    var chosen = doseArr.find(function (d) { return String(d.cond_idx) === String(s.idx); }) || doseArr[0];
    s.cell = cell; s.drug = drug; s.idx = chosen ? chosen.cond_idx : null;
    var html =
      '<h2>Condition ' + which + '</h2>' +
      '<div class="field"><label>Cell line</label><select data-role="cell" data-w="' + which + '">' + optionize(cellList, cell) + '</select></div>' +
      '<div class="field"><label>Drug</label><select data-role="drug" data-w="' + which + '">' + optionize(drugsFor(cell), drug) + '</select></div>' +
      '<div class="field"><label>Dose · plate</label><select data-role="dose" data-w="' + which + '">' +
        doseArr.map(function (d) { return '<option value="' + d.cond_idx + '"' + (chosen && d.cond_idx === chosen.cond_idx ? " selected" : "") + ">" + (+d.concentration) + " " + d.concentration_unit + " · plate " + d.plate + "</option>"; }).join("") +
      '</select><span class="hint">' + (doseArr.length > 1 ? doseArr.length + " measured dose/plate combinations" : "single measured condition") + '</span></div>';
    el("sel" + which).innerHTML = html;
  }
  function drugsFor(cell) {
    return drugList.filter(function (d) { return byKey["cd|" + cell + "|" + d]; });
  }
  function firstDrugFor(cell) { return drugsFor(cell)[0]; }

  function bindSelectors() {
    document.querySelectorAll('select[data-role]').forEach(function (node) {
      node.onchange = function () {
        var w = node.getAttribute("data-w"), role = node.getAttribute("data-role");
        var s = sel[w];
        if (role === "cell") { s.cell = node.value; s.drug = firstDrugFor(s.cell); s.idx = null; renderSelector(w); bindSelectors(); }
        else if (role === "drug") { s.drug = node.value; s.idx = null; renderSelector(w); bindSelectors(); }
        else { s.idx = parseInt(node.value, 10); }
        update();
      };
    });
  }

  function readURL() {
    var q = new URLSearchParams(location.search);
    ["a", "b"].forEach(function (k) {
      var v = q.get(k); if (!v) return;
      var c = null;
      // accept condition_id string or cond_idx
      if (/^\d+$/.test(v) && conds.byIdx[+v]) c = conds.byIdx[+v];
      else c = byIdOrKey(v);
      if (c) { var w = k.toUpperCase(); sel[w] = { cell: c.cell_line, drug: c.drug, dose: c.concentration, idx: c.cond_idx }; }
    });
  }
  function byIdOrKey(v) {
    // condition_id "plate|depmap|drug|conc" -> find matching cond by depmap+drug+conc+plate
    var parts = String(v).split("|");
    if (parts.length === 4) {
      return conds.list.find(function (c) { return c.plate === parts[0] && c.depmap === parts[1] && c.drug === parts[2] && Math.abs(c.concentration - parseFloat(parts[3])) < 1e-6; });
    }
    return null;
  }

  function writeURL() {
    var q = new URLSearchParams();
    if (sel.A.idx != null) q.set("a", sel.A.idx);
    if (sel.B.idx != null) q.set("b", sel.B.idx);
    history.replaceState(null, "", "?" + q.toString());
  }

  function cosine(mapA, mapB) {
    var genes = {}; Object.keys(mapA).forEach(function (g) { genes[g] = 1; }); Object.keys(mapB).forEach(function (g) { genes[g] = 1; });
    var dot = 0, na = 0, nb = 0;
    Object.keys(genes).forEach(function (g) { var a = mapA[g] || 0, b = mapB[g] || 0; dot += a * b; na += a * a; nb += b * b; });
    return (na > 0 && nb > 0) ? dot / Math.sqrt(na * nb) : NaN;
  }

  function profileMaps(prof) {
    // returns {wn:{gene:signed wn}, lfc:{gene:signed log2fc}, up:Set, down:Set}
    var wn = {}, lfc = {}, up = {}, down = {};
    (prof.up || []).forEach(function (r) { wn[r[0]] = r[2]; lfc[r[0]] = r[1]; up[r[0]] = 1; });
    (prof.down || []).forEach(function (r) { wn[r[0]] = r[2]; lfc[r[0]] = r[1]; down[r[0]] = 1; });
    return { wn: wn, lfc: lfc, up: up, down: down };
  }

  async function update() {
    writeURL();
    if (sel.A.idx == null || sel.B.idx == null) return;
    var A = conds.byIdx[sel.A.idx], B = conds.byIdx[sel.B.idx];
    el("result-area").innerHTML = '<div class="empty-state"><span class="spinner"></span> Loading profiles…</div>';
    var pA, pB;
    try { pA = await D.profile(sel.A.idx); pB = await D.profile(sel.B.idx); }
    catch (e) { el("result-area").innerHTML = '<div class="empty-state error">Profiles unavailable for this pair.</div>'; return; }
    if (!pA || !pB) { el("result-area").innerHTML = '<div class="empty-state">Not computed for one of the selected conditions.</div>'; return; }
    var mA = profileMaps(pA), mB = profileMaps(pB);
    var cos = cosine(mA.wn, mB.wn);
    // shared / opposite
    var sharedUp = [], sharedDown = [], opposite = [], diff = [];
    var allGenes = {}; Object.keys(mA.lfc).forEach(function (g) { allGenes[g] = 1; }); Object.keys(mB.lfc).forEach(function (g) { allGenes[g] = 1; });
    Object.keys(allGenes).forEach(function (g) {
      var da = mA.up[g] ? 1 : (mA.down[g] ? -1 : 0);
      var db = mB.up[g] ? 1 : (mB.down[g] ? -1 : 0);
      if (da === 1 && db === 1) sharedUp.push(g);
      else if (da === -1 && db === -1) sharedDown.push(g);
      else if (da !== 0 && db !== 0 && da !== db) opposite.push(g);
      var la = mA.lfc[g] || 0, lb = mB.lfc[g] || 0;
      diff.push([g, la - lb, la, lb]);
    });
    diff.sort(function (a, b) { return Math.abs(b[1]) - Math.abs(a[1]); });
    render(A, B, cos, sharedUp, sharedDown, opposite, diff);
    window._cmp = { A: A, B: B, cos: cos, sharedUp: sharedUp, sharedDown: sharedDown, opposite: opposite, diff: diff };
  }

  function repBadge(c) { var b = D.repBadge(c.rep_rho, c.rep_cos); return '<span class="badge ' + b.cls + '">' + b.label + "</span>"; }

  function card(c, tag) {
    return '<div class="cond-card"><p class="cc-title">' + tag + ": " + c.cell_line + " × " + c.drug + "</p>" +
      '<p class="cc-sub">' + (+c.concentration) + " " + c.concentration_unit + " · plate " + c.plate +
      (c.organ ? " · " + c.organ : "") + (c.moa ? " · " + c.moa : "") + "</p>" +
      '<div class="metric-row">' +
        met("RMS log2FC", c.rms.toFixed(3)) + met("Sig genes", (c.n_sig || 0).toLocaleString()) +
        met("Up / Down", (c.n_up || 0) + " / " + (c.n_down || 0)) +
      '</div><div>' + repBadge(c) + ' <span class="badge flag">top-K signature</span></div></div>';
  }
  function met(l, v) { return '<div class="metric"><span>' + l + '</span><strong>' + v + '</strong></div>'; }

  function geneTable(title, arr) {
    if (!arr.length) return '<div class="panel"><h3>' + title + '</h3><p class="muted">None.</p></div>';
    return '<div class="panel"><h3>' + title + " (" + arr.length + ')</h3><div class="table-scroll"><div class="gene-list">' +
      arr.slice(0, 60).map(function (g) { return "<span style='display:inline-block;margin:2px 6px;font-size:12px'>" + g + "</span>"; }).join("") +
      "</div></div></div>";
  }

  function render(A, B, cos, su, sd, opp, diff) {
    var dmag = (A.rms - B.rms);
    var html =
      '<div class="metric-row">' +
        met("Top-K signature cosine", isNaN(cos) ? "—" : cos.toFixed(3)) +
        met("Response Δ (RMS)", (dmag >= 0 ? "+" : "") + dmag.toFixed(3)) +
        met("Shared up", su.length) + met("Shared down", sd.length) +
        met("Opposite direction", opp.length) +
      "</div>" +
      '<div class="compare-cards two">' + card(A, "A") + card(B, "B") + "</div>" +
      '<div class="gene-cols two" style="margin-top:16px">' +
        geneTable("Shared upregulated", su) + geneTable("Shared downregulated", sd) +
      "</div>" +
      '<div class="gene-cols two" style="margin-top:16px">' +
        geneTable("Opposite-direction genes", opp) +
        largestDiff(diff, A, B) +
      "</div>" +
      '<div class="footnote-sci"><b>Interpretation.</b> Cosine is computed over the union of each condition\'s top-K (IDF-weighted, L2-normalized) signature — a <b>top-K signature cosine</b>, not a full-transcriptome correlation. Shared/opposite genes are limited to the stored top-K per condition. Response Δ compares robust RMS log2FC magnitudes; it reflects how differently the transcriptomes moved, not differential drug efficacy or viability.' +
      (A.rep_cos == null || B.rep_cos == null ? " One or both conditions lack a replicate plate, so replicate reliability is unavailable." : "") + "</div>";
    el("result-area").innerHTML = html;
  }

  function largestDiff(diff, A, B) {
    var rows = diff.slice(0, 25).map(function (d) {
      return "<tr><td><b>" + d[0] + '</b></td><td class="num ' + (d[1] >= 0 ? "diff-pos" : "diff-neg") + '">' + (d[1] >= 0 ? "+" : "") + d[1].toFixed(2) + '</td><td class="num">' + d[2].toFixed(2) + '</td><td class="num">' + d[3].toFixed(2) + "</td></tr>";
    }).join("");
    return '<div class="panel"><h3>Largest differential-response genes</h3><div class="table-scroll"><table class="data-table"><thead><tr><th>Gene</th><th class="num">Δ log2FC (A−B)</th><th class="num">A</th><th class="num">B</th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
  }

  function toCSV() {
    var c = window._cmp; if (!c) return "";
    var L = ["metric,value",
      "condition_A," + c.A.cell_line + " x " + c.A.drug + " @ " + c.A.concentration + c.A.concentration_unit + " plate" + c.A.plate,
      "condition_B," + c.B.cell_line + " x " + c.B.drug + " @ " + c.B.concentration + c.B.concentration_unit + " plate" + c.B.plate,
      "topK_signature_cosine," + c.cos,
      "response_delta_rms," + (c.A.rms - c.B.rms),
      "shared_up," + c.sharedUp.length, "shared_down," + c.sharedDown.length, "opposite," + c.opposite.length,
      "", "gene,delta_log2fc_A_minus_B,A_log2fc,B_log2fc"];
    c.diff.slice(0, 200).forEach(function (d) { L.push(d[0] + "," + d[1] + "," + d[2] + "," + d[3]); });
    return L.join("\n");
  }
  function download(name, text) { var b = new Blob([text], { type: "text/csv" }); var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }

  async function init() {
    try { conds = await D.conditions(); }
    catch (e) { document.getElementById("result-area").innerHTML = '<div class="empty-state error">Could not load dataset from <code>' + D.base + "</code>.</div>"; return; }
    buildIndex(); readURL();
    if (sel.A.idx == null) { var c0 = conds.list[0]; sel.A = { cell: c0.cell_line, drug: c0.drug, idx: c0.cond_idx }; }
    if (sel.B.idx == null) { var c1 = conds.list.find(function (c) { return c.cell_line !== sel.A.cell || c.drug !== conds.byIdx[sel.A.idx].drug; }) || conds.list[1]; sel.B = { cell: c1.cell_line, drug: c1.drug, idx: c1.cond_idx }; }
    renderSelector("A"); renderSelector("B"); bindSelectors();
    el("swap-btn").onclick = function () { var t = sel.A; sel.A = sel.B; sel.B = t; renderSelector("A"); renderSelector("B"); bindSelectors(); update(); };
    el("share-btn").onclick = function () { writeURL(); navigator.clipboard && navigator.clipboard.writeText(location.href); el("share-btn").textContent = "Link copied"; setTimeout(function () { el("share-btn").textContent = "Share link"; }, 1500); };
    el("csv-btn").onclick = function () { download("tahoe_compare.csv", toCSV()); };
    update();
  }
  document.addEventListener("DOMContentLoaded", init);
})();
