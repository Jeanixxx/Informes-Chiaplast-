/* Catálogo único de máquinas: lo comparten chequeo diario, mantenimiento preventivo,
   trabajos especiales, tablero mensual y calendario semanal.
   - La clave de cada área (CAM, IMP, DIM, BSL, E1, E2) es el código interno que usan los datos
     guardados; `label` es lo que se muestra en pantalla.
   - `entries` es la lista oficial (93 entradas). Un grupo ({name, units}) cuenta como UNA entrada:
     el calendario muestra una tarjeta y el chequeo/preventivo eligen la unidad.
   - `machines` se deriva de `entries` (unidades sueltas) para los flujos que eligen una máquina.
   - `board` describe la disposición del tablero mensual (zona, columnas y tamaño de los grupos).
   - La identidad de un equipo es área + nombre: hay una FLEJADORA en CAM y otra en BSL. */
const MACHINE_DB={
  CAM:{area:'CAM',label:'CAM',board:{zone:'CAM',cols:4},entries:['BK-1','BK-2','BK-3','BK-4','BK-5','BK-6','BK-7','BK-8','BNG-1','BNG-2','BC-1','FLEJADORA']},
  IMP:{area:'IMP',label:'IMP',board:{zone:'IMP',cols:3},entries:['IMP-1','IMP-2','IMP-3']},
  DIM:{area:'DIM',label:'DIM',board:{zone:'DIM',cols:4},entries:['BM-1','BM-2','BM-3','BM-4','BM-5','BD-1','BD-2','BD-3','FLEJADORA-1','FLEJADORA-2',
    {name:'HORNOS ×5',group:'HORNOS',span:4,cols:5,units:['HORNO-1','HORNO-2','HORNO-3','HORNO-4','HORNO-5']},
    {name:'SELLADORAS ×5',group:'SELLADORAS',span:4,cols:5,units:['SELLADORA M1','SELLADORA M2','SELLADORA M3','SELLADORA M4','SELLADORA M5']}]},
  BSL:{area:'BSL',label:'BSL',board:{zone:'BSL',cols:4},entries:['BW-1','BN-1','BN-2','BN-3','BN-4','B-06','B-02','B-03','BD-4','BSL-1','BSL-2','BSL-3','BSL-4','BSL-5','BSL-6','FLEJADORA','ELEVADOR']},
  E1:{area:'Extrusión 1',label:'EXT1',board:{zone:'EXT1',cols:7},entries:['EXT-19','ECB-1','CRI-3','CRI-4','CRI-5','EXT-6','EXT-7','EXT-8','EXT-9','EXT-10','EXT-11','EXT-12','EXT-13','EXT-14','EXT-15','EXT-16','EXT-17','EXT-20','EXT-21','EXT-22','EXT-A1','EXT-A2','EXT-N1','EXT-N2','EXT-A3','RF-1','RF-2','FUELLADORA 1','FUELLADORA 2','SILO 1','SILO 2','SILO 3']},
  E2:{area:'Extrusión 2',label:'EXT2',board:{zone:'EXT2',cols:7},entries:['EXT-A4','EXT-A5','EXT-A6','EXT-A7','EXT-A8','EXT-A9','EXT-A10','EXT-A11','EXT-A12','EXT-A13','EXT-N3','EXT-N4','EXT-N5','EXT-N6','EXT-N7','CRI-1','CRI-2']}
};
Object.values(MACHINE_DB).forEach(a=>{a.machines=a.entries.flatMap(e=>typeof e==='string'?[e]:e.units.slice())});
const machineEntryName=e=>typeof e==='string'?e:e.name;

/* Renombres del catálogo v1 → v2 (los aplica STORAGE_MIGRATIONS[2] en keys.js). */
const MACHINE_RENAMES=[
  {from:{code:'E1',name:'RF'},to:{code:'E1',name:'RF-1'}},
  {from:{code:'E1',name:'FUELLADORA'},to:{code:'E1',name:'FUELLADORA 1'}},
  {from:{code:'DIM',name:'FLEJADORA'},to:{code:'DIM',name:'FLEJADORA-1'}},
  {from:{code:'DIM',name:'HORNO M'},to:{code:'DIM',name:'HORNO-1'}},
  {from:{code:'CAM',name:'IMP-1'},to:{code:'IMP',name:'IMP-1'}},
  {from:{code:'CAM',name:'IMP-2'},to:{code:'IMP',name:'IMP-2'}},
  {from:{code:'CAM',name:'IMP-3'},to:{code:'IMP',name:'IMP-3'}}
];
/* Ids del tablero mensual (zona:clave) que cambian. CAM:BC-1#2 no se migra: deja de mostrarse. */
const PM_BOARD_RENAMES={
  'CAM:IMP-1':'IMP:IMP-1','CAM:IMP-2':'IMP:IMP-2','CAM:IMP-3':'IMP:IMP-3',
  'DIM:HORNO-M-1':'DIM:HORNO-1','DIM:HORNO-M-2':'DIM:HORNO-2','DIM:HORNO-M-3':'DIM:HORNO-3','DIM:HORNO-M-4':'DIM:HORNO-4',
  'DIM:SELLADORA-1':'DIM:SELLADORA M1','DIM:SELLADORA-2':'DIM:SELLADORA M2','DIM:SELLADORA-3':'DIM:SELLADORA M3','DIM:SELLADORA-4':'DIM:SELLADORA M4','DIM:SELLADORA-5':'DIM:SELLADORA M5',
  'EXT1:RF':'EXT1:RF-1','EXT1:RF 2':'EXT1:RF-2','EXT1:FUELLADORA':'EXT1:FUELLADORA 1'
};
/* Devuelve el área/nombre vigente de un equipo guardado con el catálogo anterior. */
function machineCurrent(code,name){
  const r=MACHINE_RENAMES.find(x=>x.from.code===code&&x.from.name===name);
  return r?{code:r.to.code,name:r.to.name}:{code,name};
}
