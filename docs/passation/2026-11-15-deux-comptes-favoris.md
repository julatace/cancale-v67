# 15 nov. 2026 — « Deux comptes, une paire » et les favoris sur les autres sites

Branche `claude/deux-comptes` (partie de `claude/project-review-nsk5su`, `claude/verre-app` fusionnée).
Extension **5.392.0** (zips régénérés). Aucune donnée réelle dans le dépôt ; base de prod lue en LECTURE SEULE.

## 1. « Deux comptes, une paire » (Julien : « lance »)

### Ce que montrait l'alerte « photos en double entre tes comptes » (mesuré dans le code, avant)
- Elle existe depuis la 5.358 : empreintes `photo_emprunte_{uid}` calculées par l'extension, règle
  `src/photoEmpreinte.js` (seuil `SEUIL_PHOTO` = 16, « mieux vaut prévenir de trop »).
- Où : une carte ambre de Ma journée (« N photos en double entre tes comptes ») et l'outil Annonces → Outils.
- Ce qu'elle disait : un RISQUE de liaison de comptes par Vinted ; son geste : « Republier avec d'autres photos ».
  Rien sur la double vente, ni prix, ni « depuis », ni laquelle retirer.
- À côté, « N°x en ligne deux fois » (`src/enLigneDeuxFois.js`, 6 nov.) : identité stricte (photo EXACTE,
  `recreeDe`, fusion) sur un ou deux comptes ; geste « Ouvrir sur Vinted ».
- **« À retirer ailleurs » ne couvrait PAS deux comptes Vinted** : `articlesVendusAilleurs` n'apparie une vente
  qu'avec une annonce d'un AUTRE site (`v.plateforme !== a.plateforme`), et deux annonces Vinted sous un N° y
  étaient « ambiguës ».

### Ce qui est fait
- **Règle** `src/deuxComptes.js` (pure, exécutée par l'audit) :
  - « sûr » = une IDENTITÉ (celles de `enLigneDeuxFois` : même photo exacte, `recreeDe`, fusion faite sur SON clic) ;
  - « à vérifier » = un INDICE : empreinte au seuil STRICT `SEUIL_MEME_PHOTO` (12) **et** appariement UNIQUE et
    MUTUEL (une photo proche de deux annonces ou plus — 50 paires identiques photographiées au même endroit — ne
    dit rien) ; ou le même N° sur exactement deux annonces de deux comptes (le bloc rouge reste) ;
  - compte pas relu, empreintes pas lues : rien ; jamais le titre, la marque, la taille ;
  - laquelle retirer : la moins aimée (favoris lus), sinon la plus récente en ligne ; « Plutôt celle de … » ;
  - « Ce n'est pas la même » (`vrm_deux_comptes_non`, synchronisé) retire un indice, jamais une identité.
- **La deuxième mesure « sûr »** (`claude/meme-photo-sure`, `src/photoFine.js`) n'est PAS fusionnée : poussée
  « en cours » (extension 5.388 jamais publiée). Une empreinte seule reste donc « à vérifier ».
- **Le geste** : « Retirer celle de kicks_sud » est un LIEN vers l'annonce sur vinted.fr (nouvel onglet) — §3 :
  VRM ne supprime jamais une annonce Vinted, et Vinted n'a pas de « pause » d'UNE annonce (le mode vacances masque
  tout le compte). Le toucher note seulement l'heure (`vrm_deux_comptes_retraits`, synchronisé, 7 jours) ; la
  feuille dit « Ouverte à 14:02 : connecté à kicks_sud, ⋯ → Supprimer. VRM relira. », puis, selon la lecture
  COMPLÈTE suivante du compte : « Encore en ligne à la lecture de … » ou « N°42 retirée de kicks_sud · relu à … ».
  « C'est fait · relire » relance la lecture des annonces.
- **« C'est la même paire »** ouvre la fusion EXISTANTE (`FeuilleFusion`, aperçu, SON clic) avec les deux annonces
  déjà choisies (`autreInitial`) : la fusion devient une identité ⇒ le groupe passe « sûr ».
- **Quand l'une se vend** : `chargerRetraitsMulti` passe les identités (`memesPairesFiches` : photo exacte de deux
  fiches, `recreeDe`, fusions) à `articlesVendusAilleurs` (`memes`) ; la vente du compte A fait « à retirer »
  l'annonce encore en ligne sur le compte B (geste « à la main », jamais retirée par VRM), et `planRetirerAilleurs`
  la met EN TÊTE (`deuxComptes`). Sans identité (le même N° seul) : rien.
- **Où** : une carte ambre dans Ma journée (« N°12 en vente sur deux comptes », la phrase entière en infobulle),
  une ligne dans « À faire » d'Annonces, l'outil Annonces → Outils, et la feuille (les deux annonces côte à côte :
  photo, compte, prix, depuis, favoris). UN endroit : les groupes dits ici sortent des cartes « en ligne deux fois »
  et « photos en double ».

## 2. Messages aux favoris : Vestiaire, Leboncoin, eBay

| site | état | pourquoi |
|---|---|---|
| Vinted | fait (avant) | file serveur, son clic |
| eBay | **branché et visible** (pas touché) | `api/ebay.js` `send_offer_to_interested_buyers` ; écran eBay → la fiche d'une annonce → « Offre aux N observateurs » (eBay choisit les destinataires) |
| **Vestiaire** | **construit (5.392)** | Vestiaire NOMME la personne qui aime et permet la première offre (mesuré, ci-dessous) |
| **Leboncoin** | **impossible, dit à l'écran** | aucune réponse vue ne dit qui ; le levier : baisser le prix |

### Vestiaire — MESURÉ (lecture seule, 15 nov.)
- `vc_brut_*` (fil des notifications, catégorie « updates ») : **58 cartes** `eventType: 'custom_community'`,
  texte « … vient d'aimer votre pièce, envoyez lui un message ! », `productLink.meta = { type: 'chat',
  data: { id: '{personne}-{article}' } }`, deeplink `…buyerSellerChat…utm_campaign=Community_like_item…`.
  C'est donc Vestiaire qui dit QUI a aimé, et qui invite à lui écrire.
- `POST apiv2…/products/{id}/negotiations` (vu le 2 nov., page `/chat/`) : la réponse est une négociation dont
  l'unique événement est `offer` par `seller` (237 € sur un article à 249 €) — la PREMIÈRE offre du vendeur à une
  personne. `users/me/selling-offers` liste ces offres.
- La forme du CORPS de cette requête n'a jamais été vue : elle s'APPREND de son geste.
- (Constat, pas de ce chantier) `vc_brut_*` garde des réponses entières, prénoms d'acheteurs compris — déjà noté
  le 4 nov. ; rien de neuf n'est rangé par ce lot.

### Vestiaire — fait (extension 5.392.0, capacité `vcaimes`)
- `vc-inject.js` `noteAimes` : les cartes « j'aime » ⇒ `{ article, identifiant numérique, date }` au fond — jamais
  le pseudo ni le texte ; une autre carte communauté, soi-même : rien.
- Le fond (`rangerVcAimes`) garde les personnes dans **CE navigateur** (`vrmVcAimes`, borné) ; la base ne reçoit
  que des NOMBRES (`vc_aimes.produits` : personnes vues, déjà prévenues, dernière date ; `envoi` : l'avancée).
- Recette « favori » APPRISE de SA première offre faite à la main (`recetteOffre` : trous `{produit}`,
  `{acheteur}`, `{prixCents}`/`{prix}`, NOMS d'en-têtes) ; une contre-offre, une offre après un refus, un texte libre
  dans le corps, une personne absente de la requête ⇒ jamais rejouable. `vcOffre` (répondre à une offre reçue)
  refuse ce geste.
- `offrirAuxAimesVc` (commande `vcOffreAimes`, sur SON clic) : recette apprise, article lu dans `vc_listings` au prix
  de l'aperçu, offre sous le prix (1 € au moins), onglet vestiairecollective.com sur le compte de l'article ; puis
  une personne à la fois : pause 429/403, sécurité des comptes (5.366, « série »), 45/h (réserve 5), 8–20 s au
  hasard entre deux, **10 personnes par toucher**, **une offre par personne et par article, jamais deux** (posé
  avant l'envoi) ; « faite » seulement si Vestiaire renvoie TON offre à ce prix ; un refus arrête tout.
- Écran : Messages → Vestiaire → « Ont aimé tes articles » (`src/AimesVestiaire.jsx`, règle `src/aimesVestiaire.js`) :
  N°, titre, « 3 personnes ont aimé · 1 déjà prévenue », « Faire une offre » ⇒ feuille (photo, prix, −5/−10/−15 %
  ou montant, « Envoyer l'offre de 236 € à 3 personnes », l'avancée lue dans `vc_aimes.envoi`). Sans recette : les
  3 étapes pour l'apprendre, aucun bouton d'envoi.

### Leboncoin — mesuré, rien de construit
- `lbc_recon` : les statistiques d'une annonce donnent des NOMBRES (favoris, vues, messages) ; `myfavorites/v1` =
  SES favoris d'acheteur (identifiants d'annonces) ; `followme/v1/follower-targeting/eligibility` (`eligible`,
  `reasonCode`) vise les ABONNÉS du vendeur, pas les personnes qui ont mis l'annonce en favori, et son envoi n'a
  jamais été vu. Aucun geste natif attesté vers les favoris.
- À l'écran (Messages → Leboncoin → Favoris reçus) : « Leboncoin ne dit pas qui a mis ton annonce en favori : VRM ne
  peut écrire à personne. » + le levier : « baisse le prix (écran Leboncoin → « Baisser le prix sur Leboncoin »).
  Leboncoin ne dit pas s'il les prévient. » — VRM ne promet pas une notification qu'il n'a pas vue.

## Preuves
- `node scripts/audit-deux-comptes.cjs` — 48 contrôles verts, `--prouve` 19/19 mutations ; sur l'arbre de départ :
  rouge (la règle n'existe pas).
- `node scripts/audit-favoris-sites.cjs` — VRAI vc-inject.js + vc.js + background.js (`_fond-vm.cjs`) : 41 contrôles
  verts, `--prouve` 17/17 mutations ; sur l'arbre de départ : 24 rouges.
- Audits voisins verts : en-ligne-deux-fois, photos-comptes, retirer-ailleurs, a-retirer-ailleurs, meme-photo,
  fusion-fiches, vc-offres (O3 mis à jour : l'offre spontanée n'est jamais une recette de RÉPONSE), vc-prix,
  vc-messages, traduction, quoi-de-neuf, coherence, extension-zip.
- Banc `scripts/bancs/deux-comptes.cjs` (390 tactile ×2 et 1512, clair et sombre) : **120 verts, 0 rouge**
  (`VUES=390-clair` pour un seul rendu ; `CAPTURES=dossier`). Banc `en-ligne-deux-fois.cjs` mis à jour (la même
  paire sur deux comptes a sa carte à elle ; `X` = l'ancien scénario à deux comptes) : **56 verts**.
- ⚠️ Constat (pas de ce lot) : `scripts/bancs/vestiaire-messages.cjs` est rouge sur ce build — il ne sert pas la
  requête `id=in.(…)` qui dit à l'app que Vestiaire est relié, donc l'onglet Vestiaire n'apparaît pas (le banc
  deux-comptes la sert).
- Captures (données inventées) : `docs/design/avant-apres/deux-comptes-apres.png`,
  `deux-comptes-verifier-sombre-apres.png`, `vestiaire-aimes-apres.png`.

## Gestes de Julien
1. Installer l'extension **5.392.0** (remplacer le dossier, ⟳ dans chaque Chrome).
2. Vestiaire, une fois, dans ce Chrome : Notifications → « … vient d'aimer votre pièce » → faire toi-même une offre
   à cette personne. VRM apprend, puis « Faire une offre » marche depuis Messages → Vestiaire.
3. Quand « Deux comptes, une paire » apparaît : « Retirer celle de … », supprimer sur Vinted (connecté au bon compte),
   puis « C'est fait · relire ».

## Suite (coordinateur, même soir) — 5.392.0 alignée sur les favoris Vinted, et `photovrm`

### Les offres aux « aimés » Vestiaire = les techniques des favoris Vinted (fonctions RÉUTILISÉES)
- Écart entre deux offres : 8 à 20 s au hasard, **jamais deux fois de suite la même valeur** — `tirerSansRepeter`
  (extrait de `tirerAttenteOffreMessage`, qui l'utilise désormais aussi ; dernière valeur dans `chrome.storage.local`).
- Avant CHAQUE offre, la porte des favoris `porteDiscretion('vc:{id}', 'favori')` — élargie à un compte Vestiaire,
  **site par site** (verrou `vrmVerrouCompteVc`, série `vc:favori` : un geste Vestiaire ne retient pas Vinted) :
  « Tout arrêter », vérification jusqu'à « Reprendre », **15/h** (réglage commun `parHeure.favori`), **2 à 6 min après
  l'ouverture** de vestiairecollective.com (notée par `noterSessionVc`), un compte à la fois, série décalée ; puis
  `secuGeste('vestiaire', …, 'favori', 'serie')` (plafond du jour, par type, repos, prudence, arrêt anti-robot) ;
  puis 45/h ; `noterGesteAuto`.
- L'attente est TENUE par tranches en revérifiant tout (Tout arrêter, anti-robot, pause 429/403, onglet fermé ou
  autre compte ⇒ rien ne part, dit).
- §4.9 : la série est une FILE `vrmVcAimesFile` ; un worker neuf la reprend au réveil `vrm-offres`
  (`reprendreOffresAimesVc`), 10 min trop tard ⇒ rien ne part, dit.
- Journal « Ce que VRM a fait » : `noterJournal('vc:{id}', 'favori')` pour chaque offre FAITE.
- **Pas de message** : l'offre de Vestiaire n'a pas de texte (mesuré ; un texte libre rend la recette non rejouable)
  ⇒ ni temps d'écriture ni variantes. **Pas de rythme actif/calme** : Julien l'a REFUSÉ pour les favoris (§3), les
  favoris Vinted ne le suivent pas non plus.
- `audit-favoris-sites.cjs` étendu (horloge virtuelle) : écarts tirés et tenus, 300 tirages sans répétition, journal,
  ouverture, 15/h, Tout arrêter (avant et pendant), un compte à la fois (et Vinted ne retient pas Vestiaire), autre
  compte pendant la série, reprise par un worker neuf, trop tard. **Mutations 25/25** (24 par `--prouve`, « sans écart » revérifiée seule après correction) (délai fixe, même valeur deux
  fois, plafond des favoris ignoré, porte ignorée, ouverture ignorée, autre compte, reprise absente, journal…).

### `photovrm` (5.392.0) — la photo fabriquée par l'atelier « Republier par VRM »
- `televerserPhotosRecreer` : après `photoReglee`, `empreinteDeBlob(blob)` (la même que `tickEmpreintes`) ; file
  `vrmPhotosVrmFile` puis `photo_vrm_{uid}` (`payload.photos[h] = { h, n, src, uid, at }`, lue-fusionnée-réécrite,
  60 jours, 1 500 au plus ; lecture ratée ⇒ rien écrit, reprise au réveil). L'atelier n'attend pas l'écriture.
- App (`claude/numeros-masquees` fusionnée) : `verserPhotosVrmExtension` verse ces lignes au registre
  `vrm_photos_vrm` (`ajouterAuRegistre`, mêmes champs) au chargement.
- `scripts/audit-photo-vrm.cjs` : le VRAI `recreerVinted` range l'empreinte, l'atelier fait les mêmes requêtes,
  lecture KO, fusion/borne, versement app — 12 contrôles, 6/6 mutations.
- `EXT_CAPACITES.photovrm` = 5.392.0 (`noterPhotosVrm`, audit-coherence).
