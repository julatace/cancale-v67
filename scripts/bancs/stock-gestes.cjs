// Banc : LES GESTES FRÉQUENTS DU STOCK, DE L'ANNONCE ET DES FAVORIS (1er novembre)
//
// Julien : « tout doit être parfait, logique et simple d'utilisation ». Sur des
// données INVENTÉES (dépôt public), à 390 px tactile et à 1512 px, il exige :
//   A. Stock → Cases : taper le N° d'une paire À RANGER dit qu'elle n'est pas
//      rangée et propose « Ranger ici » (rien n'est écrit avant le clic ; le clic
//      écrit CETTE paire dans la case proposée) ; un N° absent du stock le dit.
//   B. Stock → Meubles : la case vide se nomme « rangée, colonne » (plus
//      « Case 6 ») ; poser une paire se DIT (message avec le meuble, la rangée,
//      la colonne) ; la fiche d'une paire pas rangée propose « Ranger dans une
//      case », jamais « Déplacer » ni « Retirer de la case ».
//   C. Annonces (Vinted) : ni le résumé d'argent ni « À faire aujourd'hui »
//      (ils restent sur Ventes). (La phrase « numéro, jamais redonné » : banc
//      `republier.cjs`, qui sert des annonces en ligne.)
//   D. Favoris & offres : « Favoris reçus » porte une icône au trait, comme
//      « Conversations » (pas un caractère ♡).
// Juge des data-* et la géométrie, jamais un libellé seul (§6.4).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 6481;
const CAPT = process.env.CAPTURES || os.tmpdir();

const PLAN = { rooms: [{ id: 'r1', name: 'Garage test', room: { w: 8, h: 6, wallH: 3 }, items: [
  { id: 'g1', type: 'grille', name: 'Grille A', x: 1, y: 0, w: 1, h: 0.5, rows: 3, cols: 2, cell: 0.5, slots: { '2_0': ['1'] } },
] }], active: 'r1' };
const NUMEROS = {
  a1: { numero: '1', title: 'Nike Air Max 90 blanc taille 42', numberedAt: 1 },
  a2: { numero: '2', title: 'Adidas Samba noir taille 40', numberedAt: 2 },
  '9001': { numero: '12', title: 'Nike Air Max 1 noir taille 42' },
  '9003': { numero: '31', title: 'Salomon XT-6 Écru taille 43' },
};
const MEUBLES = [{ id: 'mA', name: 'Étagère salon', cols: 4, rows: 3 }];
const SLOTS = { '12': { m: 'mA', i: 6 } };

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi + ' — le contrôle a pu s’exécuter', String(e && e.message || e).slice(0, 160)); return null; } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);

async function ouvrir(b, tel, tab, vue) {
  const ctx = await b.newContext({ viewport: tel ? { width: 390, height: 844 } : { width: 1512, height: 950 }, ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ecritures = [];
  await pg.addInitScript(([n, m, s, vue]) => { try {
    localStorage.setItem('vrm_acces_direct', '1');
    localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n));
    localStorage.setItem('vrm_meubles', JSON.stringify(m));
    localStorage.setItem('vrm_slots', JSON.stringify(s));
    localStorage.setItem('vinted_nums_physiques', JSON.stringify({ nums: ['1', '2', '12', '31'], at: Date.now() }));
    if (vue) localStorage.setItem('vinted_garage_view', JSON.stringify(vue));
  } catch (_) {} }, [NUMEROS, MEUBLES, SLOTS, vue || null]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') {
      let corps = null; try { corps = JSON.parse(req.postData() || 'null'); } catch (_) {}
      (Array.isArray(corps) ? corps : [corps]).forEach((c) => { if (c && c.id === 'vrm_room') ecritures.push(c.data); });
      return j([]);
    }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j([{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
    if (/id=eq\.vrm_room&/.test(u)) return j([{ data: JSON.parse(JSON.stringify(PLAN)) }]);
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, ecritures };
}
const toasts = (pg) => pg.evaluate(() => [...document.querySelectorAll('.vrm-toast')].map((t) => t.innerText));

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const tel of [true, false]) {
      const qui = tel ? '390' : '1512';
      console.log(`\n── ${qui} px ──`);

      // ── A. Cases : « Où est la N° … ? » sur une paire à ranger ──
      await essaie(`A ${qui}`, async () => {
        const { ctx, pg, errs, ecritures } = await ouvrir(b, tel, 'garage', 'ranger');
        await pg.waitForSelector('[data-rangement] [data-rgt-cherche]', { timeout: 25000 });
        await pg.waitForSelector('[data-a-ranger="2"]', { timeout: 10000 });
        await pg.fill('[data-rgt-cherche]', '2');
        const prop = await pg.waitForSelector('[data-rgt-a-ranger="2"]', { timeout: 4000 }).then(() => true).catch(() => false);
        dit(prop, `A. ${qui} : taper le N° d'une paire à ranger le dit, au lieu de « aucune case »`);
        dit(await pg.locator('[data-rgt-ranger-trouve="2"]').count() === 1, `A. ${qui} : … avec « Ranger ici » à côté`);
        dit(ecritures.length === 0, `A. ${qui} : rien n'est écrit avant le clic`, String(ecritures.length));
        await pg.screenshot({ path: path.join(CAPT, `stock-gestes-cases-${qui}.png`) });
        await pg.click('[data-rgt-ranger-trouve="2"]');
        await pg.waitForTimeout(900);
        const der = ecritures[ecritures.length - 1];
        const g1 = der && der.rooms && der.rooms[0].items.find((x) => x.id === 'g1');
        const ou = g1 ? Object.entries(g1.slots || {}).filter(([, a]) => a.map(String).includes('2')).map(([k]) => k) : [];
        dit(ou.length === 1, `A. ${qui} : le clic range la N°2 dans une case de la grille`, JSON.stringify(ou));
        dit(g1 && JSON.stringify(g1.slots['2_0']) === '["1"]', `A. ${qui} : la N°1 n'a pas bougé (aucun autre numéro touché)`, g1 ? JSON.stringify(g1.slots) : 'pas d’écriture');
        await pg.fill('[data-rgt-cherche]', '77');
        dit(await pg.waitForSelector('[data-rgt-absente]', { timeout: 3000 }).then(() => true).catch(() => false), `A. ${qui} : un N° absent du stock le dit`);
        dit(errs.length === 0, `A. ${qui} : aucune erreur d'app`, errs.join(' | '));
        await ctx.close();
      });

      // ── B. Meubles : case en mots, retour après la pose, fiche d'une paire pas rangée ──
      await essaie(`B ${qui}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, tel, 'garage', 'meubles');
        await pg.waitForSelector('[data-stock-recherche] input', { timeout: 25000 });
        await pg.waitForTimeout(800);
        // La fiche d'une paire PAS rangée (N°31) ouverte depuis la recherche.
        await pg.fill('[data-stock-recherche] input', '31');
        await pg.click('[data-stock-res="31"]');
        await pg.waitForSelector('[data-stock-modale]', { timeout: 4000 });
        dit(await pg.locator('[data-fiche-ranger="ranger"]').count() === 1, `B. ${qui} : paire pas rangée ⇒ « Ranger dans une case »`);
        dit(await pg.locator('[data-stock-modale] button', { hasText: 'Retirer de la case' }).count() === 0, `B. ${qui} : … et pas « Retirer de la case »`);
        await pg.click('[data-stock-modale] [aria-label="Fermer"]');
        // Une case vide : rangée 1, colonne 2 de l'Étagère salon (index 1).
        await pg.click('[data-meuble="mA"] [data-meuble-grille] button[aria-label="Case vide — rangée 1, colonne 2"]');
        const nom = await pg.waitForSelector('[data-placer-case]', { timeout: 4000 }).then((e) => e.getAttribute('data-placer-case')).catch(() => null);
        dit(nom === '1:2', `B. ${qui} : la case à remplir se nomme par sa rangée et sa colonne`, String(nom));
        await pg.screenshot({ path: path.join(CAPT, `stock-gestes-placer-${qui}.png`) });
        await pg.locator('[data-stock-modale] button', { hasText: 'N°31' }).first().click();
        await pg.waitForTimeout(500);
        const t = await toasts(pg);
        dit(t.some((x) => /N°31/.test(x) && /rangée 1, colonne 2/.test(x) && /Étagère salon/.test(x)), `B. ${qui} : poser la paire se DIT (meuble, rangée, colonne)`, JSON.stringify(t));
        const slots = await pg.evaluate(() => JSON.parse(localStorage.getItem('vrm_slots') || '{}'));
        dit(slots['31'] && slots['31'].m === 'mA' && slots['31'].i === 1, `B. ${qui} : … et la N°31 est bien dans cette case`, JSON.stringify(slots['31']));
        await pg.screenshot({ path: path.join(CAPT, `stock-gestes-pose-${qui}.png`) });
        dit(errs.length === 0, `B. ${qui} : aucune erreur d'app`, errs.join(' | '));
        await ctx.close();
      });

      // ── E. (1er nov., audit X7) Ranger dans une case OCCUPÉE demande, jamais en silence ──
      // N°12 est dans la case i=6 (rangée 2, colonne 3). On choisit N°31 (pas rangée)
      // puis on touche la case de N°12 : une question nomme N°12 ; « Annuler » ne
      // change rien ; « À ranger » le fait ET le dit ; l'occupante ne disparaît jamais
      // du plan sans un mot.
      await essaie(`E ${qui}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, tel, 'garage', 'meubles');
        await pg.waitForSelector('[data-meuble="mA"] [data-meuble-grille]', { timeout: 25000 });
        await pg.waitForTimeout(800);
        const choisir31 = async () => { await pg.locator('button[aria-label^="Ranger la paire N°31"]').first().click(); await pg.waitForTimeout(200); };
        const case12 = '[data-meuble="mA"] [data-meuble-grille] button[aria-label="N°12 — rangée 2, colonne 3"]';
        await choisir31();
        await pg.click(case12);
        const q = await pg.waitForSelector('[data-ask-choix]', { timeout: 3000 }).then(() => true).catch(() => false);
        dit(q, `E. ${qui} : toucher une case occupée DEMANDE (feuille de choix)`);
        const txt = q ? await pg.evaluate(() => { const c = document.querySelector('[data-ask-choix]'); return c ? c.parentElement.innerText : ''; }) : '';
        const opts = q ? await pg.evaluate(() => [...document.querySelectorAll('[data-ask-choix] [data-choix]')].map((x) => x.getAttribute('data-choix'))) : [];
        dit(/N°12/.test(txt) && opts.includes('aranger') && opts.includes('choisir'), `E. ${qui} : … elle nomme l'occupante N°12 et propose où la mettre`, JSON.stringify(opts));
        await pg.screenshot({ path: path.join(CAPT, `stock-gestes-occupee-${qui}.png`) });
        let slots = await pg.evaluate(() => JSON.parse(localStorage.getItem('vrm_slots') || '{}'));
        dit(slots['12'] && slots['12'].i === 6 && !slots['31'], `E. ${qui} : rien n'est écrit avant la réponse`, JSON.stringify(slots));
        if (q) {
          await pg.locator('[data-ask-choix] ~ button, [data-ask-choix] + button').first().click().catch(async () => { await pg.keyboard.press('Escape'); });
          await pg.waitForTimeout(400);
        }
        slots = await pg.evaluate(() => JSON.parse(localStorage.getItem('vrm_slots') || '{}'));
        dit(slots['12'] && slots['12'].i === 6 && !slots['31'], `E. ${qui} : « Annuler » ne change rien (N°12 reste dans sa case)`, JSON.stringify(slots));
        await choisir31();
        await pg.click(case12);
        if (await pg.waitForSelector('[data-ask-choix] [data-choix="aranger"]', { timeout: 3000 }).then(() => true).catch(() => false)) {
          await pg.click('[data-ask-choix] [data-choix="aranger"]');
          await pg.waitForTimeout(600);
        }
        slots = await pg.evaluate(() => JSON.parse(localStorage.getItem('vrm_slots') || '{}'));
        const t = await toasts(pg);
        dit(slots['31'] && slots['31'].i === 6 && !slots['12'], `E. ${qui} : « À ranger » : N°31 prend la case, N°12 sort de la case`, JSON.stringify(slots));
        dit(t.some((x) => /N°31/.test(x) && /N°12/.test(x) && /À ranger/.test(x)), `E. ${qui} : … et le message dit où est N°12`, JSON.stringify(t));
        dit(errs.length === 0, `E. ${qui} : aucune erreur d'app`, errs.join(' | '));
        await ctx.close();
      });

      // ── C. Annonces : pas d'argent, pas de « À faire aujourd'hui » ; Ventes les garde ──
      await essaie(`C ${qui}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, tel, 'annonces');
        await pg.waitForSelector('[data-tache="annonces"][data-tache-site="vinted"]', { timeout: 25000 });
        await pg.waitForTimeout(2500);
        const a = await pg.evaluate(() => {
          const t = document.querySelector('[data-tache="annonces"]');
          const b = [...t.querySelectorAll('b')].find((x) => x.textContent === 'numéro');
          return { strip: t.querySelectorAll('.vrm-summary-strip').length, journee: t.querySelectorAll('[data-vinted-majournee]').length, phrase: b ? getComputedStyle(b.parentElement).display : null };
        });
        dit(a.strip === 0, `C. ${qui} : Annonces ne montre pas le résumé d'argent`, JSON.stringify(a));
        dit(a.journee === 0, `C. ${qui} : … ni « À faire aujourd'hui »`, JSON.stringify(a));
        await pg.screenshot({ path: path.join(CAPT, `stock-gestes-annonces-${qui}.png`) });
        await pg.goto(`http://localhost:${PORT}/?tab=plat_vinted`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-tache="ventes"][data-tache-site="vinted"]', { timeout: 25000 });
        await pg.waitForTimeout(2000);
        const v = await pg.evaluate(() => ({ site: (document.querySelector('[data-tache]') || {}).getAttribute && document.querySelector('[data-tache]').getAttribute('data-tache-site'), journee: document.querySelectorAll('[data-tache] [data-vinted-majournee]').length }));
        dit(v.site === 'vinted' && v.journee === 1, `C. ${qui} : Ventes · Vinted garde « À faire aujourd'hui »`, JSON.stringify(v));
        dit(errs.length === 0, `C. ${qui} : aucune erreur d'app`, errs.join(' | '));
        await ctx.close();
      });

      // ── D. Favoris & offres : une icône au trait ──
      await essaie(`D ${qui}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, tel, 'messages');
        await pg.waitForSelector('.vrm-messages-sections', { timeout: 25000 });
        const d = await pg.evaluate(() => [...document.querySelectorAll('.vrm-messages-sections button')].map((x) => ({ svg: x.querySelectorAll('svg').length, t: x.innerText.trim() })));
        dit(d.length === 2 && d.every((x) => x.svg === 1 && !/♡/.test(x.t)), `D. ${qui} : Conversations et Favoris reçus portent chacun une icône au trait`, JSON.stringify(d));
        dit(errs.length === 0, `D. ${qui} : aucune erreur d'app`, errs.join(' | '));
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc a tourné', String(e && e.message || e)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ gestes du stock : ${ko} rouge(s)` : '\n✅ gestes du stock : tout est vert');
  process.exit(ko ? 1 : 0);
})();
