# 14 nov. — La carte du logo ouvre le site, jamais VRM ; les messages aux favoris se lancent d'ici (extension 5.376.0)

Branche `claude/extension-carte`. Julien, ce midi, mot pour mot :
« Je veux également sur les extensions que tu enlèves Colis, Messages etc., ou alors quand tu appuies
dessus ça ouvre juste les ventes de ce compte, les messages de ce compte, mais pas plus, ça n'ouvre pas
VRM s'il te plaît. Comme ça par exemple on peut lancer les messages aux favoris directement quand on est
sur le compte, on n'a pas besoin d'aller sur VRM, je pense que ça peut être pas mal. Pareil, les messages
favoris doivent être améliorés, les publications aussi, tout doit être amélioré. Tout doit être parfait,
irréprochable. Tout doit être accompagné pour l'utilisateur. Il ne doit pas se sentir seul. »

## 1. La carte du logo n'ouvre plus VRM (`vrm-badge.js`, `background.js`)

- **Retirés** : « Ouvrir VRM », « Colis · Messages · Offres » (ils ouvraient VRM), « Voir dans VRM » du
  résumé du mois. Le clic du logo à la souris ÉPINGLE la carte (il ouvrait VRM). VRM reste à un clic de
  l'icône de l'extension (la fenêtre de la barre du navigateur) — seul chemin restant vers VRM.
- Le fond refuse `ouvrirVRM` venu de la carte (`from: 'vrm-badge'`) ; la fenêtre (`cancale-popup`) garde
  sa liste blanche d'écrans.
- **Les liens du site** (`liensCartePour`, dans `etatSite` → `liens`) : des pages du MÊME site que
  l'onglet (son origine, jamais une adresse reçue), celles du compte connecté. Seulement des adresses que
  le code de VRM ouvre ou lit déjà (aucune devinée) :
  - Vinted : Mes ventes `/my_orders/sold` (banc `numero-vinted`), Messages `/inbox`, Mon dressing
    `/member/{uid}` (Réglages) — uid = le compte du cookie de l'onglet ;
  - Leboncoin : `/compte/part/mes-annonces`, `/compte/part/mes-transactions`, `/messages` (compte de
    l'onglet connu, sinon aucun lien) ;
  - eBay : `/sh/lst/active`, `/sh/ord` (Seller Hub, pages du compte connecté par définition) ;
  - Vestiaire : **aucune** adresse de compte connue dans le code ⇒ aucun lien (rien d'inventé).
  Un lien ouvre la page dans CET onglet ; pendant qu'une file de favoris part de l'onglet, dans un
  nouvel onglet du même site.

## 2. Les messages aux favoris lancés depuis la carte

- La carte : « N favoris à qui écrire · Voir » (compte de l'onglet, Vinted, extension connectée à VRM).
  « Voir » ⇒ l'aperçu : une phrase de ce qui va se passer (« VRM va écrire à ces N personnes, une par une,
  depuis cet onglet. Rien ne part avant « Lancer » »), le message rendu (variables remplacées), l'offre,
  une ligne par personne (pseudo, article, prix → offre), le rythme, ce qui attend une preuve, la garde
  « ventes ailleurs pas revérifiées » ; « ? » explique ; « Lancer (N) » seul bouton plein.
- **L'aperçu est calculé par le SERVEUR** avec les règles de l'app (`api/_lib/favoris-carte.js`,
  action `apercu` de `/api/compte?mode=favoris`, lecture seule, aucune requête à Vinted) :
  `favorisDepuisNotifications`, `etatFavori` (« à envoyer » seulement), `etatDressingAuto` /
  `etatAnnonceAuto` (dressing complet < 24 h, sinon « pas su » ⇒ rien proposé ; vendu, réservé, en pause,
  fermé ⇒ écarté), la vente AILLEURS prouvée (`vinted_offres_garde`) écartée, le destinataire PROUVÉ par
  la même résolution que `lancer` (`resoudreCiblesFavoris`), `personnaliserMessageFavori` /
  `prixOffreFavori`. Au plus 15 (= une heure de favoris), les plus récents d'abord.
- **Lancer** = SON clic : `confirme: true`, la sélection et les réglages de l'aperçu, le compte du cookie
  de l'onglet (un autre uid ⇒ refusé). La file est celle d'avant (`lancer` → `suivant` →
  `executerMessageFavori` → `terminer`), conduite par le service worker (`tickFavorisCarte`, état dans
  `vrmFavorisCarte`, repris par le réveil `vrm-relais` de 30 s), par la porte des commandes de l'app
  (`executerPourAppCoeur`, extraite de `executerPourApp` : garde stricte, sécurité du compte 15/h favoris,
  50/h et sa réserve, pause 429/403, une requête Vinted à la fois). La réponse BRUTE de l'extension est
  traduite par le serveur (`terminer` + `brut` → `traduireResultatFavori`, une seule règle).
- Rien ne part (et la carte le dit) : « Tout arrêter », pas de réseau, pause de Vinted, autre compte dans
  l'onglet, plus d'onglet vinted.fr, VRM muet. Captcha / « activité automatisée » ⇒ file ARRÊTÉE chez VRM.
  Progression : « 3/12 envoyés · prochain dans 6 min · Tout arrêter » ; la fin dit envoyés / pas envoyés /
  à vérifier sur Vinted.
- Capacités : `carteliens` (`liensCartePour`) et `favoriscarte` (`tickFavorisCarte`), 5.376.0.

## 3. App

- **Messages aux favoris** : un guide « en 3 temps » (qui · quoi · quand + « le logo VRM sur vinted.fr
  lance aussi ces messages »), ouvert la première fois (`vrm_favoris_guide_vu`, ce navigateur), puis
  derrière « ? » (`FavorisEtapes.jsx`).
- **Créer sur Vinted** : les 4 étapes (Vérifier · Photos · Créer le brouillon · Publier sur Vinted, celle
  en cours calculée), l'aide « ? » (avant · pendant · après), « VRM va créer N brouillons sur {compte}…
  Rien n'est mis en ligne » AVANT le bouton, et l'échec DIT sur la ligne de la fiche (« Pas créé :
  raison. geste » ; une issue incertaine ⇒ « À vérifier : … »), jamais seulement dans le suivi.
- Textes par `tr()` en 5 langues ; 3 lignes « Quoi de neuf ».
- Pas fait (reste à faire) : Republier et « Publier partout » n'ont pas eu de parcours nouveau ici ; la
  « reprise » d'une file de favoris interrompue reste celle de l'app (relancer depuis la liste).

## Preuves

- `scripts/audit-carte-extension.cjs` (vrai `background.js` dans `_fond-vm.cjs` + vraie route
  `api/compte.js` sur une fausse base à état) : 49/49 ; `--prouve` : 20 rouges sur origin/main, 13
  mutations attrapées (carte qui ouvre VRM, lancer sans clic, compte nommé par le message, tour sans
  compte de l'onglet / pendant la pause / malgré « Tout arrêter » / sans onglet, captcha sans arrêt,
  liens vers VRM, aperçu qui propose un vendu ou un destinataire non prouvé ou un dressing ancien,
  plafond horaire retiré). La réserve de 5 reste jugée par `audit-favoris-ecritures`.
- Banc `scripts/bancs/carte-favoris.cjs` (vrai `vrm-badge.js`, 390 doigt + 1512 souris, clair + sombre) :
  79/79 — captures regardées (carte, aperçu, aide, en cours, attente, fin).
- Bancs mis à la décision du 14 nov. (ils exigeaient « Ouvrir VRM ») : `badge` (1 rouge restant, déjà
  rouge sur origin/main : boutons à 43 px pendant l'animation), `extension-visuel` 63/63,
  `carte-resume-mois` 63/63.
- `annonce-vinted` 64/64 (+ étapes, avant, aide, refus dit) et `favoris-clair` 120/120 (+ guide) :
  rouges sur origin/main ; mutation « échec muet » ⇒ rouge.
- Verts : `audit-coherence`, `audit-moteur-offres`, `audit-identite`, `audit-fonctions-api`,
  `audit-favoris-ecritures`, `-vintex`, `-autres-comptes`, `-auto`, `audit-lbc-clair`,
  `audit-traduction`, `audit-quoi-de-neuf`, `audit-extension-ui`, `-moyennes`, `-garde-fous-capture`,
  `audit-planchers-code`, `audit-confiance-publique` ; `npm run build`.
- `audit-extension-zip` rouge pour les zips seulement (non régénérés, consolidation ailleurs) ;
  `audit-vocabulaire-article` rouge avant ce lot (fichiers non touchés).

## Geste de Julien

Installer l'extension 5.376.0 quand elle sera servie ; sur vinted.fr, toucher le logo VRM : « Mes ventes ·
Messages · Mon dressing », et « N favoris à qui écrire · Voir ». Le message se règle une fois dans VRM
(Messages → Favoris → Ton message).
