import {createHash} from 'node:crypto';
import {vendeurExige,jetonDe} from './session.js';
import {sbCle} from './cle.js';
import {VIDE,appliquer,Refus} from '../../src/operations/metier.js';
const URL_SB=process.env.SUPABASE_URL||'https://lgonxzrzjcqthjtbdpzo.supabase.co';
// Same public anonymous key as the existing session verifier; never a service key.
const ANON=process.env.SUPABASE_KEY||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';
export const ID_OPERATIONS='vrm_operations_v1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function requete(chemin,headers,options={}){
 const r=await fetch(`${URL_SB}/rest/v1/${chemin}`,{...options,headers:{...headers,'Content-Type':'application/json',...(options.headers||{})},signal:AbortSignal.timeout(12000)});
 const j=await r.json().catch(()=>null);return {r,j};
}
function projection(d,membre){return membre?{version:d.version,revision:d.revision,missions:d.missions.filter(x=>x.attribution===membre).map(x=>({id:x.id,titre:x.titre,consigne:x.consigne,categorie:x.categorie,echeance:x.echeance,etat:x.etat,etapes:x.etapes,compteRendu:x.compteRendu,evenements:x.evenements||[]})),journal:[]}:d;}
export async function routeOperations(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({message:'GET ou POST seulement.'});
 const user=await vendeurExige(req,res);if(!user)return;
 try{
  const userHeaders={apikey:ANON,Authorization:`Bearer ${jetonDe(req)}`};
  const owner=String(req.query?.vendeur||user.id);if(!UUID.test(owner))throw new Refus('Espace invalide.');
  const autre=owner!==user.id;let membre=null,equipe=[],headers=userHeaders;
  const liste=await requete('rpc/vrm_equipe_lister',userHeaders,{method:'POST',body:'{}'});
  if(autre){
   const lien=liste.r.ok&&liste.j?.membre_de?.find(x=>x.vendeur===owner&&x.acces===true);
   if(!lien)throw new Refus('Tu n’as plus accès aux missions de cette équipe.',403);
   membre=lien.id;
   if(!process.env.SUPABASE_SERVICE_KEY)throw new Refus('Le partage des missions n’est pas disponible sur ce serveur.',503);
   headers=sbCle(process.env.SUPABASE_SERVICE_KEY);
  }else{
   const acces=await requete('rpc/vrm_acces',userHeaders,{method:'POST',body:'{}'});
   if(!acces.r.ok||typeof acces.j?.acces!=='boolean')throw new Refus('Impossible de vérifier l’accès à ton espace.',503);
   if(!acces.j.acces)throw new Refus('Ton abonnement ne permet pas cet accès.',403);
   if(liste.r.ok&&Array.isArray(liste.j?.equipe))equipe=liste.j.equipe.filter(x=>x.statut==='actif').map(x=>({id:x.id,email:x.email,statut:x.statut}));
  }
  const filtre=`app_data?owner=eq.${owner}&id=eq.${ID_OPERATIONS}`;
  const lu=await requete(`${filtre}&select=data`,headers);
  if(!lu.r.ok||!Array.isArray(lu.j)||lu.j.length>1)throw new Refus('Impossible de lire tes opérations. Réessaie.',503);
  let d=lu.j.length?lu.j[0].data:VIDE();
  if(d?.version!==1||!Number.isSafeInteger(d.revision))throw new Refus('Ce format nécessite une mise à jour de VRM.',409);
  if(req.method==='POST'){
   let c=req.body;
   if(typeof c==='string'){if(Buffer.byteLength(c)>32000)throw new Refus('Formulaire trop volumineux.',413);try{c=JSON.parse(c);}catch{throw new Refus('Formulaire invalide.');}}
   if(!c||typeof c!=='object'||Array.isArray(c)||Buffer.byteLength(JSON.stringify(c))>32000)throw new Refus('Formulaire invalide ou trop volumineux.',413);
   if(!UUID.test(c.id||'')||typeof c.type!=='string'||!Number.isSafeInteger(c.revision)||!c.donnees||typeof c.donnees!=='object'||Array.isArray(c.donnees))throw new Refus('Opération invalide.');
   const empreinte=createHash('sha256').update(JSON.stringify({type:c.type,donnees:c.donnees})).digest('hex');
   // A retry after a lost response returns the recorded result even if its revision is old.
   if(c.revision!==d.revision&&!d.commandes.some(x=>x.id===c.id))throw new Refus('L’espace a changé dans une autre fenêtre. Actualise avant de réessayer.',409);
   const suivant=appliquer(d,c,{acteur:user.id,maintenant:new Date().toISOString(),equipe,membre,empreinte});
   if(suivant!==d){
    if(Buffer.byteLength(JSON.stringify(suivant))>1500000)throw new Refus('L’espace a atteint sa capacité. Exporte ton historique.',413);
    let ecrit;
    if(lu.j.length)ecrit=await requete(`${filtre}&data->>revision=eq.${d.revision}`,headers,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({data:suivant})});
    else ecrit=await requete('app_data',headers,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id:ID_OPERATIONS,owner,data:suivant})});
    if(ecrit.r.status===409||(ecrit.r.ok&&Array.isArray(ecrit.j)&&ecrit.j.length===0))throw new Refus('Une autre opération vient d’être enregistrée. Actualise avant de réessayer.',409);
    if(!ecrit.r.ok||!Array.isArray(ecrit.j)||ecrit.j.length!==1)throw new Refus('Sauvegarde non confirmée. Actualise avant toute nouvelle action.',503);
    d=suivant;
   }
  }
  return res.status(200).json({ok:true,donnees:projection(d,membre),confirmees:d.commandes.filter(x=>x.acteur===user.id).map(x=>x.id),equipe,membre:!!membre,capacites:{surveillanceEbay:false,achatAutomatique:false},serveur:new Date().toISOString()});
 }catch(e){return res.status(e instanceof Refus?e.status:503).json({message:e instanceof Refus?e.message:'Connexion interrompue. Sauvegarde non confirmée : actualise avant de réessayer.'});}
}
