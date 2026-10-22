// Une URL d'avatar se construit à partir des identifiants Discord ; jamais
// depuis une URL libre fournie par le navigateur.
export function identiteDiscord(u){
 const id=String(u?.id||''),hash=String(u?.avatar||'');
 if(!/^\d{15,25}$/.test(id)|| (hash&&!/^(?:a_)?[0-9a-f]{32}$/.test(hash)))return null;
 return {id,avatar:hash};
}
export function urlAvatarDiscord(u){
 const p=identiteDiscord(u);if(!p)return '';
 return p.avatar?`https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png?size=96`:`https://cdn.discordapp.com/embed/avatars/${Number((BigInt(p.id)>>22n)%6n)}.png`;
}
export function avatarDiscordPermis(url){
 if(typeof url!=='string'||url.length>240)return false;
 return /^https:\/\/cdn\.discordapp\.com\/(?:avatars\/\d{15,25}\/(?:a_)?[0-9a-f]{32}\.png\?size=96|embed\/avatars\/[0-5]\.png)$/.test(url);
}
export const initialesProfil=p=>Array.from(String(p?.pseudo||p?.discord||'VRM').trim()).filter(c=>/[\p{L}\p{N}]/u.test(c)).slice(0,2).join('').toLocaleUpperCase('fr');
