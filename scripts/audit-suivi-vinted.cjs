// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — 5.215 : LE SUIVI QUE VINTED MONTRE DE SES ACHATS, ET LA NOTIFICATION
//  D'UNE ÉTAPE DE PLUS (node scripts/audit-suivi-vinted.cjs [--mutation nom])
//
//  Julien : « enregistrer le numéro de suivi et tracer le colis » ; « que ça me
//  prévienne dès qu'il y a une mise à jour d'un colis ». On EXÉCUTE le vrai code,
//  de bout en bout, sur des données INVENTÉES (le dépôt est public) — la réponse
//  servie contient exprès un nom, une adresse, un e-mail, un téléphone, un code
//  de retrait et un QR, pour prouver qu'aucun ne sort de la page ni n'est rangé :
//   A. la règle (`<suivi-regle>`) est la MÊME, texte pour texte, dans inject.js
//      et background.js (§11) ;
//   B. le VRAI `inject.js` (monde de la page) : une réponse GET 2xx de Vinted sur
//      les trois chemins ⇒ un message `suivi` : la FORME (jamais une valeur) et,
//      pour le suivi et l'expédition, le contenu ALLÉGÉ ; le code de retrait : sa
//      forme SEULEMENT ; rien pour un POST, un refus, un autre site, une erreur
//      de Vinted ; fetch ET XHR ; AUCUNE requête de plus ;
//   C. le VRAI `content.js` le relaie tel quel ;
//   D. le VRAI `background.js` (`_fond-vm.cjs` : base à état, projection
//      appliquée) : `harvest_{uid}_suivi_{tx}` à la forme du CONTRAT, seulement
//      pour un ACHAT de CE compte (jamais une vente, jamais un autre compte), la
//      forme dans `panel_formes_suivi`, rien sur une lecture ratée, la première
//      capture ne sonne pas, une capture identique ou plus ancienne ne réécrit
//      rien, un message forgé est relavé ;
//   E. la file des notifications : une seule fois, seulement sur une étape
//      PLUS RÉCENTE, gardée sur un échec / sans session, oubliée après 24 h,
//      rien au-delà de 72 h ;
//   F. `capterSuivisAchats` : 3 par visite, 6 par heure, une requête Vinted à
//      la fois, la garde du compte, pause / frein, mémo de 3 h, « pas su » ⇒
//      rien lu, jamais un achat livré ;
//   G. la VRAIE route `api/push.js` { action: 'suivi', tx, uid } : relit AU NOM
//      du vendeur, trois états, autre vendeur refusé, préférence coupée, > 72 h,
//      une fois par étape (la réservation `push_suivi_{tx}` écrite AVANT l'envoi,
//      par comparer-et-échanger) ;
//   H–K. (revue du 24 octobre, extension 5.215) deux réponses en même temps
//      (une écriture et un appel par étape, la file et les formes sérialisées) ;
//      une étape datée dans l'AVENIR n'est jamais la dernière ; une ligne de base
//      sans date ne sonne pas quand les dates arrivent ; la page de la commande
//      (escrow) est FUSIONNÉE au suivi, jamais à sa place ; la borne de 24 h
//      suit l'étape à annoncer ; la liste blanche lave aussi « remis à … »,
//      « déposé par … », un code « est le … » et un code sous une clé d'état ;
//      le suivi ne prend pas les lectures de l'argent et des colis (6 par heure,
//      sous leur réserve) ; une forme jamais reconnue n'est lue qu'une fois ; un
//      achat déjà arrivé n'est plus relu. Côté route : la réservation de l'étape
//      est ATOMIQUE (comparer-et-échanger), la clé est le LIBELLÉ (jamais
//      l'instant), l'arrivée au point relais déjà annoncée par l'e-mail ou la
//      conversation se tait, une étape datée dans l'avenir ne sonne pas.
//   L. (29 octobre) l'ordre de lecture : les achats au point relais (jamais
//      lus, puis déjà lus) AVANT ceux en route jamais lus, puis ceux en route
//      déjà lus — mutation `priorite-relais` (le tri par date seule d'avant).
//  Mutations (§6.1) : `--mutation nom` (la liste : `--mutation ?`).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os');
const { faireFond, projette } = require('./_fond-vm.cjs');
const racine = path.join(__dirname, '..');
const lireOpt = (r) => { try { return fs.readFileSync(path.join(racine, r), 'utf8'); } catch (_) { return ''; } };
const F = {
  bg: lireOpt('vinted-sync-extension/background.js'),
  inject: lireOpt('vinted-sync-extension/inject.js'),
  content: lireOpt('vinted-sync-extension/content.js'),
  lib: lireOpt('api/_lib/suivi-vinted.js'),
};

// ── RÉAFFAIBLIR UNE RÈGLE (§6.1) ────────────────────────────────────────────
// Les lignes exactes de la règle que deux mutations réaffaiblissent.
const REMIS = "    .replace(/\\b(remis(?:e|es)?\\s+[àa]|d[ée]pos[ée](?:e|es|s)?\\s+par|livr[ée](?:e|es|s)?\\s+[àa])(?![a-zà-ÿ])\\s*:?\\s*(?:(?!\\s(?:au|aux|en|dans|chez|depuis|via)\\b)[^,.;\\n…])+/gi, '$1 …');";
const PERSONNE = 'const SUIVI_PARENT_PERSONNE = /(?:contact|person|recipient|destinataire|owner|user|customer|client|buyer|seller|sender|expediteur|receiver|holder|member|membre)/i;';
const MUTATIONS = {
  // la liste blanche ne retire plus rien (la page ET le fond : la règle reste la même des deux côtés)
  'liste-blanche': [['inject', `const garde = marche(racine, '', 0) || {};`, `const garde = JSON.parse(JSON.stringify(racine || {}));`],
                    ['bg', `const garde = marche(racine, '', 0) || {};`, `const garde = JSON.parse(JSON.stringify(racine || {}));`]],
  // le fond rangerait une transaction sans vérifier que c'est un ACHAT de ce compte
  achat: [['bg', `.find((x) => /^\\d{4,20}$/.test(x) && achats.has(x));`, `.find((x) => /^\\d{4,20}$/.test(x));`]],
  // la toute première lecture d'un colis sonnerait (une rafale à l'installation)
  premiere: [['bg', `return { ecrire: true, nouveau: false, raison: 'premiere',`, `return { ecrire: true, nouveau: true, raison: 'premiere',`]],
  // une capture identique réécrirait
  inchange: [['bg', `const { etapes, change } = fusionEtapesSuivi(avant.etapes, neuf.etapes, voiesDifferentes);`, `const { etapes } = fusionEtapesSuivi(avant.etapes, neuf.etapes, voiesDifferentes); const change = true;`]],
  // plus de borne par visite
  'par-visite': [['bg', `const SUIVI_MAX_PAR_VISITE = 3;`, `const SUIVI_MAX_PAR_VISITE = 30;`]],
  // plus de mémo de 3 h
  'memo-3h': [['bg', `const aLire = (o) => { const tx = String(o.transaction_id); return !(memo[tx] && Date.now() - Number(memo[tx]) < SUIVI_RETRY_MS); };`, `const aLire = (o) => true;`]],
  // plus de garde (compte du cookie, pause, budget)
  garde: [['bg', `const refus = await gardeLecture(uid, acc, 'suivi');`, `const refus = null;`]],
  // une lecture ratée de la ligne vaudrait « rien encore »
  'lecture-ratee': [['bg', `const rows = await sbGet(\`app_data?id=eq.\${id}&select=d:data->dernier`, `let rows = await sbGet(\`app_data?id=eq.\${id}&select=d:data->dernier`],
                    ['bg', `if (rows === null) { noterDiag('suivi_lecture_ratee'); return null; }       // pas su : on n'écrase rien`, `if (rows === null) rows = [];`]],
  // la route oublierait que l'étape est déjà réservée
  deja: [['lib', `if (reserve === false) return { status: 200, envoye: false, raison: 'deja' };`, ``]],
  // la route sonnerait pour une étape ancienne
  age: [['lib', `if (!(at > Date.now() - SUIVI_NOTIF_AGE_MAX_MS)) return { status: 200, envoye: false, raison: 'ancien' };`, ``]],
  // la route ne vérifierait plus que le compte Vinted est à CE vendeur
  vendeur: [['lib', `if (!comptes.some((c) => String(c && c.vinted_user_id) === uid)) return { status: 403, raison: 'compte' };`, ``]],
  // une réservation illisible vaudrait « jamais envoyée »
  'memo-passu': [['lib', `if (reserve === null) return { status: 503, raison: 'pas-su' };`, ``]],
  // la préférence « suivi » ne serait plus lue
  preference: [['lib', `if (!(await pushCategorieActive('suivi'))) return { status: 200, envoye: false, raison: 'preference' };`, ``]],
  // ── revue du 24 octobre ──
  // la réservation n'est plus atomique (écriture sans condition, insertion qui écrase)
  cas: [['lib', "const cond = rev0 == null ? 'data->>rev=is.null' : `data->>rev=eq.${rev0}`;", "const cond = 'id=not.is.null';"],
        ['lib', `Prefer: 'resolution=ignore-duplicates,return=representation' },`, `Prefer: 'resolution=merge-duplicates,return=representation' },`]],
  // la route sonnerait pour une étape datée dans l'avenir
  'futur-route': [['lib', `if (at > Date.now() + SUIVI_FUTUR_TOLERE_MS) return { status: 200, envoye: false, raison: 'futur' };`, ``]],
  // l'arrivée au point relais déjà annoncée par l'e-mail ou la conversation ne ferait plus taire la route
  relais: [['lib', `if (keys.some((k) => typeof k === 'string' && (prefixes.some((p) => k.startsWith(p)) || (cleCode && k === cleCode)))) {`, `if (false) {`]],
  // la clé de l'étape reprend l'instant et le code (deux voies, deux clés)
  'cle-instant': [['lib', "update(`${tx}|${libelleEtape(e && e.t)}`)", "update(`${tx}|${(e && e.at) || ''}|${libelleEtape(e && e.t)}|${(e && e.code) || ''}`)"]],
  // une étape datée jusqu'à un jour dans l'avenir redevient une étape (la livraison estimée)
  futur: [['inject', `const SUIVI_FUTUR_MS = 10 * 60000;`, `const SUIVI_FUTUR_MS = 86400000;`], ['bg', `const SUIVI_FUTUR_MS = 10 * 60000;`, `const SUIVI_FUTUR_MS = 86400000;`]],
  // « remis à … », « déposé par … » ne sont plus lavés
  'remis-a': [['inject', REMIS, `    .replace(/(?!)/g, '');`], ['bg', REMIS, `    .replace(/(?!)/g, '');`]],
  // une valeur d'état qui n'a pas la forme d'un code machine redevient un code (jamais lavé)
  'code-machine': [['inject', `if (typeof v === 'string' && !SUIVI_CODE_MACHINE.test(v.trim())) return { sorte: 'texte', v };`, `if (typeof v === 'string' && v.length > 40) return { sorte: 'texte', v };`],
                   ['bg', `if (typeof v === 'string' && !SUIVI_CODE_MACHINE.test(v.trim())) return { sorte: 'texte', v };`, `if (typeof v === 'string' && v.length > 40) return { sorte: 'texte', v };`],
                   ['inject', `if ((typeof x === 'string' && SUIVI_CODE_MACHINE.test(x.trim()) && x !== t) || typeof x === 'number')`, `if ((typeof x === 'string' && x.trim() && x.length <= 40 && x !== t) || typeof x === 'number')`],
                   ['bg', `if ((typeof x === 'string' && SUIVI_CODE_MACHINE.test(x.trim()) && x !== t) || typeof x === 'number')`, `if ((typeof x === 'string' && x.trim() && x.length <= 40 && x !== t) || typeof x === 'number')`]],
  // « est le 482913 » n'est plus reconnu comme un code
  'est-le': [['inject', `(?:[:：=]|est(?:\\s+(?:le|la))?|is)?`, `(?:[:：=]|est|is)?`], ['bg', `(?:[:：=]|est(?:\\s+(?:le|la))?|is)?`, `(?:[:：=]|est|is)?`]],
  // le nom d'un contact sous un parent « pickup » repasse pour celui du point relais
  personne: [['inject', PERSONNE, `const SUIVI_PARENT_PERSONNE = /(?!)/;`], ['bg', PERSONNE, `const SUIVI_PARENT_PERSONNE = /(?!)/;`]],
  // le rangement d'un colis n'est plus sérialisé
  'chaine-suivi': [['bg', `const suite = avant.then(() => rangerSuiviUn(uid, tx, contrat, source, forme), () => rangerSuiviUn(uid, tx, contrat, source, forme));`, `const suite = rangerSuiviUn(uid, tx, contrat, source, forme);`]],
  // la file des notifications n'est plus sérialisée
  'chaine-notifs': [['bg', `function unNotifSuiviALaFois(fn) {\n  const suite = _chaineNotifsSuivi.then(() => fn(), () => fn());`, `function unNotifSuiviALaFois(fn) {\n  const suite = Promise.resolve().then(() => fn());`]],
  // les formes ne sont plus écrites une à la fois
  'chaine-formes': [['bg', `const suite = _chaineFormesSuivi.then(() => rangerFormeSuiviUn(quoi, forme, etat), () => rangerFormeSuiviUn(quoi, forme, etat));`, `const suite = rangerFormeSuiviUn(quoi, forme, etat);`]],
  // la borne de 24 h reste celle de la PREMIÈRE mise en file de l'achat
  'borne-24h': [['bg', `f[k] = { uid: String(uid), tx: String(tx), at: Date.now(), essais: 0 };`, `f[k] = { uid: String(uid), tx: String(tx), at: (f[k] && f[k].at) || Date.now(), essais: (f[k] && f[k].essais) || 0 };`]],
  // la ligne de base sans date : la première date lue sonnerait
  'base-sans-date': [['bg', `else nouveau = !(avant.etapes || []).some((e) => e && libelleSuivi(e.t) === libelleSuivi(dernier.t));`, `else nouveau = true;`]],
  // une capture remplace les étapes au lieu de les fusionner (l'escrow d'une étape efface le suivi)
  'escrow-remplace': [['bg', `const { etapes, change } = fusionEtapesSuivi(avant.etapes, neuf.etapes, voiesDifferentes);`, `const { etapes, change } = { etapes: trierEtapesSuivi((neuf.etapes || []).filter((e) => e && e.t)), change: true };`]],
  // le suivi redevient une lecture prioritaire, sans plafond horaire
  budget: [['bg', `const refus = await gardeLecture(uid, acc, 'suivi');`, `const refus = await gardeLecture(uid, acc, 'colis');`], ['bg', `const SUIVI_MAX_HEURE = 6;`, `const SUIVI_MAX_HEURE = 600;`]],
  // une forme jamais reconnue est relue toutes les 3 h sur chaque achat
  'forme-inconnue': [['bg', `    if (await formeSuiviInconnue()) {`, `    if (false) {`],
                     ['bg', `        noterDiag('suivi_forme_inattendue_journey');\n        break;`, `        noterDiag('suivi_forme_inattendue_journey');\n        continue;`],
                     ['bg', `        memo[tx] = Date.now() + SUIVI_INCONNU_MS - SUIVI_RETRY_MS;`, `        memo[tx] = Date.now();`]],
  // un achat déjà arrivé (dernière étape « disponible ») est relu quand même
  arrive: [['bg', `  if (da && SUIVI_ARRIVE.test(da.t || '')) return false;`, ``]],
  // ── 29 octobre ──
  // les achats au point relais ne passent plus devant (tri par date seule, comme avant)
  'priorite-relais': [['bg', `  return (relais ? 0 : 2) + (lu ? 1 : 0);`, `  return 0;`]],
};
const iM = process.argv.indexOf('--mutation');
const MUT = iM > 0 ? process.argv[iM + 1] : '';
if (MUT) {
  if (!MUTATIONS[MUT]) { console.log(`mutation inconnue : ${MUT} (${Object.keys(MUTATIONS).join(', ')})`); process.exit(2); }
  for (const [f, de, vers] of MUTATIONS[MUT]) {
    const n = F[f].split(de).length - 1;
    if (n !== 1) { console.log(`❌ mutation ${MUT} : ancre trouvée ${n} fois dans ${f} — mets la mutation à jour`); process.exit(1); }
    F[f] = F[f].replace(de, vers);
  }
  console.log(`(mutation « ${MUT} »)`);
}
const BG = path.join(os.tmpdir(), `vrm-suivi-bg-${process.pid}.js`);
fs.writeFileSync(BG, F.bg);
// Une route mutée : une copie de `api/` DANS le dépôt (ses dépendances se
// résolvent par `node_modules` en remontant), effacée à la fin.
let API = path.join(racine, 'api'), API_COPIE = null;
if (MUT && MUTATIONS[MUT].some(([f]) => f === 'lib')) {
  API_COPIE = path.join(racine, `.audit-suivi-${process.pid}`);
  fs.cpSync(path.join(racine, 'api'), path.join(API_COPIE, 'api'), { recursive: true });
  fs.writeFileSync(path.join(API_COPIE, 'api', '_lib', 'suivi-vinted.js'), F.lib);
  API = path.join(API_COPIE, 'api');
}
const nettoyer = () => { try { fs.unlinkSync(BG); } catch (_) {} if (API_COPIE) try { fs.rmSync(API_COPIE, { recursive: true, force: true }); } catch (_) {} };

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${det != null ? ' — ' + String(det).slice(0, 400) : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`); return null; } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Les données INVENTÉES ───────────────────────────────────────────────────
// Ce qui ne doit JAMAIS sortir de la page ni être rangé.
// (31 oct., 5.295) Le DESTINATAIRE habite Brest ; le point relais (un commerce,
// « 3 avenue des Tilleuls, 35000 Rennes ») est gardé exprès : c'est la
// destination du colis (`relaisDestination`). Ses mots ne sont donc plus des
// fuites — ceux du destinataire, si.
const PERSO = ['Jeanne', 'Inventée', 'Lilas', '29200', 'Brest', 'exemple.test', '06 12 34 56 78', 'C48291', 'qr-banc', '12 rue'];
const fuite = (o) => { const s = JSON.stringify(o == null ? null : o); return PERSO.filter((x) => s.includes(x)); };
// Un instant fixe pour tout l'audit : une même réponse relue rend les MÊMES dates
// (Vinted ne réécrit pas l'heure d'une étape passée).
const T0 = Date.now();
const H = (h) => new Date(T0 - h * 3600000).toISOString();
// Une forme PLAUSIBLE (jamais vue : c'est justement ce que l'extension va mesurer).
const corpsSuivi = (tx, etapes) => ({
  transaction_id: Number(tx),
  shipment: {
    carrier: { name: 'Transporteur Banc', code: 'TB' },
    tracking_number: 'TB12345678FR',
    recipient: { full_name: 'Jeanne Inventée', email: 'jeanne@exemple.test', phone_number: '06 12 34 56 78',
      address: { line1: '12 rue des Lilas', postal_code: '29200', city: 'Brest' } },
    pickup_point: { name: 'Relais Banc', address: '3 avenue des Tilleuls, 35000 Rennes', code: 'C48291', qr_code: 'https://qr.exemple.test/qr-banc-C48291' },
    journey: etapes.map(([h, title, code]) => ({ title, date: H(h), status_code: code })),
    summary: 'Bonjour Jeanne Inventée : ton colis t’attend au Relais Banc, 3 avenue des Tilleuls, 35000 Rennes. Ton code de retrait est C48291. Une question ? jeanne@exemple.test',
  },
});
const ETAPES = [[50, 'Commande expédiée', 'shipped'], [30, 'Colis pris en charge par le transporteur', 'in_transit'], [5, 'Colis disponible au Relais Banc — code de retrait C48291', 'at_pickup']];
const corpsCode = () => ({ code: 'C48291', qr_code_url: 'https://qr.exemple.test/qr-banc-C48291', pickup_point: { name: 'Relais Banc', address: '3 avenue des Tilleuls, 35000 Rennes' } });
const TXA = '30000000123', TXB = '30000000124', TXV = '30000000999', TXO = '30000000555', ESC = '40000007777', TXZ = '30000000126';
const CH = (tx) => `/api/v2/transactions/${tx}/shipment/journey_summary`;
const TYPES = /^(?:string|number|boolean|null|object|array)(?:\|(?:string|number|boolean|null|object|array))*$/;
const formePropre = (f) => !!f && typeof f === 'object' && Object.keys(f).length > 0 && Object.values(f).every((t) => TYPES.test(String(t)));

// ════════════════════════════════════════════════════════════════════════════
// La page (inject.js) et le relais (content.js), dans un `vm`
// ════════════════════════════════════════════════════════════════════════════
function mondePage(repondre) {
  const ecoute = {}, posts = [], demandes = [];
  const texteDe = (b) => (typeof b === 'string' ? b : JSON.stringify(b == null ? {} : b));
  class FauxXHR {
    constructor() { this._l = {}; this.status = 0; this.responseType = ''; }
    open(m, u) { this._m = m; this._u = u; }
    setRequestHeader() {}
    addEventListener(t, fn) { (this._l[t] = this._l[t] || []).push(fn); }
    getResponseHeader() { return 'application/json'; }
    send() { demandes.push({ m: this._m, u: this._u, par: 'xhr' }); setTimeout(() => { const r = repondre(this._m, this._u); this.status = r.status; this.responseText = texteDe(r.body); (this._l.load || []).forEach((fn) => fn.call(this)); }, 1); }
  }
  const g = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 2)), clearTimeout, setInterval: () => 0, clearInterval,
    URL, Headers: class {}, btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    location: { host: 'www.vinted.fr', hostname: 'www.vinted.fr', origin: 'https://www.vinted.fr', href: 'https://www.vinted.fr/transaction/1' },
    document: { hidden: true, addEventListener() {} },
    localStorage: { getItem: () => String(Date.now()), setItem() {} },     // la moisson de la page ne démarre pas
    addEventListener(type, fn) { (ecoute[type] = ecoute[type] || []).push(fn); },
    postMessage(data) { posts.push(data); },
    XMLHttpRequest: FauxXHR,
    fetch: async (url, init) => {
      const m = String((init && init.method) || 'GET');
      demandes.push({ m, u: String(url), par: 'fetch' });
      const r = repondre(m, String(url)); const t = texteDe(r.body);
      return { ok: r.status < 400, status: r.status, headers: { get: () => 'application/json' }, text: async () => t, json: async () => JSON.parse(t), clone() { return this; } };
    },
  };
  g.window = g; g.self = g; g.globalThis = g;
  vm.createContext(g);
  vm.runInContext(F.inject, g, { filename: 'inject.js' });
  return { g, posts, demandes, suivis: () => posts.filter((p) => p && p.kind === 'suivi') };
}
function relais(messagesPage) {
  const ecoute = {}, envoyes = [];
  const g = {
    console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout,
    location: { host: 'www.vinted.fr', hostname: 'www.vinted.fr' },
    document: { createElement: () => ({ remove() {} }), head: { appendChild() {} }, documentElement: { appendChild() {} } },
    addEventListener(type, fn) { (ecoute[type] = ecoute[type] || []).push(fn); },
    postMessage() {},
    chrome: { runtime: { id: 'x', getURL: (p) => 'chrome-extension://x/' + p, sendMessage: (m) => envoyes.push(m) },
      storage: { local: { get: (k, cb) => cb({}) }, onChanged: { addListener() {} } } },
  };
  g.window = g; g.self = g; g.globalThis = g;
  vm.createContext(g);
  vm.runInContext(F.content, g, { filename: 'content.js' });
  const fenetre = vm.runInContext('window', g);
  for (const d of messagesPage) for (const fn of (ecoute.message || [])) fn({ source: fenetre, data: d });
  return envoyes;
}

// ════════════════════════════════════════════════════════════════════════════
// Le fond (background.js)
// ════════════════════════════════════════════════════════════════════════════
const TAB = { tab: { id: 7, url: 'https://www.vinted.fr/transaction/1' }, url: 'https://www.vinted.fr/transaction/1' };
const commande = (tx, status, tus = 'waiting', h = 48, title) => ({ transaction_id: Number(tx), title: title || `Achat banc ${String(tx).slice(-3)}`, status, transaction_user_status: tus, date: H(h), conversation_id: 900000 + Number(String(tx).slice(-3)) });
const lignesDeBase = () => ({
  harvest_111_orders_purchased: { type: 'orders_purchased', payload: { my_orders: [commande(TXA, 'Colis expédié'), commande(TXB, 'En cours de livraison'), commande(TXZ, 'Colis expédié')] } },
  harvest_111_orders_sold: { type: 'orders_sold', payload: { my_orders: [commande(TXV, 'Colis expédié')] } },
  harvest_222_orders_purchased: { type: 'orders_purchased', payload: { my_orders: [commande(TXO, 'Colis expédié')] } },
});
// Branche le faux /api/push sur le fond (le compte des appels, le statut rendu).
function brancherPush(f, etat) {
  const f0 = f.ctx.fetch;
  f.ctx.fetch = async (u, o = {}) => {
    if (/vrm\.center\/api\/push/.test(String(u))) {
      etat.appels.push({ auth: (o.headers || {}).Authorization, body: JSON.parse(o.body || '{}') });
      return { ok: etat.statut < 400, status: etat.statut, json: async () => ({}) };
    }
    return f0(u, o);
  };
  f.ctx.authToken = async () => (etat.session ? { user_id: 'owner-banc', access_token: 'jeton.banc.suivi', expires_at: Date.now() + 3600000 } : null);
}
// La règle telle qu'elle est écrite dans la PAGE (inject.js), exécutée seule, et
// telle que le fond l'exécute.
const Ri = (() => { const i = F.inject.indexOf('// <suivi-regle>'), j = F.inject.indexOf('// </suivi-regle>'); if (i < 0 || j < i) return null; return vm.runInContext(F.inject.slice(i, j) + '\n;({ allegerSuivi, contratSuivi })', vm.createContext({ console })); })();
const f0Regle = () => faireFond({ src: BG, lignes: {} }).ctx;
const pagesVers = async (f, messages) => { for (const m of messages) { await f.envoyer(m, TAB); await pause(40); } };
const ecrits = (f, id) => f.j.posts.filter((ids) => ids.includes(id)).length;

(async () => {
  try {
    // ═══ A ═══════════════════════════════════════════════════════════════════
    console.log('── A. La règle est la même dans la page et dans le fond (§11)');
    await essaie('A', async () => {
      const bloc = (t) => { const i = t.indexOf('// <suivi-regle>'), j = t.indexOf('// </suivi-regle>'); return i >= 0 && j > i ? t.slice(i, j).split('\n').map((l) => l.trim()).join('\n') : null; };
      const bi = bloc(F.inject), bb = bloc(F.bg);
      dit(!!bi && !!bb, 'le bloc <suivi-regle> existe dans inject.js ET background.js', `${!!bi} ${!!bb}`);
      dit(!!bi && bi === bb, 'texte pour texte le même (une règle, deux exécutions)');
    });

    // ═══ B ═══════════════════════════════════════════════════════════════════
    console.log('\n── B. La page (VRAI inject.js) : la forme et le contenu ALLÉGÉ, rien d’autre');
    let postsPage = [];
    await essaie('B', async () => {
      const P = mondePage((m, u) => {
        if (/\/9999999999\//.test(u)) return { status: 200, body: { code: 106, message_code: 'not_found', message: 'Introuvable' } };
        if (/\/journey_summary/.test(u)) { const tx = (/transactions\/(\d+)/.exec(u) || [])[1]; return { status: 200, body: corpsSuivi(tx, ETAPES) }; }
        if (/\/escrow_orders\//.test(u)) return { status: 200, body: corpsSuivi(TXB, ETAPES.slice(0, 2)) };
        if (/parcel_collection_code/.test(u)) return { status: 200, body: corpsCode() };
        return { status: 200, body: {} };
      });
      await P.g.fetch(CH(TXA), { method: 'GET' }); await pause(30);
      const s = P.suivis();
      dit(s.length === 1 && s[0].quoi === 'journey' && s[0].id === TXA, 'une réponse 2xx du suivi ⇒ UN message « suivi » (journey, l’identifiant de l’adresse)', JSON.stringify(s.map((x) => [x.quoi, x.id])));
      const m = s[0] || {};
      dit(formePropre(m.forme), 'la FORME : des chemins de clés et des TYPES seulement', JSON.stringify(m.forme).slice(0, 200));
      dit(m.forme && m.forme['shipment.journey[].title'] === 'string' && m.forme['shipment.recipient.full_name'] === 'string', 'la forme nomme bien les champs (y compris ceux qu’on ne garde pas : c’est la mesure)', JSON.stringify(Object.keys(m.forme || {}).slice(0, 12)));
      dit(fuite(m).length === 0, 'AUCUN nom, adresse, e-mail, téléphone, code de retrait ni QR ne sort de la page', fuite(m).join(', '));
      const etapes = (((m.allege || {}).shipment || {}).journey) || [];
      dit(etapes.length === 3 && etapes.every((e) => e.title && e.date && e.status_code), 'les étapes (libellé, date, code) sont gardées', JSON.stringify(etapes));
      dit(/Relais Banc/.test(JSON.stringify(etapes)) && /code de retrait …/.test(JSON.stringify(etapes)), 'un libellé qui CITE le code de retrait le perd (« … »), le reste est gardé', JSON.stringify(etapes[2]));
      dit(m.allege && m.allege.shipment && m.allege.shipment.carrier && m.allege.shipment.carrier.name === 'Transporteur Banc' && m.allege.shipment.tracking_number === 'TB12345678FR', 'le transporteur et le n° de suivi sont gardés', JSON.stringify(m.allege && m.allege.shipment && { c: m.allege.shipment.carrier, n: m.allege.shipment.tracking_number }));
      dit(m.allege && m.allege.shipment && !('recipient' in m.allege.shipment) && !('qr_code' in (m.allege.shipment.pickup_point || {})) && !('code' in (m.allege.shipment.pickup_point || {})), 'le destinataire, le code et le QR du point relais ne sont même pas des clés du contenu', JSON.stringify(m.allege && m.allege.shipment && m.allege.shipment.pickup_point));
      dit(P.demandes.length === 1, 'AUCUNE requête de plus (la page n’a fait que la sienne)', P.demandes.length);

      // XHR, l'expédition (escrow) et son transaction_id lu dans le corps
      const x = new P.g.XMLHttpRequest(); x.open('GET', `/api/v2/escrow_orders/${ESC}/shipment`); x.send(); await pause(30);
      const e = P.suivis().find((y) => y.quoi === 'escrow') || {};
      dit(e.id === ESC && e.txCorps === TXB && fuite(e).length === 0, 'XHR aussi : la page d’une commande (escrow), son transaction_id lu DANS la réponse, sans donnée personnelle', JSON.stringify({ id: e.id, tc: e.txCorps, f: fuite(e) }));
      // le code de retrait : la forme SEULEMENT
      await P.g.fetch(`/api/v2/transactions/${TXA}/shipment/parcel_collection_code`); await pause(30);
      const c = P.suivis().find((y) => y.quoi === 'code') || {};
      dit(c.quoi === 'code' && formePropre(c.forme) && !('allege' in c) && fuite(c).length === 0, 'le code de retrait : sa FORME seulement (ni le code, ni le QR, ni le relais)', JSON.stringify(c).slice(0, 200));
      const n0 = P.suivis().length;
      await P.g.fetch(CH(TXA), { method: 'POST', body: '{}' });
      await P.g.fetch(`${CH(TXA)}/autre`);
      await P.g.fetch(CH('9999999999'));
      await P.g.fetch(`https://evil.example${CH(TXA)}`);
      await pause(40);
      dit(P.suivis().length === n0, 'rien pour un POST, une adresse qui ne correspond pas, un autre site, ni une erreur de Vinted', P.suivis().slice(n0).map((y) => y.id).join(' '));
      // une réponse refusée (403) sur le bon chemin
      const P2 = mondePage(() => ({ status: 403, body: corpsSuivi(TXA, ETAPES) }));
      await P2.g.fetch(CH(TXA)); await pause(30);
      dit(P2.suivis().length === 0, 'une réponse refusée (403) ne part pas');
      postsPage = P.suivis();
    });

    // ═══ C ═══════════════════════════════════════════════════════════════════
    console.log('\n── C. Le relais (VRAI content.js) transporte le message entier');
    let relayes = [];
    await essaie('C', async () => {
      relayes = relais(postsPage).filter((m) => m.kind === 'suivi');
      dit(relayes.length === postsPage.length && relayes.length >= 3, 'chaque message « suivi » arrive au fond', `${relayes.length}/${postsPage.length}`);
      const r = relayes[0] || {}, p = postsPage[0] || {};
      dit(r.from === 'cancale-content' && r.domain === 'www.vinted.fr' && JSON.stringify(r.forme) === JSON.stringify(p.forme) && JSON.stringify(r.allege) === JSON.stringify(p.allege), 'forme et contenu allégé intacts, `from` et `domain` posés par le relais');
    });

    // ═══ D ═══════════════════════════════════════════════════════════════════
    console.log('\n── D. Le fond (VRAI background.js) : le CONTRAT, pour un achat de CE compte seulement');
    await essaie('D', async () => {
      const lignes = lignesDeBase();
      const etat = { appels: [], statut: 200, session: true };
      const f = faireFond({ src: BG, lignes });
      brancherPush(f, etat);
      const journeyA = relayes.find((m) => m.quoi === 'journey' && m.id === TXA);
      if (!journeyA) { dit(false, 'un message de la page à rejouer', 'aucun'); return; }
      await pagesVers(f, [journeyA]);
      const l = lignes[`harvest_111_suivi_${TXA}`];
      dit(!!l, `harvest_111_suivi_${TXA} est rangée (un ACHAT du compte du cookie)`, JSON.stringify(Object.keys(lignes)));
      if (l) {
        dit(l.v === 1 && l.tx === TXA && l.source === 'passif' && !Number.isNaN(Date.parse(l.capturedAt)), 'v, tx, source « passif », capturedAt', JSON.stringify({ v: l.v, tx: l.tx, s: l.source, c: l.capturedAt }));
        dit(Array.isArray(l.etapes) && l.etapes.length === 3 && l.etapes.length <= 30 && l.etapes.every((e) => Object.keys(e).sort().join() === 'at,code,t'), 'des étapes { t, at, code } (30 au plus)', JSON.stringify(l.etapes));
        dit(l.etapes.every((e, i) => i === 0 || Date.parse(l.etapes[i - 1].at) >= Date.parse(e.at)) && l.dernier && JSON.stringify(l.dernier) === JSON.stringify(l.etapes[0]), 'la plus RÉCENTE d’abord, et `dernier` = elle', JSON.stringify(l.dernier));
        dit(l.transporteur === 'Transporteur Banc' && l.suivi === 'TB12345678FR', 'le transporteur et le n° de suivi', `${l.transporteur} ${l.suivi}`);
        dit(formePropre(l.forme), 'la forme rangée : des types seulement', JSON.stringify(l.forme).slice(0, 160));
        dit(fuite(l).length === 0, 'la ligne rangée ne porte aucune donnée personnelle', fuite(l).join(', '));
        const cles = Object.keys(l).sort().join();
        dit(cles === 'arriveeEstimee,capturedAt,dernier,etapes,forme,lieuLuAt,n,relaisCp,relaisNom,relaisRue,relaisVille,source,suivi,transporteur,tx,v', 'aucune autre clé que celles du CONTRAT (et `n`, le nombre d’étapes ; 5.295 : le point relais de destination et l’arrivée estimée)', cles);
        dit(l.relaisNom === 'Relais Banc' && l.relaisRue === '3 avenue des Tilleuls' && l.relaisCp === '35000' && l.relaisVille === 'Rennes', '5.295 : le point relais OÙ le colis arrive (nom, rue, code postal, ville), lu sous `pickup_point` — jamais l’adresse du destinataire', JSON.stringify({ n: l.relaisNom, r: l.relaisRue, c: l.relaisCp, v: l.relaisVille }));
        dit(l.arriveeEstimee === null, '5.295 : aucune clé d’ESTIMATION dans la réponse ⇒ arrivée estimée `null` (jamais devinée)', String(l.arriveeEstimee));
        dit(l.n === l.etapes.length, '`n` = le nombre d’étapes rangées (un scalaire, lu par l’app sans les décompresser)', `${l.n} ${l.etapes.length}`);
      }
      const pf = lignes.panel_formes_suivi || {};
      dit(pf.v === 1 && pf.journey && formePropre(pf.journey.forme) && pf.journey.etat === 'reconnue' && fuite(pf).length === 0, 'panel_formes_suivi : la forme du suivi, « reconnue », sans valeur', JSON.stringify(pf).slice(0, 200));
      dit(etat.appels.length === 0, 'la PREMIÈRE lecture d’un colis ne sonne pas (c’est la ligne de base)', etat.appels.length);
      dit(f.j.evts.some((e) => e && e.quoi === 'suivi' && e.tx === TXA && e.uid === '111'), 'l’app est prévenue (maj · suivi · uid · tx)', JSON.stringify(f.j.evts.slice(-2)));

      const avant = ecrits(f, `harvest_111_suivi_${TXA}`);
      await pagesVers(f, [journeyA]);
      dit(ecrits(f, `harvest_111_suivi_${TXA}`) === avant && etat.appels.length === 0, 'la même étape relue : rien n’est réécrit, rien ne sonne', `${ecrits(f, `harvest_111_suivi_${TXA}`)} ${etat.appels.length}`);

      // une étape PLUS RÉCENTE, dans un message FORGÉ qui porte des données brutes : le fond relave
      const forge = { from: 'cancale-content', domain: 'www.vinted.fr', kind: 'suivi', quoi: 'journey', id: TXA,
        forme: { 'shipment.journey[].title': 'string', 'shipment.recipient.full_name': 'Jeanne Inventée', 'jeanne@exemple.test': 'string' },
        allege: corpsSuivi(TXA, [...ETAPES, [1, 'Colis livré — Jeanne Inventée, 12 rue des Lilas 29200 Brest', 'delivered']]),
        relais: { nom: 'Relais Banc', rue: 'jeanne@exemple.test', cp: '35000', ville: 'Rennes', autre: 'Jeanne Inventée' } };
      await pagesVers(f, [forge]);
      const l2 = lignes[`harvest_111_suivi_${TXA}`] || {};
      dit(l2.dernier && /Colis livr/.test(l2.dernier.t) && fuite(l2).length === 0, 'un message forgé (contenu brut) est relavé par le fond : l’étape gardée, pas la personne', `${JSON.stringify(l2.dernier)} ${fuite(l2).join(',')}`);
      dit(formePropre(l2.forme) && !Object.keys(l2.forme).some((k) => /@/.test(k)), 'la forme forgée perd ses valeurs et ses clés douteuses', JSON.stringify(l2.forme));
      dit(etat.appels.length === 1 && etat.appels[0].body.action === 'suivi' && etat.appels[0].body.tx === TXA && etat.appels[0].body.uid === '111' && /^Bearer /.test(etat.appels[0].auth || ''), 'une étape PLUS RÉCENTE ⇒ UN appel /api/push { action: suivi, tx, uid } avec la session', JSON.stringify(etat.appels));
      dit(etat.appels.length === 1 && Object.keys(etat.appels[0].body).sort().join() === 'action,tx,uid', 'l’extension n’envoie ni le libellé, ni le titre, ni le transporteur (le serveur relit SA ligne)', JSON.stringify(etat.appels[0] && etat.appels[0].body));
      await pagesVers(f, [forge]);
      dit(etat.appels.length === 1, 'la même nouvelle étape relue : aucun second appel', etat.appels.length);
      // une capture plus ANCIENNE ne remplace pas la plus riche (§4.2)
      const n2 = ecrits(f, `harvest_111_suivi_${TXA}`);
      await pagesVers(f, [{ ...journeyA, allege: corpsSuivi(TXA, ETAPES.slice(0, 1)) }]);
      dit(ecrits(f, `harvest_111_suivi_${TXA}`) === n2 && /Colis livr/.test((lignes[`harvest_111_suivi_${TXA}`].dernier || {}).t || ''), 'une capture plus ANCIENNE ne remplace pas la plus récente (§4.2)', JSON.stringify(lignes[`harvest_111_suivi_${TXA}`].dernier));

      // une VENTE, le compte d'un AUTRE
      const mVente = { ...journeyA, id: TXV, allege: corpsSuivi(TXV, ETAPES) };
      const mAutre = { ...journeyA, id: TXO, allege: corpsSuivi(TXO, ETAPES) };
      await pagesVers(f, [mVente, mAutre]);
      dit(!Object.keys(lignes).some((k) => /_suivi_(30000000999|30000000555)$/.test(k)), 'rien pour une VENTE, ni pour l’achat d’un AUTRE compte que celui du cookie', Object.keys(lignes).filter((k) => /_suivi_/.test(k)).join(' '));
      // l'expédition : identifiant de commande ≠ transaction, la transaction lue dans le corps
      const esc = relayes.find((m) => m.quoi === 'escrow');
      if (esc) { await pagesVers(f, [esc]); const lb = lignes[`harvest_111_suivi_${TXB}`] || {}; dit(lb.tx === TXB && lb.source === 'escrow' && !lignes[`harvest_111_suivi_${ESC}`], 'la page d’une commande (escrow) : rangée sous SA transaction, source « escrow »', JSON.stringify({ tx: lb.tx, s: lb.source })); }
      else dit(false, 'un message escrow à rejouer', 'aucun');
      // le code de retrait : sa forme seulement
      const code = relayes.find((m) => m.quoi === 'code');
      if (code) { await pagesVers(f, [code]); const pc = (lignes.panel_formes_suivi || {}).code; dit(pc && pc.etat === 'forme' && formePropre(pc.forme) && fuite(lignes).length === 0, 'le code de retrait : sa FORME dans panel_formes_suivi, aucune valeur nulle part', JSON.stringify(pc).slice(0, 160) + ' ' + fuite(lignes).join(',')); }
      else dit(false, 'un message code à rejouer', 'aucun');
      // une forme inattendue : la forme gardée, le contenu non
      await pagesVers(f, [{ ...journeyA, id: TXZ, forme: { 'etat_inconnu.x': 'number' }, allege: { etat_inconnu: { x: 1 } } }]);
      dit(!lignes[`harvest_111_suivi_${TXZ}`] && (lignes.panel_formes_suivi || {}).journey && (lignes.panel_formes_suivi.journey.forme || {})['etat_inconnu.x'] === 'number', 'forme inattendue : la forme est gardée, aucun contenu n’est rangé (pas su)', JSON.stringify((lignes.panel_formes_suivi || {}).journey));
    });

    await essaie('D2', async () => {
      const journeyA = relayes.find((m) => m.quoi === 'journey' && m.id === TXA);
      if (!journeyA) return;
      // achats illisibles
      const l1 = lignesDeBase();
      const f1 = faireFond({ src: BG, lignes: l1, lectureKO: (u) => /orders_purchased/.test(u) });
      await pagesVers(f1, [journeyA]);
      dit(!l1[`harvest_111_suivi_${TXA}`], 'achats illisibles ⇒ rien n’est rangé (pas su)');
      // la ligne de suivi illisible (lecture KO, écriture OK)
      const l2 = { ...lignesDeBase(), [`harvest_111_suivi_${TXA}`]: { v: 1, tx: TXA, source: 'journey', capturedAt: H(2), etapes: [{ t: 'Colis livré', at: H(1), code: 'delivered' }], dernier: { t: 'Colis livré', at: H(1), code: 'delivered' }, transporteur: null, suivi: null, forme: {} } };
      const f2 = faireFond({ src: BG, lignes: l2, lectureKO: (u) => /id=eq\.harvest_111_suivi_/.test(u) });
      await pagesVers(f2, [{ ...journeyA, allege: corpsSuivi(TXA, ETAPES.slice(0, 1)) }]);
      dit(ecrits(f2, `harvest_111_suivi_${TXA}`) === 0 && /livr/.test(l2[`harvest_111_suivi_${TXA}`].dernier.t), 'la ligne de suivi illisible (écriture possible) ⇒ RIEN n’est écrit, la plus riche reste', JSON.stringify(f2.j.posts));
      // panel_formes_suivi illisible
      const l3 = { ...lignesDeBase(), panel_formes_suivi: { v: 1, escrow: { forme: { 'a.b': 'string' }, etat: 'reconnue', at: H(48), n: 1 } } };
      const f3 = faireFond({ src: BG, lignes: l3, lectureKO: (u) => /panel_formes_suivi/.test(u) });
      await pagesVers(f3, [journeyA]);
      dit(ecrits(f3, 'panel_formes_suivi') === 0 && l3.panel_formes_suivi.escrow, 'panel_formes_suivi illisible ⇒ rien n’y est écrit (les formes apprises restent)', JSON.stringify(f3.j.posts));
      // aucun compte lisible dans le cookie
      const l4 = lignesDeBase();
      const f4 = faireFond({ src: BG, lignes: l4, connecte: null });
      await pagesVers(f4, [journeyA]);
      dit(!l4[`harvest_111_suivi_${TXA}`], 'compte du cookie inconnu ⇒ rien n’est rangé');
    });

    // ═══ E ═══════════════════════════════════════════════════════════════════
    console.log('\n── E. La file des notifications : une fois, sur une étape plus récente, jamais au-delà de 72 h');
    await essaie('E', async () => {
      const lignes = lignesDeBase();
      const etat = { appels: [], statut: 503, session: true };
      const f = faireFond({ src: BG, lignes });
      brancherPush(f, etat);
      const c = (h) => f.ctx.contratSuivi(f.ctx.allegerSuivi(corpsSuivi(TXA, ETAPES.slice(0, 1).concat(h == null ? [] : [[h, `Étape à ${h} h`, 'x' + h]]))));
      await f.ctx.rangerSuivi('111', TXA, c(null), 'journey', {});
      await f.ctx.rangerSuivi('111', TXA, c(3), 'journey', {});
      dit(etat.appels.length === 1 && !!(f.store.vrmSuiviNotifs || {})[`111:${TXA}`], 'envoi raté (503) ⇒ gardé dans la file', JSON.stringify(f.store.vrmSuiviNotifs));
      etat.statut = 200;
      await f.ctx.envoyerNotifsSuivi();
      dit(etat.appels.length === 2 && !(f.store.vrmSuiviNotifs || {})[`111:${TXA}`], 'renvoyé ensuite, puis sorti de la file', `${etat.appels.length} ${JSON.stringify(f.store.vrmSuiviNotifs)}`);
      etat.statut = 503;
      await f.ctx.rangerSuivi('111', TXA, c(2), 'journey', {});
      etat.session = false;
      await f.ctx.envoyerNotifsSuivi();
      dit(etat.appels.length === 3 && !!(f.store.vrmSuiviNotifs || {})[`111:${TXA}`], 'sans session VRM ⇒ rien ne part, gardé dans la file', `${etat.appels.length} ${JSON.stringify(f.store.vrmSuiviNotifs)}`);
      etat.session = true;
      if (!(f.store.vrmSuiviNotifs || {})[`111:${TXA}`]) return;
      f.store.vrmSuiviNotifs[`111:${TXA}`].at = Date.now() - 25 * 3600000;
      await f.ctx.envoyerNotifsSuivi();
      dit(etat.appels.length === 3 && !(f.store.vrmSuiviNotifs || {})[`111:${TXA}`], 'plus de 24 h dans la file ⇒ oubliée, sans appel', `${etat.appels.length} ${JSON.stringify(f.store.vrmSuiviNotifs)}`);
      // une étape plus récente que la rangée, mais vieille de plus de 72 h : rangée, pas sonnée
      const l2 = lignesDeBase();
      const f2 = faireFond({ src: BG, lignes: l2 }); const e2 = { appels: [], statut: 200, session: true }; brancherPush(f2, e2);
      const c2 = (hs) => f2.ctx.contratSuivi(f2.ctx.allegerSuivi(corpsSuivi(TXA, hs.map((h) => [h, `Étape à ${h} h`, 'x' + h]))));
      await f2.ctx.rangerSuivi('111', TXA, c2([200]), 'journey', {});
      await f2.ctx.rangerSuivi('111', TXA, c2([200, 100]), 'journey', {});
      dit(/100/.test(((l2[`harvest_111_suivi_${TXA}`] || {}).dernier || {}).t || '') && e2.appels.length === 0, 'une étape de plus de 72 h : rangée, jamais sonnée', `${JSON.stringify((l2[`harvest_111_suivi_${TXA}`] || {}).dernier)} ${e2.appels.length}`);
      // sans date : jamais « la dernière », rien ne sonne
      await f2.ctx.rangerSuivi('111', TXA, f2.ctx.contratSuivi({ journey: [{ title: 'Étape sans date' }] }), 'journey', {});
      dit(e2.appels.length === 0 && !/sans date/.test(((l2[`harvest_111_suivi_${TXA}`] || {}).dernier || {}).t || ''), 'une étape sans date ne devient jamais « la dernière »', JSON.stringify((l2[`harvest_111_suivi_${TXA}`] || {}).dernier));
    });

    // ═══ F ═══════════════════════════════════════════════════════════════════
    console.log('\n── F. capterSuivisAchats : borné, une requête à la fois, garde, pause, mémo de 3 h');
    const lignesActives = () => {
      const achats = [];
      for (let i = 0; i < 5; i++) achats.push(commande(String(31000000000 + i), 'Colis expédié', 'waiting', 10 + i));
      achats.push(commande('31000000010', 'Commande finalisée', 'completed', 20));
      achats.push(commande('31000000011', 'Commande livrée ! ', 'waiting', 30));
      achats.push(commande('31000000012', 'Commande livrée ! ', 'waiting', 40));
      achats.push(commande('31000000013', 'Le paiement a été validé', 'waiting', 5));
      return {
        harvest_111_orders_purchased: { type: 'orders_purchased', payload: { my_orders: achats } },
        harvest_111_orders_sold: { type: 'orders_sold', payload: { my_orders: [commande('31000000099', 'Colis expédié', 'waiting', 5)] } },
        // livrée : sa dernière étape rangée a 10 jours (rien à dire) / 1 jour (encore relue)
        harvest_111_suivi_31000000011: { v: 1, tx: '31000000011', source: 'journey', capturedAt: H(240), etapes: [], dernier: { t: 'Colis livré', at: H(240), code: 'delivered' }, transporteur: null, suivi: null, forme: {} },
        harvest_111_suivi_31000000012: { v: 1, tx: '31000000012', source: 'journey', capturedAt: H(24), etapes: [], dernier: { t: 'Colis livré', at: H(24), code: 'delivered' }, transporteur: null, suivi: null, forme: {} },
      };
    };
    const vintedSuivi = (statut = () => 200) => (req) => {
      const m = /\/transactions\/(\d+)\/shipment\/journey_summary/.exec(req.chemin);
      if (!m) return { status: 200, body: { user: { id: 111 } } };
      const s = statut(m[1]);
      return { status: s, body: s === 200 ? corpsSuivi(m[1], [[30, 'Commande expédiée', 'shipped'], [20, 'Colis en transit', 'in_transit']]) : { message: 'x' } };
    };
    const lusJ = (f) => f.j.vinted.filter((v) => /journey_summary/.test(v.chemin));
    await essaie('F', async () => {
      const lignes = lignesActives();
      const f = faireFond({ src: BG, lignes, vinted: vintedSuivi() });
      brancherPush(f, { appels: [], statut: 200, session: true });
      const acc = { vinted_user_id: '111', domain: 'www.vinted.fr', access_token: 'jeton' };
      await Promise.all([f.ctx.capterSuivisAchats('111'), f.ctx.vintedGet(acc, '/api/v2/users/111'), f.ctx.vintedGet(acc, '/api/v2/users/111')]);
      const l1 = lusJ(f);
      dit(l1.length === 3, 'au plus 3 suivis lus par visite', l1.length);
      dit(f.j.maxEnVol <= 1, 'une requête Vinted à la fois (la file commune, même avec d’autres lectures en même temps)', f.j.maxEnVol);
      dit(!l1.some((v) => /3100000001[0-3]|31000000099/.test(v.chemin)), 'jamais une commande finalisée, un achat pas encore expédié, une VENTE, ni un achat livré', l1.map((v) => v.chemin.split('/')[4]).join(' '));
      dit(l1.length === 3 && l1.every((v) => lignes[`harvest_111_suivi_${v.chemin.split('/')[4]}`]), 'chaque suivi lu est rangé', Object.keys(lignes).filter((k) => /_suivi_/.test(k)).join(' '));
      const dues = ((f.store.vrmLecturesDues || {})['111'] || {}).suivi;
      dit(!dues, 'le suivi n’entre pas dans la réserve des lectures prioritaires (il revient sans cesse : ce n’est pas un rattrapage)', JSON.stringify(dues));
      await f.ctx.capterSuivisAchats('111');
      const l2 = lusJ(f);
      dit(l2.length === 5 && !l2.slice(3).some((v) => l1.map((x) => x.chemin).includes(v.chemin)), 'la visite suivante lit les suivants (pas les mêmes avant 3 h)', l2.length);
      await f.ctx.capterSuivisAchats('111');
      dit(lusJ(f).length === 5, 'tout est dans le mémo de 3 h : plus aucune lecture', lusJ(f).length);
      // trois heures passent (le mémo ET les compteurs de l'heure)
      for (const k of Object.keys(f.store.vrmSuiviFaits || {})) f.store.vrmSuiviFaits[k] = Date.now() - 3 * 3600000 - 60000;
      for (const c of ['vrmSuiviLus', 'vrmLectures']) for (const k of Object.keys(f.store[c] || {})) f.store[c][k] = f.store[c][k].map((t) => t - 3 * 3600000 - 60000);
      const avant = f.j.posts.length;
      await f.ctx.capterSuivisAchats('111');
      dit(lusJ(f).length === 8 && f.j.posts.slice(avant).every((ids) => !ids.some((id) => /_suivi_/.test(id))), 'après 3 h : relus, et rien de neuf n’est réécrit', `${lusJ(f).length} ${JSON.stringify(f.j.posts.slice(avant))}`);
      // 6 par heure au plus, sur un compte (10 achats en route, trois visites)
      const ach = []; for (let i = 0; i < 10; i++) ach.push(commande(String(33000000000 + i), 'Colis expédié', 'waiting', 10 + i));
      const fh = faireFond({ src: BG, lignes: { harvest_111_orders_purchased: { type: 'orders_purchased', payload: { my_orders: ach } } }, vinted: vintedSuivi() });
      for (let v = 0; v < 3; v++) await fh.ctx.capterSuivisAchats('111');
      dit(lusJ(fh).length === 6, '6 lectures du suivi par heure au plus (trois visites : 3, 3, 0)', lusJ(fh).length);
    });
    await essaie('F2', async () => {
      // un 429 : on s'arrête, la pause est posée, la transaction n'est pas bloquée 3 h
      const l = lignesActives();
      const f = faireFond({ src: BG, lignes: l, vinted: vintedSuivi(() => 429) });
      await f.ctx.capterSuivisAchats('111');
      const tx = (lusJ(f)[0] || { chemin: '////' }).chemin.split('/')[4];
      dit(lusJ(f).length === 1 && !!f.store.vrmPauseVinted, 'Vinted freine (429) ⇒ une seule requête, la pause est posée', `${lusJ(f).length} ${JSON.stringify(f.store.vrmPauseVinted)}`);
      dit(!(f.store.vrmSuiviFaits || {})[tx], 'la transaction freinée n’est pas mise de côté 3 h (elle repartira après la pause)', JSON.stringify(f.store.vrmSuiviFaits));
      await f.ctx.capterSuivisAchats('111');
      dit(lusJ(f).length === 1, 'pendant la pause : plus aucune requête', lusJ(f).length);
      // la garde du compte connecté refuse
      const f2 = faireFond({ src: BG, lignes: lignesActives(), vinted: vintedSuivi() });
      f2.ctx.compteConnecte = async () => '222';
      await f2.ctx.capterSuivisAchats('111');
      dit(lusJ(f2).length === 0, 'Chrome est connecté sur un autre compte ⇒ aucune requête', lusJ(f2).length);
      // « pas su » : achats ou suivis illisibles
      const f3 = faireFond({ src: BG, lignes: lignesActives(), vinted: vintedSuivi(), lectureKO: (u) => /orders_purchased/.test(u) });
      await f3.ctx.capterSuivisAchats('111');
      const f4 = faireFond({ src: BG, lignes: lignesActives(), vinted: vintedSuivi(), lectureKO: (u) => /id=like\.harvest_111_suivi_/.test(u) });
      await f4.ctx.capterSuivisAchats('111');
      dit(lusJ(f3).length === 0 && lusJ(f4).length === 0, 'achats ou suivis illisibles ⇒ rien n’est lu chez Vinted (pas su)', `${lusJ(f3).length} ${lusJ(f4).length}`);
      // lu, mais la ligne ne se relit pas : rien n'est écrit, on s'arrête, relu ensuite
      const l5 = lignesActives();
      const f5 = faireFond({ src: BG, lignes: l5, vinted: vintedSuivi(), lectureKO: (u) => /id=eq\.harvest_111_suivi_/.test(u) });
      await f5.ctx.capterSuivisAchats('111');
      dit(lusJ(f5).length === 1 && !f5.j.posts.some((ids) => ids.some((id) => /_suivi_/.test(id))) && Object.keys(f5.store.vrmSuiviFaits || {}).length === 0, 'lecture de la ligne ratée ⇒ rien écrit, arrêt, et pas de mémo (relu à la visite suivante)', `${lusJ(f5).length} ${JSON.stringify(f5.j.posts)} ${JSON.stringify(f5.store.vrmSuiviFaits)}`);
      // une réponse d'erreur de Vinted
      const l6 = lignesActives();
      const f6 = faireFond({ src: BG, lignes: l6, vinted: (req) => (/journey_summary/.test(req.chemin) ? { status: 200, body: { code: 106, message_code: 'not_found', message: 'Introuvable' } } : { status: 200, body: {} }) });
      await f6.ctx.capterSuivisAchats('111');
      dit(!Object.keys(l6).some((k) => /_suivi_3100000000/.test(k)), 'une réponse d’erreur de Vinted n’est jamais rangée', Object.keys(l6).filter((k) => /_suivi_/.test(k)).join(' '));
    });

    // ═══ G ═══════════════════════════════════════════════════════════════════
    console.log('\n── G. La VRAIE route api/push.js { action: suivi } : relue au nom du vendeur');
    await essaie('G', async () => {
      const OWNER = '11111111-2222-3333-4444-555555555555', AUTRE = '99999999-8888-7777-6666-555555555555';
      process.env.VRM_OWNER_UID = OWNER;
      process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
      process.env.VAPID_PRIVATE_KEY = 'banc-cle-privee-factice';
      process.env.EMAIL_INBOUND_SECRET = 'cle-banc-suivi';
      const webpush = require(path.join(racine, 'node_modules', 'web-push'));
      const pushes = [];
      webpush.setVapidDetails = () => {};
      webpush.sendNotification = async (sub, body) => { pushes.push(JSON.parse(body)); return { statusCode: 201 }; };
      const base = new Map(); let pannes = new Set(), acces = true, latence = 0; const lectures = [];
      const comptes = [{ owner: OWNER, vinted_user_id: '111' }, { owner: AUTRE, vinted_user_id: '222' }];
      const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
      const filtrer = (u) => {
        const f = [];
        for (const [k, v] of u.searchParams) { if (['select', 'on_conflict', 'limit', 'order'].includes(k)) continue; f.push([decodeURIComponent(k), v]); }
        return [...base.entries()].filter(([cle, data]) => {
          const [own, id] = cle.split('|');
          return f.every(([k, v]) => {
            const valeur = k === 'id' ? id : k === 'owner' ? own : k.startsWith('data->>') ? (data && data[k.slice(7)] != null ? String(data[k.slice(7)]) : null) : undefined;
            if (v === 'is.null') return valeur == null;
            if (v.startsWith('eq.')) return valeur === decodeURIComponent(v.slice(3));
            return true;
          });
        });
      };
      global.fetch = async (url, opts = {}) => {
        const u = new URL(String(url));
        const m = (opts.method || 'GET').toUpperCase();
        const prefer = String((opts.headers && (opts.headers.Prefer || opts.headers.prefer)) || '');
        if (u.pathname === '/auth/v1/user') { const a = String((opts.headers && (opts.headers.Authorization || opts.headers.authorization)) || ''); return /aaa\.bbb\.ccc/.test(a) ? rep({ id: OWNER, email: 'banc@banc.test' }) : rep({ msg: 'non' }, 401); }
        if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(acces);
        if (u.pathname === '/rest/v1/vinted_accounts') {
          lectures.push(u.href);
          if (pannes.has('vinted_accounts')) return new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } });
          const own = (u.searchParams.get('owner') || '').replace(/^eq\./, ''), vid = (u.searchParams.get('vinted_user_id') || '').replace(/^eq\./, '');
          return rep(comptes.filter((c) => (!own || c.owner === own) && (!vid || c.vinted_user_id === vid)).map((c) => ({ vinted_user_id: c.vinted_user_id })));
        }
        if (u.pathname !== '/rest/v1/app_data') return rep([]);
        if (latence) await pause(latence);
        if (m === 'POST') {
          const rows = JSON.parse(opts.body || '[]'); const sansEcraser = /ignore-duplicates/.test(prefer); const rendus = [];
          for (const r of rows) { const cle = `${r.owner || OWNER}|${r.id}`; if (sansEcraser && base.has(cle)) continue; base.set(cle, r.data); rendus.push(r); }
          return /return=representation/.test(prefer) ? rep(rendus, 201) : new Response('', { status: 201 });
        }
        if (m === 'PATCH') {
          const corps = JSON.parse(opts.body || '{}'); const t = filtrer(u);
          for (const [cle] of t) base.set(cle, corps.data);
          return /return=representation/.test(prefer) ? rep(t.map(([cle]) => ({ id: cle.split('|')[1], data: base.get(cle) }))) : new Response('', { status: 204 });
        }
        const sel = u.searchParams.get('select') || '';
        if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);   // base cloisonnée
        lectures.push(u.href);
        const id = decodeURIComponent((u.searchParams.get('id') || '').replace(/^eq\./, ''));
        if (pannes.has(id)) return new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } });
        return rep(filtrer(u).map(([cle, d]) => (sel && sel !== 'data' ? projette({ id: cle.split('|')[1], data: d }, sel) : { owner: cle.split('|')[0], id: cle.split('|')[1], data: d })));
      };
      let push, libPush = {}, libAbo = {};
      try { push = await import('file://' + path.join(API, 'push.js')); } catch (e) { dit(false, 'api/push.js se charge', e.message); return; }
      try { libPush = await import('file://' + path.join(API, '_lib', 'push.js')); } catch (_) {}
      try { libAbo = await import('file://' + path.join(API, '_lib', 'abonnement.js')); } catch (_) {}
      const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.end = () => r; return r; };
      const appel = async (tx, uid, jeton = 'aaa.bbb.ccc') => { const res = faireRes(); await push.default({ method: 'POST', query: {}, headers: jeton ? { authorization: `Bearer ${jeton}` } : {}, body: { action: 'suivi', tx, uid } }, res); return res; };
      const TX = '30000000777';
      const suivi = (h, t = 'Colis en cours de livraison') => ({ v: 1, tx: TX, source: 'journey', capturedAt: H(0), etapes: [{ t, at: H(h), code: 'in_transit' }], dernier: { t, at: H(h), code: 'in_transit' }, transporteur: 'Transporteur Banc', suivi: 'TB12345678FR', forme: {} });
      const reset = (prefs = { suivi: true }) => {
        base.clear(); pannes = new Set(); acces = true; pushes.length = 0; lectures.length = 0;
        if (typeof libPush.oublierPrefsVues === 'function') libPush.oublierPrefsVues();
        if (typeof libAbo.oublierAcces === 'function') libAbo.oublierAcces();
        base.set(`${OWNER}|push_subs`, { subs: [{ endpoint: 'https://web.push.apple.com/iphone' }] });
        if (prefs) base.set(`${OWNER}|push_prefs`, prefs);
        base.set(`${OWNER}|harvest_111_orders_purchased`, { payload: { my_orders: [{ transaction_id: Number(TX), title: 'Baskets banc A', status: 'Colis expédié' }] } });
        base.set(`${OWNER}|harvest_111_suivi_${TX}`, suivi(1));
        // ce qui est à l'AUTRE vendeur
        base.set(`${AUTRE}|harvest_222_orders_purchased`, { payload: { my_orders: [{ transaction_id: Number(TX), title: 'Achat de l’autre' }] } });
        base.set(`${AUTRE}|harvest_222_suivi_${TX}`, suivi(1, 'Étape de l’autre'));
        base.set(`${AUTRE}|push_subs`, { subs: [{ endpoint: 'https://web.push.apple.com/autre' }] });
      };

      reset();
      const r1 = await appel(TX, '111');
      const p = pushes[0] || {};
      console.log(`     sur le téléphone : « ${p.title} » / « ${p.body} »`);
      dit(r1.code === 200 && r1.corps && r1.corps.envoye === true && pushes.length === 1, 'une étape neuve ⇒ 200, UNE notification', `HTTP ${r1.code} ${JSON.stringify(r1.corps)} · ${pushes.length}`);
      dit(/Baskets banc A/.test(p.title || '') && /Vinted : « Colis en cours de livraison »/.test(p.body || '') && p.url === '/?tab=cat_achats', 'le titre de l’achat (par la transaction) et l’étape relue dans SA ligne ; le clic ouvre Achats', JSON.stringify(p));
      const r2 = await appel(TX, '111');
      dit(r2.code === 200 && pushes.length === 1, 'la même étape redemandée ⇒ rien de plus (une fois par étape)', `${JSON.stringify(r2.corps)} · ${pushes.length}`);
      base.set(`${OWNER}|harvest_111_suivi_${TX}`, suivi(0.5, 'Colis livré'));
      await appel(TX, '111');
      dit(pushes.length === 2 && /Colis livré/.test((pushes[1] || {}).body || ''), 'une étape PLUS RÉCENTE ⇒ une seconde notification', `${pushes.length}`);
      dit(lectures.length > 0 && lectures.every((h) => /owner=eq\.11111111/.test(h)), 'toutes les lectures portent owner=eq.<le vendeur de la session>', lectures.filter((h) => !/owner=eq\.11111111/.test(h)).join(' '));

      reset();
      const r3 = await appel(TX, '222');
      dit(r3.code === 403 && pushes.length === 0, 'le compte Vinted d’un AUTRE vendeur ⇒ 403, rien ne sonne', `HTTP ${r3.code} ${JSON.stringify(r3.corps)} · ${pushes.length}`);
      dit(!lectures.some((h) => /99999999/.test(h)), 'rien n’est lu chez l’autre vendeur', lectures.filter((h) => /99999999/.test(h)).join(' '));

      reset(null);
      const r4 = await appel(TX, '111');
      dit(r4.code === 200 && r4.corps && r4.corps.envoye === false && pushes.length === 0, 'préférence « suivi » coupée (le défaut) ⇒ rien ne sonne', `${JSON.stringify(r4.corps)} · ${pushes.length}`);
      reset({ suivi: false });
      await appel(TX, '111');
      dit(pushes.length === 0, 'préférence coupée à la main ⇒ rien ne sonne', pushes.length);

      reset(); base.set(`${OWNER}|harvest_111_suivi_${TX}`, suivi(80));
      const r5 = await appel(TX, '111');
      dit(r5.code === 200 && r5.corps && r5.corps.envoye === false && pushes.length === 0, 'une étape de plus de 72 h ⇒ rien ne sonne', `${JSON.stringify(r5.corps)} · ${pushes.length}`);

      reset(); pannes.add(`harvest_111_suivi_${TX}`);
      const r6 = await appel(TX, '111');
      dit(r6.code === 503 && pushes.length === 0, 'la ligne de suivi illisible ⇒ 503 (pas su : l’extension renverra), rien ne sonne', `HTTP ${r6.code} · ${pushes.length}`);
      reset(); pannes.add(`push_suivi_${TX}`);
      const r7 = await appel(TX, '111');
      dit(r7.code === 503 && pushes.length === 0, 'la réservation de l’étape illisible ⇒ 503, rien ne sonne (jamais deux fois)', `HTTP ${r7.code} · ${pushes.length}`);
      reset(); pannes.add('vinted_accounts');
      const r7b = await appel(TX, '111');
      dit(r7b.code === 503 && pushes.length === 0, 'les comptes illisibles ⇒ 503, rien ne sonne', `HTTP ${r7b.code} · ${pushes.length}`);

      reset(); base.set(`${OWNER}|harvest_111_orders_purchased`, { payload: { my_orders: [] } }); base.set(`${OWNER}|harvest_111_orders_sold`, { payload: { my_orders: [{ transaction_id: Number(TX), title: 'Une vente' }] } });
      const r8 = await appel(TX, '111');
      dit(r8.code === 404 && pushes.length === 0, 'pas un ACHAT (une vente) ⇒ 404, rien ne sonne', `HTTP ${r8.code} ${JSON.stringify(r8.corps)} · ${pushes.length}`);
      reset(); base.delete(`${OWNER}|harvest_111_suivi_${TX}`);
      const r9 = await appel(TX, '111');
      dit(r9.code === 404 && pushes.length === 0, 'aucune ligne de suivi ⇒ 404, rien ne sonne', `HTTP ${r9.code} · ${pushes.length}`);
      reset();
      const r10 = await appel(TX, '111', null);
      dit(r10.code === 401 && pushes.length === 0, 'sans session VRM ⇒ 401', `HTTP ${r10.code}`);
      reset(); acces = false;
      const r11 = await appel(TX, '111');
      dit(r11.code === 200 && r11.corps && r11.corps.envoye === false && pushes.length === 0, 'abonnement coupé ⇒ rien ne sonne', `${JSON.stringify(r11.corps)} · ${pushes.length}`);
      reset(); base.delete(`${OWNER}|push_subs`);
      const r14 = await appel(TX, '111');
      dit(r14.code === 200 && r14.corps && r14.corps.envoye === false && r14.corps.raison === 'aucun-appareil', 'aucun appareil abonné ⇒ jamais « envoyée »', JSON.stringify(r14.corps));
      // ── (revue du 24 oct.) deux appels en même temps pour la même étape
      // (une première étape d'abord : la copie des préférences est en place, les
      //  deux appels suivants vont du même pas jusqu'à la réservation)
      reset(); await appel(TX, '111');
      base.set(`${OWNER}|harvest_111_suivi_${TX}`, suivi(0.5, 'Colis livré'));
      latence = 4;
      const [c1, c2] = await Promise.all([appel(TX, '111'), appel(TX, '111')]);
      latence = 0;
      dit(pushes.length === 2 && [c1, c2].filter((r) => r.corps && r.corps.envoye).length === 1, 'deux appels SIMULTANÉS pour la même étape ⇒ UNE notification (la réservation est atomique)', `${pushes.length - 1} · ${JSON.stringify([c1.corps, c2.corps])}`);
      const r15 = await appel(TX, '111');
      dit(pushes.length === 2 && r15.corps && r15.corps.raison === 'deja', 'puis redemandée : « déjà »', JSON.stringify(r15.corps));
      // la MÊME étape vue par une autre voie, à un autre instant (et un autre code)
      base.set(`${OWNER}|harvest_111_suivi_${TX}`, { ...suivi(0.4), dernier: { t: 'Colis LIVRÉ.', at: H(0.4), code: 'autre' } });
      const r16 = await appel(TX, '111');
      dit(pushes.length === 2 && r16.corps && r16.corps.raison === 'deja', 'la même étape à un autre instant (une autre voie) ⇒ rien de plus (la clé est le libellé)', JSON.stringify(r16.corps));
      // une étape datée dans l'avenir
      reset(); base.set(`${OWNER}|harvest_111_suivi_${TX}`, suivi(-3, 'Livraison prévue'));
      const r17 = await appel(TX, '111');
      dit(pushes.length === 0 && r17.corps && r17.corps.raison === 'futur', 'une étape datée dans l’AVENIR (une prévision) ⇒ rien ne sonne', JSON.stringify(r17.corps));
      // l'arrivée au point relais : déjà annoncée par l'e-mail ou la conversation ?
      const relaisL = () => ({ ...suivi(1, 'Colis disponible au point relais'), suivi: 'TB12345678FR' });
      const casRelais = [
        ['par la transaction (la conversation)', { push_dedup: { keys: [`relais-tx${TX}-code`] } }],
        ['par le n° de suivi (l’e-mail du transporteur)', { push_dedup: { keys: ['relais-TB12345678FR-sans'] } }],
        ['par le code de retrait lu dans la conversation', { push_dedup: { keys: ['retrait-code-C48291'] }, panel_colis_relais: { [TX]: { code: 'C48291', at: H(1) } } }],
      ];
      for (const [quoi, extra] of casRelais) {
        reset(); base.set(`${OWNER}|harvest_111_suivi_${TX}`, relaisL());
        for (const [k, v] of Object.entries(extra)) base.set(`${OWNER}|${k}`, v);
        const r = await appel(TX, '111');
        dit(pushes.length === 0 && r.corps && r.corps.raison === 'relais-deja', `l’arrivée au point relais déjà annoncée ${quoi} ⇒ rien ne sonne`, `${pushes.length} ${JSON.stringify(r.corps)}`);
      }
      reset(); base.set(`${OWNER}|harvest_111_suivi_${TX}`, relaisL());
      const r18 = await appel(TX, '111');
      const dd = (base.get(`${OWNER}|push_dedup`) || {}).keys || [];
      dit(pushes.length === 1 && dd.includes(`relais-tx${TX}-sans`) && dd.includes('relais-TB12345678FR-sans'), 'jamais annoncée ⇒ UNE notification, et l’e-mail ou la conversation SANS code venus ensuite se tairont', `${pushes.length} ${JSON.stringify(dd)} ${JSON.stringify(r18.corps)}`);
      reset(); base.set(`${OWNER}|harvest_111_suivi_${TX}`, relaisL()); pannes.add('panel_colis_relais');
      const r19 = await appel(TX, '111');
      dit(r19.code === 503 && pushes.length === 0, 'les codes lus dans les conversations illisibles ⇒ 503 (pas su), rien ne sonne', `HTTP ${r19.code}`);
      reset(); base.set(`${OWNER}|harvest_111_suivi_${TX}`, relaisL()); pannes.add('push_dedup');
      const r20 = await appel(TX, '111');
      dit(r20.code === 503 && pushes.length === 0, 'le mémo des arrivées illisible ⇒ 503, rien ne sonne', `HTTP ${r20.code}`);

      reset();
      const r12 = await appel('12ab', '111'); const r13 = await appel(TX, 'abc');
      dit(r12.code === 400 && r13.code === 400 && pushes.length === 0, 'une transaction ou un compte mal formés ⇒ 400', `${r12.code} ${r13.code}`);
    });

    // ═══ H ═══════════════════════════════════════════════════════════════════
    console.log('\n── H. (revue du 24 oct.) Deux réponses en même temps : une écriture et un appel par étape, rien de perdu');
    const pushLent = (f, etat, ms = 150) => {
      const f0 = f.ctx.fetch;
      f.ctx.fetch = async (u, o = {}) => {
        if (/vrm\.center\/api\/push/.test(String(u))) {
          const b = JSON.parse(o.body || '{}'); etat.appels.push(b);
          await pause(typeof ms === 'function' ? ms(b) : ms);
          const st = etat.statutDe ? etat.statutDe(b) : 200;
          return { ok: st < 400, status: st, json: async () => ({}) };
        }
        return f0(u, o);
      };
      f.ctx.authToken = async () => ({ user_id: 'owner-banc', access_token: 'jeton.banc.suivi', expires_at: Date.now() + 3600000 });
    };
    const msgJ = (tx, etapes) => ({ from: 'cancale-content', domain: 'www.vinted.fr', kind: 'suivi', quoi: 'journey', id: tx, forme: { 'shipment.journey[].title': 'string' },
      allege: { transaction_id: Number(tx), shipment: { carrier: { name: 'Transporteur Banc' }, journey: etapes.map(([h, t, c]) => ({ title: t, date: H(h), status_code: c })) } } });
    const ligneBase = (tx, h = 30, t = 'Commande expédiée') => ({ v: 1, tx, source: 'passif', capturedAt: H(20), etapes: [{ t, at: H(h), code: 'shipped' }], dernier: { t, at: H(h), code: 'shipped' }, transporteur: null, suivi: null, forme: {} });
    await essaie('H', async () => {
      // a. la même réponse reçue deux fois en même temps (le bouton « Suivre le colis » rouvert)
      const l1 = { ...lignesDeBase(), [`harvest_111_suivi_${TXA}`]: ligneBase(TXA) };
      const f1 = faireFond({ src: BG, lignes: l1 }); const e1 = { appels: [] }; pushLent(f1, e1);
      const m1 = msgJ(TXA, [[30, 'Commande expédiée', 'shipped'], [2, 'Colis disponible au point relais', 'at_pickup']]);
      await Promise.all([f1.envoyer(m1, TAB), f1.envoyer(m1, TAB)]); await pause(600);
      dit(e1.appels.length === 1 && ecrits(f1, `harvest_111_suivi_${TXA}`) === 1, 'la même étape vue deux fois en même temps : UNE écriture, UN appel au serveur', `appels=${e1.appels.length} écritures=${ecrits(f1, `harvest_111_suivi_${TXA}`)}`);
      // b. deux achats, une étape neuve chacun, en même temps
      const l2 = { ...lignesDeBase(), [`harvest_111_suivi_${TXA}`]: ligneBase(TXA), [`harvest_111_suivi_${TXB}`]: ligneBase(TXB) };
      const f2 = faireFond({ src: BG, lignes: l2 }); const e2 = { appels: [] }; pushLent(f2, e2);
      await Promise.all([f2.envoyer(msgJ(TXA, [[30, 'Commande expédiée', 'shipped'], [2, 'Colis disponible au point relais', 'at_pickup']]), TAB),
                         f2.envoyer(msgJ(TXB, [[30, 'Commande expédiée', 'shipped'], [3, 'Colis en cours de livraison', 'out']]), TAB)]);
      await pause(900);
      const par = e2.appels.map((b) => b.tx).sort();
      dit(JSON.stringify(par) === JSON.stringify([TXA, TXB].sort()) && !Object.keys(f2.store.vrmSuiviNotifs || {}).length, 'deux achats en même temps : un appel CHACUN, aucun perdu, aucun en double, la file vide', `${JSON.stringify(par)} · file ${JSON.stringify(f2.store.vrmSuiviNotifs)}`);
      // c. un envoi lent ; un autre achat mis en file pendant ; le second envoi échoue (503)
      const f3 = faireFond({ src: BG, lignes: {} }); const e3 = { appels: [], statutDe: (b) => (b.tx === TXB ? 503 : 200) };
      pushLent(f3, e3, (b) => (b.tx === TXA && e3.appels.filter((x) => x.tx === TXA).length === 1 ? 300 : 5));
      await f3.ctx.mettreNotifSuivi('111', TXA);
      const p1 = f3.ctx.envoyerNotifsSuivi(); await pause(30);
      await f3.ctx.mettreNotifSuivi('111', TXB);
      const p2 = f3.ctx.envoyerNotifsSuivi();
      await Promise.all([p1, p2]);
      dit(JSON.stringify(e3.appels.map((b) => b.tx)) === JSON.stringify([TXA, TXB]) && JSON.stringify(Object.keys(f3.store.vrmSuiviNotifs || {})) === JSON.stringify([`111:${TXB}`]), 'un envoi en cours ne renvoie pas, n’efface pas : A une fois, B (503) gardé dans la file', `${JSON.stringify(e3.appels.map((b) => b.tx))} · file ${JSON.stringify(Object.keys(f3.store.vrmSuiviNotifs || {}))}`);
      // d. deux formes reçues ensemble (le suivi ET le code de retrait)
      let deux = 0;
      for (let i = 0; i < 4; i++) {
        const f4 = faireFond({ src: BG, lignes: lignesDeBase() });
        await Promise.all([f4.envoyer({ ...msgJ(TXA, [[1, 'En route', 'x']]), forme: { 'shipment.journey[].title': 'string', 'shipment.journey[].date': 'string' } }, TAB),
                           f4.envoyer({ from: 'cancale-content', domain: 'www.vinted.fr', kind: 'suivi', quoi: 'code', id: TXA, forme: { code: 'string', qr_code_url: 'string' } }, TAB)]);
        await pause(150);
        const pf = f4.lignes.panel_formes_suivi || {};
        if (pf.journey && pf.code) deux++;
      }
      dit(deux === 4, 'deux formes reçues ensemble : panel_formes_suivi garde les DEUX (4 essais sur 4)', `${deux}/4`);
    });

    // ═══ I ═══════════════════════════════════════════════════════════════════
    console.log('\n── I. (revue du 24 oct.) Les étapes : jamais une prévision, la ligne de base sans date, l’escrow FUSIONNÉ, la borne de 24 h');
    await essaie('I', async () => {
      // a. une livraison ESTIMÉE (datée dans le futur) n'est jamais la dernière
      const la = lignesDeBase(); const fa = faireFond({ src: BG, lignes: la }); const ea = { appels: [] }; pushLent(fa, ea, 5);
      await pagesVers(fa, [msgJ(TXA, [[30, 'Commande expédiée', 'shipped'], [-20, 'Livraison estimée', 'estimated']])]);
      const d1 = (la[`harvest_111_suivi_${TXA}`] || {}).dernier || {};
      dit(/exp[ée]di/.test(d1.t || '') && !(la[`harvest_111_suivi_${TXA}`].etapes || []).some((e) => /estim/i.test(e.t)), 'une étape datée dans l’avenir n’est ni la dernière, ni rangée', JSON.stringify(la[`harvest_111_suivi_${TXA}`]));
      await pagesVers(fa, [msgJ(TXA, [[30, 'Commande expédiée', 'shipped'], [0.1, 'Colis disponible au point relais', 'at_pickup'], [-20, 'Livraison estimée', 'estimated']])]);
      await pause(200);
      const d2 = (la[`harvest_111_suivi_${TXA}`] || {}).dernier || {};
      dit(/disponible/.test(d2.t || '') && ea.appels.length === 1, 'la vraie étape suivante est rangée et annoncée (une fois)', `${JSON.stringify(d2)} · appels=${ea.appels.length}`);
      const ce = f0Regle().contratSuivi({ steps: [{ title: 'Livraison prévue', estimated_delivery_date: H(-30), date: H(2) }] });
      dit(ce && ce.dernier && ce.dernier.at === H(2), 'une clé de prévision (estimated_…) ne date jamais une étape', JSON.stringify(ce));
      // b. la ligne de base n'avait que des étapes SANS date ; les mêmes, datées ensuite : rien ne sonne
      const lb = lignesDeBase(); const fb = faireFond({ src: BG, lignes: lb }); const eb = { appels: [] }; pushLent(fb, eb, 5);
      await pagesVers(fb, [{ ...msgJ(TXA, []), allege: { shipment: { steps: [{ title: 'Commande expédiée', status: 'shipped' }, { title: 'Colis disponible au point relais', status: 'at_pickup' }] } } }]);
      await pagesVers(fb, [msgJ(TXA, [[40, 'Commande expédiée', 'shipped'], [5, 'Colis disponible au point relais', 'at_pickup']])]);
      await pause(200);
      const lbb = lb[`harvest_111_suivi_${TXA}`] || {};
      dit(eb.appels.length === 0 && lbb.dernier && /disponible/.test(lbb.dernier.t) && lbb.etapes.length === 2, 'des étapes rangées sans date, puis datées : la ligne prend les dates, rien ne sonne (ce n’est pas une étape de plus)', `appels=${eb.appels.length} ${JSON.stringify(lbb.etapes)}`);
      // c. le suivi (4 étapes), puis la page de la commande (escrow, la MÊME étape à −110 min), puis le suivi relu
      const lc = lignesDeBase(); const fc = faireFond({ src: BG, lignes: lc }); const ec = { appels: [] }; pushLent(fc, ec, 5);
      const M = (m) => m / 60;
      const J4 = [[M(4000), 'Commande expédiée', 'shipped'], [M(2500), 'Pris en charge', 'in_transit'], [M(600), 'En cours de livraison', 'out'], [M(120), 'Disponible au point relais', 'at_pickup']];
      await pagesVers(fc, [msgJ(TXA, J4.slice(0, 3))]);
      await pagesVers(fc, [msgJ(TXA, J4)]); await pause(100);
      const esc = { from: 'cancale-content', domain: 'www.vinted.fr', kind: 'suivi', quoi: 'escrow', id: ESC, txCorps: TXA, forme: { 'shipment.status': 'number' },
        allege: { transaction_id: Number(TXA), shipment: { id: 9, status: 4, status_title: 'Disponible au point relais', status_updated_at: H(M(110)) } } };
      await pagesVers(fc, [esc]); await pause(100);
      const lcc = lc[`harvest_111_suivi_${TXA}`] || {};
      dit((lcc.etapes || []).length === 4 && lcc.source !== 'escrow', 'la page de la commande (une étape) ne remplace pas les 4 étapes du suivi, ni sa source', `${(lcc.etapes || []).length} étapes · source ${lcc.source}`);
      dit(ec.appels.length === 1, 'la MÊME étape vue par deux voies à 10 min d’écart : une seule notification', `appels=${ec.appels.length}`);
      const nAvant = ecrits(fc, `harvest_111_suivi_${TXA}`);
      await pagesVers(fc, [msgJ(TXA, J4)]);
      dit(ecrits(fc, `harvest_111_suivi_${TXA}`) === nAvant && (lc[`harvest_111_suivi_${TXA}`].etapes || []).length === 4, 'le suivi relu ensuite : inchangé (rien n’est refusé, rien ne bouge)', `${ecrits(fc, `harvest_111_suivi_${TXA}`) - nAvant}`);
      // d. une notification restée 25 h en file, puis une étape NEUVE : elle part (la borne suit l'étape)
      const ld = { ...lignesDeBase(), [`harvest_111_suivi_${TXA}`]: ligneBase(TXA, 27) };
      const fd = faireFond({ src: BG, lignes: ld, store: { vrmSuiviNotifs: { [`111:${TXA}`]: { uid: '111', tx: TXA, at: Date.now() - 25 * 3600000, essais: 3 } } } });
      const ed = { appels: [] }; pushLent(fd, ed, 5);
      await pagesVers(fd, [msgJ(TXA, [[27, 'Commande expédiée', 'shipped'], [1, 'Colis disponible au point relais', 'at_pickup']])]); await pause(200);
      dit(ed.appels.length === 1 && !Object.keys(fd.store.vrmSuiviNotifs || {}).length, 'une étape neuve après 25 h d’échecs : envoyée (la borne de 24 h part de l’étape à annoncer)', `appels=${ed.appels.length} · diags ${fd.j.diags.filter((d) => /suivi_notif/.test(d)).join(' ')}`);
      // e. la ligne dit combien d'étapes elle porte (un scalaire, pour l'app)
      dit(Number(lcc.n) === (lcc.etapes || []).length && Number(lbb.n) === 2, 'la ligne porte `n` = le nombre d’étapes', `${lcc.n} ${lbb.n}`);
    });

    // ═══ J ═══════════════════════════════════════════════════════════════════
    console.log('\n── J. (revue du 24 oct.) La liste blanche lave aussi ce qu’aucune autre clé ne nommait');
    await essaie('J', async () => {
      const R = f0Regle();
      const NOMS = ['Jeanne', 'Inventée', 'INVENTEE', 'Vendeurdubanc', '482913'];
      const cas = {
        'un nom seulement dans le libellé (« remis à … »)': { journey: [{ title: 'Colis remis à Jeanne Inventée', date: H(1) }] },
        'un nom en capitales (« remis à : M INVENTEE »)': { journey: [{ title: 'Livraison effectuée - remis à : M INVENTEE', date: H(1) }] },
        'le code « est le … »': { journey: [{ title: 'Disponible au relais', subtitle: 'Ton code de retrait est le 482913', date: H(1) }] },
        'un code sous une clé d’état (« Code de retrait : … »)': { journey: [{ title: 'Disponible', status: 'Code de retrait : 482913', date: H(1) }] },
        'un contact sous un parent « pickup »': { pickup_contact: { name: 'Jeanne Inventée' }, journey: [{ title: 'Disponible', date: H(1) }] },
        'l’expéditeur nommé (« déposé par … »)': { journey: [{ title: 'Colis déposé par Marc Vendeurdubanc au point relais', date: H(5) }] },
      };
      for (const [quoi, corps] of Object.entries(cas)) {
        for (const [ou, Rx] of [['page', Ri], ['fond', R]]) {
          const a = Rx.allegerSuivi(corps), c = Rx.contratSuivi(a);
          const s = JSON.stringify([a, c]);
          const vus = NOMS.filter((x) => s.includes(x));
          dit(vus.length === 0 && c && c.etapes.length >= 1, `${quoi} (${ou}) : rien ne sort, l’étape reste`, `${vus.join(',')} · ${JSON.stringify(c && c.etapes)}`);
        }
      }
      const c2 = R.contratSuivi(R.allegerSuivi({ journey: [{ title: 'Colis déposé par Marc Vendeurdubanc au point relais', date: H(5) }] }));
      dit(c2 && /au point relais/.test(c2.etapes[0].t), 'ce qui suit la personne reste (« … au point relais »)', JSON.stringify(c2 && c2.etapes));
      const c3 = R.contratSuivi(R.allegerSuivi({ journey: [{ title: 'Colis remis au transporteur', date: H(5), status: 'in_transit' }] }));
      dit(c3 && c3.etapes[0].t === 'Colis remis au transporteur' && c3.etapes[0].code === 'in_transit', 'l’autre sens : « remis au transporteur » et un code machine restent tels quels', JSON.stringify(c3 && c3.etapes));
    });

    // ═══ K ═══════════════════════════════════════════════════════════════════
    console.log('\n── K. (revue du 24 oct.) Le suivi ne prend pas la place de l’argent et des colis ; une forme inconnue ne se relit pas');
    await essaie('K', async () => {
      // a. 35 achats en route (mesuré sur un de ses comptes), une heure de visites ; un colis arrive au relais
      const achats = [];
      for (let i = 0; i < 35; i++) achats.push({ transaction_id: 32000000000 + i, title: 'Achat ' + i, status: "Commande expédiée et en cours d'acheminement ! ", transaction_user_status: 'waiting', date: H(24 + i), conversation_id: 800000 + i });
      const lk = { harvest_111_orders_purchased: { type: 'orders_purchased', payload: { my_orders: achats } }, harvest_111_orders_sold: { type: 'orders_sold', payload: { my_orders: [] } } };
      const fk = faireFond({ src: BG, lignes: lk, vinted: (e) => {
        if (/journey_summary/.test(e.chemin)) return { status: 200, body: { journey: [{ title: 'Colis en route', date: H(2), status_code: 'in_transit' }] } };
        if (/\/conversations\/\d+/.test(e.chemin)) return { status: 200, body: { conversation: { id: 1, messages: [] } } };
        return { status: 404, body: {} };
      } });
      for (let v = 1; v <= 12; v++) {
        if (v === 8) lk.harvest_111_orders_purchased.payload.my_orders.push({ transaction_id: 32999999999, title: 'Colis au relais', status: "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais", transaction_user_status: 'needs_action', date: H(30), conversation_id: 899999 });
        for (const n of ['capterPreuvesVente', 'capterRetraits', 'capterConfirmations', 'capterDatesVersement', 'capterReleves', 'capterSuivisAchats']) await fk.ctx[n]('111');
      }
      const lus = fk.j.vinted.filter((e) => /journey_summary/.test(e.chemin)).length;
      const code = fk.j.vinted.filter((e) => /\/conversations\/899999/.test(e.chemin)).length;
      dit(code >= 1, 'le code du colis arrivé au point relais est lu, malgré 35 achats en route', `lectures de sa conversation : ${code}`);
      dit(lus <= 6, 'le suivi lit 6 achats au plus dans l’heure, sur un compte', `${lus} lecture(s)`);
      const rP = await faireFond({ src: BG, lignes: {} }).ctx.reserveLectures('111', 'photos');
      dit(rP === 16, 'la réserve que les photos laissent ne compte pas le suivi (16, pas 19)', `réserve=${rP}`);
      // b. une forme jamais reconnue : une lecture de mesure, pas 12 toutes les 3 h
      const ach2 = []; for (let i = 0; i < 12; i++) ach2.push({ transaction_id: 34000000000 + i, title: 'Achat ' + i, status: "Commande expédiée et en cours d'acheminement ! ", transaction_user_status: 'waiting', date: H(24 + i) });
      const fi = faireFond({ src: BG, lignes: { harvest_111_orders_purchased: { type: 'orders_purchased', payload: { my_orders: ach2 } } },
        vinted: (e) => (/journey_summary/.test(e.chemin) ? { status: 200, body: { journey_summary: { steps: [{ key: 'shipped', happened_at: H(30) }, { key: 'parcel_at_pickup', happened_at: H(1) }] }, code: 0 } } : { status: 404, body: {} }) });
      const vieillir = (ms) => { for (const c of ['vrmSuiviFaits']) { const m = fi.store[c] || {}; for (const k of Object.keys(m)) m[k] -= ms; } for (const c of ['vrmLectures', 'vrmSuiviLus']) { const l = fi.store[c] || {}; for (const k of Object.keys(l)) l[k] = l[k].map((t) => t - ms); } };
      const parPeriode = [];
      for (let p = 0; p < 4; p++) { const avant = fi.j.vinted.length; for (let v = 0; v < 6; v++) await fi.ctx.capterSuivisAchats('111'); parPeriode.push(fi.j.vinted.length - avant); vieillir(3 * 3600000 + 60000); }
      dit(parPeriode.reduce((a, b) => a + b, 0) <= 1 && ((fi.lignes.panel_formes_suivi || {}).journey || {}).etat === 'inconnue', 'une forme jamais reconnue : une seule lecture de mesure (pas une par achat toutes les 3 h)', JSON.stringify(parPeriode));
      // c. un achat dont la dernière étape rangée est déjà une ARRIVÉE n'est plus relu
      const lr = { harvest_111_orders_purchased: { type: 'orders_purchased', payload: { my_orders: [{ transaction_id: 35000000001, title: 'Arrivé', status: "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais", transaction_user_status: 'needs_action', date: H(30) }, { transaction_id: 35000000002, title: 'En route', status: 'Colis expédié', transaction_user_status: 'waiting', date: H(30) }] } },
        harvest_111_suivi_35000000001: { v: 1, tx: '35000000001', source: 'journey', capturedAt: H(2), etapes: [{ t: 'Colis disponible au point relais', at: H(3), code: 'at_pickup' }], dernier: { t: 'Colis disponible au point relais', at: H(3), code: 'at_pickup' }, transporteur: null, suivi: null, forme: {} } };
      const fr = faireFond({ src: BG, lignes: lr, vinted: vintedSuivi() });
      await fr.ctx.capterSuivisAchats('111');
      const chemins = lusJ(fr).map((v) => v.chemin.split('/')[4]);
      dit(JSON.stringify(chemins) === JSON.stringify(['35000000002']), 'un achat déjà arrivé au point relais n’est plus relu ; celui en route, si', JSON.stringify(chemins));
    });

    // ═══ L ═══════════════════════════════════════════════════════════════════
    console.log('\n── L. (29 oct.) Un achat au point relais jamais lu passe AVANT ceux déjà lus en route');
    await essaie('L', async () => {
      // R1 : au point relais (Vinted dit « à retirer »), jamais lu, le plus ancien ;
      // R2 : au point relais, déjà lu (dernière étape « en transit ») ;
      // E1 : en route, jamais lu ; E2 à E4 : en route, déjà lus, les plus récents.
      const RELAIS = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
      const achats = [
        { transaction_id: 36000000001, title: 'R1', status: RELAIS, transaction_user_status: 'needs_action', date: H(100) },
        { transaction_id: 36000000002, title: 'R2', status: RELAIS, transaction_user_status: 'needs_action', date: H(90) },
        { transaction_id: 36000000003, title: 'E1', status: 'Colis expédié', transaction_user_status: 'waiting', date: H(40) },
        { transaction_id: 36000000004, title: 'E2', status: 'Colis expédié', transaction_user_status: 'waiting', date: H(5) },
        { transaction_id: 36000000005, title: 'E3', status: 'Colis expédié', transaction_user_status: 'waiting', date: H(6) },
        { transaction_id: 36000000006, title: 'E4', status: 'Colis expédié', transaction_user_status: 'waiting', date: H(7) },
        // statut Vinted encore « expédié » mais Vinted demande un geste (needs_action) : au relais aussi
        { transaction_id: 36000000007, title: 'R3', status: 'Colis expédié', transaction_user_status: 'needs_action', date: H(200) },
      ];
      const lu = (tx) => ({ v: 1, tx, source: 'journey', capturedAt: H(4), etapes: [{ t: 'Colis en transit', at: H(4), code: 'in_transit' }], dernier: { t: 'Colis en transit', at: H(4), code: 'in_transit' }, transporteur: null, suivi: null, forme: {} });
      const ll = { harvest_111_orders_purchased: { type: 'orders_purchased', payload: { my_orders: achats } } };
      for (const tx of ['36000000002', '36000000004', '36000000005', '36000000006']) ll[`harvest_111_suivi_${tx}`] = lu(tx);
      const fl = faireFond({ src: BG, lignes: ll, vinted: vintedSuivi() });
      await fl.ctx.capterSuivisAchats('111');
      const v1 = lusJ(fl).map((v) => v.chemin.split('/')[4]);
      dit(JSON.stringify(v1) === JSON.stringify(['36000000001', '36000000007', '36000000002']), 'première visite : d’abord les achats au point relais (jamais lus, puis déjà lus), avant ceux en route', JSON.stringify(v1));
      await fl.ctx.capterSuivisAchats('111');
      const v2 = lusJ(fl).map((v) => v.chemin.split('/')[4]).slice(3);
      dit(v2[0] === '36000000003', 'ensuite l’achat en route jamais lu, avant ceux en route déjà lus', JSON.stringify(v2));
      dit(v2.length === 3 && v2.slice(1).every((t) => ['36000000004', '36000000005', '36000000006'].includes(t)), 'puis ceux en route déjà lus (le plus récent d’abord)', JSON.stringify(v2));
    });
  } finally {
    nettoyer();
  }
  console.log(`\n${ko ? '❌' : '✅'} audit-suivi-vinted : ${ok} vert(s), ${ko} rouge(s)${MUT ? ` (mutation « ${MUT} »)` : ''}`);
  process.exit(ko ? 1 : 0);
})();
