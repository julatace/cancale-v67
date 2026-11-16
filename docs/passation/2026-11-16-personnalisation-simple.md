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

Mesuré sur l'app rendue (feuille « Modifier ma journée », texte VISIBLE, hors lecteur d'écran), `main` (5a9abe571)
contre cette branche, les mêmes données :

| | avant (`main`) | après |
|---|---|---|
| cartes dans la liste | 25 | 26 (+ « Ventes à sortir du stock ») — aucune perdue |
| groupes | 3 | 3 |
| phrases d'en-tête | 2 (sous-titre de feuille + aide de 2 lignes) | **1** |
| phrases sous les noms | 25 cartes | **0** |
| phrases (≥ 25 caractères) dans la feuille | 23 | **1** |
| mots lus | 281 | **106** (−62 %) |
| bouton « Enregistrer » | 0 | 0 |
| cacher une carte | 2 touchers (ouvrir, interrupteur) | 2 touchers (ouvrir, interrupteur) — banc C : 1 toucher dans la feuille |
| remonter une carte d'une place | glisser seulement (ou clavier) | **1 toucher ↑**, ou glisser |
| revenir au départ | 1 toucher (« réglage d'origine ») | 1 toucher (« réglage de départ ») |
| contrôles par carte | interrupteur + poignée | interrupteur + poignée + ↑ ↓ (44 px chacun) |
| « La paire à sortir » à l'ouverture (390) | 1re carte sous le titre (haut 65 px), carte 455 px | sous la grille et « À faire », carte **343 px** (compacte) |

## Preuves

- `npm run build` vert.
- `audit-journee-perso --prouve` : vert, **30/30 mutations** (dont 9 neuves : ordre de départ gardé / trop large, ↑ de
  deux places, carte en haut, flèches muettes, phrase revenue, texte en dur, carte remise tout en haut, carte incachable).
  Sur `main` : 3 rouges (formes périmées) et 4 mutations qui ne s'appliquaient plus — portées, même règle.
- `audit-traduction` 45/45 · `audit-quoi-de-neuf` vert · `audit-tdz`, `audit-variables`, `audit-vendeurs-differents` verts ·
  `audit-textes-courts` (Ebay.jsx l.2605), `audit-boutons` (rayons), `audit-journee-coherence` (A4) : 1/2/1 rouges, **les
  mêmes sur `main`**, hors de ce lot.
- **Banc `personnalisation-simple`** (390 tactile + 1512, `locale fr-FR`) : **41 verts, 0 rouge** ; sur le build de `main` :
  **15 rouges** (aucune flèche, une phrase par carte, sous-titre, pas de carte `sortir`, noms non traduits).
- **Banc `paire-a-sortir`** (390 clair/sombre, 1512) : vert ; sur `main` : **4 rouges** (A1 tout en haut, pas compacte,
  B cachée impossible, B en haut).
- Captures regardées : l'éditeur 390 / 1512 / anglais, la carte compacte (390 clair et sombre), Ma journée.

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

- Code, audits et bancs du lot poussés sur `claude/personnalisation-simple` ; PR ouverte vers `main`.
- Règle de Julien du 16 nov. : **zéro rouge pour fusionner**. `main` porte déjà des rouges hors de ce lot (CI de la PR
  #1181 : audits 1-3, bancs 1 et 3, parcours-critiques `regles`, `ecrans …`, `comptes-et-reception`). Tant qu'ils ne
  sont pas réglés, la PR n'est PAS fusionnée (voir le rapport final du lot pour l'état exact de la CI).
- Le banc `journee-perso` (11 nov.) n'a pas pu tourner jusqu'au bout ici (machine à charge ~100, pages Chromium
  tuées) : à relancer au calme — `npm run build && node scripts/bancs/journee-perso.cjs`. Ses contrôles (K clavier,
  G glisser, O synchro, U urgent, P Paramètres) restent valables sur l'éditeur simple (mêmes `data-*`).
- À décider par Julien (rien fait) : garder seulement « Apparence » (et retirer l'interrupteur « Mode sombre » qui redit
  la même chose) ; ranger le groupe Affichage (17 lignes).
