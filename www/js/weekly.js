/* ===== Calendario semanal de mantenimiento =====
   Semana de lunes a domingo. Las máquinas salen de MACHINE_DB (una tarjeta por entrada) y se asignan
   a un día arrastrando (Pointer Events: mouse, tacto y lápiz) o tocando la tarjeta y luego «+ Agregar aquí».
   Las tarjetas ya puestas en un día se mueven a otro día de la misma semana igual: arrastrando o con
   toque + «Mover aquí». Un solo estado (Weekly) y un solo render: el CSS decide la distribución.
   Guardado: { 'AAAA-MM-DD': [{code, name}] } en KEYS.weeklyCalendar. La identidad es área + nombre. */
const WK_MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const WK_MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const WK_DIA=['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
const WK_DIA_LARGO=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
/* sel = tarjeta del panel seleccionada; move = tarjeta de un día seleccionada {day,code,name}; solo una a la vez.
   undo = {prev, msg}: estado anterior a la última acción de mover o quitar. */
const Weekly={monday:null,area:'CAM',sel:null,move:null,undo:null,undoT:0,pdfOpen:false,pdfScope:'week',data:null,pdfReady:false,sheetOpen:false};

const wkKey=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const wkAddDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const wkMondayOf=d=>wkAddDays(new Date(d.getFullYear(),d.getMonth(),d.getDate()),-((d.getDay()+6)%7));
const wkSame=(a,b)=>!!a&&!!b&&a.code===b.code&&a.name===b.name;
const wkLabel=code=>MACHINE_DB[code]?MACHINE_DB[code].label:String(code||'');
const wkIcon=d=>'<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="'+d+'"></path></svg>';

function wkLoad(){
  const out={};
  try{
    const v=JSON.parse(store.get(KEYS.weeklyCalendar,'{}'));
    if(v&&typeof v==='object'&&!Array.isArray(v))Object.keys(v).forEach(day=>{
      if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Array.isArray(v[day]))return;
      const list=[];
      v[day].forEach(m=>{if(m&&typeof m.code==='string'&&typeof m.name==='string'&&!list.some(x=>wkSame(x,m)))list.push({code:m.code,name:m.name})});
      if(list.length)out[day]=list;
    });
  }catch(e){}
  return out;
}
function wkData(){if(!Weekly.data)Weekly.data=wkLoad();return Weekly.data}
function wkSave(){
  let ok=false;
  try{ok=store.set(KEYS.weeklyCalendar,JSON.stringify(wkData()))}catch(e){ok=false}
  if(!ok)toast('No se pudo guardar el calendario en este dispositivo.');
  return ok;
}
function wkAdd(day,m){
  const data=wkData(),list=data[day]||[];
  if(list.some(x=>wkSame(x,m))){Weekly.sel=null;renderWeekly();toast(m.name+' ya está programada ese día.');return false}
  data[day]=list.concat([{code:m.code,name:m.name}]);
  Weekly.sel=null;wkSave();buzz(10);renderWeekly();return true;
}
const wkClone=d=>JSON.parse(JSON.stringify(d));
const wkKeyDate=k=>{const [y,mo,d]=k.split('-').map(Number);return new Date(y,mo-1,d)};
const wkDayName=k=>{const d=wkKeyDate(k);return WK_DIA_LARGO[d.getDay()]+' '+d.getDate()};
const wkDayShort=k=>{const d=wkKeyDate(k);return WK_DIA[d.getDay()].toLowerCase()+' '+d.getDate()};
/* Una sola escritura: si falla, la memoria se queda como estaba (todo o nada). */
function wkCommit(next){
  let ok=false;
  try{ok=store.set(KEYS.weeklyCalendar,JSON.stringify(next))}catch(e){ok=false}
  if(!ok){toast('No se pudo guardar el calendario en este dispositivo.');return false}
  Weekly.data=next;return true;
}
function wkRemove(day,m){
  const data=wkData(),prev=wkClone(data),next=wkClone(data),list=(next[day]||[]).filter(x=>!wkSame(x,m));
  if(list.length)next[day]=list;else delete next[day];
  if(wkSame(Weekly.move,m)&&Weekly.move.day===day)Weekly.move=null;
  if(wkCommit(next))wkOfferUndo(prev,m.name+' quitada del '+wkDayName(day));
  renderWeekly();
}
/* Mover = quitar del origen y agregar al final del destino, en una sola escritura. */
function wkMove(from,to,m){
  Weekly.move=null;
  const data=wkData();
  if(from===to||!(data[from]||[]).some(x=>wkSame(x,m))){renderWeekly();return false}
  if((data[to]||[]).some(x=>wkSame(x,m))){renderWeekly();toast(m.name+' ya está programada el '+wkDayName(to));return false}
  const prev=wkClone(data),next=wkClone(data),left=next[from].filter(x=>!wkSame(x,m));
  if(left.length)next[from]=left;else delete next[from];
  next[to]=(next[to]||[]).concat([{code:m.code,name:m.name}]);
  const ok=wkCommit(next);
  if(ok)wkOfferUndo(prev,m.name+' movida al '+wkDayName(to));
  renderWeekly();return ok;
}
/* Aviso «Deshacer» de 5 s; una acción nueva reemplaza al anterior (solo se deshace la última). */
function wkOfferUndo(prev,msg){
  clearTimeout(Weekly.undoT);
  Weekly.undo={prev,msg};
  Weekly.undoT=setTimeout(()=>{Weekly.undo=null;const u=document.querySelector('#wkRoot .wk-undo');if(u)u.remove();const w=document.querySelector('#wkRoot .wk');if(w)w.classList.remove('has-undo')},5000);
}
function wkUndo(){
  const u=Weekly.undo;if(!u)return;
  clearTimeout(Weekly.undoT);Weekly.undo=null;Weekly.move=null;Weekly.sel=null;
  if(wkCommit(u.prev))toast('Cambio deshecho.');
  renderWeekly();
}
function wkWeekInfo(mon){
  const sun=wkAddDays(mon,6),mm=m=>WK_MESES[m].toLowerCase();
  let range;
  if(mon.getFullYear()!==sun.getFullYear())range='Lunes '+mon.getDate()+' de '+mm(mon.getMonth())+' de '+mon.getFullYear()+' al domingo '+sun.getDate()+' de '+mm(sun.getMonth())+' de '+sun.getFullYear();
  else if(mon.getMonth()!==sun.getMonth())range='Lunes '+mon.getDate()+' de '+mm(mon.getMonth())+' al domingo '+sun.getDate()+' de '+mm(sun.getMonth())+' de '+sun.getFullYear();
  else range='Lunes '+mon.getDate()+' al domingo '+sun.getDate()+' de '+mm(mon.getMonth())+' de '+sun.getFullYear();
  return {weekNum:Math.ceil(mon.getDate()/7),month:WK_MESES[mon.getMonth()],range};
}
/* Semanas del mes: se cuentan por su lunes, igual que el título. */
function wkMonthMondays(mon){
  const out=[];
  for(let d=new Date(mon.getFullYear(),mon.getMonth(),1);d.getMonth()===mon.getMonth();d=wkAddDays(d,1))if(d.getDay()===1)out.push(d);
  return out;
}

function openWeeklyCalendar(){go('weeklyCalendar')}
function wkShift(n){Weekly.monday=wkAddDays(Weekly.monday,7*n);Weekly.pdfReady=false;Weekly.move=null;renderWeekly()}
function wkGoToday(){Weekly.monday=wkMondayOf(new Date());Weekly.pdfReady=false;Weekly.move=null;renderWeekly()}

function renderWeekly(){
  const root=$('wkRoot');if(!root)return;
  wkUpdateMode();
  if(!Weekly.monday)Weekly.monday=wkMondayOf(new Date());
  if(!MACHINE_DB[Weekly.area])Weekly.area=Object.keys(MACHINE_DB)[0];
  const data=wkData(),mon=Weekly.monday,info=wkWeekInfo(mon),todayKey=wkKey(new Date());
  /* Una selección de día que ya no existe (otra semana, quitada, deshecha) se descarta. */
  if(Weekly.move&&!(data[Weekly.move.day]||[]).some(x=>wkSame(x,Weekly.move)))Weekly.move=null;
  const sel=Weekly.sel,mv=Weekly.move;
  const area=MACHINE_DB[Weekly.area];

  /* Conservar foco y desplazamientos al volver a dibujar */
  const act=document.activeElement,focusSel=act&&root.contains(act)&&act.dataset.wk?'[data-wk="'+act.dataset.wk+'"]'+['day','code','name','scope'].map(k=>act.dataset[k]!=null?'[data-'+k+'="'+CSS.escape(act.dataset[k])+'"]':'').join(''):'';
  const tilesEl=root.querySelector('.wk-tiles'),tilesScroll=tilesEl?[tilesEl.scrollLeft,tilesEl.scrollTop]:null;
  const itemScroll={};root.querySelectorAll('.wk-day').forEach(d=>{const l=d.querySelector('.wk-items');if(l)itemScroll[d.dataset.day]=l.scrollTop});

  const days=[],weekKeys=[];
  for(let i=0;i<7;i++){const d=wkAddDays(mon,i);days.push(d);weekKeys.push(wkKey(d))}
  if(mv&&weekKeys.indexOf(mv.day)<0)Weekly.move=null;
  const move=Weekly.move;
  const maxCount=Math.max(0,...weekKeys.map(k=>(data[k]||[]).length));
  const slots=Math.min(6,Math.max(4,maxCount+1));
  const countInWeek={};
  weekKeys.forEach(k=>(data[k]||[]).forEach(m=>{const id=m.code+'|'+m.name;countInWeek[id]=(countInWeek[id]||0)+1}));

  const dayHtml=days.map((d,i)=>{
    const key=weekKeys[i],list=data[key]||[],isToday=key===todayKey;
    const longName=WK_DIA_LARGO[d.getDay()]+' '+d.getDate()+' de '+WK_MESES[d.getMonth()].toLowerCase();
    const dayName=WK_DIA_LARGO[d.getDay()]+' '+d.getDate();
    const action=sel?'<button type="button" class="wk-place" data-wk="place" data-day="'+key+'">+ Agregar aquí</button>'
      :move?(move.day===key?'<button type="button" class="wk-place wk-place-cancel" data-wk="move-cancel" data-day="'+key+'">Cancelar</button>'
        :'<button type="button" class="wk-place" data-wk="move-here" data-day="'+key+'">Mover aquí</button>'):'';
    /* Tarjeta = <div> con dos botones hermanos: el grande (seleccionar / arrastrar para mover) y ✕. */
    const card=m=>{const picked=!!move&&move.day===key&&wkSame(move,m),attrs=' data-day="'+key+'" data-code="'+esc(m.code)+'" data-name="'+esc(m.name)+'"';
      return '<div class="wk-item'+(picked?' is-picked':'')+'" role="listitem">'
        +'<button type="button" class="wk-item-main" data-wk="item"'+attrs+' aria-pressed="'+picked+'" aria-label="'+esc('Mover '+m.name+', '+dayName)+'"><span class="wk-item-area">'+esc(wkLabel(m.code))+'</span><span class="wk-item-name">'+esc(m.name)+'</span></button>'
        +'<button type="button" class="wk-remove" data-wk="remove"'+attrs+' aria-label="'+esc('Quitar '+m.name+' ('+wkLabel(m.code)+') del '+dayName)+'">'+wkIcon('M18 6 6 18M6 6l12 12')+'</button></div>'};
    return '<section class="wk-day'+(isToday?' is-today':'')+(move&&move.day===key?' is-origin':'')+'" data-day="'+key+'" data-wk-day="'+key+'" aria-label="'+esc(longName.charAt(0).toUpperCase()+longName.slice(1)+(isToday?' (hoy)':'')+' · '+list.length+' '+(list.length===1?'máquina':'máquinas'))+'">'
      +'<div class="wk-dayhead"><span class="wk-dow">'+WK_DIA[d.getDay()]+'</span><span class="wk-num">'+d.getDate()+'</span></div>'
      +'<div class="wk-daybody">'+action
      +'<div class="wk-items" role="list">'+list.map(card).join('')+'</div>'
      +'</div></section>';
  }).join('');

  const tabs=Object.keys(MACHINE_DB).map(code=>{const a=MACHINE_DB[code],on=code===Weekly.area;
    return '<button type="button" role="tab" class="wk-tab" aria-selected="'+on+'" data-wk="area" data-code="'+code+'"><span>'+esc(a.label)+'</span><small>'+a.entries.length+'</small></button>'}).join('');
  const tiles=area.entries.map(e=>{
    const name=machineEntryName(e),m={code:Weekly.area,name},n=countInWeek[m.code+'|'+name]||0,on=wkSame(sel,m);
    return '<button type="button" class="wk-tile'+(n?' is-scheduled':'')+(on?' is-selected':'')+'" data-wk="tile" data-code="'+esc(m.code)+'" data-name="'+esc(name)+'" aria-pressed="'+on+'">'
      +'<span class="wk-tile-top"><span class="wk-tile-area">'+esc(area.label)+'</span>'+(n?'<span class="wk-badge">'+(n===1?'1 día':n+' días')+'</span>':'')+'</span>'
      +'<span class="wk-tile-name">'+esc(name)+'</span></button>';
  }).join('');
  const selHint=sel?sel.name+' seleccionada · toca «+ Agregar aquí» en un día':'';
  const moveHint=move?move.name+' ('+wkDayShort(move.day)+') seleccionada · toca «Mover aquí» en otro día':'';
  const stripHint=move?'<p class="wk-strip-hint is-move" aria-live="polite">'+esc(moveHint)+'</p>':sel?'<p class="wk-strip-hint">'+esc(selHint)+'</p>':'';
  const undoBar=Weekly.undo?'<div class="wk-undo" role="status"><span>'+esc(Weekly.undo.msg)+'</span><button type="button" data-wk="undo">Deshacer</button></div>':'';
  const areaHint=area.area+' · '+area.entries.length+' equipos';

  const mondays=wkMonthMondays(mon);
  const pdfOptions=[
    {id:'week',title:'Esta semana',sub:'Semana '+info.weekNum+' · '+info.range.charAt(0).toLowerCase()+info.range.slice(1)},
    {id:'month',title:'Mes completo',sub:info.month+' '+mon.getFullYear()+' · '+mondays.length+' semanas, una por hoja'}
  ];
  const dialog=Weekly.pdfOpen?'<div class="wk-backdrop" data-wk="backdrop"><div class="wk-dialog" role="dialog" aria-modal="true" aria-labelledby="wkDlgTitle">'
    +'<h3 id="wkDlgTitle">Generar PDF</h3><p class="wk-dlg-sub">Se genera en hoja horizontal. ¿Qué quieres incluir?</p>'
    +'<div class="wk-options" role="radiogroup" aria-label="Contenido del PDF">'+pdfOptions.map(o=>{const on=Weekly.pdfScope===o.id;
      return '<button type="button" role="radio" class="wk-option" aria-checked="'+on+'" data-wk="scope" data-scope="'+o.id+'"><span class="wk-radio" aria-hidden="true"></span><span><b>'+esc(o.title)+'</b><small>'+esc(o.sub)+'</small></span></button>'}).join('')+'</div>'
    +'<div class="wk-dlg-actions"><button type="button" class="wk-btn-sec" data-wk="close">Cancelar</button><button type="button" class="wk-btn-pri" data-wk="generate">Generar PDF</button></div>'
    +'</div></div>':'';

  root.innerHTML='<div class="wk'+(sel||move?' has-sel':'')+(Weekly.undo?' has-undo':'')+'" style="--wk-slots:'+slots+'">'
    /* La franja de la semana es el encabezado de la pantalla (sin logo); ‹ Volver solo se ve en celular. */
    +'<header class="wk-strip"><button type="button" class="wk-navbtn wk-back" data-wk="back" aria-label="Volver">'+wkIcon('m15 18-6-6 6-6')+'</button>'
    +'<div class="wk-titles"><h1 class="wk-title">Semana '+info.weekNum+' · '+esc(info.month)+'</h1><p class="wk-range">'+esc(info.range)+'</p>'+stripHint+'</div>'
    +'<div class="wk-nav"><button type="button" class="wk-navbtn" data-wk="prev" aria-label="Semana anterior">'+wkIcon('m15 18-6-6 6-6')+'</button><button type="button" class="wk-today" data-wk="today">Hoy</button><button type="button" class="wk-navbtn" data-wk="next" aria-label="Semana siguiente">'+wkIcon('m9 18 6-6-6-6')+'</button>'
    +'<span class="wk-sep" aria-hidden="true"></span>'
    +'<button type="button" class="wk-sheet-btn" data-wk="sheet" aria-controls="wkSide" aria-expanded="'+Weekly.sheetOpen+'">'+wkIcon('M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z')+'Máquinas</button>'
    +(Weekly.pdfReady&&Bridge.available?'<button type="button" class="wk-share" data-wk="share">Compartir</button>':'')
    +'<button type="button" class="wk-pdfbtn" data-wk="pdf" aria-label="Generar PDF" title="Generar PDF">'+wkIcon('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3')+'<span class="wk-pdf-label">Generar PDF</span></button></div></header>'
    +'<aside class="wk-side" id="wkSide" aria-label="Máquinas"><div class="wk-side-inner">'
    +'<div class="wk-sidehead"><button type="button" class="wk-sheet-close" data-wk="sheet-close" aria-label="Cerrar máquinas">'+wkIcon('M18 6 6 18M6 6l12 12')+'</button><h2>Máquinas</h2><p class="wk-hint" aria-live="polite"><span class="wk-hint-area">'+esc(areaHint)+'</span>'+(sel?'<span class="wk-hint-sel">'+esc(selHint)+'</span>':'')+'</p></div>'
    +'<div class="wk-tabs" role="tablist" aria-label="Áreas">'+tabs+'</div>'
    +'<div class="wk-tiles" role="tabpanel" aria-label="'+esc('Máquinas de '+area.area)+'">'+tiles+'</div>'
    +(sel?'<p class="wk-selhint">'+esc(selHint)+'</p>':'')
    +'</div></aside>'
    +'<section class="wk-week" aria-label="Días de la semana">'+dayHtml+'</section>'
    +'<div class="wk-sheet-scrim" data-wk="sheet-scrim" aria-hidden="true"></div>'
    +undoBar+dialog+'</div>';

  const tilesNew=root.querySelector('.wk-tiles');if(tilesNew&&tilesScroll){tilesNew.scrollLeft=tilesScroll[0];tilesNew.scrollTop=tilesScroll[1]}
  root.querySelectorAll('.wk-day').forEach(d=>{const l=d.querySelector('.wk-items');if(l&&itemScroll[d.dataset.day])l.scrollTop=itemScroll[d.dataset.day]});
  const focusEl=Weekly.pdfOpen?(root.querySelector('.wk-dialog [aria-checked="true"]')&&(!focusSel||!root.querySelector('.wk-dialog '+focusSel))?root.querySelector('.wk-dialog [aria-checked="true"]'):root.querySelector('.wk-dialog '+focusSel)):(focusSel&&root.querySelector(focusSel));
  if(focusEl)focusEl.focus({preventScroll:true});
}

/* ===== PDF del calendario: "semana por área" (A4 horizontal, colores originales de los PDF) =====
   Una hoja por semana: filas = áreas (CAM, IMP, DIM, BSL, EXT1, EXT2), columnas = lunes a domingo, y
   cada máquina en un chip con casilla para marcar al terminar. Medidas en pt desde arriba a la izquierda. */
const WK_PDF={W:842,H:595,X0:33,X1:809,navy:'#172B3A',green:'#23875A',greenText:'#176B45',gray:'#526574',light:'#D1DBE3',
  chipLine:'#CCD9E3',inner:'#E3EAF0',head:'#EBF0F5',areaBg:'#F4F7FA',rowBg:['#FFFFFF','#FAFBFD'],
  tableTop:136.5,headH:30,tableBottom:515.5,areaW:93,minRow:40,gap:3.75,pad:4.5};
const wkPlural=(n,one,many)=>n+' '+(n===1?one:many);
/* Una fila por área con las máquinas de cada día, en el orden del catálogo. */
function wkWeekRows(mon){
  const data=wkData();
  return Object.keys(MACHINE_DB).map(code=>{
    const order=MACHINE_DB[code].entries.map(machineEntryName);
    const cells=[];
    for(let i=0;i<7;i++){
      const names=(data[wkKey(wkAddDays(mon,i))]||[]).filter(m=>m.code===code).map(m=>m.name);
      names.sort((a,b)=>{const ia=order.indexOf(a),ib=order.indexOf(b);return (ia<0?1e9:ia)-(ib<0?1e9:ib)||a.localeCompare(b)});
      cells.push(names);
    }
    return {code,label:MACHINE_DB[code].label,cells,count:cells.reduce((n,c)=>n+c.length,0),most:Math.max(...cells.map(c=>c.length))};
  });
}
const wkRowNeed=(n,ch)=>Math.max(WK_PDF.minRow,9+n*ch+Math.max(0,n-1)*WK_PDF.gap);
/* Reparte las filas en hojas: chip de 21 pt; si no cabe, de 18 pt; si aún no cabe, hojas de continuación
   (nunca parte una fila). En una sola hoja el sobrante se reparte por igual entre las 6 filas; si la tabla
   se parte, cada fila conserva su alto natural (una fila vacía no ocupa la hoja entera). */
function wkLayoutWeek(rows){
  const avail=WK_PDF.tableBottom-WK_PDF.tableTop-WK_PDF.headH;
  for(const [ch,fs] of [[21,10.5],[18,9.75]]){
    const need=rows.map(r=>wkRowNeed(r.most,ch));
    if(need.reduce((a,b)=>a+b,0)<=avail)return {ch,fs,spread:true,pages:[rows.map((r,i)=>({row:r,index:i,h:need[i]}))]};
  }
  const ch=18,fs=9.75,pages=[];let cur=[],used=0;
  rows.forEach((r,i)=>{
    const h=Math.min(avail,wkRowNeed(r.most,ch));
    if(cur.length&&used+h>avail){pages.push(cur);cur=[];used=0}
    cur.push({row:r,index:i,h});used+=h;
  });
  if(cur.length)pages.push(cur);
  return {ch,fs,spread:false,pages};
}
function wkPdfHeader(c,title){
  const P=WK_PDF;
  c.rect(0,0,P.W,72,{fill:P.navy});c.rect(0,72,P.W,3,{fill:P.green});
  c.text(P.X0,36,'CHIAPLAST',22.5,true,'#FFFFFF');
  c.text(P.X0,54,'Departamento de Mantenimiento',9.75,false,P.light);
  c.text(P.X1,42,title,11,true,'#FFFFFF','right');
}
function wkPdfBar(c,title,range,summary){
  const P=WK_PDF;
  c.rect(P.X0,91.5,P.X1-P.X0,34.5,{fill:P.navy});
  c.text(45,113,title,12,true,'#FFFFFF');
  if(range)c.text(45+pdfMeasure(title,12,true)+10.5,113,range,10.5,false,P.light);
  if(summary)c.text(797,113,summary,10.5,true,'#FFFFFF','right');
}
function wkPdfTable(c,mon,slice,ch,fs,spread){
  const P=WK_PDF,top=P.tableTop,width=P.X1-P.X0,dayW=(width-P.areaW)/7;
  const avail=P.tableBottom-top-P.headH,spare=spread?Math.max(0,(avail-slice.reduce((n,s)=>n+s.h,0))/slice.length):0;
  const colX=i=>P.X0+P.areaW+i*dayW;
  /* Encabezado */
  c.rect(P.X0,top,width,P.headH,{fill:P.head});
  c.text(P.X0+9,top+18.5,'ÁREA',9.75,true,P.navy);
  for(let i=0;i<7;i++){
    const d=wkAddDays(mon,i),lead=WK_DIA[d.getDay()]+' '+d.getDate();
    c.text(colX(i)+7.5,top+18.5,lead,9.75,true,P.navy);
    c.text(colX(i)+7.5+pdfMeasure(lead,9.75,true),top+18.5,' '+WK_MES[d.getMonth()],9.75,false,P.gray);
    c.line(colX(i),top,colX(i),top+P.headH,P.light);
  }
  c.line(P.X0,top+P.headH,P.X1,top+P.headH,P.light);
  /* Filas de área */
  let y=top+P.headH;
  slice.forEach((s,k)=>{
    const r=s.row,h=s.h+spare,mid=y+h/2;
    c.rect(P.X0,y,width,h,{fill:P.rowBg[s.index%2]});
    c.rect(P.X0,y,P.areaW,h,{fill:P.areaBg});
    c.text(P.X0+9,mid-1.5,r.label,12.75,true,P.navy);
    c.text(P.X0+9,mid+11.5,r.count?wkPlural(r.count,'máquina','máquinas'):'Sin programar',9,false,P.greenText);
    const fits=Math.max(1,Math.floor((h-2*P.pad+P.gap)/(ch+P.gap)));
    r.cells.forEach((names,i)=>{
      const x=colX(i);c.line(x,y,x,y+h,P.inner);
      let list=names;
      if(names.length>fits)list=names.slice(0,fits-1).concat(['+ '+(names.length-fits+1)+' más']);
      const stack=list.length*ch+Math.max(0,list.length-1)*P.gap;let cy=y+(h-stack)/2;
      const cx=x+P.pad,cw=dayW-2*P.pad,box=9.75;
      list.forEach((name,j)=>{
        const more=j===list.length-1&&list!==names;
        if(more){c.text(cx+7,cy+ch/2+fs*0.35,name,fs,true,P.gray);cy+=ch+P.gap;return}
        c.rect(cx,cy,cw,ch,{fill:'#FFFFFF',stroke:P.chipLine,lw:0.75,r:3});
        c.text(cx+7,cy+ch/2+fs*0.35,pdfFit(name,cw-7-5-box-4,fs,true),fs,true,P.navy);
        c.rect(cx+cw-5-box,cy+(ch-box)/2,box,box,{stroke:P.navy,lw:1.1});
        cy+=ch+P.gap;
      });
    });
    if(k)c.line(P.X0,y,P.X1,y,P.light);
    y+=h;
  });
  c.rect(P.X0,top,width,y-top,{stroke:P.light,lw:0.75});
}
function wkPdfFooter(c,page,total,generated){
  const P=WK_PDF;
  c.rect(P.X0,527,9,9,{stroke:P.navy,lw:1.1});
  c.text(P.X0+14,535,'= marcar al terminar el mantenimiento',9,false,P.gray);
  c.line(432,528,597,528,P.navy);c.line(621,528,786,528,P.navy);
  c.text(514.5,540,'Elaboró',9,false,P.gray,'center');c.text(703.5,540,'Revisó',9,false,P.gray,'center');
  c.line(P.X0,556,P.X1,556,P.light);
  c.text(P.X0,570,'Chiaplast · Mantenimiento · Documento generado el '+generated,9,false,P.gray);
  c.text(P.X1,570,'Página '+page+' de '+total,9,true,P.navy,'right');
}
/* scope: 'week' (semana visible) o 'month' (cada semana del mes con máquinas; contadas por su lunes). */
function wkBuildAreaPdf(scope){
  const P=WK_PDF,mon=Weekly.monday,now=new Date();
  const generated=(now.toLocaleDateString('es-MX')+', '+now.toLocaleTimeString('es-MX',{hour:'numeric',minute:'2-digit'})).replace(/[  ]/g,' ');
  const monthName=WK_MESES[mon.getMonth()],year=mon.getFullYear();
  const title=scope==='month'?'CALENDARIO MENSUAL POR ÁREA · '+monthName.toUpperCase()+' '+year:'CALENDARIO SEMANAL POR ÁREA';
  const weeks=scope==='month'?wkMonthMondays(mon).filter(m=>wkWeekRows(m).some(r=>r.count)):[mon];
  const sheets=[];
  weeks.forEach(m=>{
    const rows=wkWeekRows(m),info=wkWeekInfo(m),total=rows.reduce((n,r)=>n+r.count,0),areas=rows.filter(r=>r.count).length;
    const lay=wkLayoutWeek(rows);
    lay.pages.forEach((slice,i)=>sheets.push(c=>{
      wkPdfHeader(c,title);
      wkPdfBar(c,'Semana '+info.weekNum+' · '+info.month,info.range+(i?' (continuación)':''),wkPlural(total,'máquina','máquinas')+' · '+wkPlural(areas,'área','áreas'));
      wkPdfTable(c,m,slice,lay.ch,lay.fs,lay.spread);
    }));
  });
  if(!sheets.length)sheets.push(c=>{
    wkPdfHeader(c,title);wkPdfBar(c,monthName+' · '+year,'','');
    c.text(P.W/2,(P.tableTop+P.tableBottom)/2+4,'Sin máquinas programadas en '+monthName.toLowerCase()+' de '+year,12,false,P.gray,'center');
  });
  const pages=sheets.map((draw,i)=>{const c=pdfCanvas(P.H);draw(c);wkPdfFooter(c,i+1,sheets.length,generated);return {ops:c.ops}});
  return pdfAssemble(pages,P.W,P.H,title,[]);
}
async function wkGeneratePdf(){
  const scope=Weekly.pdfScope,mon=Weekly.monday;
  const name=scope==='month'?'CALENDARIO-MES-'+mon.getFullYear()+pad(mon.getMonth()+1)+'.pdf':'CALENDARIO-SEMANA-'+wkKey(mon).replaceAll('-','')+'.pdf';
  Weekly.pdfOpen=false;renderWeekly();
  try{
    const blob=wkBuildAreaPdf(scope);
    LastExports.length=0;
    const mode=await exportReport(blob,name,PDF_MIME);
    Weekly.pdfReady=true;renderWeekly();
    toast(mode==='android-saved'?'PDF guardado en Descargas/Chiaplast':'PDF generado.');
  }catch(e){toast(e&&e.message?e.message:'No se pudo generar el PDF.')}
}

/* ===== Modos según el ancho disponible (no según la pantalla) =====
   W = ancho de contenido del cuerpo de la pantalla (sin relleno), medido con ResizeObserver: así cambia
   igual al plegar el menú o al girar la tablet. >= 1100 amplio (panel de 300 px), 860–1099 compacto
   (panel de 220 px), < 860 lateral (panel oculto que se abre como hoja desde la derecha). En celular
   (< 700 px de pantalla) no hay modo: rige la distribución vertical. .wk-dense = días de menos de 110 px. */
const WK_MODES=['amplio','compacto','lateral'];
function wkUpdateMode(){
  const sec=$('weeklyCalendar'),body=sec&&sec.querySelector('.body');if(!body)return;
  let mode='';
  if(innerWidth>=700){
    const cs=getComputedStyle(body),W=body.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
    if(W<=0)return;
    mode=W>=1100?'amplio':W>=860?'compacto':'lateral';
    const side=mode==='amplio'?320:mode==='compacto'?236:0;
    sec.classList.toggle('wk-dense',(W-side-28-48)/7<110);
  }else sec.classList.remove('wk-dense');
  WK_MODES.forEach(m=>{const c='wk-'+m;if(sec.classList.contains(c)!==(m===mode))sec.classList.toggle(c,m===mode)});
  if(mode!=='lateral'&&Weekly.sheetOpen)wkSheet(false);
}
const wkIsLateral=()=>{const s=$('weeklyCalendar');return !!s&&s.classList.contains('wk-lateral')};
/* Hoja de Máquinas del modo lateral (se abre desde la derecha). */
function wkSheet(open,opts){
  const sec=$('weeklyCalendar');if(!sec)return;
  Weekly.sheetOpen=!!open;sec.classList.toggle('wk-sheet-open',Weekly.sheetOpen);sec.classList.remove('wk-sheet-dragging');
  const btn=sec.querySelector('.wk-sheet-btn');if(btn)btn.setAttribute('aria-expanded',String(Weekly.sheetOpen));
  if(opts&&opts.focus){const t=Weekly.sheetOpen?sec.querySelector('.wk-tab[aria-selected="true"]'):btn;if(t)t.focus({preventScroll:true})}
}

(function wkBindEvents(){
  const root=$('wkRoot');if(!root)return;
  const tileOf=el=>{const t=el&&el.closest('.wk-tile');return t?{code:t.dataset.code,name:t.dataset.name}:null};
  const cardSel=m=>'.wk-item-main[data-day="'+CSS.escape(m.day)+'"][data-code="'+CSS.escape(m.code)+'"][data-name="'+CSS.escape(m.name)+'"]';
  const isShown=()=>{const s=$('weeklyCalendar');return !!s&&s.classList.contains('active')};
  root.addEventListener('click',e=>{
    const b=e.target.closest('[data-wk]');if(!b||!root.contains(b))return;
    const a=b.dataset.wk;
    if(a==='backdrop'){if(e.target===b){Weekly.pdfOpen=false;renderWeekly()}return}
    if(a==='prev')wkShift(-1);
    else if(a==='next')wkShift(1);
    else if(a==='today')wkGoToday();
    else if(a==='area'){Weekly.area=b.dataset.code;renderWeekly()}
    else if(a==='tile'){const m=tileOf(b);Weekly.move=null;Weekly.sel=wkSame(Weekly.sel,m)?null:m;if(Weekly.sel&&wkIsLateral()&&Weekly.sheetOpen)wkSheet(false);renderWeekly()}
    else if(a==='item'){
      const m={day:b.dataset.day,code:b.dataset.code,name:b.dataset.name};
      Weekly.sel=null;Weekly.move=Weekly.move&&Weekly.move.day===m.day&&wkSame(Weekly.move,m)?null:m;renderWeekly();
    }
    else if(a==='move-here'){const mv=Weekly.move;if(mv)wkMove(mv.day,b.dataset.day,mv)}
    else if(a==='move-cancel'){const mv=Weekly.move;Weekly.move=null;renderWeekly();const c=mv&&root.querySelector(cardSel(mv));if(c)c.focus({preventScroll:true})}
    else if(a==='undo')wkUndo();
    else if(a==='sheet')wkSheet(!Weekly.sheetOpen,{focus:true});
    else if(a==='sheet-close'||a==='sheet-scrim')wkSheet(false,{focus:true});
    else if(a==='place'){if(Weekly.sel)wkAdd(b.dataset.day,Weekly.sel)}
    else if(a==='remove')wkRemove(b.dataset.day,{code:b.dataset.code,name:b.dataset.name});
    else if(a==='pdf'){Weekly.pdfOpen=true;Weekly.pdfScope='week';renderWeekly()}
    else if(a==='scope'){Weekly.pdfScope=b.dataset.scope;renderWeekly()}
    else if(a==='close'){Weekly.pdfOpen=false;renderWeekly();const p=root.querySelector('.wk-pdfbtn');if(p)p.focus()}
    else if(a==='generate')wkGeneratePdf();
    else if(a==='share')shareLast(0);
    else if(a==='back')history.back();
  });

  /* ===== Arrastre único con Pointer Events (mouse, tacto y lápiz) =====
     Tarjeta del panel → AGREGAR a un día; tarjeta de un día → MOVER a otro día de la semana visible.
     Mouse: empieza al moverse > 6 px con el botón presionado. Tacto/lápiz: pulsación larga de 300 ms sin
     moverse > 8 px; si el dedo se mueve antes es un desplazamiento normal. Un toque corto es una selección. */
  const MOUSE_PX=6,SLOP_PX=8,HOLD_MS=300,EDGE_PX=48,STEP_PX=8;
  let D=null,suppress=null;
  const clearOver=()=>root.querySelectorAll('.wk-day.is-over').forEach(d=>d.classList.remove('is-over'));
  const dayAt=(x,y)=>{const el=document.elementFromPoint(x,y),d=el&&el.closest('[data-wk-day]');return d&&root.contains(d)?d:null};
  function updateOver(){
    const day=dayAt(D.x,D.y),ok=day&&!(D.kind==='move'&&day.dataset.wkDay===D.from)?day:null;
    if(ok===D.over)return;
    if(D.over)D.over.classList.remove('is-over');
    D.over=ok;if(ok)ok.classList.add('is-over');
  }
  const placeGhost=()=>{if(D.ghost)D.ghost.style.transform='translate3d('+(D.x-D.ox)+'px,'+(D.y-D.oy)+'px,0) rotate(2deg)'};
  /* Contenedor que se desliza bajo el dedo: la lista de un día lleno o, si no, el cuerpo de la pantalla
     (en celular, la lista de días apilados). */
  function edgeScroller(){
    const el=document.elementFromPoint(D.x,D.y),list=el&&el.closest('.wk-items'),sec=$('weeklyCalendar'),body=sec&&sec.querySelector('.body');
    for(const sc of [list&&root.contains(list)?list:null,body]){
      if(!sc||sc.scrollHeight<=sc.clientHeight+1)continue;
      const r=sc.getBoundingClientRect();
      if(D.y<r.top+EDGE_PX&&sc.scrollTop>0)return {sc,dy:-STEP_PX};
      if(D.y>r.bottom-EDGE_PX&&sc.scrollTop+sc.clientHeight<sc.scrollHeight-1)return {sc,dy:STEP_PX};
    }
    return null;
  }
  function tick(){
    if(!D||!D.active)return;
    const s=edgeScroller();
    if(s){s.sc.scrollTop+=s.dy;updateOver()}
    D.raf=requestAnimationFrame(tick);
  }
  function startDrag(){
    if(!D||D.active)return;
    clearTimeout(D.timer);
    if(!D.src.isConnected){D=null;return}
    D.active=true;
    try{D.src.setPointerCapture(D.id)}catch(_){}
    const card=D.kind==='move'?D.src.closest('.wk-item'):D.src,r=card.getBoundingClientRect();
    const g=document.createElement('div'),gw=Math.round(Math.max(120,Math.min(220,r.width)));
    g.className='wk-ghost';g.setAttribute('aria-hidden','true');g.style.width=gw+'px';
    g.innerHTML='<span class="wk-ghost-area">'+esc(wkLabel(D.m.code))+'</span><span class="wk-ghost-name">'+esc(D.m.name)+'</span>';
    document.body.appendChild(g);
    D.ghost=g;D.card=card;
    D.ox=Math.min(Math.max(D.x-r.left,0),gw-12);D.oy=Math.min(Math.max(D.y-r.top,0),g.offsetHeight-8);
    card.classList.add('wk-drag-src');
    const w=root.querySelector('.wk');if(w)w.classList.add('is-dragging');
    /* Arrastre desde la hoja lateral: se oculta (sin quitarla del DOM) para dejar libres los días. */
    const sec=$('weeklyCalendar');
    if(D.kind==='add'&&wkIsLateral()&&Weekly.sheetOpen&&sec){sec.classList.add('wk-sheet-dragging');D.sheet=true}
    try{const s=getSelection();if(s)s.removeAllRanges()}catch(_){}
    placeGhost();updateOver();
    D.raf=requestAnimationFrame(tick);
  }
  /* drop=true: soltar (pointerup); false: cancelar (fuera de un día, pointercancel, Escape). */
  function endDrag(drop){
    const d=D;D=null;if(!d)return;
    clearTimeout(d.timer);
    if(!d.active)return;
    cancelAnimationFrame(d.raf);
    suppress={code:d.m.code,name:d.m.name,day:d.from||'',until:Date.now()+400};
    try{if(d.src.hasPointerCapture(d.id))d.src.releasePointerCapture(d.id)}catch(_){}
    if(d.ghost)d.ghost.remove();
    if(d.card)d.card.classList.remove('wk-drag-src');
    clearOver();
    const w=root.querySelector('.wk');if(w)w.classList.remove('is-dragging');
    const to=drop&&d.over?d.over.dataset.wkDay:null;
    if(d.sheet){if(to)wkSheet(false);else{const s=$('weeklyCalendar');if(s)s.classList.remove('wk-sheet-dragging')}}
    if(!to)return;
    if(d.kind==='add')wkAdd(to,d.m);else wkMove(d.from,to,d.m);
  }
  root.addEventListener('pointerdown',e=>{
    if(D||!e.isPrimary||Weekly.pdfOpen)return;
    if(e.pointerType==='mouse'&&e.button!==0)return;
    const src=e.target.closest('.wk-tile,.wk-item-main');if(!src||!root.contains(src))return;
    const move=src.classList.contains('wk-item-main');
    D={id:e.pointerId,src,kind:move?'move':'add',m:{code:src.dataset.code,name:src.dataset.name},from:move?src.dataset.day:null,
      x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY,touch:e.pointerType!=='mouse',active:false,over:null,timer:0,raf:0};
    if(D.touch)D.timer=setTimeout(startDrag,HOLD_MS);
  });
  document.addEventListener('pointermove',e=>{
    if(!D||e.pointerId!==D.id)return;
    D.x=e.clientX;D.y=e.clientY;
    if(!D.active){
      const dist=Math.hypot(D.x-D.x0,D.y-D.y0);
      if(D.touch){if(dist>SLOP_PX)endDrag(false);return}
      if(dist<=MOUSE_PX)return;
      startDrag();if(!D)return;
    }
    e.preventDefault();placeGhost();updateOver();
  });
  document.addEventListener('pointerup',e=>{if(!D||e.pointerId!==D.id)return;D.x=e.clientX;D.y=e.clientY;if(D.active)updateOver();endDrag(true)});
  document.addEventListener('pointercancel',e=>{if(D&&e.pointerId===D.id)endDrag(false)});
  addEventListener('blur',()=>endDrag(false));
  /* En tacto, la WebView no debe desplazar la página mientras se arrastra. El listener existe desde el inicio
     (si se registra a mitad del gesto, Chrome ya no permite cancelar el touchmove), pero solo llama a
     preventDefault() mientras el arrastre está activo. */
  document.addEventListener('touchmove',e=>{if(D&&D.active&&e.cancelable)e.preventDefault()},{passive:false});
  root.addEventListener('contextmenu',e=>{if(D)e.preventDefault()});
  /* El clic que el navegador genera al soltar un arrastre no debe seleccionar la tarjeta arrastrada;
     cualquier otro clic (p. ej. «Deshacer» justo después) sí pasa. */
  root.addEventListener('click',e=>{
    const s=suppress;if(!s)return;
    if(Date.now()>s.until){suppress=null;return}
    const t=e.target.closest('.wk-tile,.wk-item-main');
    if(t&&t.dataset.code===s.code&&t.dataset.name===s.name&&(t.dataset.day||'')===s.day){suppress=null;e.preventDefault();e.stopPropagation()}
  },true);

  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    if(D&&D.active){endDrag(false);return}
    if(Weekly.pdfOpen){Weekly.pdfOpen=false;renderWeekly()}
    else if(Weekly.move&&isShown()){const mv=Weekly.move;Weekly.move=null;renderWeekly();const c=root.querySelector(cardSel(mv));if(c)c.focus({preventScroll:true})}
    else if(Weekly.sheetOpen&&wkIsLateral())wkSheet(false,{focus:true});
  });
  const body=$('weeklyCalendar')&&$('weeklyCalendar').querySelector('.body');
  if(body&&'ResizeObserver' in window)new ResizeObserver(()=>wkUpdateMode()).observe(body);
  addEventListener('resize',wkUpdateMode);
})();
