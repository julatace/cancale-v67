require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « MODE EXEMPLE ET GUIDE DE DÉMARRAGE » (6 nov., VRM ouvert à des clients)
//
//  Julien : un NOUVEAU vendeur (aucun compte Vinted relié) peut « Découvrir avec
//  des exemples » : l'app se remplit de données INVENTÉES, un bandeau permanent
//  dit « Exemple — rien n'est enregistré » (13 nov.), « Passer à mes vraies données » en sort, et RIEN
//  de l'exemple n'est jamais écrit en base (§2.3) ni sur l'appareil.
//  Et le guide de démarrage : trois étapes (13 nov., lot 46), chacune dit pourquoi et se coche
//  TOUTE SEULE sur une preuve lue — « pas su » n'est jamais « fait » (§8).
//
//  Aucune donnée réelle : la base est SERVIE ici (forme réelle `app_data`,
//  `select=` projeté, `id=like.`…) et chaque requête qui l'atteint est COMPTÉE.
//  E1  vendeur neuf : le guide (1 sur 3 : le compte) et « Voir VRM avec des exemples » (44 px) ;
//  E2  dans l'exemple : le bandeau « Exemple — rien n'est enregistré » + « Passer à mes vraies données » (8 nov. ; avant « Brancher mes
//      comptes » sur CHAQUE écran visité, les données inventées à l'écran ;
//  E3  dans l'exemple : 0 requête vers la base (lecture comprise) et 0 écriture,
//      alors que l'app a bien tenté d'écrire (écritures gardées en mémoire > 0) ;
//  E4  « Brancher mes comptes » : l'exemple a disparu (bandeau, données), la vraie
//      session est intacte, aucune trace de l'exemple dans la base ni dans le
//      stockage réel de l'appareil, et la clé de l'onglet est retirée ;
//  G1  compte et e-mails prouvés, aucun compte Vinted : 1 sur 3 (les e-mails ne comptent
//      plus), l'étape courante est l'extension ;
//  G2  parcours commencé, un compte relié, rien encore lu : le guide reste, étape courante
//      Vinted ; « Masquer le guide » le retire et l'écrit dans la ligne `main` ;
//  G3  la lecture de Vinted échoue (500) : l'étape n'est NI cochée NI « à faire » ;
//  G4  tout est prouvé (ventes lues) : aucun guide.
//  `SHOTS=dossier` range une capture par écran (à REGARDER, §6.2).
//  `LARGEURS=390,1512` / `THEMES=clair,sombre` restreignent.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const { servir } = require('./_minipgrest.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10111;
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000bb';
const SESSION = { access_token: 'jeton-vendeur-neuf', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeur.neuf@exemple.test', totp: [] } };
// Ce qui n'existe QUE dans l'exemple (src/exempleDonnees.js) : ne doit jamais
// apparaître dans la base servie ni dans le stockage réel.
const TRACES = ['vendeuse_a', 'vendeuse_b', 'acheteuse_lyon', 'exemple@vrm.invalid', 'e0e0e0e0-0000-4000-8000-00000000e0e0'];

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 400) : ''}`); };
const iso = (j) => new Date(Date.now() - j * 86400000).toISOString();

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

// Une page du vendeur. `base` : { lignes, comptes, requetes: [], phase, panneEmails }.
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
  // Les autres sites (géocodage du relais, fonds de carte) : notés à part — une
  // LECTURE publique n'est pas notre base ; une écriture vers eux serait un défaut.
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => { base.requetes.push({ externe: true, phase: base.phase, m: r.request().method(), u: r.request().url().replace(/^https?:\/\//, '').slice(0, 140) }); return r.abort(); });
  await pg.route('**/auth/v1/**', (r) => { base.requetes.push({ phase: base.phase, m: r.request().method(), u: '/auth' }); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }); });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), m = req.method();
    const brut = req.url();
    const u = decodeURIComponent(metaVersData(brut));
    base.requetes.push({ phase: base.phase, m, u: u.replace(/^https?:\/\/[^/]+/, '').slice(0, 160) });
    const json = (d, st = 200, rg) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': rg || `0-${Math.max(0, (Array.isArray(d) ? d.length : 1) - 1)}/${Array.isArray(d) ? d.length : 1}` }, body: JSON.stringify(d) });
    if (/\/rest\/v1\/rpc\//.test(u)) return json(null);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json(m === 'GET' ? base.comptes : []);
    if (!/\/rest\/v1\/app_data/.test(u)) return json([]);
    if (base.panneLecture && /harvest_/.test(u) && /nItems/.test(u)) return json({ message: 'panne' }, 500);
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
  await pg.route('**/api/**', (r) => { base.requetes.push({ phase: base.phase, m: r.request().method(), u: r.request().url().replace(/^https?:\/\/[^/]+/, '').slice(0, 120) }); return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
  return { ctx, pg, journal, tel };
}
async function capture(pg, nom) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: false });
}
const guide = (pg) => pg.evaluate(() => {
  const g = document.querySelector('[data-guide-demarrage]');
  if (!g) return null;
  return { faites: g.getAttribute('data-guide-faites'), courante: g.getAttribute('data-guide-courante'),
    // (11 nov.) La carte du parcours d'arrivée : trois étapes en repli (13 nov.), l'étape courante ouverte.
    etats: Object.fromEntries([...g.querySelectorAll('[data-parcours-rang]')].map((e) => [e.getAttribute('data-parcours-rang'), e.getAttribute('data-etat')])),
    pourquoi: !!(g.querySelector('[data-courante="1"] .vrm-pa-carte-texte span') || {}).textContent,
    carteDansCarte: g.querySelectorAll('.vrm-card').length, exemple: !!g.querySelector('[data-exemple-entrer]') };
});
const taille = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, top: r.top, bottom: r.bottom, vis: r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' }; }, sel);
const stockageReel = (pg) => pg.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });

async function parcoursExemple(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[exemple ${W}px ${theme}]`;
  const base = { lignes: [{ id: 'main', owner: UID, data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) } } }], comptes: [], requetes: [], phase: 'avant' };
  const o = await ouvrir(nav, { W, sombre, base });
  await o.pg.waitForSelector('[data-guide-demarrage]', { timeout: 15000 }).catch(() => {});
  await o.pg.waitForTimeout(1200);
  // E1
  const g = await guide(o.pg);
  dit(!!g, `${T} E1 le guide de démarrage s'affiche pour un vendeur neuf`);
  dit(g && g.faites === '1' && g.etats.compte === 'fait' && g.courante === 'extension', `${T} E1 seul le compte est prouvé : 1 sur 3, on continue par l'extension`, JSON.stringify(g));
  dit(g && g.pourquoi, `${T} E1 l'étape courante dit pourquoi`);
  dit(g && g.carteDansCarte === 0, `${T} E1 une seule carte (pas de carte dans la carte)`, g && g.carteDansCarte);
  const bt = await taille(o.pg, '[data-exemple-entrer]');
  dit(bt && bt.vis && (!o.tel || bt.h >= 43.5), `${T} E1 « Voir VRM avec des exemples » est là (44 px au doigt)`, JSON.stringify(bt));
  await capture(o.pg, `ex-${W}-${theme}-1-guide-neuf`);
  const avant = await stockageReel(o.pg);
  if (!bt) { await o.ctx.close(); return; }
  // E2/E3 : on entre.
  // La phase « exemple » commence quand le NOUVEAU document est engagé : une lecture
  // partie de l'ancien (le vrai compte) juste avant le clic n'est pas de l'exemple.
  base.phase = 'transition';
  const engage = () => { base.phase = 'exemple'; };
  o.pg.once('framenavigated', (f) => { if (f === o.pg.mainFrame()) engage(); });
  await Promise.all([o.pg.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}), o.pg.click('[data-exemple-entrer]')]);
  if (base.phase !== 'exemple') engage();
  await o.pg.waitForSelector('[data-exemple-bandeau]', { timeout: 20000 }).catch(() => {});
  const ECRANS = [['journee', null], ['annonces', /taille \d\d/], ['ventes', /taille \d\d/], ['cat_bord', null], ['messages', /Toujours disponible en 42|Vous feriez 50/], ['settings', null]];
  for (const [tab, donnee] of ECRANS) {
    await o.pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
    await o.pg.waitForSelector('[data-exemple-bandeau]', { timeout: 20000 }).catch(() => {});
    await o.pg.waitForTimeout(2200);
    const b = await taille(o.pg, '[data-exemple-bandeau]');
    const txt = await o.pg.evaluate(() => (document.querySelector('[data-exemple-bandeau]') || {}).innerText || '');
    dit(b && b.vis && b.top >= -1 && b.bottom <= (o.tel ? 844 : 950), `${T} E2 ${tab} : le bandeau est visible`, JSON.stringify(b));
    dit(/Exemple — données inventées/.test(txt) && /Passer à mes vraies données/.test(txt), `${T} E2 ${tab} : « Exemple — données inventées » et « Passer à mes vraies données »`, txt);
    const bb = await taille(o.pg, '[data-exemple-brancher]');
    dit(bb && (!o.tel || bb.h >= 43.5), `${T} E2 ${tab} : « Brancher mes comptes » fait 44 px au doigt`, JSON.stringify(bb));
    // Rien ne le couvre (sur ordinateur, l'île flottante des actions du haut l'a couvert au premier essai).
    const dessus = await o.pg.evaluate(() => { const e = document.querySelector('[data-exemple-brancher]'); if (!e) return 'absent'; const r = e.getBoundingClientRect(); const x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return x && (x === e || e.contains(x)) ? '' : (x ? (x.className || x.tagName) : 'rien'); });
    dit(dessus === '', `${T} E2 ${tab} : rien ne couvre « Brancher mes comptes »`, dessus);
    if (donnee) { const corps = await o.pg.evaluate(() => document.querySelector('.vrm-main').innerText); dit(donnee.test(corps), `${T} E2 ${tab} : les données inventées sont à l'écran`, corps.slice(0, 200)); }
    const deb = await o.pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    dit(!deb, `${T} E2 ${tab} : rien ne déborde à droite`);
    if (tab === 'journee' || tab === 'annonces' || tab === 'ventes') await capture(o.pg, `ex-${W}-${theme}-2-exemple-${tab}`);
  }
  const bilan = await o.pg.evaluate(() => (window.__vrmExemple ? window.__vrmExemple() : null));
  const pendant = base.requetes.filter((r) => r.phase === 'exemple' && !r.externe);
  const dehors = base.requetes.filter((r) => r.phase === 'exemple' && r.externe);
  dit(dehors.every((r) => r.m === 'GET' || r.m === 'HEAD'), `${T} E3 vers les autres sites, des lectures seulement (${dehors.length}, ex. géocodage du relais inventé)`, JSON.stringify(dehors.filter((r) => r.m !== 'GET').slice(0, 4)));
  dit(bilan && bilan.actif, `${T} E3 la porte de l'exemple est active`, JSON.stringify(bilan));
  dit(pendant.length === 0, `${T} E3 aucune requête n'atteint la base pendant l'exemple (lecture comprise)`, JSON.stringify(pendant.slice(0, 6)));
  dit(pendant.filter((r) => r.m !== 'GET' && r.m !== 'HEAD').length === 0, `${T} E3 0 écriture en base pendant l'exemple`, JSON.stringify(pendant.filter((r) => r.m !== 'GET').slice(0, 6)));
  dit(bilan && bilan.ecrituresGardees > 0, `${T} E3 l'app a bien tenté d'écrire (gardé en mémoire : ${bilan && bilan.ecrituresGardees})`, JSON.stringify(bilan));
  dit(!TRACES.some((t) => JSON.stringify(base.lignes).includes(t)), `${T} E3 aucune trace de l'exemple dans la base`);
  // E4 : on sort.
  base.phase = 'apres';
  await Promise.all([o.pg.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}), o.pg.click('[data-exemple-brancher]')]);
  await o.pg.waitForSelector('[data-guide-demarrage]', { timeout: 20000 }).catch(() => {});
  await o.pg.waitForTimeout(1500);
  const apres = await stockageReel(o.pg);
  const resteBandeau = await o.pg.evaluate(() => !!document.querySelector('[data-exemple-bandeau]'));
  const corpsApres = await o.pg.evaluate(() => document.body.innerText);
  const cleOnglet = await o.pg.evaluate(() => sessionStorage.getItem('vrm_mode_exemple'));
  dit(!resteBandeau && !/taille \d\d/.test(corpsApres), `${T} E4 après « Brancher mes comptes » : plus de bandeau, plus aucune donnée de l'exemple`);
  dit(!!(await o.pg.$('[data-guide-demarrage] [data-exemple-entrer]')), `${T} E4 retour sur SON compte vide : le guide et « Découvrir avec des exemples »`);
  dit(cleOnglet == null, `${T} E4 la clé de l'onglet est retirée`, cleOnglet);
  dit(apres.vrm_session === avant.vrm_session && apres.vrm_local_owner === avant.vrm_local_owner, `${T} E4 la vraie session est intacte`);
  const traceStock = Object.entries(apres).filter(([k, v]) => TRACES.some((t) => String(k).includes(t) || String(v).includes(t)));
  dit(!traceStock.length, `${T} E4 aucune trace de l'exemple dans le stockage réel de l'appareil`, traceStock.map(([k]) => k).join(', '));
  dit(!TRACES.some((t) => JSON.stringify(base.lignes).includes(t)), `${T} E4 aucune trace de l'exemple dans la base`);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

async function parcoursGuide(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[guide ${W}px ${theme}]`;
  const NUMS = { 51000: { numero: '1' }, 51001: { numero: '2' } };
  const COMPTE = [{ id: 1, vinted_user_id: '9001', login: 'compte_banc', domain: 'www.vinted.fr', owner: UID, updated_at: iso(0), created_at: iso(3) }];
  const main = (extra) => ({ id: 'main', owner: UID, data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) }, vrm_configuration: { etat: 'fait', at: iso(1), statut: null, version: 1 }, ...extra } });
  const DRESSING = { id: 'harvest_9001_listings', owner: UID, data: { type: 'listings', uid: '9001', capturedAt: iso(0), nItems: 0, payload: { items: [] } } };
  const RECEPTION = { id: 'email_reception_00aa11bb22cc33dd', owner: UID, data: { at: iso(1), adresses: ['boite@exemple.test'] } };
  // G1
  { const base = { lignes: [main({ vinted_annonce_numeros: NUMS }), RECEPTION], comptes: [], requetes: [], phase: 'g1' };
    const o = await ouvrir(nav, { W, sombre, base }); await o.pg.waitForSelector('[data-guide-demarrage]', { timeout: 15000 }).catch(() => {}); await o.pg.waitForTimeout(2000);
    const g = await guide(o.pg);
    dit(g && g.faites === '1' && g.etats.compte === 'fait' && !('emails' in g.etats) && g.courante === 'extension', `${T} G1 compte et e-mails prouvés, aucun compte Vinted : 1 sur 3 (les e-mails ne comptent plus), on continue par l'extension`, JSON.stringify(g));
    await capture(o.pg, `ex-${W}-${theme}-3-guide-g1`);
    await o.ctx.close(); }
  // G2
  const COMMENCE = { vrm_parcours: { v: 1, etape: 'vinted', ouvert: false, fini: null, at: iso(0) } };
  { const base = { lignes: [main(COMMENCE)], comptes: COMPTE, requetes: [], phase: 'g2' };
    const o = await ouvrir(nav, { W, sombre, base }); await o.pg.waitForSelector('[data-guide-demarrage]', { timeout: 15000 }).catch(() => {}); await o.pg.waitForTimeout(2000);
    const g = await guide(o.pg);
    dit(g && g.etats.extension === 'fait' && g.etats.vinted === 'attente' && g.courante === 'vinted' && !g.exemple, `${T} G2 un compte relié : extension cochée, Vinted attend la première lecture, plus d'exemple proposé`, JSON.stringify(g));
    const geste = await taille(o.pg, '[data-guide-demarrage] [data-parcours-continuer]');
    dit(geste && geste.vis && (!o.tel || geste.h >= 43.5), `${T} G2 le geste « Continuer » est là`, JSON.stringify(geste));
    await capture(o.pg, `ex-${W}-${theme}-4-guide-g2`);
    if (await o.pg.$('[data-guide-masquer]')) {
      await o.pg.click('[data-guide-masquer]'); await o.pg.waitForTimeout(1500);
      const reste = await o.pg.$('[data-guide-demarrage]');
      const ecrit = base.lignes.some((l) => l.id === 'main' && l.data && l.data.vrm_guide_masque);
      dit(!reste && ecrit, `${T} G2 « Masquer le guide » le retire et l'écrit dans la ligne main`, JSON.stringify({ reste: !!reste, ecrit }));
    } else dit(false, `${T} G2 « Masquer le guide » existe`);
    await o.ctx.close(); }
  // G3
  { const base = { lignes: [main(COMMENCE)], comptes: COMPTE, requetes: [], phase: 'g3', panneLecture: true };
    const o = await ouvrir(nav, { W, sombre, base }); await o.pg.waitForSelector('[data-guide-demarrage]', { timeout: 15000 }).catch(() => {}); await o.pg.waitForTimeout(2000);
    const g = await guide(o.pg);
    dit(g && g.etats.vinted === 'passu' && g.courante === 'vinted', `${T} G3 lecture de Vinted en panne : ni cochée ni « à faire » (pas su), l'étape reste (« pas pu vérifier »)`, JSON.stringify(g));
    await o.ctx.close(); }
  // G4
  { const base = { lignes: [main({ vinted_annonce_numeros: NUMS }), RECEPTION, DRESSING, { id: 'harvest_9001_orders_sold', owner: UID, data: { type: 'orders_sold', uid: '9001', capturedAt: iso(0), nItems: 5, payload: { my_orders: [] } } }], comptes: COMPTE, requetes: [], phase: 'g4' };
    const o = await ouvrir(nav, { W, sombre, base }); await o.pg.waitForTimeout(4500);
    const g = await guide(o.pg);
    dit(!g, `${T} G4 tout est prouvé : aucun guide`, JSON.stringify(g));
    dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close(); }
}

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      await parcoursExemple(nav, W, theme);
      await parcoursGuide(nav, W, theme);
    }
  } catch (e) { dit(false, 'le banc a pu aller au bout', String(e && e.stack || e).slice(0, 400)); }
  await nav.close(); srv.close();
  console.log(ko ? `\n❌ mode exemple / guide : ${ko} défaut(s)` : '\n✅ mode exemple / guide : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
