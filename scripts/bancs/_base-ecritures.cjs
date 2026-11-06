// ════════════════════════════════════════════════════════════════════════════
//  UNE BASE À ÉTAT, À LA VRAIE FORME, QUI GARDE CE QU'ON Y ÉCRIT (1er nov.)
//
//  Pour juger ce que l'app ÉCRIT (et ce qu'elle efface) il faut une base qui se
//  souvient : deux appareils lisent la ligne que l'autre vient d'écrire. Rien
//  d'inventé n'y entre que ce que le banc pose (aucune `fx/`, le dépôt est
//  public). Elle émule PostgREST là où l'app s'en sert, avec les pièges réels :
//   · `like.` : `*`/`%` = n'importe quoi, `_` = UN caractère (le joker qui
//     faisait toucher « 352… » en supprimant « 35 »), `\` échappe le suivant ;
//   · plafond SILENCIEUX de 1 000 lignes, pagination par `Range`, 416 à une
//     frontière exacte (avec `Content-Range: */N`) ;
//   · `select=` projeté (alias, `->`, `->>`), `meta->>` (via `_meta.cjs`),
//     filtres `data->>x=eq.|is.null|…`, `or=(…)`, `in.(…)`, `limit` ;
//   · PATCH CONDITIONNEL (`data->>rev=eq.N`, `return=representation` ⇒ les
//     lignes écrites, 0 si devancé), POST d'insertion (409 si la ligne existe),
//     POST fusion (`resolution=merge-duplicates`) ;
//   · le garde-fou des numéros de la ligne `main` (017 : le pool ne rétrécit
//     jamais, une fiche numérotée ne disparaît pas) — un appareil périmé reçoit
//     le MÊME refus qu'en production.
//  Pannes injectables par adresse et méthode (`faute(url, méthode)`).
// ════════════════════════════════════════════════════════════════════════════
const { metaVersData } = require('./_meta.cjs');
const { projette } = require('./_base-volume.cjs');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');

const DIST = process.env.BANC_DIST || path.resolve(__dirname, '../../dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm' };
async function serveur(port) {
  const s = http.createServer((q, r) => {
    let f = new URL(q.url, 'http://x').pathname; if (!path.extname(f)) f = '/index.html';
    const p = path.join(DIST, f);
    if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
  });
  await new Promise((ok, ko) => { s.once('error', ko); s.listen(Number(port) || 0, '127.0.0.1', ok); });
  return { url: 'http://127.0.0.1:' + s.address().port, fermer: () => s.close() };
}

// LIKE de Postgres (motif PostgREST : `*` vaut `%`).
const reLike = (motif) => {
  let re = '^';
  for (let i = 0; i < motif.length; i++) {
    const c = motif[i];
    if (c === '\\' && i + 1 < motif.length) { re += motif[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); continue; }
    if (c === '*' || c === '%') re += '[\\s\\S]*';
    else if (c === '_') re += '[\\s\\S]';
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(re + '$');
};
const lireChemin = (o, chemin) => { let v = o; for (const s of chemin.split(/->>|->/).filter(Boolean)) v = v == null ? undefined : v[s.replace(/^"(.*)"$/, '$1')]; return v; };
function filtreValeur(get, expr) {
  let m;
  if (expr === 'is.null') return (r) => get(r) == null;
  if (expr === 'not.is.null') return (r) => get(r) != null;
  if ((m = /^eq\.(.*)$/.exec(expr))) return (r) => { const v = get(r); return v != null && (typeof v === 'object' ? JSON.stringify(v) : String(v)) === m[1]; };
  if ((m = /^neq\.(.*)$/.exec(expr))) return (r) => { const v = get(r); return v == null || String(v) !== m[1]; };
  if ((m = /^not\.like\.(.*)$/.exec(expr))) { const re = reLike(m[1]); return (r) => !re.test(String(get(r) ?? '')); }
  if ((m = /^like\.(.*)$/.exec(expr))) { const re = reLike(m[1]); return (r) => re.test(String(get(r) ?? '')); }
  if ((m = /^in\.\((.*)\)$/.exec(expr))) { const s = new Set(m[1].split(',').map((x) => x.replace(/^"|"$/g, ''))); return (r) => s.has(String(get(r))); }
  if ((m = /^gte\.(.*)$/.exec(expr))) return (r) => get(r) != null && String(get(r)) >= m[1];
  if ((m = /^gt\.(.*)$/.exec(expr))) return (r) => get(r) != null && String(get(r)) > m[1];
  if ((m = /^lt\.(.*)$/.exec(expr))) return (r) => get(r) != null && String(get(r)) < m[1];
  if ((m = /^lte\.(.*)$/.exec(expr))) return (r) => get(r) != null && String(get(r)) <= m[1];
  return () => true;
}
const getter = (col) => {
  if (col === 'id' || col === 'owner' || col === 'updated_at') return (r) => r[col];
  if (/^data(->|->>)/.test(col)) { const ch = col.replace(/^data/, ''); return (r) => lireChemin(r.data, ch); }
  return () => undefined;
};
function filtreOr(expr) {
  const corps = expr.replace(/^\(|\)$/g, '');
  const parts = corps.split(/,(?=[a-z_]+(?:->>?[A-Za-z_]+)*\.)/);
  const fs = parts.map((p) => { const m = /^([a-z_]+(?:->>?[A-Za-z_]+)*)\.(.*)$/.exec(p); return m ? filtreValeur(getter(m[1]), m[2]) : () => false; });
  return (r) => fs.some((f) => f(r));
}
const parametres = (u) => (u.split('?')[1] || '').split('&').filter(Boolean).map((kv) => { const i = kv.indexOf('='); return [decodeURIComponent(kv.slice(0, i)), decodeURIComponent(kv.slice(i + 1))]; });
function filtrer(lignes, params) {
  let L = lignes;
  for (const [k, v] of params) {
    if (['select', 'limit', 'offset', 'order', 'on_conflict', 'owner'].includes(k)) continue;
    if (k === 'or') { const f = filtreOr(v); L = L.filter(f); continue; }
    if (k === 'id' || /^data(->|->>)/.test(k)) { const f = filtreValeur(getter(k), v); L = L.filter(f); }
  }
  return L;
}

// Le garde-fou de la ligne `main` (017, les deux refus qui protègent la donnée).
const cleNum = (v) => { const s = String(v == null ? '' : v).toUpperCase().replace(/\s+/g, ''); const m = /^([A-Z]*)0*(\d+)$/.exec(s); return m ? m[1] + m[2] : s; };
function gardeMain(ancien, neuf) {
  const o = ancien || {}, n = neuf || {};
  if (Array.isArray(o.vinted_used_numeros)) {
    const nn = new Set((Array.isArray(n.vinted_used_numeros) ? n.vinted_used_numeros : []).map(cleNum));
    if (o.vinted_used_numeros.map(cleNum).some((c) => c && !nn.has(c))) return 'vrm_pool_retreci';
  }
  const fo = o.vinted_annonce_numeros && typeof o.vinted_annonce_numeros === 'object' ? o.vinted_annonce_numeros : {};
  const fn = n.vinted_annonce_numeros && typeof n.vinted_annonce_numeros === 'object' ? n.vinted_annonce_numeros : {};
  const repris = new Set(Object.values(fn).map((e) => e && e.repriseDe).filter(Boolean).map(String));
  for (const [k, e] of Object.entries(fo)) if (e && typeof e === 'object' && String(e.numero == null ? '' : e.numero).trim() && !(k in fn) && !repris.has(k)) return 'vrm_fiche_perdue';
  return null;
}

// store = { accounts: [], lignes: Map(id → { id, data, updated_at }) }
function creerBase({ accounts = [], lignes = [] } = {}) {
  const m = new Map();
  for (const l of lignes) m.set(l.id, { id: l.id, data: l.data, updated_at: l.updated_at || new Date(Date.now() - 86400000).toISOString() });
  return { accounts, lignes: m, ecritures: [], lectures: [] };
}
const json = (route, status, body, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers: Object.assign({ 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, headers), body: typeof body === 'string' ? body : JSON.stringify(body) }).catch(() => {});

function brancher(page, base, { faute = null, nom = '' } = {}) {
  return page.route('**/rest/v1/**', async (route) => {
    const req = route.request(); const urlBrute = req.url(); const meth = req.method();
    const u = decodeURIComponent(urlBrute);
    const f = faute ? faute(u, meth, req) : null;
    if (f && f.delai) await new Promise((r) => setTimeout(r, f.delai));
    if (f && f.coupe) return route.abort('internetdisconnected').catch(() => {});
    if (f && f.status) return route.fulfill({ status: f.status, contentType: f.html ? 'text/html' : 'application/json', body: f.body || (f.html ? '<html><body>error code: ' + f.status + '</body></html>' : '{"message":"panne de banc"}') }).catch(() => {});
    const uu = metaVersData(urlBrute);
    const params = parametres(uu);
    if (/\/rest\/v1\/vinted_accounts/.test(uu)) { if (meth === 'GET') return json(route, 200, base.accounts); return json(route, 204, ''); }
    if (!/\/rest\/v1\/app_data/.test(uu)) return json(route, 200, []);
    if (meth === 'GET' || meth === 'HEAD') {
      const sel = (params.find(([k]) => k === 'select') || [])[1] || '*';
      if (sel === 'owner' && params.some(([k, v]) => k === 'limit')) return json(route, 200, [{ owner: 'banc' }]);
      let L = filtrer([...base.lignes.values()], params).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const total = L.length;
      const range = req.headers()['range'] || '';
      let from = 0, to = Math.min(total, 1000) - 1;
      const mr = /^(\d+)-(\d+)$/.exec(range);
      if (mr) {
        from = Number(mr[1]);
        if (from > 0 && from >= total) return json(route, 416, { message: 'Requested range not satisfiable' }, { 'content-range': `*/${total}` });
        to = Math.min(Number(mr[2]), from + 999, total - 1);
      }
      let page = L.slice(from, to + 1);
      const lim = params.find(([k]) => k === 'limit'); if (lim) page = page.slice(0, Number(lim[1]));
      base.lectures.push({ at: Date.now(), url: u, range, n: page.length, page: nom });
      return json(route, 200, page.map((r) => projette({ ...r, owner: r.owner }, sel)), { 'content-range': `${from}-${from + page.length - 1}/${total}` });
    }
    let corps = null; try { corps = JSON.parse(req.postData() || 'null'); } catch (_) {}
    const prefer = req.headers()['prefer'] || '';
    const ecr = { at: Date.now(), meth, url: u, corps, page: nom, resultat: null };
    base.ecritures.push(ecr);
    const now = new Date().toISOString();
    if (meth === 'POST') {
      const lot = [].concat(corps || []);
      const fusion = /resolution=merge-duplicates/.test(prefer);
      for (const x of lot) if (x && x.id && base.lignes.has(x.id) && !fusion) { ecr.resultat = 409; return json(route, 409, { code: '23505', message: 'duplicate key value violates unique constraint' }); }
      for (const x of lot) {
        if (!x || !x.id) continue;
        const ancien = base.lignes.get(x.id);
        if (x.id === 'main' && ancien) { const g = gardeMain(ancien.data, x.data); if (g) { ecr.resultat = g; return json(route, 400, { code: 'P0001', message: g }); } }
        base.lignes.set(x.id, { id: x.id, data: x.data, updated_at: x.updated_at || now });
      }
      ecr.resultat = 201;
      return json(route, 201, /return=representation/.test(prefer) ? lot : '');
    }
    if (meth === 'PATCH') {
      const cibles = filtrer([...base.lignes.values()], params);
      for (const c of cibles) if (c.id === 'main' && corps && corps.data) { const g = gardeMain(c.data, corps.data); if (g) { ecr.resultat = g; return json(route, 400, { code: 'P0001', message: g }); } }
      for (const c of cibles) { if (corps && corps.data !== undefined) c.data = corps.data; c.updated_at = (corps && corps.updated_at) || now; }
      ecr.resultat = cibles.length;
      const sel = (params.find(([k]) => k === 'select') || [])[1] || '*';
      return json(route, 200, /return=representation/.test(prefer) ? cibles.map((r) => projette(r, sel)) : '');
    }
    if (meth === 'DELETE') { ecr.resultat = 0; return json(route, 200, []); }   // comme la vraie base : DELETE n'efface rien sur app_data
    return json(route, 200, []);
  });
}

// ── LA LIGNE `main` SEULE, À LA VRAIE FORME, POUR LES BANCS À ROUTES PROPRES (5 nov.) ──
// Les bancs écrits avant le 1er nov. comptaient un corps `[{ id: 'main', data }]`
// (l'ancien upsert) et répondaient `[]` à toute écriture. Depuis 5d7b34f4 l'app
// écrit `main` par un PATCH CONDITIONNEL (`id=eq.main&…&data->>rev=is.null|eq.N`,
// corps `{ data, updated_at }` sans `id`, `return=representation`) : ces bancs
// lisaient « 0 écriture » (un contrôle « rien de fautif sur 0 » ne peut pas
// échouer) et l'app se croyait devancée. `routeMain` rend la réponse de la vraie
// base pour la ligne `main` — lecture projetée, PATCH conditionnel jugé sur
// `data.rev`, insertion (409 si elle existe), garde-fou 017 (`gardeMain`) — et
// GARDE ce qu'elle accepte. Chaque tentative est notée dans `etat.ecritures`
// (`{ meth, data, resultat }` : 1 écrite · 0 devancée · 201 · 409 · code 017 ·
// 500 panne), écrite ou non : un banc juge ce que l'app ENVOIE.
// `etat` = { main: data|null, maj: iso, ecritures: [], panne?: (meth) => bool,
//            refuser?: (meth, data) => code|null, clesServeur?: [clé…] }.
// Rend `null` si la requête ne touche pas `main` (le banc la sert lui-même).
function routeMain(req, etat) {
  const meth = req.method(); const urlBrute = req.url();
  const u = decodeURIComponent(urlBrute);
  if (!/\/rest\/v1\/app_data\?/.test(u)) return null;
  const surMain = /[?&]id=eq\.main(&|$)/.test(u);
  const prefer = (req.headers()['prefer'] || '');
  const repr = /return=representation/.test(prefer);
  const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '*';
  const ligne = () => ({ id: 'main', data: etat.main, updated_at: etat.maj || null });
  if (meth === 'GET' || meth === 'HEAD') {
    if (!surMain) return null;
    return { status: 200, body: etat.main == null ? [] : [projette(ligne(), sel)] };
  }
  let corps = null; try { corps = JSON.parse(req.postData() || 'null'); } catch (_) {}
  let data;
  if (meth === 'PATCH' && surMain) data = corps && corps.data;
  else if (meth === 'POST') { const l = [].concat(corps || []).find((x) => x && x.id === 'main'); if (!l) return null; data = l.data; }
  else return null;
  const note = (resultat) => { etat.ecritures.push({ meth, data, resultat }); };
  if (etat.panne && etat.panne(meth)) { note(500); return { status: 500, body: { code: '57014', message: 'canceling statement due to statement timeout' } }; }
  // Un refus imposé par le banc (un garde-fou de la base qu'il émule lui-même,
  // ex. `vrm_numeros_perimes`) : le même 400 P0001 que la vraie base.
  const refus = etat.refuser ? etat.refuser(meth, data) : null;
  if (refus) { note(refus); return { status: 400, body: { code: 'P0001', message: refus, details: 'banc', hint: 'Recharge l\'app.' } }; }
  // Les clés que seul le serveur écrit (ex. `vrm_numerotation`) sont gardées
  // telles quelles, comme le fait le déclencheur de la vraie base.
  const garderServeur = (d) => { if (!etat.clesServeur || !d || !etat.main) return d; const o = { ...d }; for (const k of etat.clesServeur) { if (etat.main[k] !== undefined) o[k] = etat.main[k]; else delete o[k]; } return o; };
  if (meth === 'PATCH') {
    const m = /[?&]data->>rev=(is\.null|eq\.(\d+))(&|$)/.exec(u);
    const rev = etat.main != null && Number.isSafeInteger(etat.main.rev) ? etat.main.rev : null;
    const passe = etat.main != null && data != null && (!m || (m[1] === 'is.null' ? rev == null : rev === Number(m[2])));
    if (!passe) { note(0); return { status: 200, body: repr ? [] : '' }; }
    const g = gardeMain(etat.main, data); if (g) { note(g); return { status: 400, body: { code: 'P0001', message: g } }; }
    etat.main = garderServeur(data); etat.maj = (corps && corps.updated_at) || new Date().toISOString(); note(1);
    return { status: 200, body: repr ? [projette(ligne(), sel)] : '' };
  }
  const fusion = /resolution=merge-duplicates/.test(prefer);
  if (etat.main != null && !fusion) { note(409); return { status: 409, body: { code: '23505', message: 'duplicate key value violates unique constraint' } }; }
  if (etat.main != null) { const g = gardeMain(etat.main, data); if (g) { note(g); return { status: 400, body: { code: 'P0001', message: g } }; } }
  etat.main = garderServeur(data); etat.maj = new Date().toISOString(); note(201);
  return { status: 201, body: repr ? [{ id: 'main', data }] : '' };
}
// Les tentatives d'écriture de `main` (avec un `data`) — ce qu'un banc juge.
const ecritesMain = (etat) => etat.ecritures.filter((e) => e.data && typeof e.data === 'object').map((e) => e.data);

const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
async function lancer() {
  return chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
}
// Un appareil = un contexte (son propre navigateur, son propre localStorage).
async function appareil(nav, base, { vp = { width: 1512, height: 900 }, faute = null, nom = '', init = {} } = {}) {
  const ctx = await nav.newContext(Object.assign({ viewport: vp, timezoneId: 'Europe/Paris', locale: 'fr-FR' }, vp.width < 700 ? { isMobile: true, hasTouch: true } : {}));
  await ctx.addInitScript((init) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('schema_cloisonne', '1'); for (const [k, v] of Object.entries(init || {})) if (localStorage.getItem(k) == null) localStorage.setItem(k, v); } catch (_) {}
  }, init);
  const etat = { faute };
  const pages = [];
  const ouvrir = async (nomPage) => {
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => { const u = r.request().url(); if (/\/rest\/v1\/|\/auth\/v1\//.test(u)) return r.fallback(); return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });
    await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"pret":true}' }));
    await brancher(pg, base, { faute: (u, m, q) => (etat.faute ? etat.faute(u, m, q) : null), nom: nomPage || nom });
    pages.push(pg);
    return { pg, errs };
  };
  return { ctx, ouvrir, etat, pages, fermer: () => ctx.close() };
}
const ecrituresMain = (base, depuis = 0) => base.ecritures.filter((e) => e.at >= depuis && (/app_data\?id=eq\.main/.test(e.url) || [].concat(e.corps || []).some((x) => x && x.id === 'main')));
const dataMain = (base) => { const l = base.lignes.get('main'); return l ? l.data : null; };
const attendre = async (pred, ms = 8000, pas = 100) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await pred()) return true; } catch (_) {} await new Promise((r) => setTimeout(r, pas)); } return false; };
module.exports = { serveur, creerBase, brancher, lancer, appareil, ecrituresMain, dataMain, attendre, reLike, cleNum, routeMain, ecritesMain, gardeMain };
