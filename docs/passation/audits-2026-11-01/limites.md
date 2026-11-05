# VRM — audit « conditions difficiles » (1er novembre 2026)

Base : `origin/main` à `f04af748` (merge #940), branche locale `audit-limites`, **rien corrigé, rien commité**.
Build : `npm run build` OK (App 3,16 Mo minifié / 959 Ko gzip). Copie servie : `scratchpad/dist-main`.

Bancs jetables écrits pour cet audit (tous dans
`/tmp/claude-0/-home-user-cancale-v67/f70a9764-046d-5574-bac2-0a1794911434/scratchpad/bancs/`, base PostgREST
**à état** à la vraie forme — `_base-volume.cjs` du dépôt : projection `select=`, `meta->>`, `like.`/`in.`/`or=`,
pagination `Range` et **plafond silencieux de 1 000 lignes** — + porte de banc `_porte-banc.cjs`) :

| banc | ce qu'il joue |
|---|---|
| `_h.cjs` | harnais : sert `dist`, base à état (lectures ET écritures gardées), pannes injectables par URL/méthode |
| `s1-reseau.cjs`, `s1b-blanc.cjs`, `s1c-ecritures.cjs` | base lente 5 s / 30 s, 429, 401, 522, 500 sur UNE famille (annonces, commandes, transactions) ; ce qui s'affiche à 2,5 / 7 / 14 s ; ce qui est ÉCRIT pendant la panne |
| `s2-volume.cjs` | 3 000 ventes, 2 000 annonces, 1 300 transactions, 1 105 bordereaux email, 1 200 `email_sale_*` ; téléphone processeur ×4 |
| `s3-deux-appareils.cjs` | deux navigateurs sur la même base, chacun change UNE clé différente |
| `s4-bizarre.cjs`, `ctx.cjs` | titres 200 car. + emoji, prix 0 / −15 / null / « 45 » / `{amount:'abc'}` / 1e9 / GBP, dates invalides et 23 h 30 UTC, sans photo, annulée, remboursée, N° B125 / « b 0125 » / 7 / 007 — × 8 écrans (375, 390, 390 sombre, 412, iPad 820 tactile, 1280×650, 2560×1440, 1512 zoom 0,65) × 10 onglets |
| `s5-horsligne.cjs`, `s5b-coupure.cjs`, `s5c-ecriture-ko.cjs` | coupure réseau pendant une saisie ; écriture refusée (503) puis app refermée/rouverte |
| `s6-nav.cjs` | barre du bas / dernier contenu à 320 et 375 px |

Captures : `scratchpad/bancs/out-s1/`, `out-s2/`, `out-s4/`. Journaux : `out-s1.log`, `out-s2.log`, `out-s4.log`,
`out-s1/res.json`, `out-s2/res.json`, `out-s4/res.json`.

Légende : **vérifié** = reproduit au banc (ou à la lecture exacte du code quand c'est dit) · **à vérifier** = déduit
du code, pas joué (pas de WebKit/Firefox dans ce conteneur : seul Chromium est installé dans `/opt/pw-browsers`).

---

## A. Les 10 plus graves

### 1. GRAVE (bloquant pour qui a deux appareils) — Deux appareils : le dernier qui enregistre efface les saisies de l'autre — **vérifié**
- **Scénario** : iPhone ouvert le matin (PWA restée en fond). Sur le Mac il saisit un prix d'achat / coche des colis / déclare son mois URSSAF / pose son prénom. Plus tard il touche n'importe quel réglage synchronisé sur l'iPhone (mode sombre…).
- **Preuve** (`s3-deux-appareils.cjs`) : A écrit `vrm_prenom="Julien"` (base = Julien) ; B, chargé avant, bascule le mode sombre → B renvoie la ligne `main` ENTIÈRE avec `vrm_prenom=""` → base = `""` ; A rechargé : prénom perdu. Écritures : `B clés=12 prenom="" | A … prenom="Julien" | B clés=12 prenom=""`.
- **Où** : `src/App.jsx:2540-2554` (`cloudPush` : `SYNC_KEYS.forEach(localStorage…)` puis upsert de toute la ligne `main`) ; le nuage n'est lu qu'au démarrage (`src/App.jsx:61302-61306`, seuls appels à `cloudLoad`). Aucune comparaison de `data.rev` sur `main` (seuls les numéros sont gardés par la 013/017).
- **Touché** : toutes les `SYNC_KEYS` (`src/App.jsx:1878+`) : `vinted_buyprice_by_num` (prix d'achat), `vinted_ship_done`/`vrm_colis_collected` (colis faits/retirés), `vrm_urssaf_declare`, `vrm_ebay_liens`, `vrm_lbc_liens`, `vinted_sale_overrides`…
- **Correction** : envoyer la DIFFÉRENCE par clé (ou relire `main` et fusionner clé par clé juste avant l'upsert, comparer-et-échanger sur `data.rev` comme `modifierDonnee`), et relire le nuage au retour au premier plan.

### 2. GRAVE — Deux onglets du même navigateur : un prix d'achat saisi dans l'un est effacé par l'autre — **vérifié à la lecture** (banc à écrire)
- **Scénario** : Annonces ouvert dans deux onglets ; prix du N°5 saisi dans l'onglet 1, prix du N°6 dans l'onglet 2 → le N°5 disparaît.
- **Où** : `src/App.jsx:38220` (`buyByNum` lu une fois au montage), `39057`, `49625` (`setBuyByNum(prev => save('vinted_buyprice_by_num', {...prev, …}))` : `prev` = l'état de CET onglet). Aucun écouteur `storage` pour cette clé (seule la session en a un, `2604`).
- **Correction** : relire `load('vinted_buyprice_by_num')` au moment d'écrire (fusion par N°) et écouter l'évènement `storage` ; même traitement pour les autres cartes écrites depuis un état React.

### 3. GRAVE — Base lente : Colis dit « Aucun colis à envoyer » et Ma journée « Lie un compte Vinted » pendant le chargement — **vérifié**
- **Scénario** : réseau 4G médiocre / Supabase qui traîne (chaque lecture 5 s ou 30 s).
- **Preuve** (`s1b-blanc.cjs`, `out-s1/blanc-cat_bord-30000-10000.png`) : à 1,5 s, 4 s, 10 s et 25 s Colis affiche les 4 colonnes à **0** « Rien pour l'instant » et « **Aucun colis à envoyer.** Dès que Vinted te demande un envoi, l'article apparaît ici » — la vraie base en a **20** (vus à 14 s quand la base répond en 5 s). Ma journée affiche « Lie un compte Vinted (Paramètres → Comptes liés) pour remplir ta journée » à un vendeur qui en a 2, tant que `vinted_accounts` n'a pas répondu (`out-s1/lent30-journee.png`).
- **Où** : `src/App.jsx:51500-51518` (`!sales.loading && !sales.error` : les ventes ne sont pas « en cours » tant que la liste des comptes n'est pas arrivée — 0 compte = 0 vente) ; `src/App.jsx:47645` (`accounts.length===0 && !baseKO` sans `accountsLoaded`, qui existe pourtant, `61028`). Les colonnes : `src/ColisColonnes.jsx:57` (« Rien pour l'instant. »).
- **Correction** : tant que `accountsLoaded` est faux, toute liste dérivée des comptes est « en cours » (squelette ou « lecture… »), jamais « aucun ».

### 4. GRAVE — Plus de 1 000 bordereaux email : les plus RÉCENTS disparaissent de Colis, « Tout générer » proposé — **vérifié**
- **Scénario** : vendeur actif (3 000 ventes) ; les lignes `email_bord_*` ne sont jamais purgées (aucune purge dans `api/email-inbound.js`).
- **Preuve** (`s2-volume.cjs`, `out-s2/gros-cat_bord.png`) : 1 105 bordereaux en base dont les 5 des ventes à expédier (n° de transaction les plus hauts). Petit volume : `prets=5`. Gros volume : `prets=0, attente=5`, chaque carte « bordereau pas encore là », bouton **« Tout générer (5) »**. Ma journée perd la ligne « Emballer… bordereaux prêts ».
- **Où** : `src/App.jsx:3747` (`fetch(...id=like.email_bord_*...)` sans `Range` : PostgREST coupe à 1 000 lignes triées par id, `email_bord_{tx}` ⇒ ce sont les plus récentes qui tombent).
- **Même défaut, même cause (lecture exacte du code)** : `email_track_*` `src/App.jsx:4093` (suivis transporteur, et en `select=id,data`), `email_sale_*` `4375` (`select=data`, ids en hachage ⇒ un tiers au hasard disparaît au-delà de 1 000), `email_achat_*` `4357` (reçus), `email_invoice_*` `4285`, `harvest_{uid}_label_*` `5200`, purge d'un compte `2763/2799/2848`.
- **Correction** : passer ces lectures par `lireTout(…, { strict: true })` (déjà là, `src/App.jsx:3515`).

### 5. GRAVE (rare mais irréversible) — Supprimer un compte Vinted peut vider les données d'un AUTRE compte du vendeur — **vérifié à la lecture**
- **Scénario** : deux comptes dont l'un a un identifiant préfixe de l'autre (ex. `35` et `352…`, ou `12345678` et `123456789`). Il supprime le premier depuis Comptes liés.
- **Où** : `src/App.jsx:2763-2770` (`deleteVintedAccount`) : `or=(id.like.harvest_${uid}_*,…)` — dans `LIKE`, `_` est un joker, donc `harvest_35_*` attrape `harvest_352_listings` — puis upsert `{supprime:true}` sur TOUTES les lignes rendues, **sans** la garde de préfixe exact que portent les deux voisines (`2802` et `familiesDeCompte` `2832`, commentaire « pas de 35→352 »). Et sans pagination : au-delà de 1 000 lignes la purge s'arrête (données personnelles restantes, RGPD) ; `purgerComptesSupprimes` (`2799`) relit à chaque démarrage les MÊMES 1 000 premières lignes, déjà purgées, et n'atteint jamais la suite.
- **Correction** : filtrer en JS par `startsWith('harvest_'+uid+'_')` comme `2802`, échapper `_` (`\_`) dans le motif, et paginer.

### 6. GRAVE (téléphone) — 2 000 annonces : l'écran Annonces gèle le téléphone — **vérifié**
- **Preuve** (`s2-volume.cjs`, 390 px, processeur ×4) : 200 annonces ⇒ 21 775 nœuds DOM, 8,6 s de tâches ; **2 000 annonces ⇒ 215 964 nœuds, 27,6 s de tâches sur 20 s, 14,2 s de script, 518 ms de latence d'une image** encore à 20 s. (Ventes avec 3 000 ventes reste léger : 1 698 nœuds, pagination « Voir plus ».)
- **Où** : liste des annonces Vinted rendue en entier (aucun `content-visibility`, `IntersectionObserver` ni plafond « Voir les N autres » dans `src/App.jsx` ; cf. `ColisColonnes.jsx` qui, lui, a un `PLAFOND`).
- **Correction** : rendre 60 fiches puis « Voir plus » (comme Ventes) ou `content-visibility:auto` sur les fiches.

### 7. GRAVE — Une coupure réseau de 3 s remplace l'écran ouvert et efface la saisie en cours — **vérifié**
- **Scénario** : métro, ascenseur, bascule Wi-Fi → 4G pendant qu'il écrit une réponse à un acheteur, une note, une recherche.
- **Preuve** (`s5b-coupure.cjs`) : texte tapé dans un champ de Paramètres ; `offline` 3 s ⇒ l'écran devient « Ma journée — Hors ligne… » ; réseau revenu ⇒ on revient sur Paramètres, **le champ est vide**.
- **Où** : `src/App.jsx:62942` (`{horsLigne ? <JourneeHorsLigne/> : (<> …tous les écrans…)}` : TOUT est démonté sur l'évènement `offline`) ; `useHorsLigne` `16073`. La réponse à un acheteur Vinted (`replyText`, `src/App.jsx:40360`, `useState` simple) est perdue de même ; seuls les brouillons eBay survivent (`src/brouillonsMessages.js`, sessionStorage). Si la base a échoué pendant la coupure, `61042` fait en plus `location.reload()`.
- **Correction** : garder les écrans montés et poser un bandeau « hors ligne » par-dessus (gestes grisés), ou n'afficher la photo hors ligne qu'à l'OUVERTURE sans réseau.

### 8. GRAVE — Panne d'une seule lecture ⇒ le widget iPhone publie « 0 en ligne » — **vérifié**
- **Preuve** (`s1c-ecritures.cjs`) : lecture des annonces en 500 ⇒ l'app écrit `widget_stats {"online":0,…}` (marche normale : `"online":24`).
- **Où** : `src/App.jsx:61834` (`online: annAConfirmer.length ? null : online` — un échec de lecture n'est ni « à confirmer » ni `null`) ; garde du vendu juste dessous (`61945`) mais pas de garde « annonces lues ».
- **Correction** : `online: null` (et ne pas écrire) quand une lecture d'annonces a échoué.

### 9. GRAVE (appareils anciens) — iPhone sous iOS 15 / Safari < 16.4 : l'app ne démarre plus — **à vérifier sur un vrai appareil**
- **Où** : regex à « lookbehind » dans le paquet principal : `src/agentEbay.js:301` (`/(?<!\d)[,.;!?:]|…/`) et `src/Tournee.jsx:65` (`/(?<= [·:]) /u`) ; `vite.config.js` cible `es2020` sans transpilation des regex. Safari < 16.4 lève une `SyntaxError` à l'analyse ⇒ tout `App-*.js` refuse de charger ⇒ « L'application n'a pas pu démarrer » (`src/main.jsx:120`) à chaque ouverture. iPhone 6s/7/SE 1 restent en iOS 15.
- **Correction** : remplacer ces deux regex par des équivalents sans lookbehind (ou les construire via `new RegExp` dans un `try`).

### 10. GÊNANT→GRAVE — Lectures refusées (429/401) : Ma journée affiche des ZÉROS et un faux diagnostic — **vérifié**
- **429** (`out-s1/429-journee.png`) : « Vendu en novembre — ventes pas lues — ce n'est pas zéro », mais juste dessous « Cette semaine » trace **0 0 0 0 0 0 0** et les cases disent « 0 Messages », « 0 Prix à baisser ». `src/App.jsx:47385` (`W.semaine` rendu sans regarder si les ventes ont été lues) ; tuile Messages `47152` (`convs.items` vaut `[]` sur échec, pas `null`).
- **401 (session refusée)** (`out-s1/401-*.png`) : « Je n'arrive pas à joindre tes données… Vérifie ta connexion, puis recharge la page » — c'est la SESSION, pas le réseau. Le renouvellement périodique ignore le refus (`src/App.jsx:1787` : `authRefresh()` rendu `false` jamais traité ; seul `authBoot` `1707` déconnecte, et seulement si le jeton local est expiré). Jeton révoqué (mot de passe changé ailleurs, compte supprimé) : « Recharger » ne change rien pendant jusqu'à 1 h.
- **Correction** : semaine en « — » quand `ventesKO`/ventes non lues ; `convs.items=null` sur échec ; sur `authRefresh()===false` ou 401 répétés, proposer « Reconnecte-toi » au lieu de la panne réseau.

---

## B. Les autres défauts

| # | gravité | défaut | scénario / preuve | où | correction proposée | statut |
|---|---|---|---|---|---|---|
| 11 | gênant | Écran **blanc** 6 s sur un appareil neuf quand la base traîne | `s1b-blanc.cjs` : aucun mémo `schema_cloisonne` ⇒ page blanche à 1,5 et 4 s (`out-s1/blanc-30000-4000.png`), app à ~6,8 s | `src/App.jsx:1696` (`Promise.race([detectSchema(), 6000])`) ; `sondeSchema` `866` sans délai propre | rendre la coque tout de suite (squelette), sonde en fond | vérifié |
| 12 | gênant | Libellés des 4 cases de Ma journée coupés à 390 px : « À envoy… », « Messag… », « Prix à b… » | `out-s2/petit-journee.png`, `out-s1/429-journee.png` (état normal ET panne) ; pire à 375/320 | cases `src/App.jsx:47148-47153` | libellé sur 2 lignes ou sigle court (« Envoyer », « Msg ») sous 400 px | vérifié |
| 13 | gênant | Annonces : un prix illisible empoisonne la valeur du stock (« **NaN €** ») | prix `{amount:'abc'}` dans une annonce ⇒ « NaN € » (`ctx.cjs`, toutes tailles) | `src/App.jsx:42297-42298` (`Number(it.price)` sans `isFinite`), affiché `50128` | ignorer les prix non finis et dire « sur N » | vérifié |
| 14 | détail | Colis : « vendue le **Invalid Date** » | date de vente illisible (`s4`, toutes tailles) | `src/App.jsx:51645` (`new Date(o.date).toLocaleDateString` sans test) ; la voisine `51194` (`fmtD`) le fait bien | réutiliser `fmtD` (« date inconnue ») | vérifié |
| 15 | détail | Ventes affiche « −15 € » tel quel | prix négatif servi | ligne de vente | « — » + raison pour un prix < 0 | vérifié |
| 16 | gênant | Annonces : « Impossible de charger… vérifie ta connexion, **ou que ton compte Vinted est toujours actif** » quand c'est NOTRE base qui répond 500 | `500listings/annonces` (`out-s1/500listings-annonces.png`) | message de l'écran Annonces | distinguer « base VRM » de « compte Vinted » | vérifié |
| 17 | gênant | `lireTout` non strict : une page 2 ratée rend la page 1 seule, comme complète | 13 appelants sans `strict` (dont `TXN_META_SELECT` `5250/5266/5286`, statistiques `35727-35731`, fraîcheur `32291/38874`) | `src/App.jsx:3527` (`return (p===0||opts.strict) ? null : out`) | `strict: true` partout où un total ou un « absent » en dépend | lecture exacte, à jouer |
| 18 | gênant | Factures Pro : lecture ratée = « aucune facture » | `fetchProInvoices` rend `[]` sur échec | `src/App.jsx:4288, 4292` | rendre `null` et le dire | lecture exacte |
| 19 | détail | Fuseau : dates par défaut et clés de mois en UTC | entre 0 h et 1-2 h (Paris) : la dépense/charge du formulaire Comptabilité est datée de la veille (le 1er du mois à 0 h 30 ⇒ mois précédent) ; récap mensuel/objectif/jours de vente sur le jour UTC | `src/App.jsx:37264` (`auj`), `26551`, `48421-48424`, `61700` | utiliser `dateLocaleISO()` (existe, `10717`) | lecture exacte |
| 20 | détail | Bandeau « 163 numéros à vérifier — Du 11 au 18 octobre, tes numéros ne s'enregistraient plus… » montré à un vendeur quelconque dont des numéros datent de cette semaine-là | `out-s2/gros-annonces` (base inventée) | bloc « numéros à vérifier » d'Annonces | le réserver aux comptes réellement touchés (marqueur serveur) | vérifié (base inventée) |
| 21 | gênant | Poids du premier chargement : `App-*.js` 3,16 Mo (959 Ko gzip) + MapLibre 1 Mo | sur 3G/4G faible, plusieurs secondes de blanc avant l'app | `vite.config.js` (un seul gros chunk) | découper par écran (`import()` des écrans lourds : Stock 3D, Statistiques, Compta) | mesuré au build |
| 22 | détail | iPad / tablette tactile ≥ 768 px en densité 0,65 : les champs à 16 px rendus ~10 px ⇒ Safari peut zoomer à chaque champ | `applyZoom` n'exclut que `max-width:767px` | `src/App.jsx:57131-57140` ; règle 16 px `index.html:295` | exclure aussi `(pointer:coarse)` | à vérifier (pas de WebKit) |
| 24 | gênant (grave sur petit portable / iPad paysage) | Entre 960 et 1024 px de large, les filtres de site « Vestiaire » (et « Leboncoin », « eBay » selon l'écran) passent SOUS l'îlot nuage/« Lecture seule » : impossible de les toucher | `edge-tailles` (13 rouges) + `s7-ile.cjs` : `elementFromPoint` au centre du bouton « Vestiaire » = `.vrm-hbtn.vrm-sync-status` ; `out-s4/ile-1024.png` (et les 4 colonnes de Colis y coupent chaque titre) | barre du haut ordinateur (recherche + filtres + île), cf. « Colis en 4 colonnes + barre du haut ordinateur » du 31 oct. | réserver la largeur de l'île dans la barre (`padding-right` mesuré) ou passer les filtres à la ligne sous 1100 px | vérifié |
| 25 | détail | Base en panne : Achats dit la panne 3 fois (bloc + 2 lignes) | banc `panne` | écran Achats | une ligne, pas de redite sous le bloc | vérifié |
| 23 | détail | PWA en mode sombre : barre d'état iOS `default` (fond clair) au-dessus d'une app sombre | `index.html:12` | `black-translucent` + `safe-area-inset-top` | à vérifier sur iPhone |

### Ce qui tient (vérifié, pour ne pas le refaire)
- **Aucun débordement horizontal, aucun écran tombé, aucune erreur JS** sur 10 onglets × 8 écrans (375, 390, 390 sombre, 412, iPad 820, 1280×650, 2560, 1512 zoom 0,65) avec titres de 200 caractères + emoji, prix nuls/null/chaînes/GBP, N° B125 / « b 0125 » / 007, ventes annulées/remboursées (`out-s4/res.json`).
- Barre du bas à 320/375 px : `main` s'arrête au bord de la barre, le dernier contenu est au-dessus (`s6-nav.cjs`).
- Base en 522 : le bloc « Je n'arrive pas à joindre tes données » s'affiche une fois, Ventes dit « lecture en cours / pas lues », aucune écriture ne part (`522/*`, `w=0`).
- 429 sur Ventes : « Aucune vente lue — certaines lectures ont échoué » (honnête).
- Écriture refusée (503) puis app refermée et rouverte : la saisie est GARDÉE sur l'appareil (`s5c-ecriture-ko.cjs` : localStorage et champ « Julien ») et l'état « pas sauvegardé » est dit. (Mais elle n'est toujours pas en base 7 s après la réouverture : à surveiller.)
- 3 000 ventes : Ventes reste fluide (pagination), Ma journée 7 s de script au téléphone ×4 ; transactions > 1 000 lues en entier (`lireTout` strict, `33165`).
- Retour du réseau : `online` relance la sauvegarde (`2437`).

---

## C. Audits `node scripts/audit-*.cjs` (204, en série) — 9 rouges, aucun ne signale un défaut utilisateur

Journaux : `/tmp/claude-0/-home-user-cancale-v67/f70a9764-046d-5574-bac2-0a1794911434/scratchpad/audits/` (`summary.txt` + un `.log` par audit).

| audit | rouge | ce que ça veut dire | verdict |
|---|---|---|---|
| `audit-argent-lbc` | `port 8411 pris (EADDRINUSE)` | une autre session tenait le port ; relancé avec `BANC_PORT=8499` : **vert** (12/12) | environnement |
| `audit-facture-achat` | « l'index se calcule sur la liste des reçus » | la regex attend `indexRecusParTransaction(recusAchat` ; le code filtre d'abord les reçus déliés (`src/App.jsx:38547`). Règle intacte | banc périmé |
| `audit-recu-achat` | même regex (`indexRecusParTransaction\(recusAchat\b`) | idem | banc périmé |
| `audit-numerotation-lecteurs` | « une vente revenue … dit « numéro neuf » » | cherche `data-retour-archive="retour"` ; depuis le récap de vente (1er nov.) la phrase vit dans `src/App.jsx:47889-47908` (`data-retour-archive={…'oui'}`), le texte « numéro neuf » est là | banc périmé |
| `audit-offre-annonce-partie` | 2 : réponses rapides sous une annonce partie ; point « nouveau » | les règles existent sous d'autres noms (`RapidesConv` gardé par `!offrePartieDuFil` `46523`, `retireesTick` `61068-61075`) | banc périmé (à réécrire sur le rendu) |
| `audit-offres-email` | « les conversations et leurs offres restent rendues » | `data-conv=` n'est plus dans `App.jsx` (déplacé dans les volets de Messages) | banc périmé |
| `audit-photos-vinted` | un `<img src={url}>` hors `PhotoVinted` | `src/App.jsx:25671`, `PhotoVc` (photos **Vestiaire**, ajouté le 1er nov.) : à ajouter à la liste `PERMIS` avec sa raison, ou passer par un composant à secours | vrai écart mineur (image cassée possible, pas de secours) |
| `audit-politique-hotes` | `api-adresse.data.gouv.fr` (`src/CarteRelais.jsx:74`) et `maps.apple.com` (`src/Tournee.jsx:140`) hors liste fermée | la politique cite déjà la Base Adresse Nationale (`public/legal/confidentialite.html:61`) ; `maps.apple.com` est un lien cliqué | liste de l'audit à compléter |
| `audit-secrets` | « email personnel » dans `public/legal/editeur.js:20`, `src/contact.js:16` | c'est `vrm.vinted35+contact@gmail.com`, l'adresse de contact **choisie par Julien le 31 oct.** | décision assumée ; l'audit doit l'autoriser |

## D. Bancs larges (sur `main`, `dist` du build ci-dessus, sans `fx/`)

Journaux : `/tmp/claude-0/-home-user-cancale-v67/f70a9764-046d-5574-bac2-0a1794911434/scratchpad/bancs-out/`.

| banc | résultat | ce que le rouge veut dire | verdict |
|---|---|---|---|
| `revendeurs` | **vert** (213) | — | — |
| `coque-mobile` | **vert** | — | — |
| `tous-boutons` (partiel : `BANC_ECRANS='^(journee\|colis\|ventes\.vinted\|annonces\.vinted\|parametres)$'`, 390 px) | **vert** : 16 écrans, 131 éléments cliqués, 0 défaut | — | — |
| `mobile` | rouge (2 passages : « 320 cat_ventes / 320 journee : navigation hors du contenu ») | la mesure part dès que l'en-tête existe ; mon banc `s6-nav.cjs` mesuré 5 s plus tard : `main.bottom = nav.top = 781` à 320 et 375 px, dernier contenu au-dessus | banc instable (course), pas un défaut |
| `edge-tailles` | **13 rouges** « rien sous l'île d'actions — Vestiaire / Leboncoin / eBay » à 960, 1000 et 1024 px | **VRAI DÉFAUT**, reproduit (`s7-ile.cjs`, `out-s4/ile-1024.png`) : sur Colis, Ventes, Achats, Messages, Annonces, le filtre de site « Vestiaire » (x≈789 px à 1024) est sous l'îlot nuage/« Lecture seule » (`elementFromPoint` = `.vrm-hbtn.vrm-sync-status`) : impossible de choisir Vestiaire sur un petit portable ou un iPad paysage. Voir défaut n°24 | vrai défaut |
| `feuilles-coque` | 22 rouges « la feuille s'ouvre — locator.click: Timeout » (Achats, Annonces, Ventes, Colis, 390 et 1512) | il ouvre les feuilles par `?tab=plat_vinted` + l'ancien segment de section : chemins d'avant la navigation par tâche (31 oct.) ; **aucune feuille n'est plus vérifiée** (clavier, portail, `FermeAuRetour`) | banc périmé — trou de couverture |
| `transporteurs` | 12 rouges (`data-n=null` sur « À retirer », couleur « ambre » attendue) | lit l'ancien compteur de la colonne (désormais `data-cc-n`, `src/ColisColonnes.jsx:44`) et une valeur d'ambre d'avant Vitrine ; la couleur rendue EST l'ambre de Vitrine (`rgb(138,83,0)` / `rgb(240,180,76)`) | banc périmé |
| `statuts-colis` | ~24 rouges, tous les filtres de Ventes « [] » | ne lit plus aucune ligne de vente (le tiroir est devenu le récapitulatif du 1er nov.) ; mon banc `s2` voit bien les lignes et leurs étapes | banc périmé — la règle « une vente = un filtre » n'est plus surveillée |
| `poste-sans-depart` | 2 rouges « le geste est dit UNE fois — 0 fois » | cherche « Vérifie que le colis a bien été déposé » ; la phrase est devenue « Vérifie le dépôt, ou remets-le dans « à envoyer » » (`src/App.jsx:51299`). Les 6 contrôles de règle sont verts | banc périmé |
| `vinted-ui` | 4 rouges (prix d'achat « à côté » de l'état à 390 ; calendrier d'Achats « 0 ») | la fiche au téléphone a été allégée le 1er nov. (prix sous l'état) et Achats a déménagé (31 oct.) | banc périmé (à confirmer avec Julien pour la position du prix) |
| `annonces-carte` | 1 rouge « recherche et retour au stock — Timeout » | chemin de recherche d'avant la recherche en place (31 oct.) ; les 9 contrôles de règle (double vente, baisse eBay) sont verts | banc périmé |
| `panne` | 1 rouge « cat_achats : elle le dit une fois, pas trois — bloc ×1, ligne ×2 » | base en 522 : Achats dit la panne dans le bloc ET deux fois en ligne | vrai défaut mineur (§7, redite) — défaut n°25 |
| `fluidite` | 2 rouges « il est bien sur Achats, dans l'espace Vinted » | Achats n'est plus dans l'espace Vinted depuis le 31 oct. | banc périmé |

**Bilan** : 2 vrais défauts (île d'actions à 960-1024 px, redite de panne sur Achats) ; 8 bancs périmés par les
refontes du 31 oct.-1er nov., dont **4 qui ne protègent plus rien** (`feuilles-coque`, `statuts-colis`,
`transporteurs`, `fluidite`) — à réparer avant de leur refaire confiance ; `mobile` instable.

---

## E. Ce qui reste à vérifier (non joué ici)
- iPhone réel / WebKit et Firefox/Orion : clavier ouvert sur les feuilles, encoche, PWA ajoutée à l'écran d'accueil, `navigator.onLine` faux-négatifs d'iOS (déclencherait le n°7 sans vraie coupure), regex lookbehind (n°9). Aucun moteur WebKit/Firefox n'est installé dans ce conteneur.
- Deux onglets (n°2) : banc à écrire (deux pages d'un même contexte, saisie de prix d'achat).
- Écriture refusée puis réouverture : la saisie est gardée en local mais n'était pas repoussée en base 7 s après (`s5c`) — vérifier qu'elle part bien (`_settingsRevision`/`_failedLocalSaves`).
