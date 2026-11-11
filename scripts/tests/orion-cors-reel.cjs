#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  « COMME ORION » — le VRAI `background.js` parle aux VRAIS gestionnaires de
//  vrm.center à travers les règles CORS d'un navigateur WebKit (8 nov.)
//
//  Deux jours sans rien sur son iPhone : Chrome laisse un service worker
//  d'extension appeler vrm.center sans contrôle CORS, ORION (WebKit) non — un
//  `POST` avec `Authorization` ou du JSON part d'abord en PRÉALABLE `OPTIONS`,
//  et sans `Access-Control-Allow-Origin` (ni les en-têtes et la méthode
//  permis) l'envoi réel ne part jamais : l'extension voit « réseau ».
//  Aucun WebKit dans le conteneur (Playwright n'a que Chromium) : ce banc
//  applique LES RÈGLES du navigateur dans un faux `fetch` — préalable pour tout
//  envoi non « simple », réponse 2xx exigée, origine renvoyée, méthode et
//  en-têtes demandés permis ; puis la réponse réelle doit porter
//  `Access-Control-Allow-Origin`, sinon elle n'est pas rendue (« réseau »).
//   1. Chaque adresse vrm.center/api/… que `background.js` appelle mène à un
//      gestionnaire qui passe le préalable d'Orion (compte, relais, push).
//   2. Le VRAI fond envoie les ventes légères (compte?mode=commandes) : rangées.
//   3. Le VRAI `appelVrmTransp` (relais) et l'envoi d'une notification (push,
//      les en-têtes du fond) : la réponse arrive (pas « réseau »).
//  Doit ÉCHOUER sur les gestionnaires d'avant la correction CORS :
//    --racine <arbre>  : charge api/ depuis un autre arbre (git archive 4f5c3e94^).
//  Données inventées (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs');
const { pathToFileURL } = require('url');
const { faireFond, projette } = require('../_fond-vm.cjs');
const iR = process.argv.indexOf('--racine');
const RACINE = iR > 0 ? path.resolve(process.argv[iR + 1]) : path.join(__dirname, '..', '..');
const BG = path.join(__dirname, '..', '..', 'vinted-sync-extension', 'background.js');
const ORIGINE = 'safari-web-extension://3F1C2A9E-ORION';
const OWNER = '0b0b0b0b-1111-4222-8333-444455556666';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? ' — ' + d : '')); } };

// ── La fausse base vue du SERVEUR (son `fetch`) : la même `lignes` que le fond.
const R = (status, body) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => 'application/json' }, json: async () => (typeof body === 'string' ? JSON.parse(body) : body), text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
function fetchServeur(lignes) {
  return async (url, o = {}) => {
    const u = decodeURIComponent(String(url)), m = String(o.method || 'GET').toUpperCase();
    if (/\/auth\/v1\/user/.test(u)) return R(200, { id: OWNER, email: 'banc@vrm.test', email_confirmed_at: '2026-01-01' });
    if (/app_data\?select=owner&limit=1/.test(u)) return R(200, []);
    if (!/\/rest\/v1\//.test(u)) return R(404, {});
    const id = (/[?&]id=eq\.([^&]+)/.exec(u) || [])[1];
    if (m === 'GET') { const sel = (/[?&]select=([^&]+)/.exec(u) || [])[1] || ''; return R(200, id && lignes[id] !== undefined ? [projette({ id, data: lignes[id] }, sel)] : []); }
    if (m === 'PATCH') { if (!id || lignes[id] === undefined) return R(200, []); lignes[id] = JSON.parse(o.body).data; return R(200, [{ id }]); }
    if (m === 'POST') { const c = JSON.parse(o.body); const r0 = Array.isArray(c) ? c[0] : c; if (r0 && r0.id && lignes[r0.id] !== undefined && !/merge-duplicates/.test(JSON.stringify(o.headers || {}))) return R(409, {}); if (r0 && r0.id) lignes[r0.id] = r0.data; return R(201, ''); }
    return R(404, {});
  };
}
const ROUTES = { compte: 'api/compte.js', relais: 'api/relais.js', push: 'api/push.js', 'vinted-connect': 'api/vinted-connect.js' };   // (11 nov.) + la liaison serveur (5.332)
const handlers = {};
// Un appel au VRAI gestionnaire (forme Vercel : req.query, req.headers, req.body).
async function appeler(route, { method, headers, body, query }, lignes) {
  const h = {}; const res = { statusCode: 200, headers: h, corps: undefined, setHeader(k, v) { h[String(k).toLowerCase()] = v; }, getHeader(k) { return h[String(k).toLowerCase()]; },
    status(c) { this.statusCode = c; return this; }, json(b) { this.corps = b; this.fini = true; return this; }, send(b) { this.corps = b; this.fini = true; return this; }, end(b) { if (b !== undefined) this.corps = b; this.fini = true; } };
  const req = { method, headers, query, body, url: '/' + ROUTES[route] };
  const avant = globalThis.fetch; globalThis.fetch = fetchServeur(lignes);
  try { await handlers[route](req, res); } catch (e) { res.statusCode = 500; res.corps = { erreur: String(e && e.message || e) }; }
  finally { globalThis.fetch = avant; }
  return res;
}
// LES RÈGLES D'UN NAVIGATEUR WEBKIT pour un `fetch` d'extension vers une autre origine.
const SIMPLES = new Set(['accept', 'accept-language', 'content-language']);
const TYPES_SIMPLES = /^(application\/x-www-form-urlencoded|multipart\/form-data|text\/plain)\b/i;
const journal = [];
async function fetchOrion(url, opts, lignes) {
  const u = new URL(url);
  const route = (/^\/api\/(compte|relais|push|vinted-connect)$/.exec(u.pathname) || [])[1];
  if (!route) { journal.push({ url, refus: 'route inconnue' }); return { reseau: true }; }
  const method = String(opts.method || 'GET').toUpperCase();
  const hs = {}; for (const [k, v] of Object.entries(opts.headers || {})) hs[k.toLowerCase()] = String(v);
  const nonSimples = Object.keys(hs).filter((k) => !(SIMPLES.has(k) || (k === 'content-type' && TYPES_SIMPLES.test(hs[k]))));
  const query = Object.fromEntries(u.searchParams);
  if (!['GET', 'HEAD', 'POST'].includes(method) || nonSimples.length) {
    const pre = await appeler(route, { method: 'OPTIONS', query, headers: { origin: ORIGINE, 'access-control-request-method': method, 'access-control-request-headers': nonSimples.join(',') } }, lignes);
    const acao = pre.getHeader('access-control-allow-origin'), am = String(pre.getHeader('access-control-allow-methods') || ''), ah = String(pre.getHeader('access-control-allow-headers') || '').toLowerCase();
    const okPre = pre.statusCode >= 200 && pre.statusCode < 300 && (acao === ORIGINE || acao === '*')
      && (['GET', 'HEAD', 'POST'].includes(method) || am.toUpperCase().split(/\s*,\s*/).includes(method)) && nonSimples.every((k) => ah === '*' || ah.split(/\s*,\s*/).includes(k));
    if (!okPre) { journal.push({ url, refus: `préalable ${pre.statusCode} · ACAO=${acao || '∅'}` }); return { reseau: true }; }
  }
  let body = opts.body; try { body = body ? JSON.parse(body) : undefined; } catch (_) {}
  const res = await appeler(route, { method, query, body, headers: Object.assign({ origin: ORIGINE }, hs) }, lignes);
  const acao = res.getHeader('access-control-allow-origin');
  if (!(acao === ORIGINE || acao === '*')) { journal.push({ url, refus: `réponse ${res.statusCode} sans Access-Control-Allow-Origin` }); return { reseau: true }; }
  journal.push({ url, statut: res.statusCode });
  return { status: res.statusCode, body: res.corps === undefined ? {} : res.corps };
}

(async () => {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
  for (const [k, f] of Object.entries(ROUTES)) {
    try { handlers[k] = (await import(pathToFileURL(path.join(RACINE, f)).href)).default; }
    catch (e) { dit(false, `${f} se charge`, String(e.message).slice(0, 120)); }
  }
  console.log(`── 1. Chaque adresse vrm.center que le fond appelle passe le préalable d’Orion (${path.relative(process.cwd(), RACINE) || '.'})`);
  const src = fs.readFileSync(BG, 'utf8');
  const adresses = [...new Set([...src.matchAll(/https:\/\/vrm\.center\/api\/([a-z-]+)(\?mode=([a-z-]+))?/g)].map((m) => m[1] + (m[3] ? '?mode=' + m[3] : '')))];
  dit(adresses.length >= 3, `adresses lues dans background.js : ${adresses.join(', ')}`);
  for (const a of adresses) {
    const route = a.split('?')[0];
    dit(!!ROUTES[route], `${a} : un gestionnaire connu`);
    if (!ROUTES[route]) continue;
    const r = await fetchOrion('https://vrm.center/api/' + a, { method: 'POST', headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' }, body: '{}' }, {});
    dit(!r.reseau, `${a} : préalable OPTIONS accepté et réponse lisible`, JSON.stringify(journal[journal.length - 1]));
  }

  console.log('── 2. Le VRAI fond envoie ses ventes LÉGÈRES à travers Orion');
  {
    const TX0 = 15800000000, H = 3600e3;
    const v = (i) => ({ transaction_id: TX0 + i, conversation_id: 21900000000 + i, item_id: 5100000000 + i, title: `Paire ${i}`, price: { amount: '50.0', currency_code: 'EUR' }, status: 'La commande est finalisée.', transaction_user_status: 'completed', date: new Date(Date.parse('2026-11-05T07:50:12Z') - i * H).toISOString(), photo: { url: `https://images1.vinted.net/t/x_${i}.webp`, high_resolution: { timestamp: 1762300000 + i } } });
    const allege = (o) => ({ date: o.date, price: o.price, title: o.title, status: o.status, transaction_id: o.transaction_id, conversation_id: o.conversation_id, transaction_user_status: o.transaction_user_status, item_id: o.item_id, photo: o.photo });
    const base = Array.from({ length: 600 }, (_, k) => v(k + 1));
    const chez = [v(0)].concat(base);
    const ROW = 'harvest_111_orders_sold';
    let f = null;
    const vrm = (e) => fetchOrion(e.url, { method: e.methode, headers: e.headers, body: e.corps == null ? undefined : JSON.stringify(e.corps) }, f.lignes);
    f = faireFond({ src: BG, vrm, lignes: { [ROW]: { type: 'orders_sold', uid: '111', capturedAt: new Date(Date.now() - 2 * H).toISOString(), nItems: 600, payload: { pagination: { total_entries: 601 }, my_orders: base.map(allege) }, resume: { n: 600, txns: [] } } },
      vinted: (req) => { const m = /\/api\/v2\/my_orders\?type=sold&page=(\d+)&per_page=(\d+)/.exec(req.chemin); if (!m) return { status: 404, body: {} }; const p = +m[1], n = +m[2]; return { status: 200, body: { my_orders: chez.slice((p - 1) * n, p * n), pagination: { current_page: p, per_page: n, total_pages: Math.ceil(601 / n), total_entries: 601 } } }; } });
    const n0 = journal.length;
    const r = await f.ctx.rafraichirVentes('111');
    const envois = journal.slice(n0).filter((x) => /mode=commandes/.test(x.url));
    dit(envois.length >= 1 && envois.every((x) => !x.refus), 'chaque envoi léger passe le préalable et revient', JSON.stringify(envois.slice(0, 2)));
    dit(r && r.ecrit === true && f.lignes[ROW].payload.my_orders.some((o) => o.transaction_id === TX0), 'la vente neuve est RANGÉE (pas « réseau »)', JSON.stringify(r));
    const fl = (f.store.vrmFlux || {}).vinted || {};
    dit(!(fl.koAt > (fl.okAt || 0)), 'la carte du logo : aucun refus');
  }

  console.log('── 3. Relais (transporteur) et notification (push), avec les en-têtes du fond');
  {
    const lignes = {};
    const f = faireFond({ src: BG, vrm: (e) => fetchOrion(e.url, { method: e.methode, headers: e.headers, body: e.corps == null ? undefined : JSON.stringify(e.corps) }, lignes) });
    const n0 = journal.length;
    const r = await f.ctx.appelVrmTransp('transp-a-lire', 'jeton.banc', undefined).catch((e) => ({ erreur: String(e) }));
    const t = journal.slice(n0).find((x) => /api\/relais/.test(x.url));
    dit(t && !t.refus, 'relais (GET avec Authorization) : préalable accepté, réponse lue', JSON.stringify({ t, r }).slice(0, 200));
    const p = await fetchOrion('https://vrm.center/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jeton.banc' }, body: JSON.stringify({ action: 'retrait', tx: '1' }) }, lignes);
    dit(!p.reseau, 'push (POST JSON avec Authorization) : préalable accepté, réponse lue', JSON.stringify(journal[journal.length - 1]));
  }
  console.log('── 4. Une autre origine (un site) n’est pas servie');
  {
    const pre = await appeler('compte', { method: 'OPTIONS', query: { mode: 'commandes' }, headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' } }, {});
    dit(!pre.getHeader('access-control-allow-origin'), 'aucun Access-Control-Allow-Origin pour https://evil.example');
  }
  console.log(ko ? `\n❌ orion-cors-reel : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ orion-cors-reel : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
