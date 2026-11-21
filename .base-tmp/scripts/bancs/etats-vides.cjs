// ════════════════════════════════════════════════════════════════════════════
//  BANC — LES QUATRE ÉTATS DE CHAQUE ÉCRAN (11 nov., lot « états vides »)
//  Base INVENTÉE (aucune fixture, aucune donnée réelle), servie par _minipgrest.
//  Treize écrans principaux, chacun servi dans quatre états :
//   V  VIDE (compte neuf, rien lu) : l'écran parle (jamais blanc, jamais le
//      garde-fou), il porte UN geste visible (bouton ou lien) dans le contenu,
//      aucun « 0,00 € » ni « 0 vente » présenté comme un fait, jamais « Tout est à jour » ;
//   P  PAS SU (le compte est là, toute lecture de `app_data` hors `main` rate en 500) :
//      aucun « 0,00 € », aucun « Aucune vente / Aucun achat / Aucune annonce » (une
//      liste qu'on n'a pas lue n'est pas vide), jamais « Tout est à jour » ;
//   B  BASE INJOIGNABLE (toute la base répond 503) : le bloc `BaseInjoignable` UNE fois,
//      aucun « Tout est à jour », AUCUNE écriture (POST/PATCH/DELETE) partie vers la base ;
//   H  HORS LIGNE puis retour : un écran lu (copie gardée), puis la base hoquette
//      (versions et lignes en 503, comptes lus) ⇒ « Vu à hh:mm · pas relu » UNE fois ;
//      réseau coupé ⇒ « Hors connexion — dernier état du … » (une fois), jamais « à jour » ;
//      retour du réseau et de la base ⇒ l'app RELIT (une lecture `app_data` part) et la
//      mention « pas relu » s'en va.
//  Chaque fois : aucune erreur JS, rien ne déborde. `SHOTS=dossier` range les captures
//  (à REGARDER, §6.2). `LARGEURS=390,1512` / `THEMES=clair,sombre` / `ECRANS=journee,…`
//  / `ETATS=V,P,B,H` restreignent.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const { servir } = require('./_minipgrest.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (10200 + Math.floor(Math.random() * 800));
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const ETATS = liste('ETATS', 'V,P,B,H');
const ECRANS_TOUS = [
  ['journee', 'Ma journée'], ['annonces', 'Annonces'], ['ventes', 'Ventes'], ['achats', 'Achats'],
  ['garage', 'Stock'], ['compta', 'Argent'], ['messages', 'Messages'], ['emails', 'E-mails'],
  ['settings', 'Paramètres'], ['dashboard', 'Statistiques'], ['plat_leboncoin', 'Leboncoin'],
  ['plat_ebay', 'eBay'], ['plat_vestiaire', 'Vestiaire'],
];
const voulus = liste('ECRANS', ECRANS_TOUS.map((e) => e[0]).join(','));
const ECRANS = ECRANS_TOUS.filter((e) => voulus.includes(e[0]));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000ee';
const SESSION = { access_token: 'jeton-etats-vides', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeuse.essai@exemple.test', totp: [] } };

let ko = 0, nOk = 0;
const rouges = [];
const dit = (bon, quoi, det) => { if (!bon) { ko++; rouges.push(quoi); } else nOk++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 400) : ''}`); };
const iso = (j) => new Date(Date.now() - j * 86400000).toISOString();

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

// ── Les bases inventées ─────────────────────────────────────────────────────
const MAIN = (extra) => ({ id: 'main', owner: UID, data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) }, ...extra } });
const COMPTE = [{ id: 1, vinted_user_id: '9001', login: 'compte_essai', domain: 'www.vinted.fr', owner: UID, updated_at: iso(0), created_at: iso(3) }];
const cap = () => new Date(Date.now() - 600e3).toISOString();
const DRESSING = () => ({ id: 'harvest_9001_listings', owner: UID, data: { type: 'listings', uid: '9001', capturedAt: cap(), nItems: 2, complete: true,
  payload: { items: [
    { id: 70001, title: 'Baskets essai A', price: { amount: '45.00', currency_code: 'EUR' }, brand_title: 'Marque essai', size_title: '42', photos: [], is_hidden: false },
    { id: 70002, title: 'Baskets essai B', price: { amount: '60.00', currency_code: 'EUR' }, brand_title: 'Marque essai', size_title: '43', photos: [], is_hidden: false },
  ] } }, meta: { capturedAt: cap() } });
const VENTES = () => ({ id: 'harvest_9001_orders_sold', owner: UID, data: { type: 'orders_sold', uid: '9001', capturedAt: cap(), nItems: 1,
  payload: { my_orders: [{ transaction_id: 880001, title: 'Baskets essai C', price: { amount: '50.00', currency_code: 'EUR' }, status: 'Commande finalisée', status_title: 'Commande finalisée', date: iso(2) }] } }, meta: { capturedAt: cap() } });

const BASES = {
  V: () => ({ lignes: [MAIN({})], comptes: [], panne: null }),
  P: () => ({ lignes: [MAIN({ vinted_annonce_numeros: { 70001: { numero: '1' } } })], comptes: COMPTE, panne: 'lectures' }),
  B: () => ({ lignes: [MAIN({})], comptes: COMPTE, panne: 'base' }),
  H: () => ({ lignes: [MAIN({ vinted_annonce_numeros: { 70001: { numero: '1' }, 70002: { numero: '2' } } }), DRESSING(), VENTES()], comptes: COMPTE, panne: null }),
};

async function ouvrir(nav, { W, sombre, base, tab }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const journal = { erreurs: [], ecritures: [], lectures: 0 };
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
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), m = req.method();
    const u = decodeURIComponent(metaVersData(req.url()));
    const json = (d, st = 200, rg) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': rg || `0-${Math.max(0, (Array.isArray(d) ? d.length : 1) - 1)}/${Array.isArray(d) ? d.length : 1}` }, body: JSON.stringify(d) });
    if (m !== 'GET' && m !== 'HEAD') { let ids = ''; try { const b = JSON.parse(req.postData() || 'null'); ids = (Array.isArray(b) ? b : [b]).map((x) => x && x.id).filter(Boolean).join(','); } catch (_) {} journal.ecritures.push(m + ' ' + u.replace(/^.*\/rest\/v1\//, '').slice(0, 80) + (ids ? ' [' + ids + ']' : '')); }
    if (base.panne === 'base') return json({ message: 'Service Unavailable' }, 503);
    if (/\/rest\/v1\/rpc\//.test(u)) return json(null);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json(m === 'GET' ? base.comptes : []);
    if (!/\/rest\/v1\/app_data/.test(u)) return json([]);
    if (m === 'GET') journal.lectures++;
    const surMain = /id=eq\.main(&|$)/.test(u);
    if (base.panne === 'lectures' && m === 'GET' && !surMain) return json({ message: 'panne de lecture' }, 500);
    if (base.panne === 'hoquet' && m === 'GET' && !surMain) return json({ message: 'Service Unavailable' }, 503);
    if (m === 'POST' || m === 'PATCH') {
      if (base.panne) return json({ message: 'panne' }, 503);
      try {
        const b = JSON.parse(req.postData() || 'null');
        const rows = Array.isArray(b) ? b : b && b.id ? [b] : [];
        const eqm = /[?&]id=eq\.([^&]*)/.exec(u);
        if (m === 'PATCH' && eqm && b && b.data) rows.push({ id: eqm[1], data: b.data });
        for (const r of rows) { if (!r || !r.id) continue; const i = base.lignes.findIndex((x) => x.id === r.id); const l = { id: r.id, owner: UID, updated_at: iso(0), data: r.data }; if (i >= 0) base.lignes[i] = { ...base.lignes[i], ...l }; else base.lignes.push(l); }
      } catch (_) {}
      return json(m === 'PATCH' ? [{ id: 'main' }] : [], m === 'POST' ? 201 : 200);
    }
    if (m === 'DELETE') return json([]);
    const lignes = base.lignes.map((l) => ({ owner: UID, updated_at: iso(0), ...l }));
    const r = servir(lignes, u, req.headers());
    return json(r.body, 200, r.range);
  });
  await pg.route('**/api/**', (r) => base.panne === 'base' ? r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }) : r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
  return { ctx, pg, journal, tel };
}
async function capture(pg, nom) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: false });
}
const attendre = async (pg, f, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await pg.waitForTimeout(250); } return false; };

// Ce que l'écran dit, lu sur le RENDU (texte visible, gestes visibles, marqueurs data-*).
const sonde = (pg) => pg.evaluate(() => {
  const vis = (e) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[inert]') && !e.closest('[aria-hidden="true"]'); };
  const main = document.querySelector('.vrm-main') || document.body;
  const texte = (main.innerText || '').replace(/\s+/g, ' ').trim();
  // Le contenu de l'écran : hors barre du bas, hors île/en-tête de navigation.
  const horsNav = (e) => !e.closest('nav, .vrm-barre-bas, [data-barre-bas], .vrm-ile, header[role="banner"]');
  const gestes = [...main.querySelectorAll('button, a[href], [role="button"]')].filter((e) => vis(e) && horsNav(e) && (e.innerText || e.getAttribute('aria-label') || '').trim().length > 1);
  const panne = [...document.querySelectorAll('div')].filter((d) => vis(d) && /^Je n'arrive pas à joindre tes données/.test((d.innerText || '').trim()) && d.children.length === 0 || (vis(d) && d.style && /^Je n'arrive pas à joindre tes données/.test(d.textContent || '') && d.childElementCount === 0)).length;
  const blocsPanne = [...document.querySelectorAll('div')].filter((d) => d.firstChild && d.firstChild.nodeType === 3 && /^Je n'arrive pas à joindre tes données/.test(d.textContent || '') && vis(d)).length;
  return {
    texte: texte.slice(0, 4000), long: texte.length,
    gestes: gestes.length, gestesNoms: gestes.slice(0, 6).map((e) => (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 30)),
    garde: !!document.querySelector('[data-garde-ecran]'),
    blocsPanne: Math.max(panne, blocsPanne),
    copie: [...document.querySelectorAll('[data-copie-pas-relu]')].filter(vis).map((e) => e.textContent.trim()),
    horsLigne: [...document.querySelectorAll('[data-hors-ligne-ligne]')].filter(vis).length,
    deborde: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    // L'écran de démarrage (index.html) posé PAR-DESSUS : ce qu'il cache, personne ne le lit.
    demarrage: (() => { const d = document.getElementById('vrm-demarrage'); return !!(d && !d.hasAttribute('data-sortie') && getComputedStyle(d).opacity !== '0'); })(),
  };
});
const ZERO_EUROS = /(^|[^\d,])0,00\s?€/;
// « Aucune vente LUE » dit la lecture, pas l'absence : permis ; « Aucune vente » seul ment.
const RIEN_FAUX = /\b(Aucune vente|Aucun achat|Aucune annonce|Aucun message|Aucun e-mail|Aucun colis)s?\b(?! lue?s?\b)/;
const A_JOUR = /Tout est à jour/;

async function etatV(nav, W, theme, [tab, nom]) {
  const T = `[V vide ${nom} ${W}px ${theme}]`;
  const base = BASES.V();
  const o = await ouvrir(nav, { W, sombre: theme === 'sombre', base, tab });
  await attendre(o.pg, async () => (await sonde(o.pg)).long > 40, 12000);
  await o.pg.waitForTimeout(Number(process.env.ATTENTE_V) || 6000);
  const s = await sonde(o.pg);
  dit(!s.garde, `${T} pas le garde-fou`);
  dit(s.long > 40, `${T} l'écran parle (pas blanc)`, s.texte.slice(0, 200));
  dit(s.gestes >= 1, `${T} un geste visible qui remplit`, JSON.stringify(s.gestesNoms));
  dit(!ZERO_EUROS.test(s.texte), `${T} aucun « 0,00 € » qui ment`, (s.texte.match(/.{0,60}0,00\s?€.{0,30}/) || [''])[0]);
  dit(!A_JOUR.test(s.texte), `${T} jamais « Tout est à jour » sur un compte vide`);
  // Aucun compte relié, PROUVÉ : rien ne sera jamais lu ⇒ jamais « lecture… » à l'infini (après 6 s).
  dit(!/\blecture…|\bLecture…|Lecture\.\.\./.test(s.texte), `${T} pas de « lecture… » qui attend une lecture qui ne viendra pas`, (s.texte.match(/.{0,50}[Ll]ecture(…|\.\.\.).{0,20}/) || [''])[0]);
  dit(!/au moins\s*0(?![\d,])/.test(s.texte), `${T} jamais « au moins 0 »`, (s.texte.match(/.{0,30}au moins\s*0.{0,30}/) || [''])[0]);
  dit(!s.deborde, `${T} rien ne déborde`);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await capture(o.pg, `ev-V-${tab}-${W}-${theme}`);
  await o.ctx.close();
}
async function etatP(nav, W, theme, [tab, nom]) {
  const T = `[P pas su ${nom} ${W}px ${theme}]`;
  const base = BASES.P();
  const o = await ouvrir(nav, { W, sombre: theme === 'sombre', base, tab });
  await attendre(o.pg, async () => (await sonde(o.pg)).long > 40, 12000);
  await o.pg.waitForTimeout(2500);
  const s = await sonde(o.pg);
  dit(!s.garde, `${T} pas le garde-fou`);
  dit(s.long > 40, `${T} l'écran parle`, s.texte.slice(0, 200));
  dit(!ZERO_EUROS.test(s.texte), `${T} pas su ≠ « 0,00 € »`, (s.texte.match(/.{0,60}0,00\s?€.{0,30}/) || [''])[0]);
  dit(!RIEN_FAUX.test(s.texte), `${T} pas su ≠ « Aucune … »`, (s.texte.match(/.{0,60}(Aucune vente|Aucun achat|Aucune annonce|Aucun message|Aucun e-mail|Aucun colis).{0,40}/) || [''])[0]);
  dit(!A_JOUR.test(s.texte), `${T} jamais « Tout est à jour » quand une lecture a raté`);
  // Une lecture RATÉE n'est plus « en cours » : « pas lu », jamais « lecture… » (relu après 8 s).
  await o.pg.waitForTimeout(5500);
  const s2 = await sonde(o.pg);
  dit(!/[Ll]ecture…|Lecture\.\.\./.test(s2.texte), `${T} lecture ratée ⇒ pas « lecture… » à l'infini`, (s2.texte.match(/.{0,50}[Ll]ecture(…|\.\.\.).{0,20}/) || [''])[0]);
  dit(!s.deborde, `${T} rien ne déborde`);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await capture(o.pg, `ev-P-${tab}-${W}-${theme}`);
  await o.ctx.close();
}
async function etatB(nav, W, theme, [tab, nom]) {
  const T = `[B base injoignable ${nom} ${W}px ${theme}]`;
  const base = BASES.B();
  const o = await ouvrir(nav, { W, sombre: theme === 'sombre', base, tab });
  let navs = 0; o.pg.on('framenavigated', (f) => { if (f === o.pg.mainFrame()) navs++; });
  await attendre(o.pg, async () => (await sonde(o.pg)).blocsPanne >= 1, 15000);
  // Le bloc doit RESTER : une page qui se recharge seule en boucle le montre une seconde puis repart sur
  // l'écran de démarrage (vu à la capture de Ma journée). On le relit après 8 s.
  await o.pg.waitForTimeout(8000);
  const s = await sonde(o.pg);
  dit(navs === 0, `${T} la page ne se recharge pas toute seule`, `navigations=${navs}`);
  dit(!s.demarrage, `${T} l'écran de démarrage est parti (le bloc se voit)`);
  dit(s.blocsPanne === 1, `${T} la coque dit la panne UNE fois`, `blocs=${s.blocsPanne} · ${s.texte.slice(0, 160)}`);
  dit(!A_JOUR.test(s.texte), `${T} aucun « Tout est à jour »`);
  dit(!ZERO_EUROS.test(s.texte), `${T} aucun « 0,00 € »`, (s.texte.match(/.{0,60}0,00\s?€.{0,30}/) || [''])[0]);
  dit(!o.journal.ecritures.length, `${T} rien n'est écrit`, o.journal.ecritures.join(' ¦ '));
  dit(!s.garde, `${T} pas le garde-fou`);
  dit(!s.deborde, `${T} rien ne déborde`);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await capture(o.pg, `ev-B-${tab}-${W}-${theme}`);
  await o.ctx.close();
}
async function etatH(nav, W, theme, [tab, nom]) {
  const T = `[H hors ligne ${nom} ${W}px ${theme}]`;
  const base = BASES.H();
  const o = await ouvrir(nav, { W, sombre: theme === 'sombre', base, tab });
  await attendre(o.pg, async () => (await sonde(o.pg)).long > 40, 12000);
  await o.pg.waitForTimeout(2500);
  // 1) la base hoquette : versions et lignes en 503, les comptes répondent ⇒ « Vu à hh:mm · pas relu ».
  base.panne = 'hoquet';
  await o.pg.reload({ waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
  const vuOk = await attendre(o.pg, async () => (await sonde(o.pg)).copie.length > 0, 12000);
  let s = await sonde(o.pg);
  dit(vuOk && s.copie.length === 1 && /^(Vu à \d\d:\d\d · pas relu|Pas relu)$/.test(s.copie[0]), `${T} copie gardée, base qui hoquette ⇒ « Vu à hh:mm · pas relu » une fois`, JSON.stringify(s.copie));
  dit(!A_JOUR.test(s.texte), `${T} copie pas relue ⇒ jamais « Tout est à jour »`);
  dit(!s.garde && !o.journal.erreurs.length, `${T} ni garde-fou ni erreur (copie)`, o.journal.erreurs.join(' ¦ '));
  await capture(o.pg, `ev-H1-${tab}-${W}-${theme}`);
  // 2) réseau coupé ⇒ « Hors connexion — dernier état du … », une fois.
  await o.ctx.setOffline(true);
  await o.pg.evaluate(() => window.dispatchEvent(new Event('offline')));
  const hlOk = await attendre(o.pg, async () => (await sonde(o.pg)).horsLigne > 0, 8000);
  s = await sonde(o.pg);
  dit(hlOk && s.horsLigne === 1, `${T} hors ligne ⇒ la ligne « Hors connexion » une fois`, `n=${s.horsLigne} · ${s.texte.slice(0, 160)}`);
  dit(!A_JOUR.test(s.texte), `${T} hors ligne ⇒ jamais « Tout est à jour »`);
  dit(!s.garde && !s.deborde, `${T} hors ligne : ni garde-fou ni débordement`);
  await capture(o.pg, `ev-H2-${tab}-${W}-${theme}`);
  // 3) retour du réseau et de la base ⇒ l'app relit, la mention part.
  base.panne = null;
  const avant = o.journal.lectures;
  await o.ctx.setOffline(false);
  await o.pg.evaluate(() => window.dispatchEvent(new Event('online')));
  const relu = await attendre(o.pg, async () => o.journal.lectures > avant, 12000);
  dit(relu, `${T} retour en ligne ⇒ une relecture part d'elle-même`, `lectures ${avant} → ${o.journal.lectures}`);
  const parti = await attendre(o.pg, async () => { const x = await sonde(o.pg); return !x.copie.length && !x.horsLigne; }, 15000);
  s = await sonde(o.pg);
  dit(parti, `${T} retour en ligne ⇒ ni « pas relu » ni « Hors connexion »`, JSON.stringify({ copie: s.copie, hl: s.horsLigne }));
  dit(!s.garde && !o.journal.erreurs.length, `${T} retour : ni garde-fou ni erreur`, o.journal.erreurs.join(' ¦ '));
  await capture(o.pg, `ev-H3-${tab}-${W}-${theme}`);
  await o.ctx.close();
}

(async () => {
  await new Promise((res) => srv.listen(PORT, res));
  const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
  const nav = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const F = { V: etatV, P: etatP, B: etatB, H: etatH };
  try {
    for (const e of ETATS) for (const ecran of ECRANS) for (const W of LARGEURS) for (const th of THEMES) {
      try { await F[e](nav, W, th, ecran); } catch (err) { dit(false, `[${e} ${ecran[1]} ${W}px ${th}] le banc a pu jouer`, err && err.message); }
    }
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${nOk} OK · ${ko} KO`);
  if (ko) { console.log('Rouges :'); for (const r of rouges) console.log(' - ' + r); }
  process.exit(ko ? 1 : 0);
})();
