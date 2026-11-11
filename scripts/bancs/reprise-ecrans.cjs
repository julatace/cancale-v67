// ════════════════════════════════════════════════════════════════════════════
//  CHAQUE ÉCRAN SE ROUVRE COMME ON L'A LAISSÉ, SUR N'IMPORTE QUEL APPAREIL (11 nov.)
//
//  Deux appareils (deux contextes Playwright : un ordinateur 1512 px, un iPhone
//  390 px tactile), LE MÊME compte VRM, une base à ÉTAT et à la vraie forme
//  (`_base-ecritures.cjs` : PATCH conditionnel sur `data.rev`, garde-fou 017).
//  Données INVENTÉES (un compte, cinq paires, trois ventes) — aucune `fx/`.
//  Les gestes sont faits À L'ÉCRAN (boutons, liste de tri, champ de recherche) ;
//  seule la partie « durées » vieillit la base à la main (une horloge qu'aucun
//  clic ne sait avancer).
//
//   P1  l'ordinateur pose : Ventes « Finalisées », puis Annonces, tri « Plus
//       récentes », recherche tapée lettre à lettre ⇒ tout est dans la clé
//       `vrm_reprise_ecrans` de la ligne `main` ; la frappe n'a pas écrit à chaque
//       lettre ; aucune position de défilement dans la clé.
//   P2  l'iPhone (neuf, même compte) s'ouvre sans lien ⇒ il arrive sur Annonces,
//       tri et recherche repris, et le bandeau les DIT avec « Effacer ».
//   P3  « Effacer » le tri sur l'iPhone ⇒ retiré de la base ; l'ordinateur rouvert
//       retrouve le tri par défaut.
//   P4  l'iPhone va sur Ventes ⇒ « Finalisées » repris et dit.
//   P5  un lien profond (`?tab=achats`) gagne toujours sur l'écran repris.
//   P6  plus de 30 min ⇒ Ma journée ; une recherche quittée depuis plus de
//       10 min ne revient pas ; le filtre, lui, revient.
//
//  §6.1 : rouge sur le build d'avant (`BANC_DIST=<dist d'avant>`), vert après.
//  Lancer : npm run build && node scripts/bancs/reprise-ecrans.cjs   (BANC_CAPTURES=<dossier>)
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
require('./_meta.cjs');
const H = require('./_base-ecritures.cjs');
const fs = require('node:fs'), path = require('node:path');
const CAPT = process.env.BANC_CAPTURES || path.join(require('node:os').tmpdir(), 'vrm-bancs', 'reprise-ecrans');
fs.mkdirSync(CAPT, { recursive: true });
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

const UID = '3150002222';
const IDS = ['7200000001', '7200000002', '7200000003', '7200000004', '7200000005'];
const frais = (ms) => new Date(Date.now() - ms).toISOString();
function fabriquer() {
  const items = IDS.map((id, i) => ({ id: Number(id), title: `Air Max ${i + 1} taille 4${i}`, brand_title: 'Nike', size_title: '4' + i, status: 'Très bon état', price: { amount: String(50 + i) + '.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, created_at_ts: frais((i + 3) * 86400000), photos: [] }));
  const fiches = {}; IDS.forEach((id, i) => { fiches[id] = { numero: String(i + 1), numberedAt: frais((i + 2) * 86400000), auto: false, manuelAt: frais((i + 2) * 86400000), title: items[i].title }; });
  const vente = (k, statut) => ({ transaction_id: 9100 + k, title: `Air Max vendue ${k}`, price: { amount: String(60 + k), currency_code: 'EUR' }, status: statut, date: frais((k + 1) * 86400000) });
  return H.creerBase({
    accounts: [{ id: 1, vinted_user_id: UID, login: 'vendeur_reprise', domain: 'www.vinted.fr', updated_at: frais(3600e3), created_at: frais(60 * 86400000) }],
    lignes: [
      { id: 'main', data: { vrm_prenom: '', vinted_annonce_numeros: fiches, vinted_used_numeros: ['1', '2', '3', '4', '5'], vrm_bienvenue_vue: { at: 'banc' }, vrm_visite_vue: { at: 'banc' }, vrm_configuration_depart: { etat: 'fait', at: frais(86400e3) } } },
      { id: `harvest_${UID}_listings`, data: { capturedAt: frais(60e3), nItems: items.length, payload: { items, pagination: { total_entries: items.length } } } },
      { id: `harvest_${UID}_enligne`, data: { capturedAt: frais(60e3), complet: true, n: items.length, ids: items.map((x) => x.id), items: items.map((x) => ({ id: x.id, title: x.title })) } },
      { id: `harvest_${UID}_profile`, data: { capturedAt: frais(60e3), payload: { user: { id: Number(UID), login: 'vendeur_reprise' } } } },
      { id: `harvest_${UID}_orders_sold`, data: { capturedAt: frais(60e3), nItems: 3, payload: { my_orders: [vente(1, 'Commande finalisée'), vente(2, 'Commande finalisée'), vente(3, 'Le paiement a été validé')] } } },
    ],
  });
}
const carte = (base) => ((H.dataMain(base) || {}).vrm_reprise_ecrans) || null;
const ecran = (pg) => pg.evaluate(() => (document.querySelector('main.vrm-main') || {}).dataset?.ecran || '');
const attendreEcran = (pg, t, ms = 12000) => H.attendre(async () => (await ecran(pg)) === t, ms);
const capture = async (pg, nom) => { try { await pg.screenshot({ path: path.join(CAPT, nom + '.png') }); } catch (_) {} };
const aller = async (pg, id) => {
  const b = pg.locator(`[data-nav-entree="${id}"]`).first();
  if (await b.count()) { await b.click().catch(() => {}); return attendreEcran(pg, id, 8000); }
  return false;
};
const triAnnonces = (pg) => pg.evaluate(() => (document.querySelector('select.vrm-ann-tri') || {}).value || '');
const rechercheAnnonces = (pg) => pg.evaluate(() => { const c = document.querySelector('[data-ann-recherche] input, input[data-ann-recherche], .vrm-annbar-recherche input'); return c ? c.value : null; });
const bandeau = (pg) => pg.evaluate(() => (document.querySelector('[data-reprise-retenue]') || {}).dataset?.repriseRetenue || '');

(async () => {
  const srv = await H.serveur(process.env.BANC_PORT || process.env.PORT || 0);
  const nav = await H.lancer();
  const base = fabriquer();
  const errs = [];

  // ── P1 · L'ORDINATEUR POSE ─────────────────────────────────────────────────
  const A = await H.appareil(nav, base, { nom: 'A', vp: { width: 1512, height: 900 } });
  let pA = await A.ouvrir('A'); errs.push(pA.errs);
  await pA.pg.goto(srv.url + '/?tab=ventes', { waitUntil: 'domcontentloaded' });
  dit(await attendreEcran(pA.pg, 'ventes'), 'P1 : l’ordinateur est sur Ventes', await ecran(pA.pg));
  await pA.pg.waitForTimeout(2500);
  // Les filtres de Ventes vivent sur le site Vinted (« Tous » n'en a pas) : choisir Vinted
  // au doigt — le site choisi est lui aussi retenu pour le compte.
  const vinted = pA.pg.locator('[data-filtre-site="ventes"] [data-site="vinted"]').first();
  dit((await vinted.count()) > 0, 'P1 : le choix du site « Vinted » est à l’écran');
  await vinted.click().catch(() => {});
  await H.attendre(async () => (await pA.pg.locator('button[aria-pressed]', { hasText: /^Finalisées$/ }).count()) > 0, 8000);
  const fin = pA.pg.locator('button[aria-pressed]', { hasText: /^Finalisées$/ }).first();
  await capture(pA.pg, 'P1-ordinateur-ventes');
  dit((await fin.count()) > 0, 'P1 : le filtre « Finalisées » est à l’écran');
  await fin.click().catch(() => {});
  dit(await aller(pA.pg, 'annonces'), 'P1 : l’ordinateur va sur Annonces (barre)', await ecran(pA.pg));
  await H.attendre(async () => (await pA.pg.locator('select.vrm-ann-tri').count()) > 0, 10000);
  await pA.pg.locator('select.vrm-ann-tri').first().selectOption('recent').catch(() => {});
  await pA.pg.waitForTimeout(2500);
  const ecrituresAvant = H.ecrituresMain(base).length;
  const champ = pA.pg.locator('[data-ann-recherche] input, input[data-ann-recherche], .vrm-annbar-recherche input').first();
  dit((await champ.count()) > 0, 'P1 : le champ de recherche d’Annonces est là');
  await champ.click().catch(() => {});
  await champ.pressSequentially('Air Max 3', { delay: 110 });
  const pendantFrappe = H.ecrituresMain(base).length - ecrituresAvant;
  await H.attendre(() => { const c = carte(base); return !!(c && c.vues && c.vues['annonces-recherche'] && c.vues['annonces-recherche'].valeur === 'Air Max 3'); }, 8000);
  const c1 = carte(base) || {};
  dit(pendantFrappe <= 1, 'P1 : la frappe (9 lettres) n’écrit pas à chaque lettre', `${pendantFrappe} écriture(s) de main pendant la frappe`);
  dit(c1.vues && c1.vues['ventes-filtre'] && c1.vues['ventes-filtre'].valeur === 'finalisees', 'P1 : le filtre de Ventes est en base, pour le compte', JSON.stringify(c1.vues && c1.vues['ventes-filtre']));
  dit(c1.vues && c1.vues['annonces-tri'] && c1.vues['annonces-tri'].valeur === 'recent', 'P1 : le tri d’Annonces est en base', JSON.stringify(c1.vues && c1.vues['annonces-tri']));
  dit(c1.vues && c1.vues['annonces-recherche'] && c1.vues['annonces-recherche'].valeur === 'Air Max 3', 'P1 : la recherche est en base');
  dit(c1.sites && c1.sites.ventes && c1.sites.ventes.valeur === 'vinted', 'P1 : le site choisi sur Ventes (Vinted) est en base', JSON.stringify(c1.sites));
  dit(c1.ecran && c1.ecran.tab === 'annonces', 'P1 : le dernier écran (Annonces) est en base', JSON.stringify(c1.ecran));
  dit(!JSON.stringify(c1).includes('position'), 'P1 : aucune position de défilement dans la clé du compte');
  await capture(pA.pg, 'P1-ordinateur-annonces');

  // ── P2 · L'IPHONE S'OUVRE ──────────────────────────────────────────────────
  const B = await H.appareil(nav, base, { nom: 'B', vp: { width: 390, height: 844 } });
  const pB = await B.ouvrir('B'); errs.push(pB.errs);
  await pB.pg.goto(srv.url + '/', { waitUntil: 'domcontentloaded' });
  dit(await attendreEcran(pB.pg, 'annonces', 15000), 'P2 : l’iPhone neuf s’ouvre sur Annonces (posé il y a < 30 min sur l’ordinateur)', await ecran(pB.pg));
  await H.attendre(async () => (await triAnnonces(pB.pg)) === 'recent', 8000);
  dit((await triAnnonces(pB.pg)) === 'recent', 'P2 : le tri « Plus récentes » est repris', await triAnnonces(pB.pg));
  dit((await rechercheAnnonces(pB.pg)) === 'Air Max 3', 'P2 : la recherche (quittée il y a < 10 min) est reprise', String(await rechercheAnnonces(pB.pg)));
  await H.attendre(async () => /annonces-tri/.test(await bandeau(pB.pg)), 5000);
  const bd = await bandeau(pB.pg);
  dit(/annonces-tri/.test(bd) && /annonces-recherche/.test(bd), 'P2 : le bandeau DIT le tri et la recherche retenus', bd);
  const eff = pB.pg.locator('[data-effacer-vue="annonces-tri"]');
  const boite = (await eff.count()) ? await eff.first().boundingBox() : null;
  dit(boite && boite.height >= 44 && boite.width >= 44, 'P2 : « Effacer » fait au moins 44 px au doigt', boite ? `${Math.round(boite.width)}×${Math.round(boite.height)}` : 'absent');
  await capture(pB.pg, 'P2-iphone-annonces-repris');

  // ── P3 · « EFFACER » LE TRI ─────────────────────────────────────────────────
  await eff.first().click().catch(() => {});
  await H.attendre(async () => (await triAnnonces(pB.pg)) === 'oldest', 4000);
  dit((await triAnnonces(pB.pg)) === 'oldest', 'P3 : « Effacer » remet le tri par défaut sur l’iPhone', await triAnnonces(pB.pg));
  await H.attendre(() => { const c = carte(base); return !!(c && c.vues && !c.vues['annonces-tri']); }, 8000);
  dit(!((carte(base) || {}).vues || {})['annonces-tri'], 'P3 : le tri effacé est retiré de la base');
  await pA.pg.close(); pA = await A.ouvrir('A2'); errs.push(pA.errs);
  await pA.pg.goto(srv.url + '/?tab=annonces', { waitUntil: 'domcontentloaded' });
  await attendreEcran(pA.pg, 'annonces');
  await H.attendre(async () => (await pA.pg.locator('select.vrm-ann-tri').count()) > 0, 10000);
  await pA.pg.waitForTimeout(3500);
  dit((await triAnnonces(pA.pg)) === 'oldest', 'P3 : l’ordinateur rouvert retrouve le tri par défaut (effacé sur l’iPhone)', await triAnnonces(pA.pg));
  await capture(pB.pg, 'P3-iphone-tri-efface');

  // ── P4 · VENTES SUR L'IPHONE ────────────────────────────────────────────────
  dit(await aller(pB.pg, 'ventes'), 'P4 : l’iPhone va sur Ventes (barre du bas)', await ecran(pB.pg));
  await H.attendre(async () => (await pB.pg.locator('button[aria-pressed="true"]', { hasText: /^Finalisées$/ }).count()) > 0, 8000);
  dit((await pB.pg.locator('button[aria-pressed="true"]', { hasText: /^Finalisées$/ }).count()) > 0, 'P4 : « Finalisées » (posé sur l’ordinateur) est repris');
  dit(/ventes-filtre/.test(await bandeau(pB.pg)), 'P4 : et il est DIT, avec « Effacer »', await bandeau(pB.pg));
  await capture(pB.pg, 'P4-iphone-ventes-repris');

  // ── P5 · UN LIEN PROFOND GAGNE ──────────────────────────────────────────────
  const Cx = await H.appareil(nav, base, { nom: 'C', vp: { width: 390, height: 844 } });
  const pC = await Cx.ouvrir('C'); errs.push(pC.errs);
  await pC.pg.goto(srv.url + '/?tab=achats', { waitUntil: 'domcontentloaded' });
  await pC.pg.waitForTimeout(6000);
  dit((await ecran(pC.pg)) === 'achats', 'P5 : un lien ?tab=achats (notification) ouvre Achats, pas l’écran repris', await ecran(pC.pg));
  await capture(pC.pg, 'P5-lien-profond');

  // ── P6 · LES DURÉES ─────────────────────────────────────────────────────────
  // Plus aucun geste en attente, puis l'horloge : le dernier écran a 31 min, la
  // recherche a été quittée il y a 11 min, le filtre de Ventes a 2 jours.
  await pB.pg.waitForTimeout(3000);
  const m = H.dataMain(base);
  const c6 = JSON.parse(JSON.stringify(m.vrm_reprise_ecrans || {}));
  if (c6.ecran) c6.ecran.at = Date.now() - 31 * 60000;
  if (c6.vues && c6.vues['annonces-recherche']) c6.vues['annonces-recherche'].at = Date.now() - 11 * 60000;
  if (c6.vues && c6.vues['ventes-filtre']) c6.vues['ventes-filtre'].at = Date.now() - 2 * 86400000;
  m.vrm_reprise_ecrans = c6;
  const D = await H.appareil(nav, base, { nom: 'D', vp: { width: 390, height: 844 } });
  const pD = await D.ouvrir('D'); errs.push(pD.errs);
  await pD.pg.goto(srv.url + '/', { waitUntil: 'domcontentloaded' });
  await pD.pg.waitForTimeout(7000);
  dit((await ecran(pD.pg)) === 'journee', 'P6 : un dernier écran de plus de 30 min ⇒ Ma journée', await ecran(pD.pg));
  await capture(pD.pg, 'P6-journee');
  await aller(pD.pg, 'annonces');
  await H.attendre(async () => (await rechercheAnnonces(pD.pg)) !== null, 8000);
  dit((await rechercheAnnonces(pD.pg)) === '', 'P6 : une recherche quittée il y a 11 min ne revient pas', JSON.stringify(await rechercheAnnonces(pD.pg)));
  await aller(pD.pg, 'ventes');
  await H.attendre(async () => (await pD.pg.locator('button[aria-pressed="true"]', { hasText: /^Finalisées$/ }).count()) > 0, 8000);
  dit((await pD.pg.locator('button[aria-pressed="true"]', { hasText: /^Finalisées$/ }).count()) > 0, 'P6 : le filtre de Ventes (2 jours) revient, dit à l’écran');
  await capture(pD.pg, 'P6-ventes-filtre');

  const toutes = errs.flat().filter((e) => !/ResizeObserver|Failed to fetch|NetworkError|Load failed/.test(e));
  dit(!toutes.length, 'aucune erreur de page', toutes.slice(0, 3).join(' | '));
  console.log(`\n${ok} OK · ${ko} KO · captures : ${CAPT}`);
  await nav.close(); srv.fermer();
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('KO  le banc a levé : ' + (e && e.stack || e)); process.exit(1); });
