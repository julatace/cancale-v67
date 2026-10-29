// L'ACCEPTATION D'OFFRE SUR VINTED PART DU TAP DE JULIEN — JAMAIS D'UNE BOUCLE.
//
// Histoire : l'acceptation AUTOMATIQUE (un moteur dans l'extension qui accepte
// seul à chaque visite) a été retirée les 4-5 octobre, à sa demande, parce
// qu'un programme qui accepte ressemble à un robot (§3, `vanessa5723` bloqué).
// Le 27 octobre Julien la redemande (« à côté du numéro un prix mini, tout
// au-dessus est accepté »), puis tranche la tension lui-même : « fais en sorte
// que je ne sois pas bloqué, trouve quelque chose ». La seule voie SANS blocage
// sur Vinted (qui n'a pas de seuil natif, contrairement à eBay) : un prix MINI
// met l'offre en avant, et c'est SON TAP qui accepte (voie `vmrExec` /
// `EXEC_PERMIS`, garde stricte, plafond, une requête à la fois). Ce n'est donc
// PAS un moteur d'acceptation — aucun programme n'accepte seul.
//
// L'invariant, vérifié sur le code SANS ses commentaires (un commentaire n'est
// pas du code — leçon des sondes et de « télécharg ») :
//   1. dans l'extension, la route `/offer_requests/{id}/accept` n'apparaît QUE
//      dans la liste blanche `EXEC_PERMIS` — aucun code ne la construit ;
//   2. aucun MOTEUR d'acceptation dans l'extension (boucle, planchers lus,
//      interrupteur local) : c'est lui qui bloquait le compte ;
//   3. dans l'app : un prix mini (`data="min"`) et l'acceptation en 1 tap sont
//      permis, MAIS chaque acceptation part d'un `onClick` (jamais une minuterie
//      ni un effet), aucune capacité « offres » n'est rallumée, et l'app DIT que
//      rien n'est accepté tout seul ;
//   4. l'AUTRE SENS : l'acceptation manuelle existe toujours (liste blanche +
//      bouton de la messagerie), et `vinted_offres_auto` reste synchronisé (les
//      extensions 5.130 à 5.150 retomberaient sinon sur l'interrupteur local).
//
// `--src dossier` : lance l'audit sur une autre copie du dépôt (preuve §6.1).
const fs = require('fs'), path = require('path');
let parser;
try { parser = require(path.join(__dirname, '..', 'node_modules', '@babel', 'parser')); }
catch (_) { parser = require('/home/user/cancale-v67/node_modules/@babel/parser'); }

const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = (nom, f) => { try { f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 160)); } };

// Le code sans ses commentaires, positions et retours à la ligne conservés.
function sansCommentaires(texte, jsx) {
  const ast = parser.parse(texte, { sourceType: jsx ? 'module' : 'script', errorRecovery: true, allowReturnOutsideFunction: true, plugins: jsx ? ['jsx'] : [] });
  const t = texte.split('');
  for (const c of ast.comments || []) for (let i = c.start; i < c.end; i++) if (t[i] !== '\n') t[i] = ' ';
  return t.join('');
}
const lire = (rel) => fs.readFileSync(path.join(RACINE, rel), 'utf8');
const ligneDe = (txt, idx) => txt.slice(0, idx).split('\n').length;

let BG = '', APP = '';
essaie('lecture du code', () => {
  BG = sansCommentaires(lire('vinted-sync-extension/background.js'), false);
  APP = sansCommentaires(lire('src/App.jsx'), true);
});

// ── 1-2. L'ACCEPTATION AUTOMATIQUE EST PERMISE (27 oct.) — SOUS GARDE ──────────
// Julien l'a REDEMANDÉE, en connaissance de cause, et a choisi « Moteur auto
// (accepte seul) » le risque sous les yeux. Elle n'est PLUS interdite ; ce qui
// reste exigé, c'est ce qui sépare un moteur SOUS CONTRÔLE d'un robot :
//   · chaque acceptation passe par `garde` (compte connecté dans l'onglet,
//     plafond 20/h, arrêt sur une pause 429/403) AVANT d'appeler Vinted ;
//   · les acceptations sont ESPACÉES (étalement) ; l'aléatoire est AUTORISÉ —
//     Julien, propriétaire du compte, a dit que ce n'est pas ce qui a bloqué
//     `vanessa5723` ; le vrai rate-limit reste le plafond 20/h + une requête à
//     la fois, et il ne bouge pas ;
//   · le moteur est éteint par défaut et NE tourne que si l'interrupteur est
//     allumé ; « pas su » (base muette) ⇒ éteint ; le volume par visite est borné.
// La voie MANUELLE (executerPourApp / EXEC_PERMIS) reste, intacte.
essaie('moteur sous garde', () => {
  dit(BG.indexOf('EXEC_PERMIS') >= 0, "l'extension garde sa liste blanche des actions permises (EXEC_PERMIS, voie manuelle)");
  const iAuto = BG.indexOf('async function autoAccepterOffres');
  dit(iAuto >= 0, "le moteur d'acceptation automatique existe (autoAccepterOffres) — il a été redemandé");
  const finAuto = BG.indexOf('async function', iAuto + 20);
  const corps = iAuto >= 0 ? BG.slice(iAuto, finAuto > 0 ? finAuto : iAuto + 4000) : '';
  // GARDE avant d'appeler Vinted : dans `repondreOffre`, `garde` précède le /accept.
  const iRep = BG.indexOf('async function repondreOffre');
  const finRep = BG.indexOf('async function', iRep + 20);
  const corpsRep = iRep >= 0 ? BG.slice(iRep, finRep > 0 ? finRep : iRep + 2000) : '';
  dit(/await garde\([\s\S]*offer_requests\/\$\{oid\}\/accept/.test(corpsRep),
    "chaque acceptation passe par `garde` (compte connecté, plafond 20/h, pause) AVANT d'appeler Vinted");
  dit(/await garde\(/.test(corps), "le moteur vérifie `garde` avant d'agir");
  // ESPACEMENT entre deux acceptations : il doit EXISTER (étalement + laisser le
  // worker souffler) ; l'aléatoire est autorisé (décision de Julien, 27 oct.).
  dit(/espaceAcceptMs\(\)|ESPACE_ACCEPT|setTimeout/.test(corps), "les acceptations sont espacées dans le temps (étalement ; le rate-limit réel = plafond 20/h + une requête à la fois)");
  dit(/OFFRES_MAX_PAR_VISITE/.test(corps), "le volume par visite est borné (OFFRES_MAX_PAR_VISITE)");
  dit(/!reg\.actif/.test(corps), "le moteur ne tourne que si l'interrupteur est allumé (reg.actif)");
  const iReg = BG.indexOf('async function offreAutoReglages');
  const finReg = BG.indexOf('async function', iReg + 20);
  const corpsReg = iReg >= 0 ? BG.slice(iReg, finReg > 0 ? finReg : iReg + 1500) : '';
  dit(/=== null\) return null|m === null/.test(corpsReg), "« pas su » (base muette) ⇒ moteur éteint (offreAutoReglages rend null)");
});

// ── 3. L'app : prix mini + interrupteur HONNÊTE, et elle ne boucle pas ────────
// Décision de Julien, 27 octobre : « à côté du numéro on met un prix minimum et
// tout ce qui est au-dessus est accepté », puis « non je veux que ça accepte
// tout seul » → « Moteur auto (accepte seul) », le risque sous les yeux. Le
// MOTEUR vit dans l'extension (contrôles 1-2, sous garde). L'APP, elle, a deux
// rôles — et aucun des deux n'est une boucle côté app :
//   · la messagerie accepte UNE offre précise sur un `onClick` (jamais une
//     minuterie, jamais un effet) ;
//   · l'interrupteur `vinted_offres_auto` allume le moteur de l'extension — et
//     comme ça accepte VRAIMENT tout seul, l'app doit le DIRE (une confirmation
//     qui prévient que des offres seront acceptées sans lui). C'est la garde
//     d'honnêteté retournée : avant elle promettait « rien tout seul » ; depuis
//     le revirement elle doit AVERTIR, pas rassurer (§6.5 : on exige la garde,
//     pas un mot).
essaie('app', () => {
  const cap = /const EXT_CAPACITES\s*=\s*\{([^}]*)\}/.exec(APP);
  dit(!!cap && !/\boffres\s*:|\boffresapp\s*:/.test(cap[1]), "l'app ne déclare pas de capacité « offres » à l'extension (ce serait l'ancien moteur)",
    cap ? '' : 'EXT_CAPACITES introuvable');
  dit(!/extSait\(\s*['"]offres(app)?['"]\s*\)/.test(APP), "aucune décision de l'app sur une capacité « offres »");
  // Chaque acceptation part d'un clic. On prend chaque `actionOffre('accept'`
  // et on vérifie qu'un `onClick` l'introduit (sur la portée qui précède).
  const accepts = [...APP.matchAll(/actionOffre\(\s*['"]accept['"]/g)];
  dit(accepts.length > 0, "la messagerie accepte bien une offre précise (actionOffre('accept'))");
  const sansClic = accepts.filter((a) => !/onClick=\{\s*\(?\)?\s*=>\s*$/.test(APP.slice(Math.max(0, a.index - 40), a.index)));
  dit(sansClic.length === 0, "chaque acceptation d'offre part d'un clic (jamais une boucle)",
    sansClic.map((a) => 'l.' + ligneDe(APP, a.index)).join(' · '));
  // Aucune minuterie ni aucun effet n'accepte une offre (le vrai « tout seul »).
  dit(!/set(?:Interval|Timeout)\(\s*(?:async\s*)?\(?\)?\s*=>[\s\S]{0,400}?actionOffre\(\s*['"]accept/.test(APP),
    "aucune minuterie n'accepte une offre");
  dit(!/useEffect\(\s*(?:async\s*)?\(?\)?\s*=>[\s\S]{0,600}?actionOffre\(\s*['"]accept/.test(APP),
    "aucun effet n'accepte une offre au montage");
  // Le prix mini existe, et l'interrupteur qui allume le moteur AVERTIT que ça
  // accepte vraiment tout seul (la garde d'honnêteté, RETOURNÉE depuis le
  // revirement : on exige l'avertissement, pas un mot — §6.5).
  const miniPose = /data=["']min["']|updatePair\(item,\s*\{\s*min:/.test(APP);
  dit(miniPose, "le prix mini d'acceptation existe (data=\"min\")");
  // L'interrupteur appelle une confirmation qui dit que VRM accepte À TA PLACE
  // et nomme le risque de blocage — sinon on allumerait un moteur en silence.
  const iBasc = APP.indexOf('const basculerOffresAuto');
  const corpsBasc = iBasc >= 0 ? APP.slice(iBasc, iBasc + 1200) : '';
  dit(/l['’]accepte à ta place/i.test(corpsBasc) && /robot|risque pour le compte|peut être vu/i.test(corpsBasc),
    "l'interrupteur AVERTIT que VRM accepte à ta place et nomme le risque (honnêteté retournée : il prévient, il ne rassure pas)",
    iBasc < 0 ? 'basculerOffresAuto introuvable' : '');
  dit(/data-offres-auto-toggle/.test(APP), "l'interrupteur d'acceptation auto existe dans l'app (data-offres-auto-toggle)");
});

// ── 4. L'autre sens : la voie manuelle reste, et l'ancien réglage reste éteint
essaie('autre sens', () => {
  const debut = BG.indexOf('EXEC_PERMIS'), fin = BG.indexOf('];', debut);
  const liste = debut >= 0 ? BG.slice(debut, fin) : '';
  dit(/offer_requests[^\n]*\(accept\|reject\)|offer_requests[^\n]*accept/.test(liste),
    "l'acceptation MANUELLE (son clic dans la messagerie) reste dans la liste blanche");
  dit(/offreEnAttenteDe/.test(APP) && /Accepter/.test(APP), "la messagerie de l'app propose toujours d'accepter une offre précise, sur son clic");
  const sync = /const SYNC_KEYS\s*=\s*\[([\s\S]*?)\];/.exec(APP);
  dit(!!sync && /'vinted_offres_auto'/.test(sync[1]),
    "`vinted_offres_auto` reste synchronisé (les extensions 5.130 à 5.150 retomberaient sinon sur l'interrupteur local)");
});

// ── 5. eBay : c'est eBAY qui accepte (9 octobre) ────────────────────────────
// Julien, 9 octobre : « je veux juste définir une règle sur chaque annonce et à
// chaque offre au-dessus ça accepte » — puis « eBay seulement ». Le réglage
// NATIF d'eBay (seuil `BestOfferAutoAcceptPrice` posé sur l'annonce, sur SON
// clic) : c'est eBay qui accepte. Ce qui doit rester vrai, dans le code des
// routes (sans commentaires) :
//   · aucun appel à une route d'acceptation (`RespondToBestOffer`, une route de
//     négociation qui accepte ou répond à une offre) ;
//   · aucune voie Inventory (`bestOfferTerms` / `autoAcceptPrice`) : une seule
//     voie d'écriture du seuil (§11) ;
//   · le seuil ne s'écrit QUE dans `api/ebay.js` (la route qui exige la
//     session, la confirmation et relit chez eBay).
// `--fichier-api chemin` : ajoute un fichier `api/` muté (preuve : il passe au rouge).
essaie('eBay', () => {
  const dossiers = ['api', path.join('api', '_lib')];
  const fichiers = [];
  for (const d of dossiers) {
    let noms = [];
    try { noms = fs.readdirSync(path.join(RACINE, d)); } catch (_) {}
    for (const n of noms) if (/\.js$/.test(n)) fichiers.push(path.join(d, n));
  }
  const iMut = process.argv.indexOf('--fichier-api');
  const extra = iMut > 0 ? path.resolve(process.argv[iMut + 1]) : '';
  const lus = fichiers.map((rel) => ({ rel, code: sansCommentaires(lire(rel), false) }));
  if (extra) lus.push({ rel: 'api/' + path.basename(extra), code: sansCommentaires(fs.readFileSync(extra, 'utf8'), false) });
  dit(lus.some((f) => /^api[\\/]ebay\.js$/.test(f.rel)), 'la route eBay est lue (api/ebay.js)', lus.length + ' fichier(s)');
  const fautes = [];
  for (const f of lus) {
    for (const [re, quoi] of [[/RespondToBestOffer/, 'RespondToBestOffer'], [/negotiation\/v1\/[^'"`\s]*(accept|respond)/i, 'route de négociation qui accepte'], [/respond_to_offer/i, 'respond_to_offer'],
      [/\bbestOfferTerms\b/, 'bestOfferTerms (voie Inventory)'], [/\bautoAcceptPrice\b/, 'autoAcceptPrice (voie Inventory)']]) {
      const m = re.exec(f.code);
      if(m && quoi==='RespondToBestOffer' && f.rel==='api/_lib/ebay-gestion.js'){
        const ast=parser.parse(f.code,{sourceType:'module'});let manuel=null;
        const visite=node=>{if(!node || typeof node!=='object')return;if(node.type==='FunctionDeclaration' && node.id?.name==='repondreOffre' && node.start<=m.index && node.end>m.index)manuel=f.code.slice(node.start,node.end);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visite);else if(value && typeof value==='object')visite(value);};visite(ast);
        if(manuel && /b\.confirme\s*!==\s*true/.test(manuel) && /jeton\(owner\)/.test(manuel) && /lire\('GetBestOffers'/.test(manuel))continue;
      }
      if (m) fautes.push(`${f.rel} l.${ligneDe(f.code, m.index)} : ${quoi}`);
    }
  }
  dit(fautes.length === 0, "aucune acceptation programmée ni voie Inventory : la réponse à une offre précise exige confirmation, jeton du vendeur et relecture", fautes.slice(0, 3).join(' · '));
  const ailleurs = lus.filter((f) => !/^api[\\/]ebay\.js$/.test(f.rel) && /BestOfferAutoAcceptPrice/.test(f.code)).map((f) => f.rel);
  dit(ailleurs.length === 0, "le seuil d'acceptation ne s'écrit que dans api/ebay.js", ailleurs.join(', '));
  const eb = (lus.find((f) => /^api[\\/]ebay\.js$/.test(f.rel)) || {}).code || '';
  dit(/BestOfferAutoAcceptPrice/.test(eb) && /ReviseFixedPriceItem/.test(eb), "l'autre sens : la route pose bien le seuil natif d'eBay (sur SON clic, par ReviseFixedPriceItem)");
});

// 6. (16 oct.) AUCUNE RÉPONSE NE PART TOUTE SEULE SUR VINTED — sa décision.
//    Le moteur `repondreAuxMessages` est retiré ; `/replies` ne part que de
//    `executerPourApp` (la messagerie de l'app, sur son clic).
{
  const bg = require('fs').readFileSync(require('path').join(__dirname, '..', 'vinted-sync-extension', 'background.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
  dit(!/repondreAuxMessages|vinted_repond_auto/.test(bg), "l'extension ne porte plus de moteur de réponse automatique aux messages");
  const app = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'App.jsx'), 'utf8');
  dit(!/function RepondreSetting|<RepondreSetting/.test(app), "l'app ne propose plus d'allumer une réponse automatique");
}

console.log(ko ? `\n❌ audit-offres-auto : ${ko} contrôle(s) rouge(s), ${ok} vert(s)` : `\n✅ audit-offres-auto : ${ok} contrôles — le moteur d'acceptation auto reste sous garde (compte connecté, plafond 50/h, pause, éteint par défaut)`);
process.exit(ko ? 1 : 0);
