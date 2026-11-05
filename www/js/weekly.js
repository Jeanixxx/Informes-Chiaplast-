/* ===== Calendario semanal de mantenimiento =====
   Semana de lunes a domingo. Las máquinas salen de MACHINE_DB (una tarjeta por entrada) y se asignan
   a un día arrastrando (tablet/PC) o tocando la tarjeta y luego «+ Agregar aquí» (obligatorio en celular).
   Un solo estado (Weekly) y un solo render: el CSS decide la distribución en tablet/PC o celular.
   Guardado: { 'AAAA-MM-DD': [{code, name}] } en KEYS.weeklyCalendar. La identidad es área + nombre. */
const WK_MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const WK_MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const WK_DIA=['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
const WK_DIA_LARGO=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const Weekly={monday:null,area:'CAM',sel:null,drag:null,pdfOpen:false,pdfScope:'week',data:null,pdfReady:false};

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
function wkRemove(day,m){
  const data=wkData(),list=(data[day]||[]).filter(x=>!wkSame(x,m));
  if(list.length)data[day]=list;else delete data[day];
  wkSave();renderWeekly();
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
function wkShift(n){Weekly.monday=wkAddDays(Weekly.monday,7*n);Weekly.pdfReady=false;renderWeekly()}
function wkGoToday(){Weekly.monday=wkMondayOf(new Date());Weekly.pdfReady=false;renderWeekly()}

function renderWeekly(){
  const root=$('wkRoot');if(!root)return;
  if(!Weekly.monday)Weekly.monday=wkMondayOf(new Date());
  if(!MACHINE_DB[Weekly.area])Weekly.area=Object.keys(MACHINE_DB)[0];
  const data=wkData(),mon=Weekly.monday,info=wkWeekInfo(mon),todayKey=wkKey(new Date()),sel=Weekly.sel;
  const area=MACHINE_DB[Weekly.area];

  /* Conservar foco y desplazamientos al volver a dibujar */
  const act=document.activeElement,focusSel=act&&root.contains(act)&&act.dataset.wk?'[data-wk="'+act.dataset.wk+'"]'+['day','code','name','scope'].map(k=>act.dataset[k]!=null?'[data-'+k+'="'+CSS.escape(act.dataset[k])+'"]':'').join(''):'';
  const tilesEl=root.querySelector('.wk-tiles'),tilesScroll=tilesEl?[tilesEl.scrollLeft,tilesEl.scrollTop]:null;
  const itemScroll={};root.querySelectorAll('.wk-day').forEach(d=>{const l=d.querySelector('.wk-items');if(l)itemScroll[d.dataset.day]=l.scrollTop});

  const days=[],weekKeys=[];
  for(let i=0;i<7;i++){const d=wkAddDays(mon,i);days.push(d);weekKeys.push(wkKey(d))}
  const maxCount=Math.max(0,...weekKeys.map(k=>(data[k]||[]).length));
  const slots=Math.min(6,Math.max(4,maxCount+1));
  const countInWeek={};
  weekKeys.forEach(k=>(data[k]||[]).forEach(m=>{const id=m.code+'|'+m.name;countInWeek[id]=(countInWeek[id]||0)+1}));

  const dayHtml=days.map((d,i)=>{
    const key=weekKeys[i],list=data[key]||[],isToday=key===todayKey;
    const longName=WK_DIA_LARGO[d.getDay()]+' '+d.getDate()+' de '+WK_MESES[d.getMonth()].toLowerCase();
    return '<section class="wk-day'+(isToday?' is-today':'')+'" data-day="'+key+'" aria-label="'+esc(longName.charAt(0).toUpperCase()+longName.slice(1)+(isToday?' (hoy)':'')+' · '+list.length+' '+(list.length===1?'máquina':'máquinas'))+'">'
      +'<div class="wk-dayhead"><span class="wk-dow">'+WK_DIA[d.getDay()]+'</span><span class="wk-num">'+d.getDate()+'</span><span class="wk-sub">'+(isToday?'Hoy · ':'')+WK_MES[d.getMonth()]+'</span></div>'
      +'<div class="wk-daybody">'
      +(sel?'<button type="button" class="wk-place" data-wk="place" data-day="'+key+'">+ Agregar aquí</button>':'')
      +'<ul class="wk-items">'+(list.length?list.map(m=>'<li class="wk-item"><span class="wk-item-area">'+esc(wkLabel(m.code))+'</span><span class="wk-item-name">'+esc(m.name)+'</span><button type="button" class="wk-remove" data-wk="remove" data-day="'+key+'" data-code="'+esc(m.code)+'" data-name="'+esc(m.name)+'" aria-label="'+esc('Quitar '+m.name+' ('+wkLabel(m.code)+') del '+WK_DIA_LARGO[d.getDay()]+' '+d.getDate())+'">'+wkIcon('M18 6 6 18M6 6l12 12')+'</button></li>').join(''):'<li class="wk-empty">Sin máquinas</li>')+'</ul>'
      +'</div></section>';
  }).join('');

  const tabs=Object.keys(MACHINE_DB).map(code=>{const a=MACHINE_DB[code],on=code===Weekly.area;
    return '<button type="button" role="tab" class="wk-tab" aria-selected="'+on+'" data-wk="area" data-code="'+code+'"><span>'+esc(a.label)+'</span><small>'+a.entries.length+'</small></button>'}).join('');
  const tiles=area.entries.map(e=>{
    const name=machineEntryName(e),m={code:Weekly.area,name},n=countInWeek[m.code+'|'+name]||0,on=wkSame(sel,m);
    return '<button type="button" class="wk-tile'+(n?' is-scheduled':'')+(on?' is-selected':'')+'" draggable="true" data-wk="tile" data-code="'+esc(m.code)+'" data-name="'+esc(name)+'" aria-pressed="'+on+'">'
      +'<span class="wk-tile-top"><span class="wk-tile-area">'+esc(area.label)+'</span>'+(n?'<span class="wk-badge">'+(n===1?'1 día':n+' días')+'</span>':'')+'</span>'
      +'<span class="wk-tile-name">'+esc(name)+'</span></button>';
  }).join('');
  const selHint=sel?sel.name+' seleccionada · toca «+ Agregar aquí» en un día':'';
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

  root.innerHTML='<div class="wk'+(sel?' has-sel':'')+'" style="--wk-slots:'+slots+'">'
    +'<header class="wk-strip"><div class="wk-logo"><img src="img/logo-chiaplast.png" alt="Chiaplast"></div>'
    +'<div class="wk-titles"><h2 class="wk-title">Semana '+info.weekNum+' · '+esc(info.month)+'</h2><p class="wk-range">'+esc(info.range)+'</p></div>'
    +'<div class="wk-nav"><button type="button" class="wk-navbtn" data-wk="prev" aria-label="Semana anterior">'+wkIcon('m15 18-6-6 6-6')+'</button><button type="button" class="wk-today" data-wk="today">Hoy</button><button type="button" class="wk-navbtn" data-wk="next" aria-label="Semana siguiente">'+wkIcon('m9 18 6-6-6-6')+'</button></div></header>'
    +'<aside class="wk-side" aria-label="Máquinas"><div class="wk-side-inner">'
    +'<div class="wk-sidehead"><h2>Máquinas</h2><p class="wk-hint" aria-live="polite"><span class="wk-hint-area">'+esc(areaHint)+'</span>'+(sel?'<span class="wk-hint-sel">'+esc(selHint)+'</span>':'')+'</p></div>'
    +'<div class="wk-tabs" role="tablist" aria-label="Áreas">'+tabs+'</div>'
    +'<div class="wk-tiles" role="tabpanel" aria-label="'+esc('Máquinas de '+area.area)+'">'+tiles+'</div>'
    +(sel?'<p class="wk-selhint">'+esc(selHint)+'</p>':'')
    +'</div></aside>'
    +'<section class="wk-week" aria-label="Días de la semana">'+dayHtml+'</section>'
    +'<div class="wk-pdfbar"><span class="wk-pdficon" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="M12 18v-6"></path><path d="m9 15 3 3 3-3"></path></svg></span>'
    +'<h3>Exportar calendario</h3>'
    +(Weekly.pdfReady&&Bridge.available?'<button type="button" class="wk-btn-sec" data-wk="share">Compartir PDF</button>':'')
    +'<button type="button" class="wk-btn-pri wk-pdfbtn" data-wk="pdf">'+wkIcon('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3')+'Generar PDF</button></div>'
    +dialog+'</div>';

  const tilesNew=root.querySelector('.wk-tiles');if(tilesNew&&tilesScroll){tilesNew.scrollLeft=tilesScroll[0];tilesNew.scrollTop=tilesScroll[1]}
  root.querySelectorAll('.wk-day').forEach(d=>{const l=d.querySelector('.wk-items');if(l&&itemScroll[d.dataset.day])l.scrollTop=itemScroll[d.dataset.day]});
  const focusEl=Weekly.pdfOpen?(root.querySelector('.wk-dialog [aria-checked="true"]')&&(!focusSel||!root.querySelector('.wk-dialog '+focusSel))?root.querySelector('.wk-dialog [aria-checked="true"]'):root.querySelector('.wk-dialog '+focusSel)):(focusSel&&root.querySelector(focusSel));
  if(focusEl)focusEl.focus({preventScroll:true});
}

function wkPdfRows(scope){
  const data=wkData(),weeks=scope==='month'?wkMonthMondays(Weekly.monday):[Weekly.monday],first=Weekly.monday;
  const rows=[[scope==='month'?'CALENDARIO DE MANTENIMIENTO · '+WK_MESES[first.getMonth()].toUpperCase()+' '+first.getFullYear():'CALENDARIO SEMANAL DE MANTENIMIENTO','',3]];
  weeks.forEach(mon=>{
    const info=wkWeekInfo(mon),days=[];
    for(let i=0;i<7;i++){const d=wkAddDays(mon,i);days.push({title:WK_DIA[d.getDay()]+' '+d.getDate()+' '+WK_MES[d.getMonth()],items:(data[wkKey(d)]||[]).map(m=>wkLabel(m.code)+' · '+m.name)})}
    rows.push(['Semana '+info.weekNum+' · '+info.month+'  —  '+info.range,days,6]);
  });
  return rows;
}
async function wkGeneratePdf(){
  const scope=Weekly.pdfScope,mon=Weekly.monday;
  const name=scope==='month'?'CALENDARIO-MES-'+mon.getFullYear()+pad(mon.getMonth()+1)+'.pdf':'CALENDARIO-SEMANA-'+wkKey(mon).replaceAll('-','')+'.pdf';
  Weekly.pdfOpen=false;renderWeekly();
  try{
    const blob=buildPdf(wkPdfRows(scope),null,{orientation:'landscape'});
    LastExports.length=0;
    const mode=await exportReport(blob,name,PDF_MIME);
    Weekly.pdfReady=true;renderWeekly();
    toast(mode==='android-saved'?'PDF guardado en Descargas/Chiaplast':'PDF generado.');
  }catch(e){toast(e&&e.message?e.message:'No se pudo generar el PDF.')}
}

(function wkBindEvents(){
  const root=$('wkRoot');if(!root)return;
  const tileOf=el=>{const t=el&&el.closest('.wk-tile');return t?{code:t.dataset.code,name:t.dataset.name}:null};
  const clearOver=()=>root.querySelectorAll('.wk-day.is-over').forEach(d=>d.classList.remove('is-over'));
  root.addEventListener('click',e=>{
    const b=e.target.closest('[data-wk]');if(!b||!root.contains(b))return;
    const a=b.dataset.wk;
    if(a==='backdrop'){if(e.target===b){Weekly.pdfOpen=false;renderWeekly()}return}
    if(a==='prev')wkShift(-1);
    else if(a==='next')wkShift(1);
    else if(a==='today')wkGoToday();
    else if(a==='area'){Weekly.area=b.dataset.code;renderWeekly()}
    else if(a==='tile'){const m=tileOf(b);Weekly.sel=wkSame(Weekly.sel,m)?null:m;renderWeekly()}
    else if(a==='place'){if(Weekly.sel)wkAdd(b.dataset.day,Weekly.sel)}
    else if(a==='remove')wkRemove(b.dataset.day,{code:b.dataset.code,name:b.dataset.name});
    else if(a==='pdf'){Weekly.pdfOpen=true;Weekly.pdfScope='week';renderWeekly()}
    else if(a==='scope'){Weekly.pdfScope=b.dataset.scope;renderWeekly()}
    else if(a==='close'){Weekly.pdfOpen=false;renderWeekly();const p=root.querySelector('.wk-pdfbtn');if(p)p.focus()}
    else if(a==='generate')wkGeneratePdf();
    else if(a==='share')shareLast(0);
  });
  root.addEventListener('dragstart',e=>{
    const m=tileOf(e.target);if(!m)return;
    Weekly.drag=m;
    try{e.dataTransfer.setData('text/plain',m.code+'|'+m.name);e.dataTransfer.effectAllowed='copy'}catch(_){}
    const w=root.querySelector('.wk');if(w)w.classList.add('is-dragging');
  });
  root.addEventListener('dragend',()=>{Weekly.drag=null;clearOver();const w=root.querySelector('.wk');if(w)w.classList.remove('is-dragging')});
  root.addEventListener('dragover',e=>{
    const day=e.target.closest('.wk-day');if(!day||!Weekly.drag)return;
    e.preventDefault();try{e.dataTransfer.dropEffect='copy'}catch(_){}
    if(!day.classList.contains('is-over')){clearOver();day.classList.add('is-over')}
  });
  root.addEventListener('dragleave',e=>{const day=e.target.closest('.wk-day');if(day&&!day.contains(e.relatedTarget))day.classList.remove('is-over')});
  root.addEventListener('drop',e=>{
    const day=e.target.closest('.wk-day');if(!day)return;
    e.preventDefault();
    let m=Weekly.drag;
    if(!m){try{const [code,...rest]=e.dataTransfer.getData('text/plain').split('|');if(MACHINE_DB[code]&&rest.length)m={code,name:rest.join('|')}}catch(_){}}
    Weekly.drag=null;clearOver();
    if(m)wkAdd(day.dataset.day,m);
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&Weekly.pdfOpen){Weekly.pdfOpen=false;renderWeekly()}});
})();
