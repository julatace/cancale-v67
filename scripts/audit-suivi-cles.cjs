#!/usr/bin/env node
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
// AUDIT (13 nov., lot 89) — COLISSIMO / LA POSTE ET UPS LUS PAR LE SERVEUR DÈS QUE LA CLÉ EST POSÉE.
// Julien (points 8 et 9) : « on ne fait pas avec l'extension » pour lire les sites des transporteurs.
// Ce que ce contrôle EXÉCUTE (jamais une relecture du code) :
//   · les analyseurs purs `lireReponseLaPoste` (API « Suivi v2 ») et `lireReponseUps` (API
//     « Tracking » v1) sur des réponses INVENTÉES à la forme de leur documentation officielle
//     (champs, ordre du plus récent au plus ancien, codes d'évènement, erreurs) ;
//   · la reconnaissance par la FORME du n° (Colissimo « 6A + 11 chiffres », UPS « 1Z… », DPD et GLS
//     seulement nommés), sans jamais voler un n° Vinted Go mesuré ;
//   · la porte de la clé : SANS clé, AUCUNE requête, aucune ligne `transp_`, l'app dit « suivi lu par
//     e-mail seulement » ; AVEC la clé, le VRAI passage (api/_lib/transporteurs-lecture.js) lit La
//     Poste avec `X-Okapi-Key`, UPS avec un jeton OAuth (demandé une fois, gardé, redemandé une fois
//     sur 401), range `transp_colissimo_…` / `transp_ups_…`, et la réponse dit `lecture` à l'app ;
//   · jamais l'extension : ni en C3 (`aLireParNavigateur`), ni en C4 (`appliquerReponseBrute`).
// Données inventées : 6A12345678901, 1Z999AA10123456784, « BUREAU DE POSTE TEST », 99999 Testville.
// `--prouve` : réaffaiblit la règle ; chaque mutation doit rendre ROUGE.
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

const MUTATIONS = {
  'sans-cle-lisible': ['api/_lib/transporteurs.js', "  if (CARRIERS_CLE.includes(k) && !lectureServeurActive(k)) return null;\n", ''],
  'extension-recoit-colissimo': ['api/_lib/transporteurs.js', "    if (!CARRIERS_LUS.includes(it.carrier)) continue;\n", ''],
  'vg-vole-colissimo': ['api/_lib/transporteurs.js', "  if (k === 'vinted' && FORME_COLISSIMO_PROPRE.test(n)) return null;\n", ''],
  'lp-ordre-page': ['api/_lib/transporteurs.js', '  evs.sort((a, b) => (a.ms - b.ms) || (b.i - a.i));\n', ''],
  'lp-echo-ignore': ['api/_lib/transporteurs.js', "  if (!id || id !== n) return rendu('forme', { forme: `idShip:", "  if (!id) return rendu('forme', { forme: `idShip:"],
  'lp-livre-pris-pour-retire': ['api/_lib/transporteurs.js', "etat: auPoint ? 'retire' : 'livre'", "etat: 'retire'"],
  'lp-ag1-oublie': ['api/_lib/transporteurs.js', "  if (dernier.code === 'AG1') return rendu('ok', { ...base, ...lieu, etat: 'disponible' });\n", ''],
  'lp-401-en-rafale': ['api/_lib/transporteurs.js', "  if (s === 401) return rendu('bloque');\n  const r0 = refus(statut, ctype, corps);\n  if (r0) return rendu(r0);\n  const j = jsonDe(corps);\n  const rc", "  const r0 = refus(statut, ctype, corps);\n  if (r0) return rendu(r0);\n  const j = jsonDe(corps);\n  const rc"],
  'lp-retour-ignore': ['api/_lib/transporteurs.js', "  const iRe = evs.findIndex((e) => e.code === 'RE1' || e.code === 'DI2');", '  const iRe = -1;'],
  'ups-dispo-ignore': ['api/_lib/transporteurs.js', "  const estDispo = (a) => a.code === 'ZP' || a.code === '5E' || (UPS_AP.test(a.t) && UPS_ATTENTE.test(a.t));", '  const estDispo = (a) => false;'],
  'ups-limite-ignoree': ['api/_lib/transporteurs.js', 'limite: lim, limiteSure: !!lim, limiteAt: null', 'limite: null, limiteSure: false, limiteAt: null'],
  'ups-echo-ignore': ['api/_lib/transporteurs.js', "  if (!pk) return rendu('forme', { forme: 'trackingNumber:autre' });\n", ''],
  'ups-jeton-jamais-garde': ['api/_lib/transporteurs-lecture.js', '  if (!neuf && _jetonUps && _jetonUps.jusqua - 60000 > maintenant) return _jetonUps.jeton;\n', ''],
  'ups-401-sans-nouveau-jeton': ['api/_lib/transporteurs-lecture.js', "      if (carrier === 'ups' && r.status === 401) {", '      if (false) {'],
  'cle-absente-appelee': ['api/_lib/transporteurs-lecture.js', "      if (cle === null) return { echec: 'cle' };\n", ''],
  'app-ignore-transp-colissimo': ['api/_lib/transporteurs.js', '/^transp_(mondialrelay|chronopost|vinted|colissimo|ups)_([A-Z0-9]+)$/', '/^transp_(mondialrelay|chronopost|vinted)_([A-Z0-9]+)$/'],
  'lecture-pas-dite': ['api/_lib/transporteurs-lecture.js', 'lecture: T.lecturesCle(), ', ''],
  'texte-erreur': ['src/retraitSuivi.js', '`${nl} : suivi lu par e-mail seulement`', '`${nl} : VRM ne lit pas ce transporteur`'],
};
const ARG_PROUVE = process.argv.find((x) => x.startsWith('--prouve'));
if (ARG_PROUVE) {
  let ok = 0;
  const seules = ARG_PROUVE.includes('=') ? ARG_PROUVE.split('=')[1].split(',') : null;
  const choisies = Object.entries(MUTATIONS).filter(([nom]) => !seules || seules.includes(nom));
  for (const [nom, [f, de, vers]] of choisies) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-cles-'));
    for (const x of ['api', 'src', 'package.json']) fs.cpSync(path.join(R, x), path.join(t, x), { recursive: true });
    fs.symlinkSync(fs.realpathSync(path.join(R, 'node_modules')), path.join(t, 'node_modules'));
    const src = fs.readFileSync(path.join(t, f), 'utf8');
    if (src.split(de).length !== 2) { console.log(`❌ mutation ${nom} : ancre ${src.includes(de) ? 'pas unique' : 'introuvable'} dans ${f}`); fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(path.join(t, f), src.replace(de, vers));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8', timeout: 240000 });
    const rouges = (String(r.stdout || '').match(/^❌.*$/gm) || []);
    const tombe = r.status !== 0 && rouges.length > 0;
    if (tombe) ok++;
    console.log(`${tombe ? '✅' : '❌'} mutation « ${nom} » ⇒ ${tombe ? rouges.length + ' rouge(s) — ' + rouges[0].slice(2, 110) : 'VERTE (le contrôle ne la voit pas)'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  const n = choisies.length;
  console.log(ok === n ? `\n✅ ${ok}/${n} mutations attrapées` : `\n❌ ${n - ok} mutation(s) non attrapée(s)`);
  process.exit(ok === n ? 0 : 1);
}

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String((e && e.stack) || e).split('\n').slice(0, 2).join(' ').slice(0, 260)); } };
const importer = (p) => import('file://' + path.join(R, p));
const J = (x) => JSON.stringify(x);

// ── L'environnement des routes (aucune clé réelle : des valeurs de banc) ─────
const A = '11111111-2222-3333-4444-555555555555';
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VRM_OWNER_UID = A;
process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
const CLES = ['LAPOSTE_OKAPI_KEY', 'UPS_CLIENT_ID', 'UPS_CLIENT_SECRET'];
for (const k of CLES) delete process.env[k];
const CLE_LP = 'cle-okapi-de-banc-0000', UPS_ID = 'ups-id-de-banc-0000', UPS_SECRET = 'ups-secret-de-banc-0000';
try { const webpush = require(path.join(R, 'node_modules', 'web-push')); webpush.setVapidDetails = () => {}; webpush.sendNotification = async () => ({ statusCode: 201 }); } catch (_) {}

// ── Une fausse base à état, à la forme de PostgREST (la même que audit-statut-transporteurs) ──
const base = new Map();
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
  const i = op.indexOf('.'); const o = op.slice(0, i), v = op.slice(i + 1);
  if (o === 'eq') return x === v;
  if (o === 'neq') return x !== v;
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
    if (k === 'or') { const alts = decoupeOr(v).map((e) => { const j = e.indexOf('.'); return [e.slice(0, j), e.slice(j + 1)]; }); conds.push((l) => alts.some(([kk, op]) => teste(valeur(l, kk), op))); continue; }
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

// ── De faux transporteurs : on compte TOUT ce qui leur est envoyé ───────────
const appels = [];
let transporteur = () => null;   // (URL, opts) ⇒ { status, ctype, body, headers } | null (réseau coupé)
const HOTES = /(^|\.)(laposte\.fr|ups\.com|chronopost\.fr|vintedgo\.com|mondialrelay\.(?:fr|be)|dpd\.(?:de|fr|com)|gls-group\.(?:eu|com))$/;
const entete = (h, k) => { for (const [x, v] of Object.entries(h || {})) if (x.toLowerCase() === k.toLowerCase()) return String(v); return ''; };
global.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  const h = opts.headers || {};
  if (HOTES.test(u.hostname)) {
    appels.push({ host: u.hostname, path: u.pathname, url: String(url), methode: m, ua: entete(h, 'User-Agent'), okapi: entete(h, 'X-Okapi-Key'), auth: entete(h, 'Authorization'), transId: entete(h, 'transId'), src: entete(h, 'transactionSrc'), corps: typeof opts.body === 'string' ? opts.body : '', redirect: opts.redirect });
    const r = transporteur(u, { methode: m, h });
    if (!r) throw new TypeError('fetch failed');
    return new Response(r.body, { status: r.status, headers: { 'content-type': r.ctype || 'application/json', ...(r.headers || {}) } });
  }
  if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
  if (u.pathname !== '/rest/v1/app_data') return rep([]);
  if (m === 'POST') {
    const prefer = entete(h, 'Prefer');
    const faits = [];
    for (const r of JSON.parse(opts.body || '[]')) { const cle = `${r.owner || A}|${r.id}`; if (/ignore-duplicates/.test(prefer) && base.has(cle)) continue; base.set(cle, r.data); faits.push({ id: r.id }); }
    return /return=representation/.test(prefer) ? rep(faits, 201) : new Response('', { status: 201 });
  }
  if (m === 'PATCH') { const corps = JSON.parse(opts.body || '{}'); const t = filtrer(u); for (const l of t) base.set(`${l.owner}|${l.id}`, corps.data); return rep(t.map((l) => ({ id: l.id }))); }
  if (m === 'DELETE') { for (const l of filtrer(u)) base.delete(`${l.owner}|${l.id}`); return new Response('', { status: 204 }); }
  const sel = u.searchParams.get('select') || '';
  if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);
  return rep(filtrer(u).map((l) => projeter(l, sel)));
};

// ── Des réponses INVENTÉES, à la forme de la documentation officielle ───────
const H = 3600000;
const iso = (ms) => new Date(ms).toISOString();
const seconde = (v) => Math.floor(Date.parse(String(v || '')) / 1000);   // les API écrivent l'heure à la seconde
const isoOff = (ms) => { const d = new Date(ms + 3600000); return d.toISOString().replace(/\.\d{3}Z$/, '+01:00'); };   // « 2026-11-12T10:52:00+01:00 » (La Poste)
// La Poste Suivi v2 : `event` du plus RÉCENT au plus ancien.
const lpJson = (idShip, evs, { pointNom = '' } = {}) => JSON.stringify({ lang: 'fr_FR', scope: 'open', returnCode: 200, shipment: {
  idShip, holder: 4, product: 'colissimo', isFinal: evs.some((e) => e.code === 'DI1' || e.code === 'DI2'), entryDate: isoOff(evs[evs.length - 1].ms), url: `https://www.laposte.fr/outils/suivre-vos-envois?code=${idShip}`,
  timeline: [{ id: 1, shortLabel: 'Pris en charge', longLabel: '', date: isoOff(evs[evs.length - 1].ms), country: '', status: true, type: 1 }],
  event: [...evs].sort((a, b) => b.ms - a.ms).map((e, i) => ({ code: e.code, label: e.label, date: isoOff(e.ms), order: i })),
  contextData: { deliveryChoice: { deliveryChoice: 0 }, originCountry: 'FR', arrivalCountry: 'FR', ...(pointNom ? { removalPoint: { name: pointNom, type: 'BDP' } } : {}) },
} });
const LP_404 = JSON.stringify({ lang: 'fr_FR', scope: 'open', returnCode: 404, returnMessage: 'Votre numéro de suivi n’a pas été trouvé.', idShip: '6A12345678901' });
// UPS Tracking v1 : `activity` du plus RÉCENT au plus ancien ; dates AAAAMMJJ, heures HHMMSS.
const ymd = (ms) => iso(ms).slice(0, 10).replace(/-/g, '');
const hms = (ms) => iso(ms).slice(11, 19).replace(/:/g, '');
const upsJson = (n, acts, { pickupBy = '', loc = '' } = {}) => JSON.stringify({ trackResponse: { shipment: [{ inquiryNumber: n, package: [{
  trackingNumber: n, deliveryDate: [{ type: 'SDD', date: ymd(acts[0].ms) }],
  ...(pickupBy ? { accessPointInformation: { pickupByDate: pickupBy } } : {}),
  ...(loc ? { deliveryInformation: { location: loc, receivedBy: '' } } : {}),
  currentStatus: { type: acts[0].type, description: acts[0].desc, code: acts[0].code || '', statusCode: '000', simplifiedTextDescription: acts[0].desc },
  activity: [...acts].sort((a, b) => b.ms - a.ms).map((a) => ({ location: { address: { city: 'TESTVILLE', stateProvince: '', postalCode: '99999', country: 'FR', countryCode: 'FR' }, slic: '0000' },
    status: { type: a.type, description: a.desc, code: a.code || 'XX', statusCode: '000', simplifiedTextDescription: a.simple || a.desc }, date: ymd(a.ms), time: hms(a.ms), gmtDate: ymd(a.ms), gmtTime: iso(a.ms).slice(11, 19), gmtOffset: '+00:00' })),
}] }] } });
const UPS_404 = JSON.stringify({ response: { errors: [{ code: '151018', message: 'Invalid tracking number' }] } });
const UPS_JETON = (j) => JSON.stringify({ token_type: 'Bearer', issued_at: String(Date.now()), client_id: UPS_ID, access_token: j, scope: '', expires_in: '14399', refresh_count: '0', status: 'approved' });

(async () => {
  let T = null, L = null, RS = null, O = null;
  await essaie('les modules', async () => {
    T = await importer('api/_lib/transporteurs.js');
    L = await importer('api/_lib/transporteurs-lecture.js');
    RS = await importer('src/retraitSuivi.js');
    O = await importer('api/_lib/owner.js');
    dit(typeof T.lireReponseLaPoste === 'function' && typeof T.lireReponseUps === 'function' && typeof L.passageTransporteurs === 'function', 'les analyseurs La Poste et UPS existent (api/_lib/transporteurs.js)');
  });
  if (!T || !L || !RS || !O) { console.log(`\n❌ audit-suivi-cles : ${ko} rouge(s)`); process.exit(1); }
  const NOW = Date.now();
  const N_LP = '6A12345678901', N_UPS = '1Z999AA10123456784', N_UPS2 = '1Z999AA10123456791';

  // ══ 1. LA POSTE « Suivi v2 » — l'analyseur ═════════════════════════════════
  await essaie('La Poste : la réponse', async () => {
    const t0 = NOW - 4 * 24 * H;
    const lp = (evs, o, n = N_LP) => T.lireReponseLaPoste(200, 'application/json', lpJson(n, evs, o), { suivi: N_LP });
    const ev = (code, h, label) => ({ code, ms: t0 + h * H, label });
    const r1 = lp([ev('PC1', 0, 'Votre colis est pris en charge par La Poste'), ev('ET1', 10, 'Votre colis est en cours d’acheminement'), ev('AG1', 30, 'Votre colis est disponible dans votre point de retrait')], { pointNom: 'BUREAU DE POSTE TEST' });
    dit(r1.res === 'ok' && r1.etat === 'disponible' && r1.lieuNom === 'BUREAU DE POSTE TEST' && r1.limite === null, 'A1 AG1 en dernier ⇒ disponible, au point nommé par La Poste, sans date limite inventée', J({ etat: r1.etat, lieu: r1.lieuNom, limite: r1.limite }));
    const r2 = lp([ev('PC1', 0, 'Pris en charge'), ev('AG1', 30, 'Disponible au point'), ev('DI1', 50, 'Votre colis a été remis au destinataire')], { pointNom: 'BUREAU DE POSTE TEST' });
    dit(r2.etat === 'retire' && seconde(r2.etatAt) === seconde(iso(t0 + 50 * H)), 'A2 DI1 après AG1 ⇒ retiré (daté de DI1)', J({ etat: r2.etat, at: r2.etatAt }));
    const r3 = lp([ev('PC1', 0, 'Pris en charge'), ev('MD2', 20, 'Mis en distribution'), ev('DI1', 22, 'Votre colis est livré')]);
    dit(r3.etat === 'livre', 'A3 DI1 sans point ni attente ⇒ livré (boîte aux lettres), jamais « retiré »', r3.etat);
    const r4 = lp([ev('PC1', 0, 'Pris en charge'), ev('AG1', 30, 'Disponible'), ev('RE1', 300, 'Votre colis est retourné à l’expéditeur'), ev('ET1', 310, 'En cours d’acheminement')]);
    dit(r4.etat === 'retour_expediteur' && r4.detail === null && seconde(r4.etatAt) === seconde(iso(t0 + 300 * H)), 'A4 RE1 n’importe où ⇒ reparti chez l’expéditeur, daté du retour', J({ etat: r4.etat, d: r4.detail, at: r4.etatAt }));
    const r5 = lp([ev('PC1', 0, 'x'), ev('RE1', 300, 'Retour'), ev('DI2', 320, 'Distribué à l’expéditeur')]);
    dit(r5.etat === 'retour_expediteur' && r5.detail === 'rendu', 'A5 DI2 ⇒ rendu à l’expéditeur', J({ etat: r5.etat, d: r5.detail }));
    const r6 = lp([ev('DR1', 0, 'Votre colis est prêt à être expédié, il va être remis à La Poste')]);
    dit(r6.etat === 'en_route' && r6.detail === 'prepare', 'A6 DR1 seul ⇒ étiquette créée (en préparation)', J({ etat: r6.etat, d: r6.detail }));
    const r7 = lp([ev('PC1', 0, 'Pris en charge'), ev('ZZ9', 5, 'Un évènement jamais vu')]);
    dit(r7.etat === 'inconnu' && /jamais vu/.test(r7.libelle), 'A7 un code inconnu en dernier ⇒ « inconnu », le libellé recopié (pas su ≠ oui)', J({ etat: r7.etat, l: r7.libelle }));
    const r8 = lp([ev('AG1', 30, 'Disponible'), ev('ET1', 40, 'En cours d’acheminement')]);
    dit(r8.etat === 'incident' && r8.detail === 'quitte_relais', 'A8 un acheminement APRÈS l’attente au point ⇒ « a quitté le point »', J({ etat: r8.etat, d: r8.detail }));
    const r9 = lp([ev('PC1', 0, 'Pris en charge'), ev('ND1', 5, 'Non distribuable')]);
    dit(r9.etat === 'incident', 'A9 ND1 ⇒ incident', r9.etat);
    // L'ordre : la page donne le plus récent d'abord — c'est la DATE qui tranche, pas la position.
    const corpsDesordre = JSON.parse(lpJson(N_LP, [ev('PC1', 0, 'Pris en charge'), ev('AG1', 30, 'Disponible')]));
    corpsDesordre.shipment.event.reverse();
    const r10 = T.lireReponseLaPoste(200, 'application/json', JSON.stringify(corpsDesordre), { suivi: N_LP });
    dit(r10.etat === 'disponible', 'A10 la DATE tranche (évènements donnés dans un autre ordre)', r10.etat);
    dit(lp([ev('AG1', 30, 'x')], {}, '6A99999999999').res === 'forme', 'A11 l’ÉCHO : une réponse pour un autre n° ⇒ « forme », jamais rangée');
    dit(T.lireReponseLaPoste(404, 'application/json', LP_404, { suivi: N_LP }).res === 'introuvable' && T.lireReponseLaPoste(400, 'application/json', LP_404.replace('404', '400'), { suivi: N_LP }).res === 'introuvable', 'A12 404 / 400 ⇒ introuvable (3 fois ⇒ VRM arrête)');
    dit(T.lireReponseLaPoste(401, 'application/json', '{"code":"UNAUTHORIZED","message":"Invalid api key"}', { suivi: N_LP }).res === 'bloque' && T.lireReponseLaPoste(429, 'application/json', '{}', { suivi: N_LP }).res === 'bloque', 'A13 401 (clé refusée) et 429 ⇒ refus (la pause), jamais une rafale');
    dit(T.lireReponseLaPoste(200, 'text/html', '<!DOCTYPE html><html>maintenance</html>', { suivi: N_LP }).res === 'bloque' && T.lireReponseLaPoste(503, 'application/json', '{}', { suivi: N_LP }).res === 'passu', 'A14 HTML ⇒ refus ; 503 ⇒ pas su (rien ne change)');
    dit(T.lireReponseLaPoste(200, 'application/json', '{"shipment":{"idShip":"6A12345678901"}}', { suivi: N_LP }).res === 'forme', 'A15 forme inattendue ⇒ « forme » (la forme est gardée pour l’apprendre)');
  });

  // ══ 2. UPS « Tracking » v1 — l'analyseur ═══════════════════════════════════
  await essaie('UPS : la réponse', async () => {
    const t0 = NOW - 4 * 24 * H;
    const up = (acts, o, n = N_UPS) => T.lireReponseUps(200, 'application/json', upsJson(n, acts, o), { suivi: N_UPS });
    const a = (type, h, desc, code = '') => ({ type, ms: t0 + h * H, desc, code });
    const u1 = up([a('M', 0, 'Shipper created a label, UPS has not received the package yet.', 'MP'), a('I', 10, 'Départ des installations', 'DP'), a('I', 40, 'Livré au point d’accès UPS™. En attente de retrait par le client.', 'ZZ')], { pickupBy: ymd(t0 + 8 * 24 * H) });
    dit(u1.res === 'ok' && u1.etat === 'disponible' && u1.limite === iso(t0 + 8 * 24 * H).slice(0, 10) && u1.limiteSure === true && u1.lieuCp === '99999' && u1.lieuVille === 'TESTVILLE', 'B1 au point d’accès UPS (libellé français) ⇒ disponible, date limite = `pickupByDate` (sûre), lieu lu', J({ etat: u1.etat, lim: u1.limite, s: u1.limiteSure, cp: u1.lieuCp }));
    const u2 = up([a('I', 10, 'In Transit'), a('I', 40, 'Delivered to UPS Access Point™. Awaiting customer pickup.', 'ZP'), a('D', 60, 'DELIVERED', 'FS')]);
    dit(u2.etat === 'retire' && seconde(u2.etatAt) === seconde(iso(t0 + 60 * H)), 'B2 livré APRÈS l’attente au point d’accès ⇒ retiré', J({ etat: u2.etat, at: u2.etatAt }));
    const u3 = up([a('I', 10, 'In Transit'), a('O', 20, 'Out For Delivery Today'), a('D', 22, 'DELIVERED', 'FS')]);
    dit(u3.etat === 'livre', 'B3 livré sans point d’accès ⇒ livré, jamais « retiré »', u3.etat);
    const u4 = up([a('I', 10, 'In Transit'), a('RS', 100, 'Returned to Sender'), a('D', 140, 'DELIVERED', 'FS')]);
    dit(u4.etat === 'retour_expediteur' && u4.detail === 'rendu', 'B4 retour (RS) puis livré ⇒ rendu à l’expéditeur', J({ etat: u4.etat, d: u4.detail }));
    const u5 = up([a('M', 0, 'Shipper created a label', 'MP')]);
    dit(u5.etat === 'en_route' && u5.detail === 'prepare', 'B5 M (étiquette créée) seul ⇒ en préparation', J({ etat: u5.etat, d: u5.detail }));
    const u6 = up([a('I', 10, 'In Transit'), a('X', 20, 'The receiver was not available')]);
    dit(u6.etat === 'incident', 'B6 X ⇒ incident', u6.etat);
    const u7 = up([a('I', 10, 'Arrivé aux installations')]);
    dit(u7.etat === 'en_route' && !u7.limite, 'B7 I ⇒ en route, aucune limite', J({ etat: u7.etat, l: u7.limite }));
    const u8 = up([a('I', 10, 'In Transit'), a('Q', 20, 'Un type jamais vu')]);
    dit(u8.etat === 'inconnu', 'B8 un type inconnu ⇒ « inconnu » (jamais « disponible » deviné)', u8.etat);
    dit(up([a('I', 10, 'x')], {}, '1Z999AA19999999999').res === 'forme', 'B9 l’ÉCHO : le colis d’un autre n° ⇒ « forme »');
    dit(T.lireReponseUps(404, 'application/json', UPS_404, { suivi: N_UPS }).res === 'introuvable'
      && T.lireReponseUps(200, 'application/json', JSON.stringify({ trackResponse: { shipment: [{ inquiryNumber: N_UPS, warnings: [{ code: 'TW0001', message: 'Tracking Information Not Found' }] }] } }), { suivi: N_UPS }).res === 'introuvable', 'B10 404, ou un avertissement sans colis ⇒ introuvable');
    dit(T.lireReponseUps(403, 'application/json', '{"response":{"errors":[{"code":"250002","message":"Blocked Merchant"}]}}', { suivi: N_UPS }).res === 'bloque' && T.lireReponseUps(429, 'application/json', '{}', { suivi: N_UPS }).res === 'bloque', 'B11 403 (« Blocked Merchant ») et 429 ⇒ refus (la pause)');
    dit(T.dateUps({ date: '20261112', time: '143000', gmtOffset: '+01:00' }) === Date.parse('2026-11-12T13:30:00Z') && T.dateUps({ gmtDate: '20261112', gmtTime: '13:30:00', date: '20261112', time: '143000' }) === Date.parse('2026-11-12T13:30:00Z'), 'B12 l’heure : GMT d’abord, sinon heure locale + décalage');
  });

  // ══ 3. LA FORME DU N° — et la porte de la clé ══════════════════════════════
  await essaie('la forme du n° et la porte de la clé', async () => {
    if (T.noterLecturesServeur) T.noterLecturesServeur(null);
    for (const k of CLES) delete process.env[k];
    dit(T.lectureServeurActive('colissimo') === false && T.lectureServeurActive('ups') === false && T.lectureServeurActive('chronopost') === true, 'C1 sans clé : Colissimo et UPS ne sont pas lus par le serveur (Chronopost l’est toujours)');
    dit(T.carrierLisible('colissimo', N_LP) === null && T.carrierLuDeLigne('vinted', N_LP) === null && T.carrierLisible('ups', N_UPS) === null, 'C2 sans clé : aucun n° Colissimo / UPS « lisible » (rien demandé, rien promis)', J([T.carrierLisible('colissimo', N_LP), T.carrierLuDeLigne('vinted', N_LP)]));
    dit(T.carrierLuDeLigne('vinted', N_LP) !== 'vinted', 'C3 un n° de forme Colissimo propre n’est jamais lu chez Vinted Go (même sous l’expéditeur par défaut « vinted »)');
    dit(T.carrierLisible('vinted', '1AB2C3DEFGHIJ') === 'vinted' && T.carrierLisible('vinted', '1AB2C3DEFG4HI') === 'vinted', 'C4 les formes Vinted Go mesurées (13 caractères « 9AA9A… ») restent à Vinted Go');
    process.env.LAPOSTE_OKAPI_KEY = CLE_LP;
    dit(T.lectureServeurActive('colissimo') === true && T.lectureServeurActive('ups') === false, 'C5 la clé La Poste posée ⇒ Colissimo lu, UPS toujours pas (deux identifiants)');
    dit(T.carrierLisible('colissimo', N_LP) === 'colissimo' && T.carrierLisible('la poste', N_LP) === 'colissimo' && T.carrierLuDeLigne('vinted', N_LP) === 'colissimo' && T.carrierLuDeLigne('', N_LP) === 'colissimo', 'C6 avec la clé : « 6A + 11 chiffres » ⇒ Colissimo, nommé ou par sa forme');
    dit(T.carrierLisible('colissimo', 'CB123456789FR') === 'colissimo' && T.carrierLuDeLigne('', 'CB123456789FR') === null, 'C7 un S10 « …FR » n’est Colissimo que si la ligne le nomme');
    process.env.UPS_CLIENT_ID = UPS_ID; process.env.UPS_CLIENT_SECRET = UPS_SECRET;
    dit(T.carrierLisible('ups', N_UPS) === 'ups' && T.carrierLuDeLigne('autre', N_UPS) === 'ups' && T.carrierLisible('ups', '1Z12') === null, 'C8 avec ses identifiants : « 1Z + 16 » ⇒ UPS ; une autre forme ⇒ rien');
    dit(T.carrierLuDeLigne('', '25009612345678') === null && T.carrierLuDeLigne('', '12345678901') === null, 'C9 DPD (14 chiffres) et GLS (11 chiffres) ne se devinent JAMAIS par la forme (elle est partagée)');
    dit(T.carrierNonLu('colissimo') === null && T.carrierNonLu('ups') === null && T.carrierNonLu('dpd') === 'DPD' && T.carrierNonLu('gls') === 'GLS', 'C10 avec la clé, Colissimo / UPS ne sont plus « non lus » ; DPD et GLS le restent', J([T.carrierNonLu('colissimo'), T.carrierNonLu('gls')]));
    for (const k of CLES) delete process.env[k];
    const pl = RS.pourquoiPasLu({ suivi: N_LP, carrier: 'colissimo', t: null });
    dit(pl && pl.code === 'non-lu' && /e-mail seulement/.test(pl.texte) && !/erreur|ne lit pas/i.test(pl.texte), 'C11 sans clé, l’app dit « Colissimo : suivi lu par e-mail seulement » (jamais une erreur)', J(pl));
    const pg = RS.pourquoiPasLu({ suivi: '12345678901', carrier: 'gls', t: null });
    dit(pg && pg.code === 'non-lu' && /^GLS : suivi lu par e-mail seulement/.test(pg.texte), 'C12 GLS : « suivi lu par e-mail seulement » (plus « transporteur pas reconnu »)', J(pg));
    // L'app ne voit pas l'environnement : elle apprend par la réponse du passage.
    const vraiProcess = globalThis.process; globalThis.process = undefined;
    let appInconnu = null; try { T.noterLecturesServeur(null); appInconnu = T.lecturesCle(); } finally { globalThis.process = vraiProcess; }
    T.noterLecturesServeur({ colissimo: true, ups: false });
    const appSait = T.carrierLisible('colissimo', N_LP) === 'colissimo' && T.carrierNonLu('colissimo') === null && T.carrierLisible('ups', N_UPS) === null;
    const plOui = RS.pourquoiPasLu({ suivi: N_LP, carrier: 'colissimo', t: null });
    T.noterLecturesServeur(null);
    dit(appInconnu && appInconnu.colissimo === null && appSait && plOui && plOui.code === 'jamais', 'C13 l’app : « pas su » avant la réponse du serveur ; `lecture` reçue ⇒ la même règle partagée suit', J({ appInconnu, plOui }));
    const lm = T.ligneTranspDeMeta({ id: `transp_colissimo_${N_LP}`, suivi: N_LP, carrier: 'colissimo', etat: 'disponible', lu: iso(NOW) });
    dit(lm && lm.carrier === 'colissimo' && lm.etat === 'disponible' && T.ligneTranspDeMeta({ id: `transp_ups_${N_UPS}`, suivi: N_UPS, carrier: 'ups' }), 'C14 les lignes `transp_colissimo_…` / `transp_ups_…` sont lues par l’app, le widget et le cron', J(lm));
  });

  // ══ 4. LE VRAI PASSAGE DU SERVEUR (fausse base, faux transporteurs) ══════
  const passage = (o = {}) => O.contexteVendeur.run({ owner: A }, () => L.passageTransporteurs({ max: 12, budgetMs: 20000, ...o }));
  if (typeof L._reglerPourBanc === 'function') L._reglerPourBanc({ ecartMs: 0 });
  const ligneLp = (n = N_LP, o = {}) => ({ type: 'suivi', carrier: 'colissimo', suivi: n, status: 'available', statusLabel: 'Disponible', subject: `Votre colis ${n} est disponible`, receivedAt: iso(NOW - 3 * H), sens: 'entrant', ...o });
  const ligneUps = (n = N_UPS) => ({ type: 'suivi', carrier: 'ups', suivi: n, status: 'transit', subject: `UPS : votre colis ${n} est en route`, receivedAt: iso(NOW - 3 * H), sens: 'entrant' });
  const remise = () => {
    base.clear(); appels.length = 0;
    if (typeof L._oublierPauseInstance === 'function') L._oublierPauseInstance();
    if (typeof L._oublierJetonUps === 'function') L._oublierJetonUps();
    if (T.noterLecturesServeur) T.noterLecturesServeur(null);
    for (const k of CLES) delete process.env[k];
    base.set(`${A}|main`, { vrm_colis_collected: [] });
    base.set(`${A}|email_track_colissimo_${N_LP}`, ligneLp());
    base.set(`${A}|email_track_ups_${N_UPS}`, ligneUps());
    base.set(`${A}|email_track_ups_${N_UPS2}`, ligneUps(N_UPS2));
  };
  const okLp = () => ({ status: 200, ctype: 'application/json', body: lpJson(N_LP, [{ code: 'PC1', ms: NOW - 30 * H, label: 'Pris en charge' }, { code: 'AG1', ms: NOW - 2 * H, label: 'Votre colis est disponible dans votre point de retrait' }], { pointNom: 'BUREAU DE POSTE TEST' }) });
  const okUps = (n) => ({ status: 200, ctype: 'application/json', body: upsJson(n, [{ type: 'I', ms: NOW - 20 * H, desc: 'In Transit' }, { type: 'I', ms: NOW - 2 * H, desc: 'Departed from Facility' }]) });
  const ligneT = (c, n) => base.get(`${A}|transp_${c}_${n}`) || null;

  await essaie('passage SANS clé', async () => {
    remise();
    transporteur = (u) => (u.hostname === 'api.laposte.fr' ? okLp() : u.hostname === 'onlinetools.ups.com' ? okUps(N_UPS) : null);
    const r = await passage();
    dit(r.ok && appels.filter((x) => /laposte|ups/.test(x.host)).length === 0, 'D1 sans clé : AUCUNE requête à La Poste ni à UPS', J(appels.map((x) => x.host)));
    dit(!ligneT('colissimo', N_LP) && !ligneT('ups', N_UPS), 'D2 sans clé : aucune ligne `transp_` créée (rien de « jamais lu » à afficher)');
    dit(r.lecture && r.lecture.colissimo === false && r.lecture.ups === false, 'D3 la réponse dit à l’app « pas de clé » (`lecture`), jamais la clé', J(r.lecture));
    dit((r.besoinNavigateur || []).length === 0, 'D4 rien pour l’extension', J(r.besoinNavigateur));
  });

  await essaie('passage avec la clé La Poste', async () => {
    remise();
    process.env.LAPOSTE_OKAPI_KEY = CLE_LP;
    transporteur = (u) => (u.hostname === 'api.laposte.fr' && u.pathname === `/suivi/v2/idships/${N_LP}` ? okLp() : null);
    const r = await passage();
    const lp = appels.filter((x) => x.host === 'api.laposte.fr');
    dit(lp.length === 1 && lp[0].methode === 'GET' && lp[0].okapi === CLE_LP && /^VRM-suivi\//.test(lp[0].ua) && lp[0].redirect === 'error' && new URL(lp[0].url).searchParams.get('lang') === 'fr_FR', 'E1 UNE requête GET à api.laposte.fr/suivi/v2/idships/{n}, clé dans `X-Okapi-Key`, User-Agent honnête, aucune redirection', J(lp.map((x) => ({ p: x.path, ua: x.ua, k: !!x.okapi }))));
    dit(!appels.some((x) => x.host === 'onlinetools.ups.com'), 'E2 UPS n’est pas appelé (pas ses identifiants)');
    const l = ligneT('colissimo', N_LP);
    dit(l && l.etat === 'disponible' && l.lieuNom === 'BUREAU DE POSTE TEST' && l.voie === 'lp-suivi-v2' && l.source === 'serveur' && l.essaiRes === 'ok', 'E3 la ligne `transp_colissimo_…` : disponible, au point lu, voie `lp-suivi-v2`, par le serveur', l && J({ e: l.etat, p: l.lieuNom, v: l.voie }));
    dit(!JSON.stringify([...base.values()]).includes(CLE_LP), 'E4 la clé n’est écrite NULLE PART en base');
    dit(r.lecture && r.lecture.colissimo === true && r.lecture.ups === false, 'E5 `lecture` : Colissimo lu, UPS non', J(r.lecture));
    const tl = T.ligneTranspDeMeta({ id: `transp_colissimo_${N_LP}`, ...Object.fromEntries(Object.entries(l || {}).filter(([, v]) => v == null || typeof v !== 'object').map(([k, v]) => [k, String(v)])) });
    dit(tl && tl.etat === 'disponible' && tl.lieuNom === 'BUREAU DE POSTE TEST', 'E6 relue en scalaires (`meta->>`), la ligne garde son état', J(tl && { e: tl.etat }));
    // La clé refusée (401) : la PAUSE, puis plus rien jusqu'à sa fin.
    remise();
    process.env.LAPOSTE_OKAPI_KEY = CLE_LP;
    transporteur = (u) => (u.hostname === 'api.laposte.fr' ? { status: 401, ctype: 'application/json', body: '{"code":"UNAUTHORIZED","message":"Invalid api key"}' } : null);
    await passage();
    const pause = base.get(`00000000-0000-0000-0000-000000000000|transp_pause`) || {};
    const n0 = appels.length;
    base.set(`${A}|email_track_colissimo_6A12345678902`, ligneLp('6A12345678902'));
    await passage();
    dit(pause.colissimo && Date.parse(pause.colissimo.jusqua) > Date.now() && appels.length === n0, 'E7 clé refusée (401) ⇒ pause de Colissimo, plus aucune requête pendant la pause', J({ pause: pause.colissimo, appels: appels.length - n0 }));
    const besoin = T.aLireParNavigateur({ lignes: [{ suivi: N_LP, carrier: 'colissimo', status: 'available', sens: 'entrant', receivedAt: iso(NOW) }], transp: new Map([[N_LP, { suivi: N_LP, carrier: 'colissimo', essaiRes: 'bloque', essaiSource: 'serveur', essai: iso(NOW - 3 * H) }]]), pause: { colissimo: { jusqua: iso(NOW + H) } }, maintenant: NOW });
    dit(Array.isArray(besoin) && besoin.length === 0, 'E8 refusé ou en pause, Colissimo ne part JAMAIS à l’extension (« on ne fait pas avec l’extension »)', J(besoin));
    const c4 = await O.contexteVendeur.run({ owner: A }, () => L.appliquerReponseBrute({ v: 1, carrier: 'colissimo', suivi: N_LP, voie: 'lp-suivi-v2', statut: 200, ctype: 'application/json', corps: okLp().body }));
    dit(c4 && c4.status === 400, 'E9 une réponse relayée par l’extension pour Colissimo est refusée (400)', J(c4));
  });

  await essaie('passage avec les identifiants UPS', async () => {
    remise();
    process.env.UPS_CLIENT_ID = UPS_ID; process.env.UPS_CLIENT_SECRET = UPS_SECRET;
    let jetons = 0;
    transporteur = (u, { methode }) => {
      if (u.hostname !== 'onlinetools.ups.com') return null;
      if (u.pathname === '/security/v1/oauth/token' && methode === 'POST') return { status: 200, ctype: 'application/json', body: UPS_JETON(`jeton-${++jetons}`) };
      const m = /^\/api\/track\/v1\/details\/([0-9A-Z]+)$/.exec(u.pathname);
      return m ? okUps(m[1]) : null;
    };
    const r = await passage();
    const tok = appels.filter((x) => x.path === '/security/v1/oauth/token');
    const trk = appels.filter((x) => x.path.startsWith('/api/track/v1/details/'));
    const basic = `Basic ${Buffer.from(`${UPS_ID}:${UPS_SECRET}`).toString('base64')}`;
    dit(tok.length === 1 && tok[0].methode === 'POST' && tok[0].auth === basic && /grant_type=client_credentials/.test(tok[0].corps), 'F1 le jeton OAuth : UN POST client_credentials, identifiants en Basic', J(tok.map((x) => ({ m: x.methode, c: x.corps }))));
    dit(trk.length === 2 && trk.every((x) => x.methode === 'GET' && x.auth === 'Bearer jeton-1' && x.transId && x.src === 'VRM-suivi' && /^VRM-suivi\//.test(x.ua)) && new Set(trk.map((x) => x.transId)).size === 2, 'F2 deux colis, UN jeton gardé : Bearer, `transId` unique par requête, `transactionSrc`', J(trk.map((x) => ({ a: x.auth, t: x.transId }))));
    const l1 = ligneT('ups', N_UPS), l2 = ligneT('ups', N_UPS2);
    dit(l1 && l1.etat === 'en_route' && l1.voie === 'ups-track-v1' && l2 && l2.etat === 'en_route', 'F3 les lignes `transp_ups_…` rangées (en route, voie `ups-track-v1`)', J({ a: l1 && l1.etat, b: l2 && l2.etat }));
    dit(!JSON.stringify([...base.values()]).includes(UPS_SECRET) && !JSON.stringify([...base.values()]).includes('jeton-1'), 'F4 ni le secret ni le jeton ne sont écrits en base');
    dit(r.lecture && r.lecture.ups === true, 'F5 `lecture` : UPS lu', J(r.lecture));
    // Un jeton refusé (401) est redemandé UNE fois, puis la requête rejouée.
    remise();
    process.env.UPS_CLIENT_ID = UPS_ID; process.env.UPS_CLIENT_SECRET = UPS_SECRET;
    base.delete(`${A}|email_track_ups_${N_UPS2}`);
    jetons = 0;
    transporteur = (u, { methode, h }) => {
      if (u.hostname !== 'onlinetools.ups.com') return null;
      if (u.pathname === '/security/v1/oauth/token' && methode === 'POST') return { status: 200, ctype: 'application/json', body: UPS_JETON(`jeton-${++jetons}`) };
      if (entete(h, 'Authorization') === 'Bearer jeton-1') return { status: 401, ctype: 'application/json', body: '{"response":{"errors":[{"code":"250002","message":"Invalid Authentication Information."}]}}' };
      return okUps(N_UPS);
    };
    await passage();
    const tok2 = appels.filter((x) => x.path === '/security/v1/oauth/token').length;
    const l3 = ligneT('ups', N_UPS);
    dit(tok2 === 2 && l3 && l3.etat === 'en_route' && l3.essaiRes === 'ok', 'F6 401 sur le jeton gardé ⇒ un NOUVEAU jeton, la requête rejouée, le colis lu', J({ jetons: tok2, e: l3 && l3.etat, r: l3 && l3.essaiRes }));
    // Identifiants refusés : aucune requête de suivi, et le jeton n'est pas redemandé en rafale.
    remise();
    process.env.UPS_CLIENT_ID = UPS_ID; process.env.UPS_CLIENT_SECRET = UPS_SECRET;
    transporteur = (u, { methode }) => (u.hostname === 'onlinetools.ups.com' && methode === 'POST' ? { status: 401, ctype: 'application/json', body: '{"response":{"errors":[{"code":"10401","message":"ClientId is Invalid"}]}}' } : (u.hostname === 'onlinetools.ups.com' ? okUps(N_UPS) : null));
    await passage();
    const tok3 = appels.filter((x) => x.path === '/security/v1/oauth/token').length, trk3 = appels.filter((x) => x.path.startsWith('/api/track/')).length;
    dit(tok3 === 1 && trk3 === 0, 'F7 identifiants refusés ⇒ un seul essai de jeton (30 min de repos), aucune requête de suivi', J({ tok3, trk3 }));
  });

  await essaie('la clé annoncée sans valeur : rien ne part', async () => {
    remise();
    T.noterLecturesServeur({ colissimo: true, ups: true });   // (un banc : l'état dit « lu », l'environnement n'a pas la clé)
    transporteur = (u) => (u.hostname === 'api.laposte.fr' ? okLp() : null);
    await passage();
    T.noterLecturesServeur(null);
    dit(appels.filter((x) => x.host === 'api.laposte.fr' && !x.okapi).length === 0, 'G1 sans valeur de clé, aucune requête ne part sans `X-Okapi-Key`', J(appels.map((x) => ({ h: x.host, k: !!x.okapi }))));
  });

  console.log(ko ? `\n❌ audit-suivi-cles : ${ko} rouge(s)` : '\n✅ audit-suivi-cles : Colissimo / La Poste et UPS sont prêts à s’allumer avec leur clé, sans clé rien ne part, jamais par l’extension');
  process.exit(ko ? 1 : 0);
})();
