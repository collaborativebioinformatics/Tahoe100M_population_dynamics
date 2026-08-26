let mutationData;

function renderEffectRows(target,records,valueKey,labeler){
  target.textContent='';
  if(!records.length){ clearAndMessage(target,'No retained associations for this driver and effect threshold.'); return; }
  const rows=[...records].sort((a,b)=>Math.abs(b[valueKey])-Math.abs(a[valueKey])).slice(0,12);
  const max=Math.max(...rows.map(record=>Math.abs(record[valueKey])))||1;
  rows.forEach(record=>{
    const value=record[valueKey];
    const bar=el('span',{class:`effect-bar ${value>=0?'positive':'negative'}`});
    bar.style.width=`${Math.max(2,48*Math.abs(value)/max)}%`;
    const track=el('span',{class:'effect-track'},[el('i',{class:'effect-zero'}),bar]);
    const label=labeler(record);
    const row=el('div',{class:'effect-row',tabindex:'0','aria-label':`${label}, effect ${fmt(value,3)}`},[
      el('span',{class:'effect-label',title:label},[label]),track,
      el('span',{class:`effect-value ${value>=0?'up':'down'}`},[`${value>=0?'+':''}${fmt(value,3)}`])
    ]);
    target.appendChild(row);
  });
}

function renderMutation(){
  const gene=document.getElementById('driver').value;
  const minEffect=Number(document.getElementById('effect').value);
  const driver=mutationData.drivers.find(record=>record.driver_gene===gene);
  const hits=mutationData.top_response_associations.filter(record=>record.driver_gene===gene&&Math.abs(record.cliffs_delta)>=minEffect);
  const pathways=mutationData.top_pathway_associations.filter(record=>record.driver_gene===gene);

  const stats=document.getElementById('driverStats'); stats.textContent='';
  [[driver.n_altered,'Altered lines'],[driver.n_reference,'Reference lines'],[new Set(driver.altered_organs.split(';')).size,'Altered organs'],[hits.length,'Browser hits']].forEach(([value,label])=>{
    stats.appendChild(el('div',{class:'card'},[el('div',{class:'k'},[String(value)]),el('div',{class:'l'},[label])]));
  });
  const info=document.getElementById('driverInfo'); info.textContent='';
  info.appendChild(el('b',{},[gene]));
  info.append(` · ${driver.variant_types||'variant type unavailable'} · altered organs: ${driver.altered_organs||'–'} · reference means not annotated as this driver, not confirmed wild type.`);

  renderEffectRows(document.getElementById('effectChart'),hits,'cliffs_delta',record=>`${record.drug} · ${compactDose(record.concentration)}`);
  renderEffectRows(document.getElementById('pathwayChart'),pathways,'signed_score_diff',record=>record.pathway);

  const body=document.querySelector('#mutationTable tbody'); body.textContent='';
  hits.slice(0,100).forEach(record=>{
    let replicate='Not testable';
    if(record.plate14_testable) replicate=record.plate14_replicates_direction?'Direction replicated':'Direction not replicated';
    body.appendChild(el('tr',{},[
      tableCell(record.drug),tableCell(compactDose(record.concentration)),tableCell(record.n_altered,true),tableCell(record.n_reference,true),
      tableCell(fmt(record.median_diff,3),true),tableCell(fmt(record.cliffs_delta,3),true),tableCell(fmt(record.hedges_g,3),true),
      tableCell(fmt(record.hc3_p,4),true),tableCell(fmt(record.fdr,4),true),tableCell(fmt(record.fdr_global,4),true),tableCell(replicate)
    ]));
  });
  if(!hits.length) clearAndMessage(body,'No retained response associations for this selection.',11);
}

(async()=>{
  mutationData=await loadExtensionJSON('mutation_context.json');
  const select=document.getElementById('driver');
  opt(select,mutationData.drivers.map(record=>record.driver_gene).sort());
  select.value='KRAS';
  select.addEventListener('change',renderMutation);
  document.getElementById('effect').addEventListener('change',renderMutation);
  renderMutation();
})().catch(error=>{ document.getElementById('driverInfo').textContent=error.message; });
