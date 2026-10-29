// Banc : LEBONCOIN — « METTRE EN PAUSE » ET « PLUS VUE SUR LEBONCOIN » (22 octobre).
//
// Propositions 6 et 14. Sur des données INVENTÉES (il vit dans le dépôt, aucune
// `fx/`), rendu à 390 et 1512 px, port 6331 (`BANC_PORT`). Il exige :
//   · la N°18 vendue sur Vinted, encore en ligne sur Leboncoin ⇒ « à retirer »,
//     avec « Mettre en pause sur Leboncoin » quand l'extension d'ici SAIT le faire ;
//   · le clic CONFIRME en nommant l'annonce ; Annuler n'envoie RIEN ; Confirmer
//     envoie UNE commande portant l'identifiant seul ;
//   · la réponse de Leboncoin est écrite (200 ⇒ fait, avec le statut ; 403 ⇒
//     « pas fait », avec le statut et le texte) ;
//   · extension en retard ⇒ pas de bouton, la phrase « mets-la à jour » ;
//     pas d'extension ici ⇒ pas de bouton, le lien reste ;
//   · la N°14, dont l'annonce Leboncoin est « plus vue » dans une liste complète,
//     n'est PLUS « à retirer » (ni ici, ni dans Ma journée), et la ligne
//     « plus comptée en ligne » le dit, une fois, sans rien effacer ;
//   · une annonce pas revue depuis 32 jours ne demande pas « quelle paire ? »
//     (la ligne « pas revues » dit le geste) — une annonce fraîche, si ;
//   · (revue du 22 oct.) la donnée la plus récente gagne : une annonce marquée
//     « plus vue » puis REVUE active après (`seenAt` plus récent) reste en vente,
//     donc « à retirer » avec son bouton ;
//   · (revue du 22 oct.) la ligne venue de `vinted_lbc_posted` ne part que sur
//     une PREUVE (liste complète de chacun de ses comptes postérieure à la marque
//     « publiée ») : sans elle, la N°14 reste « à retirer », avec le doute dit
//     une fois — ici et dans Ma journée ;
//   · aucun débordement, aucune erreur.
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 6331;

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
};
const rows = [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: LISTINGS },
  txn(9001, 5001), txn(9003, 5003),
  // La marque « publiée » (sa dernière écriture) : AVANT la liste complète lue il y a 72 min.
  { id: 'vinted_lbc_posted', data: { ids: ['5001', '5003'], updatedAt: ilYa(3) } },
  { id: 'lbc_listings', data: { items: ITEMS, lectures: { [MON]: { at: ilYa(0.05), total: 3, n: 3 } } } },
  { id: 'lbc_accounts', data: { accounts: { [MON]: { id: MON, name: 'Totomondu', sessionAt: auj.toISOString(), source: 'session:messagerie' } } } },
  { id: 'lbc_ventes', data: { ventes: {} } },
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
// Le pont simulé : la version annoncée, ce que dit l'état, et ce que répond « lbcPause ».
const PONT = ({ mode, suite }) => {
  window.__cmds = [];
  if (mode === 'absente') return;
  const version = '5.211.0';
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: 'ext-banc' });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: Object.assign({ ok: true, version, code: version, ext: 'ext-banc', vrm: { ok: true, connecte: true, email: '' }, vinted: null, cmds: {} }, mode === 'ok' ? { lbcPause: true } : {}) });
    if (d.__vmr === 'cmd') {
      window.__cmds.push(JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k]) => !['__vmr', 'reqId'].includes(k)))));
      if (d.cmd !== 'lbcPause') { post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'inconnue', raison: 'commande inconnue' } }); return; }
      const resp = suite === 'refuse'
        ? { accepte: true, etape: 'refuse', statut: 403, reponse: '{"error":"forbidden"}' }
        : { accepte: true, etape: 'fait', statut: 200, reponse: '{"ok":true}', note: true };
      setTimeout(() => post({ __vmr: 'cmd:result', reqId: d.reqId, resp }), 150);
    }
  });
  post({ __vmr: 'ready', version, id: 'ext-banc' });
};

async function ouvrir(b, vp, pont) {
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
  await pg.goto(`http://localhost:${PORT}/?tab=leboncoin`, { waitUntil: 'domcontentloaded' });
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
  resultats: [...document.querySelectorAll('[data-lbc-pause-resultat]')].map((e) => ({ id: e.getAttribute('data-lbc-pause-resultat'), etape: e.getAttribute('data-etape'), t: e.innerText })),
  deborde: [...document.querySelectorAll('button,input')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right > document.documentElement.clientWidth + 1; }).map((e) => e.textContent.trim().slice(0, 20) || e.tagName),
  sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
}));
const feuille = (pg) => pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Mettre en pause'); const s = b ? b.closest('div[role="dialog"], form, div') : null; let t = ''; let n = b; for (let i = 0; i < 6 && n; i++) { n = n.parentElement; if (n && n.innerText && n.innerText.length > t.length && n.innerText.length < 900) t = n.innerText; } return { ok: !!b, t }; });
const cliquer = (pg, texte) => pg.evaluate((tx) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === tx); if (b) b.click(); return !!b; }, texte);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px · extension à jour (elle sait mettre en pause)`);
      const { ctx, pg, errs } = await ouvrir(b, vp, { mode: 'ok', suite: 'fait' });
      await pg.waitForSelector('[data-lbc-pause]', { timeout: 10000 }).catch(() => {});
      const v = await lire(pg);
      await pg.screenshot({ path: path.join(require('os').tmpdir(), 'lbc-pause-' + vp.width + '.png'), fullPage: true });
      dit(v.retirer.includes('3290000001'), 'la N°18 vendue sur Vinted, encore en ligne sur Leboncoin ⇒ « à retirer »', JSON.stringify(v.retirer));
      dit(v.boutons.join() === '3290000001', '« Mettre en pause sur Leboncoin » sur CETTE annonce, et elle seule', JSON.stringify(v.boutons));
      dit(v.liens.length >= 1, 'le lien « voir sur Leboncoin » reste à côté');
      dit(!v.retirer.includes('14') && !v.retirer.some((x) => x === '3270000004'), 'la N°14 (annonce « plus vue » dans une liste complète POSTÉRIEURE à la marque « publiée ») n’est plus « à retirer »', JSON.stringify(v.retirer));
      dit(v.sortie.length === 0 && v.doute.length === 0, '… et aucun doute n’est dit quand la preuve est là', JSON.stringify({ sortie: v.sortie, doute: v.doute }));
      dit(v.plusVues === '1' && /Rien n'est effacé/.test(v.plusVuesTxt) && /je ne sais pas laquelle/.test(v.plusVuesTxt), 'la ligne « plus comptée en ligne » le dit, une fois, sans dire vendue ni supprimée', v.plusVuesTxt.slice(0, 160));
      dit(v.pasRevues === '1' && !v.relier.includes('3270000003'), 'l’annonce pas revue depuis 32 jours ne demande pas « quelle paire ? » — comptée dans « pas revues »', JSON.stringify({ pasRevues: v.pasRevues, relier: v.relier }));
      dit(v.relier.includes('3290000005'), '… et l’annonce fraîche non reliée, elle, le demande toujours (l’autre sens)', JSON.stringify(v.relier));
      dit(/profil Leboncoin/.test(v.pasRevuesTxt), 'la ligne « pas revues » dit le geste qui tranche', v.pasRevuesTxt.slice(0, 160));
      // Annuler : rien ne part.
      await pg.click('[data-lbc-pause="3290000001"]').catch(() => {});
      await pg.waitForTimeout(500);
      const f1 = await feuille(pg);
      dit(f1.ok && /Nike shox TL noir/.test(f1.t) && /N°18/.test(f1.t) && /pas une suppression/.test(f1.t), 'la confirmation NOMME l’annonce (titre, N°) et dit que ce n’est pas une suppression', f1.t.replace(/\s+/g, ' ').slice(0, 200));
      await cliquer(pg, 'Annuler');
      await pg.waitForTimeout(600);
      const c0 = await pg.evaluate(() => window.__cmds.filter((x) => /lbcPause/.test(x)));
      dit(c0.length === 0, 'Annuler n’envoie RIEN', JSON.stringify(c0));
      // Confirmer : une commande, l'identifiant seul.
      await pg.click('[data-lbc-pause="3290000001"]').catch(() => {});
      await pg.waitForTimeout(500);
      await cliquer(pg, 'Mettre en pause');
      await pg.waitForSelector('[data-lbc-pause-resultat]', { timeout: 10000 }).catch(() => {});
      await pg.waitForTimeout(500);
      const c1 = await pg.evaluate(() => window.__cmds.filter((x) => /lbcPause/.test(x)));
      dit(c1.length === 1 && c1[0] === JSON.stringify({ cmd: 'lbcPause', id: '3290000001' }), 'Confirmer envoie UNE commande, avec l’identifiant de l’annonce seul', JSON.stringify(c1));
      const v2 = await lire(pg);
      const r = v2.resultats.find((x) => x.id === '3290000001');
      dit(r && r.etape === 'fait' && /200/.test(r.t) && /\{"ok":true\}/.test(r.t), 'la réponse de Leboncoin est écrite telle quelle (statut + texte)', r && r.t);
      dit(v2.deborde.length === 0 && v2.sw <= v2.cw + 1, 'aucun bouton rogné, aucun débordement', v2.deborde.join(', ') + ` ${v2.sw}/${v2.cw}`);
      dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();

      console.log(`── ${vp.width} px · Leboncoin refuse`);
      const o2 = await ouvrir(b, vp, { mode: 'ok', suite: 'refuse' });
      await o2.pg.waitForSelector('[data-lbc-pause]', { timeout: 10000 }).catch(() => {});
      await o2.pg.click('[data-lbc-pause="3290000001"]').catch(() => {});
      await o2.pg.waitForTimeout(500);
      await cliquer(o2.pg, 'Mettre en pause');
      await o2.pg.waitForSelector('[data-lbc-pause-resultat]', { timeout: 10000 }).catch(() => {});
      await o2.pg.waitForTimeout(400);
      const v3 = await lire(o2.pg);
      const r3 = v3.resultats.find((x) => x.id === '3290000001');
      dit(r3 && r3.etape === 'refuse' && /pas fait/.test(r3.t) && /403/.test(r3.t) && /forbidden/.test(r3.t), 'un refus dit « pas fait », avec le statut et le texte de Leboncoin', r3 && r3.t);
      dit(v3.retirer.includes('3290000001'), '… et l’annonce reste « à retirer »');
      await o2.ctx.close();

      console.log(`── ${vp.width} px · extension en retard`);
      const o3 = await ouvrir(b, vp, { mode: 'retard' });
      await o3.pg.waitForTimeout(2500);
      const v4 = await lire(o3.pg);
      dit(v4.boutons.length === 0 && v4.geste.includes('retard'), 'pas de bouton ; une phrase : mets l’extension à jour', JSON.stringify({ b: v4.boutons, g: v4.geste }));
      await o3.ctx.close();

      console.log(`── ${vp.width} px · pas d'extension ici`);
      const o4 = await ouvrir(b, vp, { mode: 'absente' });
      await o4.pg.waitForTimeout(1500);
      const v5 = await lire(o4.pg);
      dit(v5.boutons.length === 0 && v5.liens.length >= 1 && v5.geste.length === 0, 'pas de bouton, pas de promesse ; le lien « voir sur Leboncoin » reste', JSON.stringify({ b: v5.boutons, l: v5.liens.length, g: v5.geste }));
      // Ma journée : la même règle (§11) — la N°14 sortie n'est plus « à retirer ».
      // Les annonces Vinted prouvées vendues y sont lues dans ce que l'écran
      // Annonces publie sur l'appareil (`vinted_annonces_vendues`) : on le pose.
      await o4.pg.evaluate(() => { try { localStorage.setItem('vinted_annonces_vendues', JSON.stringify(['5001', '5003'])); } catch (_) {} });
      await o4.pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
      await o4.pg.waitForFunction(() => /à retirer de Leboncoin/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
      const txt = await o4.pg.evaluate(() => document.body.innerText);
      const m = /(\d+) à retirer de Leboncoin/.exec(txt);
      dit(m && m[1] === '1', 'Ma journée : 1 à retirer de Leboncoin (la N°18) — pas la N°14 dont l’annonce n’est plus vue', m ? m[0] : 'absent');
      await o4.ctx.close();

      // (revue du 22 oct.) SANS PREUVE : la marque « publiée » est postérieure à la
      // dernière liste complète (une republication peut ne pas avoir été vue).
      console.log(`── ${vp.width} px · marque « publiée » après la liste complète (pas de preuve)`);
      const posted = rows.find((x) => x.id === 'vinted_lbc_posted');
      posted.data.updatedAt = auj.toISOString();
      try {
        const o5 = await ouvrir(b, vp, { mode: 'ok', suite: 'fait' });
        await o5.pg.waitForSelector('[data-lbc-retirer-doute]', { timeout: 10000 }).catch(() => {});
        const v6 = await lire(o5.pg);
        dit(v6.retirer.includes('14') && v6.sortie.join() === '14:plusvue', 'la N°14 RESTE « à retirer » (l’annonce reliée n’est plus vue, mais rien ne prouve qu’aucune autre ne l’est)', JSON.stringify({ retirer: v6.retirer, sortie: v6.sortie }));
        dit(v6.doute.length === 1 && v6.doute[0] === '1' && /aucune autre/.test(v6.douteTxt) && /profil Leboncoin/.test(v6.douteTxt), 'le doute et le geste sont dits UNE fois', v6.douteTxt.slice(0, 160));
        dit(v6.retirer.includes('3290000001') && v6.boutons.join() === '3290000001', 'la N°18 (revue active après sa marque) reste « à retirer », avec son bouton', JSON.stringify({ r: v6.retirer, b: v6.boutons }));
        dit(o5.errs.length === 0 && v6.sw <= v6.cw + 1, 'aucune erreur, aucun débordement', o5.errs.join(' | ').slice(0, 120));
        await o5.pg.evaluate(() => { try { localStorage.setItem('vinted_annonces_vendues', JSON.stringify(['5001', '5003'])); } catch (_) {} });
        await o5.pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await o5.pg.waitForFunction(() => /à retirer de Leboncoin/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
        const t6 = await o5.pg.evaluate(() => document.body.innerText);
        const m6 = /(\d+) à retirer de Leboncoin/.exec(t6);
        dit(m6 && m6[1] === '2', 'Ma journée : 2 à retirer de Leboncoin (la N°14 aussi, sans preuve) — la MÊME règle (§11)', m6 ? m6[0] : 'absent');
        await o5.ctx.close();
      } finally { posted.data.updatedAt = ilYa(3); }

      // (29 oct.) LA N°18 RÉELLE : vendue sur Vinted (la transaction le PROUVE),
      // l'annonce Vinted encore OUVERTE dans le dressing (Vinted ne la ferme pas
      // toujours), rien marqué à la main. Avant : rien nulle part (ni l'écran
      // Leboncoin, ni Ma journée). La preuve prime sur l'état de l'annonce.
      console.log(`── ${vp.width} px · vendue prouvée par la transaction, annonce Vinted encore ouverte, rien marqué à la main`);
      const a18 = LISTINGS.payload.items.find((x) => x.id === 5001);
      a18.is_closed = false;
      ECRITS.length = 0;
      try {
        const o6 = await ouvrir(b, vp, { mode: 'ok', suite: 'fait' });
        const v7 = await lire(o6.pg);
        dit(v7.retirer.includes('3290000001'), 'écran Leboncoin : la N°18 « à retirer » même si Vinted la montre encore ouverte', JSON.stringify(v7.retirer));
        await o6.pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await o6.pg.waitForFunction(() => /à retirer de Leboncoin/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
        const t7 = await o6.pg.evaluate(() => document.body.innerText);
        const m7 = /(\d+) à retirer de Leboncoin[^\n]*/.exec(t7);
        dit(m7 && m7[1] === '1' && /N°18/.test(m7[0]), 'Ma journée : « 1 à retirer de Leboncoin — N°18 … » sans aucune marque à la main', m7 ? m7[0] : 'absent');
        await o6.pg.waitForTimeout(800);
        const pub = ECRITS.filter((e) => /"id":"lbc_a_retirer"/.test(e.corps)).map((e) => { try { const d = JSON.parse(e.corps); return (Array.isArray(d) ? d[0] : d).data; } catch (_) { return null; } }).filter(Boolean).pop();
        dit(!!pub && Array.isArray(pub.liste) && pub.liste.length === 1 && pub.liste[0].numero === '18' && pub.liste[0].lbcId === '3290000001', 'le résumé pour le logo VRM sur leboncoin.fr est publié (N°18, son annonce)', JSON.stringify(pub && pub.liste));
        dit(o6.errs.length === 0, 'aucune erreur', o6.errs.join(' | ').slice(0, 120));
        await o6.ctx.close();
      } finally { a18.is_closed = true; }
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ Leboncoin pause / plus vue : ${ko} rouge(s)` : '\n✅ Leboncoin pause / plus vue : tout est vert');
  process.exit(ko ? 1 : 0);
})();
