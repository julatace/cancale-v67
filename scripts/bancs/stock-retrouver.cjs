// Banc : RETROUVER N'IMPORTE QUEL ARTICLE DANS « MES MEUBLES » (28 octobre)
//
// Julien : « je veux pouvoir retrouver facilement n'importe quel article ».
// Sur des données INVENTÉES (dépôt public), aux deux tailles, il exige :
//   1. la recherche (plusieurs mots, sans accent) ne rend QUE les articles qui
//      correspondent, et dit pour chacun le meuble, la rangée et la colonne ;
//   2. un N° seul se juge par IDENTITÉ (« 12 » ne rend pas la N°128) ;
//   3. un N° absent du stock le dit (jamais une liste vide muette) ;
//   4. toucher un résultat montre SA case (elle clignote) ;
//   5. la fiche d'une case dit « rangée … colonne … » ;
//   6. sur ordinateur, un chiffre tapé n'importe où ouvre la recherche.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 6471;

const MAIN = {
  vinted_annonce_numeros: {
    '9001': { numero: '12', title: 'Nike Air Max 1 noir taille 42' },
    '9002': { numero: '128', title: 'Adidas Samba blanche taille 40' },
    '9003': { numero: '31', title: 'Salomon XT-6 Écru taille 43' },
    '9004': { numero: '7', title: 'Nike Dunk Low grise taille 41' },
  },
  vrm_meubles: [{ id: 'mA', name: 'Étagère salon', cols: 4, rows: 3 }],
  // N°12 : rangée 2, colonne 3 (case 6) ; N°128 : rangée 1, colonne 1 ; N°31 pas rangée.
  vrm_slots: { '12': { m: 'mA', i: 6 }, '128': { m: 'mA', i: 0 }, '7': { m: 'mA', i: 11 } },
};
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);

async function rendre(b, tel) {
  const ctx = await b.newContext({ viewport: tel ? { width: 390, height: 844 } : { width: 1512, height: 950 }, ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j([]);
    if (/id=eq\.main/.test(u)) return j([{ id: 'main', data: MAIN }]);
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.addInitScript((m) => { try { localStorage.setItem('vrm_acces_direct', '1'); for (const k in m) localStorage.setItem(k, JSON.stringify(m[k])); localStorage.setItem('vinted_garage_view', JSON.stringify('meubles')); } catch (_) {} }, MAIN);
  await pg.goto(`http://localhost:${PORT}/?tab=garage`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-stock-recherche] input', { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(1200);
  if (process.env.SHOT) { await pg.screenshot({ path: process.env.SHOT + (tel ? '-390' : '-1512') + '.png' }); console.log((await pg.evaluate(() => document.body.innerText)).slice(0, 600)); }
  return { ctx, pg, errs };
}
const res = (pg) => pg.evaluate(() => ({
  n: (document.querySelector('[data-stock-resultats]') || {}).getAttribute ? document.querySelector('[data-stock-resultats]').getAttribute('data-stock-resultats') : null,
  nums: [...document.querySelectorAll('[data-stock-res]')].map((x) => x.getAttribute('data-stock-res')),
  ou: [...document.querySelectorAll('[data-stock-ou]')].map((x) => x.getAttribute('data-stock-ou')),
  rien: !!document.querySelector('[data-stock-rien]'),
  sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
}));

(async () => {
  let b;
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le scénario a tourné jusqu’au bout', String(e && e.message).slice(0, 400)); } };
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const tel of [false, true]) {
      const t = tel ? '390 px' : '1512 px';
      await essaie(t, async () => {
        const r = await rendre(b, tel);
        const inp = r.pg.locator('[data-stock-recherche] input');
        dit(await inp.count() === 1, `${t} : la recherche est là, en haut du Stock`);
        await inp.fill('nike 42');
        let x = await res(r.pg);
        dit(JSON.stringify(x.nums) === '["12"]', `${t} : « nike 42 » ne rend que la N°12`, JSON.stringify(x.nums));
        dit(x.ou[0] === 'Étagère salon|2|3', `${t} : elle dit OÙ : Étagère salon, rangée 2, colonne 3`, x.ou[0]);
        await inp.fill('ecru');
        x = await res(r.pg);
        dit(JSON.stringify(x.nums) === '["31"]' && x.ou[0] === 'non-range', `${t} : « ecru » (sans accent) trouve la N°31, dite « pas encore rangée »`, JSON.stringify(x));
        await inp.fill('12');
        x = await res(r.pg);
        dit(x.nums[0] === '12' && !x.nums.includes('128'), `${t} : « 12 » rend la N°12, jamais la N°128`, JSON.stringify(x.nums));
        await inp.fill('999');
        x = await res(r.pg);
        dit(x.rien, `${t} : un N° absent du stock est DIT`, JSON.stringify(x));
        await inp.fill('nike 42');
        await r.pg.click('[data-stock-res="12"]');
        await r.pg.waitForTimeout(1200);
        const flash = await r.pg.evaluate(() => { const el = document.querySelector('[data-case-num="12"]'); if (!el) return null; const rc = el.getBoundingClientRect(); const c = document.querySelector('[data-stock-cibles]'); return { cls: el.className, r: [Math.round(rc.top), Math.round(rc.bottom), innerHeight], vu: rc.top >= 0 && rc.bottom <= innerHeight, liste: !!document.querySelector('[data-stock-resultats]'), cible: c ? c.innerText : '' }; });
        dit(flash && /vrm-case-flash/.test(flash.cls) && flash.vu, `${t} : toucher le résultat montre SA case, à l'écran, qui clignote`, JSON.stringify(flash));
        dit(flash && !flash.liste && /N°12/.test(flash.cible) && /rangée 2, colonne 3/.test(flash.cible), `${t} : la liste se referme, la place reste écrite`, JSON.stringify(flash));
        await inp.fill('');
        await r.pg.click('[data-case-num="12"]');
        await r.pg.waitForTimeout(400);
        const fiche = await r.pg.evaluate(() => (document.querySelector('[data-fiche-place]') || {}).innerText || '');
        dit(/Rangée 2/.test(fiche) && /colonne 3/.test(fiche), `${t} : la fiche dit rangée 2, colonne 3`, fiche);
        await r.pg.keyboard.press('Escape').catch(() => {});
        await r.pg.click('[data-stock-modale]', { position: { x: 5, y: 5 } }).catch(() => {});
        if (!tel) {
          await r.pg.waitForTimeout(300);
          await r.pg.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
          await r.pg.keyboard.press('Digit7');
          await r.pg.waitForTimeout(300);
          const v = await r.pg.evaluate(() => ({ val: document.querySelector('[data-stock-recherche] input').value, focus: document.activeElement === document.querySelector('[data-stock-recherche] input') }));
          dit(v.val === '7' && v.focus, `${t} : un chiffre tapé n'importe où ouvre la recherche`, JSON.stringify(v));
          x = await res(r.pg);
          dit(x.nums[0] === '7', `${t} : … et rend la N°7`, JSON.stringify(x.nums));
        }
        x = await res(r.pg);
        dit(x.sw <= x.cw + 1, `${t} : aucun débordement`, `${x.sw} > ${x.cw}`);
        dit(r.errs.length === 0, `${t} : aucune erreur d'app`, r.errs.join(' | ').slice(0, 200));
        await r.ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} échec(s)` : '\nTout est vert');
  process.exit(ko ? 1 : 0);
})();
