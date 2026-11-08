#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT — MA JOURNÉE EN MOTS COURTS (3 nov. 2026, maquette FusionJournee)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (capture sur ordinateur, 3 nov. 07 h 47) : « j'aime pas trop cet endroit »
// — « 2 à retirer de Leboncoin · N°18, N°23 vendues sur Vinted », « 1 vente Vestiaire à
// envoyer · Le bordereau se prend sur Vestiaire », « 5 paires à regarder pour eBay »,
// « 3 emails mis de côté que personne ne peut récupérer »… Ce contrôle EXÉCUTE la forme
// courte (`src/design/tacheCourte.js`) sur les phrases mêmes que l'app fabrique et exige :
//   1. les titres courts demandés (« 2 annonces à retirer de Leboncoin », « Vente Vestiaire
//      à envoyer », « 5 articles pour eBay », « 3 e-mails à trier ») ;
//   2. les numéros gardés (N°18, N°23) — l'identité n'est jamais perdue en route ;
//   3. le NOMBRE du titre = le compteur de la ligne (jamais un autre chiffre) ;
//   4. plus jamais « paire(s) » dans ce qui s'affiche ;
//   5. Ma journée passe par cette forme (App.jsx l'importe et `decouper` l'appelle).
// `--src <arbre>` : le lancer sur un autre arbre (preuve sur le code d'avant).
// ═══════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const path = require('path'), fs = require('fs');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : ''; };
const RACINE = path.resolve(arg('--src') || path.join(__dirname, '..'));
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? ' — ' + d : '')); } };
(async () => {
  const fichier = path.join(RACINE, 'src/design/tacheCourte.js');
  if (!fs.existsSync(fichier)) { dit(false, 'src/design/tacheCourte.js existe'); console.log(`\n${ok} vert(s), ${ko} rouge(s)`); process.exit(1); }
  const { courtFusion, enArticles } = await import('file://' + fichier);
  const court = (j) => courtFusion(j) || { court: enArticles(j.title), detail: enArticles(j.sub) };
  const cas = [
    [{ id: 'double-vente', n: 2, title: '2 à retirer de Leboncoin — N°18, N°23 vendues sur Vinted' }, '2 annonces à retirer de Leboncoin', ['N°18', 'N°23', 'Vinted']],
    [{ id: 'double-vente', n: 1, title: '1 à retirer de Leboncoin (vendue sur Vestiaire)' }, '1 annonce à retirer de Leboncoin', ['Vestiaire']],
    [{ id: 'double-vente', n: 3, title: "3 paires vendues sur Vinted, encore en vente sur eBay — à retirer d'eBay" }, "3 annonces à retirer d'eBay", ['Vinted']],
    [{ id: 'double-vente', n: 2, title: '2 articles vendus sur Leboncoin, encore en vente sur Vinted — à retirer de Vinted' }, '2 annonces à retirer de Vinted', ['Leboncoin']],
    [{ id: 'double-vente', n: 2, title: '2 numéros portés par deux annonces (N°4, N°7) — la mauvaise paire peut partir' }, '2 numéros en double', ['N°4', 'N°7']],
    [{ id: 'numeros-en-double', n: 1, title: '1 numéro porté par deux paires', sub: "N°12 — corrige avant d'expédier" }, '1 numéro en double', ['N°12']],
    [{ id: 'vestiaire-envoyer', n: 1, title: '1 vente Vestiaire à envoyer', sub: 'Le bordereau se prend sur Vestiaire' }, 'Vente Vestiaire à envoyer', []],
    [{ id: 'vestiaire-envoyer', n: 2, title: '2 ventes Vestiaire à envoyer', sub: 'Date limite passée — bordereau sur Vestiaire' }, '2 ventes Vestiaire à envoyer', ['Date limite passée']],
    [{ id: 'a-faire-tag', n: 5, title: '5 paires à regarder pour eBay' }, '5 articles pour eBay', []],
    [{ id: 'emails-personne', title: '3 emails mis de côté que personne ne peut récupérer', sub: 'Déclare tes adresses dans Réglages' }, '3 e-mails à trier', []],
    [{ id: 'emballer', n: 2, title: 'Emballer les colis prêts', sub: '2 prêts — un par un : le N°, la photo, où est la paire' }, 'Emballer les colis prêts', ["l'article"]],
    [{ id: 'poste-sans-depart', n: 1, title: 'Vérifier 1 colis coché « posté »', sub: "Vinted ne l'a pas vu partir — vérifie le dépôt" }, '1 dépôt à vérifier', ["Vinted ne l'a pas vu partir"]],
    [{ id: 'a-faire-cash', n: 1, title: "Déclarer l'URSSAF d'octobre", court: "Déclarer l'URSSAF d'octobre", detail: 'Avant le 30 nov. · ≈ 14 € à payer', urssaf: { dueIso: '2026-11-30' } }, "URSSAF d'octobre", ['30 nov.']],
    [{ id: 'a-faire-info', n: 4, title: '4 paires sans numéro', sub: 'Pose un N° sur chaque paire' }, '4 articles sans numéro', ['chaque article']],
  ];
  for (const [j, attendu, garde] of cas) {
    const x = court(j);
    const vu = `${x.court} · ${x.detail || ''}`;
    dit(x.court === attendu, `« ${j.title} » → « ${attendu} »`, vu);
    for (const g of garde) dit(vu.includes(g), `   garde « ${g} »`, vu);
    dit(!/\bpaires?\b/.test(vu), '   jamais « paire » à l\'écran', vu);
    const nTitre = (/^(\d+)/.exec(x.court) || [])[1];
    if (nTitre && j.n != null) dit(Number(nTitre) === Number(j.n), '   le nombre du titre est le compteur de la ligne', `${nTitre} ≠ ${j.n}`);
  }
  // 6. (3 nov., critique #11) La pastille portait le nombre ; (3 nov., photos) la règle de titreSansNombre reste testée, mais Ma journée ne l'appelle plus.
  const { titreSansNombre } = await import('file://' + fichier);
  if (typeof titreSansNombre !== 'function') dit(false, 'titreSansNombre existe');
  else {
    for (const [t, n, att] of [['2 annonces à retirer de Leboncoin', 2, 'Annonces à retirer de Leboncoin'], ['6 annonces sans numéro', 6, 'Annonces sans numéro'], ['Colis à vérifier', 3, 'Colis à vérifier'], ['3 e-mails à trier', null, '3 e-mails à trier'], ['12 colis en retard', 2, '12 colis en retard']])
      dit(titreSansNombre(t, n) === att, `titre sans le nombre de la pastille : « ${t} » (${n}) → « ${att} »`, titreSansNombre(t, n));
    // (3 nov., nouvelle mise en page — « À faire » en photos) Plus de pastille chiffrée : la vignette montre les
    // articles, le TITRE porte le nombre. Ma journée ne doit donc plus retirer le nombre du titre.
    const appTxt = fs.readFileSync(path.join(RACINE, 'src/App.jsx'), 'utf8').replace(/\/\/.*$/gm, '');
    dit(!/titreSansNombre\(/.test(appTxt) && /const avecPastille = false/.test(appTxt) && /<PileVignettes/.test(appTxt), 'Ma journée : vignette en photos, le titre GARDE son nombre (titreSansNombre n’est plus appelé)');
  }
  const app = fs.readFileSync(path.join(RACINE, 'src/App.jsx'), 'utf8');
  dit(/import \{[^}]*courtFusion[^}]*\} from "\.\/design\/tacheCourte\.js"/.test(app), 'App.jsx importe la forme courte');
  dit(/const decouper = \(j\) => \{\s*const f = courtFusion\(j\);/.test(app), 'Ma journée (`decouper`) passe par la forme courte');
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
