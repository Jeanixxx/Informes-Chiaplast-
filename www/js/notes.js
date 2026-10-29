/* ===== Notas técnicas con fotografías y caducidad de 30 días ===== */
const NOTES_DB=()=> KEYS.idb.notes,NOTES_STORE='notes';
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
  try{if(Bridge.has('deleteEvidence'))(note.photos||[]).forEach(src=>{if(typeof src==='string'&&src.includes('/evidence/'))Bridge.deleteEvidence(src)})}catch(e){}
}
function captureNotePhoto(){
  if(notePhotosDraft.length>=5){toast('Se admiten hasta 5 fotografías por nota.');return}
  partsPhotoTarget='note';
  if(Bridge.has('takePhoto')){Bridge.takePhoto('note');return}
  $('notePhotos').click();
}
function pickNotePhoto(){
  if(notePhotosDraft.length>=5){toast('Se admiten hasta 5 fotografías por nota.');return}
  partsPhotoTarget='note';
  if(Bridge.has('pickPhoto')){Bridge.pickPhoto('note');return}
  $('notePhotos').removeAttribute('capture');$('notePhotos').click();
}
window.onEvidenceCaptured=function(raw){
  try{
    const data=typeof raw==='string'?JSON.parse(raw):raw;
    if(!data||!data.uri)return;
    if(partsPhotoTarget==='specialBefore'||partsPhotoTarget==='specialAfter'){
      const stage=partsPhotoTarget==='specialBefore'?'before':'after';
      if(specialPhotos[stage].length>=5){if(Bridge.has('deleteEvidence'))Bridge.deleteEvidence(data.uri);toast('Máximo 5 fotos por etapa.');return}
      specialPhotos[stage].push(data.uri);specialRenderPhotos();specialSaveDraftOnly();toast('Evidencia del trabajo especial agregada.');return;
    }
    if(partsPhotoTarget==='pmBefore'||partsPhotoTarget==='pmAfter'){
      const stage=partsPhotoTarget==='pmBefore'?'before':'after';
      if(preventivePhotos[stage].length>=5){if(Bridge.has('deleteEvidence'))Bridge.deleteEvidence(data.uri);toast('Máximo 5 fotos por etapa.');return}
      preventivePhotos[stage].push(data.uri);renderPreventivePhotos();savePreventivePhotos().then(()=>toast('Fotografía preventiva guardada.')).catch(()=>toast('No se pudo guardar la fotografía.'));return;
    }
    if(partsPhotoTarget==='parts'){
      if(partsPhotosDraft.length>=5){if(Bridge.has('deleteEvidence'))Bridge.deleteEvidence(data.uri);toast('Se admiten hasta 5 fotografías de refacciones.');return}
      partsPhotosDraft.push(data.uri);renderPartsPhotos();savePartsPhotos().then(()=>toast('Fotografía de refacción guardada.')).catch(()=>toast('La fotografía no se pudo guardar localmente.'));
      return;
    }
    if(notePhotosDraft.length>=5){if(Bridge.has('deleteEvidence'))Bridge.deleteEvidence(data.uri);toast('Se admiten hasta 5 fotografías por nota.');return}
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
    if(Bridge.has('printHtmlReport')){
      const result=Bridge.printHtmlReport(doc,n.title||'Nota Chiaplast');
      if(result!=='ok')toast('No se pudo abrir la impresión del PDF.');
      return;
    }
    const w=window.open('','_blank');
    if(!w){toast('El navegador bloqueó la ventana del PDF. Permite las ventanas emergentes e inténtalo de nuevo.');return}
    w.document.open();w.document.write(doc+'<script>window.onload=function(){setTimeout(function(){window.print()},500)}<\\/script>');w.document.close();
  }catch(e){toast('No se pudo preparar el PDF de esta nota.')}
}
