# 23 nov. 2026 — Gris clair étagé, iPhone « réglages d'iOS », carte d'événement (`claude/style-clair`)

## ÉTAT À LA REPRISE
- Branche `claude/style-clair` (partie de `claude/style-clarte-5`), poussée. La PR n'avait PAS été ouverte par le premier agent (le récit le disait à tort) : ouverte le 23 nov. après-midi par l'agent de reprise (numéro dans le §9 / la liste des PR). **Fusion après le 24 nov. 07:00 UTC** (gel 15:00 → 07:00), CI sans rouge nouveau par rapport à main, Vercel success.
- Reprise du 23 nov. (après-midi) : `aujourdhui-propre` était DÉJÀ rouge sans la branche (mêmes 8 rouges F2/F3 sur `claude/photos-nettes`, banc identique à main) ⇒ pas corrigé ici ; `natif-coque` aussi rouge sans la branche. Ventes iPhone : une seule ligne de détail (les rangées « sans bordereau · à vérifier » faisaient 92 px) ; `ventes-lisibles` juge désormais CHAQUE rangée (mise en page forcée le temps de la mesure : les rangées ≥ 20 portent `content-visibility: auto`, vignette 0 px hors fenêtre) — vert (30 rangées à 80 px, vignettes 52). `galerie-pops` vert (restore_N = synchronisation). `contraste-clair` vert après le dessin fin. Passe d'audits : 31 rouges, aucun nouveau par rapport à la passe de `claude/photos-nettes` (base main 69c0f6c70 ; 32 rouges).
- Julien : « OK design ». **Variante A retenue** (gris froid, accent ardoise) ; la variante B (pierre) est retirée.
- PR #1312 (`claude/style-gris`, sombre par défaut) **fermée** : son gris foncé est gardé ici comme mode sombre CHOISI.

## Les décisions de Julien (mot pour mot)
- « j'aime pas le orange, fais plus clair, j'aime pas le noir, je veux que ce soit gris clair » ; « avec un mélange de degrés de gris » ; « tu peux faire gris un peu plus foncé ».
- « quand une vente arrive, un achat, etc., je veux un beau pop-up, là c'est moche ».
- « c'est bien sur ordi mais sur téléphone c'est pas ouf » ; « tu peux faire moins zoomé » ; « un design simple, minimaliste et premium ».
- « trop de texte, pas assez de beaux boutons » (règle pour toute l'app).
- Une galerie « Voir tous les pop-ups » sur SON compte (propriétaire) seulement.

## Ce qui a changé
1. **Couleurs** (`src/natif/jetons.css`, `src/themeMineral.js`, `index.html`, manifeste, `public/demarrage-theme.js`) : page #DFE1E5, latérale #D4D7DC, cartes #FAFAFB, zones #E9EBEE, bords #CBCED4, texte #1D1D1F, secondaire #50535B (≥ 5:1), accent et plein ARDOISE #3D4B5B, `--n-ambre` = l'accent (plus d'orange), héros en dégradé gris clair (#F1F2F4 → #CDD1D8), barre de sélection grise. Le rouge reste au doublon de N°. La nuit = le gris de vrm.center (#1C1C20), choisie.
2. **Carte d'événement** (`src/natif/PopEvenements.jsx`, `public/sw.js`) : app ouverte au premier plan, le service worker passe la notification du serveur à l'app (accusé 800 ms, sinon la bannière du système ; Safari la referme aussitôt). Mêmes données ; photo de l'e-mail, sinon PAR IDENTITÉ (n° de transaction, n° de conversation — `photoEvenement` dans `AppCoeur`) ; pile compacte « +2 », même hauteur, 7 s sauf tenue, attend qu'une feuille se ferme, Échap ; iPhone : une rangée sous la barre d'état, balayer vers le haut ferme. ⚠️ Safari : à essayer sur un vrai iPhone (fermeture immédiate de la bannière).
3. **Galerie du propriétaire** (`src/natif/GaleriePops.jsx`, `src/galeriePops.js`) : Paramètres → Propriétaire → « Voir tous les pop-ups ». La liste vient de `APERCUS_NOTIF` (api/_lib/notif-apercus.js, les vrais textes) + 3 messages courts. Rien écrit, rien envoyé. Banc `galerie-pops`.
4. **iPhone** (`src/natif/graphe.css`, `src/natif/complements.css`, `Aujourdhui.jsx`) : héros compact (courbe 56 px sans axes ni légende, détail au toucher, « Saisis N prix › »), plus de puce d'extension, Colis dans le premier écran, titres 28, sections 13/600, cartes 16 sans filet épais, Ventes 64–72 px (« Relier · + prix » en liens discrets).
5. **Règle « trop de texte »** : composants communs `Actions` / `Pourquoi` (`src/natif/Actions.jsx`) ; banc `textes-visibles` (plafonds `_textes-visibles-plafonds.cjs`, qui ne font que descendre ; cible 3 par écran rapportée) ; CLAUDE.md §7.
6. **Contrôles** : `contraste-clair` (ex-`contraste-gris`) mesure chaque texte de chaque écran sur le gris étagé (et `SOMBRE=1` sur la nuit) ; `audit-style-vintex` exige l'ardoise, le plein ≠ noir, plus d'orange (mutations).

## Reste
- Retirer les phrases longues écran par écran (les autres chantiers réutilisent `Actions`/`Pourquoi`).
- Pop-up sur Safari réel.
