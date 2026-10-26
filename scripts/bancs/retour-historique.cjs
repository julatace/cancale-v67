require('./_porte-banc.cjs');
// Banc « le bouton retour revient à l'écran d'avant » (18 octobre). Aucune
// fixture : la base est vide (toute lecture rend `[]`), on ne juge que la
// NAVIGATION. Avant, aucun changement d'écran n'entrait dans l'historique : le
// geste « retour » d'Android, le balayage de bord sur iPhone ou ← sur ordinateur
// QUITTAIENT VRM. On exige, aux deux tailles :
//   · trois écrans ouverts au clic ⇒ deux « retour » ramènent au premier, dans
//     l'ordre, sans quitter l'app (l'adresse reste celle de VRM) ;
//   · « avancer » rejoue l'écran suivant ;
//   · une SECTION d'une plateforme (Ventes → Annonces) est une entrée aussi ;
//   · un changement d'onglet ne crée qu'UNE entrée (pas une par section posée).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
const PORT = Number(process.env.BANC_PORT) || 7311;
srv.on('error', e => { console.log('⚠️ port ' + PORT + ' pris (' + e.code + ') — relance avec BANC_PORT'); process.exit(1); });
srv.listen(PORT);

(async () => {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const [W, H, tag, tactile] of [[390, 844, '390', true], [1512, 950, '1512', false]]) {
      const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: tactile, hasTouch: tactile });
      const pg = await ctx.newPage();
      await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
      await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
        const u = r.request().url();
        if (/supabase\.co/.test(u) && /select=owner/.test(u)) return r.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
        if (/supabase\.co/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        if (/\/api\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        return r.abort();
      });
      await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
      const base = `http://localhost:${PORT}/`;
      await pg.goto(base);
      const NAV = tactile ? 'nav.vrm-mobile-nav' : 'nav.vrm-sidebar';
      await pg.waitForSelector(NAV, { timeout: 20000 });
      await pg.waitForTimeout(800);
      const actif = () => pg.evaluate((n) => { const e = document.querySelector(n + ' [aria-current="page"]'); return e ? e.getAttribute('aria-label') : null; }, NAV);
      const labels = await pg.$$eval(NAV + ' button[aria-label]', (l) => l.map(e => e.getAttribute('aria-label')));
      const a0 = await actif();
      const autres = labels.filter(l => l && l !== a0 && !/Paramètres|Menu|Plus/i.test(l));
      const [l1, l2] = autres;
      const clic = async (l) => { await pg.click(`${NAV} button[aria-label="${l}"]`); await pg.waitForTimeout(400); };
      const lg0 = await pg.evaluate(() => history.length);
      await clic(l1); await clic(l2);
      const lg2 = await pg.evaluate(() => history.length);
      dit((await actif()) === l2, `[${tag}] le troisième écran est ouvert`, l2);
      dit(lg2 - lg0 === 2, `[${tag}] deux écrans ouverts = deux entrées d'historique (pas une par section)`, `${lg2 - lg0}`);
      await pg.goBack({ waitUntil: 'commit' }).catch(() => {}); await pg.waitForTimeout(400);
      dit((await actif()) === l1 && pg.url().startsWith(base), `[${tag}] « retour » revient à l'écran d'avant`, `${await actif()} · ${pg.url()}`);
      await pg.goBack({ waitUntil: 'commit' }).catch(() => {}); await pg.waitForTimeout(400);
      dit((await actif()) === a0 && pg.url().startsWith(base), `[${tag}] un second « retour » revient au premier écran, sans quitter VRM`, `${await actif()} · ${pg.url()}`);
      await pg.goForward({ waitUntil: 'commit' }).catch(() => {}); await pg.waitForTimeout(400);
      dit((await actif()) === l1, `[${tag}] « avancer » rejoue l'écran suivant`, `${await actif()}`);
      // Une section d'une plateforme : la première qui a une sous-navigation.
      const vinted = labels.find(l => /Vinted/i.test(l));
      if (vinted) {
        await clic(vinted);
        const sections = await pg.$$eval('[data-section]', (l) => l.map(e => ({ id: e.getAttribute('data-section'), on: e.getAttribute('aria-current') === 'page' })));
        const cur = sections.find(s => s.on), cible = sections.find(s => !s.on);
        if (cur && cible) {
          await pg.click(`[data-section="${cible.id}"]`); await pg.waitForTimeout(400);
          await pg.goBack({ waitUntil: 'commit' }).catch(() => {}); await pg.waitForTimeout(400);
          const apres = await pg.$eval('[data-section][aria-current="page"]', e => e.getAttribute('data-section')).catch(() => null);
          dit(apres === cur.id && (await actif()) === vinted, `[${tag}] « retour » revient à la section d'avant (${cible.id} → ${cur.id})`, `${apres}`);
        } else dit(false, `[${tag}] sections de Vinted trouvées`, JSON.stringify(sections));
      } else dit(false, `[${tag}] onglet Vinted trouvé`, labels.join(', '));
      // Une FEUILLE ouverte : « retour » la ferme d'abord, sans changer d'écran.
      const RECH = 'button[aria-label="Rechercher une paire"]';
      const ouverte = () => pg.$('button[aria-label="Fermer la recherche"]').then(e => !!e);
      if (await pg.$(RECH)) {
        await clic(l1);
        const avant = await actif();
        await pg.click(RECH); await pg.waitForTimeout(400);
        dit(await ouverte(), `[${tag}] la recherche s'ouvre`);
        await pg.goBack({ waitUntil: 'commit' }).catch(() => {}); await pg.waitForTimeout(500);
        dit(!(await ouverte()) && (await actif()) === avant && pg.url().startsWith(base), `[${tag}] « retour » ferme la feuille ouverte, sans changer d'écran`, `${await ouverte()} · ${await actif()} · ${pg.url()}`);
        // Fermée par ×, son entrée part : le retour suivant change bien d'écran.
        await pg.click(RECH); await pg.waitForTimeout(400);
        await pg.click('button[aria-label="Fermer la recherche"]'); await pg.waitForTimeout(500);
        await pg.goBack({ waitUntil: 'commit' }).catch(() => {}); await pg.waitForTimeout(500);
        dit((await actif()) !== avant && pg.url().startsWith(base), `[${tag}] fermée par ×, le « retour » suivant revient à l'écran d'avant (pas un retour à vide)`, `${await actif()}`);
      } else dit(false, `[${tag}] bouton de recherche trouvé`);
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a rapporté au lieu de mourir', e.message.slice(0, 200)); }
  await b.close(); srv.close();
  console.log(ko ? `\n❌ ${ko} contrôle(s) en échec` : '\n✅ retour : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
