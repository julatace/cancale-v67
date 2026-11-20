// ══ LES COMMANDES SE LISENT LÉGÈRES (20 nov., chantier lectures-legeres) ═════
// Récit : `docs/passation/2026-11-20-lectures-legeres.md`.
//
// LE PROBLÈME (mesuré au profil de Julien, 4G lente 1,6 Mbit/s) : au démarrage à
// froid l'app lit les ventes ET les achats de tous ses comptes en une lecture
// Supabase (`harvest_*_orders_*d`, `payload:data->payload`) : ~1,9 Mo de JSON
// (30 lignes, ~5 300 commandes — `my_orders`, un tableau que PostgREST ne sait
// pas projeter), soit plus de 9 s de téléchargement.
//
// CE QUE FAIT LA ROUTE (`GET /api/compte?mode=commandes-lire`) :
//   · QUI : le vendeur de la session (`vendeurExige` : Supabase dit à qui est le
//     jeton). Jamais un owner passé par le navigateur : le filtre `owner=eq.` est
//     celui de la session, rien d'autre ;
//   · QUOI : ses lignes `harvest_{uid}_orders_sold|purchased` (toutes, ou celles
//     nommées par `ids=` / `uids=`, refusées si elles ne sont pas de cette forme),
//     lues avec la clé de SERVICE + le filtre du vendeur (même périmètre que RLS :
//     `owner = auth.uid()`), paginées (`Range`, §4.5) ;
//   · CE QUI PART : la même forme que la projection `SEL_COMMANDES` de l'app
//     (`id, updated_at, cap, supprime, payload`), chaque commande réduite aux
//     champs que VRM lit (`CHAMPS_COMMANDE` : la liste blanche que l'extension
//     range déjà, `commandeMaigre` de background.js, + `photo_url` des vieilles
//     captures) — mesuré sur sa base le 20 nov. : ses commandes ne portent QUE
//     ces champs, donc rien de ce qu'il voit ne change ; la photo est gardée
//     ENTIÈRE (l'identité par photo, §5) ;
//   · COMMENT : compressée (brotli si le navigateur le dit, sinon gzip), avec un
//     `ETag` calculé sur la VERSION des lignes rendues (mêmes scalaires que
//     `src/copieLignes.js` : date d'écriture, capture, `rev`, supprimé, purgé).
//     `If-None-Match` égal ⇒ 304 après la seule lecture des versions (scalaires).
//
// LES RÈGLES TENUES :
//   · une lecture ratée (base, clé absente, page manquante) ⇒ 503, JAMAIS `[]`
//     (§4.1, trois états) : l'app retombe alors sur sa lecture d'avant ;
//   · aucune écriture ; aucun `select=data` (§4.4) ;
//   · une liste vide n'est une réponse que si la base l'a dite (200, 0 ligne).
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fetchAvecDelai } from './fetch-delai.js';
import { vendeurExige } from './session.js';
import { sbCle } from './cle.js';
import { repondreSansCleService } from './cle-service.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
// La liste blanche : `commandeMaigre` (vinted-sync-extension/background.js) + `photo_url`.
export const CHAMPS_COMMANDE = ['date', 'price', 'title', 'status', 'transaction_id', 'conversation_id', 'transaction_user_status', 'item_id', 'photo', 'photo_url'];
// Forme de la réponse : un changement de règle change l'ETag (jamais un 304 sur une autre forme).
export const FORME = 'c1';
const RE_ID = /^harvest_\d{1,20}_orders_(sold|purchased)$/;
const MAX_IDS = 200;
const PAGE = 1000;
// Les scalaires de version (src/copieLignes.js `SEL_VERSION`) et la ligne projetée (App.jsx `SEL_COMMANDES`).
const SEL_VERSION = 'id,updated_at,cap:data->>capturedAt,rev:data->>rev,sup:data->>supprime,pg:data->>purgedAt';
const SEL_LIGNE = `${SEL_VERSION},supprime:data->supprime,payload:data->payload`;

export function reduireCommande(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
  const out = {};
  for (const c of CHAMPS_COMMANDE) if (o[c] !== undefined) out[c] = o[c];
  return out;
}
export function reduirePayload(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return p;
  if (!Array.isArray(p.my_orders)) return p;
  return { ...p, my_orders: p.my_orders.map(reduireCommande) };
}
const versionDe = (r) => { const n = (x) => (x === undefined || x === '' ? null : x); return [String(r.id), n(r.updated_at), n(r.cap), n(r.rev), n(r.sup), n(r.pg)]; };
export function etagDe(rows, filtre) {
  const v = (rows || []).map(versionDe).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return 'W/"' + crypto.createHash('sha256').update(JSON.stringify([FORME, filtre, v])).digest('base64url').slice(0, 32) + '"';
}

// Les lignes voulues : `ids=` (liste), `uids=` (comptes ⇒ leurs deux lignes), sinon toutes.
// Rend { filtre } ou { erreur }.
export function filtreDe(query) {
  const ids = String((query && query.ids) || '').trim();
  const uids = String((query && query.uids) || '').trim();
  let l = null;
  if (ids) l = ids.split(',').map((x) => x.trim()).filter(Boolean);
  else if (uids) {
    const u = uids.split(',').map((x) => x.trim()).filter(Boolean);
    if (!u.every((x) => /^\d{1,20}$/.test(x))) return { erreur: 'uids' };
    l = u.flatMap((x) => [`harvest_${x}_orders_sold`, `harvest_${x}_orders_purchased`]);
  }
  if (l) {
    l = [...new Set(l)];
    if (!l.length || l.length > MAX_IDS || !l.every((x) => RE_ID.test(x))) return { erreur: 'ids' };
    return { filtre: `id=in.(${l.join(',')})`, cle: l.slice().sort().join(',') };
  }
  return { filtre: 'id=like.harvest_*_orders_*d', cle: '*' };
}

// Toutes les pages, ou `null` (pas su). Une page ratée = pas su, jamais une demi-liste.
async function lireToutService(chemin, cle) {
  const out = [];
  for (let debut = 0; debut < 100000; debut += PAGE) {
    let r;
    try { r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/${chemin}`, { headers: { ...sbCle(cle), Range: `${debut}-${debut + PAGE - 1}`, 'Range-Unit': 'items', Prefer: 'count=exact' } }); }
    catch (_) { return null; }
    if (!r || !(r.status === 200 || r.status === 206)) return null;
    let j; try { j = await r.json(); } catch (_) { return null; }
    if (!Array.isArray(j)) return null;
    out.push(...j);
    const cr = String((r.headers && typeof r.headers.get === 'function' && r.headers.get('content-range')) || '');
    const m = /\/(\d+|\*)$/.exec(cr);
    const total = m && m[1] !== '*' ? Number(m[1]) : null;
    if (total != null ? out.length >= total : j.length < PAGE) return out;
    if (!j.length) return null;   // le total annoncé n'est pas atteint et la page est vide : incohérent
  }
  return null;
}

function envoyer(req, res, code, corps, entetes = {}) {
  const accepte = String((req.headers && (req.headers['accept-encoding'] || req.headers['Accept-Encoding'])) || '');
  const texte = Buffer.from(JSON.stringify(corps));
  let buf = texte, enc = null;
  if (/\bbr\b/.test(accepte)) { buf = zlib.brotliCompressSync(texte, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: texte.length } }); enc = 'br'; }
  else if (/\bgzip\b/.test(accepte)) { buf = zlib.gzipSync(texte, { level: 6 }); enc = 'gzip'; }
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Vary', 'Authorization, Accept-Encoding');
  if (enc) res.setHeader('Content-Encoding', enc);
  for (const [k, v] of Object.entries(entetes)) res.setHeader(k, v);
  res.setHeader('Content-Length', String(buf.length));
  res.end(buf);
}

export async function routeCommandesLecture(req, res, { env = process.env } = {}) {
  if (req.method !== 'GET') { res.setHeader('Cache-Control', 'no-store'); return res.status(405).json({ ok: false, erreur: 'GET seulement' }); }
  res.setHeader('Cache-Control', 'no-store');
  const u = await vendeurExige(req, res);
  if (!u) return;
  if (repondreSansCleService(res, env)) return;
  const f = filtreDe(req.query || {});
  if (f.erreur) return res.status(400).json({ ok: false, erreur: f.erreur });
  const cle = env.SUPABASE_SERVICE_KEY;
  // Le vendeur : celui de la SESSION (jamais un paramètre). `owner` absent de la base ⇒ 400 ⇒ 503 (pas su).
  const base = `app_data?${f.filtre}&owner=eq.${encodeURIComponent(u.id)}`;
  const attendu = String((req.headers && (req.headers['if-none-match'] || req.headers['If-None-Match'])) || '');
  // `private, no-cache` : le navigateur garde la réponse et la revalide CHAQUE fois (ETag).
  const cache = { 'Cache-Control': 'private, no-cache' };
  if (attendu) {
    const vers = await lireToutService(`${base}&select=${SEL_VERSION}&order=id.asc`, cle);
    if (!Array.isArray(vers)) return res.status(503).json({ ok: false, erreur: 'base' });
    const etag = etagDe(vers, f.cle);
    if (attendu.split(',').map((x) => x.trim()).includes(etag)) {
      res.statusCode = 304;
      res.setHeader('ETag', etag); res.setHeader('Cache-Control', cache['Cache-Control']); res.setHeader('Vary', 'Authorization, Accept-Encoding');
      return res.end();
    }
  }
  const rows = await lireToutService(`${base}&select=${SEL_LIGNE}&order=id.asc`, cle);
  if (!Array.isArray(rows)) return res.status(503).json({ ok: false, erreur: 'base' });
  const etag = etagDe(rows, f.cle);
  const sortie = rows.map((r) => {
    const o = { id: r.id, updated_at: r.updated_at === undefined ? null : r.updated_at, cap: r.cap === undefined ? null : r.cap };
    if (r.supprime != null) o.supprime = r.supprime;
    o.payload = r.payload === undefined ? null : reduirePayload(r.payload);
    return o;
  });
  return envoyer(req, res, 200, { ok: true, forme: FORME, rows: sortie }, { ...cache, ETag: etag });
}
