/* Shared header / subnav / footer for the Tahoe-100M tool pages.
   Keeps navigation, credits and the data banner consistent across pages. */
(function () {
  "use strict";
  var PAGES = [
    { href: "explore.html", label: "Explore" },
    { href: "compare.html", label: "Compare" },
    { href: "signature.html", label: "Signature Search" },
    { href: "coverage.html", label: "Coverage & QC" },
    { href: "methods.html", label: "Methods" },
    { href: "index.html#resources", label: "Download" }
  ];
  var here = location.pathname.split("/").pop() || "index.html";

  function headerHTML() {
    var nav = PAGES.map(function (p) {
      var cur = p.href.split("#")[0] === here ? ' aria-current="page"' : "";
      return '<a href="' + p.href + '"' + cur + '>' + p.label + "</a>";
    }).join("");
    return (
      '<a class="skip-link" href="#main-content">Skip to main content</a>' +
      '<header class="site-header">' +
        '<a class="brand" href="index.html" aria-label="Tahoe-100M home">' +
          '<span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>' +
          '<span><strong>Tahoe-100M</strong><small>Perturbation Explorer</small></span>' +
        '</a>' +
        '<nav class="site-nav" aria-label="Primary navigation">' + nav +
          '<a class="nav-cta" href="https://github.com/collaborativebioinformatics/Tahoe100M_population_dynamics" target="_blank" rel="noreferrer">View GitHub <span aria-hidden="true">↗</span></a>' +
        '</nav>' +
      '</header>'
    );
  }

  function footerHTML() {
    return (
      '<footer>' +
        '<div class="footer-brand"><span class="brand-mark small" aria-hidden="true"><span></span><span></span><span></span></span>' +
          '<div><strong>Tahoe-100M Perturbation Explorer</strong><small>Real query tools · Group 6</small></div></div>' +
        '<p>Interface &amp; website design: Xia (Candice) Wu. Developed by Group 6 for the Baylor–Rice AI in Health Hackathon. Results are real transcriptional-response measures, not drug efficacy or viability.</p>' +
        '<nav class="footer-links" aria-label="Project resources">' +
          '<a href="https://doi.org/10.1101/2025.02.20.639398" target="_blank" rel="noreferrer">Paper ↗</a>' +
          '<a href="https://huggingface.co/datasets/tahoebio/Tahoe-100M" target="_blank" rel="noreferrer">Data ↗</a>' +
          '<a href="methods.html">Methods</a>' +
          '<a href="index.html#team">Team</a>' +
          '<a href="https://github.com/collaborativebioinformatics/Tahoe100M_population_dynamics/issues" target="_blank" rel="noreferrer">Report issue ↗</a>' +
        '</nav>' +
      '</footer>'
    );
  }

  function mount(id, html) { var el = document.getElementById(id); if (el) el.outerHTML = html; }

  document.addEventListener("DOMContentLoaded", function () {
    mount("app-header", headerHTML());
    mount("app-footer", footerHTML());
    // data version / date banner
    if (window.TahoeData) {
      window.TahoeData.meta().then(function (m) {
        document.querySelectorAll("[data-meta-version]").forEach(function (e) { e.textContent = m.data_version; });
        document.querySelectorAll("[data-meta-date]").forEach(function (e) { e.textContent = (m.generated_utc || "").slice(0, 10); });
        document.querySelectorAll("[data-meta-nconditions]").forEach(function (e) { e.textContent = (m.n_conditions || 0).toLocaleString(); });
        document.querySelectorAll("[data-meta-ndrugs]").forEach(function (e) { e.textContent = m.n_drugs; });
        document.querySelectorAll("[data-meta-ncells]").forEach(function (e) { e.textContent = m.n_cell_lines; });
      }).catch(function () {});
    }
  });
})();
