const DailyBatch={active:false,area:'',code:'',machine:'',reports:[],editIndex:-1};
const dailyBatchKey=()=>'mtto_daily_batch';
function loadDailyBatch(){try{const v=JSON.parse(store.get(dailyBatchKey(),'[]'));return Array.isArray(v)?v:[]}catch(e){return[]}}
function saveDailyBatch(){store.set(dailyBatchKey(),JSON.stringify(DailyBatch.reports))}
function startWorkflow(kind){
  resetRuntime(kind==='daily'?'daily':'preventive');Runtime.workflow=kind;
  if(kind==='daily')beginDailyBatch();else go('preventiveArea');
}
function choosePreventiveArea(area,code){
  resetRuntime('preventive',{area,code});
  const data=MACHINE_DB[code];if(!data){toast('No se encontró el área en el catálogo.');return}
  $('preventiveMachineSubtitle').textContent=area+' · '+data.machines.length+' máquinas';
  $('preventiveMachineChoices').innerHTML=data.machines.map(name=>'<button class="area" onclick="choosePreventiveMachine(&quot;'+esc(name)+'&quot;,&quot;'+esc(code)+'&quot;)"><b>'+esc(name)+'</b></button>').join('');
  go('preventiveMachine');
}
function choosePreventiveMachine(machine,code){
  resetRuntime('preventive',{area:MACHINE_DB[code].area,code,machine});
  startCheck('preventive');
}
function beginDailyBatch(){
  DailyBatch.active=true;DailyBatch.reports=loadDailyBatch();DailyBatch.editIndex=-1;
  renderDailyBatch();go('dailyArea');
}
function chooseDailyArea(area,code){
  const dbCode=code==='E1AREA'?'E1':code==='E2AREA'?'E2':code;
  DailyBatch.area=area;DailyBatch.code=code;
  const data=MACHINE_DB[dbCode];const list=(data?data.machines:[]).map(name=>({name,code:dbCode})),done=new Set(DailyBatch.reports.map(r=>r.machine));
  $('dailyMachineSubtitle').textContent=area+' · '+list.length+' máquinas';
  $('customMachine').value='';
  $('dailyMachineChoices').innerHTML=list.map(m=>'<button class="area" onclick="selectDailyMachine(&quot;'+esc(m.name)+'&quot;,&quot;'+esc(m.code)+'&quot;)"><b>'+esc(m.name)+(done.has(m.name)?' ✓':'')+'</b></button>').join('');
  go('dailyMachine');
}
function startDailyArea(area,code){beginDailyBatch();chooseDailyArea(area,code)}
function chooseCustomDailyMachine(){
  const name=$('customMachine').value.trim();
  if(!name){toast('Escribe el nombre de la máquina.');$('customMachine').focus();return}
  const code=DailyBatch.code==='E1AREA'?'E1':DailyBatch.code==='E2AREA'?'E2':DailyBatch.code;
  selectDailyMachine(name,code);
}
function selectDailyMachine(machine,code){
  DailyBatch.machine=machine;resetRuntime('daily',{area:DailyBatch.area,code,machine,batchMode:true});
  startCheck('daily');
}
function renderDailyBatch(){
  const reports=DailyBatch.reports;
  $('dailyBatchCount').textContent=reports.length+' '+(reports.length===1?'informe recopilado':'informes recopilados');
  $('dailyBatchEmpty').hidden=reports.length>0;
  $('dailyBatchList').innerHTML=reports.map((r,i)=>'<div class="rec"><div><b>'+esc(r.machine||r.area)+'</b><span>'+esc(r.area)+' · '+esc(r.date)+' '+esc(r.time)+'</span></div><div style="display:flex;gap:8px"><button class="link" onclick="editDailyReport('+i+')">Editar</button><button class="link" onclick="removeDailyReport('+i+')" aria-label="Eliminar informe de '+esc(r.machine||r.area)+'">Eliminar</button></div></div>').join('');
  $('finishBatchBtn').disabled=reports.length===0;
}
function editDailyReport(i){
  const report=DailyBatch.reports[i];if(!report)return;
  resetRuntime('daily',{area:report.area,code:report.code,machine:report.machine,batchMode:true});
  DailyBatch.editIndex=i;DailyBatch.area=report.area;DailyBatch.code=report.code==='E1'||report.code==='E2'?'EXT':report.code;DailyBatch.machine=report.machine;
  startCheck('daily');
  setFormState(normalizeDraft(report.draft));
  toast('Edita el informe y vuelve a agregarlo al lote.');
}
function removeDailyReport(i){
  if(!confirm('¿Eliminar el informe de '+(DailyBatch.reports[i]?.machine||'esta máquina')+'?'))return;
  DailyBatch.reports.splice(i,1);saveDailyBatch();renderDailyBatch();toast('Informe eliminado.');
}
function leaveDailyBatch(){
  if(DailyBatch.reports.length){
    if(confirm('Has recopilado '+DailyBatch.reports.length+' informe(s). ¿Deseas generar ahora los archivos con el formato seleccionado?')){
      finishDailyBatch(true);return;
    }
    if(!confirm('Los informes quedarán guardados temporalmente en este dispositivo. ¿Deseas salir sin generar el Excel por ahora?'))return;
  }
  go('menu');
}
async function finishDailyBatch(skipConfirm=false){
  if(!DailyBatch.reports.length){toast('Agrega al menos una máquina.');return}
  const b=$('finishBatchBtn');b.disabled=true;b.textContent='Generando…';
  try{
    const baseName='LOTE-EXT1Y2-'+new Date().toISOString().slice(0,10).replaceAll('-','');
    const results=await generateExports(batchExcelRows(),baseName,selectedExport('batchExportChoice'));
    showDone(results,'Reporte diario generado');
    addRecent({n:results.map(r=>r.name).join(', '),a:'Diario ('+DailyBatch.reports.length+' máquinas)',w:new Date().toLocaleDateString('es-MX'),k:'daily'});
    DailyBatch.reports=[];DailyBatch.active=false;saveDailyBatch();store.del(dailyBatchKey());Runtime.batchMode=false;
    history.replaceState({s:'done'},'');show('done');
  }catch(e){toast(e.message||'No se pudo generar el reporte.')}
  finally{b.disabled=false;b.textContent='Terminar y guardar';renderDailyBatch()}
}
