// ════════════════════════════════════════════════════════════════════════════
//  À QUI EST CE JETON ? — l'index des jetons du widget et des SMS (7 nov.)
//  api/_lib/jeton-index.js, branché sur la route du widget (api/widget.js,
//  `ownerDuToken`) et sur celle des SMS (api/_lib/sms-mondialrelay.js). On
//  EXÉCUTE les vraies routes contre un FAUX PostgREST qui sert la vraie forme
//  (projections `alias:data->>clé`, filtres `owner=eq.`/`id=eq.`/`data->>x=eq.`,
//  plafond de 1 000 lignes, `Range`, upsert `on_conflict=owner,id`, DELETE).
//   J1. Transition : un jeton sans index ⇒ l'ancienne recherche UNE fois, puis
//       l'index `jeton_widget_<sha256>` est écrit chez le propriétaire NEUTRE
//       (jamais le jeton en clair) ; la réponse n'est pas un refus.
//   J2. Passage suivant : l'index seul (2 lignes lues au lieu de 1 000), le
//       jeton RE-COMPARÉ à celui du `main` du vendeur ; aucune lecture de toutes
//       les lignes `main`.
//   J3. L'index ne fait jamais foi seul : un index qui désigne un vendeur dont
//       le jeton est autre (jeton changé, index forgé) ⇒ 401, index retiré.
//       L'ancien jeton après un changement ⇒ 401 ; le nouveau ⇒ indexé.
//   J4. Pannes : index illisible ⇒ 503, rien écrit ; `main` du vendeur
//       illisible ⇒ 503, index pas retiré. Jeton faux ⇒ 401, aucun index écrit.
//   J5. SMS : la même règle (index écrit, puis lu ; jeton changé ⇒ 401).
//   J6. Comparaison à durée constante (`timingSafeEqual` sur empreintes).
//  Données inventées. `--prouve` : chaque mutation rougit.
//  Lancer : node scripts/audit-jeton-index.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');
const LIB = 'api/_lib/jeton-index.js';

const MUTATIONS = {
  'index cru sans re-comparer': [[LIB, 'if (t && memeJeton(jeton, t)) return { etat: \'trouve\', owner };', 'return { etat: \'trouve\', owner };']],
  'index jamais écrit (widget)': [['api/widget.js', 'if (parCle.owner) await ecrireIndexJeton(', 'if (false) await ecrireIndexJeton(']],
  'index jamais lu (widget)': [['api/widget.js', "if (idx.etat === 'trouve') return idx.owner;", '']],
  'index illisible pris pour absent': [['api/widget.js', 'if (idx === undefined) {', 'if (false) {']],
  'index périmé gardé': [[LIB, "await retirerIndexJeton({ url, headers, fetcher, genre, jeton });\n  return { etat: 'perime' };", "return { etat: 'perime' };"]],
  'SMS sans index': [['api/_lib/sms-mondialrelay.js', "let owner = idx.etat === 'trouve' ? idx.owner : '';", "let owner = '';"]],
  'comparaison qui n’est pas à durée constante': [[LIB, "return crypto.timingSafeEqual(Buffer.from(empreinteJeton(x), 'hex'), Buffer.from(empreinteJeton(y), 'hex'));", 'return x === y;']],
  'jeton en clair dans l’index': [[LIB, 'export const idIndexJeton = (genre, jeton) => `jeton_${genre}_${empreinteJeton(jeton)}`;', 'export const idIndexJeton = (genre, jeton) => `jeton_${genre}_${jeton}`;']],
};
if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
let ko = 0, ok = 0;
const vrai = (c, m) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m); } };

const NEUTRE = '00000000-0000-0000-0000-000000000000';
const uuid = (n) => `${String(n).padStart(8, '0')}-2222-4333-8444-555555555555`;
const A = uuid(424242);
const sha = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');

// ── Le faux PostgREST ───────────────────────────────────────────────────────
function fausseBase() {
  const lignes = new Map();          // `${owner}|${id}` → data
  const journal = [];                // { methode, url, servies }
  const pannes = { lecture: null };
  const J = (status, x, extra = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => x, text: async () => JSON.stringify(x), ...extra });
  const like = (motif) => new RegExp('^' + motif.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*|%/g, '.*') + '$');
  const fetch = async (url, o = {}) => {
    const u = decodeURIComponent(String(url));
    const methode = (o.method || 'GET').toUpperCase();
    const e = { methode, url: u, servies: 0, corps: o.body || '' }; journal.push(e);
    if (/\/rest\/v1\/rpc\/vrm_acces_pour/.test(u)) return J(200, true);
    if (!/\/rest\/v1\/app_data\?/.test(u)) return J(200, []);
    const q = u.slice(u.indexOf('?') + 1);
    if (methode === 'POST') {
      if (!/on_conflict=owner,id/.test(q)) return J(400, {});
      for (const r of JSON.parse(o.body)) lignes.set(`${r.owner}|${r.id}`, JSON.parse(JSON.stringify(r.data)));
      return J(201, null);
    }
    if (q === 'select=owner&limit=1') return J(200, []);
    if (pannes.lecture && methode === 'GET' && pannes.lecture(u)) return J(503, { message: 'panne' });
    const filtres = [];
    let sel = '', limit = Infinity;
    for (const part of q.split('&')) {
      const i = part.indexOf('='); const k = part.slice(0, i), v = part.slice(i + 1);
      if (k === 'select') sel = v; else if (k === 'limit') limit = Number(v); else if (k === 'order' || k === 'on_conflict') continue; else filtres.push([k, v]);
    }
    const garde = (o2, id2, d) => filtres.every(([k, v]) => {
      const val = k === 'owner' ? o2 : k === 'id' ? id2 : /^data->>/.test(k) ? (d && d[k.slice(7)] != null ? String(d[k.slice(7)]) : null) : undefined;
      if (val === undefined) return false;   // un filtre inconnu (meta->>…) : aucune ligne ici
      if (v.startsWith('eq.')) return val === v.slice(3);
      if (v.startsWith('like.')) return val != null && like(v.slice(5)).test(val);
      if (v.startsWith('in.(')) return v.slice(4, -1).split(',').includes(val);
      if (v === 'is.null') return val == null;
      return false;
    });
    const choisies = [...lignes].filter(([k, d]) => { const [o2, ...r] = k.split('|'); return garde(o2, r.join('|'), d); })
      .sort((x, y) => (x[0] < y[0] ? -1 : 1));
    if (methode === 'DELETE') { for (const [k] of choisies) lignes.delete(k); return J(204, null); }
    if (methode === 'PATCH') return J(200, []);
    const rg = /^(\d+)-(\d+)$/.exec((o.headers || {}).Range || '');
    let de = rg ? +rg[1] : 0, a = rg ? +rg[2] : choisies.length - 1;
    a = Math.min(a, de + 999, de + limit - 1);
    const page = choisies.slice(de, a + 1).map(([k, d]) => {
      const [o2, ...r] = k.split('|'); const id2 = r.join('|');
      if (!sel) return { owner: o2, id: id2, data: d };
      const p = {};
      for (const c of sel.split(',')) {
        let m;
        if ((m = /^(\w+):data->>(\w+)$/.exec(c))) p[m[1]] = d && d[m[2]] != null ? String(d[m[2]]) : null;
        else if ((m = /^(\w+):data->(\w+)$/.exec(c))) p[m[1]] = d && d[m[2]] !== undefined ? d[m[2]] : null;
        else if ((m = /^(\w+):data->>(\w+)$/.exec(c))) p[m[1]] = null;
        else if (c === 'owner') p.owner = o2; else if (c === 'id') p.id = id2; else if (c === 'data') p.data = d;
        else { const m2 = /^(\w+):/.exec(c); if (m2) p[m2[1]] = null; }
      }
      return p;
    });
    e.servies = page.length;
    return J(rg ? 206 : 200, page);
  };
  return { lignes, journal, pannes, fetch };
}
const resMock = () => { const r = { code: 0, corps: null };
  r.status = (c) => { r.code = c; return r; }; r.json = (x) => { r.corps = x; return r; }; r.setHeader = () => {}; r.end = () => r; r.send = () => r; return r; };

(async () => {
  process.env.SUPABASE_URL = 'https://base.test';
  process.env.SUPABASE_SERVICE_KEY = 'cle-service-test';
  const base = fausseBase();
  global.fetch = base.fetch;
  const lib = await import(path.join(R, LIB));
  const widget = (await import(path.join(R, 'api/widget.js'))).default;
  const { routeSms } = await import(path.join(R, 'api/_lib/sms-mondialrelay.js'));

  // 1 000 vendeurs, chacun son `main` et sa clé de widget ; A est le n° 424242.
  const JW = 'WidgetA0123456789abcdefghijk';      // 28, la forme de l'app
  for (let i = 0; i < 999; i++) base.lignes.set(`${uuid(i)}|main`, { vrm_widget_token: 'W' + String(i).padStart(27, '0'), vrm_sms_token: 'S' + String(i).padStart(31, '0') });
  base.lignes.set(`${A}|main`, { vrm_widget_token: JW, vrm_sms_token: 'SmsA0123456789abcdefghijKLMNOPQR' });
  const appelW = async (k) => { const res = resMock(); const n0 = base.journal.length;
    await widget({ method: 'GET', query: { k }, headers: {} }, res);
    const j = base.journal.slice(n0);
    return { res, j, servies: j.reduce((s, e) => s + e.servies, 0), balayage: j.some((e) => /id=eq\.main&select=owner,vrm_widget_token/.test(e.url)) }; };
  const idxW = (t) => `${NEUTRE}|jeton_widget_${sha(t)}`;

  // ── J1. Transition ────────────────────────────────────────────────────
  let r = await appelW(JW);
  vrai(r.res.code !== 401 && r.res.code !== 503, `J1 jeton sans index ⇒ servi (code ${r.res.code})`);
  vrai(r.balayage, 'J1 l’ancienne recherche a eu lieu (transition)');
  vrai(base.lignes.has(idxW(JW)) && base.lignes.get(idxW(JW)).owner === A && base.lignes.get(idxW(JW)).genre === 'widget', 'J1 l’index `jeton_widget_<sha256>` est écrit chez le propriétaire neutre, il désigne A');
  vrai(![...base.lignes.keys()].some((k) => k.includes(JW)), 'J1 le jeton n’est jamais rangé en clair dans un identifiant');
  vrai(r.j.filter((e) => /owner=eq\./.test(e.url) && !/owner=eq\.00000000-/.test(e.url) && e.methode === 'GET').every((e) => e.url.includes('owner=eq.' + A)), 'J1 ensuite, chaque lecture est filtrée sur A');

  // ── J2. Passage suivant : l'index seul ─────────────────────────────────
  r = await appelW(JW);
  const lecturesResolution = r.j.filter((e) => /id=eq\.jeton_widget_|owner=eq\.[^&]*&id=eq\.main&select=t:/.test(e.url));
  vrai(r.res.code !== 401 && r.res.code !== 503, `J2 servi par l’index (code ${r.res.code})`);
  vrai(!r.balayage, 'J2 aucune lecture de toutes les lignes `main`');
  vrai(lecturesResolution.length === 2 && lecturesResolution.reduce((s, e) => s + e.servies, 0) === 2, `J2 deux lignes lues pour trouver le vendeur (au lieu de 1 000)`);
  vrai(lecturesResolution.some((e) => e.url.includes(`owner=eq.${A}&id=eq.main&select=t:data->>vrm_widget_token`)), 'J2 le jeton est re-comparé à celui du `main` de A');

  // ── J3. L'index ne fait jamais foi seul ────────────────────────────────
  const FORGE = 'ForgeA0123456789abcdefghijkl';
  base.lignes.set(idxW(FORGE), { owner: A, genre: 'widget', at: 'x' });
  r = await appelW(FORGE);
  vrai(r.res.code === 401 && !base.lignes.has(idxW(FORGE)) && !r.balayage, 'J3 index qui désigne A pour un jeton qui n’est pas le sien ⇒ 401, index retiré');
  const NEUF = 'NeufA0123456789abcdefghijklm';
  base.lignes.get(`${A}|main`).vrm_widget_token = NEUF;
  r = await appelW(JW);
  vrai(r.res.code === 401 && !base.lignes.has(idxW(JW)), 'J3 ancien jeton après un changement ⇒ 401, son index retiré');
  r = await appelW(NEUF);
  vrai(r.res.code !== 401 && base.lignes.has(idxW(NEUF)) && base.lignes.get(idxW(NEUF)).owner === A, 'J3 le nouveau jeton ⇒ servi et indexé');

  // ── J4. Pannes ─────────────────────────────────────────────────────────
  const avant = JSON.stringify([...base.lignes.keys()].filter((k) => k.startsWith(NEUTRE)));
  base.pannes.lecture = (u) => /id=eq\.jeton_widget_/.test(u);
  r = await appelW(NEUF);
  vrai(r.res.code === 503 && !r.j.some((e) => e.methode !== 'GET'), 'J4 index illisible ⇒ 503, rien écrit ni retiré');
  base.pannes.lecture = (u) => u.includes(`owner=eq.${A}&id=eq.main&select=t:`);
  r = await appelW(NEUF);
  vrai(r.res.code === 503 && base.lignes.has(idxW(NEUF)) && !r.j.some((e) => e.methode === 'DELETE'), 'J4 `main` du vendeur illisible ⇒ 503, l’index n’est pas retiré');
  base.pannes.lecture = null;
  vrai(JSON.stringify([...base.lignes.keys()].filter((k) => k.startsWith(NEUTRE))) === avant, 'J4 les index sont inchangés par les pannes');
  r = await appelW('FauxFaux0123456789abcdefghij');
  vrai(r.res.code === 401 && !r.j.some((e) => e.methode === 'POST'), 'J4 jeton faux ⇒ 401 (après l’ancienne recherche), aucun index écrit');

  // ── J5. SMS ────────────────────────────────────────────────────────────
  const JS = 'SmsA0123456789abcdefghijKLMNOPQR';
  const idxS = (t) => `${NEUTRE}|jeton_sms_${sha(t)}`;
  const appelS = async (k) => { const res = resMock(); const n0 = base.journal.length;
    await routeSms({ method: 'POST', query: { mode: 'sms', k }, headers: {}, body: { texte: 'Promo -20 % ce week-end !' } }, res, { url: 'https://base.test', key: 'cle-service-test', maintenant: () => Date.parse('2026-11-07T09:00:00Z') });
    const j = base.journal.slice(n0); return { res, j, balayage: j.some((e) => /data->>vrm_sms_token=eq\./.test(e.url)) }; };
  r = await appelS(JS);
  vrai(r.res.code === 200 && r.balayage && base.lignes.has(idxS(JS)) && base.lignes.get(idxS(JS)).owner === A, 'J5 SMS sans index ⇒ ancienne recherche, puis index écrit');
  r = await appelS(JS);
  vrai(r.res.code === 200 && !r.balayage, 'J5 SMS suivant ⇒ l’index seul (aucune recherche sur toutes les lignes `main`)');
  vrai(base.lignes.has(`${A}|vrm_sms_compteur`), 'J5 le SMS est compté chez A (le vendeur du jeton)');
  base.lignes.get(`${A}|main`).vrm_sms_token = 'SmsNeuf123456789abcdefghijKLMNOP';
  r = await appelS(JS);
  vrai(r.res.code === 401 && !base.lignes.has(idxS(JS)), 'J5 jeton SMS changé ⇒ l’ancien refusé, son index retiré');

  // ── J6. Durée constante ────────────────────────────────────────────────
  const src = sansCommentaires(fs.readFileSync(path.join(R, LIB), 'utf8'));
  vrai(/timingSafeEqual\(/.test(src) && lib.memeJeton('abc', 'abc') && !lib.memeJeton('abc', 'abd') && !lib.memeJeton('abc', 'abcd') && !lib.memeJeton('', ''), 'J6 `memeJeton` compare à durée constante (empreintes, `timingSafeEqual`)');
  vrai(lib.idIndexJeton('widget', 'x') === 'jeton_widget_' + sha('x'), 'J6 l’identifiant d’index est `jeton_{genre}_{sha256}`');

  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit planté : ' + (e && e.stack || e)); process.exit(1); });
}
