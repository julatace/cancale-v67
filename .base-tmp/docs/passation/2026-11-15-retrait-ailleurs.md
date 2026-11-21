# 15 nov. — « À retirer ailleurs » : vendue sur un site ⇒ retirée des autres, accompagnée

Demande de Julien : « je veux que le retrait d'une paire qui est vendue sur Vinted, le retrait
sur Leboncoin soit hyper intuitif, qu'il soit accompagné par l'application et vraiment beaucoup
mieux que maintenant, là c'est vraiment pas ouf ».

Branche `claude/retrait-ailleurs` (partie d'`origin/main` ea152a4b). **Aucune modification de
l'extension** (aucune version neuve, aucun zip régénéré) : tout passe par les voies qui existent
(`lbcSupprime` 5.291+, route eBay `retirer`, retrait automatique eBay). Aucune écriture en base
réelle, aucune PR.

## 1. Mesuré d'abord (le parcours d'avant)

Rejoué au banc `retirer-ailleurs` (390 px tactile, jeu inventé : N°42 vendue sur Vinted, encore
en ligne sur Leboncoin et eBay), captures regardées :

- **Trois entrées pour la même paire** sur Ma journée : en tête « 1 annonce à retirer de
  Leboncoin · Supprimer » et « 1 annonce à retirer d'eBay › » (alertes de la coque, ancienne
  règle), et, SOUS le chiffre du jour et la grille, dans « À faire », « N°42 vendu sur Vinted ·
  Retirer des autres sites ». Il ne savait pas laquelle toucher.
- **Touchers** (Leboncoin + eBay) : faire défiler jusqu'à « À faire », « Retirer des autres
  sites » (1), « Oui, retirer » (2), la feuille plein écran « VRM travaille » → « Fermer » (3), la
  feuille « Vendus ailleurs » → « OK » / × (4). Vestiaire : **aucun moyen de dire « c'est fait »** —
  la ligne restait.
- **La feuille « VRM travaille » disait « Colis noté retiré · Ensuite : le ranger dans ton
  stock »** : la sorte `retirer-ailleurs` était branchée sur le geste `colis.retire` (retrait d'un
  COLIS au point relais). Faux message.
- **Deux feuilles empilées** (« VRM travaille » + « Vendus ailleurs »), et sous le résultat « Aucune
  correspondance à retirer dans les données récupérées » (contradictoire).
- **Sans extension** : « à faire sur Leboncoin — ici, pas d'extension VRM (ouvre VRM dans Chrome…) »
  écrasé dans une colonne de 120 px (un mot par ligne), lien vers « Mes annonces » seulement.
- **Pas d'onglet leboncoin.fr connecté** : l'extension renvoyait « ouvre leboncoin.fr… puis
  réessaie » ; l'app le disait en échec, et il fallait tout recommencer (confirmation comprise).
- Aucun logo de site, pas de plaque N°.

**Base de prod** : la lecture (SQL, lecture seule) a été **refusée** par l'outil (permission non
accordée) : le nombre de paires vendues sur Vinted encore en ligne ailleurs aujourd'hui **n'est
pas mesuré**. À faire avec son accord : compter les lignes de `lbc_a_retirer` (publiée par l'app)
et, par identité, les `ebay_listings` actifs dont le SKU `VRM-{n°}` est vendu.

## 2. Le nouveau parcours

**UN endroit : « À retirer ailleurs »**, EN TÊTE de Ma journée (au-dessus du chiffre du jour)
dès qu'une paire vendue est encore en ligne ailleurs ; le même bloc en tête de Ventes, dans la
feuille « Vendus ailleurs », et dans la **fiche de la paire** (son N° seulement).

Chaque paire : plaque N°, vignette, titre, « Vendue sur Vinted ». Puis, pour chaque site où elle
est encore en ligne (identité seulement : réf. VRM / lien posé, SKU `VRM-{n°}`, id d'annonce —
le plan existant `planRetirerAilleurs`) : la **marque du site** (`src/plateformes/Marque.jsx`), le
compte, UNE phrase d'état et **UN geste** :

| site | geste | ce qui se passe |
|---|---|---|
| Leboncoin (extension à jour ici) | « Retirer de Leboncoin » | la confirmation existante (une fois), puis `lbcSupprime` par l'extension, au nom du compte de l'onglet (50/h, une à la fois, pause 429/403 — garde-fous de l'extension, intouchés) |
| Leboncoin, pas d'onglet connecté | « Ouvrir leboncoin.fr ↗ » | « Ouvre leboncoin.fr connecté sur X : VRM reprend tout seul quand tu reviens ici » ; reprise SEULE (sans redemander) quand l'onglet VRM redevient visible ou que l'extension vient de lire leboncoin.fr (`maj · lbc`) ; au plus une reprise / 15 s, 6 en tout |
| Leboncoin sans extension (iPhone sans extension…) | l'annonce ↗ + « C'est retiré » | sa parole, notée (`vrm_retraits_main`, synchronisé), démentie par la prochaine lecture complète qui la voit encore |
| eBay | « Retirer d'eBay » | la confirmation existante, route `retirer` (jamais `auto`), puis relecture eBay ⇒ « Retirée · relue » |
| eBay, retrait automatique ALLUMÉ | « Retirer maintenant » | « Le retrait automatique d'eBay s'en charge au prochain passage » ; déjà demandé ⇒ « l'a demandé à eBay », rien à refaire (jamais doublé : `__retraitEbayAutoTentes`) |
| Vestiaire | l'annonce ↗ + « C'est retiré » | aucune voie de retrait chez Vestiaire |
| Vinted (vendue ailleurs) | l'annonce ↗ + « C'est retiré » | §3 : VRM ne supprime JAMAIS une annonce Vinted |

**Plusieurs à la fois** : « Tout retirer (N) » (N = gestes automatiques), UNE confirmation, puis un
par un, la progression dite (`accompagner('annonce.retirer')` : « 1 / 2 », « Tout arrêter ») ; un
site qui refuse arrête CE site, les autres continuent.

**Accompagnement** : avant (« Une annonce à la fois, sur le site où elle est encore en ligne. La
paire garde son N°, rien ne bouge là où elle est vendue. »), pendant, après (« 1 annonce
retirée »), échec (la raison, le geste). Chaque geste est archivé dans « Ce que VRM a fait »
(travail suivi, archivé sans figer l'écran). Aucun « Annuler 5 s », aucune confirmation neuve.

**Après** : « Retirée · Leboncoin a dit oui. La prochaine lecture le confirmera. » puis « Retirée ·
relue : elle n'est plus en ligne. » (même preuve qu'avant : une lecture COMPLÈTE du site faite
APRÈS) ; « Pas de réponse claire : regarde l'annonce avant de recommencer » (jamais un second envoi
à l'aveugle) ; refus ⇒ « Réessayer ». Le résultat reste sur la ligne même quand la relecture fait
sortir l'annonce du plan (`fusionPlan`).

**« Peut-être vendue »** : une commande Vinted SANS état (titre de statut vide — §5 « Vendue se
PROUVE ») n'est plus comptée comme vente prouvée (`chargerRetraitsMulti` : `engagee: null`). La
paire est DITE « Peut-être vendue sur Vinted », chaque site « À vérifier : la commande n'a pas encore
d'état chez Vinted, la vente n'est pas prouvée. VRM ne retire rien tant qu'elle n'est pas sûre. » —
aucun geste de retrait, hors de « Tout retirer ».

**UN endroit, vraiment** : les alertes de la coque « N à retirer de Leboncoin / d'eBay / de
Vestiaire / de Vinted » ne sont plus redites quand CHAQUE N° qu'elles nomment est déjà dans le
bloc pour ce site (`alerteCouverte`) ; un N° absent du bloc ⇒ l'alerte reste (rien ne disparaît en
silence). La carte « N annonces vendues ailleurs » de « À faire » ne reste que si le bloc n'a rien
à montrer (vérification qui n'a pas abouti).

**Notification** : la notification de double vente existante (e-mail de vente Vinted / Vestiaire,
`api/_lib/double-vente.js`) dit maintenant « ⚠️ N°124 vendue sur Vinted · à retirer de Leboncoin »
(sur le téléphone : titre « N°124 vendue sur Vinted », corps « À retirer de Leboncoin · l'article »)
et ouvre `/?tab=journee&cible=ailleurs&num=124` : Ma journée, la paire éclairée dans le bloc
(nouvelle cible `ailleurs`, `src/cibleNotif.js`).

## 3. Touchers, avant / après (banc, N°42 : Leboncoin + eBay [+ Vestiaire])

| | avant | après |
|---|---|---|
| Leboncoin + eBay | défiler + 4 touchers, 2 feuilles, un faux « colis retiré » | « Tout retirer (2) » + « Oui, retirer » = **2**, sans quitter Ma journée |
| un site à la fois | — | « Retirer de … » + « Oui, retirer » = **2** |
| Vestiaire / Vinted / sans extension | impossible de dire « c'est fait » | « C'est retiré » = **1** |
| pas d'onglet leboncoin.fr | échec, tout recommencer (confirmation comprise) | ouvrir leboncoin.fr ; VRM reprend seul, **0** toucher de plus dans VRM |

## 4. Fichiers

- `src/aRetirerAilleurs.js` (règle pure) : états et gestes par site, marques « C'est retiré »,
  reprise bornée, alertes couvertes, `fusionPlan`.
- `src/ARetirerAilleurs.jsx` + `src/a-retirer-ailleurs.css` (Studio : porcelaine, plaque, marques,
  `sb-touche` / `sb-lien`, 44 px) ; textes `src/i18n/langues/*/retraitAilleurs.js` (5 langues).
- `src/retirerAilleurs.js` : codes de raison (traduits), vente douteuse ⇒ `verifier`.
- `src/App.jsx` : magasin de module `RA` (`gesteRA`, `toutRetirerRA`, `marquerRA`, `reprendreRA`,
  `BlocARetirerAilleurs`), Comptabilite publie le plan, Ma journée le pose en tête, la fiche aussi ;
  `retrait` sur les alertes de la coque ; `vrm_retraits_main` synchronisé.
- `src/accompagnement.js` : geste `annonce.retirer` (sorte `retirer-annonces`).
- `api/_lib/double-vente.js`, `api/_lib/lien-notif.js` (`retirerAilleurs`), `src/cibleNotif.js`
  (`ailleurs`) ; audits mis à jour : `audit-double-vente-ailleurs`, `audit-flux-divers`,
  `audit-vestiaire-partout`, `audit-retirer-ailleurs` (section I), banc `double-vente-push`.
- `src/nouveautes.js` : « Vendue ? Retire-la ailleurs en un toucher ».

## 5. Preuves

- `node scripts/audit-a-retirer-ailleurs.cjs` : **41/41** ; `--prouve` **15/15** mutations rouges
  (vente douteuse traitée comme sûre, ou tue ; geste sur « à vérifier » ; relance après « pas de
  réponse » ; reprise sans borne / en rafale ; marque jamais démentie ; alerte tue par un seul N° ou
  pour un autre site ; site inventé ; retrait auto eBay ignoré ; ancienne adresse de notification ;
  commande sans état comptée prouvée ; reprise qui redemande ; alertes tues sans règle). Sur
  `origin/main` : le module est absent ⇒ rouge. 50 paires identiques : seule la N°7 vendue.
- `node scripts/audit-retirer-ailleurs.cjs` 41/41, `--prouve` 18/18 (section I réécrite pour les
  nouveaux gestes).
- Banc `scripts/bancs/a-retirer-ailleurs.cjs` (harnais `nouveau-vendeur`, extension et route eBay
  simulées) : 5 scénarios × 390 tactile / 1512 × clair / sombre ; mesure par `data-*`, compte les
  touchers, contraste des liens. L'ancien banc `retirer-ailleurs.cjs` lance désormais celui-ci.
  **Vert sur le build de la branche : 260 contrôles, 0 rouge** (plein 76, série 56, onglet 44,
  sans extension 40, vente douteuse 44 ; un scénario par processus — la machine du banc était à
  une charge de 37, un Chromium plantait sous la charge). Touchers comptés : 5 (plein, 3 sites),
  2 (série), 2 (onglet, reprise comprise). **Rouge sur le build d'`ea152a4b`** (code d'avant, arbre
  tiré par `git archive`) : « À retirer ailleurs » absent, la coque redit « à retirer de … ».
  Captures regardées (390 / 1512, clair / sombre : journée, confirmation, après, série pendant,
  onglet, reprise, sans extension, vente douteuse).
- Audits verts : traduction, tdz, variables, studio (fichier ajouté aux migrés), identite,
  coherence, extension-zip, fonctions-api, csp, quoi-de-neuf, double-vente-ailleurs, cibles-notif,
  icones, preuve-vente, notifs-belles, notifs-centre, vestiaire-partout. `textes-courts` : 1 rouge
  préexistant dans `src/ecrans/Ebay.jsx` (pas touché ici).
- Bancs voisins (build de la branche) : `studio-journee` vert, `lbc-supprimer` vert,
  `double-vente-push` 34/34, `accompagnement` vert (30 moments), `journee-coherence` vert sur E1-E11
  (E2 réécrit : le bloc en tête remplace la carte « Vendus ailleurs » ; un « Modifier » hors d'une
  carte faisait mourir le banc — gardé). `double-vente` : **déjà rouge sur `ea152a4b`** (28 rouges,
  écran Leboncoin) ; avec la branche, sa ligne « Ma journée annonce les mêmes 2 articles » passe de
  « 1 » à « absent » parce que l'alerte « à retirer de Vinted » est désormais dite dans « À retirer
  ailleurs » (voulu) — banc à reprendre par le chantier qui le répare.
- Après fusion d'`origin/main` (70 commits) : 17 audits verts, banc (plein, onglet, douteuse) vert.
- **Vu et corrigé au banc** : une boucle de rendu (la publication du plan dépendait d'un objet neuf
  à chaque rendu — page figée) ; le lien « Ouvrir Vestiaire » illisible en clair ; les alertes de la
  coque revenues après les retraits (couverture calculée sur le plan + ce qu'il a touché).

## 6. Ce qui reste / non mesuré

- Le nombre réel de paires concernées en base (lecture refusée, §1).
- La relecture Leboncoin « relue » dépend toujours d'une lecture complète de « Mes annonces » par
  l'extension (l'écran se relit quand elle arrive : `maj · lbc`).
- Pas de lecteur d'e-mail de vente Leboncoin / eBay (aucune forme reçue) : la notification ne part
  que pour une vente Vinted ou Vestiaire apprise par e-mail.

## Geste de Julien

Aucun. (Sur l'iPhone sans extension, Leboncoin se retire à la main puis « C'est retiré » ; sur
l'ordinateur avec l'extension, « Retirer de Leboncoin ».)
