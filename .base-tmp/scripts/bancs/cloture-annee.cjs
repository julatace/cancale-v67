// ═══════════════════════════════════════════════════════════════════════════
// BANC : « CLÔTURER L'ANNÉE » (11 nov.)
//        npm run build && BANC_PORT=… node scripts/bancs/cloture-annee.cjs
// ═══════════════════════════════════════════════════════════════════════════
// La VRAIE app (`dist`), une fausse base qui applique la projection `select=`.
// Données INVENTÉES (le dépôt est public). L'horloge de la page est FIXÉE
// (`clock.setFixedTime`) : la liste n'existe que de décembre à mai.
// Le geste de la vraie vie : Ventes, ouvert une fois, PUBLIE le CA déclaré
// (`vinted_urssaf_mois`) et le bénéfice (`vrm_benefice_jours`) — rien n'est posé
// à la main dans ces lignes. Jeux :
//   J. le 15 janvier 2027 : 2026 à clôturer ; une vente de 2026 sans date de
//      versement, un prix d'achat manquant, T1–T3 notés déclarés ⇒ la liste
//      (8 étapes, états constatés), le CA = les versements de 2026, la case 5KO ;
//      la carte « Clôturer 2026 » dans Ma journée, une fois ; les portes (export
//      sur 2026, inventaire) ; « J'ai fini » (confirmé) range l'année.
//   F. le 10 février 2027 : la liste est là, plus la carte de Ma journée.
//   N. le 11 novembre 2026 : rien (ni liste ni carte).
// 390 px tactile et 1512 px, clair ET sombre ; aucune erreur, aucun débordement,
// cibles ≥ 44 px, aucune couleur rouge/verte, jamais « encaissé ».
// `SHOTS=dossier` : les captures à REGARDER (§6.2).
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); } catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4631;
const SHOTS = process.env.SHOTS || '';
const JEUX = String(process.env.JEUX || 'J,F,N').split(',');
process.env.TZ = 'Europe/Paris';
const ATTENDUE = (/const EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1];
const QUAND = { J: new Date(2027, 0, 15, 10), F: new Date(2027, 1, 10, 10), N: new Date(2026, 10, 11, 10) };
const iso = (d) => new Date(d).toISOString();
const D = (y, m, j, h = 12) => new Date(y, m, j, h);
const accounts = [
  { id: 1, vinted_user_id: '111', login: 'atelier_sneak', domain: 'www.vinted.fr', updated_at: iso(D(2027, 0, 15, 9)), created_at: iso(D(2025, 0, 1)), owner: null },
];
// [tx, prix, date de vente, date de versement (null = à dater), prix d'achat saisi]
const VENTES = [
  [92001, 120, D(2026, 1, 3), D(2026, 1, 8), 60],
  [92002, 80, D(2026, 5, 10), D(2026, 5, 15), null],
  [92003, 60, D(2026, 10, 25), D(2026, 11, 2), 25],
  [92004, 50, D(2026, 11, 28), null, 20],            // vendue en décembre, pas encore datée
];
const CA_2026 = VENTES.filter((v) => v[3] && v[3].getFullYear() === 2026).reduce((t, v) => t + v[1], 0);
const jeu = (nom) => {
  const now = QUAND[nom].getTime();
  const cap = iso(now - 30 * 60e3);
  const rows = [];
  rows.push({ id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: VENTES.map((v) => ({ transaction_id: v[0], id: v[0], title: 'Baskets inventées ' + v[0], price: { amount: String(v[1]), currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(v[2]) })) } } });
  rows.push({ id: 'harvest_111_orders_purchased', data: { capturedAt: cap, payload: { my_orders: [] } } });
  rows.push({ id: 'harvest_111_listings', data: { capturedAt: cap, payload: { items: [] } } });
  rows.push({ id: 'harvest_111_profile', data: { capturedAt: cap, payload: {} } });
  rows.push({ id: 'harvest_111_billing', data: { capturedAt: cap, payload: { escrow: { amount: '0.0' }, main: { amount: '0.0' } } } });
  for (const v of VENTES) if (v[3]) rows.push({ id: `harvest_111_txn_${v[0]}`, data: { capturedAt: cap, payload: { transaction: { id: v[0], item_id: v[0] + 500000, status: 450, status_title: 'Commande finalisée', status_updated_at: iso(v[3]) } } } });
  rows.push({ id: 'lbc_ventes', data: { ventes: {} } }, { id: 'ebay_orders', data: { orders: [] } }, { id: 'vc_ventes', data: { ventes: {} } });
  rows.push({ id: 'panel_comptes_etat', data: { comptes: {} } });
  rows.push({ id: 'ext_appareil_0f1e2d3c4b5a6978', data: { v: 1, appareil: { paquet: 'chromium', nav: 'chrome', systeme: 'mac' }, ver: ATTENDUE, code: ATTENDUE, at: cap, atMs: now - 5 * 60e3, flux: { vinted: { okAt: now - 5 * 60e3, koAt: null, refus: [] } }, vus: {} } });
  rows.push({ id: 'panel_diag_capture', data: { ver: ATTENDUE, verCode: ATTENDUE, majAt: cap, n: {}, rates: {} } });
  const ov = {};
  for (const v of VENTES) if (v[4] != null) ov[String(v[0])] = { buyPrice: v[4] };
  const decl = {}; for (let m = 1; m <= 9; m++) decl[`2026-${String(m).padStart(2, '0')}`] = { ids: [], ca: 0, at: iso(D(2026, m, 5)) };
  const main = { vinted_regime: 'micro', vinted_urssaf_freq: 'trimestriel', vrm_urssaf_declare: decl, vrm_micro_options: { liberatoire: 'non', acre: false, at: now - J },
    vinted_sale_overrides: ov, vrm_compta: { depenses: [], abonnements: [], fixes: [], packs: [] } };
  return { rows, main };
};
const J = 864e5;
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

async function contexte(b, T, J0, quand) {
  const ctx = await b.newContext({ viewport: T.vp, isMobile: !!T.isMobile, hasTouch: !!T.hasTouch, timezoneId: 'Europe/Paris', colorScheme: T.sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  if (quand) await pg.clock.setFixedTime(quand);
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const etat = { main: JSON.parse(JSON.stringify(J0.main)) };
  await pg.addInitScript((s) => { try { if (!sessionStorage.getItem('banc_init')) { sessionStorage.setItem('banc_init', '1'); localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); } } catch (_) {} }, !!T.sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
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
const lignesCa = (pg) => pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-cloture-etape]')].map((e) => [e.getAttribute('data-cloture-etape'), { etat: e.getAttribute('data-cloture-etape-etat'), n: e.getAttribute('data-n'), porte: e.hasAttribute('data-cloture-porte'), txt: e.innerText.replace(/\s+/g, ' ').trim() }])));
const attendreCa = (pg) => pg.waitForFunction(() => { const e = document.querySelector('[data-cloture-annee]'); return e && e.getAttribute('data-cloture-etat') !== 'encours'; }, null, { timeout: 40000 }).catch(() => {});

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  const TAILLES = [
    { nom: '390-clair', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true, sombre: false },
    { nom: '390-sombre', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true, sombre: true },
    { nom: '1512-clair', vp: { width: 1512, height: 950 }, sombre: false },
    { nom: '1512-sombre', vp: { width: 1512, height: 950 }, sombre: true },
  ];
  for (const nomJeu of JEUX) {
    const J0 = jeu(nomJeu);
    const tailles = nomJeu === 'J' ? TAILLES : TAILLES.filter((t) => t.nom === '390-clair' || t.nom === '1512-sombre');
    for (const T of tailles) {
      const nom = `${nomJeu} ${T.nom}`;
      console.log(`── ${nom} (${QUAND[nomJeu].toLocaleDateString('fr-FR')})`);
      const { ctx, pg, errs } = await contexte(b, T, J0, QUAND[nomJeu]);
      await essaie(`Ventes ${nom}`, () => aller(pg, 'cat_ventes', '.vrm-main', 5000));
      await essaie(`Ma journée ${nom}`, async () => {
        await aller(pg, 'journee', '.vrm-main', 3500);
        const job = await pg.$('[data-job="cloture-annee"]');
        if (nomJeu === 'J') dit(!!job, `${nom} : la carte « Clôturer 2026 » est dans Ma journée (janvier)`);
        else dit(!job, `${nom} : pas de carte dans Ma journée (${nomJeu === 'F' ? 'février' : 'novembre'})`);
        if (job && T.nom === '390-clair') {
          await capture(pg, `cloture-journee-${T.nom}`, '[data-job="cloture-annee"]');
          await job.click(); await pg.waitForTimeout(1500);
          await attendreCa(pg);
          const vis = await pg.evaluate(() => { const e = document.querySelector('[data-cloture-annee]'); return !!e && e.getClientRects().length > 0; });
          dit(vis, `${nom} : « Voir » ouvre Argent → Déclarer sur la liste`);
          await aller(pg, 'journee', '.vrm-main', 3000);
          dit(!(await pg.$('[data-job="cloture-annee"]')), `${nom} : une fois — la carte ne revient pas après avoir été ouverte`);
          dit(J0 && (await pg.evaluate(() => { try { return !!JSON.parse(localStorage.getItem('vrm_cloture_vue') || '{}')['2026']; } catch (_) { return false; } })), `${nom} : l’année vue est notée (son clic)`);
        }
      });
      await essaie(`Liste ${nom}`, async () => {
        await aller(pg, 'argent_declarer', nomJeu === 'N' ? '.vrm-main' : '[data-cloture-annee]', 1200);
        if (nomJeu === 'N') { dit(!(await pg.$('[data-cloture-annee]')), `${nom} : en novembre, pas de liste`); return; }
        await attendreCa(pg);
        const A = await attrs(pg, '[data-cloture-annee]');
        const L = await lignesCa(pg);
        const H = await attrs(pg, '[data-cloture-ca]');
        dit(A && A['cloture-annee'] === '2026' && A['cloture-etat'] === 'afaire', `${nom} : « Clôturer 2026 », des étapes à faire`, JSON.stringify(A));
        dit(Object.keys(L).join() === 'adater,prix,inventaire,ca,urssaf,revenus,seuils,export', `${nom} : les huit étapes`, Object.keys(L).join());
        dit(L.adater && L.adater.etat === 'manque' && L.adater.n === '1' && L.adater.porte, `${nom} : 1 vente à dater (vendue en décembre), avec sa porte`, JSON.stringify(L.adater));
        dit(L.prix && L.prix.etat === 'manque' && L.prix.n === '1', `${nom} : 1 vente de 2026 sans prix d’achat`, JSON.stringify(L.prix));
        dit(H && Number(H['cloture-ca']) === CA_2026 * 100, `${nom} : CA 2026 = ${CA_2026} € (les VERSEMENTS de 2026, la vente de décembre pas datée n’y est pas)`, JSON.stringify(H));
        dit(L.ca && L.ca.etat === 'manque' && /au moins/.test(L.ca.txt), `${nom} : « au moins » dit (une vente à dater)`, L.ca.txt);
        const moisFev = await attrs(pg, '[data-cloture-ym="2026-02"]');
        dit(moisFev && Number(moisFev.cts) === 12000, `${nom} : février = 120 € (versé le 8 février)`, JSON.stringify(moisFev));
        dit(L.urssaf && L.urssaf.etat === 'manque' && /3\/4/.test(L.urssaf.txt), `${nom} : URSSAF 3/4 trimestres notés déclarés`, L.urssaf.txt);
        dit(H && H['cloture-cases'] === '5KO' && Number(H['cloture-revenus']) === CA_2026 * 100, `${nom} : revenus : ${CA_2026} € case 5KO (sans versement libératoire, SA réponse)`, JSON.stringify(H));
        dit(L.revenus && /revérifie/.test((await pg.evaluate(() => (document.querySelector('[data-cloture-source]') || {}).innerText || ''))), `${nom} : la case dit sa source et « revérifie sur la notice de l’année »`);
        dit(L.export && L.export.etat === 'geste', `${nom} : l’export n’est jamais coché`, JSON.stringify(L.export));
        dit(T.vp.width > 500 || (await deborde(pg)) <= 1, `${nom} : aucun débordement à 390 px`, String(await deborde(pg)));
        const p44 = await petits(pg, '[data-cloture-annee] button, [data-cloture-annee] a');
        dit(!p44.length, `${nom} : cibles ≥ 44 px`, JSON.stringify(p44));
        dit(!(await couleurs(pg, '[data-cloture-annee]')).length, `${nom} : aucune couleur rouge ni verte`, JSON.stringify(await couleurs(pg, '[data-cloture-annee]')));
        const txt = await pg.evaluate(() => document.querySelector('.vrm-main').innerText);
        dit(!/encaiss|\bNaN\b|undefined|au moins 0[,\s]*0?0?\s*€/i.test(txt), `${nom} : jamais « encaissé », NaN, « au moins 0 »`);
        await capture(pg, `cloture-${nomJeu}-${T.nom}`, '[data-cloture-annee]');
        if (nomJeu === 'J' && T.nom === '390-clair') {
          await pg.click('[data-cloture-porte="export"]'); await pg.waitForTimeout(1500);
          const ex = await attrs(pg, '[data-export-periode]');
          dit(ex && ex['export-periode'] === '2026', `${nom} : la porte « export » ouvre l’export sur 2026 (rien téléchargé)`, JSON.stringify(ex));
          await capture(pg, `cloture-export-${T.nom}`, '[data-export-comptable]');
          await pg.evaluate(() => document.querySelector('[data-cloture-annee]').scrollIntoView());
          await pg.click('[data-cloture-porte="inventaire"]');
          await pg.waitForSelector('[data-inventaire-annuel]', { timeout: 25000 }).catch(() => {});
          dit(!!(await pg.$('[data-inventaire-annuel]')), `${nom} : la porte « inventaire » ouvre l’inventaire de fin d’année du Stock`);
          await aller(pg, 'argent_declarer', '[data-cloture-annee]', 800); await attendreCa(pg);
          await pg.click('[data-cloture-fini]'); await pg.waitForTimeout(500);
          dit(!!(await pg.$('.vrm-confirmation')), `${nom} : « J’ai fini » demande confirmation (étapes pas réglées dites)`);
          await capture(pg, `cloture-confirmer-${T.nom}`, '.vrm-confirmation');
          await pg.locator('.vrm-confirmation button', { hasText: /J’ai fini/ }).last().click(); await pg.waitForTimeout(1500);
          const A2 = await attrs(pg, '[data-cloture-annee]');
          dit(A2 && A2['cloture-etat'] === 'cloturee', `${nom} : 2026 rangée clôturée`, JSON.stringify(A2));
          const ls = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_cloture_annee') || '{}'); } catch (_) { return {}; } });
          dit(ls['2026'] && ls['2026'].at > 0 && ls['2026'].etapes && ls['2026'].etapes.adater === 'manque', `${nom} : rangée avec l’état constaté de chaque étape`, JSON.stringify(ls));
          await capture(pg, `cloture-faite-${T.nom}`, '[data-cloture-annee]');
          await pg.click('[data-cloture-rouvrir]'); await pg.waitForTimeout(800);
          const A3 = await attrs(pg, '[data-cloture-annee]');
          dit(A3 && A3['cloture-etat'] === 'afaire', `${nom} : « Rouvrir la liste » la remet à faire`, JSON.stringify(A3));
        }
      });
      dit(!errs.length, `${nom} : aucune erreur de page`, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
  }
  await b.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} banc cloture-annee : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
