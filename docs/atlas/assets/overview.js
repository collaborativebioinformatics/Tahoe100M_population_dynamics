function shortLabel(value,limit){
  const text=String(value);
  return text.length>limit?text.slice(0,limit-1)+'…':text;
}

function animateFill(fill,percent){
  fill.style.width='0%';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ fill.style.width=percent+'%'; }));
}

function renderHeroBars(ranking){
  const box=document.getElementById('heroBars');
  const detail=document.getElementById('heroVizDetail');
  const rows=ranking.drugs_global.slice(0,7);
  const max=rows[0].mean_max_response;
  box.textContent='';
  rows.forEach((record,index)=>{
    const fill=el('span',{class:'hero-bar-fill'});
    const track=el('span',{class:'hero-bar-track'},[fill]);
    const row=el('div',{
      class:'hero-bar-row',tabindex:'0',
      'aria-label':`${record.drug}, mean response ${fmt(record.mean_max_response,1)}, rank ${index+1}`
    },[
      el('span',{class:'hero-bar-rank'},[String(index+1)]),
      el('span',{class:'hero-bar-name',title:record.drug},[shortLabel(record.drug,23)]),
      track,
      el('span',{class:'hero-bar-value'},[fmt(record.mean_max_response,1)])
    ]);
    const reveal=()=>{
      detail.textContent=`${record.moa||'Mechanism not annotated'} · median ${fmt(record.median_max_response,1)} · ${record.approved==='yes'?'approved drug':'research compound'}`;
    };
    row.addEventListener('mouseenter',reveal);
    row.addEventListener('focus',reveal);
    box.appendChild(row);
    animateFill(fill,Math.max(5,100*record.mean_max_response/max));
  });
}

function renderInspector(record,cellLine){
  const box=document.getElementById('responseDetail');
  box.textContent='';
  box.appendChild(el('div',{class:'inspector-drug'},[record.drug]));
  box.appendChild(el('div',{class:'inspector-context'},[`${cellLine} · ${record.moa||'mechanism not annotated'}`]));
  const metrics=el('div',{class:'inspector-metrics'},[
    el('span',{},[el('b',{},[fmt(record.max_response,2)]),' response']),
    el('span',{},[el('b',{},[fmt(record.spearman,2)]),' dose ρ'])
  ]);
  box.appendChild(metrics);
  box.appendChild(el('p',{class:'inspector-note'},['Observed three-dose trend; descriptive only, no EC50.']));
}

function renderResponseBars(ranking,cellLine){
  const box=document.getElementById('responseBars');
  const rows=(ranking.top_drugs_per_cell_line[cellLine]||[]).slice(0,9);
  box.textContent='';
  if(!rows.length){ box.appendChild(el('span',{class:'muted'},['No ranked responses found.'])); return; }
  const max=Math.max(...rows.map(row=>row.max_response));
  rows.forEach((record,index)=>{
    const fill=el('span',{class:'response-bar-fill'});
    const track=el('span',{class:'response-bar-track'},[fill]);
    const row=el('div',{
      class:'response-row',tabindex:'0',
      'aria-label':`${record.drug}, response ${fmt(record.max_response,2)}, dose trend rho ${fmt(record.spearman,2)}`
    },[
      el('span',{class:'response-rank'},[String(index+1).padStart(2,'0')]),
      el('span',{class:'response-name',title:record.drug},[shortLabel(record.drug,31)]),
      track,
      el('span',{class:'response-value'},[fmt(record.max_response,1)])
    ]);
    const reveal=()=>renderInspector(record,cellLine);
    row.addEventListener('mouseenter',reveal);
    row.addEventListener('focus',reveal);
    row.addEventListener('click',reveal);
    box.appendChild(row);
    animateFill(fill,Math.max(4,100*record.max_response/max));
  });
  renderInspector(rows[0],cellLine);
}

function wirePlayground(ranking){
  const select=document.getElementById('cellExplorer');
  const cells=ranking.cell_lines_global.map(row=>row.cell_line);
  opt(select,cells);
  select.addEventListener('change',()=>renderResponseBars(ranking,select.value));
  document.getElementById('randomCell').addEventListener('click',()=>{
    let next=Math.floor(Math.random()*select.options.length);
    if(select.options.length>1 && next===select.selectedIndex) next=(next+1)%select.options.length;
    select.selectedIndex=next;
    renderResponseBars(ranking,select.value);
  });
  renderResponseBars(ranking,select.value);
}

(async()=>{
  const [stats,ranking]=await Promise.all([loadJSON('site_stats.json'),loadJSON('ranking.json')]);
  const cards=[['conditions','Conditions'],['cell_lines','Cell lines'],['drugs','Drugs'],
    ['genes_indexed','Genes indexed'],['pathways','Pathways'],['n_trajectories_3dose','3-dose trajectories']];
  const box=document.getElementById('stats');
  cards.forEach(([key,label])=>{
    const value=el('div',{class:'k'},['0']);
    box.appendChild(el('div',{class:'card'},[value,el('div',{class:'l'},[label])]));
    animateNumber(value,stats[key]);
  });
  const method=document.getElementById('method');
  method.textContent='';
  method.append('Held-out plate-14 replicate concordance: ');
  method.appendChild(el('b',{},[`median cosine ${stats.heldout_median_cosine}`]));
  method.append('. Response magnitude reproduces the prior run to ');
  method.appendChild(el('b',{},[`r = ${Number(stats.reproducibility_r).toFixed(6)}`]));
  method.append('. Uncentered truncated-SVD response geometry, seed 42.');
  renderHeroBars(ranking);
  wirePlayground(ranking);
})().catch(error=>{
  document.getElementById('method').textContent=error.message;
  document.getElementById('heroBars').textContent='Response chart unavailable.';
  document.getElementById('responseBars').textContent='Response explorer unavailable.';
});
