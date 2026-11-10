// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE LIVRE DE POLICE (10 novembre, lot R)
//        npm run build && BANC_PORT=… node scripts/bancs/livre-police.cjs   (BANC_CAPTURE=dossier)
// ═══════════════════════════════════════════════════════════════════════════
// Argent → Déclarer → « Livre de police », sur des achats INVENTÉS (dépôt public),
// à 1512 px et 390 px tactile, clair et sombre. Exige :
//   · micro-entrepreneur : la carte, fermée (rien lu tant qu'il n'ouvre pas) ;
//   · ouverte : « Inscrire N achats » (N = achats datés hors annulés), confirmé,
//     ÉCRIT la ligne `vrm_livre_police` (n° 1…N dans l'ordre des dates), puis
//     plus rien à inscrire ;
//   · le tableur : une ligne par achat de la période, n° d'ordre, le pseudo lu
//     CÔTÉ ACHETEUR seulement, l'identité « à compléter » partout ; le PDF se
//     crée ; jamais « conforme » ;
//   · particulier : aucune carte, aucune lecture ;
//   · cibles ≥ 44 px, aucun débordement, aucune erreur.
// Sur origin/main (avant le lot R) : aucune carte ⇒ rouge.
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const { ouvrirAvanceCompta } = require('./_compta.cjs');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4561;
const maintenant = new Date();
const iso = (d) => d.toISOString();
const ceMois = (j) => { const d = new Date(maintenant.getFullYear(), maintenant.getMonth(), Math.min(j, Math.max(1, maintenant.getDate())), 12); return d > maintenant ? new Date(maintenant.getTime() - 3600e3) : d; };
const moisPasse = (j) => new Date(maintenant.getFullYear(), maintenant.getMonth() - 1, j, 12);
const accounts = [
  { id: 1, vinted_user_id: '111', login: 'atelier_sneak', domain: 'www.vinted.fr', updated_at: iso(maintenant), created_at: iso(moisPasse(1)), owner: null },
  { id: 2, vinted_user_id: '222', login: 'paris_kicks', domain: 'www.vinted.fr', updated_at: iso(maintenant), created_at: iso(moisPasse(1)), owner: null },
];
// [compte, tx, prix, statut, date]
const FIN = 'Transaction finalisée - L’acheteur a validé la commande';
const ACHATS = [
  ['111', '71001', 40, FIN, ceMois(1)],
  ['111', '71002', 25.5, FIN, moisPasse(10)],
  ['222', '71003', 60, 'Remboursement validé', ceMois(1)],
  ['222', '71004', 33, FIN, moisPasse(3)],
];
const rows = [];
for (const a of accounts) {
  rows.push({ id: `harvest_${a.vinted_user_id}_orders_purchased`, data: { capturedAt: iso(maintenant), payload: { my_orders: ACHATS.filter((x) => x[0] === a.vinted_user_id).map((x) => ({ transaction_id: Number(x[1]), title: 'Achat inventé ' + x[1], price: { amount: String(x[2]), currency_code: 'EUR' }, status: x[3], date: iso(x[4]), conversation_id: null, transaction_user_status: 'completed' })) } } });
  rows.push({ id: `harvest_${a.vinted_user_id}_orders_sold`, data: { capturedAt: iso(maintenant), payload: { my_orders: [] } } });
}
// La transaction de 71001 lue CÔTÉ ACHETEUR (pseudo pris) ; 71004 lue côté VENDEUR (pas pris).
rows.push({ id: 'harvest_111_txn_71001', data: { capturedAt: iso(maintenant), payload: { transaction: { id: 71001, user_side: 'buyer', seller: { login: 'vendeuse_inventee' } } } } });
rows.push({ id: 'harvest_222_txn_71004', data: { capturedAt: iso(maintenant), payload: { transaction: { id: 71004, user_side: 'seller', seller: { login: 'moi_meme_invente' } } } } });
const ATTENDUS = ACHATS.filter((a) => !/rembours|annul|refus/i.test(a[3]));

function projette(row, select) {
  if (!select || select === '*') return row;
  const out = {};
  for (const part of select.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const alias = m[1] || m[2].split('->').pop().replace(/^>/, ''); const src = m[2];
    if (src === 'id' || src === 'updated_at') { out[alias] = row[src]; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (/^data(->|->>)/.test(src)) { let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg]; out[alias] = v == null ? null : v; continue; }
    out[alias] = row[src];
  }
  return out;
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.onnx': 'application/octet-stream', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };

async function page(b, T, opts) {
  const ctx = await b.newContext({ viewport: T.vp, isMobile: !!T.isMobile, hasTouch: !!T.hasTouch, acceptDownloads: true, colorScheme: T.sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sombre) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (sombre) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, !!T.sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(); const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/\/rest\/v1\/app_data/.test(u)) opts.lus.push(u);
    if (req.method() === 'POST' || req.method() === 'PATCH') {
      let corps = null; try { corps = JSON.parse(req.postData() || 'null'); } catch (_) {}
      for (const x of [].concat(corps || [])) if (x && x.id === 'main' && x.data) opts.main = x.data;
      if (/vrm_livre_police/.test(u) || [].concat(corps || []).some((x) => x && x.id === 'vrm_livre_police')) {
        const d = req.method() === 'POST' ? [].concat(corps)[0].data : corps.data;
        opts.livre = d; opts.ecritures++;
        return req.method() === 'PATCH' ? j([{ id: 'vrm_livre_police' }]) : route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '' });
      }
      return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    }
    if (/select=owner/.test(u)) return j([{ owner: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' }]);
    const S = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: opts.main || {} }, S)]);
    if (eq && eq[1] === 'vrm_livre_police') return j(opts.livre ? [projette({ id: 'vrm_livre_police', data: opts.livre }, S)] : []);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map((r) => projette(r, S)));
    const inn = /id=in\.\(([^)]*)\)/.exec(u); if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map((r) => projette(r, S))); }
    const lk = /id=like\.([^&]*)/.exec(u); if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map((r) => projette(r, S))); }
    return j([]);
  });
  await pg.route('**/api/**', (r2) => r2.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  return { ctx, pg, errs };
}
const lireCsv = (t) => t.replace(/^\ufeff/, '').split(/\r?\n/).map((l) => { const out = []; let c = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q) { if (ch === '"' && l[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; } else if (ch === '"') q = true; else if (ch === ';') { out.push(c); c = ''; } else c += ch; } out.push(c); return out; });
const telecharge = async (pg, sel) => { const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 20000 }), pg.click(sel)]); return { nom: dl.suggestedFilename(), octets: fs.readFileSync(await dl.path()) }; };
const attr = (pg, a) => pg.evaluate((a) => { const e = document.querySelector('[data-livre-police]'); return e ? e.getAttribute(a) : null; }, a);
const MODES = [{ nom: '1512 sombre', vp: { width: 1512, height: 950 }, sombre: true }, { nom: '1512 clair', vp: { width: 1512, height: 950 } },
  { nom: '390 clair', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, { nom: '390 sombre', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true, sombre: true }];
const an = String(maintenant.getFullYear());

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const T of MODES) {
      console.log(`\n══ ${T.nom}${T.hasTouch ? ' (tactile)' : ''}`);
      const opts = { main: { vinted_regime: 'micro', vinted_dark: !!T.sombre }, lus: [], ecritures: 0, livre: null };
      const { ctx, pg, errs } = await page(b, T, opts);
      try {
        await pg.goto(`http://localhost:${PORT}/?tab=compta`, { waitUntil: 'domcontentloaded' });
        await ouvrirAvanceCompta(pg).catch(() => {});
        await pg.waitForSelector('[data-livre-police]', { timeout: 20000 }).catch(() => {});
        dit(await pg.locator('[data-livre-police]').count() === 1, 'Argent → Déclarer : une carte « Livre de police » (micro)');
        if (!(await pg.locator('[data-livre-police]').count())) { await ctx.close(); continue; }
        dit(await attr(pg, 'data-livre-police') === 'ferme' && !opts.lus.some((u) => /vrm_livre_police|seller->>login/.test(u)), 'fermée : rien lu tant qu’il n’ouvre pas');
        await pg.click('[data-livre-ouvrir]');
        await pg.waitForFunction(() => { const e = document.querySelector('[data-livre-police]'); return e && e.getAttribute('data-livre-police') === 'lu' && e.getAttribute('data-livre-a-inscrire') !== ''; }, null, { timeout: 20000 }).catch(() => {});
        const aIns = await attr(pg, 'data-livre-a-inscrire');
        dit(aIns === String(ATTENDUS.length) && await attr(pg, 'data-livre-inscrits') === '0', `ouverte : « Inscrire ${ATTENDUS.length} achats » (hors remboursé)`, `${aIns} · inscrits ${await attr(pg, 'data-livre-inscrits')}`);
        const lusTx = opts.lus.filter((u) => /harvest_111_txn_71001/.test(u) && /seller->>login/.test(u));
        dit(lusTx.length > 0 && lusTx.every((u) => !/select=data(&|$)/.test(u) && /user_side/.test(u)), 'pseudos lus en projection (jamais select=data)', String(lusTx.length));
        if (process.env.BANC_CAPTURE) { await pg.locator('[data-livre-police]').scrollIntoViewIfNeeded(); await pg.locator('[data-livre-police]').screenshot({ path: path.join(process.env.BANC_CAPTURE, `livre-police-avant-${T.nom.replace(' ', '-')}.png`) }).catch(() => {}); }
        await pg.click('[data-livre-inscrire]');
        await pg.waitForSelector('.vrm-confirmation', { timeout: 10000 });
        await pg.locator('.vrm-confirmation button', { hasText: /^Inscrire$/ }).click();
        await pg.waitForFunction(() => { const e = document.querySelector('[data-livre-police]'); return e && e.getAttribute('data-livre-a-inscrire') === '0'; }, null, { timeout: 15000 }).catch(() => {});
        const L = opts.livre;
        const ordre = L && L.ordre ? Object.entries(L.ordre).sort((x, y) => x[1].n - y[1].n).map(([k]) => k) : [];
        const attendu = [...ATTENDUS].sort((x, y) => x[4] - y[4] || String(x[1]).localeCompare(String(y[1]))).map((x) => 'vinted:' + x[1]);
        dit(opts.ecritures === 1 && L && L.dernier === ATTENDUS.length && JSON.stringify(ordre) === JSON.stringify(attendu), 'inscrire ÉCRIT la ligne : n° 1…N dans l’ordre des dates', JSON.stringify(ordre));
        dit(await attr(pg, 'data-livre-inscrits') === String(ATTENDUS.length) && await attr(pg, 'data-livre-a-inscrire') === '0', 'après : tout est inscrit, plus rien à inscrire');
        await pg.selectOption('[data-livre-periode]', an); await pg.waitForTimeout(400);
        await pg.waitForFunction(() => { const e = document.querySelector('[data-livre-police]'); return e && e.getAttribute('data-livre-police') === 'lu'; }, null, { timeout: 15000 }).catch(() => {});
        const csv = await telecharge(pg, '[data-livre-csv]');
        const C = lireCsv(csv.octets.toString('utf8'));
        const iH = C.findIndex((r) => r[0] === 'N° d’ordre'); const H = C[iH] || [];
        const corps = C.slice(iH + 1).filter((r) => r.length > 1);
        const dansAn = ATTENDUS.filter((a) => String(a[4].getFullYear()) === an);
        const iV = H.indexOf('Vendeur'), iI = H.indexOf('Identité du vendeur'), iD = H.indexOf('Nature et description');
        dit(new RegExp(`^Livre-de-police-${an}\\.csv$`).test(csv.nom) && corps.length === dansAn.length && corps.every((r) => /^\d+$/.test(r[0])), 'tableur : une ligne par achat de la période, chacune son n° d’ordre', `${csv.nom} · ${corps.length}/${dansAn.length}`);
        const l1 = corps.find((r) => /71001/.test(r[iD]) || /Achat inventé 71001/.test(r.join(' ')));
        const l4 = corps.find((r) => /Achat inventé 71004/.test(r.join(' ')));
        dit(!!l1 && /vendeuse_inventee/.test(l1[iV]) && (!l4 || l4[iV] === 'à compléter'), 'tableur : pseudo lu côté acheteur ; transaction lue côté vendeur ⇒ « à compléter »', JSON.stringify([l1 && l1[iV], l4 && l4[iV]]));
        dit(corps.length > 0 && corps.every((r) => r[iI] === 'à compléter'), 'tableur : identité du vendeur « à compléter » partout');
        const pdf = await telecharge(pg, '[data-livre-pdf]');
        dit(/^Livre-de-police-.*\.pdf$/.test(pdf.nom) && pdf.octets.slice(0, 5).toString() === '%PDF-', 'PDF créé dans le navigateur');
        const texte = await pg.evaluate(() => document.querySelector('[data-livre-police]').innerText);
        dit(!/conform/i.test(texte + csv.octets.toString('utf8')), 'jamais « conforme »');
        const cibles = await pg.evaluate(() => [...document.querySelectorAll('[data-livre-police] button, [data-livre-police] select')].filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().height)));
        dit(cibles.length > 0 && cibles.every((h) => h >= 44), 'cibles ≥ 44 px', cibles.join(','));
        const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        dit(deb <= 1, 'aucun débordement horizontal', deb + 'px');
        if (process.env.BANC_CAPTURE) { await pg.locator('[data-livre-police]').scrollIntoViewIfNeeded(); await pg.locator('[data-livre-police]').screenshot({ path: path.join(process.env.BANC_CAPTURE, `livre-police-${T.nom.replace(' ', '-')}.png`) }).catch(() => {}); if (T.nom === '1512 clair') fs.writeFileSync(path.join(process.env.BANC_CAPTURE, 'livre-police.pdf'), pdf.octets); }
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
      } catch (e) { dit(false, T.nom, String(e.message || e).slice(0, 200)); }
      await ctx.close();
    }
    // Un particulier : aucune carte, aucune lecture.
    console.log('\n══ particulier');
    const opts = { main: { vinted_regime: 'particulier' }, lus: [], ecritures: 0, livre: null };
    const { ctx, pg } = await page(b, MODES[1], opts);
    await pg.goto(`http://localhost:${PORT}/?tab=compta`, { waitUntil: 'domcontentloaded' });
    await ouvrirAvanceCompta(pg).catch(() => {});
    await pg.waitForSelector('[data-argent-vue="declarer"]', { timeout: 20000 }).catch(() => {});
    await pg.waitForTimeout(2500);
    dit(await pg.locator('[data-livre-police]').count() === 0 && !opts.lus.some((u) => /vrm_livre_police/.test(u)), 'particulier : aucune carte, aucune lecture du livre');
    await ctx.close();
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 160)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\n❌ livre-police : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ livre-police : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
