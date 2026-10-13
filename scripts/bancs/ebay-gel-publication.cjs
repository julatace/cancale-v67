// K1 rendu : données inventées, réseau extérieur entièrement simulé.
// Sert le build courant sur BANC_PORT (défaut 4847).
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { projette } = require('../_fond-vm.cjs');
const { metaVersData } = require('./_meta.cjs');
const PORT = Number(process.env.BANC_PORT || 4847);
const now = Date.now(), iso = new Date(now).toISOString();
const accounts = ['111', '222'].map((uid, i) => ({ id: i + 1, vinted_user_id: uid, login: 'compte_' + uid, domain: 'www.vinted.fr', updated_at: iso }));
const main = { vrm_numerotation: { version: 1 }, vinted_annonce_numeros: {
  '701': { numero: '1', accountId: '111', title: 'Paire identique taille 42', photo: 'https://img.test/701.jpg' },
  '702': { numero: '10', accountId: '222', title: 'Paire identique taille 42', photo: 'https://img.test/702.jpg' },
} };
const fixture = () => [
  { id: 'main', data: structuredClone(main), updated_at: iso },
  ...accounts.map((a, i) => ({ id: `harvest_${a.vinted_user_id}_listings`, data: { capturedAt: iso, payload: { items: [{ id: 701 + i, title: 'Paire identique taille 42', price: { amount: '90', currency_code: 'EUR' }, photo: { url: `https://img.test/${701 + i}.jpg` } }] } } })),
  ...accounts.map((a, i) => ({ id: `harvest_${a.vinted_user_id}_orders_sold`, data: { capturedAt: iso, payload: { my_orders: i ? [] : [{ transaction_id: '91', status: 'À expédier', date: new Date(now - 4 * 86400000).toISOString() }] } } })),
  { id: 'ebay_listings', data: { capturedAt: iso, items: [] } },
  { id: 'ebay_orders', data: { capturedAt: iso, orders: [] } },
  { id: 'ebay_programmees', data: { items: [] } },
  { id: 'ebay_brouillons', data: { items: { d1: { id: 'd1', pairId: '701', numero: '1', titre: 'Brouillon N°1', prix: '90', quantite: '1', etat: '3000', photos: ['https://img.test/701.jpg'], categorie: { id: '123', nom: 'Chaussures', requis: [] }, aspects: {}, etatBrouillon: 'brouillon' } } } },
  { id: 'lbc_ventes', data: { ventes: {} } },
];
(async () => {
  const root = path.resolve(__dirname, '../../dist');
  const server = http.createServer((req, res) => {
    const file = path.join(root, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
    res.setHeader('content-type', types[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); });
  const browser = await chromium.launch({ executablePath: require('../_chromium.cjs').executablePath(), args: ['--no-sandbox', '--no-proxy-server', '--disable-dev-shm-usage', '--use-angle=swiftshader'] });
  let checks = 0;
  try {
    for (const width of [390, 1512]) {
      const rows = fixture(); let panne = false; const envois = [];
      const ctx = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
      const pg = await ctx.newPage(); const errors = [];
      pg.on('pageerror', e => errors.push(e.message));
      await pg.addInitScript(() => localStorage.setItem('vrm_acces_direct', '1'));
      // Tout ce qui n'est pas le serveur du build est un mock, y compris images.
      await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, r => r.abort());
      await pg.route('**/rest/v1/**', async route => {
        const req = route.request();
        const u = new URL(metaVersData(req.url()));
        const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(data) });
        if (u.pathname.endsWith('/vinted_accounts')) return reply(accounts);
        if (u.searchParams.get('select') === 'owner') return reply({}, 400);
        const id = u.searchParams.get('id') || '';
        if (panne && req.method() === 'GET' && /orders_sold|_txn_|_label_/.test(req.url())) return reply({}, 503);
        if (req.method() === 'POST') {
          const incoming = [].concat(req.postDataJSON()); const saved = [];
          for (const row of incoming) {
            const current = rows.find(r => r.id === row.id);
            if (current && /ignore-duplicates/.test(req.headers().prefer || '')) continue;
            if (current) Object.assign(current, row); else rows.push(row);
            saved.push(row);
          }
          return reply(saved);
        }
        if (req.method() === 'PATCH') {
          const current = rows.find(r => 'eq.' + r.id === id && (!u.searchParams.get('updated_at') || 'eq.' + r.updated_at === u.searchParams.get('updated_at')));
          if (!current) return reply([]);
          Object.assign(current, req.postDataJSON()); return reply([current]);
        }
        let out = rows;
        if (id.startsWith('eq.')) out = rows.filter(r => r.id === id.slice(3));
        if (id.startsWith('in.')) out = rows.filter(r => id.slice(4, -1).split(',').includes(r.id));
        if (id.startsWith('like.')) { const re = new RegExp('^' + id.slice(5).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$'); out = rows.filter(r => re.test(r.id)); }
        return reply(out.map(r => projette(r, u.searchParams.get('select') || 'id,data')));
      });
      await pg.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
      await pg.route('**/api/ebay**', r => {
        const b = r.request().method() === 'POST' ? r.request().postDataJSON() : {};
        if (['publish', 'retirer', 'programmer', 'offre'].includes(b.action)) envois.push(b);
        const data = b.action === 'status' ? { ok: true, connected: true } : b.action === 'pubinfo' ? { ok: true, categorie: { categoryId: '123', categoryName: 'Chaussures' }, attributs: [], conditions: [{ id: '3000', label: 'Occasion' }] } : { ok: true, ready: true, canConsent: true };
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
      });
      const choisir = async n => {
        await pg.getByRole('button', { name: new RegExp('N°' + n + '\\b.*Paire identique') }).click();
        await pg.getByRole('button', { name: 'Trouver la catégorie eBay', exact: true }).click();
        await pg.locator('[data-ebay-etat-paire]').selectOption('3000');
      };
      const annonces = async () => {
        const compte = pg.getByRole('button', { name: 'Compte eBay', exact: true });
        await compte.waitFor();
        await compte.locator('..').getByRole('button', { name: 'Annonces', exact: true }).click();
      };
      await pg.goto(`http://127.0.0.1:${PORT}/?tab=plat_ebay`);
      await annonces();
      await pg.waitForSelector('[data-ebay-gel-publication="1"]').catch(async e => { console.log('Écran initial', await pg.locator('body').innerText(), errors); await pg.screenshot({ path: '/tmp/vrm-k1-debug.png', fullPage: true }); throw e; }); checks++;
      const anchor = rows.find(r => r.id === 'vrm_vinted_publication_activation').data.at;
      await pg.screenshot({ path: `/tmp/vrm-k1-gel-${width}.png`, fullPage: true });
      await pg.locator('[data-brouillon-choix="d1"]').check();
      await pg.locator('[data-brouillons-programmer]').click();
      const planif = pg.locator('[data-planif]');
      await planif.waitFor();
      assert.match(await planif.innerText(), /n’est pas encore reliée/); checks++;
      await planif.getByRole('button', { name: /Fermer/ }).click();
      await pg.goto(`http://127.0.0.1:${PORT}/?tab=journee`);
      await pg.waitForSelector('[data-journee-ventes-non-reliees="1"]'); checks++;
      assert.equal((await pg.locator('body').innerText()).includes('Rien d\'urgent'), false); checks++;
      await pg.goto(`http://127.0.0.1:${PORT}/?tab=plat_ebay`); await annonces();
      await pg.waitForSelector('[data-ebay-gel-publication="1"]');
      await pg.getByRole('button', { name: 'Vendre une paire sur eBay', exact: true }).click();
      await choisir('1');
      await pg.waitForSelector('[data-publier-garde="compte-gele"]').catch(async e => { console.log('Garde réelle:', await pg.locator('[data-publier-garde]').allTextContents(), await pg.locator('[data-publier-garde]').evaluateAll(xs => xs.map(x => x.dataset)), rows.filter(r => /publication/.test(r.id))); await pg.screenshot({ path: '/tmp/vrm-k1-debug.png', fullPage: true }); throw e; });
      assert.equal(await pg.locator('[data-publier-ebay]').isDisabled(), true); checks++;
      await pg.getByRole('button', { name: 'Changer', exact: true }).click();
      await choisir('10');
      assert.equal(await pg.locator('[data-publier-garde]').count(), 0); assert.equal(await pg.locator('[data-publier-ebay]').isEnabled(), true); checks += 2;
      await pg.goto(`http://127.0.0.1:${PORT}/?tab=plat_ebay`); await annonces();
      await pg.waitForSelector('[data-ebay-gel-publication="1"]');
      assert.equal(rows.find(r => r.id === 'vrm_vinted_publication_activation').data.at, anchor); checks++;
      await pg.getByLabel('Paire de la vente 91').selectOption('701');
      await pg.getByRole('button', { name: 'Relier cette vente', exact: true }).first().click();
      await pg.locator('div[style*="z-index: 2000"]').getByRole('button', { name: 'Relier cette vente', exact: true }).click();
      await pg.waitForFunction(() => !document.querySelector('[data-ebay-gel-vente="111:91"]'));
      assert.equal(rows.find(r => r.id === 'vrm_ventes_reliees_111_91').data.numero, '1'); checks++;
      await pg.getByRole('button', { name: 'Vendre une paire sur eBay', exact: true }).click();
      await choisir('1');
      await pg.waitForSelector('[data-publier-garde="vente-probable"]'); checks++;
      panne = true; await pg.goto(`http://127.0.0.1:${PORT}/?tab=plat_ebay`); await annonces();
      await pg.getByRole('button', { name: 'Vendre une paire sur eBay', exact: true }).click();
      await choisir('10');
      await pg.waitForSelector('[data-publier-garde="gel-pas-su"]'); checks++;
      assert.equal(envois.length, 0); assert.deepEqual(errors, []); checks += 2;
      assert.ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); checks++;
      await pg.screenshot({ path: `/tmp/vrm-k1-${width}.png`, fullPage: true });
      await ctx.close(); console.log(`OK K1 rendu ${width}px`);
    }
    console.log(`${checks} contrôles sans échec. Aucun appel vendeur réel.`);
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
