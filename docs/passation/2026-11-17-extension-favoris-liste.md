# 17 nov. — Les favoris en liste à cocher dans la carte de l'extension (5.407.0)

Branche `claude/extension-favoris-liste`, partie de `origin/claude/extension-carte-v2` (#1247, 5.406).
Extension **5.407.0** (libre : aucune branche ni PR ouverte ne la portait le 17 nov.).

## Ce que Julien a dit

Après avoir vu la carte 5.406 sur vinted.fr : « il faut une liste avec les favoris pour pouvoir les
sélectionner etc ». Ses décisions du 12 nov. restent : par compte, du plus récent au plus ancien, une
case par favori, les favoris d'articles vendus retirés, « Rapide » (jamais « Vintex »), 8–20 s
aléatoires entre l'offre et le message.

## Ce qui change

Carte du logo sur vinted.fr → segment **Favoris** :

- **La liste** de TOUS les favoris du compte de l'onglet dont l'article est encore en vente (300 au plus,
  les plus récents), du plus récent au plus ancien. Chaque rangée : une case (cible 44 × 44 px), la photo
  avec son étiquette N° en kraft (par identité d'annonce, `infosDuCompte`, compte de l'onglet seulement),
  le titre (2 lignes), « acheteur · il y a 2 h », le prix (barré + prix de l'offre quand il y en a une).
  Une rangée se touche entière.
- **Déjà contacté** : la rangée reste visible, grisée (la photo, jamais le texte), case inactive, la raison
  écrite : « offre déjà envoyée », « message déjà envoyé », « message en cours », « à vérifier sur
  Vinted », « pas envoyé, pas reproposé », « destinataire pas encore sûr : ouvre ce favori depuis la
  cloche de Vinted », « prix de l'offre pas calculable ».
- **En haut** : « 12 cochés · 15 au plus par envoi », « Tout cocher » (les 15 plus récents visibles qu'on
  peut contacter) / « Rien » ; les filtres « Toutes les annonces (N) » (une annonce, avec son N°) et
  « Pas encore contactés ». « N favoris d'articles vendus ou retirés : cachés ».
- **Un seul plein** : « Envoyer à 12 favoris » ⇒ un **récapitulatif** : par annonce (photo, N°, combien de
  favoris, prix → offre), « Avec une offre −10 % », le message (une de ses N versions, au hasard), la
  durée au vrai rythme (« Environ 25 min · 15 par heure maximum ») ; « Confirmer l'envoi » lance, « Retour
  à la liste » revient. Puis l'écran « action en cours » de la 5.406 (Tout arrêter, Réduire) tel quel.
- **Le choix survit** à un rechargement : `chrome.storage.local.vrmFavSelection[uid]` (par compte, 30 j),
  réduit aux favoris encore cochables ; sans choix gardé, les 15 plus récents.
- 300 rangées restent fluides : cocher ne redessine rien (le compteur et le bouton suivent sur place, deux
  cases < 50 ms mesuré), `content-visibility: auto` sur les rangées, images paresseuses ; le défilement
  est gardé à chaque redessin (`data-defil`).
- Textes neufs en 5 langues dans `vrm-ui.js` (`fl_*`, `fr_*`).

## Une seule règle par notion

- Le serveur (`api/_lib/favoris-carte.js`, `apercuCarte`) rend `tous` avec les MÊMES règles qu'avant
  (`etatFavori` de l'app, `etatAnnonceAuto`, destinataire prouvé, `prixOffreFavori`,
  `personnaliserMessageFavori`) : un favori est `cochable` exactement quand l'envoi d'avant l'aurait
  retenu (`liste`) — l'audit le vérifie. Vendue (ici ou ailleurs), réservée, en pause, fermée, absente du
  dressing ⇒ cachée et comptée (`retires`). `liste` et `selection` restent (cartes d'avant).
- La carte ne décide rien : elle trie, filtre, coche.
- Durée : chaque message ≈ 45 s (ouvrir, offre, 8–20 s, écriture) + l'écart choisi (« Rapide » 6–10 s), au
  plus 15 par heure (`dureeFavMs`, vrm-badge.js) — une estimation, dite « environ ».

## Les gardes (aucune retirée)

Nouvelle garde dans le fond (`favorisCarte`, `lancer`) : seulement des favoris **cochables de l'aperçu
montré** de ce compte (`vrmFavorisApercu[uid].cochables`, `cochablesApercu`), lu il y a moins de 30 min ;
après un lancement l'aperçu gardé est vidé (un second envoi exige une liste relue). Restent : `confirme`
(posé seulement par « Confirmer l'envoi » du récapitulatif), 15 au plus par envoi, compte de l'onglet,
« Tout arrêter », hors ligne, une file à la fois ; puis à l'envoi 50/h et sa réserve, plafond du jour,
15/h favoris, pause 429/403, une requête à la fois, arrêt sur captcha, chaque favori contacté une fois
(serveur : `etatFavori`).

## Preuves

- `scripts/audit-favoris-liste.cjs` (vraie règle du serveur + vrai `background.js` + vraie file) :
  33/33 ; rouge sur `claude/extension-carte-v2` (15 rouges puis lève) ; `--prouve` 7/7 (cochables, déjà
  contactés, fraîcheur, confirmation, plafond 15, vendus, contactés côté serveur).
- `scripts/bancs/extension-favoris-liste.cjs` : 390 tactile, 1280, 1512, clair et sombre — 120 favoris ;
  contraste ≥ 4,5:1, cibles ≥ 44 px, rien de coupé, rien ne déborde ; gestes au doigt et à la souris
  (Rien, trois rangées touchées, déjà contacté non cochable, filtres, Tout cocher ≤ 15, rechargement,
  récapitulatif, rien avant « Confirmer », puis exactement les 3 cochés avec `confirme: true`).
  Captures regardées ; planche : scratchpad `onglets/extension-favoris.png`.
- `audit-coherence` (capacité `favorisliste2`), `audit-extension-zip`, `audit-traduction`, build.

## Geste de Julien

Installer l'extension **5.407.0** (remplacer le dossier, ⟳ dans chaque Chrome ; Orion :
`VRM-Orion-dossier.zip`). Le serveur doit être déployé (la liste vient de `apercu.tous`) : sans lui, la
carte garde l'aperçu d'avant (15 à cocher).
