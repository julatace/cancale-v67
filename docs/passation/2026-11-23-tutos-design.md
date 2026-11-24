# 23 nov. 2026 — Les tutos, l'accueil et les e-mails ressemblent à l'application (`claude/tutos-design`)

Julien (présentation de VRM le jour même, 17 h) : « tous les tutos doivent ressembler à l'application, même
l'écran d'accueil, etc. ». La page publique montrait encore l'ancienne « Ma journée » bleu nuit (Studio bleu
clair, 15 nov.), les e-mails étaient bleus, le centre d'aide et l'aide de l'app parlaient de « Colis » et de
« Ma journée », qui n'existent plus.

Référence : d'abord le fond gris foncé (`claude/style-gris`, PR #1312) ; ⚠️ **CHANGÉ à 11:15 UTC (Julien)** :
« TOUTE l'app en gris clair (fond gris clair, cartes blanches, texte foncé, pas d'orange, pas de grands aplats
noirs) ; le gris foncé ne reste que sur la page publique ». La nouvelle apparence claire est faite par l'agent
design (sur main demain, probablement). **Les captures et films se font sur ELLE, en clair.** Les captures
d'essai faites sur style-gris (sombre) n'ont PAS été versées.

## Inventaire — tout ce qui montre l'app hors de l'app

| quoi | fichiers servis | générateur |
|---|---|---|
| Page d'accueil (iPhone + ordinateur, 6 moments, clair et sombre) | `public/accueil/*.webp` + `captures.json` | `scripts/accueil-captures.cjs` (mode exemple) |
| Image de partage (lien collé) | `public/og-vrm.jpg` + `.json` | `scripts/accueil-og.cjs` |
| « Voir VRM en 45 s » | `public/accueil/film-45s.{mp4,jpg,*.vtt}` + `film-45s.json` | `scripts/films/accueil-video.cjs` |
| Vidéos du « ? » | `public/aide/videos/*` | `scripts/films/aide-videos.cjs` — PR #1238 (`claude/aide-videos`, autre agent) les retourne |
| Captures du centre d'aide vrm.center/aide | `public/aide/captures/*.jpg` + `captures.json` | désormais `scripts/accueil-captures.cjs` (mêmes écrans) |
| Textes du centre d'aide | `public/aide/*.html` | `scripts/aide-contenu.cjs` → `scripts/aide-generer.cjs` |
| Aide de l'app (« Comment faire… ? », FAQ) | `src/aideFiches.js` | à la main |
| Fiches des boutiques d'extensions | `docs/boutiques/visuels/*.png` | `scripts/boutiques-visuels.cjs` |
| E-mails (VRM + 6 modèles Supabase) | `api/_lib/mail-verre.js`, `supabase/templates/*.html` | `scripts/modeles-email.cjs --ecrire` |
| « Découvrir avec des exemples », visites guidées | l'app elle-même (mode exemple) | suit le design tout seul |
| Écrans de lancement iPhone | `public/demarrage/*.jpg` | `scripts/demarrage-images.cjs` (rendu depuis `index.html` : à refaire quand style-gris change l'écran de démarrage — c'est au lot style-gris / à vérifier par `--verifier`) |

## Ce qui est fait
1. **E-mails** : le bleu (#174C88, lien #0055B8) remplacé par le GRIS CLAIR de l'app (fond #F4F4F2, dégradé
   #FAFAF8 → #EDEDEA), titre et pied à l'encre #16181D / #5F636A, carte blanche, lien à l'encre souligné, plein à
   l'encre ; la nuit du client mail : valeurs graphite de l'app (titre, pied, liens passent au clair par les classes
   `vv-encre` / `vv-gris` / `vv-pied` / `vv-lien`). Modèles Supabase refabriqués. Contrastes ≥ 4,5:1 (F8
   d'`audit-emails-verre`, paires de nuit ajoutées). `audit-mails-envoyes` lit l'encre dans `VERRE.plein` (plus
   `#0C1D30` en dur). ⚠️ Si l'agent design change les valeurs claires, recopier `--n-fond` / `--n-encre` ici.
   ⚠️ Geste de Julien : recoller les 6 modèles `supabase/templates/*.html` dans Supabase (comme avant).
2. **Image de partage, boutiques, scène des films** : plus aucun bleu ; le CADRE prend le gris-ardoise de la page
   publique ; l'APP y est montrée en CLAIR (`vinted_dark` = false posé explicitement ; `Film` : `sombre = false`).
3. **Centre d'aide et aide de l'app** : « Ventes → À envoyer », « Achats → À retirer », « Argent → Déclarer »,
   « Aujourd'hui » ; les légendes des captures nomment les écrans d'aujourd'hui.
4. **Captures du centre d'aide** faites par le même script que l'accueil, en clair (une source : elles ne divergent plus).
5. **`audit-captures-a-jour.cjs`** : chaque image qui montre l'app est au registre (empreinte du fichier, mode
   exemple) ET porte l'**empreinte du design** (`scripts/_empreinte-design.cjs` : `src/natif/jetons.css` +
   `src/themeMineral.js`) ; aucune orpheline ; poids bornés. Rouge sur le code d'avant (17 fautes : aucune
   empreinte de design) ; `--mutation` prouve chaque règle (jetons changés, fichier remplacé, ancienne capture
   restée, capture d'aide absente, trop lourde, image de partage décrochée).
   ⚠️ Conséquence voulue : un lot qui change les jetons doit refaire les images (le message dit la commande).

6. **Tutos en mouvement** (Julien : « fais un vrai accompagnement, n'hésite pas à faire du motion design ») :
   `scripts/films/tutos-gestes.cjs` — cinq films de 15–45 s dans la VRAIE app (monde inventé des films) :
   relier un compte · imprimer ses bordereaux · numéroter et ranger · relier un achat · lire son bénéfice. Le
   mouvement = le moteur des films (iPhone sur la scène, caméra qui s'approche, onde du doigt, défilement réel,
   carton de fin). Sous-titres `.vtt` en 5 langues (aucun texte incrusté, aucun son). Cibles tolérantes (`une()` :
   la première présente parmi plusieurs, sinon le film le dit). `PUBLIER=1` → `public/aide/tutos/` + `tutos.json`
   (empreintes + design). `audit-tutos-gestes.cjs` (4 mutations rouges). `prefers-reduced-motion` : le lecteur ne
   lance rien seul, jamais en boucle (comme `AccueilVideo`).

## ÉTAT À LA REPRISE (23 nov., ~11:30 UTC)
- Branche `claude/tutos-design`, PR ouverte, **PAS fusionnée** (consigne : rien aujourd'hui sauf apparence claire
  sur main avant 14:00 UTC ; commandes lourdes seulement après 15:30 UTC). ⚠️ Sur la PR, `audit-captures-a-jour`
  est ROUGE exprès : les images n'ont pas encore été refaites sur la nouvelle apparence.
- Prouvé : `audit-captures-a-jour` rouge sur le code d'avant (17 fautes), ses 6 mutations rouges sur un arbre aux
  captures refaites (essai sur style-gris : il ne restait que le film) ; `audit-tutos-gestes --mutation` ;
  e-mails : `audit-emails-verre`, `audit-modeles-email`, `audit-emails-beaux`, `audit-emails-html`,
  `audit-mails-envoyes`, `audit-style-vintex` verts ; `audit-centre-aide`, `audit-aide-client`, `audit-quoi-de-neuf` verts.
- Constaté au passage : sur style-gris (et donc main à 10:30), **Achats tombe** (« Icon is not defined » dans
  les colis à retirer) — réparé par PR #1313 (`claude/demo-propre`), à fusionner AVANT les captures (la capture
  « À retirer » et le plan 3 du film de 45 s en dépendent).
- **À FAIRE, dans l'ordre, quand la nouvelle apparence claire ET #1313 sont sur main** :
  1. `git merge origin/main` ; si les valeurs claires des e-mails ont changé, recopier `--n-fond`/`--n-encre` dans
     `api/_lib/mail-verre.js` puis `node scripts/modeles-email.cjs --ecrire`.
  2. `lourd.sh npm run build`, puis `lourd.sh node scripts/accueil-captures.cjs` (accueil clair+sombre ET
     `public/aide/captures/` en clair), `node scripts/accueil-og.cjs`,
     `node scripts/boutiques-visuels.cjs` (+ `--langue en`), `PUBLIER=1 node scripts/films/accueil-video.cjs`,
     `PUBLIER=1 node scripts/films/tutos-gestes.cjs` (régler les cibles qui disent « aucune cible »),
     et les vidéos du « ? » (`PUBLIER=1 node scripts/films/aide-videos.cjs`) **après** la fusion de #1238.
  3. REGARDER chaque image (390 et 1512) et chaque film ; `node scripts/audit-captures-a-jour.cjs` et
     `audit-tutos-gestes` verts ; banc `scripts/bancs/accueil.cjs`.
  4. Brancher les cinq tutos : centre d'aide (une page « Tutos » ou un bloc par article) et la page publique
     (à côté de « Voir VRM en 45 s ») — lecteur au toucher, affiche d'abord, piste de la langue de la page.
  5. `npm run build`, passe complète `lancer-audits`, PR, CI, fusion selon la règle du brief.
- Gestes de Julien : recoller les 6 modèles `supabase/templates/*.html` dans Supabase (après la fusion).

## REPRISE DU 24 NOV. — tout refait au gris clair (#1326), PR #1320
- Fusions : `origin/claude/style-clair` (#1326) puis `origin/main` (vrais `merge`) ; CLAUDE.md §9 et `nouveautes.js` gardent les deux côtés.
- **E-mails** : `api/_lib/mail-verre.js` recopié sur les jetons de #1326 (fond `#DFE1E5`, dégradé `#E9EBEE → #DFE1E5 → #D4D7DC`,
  carte `#FAFAFB`, encre `#1D1D1F`, gris `#50535B`, filet `#E1E3E7`, puits `#E9EBEE`, lien à l'ardoise `#3D4B5B` souligné, plein à
  l'encre — `audit-mails-envoyes` exige un plein d'encre foncé) ; `node scripts/modeles-email.cjs --ecrire` ⇒ les 6 modèles Supabase.
  Nuit inchangée. Audits e-mails verts (contrastes AA).
- **Jetons de nuit hérités du clair par #1326** (vus sur les captures sombres) : `--n-sur-heros` (le chiffre du héros d'Aujourd'hui
  était encre sur ardoise, illisible) ⇒ `#FFFFFF` ; `--n-laterale` (latérale gris clair, texte blanc) ⇒ `#2A2A2F` ; `--n-ambre*` de
  nuit (pastilles orange) ⇒ l'accent clair. Argent : « À envoyer » (`verre-ecrans.css`) et URSSAF de l'anneau (`fusion.css`)
  n'ont plus d'orange en dur.
- **Refaits** : `accueil-captures.cjs` (accueil clair+sombre + `public/aide/captures/`), `accueil-og.cjs`, `boutiques-visuels.cjs`
  (fr + `--langue en`, les `en-*` versés pour la première fois), `PUBLIER=1 accueil-video.cjs`, `PUBLIER=1 tutos-gestes.cjs`.
  Vidéos du « ? » (`aide-videos.cjs`) PAS refaites : #1238 n'est pas fusionnée.
- **Cibles des films réglées** : 45 s, Ventes : « ⋯ » (`data-vn-plus`) puis « Choisir ce qui part » ; Annonces : la rangée est
  `[data-eg-article="vinted#7103"]` (les anciennes `data-carte-annonce` sont des copies cachées). Tutos : imprimer (vrai clic sur le
  bouton fixe ⇒ choix du papier puis aperçu tamponné) ; numéroter (Stock n'est plus dans la barre du bas ⇒ coupe en fondu vers
  `garage`) ; relier un achat (monde `achatARelier` : N°23 sans prix d'achat, achat reçu 92005 ⇒ « Relier », proposition, Oui) ;
  bénéfice (Ventes ouvert hors champ d'abord, sinon Argent dit « Pas encore calculé »). Reste : le plan « retrait » du 45 s ne
  trouve plus `[aria-label^="Copier code de retrait"]` (plan gardé, caméra immobile).
- Regardé : chaque capture (390 et 1512, clair et sombre), l'image de partage, les visuels des boutiques, des planches de chaque film ;
  balayage « orange » de toutes les images et d'une image par seconde des films : seuls restent les logos Leboncoin (marque).
- Vu au passage (pas corrigé, à #1326 / design) : Argent au téléphone, carte URSSAF : « avant le 30 nov. » est mangé par
  « J'ai déclaré » quand Argent n'a pas encore calculé ; beaucoup d'oranges en dur restent dans des CSS d'anciens écrans
  (`#A35200`, `#B25E00`, `#FF9F0A`…), hors captures.
- Verts : `audit-captures-a-jour` (+ `--mutation`), `audit-tutos-gestes` (+ `--mutation`), e-mails (6 audits), `audit-style-vintex`,
  `audit-centre-aide`, `audit-aide-client`, `audit-quoi-de-neuf`, `audit-traduction`, `audit-coherence`, `npm run build`.
  Banc `accueil` : 3 rouges, les MÊMES sur l'arbre d'avant (fusion sans ce lot) : fichier d'entrée 28,9 Ko, « film fonction pure du
  temps », poids au chargement 410–416 Ko qui varie d'un passage à l'autre — aucun rouge nouveau.
- Pas fait (hors de cette reprise) : brancher les 5 tutos dans le centre d'aide et la page publique (étape 4 ci-dessus).
