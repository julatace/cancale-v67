'use strict';
const CODE_VERSION='1.0.0';
// Opt-in local recorder. Never receives headers, bodies, text or raw URLs.
const PARCOURS_CLE='vrmCaptureParcoursLocal',PARCOURS_MS=180000;
let parcoursFile=Promise.resolve();
const parcoursStore=()=>chrome.storage.session||chrome.storage.local;
const parcoursSerie=f=>{const p=parcoursFile.catch(()=>{}).then(f);parcoursFile=p.catch(()=>{});return p;};
function parcoursOrigine(v){try{const u=new URL(v);return u.protocol==='https:'&&/^(?:www\.)?vinted\.(fr|com|it|de)$/.test(u.hostname)?u.origin:'';}catch{return '';}}
function parcoursEvenement(v){
 if(!v||!['clic','page','requete'].includes(v.type))return null;
 const e={type:v.type};
 const route=['notifications','conversation','creation_conversation','article','profil','autre','api_notifications','api_conversations','api_autre'];
 if(route.includes(v.route))e.route=v.route;
 if(['button','a','span','div','svg','path','img','li','article','autre'].includes(v.balise))e.balise=v.balise;
 if(['notifications','favori','autre'].includes(v.nom))e.nom=v.nom;
 if(['button','link','listitem','autre'].includes(v.role))e.role=v.role;
 if(['contents','block','inline','inline-block','flex','grid','none','autre'].includes(v.affichage))e.affichage=v.affichage;
 for(const k of ['ancres','exacts'])if(Number.isSafeInteger(v[k])&&v[k]>=0&&v[k]<=10000)e[k]=v[k];
 if(Array.isArray(v.attributs))e.attributs=[...new Set(v.attributs.slice(0,24).filter(x=>['aria-label','aria-labelledby','title','href','data-testid','role'].includes(x)))].slice(0,6);
 if(Array.isArray(v.parametres))e.parametres=[...new Set(v.parametres.slice(0,24).filter(x=>['user_id','opposite_user_id','item_id','notification_id','receiver_id','transaction_id','autre'].includes(x)))].slice(0,7);
 return e;
}
async function lireParcoursLocal(){
 let s=(await parcoursStore().get(PARCOURS_CLE))[PARCOURS_CLE];
 if(s&&Date.now()-s.debut>1800000){await parcoursStore().remove(PARCOURS_CLE);s=null;}
 if(s?.actif&&Date.now()>s.fin){s.actif=false;s.raison='delai';await parcoursStore().set({[PARCOURS_CLE]:s});}
 return s;
}
async function cloreParcoursOnglet(id){return parcoursSerie(async()=>{const s=await lireParcoursLocal();if(s?.actif&&s.tabId===id){s.actif=false;s.raison='onglet_ferme';await parcoursStore().set({[PARCOURS_CLE]:s});}});}
function rapportParcoursLocal(s){return s?{diagnostic:'VRM-parcours-favoris-v1',extension:CODE_VERSION,actif:s.actif===true,raison:['conversation','manuel','delai','limite','onglet_ferme','demarrage_non_confirme'].includes(s.raison)?s.raison:'',evenements:s.evenements.map(x=>({...parcoursEvenement(x),ms:Math.max(0,Math.min(PARCOURS_MS,Number(x.ms)||0))}))}:null;}
async function commandeParcours(msg,sender){return parcoursSerie(async()=>{
 const popup=sender?.id===chrome.runtime.id&&String(sender.url||'').split('?')[0]===chrome.runtime.getURL('popup.html');
 const tab=sender?.tab,contenu=sender?.id===chrome.runtime.id&&Number.isInteger(tab?.id)&&(!sender.frameId)&&parcoursOrigine(sender.url||tab.url);
 if(!popup&&!contenu)return {ok:false};
 let s=await lireParcoursLocal();
 if(popup){
  if(msg.action==='effacer'){await parcoursStore().remove(PARCOURS_CLE);if(s?.actif)try{chrome.tabs.sendMessage(s.tabId,{vrm:'parcours',action:'stop'},()=>void chrome.runtime.lastError);}catch{}return {ok:true,rapport:null};}
  if(msg.action==='arreter'){if(s){s.actif=false;s.raison='manuel';await parcoursStore().set({[PARCOURS_CLE]:s});try{chrome.tabs.sendMessage(s.tabId,{vrm:'parcours',action:'stop'},()=>void chrome.runtime.lastError);}catch{}}return {ok:true,rapport:rapportParcoursLocal(s)};}
  if(msg.action==='demarrer'){
   if(s?.actif)return {ok:false,message:'Un parcours est déjà en cours. Arrête-le avant de recommencer.'};
   const tabs=await chrome.tabs.query({active:true,currentWindow:true});const t=tabs?.[0];
   if(!Number.isInteger(t?.id)||!parcoursOrigine(t.url))return {ok:false,message:'Ouvre Vinted, puis démarre depuis l’icône de l’extension.'};
   s={tabId:t.id,origine:parcoursOrigine(t.url),nonce:crypto.randomUUID(),debut:Date.now(),fin:Date.now()+PARCOURS_MS,actif:true,evenements:[]};
   await parcoursStore().set({[PARCOURS_CLE]:s});
   const ack=await new Promise(resolve=>{const timer=setTimeout(()=>resolve(false),3500);try{chrome.tabs.sendMessage(t.id,{vrm:'parcours',action:'start',nonce:s.nonce,fin:s.fin},r=>{const err=chrome.runtime.lastError;clearTimeout(timer);resolve(!err&&r?.ok===true);});}catch{clearTimeout(timer);resolve(false);}});
   if(!ack){s.actif=false;s.raison='demarrage_non_confirme';await parcoursStore().set({[PARCOURS_CLE]:s});return {ok:false,message:'Vinted n’a pas confirmé le démarrage. Recharge sa page puis réessaie.',rapport:rapportParcoursLocal(s)};}
   return {ok:true,rapport:rapportParcoursLocal(s)};
  }
  if(msg.action==='etat')return {ok:true,rapport:rapportParcoursLocal(s)};
  return {ok:false};
 }
 if(msg.action==='etat')return {ok:true,actif:!!(s?.actif&&s.tabId===tab.id&&s.origine===contenu),...(s?.actif&&s.tabId===tab.id&&s.origine===contenu?{nonce:s.nonce,fin:s.fin}:{})};
 if(!s?.actif||s.tabId!==tab.id||s.origine!==contenu||parcoursOrigine(tab.url)!==contenu||msg.nonce!==s.nonce||Date.now()>s.fin)return {ok:false};
 if(msg.action==='stop'){s.actif=false;s.raison='manuel';await parcoursStore().set({[PARCOURS_CLE]:s});return {ok:true,actif:false};}
 if(msg.action==='evenement'){
  const e=parcoursEvenement(msg.evenement);if(!e)return {ok:false};
  if(s.evenements.length>=100){s.actif=false;s.raison='limite';}else{s.evenements.push({...e,ms:Math.max(0,Date.now()-s.debut)});if(e.type==='page'&&e.route==='conversation'){s.actif=false;s.raison='conversation';}else if(s.evenements.length===100){s.actif=false;s.raison='limite';}}
  await parcoursStore().set({[PARCOURS_CLE]:s});return {ok:true,actif:s.actif};
 }
 return {ok:false};
});}


chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(msg?.from!=='vrm-parcours')return false;
 commandeParcours(msg,sender).then(reply,()=>reply({ok:false,message:'Le rapport local n’a pas pu être confirmé.'}));return true;
});
try{chrome.tabs.onRemoved.addListener(id=>cloreParcoursOnglet(id).catch(()=>{}));}catch{}
