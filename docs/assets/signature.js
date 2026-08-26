/* Signature Search — Module 3: similarity + reversal search over the sparse index. */
(function () {
  "use strict";
  var D = window.TahoeData;
  var conds = null, catalog = null;
  var el = function (id) { return document.getElementById(id); };

  function fillFilters() {
    el("f-cell").innerHTML = '<option value="">Any</option>' + catalog.cell_lines.slice().sort(function (a, b) { return a.id.localeCompare(b.id); }).map(function (c) { return '<option>' + c.id + "</option>"; }).join("");
    el("f-drug").innerHTML = '<option value="">Any</option>' + catalog.drugs.slice().sort(function (a, b) { return a.id.localeCompare(b.id); }).map(function (d) { return '<option>' + d.id + "</option>"; }).join("");
    el("f-dose").innerHTML = '<option value="">Any</option>' + catalog.doses_uM.map(function (d) { return '<option value="' + d + '">' + (+d) + " uM</option>"; }).join("");
    el("f-organ").innerHTML = '<option value="">Any</option>' + (catalog.organs || []).map(function (o) { return "<option>" + o + "</option>"; }).join("");
  }

  function readURL() {
    var q = new URLSearchParams(location.search);
    if (q.get("up")) el("up-genes").value = q.get("up").replace(/,/g, "\n");
    if (q.get("down")) el("down-genes").value = q.get("down").replace(/,/g, "\n");
    if (q.get("cell")) el("f-cell").value = q.get("cell");
    if (q.get("drug")) el("f-drug").value = q.get("drug");
    if (q.get("dose")) el("f-dose").value = q.get("dose");
    if (q.get("organ")) el("f-organ").value = q.get("organ");
    if (q.get("rep")) el("f-rep").value = q.get("rep");
  }
  function writeURL(up, down) {
    var q = new URLSearchParams();
    if (up.length) q.set("up", up.join(","));
    if (down.length) q.set("down", down.join(","));
    ["cell", "drug", "dose", "organ", "rep"].forEach(function (k) { var v = el("f-" + k).value; if (v) q.set(k, v); });
    history.replaceState(null, "", "?" + q.toString());
  }

  function passFilters(c) {
    var fc = el("f-cell").value, fd = el("f-drug").value, fo = el("f-organ").value, fdo = el("f-dose").value, fr = el("f-rep").value;
    if (fc && c.cell_line !== fc) return false;
    if (fd && c.drug !== fd) return false;
    if (fo && c.organ !== fo) return false;
    if (fdo && Math.abs(c.concentration - parseFloat(fdo)) > 1e-6) return false;
    if (fr) { var t = parseFloat(fr); if (c.rep_rho == null || isNaN(c.rep_rho) || c.rep_rho < t) return false; }
    return true;
  }

  async function run() {
    var up = D.parseGenes(el("up-genes").value), down = D.parseGenes(el("down-genes").value);
    writeURL(up, down);
    if (up.length + down.length < 3) { el("results").innerHTML = '<div class="empty-state">Enter at least 3 genes total.</div>'; return; }
    el("results").innerHTML = '<div class="empty-state"><span class="spinner"></span> Scoring ' + (up.length + down.length) + " genes across conditions…</div>";
    var res;
    try { res = await D.scoreQuery(up, down); }
    catch (e) { el("results").innerHTML = '<div class="empty-state error">Signature index unavailable: ' + e.message + "</div>"; return; }
    if (res.n_valid < 3) {
      el("results").innerHTML = '<div class="empty-state">Only ' + res.n_valid + " genes were recognized (need ≥3). Unknown: " + res.unknown.slice(0, 20).join(", ") + "</div>";
      return;
    }
    var minOverlap = 2;
    var matches = D.topN(res, 1, 400, minOverlap).filter(function (r) { return passFilters(conds.byIdx[r.cond_idx]); }).slice(0, 50);
    var reversers = D.topN(res, -1, 400, minOverlap).filter(function (r) { return passFilters(conds.byIdx[r.cond_idx]); }).slice(0, 50);
    coverageNote(res, up, down);
    render(res, matches, reversers, up, down);
    window._sig = { res: res, matches: matches, reversers: reversers, up: up, down: down };
  }

  function coverageNote(res, up, down) {
    var n = up.length + down.length;
    var msg = "Recognized " + res.n_valid + " / " + n + " genes (" + Math.round(res.coverage * 100) + "% coverage).";
    if (res.unknown.length) msg += " Unrecognized: " + res.unknown.slice(0, 12).join(", ") + (res.unknown.length > 12 ? "…" : "") + ".";
    if (res.conflicts.length) msg += " Excluded (up+down conflict): " + res.conflicts.join(", ") + ".";
    el("coverage-note").textContent = msg;
  }

  function overlapGenes(cond_idx, up, down, res, dir) {
    // recompute the overlapping genes and their contribution for display (small)
    return D.sigIndex().then(function (sig) {
      var rows = [];
      res.recognized.forEach(function (g) {
        var meta = sig.genes[g.gene]; if (!meta) return;
        var start = meta[3], count = meta[4];
        for (var i = start; i < start + count; i++) {
          if (sig.cond[i] === cond_idx) { rows.push({ gene: g.gene, sign: g.sign, contrib: g.sign * sig.w[i] }); break; }
        }
      });
      rows.sort(function (a, b) { return (dir > 0 ? b.contrib - a.contrib : a.contrib - b.contrib); });
      return rows;
    });
  }

  function resultTable(title, arr, dir) {
    var head = "<tr><th>#</th><th>Cell line</th><th>Drug</th><th>Dose</th><th class='num'>Score</th><th class='num'>Overlap</th><th class='num'>Resp (RMS)</th><th>Replicate</th><th>Genes</th><th></th></tr>";
    var body = arr.map(function (r, i) {
      var c = conds.byIdx[r.cond_idx];
      var rep = D.repBadge(c.rep_rho, c.rep_cos);
      var flag = r.overlap <= 2 ? ' <span class="badge flag">low overlap</span>' : "";
      return "<tr>" +
        "<td>" + (i + 1) + "</td>" +
        "<td><b>" + c.cell_line + "</b>" + (c.organ ? '<br><span class="muted" style="font-size:11px">' + c.organ + "</span>" : "") + "</td>" +
        "<td>" + c.drug + (c.moa ? '<br><span class="muted" style="font-size:11px">' + c.moa + "</span>" : "") + "</td>" +
        "<td>" + (+c.concentration) + " " + c.concentration_unit + "</td>" +
        '<td class="num"><b>' + r.score.toFixed(3) + "</b></td>" +
        '<td class="num">' + r.overlap + flag + "</td>" +
        '<td class="num">' + c.rms.toFixed(3) + "</td>" +
        '<td><span class="badge ' + rep.cls + '">' + rep.label + "</span></td>" +
        '<td><button class="btn secondary" style="padding:3px 8px;font-size:12px" data-genes="' + r.cond_idx + '" data-dir="' + dir + '">show</button></td>' +
        '<td><a href="compare.html?a=' + genCid(c) + '">compare ↗</a></td>' +
        "</tr><tr class='genes-row' id='gr-" + dir + "-" + r.cond_idx + "' hidden><td colspan='10'></td></tr>";
    }).join("");
    return '<div class="panel"><h3>' + title + " (" + arr.length + ')</h3><div class="table-scroll"><table class="data-table"><thead>' + head + "</thead><tbody>" + body + "</tbody></table></div></div>";
  }
  function genCid(c) { return encodeURIComponent(c.cond_idx); }

  function render(res, matches, reversers, up, down) {
    if (!matches.length && !reversers.length) { el("results").innerHTML = '<div class="empty-state">No conditions passed the filters. Loosen filters or add genes.</div>'; return; }
    el("results").innerHTML =
      '<div class="metric-row">' +
        metric("Genes used", res.n_valid) + metric("Coverage", Math.round(res.coverage * 100) + "%") +
        metric("Top match score", matches.length ? matches[0].score.toFixed(3) : "—") +
        metric("Top reverser score", reversers.length ? reversers[0].score.toFixed(3) : "—") +
      "</div>" +
      resultTable("Top matches — similar signature", matches, 1) +
      '<div style="height:16px"></div>' +
      resultTable("Top reversers — opposite signature", reversers, -1);
    document.querySelectorAll("button[data-genes]").forEach(function (b) {
      b.onclick = function () {
        var ci = parseInt(b.getAttribute("data-genes"), 10), dir = parseInt(b.getAttribute("data-dir"), 10);
        var row = document.getElementById("gr-" + dir + "-" + ci);
        if (!row.hidden) { row.hidden = true; return; }
        overlapGenes(ci, up, down, res, dir).then(function (rows) {
          row.querySelector("td").innerHTML = rows.map(function (x) {
            return "<span class='badge " + (x.sign > 0 ? "up" : "down") + "' style='margin:2px'>" + x.gene + " " + (x.sign > 0 ? "↑" : "↓") + " " + x.contrib.toFixed(3) + "</span>";
          }).join(" ");
          row.hidden = false;
        });
      };
    });
  }
  function metric(l, v) { return '<div class="metric"><span>' + l + "</span><strong>" + v + "</strong></div>"; }

  function init() {
    Promise.all([D.conditions(), D.catalog()]).then(function (r) {
      conds = r[0]; catalog = r[1]; fillFilters(); readURL();
      el("search-btn").onclick = run;
      el("example-btn").onclick = function () {
        el("up-genes").value = "HSPA6\nHSPA1A\nHSPA1B\nDNAJB1\nBAG3";
        el("down-genes").value = "MYC\nMKI67\nCCNB1\nTOP2A";
        run();
      };
      el("share-btn").onclick = function () {
        navigator.clipboard && navigator.clipboard.writeText(location.href);
        el("share-btn").textContent = "Copied"; setTimeout(function () { el("share-btn").textContent = "Share"; }, 1500);
      };
      if (el("up-genes").value.trim() || el("down-genes").value.trim()) run();
    }).catch(function (e) {
      el("results").innerHTML = '<div class="empty-state error">Could not load dataset from <code>' + D.base + "</code>.</div>";
    });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
