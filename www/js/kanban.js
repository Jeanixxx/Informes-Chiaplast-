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
