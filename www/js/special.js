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
 if(Bridge.has('takePhoto')){Bridge.takePhoto('special-'+stage);return}
 $('special'+(stage==='before'?'Before':'After')+'Input').click();
}
function specialPick(stage){
 if(specialPhotos[stage].length>=5){toast('Máximo 5 fotos por etapa.');return}
 specialPhotoTarget=stage;partsPhotoTarget=stage==='before'?'specialBefore':'specialAfter';
 if(Bridge.has('pickPhoto')){Bridge.pickPhoto('special-'+stage);return}
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
