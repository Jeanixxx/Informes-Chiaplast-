const $=id=>document.getElementById(id);
/* Utilidades */
function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),2400)}
function buzz(n){try{navigator.vibrate&&navigator.vibrate(n||15)}catch(e){}}
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const fmtD=v=>{if(!v)return'—';const[y,m,d]=v.split('-');return d+'/'+m+'/'+y};
const pad=n=>String(n).padStart(2,'0');
