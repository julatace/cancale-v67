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
  // ⚠️ CE CONTRÔLE PORTAIT SUR L'ORTHOGRAPHE, ET IL A CRIÉ AU LOUP. Il exigeait
  // la ligne `const pret = (e) =>` ; renommer ce helper en `estPret` le faisait
  // échouer alors que la règle était intacte — et mieux respectée qu'avant.
  // Même leçon que `audit-identite` (§5). La RÈGLE, elle, tient en deux points :
  //   1. « prêt à imprimer » est PORTÉ PAR LA LIGNE, pas recalculé par chaque
  //      lecteur — c'est ce qui a fait diverger Ma journée (8) et Colis (9) ;
  //   2. le tri compare cette propriété AVANT la date limite, pour qu'un colis
  //      qu'il ne peut pas poster n'ouvre pas la liste.
  const porte = /\.pret\s*=\s*estPret\(|forEach\(e\s*=>\s*\{\s*e\.pret\s*=/.test(app)
             || /return \{ \.\.\.e, dl, pret/.test(app);
  const triAvantDl = /if \(ia !== ib\) return ia - ib/.test(app)
                  && app.indexOf('if (ia !== ib) return ia - ib') < app.indexOf("a.dl == null ? 999");
  porte && triAvantDl
    ? ok('« prêt à imprimer » est porté par la ligne, et passe devant dans le tri')
    : nok(!porte
        ? '« prêt à imprimer » doit être porté par la ligne : deux lecteurs qui le recalculent finissent par se contredire (accueil 8 / Colis 9)'
        : 'un colis sans bordereau n\'est pas postable : il ne doit pas ouvrir la liste');
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
  // ⚠️ LA CARTE « CA / JOUR » NE S'ÉCRIT JAMAIS « 0,00 € ». Un zéro qui veut
  // dire « on ne sait pas » est pire qu'un blanc.
  // ⚠️ SUIVRE LA RÈGLE, PAS SON ORTHOGRAPHE : ce contrôle cherchait la ligne
  // exacte de l'ancienne version (« CA / jour actif », calculée sur `days`,
  // c'est-à-dire sur `receiveDate` — la date d'encaissement retirée exprès de
  // l'app, donc 0 jour et un tiret que RIEN ne pouvait remplir). La carte
  // compte maintenant les jours de VENTE, connus pour toutes les ventes ; le
  // contrôle porte donc sur la règle : la valeur est gardée par un dénominateur
  // STRICTEMENT POSITIF, et retombe sur « — ».
  {
    const carte = /label="CA \/ jour[^"]*"[\s\S]{0,300}?value=\{([\s\S]*?)\}\s/.exec(app);
    const v = carte ? carte[1] : '';
    (v && /\w+>0\s*\?/.test(v) && /:\s*'—'/.test(v))
      ? ok('le CA par jour écrit « — » tant qu\'il n\'a aucun jour à diviser')
      : nok('un 0,00 € qui veut dire « on ne sait pas » doit s\'écrire « — »', v.slice(0,80));
    // Et il ne se calcule PAS sur la date d'encaissement, qui n'existe plus.
    /joursVente/.test(app)
      ? ok('et il compte les jours de VENTE, la seule date connue pour toutes')
      : nok('le CA par jour doit se compter sur la date de vente');
  }
}

// 13) LA RECHERCHE NE DOIT PAS BLOQUER LA FRAPPE.
// Mesuré le 7 septembre : l'écran Ventes rend 287 cartes et 8 840 nœuds. Chaque
// lettre tapée les refiltrait toutes — 293 ms sur ordinateur, 179 sur téléphone.
// Taper « salomon » coûtait deux secondes de saccade. `useDeferredValue` garde
// le champ instantané et laisse React refiltrer juste après : ~150 ms.
{
  /React\.useDeferredValue\(ordSearch\)/.test(app)
    ? ok('la recherche des ventes ne bloque plus la frappe')
    : nok('sans `useDeferredValue`, chaque lettre refiltre 287 cartes');
  /ordSearchDiff\.trim\(\)/.test(app)
    ? ok('et c\'est bien la valeur différée qui filtre')
    : nok('`matchOrd` doit lire la valeur différée, pas celle du champ');
}

// 14) L'ÉCRAN VENTES NE DESSINE QU'UNE TRANCHE — mais rien n'est perdu.
// Mesuré : 287 cartes d'un coup, 46 209 px sur iPhone (54 écrans). On en rend
// 60, le bouton porte le TOTAL, et les totaux du haut ne bougent pas : ils
// portent sur l'ensemble, pas sur la tranche.
{
  /const ventesAffichees = useMemo/.test(app)
    ? ok('la liste des ventes est calculée une seule fois')
    : nok('la chaîne de filtres ne doit pas vivre en plein milieu du JSX');
  /ventesAffichees\.slice\(0, ventesMax\)/.test(app)
    ? ok('et l\'écran n\'en dessine qu\'une tranche')
    : nok('287 cartes d\'un coup font 46 209 px sur iPhone');
  /Voir plus — \{ventesMax\} affichées sur \{ventesAffichees\.length\}/.test(app)
    ? ok('le bouton « Voir plus » porte le total — rien n\'est caché')
    : nok('le bouton doit dire combien de ventes existent en tout');
  // ⚠️ Une recherche doit repartir du haut, sinon « 240 affichées » resterait
  // écrit sur une liste qui n'en compte plus que trois.
  /setVentesMax\(60\); \}, \[vFilter, ordSearchDiff, periode, showHidden\]/.test(app)
    ? ok('changer de filtre ou chercher repart du haut')
    : nok('la tranche doit se remettre à 60 quand la liste change');
}

// 15) L'ÉCRAN ACHATS : même tranche, même règle, et un prix en français.
// Mesuré au banc, onglet « Tous » : **72 880 px de page sur iPhone** —
// quatre-vingt-six écrans — pour 544 commandes rendues d'un coup. Et le prix
// s'écrivait à l'anglaise (« 21.0 € », « 6.73 € »), le montant brut de Vinted
// recopié tel quel.
{
  /const achatsAffiches = useMemo/.test(app)
    ? ok('la liste des achats est calculée une seule fois')
    : nok('la chaîne de filtres ne doit pas vivre en plein milieu du JSX');
  /achatsAffiches\.slice\(0, achatsMax\)/.test(app)
    ? ok('et l\'écran n\'en dessine qu\'une tranche')
    : nok('544 commandes d\'un coup font 72 880 px sur iPhone');
  /Voir plus — \{achatsMax\} affichés sur \{achatsAffiches\.length\}/.test(app)
    ? ok('le bouton « Voir plus » porte le total')
    : nok('le bouton doit dire combien d\'achats existent en tout');
  !/\{o\.price\?\.amount\} \{cur\(/.test(app)
    ? ok('le prix d\'un achat s\'écrit en français')
    : nok('« 21.0 € » : deux décimales et une virgule, comme partout ailleurs');
  // ⚠️ §4.6 — un `useMemo` s'exécute IMMÉDIATEMENT : posé avant `achatStage`,
  // il a tué l'écran Achats (« Cannot access 'Xc' before initialization »).
  app.indexOf('const achatsAffiches') > app.indexOf('const achatStage')
    ? ok('et il est déclaré APRÈS tout ce qu\'il lit (piège TDZ)')
    : nok('`achatsAffiches` doit venir après `achatStage` et `trackForBuy`');
}

// ── UNE SONDE QUI N'A PAS RÉPONDU N'EST PAS UNE ALERTE ─────────────────────
// Panneau « Sécurité des données » (Réglages) : il sonde la base à chaque
// ouverture. Deux de ses cinq lignes écrivaient `ok={s.X === true}` — donc un
// sondage RATÉ (`null`) devenait `false`, c'est-à-dire le triangle d'alerte.
// Vu en capture le 7 septembre : « Création de compte · … » en ambre, avec en
// dessous le diagnostic complet d'un problème qu'on n'avait pas mesuré.
// Sur un panneau de SÉCURITÉ, une fausse alerte est ce qui fait cesser de lire
// les vraies. `Ligne` sait afficher l'attente (`ok === null`) — c'est
// l'appelant qui écrasait l'information.
{
  const lignes = [...app.matchAll(/<Ligne\s+t="([^"]+)"\s+ok=\{([^}]*)\}/g)];
  lignes.length >= 4
    ? ok(`le panneau de sécurité a ses ${lignes.length} sondes`)
    : nok('le panneau de sécurité a perdu ses lignes', String(lignes.length));
  // La règle : « je ne sais pas » doit rester DISTINCT de « c'est faux ».
  // ⚠️ TROISIÈME FOIS QUE JE ME FAIS PRENDRE : mon premier jet exigeait la
  // formule `== null ? null`, et criait donc au loup sur `ok={s.colonne}` (qui
  // laisse passer le `null` tel quel — c'est exactement ce qu'on veut) et sur
  // `ok={ext === undefined ? null : …}`. Suivre la RÈGLE : est fautive une
  // expression qui APLATIT en booléen sans jamais pouvoir rendre `null`.
  const ecrase = lignes.filter(([, t, expr]) => {
    const e = expr.trim();
    if (/\bnull\b|\bundefined\b/.test(e)) return false;      // sait rendre « inconnu »
    return /(===|!==)\s*(true|false)\s*$/.test(e) || /^!!/.test(e);
  }).map(([, t]) => t);
  ecrase.length === 0
    ? ok('aucune ne transforme « pas su » en alerte')
    : nok('une sonde ratée s\'affiche comme un défaut', ecrase.join(', '));
}

// ── UNE ALERTE QUI VISE TOUT NE VISE RIEN (écran « Stock Vinted ») ────────
// Vu en capture le 8 septembre, à 1512 px : « ⚠️ Incohérences avec le garage —
// En ligne mais absent du garage (1815) », puis **1815 pastilles ambre**, puis
// la liste elle-même qui redéroulait les **1815 numéros** avec un contour ambre
// sur CHACUN. Cause : `garageNums` est vide (mesuré — 0 paire posée dans le
// garage 3D), donc la soustraction rend TOUT. Ce n'est pas une incohérence,
// c'est un garage qu'il n'utilise pas encore.
// Mesuré après correction : **20 146 → 1 850 caractères**, 1815 → 200 pastilles,
// et **1** pastille colorée au lieu de 1815.
{
  // ⚠️ La fenêtre se cale sur la FIN RÉELLE du composant (la fonction suivante),
  // pas sur un nombre de caractères au jugé : mon premier jet coupait à 9 000 et
  // ratait le rendu de la liste — deux contrôles rouges sur du code correct.
  const i = app.indexOf('function StockVinted');
  const j = i < 0 ? -1 : app.indexOf('\nfunction ', i + 10);
  const S = i < 0 ? '' : app.slice(i, j < 0 ? app.length : j);
  dit_bloc(S);
}
function dit_bloc(S) {
  /const garageVide = garageNums\.size === 0/.test(S)
    ? ok('« Stock Vinted » sait si le garage sert')
    : nok('sans ça, « absent du garage » vaut 100 % et n\'apprend rien');
  /!garageVide && \(enLignePasGarage\.length>0/.test(S)
    ? ok('et il ne crie pas « incohérence » sur un garage vide')
    : nok('une alerte qui vise TOUT ne vise rien');
  /const absentGarage=!garageVide && !garageNums\.has\(n\)/.test(S)
    ? ok('le contour ambre de chaque pastille suit la même règle')
    : nok('1815 pastilles ambre = aucune');
  // ⚠️ ET AUCUNE LISTE NE SE DÉROULE SANS PLAFOND (même motif que Ventes/Achats).
  (/liste\.slice\(0,listeMax\)/.test(S) && /Voir plus — \{listeMax\} affichés sur \{liste\.length\}/.test(S))
    ? ok('la liste se lit par tranche, le total écrit sur le bouton')
    : nok('la liste déroulait 1815 numéros d\'un coup');
  (/enLignePasGarage\.slice\(0,ecartsMax\)/.test(S) && /Voir plus — \{ecartsMax\} affichés sur \{enLignePasGarage\.length\}/.test(S))
    ? ok('les écarts aussi')
    : nok('les écarts déroulaient tout');
}

console.log(ko ? `\n${ko} contrôle(s) en échec.` : '\nAucun chiffre ne peut se présenter comme complet sans l’être.');
process.exit(ko ? 1 : 0);
