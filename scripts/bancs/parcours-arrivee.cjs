require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC — LE PARCOURS D'ARRIVÉE (11 nov.) : un vendeur NEUF, de la configuration
//  à « C'est prêt », une étape à la fois, avec REPRISE après rechargement à
//  chaque étape et sur un autre appareil (état rangé dans la ligne `main`).
//  Base INVENTÉE (aucune fixture, aucune donnée réelle), servie par _minipgrest ;
//  l'extension est un faux pont posé dans la page (`localStorage.banc_ext`).
//  A  parcours complet :
//     A1 la configuration s'ouvre seule ; « C'est parti » ⇒ l'écran plein du
//        parcours s'ouvre sur l'extension (2 sur 6), position écrite dans `main` ;
//     A2 extension « installée, pas connectée » : l'étape n'est PAS faite ; puis
//        connectée à CE compte ⇒ « ✓ » et l'étape suivante, toute seule ;
//     A3 e-mails : UN geste « Relier mes e-mails » ouvre « Ton adresse VRM » ;
//        un e-mail arrive ⇒ « Reçu ✓ », étape suivante ; reprise sur un AUTRE
//        appareil (stockage vide) à la même étape ;
//     A4 Vinted : un compte relié sans dressing lu ⇒ « Lecture de ton dressing… »
//        (pas fait) ; dressing lu ⇒ « 12 annonces lues », étape suivante ;
//     A5 première vente : aucun geste, « Aller à Ma journée » ferme ; la petite
//        carte de Ma journée reste (5 sur 6, « Continuer ») ; une vente lue ⇒
//        « C'est prêt » et le récap ; « Aller à Ma journée » ⇒ plus rien.
//     À CHAQUE étape : rechargement ⇒ même étape, écran ouvert.
//  B  « Plus tard » : sur l'extension ⇒ les e-mails (Vinted suit) ; ✕ ferme ; la
//     carte garde l'étape courante ; rien n'est coché.
//  C  vendeur installé (tout prouvé, jamais ouvert) : ni carte ni écran plein ;
//     dressing illisible ⇒ « Vinted » jamais coché.
//  Chaque fois : aucune erreur JS, rien ne déborde, gestes ≥ 44 px au doigt.
//  `SHOTS=dossier` range les captures (à REGARDER, §6.2).
//  `LARGEURS=390,1512` / `THEMES=clair,sombre` / `SCENARIOS=A,B,C` restreignent.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const { servir } = require('./_minipgrest.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10171;
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const SCENARIOS = liste('SCENARIOS', 'A,B,C');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000dd';
const SESSION = { access_token: 'jeton-parcours', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user: { id: UID, email: 'arrivee.vendeuse@exemple.test', totp: [] } };
const VERSION_EXT = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'vinted-sync-extension', 'manifest.json'), 'utf8')).version; } catch (_) { return '5.341.0'; } })();

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 400) : ''}`); };
const iso = (j) => new Date(Date.now() - j * 86400000).toISOString();

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

// Le faux pont de l'extension : muet tant que `banc_ext` est vide ; 'pasconnectee' ou
// 'connectee' (au compte VRM de la session).
const PONT = ([email, uid, version]) => {
  const etat = () => { try { return localStorage.getItem('banc_ext') || ''; } catch (_) { return ''; } };
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object' || !etat()) return;
    const connecte = etat() === 'connectee';
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'authEtat') post({ __vmr: 'authEtat:result', reqId: d.reqId, etat: { ok: true, connecte, expiree: false, email: connecte ? email : '', user_id: connecte ? uid : '', cloisonne: false } });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, vrm: { ok: true, connecte, email: connecte ? email : '', user_id: connecte ? uid : '' }, vinted: null, cmds: {} } });
  });
  window.__bancExtAllume = () => post({ __vmr: 'ready', version });
};

async function ouvrir(nav, { W, sombre, base, tab = 'journee', proprio = false }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const journal = { erreurs: [] };
  pg.on('pageerror', (e) => journal.erreurs.push(String(e.message || e).slice(0, 240)));
  await pg.addInitScript(([s, sombre]) => {
    try {
      if (!sessionStorage.getItem('banc_init')) {
        localStorage.setItem('vrm_session', JSON.stringify(s));
        localStorage.setItem('vrm_local_owner', s.user.id);
        localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
        localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' }));
        localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
        sessionStorage.setItem('banc_init', '1');
      }
    } catch (_) {}
  }, [SESSION, sombre]);
  await pg.addInitScript(PONT, [SESSION.user.email, UID, VERSION_EXT]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), m = req.method();
    const u = decodeURIComponent(metaVersData(req.url()));
    const json = (d, st = 200, rg) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': rg || `0-${Math.max(0, (Array.isArray(d) ? d.length : 1) - 1)}/${Array.isArray(d) ? d.length : 1}` }, body: JSON.stringify(d) });
    if (/\/rest\/v1\/rpc\//.test(u)) return json(null);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json(m === 'GET' ? base.comptes : []);
    if (!/\/rest\/v1\/app_data/.test(u)) return json([]);
    if (base.panneDressing && /_listings/.test(u) && /nItems/.test(u)) return json({ message: 'panne' }, 500);
    if (m === 'POST' || m === 'PATCH') {
      try {
        const b = JSON.parse(req.postData() || 'null');
        const rows = Array.isArray(b) ? b : b && b.id ? [b] : [];
        const eqm = /[?&]id=eq\.([^&]*)/.exec(u);
        if (m === 'PATCH' && eqm && b && b.data) rows.push({ id: eqm[1], data: b.data });
        for (const r of rows) { if (!r || !r.id) continue; const i = base.lignes.findIndex((x) => x.id === r.id); const l = { id: r.id, owner: UID, updated_at: iso(0), data: r.data }; if (i >= 0) base.lignes[i] = l; else base.lignes.push(l); }
      } catch (_) {}
      return json(m === 'PATCH' ? [{ id: 'main' }] : [], m === 'POST' ? 201 : 200);
    }
    if (m === 'DELETE') return json([]);
    const lignes = base.lignes.map((l) => ({ owner: UID, updated_at: iso(0), ...l }));
    const r = servir(lignes, u, req.headers());
    return json(r.body, 200, r.range);
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, proprietaire: proprio, acces: true }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
  return { ctx, pg, journal, tel };
}
async function capture(pg, nom) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await pg.waitForTimeout(450);
  await pg.screenshot({ path: path.join(SHOTS, nom + '.png') });
}
const attendre = async (pg, f, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await pg.waitForTimeout(250); } return false; };
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
const ligneMain = (base) => (base.lignes.find((l) => l.id === 'main') || {}).data || {};
// Relire tout de suite (le parcours relit aussi seul toutes les 10 s) : retour sur l'onglet.
const pousser = (pg) => pg.evaluate(() => window.dispatchEvent(new Event('focus')));
const plein = (pg) => pg.evaluate(() => {
  const p = document.querySelector('[data-parcours]');
  if (!p) return null;
  const h = (s) => { const e = p.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return b.height; };
  const ph = p.querySelector('[data-parcours-phrase]');
  const pr = document.querySelectorAll('[data-parcours] .vrm-b-primaire');
  const fb = p.getBoundingClientRect();
  return { etape: p.getAttribute('data-parcours-etape'), etat: p.getAttribute('data-parcours-etat'), faites: p.getAttribute('data-parcours-faites'),
    phrase: ph ? ph.textContent.trim() : '', ton: ph ? ph.getAttribute('data-ton') : '',
    titre: (p.querySelector('.vrm-pa-titre') || {}).textContent || '',
    primaires: [...pr].filter((b) => b.getBoundingClientRect().height > 0).length,
    geste: p.querySelector('[data-parcours-geste]') ? p.querySelector('[data-parcours-geste]').getAttribute('data-parcours-geste') : '',
    gesteHref: p.querySelector('a[data-parcours-geste]') ? p.querySelector('a[data-parcours-geste]').getAttribute('href') : '',
    hGeste: h('[data-parcours-geste]'), hPlusTard: h('[data-parcours-plus-tard]'), hFermer: h('[data-parcours-fermer]'),
    plusTard: !!p.querySelector('[data-parcours-plus-tard]'), pourquoi: /Pourquoi/.test(p.textContent),
    detail: p.querySelector('[data-parcours-detail]') ? p.querySelector('[data-parcours-detail]').getAttribute('data-parcours-detail') : '',
    recap: p.querySelectorAll('[data-parcours-recap-etape]').length,
    pleinEcran: fb.width >= window.innerWidth - 1 && fb.height >= window.innerHeight - 1 };
});
const carte = (pg) => pg.evaluate(() => {
  const c = document.querySelector('[data-parcours-carte]');
  if (!c) return null;
  const b = c.querySelector('[data-parcours-continuer]');
  return { mode: c.getAttribute('data-parcours-carte'), faites: c.getAttribute('data-guide-faites'), courante: c.getAttribute('data-guide-courante'),
    continuer: b ? b.getBoundingClientRect().height : 0, rangs: Object.fromEntries([...c.querySelectorAll('[data-parcours-rang]')].map((e) => [e.getAttribute('data-parcours-rang'), e.getAttribute('data-etat')])) };
});
const position = (base) => ligneMain(base).vrm_parcours || null;
// Recharge (même appareil) ou rouvre sur un AUTRE appareil (stockage vide : seule la base parle).
async function recharger(o) { await o.pg.reload({ waitUntil: 'domcontentloaded' }); await o.pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {}); }

const MAIN = (extra) => ({ id: 'main', owner: UID, data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) }, ...extra } });
const COMPTE = [{ id: 1, vinted_user_id: '9101', login: 'arrivee_banc', domain: 'www.vinted.fr', owner: UID, updated_at: iso(0), created_at: iso(0) }];
const RECEPTION = { id: 'email_reception_aa11bb22cc33dd44', owner: UID, data: { at: iso(0), adresses: ['boite@exemple.test'] } };
const MARQUES = ['Nike', 'Adidas', 'Asics', 'Puma'];
const annonce = (i) => ({ id: 61000 + i, title: `${MARQUES[i % 4]} modèle ${i} taille ${38 + (i % 6)}`, price: { amount: String(40 + i * 3) + '.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, photo: null, brand_title: MARQUES[i % 4], size_title: String(38 + (i % 6)), status: 'Très bon état', view_count: 10 + i, favourite_count: i % 3, created_at_ts: Math.floor(Date.now() / 1000) - i * 86400 });
const cap = () => new Date(Date.now() - 60e3).toISOString();
const DRESSING = (n) => ({ id: 'harvest_9101_listings', owner: UID, data: { type: 'listings', uid: '9101', capturedAt: cap(), nItems: n, payload: { items: Array.from({ length: n }, (_, i) => annonce(i)) } }, meta: { capturedAt: cap() } });
const VENTES = (n) => ({ id: 'harvest_9101_orders_sold', owner: UID, data: { type: 'orders_sold', uid: '9101', capturedAt: cap(), nItems: n, payload: { my_orders: Array.from({ length: n }, (_, i) => ({ transaction_id: 72000 + i, title: `Asics modèle ${i} taille 42`, price: { amount: '65', currency_code: 'EUR' }, status: "Colis en cours d'acheminement", transaction_user_status: 'waiting', date: iso(0.2), photo: null })) } }, meta: { capturedAt: cap() } });
const DRESSING_ILLISIBLE = { id: 'harvest_9101_listings', owner: UID, data: { type: 'listings', uid: '9101', capturedAt: cap(), nItems: 'x', payload: { items: [] } }, meta: { capturedAt: cap() } };

async function etapeReprise(o, base, cle, T, nom) {
  // Reprise : même étape après rechargement, écran ouvert, position dans `main`.
  dit(await attendre(o.pg, async () => { const p = position(base); return p && p.ouvert === true && p.etape === cle; }, 4000), `${T} ${nom} position rangée dans main : ${cle}, écran ouvert`, JSON.stringify(position(base)));
  await recharger(o);
  const ok = await attendre(o.pg, async () => { const p = await plein(o.pg); return p && p.etape === cle; }, 15000);
  dit(ok, `${T} ${nom} rechargement ⇒ reprise exactement à « ${cle} »`, JSON.stringify(await plein(o.pg)));
}
async function parcoursComplet(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[A ${W}px ${theme}]`;
  const base = { lignes: [MAIN({})], comptes: [] };
  const o = await ouvrir(nav, { W, sombre, base });
  // A1 — la configuration s'ouvre seule, on la termine.
  await o.pg.waitForSelector('[data-configuration]', { timeout: 15000 }).catch(() => {});
  dit(!!(await o.pg.$('[data-configuration]')), `${T} A1 « Ma configuration » s'ouvre seule (étape 2)`);
  for (let i = 0; i < 16 && (await o.pg.$('[data-configuration]')); i++) {
    if (await o.pg.$('[data-configuration-fin]')) { await o.pg.click('[data-configuration-fin]'); break; }
    const choisi = await o.pg.$('[data-configuration-choix][data-choisi="1"]');
    if (!choisi) { const c = await o.pg.$('[data-configuration-choix]'); if (c) await c.click(); }
    const s = await o.pg.$('[data-configuration-suivant]:not([disabled])');
    if (s) await s.click(); else { const c = await o.pg.$('[data-configuration-choix]'); if (c) await c.click(); }
    await o.pg.waitForTimeout(350);
  }
  const ouvert = await attendre(o.pg, async () => { const p = await plein(o.pg); return p && p.etape === 'extension'; }, 12000);
  let p = await plein(o.pg);
  dit(ouvert && p.faites === '2' && p.pleinEcran, `${T} A1 « C'est parti » ⇒ le parcours plein écran s'ouvre sur l'extension, 2 sur 6`, JSON.stringify(p));
  dit(await attendre(o.pg, async () => (ligneMain(base).vrm_configuration || {}).etat === 'fait', 5000), `${T} A1 la configuration est faite (preuve de l'étape 2)`, JSON.stringify(ligneMain(base).vrm_configuration));
  dit(p && p.plusTard && p.pourquoi && (!o.tel || (p.hPlusTard >= 43.5 && p.hFermer >= 43.5)), `${T} A1 « Plus tard », « Pourquoi ? », fermer — 44 px au doigt`, JSON.stringify(p));
  dit(p && p.detail === 'extension', `${T} A1 l'étape extension porte le guide d'installation de ce navigateur`, JSON.stringify(p));
  dit(!(await deborde(o.pg)), `${T} A1 rien ne déborde`);
  await capture(o.pg, `pa-${W}-${theme}-1-extension`);
  await etapeReprise(o, base, 'extension', T, 'A1');
  // A2 — installée, pas connectée : pas faite.
  await o.pg.evaluate(() => { localStorage.setItem('banc_ext', 'pasconnectee'); window.__bancExtAllume && window.__bancExtAllume(); });
  await o.pg.waitForTimeout(1500); await pousser(o.pg); await o.pg.waitForTimeout(1500);
  p = await plein(o.pg);
  dit(p && p.etape === 'extension' && p.etat === 'afaire' && /Connecte-la/.test(p.phrase), `${T} A2 installée mais pas connectée à ce compte : l'étape n'est PAS faite`, JSON.stringify(p));
  await capture(o.pg, `pa-${W}-${theme}-2-pas-connectee`);
  await o.pg.evaluate(() => { localStorage.setItem('banc_ext', 'connectee'); });
  await pousser(o.pg);
  const vuOk = await attendre(o.pg, async () => { const q = await plein(o.pg); return q && q.etape === 'extension' && q.ton === 'ok'; }, 12000);
  dit(vuOk, `${T} A2 connectée à CE compte : « ✓ » constaté, sans rien cocher`, JSON.stringify(await plein(o.pg)));
  const avance = await attendre(o.pg, async () => { const q = await plein(o.pg); return q && q.etape === 'emails'; }, 6000);
  dit(avance, `${T} A2 puis l'étape suivante (e-mails), toute seule`, JSON.stringify(await plein(o.pg)));
  await etapeReprise(o, base, 'emails', T, 'A2');
  // A3 — e-mails.
  p = await plein(o.pg);
  dit(p && p.geste === 'emails' && p.primaires === 1 && (!o.tel || p.hGeste >= 43.5), `${T} A3 UN geste principal : « Relier mes e-mails »`, JSON.stringify(p));
  await capture(o.pg, `pa-${W}-${theme}-3-emails`);
  await o.pg.click('[data-parcours-geste="emails"]');
  await attendre(o.pg, async () => !!(await o.pg.$('[data-parcours-detail="emails"] [data-parcours-adresse]')), 8000);
  dit(!!(await o.pg.$('[data-parcours-detail="emails"] [data-parcours-adresse]')), `${T} A3 « Ton adresse VRM » s'ouvre DANS l'étape (l'essai « Reçu ✓ »)`);
  await capture(o.pg, `pa-${W}-${theme}-4-adresse`);
  base.lignes.push(RECEPTION);
  await pousser(o.pg);
  const recu = await attendre(o.pg, async () => { const q = await plein(o.pg); return q && q.etape === 'emails' && q.ton === 'ok' && /Reçu ✓/.test(q.phrase); }, 12000);
  dit(recu, `${T} A3 un e-mail arrive ⇒ « Reçu ✓ »`, JSON.stringify(await plein(o.pg)));
  await capture(o.pg, `pa-${W}-${theme}-5-recu`);
  dit(await attendre(o.pg, async () => { const q = await plein(o.pg); return q && q.etape === 'vinted'; }, 6000), `${T} A3 puis l'étape Vinted`, JSON.stringify(await plein(o.pg)));
  await etapeReprise(o, base, 'vinted', T, 'A3');
  // Un AUTRE appareil : stockage vide, seule la base parle.
  {
    const o2 = await ouvrir(nav, { W, sombre, base });
    const ok = await attendre(o2.pg, async () => { const q = await plein(o2.pg); return q && q.etape === 'vinted'; }, 15000);
    dit(ok, `${T} A3 un autre appareil reprend aussi à « vinted » (état rangé côté serveur)`, JSON.stringify(await plein(o2.pg)));
    dit(!o2.journal.erreurs.length, `${T} A3 autre appareil : aucune erreur JS`, o2.journal.erreurs.join(' ¦ '));
    await o2.ctx.close();
  }
  // A4 — Vinted.
  p = await plein(o.pg);
  dit(p && p.geste === 'vinted' && /vinted\.fr/.test(p.gesteHref) && p.primaires === 1, `${T} A4 UN geste : « Ouvrir vinted.fr »`, JSON.stringify(p));
  await capture(o.pg, `pa-${W}-${theme}-6-vinted`);
  base.comptes = COMPTE;
  await pousser(o.pg);
  await attendre(o.pg, async () => { const q = await plein(o.pg); return q && q.etat === 'attente'; }, 12000);
  p = await plein(o.pg);
  dit(p && p.etape === 'vinted' && p.etat === 'attente' && /dressing/.test(p.phrase), `${T} A4 compte relié, dressing pas encore lu : on ATTEND la vraie lecture`, JSON.stringify(p));
  base.lignes.push(DRESSING(12));
  await pousser(o.pg);
  const lu = await attendre(o.pg, async () => { const q = await plein(o.pg); return q && q.etape === 'vinted' && q.ton === 'ok'; }, 12000);
  p = await plein(o.pg);
  dit(lu && /12 annonces lues/.test(p.phrase), `${T} A4 dressing lu ⇒ « 12 annonces lues »`, JSON.stringify(p));
  await capture(o.pg, `pa-${W}-${theme}-7-annonces`);
  dit(await attendre(o.pg, async () => { const q = await plein(o.pg); return q && q.etape === 'premiere'; }, 6000), `${T} A4 puis la première vente`, JSON.stringify(await plein(o.pg)));
  await etapeReprise(o, base, 'premiere', T, 'A4');
  // A5 — première vente : attente, puis « C'est prêt ».
  await attendre(o.pg, async () => { const q = await plein(o.pg); return q && q.faites === '5' && q.etat === 'attente'; }, 8000);
  p = await plein(o.pg);
  dit(p && !p.geste && !p.plusTard && p.primaires === 0 && p.faites === '5', `${T} A5 rien à faire : aucun geste principal, 5 sur 6`, JSON.stringify(p));
  await capture(o.pg, `pa-${W}-${theme}-8-attente`);
  await o.pg.click('[data-parcours-attendre]');
  await attendre(o.pg, async () => !(await plein(o.pg)), 4000);
  let c = await carte(o.pg);
  dit(!(await plein(o.pg)) && c && c.mode === 'etape' && c.courante === 'premiere' && c.faites === '5' && (!o.tel || c.continuer >= 43.5), `${T} A5 « Aller à Ma journée » : la petite carte reste (5 sur 6, Continuer)`, JSON.stringify(c));
  await capture(o.pg, `pa-${W}-${theme}-9-carte`);
  await recharger(o);
  await attendre(o.pg, async () => !!(await carte(o.pg)), 15000);
  dit(!(await plein(o.pg)) && (await carte(o.pg)), `${T} A5 rechargement : l'écran reste fermé, la carte reste`, JSON.stringify(position(base)));
  await o.pg.click('[data-parcours-continuer]');
  dit(await attendre(o.pg, async () => { const q = await plein(o.pg); return q && q.etape === 'premiere'; }, 6000), `${T} A5 « Continuer » rouvre à la même étape`);
  base.lignes.push(VENTES(1));
  await pousser(o.pg);
  const fin = await attendre(o.pg, async () => { const q = await plein(o.pg); return q && q.etape === 'pret'; }, 14000);
  p = await plein(o.pg);
  dit(fin && /C’est prêt/.test(p.titre) && p.recap === 6 && p.faites === '6', `${T} A5 une vente lue ⇒ « C'est prêt » et le récap des 6 étapes`, JSON.stringify(p));
  await capture(o.pg, `pa-${W}-${theme}-10-pret`);
  dit(!(await deborde(o.pg)), `${T} A5 rien ne déborde`);
  await o.pg.click('[data-parcours-fin]');
  dit(await attendre(o.pg, async () => { const q = position(base); return q && q.fini && q.ouvert === false; }, 4000), `${T} A5 la fin est rangée (fini, fermé)`, JSON.stringify(position(base)));
  await o.pg.waitForTimeout(600);
  dit(!(await plein(o.pg)) && !(await carte(o.pg)), `${T} A5 puis plus rien : ni écran, ni carte`, JSON.stringify(await carte(o.pg)));
  await recharger(o); await o.pg.waitForTimeout(3000);
  dit(!(await plein(o.pg)) && !(await carte(o.pg)), `${T} A5 rechargement : toujours rien`);
  await capture(o.pg, `pa-${W}-${theme}-11-apres`);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

async function plusTard(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[B ${W}px ${theme}]`;
  const base = { lignes: [MAIN({ vrm_configuration: { etat: 'fait', at: iso(0), statut: null, version: 1 }, vrm_parcours: { v: 1, etape: 'extension', ouvert: true, fini: null, at: iso(0) } })], comptes: [] };
  const o = await ouvrir(nav, { W, sombre, base });
  await attendre(o.pg, async () => { const q = await plein(o.pg); return q && q.etape === 'extension'; }, 15000);
  dit((await plein(o.pg) || {}).etape === 'extension', `${T} B l'écran rangé ouvert s'ouvre au chargement, sur l'extension`, JSON.stringify(await plein(o.pg)));
  await o.pg.click('[data-parcours-plus-tard="extension"]');
  dit(await attendre(o.pg, async () => { const q = await plein(o.pg); return q && q.etape === 'emails'; }, 5000), `${T} B « Plus tard » ⇒ les e-mails (Vinted suit l'extension)`, JSON.stringify(await plein(o.pg)));
  dit(await attendre(o.pg, async () => { const d = ligneMain(base).vrm_parcours_plus_tard; return d && d.extension; }, 4000), `${T} B « Plus tard » est rangé (synchronisé)`, JSON.stringify(ligneMain(base).vrm_parcours_plus_tard));
  await o.pg.click('[data-parcours-fermer]');
  await attendre(o.pg, async () => !(await plein(o.pg)), 4000);
  const c = await carte(o.pg);
  dit(!(await plein(o.pg)) && c && c.courante === 'emails' && c.faites === '2' && c.rangs.extension !== 'fait', `${T} B ✕ ferme : la carte garde « e-mails », rien n'est coché`, JSON.stringify(c));
  await capture(o.pg, `pa-${W}-${theme}-12-plus-tard`);
  dit(await attendre(o.pg, async () => (position(base) || {}).ouvert === false, 4000), `${T} B fermé est rangé (un rechargement ne le rouvre pas)`, JSON.stringify(position(base)));
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

async function installe(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[C ${W}px ${theme}]`;
  const base = { lignes: [MAIN({ vrm_configuration: { etat: 'fait', at: iso(9), statut: null, version: 1 } }), RECEPTION, DRESSING(12), VENTES(3)], comptes: COMPTE };
  const o = await ouvrir(nav, { W, sombre, base, proprio: true });
  await o.pg.waitForTimeout(4500);
  dit(!(await plein(o.pg)) && !(await carte(o.pg)), `${T} C vendeur installé, tout prouvé : ni carte ni écran plein`, JSON.stringify(await carte(o.pg)));
  dit(!position(base), `${T} C rien n'est écrit pour lui`, JSON.stringify(position(base)));
  await o.ctx.close();
  const base2 = { lignes: [MAIN({ vrm_configuration: { etat: 'fait', at: iso(9), statut: null, version: 1 } }), RECEPTION, DRESSING_ILLISIBLE, VENTES(3)], comptes: COMPTE };
  const o2 = await ouvrir(nav, { W, sombre, base: base2, proprio: true });
  await attendre(o2.pg, async () => !!(await carte(o2.pg)), 10000);
  const c = await carte(o2.pg);
  dit(c && c.rangs.vinted !== 'fait' && c.faites !== '6', `${T} C dressing illisible : « Vinted » n'est JAMAIS coché (pas su ≠ fait)`, JSON.stringify(c));
  await capture(o2.pg, `pa-${W}-${theme}-13-passu`);
  dit(!o.journal.erreurs.length && !o2.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.concat(o2.journal.erreurs).join(' ¦ '));
  await o2.ctx.close();
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const W of LARGEURS) for (const th of THEMES) {
      if (SCENARIOS.includes('A')) await parcoursComplet(nav, W, th);
      if (SCENARIOS.includes('B')) await plusTard(nav, W, th);
      if (SCENARIOS.includes('C')) await installe(nav, W, th);
    }
  } catch (e) { ko++; console.log('KO  le banc a planté — ' + (e && e.stack || e)); }
  await nav.close(); srv.close();
  console.log(ko ? `\n${ko} contrôle(s) en échec.` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
