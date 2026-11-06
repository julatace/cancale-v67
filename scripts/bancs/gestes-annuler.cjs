// ════════════════════════════════════════════════════════════════════════════
//  BANC : « ANNULER » PARTOUT, GESTES INSTANTANÉS (6 nov., v36)
//  src/gesteAnnulable.js · src/PiluleAnnuler.jsx
//
//  Une base à ÉTAT et à la vraie forme (`_base-ecritures.cjs` : PATCH
//  conditionnel sur `data->>rev`), données INVENTÉES (dépôt public) : deux
//  comptes, un colis au relais, deux ventes à expédier avec bordereau. Trois
//  gestes joués avec annulation, à 390 tactile (clair et sombre) et 1512 :
//   G1 Colis → À retirer → « J'ai retiré » : la ligne part TOUT DE SUITE (avant
//      toute écriture), la pilule dit « Colis retiré » + « Annuler » (44 px,
//      zone `role=status` polie, au-dessus de la barre du bas) ; « enregistré »
//      seulement quand la base a la valeur ; « Annuler » ⇒ la ligne revient,
//      la base ne l'a plus ;
//   G2 Colis → À envoyer → « Marquer imprimé » ⇒ « ✓ Imprimé » tout de suite ;
//      « Annuler » ⇒ « Marquer imprimé », la base ne l'a plus ;
//   G3 PANNE D'ÉCRITURE (la base refuse, 403) → « Déposé » : la carte part
//      tout de suite puis REVIENT, la pilule dit « Pas enregistré » avec
//      « Réessayer » (jamais « enregistré »), l'appareil ne garde pas le geste ;
//      la panne levée, « Réessayer » ⇒ écrit en base.
//  Jugé sur les data-* et les nombres rendus (§6.4). Captures dans
//  $BANC_CAPTURES (par défaut <tmp>/vrm-bancs/gestes-annuler) — à REGARDER.
//  Lancer : NODE_OPTIONS="--require $PWD/scripts/bancs/_porte-banc.cjs" BANC_PORT=12150 node scripts/bancs/gestes-annuler.cjs
// ════════════════════════════════════════════════════════════════════════════
require('./_meta.cjs');
const H = require('./_base-ecritures.cjs');
const sc = require('./_scenario-colis.cjs');
const fs = require('node:fs'), path = require('node:path');
const CAPT = process.env.BANC_CAPTURES || path.join(require('node:os').tmpdir(), 'vrm-bancs', 'gestes-annuler');
fs.mkdirSync(CAPT, { recursive: true });
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  OK  ' : '  KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String((e && e.message) || e).slice(0, 240)); } };
const VUES = process.env.BANC_VUES ? process.env.BANC_VUES.split(',') : null;

const NOW = Date.now(), iso = (ms) => new Date(ms).toISOString();
const UID = sc.UID[0];
const TX_A = '8810001', TX_B = '8810002';
function fabriquer(sombre) {
  const ventes = [
    sc.ordre({ tx: TX_A, titre: 'Nike Dunk Low gris 42', prix: 55, statut: sc.STATUT_AEXP, tus: 'needs_action', dateMs: NOW - 86400e3 }),
    sc.ordre({ tx: TX_B, titre: 'Adidas Samba blanche 41', prix: 62, statut: sc.STATUT_AEXP, tus: 'needs_action', dateMs: NOW - 2 * 86400e3 }),
  ];
  const suivi = 'MR90012345';
  return H.creerBase({
    accounts: sc.comptes(),
    lignes: [
      { id: 'main', data: { vinted_dark: !!sombre, vinted_accounts_hidden: [], vinted_pickup_done: {}, vinted_ship_done: {}, vinted_bords_printed: {}, vinted_bords_shipped: {}, vrm_colis_collected: [], vrm_colis_collected_at: {}, vrm_bienvenue_vue: { at: 'banc' }, vrm_visite_vue: { at: 'banc' }, vrm_prenom: 'Banc', rev: 7 } },
      { id: `harvest_${UID}_orders_sold`, data: { capturedAt: iso(NOW - 60e3), payload: { my_orders: ventes } } },
      { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: iso(NOW - 60e3), payload: { my_orders: [] } } },
      { id: `harvest_${sc.UID[1]}_orders_sold`, data: { capturedAt: iso(NOW - 60e3), payload: { my_orders: [] } } },
      { id: `harvest_${sc.UID[1]}_orders_purchased`, data: { capturedAt: iso(NOW - 60e3), payload: { my_orders: [] } } },
      sc.bordereau({ tx: TX_A }), sc.bordereau({ tx: TX_B }),
      { id: `email_track_mondialrelay_${suivi}`, data: { type: 'suivi', carrier: 'mondialrelay', suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`, receivedAt: iso(NOW - 3 * 3600e3), emailAt: iso(NOW - 3 * 3600e3), arriveLe: iso(NOW - 3 * 3600e3), code: '482913', lieu: 'Tabac du Port, 4 quai Gambetta, 35260 Cancale', limite: iso(NOW + 4 * 86400e3).slice(0, 10), consigne: false, account: 'boutique_nord' } },
    ],
  });
}
const dataMain = (base) => H.dataMain(base) || {};
const pilule = (pg) => pg.evaluate(() => {
  const z = document.querySelector('.vrm-pil-zone'); const p = document.querySelector('.vrm-pil:not(.is-sortie)');
  if (!p) return { zone: !!z, role: z && z.getAttribute('role'), live: z && z.getAttribute('aria-live'), etat: null };
  const r = p.getBoundingClientRect(); const a = p.querySelector('[data-pilule-annuler],[data-pilule-reessayer]');
  const nav = [...document.querySelectorAll('.vrm-tabbar')].find((n) => n.getBoundingClientRect().height > 0);
  return { zone: true, role: z.getAttribute('role'), live: z.getAttribute('aria-live'), etat: p.getAttribute('data-pilule-etat'), texte: p.innerText.replace(/\s+/g, ' ').trim(),
    annuler: !!p.querySelector('[data-pilule-annuler]'), reessayer: !!p.querySelector('[data-pilule-reessayer]'), hBouton: a ? a.offsetHeight : 0,
    bas: Math.round(r.bottom), haut: Math.round(r.top), gauche: Math.round(r.left), droite: Math.round(r.right), largeurVue: window.innerWidth, hauteurVue: window.innerHeight,
    navHaut: nav ? Math.round(nav.getBoundingClientRect().top) : null, fond: getComputedStyle(p).backgroundColor, focusDansPilule: p.contains(document.activeElement) };
});
const attendreEtat = (pg, etats, ms = 9000) => H.attendre(async () => { const p = await pilule(pg); return etats.includes(p.etat); }, ms, 60);
const nbRetirer = (pg) => pg.evaluate(() => document.querySelectorAll('[data-colis-retire]').length);
// Sur téléphone, les gestes secondaires d'une carte sont derrière « … » (`data-colis-plus`) : on l'ouvre.
const ouvrirPlus = (pg, geste) => pg.evaluate((g) => { for (const c of document.querySelectorAll('[data-bord-card]')) { const b = c.querySelector(`button[data-geste="${g}"]`); if (b && b.getBoundingClientRect().height === 0) { const p = c.querySelector('[data-colis-plus]'); if (p) p.click(); } } }, geste);

(async () => {
  const srv = await H.serveur(process.env.BANC_PORT || 12150);
  const nav = await H.lancer();
  for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 950 }, false, '1512-clair']]) {
    if (VUES && !VUES.includes(nom)) continue;
    console.log(`\n— Gestes annulables · ${nom}`);
    const base = fabriquer(sombre);
    const A = await H.appareil(nav, base, { nom, vp, init: { vinted_dark: JSON.stringify(!!sombre) } });
    const { pg, errs } = await A.ouvrir(nom);
    await pg.goto(srv.url + '/?tab=cat_bord', { waitUntil: 'domcontentloaded' });
    await H.attendre(async () => (await pg.locator('[data-colis-onglet-choix="retirer"]').count()) > 0, 30000);
    // Ce que l'app publie à l'ouverture est parti (la file d'envoi est vide) : on mesure SES gestes.
    await H.attendre(async () => (await pg.evaluate(() => localStorage.getItem('vrm_file_envoi'))) == null, 15000);
    await pg.waitForTimeout(1200);

    await essaie('G1', async () => {
      await pg.locator('[data-colis-onglet-choix="retirer"]').first().click();
      await H.attendre(async () => (await nbRetirer(pg)) > 0, 15000);
      const n0 = await nbRetirer(pg);
      dit(n0 >= 1, 'G1 le colis au relais est à retirer', String(n0));
      const ecr0 = base.ecritures.length;
      await pg.locator('[data-colis-retire]').first().click();
      const n1 = await nbRetirer(pg); const p1 = await pilule(pg); const ecr1 = base.ecritures.length;
      dit(n1 === n0 - 1 && ecr1 === ecr0, 'G1 la ligne part TOUT DE SUITE, avant toute écriture (optimiste)', `${n0} → ${n1} · écritures ${ecr0} → ${ecr1}`);
      dit(p1.etat === 'envoi' && /Colis retiré/.test(p1.texte) && p1.annuler, 'G1 la pilule dit « Colis retiré » avec « Annuler »', JSON.stringify(p1));
      dit(p1.role === 'status' && p1.live === 'polite', 'G1 VoiceOver l’annonce (zone role=status, polie)', `${p1.role}/${p1.live}`);
      dit(p1.hBouton >= 44, 'G1 « Annuler » fait au moins 44 px', String(p1.hBouton));
      dit(!p1.focusDansPilule, 'G1 la pilule ne prend pas le focus (le geste n’est pas coupé)');
      dit(p1.gauche >= 12 && p1.droite <= p1.largeurVue - 12, 'G1 la pilule tient dans l’écran (marges)', `${p1.gauche}…${p1.droite} / ${p1.largeurVue}`);
      if (vp.width < 600) dit(p1.navHaut == null || p1.bas <= p1.navHaut - 4, 'G1 la pilule est AU-DESSUS de la barre du bas', `bas ${p1.bas} · barre ${p1.navHaut}`);
      else dit(p1.bas >= p1.hauteurVue - 80, 'G1 sur ordinateur, la pilule est en bas', `bas ${p1.bas} / ${p1.hauteurVue}`);
      await pg.waitForTimeout(350); await pg.screenshot({ path: path.join(CAPT, `G1-retire-${nom}.png`) });
      const enr = await attendreEtat(pg, ['enregistre']);
      const lu = dataMain(base).vrm_colis_collected || [];
      dit(enr && lu.length === 1, 'G1 « enregistré » seulement quand la base a la valeur', `${(await pilule(pg)).etat} · base ${JSON.stringify(lu)}`);
      const ong = () => pg.evaluate(() => (document.querySelector('[data-colis-onglet-choix="retirer"]') || { getAttribute: () => null }).getAttribute('data-colis-onglet-n'));
      dit(await H.attendre(async () => (await ong()) === '0', 3000), 'G1 le compte « À retirer · N » suit (0)', await ong());
      await pg.locator('[data-pilule-annuler]').first().click();
      const n2 = await nbRetirer(pg);
      dit(n2 === n0, 'G1 « Annuler » ⇒ la ligne revient tout de suite', `${n1} → ${n2}`);
      dit(await attendreEtat(pg, ['annule'], 9000), 'G1 la pilule dit « Annulé »', (await pilule(pg)).etat);
      const parti = await H.attendre(async () => (dataMain(base).vrm_colis_collected || []).length === 0, 9000);
      dit(parti, 'G1 l’inverse est écrit : la base ne l’a plus', JSON.stringify(dataMain(base).vrm_colis_collected));
      dit(await H.attendre(async () => (await ong()) === String(n0), 3000), 'G1 le compte « À retirer · N » revient', await ong());
      await pg.screenshot({ path: path.join(CAPT, `G1-annule-${nom}.png`) });
      await H.attendre(async () => (await pilule(pg)).etat == null, 4000);
    });

    await essaie('G2', async () => {
      await pg.locator('[data-colis-onglet-choix="envoyer"]').first().click();
      const sel = '[data-bord-card] button[data-geste="imprime"]';
      await H.attendre(async () => (await pg.locator(sel).count()) > 0, 15000);
      await ouvrirPlus(pg, 'imprime');
      const lab0 = await pg.locator(sel).first().innerText();
      dit(/Marquer imprimé/.test(lab0), 'G2 un bordereau « Marquer imprimé »', lab0);
      await pg.locator(sel).first().click();
      const lab1 = await pg.locator(sel).first().innerText(); const p = await pilule(pg);
      dit(/Imprimé/.test(lab1) && !/Marquer/.test(lab1), 'G2 « ✓ Imprimé » tout de suite', lab1);
      dit(/Marqué imprimé/.test(p.texte) && p.annuler, 'G2 la pilule « Marqué imprimé » + « Annuler »', p.texte);
      await pg.waitForTimeout(350); await pg.screenshot({ path: path.join(CAPT, `G2-imprime-${nom}.png`) });
      const ecrit = await H.attendre(async () => Object.keys(dataMain(base).vinted_bords_printed || {}).length === 1, 9000);
      dit(ecrit, 'G2 écrit en base', JSON.stringify(dataMain(base).vinted_bords_printed));
      await pg.locator('[data-pilule-annuler]').first().click();
      const lab2 = await pg.locator(sel).first().innerText();
      dit(/Marquer imprimé/.test(lab2), 'G2 « Annuler » ⇒ « Marquer imprimé » tout de suite', lab2);
      const defait = await H.attendre(async () => Object.keys(dataMain(base).vinted_bords_printed || {}).length === 0, 9000);
      dit(defait, 'G2 l’inverse est écrit en base', JSON.stringify(dataMain(base).vinted_bords_printed));
      await H.attendre(async () => (await pilule(pg)).etat == null, 4000);
    });

    await essaie('G3', async () => {
      const selFait = '[data-bord-card] button[data-geste="fait"]';
      await H.attendre(async () => (await pg.locator(selFait).count()) > 0, 10000);
      await ouvrirPlus(pg, 'fait');
      const c0 = await pg.locator('[data-bord-card]').count();
      // La base REFUSE toute écriture de la ligne `main` (403 : session refusée).
      A.etat.faute = (u, m) => (m === 'PATCH' && /id=eq\.main/.test(u) ? { status: 403 } : null);
      await pg.locator(selFait).first().click();
      const c1 = await pg.locator('[data-bord-card]').count();
      dit(c1 === c0 - 1, 'G3 « Déposé » : la carte part tout de suite (optimiste)', `${c0} → ${c1}`);
      const echec = await attendreEtat(pg, ['echec'], 12000);
      const p = await pilule(pg);
      dit(echec && /Pas enregistré/.test(p.texte) && p.reessayer && !p.annuler, 'G3 panne ⇒ « Pas enregistré » avec « Réessayer » (jamais « enregistré »)', JSON.stringify(p));
      const c2 = await pg.locator('[data-bord-card]').count();
      dit(c2 === c0, 'G3 la carte REVIENT (retour arrière visible)', `${c1} → ${c2}`);
      await pg.waitForTimeout(900);
      const ls = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_ship_done') || '{}'); } catch (_) { return 'illisible'; } });
      dit(ls && typeof ls === 'object' && !Object.keys(ls).length, 'G3 l’appareil ne garde pas le geste refusé', JSON.stringify(ls));
      dit(!Object.keys(dataMain(base).vinted_ship_done || {}).length, 'G3 rien en base', JSON.stringify(dataMain(base).vinted_ship_done));
      dit(p.hBouton >= 44, 'G3 « Réessayer » fait au moins 44 px', String(p.hBouton));
      await pg.screenshot({ path: path.join(CAPT, `G3-panne-${nom}.png`) });
      A.etat.faute = null;
      await pg.locator('[data-pilule-reessayer]').first().click();
      await ouvrirPlus(pg, 'fait');
      const c3 = await pg.locator('[data-bord-card]').count();
      dit(c3 === c0 - 1, 'G3 « Réessayer » repose le geste tout de suite', `${c2} → ${c3}`);
      const enr = await attendreEtat(pg, ['enregistre'], 15000);
      const bd = dataMain(base).vinted_ship_done || {};
      dit(enr && Object.keys(bd).length === 1, 'G3 la panne levée : écrit en base, « enregistré »', `${(await pilule(pg)).etat} · ${JSON.stringify(bd)}`);
      await pg.screenshot({ path: path.join(CAPT, `G3-reessaye-${nom}.png`) });
    });
    dit(!errs.length, 'aucune erreur de page', errs.slice(0, 3).join(' | '));
    await A.fermer();
  }
  await nav.close(); srv.fermer();
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
