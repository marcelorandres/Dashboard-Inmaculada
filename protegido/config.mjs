// Configuración pública (sin secretos). Rutas: {data_dir}/{UUID}.json leído por raw.githubusercontent.com.
// Modo de PRUEBA local: si config-public.json trae "local_base" Y la página se sirve desde localhost/127.0.0.1/[::1],
// los snapshots se leen de esa carpeta relativa a la raíz del sitio ({local_base}/{UUID}.json y {local_base}/index.json).
// En producción config-public.json no trae local_base.
const response=await fetch(new URL('config-public.json',import.meta.url),{cache:'no-store',credentials:'omit'});
if(!response.ok)throw Error('Falta config-public.json');
export const WEB_CONFIG=await response.json();
if(['owner','repo','branch','data_dir'].some(k=>typeof WEB_CONFIG[k]!=='string'||WEB_CONFIG[k].includes('CAMBIAR_')))throw Error('Configura la cuenta y repositorio antes de publicar');
const path=WEB_CONFIG.data_dir.split('/').map(encodeURIComponent).join('/');
export const LOCAL=typeof WEB_CONFIG.local_base==='string'&&['localhost','127.0.0.1','[::1]'].includes(location.hostname);
const local=name=>new URL(WEB_CONFIG.local_base.replace(/\/+$/,'')+'/'+name,new URL('../',import.meta.url)).href;
export const rawUrl=client=>LOCAL?local(encodeURIComponent(client)+'.json'):'https://raw.githubusercontent.com/'+encodeURIComponent(WEB_CONFIG.owner)+'/'+encodeURIComponent(WEB_CONFIG.repo)+'/'+encodeURIComponent(WEB_CONFIG.branch)+'/'+path+'/'+encodeURIComponent(client)+'.json';
export const listUrl=()=>LOCAL?local('index.json'):'https://api.github.com/repos/'+encodeURIComponent(WEB_CONFIG.owner)+'/'+encodeURIComponent(WEB_CONFIG.repo)+'/contents/'+path+'?ref='+encodeURIComponent(WEB_CONFIG.branch);
