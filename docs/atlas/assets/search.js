let CONDS=null, GENESET=null, bucketCache={};
const NB=128;

function bucketOf(g){
  let h=0;
  for(let i=0;i<g.length;i++) h=(h+g.charCodeAt(i))%NB;
  return h;
}
async function getBucket(b){
  if(!(b in bucketCache)) bucketCache[b]=await loadJSON('search/buckets/b'+b+'.json.gz');
  return bucketCache[b];
}
function parseGenes(s){
  return [...new Set(s.toUpperCase().split(/[\s,;]+/).map(x=>x.trim()).filter(Boolean))];
}
function td(v,num){
  const t=el('td',{},[String(v)]);
  if(num) t.className='num';
  return t;
}
function fillAll(sel, values, allLabel, numeric){
  sel.textContent='';
  sel.appendChild(el('option',{value:''},[allLabel]));
  const vals=[...new Set(values)];
  vals.sort(numeric ? (a,b)=>Number(a)-Number(b) : (a,b)=>String(a).localeCompare(String(b)));
  vals.forEach(v=>sel.appendChild(el('option',{value:String(v)},[numeric?doseLabel(v):String(v)])));
}
async function ensureData(){
  if(!CONDS){
    const c=await loadJSON('search/conditions.json.gz');
    CONDS=c.conditions;
    fillAll(document.getElementById('filterCell'),CONDS.map(x=>x.cl),'All cell lines',false);
    fillAll(document.getElementById('filterDrug'),CONDS.map(x=>x.dg),'All drugs',false);
    fillAll(document.getElementById('filterDose'),CONDS.map(x=>x.c),'All doses (µM)',true);
  }
  if(!GENESET) GENESET=new Set((await loadJSON('gene_list.json')).genes);
}
function conditionPasses(c){
  const cell=document.getElementById('filterCell').value;
  const drug=document.getElementById('filterDrug').value;
  const dose=document.getElementById('filterDose').value;
  return (!cell||c.cl===cell) && (!drug||c.dg===drug) && (!dose||String(c.c)===dose);
}
function renderRows(tableId, rows, reverse){
  const tb=document.querySelector('#'+tableId+' tbody');
  tb.textContent='';
  rows.slice(0,50).forEach((r,i)=>{
    const c=CONDS[r.cid];
    tb.appendChild(el('tr',{},[
      td(i+1,1),td(c.cl),td(c.dg),td(doseLabel(c.c)+' µM',1),td(c.p,1),
      td(fmt(reverse?-r.s:r.s,3),1),td(r.h+'/'+r.denom,1),
      td(c.ns.toLocaleString(),1),td(fmt(c.m,2),1)
    ]));
  });
  if(!rows.length){
    const cell=el('td',{colspan:'9'},['No conditions passed the current filters and minimum gene-hit threshold.']);
    tb.appendChild(el('tr',{},[cell]));
  }
}
function showInputNotes(unknown, conflicts){
  const box=document.getElementById('inputNotes');
  box.textContent='';
  const parts=[];
  if(conflicts.length) parts.push('Entered as both up and down (excluded): '+conflicts.join(', '));
  if(unknown.length) parts.push('Not present in the indexed top-DE (skipped): '+unknown.join(', '));
  if(parts.length){
    parts.forEach(p=>box.appendChild(el('div',{},[p])));
    box.style.display='';
  }else box.style.display='none';
}

async function run(){
  const st=document.getElementById('status');
  const go=document.getElementById('go');
  st.textContent='loading index…'; go.disabled=true;
  try{
    await ensureData();
    const upInput=parseGenes(document.getElementById('up').value);
    const downInput=parseGenes(document.getElementById('down').value);
    const downSet=new Set(downInput);
    const conflicts=upInput.filter(g=>downSet.has(g));
    const conflictSet=new Set(conflicts);
    const up=upInput.filter(g=>!conflictSet.has(g));
    const down=downInput.filter(g=>!conflictSet.has(g));
    const entered=[...new Set([...up,...down])];
    const known=entered.filter(g=>GENESET.has(g));
    const unknown=entered.filter(g=>!GENESET.has(g));
    showInputNotes(unknown,conflicts);
    if(known.length<3){
      renderRows('matchTbl',[],false); renderRows('reverseTbl',[],true);
      st.textContent=`Enter at least 3 recognized, non-conflicting genes (${known.length} recognized).`;
      return;
    }

    st.textContent='scoring real conditions…';
    const buckets=await Promise.all([...new Set(known.map(bucketOf))].map(getBucket));
    const postings={}; buckets.forEach(b=>Object.assign(postings,b));
    const weights={}; up.forEach(g=>weights[g]=1); down.forEach(g=>weights[g]=-1);
    const score={}, hit={};
    known.forEach(g=>{
      const arr=postings[g]||[], w=weights[g];
      for(let i=0;i<arr.length;i++){
        const cid=arr[i][0], lfc=arr[i][1];
        score[cid]=(score[cid]||0)+w*lfc;
        hit[cid]=(hit[cid]||0)+1;
      }
    });
    const denom=known.length;
    const minHits=Math.min(10,Math.max(3,Math.ceil(denom*0.1)));
    const rows=Object.keys(score).map(cid=>({cid:Number(cid),s:score[cid]/denom,h:hit[cid],denom}))
      .filter(r=>r.h>=minHits && CONDS[r.cid] && conditionPasses(CONDS[r.cid]));
    const matches=rows.filter(r=>r.s>0).sort((a,b)=>b.s-a.s);
    const reversals=rows.filter(r=>r.s<0).sort((a,b)=>a.s-b.s);
    renderRows('matchTbl',matches,false); renderRows('reverseTbl',reversals,true);
    st.textContent=`${rows.length.toLocaleString()} conditions passed filters · ${denom} recognized genes · at least ${minHits} hits required`;
  }catch(e){
    st.textContent=e.message;
  }finally{
    go.disabled=false;
  }
}

document.getElementById('go').addEventListener('click',run);
document.getElementById('ex1').addEventListener('click',()=>{
  document.getElementById('up').value='MKI67 TOP2A CCNB1 BIRC5 CENPF';
  document.getElementById('down').value=''; run();
});
document.getElementById('ex2').addEventListener('click',()=>{
  document.getElementById('up').value='CDKN1A GADD45A MDM2 BAX';
  document.getElementById('down').value='CCNB1 CCNB2'; run();
});
document.getElementById('ex3').addEventListener('click',()=>{
  document.getElementById('up').value='NFKBIA TNFAIP3 CXCL8 IL6 CCL2';
  document.getElementById('down').value=''; run();
});

(async()=>{
  document.getElementById('status').textContent='loading searchable catalog…';
  await ensureData();
  document.getElementById('status').textContent='ready · enter at least 3 recognized genes';
})().catch(e=>document.getElementById('status').textContent=e.message);
