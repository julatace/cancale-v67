// ── BANC : NOTE PRIVÉE D'UNE PAIRE (lot BD) + ACHAT SAISI DEUX FOIS (lot BH) — 10 nov. ──
// Données INVENTÉES (le dépôt est public), à la forme des lignes réelles. Rendu à
// 390 px tactile (clair) et 1512 px (clair puis sombre). Il exige :
//  BD · trois annonces au MÊME titre (« Adidas Spezial noir taille 38 ») : la note du
//       N°7 n'apparaît QUE sur la carte du N°7 (identité, jamais le titre) ; les
//       autres portent l'icône « ajouter » ; un toucher → feuille (200 car. au plus)
//       → la note du N°8 s'écrit sous `vrm_notes_paires['n:8']` de la ligne `main`,
//       pilule « Annuler » ; AUCUNE autre requête ne porte le texte (jamais envoyée) ;
//       la vente du N°9 montre SA note dans Ventes ; la fiche paire du N°7 aussi ;
//  BH · un achat Vinted (n° 94000001) et un achat hors plateforme portant la même
//       référence « 9400 0001 » ⇒ UN groupe, les deux fiches côte à côte ; trois achats
//       hors plateforme IDENTIQUES (titre, prix, date) sans référence ⇒ aucun doublon ;
//       « Garder celle-ci » masque l'autre, « Annuler » la remet ; garder l'achat hors
//       plateforme masque l'achat Vinted (`vinted_purchases_hidden`) ; le nombre est
//       publié pour « À trancher » ;
//  · cibles ≥ 44 px, aucun débordement, aucune erreur de page ; captures (BANC_CAPTURES).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4573);
const CAPTURES = process.env.BANC_CAPTURES || '';

const M = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const ilYa = (j) => iso(M - j * 86400000);
const TITRE = 'Adidas Spezial noir taille 38';
const NOTE7 = 'petite tache semelle gauche';
const NOTE9 = 'lacets de rechange dans la boîte';
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: iso(M) }];
const item = (id) => ({ id, title: TITRE, price: { amount: '60.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, brand_title: 'Adidas', size_title: '38', status: 'Très bon état', view_count: 10, favourite_count: 1 });
const LISTINGS = [item(8101), item(8102), item(8103)];
const FICHES = { 8101: { numero: '7', title: TITRE, auto: false, manuelAt: ilYa(3) }, 8102: { numero: '8', title: TITRE, auto: false, manuelAt: ilYa(3) }, 8104: { numero: '9', title: TITRE, auto: false, manuelAt: ilYa(9) } };
const VENTES = [{ transaction_id: 9301, title: TITRE, price: { amount: '80', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: ilYa(2) }];
const ACHATS = [{ transaction_id: 94000001, title: 'Nike Dunk Low banc 42', price: { amount: '30', currency_code: 'EUR' }, status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed', date: ilYa(4) }];
const HORS = [
  { id: 'ob_ref', title: 'Nike Dunk Low (saisi à la main)', price: '30', date: ilYa(4).slice(0, 10), source: 'Vinted', ref: '9400 0001' },
  ...[1, 2, 3].map((i) => ({ id: 'ob_x' + i, title: 'Lot brocante identique', price: '12', date: ilYa(6).slice(0, 10), source: 'Brocante' })),
];
const mainDe = (sombre) => ({ vinted_dark: sombre, vinted_annonce_numeros: FICHES, vinted_used_numeros: ['7', '8', '9'],
  vrm_notes_paires: { 'n:7': { t: NOTE7, at: ilYa(1) }, 'n:9': { t: NOTE9, at: ilYa(1) } }, vinted_offvinted_buys: HORS });

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
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
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

async function preparer(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ecrits = []; const fuites = [];
  const rows = [
    { id: 'main', data: JSON.parse(JSON.stringify(mainDe(sombre))) },
    { id: 'harvest_111_listings', data: { capturedAt: iso(M - 60e3), payload: { items: LISTINGS, pagination: { total_entries: LISTINGS.length } } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: iso(M), payload: { my_orders: VENTES } } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(M), payload: { my_orders: ACHATS } } },
    { id: 'harvest_111_txn_9301', data: { capturedAt: iso(M), payload: { transaction: { id: 9301, item_id: 8104, status: 450, status_title: 'Commande finalisée', status_updated_at: ilYa(1) } } } },
  ];
  await pg.addInitScript(([s, f]) => { try {
    localStorage.setItem('vrm_acces_direct', '1');
    localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_apparence', JSON.stringify(s ? 'sombre' : 'clair'));
    localStorage.setItem('vinted_annonce_numeros', JSON.stringify(f));
  } catch (_) {} }, [sombre, FICHES]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  // Toute requête qui porterait le texte d'une note HORS de la ligne `main` est une fuite.
  pg.on('request', (q) => { const d = q.postData() || ''; if (/taille petit|petite tache/.test(d + q.url()) && !/\/rest\/v1\/app_data/.test(q.url())) fuites.push(q.url()); });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') {
      let corps = null; try { corps = JSON.parse(req.postData() || 'null'); } catch (_) {}
      if (/\/rest\/v1\/app_data/.test(u) && req.method() === 'POST') {
        for (const l of (Array.isArray(corps) ? corps : [corps])) { if (!l || !l.id) continue; ecrits.push({ id: l.id, data: l.data }); const ex = rows.find((r) => r.id === l.id); if (ex) ex.data = l.data; else rows.push({ id: l.id, data: l.data }); }
      }
      if (/\/rest\/v1\/app_data/.test(u) && req.method() === 'PATCH') {
        const id = (/[?&]id=eq\.([^&]*)/.exec(u) || [])[1];
        const ex = id && rows.find((r) => r.id === id);
        if (ex && corps && corps.data !== undefined) { ecrits.push({ id, data: corps.data }); ex.data = corps.data; return j([{ id }]); }
      }
      return j([]);
    }
    if (/select=owner&limit=1/.test(u)) return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data$/.test(sel) && sel !== 'data') ? projette(r, sel) : ({ ...r, updated_at: (r.data && r.data.capturedAt) || iso(M), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  const dernierMain = () => { const m = ecrits.filter((e) => e.id === 'main'); return m.length ? m[m.length - 1].data || {} : null; };
  return { ctx, pg, errs, dernierMain, fuites };
}
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const capture = async (pg, nom) => { if (!CAPTURES) return; try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };
const haut = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return 0; const r = e.getBoundingClientRect(); const a = getComputedStyle(e, '::after'); return Math.round(r.height + (a && a.content !== 'none' ? Math.max(0, -2 * parseFloat(a.top || '0')) : 0)); }, sel);

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 1512, height: 950 }, false], [{ width: 1512, height: 950 }, true]]) {
      const T = (vp.width < 600 ? '📱' : '🖥️') + (sombre ? '🌙' : '');
      const nomC = `${vp.width}${sombre ? '-sombre' : ''}`;
      const tap = async (pg, loc) => { const l = typeof loc === 'string' ? pg.locator(loc).first() : loc; await l.scrollIntoViewIfNeeded(); if (vp.width < 600) await l.tap(); else await l.click(); };

      // ── BD : ANNONCES ──────────────────────────────────────────────────────
      await essaie(`${T} note sur les annonces`, async () => {
        const { ctx, pg, errs, dernierMain, fuites } = await preparer(b, vp, sombre);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
        await pg.locator('[data-carte-annonce="8101"]').waitFor({ timeout: 15000 });
        await pg.waitForTimeout(800);
        const lues = await pg.$$eval('[data-note-paire="lue"]', (l) => l.map((x) => ({ carte: (x.closest('[data-carte-annonce]') || {}).getAttribute ? x.closest('[data-carte-annonce]').getAttribute('data-carte-annonce') : '', t: x.innerText })));
        dit(lues.length === 1 && lues[0].carte === '8101' && lues[0].t.includes(NOTE7), `${T} trois annonces au même titre : la note du N°7 est sur SA carte seulement`, JSON.stringify(lues));
        const ajouts = await pg.$$eval('[data-note-paire="ajout"]', (l) => l.map((x) => x.closest('[data-carte-annonce]').getAttribute('data-carte-annonce')).sort());
        dit(JSON.stringify(ajouts) === '["8102","8103"]', `${T} les autres paires portent l'icône discrète « ajouter une note »`, JSON.stringify(ajouts));
        // (10 nov., lot AM) Annonces « Toutes » est une grille de vignettes : sur une vignette FERMÉE, une note
        // écrite se lit, l'icône « ajouter » seule ne s'affiche pas (retour de Julien : « l'icône note isolée ») ;
        // toucher la vignette l'ouvre en place, et l'icône y est.
        dit(await pg.locator('[data-carte-annonce="8101"] [data-note-paire="lue"]').isVisible(), `${T} vignette fermée : la note écrite se lit`);
        await tap(pg, '[data-carte-annonce="8102"] [data-fiche-plus-bouton]');
        await pg.locator('[data-carte-annonce="8102"][data-fiche-ouverte="1"]').waitFor({ timeout: 4000 });
        dit((await haut(pg, '[data-carte-annonce="8102"] [data-note-paire="ajout"]')) >= 44, `${T} l'icône « note » se touche sur 44 px`);
        await pg.locator('[data-carte-annonce="8101"]').scrollIntoViewIfNeeded();
        await capture(pg, `annonces-${nomC}`);
        await tap(pg, '[data-carte-annonce="8102"] [data-note-paire="ajout"]');
        const champ = pg.locator('[data-ask-champ="note-paire"]');
        await champ.waitFor({ timeout: 4000 });
        dit((await champ.getAttribute('maxlength')) === '200', `${T} la saisie est bornée à 200 caractères`);
        // La feuille donne le focus au champ (le clavier du téléphone s'ouvre) : on attend ce focus.
        await pg.waitForFunction(() => document.activeElement && document.activeElement.matches('[data-ask-champ="note-paire"]'), null, { timeout: 3000 });
        await pg.keyboard.type('taille petit', { delay: 10 });
        await capture(pg, `note-saisie-${nomC}`);
        await pg.keyboard.press('Enter');
        await pg.locator('[data-carte-annonce="8102"] [data-note-paire="lue"]').waitFor({ timeout: 4000 });
        const t8 = await pg.locator('[data-carte-annonce="8102"] [data-note-paire="lue"]').innerText();
        dit(/taille petit/.test(t8), `${T} la note du N°8 apparaît tout de suite sur sa carte`, t8);
        dit((await pg.locator('[data-pilule-annuler]').count()) >= 1, `${T} la pilule « Annuler » est là (geste réversible, lot B)`);
        await pg.waitForTimeout(2600);
        const m = dernierMain() || {};
        const n8 = (m.vrm_notes_paires || {})['n:8'];
        dit(!!n8 && n8.t === 'taille petit' && (m.vrm_notes_paires || {})['n:7'], `${T} écrite sous vrm_notes_paires['n:8'] de la ligne main, la note du N°7 gardée`, JSON.stringify(m.vrm_notes_paires || null));
        dit(fuites.length === 0, `${T} aucune autre requête ne porte le texte de la note (jamais envoyée)`, fuites.join(' | ').slice(0, 160));
        dit((await deborde(pg)) <= 1, `${T} annonces : aucun débordement horizontal`);
        await capture(pg, `annonces-apres-${nomC}`);
        // La fiche paire du N°7.
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: '7' })));
        await pg.waitForSelector('[data-fiche-note]', { timeout: 8000 });
        const tf = await pg.locator('[data-fiche-note]').innerText();
        dit(tf.includes(NOTE7), `${T} la fiche paire du N°7 montre SA note`, tf);
        await capture(pg, `fiche-${nomC}`);
        dit(errs.length === 0, `${T} annonces : aucune erreur de page`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      });

      // ── BD : VENTES ────────────────────────────────────────────────────────
      await essaie(`${T} note sur une vente`, async () => {
        const { ctx, pg, errs } = await preparer(b, vp, sombre);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
        await pg.locator('.vrm-sale-row').first().waitFor({ timeout: 15000 });
        await pg.locator('[data-vente-notes] [data-note-paire="lue"]').first().waitFor({ timeout: 8000 });
        const tv = await pg.locator('[data-vente-notes]').allInnerTexts();
        dit(tv.length === 1 && tv[0].includes(NOTE9) && !tv[0].includes(NOTE7), `${T} la vente du N°9 montre SA note (par la transaction → l'annonce → le N°)`, JSON.stringify(tv));
        dit((await deborde(pg)) <= 1, `${T} ventes : aucun débordement horizontal`);
        await pg.locator('[data-vente-notes]').first().scrollIntoViewIfNeeded();
        await capture(pg, `ventes-${nomC}`);
        dit(errs.length === 0, `${T} ventes : aucune erreur de page`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      });

      // ── BH : ACHATS ────────────────────────────────────────────────────────
      await essaie(`${T} achat saisi deux fois`, async () => {
        const { ctx, pg, errs, dernierMain } = await preparer(b, vp, sombre);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_achats&vue=achats`, { waitUntil: 'domcontentloaded' });
        await pg.locator('[data-achats-doubles]').first().waitFor({ timeout: 15000 });
        const n = await pg.locator('[data-achats-doubles]').getAttribute('data-achats-doubles');
        const fiches = await pg.$$eval('[data-double-achat]', (l) => l.map((x) => x.getAttribute('data-double-achat')).sort());
        dit(n === '1' && JSON.stringify(fiches) === '["ob:ob_ref","tx:94000001"]', `${T} même n° (Vinted 94000001 / « 9400 0001 » tapé) : UN groupe, les deux fiches`, `${n} ${JSON.stringify(fiches)}`);
        dit(!(await pg.locator('[data-double-achat^="ob:ob_x"]').count()), `${T} trois achats identiques (titre, prix, date) sans référence : aucun doublon`);
        const cotes = await pg.$$eval('[data-double-achat]', (l) => l.map((x) => { const r = x.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y) }; }));
        dit(cotes.length === 2 && cotes[0].y === cotes[1].y && cotes[0].x !== cotes[1].x, `${T} les deux fiches sont côte à côte`, JSON.stringify(cotes));
        dit((await haut(pg, '[data-double-garder]')) >= 44, `${T} « Garder celle-ci » se touche sur 44 px`);
        const pub = await pg.evaluate(() => { try { const v = JSON.parse(localStorage.getItem('vrm_a_trancher') || 'null'); return v && v.s && v.s['achats-doubles'] ? v.s['achats-doubles'].n : null; } catch (_) { return null; } });
        dit(pub === 1, `${T} le nombre est publié pour « À trancher » par l'écran Achats`, String(pub));
        dit((await deborde(pg)) <= 1, `${T} achats : aucun débordement horizontal`);
        await pg.locator('[data-achats-doubles]').scrollIntoViewIfNeeded();
        await capture(pg, `doubles-${nomC}`);
        // Garder l'achat Vinted ⇒ l'achat tapé à la main est masqué ; « Annuler » le remet.
        await tap(pg, '[data-double-garder="tx:94000001"]');
        await pg.locator('[data-double-achat]').first().waitFor({ state: 'detached', timeout: 4000 });
        dit((await pg.locator('[data-double-masque="ob_ref"]').count()) === 1, `${T} garder l'achat Vinted masque l'autre (rien supprimé : « Réafficher »)`);
        await capture(pg, `doubles-garde-${nomC}`);
        await tap(pg, '[data-pilule-annuler]');
        await pg.locator('[data-double-achat]').first().waitFor({ timeout: 4000 });
        dit((await pg.locator('[data-double-achat]').count()) === 2, `${T} « Annuler » remet les deux fiches`);
        await pg.waitForTimeout(2600);
        const m0 = dernierMain();
        dit(!m0 || !(m0.vrm_achats_hors_masques || []).includes('ob_ref'), `${T} après « Annuler », rien n'est masqué dans la base`, JSON.stringify(m0 && m0.vrm_achats_hors_masques));
        // Garder l'achat tapé à la main ⇒ l'achat Vinted est masqué (le masquage existant).
        await tap(pg, '[data-double-garder="ob:ob_ref"]');
        await pg.locator('[data-double-achat]').first().waitFor({ state: 'detached', timeout: 4000 });
        await pg.waitForTimeout(6500);
        const m = dernierMain() || {};
        dit((m.vinted_purchases_hidden || []).map(String).includes('94000001') && !(m.vrm_achats_hors_masques || []).includes('ob_ref'), `${T} garder l'achat hors plateforme masque l'achat Vinted (vinted_purchases_hidden)`, JSON.stringify({ h: m.vinted_purchases_hidden, o: m.vrm_achats_hors_masques }));
        dit(Array.isArray(m.vinted_offvinted_buys) ? m.vinted_offvinted_buys.length === 4 : true, `${T} aucun achat supprimé`);
        dit(errs.length === 0, `${T} achats : aucune erreur de page`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ note privée + achat en double : ${ko} rouge(s).` : `\n✅ note privée + achat en double : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
