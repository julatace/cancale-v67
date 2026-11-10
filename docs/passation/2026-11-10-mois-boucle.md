# 10 nov. 2026 — Lots BK et BL : « Mois bouclé » et « Comparer deux mois »

Branche `claude/mois-boucle` (depuis `origin/main`, puis un vrai `git merge origin/main`). Pas de
PR, pas de fusion. L'extension n'est pas touchée. Validé par Julien : peu de texte, du visuel.

## BK — « Mois bouclé » (Argent → Déclarer)

Une carte blanche (DA6, rayon 24) sous « Prochaine déclaration », pour un micro-entrepreneur
seulement (`vinted_regime === 'micro'`) :
- en tête « Mois bouclé » et un sélecteur de mois (le dernier mois FINI par défaut ; le mois en
  cours et les 12 d'avant au choix) ;
- l'état en une ligne : « Octobre est prêt à déclarer » + le montant (34/800, la seule touche
  d'accent), ou « N choses à régler », « Pas tout vérifié », « Vérification… », « noté déclaré » ;
- la liste : un rond par ligne — ✓ gris (réglé, dit au passé : « Ventes datées », « Prix d'achat
  saisis », « Comptes relus », « Frais connus »), le nombre en AMBRE (un geste), « — » (pas su,
  avec sa raison courte). Une ligne à régler est un bouton (≥ 44 px) qui ouvre l'endroit où la
  régler :
  - Ventes à dater → Résumé, « Vendu et reçu » ouvert (rien n'est daté par VRM : choix de Julien en
    attente) ;
  - Prix d'achat à saisir → Annonces, saisie en série (`DEMANDE_SAISIE_PRIX`) ;
  - Comptes à relire (noms en `vrm-sensible`) → Comptes liés ;
  - Frais inconnus → Ventes ;
  - Mois en cours (« jusqu'au 30 nov. ») : pas de porte, le mois n'est jamais prêt avant sa fin ;
  - Montant incomplet (un minimum que les lignes au-dessus n'expliquent pas : ventes au montant
    pas lu, CA calculé avant la fin du mois) → Ventes.

### Aucune règle neuve — `src/moisBoucle.js` (pur) RANGE
- montant du mois = `montantPeriodeUrssaf` sur une période d'UN mois (`dueDuMois`) — la règle de
  la carte « Prochaine déclaration », du rappel et du serveur ; daté au VERSEMENT ;
- à dater = `ligne.aDater.n` de la même publication (`vinted_urssaf_mois`) ;
- prix d'achat = `n − nCout`, frais = `fraisInconnus` de `beneficeDesJours` sur `vrm_benefice_jours`
  (mois que la publication ne couvre pas ⇒ pas su) ;
- comptes pas relus = la ligne de fraîcheur unique : `LigneFraicheur` PUBLIE désormais son
  résultat (`publierFraicheur`, src/fraicheur.js, en mémoire — aucune écriture), Mois bouclé le lit
  (`suivreFraicheur`). Comptés : retards `compte` et `panne` (pas les ACHATS d'un compte) ; pas
  publiée/en cours ⇒ « Vérification… » ; cachée (hors ligne, base, rien de relié) ou extension pas
  vérifiable ⇒ pas su ;
- déclaré = `moisDeclare` sur `vrm_urssaf_declare` (registre pas lu ⇒ en cours).
- **Prêt** = toutes les lignes lues à zéro ET le montant lu complet. Une ligne en cours ⇒ en
  cours ; une ligne pas sue ⇒ « Pas tout vérifié » ; jamais « prêt » sur un « pas su ».

## BL — « Comparer deux mois » (Argent → Statistiques)

La carte « Comparer » existante (4 nov.) devient : deux sélecteurs de mois (le mois en cours et les
24 d'avant ; défaut : ce mois et le mois d'avant, ou l'an dernier si c'était son choix ; choix
gardé sur l'appareil, `vrm_comparer_mois`), cinq lignes dans l'ordre de Julien — Vendu, Reçu,
Bénéfice, Ventes, Achats —, l'écart avec une flèche GRISE (↑ ↓ =), jamais rouge ni vert, et aucune
flèche quand un côté est « au moins » ou « — » (« — » dans la colonne). Le bénéfice dit sa
couverture (« 3/4 prix »).
- `src/comparerMois.js` : `comparerDeuxMois({ ymA, ymB, … })` ; `comparerMois` (mode) passe par
  lui, inchangé. Un mois EN COURS (A ou B) coupe l'autre au même quantième. Chaque ligne porte
  `sens` (null sans écart).
- Achats = les lignes du REGISTRE DES ACHATS du mois (`registreAchatsDe`, la carte « Registres » et
  l'export comptable : hors annulés, hors comptes écartés, hors plateforme, en gros) — `achatsEntre`
  garde celles de l'intervalle ; achats Vinted pas lus ou achats sans date ⇒ « au moins » (jamais
  « au moins 0 »). Le registre vit dans `ecrans/Compta.jsx` : Statistiques le charge à la demande
  (`import('./Compta.jsx')`, pas d'import statique — le texte recollé des audits le verrait deux
  fois). Une vente Vinted en lot compte pour UN achat (le registre compte des achats, pas des
  paires) ; un achat en gros aussi.
- Reçu = `recuAvecADater(recuPublieEntre(…))`, inchangé (jour du VERSEMENT).

## Preuves

- `node scripts/audit-mois-boucle.cjs` : **50 verts** ; exécute src/moisBoucle.js et
  src/comparerMois.js avec les vraies règles d'App.jsx, le vrai registre (src/registres.js) et
  `recuPublieEntre`, sur des données inventées. `--prouve` : **13/13 mutations rouges**
  (prêt avec un compte pas relu, fraîcheur en cours prise pour « relu », pas su ignoré, montant
  partiel tu, à dater tues, mois en cours bouclé, frais tus, flèche sur un « au moins », pas de
  coupe au même point, achats présentés complets, **reçu daté à la vente**, carte pas montée,
  fraîcheur pas publiée). Sur l'arbre d'`origin/main` (git archive) : 7 rouges.
- `audit-comparer-mois` : 23 verts (motif de la mutation `coupe` et branchement mis à jour) ; ses
  5 mutations rougissent toujours.
- Banc `scripts/bancs/mois-boucle.cjs` (vraie app, base servie avec projection ; l'écran Ventes
  ouvert d'abord PUBLIE CA et bénéfice — rien posé à la main dans ces lignes) : jeux P (prêt), R
  (paris_kicks pas relu 3 j), D (une vente à dater + un prix manquant) ; 390 tactile et 1512, clair
  et sombre. Voir résultats et mutations ci-dessous.
- `scripts/bancs/argent-mois.cjs` : la partie C suit les deux sélecteurs (le même mois l'an
  dernier se CHOISIT ; 44 px au lieu du segmenté).

## Ce qui reste
- « Paires achetées » : le registre compte des ACHATS (un lot Vinted = 1). Compter des paires
  demanderait une règle neuve (lots déclarés, achats en gros par `paires`) : à décider.
- Les ventes à dater bloquent « prêt » (elles font du montant un minimum) : quand Julien aura
  décidé quoi en faire, la ligne suivra la règle, rien d'autre à changer ici.
- Base injoignable : la ligne de fraîcheur n'est pas montée ⇒ Mois bouclé reste « Vérification… »
  (jamais prêt).

## Geste de Julien
Aucun.
