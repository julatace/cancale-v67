// ════════════════════════════════════════════════════════════════════════════
//  RETRAITS FRAIS (9 nov.) — EXÉCUTÉ. docs/passation/2026-11-09-retraits-frais.md
//  Julien : « Le statut de la disponibilité des colis doit être regardé très
//  souvent ; on ne doit pas avoir un colis s'il a été retiré. » et, sur sa capture,
//  « À retirer · 0 » sous une carte à 18 points et « Peut-être en double · 18 ».
//   A. La règle des moitiés Vinted (api/_lib/achat-arrive-relais.js) :
//      A1 une moitié par témoin (le plus proche), un témoin FINI ⇒ `probable`
//         (jamais « peut-être en double »), un témoin encore montré ⇒ `doute` ;
//      A2 sans `temoinActif` : la règle d'avant (tout témoin ⇒ doute) ;
//      A3 plus de moitiés que de témoins : un témoin montré parmi les siens ⇒
//         doute, tous finis ⇒ probable ; A4 aucune moitié comptée ;
//      A5 l'app branche la règle (`temoinActif`) et la carte n'épingle que
//         `surLaCarte` (le nombre de l'onglet).
//   B. Le rythme (api/_lib/transporteurs.js) : un colis au point relais relu à
//      15 min, en route à 1 h.
//   C. La VRAIE route `api/ship-reminders.js?moment=colis` sur une fausse base
//      PostgREST à état et de faux transporteurs :
//      C1 seuls les vendeurs qui ont une ligne DUE sont visités (au point relais
//         lu il y a 20 min, e-mail « disponible » de 2 h) ; pas celui lu il y a
//         5 min, ni celui dont le colis est fini, ni l'« en route » de 30 min ;
//      C2 le transporteur est interrogé pour le colis dû, et sa réponse
//         « retiré » est rangée (`transp_` fini) ;
//      C3 la réponse ne porte que des nombres (aucun vendeur, aucun n°) ;
//      C4 une sélection qui ne répond pas ⇒ 503, AUCUN vendeur visité ;
//      C5 sans la clé du cron ⇒ 401, rien lu.
//  Données inventées. `--prouve` : chaque mutation rougit.
//  Lancer : node scripts/audit-colis-frequent.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');

const MUTATIONS = {
  'un témoin fini reste un double': [['api/_lib/achat-arrive-relais.js', "out[x.i] = { sorte: temoinActif(w) ? 'doute' : 'probable', temoin: w }; continue; }", "out[x.i] = { sorte: 'doute', temoin: w }; continue; }"]],
  'plus de témoin libre ⇒ encore « peut-être »': [['api/_lib/achat-arrive-relais.js', "out[x.i] = { sorte: 'seul', temoin: null };", "out[x.i] = { sorte: 'doute', temoin: x.ws[0] };"]],
  'un témoin pris deux fois': [['api/_lib/achat-arrive-relais.js', 'const libres = x.ws.filter((w) => !pris.has(w))', 'const libres = x.ws.filter((w) => true)']],
  "l'app ne branche pas la règle": [['src/App.jsx', 'temoins, sansIdentite, temoinActif: (w) => !temoinFini(w) });', 'temoins, sansIdentite });']],
  'la carte épingle les douteux': [['src/relaisColis.js', 'export const surLaCarte = (p) => !!p && !p.inconnu && Number(p.nComptes) > 0;', 'export const surLaCarte = (p) => !!p && !p.inconnu;']],
  'rythme de 30 min': [['api/_lib/transporteurs.js', 'disponible: 15 * 60000, en_route: 60 * 60000', 'disponible: 30 * 60000, en_route: 2 * 3600000']],
  'tous les vendeurs visités': [['api/_lib/colis-frequent.js', '&meta->>essai=lt.${avant(RYTHME_MS.disponible)}&select=owner', '&select=owner']],
  'pas su = rien à faire': [['api/_lib/colis-frequent.js', "if (owners === null) return { fait: false, raison: 'pas-su' };", 'if (owners === null) return { fait: true, dus: 0, traites: 0, restants: 0, echecs: 0, bilans: [] };']],
  'moment colis absent': [['api/ship-reminders.js', "if (moment === 'colis') {", 'if (false) {']],
};
if (process.argv.includes('--prouve')) { prouver(__filename, R, MUTATIONS); return; }

const fs = require('fs');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String((e && e.stack) || e).split('\n').slice(0, 2).join(' ').slice(0, 260)); } };
const importer = (p) => import('file://' + path.join(R, p));

// ── L'environnement des routes ──────────────────────────────────────────────
const A = '11111111-0000-4000-8000-00000000000a', B = '11111111-0000-4000-8000-00000000000b', Cv = '11111111-0000-4000-8000-00000000000c', D = '11111111-0000-4000-8000-00000000000d', E = '11111111-0000-4000-8000-00000000000e';
const NEUTRE = '00000000-0000-0000-0000-000000000000';
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VRM_OWNER_UID = A;
process.env.CRON_SECRET = 'cle-banc-cron';
process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
try { const wp = require(path.join(R, 'node_modules', 'web-push')); wp.setVapidDetails = () => {}; wp.sendNotification = async () => ({ statusCode: 201 }); } catch (_) {}

// ── Une fausse base à état, à la forme de PostgREST (la même qu'audit-statut-transporteurs) ──
const base = new Map();
const pannes = new Set();
const rep = (c, s = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
const chemin = (obj, ch) => { let v = obj; for (const seg of ch.split(/->>|->/)) v = v == null ? undefined : v[seg]; return v; };
const metaDe = (d) => { const m = {}; if (d && typeof d === 'object') for (const [k, v] of Object.entries(d)) { if (v == null || typeof v === 'object') continue; const s = String(v); if (s.length <= 600) m[k] = s; } return m; };
const valeur = (l, k) => {
  if (k === 'id') return l.id; if (k === 'owner') return l.owner;
  if (k.startsWith('meta->>')) return metaDe(l.data)[k.slice(7)];
  if (k.startsWith('data->>') || k.startsWith('data->')) { const v = chemin(l.data, k.replace(/^data(->>|->)/, '')); return v == null ? undefined : (typeof v === 'object' ? JSON.stringify(v) : String(v)); }
  return undefined;
};
const teste = (x, op) => {
  const i = op.indexOf('.'); const o = op.slice(0, i), v = op.slice(i + 1).replace(/^"|"$/g, '');
  if (o === 'eq') return x === v;
  if (o === 'neq') return x !== v;
  if (o === 'lt') return x != null && x < v;
  if (o === 'lte') return x != null && x <= v;
  if (o === 'gt') return x != null && x > v;
  if (o === 'gte') return x != null && x >= v;
  if (o === 'like' || o === 'ilike') { const re = new RegExp('^' + v.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$', o === 'ilike' ? 'i' : ''); return x != null && re.test(x); }
  if (o === 'in') return v.replace(/^\(|\)$/g, '').split(',').map((y) => y.replace(/^"|"$/g, '')).includes(x);
  if (o === 'is') return v === 'null' ? x == null : true;
  if (o === 'not') return !teste(x, v);
  return true;
};
const decoupeOr = (s) => { const out = []; let p = 0, cur = ''; for (const ch of s.replace(/^\(|\)$/g, '')) { if (ch === '(') p++; if (ch === ')') p--; if (ch === ',' && !p) { out.push(cur); cur = ''; } else cur += ch; } if (cur) out.push(cur); return out; };
const filtrer = (u) => {
  const conds = [];
  for (const [k, v] of u.searchParams) {
    if (['select', 'on_conflict', 'limit', 'order', 'offset'].includes(k)) continue;
    if (k === 'or') { const alts = decoupeOr(v).map((e) => { const j = e.indexOf('.'); const kk = e.slice(0, j); const rest = e.slice(j + 1); return [kk, rest]; }); conds.push((l) => alts.some(([kk, op]) => teste(valeur(l, kk), op))); continue; }
    conds.push((l) => teste(valeur(l, k), v));
  }
  return [...base.entries()].map(([cle, d]) => { const i = cle.indexOf('|'); return { owner: cle.slice(0, i), id: cle.slice(i + 1), data: d }; }).filter((l) => conds.every((c) => c(l)));
};
const projeter = (l, sel) => {
  if (!sel || sel === '*') return { owner: l.owner, id: l.id, data: l.data };
  const o = {};
  for (const part of sel.split(',')) {
    const [alias, ch] = part.includes(':') ? part.split(/:(.+)/) : [part.split(/->>|->/).pop(), part];
    if (ch === 'id' || ch === 'owner') { o[alias] = l[ch]; continue; }
    if (ch === 'data') { o[alias] = l.data; continue; }
    if (ch.startsWith('meta->>')) { const v = metaDe(l.data)[ch.slice(7)]; o[alias] = v == null ? null : v; continue; }
    const v = chemin(l.data, ch.replace(/^data(->>|->)/, ''));
    o[alias] = v === undefined ? null : (/->>[^>]*$/.test(ch) && v != null && typeof v !== 'object' ? String(v) : v);
  }
  return o;
};
const appels = [];            // ce qui part chez un transporteur
const lectures = [];          // chaque lecture de NOTRE base : { owner, chemin }
const HOTES_TRANSP = /(^|\.)(chronopost\.fr|vintedgo\.com|mondialrelay\.(?:fr|be))$/;
let reponseTransporteur = () => null;
global.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  const h = opts.headers || {};
  if (HOTES_TRANSP.test(u.hostname)) { appels.push({ host: u.hostname, url: String(url) }); const r = reponseTransporteur(u); if (!r) throw new TypeError('fetch failed'); return new Response(r.body, { status: r.status, headers: { 'content-type': r.ctype || 'application/json' } }); }
  if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
  if (u.pathname === '/rest/v1/vinted_accounts') return rep([]);
  if (u.pathname !== '/rest/v1/app_data') return rep([]);
  const brut = decodeURIComponent(u.pathname + u.search);
  if (m === 'POST') {
    const prefer = String(h.Prefer || h.prefer || '');
    const faits = [];
    for (const r of JSON.parse(opts.body || '[]')) { const cle = `${r.owner || A}|${r.id}`; if (/ignore-duplicates/.test(prefer) && base.has(cle)) continue; base.set(cle, r.data); faits.push({ id: r.id }); }
    return /return=representation/.test(prefer) ? rep(faits, 201) : new Response('', { status: 201 });
  }
  if (m === 'PATCH') { const corps = JSON.parse(opts.body || '{}'); const t = filtrer(u); for (const l of t) base.set(`${l.owner}|${l.id}`, corps.data); return rep(t.map((l) => ({ id: l.id }))); }
  if (m === 'DELETE') { for (const l of filtrer(u)) base.delete(`${l.owner}|${l.id}`); return new Response('', { status: 204 }); }
  lectures.push({ owner: u.searchParams.get('owner') ? u.searchParams.get('owner').replace(/^eq\./, '') : null, chemin: brut });
  for (const p of pannes) if (brut.includes(p)) return new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } });
  const sel = u.searchParams.get('select') || '';
  if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);   // base cloisonnée
  return rep(filtrer(u).map((l) => projeter(l, sel)));
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.send = () => r; r.end = () => r; return r; };
const NOW = Date.now(), MIN = 60000, H = 3600000;
const iso = (ms) => new Date(ms).toISOString();
const vgJson = (evs) => JSON.stringify({ tracking_events: evs.map((e, i) => ({ id: 'ev' + i, message: e.message || e.group, timestamp: iso(e.ms), metadata: { address: e.address || '' }, banner_message: null, group_header: null, group: e.group, state: e.state || 'delivery' })), meta: {} });
const email = (owner, carrier, suivi, o = {}) => base.set(`${owner}|email_track_${carrier}_${suivi}`, { type: 'suivi', carrier, suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`, code: '900001', lieu: 'TABAC TEST, 1 RUE EXEMPLE, 99999 TESTVILLE', emailAt: iso(NOW - 2 * 86400000), receivedAt: iso(NOW - 2 * 86400000), arriveLe: iso(NOW - 2 * 86400000), ...o });
const transp = (owner, carrier, suivi, o = {}) => base.set(`${owner}|transp_${carrier}_${suivi}`, { v: 1, rev: 1, carrier, suivi, etat: 'disponible', detail: null, etatAt: iso(NOW - 2 * 86400000), libelle: 'Prêt', lu: iso(NOW - 20 * MIN), source: 'serveur', essai: iso(NOW - 20 * MIN), essaiRes: 'ok', essais: 0, voie: carrier === 'vinted' ? 'vg-v3' : 'cp-ws2', fini: false, evenements: [], ...o });

(async () => {
  // ── A. la règle des moitiés Vinted ─────────────────────────────────────────
  await essaie('A la règle des moitiés Vinted', async () => {
    const M = await importer('api/_lib/achat-arrive-relais.js');
    const LIEU = 'TABAC TEST, 1 RUE EXEMPLE, 99999 TESTVILLE';
    const T0 = Date.parse('2026-11-05T09:00:00Z');
    const moitie = (n, dt) => ({ id: 'email_track_autre_conv-' + n, source: 'vinted-commande', status: 'available', lieu: LIEU, arriveLe: iso(T0 + dt) });
    const temoin = (n, dt, fini) => ({ id: 'email_track_mondialrelay_8200000' + n, carrier: 'mondialrelay', suivi: '8200000' + n, status: 'available', lieu: LIEU, arriveLe: iso(T0 + dt), _fini: fini });
    const h = [moitie(1, 0), moitie(2, 2 * H), moitie(3, 4 * H)];
    const w = [temoin(1, 60000, true), temoin(2, 2 * H + 60000, false), temoin(3, 4 * H + 60000, true)];
    const actif = (x) => !x._fini;
    const r = M.regrouperArrivees(h, { commandeDe: () => null, temoins: w, temoinActif: actif });
    const pr = (r.probables || []).map((p) => p.t.id).sort(), dt = r.doutes.map((t) => t.id).sort();
    dit(JSON.stringify(dt) === JSON.stringify([h[1].id]) && JSON.stringify(pr) === JSON.stringify([h[0].id, h[2].id]).replace(/"/g, '"') && r.liste.length === 0,
      'A1 chaque moitié a SON témoin : témoin retiré ⇒ « sans doute fini » (probable), témoin encore à retirer ⇒ « peut-être en double »', JSON.stringify({ doutes: dt, probables: pr }));
    const p1 = (r.probables || []).find((p) => p.t.id === h[0].id);
    dit(!!p1 && p1.temoin === w[0], 'A1 la moitié porte le témoin le plus proche dans le temps (pour dire son n° et sa fin)');
    // Deux moitiés à 5 min d'écart, un témoin fini tout près, un témoin encore à retirer 2 h après :
    // le témoin fini ne sert qu'UNE fois — la seconde moitié reste « peut-être en double ».
    const r1b = M.regrouperArrivees([moitie(10, 0), moitie(11, 5 * MIN)], { commandeDe: () => null, temoins: [temoin(10, 60000, true), temoin(11, 2 * H, false)], temoinActif: actif });
    dit(r1b.doutes.length === 1 && (r1b.probables || []).length === 1, 'A1 un témoin ne sert qu’UNE moitié (deux moitiés ne sont pas le même carton)', JSON.stringify({ d: r1b.doutes.length, p: (r1b.probables || []).length }));
    dit(r1b.doutesTemoins && r1b.doutesTemoins[0] && r1b.doutesTemoins[0].suivi === '820000011', 'A1 la moitié « comptée avec » porte SON témoin (pour dire « Compté avec le n°… »)');
    const r2 = M.regrouperArrivees(h, { commandeDe: () => null, temoins: w });
    dit(r2.doutes.length === 3 && !(r2.probables || []).length, 'A2 sans `temoinActif` : la règle d’avant (3 doutes)');
    const r3 = M.regrouperArrivees([moitie(4, 0), moitie(5, 30 * MIN)], { commandeDe: () => null, temoins: [temoin(4, 60000, false)], temoinActif: actif });
    dit(r3.doutes.length === 1 && r3.liste.length === 1 && !(r3.probables || []).length, 'A3 deux moitiés, un témoin encore montré ⇒ une « comptée avec » lui, l’autre À RETIRER (un témoin = un carton ; jamais « peut-être »)', JSON.stringify({ d: r3.doutes.length, l: r3.liste.length }));
    const r4 = M.regrouperArrivees([moitie(6, 0), moitie(7, 30 * MIN)], { commandeDe: () => null, temoins: [temoin(6, 60000, true)], temoinActif: actif });
    dit(r4.doutes.length === 0 && (r4.probables || []).length === 1 && r4.liste.length === 1, 'A3 deux moitiés, un témoin fini ⇒ une finie avec lui, l’autre À RETIRER', JSON.stringify({ p: (r4.probables || []).length, l: r4.liste.length }));
    const r5 = M.regrouperArrivees([moitie(8, 0)], { commandeDe: () => null, temoins: [temoin(8, 9 * 86400000, true)], temoinActif: actif });
    dit(r5.liste.length === 1 && !r5.doutes.length && !(r5.probables || []).length, 'A4 un témoin hors des 3 jours ne touche pas la moitié (elle reste à retirer)');
    const app = sansCommentaires(fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8'));
    dit(/regrouperArrivees\(emailList, \{[^}]*temoinActif: \(w\) => !temoinFini\(w\) \}\)/.test(app) && /noterProbable\(p\.t, p\.commande, p\.temoin\)/.test(app), 'A5 l’app branche la règle (`temoinActif`) et DIT chaque moitié finie (sortis)');
    const RC = await importer('src/relaisColis.js');
    dit(typeof RC.surLaCarte === 'function' && RC.surLaCarte({ cle: 'p', nComptes: 1 }) && !RC.surLaCarte({ cle: 'p', nComptes: 0, arrives: [{ horsCompte: true }] }) && !RC.surLaCarte({ cle: 'p', nComptes: 0, nAttendus: 3 }),
      'A5 la carte n’épingle qu’un point où un colis COMPTÉ attend (ni « à vérifier », ni « en double », ni « en route »)');
    const carte = sansCommentaires(fs.readFileSync(path.join(R, 'src', 'CarteRelais.jsx'), 'utf8'));
    dit((carte.match(/connus\.filter\(surLaCarte\)/g) || []).length >= 2, 'A5 les deux colonnes « À retirer » passent par `surLaCarte`');
  });

  // ── B. le rythme ────────────────────────────────────────────────────────────
  await essaie('B le rythme', async () => {
    const T = await importer('api/_lib/transporteurs.js');
    const due = (etat, ilYa) => T.prochainEssai({ etat, essai: iso(NOW - ilYa), essaiRes: 'ok' }) <= NOW;
    dit(due('disponible', 15 * MIN + 1000) && !due('disponible', 10 * MIN), 'B un colis au point relais est relu au bout de 15 min (pas avant)');
    dit(due('en_route', 61 * MIN) && !due('en_route', 40 * MIN), 'B un colis en route est relu au bout d’une heure');
  });

  // ── C. la vraie route ───────────────────────────────────────────────────────
  await essaie('C la route ?moment=colis', async () => {
    // A : Vinted Go au point relais, lu il y a 20 min ⇒ dû ; le transporteur dira « retiré ».
    email(A, 'vinted', '1234567890123456'); transp(A, 'vinted', '1234567890123456');
    // B : lu il y a 5 min ⇒ pas dû.
    email(B, 'vinted', '2234567890123456'); transp(B, 'vinted', '2234567890123456', { essai: iso(NOW - 5 * MIN), lu: iso(NOW - 5 * MIN) });
    // C : e-mail « disponible » arrivé il y a 2 h, jamais lu ⇒ sa première lecture.
    email(Cv, 'chronopost', 'XW000000003TS', { emailAt: iso(NOW - 2 * H), receivedAt: iso(NOW - 2 * H), arriveLe: iso(NOW - 2 * H) });
    // D : fini (retiré) ⇒ jamais visité.
    email(D, 'vinted', '4234567890123456', { status: 'delivered' }); transp(D, 'vinted', '4234567890123456', { etat: 'retire', fini: true, essai: iso(NOW - 3 * H) });
    // E : en route lu il y a 30 min ⇒ pas dû (1 h).
    transp(E, 'vinted', '5234567890123456', { etat: 'en_route', essai: iso(NOW - 30 * MIN) });
    reponseTransporteur = (u) => (u.hostname === 'carrier.vintedgo.com' && /1234567890123456/.test(u.href)
      ? { status: 200, ctype: 'application/json', body: vgJson([{ group: 'delivered', ms: NOW - 40 * MIN }, { group: 'ready_for_pickup', ms: NOW - 2 * 86400000, message: 'Ton colis t’attend (Consigne TEST)' }]) }
      : null);
    const route = (await importer('api/ship-reminders.js')).default;
    const sansCle = faireRes(); const n0 = lectures.length;
    await route({ method: 'GET', query: { moment: 'colis' }, headers: {} }, sansCle);
    dit(sansCle.code === 401 && lectures.length === n0, 'C5 sans la clé du cron ⇒ 401, rien lu', String(sansCle.code));
    const res = faireRes(); const l0 = lectures.length;
    await route({ method: 'GET', query: { moment: 'colis' }, headers: { authorization: 'Bearer cle-banc-cron' } }, res);
    const vus = new Set(lectures.slice(l0).map((x) => x.owner).filter(Boolean));
    dit(res.code === 200 && res.corps && res.corps.ok === true && res.corps.moment === 'colis', 'C la route répond 200 « colis »', JSON.stringify(res.corps).slice(0, 200));
    dit(vus.has(A) && vus.has(Cv) && !vus.has(B) && !vus.has(D) && !vus.has(E), 'C1 seuls les vendeurs qui ont un colis DÛ sont visités (A au point relais lu il y a 20 min, C arrivé il y a 2 h ; ni B lu il y a 5 min, ni D fini, ni E en route depuis 30 min)', JSON.stringify([...vus].map((o) => o.slice(-1))));
    dit(res.corps && res.corps.dus === 2 && res.corps.traites === 2, 'C1 la réponse compte 2 vendeurs dus, 2 traités', JSON.stringify({ dus: res.corps && res.corps.dus, traites: res.corps && res.corps.traites }));
    const vg = appels.filter((x) => /vintedgo/.test(x.host));
    dit(vg.length === 1 && /1234567890123456/.test(vg[0].url) && !appels.some((x) => /2234567890123456|4234567890123456|5234567890123456/.test(x.url)), 'C2 le transporteur est interrogé pour le colis dû — et pour lui seul chez Vinted Go', JSON.stringify(appels.map((x) => x.host)));
    const apres = base.get(`${A}|transp_vinted_1234567890123456`) || {};
    dit(apres.etat === 'retire' && apres.fini === true, 'C2 « retiré » lu chez Vinted Go est rangé (`transp_` fini) : le colis sort de « à retirer » partout', JSON.stringify({ etat: apres.etat, fini: apres.fini }));
    const txt = JSON.stringify(res.corps || {});
    dit(![A, B, Cv, D, E].some((o) => txt.includes(o)) && !/1234567890123456|XW000000003TS/.test(txt), 'C3 la réponse ne porte que des nombres (aucun vendeur, aucun n° de suivi)');
    // C4 : la sélection ne répond pas.
    pannes.add('meta->>etat=eq.disponible');
    const res2 = faireRes(); const l1 = lectures.length; const a1 = appels.length;
    await route({ method: 'GET', query: { moment: 'colis' }, headers: { authorization: 'Bearer cle-banc-cron' } }, res2);
    const vus2 = lectures.slice(l1).map((x) => x.owner).filter((o) => o && o !== NEUTRE);
    dit(res2.code === 503 && vus2.length === 0 && appels.length === a1, 'C4 une sélection qui ne répond pas ⇒ 503 et AUCUN vendeur visité (jamais « rien à faire »)', `${res2.code} · ${vus2.length} lecture(s) de vendeur`);
    pannes.clear();
  });

  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit planté : ' + ((e && e.stack) || e)); process.exit(1); });
