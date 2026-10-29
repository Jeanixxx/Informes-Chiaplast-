let storageWarningShown=false;
const store={
  get(k,d){try{const v=localStorage.getItem(k);return v===null?d:v}catch(e){return d}},
  set(k,v){
    try{localStorage.setItem(k,v);return true}
    catch(e){
      if(!storageWarningShown){
        storageWarningShown=true;
        setTimeout(()=>toast('El dispositivo no permitió guardar los datos. Exporta el reporte antes de salir.'),0);
      }
      return false;
    }
  },
  del(k){try{localStorage.removeItem(k)}catch(e){}}
};
