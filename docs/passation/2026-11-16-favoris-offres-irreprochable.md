# 16 nov. 2026 — Favoris et offres « irréprochables » (lot `favoris-offres-irreprochable`, extension 5.398.0)

Julien : « Pour les offres et messages aux favoris, je veux que ça soit irréprochable : on ne peut pas
se faire bloquer un compte Vinted. » Revue ADVERSE : on cherche comment un compte pourrait se faire
bloquer (ou envoyer un geste faux) en passant par les messages aux favoris (file serveur, mode auto,
carte du logo), les offres (offre jointe aux favoris, acceptation et refus automatiques, message de
refus, contre-offre de l'app) et la couche de sécurité des comptes (`secuGeste`, `secuObserver`).

Règles intouchables respectées (CLAUDE.md §3) : 50 actions/h/compte (réserve 5 ⇒ 45), délai aléatoire
3–20 min de l'acceptation (30–120 min la nuit, 5.370), rythme « comme Vintex », **pas** de plafond de
10 messages/60 min (retiré, non remis), aucune « théorie vanessa5723 », rien de piloté au clavier/souris.

## ÉTAT À LA REPRISE
- Branche `claude/favoris-offres-irreprochable` (depuis `origin/main` 5a9abe571), poussée.
- Extension **5.398.0** réservée (`versions-reservees.txt` : 5.394–5.397 pris par d'autres lots).
  CODE_VERSION, manifeste, capteur et relais Leboncoin, `EXT_ATTENDUE`, `extension-version.json`, notice
  Orion ; capacités `relueoffre` (`relireOffre`) et `salutation` (`texteJamaisRepete`) à 5.398.0 ; zips
  régénérés (Chrome, Orion).
- Preuve : `node scripts/audit-favoris-offres-irreprochable.cjs` (17 contrôles), `--avant` (rouge sur
  `origin/main`), `--mutation=toutes` (7 mutations, chacune rougit).
- Geste de Julien : installer 5.398.0 (remplacer le dossier, ⟳ dans chaque Chrome). Rien d'autre.

## Ce qui a été cherché, et ce qui a été trouvé

| # | risque (comment un compte pourrait se faire bloquer, ou un geste partir faux) | état trouvé | correction | preuve (rouge sans elle) |
|---|---|---|---|---|
| 1 | Deux envois à la même personne pour la même annonce (deux Chrome, deux onglets, plantage, rechargement) | **tenu** : autorisation serveur à usage unique (`consommerFile`), une tentative en vol (`enCours`), réponse perdue ⇒ « incertain », jamais renvoyée ; côté Vinted, un fil qui porte déjà un message ⇒ « ignoré » | — | `tests/favoris-automatisation.test.mjs` (existants) |
| 2 | …mais un favori **refusé après une écriture** (conversation ouverte, offre faite, message refusé) redevenait sélectionnable par une nouvelle file ; seule la relecture du fil chez Vinted le protégeait | **défaut** | le dédoublonnage du lancement garde « connu » un refus dont `ecrits` ≥ 1 ; un refus à 0 écriture reste relançable | S1, S2 · mutation `dedoublon` |
| 3 | Agir au nom d'un autre compte que celui de l'onglet | **tenu** : `gardeStricte`/`garde`, relu DANS le tour de la file et juste avant chaque écriture ; `pageVintedPour` exige l'onglet du domaine ET le cookie du compte | — | `audit-favoris-vintex`, `audit-securite-comptes` |
| 4 | Deux requêtes Vinted en même temps | **tenu** : `requeteVinted` (une à la fois), `avecVinted` | — | `audit-compteurs-concurrents` |
| 5 | 429/403 et Retry-After | **tenu** : pause à paliers au moins égale au Retry-After (`secuRetryAfterMs`), prudence 24 h, frein du mode auto 24 h | — | `audit-securite-comptes` |
| 6 | Contrôle anti-robot (DataDome, captcha, défi) : les gardes le vérifiaient AVANT un geste, mais une requête partie APRÈS dans le même geste (message d'un refus d'offre, offre puis message d'un favori, renouvellement de session) ne revérifiait rien | **défaut** | arrêt À LA SOURCE : `requeteVinted` refuse toute requête d'un compte sous vérification (`robotDeLaRequete` : `secuRobotDit` + arrêt `captcha`), page, service worker ou lecture ; reprise inchangée (lecture normale passive, ou SA reprise) | E1, E2 · mutation `source` |
| 7 | « Tout arrêter » ou un captcha pendant le temps d'écriture (5 à 45 s) : le message partait quand même | **défaut** | `attendreEcriture` revérifie à chaque tranche « Tout arrêter » (sauf sur SON clic) et la vérification anti-robot (même sur son clic) | E3 · mutation `ecriture` |
| 8 | Repos de nuit, « n'agir que si tu es là », journée calme, plafond par jour, plafond par type, compte récent : appliqués au mode auto | **tenu** : `secuGeste(…, 'auto')` avant chaque favori auto et chaque offre auto | — | `audit-securite-comptes` (R/E) |
| 9 | Rafale, minute ronde | **en partie** : la couche impose plancher + aléa ; mais un temps FIXE choisi entre deux favoris (« 2 min ») tombait pile sur la minute | un temps fixe = le minimum + 1 à 29 s (rejouable, même jeton) ; « 0 » reste « comme Vintex » (6 à 9,6 s) ; l'aléatoire min–max inchangé | S3 · mutation `minute` · `tests/favoris-temps-aleatoire.test.mjs` porté |
| 10 | Plafond horaire compté par compte tous Chrome confondus | **tenu** : `publierActions` (5.312), 2–3 places réservées par favori, rendues si rien ne part | — | `audit-favoris-ecritures`, `audit-jauge-journal` |
| 11 | Le même texte, à l'octet près, envoyé à la chaîne (une seule version écrite) | **défaut** : « personne ne reçoit exactement la même phrase que le précédent » n'était vrai qu'avec 2 versions ou plus | `texteJamaisRepete` (bloc `<variantes-regle>`, recopié) : si le texte final est celui d'un des 3 derniers partis de ce compte (favoris et refus d'offre), SEULE la salutation change (Bonjour · Salut · Hello, avec ou sans le pseudo lu dans le fil) ; aucun autre mot touché, sans IA ; empreintes rangées, jamais le texte. Dit sous l'éditeur des versions (`versions.uneSeule`, 5 langues) | E11, E12, E13 · mutation `texte` |
| 12 | Texte vide, variables non remplies, mot qui fait bannir | **tenu** : `erreurVariablesFavori`, `{prix}` inconnu ⇒ rien, `risquesMessage` ⇒ jamais un message auto | — | `audit-favori-offre-message`, `favoris-message.test.mjs` |
| 13 | Offre (auto) jamais sous le prix mini sans sa confirmation | **tenu** : `o.prix >= min`, mini à virgule lu (`seuilOffreLu`), entre deux seuils rien | — | `audit-moteur-offres`, `audit-prix-mini` |
| 14 | Offre auto sur une offre **qui n'attend plus** : le moteur agissait 3 à 20 min après sur la conversation CAPTÉE (photo datée) ; une offre retirée, déjà traitée sur Vinted ou depuis un AUTRE Chrome (chaque Chrome a son mémo) recevait quand même un geste (et, pour un refus, le message) | **défaut** | le fil est RELU depuis l'onglet juste avant (`relireOffre` : `GET /api/v2/conversations/{id}`, ce que le site fait en ouvrant la conversation) ; le geste ne part que si CETTE offre (n°, prix, article) attend encore ; plus en attente ⇒ close sans geste ; lecture ratée ⇒ rien, l'offre reste prévue | E4, E5, E6, E7 · mutation `relecture` |
| 15 | Acceptation sur une annonce **réservée, masquée, fermée, supprimée** (la garde ne voyait que « vendue ailleurs ») | **défaut** | `annonceIndisponible` : une PREUVE seulement (champs mesurés du dressing : `is_closed`/`item_closing_action`, `is_reserved`, `is_hidden`, `is_draft` ; suppression vue) ⇒ jamais acceptée, dit une fois ; pas de preuve ⇒ comme avant (« pas su » ne vaut pas « oui », mais une absence n'est pas une vente) | E8 · mutation `annonce` |
| 16 | Favori (offre et/ou message) sur une annonce qui n'est plus disponible | **en partie** : l'app écartait les ventes prouvées ; l'extension, elle, ne regardait rien | même preuve AVANT toute écriture (dressing capté, suppressions : 0 requête Vinted) puis sur l'objet `item` de la transaction relue (ni offre ni message) ; raison `annonce_indisponible` (serveur, écran, mode auto : avant écriture) | E9, E10 |
| 17 | Une erreur Vinted nommée renvoyée telle quelle | **tenu** : favoris ⇒ file arrêtée, raison dite ; offre auto ⇒ notée « faite » après tout geste ; refus « restreint » ⇒ frein 24 h | — | `audit-moteur-offres`, `audit-offres-sures` |
| 18 | Forme des requêtes vs vinted.fr | **tenu** pour tout geste automatique : depuis l'onglet (`vintedPage` : cookies du site, csrf de la page, `x-anon-id`, aucun `Authorization`), corps relevés (`corpsReponseVinted`, offre `{offer:{currency,price}}`, conversation à 3 champs, mesurés sur Vintex le 29 oct.) | — (la relecture du fil ajoutée part aussi de la page, forme captée) | E7, `audit-favoris-vintex` |
| 19 | Sur SON clic dans l'app sans onglet vinted.fr ouvert (téléphone, autre navigateur), la commande part encore du service worker (`vintedSend`, `Bearer`) | **accepté (sa décision 5.342)** : un geste humain, un à la fois, dans le plafond ; tout ce qui est AUTOMATIQUE exige l'onglet | rien changé ; noté ici pour une décision future | — |
| 20 | Journal clair | **tenu** : « Ce que VRM a fait » (`noterJournal`) seulement pour un geste ACCEPTÉ par Vinted ; diag par cause (`offre_auto_plus_en_attente`, `offre_auto_annonce_*`, `favori_annonce_*`, `favori_salutation_variee`, `vinted_robot_refus_file`, `ecriture_annulee_*`) | — | `audit-jauge-journal` |

## Ce qui n'a pas pu être mesuré (rien d'inventé)
- L'objet `item` de `GET /api/v2/transactions/{tx}` n'a jamais été vu avec ses champs d'état : la règle
  ne lit que les champs MESURÉS du dressing (mêmes noms), et seulement comme preuve (absent ⇒ rien).
- Le seuil de Vinted reste inconnu : aucun plafond nouveau, 50/h reste SA décision.

## Tests portés (sur la règle, pas affaiblis)
- `audit-moteur-offres.cjs` : le faux Vinted rend aussi le FIL tel qu'il est chez lui (le moteur le relit).
- `tests/favoris-temps-aleatoire.test.mjs`, `tests/favoris-automatisation.test.mjs` : « fixe = exactement
  N min » devient « N min + 1 à 29 s, jamais une minute ronde ».
