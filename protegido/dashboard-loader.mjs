// Cargador del dashboard (kit, adaptado): la plantilla se descifra UNA vez; los snapshots se envían por postMessage al iframe aislado.
import {decryptEnvelope,MAX_PLANTILLA} from './protocol.mjs';
let generation=0,ready=false,current=null,htmlLoaded=false;
const frame=()=>document.getElementById('dashboard-frame');
const notify=(state,message,extra={})=>document.dispatchEvent(new CustomEvent('wpc-dashboard-status',{detail:{state,message,...extra}}));
// Política de contenido del iframe: sin red (solo recursos incrustados), sin formularios ni frames anidados.
const CSP="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src data: blob:; worker-src blob:; form-action 'none'; frame-src 'none'";
function send(){if(ready&&current&&frame()?.contentWindow)frame().contentWindow.postMessage({type:'wpc-cloud-snapshot',archive:current.archive,operation:current.operation},'*');}
window.addEventListener('message',event=>{
 if(event.source!==frame()?.contentWindow)return;
 const message=event.data;
 if(message?.type==='wpc-cloud-ready'){ready=true;send();}
 else if(message?.operation===current?.operation&&message.type==='wpc-cloud-applied')notify('applied','Datos de HidroLog actualizados · '+message.holes+' sondaje(s) en 3D'+(message.withoutCollar?' · '+message.withoutCollar+' sin 3D (collar incompleto o fuera del plan 2802)':''),{holes:message.holes,withoutCollar:message.withoutCollar,notLocated:message.notLocated});
 else if(message?.type==='wpc-cloud-error'&&(message.operation===null||message.operation===current?.operation))notify('error',message.message);
});
export function bloquearDashboard(){generation++;ready=false;current=null;htmlLoaded=false;const f=frame();if(f){f.srcdoc='';f.hidden=true;}}
export async function aplicarDashboard(payload,material){
 const token=++generation;
 if(!payload.archive){notify('error','Esta publicación antigua no incluye la copia completa. Vuelve a subir desde HidroLog actualizado.');return;}
 current={archive:payload.archive,operation:payload.published_at+':'+payload.project.snapshot_hash};
 if(htmlLoaded){send();return;}
 notify('info','Abriendo dashboard de seguimiento…');
 try{
  const response=await fetch(new URL('dashboard-template.enc.json',import.meta.url),{cache:'no-store',credentials:'omit'});
  if(!response.ok)throw Error('No se pudo descargar la plantilla del dashboard.');
  const result=await decryptEnvelope(await response.json(),material,{max:MAX_PLANTILLA});
  if(token!==generation)return;
  if(typeof result.project.html_gzip_base64!=='string')throw Error('Plantilla no compatible.');
  const bytes=Uint8Array.from(atob(result.project.html_gzip_base64),c=>c.charCodeAt(0));
  const html=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  if(token!==generation)return;
  const f=frame();f.setAttribute('csp',CSP);f.srcdoc=html;f.hidden=false;htmlLoaded=true;
 }catch(error){if(token===generation)notify('error',error.message);}
}
