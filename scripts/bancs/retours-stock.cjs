// ═══════════════════════════════════════════════════════════════════════════
// BANC : RETOUR → STOCK, « Retours en cours » dans Colis (21 octobre)
//        (node scripts/bancs/retours-stock.cjs — après `npm run build`)
//        BANC_PORT=… pour un autre port · BANC_DIST=… pour un autre build
// ═══════════════════════════════════════════════════════════════════════════
// Ventes INVENTÉES à la forme mesurée dans sa base le 21 octobre (transaction
// 440 « Retour initié », colis de retour « déposé », vente « Remboursement
// effectué » `failed`). Il vit dans le dépôt (public) : aucune vraie donnée.
//   9301  retour initié, transaction → annonce i40 → N°40          ⇒ « initié », N°40
//   9302  MÊME TITRE que 9301, vente finalisée (annonce i41, N°41) ⇒ pas un retour
//   9303  retour, colis déposé, annonce i50 → N°50 ; une AUTRE annonce
//         EN LIGNE porte aussi le N°50                             ⇒ « en route »,
//         la remise en stock DEMANDE (jamais devinée)
//   9304  « Retour initié » sans transaction captée, même titre que 9301
//                                                                 ⇒ « pas reliée »,
//         aucun N° (jamais le 40 ni le 41 par le titre), pas de remise en stock
//   9305  remboursée, déjà notée reçue, annonce i60 → N°60         ⇒ remise en stock
//         garde le N°60, passe « à republier », écrite dans le nuage
//   9306  transaction figée à 440, vente finalisée                ⇒ pas un retour
// Il exige, aux deux tailles (390 px tactile, 1512 px) : les lignes et leurs
// N° (attributs `data-retour*`), « Reçu chez moi » sur SON clic, la remise en
// stock qui garde le N°, la question quand le N° est porté ailleurs, et un
// second rendu où les ventes sont illisibles : « pas pu lire », jamais
// « aucun retour ». Aucun débordement, aucune erreur, aucun écran tombé.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4383;

const MAINTENANT = Date.now(), H = 3600000;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const T = 'Alpha Retour taille 40';
const VENTES = [
  { transaction_id: 9301, title: T, status: 'Commande livrée ! ', transaction_user_status: 'needs_action', date: ilYaH(100), price: { amount: '60.0', currency_code: 'EUR' } },
  { transaction_id: 9302, title: T, status: 'Commande finalisée', transaction_user_status: 'completed', date: ilYaH(200), price: { amount: '60.0', currency_code: 'EUR' } },
  { transaction_id: 9303, title: 'Bravo Retour taille 42', status: 'Commande livrée ! ', transaction_user_status: 'needs_action', date: ilYaH(90), price: { amount: '70.0', currency_code: 'EUR' } },
  { transaction_id: 9304, title: T, status: 'Retour initié', transaction_user_status: 'needs_action', date: ilYaH(50), price: { amount: '60.0', currency_code: 'EUR' } },
  { transaction_id: 9305, title: 'Delta Retour taille 43', status: 'Remboursement effectué', transaction_user_status: 'failed', date: ilYaH(240), price: { amount: '80.0', currency_code: 'EUR' } },
  { transaction_id: 9306, title: 'Echo Retour taille 39', status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed', date: ilYaH(400), price: { amount: '40.0', currency_code: 'EUR' } },
];
const TXN = [
  { tx: 9301, item: 'i40', s: 440, ss: '' },
  { tx: 9302, item: 'i41', s: 450, ss: 'Commande livrée ! ' },
  { tx: 9303, item: 'i50', s: 440, ss: "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais" },
  { tx: 9305, item: 'i60', s: 440, ss: 'Commande livrée ! ' },
  { tx: 9306, item: 'i70', s: 440, ss: '' },
];
const NUMEROS = {
  i40: { numero: '40', title: T, auto: false }, i41: { numero: '41', title: T, auto: false },
  i50: { numero: '50', title: 'Bravo Retour taille 42' }, a50b: { numero: '50', title: 'Bravo bis en ligne' },
  i60: { numero: '60', title: 'Delta Retour taille 43' }, i70: { numero: '70', title: 'Echo Retour taille 39' },
};
const ITEMS = [
  { id: 'a50b', title: 'Bravo bis en ligne', price: { amount: '72.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, user: { id: 111 }, photo: { url: 'https://images1.vinted.net/t/x/f800/a50b.jpeg' } },
];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const rowsDe = (ventesOk) => [
  { id: 'main', data: { vinted_annonce_numeros: NUMEROS, vinted_used_numeros: [40, 41, 50, 60, 70], vinted_retours_recus: { 9305: ilYaH(10) } } },
  ...(ventesOk ? [{ id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: VENTES } } }] : []),
  { id: 'harvest_111_listings', data: { capturedAt: ilYaH(0.2), payload: { items: ITEMS, pagination: { total_entries: ITEMS.length } } } },
  ...TXN.map((t) => ({ id: `harvest_111_txn_${t.tx}`, data: { capturedAt: ilYaH(1), payload: { transaction: { id: t.tx, item_id: t.item, status: t.s, status_updated_at: ilYaH(5), shipment: { status_title: t.ss } } } } })),
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).replace(/\s+/g,' ').slice(0, 600)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT)'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};

async function preparer(b, vp, { ventesOk = true } = {}) {
  const ROWS = rowsDe(ventesOk);
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = [], ecrits = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { try { ecrits.push(req.postData() || ''); } catch (_) {} return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (!ventesOk && /orders_sold|orders_%|orders_\*/.test(u)) return route.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"message":"panne"}' });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, ecrits };
}
async function sain(pg, ecran) {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
}
const lire = (pg) => pg.evaluate(() => {
  const el = document.querySelector('[data-retours-encours]');
  if (!el) return null;
  return { n: el.getAttribute('data-retours-encours'), remises: el.getAttribute('data-retours-remises'), manques: el.getAttribute('data-retours-manques'),
    lignes: [...el.querySelectorAll('[data-retour]')].map((x) => ({ cle: x.getAttribute('data-retour'), etape: x.getAttribute('data-retour-etape'), num: x.getAttribute('data-retour-num'), recu: x.getAttribute('data-retour-recu'),
      remise: !!x.querySelector('[data-geste="remise-en-stock"]') })), txt: el.innerText };
});
const ligne = (a, cle) => (a && a.lignes.find((l) => l.cle === cle)) || null;
const cliquerDans = async (pg, cle, geste) => { await pg.locator(`[data-retour="${cle}"] [data-geste="${geste}"]`).click({ timeout: 5000 }); };
// La feuille de confirmation : à 1512 px, sous le voile flouté, Playwright juge
// parfois le bouton « hors de la fenêtre » (vu aussi sur ebay-comptes) — le
// bouton est là et visible : on le clique dans la page.
const confirmer = async (pg, libelle) => {
  await pg.getByRole('button', { name: libelle, exact: true }).first().waitFor({ state: 'visible', timeout: 5000 });
  const ok = await pg.evaluate((l) => { const bs = [...document.querySelectorAll('button')].filter((x) => x.innerText.trim() === l); const el = bs[bs.length - 1]; if (!el) return false; el.click(); return true; }, libelle);
  if (!ok) throw new Error('bouton « ' + libelle + ' » introuvable');
  await pg.waitForTimeout(700);
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      const { ctx, pg, errs, ecrits } = await preparer(b, vp);
      await essaie('lignes', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-retours-encours]', { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        const a = await lire(pg);
        const cles = a ? a.lignes.map((l) => l.cle).sort().join(',') : '';
        dit(!!a && cles === '9301,9303,9304,9305', 'Colis : « Retours en cours » liste EXACTEMENT les retours (ni la finalisée au même titre, ni la transaction figée d’une vente finalisée)', cles || 'aucun bloc');
        dit(ligne(a, '9301') && ligne(a, '9301').num === '40' && ligne(a, '9301').etape === 'initie', '9301 : N°40 par identité (pas le 41 au même titre), étape « initié »', JSON.stringify(ligne(a, '9301')));
        dit(ligne(a, '9303') && ligne(a, '9303').etape === 'en-route' && ligne(a, '9303').num === '50', '9303 : colis déposé ⇒ « en route », N°50', JSON.stringify(ligne(a, '9303')));
        dit(ligne(a, '9304') && ligne(a, '9304').num === '', '9304 : aucune identité ⇒ « pas reliée », aucun N° deviné par le titre', JSON.stringify(ligne(a, '9304')));
        dit(ligne(a, '9305') && ligne(a, '9305').etape === 'rembourse' && ligne(a, '9305').recu === '1', '9305 : remboursée, déjà notée reçue', JSON.stringify(ligne(a, '9305')));
        dit(ligne(a, '9305') && ligne(a, '9305').remise && !ligne(a, '9301').remise, '« Remise en stock » seulement sur un colis noté reçu');
        await pg.screenshot({ path: path.join(os.tmpdir(), 'retours-stock-' + vp.width + '.png'), fullPage: true }).catch(() => {});
        await sain(pg, 'Colis');
      });
      await essaie('reçu sur son clic', async () => {
        await cliquerDans(pg, '9304', 'recu');
        await pg.waitForTimeout(500);
        const a = await lire(pg);
        dit(ligne(a, '9304') && ligne(a, '9304').recu === '1' && !ligne(a, '9304').remise, '« Reçu chez moi » sur 9304 ⇒ reçu ; sans N°, aucune remise en stock proposée', JSON.stringify(ligne(a, '9304')));
      });
      await essaie('remise en stock garde le N°', async () => {
        await cliquerDans(pg, '9305', 'remise-en-stock');
        await confirmer(pg, 'Remettre en stock');
        const a = await lire(pg);
        const l = ligne(a, '9305');
        dit(l && l.etape === 'remis' && l.num === '60', '9305 : remise en stock ⇒ « à republier », N°60 gardé', JSON.stringify(l));
        dit(!!(await pg.$('[data-retour="9305"] [data-geste="republier"]')), 'la republication est proposée');
        await pg.waitForTimeout(1800);
        const nuage = ecrits.some((t) => /vinted_retours_remis/.test(t) && /"9305"/.test(t) && /"num":"60"/.test(t));
        dit(nuage, 'la remise en stock part au nuage avec le N°60 (`vinted_retours_remis`)', ecrits.length + ' écriture(s)');
      });
      await essaie('N° porté ailleurs : on demande', async () => {
        await cliquerDans(pg, '9303', 'recu');
        await pg.waitForTimeout(400);
        await cliquerDans(pg, '9303', 'remise-en-stock');
        await pg.waitForTimeout(500);
        const q = await pg.evaluate(() => document.body.innerText);
        dit(/N°50 est déjà porté/.test(q), 'le N°50 porté par une autre paire en ligne ⇒ VRM DEMANDE avant toute remise', '');
        await confirmer(pg, 'Annuler');
        const a = await lire(pg);
        dit(ligne(a, '9303') && ligne(a, '9303').etape !== 'remis', '« Annuler » ⇒ rien ne change', JSON.stringify(ligne(a, '9303')));
      });
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 200));
      await ctx.close();
      // Ventes illisibles : « pas su », jamais « aucun retour ».
      const p2 = await preparer(b, vp, { ventesOk: false });
      await essaie('pas su', async () => {
        await p2.pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
        await p2.pg.waitForTimeout(5000);
        const a = await lire(p2.pg);
        const okPasSu = !!a && (a.n === 'passu' || Number(a.manques) > 0) && !a.lignes.length;
        dit(okPasSu, 'ventes illisibles ⇒ le bloc dit qu’il n’a pas pu lire (jamais « aucun retour »)', a ? JSON.stringify({ n: a.n, m: a.manques, t: a.txt.slice(0, 120) }) : 'aucun bloc');
        await sain(p2.pg, 'Colis (pas su)');
      });
      await p2.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ retours → stock : ${ko} rouge(s)` : '\n✅ retours → stock : tout est vert');
  process.exit(ko ? 1 : 0);
})();
