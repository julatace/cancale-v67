#!/usr/bin/env node
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : CHAQUE NOTIFICATION A SA CIBLE, ET CHAQUE CIBLE SON CROCHET (5 nov.)
//         (node scripts/audit-cibles-notif.cjs)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (5 nov.) : « cliquer une notification amène directement sur ce qui
// est arrivé, mis en évidence, pour TOUTES les notifications de VRM ».
//   1. Chaque destination du serveur (`api/_lib/lien-notif.js`, EXÉCUTÉE) donne
//      une adresse que l'app sait lire (`lireCible`), et une identité absente
//      rend l'écran nu (jamais une cible vide qui viserait « la première »).
//   2. Chaque type de cible a, dans l'app, AU MOINS UN élément qui porte son
//      crochet `data-cible` (un type sans crochet ne mettrait rien en évidence).
//   3. `attrCible` n'écrit jamais un jeton sans identité ; « 007 » = « 7 ».
//   4. Les routes envoient l'offre vers SA conversation (cible=offre) et la vente
//      Vestiaire vers SA ligne (cible=vcvente) ; les textes des notifications
//      fréquentes ne sont plus écrits en ligne dans la route (un propriétaire :
//      api/_lib/notif-apercus.js, que l'aperçu de Paramètres lit aussi).
//   5. L'aperçu de chaque famille existe et nomme où le toucher mène.
// Code d'avant (sans crochet, sans cible d'offre) ⇒ rouge.
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const lireF = (f) => { try { return fs.readFileSync(path.join(RACINE, f), 'utf8'); } catch (_) { return ''; } };
// Le code de l'app, commentaires retirés (§6.4 : juger la règle, pas un commentaire).
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const APP = ['src/App.jsx', 'src/CarteRelais.jsx'].map((f) => sansCommentaires(lireF(f))).join('\n');

(async () => {
  const imp = (f) => import('file://' + path.join(RACINE, f));
  let L = {}, C = {}, A = {}, T = {};
  try { L = await imp('api/_lib/lien-notif.js'); } catch (e) { dit(false, 'lien-notif.js se charge', e.message); }
  try { C = await imp('src/cibleNotif.js'); } catch (e) { dit(false, 'cibleNotif.js se charge', e.message); }
  try { A = await imp('api/_lib/notif-apercus.js'); } catch (e) { dit(false, 'api/_lib/notif-apercus.js existe et se charge', e.message.split('\n')[0]); }
  try { T = await imp('api/_lib/notif-textes.js'); } catch (_) {}
  const D = L.DESTINATIONS || {};
  const lire = (url) => C.lireCible ? C.lireCible(new URLSearchParams(String(url).split('?')[1] || '')) : null;

  console.log('── 1. Les destinations du serveur, lues par l’app');
  const CAS = [
    ['vente', () => D.vente({ tx: '7001' }), 'vente'],
    ['colis', () => D.colis({ tx: '7001' }), 'colis'],
    ['rappel colis', () => D.colis({}), 'colonne'],
    ['retrait (suivi)', () => D.retrait({ suivi: '87654321' }), 'retrait'],
    ['retrait (tx)', () => D.retrait({ tx: '9401' }), 'retrait'],
    ['achat', () => D.achat({ tx: '9401' }), 'achat'],
    ['message', () => D.message({ conv: '303', compte: '111' }), 'conv'],
    ['offre', () => D.offre && D.offre({ conv: '301', compte: '111' }), 'offre'],
    ['offres', () => D.offres(), 'offres'],
    ['vente Vestiaire', () => D.vcVente && D.vcVente({ id: '48213' }), 'vcvente'],
    ['URSSAF', () => D.urssaf(), 'urssaf'],
    ['double vente', () => D.doublon({ plat: 'leboncoin', num: '40' }), 'doublon'],
  ];
  const typesVus = new Set();
  for (const [nom, f, type] of CAS) {
    let url = null; try { url = f(); } catch (_) {}
    const c = url ? lire(url) : null;
    if (c) typesVus.add(c.type);
    dit(!!c && c.type === type, `${nom} : l’adresse porte une cible « ${type} » que l’app lit`, url || 'pas de destination');
  }
  // Identité absente : l'écran s'ouvre nu (aucune cible), jamais une cible vide.
  const nues = [['vente', D.vente && D.vente({})], ['offre', D.offre && D.offre({})], ['vente Vestiaire', D.vcVente && D.vcVente({})], ['message', D.message && D.message({})]];
  for (const [nom, url] of nues) dit(!!url && !lire(url) || (!!url && lire(url) && lire(url).type === 'colonne'), `${nom} sans identité : l’écran s’ouvre nu, sans cible inventée`, url || 'absent');

  console.log('\n── 2. Chaque type de cible a son crochet `data-cible` dans l’app');
  const crochet = {
    vente: /attrCible\(\['vente',/, vcvente: /attrCible\(\['vcvente',/, colis: /attrCible\(\['colis',/,
    retrait: /attrCible\(\['retrait', '(?:tx|suivi)'/, achat: /attrCible\(\[['"]achat['"],/, conv: /attrCible\(\['conv',/,
    offre: /data-cible=\{off\?'offre':undefined\}/, offres: /data-cible="offres"/, urssaf: /data-cible="urssaf"/,
    colonne: /data-cible="colonne:prets colonne:attente"/, doublon: /attrCible\(\['doublon', 'ebay'|\['doublon', 'leboncoin'/,
  };
  for (const [type, re] of Object.entries(crochet)) dit(re.test(APP), `type « ${type} » : un élément de l’app porte son crochet`);
  // (revue du 5 nov.) Une carte d'offre ne porte le crochet QUE si le fil a une offre (jamais « Faire une offre »).
  // Seule la carte « annonce partie » (une offre CAPTURÉE) le porte sans condition.
  const sansCond = (APP.match(/data-cible="offre"[^>]*/g) || []);
  dit(sansCond.length === 1 && /data-offre="annonce-partie"/.test(sansCond[0]), 'aucune carte d’offre ne porte le crochet sans offre (« Faire une offre » n’est jamais « l’offre »)', sansCond.map((x) => x.slice(0, 60)).join(' | '));
  // (revue du 5 nov.) Une vente Vestiaire rangée par l'extension a pour clé l'id de la vente, le productId en champ :
  // la ligne porte les DEUX (la notification n'a que le productId).
  dit(/attrCible\(\['vcvente', v\.id\], \['vcvente', v\.productId\]\)/.test(APP), 'vente Vestiaire : la ligne porte sa clé ET son productId (identité de l’e-mail)');
  dit(/'data-cible':\s*cibleRetrait\(x\.cle\)/.test(APP) && (APP.match(/'data-cible':\s*cibleRetrait\(x\.cle\)/g) || []).length === 2, 'les DEUX dessins de la ligne « À retirer » portent le crochet (ancienne carte et ligne Fusion)');

  console.log('\n── 3. Le jeton : jamais sans identité');
  const ac = C.attrCible;
  dit(typeof ac === 'function', '`attrCible` existe');
  if (typeof ac === 'function') {
    dit(ac(['vente', '']) === undefined && ac(['vente', null]) === undefined, 'identité vide ⇒ aucun attribut (jamais « vente: »)', String(ac(['vente', ''])));
    dit(ac(['vente', '7001'], ['colis', '7001']) === 'vente:7001 colis:7001', 'deux jetons séparés par un espace', ac(['vente', '7001'], ['colis', '7001']));
    dit(ac(['doublon', 'leboncoin', '007']) === 'doublon:leboncoin:7', '« 007 » = « 7 » (la clé du N°, `cleNum`)', ac(['doublon', 'leboncoin', '007']));
    dit(ac(['vente', 'a b']) === undefined && ac(['inconnu', '1']) === undefined, 'identité mal formée ou type inconnu ⇒ rien');
    const s = C.selecteursCible(C.lireCible({ cible: 'retrait', suivi: '87654321' }));
    dit(s.essais[0] === '[data-cible~="retrait:suivi:87654321"]' && s.ouvrir === '.vrm-rpf-ouvrir', 'colis arrivé : le crochet d’abord, et la ligne s’OUVRE (son code)', JSON.stringify({ e: s.essais[0], o: s.ouvrir }));
    const o = C.selecteursCible(C.lireCible({ cible: 'offre', conv: '301', compte: '111' }));
    dit(o.essais[0] === '[data-cible~="conv:111:301"]' && o.puis === '[data-cible~="offre"]', 'offre : la conversation, puis la carte de l’offre', JSON.stringify({ e: o.essais[0], p: o.puis }));
  }

  console.log('\n── 4. Les routes');
  const inbound = sansCommentaires(lireF('api/email-inbound.js'));
  dit(/tag: `offer-\$\{key\}`, url: DESTINATIONS\.offre\(/.test(inbound), 'l’e-mail « Nouvelle offre » ouvre l’OFFRE (cible=offre), plus seulement la conversation');
  dit(/url: DESTINATIONS\.vcVente\(\{ id: v\.productId \}\)/.test(inbound), 'l’e-mail de vente Vestiaire ouvre SA vente');
  const enLigne = ["title: '💸 Vendu !'", "title: '💰 Argent reçu'", "title: 'Vendu sur Vestiaire'", "'📦 Bordereau prêt à imprimer'", 'title: `💰 Offre', 'title: `💬 '];
  const restes = enLigne.filter((t) => inbound.includes(t));
  dit(restes.length === 0, 'les textes Vendu / Argent reçu / Vestiaire / Bordereau / Offre / Message ne sont plus écrits dans la route (un propriétaire : notif-apercus.js)', restes.join(' · '));
  dit(/texteVendu\(|texteMessage\(|texteOffre\(/.test(inbound), 'la route appelle les fabriques de textes');

  console.log('\n── 5. L’aperçu de Paramètres → Notifications');
  const fams = (T.FAMILLES || []).map((f) => f.id);
  for (const id of fams) {
    const ap = A.apercuFamille ? A.apercuFamille(id) : null;
    dit(!!ap && ap.exemples.length > 0 && ap.exemples.every((e) => e.title && e.body && e.mene), `famille « ${id} » : un aperçu (titre, texte, où il mène)`, ap ? `${ap.exemples.length} exemple(s)` : 'absent');
  }
  if (A.texteVendu && A.texteMessage) {
    const v = A.texteVendu({ article: 'X', prix: '10', compte: 'c' });
    // (8 nov., « de belles notifications ») Les textes ont été refaits : le titre dit le
    // fait, le corps l'objet et le geste (docs/passation/2026-11-08-notifications.md).
    dit(v.title === 'Vendu · 10 €' && v.body === 'X · c · Prépare le colis, le bordereau suit par e-mail', 'texte « Vendu » : le fait (le prix), l’objet, le geste', JSON.stringify(v));
    const m = A.texteMessage({ paire: 'P', qui: 'q', compte: 'c', extrait: '' });
    dit(m.title === 'Message de q' && m.body === 'P · sur c · Réponds dans Messages', 'texte « Message » : qui écrit, la paire, le geste', JSON.stringify(m));
  }

  // (revue du 5 nov.) Aucun aperçu rédigé à la main : chacun sort de la fabrique du vrai texte.
  const srcAp = sansCommentaires(lireF('api/_lib/notif-apercus.js'));
  dit(!/exemple:\s*true/.test(srcAp) && !/title:\s*['"`][^'"`]*['"`],\s*body:/.test(srcAp.slice(srcAp.indexOf('APERCUS_NOTIF'))), 'aucun aperçu écrit à la main (chacun sort de la fabrique du vrai texte)');
  const cron = sansCommentaires(lireF('api/ship-reminders.js'));
  dit(/\.\.\.texteOffresMini\(n\)/.test(cron) && /DESTINATIONS\.offre\(uneSeule\)/.test(cron), 'rappel « offres au mini » : son texte vient de notif-apercus.js, une seule offre ouvre L’OFFRE');
  dit(/import \{[^}]*texteSoir[^}]*\} from '\.\/_lib\/notif-apercus\.js'/.test(cron) && !/export function texteSoir/.test(cron), 'rappel du soir : un seul texte, celui de l’aperçu');
  dit(/\.\.\.texteAnnulation\(/.test(inbound), 'annulation demandée : son texte vient de notif-apercus.js');
  if (A.texteOffresMini) dit(JSON.stringify(A.texteOffresMini(1)) === JSON.stringify({ title: 'Une offre au-dessus de ton prix mini', body: 'À accepter en 1 tap dans VRM.' }), 'texte « offres au mini » identique à celui d’avant');

  console.log(ko ? `\n❌ audit-cibles-notif : ${ko} rouge(s)` : '\n✅ audit-cibles-notif : tout est vert');
  process.exit(ko ? 1 : 0);
})();
