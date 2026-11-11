// Banc : FACTURES PRO, LOT S (10 nov.) — la facture d'une vente LEBONCOIN, dans le détail de la vente.
// Vendeur Pro (SIRET valide dans « Ma facture ») : « Faire la facture » → la feuille : l'acheteur à
// recopier (Leboncoin ne le donne pas), le prix et la date de la vente lus, l'aperçu exact, « Émettre »
// confirmé ; le navigateur n'envoie jamais de prix ni de date (le serveur relit la vente).
// Vente annulée ⇒ la raison, aucun bouton ; côté pas su ⇒ rien ; vendeur sans SIRET ⇒ rien.
// Données INVENTÉES (dépôt public). 390 tactile et 1512, clair ET sombre ; 44 px, aucun débordement.
// Lancer : npm run build && BANC_PORT=$((20000+RANDOM%20000)) node scripts/bancs/factures-autres.cjs
// Captures : SHOTS=<dossier> …   Un seul format : SEUL="390 clair"
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 11653);
const SHOTS = process.env.SHOTS || '';
const SEUL = process.env.SEUL || '';

const maintenant = new Date(2026, 10, 10, 15, 30, 0);
const cap = maintenant.toISOString();
const luhn = (s) => { let t = 0; for (let i = 0; i < s.length; i++) { let n = +s[s.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; } return t % 10 === 0; };
const SIREN = ['900123450', '900123451', '900123452', '900123453', '900123454', '900123455', '900123456', '900123457', '900123458', '900123459'].find(luhn);
const SIRET = (() => { for (let k = 0; k < 100000; k++) { const s = SIREN + String(k).padStart(5, '0'); if (luhn(s)) return s; } })();
const CFG = { nom: 'Boutique Banc', forme: 'EI', siret: SIRET, adresse: '1 rue du Banc', codePostal: '35000', ville: 'Rennes', tva_regime: 'franchise', prefixe: 'FA', couleur: '#0071e3', email: 'boutique@banc.test', comptesFacture: { 'leboncoin:compte_banc': true, 'ebay:principal': true } };
const lbc = (tx, x = {}) => ({ txId: String(tx), title: `Nike Dunk banc ${tx}`, price: 2500, prixListe: 2928, dateVente: '2026-11-03T10:12:00.000Z', account: 'compte_banc', accountName: 'Compte Banc', isSeller: true, stepStatus: 'done', stepLabel: 'Terminé', at: cap, ...x });
const VENTES = { 123456789: lbc(123456789), 223456789: lbc(223456789, { stepStatus: 'cancelled', stepLabel: '', dateVente: '2026-11-02T10:00:00.000Z' }) };
const vcV = (id, x = {}) => ({ productId: id, date: '2026-11-02T10:00:00.000Z', etat: 'sold', titre: `Sac banc ${id}`, montant: { valeur: 203.23, devise: 'EUR', cle: 'sellerEarning' }, sources: ['ventes'], vuAt: cap, ...x });
const VC_VENTES = { 72987283: vcV('72987283', { prixVente: { valeur: 250, devise: 'EUR', cle: 'sellerPrice' } }), 72987284: vcV('72987284', { date: '2026-11-01T10:00:00.000Z' }) };
let cfg = CFG;
let emis = {};
let requetesApi = [];
const lignes = () => [
  { id: 'lbc_ventes', data: { ventes: VENTES, updatedAt: cap } },
  { id: 'vrm_pro_facture', data: cfg },
  // (11 nov., extension 5.340) Vestiaire : une vente AVEC le prix de vente lu (`sellerPrice`), une sans.
  { id: 'vc_ventes', data: { ventes: VC_VENTES, lectures: { ventes: { at: cap, total: 2, complet: true } }, capturedAt: cap } },
  { id: 'vc_listings', data: { liens: {} } },
  ...Object.entries(emis).map(([id, d]) => ({ id, data: d })),
];
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
let pgCourante = null; const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); if (SHOTS && pgCourante) await pgCourante.screenshot({ path: path.join(SHOTS, 'fa-echec-' + nom.replace(/\W+/g, '-') + '-' + Date.now() + '.png') }).catch(() => {}); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const ouvrir = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && /Facture/i.test(m.text())) errs.push(m.text()); });
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(([s]) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', '1'); } catch (_) {} }, [!!sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j([]);
    const L = lignes();
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(L.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(L.filter((r) => r.id === eq[1]).map(forme));
    const ou = /[?&]or=\(([^)]*)\)/.exec(u);
    if (ou) { const res = ou[1].split(',').map((x) => new RegExp('^' + x.replace(/^id\.like\./, '').replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$')); return j(L.filter((r) => res.some((re) => re.test(r.id))).map(forme)); }
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(L.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/compte?mode=facture-autre', async (r) => {
    const corps = JSON.parse(r.request().postData() || '{}'); requetesApi.push(corps);
    const R = await import(path.join(__dirname, '..', '..', 'src', 'facturePro', 'regle.js'));
    const S = await import(path.join(__dirname, '..', '..', 'src', 'facturePro', 'sources.js'));
    const v = S.venteLbc(VENTES[corps.ref]);
    const c = R.contenuFacture(cfg, S.venteFacture(v, corps.acheteur, corps.designation), { numero: 'FA-2026-0006', emiseLe: maintenant.getTime() });
    const id = S.idFactureAutre('leboncoin', corps.ref);
    emis[id] = { type: 'facture_pro', plateforme: 'leboncoin', reference: corps.ref, number: 'FA-2026-0006', emiseLe: c.emiseLe, contenu: c };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, facture: { id, numero: 'FA-2026-0006', emiseLe: c.emiseLe, contenu: c } }) });
  });
  await pg.route(/\/api\/(?!compte\?mode=facture-autre)/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=ventes&site=leboncoin`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};
const mesurer = (pg, sel) => pg.evaluate((sel) => {
  const d = document.querySelector(sel); if (!d) return null;
  const vw = window.innerWidth;
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const petites = [...d.querySelectorAll('button, input, textarea')].filter(vis).map((e) => [e, e.getBoundingClientRect()]).filter(([, r]) => r.height < 43.5).map(([e, r]) => `${Math.round(r.height)}px « ${(e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 24)} »`);
  const hors = [...d.querySelectorAll('*')].filter((e) => vis(e) && !e.closest('svg') && !e.closest('.vrm-fp-apercu') && e.getBoundingClientRect().right > vw + 1).map((e) => String(e.className || e.tagName).slice(0, 30));
  return { petites, hors: hors.slice(0, 5), deb: Math.max(document.documentElement.scrollWidth - vw, 0) };
}, sel);
const deplier = async (pg, tx) => {
  await pg.locator(`[data-lbc-vente="${tx}"]`).first().waitFor({ timeout: 30000 });
  // Le détail s’ouvre en feuille : un clic pendant la fermeture de la précédente peut se perdre — on réessaie (au plus 4 fois) tant que le détail de CETTE vente n’est pas visible.
  const ouvert = pg.locator(".vrm-ledger-drawer-host:not([hidden]) .vrm-ledger-drawer-head button");
  if (await ouvert.count()) { await ouvert.first().click().catch(() => {}); await pg.waitForTimeout(600); }
  for (let i = 0; i < 4; i++) {
    await pg.locator(`[data-lbc-vente="${tx}"] .vrm-ledger-sale-toggle`).first().click();
    const vu = await pg.locator(".vrm-ledger-drawer-host:not([hidden]) .vrm-ledger-drawer-head h2", { hasText: tx }).first().waitFor({ timeout: 3000 }).then(() => true, () => false);
    if (vu) return;
  }
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    const combos = [[{ width: 390, height: 844 }, false, '390 clair'], [{ width: 1512, height: 982 }, true, '1512 sombre'], [{ width: 390, height: 844 }, true, '390 sombre'], [{ width: 1512, height: 982 }, false, '1512 clair']].filter((c) => !SEUL || c[2] === SEUL);
    for (const [vp, sombre, nom] of combos) {
      console.log(`\n— ${nom}`);
      requetesApi = []; emis = {}; cfg = CFG;
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre); pgCourante = pg;
      const tel = vp.width < 600; const nf = nom.replace(/\s+/g, '-');
      await essaie('Vente Leboncoin', async () => {
        await deplier(pg, '123456789');
        const faire = pg.locator('[data-fa-ref="123456789"] [data-fa-faire]');
        await faire.waitFor({ timeout: 15000 });
        dit(true, '1. vendeur Pro : « Faire la facture » dans le détail de la vente Leboncoin');
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `fa-ligne-${nf}.png`) });
        await faire.click();
        const f = pg.locator('[data-fa-feuille="123456789"]');
        await f.waitFor({ timeout: 20000 });
        dit(await f.locator('[data-fa-prix="2500"]').count() === 1 && await f.locator('[data-fa-source="saisi"]').count() === 1, '2. la feuille : prix de la vente lu (25,00 €, pas prixListe), acheteur à recopier');
        dit(await f.locator('[data-fa-emettre]').isDisabled(), '2. sans acheteur : « Émettre » fermé, le manque dit');
        await f.locator('[data-fa-acheteur] input').fill('Lucie Banc');
        await f.locator('[data-fa-acheteur] textarea').fill('5 avenue Imaginaire\n13001 Marseille');
        await f.locator('[data-fp-apercu]').waitFor({ timeout: 20000 });
        const ap = (await f.locator('[data-fp-apercu]').innerText()).replace(/\s+/g, ' ');
        dit(/Leboncoin n° 123456789/.test(ap) && /Lucie Banc/.test(ap) && /25,00/.test(ap) && /03\/11\/2026/.test(ap), '3. l’aperçu exact : référence Leboncoin, acheteur recopié, prix et date de la vente', ap.slice(0, 160));
        const m = await mesurer(pg, '[data-fa-feuille="123456789"]');
        dit(m.deb <= 1 && !m.hors.length, '6. feuille : aucun débordement', `${m.deb}px ${m.hors.join(' | ')}`);
        if (tel) dit(!m.petites.length, '6. feuille : cibles de 44 px', m.petites.join(' | '));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `fa-feuille-${nf}.png`) });
        await f.locator('[data-fa-emettre]').click();
        await pg.getByRole('button', { name: 'Émettre', exact: true }).last().waitFor({ timeout: 10000 });
        dit(requetesApi.length === 0, '4. confirmation AVANT tout appel');
        await pg.getByRole('button', { name: 'Émettre', exact: true }).last().click();
        await pg.locator('[data-fa-emise="FA-2026-0006"]').waitFor({ timeout: 20000 });
        const c = requetesApi[0] || {};
        dit(c.plateforme === 'leboncoin' && c.ref === '123456789' && !('centimes' in c) && !('prix' in c) && !('venteLe' in c), '4. le navigateur n’envoie ni prix ni date (le serveur relit la vente)', JSON.stringify(c).slice(0, 160));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `fa-emise-${nf}.png`) });
        await pg.keyboard.press('Escape').catch(() => {});
        await pg.locator('[data-fa-feuille]').waitFor({ state: 'detached', timeout: 10000 }).catch(async () => { await pg.locator('[data-fa-feuille] button[aria-label]').first().click().catch(() => {}); });
        await pg.locator('[data-fa-ref="123456789"][data-fa-etat="emise"]').waitFor({ state: 'attached', timeout: 20000 });
        if (!(await pg.locator('[data-fa-ref="123456789"][data-fa-etat="emise"]').isVisible())) await deplier(pg, '123456789');
        await pg.locator('[data-fa-ref="123456789"][data-fa-etat="emise"]').waitFor({ timeout: 20000 });
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `fa-apres-${nf}.png`) });
        dit(true, '5. sur la vente : « Facture FA-2026-0006 » (PDF)');
      });
      await essaie('Vente annulée', async () => {
        await deplier(pg, '223456789');
        const r = pg.locator('[data-fa-ref="223456789"][data-fa-etat="refus"]');
        await r.waitFor({ timeout: 20000 });
        dit(await r.getAttribute('data-fa-code') === 'annulee' && await pg.locator('[data-fa-ref="223456789"] button').count() === 0, '1. vente annulée : la raison, aucun bouton');
      });
      await essaie('Vente Vestiaire', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=ventes&site=vestiaire`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-vc-vente="72987283"]', { timeout: 30000 });
        const tete = pg.locator('[data-fa-plateforme="vestiaire"][data-fa-etat="refus"]').first();
        await tete.waitFor({ state: 'attached', timeout: 20000 });
        dit(await tete.getAttribute('data-fa-n') === '1' && await tete.getAttribute('data-fa-code') === 'prix', '7. Vestiaire : le refus dit UNE fois, pour la seule vente sans prix de vente', await tete.getAttribute('data-fa-n'));
        await pg.click('[data-vc-vente="72987283"] .vrm-ledger-sale-toggle');
        const faire = pg.locator('[data-fa-plateforme="vestiaire"][data-fa-ref="72987283"][data-fa-etat="a-faire"] [data-fa-faire]');
        await faire.waitFor({ timeout: 20000 });
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `fa-vc-detail-${nf}.png`) });
        await faire.click();
        const f = pg.locator('[data-fa-feuille="72987283"]');
        await f.waitFor({ timeout: 20000 });
        dit(await f.locator('[data-fa-prix="25000"]').count() === 1 && await f.locator('[data-fa-source="saisi"]').count() === 1, '7. Vestiaire avec prix de vente lu : « Faire la facture », 250,00 € (jamais les 203,23 € versés), acheteur à recopier');
        const m = await mesurer(pg, '[data-fa-feuille="72987283"]');
        dit(m && !m.hors.length && !m.deb, '7. la feuille Vestiaire tient dans la largeur', JSON.stringify(m));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `fa-vc-feuille-${nf}.png`) });
        await pg.click('[data-vc-vente="72987284"] .vrm-ledger-sale-toggle', { force: true }).catch(() => {});
        dit(await pg.locator('[data-fa-ref="72987284"]').count() === 0, '7. la vente sans prix de vente n’a pas de bouton (le refus est dit sous la liste)');
      });
      dit(!errs.length, '6. aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
    // Vendeur SANS SIRET : rien.
    console.log('\n— sans SIRET');
    cfg = { ...CFG, siret: '' }; emis = {};
    const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 }, false);
    await essaie('Sans SIRET', async () => {
      await deplier(pg, '123456789');
      await pg.waitForTimeout(2500);
      dit(await pg.locator('[data-fa-ref]').count() === 0, '1. vendeur sans SIRET : aucune facture proposée');
    });
    dit(!errs.length, '6. aucune erreur d’app', errs.join(' | ').slice(0, 300));
    await ctx.close();
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
