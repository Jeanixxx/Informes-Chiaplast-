const HELP={"menu": "Chequeo diario: elige una máquina, captura y termina; luego otra máquina o termina para generar un solo documento. Los datos se guardan en este dispositivo.", "dailyArea": "Elige el área y la máquina. Puedes agregar tantas máquinas como quieras en un solo reporte.", "dailyMachine": "Toca una máquina para capturarla. ✓ indica que ya está en el reporte. Si no aparece, usa \"Otra máquina\".", "dailyBatch": "Aquí ves las máquinas del reporte. Agrega otra, edita o elimina. \"Terminar y guardar\" crea un solo documento y lo guarda en Descargas/Chiaplast.", "form": "Completa los campos en rojo y continúa.", "notes": "Las notas y fotos se conservan 30 días y luego se eliminan. Genera el PDF si necesitas conservarlas.", "reminders": "Los avisos se programan en Android por máquina, fecha y hora.", "kanban": "Organiza tareas de mantenimiento por estado.", "preventiveBoard": "Toca una máquina para marcar su preventivo del mes con la fecha elegida. Se guarda solo en este dispositivo; cambia de mes con las flechas y exporta el CSV si quieres un respaldo."};
function showHelp(){const a=document.querySelector('.screen.active');$('helpText').textContent=HELP[a&&a.id]||HELP.menu;$('helpModal').hidden=false}
document.querySelectorAll('.screen:not(.splash):not(.login) .bar').forEach(b=>{const h=document.createElement('button');h.className='iconbtn';h.style.cssText='width:38px;height:38px;font-size:17px;margin-left:auto';h.textContent='?';h.setAttribute('aria-label','Ayuda');h.onclick=showHelp;b.appendChild(h)});
const AppState={session:false,user:'',settings:{},history:[]};
const Runtime={area:'',code:'',checkType:'preventive',workflow:'preventive',rows:[],machine:'',batchMode:false};
const LastExports=[];
function showDone(results,title){
  $('rFile').textContent=results.map(r=>r.name).join(' · ');
  $('rTitle').textContent=title;
  const saved=results.some(r=>r.mode==='android-saved');
  $('rMsg').textContent=saved?'Guardado en Descargas/Chiaplast':'Descargado en el dispositivo';
  $('shareBtns').innerHTML=LastExports.map((f,k)=>'<button class="btn btn-s" style="flex:none;width:100%;margin-bottom:8px" onclick="shareLast('+k+')">Compartir '+esc(f.name.split('.').pop().toUpperCase())+'</button>').join('');
}
function shareLast(k){const f=LastExports[k];if(f&&Bridge.available)Bridge.shareReport(f.name,f.mime,f.b64)}
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
  if(id==='tools')renderSavedPreventiveDrafts();
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
    $('browserNotificationBtn').hidden=!!(Bridge.available);
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

function setNow(){const n=new Date();$('d').value=n.getFullYear()+'-'+pad(n.getMonth()+1)+'-'+pad(n.getDate());$('t').value=pad(n.getHours())+':'+pad(n.getMinutes());$('d').classList.remove('bad');$('t').classList.remove('bad')}

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
  $('sigCard').hidden=kind==='daily';sigClear();try{const saved=JSON.parse(store.get('mtto_signature_names','{}'));$('ccmName').value=saved.ccm||'';$('respSigName').value=saved.responsable||'';Signatures.ccm.name=saved.ccm||'';Signatures.responsable.name=saved.responsable||''}catch(e){}
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
    if(!Signatures.ccm.name){$('ccmName').classList.add('bad');bad=bad||$('ccmName')}
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
function finish(){
  sigClear();
  $('obs').value='';extLoad({});['gType','gStatus'].forEach(g=>{const x=$(g);x.dataset.v='';x.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'))});
  Runtime.batchMode=false;Runtime.machine='';DailyBatch.active=false;
  history.replaceState({s:'menu'},'');show('menu');
}

/* Borrador: si la app se cierra no se pierde lo escrito */
function draftIndex(){try{return JSON.parse(store.get('mtto_preventive_drafts','[]'))}catch(e){return[]}}
function saveDraft(){
 const key=draftStorageKey(),record={key,c:Runtime.code,k:Runtime.checkType,area:Runtime.area,machine:Runtime.machine||'',updated:Date.now(),d:$('d').value,h:$('t').value,t:$('gType').dataset.v,s:$('gStatus').dataset.v,o:$('obs').value,x:extState(),pmStartDate:$('pmStartDate').value,pmStartTime:$('pmStartTime').value,pmStopDate:$('pmStopDate').value,pmStopTime:$('pmStopTime').value,motorHz:$('motorHz').value,ccmApproval:$('ccmApproval').value,ccmName:$('ccmName').value,pmObservations:$('pmObservations').value,respSigner:$('respSigName').value.trim(),ccmSig:Signatures.ccm.hex,respSig:Signatures.responsable.hex};
 store.set(key,JSON.stringify(record));
 if(!isDaily()){const all=draftIndex().filter(x=>x.key!==key);all.unshift({key,area:Runtime.area,code:Runtime.code,machine:Runtime.machine||Runtime.area,updated:record.updated});store.set('mtto_preventive_drafts',JSON.stringify(all.slice(0,50)))}
}
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
  if(ok&&!isDaily()){
    $('respSigName').value=dr.respSigner||$('respSigName').value||'';
    Signatures.ccm.name=$('ccmName').value.trim();Signatures.responsable.name=$('respSigName').value.trim();
    restoreSignature('ccm',dr.ccmSig||'');restoreSignature('responsable',dr.respSig||'');
  }
}
function closeFormToTools(){saveDraft();renderSavedPreventiveDrafts();go('tools');toast('Borrador guardado. Puede continuar después desde Herramientas de MTTO.')}
function renderSavedPreventiveDrafts(){
 const box=$('savedPreventiveDrafts');if(!box)return;
 const items=draftIndex().filter(x=>store.get(x.key,''));
 box.innerHTML=items.length?items.map(x=>'<button class="dashboard-area" type="button" onclick="resumePreventiveDraft(&quot;'+esc(x.key)+'&quot;)"><b><i>↻</i><em>'+esc(new Date(x.updated).toLocaleString('es-MX'))+'</em></b><strong>'+esc(x.machine||x.area)+'</strong><small>'+esc(x.area)+' · '+esc(x.code)+'</small><span>Continuar llenando →</span></button>').join(''):'<div class="empty">No hay mantenimientos preventivos guardados como borrador.</div>';
}
function resumePreventiveDraft(key){
 let dr=null;try{dr=JSON.parse(store.get(key,'null'))}catch(e){}
 if(!dr||!dr.code){toast('No se encontró el borrador.');renderSavedPreventiveDrafts();return}
 Runtime.area=dr.area||dr.code;Runtime.code=dr.code;Runtime.machine=dr.machine||'';Runtime.batchMode=false;startCheck('preventive');
}
function restoreSignature(who,hex){
 const item=Signatures[who],canvas=$(who==='ccm'?'ccmSigPad':'respSigPad');signatureClear(who);
 if(!hex)return;const ctx=canvas.getContext('2d'),img=ctx.createImageData(300,100);
 for(let i=0;i<300*100;i++){const v=parseInt(hex.slice(i*2,i*2+2),16)||255,j=i*4;img.data[j]=img.data[j+1]=img.data[j+2]=v;img.data[j+3]=255}
 const tmp=document.createElement('canvas');tmp.width=300;tmp.height=100;tmp.getContext('2d').putImageData(img,0,0);ctx.drawImage(tmp,0,0,canvas.width,canvas.height);item.hex=hex;item.w=300;item.h=100;
}


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

/* Inicio: splash visible y restauración de sesión coherente */
syncAppState();
setTimeout(()=>{
  syncAppState();
  root(AppState.session?'menu':'login');
  purgeExpiredNotes().catch(()=>{});
},1500);
setInterval(()=>{if(!document.hidden)purgeExpiredNotes().catch(()=>{})},60*60*1000);


