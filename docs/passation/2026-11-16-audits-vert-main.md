# 16 nov. — lot `audits-vert-main` : les audits rouges de `main`

## Pourquoi
La règle « zéro rouge pour fusionner » (Julien, 16 nov.) bloquait toutes les PR : `main` portait **69 audits rouges**
(CI de la PR #1181, `c491cd8e7`, jobs « Audits (part 1-3/3) » : 25 + 27 + 17), arrivés avec les PR #1150–#1180
fusionnées sans que les audits tournent.

## Méthode
Pour chaque rouge, la cause d'abord. Deux familles :
1. **Vrai défaut de l'app** ⇒ l'app est corrigée.
2. **Audit périmé par une décision écrite** (refontes des 14–15 nov. : Studio, Verre, Ma journée refaite, Annonces refait,
   Paramètres en dix catégories, `lazySur`, notifications ≤ 40/90, traduction…) ⇒ l'audit est porté sur la RÈGLE actuelle,
   jamais affaibli ; chaque portage garde sa mutation rouge (`--prouve` rejoué là où l'audit en a).

## Vrais défauts corrigés dans l'app
- **Noms déclarés deux fois** une fois les écrans recollés (`partageFichiersPossible` dans Republier.jsx, `joursAvant` et
  `lireNumeroEcrit` dans Reglages.jsx) : renommés (même comportement). 6 audits qui lisent App.jsx d'un bloc (Babel) repassent.
- **Notifications qui perdaient l'essentiel sous la coupe des 40/90 signes** : modération (« 1 annonce masquée… » disparaissait
  du titre ⇒ passe en tête du corps), eBay (« ne poste pas » d'une annulation demandée tombait ⇒ gardée entière, le détail
  part), URSSAF (le montant à déclarer passait en queue et était coupé ⇒ corps raccourci, `embellir` juge la 1re phrase).
- **Carte des ventes** : la recherche de ville à la Base Adresse Nationale depuis le navigateur n'était pas dans la
  politique de confidentialité ⇒ ligne ajoutée (`public/legal/confidentialite.html`).
- **CSS du verre** : `@media (min-width: 744px)` allumait la mise en page ordinateur sur un iPhone couché ⇒ la règle de
  coque (`MQ_ORDINATEUR`) recopiée ; `styles-tablette.css` après toutes les feuilles hors studio.
- **Jour UTC** (`toISOString().slice(0,10)`) dans À venir, « déjà achetée », la recherche, les soldes ⇒ `src/dateParis.js`
  (`jourParis`, nouveau `jourDecale`).
- **N° comparés en texte** (`aRetirerAilleurs.js`) ⇒ `cleNum` (§5).
- **Photos de conversation** en `<img>` nu (FilsTous) ⇒ `PhotoVinted` ; `RangeeJ` sans `Photo` ne pose plus d'`<img>`.
- **Paramètres** : « Taille du texte » n'était dans aucune catégorie ; deux rangées au même dessin (`grid`) ⇒ icône `agrandir`.
- **Textes** : « Un appel avec Julien » (5 langues, ⇒ « avec VRM »), « Vintex » dans les mots de recherche, un texte eBay de
  94 signes, un glossaire de 23 mots, « chrome://extensions » en dur (⇒ la page des extensions de CE navigateur, 5 langues),
  une adresse d'exemple sans le mot « Exemple ».
- Écran « parrainage » permis au signalement ; fixture `.json` des bancs ⇒ module `.cjs` ; un rayon de 3 px.

## Audits portés sur la règle (décision écrite citée dans chaque commentaire `(16 nov.)`)
accueil-reste (N17 republiée, V11), aide-signalement, aide-videos (film de l'accueil public, borné), boite-emails /
temps-gagne / recherche-photo (`lazySur`), configuration-depart, conseils (`pnOuvert`), doublons-historique (filtre « deux
comptes »), journee-coherence, journee-perso, relier-compte, sante-comptes (feuille « Tout va bien ? »), lien-vc (feuille
« même photo »), ordre-recent (tuiles « transporteur connu »), qui-dorment, retraits-fiables, vintedgo-adresse,
note-achat-double (fiche D), recherche-fiche, impression-carton, annulees-chez-toi (tr()), annonces-coherence (AFaireHote,
ancres de mutation), mode-stream / stream-photos (œil au menu du compte), fraicheur-unique (ligne de la cloche),
morceau-perime (relecture de version, 15 nov.), recherche-vocale (langue de l'app), relances-essai (gabarit Verre),
suites-serveur (bilan du mois ≠ bilan de la semaine), alerte-moderation (≤ 40/90), benefice / offre-annonce-partie /
lien-vc / annonces-actions (SYNC_KEYS lu jusqu'à sa fin), photos-vinted (5 sources lues une à une), politique-hotes (liens),
coque-tablette (page publique des tarifs hors coque), stockage-sur (clés d'index comptées au plus juste : `key={k}` sur un
élément nommé n'est plus compté ; plafonds RESSERRÉS 278 → 182, 4/4 mutations), copies d'audit complétées
(`scripts/_copie-imports.cjs` : api/_lib importe src/ ; lbc-en-ligne, retraits-suivi, comptes-exclus, stock-etageres, litiges).

## ÉTAT À LA REPRISE
- PR ouverte depuis `claude/audits-vert-main` (voir la PR pour le chiffre exact des rouges restants après sa CI).
- **Restent rouges, non traités ici** (raison) :
  - Textes « paire / carton / chaussure » hors Sneakers : `audit-vocabulaire-article`, `audit-vendeur-generaliste`,
    `audit-config-facture` — une centaine de textes neufs des 14–15 nov. (i18n) à relire un à un ; la liste exacte est
    dans la sortie de chaque audit.
  - Extension (exige une version au-dessus de 5.397, réservée par d'autres lots) : `audit-infos-vinted` (vrm-regles-achat.js
    à recopier : `node scripts/regles-achat-extension.cjs --recopie`), `audit-confiance-publique` (vrm-badge.js),
    `audit-chemin-json-guillemets` (background.js + 3 fichiers app/serveur), `audit-extension-capture`, `audit-recap-bordereau`,
    `audit-bordereau-pdf` (`annoncerCapte`).
- Une passe complète locale (672 audits) n'a pas pu finir : machine partagée, 2 à la fois ⇒ ~3 h. La CI de la PR fait foi.
