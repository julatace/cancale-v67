// ── BANC : LA FICHE COMPLÈTE D'UNE PAIRE (1er nov., maquette validée) ────────────
// « Tout sur le N° » → « Toute l'histoire du N° » : le parcours de la paire
// (Achat → Stock → Annonce(s) → Vente → Colis → Argent), PAR IDENTITÉ seulement.
// Données INVENTÉES (le dépôt est public), à la forme des lignes réelles :
//   A. N°117 : achat relié (vendeur, prix 52 €), rangée dans « Meuble B », vendue
//      sur Vinted 95 € (transaction → annonce), bordereau, finalisée (450) ⇒
//      versée ; bénéfice +43 € « frais pas tous confirmés » ;
//   B. N°118 : en ligne (14 favoris, 150 vues), prix d'achat pas saisi, pas
//      rangée, pas vendue ⇒ les étapes absentes sont grisées, « — » au bénéfice ;
//   C. 50 paires au MÊME titre (N°201 à N°250, prix d'achat différents), trois
//      vendues : la fiche du N°227 montre SON achat et SA vente, jamais une autre ;
//   D. ventes illisibles (panne) ⇒ vente, colis et argent « pas su » (jamais
//      « pas encore vendue ») ;
//   E. depuis la recherche : le N° tapé, « Toute l'histoire du N° » ouvre la fiche ;
//   F. cibles ≥ 44 px, aucun débordement, aucune erreur ; captures regardées.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 9233);
const SHOTS = process.env.SHOTS || os.tmpdir();

const M = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const ilYa = (j) => iso(M - j * 86400000);
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: iso(M) }];
const TITRE50 = 'Nike Dunk Low Panda taille 42';
const FICHES = {
  6117: { numero: '117', title: 'Adidas Samba OG taille 41', numberedAt: '2026-10-20T10:00:00Z', auto: false, buyPrice: '52', buyFromId: '8117',
    buyFrom: { title: 'Adidas Samba OG 41', date: ilYa(30), price: 52, seller: 'tom.kicks', account: 'compte_banc' } },
  6118: { numero: '118', title: 'New Balance 990 taille 43', numberedAt: '2026-10-21T10:00:00Z', auto: false },
};
for (let i = 0; i < 50; i++) FICHES[7200 + i] = { numero: String(201 + i), title: TITRE50, numberedAt: '2026-10-22T10:00:00Z', auto: false, buyPrice: String(10 + i) };
const item = (id, title, extra) => ({ id: Number(id), title, price: { amount: '60.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, ...extra });
const LISTINGS = [item(6118, FICHES[6118].title, { favourite_count: 14, view_count: 150 }), ...Array.from({ length: 50 }, (_, i) => item(7200 + i, TITRE50, { favourite_count: i, view_count: 100 + i })).filter((x) => ![7226, 7210, 7240].includes(x.id))];
const vente = (tx, title, status, j, prix) => ({ transaction_id: tx, title, status, transaction_user_status: /finalis/i.test(status) ? 'completed' : 'needs_action', price: { amount: prix, currency_code: 'EUR' }, date: ilYa(j) });
const VENTES = [
  vente(9117, FICHES[6117].title, 'Commande finalisée', 10, '95'),
  // Trois des cinquante paires identiques sont vendues : même titre, même prix.
  vente(9226, TITRE50, 'Commande finalisée', 5, '70'),
  vente(9210, TITRE50, 'Commande finalisée', 6, '70'),
  vente(9240, TITRE50, 'Commande finalisée', 7, '70'),
];
const txn = (tx, it, s, su) => ({ id: `harvest_111_txn_${tx}`, data: { capturedAt: iso(M), payload: { transaction: { id: tx, item_id: it, status: s, status_title: 'x', status_updated_at: su } } } });
const MEUBLES = [{ id: 'mB', name: 'Meuble B', cols: 4, rows: 3 }];
const SLOTS = { 117: { m: 'mB', i: 6 } };
const ROWS = [
  { id: 'main', data: { vinted_annonce_numeros: FICHES, vrm_meubles: MEUBLES, vrm_slots: SLOTS, vinted_used_numeros: Object.values(FICHES).map((f) => f.numero) } },
  { id: 'harvest_111_listings', data: { capturedAt: iso(M - 600e3), payload: { items: LISTINGS, pagination: { total_entries: LISTINGS.length } } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(M), payload: { my_orders: VENTES } } },
  txn(9117, 6117, 450, ilYa(3)), txn(9226, 7226, 450, ilYa(1)), txn(9210, 7210, 450, ilYa(2)), txn(9240, 7240, 450, ilYa(2)),
  { id: 'email_bord_9117', data: { transaction: '9117', filename: 'b9117.pdf', pdfB64: 'JVBERi0x', receivedAt: ilYa(9) } },
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
    if (/pdfB64$/.test(src)) x = x ? 'true' : null;
    out[alias] = x == null ? null : (/->>/.test(src) && typeof x !== 'object' ? String(x) : x);
  }
  return out;
};

async function rendre(b, vp, { ventesKO = false } = {}) {
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ n, m, s }) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n)); localStorage.setItem('vrm_meubles', JSON.stringify(m)); localStorage.setItem('vrm_slots', JSON.stringify(s)); } catch (_) {} }, { n: FICHES, m: MEUBLES, s: SLOTS });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (ventesKO && /orders_sold|_txn_/.test(u)) return route.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"message":"panne"}' });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data$/.test(sel) && sel !== 'data') ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || iso(M), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2500);
  return { ctx, pg, errs };
}
// Ouvre la fiche (l'événement que posent « Tout sur le N° » et le mode emballage)
// et attend la fin de la lecture — jamais un délai fixe sur le résultat.
async function fiche(pg, n) {
  await pg.evaluate(() => { const b = document.querySelector('[data-fiche-fermer]'); if (b) b.click(); });
  await pg.waitForTimeout(150);
  await pg.evaluate((n) => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: n })), n);
  await pg.waitForSelector('[data-fiche-paire]', { timeout: 8000 });
  for (let i = 0; i < 60; i++) { const l = await pg.evaluate(() => (document.querySelector('[data-fiche-paire]') || { getAttribute: () => '1' }).getAttribute('data-fiche-lecture-en-cours')); if (l === '0') break; await pg.waitForTimeout(250); }
  return lire(pg);
}
const lire = (pg) => pg.evaluate(() => {
  const el = document.querySelector('[data-fiche-paire]'); if (!el) return null;
  const at = (s, a) => { const x = el.querySelector(s); return x ? x.getAttribute(a) : null; };
  return {
    num: el.getAttribute('data-fiche-paire'), grand: (el.querySelector('[data-fiche-grand-num]') || {}).textContent || '',
    achat: at('[data-fiche-resume-achat]', 'data-fiche-resume-achat'), vente: at('[data-fiche-resume-vente]', 'data-fiche-resume-vente'),
    benef: at('[data-fiche-resume-benefice]', 'data-fiche-resume-benefice'), partiel: at('[data-fiche-resume-benefice]', 'data-fiche-benefice-partiel'),
    benefTxt: (el.querySelector('[data-fiche-resume-benefice]') || {}).innerText || '',
    etapes: Object.fromEntries([...el.querySelectorAll('[data-fiche-etape]')].map((x) => [x.getAttribute('data-fiche-etape'), { etat: x.getAttribute('data-fiche-etat'), txt: x.innerText.replace(/\n/g, ' | '), raison: !!x.querySelector('[data-fiche-raison]') }])),
    ordre: [...el.querySelectorAll('[data-fiche-etape]')].map((x) => x.getAttribute('data-fiche-etape')),
    txs: [...el.querySelectorAll('[data-fiche-tx]')].map((x) => x.getAttribute('data-fiche-tx')),
    petits: [...el.querySelectorAll('button')].filter((x) => { const r = x.getBoundingClientRect(); return r.height > 0 && r.height < 43.5; }).map((x) => x.textContent.slice(0, 30)),
    pastille: (() => { const p = el.querySelector('[data-fiche-etat="fait"] .vrm-fp-pastille'); return p ? getComputedStyle(p).backgroundColor : null; })(),
    gris: (() => { const p = el.querySelector('[data-fiche-etat="absent"] .vrm-fp-ligne1 b'); return p ? getComputedStyle(p).color : null; })(),
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  };
});
const rgb = (s) => (/rgba?\((\d+), (\d+), (\d+)/.exec(s || '') || []).slice(1).map(Number);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = vp.width + 'px';
      console.log('── ' + T);
      const { ctx, pg, errs } = await rendre(b, vp);
      await essaie('A', async () => {
        const f = await fiche(pg, '117');
        dit(!!f && f.num === '117' && f.grand === '117', `A ${T} la fiche du N°117 s'ouvre`, f && f.num);
        if (!f) return;
        // (3 nov.) La fiche est devenue l'HISTOIRE complète (src/histoireArticle.js) : numérotage,
        // prix, offres, favoris et retour s'insèrent à leur place dans le cycle.
        dit(f.ordre.join() === 'achat,numero,stock,annonces,prix,offres,favoris,vente,colis,argent,retour,benefice', `A ${T} l'histoire dans l'ordre : achat → numéro → stock → annonces → prix → offres → favoris → vente → colis → argent → retour → bénéfice (9 nov.)`, f.ordre.join());
        dit(f.achat === '5200' && f.etapes.achat.etat === 'fait' && /tom\.kicks/.test(f.etapes.achat.txt) && /n° de transaction/.test(f.etapes.achat.txt), `A ${T} l'achat : 52 €, le vendeur, relié par n° de transaction`, f.achat + ' ' + (f.etapes.achat || {}).txt);
        // (9 nov.) N°117 est vendue et partie : sa case est LIBÉRÉE (décision de Julien, journal
        // `vrm_stock_sortis`, le N° reste) — l'histoire dit où elle était et qu'elle en est sortie.
        dit(f.etapes.stock.etat === 'fait' && /Meuble B/.test(f.etapes.stock.txt) && /libérée/.test(f.etapes.stock.txt), `A ${T} rangée dans le Stock (par N°), puis sa place libérée au départ du colis`, (f.etapes.stock || {}).txt);
        dit(f.etapes.vente.etat === 'fait' && /Vendue sur Vinted/.test(f.etapes.vente.txt) && f.vente === '9500' && f.txs.join() === '9117', `A ${T} vendue sur Vinted 95 €, par SA transaction`, f.vente + ' ' + f.txs.join() + ' ' + (f.etapes.vente || {}).txt);
        dit(f.etapes.colis.etat === 'fait' && /livré/i.test(f.etapes.colis.txt), `A ${T} le colis livré (la règle de l'étiquette de la vente)`, (f.etapes.colis || {}).txt);
        dit(f.etapes.argent.etat === 'fait' && /versé/i.test(f.etapes.argent.txt), `A ${T} l'argent versé (transaction finalisée), daté`, (f.etapes.argent || {}).txt);
        dit(f.benef === '4300' && f.partiel === '1' && /\+43/.test(f.benefTxt) && /frais pas tous confirmés/.test(f.benefTxt), `A ${T} bénéfice +43 €, dit partiel (frais pas tous confirmés)`, f.benef + ' ' + f.benefTxt);
        dit(rgb(f.pastille)[0] < 60, `A ${T} une étape lue : pastille pleine, à l'encre`, f.pastille);
        dit(!f.petits.length, `F ${T} chaque bouton fait au moins 44 px`, f.petits.join(' | '));
        dit(f.sw <= f.cw + 1, `F ${T} aucun débordement horizontal`, `${f.sw} > ${f.cw}`);
        await pg.screenshot({ path: path.join(SHOTS, `fiche-paire-${vp.width}-117.png`) });
      });
      await essaie('B', async () => {
        const f = await fiche(pg, '118');
        if (!f) { dit(false, `B ${T} la fiche du N°118 s'ouvre`); return; }
        dit(f.etapes.achat.etat === 'absent' && f.achat === '', `B ${T} prix d'achat pas saisi ⇒ étape grisée, aucun montant`, f.achat + ' ' + f.etapes.achat.txt);
        dit(f.etapes.stock.etat === 'absent' && /pas rangée/.test(f.etapes.stock.txt), `B ${T} pas rangée ⇒ grisée`, f.etapes.stock.txt);
        dit(f.etapes.annonces.etat === 'fait' && /en ligne/.test(f.etapes.annonces.txt) && /14 favoris/.test(f.etapes.favoris.txt) && /150 vues/.test(f.etapes.favoris.txt), `B ${T} en ligne, favoris et vues lus`, f.etapes.annonces.txt + ' / ' + f.etapes.favoris.txt);
        dit(['vente', 'colis', 'argent'].every((k) => f.etapes[k].etat === 'absent'), `B ${T} pas vendue ⇒ vente, colis, argent grisés`, JSON.stringify(['vente', 'colis', 'argent'].map((k) => f.etapes[k].etat)));
        dit(f.benef === '' && /—/.test(f.benefTxt), `B ${T} bénéfice « — », jamais un 0 inventé`, f.benefTxt);
        const g = rgb(f.gris); dit(g.length && g[0] > 60, `B ${T} une étape absente est écrite en gris`, f.gris);
        await pg.screenshot({ path: path.join(SHOTS, `fiche-paire-${vp.width}-118.png`) });
      });
      await essaie('C', async () => {
        const f = await fiche(pg, '227');
        if (!f) { dit(false, `C ${T} la fiche du N°227 s'ouvre`); return; }
        dit(f.achat === '3600' && f.txs.join() === '9226' && f.vente === '7000' && f.benef === '3400', `C ${T} 50 paires au même titre : le N°227 montre SON achat (36 €) et SA vente (tx 9226)`, `${f.achat} ${f.txs.join()} ${f.vente} ${f.benef}`);
        const g = await fiche(pg, '228');
        dit(!!g && g.achat === '3700' && !g.txs.length && g.etapes.vente.etat === 'absent' && g.etapes.annonces.etat === 'fait', `C ${T} le N°228 (même titre, en ligne) : son achat (37 €), aucune vente d'une autre`, g && `${g.achat} ${g.txs.join()} ${g.etapes.vente.etat}`);
        const h = await fiche(pg, '211');
        dit(!!h && h.achat === '2000' && h.txs.join() === '9210', `C ${T} le N°211 : SA vente (tx 9210), pas celle du N°227`, h && `${h.achat} ${h.txs.join()}`);
      });
      await essaie('E', async () => {
        await pg.evaluate(() => { const b = document.querySelector('[data-fiche-fermer]'); if (b) b.click(); });
        const champ = await pg.$('[data-recherche-champ]');
        if (!champ || !(await champ.isVisible())) { await pg.locator('button[data-recherche-loupe]').first().click(); await pg.waitForSelector('[data-recherche-champ]', { timeout: 8000 }); }
        await pg.fill('[data-recherche-champ]', '117');
        await pg.waitForSelector('[data-tout-parcours]', { timeout: 15000 });
        await pg.click('[data-tout-parcours]');
        await pg.waitForSelector('[data-fiche-paire="117"]', { timeout: 8000 });
        const f = await lire(pg);
        dit(!!f && f.num === '117' && f.etapes.vente && f.etapes.vente.etat === 'fait', `E ${T} « Tout sur le N° » → « Toute l'histoire » ouvre la fiche de CE N°`, f && f.num);
        await pg.click('[data-fiche-retour]');
        await pg.waitForTimeout(300);
        const retour = await pg.evaluate(() => !document.querySelector('[data-fiche-paire]') && !!document.querySelector('[data-tout-num="117"]'));
        dit(retour, `E ${T} « ‹ Tout sur le N° » revient au bloc de la recherche`);
      });
      dit(!errs.length, `F ${T} aucune erreur d'app`, errs[0]);
      await ctx.close();
      if (vp.width === 390) await essaie('D', async () => {
        const k = await rendre(b, vp, { ventesKO: true });
        const f = await fiche(k.pg, '118');
        dit(!!f && ['vente', 'colis', 'argent'].every((x) => f.etapes[x].etat === 'passu' && f.etapes[x].raison), `D ${T} ventes illisibles ⇒ vente, colis, argent « — » avec la raison (jamais « pas encore vendue »)`, f && JSON.stringify(['vente', 'colis', 'argent'].map((x) => [f.etapes[x].etat, f.etapes[x].txt])));
        dit(!!f && !/pas encore vendue/.test(JSON.stringify(f.etapes)), `D ${T} rien n'affirme « pas encore vendue » quand les ventes manquent`);
        await k.pg.screenshot({ path: path.join(SHOTS, `fiche-paire-${vp.width}-passu.png`) });
        await k.ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ fiche d'une paire : ${ko} rouge(s)` : '\n✅ fiche d’une paire : tout est vert');
  process.exit(ko ? 1 : 0);
})();
