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
const fs=require('fs'), vm=require('vm'), path=require('path');
// ⚠️ §5.80 : chemins RELATIFS au script. Avec des chemins absolus, ce fichier
// copié dans un arbre de preuve relisait le dépôt courant — et la preuve
// « ça échoue sur le code d'avant » était truquée.
const RACINE=path.join(__dirname,'..');
const APP=fs.readFileSync(path.join(RACINE,'src/App.jsx'),'utf8');
const BG=fs.readFileSync(path.join(RACINE,'vinted-sync-extension/background.js'),'utf8');
const PANEL=fs.readFileSync(path.join(RACINE,'vinted-sync-extension/vinted-panel.js'),'utf8');

// ⚠️⚠️ CE FICHIER IMPRIMAIT DES ❌ ET SORTAIT TOUJOURS EN 0 (trouvé le
// 8 septembre). Le balayage des audits (`for f in scripts/audit-*.cjs`) le
// comptait donc VERT quoi qu'il arrive : casser `EXT_ATTENDUE` à 9.99.9
// affichait « ❌ version d'extension attendue » et le script rendait 0. Or
// CLAUDE.md annonçait « audit-coherence vérifie que la constante suit le
// manifeste » — elle ne vérifiait rien du tout, elle le RACONTAIT.
// C'est la règle de preuve du projet à l'envers : un contrôle qui ne peut pas
// échouer ne prouve rien, et il est PIRE qu'absent — il rassure.
// `ko` compte, et `dit` remplace les `console.log((ok?…))` un par un.
// « 5.9.0 » < « 5.52.0 » : une comparaison de chaînes dirait l'inverse.
const cmpVer = (a, b) => { const A=String(a).split('.').map(Number), B=String(b).split('.').map(Number);
  for (let i=0;i<Math.max(A.length,B.length);i++){ const d=(A[i]||0)-(B[i]||0); if(d) return d<0?-1:1; } return 0; };
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };

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
// « faut-il GÉNÉRER le bordereau ? » — écrite dans les deux fichiers (l'app pour
// l'afficher, l'extension pour agir). Deux copies = deux comportements possibles.
const appGen = bloc(APP,'aGenererBordereau');
const bgGen  = bloc(BG,'aGenererBordereau');
const appNorm = extraire(APP, /const normTitle = (\(t\) => [^\n]*?);\n/);
const bgNorm = extraire(BG, /const normT = (\(t\) => [^\n]*?);\n/);

const dispo={appClassify,extClassify,appShip,appRelay,bgShipConst,bgRelayConst,bgShipLocal,appNeedsBord,appNorm,bgNorm,appGen,bgGen};
const manquants=Object.entries(dispo).filter(([k,v])=>!v).map(([k])=>k);
if(manquants.length) console.log('⚠️ non extraits :', manquants.join(', '));

const cmp=(nom,a,b)=>{
  if(!a||!b) return;
  const ecarts=S.filter(s=>String(a(s))!==String(b(s)));
  dit(ecarts.length===0, nom, `${ecarts.length} désaccord(s) sur ${S.length} statuts`);
  ecarts.slice(0,8).forEach(s=>console.log(`     « ${s} » → app=${a(s)} / ext=${b(s)}`));
};
(async()=>{
await corpus();
console.log('Statuts distincts en base :', S.length);
cmp('classification vente (annulée/finalisée/en cours)', appClassify, extClassify);
cmp('à expédier (app vs extension)', appShip, bgShipConst);
cmp('à expédier (les DEUX copies internes de l\'extension)', bgShipConst, bgShipLocal);
cmp('au point relais (app vs extension)', appRelay, bgRelayConst);
cmp('bordereau À GÉNÉRER (app vs extension)', appGen, bgGen);
const titres=['Nike  Air   MAX 1','  adidas Spezial ','ÉTÉ  Blanc'];
dit(titres.every(t=>appNorm&&bgNorm&&appNorm(t)===bgNorm(t)), 'normalisation de titre (app vs extension)');
// besoin d'un bordereau : l'extension n'a pas la même notion — on regarde l'écart
if(appNeedsBord&&bgShipConst){
  const d=S.filter(s=>appNeedsBord(s)!==bgShipConst(s));
  console.log(`ℹ️  « à expédier » : ${d.length} statuts où l'app dit « bordereau nécessaire » et l'extension non (ou l'inverse)`);
  d.slice(0,10).forEach(s=>console.log(`     « ${s} » → app.needsBordereau=${appNeedsBord(s)} / ext.aExpedier=${bgShipConst(s)}`));
}
// ── LA VERSION D'EXTENSION QUE L'APP ANNONCE ─────────────────────────────
// L'app dit à Julien « ton extension est en retard » en comparant la version
// captée par le pont à `EXT_ATTENDUE`. Si cette constante n'est pas celle du
// manifeste, elle ment dans un sens ou dans l'autre : soit elle réclame un
// rechargement pour rien, soit elle laisse tourner une version qui ne capte
// plus ce que l'app attend — exactement ce qu'on veut rendre visible.
{
  const man=JSON.parse(fs.readFileSync(path.join(RACINE,'vinted-sync-extension/manifest.json'),'utf8'));
  const m=/const EXT_ATTENDUE\s*=\s*'([^']+)'/.exec(APP);
  const ok = m && m[1]===man.version;
  dit(ok, "version d'extension attendue par l'app", `app=${m?m[1]:'ABSENTE'} / manifeste=${man.version}`);

  // ── LES TROIS CAPACITÉS, ET LA VERSION OÙ CHACUNE EST ARRIVÉE ────────────
  // L'app ne promet « l'extension le fait toute seule » qu'au-dessus d'un
  // seuil (`EXT_CAPACITES`). Deux façons de mentir, et l'audit couvre les deux :
  //   • citer une capacité que l'extension n'a plus (fonction retirée) — on
  //     promettrait dans le vide sur une extension pourtant à jour ;
  //   • annoncer un seuil PLUS HAUT que le manifeste — aucune version livrée ne
  //     l'atteindrait, donc la promesse ne s'afficherait JAMAIS, et on
  //     enverrait Julien chercher une mise à jour qui n'existe pas. C'est le
  //     défaut du zip, retourné.
  const FONCTIONS = { codes:'capterRetraits', offres:'autoAccepterOffres', releve:'capterReleves', places:'mpChoisi', ebay:'buildEbayData', lbctitre:'lbcTitre', photoslbc:'photosEnOctets', photosebay:'photosPourEbay', repond:'repondreAuxMessages' };
  const t = /const EXT_CAPACITES\s*=\s*\{([^}]*)\}/.exec(APP);
  dit(!!t, "l'app tient une table des capacités de l'extension",
    "sans elle, chaque promesse « tout seul » est reprise à la main — et une seule était gardée");
  if (t) {
    const caps = [...t[1].matchAll(/(\w+)\s*:\s*'([0-9.]+)'/g)].map(x => ({ nom:x[1], v:x[2] }));
    for (const c of caps) {
      const fn = FONCTIONS[c.nom];
      dit(!!fn && new RegExp('function\\s+' + fn + '\\b').test(BG),
        `capacité « ${c.nom} » : \`${fn || '?'}\` existe toujours dans l'extension`,
        fn ? '' : 'capacité inconnue de cet audit — ajoute-la à FONCTIONS avec sa fonction');
      dit(cmpVer(c.v, man.version) <= 0,
        `capacité « ${c.nom} » : son seuil ${c.v} est atteignable`,
        `manifeste ${man.version} — un seuil plus haut ne s'affiche jamais`);
    }
    // ⚠️⚠️ CE QUE L'APP DIT DES PHOTOS DÉPEND DE LA VERSION INSTALLÉE.
    // Elles étaient téléchargées sur son disque jusqu'à la 5.58 (Leboncoin) et
    // la 5.59 (eBay) ; depuis, elles s'attachent au formulaire. Le 13 septembre
    // la phrase a été corrigée à un endroit… et laissée à l'autre (l'écran
    // Leboncoin), sans aucune garde de version. *Une suppression « terminée » se
    // vérifie sur ce qui RESTE.*
    // ⚠️ Même forme que le contrôle de `panne.cjs` : toute phrase qui AFFIRME ce
    //    que l'extension fait des photos doit avoir une garde dans son voisinage
    //    immédiat. Un contrôle qui interdirait le mot attraperait la phrase
    //    honnête ; celui-ci exige la GARDE, pas une formulation.
    {
      // ⚠️ TREIZIÈME FOIS QU'UN DE MES CONTRÔLES CRIE AU LOUP, et c'est la
      //    récidive exacte du balayage des sondes (§« deux fois de plus ») :
      //    premier jet, il s'est déclenché sur MON PROPRE COMMENTAIRE — celui
      //    qui cite la phrase d'avant pour expliquer pourquoi elle est partie.
      //    Retirer les lignes qui COMMENCENT par `//` ne suffit pas : un bloc
      //    `/* … */` de dix lignes n'en a aucune. *Un audit lit le CODE* — on
      //    neutralise les blocs en gardant les retours à la ligne, pour que les
      //    numéros signalés restent ceux du fichier.
      const sansCommentaires = APP
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(Math.max(0, m.length - p1.length)));
      const lignes = sansCommentaires.split('\n');
      const sansGarde = [];
      lignes.forEach((l, i) => {
        if (!/photos? (attachées|téléchargées)/i.test(l)) return;
        const autour = lignes.slice(Math.max(0, i - 8), i + 3).join('\n');
        if (!/capPhotos|photoslbc|photosebay/.test(autour)) sansGarde.push(i + 1);
      });
      dit(sansGarde.length === 0, 'ce que l\'app dit des PHOTOS est gardé par la version installée',
        sansGarde.length ? 'ligne(s) ' + sansGarde.join(', ') + ' : affirme sans savoir ce que l\'extension sait faire' : '');
    }
    for (const k in FONCTIONS) dit(caps.some(c => c.nom === k),
      `la capacité « ${k} » est déclarée dans la table`,
      'une capacité livrée mais non déclarée retombe sur EXT_ATTENDUE');
  }

  // ⚠️⚠️ LA VERSION ÉCRITE EN BASE EST UN CONSTAT, JAMAIS UNE CAPACITÉ.
  // `panel_diag_capture.ver` dit quelle extension a capté EN DERNIER, quelque
  // part — pas laquelle tourne dans le navigateur qui lit l'app. S'en servir
  // pour décider ce qu'on PROMET reviendrait à annoncer à un iPhone (où il n'y
  // a aucune extension) ce qu'un Chrome sait faire : le défaut le plus coûteux
  // du projet, cinq fois répété. Seul le pont (`vmrExtVersion`) a le droit de
  // décider, et c'est ce que fait `extSait`.
  {
    const bloc = (/const extSait = [\s\S]*?\n\};/.exec(APP) || [])[0]
      || (/const extSait = [^\n]*\n/.exec(APP) || [])[0] || '';
    dit(!!bloc, '`extSait` est trouvable dans App.jsx');
    if (bloc) dit(!/derniereExt|panel_diag_capture|\bver\b/.test(bloc),
      '`extSait` ne décide que sur le PONT, jamais sur la version écrite en base',
      'une version lue en base dirait à un iPhone ce qu\'un Chrome sait faire');
    // Et l'autre moitié : la phrase qui l'affiche ne doit pas se transformer en
    // promesse. Elle CONSTATE (« la dernière capture est partie d'une … »).
    const i = APP.indexOf('function ConnexionsSetting');
    const j = i < 0 ? -1 : APP.indexOf('\nfunction ', i + 10);
    const S2 = i < 0 ? '' : APP.slice(i, j < 0 ? APP.length : j);
    if (S2 && /derniereExt/.test(S2)) {
      dit(/dernière capture/i.test(S2),
        'la version lue en base est présentée comme un CONSTAT',
        'elle doit dire d\'où vient la capture, pas ce que l\'extension d\'ici sait faire');
      // Trois états : en cours · pas su · lu. Une lecture ratée ne doit pas
      // se lire comme « aucune extension n'a capté ».
      dit(/setDerniereExt\(null\)/.test(S2) && /'aucune'/.test(S2),
        'et sa lecture distingue « pas su » de « aucune »');
    }
  }
}
console.log('\nStatuts réels :'); S.forEach(s=>console.log('  -',s));
console.log(ko ? `\n${ko} contrôle(s) non conforme(s).` : "\nL'app et l'extension disent la même chose.");
process.exit(ko ? 1 : 0);
})();


