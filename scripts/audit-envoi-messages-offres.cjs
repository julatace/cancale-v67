// ════════════════════════════════════════════════════════════════════════════
//  L'ENVOI DES MESSAGES ET DES OFFRES DEPUIS VRM (25 nov., ext. 5.452.0 `envoisurs`)
//  Julien : « Améliore l'extension, ça envoie pas bien les messages et les offres. »
//
//  On EXÉCUTE le vrai background.js (§4.10) dans un `vm`, la commande de l'app jouée de bout en bout par la file
//  « À distance » (`distanceExecuter` → `executerPourApp` → la page de l'onglet de travail : fausse page vinted.fr,
//  scripts/_fausse-page-vinted.cjs) contre un faux Vinted qui répond À LA FORME RÉELLE (réponse de la page, `code`,
//  `message`, statuts). Chaque envoi doit finir :
//    · confirmé par Vinted (réponse lue) ⇒ « fait » ; jamais « fait » sur un refus de Vinted, même dans un 200 ;
//    · ou DIT avec le geste : 429/403 ⇒ pause posée, « reprise vers HH h MM », la commande ATTEND (rien n'était parti) ;
//      401 ⇒ « reconnecte-toi » ; plafond de 50/h ⇒ attend, l'heure dite ; autre compte / pas d'onglet ⇒ attend, rien ne
//      part ; 5xx (peut-être parti) ⇒ « pas sûr », JAMAIS renvoyé ;
//    · côté app (src/agir/porte.js) : jamais deux dépôts du même message (double toucher) ; pas connecté ⇒ rien ;
//      l'issue SUIVIE (src/agir/suivi.js) — jamais « envoyé » sur un simple dépôt.
//  `--src chemin` : un autre background.js (preuve sur le code d'avant, §6.1). `MUTATION=nom` : la règle réaffaiblie
//  dans une copie en mémoire ⇒ au moins un contrôle rouge (`--prouve` les joue toutes). Aucune donnée réelle.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const racine = path.join(__dirname, '..');
const iSrc = process.argv.indexOf('--src');
const cheminBg = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(racine, 'vinted-sync-extension', 'background.js');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };

const MUTATIONS = {
  'refus-200-fait': ['bg', "=== 'refuse') {\n      const d = r.data", "=== 'jamais') {\n      const d = r.data"],
  'garde-perdue': ['bg', '(avantEnvoi || vintedANon) && adistAttend(code)', 'false && adistAttend(code)'],
  'frein-muet': ['bg', '  if (freinVinted(st)) { const p = await pauseVinted()', '  if (false) { const p = await pauseVinted()'],
  'lecture-offre': ['bg', '  if (!lu || !lu.ok) {\n    const st = Number(lu && lu.status) || 0;', '  if (false) {\n    const st = Number(lu && lu.status) || 0;'],
  'double-depot': ['porte', "  if (enVol.has(cle)) return { ok: false, raison: 'deja' };\n", ''],
  'suivi-menteur': ['suivi', "    case 'attente': return v.attend", "    case 'attente': return { etat: 'fait', cle: 'agir.suivi.fait', vars: {} }; case 'x': return v.attend"],
};
const MUT = process.env.MUTATION || '';
const muter = (portee, texte) => {
  if (!MUT) return texte;
  const m = MUTATIONS[MUT];
  if (!m) throw new Error('mutation inconnue ' + MUT);
  if (m[0] !== portee) return texte;
  if (!texte.includes(m[1])) throw new Error('mutation introuvable : ' + MUT);
  return texte.split(m[1]).join(m[2]);
};
const SRC = muter('bg', fs.readFileSync(cheminBg, 'utf8'));

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => {
  if (bon) { ok++; console.log(`✅ ${quoi}`); }
  else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + String(det).slice(0, 400) : ''}`); }
};
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`); return null; } };

const UID = '3175765377', AUTRE = '999';
// La conversation 5123 (transaction 123) porte UNE offre en attente (n° 456, de l'acheteur 77) — forme de l'ancienne messagerie.
const FIL_OFFRE = { conversation: { id: 5123, opposite_user: { id: 77 }, messages: [{ entity_type: 'offer_request_message', entity: { status: 10, offer_request_id: 456, transaction_id: 123, user_id: 77, price: { amount: '40' } } }] } };

// `vinted(m, chemin, corps)` → { status, json } : la réponse que VINTED donne à la requête de la PAGE.
function faireCtx({ connecte = UID, vinted = () => ({ status: 200, json: { code: 0 } }), lectureConv = () => ({ status: 200, json: FIL_OFFRE }), store: st0 = {} } = {}) {
  const store = Object.assign({}, st0); const ecritures = [];
  const ctx = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 1)), clearTimeout, setInterval: () => 0, clearInterval,
    URL, TextDecoder, TextEncoder, crypto: require('crypto').webcrypto,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, onMessageExternal: { addListener() {} }, getManifest: () => ({ version: '9.9.9' }), lastError: null, id: 'x', sendMessage: dual(undefined) },
      alarms: { create() {}, clear: dual(true), onAlarm: { addListener() {} } },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {}, onClicked: { addListener() {} }, setPopup() {} },
      tabs: { onUpdated: { addListener() {} }, onActivated: { addListener() {} }, query: dual([]), sendMessage: dual(undefined), create: dual({}) },
      storage: { local: {
        get(k, cb) { const cles = Array.isArray(k) ? k : (typeof k === 'string' ? [k] : Object.keys(k || {})); const out = {}; for (const c of cles) if (store[c] !== undefined) out[c] = JSON.parse(JSON.stringify(store[c])); if (typeof cb === 'function') { cb(out); return; } return Promise.resolve(out); },
        set(o, cb) { Object.assign(store, JSON.parse(JSON.stringify(o))); if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
        remove(k, cb) { for (const c of (Array.isArray(k) ? k : [k])) delete store[c]; if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
      }, onChanged: { addListener() {} } },
      webNavigation: { onCompleted: { addListener() {} } },
      scripting: { executeScript: dual([]) },
    },
    fetch: async () => ({ ok: true, status: 200, json: async () => [], text: async () => '[]', headers: { get: () => 'application/json' } }),
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'background.js' });
  const etat = { connecte };
  ctx.getStoredAccounts = async () => [{ vinted_user_id: UID, login: 'compte_banc', domain: 'www.vinted.fr' }, { vinted_user_id: AUTRE, login: 'autre_banc', domain: 'www.vinted.fr' }];
  ctx.activeAccountId = async () => etat.connecte;
  try { ctx.compteConnecte = async () => etat.connecte; } catch (_) {}
  ctx.actionsAutresNavigateurs = async () => ({ n: 0, toutes: [], prudence: 0, lectures: [], nJour: 0, captcha: 0, so: { favori: [], offre: [] }, ta: null });
  ctx.convDeTransaction = async (u, tx) => (String(tx) === '123' ? '5123' : '');
  require('./_fausse-page-vinted.cjs').brancherPageVinted(ctx, { fetchPage: async (chemin, o) => {
    const m = String((o && o.method) || 'GET').toUpperCase();
    const r = m === 'GET' && /\/api\/v2\/conversations\/\d+$/.test(chemin) ? lectureConv(chemin) : m === 'GET' ? { status: 200, json: {} } : vinted(m, chemin, o && o.body);
    if (m !== 'GET') ecritures.push(m + ' ' + chemin);
    const st = Number(r.status) || 200;
    return { status: st, ok: st >= 200 && st < 300, json: async () => (r.json === undefined ? null : r.json) };
  } });
  // Une commande de l'app, telle que la file « À distance » la joue (le VRAI chemin du clic de l'app).
  const commande = (geste, args) => ctx.distanceExecuter({ site: 'vinted', geste, compte: UID, args }, {});
  return { ctx, store, ecritures, etat, commande };
}
const repondre = (texte = 'Oui, toujours disponible') => ['repondre', { conv: '5123', texte }];

(async () => {
  // ══ M : UN MESSAGE ══
  await essaie('M1', async () => {
    const f = faireCtx();
    const i = await f.commande(...repondre());
    dit(i && i.etat === 'fait' && f.ecritures.length === 1 && /\/conversations\/5123\/replies$/.test(f.ecritures[0]), 'M1 Vinted répond 200 { code: 0 } ⇒ « fait », UN envoi', JSON.stringify({ i, e: f.ecritures }));
  });
  await essaie('M2', async () => {
    const f = faireCtx({ vinted: () => ({ status: 200, json: { code: 46, message: 'Ce message ne respecte pas nos règles' } }) });
    const i = await f.commande(...repondre());
    dit(i && i.etat === 'refuse' && /nos règles/.test(i.raison) && f.ecritures.length === 1, 'M2 un REFUS de Vinted dans un 200 (code ≠ 0) ⇒ « refusé » avec ses mots, jamais « fait »', JSON.stringify(i));
  });
  await essaie('M3', async () => {
    const f = faireCtx({ vinted: () => ({ status: 429, json: { message: 'Too many requests' } }) });
    const i = await f.commande(...repondre());
    const p = f.store.vrmPauseVinted;
    dit(i && i.etat === 'attendre' && i.code === 'vinted-pause' && /reprise vers \d{1,2} h \d{2}/.test(i.raison) && Number(i.attendreMs) >= 60000 && p && p.jusqua > Date.now() && f.ecritures.length === 1,
      'M3 429 ⇒ pause posée, « reprise vers HH h MM » dite, la commande ATTEND (rien n’était parti)', JSON.stringify({ i, p }));
    // Pendant la pause : la même commande rejouée ne part pas (rien de plus chez Vinted), elle attend encore.
    const i2 = await f.commande(...repondre());
    dit(i2 && i2.etat === 'attendre' && f.ecritures.length === 1, 'M3b pendant la pause : rien ne repart, la commande attend', JSON.stringify(i2));
  });
  await essaie('M4', async () => {
    const f = faireCtx({ vinted: () => ({ status: 401, json: { message: 'invalid_authentication_token' } }) });
    const i = await f.commande(...repondre());
    dit(i && i.etat === 'attendre' && i.code === 'session' && /reconnecte-toi/.test(i.raison) && f.ecritures.length === 1, 'M4 401 (session / jeton périmé) ⇒ « reconnecte-toi sur vinted.fr », attend, rien n’est renvoyé à l’aveugle', JSON.stringify(i));
  });
  await essaie('M5', async () => {
    const f = faireCtx({ vinted: () => ({ status: 502, json: null }) });
    const i = await f.commande(...repondre());
    dit(i && i.etat === 'incertain' && f.ecritures.length === 1, 'M5 502 (peut-être parti) ⇒ « pas sûr », JAMAIS remis en attente (jamais deux fois)', JSON.stringify(i));
  });
  await essaie('M6', async () => {
    const f = faireCtx();
    for (let k = 0; k < 50; k++) await f.commande(...repondre('Message ' + k));
    const n = f.ecritures.length;
    const i = await f.commande(...repondre('Le 51e'));
    dit(n === 50 && f.ecritures.length === 50 && i && i.etat === 'attendre' && i.code === 'plafond' && Number(i.attendreMs) > 0 && /reprise vers/.test(i.raison),
      'M6 plafond de 50/h atteint ⇒ rien ne part, la commande ATTEND (avant : refusée, le message perdu), l’heure de reprise dite', JSON.stringify({ n, i }));
  });
  await essaie('M7', async () => {
    const f = faireCtx({ connecte: AUTRE });
    const i = await f.commande(...repondre());
    dit(i && i.etat === 'attendre' && i.code === 'vinted-autre' && f.ecritures.length === 0, 'M7 l’onglet est sur un AUTRE compte ⇒ rien ne part, attend, « bascule sur ce compte »', JSON.stringify(i));
    const g = faireCtx({ connecte: null });
    const j = await g.commande(...repondre());
    dit(j && j.etat === 'attendre' && j.code === 'vinted-absent' && g.ecritures.length === 0, 'M7b aucun compte Vinted connecté ⇒ rien ne part, attend, « connecte-toi sur vinted.fr »', JSON.stringify(j));
  });
  await essaie('M8', async () => {
    const f = faireCtx({ store: { vrmPauseVinted: { jusqua: Date.now() + 20 * 60000, niveau: 1, statut: 429, depuis: Date.now() } } });
    const i = await f.commande(...repondre());
    dit(i && i.etat === 'attendre' && i.code === 'vinted-pause' && f.ecritures.length === 0, 'M8 une pause déjà posée ⇒ rien ne part, attend (avant : refusée pour toujours)', JSON.stringify(i));
  });
  // ══ O : LES OFFRES ══
  await essaie('O1', async () => {
    const f = faireCtx();
    const i = await f.commande('contreOffre', { tx: '123', prix: 45, conv: '5123' });
    dit(i && i.etat === 'fait' && i.apres === 45 && f.ecritures.length === 1 && /\/transactions\/123\/offers$/.test(f.ecritures[0]), 'O1 une offre acceptée par Vinted (200, code 0) ⇒ « fait », 45 €', JSON.stringify({ i, e: f.ecritures }));
  });
  await essaie('O2', async () => {
    const f = faireCtx({ vinted: () => ({ status: 200, json: { code: 106, message: 'Le prix proposé est trop bas' } }) });
    const i = await f.commande('contreOffre', { tx: '123', prix: 45, conv: '5123' });
    dit(i && i.etat === 'refuse' && /trop bas/.test(i.raison) && f.ecritures.length === 1, 'O2 une offre REFUSÉE par Vinted dans un 200 ⇒ « refusé » avec ses mots, jamais « fait »', JSON.stringify(i));
  });
  await essaie('O3', async () => {
    const f = faireCtx({ lectureConv: () => ({ status: 404, json: { code: 404, message: 'not found' } }) });
    const i = await f.commande('refuser', { tx: '123', oid: '456', conv: '5123' });
    dit(i && i.etat === 'refuse' && i.code === 'conversation-illisible' && /ouvre-la sur vinted\.fr/.test(i.raison) && f.ecritures.length === 0,
      'O3 la conversation d’une offre que Vinted ne rend pas (404) ⇒ dit avec le geste (« ouvre-la sur vinted.fr »), rien ne part — plus « l’offre n’attend plus »', JSON.stringify(i));
  });
  await essaie('O4', async () => {
    const f = faireCtx({ lectureConv: () => ({ status: 503, json: null }) });
    const i = await f.commande('refuser', { tx: '123', oid: '456', conv: '5123' });
    dit(i && i.etat === 'attendre' && i.code === 'lecture' && f.ecritures.length === 0, 'O4 la conversation pas rendue (503) ⇒ rien ne part, la commande attend (réessai)', JSON.stringify(i));
  });
  await essaie('O5', async () => {
    const f = faireCtx();
    const i = await f.commande('refuser', { tx: '123', oid: '456', conv: '5123' });
    dit(i && i.etat === 'fait' && f.ecritures.length === 1 && /offer_requests\/456\/reject$/.test(f.ecritures[0]), 'O5 refuser CETTE offre (le fil relu la montre) ⇒ UN PUT …/456/reject, « fait »', JSON.stringify({ i, e: f.ecritures }));
  });

  // ══ A : CÔTÉ APP — la porte, jamais deux dépôts, le suivi ══
  await essaie('A', async () => {
    const dir = fs.mkdtempSync(path.join(racine, 'src', 'agir', '.banc-envoi-'));
    process.on('exit', () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} });
    const vraie = (f) => pathToFileURL(path.join(racine, 'src', 'agir', f)).href;
    fs.writeFileSync(path.join(dir, 'suivi.js'), muter('suivi', fs.readFileSync(path.join(racine, 'src', 'agir', 'suivi.js'), 'utf8')));
    let porte = muter('porte', fs.readFileSync(path.join(racine, 'src', 'agir', 'porte.js'), 'utf8')).replace("from './peutAgir.js'", `from '${vraie('peutAgir.js')}'`);
    fs.writeFileSync(path.join(dir, 'porte.js'), porte);
    const P = await import(vraie('peutAgir.js'));
    const Porte = await import(pathToFileURL(path.join(dir, 'porte.js')).href);
    const S = await import(pathToFileURL(path.join(dir, 'suivi.js')).href);
    const { faitsInventes } = require('./_porte-agir.cjs');
    if (typeof globalThis.window === 'undefined') globalThis.window = { dispatchEvent() {} };
    const deposes = [];
    Porte.poserEnvoiAgir({ deposer: async (c) => { deposes.push(c); await new Promise((r) => setTimeout(r, 40)); return { id: 'cmd_dist_banc' + String(deposes.length).padStart(4, '0') }; } });
    Porte.poserFaitsAgir(faitsInventes(P));
    const g = (texte, compte = '41000001') => Porte.envoyerGeste({ site: 'vinted', compte, geste: 'repondre', distGeste: 'repondre', args: { conv: '5123', texte } });
    const [r1, r2] = await Promise.all([g('Oui'), g('Oui')]);
    dit(deposes.length === 1 && [r1, r2].filter((r) => r.ok).length === 1 && [r1, r2].some((r) => r.raison === 'deja'), 'A1 deux touchers sur « Envoyer » pendant le dépôt ⇒ UNE commande (jamais deux fois le même message)', JSON.stringify({ n: deposes.length, r1, r2 }));
    deposes.length = 0;
    await Promise.all([g('Oui'), g('Autre chose')]);
    dit(deposes.length === 2, 'A2 … deux messages DIFFÉRENTS partent tous les deux (l’autre sens)', deposes.length);
    deposes.length = 0;
    const r3 = await g('Oui', '41000002');
    dit(deposes.length === 0 && r3 && !r3.ok, 'A3 compte pas connecté ⇒ rien n’est déposé', JSON.stringify(r3));
    // Le suivi : la phrase vient de l'issue ÉCRITE par l'extension, jamais du dépôt.
    const ph = (v) => S.phraseSuivi(v);
    const fautes = [];
    if (ph(undefined).etat === 'fait' || ph({ etat: 'attente' }).etat === 'fait' || ph({ etat: 'pris' }).etat === 'fait') fautes.push('« envoyé » avant l’issue');
    if (ph({ etat: 'fait' }).cle !== 'agir.suivi.fait') fautes.push('fait');
    const at = ph({ etat: 'attente', attend: 'plafond', raison: 'plafond… (reprise vers 14 h 10)' });
    if (at.cle !== 'agir.suivi.attend' || !/14 h 10/.test(at.vars.raison)) fautes.push('attente remise : la raison et l’heure');
    if (ph({ etat: 'refuse', raison: 'Vinted a refusé' }).cle !== 'agir.suivi.refuse') fautes.push('refusé');
    if (ph({ etat: 'incertain' }).cle !== 'agir.suivi.incertain') fautes.push('pas sûr');
    if (ph(null).etat !== 'passu') fautes.push('pas su');
    dit(!fautes.length, 'A4 le suivi dit l’issue réelle : en file / pas encore parti (raison, heure) / envoyé seulement quand Vinted l’a confirmé / refusé / pas sûr', fautes.join(', '));
    const vues = [];
    const suite = [{ etat: 'attente' }, { etat: 'pris' }, { etat: 'fait' }, { etat: 'fait' }];
    Porte.poserEnvoiAgir({ deposer: async () => null, lire: async () => suite.shift() });
    await new Promise((res) => { Porte.suivreCommande('cmd_dist_banc0001', (v) => { vues.push(v && v.etat); if (S.suiviTermine(v)) res(); }); setTimeout(res, 15000); });
    dit(vues.join(',') === 'attente,pris,fait', 'A5 l’app relit la commande jusqu’à son issue, puis s’arrête', vues.join(','));
    Porte.poserEnvoiAgir(null); Porte.poserFaitsAgir(null);
  });

  // ══ T : l'app SUIT l'issue (lu dans le composant : jamais « vidé » au dépôt) ══
  await essaie('T', async () => {
    const a = fs.readFileSync(path.join(racine, 'src', 'agir', 'Agir.jsx'), 'utf8').replace(/\/\/[^\n]*/g, '');
    const comp = (a.split('export function ComposerReponse')[1] || '').split('\nexport function ')[0];
    const offre = (a.split('export function GestesOffreVinted')[1] || '').split('\nexport function ')[0];
    dit(/<IssueOuSuivi\b/.test(comp) && /<IssueOuSuivi\b/.test(offre) && !/if \(r\.ok\) \{ setTexte\(''\)/.test(comp), 'T1 Répondre et les gestes d’offre montrent l’issue SUIVIE ; le champ n’est plus vidé au simple dépôt');
  });

  console.log(`\n${ko ? '❌' : '✅'} audit-envoi-messages-offres : ${ok} verts, ${ko} rouge(s)${MUT ? ' (mutation ' + MUT + ')' : ''}`);
  if (process.argv.includes('--prouve') && !MUT) {
    const { spawnSync } = require('child_process');
    let tenues = 0;
    for (const nom of Object.keys(MUTATIONS)) {
      const r = spawnSync(process.execPath, [__filename, ...process.argv.slice(2).filter((x) => x !== '--prouve')], { env: Object.assign({}, process.env, { MUTATION: nom }), encoding: 'utf8', timeout: 300000 });
      const rouges = (String(r.stdout).match(/^❌ (?!audit-)/gm) || []).length;
      if (rouges) tenues++;
      console.log(`${rouges ? '✅' : '❌'} mutation ${nom} : ${rouges} rouge(s)`);
    }
    console.log(`${tenues}/${Object.keys(MUTATIONS).length} mutations tenues`);
    if (tenues !== Object.keys(MUTATIONS).length) process.exitCode = 1;
  }
  if (ko) process.exitCode = 1;
  setTimeout(() => process.exit(process.exitCode || 0), 50);
})();
