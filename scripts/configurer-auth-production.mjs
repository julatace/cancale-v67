// Administration Supabase uniquement. Sans --appliquer : aperçu local.
// Ne jamais coller le jeton Supabase ni les identifiants SMTP dans un chat.
import fs from 'node:fs';
const projet='lgonxzrzjcqthjtbdpzo',origine='https://vrm.center';
const contenu=fs.readFileSync(new URL('../supabase/templates/recovery.html',import.meta.url),'utf8');
const changements={site_url:origine,mailer_subjects_recovery:'VRM — Réinitialiser ton mot de passe',mailer_templates_recovery_content:contenu,smtp_sender_name:'VRM'};
const appliquer=process.argv.includes('--appliquer');
const token=process.env.SUPABASE_ACCESS_TOKEN;
if(!appliquer){console.log('Aperçu : Site URL https://vrm.center, autorisation de retour sur VRM, objet et modèle de réinitialisation VRM, nom d’expéditeur VRM. Aucun réglage modifié.');console.log('L’adresse d’expédition VRM nécessite un SMTP de domaine vérifié ; les paramètres existants seront conservés.');process.exit(0);}
if(!token){console.error('Accès administrateur indisponible. Fournir SUPABASE_ACCESS_TOKEN dans l’environnement local, jamais dans le chat. Aucun réglage modifié.');process.exit(1);}
const endpoint=`https://api.supabase.com/v1/projects/${projet}/config/auth`;
try{
 const r=await fetch(endpoint,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`Lecture refusée (${r.status})`);
 const avant=await r.json();const urls=String(avant.uri_allow_list||'').split(',').map(s=>s.trim()).filter(Boolean);
 for(const u of [origine,origine+'/**'])if(!urls.includes(u))urls.push(u);
 changements.uri_allow_list=urls.join(',');
 const w=await fetch(endpoint,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(changements),signal:AbortSignal.timeout(15000)});if(!w.ok)throw Error(`Enregistrement refusé (${w.status})`);
 const v=await fetch(endpoint,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});if(!v.ok)throw Error('Vérification indisponible');const apres=await v.json();
 const ok=Object.entries(changements).every(([k,val])=>apres[k]===val);if(!ok)throw Error('Réglages non confirmés après écriture');
 console.log('Redirections et modèle de récupération VRM enregistrés puis relus avec succès.');
 console.log(apres.smtp_host?'SMTP personnalisé présent : vérifier la délivrabilité avec une demande réelle du propriétaire.':'SMTP personnalisé absent : le domaine d’expédition Supabase reste utilisé. Configurer un expéditeur VRM vérifié avant ouverture large.');
}catch(e){console.error('Configuration non confirmée : '+e.message);process.exitCode=1;}
