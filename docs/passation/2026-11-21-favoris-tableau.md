# Favoris en tableau + onglet de travail ouvert d'abord — 21 nov. 2026 (ext. 5.410.7)

## Demandes de Julien
- « je veux qu'on ait une liste pour les favoris comme pour les ventes » (le parcours 1 Choisir · 2 Offre et message ·
  3 Rythme · 4 Confirmer · 5 Suivi du grand panneau, trouvé « nul »).
- « fais en sorte que ça ouvre un autre onglet pour travailler » (la petite fenêtre popup de la 5.410.5 ne s'ouvrait qu'au
  premier envoi réel ; un refus du serveur ⇒ rien ne s'ouvrait, il croyait que rien ne marchait).

## Ce qui est fait
### Page Favoris du grand panneau (`vinted-sync-extension/vrm-badge.js`, `favorisGrandHtml`, `brancherFavoris6`)
- Un TABLEAU avec les pièces de « Commandes » (`table6`, `tr6`, `case5`, `art6`, `cels6`, `et6`, `plaque`, `vignette`) :
  case 44 px · photo + plaque N° + titre · Prix (+ offre prévue) · Acheteur · Favori le · État ; en-têtes triables ;
  du plus récent au plus ancien par défaut.
- État en étiquette : Pas encore contacté · En attente (heure prévue pour le prochain) · Envoi en cours · Message envoyé ·
  Offre faite · À vérifier sur Vinted · Ignoré + raison courte · Pas parti (refus du serveur, sa phrase sur la rangée).
  Sources : `apercu.tous` (règle du serveur, inchangée), puis la file du serveur copiée par le fond (`st.jobs`,
  `jobsDuLot` : notificationId → état/raison du lot), aucune règle nouvelle.
- Offre prévue : seulement si une offre est réglée ; jamais sous le plancher (prix mini, sinon achat + 10 % — `plancher6`,
  la même règle que `plancherFavori` du fond) ; sans plancher ⇒ « sans offre » ; plancher pas su dans le panneau ⇒
  « offre X · plancher revérifié à l'envoi ». La feuille de confirmation montre la même offre.
- En-tête : segments Tous · Pas encore contactés · Envoyés · Ignorés (avec nombres), recherche (titre, acheteur, N°),
  « Réglages » (feuille : versions du message, rythme ; même chemin gardé `reglagesFavoris`), tout cocher (pas encore
  contactés seulement ; au téléphone « Tout cocher » dans la ligne du nombre).
- Barre basse collée dès qu'il y a une sélection : « N cochés », « Rien », « Envoyer à N favoris » (15 au plus, les
  autres restent cochés) ⇒ feuille de confirmation (le récapitulatif de toujours, `recapFavHtml`) ⇒ « Confirmer l'envoi »
  (`lancer`, inchangé : cochables de l'aperçu < 30 min, `confirme`).
- Pendant l'envoi : la ligne « Messages aux favoris · 3 sur 15 · Tout arrêter » en tête de la page (plus en double au-dessus),
  pas de cases, les rangées changent d'état en direct (le fond réécrit `vrmFavorisCarte`). La liste du lancement est gardée
  par compte (`vrmFavDernier`, 6 h) pour un rechargement de page.
- Échap ferme une feuille avant le panneau. Hors grand panneau (fenêtre « listes »), rien ne change.

### Onglet de travail (`background.js`)
- `ongletTravailVinted` : un ONGLET vinted.fr dans SA fenêtre, juste à droite de l'onglet touché, épinglé, `active:false` ;
  la fenêtre popup n'est plus qu'un repli ; réutilisé s'il existe. Bandeau « VRM · onglet de travail — ne le ferme pas »
  (+ la raison d'un refus), titre « VRM · onglet de travail ».
- Ouvert AVANT tout le reste par `travailDabord` : « Confirmer l'envoi » (favoris), « Reprendre », et les commandes
  `republierVinted` / `recreerVinted` / `reprendreRepub` confirmées.
- Refus du serveur ou rien à envoyer ⇒ l'onglet reste, le bandeau dit la raison, la réponse nomme les favoris (`ids`).
- Onglet de travail fermé pendant l'envoi ⇒ file arrêtée chez VRM, fin `travail_ferme` dite dans le panneau.

## Preuves
- `scripts/bancs/panneau-favoris-tableau.cjs` : 116 contrôles verts (1512 clair/sombre, 390 doigt clair/sombre) ; sur
  l'extension de `origin/main` (`BANC_EXT`) : 62 rouges sur 70.
- `scripts/audit-onglet-travail.cjs` : 12 verts ; `--prouve` 5/5 mutations ; sur le `background.js` d'avant : 8 rouges.
- Audits verts : favoris-liste, favoris-clair, favoris-offres-irreprochable, messages-malins, rythme-favoris, comme-bleam,
  coherence, extension-zip, extension-feuille, actions-gardees, discretion, traduction, quoi-de-neuf. Build OK.
- `grand-panneau` : 6 rouges, les MÊMES que sur `origin/main` (délai d'offre « comme Bleam » 10 vs 11 s, sans lien).
- Bancs `extension-favoris-liste` et `carte-favoris` : déjà rouges sur `origin/main` (ils jugent l'ancienne petite carte).

## Geste de Julien
Installer la 5.410.7 (remplacer le dossier, ⟳ dans chaque Chrome).
