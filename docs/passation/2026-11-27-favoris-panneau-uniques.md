# 27 nov. 23 h — Favoris : le panneau détaillé, « Envoyer » par favori, six états, messages uniques, discrétion (ext. 5.455.7)

Branche `claude/favoris-suite` (contient la 5.455.6). Données des bancs INVENTÉES.

## Ce que Julien a demandé (23:00 – 23:10)
1. « Envoyer un message aux favoris pour chaque favori », un panneau « beaucoup mieux, beaucoup plus détaillé ».
2. Retirer « Importer le passé » et « Tout récupérer » : « l'extension doit tout récupérer dans tous les cas ».
3. Montrer les actions faites par favori (« Offre faite 49,50 € · 18:42 », « Message envoyé · 18:43 »), heure, montant, version.
4. La colonne « État » : il ne comprend pas « Ignoré / Refusé » ; l'extension ne doit pas refuser d'elle-même.
5. « Pouvoir envoyer plein de messages sans crainte » ; « on ne doit pas pouvoir voir une même template d'un utilisateur à l'autre ».

## Ce qui est livré
- **« Envoyer » sur chaque rangée** pas encore contactée (vrm-badge.js `data-fav6-un`) : ouvre la MÊME confirmation (« Confirmer
  l'envoi »), pour CE favori seul ; même chemin, mêmes gardes ; rien ne part avant la confirmation.
- **Six états, partout** (panneau `etatFav6`, app `src/favorisEcran.js`) : Pas encore contacté (+ la raison si elle attend
  quelque chose) · En attente (compte à rebours, raison : plafond, notification en recherche, conversation pas encore relue…) ·
  Envoi en cours · Message envoyé (+ l'offre ; « déjà contacté avant » compte comme envoyé) · Vendu / réservé · Refusé par Vinted
  (vérification, pause, texte, offre, téléphone — seulement quand VINTED a refusé). « À vérifier sur Vinted » reste pour un envoi
  dont Vinted n'a pas confirmé la réponse (C'est parti / Pas parti). Plus aucun « Ignoré », « Refusé », « Pas parti », « Pas envoyé ».
  Segment « Ignorés » ⇒ « Vendus · Vinted ».
- **Le détail par favori** : registre `vrmFavorisFaitsN` écrit AU GESTE (offre : heure + montant envoyé ; message : heure + n° de
  version), lu par le panneau (`favorisPourCarte` → `faits`) : « Offre faite 49,50 € · 18:42 », « Message envoyé · 18:43 · version 2 ».
- **Import** : la ligne « Import de ton passé / Tout récupérer » quitte la carte ; l'import de départ lit TOUT l'historique (plus
  d'horizon de 12 mois) ; un import de 12 mois déjà fini repart une fois pour le reste. Mêmes bornes de lecture.
- **Messages par défaut uniques** (`src/favorisDefauts.js`) : banque salutation × entrée × corps × liaison × offre × détail × fin ×
  ponctuation, 5 langues ; graine = empreinte brassée (FNV-1a + fmix64) de SON compte VRM, jamais l'identifiant en clair ; 3
  versions ; ce qu'il a écrit gagne toujours. Utilisés à l'enregistrement d'un réglage sans texte (app, panneau) ; un réglage
  d'avant au texte PARTAGÉ est remplacé à l'envoi par son jeu (`defautUniqueSiPartage`, la ligne enregistrée ne change pas).
  Panneau : « Tes messages sont uniques à ton compte ».
- **« Pourquoi c'est sûr »** (panneau, dépliable, 5 langues) : pause au hasard 20–60 s jamais deux fois la même, temps d'écriture,
  15 favoris/h, 50 actions/h, plafond du jour, un compte et une requête à la fois, pause quand Vinted freine, arrêt à la première
  vérification, compte de l'onglet seulement, jamais deux fois la même personne pour le même article.

## Discrétion : audit seulement, rien relâché
`scripts/audit-favoris-discretion.cjs` (vrai background.js, vraie file) : D1 pause 20–60 s au hasard jamais deux fois la même ;
D2 défauts 15/h, 50/h, pause 20–60 s, plafond dur 15/h, réserve 5, plafond du jour ; D3 écriture 5–45 s ; D4 403/429 ⇒ pause,
vérification ⇒ arrêt + file en pause ; D5 les 3 écritures par la file Vinted depuis l'onglet du compte, garde avant chacune ; D6 un
compte à la fois ; D7 aucun `debugger` ni `isTrusted` réécrit. **Aucun trou trouvé.** `--prouve` : 4 mutations rouges.

## Preuves
- `audit-favoris-messages-uniques.cjs` : 1 000 comptes, 5 langues, aucun jeu ni 1er message identique ; même compte = même jeu ;
  son texte gagne ; mots interdits ; remplacement serveur ; l'extension rend le même jeu. Sur l'arbre d'avant : rouge (1 texte
  pour tous). `--prouve` : 4 mutations rouges. (Le brassage fmix64 a été ajouté après une vraie collision mesurée : les bits bas
  d'un FNV seul ne dépendent que des bits bas.)
- Banc `panneau-favoris-tableau` (175 contrôles, 390 et 1512, clair et sombre, captures regardées) : six états, détail
  « Offre faite 49,50 € · hh:mm » / « Message envoyé · hh:mm · version 2 », « Envoyer » sur chaque rangée ⇒ la confirmation de CE
  favori, rien parti avant. Rangées au téléphone jusqu'à 190 px (la touche « Envoyer », 44 px).

Geste de Julien : installer **5.455.7**.
