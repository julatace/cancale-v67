require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
// ════════════════════════════════════════════════════════════════════════════
//  REVUE DE DESIGN DU 11 NOV. — CAPTURES DE TOUS LES ÉCRANS (aucun contrôle).
//  Base INVENTÉE (_base-volume.cjs, 3 comptes), garde réseau : toute requête
//  hors localhost est refusée ; les photos Vinted sont des vignettes SVG
//  inventées (une teinte par annonce). Rien de réel.
//  `SORTIE=dossier` (défaut docs/revue-design-2026-11-11), `LARGEURS=390,1512`,
//  `THEMES=clair,sombre`, `QUOI=ecrans,feuilles,public,neuf`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { fabriquer } = require(path.join(__dirname, '_base-volume.cjs'));
const { servir } = require('./_minipgrest.cjs');
const { metaVersData } = require('./_meta.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10377;
const SORTIE = process.env.SORTIE || path.join(__dirname, '..', '..', 'docs', 'revue-design-2026-11-11');
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const QUOI = liste('QUOI', 'ecrans,feuilles,public,neuf');
const ECRANS_VOULUS = liste('ECRANS', '');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.webp': 'image/webp' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000e7';
const SESSION = { access_token: 'jeton-revue', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeur.exemple@exemple.test', user_metadata: { full_name: 'Camille Exemple' } } };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  if (/^\/f\//.test(f)) f = '/formateur.html';
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

// Une vignette inventée : fond pastel + silhouette de chaussure (aucune photo réelle).
const vignette = (graine) => {
  let h = 0; for (const c of String(graine)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const teinte = h % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="hsl(${teinte},28%,88%)"/><path d="M70 250 C90 200 140 190 170 170 L210 150 C230 175 260 185 300 190 C330 195 345 215 340 245 L340 262 L70 262 Z" fill="hsl(${teinte},35%,${35 + (h % 30)}%)"/><rect x="70" y="262" width="270" height="16" rx="6" fill="#f4f4f4"/></svg>`;
};

function base({ neuve = false } = {}) {
  const b = fabriquer({ comptes: 3 });
  const m = b.main[0].data;
  const at = '2026-11-01T10:00:00.000Z';
  m.vrm_bienvenue_vue = { at }; m.vrm_visite_vue = { at };
  m.vrm_je_vends = { choix: 'sneakers', at };
  m.vrm_configuration = { etat: 'fait', at, statut: null, version: 1 };
  m.vrm_plateformes_affichees = { sites: ['vinted', 'leboncoin', 'ebay'], at };
  m.vrm_parcours = { etat: 'fini', at };
  // Un navigateur inventé où tourne l'extension (sinon le bandeau « jamais vue » couvre tout).
  const vus = {}; for (const a of b.accounts) vus[a.vinted_user_id] = Date.now() - 120000;
  b.rows.push({ id: 'ext_appareil_0123456789abcdef', data: { appareil: { paquet: 'chromium', nav: 'chrome', systeme: 'mac' }, ver: '5.344.0', code: '5.344.0', atMs: Date.now() - 60000, flux: {}, vus: { vinted: vus } } });
  if (neuve) { b.rows = []; b.accounts = []; b.main[0].data = { vrm_bienvenue_vue: { at }, vrm_visite_vue: { at } }; }
  return b;
}

async function ouvrir(nav, { W, sombre, b, url = '/?tab=journee', session = true }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  await pg.addInitScript(([s, sombre, session]) => {
    try {
      if (!sessionStorage.getItem('banc_init')) {
        localStorage.setItem('vrm_banc_vends', '1');
        if (session) { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id); }
        localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
        localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' }));
        localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
        localStorage.setItem('vrm_aide_installation_vue', '1');
        sessionStorage.setItem('banc_init', '1');
      }
    } catch (_) {}
  }, [SESSION, sombre, session]);
  // Garde réseau : rien ne sort. Les photos Vinted deviennent des vignettes inventées.
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/vinted\.net|vinted\.fr\/.*\.(jpe?g|png|webp)/i.test(u) || r.request().resourceType() === 'image') return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: vignette(u) });
    if (/\/auth\/v1\/settings/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ external: { email: true, google: true, discord: true } }) });
    if (/\/auth\/v1\//.test(u)) return session ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }) : r.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    if (/\/rest\/v1\//.test(u)) return rest(r, b);
    return r.abort();
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, proprietaire: true, acces: true }) });
    if (/mode=appareils/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, appareils: [
      { id: 'a1b2c3d4-0000-4000-8000-000000000001', appareil: 'iPhone · Safari', actifLe: new Date().toISOString(), ici: true },
      { id: 'b2c3d4e5-0000-4000-8000-000000000002', appareil: 'Mac · Chrome', actifLe: new Date(Date.now() - 3 * 3600e3).toISOString(), ici: false },
      { id: 'c3d4e5f6-0000-4000-8000-000000000003', appareil: 'Mac · Orion', actifLe: new Date(Date.now() - 26 * 3600e3).toISOString(), ici: false },
      { id: 'd4e5f6a7-0000-4000-8000-000000000004', appareil: 'iPad · Safari', actifLe: new Date(Date.now() - 6 * 86400e3).toISOString(), ici: false },
    ] }) });
    if (/mode=formateur/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, page: { nom: 'Atelier Exemple', adresse: 'atelier-exemple', presentation: 'Je forme des revendeurs débutants : sourcing, photos, prix, expédition. Groupes de 10, un rendez-vous par semaine.', groupes: [
      { id: '11111111-2222-4333-8444-555555555555', nom: 'Débuter sur Vinted', description: 'Quatre semaines pour passer de 0 à 20 ventes.' },
      { id: '11111111-2222-4333-8444-666666666666', nom: 'Passer à Leboncoin et eBay', description: 'Publier partout sans doubler une vente.' },
    ] } }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.route('**/rest/v1/**', (r) => rest(r, b));
  await pg.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, erreurs, tel };
}
async function rest(route, b) {
  const req = route.request(), m = req.method();
  const u = decodeURIComponent(req.url());
  if (/\/rest\/v1\/rpc\//.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  if (m !== 'GET' && m !== 'HEAD') return route.fulfill({ status: m === 'POST' ? 201 : 200, contentType: 'application/json', body: m === 'PATCH' ? '[{"id":"main"}]' : '[]' });
  if (/\/rest\/v1\/vinted_accounts/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b.accounts.map((a) => ({ ...a, owner: UID }))) });
  if (!/\/rest\/v1\/app_data/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  const lignes = [...b.main, ...b.rows].map((l) => ({ owner: UID, updated_at: new Date().toISOString(), ...l }));
  const r = servir(lignes, decodeURIComponent(metaVersData(req.url())), req.headers());
  return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': r.range || '0-0/0' }, body: JSON.stringify(r.body) });
}

const index = [];
async function shoot(pg, nom, { bas = false } = {}) {
  fs.mkdirSync(SORTIE, { recursive: true });
  await pg.waitForTimeout(600);
  const f = path.join(SORTIE, nom + '.jpg');
  await pg.screenshot({ path: f, type: 'jpeg', quality: 72 });
  index.push(nom);
  if (bas) {
    // La suite de l'écran : on fait défiler la page ou son conteneur principal.
    const defile = await pg.evaluate(() => {
      const cands = [document.scrollingElement, ...document.querySelectorAll('.vrm-main, main, [data-defile]')].filter(Boolean);
      let fait = false;
      for (const c of cands) if (c.scrollHeight > c.clientHeight + 200) { c.scrollTop = Math.min(c.scrollHeight, c.clientHeight * 0.9); fait = true; }
      return fait;
    });
    if (defile) { await pg.waitForTimeout(500); await pg.screenshot({ path: path.join(SORTIE, nom + '-suite.jpg'), type: 'jpeg', quality: 72 }); index.push(nom + '-suite'); }
    await pg.evaluate(() => { for (const c of [document.scrollingElement, ...document.querySelectorAll('.vrm-main, main, [data-defile]')]) if (c) c.scrollTop = 0; });
  }
}
const pret = async (pg) => { await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {}); await pg.waitForTimeout(2600); };
const cliquerTexte = async (pg, re) => pg.evaluate((src) => {
  const re = new RegExp(src, 'i');
  const el = [...document.querySelectorAll('button, a, [role="button"], [role="tab"]')].find((e) => re.test((e.innerText || e.getAttribute('aria-label') || '').trim()) && e.offsetParent !== null);
  if (el) { el.click(); return true; } return false;
}, re.source);

const ECRANS = [
  ['journee', '/?tab=journee'], ['annonces', '/?tab=annonces'], ['ventes', '/?tab=ventes'], ['colis', '/?tab=cat_bord'],
  ['achats', '/?tab=achats'], ['stock', '/?tab=garage'], ['messages', '/?tab=messages'],
  ['argent-resume', '/?tab=argent'], ['argent-stats', '/?tab=stats'], ['argent-declarer', '/?tab=argent_declarer'], ['argent-factures', '/?tab=invoices'],
  ['emails', '/?tab=emails'], ['parametres', '/?tab=settings'], ['communaute', '/?tab=communaute'], ['a-trancher', '/?tab=trancher'],
];

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const journalErreurs = {};
  for (const W of LARGEURS) for (const theme of THEMES) {
    const sombre = theme === 'sombre';
    const suf = `${W}-${theme}`;
    const run = async (nom, fn) => { try { await fn(); } catch (e) { console.log('ÉCHEC', nom, suf, String(e.message || e).slice(0, 200)); } };
    if (QUOI.includes('ecrans')) for (const [nom, url] of ECRANS) {
      if (ECRANS_VOULUS.length && !ECRANS_VOULUS.includes(nom)) continue;
      await run(nom, async () => {
        const o = await ouvrir(nav, { W, sombre, b: base(), url });
        await pret(o.pg); await shoot(o.pg, `${nom}-${suf}`, { bas: true });
        if (o.erreurs.length) journalErreurs[`${nom}-${suf}`] = o.erreurs;
        await o.ctx.close();
      });
    }
    if (QUOI.includes('feuilles')) {
      await run('tout-imprimer', async () => {
        const o = await ouvrir(nav, { W, sombre, b: base(), url: '/?tab=cat_bord' }); await pret(o.pg);
        if (await cliquerTexte(o.pg, /^Tout imprimer/)) { await o.pg.waitForTimeout(1500); await shoot(o.pg, `feuille-tout-imprimer-${suf}`); }
        else console.log('pas de « Tout imprimer »', suf);
        await o.ctx.close();
      });
      await run('vente-tiroir', async () => {
        const o = await ouvrir(nav, { W, sombre, b: base(), url: '/?tab=ventes' }); await pret(o.pg);
        const ok = await o.pg.evaluate(() => { const l = document.querySelector('[data-vente-ligne], [data-vente], .vrm-vente-ligne, [data-rangee]'); if (l) { l.click(); return true; } return false; });
        if (ok) { await o.pg.waitForTimeout(1500); await shoot(o.pg, `feuille-vente-${suf}`, { bas: true }); }
        await o.ctx.close();
      });
      await run('ma-facture', async () => {
        const o = await ouvrir(nav, { W, sombre, b: base(), url: '/?tab=invoices' }); await pret(o.pg);
        if (await cliquerTexte(o.pg, /Ma facture/)) { await o.pg.waitForTimeout(1500); await shoot(o.pg, `feuille-ma-facture-${suf}`, { bas: true }); }
        else console.log('pas de « Ma facture »', suf);
        await o.ctx.close();
      });
      for (const [nom, url, clic] of [
        ['mon-compte', '/?tab=settings', /Mon compte/],
        ['notifications', '/?tab=settings&section=notifications', null],
        ['appareils', '/?tab=settings&section=appareils', null],
        ['tout-va-bien', '/?tab=settings&section=toutvabien', null],
      ]) await run(nom, async () => {
        const o = await ouvrir(nav, { W, sombre, b: base(), url }); await pret(o.pg);
        if (clic && !(await cliquerTexte(o.pg, clic))) console.log('pas de', clic, suf);
        await o.pg.waitForTimeout(1500); await shoot(o.pg, `feuille-${nom}-${suf}`, { bas: true });
        await o.ctx.close();
      });
      await run('menu-profil', async () => {
        const o = await ouvrir(nav, { W, sombre, b: base(), url: '/?tab=journee' }); await pret(o.pg);
        const ok = await o.pg.evaluate(() => { const b = document.querySelector('[data-profil-ouvrir], [data-menu-profil], button[aria-label*="profil" i]'); if (b) { b.click(); return true; } return false; });
        if (ok) { await o.pg.waitForTimeout(1000); await shoot(o.pg, `feuille-menu-profil-${suf}`); }
        await o.ctx.close();
      });
    }
    if (QUOI.includes('neuf')) {
      await run('configuration', async () => {
        const o = await ouvrir(nav, { W, sombre, b: base({ neuve: true }), url: '/?tab=journee' });
        await o.pg.waitForTimeout(3500); await shoot(o.pg, `configuration-depart-${suf}`);
        if (await o.pg.$('[data-configuration-choix="vends:sneakers"]')) { await o.pg.click('[data-configuration-choix="vends:sneakers"]'); await o.pg.click('[data-configuration-suivant]').catch(() => {}); await o.pg.waitForTimeout(800); await shoot(o.pg, `configuration-depart-2-${suf}`); }
        await o.ctx.close();
      });
      await run('journee-vide', async () => {
        const b = base({ neuve: true }); const at = '2026-11-01T10:00:00.000Z';
        Object.assign(b.main[0].data, { vrm_je_vends: { choix: 'sneakers', at }, vrm_configuration: { etat: 'fait', at, statut: null, version: 1 } });
        const o = await ouvrir(nav, { W, sombre, b, url: '/?tab=journee' }); await pret(o.pg); await shoot(o.pg, `journee-compte-vide-${suf}`);
        await o.ctx.close();
      });
    }
    if (QUOI.includes('public')) {
      await run('accueil', async () => {
        const o = await ouvrir(nav, { W, sombre, b: base({ neuve: true }), url: '/', session: false });
        await o.pg.waitForTimeout(3000); await shoot(o.pg, `public-accueil-${suf}`, { bas: true });
        await o.ctx.close();
      });
      await run('connexion', async () => {
        const o = await ouvrir(nav, { W, sombre, b: base({ neuve: true }), url: '/?connexion', session: false });
        await o.pg.waitForTimeout(3000); await shoot(o.pg, `public-connexion-${suf}`);
        if (await cliquerTexte(o.pg, /^Créer un compte/)) { await o.pg.waitForTimeout(1000); await shoot(o.pg, `public-inscription-${suf}`); }
        await o.ctx.close();
      });
      await run('partage', async () => {
        const o = await ouvrir(nav, { W, sombre, b: base({ neuve: true }), url: '/f/atelier-exemple', session: false });
        await o.pg.waitForTimeout(2000); await shoot(o.pg, `public-partage-formateur-${suf}`);
        await o.ctx.close();
      });
    }
  }
  fs.writeFileSync(path.join(SORTIE, 'index.json'), JSON.stringify({ captures: index, erreurs: journalErreurs }, null, 1));
  console.log('captures :', index.length, '· erreurs JS :', Object.keys(journalErreurs).length);
  await nav.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
