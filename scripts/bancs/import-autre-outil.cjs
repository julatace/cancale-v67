// ── BANC : PARAMÈTRES → IMPORTER (11 nov.) — son stock et ses ventes passées ──
// Données INVENTÉES (aucune fx/). Aux deux tailles (390 tactile, 1512), clair et sombre :
//  • STOCK : un CSV FR (« ; », « 12,50 € », JJ/MM/AAAA) — N°12 et 13 à importer, N°7 déjà
//    sur une annonce et 12 deux fois ⇒ CONFLITS ; « vingt » ⇒ prix vide et dit ; RIEN n'est
//    écrit avant « Importer » ; puis : 2 paires « importe », pool = l'ancien + 12, 13 (rien
//    retiré), coût posé sur 12 seulement, la fiche N°7 intacte ;
//  • un N° servi ENTRE l'aperçu et le clic (une fiche N°20 posée par un autre écran) ⇒
//    « vient d'être servi ailleurs », rien écrit ;
//  • « Annuler » (deux gestes) : le stock importé et son coût retirés, le pool inchangé ;
//  • VENTES : un CSV « , » — une vente Vinted sans n° ⇒ « à vérifier », pas importée ;
//    sans date de versement ⇒ dit « à dater » ; écrites marquées « importe » ;
//  • 2 000 lignes : l'aperçu arrive, aucune tâche longue au-delà du seuil (l'écran respire).
// `BANC_PORT` (défaut 4697), `BANC_CAPTURES=dossier`.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4697);
const CAPTURES = process.env.BANC_CAPTURES || '';

const MAINTENANT = Date.now();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const POOL = [1, 2, 3, 4, 5, 6, 7];
const ROWS = [
  { id: 'main', data: { vinted_annonce_numeros: { 9007: { numero: '7' } }, vinted_used_numeros: POOL, vinted_buyprice_by_num: { 5: '9,00' } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: [] } } },
];
const STOCK = '\uFEFFN°;Désignation;Prix d’achat;Date d’achat;Emplacement;Remarques\r\n'
  + '12;Nike Air Max 90 banc 42;12,50 €;03/04/2026;Étagère A;semelle à nettoyer\r\n'
  + '13;Adidas Samba banc 41;vingt;05/04/2026;Étagère B;\r\n'
  + '7;Déjà dans VRM banc;30 €;06/04/2026;;\r\n'
  + '12;Doublon banc;10 €;06/04/2026;;\r\n';
const STOCK20 = 'N°;Désignation;Prix d’achat\n20;Puma banc;15 €\n';
const VENTES = 'Date de vente,Article,Prix de vente,Plateforme,Date de versement,N° de commande\n'
  + '02/09/2026,Air Max banc,"45,00 €",Vinted,05/09/2026,77001122\n'
  + '10/10/2026,Dunk banc,"60,00 €",Leboncoin,,LBC-7788\n'
  + '12/10/2026,Air Force banc,"30,00 €",Vinted,,\n'
  + '13/10/2026,Lot banc,"20,00 €",Brocante,,\n';
const GROS = 'N°;Désignation;Prix d’achat;Date d’achat\n' + Array.from({ length: 2000 }, (_, i) => `${1000 + i};Paire banc ${i % 9};12,50 €;03/04/2026`).join('\n') + '\n';

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  if (f === '/sw.js') { r.writeHead(404); return r.end(); }   // le banc pose lui-même la réserve
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

async function preparer(b, vp, sombre, rowsDe = null) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ecrits = [];
  const rows = (rowsDe ? rowsDe() : ROWS).map((r) => ({ id: r.id, data: JSON.parse(JSON.stringify(r.data)) }));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, !!sombre);
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
      if (/\/rest\/v1\/app_data/.test(u) && req.method() === 'PATCH') {
        const id = (/[?&]id=eq\.([^&]*)/.exec(u) || [])[1];
        let corps = null; try { corps = JSON.parse(req.postData() || 'null'); } catch (_) {}
        const ex = id && rows.find((r) => r.id === id);
        if (ex && corps && corps.data !== undefined) { ecrits.push({ id, data: corps.data }); ex.data = corps.data; return j([{ id }]); }
      }
      return j([]);
    }
    if (/select=owner&limit=1/.test(u)) return j([]);
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
  // La dernière valeur ÉCRITE d'une clé de `main` (undefined = jamais écrite).
  const cle = (k) => { const m = ecrits.filter((e) => e.id === 'main' && e.data && k in e.data); return m.length ? m[m.length - 1].data[k] : undefined; };
  return { ctx, pg, errs, ecrits, cle };
}
const hauteur = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height) : 0; }, sel);
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const capture = async (pg, nom) => { if (!CAPTURES) return; try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };
const resume = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-imps-ok]'); return e ? ['ok', 'conflits', 'doubles', 'averifier', 'ecartees', 'adater'].map((k) => e.getAttribute('data-imps-' + k)).join('/') : ''; });
const nums = (l) => (Array.isArray(l) ? l.map(String) : []);

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      for (const sombre of [false, true]) {
        const T = (vp.width < 600 ? '📱' : '🖥️') + (sombre ? '🌙' : '☀️');
        const tap = async (pg, sel) => { if (vp.width < 600) await pg.locator(sel).first().tap(); else await pg.locator(sel).first().click(); };
        const suffixe = `${vp.width}-${sombre ? 'sombre' : 'clair'}`;
        const ouvrir = async (pg) => {
          await pg.goto(`http://localhost:${PORT}/?tab=settings&section=importer`, { waitUntil: 'domcontentloaded' });
          await pg.locator('[data-imps]').first().waitFor({ timeout: 20000 });
          await pg.locator('[data-imps]').first().scrollIntoViewIfNeeded();
        };
        const deposer = async (pg, nom, texte) => {
          await pg.setInputFiles('[data-imps-fichier]', { name: nom, mimeType: 'text/csv', buffer: Buffer.from(texte, 'utf8') });
          await pg.locator('[data-imps-lignes]').first().waitFor({ timeout: 20000 });
        };

        // ── Stock : aperçu, conflits, écriture, puis annulation ────────────────
        await essaie(`${T} stock`, async () => {
          const { ctx, pg, errs, cle } = await preparer(b, vp, sombre);
          await ouvrir(pg);
          dit((await pg.locator('[data-imps-attendue]').count()) === 6, `${T} Paramètres → Importer : les 6 colonnes du stock sont dites`);
          await capture(pg, `importer-choisir-${suffixe}`);
          await deposer(pg, 'mon-stock.csv', STOCK);
          const champs = await pg.evaluate(() => [...document.querySelectorAll('[data-imps-col]')].map((s) => s.value).join(','));
          dit(champs === 'numero,titre,prix,date,emplacement,notes', `${T} colonnes reconnues d’elles-mêmes`, champs);
          const r = await resume(pg);
          dit(r.startsWith('2/2/0/0/0'), `${T} aperçu : 2 à importer · 2 en conflit (N°7 déjà là, 12 deux fois)`, r);
          dit((await pg.locator('[data-imps-ligne="4"]').getAttribute('data-imps-etat')) === 'conflit', `${T} N°7 déjà sur une annonce ⇒ conflit montré`);
          dit((await pg.locator('[data-imps-ligne="3"] [data-imps-prix]').getAttribute('data-imps-prix')) === '' && (await pg.locator('[data-imps-ligne="3"] [data-imps-note]').count()) === 1, `${T} « vingt » ⇒ prix vide, et c’est dit sur la ligne`);
          dit((await deborde(pg)) <= 1, `${T} aucun débordement horizontal`);
          await pg.waitForTimeout(1500);
          { const p0 = nums(cle('vinted_used_numeros')); dit(!(cle('vrm_stock_importe') || []).length && !p0.includes('12') && !p0.includes('13'), `${T} rien n’est écrit avant « Importer »`, p0.join(',')); }
          await capture(pg, `importer-apercu-${suffixe}`);
          dit((await hauteur(pg, '[data-imps-importer]')) >= 44, `${T} « Importer 2 lignes » ≥ 44 px`);
          await tap(pg, '[data-imps-importer]');
          await pg.locator('[data-imps-journal]').first().waitFor({ timeout: 8000 });
          await pg.waitForTimeout(2200);
          const st = cle('vrm_stock_importe') || [];
          dit(st.length === 2 && st.every((x) => x.source === 'importe') && st.some((x) => x.numero === '12' && x.prix === '12,50' && x.emplacement === 'Étagère A') && st.some((x) => x.numero === '13' && !x.prix),
            `${T} son clic écrit les 2 paires (N°, emplacement, prix du fichier), marquées « importe »`, JSON.stringify(st.map((x) => [x.numero, x.prix || ''])));
          const pool = nums(cle('vinted_used_numeros'));
          dit(POOL.every((n) => pool.includes(String(n))) && pool.includes('12') && pool.includes('13'), `${T} pool : l’ancien gardé, 12 et 13 ajoutés (jamais redonnés)`, pool.join(','));
          const couts = cle('vinted_buyprice_by_num') || {};
          dit(couts['12'] === '12,50' && !('13' in couts) && couts['5'] === '9,00', `${T} coût posé sur le N°12 seulement ; celui du N°5 gardé`, JSON.stringify(couts));
          const fiches = cle('vinted_annonce_numeros');
          dit(fiches === undefined || (fiches['9007'] && fiches['9007'].numero === '7'), `${T} la fiche N°7 n’est pas touchée`);
          await capture(pg, `importer-fait-${suffixe}`);
          // Un N° servi entre l'aperçu et le clic ⇒ rien écrit.
          await deposer(pg, 'un-de-plus.csv', STOCK20);
          dit((await resume(pg)).startsWith('1/0'), `${T} N°20 libre à l’aperçu`);
          await pg.evaluate(() => { const f = JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'); f['9020'] = { numero: '20' }; localStorage.setItem('vinted_annonce_numeros', JSON.stringify(f)); });
          await tap(pg, '[data-imps-importer]');
          await pg.locator('[data-imps-erreur]').first().waitFor({ timeout: 6000 });
          const msg = await pg.locator('[data-imps-erreur]').first().textContent();
          dit(/vient d’être servi ailleurs/.test(msg || ''), `${T} N°20 servi entre l’aperçu et le clic ⇒ rien écrit, et c’est dit`, msg);
          dit((cle('vrm_stock_importe') || []).length === 2, `${T} le stock importé n’a pas bougé`);
          await pg.waitForFunction(() => { const e = document.querySelector('[data-imps-ligne="2"]'); return e && e.getAttribute('data-imps-etat') === 'conflit'; }, null, { timeout: 6000 });
          dit(true, `${T} l’aperçu est relu : N°20 passe en conflit`);
          // Annuler (deux gestes).
          const imp = await pg.locator('[data-imps-annuler]').first().getAttribute('data-imps-annuler');
          await tap(pg, `[data-imps-annuler="${imp}"]`);
          await pg.locator('[data-imps-annuler-phrase]').first().waitFor({ timeout: 4000 });
          await capture(pg, `importer-annuler-${suffixe}`);
          dit(/restent réservés/.test(await pg.locator('[data-imps-annuler-phrase]').textContent()), `${T} « Annuler » dit que les N° restent réservés`);
          await tap(pg, `[data-imps-annuler-confirmer="${imp}"]`);
          await pg.waitForTimeout(2200);
          dit((cle('vrm_stock_importe') || []).length === 0, `${T} annulé : le stock importé est retiré`);
          const c2 = cle('vinted_buyprice_by_num') || {};
          dit(!('12' in c2) && c2['5'] === '9,00', `${T} annulé : son coût retiré, l’autre gardé`, JSON.stringify(c2));
          const p2 = nums(cle('vinted_used_numeros'));
          dit(p2.includes('12') && p2.includes('13') && POOL.every((n) => p2.includes(String(n))), `${T} annulé : le pool n’a pas rétréci`);
          dit(errs.length === 0, `${T} aucune erreur de page`, errs.join(' | ').slice(0, 160));
          await ctx.close();
        });

        // ── Ventes passées ─────────────────────────────────────────────────────
        await essaie(`${T} ventes`, async () => {
          const { ctx, pg, errs, cle } = await preparer(b, vp, sombre);
          await ouvrir(pg);
          await tap(pg, '[data-imps-mode-choix="ventes"]');
          await pg.locator('[data-imps-mode="ventes"]').first().waitFor({ timeout: 4000 });
          await deposer(pg, 'mes-ventes.csv', VENTES);
          const r = await resume(pg);
          dit(r === '3/0/0/1/0/2', `${T} aperçu : 3 à importer · 1 à vérifier (Vinted sans n°) · 2 à dater`, r);
          dit((await pg.locator('[data-imps-ligne="4"]').getAttribute('data-imps-etat')) === 'averifier', `${T} Vinted sans n° de commande ⇒ « à vérifier »`);
          dit((await pg.locator('[data-imps-note-adater]').count()) === 1, `${T} « sans date de versement : à dater » est dit`);
          await capture(pg, `importer-ventes-${suffixe}`);
          await pg.waitForTimeout(1200);
          dit(!(cle('vrm_ventes_importees') || []).length, `${T} rien n’est écrit avant « Importer »`);
          await tap(pg, '[data-imps-importer]');
          await pg.locator('[data-imps-journal]').first().waitFor({ timeout: 8000 });
          await pg.waitForTimeout(2200);
          const v = cle('vrm_ventes_importees') || [];
          dit(v.length === 3 && v.every((x) => x.source === 'importe') && !v.some((x) => x.titre === 'Air Force banc') && v.some((x) => x.ref === '77001122' && x.versement === '2026-09-05' && x.date === '2026-09-02'),
            `${T} 3 ventes écrites, marquées « importe », datées comme dans le fichier`, JSON.stringify(v.map((x) => [x.titre, x.date, x.versement || ''])));
          dit(errs.length === 0, `${T} aucune erreur de page`, errs.join(' | ').slice(0, 160));
          await ctx.close();
        });

        // ── L'étape facultative de « Démarrer avec VRM » ────────────────────────
        if (!sombre) await essaie(`${T} guide`, async () => {
          const { ctx, pg, errs } = await preparer(b, vp, sombre);
          await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
          await pg.locator('[data-guide-importer-geste]').first().waitFor({ timeout: 20000 });
          const tot = await pg.evaluate(() => { const e = document.querySelector('[data-guide-progres]'); return e ? Number(e.getAttribute('data-guide-progres').split('/')[1]) : -1; });
          const rangs = await pg.locator('[data-parcours-rang]').count();
          dit(tot > 0 && rangs === tot && (await pg.locator('[data-parcours-rang="importer"]').count()) === 0, `${T} l’import est à part : les étapes comptées ne changent pas (${rangs}/${tot})`);
          dit((await hauteur(pg, '[data-guide-importer-geste]')) >= 44, `${T} « Importer mon stock » ≥ 44 px`);
          await pg.locator('[data-guide-importer]').first().scrollIntoViewIfNeeded();
          await capture(pg, `guide-importer-${suffixe}`);
          await tap(pg, '[data-guide-importer-geste]');
          await pg.locator('[data-imps]').first().waitFor({ timeout: 15000 });
          dit(true, `${T} « Importer mon stock » ouvre Paramètres → Importer`);
          dit(errs.length === 0, `${T} aucune erreur de page`, errs.join(' | ').slice(0, 160));
          await ctx.close();
        });

        // ── 2 000 lignes ───────────────────────────────────────────────────────
        if (!sombre) await essaie(`${T} 2000`, async () => {
          const { ctx, pg, errs } = await preparer(b, vp, sombre);
          await ouvrir(pg);
          await pg.evaluate(() => { window.__longues = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__longues.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: false }); } catch (_) {} });
          const t0 = Date.now();
          await deposer(pg, 'gros-stock.csv', GROS);
          const duree = Date.now() - t0;
          const r = await resume(pg);
          const longues = await pg.evaluate(() => window.__longues || []);
          const max = longues.length ? Math.max(...longues) : 0;
          dit(r.startsWith('2000/0'), `${T} 2 000 lignes : toutes à importer`, r);
          dit((await pg.locator('[data-imps-ligne]').count()) === 150, `${T} 150 lignes montrées, le reste compté`);
          dit(max < 700, `${T} la plus longue tâche : ${max} ms (${longues.length} au-delà de 50 ms, ${duree} ms en tout)`);
          await capture(pg, `importer-2000-${suffixe}`);
          dit(errs.length === 0, `${T} aucune erreur de page`, errs.join(' | ').slice(0, 160));
          await ctx.close();
        });
      }
    }
  } finally {
    if (b) await b.close();
    srv.close();
  }
  console.log(ko ? `\n❌ import-autre-outil : ${ko} rouge(s)` : '\n✅ import-autre-outil : tout vert');
  process.exit(ko ? 1 : 0);
}
main().catch((e) => { console.log('KO  ' + (e && e.message)); process.exit(1); });
