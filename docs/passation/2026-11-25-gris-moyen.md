# 25 nov. 2026 — le clair par défaut passe au GRIS MOYEN

Branche `claude/gris-moyen-essai` (partie d'`origin/claude/style-c3`).

## La demande

Julien, devant Aujourd'hui en clair (page #DFE1E5, cartes blanches) et en sombre (page #1C1C20) côte à côte :
« Fais entre les deux s'il te plaît, la couleur ». Trois propositions lui ont été montrées (styles temporaires
`essai-a/b/c`, planches 390 px) :

- A « gris moyen clair » : page #A9ADB3 ;
- B « gris moyen » : page #878B92, cartes #F1F2F4, texte foncé ;
- C « gris ardoise moyen » : page #4A4E55, cartes #3A3E45, texte clair.

Sa réponse : **« Gris moyen c'est d'accord »** ⇒ B devient l'apparence claire PAR DÉFAUT (aucun choix posé). Les
styles temporaires sont retirés. Le mode sombre (#1C1C20) ne change pas.

## Les valeurs (src/natif/jetons.css, bloc clair)

| jeton | avant | après | contraste mesuré |
|---|---|---|---|
| `--n-fond` | #DFE1E5 | **#878B92** | — |
| `--n-laterale` | #D4D7DC | #999DA3 (un cran plus CLAIRE que la page) | secondaire 5,86:1 · entrée active 4,89:1 |
| `--n-carte` / `-2` | #FAFAFB / #E9EBEE | #F1F2F4 / #E3E5E9 | — |
| `--n-bord` / `--n-trait` | #CBCED4 / #E1E3E7 | #B9BDC3 / #D2D5D9 | décoratifs |
| `--n-encre` / `--n-texte` | #1D1D1F / #2E3036 | #0E0F12 / #16181C | 5,60:1 sur la page · 17:1 sur la carte |
| `--n-encre-2` | #50535B | **#1F2226** | 4,67:1 sur la page · 14,3:1 sur la carte |
| `--n-encre-3` | #8C8F98 | #5A5F67 | jamais du texte |
| `--n-accent` = `--n-plein` = `--n-ambre` | #3D4B5B | **#19222C** | 4,70:1 sur la page · blanc dessus 16:1 |
| `--n-barre` | rgb(223 225 229/.94) | rgb(135 139 146/.94) | libellés à l'encre-2 4,67:1 |
| héros | #CDD1D8 → #F1F2F4 | #E3E5E9 → #F1F2F4 | encre dessus |

Pourquoi un secondaire presque noir : sur un gris moyen ni l'encre (5,6:1) ni le blanc (3,9:1) n'ont de marge ; un
texte posé SUR LA PAGE (titre de section, en-tête de groupe, « Mis à jour », libellés de la barre du bas) doit tenir
4,5:1, donc le secondaire est à 4,67:1 sur la page. Sur les cartes, la hiérarchie vient de la taille et de la graisse.
L'accent = le plein (règle S2 de `audit-style-vintex`) : #2C3846 (le plein de l'essai) ne tenait que 3,49:1 posé sur
la page (onglet actif) ; #19222C est l'ardoise la plus claire qui tienne 4,5:1.

## Ce qui suit le fond

- `themeMineral.js` (`MINERAL`, lu par le code d'avant) ; tuile « Actuel » de Paramètres → Style (`styles-choix.css`) ;
- barre d'état et démarrage : `index.html` (meta theme-color, `--vrm-verre-uni`, encres de l'écran de chargement),
  `public/demarrage-theme.js` (`BOOT_CLAIR`), `public/manifest.webmanifest` — pas de flash clair ;
- « Mes envois » (`src/styles-suivi-envoi.css`) : ses `--env-*` clairs lisent les jetons natifs (carte claire posée sur la page) ;
- champs de recherche des anciens écrans (Paramètres, Messages, Stock, E-mails…) : le remplissage gris d'iOS disparaissait
  sur la page grise ⇒ en clair, blanc voilé (`--ap-puits`) + filet `--n-bord` (`src/natif/anciens-ecrans.css`) ; la nuit inchangée.
- L'écran de connexion / la page d'accueil (sombre, marketing) ne changent pas.

## Preuves

`styles-generer --verifier`, `npm run build`, audits style-vintex (rougit toujours sur bleu vif et orange : mutation
faite), couleurs-anciens-ecrans, traduction, quoi-de-neuf, icones, apparence, violet, rouge-doublon : verts.
Bancs `contraste-clair` (G1 : fond #878B92) et `accessibilite@BANC_LARGEUR=390` comparés à `origin/main` par nom.
Planches avant / après à 390 px (Aujourd'hui, Annonces, Ventes, Achats, Argent, Messages, Réglages, Connexion) :
hors dépôt (données inventées du banc).
