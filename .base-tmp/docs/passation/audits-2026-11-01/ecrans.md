# Audit « chaque écran, chaque phrase » — VRM (origin/main f04af748, 1er nov. 2026)

Aucune correction, aucun commit. Ce rapport ne recompte pas ce qui est déjà dans `flux.md`, `utilisateurs.md` et `limites.md`
(par exemple : les cases tronquées de Ma journée, « Lecture seule », « NaN € », « Invalid Date », les pages légales « à compléter »,
la « Quelle année, Julien ! », les exemples « Cancale », l'îlot qui couvre les filtres entre 960 et 1024 px).

## Méthode

- `npm run build`, puis `dist/` servi par un banc jetable : `scratchpad/audit-final/ecrans/banc-ecrans.cjs`
  (copie de `scratchpad/ecr/banc-ecrans.cjs`). Les fixtures sont **reprises telles quelles** de `scripts/bancs/tous-boutons.cjs`
  (extraites de son source à l'exécution) : 1 compte Vinted, ventes et achats Vinted, Leboncoin, eBay, Vestiaire, à la vraie forme
  (`harvest_*`, `lbc_ventes`, `ebay_orders`, `vc_ventes`, projections `select=`, `meta->>`). Écritures et `/api/**` répondus à vide.
- Chaque écran et un niveau de sous-onglets (filtres de site, `Segmente`, `[role=tab]`, les 12 panneaux `data-sous-ouvrir` de
  Paramètres), plus Mon compte et Abonnement, Stock (Meubles, Ma pièce 3D, Cases, Photos), Republier, Favoris, récap d'une vente,
  Emballage, Recherche, Statistiques (Semaine/Mois/Année, Prix qui marche), Comptabilité (Vue d'ensemble, Factures, Semaine/
  Trimestre/Année), Communauté, Comptes liés, Achats masqués, Organisation, accueil public, connexion, inscription,
  `recuperation.html`, les 6 pages `public/legal/`. Bienvenue et la carte de la communauté : bancs du dépôt `bienvenue.cjs` et
  `communaute.cjs` (captures `BANC_CAPTURES`/`BANC_DEBUG`).
- **3 passes complètes** : 390 px tactile clair (82 vues), 390 px tactile sombre (81), 1512 px clair (81) ; plus une passe
  **756 px = zoom 200 %** d'un écran 1512 sur 17 vues. Captures écran + pleine hauteur dans `scratchpad/ecr/out-{tel,sombre,ordi,zoom}/`
  et `out-plan/`, `out-onglet-*`, `bienv/`, `comm/`.
- Dans chaque vue, une analyse DOM (`rapport.json`, `rapport1.json`) : mots pièges (undefined, null, NaN, [object Object],
  Invalid Date, n/d), emoji, anglais, vouvoiement, textes coupés, éléments hors écran, contraste WCAG calculé, cibles < 44 px,
  noms accessibles, `alt`, `aria-*` qui pointent dans le vide, rôles invalides, id en double, chevauchements, couleurs
  rouge/ambre/accent, montants répétés, et à 1512 px les 18 premiers arrêts de tabulation (focus visible).
- Textes : relecture des captures + correcteur français (pyspellchecker) sur tout le texte visible, plus extraction des chaînes
  du code par Babel (`ch.cjs`, commentaires exclus) pour les accents manquants, « (s) », emoji, « e-mail/email ».
- **Résultat net de la machine** : 0 « undefined/null/NaN/[object Object]/Invalid Date/n/d » visible, 0 erreur JS, 0 écran tombé,
  0 image cassée, 0 icône vide, 0 débordement horizontal de page (390, 756 et 1512), 0 rouge hors « deux paires sous un N° ».
  Ce qui suit est donc surtout de la cohérence, de la langue et de la finition.

⚠️ Ce qui vient du banc et n'est **pas** compté comme défaut : « Séparation des comptes pas encore activée » et « Réglages gardés sur
cet appareil seulement » (le banc sert une base non cloisonnée), « Abonnement pas lu », « Impossible de charger » dans Messages,
« Je n'ai pas pu lire la carte » (routes `/api` vides), les badges de la barre du bas qui apparaissent ou non selon l'écran (dépend
de l'ordre d'arrivée des lectures au banc : **à vérifier en vrai**), et le blocage de la capture 3D sous horloge simulée.

---

## GRAVE

### G1 — Ma journée et Statistiques : « Vendu » sans la vente eBay dont les frais ne sont pas lus, présenté comme complet
- **Écran** : Ma journée (« Vendu en octobre 372 € · 5 ventes », semaine « mer 28 : 0 »), Statistiques (« Vendu 372,00 € »,
  « Vendu · 12 derniers mois », « Meilleur mois »), Comptabilité (carte « Vendu · octobre 2026 372,00 € »).
- **Capture** : `ecrans/01-journee-ordi-vendu-sans-ebay.png` (1 = la carte, 2 = mercredi 28 à « 0 » alors qu'une commande eBay
  PAYÉE de 80 € date de ce jour), `ecrans/02-compta-tel-vendu-sans-au-moins.png` (1 = « 372,00 € » sans « au moins »,
  2 = la ligne « 1 commande eBay écartée » juste dessous).
- **Constat** : `ventesFaites` (`src/App.jsx:6367-6375`) mesure le VENDU eBay avec `montantRecuEbay` ; frais eBay pas encore lus
  ⇒ la commande est comptée dans `ecartees` et sort du total. La coque qui nourrit Ma journée et Statistiques
  (`src/App.jsx:61921-61935`) ignore `v.ecartees` : `venduManque` ne nomme que les comptes non lus, donc ni « au moins » ni
  « sans eBay ». En Comptabilité, le manque est écrit sous le bloc (`34472`) mais le chiffre « Vendu » lui-même reste sans
  « au moins ». C'est le cas « total partiel présenté comme complet » du §5, sur l'écran d'ouverture, et il touche **chaque**
  vente eBay récente (les frais arrivent après le paiement).
- **Correction** : ajouter `v.ecartees` à `venduManque` (« au moins … · 1 vente eBay au montant pas encore lu »), et préfixer
  « au moins » la carte Vendu de Comptabilité quand `venduEbayEcartees > 0` — ou compter le VENDU eBay au prix payé.

### G2 — Ma journée écrit « Dimanche 1 novembre » (aujourd'hui)
- **Capture** : `ecrans/04-journee-1-novembre-sans-er.png`.
- **Où** : `src/App.jsx:46758` (`toLocaleDateString` brut) ; le bon helper existe déjà à `35085` (`'1er'`).
- **Gravité** : c'est la première ligne de l'app, un jour par mois. **Correction** : réutiliser la règle « 1er » de `35085`.

---

## GÊNANT

| # | Écran / capture | Constat | Fichier:ligne | Correction en une phrase |
|---|---|---|---|---|
| N1 | Bienvenue — `ecrans/03-bienvenue-5-sur-5-sept-traits.png` | La barre a **7 traits**, le texte dit « **5 sur 5** » avec 6 traits pleins : on croit être au bout, il reste un écran. | `src/Bienvenue.jsx:107` (`n + 2` traits) et `:133` (`{etape} sur {n}`) | Compter les mêmes étapes dans les deux (« 6 sur 7 » ou 5 traits). |
| N2 | Bienvenue — même capture (3) | « 🔊 Écouter la visite » / « ⏸ Couper la voix » : emoji dans un bouton (§7). | `src/Bienvenue.jsx:145` | Icône `ICON_PATHS` ou texte seul. |
| N3 | Messages → Favoris reçus — `ecrans/05-favoris-selecteur-absent.png` | « Choisis un compte Vinted dans le **sélecteur au-dessus** » alors qu'aucun sélecteur n'est affiché (un seul compte) ; « Afficher les favoris » grisé. Phrase qui envoie vers un objet absent. | `src/FavorisVinted.jsx:256`, `:255` | Avec un seul compte, le choisir d'office ; sinon montrer le sélecteur dans la carte. |
| N4 | Ventes · Vinted, récap d'une vente — `ecrans/06-recap-vente-lien-sur-vinted.png` | Un lien seul « **sur Vinted ↗** » (16 px de haut) sous « Générer le bordereau » grisé : ne dit pas quoi faire, cible trop petite, et redit « Voir sur Vinted ↗ » juste dessous. | `src/App.jsx:16521-16524` | « Générer le bordereau sur Vinted ↗ » en bouton de 44 px, ou le retirer quand « Voir sur Vinted » est là. |
| N5 | Statistiques — `ecrans/08-statistiques-meme-montant-trois-fois.png` | « 372,00 € » écrit **3 fois** sur l'écran (Vendu, Vendu 12 derniers mois, Meilleur mois) ; « **Leboncoin (Leboncoin)** » dans « Par compte » ; légende du donut coupée en plein mot « Adi… », « Sal… ». | Statistiques (`src/App.jsx` ~35850-36300) | Une seule occurrence par écran (§7), nom de compte sans redite, légende en entier ou en 2 lignes. |
| N6 | Annonces · Vinted (390) — `ecrans/09-annonces-trou-et-desalignement.png` | (1) bande vide de ~100 px sous les filtres de site ; (2) le ⓘ de l'astuce passe seul à la ligne ; (3) « Republier… » en retrait, pas aligné sur la recherche ; (4) « Publier · Leboncoin 4/4 » en **9 px**. | `src/App.jsx:49787` (astuce) ; ligne Republier/recherche d'Annonces | Supprimer le vide, mettre ⓘ dans le flux du texte, aligner Republier sur la grille, 12 px mini. |
| N7 | Ventes · eBay (390) — `ecrans/10-ventes-ebay-filtre-actif-invisible.png` | Le filtre **actif** « eBay » est hors écran (on ne voit qu'un bord gris fondu) : rien ne dit sur quel site on est ; même chose pour Vestiaire. Et « Réponse eBay incomplète. Réessaie la lecture. » écrit 3 fois de suite. | rangée `vrm-filtres` (Annonces/Ventes/Messages/Achats) ; bloc « Retours et annulations / Tâches » eBay | Faire défiler la rangée jusqu'au filtre actif au montage ; une seule phrase d'erreur pour le groupe. |
| N8 | Republier et brouillons — `ecrans/11-republier-version-sans-geste.png` | « Grisés : ils demandent l'extension VRM **5.253.0** ou plus récente sur ton ordinateur. » en ambre : numéro de version (jargon) et aucun geste (§2.7). | menu `data-actions-maj` | « Mets l'extension à jour » + bouton qui mène à Paramètres → État des connexions. |
| N9 | Ventes Leboncoin / eBay (390 et 1512) | Libellés des chiffres « En cours / Finalisées / Expédiées / CA payé / CA finalisé » en **9 px** ; « ✓ Colis fait » 10 px ; « 1 bordereau à générer » 10 px — contre la règle « étiquettes ≥ 12 px » du 1er nov. | `src/styles-mobile-studio.css:316` (`.vrm-kpi-ventes-lib{font-size:9px}`), `src/App.jsx:17927` | Porter à 12 px. |
| N10 | Comptabilité → Factures | « Factures Factur-X · ventes **de octobre** 2026 » ; même faute pour avril/août et dans l'infobulle URSSAF (« CA déclaré de octobre »). | `src/App.jsx:34877`, `:47359` | Élision (« d'octobre », « d'avril », « d'août »). |
| N11 | Ma journée (390) — `ecrans/16-journee-tel-memes-nombres.png` | « Reçu en octobre 70 € » et « CA 2026 70 € » côte à côte : le même nombre deux fois, deux notions différentes (§7). | carte « Vendu en … » de Ma journée | Quand les deux valeurs sont égales, une seule case (« Reçu en octobre = CA 2026 »). |
| N12 | Stock → Meubles — `ecrans/17-stock-vide-sans-bouton.png` | État vide « Donne un numéro à tes annonces dans l'onglet Annonces » **sans bouton** (et Annonces, au même moment, montre des fiches « N°1…N°4 » : à vérifier sur vraie base). | état vide de Stock (Meubles, Cases, Photos) | Bouton « Ouvrir Annonces ». |
| N13 | Stock → Ma pièce (3D) — `ecrans/15-stock-3d-emoji.png` | 23 emoji dans le catalogue de meubles (🗄️ 📚 🧺 👕 🪵 📦 🚪 🪟 🪑 🖥️ 🛋️ 🛏️ 🟫 🪴 💡 🪞 🖼️ 🗑️ 🪜 ♨️ 🚲 🛠️ 🎨), « ☀️ Ambiance » ; commandes 3D en caractères « ◀ + - ▶ » (un trait d'union pour « moins »). | `src/App.jsx` (catalogue `Room3D`/aménager), `src/Room3D.jsx` | Icônes de `ICON_PATHS` ou libellé seul ; « − » et icônes pour les flèches. |
| N14 | Paramètres → Notifications du téléphone | Les 18 catégories commencent par un emoji (« 💸 Vendu », « 💰 Argent viré », « ⚠️ Double vente »…). Les notifications elles-mêmes aussi (`api/ship-reminders.js:678,754`, `api/email-inbound.js:2101-2490`, `api/_lib/*`, ~40 titres). | `src/App.jsx:56541-56560` (`PUSH_CATS`) | Retirer l'emoji des libellés de Paramètres ; pour les notifications, décider une fois (Julien) si l'emoji y reste. |
| N15 | `recuperation.html` (nouveau mot de passe) | « **Votre** espace de vente. » au milieu d'une page en « tu » ; « SÉCURITÉ DU COMPTE » en 10 px contraste 4,1 ; aide 11 px contraste 3,86 ; « Retour à la connexion » 15 px de haut ; `<link rel="icon" href="/favicon.ico">` → **404** (aucun `favicon.ico` dans `public/`). Le bouton y dit « Voir », la connexion dit « Afficher » ; la règle y est « lettres et chiffres », l'inscription dit « Mélange de caractères ». | `public/recuperation.html:1`, `public/recuperation.css` | « Ton espace de vente », icône existante, mêmes mots et même règle que l'inscription. |
| N16 | Accueil public, connexion, inscription, 6 pages légales (390) — `ecrans/18-connexion-cibles-pied.png` | Liens de pied « Mentions légales · CGU · CGV · Confidentialité · Cookies · Contact » de **14 à 21 px** de haut, collés ; « Mot de passe oublié ? » 32 px ; logo-lien 32-36 px. | `src/Accueil.jsx` (pied), écran de connexion, `public/legal/legal.css` | `min-height:44px` + espacement sur les liens de pied au téléphone. |
| N17 | Messages · Vinted et Favoris | « Ouvrir Vinted ↗ » : cible de 15 px de haut. | `src/SynchronisationVinted.jsx:20` | Le poser en bouton de 44 px. |
| N18 | Ventes · Vinted → Vérifications — `ecrans/07-ventes-1-comptes.png` | « Comparer mes comptes Vinted · **1 comptes** » (pluriel faux, et comparer un seul compte n'a pas de sens) ; chevrons pas alignés d'une ligne à l'autre. | `src/OutilsArticlesVinted.jsx:114` | Accord + masquer la ligne sous 2 comptes. |
| N19 | Tout le texte : pluriels en « (s) » | 27 phrases affichées en « vente(s) », « commande(s) nécessitent », « article(s) contrôlé(s) », « appareil(s) étai(en)t abonné(s) »… (ex. visible : Ventes eBay « 1 commande(s) nécessitent une analyse séparée », « Frais non suivis … pour 1 vente(s) »). | `src/FiabiliteVentes.jsx:7`, `src/App.jsx:31982, 33958, 45351, 46067, 46077, 50136, 51205, 52101, 58973, 58974, 59957`, `src/AutomatisationFavoris.jsx:100,104`, `src/DiagnosticLeboncoin.jsx:26`, `src/ReceptionEmails.jsx:62`, `src/VendusAilleurs.jsx:119` | Passer par le `pl()`/`pluriel` déjà présent (`App.jsx:11327`). |
| N20 | Paramètres → Mon compte — `ecrans/13-mon-compte-erreur-collee-au-bord.png` | La phrase d'erreur Discord sort de la carte (collée au bord gauche, sans marge) ; la valeur du champ Prénom touche le bord droit ; deux lignes « Google / Discord · **Bientôt** » (fonction annoncée, pas livrée) en tête de section. | section « Comptes associés » (`src/auth/ConnexionsCompte.jsx`) | Remettre la phrase dans le padding de la carte ; marge droite au champ ; cacher « Bientôt » tant que ce n'est pas prêt. |
| N21 | Clavier (1512) | Le champ de recherche de la barre du haut (« Rechercher une paire », 34 écrans), celui de Ventes, de Stock → Cases et la date de Paramètres → Import n'ont **ni contour ni ombre** au focus clavier (mesuré `outline`/`box-shadow`). | `input.vrm-recherche-champ` (barre du haut, `App.jsx:62736`), `App.jsx:47685` | Un `:focus-visible` (anneau cobalt 2 px) sur ces champs. |

## DÉTAIL

| # | Écran | Constat | Fichier:ligne | Correction |
|---|---|---|---|---|
| D1 | Partout | « email » (≈355 chaînes) et « **e-mail** » (34) mélangés, y compris sur un même écran (Colis : « l'e-mail du transporteur » ; Paramètres : « Réception des emails ») ; « mail(s) » dans les CGU. | `ch.cjs` sur `src/` | Un seul mot (le §1 de CLAUDE.md dit « email »). |
| D2 | Partout | Apostrophes droites « aujourd'hui », « d'achat » à côté d'apostrophes typographiques « l’extension », « n’a » (souvent dans la même carte : Ma journée « 2 choses à faire aujourd'hui » / tooltips en ’). | chaînes JSX | Une seule apostrophe (’) partout. |
| D3 | Plusieurs | Voix mélangée : « **Je** n'ai pas pu lire ton Discord », « Je n'ai pas pu lire la carte », agent eBay « Je ne propose rien… », à côté de « VRM n'a pas vu… ». | Mon compte, Communauté, agent eBay | Choisir « VRM » (ou « je » réservé à l'agent eBay) et s'y tenir. |
| D4 | Bienvenue | « Clair / **Nuit** » alors que Paramètres dit « **Mode sombre** » ; les vignettes du choix ont un bleu vif (#2563EB-ish) qui n'est pas le cobalt Vitrine. | `src/Bienvenue.jsx:118` ; `App.jsx:56943` | « Clair / Sombre » et vignettes aux couleurs Vitrine. |
| D5 | Paramètres | Placeholder « Rechercher dans **Réglages**… » (la colonne dit « Paramètres ») ; ligne « Organisation » avec une coche ✓ comme icône. | `src/App.jsx:57078` (`titreRetour`) | « Rechercher dans les paramètres… » ; une vraie icône. |
| D6 | Communauté — `ecrans/14-communaute-guillemet-orphelin.png` | « sous le pseudo « ↵Alice ». » : guillemet ouvrant seul en fin de ligne (espace normale au lieu d'insécable) ; le message (toast) recouvre le titre de la barre du haut ; l'épingle « RE » cache le nom « Rennes ». | `src/communaute/Communaute.jsx` | ` ` après « et avant », toast sous la barre, épingle décalée ou libellé au-dessus. |
| D7 | Ma journée (Dernières ventes) | Titres coupés juste avant la taille : « Nike Air Max 90… », « Salomon XT-6 gris… » — la taille (ce qui distingue deux paires) disparaît. | cartes « Dernières ventes » | 2 lignes de titre, ou mettre la taille à part (« T42 »). |
| D8 | Ventes · Tous les sites (390) | Sous-titre « Vinted · 31 oct. · À expédier · boutique_de… » : le compte coupé. | ligne de vente `ventes.toutes` | Compte sur sa propre ligne, ou abrégé à l'avance. |
| D9 | Messages | Champ de recherche avec un fond intérieur différent du cadre (double fond) — `ecrans/12-messages-champ-double-fond.png`. Réponses rapides par défaut avec emoji (🙂 👍 📦 🙏) et coupées « … » sur 230 px. | `src/App.jsx:2003-2007` (réponses par défaut) | Un seul fond ; réponses par défaut sans emoji, sur 2 lignes. |
| D10 | Messages, Favoris | « Assistance technique · favoris », « Synchronisation par compte · 1 compte · 2 lectures à vérifier » : jargon hors du panneau Sécurité. | `src/DiagnosticFavoris.jsx:25`, `src/SynchronisationVinted.jsx` | « Un souci avec les favoris ? », « Dernières lectures de tes comptes ». |
| D11 | Comptabilité | Jargon non expliqué : « e-reporting », « Factur-X », « Super PDP », « FX-AAAA-0001 » ; « Ton bénéfice se calcule dans l'écran Ventes… (Ventes) » répète le bandeau « Pas encore calculé : ouvre Ventes… » du haut ; chevrons « › » de la liste à contraste 1,9 (1512) / 2,4 (sombre). | `src/App.jsx:34848, 34877` ; `span.vrm-set-chev` | Une phrase d'explication par terme ; un seul rappel « ouvre Ventes » ; chevrons à la couleur du texte secondaire (≥ 3:1). |
| D12 | Ma journée | « Vendus ailleurs · annonces à retirer — **Vérifier mes plateformes** » : contraste 3,5 à 14 px ; axe du graphique « lun…dim » 11 px à 3,6. | `src/VendusAilleurs.jsx:96` ; graphique de la semaine | Couleur secondaire ≥ 4,5. |
| D13 | Achats · Vinted | Le compteur du segment « En route 1 » : contraste 2,8 (clair) / 3,8 (sombre). | `span.vrm-seg-n` | Même couleur que le libellé. |
| D14 | Annonces · Vestiaire | « Environ 0,02 **$** la photo », « API dashboard → API keys » (anglais) — et seule somme en dollars de l'app. | carte « Ta clé Photoroom » | « environ 0,02 € (prix Photoroom en dollars) » ; libellés Photoroom entre guillemets avec leur traduction. |
| D15 | Exports CSV de Comptabilité | En-têtes sans accents à côté d'en-têtes accentués dans le même fichier : « Régime » / « CA des ventes finalisees », « Benefice net », « Resultat apres charges », « CA finalise », « Net estime ». Le reçu d'achat PDF aussi : « Recu d'achat », « Recapitulatif etabli … emise par Vinted », « Etabli le ». | `src/App.jsx:35634, 45354-45362, 45377, 45383, 45544, 45567-45568, 45596` ; `10126, 10187-10188, 10248-10250` ; `src/facturationElectronique.js:267-286` | Accents partout (pdf-lib StandardFonts encode é/è/à en WinAnsi). |
| D16 | Ventes · Vinted | « Prix d'achat », « Relier un achat », « ✓ Colis fait » : le « ✓ » est un caractère, pas une icône ; « Coût d'achat ? » vs « Prix d'achat » pour la même donnée selon l'écran. | lignes de vente | Un seul libellé (« Prix d'achat »). |
| D17 | Accueil public | Bandeau « Vinted · Leboncoin · eBay » sans Vestiaire, alors que la Bienvenue dit « Vinted, Leboncoin, eBay et Vestiaire » (la FAQ dit « Pas encore »). | `src/Accueil.jsx` | Aligner les trois textes sur une seule vérité. |
| D18 | Mode sombre | Le logo VRM de la barre du haut devient un carré à angles vifs (arrondi en clair). | barre du haut | Même `border-radius` dans les deux thèmes. |
| D19 | `aria-*` | `aria-controls` vers des id absents quand le panneau est fermé : `#vrm-recherche-resultats` (barre du haut, 85 vues), `#vrm-offres-auto-detail`, `#:r0:`… (actions de vente) ; cases à cocher sans nom accessible (agent eBay `data-agent-parjour` + 3 `checkbox`, récap de vente) ; champs sans label (Comptes liés « Email du compte », « Téléphone du compte » ; Factures « N° d'article ou date de vente… » ; Import « date »). | `App.jsx:62736, 62857, 49813, 18816` ; agent eBay | Ne poser `aria-controls` que si le panneau est monté ; `aria-label` sur ces champs. |
| D20 | Ventes · Vinted (récap) | « Bénéfice — » puis « Versé sur ton porte-monnaie — pas encore » : deux tirets de sens différents sur la même carte (inconnu / pas encore). | `src/recapVente.js` | « pas encore » sans tiret. |

## Ce qui tient (vérifié, inutile de le refaire)

- Aucune chaîne `undefined`, `null`, `NaN`, `[object Object]`, `Invalid Date`, `n/d` dans les 244 vues ; aucune erreur JS ; aucun
  écran tombé ; aucun `<img>` sans `alt` ni image locale cassée ; aucune icône vide ; aucun rôle ARIA inventé ; aucun id en double.
- Aucun débordement horizontal à 390, 756 (zoom 200 %) et 1512 px ; aucun élément hors écran hors des rangées défilantes.
- Rouge : jamais rencontré (aucune fixture n'a deux paires sous un N°) — rien d'autre n'est rouge. Ambre : posé sur des gestes
  (prix d'achat, « À expédier », « Saisir le prix d'achat », sauvegarde) sauf N8 et la phrase Vestiaire « Depuis ton ordinateur… ».
- Pas de vouvoiement dans l'app (seulement dans les modèles de messages aux acheteurs et le formulaire légal de rétractation, normal).
- Orthographe : le correcteur ne relève aucune faute sur l'app ni les pages légales hors les cas ci-dessus (N10, D15).
- Focus visible présent sur la colonne, les boutons et les liens de l'accueil (seuls les champs de N21 en manquent).

## Fichiers

- Rapport : `/tmp/claude-0/-home-user-cancale-v67/f70a9764-046d-5574-bac2-0a1794911434/scratchpad/audit-final/ecrans.md`
- Captures annotées (cadres rouges numérotés) : `/tmp/claude-0/-home-user-cancale-v67/f70a9764-046d-5574-bac2-0a1794911434/scratchpad/audit-final/ecrans/01-…18-*.png`
- Banc jetable : `/tmp/claude-0/-home-user-cancale-v67/f70a9764-046d-5574-bac2-0a1794911434/scratchpad/audit-final/ecrans/banc-ecrans.cjs`
  (`MODE=tel|sombre|ordi|zoom`, `SEUL=<regex>`, `DEBUT=<écran>`, `NOCLOCK=1` pour la 3D : sous horloge simulée la capture WebGL
  ne rend jamais la main — limite du banc, pas de l'app).
- Toutes les captures brutes et les analyses JSON : `/tmp/claude-0/-home-user-cancale-v67/f70a9764-046d-5574-bac2-0a1794911434/scratchpad/ecr/out-*/`.
