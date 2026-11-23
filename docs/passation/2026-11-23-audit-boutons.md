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

Même robot (version finale, mêmes exceptions admises), mêmes écrans (`ECRANS=journee,annonces,ventes,achats,menu,garage,
settings,catalog,stockvinted,dashboard`, `PROFONDEUR=1`, 70 min par vue), build d'AVANT (main du 23 nov. au matin + la
branche de départ) contre build d'APRÈS :

| vue | éléments touchés | champs éprouvés | défauts non admis AVANT | défauts non admis APRÈS |
|---|---|---|---|---|
| 390 tactile | 508 / 514 | 15 / 15 | **16** | **0** (1 au parcours, corrigé ensuite et rejoué : `SEUL=`) |
| 1512 | 510 / 516 | 18 / 18 | **10** | **0** (3 au parcours : 1 corrigé ensuite et rejoué, 2 rejoués à la main puis admis avec leur raison) |

Avant, à 390 : 3 × « Gestes » d'Annonces (feuille sans fermeture par la poignée), « Fermer » de la feuille Actions, 3 ×
menu « … » d'Achats (retour qui quitte Achats), case « À retirer », « Ajouter un achat hors plateforme », « + Ajouter un
meuble », Catalogue × 5 (+1 trop petit, « 12,50 », + Ajouter, Précédent, Suivant), Stock Vinted « Ajouter ». À 1512 :
3 × Échap de « Relier un achat », 2 × achats hors plateforme, Catalogue × 4, Stock Vinted.

Parcours complet (les 25 racines, toutes profondeurs jusqu'à l'arrêt, robot intermédiaire) : 579 éléments touchés à 390,
605 à 1512, 31 / 30 états, 832 / 1 553 rangées « semblables » non rejouées (listes de données : 3 par famille).
Le premier parcours (robot d'avant ses corrections) comptait 90 / 44 « défauts » dont la plupart étaient des artefacts
du robot (contenu de `<details>` fermé, titre replié, toast qui part seul) : corrigés dans le robot, pas cachés.

Exceptions admises (`scripts/bancs/chaque-bouton-admis.json`, chacune avec sa raison) : pavé numérique (0 en tête, 2ᵉ
virgule, ⌫ à vide), feuille d'actions qui se ferme sur un geste choisi, aide « ? » qui passe la main à la visite /
au signalement, assistant « Configure VRM », retour Stock → Annonces (rejoué à la main : bon), « À retirer » déjà en vue
à l'ordinateur (la section se signale 1,4 s).

Vérification : build vert ; passe complète des audits (827) — 31 rouges, **les mêmes que sur `main`** (rejoués sur un
arbre de `main`) ; CI de la PR comparée job par job, audit par audit, banc par banc à celle de la dernière PR fusionnée
(#1305) : aucun rouge nouveau (un audit `confort-securite` « instable », vert au second essai). Un rouge nouveau attrapé
par la CI (`audit-achats-relier` : le sélecteur du champ du nom écrit avant le formulaire dans le source) a été corrigé.
Captures regardées : feuille « Gestes » (poignée), menu « … » d'Achats remonté au-dessus de la barre, « À retirer »
ouvert, Paramètres → Notifications (retour), Catalogue.

## Ce qui reste (et pourquoi)

- Le parcours complet s'arrête par la durée (6 h par défaut) : ~75 / 110 sous-états restaient en file à profondeur 1
  (feuilles et segments de second niveau). Le relancer par morceaux : `ECRANS=… PROFONDEUR=2`.
- Paramètres à l'ordinateur : choisir une catégorie fait défiler la page (pas de page poussée) — pas d'entrée de retour,
  voulu.
- Titre « Annonces » rogné en haut à 1512 (déjà au §3.6 de la passation du 22) : écran d'un autre agent (style).
- Aujourd'hui à 1512 : grand vide à gauche de la colonne de droite — chantier Aujourd'hui (autre agent).
