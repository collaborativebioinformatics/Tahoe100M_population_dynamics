let CAT, shardCache={};
async function shard(cell){ const s=safe(cell); if(!shardCache[s]) shardCache[s]=await loadJSON('compare/'+s+'.json.gz'); return shardCache[s]; }

async function wireSide(prefix, initialIndex){
  const cell=document.getElementById(prefix+'Cell'), drug=document.getElementById(prefix+'Drug'),
        dose=document.getElementById(prefix+'Dose'), plate=document.getElementById(prefix+'Plate');
  opt(cell, CAT.cell_lines);
  cell.selectedIndex=Math.min(initialIndex||0,CAT.cell_lines.length-1);
  let currentShard;
  function doseMatch(a,b){ return Math.abs(Number(a)-Number(b))<1e-6; }
  function fillPlate(){
    const plates=[...new Set(currentShard.conditions
      .filter(c=>c.drug===drug.value && doseMatch(c.conc,dose.value)).map(c=>String(c.plate)))];
    plates.sort((a,b)=>Number(a)-Number(b)); opt(plate,plates);
  }
  function fillDose(){
    const doses=[...new Set(currentShard.conditions.filter(c=>c.drug===drug.value).map(c=>Number(c.conc)))];
    doses.sort((a,b)=>a-b); opt(dose,doses.map(String));
    [...dose.options].forEach(o=>{ o.textContent=doseLabel(o.value); });
    fillPlate();
  }
  async function fillDrug(){
    currentShard=await shard(cell.value);
    const drugs=[...new Set(currentShard.conditions.map(c=>c.drug))].sort();
    opt(drug,drugs); fillDose();
  }
  cell.addEventListener('change',()=>fillDrug().catch(showError));
  drug.addEventListener('change',fillDose); dose.addEventListener('change',fillPlate);
  await fillDrug();
  return {randomize:async()=>{
    cell.selectedIndex=Math.floor(Math.random()*cell.options.length); await fillDrug();
    drug.selectedIndex=Math.floor(Math.random()*drug.options.length); fillDose();
    dose.selectedIndex=Math.floor(Math.random()*dose.options.length); fillPlate();
    plate.selectedIndex=Math.floor(Math.random()*plate.options.length);
  }};
}
function findCond(sh, drug, dose, plate){
  const dz=parseFloat(dose);
  return sh.conditions.find(c=> c.drug===drug && Math.abs(c.conc-dz)<1e-6 && String(c.plate)===String(plate));
}
function geneSet(rec,dir){ return (rec.genes[dir]||[]).map(g=>g[0]); }
function pwSet(rec,dir){ return (rec.pathways[dir]||[]).map(p=>p[0]); }

async function run(){
  const st=document.getElementById('status'); st.textContent='loading…';
  try{
    const aCell=document.getElementById('aCell').value, bCell=document.getElementById('bCell').value;
    const [sa,sb]=await Promise.all([shard(aCell),shard(bCell)]);
    const A=findCond(sa,document.getElementById('aDrug').value,document.getElementById('aDose').value,document.getElementById('aPlate').value);
    const B=findCond(sb,document.getElementById('bDrug').value,document.getElementById('bDose').value,document.getElementById('bPlate').value);
    if(!A||!B){ st.textContent='condition not found'; return; }
    st.textContent='';
    document.getElementById('result').style.display='';
    const cos=cosine(A.svd,B.svd);
    let eu=0; for(let i=0;i<A.svd.length;i++) eu+=(A.svd[i]-B.svd[i])**2; eu=Math.sqrt(eu);
    const labA=`${aCell} · ${A.drug} · ${doseLabel(A.conc)} µM · plate ${A.plate}`;
    const labB=`${bCell} · ${B.drug} · ${doseLabel(B.conc)} µM · plate ${B.plate}`;
    const cards=[['20-D SVD cosine',fmt(cos,3)],['SVD Euclidean dist',fmt(eu,2)],
      ['A magnitude',fmt(A.magnitude,2)],['B magnitude',fmt(B.magnitude,2)],
      ['A n_sig',A.n_sig.toLocaleString()],['B n_sig',B.n_sig.toLocaleString()]];
    const sum=document.getElementById('summary'); sum.innerHTML='';
    const labels=el('div',{},[el('b',{},[labA]),' vs ',el('b',{},[labB])]);
    sum.appendChild(el('div',{class:'card',style:'grid-column:1/-1'},[el('div',{class:'l'},['A vs B']),labels]));
    cards.forEach(([l,v])=> sum.appendChild(el('div',{class:'card'},[el('div',{class:'k'},[v]),el('div',{class:'l'},[l])])));

    renderGenes('upGenes','upJac', geneSet(A,'up'),geneSet(B,'up'), A.genes.up||[], B.genes.up||[], 'up');
    renderGenes('downGenes','downJac', geneSet(A,'down'),geneSet(B,'down'), A.genes.down||[], B.genes.down||[], 'down');
    renderPW(A,B);
  }catch(e){ st.textContent=e.message; }
}
function renderGenes(boxId,chipId, aSet,bSet, aList,bList, dir){
  const shared=aSet.filter(g=> bSet.includes(g));
  document.getElementById(chipId).textContent = `${shared.length} shared · Jaccard ${fmt(jaccard(aSet,bSet),2)}`;
  const aMap=Object.fromEntries(aList), bMap=Object.fromEntries(bList);
  const t=el('table',{}); t.appendChild(el('tr',{},[el('th',{},['Gene']),el('th',{},['A log2FC']),el('th',{},['B log2FC'])]));
  shared.forEach(g=>{ t.appendChild(el('tr',{},[el('td',{class:dir},[g]),
    el('td',{class:'num'},[fmt(aMap[g],2)]),el('td',{class:'num'},[fmt(bMap[g],2)])])); });
  if(!shared.length) t.appendChild(el('tr',{},[el('td',{},['(none in common among stored top-N)'])]));
  const box=document.getElementById(boxId); box.innerHTML=''; box.appendChild(t);
}
function renderPW(A,B){
  const box=document.getElementById('pw'); box.innerHTML='';
  const t=el('table',{}); t.appendChild(el('tr',{},[el('th',{},['Direction']),el('th',{},['Pathway']),el('th',{},['A FDR']),el('th',{},['B FDR'])]));
  let any=false;
  ['up','down'].forEach(dir=>{
    const aMap=Object.fromEntries(A.pathways[dir]||[]), bMap=Object.fromEntries(B.pathways[dir]||[]);
    Object.keys(aMap).filter(p=> p in bMap).forEach(p=>{ any=true;
      t.appendChild(el('tr',{},[el('td',{class:dir},[dir]),el('td',{},[p]),el('td',{class:'num'},[fmt(aMap[p],4)]),el('td',{class:'num'},[fmt(bMap[p],4)])])); });
  });
  if(!any) t.appendChild(el('tr',{},[el('td',{},['(no shared enriched Hallmark pathways)'])]));
  box.appendChild(t);
}
document.getElementById('go').addEventListener('click', run);
function showError(e){ document.getElementById('status').textContent=e.message; }
(async ()=>{
  CAT=await loadJSON('catalog.json');
  const sides=await Promise.all([wireSide('a',0),wireSide('b',1)]);
  document.getElementById('surprise').addEventListener('click',async()=>{
    const button=document.getElementById('surprise'); button.disabled=true;
    document.getElementById('status').textContent='finding an unexpected pair…';
    try{ await Promise.all(sides.map(side=>side.randomize())); await run(); }
    finally{ button.disabled=false; }
  });
  document.getElementById('status').textContent='ready';
})().catch(showError);
