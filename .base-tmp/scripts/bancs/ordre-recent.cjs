// Banc : LE PLUS RÉCENT EN HAUT, TOUS COMPTES MÉLANGÉS (lot AJ, 9 nov. soir).
// Julien : « Les ventes, achats, colis à expédier, à préparer ne sont pas rangés dans l'ordre, du plus
// récent en haut au plus vieux en bas, peu importe le compte, ça doit être parfait. »
// Données INVENTÉES (dépôt public), formes réelles : DEUX comptes Vinted (111 compte_a, 222 compte_b),
// `harvest_{uid}_orders_sold|purchased` (`my_orders`, `date` ISO), bordereaux `email_bord_{tx}` lus par
// `meta->>` (avec PDF), colis à retirer `email_track_*` (`available`, `arriveLe`). Les dates sont posées
// pour que TOUT autre ordre se voie : le compte connecté (111) a les ventes les plus anciennes (l'ancien
// « compte en tête » les remontait), les colis à envoyer les plus anciens ont la limite la plus proche
// (l'ancien tri par urgence les remontait), les achats les plus anciens sont « au point relais » (l'ancien
// « étape d'abord » les remontait), le point relais au colis le plus ancien a la limite la plus proche.
// Horloge figée (9 nov. 11 h). 390 tactile SOMBRE et 1512 clair. Jugé sur data-* (§6.4) :
//  V. Ventes (Vinted, et « Tous ») : dates décroissantes, comptes entrelacés, sans date en bas et DIT ;
//  A. Achats : dates décroissantes, comptes entrelacés ;
//  E. Colis → À envoyer : dates de vente décroissantes, aucun groupe par transporteur, pastilles ;
//  P. Préparer mes colis : le même ordre que la liste ;
//  N. Colis → Envoyés : dates décroissantes ;
//  R. Colis → À retirer : arrivées lues décroissantes (les points dans l'ordre de leur arrivée la plus récente) ;
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
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 9083);
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

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, false]]) {
      const k = vp.width + (sombre ? '-sombre' : '-clair');
      console.log(`── ${k}`);
      // ── Ventes (Vinted) ──
      { const { ctx, pg, errs } = await ouvrir(b, vp, { sombre, tab: 'cat_ventes' });
        await essaie('Ventes Vinted', async () => {
          await pg.waitForFunction(() => document.querySelectorAll('[data-tx]').length >= 10, null, { timeout: 30000 }).catch(() => {});
          await pg.waitForTimeout(1200);
          const tx = await pg.evaluate(() => [...new Set([...document.querySelectorAll('[data-tx]')].map((x) => x.getAttribute('data-tx')))]);
          const ts = tx.map(dateDe);
          dit(tx.length >= 10 && decroissant(ts), 'V1 Ventes Vinted : la plus récente en haut, sans date en bas', tx.join(','));
          dit(entrelace(tx.map((t) => COMPTE[t])), 'V2 Ventes Vinted : comptes entrelacés (jamais le compte connecté d’abord)', tx.map((t) => COMPTE[t]).join(''));
          const sd = await pg.evaluate(() => { const e = document.querySelector('[data-sans-date]'); return e ? e.getAttribute('data-sans-date') : null; });
          dit(sd === '1', 'V3 « 1 sans date lue » est dit', String(sd));
          await shot(pg, `ventes-${k}`, '[data-tx]'); await sain(pg, 'Ventes');
          // Un compte CHOISI : il reste net (les autres floutés), mais l'ordre reste la date — jamais lui d'abord.
          await pg.locator('[data-compte-puce="111"]').first().click({ timeout: 5000 });
          await pg.waitForTimeout(900);
          const tx2 = await pg.evaluate(() => [...new Set([...document.querySelectorAll('[data-tx]')].map((x) => x.getAttribute('data-tx')))]);
          dit(tx2.length >= 10 && decroissant(tx2.map(dateDe)) && entrelace(tx2.map((t) => COMPTE[t])), 'V6 compte_a choisi : toujours la date, jamais ses ventes d’abord', tx2.map((t) => COMPTE[t]).join(''));
          await shot(pg, `ventes-compte-${k}`, '[data-tx]');
        });
        dit(errs.length === 0, 'Z. Ventes : aucune erreur de page', errs.join(' | ').slice(0, 200));
        await ctx.close(); }
      // ── Ventes « Tous » ──
      { const { ctx, pg, errs } = await ouvrir(b, vp, { sombre, tab: 'ventes' });
        await essaie('Ventes Tous', async () => {
          await pg.locator('[data-filtre-site] button[data-site="toutes"]').first().click({ timeout: 8000 }).catch(() => {});
          await pg.waitForFunction(() => document.querySelectorAll('[data-toutes-vente]').length >= 10, null, { timeout: 30000 }).catch(() => {});
          await pg.waitForTimeout(800);
          const L = await pg.evaluate(() => [...document.querySelectorAll('[data-toutes-vente]')].map((x) => ({ id: x.getAttribute('data-toutes-id'), t: x.getAttribute('data-ordre-t') })));
          dit(L.length >= 10 && decroissant(L.map((x) => (x.t ? Number(x.t) : null))), 'V4 Ventes « Tous » : la plus récente en haut, sans date en bas', L.map((x) => x.id).join(','));
          dit(entrelace(L.map((x) => COMPTE[x.id])), 'V5 Ventes « Tous » : comptes entrelacés', L.map((x) => COMPTE[x.id]).join(''));
          await shot(pg, `ventes-tous-${k}`, '[data-toutes-vente]');
        });
        dit(errs.length === 0, 'Z. Ventes « Tous » : aucune erreur de page', errs.join(' | ').slice(0, 200));
        await ctx.close(); }
      // ── Achats ──
      { const { ctx, pg, errs } = await ouvrir(b, vp, { sombre, tab: 'achats' });
        await essaie('Achats', async () => {
          await pg.locator('[data-filtre-site] button[data-site="vinted"]').first().click({ timeout: 5000 }).catch(() => {});
          await pg.waitForFunction(() => document.querySelectorAll('[data-achat-tx]').length >= 5, null, { timeout: 30000 }).catch(() => {});
          await pg.waitForTimeout(800);
          const L = await pg.evaluate(() => [...document.querySelectorAll('[data-achat-tx]')].map((x) => ({ id: x.getAttribute('data-achat-tx'), t: x.getAttribute('data-ordre-t') })));
          dit(L.length === 5 && decroissant(L.map((x) => (x.t ? Number(x.t) : null))), 'A1 Achats : le plus récent en haut (pas « au point relais » d’abord)', L.map((x) => x.id).join(','));
          dit(entrelace(L.map((x) => COMPTE[x.id])), 'A2 Achats : comptes entrelacés', L.map((x) => COMPTE[x.id]).join(''));
          await shot(pg, `achats-${k}`, '[data-achat-tx]'); await sain(pg, 'Achats');
          await pg.locator('[data-compte-puce="111"]').first().click({ timeout: 5000 });
          await pg.waitForTimeout(900);
          const L2 = await pg.evaluate(() => [...document.querySelectorAll('[data-achat-tx]')].map((x) => x.getAttribute('data-achat-tx')));
          dit(L2.length === 5 && decroissant(L2.map(dateDe)) && entrelace(L2.map((t) => COMPTE[t])), 'A3 compte_a choisi : toujours la date, jamais ses achats d’abord', L2.map((t) => COMPTE[t]).join(''));
        });
        dit(errs.length === 0, 'Z. Achats : aucune erreur de page', errs.join(' | ').slice(0, 200));
        await ctx.close(); }
      // ── Colis ──
      { const { ctx, pg, errs } = await ouvrir(b, vp, { sombre, tab: 'cat_bord' });
        await essaie('Colis', async () => {
          await pg.waitForSelector('[data-colis-onglet-choix]', { timeout: 30000 });
          await onglet(pg, 'envoyer');
          await pg.waitForFunction(() => document.querySelectorAll('[data-bord-card][data-tx-colis]').length >= 4, null, { timeout: 20000 }).catch(() => {});
          await pg.waitForTimeout(1200);
          const E = await pg.evaluate(() => [...document.querySelectorAll('[data-bord-card][data-tx-colis]')].map((x) => ({ id: x.getAttribute('data-tx-colis'), t: x.getAttribute('data-ordre-t'), j: x.getAttribute('data-jours') })));
          dit(E.map((x) => x.id).join() === '8101,8104,8103,8102', 'E1 À envoyer : la vente la plus récente en haut (plus la limite la plus proche)', E.map((x) => `${x.id}(limite ${x.j} j)`).join(','));
          dit(entrelace(E.map((x) => COMPTE[x.id])), 'E2 À envoyer : comptes entrelacés', E.map((x) => COMPTE[x.id]).join(''));
          const g = await pg.evaluate(() => document.querySelectorAll('[data-groupe-transp]').length);
          dit(g === 0, 'E3 À envoyer : aucun groupe par transporteur qui impose l’ordre', String(g));
          const P = await pg.evaluate(() => [...document.querySelectorAll('[data-envoyer-filtre-choix]')].map((x) => x.getAttribute('data-envoyer-filtre-choix') + ':' + x.getAttribute('data-envoyer-filtre-n')));
          dit(P[0] === 'tous:4' && P.length === 3, 'E4 À envoyer : le transporteur en pastilles (Tous · 4, Chronopost, Mondial Relay)', P.join('|'));
          const amb = await pg.evaluate(() => { const c = document.querySelector('[data-tx-colis="8102"]'); return c ? c.getAttribute('data-limite') : null; });
          dit(!!amb, 'E5 la date limite reste portée par sa carte', String(amb));
          await shot(pg, `envoyer-${k}`, '[data-envoyer-filtres]'); await sain(pg, 'Colis → À envoyer');
          if (P.length > 1) {
            await pg.click(`[data-envoyer-filtre-choix="${P[1].split(':')[0]}"]`).catch(() => {});
            await pg.waitForTimeout(500);
            const F = await pg.evaluate(() => [...document.querySelectorAll('[data-bord-card][data-tx-colis]')].map((x) => x.getAttribute('data-tx-colis')));
            dit(F.length === Number(P[1].split(':')[1]) && decroissant(F.map(dateDe)), 'E6 une pastille filtre, dans le même ordre', F.join(','));
            await pg.click('[data-envoyer-filtre-choix="tous"]').catch(() => {});
            await pg.waitForTimeout(400);
          }
          // Préparer : le même ordre.
          const ouvre = pg.locator('[data-preparer-ouvrir]').first();
          if (await ouvre.count()) {
            await ouvre.click();
            await pg.waitForSelector('[data-preparer-cle]', { timeout: 8000 }).catch(() => {});
            const vus = [];
            for (let i = 0; i < 6; i++) {
              const c = await pg.evaluate(() => { const e = document.querySelector('[data-preparer-cle]'); return e ? e.getAttribute('data-preparer-cle') : null; });
              if (!c || vus.includes(c)) break; vus.push(c);
              await pg.click('[data-preparer-suivant]').catch(() => {}); await pg.waitForTimeout(300);
            }
            dit(vus.join() === 'v:8101,v:8104,v:8103,v:8102', 'P1 Préparer mes colis : l’ordre de la liste (le plus récent d’abord)', vus.join(','));
            await shot(pg, `preparer-${k}`);
            await pg.keyboard.press('Escape').catch(() => {});
            await pg.waitForTimeout(400);
          } else dit(false, 'P1 « Préparer mes colis » est proposé');
          await onglet(pg, 'envoyes');
          await pg.waitForFunction(() => document.querySelectorAll('[data-colis-envoye]').length >= 3, null, { timeout: 15000 }).catch(() => {});
          const N = await pg.evaluate(() => [...document.querySelectorAll('[data-colis-envoye]')].map((x) => ({ id: x.getAttribute('data-colis-envoye'), t: x.getAttribute('data-envoye-quand') })));
          dit(N.length >= 3 && decroissant(N.map((x) => (x.t ? Number(x.t) : null))) && entrelace(N.map((x) => COMPTE[x.id.replace(/\D/g, '')])), 'N1 Envoyés : le plus récent en haut, comptes entrelacés', N.map((x) => x.id).join(','));
          await shot(pg, `envoyes-${k}`);
          await onglet(pg, 'retirer');
          await pg.waitForFunction(() => document.querySelectorAll('[data-cc-dans="retirer"]').length >= 3, null, { timeout: 15000 }).catch(() => {});
          await pg.waitForTimeout(600);
          const R = await pg.evaluate(() => [...document.querySelectorAll('[data-cc-dans="retirer"]')].map((x) => ({ id: x.getAttribute('data-cc-carte'), t: x.getAttribute('data-ordre-t'), hors: x.getAttribute('data-hors-compte') === '1' })));
          const RC = R.filter((x) => !x.hors);
          dit(RC.length === 3 && RC.every((x) => x.t) && RC.map((x) => x.id.replace(/\D/g, '')).join() === '82000002,82000003,82000001', 'R1 À retirer : arrivée la plus récente en haut (le point au colis le plus récent d’abord, un point = une carte)', R.map((x) => x.id + (x.hors ? '(à vérifier)' : '')).join(','));
          dit(R.findIndex((x) => x.hors) < 0 || R.findIndex((x) => x.hors) >= RC.length, 'R2 les « à vérifier » restent sous les colis comptés', R.map((x) => x.id).join(','));
          await shot(pg, `retirer-${k}`, '[data-cc-dans="retirer"]'); await sain(pg, 'Colis → À retirer');
        });
        dit(errs.length === 0, 'Z. Colis : aucune erreur de page', errs.join(' | ').slice(0, 200));
        await ctx.close(); }
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ ordre récent : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ ordre récent : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
srv.listen(PORT);
