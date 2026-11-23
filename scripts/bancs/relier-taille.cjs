// ════════════════════════════════════════════════════════════════════════════
// BANC : LA TAILLE À CÔTÉ DE CHAQUE ACHAT À RELIER (17 nov., lot relier-taille)
//        node scripts/bancs/relier-taille.cjs
// ════════════════════════════════════════════════════════════════════════════
// Julien : « pour relier les achats je veux qu'il y ait la taille ou une description à côté des articles
// achetés pour pouvoir relier ».
// Ventes · une vente « Adidas Spezial noir 42 » sans prix d'achat · « Relier un achat » :
//   · 50 achats au MÊME titre (« Adidas Spezial noire », aucune taille écrite — la forme réelle de ses achats),
//     dont le détail de transaction est rangé côté acheteur (`harvest_{uid}_txn_{tx}` : `order.items[].size_title`,
//     `.status`, `seller.login`) avec des tailles 40 / 41 / 42 / 42,5 / 43 ;
//   · 3 achats sans détail rangé (taille jamais lue) dont 1 écrit « 42 » dans son titre.
// Contrôles : chaque ligne montre SA taille (lue chez Vinted ⇒ source « vinted ») et son état, son vendeur ; les 10
// achats en 42 — et eux seuls — sont marqués « ✓ » (même taille), les autres « ≠ 42 » ; un achat sans détail ne montre
// aucune taille lue (celle du titre, dite « (titre) », s'il en écrit une) ; la phrase « N achats sans taille lue »
// est dite UNE fois ; la taille n'est pas coupée ; rien n'est écrit (aucun lien sans son toucher) ; la lecture est une
// PROJECTION côté acheteur (jamais `select=data`). Puis « Relier achats et ventes » (la vente déjà choisie) : les mêmes
// 10 achats « ✓ ». 390 tactile (clair, sombre) et 1512 (clair, sombre). Données INVENTÉES.
// `BANC_DIST=` le build jugé ; `SHOTS=` les captures. Un banc ne meurt pas, il rapporte.
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const sc = require('./_scenario-colis.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (21000 + Math.floor(Math.random() * 18000));
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-relier-taille');
fs.mkdirSync(SHOTS, { recursive: true });
const J = 86400e3, U = sc.UID[0];
const T = 'Adidas Spezial noire';
const TAILLES = ['40', '41', '42', '42,5', '43'];
const ETATS = ['Très bon état', 'Bon état', 'Satisfaisant'];
const N = 50;
const txDe = (i) => String(7300000 + i);
const achats = [], txns = [], memes = [];
for (let i = 0; i < N; i++) {
  const tx = txDe(i), taille = TAILLES[i % TAILLES.length];
  if (taille === '42') memes.push(tx);
  achats.push(sc.ordre({ tx, conv: 'c' + tx, titre: T, prix: 40 + (i % 7), statut: sc.STATUT_FINAL, dateMs: sc.NOW - (40 + i) * J }));
  txns.push({ id: `harvest_${U}_txn_${tx}`, data: { type: 'transaction', uid: U, domain: 'www.vinted.fr', capturedAt: new Date(sc.NOW - 5 * J).toISOString(),
    payload: { code: 0, transaction: { id: Number(tx), user_side: 'buyer', item_id: 9100000 + i, status: 450, status_title: sc.STATUT_FINAL, status_updated_at: new Date(sc.NOW - 30 * J).toISOString(),
      title: T, item_title: T, items_count: 1, seller: { id: 600 + i, login: `vendeur_${i}` },
      order: { id: 500 + i, transaction_id: Number(tx), item_count: 1, items: [{ id: 9100000 + i, title: T, size_title: taille, status: ETATS[i % ETATS.length], catalog_id: 1242, price: { amount: '40.0', currency_code: 'EUR' }, photos: [] }] } } } } });
}
// Trois achats sans détail rangé : deux sans taille nulle part, un qui écrit « 42 » dans son titre.
const SANS = ['7399001', '7399002'], TITRE42 = '7399003';
for (const tx of SANS) achats.push(sc.ordre({ tx, conv: 'c' + tx, titre: T, prix: 38, statut: sc.STATUT_FINAL, dateMs: sc.NOW - 30 * J }));
achats.push(sc.ordre({ tx: TITRE42, conv: 'c' + TITRE42, titre: 'Adidas Spezial noire taille 42', prix: 39, statut: sc.STATUT_FINAL, dateMs: sc.NOW - 31 * J }));
// Une transaction côté VENDEUR (une vente) : jamais servie à la lecture des achats (filtre `user_side=eq.buyer`).
const VENTE_TX = '7200001';
const vente = sc.ordre({ tx: VENTE_TX, titre: 'Adidas Spezial noir 42', prix: 70, statut: sc.STATUT_FINAL, dateMs: sc.NOW - 10 * J, item: 'pa0' });
const listing = { ...sc.annonce({ id: 'pa0', titre: 'Adidas Spezial noir 42', prix: 70, taille: 42, marque: 'Adidas' }), created_at_ts: Math.floor((sc.NOW - 20 * J) / 1000) };
const main = (sombre) => sc.ligneMain({ vinted_dark: sombre, vinted_annonce_numeros: { pa0: { numero: '1', title: 'Adidas Spezial noir 42', price: 70, size: '42' } } });
const rows = [sc.ligneListings(U, [listing]), sc.lignePurch(U, achats), sc.ligneSold(U, [vente]), ...txns,
  { id: `harvest_${U}_txn_${VENTE_TX}`, data: { type: 'transaction', uid: U, payload: { transaction: { id: Number(VENTE_TX), user_side: 'seller', item_id: 1, status: 450, status_title: sc.STATUT_FINAL, seller: { login: 'moi' }, order: { items: [{ size_title: '99' }] } } } } },
];
// La projection PostgREST : `alias:data->a->b->>c` (index de tableau compris), `id`, `data`.
const projette = (row, sel) => {
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let x = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[seg];
    out[alias] = x == null ? null : (/->>/.test(src) && typeof x !== 'object' ? String(x) : x);
  }
  return out;
};
// Les filtres de chemin JSON (`data->payload->transaction->>user_side=eq.buyer`), comme PostgREST.
const filtresJson = (u) => [...u.matchAll(/[?&](data(?:->[A-Za-z0-9_]+)*->>[A-Za-z0-9_]+)=eq\.([^&]*)/g)].map((m) => ({ chemin: m[1], v: m[2] }));
const valeurChemin = (row, chemin) => { let x = row.data; for (const seg of chemin.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[seg]; return x == null ? null : String(x); };

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);
let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const egal = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

async function passe(b, nom, ctxOpts, sombre) {
  if (process.env.PASSE && process.env.PASSE !== nom) return;
  console.log(`\n── ${nom}`);
  const ctx = await b.newContext({ locale: 'fr-FR', ...ctxOpts });
  const pg = await ctx.newPage();
  const errs = [], lecturesAchats = [], ecritures = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (sb) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, sombre);
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { if (/app_data/.test(u) && req.method() !== 'HEAD') { let ids = ''; try { const b = JSON.parse(req.postData() || 'null'); ids = (Array.isArray(b) ? b : [b]).map((x) => x && x.id).filter(Boolean).join('+'); } catch (_) {} if (/(^|\+)(main|vinted_annonce_numeros|vinted_sale_overrides|vinted_buyprice_by_num)(\+|$)/.test(ids)) ecritures.push(req.method() + ' ' + ids); } return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(sc.comptes ? sc.comptes() : []);
    if (/id=eq\.main/.test(u)) return j(main(sombre));
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => (sel && sel !== 'data' ? projette(r, sel) : r);
    const fj = filtresJson(u);
    const passeFiltres = (r) => fj.every((f) => valeurChemin(r, f.chemin) === f.v);
    if (/user_side=eq\.buyer/.test(u)) lecturesAchats.push(sel);
    const eq = /id=eq\.([^&]*)/.exec(u); if (eq) { const k = eq[1]; return j(rows.filter((r) => r.id === k && passeFiltres(r)).map(forme)); }
    const inn = /id=in\.\(([^)]*)\)/.exec(u); if (inn) { const ids = new Set(inn[1].split(',')); return j(rows.filter((r) => ids.has(r.id) && passeFiltres(r)).map(forme)); }
    const m = /id=like\.([^&]*)/.exec(u); if (m) { const re = new RegExp('^' + m[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id) && passeFiltres(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=ventes&site=vinted`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-ventes-seg-choix="toutes"]', { timeout: 20000 }).catch(() => {});
  await pg.evaluate(() => { const b = document.querySelector('[data-ventes-seg-choix="toutes"]'); if (b) b.click(); });
  const puce = pg.locator('[data-cout-vente="ligne"] [data-cout-vente-saisir]').first();
  await puce.waitFor({ timeout: 25000 }).catch(() => {});
  if (await puce.count()) await puce.click().catch(() => {});
  const bouton = pg.locator('[data-cout-vente-relier]').first();
  await bouton.waitFor({ timeout: 25000 }).catch(() => {});
  dit(await bouton.count() > 0, `${nom} · « Relier un achat » visible sur la vente sans prix`);
  if (!(await bouton.count())) { await pg.screenshot({ path: path.join(SHOTS, `relier-taille-${nom}-ko.png`), fullPage: true }); await ctx.close(); return; }
  await pg.waitForTimeout(500);
  await bouton.evaluate((e) => e.click());
  await pg.locator('[data-relier-feuille] [data-tous-achats], [data-relier-feuille] [data-suggestions-achat]').first().waitFor({ timeout: 15000 }).catch(() => {});
  const voir = pg.locator('[data-relier-feuille] [data-voir-tous-achats]');
  if (await voir.count()) { await voir.first().click().catch(() => {}); await pg.locator('[data-tous-achats]').waitFor({ timeout: 5000 }).catch(() => {}); }
  // La lecture des détails arrive après l'ouverture : on attend qu'une taille LUE soit posée (au plus 10 s).
  await pg.waitForFunction(() => !!document.querySelector('[data-relier-feuille] [data-taille-source="vinted"]'), null, { timeout: 10000 }).catch(() => {});
  await pg.waitForTimeout(300);
  const L = await pg.evaluate(() => {
    const f = document.querySelector('[data-relier-feuille]'); if (!f) return null;
    return [...f.querySelectorAll('[data-achat-libre]')].map((l) => {
      const t = l.querySelector('[data-relier-taille]'); const fa = l.querySelector('[data-faits-achat]');
      const r = t ? t.getBoundingClientRect() : null;
      return { tx: l.getAttribute('data-achat-libre'), taille: t ? t.getAttribute('data-relier-taille') : '', source: t ? t.getAttribute('data-taille-source') : '',
        accord: t ? (t.getAttribute('data-taille-accord') || '') : '', texte: fa ? fa.textContent : '', visible: !!(r && r.width > 0 && r.right <= window.innerWidth + 1),
        coupe: !!(fa && (fa.scrollWidth > fa.clientWidth + 1)) };
    });
  });
  dit(Array.isArray(L), `${nom} · la feuille « Relier un achat » s'ouvre`);
  const lignes = L || [];
  const parTx = new Map(lignes.map((x) => [x.tx, x]));
  const lus = lignes.filter((x) => /^73000\d\d$/.test(x.tx));
  dit(lus.length === N, `${nom} · les ${N} achats au même titre sont listés`, `${lus.length}`);
  dit(lus.every((x) => x.taille && x.source === 'vinted'), `${nom} · chaque achat montre SA taille, lue chez Vinted`, JSON.stringify(lus.filter((x) => !(x.taille && x.source === 'vinted')).slice(0, 3)));
  dit(lus.every((x, i) => x.taille === TAILLES[Number(x.tx) % TAILLES.length]), `${nom} · la taille montrée est celle de SA transaction (par n°, jamais par le titre)`, JSON.stringify(lus.slice(0, 5).map((x) => [x.tx, x.taille])));
  const marques = lignes.filter((x) => x.accord === 'meme').map((x) => x.tx);
  dit(egal(marques.filter((t) => t !== TITRE42), memes), `${nom} · les ${memes.length} achats en 42 — et eux seuls parmi les lus — sont marqués « ✓ même taille »`, JSON.stringify(marques));
  dit(lus.filter((x) => !memes.includes(x.tx)).every((x) => x.accord === 'diff' && /≠\s*42/.test(x.texte)), `${nom} · les autres tailles disent « ≠ 42 » (42,5 compris)`, JSON.stringify(lus.filter((x) => !memes.includes(x.tx) && x.accord !== 'diff').slice(0, 3)));
  dit(lus.every((x) => /Très bon état|Bon état|Satisfaisant/.test(x.texte)), `${nom} · l'état lu est à côté`, lus[0] && lus[0].texte);
  dit(lus.every((x) => new RegExp(`de vendeur_${Number(x.tx) - 7300000}(?!\\d)`).test(x.texte)), `${nom} · le vendeur de CETTE transaction est à côté`, lus[0] && lus[0].texte);
  dit(SANS.every((t) => parTx.has(t) && !parTx.get(t).taille), `${nom} · un achat sans détail lu ne montre aucune taille (jamais devinée)`, JSON.stringify(SANS.map((t) => parTx.get(t))));
  const t42 = parTx.get(TITRE42);
  dit(!!t42 && t42.source === 'titre' && /\(titre\)/.test(t42.texte) && t42.accord === 'meme', `${nom} · la taille écrite dans un titre est dite « (titre) »`, JSON.stringify(t42));
  dit(lignes.every((x) => !x.taille || x.visible), `${nom} · la taille est dans l'écran sur chaque ligne`);
  dit(lignes.every((x) => !x.coupe), `${nom} · rien n'est coupé dans la ligne`);
  const note = await pg.evaluate(() => { const n = document.querySelectorAll('[data-relier-feuille] [data-faits-sans-taille]'); return { n: n.length, v: n[0] ? n[0].getAttribute('data-faits-sans-taille') : '' }; });
  dit(note.n === 1 && note.v === '3', `${nom} · « 3 achats sans taille lue … » dit une fois, en tête`, JSON.stringify(note));
  dit(lecturesAchats.length >= 1 && lecturesAchats.every((s) => s && !/(^|,)data(,|$)/.test(s) && /size_title/.test(s)), `${nom} · les détails sont lus en projection côté acheteur (jamais select=data)`, JSON.stringify(lecturesAchats.slice(0, 2)));
  dit(!ecritures.length, `${nom} · rien n'est écrit en ouvrant la feuille (c'est son toucher qui relie)`, ecritures.slice(0, 2).join(' | '));
  const deborde = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  dit(!deborde, `${nom} · aucun défilement horizontal`);
  // La capture : la feuille défilée jusqu'au premier achat en 42.
  await pg.evaluate((tx) => { const e = document.querySelector(`[data-achat-libre="${tx}"]`); if (e) e.scrollIntoView({ block: 'center' }); }, memes[1]);
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: path.join(SHOTS, `relier-taille-${nom}-feuille.png`) });

  // « Relier achats et ventes » depuis la feuille : la vente est déjà choisie ⇒ les achats disent « ✓ » / « ≠ ».
  const lien = pg.locator('[data-relier-feuille] [data-glisser-ouvrir="feuille"]');
  if (await lien.count()) {
    await lien.first().click().catch(() => {});
    await pg.locator('[data-relier-glisser] [data-glisser-achat]').first().waitFor({ timeout: 15000 }).catch(() => {});
    await pg.waitForTimeout(400);
    // La vente choisie à l'ouverture quand la feuille la connaît ; sinon (feuille ouverte sur la fiche), on la touche
    // d'abord (le sens inverse de « Relier en touchant »).
    let choisi = await pg.evaluate(() => { const e = document.querySelector('[data-glisser-choisi]'); return e ? e.getAttribute('data-glisser-choisi') : ''; });
    if (choisi !== 'v:' + VENTE_TX) {
      await pg.evaluate(() => { const b = document.querySelector('[data-glisser-changer]'); if (b) b.click(); });
      // (17 nov.) Au téléphone, une liste à la fois : l'onglet « Sans achat relié » d'abord.
      await pg.evaluate(() => { const b = document.querySelector('[data-glisser-onglet="cibles"]'); if (b) b.click(); });
      await pg.waitForTimeout(200);
      await pg.locator(`[data-glisser-cible="v:${VENTE_TX}"]`).click().catch(() => {});
      await pg.waitForTimeout(300);
      choisi = await pg.evaluate(() => { const e = document.querySelector('[data-glisser-choisi]'); return e ? e.getAttribute('data-glisser-choisi') : ''; });
    }
    dit(choisi === 'v:' + VENTE_TX, `${nom} · Relier achats et ventes : la vente est choisie`, choisi);
    const G = await pg.evaluate(() => [...document.querySelectorAll('[data-relier-glisser] [data-glisser-achat]')].map((c) => {
      const t = c.querySelector('[data-relier-taille]');
      return { tx: c.getAttribute('data-glisser-achat'), taille: t ? t.getAttribute('data-relier-taille') : '', accord: t ? (t.getAttribute('data-taille-accord') || '') : '' };
    }));
    const gl = G.filter((x) => /^73000\d\d$/.test(x.tx));
    dit(gl.length === N && gl.every((x) => x.taille), `${nom} · Relier achats et ventes : la taille sur chaque achat`, `${gl.length} · ${gl.filter((x) => !x.taille).length} sans`);
    dit(egal(gl.filter((x) => x.accord === 'meme').map((x) => x.tx), memes), `${nom} · Relier achats et ventes : les achats en 42 seuls marqués « ✓ »`, JSON.stringify(gl.filter((x) => x.accord === 'meme').map((x) => x.tx)));
    await pg.screenshot({ path: path.join(SHOTS, `relier-taille-${nom}-glisser.png`) });
    // Toucher un achat en 42 : la vente dit « ✓ même taille que l'achat » ; aucun lien sans « Oui ».
    await pg.evaluate(() => { const b = document.querySelector('[data-glisser-changer]'); if (b) b.click(); });
    await pg.waitForTimeout(200);
    await pg.evaluate(() => { const b = document.querySelector('[data-glisser-onglet="achats"]'); if (b) b.click(); });
    await pg.waitForTimeout(200);
    await pg.locator(`[data-glisser-achat="${memes[0]}"]`).click().catch(() => {});
    await pg.waitForTimeout(300);
    const acc = await pg.evaluate((k) => { const c = document.querySelector(`[data-glisser-cible="${k}"]`); const t = c && c.querySelector('[data-taille-accord]'); return t ? t.getAttribute('data-taille-accord') : ''; }, 'v:' + VENTE_TX);
    dit(acc === 'meme', `${nom} · un achat en 42 choisi : la vente dit « ✓ même taille »`, acc);
    await pg.screenshot({ path: path.join(SHOTS, `relier-taille-${nom}-glisser-achat.png`) });
    dit(!ecritures.length, `${nom} · toujours rien d'écrit sans « Oui »`, ecritures.slice(0, 2).join(' | '));
  } else dit(false, `${nom} · le lien « Relier achats et ventes » est dans la feuille`);
  dit(!errs.length, `${nom} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const tel = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
  await passe(b, '390', tel, false);
  await passe(b, '390-sombre', { ...tel, colorScheme: 'dark' }, true);
  await passe(b, '1512', { viewport: { width: 1512, height: 950 } }, false);
  await passe(b, '1512-sombre', { viewport: { width: 1512, height: 950 }, colorScheme: 'dark' }, true);
  await b.close(); srv.close();
  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
