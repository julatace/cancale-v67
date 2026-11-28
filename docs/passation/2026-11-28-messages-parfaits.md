# 28 nov. 2026 — Messages parfaits (`claude/messages-parfaits`)

Demandes de Julien (captures de Messages à 1512 sombre : une bulle générique sur chaque rangée, « Ouverture de la
conversation… » qui traîne à droite, deux listes déroulantes « Choisir une action » et « Vinted » en haut).
Cadre : l'APP seulement — l'extension (servie chez lui en 5.455.x) n'est pas touchée, aucune version montée.

## 1. La photo de profil de la personne

- **Mesuré (lecture seule, projections scalaires, 28 nov.)** : la boîte captée par l'extension (`harvest_{uid}_inbox`,
  `payload.conversations[].opposite_user.photo.url`) porte la photo de profil pour **2 253 conversations sur 2 548**
  (`images1.vinted.net/t/…/f800/…`, clé `url` seule) ; 28 portent l'image « pas de photo » de Vinted
  (`static.vinted.com/assets/no-photo/…`, clés `url,width,height,thumbnails`) ; les autres n'ont pas de photo.
  Leboncoin, Vestiaire et eBay ne donnent aucune photo de l'acheteur (rien de capté) ⇒ l'initiale.
- `src/filUnique.js` `avatarPersonne(v)` : https seulement, l'image « pas de photo » écartée ; `convVinted` porte `avatar`
  (jamais une identité : la clé du fil et l'interlocuteur n'en dépendent pas — `audit-messages-parfaits` A4).
- `src/messages/AvatarPersonne.jsx` : rond, **taille fixe** (52 px dans la rangée, 36 px dans l'en-tête du fil), `loading=lazy`,
  décodage asynchrone, par `PhotoVinted` (taille réduite, secours de l'extension) ; une image ratée ⇒ l'initiale.
- Rangée (`src/ecrans/FilsTous.jsx`) : l'avatar à la place de la tuile ; la PHOTO DE LA PAIRE (par identité) passe sur le coin
  (24 px), sinon l'initiale du compte comme avant. En-tête du fil (`TeteFil`, App.jsx) : l'avatar ; l'en-tête ne prend plus la
  photo de l'ARTICLE quand la personne n'en a pas (`openConversation` : `avatarPersonne(opposite_user.photo)`).

## 2. Plus vite

- **Cause du « Ouverture de la conversation… » qui traîne** : `openConversation` demandait la conversation avec `force` dès que
  l'extension savait la messagerie ⇒ l'aller-retour de l'extension à vinted.fr (plusieurs secondes) AVANT tout affichage, alors
  que la copie captée en base était là.
- Maintenant, deux temps : (0) pendant la lecture, le **dernier message connu** de la boîte et l'**offre** de la liste
  (`vrm-fil-apercu`) avec la forme des bulles ; (1) la copie captée (`harvest_{uid}_conv_{id}`, une ligne) s'affiche dès qu'elle
  arrive ; (2) l'extension relit ensuite en arrière-plan (« Actualisation… », comme « Actualiser ») et remplace le fil ; une
  relecture ratée garde ce qui est montré et le dit. Temps posés dans `window.__vrmMesuresFil` (`fil`, `actualise`).
- La liste : la copie instantanée de Messages (`src/copieEcran.js`, écran `messages`) existait déjà ; le banc mesure le retour.
- Mesures (banc `messages-parfaits`, base inventée, extension simulée à 600 ms d'aller-retour) : voir la fin du banc
  (« Temps »). Avant : le fil n'était lisible qu'APRÈS l'aller-retour de l'extension (≥ 600 ms au banc, des secondes chez lui) ;
  après : lisible sur la copie en base, l'extension actualise ensuite.

## 3. Site + compte « comme sur les autres écrans »

- Les deux `<select>` bruts (« Choisir une action », « Vinted ») sont retirés. À leur place, partout (téléphone et
  ordinateur) : la rangée de puces **Toutes · Vinted · Leboncoin…** (`FiltrePlateformes`, la règle `src/filtrePlateforme.js`,
  `ECRANS_FILTRE` + `messages`, choix retenu sur l'appareil) et le bouton **Compte** (`FiltreSeul` de `TableauTravail`, retenu
  par vendeur). Un fil est d'un site s'il en porte une conversation ; d'un compte, celui de son dernier message (la clé des
  groupes). Les vues Toutes · Offres · Non lues restent le segmenté (leurs nombres suivent le filtre). « Relire eBay » : un
  bouton natif.

## 4. Accepter, contre-offre, message DEPUIS L'APP

- Déjà en place depuis le 24 nov. (`peutAgir`, `cmd_dist_*`, `src/agir/Agir.jsx`) : Répondre, Accepter (confirmé), Refuser,
  Proposer {prix mini}. Ajouté :
  - **« Autre prix… »** (`src/messages/contreOffre.js`) : un montant saisi, jugé avant tout envoi — illisible, < 1 €, à ou sous
    l'offre, au-dessus du prix affiché ⇒ rien ne part ; **sous le plancher** (prix mini, sinon achat + 10 % —
    `plancherBaisse` de `src/reglesAuto.js`, la règle de la baisse) ou **sans plancher connu** ⇒ bouton éteint tant que SA case
    « je le veux quand même » n'est pas cochée, puis SA confirmation. L'extension garde ses propres gardes (compte de l'onglet,
    plafond, une requête à la fois).
  - **L'extension ne sait pas recevoir le geste d'ici** (file refusée, panneau permis : p. ex. une 5.430 sans « À distance »)
    ⇒ « Répondre dans l'extension » / « Répondre à l'offre dans l'extension » : `ouvrirPanneau({ page: 'messages', ids: [conv],
    action })`, lu par l'extension depuis la 5.410 (la conversation choisie) ; dit, rien déposé. Le texte tapé ne voyage pas
    (le lien n'a pas de paramètre de texte — l'extension n'a pas été touchée).
  - La porte **revérifie l'extension avant chaque geste** (`poserReverifAgir`, un battement du pont si l'état a > 10 s, 2,5 s
    au plus) puis relit ses faits.
- `audit-actions-app` §M : la messagerie de l'app dépose EXACTEMENT `repondre`, `refuser`, `accepter`, `contreOffre` ;
  Accepter seulement confirmé ; « Autre prix » sous le plancher seulement forcé + confirmé ; repli panneau ; revérification ;
  l'écran Messages ne dépose rien lui-même. 6 mutations, rouges. CLAUDE.md §3 « Agir depuis l'app » : ligne datée.

## 5. Le statut réel de l'extension

- **Causes du « parfois faux »** (lues dans le code) :
  1. l'état du pont (`__vmrEtat`) n'avait **pas de date** : battement sauté (onglet caché, `battementExt` qui sort sur
     `document.hidden`, un raté isolé qui n'est compté qu'au deuxième), l'app redisait le dernier état comme actuel ;
  2. **deux règles** pour la même chose : l'intertitre « Compte de l'onglet » lisait le cookie du pont (`compteConnecte`),
     la pastille « Lecture seule » lisait la porte (présences en base, relues toutes les 45 s) — un compte pouvait porter les
     deux ;
  3. l'ouverture de Messages ne revérifiait rien.
  `EXT_ATTENDUE` (5.455.7) = `public/extension-version.json` = manifeste : pas en cause, **non touché**. Une extension 5.455.x
  plus ancienne que 5.455.7 est dite « connectée, mais différente » (« une nouvelle version est prête »), ce qui est vrai.
- `src/messages/statutExtension.js` (pur) : à partir des faits de la porte (`etatNavigateur`, la règle de la page Extension) et
  de l'heure de la dernière réponse (`__vmrEtatAt`, nouveau) — **ok** (connectée, à jour, ce compte VRM, un compte relié dans
  l'onglet) · **écart** (version, autre compte VRM, deux extensions, aucun onglet / compte non relié / cookie pas lu) ·
  **pas joignable** (absente, muette, autre navigateur, réponse de plus de 75 s) · « on vérifie ».
- `src/messages/StatutExtension.jsx` : la ligne en tête de Messages (datée « vérifié à 14:02:11 », « Revérifier »),
  revérifiée à l'ouverture, toutes les 30 s et au retour au premier plan (`reverifierExtension`, App.jsx). L'intertitre
  « Compte de l'onglet » suit CETTE règle (une seule source).

## Preuves

- `node scripts/audit-messages-parfaits.cjs` (S statut, C Autre prix, A photo) : 23 verts ; `--mutation` 6/6 rouges.
- `node scripts/audit-actions-app.cjs` vert, `--mutation` 20/20 rouges (dont 6 neuves §M).
- Verts : audit-traduction (5 langues, `src/i18n/langues/*/messagesParfaits.js`), audit-tdz, audit-variables, audit-identite,
  audit-coherence, audit-quoi-de-neuf, audit-envoi-messages-offres, audit-agir-si-connecte, audit-contre-offre-mini
  (`scripts/_porte-agir.cjs` : la regex de la carte d'offre accepte les deux props neuves `plancher`/`affiche`).
- Banc `scripts/bancs/messages-parfaits.cjs` (390 tactile et 1512, clair et sombre, base inventée, fausse extension au pont :
  à jour · ancienne · absente) : photos et initiales, plus de `<select>`, puces Site + Compte qui filtrent, statut exact dans
  les trois cas, « Compte de l'onglet » seulement à « ok », gestes allumés et déposés (Accepter confirmé, 45 € sous le plancher
  forcé + confirmé, message) au nom du bon compte, panneau sur CETTE conversation pour l'ancienne, lecture seule sans
  extension ; temps mesurés. Captures regardées (liste, fil, confirmation, Autre prix, panneau).

## Ce qui reste (honnête)

- Le texte tapé ne passe pas au panneau (le lien n'a pas de paramètre de texte ; il faudrait une version d'extension).
- La photo de profil n'existe que pour Vinted (les autres sites ne la donnent pas).
- L'écran Messages « Vinted seul » (`!filTous`, plus joignable par la navigation actuelle) garde ses rangées `LigneConv`.
