// ═══════════════════════════════════════════════════════════════════════════
// BANC : « MOIS BOUCLÉ » (lot BK) ET « COMPARER DEUX MOIS » (lot BL) — 10 nov.
//        npm run build && BANC_PORT=… node scripts/bancs/mois-boucle.cjs
// ═══════════════════════════════════════════════════════════════════════════
// La VRAIE app (`dist`), une fausse base qui applique la projection `select=`.
// Données INVENTÉES (le dépôt est public). Le mois bouclé M = le mois d'avant.
// Le geste de la vraie vie : l'écran Ventes, ouvert une fois, PUBLIE le CA déclaré
// (`vinted_urssaf_mois`) et le bénéfice (`vrm_benefice_jours`) — rien n'est posé à
// la main dans ces lignes. Trois jeux :
//   P. tout lu, tout frais, prix d'achat saisis ⇒ « {M} est prêt à déclarer » et le
//      montant = la prévision URSSAF du même mois (daté au VERSEMENT : la vente
//      vendue le mois d'avant et versée en M y est) ;
//   R. le même, mais le compte paris_kicks pas relu depuis 3 jours ⇒ JAMAIS « prêt »,
//      « 1 » compte à relire (nommé), la porte ouvre Comptes liés ;
//   D. une vente finalisée sans date de versement et un prix d'achat pas saisi ⇒
//      « à dater 1 », « prix 1 », les portes ouvrent « Vendu et reçu » et Annonces.
// Comparer (Statistiques) : deux sélecteurs ; M face au mois d'avant : vendu (date de
// vente), reçu (date de VERSEMENT), ventes, achats (registre), flèche GRISE, aucune
// flèche sur un « au moins » (jeu D : reçu au moins).
// Partout : 390 px tactile et 1512 px, clair ET sombre ; aucune erreur, aucun
// débordement, cibles ≥ 44 px, aucune couleur rouge/verte, jamais « encaissé ».
// `SHOTS=dossier` : les captures à REGARDER (§6.2). `JEUX=P,R,D` restreint.
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); } catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4617;
const SHOTS = process.env.SHOTS || '';
const JEUX = String(process.env.JEUX || 'P,R,D').split(',');
process.env.TZ = 'Europe/Paris';
const ATTENDUE = (/const EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1];

const MAINT = new Date();
const iso = (d) => new Date(d).toISOString();
const ilYa = (ms) => iso(Date.now() - ms);
const H = 3600e3, J = 864e5;
const jourM = (k, j, h = 12) => new Date(MAINT.getFullYear(), MAINT.getMonth() + k, j, h);   // k = -1 : le mois M
const ymDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const YM_M = ymDe(jourM(-1, 1)), YM_AVANT = ymDe(jourM(-2, 1));
const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const NOM_M = (() => { const n = MOIS_FR[jourM(-1, 1).getMonth()]; return n.charAt(0).toUpperCase() + n.slice(1); })();

const accounts = [
  { id: 1, vinted_user_id: '111', login: 'atelier_sneak', domain: 'www.vinted.fr', updated_at: iso(MAINT), created_at: iso(jourM(-3, 1)), owner: null },
  { id: 2, vinted_user_id: '222', login: 'paris_kicks', domain: 'www.vinted.fr', updated_at: iso(MAINT), created_at: iso(jourM(-3, 1)), owner: null },
];
// [compte, tx, prix, date de vente, date de versement (null = à dater), prix d'achat saisi]
const VENTES_BASE = [
  ['111', 91001, 120, jourM(-1, 3), jourM(-1, 8), 60],
  ['222', 91002, 80, jourM(-1, 10), jourM(-1, 15), 35],
  ['111', 91003, 60, jourM(-2, 25), jourM(-1, 2), 25],      // vendue le mois d'avant, VERSÉE en M
];
// Les achats (registre) : deux en M, un annulé en M, aucun le mois d'avant.
const ACHATS = [
  { transaction_id: 70001, title: 'Achat inventé A', price: { amount: '40', currency_code: 'EUR' }, status: 'Commande finalisée', date: iso(jourM(-1, 4)) },
  { transaction_id: 70002, title: 'Achat inventé B', price: { amount: '30', currency_code: 'EUR' }, status: 'Commande finalisée', date: iso(jourM(-1, 18)) },
  { transaction_id: 70003, title: 'Achat inventé C', price: { amount: '25', currency_code: 'EUR' }, status: 'Commande annulée', date: iso(jourM(-1, 20)) },
];
const jeu = (nom) => {
  const ventes = VENTES_BASE.map((v) => [...v]);
  if (nom === 'D') { ventes.push(['222', 91005, 50, jourM(-1, 22), null, 20]); ventes.find((v) => v[1] === 91002)[5] = null; }
  const ageCompte = { '111': 20 * 60e3, '222': nom === 'R' ? 3 * J : 30 * 60e3 };
  const rows = [];
  for (const a of accounts) {
    const uid = a.vinted_user_id, cap = ilYa(ageCompte[uid]);
    rows.push({ id: `harvest_${uid}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: ventes.filter((v) => v[0] === uid).map((v) => ({ transaction_id: v[1], id: v[1], title: 'Baskets inventées ' + v[1], price: { amount: String(v[2]), currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(v[3]) })) } } });
    rows.push({ id: `harvest_${uid}_orders_purchased`, data: { capturedAt: cap, payload: { my_orders: uid === '111' ? ACHATS : [] } } });
    rows.push({ id: `harvest_${uid}_listings`, data: { capturedAt: cap, payload: { items: [] } } });
    rows.push({ id: `harvest_${uid}_profile`, data: { capturedAt: cap, payload: {} } });
    rows.push({ id: `harvest_${uid}_billing`, data: { capturedAt: cap, payload: { escrow: { amount: '0.0' }, main: { amount: '0.0' } } } });
  }
  for (const v of ventes) if (v[4]) rows.push({ id: `harvest_${v[0]}_txn_${v[1]}`, data: { capturedAt: ilYa(60e3), payload: { transaction: { id: v[1], item_id: v[1] + 500000, status: 450, status_title: 'Commande finalisée', status_updated_at: iso(v[4]) } } } });
  rows.push({ id: 'lbc_ventes', data: { ventes: {} } }, { id: 'ebay_orders', data: { orders: [] } }, { id: 'vc_ventes', data: { ventes: {} } });
  rows.push({ id: 'panel_comptes_etat', data: { comptes: {} } });
  rows.push({ id: 'ext_appareil_0f1e2d3c4b5a6978', data: { v: 1, appareil: { paquet: 'chromium', nav: 'chrome', systeme: 'mac' }, ver: ATTENDUE, code: ATTENDUE, at: ilYa(5 * 60e3), atMs: Date.now() - 5 * 60e3, flux: { vinted: { okAt: Date.now() - 5 * 60e3, koAt: null, refus: [] } }, vus: {} } });
  rows.push({ id: 'panel_diag_capture', data: { ver: ATTENDUE, verCode: ATTENDUE, majAt: ilYa(5 * 60e3), n: {}, rates: {} } });
  const ov = {};
  for (const v of ventes) if (v[5] != null) ov[String(v[1])] = { buyPrice: v[5] };
  const main = { vinted_regime: 'micro', vinted_urssaf_freq: 'mensuel', vrm_urssaf_declare: {}, vinted_sale_overrides: ov, vrm_compta: { depenses: [], abonnements: [], fixes: [], packs: [] } };
  const recuM = ventes.filter((v) => v[4] && ymDe(v[4]) === YM_M).reduce((t, v) => t + v[2], 0);
  const venduM = ventes.filter((v) => ymDe(v[3]) === YM_M).reduce((t, v) => t + v[2], 0);
  const venduAvant = ventes.filter((v) => ymDe(v[3]) === YM_AVANT).reduce((t, v) => t + v[2], 0);
  return { rows, main, recuM, venduM, venduAvant, nM: ventes.filter((v) => ymDe(v[3]) === YM_M).length, nAvant: ventes.filter((v) => ymDe(v[3]) === YM_AVANT).length };
};

function projette(row, select) {
  if (!select || select === '*') return row;
  const out = {};
  for (const part of select.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'updated_at') { out[alias] = row.updated_at || null; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    const texte = /->>[^>]*$/.test(src);
    let v = row.data; for (const seg of src.replace(/^(data|meta)(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    if (texte && v != null && typeof v !== 'string') v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias] = v == null ? null : v;
  }
  return out;
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.onnx': 'application/octet-stream', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });

let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + String(d).slice(0, 400) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).split('\n')[0].slice(0, 200)); } };

async function contexte(b, T, J0) {
  const ctx = await b.newContext({ viewport: T.vp, isMobile: !!T.isMobile, hasTouch: !!T.hasTouch, timezoneId: 'Europe/Paris', colorScheme: T.sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const etat = { main: JSON.parse(JSON.stringify(J0.main)) };
  await pg.addInitScript((s) => { try { if (!sessionStorage.getItem('banc_init')) { sessionStorage.setItem('banc_init', '1'); localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); } } catch (_) {} }, !!T.sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') {
      try { const corps = JSON.parse(route.request().postData() || 'null'); for (const x of [].concat(corps || [])) if (x && x.id === 'main' && x.data && typeof x.data === 'object') etat.main = x.data; } catch (_) {}
      return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    }
    if (/select=owner/.test(u) && !/vinted_accounts/.test(u)) return j([{ owner: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' }]);
    const S = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: etat.main }, S)]);
    if (eq) return j(J0.rows.filter((r) => r.id === eq[1]).map((r) => projette(r, S)));
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/"/g, '')); return j(J0.rows.filter((r) => ids.includes(r.id)).map((r) => projette(r, S))); }
    const lk = /[?&]id=like\.([^&]*)/.exec(u); if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(J0.rows.filter((r) => re.test(r.id)).map((r) => projette(r, S))); }
    return j([]);
  });
  await pg.route('**/api/**', (r2) => r2.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  return { ctx, pg, errs };
}
const aller = async (pg, tab, repere, ms = 1500) => {
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  if (repere) await pg.waitForFunction((r) => document.querySelector(r) || /pas pu s'afficher/.test(document.body.innerText), repere, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(ms);
};
const attrs = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const o = {}; for (const a of e.getAttributeNames()) if (a.startsWith('data-')) o[a.slice(5)] = e.getAttribute(a); return o; }, sel);
const lignesMb = (pg) => pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-mb-ligne]')].map((e) => [e.getAttribute('data-mb-ligne'), { etat: e.getAttribute('data-mb-ligne-etat'), n: e.getAttribute('data-mb-n'), porte: e.hasAttribute('data-mb-porte'), txt: e.innerText.replace(/\s+/g, ' ').trim() }])));
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const petits = (pg, sel) => pg.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return { t: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 30), h: Math.round(r.height) }; }).filter((x) => x.h < 44), sel);
// Une couleur rouge ou verte (§7 : rouge seulement pour deux paires sous un N° ; la comparaison est neutre).
const couleurs = (pg, sel) => pg.evaluate((s) => {
  const out = [];
  for (const e of document.querySelectorAll(s)) for (const x of [e, ...e.querySelectorAll('*')]) {
    const cs = getComputedStyle(x);
    for (const c of [cs.color, cs.backgroundColor]) { const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/.exec(c); if (!m || (m[4] != null && Number(m[4]) === 0)) continue; const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])]; if ((r > 180 && g < 90 && b < 90) || (g > 150 && r < 110 && b < 130)) out.push(c); }
  }
  return [...new Set(out)];
}, sel);
const motsParBloc = (pg, sel) => pg.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.innerText.replace(/\s+/g, ' ').trim()).filter((t) => t.split(' ').length > 12), sel);
const capture = async (pg, nom, sel) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); const e = sel ? await pg.$(sel) : null; if (e) { await e.scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(200); await e.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {}); } else await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); };
const attendreMb = (pg) => pg.waitForFunction(() => { const e = document.querySelector('[data-mois-boucle]'); return e && e.getAttribute('data-mb-etat') !== 'encours'; }, null, { timeout: 40000 }).catch(() => {});

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  const TAILLES = [
    { nom: '390-clair', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true, sombre: false },
    { nom: '390-sombre', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true, sombre: true },
    { nom: '1512-clair', vp: { width: 1512, height: 950 }, sombre: false },
    { nom: '1512-sombre', vp: { width: 1512, height: 950 }, sombre: true },
  ];
  console.log(`Mois bouclé : ${YM_M} (${NOM_M}) ; le mois d'avant : ${YM_AVANT}`);
  for (const nomJeu of JEUX) {
    const J0 = jeu(nomJeu);
    const tailles = nomJeu === 'P' ? TAILLES : TAILLES.filter((t) => t.nom === '390-sombre' || t.nom === '1512-clair');
    for (const T of tailles) {
      const nom = `${nomJeu} ${T.nom}`;
      console.log(`── ${nom}`);
      const { ctx, pg, errs } = await contexte(b, T, J0);
      // Le geste de la vraie vie : Ventes publie le CA déclaré et le bénéfice.
      await essaie(`Ventes ${nom}`, () => aller(pg, 'cat_ventes', '.vrm-main', 5000));
      await essaie(`BK ${nom}`, async () => {
        await aller(pg, 'argent_declarer', '[data-mois-boucle]', 800);
        await attendreMb(pg);
        const A = await attrs(pg, '[data-mois-boucle]');
        const Lg = await lignesMb(pg);
        const prev = await attrs(pg, '[data-prevision-carte]');
        dit(A && A['mois-boucle'] === YM_M, `${nom} : Mois bouclé est dans Déclarer, sur ${YM_M} (le dernier mois fini)`, JSON.stringify(A));
        if (nomJeu === 'P') {
          dit(A && A['mb-etat'] === 'pret', `${nom} : tout lu, tout réglé ⇒ « prêt »`, JSON.stringify({ A, Lg }));
          dit(A && Number(A['mb-a-declarer'] || A['mb-montant']) === J0.recuM * 100, `${nom} : à déclarer = ${J0.recuM} € (daté au VERSEMENT : la vente du mois d'avant versée en ${NOM_M} y est)`, JSON.stringify(A));
          dit(prev && Math.round(Number(prev['prevision-ca']) * 100) === Number(A['mb-montant']), `${nom} : le même montant que la prévision URSSAF (une règle)`, JSON.stringify({ prev: prev && prev['prevision-ca'], mb: A && A['mb-montant'] }));
          const txt = await pg.evaluate(() => (document.querySelector('[data-mois-boucle]') || {}).innerText || '');
          dit(new RegExp(`${NOM_M} est prêt à déclarer`).test(txt), `${nom} : « ${NOM_M} est prêt à déclarer »`, txt.slice(0, 120));
          dit(['adater', 'prix', 'comptes', 'frais'].every((k) => Lg[k] && Lg[k].etat === 'ok' && Lg[k].n === '0'), `${nom} : les quatre lignes réglées (✓)`, JSON.stringify(Lg));
        }
        if (nomJeu === 'R') {
          dit(A && A['mb-etat'] !== 'pret', `${nom} : un compte pas relu ⇒ JAMAIS « prêt »`, JSON.stringify(A));
          dit(Lg.comptes && Lg.comptes.etat === 'manque' && Lg.comptes.n === '1' && /paris_kicks/.test(Lg.comptes.txt) && Lg.comptes.porte, `${nom} : « Comptes à relire 1 » (paris_kicks), avec sa porte`, JSON.stringify(Lg.comptes));
          dit(!A['mb-montant'], `${nom} : aucun montant « prêt » affiché`, A['mb-montant']);
        }
        if (nomJeu === 'D') {
          dit(A && A['mb-etat'] === 'manque' && A['mb-a-regler'] === '2', `${nom} : 2 choses à régler, pas prêt`, JSON.stringify(A));
          dit(Lg.adater && Lg.adater.etat === 'manque' && Lg.adater.n === '1' && Lg.adater.porte, `${nom} : « Ventes à dater 1 » avec sa porte`, JSON.stringify(Lg.adater));
          dit(Lg.prix && Lg.prix.etat === 'manque' && Lg.prix.n === '1' && Lg.prix.porte, `${nom} : « Prix d’achat à saisir 1 » avec sa porte`, JSON.stringify(Lg.prix));
          dit(Lg.comptes && Lg.comptes.etat === 'ok', `${nom} : comptes relus (✓)`, JSON.stringify(Lg.comptes));
        }
        // Le mois en cours : jamais prêt (pas fini).
        const ymC = `${MAINT.getFullYear()}-${String(MAINT.getMonth() + 1).padStart(2, '0')}`;
        await pg.selectOption('[data-mb-choix]', ymC);
        await attendreMb(pg); await pg.waitForTimeout(200);
        const C = await attrs(pg, '[data-mois-boucle]'); const LC = await lignesMb(pg);
        dit(C && C['mois-boucle'] === ymC && C['mb-etat'] !== 'pret' && LC.fini && LC.fini.etat === 'manque', `${nom} : le mois en cours ⇒ « Mois en cours », jamais prêt`, JSON.stringify({ C, fini: LC.fini }));
        await pg.selectOption('[data-mb-choix]', YM_M); await attendreMb(pg); await pg.waitForTimeout(200);
        dit(T.vp.width > 500 || (await deborde(pg)) <= 1, `${nom} : aucun débordement à 390 px`, String(await deborde(pg)));
        const p44 = await petits(pg, '[data-mois-boucle] button, [data-mois-boucle] select');
        dit(!p44.length, `${nom} : cibles ≥ 44 px`, JSON.stringify(p44));
        dit(!(await couleurs(pg, '[data-mois-boucle]')).length, `${nom} : aucune couleur rouge ni verte`, JSON.stringify(await couleurs(pg, '[data-mois-boucle]')));
        dit(!(await motsParBloc(pg, '[data-mois-boucle] .vrm-mb-etat, [data-mois-boucle] .vrm-mb-porte')).length, `${nom} : ≤ 12 mots par bloc`, JSON.stringify(await motsParBloc(pg, '[data-mois-boucle] .vrm-mb-etat, [data-mois-boucle] .vrm-mb-porte')));
        const txt = await pg.evaluate(() => document.querySelector('.vrm-main').innerText);
        dit(!/encaiss|\bNaN\b|undefined|au moins 0[,\s]*0?0?\s*€/i.test(txt), `${nom} : jamais « encaissé », NaN, « au moins 0 »`);
        await capture(pg, `mb-${nomJeu}-${T.nom}`, '[data-mois-boucle]');
        // Les portes : chacune ouvre l'endroit où régler.
        if (nomJeu === 'R') {
          await pg.click('[data-mb-porte="comptes"]'); await pg.waitForTimeout(1500);
          const vu = await pg.evaluate(() => ({ mb: !!document.querySelector('[data-mois-boucle]') && document.querySelector('[data-mois-boucle]').getClientRects().length > 0, h1: ([...document.querySelectorAll('.vrm-main h1')].find((e) => e.getClientRects().length) || {}).innerText || '' }));
          dit(!vu.mb && vu.h1 && vu.h1 !== 'Argent', `${nom} : la porte « comptes » ouvre ${vu.h1 || '?'}`, JSON.stringify(vu));
        }
        if (nomJeu === 'D') {
          await pg.click('[data-mb-porte="adater"]'); await pg.waitForTimeout(1500);
          const r = await pg.evaluate(() => { const vis = (e) => !!e && e.getClientRects().length > 0; const d = document.getElementById('compta-ca'); return { resume: vis(document.querySelector('[data-argent-vue="resume"]')), ouvert: !!(d && d.open) }; });
          dit(r.resume && r.ouvert, `${nom} : la porte « à dater » ouvre « Vendu et reçu » (Résumé) — rien n'est daté par VRM`, JSON.stringify(r));
          await aller(pg, 'argent_declarer', '[data-mois-boucle]', 600); await attendreMb(pg);
          await pg.click('[data-mb-porte="prix"]'); await pg.waitForTimeout(2000);
          const a = await pg.evaluate(() => ({ mb: !!document.querySelector('[data-mois-boucle]') && document.querySelector('[data-mois-boucle]').getClientRects().length > 0, annonces: !!document.querySelector('[data-ecran="annonces"], [data-annonces], .vrm-annonces') || /Annonces/.test(([...document.querySelectorAll('.vrm-main h1')].find((e) => e.getClientRects().length) || {}).innerText || '') }));
          dit(!a.mb && a.annonces, `${nom} : la porte « prix d’achat » ouvre Annonces (saisie en série)`, JSON.stringify(a));
        }
      });
      await essaie(`BL ${nom}`, async () => {
        await aller(pg, 'dashboard', '[data-comparer]', 2500);
        await pg.selectOption('[data-comparer-mois="a"]', YM_M);
        await pg.selectOption('[data-comparer-mois="b"]', YM_AVANT);
        await pg.waitForFunction(() => { const e = document.querySelector('[data-comparer-ligne="achats"]'); return e && e.getAttribute('data-a') !== ''; }, null, { timeout: 20000 }).catch(() => {});
        await pg.waitForTimeout(400);
        const K = await attrs(pg, '[data-comparer]');
        const L = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-comparer-ligne]')].map((e) => [e.getAttribute('data-comparer-ligne'), { a: e.getAttribute('data-a'), b: e.getAttribute('data-b'), sens: e.getAttribute('data-sens'), ap: e.getAttribute('data-a-partiel'), bp: e.getAttribute('data-b-partiel'), fleche: !!e.querySelector('.vrm-cm-fleche') }])));
        dit(K && K['comparer-a'] === YM_M && K['comparer-b'] === YM_AVANT && K.comparer === 'precedent' && K['comparer-meme-point'] === '0', `${nom} : deux sélecteurs : ${YM_M} et ${YM_AVANT}, deux mois entiers`, JSON.stringify(K));
        dit(Object.keys(L).join(',') === 'vendu,recu,benefice,ventes,achats', `${nom} : vendu, reçu, bénéfice, ventes, achats`, Object.keys(L).join(','));
        dit(L.vendu && Number(L.vendu.a) === J0.venduM * 100 && Number(L.vendu.b) === J0.venduAvant * 100, `${nom} : vendu ${J0.venduM} € face à ${J0.venduAvant} € (date de la VENTE)`, JSON.stringify(L.vendu));
        dit(L.recu && Number(L.recu.a) === J0.recuM * 100 && L.recu.b === '0' || (nomJeu === 'D' && L.recu && L.recu.ap === '1'), `${nom} : reçu ${J0.recuM} € en ${NOM_M}, 0 le mois d'avant (date du VERSEMENT)`, JSON.stringify(L.recu));
        dit(L.ventes && Number(L.ventes.a) === J0.nM && Number(L.ventes.b) === J0.nAvant, `${nom} : ${J0.nM} ventes face à ${J0.nAvant}`, JSON.stringify(L.ventes));
        dit(L.achats && L.achats.a === '2' && L.achats.b === '0', `${nom} : achats 2 face à 0 (le registre des achats : l'annulé n'y est pas)`, JSON.stringify(L.achats));
        dit(L.vendu.sens === 'hausse' && L.vendu.fleche && L.ventes.fleche, `${nom} : flèche (neutre) là où les deux côtés sont sus et complets`, JSON.stringify(L.vendu));
        if (nomJeu === 'D') dit(L.recu.ap === '1' && !L.recu.sens && !L.recu.fleche, `${nom} : reçu « au moins » (une vente à dater) ⇒ aucune flèche`, JSON.stringify(L.recu));
        dit(Object.values(L).every((x) => (x.sens ? x.fleche : !x.fleche)), `${nom} : aucune flèche sans écart`, JSON.stringify(L));
        dit(!(await couleurs(pg, '[data-comparer]')).length, `${nom} : écart neutre — aucune couleur rouge ni verte`, JSON.stringify(await couleurs(pg, '[data-comparer]')));
        const p44 = await petits(pg, '[data-comparer] select');
        dit(!p44.length, `${nom} : les sélecteurs font 44 px`, JSON.stringify(p44));
        dit(T.vp.width > 500 || (await deborde(pg)) <= 1, `${nom} : aucun débordement à 390 px`, String(await deborde(pg)));
        const coupes = await pg.evaluate(() => [...document.querySelectorAll('[data-comparer] .vrm-cm-v b, [data-comparer] .vrm-cm-ecart b, [data-comparer] select')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.innerText || e.value));
        dit(!coupes.length, `${nom} : aucun chiffre coupé`, JSON.stringify(coupes));
        await capture(pg, `cm-${nomJeu}-${T.nom}`, '[data-comparer]');
      });
      dit(!errs.length, `${nom} : aucune erreur de page`, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
  }
  await b.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} banc mois-boucle : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
