# 23 novembre 2026 — Audit « chaque bouton marche », 2ᵉ passe (`claude/audit-boutons-2`)

Suite de `2026-11-23-audit-boutons.md` (PR #1306, fusionnée). Mission : relancer le robot
`scripts/bancs/chaque-bouton.cjs` par morceaux, `PROFONDEUR=2`, sur les sous-écrans que la 1ʳᵉ passe n'avait pas
atteints (Argent et ses onglets, Messages, E-mails, fiches, feuilles Relier / Bordereau / Publier, Paramètres en
profondeur, écrans eBay / Leboncoin / Vestiaire), à 390 tactile et 1512, et corriger. Hors mission : vide à gauche et
titre rogné à 1512 (agent dédié).

## ÉTAT À LA REPRISE

- Branche partie de `main` = 5cee8d334 (fusion de #1306). Poussée. **Aucune PR ouverte.**
- **Arrêté à 10:54 UTC** sur consigne (machine saturée avant la démo de Julien : aucune commande lourde avant
  15:30 UTC ; aucune fusion sur `main` entre 15:00 UTC et demain 07:00 UTC sans autorisation).
- Lanceur des morceaux : `$SCRATCH/cbs/morceaux.sh <tel|ordi> <dist> <sortie>` (six morceaux A–F, `PROFONDEUR=2`,
  `DUREE_MAX=3000` s chacun) :
  A `compta,invoices,dashboard` · B `messages,emails,cat_msg,adistance` · C `ventes,achats` · D `annonces,garage` ·
  E `settings,vintedaccounts,extension,automatisations` · F `plat_leboncoin,plat_ebay,plat_vestiaire,ebay_agent,ebay_messages,prixmarche`.
  Fait avant l'arrêt : A (390 et 1512), B (390 et 1512, partiel), C à 1512 commencé. **À reprendre : C, D, E, F.**
- Avec `PROFONDEUR=2`, le robot quitte vite le morceau (un lien de la coque ⇒ Aujourd'hui, Annonces…) : peu d'états
  du morceau par heure. Piste : borner l'exploration aux écrans du morceau (à faire dans le robot).

## Chiffres provisoires (avant l'arrêt)

| morceau | vue | états | éléments touchés | défauts |
|---|---|---|---|---|
| A Argent | 1512 | 5 | 169 | 2 (un seul cas, voir plus bas) |
| A Argent | 390 | 7 | 163 | 1 (faux positif du robot, corrigé) |
| B Messages… | 1512 | 20 | 357 | 3 (1 faux positif du robot, 1 admis, 1 à éclaircir) |
| B Messages… | 390 | 9 | 126 | 1 (admis) |

## Le robot (corrigé)

- Un champ resté actif d'un toucher d'avant cachait l'effet « focus » du toucher suivant (« Ajouter un achat hors
  plateforme » vu « sans effet » alors que le doigt était déjà dans le champ) : il est quitté avant chaque toucher.
- Une fenêtre ouverte vide PUIS écrite (le récap imprimable d'Argent → Déclarer) n'est pas un « lien cassé ».
- L'aide « ? » qui passe la main à la visite / au signalement est admise sur tous les écrans (pas seulement Aujourd'hui).

## À éclaircir à la reprise

- Argent → Statistiques → « Vérifier mes prix » (feuille « Prix d'un site à l'autre ») : dans le parcours, Échap ne la
  fermait pas, puis le retour a quitté l'app. Rejoué seul (entrée directe sur Statistiques) : Échap la ferme. Hypothèse :
  une entrée de feuille laissée par l'écran Argent gardé en arrière-plan (Résumé / Factures) reçoit l'Échap. Sonde prête
  (`ALLER=dashboard` depuis `TAB=compta`), pas encore jouée.
