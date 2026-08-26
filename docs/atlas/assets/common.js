// Shared helpers — vanilla JS, no framework or application server required.
const DATA = 'data/';
let savedTheme=null;
try{ savedTheme=localStorage.getItem('tahoe-atlas-theme'); }catch(_error){}
if(savedTheme==='dark'||savedTheme==='light') document.documentElement.dataset.theme=savedTheme;
async function loadJSON(path){
  const r = await fetch(DATA+path);
  if(!r.ok) throw new Error('fetch failed: '+path+' ('+r.status+')');
  if(path.endsWith('.gz') && r.headers.get('content-encoding')!=='gzip'){
    if(!('DecompressionStream' in window)){
      throw new Error('This browser cannot open the compressed atlas index. Please use a current Chrome, Edge, Firefox, or Safari release.');
    }
    const stream=r.body.pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).json();
  }
  return r.json();
}
function el(tag, attrs, children){
  const e=document.createElement(tag);
  if(attrs) for(const k in attrs){ if(k==='class') e.className=attrs[k]; else e.setAttribute(k,attrs[k]); }
  (children||[]).forEach(c=> e.appendChild(typeof c==='string'?document.createTextNode(c):c));
  return e;
}
function fmt(x,d){ return (x===null||x===undefined||Number.isNaN(x))?'–':Number(x).toFixed(d===undefined?2:d); }
function doseLabel(x){ return String(Number(Number(x).toPrecision(6))); }
function opt(sel, values, sort){ // fill a <select>
  sel.innerHTML=''; const vs= sort? [...values].sort(): values;
  vs.forEach(v=> sel.appendChild(el('option',{value:v},[String(v)])));
}
function bar(v,max,w){ const px=Math.max(1,Math.round((v/max)*(w||120))); const s=el('span',{class:'bar'}); s.style.width=px+'px'; return s; }
function jaccard(a,b){ const A=new Set(a),B=new Set(b); let i=0; A.forEach(x=>{if(B.has(x))i++}); const u=A.size+B.size-i; return u?i/u:0; }
function cosine(a,b){ let d=0,na=0,nb=0; for(let i=0;i<a.length;i++){d+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i];} return (na&&nb)? d/Math.sqrt(na*nb):0; }
function safe(name){ return String(name).replace(/\//g,'_').replace(/ /g,'_'); }
function debounce(fn,ms){ let t; return (...a)=>{clearTimeout(t); t=setTimeout(()=>fn(...a),ms);}; }
function animateNumber(node,value){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){ node.textContent=value.toLocaleString(); return; }
  const start=performance.now(),duration=780;
  function frame(now){
    const p=Math.min(1,(now-start)/duration),eased=1-Math.pow(1-p,3);
    node.textContent=Math.round(value*eased).toLocaleString();
    if(p<1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
// active nav link
document.addEventListener('DOMContentLoaded',()=>{
  const p=(location.pathname.split('/').pop()||'index.html');
  const extensionPages=new Set(['mutation.html','celllevel.html','dose.html']);
  document.querySelectorAll('header.top nav a').forEach(a=>{
    if(a.getAttribute('href')===p||(extensionPages.has(p)&&a.getAttribute('href')==='extensions.html')) a.classList.add('active');
  });
  const header=document.querySelector('header.top');
  if(header){
    const themeButton=el('button',{class:'theme-toggle',type:'button','aria-label':'Toggle light and dark theme',title:'Toggle theme'},[]);
    const syncTheme=()=>{ themeButton.textContent=document.documentElement.dataset.theme==='dark'?'☀':'☾'; };
    themeButton.addEventListener('click',()=>{
      const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
      document.documentElement.dataset.theme=next;
      try{ localStorage.setItem('tahoe-atlas-theme',next); }catch(_error){}
      syncTheme();
    });
    syncTheme(); header.appendChild(themeButton);
  }
  loadJSON('release.json').then(r=>{
    const stamp=`Data ${r.release} · updated ${r.updated}`;
    document.querySelectorAll('[data-release]').forEach(node=>{ node.textContent=stamp; });
  }).catch(()=>{
    document.querySelectorAll('[data-release]').forEach(node=>{ node.textContent='Version metadata unavailable'; });
  });
});
