/* Mapa único de claves de almacenamiento. Los valores son los que ya usa la app:
   no cambia ningún formato guardado. Todo acceso a localStorage/IndexedDB usa estos nombres. */
const KEYS={
  session:'mtto_session',user:'mtto_user',signatureNames:'mtto_signature_names',
  history:'mtto_hist',preventiveDrafts:'mtto_preventive_drafts',dailyBatch:'mtto_daily_batch',
  kanban:'mtto_kanban',reminders:'mtto_reminders',preventiveCalendar:'mtto_preventive_calendar',
  weeklyCalendar:'mtto_weekly_calendar_v1',backupV1:'mtto_backup_v1',sidebarCollapsed:'mtto_sidebar_collapsed',
  folioCounter:'mtto_folio_counter_v1',folioYear:'mtto_folio_year_v1',specialWorks:'chiaplast_special_works_v1',
  pmBoardPrefix:'mtto_pm_board_',schemaVersion:'mtto_schema_version',
  idb:{partsPhotos:'chiaplast-parts-photos-v1',notes:'chiaplast-notes-v1'},
  /* Claves por área/máquina */
  draft:(daily,code,name)=>(daily?'mtto_draft_daily':'mtto_draft')+'_'+String(code||'AREA')+'_'+String(name||'GENERAL').replace(/[^a-z0-9_-]/gi,'_'),
  parts:(code,name)=>'mtto_parts_'+[code||'AREA',name||'MAQUINA'].join('_').replace(/[^a-z0-9_-]/gi,'_'),
  pmEvidence:(code,name)=>'pm-evidence-'+[code||'AREA',name||'MAQUINA'].join('_').replace(/[^a-z0-9_-]/gi,'_'),
  partsPhotos:(code,name)=>'parts-photos-'+[code||'AREA',name||'MAQUINA'].join('_').replace(/[^a-z0-9_-]/gi,'_')
};

/* Versión del esquema guardado. Al cambiar un formato: subir STORAGE_VERSION y agregar su migración.
   Cada migración puede ser asíncrona y debe ser idempotente: si falla, la versión no avanza
   y se vuelve a intentar en el siguiente arranque. */
const STORAGE_VERSION=2;
const STORAGE_MIGRATIONS={
  /* v1 → v2: catálogo único de máquinas (machines.js). Aplica MACHINE_RENAMES y PM_BOARD_RENAMES a
     borradores, refacciones, fotos (IndexedDB), lista de borradores, lote diario y tablero mensual.
     No toca el historial (mtto_hist). Nunca sobrescribe una clave nueva que ya exista. */
  2:async()=>{
    const json=(k,d)=>{try{const v=JSON.parse(store.get(k,'null'));return v==null?d:v}catch(e){return d}};
    const boardKeys=[];
    try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.indexOf(KEYS.pmBoardPrefix)===0)boardKeys.push(k)}}catch(e){}
    const machineKeys=MACHINE_RENAMES.flatMap(r=>[KEYS.draft(false,r.from.code,r.from.name),KEYS.draft(true,r.from.code,r.from.name),KEYS.parts(r.from.code,r.from.name)]);

    /* 1. Respaldo previo de todo lo que puede cambiar (se conserva el primero que se hizo). */
    if(store.get(KEYS.backupV1,null)===null){
      const saved={};
      [...machineKeys,KEYS.preventiveDrafts,KEYS.dailyBatch,...boardKeys].forEach(k=>{const v=store.get(k,null);if(v!==null)saved[k]=v});
      if(Object.keys(saved).length&&!store.set(KEYS.backupV1,JSON.stringify({created:new Date().toISOString(),fromVersion:1,keys:saved})))throw new Error('No se pudo guardar el respaldo v1.');
    }

    /* 2. Claves de localStorage por máquina (borradores y refacciones). */
    const retag=(o,to)=>{if(o&&typeof o==='object'){o.code=to.code;o.machine=to.name;o.area=MACHINE_DB[to.code].area;if('c' in o)o.c=to.code}return o};
    MACHINE_RENAMES.forEach(r=>{
      [[KEYS.draft(false,r.from.code,r.from.name),KEYS.draft(false,r.to.code,r.to.name),true],
       [KEYS.draft(true,r.from.code,r.from.name),KEYS.draft(true,r.to.code,r.to.name),true],
       [KEYS.parts(r.from.code,r.from.name),KEYS.parts(r.to.code,r.to.name),false]].forEach(([oldK,newK,isDraft])=>{
        const raw=store.get(oldK,null);
        if(raw===null||oldK===newK||store.get(newK,null)!==null)return;
        let value=raw;
        if(isDraft){try{value=JSON.stringify(retag(JSON.parse(raw),r.to))}catch(e){value=raw}}
        if(store.set(newK,value)&&store.get(newK,null)===value)store.del(oldK);
      });
    });

    /* 3. Lista de borradores preventivos y lote diario: code/machine/area dentro de cada registro. */
    const drafts=json(KEYS.preventiveDrafts,[]);
    if(Array.isArray(drafts)){
      let changed=false;const seen=new Set();
      const next=drafts.map(x=>{
        if(!x)return x;const cur=machineCurrent(x.code,x.machine);
        if(cur.code===x.code&&cur.name===x.machine)return x;
        changed=true;return {...retag({...x},{code:cur.code,name:cur.name}),key:KEYS.draft(false,cur.code,cur.name)};
      }).filter(x=>{if(!x||!x.key)return true;if(seen.has(x.key)){changed=true;return false}seen.add(x.key);return true});
      if(changed)store.set(KEYS.preventiveDrafts,JSON.stringify(next));
    }
    const batch=json(KEYS.dailyBatch,[]);
    if(Array.isArray(batch)){
      let changed=false;
      batch.forEach(rep=>{
        if(!rep)return;const cur=machineCurrent(rep.code,rep.machine);
        if(cur.code===rep.code&&cur.name===rep.machine)return;
        changed=true;retag(rep,cur);if(rep.draft&&typeof rep.draft==='object')retag(rep.draft,cur);
      });
      if(changed)store.set(KEYS.dailyBatch,JSON.stringify(batch));
    }

    /* 4. Tablero mensual: ids zona:clave. */
    boardKeys.forEach(k=>{
      const v=json(k,null);if(!v||!v.done||typeof v.done!=='object')return;
      let changed=false;
      Object.keys(PM_BOARD_RENAMES).forEach(oldId=>{
        const newId=PM_BOARD_RENAMES[oldId];
        if(!Object.prototype.hasOwnProperty.call(v.done,oldId)||Object.prototype.hasOwnProperty.call(v.done,newId))return;
        v.done[newId]=v.done[oldId];delete v.done[oldId];changed=true;
      });
      if(changed)store.set(k,JSON.stringify(v));
    });

    /* 5. Fotos en IndexedDB: copiar a la clave nueva, comprobar la copia y solo entonces borrar la original. */
    if(!('indexedDB' in window))return;
    const db=await openPartsPhotosDB();
    const req=(r)=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
    const done=tx=>new Promise((res,rej)=>{tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error)});
    try{
      for(const r of MACHINE_RENAMES){
        for(const fn of [KEYS.pmEvidence,KEYS.partsPhotos]){
          const oldK=fn(r.from.code,r.from.name),newK=fn(r.to.code,r.to.name);
          if(oldK===newK)continue;
          let tx=db.transaction('photos','readonly');
          const [oldRec,newRec]=await Promise.all([req(tx.objectStore('photos').get(oldK)),req(tx.objectStore('photos').get(newK))]);
          await done(tx);
          if(!oldRec||newRec)continue;
          tx=db.transaction('photos','readwrite');tx.objectStore('photos').put({...oldRec,key:newK});await done(tx);
          tx=db.transaction('photos','readonly');const copy=await req(tx.objectStore('photos').get(newK));await done(tx);
          if(!copy)throw new Error('No se pudo comprobar la copia de '+oldK+'.');
          tx=db.transaction('photos','readwrite');tx.objectStore('photos').delete(oldK);await done(tx);
        }
      }
    }finally{db.close()}
  }
};
async function runStorageMigrations(){
  let v=Number(store.get(KEYS.schemaVersion,'0'))||0;const from=v;
  while(v<STORAGE_VERSION){
    const m=STORAGE_MIGRATIONS[v+1];
    if(m){try{await m()}catch(e){break}}
    v++;
  }
  if(v!==from)store.set(KEYS.schemaVersion,String(v));
}
