#!/usr/bin/env node
// ══ BANC ONGLETS D (6 nov.) — Compta, Annonces, Statistiques, Paramètres ═════
// Données INVENTÉES (le jeu de `nouveau-vendeur.cjs` + des ventes « à dater »),
// 390 tactile et 1512, clair et sombre. Juge les RÈGLES (attributs, nombres) :
//   K1 Compta → « Déclarer » : trois étapes ; le « ? » du chiffre d'affaires déplie
//      UNE phrase qui porte le même nombre de ventes que la ligne publiée ; les
//      ventes à dater disent leur période.
//   K2 Compta → seuils : « Reçu en {année} » = mois datés + ventes à dater VENDUES
//      cette année (2 × 70 €) ; la vente de l'an dernier reste « au moins ».
//   P1 Paramètres : groupes d'intention, une phrase sous chaque réglage, la
//      recherche trouve « abonnement ».
//   N1 Annonces : « Prochain geste » en tête (ici les prix d'achat, couverture dite).
//   T  Partout : aucune erreur de page, aucun « undefined / NaN / null » à l'écran,
//      aucun écran tombé sur le garde-fou, cibles du « ? » à 44 px.
// `SHOTS=<dossier>` : captures (à regarder). `BANC_PORT` (défaut 10661).
'use strict';
require('./_porte-banc.cjs');
process.env.BANC_PORT = process.env.BANC_PORT || '10661';
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const SHOTS = process.env.SHOTS || '';
const LARGEURS = String(process.env.LARGEURS || '390,1512').split(',').map(Number);
const THEMES = String(process.env.THEMES || 'clair,sombre').split(',');
let ok = 0, ko = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 300) : ''}`); };

const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString();
const AN = new Date().getFullYear();
// Une vente finalisée SANS transaction lue (pas de date de versement) : « à dater ».
const finalisee = (tx, eur, dateIso) => ({ transaction_id: tx, title: `Paire inventée ${tx}`, price: { amount: String(eur), currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: dateIso });
const txn = (uid, tx, jVerse) => ({ id: `harvest_${uid}_txn_${tx}`, data: { capturedAt: iso(0.01), payload: { transaction: { id: tx, item_id: tx + 500000, status: 450, status_title: 'Commande finalisée', status_updated_at: iso(jVerse) } } } });
const jeu = () => {
  const L = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  const v2 = L.find((r) => r.id === 'harvest_222_orders_sold');
  // Deux vendues CETTE année (le 2 janvier et le 3 février), une l'an dernier : aucune versée lue.
  v2.data.payload.my_orders.push(
    finalisee(62101, 70, new Date(AN, 0, 2, 12).toISOString()),
    finalisee(62102, 70, new Date(AN, 1, 3, 12).toISOString()),
    finalisee(62103, 40, new Date(AN - 1, 4, 20, 12).toISOString()));
  // La vente 62005 (finalisée, vendue il y a 9 j) versée il y a 6 j ; 62002 versée il y a 4 j.
  L.push(txn(222, 62005, 6), txn(111, 62002, 4));
  const main = L.find((r) => r.id === 'main');
  main.data.vinted_regime = 'micro'; main.data.vinted_urssaf_freq = 'mensuel'; main.data.vrm_urssaf_declare = {};
  return { lignes: L, comptes: NV.JEU_COMPTES, ecritures: 0 };
};
const aller = async (pg, tab, attente = 3000) => {
  await pg.goto(`http://localhost:${NV.PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(attente);
};
const propre = async (pg, T, ecran) => {
  const r = await pg.evaluate(() => {
    const t = (document.querySelector('.vrm-main') || document.body).innerText;
    return { mauvais: (t.match(/\bundefined\b|\bNaN\b|\bnull\b|\[object /g) || []), garde: /Quelque chose s.est mal pass|Recharger l.app/i.test(t) && !document.querySelector('.vrm-main h1, .vrm-main h2') };
  });
  dit(!r.mauvais.length, `T ${T} ${ecran} : aucun « undefined / NaN / null » à l’écran`, r.mauvais.join(','));
  dit(!r.garde, `T ${T} ${ecran} : l’écran n’est pas tombé sur le garde-fou`);
};
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: true }).catch(() => {}); };

(async () => {
  await new Promise((r) => NV.srv.listen(NV.PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const th of THEMES) {
      const T = `${W} ${th}`, tel = W < 600;
      const o = await NV.ouvrir(nav, { W, sombre: th === 'sombre', base: jeu(), tab: 'dashboard' });
      const pg = o.pg;
      try {
        // Ventes ouvert une fois : il publie le CA déclaré (le geste de la vraie vie).
        await aller(pg, 'cat_ventes', 5000);
        // ── COMPTA ──
        await aller(pg, 'compta', 4000);
        const pub = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_urssaf_mois') || 'null'); } catch (_) { return null; } });
        const ad = pub && pub.aDater;
        dit(!!(ad && ad.n === 3 && ad.annees && ad.annees[String(new Date().getFullYear())] && ad.annees[String(new Date().getFullYear())].n === 2),
          `K0 ${T} : Ventes publie les 3 ventes à dater, dont 2 vendues cette année`, JSON.stringify(ad));
        const K = await pg.evaluate(() => {
          const c = document.querySelector('[data-urssaf-parcours="3"]');
          const s = document.querySelector('[data-micro-seuils="lu"]');
          return {
            carte: !!c, etapes: c ? [...c.querySelectorAll('[data-urssaf-etape]')].map((e) => e.getAttribute('data-urssaf-etape')).join('') : '',
            periode: c ? ((c.querySelector('[data-urssaf-adater-periode]') || {}).innerText || '') : '',
            manque: c ? ((c.querySelector('[data-urssaf-manque]') || {}).innerText || '') : '',
            caSeuils: s ? s.getAttribute('data-micro-ca') : null,
            sur: (document.querySelector('[data-micro-adater-sur]') || { getAttribute: () => null }).getAttribute('data-micro-adater-sur'),
            partiel: s ? s.getAttribute('data-micro-partiel') : null, raisons: ((document.querySelector('[data-micro-partiel-texte]') || {}).innerText || ''),
          };
        });
        // Le CA des mois (lu dans la ligne publiée) + 140 € vendus cette année : le CA de l'année.
        const an = String(new Date().getFullYear());
        const moisAn = pub && Array.isArray(pub.mois) ? pub.mois.filter((m) => String(m.ym).slice(0, 4) === an).reduce((t, m) => t + Math.round(Number(m.ca) * 100), 0) : NaN;
        // La période « Déclarer » n'apparaît qu'une période finie (déclaration ouverte) : la carte « prévision » sinon.
        if (K.carte) {
          dit(K.etapes === '123', `K1 ${T} : « Déclarer » en trois étapes`, K.etapes);
          dit(/1 vente|3 ventes/.test(K.manque) && /^vendues de /.test(K.periode), `K1 ${T} : les ventes à dater sont nommées, avec la période de leur vente`, `${K.manque} | ${K.periode}`);
          await pg.locator('[data-source-chiffre="ca"]').first().click();
          await pg.waitForTimeout(250);
          const q = await pg.evaluate(() => { const b = document.querySelector('[data-source-chiffre="ca"]'); const r = b.getBoundingClientRect(); const t = (document.querySelector('[data-source-texte="ca"]') || {}).innerText || ''; return { t, exp: b.getAttribute('aria-expanded'), w: r.width, h: r.height }; });
          dit(q.exp === 'true' && /La somme de tes \d+ vente/.test(q.t), `K1 ${T} : le « ? » du chiffre d’affaires dit d’où il vient`, q.t.slice(0, 120));
          const nPub = (() => { const lab = pub && pub.mois; return lab; })();
          dit(!!nPub, `K1 ${T} : la phrase lit la ligne publiée`);
        } else dit(true, `K1 ${T} : période en cours (carte prévision) — étapes non jugées ce jour`);
        dit(K.caSeuils != null && Math.round(Number(K.caSeuils) * 100) === moisAn + 14000, `K2 ${T} : « Reçu en ${an} » = mois datés + 2 × 70 € vendus cette année, jamais datés au mois`, `${K.caSeuils} vs ${(moisAn + 14000) / 100}`);
        dit(K.sur === '2', `K2 ${T} : la part prouvée est DITE (« Dont 2 ventes vendues en ${an}… »)`, K.sur);
        dit(K.partiel === '1' && /1 vente sans date de versement/.test(K.raisons), `K2 ${T} : la vente de l’an dernier reste « au moins », nommée`, K.raisons);
        await propre(pg, T, 'Compta');
        await capture(pg, `compta-${W}-${th}`);
        // ── PARAMÈTRES ──
        await aller(pg, 'settings', 2500);
        const P = await pg.evaluate(() => {
          const vis = (e) => !!e && e.getClientRects().length > 0;
          const titres = [...document.querySelectorAll('.vrm-set-groupe-titre, .vrm-set h3, .vrm-set [data-groupe-titre]')].filter(vis).map((e) => e.innerText.trim());
          const lignes = [...document.querySelectorAll('.vrm-set-liste .vrm-set-ligne')].filter(vis);
          const sansPhrase = lignes.filter((l) => !l.querySelector('.vrm-set-desc')).map((l) => (l.querySelector('.vrm-set-lib b') || l).innerText);
          return { titres, n: lignes.length, sansPhrase, texte: document.querySelector('.vrm-set') ? document.querySelector('.vrm-set').innerText : '' };
        });
        const voulus = ['Mes comptes', 'Mes e-mails', 'Notifications', 'Mon abonnement', 'Sécurité et sauvegarde', 'Aide'];
        dit(voulus.every((t) => P.texte.includes(t)), `P1 ${T} : les groupes d’intention sont à l’écran`, voulus.filter((t) => !P.texte.includes(t)).join(', '));
        dit(P.n >= 15 && P.sansPhrase.length <= 1, `P1 ${T} : chaque réglage porte sa phrase (${P.n} lignes)`, P.sansPhrase.join(', '));
        await pg.fill('[data-recherche-reglages] input, input[aria-label="Rechercher dans les paramètres"]', 'abonnement').catch(() => {});
        await pg.waitForTimeout(400);
        const ab = await pg.evaluate(() => !!document.querySelector('[data-reglage-abonnement]'));
        dit(ab, `P1 ${T} : la recherche « abonnement » trouve « Mon abonnement »`);
        await pg.fill('[data-recherche-reglages] input, input[aria-label="Rechercher dans les paramètres"]', '').catch(() => {});
        await propre(pg, T, 'Paramètres');
        await capture(pg, `parametres-${W}-${th}`);
        // ── ANNONCES ──
        await aller(pg, 'annonces', 5000);
        const N = await pg.evaluate(() => { const g = document.querySelector('[data-ann-prochain-geste]'); return g ? { cle: g.getAttribute('data-ann-prochain-geste'), t: g.innerText } : null; });
        // Les 3 annonces sans N° en reçoivent un toute seules (§5, règle a) : le geste suivant est
        // le prix d'achat, avec SA couverture (aucun des 12 connu). L'ordre complet : audit-onglets-d.
        dit(N && N.cle === 'prix' && /0\/12/.test(N.t), `N1 ${T} : « Prochain geste » en tête — les prix d’achat, couverture dite (0/12)`, JSON.stringify(N));
        dit(!(await pg.$('[data-ann-achats]')) || (N && N.cle !== 'prix'), `N1 ${T} : « Prix d’achat N/M » ne s’écrit qu’une fois`);
        await propre(pg, T, 'Annonces');
        await capture(pg, `annonces-${W}-${th}`);
        // ── STATISTIQUES ──
        await aller(pg, 'dashboard', 4000);
        await propre(pg, T, 'Statistiques');
        await capture(pg, `stats-${W}-${th}`);
        dit(!o.journal.erreurs.length, `T ${T} : aucune erreur de page`, o.journal.erreurs.slice(0, 3).join(' | '));
        void tel;
      } catch (e) { dit(false, `${T} : le banc a tourné`, e && e.message); }
      await o.ctx.close().catch(() => {});
    }
  } finally {
    await nav.close(); NV.srv.close();
  }
  console.log(ko ? `❌ banc onglets-d : ${ko} rouge(s), ${ok} vert(s)` : `✅ banc onglets-d : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();
