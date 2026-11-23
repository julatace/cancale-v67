# 23 nov. 2026 — Les tutos, l'accueil et les e-mails ressemblent à l'application (`claude/tutos-design`)

Julien (présentation de VRM le jour même, 17 h) : « tous les tutos doivent ressembler à l'application, même
l'écran d'accueil, etc. ». La page publique montrait encore l'ancienne « Ma journée » bleu nuit (Studio bleu
clair, 15 nov.), les e-mails étaient bleus, le centre d'aide et l'aide de l'app parlaient de « Colis » et de
« Ma journée », qui n'existent plus.

Référence : le design en production APRÈS le fond gris (`claude/style-gris`, PR #1312 : apparence PAR DÉFAUT
= sombre gris-ardoise, les valeurs de vrm.center).

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
1. **E-mails** : le bleu (#174C88, lien #0055B8) remplacé par le gris-ardoise de l'app (#1C1C20, dégradé
   #27272B → #0F0F10), carte blanche à l'encre #16181D, lien à l'encre souligné, plein à l'encre ; nuit = valeurs
   de l'app la nuit. Modèles Supabase refabriqués. Contrastes ≥ 4,5:1 (F8 d'`audit-emails-verre`).
   ⚠️ Geste de Julien : recoller les 6 modèles `supabase/templates/*.html` dans Supabase (comme avant).
2. **Image de partage, boutiques, scène des films** : plus aucun bleu ; le gris-ardoise de vrm.center ; l'app
   capturée dans son apparence PAR DÉFAUT (sombre, `vinted_dark` posé explicitement).
3. **Centre d'aide et aide de l'app** : « Ventes → À envoyer », « Achats → À retirer », « Argent → Déclarer »,
   « Aujourd'hui » ; les légendes des captures nomment les écrans d'aujourd'hui.
4. **Captures du centre d'aide** faites par le même script que l'accueil (une source : elles ne divergent plus).
5. **`audit-captures-a-jour.cjs`** : chaque image qui montre l'app est au registre (empreinte du fichier, mode
   exemple) ET porte l'**empreinte du design** (`scripts/_empreinte-design.cjs` : `src/natif/jetons.css` +
   `src/themeMineral.js`) ; aucune orpheline ; poids bornés. Rouge sur le code d'avant (17 fautes : aucune
   empreinte de design) ; `--mutation` prouve chaque règle (jetons changés, fichier remplacé, ancienne capture
   restée, capture d'aide absente, trop lourde, image de partage décrochée).
   ⚠️ Conséquence voulue : un lot qui change les jetons doit refaire les images (le message dit la commande).

## ÉTAT À LA REPRISE
(mis à jour en fin de session, voir plus bas)
