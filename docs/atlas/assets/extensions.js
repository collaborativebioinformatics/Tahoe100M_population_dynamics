const EXTENSION_DATA='extensions/';

function loadExtensionJSON(path){ return loadJSON(EXTENSION_DATA+path); }
function tableCell(value,numeric){
  const cell=el('td',{},[value===null||value===undefined?'–':String(value)]);
  if(numeric) cell.className='num';
  return cell;
}
function humanBytes(bytes){
  const units=['B','KB','MB','GB']; let value=Number(bytes),index=0;
  while(value>=1024&&index<units.length-1){ value/=1024; index++; }
  return `${value.toFixed(index?1:0)} ${units[index]}`;
}
function compactDose(value){ return `${doseLabel(value)} µM`; }
function clearAndMessage(node,message,colspan){
  node.textContent='';
  if(node.tagName==='TBODY') node.appendChild(el('tr',{},[el('td',{colspan:String(colspan||1)},[message])]));
  else node.appendChild(el('div',{class:'empty-state'},[message]));
}

document.addEventListener('DOMContentLoaded',()=>{
  const page=location.pathname.split('/').pop()||'extensions.html';
  document.querySelectorAll('.extension-tabs a').forEach(link=>{
    if(link.getAttribute('href')===page) link.classList.add('active');
  });
});
