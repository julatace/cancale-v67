// ════════════════════════════════════════════════════════════════════════════
//  BANC — DEPUIS MA JOURNÉE, CHAQUE ONGLET DE LA BARRE DU BAS MÈNE À SON ÉCRAN (16 nov.)
//
//  Signalé par le banc `reprise-ecrans` (branche claude/reprendre-ou-jetais) : sur l'iPhone,
//  « toucher Annonces dans la barre du bas depuis Ma journée ne mène pas à Annonces ».
//  Mesuré le 16 nov. (lot onglet-annonces-iphone) : l'onglet « Annonces » de la barre porte
//  l'identifiant `paires` (choix n° 61 du 14 nov. ; Julien le 15 nov. : « ne mets pas paires,
//  tu mets annonces » — le TEXTE seul a changé). Le banc cherchait `[data-nav-entree="annonces"]`
//  visible : il n'y en a aucun sur Ma journée au téléphone ⇒ aucun toucher, « pas arrivé ».
//  L'app, elle, y mène. Ce banc tient la promesse au doigt, pour TOUS les onglets :
//
//   J1  la barre = Aujourd'hui · Annonces (`paires`) · Ventes · Achats · Argent, chacun visible ;
//   J2  ouverture sans rien de repris ⇒ Ma journée ; puis, au DOIGT (touchscreen.tap au centre
//       de l'onglet, jamais un clic de souris), chaque onglet ⇒ SON écran (Annonces ⇒ annonces),
//       lui seul allumé, puis Aujourd'hui ⇒ Ma journée, et ainsi de suite (aller-retour) ;
//   J3  le cas du signalement : un dernier écran laissé il y a 13 h (`vrm_reprise_ecrans`, plus
//       de 12 h ⇒ Ma journée) et une recherche d'Annonces de 11 min ⇒ Ma journée, puis les
//       mêmes allers-retours ⇒ chaque écran ;
//   J4  le centre de chaque onglet est bien SOUS le doigt (aucune couche par-dessus) ;
//   J5  aucune erreur de page.
//
//  390 × 844 tactile (isMobile, hasTouch), `NAVIGATEUR=webkit` : le moteur de Safari (CI).
//  Données INVENTÉES (le dépôt est public). Juge `main[data-ecran]`, `aria-current`, des boîtes.
//  Lancer : npm run build && node scripts/bancs/barre-depuis-journee.cjs   (BANC_CAPTURES=<dossier>)
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
require('./_meta.cjs');
const H = require('./_base-ecritures.cjs');
const { lancer } = require('./_navigateur.cjs');
const fs = require('node:fs'), path = require('node:path');
const PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const CAPT = process.env.BANC_CAPTURES || path.join(require('node:os').tmpdir(), 'vrm-bancs', 'barre-depuis-journee');
fs.mkdirSync(CAPT, { recursive: true });
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

const UID = '3150004444';
const frais = (ms) => new Date(Date.now() - ms).toISOString();
const IDS = ['7300000001', '7300000002', '7300000003'];
function fabriquer(reprise) {
  const items = IDS.map((id, i) => ({ id: Number(id), title: `Air Max ${i + 1} taille 4${i}`, brand_title: 'Nike', price: { amount: String(50 + i) + '.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, created_at_ts: frais((i + 3) * 86400e3), photos: [] }));
  const main = { vrm_prenom: '', vrm_bienvenue_vue: { at: 'banc' }, vrm_visite_vue: { at: 'banc' }, vrm_configuration_depart: { etat: 'fait', at: frais(86400e3) } };
  if (reprise) main.vrm_reprise_ecrans = reprise;
  const vente = (k) => ({ transaction_id: 9300 + k, title: `Air Max vendue ${k}`, price: { amount: String(60 + k), currency_code: 'EUR' }, status: 'Commande finalisée', date: frais((k + 1) * 86400e3) });
  return H.creerBase({
    accounts: [{ id: 1, vinted_user_id: UID, login: 'vendeur_barre', domain: 'www.vinted.fr', updated_at: frais(3600e3), created_at: frais(60 * 86400e3) }],
    lignes: [
      { id: 'main', data: main },
      { id: `harvest_${UID}_listings`, data: { capturedAt: frais(60e3), nItems: items.length, payload: { items, pagination: { total_entries: items.length } } } },
      { id: `harvest_${UID}_profile`, data: { capturedAt: frais(60e3), payload: { user: { id: Number(UID), login: 'vendeur_barre' } } } },
      { id: `harvest_${UID}_orders_sold`, data: { capturedAt: frais(60e3), nItems: 3, payload: { my_orders: [vente(1), vente(2), vente(3)] } } },
      { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: frais(60e3), nItems: 1, payload: { my_orders: [{ transaction_id: 9400, title: 'Asics achetée', price: { amount: '40', currency_code: 'EUR' }, status: 'Commande finalisée', date: frais(5 * 86400e3) }] } } },
    ],
  });
}
// L'onglet de la barre ⇒ l'écran attendu (Annonces : `paires` ouvre le dernier de Annonces · Stock ; appareil neuf ⇒ Annonces).
// (23 nov., intégration) La barre native de main (`BarreOnglets`, 21 nov. « garde les onglets ») : Aujourd'hui · Annonces ·
// Ventes · Achats · Argent ; ses onglets sont `[data-n-onglets] > .n-onglet` (l'identifiant reste `data-nav-entree`).
const ONGLETS = [['paires', 'annonces'], ['ventes', 'ventes'], ['achats', 'achats'], ['compta', 'compta']];
const BARRE = ['journee', 'paires', 'ventes', 'achats', 'compta'];
const ecran = (pg) => pg.evaluate(() => (document.querySelector('main.vrm-main') || {}).dataset?.ecran || '');
const allumes = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-n-onglets] > .n-onglet[aria-current="page"]')].map((b) => b.getAttribute('data-nav-entree')));
const capture = async (pg, nom) => { try { await pg.screenshot({ path: path.join(CAPT, nom + '.png') }); } catch (_) {} };
// Le centre de l'onglet, et ce qui est SOUS ce point (J4).
const boite = (pg, id) => pg.evaluate((id) => {
  const b = document.querySelector(`[data-n-onglets] > .n-onglet[data-nav-entree="${id}"]`);
  if (!b) return null;
  const r = b.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const dessus = document.elementFromPoint(x, y);
  return { x, y, w: r.width, h: r.height, sous: !!(dessus && b.contains(dessus)), dessus: dessus ? dessus.tagName + '.' + String(dessus.className && dessus.className.baseVal != null ? dessus.className.baseVal : dessus.className || '').slice(0, 40) : '' };
}, id);
async function toucherOnglet(pg, id) {
  let bx = null;
  for (let k = 0; k < 20 && !(bx = await boite(pg, id)); k++) await pg.waitForTimeout(250);
  if (!bx) return { bx: null };
  await pg.touchscreen.tap(bx.x, bx.y);
  return { bx };
}
async function arrive(pg, voulu, ms = 10000) { return H.attendre(async () => (await ecran(pg)) === voulu, ms, 150); }

async function parcours(pg, qui) {
  // J1 · la barre
  const ids = await pg.evaluate(() => [...document.querySelectorAll('[data-n-onglets] > .n-onglet')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => b.getAttribute('data-nav-entree')));
  dit(JSON.stringify(ids) === JSON.stringify(BARRE), `J1 ${qui} : la barre = Aujourd'hui · Annonces (paires) · Ventes · Achats · Argent, visibles`, JSON.stringify(ids));
  const libAnnonces = await pg.evaluate(() => { const b = document.querySelector('[data-n-onglets] > .n-onglet[data-nav-entree="paires"] .n-onglet-libelle'); return b ? b.textContent.trim() : ''; });
  dit(libAnnonces === 'Annonces', `J1 ${qui} : l'onglet « paires » s'appelle « Annonces »`, libAnnonces);
  const vus = [];
  for (const [id, voulu] of ONGLETS) {
    // Depuis Ma journée.
    if ((await ecran(pg)) !== 'journee') { await toucherOnglet(pg, 'journee'); await arrive(pg, 'journee'); }
    const depart = await ecran(pg);
    const { bx } = await toucherOnglet(pg, id);
    const juste = await arrive(pg, voulu);
    await pg.waitForTimeout(300);
    const e = await ecran(pg), on = await allumes(pg);
    vus.push({ id, depart, e, on, sous: bx && bx.sous, dessus: bx && bx.dessus });
    await capture(pg, `${qui}-${id}`);
    dit(depart === 'journee' && juste && e === voulu, `J2 ${qui} : Ma journée ⇒ toucher « ${id} » ⇒ ${voulu}`, `départ ${depart} · arrivé ${e}`);
    dit(on.length === 1 && on[0] === id, `J2 ${qui} : « ${id} » seul allumé`, JSON.stringify(on));
    dit(!!(bx && bx.sous && bx.w >= 44 && bx.h >= 44), `J4 ${qui} : le centre de « ${id} » est sous le doigt (≥ 44 px)`, JSON.stringify(bx));
    // Retour à Ma journée par l'onglet.
    await toucherOnglet(pg, 'journee');
    const retour = await arrive(pg, 'journee');
    dit(retour, `J2 ${qui} : « Aujourd'hui » ⇒ Ma journée (depuis ${voulu})`, await ecran(pg));
  }
  return vus;
}

(async () => {
  const srv = await H.serveur(process.env.BANC_PORT || process.env.PORT || 0);
  const nav = await lancer(PW, { executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const errs = [];
  try {
    // ── J2 · appareil neuf, rien de repris ─────────────────────────────────────
    {
      const A = await H.appareil(nav, fabriquer(null), { nom: 'neuf', vp: { width: 390, height: 844 } });
      const { pg, errs: e } = await A.ouvrir('neuf'); errs.push(e);
      await pg.goto(srv.url + '/', { waitUntil: 'domcontentloaded' });
      dit(await arrive(pg, 'journee', 20000), 'J2 neuf : rien de repris ⇒ Ma journée', await ecran(pg));
      await pg.waitForTimeout(2500);
      await capture(pg, 'neuf-journee');
      await parcours(pg, 'neuf');
      await A.fermer();
    }
    // ── J3 · le cas signalé : un dernier écran de 13 h, une recherche de 11 min ──
    {
      const reprise = { ecran: { tab: 'annonces', at: Date.now() - 13 * 3600e3 }, vues: { 'annonces-recherche': { valeur: 'Air Max 2', at: Date.now() - 11 * 60e3 } } };
      const B = await H.appareil(nav, fabriquer(reprise), { nom: 'reprise', vp: { width: 390, height: 844 } });
      const { pg, errs: e } = await B.ouvrir('reprise'); errs.push(e);
      await pg.goto(srv.url + '/', { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(6000);
      dit((await ecran(pg)) === 'journee', 'J3 reprise : un dernier écran de 13 h ⇒ Ma journée', await ecran(pg));
      await capture(pg, 'reprise-journee');
      await parcours(pg, 'reprise');
      await B.fermer();
    }
  } catch (e) { dit(false, 'le banc a levé', String(e && e.stack || e).slice(0, 400)); }
  const toutes = errs.flat().filter((x) => !/ResizeObserver|Failed to fetch|NetworkError|Load failed/.test(x));
  dit(!toutes.length, 'J5 : aucune erreur de page', toutes.slice(0, 3).join(' | '));
  console.log(`\n${ok} OK · ${ko} KO · captures : ${CAPT}`);
  await nav.close(); srv.fermer();
  process.exit(ko ? 1 : 0);
})();
