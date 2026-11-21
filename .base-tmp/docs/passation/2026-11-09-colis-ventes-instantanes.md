# 9 nov. 2026 (soir) — Colis et Ventes tout de suite (lot AE, proposition 44)

Branche `claude/colis-ventes-instantanes` (depuis `origin/main`), poussée à chaque commit.
**Pas de PR ni de fusion** (consigne du coordinateur). Validé par Julien : Colis et Ventes
s'ouvrent comme Ma journée.

## 1. Ce que voit Julien
À l'ouverture de **Colis** ou de **Ventes**, au lieu du squelette pendant la relecture complète
(Colis ≈ 10 s au téléphone au banc), l'écran montre **en ≈ 1,5 à 2 s** ce que CET appareil a
affiché la dernière fois pour CE compte VRM : la tête de l'écran, la carte sombre des chiffres
(avec l'objectif du mois sur Ventes), et :
- **Colis** : la phrase « 2 bordereaux à imprimer — 6 j pour l'envoyer », les trois onglets et
  leur nombre (« À envoyer · 3 »), et sur « À envoyer » les colis groupés par transporteur
  (N°, titre court, montant, délai, transporteur) ;
- **Ventes** : « À venir » (montant et plateformes), les replis « Vestiaire : pas encore lu », la
  liste des ventes (plateforme, titre court, date, état, montant).

À la place de « Modifier » : **« ● Mis à jour il y a 7 min »**. Chiffres un ton plus doux, aucune
photo (une place neutre). **Tout est inerte** : Scanner, Tout imprimer, Imprimer, Déposé, Suivre,
Générer… sont remplacés par **« Vérification… »** (gris, sans bleu) ; toucher une ligne ne fait
rien. Quand la relecture est finie, l'écran vrai prend la même place (sans fondu).

## 2. Une seule règle d'instantané pour les trois écrans
- `src/instantaneEcran.js` — **la règle commune** (Ma journée, Colis, Ventes) : clé
  `vrm_<écran>_instantane:<uid>` (Ma journée garde `vrm_journee_instantane:<uid>`, rien perdu ;
  un instantané rangé avant, sans `ecran`, reste lu comme celui de Ma journée), uid ET écran
  vérifiés dans la valeur, version, âge ≤ 3 jours et pas dans le futur ; **un seul compte sur
  l'appareil** (écrire pour un uid efface les instantanés de tout autre uid, tous écrans) ;
  `effacerInstantanes` (tous écrans) ; `ageTexte` ; la relecture de la carte des chiffres
  (`capturerCarte`, `capturerCases`, `capturerObjectif` — Ma journée s'en sert aussi) et sa
  **portée** (une case du mois ⇒ montrée le même mois, sinon le même jour) ; `enLecture` (une
  valeur « lecture… » ⇒ rien n'est rangé).
- `src/journeeInstantanee.js` — ne garde que ce que Ma journée range et montre ; sa clé, sa
  lecture et son écriture délèguent à la règle commune (API inchangée).
- `src/colisVentesInstantanes.js` — ce que Colis et Ventes RANGENT (`capturerColis`,
  `capturerVentes`, liste blanche) et ce qui se montre un autre jour (`colisMontrable`,
  `ventesMontrable`).
- `src/InstantaneCommun.jsx` — le rendu commun : `useInerte` (`inert`), `useMaintenant` (l'âge
  avance), `MentionInstantane`, `CasesInstantanees`, `CarteInstantanee`, `GesteVerification`,
  `progObjectif`. `src/JourneeInstantanee.jsx` s'en sert (même rendu qu'avant).
- `src/ColisVentesInstantanes.jsx` — `ColisInstantane`, `VentesInstantanee` : les classes de
  l'écran vrai (la place ne bouge pas), attributs `data-inst-*` seulement (jamais `data-fu-case`,
  `data-carte-*`, `data-bord-card`, `data-tx-colis`, `data-toutes-id`, `data-colis-onglet-n`…) ;
  seuls quelques attributs de STYLE sans valeur sont repris (`data-ton`, `data-toutes-prix=""`,
  `data-colis-dates`, `data-colis-limite-texte`, `data-colis-lignes`). `src/styles-colis-ventes-instantanes.css`.
- `src/App.jsx` — `CaptureJournee` est devenu `CaptureInstantane` (un composant pour les trois :
  racine de l'écran vrai prêt, capture 1,2 s après que tout est là, puis 1,5 s après chaque
  changement, à `pagehide` / page cachée ; aperçu sans abonnement ⇒ tout effacé) + `CaptureColis`,
  `CaptureVentes`. AppCoeur choisit l'instantané de l'écran ouvert (`instantaneEcranIci`) :
  **Colis** seulement sur sa vue d'ouverture (ni Leboncoin ni `site:…` demandés) et si l'onglet
  rangé est celui que l'écran va montrer ; **Ventes** seulement sur « Tous ». Base injoignable,
  pas de session, sans abonnement (lecture seule) ⇒ aucun instantané. `AttenteEcran` n'a pas changé.

Rien de métier ne change : aucun calcul, aucune règle, aucun geste ; sans instantané, l'écran
s'ouvre comme avant (squelette, plafond 2,5 s).

## 3. Ce qui est rangé, champ par champ (et pourquoi)
Commun : `v`, `ecran`, `uid` (le contrôle d'appartenance), `t`, `jour`, `mois` (l'âge et ce qui
se montre un autre jour), `largeur` (l'écart mesuré n'est repris qu'à la même largeur).

La **carte** (`carte`, Colis et Ventes) : `classes` (classes `vrm-*` de la carte, pour la même
forme), `portee` (jour/mois), `surtitre` (« Aujourd'hui », « Novembre »), `grand` (texte rendu,
valeur `data-carte-valeur`, `vide`, le mot dessous), `spark` (la TAILLE de la courbe seulement,
pas ses points), `cases` (clé, valeur, texte rendu, libellé, raison « pas calculé »), `objectif`
(les nombres de la barre). Des compteurs et montants de VRM : rien de personnel.

**Colis** :
| champ | pourquoi |
|---|---|
| `onglet` | l'onglet montré : l'instantané ne se montre que si l'écran va ouvrir le même |
| `sites` | les plateformes du filtre (`toutes`, `vinted`…) : la même rangée au téléphone |
| `phrase` | la phrase de l'écran (texte de VRM) |
| `prochain` `{cle, texte, sous}` | « 2 bordereaux à imprimer — 6 j pour l'envoyer · le plus pressé d'abord » : compteurs et délai de VRM ; montré le même jour seulement |
| `onglets` `[{cle, l, n, urgent}]` | « À envoyer · 3 », « Envoyés · 0 », « À retirer · 0 » : des nombres |
| `liste` (« À envoyer » SEULEMENT, 30 au plus) — groupe `{g, n}` | le nom du transporteur et « 2 colis » |
| — colis `{num, titre, prix, limite, attente, transp, groupe}` | le **N°** (ce qu'il cherche sur le carton), le **titre court** (60 car., ce que voit la ligne), le **montant**, le **délai** rendu (le même jour seulement), le **transporteur** (son nom, pas le suivi), prêt / en attente |
| `ecart` | la hauteur entre les onglets et la liste (outils, tournée : des gestes, jamais rangés) |

**Ventes** :
| champ | pourquoi |
|---|---|
| `sites`, `phrase` | comme Colis |
| `aVenir` `{titre, lignes, total}` | « À venir », « Vinted · 3 ventes » (le **nom du compte est retiré** : `.vrm-sensible`), « 185 € » |
| `replis` | « Vestiaire : pas encore lu » (texte de VRM) |
| `lignes` (30 au plus) `{site, siteNom, num, titre, date, etat, ton, prix}` | plateforme, N° s'il est montré, titre court, date rendue (« hier », le même jour seulement), état (« À envoyer ») et son ton, montant |
| `n` | le nombre de ventes de la liste |

**JAMAIS rangé** : nom ou pseudo d'acheteur, adresse, point relais, n° de suivi (ni lien de
suivi), code de retrait (ils ont leur mécanisme hors ligne : `src/journeeHorsLigne.js`,
`src/bordereauxHorsLigne.js` — non doublé), photo, lien, n° de transaction ou de conversation,
nom du compte Vinted. Les onglets **« Envoyés » et « À retirer » ne rangent aucune liste** (ils
portent suivis, points relais, codes) : leurs nombres seulement ; leur liste est une place en
attente. Taille : ~1,4 Ko (Ventes, 3 ventes) à ~2 Ko (Colis, 3 colis).

Mêmes garde-fous que Ma journée : clé par uid + uid vérifié dans la valeur ; effacé à la
déconnexion et au changement de vendeur (`wipeLocalData`, clé `vrm_*`) et par l'écriture d'un
autre uid ; jamais dans le nuage (`localStorage.setItem` hors de `save`, absente des clés
synchronisées) ; sans abonnement ⇒ rien montré, et ce qui était rangé part ; plus de 3 jours ⇒ rien.

## 4. Preuves
**Banc `scripts/bancs/colis-ventes-instantanes.cjs`** (Colis et Ventes ; 390 tactile clair et
sombre, 1512 clair et sombre). Il sert la forme de production et **TIENT** les lectures (requêtes
gardées puis rendues, jamais un délai, §6.5). Données inventées, avec une acheteuse, une adresse
et des n° de suivi servis pour vérifier qu'ils ne sont jamais rangés. Contrôles : A (rangé pour CE
uid et CET écran, carte/onglets/liste/montants = l'écran vrai, **la valeur rangée relue : rien de
personnel**), I (chiffres en < 4 s base tenue, « Mis à jour il y a 7 min », mêmes valeurs que
l'écran vrai, aucun chiffre frais visible, écran de démarrage parti, inerte — aucun bouton actif,
aucun lien, aucune image —, chaque geste « Vérification… » et aucun bouton Imprimer/Déposé/Scanner/
Suivre, toucher ne fait rien, remplacement par l'écran vrai, CLS au remplacement ≤ 0,01, aucun
débordement), U (autre uid jamais rendu), V (autre vendeur ⇒ tout effacé), S (sans instantané :
le squelette d'avant).

**Résultat sur cette branche : 193 verts, 0 rouge** (4 passes × 2 écrans).

- **Sur `origin/main`** (dist construit depuis `origin/main`, avant tout changement, passe 390
  clair) : **35 rouges** (aucun instantané rangé, aucun chiffre en 12 s base tenue, ni mention,
  ni inertie à juger ; et sur Colis un CLS de 0,055 à l'ouverture au plafond).
- **Mutations** (390 clair), chacune ROUGE, remise en place après : uid non vérifié dans la
  valeur ⇒ U rouge ; geste « Imprimer » au lieu de « Vérification… » ⇒ I rouge ; nom du compte
  rangé dans « À venir » ⇒ A rouge (`compte_banc`) ; `inert` retiré ⇒ I rouge (5 boutons actifs) ;
  âge retiré de la mention ⇒ I rouge ; n° de suivi rangé avec un colis ⇒ A rouge (`ZZ9102`).
- Bancs relancés sur cette branche, un à la fois : `journee-instantanee` 111/0 (Ma journée sur la
  règle commune, inchangée), `colis-retirer-propre` 129/0, `scanner-colis-achats` 204/0,
  `ventes-colis-premium` 32/0, `journee-v2` 0 rouge.
- Audits verts : `variables`, `tdz`, `coherence`, `identite`, `statuts`, `icones`. `npm run build` vert.
- Captures regardées (390 et 1512, clair et sombre) : instantané et écran vrai superposables (tête,
  carte, onglets, groupes et lignes au même endroit, à quelques px près) ; différences voulues :
  aucune photo (place neutre), « Vérification… » à la place des gestes, à l'ordinateur pas de
  bouton par colis (un « Vérification… » à droite).

### Temps mesurés (banc, conteneur partagé, `performance.now()` depuis la navigation)
| | avant (`origin/main`) | après |
|---|---|---|
| chiffres de **Colis**, lectures TENUES (2e ouverture) | **jamais** (squelette puis plafond, 12 s) | **1,5 à 2,3 s** (1,49 · 1,49 · 1,99 · 2,28 ; 1,57 · 2,23 sur des passes isolées) |
| chiffres de **Ventes**, lectures TENUES (2e ouverture) | **jamais** (12 s) | **1,5 à 2,2 s** (1,45 · 1,62 · 1,72 · 1,78 · 2,17 · 2,22) |
| écran vrai, base servie (1re ouverture, sans instantané) | Colis 10,1–11,3 s · Ventes 1,5–3,0 s | inchangé (rien ne change sans instantané) |
| CLS au remplacement | Colis 0,055 (ouverture au plafond) | **0,000 à 0,008** |


`scripts/tests/colis-ventes-instantanes.test.mjs` : 6/6 (clé par écran et uid, uid dans la
valeur, écran dans la valeur, ancienne clé de Ma journée, un seul compte tous écrans, effacement,
trop vieux/futur/illisible/version, Colis et Ventes un autre jour / un autre mois).
`scripts/tests/journee-instantanee.test.mjs` 6/6 (inchangé, sur la règle commune).

## 5. Ce qui reste
- L'instantané n'existe qu'après une première ouverture COMPLÈTE de l'écran sur l'appareil.
- Colis : la liste n'est rangée que pour « À envoyer » ; sur « Envoyés » / « À retirer », les
  nombres et une place en attente (voulu : suivis, points relais, codes).
- Ventes : seulement sur « Tous » (un filtre Vinted/Leboncoin… s'ouvre comme avant).
- À l'ordinateur, la rangée des sites vit dans la barre du haut : celle de l'écran vrai (monté,
  caché) y est déjà ; l'instantané n'en pose pas.
- `claude/direction-artistique-6` refait le style : l'instantané reprend les classes de l'écran
  vrai, il suivra ; les styles en ligne des cartes de colis et des ventes sont recopiés en jetons
  (`styles-colis-ventes-instantanes.css`) — à regarder si la DA les change.

## 6. Geste de Julien
Aucun. (Pour voir : ouvrir Colis puis Ventes une fois jusqu'au bout, puis rouvrir VRM.)
