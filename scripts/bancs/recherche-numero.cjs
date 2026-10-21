// ═══════════════════════════════════════════════════════════════════════════
// BANC : « TOUT SUR LE N° » — LA RECHERCHE PAR NUMÉRO (21 octobre)
//        (node scripts/bancs/recherche-numero.cjs — après `npm run build`)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « une recherche par numéro, partout ». La loupe de l'en-tête ouvre
// la recherche ; un numéro tapé fait passer devant le bloc « Tout sur le N° »
// (`ToutSurLeNumero`, règle `toutSurLeNumero` de src/rechercheNumero.js).
// Données INVENTÉES (le banc vit dans le dépôt), deux tailles (390 px tactile,
// 1512 px). Deux paires au MÊME TITRE (N°40 et N°41) : la recherche ne doit
// jamais mélanger leurs ventes ni leurs bordereaux (§5).
//   A. « 128 » : la fiche (en ligne), sa vente Vinted, son bordereau prêt, son
//      carton dans le Stock, l'ancien N°B128 signalé — et ni la N°1280 ni la
//      N°12 dans le bloc ;
//   B. « 40 » / « 41 » : chacune SA vente et SON bordereau (posté / imprimé) ;
//   C. « n128 » = N°128 ; « B128 » = l'ancienne paire seule ;
//   D. « 50 » : deux paires présentes ⇒ le rouge, une fois ;
//   E. « 999 » : jamais servi ⇒ « rien » ; ventes illisibles ⇒ « pas su » ;
//   F. une ligne mène à son écran (la recherche se ferme) ;
//   G. cibles ≥ 44 px, aucun débordement, aucune erreur, écran pas tombé.
// On juge les ATTRIBUTS (`data-tout-*`), jamais une formulation.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 8431;
const MUT = process.env.BANC_MUTATION || '';

const IL_Y_A = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: IL_Y_A(1), created_at: '2026-07-01T00:00:00Z' }];
const FICHES = {
  5128: { numero: '128', title: 'Nike Air Max 1 noir taille 42', numberedAt: '2026-10-12T10:00:00Z' },
  51280: { numero: '1280', title: 'Adidas Samba taille 40', numberedAt: '2026-10-12T10:00:00Z' },
  5012: { numero: '12', title: 'Salomon XT-6 taille 41', numberedAt: '2026-10-12T10:00:00Z' },
  5999: { numero: 'B128', title: 'Vieille paire taille 39', numberedAt: '2026-08-01T10:00:00Z' },
  5040: { numero: '40', title: 'Adidas Spezial noir taille 35,5', numberedAt: '2026-10-12T10:00:00Z' },
  5041: { numero: '41', title: 'Adidas Spezial noir taille 35,5', numberedAt: '2026-10-13T10:00:00Z' },
  5050: { numero: '50', title: 'Nike Dunk Low taille 40', numberedAt: '2026-10-12T10:00:00Z' },
};
const item = (id, title) => ({ id: Number(id), title, price: { amount: '60.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, created_at_ts: Math.floor(Date.parse('2026-10-12T10:00:00Z') / 1000) });
const LISTINGS = [item(5128, FICHES[5128].title), item(51280, FICHES[51280].title), item(5012, FICHES[5012].title), item(5041, FICHES[5041].title), item(5050, FICHES[5050].title)];
const vente = (tx, title, status, h) => ({ transaction_id: tx, title, status, price: { amount: '60.0', currency_code: 'EUR' }, date: IL_Y_A(h) });
const VENTES = [
  vente(9040, FICHES[5040].title, 'Commande finalisée', 120),
  vente(9041, FICHES[5041].title, 'Bordereau envoyé au vendeur', 20),
  vente(9128, FICHES[5128].title, 'Bordereau envoyé au vendeur', 10),
  // Une AUTRE paire, vente annulée avant l'envoi, corrigée sous le N°50 : elle est
  // encore sur l'étagère — deux paires présentes sous le N°50 (l'app ne règle
  // pas ce doublon toute seule : une vente annulée est en jeu).
  vente(9050, 'Asics Gel Lyte taille 43', 'Commande annulée', 30),
];
const txn = (tx, it, s) => ({ id: `harvest_111_txn_${tx}`, data: { capturedAt: IL_Y_A(1), payload: { transaction: { id: tx, item_id: it, status: s, status_title: 'x' } } } });
const PLAN = { rooms: [{ id: 'r1', name: 'Garage', room: { w: 8, h: 6, wallH: 3 }, items: [
  { id: 'm1', type: 'metal', name: 'Étagère du fond', x: 1, y: 0, w: 1.2, h: 0.5, rows: 5, cols: 2, h3d: 1.25, slots: { '4_0': ['128'] } },
] }], active: 'r1' };
const MAIN = {
  vinted_annonce_numeros: FICHES,
  vinted_used_numeros: [12, 40, 41, 50, 128, 200, 1280, 'B128'],
  vinted_sale_overrides: { 9050: { numero: '50' } },
  vinted_bords_printed: { 9041: { at: IL_Y_A(5) } },
  vinted_ship_done: {},
  vrm_numerotation: { version: 2, archive: 'B', coupure: '2026-10-09T00:00:00Z', appliqueLe: '2026-10-11T14:58:07Z' },
};
const ROWS = [
  { id: 'main', data: MAIN },
  { id: 'vrm_room', data: PLAN },
  { id: 'harvest_111_listings', data: { capturedAt: IL_Y_A(0.2), payload: { items: LISTINGS, pagination: { total_entries: LISTINGS.length } } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: IL_Y_A(0.2), payload: { my_orders: VENTES } } },
  txn(9040, 5040, 450), txn(9041, 5041, 230), txn(9128, 5128, 230),
  { id: 'email_bord_9128', data: { transaction: '9128', filename: 'b9128.pdf', pdfB64: 'JVBERi0x' } },
  { id: 'email_bord_9041', data: { transaction: '9041', filename: 'b9041.pdf', pdfB64: 'JVBERi0x' } },
  { id: 'email_bord_9040', data: { transaction: '9040', filename: 'b9040.pdf', pdfB64: 'JVBERi0x' } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT)'); process.exit(1); });
srv.listen(PORT);
// La projection `select=` de PostgREST, appliquée pour de vrai (§6.3). Le
// témoin `_pdf` de la base vaut 'true' : on rend la même forme.
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    if (/pdfB64$/.test(src)) v = v ? 'true' : null;
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};

async function rendre(b, vp, { ventesKO = false } = {}) {
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((plan) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_room_plan', JSON.stringify(plan)); } catch (_) {} }, PLAN);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (ventesKO && /orders_sold|_txn_/.test(u)) return route.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"message":"panne"}' });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data$/.test(sel) && sel !== 'data') ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || IL_Y_A(1), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) {
      const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');
      // La pagination par `Range` : une seule page suffit ici.
      return j(ROWS.filter((r) => re.test(r.id)).map(forme));
    }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2500);
  return { ctx, pg, errs };
}
async function chercher(pg, q) {
  if (!(await pg.$('.vrm-global-search'))) {
    await pg.locator('button[aria-label="Rechercher une paire"]').first().click();
    await pg.waitForSelector('.vrm-global-search', { timeout: 8000 });
  }
  await pg.fill('.vrm-global-search input[type="search"]', q);
  // Le bloc se recalcule quand les sources arrivent : on attend qu'il ne soit
  // plus « en lecture » (sans délai fixe sur le résultat lui-même).
  for (let i = 0; i < 40; i++) {
    const e = await pg.evaluate(() => { const el = document.querySelector('[data-tout-num]'); return el ? el.getAttribute('data-tout-lecture') : null; });
    if (e === '0') break;
    await pg.waitForTimeout(250);
  }
  return pg.evaluate(() => {
    const el = document.querySelector('[data-tout-num]');
    if (!el) return null;
    const a = (s) => [...el.querySelectorAll(s)];
    return {
      num: el.getAttribute('data-tout-num'), etat: el.getAttribute('data-tout-etat'),
      annonces: a('[data-tout-annonce]').map((x) => x.getAttribute('data-tout-annonce') + ':' + x.getAttribute('data-tout-annonce-etat')),
      ventes: a('[data-tout-vente]').map((x) => x.getAttribute('data-tout-vente') + ':' + (x.getAttribute('data-tout-tx') || '')),
      bords: a('[data-tout-bord]').map((x) => x.getAttribute('data-tout-bord') + ':' + x.getAttribute('data-tout-bord-etat')),
      stock: (el.querySelector('[data-tout-stock]') || { getAttribute: () => null }).getAttribute('data-tout-stock'),
      ancien: (el.querySelector('[data-tout-ancien]') || { getAttribute: () => null }).getAttribute('data-tout-ancien'),
      doubles: a('[data-tout-double]').length,
      rouge: (() => { const d = el.querySelector('[data-tout-double]'); return d ? getComputedStyle(d).color : null; })(),
      rien: !!el.querySelector('[data-tout-rien]'),
      petites: a('button').filter((x) => x.getBoundingClientRect().height < 43.5).map((x) => x.textContent.slice(0, 30)),
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      t: document.body.innerText,
    };
  });
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      const { ctx, pg, errs } = await rendre(b, vp);
      await essaie('A', async () => {
        const r = await chercher(pg, '128');
        dit(!!r, 'A : un numéro tapé ouvre le bloc « Tout sur le N° »', r ? '' : 'aucun [data-tout-num]');
        if (!r) return;
        dit(r.num === '128' && r.etat === 'trouve', 'A : N°128 trouvé', `${r.num} · ${r.etat}`);
        dit(r.annonces.join() === '5128:en-ligne', 'A : la fiche N°128, en ligne — ni la N°1280 ni la N°12', r.annonces.join());
        dit(r.ventes.join() === 'vinted:9128', 'A : sa vente Vinted, par la transaction', r.ventes.join());
        dit(r.bords.join() === '9128:pret', 'A : son bordereau, prêt à imprimer', r.bords.join());
        dit(r.stock === 'Étagère du fond', 'A : son carton dans le Stock', r.stock);
        dit(r.ancien === 'B128', 'A : l’ancien N°B128 est signalé (pas mélangé)', r.ancien);
        dit(r.doubles === 0, 'A : pas de rouge', String(r.doubles));
        dit(r.petites.length === 0, 'A : toutes les lignes du bloc font ≥ 44 px', r.petites.join(' | '));
        dit(r.sw <= r.cw + 1, 'A : aucun débordement horizontal', `${r.sw} > ${r.cw}`);
      });
      await essaie('B', async () => {
        const r40 = await chercher(pg, '40'), r41 = await chercher(pg, '41');
        dit(r40 && r40.ventes.join() === 'vinted:9040' && r40.bords.join() === '9040:poste', 'B : N°40 (même titre que la 41) : SA vente, son bordereau posté', r40 && (r40.ventes.join() + ' · ' + r40.bords.join()));
        dit(r41 && r41.ventes.join() === 'vinted:9041' && r41.bords.join() === '9041:imprime', 'B : N°41 : SA vente, son bordereau imprimé', r41 && (r41.ventes.join() + ' · ' + r41.bords.join()));
        dit(r40 && r40.annonces.join() === '5040:plus-en-ligne' && r41 && r41.annonces.join() === '5041:en-ligne', 'B : chacune sa fiche', r40 && (r40.annonces.join() + ' / ' + (r41 && r41.annonces.join())));
      });
      await essaie('C', async () => {
        const rn = await chercher(pg, 'n128');
        dit(rn && rn.num === '128', 'C : « n128 » = N°128', rn && rn.num);
        const rb = await chercher(pg, 'B128');
        dit(rb && rb.num === 'B128' && rb.annonces.join() === '5999:plus-en-ligne' && rb.ventes.length === 0, 'C : « B128 » = l’ancienne paire seule', rb && (rb.num + ' ' + rb.annonces.join() + ' ' + rb.ventes.join()));
      });
      await essaie('D', async () => {
        const r = await chercher(pg, '50');
        dit(r && r.doubles === 1, 'D : deux paires présentes sous le N°50 ⇒ le rouge, une fois', r && String(r.doubles));
        const m = r && /rgb\((\d+), (\d+), (\d+)/.exec(r.rouge || '');
        dit(!!m && Number(m[1]) > 150 && Number(m[2]) < 110 && Number(m[3]) < 110, 'D : le bloc double est en rouge (couleur de danger)', r && r.rouge);
      });
      await essaie('E', async () => {
        const r = await chercher(pg, '999');
        dit(r && r.etat === 'rien' && r.rien, 'E : N°999 jamais servi ⇒ « rien »', r && r.etat);
      });
      await essaie('F', async () => {
        await chercher(pg, '128');
        await pg.locator('[data-tout-num] [data-tout-vente="vinted"]').first().click();
        await pg.waitForTimeout(600);
        const ouvert = await pg.$('.vrm-global-search');
        dit(!ouvert, 'F : toucher la vente ferme la recherche et ouvre son écran');
        const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(await pg.evaluate(() => document.body.innerText));
        dit(!m, 'F : l’écran ouvert n’est pas tombé sur le garde-fou', m && m[0]);
      });
      dit(errs.length === 0, 'G : aucune erreur de page', errs.join(' | ').slice(0, 200));
      await ctx.close();
      if (vp.width === 390) {
        await essaie('E2', async () => {
          const k = await rendre(b, vp, { ventesKO: true });
          const r = await chercher(k.pg, '999');
          dit(r && r.etat === 'passu' && !r.rien, 'E : ventes illisibles ⇒ « pas su », jamais « jamais servi »', r && r.etat);
          await k.ctx.close();
        });
      }
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ recherche par numéro : ${ko} rouge(s)` : '\n✅ recherche par numéro : tout est vert');
  process.exit(ko ? 1 : 0);
})();
