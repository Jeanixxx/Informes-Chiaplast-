/* Mapa único de claves de almacenamiento. Los valores son los que ya usa la app:
   no cambia ningún formato guardado. Todo acceso a localStorage/IndexedDB usa estos nombres. */
const KEYS={
  session:'mtto_session',user:'mtto_user',signatureNames:'mtto_signature_names',
  history:'mtto_hist',preventiveDrafts:'mtto_preventive_drafts',dailyBatch:'mtto_daily_batch',
  kanban:'mtto_kanban',reminders:'mtto_reminders',preventiveCalendar:'mtto_preventive_calendar',
  folioCounter:'mtto_folio_counter_v1',folioYear:'mtto_folio_year_v1',specialWorks:'chiaplast_special_works_v1',
  pmBoardPrefix:'mtto_pm_board_',schemaVersion:'mtto_schema_version',
  idb:{partsPhotos:'chiaplast-parts-photos-v1',notes:'chiaplast-notes-v1'},
  /* Claves por área/máquina */
  draft:(daily,code,name)=>(daily?'mtto_draft_daily':'mtto_draft')+'_'+String(code||'AREA')+'_'+String(name||'GENERAL').replace(/[^a-z0-9_-]/gi,'_'),
  parts:(code,name)=>'mtto_parts_'+[code||'AREA',name||'MAQUINA'].join('_').replace(/[^a-z0-9_-]/gi,'_'),
  pmEvidence:(code,name)=>'pm-evidence-'+[code||'AREA',name||'MAQUINA'].join('_').replace(/[^a-z0-9_-]/gi,'_'),
  partsPhotos:(code,name)=>'parts-photos-'+[code||'AREA',name||'MAQUINA'].join('_').replace(/[^a-z0-9_-]/gi,'_')
};

/* Versión del esquema guardado. Al cambiar un formato: subir STORAGE_VERSION y agregar su migración. */
const STORAGE_VERSION=1;
const STORAGE_MIGRATIONS={}; // ej.: {2:()=>{...convierte datos de v1 a v2...}}
function runStorageMigrations(){
  let v=Number(store.get(KEYS.schemaVersion,'0'))||0;const from=v;
  while(v<STORAGE_VERSION){
    v++;const m=STORAGE_MIGRATIONS[v];
    if(m){try{m()}catch(e){return}}
  }
  if(v!==from)store.set(KEYS.schemaVersion,String(v));
}
