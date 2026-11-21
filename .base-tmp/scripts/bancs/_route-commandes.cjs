// ════════════════════════════════════════════════════════════════════════════
//  LA VRAIE ROUTE DES COMMANDES DANS UN BANC DE RENDU (20 nov., lectures-legeres)
//  `api/_lib/commandes-lecture.js` (`/api/compte?mode=commandes-lire`) EXÉCUTÉE dans le
//  processus du banc (loi 10), sur la base du banc : le fetch du SERVEUR est remplacé le
//  temps de l'appel (auth ⇒ le vendeur de la session ; base ⇒ `repondre` de `_base-volume`,
//  avec `owner=eq.` appliqué : les lignes du banc sont toutes à ce vendeur).
//  `executer(url, entetes)` ⇒ { status, octets (compressés), clair (corps JSON), etag, cache }.
//  `panne` (option) : 'base' ⇒ la base du serveur répond 500 (la route doit dire 503).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const zlib = require('zlib');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..', '..');

function routeCommandes({ base, repondre, uid, email = 'banc@exemple.fr', panne = null }) {
  let route = null;
  return async function executer(urlTxt, entetes) {
    if (!route) route = (await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'commandes-lecture.js')).href)).routeCommandesLecture;
    const avant = globalThis.fetch;
    globalThis.fetch = async (url, o = {}) => {
      const u = String(url); const h = o.headers || {};
      if (/\/auth\/v1\/user/.test(u)) return { ok: true, status: 200, json: async () => ({ id: uid, email }) };
      if (panne === 'base') return { ok: false, status: 500, json: async () => ({}), headers: { get: () => null } };
      const own = /[?&]owner=eq\.([^&]+)/.exec(u);
      const rows = own && decodeURIComponent(own[1]) === uid ? base.rows : [];
      const rep = repondre(u.replace(/&owner=eq\.[^&]+/, ''), h.Range, { ...base, rows });
      return { ok: rep.status < 300, status: rep.status, json: async () => rep.body, headers: { get: (k) => (rep.headers || {})[String(k).toLowerCase()] || null } };
    };
    const q = Object.fromEntries(new URL(urlTxt).searchParams);
    const res = { statusCode: 200, h: {}, corps: null, setHeader(k, v) { this.h[k.toLowerCase()] = v; }, status(c) { this.statusCode = c; return this; }, json(o) { this.corps = Buffer.from(JSON.stringify(o)); return this; }, end(b) { this.corps = b == null ? Buffer.alloc(0) : Buffer.from(b); return this; } };
    try { await route({ method: 'GET', query: q, headers: entetes }, res, { env: { SUPABASE_SERVICE_KEY: 'cle-du-banc' } }); }
    finally { globalThis.fetch = avant; }
    const enc = res.h['content-encoding'];
    const clair = enc === 'br' ? zlib.brotliDecompressSync(res.corps) : enc === 'gzip' ? zlib.gunzipSync(res.corps) : res.corps;
    return { status: res.statusCode, octets: res.corps.length, clair, etag: res.h.etag || null, cache: res.h['cache-control'] || null };
  };
}
module.exports = { routeCommandes };
