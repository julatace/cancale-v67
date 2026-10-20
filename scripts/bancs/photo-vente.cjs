// ═════════════════════════════════════════════════════════════════════════════
//  UNE VENTE, UNE PHOTO (20 octobre)
//
//  Julien : « quand je clique sur la vente d'une paire, il y a une AUTRE photo
//  de la paire qui apparaît ». La ligne repliée de l'écran Ventes montrait la
//  PREMIÈRE source de photo (la vignette de la commande) ; le détail déplié
//  choisissait la sienne parmi plusieurs (la première qui charge). Dès que la
//  vignette de la commande ne chargeait pas, les deux images différaient — et
//  la ligne retombait en plus sur la fiche N° trouvée par un ancien verrou
//  (posé par titre), donc parfois sur une AUTRE paire.
//
//  Base INVENTÉE (aucune donnée réelle : ce banc vit dans le dépôt), CDN servi
//  par le banc (une couleur par photo). 390 px tactile et 1512 px. Il juge :
//    A. vignette de la commande morte, annonce de la vente vivante : la ligne
//       et le détail montrent LA MÊME image (celle de l'annonce, par identité) ;
//    B. vente sans photo ni identité, reliée seulement par un ancien verrou à
//       une fiche : AUCUNE photo de cette fiche (mieux vaut aucune qu'une fausse) ;
//    C. vente normale : la ligne et le détail montrent la photo de la commande ;
//    D. l'achat relié montre sa photo DITE comme telle (« Photo de l'achat »).
//
//  Lancer : npm run build && BANC_PORT=4951 node scripts/bancs/photo-vente.cjs
// ═════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), http = require('http');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 4951;

const auj = new Date();
const jour = (n) => new Date(auj.getTime() - n * 86400000).toISOString();
const IMG = (nom) => `https://images1.vinted.net/t/01_00aaa_${nom}/f800/${nom}.jpeg?s=sig`;
const PH = { mort: IMG('mortcommande'), annonce: IMG('bonannonce'), verrou: IMG('ficheverrou'), cmd: IMG('commandec'), achat: IMG('photoachat') };
const vente = (id, titre, prix, photo, d) => ({ transaction_id: id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: 'Commande finalisée', date: jour(d), ...(photo ? { photo: { url: photo } } : {}) });
const VENTES = [
  vente(9001, 'Nike Air Max 1 olive taille 42', 80, PH.mort, 1),
  vente(9002, 'Salomon XT-6 blanc taille 40', 99, null, 2),
  vente(9003, 'Adidas Spezial noir taille 38', 45, PH.cmd, 3),
];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const txn = (tx, item) => ({ id: `harvest_111_txn_${tx}`, data: { capturedAt: auj.toISOString(), payload: { transaction: { id: tx, item_id: item, status: 450, status_title: 'Commande finalisée', status_updated_at: jour(1) } } } });
const MAIN = { id: 'main', data: {
  vinted_annonce_numeros: {
    '5001': { numero: '11', title: 'Nike Air Max 1 olive taille 42', photo: PH.annonce, auto: true },
    '6002': { numero: '12', title: 'Autre paire', photo: PH.verrou, auto: true },
    '5003': { numero: '13', title: 'Adidas Spezial noir taille 38', photo: PH.cmd, auto: true, buyPrice: '20', buyFromId: '7003', buyFrom: { title: 'Spezial noir 38', date: jour(30), photo: PH.achat, price: 20, account: 'compte_test' } },
  },
  vinted_txn_link: { '9002': '6002' },
} };
const rows = [
  { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: auj.toISOString(), payload: { my_orders: [] } } },
  { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: [
    { id: 5001, title: 'Nike Air Max 1 olive taille 42', photo: { url: PH.annonce }, is_closed: true, price: { amount: '80', currency_code: 'EUR' } },
    { id: 5003, title: 'Adidas Spezial noir taille 38', photo: { url: PH.cmd }, is_closed: true, price: { amount: '45', currency_code: 'EUR' } },
  ], pagination: { total_entries: 2 } } } },
  { id: 'coffre_111_5001', data: { id: 5001, photos: [PH.annonce] } },
  txn(9001, 5001), txn(9003, 5003),
  MAIN,
];
// Une couleur par photo : le banc lit la couleur réellement peinte.
const COUL = { bonannonce: [20, 160, 40], ficheverrou: [200, 20, 20], commandec: [20, 40, 200], photoachat: [200, 160, 20] };
const zlib = require('zlib');
function png([r, g, b]) {
  const crc = (buf) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of buf) x = t[(x ^ v) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (typ, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(typ), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const W = 8, H = 8, raw = Buffer.alloc((W * 3 + 1) * H); for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; for (let x = 0; x < W; x++) raw.set([r, g, b], y * (W * 3 + 1) + 1 + x * 3); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : (Array.isArray(v) && /^-?\d+$/.test(seg) ? v[Number(seg) < 0 ? v.length + Number(seg) : Number(seg)] : v[seg]);
    out[alias] = v == null ? null : v;
  }
  return out;
};
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };

// La photo réellement peinte par une image (ou null).
async function couleurs(pg, tx) {
  // Les détails sont désormais dans le panneau désigné par aria-controls.
  const bouton = pg.locator(`.vrm-sale-row[data-tx="${tx}"] > .vrm-ledger-sale-toggle`);
  if (await bouton.count() && await bouton.getAttribute('aria-expanded') !== 'true') await bouton.click();
  return pg.evaluate((tx) => {
    const row = document.querySelector(`.vrm-sale-row[data-tx="${tx}"]`); if (!row) return null;
    // Une image PEINTE (chargée, largeur réelle) et la photo qu'elle porte (le
    // nom du fichier servi par le banc). Pas de canvas : le CDN est d'une autre
    // origine, une image peinte le « tacherait ».
    const lit = (img) => { if (!img || !img.complete || !img.naturalWidth) return null; const m = /\/f800\/([a-z]+)\.jpeg/.exec(img.currentSrc || img.src || ''); return m ? m[1] : 'inconnue'; };
    const ligne = row.querySelector('.vrm-ledger-sale-toggle img');
    const panneau = document.getElementById(row.querySelector('.vrm-ledger-sale-toggle').getAttribute('aria-controls'));
    const detail = panneau && !panneau.closest('[hidden]') && panneau.querySelector('.vrm-sale-photo img');
    const toutes = [...row.querySelectorAll('img'), ...(panneau ? panneau.querySelectorAll('img') : [])].map(lit).filter(Boolean);
    return { ligne: lit(ligne), detail: lit(detail), toutes };
  }, tx);
}
const nomCouleur = (c) => c;

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
      const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
      await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
        const u = r.request().url();
        if (/images1\.vinted\.net/.test(u)) {
          const nom = (/\/f800\/([a-z]+)\.jpeg/.exec(u) || [])[1];
          if (!nom || !COUL[nom]) return r.fulfill({ status: 404, body: '' });
          return r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: png(COUL[nom]) });
        }
        return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
      });
      await pg.route('**/rest/v1/**', (route) => {
        const u = decodeURIComponent(metaVersData(route.request().url()));
        const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
        if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
        if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
        const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
        const forme = (r) => (sel && !/^id,data/.test(sel) && sel !== 'data,updated_at,cap:data->>capturedAt') ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
        const eq = /id=eq\.([^&]*)/.exec(u);
        if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
        const inn = /id=in\.\(([^)]*)\)/.exec(u);
        if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
        const lk = /id=like\.([^&]*)/.exec(u);
        if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
        return j([]);
      });
      await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
      await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(3500);
      try { await pg.getByText('Toutes', { exact: true }).first().click({ timeout: 3000 }); await pg.waitForTimeout(800); } catch (_) {}
      // On OUVRE chaque vente, comme lui.
      await pg.evaluate(() => { for (const r of document.querySelectorAll('.vrm-sale-row[data-tx]')) { const bt = r.querySelector('.vrm-ledger-sale-toggle'); if (bt && bt.getAttribute('aria-expanded') !== 'true') bt.click(); } });
      // La vignette morte : l'app attend (pas d'extension ici) puis passe à la
      // source suivante. On attend l'état observé, borné.
      let a = null;
      for (let k = 0; k < 40; k++) { a = await couleurs(pg, 9001); if (a && a.ligne && a.detail && a.ligne === a.detail) break; await pg.waitForTimeout(500); }
      dit(!!a, 'la vente 9001 est rendue');
      dit(a && a.detail && nomCouleur(a.detail) === 'bonannonce', 'A. le détail montre la photo de l’annonce de la vente (identité)', a && nomCouleur(a.detail));
      dit(a && a.ligne && a.ligne === a.detail, 'A. la ligne repliée montre LA MÊME image que le détail', a && `${nomCouleur(a.ligne)} / ${nomCouleur(a.detail)}`);
      const bb = await couleurs(pg, 9002);
      dit(!!bb, 'la vente 9002 est rendue');
      dit(bb && !bb.toutes.some((c) => nomCouleur(c) === 'ficheverrou'), 'B. aucune photo d’une fiche reliée par un ancien verrou (posé par titre)', bb && JSON.stringify(bb.toutes.map(nomCouleur)));
      let c = null;
      for (let k = 0; k < 20; k++) { c = await couleurs(pg, 9003); if (c && c.ligne && c.detail) break; await pg.waitForTimeout(300); }
      dit(c && nomCouleur(c.ligne) === 'commandec' && nomCouleur(c.detail) === 'commandec', 'C. vente normale : ligne et détail = la photo de la commande', c && `${nomCouleur(c.ligne)} / ${nomCouleur(c.detail)}`);
      // D. L'achat relié, dans « Modifier » : sa photo est DITE comme telle.
      await pg.evaluate(() => { const r = document.querySelector('.vrm-sale-row[data-tx="9003"]'); const panneau = r && document.getElementById(r.querySelector('.vrm-ledger-sale-toggle').getAttribute('aria-controls')); const d = panneau && panneau.querySelector('details.vrm-sale-details'); if (d) d.open = true; });
      await pg.waitForTimeout(800);
      const achat = await pg.evaluate(() => { const r = document.querySelector('.vrm-sale-row[data-tx="9003"]'); const panneau = r && document.getElementById(r.querySelector('.vrm-ledger-sale-toggle').getAttribute('aria-controls')); const im = panneau && panneau.querySelector('img[data-photo-achat]'); return { alt: im ? im.getAttribute('alt') : null, txt: panneau ? panneau.innerText : '' }; });
      dit(achat.alt === "Photo de l'achat", 'D. la photo de l’achat relié porte « Photo de l’achat »', String(achat.alt));
      dit(/Achat relié/.test(achat.txt), 'D. la ligne de l’achat se dit « Achat relié »');
      const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
      dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { try { await b?.close(); } catch (_) {} srv.close(); }
  console.log(ko ? `\n❌ ${ko} échec(s)` : '\n✅ tout est vert');
  process.exit(ko ? 1 : 0);
})();
