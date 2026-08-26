const svgNS = "http://www.w3.org/2000/svg";

const catalog = {
  cellLines: {
    A549: { tissue: "lung", cellosaurus: "CVCL_0023" },
    MCF7: { tissue: "breast", cellosaurus: "CVCL_0031" },
    PC3: { tissue: "prostate", cellosaurus: "CVCL_0035" },
    HT29: { tissue: "colorectal", cellosaurus: "CVCL_0320" }
  },
  drugs: {
    Trametinib: { target: "MEK1/2" },
    Bortezomib: { target: "proteasome" },
    Vorinostat: { target: "HDAC" },
    Selumetinib: { target: "MEK1/2" }
  },
  featureSets: {
    "MAPK signaling": ["DUSP6", "SPRY2", "EGR1", "FOS", "ETV4"],
    DUSP6: ["DUSP6", "SPRY4", "ETV5", "FOSL1", "EGR1"],
    JUN: ["JUN", "FOS", "ATF3", "DDIT3", "EGR1"],
    "MYC targets": ["MYC", "NCL", "NPM1", "RPLP0", "EIF4E"],
    Apoptosis: ["BAX", "BCL2L11", "PMAIP1", "BBC3", "CASP3"]
  }
};

let doseValues = [0, 0.1, 1, 10];
const analysisLabels = {
  population: "Population statistics",
  pca: "PCA analysis",
  trajectory: "Dose trajectory"
};

const form = document.querySelector("#query-form");
const doseInput = document.querySelector("#dose");
const resultsPanel = document.querySelector("#results-panel");
const runButton = document.querySelector("#run-analysis");
const chart = document.querySelector("#analysis-chart");
const tabs = [...document.querySelectorAll(".view-tabs button")];

let currentView = "trajectory";
let currentResult;
let resultIndex = new Map();

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getQuery() {
  const values = new FormData(form);
  return {
    cellLine: values.get("cellLine"),
    drug: values.get("drug"),
    doseIndex: Number(values.get("dose")),
    feature: values.get("feature"),
    analysis: values.get("analysis")
  };
}

function queryKey(query) {
  return [query.cellLine, query.drug, doseValues[query.doseIndex], query.feature, query.analysis].join("|");
}

function buildResult(query) {
  const seed = hashString(`${query.cellLine}|${query.drug}|${query.feature}`);
  const random = mulberry32(seed);
  const baseline = 0.11 + random() * 0.09;
  const ceiling = 0.69 + random() * 0.2;
  const progression = [0, 0.24, 0.62, 1];
  const doseResponse = progression.map((fraction, index) =>
    clamp(baseline + (ceiling - baseline) * fraction + (index === 0 ? 0 : (random() - 0.5) * 0.035), 0.05, 0.96)
  );
  doseResponse.sort((first, second) => first - second);

  const response = doseResponse[query.doseIndex];
  const effect = (response - baseline) * (2.1 + random() * 0.7);
  const residual = Math.round(clamp(24 - query.doseIndex * 3.7 + random() * 3.5, 8, 28));
  const responding = Math.round(clamp(48 + query.doseIndex * 8.2 + random() * 5, 45, 82));
  const intermediate = 100 - residual - responding;
  const cells = 28000 + Math.floor(random() * 24000);
  const features = catalog.featureSets[query.feature] || catalog.featureSets["MAPK signaling"];

  const featureRows = features.map((feature, index) => {
    const direction = index === 3 || (query.drug === "Bortezomib" && index === 1) ? "down" : "up";
    const magnitude = (effect * (0.9 - index * 0.09) + random() * 0.28) * (direction === "up" ? 1 : -1);
    const exponent = 4 + index + Math.floor(random() * 3);
    return {
      feature,
      effect: magnitude,
      fdr: `${(1.1 + random() * 4.4).toFixed(1)}e-${exponent}`,
      direction
    };
  });

  return {
    ...query,
    seed,
    dose: doseValues[query.doseIndex],
    doseResponse,
    baseline,
    response,
    effect,
    residual,
    responding,
    intermediate,
    cells,
    featureRows,
    sourceMode: "generated-demo",
    provenance: {
      source: "deterministic_browser_fallback",
      is_demo: true,
      method: "seeded illustrative response generator",
      warning: "Illustrative values only; not a Tahoe-100M scientific result."
    }
  };
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${path}: HTTP ${response.status}`);
  return response.json();
}

function replaceOptions(select, items) {
  const previous = select.value;
  select.replaceChildren(
    ...items.map((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.label;
      return option;
    })
  );
  if (items.some((item) => item.id === previous)) select.value = previous;
}

function applyCatalog(payload) {
  if (!payload || !Array.isArray(payload.cell_lines) || !Array.isArray(payload.drugs)) return;

  catalog.cellLines = Object.fromEntries(
    payload.cell_lines.map((item) => [item.id, { tissue: item.tissue, cellosaurus: item.cellosaurus }])
  );
  catalog.drugs = Object.fromEntries(
    payload.drugs.map((item) => [item.id, { target: item.target || "target pending" }])
  );
  if (Array.isArray(payload.doses_um) && payload.doses_um.length === 4) doseValues = payload.doses_um;
  if (Array.isArray(payload.analyses)) {
    payload.analyses.forEach((item) => {
      analysisLabels[item.id] = item.label;
    });
  }

  replaceOptions(document.querySelector("#cell-line"), payload.cell_lines);
  replaceOptions(document.querySelector("#drug"), payload.drugs);
  replaceOptions(
    document.querySelector("#feature"),
    (payload.features || []).map((feature) => ({ id: feature, label: feature }))
  );
  document.querySelectorAll(".dose-ticks span").forEach((element, index) => {
    if (doseValues[index] !== undefined) {
      element.textContent = doseValues[index] === 0 ? "DMSO" : index === doseValues.length - 1 ? `${doseValues[index]} µM` : String(doseValues[index]);
    }
  });
}

async function loadDataSources() {
  try {
    const [catalogPayload, indexPayload] = await Promise.all([
      fetchJson("data/demo/catalog.json"),
      fetchJson("data/demo/result-index.json")
    ]);
    applyCatalog(catalogPayload);
    resultIndex = new Map((indexPayload.entries || []).map((entry) => [entry.key, entry]));
    setText("#data-source-status", `File-backed catalog loaded · ${resultIndex.size} indexed result${resultIndex.size === 1 ? "" : "s"}`);
    return true;
  } catch (_error) {
    setText("#data-source-status", "Embedded catalog active · demo fallback enabled");
    return false;
  }
}

function normalizeResultRecord(record, query) {
  if (!record?.summary || !Array.isArray(record.dose_response) || !Array.isArray(record.features)) {
    throw new Error("Result file does not follow the standardized contract");
  }
  const summary = record.summary;
  return {
    ...query,
    seed: hashString(queryKey(query)),
    dose: doseValues[query.doseIndex],
    doseResponse: record.dose_response.map((item) => item.score),
    doseIntervals: record.dose_response.map((item) => ({ low: item.ci_low, high: item.ci_high })),
    doseLabels: record.dose_response.map((item) => item.label),
    baseline: summary.baseline_score,
    response: summary.response_score,
    effect: summary.effect_size,
    residual: summary.residual_percent,
    responding: summary.responding_percent,
    intermediate: summary.intermediate_percent,
    cells: summary.cell_count,
    featureRows: record.features,
    sourceMode: record.provenance?.is_demo === false ? "precomputed" : "file-demo",
    provenance: record.provenance || { source: "indexed_result", is_demo: false },
    metadata: record.metadata || {},
    record
  };
}

async function resolveResult(query) {
  const entry = resultIndex.get(queryKey(query));
  if (!entry) return buildResult(query);
  try {
    return normalizeResultRecord(await fetchJson(entry.file), query);
  } catch (_error) {
    return buildResult(query);
  }
}

function hasOption(select, value) {
  return [...select.options].some((option) => option.value === value);
}

function applyUrlState() {
  const params = new URLSearchParams(window.location.search);
  const mappings = [
    ["cell_line", "#cell-line"],
    ["drug", "#drug"],
    ["feature", "#feature"]
  ];
  mappings.forEach(([parameter, selector]) => {
    const value = params.get(parameter);
    const select = document.querySelector(selector);
    if (value && hasOption(select, value)) select.value = value;
  });

  const doseParameter = params.get("dose");
  if (doseParameter !== null) {
    const requestedDose = Number(doseParameter);
    const doseIndex = doseValues.findIndex((value) => value === requestedDose);
    if (doseIndex >= 0) doseInput.value = String(doseIndex);
  }

  const analysis = params.get("analysis");
  const analysisInput = analysis ? document.querySelector(`input[name="analysis"][value="${analysis}"]`) : null;
  if (analysisInput) analysisInput.checked = true;

  const view = params.get("view");
  if (["trajectory", "population", "pca"].includes(view)) currentView = view;
}

function syncUrl(query = currentResult || getQuery()) {
  const params = new URLSearchParams();
  params.set("cell_line", query.cellLine);
  params.set("drug", query.drug);
  params.set("dose", String(doseValues[query.doseIndex]));
  params.set("feature", query.feature);
  params.set("analysis", query.analysis);
  params.set("view", currentView);
  const url = new URL(window.location.href);
  url.search = params.toString();
  url.hash = "explorer";
  window.history.replaceState({}, "", url);
  return url.href;
}

function formatDose(value) {
  return value === 0 ? "DMSO" : `${value} µM`;
}

function formatInteger(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function renderSummary(result) {
  const line = catalog.cellLines[result.cellLine] || { tissue: "tissue pending" };
  const drug = catalog.drugs[result.drug] || { target: "target pending" };
  setText("#condition-title", `${result.cellLine} × ${result.drug}`);
  setText("#condition-subtitle", `${formatDose(result.dose)} · ${result.feature} · ${analysisLabels[result.analysis]}`);
  setText("#response-score", result.response.toFixed(2));
  setText("#response-delta", `↑ ${Math.round((result.response - result.baseline) * 100)}% vs DMSO`);
  setText("#effect-size", result.effect.toFixed(2));
  setText("#residual-share", `${result.residual}%`);
  setText("#cell-count", formatInteger(result.cells));
  setText("#donut-value", `${result.responding}%`);
  setText("#responding-value", `${result.responding}%`);
  setText("#intermediate-value", `${result.intermediate}%`);
  setText("#residual-value", `${result.residual}%`);
  document.querySelector("#responding-bar").style.width = `${result.responding}%`;
  document.querySelector("#intermediate-bar").style.width = `${result.intermediate}%`;
  document.querySelector("#residual-bar").style.width = `${result.residual}%`;

  setText("#meta-cell-line", `${result.cellLine} · ${line.tissue}`);
  setText("#meta-drug", `${result.drug} · ${drug.target}`);
  setText("#meta-dose", formatDose(result.dose));
  setText("#meta-feature", result.feature);
  setText("#meta-provenance", (result.provenance?.source || "unknown source").replaceAll("_", " "));

  const statusText = result.sourceMode === "precomputed"
    ? "Precomputed result loaded"
    : result.sourceMode === "file-demo"
      ? "Indexed demo file"
      : "Generated demo result";
  setText("#result-status-text", statusText);
  document.querySelector(".result-status").classList.toggle("is-precomputed", result.sourceMode === "precomputed");

  document.querySelector("#cellosaurus-link").href = `https://www.cellosaurus.org/search?input=${encodeURIComponent(result.cellLine)}`;
  document.querySelector("#pubchem-link").href = `https://pubchem.ncbi.nlm.nih.gov/compound/${encodeURIComponent(result.drug)}`;

  const tableBody = document.querySelector("#feature-table");
  tableBody.innerHTML = result.featureRows
    .map((row) => `<tr><td>${row.feature}</td><td>${row.effect > 0 ? "+" : ""}${row.effect.toFixed(2)}</td><td>${row.fdr}</td><td class="direction-${row.direction}">${row.direction === "up" ? "↑ up" : "↓ down"}</td></tr>`)
    .join("");
}

function svgElement(name, attributes = {}, text = "") {
  const element = document.createElementNS(svgNS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  if (text) element.textContent = text;
  return element;
}

function clearChart(label) {
  chart.innerHTML = "";
  chart.setAttribute("aria-label", label);
}

function linePath(points) {
  if (points.length < 2) return "";
  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const middle = (current[0] + next[0]) / 2;
    path += ` C ${middle} ${current[1]}, ${middle} ${next[1]}, ${next[0]} ${next[1]}`;
  }
  return path;
}

function addAxes({ xLabels, yLabel = "Response score", xLabel = "Dose" }) {
  const left = 64;
  const right = 710;
  const top = 28;
  const bottom = 294;

  [0, 0.25, 0.5, 0.75, 1].forEach((tick) => {
    const y = bottom - tick * (bottom - top);
    chart.append(svgElement("line", { x1: left, x2: right, y1: y, y2: y, class: "chart-gridline" }));
    chart.append(svgElement("text", { x: left - 13, y: y + 4, "text-anchor": "end", class: "chart-label" }, tick.toFixed(2)));
  });
  chart.append(svgElement("line", { x1: left, x2: right, y1: bottom, y2: bottom, class: "chart-axis" }));
  xLabels.forEach((label, index) => {
    const x = left + (index / (xLabels.length - 1)) * (right - left);
    chart.append(svgElement("text", { x, y: bottom + 26, "text-anchor": "middle", class: "chart-label" }, label));
  });
  chart.append(svgElement("text", { x: (left + right) / 2, y: 344, "text-anchor": "middle", class: "chart-title-label" }, xLabel));
  const yTitle = svgElement("text", { x: 16, y: (top + bottom) / 2, "text-anchor": "middle", class: "chart-title-label", transform: `rotate(-90 16 ${(top + bottom) / 2})` }, yLabel);
  chart.append(yTitle);
  return { left, right, top, bottom };
}

function renderDoseChart(result) {
  clearChart(`Illustrative dose-response curve for ${result.cellLine} treated with ${result.drug}`);
  setText("#chart-kicker", "Dose trajectory");
  setText("#chart-title", "Response rises across concentration");
  const labels = result.doseLabels || ["DMSO", "0.1×", "1×", "10×"];
  const bounds = addAxes({ xLabels: labels });
  const lastIndex = Math.max(1, result.doseResponse.length - 1);
  const x = (index) => bounds.left + (index / lastIndex) * (bounds.right - bounds.left);
  const y = (value) => bounds.bottom - value * (bounds.bottom - bounds.top);
  const points = result.doseResponse.map((value, index) => [x(index), y(value)]);
  const upper = result.doseResponse.map((value, index) => [x(index), y(clamp(result.doseIntervals?.[index]?.high ?? value + 0.055, 0, 1))]);
  const lower = result.doseResponse.map((value, index) => [x(index), y(clamp(result.doseIntervals?.[index]?.low ?? value - 0.055, 0, 1))]).reverse();
  const bandPath = `M ${upper.map((point) => point.join(" ")).join(" L ")} L ${lower.map((point) => point.join(" ")).join(" L ")} Z`;
  chart.append(svgElement("path", { d: bandPath, class: "chart-band" }));
  chart.append(svgElement("line", { x1: bounds.left, x2: bounds.right, y1: y(result.baseline), y2: y(result.baseline), class: "chart-control" }));
  chart.append(svgElement("path", { d: linePath(points), class: "chart-line" }));
  points.forEach((point, index) => {
    chart.append(svgElement("circle", { cx: point[0], cy: point[1], r: index === result.doseIndex ? 7 : 5, class: index === result.doseIndex ? "chart-point-selected" : "chart-point" }));
  });
  chart.append(svgElement("text", { x: bounds.right - 3, y: y(result.doseResponse.at(-1)) - 13, "text-anchor": "end", class: "chart-title-label" }, `${result.drug} response`));
  chart.append(svgElement("text", { x: bounds.right - 3, y: y(result.baseline) - 9, "text-anchor": "end", class: "chart-label" }, "DMSO baseline"));
}

function renderPopulationChart(result) {
  clearChart(`Illustrative response distribution for ${result.cellLine} treated with ${result.drug}`);
  setText("#chart-kicker", "Population statistics");
  setText("#chart-title", "A residual state persists after treatment");
  const left = 90;
  const right = 710;
  const top = 30;
  const bottom = 295;
  const random = mulberry32(result.seed + result.doseIndex * 97);

  [0, 0.25, 0.5, 0.75, 1].forEach((tick) => {
    const x = left + tick * (right - left);
    chart.append(svgElement("line", { x1: x, x2: x, y1: top, y2: bottom, class: "chart-gridline" }));
    chart.append(svgElement("text", { x, y: bottom + 25, "text-anchor": "middle", class: "chart-label" }, tick.toFixed(2)));
  });
  chart.append(svgElement("text", { x: (left + right) / 2, y: 343, "text-anchor": "middle", class: "chart-title-label" }, "Single-cell response score"));
  chart.append(svgElement("text", { x: 75, y: 110, "text-anchor": "end", class: "chart-title-label" }, "responding"));
  chart.append(svgElement("text", { x: 75, y: 235, "text-anchor": "end", class: "chart-title-label" }, "residual"));

  const responderCount = 58;
  const residualCount = 20;
  for (let index = 0; index < responderCount; index += 1) {
    const score = clamp(result.response + (random() - 0.5) * 0.32, 0.05, 0.98);
    chart.append(svgElement("circle", { cx: left + score * (right - left), cy: 105 + (random() - 0.5) * 62, r: 4, class: "responder-point" }));
  }
  for (let index = 0; index < residualCount; index += 1) {
    const score = clamp(0.22 + (random() - 0.5) * 0.28, 0.03, 0.5);
    chart.append(svgElement("circle", { cx: left + score * (right - left), cy: 230 + (random() - 0.5) * 62, r: 4.5, class: "residual-point" }));
  }
  chart.append(svgElement("line", { x1: left + result.response * (right - left), x2: left + result.response * (right - left), y1: 61, y2: 149, class: "chart-control" }));
  chart.append(svgElement("text", { x: left + result.response * (right - left), y: 48, "text-anchor": "middle", class: "chart-label" }, `mean ${result.response.toFixed(2)}`));
}

function renderPcaChart(result) {
  clearChart(`Illustrative PCA state-space view for ${result.cellLine} treated with ${result.drug}`);
  setText("#chart-kicker", "PCA state space");
  setText("#chart-title", "Selected cells shift away from control");
  const left = 64;
  const right = 710;
  const top = 27;
  const bottom = 294;
  const random = mulberry32(result.seed + 1409);

  chart.append(svgElement("line", { x1: left, x2: right, y1: bottom, y2: bottom, class: "chart-axis" }));
  chart.append(svgElement("line", { x1: left, x2: left, y1: top, y2: bottom, class: "chart-axis" }));
  chart.append(svgElement("text", { x: (left + right) / 2, y: 342, "text-anchor": "middle", class: "chart-title-label" }, "PC1 · illustrative variance"));
  const yTitle = svgElement("text", { x: 17, y: (top + bottom) / 2, "text-anchor": "middle", class: "chart-title-label", transform: `rotate(-90 17 ${(top + bottom) / 2})` }, "PC2 · illustrative variance");
  chart.append(yTitle);

  const defs = svgElement("defs");
  const marker = svgElement("marker", { id: "arrowhead", markerWidth: 8, markerHeight: 8, refX: 7, refY: 3, orient: "auto", markerUnits: "strokeWidth" });
  marker.append(svgElement("path", { d: "M0,0 L0,6 L8,3 z", fill: "#2563eb" }));
  defs.append(marker);
  chart.append(defs);

  const centers = [
    [210, 220],
    [335, 185],
    [455, 128],
    [585, 82]
  ];

  centers.forEach((center, doseIndex) => {
    const count = doseIndex === 0 ? 34 : 24;
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const radiusX = Math.sqrt(random()) * (doseIndex === 0 ? 72 : 58);
      const radiusY = Math.sqrt(random()) * 42;
      const cx = center[0] + Math.cos(angle) * radiusX;
      const cy = center[1] + Math.sin(angle) * radiusY;
      chart.append(svgElement("circle", { cx, cy, r: 3.6, class: doseIndex === 0 ? "residual-point" : "responder-point", opacity: doseIndex === result.doseIndex ? 0.8 : 0.32 }));
    }
    chart.append(svgElement("circle", { cx: center[0], cy: center[1], r: doseIndex === result.doseIndex ? 7 : 5, class: "centroid" }));
  });

  for (let index = 0; index < centers.length - 1; index += 1) {
    chart.append(svgElement("path", { d: `M ${centers[index][0] + 10} ${centers[index][1] - 6} C ${(centers[index][0] + centers[index + 1][0]) / 2} ${centers[index][1] - 18}, ${(centers[index][0] + centers[index + 1][0]) / 2} ${centers[index + 1][1] + 18}, ${centers[index + 1][0] - 10} ${centers[index + 1][1] + 6}`, class: "trajectory-arrow" }));
  }
  chart.append(svgElement("text", { x: 165, y: 287, class: "chart-label" }, "DMSO"));
  chart.append(svgElement("text", { x: 594, y: 63, class: "chart-title-label" }, "high dose"));
}

function selectTab(view) {
  currentView = view;
  tabs.forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.view === view)));
  if (!currentResult) return;
  if (view === "population") renderPopulationChart(currentResult);
  else if (view === "pca") renderPcaChart(currentResult);
  else renderDoseChart(currentResult);
}

function render(result) {
  currentResult = result;
  renderSummary(result);
  selectTab(currentView);
}

function updateDoseTrack() {
  const progress = (Number(doseInput.value) / Number(doseInput.max)) * 100;
  doseInput.style.background = `linear-gradient(90deg, #2563eb 0 ${progress}%, #d6dfeb ${progress}% 100%)`;
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportChart() {
  const clone = chart.cloneNode(true);
  clone.setAttribute("xmlns", svgNS);
  const suffix = currentResult.provenance?.is_demo === false ? "result" : "demo";
  const fileName = `${currentResult.cellLine}-${currentResult.drug}-${currentView}-${suffix}.svg`.toLowerCase();
  downloadFile(fileName, `<?xml version="1.0" encoding="UTF-8"?>\n${clone.outerHTML}`, "image/svg+xml");
}

function exportTable() {
  const header = "feature,effect,fdr,direction";
  const rows = currentResult.featureRows.map((row) => `${row.feature},${row.effect.toFixed(3)},${row.fdr},${row.direction}`);
  const suffix = currentResult.provenance?.is_demo === false ? "result" : "demo";
  downloadFile(`${currentResult.cellLine}-${currentResult.drug}-${suffix}-features.csv`.toLowerCase(), [header, ...rows].join("\n"), "text/csv");
}

function toStandardRecord(result) {
  if (result.record) return result.record;
  return {
    schema_version: "1.0.0",
    query: {
      cell_line: result.cellLine,
      drug: result.drug,
      dose_um: result.dose,
      feature: result.feature,
      analysis: result.analysis
    },
    summary: {
      response_score: result.response,
      baseline_score: result.baseline,
      effect_size: result.effect,
      responding_percent: result.responding,
      intermediate_percent: result.intermediate,
      residual_percent: result.residual,
      cell_count: result.cells
    },
    dose_response: result.doseResponse.map((score, index) => ({
      label: result.doseLabels?.[index] || ["DMSO", "0.1×", "1×", "10×"][index] || `dose ${index + 1}`,
      dose_um: index === 0 ? 0 : doseValues[index],
      score,
      ci_low: result.doseIntervals?.[index]?.low ?? clamp(score - 0.055, 0, 1),
      ci_high: result.doseIntervals?.[index]?.high ?? clamp(score + 0.055, 0, 1)
    })),
    features: result.featureRows,
    metadata: {
      cell_line_tissue: catalog.cellLines[result.cellLine]?.tissue || "unknown",
      cellosaurus: catalog.cellLines[result.cellLine]?.cellosaurus || "",
      drug_target: catalog.drugs[result.drug]?.target || "unknown"
    },
    provenance: result.provenance
  };
}

function exportJson() {
  const suffix = currentResult.provenance?.is_demo === false ? "result" : "demo";
  const fileName = `${currentResult.cellLine}-${currentResult.drug}-${currentResult.analysis}-${suffix}.json`.toLowerCase();
  downloadFile(fileName, `${JSON.stringify(toStandardRecord(currentResult), null, 2)}\n`, "application/json");
}

function flashButton(button, message) {
  const original = button.textContent;
  button.textContent = message;
  button.classList.add("is-success");
  window.setTimeout(() => {
    button.textContent = original;
    button.classList.remove("is-success");
  }, 1600);
}

async function copyShareLink() {
  const button = document.querySelector("#share-query");
  const url = syncUrl();
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
    await Promise.race([
      navigator.clipboard.writeText(url),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error("Clipboard timeout")), 500))
    ]);
  } catch (_error) {
    const input = document.createElement("textarea");
    input.value = url;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  flashButton(button, "Copied ✓");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = getQuery();
  const targetView = query.analysis === "pca" ? "pca" : query.analysis === "population" ? "population" : "trajectory";
  runButton.classList.add("is-running");
  runButton.querySelector("span").textContent = "Loading result…";
  resultsPanel.classList.add("is-updating");
  await new Promise((resolve) => window.setTimeout(resolve, 360));
  currentView = targetView;
  render(await resolveResult(query));
  syncUrl();
  resultsPanel.classList.remove("is-updating");
  runButton.classList.remove("is-running");
  runButton.querySelector("span").textContent = "Run analysis";
});

doseInput.addEventListener("input", updateDoseTrack);
tabs.forEach((tab) => tab.addEventListener("click", () => {
  selectTab(tab.dataset.view);
  syncUrl();
}));
document.querySelector("#download-chart").addEventListener("click", exportChart);
document.querySelector("#export-table").addEventListener("click", exportTable);
document.querySelector("#download-json").addEventListener("click", exportJson);
document.querySelector("#share-query").addEventListener("click", copyShareLink);

async function initialize() {
  await loadDataSources();
  applyUrlState();
  updateDoseTrack();
  render(await resolveResult(getQuery()));
}

initialize();
