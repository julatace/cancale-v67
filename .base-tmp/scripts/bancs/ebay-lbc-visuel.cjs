// BANC « eBay et Leboncoin, irréprochables » (6 nov. 2026) — l'écran RENDU.
// Julien (captures iPhone) : « eBay, c'est vraiment pas ouf, les visuels peuvent
// être clairement améliorés ; pareil pour Leboncoin : les annonces qui sont
// captées ne sont plus en ligne ».
// Données INVENTÉES (le dépôt est public). `FX=<fichier>` sert une autre
// fixture { accounts, lignes } (une copie de ses données, HORS du dépôt).
// Ce qu'il juge (attributs et mesures, jamais un libellé seul — §6.4) :
//   eBay → Annonces
//   · une carte fermée est BASSE (≤ 104 px à 390) : photo · titre · N° · prix,
//     une ligne d'état ; au plus UN geste visible en plus de « … » (« Relier »
//     sur une annonce pas reliée, rien sur une reliée) ;
//   · rien d'ambre sur la ligne d'état d'une carte (« pas reliée » dit une fois) ;
//   · la règle d'offre et « Supprimer d'eBay » ne sont PAS sur la liste ; « … »
//     ouvre la fiche qui les porte ;
//   · « À faire » : chaque ligne EST un bouton de 44 px au moins, aucun bouton
//     « Filtrer » ; toucher « à relier » filtre la liste (aria-pressed) ;
//   · UNE entrée pour vendre (`data-poster`), plus d'entrée « Publier une
//     annonce Vinted sur eBay » à côté ;
//   · aucun débordement horizontal ; au doigt, chaque geste fait 44 px.
//   Leboncoin → Annonces
//   · lecture complète de « Mes annonces » vieille de 7 j ⇒ le compteur dit
//     « — » et « N à confirmer » ; chaque annonce « À confirmer », aucune
//     « Active » ;
//   · lecture fraîche (2 h) ⇒ le compteur compte les annonces en ligne, l'annonce
//     marquée « plus vue » n'y est pas, rien « à confirmer ».
// Captures : OUT (défaut : dossier temporaire), une par écran et par taille.
// Lancer : npm run build && BANC_PORT=10710 node scripts/bancs/ebay-lbc-visuel.cjs
//          DIST=<dist d'avant> pour l'arbre d'avant (il doit rougir).
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = process.env.DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10710;
const OUT = process.env.OUT || path.join(os.tmpdir(), 'ebay-lbc-visuel');
const TAILLES = (process.env.TAILLES || '390c,390s,1512c,1512s').split(',');
const ECRANS = (process.env.ECRANS || 'ebay,ebay-fiche,lbc,lbc-frais').split(',');
const SANS_JUGER = process.env.SANS_JUGER === '1';   // la fixture réelle : captures seulement
fs.mkdirSync(OUT, { recursive: true });

// ── Données inventées ───────────────────────────────────────────────────────
const maintenant = new Date(process.env.MAINTENANT || '2026-11-06T15:30:00+01:00');
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const cap = maintenant.toISOString();
const UID = '111';
let nPh = 0;
const ph = (id) => ({ url: `https://images1.vinted.net/t/b${++nPh}/f800/${id}.jpeg?s=x` });
const vente = (id, titre, prix, statut, d, extra = {}) => ({ transaction_id: id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: d.toISOString(), photo: ph(id), ...extra });
const VENTES = [
  vente(7001, 'Adidas Handball Spezial bleu marine gomme taille 42 2/3', 65, 'Le paiement a été validé', il(0, 11), { transaction_user_status: 'needs_action' }),
  vente(7002, 'Nike Air Max 90 blanche taille 41', 72, 'Le paiement a été validé', il(1, 9), { transaction_user_status: 'needs_action' }),
];
const ann = (id, titre, prix, o = {}) => Object.assign({ id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, brand_title: titre.split(' ')[0], size_title: '', status: 'Très bon état', is_closed: false, is_hidden: false, is_draft: false, photo: ph(id), nPhotos: 6, view_count: 40, favourite_count: 3 }, o);
const ITEMS = [ann(9101, 'Autry Reelwind gris taille 37', 84), ann(9102, 'Nike Air Max 1 Travis Scott Cactus Jack Saturn Gold taille 49,5', 145), ann(9103, 'Nike Air Max 1 Athletic Department noir jaune taille 42,5', 68)];
const MAIN = {
  vinted_annonce_numeros: { '9101': { numero: '61', title: ITEMS[0].title }, '9102': { numero: '78', title: ITEMS[1].title }, '9103': { numero: '53', title: ITEMS[2].title } },
  vrm_prenom: 'Julien',
};
const ACCS = [{ id: 1, vinted_user_id: UID, login: 'boutique_demo', domain: 'www.vinted.fr', updated_at: cap }];
const ep = (k) => `https://img.test/e${k}.jpg`;
const photos = (k, n) => Array.from({ length: n }, (_, i) => `https://img.test/e${k * 20 + i}.jpg`);
const EBAY_ANNONCES = [
  { itemId: '120000000081', title: 'Autry Reelwind gris taille 37', price: '84.0', sku: 'VRM-81', currency: 'EUR', photo: ep(1), url: 'https://www.ebay.fr/itm/120000000081', depuis: il(22).toISOString(), detail: { photos: photos(1, 14), condition: 'Occasion - Très bon état', categoryName: 'Homme : chaussures:Baskets', specifics: { Marque: 'Autry', 'Pointure EU': '37' }, description: 'Très bon état, voir photos.' } },
  { itemId: '120000000078', title: 'Nike Air Max 1 Travis Scott Cactus Jack Saturn Gold taille 49,5', price: '145.0', sku: 'VRM-78', currency: 'EUR', photo: ep(2), url: 'https://www.ebay.fr/itm/120000000078', depuis: il(20).toISOString(), detail: { photos: photos(2, 14), condition: 'Occasion - Très bon état', specifics: { Marque: 'Nike' } } },
  { itemId: '120000000048', title: 'Nike Air Max 1 Athletic Department Black Yellow taille 42.5', price: '68.0', sku: 'VRM-48', currency: 'EUR', photo: ep(3), url: 'https://www.ebay.fr/itm/120000000048', depuis: il(22).toISOString(), detail: { photos: photos(3, 15) } },
  { itemId: '120000000059', title: 'Autry Reelwind blanc taille 36', price: '74.0', sku: 'VRM-59', currency: 'EUR', photo: ep(4), url: 'https://www.ebay.fr/itm/120000000059', depuis: il(20).toISOString(), detail: { photos: photos(4, 12) } },
  { itemId: '120000000000', title: 'Nike Air Max 1 Homme blanc bleu EU 44 (US 10/UK 9) FQ8048-133', price: '74.0', sku: '', observateurs: 1, currency: 'EUR', photo: ep(5), url: 'https://www.ebay.fr/itm/120000000000', depuis: il(40).toISOString(), detail: { photos: photos(5, 13) } },
];
const regle = (accepte, refuse, prix) => ({ lu: true, par: 'sync', lueA: il(11).getTime(), prix, devise: 'EUR', refuse, accepte, offresFaites: 0, offresActives: true });
const EBAY_OFFRES = { items: { '120000000081': regle(72, 70, 84), '120000000078': regle(115, 110, 145), '120000000048': regle(65, 62, 68), '120000000059': regle(68, 67, 74), '120000000000': regle(65, 64, 74) }, capturedAt: il(11).getTime() };
// Leboncoin : un compte prouvé (session vue), six annonces au MÊME titre que d'autres (identité = l'identifiant).
const LBC = '8a8a8a8a-1111-4222-8333-444444444444';
const lbcAd = (i, o = {}) => Object.assign({ id: String(3300000000 + i), subject: i % 2 ? 'Nike Air Max 1 blanc taille 42' : 'Autry Reelwind gris taille 37', price: 60 + i, status: 'active', account: LBC, accountName: 'Mon compte LBC', ref: String(40 + i), url: `https://www.leboncoin.fr/ad/chaussures/${3300000000 + i}`, images: [`https://img.test/l${i}.jpg`], seenAt: il(8).toISOString(), platform: 'leboncoin' }, o);
const LBC_ITEMS = Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => [String(3300000000 + i), lbcAd(i)]));
const LBC_ACC = { accounts: { [LBC]: { id: LBC, name: 'Mon compte LBC', type: 'particulier', seenAt: il(8).toISOString(), sessionAt: il(8).toISOString(), platform: 'leboncoin' } } };
const lbcLignes = (frais) => {
  const items = JSON.parse(JSON.stringify(LBC_ITEMS));
  const lectures = {};
  if (frais) {
    const at = new Date(maintenant.getTime() - 2 * 3600e3).toISOString();
    lectures[LBC] = { at, total: 5, n: 5 };
    items['3300000006'].plusVueAt = at;      // absente de la lecture complète (posé par l'extension)
  } else lectures[LBC] = { at: il(7).toISOString(), total: 6, n: 6 };
  return [{ id: 'lbc_listings', data: { items, lectures, updatedAt: cap } }, { id: 'lbc_accounts', data: LBC_ACC }, { id: 'lbc_ventes', data: { ventes: {} } }];
};
const lignesBase = () => [
  { id: 'main', data: MAIN },
  { id: `harvest_${UID}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: `harvest_${UID}_listings`, data: { capturedAt: cap, payload: { items: ITEMS, pagination: { total_entries: ITEMS.length } } } },
  { id: 'ebay_listings', data: { items: EBAY_ANNONCES, capturedAt: maintenant.getTime() - 3600e3, complet: true } },
  { id: 'ebay_offres', data: EBAY_OFFRES },
  { id: 'ebay_orders', data: { orders: [], capturedAt: maintenant.getTime() - 3600e3, complet: true } },
  { id: 'ebay_programmees', data: { items: [], enLigne: EBAY_ANNONCES.map((a) => ({ sku: a.sku, itemId: a.itemId })), complet: true, capturedAt: maintenant.getTime() - 3600e3 } },
];
const FX = process.env.FX ? JSON.parse(fs.readFileSync(process.env.FX, 'utf8')) : null;
const LIGNES = (ecran) => (FX ? FX.lignes : [...lignesBase(), ...lbcLignes(ecran === 'lbc-frais')]);
const COMPTES = FX ? FX.accounts : ACCS;
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3 * 24 * 400, user: { id: '11111111-2222-3333-4444-555555555555', email: 'vendeuse@exemple.test' } };

// ── Serveur et réseau simulé ────────────────────────────────────────────────
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
const teintes = ['#d9d4cc', '#c9ced6', '#e2ddd4', '#cfd6cf', '#d8d0d6', '#d3d8de', '#ddd8cc', '#cdd2d8', '#d6d1c8'];
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="${teintes[k % teintes.length]}"/><path d="M90 500 C120 410 210 395 270 425 C330 455 400 432 460 470 C500 492 492 545 432 548 L130 548 C98 548 84 528 90 500 Z" fill="rgba(30,34,40,.55)"/></svg>`;
const projette = (row, sel) => {
  if (!sel || sel === '*') return { ...row, updated_at: cap };
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'owner') { out[alias] = SESSION.user.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg.replace(/^"|"$/g, '')];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v === 'object' ? JSON.stringify(v) : (/->>/.test(src) ? String(v) : v));
  }
  return out;
};

const ouvrir = async (b, taille, url, ecran) => {
  const tel = taille.startsWith('390'), sombre = taille.endsWith('s');
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(([d, s]) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_prenom', JSON.stringify('Julien')); localStorage.setItem('vinted_dark', JSON.stringify(d)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); localStorage.setItem('vrm_bascule_mineral_v1', '1'); } catch (_) {} }, [sombre, SESSION]);
  await pg.route(/^https?:\/\/[^/]*(vinted\.net|img\.test|ebayimg\.com|leboncoin\.fr\/api\/v1\/lbcpb)/i, (r) => { const u = r.request().url(); const m = /\/b(\d+)\/|\/[el](\d+)\.jpg/.exec(u); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1] || m[2]) : u.length) }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net|img\.test|[^/]*ebayimg\.com|img\.leboncoin\.fr)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user, ...SESSION.user }) }));
  const L = LIGNES(ecran);
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, (d.length || 1) - 1)}/${d.length || 0}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([], 201);
    if (/select=owner\b/.test(u) && !/id=in\./.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(COMPTES);
    if (!/\/rest\/v1\/app_data/.test(u)) return j([]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(L.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(L.filter((r) => ids.includes(r.id)).map((r) => projette(r, sel))); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(L.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    const j = (d, st) => r.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (/\/api\/ebay/.test(u)) {
      if (r.request().method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
      let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (_) {}
      if (body.action === 'status') return j({ ok: true, connected: true });
      if (body.action === 'offreinfo') return j({ ok: true, eligibles: [], complet: true });
      return j({ ok: true });
    }
    return j({ pret: true });
  });
  await pg.goto(`http://localhost:${PORT}/${url}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('.vrm-main') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(2500);
  return { ctx, pg, errs, tel };
};

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (SANS_JUGER) return; if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300) : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le bloc a levé', String(e.message || e).split('\n')[0]); } };
// L'écran défile DANS la coque (pas la page) : pour tout voir, la fenêtre est
// agrandie à la hauteur du contenu le temps de la capture, puis rendue.
const capture = async (pg, nom, plein = true) => {
  const vp = pg.viewportSize();
  if (plein) {
    const h = await pg.evaluate(() => Math.max(...[...document.querySelectorAll('.vrm-main, .vrm-main *')].filter((e) => e.scrollHeight > e.clientHeight + 40 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)).map((e) => e.scrollHeight + (window.innerHeight - e.clientHeight)), document.documentElement.scrollHeight));
    await pg.setViewportSize({ width: vp.width, height: Math.min(7000, Math.max(vp.height, h)) });
    await pg.waitForTimeout(400);
  }
  await pg.screenshot({ path: path.join(OUT, nom + '.png'), fullPage: plein });
  if (plein) { await pg.setViewportSize(vp); await pg.waitForTimeout(200); }
};

(async () => {
  let b;
  try {
    await new Promise((res) => srv.listen(PORT, res));
    b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const taille of TAILLES) {
      const T = '[' + taille + ']';
      if (ECRANS.includes('ebay') || ECRANS.includes('ebay-fiche')) await essaie(T + ' eBay', async () => {
        const { ctx, pg, errs, tel } = await ouvrir(b, taille, '?tab=annonces&site=ebay', 'ebay');
        await pg.waitForSelector('[data-tache="annonces"][data-tache-site="ebay"]', { timeout: 15000 }).catch(() => {});
        await pg.waitForSelector('[data-ebay-annonce]', { timeout: 20000 });
        await pg.waitForTimeout(2500);
        await capture(pg, `ebay-annonces-${taille}`);
        if (await pg.locator('[data-ebay-sans-preuve-voir]').count()) { await pg.locator('[data-ebay-sans-preuve-voir]').first().click({ timeout: 3000 }).catch(() => {}); await pg.waitForSelector('[data-ebay-sans-preuve-vente]', { timeout: 4000 }).catch(() => {}); } // (9 nov.) la liste vit dans une feuille
        const m = await pg.evaluate(() => {
          const cartes = [...document.querySelectorAll('[data-ebay-annonce]')];
          const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
          const warnRgb = (() => { const s = document.createElement('span'); s.style.color = 'var(--vrm-warn, #B25000)'; document.body.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; })();
          return {
            hauteurs: cartes.map((c) => Math.round(c.getBoundingClientRect().height)),
            gestes: cartes.map((c) => ({ id: c.getAttribute('data-ebay-annonce'), relie: (c.querySelector('[data-relie]') || { getAttribute: () => null }).getAttribute('data-relie'), n: [...c.querySelectorAll('button, a[href]')].filter((x) => vis(x) && !x.hasAttribute('data-ebay-carte-ouvrir') && !x.hasAttribute('data-ebay-carte-plus')).map((x) => x.innerText.trim() || x.getAttribute('aria-label')) })),
            ambreMeta: cartes.flatMap((c) => [...c.querySelectorAll('[data-relie] *, [data-relie]')].filter((x) => getComputedStyle(x).color === warnRgb).map((x) => x.textContent.trim())).slice(0, 5),
            regleListe: document.querySelectorAll('[data-regle-offre-ligne]').length,
            supprListe: document.querySelectorAll('[data-ebay-supprimer]').length,
            conseils: [...document.querySelectorAll('[data-ebay-conseil]')].map((e) => ({ k: e.getAttribute('data-ebay-conseil'), tag: e.tagName, h: Math.round(e.getBoundingClientRect().height) })),
            filtrerBoutons: [...document.querySelectorAll('[data-ebay-conseils] button')].filter((x) => /^(Filtrer|Voir)$/.test(x.innerText.trim())).length,
            poster: document.querySelectorAll('[data-poster="ebay"]').length,
            entreeVinted: document.querySelectorAll('[data-pa-entree="ebay"]').length,
            petits: cartes.flatMap((c) => [...c.querySelectorAll('button')].filter((x) => vis(x) && x.getBoundingClientRect().height < 43.5).map((x) => (x.innerText.trim() || x.getAttribute('aria-label')) + ':' + Math.round(x.getBoundingClientRect().height))),
            deborde: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            sansPreuveLiens: [...document.querySelectorAll('[data-ebay-sans-preuve-vente] a[href]')].map((a) => a.innerText.trim()),
          };
        });
        if (await pg.locator('[data-ebay-sans-preuve-vente]').count()) { await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForSelector('[data-ebay-sans-preuve-vente]', { state: 'detached', timeout: 3000 }).catch(() => {}); }
        const maxH = tel ? 104 : 96;
        dit(m.hauteurs.length >= 1 && m.hauteurs.every((h) => h <= maxH), `${T} chaque carte fermée est basse (≤ ${maxH} px) : photo · titre · N° · prix · une ligne`, m.hauteurs);
        dit(m.gestes.every((g) => g.n.length <= (g.relie ? 0 : 1)), `${T} une carte : « Relier » seul quand le lien manque, aucun geste en plus sur une reliée (le reste est dans « … »)`, m.gestes);
        dit(m.ambreMeta.length === 0, `${T} rien d'ambre sur la ligne d'une carte (« pas reliée » est dit une fois, pas par carte)`, m.ambreMeta);
        dit(m.regleListe === 0 && m.supprListe === 0, `${T} la règle d'offre et « Supprimer d'eBay » ne sont pas sur la liste`, { regle: m.regleListe, suppr: m.supprListe });
        dit(m.conseils.length >= 1 && m.conseils.every((c) => c.tag === 'BUTTON' && c.h >= 44) && m.filtrerBoutons === 0, `${T} « À faire » : chaque ligne est un geste (≥ 44 px), aucun bouton « Filtrer »/« Voir »`, m.conseils);
        dit(m.poster === 1 && m.entreeVinted === 0, `${T} UNE entrée pour vendre sur eBay`, { poster: m.poster, entree: m.entreeVinted });
        dit(m.deborde <= 1, `${T} aucun débordement horizontal`, m.deborde);
        if (tel) dit(m.petits.length === 0, `${T} au doigt, chaque geste d'une carte fait 44 px`, m.petits);
        if (m.sansPreuveLiens.length) dit(m.sansPreuveLiens.every((t) => /^Ouvrir sur Vinted/.test(t)), `${T} « Ouvrir sur Vinted » (majuscule) sur chaque vente pas reliée`, m.sansPreuveLiens);
        // « À relier » : toucher la ligne filtre la liste.
        const relier = pg.locator('[data-ebay-conseil="relier"]');
        if (await relier.count()) {
          await relier.first().click();
          await pg.waitForTimeout(500);
          const f = await pg.evaluate(() => ({ p: (document.querySelector('[data-ebay-conseil="relier"]') || { getAttribute: () => null }).getAttribute('aria-pressed'), n: document.querySelectorAll('[data-ebay-annonce]').length, filtre: (document.querySelector('[data-ebay-filtre][aria-pressed="true"]') || { getAttribute: () => '' }).getAttribute('data-ebay-filtre') }));
          dit(f.p === 'true' && f.filtre === 'relier', `${T} toucher « à relier » filtre la liste (la ligne le montre)`, f);
          await relier.first().click(); await pg.waitForTimeout(400);
        }
        if (ECRANS.includes('ebay-fiche')) {
          await pg.locator('[data-ebay-carte-plus]').first().click();
          await pg.waitForTimeout(700);
          const f = await pg.evaluate(() => { const c = document.querySelector('[data-ebay-annonce]'); return { regle: !!c.querySelector('[data-regle-offre-ligne]'), suppr: !!c.querySelector('[data-ebay-supprimer]'), modifier: !!c.querySelector('[data-ebay-revise-ouvrir]'), deborde: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
          dit(f.regle && f.suppr && f.modifier, `${T} « … » ouvre la fiche : règle d'offre, Modifier, Supprimer d'eBay`, f);
          dit(f.deborde <= 1, `${T} fiche ouverte : aucun débordement`, f.deborde);
          const el = await pg.$('[data-ebay-annonce]');
          if (el) await el.scrollIntoViewIfNeeded();
          await capture(pg, `ebay-fiche-${taille}`, false);
        }
        dit(errs.length === 0, `${T} eBay : aucune erreur de page`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
      for (const ecran of ['lbc', 'lbc-frais']) {
        if (!ECRANS.includes(ecran) || (FX && ecran === 'lbc-frais')) continue;
        await essaie(`${T} ${ecran}`, async () => {
          const { ctx, pg, errs } = await ouvrir(b, taille, '?tab=leboncoin', ecran);
          await pg.waitForSelector('[data-lbc-catalog-id]', { timeout: 20000 }).catch(() => {});
          await pg.waitForTimeout(1500);
          await capture(pg, `${ecran}-${taille}`);
          const m = await pg.evaluate(() => ({
            enLigne: (document.querySelector('[data-lbc-en-ligne]') || { getAttribute: () => null }).getAttribute('data-lbc-en-ligne'),
            aConf: (document.querySelector('[data-lbc-a-confirmer]') || { getAttribute: () => null }).getAttribute('data-lbc-a-confirmer'),
            etats: [...document.querySelectorAll('[data-lbc-catalog-id]')].map((e) => e.getAttribute('data-lbc-catalog-etat')),
            deborde: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          }));
          if (!FX) {
            if (ecran === 'lbc') {
              dit(m.aConf === '6' && m.enLigne === '', `${T} lecture complète de 7 j : « — » en ligne, « 6 à confirmer »`, m);
              dit(m.etats.length === 6 && m.etats.every((e) => e === 'aconfirmer'), `${T} lecture de 7 j : chaque annonce « À confirmer », aucune « Active »`, m.etats);
            } else {
              dit(m.enLigne === '5' && m.aConf === null, `${T} lecture fraîche : 5 en ligne, rien à confirmer`, m);
              dit(m.etats.filter((e) => e === 'active').length === 5 && m.etats.filter((e) => e === 'plusvue').length === 1, `${T} lecture fraîche : l'annonce absente de la liste complète n'est plus « Active »`, m.etats);
            }
          }
          dit(m.deborde <= 1, `${T} ${ecran} : aucun débordement horizontal`, m.deborde);
          dit(errs.length === 0, `${T} ${ecran} : aucune erreur de page`, errs.join(' | ').slice(0, 200));
          await ctx.close();
        });
      }
    }
  } catch (e) { console.log('❌ banc : ' + (e && e.message)); ko++; }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\nCaptures : ${OUT}\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
