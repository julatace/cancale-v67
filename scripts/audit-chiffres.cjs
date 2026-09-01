#!/usr/bin/env node
// ────────────────────────────────────────────────────────────────────────────
// UN TOTAL NE SE PRÉSENTE JAMAIS COMME COMPLET QUAND IL NE L'EST PAS.
//
// Mesuré le 1er septembre sur la vraie base : 1 prix d'achat saisi sur 175
// ventes. L'écran Ventes affichait « BÉNÉFICE NET · 5 741 − 2 = 5 739 € » en
// vert, en 34 px, à côté d'un « CA FINALISÉ · 5 741 € ». Le bénéfice n'était
// donc que le chiffre d'affaires sous un autre nom — parce que `ca - cout`
// suppose que les 174 ventes SANS prix d'achat ont coûté ZÉRO.
//
// Le même calcul alimentait le RAPPORT COMPTABLE (modale, CSV et PDF) — un
// document qui part chez un comptable.
//
// La règle : on ne somme que les ventes dont le coût est réellement saisi
// (`benefConnu` / `margeKnown - fraisConnu`), et la COUVERTURE (`nbCout/nb`)
// voyage avec le chiffre, à l'écran comme dans le PDF. C'est la même règle que
// pour l'argent en attente (§5.27) : un total partiel qui se présente comme
// complet est pire qu'un total absent.
// ────────────────────────────────────────────────────────────────────────────
const fs = require('fs'), path = require('path');
const app = fs.readFileSync(path.join(__dirname, '..', 'src/App.jsx'), 'utf8');
let ko = 0;
const ok  = m => console.log('✅ ' + m);
const nok = (m, d) => { ko++; console.log('❌ ' + m + (d ? ' — ' + d : '')); };

// 1) l'écran Ventes calcule le bénéfice sur le SOUS-ENSEMBLE CONNU
/benefConnu\s*\+=\s*sell-buy-fee/.test(app)
  ? ok('Ventes : le bénéfice ne somme que les ventes au coût connu')
  : nok('Ventes : `benefConnu` sommé sur les ventes au coût connu');

// 2) …et c'est bien CE chiffre qui est affiché
/StatBox label="Bénéfice net" value=\{fmtE0\(totals\.benefConnu\)\}/.test(app)
  ? ok('Ventes : la carte affiche `benefConnu`, pas `ca - cout`')
  : nok('Ventes : la carte affiche `totals.benefConnu`');

// 3) la couverture est écrite À CÔTÉ du chiffre, et elle se voit (subColor)
/subColor=\{totals\.nbCout<totals\.nb\?C\.warn/.test(app)
  ? ok('Ventes : la couverture est affichée en avertissement, pas en gris')
  : nok('Ventes : `subColor` en warn quand la couverture est partielle');

// 4+5) les DEUX rapports comptables suivent la même règle
const nBenef = (app.match(/const benefNet = margeKnown - fraisConnu;/g) || []).length;
nBenef === 2 ? ok('Rapports mensuel ET annuel : bénéfice sur le coût connu')
             : nok('les 2 rapports calculent `margeKnown - fraisConnu`', `trouvé ${nBenef}/2`);

// 6) plus aucun `ca - cout - frais` : c'est la formule qui compte un coût nul
/const benefNet = ca - cout - frais/.test(app)
  ? nok('un rapport calcule encore `ca - cout - frais` (coût nul sur les ventes non renseignées)')
  : ok('aucun rapport ne calcule plus `ca - cout - frais`');

// 7) le PDF imprime la couverture à côté du bénéfice
((app.match(/ventes au coût connu\)`:''\)/g) || []).length >= 2)
  ? ok('les PDF impriment la couverture à côté du bénéfice')
  : nok('les 2 PDF impriment `(sur N/M ventes au coût connu)`');

console.log(ko ? `\n${ko} contrôle(s) en échec.` : '\nAucun chiffre ne peut se présenter comme complet sans l’être.');
process.exit(ko ? 1 : 0);
