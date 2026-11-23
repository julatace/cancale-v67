# 17 nov. — Messages et E-mails, nouveau design (lot design-v2-messages, branche `claude/design-v2-messages`)

Derrière le réglage du nouveau design (`vrm_design_v2` ; allumé par défaut depuis #1246, « Ancien design » l'éteint).
**Éteint : rien ne change** (signature DOM de Messages et d'E-mails comparée au build d'avant, banc ci-dessous).
Aucune règle métier changée : mêmes conversations, mêmes filtres, mêmes nombres, mêmes gestes, mêmes routes.

## Ce qui change pour Julien (allumé)

**Messages** (Vinted) :
- la tête : « Messages » en grand et la cloche sur UNE ligne ; « Vinted · compte ⌄ » dessous (le menu du lot design-v2) ;
- UN segmenté **Conversations · Offres · Favoris** — les mêmes zones qu'hier (« Offres » = Offres auto, « Favoris » =
  favoris reçus et offre aux favoris) ; les deux rangées d'hier ne sont plus rendues ;
- la recherche + « ⋯ » : filtres (Toutes · À répondre · Non lues · Offres reçues, avec leur nombre), Mettre à jour,
  Réponses rapides ; un filtre actif se dit en une ligne avec « Toutes » pour l'effacer ;
- **les comptes SÉPARÉS** (CLAUDE.md §3, 12 nov.) : un groupe par compte, le compte de l'onglet d'abord (« ouvert dans
  Chrome »), puis chaque autre compte (« lecture seule »), du plus récent au plus ancien DANS chaque groupe — règle pure
  `groupesParCompte` (`src/designV2/messagesV2.js`), la même que Messages · Tous. Hier, les autres comptes étaient
  mélangés dans un seul bloc « Autres comptes » ;
- la rangée façon Mail (`src/designV2/LigneConversation.jsx`) : photo de la paire (sinon l'initiale), pseudo 17/600,
  heure à droite (sa largeur, jamais celle du nom — audit C7), extrait sur 2 lignes, **étiquette kraft du N°** quand il
  est connu par identité, offre en attente, point non lu, pastille d'arnaque gardée. Aucun bouton dans la rangée ;
- le fil : des bulles façon Messages d'iPhone (les miennes en bleu Apple, l'autre en gris), tous les gestes d'hier
  (réponses rapides, traduction, offres, envoi) inchangés.

**E-mails** (Julien : « Améliore les emails aussi ») :
- UN segmenté **À traiter · Colis · Ventes · Achats · Tout**, posé sur les filtres EXISTANTS de la route : « À traiter »
  = les e-mails « à vérifier » (§5 : un colis douteux y va, visible) ; les nombres sont CEUX des pastilles d'hier (gardés
  quand un segment filtre). « ⋯ » : Non lus, Codes de retrait, Offres ;
- chaque rangée : l'**étiquette N°** quand le N° est LU dans l'e-mail (jamais par le titre), le n° de suivi lu, la photo
  de la paire reliée par identité (d'hier), le code copiable (d'hier), et **UN geste** : celui de la lecture
  (`gestesEmail`, le principal — « Voir le colis à retirer », « Voir le colis à envoyer », « Voir l'achat », « Voir le
  N° ») ;
- **glisser à gauche = « Ranger »** : une marque synchronisée (`vrm_emails_ranges`, SYNC_KEYS), jamais une
  suppression ; l'e-mail reste, replié en bas de SA vue (« Rangés · N »), compté dans les nombres ; glisser de nouveau
  l'en sort. Glisser à droite = lu / non lu (d'hier) ;
- **les e-mails à rattacher** (mis de côté : aucune adresse de réception ne les attribue, §5) : une section calme sous la
  liste, lue par la même route que Paramètres (`/api/email-rattacher?mode=liste`), et le MÊME « C'est à moi » (rejeu
  de CET e-mail avec SA session). Pas su ⇒ une phrase, jamais « aucun ».

**Audit visuel, « non attribué »** :
- A8 : la confirmation partagée (« Se déconnecter partout ») en très grand texte — les deux boutons s'empilent à 100 %,
  le plein EN HAUT, libellé sur plusieurs lignes, jamais rogné (allumé ET éteint, CSS sous `data-grand-texte`) ;
- B16 : Messages en rangées v2, étiquette kraft, 1 segmenté, grille 4/8 ; C7 : l'heure garde sa largeur.
- C9 (main seulement, « remplacé par v2 ») : pas touché — c'est le dessin éteint (Annonces, Achats), hors de ce lot.

## Preuves

Banc `scripts/bancs/design-v2-messages.cjs` (base inventée `_base-messages-stock.cjs` : 1 000 conversations sur
3 comptes, 1 000 e-mails, + 3 « à vérifier » et 2 « à rattacher » ; 390 tactile clair/sombre, 375 « Très grand »,
1512) : groupes = la base, jamais mélangés, ordre par groupe ; règle pure (onglet d'abord) ; au plus 1 plein ; cibles
≥ 44 ; rien de tronqué sans « … » ; l'AIR ; CLS du chargement ; segments = pastilles d'hier ; rubriques ; À traiter =
les 3 ; étiquette N° = N° lu ; Ranger ; « C'est à moi » rejoue le bon ; A8 allumé et éteint ; éteint = DOM d'avant
(`SIGNATURE_AVANT`). Rouge sur la base et par mutation (`MUTATION=melange|ordre|air`) : chiffres dans la PR.

## Restes
- Le glisser à gauche des conversations (Retirer de la liste) n'est pas fait : le geste reste dans le fil.
- « ⋯ » d'E-mails ne porte pas encore le choix du compte (il reste dans la ligne d'outils d'hier).
