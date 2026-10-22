// Seuls les services Web Push des navigateurs peuvent être contactés.
// Un abonnement fourni par le client ne doit pas devenir un relais HTTP.
export function endpointPushPermis(endpoint){
 if(typeof endpoint!=='string'||endpoint.length>4096)return false;
 try{const u=new URL(endpoint),h=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443'))return false;
  return h==='fcm.googleapis.com'||h==='android.googleapis.com'||h==='web.push.apple.com'||h==='web.push.apple.com.cn'||h==='updates.push.services.mozilla.com'||h.endsWith('.notify.windows.com');
 }catch(_){return false;}
}
export function nettoyerAbonnementPush(sub){
 if(!endpointPushPermis(sub?.endpoint))return null;
 const k=sub.keys;
 if(typeof k?.p256dh!=='string'||typeof k?.auth!=='string'||k.p256dh.length>200||k.auth.length>100)return null;
 return {endpoint:sub.endpoint,expirationTime:Number.isFinite(sub.expirationTime)?sub.expirationTime:null,keys:{p256dh:k.p256dh,auth:k.auth}};
}
