/* Tahoe-100M real query tools — shared data layer (no external dependencies).
   Loads a static, versioned dataset (JSON + a compact binary inverted index)
   produced by the Argon analysis pipeline. All results are REAL (is_demo:false).

   Data base URL resolution order:
     1. ?data=<url> query param
     2. localStorage 'tahoe_data_base'
     3. window.TAHOE_DATA_BASE (set in config.js)
     4. './data/'  (co-located)
*/
(function (global) {
  "use strict";

  function resolveBase() {
    try {
      var p = new URLSearchParams(location.search).get("data");
      if (p) return p.replace(/\/?$/, "/");
    } catch (e) {}
    try {
      var ls = localStorage.getItem("tahoe_data_base");
      if (ls) return ls.replace(/\/?$/, "/");
    } catch (e) {}
    if (global.TAHOE_DATA_BASE) return String(global.TAHOE_DATA_BASE).replace(/\/?$/, "/");
    return "./data/";
  }

  var BASE = resolveBase();
  var cache = {};

  function url(path) { return BASE + path; }

  async function getJSON(path) {
    if (cache[path]) return cache[path];
    var r = await fetch(url(path), { cache: "force-cache" });
    if (!r.ok) throw new Error("Fetch failed (" + r.status + "): " + path);
    var j = await r.json();
    cache[path] = j;
    return j;
  }

  async function getBinary(path) {
    if (cache["bin:" + path]) return cache["bin:" + path];
    var r = await fetch(url(path), { cache: "force-cache" });
    if (!r.ok) throw new Error("Fetch failed (" + r.status + "): " + path);
    var buf = await r.arrayBuffer();
    cache["bin:" + path] = buf;
    return buf;
  }

  // ---- conditions index (compact columnar) ----
  var _conds = null;
  async function conditions() {
    if (_conds) return _conds;
    var raw = await getJSON("conditions.json");
    var f = {};
    raw.fields.forEach(function (name, i) { f[name] = i; });
    var byIdx = new Array(raw.rows.length);
    var rows = raw.rows;
    for (var k = 0; k < rows.length; k++) {
      var r = rows[k];
      byIdx[r[f.cond_idx]] = {
        cond_idx: r[f.cond_idx], cell_line: r[f.cell_line], drug: r[f.drug],
        concentration: r[f.concentration], concentration_unit: r[f.concentration_unit],
        plate: r[f.plate], organ: r[f.organ], target: r[f.target], moa: r[f.moa],
        rms: r[f.rms], respL2: r[f.respL2], n_sig: r[f.n_sig], n_up: r[f.n_up],
        n_down: r[f.n_down], max_abs: r[f.max_abs], rep_cos: r[f.rep_cos],
        rep_rho: r[f.rep_rho], depmap: r[f.depmap], cellosaurus: r[f.cellosaurus]
      };
    }
    _conds = { list: byIdx.filter(Boolean), byIdx: byIdx, fields: f };
    return _conds;
  }

  // ---- signature inverted index (binary) ----
  var _sig = null;
  async function sigIndex() {
    if (_sig) return _sig;
    var genes = await getJSON("sig/genes.json");
    var condBuf = await getBinary("sig/post_cond.bin");
    var cond = genes.cond_dtype === "u16" ? new Uint16Array(condBuf) : new Int32Array(condBuf);
    var q = new Int16Array(await getBinary("sig/post_w.bin"));
    // dequantize int16 weights to float32 once (download stays small, scoring stays fast)
    var scale = genes.w_scale || 1;
    var w = new Float32Array(q.length);
    for (var i = 0; i < q.length; i++) w[i] = q[i] * scale;
    _sig = { genes: genes.genes, ensembl: genes.ensembl,
             n_conditions: genes.n_conditions, cond: cond, w: w };
    return _sig;
  }

  // Normalize a raw gene token to an index symbol (uppercase HGNC or Ensembl alias).
  function normalizeGeneToken(tok, sig) {
    var t = String(tok).trim().toUpperCase().replace(/\.\d+$/, ""); // strip ensembl version
    if (sig.genes[t]) return t;
    if (sig.ensembl && sig.ensembl[t]) return sig.ensembl[t];
    // try original-case ensembl (keys are as stored)
    var raw = String(tok).trim();
    if (sig.ensembl && sig.ensembl[raw]) return sig.ensembl[raw];
    return null;
  }

  // Parse a free-text gene list (comma / whitespace / newline separated).
  function parseGenes(text) {
    return String(text || "").split(/[\s,;]+/).map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });
  }

  /* Score all conditions against a signed query.
     upList/downList: arrays of raw gene tokens.
     Returns { scores: Float64Array, overlap: Int16Array, recognized, unknown, conflicts, coverage } */
  async function scoreQuery(upList, downList) {
    var sig = await sigIndex();
    var N = sig.n_conditions;
    var scores = new Float64Array(N);
    var overlap = new Int16Array(N);
    var recognized = [], unknown = [], conflicts = [];
    var seen = {};
    function collect(list, sign) {
      var out = [];
      list.forEach(function (tok) {
        var sym = normalizeGeneToken(tok, sig);
        if (!sym) { unknown.push(tok); return; }
        if (seen[sym] !== undefined && seen[sym] !== sign) { conflicts.push(sym); }
        seen[sym] = sign; out.push(sym);
      });
      return out;
    }
    var ups = collect(upList, 1), downs = collect(downList, -1);
    // remove conflicting genes entirely
    var conflictSet = {}; conflicts.forEach(function (g) { conflictSet[g] = true; });
    function apply(syms, sign) {
      syms.forEach(function (sym) {
        if (conflictSet[sym]) return;
        var meta = sig.genes[sym]; // [col, df, idf, start, count]
        if (!meta) return;
        recognized.push({ gene: sym, sign: sign, df: meta[1], idf: meta[2] });
        var start = meta[3], count = meta[4];
        for (var i = start; i < start + count; i++) {
          var c = sig.cond[i];
          scores[c] += sign * sig.w[i];
          overlap[c] += 1;
        }
      });
    }
    apply(ups, 1); apply(downs, -1);
    var totalValid = recognized.length;
    var requested = upList.length + downList.length;
    return { scores: scores, overlap: overlap, recognized: recognized,
             unknown: unknown, conflicts: conflicts,
             coverage: requested ? totalValid / requested : 0,
             n_valid: totalValid };
  }

  // Top-N by score (dir=+1 matches desc, dir=-1 reversers = most negative first)
  function topN(scoreObj, dir, n, minOverlap) {
    var s = scoreObj.scores, ov = scoreObj.overlap;
    var idx = [];
    for (var i = 0; i < s.length; i++) {
      if (ov[i] >= (minOverlap || 1) && s[i] !== 0) idx.push(i);
    }
    idx.sort(function (a, b) { return dir > 0 ? s[b] - s[a] : s[a] - s[b]; });
    return idx.slice(0, n).map(function (i) {
      return { cond_idx: i, score: s[i], overlap: ov[i] };
    });
  }

  // ---- profile shards (top up/down genes per condition) ----
  var _profMeta = null;
  async function profile(condIdx) {
    if (!_profMeta) _profMeta = await getJSON("profiles/_index.json");
    var sh = Math.floor(condIdx / _profMeta.shard_size);
    var obj = await getJSON("profiles/" + sh + ".json");
    return obj[String(condIdx)] || null;
  }

  function fmt(x, d) { return (x === null || x === undefined || isNaN(x)) ? "—" : Number(x).toFixed(d === undefined ? 3 : d); }
  // Replicate reliability badge. Primary signal is Spearman over shared genes
  // (rho); cosine is a secondary, more diluted measure.
  function repBadge(rho, cos) {
    var v = (rho === null || rho === undefined || isNaN(rho)) ? null : rho;
    if (v === null) {
      if (cos === null || cos === undefined || isNaN(cos)) return { cls: "rep-na", label: "no replicate" };
      return { cls: "rep-na", label: "cos " + cos.toFixed(2) };
    }
    if (v >= 0.6) return { cls: "rep-high", label: "reliable (ρ " + v.toFixed(2) + ")" };
    if (v >= 0.3) return { cls: "rep-mid", label: "moderate (ρ " + v.toFixed(2) + ")" };
    return { cls: "rep-low", label: "low (ρ " + v.toFixed(2) + ")" };
  }

  global.TahoeData = {
    base: BASE, getJSON: getJSON, meta: function () { return getJSON("meta.json"); },
    catalog: function () { return getJSON("catalog.json"); },
    conditions: conditions, sigIndex: sigIndex, scoreQuery: scoreQuery, topN: topN,
    parseGenes: parseGenes, profile: profile, fmt: fmt, repBadge: repBadge,
    exploreDrug: function (slug) { return getJSON("explore/drug/" + slug + ".json"); },
    exploreCell: function (slug) { return getJSON("explore/cell/" + slug + ".json"); },
    slug: function (s) { return String(s).replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_|_$/g, ""); }
  };
})(window);
