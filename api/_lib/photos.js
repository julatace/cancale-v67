// Secours des photos publiques des places de marché, sans transmettre la session VRM.
const TYPES = new Set(['image/jpeg','image/png','image/webp','image/avif','image/gif']);
const MAX_OCTETS = 6 * 1024 * 1024;
export function urlPhotoAdmise(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null;
    const h = u.hostname.toLowerCase();
    if (!(h==='vinted.net' || h.endsWith('.vinted.net') || h==='i.ebayimg.com'
      || h==='img.leboncoin.fr' || h==='images.leboncoin.fr')) return null;
    return u.href;
  } catch (_) { return null; }
}
export async function lirePhoto(value, fetchPhoto = fetch) {
  let url = urlPhotoAdmise(value);
  if (!url) return {status:400};
  const controle = new AbortController();
  const timer = setTimeout(()=>controle.abort(),10000);
  try {
    let r;
    for(let i=0;i<4;i++) {
      r = await fetchPhoto(url,{redirect:'manual',signal:controle.signal,headers:{Accept:'image/avif,image/webp,image/png,image/jpeg,image/gif'}});
      if (![301,302,303,307,308].includes(r.status)) break;
      const next = urlPhotoAdmise(new URL(r.headers.get('location') || '',url).href);
      if (!next || i===3) return {status:502};
      url=next;
    }
    if (!r.ok) return {status:502};
    const type=(r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!TYPES.has(type)) return {status:415};
    if (Number(r.headers.get('content-length'))>MAX_OCTETS) return {status:413};
    const chunks=[];let n=0;
    if (!r.body) return {status:502};
    const reader=r.body.getReader();
    for(;;){const {done,value:octets}=await reader.read();if(done)break;n+=octets.byteLength;
      if(n>MAX_OCTETS){await reader.cancel();return {status:413};}chunks.push(Buffer.from(octets));}
    if (!n) return {status:502};
    return {status:200,type,octets:Buffer.concat(chunks,n)};
  }catch(_){return {status:502};}finally{clearTimeout(timer);}
}
