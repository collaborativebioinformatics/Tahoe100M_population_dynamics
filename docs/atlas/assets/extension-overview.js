(async()=>{
  const [catalog,mutation,cells,dose,manifest]=await Promise.all([
    loadExtensionJSON('catalog.json'),loadExtensionJSON('mutation_context.json'),
    loadExtensionJSON('cell_level.json'),loadExtensionJSON('dose_response.json'),
    loadExtensionJSON('release_manifest.json')
  ]);
  const stats=[
    [mutation.drivers.length,'Driver genes'],[mutation.n_response_tests,'Response tests'],
    [mutation.n_response_sig,'Per-driver FDR hits'],[cells.n_real,'Cell-level pilot conditions'],
    [catalog.cell_level.cell_lines.length,'Pilot cell lines'],[dose.n_full_3dose_pseudobulk,'3-dose trajectories']
  ];
  const box=document.getElementById('extensionStats');
  stats.forEach(([number,label])=>{
    const value=el('div',{class:'k'},['0']);
    box.appendChild(el('div',{class:'card'},[value,el('div',{class:'l'},[label])]));
    animateNumber(value,number);
  });
  const provenance=document.getElementById('extensionProvenance');
  provenance.textContent='';
  provenance.appendChild(el('b',{},[`${manifest.version} · ${manifest.generated}`]));
  provenance.append(` · HPC analysis ${catalog.git_sha} · archive SHA-256 ${manifest.source_archive_sha256.slice(0,16)}… · ${manifest.downloads.length} checksummed tables · no raw single-cell counts shipped.`);
})().catch(error=>{ document.getElementById('extensionProvenance').textContent=error.message; });
