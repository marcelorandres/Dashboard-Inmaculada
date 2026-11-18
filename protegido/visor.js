// Visor protegido en vivo. Entrada: portal (index.html). Con la clave correcta abre el dashboard a pantalla completa.
// - ?cliente=UUID abre ese proyecto; sin él se listan los proyectos publicados (API Contents del repo; 1 proyecto = se abre solo).
// - La clave solo vive en memoria (CryptoKey de PBKDF2 no extraíble). Consulta cada 30 s con la pestaña visible.
import {rawUrl,listUrl} from './config.mjs';
import {aplicarDashboard,bloquearDashboard} from './dashboard-loader.mjs';
import {decryptEnvelope,importPassword} from './protocol.mjs';
const $=id=>document.getElementById(id);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const POLL_MS=30000;
let material=null,client=null,lastOperation=null,busy=false,generation=0,opened=false,timer=null;
const requested=new URLSearchParams(location.search).get('cliente');
if(requested&&UUID.test(requested))client=requested;

const msg=(t,err)=>{$('st').textContent=t;$('st').className='estado'+(err?' err':'');};
function prog(p){$('bar').style.display='block';$('bi').style.width=Math.round(p*100)+'%';}
function toast(text,error){const t=$('toast');clearTimeout(toast.h);t.textContent=text;t.dataset.state=error?'error':'info';t.hidden=false;if(!error)toast.h=setTimeout(()=>{t.hidden=true;},5000);}

function bloquear(texto,esError){
  generation++;clearInterval(timer);timer=null;bloquearDashboard();material=null;lastOperation=null;busy=false;opened=false;
  document.body.classList.remove('visor');$('toast').hidden=true;$('lista').hidden=true;$('f').hidden=false;
  $('pw').value='';$('pw').disabled=false;$('b').disabled=false;$('bar').style.display='none';
  msg(texto||'',esError);
}

async function leerSobre(id){
  let response;
  try{response=await fetch(rawUrl(id)+'?read='+Date.now(),{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(30000)});}
  catch{const e=Error('red');e.red=true;throw e;}
  if(!response.ok){const e=Error('No disponible');e.red=response.status!==404;e.falta=response.status===404;throw e;}
  const envelope=await response.json();
  if(envelope.client!==id)throw Error('Proyecto incorrecto');
  return envelope;
}
async function descifrar(envelope,key){try{return await decryptEnvelope(envelope,key);}catch{const e=Error('clave');e.clave=true;throw e;}}
async function listar(){
  const response=await fetch(listUrl(),{credentials:'omit',signal:AbortSignal.timeout(20000)});
  if(response.status===404)return [];
  if(!response.ok){const e=Error('red');e.red=true;throw e;}
  return (await response.json()).map(f=>String(f.name).replace(/\.json$/,'')).filter(id=>UUID.test(id)).sort();
}

// Muestra el dashboard (portal oculto) y envía el snapshot al iframe.
function mostrar(payload,key){opened=true;document.body.classList.add('visor');aplicarDashboard(payload,key);}

async function elegirProyecto(ids,key){
  const box=$('lista');box.replaceChildren();
  const cabecera=document.createElement('p');cabecera.className='desc';cabecera.textContent='Selecciona el proyecto:';box.append(cabecera);
  let valido=false;
  for(const id of ids.slice(0,12)){
    try{
      const env=await leerSobre(id),payload=await descifrar(env,key);valido=true;
      const b=document.createElement('button');b.type='button';b.className='proy';b.textContent=payload.project.label||('Proyecto '+id.slice(0,8));
      b.addEventListener('click',()=>{client=id;box.hidden=true;lastOperation=env.operation_id;mostrar(payload,key);iniciarSondeo();});
      box.append(b);
    }catch(e){if(e.clave)continue;}
  }
  if(!valido){const e=Error('clave');e.clave=true;throw e;}
  $('f').hidden=true;box.hidden=false;
}

async function abrir(key){
  const version=++generation;busy=true;$('b').disabled=true;$('pw').disabled=true;prog(.1);msg('Consultando proyecto…');
  try{
    if(!client){
      const ids=await listar();
      if(!ids.length){const e=Error('vacío');e.falta=true;throw e;}
      if(ids.length>1){prog(.3);await elegirProyecto(ids,key);if(version!==generation)return;material=key;busy=false;$('bar').style.display='none';msg('');return;}
      client=ids[0];
    }
    const env=await leerSobre(client);if(version!==generation)return;
    prog(.4);msg('Descifrando…');
    const payload=await descifrar(env,key);if(version!==generation)return;
    material=key;lastOperation=env.operation_id;msg('Abriendo dashboard…');prog(.7);
    mostrar(payload,key);iniciarSondeo();
  }catch(e){
    if(version!==generation)return;
    bloquear(e.clave?'Contraseña incorrecta.':e.falta?'Todavía no se ha publicado ningún proyecto protegido.':e.red?'No se pudo consultar los datos. Comprueba la conexión.':'No se pudo abrir el contenido. Reintenta más tarde.',true);
    if(e.clave){$('pw').focus();}
  }finally{if(version===generation)busy=false;}
}

async function sondear(){
  if(!material||!client||!opened||busy||document.hidden)return;
  busy=true;const version=generation;
  try{
    const env=await leerSobre(client);if(version!==generation)return;
    if(env.operation_id!==lastOperation){
      const payload=await descifrar(env,material);if(version!==generation)return;
      lastOperation=env.operation_id;aplicarDashboard(payload,material);
    }
  }catch(e){if(version===generation)toast('Sin actualización confirmada; se conserva la última versión recibida.',true);}
  finally{if(version===generation)busy=false;}
}
function iniciarSondeo(){clearInterval(timer);timer=setInterval(sondear,POLL_MS);}

document.addEventListener('wpc-dashboard-status',e=>{
  const {state,message}=e.detail;
  if(state==='error'){if(!opened||!$('dashboard-frame').srcdoc)bloquear(message,true);else toast(message,true);}
  else if(state==='applied'){$('bar').style.display='none';toast(message,false);}
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sondear();});
window.addEventListener('pagehide',()=>bloquear(''));
$('f').addEventListener('submit',async ev=>{
  ev.preventDefault();const pass=$('pw').value;
  if(!pass){msg('Introduce la contraseña.',true);return;}
  if(!(window.crypto&&crypto.subtle)){msg('Este navegador no admite descifrado seguro (se requiere HTTPS).',true);return;}
  $('pw').value='';
  await abrir(await importPassword(pass));
});
