# 14 nov. 2026 — Listes : recherche en phrase, glisser pour cocher, épingles, comparer (chantiers 92–95)

Branche `claude/listes-recherche` (depuis `origin/main`, construite SUR `claude/refonte-listes` et
`claude/refonte-coque` fusionnées, puis un vrai `git merge origin/main` à la fin). Pas de PR.
Rien dans `vinted-sync-extension/`. Validé par Julien (« fais tout, lance tout en même temps »).

## Ce qui existait (mesuré avant de coder)
- **⌘K / la loupe** (`src/rechercheUnique.js`, `src/rechercheEcran.js`, `ToutSurLeNumero` dans
  `src/ecrans/Loupe.jsx`) : N°, pseudo, suivi, code, transaction, montant, titre — par IDENTITÉ ; une
  phrase n'y était qu'une suite de mots du titre (« nike 42 pas vendue depuis 2 mois » : rien).
- **Annonces** : un champ (`annSearch`) qui cherchait le titre, la marque ou le N° en sous-chaîne.
- **Sélection en série** : `src/selectionSerie.js` (appui long, Maj-clic) pour Achats/Ventes/Stock ;
  Annonces garde SA vue « Sélectionner » à cases (`ChoixAnnoncesVinted`), case par case.
- **Vues enregistrées** (`src/VuesVentes.jsx`) : des filtres nommés sur Ventes — pas d'épingle par paire.
- Aucune comparaison de deux paires.

## Ce qui change
| n° | quoi | où |
|---|---|---|
| 92 | **Recherche en phrase, sans IA** : l'analyseur local `src/recherchePhrase.js` (5 langues) lit marque (connues + celles LUES dans ses annonces), modèle, taille, N°, prix (« < 80 € », « entre 50 et 90 € », « 52 € »), état (pas vendue / vendue / à retirer / à expédier / brouillon / masquée), durée (« depuis 2 mois », « moins de 7 jours »), jour (« demain », « avant vendredi »), transporteur, ce qu'on cherche (« colis », « ventes »…) ; le reste = mots du titre. Il produit des **filtres** montrés en **capsules** (`src/ui/CapsulesPhrase.jsx`) : un toucher ouvre une petite feuille (changer la valeur, « C'est un N° / une taille », retirer) qui **réécrit le texte** à la place exacte de ses mots (le texte reste la seule vérité). Un filtre sans sens sur l'écran est dit « pas ici » ; s'il vise un autre endroit, « Chercher dans les colis » ouvre la loupe. « Rien ne correspond » est dit ; une valeur pas lue écarte la ligne et se compte (« 3 écartées : taille pas lue »). | Annonces (barre de recherche), la loupe ⌘K (bloc « Ta phrase » : paires, ventes, achats, colis à retirer publiés par Colis) |
| 93 | **Cocher en glissant le doigt**, comme Photos : depuis une CASE (`[data-glisse-poignee]`, `touch-action:none` sur elle seule), la plage entre la 1re ligne et celle sous le doigt prend l'état inverse de la 1re ; revenir en arrière rend leur état d'avant ; défilement automatique près des bords ; ailleurs le doigt fait défiler comme avant ; les cases restent de vraies cases (VoiceOver). `src/glisserSelection.js` (règle), `src/ui/useGlisserSelection.js` (geste, pointer events). | Annonces → Sélectionner (et Brouillons, Republier : la même liste) |
| 94 | **Épingler** : « Épingler / Désépingler » sur les lignes cochées ; les épinglées passent en tête de LEUR compte (Annonces, et Sélectionner), une marque sur la vignette. Par compte VRM : clé synchronisée `vrm_epingles` de la ligne `main` (lire-fusionner-réécrire clé par clé, sous-clé par sous-clé, `src/fusionNuage.js`) ; nuage pas lu ⇒ rien n'est écrit (« Encore un instant… »). Par IDENTITÉ : compte + id de l'annonce ; le N° gardé à côté suit une paire REPUBLIÉE seulement s'il ne désigne qu'une annonce présente du même compte. 20 au plus (au-delà : refusé et dit). `src/epingles.js`. | Annonces |
| 95 | **Comparer deux paires** : exactement deux cochées ⇒ « Comparer » ; une feuille à deux colonnes alignées : achat, prix, marge (seulement si prix ET achat connus), en ligne depuis, état, taille, marque, N°, compte ; « — » pour ce qui n'est pas lu, dit une fois en pied. `src/comparerPaires.js`, `src/ui/ComparerFeuille.jsx`. | Annonces → Sélectionner |

Dessin (AJOUT 3) : capsules de 34 px dessinées / 44 touchées, une teinte légère d'accent (pas un gris,
pas un bouton plein) ; « Épingler » et « Comparer » en secondaires à côté du seul bouton plein
« Actions » ; aucune ombre ni flou sur une rangée. Styles : `src/ui/listes-recherche.css`.
Textes : `listes.phrase.*`, `listes.epingle.*`, `listes.comparer.*`, `listes.glisser.*` — 81 clés,
5 langues (`src/i18n/langues/<l>/rechliste.js`). Quatre lignes dans `src/nouveautes.js`.

## Les pièges tranchés (et audités)
- « 42 » seul entre 16 et 52 : une **taille**, marquée ambiguë (la capsule propose « C'est un N° ») ;
  « N°42 », « n42 », « #42 », « Nr. 42 » : un **N°** ; « 42 » tapé SEUL reste la recherche d'avant
  (par N° ou titre), comme « 128 » et « 52 € » (`estPhrase`).
- « B230 » (lettre + chiffres) : un N° (l'archive de la 013), jamais une taille ni un mot.
- « 550 » : un N°, sauf un modèle New Balance quand la phrase dit New Balance.
- « air max 90 » n'est pas « max 90 € » (les modèles en lettres passent avant les prix) ;
  « moins de 7 jours » est une durée, « moins de 80 » un prix ; « 42 € » un prix.
- Dans la loupe, un type n'est cherché que si CHAQUE filtre y a un sens (« vendue hier » ne ramène
  pas les achats d'hier).
- Rien ne relie par ressemblance (§5) : la phrase CHERCHE ; chaque ligne trouvée ouvre SON objet ;
  l'épingle et la comparaison tiennent par identité.

## Preuves
- `node scripts/audit-listes-recherche.cjs` : EXÉCUTE les modules — 82 phrases en 5 langues
  (filtres exacts), filtrage (pas su compté, « pas ici »), réécriture des capsules, vitesse
  (analyser + filtrer 2 000 paires < 50 ms), épingles (20 au plus, 50 paires au même titre, republiée,
  N° ambigu, autre compte, fusion de deux appareils), glisser, comparer. `--prouve` : 14/14 mutations
  rendent l'audit rouge.
- `node scripts/bancs/listes-recherche.cjs` (après le build) : 1 000 annonces inventées, 390 tactile —
  R phrase (4 capsules, compte attendu, cartes justes, « C'est un N° », « rien », « pas ici », la loupe
  trouve LE colis Mondial Relay de demain) ; G glisser (doigt sur un titre : défile sans cocher ;
  depuis la 1re case jusqu'au bord, défilement auto, arrêt sur la 30e : exactement les 30 premières) ;
  E épingles (écriture `vrm_epingles` par identité, en tête de leur compte, relues par un autre
  appareil, base injoignable ⇒ rien écrit) ; C comparer (prix de la base, « — » pour l'achat).
  Vert après (build fusionné avec refonte-listes + refonte-coque). **Sur origin/main** : aucun des
  sélecteurs jugés n'existe (`git grep` de `data-phrase-filtre`, `data-glisse-poignee`, `data-epingler`,
  `data-comparer-ouvrir` : 0) ⇒ chaque partie tombe rouge à sa première mesure ; le build d'origin/main
  pour le jouer réellement n'a PAS pu être fait (disque du conteneur plein à 100 %, 180 Mo libres) —
  la preuve par mutation est celle de l'audit (14/14). À rejouer : `BANC_DIST=<dist d'origin/main>`.
  Le banc sert une base qui GARDE ce qu'on lui écrit (sinon la relecture, à juste titre, défait l'épingle).
  Captures regardées : `$SHOTS/phrase-*.png`, `glisser-30.png`, `epingles-annonces.png`, `comparer.png`.
- Verts : `npm run build`, audits traduction, tdz, coherence, variables, identite, quoi-de-neuf, icônes.

## Restes (honnêtes)
- La loupe ne connaît pas la date limite d'ENVOI des colis à expédier (la publication `vrm_colis_aposter`
  ne porte que des nombres) : « colis à expédier demain » n'y trouve rien et le dit ; les colis À RETIRER
  (publication `vrm_colis_retirer`, avec limite et transporteur) sont trouvés.
- Ventes, Achats et Stock gardent leur recherche d'avant (la phrase y passe par la loupe ⌘K) ; le même
  composant `CapsulesPhrase` + `filtrerPhrase` se pose sur leurs listes avec leurs accesseurs.
- Le glisser est posé sur la vue à cases d'Annonces ; les listes de `selectionSerie.js` (appui long)
  peuvent recevoir `useGlisserSelection` de la même façon (une poignée par ligne).
- Mesures faites sur une machine très chargée (charge moyenne ~50) : les temps absolus des bancs
  varient ; le banc juge la phrase contre la recherche par N° de la MÊME page.
