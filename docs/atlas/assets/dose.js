let doseData,doseCurves={},cellPoints={};
const SVG_NS='http://www.w3.org/2000/svg';

function svgElement(tag,attributes,text){
  const node=document.createElementNS(SVG_NS,tag);
  Object.entries(attributes||{}).forEach(([key,value])=>node.setAttribute(key,String(value)));
  if(text!==undefined) node.textContent=text;
  return node;
}

function drawDoseCurve(curve){
  const svg=document.getElementById('doseChart'); svg.textContent='';
  svg.appendChild(svgElement('title',{id:'doseChartTitle'},`${curve.cell_line} ${curve.drug} response across three measured doses`));
  svg.appendChild(svgElement('desc',{id:'doseChartDesc'},'Three measured pseudobulk dose points connected by a descriptive line; the dashed zero line is an analytical baseline from measured DMSO.'));
  const width=640,height=330,left=62,right=25,top=30,bottom=58;
  const doses=curve.doses_uM.map(Number),values=curve.magnitude.map(Number);
  const xMin=Math.log10(Math.min(...doses)),xMax=Math.log10(Math.max(...doses));
  const yMax=Math.max(...values)*1.18;
  const X=value=>left+(Math.log10(value)-xMin)/(xMax-xMin)*(width-left-right);
  const Y=value=>height-bottom-value/yMax*(height-top-bottom);

  for(let i=0;i<=4;i++){
    const value=yMax*i/4,y=Y(value);
    svg.appendChild(svgElement('line',{x1:left,y1:y,x2:width-right,y2:y,class:'dose-grid'}));
    svg.appendChild(svgElement('text',{x:left-10,y:y+4,class:'dose-tick','text-anchor':'end'},fmt(value,1)));
  }
  svg.appendChild(svgElement('line',{x1:left,y1:top,x2:left,y2:height-bottom,class:'dose-axis'}));
  svg.appendChild(svgElement('line',{x1:left,y1:height-bottom,x2:width-right,y2:height-bottom,class:'dose-baseline'}));
  svg.appendChild(svgElement('text',{x:left+5,y:height-bottom-7,class:'dose-baseline-label'},'analytical DMSO baseline = 0'));
  svg.appendChild(svgElement('text',{x:17,y:top+8,class:'dose-axis-label'},'response'));
  svg.appendChild(svgElement('text',{x:width-right,y:height-14,class:'dose-axis-label','text-anchor':'end'},'measured dose (log scale)'));
  const path=values.map((value,index)=>`${index?'L':'M'} ${X(doses[index])} ${Y(value)}`).join(' ');
  svg.appendChild(svgElement('path',{d:path,class:'dose-path'}));
  doses.forEach((dose,index)=>{
    const x=X(dose),y=Y(values[index]);
    svg.appendChild(svgElement('circle',{cx:x,cy:y,r:7,class:'dose-dot'}));
    svg.appendChild(svgElement('text',{x,y:y-15,class:'dose-point-value','text-anchor':'middle'},fmt(values[index],2)));
    svg.appendChild(svgElement('text',{x,y:height-bottom+24,class:'dose-x-label','text-anchor':'middle'},compactDose(dose)));
  });
}

function renderDoseSide(curve,point){
  const box=document.getElementById('doseSide'); box.textContent='';
  box.appendChild(el('div',{class:'inspector-label'},['REAL CELL-LEVEL PILOT']));
  if(!point){ box.appendChild(el('div',{class:'empty-state'},['Not computed for this condition.'])); return; }
  box.appendChild(el('div',{class:'inspector-drug'},[compactDose(point.measured_dose_uM)]));
  box.appendChild(el('div',{class:'inspector-context'},[`${point.source_plate} · matched measured DMSO`]));
  box.appendChild(el('div',{class:'inspector-metrics'},[
    el('span',{},[el('b',{},[fmt(point.cell_treated_minus_dmso_median,3)]),' cell median Δ']),
    el('span',{},[el('b',{},[fmt(point.control_like_frac_p95,3)]),' control-like p95'])
  ]));
  const table=el('table',{class:'dose-side-table'});
  [['Treated cells',point.n_treated_qc.toLocaleString()],['DMSO cells',point.n_dmso_qc.toLocaleString()],['Pseudobulk doses',String(point.pseudobulk_n_doses)],['Dose Spearman ρ',fmt(point.pseudobulk_spearman,2)],['EC50','Not reportable']].forEach(([label,value])=>{
    table.appendChild(el('tr',{},[el('th',{},[label]),tableCell(value,true)]));
  });
  box.appendChild(table);
  box.appendChild(el('p',{class:'inspector-note'},[point.ec50_reason]));
}

function renderDose(){
  const key=document.getElementById('doseCondition').value,curve=doseCurves[key],point=cellPoints[key];
  if(!curve) return;
  document.getElementById('doseTitle').textContent=`${curve.cell_line} × ${curve.drug}`;
  document.getElementById('doseTrend').textContent=point?`Spearman ρ ${fmt(point.pseudobulk_spearman,2)} · observed only`:'Observed three-point curve';
  drawDoseCurve(curve); renderDoseSide(curve,point);
  const plates=document.getElementById('dosePlates'); plates.textContent='';
  curve.doses_uM.forEach((dose,index)=>plates.appendChild(el('span',{},[`${compactDose(dose)} · plate(s) ${curve.plates_per_dose[index]}`])));
}

(async()=>{
  doseData=await loadExtensionJSON('dose_response.json');
  doseData.pilot_dose_curves.forEach(curve=>{ doseCurves[`${curve.cell_line} · ${curve.drug}`]=curve; });
  doseData.cell_level_pilot.forEach(point=>{ cellPoints[`${point.cell_line} · ${point.drug}`]=point; });
  const select=document.getElementById('doseCondition'); opt(select,Object.keys(doseCurves).sort());
  select.addEventListener('change',renderDose);
  document.getElementById('randomDose').addEventListener('click',()=>{
    let next=Math.floor(Math.random()*select.options.length); if(select.options.length>1&&next===select.selectedIndex) next=(next+1)%select.options.length;
    select.selectedIndex=next; renderDose();
  });
  renderDose();
})().catch(error=>{ document.getElementById('dosePlates').textContent=error.message; });
