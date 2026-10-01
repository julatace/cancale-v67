const fs = require('fs'), http = require('http'), path = require('path');
const { chromium } = require('./node_modules/playwright');
const DIST = path.join(__dirname, 'dist');
const out = []; let browser = null, done = false;
function finish(code) { if (done) return; done = true; try { fs.writeFileSync('./.colisprobe.out', out.join('\n') + '\n'); } catch (_) {} try { require('child_process').execSync('pkill -9 -f chrome-linux || true'); } catch (_) {} process.exit(code); }
setTimeout(() => { out.push('WATCHDOG'); finish(9); }, 50000);
const LBCV = { id: 'lbc_ventes', data: { ventes: {
  '71977917': { txId: '71977917', itemId: '3271360255', title: 'Salomon XT-6 noir taille 43,5', price: 7500, isSeller: true, stepStatus: 'action', stepLabel: 'Colis à envoyer', deliveryLabel: 'Mondial Relay', image: 'https://img.leboncoin.fr/x/sal.jpg', label: { reference: '71977917', voucherUrl: 'https://api.leboncoin.fr/x/label.pdf', qrUrl: 'https://api.leboncoin.fr/x/qr.png' } },
  '72397087': { txId: '72397087', itemId: '888', title: 'Adidas Spezial marron taille 40,5', price: 4500, isSeller: true, stepStatus: 'action', stepLabel: 'Colis à envoyer', deliveryLabel: 'Mondial Relay', label: { reference: '72397087', voucherUrl: 'https://api.leboncoin.fr/x/label2.pdf', qrUrl: 'https://api.leboncoin.fr/x/qr2.png' } },
  '71911374': { txId: '71911374', title: 'Nike air max 1 olive vert taille 43', price: 5800, isSeller: true, stepStatus: 'action', stepLabel: 'Paiement effectué', deliveryLabel: 'Mondial Relay' },
} } };
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.on('error', e => { out.push('SRVERR ' + e.message); finish(4); });
srv.listen(4455, async () => {
  out.push('listening');
  try {
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--no-proxy-server', '--use-angle=swiftshader'] });
    const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pg.on('pageerror', e => out.push('PAGEERR ' + e.message.slice(0, 120)));
    await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, r => r.abort());
    await pg.route('**/rest/v1/**', r => { const u = r.request().url(); const j = d => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) }); if (/id=eq\.lbc_ventes/.test(u)) return j([LBCV]); if (/select=owner/.test(u)) return r.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }); return j([]); });
    await pg.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    out.push('goto');
    await pg.goto('http://localhost:4455/?tab=plat_leboncoin', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await pg.waitForTimeout(2500);
    // cliquer le sous-onglet « Colis »
    await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => (x.innerText || '').trim() === 'Colis'); if (b) b.click(); });
    await pg.waitForTimeout(1800);
    const t = await pg.evaluate(() => document.body.innerText);
    out.push('Imprimer le bordereau? ' + /Imprimer le bordereau/i.test(t));
    out.push('Colis fait? ' + /Colis fait/i.test(t));
    out.push('Prêts à poster? ' + /Pr[êe]ts à poster/i.test(t));
    out.push('Étiquette N°224? ' + /Étiquette N.?224/i.test(t));
    out.push('Salomon? ' + /Salomon XT-6/i.test(t));
    out.push('vieille pastille blanche Bordereau·ref seule? ' + /🧾 Bordereau ·/i.test(t));
    out.push('crash? ' + /n.a pas pu|Cannot access|is not defined|is not a function/i.test(t));
    out.push('bodylen=' + t.length);
  } catch (e) { out.push('CATCH ' + e.message.slice(0, 160)); }
  finish(0);
});
