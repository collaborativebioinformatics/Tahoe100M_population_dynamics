let R;
const modeSel=document.getElementById('mode'), pick=document.getElementById('pick'),
      pickLabel=document.getElementById('pickLabel'), pickWrap=document.getElementById('pickWrap'),
      thead=document.querySelector('#tbl thead'), tbody=document.querySelector('#tbl tbody');

function maxOf(rows,key){ return rows.reduce((m,r)=>Math.max(m,r[key]||0),0); }

function renderTable(){
  const mode=modeSel.value; thead.innerHTML=''; tbody.innerHTML='';
  let rows, cols;
  if(mode==='drug_in_cell'){
    pickWrap.style.display=''; pickLabel.textContent='Cell line';
    rows=R.top_drugs_per_cell_line[pick.value]||[];
    cols=[['#','rank'],['Drug','drug'],['Response','max_response'],['MoA','moa'],['Dose trend (ρ)','spearman'],['Dose grade','grade']];
    const mx=maxOf(rows,'max_response');
    thead.appendChild(rowHead(cols));
    rows.forEach((r,i)=> tbody.appendChild(tr([i+1, r.drug, respCell(r.max_response,mx), r.moa||'–', fmt(r.spearman,2), gradeShort(r.grade)])));
  } else if(mode==='cell_for_drug'){
    pickWrap.style.display=''; pickLabel.textContent='Drug';
    rows=R.top_cell_lines_per_drug[pick.value]||[];
    cols=[['#','rank'],['Cell line','cell_line'],['Response','max_response'],['Organ','organ']];
    const mx=maxOf(rows,'max_response');
    thead.appendChild(rowHead(cols));
    rows.forEach((r,i)=> tbody.appendChild(tr([i+1, r.cell_line, respCell(r.max_response,mx), r.organ||'–'])));
  } else if(mode==='global_drug'){
    pickWrap.style.display='none';
    rows=R.drugs_global;
    const mx=maxOf(rows,'mean_max_response');
    thead.appendChild(rowHead([['#','rank'],['Drug','drug'],['Mean response','mean'],['Median','median'],['# cell lines','n'],['MoA','moa'],['Approved','approved']]));
    rows.forEach(r=> tbody.appendChild(tr([r.rank, r.drug, respCell(r.mean_max_response,mx), fmt(r.median_max_response,2), r.n_cell_lines, r.moa||'–', r.approved||'–'])));
  } else {
    pickWrap.style.display='none';
    rows=R.cell_lines_global;
    const mx=maxOf(rows,'mean_max_response');
    thead.appendChild(rowHead([['#','rank'],['Cell line','cell_line'],['Mean response','mean'],['Median','median'],['# drugs','n'],['Organ','organ'],['Drivers','drivers']]));
    rows.forEach(r=> tbody.appendChild(tr([r.rank, r.cell_line, respCell(r.mean_max_response,mx), fmt(r.median_max_response,2), r.n_drugs, r.organ||'–', r.drivers||'–'])));
  }
}
function rowHead(cols){ const tr=document.createElement('tr'); cols.forEach(c=> tr.appendChild(el('th',{},[c[0]]))); return tr; }
function tr(cells){ const t=document.createElement('tr'); cells.forEach(c=>{ const td=document.createElement('td'); if(c instanceof Node) td.appendChild(c); else td.textContent=c; td.className = (typeof c==='number')?'num':''; t.appendChild(td);}); return t; }
function respCell(v,mx){ const s=el('span',{},[fmt(v,2)+' ']); s.appendChild(bar(v,mx,90)); return s; }
function gradeShort(g){ if(!g) return '–'; return g.includes('3 nonzero')?'3-dose':g.includes('single')?'1-dose':g; }

function fillPick(){
  const mode=modeSel.value;
  if(mode==='drug_in_cell'){ opt(pick, R.cell_lines_global.map(r=>r.cell_line).sort()); }
  else if(mode==='cell_for_drug'){ opt(pick, R.drugs_global.map(r=>r.drug).sort()); }
}
modeSel.addEventListener('change',()=>{ fillPick(); renderTable(); });
pick.addEventListener('change', renderTable);

function heatmap(){
  const box=document.getElementById('heatmap');
  const detail=document.getElementById('heatmapDetail');
  const cls=R.heatmap.cell_lines, drugs=R.heatmap.drugs.slice(0,60), vals=R.heatmap.values;
  const di=drugs.map(d=> R.heatmap.drugs.indexOf(d));
  let max=0; vals.forEach(row=> di.forEach(j=>{ if(row[j]!=null) max=Math.max(max,row[j]); }));
  const t=el('table',{class:'hm'}); const head=document.createElement('tr'); head.appendChild(el('th',{},['']));
  drugs.forEach(d=> head.appendChild(el('th',{title:d},[d.length>10?d.slice(0,9)+'…':d]))); t.appendChild(head);
  cls.forEach((cl,i)=>{ const r=document.createElement('tr'); r.appendChild(el('th',{title:cl},[cl]));
    di.forEach((j,k)=>{ const v=vals[i][j]; const td=document.createElement('td');
      if(v==null){ td.style.background='var(--panel)'; }
      else { const a=Math.min(1,v/max); td.style.background=`color-mix(in srgb,var(--accent) ${Math.round(12+88*a)}%,var(--surface))`;
        const label=`${cl} × ${drugs[k]} · response ${fmt(v,2)}`;
        td.title=label; td.tabIndex=0; td.setAttribute('aria-label',label);
        const reveal=()=>{ detail.textContent=label; detail.classList.remove('pulse'); };
        td.addEventListener('mouseenter',reveal); td.addEventListener('focus',reveal); td.addEventListener('click',reveal);
      }
      r.appendChild(td); }); t.appendChild(r); });
  box.innerHTML=''; box.appendChild(t);
}
(async ()=>{ R=await loadJSON('ranking.json'); fillPick(); renderTable(); heatmap(); })()
  .catch(e=>{
    const body=document.querySelector('#tbl tbody'); body.textContent='';
    body.appendChild(el('tr',{},[el('td',{colspan:'7'},[e.message])]));
  });
