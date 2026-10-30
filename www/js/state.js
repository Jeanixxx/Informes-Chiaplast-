/* Estado de flujo y de formulario.
   resetRuntime fija el contexto de cada flujo; getFormState/setFormState son la única
   serialización del formulario (borrador, lote diario). setFormState(null) limpia todo. */
const FLOWS={
  daily:{checkType:'daily',workflow:'daily',release:{status:'in_progress',machineStatus:'',comments:''}},
  preventive:{checkType:'preventive',workflow:'preventive',release:{status:'in_progress',machineStatus:'',comments:''}}
};
function resetRuntime(flow,ctx={}){
  Object.assign(Runtime,{area:'',code:'',machine:'',rows:[],batchMode:false},FLOWS[flow]||FLOWS.preventive,ctx);
  DailyBatch.editIndex=-1;
  if(flow!=='daily')DailyBatch.machine='';
}

const FORM_FIELDS={
  text:['d','t','obs','pmStartDate','pmStartTime','pmStopDate','pmStopTime','motorHz','ccmApproval','ccmName','pmObservations','respSigName','productionName','releaseMachineStatus','releaseComments'],
  choice:['gType','gStatus'],
  pmOnly:['pmStartDate','pmStartTime','pmStopDate','pmStopTime','motorHz','ccmApproval','ccmName','pmObservations','respSigName','productionName']
};

function getFormState(){
  const daily=isDaily(),s={v:2,flow:Runtime.checkType,code:Runtime.code,area:Runtime.area,machine:Runtime.machine||'',
    updated:Date.now(),fields:{},choices:{},ext:extState(),signatures:{},photos:{},rows:Runtime.rows||[],release:Runtime.release||{status:'in_progress',machineStatus:'',comments:''}};
  FORM_FIELDS.text.forEach(id=>{const el=$(id);if(el&&!(daily&&FORM_FIELDS.pmOnly.includes(id)))s.fields[id]=el.value});
  FORM_FIELDS.choice.forEach(id=>{s.choices[id]=$(id).dataset.v||''});
  if(!daily)s.signatures={ccm:Signatures.ccm.hex,responsable:Signatures.responsable.hex,production:Signatures.production.hex};
  return s;
}

function setFormState(s){
  s=s||{};const f=s.fields||{},c=s.choices||{},sg=s.signatures||{};
  Runtime.rows=Array.isArray(s.rows)?s.rows:[];
  Runtime.release={status:s.release&&s.release.status||'in_progress',machineStatus:s.release&&s.release.machineStatus||'',comments:s.release&&s.release.comments||''};
  FORM_FIELDS.text.forEach(id=>{const el=$(id);if(el)el.value=f[id]||''});
  FORM_FIELDS.choice.forEach(id=>{const x=$(id),v=c[id]||'';x.dataset.v=v;x.classList.remove('bad');
    x.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.textContent===v))});
  extLoad(s.ext||{});
  restoreSignature('ccm',sg.ccm||'');restoreSignature('responsable',sg.responsable||'');restoreSignature('production',sg.production||'');
  Signatures.ccm.name=($('ccmName').value||'').trim();Signatures.responsable.name=($('respSigName').value||'').trim();Signatures.production.name=($('productionName').value||'').trim();
}

/* Acepta el formato v2 y los formatos anteriores (borrador corto y lote diario viejo). */
function normalizeDraft(r){
  if(!r||r.v===2)return r;
  if(r.fields!==undefined||r.type!==undefined){
    return {v:2,flow:'daily',fields:{d:r.d,t:r.t,obs:r.obs},choices:{gType:r.type,gStatus:r.st},ext:r.fields||{},signatures:{}};
  }
  const f={d:r.d,t:r.h,obs:r.o,respSigName:r.respSigner};
  ['pmStartDate','pmStartTime','pmStopDate','pmStopTime','motorHz','ccmApproval','ccmName','pmObservations'].forEach(k=>{f[k]=r[k]});
  return {v:2,flow:r.k||'preventive',code:r.c||r.code,area:r.area,machine:r.machine,updated:r.updated,
    fields:f,choices:{gType:r.t,gStatus:r.s},ext:r.x||{},signatures:{ccm:r.ccmSig,responsable:r.respSig},rows:[],release:{status:'in_progress',machineStatus:'',comments:''}};
}
