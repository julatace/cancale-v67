// ════════════════════════════════════════════════════════════════════════════
//  BANC — RENTABILITÉ PAR SOURCE D'ACHAT (23 nov., lot rentabilite-source). Données INVENTÉES (dépôt public).
//  Le VRAI « Ce que tu vends le mieux » (StatsVendsMieux) monté seul (outils/rentabilite-source), 390 tactile et 1512,
//  clair et sombre :
//   S1 le regroupement « Source » existe dans le MÊME sélecteur (5e choix) et s'affiche ;
//   S2 chaque rangée : bénéfice moyen, taux, délai — recomptés ICI depuis le modèle publié (`__S`), au centime ;
//      « source pas saisie » dernière ; « sur K des N » quand des prix manquent ;
//   S3 les trois tris rangent dans l'ordre recompté ; la couverture (« sans achat relié ») est dite ;
//   S4 « pas su » (?base=passu) : « Pas encore calculé », jamais une liste vide ;
//   S5 rien ne déborde, ni NaN, cibles ≥ 44. Doit être ROUGE sur le code d'avant (pas d'axe « Source »).
//  Lancer : node scripts/bancs/rentabilite-source.cjs  (SHOTS=dossier pour les captures, à REGARDER)
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const { lancer, REGLES_PAGE } = require('./_harnais-lots.cjs');
lancer({ lot: 'rentabilite-source', url: '/?base=lu', parcours: async (pg, { W, th, SHOTS, dit }) => {
  await pg.waitForSelector('[data-ps-bloc="mieux"]', { timeout: 15000 });
  const choix = await pg.$$eval('[data-ps-bloc="mieux"] [role="radiogroup"]:first-of-type [role="radio"]', (l) => l.map((x) => x.textContent.trim()));
  dit(choix.length === 5 && choix[4] === 'Source', `S1 ${W} ${th} : « Source » est le 5e choix du MÊME sélecteur`, choix);
  const lu = await pg.evaluate(() => ({ axe: document.querySelector('[data-ps-bloc="mieux"]').getAttribute('data-ps-mieux-axe'), S: window.__S,
    rangs: [...document.querySelectorAll('[data-ps-source]')].map((x) => ({ k: x.getAttribute('data-ps-source'), moyen: x.getAttribute('data-moyen'), taux: x.getAttribute('data-taux'), delai: x.getAttribute('data-delai'), nb: x.getAttribute('data-nbenef'), rv: x.getAttribute('data-revendus'), ar: x.getAttribute('data-articles'), txt: x.innerText })),
    couv: (document.querySelector('[data-ps-mieux-couv]') || {}).innerText || '' }));
  dit(lu.axe === 'source' && lu.rangs.length >= 5, `S1b ${W} ${th} : l'axe « Source » est affiché (${lu.rangs.length} sources)`, lu.axe);
  const G = new Map(lu.S.groupes.map((g) => [g.k, g]));
  const faux = lu.rangs.filter((r) => { const g = G.get(r.k); if (!g) return true;
    const taux = g.articles ? Math.round((g.revendus / g.articles) * 100) : null;
    return String(taux == null ? '' : taux) !== r.taux || String(g.beneficeMoyen == null ? '' : g.beneficeMoyen) !== r.moyen || String(g.delai == null ? '' : g.delai) !== r.delai || String(g.nBenef) !== r.nb; });
  dit(!faux.length, `S2 ${W} ${th} : bénéfice moyen, taux (revendus ÷ achetés) et délai recomptés`, faux);
  dit(lu.rangs[lu.rangs.length - 1].k === 'non-saisie', `S2b ${W} ${th} : « source pas saisie » en dernier`, lu.rangs.map((r) => r.k));
  const vi = lu.rangs.find((r) => r.k === 'vinted');
  dit(vi && /sur 17 des 20/.test(vi.txt) && /\+\d+/.test(vi.txt), `S2c ${W} ${th} : Vinted « sur 17 des 20 » (prix d’achat manquants)`, vi && vi.txt);
  const ordreM = lu.rangs.map((r) => r.k).filter((k) => k !== 'non-saisie');
  const attendu = [...lu.S.groupes].filter((g) => !g.pasSaisie).sort((a, b) => (a.beneficeMoyen == null) - (b.beneficeMoyen == null) || (b.beneficeMoyen || 0) - (a.beneficeMoyen || 0) || b.revendus - a.revendus || a.nom.localeCompare(b.nom, 'fr')).map((g) => g.k);
  dit(ordreM.join() === attendu.join(), `S3 ${W} ${th} : tri marge recompté`, { ordreM, attendu });
  dit(/sans achat relié/.test(lu.couv) && /8 ventes/.test(lu.couv), `S3b ${W} ${th} : la couverture dit les 8 ventes sans achat relié`, lu.couv);
  const r = await pg.evaluate(REGLES_PAGE, '[data-ps-bloc="mieux"] .n-rangee');
  dit(!r.deborde && !r.nan && r.petites === 0, `S5 ${W} ${th} : rien ne déborde, aucun NaN, cibles ≥ 44`, r);
  await pg.screenshot({ path: path.join(SHOTS, `source-marge-${W}-${th}.png`), fullPage: true });
  // Tri « Vitesse ».
  await pg.locator('[data-ps-bloc="mieux"] [role="radiogroup"]').nth(1).locator('[role="radio"]').nth(1).click();
  await pg.waitForTimeout(200);
  const v = await pg.evaluate(() => [...document.querySelectorAll('[data-ps-source]')].map((x) => ({ k: x.getAttribute('data-ps-source'), d: x.getAttribute('data-delai') })));
  const ds = v.filter((x) => x.k !== 'non-saisie' && x.d !== '').map((x) => Number(x.d));
  dit(ds.every((x, i) => !i || ds[i - 1] <= x) && v[v.length - 1].k === 'non-saisie', `S3c ${W} ${th} : tri vitesse (délai croissant)`, v);
  await pg.screenshot({ path: path.join(SHOTS, `source-vitesse-${W}-${th}.png`), fullPage: true });
  await pg.goto(pg.url().replace('base=lu', 'base=passu')); await pg.waitForSelector('[data-ps-bloc="mieux"]');
  const p = await pg.evaluate(() => ({ passu: !!document.querySelector('[data-ps-source-passu]'), n: document.querySelectorAll('[data-ps-source]').length }));
  dit(p.passu && p.n === 0, `S4 ${W} ${th} : pas su ⇒ « Pas encore calculé »`, p);
} });
