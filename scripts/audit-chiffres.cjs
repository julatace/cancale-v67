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

// 8) LE CHIFFRE FAUX EST LA PORTE POUR LE CORRIGER. La saisie en série des prix
// d'achat s'était retrouvée derrière « Analyse de tes ventes », repliée (§5.67) —
// or le prix d'achat est LA donnée manquante (0 sur 320) et c'est ce chiffre-ci
// qui l'annonce. Un tap dessus doit ouvrir la liste.
// ⚠️ On ne peut pas borner avec `[^>]*` : le `sub=` contient déjà des `>`
// (`nbCout>1`). On regarde la fenêtre de texte qui suit l'étiquette.
{
  const i = app.indexOf('label="Coût d\'achat"');
  const fenetre = i < 0 ? '' : app.slice(i, i + 400);
  /setFillBuyOpen\(true\)/.test(fenetre)
    ? ok('le chiffre « Coût d\'achat » ouvre la saisie en série')
    : nok('« Coût d\'achat » doit ouvrir `setFillBuyOpen(true)` quand il manque des prix');
}

// 9) L'EN-TÊTE DES COLIS ANNONCE TROIS GROUPES : LA LISTE DOIT LES MONTRER.
// « 10 en retard · 3 aujourd'hui · 1 demain » au-dessus de quatorze cartes à la
// suite, sans aucune frontière : sur téléphone il en voit cinq à la fois, donc
// aucun des trois nombres n'était vérifiable. Le tri était déjà bon — il
// manquait l'intertitre à chaque charnière.
{
  const i = app.indexOf('const groupeDe');
  const F = i < 0 ? '' : app.slice(i, i + 1600);
  F ? ok('la liste des colis se découpe en groupes') : nok('`groupeDe` doit découper la liste des colis');
  // ⚠️ ON GROUPE SUR CE QU'IL PEUT FAIRE, pas sur l'urgence. Vu en capture le
  // 7 septembre : l'en-tête annonçait « 10 bordereaux prêts à imprimer » et les
  // quatre premières cartes disaient « l'extension le récupère » — le tri par
  // date limite mettait devant les seuls colis qu'il ne PEUT PAS traiter.
  (/'pret'/.test(F) && /'attente'/.test(F) && /'fait'/.test(F))
    ? ok('les groupes suivent ce qu\'il peut faire : prêts, en attente, déjà postés')
    : nok('les groupes doivent couvrir prêt / en attente / déjà posté');
  /const pret = \(e\) =>/.test(app) && /if \(ia !== ib\) return ia - ib/.test(app)
    ? ok('les colis imprimables passent devant dans le tri')
    : nok('un colis sans bordereau n\'est pas postable : il ne doit pas ouvrir la liste');
  // ⚠️ UN SEUL GROUPE = PAS D'INTERTITRE : il redirait mot pour mot le compteur
  // du haut, et le même nombre ne s'écrit pas deux fois sur un écran.
  /plusieursGroupes/.test(app)
    ? ok('un seul groupe n\'écrit pas d\'intertitre (le nombre serait redit)')
    : nok('sans `plusieursGroupes`, « 14 colis à envoyer » puis « En retard · 14 »');
}

// 10) L'ÉCRAN D'ACCUEIL DIT CE QU'IL PEUT FAIRE MAINTENANT.
// Mesuré le 7 septembre : 15 colis à expédier, dont 10 dont le bordereau est
// DÉJÀ en base — et la carte disait seulement « Bordereau + paire au garage ».
// Dix étiquettes prêtes, annoncées nulle part sur l'écran qu'il ouvre en premier.
{
  const i = app.indexOf('const pretsImpr');
  const F = i < 0 ? '' : app.slice(i, i + 900);
  F ? ok('« Expédier N colis » compte ce qui est imprimable') : nok('la carte doit compter les bordereaux prêts');
  /prêt\$\{pretsImpr>1\?'s':''\} à imprimer|prêts? à imprimer/.test(F)
    ? ok('et le dit dans son sous-titre')
    : nok('le sous-titre doit annoncer les bordereaux prêts à imprimer');
  // ⚠️ « le code arrive par email » laissait croire qu'il n'y a rien à faire.
  !/le code arrive par email ou dans la conversation/.test(app)
    ? ok('« Retirer N colis » ne dit plus que le code arrive tout seul')
    : nok('le code n\'arrive pas tout seul : il faut ouvrir la conversation');
}

// 11) L'ARGENT DÉJÀ VIRABLE EST UN CHIFFRE DE VINTED, PAS UNE ESTIMATION.
// Mesuré le 7 septembre sur ses neuf porte-monnaie : 281,94 € disponibles à
// côté de 2 235,80 € retenus. Le disponible n'apparaissait que dans une phrase
// d'explication de l'écran Statistiques — jamais sur l'accueil.
{
  const i = app.indexOf('escrow && escrow.dispo > 0');
  const F = i < 0 ? '' : app.slice(i, i + 900);
  F ? ok('l\'accueil dit l\'argent déjà disponible à virer')
    : nok('l\'argent virable doit apparaître à côté de l\'argent en attente');
  // ⚠️ « en attente » et « disponible » ne se confondent JAMAIS (§5.14).
  /déjà disponibles à virer/.test(F)
    ? ok('et ne le confond pas avec l\'argent en attente')
    : nok('les deux montants doivent porter des mots différents');
  /plusVieuxJours>7/.test(F)
    ? ok('un solde ancien annonce son âge')
    : nok('un solde lu il y a trois semaines n\'est pas le montant d\'aujourd\'hui');
}

// 12) PAS DE « n/d » — c'est du vocabulaire d'informaticien, et Julien n'est
// pas développeur. La règle est écrite dans le dossier de passation depuis des
// semaines ; quatre chiffres l'affichaient encore, vus en capture le
// 7 septembre sur l'écran Statistiques. Un tiret dit « on ne sait pas », et la
// raison juste dessous dit quoi faire.
{
  const restes = (app.match(/'n\/d'|"n\/d"/g) || []).length;
  restes === 0 ? ok('aucun « n/d » ne reste dans l\'app')
               : nok(`${restes} « n/d » à remplacer par « — » + la raison`);
  // ⚠️ « CA / jour actif » ne dépend PAS des prix d'achat : il ne doit pas être
  // éteint par le drapeau du bénéfice.
  // ⚠️ ET IL NE S'ÉCRIT PAS « 0,00 € » QUAND ON NE SAIT PAS. `dayStats` compte
  // les jours d'après `receiveDate` — la date d'encaissement, retirée exprès de
  // l'app. Mesuré : 0 jour. Un zéro qui veut dire « on ne sait pas » est pire
  // qu'un blanc.
  /label="CA \/ jour actif" value=\{days\.length>0\?fmt\(avgDayCA\):'—'\}/.test(app)
    ? ok('le CA par jour actif écrit « — » quand il ne peut pas être calculé')
    : nok('un 0,00 € qui veut dire « on ne sait pas » doit s\'écrire « — »');
}

console.log(ko ? `\n${ko} contrôle(s) en échec.` : '\nAucun chiffre ne peut se présenter comme complet sans l’être.');
process.exit(ko ? 1 : 0);
