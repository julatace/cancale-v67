// ── BANC : ACHATS HORS PLATEFORME + PRIX D'ACHAT SANS RELIER (16 octobre) ────
// Julien : des achats hors plateforme FACILES (brocante, fournisseur, main
// propre…) et pouvoir TAPER un prix d'achat sur une vente sans choisir un achat
// Vinted. Données INVENTÉES (ce banc vit dans le dépôt, sans fx/). Preuves :
//  • à 390 px, au doigt : « + Ajouter » ouvre le formulaire, on TAPE lettre par
//    lettre (l'ancien formulaire redéclarait son champ à chaque rendu : le focus
//    partait après la 1re lettre), la date vaut aujourd'hui (heure LOCALE),
//    « Brocante » se choisit d'un tap, une photo s'attache ;
//  • l'achat apparaît dans la liste ET part dans `vinted_offvinted_buys` (la clé
//    synchronisée que le « dépensé » lit déjà, §11), prix relu « 18,50 » ;
//  • la photo part dans SA ligne (`achat_hors_photo_{id}`), pas dans `main` ;
//  • un prix illisible est refusé et dit, rien n'est écrit ;
//  • modifier puis supprimer (avec confirmation) ;
//  • sur une vente SANS achat relié : « Saisir le prix » visible sans ouvrir
//    « Modifier », taper 25 → le bénéfice de CETTE vente passe à 80 − 25 = 55,
//    écrit dans `vinted_sale_overrides[tx].buyPrice` (la même écriture que le
//    champ de « Modifier ») ;
//  • cibles ≥ 44 px, aucun débordement horizontal.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4471);
const CAPTURES = process.env.BANC_CAPTURES || '';

const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();
const ACHATS = [
  { transaction_id: 9401, title: 'Achat Vinted banc 41', price: { amount: '30', currency_code: 'EUR' },
    status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed', date: ilYa(4) },
];
const VENTES = [
  { transaction_id: 9301, title: 'Nike Banc sans lien taille 42', price: { amount: '80', currency_code: 'EUR' },
    status: 'Commande finalisée', transaction_user_status: 'completed', date: ilYa(2) },
];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const ROWS = [
  { id: 'main', data: {} },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: ACHATS } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: VENTES } } },
];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

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
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};

async function preparer(b, vp) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ecrits = []; // chaque ligne écrite : { id, data }
  const rows = ROWS.map((r) => ({ id: r.id, data: JSON.parse(JSON.stringify(r.data)) }));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') {
      if (/\/rest\/v1\/app_data/.test(u) && req.method() === 'POST') {
        try {
          let corps = JSON.parse(req.postData() || '[]'); if (!Array.isArray(corps)) corps = [corps];
          for (const l of corps) {
            if (!l || !l.id) continue;
            ecrits.push({ id: l.id, data: l.data });
            const ex = rows.find((r) => r.id === l.id); if (ex) ex.data = l.data; else rows.push({ id: l.id, data: l.data });
          }
        } catch (_) {}
      }
      return j([]);
    }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  const dernierMain = () => { const m = ecrits.filter((e) => e.id === 'main'); return m.length ? m[m.length - 1].data || {} : null; };
  return { ctx, pg, errs, ecrits, dernierMain };
}
const hauteur = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height) : 0; }, sel);
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const capture = async (pg, nom) => { if (!CAPTURES) return; try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = vp.width < 600 ? '📱' : '🖥️';
      const tap = async (pg, sel) => { if (vp.width < 600) await pg.locator(sel).first().tap(); else await pg.locator(sel).first().click(); };

      // ── ACHAT HORS PLATEFORME : ajouter, modifier, supprimer ────────────────
      await essaie(`${T} achat hors plateforme`, async () => {
        const { ctx, pg, errs, ecrits, dernierMain } = await preparer(b, vp);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
        await pg.locator('[data-achat-hors-ajouter]').first().waitFor({ timeout: 12000 });
        dit((await hauteur(pg, '[data-achat-hors-ajouter]')) >= 44, `${T} « + Ajouter » est une cible d’au moins 44 px`);
        await tap(pg, '[data-achat-hors-ajouter]');
        await pg.locator('[data-achat-hors-form]').waitFor({ timeout: 4000 });
        // Taper LETTRE PAR LETTRE (c'est ce que le focus perdu cassait).
        await tap(pg, '[data-champ="titre"]');
        await pg.keyboard.type('Nike P-6000 argent 38', { delay: 15 });
        const titre = await pg.inputValue('[data-champ="titre"]');
        dit(titre === 'Nike P-6000 argent 38', `${T} on tape le titre lettre par lettre sans perdre le champ`, titre);
        const dateVal = await pg.inputValue('[data-champ="date"]');
        const auj = await pg.evaluate(() => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); });
        dit(dateVal === auj, `${T} la date vaut aujourd’hui (heure locale) par défaut`, dateVal);
        // prix illisible : refusé et dit, rien d'écrit
        await tap(pg, '[data-champ="prix"]');
        await pg.keyboard.type('abc');
        const avant = ecrits.length;
        await tap(pg, '[data-achat-hors-enregistrer]');
        await pg.waitForTimeout(1600);
        const err = await pg.locator('[data-achat-hors-erreur]').count();
        const offEcrit = ecrits.slice(avant).some((e) => e.id === 'main' && Array.isArray((e.data || {}).vinted_offvinted_buys) && e.data.vinted_offvinted_buys.length);
        dit(err === 1 && !offEcrit, `${T} un prix illisible est refusé et dit — rien n’est écrit`);
        await pg.fill('[data-champ="prix"]', '');
        await tap(pg, '[data-champ="prix"]');
        await pg.keyboard.type('18,5');
        await tap(pg, '[data-source="Brocante"]');
        dit((await pg.inputValue('[data-champ="lieu"]')) === 'Brocante', `${T} « Brocante » se choisit d’un tap`);
        await pg.setInputFiles('[data-achat-hors-fichier]', { name: 'p.png', mimeType: 'image/png', buffer: PNG });
        await pg.locator('[data-achat-hors-apercu]').waitFor({ timeout: 4000 });
        dit(true, `${T} la photo s’attache et s’affiche en aperçu`);
        dit((await hauteur(pg, '[data-achat-hors-enregistrer]')) >= 44, `${T} « Ajouter l’achat » est une cible d’au moins 44 px`);
        dit((await deborde(pg)) <= 1, `${T} formulaire : aucun débordement horizontal`);
        await capture(pg, `form-${vp.width}`);
        await tap(pg, '[data-achat-hors-enregistrer]');
        await pg.locator('[data-achat-hors-id]').first().waitFor({ timeout: 5000 });
        await pg.waitForTimeout(1800); // save (500 ms) + cloudPush (800 ms)
        const ligne = await pg.locator('[data-achat-hors-id]').first().innerText();
        dit(/Nike P-6000 argent 38/.test(ligne) && /18,50\s*€/.test(ligne) && /Brocante/.test(ligne), `${T} l’achat apparaît dans la liste (titre, lieu, 18,50 €)`, ligne.replace(/\n/g, ' | '));
        const m = dernierMain();
        const liste = m && m.vinted_offvinted_buys;
        const rec = Array.isArray(liste) ? liste[0] : null;
        dit(!!rec && rec.title === 'Nike P-6000 argent 38' && rec.price === '18,50' && rec.source === 'Brocante' && rec.date === auj, `${T} il est écrit dans vinted_offvinted_buys (prix relu « 18,50 »)`, JSON.stringify(rec || null).slice(0, 160));
        dit(!!rec && rec.photo === true && !rec.numero, `${T} sans N° (aucune obligation de relier), photo notée`);
        const ph = ecrits.find((e) => /^achat_hors_photo_/.test(e.id));
        dit(!!ph && /^data:image\//.test((ph.data || {}).b64 || '') && !!rec && ph.id === 'achat_hors_photo_' + rec.id, `${T} la photo part dans SA ligne (achat_hors_photo_{id}), pas dans main`);
        dit(!JSON.stringify(m || {}).includes('data:image'), `${T} aucune photo dans la ligne main`);
        const resume = await pg.locator('[data-achats-hors-resume]').innerText();
        dit(/1 achat/.test(resume) && /18,50/.test(resume), `${T} l’en-tête dit le nombre et le total`, resume);
        dit((await deborde(pg)) <= 1, `${T} liste : aucun débordement horizontal`);
        await capture(pg, `liste-${vp.width}`);
        // Modifier
        await tap(pg, '[data-achat-hors-id]');
        await pg.locator('[data-achat-hors-form]').waitFor({ timeout: 4000 });
        await pg.fill('[data-champ="prix"]', '20');
        await tap(pg, '[data-achat-hors-enregistrer]');
        await pg.waitForTimeout(1800);
        const rec2 = ((dernierMain() || {}).vinted_offvinted_buys || [])[0];
        dit(!!rec2 && rec2.price === '20,00' && rec2.id === (rec || {}).id && rec2.photo === true, `${T} modifier : le prix change, le même achat, la photo reste`, JSON.stringify(rec2 || null).slice(0, 120));
        // Supprimer (avec confirmation)
        await tap(pg, '[data-achat-hors-id]');
        await tap(pg, '[data-achat-hors-supprimer]');
        const oui = pg.getByRole('button', { name: /Oui, supprimer/ });
        await oui.first().waitFor({ timeout: 4000 });
        dit(true, `${T} supprimer demande une confirmation`);
        await oui.first().click();
        await pg.waitForTimeout(1800);
        const l3 = (dernierMain() || {}).vinted_offvinted_buys;
        dit(Array.isArray(l3) && l3.length === 0 && (await pg.locator('[data-achat-hors-id]').count()) === 0, `${T} supprimé : sorti de la liste et de vinted_offvinted_buys`);
        dit(errs.length === 0, `${T} aucune erreur de page`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      });

      // ── PRIX D'ACHAT SUR UNE VENTE, SANS RELIER ────────────────────────────
      await essaie(`${T} prix sur une vente`, async () => {
        const { ctx, pg, errs, dernierMain } = await preparer(b, vp);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
        const row = pg.locator('.vrm-sale-row', { hasText: 'Nike Banc sans lien' }).first();
        await row.waitFor({ timeout: 12000 });
        const btn = row.locator('[data-cout-vente-saisir]');
        dit((await btn.count()) === 1 && (await btn.isVisible()), `${T} « Saisir le prix » est visible sur la vente, sans ouvrir « Modifier »`);
        dit((await row.locator('[data-cout-vente-relier]').count()) === 1, `${T} « Relier un achat » est juste à côté`);
        const h = await btn.evaluate((e) => Math.round(e.getBoundingClientRect().height));
        dit(h >= 44, `${T} « Saisir le prix » est une cible d’au moins 44 px`, h + ' px');
        const benefAvant = await row.locator('[data-benef-vente]').getAttribute('data-benef-vente').catch(() => null);
        if (vp.width < 600) await btn.tap(); else await btn.click();
        await row.locator('[data-cout-vente-champ]').waitFor({ timeout: 3000 });
        await pg.keyboard.type('25');
        await capture(pg, `vente-saisie-${vp.width}`);
        await row.locator('[data-cout-vente-ok]').click();
        await pg.waitForTimeout(1800);
        const benef = await row.locator('[data-benef-vente]').getAttribute('data-benef-vente').catch(() => null);
        dit(benef === '55.00', `${T} le bénéfice de CETTE vente passe à 80 − 25 = 55`, `avant ${benefAvant} · après ${benef}`);
        const ov = ((dernierMain() || {}).vinted_sale_overrides || {})['9301'];
        dit(!!ov && ov.buyPrice === '25,00' && !ov.buyFromId, `${T} écrit dans vinted_sale_overrides[9301].buyPrice, sans achat relié`, JSON.stringify(ov || null));
        dit((await row.locator('[data-cout-vente]').count()) === 0, `${T} une fois le coût connu, les deux boutons disparaissent`);
        dit((await deborde(pg)) <= 1, `${T} ventes : aucun débordement horizontal`);
        await capture(pg, `vente-apres-${vp.width}`);
        dit(errs.length === 0, `${T} aucune erreur de page`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ achats hors plateforme : ${ko} rouge(s).` : `\n✅ achats hors plateforme : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
