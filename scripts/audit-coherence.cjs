// ═══════════════════════════════════════════════════════════════════════════
// AUDIT DE COHÉRENCE APP ↔ EXTENSION   —   node scripts/audit-coherence.cjs
// ═══════════════════════════════════════════════════════════════════════════
// À LANCER APRÈS TOUTE MODIFICATION D'UNE RÈGLE MÉTIER (statut de vente, « à
// expédier », « au point relais », normalisation de titre…).
//
// Pourquoi : l'app et l'extension répondent aux MÊMES questions avec DEUX codes
// différents. Quand une seule des deux évolue, elles se contredisent en silence
// — et c'est ce que l'utilisateur voit en premier (« le panneau me dit une
// vente en cours, l'app dit annulée »). Ce script extrait les prédicats des
// deux fichiers, les exécute sur TOUS les statuts réellement présents en base,
// et affiche chaque désaccord.
//
// Lecture seule. Aucune écriture, aucun appel à Vinted.
const fs=require('fs'), vm=require('vm');
const APP=fs.readFileSync('/home/user/cancale-v67/src/App.jsx','utf8');
const BG=fs.readFileSync('/home/user/cancale-v67/vinted-sync-extension/background.js','utf8');
const PANEL=fs.readFileSync('/home/user/cancale-v67/vinted-sync-extension/vinted-panel.js','utf8');

// corpus : tous les statuts distincts des commandes moissonnées
// Corpus : tous les statuts distincts des commandes réellement moissonnées.
// On lit la base (clé publique, lecture seule) ; à défaut, un jeu de secours
// pour que le script reste utile hors ligne.
const SECOURS=['Bordereau envoyé au vendeur','Paiement validé','Commande expédiée et en cours d\'acheminement !',
 'Commande livrée !','Commande finalisée - l\'acheteur a validé la commande','Remboursement effectué',
 'Remboursement validé','Retour initié','Transaction suspendue - en attente de vérification.',
 'Commande non réclamée - Retournée à l\'expéditeur.rice'];
let S=SECOURS.slice();
const APPSRC=APP;
const URLB=(/const SUPABASE_URL = "([^"]+)"/.exec(APPSRC)||[])[1];
const KEYB=(/const SUPABASE_KEY = "([^"]+)"/.exec(APPSRC)||[])[1];
async function corpus(){
  if(!URLB||!KEYB) return;
  try{
    const r=await fetch(`${URLB}/rest/v1/app_data?id=like.harvest_%25_orders_%25&select=data`,{headers:{apikey:KEYB,Authorization:'Bearer '+KEYB}});
    if(!r.ok) return;
    const st=new Set();
    for(const row of await r.json()) for(const o of (((row.data||{}).payload||{}).my_orders||[])) if(o&&o.status) st.add(String(o.status));
    if(st.size) S=[...st].sort();
  }catch(_){}
}

// extraction d'une fonction par son texte source (elles sont pures)
const extraire=(src,motif)=>{ const m=motif.exec(src); if(!m) return null;
  try { return eval('('+m[1]+')'); } catch(e){ return null; } };

const bloc=(src,nom)=>{ const i=src.indexOf('const '+nom+' = ('); if(i<0) return null;
  let j=src.indexOf('=>',i); let k=src.indexOf('{',j); let n=1,x=k+1;
  while(n>0&&x<src.length){ const c=src[x]; if(c==='{')n++; else if(c==='}')n--; x++; }
  const txt=src.slice(src.indexOf('(',i), x);
  try { return eval('('+txt+')'); } catch(e){ console.log('eval KO',nom,e.message); return null; } };
const appClassify = bloc(APP,'classifyOrderStatus');
const extClassify = extraire(BG, /const classifySale = (\(st\) => [\s\S]*?);\n/);
const appShip = extraire(APP, /^const isAwaitingShipStatus = (\(s\) => [^\n]*?);$/m);
const appRelay = extraire(APP, /^const isAtRelayStatus = (\(s\) => [^\n]*?);$/m);
const bgShipConst = extraire(BG, /const AWAITING_SHIP = (\(s\) => [^\n]*?);\n/);
const bgRelayConst = extraire(BG, /const AT_RELAY = (\(s\) => [^\n]*?);\n/);
const bgShipLocal = extraire(BG, /const awaitingShip = (\(s\) => [^\n]*?);\n/);
globalThis.isAwaitingShipStatus = appShip; globalThis.isAtRelayStatus = appRelay;
const appNeedsBord = bloc(APP,'needsBordereau');
const appNorm = extraire(APP, /const normTitle = (\(t\) => [^\n]*?);\n/);
const bgNorm = extraire(BG, /const normT = (\(t\) => [^\n]*?);\n/);

const dispo={appClassify,extClassify,appShip,appRelay,bgShipConst,bgRelayConst,bgShipLocal,appNeedsBord,appNorm,bgNorm};
const manquants=Object.entries(dispo).filter(([k,v])=>!v).map(([k])=>k);
if(manquants.length) console.log('⚠️ non extraits :', manquants.join(', '));

const cmp=(nom,a,b)=>{
  if(!a||!b) return;
  const ecarts=S.filter(s=>String(a(s))!==String(b(s)));
  console.log(`${ecarts.length?'❌':'✅'} ${nom} — ${ecarts.length} désaccord(s) sur ${S.length} statuts`);
  ecarts.slice(0,8).forEach(s=>console.log(`     « ${s} » → app=${a(s)} / ext=${b(s)}`));
};
(async()=>{
await corpus();
console.log('Statuts distincts en base :', S.length);
cmp('classification vente (annulée/finalisée/en cours)', appClassify, extClassify);
cmp('à expédier (app vs extension)', appShip, bgShipConst);
cmp('à expédier (les DEUX copies internes de l\'extension)', bgShipConst, bgShipLocal);
cmp('au point relais (app vs extension)', appRelay, bgRelayConst);
const titres=['Nike  Air   MAX 1','  adidas Spezial ','ÉTÉ  Blanc'];
console.log((titres.every(t=>appNorm&&bgNorm&&appNorm(t)===bgNorm(t))?'✅':'❌')+' normalisation de titre (app vs extension)');
// besoin d'un bordereau : l'extension n'a pas la même notion — on regarde l'écart
if(appNeedsBord&&bgShipConst){
  const d=S.filter(s=>appNeedsBord(s)!==bgShipConst(s));
  console.log(`ℹ️  « à expédier » : ${d.length} statuts où l'app dit « bordereau nécessaire » et l'extension non (ou l'inverse)`);
  d.slice(0,10).forEach(s=>console.log(`     « ${s} » → app.needsBordereau=${appNeedsBord(s)} / ext.aExpedier=${bgShipConst(s)}`));
}
console.log('\nStatuts réels :'); S.forEach(s=>console.log('  -',s));
})();
