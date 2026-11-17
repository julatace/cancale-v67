# 17 nov. — Vidéos d'aide améliorées (lot `aide-videos`, mission 2 de la file)

Julien : « l'aide sur place est déjà là avec les vidéos, mais tu peux les améliorer ». Sans service
payant ni IA. Branche `claude/aide-videos`. Point de départ : le lot 49 du 13 nov. (#1152 —
`src/aideVideos.js`, `src/composants/AideVideo.jsx`, `scripts/films/aide-videos.cjs`).

## Ce qui change pour Julien

- (a) **Chaque « ? » ouvre la bonne vidéo** : déjà vrai pour les 10 écrans principaux ; un contrôle
  automatique de plus — un « ? » montre SA vidéo d'abord, ou aucune, jamais celle d'un autre écran
  (Statistiques et Communauté n'en ont pas : rien n'est montré). Exceptions écrites : Achats propose
  aussi « Retirer un colis », Colis propose aussi « Imprimer ».
- (b) **Vidéos refaites sur les écrans actuels** (Verre, maquettes du 14–16 nov.) : elles sont tournées
  par script dans la vraie app sur des données inventées. Les 10 ont été retournées. Trois scénarios
  ne marchaient plus (les boutons avaient changé) et ont été réécrits :
  · Ventes — les colis cochés, « Imprimer les 2 bordereaux », l'imprimante choisie une fois, la
    préparation (le lecteur PDF de Chromium sans écran fait tomber la page : la vidéo s'arrête sur la
    préparation, le cadre du PDF n'est pas chargé pendant le tournage) ;
  · Colis — toucher un colis ouvre le code en grand pour le comptoir, « Copier le code » ;
  · Argent — Résumé → « URSSAF · à déclarer » → « J'ai déclaré » → le montant noté → Enregistrer.
- (c) **Courtes, sous-titrées, rapides, plein écran, retour** : toutes ≤ 15 s (pas de chapitres : rien
  de long) ; sous-titres en **5 langues** (une piste par langue, celle de l'app par défaut ; la piste
  française est écrite au tournage, les quatre autres par `scripts/films/aide-sous-titres.cjs` depuis
  une table relue `_aide-sous-titres.cjs` — jamais une piste à moitié française) ; aperçu (poster) et
  préchargement léger (`preload="metadata"`, rien avant le toucher) ; poids mesuré par l'audit ;
  « Plein écran » au doigt (iPhone : le lecteur natif) ; le **retour** ferme la vidéo, puis la feuille.
- (d) **La réponse en deux lignes** au-dessus de chaque « Regarder », pour qui ne veut pas regarder.
- (e) **Recherche par mots** : le champ « Comment faire… ? » du « ? » montre aussi les vidéos dont le
  titre, le geste ou la réponse contient les mots (de tous les écrans).
- Tous les textes des vidéos par `tr()` (fr, en, es, it, de).

## Preuves

- `scripts/audit-aide-videos.cjs` : étendu (bonne vidéo par « ? », réponse ≤ 2 lignes, textes en
  5 langues, pistes à jour, plein écran, retour, préchargement léger, recherche) ; mutations
  ajoutées, chacune rouge (`--prouve`).
- `scripts/bancs/aide-videos.cjs` : réponse avant le toucher, 5 pistes servies, « Plein écran »
  ≥ 44 px, le retour ferme la vidéo et garde la feuille, la recherche « bordereau », 1512 sombre.

## ÉTAT À LA REPRISE

Voir le rapport de la PR (captures regardées, passes, CI).

## Geste de Julien

Aucun.
