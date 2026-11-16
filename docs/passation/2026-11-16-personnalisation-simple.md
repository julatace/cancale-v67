# 16 nov. 2026 — La personnalisation plus simple (lot personnalisation-simple)

Branche `claude/personnalisation-simple` (depuis `origin/main` 5a9abe571), poussée à chaque commit.

## La demande

Julien (iPhone, version en ligne) : « La personnalisation doit être plus simple. » Moins de choix, moins de
texte, des gestes évidents. Ajout du même jour (capture iPhone) : la carte « 3 ventes · à sortir dans cet
ordre » (« La paire à sortir », grande photo, N°, « VRM ne sait pas où est ce carton… », « Je l'ai sortie »)
est TOUT EN HAUT de Ma journée et il ne la veut pas tout en haut.

## Inventaire des écrans de personnalisation (sur `main`)

| écran | où | choix | ce qui est fait ici |
|---|---|---|---|
| **Modifier ma journée** (24 → 26 cartes) | Ma journée (en bas) · Paramètres → Affichage → Ma journée | 1 interrupteur + 1 poignée par carte, 3 groupes, 1 bouton « départ » | **REFAIT** (ci-dessous) |
| Affichage Simple / Complet | Paramètres → Affichage | 3 (Automatique · Simple · Complet) + 1 phrase + « Pourquoi ? » | déjà simple : inchangé |
| Mes plateformes | Paramètres → Affichage | une case par site | inchangé |
| Apparence + Mode sombre | Paramètres → Affichage | 4 (Clair · Sombre · Automatique · Le soir) **et** un interrupteur « Mode sombre » qui redit la même chose | **à décider** : deux lignes pour un réglage (l'interrupteur quitte Automatique / Le soir). Pas touché : des bancs lisent `data-reglage-sombre` et l'interrupteur sert aussi de raccourci. Proposition : ne garder que « Apparence ». |
| Taille du texte / Zoom | Paramètres → Affichage | 4 tailles ; Zoom seulement s'il porte une valeur (téléphone) | inchangé (déjà réduit le 15 nov.) |
| Objectif du mois | Paramètres → Affichage | saisie + « Enregistrer » + « Retirer » | inchangé (une saisie de montant demande sa validation : une frappe à moitié écrite ne doit rien poser) |
| Je vends, Langue, Mode stream (2 lignes), Widget, Raccourcis Siri/clavier, Ma configuration | Paramètres → Affichage | — | inchangés ; **le groupe Affichage a 17 lignes** : à ranger (proposition : sortir Stream, Widget, Raccourcis dans « Confort ») — décision de Julien, pas faite ici. |
| Chiffres du mois (« Modifier » de la carte) | Ma journée → carte des chiffres | choisir les chiffres | inchangé |

## « Modifier ma journée » refait

- **Une liste, trois groupes** (En haut · À faire · En bas), **une phrase d'en-tête** (« Touche l'interrupteur pour
  cacher une carte, glisse ou touche ↑ ↓ pour la ranger. »). Le sous-titre de la feuille est retiré.
- **Le nom seul** : les 24 phrases grises sous chaque nom sont retirées (les noms sont faits pour se suffire).
- Par carte : **poignée** (glisser au doigt, `touch-action: none`, clavier : flèches, Début/Fin), **↑ ↓** (une place
  par toucher, 44 px, grisées en haut/en bas, le focus reste sur la flèche), **interrupteur** visible / cachée.
  Les cartes fixes (chiffres du mois, À trancher) : l'interrupteur seul.
- **Enregistré tout de suite** (aucun bouton « Enregistrer ») ; Ma journée derrière change au même instant (c'est
  l'aperçu direct : la feuille ouverte, la carte cachée quitte l'écran — banc C).
- **« Revenir au réglage de départ »** en bas (grisé quand on y est déjà).
- **Textes par `tr('jp.*')`, 5 langues** (`src/i18n/langues/{fr,en,es,it,de}/perso.js`), noms des 26 cartes compris.
- **Préférences existantes** : la forme ne change pas (`vrm_journee_perso` `{ v:1, ordre, choix }`) ; elles sont relues
  telles quelles (banc A, réglage « du 12 nov. » servi par le nuage). Nouvelle règle de lecture (`ordreEgalDepart`) :
  **un ordre qui recopie le départ** (zone par zone dans l'ordre du catalogue) **n'est pas un ordre à lui** — oublié
  à la lecture, le départ d'aujourd'hui s'applique (et l'ordre selon l'heure revient) ; ses choix restent.

## « La paire à sortir » plus bas, et compacte

- Elle devient une **carte du catalogue** : `sortir`, zone **« En bas », en tête** — au téléphone sous la grille
  (À envoyer, À retirer, le mois), l'argent à venir, « À faire », au-dessus des notifications coupées et du guide.
  Raison : la tuile « À envoyer » porte déjà le geste du jour (imprimer) ; la carte est le détail « où est le carton ».
- **Aucun ordre enregistré ne peut la remettre en haut** : elle n'existait dans aucun ordre (nouvelle carte ⇒ sa place
  de départ) et elle est d'une autre zone que la tête ; un ordre égal à l'ancien départ est oublié (règle ci-dessus).
- **Cachable et rangeable** dans l'éditeur (dans « En bas »). Cachée ⇒ rien, et « Imprimer » de la tuile
  « À envoyer » redevient le bouton plein (un plein par écran).
- **Compacte au téléphone** (`compact`, `data-sortir-compact`) : vignette 72 px à gauche, N°, site, compte, « 1 sur 3 »
  et la date à côté ; le lieu (ou « VRM ne sait pas où… », en petit, sans la pastille « ? ») ; **« Je l'ai sortie »
  reste le plein**. À l'ordinateur : inchangée (colonne 1 de la maquette validée), elle suit son interrupteur.

## Mesures avant / après (banc `personnalisation-simple`, 390 tactile et 1512)

MESURES

## Preuves

PREUVES

## Fichiers

- `src/journeePerso.js` : carte `sortir`, `ordreEgalDepart`, `monterCarte` / `descendreCarte`.
- `src/JourneePerso.jsx`, `src/styles-journee-perso.css` : l'éditeur simple.
- `src/i18n/langues/*/perso.js` (+ import dans chaque `*.js`).
- `src/App.jsx` : `sortirVu`, la carte hors de la tête, rendue par la zone « En bas » ; feuille sans sous-titre.
- `src/PaireASortir.jsx`, `src/design/verre-journee.css` : la carte compacte.
- `scripts/audit-journee-perso.cjs` : 3 rouges de `main` portés sur la forme d'aujourd'hui (S3, S4, S5 : la même
  règle), 4 mutations qui ne s'appliquaient plus portées ; R8–R10, S8–S9 neufs ; 30/30 mutations.
- `scripts/bancs/paire-a-sortir.cjs` : A1 porté sur la NOUVELLE règle (décision de Julien : plus tout en haut, compacte),
  B neuf (cachée ⇒ rien ; l'ancien ordre de départ ne la remonte pas).
- `scripts/bancs/personnalisation-simple.cjs` (neuf).

## ÉTAT À LA REPRISE

ETAT
