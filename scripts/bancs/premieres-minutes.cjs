// ════════════════════════════════════════════════════════════════════════════
//  BANC — LES PREMIÈRES MINUTES (8 nov. ; démarrage en TROIS étapes le 13 nov.,
//  lot 46) : un vendeur NEUF réussit seul.
//  Base INVENTÉE (aucune fixture, aucune donnée réelle), servie par _minipgrest.
//  N1  compte neuf (base vide) : « Démarrer avec VRM », 1 sur 3 (le compte),
//      l'étape courante est l'extension, une barre en trois segments ; les trois
//      étapes sont là ; « Voir VRM avec des exemples » ; pas de question du numéro ;
//  N3  « Vérifier mon installation » : extension, comptes, boîte e-mail — chacun
//      « à faire » avec son geste ; jamais « OK » sans lecture ; rien n'est « tout
//      est en place » ;
//  N4  « Plus tard » sur l'extension : Vinted la suit, la carte dit « Reprendre »,
//      écrit `vrm_parcours_plus_tard` ;
//  N5  à mi-chemin (parcours commencé, un compte relié, rien encore lu) : 2 sur 3,
//      étape courante Vinted « Lecture de tes ventes… », plus d'exemple ;
//  I1  compte INSTALLÉ (comptes, boîte, ventes, N°) : AUCUNE étape affichée, aucune
//      question ; Paramètres → Aide → « Vérifier mon installation » dit les comptes
//      et la boîte « OK » (lus), et la relecture du jour ;
//  I2  installé, la lecture des ventes en panne : toujours AUCUNE carte (un vendeur
//      installé n'est jamais interrompu ; « pas su » n'est pas « à faire »).
//  Chaque fois : aucune erreur JS, rien ne déborde. `SHOTS=dossier` range les captures
//  (à REGARDER, §6.2). `LARGEURS=390,1512` / `THEMES=clair,sombre` restreignent.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const { servir } = require('./_minipgrest.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10123;
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000cc';
const SESSION = { access_token: 'jeton-vendeur-neuf', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeuse.neuve@exemple.test', totp: [] } };

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 400) : ''}`); };
const iso = (j) => new Date(Date.now() - j * 86400000).toISOString();

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function ouvrir(nav, { W, sombre, base, tab = 'journee' }) {
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
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), m = req.method();
    const u = decodeURIComponent(metaVersData(req.url()));
    const json = (d, st = 200, rg) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': rg || `0-${Math.max(0, (Array.isArray(d) ? d.length : 1) - 1)}/${Array.isArray(d) ? d.length : 1}` }, body: JSON.stringify(d) });
    if (/\/rest\/v1\/rpc\//.test(u)) return json(null);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json(m === 'GET' ? base.comptes : []);
    if (!/\/rest\/v1\/app_data/.test(u)) return json([]);
    if (base.panneVentes && /orders_(sold|\*)/.test(u) && /nItems/.test(u)) return json({ message: 'panne' }, 500);
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
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
  return { ctx, pg, journal, tel };
}
async function capture(pg, nom, plein = false) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: plein });
}
// (11 nov.) Le guide est devenu la petite carte du parcours d'arrivée (src/ParcoursArrivee.jsx) :
// trois étapes depuis le 13 nov. (lot 46), l'étape courante ouverte, les trois en repli
// (`data-parcours-rang`).
const guide = (pg) => pg.evaluate(() => {
  const g = document.querySelector('[data-guide-demarrage]');
  if (!g) return null;
  const r = (s) => { const e = g.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { w: b.width, h: b.height }; };
  return { faites: g.getAttribute('data-guide-faites'), courante: g.getAttribute('data-guide-courante'),
    etats: Object.fromEntries([...g.querySelectorAll('[data-parcours-rang]')].map((e) => [e.getAttribute('data-parcours-rang'), e.getAttribute('data-etat')])),
    segments: g.querySelectorAll('.vrm-guide-barre > span').length,
    question: !!document.querySelector('[data-guide-numerotation]'),
    exemple: r('[data-exemple-entrer]'), continuer: r('[data-parcours-continuer]'), plusTard: r('[data-guide-plus-tard]'),
    mode: g.getAttribute('data-parcours-carte'), ligne: ((g.querySelector('[data-guide-ligne]') || {}).textContent || '').trim(),
    carteDansCarte: g.querySelectorAll('.vrm-card').length };
});
const verif = (pg) => pg.evaluate(() => {
  const tous = [...document.querySelectorAll('[data-verif-installation]')];
  const v = tous.find((x) => x.getBoundingClientRect().height > 0);
  if (!v) return tous.length ? { cache: tous.length } : null;
  return { afaire: v.getAttribute('data-verif-afaire'), passu: v.getAttribute('data-verif-passu'), ok: v.getAttribute('data-verif-ok'),
    lignes: Object.fromEntries([...v.querySelectorAll('[data-verif]')].map((e) => [e.getAttribute('data-verif'), { etat: e.getAttribute('data-etat'), geste: (e.querySelector('[data-verif-geste]') || {}).getAttribute ? e.querySelector('[data-verif-geste]').getAttribute('data-verif-geste') : '' }])) };
});
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
const ligneMain = (base) => (base.lignes.find((l) => l.id === 'main') || {}).data || {};
const attendre = async (pg, f, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await pg.waitForTimeout(250); } return false; };

const MAIN = (extra) => ({ id: 'main', owner: UID, data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) }, ...extra } });
const COMPTE = [{ id: 1, vinted_user_id: '9001', login: 'compte_banc', domain: 'www.vinted.fr', owner: UID, updated_at: iso(0), created_at: iso(3) }];
const RECEPTION = { id: 'email_reception_00aa11bb22cc33dd', owner: UID, data: { at: iso(1), adresses: ['boite@exemple.test'] } };
const NUMS = { 51000: { numero: '1' }, 51001: { numero: '2' } };
const CONF = { etat: 'fait', at: iso(1), statut: null, version: 1 };
const DRESSING = { id: 'harvest_9001_listings', owner: UID, data: { type: 'listings', uid: '9001', capturedAt: new Date(Date.now() - 3600e3).toISOString(), nItems: 0, payload: { items: [] } }, meta: { capturedAt: new Date(Date.now() - 3600e3).toISOString() } };
const VENTES = (n) => ({ id: 'harvest_9001_orders_sold', owner: UID, data: { type: 'orders_sold', uid: '9001', capturedAt: new Date(Date.now() - 3600e3).toISOString(), nItems: n, payload: { my_orders: [] } }, meta: { capturedAt: new Date(Date.now() - 3600e3).toISOString() } });

async function neuf(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[neuf ${W}px ${theme}]`;
  const base = { lignes: [MAIN({})], comptes: [] };
  const o = await ouvrir(nav, { W, sombre, base });
  await o.pg.waitForSelector('[data-guide-demarrage]', { timeout: 15000 }).catch(() => {});
  await attendre(o.pg, async () => { const g = await guide(o.pg); return g && g.courante; }, 5000);
  const g = await guide(o.pg);
  dit(!!g, `${T} N1 le parcours s'affiche pour un compte neuf`);
  dit(g && g.faites === '1' && g.etats.compte === 'fait' && g.courante === 'extension', `${T} N1 1 sur 3 : le compte est fait, on continue par l'extension`, JSON.stringify(g));
  dit(g && Object.keys(g.etats).join(',') === 'compte,extension,vinted' && g.segments === 3, `${T} N1 les trois étapes, une barre en trois segments`, JSON.stringify(g && g.etats));
  dit(g && ['extension', 'vinted'].every((k) => g.etats[k] !== 'fait'), `${T} N1 rien d'autre n'est coché sans preuve`, JSON.stringify(g && g.etats));
  dit(g && g.exemple && (!o.tel || g.exemple.h >= 43.5), `${T} N1 « Voir VRM avec des exemples » (44 px au doigt)`, JSON.stringify(g && g.exemple));
  dit(g && !g.question, `${T} N1 la question du numéro n'est plus posée dans la carte (étape « Où est ton numéro ? » de Ma configuration)`);
  dit(g && g.plusTard && g.continuer && (!o.tel || g.continuer.h >= 43.5), `${T} N1 le geste et « Plus tard » sur l'étape courante`, JSON.stringify(g));
  dit(g && g.carteDansCarte === 0, `${T} N1 une seule carte`);
  dit(!(await deborde(o.pg)), `${T} N1 rien ne déborde`);
  await capture(o.pg, `pm-${W}-${theme}-1-neuf`, true);
  // N3 — « Vérifier mon installation » vit dans Paramètres → Aide.
  await o.pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('[data-sous-ouvrir="verifier"], [data-verif-installation]', { timeout: 15000 }).catch(() => {});
  await o.pg.evaluate(() => { const b = [...document.querySelectorAll('[data-sous-ouvrir="verifier"]')].find((x) => x.getBoundingClientRect().height > 0); if (b) { b.scrollIntoView({ block: 'center' }); b.click(); } });
  await attendre(o.pg, async () => { const v = await verif(o.pg); return v && v.passu === '0'; }, 8000);
  const v = await verif(o.pg);
  dit(v && v.lignes.extension && v.lignes.extension.etat === 'action' && v.lignes.comptes && v.lignes.comptes.etat === 'action' && v.lignes.comptes.geste === 'vinted' && v.lignes.emails && v.lignes.emails.etat === 'action' && v.lignes.emails.geste === 'emails',
    `${T} N3 « Vérifier mon installation » : extension, comptes, boîte e-mail à faire, avec leur geste`, JSON.stringify(v));
  dit(v && v.ok === '0' && !Object.values(v.lignes).some((l) => l.etat === 'ok') && !v.lignes.relecture, `${T} N3 jamais « OK » sans lecture, pas de relecture sans compte`, JSON.stringify(v));
  await capture(o.pg, `pm-${W}-${theme}-2-verifier`, true);
  // N4 — « Plus tard » sur l'extension : Vinted la suit, la carte dit « Reprendre ».
  await o.pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('[data-guide-plus-tard="extension"]', { timeout: 15000 }).catch(() => {});
  if (await o.pg.$('[data-guide-plus-tard="extension"]')) {
    await o.pg.click('[data-guide-plus-tard="extension"]').catch(() => {});
    await o.pg.waitForTimeout(400);
    const g4 = await guide(o.pg);
    const ecrit = await attendre(o.pg, async () => { const d = ligneMain(base).vrm_parcours_plus_tard; return d && d.extension; });
    dit(g4 && g4.mode === 'reprendre' && !g4.courante && g4.etats.extension !== 'fait' && g4.etats.vinted !== 'fait', `${T} N4 « Plus tard » : Vinted suit l'extension, la carte dit « Reprendre », rien n'est coché`, JSON.stringify(g4));
    dit(ecrit, `${T} N4 « Plus tard » est enregistré (synchronisé)`, JSON.stringify(ligneMain(base)));
    await capture(o.pg, `pm-${W}-${theme}-3-plus-tard`);
  } else dit(false, `${T} N4 « Plus tard » sur l'étape courante existe`);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

async function miChemin(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[mi-chemin ${W}px ${theme}]`;
  const base = { lignes: [MAIN({ vinted_annonce_numeros: NUMS, vrm_configuration: CONF, vrm_parcours: { v: 1, etape: 'vinted', ouvert: false, fini: null, at: iso(0) } }), RECEPTION], comptes: COMPTE };
  const o = await ouvrir(nav, { W, sombre, base });
  await o.pg.waitForSelector('[data-guide-demarrage]', { timeout: 15000 }).catch(() => {});
  await attendre(o.pg, async () => { const g = await guide(o.pg); return g && g.courante === 'vinted' && g.etats.vinted === 'attente'; }, 6000);
  const g = await guide(o.pg);
  dit(g && g.faites === '2' && g.courante === 'vinted' && g.etats.vinted === 'attente' && /Lecture de tes ventes/.test(g.ligne), `${T} N5 2 sur 3, on attend la première lecture de Vinted`, JSON.stringify(g));
  dit(g && !g.question && !g.exemple, `${T} N5 pas de question de numérotation, plus d'exemple`, JSON.stringify(g));
  await capture(o.pg, `pm-${W}-${theme}-4-mi-chemin`);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

async function installe(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[installé ${W}px ${theme}]`;
  const base = { lignes: [MAIN({ vinted_annonce_numeros: NUMS, vrm_configuration: CONF }), RECEPTION, DRESSING, VENTES(14)], comptes: COMPTE };
  const o = await ouvrir(nav, { W, sombre, base });
  await o.pg.waitForTimeout(5000);
  const g = await guide(o.pg);
  dit(!g, `${T} I1 compte installé : aucune étape affichée`, JSON.stringify(g));
  dit(!(await o.pg.$('[data-guide-numerotation]')), `${T} I1 aucune question de numérotation`);
  await o.pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('[data-reglage-verifier], [data-sous-ouvrir="verifier"], [data-verif-installation]', { timeout: 15000 }).catch(() => {});
  await o.pg.waitForTimeout(800);
  const vu = await verif(o.pg);
  if (!vu || vu.cache) { const ok = await o.pg.evaluate(() => { const b = [...document.querySelectorAll('[data-sous-ouvrir="verifier"]')].find((x) => x.getBoundingClientRect().height > 0); if (b) { b.scrollIntoView({ block: 'center' }); b.click(); return true; } return false; }); if (!ok) dit(false, `${T} I1 la rangée « Vérifier mon installation » est dans Paramètres`); }
  await attendre(o.pg, async () => { const v = await verif(o.pg); return v && v.lignes.relecture && v.lignes.relecture.etat !== 'encours' && v.lignes.emails.etat !== 'encours'; }, 8000);
  const v = await verif(o.pg);
  dit(v && v.lignes.comptes && v.lignes.comptes.etat === 'ok' && v.lignes.emails && v.lignes.emails.etat === 'ok' && v.lignes.relecture && v.lignes.relecture.etat === 'ok', `${T} I1 Paramètres → « Vérifier mon installation » : comptes, boîte e-mail et relecture lus OK`, JSON.stringify(v));
  dit(v && v.lignes.extension && (o.tel ? v.lignes.extension.etat === 'ok' : v.lignes.extension.etat === 'action'), `${T} I1 extension : ${o.tel ? 'téléphone, les comptes qui arrivent la prouvent' : 'absente de CE navigateur ⇒ dit, avec son geste'}`, JSON.stringify(v && v.lignes.extension));
  await o.pg.evaluate(() => { const e = [...document.querySelectorAll('[data-verif-installation]')].find((x) => x.getBoundingClientRect().height > 0); if (e) e.scrollIntoView({ block: 'center' }); });
  await capture(o.pg, `pm-${W}-${theme}-5-installe-reglages`);
  dit(!(await deborde(o.pg)), `${T} I1 rien ne déborde`);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
  // I2
  const base2 = { lignes: [MAIN({ vinted_annonce_numeros: NUMS, vrm_configuration: CONF }), RECEPTION, DRESSING, VENTES(14)], comptes: COMPTE, panneVentes: true };
  const o2 = await ouvrir(nav, { W, sombre, base: base2 });
  await o2.pg.waitForTimeout(5000);
  const g2 = await guide(o2.pg);
  dit(!g2, `${T} I2 installé, ventes illisibles : toujours aucune carte (jamais interrompu)`, JSON.stringify(g2));
  await o2.ctx.close();
}

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      await neuf(nav, W, theme);
      await miChemin(nav, W, theme);
      await installe(nav, W, theme);
    }
  } catch (e) { dit(false, 'le banc a pu aller au bout', String(e && e.stack || e).slice(0, 400)); }
  await nav.close(); srv.close();
  console.log(ko ? `\n❌ premières minutes : ${ko} défaut(s)` : '\n✅ premières minutes : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
