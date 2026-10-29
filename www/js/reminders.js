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
  if(!Bridge.has('scheduleReminder'))return null;
  return Bridge.scheduleReminder(JSON.stringify({id:item.id,title:item.text,machine:item.machine||'',when:item.date+'T'+item.time+':00',status:item.status||'pending'}));
}
function syncNativeReminders(){
  if(!Bridge.has('scheduleReminder'))return;
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
  if(Bridge.available){const result=scheduleNativeReminder(item);if(result==='permission_required')message='Guardado. Autoriza las alarmas exactas en Ajustes para recibir el aviso puntual.';else if(result==='error')message='Guardado localmente; Android no pudo programar la notificación.';else message='Recordatorio guardado y programado en Android.'}
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
  if(item.status==='done'&&Bridge.has('cancelReminder'))Bridge.cancelReminder(id);
  else if(item.status!=='done'&&Date.parse(item.due)>Date.now())scheduleNativeReminder(item);
  renderReminders();renderKanban();renderHomeFollowup();
}
function deleteReminder(id){
  const items=loadReminders(),item=items.find(r=>r.id===id);saveReminders(items.filter(r=>r.id!==id));
  if(item&&item.taskId){const tasks=loadKanban(),task=tasks.find(t=>t.id===item.taskId);if(task)delete task.reminderId;saveKanban(tasks)}
  if(Bridge.has('cancelReminder'))Bridge.cancelReminder(id);
  renderReminders();renderKanban();renderHomeFollowup();toast('Recordatorio eliminado.');
}
async function enableReminderNotifications(){
  if(!('Notification' in window)){toast('Este entorno no permite notificaciones del navegador. Los avisos aparecerán dentro de Chiaplast mientras esté abierta.');return}
  try{const permission=await Notification.requestPermission();toast(permission==='granted'?'Notificaciones permitidas mientras el entorno las admita.':'No se concedió permiso. Los avisos aparecerán dentro de Chiaplast mientras esté abierta.')}
  catch(e){toast('No fue posible solicitar permiso de notificaciones en este entorno.')}
}
function checkReminders(){
  if(document.hidden||Bridge.available)return;
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
