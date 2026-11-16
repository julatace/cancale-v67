// ════════════════════════════════════════════════════════════════════════════
//  LE MODE SOMBRE SUIT L'APPAREIL (16 nov., lot sombre-auto — décision de Julien)
//
//  Rien de choisi ⇒ « Automatique » : VRM prend la teinte de l'iPhone / de l'ordinateur
//  (`prefers-color-scheme`), EN DIRECT quand le système bascule ; un choix fait à la
//  main reste prioritaire (ancien `vinted_dark` true OU false gardé ; `vrm_apparence`).
//  Données INVENTÉES (`_base-ecritures.cjs`), aucune `fx/`.
//
//   S1  aucun choix, appareil sombre (390 tactile) ⇒ sombre DÈS le premier rendu :
//       `data-theme` n'a JAMAIS valu « light » (aucun flash), barre d'état sombre ;
//   S2  l'appareil passe en clair ⇒ VRM passe en clair sans recharger (data-theme,
//       theme-color) ; puis de nouveau sombre ;
//   S3  ancien choix « clair » (`vinted_dark` false), appareil sombre ⇒ clair (gardé) ;
//   S4  choix « Sombre » (`vrm_apparence`), appareil clair ⇒ sombre ;
//   S5  1512 : aucun choix, appareil clair ⇒ clair ; Paramètres → Apparence :
//       « Automatique (par défaut) » en premier et coché ;
//   S6  contraste (axe-core, règle color-contrast) : aucun texte sous 4,5:1 sur Ma
//       journée, en clair et en sombre (390 et 1512).
//  §6.1 : rouge sur le build d'avant (`BANC_DIST=<dist d'avant>`), vert après.
//  Lancer : npm run build && node scripts/bancs/sombre-auto.cjs   (BANC_CAPTURES=<dossier>)
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
require('./_meta.cjs');
const H = require('./_base-ecritures.cjs');
const fs = require('node:fs'), path = require('node:path');
const CAPT = process.env.BANC_CAPTURES || path.join(require('node:os').tmpdir(), 'vrm-bancs', 'sombre-auto');
fs.mkdirSync(CAPT, { recursive: true });
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js', { paths: [path.join(__dirname, '..', '..')] }), 'utf8');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

const UID = '3150004444';
const frais = (ms) => new Date(Date.now() - ms).toISOString();
function fabriquer() {
  const items = [1, 2, 3].map((i) => ({ id: 7300000000 + i, title: `Basket ${i} taille 4${i}`, brand_title: 'Nike', size_title: '4' + i, status: 'Très bon état', price: { amount: String(40 + i) + '.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, created_at_ts: frais((i + 3) * 86400000), photos: [] }));
  return H.creerBase({
    accounts: [{ id: 1, vinted_user_id: UID, login: 'vendeur_sombre', domain: 'www.vinted.fr', updated_at: frais(3600e3), created_at: frais(60 * 86400000) }],
    lignes: [
      { id: 'main', data: { vrm_prenom: '', vrm_bienvenue_vue: { at: 'banc' }, vrm_visite_vue: { at: 'banc' }, vrm_configuration_depart: { etat: 'fait', at: frais(86400e3) } } },
      { id: `harvest_${UID}_listings`, data: { capturedAt: frais(60e3), nItems: items.length, payload: { items, pagination: { total_entries: items.length } } } },
      { id: `harvest_${UID}_profile`, data: { capturedAt: frais(60e3), payload: { user: { id: Number(UID), login: 'vendeur_sombre' } } } },
      { id: `harvest_${UID}_orders_sold`, data: { capturedAt: frais(60e3), nItems: 1, payload: { my_orders: [{ transaction_id: 9201, title: 'Basket vendue', price: { amount: '55', currency_code: 'EUR' }, status: 'Commande finalisée', date: frais(2 * 86400000) }] } } },
    ],
  });
}
const theme = (pg) => pg.evaluate(() => document.documentElement.getAttribute('data-theme'));
const barre = (pg) => pg.evaluate(() => (document.querySelector('meta[name="theme-color"]') || {}).content || '');
const historique = (pg) => pg.evaluate(() => (window.__vrmThemes || []).join(','));
const capture = async (pg, nom) => { try { await pg.screenshot({ path: path.join(CAPT, nom + '.png') }); } catch (_) {} };
// La luminance relative d'une couleur CSS « #rrggbb » ou « rgb(…) » : sombre si < 0,2.
const lum = (c) => {
  const m = /^#([0-9a-f]{6})$/i.exec(c) || null; let r, g, b;
  if (m) { const n = parseInt(m[1], 16); r = n >> 16; g = (n >> 8) & 255; b = n & 255; }
  else { const k = /rgba?\((\d+)\D+(\d+)\D+(\d+)/.exec(c || ''); if (!k) return null; [r, g, b] = k.slice(1).map(Number); }
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
async function contraste(pg) {
  await pg.evaluate(() => { try { for (const a of document.getAnimations()) { try { a.finish(); } catch (_) {} } } catch (_) {} });
  await pg.evaluate(AXE);
  return pg.evaluate(async () => {
    const r = await window.axe.run(document.querySelector('main.vrm-main') || document, { runOnly: { type: 'rule', values: ['color-contrast'] }, resultTypes: ['violations'] });
    return r.violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(' ')} — ${(n.failureSummary || '').replace(/\s+/g, ' ').slice(0, 140)}`));
  });
}
// Avant tout script de la page : chaque valeur prise par `data-theme` est notée (le « flash »).
const NOTER = () => {
  window.__vrmThemes = [];
  const noter = () => { const v = document.documentElement.getAttribute('data-theme'); if (v && window.__vrmThemes[window.__vrmThemes.length - 1] !== v) window.__vrmThemes.push(v); };
  try { new MutationObserver(noter).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (_) {}
};

(async () => {
  const srv = await H.serveur(process.env.BANC_PORT || process.env.PORT || 0);
  const nav = await H.lancer();
  const base = fabriquer();
  const errs = [];

  // ── S1 · AUCUN CHOIX, IPHONE SOMBRE ─────────────────────────────────────────
  const A = await H.appareil(nav, base, { nom: 'A', vp: { width: 390, height: 844 } });
  await A.ctx.addInitScript(NOTER);
  const pA = await A.ouvrir('A'); errs.push(pA.errs);
  await pA.pg.emulateMedia({ colorScheme: 'dark' });
  await pA.pg.goto(srv.url + '/?tab=journee', { waitUntil: 'domcontentloaded' });
  await pA.pg.waitForTimeout(6000);
  const h1 = await historique(pA.pg);
  dit((await theme(pA.pg)) === 'dark', 'S1 : rien de choisi, iPhone en sombre ⇒ VRM en sombre', await theme(pA.pg));
  dit(h1 && !/light/.test(h1), 'S1 : aucun flash — `data-theme` n’a jamais valu « light » depuis le démarrage', h1);
  const b1 = await barre(pA.pg);
  dit(lum(b1) !== null && lum(b1) < 0.2, 'S1 : la barre d’état (theme-color) est sombre', b1);
  await capture(pA.pg, 'S1-390-auto-sombre');

  // ── S2 · L'IPHONE BASCULE ───────────────────────────────────────────────────
  await pA.pg.emulateMedia({ colorScheme: 'light' });
  await H.attendre(async () => (await theme(pA.pg)) === 'light', 4000);
  dit((await theme(pA.pg)) === 'light', 'S2 : l’iPhone passe en clair ⇒ VRM passe en clair, sans recharger', await theme(pA.pg));
  const b2 = await barre(pA.pg);
  dit(lum(b2) !== null && b2 !== b1, 'S2 : la barre d’état suit (theme-color change)', `${b1} → ${b2}`);
  await capture(pA.pg, 'S2-390-auto-clair');
  const cClair390 = await contraste(pA.pg);
  await pA.pg.emulateMedia({ colorScheme: 'dark' });
  await H.attendre(async () => (await theme(pA.pg)) === 'dark', 4000);
  dit((await theme(pA.pg)) === 'dark', 'S2 : et revient en sombre quand l’iPhone y revient', await theme(pA.pg));
  const cSombre390 = await contraste(pA.pg);

  // ── S3 · ANCIEN CHOIX « CLAIR » GARDÉ ────────────────────────────────────────
  const B = await H.appareil(nav, base, { nom: 'B', vp: { width: 390, height: 844 }, init: { vinted_dark: 'false' } });
  await B.ctx.addInitScript(NOTER);
  const pB = await B.ouvrir('B'); errs.push(pB.errs);
  await pB.pg.emulateMedia({ colorScheme: 'dark' });
  await pB.pg.goto(srv.url + '/?tab=journee', { waitUntil: 'domcontentloaded' });
  await pB.pg.waitForTimeout(5000);
  dit((await theme(pB.pg)) === 'light' && !/dark/.test(await historique(pB.pg)), 'S3 : « clair » choisi autrefois (vinted_dark false), iPhone sombre ⇒ clair, sans flash', `${await theme(pB.pg)} · ${await historique(pB.pg)}`);

  // ── S4 · CHOIX « SOMBRE » PRIORITAIRE ────────────────────────────────────────
  const C = await H.appareil(nav, base, { nom: 'C', vp: { width: 390, height: 844 }, init: { vrm_apparence: '"sombre"' } });
  const pC = await C.ouvrir('C'); errs.push(pC.errs);
  await pC.pg.emulateMedia({ colorScheme: 'light' });
  await pC.pg.goto(srv.url + '/?tab=journee', { waitUntil: 'domcontentloaded' });
  await pC.pg.waitForTimeout(5000);
  dit((await theme(pC.pg)) === 'dark', 'S4 : « Sombre » choisi, iPhone clair ⇒ sombre (le choix manuel gagne)', await theme(pC.pg));

  // ── S5 · ORDINATEUR, PARAMÈTRES → APPARENCE ─────────────────────────────────
  const D = await H.appareil(nav, base, { nom: 'D', vp: { width: 1512, height: 900 } });
  const pD = await D.ouvrir('D'); errs.push(pD.errs);
  await pD.pg.emulateMedia({ colorScheme: 'light' });
  await pD.pg.goto(srv.url + '/?tab=journee', { waitUntil: 'domcontentloaded' });
  await pD.pg.waitForTimeout(6000);
  dit((await theme(pD.pg)) === 'light', 'S5 : 1512, rien de choisi, ordinateur clair ⇒ clair', await theme(pD.pg));
  await capture(pD.pg, 'S5-1512-auto-clair');
  const cClair1512 = await contraste(pD.pg);
  await pD.pg.emulateMedia({ colorScheme: 'dark' });
  await H.attendre(async () => (await theme(pD.pg)) === 'dark', 4000);
  dit((await theme(pD.pg)) === 'dark', 'S5 : l’ordinateur passe en sombre ⇒ VRM aussi', await theme(pD.pg));
  await pD.pg.waitForTimeout(800);
  await capture(pD.pg, 'S5-1512-auto-sombre');
  const cSombre1512 = await contraste(pD.pg);
  await pD.pg.goto(srv.url + '/?tab=reglages', { waitUntil: 'domcontentloaded' });
  await pD.pg.waitForTimeout(4000);
  const ligne = pD.pg.locator('[data-reglage-apparence]').first();
  if (await ligne.count()) { await ligne.click().catch(() => {}); await pD.pg.waitForTimeout(1200); }
  const choix = await pD.pg.evaluate(() => [...document.querySelectorAll('[data-apparence]')].filter((e) => e.getClientRects().length).map((e) => `${e.dataset.apparence}:${e.getAttribute('aria-checked')}:${(e.querySelector('b') || {}).textContent || ''}`));
  dit(choix.length >= 3 && /^auto:true:Automatique \(par défaut\)$/.test(choix[0] || ''), 'S5 : Paramètres → Apparence : « Automatique (par défaut) » en premier, coché', choix.join(' | '));
  await capture(pD.pg, 'S5-1512-parametres-apparence');

  // ── S6 · CONTRASTE ≥ 4,5:1 ──────────────────────────────────────────────────
  for (const [nom, v] of [['390 clair', cClair390], ['390 sombre', cSombre390], ['1512 clair', cClair1512], ['1512 sombre', cSombre1512]]) {
    dit(Array.isArray(v) && v.length === 0, `S6 : Ma journée ${nom} — aucun texte sous 4,5:1 (axe color-contrast)`, Array.isArray(v) ? `${v.length} : ${v.slice(0, 3).join(' ║ ')}` : String(v));
  }

  const toutes = errs.flat().filter((e) => !/ResizeObserver|Failed to fetch|NetworkError|Load failed/.test(e));
  dit(!toutes.length, 'aucune erreur de page', toutes.slice(0, 3).join(' | '));
  console.log(`\n${ok} OK · ${ko} KO · captures : ${CAPT}`);
  await nav.close(); srv.fermer();
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('KO  le banc a levé : ' + (e && e.stack || e)); process.exit(1); });
