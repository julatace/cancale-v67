// Banc : l'onglet Favoris rend-il, et « Ouvrir » copie-t-il bien le montant ?
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs = require('fs');
const PAN = fs.readFileSync('/home/user/cancale-v67/vinted-sync-extension/vinted-panel.js', 'utf8');

const DATA = {
  ok: true,          // ⚠️ le panneau jette la réponse sans `ok` (§21)
  online: [
    { id: '1', title: 'adidas spezial noir 38', price: 45, favs: 5, views: 120, minPrice: 38, buyPrice: 20, photo: '', url: 'https://www.vinted.fr/items/1', numero: '7' },
    { id: '2', title: 'nike zoom fly 5 blanc 42', price: 60, favs: 2, views: 40, photo: '', url: 'https://www.vinted.fr/items/2', numero: '12' },
    { id: '3', title: 'salomon xt-6 38', price: 30, favs: 1, buyPrice: 29, minPrice: 25, photo: '', url: 'https://www.vinted.fr/items/3' },
  ],
  byId: {}, sleeping: [], relance: [], noNum: [], toShip: [], pickups: [], bordsToPrint: [],
  convs: [], quickReplies: [], appStats: {}, goal: 0, stats: {}, accounts: [], sales: [],
  recentSales: [], recentBuys: [], disputes: [], offers: [], coffre: [], compteActif: '111',
};
(async () => {
  let ko = 0; const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader'] });
  const pg = await b.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await pg.route('**/*', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' }));
  await pg.addInitScript(d => {
    window.__copies = []; window.__ouverts = [];
    localStorage.setItem('vrm_panel_open', '1'); localStorage.setItem('vrm_panel_tab', 'favoris');
    window.chrome = {
      runtime: { sendMessage: (m, cb) => { const r = m && m.action === 'panelData' ? d : { ok: true }; if (typeof cb === 'function') cb(r); return Promise.resolve(r); }, lastError: null },
      storage: { local: { get: (k, cb) => { const o = {}; if (typeof cb === 'function') { cb(o); return; } return Promise.resolve(o); }, set: (o, cb) => { if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); } } },
    };
    window.open = (u) => { window.__ouverts.push(u); return null; };
    navigator.clipboard.writeText = (t) => { window.__copies.push(String(t)); return Promise.resolve(); };
  }, DATA);
  await pg.goto('https://www.vinted.fr/member/items');
  await pg.addScriptTag({ content: PAN });
  await pg.waitForTimeout(500);
  await pg.evaluate(() => { const f = document.querySelector('#vrm-fab'); if (f) f.click(); });
  await pg.waitForTimeout(400);

  const txt = () => pg.evaluate(() => (document.querySelector('#vrm-panel') || document.body).innerText);
  let T = await txt();
  dit(/favoris en attente/.test(T), "l'onglet Favoris rend");
  dit(/Vinted ne dit jamais QUI a mis en favori/.test(T),
    "il dit franchement que Vinted ne nomme pas les personnes");
  dit(/propose\s*38\s*€/.test(T.replace(/\s+/g, ' ')) || /38 €/.test(T),
    'le montant à proposer est calculé (plancher 38 € sur une annonce à 45 €)');
  dit(/29 € serait sous ton prix d'achat|sous ton prix d'achat/.test(T),
    "jamais de remise sous le prix d'achat");

  // on coche 1 annonce et on lance le défilement
  await pg.evaluate(() => { const c = document.querySelector('.vrm-fav-chk[data-k="1"]'); if (c) { c.click(); } });
  await pg.waitForTimeout(300);
  await pg.evaluate(() => { const g = [...document.querySelectorAll('.vrm-fav-go')].find(x => x.dataset.act === 'start'); if (g) g.click(); });
  await pg.waitForTimeout(300);
  T = await txt();
  dit(/Annonce 1 \/ 1/.test(T.replace(/\s+/g, ' ')), 'le défilement démarre sur la sélection');

  await pg.evaluate(() => { const g = [...document.querySelectorAll('.vrm-fav-go')].find(x => x.dataset.act === 'open'); if (g) g.click(); });
  await pg.waitForTimeout(300);
  const cop = await pg.evaluate(() => window.__copies);
  const ouv = await pg.evaluate(() => window.__ouverts);
  dit(cop.includes('38'), '« Ouvrir » copie le montant en même temps', JSON.stringify(cop));
  dit(ouv.some(u => /items\/1/.test(u)), '« Ouvrir » ouvre bien l\'annonce', JSON.stringify(ouv));
  const app = errs.filter(e => !/net::|ERR_/.test(e));
  dit(app.length === 0, "0 erreur d'app", app.slice(0, 2).join(' | '));
  await b.close();
  console.log(ko ? `\n${ko} contrôle(s) non conforme(s).` : '\nOnglet Favoris conforme.');
  process.exit(ko ? 1 : 0);
})();
