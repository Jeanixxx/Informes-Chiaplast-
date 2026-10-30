/* Puente con Android (Kotlin). Contrato: window.ChiaplastNative, expuesto por MainActivity.kt.
   Toda llamada nativa pasa por aquí; las llamadas conservan `this` del objeto nativo. */
const Bridge=(()=>{
  const native=()=>window.ChiaplastNative;
  const api={
    get available(){return !!native()},
    has(method){const n=native();return !!(n&&typeof n[method]==='function')}
  };
  ['scheduleReminder','cancelReminder','saveReport','shareReport','openSavedReport','printHtmlReport','deleteEvidence','takePhoto','pickPhoto']
    .forEach(m=>{api[m]=(...args)=>native()[m](...args)});
  return api;
})();
