# Messages aux favoris en trois temps (11 nov., lot `favoris-clair`)

Julien : « les messages aux favoris, on peut faire en sorte que ce soit BEAUCOUP plus beau et plus
COMPRÉHENSIBLE ? » + ajouts validés (coordinateur, même jour) : nouveaux favoris seulement par défaut,
garde-fou de marge, offre groupée, « Ce qui marche », carte « nouveaux favoris » dans Ma journée.
Branche `claude/favoris-clair` (partie d'`origin/main`, `origin/claude/suivi-travail` fusionnée).
**Aucune règle d'envoi ni garde-fou changé** ; aucune extension touchée ; rien envoyé en vrai.

## Ce qui change à l'écran (Messages → Favoris & offres → Favoris)

L'écran « Fusion » du 3 nov. (carte sombre, une carte par article, pile d'initiales, « Envoyer » par
article puis « Lancer » dans une feuille) est remplacé par UNE page en trois temps
(`src/FavorisEtapes.jsx`, style `src/design/favoris-clair.css`, règles `src/favorisParcours.js`) :

1. **Qui** — les annonces qui ont des favoris : photo, titre, N°, prix, « 4 personnes · 2 à écrire ».
   **Jamais qui** : plus aucun pseudo ni initiale à l'écran (le détail par personne est retiré ; il reste
   dans « Plus d'outils », l'ancienne feuille, pour les gestes techniques). On touche une annonce pour la
   choisir ; « Tout choisir » / « Aucune ». **Nouveaux favoris seulement par défaut** : ceux arrivés après le
   dernier envoi confirmé (`dernierEnvoi`) ; les plus anciens sont comptés à part, « Inclure les anciens »
   les ajoute ; un favori sans date lisible n'est jamais « nouveau ». Jamais deux fois la même offre à la
   même personne pour la même annonce : c'est la file serveur qui le garantit (clé `annonce:personne`
   prouvée), inchangée. Au plus **10 messages par envoi** (la file refuse au-delà) : « N attendront le
   prochain ». En ambre : « N messages à vérifier sur Vinted » (→ Vérifier) et « VRM ne sait pas encore à
   qui écrire » (→ Ouvrir). Les annonces sans rien à écrire sont repliées (« N autres annonces »).
2. **Quoi** — le message (champ direct, plus de feuille « Modifier »/« Enregistrer » : il est enregistré au
   lancement par `preparerReglages`, comme avant), « + Son pseudo » / « + Bonjour ou Salut » et UNE phrase
   qui explique les deux variables ; l'offre : Sans · En % · En € · Prix fixe (+ −5/−10/−15/−20 %, arrondi).
   **L'aperçu tel que l'acheteur le verra** : la ligne de l'annonce (prix barré → prix de l'offre) et la
   bulle, `{username}` rendu en pastille « son pseudo » (jamais un pseudo réel ni inventé), la variante
   montre son premier choix ; « Offre à 85,50 € au lieu de 95 € · −9,50 € (−10 %) » (`prixOffreFavori`,
   la règle recopiée dans l'extension). Prix pas lu ⇒ « — » et la raison.
3. **Quand** — « Maintenant, comme Vintex » (« le premier part tout de suite, puis un toutes les 6 à
   10 secondes, au hasard, depuis ton onglet vinted.fr ouvert ») ou « Espacé » (toujours pareil / au hasard,
   en minutes) ; le **mode auto** (ModeAutoFavoris inchangé) dans sa petite carte sombre.

**Le pied** collé en bas : « 5 messages · 3 annonces · environ 32 s » + « Vérifier et envoyer ».
**Le récapitulatif** (feuille) : la même ligne, « 15 gestes · dans la limite de 45 gestes par heure »
(2 par message, 3 avec l'offre — X3 ; jauge `actions_compte_*` lue, sinon « pas lue, l'extension la tient
quand même »), une ligne par annonce (N messages, offre à X €, **ce qui reste après remise et frais** avec
SON prix d'achat relié par identité — `plancherVente`, la règle du bénéfice ; « — (prix d'achat pas saisi) »
sinon), le rythme, « **Aucune garantie contre un blocage Vinted.** Garde vinted.fr ouvert… ».
**Garde-fou de marge** : une offre **à perte** ou **sous le prix mini** (`fiche.min`) est BLOQUÉE —
« Envoyer » grisé tant que « Je confirme : envoyer quand même » n'est pas coché. Puis « Envoyer N
messages » = SON clic = l'unique `lancer` de la file.

**Le suivi en direct = la feuille commune « VRM travaille »** (`SuiviTravail`, lot suivi-travail) :
`AutomatisationFavoris` démarre le travail au lancement (une ligne par message, désignée par le N° et le
titre de l'annonce, jamais la personne), suit les étapes de l'extension (préparation, conversation,
vérification, fil relu, offre, message, confirmation), la pause entre deux messages (compte à rebours sur
`vue.prochain`), puis chaque issue : envoyé ✓ · à vérifier = « à finir à la main » (jamais réussi) · refus
avec la raison et le geste (`RAISONS_ECRAN`) · sauté (conversation existante, arrêté). « Mettre en pause »
= le moteur s'arrête entre deux messages (la file serveur reste active) ; « Reprendre » ; « Arrêter » =
`arreter` de la file (le reste est annulé, rien ne part). Un rechargement : la feuille revient
« Interrompu » (règle du lot suivi-travail), la file serveur, elle, continue comme avant quand l'écran est rouvert.

**L'historique** : « N messages envoyés · M achats après un message » ; un achat ne compte que s'il est
prouvé par **la même annonce** (n° d'annonce de la transaction, `txnItem`) **ET la même personne** (l'autre
personne de la conversation de la vente = le destinataire prouvé par le serveur, `id` « annonce:personne »)
**ET après le message**. Acheteur pas su (conversation pas lue) ⇒ dit à part, pas compté. **Ce qui marche** :
par envoi (lot), « 1 achat(s) sur 3 », la remise portée (−10 %, −5 €, à 45 €, sans offre ; la vue de la file
projette maintenant `offre {mode, valeur}` — projection seule, `api/_lib/favoris-file.js` `vueFile`).
**Offre groupée** : une personne (identité prouvée par la file, jamais un pseudo) qui a plusieurs de ses
annonces ⇒ « une offre groupée peut lui plaire · Lot de 2 : 185 € → 166,50 € à ta remise · À faire sur
Vinted : VRM ne sait pas encore faire une offre groupée » (aucune recette d'offre lot dans l'extension :
rien n'est inventé). ⚠️ Tant qu'un favori n'a jamais été envoyé, VRM ne connaît pas la personne : la
détection ne voit que les personnes déjà contactées.

**États vides** : pas de compte ⇒ « Choisis un compte Vinted au-dessus » ; jamais vu ⇒ « ouvre la cloche de
Vinted sur ce compte » + « Ouvrir Vinted » ; aucun favori ⇒ une phrase + « Ouvrir Vinted » ; rien à écrire ⇒
« Tout le monde a déjà eu ton message ».

**Ma journée** : carte « 5 annonces ont de nouveaux favoris depuis hier · Envoyer une offre »
(`src/favorisJournee.js` : la même lecture `lireFavorisVinted`, compte de Messages, 24 h, annonces prouvées
vendues écartées, relue toutes les 30 min ; pas lue ⇒ pas de carte). Le geste ouvre Messages → Favoris
avec ces annonces CHOISIES (`vrm_favoris_prepare` en sessionStorage, 10 min) ; rien ne part sans le
récapitulatif et « Envoyer ». Rangée dans « Modifier ma journée » (id `favoris`, `src/journeePerso.js`).

Textes : 135 clés `favoris.*` en 5 langues ; `src/FavorisEtapes.jsx` ajouté aux écrans migrés
d'`audit-traduction`. Le journal du suivi reste en français (trace copiable, règle du lot suivi-travail).
« Quoi de neuf » : `favoris-clair`. PAS de modèles de message multiples (refusé).

## Clics (3 annonces avec des favoris à écrire, message déjà enregistré)

- **Avant** (écran Fusion) : par annonce « Envoyer » (1) → feuille d'envoi → « Lancer » (1), et il fallait
  attendre la fin de la file pour l'annonce suivante : **6 clics + 2 attentes** ; changer le message :
  « Modifier » + édition + « Enregistrer » (2 de plus). Plusieurs annonces d'un coup : « … » → cocher
  chaque favori un par un → Continuer → Continuer → Lancer (≈ 4 + 1 par favori).
- **Après** : « Tout choisir » (1) → « Vérifier et envoyer » (1) → « Envoyer » (1) = **3 clics**, toutes les
  annonces dans le même envoi ; (+1 « Je confirme » seulement si une offre est à perte ou sous le mini) ;
  le message se modifie en place. Depuis Ma journée : la carte (1) → « Vérifier et envoyer » (1) → « Envoyer » (1).

## Preuves

- `node scripts/audit-favoris-clair.cjs` : **29 ✅** (règles exécutées) ; `--prouve` : rouge sur
  origin/main (règle absente) + **11 mutations toutes rouges** (plus de 10 par envoi, anciens proposés,
  offre à perte libre, prix mini ignoré, achat sans la personne, achat d'avant le message, acheteur pas su
  compté, à vérifier compté réussi, groupée sans identité, gestes sans l'offre, durée inventée).
- Banc `scripts/bancs/favoris-clair.cjs` (remplace `favoris-ecran.cjs`, qui jugeait l'écran retiré) : vrai
  `FavorisVinted` + vraie feuille `SuiviTravailHote`, fausse file serveur À ÉTAT, extension bouchonnée
  (« envoyé », puis « offre refusée » au 3e), 390 tactile / 1512, clair / sombre ; mutations `FC_MUTANT`.
  **122 ✅** (base, clair + sombre, 390 + 1512 ; après correction du repère de couleur : le bleu
  d'accent du mode sombre #409CFF était hors de la plage permise du banc), `FC_JEU=vide` 12 ✅,
  `absente` 12 ✅. Mutations toutes rouges : `max` 12 ❌, `nouveaux` interrompu (rouge), `marge` 2 ❌,
  `histo` 4 ❌, `suivi` 8 ❌, `envoi` (lancer sans clic) interrompu (rouge).
  Captures REGARDÉES : 390 clair (qui, quoi, quand, historique, récap, suivi, fin), 1512 clair.
  Défauts vus et corrigés : « Il te reste au plus −4,50 € » ⇒ « Tu perds au moins 4,50 € » ;
  « Maintenant, comme… » coupé à 390 ⇒ « Comme Vintex » ; « 1 achat(s) sur 1 » ⇒ « 1 sur 1 ont acheté ».
- `npm run build` vert.
- Audits communs, `audit-favoris-ecran` (42), `audit-favoris-auto` (54), tests `favoris-*.test.mjs`,
  `audit-journee-perso`, `audit-traduction`.

## ÉTAT À LA REPRISE

Livré, poussé, `origin/main` fusionné (rien de neuf au dernier `git fetch`), `origin/claude/suivi-travail`
(856e49dca, `lancerTravail`) fusionné. L'envoi des messages garde l'API BAS NIVEAU de SuiviTravail
(`suivi.demarrer` + `surGeste`) : la boucle est pilotée par la file serveur et un minuteur (comme
Republier), pas par un `for` ; le mode auto (allumer, régler, arrêter) passe par `lancerTravail`
(une action, ne fige rien si < 1 s). Rien d'envoyé en vrai, aucune écriture en base, aucune extension touchée.
Restes / à regarder :
- La carte Ma journée « nouveaux favoris » n'est pas montée dans un banc (règle et rangement prouvés par
  `audit-favoris-clair` et `audit-journee-perso`) ; elle lit les favoris du compte de Messages
  (`favorisUid` : compte choisi, sinon celui de l'onglet Vinted) — un vendeur multi-comptes sans compte
  choisi ne voit que celui-là.
- L'offre groupée ne voit que les personnes DÉJÀ contactées (seule identité prouvée côté client) ; aucune
  recette d'offre lot ⇒ « à faire sur Vinted ».
- « Plus d'outils » (…) ouvre encore l'ancienne feuille (récupérer toutes les pages, vérifier un favori,
  diagnostic, « J'ai vérifié sur Vinted ») : elle montre des pseudos, comme avant ; à refaire plus tard.
- Banc rouge sur l'avant : lancé sur `git archive origin/main` (voir ci-dessous, ligne ajoutée si fini).
