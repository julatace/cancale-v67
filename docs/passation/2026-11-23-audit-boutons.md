# 23 novembre 2026 — Audit « chaque bouton marche » (`claude/audit-boutons`)

Mission : faire tourner le robot `scripts/bancs/chaque-bouton.cjs` sur tous les écrans montés, à 390 px (tactile) et
1512 px, et corriger ce qu'il attrape : chaque bouton / lien fait quelque chose de visible ou est désactivé avec sa
raison, sans erreur console, sans écran blanc, sans feuille qui ne se ferme pas, cible ≥ 44 px au doigt.
Données : le vendeur INVENTÉ du banc (`_base-volume.cjs`), écritures interceptées — rien en base.

## ÉTAT À LA REPRISE

- Branche `claude/audit-boutons`, fusionnée de `main` (design noir encre + train 5.438) par un vrai `git merge` ; les
  deux conflits (Aujourd'hui, `ventes-verre.css`) gardent la version de `main` (règle de la mission). La branche
  porte toujours le commit « Bugs-totale (1) » qu'elle avait au départ (même commit que `claude/bugs-totale`).
- Extension non touchée (la 5.439 est réservée à un autre agent).
- Voir « Chiffres » et « Ce qui reste » plus bas.

## Le robot lui-même (corrigé avant de le croire)

- **Autotest rouge après la fusion** : le toast « N nouveaux articles numérotés » part seul au bout de 10 s ; sa
  disparition tombait pendant le toucher du bouton « mort » et passait pour son effet. Le robot le laisse partir
  avant de relever le stockage (il note « vu », ne revient plus). Autotest vert à 390 et 1512 (8/8 fautifs).
- Le contenu d'un `<details>` **fermé** garde ses mesures sous Chrome : tout un rapport replié passait pour
  « recouvert par son summary » (Argent, Comptes liés : ~60 faux défauts). Il n'est plus « visible ».
- Le grand titre replié au défilement reste le titre de l'écran (sinon « retour ailleurs » à tort).
- Un « aller à la section » touché une 2ᵉ fois qui DÉFILE est un effet (Argent : « Reçu », « Bénéfice »).
- Changer d'onglet DANS un écran (Organisation : Missions · Lots…) est un segment exploré, pas une page à défaire par
  le retour.

## Corrigé dans l'app (chaque défaut vu par le robot, puis rejoué à la main par une sonde)

| écran | défaut attrapé | correction |
|---|---|---|
| Toutes les feuilles natives (`src/natif/Feuille.jsx`) | la poignée s'annonce « Fermer » / « Agrandir » mais un toucher ne faisait RIEN (le clic part sur la tête qui tient le pointeur) | un toucher sans glisser fait ce que dit son nom (comme au clavier) ; un glisser reste un glisser |
| Ventes (ordi) | Échap ne fermait pas « Relier un achat » : la cellule (`celluleAchat.jsx`, `PropositionLiaison.jsx`) arrêtait toutes les touches | Échap passe ; les autres touches restent dans la cellule |
| Achats | « + Ajouter » (achats hors plateforme) : formulaire déjà ouvert ⇒ rien ; `ajoutRef` n'était posé sur aucun élément (le plein « Ajouter un achat » ne descendait jamais à la saisie) | la saisie s'ouvre ET on y descend |
| Achats | menu « … » d'un achat bas dans l'écran : passait sous la barre d'onglets (Diviser, Copier le prix… invisibles) ; le geste retour quittait Achats | le menu se met en vue à l'ouverture ; retour/Échap le referment |
| Achats | case « À retirer » de la bande : `onNav('retraits')` revenait sur Achats — rien ne bougeait (ordi) | ouvre et met en vue la section « À retirer » |
| Stock | « Nouveau meuble » : pas un dialogue (ni rôle, ni retour, ni Échap), × de 20 px | `role="dialog"`, `FermeAuRetour`, × 44 px |
| Paramètres (téléphone) | une catégorie / un panneau ouvert d'un toucher : le geste retour quittait Paramètres entier | page poussée (une entrée par niveau) ; un lien direct (Menu → Langue) n'en prend pas : le retour ramène au Menu |
| Statistiques | vente annulée sans lien : un `<a>` sans adresse, touchable, menant nulle part | une ligne simple quand le lien n'est pas connu |
| Catalogue | prix d'achat « 12,50 » devenait « 1250 » (champ numérique) ; Précédent / Suivant actifs sans effet en page 1/1 ; « Ajouter » vide sans effet ; « +1 » de 30 px | champ texte décimal (virgule lue), boutons désactivés avec leur raison (5 langues), +1 à 44 px |
| Stock Vinted | « Ajouter » à vide : rien | met le doigt dans le champ |

## Chiffres

(remplis à la fin du parcours — voir la section suivante)

## Ce qui reste (et pourquoi)

- Stock → « N sans prix › » (carte Valeur du stock) : le robot voit le retour rester sur Annonces. Hypothèse (non
  prouvée, la carte n'apparaît que dans un sous-état du parcours) : la saisie des prix s'ouvre en feuille, le 1er
  retour la ferme, le 2ᵉ ramène au Stock.
- Titre « Annonces » rogné en haut à 1512 (déjà au §3.6 de la passation du 22) : écran d'un autre agent (style).
- Aujourd'hui à 1512 : grand vide à gauche de la colonne de droite — chantier Aujourd'hui (autre agent).
