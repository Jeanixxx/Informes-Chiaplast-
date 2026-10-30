async function loadPreventivePhotos(){try{const db=await openPartsPhotosDB(),key=preventivePhotoKey();const saved=await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readonly'),req=tx.objectStore('photos').get(key);req.onsuccess=()=>resolve(req.result&&req.result.photos?req.result.photos:{before:[],after:[]});req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close()});preventivePhotos={before:(saved.before||[]).slice(0,5),after:(saved.after||[]).slice(0,5)};renderPreventivePhotos()}catch(e){preventivePhotos={before:[],after:[]};renderPreventivePhotos();toast('No se pudieron cargar las fotos del preventivo.')}}
async function savePreventivePhotos(){const db=await openPartsPhotosDB(),key=preventivePhotoKey(),record={key,photos:{before:preventivePhotos.before.slice(0,5),after:preventivePhotos.after.slice(0,5)},updated:Date.now()};return new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put(record);tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>{db.close();reject(tx.error||new Error('No se pudo guardar la evidencia.'))};tx.onabort=()=>{db.close();reject(tx.error||new Error('Se canceló el guardado.'))}})}
function renderPreventivePhotos(){['before','after'].forEach(stage=>{const box=$(stage==='before'?'pmBeforePreview':'pmAfterPreview');if(!box)return;box.innerHTML=preventivePhotos[stage].map((src,i)=>'<figure><img src="'+esc(src)+'" alt="Foto '+(stage==='before'?'antes':'después')+' '+(i+1)+'"><button type="button" aria-label="Quitar fotografía" onclick="removePreventivePhoto(\''+stage+'\','+i+')">×</button></figure>').join('')})}
function capturePreventivePhoto(stage){if(preventivePhotos[stage].length>=5){toast('Máximo 5 fotos por etapa.');return}partsPhotoTarget=stage==='before'?'pmBefore':'pmAfter';if(Bridge.has('takePhoto')){Bridge.takePhoto('preventive-'+stage);return}$('pm'+(stage==='before'?'Before':'After')+'Input').click()}
function pickPreventivePhoto(stage){if(preventivePhotos[stage].length>=5){toast('Máximo 5 fotos por etapa.');return}partsPhotoTarget=stage==='before'?'pmBefore':'pmAfter';if(Bridge.has('pickPhoto')){Bridge.pickPhoto('preventive-'+stage);return}$('pm'+(stage==='before'?'Before':'After')+'Input').click()}
async function previewPreventivePhotos(input,stage){const files=Array.from(input.files||[]);input.value='';for(const file of files){if(preventivePhotos[stage].length>=5){toast('Máximo 5 fotos por etapa.');break}if(file.type.startsWith('image/')){try{preventivePhotos[stage].push(await resizeNoteImage(file))}catch(e){toast('No se pudo preparar una foto.')}}}renderPreventivePhotos();try{await savePreventivePhotos()}catch(e){toast('No se pudo guardar la evidencia.')}}
async function removePreventivePhoto(stage,index){const src=preventivePhotos[stage][index];preventivePhotos[stage].splice(index,1);if(typeof src==='string'&&src.includes('/evidence/')&&Bridge.has('deleteEvidence'))Bridge.deleteEvidence(src);renderPreventivePhotos();try{await savePreventivePhotos()}catch(e){toast('No se pudo actualizar la evidencia.')}}

/* Recepción de cámara/selector nativo Android. MainActivity devuelve un JSON con la URI local. */
window.onEvidenceCaptured=async function(raw){
  try{
    const item=typeof raw==='string'?JSON.parse(raw):raw;
    if(!item||(!item.uri&&!item.dataUrl))throw new Error('Android no devolvió la fotografía.');
    const response=await fetch(item.dataUrl||item.uri);
    if(!response.ok)throw new Error('No se pudo leer la fotografía seleccionada.');
    const photo=await resizeNoteImage(await response.blob());
    if(partsPhotoTarget==='pmBefore'||partsPhotoTarget==='pmAfter'){
      const stage=partsPhotoTarget==='pmBefore'?'before':'after';
      if(preventivePhotos[stage].length>=5){toast('Máximo 5 fotos por etapa.');return}
      preventivePhotos[stage].push(photo);
      renderPreventivePhotos();
      await savePreventivePhotos();
      if(item.uri&&Bridge.has('deleteEvidence'))Bridge.deleteEvidence(item.uri);
      toast('Fotografía agregada al preventivo.');
      return;
    }
    if(partsPhotoTarget==='parts'){
      if(partsPhotosDraft.length>=5){toast('Se admiten hasta 5 fotografías de refacciones.');return}
      partsPhotosDraft.push(photo);renderPartsPhotos();await savePartsPhotos();
      if(item.uri&&Bridge.has('deleteEvidence'))Bridge.deleteEvidence(item.uri);
      toast('Fotografía de refacción agregada.');
      return;
    }
    if(item.uri&&Bridge.has('deleteEvidence'))Bridge.deleteEvidence(item.uri);
  }catch(e){toast(e&&e.message?e.message:'No se pudo agregar la fotografía.')}
};

/* Refacciones y fotografías: almacenamiento local independiente por máquina */
const partsStorageKey=()=>KEYS.parts(Runtime.code,Runtime.machine||Runtime.area);
let preventivePhotos={before:[],after:[]};
const preventivePhotoKey=()=>KEYS.pmEvidence(Runtime.code,Runtime.machine||Runtime.area);
const partsPhotosKey=()=>KEYS.partsPhotos(Runtime.code,Runtime.machine||Runtime.area);
let partsPhotosDraft=[];
let partsPhotoTarget='parts';
function openPartsPhotosDB(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){reject(new Error('Este dispositivo no permite guardar fotografías localmente.'));return}
    const req=indexedDB.open(KEYS.idb.partsPhotos,1);
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
async function deletePreventiveEvidenceForMachine(code,machine){
  const keys=[KEYS.pmEvidence(code,machine),KEYS.partsPhotos(code,machine)];
  const db=await openPartsPhotosDB();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction('photos','readwrite'),os=tx.objectStore('photos');
    keys.forEach(key=>{
      const req=os.get(key);
      req.onsuccess=()=>{
        const record=req.result;
        if(record&&Array.isArray(record.photos))record.photos.forEach(src=>{if(typeof src==='string'&&src.includes('/evidence/')&&Bridge.has('deleteEvidence'))Bridge.deleteEvidence(src)});
        if(record&&record.photos&&record.photos.before)Object.values(record.photos).flat().forEach(src=>{if(typeof src==='string'&&src.includes('/evidence/')&&Bridge.has('deleteEvidence'))Bridge.deleteEvidence(src)});
        os.delete(key);
      };
      req.onerror=()=>reject(req.error);
    });
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
  db.close();
}
async function savePartsPhotos(){
  const db=await openPartsPhotosDB(),record={key:partsPhotosKey(),photos:partsPhotosDraft.slice(0,5),updated:Date.now()};
  return new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put(record);tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>{db.close();reject(tx.error||new Error('No se pudieron guardar las fotografías.'))};tx.onabort=()=>{db.close();reject(tx.error||new Error('Se canceló el guardado de fotografías.'))}});
}
function capturePartsPhoto(){
  if(partsPhotosDraft.length>=5){toast('Se admiten hasta 5 fotografías de refacciones.');return}
  partsPhotoTarget='parts';
  if(Bridge.has('takePhoto')){Bridge.takePhoto('parts');return}
  $('partsPhotosInput').click();
}
function pickPartsPhoto(){
  if(partsPhotosDraft.length>=5){toast('Se admiten hasta 5 fotografías de refacciones.');return}
  partsPhotoTarget='parts';
  if(Bridge.has('pickPhoto')){Bridge.pickPhoto('parts');return}
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
  if(typeof src==='string'&&src.includes('/evidence/')&&Bridge.has('deleteEvidence'))Bridge.deleteEvidence(src);
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
/* ===== Calendario local de órdenes preventivas ===== */
const preventiveCalendarKey=()=>KEYS.preventiveCalendar;
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
const PM_PREFIX=KEYS.pmBoardPrefix;
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
