// ════════════════════════════════════════════════════════════════════════════
//  LES COMMANDES SE LISENT LÉGÈRES — LA ROUTE EXÉCUTÉE (20 nov., lectures-legeres)
//
//  Loi 10 : la VRAIE route (`api/_lib/commandes-lecture.js`, par `api/compte.js`
//  `mode=commandes-lire`) est EXÉCUTÉE contre une fausse base à la FORME réelle
//  (`_base-volume` + `_commandes-forme` : 30 lignes, ~2 Mo, mêmes champs, mêmes
//  longueurs que sa base, valeurs inventées) qui applique `select=`, `id=`,
//  `owner=eq.`, `order=`, `Range` (1 000 lignes par page, §4.5) et rend
//  `Content-Range`. Le fetch du serveur (auth + base) est remplacé ici.
//   1. sa session ⇒ 200, compressé (br / gzip), les lignes = la projection
//      `SEL_COMMANDES` de l'app sur SES lignes, octet pour octet après décodage
//      (forme réelle : la liste blanche ne retire rien de ce qu'il voit) ; un
//      champ hors liste (`_pad`) retiré ;
//   2. un AUTRE vendeur : jamais une de ses lignes, même avec `owner=` ou
//      `ids=` de ses lignes dans l'URL ; la base est interrogée sur l'owner de la
//      SESSION ; sans session 401 ; jeton faux 401 ; service de connexion en panne 503 ;
//   3. lecture ratée (500, coupure, page 2 manquante, JSON illisible, clé de
//      service absente) ⇒ 503, jamais 200 ni `[]` ; base qui dit 0 ligne ⇒ 200 [] ;
//   4. ETag : même version ⇒ 304 sans lire les payloads ; une ligne réécrite
//      (`rev`, `capturedAt`) ⇒ 200 et un autre ETag ; d'autres `ids` ⇒ autre ETag ;
//   5. `ids=` d'une autre forme ⇒ 400.
//  `--mutation` : chaque mutation (owner du navigateur, `[]` sur panne, ETag sans
//  version, liste blanche coupée) DOIT rougir au moins un contrôle.
//  Usage : node scripts/bancs/commandes-lecture.cjs [--mutation]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { pathToFileURL } = require('url');
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const { formeReelle } = require(path.join(__dirname, '_commandes-forme.cjs'));
const RACINE = path.join(__dirname, '..', '..');
const MODULE = path.join(RACINE, 'api', '_lib', 'commandes-lecture.js');

const MOI = '0a0a0a0a-1111-4222-8333-444455556666', AUTRE = '0b0b0b0b-1111-4222-8333-444455556666';
const JETON_MOI = 'aaa.bbb.moi', JETON_AUTRE = 'aaa.bbb.autre';
const SEL_COMMANDES = 'id,updated_at,cap:data->>capturedAt,supprime:data->supprime,payload:data->payload';

function baseDeBanc() {
  const b = fabriquer({ volumeReel: true, qr: true, ventes: 1500, achats: 800, annonces: 1200 });
  formeReelle(b);
  // Un champ hors liste (comme une capture d'une vieille extension) sur 3 commandes.
  const r0 = b.rows.find((r) => /_orders_sold$/.test(r.id));
  for (const o of r0.data.payload.my_orders.slice(0, 3)) o._pad = 'x'.repeat(50);
  for (const r of b.rows) { r.owner = MOI; if (!r.updated_at) r.updated_at = '2026-11-01T10:00:00Z'; }
  // L'AUTRE vendeur : deux lignes de commandes, dont une au MÊME id qu'une des miennes n'existe pas (clé primaire) — ses uid à lui.
  b.rows.push({ id: 'harvest_999000_orders_sold', owner: AUTRE, updated_at: '2026-11-02T10:00:00Z', data: { capturedAt: '2026-11-02T10:00:00Z', payload: { my_orders: [{ transaction_id: 1, title: 'SECRET', price: { amount: '9.0', currency_code: 'EUR' } }] } } });
  b.rows.push({ id: 'harvest_999000_orders_purchased', owner: AUTRE, updated_at: '2026-11-02T10:00:00Z', data: { capturedAt: '2026-11-02T10:00:00Z', payload: { my_orders: [{ transaction_id: 2, title: 'SECRET2' }] } } });
  return b;
}

// Le fetch du serveur : auth (`/auth/v1/user`) et la base (`/rest/v1/app_data`).
function fetchServeur(b, panne) {
  const appels = [];
  const f = async (url, o = {}) => {
    const u = String(url); const h = o.headers || {};
    appels.push(u);
    if (/\/auth\/v1\/user/.test(u)) {
      if (panne.auth) return { ok: false, status: 503, json: async () => ({}) };
      const j = String(h.Authorization || '').replace(/^Bearer\s+/, '');
      if (j === JETON_MOI) return { ok: true, status: 200, json: async () => ({ id: MOI, email: 'moi@exemple.invalid' }) };
      if (j === JETON_AUTRE) return { ok: true, status: 200, json: async () => ({ id: AUTRE, email: 'autre@exemple.invalid' }) };
      return { ok: false, status: 401, json: async () => ({}) };
    }
    if (/\/rest\/v1\/app_data/.test(u)) {
      if (panne.base) return { ok: false, status: 500, json: async () => ({ message: 'panne' }), headers: { get: () => null } };
      if (panne.coupure) throw new TypeError('fetch failed');
      if (String(h.apikey || '') !== 'cle-service-du-banc') return { ok: false, status: 401, json: async () => ({}), headers: { get: () => null } };
      const q = new URL(u).searchParams;
      const own = /^eq\.(.+)$/.exec(q.get('owner') || '');
      const rows = own ? b.rows.filter((r) => r.owner === own[1]) : b.rows;   // sans `owner=` : la clé de service voit TOUT
      const rep = repondre(u, h.Range, { rows, main: [], accounts: b.accounts });
      const debut = Number((/^(\d+)-/.exec(h.Range || '') || [])[1] || 0);
      if (panne.page2 && debut > 0) return { ok: false, status: 500, json: async () => ({}), headers: { get: () => null } };
      const corps = panne.illisible ? '<html>' : JSON.stringify(rep.body);
      return { ok: rep.status < 300, status: rep.status === 200 && h.Range ? 206 : rep.status, json: async () => JSON.parse(corps), headers: { get: (k) => (rep.headers || {})[String(k).toLowerCase()] || null } };
    }
    throw new Error('hôte inattendu ' + u);
  };
  f.appels = appels;
  return f;
}

function resFactice() {
  const r = { statusCode: 200, h: {}, corps: null, fini: false };
  r.setHeader = (k, v) => { r.h[String(k).toLowerCase()] = v; };
  r.getHeader = (k) => r.h[String(k).toLowerCase()];
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (o) => { r.setHeader('content-type', 'application/json'); r.corps = Buffer.from(JSON.stringify(o)); r.fini = true; return r; };
  r.end = (buf) => { r.corps = buf == null ? Buffer.alloc(0) : Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf)); r.fini = true; return r; };
  return r;
}
const decode = (res) => {
  const enc = res.h['content-encoding'];
  const raw = enc === 'br' ? zlib.brotliDecompressSync(res.corps) : enc === 'gzip' ? zlib.gunzipSync(res.corps) : res.corps;
  try { return JSON.parse(raw.toString('utf8')); } catch (_) { return undefined; }
};

async function passe(modulePath, { silencieux = false } = {}) {
  let ok = 0, ko = 0; const rouges = [];
  const dit = (bon, quoi, det) => { if (bon) { ok++; if (!silencieux) console.log(`✅ ${quoi}`); } else { ko++; rouges.push(quoi); if (!silencieux) console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
  const { routeCommandesLecture } = await import(pathToFileURL(modulePath).href + '?t=' + Date.now());
  const b = baseDeBanc();
  const panne = {};
  const env = { SUPABASE_SERVICE_KEY: 'cle-service-du-banc' };
  const appel = async ({ jeton = JETON_MOI, query = {}, enc = 'br, gzip', inm = null, envX = env } = {}) => {
    const f = fetchServeur(b, panne); globalThis.fetch = f;
    const req = { method: 'GET', query: { mode: 'commandes-lire', ...query }, headers: { ...(jeton ? { authorization: `Bearer ${jeton}` } : {}), 'accept-encoding': enc, ...(inm ? { 'if-none-match': inm } : {}) } };
    const res = resFactice();
    await routeCommandesLecture(req, res, { env: envX });
    return { res, appels: f.appels, j: res.statusCode === 200 || res.statusCode >= 400 ? decode(res) : null };
  };
  // La projection de l'app (SEL_COMMANDES) sur MES lignes, en direct — la référence.
  const ref = repondre(`https://x/rest/v1/app_data?id=like.harvest_*_orders_*d&select=${SEL_COMMANDES}`, '0-999', { rows: b.rows.filter((r) => r.owner === MOI), main: [], accounts: [] }).body;
  const sansPad = (p) => (p && Array.isArray(p.my_orders) ? { ...p, my_orders: p.my_orders.map((o) => { const x = { ...o }; delete x._pad; return x; }) } : p);
  const normal = (rows) => JSON.stringify((rows || []).map((r) => ({ id: r.id, updated_at: r.updated_at ?? null, cap: r.cap ?? null, supprime: r.supprime ?? null, payload: r.payload === undefined ? null : r.payload })).sort((a, c) => (a.id < c.id ? -1 : 1)));

  // 1. sa session
  const a = await appel();
  dit(a.res.statusCode === 200, '1. sa session ⇒ 200', String(a.res.statusCode));
  dit(a.res.h['content-encoding'] === 'br', '1. compressé (br si demandé)', a.res.h['content-encoding']);
  const brut = Buffer.byteLength(JSON.stringify(ref));
  dit(a.res.corps && a.res.corps.length < brut / 4, `1. octets envoyés ${Math.round((a.res.corps || []).length / 1024)} Ko contre ${Math.round(brut / 1024)} Ko lus en direct (< 1/4)`);
  dit(a.j && Array.isArray(a.j.rows) && normal(a.j.rows) === normal(ref.map((r) => ({ ...r, payload: sansPad(r.payload) }))), '1. les lignes = la projection de l\'app (forme réelle : rien de lu ne manque)');
  dit(a.j && a.j.rows.length === ref.length && ref.length >= 20, `1. ${a.j && a.j.rows.length} lignes (toutes les miennes, ventes et achats)`);
  const toutes = a.j ? a.j.rows.flatMap((r) => (r.payload && r.payload.my_orders) || []) : [];
  dit(toutes.length > 4000 && !toutes.some((o) => '_pad' in o), `1. ${toutes.length} commandes, le champ hors liste retiré`);
  const g = await appel({ enc: 'gzip' });
  dit(g.res.h['content-encoding'] === 'gzip' && normal(g.j && g.j.rows) === normal(a.j && a.j.rows), '1. gzip quand br n\'est pas demandé, mêmes lignes');
  dit(/private/.test(a.res.h['cache-control'] || '') && /Authorization/.test(a.res.h.vary || '') && !!a.res.h.etag, '1. Cache-Control private + Vary: Authorization + ETag');

  // 2. un autre vendeur
  const autre = await appel({ jeton: JETON_AUTRE });
  dit(autre.res.statusCode === 200 && autre.j && autre.j.rows.length === 2 && autre.j.rows.every((r) => /^harvest_999000_/.test(r.id)), '2. l\'autre vendeur ne voit que SES 2 lignes');
  const vol = await appel({ query: { owner: AUTRE, ids: 'harvest_999000_orders_sold' } });
  dit(vol.res.statusCode === 200 && vol.j && vol.j.rows.length === 0, '2. owner= et ids= de l\'autre dans l\'URL ⇒ aucune de ses lignes (rien de lu, 0)', JSON.stringify(vol.j && vol.j.rows && vol.j.rows.map((r) => r.id)));
  dit(a.appels.filter((x) => /rest\/v1\/app_data/.test(x)).every((x) => new URL(x).searchParams.get('owner') === `eq.${MOI}`), '2. chaque lecture de la base porte owner = la SESSION');
  dit(vol.appels.filter((x) => /rest\/v1\/app_data/.test(x)).every((x) => new URL(x).searchParams.getAll('owner').length === 1 && new URL(x).searchParams.get('owner') === `eq.${MOI}`), '2. l\'owner de l\'URL n\'arrive jamais à la base');
  const sans = await appel({ jeton: null });
  dit(sans.res.statusCode === 401 && !sans.appels.some((x) => /rest\/v1/.test(x)), '2. sans session ⇒ 401, rien lu');
  const faux = await appel({ jeton: 'aaa.bbb.faux' });
  dit(faux.res.statusCode === 401, '2. jeton faux ⇒ 401');
  panne.auth = true; const pa = await appel(); panne.auth = false;
  dit(pa.res.statusCode === 503, '2. service de connexion en panne ⇒ 503 (pas « reconnecte-toi »)');

  // 3. lecture ratée
  for (const [cle, quoi] of [['base', 'la base répond 500'], ['coupure', 'coupure réseau'], ['page2', 'la 2e page manque'], ['illisible', 'réponse illisible']]) {
    panne[cle] = true;
    const r = await appel({ query: cle === 'page2' ? {} : {} });
    panne[cle] = false;
    if (cle === 'page2') {
      // 24 lignes tiennent en une page : on force deux pages en lisant toute la famille + 1 000 lignes inventées.
      continue;
    }
    dit(r.res.statusCode === 503 && !(r.j && Array.isArray(r.j.rows)), `3. ${quoi} ⇒ 503, jamais une liste`, String(r.res.statusCode));
  }
  {
    // Deux pages : 1 100 lignes de commandes inventées (petites) chez moi.
    const ajout = []; for (let i = 0; i < 1100; i++) ajout.push({ id: `harvest_${7000000 + i}_orders_sold`, owner: MOI, updated_at: '2026-11-01T10:00:00Z', data: { capturedAt: '2026-11-01T10:00:00Z', payload: { my_orders: [] } } });
    b.rows.push(...ajout);
    const deux = await appel();
    dit(deux.res.statusCode === 200 && deux.j && deux.j.rows.length === ref.length + 1100, `3. ${ref.length + 1100} lignes lues en deux pages (Range)`, String(deux.j && deux.j.rows.length));
    panne.page2 = true; const p2 = await appel(); panne.page2 = false;
    dit(p2.res.statusCode === 503, '3. la 2e page ratée ⇒ 503, jamais une demi-liste', String(p2.res.statusCode));
    b.rows.splice(b.rows.length - 1100, 1100);
  }
  const sc = await appel({ envX: {} });
  dit(sc.res.statusCode === 503 && !sc.appels.some((x) => /rest\/v1/.test(x)), '3. clé de service absente ⇒ 503, rien lu');
  const vide = await appel({ query: { uids: '123456' } });
  dit(vide.res.statusCode === 200 && vide.j && Array.isArray(vide.j.rows) && vide.j.rows.length === 0, '3. la base dit 0 ligne ⇒ 200 [] (une réponse, pas une panne)');

  // 4. ETag
  const e1 = a.res.h.etag;
  const n304 = await appel({ inm: e1 });
  dit(n304.res.statusCode === 304 && (!n304.res.corps || n304.res.corps.length === 0), '4. même version ⇒ 304, corps vide');
  dit(n304.appels.filter((x) => /rest\/v1\/app_data/.test(x)).every((x) => !/payload/.test(decodeURIComponent(x))), '4. le 304 ne lit que les versions (aucun payload)');
  const r1 = b.rows.find((r) => r.owner === MOI && /_orders_purchased$/.test(r.id));
  r1.data.rev = 7;
  const apres = await appel({ inm: e1 });
  dit(apres.res.statusCode === 200 && apres.res.h.etag && apres.res.h.etag !== e1, '4. une ligne réécrite (rev) ⇒ 200, autre ETag');
  const e2 = apres.res.h.etag; r1.data.capturedAt = '2026-11-20T09:00:00Z';
  const apres2 = await appel({ inm: e2 });
  dit(apres2.res.statusCode === 200 && apres2.res.h.etag !== e2, '4. une nouvelle capture ⇒ 200, autre ETag');
  const ids1 = await appel({ query: { ids: r1.id } });
  const ids1b = await appel({ query: { ids: r1.id }, inm: apres2.res.h.etag });
  dit(ids1.res.h.etag !== apres2.res.h.etag && ids1b.res.statusCode === 200, '4. d\'autres lignes demandées ⇒ autre ETag (jamais un 304 d\'une autre liste)');
  const autre304 = await appel({ jeton: JETON_AUTRE, inm: apres2.res.h.etag });
  dit(autre304.res.statusCode === 200 && autre304.j.rows.length === 2, '4. l\'ETag d\'un vendeur ne vaut pas pour un autre');

  // 5. forme des ids
  for (const q of [{ ids: 'main' }, { ids: 'harvest_1_orders_bought' }, { ids: 'harvest_1_listings' }, { uids: 'abc' }, { ids: 'harvest_1_orders_sold)' }]) {
    const r = await appel({ query: q });
    dit(r.res.statusCode === 400 && !r.appels.some((x) => /rest\/v1/.test(x)), `5. ${JSON.stringify(q)} ⇒ 400, rien lu`);
  }
  // 6. par la vraie entrée (`api/compte.js`, `mode=commandes-lire`)
  if (modulePath === MODULE) {
    const { default: handler } = await import(pathToFileURL(path.join(RACINE, 'api', 'compte.js')).href);
    const avant = process.env.SUPABASE_SERVICE_KEY; process.env.SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
    try {
      const f = fetchServeur(b, panne); globalThis.fetch = f;
      const res = resFactice();
      await handler({ method: 'GET', query: { mode: 'commandes-lire' }, headers: { authorization: `Bearer ${JETON_MOI}`, 'accept-encoding': 'gzip' } }, res);
      const j = decode(res);
      dit(res.statusCode === 200 && j && j.rows && j.rows.length === ref.length, '6. api/compte.js?mode=commandes-lire ⇒ la route (200, mes lignes)', String(res.statusCode));
      const res2 = resFactice();
      await handler({ method: 'POST', query: { mode: 'commandes-lire' }, headers: { authorization: `Bearer ${JETON_MOI}` } }, res2);
      dit(res2.statusCode === 405, '6. POST ⇒ 405');
    } finally { if (avant === undefined) delete process.env.SUPABASE_SERVICE_KEY; else process.env.SUPABASE_SERVICE_KEY = avant; }
  }
  return { ok, ko, rouges, octets: a.res.corps.length, brut };
}

const MUTATIONS = [
  ['owner du navigateur', (s) => s.replace("&owner=eq.${encodeURIComponent(u.id)}", "${req.query.owner ? `&owner=${req.query.owner}` : ''}")],
  ['[] sur panne', (s) => s.replace("if (!r || !(r.status === 200 || r.status === 206)) return null;", "if (!r || !(r.status === 200 || r.status === 206)) return [];")],
  ['ETag sans version', (s) => s.replace("return [String(r.id), n(r.updated_at), n(r.cap), n(r.rev), n(r.sup), n(r.pg)];", "return [String(r.id)];")],
  ['liste blanche coupée', (s) => s.replace("'date', 'price', 'title', 'status',", "'date', 'price', 'title',")],
  ['sans compression', (s) => s.replace("if (/\\bbr\\b/.test(accepte))", "if (false)").replace("else if (/\\bgzip\\b/.test(accepte))", "else if (false)")],
];

(async () => {
  process.env.VRM_DELAI_SORTANT_MAX_MS = '2000';
  const r = await passe(MODULE);
  console.log(`\n${r.ok} verts, ${r.ko} rouges — ${Math.round(r.octets / 1024)} Ko compressés pour ${Math.round(r.brut / 1024)} Ko en direct`);
  let ko = r.ko;
  if (process.argv.includes('--mutation')) {
    const src = fs.readFileSync(MODULE, 'utf8');
    for (const [nom, muter] of MUTATIONS) {
      const m = muter(src);
      if (m === src) { console.log(`❌ mutation « ${nom} » : rien remplacé (le banc ne la voit plus)`); ko++; continue; }
      const p = path.join(path.dirname(MODULE), `.mutation-commandes-lecture-${process.pid}.js`);
      fs.writeFileSync(p, m);
      try { const x = await passe(p, { silencieux: true }); if (x.ko > 0) console.log(`✅ mutation « ${nom} » ⇒ rouge (${x.rouges.slice(0, 2).join(' ; ')})`); else { console.log(`❌ mutation « ${nom} » : tout reste vert`); ko++; } }
      finally { fs.unlinkSync(p); }
    }
  }
  process.exit(ko ? 1 : 0);
})();
