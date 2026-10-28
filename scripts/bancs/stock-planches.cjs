// Banc : LES PLANCHES ET LA GRAVITÉ DE « MES MEUBLES » (28 octobre)
//
// Julien : « quand on enlève un article, ceux du dessus descendent — il faut
// pouvoir faire des barres », « pas imaginaires justement ». Données INVENTÉES.
// Il exige, aux deux tailles : les planches dessinées ; retirer un article fait
// descendre ceux du dessus JUSQU'À la planche, jamais au travers ; poser dans une
// case du haut tombe en bas ; un meuble NON empilé garde son trou ; l'éditeur
// pose une planche et l'enregistre.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 6481;

const MAIN = {
  vinted_annonce_numeros: {
    'a1': { numero: '1', title: 'Paire Un' }, 'a2': { numero: '2', title: 'Paire Deux' },
    'a3': { numero: '3', title: 'Paire Trois' }, 'a4': { numero: '4', title: 'Paire Quatre' },
    'a5': { numero: '5', title: 'Paire Cinq' }, 'a6': { numero: '6', title: 'Paire Six' }, 'a7': { numero: '7', title: 'Paire Sept' },
    'a8': { numero: '8', title: 'Paire Huit' }, 'a9': { numero: '9', title: 'Paire Neuf' }, 'a10': { numero: '10', title: 'Paire Dix' }, 'a11': { numero: '11', title: 'Paire Onze' },
  },
  // mG : 2 colonnes × 4 rangées, EMPILÉ, une planche sous la rangée 2.
  // Colonne 1 : N°4 r1, N°3 r2 | planche | N°2 r3, N°1 r4.
  // mF : 1 × 3, PAS empilé : N°6 r1, N°7 r2, rien r3.
  vrm_meubles: [{ id: 'mG', name: 'Etagere pile', cols: 2, rows: 4, gravite: true, planches: [2] }, { id: 'mF', name: 'Casier fixe', cols: 1, rows: 3 },
    // mP : 2 × 3, EMPILÉ, une planche PARTIELLE sous la rangée 1, colonne 1 seulement.
    // Col 1 : N°8 r1 | planche | vide r2, N°9 r3. Col 2 : N°10 r1, vide r2, N°11 r3.
    { id: 'mP', name: 'Etagere partielle', cols: 2, rows: 3, gravite: true, planches: ['1:1'] }],
  vrm_slots: { '4': { m: 'mG', i: 0 }, '3': { m: 'mG', i: 2 }, '2': { m: 'mG', i: 4 }, '1': { m: 'mG', i: 6 }, '6': { m: 'mF', i: 0 }, '7': { m: 'mF', i: 1 }, '8': { m: 'mP', i: 0 }, '9': { m: 'mP', i: 4 }, '10': { m: 'mP', i: 1 }, '11': { m: 'mP', i: 5 } },
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
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j([{ id: 1, vinted_user_id: '111', login: 'compte_garde', domain: 'www.vinted.fr', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
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
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j([{ id: 1, vinted_user_id: '111', login: 'compte_garde', domain: 'www.vinted.fr', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
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
const ou = (pg, n) => pg.evaluate((n) => { const el = document.querySelector(`[data-case-num="${n}"]`); if (!el) return null; const m = /rangée (\d+), colonne (\d+)/.exec(el.getAttribute('aria-label') || ''); return m ? `${el.closest('[data-meuble]').getAttribute('data-meuble')}:${m[1]}.${m[2]}` : null; }, n);
const retirer = async (pg, n) => { await pg.click(`[data-case-num="${n}"]`); await pg.click('button:has-text("Retirer de la case")'); await pg.waitForTimeout(300); };

(async () => {
  let b;
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le scénario a tourné jusqu’au bout', String(e && e.message).slice(0, 400)); } };
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const tel of [false, true]) {
      const t = tel ? '390 px' : '1512 px';
      await essaie(t, async () => {
        const r = await rendre(b, tel);
        const pl = await r.pg.evaluate(() => [...document.querySelectorAll('[data-meuble="mG"] [data-planche]')].map((x) => x.getAttribute('data-planche')).join(','));
        dit(pl === '2', `${t} : la planche sous la rangée 2 est dessinée`, pl);
        await retirer(r.pg, '1');
        dit(await ou(r.pg, '2') === 'mG:4.1', `${t} : N°1 retirée (en bas) ⇒ N°2 descend en rangée 4`, await ou(r.pg, '2'));
        dit(await ou(r.pg, '3') === 'mG:2.1' && await ou(r.pg, '4') === 'mG:1.1', `${t} : N°3 et N°4, au-dessus de la planche, ne passent PAS au travers`, `${await ou(r.pg, '3')} ${await ou(r.pg, '4')}`);
        await retirer(r.pg, '3');
        dit(await ou(r.pg, '4') === 'mG:2.1', `${t} : N°3 retirée ⇒ N°4 descend sur la planche (rangée 2)`, await ou(r.pg, '4'));
        // Poser N°5 dans une case du HAUT de la colonne 2 : elle tombe en bas.
        await r.pg.click('[data-meuble="mG"] button[aria-label="Case vide — rangée 3, colonne 2"]');
        await r.pg.click('[data-stock-modale] button:has-text("N°5")');
        await r.pg.waitForTimeout(300);
        dit(await ou(r.pg, '5') === 'mG:4.2', `${t} : N°5 posée en rangée 3 tombe en rangée 4`, await ou(r.pg, '5'));
        // Meuble non empilé : le trou reste.
        await retirer(r.pg, '6');
        dit(await ou(r.pg, '7') === 'mF:2.1', `${t} : meuble non empilé — N°7 ne bouge pas`, await ou(r.pg, '7'));
        // L'éditeur : poser une planche sous la rangée 3, enregistrer.
        await r.pg.click('[data-meuble="mG"] button[aria-label="Modifier le meuble"]');
        const avant = await r.pg.getAttribute('[data-planche-choix="3"]', 'aria-pressed');
        await r.pg.click('[data-planche-choix="3"]');
        await r.pg.click('[data-meuble-enregistrer]');
        await r.pg.waitForTimeout(1200);  // save() écrit l'appareil après 500 ms
        const pl2 = await r.pg.evaluate(() => [...document.querySelectorAll('[data-meuble="mG"] [data-planche]')].map((x) => x.getAttribute('data-planche')).join(','));
        const sauve = await r.pg.evaluate(() => { try { return JSON.stringify((JSON.parse(localStorage.getItem('vrm_meubles')) || []).find((m) => m.id === 'mG')); } catch (_) { return ''; } });
        dit(avant === 'false' && pl2 === '2,3' && /"planches":\[2,3\]/.test(sauve) && /"gravite":true/.test(sauve), `${t} : l'éditeur pose la planche, elle est dessinée et enregistrée`, `${avant} ${pl2} ${sauve}`);
        dit(await ou(r.pg, '2') === 'mG:4.1' && await ou(r.pg, '4') === 'mG:2.1', `${t} : les articles restent à leur place après l'enregistrement`, `${await ou(r.pg, '2')} ${await ou(r.pg, '4')}`);
        if (process.env.SHOT) { await r.pg.evaluate(() => document.querySelector('[data-meuble="mG"]').scrollIntoView()); await r.pg.screenshot({ path: process.env.SHOT + (tel ? '-390' : '-1512') + '.png' }); }
        // Planche PARTIELLE (colonne par colonne).
        const pc = await r.pg.evaluate(() => ({ cases: [...document.querySelectorAll('[data-meuble="mP"] [data-planche-case]')].map((x) => x.getAttribute('data-planche-case')).join(','), pleines: document.querySelectorAll('[data-meuble="mP"] [data-planche]').length }));
        dit(pc.cases === '1:1' && pc.pleines === 0, `${t} : la planche partielle n'est dessinée que sous la colonne 1`, JSON.stringify(pc));
        await retirer(r.pg, '9');
        dit(await ou(r.pg, '8') === 'mP:1.1', `${t} : colonne 1 — N°8 reste posée sur SA planche partielle`, await ou(r.pg, '8'));
        await retirer(r.pg, '11');
        dit(await ou(r.pg, '10') === 'mP:3.2', `${t} : colonne 2 (sans planche) — N°10 descend tout en bas`, await ou(r.pg, '10'));
        await r.pg.click('[data-meuble="mP"] button[aria-label="Modifier le meuble"]');
        await r.pg.click('[data-planche-case-choix="2:2"]');
        if (process.env.DBG) { console.log(await r.pg.evaluate(() => { const b = document.querySelector('[data-planche-case-choix="2:2"]'); const q = b.getBoundingClientRect(); const e = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2); return JSON.stringify({ q, press: b.getAttribute('aria-pressed'), top: e && e.outerHTML.slice(0, 120) }); })); }
        await r.pg.click('[data-meuble-enregistrer]');
        await r.pg.waitForTimeout(1200);
        const sauveP = await r.pg.evaluate(() => { try { return JSON.stringify((JSON.parse(localStorage.getItem('vrm_meubles')) || []).find((m) => m.id === 'mP').planches); } catch (_) { return ''; } });
        const pc2 = await r.pg.evaluate(() => [...document.querySelectorAll('[data-meuble="mP"] [data-planche-case]')].map((x) => x.getAttribute('data-planche-case')).join(','));
        dit(sauveP === '["1:1","2:2"]' && pc2 === '1:1,2:2', `${t} : l'éditeur pose une planche sous une seule colonne, dessinée et enregistrée`, `${sauveP} ${pc2}`);
        dit(await ou(r.pg, '10') === 'mP:3.2', `${t} : N°10, sous la nouvelle planche, reste en bas`, await ou(r.pg, '10'));
        // Le bouton ⟷ fait toute la largeur : rangée 1 devient pleine (rangée en nombre).
        await r.pg.click('[data-meuble="mP"] button[aria-label="Modifier le meuble"]');
        await r.pg.click('[data-planche-choix="1"]');
        await r.pg.click('[data-meuble-enregistrer]');
        await r.pg.waitForTimeout(1200);
        const sauveP2 = await r.pg.evaluate(() => { try { return JSON.stringify((JSON.parse(localStorage.getItem('vrm_meubles')) || []).find((m) => m.id === 'mP').planches); } catch (_) { return ''; } });
        dit(sauveP2 === '[1,"2:2"]', `${t} : ⟷ pose la planche sur toute la largeur`, sauveP2);
        const x = await r.pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        dit(x.sw <= x.cw + 1, `${t} : aucun débordement`, `${x.sw} > ${x.cw}`);
        dit(r.errs.length === 0, `${t} : aucune erreur d'app`, r.errs.join(' | ').slice(0, 200));
        await r.ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} échec(s)` : '\nTout est vert');
  process.exit(ko ? 1 : 0);
})();
