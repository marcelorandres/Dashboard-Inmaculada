// Protocolo del kit (hidrolog-nube-v1). Cambio respecto al kit: el límite de ciphertext es un parámetro.
// Proyectos/snapshots: 20 MB (igual que el emisor). Plantilla del dashboard (25 MB con geometría 3D): MAX_PLANTILLA.
export const ITERATIONS=600000;
export const MAX_PROYECTO=20000000;
export const MAX_PLANTILLA=64000000; // debe coincidir con MAX_PLANTILLA de 00 Code/Nube/cifrar_plantilla.py
export const base64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export function validateEnvelope(e,max=MAX_PROYECTO){
  if(e?.format!=='hidrolog-demo-encrypted'||e.version!==1||!(/^(?:a|b|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.test(e.client))||e.iterations!==ITERATIONS||!/^[0-9a-f-]{36}$/.test(e.operation_id))throw Error('Formato no compatible');
  if(base64(e.salt).length!==16||base64(e.iv).length!==12||base64(e.ciphertext).length>max)throw Error('Tamaño no válido');
}
export async function importPassword(password){return crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);}
export async function decryptEnvelope(envelope,material,{max=MAX_PROYECTO}={}){
  validateEnvelope(envelope,max);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:base64(envelope.salt),iterations:ITERATIONS},material,{name:'AES-GCM',length:256},false,['decrypt']);
  const aad=new TextEncoder().encode('hidrolog-nube-v1:'+envelope.client+':'+envelope.operation_id);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:base64(envelope.iv),additionalData:aad,tagLength:128},key,base64(envelope.ciphertext));
  const result=JSON.parse(new TextDecoder().decode(plain));
  if(result.version!==1||result.project?.client!==envelope.client||!Array.isArray(result.project?.holes))throw Error('Contenido no compatible');
  for(const h of result.project.holes)for(const k of ['logged_m','max_depth_m','recovered_m','runs'])if(!Number.isFinite(h[k])||h[k]<0)throw Error('Contenido inválido');
  return result;
}
