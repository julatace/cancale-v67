require('./_porte-banc.cjs');
// BANC — LA VISITE EN BULLES ET LES ONGLETS NUS (2 nov.).
// Julien : « une démo visuelle un peu comme Vinteer : des petits nuages qui
// montrent les fonctionnalités quand tu crées ton compte, mais il ne doit pas y
// avoir des écritures partout à côté des onglets, c'est vraiment dégueulasse ».
// Aucune donnée réelle : un compte VRM neuf (aucun compte Vinted), base servie
// par le banc ; la ligne `main` écrite par l'app est GARDÉE par le banc et
// relue au rechargement (le « vu » doit passer par la ligne synchronisée, pas
// seulement par le stockage de l'appareil).
// Exige, à 390 px tactile et à 1512 px :
//   V1  Bienvenue fermée ⇒ la visite s'ouvre, UNE bulle à la fois ;
//   V2  chaque bulle pointe un élément VISIBLE de la navigation (sa cible est dans
//       la fenêtre, la flèche de la bulle tombe sur elle), et ne déborde pas ;
//   V3  une phrase de 12 mots au plus, sans jargon ; points de progression ;
//       « Suivant » et « Passer » font 44 px ; le focus est DANS la bulle et Tab y reste ;
//   V4  la dernière bulle « Terminer » ferme ; le vu est écrit dans la ligne `main`
//       (clé `vrm_visite_vue`) — rechargée, avec le stockage de l'appareil VIDÉ
//       de cette clé, elle ne revient pas ;
//   V5  Échap ferme (et note vu) ; un toucher dehors ferme (et note vu) ;
//   V6  un onglet absent (pas de compte : pas de « Messages » visible…) ⇒ sa bulle
//       est sautée, jamais une bulle dans le vide ;
//   V7  « Revoir la visite » dans Paramètres la rejoue ;
//   V8  mouvement réduit : aucune animation sur la bulle ;
//   V9  ONGLETS NUS : aucun texte permanent à côté des onglets (colonne, barre du
//       bas, « Plus ») — chaque entrée ne dit que son nom (et une pastille-nombre) ;
//   V10 UNE PHRASE PAR ÉCRAN : Journée, Annonces, Ventes, Colis, Messages,
//       Paramètres disent sous leur titre une phrase courte (src/phrasesEcran.js),
//       sans jargon, et au plus UN bouton principal visible.
// Le contrôle du code d'avant (§6.1) : lancé sur un `dist/` du commit d'avant,
// V1 (pas de visite), V9 (« Ventes · eBay : commandes… » sous eBay) et V10
// (pas de phrase) sont rouges.
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const http = require('http'), fs = require('fs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4973;
const CAPTURES = process.env.BANC_CAPTURES || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'banc@exemple.fr' } };
// La règle, lue dans le source (une source, §11) — sans exécuter de module ESM.
const lireSource = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'src', f), 'utf8');
const MOTS_MAX = Number((/MOTS_MAX = (\d+)/.exec(lireSource('visiteBulles.js')) || [])[1]) || 12;
const SRC_PHRASES = lireSource('phrasesEcran.js');
const MOTS_MAX_PHRASE = Number((/MOTS_MAX_PHRASE = (\d+)/.exec(SRC_PHRASES) || [])[1]) || 10;
const JARGON = /\b(capt[ée]e?s?|captur\w*|harvest|payload|sync\w*|synchro\w*|relu[es]?|relire|moisson\w*|scrap\w*|fetch\w*)\b/i;
const mots = (t) => String(t || '').trim().split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${!bon && det ? ' — ' + det : ''}`); };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

// `base` : la ligne `main` du banc, partagée entre les pages d'un même scénario
// (deux pages = deux chargements du même compte).
async function page(nav, { telephone, base, comptes = [], reduit = false, tab = 'journee', bienvenueVue = true, sansVisiteLocale = false }) {
  const ctx = await nav.newContext({ ...(telephone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), reducedMotion: reduit ? 'reduce' : 'no-preference' });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  await pg.addInitScript(([s, bv, sansLocal]) => {
    try {
      localStorage.setItem('vrm_banc_visite', '1');
      if (!sessionStorage.getItem('banc_init')) {
        // La porte de banc (_porte-banc.cjs) marque la visite vue avant ce script
        // pour les AUTRES bancs : ce banc la juge, il retire sa marque, une fois.
        if (localStorage.getItem('vrm_visite_vue') === JSON.stringify({ at: 'banc' })) localStorage.removeItem('vrm_visite_vue');
        localStorage.setItem('vrm_session', JSON.stringify(s));
        localStorage.setItem('vrm_local_owner', s.user.id);
        if (bv) localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' }));
        else { localStorage.setItem('vrm_banc_bienvenue', '1'); localStorage.removeItem('vrm_bienvenue_vue'); }
        sessionStorage.setItem('banc_init', '1');
      }
      // L'appareil a « oublié » le vu : seule la ligne du nuage peut le dire.
      if (sansLocal) localStorage.removeItem('vrm_visite_vue');
    } catch (_) {}
  }, [SESSION, bienvenueVue, sansVisiteLocale]);
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const u = decodeURIComponent(r.request().url()); const m = r.request().method();
    const json = (d, st = 200) => r.fulfill({ status: st, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: JSON.stringify(d) });
    if (/vinted_accounts/.test(u) && m === 'GET') return json(comptes);
    if (/app_data/.test(u) && /id=eq\.main/.test(u) && m === 'GET') return json(base.data ? [{ id: 'main', owner: SESSION.user.id, data: base.data, updated_at: new Date().toISOString() }] : []);
    if (/app_data/.test(u) && m === 'POST') {
      try { const b = JSON.parse(r.request().postData() || '{}'); const row = Array.isArray(b) ? b.find((x) => x.id === 'main') : (b.id === 'main' ? b : null); if (row) { base.data = row.data; base.ecritures++; } } catch (_) {}
      return json([], 201);
    }
    if (/app_data/.test(u) && /id=eq\.main/.test(u) && m === 'PATCH') {
      try { const b = JSON.parse(r.request().postData() || '{}'); if (b && b.data) { base.data = b.data; base.ecritures++; } } catch (_) {}
      return json([{ id: 'main' }]);
    }
    return json([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.route('**://*.vinted.net/**', (r) => r.abort());
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('.vrm-main'), null, { timeout: 15000 }).catch(() => {});
  return { ctx, pg, erreurs };
}
const attendreBulle = (pg, ms = 6000) => pg.waitForSelector('.vrm-visite-bulle[data-cote]:not([data-cote="mesure"])', { timeout: ms }).then(() => true).catch(() => false);
// Ce que la bulle montre : sa cible, ses rectangles, son texte, ses boutons.
const lireBulle = (pg) => pg.evaluate(() => {
  const v = document.querySelector('.vrm-visite'); if (!v) return null;
  const b = v.querySelector('.vrm-visite-bulle'); const sel = v.getAttribute('data-visite-cible');
  const cibles = [...document.querySelectorAll(sel)].filter((e) => !e.closest('.vrm-visite'));
  const vis = cibles.find((e) => { const r = e.getBoundingClientRect(); return e.getClientRects().length && r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && getComputedStyle(e).visibility !== 'hidden'; });
  const rb = b.getBoundingClientRect(); const rc = vis ? vis.getBoundingClientRect() : null;
  const fl = b.querySelector('.vrm-visite-fleche').getBoundingClientRect();
  const cote = b.getAttribute('data-cote');
  // La pointe de la flèche tombe-t-elle en face de la cible ?
  const fx = fl.left + fl.width / 2, fy = fl.top + fl.height / 2;
  const enFace = rc ? (cote === 'droite' ? (fy >= rc.top - 2 && fy <= rc.bottom + 2 && fl.left <= rc.right + 20) : (fx >= rc.left - 2 && fx <= rc.right + 2)) : false;
  const boutons = [...b.querySelectorAll('button')].map((x) => { const r = x.getBoundingClientRect(); return { t: x.innerText.trim(), w: Math.round(r.width), h: Math.round(r.height) }; });
  return {
    cle: v.getAttribute('data-visite'), sel, visible: !!vis, enFace, cote,
    dedans: rb.left >= 0 && rb.top >= 0 && rb.right <= innerWidth + 0.5 && rb.bottom <= innerHeight + 0.5,
    texte: (b.querySelector('[data-visite-texte]') || {}).innerText || '', live: (b.querySelector('[aria-live]') || null) !== null,
    boutons, focusDedans: b.contains(document.activeElement), nBulles: document.querySelectorAll('.vrm-visite-bulle').length,
    rang: b.querySelector('[data-visite-rang]') && b.querySelector('[data-visite-rang]').getAttribute('data-visite-rang'),
    total: b.querySelector('[data-visite-total]') && b.querySelector('[data-visite-total]').getAttribute('data-visite-total'),
    anim: getComputedStyle(b).animationName,
  };
});
const visiteVueDansMain = (base) => !!(base.data && base.data.vrm_visite_vue);
const capture = async (pg, nom) => { if (!CAPTURES) return; fs.mkdirSync(CAPTURES, { recursive: true }); await pg.screenshot({ path: path.join(CAPTURES, nom + '.png') }); };

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  try {
    for (const telephone of [true, false]) {
      const W = telephone ? 390 : 1512; const T = `[${W}]`;
      console.log(`── ${W} px`);
      // ── Parcours complet : Suivant jusqu'au bout.
      const base = { data: null, ecritures: 0 };
      const a = await page(nav, { telephone, base });
      const ouverte = await attendreBulle(a.pg, 9000);
      dit(ouverte, `${T} V1 compte neuf, Bienvenue vue ⇒ la visite s'ouvre`);
      if (ouverte) {
        const vues = []; let tour = 0;
        while (tour++ < 12) {
          const b = await lireBulle(a.pg); if (!b) break;
          vues.push(b.cle);
          if (tour === 1) await capture(a.pg, `demo-bulles-${W}-premiere`);
          if (tour === 3) await capture(a.pg, `demo-bulles-${W}-troisieme`);
          dit(b.nBulles === 1, `${T} V1 « ${b.cle} » : une seule bulle à l'écran`, String(b.nBulles));
          dit(b.visible && b.enFace, `${T} V2 « ${b.cle} » pointe un élément VISIBLE (${b.cote})`, `${b.sel} visible=${b.visible} enFace=${b.enFace}`);
          dit(b.dedans, `${T} V2 « ${b.cle} » : la bulle tient dans l'écran`);
          dit(mots(b.texte) <= MOTS_MAX && !JARGON.test(b.texte) && b.live, `${T} V3 « ${b.cle} » : une phrase ≤ ${MOTS_MAX} mots, sans jargon, annoncée (aria-live)`, `${mots(b.texte)} mots : ${b.texte}`);
          dit(b.boutons.length >= 2 && b.boutons.every((x) => x.h >= 44 && x.w >= 44), `${T} V3 « ${b.cle} » : Suivant / Passer à 44 px`, JSON.stringify(b.boutons));
          dit(b.focusDedans && Number(b.total) >= 1 && Number(b.rang) === tour, `${T} V3 « ${b.cle} » : focus dans la bulle, point ${b.rang}/${b.total}`, `focus=${b.focusDedans}`);
          if (tour === 1) {
            for (let k = 0; k < 4; k++) await a.pg.keyboard.press('Tab');
            dit(await a.pg.evaluate(() => document.querySelector('.vrm-visite-bulle').contains(document.activeElement)), `${T} V3 Tab reste dans la bulle`);
          }
          const sv = a.pg.locator('[data-visite-suivant]');
          const fin = /Terminer/.test(await sv.innerText());
          await sv.click(); await a.pg.waitForTimeout(450);
          if (fin) break;
        }
        const attendu = telephone ? 'journee,annonces,ventes,colis,plus' : 'journee,annonces,ventes,messages,colis,parametres';
        dit(vues.join(',') === attendu, `${T} V1 les bulles, dans l'ordre de la navigation`, vues.join(','));
        dit(await a.pg.locator('.vrm-visite').count() === 0, `${T} V4 « Terminer » ferme la visite`);
        await a.pg.waitForTimeout(2600);
        dit(visiteVueDansMain(base), `${T} V4 le vu est écrit dans la ligne main (vrm_visite_vue)`, JSON.stringify(base.data && base.data.vrm_visite_vue));
      }
      dit(a.erreurs.length === 0, `${T} aucune erreur JS`, a.erreurs.join(' ¦ '));
      await a.ctx.close();
      // ── Rechargée sur un appareil qui a OUBLIÉ le vu : la ligne main suffit.
      const r = await page(nav, { telephone, base, sansVisiteLocale: true });
      dit(!(await attendreBulle(r.pg, 5000)), `${T} V4 rechargée (stockage de l'appareil vidé) : la visite ne revient pas`);
      // V9 — onglets nus, et V10 — une phrase par écran : sur cette même page.
      const nus = await r.pg.evaluate((tel) => {
        const out = [];
        const zones = tel ? ['.vrm-mobile-nav'] : ['.vrm-atelier-rail'];
        for (const z of zones) for (const e of document.querySelectorAll(z + ' [data-nav-entree]')) {
          const nom = (e.getAttribute('aria-label') || '').split('·')[0].trim();
          const texte = (e.innerText || '').replace(/\d+\+?/g, '').replace(/\s+/g, ' ').trim();
          const titre = e.getAttribute('title') || '';
          if (texte && nom && texte !== nom && !nom.startsWith(texte) && !texte.startsWith(nom)) out.push(`${nom} ⇒ « ${texte} »`);
          if (titre && titre !== nom) out.push(`${nom} ⇒ title « ${titre} »`);
        }
        return out;
      }, telephone);
      if (telephone && await r.pg.locator('.vrm-nav-more').count()) {
        await r.pg.locator('.vrm-nav-more').click(); await r.pg.waitForTimeout(500);
        const plus = await r.pg.evaluate(() => [...document.querySelectorAll('.vrm-sheet [data-nav-entree]')].map((e) => [(e.querySelector('.vrm-sheet-lib') || e).innerText.replace(/\d+\+?/g, '').trim(), e.querySelectorAll('.vrm-sheet-desc, small').length]).filter(([t, n]) => n > 0 || t.split('\n').length > 1).map(([t]) => t));
        for (const t of plus) nus.push(`Plus ⇒ « ${t.replace(/\n/g, ' / ')} »`);
        await capture(r.pg, `demo-bulles-${W}-plus`);
        await r.pg.keyboard.press('Escape'); await r.pg.waitForTimeout(300);
      }
      dit(nus.length === 0, `${T} V9 onglets nus : aucune explication collée à côté d'un onglet`, nus.join(' ¦ '));
      await r.ctx.close();
      // V9 aussi avec des sites (Plateformes de la colonne) : un compte de chaque, eBay compris.
      if (!telephone) {
        const avec = await page(nav, { telephone, base: { data: { vrm_bienvenue_vue: { at: 'banc' }, vrm_visite_vue: { at: 'banc' } }, ecritures: 0 }, comptes: [{ vinted_user_id: '777', login: 'vendeuse', owner: SESSION.user.id }] });
        await avec.pg.waitForTimeout(2500);
        const titres = await avec.pg.evaluate(() => [...document.querySelectorAll('.vrm-atelier-rail [data-nav-entree]')].map((e) => [e.getAttribute('aria-label'), e.getAttribute('title') || '', e.innerText.replace(/\d+\+?/g, '').trim()]).filter(([n, t, x]) => (t && t !== n) || (x && x !== n)).map((z) => z.join(' | ')));
        dit(titres.length === 0, `${T} V9 la colonne avec comptes : chaque entrée ne dit que son nom`, titres.join(' ¦ '));
        await avec.ctx.close();
      }
      // ── V10 : une phrase par écran (le compte neuf, visite déjà vue).
      // (Ma journée, Ventes et Colis : plus de phrase sous le titre — retiré à la demande de Julien, 2 nov. 22 h ;
      // le banc vérifie à la place qu'aucune phrase n'y est rendue.)
      // (Annonces, Messages, Paramètres : plus de phrase non plus — retiré à la demande de Julien, 3 nov. ;
      // reste vérifié : au plus un bouton principal visible.)
      const ECRANS = [['annonces', 'annonces'], ['messages', 'messages'], ['settings', 'settings']];

      const p10 = await page(nav, { telephone, base: { data: { vrm_bienvenue_vue: { at: 'banc' }, vrm_visite_vue: { at: 'banc' } }, ecritures: 0 }, comptes: [{ vinted_user_id: '777', login: 'vendeuse', owner: SESSION.user.id }] });
      for (const [tab, cle] of ECRANS) {
        await p10.pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
        await p10.pg.waitForTimeout(2600);
        const e = await p10.pg.evaluate((c) => {
          const ph = [...document.querySelectorAll(`[data-phrase-ecran="${c}"]`)].find((x) => { const r = x.getBoundingClientRect(); return x.getClientRects().length && r.width > 0 && getComputedStyle(x).visibility !== 'hidden'; });
          const prim = [...document.querySelectorAll('.vrm-main .vrm-b-primaire')].filter((b) => { const r = b.getBoundingClientRect(); return b.getClientRects().length && r.width > 0 && r.top < innerHeight && r.bottom > 0 && !b.closest('[hidden], details:not([open]) > :not(summary)'); }).map((b) => b.innerText.trim().slice(0, 30));
          return { phrase: ph ? ph.innerText.trim() : null, prim };
        }, cle);
        dit(!e.phrase, `${T} V10 ${cle} : aucune phrase sous le titre (retiré à la demande de Julien, 3 nov.)`, String(e.phrase));
        dit(e.prim.length <= 1, `${T} V10 ${cle} : au plus un bouton principal visible`, JSON.stringify(e.prim));
        if (CAPTURES && (cle === 'colis' || cle === 'annonces' || cle === 'settings')) await capture(p10.pg, `demo-bulles-${W}-ecran-${cle}`);
      }
      for (const [tab, cle] of [['journee', 'journee'], ['ventes', 'ventes'], ['cat_bord', 'colis']]) {
        await p10.pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
        await p10.pg.waitForTimeout(2600);
        const n = await p10.pg.evaluate((c) => [...document.querySelectorAll(`[data-phrase-ecran="${c}"]`)].filter((x) => x.getClientRects().length).length, cle);
        dit(n === 0, `${T} V10 ${cle} : aucune phrase sous le titre (maquette Fusion, retiré à la demande de Julien, 2 nov. 22 h)`, String(n));
      }
      await p10.ctx.close();
      // ── Échap ferme (et note vu).
      { const b2 = { data: null, ecritures: 0 }; const e = await page(nav, { telephone, base: b2 });
        if (await attendreBulle(e.pg, 9000)) { await e.pg.keyboard.press('Escape'); await e.pg.waitForTimeout(400);
          dit(await e.pg.locator('.vrm-visite').count() === 0, `${T} V5 Échap ferme la visite`);
          await e.pg.waitForTimeout(2600); dit(visiteVueDansMain(b2), `${T} V5 Échap la note vue (ligne main)`);
        } else dit(false, `${T} V5 Échap : la visite ne s'est pas ouverte`);
        await e.ctx.close(); }
      // ── Toucher dehors ferme.
      { const b3 = { data: null, ecritures: 0 }; const d = await page(nav, { telephone, base: b3 });
        if (await attendreBulle(d.pg, 9000)) {
          const pt = await d.pg.evaluate(() => { const r = document.querySelector('.vrm-visite-bulle').getBoundingClientRect(); const c = [[innerWidth / 2, 60], [innerWidth - 30, innerHeight / 2], [30, innerHeight / 2]]; return c.find(([x, y]) => x < r.left || x > r.right || y < r.top || y > r.bottom); });
          if (telephone) await d.pg.touchscreen.tap(pt[0], pt[1]); else await d.pg.mouse.click(pt[0], pt[1]);
          await d.pg.waitForTimeout(400);
          dit(await d.pg.locator('.vrm-visite').count() === 0, `${T} V5 un toucher dehors ferme la visite`);
          dit((await d.pg.evaluate(() => (history.state || {}).vrmTab || '')) !== 'annonces', `${T} V5 le toucher dehors ne déclenche rien dessous`);
        } else dit(false, `${T} V5 dehors : la visite ne s'est pas ouverte`);
        await d.ctx.close(); }
      // ── V6 : un onglet absent ⇒ sa bulle est sautée.
      { const b4 = { data: null, ecritures: 0 }; const s = await page(nav, { telephone, base: b4 });
        await s.pg.addStyleTag({ content: '[data-nav-entree="ventes"]{display:none !important}' });
        if (await attendreBulle(s.pg, 9000)) {
          const vues = []; for (let k = 0; k < 10; k++) { const b = await lireBulle(s.pg); if (!b) break; vues.push(b.cle); if (!b.visible) dit(false, `${T} V6 « ${b.cle} » pointe dans le vide`); const sv = s.pg.locator('[data-visite-suivant]'); const fin = /Terminer/.test(await sv.innerText()); await sv.click(); await s.pg.waitForTimeout(400); if (fin) break; }
          dit(!vues.includes('ventes') && vues.length >= 3, `${T} V6 onglet « Ventes » caché ⇒ sa bulle est sautée`, vues.join(','));
        } else dit(false, `${T} V6 : la visite ne s'est pas ouverte`);
        await s.ctx.close(); }
      // ── V7 : « Revoir la visite » (Paramètres).
      { const b5 = { data: { vrm_bienvenue_vue: { at: 'banc' }, vrm_visite_vue: { at: 'banc' } }, ecritures: 0 };
        const p7 = await page(nav, { telephone, base: b5, tab: 'settings' });
        await p7.pg.waitForTimeout(2500);
        dit(!(await attendreBulle(p7.pg, 800)), `${T} V7 déjà vue : rien ne s'ouvre seul`);
        const l = p7.pg.locator('[data-reglage-visite]');
        if (await l.count()) { await l.first().scrollIntoViewIfNeeded(); await l.first().click(); dit(await attendreBulle(p7.pg, 4000), `${T} V7 « Revoir la visite » la rejoue`); await capture(p7.pg, `demo-bulles-${W}-revoir`); }
        else dit(false, `${T} V7 « Revoir la visite » est dans Paramètres`);
        await p7.ctx.close(); }
      // ── V8 : mouvement réduit.
      { const b6 = { data: null, ecritures: 0 }; const m = await page(nav, { telephone, base: b6, reduit: true });
        if (await attendreBulle(m.pg, 9000)) { const b = await lireBulle(m.pg); dit(b.anim === 'none', `${T} V8 mouvement réduit : la bulle ne bouge pas`, b.anim); }
        else dit(false, `${T} V8 : la visite ne s'est pas ouverte`);
        await m.ctx.close(); }
      // ── L'autre sens : Bienvenue pas encore vue ⇒ la visite ne passe pas devant.
      { const b7 = { data: null, ecritures: 0 }; const n = await page(nav, { telephone, base: b7, bienvenueVue: false });
        await n.pg.waitForTimeout(2500);
        const etat = await n.pg.evaluate(() => [!!document.querySelector('.vrm-bienvenue'), !!document.querySelector('.vrm-visite')]);
        dit(etat[0] && !etat[1], `${T} la visite n'apparaît jamais par-dessus Bienvenue`, JSON.stringify(etat));
        // Bienvenue fermée (« Passer ») ⇒ la visite prend la suite.
        if (etat[0]) { await n.pg.click('[data-bienvenue-passer]'); dit(await attendreBulle(n.pg, 6000), `${T} Bienvenue fermée ⇒ la visite prend la suite`); }
        await n.ctx.close(); }
    }
  } catch (e) { dit(false, 'le banc a pu aller au bout', String(e.message).slice(0, 240)); }
  await nav.close(); srv.close();
  console.log(ko ? `\n❌ demo-bulles : ${ko} défaut(s)` : '\n✅ demo-bulles : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
