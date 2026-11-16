# 16 nov. — Lot `bancs-rouges-a` : les rouges connus, cause d'abord

Branche `claude/bancs-rouges-a` (partie d'`origin/main` b8f26f36d). Sources : `2026-11-15-rouges-connus.md`,
`2026-11-15-fiche-d.md`, `2026-11-15-atelier-arrivee.md`. Le workflow `parcours-critiques` n'est PAS touché (lot
`claude/parcours-vert`).

Méthode : chaque rouge relancé seul, mesuré (sonde, capture), puis : défaut de l'app ⇒ l'app est corrigée ; contrôle
périmé ⇒ réécrit sur la RÈGLE d'aujourd'hui, la décision citée, jamais affaibli. Machine très chargée (charge 40 → 85)
et **disque plein deux fois** (5 Mo libres : Chromium « Target closed » partout) — voir « Incident ».

## Le tableau

| banc / audit | cause | défaut app / contrôle périmé | correction | preuve |
|---|---|---|---|---|
| `audit-revue-fin` A4 | App.jsx recollé à ses écrans : `partageFichiersPossible` (App.jsx et `ecrans/Republier.jsx`) puis `joursAvant` (App.jsx et `ecrans/Reglages.jsx`) déclarés deux fois au niveau module | défaut de code (deux noms identiques, sens différents ; tous les audits qui relisent l'app recollée tombaient) | `partageNatifPossible` (Republier), `joursAvantIso` (Reglages) | 37/38 → 38/38 ; sonde Babel `errorRecovery` : 0 doublon restant |
| `audit-politique-hotes` | 14 couples (fichier, hôte) écrits du 11 au 15 nov. sans être déclarés. Un seul contacté tout seul par le navigateur : **la carte des ventes (Argent, 14 nov.) interroge la Base Adresse Nationale** — la politique ne le disait pas. Les 13 autres : des liens `<a>` ou une base de `new URL` | **défaut** (politique de confidentialité incomplète) + liste à jour | ligne « Placer sur la carte de tes ventes… (écran Argent) · ville + code postal, envoyés par ton navigateur » ; la ligne « logos des transporteurs » retirée (dessinés dans l'app sans requête depuis le 10 nov.) ; date de la politique 16 nov. | vert ; `--prouve` 12/12 (mutation neuve « ligne carte des ventes retirée » ⇒ rouge ; l'ancienne mutation logos remplacée par « un logo rechargé depuis le site du transporteur » ⇒ rouge) |
| `audit-coque-parametres` | l'icône en double n'était plus `mail` mais `grid` : l'atelier d'arrivée (15 nov.) a donné `texte` à « Taille du texte » et `grid` au zoom, déjà pris par « Mes plateformes » | défaut (deux lignes, une icône) | zoom ⇒ `ecrans` | 26/27 → 27/27 ; `audit-icones` vert |
| `audit-plateformes-logo --prouve` | 8 motifs introuvables : écrans découpés (`ecrans/Vestiaire, Ebay, Achats, Leboncoin.jsx`), compteur `libre`, montant Leboncoin par `montant()`, Vestiaire sans identifiant (15 nov.) | contrôle périmé ; **et** l'audit laissait une copie de `src/` dans /tmp par mutation (72 copies, 1,8 Go) | motifs visés à leur place, même défaut réintroduit ; `vc-id-ecrit` (réécrire l'identifiant Vestiaire) ; la copie est effacée à la sortie | 28/36 → 36/36 |
| banc `enligne` (25 KO) | (1) règle du 2 nov. (`<enligne-regle>`, Julien : une lecture PUBLIQUE n'ajoute jamais une annonce) — le banc exigeait l'inverse ; (2) sélecteur `A, B [x]` (la virgule visait la ligne elle-même, pas son bouton) ; (3) ligne de fraîcheur du tableau de bord dans le volet « Argent depuis le début » (replié, monté ouvert, 2 nov.) ; (4) Leboncoin ni choisi ni relié (8 nov.) et `id=in.(…)` jamais servi par la fausse base ; (5) plaque N° sans geste dans une rangée fermée (Studio, 14 nov.) ; (6) « À relire il y a 3 j » au lieu de « capté il y a » | contrôle périmé (aucun défaut d'app trouvé) | 7003 captée par son compte, **7004 vue seulement en public : exigée HORS de la grille, de la file Leboncoin et du compte** (contrôle neuf) ; `:is(…)` ; volet ouvert comme lui ; Leboncoin choisi + `lbc_listings`, `id=in` servi ; N° tapé depuis la rangée ouverte au téléphone ; âge lu par « il y a N j » ; attentes sur un ÉTAT (file rendue, « Pourquoi ? » ouvert) | 25 KO → **tout vert** (sections 1–13b) |
| banc `vestiaire-bout-en-bout` B2 | MESURÉ (sonde 300 ms, 390 px) : tant que ses plateformes ne sont pas lues (« pas su » ⇒ aucune rangée), `site=vestiaire` ouvre la tâche sur Vestiaire ; dès qu'elles le sont, l'effet de `FiltreSites` revient à une vue montrée (achats : 924 → 1 674 ms). Le délai fixe de 1,5 s tombait sous charge dans cette fenêtre — l'onglet rouge changeait d'un passage à l'autre (messages, puis achats) | contrôle sur un délai (§6.5) ; l'effet de l'app fonctionne | attendre que la tâche ait QUITTÉ Vestiaire (15 s), puis qu'elle n'y revienne pas (1,5 s) | rouge 2 fois sur 2 avant (un onglet différent) ; voir l'état final plus bas |
| banc `sante-donnees` (11) | MESURÉ (chaque écriture de `main` journalisée clé par clé, valeur égale ou non) : une écriture de `main` réécrit la ligne ENTIÈRE — `vinted_sales`, `vinted_accounts` y repassent **à valeur égale** (c'était le « colis-a-confirmer réécrit vinted_sales » du 15 nov. : un artefact de lecture, pas une réécriture de données). Ce qui CHANGE : des publications d'écran. Deux d'Achats (`vrm_achats_jours`, `vrm_annonces_achetees`) manquaient à `CLES_PUBLIEES` ⇒ ouvrir Achats comptait « 2 changements » en attente | **défaut app** (compteur de changements faux) + contrôle périmé (Colis vit dans Ventes, 11 nov. ; non-données) | `CLES_PUBLIEES` + les deux clés ; banc : `NON_DONNEES` = la liste d'a-trancher + `widget_stats`, `lbc_a_retirer` (publications à part, écrites quand elles changent) ; G attend l'écran Ventes, l'onglet de colis reste jugé | rouge sur le code d'avant (`changees` = les deux clés) ; voir l'état final |
| banc `reglages-premium` | « Sécurité des comptes » / « Sécurité des données » écrits deux fois : un panneau qui porte le nom de SA catégorie redisait son titre dans le chemin (`<small>{titreRetour}</small>` au-dessus du `<h2>`) | **défaut app** (§7) | le chemin remonte alors à « Paramètres » | voir l'état final |
| banc `stock-planches` | (1) toucher une case ouvre LA fiche (14 nov.) ; fiche D (15 nov.) : « Retirer de la case », « Déplacer », la place — la place `contexte` de la LIGNE — étaient repliés sous « ⋯ » › « Tout voir » (trois touchers, bouton invisible) alors que la fiche D dit « les places de la ligne vivent dans cette feuille » ; (2) « Une à chaque rangée » / « Aucune » de `ChoixPlanches` à 30 px | **défaut app** ×2 | la place `contexte` passe dans la feuille « ⋯ », à côté des actions ; `minHeight: 44` ; banc : geste par « ⋯ », et exige que la fiche se REFERME après chaque retrait (contrôle neuf) + 44 px au doigt (contrôle neuf) | rouge avant (bouton invisible, 30 s) → **tout vert** ; 0 fiche restée ouverte |
| banc `lot1415` D | lisait `.vrm-fp-tuiles` (fiche d'avant) ; fiche D : prix dans la ligne d'état (`data-fd-etat`), argent sous « Argent » (une paire en vente s'ouvre sur « Sites ») ; **et une paire EN VENTE sans prix d'achat n'avait plus AUCUN moyen de saisir ce prix** (l'action est « Baisser ») | contrôle périmé + **défaut app** (§5 « le chiffre faux est la porte pour le corriger ») | le « ? » d'« Achetée » devient la porte de la saisie (`data-fiche-saisir-achat`, 44 px) quand la grande action n'est pas déjà « Saisir » ; banc relu sur `data-fd-etat`, `data-fd-vue-argent`, `data-fiche-*` | voir l'état final |
| banc `stock-2d` VII | même lecture `.vrm-fp-tuiles` ; le prix d'achat sous la vue « Argent » | contrôle périmé | vue « Argent » ouverte comme lui ; règle « écrit une fois » jugée sur vue Argent + ligne d'état + « L'état » | voir l'état final |
| banc `stock-juste` J/A, P, T | « À trancher » a quitté la liste de Ma journée pour la feuille « Tout va bien ? » (15 nov., refonte-journee) ; **le lien `?tab=trancher` (SMS, notifications) ouvrait la carte dans une feuille FERMÉE : il ne montrait rien** ; P : la pilule « Annuler » partait toute seule avant que son entrée animée soit « stable » sous charge | **défaut app** (lien mort) + contrôle périmé | `?tab=trancher` ouvre aussi la feuille ; banc : « À trancher » par la feuille, et « rien ne recouvre Annuler » jugé au point touché avant le toucher | vert (J, A, P, T) |
| banc `stock-retrouver` | défilement DOUX vers la case : sous charge > 1,2 s (case à y = 1 233 / 950) | délai fixe (§6.5) | attendre la case dans l'écran (8 s) | vert |
| banc `ventes-e2` V7 | « jamais blanc en sombre » : depuis « Verre dépoli » (maquette 9 choisie par Julien, `studio-verre.css` §10) la plaque N° est une plaquette BLANCHE à l'encre sombre, partout | contrôle périmé | le N° se LIT : contraste encre/fond ≥ 4,5 (WCAG AA) | voir l'état final |
| banc `sante-donnees` (suite) | après la fusion de main : la ligne « Ventes sans date de versement » est retirée (15 nov., Julien, 6495a5abe) | contrôle périmé | 10 choses à corriger, la ligne n'est plus attendue (les 4 ventes restent semées) | **138 verts** |
| `rangement-guide.cjs` | la feuille d'avant n'existe plus | déjà retiré avec sa raison (commit 553743e72, 16 nov. vague B : remplacé par `atelier-arrivee.cjs`) | rien à faire | — |
| banc `ventes-e2` | `page.screenshot` d'une page de 7 000 px > 30 s sous charge (scénario « gros ») — une capture, pas un contrôle | outil | délai de la capture : 2 min | voir l'état final |

## Incident : disque plein

72 copies de `src/` laissées dans /tmp par `audit-plateformes-logo --prouve` (1,8 Go, corrigé ici), puis ~60
worktrees ; le coordinateur a libéré 15 Go. ⚠️ Pendant le premier remplissage, un `pkill -f "scripts/bancs/<nom>"`
lancé pour arrêter MES bancs a pu arrêter aussi les mêmes bancs d'autres lots (même nom de fichier) : à relancer
chez eux s'ils ont vu « Target closed ».

## À trancher par Julien

- Sur ordinateur, la plaque N° d'une rangée d'Annonces ne se touche pas (la rangée ouvre la fiche en plan) et la
  fiche D n'a pas de geste « changer le N° » : le N° se change au téléphone (rangée ouverte), ou par « Son N° ».
- La feuille « ⋯ » entre avec une animation (`fd-monte`) ; sous une charge de 45+, Chromium n'en produit pas les
  images (animation en attente, opacité 0,6) : mesuré au banc, pas un défaut de l'app.

## Preuves (rouge avant / mutation)

- `bra-dist-avant` (build d'`origin/main` au départ du lot) : `stock-planches` rouge (« Retirer de la case » invisible, 30 s) ;
  `lot1415` D2 rouge (« Saisir » absent pour une paire en vente sans prix d'achat) — les autres sections de lot1415
  vertes sur ce build (les attendus refaits suivent bien l'app d'avant).
- Build MUTANT (copie de l'arbre, deux mutations) : `if (!l) continue;` retiré de `enLigneDuCompte` ⇒ `enligne` 2 rouges
  (7004 entre dans la grille, 1512 et 390) ; l'effet de retour de `FiltreSites` retiré ⇒ `vestiaire-bout-en-bout`
  8 rouges (B2, quatre onglets × deux tailles), tout le reste vert.
- `audit-politique-hotes --prouve` 12/12 ; `audit-plateformes-logo --prouve` 36/36 ; `audit-revue-fin` 37 → 38.
- `reglages-premium` : les deux « titre écrit deux fois » rouges avant (390), verts après ; capture regardée
  (« Paramètres » au-dessus de « Sécurité des données »).
- Captures regardées : fiche D du N°62 (390 clair, 1512 sombre) — « Achetée ? » en ambre, « Saisir le prix d'achat »
  souligné ; feuille « ⋯ » du Stock (1512) ; Ventes 390 sombre (plaque blanche lisible) ; tableau de bord (volet Argent).

## ÉTAT À LA REPRISE

- Branche `claude/bancs-rouges-a`, fusionnée avec `origin/main` (vraie fusion ; un conflit dans `sante-donnees.cjs`
  résolu en prenant la version de main pour G, qui juge déjà au repos ; mes changements S/attendus gardés).
- Verts ici (dernier passage, un banc à la fois) : `enligne`, `vestiaire-bout-en-bout`, `sante-donnees` (138),
  `lot1415` (96), `stock-planches`, `stock-2d`, `stock-retrouver`, `stock-juste`, `ventes-e2`, `reglages-premium`
  (**737 ✅ · 0 ❌**, après la fusion de main : « Mots expliqués » n'était recouvert que pendant la mise en page du
  groupe redessiné par « Visite des écrans » — mesuré, le point tombait sur le bouton voisin).
- Passe complète des audits (`lancer-audits`, 2 à la fois) : **66 rouges, tous rouges aussi sur `origin/main`**
  (vérifié un par un sur une copie d'`origin/main` ; un seul vert là-bas, `audit-recherche-unique`, vert ici aussi en le
  relançant seul : charge). Aucun n'est né de ce lot. La CI de main (PR #1181) a ses trois parts d'audits et ses bancs
  rouges.
- **Règle du 16 nov. (Julien) : zéro rouge pour fusionner.** Ces 66 audits rouges hérités de main (et les bancs
  rouges de la CI de main) dépassent ce lot : la PR est ouverte, **pas fusionnée**.
- À faire ensuite : au téléphone, le titre d'un panneau de Paramètres se coupe en plein mot (« Sécurit / é des /
  donnée ») quand l'état de sauvegarde (« Pas encore synchro… Réessayer ») partage sa ligne — vu sur la capture,
  hors de ce lot.
