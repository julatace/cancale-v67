require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC — L'ACCUEIL DES NOUVEAUX (14 nov., choix de Julien n° 132, 135, 137, 138,
//  141, 142, 144). Base INVENTÉE (aucune fixture réelle), servie par _minipgrest ;
//  l'extension est un faux pont (`localStorage.banc_ext`).
//   V  un compte NEUF Vinted : aucune demande de notifications au démarrage ; « Ton
//      bilan en une minute » s'ouvre seul après la première lecture (ventes de l'année
//      = la base inventée, colis, en ligne), « Suivant » ⇒ « chaque matin », « Commencer »
//      ⇒ marqueur dans `main` ; rechargement ⇒ plus jamais ; « Nouveau » sur les écrans
//      pas ouverts, parti à la 1re ouverture ; le premier colis : rien pendant une série,
//      les 4 étapes après un bordereau seul, la question des notifications au bout.
//   N  « Suivre » un colis, retour dans VRM ⇒ la question (une fois) ; « Oui » ⇒ UNE
//      demande de permission, dans ce geste.
//   L  un vendeur Leboncoin SEUL : ses étapes (extension, « Ouvrir Mes annonces »), le
//      geste exact ; ses annonces rangées ⇒ la carte part, le bilan vient.
//   G  la langue du téléphone (de-DE) au premier lancement, l'avis « VRM ist auf Deutsch » ;
//      un choix déjà fait (fr) gagne.
//   T  vrm.center/tarifs : Solo 16,99 € / Pro 19,99 € côte à côte, « Gratuit pour
//      l'instant », « paiement pas encore ouvert », CGV et confidentialité, aucune lecture
//      de la base, rien ne déborde.
//  Chaque fois : aucune erreur JS, rien ne déborde, gestes ≥ 44 px au doigt.
//  `SHOTS=dossier` range les captures (à REGARDER, §6.2).
//  `LARGEURS=390,1512` / `THEMES=clair,sombre` / `SCENARIOS=V,N,L,G,T` restreignent.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const { servir } = require('./_minipgrest.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (10400 + Math.floor(Math.random() * 400));
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const SCENARIOS = liste('SCENARIOS', 'V,N,L,G,T');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-00000000an01';
const CREE = new Date(Date.now() - 2 * 86400000).toISOString();
const SESSION = { access_token: 'jeton-nouveaux', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user: { id: UID, email: 'nouvelle.vendeuse@exemple.test', created_at: CREE, totp: [] } };
const VERSION_EXT = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'vinted-sync-extension', 'manifest.json'), 'utf8')).version; } catch (_) { return '5.375.0'; } })();

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 400) : ''}`); };
const iso = (j) => new Date(Date.now() - j * 86400000).toISOString();

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

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
};
// Les notifications : « pas encore demandé » ; chaque demande est COMPTÉE (142).
const NOTIF = (reponse) => {
  window.__demandesNotif = 0;
  const N = function () {}; N.permission = 'default';
  N.requestPermission = () => { window.__demandesNotif++; N.permission = reponse; return Promise.resolve(reponse); };
  try { Object.defineProperty(window, 'Notification', { value: N, configurable: true, writable: true }); } catch (_) { window.Notification = N; }
};

async function ouvrir(nav, { W, sombre, base, tab = 'journee', locale = 'fr-FR', init = {}, chemin = null, sansSession = false }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale, timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const journal = { erreurs: [], base: 0 };
  pg.on('pageerror', (e) => journal.erreurs.push(String(e.message || e).slice(0, 240)));
  await pg.addInitScript(([s, sombre, init, sansSession]) => {
    try {
      if (!sessionStorage.getItem('banc_init')) {
        if (!sansSession) { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id); }
        localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
        localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' }));
        localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
        for (const [k, v] of Object.entries(init)) localStorage.setItem(k, v);
        sessionStorage.setItem('banc_init', '1');
      }
    } catch (_) {}
  }, [SESSION, sombre, init, sansSession]);
  await pg.addInitScript(PONT, [SESSION.user.email, UID, VERSION_EXT]);
  await pg.addInitScript(NOTIF, base.notif || 'denied');
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (route) => {
    journal.base++;
    const req = route.request(), m = req.method();
    const u = decodeURIComponent(metaVersData(req.url()));
    const json = (d, st = 200, rg) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': rg || `0-${Math.max(0, (Array.isArray(d) ? d.length : 1) - 1)}/${Array.isArray(d) ? d.length : 1}` }, body: JSON.stringify(d) });
    if (/\/rest\/v1\/rpc\//.test(u)) return json(null);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json(m === 'GET' ? base.comptes : []);
    if (!/\/rest\/v1\/app_data/.test(u)) return json([]);
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
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, proprietaire: false, acces: true }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.goto(`http://localhost:${PORT}${chemin || `/?tab=${tab}`}`, { waitUntil: 'domcontentloaded' });
  if (!chemin) await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
  return { ctx, pg, journal, tel };
}
async function capture(pg, nom, plein = false) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: plein });
}
const attendre = async (pg, f, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f().catch(() => false)) return true; await pg.waitForTimeout(250); } return false; };
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
const ligneMain = (base) => (base.lignes.find((l) => l.id === 'main') || {}).data || {};
const pousser = (pg) => pg.evaluate(() => window.dispatchEvent(new Event('focus')));
const bilan = (pg) => pg.evaluate(() => {
  const b = document.querySelector('[data-bilan-minute]'); if (!b) return null;
  const a = b.querySelector('[data-bilan-ca]');
  const tuiles = Object.fromEntries([...b.querySelectorAll('[data-bilan-tuile]')].map((t) => [t.getAttribute('data-bilan-tuile'), t.getAttribute('data-bilan-n')]));
  const pr = [...b.querySelectorAll('.vrm-an-principal')].filter((x) => x.getBoundingClientRect().height > 0);
  const hors = [...b.querySelectorAll('.vrm-an-tuile, .vrm-an-principal, .vrm-an-chiffre')].some((x) => { const r = x.getBoundingClientRect(); return r.right > window.innerWidth + 1 || r.left < -1; });
  return { page: b.getAttribute('data-bilan-minute'), ca: a ? a.getAttribute('data-bilan-ca') : null, ventes: a ? a.getAttribute('data-bilan-ventes') : null, auMoins: a ? a.getAttribute('data-bilan-au-moins') : null,
    tuiles, primaires: pr.length, hBouton: pr[0] ? pr[0].getBoundingClientRect().height : 0, hPasser: (b.querySelector('[data-bilan-passer]') || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height,
    matin: b.querySelectorAll('[data-bilan-matin]').length, courbe: !!b.querySelector('[data-bilan-courbe]'), chiffre: (b.querySelector('.vrm-an-chiffre') || {}).textContent || '', hors };
});
const nouveaux = (pg) => pg.evaluate(() => [...new Set([...document.querySelectorAll('[data-nav-nouveau]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 || e.closest('[data-nav-entree], .vrm-tab, .vrm-rail-button'); }).map((e) => e.getAttribute('data-nav-nouveau')))]);

const MAIN = (extra) => ({ id: 'main', owner: UID, data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) }, vrm_configuration: { etat: 'fait', at: iso(0) }, ...extra } });
const PARCOURS = (etape) => ({ v: 1, etape, ouvert: false, fini: null, at: iso(0) });
const COMPTE = [{ id: 1, vinted_user_id: '9301', login: 'nouvelle_boutique_banc', domain: 'www.vinted.fr', owner: UID, updated_at: iso(0), created_at: iso(0) }];
const MARQUES = ['Nike', 'Adidas', 'Asics', 'New Balance'];
const cap = () => new Date(Date.now() - 60e3).toISOString();
const annonce = (i) => ({ id: 63000 + i, title: `${MARQUES[i % 4]} modèle ${i} taille ${38 + (i % 6)}`, price: { amount: String(45 + i * 4) + '.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, photo: null, brand_title: MARQUES[i % 4], size_title: String(38 + (i % 6)), status: 'Très bon état', view_count: 10 + i, favourite_count: i % 3, created_at_ts: Math.floor(Date.now() / 1000) - i * 86400 });
const DRESSING = (n) => ({ id: 'harvest_9301_listings', owner: UID, data: { type: 'listings', uid: '9301', capturedAt: cap(), nItems: n, payload: { items: Array.from({ length: n }, (_, i) => annonce(i)) } }, meta: { capturedAt: cap() } });
// Des ventes INVENTÉES de cette année (jamais avant le 1er janvier : le compte est attendu exact).
const debutAnnee = new Date(new Date().getFullYear(), 0, 1).getTime();
const dateVente = (i) => new Date(Math.max(debutAnnee + 86400000, Date.now() - (i * 9 + 0.3) * 86400000)).toISOString();
const PRIX = [65, 80, 120, 45, 95, 70, 150, 55, 88, 60, 110, 75];
const VENTES = { id: 'harvest_9301_orders_sold', owner: UID, data: { type: 'orders_sold', uid: '9301', capturedAt: cap(), nItems: PRIX.length, payload: { my_orders: PRIX.map((p, i) => ({ transaction_id: 74000 + i, title: `${MARQUES[i % 4]} modèle ${i} taille 42`, price: { amount: String(p), currency_code: 'EUR' }, status: i < 2 ? "Colis en cours d'acheminement" : 'Commande finalisée', transaction_user_status: i < 2 ? 'waiting' : 'completed', date: dateVente(i), photo: null })) } }, meta: { capturedAt: cap() } };
const CA_ANNEE = PRIX.reduce((a, b) => a + b, 0);

async function scenarioV(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[V ${W}px ${theme}]`;
  const base = { lignes: [MAIN({ vrm_parcours: PARCOURS('vinted') }), VENTES, DRESSING(9)], comptes: COMPTE, notif: 'denied' };
  const o = await ouvrir(nav, { W, sombre, base, init: { banc_ext: 'connectee' } });
  // V1 — aucune demande au démarrage.
  await o.pg.waitForTimeout(4000);
  dit(await o.pg.evaluate(() => window.__demandesNotif) === 0, `${T} V1 aucune demande de notifications au démarrage (§3)`);
  // V2 — le bilan s'ouvre seul après la première lecture.
  const vu = await attendre(o.pg, async () => { const b = await bilan(o.pg); return b && b.page === 'activite' && b.ca && b.ca !== 'encours'; }, 20000);
  let b = await bilan(o.pg);
  dit(vu, `${T} V2 « Ton bilan en une minute » s'ouvre seul après la première lecture`, JSON.stringify(b));
  await attendre(o.pg, async () => { const q = await bilan(o.pg); return q && q.chiffre.replace(/\D/g, '') === String(CA_ANNEE); }, 6000);   // le chiffre a fini de défiler
  b = await bilan(o.pg);
  dit(b && b.ca === String(CA_ANNEE) && b.ventes === String(PRIX.length) && b.auMoins === '0', `${T} V2 ventes et CA de l'année = la base inventée (${PRIX.length} ventes, ${CA_ANNEE} €), sans « au moins »`, JSON.stringify(b));
  dit(b && /\d/.test(b.chiffre) && b.chiffre.replace(/\D/g, '') === String(CA_ANNEE), `${T} V2 le chiffre affiché est ce montant (« ${b && b.chiffre} »)`, JSON.stringify(b));
  dit(b && Object.keys(b.tuiles).join(',') === 'aexpedier,aretirer,enligne', `${T} V3 trois tuiles : à expédier, à retirer, en ligne`, JSON.stringify(b && b.tuiles));
  dit(b && b.primaires === 1 && (!o.tel || (b.hBouton >= 44 && b.hPasser >= 43.5)) && !b.hors, `${T} V3 un seul bouton principal, 44 px au doigt, rien ne sort de l'écran`, JSON.stringify(b));
  dit(!(await deborde(o.pg)), `${T} V3 rien ne déborde`);
  await capture(o.pg, `an-${W}-${theme}-bilan-1`);
  await o.pg.click('[data-bilan-suivant]');
  await attendre(o.pg, async () => { const q = await bilan(o.pg); return q && q.page === 'matin'; }, 4000);
  b = await bilan(o.pg);
  dit(b && b.page === 'matin' && b.matin === 4, `${T} V4 « Suivant » ⇒ « chaque matin, VRM… » (4 choses)`, JSON.stringify(b));
  dit(!!(await o.pg.$('[data-bilan-aide]')), `${T} V4 accompagné : où trouver l'aide de chaque écran`);
  await capture(o.pg, `an-${W}-${theme}-bilan-2`);
  await o.pg.click('[data-bilan-fin]');
  await attendre(o.pg, async () => !(await bilan(o.pg)), 4000);
  dit(!(await bilan(o.pg)), `${T} V4 « Commencer ma journée » ferme le bilan`);
  dit(await attendre(o.pg, async () => { const m = ligneMain(base).vrm_bilan_minute; return m && m.fin === 'fini'; }, 4000), `${T} V4 vu : marqueur dans la ligne du COMPTE (main), pas seulement l'appareil`, JSON.stringify(ligneMain(base).vrm_bilan_minute));
  // V5 — une fois : un autre appareil (stockage vide) ne le revoit pas.
  {
    const o2 = await ouvrir(nav, { W, sombre, base, init: { banc_ext: 'connectee' } });
    await o2.pg.waitForTimeout(6000);
    dit(!(await bilan(o2.pg)), `${T} V5 une seule fois : un autre appareil ne le revoit pas`);
    await o2.ctx.close();
  }
  // V6 — « Nouveau ».
  const n0 = await nouveaux(o.pg);
  dit(n0.length > 0 && !n0.includes('journee'), `${T} V6 « Nouveau » sur les écrans pas encore ouverts (${n0.join(', ')}), pas sur Ma journée`, JSON.stringify(n0));
  await capture(o.pg, `an-${W}-${theme}-nouveau`);
  const cible = n0.includes('ventes') ? 'ventes' : n0[0];
  if (cible) {
    await o.pg.evaluate((c) => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=' + c })), cible);
    await attendre(o.pg, async () => !(await nouveaux(o.pg)).includes(cible), 6000);
    dit(!(await nouveaux(o.pg)).includes(cible), `${T} V6 « Nouveau » de « ${cible} » parti à la première ouverture`, JSON.stringify(await nouveaux(o.pg)));
    dit(await attendre(o.pg, async () => { const e = ligneMain(base).vrm_ecrans_vus; return e && e.vus && e.vus[cible]; }, 4000), `${T} V6 rangé par compte (main.vrm_ecrans_vus)`, JSON.stringify(ligneMain(base).vrm_ecrans_vus));
    const nb = await o.pg.evaluate(() => [...document.querySelectorAll('[data-nav-nouveau]')].map((e) => e.getAttribute('data-nav-nouveau')).filter((k) => document.querySelector(`[data-badge-nav="${k}"][data-badge-n]:not([data-badge-n="point"])`)));
    dit(!nb.length, `${T} V6 jamais « Nouveau » sur une pastille qui porte un nombre`, JSON.stringify(nb));
    await o.pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=journee' })));
    await o.pg.waitForTimeout(800);
  }
  // V7 — le premier colis : rien pendant une série, puis les 4 étapes.
  await o.pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:bordereau-imprime', { detail: { serie: true, avant: 0 } })));
  await o.pg.waitForTimeout(1500);
  dit(!(await o.pg.$('[data-premier-colis]')), `${T} V7 une impression EN SÉRIE n'est jamais interrompue`);
  await o.pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:bordereau-imprime', { detail: { serie: false, avant: 0 } })));
  const colis = await attendre(o.pg, async () => !!(await o.pg.$('[data-premier-colis="imprimer"]')), 5000);
  dit(colis, `${T} V7 le premier bordereau imprimé seul ⇒ « Ton premier colis · 1 sur 4 »`);
  dit(!!(await o.pg.$('[data-premier-colis] [data-colis-video]')), `${T} V7 accompagné : « Voir le geste en vidéo » à chaque étape`);
  await capture(o.pg, `an-${W}-${theme}-colis-1`);
  for (const e of ['imprimer', 'coller', 'deposer']) { const s = await o.pg.$(`[data-colis-suivant="${e}"]`); if (s) await s.click(); await o.pg.waitForTimeout(450); }
  const etape4 = await o.pg.$('[data-premier-colis="suivre"]');
  const q = await o.pg.$('[data-premier-colis="suivre"] [data-notifs-question="demander"]');
  dit(!!etape4 && !!q, `${T} V7 4e étape « VRM le suit pour toi » + la question des notifications (après le geste qui la justifie)`);
  await capture(o.pg, `an-${W}-${theme}-colis-4`);
  dit(await o.pg.evaluate(() => window.__demandesNotif) === 0, `${T} V7 la question ne DEMANDE rien tant qu'il n'a pas touché « Oui »`);
  const non = await o.pg.$('[data-premier-colis] [data-notifs-non]'); if (non) await non.click();
  await attendre(o.pg, async () => !(await o.pg.$('[data-premier-colis]')), 4000);
  dit(!(await o.pg.$('[data-premier-colis]')), `${T} V7 « Pas maintenant » ferme`);
  dit(await attendre(o.pg, async () => ligneMain(base).vrm_premier_colis && (ligneMain(base).vrm_notifs_demande || {}).reponse === 'non', 4000), `${T} V7 vus et réponse rangés dans main (refus respecté)`, JSON.stringify({ c: ligneMain(base).vrm_premier_colis, n: ligneMain(base).vrm_notifs_demande }));
  await o.pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:bordereau-imprime', { detail: { serie: false, avant: 0 } })));
  await o.pg.waitForTimeout(1500);
  dit(!(await o.pg.$('[data-premier-colis]')), `${T} V7 une seule fois`);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

async function scenarioN(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[N ${W}px ${theme}]`;
  const base = { lignes: [MAIN({ vrm_parcours: PARCOURS('vinted'), vrm_bilan_minute: { vu: iso(0), fin: 'fini' } }), VENTES], comptes: COMPTE, notif: 'denied' };
  const o = await ouvrir(nav, { W, sombre, base, init: { banc_ext: 'connectee' } });
  await o.pg.waitForTimeout(3500);
  dit(await o.pg.evaluate(() => window.__demandesNotif) === 0 && !(await o.pg.$('[data-feuille-notifs]')), `${T} N1 rien au démarrage`);
  await o.pg.evaluate(() => {
    const a = document.createElement('a'); a.href = 'https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=12345678'; a.textContent = 'Suivre'; a.id = 'banc-suivre';
    a.addEventListener('click', (e) => e.preventDefault()); document.querySelector('.vrm-main').appendChild(a);
  });
  await o.pg.click('#banc-suivre');
  await pousser(o.pg);
  const vu = await attendre(o.pg, async () => !!(await o.pg.$('[data-feuille-notifs] [data-notifs-question="demander"]')), 5000);
  dit(vu, `${T} N2 « Suivre » un colis puis retour dans VRM ⇒ « Être prévenu quand il arrive ? »`);
  await capture(o.pg, `an-${W}-${theme}-notifs`);
  const oui = await o.pg.$('[data-notifs-oui]');
  dit(!!oui && (!o.tel || (await oui.boundingBox()).height >= 44), `${T} N2 « Oui, préviens-moi » 44 px`);
  if (oui) await oui.click();
  await attendre(o.pg, async () => !!(await o.pg.$('[data-notifs-resultat]')), 4000);
  dit(await o.pg.evaluate(() => window.__demandesNotif) === 1, `${T} N3 UNE demande, dans le geste « Oui »`);
  dit(!!(await o.pg.$('[data-notifs-resultat="refuse"]')), `${T} N3 refusée dans le navigateur ⇒ il le dit, sans insister`);
  dit(await attendre(o.pg, async () => (ligneMain(base).vrm_notifs_demande || {}).reponse === 'refuse', 4000), `${T} N3 réponse rangée par compte`, JSON.stringify(ligneMain(base).vrm_notifs_demande));
  const f = await o.pg.$('[data-notifs-fermer]'); if (f) await f.click();
  await o.pg.click('#banc-suivre').catch(() => {}); await pousser(o.pg); await o.pg.waitForTimeout(1200);
  dit(!(await o.pg.$('[data-feuille-notifs]')), `${T} N4 une seule fois`);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

async function scenarioL(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[L ${W}px ${theme}]`;
  const base = { lignes: [MAIN({ vrm_parcours: PARCOURS('extension'), vrm_plateformes_affichees: { sites: ['leboncoin'], at: iso(0) } })], comptes: [], notif: 'denied' };
  const o = await ouvrir(nav, { W, sombre, base, init: { banc_ext: 'connectee' } });
  const carte = () => o.pg.evaluate(() => { const c = document.querySelector('[data-parcours-carte]'); if (!c) return null; const b = c.querySelector('[data-parcours-continuer]'); return { courante: c.getAttribute('data-guide-courante'), faites: c.getAttribute('data-guide-faites'), total: ((c.querySelector('[data-guide-progres]') || { getAttribute: () => '' }).getAttribute('data-guide-progres') || '').split('/')[1], ligne: (c.querySelector('[data-guide-ligne]') || {}).textContent || '', href: b ? b.getAttribute('href') || '' : '', geste: b ? b.textContent.trim() : '', h: b ? b.getBoundingClientRect().height : 0, vinted: /vinted\.fr/i.test(c.textContent) }; });
  const vu = await attendre(o.pg, async () => { const c = await carte(); return c && c.courante === 'leboncoin' && !/…$/.test(c.ligne); }, 25000);
  const c = await carte();
  dit(vu && c.faites === '2' && c.total === '3', `${T} L1 Leboncoin seul : « Démarrer avec VRM · 2 sur 3 », l'étape « Ouvre Leboncoin une fois »`, JSON.stringify(c));
  dit(c && !c.vinted, `${T} L1 rien ne lui parle de Vinted`, JSON.stringify(c));
  dit(c && (o.tel ? /sur ton ordinateur/.test(c.ligne) : /leboncoin\.fr\/compte\/part\/mes-annonces/.test(c.href) && /Mes annonces/.test(c.geste)) && (!o.tel || c.h >= 44), `${T} L1 le geste exact : ${o.tel ? 'sur ton ordinateur' : '« Ouvrir Mes annonces »'}`, JSON.stringify(c));
  dit(!(await deborde(o.pg)), `${T} L1 rien ne déborde`);
  await capture(o.pg, `an-${W}-${theme}-lbc-carte`);
  // Ses annonces rangées par l'extension.
  base.lignes.push({ id: 'lbc_listings', owner: UID, data: { items: [{ list_id: 2501, subject: 'Veste en jean taille M', price: [35] }], updatedAt: iso(0) } });
  await pousser(o.pg);
  const parti = await attendre(o.pg, async () => !(await o.pg.$('[data-parcours-carte]')), 20000);
  dit(parti, `${T} L2 ses annonces Leboncoin lues ⇒ la carte disparaît (3/3)`);
  const bil = await attendre(o.pg, async () => !!(await bilan(o.pg)), 15000);
  dit(bil, `${T} L2 puis « Ton bilan en une minute »`);
  await capture(o.pg, `an-${W}-${theme}-lbc-bilan`);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

async function scenarioG(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[G ${W}px ${theme}]`;
  const base = { lignes: [MAIN({ vrm_parcours: PARCOURS('vinted'), vrm_bilan_minute: { vu: iso(0), fin: 'fini' } }), VENTES], comptes: COMPTE, notif: 'denied' };
  const o = await ouvrir(nav, { W, sombre, base, locale: 'de-DE', init: { banc_ext: 'connectee' } });
  const de = await attendre(o.pg, async () => (await o.pg.evaluate(() => document.documentElement.lang)) === 'de', 15000);
  dit(de, `${T} G1 premier lancement, téléphone en allemand, aucun choix ⇒ VRM en allemand`);
  const avis = await attendre(o.pg, async () => !!(await o.pg.$('[data-langue-detectee="de"]')), 10000);
  dit(avis && /Deutsch/.test(await o.pg.textContent('[data-langue-detectee]')), `${T} G1 l'avis « VRM ist auf Deutsch… », modifiable`);
  dit(!('vrm_langue' in ligneMain(base)), `${T} G1 la détection n'écrit pas la langue du compte`, JSON.stringify(ligneMain(base).vrm_langue));
  await capture(o.pg, `an-${W}-${theme}-langue`);
  await o.pg.selectOption('[data-langue-changer]', 'it');
  const it = await attendre(o.pg, async () => (await o.pg.evaluate(() => document.documentElement.lang)) === 'it', 8000);
  dit(it && await attendre(o.pg, async () => ligneMain(base).vrm_langue === 'it', 4000), `${T} G2 changé ici ⇒ un CHOIX, rangé pour le compte`, JSON.stringify(ligneMain(base).vrm_langue));
  await o.ctx.close();
  const o2 = await ouvrir(nav, { W, sombre, base: { ...base, lignes: [MAIN({ vrm_langue: 'fr', vrm_bilan_minute: { vu: iso(0) } }), VENTES] }, locale: 'de-DE', init: { banc_ext: 'connectee', vrm_langue: JSON.stringify('fr') } });
  await o2.pg.waitForTimeout(3000);
  dit((await o2.pg.evaluate(() => document.documentElement.lang)) === 'fr' && !(await o2.pg.$('[data-langue-detectee]')), `${T} G3 un choix déjà fait (français) gagne sur le téléphone allemand`);
  await o2.ctx.close();
}

async function scenarioT(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[T ${W}px ${theme}]`;
  const o = await ouvrir(nav, { W, sombre, base: { lignes: [], comptes: [] }, chemin: '/tarifs', sansSession: true });
  const vu = await attendre(o.pg, async () => !!(await o.pg.$('[data-tarifs] [data-montant="pro"]')), 15000);
  dit(vu, `${T} T1 vrm.center/tarifs s'affiche`);
  const v = await o.pg.evaluate(() => {
    const t = (s) => (document.querySelector(s) || {}).textContent || '';
    const offres = [...document.querySelectorAll('[data-offre]')].map((e) => e.getBoundingClientRect());
    return { solo: t('[data-montant="solo"]'), pro: t('[data-montant="pro"]'), offert: !!document.querySelector('[data-acces-offert]'), ferme: !!document.querySelector('[data-paiement-ferme]'),
      cgv: !!document.querySelector('a[href="/legal/cgv.html"]'), conf: !!document.querySelector('a[href="/legal/confidentialite.html"]'), essai: (document.querySelector('[data-essai]') || { getAttribute: () => '' }).getAttribute('data-essai'),
      cote: offres.length === 2 && Math.abs(offres[0].top - offres[1].top) < 2, empile: offres.length === 2 && offres[1].top > offres[0].bottom - 1, bientot: !!document.querySelector('[data-offre="pro"] [data-offre-bientot]'),
      titre: document.title, rangees: document.querySelectorAll('[data-cmp]').length };
  });
  dit(/16,99/.test(v.solo) && /19,99/.test(v.pro), `${T} T2 Solo ${v.solo} · Pro ${v.pro} (les prix du serveur et des CGV)`, JSON.stringify(v));
  dit(o.tel ? v.empile : v.cote, `${T} T2 ${o.tel ? 'l’une sous l’autre au téléphone' : 'côte à côte'}`, JSON.stringify(v));
  dit(v.offert && v.ferme && v.bientot, `${T} T3 la vérité du moment : « Gratuit pour l'instant », paiement pas encore ouvert, Pro bientôt`, JSON.stringify(v));
  dit(v.cgv && v.conf && v.essai === '7' && v.rangees === 5, `${T} T4 CGV, confidentialité, l'essai de 7 jours, la comparaison`, JSON.stringify(v));
  dit(o.journal.base === 0, `${T} T5 aucune lecture de la base (page publique)`, String(o.journal.base));
  dit(!(await deborde(o.pg)), `${T} T5 rien ne déborde`);
  const barre = await o.pg.evaluate(() => [...document.querySelectorAll('.vt-nav a')].map((a) => Math.round(a.getBoundingClientRect().height)));
  dit(barre.every((h) => h >= 44 && h < 60), `${T} T5 la barre du haut tient sur une ligne, 44 px`, JSON.stringify(barre));
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await capture(o.pg, `an-${W}-${theme}-tarifs`, true);
  await capture(o.pg, `an-${W}-${theme}-tarifs-haut`);
  await o.ctx.close();
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  // Un navigateur par scénario : un onglet qui tombe (mémoire de la machine) n'emporte pas les suivants.
  const lancer = () => chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--disable-dev-shm-usage'] });
  const S = { V: scenarioV, N: scenarioN, L: scenarioL, G: scenarioG, T: scenarioT };
  try {
    for (const W of LARGEURS) for (const th of THEMES) for (const s of SCENARIOS) {
      const nav = await lancer();
      try { await S[s](nav, W, th); } catch (e) { dit(false, `[${s} ${W}px ${th}] le scénario se déroule`, e && e.stack || e); }
      finally { await nav.close().catch(() => {}); }
    }
  } finally { srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} accueil-nouveaux : ${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})();
