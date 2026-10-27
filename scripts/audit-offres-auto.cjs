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

// ── 1. La route d'acceptation n'existe que dans la liste blanche ────────────
essaie('route accept', () => {
  const debut = BG.indexOf('EXEC_PERMIS');
  const fin = debut >= 0 ? BG.indexOf('];', debut) : -1;
  const hors = [];
  const re = /accept/g; let m;
  while ((m = re.exec(BG))) {
    if (debut >= 0 && m.index > debut && m.index < fin) continue;           // la liste blanche
    const autour = BG.slice(Math.max(0, m.index - 60), m.index + 30);
    // `Accept:` / `'accept'` d'un en-tête HTTP ne sont pas une offre
    if (/offer|offre|\/accept\b|quoi\s*:\s*['"]accept/i.test(autour)) hors.push('l.' + ligneDe(BG, m.index) + ' « ' + autour.replace(/\s+/g, ' ').trim().slice(0, 70) + ' »');
  }
  dit(debut >= 0, "l'extension garde sa liste blanche des actions permises (EXEC_PERMIS)");
  dit(hors.length === 0, "aucun code de l'extension ne construit l'acceptation d'une offre hors de la liste blanche",
    hors.slice(0, 3).join(' · '));
});

// ── 2. Aucun reste du moteur ────────────────────────────────────────────────
essaie('restes du moteur', () => {
  const restes = ['autoAccepterOffres', 'offresAutoActif', 'offresEnAttente', 'saluerAcheteurApresOffre', 'repondreOffre',
    'OFFRE_SALUT', 'OFFRES_MAX_PAR_VISITE', 'panel_min_prices', 'vrmAutoOffres', 'offresAutoLocal']
    .filter((n) => new RegExp('\\b' + n + '\\b').test(BG));
  dit(restes.length === 0, "aucun reste du moteur d'acceptation dans l'extension", restes.join(', '));
  dit(!/\bfunction\s+planchers\b/.test(BG), "plus aucune lecture des prix planchers dans l'extension");
});

// ── 3. L'app : un prix MINI + acceptation en 1 TAP, jamais une boucle ────────
// Décision de Julien, 27 octobre : « à côté du numéro on met un prix minimum et
// tout ce qui est au-dessus est accepté », puis « fais en sorte que je ne sois
// pas bloqué, trouve quelque chose ». Sur Vinted il n'y a PAS de seuil natif
// (contrairement à eBay) : un PROGRAMME qui accepte = signal robot = le compte
// bloqué (`vanessa5723`, §3). La seule voie sans blocage : un prix mini met
// l'offre en avant, et c'est le TAP de Julien qui accepte (voie `vmrExec` /
// EXEC_PERMIS, garde stricte, plafond, une requête à la fois — déjà couverte
// par les contrôles 1, 2 et 4). Ce qui doit rester vrai côté app :
//   · pas de capacité « offres » rallumée (ce serait l'ancien moteur) ;
//   · AUCUNE acceptation déclenchée par une minuterie ou un effet : chaque
//     `actionOffre('accept', …)` part d'un `onClick` — jamais seule ;
//   · là où l'app met une offre en avant pour l'accepter, elle DIT que rien
//     n'est accepté tout seul (la garde est EXIGÉE, pas un mot interdit — §6.5,
//     sinon la phrase honnête « rien n'est accepté tout seul » serait rouge).
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
  // Là où le prix mini met une offre en avant, la garde d'honnêteté est présente.
  const miniPose = /data=["']min["']|updatePair\(item,\s*\{\s*min:/.test(APP);
  dit(miniPose, "le prix mini d'acceptation existe (data=\"min\")");
  if (miniPose) dit(/rien n['’]est accepté tout seul/i.test(APP),
    "l'app DIT que rien n'est accepté tout seul (la garde d'honnêteté, pas un mot interdit)");
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

console.log(ko ? `\n❌ audit-offres-auto : ${ko} contrôle(s) rouge(s), ${ok} vert(s)` : `\n✅ audit-offres-auto : ${ok} contrôles — rien n'accepte une offre tout seul`);
process.exit(ko ? 1 : 0);
