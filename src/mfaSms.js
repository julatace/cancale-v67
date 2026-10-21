export const facteursMfa = user => (Array.isArray(user?.factors)?user.factors:[]).filter(f=>f?.status==='verified'&&['totp','phone'].includes(f.factor_type)&&f.id).map(f=>({id:String(f.id),type:f.factor_type,telephone:f.factor_type==='phone'?masquerTelephone(f.phone):undefined}));
export const masquerTelephone = n => String(n||'').replace(/.(?=.{2})/g,'•');
export function telephoneInternational(v){const n=String(v||'').trim().replace(/[\s().-]/g,'').replace(/^00/,'+');return /^\+[1-9]\d{7,14}$/.test(n)?n:null;}
export function erreurSms(r){
 if(r?.status===429)return 'Trop de demandes. Attends avant de demander un nouveau SMS.';
 if(!r||r.status===0||r.status>=500)return 'Le service SMS ne répond pas. Aucun accès n’est ouvert : réessaie plus tard.';
 const code=String(r.json?.code||'');
 if(/disabled|not_enabled|provider|hook/.test(code))return 'La vérification par SMS n’est pas encore configurée par VRM. Aucune protection n’a été modifiée.';
 return 'Le SMS n’a pas pu être envoyé. Vérifie le numéro et réessaie ; si cela persiste, contacte VRM.';
}
export async function demanderSms(appeler,id){const r=await appeler('POST',`factors/${encodeURIComponent(id)}/challenge`,{channel:'sms'});return r.ok&&r.json?.id?{ok:true,id:r.json.id}:{ok:false,message:erreurSms(r)};}
