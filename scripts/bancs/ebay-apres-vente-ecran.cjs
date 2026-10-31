// Banc : eBAY APRÈS LA VENTE, À L'ÉCRAN (17 octobre) — données INVENTÉES.
// Retours et annulations (eBay → À traiter), Promotion, Achats. Il rend l'onglet
// eBay à 390 et 1512 px, juge les `data-*` posés par l'écran et ce qui PART vers
// `/api/ebay` :
//   · une demande d'annulation et un retour s'affichent, avec leurs gestes ;
//   · « Annuler » dans la confirmation n'envoie RIEN ; « Accepter » envoie la
//     décision avec `confirme:true`, et la confirmation dit l'argent ;
//   · refuser un retour sans motif n'envoie rien ;
//   · rembourser envoie le montant VU (le serveur le revérifie) ;
//   · lecture refusée (droit manquant) ⇒ la raison est dite, jamais « aucune » ;
//   · promotion : promue / pas promue, taux, frais dits ; achats en lecture ;
//   · aucun débordement, aucune erreur de page.
//        BANC_PORT=6801 node scripts/bancs/ebay-apres-vente-ecran.cjs
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 6801;
const auj = new Date();
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const rows = [
  { id: 'main', data: {} },
  { id: 'ebay_comptes', data: { comptes: [{ cle: 'aaaaaaaaaaaaaaa1', pseudo: 'paire_perso', principal: true }] } },
  { id: 'ebay_listings', data: { items: [{ itemId: '3001', title: 'Salomon XT-6 noir taille 43', price: '120.0' }, { itemId: '3002', title: 'Nike Dunk Low panda taille 42', price: '95.0' }], capturedAt: Date.now() } },
  { id: 'ebay_orders', data: { orders: [], capturedAt: Date.now() } },
];
const RETOUR = { returnId: '5000123', orderId: '12-11111-22222', acheteur: 'acheteur_a', etat: 'RETURN_REQUESTED', itemId: '3001', titre: 'Salomon XT-6 noir taille 43', motif: 'DOES_NOT_FIT', commentaire: 'Trop petit', remboursementPrevu: { value: '80.00', currency: 'EUR' }, rembourse: null };
const RETOUR_RECU = { ...RETOUR, returnId: '5000999', etat: 'ITEM_DELIVERED', titre: 'Asics Gel 1130 argent', commentaire: '' };
const ANNUL = { cancelId: '7000456', orderId: '12-33333-44444', acheteur: 'acheteur_b', etat: 'CANCEL_REQUESTED', montant: { value: '55.00', currency: 'EUR' }, date: '2026-10-16T09:00:00.000Z' };
let envois = [], mode = 'normal', ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 160)); return null; } };
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
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
async function ouvrir(b, vp) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString() });
    const eq = /id=eq\.([^&]*)/.exec(u); if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.route('**/api/ebay**', (route) => {
    const req = route.request();
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (req.method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    const a = body.action;
    if (['deciderretour', 'rembourserretour', 'decannulation', 'promouvoir', 'changertaux', 'arreterpromo'].includes(a)) { envois.push(body); return j(a === 'decannulation' ? { ok: true, decision: body.decision, orderId: ANNUL.orderId, commandeRangee: true } : { ok: true }); }
    if (a === 'status') return j({ ok: true, connected: true, comptes: [{ cle: 'aaaaaaaaaaaaaaa1', pseudo: 'paire_perso', principal: true, relie: true }] });
    if (a === 'retours') return mode === 'scope' ? j({ ok: false, reason: 'scope', error: 'eBay n’a pas autorisé VRM à lire tes demandes de retour. Reconnecte ton compte eBay (Compte → Connecter) pour donner ce droit.' }) : j({ ok: true, retours: [RETOUR, RETOUR_RECU] });
    if (a === 'annulations') return mode === 'scope' ? j({ ok: false, reason: 'pas-su', error: 'eBay n’a pas rendu tes demandes d’annulation.' }, 502) : j({ ok: true, annulations: [ANNUL] });
    if (a === 'promotion') return j({ ok: true, campagnes: [{ id: 'C1', nom: 'VRM', taux: 5 }], promues: [{ listingId: '3001', taux: 5, campagne: 'C1' }], annonces: [{ itemId: '3001', titre: 'Salomon XT-6 noir taille 43' }, { itemId: '3002', titre: 'Nike Dunk Low panda taille 42' }] });
    if (a === 'achats') return j({ ok: true, achats: [{ itemId: '4001', titre: 'Achat test Converse', vendeur: 'vendeur_x', prix: '42.00', devise: 'EUR', date: '2026-10-01T10:00:00.000Z', expedieLe: '2026-10-02T10:00:00.000Z', suivi: { numero: 'LA123456789FR', transporteur: 'Colissimo' } }, { itemId: '4002', titre: 'Achat pas payé', vendeur: 'vendeur_y', prix: '10.00', devise: 'EUR', statut: 'Incomplete' }] });
    if (a === 'agent') return j({ ok: true, tasks: [], sources: [], journal: [], journalLisible: true });
    if (a === 'evaluations') return j({ ok: true, evaluations: [] });
    if (a === 'offreinfo') return j({ ok: true, eligibles: [], complet: true });
    return j({ ok: true });
  });
  return { ctx, pg, errs };
}
const feuille = (pg) => pg.locator('div[style*="z-index: 2000"]');
const sousOnglet = async (pg, nom) => { await pg.getByRole('button', { name: nom, exact: true }).first().click({ timeout: 8000 }); await pg.waitForTimeout(900); };
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      envois = []; mode = 'normal';
      const { ctx, pg, errs } = await ouvrir(b, vp);
      await essaie('À traiter : retours et annulations', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' });
        await sousOnglet(pg, 'À traiter');
        await pg.waitForSelector('[data-ebay-annulation="7000456"]', { timeout: 12000 });
        const etat = await pg.$eval('[data-ebay-retours]', (e) => [e.getAttribute('data-ebay-retours'), e.getAttribute('data-ebay-annulations')]);
        dit(etat[0] === '2' && etat[1] === '1', 'les demandes s’affichent : 2 retours ouverts, 1 annulation à décider', JSON.stringify(etat));
        if (process.env.SHOT) await pg.screenshot({ path: path.join(process.env.SHOT, 'traiter-' + vp.width + '.png'), fullPage: true });
        const ret = await pg.$eval('[data-ebay-retour="5000123"]', (e) => e.innerText);
        dit(/acheteur_a/.test(ret) && /80,00\s*€/.test(ret) && /taille/.test(ret), 'le retour nomme l’acheteur, le motif et le montant à rembourser', ret.replace(/\s+/g, ' ').slice(0, 160));
        // Annuler dans la confirmation : rien ne part.
        await pg.click('[data-ebay-annulation="7000456"] [data-geste="annulation-accepter"]');
        await feuille(pg).getByRole('button', { name: 'Accepter l’annulation' }).waitFor({ timeout: 5000 });
        const txt = await feuille(pg).innerText();
        dit(/rembourse/i.test(txt) && /55,00\s*€/.test(txt) && /n’expédie pas/.test(txt), 'la confirmation dit l’argent (remboursement 55 €) et le geste (ne pas expédier)', txt.replace(/\s+/g, ' ').slice(0, 200));
        await feuille(pg).getByRole('button', { name: 'Annuler' }).click(); await pg.waitForTimeout(400);
        dit(envois.length === 0, '« Annuler » dans la confirmation : rien n’est envoyé à eBay');
        await pg.click('[data-ebay-annulation="7000456"] [data-geste="annulation-accepter"]');
        await feuille(pg).getByRole('button', { name: 'Accepter l’annulation' }).click({ timeout: 5000 }); await pg.waitForTimeout(700);
        const e1 = envois[0] || {};
        dit(e1.action === 'decannulation' && e1.decision === 'accepter' && e1.cancelId === '7000456' && e1.confirme === true && e1.orderId === ANNUL.orderId, 'accepter : la décision part une fois, confirmée, avec la commande vue', JSON.stringify(e1));
        dit(/confirmé par eBay/.test(await pg.$eval('[data-ebay-annulation="7000456"]', (e) => e.innerText)), 'la ligne dit « fait, confirmé par eBay »');
        // Refuser un retour sans motif : rien ne part.
        const avant = envois.length;
        await pg.click('[data-ebay-retour="5000123"] [data-geste="retour-refuser"]'); await pg.waitForTimeout(400);
        dit(envois.length === avant && (await feuille(pg).count()) === 0, 'refuser un retour sans motif : aucune confirmation, rien n’est envoyé');
        // Retour reçu : rembourser le montant vu.
        await pg.click('[data-ebay-retour="5000999"] [data-geste="retour-rembourser"]');
        const fb = feuille(pg); await fb.getByRole('button', { name: /^Rembourser 80,00/ }).waitFor({ timeout: 5000 });
        dit(/ne se reprend pas/.test(await fb.innerText()), 'la confirmation du remboursement dit qu’il ne se reprend pas');
        await fb.getByRole('button', { name: /^Rembourser 80,00/ }).click(); await pg.waitForTimeout(700);
        const e2 = envois[envois.length - 1] || {};
        dit(e2.action === 'rembourserretour' && e2.montantVu === '80.00' && e2.devise === 'EUR' && e2.confirme === true, 'rembourser : le montant VU part (le serveur le revérifie chez eBay)', JSON.stringify(e2));
      });
      await essaie('Promotion', async () => {
        await sousOnglet(pg, 'Promotion');
        await pg.waitForSelector('[data-ebay-promo="3002"]', { timeout: 10000 });
        const p = await pg.$$eval('[data-ebay-promo]', (l) => l.map((e) => [e.getAttribute('data-ebay-promo'), e.getAttribute('data-promue')]));
        dit(JSON.stringify(p) === JSON.stringify([['3001', 'oui'], ['3002', 'non']]), 'promue / pas promue, annonce par annonce', JSON.stringify(p));
        dit(/UNIQUEMENT si la paire se vend/.test(await pg.$eval('[data-ebay-promotion]', (e) => e.innerText)), 'les frais de promotion sont dits');
        const avant = envois.length;
        await pg.click('[data-ebay-promo="3002"] [data-geste="promouvoir"]');
        await feuille(pg).getByRole('button', { name: 'Promouvoir' }).click({ timeout: 5000 }); await pg.waitForTimeout(700);
        const e3 = envois[avant] || {};
        dit(e3.action === 'promouvoir' && e3.listingId === '3002' && e3.taux === '5' && e3.confirme === true, 'promouvoir : l’annonce choisie, au taux affiché, sur confirmation', JSON.stringify(e3));
      });
      await essaie('Achats', async () => {
        await sousOnglet(pg, 'Achats');
        // (29 octobre) Les achats GAGNÉS sont repliés sous la recherche eBay :
        // on les ouvre comme lui (ils ne sont lus qu'à l'ouverture).
        await pg.click('[data-ebay-achats-gagnes] > summary', { timeout: 8000 });
        await pg.waitForSelector('[data-ebay-achat="4001"]', { timeout: 10000 });
        dit(/42,00\s*€/.test(await pg.$eval('[data-ebay-achat="4001"]', (e) => e.innerText)), 'achats eBay listés, avec leur prix');
        dit(await pg.$eval('[data-ebay-achat="4001"]', (e) => e.classList.contains('vrm-buy-row')), 'un achat eBay a la même ligne qu’un achat Vinted (vrm-buy-row)');
        dit(await pg.$eval('[data-ebay-achat="4001"]', (e) => (e.querySelector('[data-ebay-achat-etape]')||{}).dataset?.ebayAchatEtape === 'Expédié' && /LA123456789FR/.test(e.innerText)), 'achat expédié : l’étape et le suivi sont dits');
        dit(await pg.$eval('[data-ebay-achat="4002"]', (e) => (e.querySelector('[data-ebay-achat-etape]')||{}).dataset?.ebayAchatEtape === 'À payer' && !/Reçu/.test(e.innerText)), 'achat pas payé : « À payer », jamais « Reçu »');
      });
      dit((await deborde(pg)) <= 1, 'aucun débordement horizontal');
      // Droit refusé : la raison est dite, jamais « aucune demande ».
      await essaie('lecture refusée', async () => {
        mode = 'scope';
        await sousOnglet(pg, 'À traiter');
        await pg.waitForSelector('[data-pas-su="retours"]', { timeout: 10000 });
        const t = await pg.$eval('[data-ebay-retours]', (e) => e.innerText);
        dit(/Reconnecte/.test(t) && !/Aucune demande/.test(t), 'droit refusé ⇒ « reconnecte », jamais « aucune demande »', t.replace(/\s+/g, ' ').slice(0, 200));
      });
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ eBay après la vente : ${ko} rouge(s)` : '\n✅ eBay après la vente : retours, annulations, promotion et achats, chaque geste confirmé');
  process.exit(ko ? 1 : 0);
})();
