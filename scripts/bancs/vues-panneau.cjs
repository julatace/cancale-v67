// Banc : LOT X (10 nov.) — sélection multiple, filtres enregistrés, fiche à côté de la liste.
// Julien a validé : (1) cocher dans Ventes, Colis et Achats, puis les gestes qui EXISTENT déjà en série ;
// (2) nommer une combinaison de filtres et la retrouver en une puce, rangée dans SES données ;
// (3) sur ordinateur (>= 1200 px), la fiche à côté de la liste au lieu d'une feuille.
// Données INVENTÉES (dépôt public), formes réelles (reprises du banc ordre-recent). Jugé sur data-* :
//  S. Ventes : cocher sans ouvrir, « Déposé · N » / « Imprimer · N » comptés sur ce qu'ils touchent, aucun « Masquer » ;
//  A. Achats : « Masquer · N » en un geste annulable ;
//  C. Colis : « Imprimer · N », « Déposé · N » sur CES colis ;
//  F. Filtres enregistrés : rangés dans `vrm_vues_filtres` (clé synchronisée), une puce les rend ;
//  P. >= 1200 px : la fiche ne recouvre pas la liste ; au téléphone rien ne change.
// 390 tactile sombre + 1512 clair (tout), puis 390 clair + 1512 sombre (panneau et rendu).
// Lancer : construire dist/, puis node scripts/bancs/vues-panneau.cjs   (BANC_PORT 9187, SHOTS=dossier)
//  Z. aucune erreur, rien ne déborde, l'écran n'est pas tombé.
// Lancer : construire dist/, puis node scripts/bancs/ordre-recent.cjs   (BANC_PORT 9083, SHOTS=dossier)
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const RACINE = process.env.BANC_RACINE || path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 9187);
const SHOTS = process.env.SHOTS || '';
const maintenant = new Date(2026, 10, 9, 11, 0, 0);
const MS = maintenant.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const jourDans = (j) => { const d = new Date(MS + j * J); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: iso(MS) },
];
const COMPTE = {};
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const fmtLimite = (j) => { const d = new Date(MS + j * J); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} 23:59`; };
// Ventes finalisées : [tx, compte, jours] (null = sans date). Le compte 111 a les plus anciennes.
const FINIES = [[8001, '222', 1], [8002, '111', 6], [8003, '222', 3], [8004, '111', 9], [8005, '222', 7.5], [8006, '111', null], [8007, '111', 2]];
// À envoyer : [tx, compte, jours depuis la vente, jours avant la limite] — le plus ancien a la limite la plus proche.
const AENV = [[8101, '111', 1, 6], [8102, '222', 4, 0], [8103, '111', 3, 1], [8104, '222', 2, 5]];
// Parties (envoyés) : [tx, compte, jours].
const PARTIS = [[8201, '222', 5], [8202, '222', 1], [8203, '111', 2]];
// Achats : [tx, compte, jours, statut] — les plus anciens au point relais.
const ACHATS = [[8301, '222', 1, 'Le colis est en route'], [8302, '111', 2, 'Le colis est en route'], [8303, '222', 5, 'Le colis est disponible au point relais'], [8304, '111', 8, 'Le colis est disponible au point relais'], [8305, '111', 3, 'Commande terminée']];
for (const L of [FINIES, AENV, PARTIS, ACHATS]) for (const x of L) COMPTE[x[0]] = x[1];
const TITRE = 'Nike Dunk Low Panda 42';
const vente = (tx, j, status, tus) => ({ transaction_id: tx, title: TITRE, price: { amount: '90.0', currency_code: 'EUR' }, status, transaction_user_status: tus, ...(j == null ? {} : { date: ilYa(j) }) });
const track = (suivi, lieu, code, jArr, lim) => ({ id: `email_track_mondialrelay_${suivi}`, data: { type: 'suivi', carrier: 'mondialrelay', suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`, receivedAt: ilYa(jArr), emailAt: ilYa(jArr), arriveLe: ilYa(jArr), code, lieu, limite: jourDans(lim), consigne: false, account: '' } });
// À retirer : deux points ; le colis le plus ancien (P1) a la limite la plus proche.
const RETRAITS = [['82000001', 'MAISON DU QUAI, 40 RUE DU QUAI, 35260 CANCALE', '100001', 3, 1], ['82000002', 'Tabac de la Houle, 3 Rue Haute, 35260 Cancale', '100002', 0.5, 5], ['82000003', 'MAISON DU QUAI, 40 RUE DU QUAI, 35260 CANCALE', '100003', 1.5, 4]];
const lignes = () => {
  const par = { '111': { sold: [], purchased: [] }, '222': { sold: [], purchased: [] } };
  for (const [tx, c, j] of FINIES) par[c].sold.push(vente(tx, j, 'Commande terminée', 'completed'));
  for (const [tx, c, j] of AENV) par[c].sold.push(vente(tx, j, 'Bordereau d’envoi envoyé au vendeur', 'needs_action'));
  for (const [tx, c, j] of PARTIS) par[c].sold.push(vente(tx, j, 'Le colis est en route', 'waiting'));
  for (const [tx, c, j, st] of ACHATS) par[c].purchased.push({ ...vente(tx, j, st, /terminée/.test(st) ? 'completed' : 'waiting') });
  return [
    { id: 'main', data: {} },
    ...['111', '222'].flatMap((u) => [
      { id: `harvest_${u}_orders_sold`, data: { capturedAt: iso(MS - 600e3), payload: { my_orders: par[u].sold } } },
      { id: `harvest_${u}_orders_purchased`, data: { capturedAt: iso(MS - 600e3), payload: { my_orders: par[u].purchased } } },
    ]),
    ...AENV.map(([tx, c, j, lim]) => ({ id: 'email_bord_' + tx, data: { type: 'bordereau', transaction: String(tx), uid: c, account: c === '111' ? 'compte_a' : 'compte_b', filename: `Bordereau-Vinted-${tx}.pdf`, modele: TITRE, article: TITRE, receivedAt: ilYa(j - 0.1), pdfB64: PDF_B64, suivi: '', transporteur: tx % 2 ? 'mondialrelay' : 'chronopost', dateLimite: fmtLimite(lim) } })),
    ...RETRAITS.map(([s, l, c, j, lim]) => track(s, l, c, j, lim)),
  ];
};
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = iso(MS); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};
async function ouvrir(b, vp, { sombre = false, tab = 'cat_bord' } = {}) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const LIGNES = lignes();
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(({ sombre }) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); } catch (_) {}
  }, { sombre });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font', 'script'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const h = { 'access-control-allow-origin': '*' };
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: h, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: h, body: '[]' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: h, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || iso(MS), cap: r.data.capturedAt });
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, tel };
}
const onglet = async (pg, v) => {
  await pg.click(`[data-colis-onglet-choix="${v}"]`).catch(() => {});
  await pg.waitForFunction((x) => { const e = document.querySelector('[data-colis-onglet]'); return e && e.getAttribute('data-colis-onglet') === x; }, v, { timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(700);
};
const shot = async (pg, nom, sel = '') => { if (!SHOTS) return; if (sel) await pg.evaluate((q) => { const e = document.querySelector(q); if (e) e.scrollIntoView({ block: 'start' }); }, sel).catch(() => {}); await pg.waitForTimeout(200); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); };
const sain = async (pg, ecran) => {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
};
// Les dates rendues dans l'ordre affiché : décroissantes, les vides en bas.
const decroissant = (ts) => { let vu = false; for (let i = 0; i < ts.length; i++) { if (ts[i] == null) { vu = true; continue; } if (vu) return false; if (i && ts[i - 1] != null && ts[i] > ts[i - 1]) return false; } return true; };
const entrelace = (cs) => { let changes = 0; for (let i = 1; i < cs.length; i++) if (cs[i] !== cs[i - 1]) changes++; return changes >= 2; };
const dateDe = (tx) => { for (const L of [FINIES, AENV, PARTIS, ACHATS]) { const x = L.find((y) => y[0] === Number(tx)); if (x) return x[2] == null ? null : MS - x[2] * J; } return null; };

const lireLS = (pg, k) => pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }, k);
const attendre = (pg, f, arg, ms = 8000) => pg.waitForFunction(f, arg, { timeout: ms }).catch(() => {});
const barre = (pg, ecran) => pg.evaluate((e) => { const b = document.querySelector(`[data-selection-barre="${e}"]`); if (!b) return null;
  return { n: b.getAttribute('data-selection-n'), gestes: Object.fromEntries([...b.querySelectorAll('[data-selection-geste]')].map((x) => [x.getAttribute('data-selection-geste'), Number(x.getAttribute('data-selection-geste-n'))])),
    sans: (b.querySelector('[data-selection-sans-geste]') || { getAttribute: () => '0' }).getAttribute('data-selection-sans-geste') }; }, ecran);
const nommer = async (pg, nom) => {
  await pg.click('[data-vue-enregistrer]');
  await pg.waitForSelector('[data-ask-champ="vue-filtres-nom"]', { timeout: 5000 });
  await pg.fill('[data-ask-champ="vue-filtres-nom"]', nom);
  await pg.press('[data-ask-champ="vue-filtres-nom"]', 'Enter');
  await pg.waitForTimeout(900);
};
const vuesLues = async (pg) => { const m = await lireLS(pg, 'vrm_vues_filtres'); return m && typeof m === 'object' ? Object.values(m) : []; };
// La fiche est-elle À CÔTÉ de la liste (rien de recouvert) ?
const aCote = (pg, liste, fiche) => pg.evaluate(([l, f]) => { const a = document.querySelector(l), b = document.querySelector(f); if (!a || !b) return null;
  a.scrollIntoView({ block: 'center' });
  const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
  // VISIBLE, pas seulement placée : le point au milieu de la ligne est bien la ligne (aucun voile, aucun sol opaque dessus).
  const x = ra.left + Math.min(ra.width / 2, 200), y = Math.max(ra.top + 8, Math.min(innerHeight - 8, ra.top + Math.min(ra.height / 2, 30)));
  const el = document.elementFromPoint(x, y);
  return { listeDroite: Math.round(ra.right), ficheGauche: Math.round(rb.left), ficheL: Math.round(rb.width), vue: !!(el && a.contains(el)) }; }, [liste, fiche]);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, false], [{ width: 390, height: 844 }, false], [{ width: 1512, height: 950 }, true]]) {
      const k = vp.width + (sombre ? '-sombre' : '-clair');
      const large = vp.width >= 1200;
      const complet = (vp.width === 390 && sombre) || (vp.width === 1512 && !sombre);
      console.log(`── ${k}`);
      // ── VENTES ──
      { const { ctx, pg, errs } = await ouvrir(b, vp, { sombre, tab: 'cat_ventes' });
        await essaie('Ventes', async () => {
          await attendre(pg, () => document.querySelectorAll('[data-tx]').length >= 10, null, 30000);
          await pg.waitForTimeout(1000);
          if (complet) {
          // S. Sélection multiple
          await pg.click('[data-selection-entree="ventes"]');
          await attendre(pg, () => document.querySelector('[data-selection-mode="ventes"] [data-sel-cle]'));
          for (const tx of ['8101', '8102', '8001']) await pg.click(`[data-sel-cle="${tx}"]`, { position: { x: 120, y: 20 } });
          await pg.waitForTimeout(400);
          const ouvert = await pg.evaluate(() => document.querySelectorAll('[data-ligne-ouverte="true"]').length);
          const r = await barre(pg, 'ventes');
          dit(r && r.n === '3', 'S1 Ventes : trois lignes touchées = trois cochées', JSON.stringify(r));
          dit(ouvert === 0, 'S2 en mode sélection, toucher une vente ne l’ouvre pas', String(ouvert));
          dit(r && r.gestes.depose === 2 && r.gestes.imprimer === 2 && r.sans === '1' && !('masquer' in r.gestes), 'S3 « Déposé · 2 », « Imprimer · 2 », la finalisée sans geste DITE, aucun « Masquer » (ventes jamais masquées)', JSON.stringify(r && r.gestes) + ' sans ' + (r && r.sans));
          await shot(pg, `ventes-selection-${k}`, '[data-selection-mode="ventes"]');
          await pg.click('[data-selection-geste="depose"]');
          await pg.waitForTimeout(1200);
          const sd = (await lireLS(pg, 'vinted_ship_done')) || {};
          dit(!!sd['8101'] && !!sd['8102'] && !sd['8001'], 'S4 « Déposé · 2 » pose « Colis fait » sur CES deux ventes (n° de transaction), rien d’autre', Object.keys(sd).join(','));
          await pg.click('[data-selection-entree="ventes"]');
          await pg.waitForTimeout(400);
          // F. Filtres enregistrés
          await pg.locator('button', { hasText: /^Finalisées$/ }).first().click();
          await pg.waitForTimeout(500);
          await nommer(pg, 'Finies');
          const v = await vuesLues(pg);
          dit(v.length === 1 && v[0].e === 'ventes' && v[0].f.site === 'vinted' && v[0].f.etat === 'finalisees' && v[0].nom === 'Finies', 'F1 la combinaison est rangée dans SES données synchronisées (vrm_vues_filtres)', JSON.stringify(v));
          await pg.locator('button', { hasText: /^Toutes$/ }).first().click();
          await pg.waitForTimeout(500);
          const avant = await pg.evaluate(() => { const p = document.querySelector('[data-vue-puce]'); return p ? p.getAttribute('aria-pressed') : null; });
          await pg.click('[data-vue-puce]');
          await pg.waitForTimeout(900);
          const apres = await pg.evaluate(() => ({ puce: (document.querySelector('[data-vue-puce]') || { getAttribute: () => null }).getAttribute('aria-pressed'),
            fin: [...document.querySelectorAll('button[aria-pressed]')].some((x) => x.textContent.trim() === 'Finalisées' && x.getAttribute('aria-pressed') === 'true') }));
          dit(avant === 'false' && apres.puce === 'true' && apres.fin, 'F2 une puce rend les filtres en UN toucher (« Finalisées » de nouveau appuyé)', `${avant} → ${JSON.stringify(apres)}`);
          await shot(pg, `ventes-filtres-${k}`, '[data-vues-filtres]');
          await pg.locator('button', { hasText: /^Toutes$/ }).first().click();
          await pg.waitForTimeout(600);
          }
          // P. La fiche à côté (ordinateur seulement)
          await pg.evaluate(() => window.scrollTo(0, 0));
          await pg.keyboard.press('Escape').catch(() => {});
          const t1 = pg.locator('.vrm-ventes-liste .vrm-ledger-sale-toggle').first();
          await t1.scrollIntoViewIfNeeded();
          await t1.click({ timeout: 8000 }).catch(async (e) => { await shot(pg, `ventes-panneau-echec-${k}`); throw e; });
          await pg.waitForTimeout(700);
          const pan = await pg.evaluate(() => document.documentElement.getAttribute('data-panneau-fiche'));
          if (large) {
            const c = await aCote(pg, '[data-panneau-ligne="1"]', '.vrm-ledger-drawer-host:not([hidden]) .vrm-ledger-drawer');
            dit(pan === 'ventes' && c && c.vue && c.listeDroite <= c.ficheGauche, 'P1 Ventes (≥ 1200 px) : la fiche est À CÔTÉ, la liste n’est pas recouverte', JSON.stringify(c));
            await pg.mouse.click(400, 300); await pg.waitForTimeout(400);
            const toujours = await pg.evaluate(() => !!document.querySelector('.vrm-ledger-drawer-host:not([hidden])'));
            dit(toujours, 'P2 un toucher dans la liste ne ferme pas la fiche d’à côté');
            await shot(pg, `ventes-panneau-${k}`);
            await pg.click('.vrm-ledger-drawer-host:not([hidden]) [aria-label^="Fermer"], .vrm-ledger-drawer-host:not([hidden]) .vrm-recap-fermer').catch(() => pg.keyboard.press('Escape'));
          } else dit(pan == null, 'P1 téléphone : la vente s’ouvre en feuille, pas en panneau', String(pan));
          await sain(pg, 'Ventes');
        });
        dit(errs.length === 0, 'Z. Ventes : aucune erreur de page', errs.join(' | ').slice(0, 200));
        await ctx.close(); }
      // ── ACHATS ──
      { const { ctx, pg, errs } = await ouvrir(b, vp, { sombre, tab: 'achats' });
        await essaie('Achats', async () => {
          await pg.locator('[data-filtre-site] button[data-site="vinted"]').first().click({ timeout: 5000 }).catch(() => {});
          await attendre(pg, () => document.querySelectorAll('[data-achat-tx]').length >= 5, null, 30000);
          await pg.waitForTimeout(800);
          if (complet) {
          await pg.click('[data-selection-entree="achats"]');
          await attendre(pg, () => document.querySelector('[data-selection-mode="achats"] [data-sel-cle]'));
          await pg.click('[data-sel-cle="8301"]', { position: { x: 200, y: 20 } });
          await pg.click('[data-sel-cle="8302"] .vrm-sel-case-hote');
          await pg.waitForTimeout(300);
          const r = await barre(pg, 'achats');
          dit(r && r.n === '2' && r.gestes.masquer === 2, 'A1 Achats : deux cochés (ligne ou case), « Masquer · 2 »', JSON.stringify(r));
          const menu = await pg.evaluate(() => document.querySelectorAll('[role="menu"]').length);
          dit(menu === 0, 'A2 en mode sélection, toucher une ligne n’ouvre aucun menu', String(menu));
          await shot(pg, `achats-selection-${k}`, '[data-selection-mode="achats"]');
          await pg.click('[data-selection-geste="masquer"]');
          await pg.waitForTimeout(1200);
          const reste = await pg.evaluate(() => [...document.querySelectorAll('[data-achat-tx]')].map((x) => x.getAttribute('data-achat-tx')));
          const masques = await lireLS(pg, 'vinted_purchases_hidden');
          dit(!reste.includes('8301') && !reste.includes('8302') && reste.length === 3, 'A3 « Masquer · 2 » masque CES deux achats, en un geste', reste.join(','));
          const annuler = pg.locator('button', { hasText: /^Annuler$/ }).first();
          if (await annuler.count()) { await annuler.click(); await pg.waitForTimeout(1200);
            const r2 = await pg.evaluate(() => [...document.querySelectorAll('[data-achat-tx]')].map((x) => x.getAttribute('data-achat-tx')));
            dit(r2.includes('8301') && r2.includes('8302'), 'A4 « Annuler » rend les deux achats', r2.join(',') + ' ' + JSON.stringify(masques)); }
          else dit(false, 'A4 la pilule « Annuler » est proposée');
          await pg.click('[data-selection-entree="achats"]');
          await pg.waitForTimeout(300);
          }
          await pg.click('[data-achat-tx="8303"] .vrm-buy-title');
          await pg.waitForTimeout(600);
          const f = await pg.evaluate(() => !!document.querySelector('[data-panneau-fiche="achats"]'));
          if (large) {
            const c = await aCote(pg, '[data-achat-tx="8303"]', '.vrm-panneau-fiche');
            dit(f && c && c.vue && c.listeDroite <= c.ficheGauche, 'P3 Achats (≥ 1200 px) : la fiche de l’achat À CÔTÉ de la liste', JSON.stringify(c));
            const etat = await pg.evaluate(() => (document.querySelector('[data-fiche-achat-cote="8303"] [data-fiche-etat]') || {}).textContent || '');
            dit(!!etat, 'P4 la fiche est celle de l’achat touché (son n° de transaction), avec son état', etat);
            await shot(pg, `achats-panneau-${k}`);
            await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
            dit(!(await pg.evaluate(() => !!document.querySelector('.vrm-panneau-fiche'))), 'P5 Échap ferme la fiche');
          } else dit(!f, 'P3 téléphone : aucun panneau (rien ne change)');
          await sain(pg, 'Achats');
        });
        dit(errs.length === 0, 'Z. Achats : aucune erreur de page', errs.join(' | ').slice(0, 200));
        await ctx.close(); }
      // ── COLIS ──
      { const { ctx, pg, errs } = await ouvrir(b, vp, { sombre, tab: 'cat_bord' });
        await essaie('Colis', async () => {
          await pg.waitForSelector('[data-colis-onglet-choix]', { timeout: 30000 });
          await onglet(pg, 'envoyer');
          await attendre(pg, () => document.querySelectorAll('[data-bord-card][data-tx-colis]').length >= 4, null, 20000);
          await pg.waitForTimeout(1000);
          if (complet) {
          await pg.click('[data-selection-entree="colis"]');
          await attendre(pg, () => document.querySelector('[data-bord-card][data-sel-cle]'));
          await pg.click('[data-sel-cle="8101"]', { position: { x: 200, y: 30 } });
          await pg.click('[data-sel-cle="8104"]', { position: { x: 200, y: 30 } });
          await pg.waitForTimeout(300);
          const r = await barre(pg, 'colis');
          dit(r && r.n === '2' && r.gestes.depose === 2 && r.gestes.imprimer === 2, 'C1 Colis : deux colis cochés, « Imprimer · 2 » et « Déposé · 2 »', JSON.stringify(r));
          await shot(pg, `colis-selection-${k}`, '[data-selection-mode-hote]');
          await pg.click('[data-selection-geste="depose"]');
          await pg.waitForTimeout(1200);
          const sd = (await lireLS(pg, 'vinted_ship_done')) || {};
          dit(!!sd['8101'] && !!sd['8104'] && !sd['8102'] && !sd['8103'], 'C2 « Déposé · 2 » sur CES deux colis seulement', Object.keys(sd).join(','));
          await pg.click('[data-selection-entree="colis"]');
          // Filtres : l'onglet « Envoyés » en une puce.
          await onglet(pg, 'envoyes');
          await nommer(pg, 'Partis');
          await onglet(pg, 'envoyer');
          await pg.click('[data-vue-puce]');
          await attendre(pg, () => (document.querySelector('[data-colis-onglet]') || {}).getAttribute && document.querySelector('[data-colis-onglet]').getAttribute('data-colis-onglet') === 'envoyes');
          const og = await pg.evaluate(() => document.querySelector('[data-colis-onglet]').getAttribute('data-colis-onglet'));
          const v = await vuesLues(pg);
          dit(og === 'envoyes' && v.some((x) => x.e === 'colis' && x.f.etat === 'envoyes'), 'F3 Colis : la puce « Partis » rouvre l’onglet Envoyés', og + ' ' + JSON.stringify(v));
          await onglet(pg, 'envoyer');
          }
          await pg.click('[data-bord-card][data-tx-colis="8103"]', { position: { x: 120, y: 20 } });
          await pg.waitForTimeout(600);
          const f = await pg.evaluate(() => !!document.querySelector('[data-panneau-fiche="colis"]'));
          if (large) {
            const c = await aCote(pg, '[data-bord-card][data-tx-colis="8103"]', '.vrm-panneau-fiche');
            dit(f && c && c.vue && c.listeDroite <= c.ficheGauche && !!(await pg.$('[data-fiche-colis-cote="8103"]')), 'P6 Colis (≥ 1200 px) : la fiche du colis touché À CÔTÉ de la liste', JSON.stringify(c));
            await shot(pg, `colis-panneau-${k}`);
          } else dit(!f, 'P6 téléphone : aucun panneau');
          await sain(pg, 'Colis');
        });
        dit(errs.length === 0, 'Z. Colis : aucune erreur de page', errs.join(' | ').slice(0, 200));
        await ctx.close(); }
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ vues et panneau : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ vues et panneau : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
srv.listen(PORT);
