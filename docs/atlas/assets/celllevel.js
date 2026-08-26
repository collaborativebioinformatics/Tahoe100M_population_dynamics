let cellData;

function thresholdConfig(){
  const select=document.getElementById('threshold');
  const option=select.selectedOptions[0];
  return {key:select.value,quantile:Number(option.dataset.q),label:option.textContent};
}

function renderCellInspector(record,config){
  const box=document.getElementById('cellInspector'); box.textContent='';
  box.appendChild(el('div',{class:'inspector-label'},['FOCUS']));
  box.appendChild(el('div',{class:'inspector-drug'},[record.drug]));
  box.appendChild(el('div',{class:'inspector-context'},[`${record.cell_line} · ${record.moa||'mechanism not annotated'} · ${compactDose(record.concentration)}`]));
  const value=record[config.key];
  box.appendChild(el('div',{class:'inspector-metrics'},[
    el('span',{},[el('b',{},[fmt(value,3)]),' control-like']),
    el('span',{},[el('b',{},[fmt(record.treated_minus_dmso_median,3)]),' median Δ'])
  ]));
  box.appendChild(el('p',{class:'inspector-note'},[`${record.n_treated_qc.toLocaleString()} treated · ${record.n_dmso_qc.toLocaleString()} matched DMSO cells · ${(record.n_sig_up+record.n_sig_down)} signature genes.`]));
  box.appendChild(el('span',{class:'inspector-foot'},[`Operational ${config.label} definition; not labeled resistant.`]));
}

function renderCellLevel(){
  const cellLine=document.getElementById('cellLine').value;
  const config=thresholdConfig();
  const rows=cellData.conditions.filter(record=>record.cell_line===cellLine).sort((a,b)=>a[config.key]-b[config.key]);
  document.getElementById('fractionGuide').textContent=`Dashed marker = ${Math.round(config.quantile*100)}% DMSO benchmark by construction · lower values indicate a larger distribution shift`;
  const chart=document.getElementById('fractionChart'); chart.textContent='';
  rows.forEach(record=>{
    const value=record[config.key];
    const fill=el('span',{class:`fraction-fill ${value<config.quantile?'shifted':''}`}); fill.style.width=`${100*value}%`;
    const marker=el('i',{class:'fraction-reference'}); marker.style.left=`${100*config.quantile}%`;
    const track=el('span',{class:'fraction-track'},[fill,marker]);
    const label=`${record.drug} · ${compactDose(record.concentration)}`;
    const row=el('div',{class:'fraction-row',tabindex:'0','aria-label':`${label}, candidate control-like fraction ${fmt(value,3)}`},[
      el('span',{class:'fraction-label',title:label},[label]),track,el('span',{class:'fraction-value'},[fmt(value,3)])
    ]);
    const reveal=()=>renderCellInspector(record,config);
    row.addEventListener('mouseenter',reveal); row.addEventListener('focus',reveal); row.addEventListener('click',reveal);
    chart.appendChild(row);
  });
  if(rows.length) renderCellInspector(rows[0],config); else clearAndMessage(chart,'Not computed for this cell line.');

  const body=document.querySelector('#cellTable tbody'); body.textContent='';
  rows.forEach(record=>{
    const ci=config.key==='control_like_frac_p95'&&record.control_like_p95_ci_lo!==null
      ?`${fmt(record.control_like_p95_ci_lo,3)}–${fmt(record.control_like_p95_ci_hi,3)}`:'Not computed';
    body.appendChild(el('tr',{},[
      tableCell(record.drug),tableCell(compactDose(record.concentration)),tableCell(record.moa||'–'),
      tableCell(record.n_treated_qc,true),tableCell(record.n_dmso_qc,true),tableCell(record.n_sig_up+record.n_sig_down,true),
      tableCell(fmt(record[config.key],3),true),tableCell(ci,true),tableCell(fmt(record.treated_minus_dmso_median,3),true)
    ]));
  });
}

(async()=>{
  cellData=await loadExtensionJSON('cell_level.json');
  const availability=cellData.availability;
  const validation=document.getElementById('cellValidation');
  [[cellData.n_real,'real conditions'],[new Set(cellData.conditions.map(record=>record.cell_line)).size,'cell lines'],[new Set(cellData.conditions.map(record=>record.drug)).size,'drugs'],[fmt(cellData.validation_summary.neg_control_dmso_perm_median,3),'DMSO permutation median']].forEach(([value,label])=>{
    validation.appendChild(el('div',{},[el('b',{},[String(value)]),el('span',{},[label])]));
  });
  validation.appendChild(el('div',{},[el('b',{},[`${Math.round(100*cellData.validation_summary.reversal_flips_sign_fraction)}%`]),el('span',{},['signature reversal sign flips'])]));
  const select=document.getElementById('cellLine'); opt(select,[...new Set(cellData.conditions.map(record=>record.cell_line))].sort());
  select.addEventListener('change',renderCellLevel); document.getElementById('threshold').addEventListener('change',renderCellLevel);
  document.getElementById('randomPilot').addEventListener('click',()=>{
    let next=Math.floor(Math.random()*select.options.length); if(select.options.length>1&&next===select.selectedIndex) next=(next+1)%select.options.length;
    select.selectedIndex=next; renderCellLevel();
  });
  renderCellLevel();
})().catch(error=>{ document.getElementById('fractionChart').textContent=error.message; });
