// Banc : LEBONCOIN — « SUPPRIMER DE LEBONCOIN » DEPUIS VRM (29 octobre).
//
// Julien : « je veux pouvoir sur VRM supprimer une annonce de Leboncoin ».
// Données INVENTÉES (il vit dans le dépôt), 390 et 1512 px, port 6332
// (`BANC_PORT`). Il exige :
//   · la N°18 vendue sur Vinted ⇒ « Supprimer de Leboncoin » à côté de la pause,
//     quand l'extension d'ici SAIT supprimer (`lbcSupprime` dans son état) ;
//   · dans « Mes annonces », un « Supprimer » sur une annonce en ligne, jamais
//     sur une annonce vendue ;
//   · le clic CONFIRME (« sans retour », titre, N°) ; Annuler n'envoie RIEN ;
//     Confirmer envoie UNE commande : l'identifiant et la confirmation ;
//   · la réponse de Leboncoin est écrite (200 ⇒ supprimée ; 403 ⇒ « pas fait ») ;
//   · une extension qui sait seulement mettre en pause ⇒ aucun « Supprimer » ;
//     pas d'extension ici ⇒ aucun bouton ;
//   · aucun débordement, aucune erreur.
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 6332;

const auj = new Date();
const ilYa = (j) => new Date(Date.now() - j * 864e5).toISOString();
const MON = '8442aaaa-0000-4000-8000-000000000001';
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const annonce = (id, titre, prix, ferme) => ({ id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, brand_title: titre.split(' ')[0], size_title: (/taille (\d+)/.exec(titre) || [])[1] || '', is_closed: !!ferme, is_hidden: false, is_draft: false, photo: { url: 'https://img.test/v' + id + '.jpg' } });
const LISTINGS = { capturedAt: auj.toISOString(), payload: { items: [
  annonce(5001, 'Nike shox TL noir et bleu marine taille 40', 55, true),   // N°18, vendue
  annonce(5002, 'Nike air max 1 Treeline taille 42', 100),                // N°13, en ligne
  annonce(5003, 'Air jordan 3 Fear pack taille 44', 80, true),            // N°14, vendue
  annonce(5004, 'Salomon XT-6 blanc taille 40', 99),                      // N°15, en ligne
], pagination: { total_entries: 4 } } };
const txn = (tx, item) => ({ id: `harvest_111_txn_${tx}`, data: { capturedAt: auj.toISOString(), payload: { transaction: { id: tx, item_id: item, status: 450, status_title: 'Commande expédiée', status_updated_at: auj.toISOString() } } } });
const MAIN = {
  vinted_annonce_numeros: {
    '5001': { numero: '18', title: 'Nike shox TL noir et bleu marine taille 40', mp: { lbc: true } },
    '5002': { numero: '13', title: 'Nike air max 1 Treeline taille 42', mp: { lbc: true } },
    '5003': { numero: '14', title: 'Air jordan 3 Fear pack taille 44', mp: { lbc: true } },
    '5004': { numero: '15', title: 'Salomon XT-6 blanc taille 40', mp: { lbc: true } },
  },
};
const ITEMS = {
  // « plus vue » il y a un jour, REVUE active depuis (sa page « Mes annonces ») : la donnée la plus récente gagne.
  '3290000001': { id: '3290000001', subject: 'Nike shox TL noir et bleu marine taille 40', price: 55, ref: '18', account: MON, platform: 'leboncoin', status: 'active', seenAt: auj.toISOString(), plusVueAt: ilYa(1), url: 'https://www.leboncoin.fr/ad/chaussures/3290000001', images: ['https://img.test/l1.jpg'] },
  '3290000002': { id: '3290000002', subject: 'Nike air max 1 Treeline T42', price: 100, ref: '13', account: MON, platform: 'leboncoin', status: 'active', seenAt: auj.toISOString(), images: [] },
  '3270000004': { id: '3270000004', subject: 'Air jordan 3 Fear pack T44', price: 80, ref: '14', account: MON, platform: 'leboncoin', status: 'active', seenAt: ilYa(32), plusVueAt: ilYa(0.05), images: [] },
  '3270000003': { id: '3270000003', subject: 'Adidas Spezial noir taille 38,5', price: 44, account: MON, platform: 'leboncoin', status: 'active', seenAt: ilYa(32), images: ['https://img.test/l3.jpg'] },
  '3290000005': { id: '3290000005', subject: 'Salomon XT-6 blanc taille 40', price: 99, account: MON, platform: 'leboncoin', status: 'active', seenAt: auj.toISOString(), images: ['https://img.test/l5.jpg'] },
  '3290000006': { id: '3290000006', subject: 'Asics gel kayano vendue', price: 70, account: MON, platform: 'leboncoin', status: 'sold', seenAt: auj.toISOString(), images: [] },
};
// (29 oct., revue) Les variantes : `items` remplace des annonces Leboncoin,
// `main` ajoute des clés à la ligne `main`, `extra` ajoute des lignes.
const construire = (o = {}) => [
  { id: 'main', data: Object.assign({}, MAIN, o.main || {}) },
  { id: 'harvest_111_listings', data: LISTINGS },
  txn(9001, 5001), txn(9003, 5003),
  // La marque « publiée » (sa dernière écriture) : AVANT la liste complète lue il y a 72 min.
  { id: 'vinted_lbc_posted', data: { ids: ['5001', '5003'], updatedAt: ilYa(3) } },
  { id: 'lbc_listings', data: { items: Object.assign({}, ITEMS, o.items || {}), lectures: { [MON]: { at: ilYa(0.05), total: 3, n: 3 } } } },
  { id: 'lbc_accounts', data: { accounts: { [MON]: { id: MON, name: 'Totomondu', sessionAt: auj.toISOString(), source: 'session:messagerie' } } } },
  { id: 'lbc_ventes', data: { ventes: {} } },
  ...(o.extra || []),
];
const ECRITS = [];
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT=…)'); process.exit(1); });
srv.listen(PORT);
// Projection PostgREST : `alias:data->champ` / `alias:data->>champ` (§6.3).
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};
// Le pont simulé : ce que dit l'état (`lbcSupprime` seulement en mode « ok ») et ce que répond la commande.
const PONT = ({ mode, suite }) => {
  window.__cmds = [];
  if (mode === 'absente') return;
  const version = '5.211.0';
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: 'ext-banc' });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: Object.assign({ ok: true, version, code: version, ext: 'ext-banc', vrm: { ok: true, connecte: true, email: '' }, vinted: null, cmds: {} }, mode === 'ok' || mode === 'pause' ? { lbcPause: true } : {}, mode === 'ok' ? { lbcSupprime: true } : {}) });
    if (d.__vmr === 'cmd') {
      window.__cmds.push(JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k]) => !['__vmr', 'reqId'].includes(k)))));
      if (d.cmd !== 'lbcPause' && d.cmd !== 'lbcSupprime') { post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'inconnue', raison: 'commande inconnue' } }); return; }
      const resp = suite === 'refuse'
        ? { accepte: true, etape: 'refuse', statut: 403, reponse: '{"error":"forbidden"}' }
        : { accepte: true, etape: 'fait', statut: 200, reponse: '{"ok":true}', note: true };
      setTimeout(() => post({ __vmr: 'cmd:result', reqId: d.reqId, resp }), 150);
    }
  });
  post({ __vmr: 'ready', version, id: 'ext-banc' });
};

async function ouvrir(b, vp, pont, o = {}) {
  const rows = construire(o);
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.addInitScript(PONT, pont);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') { try { ECRITS.push({ u, corps: route.request().postData() || '' }); } catch (_) {} return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: (r.data || {}).capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${o.tab || 'leboncoin'}`, { waitUntil: 'domcontentloaded' });
  if (o.tab && o.tab !== 'leboncoin') { await pg.waitForTimeout(2500); return { ctx, pg, errs }; }
  await pg.waitForSelector('[data-lbc-retirer]', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(1500);
  return { ctx, pg, errs };
}
const lire = (pg) => pg.evaluate(() => ({
  retirer: [...document.querySelectorAll('[data-lbc-retirer]')].map((e) => e.getAttribute('data-lbc-retirer')),
  boutons: [...document.querySelectorAll('[data-lbc-pause]')].map((e) => e.getAttribute('data-lbc-pause')),
  geste: [...document.querySelectorAll('[data-lbc-pause-geste]')].map((e) => e.getAttribute('data-lbc-pause-geste')),
  plusVues: (document.querySelector('[data-lbc-plus-vues]') || { getAttribute: () => null }).getAttribute('data-lbc-plus-vues'),
  plusVuesTxt: (document.querySelector('[data-lbc-plus-vues]') || {}).innerText || '',
  pasRevues: (document.querySelector('[data-lbc-pas-revues]') || { getAttribute: () => null }).getAttribute('data-lbc-pas-revues'),
  pasRevuesTxt: (document.querySelector('[data-lbc-pas-revues]') || {}).innerText || '',
  relier: [...document.querySelectorAll('[data-lbc-relier]')].map((e) => e.getAttribute('data-lbc-relier')),
  liens: [...document.querySelectorAll('[data-lbc-retirer] a[href*="leboncoin.fr"]')].map((a) => a.href),
  sortie: [...document.querySelectorAll('[data-lbc-retirer-sortie]')].map((e) => e.getAttribute('data-lbc-retirer') + ':' + e.getAttribute('data-lbc-retirer-sortie')),
  doute: [...document.querySelectorAll('[data-lbc-retirer-doute]')].map((e) => e.getAttribute('data-lbc-retirer-doute')),
  douteTxt: (document.querySelector('[data-lbc-retirer-doute]') || {}).innerText || '',
  suppr: [...document.querySelectorAll('[data-lbc-retirer] [data-lbc-supprimer]')].map((e) => e.getAttribute('data-lbc-supprimer')),
  supprCat: [...document.querySelectorAll('[data-lbc-catalog-id] [data-lbc-supprimer]')].map((e) => e.getAttribute('data-lbc-supprimer')),
  catIds: [...document.querySelectorAll('[data-lbc-catalog-id]')].map((e) => e.getAttribute('data-lbc-catalog-id') + ':' + e.getAttribute('data-lbc-catalog-etat')),
  resSuppr: [...document.querySelectorAll('[data-lbc-supprimer-resultat]')].map((e) => ({ id: e.getAttribute('data-lbc-supprimer-resultat'), etape: e.getAttribute('data-etape'), t: e.innerText })),
  resultats: [...document.querySelectorAll('[data-lbc-pause-resultat]')].map((e) => ({ id: e.getAttribute('data-lbc-pause-resultat'), etape: e.getAttribute('data-etape'), t: e.innerText })),
  deborde: [...document.querySelectorAll('button,input')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right > document.documentElement.clientWidth + 1; }).map((e) => e.textContent.trim().slice(0, 20) || e.tagName),
  sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
}));
const feuilleS = (pg) => pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Oui, supprimer de Leboncoin'); let t = ''; let n = b; for (let i = 0; i < 6 && n; i++) { n = n.parentElement; if (n && n.innerText && n.innerText.length > t.length && n.innerText.length < 900) t = n.innerText; } return { ok: !!b, t }; });
const feuille = (pg) => pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Mettre en pause'); const s = b ? b.closest('div[role="dialog"], form, div') : null; let t = ''; let n = b; for (let i = 0; i < 6 && n; i++) { n = n.parentElement; if (n && n.innerText && n.innerText.length > t.length && n.innerText.length < 900) t = n.innerText; } return { ok: !!b, t }; });
const cliquer = (pg, texte) => pg.evaluate((tx) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === tx); if (b) b.click(); return !!b; }, texte);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px · extension à jour (elle sait supprimer)`);
      const { ctx, pg, errs } = await ouvrir(b, vp, { mode: 'ok', suite: 'fait' });
      await pg.waitForSelector('[data-lbc-supprimer]', { timeout: 10000 }).catch(() => {});
      await pg.waitForTimeout(500);
      const v = await lire(pg);
      await pg.screenshot({ path: path.join(require('os').tmpdir(), 'lbc-supprimer-' + vp.width + '.png'), fullPage: true });
      dit(v.suppr.join() === '3290000001', '« Supprimer de Leboncoin » sur la N°18 vendue sur Vinted (la ligne « à retirer »)', JSON.stringify(v.suppr));
      dit(v.boutons.includes('3290000001'), '… la mise en pause reste proposée à côté', JSON.stringify(v.boutons));
      dit(v.supprCat.includes('3290000002') && !v.supprCat.includes('3290000006'), '« Mes annonces » : Supprimer sur une annonce en ligne, jamais sur une vendue', JSON.stringify({ supprCat: v.supprCat, cat: v.catIds }));
      // (29 oct., revue) §7 : le rouge est réservé à deux paires sous un même N°.
      // Aucun geste de la ligne (« à retirer », « Mes annonces ») n'est rouge : le
      // danger se dit dans la confirmation.
      const rouges = await pg.evaluate(() => {
        const rouge = (c) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || ''); return !!m && +m[1] > 150 && +m[2] < 110 && +m[3] < 110; };
        return [...document.querySelectorAll('[data-lbc-retirer] button, [data-lbc-catalog-id] button')].filter((e) => { const cs = getComputedStyle(e); return rouge(cs.color) || rouge(cs.borderTopColor); }).map((e) => e.textContent.trim() + ' ' + getComputedStyle(e).color);
      });
      dit(rouges.length === 0, 'aucun geste de la ligne n’est en rouge (« Supprimer », « Supprimer de Leboncoin »)', rouges.slice(0, 4).join(' | '));
      await pg.click('[data-lbc-retirer] [data-lbc-supprimer="3290000001"]').catch(() => {});
      await pg.waitForTimeout(500);
      const f1 = await feuilleS(pg);
      dit(f1.ok && /sans retour/i.test(f1.t) && /Nike shox TL noir/.test(f1.t) && /N°18/.test(f1.t) && /vendue sur Vinted/.test(f1.t), 'la confirmation dit « sans retour » et NOMME l’annonce (titre, N°, pourquoi)', f1.t.replace(/\s+/g, ' ').slice(0, 220));
      await cliquer(pg, 'Annuler');
      await pg.waitForTimeout(600);
      const c0 = await pg.evaluate(() => window.__cmds.filter((x) => /lbcSupprime/.test(x)));
      dit(c0.length === 0, 'Annuler n’envoie RIEN', JSON.stringify(c0));
      await pg.click('[data-lbc-retirer] [data-lbc-supprimer="3290000001"]').catch(() => {});
      await pg.waitForTimeout(500);
      await cliquer(pg, 'Oui, supprimer de Leboncoin');
      await pg.waitForSelector('[data-lbc-supprimer-resultat]', { timeout: 10000 }).catch(() => {});
      await pg.waitForTimeout(500);
      const c1 = await pg.evaluate(() => window.__cmds.filter((x) => /lbcSupprime/.test(x)));
      dit(c1.length === 1 && c1[0] === JSON.stringify({ cmd: 'lbcSupprime', id: '3290000001', confirme: true }), 'Confirmer envoie UNE commande : l’identifiant et la confirmation', JSON.stringify(c1));
      const v2 = await lire(pg);
      const r = v2.resSuppr.find((x) => x.id === '3290000001');
      dit(r && r.etape === 'fait' && /supprimée/.test(r.t) && /200/.test(r.t), 'la réponse de Leboncoin est écrite (supprimée, 200)', r && r.t);
      dit(v2.deborde.length === 0 && v2.sw <= v2.cw + 1, 'aucun bouton rogné, aucun débordement', v2.deborde.join(', ') + ` ${v2.sw}/${v2.cw}`);
      dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();

      console.log(`── ${vp.width} px · supprimer depuis « Mes annonces » (une annonce qui n'est pas à retirer)`);
      const oc = await ouvrir(b, vp, { mode: 'ok', suite: 'fait' });
      await oc.pg.waitForSelector('[data-lbc-catalog-id="3290000002"] [data-lbc-supprimer]', { timeout: 10000 }).catch(() => {});
      await oc.pg.click('[data-lbc-catalog-id="3290000002"] [data-lbc-supprimer]').catch(() => {});
      await oc.pg.waitForTimeout(500);
      const fc = await feuilleS(oc.pg);
      dit(fc.ok && /sans retour/i.test(fc.t) && /Treeline/.test(fc.t), 'la confirmation nomme CETTE annonce', fc.t.replace(/\s+/g, ' ').slice(0, 200));
      await cliquer(oc.pg, 'Oui, supprimer de Leboncoin');
      await oc.pg.waitForSelector('[data-lbc-supprimer-resultat]', { timeout: 10000 }).catch(() => {});
      const cc = await oc.pg.evaluate(() => window.__cmds.filter((x) => /lbcSupprime/.test(x)));
      dit(cc.length === 1 && JSON.parse(cc[0]).id === '3290000002' && JSON.parse(cc[0]).confirme === true, 'UNE commande, pour cette annonce, confirmée', JSON.stringify(cc));
      await oc.ctx.close();

      console.log(`── ${vp.width} px · Leboncoin refuse`);
      const o2 = await ouvrir(b, vp, { mode: 'ok', suite: 'refuse' });
      await o2.pg.waitForSelector('[data-lbc-retirer] [data-lbc-supprimer]', { timeout: 10000 }).catch(() => {});
      await o2.pg.click('[data-lbc-retirer] [data-lbc-supprimer="3290000001"]').catch(() => {});
      await o2.pg.waitForTimeout(500);
      await cliquer(o2.pg, 'Oui, supprimer de Leboncoin');
      await o2.pg.waitForSelector('[data-lbc-supprimer-resultat]', { timeout: 10000 }).catch(() => {});
      await o2.pg.waitForTimeout(400);
      const v3 = await lire(o2.pg);
      const r3 = v3.resSuppr.find((x) => x.id === '3290000001');
      dit(r3 && r3.etape === 'refuse' && /pas fait/.test(r3.t) && /403/.test(r3.t) && /forbidden/.test(r3.t), 'un refus dit « pas fait », avec le statut et le texte de Leboncoin', r3 && r3.t);
      dit(v3.retirer.includes('3290000001'), '… et l’annonce reste « à retirer »');
      await o2.ctx.close();

      console.log(`── ${vp.width} px · extension qui sait seulement mettre en pause`);
      const o3 = await ouvrir(b, vp, { mode: 'pause' });
      await o3.pg.waitForSelector('[data-lbc-pause]', { timeout: 10000 }).catch(() => {});
      await o3.pg.waitForTimeout(800);
      const v4 = await lire(o3.pg);
      dit(v4.suppr.length === 0 && v4.supprCat.length === 0 && v4.boutons.includes('3290000001'), 'aucun « Supprimer » (ni ligne, ni « Mes annonces ») ; la pause reste', JSON.stringify({ s: v4.suppr, c: v4.supprCat, p: v4.boutons }));
      await o3.ctx.close();

      console.log(`── ${vp.width} px · pas d'extension ici`);
      const o4 = await ouvrir(b, vp, { mode: 'absente' });
      await o4.pg.waitForTimeout(1500);
      const v5 = await lire(o4.pg);
      dit(v5.suppr.length === 0 && v5.supprCat.length === 0 && v5.liens.length >= 1, 'aucun bouton ; le lien « voir sur Leboncoin » reste', JSON.stringify({ s: v5.suppr, c: v5.supprCat }));
      await o4.ctx.close();

      // (29 oct., revue) eBay → Leboncoin : une annonce désignée par le SEUL
      // « n15 » de son titre ne reçoit ni « Supprimer » (sans retour) ni la pause.
      console.log(`── ${vp.width} px · vendue sur eBay, annonce Leboncoin reliée par son titre seulement`);
      const ebayRow = { id: 'ebay_orders', data: { capturedAt: auj.toISOString(), orders: [{ orderId: '11-0001', creationDate: auj.toISOString(), orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED', lineItems: [{ sku: 'VRM-15', legacyItemId: '1100001', title: 'Salomon XT-6' }] }] } };
      const o5 = await ouvrir(b, vp, { mode: 'ok', suite: 'fait' }, { items: { '3290000005': Object.assign({}, ITEMS['3290000005'], { subject: 'Salomon XT-6 blanc n15' }) }, extra: [ebayRow] });
      await o5.pg.waitForTimeout(1500);
      const v6 = await o5.pg.evaluate(() => ({ suppr: [...document.querySelectorAll('[data-lbc-retirer] [data-lbc-supprimer="3290000005"]')].length, pause: [...document.querySelectorAll('[data-lbc-retirer] [data-lbc-pause="3290000005"]')].length, ebay: [...document.querySelectorAll('[data-lbc-retirer-ebay] ~ [data-lbc-retirer], [data-lbc-retirer="3290000005"]')].map((e) => e.innerText.slice(0, 60)) }));
      dit(v6.suppr === 0 && v6.pause === 0, 'aucun « Supprimer » ni pause sur une annonce désignée par le seul « n15 » de son titre', JSON.stringify(v6));
      await o5.ctx.close();
      // L'autre sens : la même annonce porte la RÉFÉRENCE VRM 15 ⇒ « vendue sur eBay », avec ses gestes.
      const o6 = await ouvrir(b, vp, { mode: 'ok', suite: 'fait' }, { items: { '3290000005': Object.assign({}, ITEMS['3290000005'], { ref: '15' }) }, extra: [ebayRow] });
      await o6.pg.waitForSelector('[data-lbc-retirer-ebay]', { timeout: 8000 }).catch(() => {});
      const v7 = await o6.pg.evaluate(() => ({ ebay: (document.querySelector('[data-lbc-retirer-ebay]') || { getAttribute: () => null }).getAttribute('data-lbc-retirer-ebay'), suppr: document.querySelectorAll('[data-lbc-retirer] [data-lbc-supprimer="3290000005"]').length }));
      dit(v7.ebay === '1' && v7.suppr === 1, '… et par sa référence VRM : « vendue sur eBay — à retirer » avec « Supprimer de Leboncoin »', JSON.stringify(v7));
      await o6.ctx.close();

      // (29 oct., revue) Ma journée et le logo VRM : LA MÊME preuve que l'écran
      // Leboncoin (la transaction). La N°15 n'est « vendue » que par un rapprochement
      // de titre (`vinted_annonces_email_sold`) : ni Ma journée, ni la liste publiée
      // pour le logo ne la comptent ; aucune entrée sans N° ni annonce ne part.
      console.log(`── ${vp.width} px · Ma journée = l'écran Leboncoin (preuve par transaction seulement)`);
      ECRITS.length = 0;
      const oj = await ouvrir(b, vp, { mode: 'ok', suite: 'fait' }, { tab: 'journee', main: { vinted_annonces_email_sold: ['5004'] }, items: { '3290000005': Object.assign({}, ITEMS['3290000005'], { ref: '15' }) } });
      await oj.pg.waitForFunction(() => [...document.querySelectorAll('[data-job]')].some((e) => /à retirer de Leboncoin/.test(e.innerText)), null, { timeout: 15000 }).catch(() => {});
      await oj.pg.waitForTimeout(1200);
      const lj = await oj.pg.evaluate(() => { const e = [...document.querySelectorAll('[data-job]')].find((x) => /à retirer de Leboncoin/.test(x.innerText)); return e ? e.innerText.replace(/\s+/g, ' ') : ''; });
      dit(/N°18/.test(lj) && !/N°15/.test(lj) && /(^|\D)1 à retirer de Leboncoin/.test(lj), 'Ma journée : « 1 à retirer de Leboncoin — N°18 », pas la N°15 rapprochée par titre', lj.slice(0, 120));
      const pubs = ECRITS.filter((x) => /lbc_a_retirer/.test(x.corps)).map((x) => { try { const c = JSON.parse(x.corps); const r = Array.isArray(c) ? c[0] : c; return r.data.liste; } catch (_) { return null; } });
      const toutes = pubs.flat().filter(Boolean);
      dit(pubs.length >= 1 && toutes.every((r) => r.numero === '18') && toutes.every((r) => r.numero || r.lbcId), 'la liste publiée pour le logo VRM : la N°18 seulement, jamais une ligne vide', JSON.stringify(pubs).slice(0, 200));
      // Le clic mène À la paire, pas en haut de l'écran Leboncoin.
      await oj.pg.evaluate(() => { const e = [...document.querySelectorAll('[data-job]')].find((x) => /à retirer de Leboncoin/.test(x.innerText)); if (e) e.click(); });
      await oj.pg.waitForSelector('[data-lbc-retirer]', { timeout: 20000 }).catch(() => {});
      await oj.pg.waitForTimeout(3500);
      const pos = await oj.pg.evaluate(() => { const e = document.querySelector('[data-lbc-retirer]'); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), h: window.innerHeight }; });
      dit(pos && pos.top >= 0 && pos.top < pos.h, '« Voir » de Ma journée amène la paire à retirer à l’écran', JSON.stringify(pos));
      dit(oj.errs.length === 0, 'aucune erreur d’app (Ma journée)', oj.errs.join(' | ').slice(0, 160));
      await oj.ctx.close();

      // (29 oct., revue) Republier sans extension, sur un ORDINATEUR : la cause est
      // l'extension absente d'ici, pas le relais du téléphone.
      if (vp.width > 600) {
        console.log(`── ${vp.width} px · Republier sans extension, sur ordinateur`);
        const or = await ouvrir(b, vp, { mode: 'absente' }, { items: { '3290000005': Object.assign({}, ITEMS['3290000005'], { ref: '15' }) } });
        await or.pg.waitForSelector('[data-repub-lbc-ouvrir]', { timeout: 8000 }).catch(() => {});
        await or.pg.click('[data-repub-lbc-ouvrir]').catch(() => {});
        await or.pg.waitForTimeout(800);
        const tr = await or.pg.evaluate(() => document.body.innerText);
        dit(!/relais du téléphone/.test(tr) && /pas détectée dans ce navigateur/.test(tr), 'la feuille dit « l’extension n’est pas détectée dans ce navigateur », pas « le relais du téléphone »', (tr.match(/.{0,60}(relais du téléphone|pas détectée dans ce navigateur).{0,40}/) || [''])[0]);
        await or.ctx.close();
      }
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ Leboncoin supprimer : ${ko} rouge(s)` : '\n✅ Leboncoin supprimer : tout est vert');
  process.exit(ko ? 1 : 0);
})();
