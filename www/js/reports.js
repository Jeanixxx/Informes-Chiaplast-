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
  if(Bridge.has('saveReport')){
    const b64=await blobBase64(blob);
    if(Bridge.saveReport(name,mime,b64)!=='ok')throw new Error('No se pudo guardar el reporte en el dispositivo.');
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
  const key=KEYS.folioCounter;let n=Number(store.get(key,'0'));if(!Number.isSafeInteger(n)||n<0)n=0;
  const date=new Date(),year=date.getFullYear();
  const yearKey=KEYS.folioYear,oldYear=Number(store.get(yearKey,'0'));
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
    const productionRow=rows.find(q=>/^encargado de producción$/i.test(String(q[0]||'')));
    add('CCM · Nombre',ccmNameRow?ccmNameRow[1]:'',5,6,24);
    add('Firma CCM','____________________________________________',7,7,30);
    add('Responsable · Nombre',responsableRow?responsableRow[1]:'',5,6,24);
    add('Firma Responsable','____________________________________________',7,7,30);
    add('Encargado de producción · Nombre',productionRow?productionRow[1]:'',5,6,24);
    add('Firma Encargado de producción','____________________________________________',7,7,30);
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
    +f(0,11,'FF172B3A')+f(1,11,'FF172B3A')+f(1,11,'FFFFFFFF')+f(1,18,'FFFFFFFF')+f(1,11,'FF13804A')+f(1,11,'FFB3261E')+f(1,11,'FF176B45')+f(0,11,'FF7A8791')+f(0,9,'FF7A8791',1)
    +'</fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'+fill('FF172B3A')+fill('FFEAF0F4')+fill('FF23865A')+'</fills>'
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
  const STEEL='0.09 0.17 0.23',ACC='0.14 0.53 0.35',LINE='0.82 0.86 0.89',LIGHT='0.92 0.94 0.96';
  const COL={ok:'0.07 0.50 0.29',bad:'0.70 0.15 0.12',warn:'0.14 0.42 0.29',na:'0.48 0.53 0.57','':'0.09 0.17 0.23'};
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
    if(photoRows.length)newPage();
    ensure(150);y+=20;
    R(M,y,CW,20,STEEL);T(M+8,y+14,'Firmas de conformidad',10,true,'1 1 1');y+=20;
    const gap=8,boxW=(CW-gap*2)/3,boxH=112,leftX=M,middleX=M+boxW+gap,rightX=M+(boxW+gap)*2;
    R(leftX,y,boxW,boxH,'1 1 1',LINE);R(middleX,y,boxW,boxH,'1 1 1',LINE);R(rightX,y,boxW,boxH,'1 1 1',LINE);
    const ccmRow=rows.find(q=>/^(responsable de ccm|nombre de quien valida \(ccm\))$/i.test(String(q[0]||'')));
    const respRow=rows.find(q=>/^responsable$/i.test(String(q[0]||'')));
    const productionRow=rows.find(q=>/^encargado de producción$/i.test(String(q[0]||'')));
    const signatureBoxes=[
      {x:leftX,title:'CCM',name:(sig&&sig.ccm&&sig.ccm.name)||(ccmRow?ccmRow[1]:''),image:'SigCCM',hex:sig&&sig.ccm&&sig.ccm.hex,caption:'Nombre y firma de CCM'},
      {x:middleX,title:'Responsable',name:(sig&&sig.responsable&&sig.responsable.name)||(respRow&&respRow[1])||'',image:'SigResp',hex:sig&&sig.responsable&&sig.responsable.hex,caption:'Nombre y firma del responsable'},
      {x:rightX,title:'Encargado de producción',name:(sig&&sig.production&&sig.production.name)||(productionRow&&productionRow[1])||'',image:'SigProduction',hex:sig&&sig.production&&sig.production.hex,caption:'Nombre y firma de producción'}
    ];
    signatureBoxes.forEach(box=>{
      T(box.x+7,y+18,box.title,8.5,true,STEEL);
      const nm=pdfWrap(box.name,boxW-14,8.2,true)[0]||'';T(box.x+7,y+34,nm,8.2,true,COL['']);
      if(box.hex){sigPage=pages.length-1;ops.push('q 82 0 0 30 '+(box.x+7)+' '+(H-y-68-30).toFixed(2)+' cm /'+box.image+' Do Q')}
      ops.push(LINE+' RG 0.8 w '+(box.x+8)+' '+(H-y-76)+' m '+(box.x+boxW-8)+' '+(H-y-76)+' l S');
      T(box.x+7,y+94,box.caption,6.5,false,COL.na);
    });
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
  const photoStartId=5+pages.length*2+1,sigCcmId=sig&&sig.ccm&&sig.ccm.hex?photoStartId+photoRows.length:0,sigRespId=sig&&sig.responsable&&sig.responsable.hex?photoStartId+photoRows.length+(sigCcmId?1:0):0,sigProductionId=sig&&sig.production&&sig.production.hex?photoStartId+photoRows.length+(sigCcmId?1:0)+(sigRespId?1:0):0,refs=[];
  pages.forEach((p,i)=>{
    const pid=objs.length+1,cid=pid+1;refs.push(pid+' 0 R');
    const xo=[];if(i===sigPage&&sigCcmId)xo.push('/SigCCM '+sigCcmId+' 0 R');if(i===sigPage&&sigRespId)xo.push('/SigResp '+sigRespId+' 0 R');if(i===sigPage&&sigProductionId)xo.push('/SigProduction '+sigProductionId+' 0 R');if(pagePhotoRefs[i]!==undefined)xo.push('/Img1 '+(photoStartId+pagePhotoRefs[i])+' 0 R');
    add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>'+(xo.length?' /XObject << '+xo.join(' ')+' >>':'')+' >> /Contents '+cid+' 0 R >>');
    const stream=p.join('\n');add('<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream');
  });
  objs[1]='<< /Type /Pages /Kids ['+refs.join(' ')+'] /Count '+pages.length+' >>';
  photoRows.forEach(r=>{const bin=atob(r[1].split(',')[1]);let hex='';for(let i=0;i<bin.length;i++)hex+=bin.charCodeAt(i).toString(16).padStart(2,'0');const dim=photoDimensions(r[1]);add('<< /Type /XObject /Subtype /Image /Width '+dim.w+' /Height '+dim.h+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length '+(hex.length+1)+' >>\nstream\n'+hex+'>\nendstream')});
  if(sigCcmId){const z=sig.ccm,d=z.hex+'>';add('<< /Type /XObject /Subtype /Image /Width '+z.w+' /Height '+z.h+' /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length '+d.length+' >>\nstream\n'+d+'\nendstream')}
  if(sigRespId){const z=sig.responsable,d=z.hex+'>';add('<< /Type /XObject /Subtype /Image /Width '+z.w+' /Height '+z.h+' /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length '+d.length+' >>\nstream\n'+d+'\nendstream')}
  if(sigProductionId){const z=sig.production,d=z.hex+'>';add('<< /Type /XObject /Subtype /Image /Width '+z.w+' /Height '+z.h+' /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length '+d.length+' >>\nstream\n'+d+'\nendstream')}
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
async function resolveReportEvidence(rows){
 const out=[];
 for(const row of rows){
  if(row[2]!==5||typeof row[1]!=='string'||!row[1]){out.push(row);continue}
  const src=row[1];
  if(src.startsWith('data:image/jpeg;base64,')){out.push(row);continue}
  if(src.includes('/evidence/')){
   try{const response=await fetch(src);if(!response.ok)throw new Error('HTTP '+response.status);const jpeg=await resizeNoteImage(await response.blob());out.push([row[0],jpeg,row[2]])}
   catch(e){throw new Error('No se pudo incorporar la fotografía '+String(row[0]).replace('__PHOTO__','')+' al reporte. Abra el borrador y vuelva a adjuntarla.')}
   continue;
  }
  out.push(row);
 }
 return out;
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
    if(!isDaily()){
      if(!$('releaseMachineStatus').value){$('releaseMachineStatus').focus();throw new Error('Indica cómo funciona la máquina en la línea antes de liberar.')}
      updateReleaseField();appendFinalReleaseRows();Runtime.release.status='released';saveDraft();
    }
    const resolvedRows=await resolveReportEvidence(Runtime.rows.slice(1));
    const exportRows=singleReportDoc(resolvedRows,[]);
    const results=await generateExports(exportRows,baseName,selectedExport('exportChoice'),isDaily()?null:{ccm:Signatures.ccm,responsable:Signatures.responsable,production:Signatures.production});
    showDone(results,'Reporte generado');
    addRecent({id:currentReportFolio,folio:currentReportFolio,n:results.map(r=>r.name).join(', '),files:results.map(r=>({name:r.name,format:r.format,mime:r.format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a:Runtime.area,m:Runtime.machine||'',w:fmtD($('d').value)+' '+$('t').value,k:Runtime.checkType,rows:exportRows});
    store.del(draftStorageKey());store.set(KEYS.preventiveDrafts,JSON.stringify(draftIndex().filter(x=>x.key!==draftStorageKey())));renderSavedPreventiveDraftCount();buzz([20,50,20]);history.replaceState({s:'done'},'');show('done');
  }catch(e){toast(e.message||'No se pudo generar el archivo.');buzz([30,40,30])}
  finally{b.disabled=false;b.textContent='Generar reporte'}
}
