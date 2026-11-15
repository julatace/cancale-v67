// BANC : VENTE EN MAIN PROPRE (160, 14 nov.) — node scripts/bancs/vente-main-propre.cjs après le build.
// Données INVENTÉES. 390 tactile et 1512, clair et sombre (BANC_TAILLES=390,1512-sombre…, BANC_PORT, BANC_DIST) :
//   · la loupe « vendu 124 » ⇒ l'action ⇒ la feuille, le prix déjà au focus ⇒ « Vendue · 45 € » :
//     DEUX touchers mesurés (pointerdown comptés), décision datée du jour + paiement, sortie du stock ;
//     « aujourd'hui 45 € » de Ma journée (`data-vendu-jour`) ; « Annuler » (5 s) ⇒ l'état d'avant EXACT (stockage relu),
//     le chiffre revient, la feuille dit « Vente annulée » ; revendue en virement ⇒ le reçu PDF ;
//   · refus clairs : N° inconnu, N° d'archive (proposé, son toucher le prend), déjà vendue sur Vinted (à envoyer) ;
//   · N° porté par deux paires (et une case du garage : la règle des doublons ne devine pas, le rouge reste) ⇒ la question,
//     plaques rouges, aucun prix avant son toucher ;
//   · le reçu PDF se télécharge ; cibles ≥ 44 px ; aucun débordement ; aucune erreur.
// Captures : $TMPDIR/vrm-bancs/vente-main-propre/*.png (À REGARDER).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 12613;
const SHOTS = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'vrm-bancs', 'vente-main-propre');
fs.mkdirSync(SHOTS, { recursive: true });

const MAINTENANT = Date.now(), H = 3600000;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const jourLocal = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const AUJ = jourLocal(MAINTENANT);
const item = (id, title, prix) => ({ id, title, brand_title: 'Nike', price: { amount: prix + '.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, size_title: '42', status: 'Très bon état', view_count: 3, favourite_count: 0, created_at_ts: MAINTENANT - 5 * 86400000, nPhotos: 2 });
const NUMEROS = {
  '9124': { numero: '124', title: 'Asics Gel-Kayano 14 argent', size: '43', price: '90', accountId: '111', buyPrice: '37' },
  '9b25': { numero: 'B125', title: 'Adidas Samba OG blanche', price: '70', accountId: '111' },
  '9130': { numero: '130', title: 'New Balance 550 blanche', price: '80', accountId: '111' },
  '9881': { numero: '88', title: 'Air Max 90 blanche', price: '70', accountId: '111' },
  '9882': { numero: '88', title: 'Air Max 90 noire', price: '75', accountId: '111' },
};
const ITEMS = [item(9124, 'Asics Gel-Kayano 14 argent', 90), item(9881, 'Air Max 90 blanche', 70), item(9882, 'Air Max 90 noire', 75), { ...item(9125, 'Adidas Samba OG blanche', 70), id: '9b25' }];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const ROWS = () => [
  { id: 'main', data: { vinted_annonce_numeros: JSON.parse(JSON.stringify(NUMEROS)), vinted_dark: false, vrm_meubles: [{ id: 'm1', name: 'Étagère', cols: 4, rows: 3 }], vrm_slots: { '124': { m: 'm1', i: 3 } }, vrm_numerotation: { version: 1, archive: 'B', coupure: '2026-10-09T00:00:00Z' }, vinted_garage_grid: { A1: ['88'] } } },
  { id: 'harvest_111_listings', data: { capturedAt: ilYaH(0.2), payload: { items: ITEMS } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), nItems: 2, payload: { my_orders: [{ transaction_id: 7130, title: 'New Balance 550 blanche', price: { amount: '80.0', currency_code: 'EUR' }, date: ilYaH(30), status: 'Bordereau envoyé', transaction_user_status: 'needs_action', _acc: { vinted_user_id: '111' } }, { transaction_id: 7088, title: 'Air Max 90 blanche', price: { amount: '70.0', currency_code: 'EUR' }, date: ilYaH(50), status: 'Commande annulée', _acc: { vinted_user_id: '111' } }] } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: ilYaH(0.2), nItems: 0, payload: { my_orders: [] } } },
  { id: 'harvest_111_txn_7088', data: { capturedAt: ilYaH(1), payload: { transaction: { id: 7088, item_id: 9881, status: 900, status_title: 'Commande annulée' } } } },
  { id: 'harvest_111_txn_7130', data: { capturedAt: ilYaH(1), payload: { transaction: { id: 7130, item_id: 9130, status: 300, status_title: 'Bordereau envoyé' } } } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (!c && d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).replace(/\s+/g, ' ').slice(0, 900)); } };
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
const motif = (p) => new RegExp('^' + p.replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');

async function preparer(b, vp, { sombre = false } = {}) {
  const ctx = await b.newContext({ viewport: vp, acceptDownloads: true, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = [], ecrits = [];
  const rows = ROWS();
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ s }) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); if (s) localStorage.setItem('vinted_dark', 'true'); localStorage.setItem('vinted_garage_grid', JSON.stringify({ A1: ['88'] })); } catch (_) {}
    window.__touchers = 0; document.addEventListener('pointerdown', () => { window.__touchers++; }, true);
  }, { s: sombre });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { ecrits.push(u); return j([]); }
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = motif(lk[1]); let l = rows.filter((r) => re.test(r.id)); const rg = req.headers()['range']; if (rg) { const m = /(\d+)-(\d+)/.exec(rg); if (m) l = l.slice(+m[1], +m[2] + 1); } return j(l.map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"ok":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => !document.getElementById('vrm-demarrage'), null, { timeout: 60000 }).catch(() => {});
  await pg.waitForTimeout(2500);
  return { ctx, pg, errs, ecrits };
}
// Une capture (À REGARDER) : une machine lente peut la faire attendre ; on réessaie une fois, sans juger la règle dessus.
const capture = async (pg, nom) => { for (let i = 0; i < 2; i++) { try { await pg.screenshot({ path: path.join(SHOTS, nom), timeout: 45000 }); return; } catch (_) {} } console.log('    (capture ' + nom + ' pas prise)'); };
const attendre = (pg, f, arg, ms = 10000) => pg.waitForFunction(f, arg, { timeout: ms }).then(() => true).catch(() => false);
const debord = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const lireLS = (pg, k) => pg.evaluate((k) => localStorage.getItem(k), k);
const cibles = (pg) => pg.evaluate(() => { const f = document.querySelector('[data-ia-feuille]'); if (!f) return ['pas de feuille']; return [...f.querySelectorAll('button, input, summary')].filter((e) => e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.height >= 43.5 ? null : `${e.tagName.toLowerCase()}[${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24)}] ${r.height.toFixed(1)} px (min ${cs.minHeight}, transform ${cs.transform})`; }).filter(Boolean); });
// Le « vendu » et le « versé » du jour dans Ma journée (`data-jv2-vendu`, `data-jv2-verse`, en centimes).
const venduJour = (pg) => pg.evaluate(() => { const v = document.querySelector('[data-jv2-vendu]'), r = document.querySelector('[data-jv2-verse]'); return (v ? v.getAttribute('data-jv2-vendu') : '-') + '/' + (r ? r.getAttribute('data-jv2-verse') : '-'); });
const pret = async (pg, tel) => {
  const sel = tel ? 'button[data-recherche-loupe]' : '[data-barre-recherche]';
  for (let i = 0; i < 80; i++) { const ok = await pg.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); if (!r.width) return false; const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(t && (e === t || e.contains(t))); }, sel); if (ok) return true; await pg.waitForTimeout(250); }
  return false;
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const TOUTES = [[{ width: 390, height: 844 }, false], [{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, false], [{ width: 1512, height: 950 }, true]];
    const voulues = process.env.BANC_TAILLES ? process.env.BANC_TAILLES.split(',') : null;
    for (const [vp, sombre] of TOUTES.filter(([v, s]) => !voulues || voulues.includes(`${v.width}${s ? '-sombre' : ''}`))) {
      const tel = vp.width < 600; const TT = `[${vp.width}${sombre ? ' sombre' : ''}]`; const suf = `${vp.width}${sombre ? '-sombre' : ''}`;
      console.log(`── ${vp.width} px${sombre ? ' · sombre' : ' · clair'}`);
      const { ctx, pg, errs } = await preparer(b, vp, { sombre });
      const toucher = async (sel) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if (tel) await l.tap(); else await l.click(); };
      const taper = async (sel, t) => { const l = pg.locator(sel).first(); await l.fill(''); await l.focus(); await pg.keyboard.type(t, { delay: 15 }); };
      await essaie('vente en deux touchers', async () => {
        const avantD = await lireLS(pg, 'vrm_cycle_decisions'), avantV = await lireLS(pg, 'vinted_annonces_vendues'), avantS = await lireLS(pg, 'vrm_slots');
        const jourAvant = await venduJour(pg);
        await pret(pg, tel);
        if (tel) await pg.locator('button[data-recherche-loupe]').first().tap();
        else { await pg.locator('body').click({ position: { x: 5, y: 400 } }).catch(() => {}); await pg.keyboard.press('ControlOrMeta+k'); }
        await attendre(pg, () => !!document.querySelector('[data-recherche-champ]'));
        await pg.keyboard.type('vendu 124', { delay: 15 });
        const act = await attendre(pg, () => !!document.querySelector('[data-recherche-action="vente-main-num"][data-recherche-num="124"]'));
        dit(act, `${TT} la loupe « vendu 124 » propose « N°124 vendu en main propre »`);
        await pg.evaluate(() => { window.__touchers = 0; });
        await toucher('[data-recherche-action="vente-main-num"]');
        const prete = await attendre(pg, () => document.querySelector('[data-ia-etape="prix"]') && document.querySelector('[data-ia-paire="9124"]') && document.activeElement && document.activeElement.hasAttribute('data-ia-prix'), null, 20000);
        dit(prete, `${TT} la feuille s’ouvre sur la paire N°124 (identité), le PRIX déjà au focus`, await pg.evaluate(() => (document.querySelector('[data-ia-verdict]') || {}).getAttribute && document.querySelector('[data-ia-verdict]').getAttribute('data-ia-verdict')));
        await capture(pg, `prix-${suf}.png`);
        await pg.keyboard.type('45', { delay: 15 });
        const lib = await pg.evaluate(() => document.querySelector('[data-ia-valider]').textContent);
        dit(/45/.test(lib), `${TT} le bouton plein dit « Vendue · 45 € »`, lib);
        const c = await cibles(pg);
        dit(c.length === 0, `${TT} cibles ≥ 44 px`, c.join(' ; '));
        dit((await debord(pg)) <= 1, `${TT} aucun débordement`);
        await toucher('[data-ia-valider]');
        // « Annuler » TOUT DE SUITE (la pilule dure 5 s) : l'état d'avant EXACT, la feuille le dit.
        const annuler = pg.locator('[data-pilule-annuler]').first();
        await annuler.waitFor({ timeout: 4000 }).catch(() => {});
        const n = await pg.evaluate(() => window.__touchers);
        const ecrit = await attendre(pg, ([a]) => { try { const d = JSON.parse(localStorage.getItem('vrm_cycle_decisions') || '{}')['9124']; const v = JSON.parse(localStorage.getItem('vinted_annonces_vendues') || '[]'); const s = JSON.parse(localStorage.getItem('vrm_slots') || '{}'); return !!(d && d.choix === 'vendu-main' && d.montant === 45 && d.paiement === 'especes' && d.date === a && d.numero === '124' && v.includes('9124') && !s['124']); } catch (_) { return false; } }, [AUJ], 3000);
        // `force` : la pilule entre en glissant (jamais « stable » pour Playwright sur une machine lente) ; un VRAI clic à sa place.
        if (await annuler.count()) { if (tel) await annuler.tap({ force: true }); else await annuler.click({ force: true }); }
        dit(n === 2, `${TT} DEUX touchers mesurés (l’action, « Vendue »)`, String(n));
        dit(ecrit, `${TT} vendue en main propre : 45 €, espèces, datée du jour, sortie du stock (case libérée, N° gardé)`, await lireLS(pg, 'vrm_cycle_decisions'));
        const revenu = await attendre(pg, ([d0, v0, s0]) => { const eg = (k, x) => { const vide = k === 'vinted_annonces_vendues' ? '[]' : '{}'; /* une clé absente = vide (aucun lecteur ne les distingue) */ return JSON.stringify(JSON.parse(localStorage.getItem(k) || vide)) === JSON.stringify(JSON.parse(x || vide)); }; return eg('vrm_cycle_decisions', d0) && eg('vinted_annonces_vendues', v0) && eg('vrm_slots', s0); }, [avantD, avantV, avantS], 10000);
        dit(revenu, `${TT} « Annuler » ⇒ décisions, marque « vendue » et case : l’état d’avant EXACT`, [avantD, await lireLS(pg, 'vrm_cycle_decisions'), avantS, await lireLS(pg, 'vrm_slots')].join(' | '));
        const dite = await attendre(pg, () => document.querySelector('[data-ia-etape]')?.getAttribute('data-ia-etape') === 'prix' && /Vente annulée/.test(document.querySelector('[data-ia-note]')?.textContent || ''), null, 8000);
        dit(dite, `${TT} la feuille dit « Vente annulée » et revient au prix (jamais « vendu » affiché pour rien)`);
        const retour = await attendre(pg, (j0) => { const v = document.querySelector('[data-jv2-vendu]'), r = document.querySelector('[data-jv2-verse]'); return ((v ? v.getAttribute('data-jv2-vendu') : '-') + '/' + (r ? r.getAttribute('data-jv2-verse') : '-')) === j0; }, jourAvant, 8000);
        dit(retour, `${TT} les chiffres du jour de Ma journée sont ceux d’avant`, String(await venduJour(pg)) + ' / avant : ' + jourAvant);
        await capture(pg, `annulee-${suf}.png`);
        // Revendue (virement) : Ma journée la compte (vendu ET versé le jour saisi), puis le reçu PDF.
        await taper('[data-ia-prix]', '45');
        await toucher('[data-ia-paiement-choix="virement"]');
        await toucher('[data-ia-valider]');
        dit(await attendre(pg, () => { try { const d = JSON.parse(localStorage.getItem('vrm_cycle_decisions') || '{}')['9124']; return d && d.paiement === 'virement' && d.montant === 45; } catch (_) { return false; } }), `${TT} revendue : virement rangé avec la décision`);
        await attendre(pg, () => !!document.querySelector('[data-ia-vente-faite="9124"]'));
        const jour = await attendre(pg, () => { const v = document.querySelector('[data-jv2-vendu]'), r = document.querySelector('[data-jv2-verse]'); return v && v.getAttribute('data-jv2-vendu') === '4500' && r && r.getAttribute('data-jv2-verse') === '4500'; }, null, 10000);
        dit(jour, `${TT} Ma journée : vendu 45 € et versé 45 € aujourd’hui (encaissée le jour saisi)`, await venduJour(pg) + ' / avant : ' + jourAvant);
        await capture(pg, `faite-${suf}.png`);
        const dl = pg.waitForEvent('download', { timeout: 20000 }).catch(() => null);
        await toucher('[data-ia-recu]');
        const d = await dl; let entete = '';
        if (d) { const p = await d.path(); entete = p ? fs.readFileSync(p).slice(0, 5).toString() : ''; }
        dit(d && /^recu-MP-\d{8}-124\.pdf$/.test(d.suggestedFilename()) && entete === '%PDF-', `${TT} le reçu PDF se télécharge`, d ? d.suggestedFilename() : 'aucun');
        await toucher('[data-ia-fermer]');
      });
      await essaie('refus et question', async () => {
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:idees', { detail: { quoi: 'vente-main' } })));
        await attendre(pg, () => !!document.querySelector('[data-ia-recherche]'));
        const essai = async (q, etat) => { await taper('[data-ia-recherche]', q); return attendre(pg, (e) => document.querySelector('[data-ia-verdict]')?.getAttribute('data-ia-verdict') === e, etat, 20000); };
        dit(await essai('999', 'aucune') && await pg.evaluate(() => /Aucune paire au N°999/.test(document.querySelector('[data-ia-etat="aucune"]')?.textContent || '')), `${TT} N° inconnu ⇒ « Aucune paire au N°999 »`);
        dit(await essai('130', 'vendue') && await pg.evaluate(() => /déjà vendu/.test(document.querySelector('[data-ia-etat="vendue"]')?.textContent || '') && !document.querySelector('[data-ia-prix]')), `${TT} N°130 vendu sur Vinted (à envoyer) ⇒ refus clair, aucun prix demandé`);
        await capture(pg, `refus-vendue-${suf}.png`);
        dit(await essai('125', 'archive'), `${TT} « 125 » : seul « B125 » existe ⇒ proposé, pas pris`);
        await capture(pg, `archive-${suf}.png`);
        await toucher('[data-ia-archive="B125"]');
        dit(await attendre(pg, () => document.querySelector('[data-ia-verdict]')?.getAttribute('data-ia-verdict') === 'possible' && !!document.querySelector('[data-ia-paire="9b25"]'), null, 15000), `${TT} SON toucher prend B125`);
        dit(await essai('88', 'plusieurs') && await pg.evaluate(() => document.querySelectorAll('[data-ia-paire]').length === 2 && document.querySelectorAll('.sb-plaque.is-double').length === 2 && !document.querySelector('[data-ia-prix]')), `${TT} N°88 porté par deux paires ⇒ la question, plaques rouges, aucun prix`, await pg.evaluate(() => JSON.stringify({ v: document.querySelector('[data-ia-verdict]')?.getAttribute('data-ia-verdict'), f: (() => { try { const f = JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'); return [f['9881'] && f['9881'].numero, f['9882'] && f['9882'].numero, f['9882'] && f['9882'].reattribue]; } catch (_) { return null; } })() })));
        const c = await cibles(pg);
        dit(c.length === 0, `${TT} cibles ≥ 44 px (la question)`, c.join(' ; '));
        await capture(pg, `double-${suf}.png`);
        await toucher('[data-ia-paire="9882"]');
        dit(await attendre(pg, () => !!document.querySelector('[data-ia-prix]') && !!document.querySelector('[data-ia-paire="9882"]')), `${TT} SON toucher choisit (9882), puis le prix`);
        await capture(pg, `double-choisie-${suf}.png`);
        dit((await debord(pg)) <= 1, `${TT} aucun débordement`);
      });
      dit(!errs.length, `${TT} aucune erreur de page`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a pu tourner', String(e && e.stack || e).slice(0, 400)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} contrôle(s) en échec — captures : ${SHOTS}` : `\nTout est vert — captures (À REGARDER) : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
