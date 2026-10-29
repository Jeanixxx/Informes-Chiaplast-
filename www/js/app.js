const $=id=>document.getElementById(id);
const HELP={"menu": "Chequeo diario: elige una máquina, captura y termina; luego otra máquina o termina para generar un solo documento. Los datos se guardan en este dispositivo.", "dailyArea": "Elige el área y la máquina. Puedes agregar tantas máquinas como quieras en un solo reporte.", "dailyMachine": "Toca una máquina para capturarla. ✓ indica que ya está en el reporte. Si no aparece, usa \"Otra máquina\".", "dailyBatch": "Aquí ves las máquinas del reporte. Agrega otra, edita o elimina. \"Terminar y guardar\" crea un solo documento y lo guarda en Descargas/Chiaplast.", "form": "Completa los campos en rojo y continúa.", "notes": "Las notas y fotos se conservan 30 días y luego se eliminan. Genera el PDF si necesitas conservarlas.", "reminders": "Los avisos se programan en Android por máquina, fecha y hora.", "kanban": "Organiza tareas de mantenimiento por estado.", "preventiveBoard": "Toca una máquina para marcar su preventivo del mes con la fecha elegida. Se guarda solo en este dispositivo; cambia de mes con las flechas y exporta el CSV si quieres un respaldo."};
function showHelp(){const a=document.querySelector('.screen.active');$('helpText').textContent=HELP[a&&a.id]||HELP.menu;$('helpModal').hidden=false}
document.querySelectorAll('.screen:not(.splash):not(.login) .bar').forEach(b=>{const h=document.createElement('button');h.className='iconbtn';h.style.cssText='width:38px;height:38px;font-size:17px;margin-left:auto';h.textContent='?';h.setAttribute('aria-label','Ayuda');h.onclick=showHelp;b.appendChild(h)});
const AppState={session:false,user:'',settings:{},history:[]};
const Runtime={area:'',code:'',checkType:'preventive',workflow:'preventive',rows:[],machine:'',batchMode:false};
const DailyBatch={active:false,area:'',code:'',machine:'',reports:[],editIndex:-1};
const dailyBatchKey=()=>'mtto_daily_batch';
function loadDailyBatch(){try{const v=JSON.parse(store.get(dailyBatchKey(),'[]'));return Array.isArray(v)?v:[]}catch(e){return[]}}
function saveDailyBatch(){store.set(dailyBatchKey(),JSON.stringify(DailyBatch.reports))}
/* Catálogo único de máquinas: lo comparten chequeo diario y mantenimiento preventivo. */
const MACHINE_DB={
  E1:{area:'Extrusión 1',machines:['EXT-19','ECB-1','CRI-3','CRI-4','CRI-5','EXT-6','EXT-8','EXT-9','EXT-10','EXT-11','EXT-12','EXT-13','EXT-14','EXT-15','EXT-16','EXT-17','EXT-20','EXT-21','EXT-22','EXT-A1','EXT-A2','RF','EXT-N1','EXT-N2','FUELLADORA','EXT-A3']},
  E2:{area:'Extrusión 2',machines:['EXT-A4','EXT-A5','EXT-A6','EXT-A7','EXT-A8','EXT-A9','EXT-A10','EXT-A11','EXT-A12','EXT-A13','EXT-N3','EXT-N4','EXT-N5','EXT-N6','EXT-N7','CRI-1','CRI-2']},
  CAM:{area:'CAM',machines:['BK-1','BK-2','BK-3','BK-4','BK-5','BK-6','BK-7','BK-8','BNG-1','BNG-2','BC-1','IMP-1','IMP-2','IMP-3']},
  DIM:{area:'DIM',machines:['BM-1','BM-2','BM-3','BM-4','BM-5','BD-1','BD-2','BD-3','SELLADORA M1','SELLADORA M2','SELLADORA M3','SELLADORA M4','SELLADORA M5','HORNO M','FLEJADORA']},
  BSL:{area:'BSL',machines:['BW-1','BN-1','BN-2','BN-3','BN-4','B-02','B-03','B-06','BSL-1','BSL-2','BSL-3','BSL-4','BSL-5','BSL-6','BD-4']}
};
function startWorkflow(kind){
  Runtime.workflow=kind;Runtime.checkType=kind==='daily'?'daily':'preventive';
  if(kind==='daily')beginDailyBatch();else go('preventiveArea');
}
function choosePreventiveArea(area,code){
  Runtime.area=area;Runtime.code=code;Runtime.machine='';
  const data=MACHINE_DB[code];if(!data){toast('No se encontró el área en el catálogo.');return}
  $('preventiveMachineSubtitle').textContent=area+' · '+data.machines.length+' máquinas';
  $('preventiveMachineChoices').innerHTML=data.machines.map(name=>'<button class="area" onclick="choosePreventiveMachine(&quot;'+esc(name)+'&quot;,&quot;'+esc(code)+'&quot;)"><b>'+esc(name)+'</b></button>').join('');
  go('preventiveMachine');
}
function choosePreventiveMachine(machine,code){
  Runtime.area=MACHINE_DB[code].area;Runtime.code=code;Runtime.machine=machine;Runtime.workflow='preventive';Runtime.batchMode=false;
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
  DailyBatch.machine=machine;Runtime.area=DailyBatch.area;Runtime.code=code;Runtime.machine=machine;Runtime.batchMode=true;
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
  DailyBatch.editIndex=i;DailyBatch.area=report.area;DailyBatch.code=report.code==='E1'||report.code==='E2'?'EXT':report.code;DailyBatch.machine=report.machine;
  Runtime.area=report.area;Runtime.code=report.code;Runtime.machine=report.machine;Runtime.batchMode=true;
  startCheck('daily');
  $('d').value=report.draft.d||'';$('t').value=report.draft.t||'';
  $('gType').dataset.v=report.draft.type||'';$('gStatus').dataset.v=report.draft.st||'';
  ['gType','gStatus'].forEach(id=>$(id).querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.textContent===$(id).dataset.v)));
  $('obs').value=report.draft.obs||'';extLoad(report.draft.fields||{});
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
const LastExports=[];
function showDone(results,title){
  $('rFile').textContent=results.map(r=>r.name).join(' · ');
  $('rTitle').textContent=title;
  const saved=results.some(r=>r.mode==='android-saved');
  $('rMsg').textContent=saved?'Guardado en Descargas/Chiaplast':'Descargado en el dispositivo';
  $('shareBtns').innerHTML=LastExports.map((f,k)=>'<button class="btn btn-s" style="flex:none;width:100%;margin-bottom:8px" onclick="shareLast('+k+')">Compartir '+esc(f.name.split('.').pop().toUpperCase())+'</button>').join('');
}
function shareLast(k){const f=LastExports[k];if(f&&window.ChiaplastNative)window.ChiaplastNative.shareReport(f.name,f.mime,f.b64)}
let storageWarningShown=false;
const store={
  get(k,d){try{const v=localStorage.getItem(k);return v===null?d:v}catch(e){return d}},
  set(k,v){
    try{localStorage.setItem(k,v);return true}
    catch(e){
      if(!storageWarningShown){
        storageWarningShown=true;
        setTimeout(()=>toast('El dispositivo no permitió guardar los datos. Exporta el reporte antes de salir.'),0);
      }
      return false;
    }
  },
  del(k){try{localStorage.removeItem(k)}catch(e){}}
};
function currentUser(){return AppState.user||store.get('mtto_user','')}
function syncAppState(){AppState.session=store.get('mtto_session','false')==='true';AppState.user=store.get('mtto_user','');AppState.history=getRecent()}
AppState.session=store.get('mtto_session','false')==='true';AppState.user=store.get('mtto_user','');

/* Navegación con soporte del botón Atrás de Android */
function show(id){
  const app=document.querySelector('.app');
  const showChrome=id!=='splash'&&id!=='login';
  app.classList.toggle('has-chrome',showChrome);
  const preventiveScreen=['preventiveCalendar','preventiveOrder','preventiveArea','preventiveMachine','preventiveBoard'].includes(id)||(id==='form'&&Runtime.workflow==='preventive');
  document.querySelectorAll('.app-sidebar [data-nav]').forEach(button=>button.classList.toggle('active',button.dataset.nav===id||(preventiveScreen&&button.dataset.nav==='preventive')));
  $('topbarUser').textContent=currentUser()||'Técnico';
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  $(id).classList.add('active');
  const b=$(id).querySelector('.body'); if(b) b.scrollTop=0;
  if(id==='menu'){renderRecent();renderHomeFollowup()}
  if(id==='specialWorks')specialRender();
  if(id==='preventiveBoard')renderPmBoard();
  if(id==='preventiveCalendar')renderPreventiveCalendar();
  if(id==='preventiveOrder')renderPreventiveOrder();
  if(id==='dailyBatch') renderDailyBatch();
  if(id==='kanban') renderKanban();
  if(id==='notes'){renderNotes();renderRecent('notesRecent','notesHistorySearch')}
  if(id==='reminders'){
    const when=reminderDefault();$('reminderDate').min=when.date;
    if(!$('reminderDate').value)$('reminderDate').value=when.date;
    if(!$('reminderTime').value)$('reminderTime').value=when.time;
    $('browserNotificationBtn').hidden=!!(window.ChiaplastNative);
    renderReminders();syncNativeReminders();
  }
}
function go(id){history.pushState({s:id},'');show(id)}
function renderDashboardMetrics(){
  const today=new Date().toLocaleDateString('es-MX');
  const recent=getRecent(),inspections=recent.filter(report=>String(report.w||'').includes(today)).length;
  const orders=loadPreventiveCalendar().filter(order=>order.status!=='done').length;
  const tasks=loadKanban().filter(task=>(task.status||'todo')!=='done').length;
  $('metricInspections').textContent=String(inspections);
  $('metricInspectionCaption').textContent=inspections===1?'Reporte guardado hoy':'Reportes guardados hoy';
  $('metricOrders').textContent=String(orders);
  $('metricOrderCaption').textContent=orders===1?'Orden pendiente':'Órdenes pendientes';
  $('metricTasks').textContent=String(tasks);
  $('metricTaskCaption').textContent=tasks===1?'Tarea abierta':'Tareas abiertas';
}
function updateDashboardClock(){
  const now=new Date(),clock=$('dashboardClock');
  clock.textContent=now.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})+' | '+now.toLocaleDateString('es-MX',{day:'2-digit',month:'short'}).toUpperCase();
}
updateDashboardClock();setInterval(updateDashboardClock,30000);
function openReminders(){go('reminders')}
function openPreventiveCalendar(){
  openPreventiveBoard();return;
  if(!$('calendarStartDate').value)$('calendarStartDate').value=calendarToday();
  if(!$('calendarArea').options.length||$('calendarArea').options.length===1){
    $('calendarArea').innerHTML='<option value="">Selecciona un área</option>'+Object.keys(MACHINE_DB).map(code=>'<option value="'+code+'">'+esc(MACHINE_DB[code].area)+'</option>').join('');
  }
  updateCalendarPeriodHint();go('preventiveCalendar');
}
function openNotes(area,machine){$('noteArea').value=area||'General';$('noteMachine').value=machine||'';go('notes')}
function openNoteForCurrentContext(){openNotes(Runtime.area||'General',Runtime.machine||'')}
function offerFailureFollowup(){
  const failed=(Runtime.rows||[]).some(r=>String(r[1]||'').trim().toUpperCase()==='FALLA'||String(r[1]||'').trim().toUpperCase()==='NO');
  if(!failed)return;
  if(!window.confirm('Se detectó un punto marcado como FALLA/NO. ¿Deseas crear una tarea de seguimiento en Kanban?'))return;
  openKanbanForCurrentContext();
}
function openKanbanForCurrentContext(){
  const machine=Runtime.machine||Runtime.area||'';
  $('kanbanArea').value=[Runtime.area,machine&&machine!==Runtime.area?machine:''].filter(Boolean).join(' · ');
  $('kanbanTitle').value='Seguimiento · '+machine;
  $('kanbanDetails').value=$('obs').value.trim();
  go('kanban');$('kanbanTitle').focus();
}
function reminderDefault(){const d=new Date(Date.now()+60*60*1000),p=n=>String(n).padStart(2,'0');return{date:d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()),time:p(d.getHours())+':'+p(d.getMinutes())}}
function openReminderForCurrentContext(){
  const when=reminderDefault(),machine=[Runtime.area,Runtime.machine&&Runtime.machine!==Runtime.area?Runtime.machine:''].filter(Boolean).join(' · ');
  go('reminders');$('reminderId').value='';$('reminderTaskId').value='';$('reminderText').value='Seguimiento · '+(Runtime.machine||Runtime.area||'mantenimiento');
  $('reminderMachine').value=machine;$('reminderDate').value=when.date;$('reminderTime').value=when.time;$('reminderText').focus();
}
function openReminderForKanbanTask(id){
  const task=loadKanban().find(t=>t.id===id);if(!task)return;
  const when=reminderDefault(),existing=loadReminders().find(r=>r.taskId===id||r.id===task.reminderId),future=existing&&Date.parse(existing.due)>Date.now();
  const dueDate=task.due&&task.due>=when.date?task.due:when.date;
  go('reminders');$('reminderId').value=existing?existing.id:'';$('reminderTaskId').value=task.id;
  $('reminderText').value=existing?existing.text:task.title;$('reminderMachine').value=existing&&existing.machine||task.area||'';
  $('reminderDate').value=future?existing.date:dueDate;$('reminderTime').value=future?existing.time:(dueDate===when.date?when.time:'08:00');$('reminderText').focus();
}
function root(id){history.replaceState({s:id},'');show(id)}
addEventListener('popstate',e=>{
  if(!isIn()){root('login');return}
  const s=e.state&&e.state.s;
  if(!s||s==='splash'||s==='login'){ if(isIn()) show('menu'); return; }
  if(s==='done'){ show('menu'); return; }
  show(s);
});
const isIn=()=>AppState.session || store.get('mtto_session','false')==='true';

/* Utilidades */
function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),2400)}
function buzz(n){try{navigator.vibrate&&navigator.vibrate(n||15)}catch(e){}}
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const fmtD=v=>{if(!v)return'—';const[y,m,d]=v.split('-');return d+'/'+m+'/'+y};
const pad=n=>String(n).padStart(2,'0');
function setNow(){const n=new Date();$('d').value=n.getFullYear()+'-'+pad(n.getMonth()+1)+'-'+pad(n.getDate());$('t').value=pad(n.getHours())+':'+pad(n.getMinutes());$('d').classList.remove('bad');$('t').classList.remove('bad')}

/* Exportación local; no se solicita acceso a cuentas externas. */
const XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/* ===== Generador XLSX sin librerías (ZIP sin compresión) ===== */
const crcT=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t.push(c>>>0)}return t})();
const crc=u=>{let c=-1;for(let i=0;i<u.length;i++)c=crcT[(c^u[i])&255]^(c>>>8);return(~c)>>>0};
function zip(files){
  const en=new TextEncoder(),parts=[],cd=[];let off=0,size=0;
  for(const[n,txt]of files){
    const nb=en.encode(n),d=txt instanceof Uint8Array?txt:en.encode(txt),c=crc(d),h=new DataView(new ArrayBuffer(30)),e=new DataView(new ArrayBuffer(46));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint32(14,c,true);h.setUint32(18,d.length,true);h.setUint32(22,d.length,true);h.setUint16(26,nb.length,true);
    e.setUint32(0,0x02014b50,true);e.setUint16(4,20,true);e.setUint16(6,20,true);e.setUint16(8,0x0800,true);e.setUint32(16,c,true);e.setUint32(20,d.length,true);e.setUint32(24,d.length,true);e.setUint16(28,nb.length,true);e.setUint32(42,off,true);
    parts.push(h,nb,d);cd.push(e,nb);off+=30+nb.length+d.length;size+=46+nb.length;
  }
  const z=new DataView(new ArrayBuffer(22));
  z.setUint32(0,0x06054b50,true);z.setUint16(8,files.length,true);z.setUint16(10,files.length,true);z.setUint32(12,size,true);z.setUint32(16,off,true);
  return new Blob([...parts,...cd,z],{type:XLSX_MIME});
}
/* Sesión */
async function signIn(){
  const b=$('loginBtn');b.disabled=true;b.innerHTML='<span class="spin"></span>Abriendo…';$('loginErr').textContent='';
  try{
    AppState.session=true;AppState.user='Usuario local';
    store.set('mtto_user',AppState.user);store.set('mtto_session','true');
    Runtime.area='';Runtime.code='';Runtime.rows=[];
    root('menu');
  }catch(e){$('loginErr').textContent=e.message||'No se pudo abrir la app.'}
  finally{b.disabled=false;b.textContent='Continuar'}
}
function logout(){
  AppState.session=false;AppState.user='';store.del('mtto_session');store.del('mtto_user');tok={v:'',exp:0};
  try{const p=GA();p&&p.signOut()}catch(e){}
  history.replaceState({s:'login'},'');show('login');
}

/* Flujo */
function pick(name,code){
  Runtime.area=name;Runtime.code=code;
  if(isExt()){
    $('checkArea').textContent=name;
    go('checkType');buzz(10);return;
  }
  startCheck('preventive');
}
/* Dos firmas independientes requeridas en mantenimiento preventivo */
const Signatures={ccm:{hex:'',w:0,h:0,drawing:false,name:''},responsable:{hex:'',w:0,h:0,drawing:false,name:''}};
function saveSignatureNames(){store.set('mtto_signature_names',JSON.stringify({ccm:$('ccmSigName').value.trim(),responsable:$('respSigName').value.trim()}))}
function signatureClear(who){const item=Signatures[who],c=$(who==='ccm'?'ccmSigPad':'respSigPad');const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);item.hex='';c.classList.remove('bad')}
function signatureCapture(who){const item=Signatures[who],c=$(who==='ccm'?'ccmSigPad':'respSigPad'),W=300,H=100,t=document.createElement('canvas');t.width=W;t.height=H;const g=t.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,W,H);g.drawImage(c,0,0,W,H);const d=g.getImageData(0,0,W,H).data;let hex='',ink=0;for(let i=0;i<d.length;i+=4){const v=Math.round(d[i]*.3+d[i+1]*.59+d[i+2]*.11);if(v<200)ink++;hex+=(v<16?'0':'')+v.toString(16)}item.hex=ink>40?hex:'';item.w=W;item.h=H}
function initSignaturePad(who){const item=Signatures[who],c=$(who==='ccm'?'ccmSigPad':'respSigPad'),x=c.getContext('2d');signatureClear(who);x.lineWidth=5;x.lineCap='round';x.lineJoin='round';x.strokeStyle='#000';const pt=e=>{const r=c.getBoundingClientRect();return[(e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height]};c.addEventListener('pointerdown',e=>{item.drawing=true;c.setPointerCapture(e.pointerId);const[a,b]=pt(e);x.beginPath();x.moveTo(a,b);x.lineTo(a+.1,b+.1);x.stroke();c.classList.remove('bad')});c.addEventListener('pointermove',e=>{if(!item.drawing)return;const[a,b]=pt(e);x.lineTo(a,b);x.stroke()});const end=()=>{if(item.drawing){item.drawing=false;signatureCapture(who)}};c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end)}
function sigClear(){signatureClear('ccm');signatureClear('responsable')}
initSignaturePad('ccm');initSignaturePad('responsable');
try{const saved=JSON.parse(store.get('mtto_signature_names','{}'));$('ccmSigName').value=saved.ccm||'';$('respSigName').value=saved.responsable||'';Signatures.ccm.name=saved.ccm||'';Signatures.responsable.name=saved.responsable||''}catch(e){}
function startCheck(kind){
  Runtime.checkType=kind;
  $('partsCard').hidden=kind==='daily';
  $('preventiveTimesCard').hidden=kind==='daily';
  $('motorHzCard').hidden=kind==='daily'||!isExt();
  $('preventiveEvidenceCard').hidden=kind==='daily';
  ['ccmApproval','ccmName','pmObservations'].forEach(id=>{const el=$(id);if(el)el.value=''});
  preventivePhotos={before:[],after:[]};renderPreventivePhotos();
  ['pmStartDate','pmStartTime','pmStopDate','pmStopTime','motorHz'].forEach(id=>{const el=$(id);if(el)el.value=''});

  if(kind==='preventive'){loadParts();loadPartsPhotos();loadPreventivePhotos();}
  $('sigCard').hidden=kind==='daily';sigClear();try{const saved=JSON.parse(store.get('mtto_signature_names','{}'));$('ccmSigName').value=saved.ccm||'';$('respSigName').value=saved.responsable||'';Signatures.ccm.name=saved.ccm||'';Signatures.responsable.name=saved.responsable||''}catch(e){}
  const dailyMeasurements=isDaily()&&isExt();
  $('fTitle').textContent=Runtime.area+(Runtime.batchMode?' · '+Runtime.machine:'')+(isDaily()?' · Diario':'');
  setNow();$('ph').hidden=true;
  $('ext').innerHTML=dailyMeasurements?buildDaily():isExt()?buildExt():buildMq();
  $('ext').hidden=false;$('maintenanceFields').hidden=dailyMeasurements;
  if(Runtime.batchMode){
    $('obs').value='';
    $('gType').dataset.v='PREVENTIVO';$('gStatus').dataset.v='ENTREGADO';
    ['gType','gStatus'].forEach(id=>$(id).querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.textContent===$(id).dataset.v)));
    extLoad({});
  }else loadDraft();
  go('form');buzz(10);
}
const isDaily=()=>Runtime.checkType==='daily';
const draftStorageKey=()=>((isDaily()?'mtto_draft_daily':'mtto_draft')+((Runtime.code==='DIM'&&/^(BM|BD)-/i.test(Runtime.machine))?'_'+Runtime.machine.replace(/[^a-z0-9_-]/gi,'_'):''));
function choose(g,btn){
  const box=$(g);
  box.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b===btn));
  box.dataset.v=btn.textContent; box.classList.remove('bad'); buzz(8); saveDraft();
}
function review(){
  const d=$('d').value,t=$('t').value;
  const type=$('gType').dataset.v,st=$('gStatus').dataset.v;
  let bad=null;
  if(!isDaily()){
    const sd=$('pmStartDate').value,stt=$('pmStartTime').value,ed=$('pmStopDate').value,ett=$('pmStopTime').value;
    if((sd&&!stt)||(!sd&&stt)){toast('Completa fecha y hora de inicio, o deja ambos vacíos.');bad=$(!sd?'pmStartDate':'pmStartTime')}
    if((ed&&!ett)||(!ed&&ett)){toast('Completa fecha y hora de parada, o deja ambos vacíos.');bad=bad||$(!ed?'pmStopDate':'pmStopTime')}
    if(sd&&ed&&(ed+'T'+ett)<(sd+'T'+stt)){toast('La parada no puede ser anterior al inicio.');bad=bad||$('pmStopDate')}
    if(isExt()&&$('motorHz').value.trim()!==''&&(!Number.isFinite(Number($('motorHz').value))||Number($('motorHz').value)<0)){toast('Indica una frecuencia válida en Hz.');bad=bad||$('motorHz')}
  }
  if(!d||!t){toast('Indica la fecha y la hora.');bad=$(!d?'d':'t')}
  const dailyMeasurementsForValidation=isDaily()&&isExt();
  if(!dailyMeasurementsForValidation){
    if(!type){$('gType').classList.add('bad');bad=bad||$('gType')}
    if(!st){$('gStatus').classList.add('bad');bad=bad||$('gStatus')}
  }
  if(!$('ext').hidden){
    document.querySelectorAll('#ext input').forEach(i=>{const x=i.value.trim().replace(',','.');if(x===''||!Number.isFinite(Number(x))){i.classList.add('bad');bad=bad||i}});
    if(!dailyMeasurementsForValidation)document.querySelectorAll('#ext .seg').forEach(g=>{if(!g.dataset.v){g.classList.add('bad');bad=bad||g}});
  }
  if(!isDaily()){
    if(!Signatures.ccm.name){$('ccmSigName').classList.add('bad');bad=bad||$('ccmSigName')}
    if(!Signatures.ccm.hex){$('ccmSigPad').classList.add('bad');bad=bad||$('ccmSigPad')}
    if(!Signatures.responsable.name){$('respSigName').classList.add('bad');bad=bad||$('respSigName')}
    if(!Signatures.responsable.hex){$('respSigPad').classList.add('bad');bad=bad||$('respSigPad')}
  }
  if(bad){toast('Completa los campos marcados en rojo.');bad.scrollIntoView({behavior:'smooth',block:'center'});buzz([30,40,30]);return}
  const dailyMeasurements=isDaily()&&isExt();
  const rows=[['Área',Runtime.area+' ('+Runtime.code+')'],['Máquina',Runtime.machine||Runtime.area],['Fecha',fmtD(d)],['Hora',t]];
  if(!isDaily()){
    if($('pmStartDate').value||$('pmStartTime').value)rows.push(['Inicio de mantenimiento',($('pmStartDate').value?fmtD($('pmStartDate').value):'')+' '+$('pmStartTime').value]);
    if($('pmStopDate').value||$('pmStopTime').value)rows.push(['Parada / término de mantenimiento',($('pmStopDate').value?fmtD($('pmStopDate').value):'')+' '+$('pmStopTime').value]);
    if(isExt()&&$('motorHz').value.trim()!=='')rows.push(['Frecuencia del motor principal',String($('motorHz').value).replace(',','.')+' Hz']);
    rows.push(['Visto bueno de CCM',$('ccmApproval').value||'Pendiente'],['Responsable de CCM',$('ccmName').value.trim()||'—'],['Firmante CCM',Signatures.ccm.name],['Firma CCM','Firma manuscrita capturada'],['Firmante Responsable',Signatures.responsable.name],['Firma Responsable','Firma manuscrita capturada'],['Observaciones del mantenimiento',$('pmObservations').value.trim()||'—']);
    rows.push(['Evidencia fotográfica','',1],['Fotografías antes',preventivePhotos.before.length+' de 5'],['Fotografías después',preventivePhotos.after.length+' de 5']);
    preventivePhotos.before.forEach((photo,i)=>rows.push(['__PHOTO__ANTES '+(i+1),photo,5]));
    preventivePhotos.after.forEach((photo,i)=>rows.push(['__PHOTO__DESPUÉS '+(i+1),photo,5]));
  }
  if(dailyMeasurements)rows.push(['Tipo de chequeo','DIARIO'],...dailyRows());
  else rows.push(['Tipo',type],['Estado',st],...(isExt()?extRows():mqRows()));
  if(!isDaily()){
    const parts=readParts();
    rows.push(['Refacciones usadas','',1],['Refacción','Cantidad',4]);
    if(parts.length)parts.forEach(p=>rows.push([p.name,p.quantity,0]));
    else rows.push(['Sin refacciones registradas','—',0]);
    saveParts();
    rows.push(['Evidencia fotográfica','',1],['Fotografías anexas',String(partsPhotosDraft.length)+' fotografía(s) guardadas en el dispositivo',0]);
  }
  rows.push(['Observaciones',$('obs').value.trim()||'—']);
  Runtime.rows=[['Campo','Valor']].concat(rows,[['Reportó',currentUser()||'—']]);
  if(Runtime.batchMode){
    const report={area:Runtime.area,code:Runtime.code,machine:Runtime.machine,date:fmtD(d),time:t,rows:Runtime.rows.slice(1),draft:{d,t,type,st,obs:$('obs').value,fields:extState()},dailyMeasurements};
    if(DailyBatch.editIndex>=0)DailyBatch.reports[DailyBatch.editIndex]=report;else DailyBatch.reports.push(report);
    DailyBatch.editIndex=-1;saveDailyBatch();renderDailyBatch();$('obs').value='';extLoad({});
    go('dailyBatch');toast('Máquina agregada.');return;
  }
  $('sum').innerHTML=rows.map(r=>r[2]?'<div class="h2" style="margin:16px 0 2px">'+esc(r[0])+'</div>':'<div class="row"><span>'+esc(r[0])+'</span><b'+(/^(NO|Falla)$/.test(r[1])?' style="color:var(--err)"':'')+'>'+esc(r[1])+'</b></div>').join('');
  $('fn').textContent=fileName();
  go('confirm');
}
let currentReportFolio='';
const fileName=()=>{const clean=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'').toUpperCase();const machine=clean(Runtime.machine||Runtime.area||'MAQUINA'),area=clean(Runtime.area||Runtime.code||'AREA'),date=String($('d').value||new Date().toISOString().slice(0,10)).replaceAll('-','');return machine+'-'+area+'-'+date;};
function blobBase64(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result).split(',',2)[1]);
    reader.onerror=()=>reject(reader.error||new Error('No se pudo preparar el archivo para Android.'));
    reader.readAsDataURL(blob);
  });
}
async function exportReport(blob,name,mime){
  mime=mime||XLSX_MIME;
  if(window.ChiaplastNative&&typeof window.ChiaplastNative.saveReport==='function'){
    const b64=await blobBase64(blob);
    if(window.ChiaplastNative.saveReport(name,mime,b64)!=='ok')throw new Error('No se pudo guardar el reporte en el dispositivo.');
    LastExports.push({name,mime,b64});
    return 'android-saved';
  }
  const plugins=window.Capacitor&&window.Capacitor.Plugins;
  const fs=plugins&&plugins.Filesystem,share=plugins&&plugins.Share;
  if(fs&&typeof fs.writeFile==='function'&&typeof fs.getUri==='function'&&share&&typeof share.share==='function'){
    const directory=fs.Directory&&fs.Directory.Cache||'CACHE';
    const options={path:name,directory};
    await fs.writeFile({...options,data:await blobBase64(blob)});
    const file=await fs.getUri(options);
    if(!file||!file.uri)throw new Error('Android no devolvió la ubicación del reporte.');
    await share.share({title:name,text:'Reporte de mantenimiento Chiaplast listo para guardar o compartir.',url:file.uri,dialogTitle:'Guardar o compartir reporte'});
    return 'android-share';
  }
  if(typeof File==='function'&&navigator.share&&navigator.canShare){
    const report=new File([blob],name,{type:mime});
    if(navigator.canShare({files:[report]})){
      try{
        await navigator.share({title:name,files:[report]});
        return 'android-share';
      }catch(e){
        if(!e||e.name!=='AbortError')throw e;
      }
    }
  }
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=name;a.rel='noopener';
  a.style.display='none';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  return 'download';
}

/* ===== Documentos formales: estructura común para Excel y PDF =====
   Cada fila: [texto, valor, tipo]  tipo 1=sección, 2=dato general, 3=título, 4=encabezado de tabla */
const META_LABELS=['Área','Máquina','Fecha','Hora','Tipo','Estado','Tipo de chequeo'];
function statusKind(v){
  const t=String(v==null?'':v).trim().toUpperCase();
  if(/^(OK|SÍ|SI|ENTREGADO|ENGRASADA)$/.test(t))return 'ok';
  if(/^(NO|FALLA)$/.test(t))return 'bad';
  if(/^(PENDIENTE|EN PROCESO|EN PARO)$/.test(t))return 'warn';
  if(t==='N/A')return 'na';
  return '';
}
function splitReportRows(rows){
  const meta=[],body=[];let lead=true;
  rows.forEach(r=>{
    if(r[0]==='Reportó')return;
    if(lead&&!r[2]&&META_LABELS.includes(r[0]))meta.push([r[0],r[1],2]);
    else{lead=false;body.push(r)}
  });
  return{meta,body};
}
function currentFolio(){
  const key='mtto_folio_counter_v1';let n=Number(store.get(key,'0'));if(!Number.isSafeInteger(n)||n<0)n=0;
  const date=new Date(),year=date.getFullYear();
  const yearKey='mtto_folio_year_v1',oldYear=Number(store.get(yearKey,'0'));
  if(oldYear!==year){n=0;store.set(yearKey,String(year))}
  n++;store.set(key,String(n));
  return 'MTTO-'+year+'-'+String(n).padStart(5,'0');
}
function singleReportDoc(rows,extraMeta){
  const sp=splitReportRows(rows);
  const title=isDaily()?'REPORTE DE CHEQUEO DIARIO':'REPORTE DE MANTENIMIENTO PREVENTIVO';
  const folio=currentReportFolio||currentFolio();
  return[[title,'',3],['Folio',folio,2],...sp.meta,...(extraMeta||[]).map(m=>[m[0],m[1],2]),['Campo / componente','Resultado / valor',4],...sp.body.map(r=>[r[0],r[1]||'—',r[2]])];
}
function batchExcelRows(){
  const rows=[['REPORTE DE CHEQUEO DIARIO','',3],['Fecha de generación',new Date().toLocaleString('es-MX'),2],['Total de informes',String(DailyBatch.reports.length),2]];
  DailyBatch.reports.forEach((report,i)=>{
    const sp=splitReportRows(report.rows);
    rows.push(['INFORME '+(i+1)+' · '+report.machine,'',1],...sp.meta,['Campo / componente','Resultado / valor',4],...sp.body.map(r=>[r[0],r[1]||'—',r[2]]));
  });
  return rows;
}

/* ===== Excel con formato ===== */
function buildXlsx(rows,photoRows=[]){
  const x=v=>String(v==null?'':v).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const out=[],merges=[];let r=0;
  const c=(col,txt,s)=>'<c r="'+col+r+'" s="'+s+'" t="inlineStr"><is><t xml:space="preserve">'+x(txt)+'</t></is></c>';
  const add=(a,b,sa,sb,ht,merge)=>{r++;out.push('<row r="'+r+'"'+(ht?' ht="'+ht+'" customHeight="1"':'')+'>'+c('A',a,sa)+c('B',b,sb)+'</row>');if(merge)merges.push('A'+r+':B'+r)};
  const VS={ok:9,bad:10,warn:11,na:12};
  rows.forEach(row=>{
    const a=row[0],b=row[1],t=row[2];
    if(t===3){add(a,'',1,1,34,true);add('Chiaplast · Departamento de Mantenimiento','',2,2,20,true);add('','',13,13,5,true);add('','',0,0,8,true)}
    else if(t===1)add(a,'',3,3,22,true);
    else if(t===2)add(a,b,5,6);
    else if(t===4)add(a,b,4,4,20);
    else add(a,b,7,VS[statusKind(b)]||8);
  });
  const hasPreventiveSignatures=rows.some(q=>/visto bueno de ccm/i.test(String(q[0]||'')));
  if(hasPreventiveSignatures){
    add('','',0,0,10,true);
    add('FIRMAS DE CONFORMIDAD','',3,3,22,true);
    const ccmNameRow=rows.find(q=>/^(responsable de ccm|nombre de quien valida \(ccm\))$/i.test(String(q[0]||'')));
    const responsableRow=rows.find(q=>/^responsable$/i.test(String(q[0]||'')));
  add('CCM · Nombre',ccmNameRow?ccmNameRow[1]:'',5,6,24);
  add('Firma CCM','____________________________________________','7',7,30);
  add('Responsable · Nombre',responsableRow?responsableRow[1]:'',5,6,24);
  add('Firma Responsable','____________________________________________',7,7,30);
  add('','',0,0,8,true);
  }
  add('Documento generado por la aplicación de Mantenimiento Chiaplast · '+new Date().toLocaleString('es-MX'),'',14,14,18,true);
  const H='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',R='http://schemas.openxmlformats.org/officeDocument/2006/relationships',M='http://schemas.openxmlformats.org/spreadsheetml/2006/main',P='http://schemas.openxmlformats.org/package/2006/relationships';
  const bd='<border><left style="thin"><color rgb="FFD0D9E0"/></left><right style="thin"><color rgb="FFD0D9E0"/></right><top style="thin"><color rgb="FFD0D9E0"/></top><bottom style="thin"><color rgb="FFD0D9E0"/></bottom><diagonal/></border>';
  const f=(b,sz,col,it)=>'<font>'+(b?'<b/>':'')+(it?'<i/>':'')+'<sz val="'+sz+'"/><color rgb="'+col+'"/><name val="Calibri"/><family val="2"/></font>';
  const fill=col=>'<fill><patternFill patternType="solid"><fgColor rgb="'+col+'"/><bgColor indexed="64"/></patternFill></fill>';
  const xf=(font,fl,b,al)=>'<xf numFmtId="0" fontId="'+font+'" fillId="'+fl+'" borderId="'+b+'" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment '+al+'/></xf>';
  const L='horizontal="left" vertical="center" wrapText="1" indent="1"',T='horizontal="left" vertical="top" wrapText="1" indent="1"';
  const styles=H+'<styleSheet xmlns="'+M+'"><fonts count="9">'
    +f(0,11,'FF172B3A')+f(1,11,'FF172B3A')+f(1,11,'FFFFFFFF')+f(1,18,'FFFFFFFF')+f(1,11,'FF13804A')+f(1,11,'FFB3261E')+f(1,11,'FFA66A00')+f(0,11,'FF7A8791')+f(0,9,'FF7A8791',1)
    +'</fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'+fill('FF172B3A')+fill('FFEAF0F4')+fill('FFEFB900')+'</fills>'
    +'<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>'+bd+'</borders>'
    +'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="15">'
    +xf(0,0,0,L)+xf(3,2,0,L)+xf(2,2,0,L)+xf(2,2,1,L)+xf(1,3,1,L)+xf(1,3,1,L)+xf(0,0,1,L)+xf(0,0,1,T)+xf(0,0,1,T)
    +xf(4,0,1,T)+xf(5,0,1,T)+xf(6,0,1,T)+xf(7,0,1,T)+xf(0,4,0,L)+xf(8,0,0,L)
    +'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const sheet=H+'<worksheet xmlns="'+M+'" xmlns:r="'+R+'"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="18"/>'
    +'<cols><col min="1" max="1" width="54" customWidth="1"/><col min="2" max="2" width="40" customWidth="1"/></cols><sheetData>'+out.join('')+'</sheetData>'
    +'<mergeCells count="'+merges.length+'">'+merges.map(m=>'<mergeCell ref="'+m+'"/>').join('')+'</mergeCells>'
    +'<printOptions horizontalCentered="1"/><pageMargins left="0.5" right="0.5" top="0.6" bottom="0.7" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>'
    +'<headerFooter><oddFooter>&amp;LChiaplast · Mantenimiento&amp;RPágina &amp;P de &amp;N</oddFooter></headerFooter>' +(photoRows.length?'<drawing r:id="rId1"/>':'')+'</worksheet>';
  const contentTypes=H+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+(photoRows.length?'<Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>':'')+'</Types>';
  const files=[
    ['[Content_Types].xml',contentTypes],
    ['_rels/.rels',H+'<Relationships xmlns="'+P+'"><Relationship Id="rId1" Type="'+R+'/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml',H+'<workbook xmlns="'+M+'" xmlns:r="'+R+'"><sheets><sheet name="Reporte" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels',H+'<Relationships xmlns="'+P+'"><Relationship Id="rId1" Type="'+R+'/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="'+R+'/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml',styles],
    ['xl/worksheets/sheet1.xml',sheet]
  ];
  if(photoRows.length){
    files.push(['xl/worksheets/_rels/sheet1.xml.rels',H+'<Relationships xmlns="'+P+'"><Relationship Id="rId1" Type="'+R+'/drawing" Target="../drawings/drawing1.xml"/></Relationships>']);
    const drawingNs='http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',aNs='http://schemas.openxmlformats.org/drawingml/2006/main';
    const anchors=photoRows.map((row,i)=>'<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>'+(r+2+i*18)+'</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="3048000" cy="2286000"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="'+(i+1)+'" name="Evidencia '+(i+1)+'"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId'+(i+1)+'"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="3048000" cy="2286000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>').join('');
    files.push(['xl/drawings/drawing1.xml',H+'<xdr:wsDr xmlns:xdr="'+drawingNs+'" xmlns:a="'+aNs+'" xmlns:r="'+R+'">'+anchors+'</xdr:wsDr>']);
    files.push(['xl/drawings/_rels/drawing1.xml.rels',H+'<Relationships xmlns="'+P+'">'+photoRows.map((row,i)=>'<Relationship Id="rId'+(i+1)+'" Type="'+R+'/image" Target="../media/image'+(i+1)+'.jpg"/>').join('')+'</Relationships>']);
    photoRows.forEach((row,i)=>{const b64=String(row[1]).split(',')[1]||'',bin=atob(b64),bytes=new Uint8Array(bin.length);for(let k=0;k<bin.length;k++)bytes[k]=bin.charCodeAt(k);files.push(['xl/media/image'+(i+1)+'.jpg',bytes])});
  }
  return zip(files);
}

/* ===== PDF formal (A4, Helvetica, tablas con color y paginación) ===== */
const PDF_MIME='application/pdf';
const HW_R=[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HW_B=[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
function pdfEnc(v){
  const map={8212:151,8211:150,8230:133,8226:149,8220:147,8221:148,8216:145,8217:146,8364:128};
  let o='';
  for(const ch of String(v==null?'':v)){
    let c=ch.codePointAt(0);const m=map[c];
    if(m!==undefined)c=m;else if(c>255||c<32||(c>=127&&c<160))c=c<32?32:63;
    if(c===40||c===41||c===92)o+='\\'+String.fromCharCode(c);
    else if(c>=32&&c<127)o+=String.fromCharCode(c);
    else o+='\\'+c.toString(8).padStart(3,'0');
  }
  return o;
}
function pdfWidth(s,size,bold){
  const t=bold?HW_B:HW_R;let w=0;
  for(const ch of String(s).normalize('NFD').replace(/[̀-ͯ]/g,'')){const k=ch.charCodeAt(0);w+=(k>=32&&k<127?t[k-32]:556)}
  return w*size/1000;
}
function pdfWrap(s,max,size,bold){
  const lines=[];let cur='';
  String(s==null?'':s).split(/\s+/).filter(Boolean).forEach(word=>{
    while(pdfWidth(word,size,bold)>max){let i=word.length;while(i>1&&pdfWidth(word.slice(0,i),size,bold)>max)i--;if(cur){lines.push(cur);cur=''}lines.push(word.slice(0,i));word=word.slice(i)}
    const test=cur?cur+' '+word:word;
    if(pdfWidth(test,size,bold)<=max)cur=test;else{lines.push(cur);cur=word}
  });
  if(cur||!lines.length)lines.push(cur);
  return lines;
}
function buildPdf(rows,sig){
  const W=595,H=842,M=40,CW=W-2*M,BOT=H-56,generated=new Date().toLocaleString('es-MX');
  const STEEL='0.09 0.17 0.23',ACC='0.94 0.73 0',LINE='0.82 0.86 0.89',LIGHT='0.92 0.94 0.96';
  const COL={ok:'0.07 0.50 0.29',bad:'0.70 0.15 0.12',warn:'0.65 0.42 0',na:'0.48 0.53 0.57','':'0.09 0.17 0.23'};
  const trow=rows.find(r=>r[2]===3);const docTitle=trow?trow[0]:'REPORTE DE MANTENIMIENTO';
  const pages=[],pagePhotoRefs=[];let ops,y,sigPage=-1;
  const R=(x,yt,w,h,fill,stroke)=>{ops.push((fill?fill+' rg ':'')+(stroke?stroke+' RG 0.5 w ':'')+x.toFixed(2)+' '+(H-yt-h).toFixed(2)+' '+w.toFixed(2)+' '+h.toFixed(2)+' re '+(fill&&stroke?'B':fill?'f':'S'))};
  const T=(x,yt,s,size,bold,col,right)=>{const px=right?x-pdfWidth(s,size,bold):x;ops.push('BT /'+(bold?'F2':'F1')+' '+size+' Tf '+col+' rg '+px.toFixed(2)+' '+(H-yt).toFixed(2)+' Td ('+pdfEnc(s)+') Tj ET')};
  const newPage=()=>{
    ops=[];pages.push(ops);const first=pages.length===1;
    if(first){
      R(0,0,W,76,STEEL);R(0,76,W,4,ACC);
      T(M,38,'CHIAPLAST',22,true,'1 1 1');T(M,56,'Departamento de Mantenimiento',9.5,false,'0.80 0.85 0.89');
      T(W-M,36,docTitle,11,true,'1 1 1',true);
      y=100;
    }else{
      R(0,0,W,30,STEEL);R(0,30,W,3,ACC);
      T(M,20,'CHIAPLAST',11,true,'1 1 1');T(W-M,20,docTitle,8.5,true,'0.80 0.85 0.89',true);
      y=50;
    }
  };
  const ensure=h=>{if(y+h>BOT)newPage()};
  const row=(a,b,lw,opt)=>{
    opt=opt||{};const size=9.5,lh=12,pad=6,kind=statusKind(b);
    const la=pdfWrap(a,lw-2*pad,size,!!opt.labelBold),lb=pdfWrap(b,CW-lw-2*pad,size,!!kind||!!opt.valBold);
    const n=Math.max(la.length,lb.length),h=n*lh+pad+2;
    ensure(h);
    R(M,y,lw,h,opt.labelFill||(opt.zebra?'0.975 0.98 0.985':'1 1 1'),LINE);
    R(M+lw,y,CW-lw,h,opt.valFill||(opt.zebra?'0.975 0.98 0.985':'1 1 1'),LINE);
    la.forEach((s,i)=>T(M+pad,y+pad+8+i*lh,s,size,!!opt.labelBold,COL['']));
    lb.forEach((s,i)=>T(M+lw+pad,y+pad+8+i*lh,s,size,!!kind||!!opt.valBold,COL[kind]));
    y+=h;
  };
  const photoRows=rows.filter(r=>r[2]===5&&typeof r[1]==='string'&&r[1].startsWith('data:image/jpeg;base64,'));
  const photoDimensions=data=>{try{const bin=atob(data.split(',')[1]);for(let i=2;i<bin.length-9;){if(bin.charCodeAt(i)!==255){i++;continue}const marker=bin.charCodeAt(i+1),len=(bin.charCodeAt(i+2)<<8)|bin.charCodeAt(i+3);if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return{w:(bin.charCodeAt(i+7)<<8)|bin.charCodeAt(i+8),h:(bin.charCodeAt(i+5)<<8)|bin.charCodeAt(i+6)};i+=Math.max(2,len)}}catch(e){}return{w:1280,h:720}};
  newPage();
  let zebra=0,prevMeta=false;
  rows.forEach(r=>{
    const a=r[0],b=r[1]==null?'':r[1],t=r[2];
    if(t===5)return;
    if(t===3)return;
    if(t===1){ensure(20+34);y+=prevMeta?0:8;R(M,y,CW,20,STEEL);T(M+8,y+14,a,10,true,'1 1 1');y+=20;zebra=0;prevMeta=false;return}
    if(t===2){row(a,b,150,{labelBold:true,labelFill:LIGHT});prevMeta=true;return}
    if(t===4){if(prevMeta)y+=10;ensure(18+30);R(M,y,CW,18,LIGHT,LINE);T(M+6,y+12.5,a,9,true,COL['']);T(M+300+6,y+12.5,b,9,true,COL['']);y+=18;zebra=0;prevMeta=false;return}
    row(a,b,300,{zebra:zebra++%2});prevMeta=false;
  });
  photoRows.forEach((r,index)=>{newPage();pagePhotoRefs[pages.length-1]=index;const dim=photoDimensions(r[1]),scale=Math.min(CW/dim.w,650/dim.h),iw=dim.w*scale,ih=dim.h*scale,x=(W-iw)/2,top=110;T(M,72,'EVIDENCIA FOTOGRÁFICA · '+String(r[0]).replace('__PHOTO__',''),13,true,STEEL);ops.push('q '+iw.toFixed(2)+' 0 0 '+ih.toFixed(2)+' '+x.toFixed(2)+' '+(H-top-ih).toFixed(2)+' cm /Img1 Do Q')});
  const hasPreventiveSignatures=rows.some(q=>/visto bueno de ccm/i.test(String(q[0]||'')));
  if(sig||hasPreventiveSignatures){
    ensure(150);y+=20;
    R(M,y,CW,20,STEEL);T(M+8,y+14,'Firmas de conformidad',10,true,'1 1 1');y+=20;
    const gap=12,boxW=(CW-gap)/2,boxH=112,leftX=M,rightX=M+boxW+gap;
    R(leftX,y,boxW,boxH,'1 1 1',LINE);R(rightX,y,boxW,boxH,'1 1 1',LINE);
    const ccmRow=rows.find(q=>/^(responsable de ccm|nombre de quien valida \(ccm\))$/i.test(String(q[0]||'')));
    const respRow=rows.find(q=>/^responsable$/i.test(String(q[0]||'')));
    T(leftX+10,y+18,'CCM',10,true,STEEL);
    const ccmNm=pdfWrap((sig&&sig.ccm&&sig.ccm.name)||(ccmRow?ccmRow[1]:''),boxW-20,9.5,true)[0]||'';
    T(leftX+10,y+36,ccmNm,9.5,true,COL['']);
    if(sig&&sig.ccm&&sig.ccm.hex){sigPage=pages.length-1;ops.push('q 100 0 0 33 '+(leftX+10)+' '+(H-y-70-33).toFixed(2)+' cm /SigCCM Do Q')}
    ops.push(LINE+' RG 0.8 w '+(leftX+12)+' '+(H-y-76)+' m '+(leftX+boxW-12)+' '+(H-y-76)+' l S');
    T(leftX+10,y+94,'Nombre y firma de CCM',8,false,COL.na);
    T(rightX+10,y+18,'Responsable',10,true,STEEL);
    const respNm=pdfWrap((sig&&sig.responsable&&sig.responsable.name)||(respRow&&respRow[1])||'',boxW-20,9.5,true)[0]||'';
    T(rightX+10,y+36,respNm,9.5,true,COL['']);
    if(sig&&sig.responsable&&sig.responsable.hex){sigPage=pages.length-1;ops.push('q 100 0 0 33 '+(rightX+10)+' '+(H-y-70-33).toFixed(2)+' cm /SigResp Do Q')}
    ops.push(LINE+' RG 0.8 w '+(rightX+12)+' '+(H-y-76)+' m '+(rightX+boxW-12)+' '+(H-y-76)+' l S');
    T(rightX+10,y+94,'Nombre y firma del responsable',8,false,COL.na);
    y+=boxH;
  }
  const total=pages.length;
  pages.forEach((p,i)=>{
    ops=p;
    ops.push(LINE+' RG 0.6 w '+M+' '+(H-H+34)+' m '+(W-M)+' '+(H-H+34)+' l S');
    T(M,H-20,'Chiaplast · Mantenimiento · Documento generado el '+generated,8,false,COL.na);
    T(W-M,H-20,'Página '+(i+1)+' de '+total,8,true,COL.na,true);
  });
  const objs=[];const add=s=>{objs.push(s);return objs.length};
  add('<< /Type /Catalog /Pages 2 0 R >>');add('PAGES');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const info=add('<< /Title ('+pdfEnc(docTitle+' - Chiaplast')+') /Author (Chiaplast Mantenimiento) /Creator (Aplicacion de Mantenimiento Chiaplast) >>');
  const photoStartId=5+pages.length*2+1,sigCcmId=sig&&sig.ccm&&sig.ccm.hex?photoStartId+photoRows.length:0,sigRespId=sig&&sig.responsable&&sig.responsable.hex?photoStartId+photoRows.length+(sigCcmId?1:0):0,refs=[];
  pages.forEach((p,i)=>{
    const pid=objs.length+1,cid=pid+1;refs.push(pid+' 0 R');
    const xo=[];if(i===sigPage&&sigCcmId)xo.push('/SigCCM '+sigCcmId+' 0 R');if(i===sigPage&&sigRespId)xo.push('/SigResp '+sigRespId+' 0 R');if(pagePhotoRefs[i]!==undefined)xo.push('/Img1 '+(photoStartId+pagePhotoRefs[i])+' 0 R');
    add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>'+(xo.length?' /XObject << '+xo.join(' ')+' >>':'')+' >> /Contents '+cid+' 0 R >>');
    const stream=p.join('\n');add('<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream');
  });
  objs[1]='<< /Type /Pages /Kids ['+refs.join(' ')+'] /Count '+pages.length+' >>';
  photoRows.forEach(r=>{const bin=atob(r[1].split(',')[1]);let hex='';for(let i=0;i<bin.length;i++)hex+=bin.charCodeAt(i).toString(16).padStart(2,'0');const dim=photoDimensions(r[1]);add('<< /Type /XObject /Subtype /Image /Width '+dim.w+' /Height '+dim.h+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length '+(hex.length+1)+' >>\nstream\n'+hex+'>\nendstream')});
  if(sigCcmId){const z=sig.ccm,d=z.hex+'>';add('<< /Type /XObject /Subtype /Image /Width '+z.w+' /Height '+z.h+' /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length '+d.length+' >>\nstream\n'+d+'\nendstream')}
  if(sigRespId){const z=sig.responsable,d=z.hex+'>';add('<< /Type /XObject /Subtype /Image /Width '+z.w+' /Height '+z.h+' /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length '+d.length+' >>\nstream\n'+d+'\nendstream')}
  let pdf='%PDF-1.4\n%CHIA\n';const off=[];
  objs.forEach((o,i)=>{off.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+o+'\nendobj\n'});
  const xr=pdf.length;pdf+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n';
  off.forEach(o=>{pdf+=String(o).padStart(10,'0')+' 00000 n \n'});
  pdf+='trailer\n<< /Size '+(objs.length+1)+' /Root 1 0 R /Info '+info+' 0 R >>\nstartxref\n'+xr+'\n%%EOF';
  return new Blob([pdf],{type:PDF_MIME});
}
function selectedExport(name){
  const input=document.querySelector('input[name="'+name+'"]:checked');
  return input?input.value:'excel';
}
async function generateExports(rows,baseName,choice,sig){
  LastExports.length=0;
  const formats=choice==='both'?['excel','pdf']:[choice],results=[];
  for(const format of formats){
    const isPdf=format==='pdf',name=baseName+(isPdf?'.pdf':'.xlsx');
    const exportRows=isPdf?rows:rows.filter(r=>r[2]!==5);
    const blob=isPdf?buildPdf(exportRows,sig):buildXlsx(exportRows,rows.filter(r=>r[2]===5&&typeof r[1]==='string'&&r[1].startsWith('data:image/jpeg;base64,')));
    const mode=await exportReport(blob,name,isPdf?PDF_MIME:XLSX_MIME);
    results.push({name,format,mode});
  }
  return results;
}
async function send(){
  const b=$('sendBtn');b.disabled=true;offerFailureFollowup();currentReportFolio=currentFolio();const baseName=fileName();
  try{
    b.innerHTML='<span class="spin"></span>Generando…';
    const exportRows=singleReportDoc(Runtime.rows.slice(1),isDaily()?[]:[['Responsable',Sig.name]]);
    const results=await generateExports(exportRows,baseName,selectedExport('exportChoice'),isDaily()?null:{ccm:Signatures.ccm,responsable:Signatures.responsable});
    showDone(results,'Reporte generado');
    addRecent({id:currentReportFolio,folio:currentReportFolio,n:results.map(r=>r.name).join(', '),a:Runtime.area,m:Runtime.machine||'',w:fmtD($('d').value)+' '+$('t').value,k:Runtime.checkType,rows:exportRows});
    store.del(draftStorageKey());buzz([20,50,20]);history.replaceState({s:'done'},'');show('done');
  }catch(e){toast(e.message||'No se pudo generar el archivo.');buzz([30,40,30])}
  finally{b.disabled=false;b.textContent='Generar reporte'}
}
function finish(){
  sigClear();
  $('obs').value='';extLoad({});['gType','gStatus'].forEach(g=>{const x=$(g);x.dataset.v='';x.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'))});
  Runtime.batchMode=false;Runtime.machine='';DailyBatch.active=false;
  history.replaceState({s:'menu'},'');show('menu');
}

async function loadPreventivePhotos(){try{const db=await openPartsPhotosDB(),key=preventivePhotoKey();const saved=await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readonly'),req=tx.objectStore('photos').get(key);req.onsuccess=()=>resolve(req.result&&req.result.photos?req.result.photos:{before:[],after:[]});req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close()});preventivePhotos={before:(saved.before||[]).slice(0,5),after:(saved.after||[]).slice(0,5)};renderPreventivePhotos()}catch(e){preventivePhotos={before:[],after:[]};renderPreventivePhotos();toast('No se pudieron cargar las fotos del preventivo.')}}
async function savePreventivePhotos(){const db=await openPartsPhotosDB(),key=preventivePhotoKey(),record={key,photos:{before:preventivePhotos.before.slice(0,5),after:preventivePhotos.after.slice(0,5)},updated:Date.now()};return new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put(record);tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>{db.close();reject(tx.error||new Error('No se pudo guardar la evidencia.'))};tx.onabort=()=>{db.close();reject(tx.error||new Error('Se canceló el guardado.'))}})}
function renderPreventivePhotos(){['before','after'].forEach(stage=>{const box=$(stage==='before'?'pmBeforePreview':'pmAfterPreview');if(!box)return;box.innerHTML=preventivePhotos[stage].map((src,i)=>'<figure><img src="'+esc(src)+'" alt="Foto '+(stage==='before'?'antes':'después')+' '+(i+1)+'"><button type="button" aria-label="Quitar fotografía" onclick="removePreventivePhoto(\''+stage+'\','+i+')">×</button></figure>').join('')})}
function capturePreventivePhoto(stage){if(preventivePhotos[stage].length>=5){toast('Máximo 5 fotos por etapa.');return}partsPhotoTarget=stage==='before'?'pmBefore':'pmAfter';if(window.ChiaplastNative&&typeof window.ChiaplastNative.takePhoto==='function'){window.ChiaplastNative.takePhoto('preventive-'+stage);return}$('pm'+(stage==='before'?'Before':'After')+'Input').click()}
function pickPreventivePhoto(stage){if(preventivePhotos[stage].length>=5){toast('Máximo 5 fotos por etapa.');return}partsPhotoTarget=stage==='before'?'pmBefore':'pmAfter';if(window.ChiaplastNative&&typeof window.ChiaplastNative.pickPhoto==='function'){window.ChiaplastNative.pickPhoto('preventive-'+stage);return}$('pm'+(stage==='before'?'Before':'After')+'Input').click()}
async function previewPreventivePhotos(input,stage){const files=Array.from(input.files||[]);input.value='';for(const file of files){if(preventivePhotos[stage].length>=5){toast('Máximo 5 fotos por etapa.');break}if(file.type.startsWith('image/')){try{preventivePhotos[stage].push(await resizeNoteImage(file))}catch(e){toast('No se pudo preparar una foto.')}}}renderPreventivePhotos();try{await savePreventivePhotos()}catch(e){toast('No se pudo guardar la evidencia.')}}
async function removePreventivePhoto(stage,index){const src=preventivePhotos[stage][index];preventivePhotos[stage].splice(index,1);if(typeof src==='string'&&src.includes('/evidence/')&&window.ChiaplastNative&&typeof window.ChiaplastNative.deleteEvidence==='function')window.ChiaplastNative.deleteEvidence(src);renderPreventivePhotos();try{await savePreventivePhotos()}catch(e){toast('No se pudo actualizar la evidencia.')}}

/* Refacciones y fotografías: almacenamiento local independiente por máquina */
const partsStorageKey=()=> 'mtto_parts_'+[Runtime.code||'AREA',Runtime.machine||Runtime.area||'MAQUINA'].join('_').replace(/[^a-z0-9_-]/gi,'_');
let preventivePhotos={before:[],after:[]};
const preventivePhotoKey=()=> 'pm-evidence-'+[Runtime.code||'AREA',Runtime.machine||Runtime.area||'MAQUINA'].join('_').replace(/[^a-z0-9_-]/gi,'_');
const partsPhotosKey=()=> 'parts-photos-'+[Runtime.code||'AREA',Runtime.machine||Runtime.area||'MAQUINA'].join('_').replace(/[^a-z0-9_-]/gi,'_');
let partsPhotosDraft=[];
let partsPhotoTarget='parts';
function openPartsPhotosDB(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){reject(new Error('Este dispositivo no permite guardar fotografías localmente.'));return}
    const req=indexedDB.open('chiaplast-parts-photos-v1',1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('photos'))db.createObjectStore('photos',{keyPath:'key'})};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('No se pudo abrir el almacenamiento de fotografías.'));
  });
}
async function loadPartsPhotos(){
  try{
    const db=await openPartsPhotosDB(),key=partsPhotosKey();
    const photos=await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readonly'),req=tx.objectStore('photos').get(key);req.onsuccess=()=>resolve(req.result&&Array.isArray(req.result.photos)?req.result.photos:[]);req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close()});
    partsPhotosDraft=photos.slice(0,5);renderPartsPhotos();
  }catch(e){partsPhotosDraft=[];renderPartsPhotos();toast('No se pudieron cargar las fotografías guardadas.')}
}
async function savePartsPhotos(){
  const db=await openPartsPhotosDB(),record={key:partsPhotosKey(),photos:partsPhotosDraft.slice(0,5),updated:Date.now()};
  return new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put(record);tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>{db.close();reject(tx.error||new Error('No se pudieron guardar las fotografías.'))};tx.onabort=()=>{db.close();reject(tx.error||new Error('Se canceló el guardado de fotografías.'))}});
}
function capturePartsPhoto(){
  if(partsPhotosDraft.length>=5){toast('Se admiten hasta 5 fotografías de refacciones.');return}
  partsPhotoTarget='parts';
  if(window.ChiaplastNative&&typeof window.ChiaplastNative.takePhoto==='function'){window.ChiaplastNative.takePhoto('parts');return}
  $('partsPhotosInput').click();
}
function pickPartsPhoto(){
  if(partsPhotosDraft.length>=5){toast('Se admiten hasta 5 fotografías de refacciones.');return}
  partsPhotoTarget='parts';
  if(window.ChiaplastNative&&typeof window.ChiaplastNative.pickPhoto==='function'){window.ChiaplastNative.pickPhoto('parts');return}
  $('partsPhotosInput').removeAttribute('capture');$('partsPhotosInput').click();
}
async function previewPartsPhotos(input){
  const files=Array.from(input.files||[]);
  if(partsPhotosDraft.length+files.length>5)toast('Solo se permiten 5 fotografías en total.');
  const room=Math.max(0,5-partsPhotosDraft.length),selected=files.slice(0,room);
  try{
    for(const file of selected){if(file.type.startsWith('image/'))partsPhotosDraft.push(await resizeNoteImage(file))}
    renderPartsPhotos();await savePartsPhotos();
    if(selected.length)toast(selected.length+' fotografía(s) agregadas.');
  }catch(e){toast(e.message||'No se pudieron preparar las fotografías.')}
  input.value='';
}
function renderPartsPhotos(){
  const box=$('partsPhotoPreview');if(!box)return;
  box.innerHTML=partsPhotosDraft.map((src,i)=>'<figure><img src="'+esc(src)+'" alt="Fotografía de refacción '+(i+1)+'"><button type="button" aria-label="Quitar fotografía" onclick="removePartsPhoto('+i+')">×</button></figure>').join('');
  const label=document.querySelector('#partsCard .parts-photo-note');
  if(label)label.textContent='Fotografías guardadas: '+partsPhotosDraft.length+' de 5. Se conservan localmente para esta máquina.';
}
async function removePartsPhoto(index){
  const src=partsPhotosDraft[index];partsPhotosDraft.splice(index,1);
  if(typeof src==='string'&&src.includes('/evidence/')&&window.ChiaplastNative&&typeof window.ChiaplastNative.deleteEvidence==='function')window.ChiaplastNative.deleteEvidence(src);
  renderPartsPhotos();
  try{await savePartsPhotos()}catch(e){toast('No se pudo actualizar el almacenamiento de fotografías.')}
}
function readParts(){
  return [...document.querySelectorAll('#partsList .parts-row')].map(row=>({
    name:row.querySelector('.part-name').value.trim(),
    quantity:row.querySelector('.part-quantity').value.trim()
  })).filter(p=>p.name&&p.quantity&&Number(p.quantity)>0);
}
function renderParts(parts){
  const list=$('partsList');
  list.innerHTML='';
  (Array.isArray(parts)&&parts.length?parts:[{name:'',quantity:''}]).forEach(p=>addPartRow(p.name,p.quantity,false));
}
function addPartRow(name='',quantity='',persist=true){
  const list=$('partsList');if(!list)return;
  const row=document.createElement('div');row.className='parts-row';
  const nameInput=document.createElement('input');nameInput.className='part-name';nameInput.type='text';nameInput.maxLength=100;nameInput.placeholder='Ej. Rodamiento';nameInput.setAttribute('aria-label','Nombre de la refacción');nameInput.value=name||'';nameInput.addEventListener('input',saveParts);
  const qtyInput=document.createElement('input');qtyInput.className='part-quantity';qtyInput.type='number';qtyInput.min='0.01';qtyInput.step='any';qtyInput.inputMode='decimal';qtyInput.placeholder='0';qtyInput.setAttribute('aria-label','Cantidad utilizada');qtyInput.value=quantity||'';qtyInput.addEventListener('input',saveParts);
  const remove=document.createElement('button');remove.type='button';remove.className='parts-remove';remove.textContent='×';remove.title='Eliminar refacción';remove.setAttribute('aria-label','Eliminar refacción');remove.addEventListener('click',()=>{row.remove();if(!$('partsList').children.length)addPartRow();saveParts()});
  row.append(nameInput,qtyInput,remove);list.appendChild(row);
  if(persist)saveParts();
}
function loadParts(){
  let parts=[];try{parts=JSON.parse(store.get(partsStorageKey(),'[]'))}catch(e){}
  renderParts(parts);
}
function saveParts(){store.set(partsStorageKey(),JSON.stringify(readParts()));}
/* Borrador: si la app se cierra no se pierde lo escrito */
function saveDraft(){store.set(draftStorageKey(),JSON.stringify({c:Runtime.code,k:Runtime.checkType,d:$('d').value,h:$('t').value,t:$('gType').dataset.v,s:$('gStatus').dataset.v,o:$('obs').value,x:extState(),pmStartDate:$('pmStartDate').value,pmStartTime:$('pmStartTime').value,pmStopDate:$('pmStopDate').value,pmStopTime:$('pmStopTime').value,motorHz:$('motorHz').value,ccmApproval:$('ccmApproval').value,ccmName:$('ccmName').value,pmObservations:$('pmObservations').value}))}
function loadDraft(){
  let dr=null;try{dr=JSON.parse(store.get(draftStorageKey(),'null'))}catch(e){}
  const ok=dr&&dr.c===Runtime.code&&(isDaily()?dr.k==='daily':!dr.k||dr.k==='preventive');
  $('d').value=ok&&dr.d?dr.d:$('d').value;
  $('t').value=ok&&dr.h?dr.h:$('t').value;
  $('d').classList.remove('bad');$('t').classList.remove('bad');
  [['gType',ok?dr.t:''],['gStatus',ok?dr.s:'']].forEach(([g,v])=>{const x=$(g);x.dataset.v=v||'';x.classList.remove('bad');x.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.textContent===v))});
  $('obs').value=ok?dr.o:'';
  ['pmStartDate','pmStartTime','pmStopDate','pmStopTime','motorHz','ccmApproval','ccmName','pmObservations'].forEach(id=>{const el=$(id);if(el)el.value=ok&&dr[id]?dr[id]:''});
  extLoad(ok&&dr.x?dr.x:{});
}

/* ===== Extrusoras (E1 y E2) ===== */
const ZONAS=['Zona 1','Zona 2','Zona 3','Zona 4 (Porta malla)','Zona 5 (Porta malla)','Zona 6 (Porta malla)','Codo Portamalla','Cabezal','Motor Principal'];
const SOPL=['Soplador 1','Soplador 2','Soplador 3','Soplador 4','Luminaria'];
const DAILY_POINTS=['Zona 1','Zona 2','Zona 3','Zona 4 (Porta malla)','Zona 5 (Porta malla)','Motor Principal'];
const EXT_CHECK=[
  ['ZONA MECÁNICA',['ESTADO DE LOS RODILLOS','ESTADO DE LOS BALEROS DE LOS RODILLOS','ESTADO DE LAS CHUMACERAS','ESTADO DE LAS BANDAS','ESTADO DE LOS MOTORES','ESTADO DE LOS BALEROS DE LOS MOTORES','ESTADO DE LOS REDUCTORES','ESTADO DEL ACEITE DE LOS REDUCTORES DE LOS MOTORES','ESTADO DEL CABEZAL','ESTADO DEL DADO DEL CABEZAL','ESTADO DE LOS PLATOS DE AIRE','ESTADO DE LOS CONDUCTOS DE LOS PLATOS DE AIRE','ESTRUCTURA Y TORNILLERÍA','ESTADO DE HUSILLO Y CAÑON','ESTADO DEL PORTAMALLA','ESTADO DE LAS POLEAS','ESTADO DE LAS CUCHILLAS (RF)']],
  ['ZONA NEUMÁTICA E HIDRÁULICA',['ESTADO DE LOS PISTONES','ESTADO DE LAS VÁLVULAS','ESTADO DE LAS MANGUERAS','ESTADO DEL ACEITE','ESTADO DE LA UNIDAD DE MANTENIMIENTO','ESTADO DE LOS SELLOS Y CONEXIONES']],
  ['ZONA ELÉCTRICA',['ESTADO DE LOS CABLES Y TERMINALES','ESTADO DE LOS CONTACTORES','ESTADO DE LAS PASTILLAS TÉRMICAS','ESTADO DE LOS GUARDAMOTORES','ESTADO DE LOS ESTADOS SÓLIDOS','ESTADO DE LOS PIROMETROS','ESTADO DEL INVERSOR','ESTADO DE LAS PISTAS DE BRONCE','ESTADO DE LA CAJA DE ALIMENTACIÓN DEL CABEZAL','ESTADO DE LOS SOPLADORES','ESTADO DEL PLC','ESTADO DE LAS RESISTENCIAS']]
];
const isExt=()=>Runtime.code==='E1'||Runtime.code==='E2';
function buildExt(){
  const seg=(id,o)=>'<div class="seg" id="'+id+'" data-v="">'+o.map(x=>'<button type="button" aria-pressed="false" onclick="choose(\''+id+'\',this)">'+x+'</button>').join('')+'</div>';
  let h='<div class="card"><h3>Temperatura y consumo</h3><div class="two hd"><span>Temperatura (°C)</span><span>Consumo (A)</span></div>';
  ZONAS.forEach((z,i)=>{h+='<div class="zr"><b>'+z+'</b><div class="two"><input id="z'+i+'t" inputmode="decimal" placeholder="°C" aria-label="'+z+' temperatura" oninput="ei(this)"><input id="z'+i+'a" inputmode="decimal" placeholder="A" aria-label="'+z+' amperes" oninput="ei(this)"></div></div>'});
  h+='</div><div class="card"><h3>Prueba operativa</h3>';
  SOPL.forEach((n,i)=>{h+='<div class="zr"><b>'+n+'</b>'+seg('p'+i,['OK','NO'])+'</div>'});
  h+='<button class="link" onclick="allOk(\'p\')">Marcar todo en OK</button></div>';
  EXT_CHECK.forEach((zone,zi)=>{
    h+='<div class="card"><h3>'+zone[0]+'</h3><button class="link" style="margin:0 0 8px" onclick="allOk(\'e'+zi+'-\')">Marcar zona en OK</button>';
    zone[1].forEach((item,ii)=>{const id='e'+zi+'-'+ii;h+='<div class="zr"><b>'+item+'</b>'+seg(id,['OK','Falla','N/A'])+'</div>';});
    h+='</div>';
  });
  return h;
}
function buildDaily(){
  let h='<div class="card"><h3>Mediciones del chequeo diario</h3><div class="two hd"><span>Temperatura (°C)</span><span>Amperaje (A)</span></div>';
  DAILY_POINTS.forEach((point,i)=>{
    h+='<div class="zr"><b>'+point+'</b><div class="two"><input id="daily'+i+'t" inputmode="decimal" placeholder="°C" aria-label="'+point+' temperatura" oninput="ei(this)"><input id="daily'+i+'a" inputmode="decimal" placeholder="A" aria-label="'+point+' amperaje" oninput="ei(this)"></div></div>';
  });
  return h+'</div>';
}
function dailyRows(){
  const value=id=>$(id).value.trim().replace(',','.');
  const rows=[['Mediciones diarias','',1]];
  DAILY_POINTS.forEach((point,i)=>{
    rows.push([point+' — Temperatura',value('daily'+i+'t')+' °C']);
    rows.push([point+' — Amperaje',value('daily'+i+'a')+' A']);
  });
  return rows;
}
function ei(i){i.classList.remove('bad');saveDraft()}
function allOk(pre){document.querySelectorAll('#ext .seg[id^="'+pre+'"]').forEach(g=>choose(g.id,g.children[0]))}
function extState(){const o={};document.querySelectorAll('#ext input').forEach(i=>o[i.id]=i.value);document.querySelectorAll('#ext .seg').forEach(g=>o[g.id]=g.dataset.v);document.querySelectorAll('#ext [data-grease]').forEach(b=>o['grease'+b.dataset.grease]=b.getAttribute('aria-pressed')==='true');return o}
function extLoad(o){
  document.querySelectorAll('#ext input').forEach(i=>{i.value=o[i.id]||'';i.classList.remove('bad')});
  document.querySelectorAll('#ext .seg').forEach(g=>{const v=o[g.id]||'';g.dataset.v=v;g.classList.remove('bad');g.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.textContent===v))});
  document.querySelectorAll('#ext [data-grease]').forEach(b=>{const done=o['grease'+b.dataset.grease]===true||o['grease'+b.dataset.grease]==='true';b.setAttribute('aria-pressed',String(done))});
  greaseProgress();
}
function extRows(){
  const v=id=>$(id).value.trim().replace(',','.');
  const r=[['Temperatura y consumo','',1]];
  ZONAS.forEach((z,i)=>r.push([z,v('z'+i+'t')+' °C · '+v('z'+i+'a')+' A']));
  r.push(['Prueba operativa','',1]);
  SOPL.forEach((n,i)=>r.push([n,$('p'+i).dataset.v]));
  EXT_CHECK.forEach((zone,zi)=>{r.push([zone[0],'',1]);zone[1].forEach((item,ii)=>r.push([item,$('e'+zi+'-'+ii).dataset.v]));});
  return r;
}

/* ===== CAM, DIM y BSL ===== */
const MQ=[
 ['Sistema neumático',['Nivel y calidad del aceite del sistema','Fugas y ajuste del sistema completo de aire','Pruebas de respuesta de electroválvulas']],
 ['Motor y transmisión',['Cables expuestos','Rodamientos y guardas funcionando bien']],
 ['Cadenas y bandas',['Levas y opresores bien sujetos','Alineación de cadenas y piñones']],
 ['Rodillos y guías',['Rótulas bien puestas','Pandeos, desgaste o golpes en los ejes']],
 ['Sistema eléctrico',['Sopleteo de tablero y módulos eléctricos','Revisión de resistencias y termopares']],
 ['Sistema electrónico',['Limpieza de la óptica','Reajuste de conectores de los módulos']],
 ['Lubricación general',['Rodamientos lineales y chumaceras','Cadenas y engranajes']],
 ['Tornillería y estructura',['Tornillos completos','Vibración o estructura mal ajustada']],
 ['Limpieza general',['Charcos de aceite, sopleteo y barrido de la zona de la máquina']],
 ['Pruebas de funcionamiento',[]]
];
const CAM_CHECK=[
  ['ZONA MECÁNICA',['ESTADO DE RODILLOS','ESTADO DE CABEZAL SUPERIOR E INFERIOR','ESTADO DE ROTULAS','ESTADO DE ESTRUCTURA Y TORNILLERÍA','ESTADO DE LA BANDA','ESTADO DE BALEROS','ESTADO DEL MOTOR','ESTADO DE LA MEDIA LUNA','ESTADO DEL CHUC','ESTADO DE LAS CUCHILLAS','ESTADO DEL PISADOR']],
  ['ZONA NEUMÁTICA E HIDRÁULICA',['ESTADO DE LOS PISTONES','ESTADO DE LAS VÁLVULAS','ESTADO DE LAS MANGUERAS','ESTADO DEL ACEITE','ESTADO DE LAS ELECTROVÁLVULAS','ESTADO DEL CHILLER']],
  ['ZONA ELÉCTRICA',['ESTADO DE LOS CABLES Y TERMINALES','ESTADO DE LOS CONTACTORES','ESTADO DE LAS PASTILLAS TÉRMICAS','ESTADO DE LOS GUARDAMOTORES','ESTADO DE LOS ESTADOS SÓLIDOS','ESTADO DE LOS PIROMETROS','ESTADO DEL INVERSOR','ESTADO DEL PLC','ESTADO DE LAS RESISTENCIAS','ESTADO DEL DISPLAY','ESTADO DE SENSORES','ESTADO FOTOCELDAS']]
];
const DIM_CHECK=[
  ['ZONA MECÁNICA',[
    'ESTADO DE RODILLOS',
    'ESTADO DE CABEZAL SUPERIOR E INFERIOR',
    'ESTADO DE ROTULAS',
    'ESTADO DE ESTRUCTURA Y TORNILLERÍA',
    'ESTADO DE LA BANDA',
    'ESTADO DE BALEROS',
    'ESTADO DEL MOTOR',
    'ESTADO DE LA MEDIA LUNA',
    'ESTADO DEL CHUC',
    'ESTADO DE LAS CUCHILLAS',
    'ESTADO DEL PISADOR'
  ]],
  ['ZONA NEUMÁTICA E HIDRÁULICA',[
    'ESTADO DE LOS PISTONES',
    'ESTADO DE LAS VÁLVULAS',
    'ESTADO DE LAS MANGUERAS',
    'ESTADO DEL ACEITE',
    'ESTADO DE LAS ELECTROVÁLVULAS',
    'ESTADO DEL CHILLER'
  ]],
  ['ZONA ELÉCTRICA',[
    'ESTADO DE LOS CABLES Y TERMINALES',
    'ESTADO DE LOS CONTACTORES',
    'ESTADO DE LAS PASTILLAS TÉRMICAS',
    'ESTADO DE LOS GUARDAMOTORES',
    'ESTADO DE LOS ESTADOS SÓLIDOS',
    'ESTADO DE LOS PIROMETROS',
    'ESTADO DEL INVERSOR',
    'ESTADO DEL PLC',
    'ESTADO DE LAS RESISTENCIAS',
    'ESTADO DEL DISPLAY',
    'ESTADO DE SENSORES',
    'ESTADO FOTOCELDAS'
  ]]
];
const MQ_BY_AREA={CAM:MQ,BSL:MQ};
function buildMq(){
  if(Runtime.code==='CAM'){
    let k=0,h='<button class="link" style="margin:0 0 12px" onclick="allOk(\'cm\')">Marcar todo en OK</button>';
    CAM_CHECK.forEach((g,n)=>{
      h+='<div class="card"><h3>'+g[0]+'</h3><button class="link" style="margin:0 0 8px" onclick="allOk(\'cm'+n+'-\')">Marcar zona en OK</button>';
      g[1].forEach(t=>{
        const id='cm'+n+'-'+k++;
        h+='<div class="zr"><b>'+t+'</b><div class="seg" id="'+id+'" data-v="">'+['OK','Falla','N/A'].map(x=>'<button type="button" aria-pressed="false" onclick="choose(\''+id+'\',this)">'+x+'</button>').join('')+'</div></div>';
      });
      h+='</div>';
    });
    return h;
  }
  if(Runtime.code==='DIM'){
    let k=0,h='';
    if(/^(BM|BD)-/i.test(Runtime.machine)){
      h+='<div class="card"><h3>Uso de la grasera</h3><button class="link" style="margin:0 0 8px" onclick="greaseAll()">Marcar todos</button><div class="grease-grid" role="group" aria-label="'+GREASE_N+' puntos de la grasera">';
      for(let p=1;p<=GREASE_N;p++)h+='<button type="button" class="grease-point" data-grease="'+p+'" aria-pressed="false" aria-label="Punto '+p+'" onclick="toggleGrease(this)">'+p+'</button>';
      h+='</div><p class="grease-help" id="greaseProgress">0 de '+GREASE_N+' puntos</p></div>';
    }
    h+='<button class="link" style="margin:0 0 12px" onclick="allOk(\'m\')">Marcar todo en OK</button>';
    DIM_CHECK.forEach((g,n)=>{
      h+='<div class="card"><h3>'+g[0]+'</h3><button class="link" style="margin:0 0 8px" onclick="allOk(\'m'+n+'-\')">Marcar zona en OK</button>';
      g[1].forEach(t=>{
        const id='m'+n+'-'+k++;
        h+='<div class="zr"><b>'+t+'</b><div class="seg" id="'+id+'" data-v="">'+['OK','Falla','N/A'].map(x=>'<button type="button" aria-pressed="false" onclick="choose(\''+id+'\',this)">'+x+'</button>').join('')+'</div></div>';
      });
      h+='</div>';
    });
    return h;
  }
  const groups=MQ_BY_AREA[Runtime.code]||MQ;
  let k=0,h='<button class="link" style="margin:0 0 12px" onclick="allOk(\'m\')">Marcar todo en OK</button>';
  groups.forEach((g,n)=>{
    const items=g[1].length?g[1]:[g[0]];
    h+='<div class="card"><h3>'+(n+1)+'. '+g[0]+'</h3>';
    items.forEach(t=>{
      h+='<div class="zr">'+(g[1].length?'<b>'+t+'</b>':'')+'<div class="seg" id="m'+k+'" data-v="">'+['OK','Falla','N/A'].map(x=>'<button type="button" aria-pressed="false" onclick="choose(\'m'+k+'\',this)">'+x+'</button>').join('')+'</div></div>';
      k++;
    });
    h+='</div>';
  });
  return h;
}
const GREASE_N=47;
function greaseProgress(){
  const progress=$('greaseProgress');
  if(progress)progress.textContent=Array.from(document.querySelectorAll('#ext [data-grease]')).filter(b=>b.getAttribute('aria-pressed')==='true').length+' de '+GREASE_N+' puntos';
}
function toggleGrease(button){
  button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'));
  greaseProgress();saveDraft();buzz(8);
}
function greaseAll(){
  document.querySelectorAll('#ext [data-grease]').forEach(b=>b.setAttribute('aria-pressed','true'));
  greaseProgress();saveDraft();buzz(8);
}
function mqRows(){
  if(Runtime.code==='CAM'){
    const r=[];let k=0;
    CAM_CHECK.forEach((g,n)=>{
      r.push([g[0],'',1]);
      g[1].forEach(t=>r.push([t,$('cm'+n+'-'+k++).dataset.v]));
    });
    return r;
  }
  if(Runtime.code==='DIM'){
    const r=[];let k=0;
    if(/^(BM|BD)-/i.test(Runtime.machine)){
      r.push(['USO DE LA GRASERA','',1]);
      for(let p=1;p<=GREASE_N;p++){
        const button=document.querySelector('#ext [data-grease="'+p+'"]');
        r.push(['Punto '+p,button&&button.getAttribute('aria-pressed')==='true'?'SÍ':'PENDIENTE']);
      }
    }
    DIM_CHECK.forEach((g,n)=>{
      r.push([g[0],'',1]);
      g[1].forEach(t=>r.push([t,$('m'+n+'-'+k++).dataset.v]));
    });
    return r;
  }
  const groups=MQ_BY_AREA[Runtime.code]||MQ;
  const r=[];let k=0;
  groups.forEach((g,n)=>{
    if(g[1].length){r.push([(n+1)+'. '+g[0],'',1]);g[1].forEach(t=>r.push([t,$('m'+(k++)).dataset.v]))}
    else r.push([(n+1)+'. '+g[0],$('m'+(k++)).dataset.v]);
  });
  return r;
}


/* ===== Tablero Kanban local ===== */
const kanbanKey=()=>'mtto_kanban';
function loadKanban(){try{const a=JSON.parse(store.get(kanbanKey(),'[]'));return Array.isArray(a)?a:[]}catch(e){return[]}}
function saveKanban(a){store.set(kanbanKey(),JSON.stringify(a))}
function addKanbanTask(){
  const title=$('kanbanTitle').value.trim();if(!title){toast('Escribe el nombre de la tarea.');$('kanbanTitle').focus();return}
  const tasks=loadKanban();tasks.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),title,area:$('kanbanArea').value.trim(),due:$('kanbanDue').value,details:$('kanbanDetails').value.trim(),status:'todo',created:Date.now()});
  saveKanban(tasks);$('kanbanTitle').value='';$('kanbanArea').value='';$('kanbanDue').value='';$('kanbanDetails').value='';renderKanban();toast('Tarea agregada al tablero.');
}
function moveKanbanTask(id,status){
  const tasks=loadKanban(),task=tasks.find(x=>x.id===id);if(!task)return;
  task.status=status;saveKanban(tasks);
  const reminders=loadReminders(),linked=reminders.find(r=>r.taskId===id||r.id===task.reminderId);
  if(linked){
    linked.status=status==='done'?'done':'pending';
    saveReminders(reminders);
    if(window.ChiaplastNative&&typeof window.ChiaplastNative.cancelReminder==='function'&&linked.status==='done')window.ChiaplastNative.cancelReminder(linked.id);
    else if(linked.status!=='done'&&Date.parse(linked.due)>Date.now())scheduleNativeReminder(linked);
  }
  renderKanban();renderReminders();renderHomeFollowup();
}
function deleteKanbanTask(id){
  const tasks=loadKanban(),task=tasks.find(x=>x.id===id);saveKanban(tasks.filter(t=>t.id!==id));
  const reminders=loadReminders(),linked=reminders.find(r=>r.taskId===id||r.id===task?.reminderId);
  if(linked){delete linked.taskId;saveReminders(reminders)}
  renderKanban();renderReminders();renderHomeFollowup();toast('Tarea eliminada; sus avisos se conservaron.');
}
function renderKanban(){
  const tasks=loadKanban(),cols={todo:$('kanbanTodo'),doing:$('kanbanDoing'),done:$('kanbanDone')};if(!cols.todo)return;
  const openCount=tasks.filter(task=>(task.status||'todo')!=='done').length;
  const countLabel=$('kanbanOpenCount');
  if(countLabel)countLabel.textContent=openCount+' '+(openCount===1?'ORDEN ACTIVA':'ÓRDENES ACTIVAS');
  Object.keys(cols).forEach(k=>{
    const subset=tasks.filter(t=>(t.status||'todo')===k);
    cols[k].innerHTML=subset.length?subset.map(t=>'<div class="kanban-item"><b>'+esc(t.title)+'</b>'+(t.area?'<small>'+esc(t.area)+'</small>':'')+(t.due?'<small>Fecha límite: '+esc(fmtD(t.due))+'</small>':'')+(t.details?'<small>'+esc(t.details)+'</small>':'')+'<div class="kanban-actions">'+(k!=='todo'?'<button type="button" onclick="moveKanbanTask(&quot;'+esc(t.id)+'&quot;,&quot;todo&quot;)">← Por hacer</button>':'')+(k!=='doing'?'<button type="button" onclick="moveKanbanTask(&quot;'+esc(t.id)+'&quot;,&quot;doing&quot;)">En proceso</button>':'')+(k!=='done'?'<button type="button" onclick="moveKanbanTask(&quot;'+esc(t.id)+'&quot;,&quot;done&quot;)">Terminado</button><button type="button" onclick="openReminderForKanbanTask(&quot;'+esc(t.id)+'&quot;)">Programar aviso</button>':'')+'<button type="button" onclick="openNotes(&quot;Kanban&quot;,&quot;'+esc(t.area||'')+'&quot;)">Nota técnica</button><button type="button" onclick="deleteKanbanTask(&quot;'+esc(t.id)+'&quot;)">Eliminar</button></div></div>').join(''):'<div class="empty" style="font-size:12px;padding:10px 4px">Sin tareas</div>';
  });
}
/* ===== Calendario local de órdenes preventivas ===== */
const preventiveCalendarKey=()=>stateKey('mtto_preventive_calendar');
let currentPreventiveOrderId='';
function loadPreventiveCalendar(){
  try{const orders=JSON.parse(store.get(preventiveCalendarKey(),'[]'));return Array.isArray(orders)?orders:[]}
  catch(e){return[]}
}
function savePreventiveCalendar(orders){return store.set(preventiveCalendarKey(),JSON.stringify(orders))}
function calendarToday(){const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function addCalendarDays(value,count){
  const parts=value.split('-').map(Number),d=new Date(parts[0],parts[1]-1,parts[2]);
  d.setDate(d.getDate()+count);
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
}
function updateCalendarMachines(){
  const code=$('calendarArea').value,data=MACHINE_DB[code],machineSelect=$('calendarMachine');
  machineSelect.innerHTML=data?'<option value="">Selecciona una máquina</option>'+data.machines.map(machine=>'<option value="'+esc(machine)+'">'+esc(machine)+'</option>').join(''):'<option value="">Primero selecciona un área</option>';
  machineSelect.disabled=!data;
}
function updateCalendarPeriodHint(){
  const date=$('calendarStartDate').value,week=$('calendarPeriod').value==='week';
  $('calendarPeriodHint').textContent=!date?'':week?'Periodo de 7 días: del '+fmtD(date)+' al '+fmtD(addCalendarDays(date,6))+'.':'Programado para el '+fmtD(date)+'.';
}
function addPreventiveOrder(event){
  event.preventDefault();
  const code=$('calendarArea').value,data=MACHINE_DB[code],machine=$('calendarMachine').value,title=$('calendarTitle').value.trim(),startDate=$('calendarStartDate').value;
  if(!data||!data.machines.includes(machine)||!title||!startDate){toast('Completa el trabajo, el área, la máquina y la fecha.');return}
  const week=$('calendarPeriod').value==='week';
  const order={id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),title,area:data.area,code,machine,details:$('calendarDetails').value.trim(),period:week?'week':'day',startDate,endDate:week?addCalendarDays(startDate,6):startDate,status:'pending',createdAt:Date.now(),completedAt:null};
  const orders=loadPreventiveCalendar();orders.push(order);
  if(!savePreventiveCalendar(orders)){toast('No se pudo guardar la orden en este dispositivo.');return}
  $('calendarTitle').value='';$('calendarDetails').value='';
  renderPreventiveCalendar();renderHomeFollowup();toast('Orden preventiva agregada al calendario.');
}
function renderPreventiveCalendar(){
  const target=$('preventiveCalendarList');if(!target)return;
  const orders=loadPreventiveCalendar().sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate))||Number(b.createdAt||0)-Number(a.createdAt||0));
  target.innerHTML=orders.length?orders.map(order=>{
    const done=order.status==='done',overdue=!done&&order.endDate<calendarToday(),status=done?'Hecho':'Aún no hecho';
    const dates=order.period==='week'?'Periodo: '+fmtD(order.startDate)+' – '+fmtD(order.endDate):'Fecha: '+fmtD(order.startDate);
    return '<article class="calendar-item'+(done?' is-done':overdue?' is-overdue':'')+'"><b>'+esc(order.title)+'</b><div class="calendar-meta">'+esc(order.area)+' · '+esc(order.machine)+'<br>'+esc(dates)+'<br><span class="calendar-status '+(done?'is-done':'is-pending')+'">'+status+'</span></div><button type="button" class="btn btn-s" style="width:100%;min-height:42px" onclick="openPreventiveOrder(&quot;'+esc(order.id)+'&quot;)">Abrir orden</button></article>';
  }).join(''):'<div class="empty">No hay órdenes programadas. Agrega una orden para verla en este calendario.</div>';
}
function openPreventiveOrder(id){
  if(!loadPreventiveCalendar().some(order=>order.id===id)){toast('No se encontró la orden preventiva.');return}
  currentPreventiveOrderId=id;go('preventiveOrder');
}
function renderPreventiveOrder(){
  const target=$('preventiveOrderDetail');if(!target)return;
  const order=loadPreventiveCalendar().find(item=>item.id===currentPreventiveOrderId);
  if(!order){$('preventiveOrderSubtitle').textContent='Orden no disponible';target.innerHTML='<p class="empty">No se encontró esta orden en el dispositivo.</p>';return}
  const done=order.status==='done',dates=order.period==='week'?'Del '+fmtD(order.startDate)+' al '+fmtD(order.endDate)+' (7 días)':fmtD(order.startDate);
  $('preventiveOrderSubtitle').textContent=order.machine+' · '+(done?'Hecho':'Aún no hecho');
  target.innerHTML='<h2>'+esc(order.title)+'</h2><p class="calendar-status '+(done?'is-done':'is-pending')+'">'+(done?'Hecho':'Aún no hecho')+'</p><p><b>Área:</b> '+esc(order.area)+'</p><p><b>Máquina:</b> '+esc(order.machine)+'</p><p><b>Programación:</b> '+esc(dates)+'</p>'+(order.details?'<p><b>Detalle:</b> '+esc(order.details)+'</p>':'')+(done&&order.completedAt?'<p><b>Marcado como hecho:</b> '+esc(new Date(order.completedAt).toLocaleString('es-MX'))+'</p>':'')+(done?'<button type="button" class="btn btn-s" onclick="setPreventiveOrderStatus(&quot;pending&quot;)">Marcar como aún no hecho</button>':'<button type="button" class="btn btn-p" onclick="setPreventiveOrderStatus(&quot;done&quot;)">Marcar como hecho</button>');
}
function setPreventiveOrderStatus(status){
  if(status!=='done'&&status!=='pending')return;
  const orders=loadPreventiveCalendar(),order=orders.find(item=>item.id===currentPreventiveOrderId);if(!order)return;
  const previousStatus=order.status,previousCompletedAt=order.completedAt;
  order.status=status;order.completedAt=status==='done'?Date.now():null;
  if(!savePreventiveCalendar(orders)){order.status=previousStatus;order.completedAt=previousCompletedAt;toast('No se pudo actualizar el estado de la orden.');return}
  renderPreventiveOrder();renderPreventiveCalendar();renderHomeFollowup();
}
/* ===== Tablero mensual de mantenimiento preventivo =====
   Replica el plano de la planta. El check de cada mes se guarda en este dispositivo
   bajo la clave mtto_pm_board_AAAA-MM. */
const pmM=(name,key)=>({name,short:name,key:key||name});
const pmList=names=>names.map(n=>pmM(n));
const pmG=(name,span,count,cols)=>({group:name,span,cols:cols||count,subs:Array.from({length:count},(_,i)=>({name:name+' '+(i+1),short:String(i+1),key:name.replace(/\s+/g,'-')+'-'+(i+1)}))});
const PM_LAYOUT=[
  {code:'CAM',title:'CAM',cols:4,items:[
    ...pmList(['BK-1','BK-2','BK-3','BK-4','BK-5','BK-6','BK-7','BK-8','BNG-1','BNG-2','BC-1']),pmM('BC-1','BC-1#2'),
    ...pmList(['IMP-1','IMP-2','IMP-3','FLEJADORA'])]},
  {code:'DIM',title:'DIM',cols:4,items:[
    ...pmList(['BM-1','BM-2','BM-3','BM-4','BM-5','BD-1','BD-2','BD-3']),
    pmG('SELLADORA',4,5),pmG('HORNO M',2,4,2),pmM('FLEJADORA','FLEJADORA-1'),pmM('FLEJADORA','FLEJADORA-2')]},
  {code:'BSL',title:'BSL',cols:4,items:pmList(['BW-1','BN-1','BN-2','BN-3','BN-4','B-02','B-03','B-06','BSL-1','BSL-2','BSL-3','BSL-4','BSL-5','BSL-6','BD-4','ELEVADOR'])},
  {code:'EXT1',title:'EXT1',cols:7,items:pmList(['EXT-19','ECB-1','CRI-3','CRI-4','CRI-5','EXT-6','EXT-8','EXT-9','EXT-10','EXT-11','EXT-12','EXT-13','EXT-14','EXT-15','EXT-16','EXT-17','EXT-20','EXT-21','EXT-22','EXT-A1','EXT-A2','RF','RF 2','EXT-N1','EXT-N2','FUELLADORA','FUELLADORA 2','EXT-A3'])},
  {code:'EXT2',title:'EXT2',cols:7,items:pmList(['EXT-A4','EXT-A5','EXT-A6','EXT-A7','EXT-A8','EXT-A9','EXT-A10','EXT-A11','EXT-A12','EXT-A13','EXT-N3','EXT-N4','EXT-N5','EXT-N6','EXT-N7','CRI-1','CRI-2'])}
];
const PM_PREFIX='mtto_pm_board_';
const PMBoard={month:'',date:'',data:{},savedAt:0};
const pmKey=month=>PM_PREFIX+month;
const pmMonthNow=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)};
const pmDaysIn=month=>{const p=month.split('-').map(Number);return new Date(p[0],p[1],0).getDate()};
const pmMonthName=(month,short)=>{const p=month.split('-').map(Number);return new Date(p[0],p[1]-1,1).toLocaleDateString('es-MX',{month:short?'short':'long',year:'numeric'})};
const pmDefaultDate=month=>month===pmMonthNow()?calendarToday():month+'-01';
/* Lista plana de máquinas: [{id,name,short,zone}] */
const PM_ITEMS=(()=>{
  const out=[];
  PM_LAYOUT.forEach(z=>z.items.forEach(it=>{
    if(it.group)it.subs.forEach(s=>out.push({id:z.code+':'+s.key,name:s.name,zone:z.code}));
    else out.push({id:z.code+':'+it.key,name:it.name,zone:z.code});
  }));
  return out;
})();
function pmParse(raw){
  try{const v=JSON.parse(raw);return v&&typeof v==='object'&&v.done&&typeof v.done==='object'&&!Array.isArray(v.done)?v:null}
  catch(e){return null}
}
function pmLoadMonth(month){
  const v=pmParse(store.get(pmKey(month),''));
  PMBoard.data=v?v.done:{};PMBoard.savedAt=v&&v.savedAt||0;
}
function pmPersist(){
  const savedAt=Date.now();
  const ok=store.set(pmKey(PMBoard.month),JSON.stringify({v:1,month:PMBoard.month,savedAt,done:PMBoard.data}));
  if(ok)PMBoard.savedAt=savedAt;
  return ok;
}
function openPreventiveBoard(){go('preventiveBoard')}
function pmShiftMonth(delta){
  const p=PMBoard.month.split('-').map(Number),d=new Date(p[0],p[1]-1+delta,1);
  PMBoard.month=d.getFullYear()+'-'+pad(d.getMonth()+1);
  pmLoadMonth(PMBoard.month);PMBoard.date=pmDefaultDate(PMBoard.month);
  renderPmBoard();
}
function pmSetDate(value){
  const n=pmDaysIn(PMBoard.month);
  if(!value||value<PMBoard.month+'-01'||value>PMBoard.month+'-'+pad(n)){
    toast('La fecha debe estar dentro de '+pmMonthName(PMBoard.month)+'.');
    $('pmDate').value=PMBoard.date;return;
  }
  PMBoard.date=value;
}
function pmToggle(id){
  const item=PM_ITEMS.find(i=>i.id===id);if(!item)return;
  const had=Object.prototype.hasOwnProperty.call(PMBoard.data,id),prev=PMBoard.data[id];
  if(had){
    if(!window.confirm('¿Quitar el check de '+item.name+'?'))return;
    delete PMBoard.data[id];
  }else PMBoard.data[id]={d:PMBoard.date,t:Date.now()};
  if(!pmPersist()){
    if(had)PMBoard.data[id]=prev;else delete PMBoard.data[id];
    toast('No se pudo guardar el cambio en este dispositivo.');return;
  }
  buzz(10);renderPmBoard();
}
function pmSaveNow(){
  if(pmPersist()){renderPmBoard();toast('Tablero de '+pmMonthName(PMBoard.month)+' guardado en este dispositivo.')}
  else toast('No se pudo guardar el tablero en este dispositivo.');
}
function pmResetMonth(){
  const n=Object.keys(PMBoard.data).length;
  if(!n){toast('Este mes no tiene checks que reiniciar.');return}
  if(!window.confirm('Se quitarán los '+n+' checks de '+pmMonthName(PMBoard.month)+'. ¿Continuar?'))return;
  const prev=PMBoard.data;PMBoard.data={};
  if(!pmPersist()){PMBoard.data=prev;toast('No se pudo reiniciar el mes.');return}
  renderPmBoard();toast('Mes reiniciado.');
}
async function pmExportCsv(){
  const q=v=>'"'+String(v).replace(/"/g,'""')+'"';
  const rows=[['Zona','Máquina','Preventivo','Fecha']];
  PM_ITEMS.forEach(i=>{const r=PMBoard.data[i.id];rows.push([i.zone,i.name,r?'Hecho':'Pendiente',r?fmtD(r.d):''])});
  const blob=new Blob(['﻿'+rows.map(r=>r.map(q).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  try{
    const mode=await exportReport(blob,'PREVENTIVO_'+PMBoard.month.replace('-','')+'.csv','text/csv');
    LastExports.length=0;
    toast(mode==='android-saved'?'CSV guardado en Descargas/Chiaplast':'CSV exportado.');
  }catch(e){toast(e&&e.message?e.message:'No se pudo exportar el CSV.')}
}
function pmCellHtml(zone,m){
  const id=zone+':'+m.key,rec=PMBoard.data[id];
  return '<button type="button" class="pm-cell'+(rec?' is-done':'')+(m.short.length>=9&&m.short.indexOf(' ')<0?' is-long':'')+'" data-id="'+esc(id)+'" aria-pressed="'+(rec?'true':'false')+'" title="'+esc(m.name)+'">'+esc(m.short)+'<small>'+(rec?esc(fmtD(rec.d).slice(0,5)):'')+'</small></button>';
}
function pmZoneStats(code){
  const items=PM_ITEMS.filter(i=>i.zone===code);
  return{total:items.length,done:items.filter(i=>PMBoard.data[i.id]).length};
}
function pmHistory(){
  const rows=[];
  try{
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(!k||k.indexOf(PM_PREFIX)!==0)continue;
      const month=k.slice(PM_PREFIX.length);if(!/^\d{4}-\d{2}$/.test(month))continue;
      const v=pmParse(localStorage.getItem(k));if(!v)continue;
      rows.push({month,done:PM_ITEMS.filter(it=>v.done[it.id]).length});
    }
  }catch(e){}
  return rows.sort((a,b)=>b.month.localeCompare(a.month)).slice(0,6);
}
function renderPmBoard(){
  if(!PMBoard.month){PMBoard.month=pmMonthNow();pmLoadMonth(PMBoard.month);PMBoard.date=pmDefaultDate(PMBoard.month)}
  const month=PMBoard.month,days=pmDaysIn(month),total=PM_ITEMS.length;
  const doneItems=PM_ITEMS.filter(i=>PMBoard.data[i.id]),done=doneItems.length,pending=total-done,pct=total?Math.round(done*100/total):0;
  const monthLabel=pmMonthName(month);$('pmMonthLabel').textContent=monthLabel.charAt(0).toUpperCase()+monthLabel.slice(1);
  const dateInput=$('pmDate');dateInput.min=month+'-01';dateInput.max=month+'-'+pad(days);dateInput.value=PMBoard.date;

  $('pmPlant').innerHTML=PM_LAYOUT.map(z=>{
    const s=pmZoneStats(z.code);
    const cells=z.items.map(it=>it.group
      ?'<div class="pm-group" style="--span:'+it.span+'"><b>'+esc(it.group)+'</b><div class="pm-subs" style="--n:'+it.cols+'">'+it.subs.map(sub=>pmCellHtml(z.code,sub)).join('')+'</div></div>'
      :pmCellHtml(z.code,it)).join('');
    return '<section class="pm-zone" data-z="'+z.code+'"><div class="pm-zone-head"><h3>'+esc(z.title)+'</h3><span>'+s.done+'/'+s.total+'</span></div><div class="pm-scroll"><div class="pm-grid" style="--cols:'+z.cols+'">'+cells+'</div></div></section>';
  }).join('');

  $('pmSummaryText').textContent=done+' de '+total+' · '+pct+'%';
  $('pmSummaryFill').style.width=pct+'%';
  $('pmSavedAt').textContent=PMBoard.savedAt?'Guardado '+new Date(PMBoard.savedAt).toLocaleString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'Sin cambios guardados';

  /* Estadísticas */
  const now=pmMonthNow(),elapsed=month===now?new Date().getDate():month<now?days:0;
  const rate=elapsed?done/elapsed:0;
  const rateText=elapsed?(rate<10?rate.toFixed(1):Math.round(rate))+'':'—';
  const rateNote=month===now&&elapsed?'Proyección al cierre: '+Math.min(total,Math.round(rate*days)):month<now?'Mes cerrado':'Mes por iniciar';
  const perDay=Array(days).fill(0);
  doneItems.forEach(i=>{const d=Number(String(PMBoard.data[i.id].d||'').slice(8,10));if(d>=1&&d<=days)perDay[d-1]++});
  const maxDay=Math.max(1,...perDay);
  const zoneRows=PM_LAYOUT.map(z=>{const s=pmZoneStats(z.code),p=s.total?Math.round(s.done*100/s.total):0;
    return '<div class="pm-row"><b>'+esc(z.title)+'</b><div class="pm-track"><div class="pm-fill" style="width:'+p+'%"></div></div><em>'+s.done+'/'+s.total+' · '+p+'%</em></div>'}).join('');
  const dayBars=perDay.map((n,i)=>'<div class="pm-day" title="Día '+(i+1)+': '+n+'">'+(n?'<u>'+n+'</u>':'')+'<i style="height:'+Math.round(n*100/maxDay)+'%"></i></div>').join('');
  const axis=perDay.map((n,i)=>'<span>'+((i+1===1||(i+1)%5===0)?i+1:'')+'</span>').join('');
  const pendingHtml=pending?PM_LAYOUT.map(z=>{
    const list=PM_ITEMS.filter(i=>i.zone===z.code&&!PMBoard.data[i.id]);
    return list.length?'<div class="pm-pending-zone"><b>'+esc(z.title)+' · '+list.length+'</b><div class="pm-chips">'+list.map(i=>'<span class="pm-chip">'+esc(i.name)+'</span>').join('')+'</div></div>':'';
  }).join(''):'<p class="empty">Todas las máquinas ya tienen su preventivo de este mes.</p>';
  const hist=pmHistory();
  const histHtml=hist.length?hist.map(h=>{const p=total?Math.round(h.done*100/total):0;
    return '<div class="pm-row"><b>'+esc(pmMonthName(h.month,true))+'</b><div class="pm-track"><div class="pm-fill" style="width:'+p+'%"></div></div><em>'+h.done+'/'+total+' · '+p+'%</em></div>'}).join(''):'<p class="empty">Aún no hay meses guardados.</p>';
  $('pmStats').innerHTML=
    '<div class="h2" style="margin-top:0">Estadísticas de '+esc(pmMonthName(month))+'</div>'+
    '<div class="pm-kpis">'+
      '<div class="pm-kpi"><span>CON PREVENTIVO</span><b>'+done+'</b><small>de '+total+' máquinas</small></div>'+
      '<div class="pm-kpi"><span>PENDIENTES</span><b>'+pending+'</b><small>por atender</small></div>'+
      '<div class="pm-kpi"><span>AVANCE DEL MES</span><b>'+pct+'%</b><small>cumplimiento</small></div>'+
      '<div class="pm-kpi"><span>RITMO DIARIO</span><b>'+rateText+'</b><small>'+esc(rateNote)+'</small></div>'+
    '</div>'+
    '<div class="pm-panels">'+
      '<div class="pm-panel"><h3>Avance por área</h3>'+zoneRows+'</div>'+
      '<div class="pm-panel"><h3>Preventivos por día</h3><div class="pm-days">'+dayBars+'</div><div class="pm-axis">'+axis+'</div></div>'+
      '<div class="pm-panel"><h3>Máquinas pendientes</h3>'+pendingHtml+'</div>'+
      '<div class="pm-panel"><h3>Historial de meses</h3>'+histHtml+'</div>'+
    '</div>';
}
$('pmPlant').addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(b)pmToggle(b.dataset.id)});

/* ===== Notas técnicas con fotografías y caducidad de 30 días ===== */
const NOTES_DB=()=> 'chiaplast-notes-v1',NOTES_STORE='notes';
let notePhotosDraft=[];
function openNotesDB(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){reject(new Error('Este dispositivo no permite el almacenamiento local de notas.'));return}
    const req=indexedDB.open(NOTES_DB(),1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(NOTES_STORE))db.createObjectStore(NOTES_STORE,{keyPath:'id'})};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('No se pudo abrir el almacenamiento local.'));
  });
}
async function notesAll(){
  const db=await openNotesDB();
  return new Promise((resolve,reject)=>{const tx=db.transaction(NOTES_STORE,'readonly'),req=tx.objectStore(NOTES_STORE).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close()});
}
async function notesPut(note){
  const db=await openNotesDB();
  return new Promise((resolve,reject)=>{const tx=db.transaction(NOTES_STORE,'readwrite');tx.objectStore(NOTES_STORE).put(note);tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>{db.close();reject(tx.error||new Error('No se pudo guardar la nota.'))};tx.onabort=()=>{db.close();reject(tx.error||new Error('Se canceló el guardado.'))}});
}
async function notesDelete(id){
  const db=await openNotesDB();
  return new Promise((resolve,reject)=>{const tx=db.transaction(NOTES_STORE,'readwrite');tx.objectStore(NOTES_STORE).delete(id);tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>{db.close();reject(tx.error)}});
}
async function purgeExpiredNotes(){
  const all=await notesAll(),now=Date.now(),expired=all.filter(n=>!Number.isFinite(n.created)||now-n.created>=30*24*60*60*1000);
  for(const n of expired){deleteNoteEvidence(n);await notesDelete(n.id)}
  return expired.length;
}
function deleteNoteEvidence(note){
  try{if(window.ChiaplastNative&&typeof window.ChiaplastNative.deleteEvidence==='function')(note.photos||[]).forEach(src=>{if(typeof src==='string'&&src.includes('/evidence/'))window.ChiaplastNative.deleteEvidence(src)})}catch(e){}
}
function captureNotePhoto(){
  if(notePhotosDraft.length>=5){toast('Se admiten hasta 5 fotografías por nota.');return}
  partsPhotoTarget='note';
  if(window.ChiaplastNative&&typeof window.ChiaplastNative.takePhoto==='function'){window.ChiaplastNative.takePhoto('note');return}
  $('notePhotos').click();
}
function pickNotePhoto(){
  if(notePhotosDraft.length>=5){toast('Se admiten hasta 5 fotografías por nota.');return}
  partsPhotoTarget='note';
  if(window.ChiaplastNative&&typeof window.ChiaplastNative.pickPhoto==='function'){window.ChiaplastNative.pickPhoto('note');return}
  $('notePhotos').removeAttribute('capture');$('notePhotos').click();
}
window.onEvidenceCaptured=function(raw){
  try{
    const data=typeof raw==='string'?JSON.parse(raw):raw;
    if(!data||!data.uri)return;
    if(partsPhotoTarget==='specialBefore'||partsPhotoTarget==='specialAfter'){
      const stage=partsPhotoTarget==='specialBefore'?'before':'after';
      if(specialPhotos[stage].length>=5){if(window.ChiaplastNative&&window.ChiaplastNative.deleteEvidence)window.ChiaplastNative.deleteEvidence(data.uri);toast('Máximo 5 fotos por etapa.');return}
      specialPhotos[stage].push(data.uri);specialRenderPhotos();specialSaveDraftOnly();toast('Evidencia del trabajo especial agregada.');return;
    }
    if(partsPhotoTarget==='pmBefore'||partsPhotoTarget==='pmAfter'){
      const stage=partsPhotoTarget==='pmBefore'?'before':'after';
      if(preventivePhotos[stage].length>=5){if(window.ChiaplastNative&&window.ChiaplastNative.deleteEvidence)window.ChiaplastNative.deleteEvidence(data.uri);toast('Máximo 5 fotos por etapa.');return}
      preventivePhotos[stage].push(data.uri);renderPreventivePhotos();savePreventivePhotos().then(()=>toast('Fotografía preventiva guardada.')).catch(()=>toast('No se pudo guardar la fotografía.'));return;
    }
    if(partsPhotoTarget==='parts'){
      if(partsPhotosDraft.length>=5){if(window.ChiaplastNative&&window.ChiaplastNative.deleteEvidence)window.ChiaplastNative.deleteEvidence(data.uri);toast('Se admiten hasta 5 fotografías de refacciones.');return}
      partsPhotosDraft.push(data.uri);renderPartsPhotos();savePartsPhotos().then(()=>toast('Fotografía de refacción guardada.')).catch(()=>toast('La fotografía no se pudo guardar localmente.'));
      return;
    }
    if(notePhotosDraft.length>=5){if(window.ChiaplastNative&&window.ChiaplastNative.deleteEvidence)window.ChiaplastNative.deleteEvidence(data.uri);toast('Se admiten hasta 5 fotografías por nota.');return}
    notePhotosDraft.push(data.uri);renderPhotoPreview();toast('Evidencia agregada.');
  }catch(e){toast('No se pudo agregar la fotografía.')}
};
function resizeNoteImage(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onerror=()=>reject(new Error('No se pudo leer una fotografía.'));
    reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('El archivo no es una imagen válida.'));img.onload=()=>{
      const scale=Math.min(1,1280/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
      const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',0.68));
    };img.src=reader.result};reader.readAsDataURL(file);
  });
}
async function previewNotePhotos(input){
  const files=Array.from(input.files||[]).slice(0,5);
  if((input.files||[]).length>5)toast('Se admiten hasta 5 fotografías por nota.');
  notePhotosDraft=[];$('notePhotoPreview').innerHTML='<span class="muted">Preparando fotografías…</span>';
  try{for(const file of files){if(file.type.startsWith('image/'))notePhotosDraft.push(await resizeNoteImage(file))}renderPhotoPreview();if(notePhotosDraft.length)toast(notePhotosDraft.length+' fotografía(s) preparadas.')}
  catch(e){notePhotosDraft=[];$('notePhotoPreview').innerHTML='';toast(e.message||'No se pudieron preparar las fotos.')}
}
function renderPhotoPreview(){$('notePhotoPreview').innerHTML=notePhotosDraft.map((src,i)=>'<figure><img src="'+src+'" alt="Vista previa '+(i+1)+'"><button type="button" aria-label="Quitar fotografía" onclick="removeDraftPhoto('+i+')">×</button></figure>').join('')}
function removeDraftPhoto(index){notePhotosDraft.splice(index,1);renderPhotoPreview();const input=$('notePhotos');if(input)input.value=''}
async function saveNote(){
  const title=$('noteTitle').value.trim(),text=$('noteText').value.trim();
  if(!title&&!text){toast('Escribe un título o una nota antes de guardar.');return}
  const now=Date.now(),note={id:now.toString(36)+Math.random().toString(36).slice(2,7),title:title||'Nota sin título',text,area:$('noteArea').value||'General',machine:$('noteMachine').value.trim(),created:now,expires:now+30*24*60*60*1000,photos:notePhotosDraft.slice()};
  try{
    await purgeExpiredNotes();await notesPut(note);
    $('noteTitle').value='';$('noteText').value='';$('noteMachine').value='';$('notePhotos').value='';notePhotosDraft=[];renderPhotoPreview();await renderNotes();
    alert('Nota guardada en este dispositivo.\n\nLas notas y fotografías se conservarán durante 30 días desde hoy y después se eliminarán automáticamente mientras Chiaplast vuelva a abrirse. Genera y guarda el PDF fuera de Chiaplast si necesitas conservar una copia.');
    toast('Nota guardada durante 30 días.');
  }catch(e){toast((e&&e.message)||'No se pudo guardar. Comprueba el espacio disponible del dispositivo.')}
}
async function renderNotes(){
  const list=$('notesList');if(!list)return;
  try{
    await purgeExpiredNotes();const all=(await notesAll()).sort((a,b)=>b.created-a.created);
    if(!all.length){list.innerHTML='<div class="empty">Sin notas.</div>';return}
    list.innerHTML=all.map(n=>'<article class="note-card"><h3>'+esc(n.title)+'</h3><div class="note-meta">'+esc(n.area)+(n.machine?' · '+esc(n.machine):'')+' · '+esc(new Date(n.created).toLocaleString())+'</div>'+(n.text?'<p style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(n.text)+'</p>':'')+'<div class="note-photos">'+(n.photos||[]).map((p,i)=>'<img src="'+p+'" alt="Evidencia '+(i+1)+'">').join('')+'</div><div class="note-meta">Caduca: '+esc(new Date(n.expires||n.created+30*24*60*60*1000).toLocaleDateString())+' · '+((n.photos||[]).length)+' foto(s)</div><div class="note-actions"><button class="btn btn-p" onclick="printNote(\''+esc(n.id)+'\')">Generar PDF</button><button class="btn btn-s" onclick="deleteNote(\''+esc(n.id)+'\')">Eliminar</button></div></article>').join('');
  }catch(e){list.innerHTML='<div class="empty">No se pudo leer el almacenamiento.</div>'}
}
async function deleteNote(id){if(!confirm('¿Eliminar esta nota y sus fotografías? Esta acción no se puede deshacer.'))return;try{const note=(await notesAll()).find(n=>n.id===id);if(note)deleteNoteEvidence(note);await notesDelete(id);await renderNotes();toast('Nota eliminada.')}catch(e){toast('No se pudo eliminar la nota.')}}
function buildNotePrintHtml(n){
  const imgs=(n.photos||[]).map((p,i)=>'<figure><img src="'+p+'" alt="Evidencia '+(i+1)+'"><figcaption>Fotografía '+(i+1)+'</figcaption></figure>').join('');
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(n.title)+'</title><style>body{font:14px Arial,sans-serif;color:#182631;margin:28px}h1{font-size:22px}h2{font-size:15px;margin-top:22px}.meta{color:#566674;font-size:12px;border-bottom:2px solid #e0e6eb;padding-bottom:12px}p{white-space:pre-wrap;line-height:1.5}figure{margin:12px 0;page-break-inside:avoid}img{max-width:100%;max-height:520px;object-fit:contain}figcaption{font-size:11px;color:#566674}@media print{body{margin:12mm}button{display:none}}</style></head><body><h1>CHIAPLAST · Nota técnica</h1><h2>'+esc(n.title)+'</h2><div class="meta">Apartado: '+esc(n.area)+' · Máquina: '+esc(n.machine||'No especificada')+'<br>Fecha: '+esc(new Date(n.created).toLocaleString())+'<br>Conservación en la app hasta: '+esc(new Date(n.expires||n.created+30*24*60*60*1000).toLocaleDateString())+'</div><p>'+esc(n.text||'Sin observaciones adicionales.')+'</p><h2>Evidencias fotográficas</h2>'+imgs+'<p class="meta">Documento generado desde Chiaplast. Guarda este PDF fuera de la aplicación para conservarlo después del plazo de 30 días.</p></body></html>';
}
async function printNote(id){
  try{
    const n=(await notesAll()).find(x=>x.id===id);if(!n){toast('La nota ya no está disponible.');return}
    const doc=buildNotePrintHtml(n);
    if(window.ChiaplastNative&&typeof window.ChiaplastNative.printHtmlReport==='function'){
      const result=window.ChiaplastNative.printHtmlReport(doc,n.title||'Nota Chiaplast');
      if(result!=='ok')toast('No se pudo abrir la impresión del PDF.');
      return;
    }
    const w=window.open('','_blank');
    if(!w){toast('El navegador bloqueó la ventana del PDF. Permite las ventanas emergentes e inténtalo de nuevo.');return}
    w.document.open();w.document.write(doc+'<script>window.onload=function(){setTimeout(function(){window.print()},500)}<\\/script>');w.document.close();
  }catch(e){toast('No se pudo preparar el PDF de esta nota.')}
}

/* ===== Recordatorios locales: comprobados solo mientras el HTML está activo ===== */
const reminderKey=()=>'mtto_reminders';
function loadReminders(){try{const v=JSON.parse(store.get(reminderKey(),'[]'));return Array.isArray(v)?v:[]}catch(e){return[]}}
function saveReminders(items){store.set(reminderKey(),JSON.stringify(items))}
function renderReminders(){
  const list=$('reminderList');if(!list)return;
  const items=loadReminders().sort((a,b)=>(a.due||'').localeCompare(b.due||''));
  if(!items.length){list.innerHTML='<div class="empty">Sin avisos.</div>';return}
  const now=Date.now();
  list.innerHTML=items.map(item=>{
    const done=item.status==='done',due=Date.parse(item.due),state=done?'Completado':item.notified?'Aviso emitido':Number.isFinite(due)&&due<now?'Vencido · pendiente':'Programado';
    const when=Number.isFinite(due)?new Date(due).toLocaleString():(item.date+' · '+item.time);
    return '<article class="reminder-item'+(done?' is-done':'')+'"><div><b>'+esc(item.text)+'</b></div><span class="chip">'+esc(state)+'</span><div class="reminder-meta">'+esc(when)+(item.machine?' · '+esc(item.machine):'')+(item.taskId?' · Vinculado al tablero':'')+'</div><div class="reminder-actions"><button class="btn btn-s" type="button" onclick="editReminder(&quot;'+esc(item.id)+'&quot;)">Editar</button><button class="btn btn-s" type="button" onclick="toggleReminderStatus(&quot;'+esc(item.id)+'&quot;)">'+(done?'Reabrir':'Completar')+'</button><button class="btn btn-s" type="button" onclick="deleteReminder(&quot;'+esc(item.id)+'&quot;)">Eliminar</button></div></article>';
  }).join('');
}
function scheduleNativeReminder(item){
  if(!window.ChiaplastNative||typeof window.ChiaplastNative.scheduleReminder!=='function')return null;
  return window.ChiaplastNative.scheduleReminder(JSON.stringify({id:item.id,title:item.text,machine:item.machine||'',when:item.date+'T'+item.time+':00',status:item.status||'pending'}));
}
function syncNativeReminders(){
  if(!window.ChiaplastNative||typeof window.ChiaplastNative.scheduleReminder!=='function')return;
  loadReminders().forEach(item=>{
    const due=Date.parse(item.due);
    if(item.status!=='done'&&!item.notified&&item.date&&item.time&&Number.isFinite(due)&&due>Date.now()){
      const result=scheduleNativeReminder(item);
      if(result==='permission_required')toast('Autoriza las alarmas exactas en Ajustes para recibir avisos puntuales.');
    }
  });
}
window.syncNativeReminders=syncNativeReminders;
window.openReminderFromNotification=function(id){
  const items=loadReminders(),item=items.find(r=>r.id===id);
  if(item){item.notified=true;saveReminders(items)}
  root('reminders');renderReminders();
  if(item)toast('Aviso de mantenimiento · '+item.text);
};
function addReminder(event){
  if(event&&event.preventDefault)event.preventDefault();
  const text=$('reminderText').value.trim(),date=$('reminderDate').value,time=$('reminderTime').value;
  if(!text||!date||!time){toast('Completa la tarea, la fecha y la hora.');return}
  const due=new Date(date+'T'+time+':00');
  if(Number.isNaN(due.getTime())){toast('La fecha u hora no es válida.');return}
  if(due.getTime()<=Date.now()){toast('Elige una fecha y hora futuras.');return}
  const taskId=$('reminderTaskId').value.trim(),requestedId=$('reminderId').value;
  const items=loadReminders(),previous=items.find(r=>r.id===requestedId||(taskId&&r.taskId===taskId));
  const id=previous?previous.id:Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  const item={id,text,date,time,due:due.toISOString(),machine:$('reminderMachine').value.trim(),taskId:taskId||(previous&&previous.taskId)||'',status:'pending',notified:false,updatedAt:Date.now(),createdAt:previous&&previous.createdAt||Date.now()};
  const index=items.findIndex(r=>r.id===id);if(index>=0)items[index]=item;else items.push(item);
  saveReminders(items);
  if(item.taskId){const tasks=loadKanban(),task=tasks.find(t=>t.id===item.taskId);if(task){task.reminderId=id;if(!task.due)task.due=date;saveKanban(tasks)}}
  let message='Recordatorio guardado en este dispositivo. En navegador, el aviso requiere mantener Chiaplast abierta.';
  if(window.ChiaplastNative){const result=scheduleNativeReminder(item);if(result==='permission_required')message='Guardado. Autoriza las alarmas exactas en Ajustes para recibir el aviso puntual.';else if(result==='error')message='Guardado localmente; Android no pudo programar la notificación.';else message='Recordatorio guardado y programado en Android.'}
  $('reminderId').value='';$('reminderTaskId').value='';$('reminderText').value='';$('reminderMachine').value='';
  renderReminders();renderKanban();renderHomeFollowup();toast(message);
}
function editReminder(id){
  const item=loadReminders().find(r=>r.id===id);if(!item)return;
  const fallback=reminderDefault(),future=Date.parse(item.due)>Date.now();
  $('reminderId').value=item.id;$('reminderTaskId').value=item.taskId||'';$('reminderText').value=item.text;
  $('reminderMachine').value=item.machine||'';$('reminderDate').value=future?item.date:fallback.date;$('reminderTime').value=future?item.time:fallback.time;
  $('remindersCard').scrollIntoView({block:'start',behavior:'smooth'});$('reminderText').focus();
}
function toggleReminderStatus(id){
  const items=loadReminders(),item=items.find(r=>r.id===id);if(!item)return;
  item.status=item.status==='done'?'pending':'done';item.updatedAt=Date.now();
  if(item.status==='pending')item.notified=false;
  saveReminders(items);
  const tasks=loadKanban(),task=tasks.find(t=>t.id===item.taskId||t.reminderId===id);
  if(task){task.status=item.status==='done'?'done':'todo';saveKanban(tasks)}
  if(item.status==='done'&&window.ChiaplastNative&&typeof window.ChiaplastNative.cancelReminder==='function')window.ChiaplastNative.cancelReminder(id);
  else if(item.status!=='done'&&Date.parse(item.due)>Date.now())scheduleNativeReminder(item);
  renderReminders();renderKanban();renderHomeFollowup();
}
function deleteReminder(id){
  const items=loadReminders(),item=items.find(r=>r.id===id);saveReminders(items.filter(r=>r.id!==id));
  if(item&&item.taskId){const tasks=loadKanban(),task=tasks.find(t=>t.id===item.taskId);if(task)delete task.reminderId;saveKanban(tasks)}
  if(window.ChiaplastNative&&typeof window.ChiaplastNative.cancelReminder==='function')window.ChiaplastNative.cancelReminder(id);
  renderReminders();renderKanban();renderHomeFollowup();toast('Recordatorio eliminado.');
}
async function enableReminderNotifications(){
  if(!('Notification' in window)){toast('Este entorno no permite notificaciones del navegador. Los avisos aparecerán dentro de Chiaplast mientras esté abierta.');return}
  try{const permission=await Notification.requestPermission();toast(permission==='granted'?'Notificaciones permitidas mientras el entorno las admita.':'No se concedió permiso. Los avisos aparecerán dentro de Chiaplast mientras esté abierta.')}
  catch(e){toast('No fue posible solicitar permiso de notificaciones en este entorno.')}
}
function checkReminders(){
  if(document.hidden||window.ChiaplastNative)return;
  const now=Date.now(),items=loadReminders();let changed=false;
  items.forEach(item=>{
    const due=Date.parse(item.due);
    if(item.status!=='done'&&!item.notified&&Number.isFinite(due)&&due<=now){
      item.notified=true;changed=true;const msg='Mantenimiento pendiente: '+item.text;
      if('Notification' in window&&Notification.permission==='granted'){try{new Notification('Chiaplast · Recordatorio',{body:msg,tag:'chiaplast-'+item.id})}catch(e){toast(msg)}}else toast(msg);
    }
  });
  if(changed){saveReminders(items);renderReminders();renderHomeFollowup()}
}
setInterval(checkReminders,15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkReminders()});

/* Recientes */
function addRecent(r){const key='mtto_hist';if(Array.isArray(r.rows))r.rows=r.rows.filter(row=>row[2]!==5);let l=getRecent();if(!r.id)r.id=r.folio||('MTTO-'+Date.now());l.unshift(r);store.set(key,JSON.stringify(l.slice(0,500)));AppState.history=l.slice(0,500)}
function getRecent(){try{const v=JSON.parse(store.get('mtto_hist','[]'));return Array.isArray(v)?v:[]}catch(e){return[]}}
function filterReportHistory(){renderRecent()}
function openHistoryReport(id){const r=getRecent().find(x=>x.id===id||x.folio===id);if(!r)return;const rows=Array.isArray(r.rows)?r.rows:[];const preview=rows.map(x=>String(x[0]||'')+': '+String(x[1]||'')).join('\\n');if(window.confirm((r.folio||'Reporte')+'\\n\\n'+(r.a||'')+' · '+(r.w||'')+'\\n\\n'+preview.slice(0,1800)+'\\n\\n¿Deseas compartir los datos de este reporte?')){try{if(navigator.share)navigator.share({title:r.folio||'Reporte Chiaplast',text:preview});else if(navigator.clipboard)navigator.clipboard.writeText(preview).then(()=>toast('Datos del reporte copiados.'));else toast('No se pudo compartir desde este navegador.')}catch(e){toast('No se pudo compartir el reporte.')}}}
function renderHomeFollowup(){
  const reminderBox=$('menuReminderCount'),taskBox=$('widgetKanbanCount'),specialBox=$('specialWorkCount'),boardBox=$('widgetBoardCount');
  const reminders=loadReminders().filter(r=>r.status!=='done').length;
  const tasks=loadKanban(),todo=tasks.filter(t=>(t.status||'todo')==='todo').length,active=tasks.filter(t=>(t.status||'todo')!=='done').length;
  const special=specialAll().filter(x=>x.status!=='done').length;
  if(reminderBox)reminderBox.textContent=reminders+' '+(reminders===1?'recordatorio pendiente':'recordatorios pendientes');
  if(taskBox)taskBox.textContent=todo+' por empezar · '+active+' activas';
  if(specialBox)specialBox.textContent=special+' '+(special===1?'trabajo pendiente':'trabajos pendientes');
  if(boardBox)boardBox.textContent='Ver mes actual';
}
function renderRecent(targetId='recent',searchId='historySearch'){
  const target=$(targetId),search=$(searchId);
  if(!target)return;
  const q=(search&&search.value||'').trim().toLowerCase();
  const l=getRecent().filter(r=>!q||[r.folio,r.id,r.a,r.m,r.w,r.n,r.k].join(' ').toLowerCase().includes(q));
  target.innerHTML=l.length?l.map(r=>{
    const id=esc(r.id||r.folio||'');
    return '<button type="button" class="rec" style="width:100%;text-align:left" data-report-id="'+id+'"><span><b>'+esc(r.folio||r.id||'Reporte anterior')+' · '+esc(r.a||'')+'</b><span>'+esc(r.m||'')+' · '+esc(r.w||'')+' · '+esc(r.n||'')+'</span></span><span>'+(r.k==='daily'?'Diario':'Preventivo')+'</span></button>';
  }).join(''):'<div class="empty">No hay reportes que coincidan con la búsqueda.</div>';
  target.querySelectorAll('[data-report-id]').forEach(btn=>btn.addEventListener('click',()=>openHistoryReport(btn.getAttribute('data-report-id'))));
  const count=$('notesHistoryCount');
  if(targetId==='notesRecent'&&count)count.textContent=l.length+' FOLIOS';
}

/* ===== Trabajos especiales: persistencia local y ciclo pendiente/terminado ===== */
const SPECIAL_KEY='chiaplast_special_works_v1';
let specialPhotoTarget='before',specialPhotos={before:[],after:[]};
function specialAll(){try{const a=JSON.parse(store.get(SPECIAL_KEY,'[]'));return Array.isArray(a)?a:[]}catch(e){return[]}}
function specialPutAll(a){return store.set(SPECIAL_KEY,JSON.stringify(a))}
function specialFormatDate(v){return v?new Date(v).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'}):'—'}
function openSpecialWorks(){specialReset();go('specialWorks');specialRender()}
function specialAreaChanged(){
 const code=$('specialArea').value,db=MACHINE_DB[code],sel=$('specialMachine');
 const machines=db?db.machines:[];
 sel.innerHTML='<option value="">Seleccionar máquina</option>'+machines.map(m=>'<option value="'+esc(m)+'">'+esc(m)+'</option>').join('');
}
function specialCapture(stage){
 if(specialPhotos[stage].length>=5){toast('Máximo 5 fotos por etapa.');return}
 specialPhotoTarget=stage;partsPhotoTarget=stage==='before'?'specialBefore':'specialAfter';
 if(window.ChiaplastNative&&typeof window.ChiaplastNative.takePhoto==='function'){window.ChiaplastNative.takePhoto('special-'+stage);return}
 $('special'+(stage==='before'?'Before':'After')+'Input').click();
}
function specialPick(stage){
 if(specialPhotos[stage].length>=5){toast('Máximo 5 fotos por etapa.');return}
 specialPhotoTarget=stage;partsPhotoTarget=stage==='before'?'specialBefore':'specialAfter';
 if(window.ChiaplastNative&&typeof window.ChiaplastNative.pickPhoto==='function'){window.ChiaplastNative.pickPhoto('special-'+stage);return}
 $('special'+(stage==='before'?'Before':'After')+'Input').click();
}
async function specialFiles(input,stage){
 const files=Array.from(input.files||[]);input.value='';
 for(const f of files){
  if(specialPhotos[stage].length>=5){toast('Máximo 5 fotos por etapa.');break}
  try{specialPhotos[stage].push(await resizeNoteImage(f))}catch(e){toast('No se pudo leer una fotografía.')}
 }
 specialRenderPhotos();
}
function specialRenderPhotos(){
 ['before','after'].forEach(stage=>{
  const id=stage==='before'?'specialBeforePreview':'specialAfterPreview',el=$(id);
  el.innerHTML=specialPhotos[stage].map((src,i)=>'<div class="photo-thumb"><span>Foto '+(i+1)+'</span><button type="button" onclick="specialRemovePhoto(\''+stage+'\','+i+')" aria-label="Quitar foto">×</button></div>').join('');
 });
}
function specialRemovePhoto(stage,i){specialPhotos[stage].splice(i,1);specialRenderPhotos();specialSaveDraftOnly()}
function specialValues(key){return [...document.querySelectorAll('[data-special-key="'+key+'"]')].map(el=>el.value.trim()).filter(Boolean)}
function specialRenderItems(key,values){const box=$('special'+key.charAt(0).toUpperCase()+key.slice(1)+'List');if(!box)return;const list=Array.isArray(values)&&values.length?values:[''];box.innerHTML=list.map((value,i)=>'<div class="special-repeat-row"><textarea data-special-key="'+key+'" rows="2" placeholder="'+({activitiesToDo:'Actividad por hacer',activitiesDone:'Actividad realizada',urgent:'Tarea urgente',parts:'Refacción y cantidad'}[key]||'Detalle')+'">'+esc(value||'')+'</textarea><button class="btn btn-s" type="button" aria-label="Quitar elemento" onclick="specialRemoveItem(\''+key+'\','+i+')">−</button></div>').join('')}
function specialValues(key,keepEmpty=false){const values=[...document.querySelectorAll('[data-special-key="'+key+'"]')].map(el=>el.value.trim());return keepEmpty?values:values.filter(Boolean)}
function specialAddItem(key){const values=specialValues(key,true);values.push('');specialRenderItems(key,values)}
function specialRemoveItem(key,index){const values=specialValues(key,true);values.splice(index,1);specialRenderItems(key,values.length?values:[''])}
function specialReadForm(){
 return {id:$('specialId').value||'TE-'+Date.now().toString(36).toUpperCase(),area:$('specialArea').value,areaName:$('specialArea').selectedOptions[0]?.textContent||'',machine:$('specialMachine').value,activitiesToDo:specialValues('activitiesToDo'),activitiesDone:specialValues('activitiesDone'),urgent:specialValues('urgent'),parts:specialValues('parts'),notes:$('specialNotes').value.trim(),priority:$('specialPriority').value,start:$('specialStart').value,stop:$('specialStop').value,photos:{before:specialPhotos.before.slice(),after:specialPhotos.after.slice()},status:'pending',created:Date.now(),updated:Date.now(),createdBy:currentUser()||'—'} 
}
function specialSaveDraftOnly(){const id=$('specialId').value;if(!id)return;const old=specialAll().find(x=>x.id===id);if(!old)return;const v=specialReadForm();v.id=id;v.created=old.created;v.status=old.status;const all=specialAll(),i=all.findIndex(x=>x.id===id);all[i]=v;specialPutAll(all)}
function specialReset(){
 $('specialId').value='';['specialArea','specialMachine','specialPriority'].forEach(id=>$(id).value='');specialAreaChanged();
 ['specialNotes','specialStart','specialStop'].forEach(id=>$(id).value='');
 ['activitiesToDo','activitiesDone','urgent','parts'].forEach(key=>specialRenderItems(key,['']));
 $('specialPriority').value='normal';specialPhotos={before:[],after:[]};specialRenderPhotos();
 $('specialFormTitle').textContent='Nueva orden especial';$('specialFormStatus').textContent='BORRADOR';
}
function specialLoad(id){
 const j=specialAll().find(x=>x.id===id);if(!j)return;
 $('specialId').value=j.id;$('specialArea').value=j.area;specialAreaChanged();$('specialMachine').value=j.machine||'';
 specialRenderItems('activitiesToDo',Array.isArray(j.activitiesToDo)?j.activitiesToDo:[j.activitiesToDo||'']);specialRenderItems('activitiesDone',Array.isArray(j.activitiesDone)?j.activitiesDone:[j.activitiesDone||'']);specialRenderItems('urgent',Array.isArray(j.urgent)?j.urgent:[j.urgent||'']);specialRenderItems('parts',Array.isArray(j.parts)?j.parts:[j.parts||'']);$('specialNotes').value=j.notes||'';$('specialPriority').value=j.priority||'normal';$('specialStart').value=j.start||'';$('specialStop').value=j.stop||'';
 specialPhotos={before:Array.isArray(j.photos?.before)?j.photos.before.slice():[],after:Array.isArray(j.photos?.after)?j.photos.after.slice():[]};specialRenderPhotos();
 $('specialFormTitle').textContent='Editar orden '+j.id;$('specialFormStatus').textContent=j.status==='done'?'TERMINADA':'PENDIENTE';
}
function specialSavePending(){
 const v=specialReadForm();if(!v.area||!v.machine||!v.activitiesToDo.length){toast('Selecciona área, máquina y agrega al menos una actividad por hacer.');return}
 const all=specialAll(),old=all.find(x=>x.id===v.id);
 if(old){v.created=old.created;v.status=old.status;v.updated=Date.now();all[all.findIndex(x=>x.id===v.id)]=v}
 else{v.status='pending';v.created=Date.now();all.unshift(v)}
 if(!specialPutAll(all)){toast('No se pudo guardar localmente. Reduce las fotos o exporta los datos.');return}
 $('specialId').value=v.id;specialExport('pending',v);specialRender();toast('Trabajo guardado como pendiente.');$('specialFormStatus').textContent='PENDIENTE';$('specialFormTitle').textContent='Orden '+v.id+' · Pendiente';
}
function specialReportRows(j,status){
 const rows=[['FORMATO DE TRABAJO ESPECIAL · '+(status==='done'?'TÉRMINO':'PENDIENTE'),'',3],['Folio',j.id,2],['Estado',status==='done'?'TERMINADO':'PENDIENTE',2],['Prioridad',String(j.priority||'normal').toUpperCase(),2],['Área',j.areaName||j.area,2],['Máquina',j.machine,2],['Fecha de creación',specialFormatDate(j.created),2],['Responsable',j.createdBy||'—',2],['Inicio de trabajo',specialFormatDate(j.start),2]];
 if(status==='done')rows.push(['Término de trabajo',specialFormatDate(j.stop),2]);
 const listText=v=>(Array.isArray(v)?v:v?[v]:[]).filter(Boolean);
 rows.push(['Actividades por hacer','',1],...listText(j.activitiesToDo).map((v,i)=>['Actividad '+(i+1),v]),['Actividades realizadas','',1],...listText(j.activitiesDone).map((v,i)=>['Actividad '+(i+1),v]),['Tareas urgentes','',1],...listText(j.urgent).map((v,i)=>['Tarea urgente '+(i+1),v]),['Refacciones usadas','',1],...listText(j.parts).map((v,i)=>['Refacción '+(i+1),v]),['Observaciones','',1],['Detalle',j.notes||'—'],['Evidencia fotográfica','',1],['Fotos antes',String((j.photos?.before||[]).length)+' fotografía(s). Evidencia almacenada en el dispositivo.'],['Fotos después',String((j.photos?.after||[]).length)+' fotografía(s). Evidencia almacenada en el dispositivo.']);
 (j.photos?.before||[]).forEach((p,i)=>rows.push(['Referencia foto antes '+(i+1),String(p).slice(0,180)]));
 (j.photos?.after||[]).forEach((p,i)=>rows.push(['Referencia foto después '+(i+1),String(p).slice(0,180)]));
 return rows;
}
async function specialExport(status,j){
 j=j||specialAll().find(x=>x.id===$('specialId').value)||specialReadForm();
 const rows=specialReportRows(j,status);
 const clean=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'').toUpperCase();
 const base=clean(j.machine||'MAQUINA')+'-'+clean(j.areaName||j.area||'AREA')+'-'+new Date(j.created||Date.now()).toISOString().slice(0,10).replaceAll('-','')+'-'+(status==='done'?'TERMINO':'PENDIENTE');
 try{const results=await generateExports(rows,base,'both',null);toast('Formato '+(status==='done'?'de término':'de pendiente')+' generado en PDF y Excel.');return results}catch(e){toast(e?.message||'No se pudo exportar el formato.');return []}
}
async function specialComplete(){
 const id=$('specialId').value,all=specialAll(),i=all.findIndex(x=>x.id===id);
 if(i<0){toast('Primero guarda el trabajo como pendiente.');return}
 const j=all[i];j.activitiesDone=specialValues('activitiesDone');j.urgent=specialValues('urgent');j.parts=specialValues('parts');j.notes=$('specialNotes').value.trim();j.start=$('specialStart').value||j.start;j.stop=$('specialStop').value||new Date().toISOString().slice(0,16);j.photos={before:specialPhotos.before.slice(),after:specialPhotos.after.slice()};j.status='done';j.updated=Date.now();
 if(!j.activitiesDone.length&&!window.confirm('No registraste actividades realizadas. ¿Cerrar de todos modos?'))return;
 all[i]=j;if(!specialPutAll(all)){toast('No se pudo guardar el cierre.');return}
 specialRender();$('specialFormStatus').textContent='TERMINADA';await specialExport('done',j);toast('Trabajo cerrado y guardado en el historial.');
}
function specialRender(){
 const all=specialAll(),pending=all.filter(x=>x.status!=='done');
 $('specialWorkCount').textContent=pending.length+' pendiente(s)';$('specialListCount').textContent=all.length+' órdenes · '+pending.length+' pendientes';
 $('specialList').innerHTML=all.length?all.map(j=>'<article class="calendar-item '+(j.status==='done'?'is-done':'')+(j.priority==='urgente'||j.priority==='alta'?' is-overdue':'')+'"><b>'+esc(j.id)+' · '+esc(j.areaName||j.area)+' · '+esc(j.machine)+' '+((j.priority==='urgente'||j.priority==='alta')?'· PRIORIDAD '+esc(j.priority.toUpperCase()):'')+'</b><div class="calendar-meta">'+(j.status==='done'?'TERMINADO':'PENDIENTE')+' · Creado '+esc(specialFormatDate(j.created))+' · Fotos '+((j.photos?.before||[]).length)+' antes / '+((j.photos?.after||[]).length)+' después</div><div class="calendar-detail">'+esc((j.activitiesToDo||'').slice(0,240))+'</div><div class="reminder-actions"><button class="btn btn-s" onclick="specialLoad(\''+j.id+'\')">Retomar / editar</button><button class="btn btn-s" onclick="specialExport(\''+(j.status==='done'?'done':'pending')+'\',specialAll().find(x=>x.id===\''+j.id+'\'))">Formato '+(j.status==='done'?'término':'pendiente')+'</button><button class="btn btn-s" onclick="specialDelete(\''+j.id+'\')">Eliminar</button></div></article>').join(''):'<div class="empty">Aún no hay trabajos especiales. Crea una orden para comenzar.</div>';
}
function specialDelete(id){if(!window.confirm('¿Eliminar definitivamente este trabajo especial?'))return;specialPutAll(specialAll().filter(x=>x.id!==id));if($('specialId').value===id)specialReset();specialRender()}

/* Inicio: splash visible y restauración de sesión coherente */
syncAppState();
setTimeout(()=>{
  syncAppState();
  root(AppState.session?'menu':'login');
  purgeExpiredNotes().catch(()=>{});
},1500);
setInterval(()=>{if(!document.hidden)purgeExpiredNotes().catch(()=>{})},60*60*1000);

