// Banc : eBay › AUTOMATISMES (28 nov., lot ebay-automatismes) — la page RENDUE (vrai dist/), données INVENTÉES,
// 390 px tactile et 1512 px, clair et sombre. Ce qui doit rester vrai (jugé sur les data-*, §6.5) :
//   · les quatre moteurs s'affichent ÉTEINTS par défaut (data-eauto-actif="0"), le plancher et sa fraîcheur sont dits ;
//   · allumer un moteur DEMANDE (la confirmation de l'app) : « Annuler » ⇒ rien n'est envoyé ; « Allumer » ⇒ UNE requête
//     `autoregler` avec `confirme: true` ; changer un palier ensuite ne redemande rien ;
//   · la modification en masse : cocher deux annonces, −10 %, « Revoir » ⇒ la feuille dit chaque ligne (celle sous son
//     plancher en ambre, `data-eauto-ligne-ok="0"`) ; « Appliquer » n'envoie QUE les lignes permises, avec le prix VU ;
//   · aucun débordement horizontal, cibles ≥ 44 px au doigt, aucune erreur de page ; captures à regarder (BANC_CAPTURE).
// Lancer : npm run build, puis BANC_PORT=4883 node scripts/bancs/ebay-automatismes.cjs
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 4883;
const CAPT = process.env.BANC_CAPTURE || path.join(os.tmpdir(), 'banc-ebay-automatismes');
try { fs.mkdirSync(CAPT, { recursive: true }); } catch (_) {}

const auj = new Date();
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const ROWS = [{ id: 'main', data: { vinted_annonce_numeros: {} } }, { id: 'ebay_listings', data: { items: [], capturedAt: Date.now() } }, { id: 'ebay_orders', data: { orders: [], capturedAt: Date.now() } }];
const ANNONCES = [
  { itemId: '120000000001', titre: 'Nike Dunk Low panda taille 42', prixC: 10000, devise: 'EUR', num: '41', plancherC: 8000, observateurs: 3, photo: '', url: 'https://www.ebay.fr/itm/120000000001' },
  { itemId: '120000000002', titre: 'Salomon XT-6 noir taille 41', prixC: 8500, devise: 'EUR', num: '43', plancherC: 8000, observateurs: 0, photo: '', url: 'https://www.ebay.fr/itm/120000000002' },
  { itemId: '120000000003', titre: 'Asics Gel 1130 argent taille 39 — une annonce au titre très long pour voir la coupe', prixC: 7000, devise: 'EUR', num: '', plancherC: null, observateurs: 2, photo: '', url: 'https://www.ebay.fr/itm/120000000003' },
];
const JOURNAL = [
  { at: Date.now() - 3600000, moteur: 'baisse', itemId: '120000000009', num: '38', avantC: 9000, apresC: 8100, plancherC: 7000, etat: 'fait', compte: 'principal' },
  { at: Date.now() - 7200000, moteur: 'offres', itemId: '120000000008', num: '36', avantC: 6000, apresC: 5400, pct: 10, etat: 'fait', compte: 'principal' },
  { at: Date.now() - 9000000, moteur: 'relance', itemId: '120000000007', num: '77', etat: 'saute', raison: 'pas-prouvee', compte: 'principal' },
];
const REGLAGES = { baisse: { actif: false, pct: 5, jours: 14 }, offres: { actif: false, pct: 10, heures: 48, periode: 7 }, paliers: { actif: false, preset: 'standard' }, relance: { actif: false, parJour: 3, gratuitSeul: true } };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 200)); return null; } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT=…)'); process.exit(1); });
srv.listen(PORT);

async function ouvrir(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const envois = [];
  let reglages = JSON.parse(JSON.stringify(REGLAGES));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_ebay_guide_vu', 'true'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', async (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) }).catch(() => {});
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map((r) => ({ ...r, updated_at: auj.toISOString() })));
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.route('**/api/ebay**', (route) => {
    const req = route.request();
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (req.method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    envois.push(body);
    if (body.action === 'status') return j({ ok: true, connected: true, comptes: [{ cle: '', pseudo: 'banc_ebay', principal: true, relie: true, type: 'particulier', site: 'FR', siteLu: true, marche: { nom: 'eBay.fr', devise: 'EUR', domaine: 'www.ebay.fr', pays: 'FR' } }] });
    if (body.action === 'autolire') return j({ ok: true, reglages, dernier: { at: Date.now() - 3600000, gestes: 2 }, journal: JOURNAL, planchers: { etat: 'ok', at: Date.now() - 2 * 3600000, n: 12 }, majoration: 0, annonces: body.annonces ? ANNONCES : null });
    if (body.action === 'autoregler') {
      const avant = reglages; const m = Object.keys(body.reglages || {})[0];
      const apres = { ...reglages, [m]: { ...reglages[m], ...body.reglages[m] } };
      if (!avant[m].actif && apres[m].actif && body.confirme !== true) return j({ ok: false, reason: 'confirmation', error: 'confirme' }, 400);
      reglages = apres; return j({ ok: true, reglages, allumes: [] });
    }
    if (body.action === 'masse') return j({ ok: true, op: body.op, faites: (body.lignes || []).length, lignes: (body.lignes || []).map((l) => ({ itemId: l.itemId, ok: true, etat: 'fait' })) });
    if (body.action === 'similaire') return j({ ok: true, brouillon: 'b-sim-1', photos: 1 });
    if (body.action === 'autolancer') return j({ ok: true, bilan: { gestes: 0 } });
    return j({ ok: true });
  });
  return { ctx, pg, errs, envois };
}
const lirePage = (pg) => pg.evaluate(() => {
  const r = document.querySelector('[data-eauto]');
  return { etat: r ? r.getAttribute('data-eauto') : null,
    moteurs: [...document.querySelectorAll('[data-eauto-moteur]')].map((e) => [e.getAttribute('data-eauto-moteur'), e.getAttribute('data-eauto-actif')]),
    plancher: (document.querySelector('[data-eauto-plancher]') || { getAttribute: () => null }).getAttribute('data-eauto-plancher'),
    annonces: document.querySelectorAll('[data-eauto-annonce]').length, journal: document.querySelectorAll('[data-eauto-journal]').length,
    mort: /n'a pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
});
const petites = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-eauto] button, [data-eauto] a, [data-eauto] input, [data-eauto] [role=radio]')]
  .filter((e) => e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden').map((e) => { const x = (e.tagName === 'INPUT' && e.closest('label')) || e; const r = x.getBoundingClientRect(); return { t: (e.innerText || e.getAttribute('aria-label') || e.tagName).slice(0, 30), h: Math.round(r.height) }; })
  .filter((c) => c.h > 0 && c.h < 44));

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('KO  pas de dist/ : npm run build d’abord'); process.exit(1); }
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 390, height: 844 }, true], [{ width: 1512, height: 900 }, false], [{ width: 1512, height: 900 }, true]]) {
    const nom = vp.width + (sombre ? '-sombre' : '-clair');
    await essaie(nom, async () => {
      const { ctx, pg, errs, envois } = await ouvrir(b, vp, sombre);
      await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(2500);
      await pg.evaluate(() => window.dispatchEvent(new Event('vrm:ebay-automatismes')));
      await pg.waitForSelector('[data-eauto="pret"]', { timeout: 30000 });
      await pg.waitForTimeout(600);
      const s = await lirePage(pg);
      dit(s.etat === 'pret' && !s.mort, nom + ' : la page est rendue', JSON.stringify(s));
      dit(s.moteurs.length === 4 && s.moteurs.every(([, a]) => a === '0'), nom + ' : les quatre moteurs sont ÉTEINTS par défaut', JSON.stringify(s.moteurs));
      dit(s.plancher === 'ok' && s.annonces === 3 && s.journal === 3, nom + ' : plancher dit, 3 annonces (N° et plancher), journal', JSON.stringify(s));
      dit(s.sw <= s.cw + 1, nom + ' : aucun débordement horizontal', s.sw + ' > ' + s.cw);
      await pg.screenshot({ path: path.join(CAPT, nom + '-haut.png'), fullPage: false });
      await pg.screenshot({ path: path.join(CAPT, nom + '-page.png'), fullPage: true });
      if (vp.width < 600 && !sombre) { const p = await petites(pg); dit(!p.length, nom + ' : cibles ≥ 44 px au doigt', JSON.stringify(p.slice(0, 6))); }
      // Allumer : la confirmation de l'app. Annuler ⇒ rien.
      const n0 = envois.filter((x) => x.action === 'autoregler').length;
      await pg.click('[data-eauto-moteur="baisse"] input[role="switch"], [data-eauto-moteur="baisse"]', { force: true });
      await pg.waitForSelector('.vrm-confirmation', { timeout: 8000 });
      await pg.screenshot({ path: path.join(CAPT, nom + '-confirmation.png') });
      await pg.locator('.vrm-confirmation button', { hasText: /Annuler|Cancel/ }).first().click();
      await pg.waitForTimeout(600);
      dit(envois.filter((x) => x.action === 'autoregler').length === n0 && (await lirePage(pg)).moteurs.find(([m]) => m === 'baisse')[1] === '0', nom + ' : « Annuler » ⇒ rien n’est envoyé, la baisse reste éteinte', '');
      await pg.click('[data-eauto-moteur="baisse"] input[role="switch"], [data-eauto-moteur="baisse"]', { force: true });
      await pg.waitForSelector('.vrm-confirmation', { timeout: 8000 });
      await pg.locator('.vrm-confirmation button', { hasText: /Allumer|Turn on/ }).first().click();
      await pg.waitForTimeout(1200);
      const reg = envois.filter((x) => x.action === 'autoregler');
      dit(reg.length === n0 + 1 && reg[reg.length - 1].confirme === true && reg[reg.length - 1].reglages.baisse.actif === true && (await lirePage(pg)).moteurs.find(([m]) => m === 'baisse')[1] === '1', nom + ' : « Allumer » ⇒ UNE requête avec confirme:true, la baisse s’allume', JSON.stringify(reg[reg.length - 1]));
      await pg.click('[data-eauto-reglages="baisse"] [data-eauto-choix="10"]');
      await pg.waitForTimeout(900);
      const reg2 = envois.filter((x) => x.action === 'autoregler');
      dit(reg2.length === n0 + 2 && reg2[reg2.length - 1].reglages.baisse.pct === 10 && !reg2[reg2.length - 1].confirme && !(await pg.$('.vrm-confirmation')), nom + ' : changer le palier (−10 %) ne redemande rien', JSON.stringify(reg2[reg2.length - 1]));
      // La modification en masse.
      for (const id of ['120000000001', '120000000002']) await pg.click(`[data-eauto-annonce="${id}"] input[type=checkbox], [data-eauto-annonce="${id}"] .n-rangee-case`, { force: true }).catch(() => {});
      await pg.waitForTimeout(300);
      await pg.click('[data-eauto-masse] [data-eauto-op="10"]');
      await pg.click('[data-eauto-revoir]');
      await pg.waitForSelector('[data-eauto-recap]', { timeout: 8000 });
      await pg.waitForTimeout(700);
      const lignes = await pg.evaluate(() => [...document.querySelectorAll('[data-eauto-ligne]')].map((e) => [e.getAttribute('data-eauto-ligne'), e.getAttribute('data-eauto-ligne-ok'), e.getAttribute('data-eauto-apres-c')]));
      dit(JSON.stringify(lignes) === JSON.stringify([['120000000001', '1', '9000'], ['120000000002', '0', '7650']]), nom + ' : récapitulatif : 100 → 90 € permis, 85 → 76,50 € sous le plancher (refusé, en ambre)', JSON.stringify(lignes));
      await pg.screenshot({ path: path.join(CAPT, nom + '-recap.png') });
      await pg.click('[data-eauto-appliquer]');
      await pg.waitForTimeout(1500);
      const m = envois.filter((x) => x.action === 'masse');
      dit(m.length === 1 && m[0].confirme === true && m[0].lignes.length === 1 && m[0].lignes[0].itemId === '120000000001' && m[0].lignes[0].prixVu === '100.00' && m[0].pct === 10, nom + ' : « Appliquer » n’envoie QUE la ligne permise, avec le prix vu', JSON.stringify(m));
      dit(!errs.length, nom + ' : aucune erreur de page', errs.slice(0, 2).join(' | '));
      await ctx.close();
    });
  }
  await b.close(); srv.close();
  console.log(`\n${ok} OK · ${ko} KO — captures : ${CAPT}`);
  process.exit(ko ? 1 : 0);
})();
