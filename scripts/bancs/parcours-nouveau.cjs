// ════════════════════════════════════════════════════════════════════════════
//  BANC « PARCOURS D'UN NOUVEAU » (15 nov., Julien : « Améliore le parcours… un onglet
//  dans le compte admin pour voir ce que ceux qui créent des comptes auront… "Signaler
//  un problème" qui t'arrive vraiment »). Récit : docs/passation/2026-11-15-parcours-nouveau.md
//
//  Sur une base INVENTÉE (aucune donnée réelle, aucune requête hors de la machine), à 390
//  tactile (iPhone) ET 1512, clair ET sombre :
//   P  LE PARCOURS joué d'une traite, comme un vrai nouveau : la vitrine, « Essayer
//      gratuitement », l'inscription, puis l'app d'un compte NEUF : le parcours en huit
//      étapes s'ouvre SEUL (ni Bienvenue, ni la visite, ni « Ma configuration » derrière),
//      chaque étape a UN plein, rien ne déborde, cibles 44 px ; « Où vends-tu ? » et « qui
//      numérote » s'ÉCRIVENT dans SA base (`vrm_plateformes_affichees`, `vrm_numero_ecrit`) ;
//      un rechargement reprend à la même étape ; « C'est parti » ferme, Ma journée sans
//      « Configure VRM » ni Bienvenue derrière ; sur iPhone, Orion + le raccourci.
//   A  L'ONGLET ADMIN « Nouveaux comptes » : monté pour le PROPRIÉTAIRE seulement ; un autre
//      compte ne le voit pas ET la route (le VRAI code serveur, api/_lib/parcours-comptes.js)
//      lui répond 403 ; l'aperçu (cadre bac à sable) montre chaque étape (vitrine,
//      inscription, parcours) en téléphone et ordinateur ; AUCUNE requête du cadre ne quitte
//      la page (toutes les requêtes interceptées : 0 vers la base, 0 vers /api, 0 écriture),
//      le stockage du propriétaire est INCHANGÉ, sa base ne reçoit rien ; le tableau anonyme
//      rend les nombres du vrai calcul (aucun e-mail, aucun identifiant dans la réponse).
//   S  UN SIGNALEMENT d'un AUTRE compte, de bout en bout, par les VRAIES règles serveur
//      (api/_lib/signalement.js) : rangé chez le propriétaire, NOTIFICATION au propriétaire,
//      visible dans son onglet « Signalements », il RÉPOND, la réponse est rangée, une
//      notification part vers l'auteur, qui voit « Reçu » puis la réponse dans « Mes
//      signalements ». Un autre compte ne peut ni lister ni répondre (403).
//  `SHOTS=<dossier>` (défaut : scripts/bancs/captures/parcours-nouveau, jamais commité) ;
//  `LARGEURS=390` `THEMES=clair` `PARTIES=P,A,S` pour un sous-ensemble ; `BANC_DIST=<dist>`
//  pour juger un autre arbre (l'arbre de départ doit être ROUGE).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs');
const { pathToFileURL } = require('url');
const PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { lancer } = require('./_navigateur.cjs');
const V = require('./_vercel.cjs');
const RAC = path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(RAC, 'dist');
const PORT = Number(process.env.BANC_PORT) || 4991;
const ORIGINE = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || path.join(__dirname, 'captures', 'parcours-nouveau');
fs.mkdirSync(SHOTS, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
// (20 nov.) La partie P (le parcours) vit dans scripts/bancs/demarrage-parcours.cjs (« Bien démarrer », six pages poussées).
const PARTIES = liste('PARTIES', 'A,S');
const RACINE_API = process.env.BANC_API_RACINE || RAC;   // le code serveur jugé (mutations : une copie)

let ko = 0; const defauts = [];
const dit = (bon, quoi, det) => { if (!bon) { ko++; defauts.push(quoi + (det ? ' — ' + det : '')); } console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 300) : ''}`); };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// ── LES COMPTES INVENTÉS ────────────────────────────────────────────────────
const PROPRIO = '0a0a0a0a-1111-4000-8000-00000000aaaa';
const NOUVEAU = '0b0b0b0b-2222-4000-8000-00000000bbbb';
const AUTRE = '0c0c0c0c-3333-4000-8000-00000000cccc';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jeton = (uid) => `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: uid, role: 'authenticated', aud: 'authenticated' })}.banc`;
const session = (uid, email) => ({ access_token: jeton(uid), refresh_token: 'r', totp: [], expires_at: Date.now() + 864e5, user: { id: uid, email, totp: [], created_at: new Date(Date.now() - 60000).toISOString() } });
const uidDuJeton = (h) => { try { const t = String(h || '').replace(/^Bearer\s+/i, ''); return JSON.parse(Buffer.from(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()).sub; } catch (_) { return null; } };

// ── LE « SERVEUR » : une base PostgREST inventée, pour les VRAIES règles serveur ──
// (api/_lib/signalement.js, api/_lib/parcours-comptes.js), lues avec la clé de service.
const SDB = { app_data: [], comptesAuth: [], vinted_accounts: [], abonnements: [], pousses: [] };
function inventerInscrits() {
  const j = (n) => Date.now() - n * 864e5;
  const u = (i) => `9e9e9e9e-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`;
  SDB.comptesAuth = [{ id: PROPRIO, created_at: new Date(j(90)).toISOString(), email: 'proprio@vrm.invalid' },
    ...[1, 2, 3, 4, 5, 6, 7].map((i) => ({ id: u(i), created_at: new Date(j(i * 4)).toISOString(), email: `client${i}@exemple.invalid` })),
    { id: AUTRE, created_at: new Date(j(1)).toISOString(), email: 'autre@exemple.invalid' }];
  SDB.app_data = [
    ...[1, 2, 3, 4, 5, 6].map((i) => ({ owner: u(i), id: 'main', data: i <= 2 ? { vrm_parcours_nouveau: { etape: i === 1 ? 'extension' : 'abonnement', fini: i === 2 } } : {} })),
    { owner: u(1), id: 'ext_appareil_ab12', data: {} },
    { owner: u(3), id: 'harvest_123_listings', data: {} }, { owner: u(3), id: 'harvest_123_orders_sold', data: {} },
    { owner: u(4), id: 'lbc_accounts', data: {} },
  ];
  SDB.vinted_accounts = [{ owner: u(3) }, { owner: u(5) }];
  SDB.abonnements = [{ owner: u(3), statut: 'trialing', mode_test: false }, { owner: u(5), statut: 'active', mode_test: true }];
}
const proj = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], al = m[1] || src.split(/->>|->/).pop();
    if (src === 'id' || src === 'owner') { out[al] = row[src]; continue; }
    if (src === 'data') { out[al] = row.data; continue; }
    if (!/^data/.test(src)) { out[al] = row[src] === undefined ? null : row[src]; continue; }
    let v = row.data; for (const s of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[s];
    out[al] = v == null ? null : (src.includes('->>') ? (typeof v === 'object' ? JSON.stringify(v) : String(v)) : v);
  }
  return out;
};
const comme = (motif) => new RegExp('^' + String(motif).replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');
function filtrer(rows, q) {
  let r = rows;
  for (const [k, v] of q.entries()) {
    if (['select', 'order', 'limit', 'on_conflict'].includes(k)) continue;
    if (k === 'or') {
      const alts = v.replace(/^\(|\)$/g, '').match(/id\.(like|in|eq)\.(\([^)]*\)|[^,]+)/g) || [];
      r = r.filter((x) => alts.some((a) => { const m = /^id\.(like|in|eq)\.(.*)$/.exec(a); if (m[1] === 'like') return comme(m[2]).test(x.id); if (m[1] === 'in') return m[2].replace(/^\(|\)$/g, '').split(',').includes(x.id); return x.id === m[2]; }));
      continue;
    }
    const m = /^(eq|like|gte|in)\.(.*)$/.exec(v); if (!m) continue;
    const lire = (x) => { if (!k.startsWith('data')) return x[k]; let o = x.data; for (const s of k.replace(/^data(->>|->)/, '').split(/->>|->/)) o = o == null ? null : o[s]; return o == null ? null : String(o); };
    r = r.filter((x) => { const a = lire(x); if (m[1] === 'eq') return String(a) === m[2]; if (m[1] === 'like') return comme(m[2]).test(String(a)); if (m[1] === 'gte') return String(a) >= decodeURIComponent(m[2]); if (m[1] === 'in') return m[2].replace(/^\(|\)$/g, '').split(',').includes(String(a)); return true; });
  }
  const o = q.get('order'); if (o && /data->>at\.desc/.test(o)) r = [...r].sort((a, b) => String((b.data || {}).at || '').localeCompare(String((a.data || {}).at || '')));
  return r;
}
const rep = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => corps });
async function fakeFetcher(url, init = {}) {
  const u = new URL(url), m = String(init.method || 'GET').toUpperCase();
  if (u.pathname === '/auth/v1/admin/users') { const p = Number(u.searchParams.get('page') || 1); return rep(200, { users: p === 1 ? SDB.comptesAuth : [] }); }
  if (u.pathname === '/rest/v1/vrm_reglages') return rep(200, [{ valeur: PROPRIO }]);
  const table = u.pathname.replace('/rest/v1/', '');
  const q = u.searchParams;
  const rangee = (init.headers && (init.headers.Range || init.headers.range)) || '';
  const page = (rows) => { const r = /^(\d+)-(\d+)$/.exec(rangee); return r ? rows.slice(Number(r[1]), Number(r[2]) + 1) : rows; };
  if (table === 'vinted_accounts' || table === 'abonnements') return rep(200, page(filtrer(SDB[table].map((x) => ({ ...x, data: {} })), q).map((x) => proj(x, q.get('select')))));
  if (table !== 'app_data') return rep(200, []);
  if (m === 'POST') {
    const lignes = JSON.parse(init.body || '[]');
    const ignore = /ignore-duplicates/.test(String((init.headers || {}).Prefer || ''));
    const faites = [];
    for (const l of lignes) { const i = SDB.app_data.findIndex((x) => x.owner === l.owner && x.id === l.id); if (i >= 0) { if (ignore) continue; SDB.app_data[i] = l; } else SDB.app_data.push(l); faites.push(l); }
    return rep(201, faites);
  }
  if (m === 'PATCH') {
    const b = JSON.parse(init.body || '{}'); const rows = filtrer(SDB.app_data, q);
    for (const r of rows) r.data = b.data;
    return rep(200, rows.map((r) => ({ owner: r.owner, id: r.id })));
  }
  let rows = filtrer(SDB.app_data, q);
  if (q.get('limit')) rows = rows.slice(0, Number(q.get('limit')));
  return rep(200, page(rows).map((x) => proj(x, q.get('select'))));
}
const ENV = { SUPABASE_SERVICE_KEY: 'cle-de-banc', SUPABASE_URL: 'https://base.banc.invalid', VRM_OWNER_UID: PROPRIO };

// ── LA ROUTE /api/compte DU BANC : l'aiguillage d'api/compte.js, sur les VRAIES règles ──
let REGLES = null;
async function chargerRegles() {
  const imp = (f) => import(pathToFileURL(path.join(RACINE_API, f)).href);
  const sig = await imp('api/_lib/signalement.js');
  let pc = null; try { pc = await imp('api/_lib/parcours-comptes.js'); } catch (_) {}
  REGLES = { sig, pc };
}
async function routeApi(route) {
  const req = route.request(); const u = new URL(req.url()); const mode = u.searchParams.get('mode') || '';
  const uid = uidDuJeton(req.headers().authorization);
  const json = (code, corps) => route.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(corps) });
  if (u.pathname !== '/api/compte') return json(200, {});
  if (mode === 'confidentialite') return json(200, { ok: true, uid });
  if (mode === 'abonnement') return json(200, { ok: true, proprietaire: uid === PROPRIO, acces: true });
  if (!uid) return json(401, { ok: false, raison: 'session' });
  const utilisateur = { id: uid, email: uid === AUTRE ? 'autre@exemple.invalid' : 'x@exemple.invalid' };
  if (mode === 'pilotage' && u.searchParams.get('quoi') === 'parcours') {
    if (!REGLES.pc) return json(404, { ok: false });
    const r = await REGLES.pc.routeParcoursComptes({ utilisateur, env: ENV, fetcher: fakeFetcher });
    return json(r.code, r.corps);
  }
  if (mode === 'signalement') {
    const S = REGLES.sig;
    if (req.method() === 'GET' && u.searchParams.get('quoi') === 'suivi') { if (!S.suiviSignalements) return json(404, { ok: false }); const r = await S.suiviSignalements({ utilisateur, env: ENV, fetcher: fakeFetcher }); return json(r.code, r.corps); }
    if (req.method() === 'GET') { const r = await S.listerSignalements({ utilisateur, unId: u.searchParams.get('id'), env: ENV, fetcher: fakeFetcher }); return json(r.code, r.corps); }
    const corps = JSON.parse(req.postData() || '{}');
    if (corps.action === 'traite') { const r = await S.marquerTraite({ utilisateur, corps, env: ENV, fetcher: fakeFetcher }); return json(r.code, r.corps); }
    // (16 nov., satisfaction-clients) reçu · en cours · corrigé : le VRAI code serveur, la notification au passage à « corrigé ».
    if (corps.action === 'etat') {
      if (!S.changerEtatSignalement) return json(400, { ok: false, raison: 'action' });
      const r = await S.changerEtatSignalement({ utilisateur, corps, env: ENV, fetcher: fakeFetcher });
      if (r.code === 200 && r.prevenir) { SDB.pousses.push({ a: r.de, notif: S.notifCorrige({ mot: r.mot }) }); r.corps.notifie = true; }
      return json(r.code, r.corps);
    }
    if (corps.action === 'repondre') {
      if (!S.repondreSignalement) return json(400, { ok: false });
      const r = await S.repondreSignalement({ utilisateur, corps, env: ENV, fetcher: fakeFetcher });
      if (r.code === 200 && r.de) { SDB.pousses.push({ a: r.de, notif: S.notifReponse({ reponse: r.reponse }) }); r.corps.notifie = true; }
      return json(r.code, r.corps);
    }
    const r = await S.envoyerSignalement({ utilisateur, corps, env: ENV, fetcher: fakeFetcher, pousser: async (notif, proprio) => { SDB.pousses.push({ a: proprio, notif }); return { sent: 1 }; } });
    return json(r.code, r.corps);
  }
  return json(200, {});
}

// ── LA BASE DE L'APP (ce que le navigateur lit et écrit) : une par compte ──
function baseApp(uid) { return { uid, lignes: [], comptes: [], ecritures: [] }; }
async function brancherBase(pg, base) {
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: jeton(base.uid), refresh_token: 'r', expires_in: 3600, user: { id: base.uid, email: 'x@exemple.invalid' } }) }));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), m = req.method();
    const u = new URL(req.url());
    const json = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, (Array.isArray(d) ? d.length : 1) - 1)}/${Array.isArray(d) ? d.length : 1}` }, body: JSON.stringify(d) });
    if (/\/rpc\//.test(u.pathname)) return json(null);
    if (/vinted_accounts/.test(u.pathname)) return json(m === 'GET' ? base.comptes : []);
    if (!/app_data/.test(u.pathname)) return json([]);
    if (m === 'POST' || m === 'PATCH' || m === 'PUT' || m === 'DELETE') {
      base.ecritures.push(m + ' ' + decodeURIComponent(u.search).slice(0, 120));
      try {
        const b = JSON.parse(req.postData() || 'null');
        const rows = Array.isArray(b) ? b : b && b.id ? [b] : [];
        const eq = /(?:^|&)id=eq\.([^&]*)/.exec(decodeURIComponent(u.search.slice(1)));
        if (m === 'PATCH' && eq && b && b.data) rows.push({ id: eq[1], data: b.data });
        for (const r of rows) { if (!r || !r.id) continue; const i = base.lignes.findIndex((x) => x.id === r.id); const data = r.id === 'main' && i >= 0 ? { ...base.lignes[i].data, ...r.data } : r.data; if (i >= 0) base.lignes[i] = { id: r.id, data }; else base.lignes.push({ id: r.id, data }); }
      } catch (_) {}
      return json(m === 'PATCH' ? [{ id: 'main', owner: base.uid }] : [], m === 'POST' ? 201 : 200);
    }
    const q = new URLSearchParams(u.search);
    const rows = filtrer(base.lignes.map((x) => ({ ...x, owner: base.uid })), q).map((x) => proj(x, q.get('select')));
    return json(rows);
  });
  await pg.route('**/api/**', routeApi);
}
async function nouvellePage(nav, { W, sombre, uid, email, ua }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 945 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris', ...(ua ? { userAgent: ua } : {}) });
  const pg = await ctx.newPage();
  const journal = { erreurs: [], requetes: [] };
  pg.on('pageerror', (e) => journal.erreurs.push(String(e.message || e).slice(0, 200)));
  pg.on('request', (r) => journal.requetes.push({ url: r.url(), m: r.method(), cadre: r.frame() && r.frame() !== pg.mainFrame() ? (r.frame().name() || 'cadre') : '' }));
  if (uid) await pg.addInitScript(([s, sombre]) => { try { if (window.top !== window) return; if (!sessionStorage.getItem('banc_init')) { localStorage.clear(); localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id); localStorage.setItem('schema_cloisonne', '1'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); sessionStorage.setItem('banc_init', '1'); } } catch (_) {} }, [session(uid, email), sombre]);
  else await pg.addInitScript((sombre) => { try { if (window.top === window && !sessionStorage.getItem('banc_init')) { localStorage.clear(); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); sessionStorage.setItem('banc_init', '1'); } } catch (_) {} }, sombre);
  return { ctx, pg, journal, tel };
}
// Ce que la personne voit : pleins visibles, débordement, cibles.
const MESURE = (pg, racine) => pg.evaluate((racine) => {
  const R = racine ? document.querySelector(racine) : document.body;
  if (!R) return null;
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight; };
  const pleins = [...R.querySelectorAll('.sb-btn-plein, .vrm-b-primaire')].filter(vis).length;
  // Dépasse à droite ou à gauche (la page ne défile pas : un écran plein `overflow:hidden` cache ce qui sort, il faut le mesurer).
  const deborde = document.documentElement.scrollWidth > innerWidth + 1 || [...R.querySelectorAll('button, a, h1, p, li, img, svg')].filter(vis).some((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; });
  const petits = [...R.querySelectorAll('button, a[href]')].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return [e.textContent.trim().slice(0, 24) || e.getAttribute('aria-label') || '?', Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => Math.min(w, h) < 43 && !/^\s*$/.test(''));
  return { pleins, deborde, petits };
}, racine);

// ════════════════════════════════════════════════════════════════════════════
async function partieParcours(nav, W, theme) {
  const sombre = theme === 'sombre';
  const etq = `[P ${W} ${theme}]`;
  // 1. La vitrine, puis « Essayer gratuitement ».
  {
    const { ctx, pg } = await nouvellePage(nav, { W, sombre });
    await brancherBase(pg, baseApp(NOUVEAU));
    await pg.goto(ORIGINE + '/', { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(1500);
    await pg.screenshot({ path: path.join(SHOTS, `p-${W}-${theme}-00-vitrine.png`) });
    const essai = pg.getByRole('button', { name: /Essayer gratuitement/i }).or(pg.getByRole('link', { name: /Essayer gratuitement/i })).first();
    const aEssai = await essai.count();
    dit(aEssai > 0, `${etq} vitrine : « Essayer gratuitement » est là`);
    if (aEssai) { await essai.click().catch(() => {}); await pg.waitForSelector('input[type="email"]', { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(800); }
    const champ = await pg.locator('input[type="email"]').count();
    dit(champ > 0, `${etq} « Essayer gratuitement » ouvre l'inscription (un champ e-mail)`);
    await pg.screenshot({ path: path.join(SHOTS, `p-${W}-${theme}-01-inscription.png`) });
    await ctx.close();
  }
  // 2. Le compte neuf : le parcours s'ouvre seul.
  const base = baseApp(NOUVEAU);
  const { ctx, pg, journal } = await nouvellePage(nav, { W, sombre, uid: NOUVEAU, email: 'nouvelle@exemple.invalid' });
  await brancherBase(pg, base);
  await pg.goto(ORIGINE + '/?tab=journee', { waitUntil: 'domcontentloaded' });
  const ouvert = await pg.waitForSelector('[data-parcours-nouveau]', { timeout: 25000 }).then(() => true).catch(() => false);
  dit(ouvert, `${etq} un compte neuf : le parcours en huit étapes s'ouvre seul`);
  if (!ouvert) { await pg.screenshot({ path: path.join(SHOTS, `p-${W}-${theme}-02-RATE.png`) }); await ctx.close(); return; }
  await pg.waitForTimeout(900);
  const bienvenueAncienne = await pg.locator('[data-bienvenue], [data-feuille-bienvenue]').count();
  const configAuto = await pg.locator('[data-configuration]').count();
  dit(bienvenueAncienne === 0 && configAuto === 0, `${etq} ni l'ancien Bienvenue ni « Ma configuration » empilés derrière`, `bienvenue ${bienvenueAncienne}, configuration ${configAuto}`);
  const ETAPES = ['bienvenue', 'plateformes', 'extension', 'comptes', 'numeros', 'historique', 'journee', 'abonnement'];
  for (let k = 0; k < ETAPES.length; k++) {
    const e = ETAPES[k];
    const ici = await pg.getAttribute('[data-parcours-nouveau]', 'data-pn-etape').catch(() => null);
    dit(ici === e, `${etq} étape ${k + 1}/8 : ${e}`, `vue : ${ici}`);
    const rang = await pg.getAttribute('[data-pn-rang]', 'data-pn-rang').catch(() => null);
    dit(rang === `${k + 1}/8`, `${etq} ${e} : « Étape ${k + 1} sur 8 » dit`, rang);
    await pg.waitForTimeout(350);
    const me = await MESURE(pg, '[data-parcours-nouveau]');
    dit(me && me.pleins === 1, `${etq} ${e} : un plein, un seul`, me && me.pleins);
    dit(me && !me.deborde, `${etq} ${e} : rien ne déborde`);
    if (W < 600) dit(me && me.petits.length === 0, `${etq} ${e} : chaque cible fait 44 px`, me && JSON.stringify(me.petits));
    const opa = await pg.evaluate(() => { const c = document.querySelector('.pn-corps'); return c ? Number(getComputedStyle(c).opacity) : 0; });
    dit(opa > 0.9, `${etq} ${e} : l'étape est VISIBLE (opacité ${opa})`);
    const txt = await pg.locator('[data-parcours-nouveau]').innerText();
    dit(!/undefined|NaN|null|\bpn\.[a-z]/.test(txt), `${etq} ${e} : aucun « undefined », aucune clé de traduction`, txt.slice(0, 120));
    await pg.screenshot({ path: path.join(SHOTS, `p-${W}-${theme}-${String(k + 2).padStart(2, '0')}-${e}.png`) });
    if (e === 'plateformes') { await pg.click('[data-pn-site="leboncoin"]'); }
    if (e === 'numeros') { await pg.click('[data-pn-numeros="cartons"]'); }
    if (e === 'extension' && k === 2 && W === LARGEURS[0] && theme === THEMES[0]) {
      // Un rechargement reprend à la même étape (la position est rangée dans SA base).
      await pg.waitForTimeout(900);
      await pg.reload({ waitUntil: 'domcontentloaded' });
      const reprise = await pg.waitForSelector('[data-parcours-nouveau][data-pn-etape="extension"]', { timeout: 25000 }).then(() => true).catch(() => false);
      dit(reprise, `${etq} un rechargement reprend à « Installe l'extension »`);
    }
    if (k === ETAPES.length - 1) break;
    const lien = pg.locator('[data-pn-continuer]');
    if (await lien.count()) await lien.click(); else await pg.click('[data-pn-plein]');
    await pg.waitForTimeout(700);
  }
  await pg.waitForTimeout(700);
  const main = (base.lignes.find((l) => l.id === 'main') || {}).data || {};
  const pf = main.vrm_plateformes_affichees;
  dit(pf && Array.isArray(pf.sites) && pf.sites.join() === 'vinted,leboncoin', `${etq} « Où vends-tu ? » écrit dans SA base (vinted, leboncoin)`, JSON.stringify(pf));
  const ne = main.vrm_numero_ecrit;
  dit(ne && ne.actif === true && ne.par === 'cartons' && typeof ne.choisi === 'string', `${etq} « J'ai déjà mes N° sur mes cartons » écrit (la forme de cartonsNumeros)`, JSON.stringify(ne));
  await pg.click('[data-pn-plein]');
  const ferme = await pg.waitForSelector('[data-parcours-nouveau]', { state: 'detached', timeout: 8000 }).then(() => true).catch(() => false);
  dit(ferme, `${etq} « C'est parti » ferme le parcours`);
  await pg.waitForTimeout(2500);
  const main2 = (base.lignes.find((l) => l.id === 'main') || {}).data || {};
  dit(main2.vrm_parcours_nouveau && main2.vrm_parcours_nouveau.fini === true, `${etq} le parcours est noté fini (vrm_parcours_nouveau)`, JSON.stringify(main2.vrm_parcours_nouveau));
  const derriere = await pg.evaluate(() => ({ bienvenue: document.querySelectorAll('[data-bienvenue], [data-feuille-bienvenue]').length, config: document.querySelectorAll('[data-reprendre-configuration], [data-configuration]').length, visite: document.querySelectorAll('[data-visite-bulle], .vrm-visite-bulle').length, parcours: document.querySelectorAll('[data-parcours-nouveau]').length }));
  dit(!derriere.bienvenue && !derriere.config && !derriere.visite && !derriere.parcours, `${etq} après : Ma journée seule (ni Bienvenue, ni « Configure VRM », ni visite)`, JSON.stringify(derriere));
  await pg.screenshot({ path: path.join(SHOTS, `p-${W}-${theme}-10-journee-apres.png`) });
  dit(journal.erreurs.length === 0, `${etq} aucune erreur JS`, journal.erreurs.join(' | '));
  await ctx.close();

  // 3. L'iPhone (Safari) : Orion, le raccourci, l'écran d'accueil dit.
  if (W < 600) {
    const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
    const b2 = baseApp(NOUVEAU); b2.lignes.push({ id: 'main', data: { vrm_parcours_nouveau: { etape: 'extension', vues: ['bienvenue', 'plateformes'] } } });
    const p2 = await nouvellePage(nav, { W, sombre, uid: NOUVEAU, email: 'nouvelle@exemple.invalid', ua: UA });
    await brancherBase(p2.pg, b2);
    await p2.pg.goto(ORIGINE + '/?tab=journee', { waitUntil: 'domcontentloaded' });
    const ok = await p2.pg.waitForSelector('[data-parcours-nouveau][data-pn-etape="extension"]', { timeout: 25000 }).then(() => true).catch(() => false);
    dit(ok, `${etq} iPhone : la position rangée rouvre « Installe l'extension »`);
    if (ok) {
      const app = await p2.pg.getAttribute('[data-parcours-nouveau]', 'data-pn-appareil');
      const plein = await p2.pg.locator('[data-pn-plein]').innerText();
      const raccourci = await p2.pg.locator('[data-pn-raccourci]').count();
      const accueil = await p2.pg.locator('[data-pn-ecran-accueil]').count();
      dit(app === 'iphone' && /Orion/.test(plein) && raccourci === 1 && accueil === 1, `${etq} iPhone : Orion, le raccourci « Ouvrir les URL », « un site ajouté à l'écran d'accueil n'a aucune extension »`, `${app} · ${plein} · ${raccourci} · ${accueil}`);
      await p2.pg.screenshot({ path: path.join(SHOTS, `p-${W}-${theme}-04-extension-iphone.png`) });
    }
    await p2.ctx.close();
  }
}

async function partieAdmin(nav, W, theme) {
  const sombre = theme === 'sombre';
  const etq = `[A ${W} ${theme}]`;
  inventerInscrits();
  // Le PROPRIÉTAIRE.
  const base = baseApp(PROPRIO);
  base.lignes.push({ id: 'main', data: { vrm_bienvenue_vue: { at: 'x' }, vrm_visite_vue: { at: 'x' }, vrm_plateformes_affichees: { sites: ['vinted'], at: 'x' }, vrm_configuration: { etat: 'fait', at: 'x', version: 1 }, vrm_je_vends: { vu: '2026-11-01T00:00:00.000Z' } } });
  const { ctx, pg, journal } = await nouvellePage(nav, { W, sombre, uid: PROPRIO, email: 'proprio@vrm.invalid' });
  await brancherBase(pg, base);
  await pg.goto(ORIGINE + '/?tab=settings&reglage=nouveaux-comptes', { waitUntil: 'domcontentloaded' });
  const vu = await pg.waitForSelector('[data-nouveaux-comptes]', { timeout: 30000 }).then(() => true).catch(() => false);
  dit(vu, `${etq} propriétaire : l'onglet « Nouveaux comptes » s'ouvre`);
  if (!vu) { await pg.screenshot({ path: path.join(SHOTS, `a-${W}-${theme}-RATE.png`), fullPage: true }); await ctx.close(); return; }
  const avant = await pg.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, k === 'vrm_session' ? localStorage.getItem(k) : (localStorage.getItem(k) || '').length])));
  const ecrituresAvant = base.ecritures.length;
  // Le tableau anonyme (le VRAI calcul serveur).
  await pg.waitForSelector('[data-nc-tableau]', { timeout: 15000 }).catch(() => {});
  const total = await pg.getAttribute('[data-nc-tableau]', 'data-nc-tableau').catch(() => null);
  dit(total === '8', `${etq} tableau : 8 inscrits (le propriétaire exclu)`, total);
  const marches = await pg.$$eval('[data-nc-marche]', (els) => Object.fromEntries(els.map((e) => [e.getAttribute('data-nc-marche'), e.getAttribute('data-valeur')])));
  dit(marches.ouvert === '6' && marches.extension === '4' && marches.lecture === '1' && marches.parcoursFini === '1' && marches.abonnes === '1', `${etq} tableau : app ouverte 6 · extension 4 · lu 1 · fini 1 · abonnés 1 (test écarté)`, JSON.stringify(marches));
  const texteTableau = await pg.locator('[data-nc-tableau]').innerText();
  dit(!/@|9e9e9e9e|client\d/.test(texteTableau), `${etq} tableau : aucun e-mail ni identifiant à l'écran`);
  // L'aperçu : chaque étape.
  const cadreDe = async () => { const h = await pg.$('iframe[name="vrm-bac-a-sable-nouveau"]'); return h ? h.contentFrame() : null; };
  const attendreCadre = async (sel) => { for (let i = 0; i < 60; i++) { const f = await cadreDe(); if (f) { const n = await f.$(sel).catch(() => null); if (n) return f; } await pause(400); } return null; };
  let f = await attendreCadre('[data-parcours-nouveau]');
  dit(!!f, `${etq} aperçu : le parcours d'un compte neuf, dans le cadre`);
  if (f) {
    const e0 = await f.getAttribute('[data-parcours-nouveau]', 'data-pn-etape').catch(() => null);
    dit(e0 === 'bienvenue', `${etq} aperçu : étape 3 / 10 · Bienvenue`, e0);
    const bac = await f.evaluate(() => ({ attr: document.documentElement.getAttribute('data-vrm-bac-a-sable'), exemple: document.documentElement.getAttribute('data-vrm-exemple'), idb: typeof window.indexedDB, sess: (() => { try { return JSON.parse(localStorage.getItem('vrm_session') || 'null'); } catch (_) { return null; } })() }));
    dit(bac.attr === 'bienvenue' && bac.exemple == null && bac.idb === 'undefined' && bac.sess && bac.sess.user && bac.sess.user.id !== PROPRIO, `${etq} aperçu : bac à sable posé (pas sa session, ni IndexedDB, ni bandeau « Exemple »)`, JSON.stringify({ ...bac, sess: bac.sess && bac.sess.user && bac.sess.user.id }));
    await pg.screenshot({ path: path.join(SHOTS, `a-${W}-${theme}-00-onglet.png`) });
  }
  for (const [n, e, sel] of [[4, 'plateformes', '[data-pn-etape="plateformes"]'], [5, 'extension', '[data-pn-etape="extension"]'], [1, 'vitrine', 'body'], [2, 'inscription', 'input[type="email"]'], [10, 'abonnement', '[data-pn-etape="abonnement"]']]) {
    await pg.click(`[data-nc-aller="${e}"]`);
    await pause(400);
    const fe = await attendreCadre(sel);
    const etape = await pg.getAttribute('[data-nc-etape]', 'data-nc-etape');
    dit(!!fe && etape === `${n}/10`, `${etq} aperçu : « ${e} » (${n}/10)`, etape);
    if (fe && e === 'vitrine') { const t = await fe.evaluate(() => document.body.innerText); dit(/Essayer gratuitement/i.test(t), `${etq} aperçu : la vitrine publique, telle quelle`); }
    await pause(e === 'vitrine' ? 1500 : 600);
    await pg.screenshot({ path: path.join(SHOTS, `a-${W}-${theme}-${String(n).padStart(2, '0')}-${e}.png`) });
  }
  if (W > 600) {
    await pg.click('[data-nc-format-choix="ordinateur"]');
    const fo = await attendreCadre('[data-parcours-nouveau]');
    const larg = fo ? await fo.evaluate(() => innerWidth) : 0;
    dit(larg === 1512, `${etq} aperçu ordinateur : la vraie largeur 1512`, larg);
    await pause(700);
    await pg.screenshot({ path: path.join(SHOTS, `a-${W}-${theme}-11-ordinateur.png`) });
  }
  // Aucune requête du cadre ne sort ; rien d'écrit chez le propriétaire.
  await pause(1500);
  const sorties = journal.requetes.filter((r) => r.cadre === 'vrm-bac-a-sable-nouveau' && (r.m !== 'GET' || /\/rest\/v1\/|\/auth\/v1\/|\/api\//.test(r.url)));
  const lus = journal.requetes.filter((r) => r.cadre === 'vrm-bac-a-sable-nouveau').length;
  dit(lus > 0 && sorties.length === 0, `${etq} aperçu : ${lus} requêtes du cadre interceptées, 0 vers la base ni /api, 0 écriture`, sorties.slice(0, 4).map((r) => r.m + ' ' + r.url).join(' | '));
  const apres = await pg.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, k === 'vrm_session' ? localStorage.getItem(k) : (localStorage.getItem(k) || '').length])));
  const cles = (s) => JSON.parse(s).map((x) => x[0]);
  const nouvelles = cles(apres).filter((k) => !cles(avant).includes(k));
  const sessionIntacte = JSON.parse(apres).find((x) => x[0] === 'vrm_session')[1] === JSON.parse(avant).find((x) => x[0] === 'vrm_session')[1];
  dit(sessionIntacte && !nouvelles.some((k) => /parcours_nouveau|plateformes|numero_ecrit|mode_exemple/.test(k)), `${etq} aperçu : sa session et son stockage intacts`, nouvelles.join(','));
  const ecritesPN = base.ecritures.slice(ecrituresAvant).filter((x) => /parcours_nouveau/.test(x));
  dit(!(base.lignes.find((l) => l.id === 'main') || { data: {} }).data.vrm_parcours_nouveau && ecritesPN.length === 0, `${etq} aperçu : sa base ne reçoit rien du cadre`);
  const ecr = await pg.getAttribute('[data-nc-ecritures]', 'data-nc-ecritures').catch(() => '');
  dit(ecr !== '' && Number(ecr) >= 0, `${etq} aperçu : le compteur d'écritures GARDÉES en mémoire est lu`, ecr);
  dit(journal.erreurs.length === 0, `${etq} aucune erreur JS`, journal.erreurs.join(' | '));
  await ctx.close();
  // UN AUTRE COMPTE : ni l'entrée, ni la donnée (le serveur refuse).
  const bA = baseApp(AUTRE); bA.lignes.push({ id: 'main', data: { vrm_bienvenue_vue: { at: 'x' }, vrm_visite_vue: { at: 'x' }, vrm_plateformes_affichees: { sites: ['vinted'], at: 'x' }, vrm_je_vends: { vu: '2026-11-01T00:00:00.000Z' }, vrm_parcours_nouveau: { etape: 'abonnement', fini: true } } });
  const a = await nouvellePage(nav, { W, sombre, uid: AUTRE, email: 'autre@exemple.invalid' });
  await brancherBase(a.pg, bA);
  await a.pg.goto(ORIGINE + '/?tab=settings&reglage=nouveaux-comptes', { waitUntil: 'domcontentloaded' });
  await a.pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
  await a.pg.waitForTimeout(3000);
  const entree = await a.pg.locator('[data-nouveaux-comptes], [data-reglage-nouveaux-comptes]').count();
  dit(entree === 0, `${etq} un autre compte : aucune entrée « Nouveaux comptes »`, entree);
  const code = await a.pg.evaluate(async (j) => { const r = await fetch('/api/compte?mode=pilotage&quoi=parcours', { headers: { Authorization: 'Bearer ' + j } }); return r.status; }, jeton(AUTRE));
  dit(code === 403, `${etq} un autre compte : la route répond 403 (garde serveur)`, code);
  await a.ctx.close();
}

async function partieSignalement(nav, W, theme) {
  const sombre = theme === 'sombre';
  const etq = `[S ${W} ${theme}]`;
  SDB.pousses = [];
  SDB.app_data = SDB.app_data.filter((x) => !/^signalement_/.test(x.id));
  const mainVu = { vrm_bienvenue_vue: { at: 'x' }, vrm_visite_vue: { at: 'x' }, vrm_plateformes_affichees: { sites: ['vinted'], at: 'x' }, vrm_configuration: { etat: 'fait', at: 'x', version: 1 }, vrm_je_vends: { vu: '2026-11-01T00:00:00.000Z' }, vrm_parcours_nouveau: { etape: 'abonnement', fini: true } };
  // 1. Un AUTRE compte signale.
  const bA = baseApp(AUTRE); bA.lignes.push({ id: 'main', data: { ...mainVu } });
  const a = await nouvellePage(nav, { W, sombre, uid: AUTRE, email: 'autre@exemple.invalid' });
  await brancherBase(a.pg, bA);
  await a.pg.goto(ORIGINE + '/?tab=settings', { waitUntil: 'domcontentloaded' });
  await a.pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
  await a.pg.waitForTimeout(1500);
  // Le geste du vendeur : Paramètres → (sa catégorie, ouverte par _reglages-compat) → « Signaler un problème ».
  await a.pg.waitForSelector('[data-parametres]', { timeout: 20000 }).catch(() => {});
  const cat = a.pg.locator('[data-categorie-contient~="signaler"]').first();
  if (await cat.count()) await cat.click().catch(() => {});
  await a.pg.click('[data-reglage-signaler]', { timeout: 15000 }).catch(() => {});
  const feuille = await a.pg.waitForSelector('[data-signaler-texte]', { timeout: 10000 }).then(() => true).catch(() => false);
  dit(feuille, `${etq} un autre compte ouvre « Signaler un problème »`);
  if (feuille) {
    await a.pg.fill('[data-signaler-texte]', 'L’écran Colis reste vide depuis ce matin.');
    await a.pg.click('[data-signaler-envoyer]');
    const recu = await a.pg.waitForSelector('[data-signalement-recu]', { timeout: 10000 }).then(() => true).catch(() => false);
    dit(recu, `${etq} il voit « Reçu · on te répond ici »`);
    await a.pg.screenshot({ path: path.join(SHOTS, `s-${W}-${theme}-01-recu.png`) });
  }
  const rang = SDB.app_data.filter((x) => x.owner === PROPRIO && /^signalement_/.test(x.id));
  dit(rang.length === 1 && rang[0].data.de === AUTRE, `${etq} le signalement est rangé chez le PROPRIÉTAIRE, au nom de sa session`, rang.length);
  dit(SDB.pousses.some((p) => p.a === PROPRIO && /Problème signalé/.test(p.notif.title)), `${etq} une notification part vers le propriétaire`, JSON.stringify(SDB.pousses.map((p) => p.notif.title)));
  const vole = await a.pg.evaluate(async (j) => (await fetch('/api/compte?mode=signalement', { headers: { Authorization: 'Bearer ' + j } })).status, jeton(AUTRE));
  dit(vole === 403, `${etq} un autre compte ne peut pas lister les signalements (403)`, vole);
  const repVole = await a.pg.evaluate(async ([j, id]) => (await fetch('/api/compte?mode=signalement', { method: 'POST', headers: { Authorization: 'Bearer ' + j, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'repondre', id, texte: 'faux' }) })).status, [jeton(AUTRE), rang[0] ? rang[0].id : 'x']);
  dit(repVole === 403, `${etq} un autre compte ne peut pas répondre (403)`, repVole);
  await a.ctx.close();
  // 2. Le propriétaire le voit et répond.
  const bP = baseApp(PROPRIO); bP.lignes.push({ id: 'main', data: { ...mainVu } });
  const p = await nouvellePage(nav, { W, sombre, uid: PROPRIO, email: 'proprio@vrm.invalid' });
  await brancherBase(p.pg, bP);
  await p.pg.goto(ORIGINE + '/?tab=settings&section=signalements', { waitUntil: 'domcontentloaded' });
  const liste = await p.pg.waitForSelector('[data-signalement]', { timeout: 30000 }).then(() => true).catch(() => false);
  dit(liste, `${etq} le propriétaire le voit dans « Signalements reçus »`);
  if (liste) {
    await p.pg.click('[data-signalement-repondre-app]');
    await p.pg.fill('[data-signalement-reponse-champ] textarea', 'Merci ! Corrigé : rouvre l’app, Colis se remplit.');
    await p.pg.click('[data-signalement-envoyer-reponse]');
    const fait = await p.pg.waitForSelector('[data-signalement-reponse]', { timeout: 10000 }).then(() => true).catch(() => false);
    dit(fait, `${etq} la réponse est envoyée et affichée sous le signalement`);
    await p.pg.screenshot({ path: path.join(SHOTS, `s-${W}-${theme}-02-proprio-repond.png`) });
  }
  dit(SDB.pousses.some((x) => x.a === AUTRE && /répondu/.test(x.notif.title)), `${etq} une notification part vers l'auteur`, JSON.stringify(SDB.pousses.map((x) => x.a.slice(0, 4) + ':' + x.notif.title)));
  // (16 nov., satisfaction-clients, point 3) Une réponse le passe « en cours » ; le propriétaire le marque « Corrigé » + un mot :
  // l'état est rangé sur la ligne, UNE notification « corrigé » part vers l'auteur (jamais deux), un autre compte ne peut rien changer.
  if (liste) {
    const etatApres = await p.pg.getAttribute('[data-signalement]', 'data-signalement-etat').catch(() => null);
    dit(etatApres === 'en_cours', `${etq} après la réponse, le signalement est « en cours »`, etatApres);
    const etatVole = await p.pg.evaluate(async ([j, id]) => (await fetch('/api/compte?mode=signalement', { method: 'POST', headers: { Authorization: 'Bearer ' + j, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'etat', id, etat: 'corrige', mot: 'faux' }) })).status, [jeton(AUTRE), rang[0] ? rang[0].id : 'x']);
    dit(etatVole === 403, `${etq} un autre compte ne peut pas changer l'état (403)`, etatVole);
    const avantCorr = SDB.pousses.length;
    await p.pg.click('[data-signalement-traiter]');
    await p.pg.fill('[data-signalement-mot-champ] input', 'Colis se remplit de nouveau.');
    await p.pg.click('[data-signalement-corriger]');
    // Corrigé, il quitte « À traiter » (la vue par défaut) : le compteur tombe à 0.
    const corr = await p.pg.waitForFunction(() => { const l = document.querySelector('[data-signalements]'); return l && l.getAttribute('data-signalements-a-traiter') === '0'; }, null, { timeout: 10000 }).then(() => true).catch(() => false);
    const ligne = SDB.app_data.find((x) => x.owner === PROPRIO && /^signalement_/.test(x.id));
    dit(corr && ligne && ligne.data.etat === 'corrige' && ligne.data.mot === 'Colis se remplit de nouveau.', `${etq} « Corrigé » + un mot : rangé sur la ligne du signalement`, ligne && JSON.stringify({ etat: ligne.data.etat, mot: ligne.data.mot }));
    const nCorr = SDB.pousses.slice(avantCorr).filter((x) => x.a === AUTRE && /corrigé/.test(x.notif.title));
    dit(nCorr.length === 1 && /Colis se remplit/.test(nCorr[0].notif.body) && /mes-signalements/.test(nCorr[0].notif.url), `${etq} UNE notification « corrigé » part vers l'auteur, avec le mot`, JSON.stringify(SDB.pousses.slice(avantCorr).map((x) => x.notif.title)));
    await p.pg.screenshot({ path: path.join(SHOTS, `s-${W}-${theme}-02b-proprio-corrige.png`) });
    // Re-marquer « corrigé » (rouvrir puis corriger de nouveau, ou un double appel) : un double appel ne prévient pas deux fois.
    const ref = await p.pg.evaluate(async ([j, id]) => (await fetch('/api/compte?mode=signalement', { method: 'POST', headers: { Authorization: 'Bearer ' + j, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'etat', id, etat: 'corrige' }) })).status, [jeton(PROPRIO), ligne ? ligne.id : 'x']);
    dit(ref === 200 && SDB.pousses.slice(avantCorr).filter((x) => x.a === AUTRE && /corrigé/.test(x.notif.title)).length === 1, `${etq} déjà corrigé : aucune seconde notification`, ref);
  }
  await p.ctx.close();
  // 3. L'auteur voit la réponse.
  const a2 = await nouvellePage(nav, { W, sombre, uid: AUTRE, email: 'autre@exemple.invalid' });
  await brancherBase(a2.pg, bA);
  await a2.pg.goto(ORIGINE + '/?tab=settings&reglage=mes-signalements', { waitUntil: 'domcontentloaded' });
  const vuRep = await a2.pg.waitForSelector('[data-signalement-reponse-lue]', { timeout: 30000 }).then(() => true).catch(() => false);
  const t = vuRep ? await a2.pg.locator('[data-mon-signalement]').first().innerText() : '';
  dit(vuRep && /Corrigé/.test(t), `${etq} l'auteur voit la réponse dans « Mes signalements »`, t.slice(0, 120));
  const etatLu = vuRep ? await a2.pg.getAttribute('[data-mon-signalement]', 'data-signalement-etat') : null;
  const motLu = await a2.pg.locator('[data-signalement-corrige-lu]').first().innerText().catch(() => '');
  dit(etatLu === 'corrige' && /Colis se remplit/.test(motLu), `${etq} l'auteur voit l'état « Corrigé » et le mot`, `${etatLu} · ${motLu.slice(0, 80)}`);
  await a2.pg.screenshot({ path: path.join(SHOTS, `s-${W}-${theme}-03-auteur-lit.png`) });
  await a2.ctx.close();
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('❌ pas de dist/ — npm run build'); process.exit(1); }
  await chargerRegles();
  const srv = V.servir(DIST, PORT);
  // Un navigateur par partie : un onglet tombé (mémoire) n'emporte pas les suivantes.
  const avec = async (f, etq) => {
    const nav = await lancer(PW, { executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
    try { await f(nav); } catch (e) { dit(false, `${etq} le banc a planté`, e.message); } finally { await nav.close().catch(() => {}); }
  };
  try {
    for (const W of LARGEURS) for (const th of THEMES) {
      if (PARTIES.includes('P')) await avec((nav) => partieParcours(nav, W, th), `[P ${W} ${th}]`);
      if (PARTIES.includes('A')) await avec((nav) => partieAdmin(nav, W, th), `[A ${W} ${th}]`);
      if (PARTIES.includes('S')) await avec((nav) => partieSignalement(nav, W, th), `[S ${W} ${th}]`);
    }
  } finally { srv.close(); }
  console.log(`\nCaptures : ${SHOTS}`);
  console.log(ko ? `\n❌ parcours nouveau : ${ko} défaut(s)\n - ${defauts.slice(0, 30).join('\n - ')}` : '\n✅ parcours nouveau : tout est vert');
  process.exit(ko ? 1 : 0);
})();
