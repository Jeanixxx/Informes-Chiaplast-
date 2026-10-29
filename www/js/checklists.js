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
