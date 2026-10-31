# Historique — leboncoin

> Texte déplacé TEL QUEL depuis `CLAUDE.md` le 31 octobre 2026 (allègement du dossier : 1,36 Mo → moins de 60 Ko).
> Rien n'a été réécrit : les paragraphes gardent leur ordre d'origine. Le classement par thème est automatique (mots du titre) — en cas de doute, chercher par `grep` dans tous les `docs/passation/historique-*.md`.

> **29 octobre — revue des écrans Vinted, dernier tour (deux défauts) :** « il lui faut un N° pour aller sur Leboncoin »
> était écrit en ambre sur CHAQUE fiche sans N° (§7) — retiré de la fiche (« + N° » y suffit) ; la pastille de l'en-tête
> dit une fois « N sans N° — il leur en faut un pour Leboncoin » (`data-sans-num`). Statistiques gardait seulement deux
> dates (`caDu`/`caAu`) et réécrivait « 7 jours » en « Du 24 au 30 oct. » quand Ventes disait « 7 derniers jours » : le
> libellé du raccourci est gardé (`caLabel`), le même choix s'écrit pareil partout. Preuves : banc `vinted-ui` (9205 et 9206
> sans N°, libellé Ventes = Statistiques) **6 rouges sur e314e0ee**, 0 après ; mutation (ligne remise sur la fiche +
> libellé jeté) ⇒ 6 rouges. ⚠️ Non mesuré : sa vraie base (une annonce en ligne sans N° aujourd'hui, hors shop_cancale).

> **29 octobre — revue des écrans Vinted : neuf défauts reproduits, corrigés (app seule) :** la préparation Leboncoin
> (`etatPrepaLbc`, une règle pour la fiche et l'en-tête) dit l'état COMMUN une fois au-dessus de la grille (« N à recapturer
> pour Leboncoin ») — la fiche ne garde que ce qui la distingue (« 2/5 photos captées ») ; chez lui ~125 fiches sur 179
> auraient porté « photos pas encore captées ». Statut des offres auto court et à la ligne (« Allumées · 2 annonces avec
> mini »), jamais « … ». Plus aucun renvoi à « Gérer l'annonce » (Statistiques → « la case boost de sa fiche »). Raccourcis
> du calendrier à la ligne dans la feuille (« Cette année » n'est plus hors de l'écran). « CA entre deux dates » somme le CA
> finalisé PAR JOUR publié par la coque (`caFinaliseParJour`, la population de « Finalisé sur Vinted », §11) au lieu de
> l'archive vide — « — » tant que pas lu, jamais 0,00 € ; la phrase passe par `phrasePlage` (« en octobre 2026 », « en 2026 »,
> « du … au … »). « À publier sur Leboncoin » neutre (habillé comme les autres gestes) et absent d'une paire PROUVÉE sur
> Leboncoin. Feuille du calendrier au doigt : le haut de la zone se cale sur le DÉBUT d'un mois (marge basse ajoutée quand
> c'est le dernier). `updatePair` compte `fees` : un boost tapé sur une annonce sans N° est gardé. Calendrier sur tablette
> tactile (`pointer: coarse`, fenêtre à deux mois) : jours, flèches, raccourcis, boutons à 44 px. Preuves : banc `vinted-ui`
> (+ section T tablette, contrôle R du texte de l'app) **30 rouges sur fd505d59** (le code relu), 0 après ; mutations
> « préparation sur chaque fiche », « `fees` ignoré », « CA hors plage » ⇒ rouges. 175 audits verts ; bancs voisins :
> `chiffres-croises` vert, `annonces-carte` 3 · `perfv` 1 · `stats-premium` 3 · `feuilles-coque` 7 · `revue-20oct` 12 rouges, tous
> présents (et plus nombreux) sur le build d'origin/main d1e76ab2. ⚠️ Non mesuré : un vrai iPad.

> **29 octobre (revue 2) — Comptabilité : cinq défauts des relecteurs, corrigés :** (1) la carte URSSAF renvoyait une vente
> Leboncoin à dater vers « Chiffre d'affaires par période », carte renommée « Vendu et reçu » : une source (`TITRE_CARTE_CA`) pour
> le titre, le sommaire et la phrase, singulier accordé ; (2) **une période déjà notée « déclarée »** gardait « dans 4 j · à payer
> 37,20 € » (37,20 € écrit 3 fois, deux « prochaines échéances » sur l'écran) : la carte ne lui donne plus ni montant ni compte à
> rebours, elle nomme la SUIVANTE (`nextUrssafDeadline` au lendemain de l'échéance faite, jours comptés depuis aujourd'hui) et dit
> « septembre : déclaration notée ✓ » ; son montant reste dans la ligne du suivi ; l'en-tête du suivi ne garde son total que sur
> plusieurs mois ; (3) **« Tes dépenses » se démontait à l'arrivée du nuage** (une dépense en cours de saisie perdait le focus et les
> touches suivantes — régression de la revue 1) : `StatutFiscal` rend six places fixes, les dépenses toujours à la 4ᵉ ; (4)
> Organisation ouverte depuis Réglages disait « GESTION » et son ancienne accroche : surtitre « Réglages », la phrase de Réglages
> sous le titre (`src/operations/description.js`, une source), roue du rail mise en avant ; (5) le banc partait de Ventes au bout
> de 3,5 s : il attend la publication du bénéfice. En plus : « Comment c'est calculé » du bénéfice replié (la couverture reste sur
> la ligne « brut »). Laissé, décision de l'autre session : « Ta micro-entreprise » s'ouvre tant que le versement libératoire n'est
> pas tranché. Preuves : `compta-simple.cjs` **164 contrôles, 25 rouges sur la branche d'avant**, 0 après ; mutation (dépenses à la
> racine + ancien nom) ⇒ 4 rouges (D et E). Aucun chiffre ne change. ⚠️ Non mesuré : sa vraie base. Geste de Julien : aucun.

> **29 octobre — cotisations dans Ma journée, déclaration de revenus, CFE, ventes Leboncoin datées à la main :**
> (2) Ma journée, sous « Reçu en {mois} » : « ≈ X € de cotisations à mettre de côté » = `aPayerUrssaf` du CA DÉCLARÉ du mois
> (`declarables`, mois de versement, une vente déclarée ailleurs exclue), « au moins » si un compte ou des ventes sans date
> manquent, rien hors micro ou sur dates illisibles (`data-cotis-mois`). Sur téléphone (où les phrases de Ma journée sont cachées
> depuis le 27 oct.) il reste visible en version courte (`.vrm-cotis-long` cachée). (5) Comptabilité → « Ta déclaration de
> revenus » (`declarationRevenus`, src/microEntreprise.js) : avant juillet l'année N-1, sinon N « en cours » ; cases VÉRIFIÉES
> sur le formulaire 2042-C-PRO 2026 — **5KO** (micro BIC achat-revente, sans versement libératoire, CA brut, abattement 71 % fait
> par les impôts) · **5TA** (avec versement libératoire) ; VL pas répondu ⇒ les deux dites, jamais devinée ; « au moins » sur une
> source pas lue ; et `rappelCfe` (1er nov.–15 déc., exonérée l'année de création). (6) Une vente Leboncoin finalisée SANS date se
> date à la main : `DaterVentesLbc` sous le CA par période (`data-dater-lbc`), `vrm_lbc_dates` (SYNC_KEYS, `{txId:'AAAA-MM-JJ'}`),
> entre 2015 et aujourd'hui ; `avecDatesLbc` l'applique aux QUATRE lecteurs (CA par période, facturation, Comptabilité —
> déclarables, rapport, vendu —, coque) ; **une date lue par l'extension gagne toujours**. (7) Banc `declare-urssaf` remis à la
> forme : sur téléphone le choix des dépenses vit dans Comptabilité (caché dans Ma journée, décision du 27 oct.) ; `vendu-recu`
> suit le retrait du masquage des ventes. Preuves : `audit-micro-entreprise.cjs` (26 ; mutations cases-devinees, annee-courante,
> case-vl rouges), banc `dater-lbc.cjs` (390/1512 ; mutations « dates ignorées » 3 rouges, « la saisie écrase l'extension » 7
> rouges), `vendu-recu` 62 verts, `declare-urssaf` vert. ⚠️ Non mesuré : sa vraie base (données inventées).

> **27 octobre (soir) — Vestiaire : publier tout seul SANS BOOSTER, et le boost lu (5.236) :** Julien :
> « je veux que ça publie tout seul sans booster » et « l'extension doit sur Vestiaire, comme pour Vinted
> et Leboncoin, capter si des annonces ont été boostées ». `vc-depot.js` `publierSansBooster` (copie des
> gardes de `lbc.js`) : feu vert `ad.publier` (posé par le fond, `msg.publier !== false`), photos
> attachées d'abord, un champ OBLIGATOIRE vide (catégorie, modèle) ⇒ attend et le NOMME, prix de la page
> = prix de VRM, options payantes (nom boost/promot/featur/sponsor/vitrine/mise en avant… ou libellé à
> prix hors livraison) décochées puis relues deux fois, bouton publier/soumettre jamais à prix, jamais
> dans la carte d'une option, un clic par onglet (`sessionStorage`), « publiée » notée SEULEMENT sur
> confirmation vue (`action: 'publiee'`, onglet du dépôt), formulaire refusé (`aria-invalid`) ⇒ clic
> rendu, 3 essais. Le boost : `vc-inject.js` lit `users/me/product-listings` (seule liste vue, vide au
> relevé du 26 : FORME JAMAIS VUE) — id, boost sur une clé dont le NOM le dit (sinon `null`, « pas
> su »), la référence `VRM-{n°}` seule ; l'id d'une annonce CRÉÉE dans l'onglet du dépôt la relie à la
> paire (`vcPublie`). Rangé dans `vc_listings` (`rangerVcAnnonces`, une écriture à la fois, lecture
> ratée ⇒ rien ; liste entière ⇒ remplace, page partielle ⇒ complète). App : « Publier sur Vestiaire »
> (`extSait('vcauto')`, 5.236), « N annonces … : X boostées (N°…) », « Déjà sur Vestiaire · boostée ».
> `audit-vc-publier.cjs` 50 (mutations : bouton à prix, décochage, obligatoires, prix, boost null ⇒ rouges).
> ⚠️ Non mesuré : le vrai formulaire et la vraie réponse de Vestiaire (bloqués d'ici).

> **26 octobre — Leboncoin relu sans geste (5.231) :** toutes les 30 min l'extension
> regarde si la page « Mes annonces » a été lue depuis 6 h ; sinon elle l'ouvre EN
> ARRIÈRE-PLAN, laisse la page faire ses lectures (captées comme d'habitude), puis
> referme l'onglet (`relireLbcEnFond`). Session VRM et compte Leboncoin déjà vu dans
> ce Chrome exigés ; déconnecté ⇒ 24 h de recul. `audit-lbc-relecture-fond.cjs`
> (rouge sur la 5.230, mutations rouges). Non mesuré : un vrai Chrome (l'onglet
> apparaît ~5-30 s dans la barre), et la page « part » pour un compte pro.

### Leboncoin : la liste vit dans le PANNEAU, et « vendue » se prouve
Demande de Julien, 12 septembre : « propose-moi les paires en ligne **en liste**,
prends le titre en l'optimisant pour Leboncoin, la description avec les photos,
**comme un pro** ; si une paire est vendue sur Vinted elle doit être enlevée de
Leboncoin, et elle garde le même numéro. » Puis : « **je veux avoir la liste sur
l'extension, pas dans l'app** » — c'est sur leboncoin.fr qu'il travaille.

**Mesuré avant de coder**, le vrai `buildLbcData()` exécuté sur la vraie base :
59 annonces en ligne, 59 numérotées, **59 dans la file**. Quatre défauts, tous
mesurés :

1. **Le titre était tronqué à la hache.** `[marque, titre].join(' ').slice(0,50)` :
   **7 titres au plafond dont 6 coupés EN PLEIN MOT** (« …tropez fringe noir
   taill »), la marque **doublée** (« Nike nike shox tl »), « taille 38,5 » au
   lieu de « T38,5 », « Chaussures style Nike sacai » (16 caractères de
   remplissage). `lbcTitre()` : **0 coupé en plein mot, 0 au plafond, 58 des 59
   améliorés**. ⚠️ Mon premier jet retirait le mot « chaussures » : il en faisait
   « **Ville** derby » et « **Bateau**/ mocassins ». Mesuré, ce mot PORTE DU SENS
   trois fois sur quatre chez lui — on ne retire que le remplissage pur
   (« chaussures **style** X ») et le doublon devant la marque.
2. **54 des 59 annonces partiraient avec UNE SEULE photo**, et rien ne le disait.
   Cause mesurée : **l'API Vinted ne renvoie AUCUNE photo** (0 sur 57 lignes
   `harvest_*_item_*`, captures jusqu'au 9 septembre) — elles ne viennent que de
   la PAGE de l'annonce, et les 93 déjà ouvertes en ont **5 en moyenne**. On ne
   peut donc pas les chercher tout seul : la liste se groupe sur **ce qu'il peut
   faire** (loi de l'écran Colis) — *aucune photo* (Leboncoin refuse) en haut,
   puis *prêtes*, puis *une seule photo* — chaque carte écrit **le chiffre** et
   donne **le lien vers l'annonce Vinted**. Le chiffre, jamais la promesse.
3. ⚠️⚠️ **« VENDUE » ÉTAIT DÉDUITE D'UNE ABSENCE.** Le panneau écrivait « N
   **vendues** sur Vinted — à retirer », en rouge, dès qu'une annonce n'était
   plus en ligne. Or elle sort aussi de la liste quand il l'a **mise en pause**.
   Mesuré : sur ses **400 annonces fermées, 151 seulement** portent une vente
   **prouvée** par identité (`transaction → item_id` : les 400 lignes
   `harvest_*_txn_*` la portent toutes). Dire « supprime-la » pour les 249 autres
   lui fait **perdre une vente sur une paire qu'il a encore**. Trois états
   désormais : **vendue (prouvée, rouge)** · **plus en ligne, à vérifier
   (ambre, aucun ordre)** · **en pause (gris, rien à faire)**. §5 mot pour mot :
   mieux vaut un blanc qu'un faux. **Le numéro, lui, ne bouge jamais** (pool
   append-only) — c'est écrit à l'écran.
4. **Une catégorie devinée fausse** : « 3 manuels première ST2S » partait en
   « Chaussures ». Leçon eBay appliquée ici.

5. ⚠️⚠️ **LE TEXTE PUBLICITAIRE DE VINTED PARTAIT COMME SA DESCRIPTION.** Mesuré
   sur ses **92 descriptions captées** : **4** sont « *Une communauté, des
   milliers de marques et de styles de seconde main. Prêt à te lancer ?
   Découvre comment ça marche !* » — la page de Vinted, pas son texte — et
   **une des quatre est en ligne**, donc elle partirait telle quelle sur
   Leboncoin comme description de SON annonce. Une autre commençait par le
   libellé « Description » collé au texte. `PAS_UNE_DESCRIPTION` les écarte **à
   la publication** ; rien n'est supprimé en base (même principe
   qu'`URL_PAS_UN_QR`). ⚠️ Et le banc vérifie **les deux sens** : une VRAIE
   description doit être gardée entière — un filtre trop large viderait ses
   annonces.
6. **Seules 6 des 59 annonces en ligne ont une description**, et 54 n'ont qu'une
   photo : **ce sont les mêmes**. Le geste est donc UN seul (ouvrir la page
   Vinted), et la carte le dit en **une ligne** — « 1 seule photo · pas de
   description » — pas deux alertes pour une cause (§7).

7. ⚠️⚠️ **LE PANNEAU DISAIT « (dont la réf VRM-401) » À CHAQUE FOIS — Y COMPRIS
   QUAND LA RÉFÉRENCE N'ÉTAIT PAS MISE.** Mesuré sur la structure que SON
   navigateur a rapportée de la vraie page de dépôt (`lbc_recon`, 2 août) :
   cette page ne porte **qu'UN seul champ** — `name="subject"`, « Que
   proposez-vous aujourd'hui ? ». Le dépôt Leboncoin est un formulaire **en
   étapes** : ni description, ni prix, ni référence n'existent à cette étape. La
   référence n'était donc **jamais** remplie, et le message affirmait le
   contraire à chaque clic. Ce n'est pas un détail : `VRM-{n°}` est ce qui relie
   l'annonce Leboncoin à la paire **sans rapprochement par titre** (§5) — sans
   elle, « vendue sur Vinted → à retirer » ne reconnaît plus l'annonce, et il
   vend la même paire deux fois. ⇒ Le message **nomme ce qui a été rempli**, dit
   quand la référence n'a pas pu l'être, et rappelle qu'elle est **dans la
   description** (`buildLbcAd` l'y met en haut et en bas). *Le chiffre, jamais
   la promesse.* **2 échecs** sur le code d'avant.
   (Au passage : son compte Leboncoin est **professionnel** — `type: business` —
   donc le champ Référence existe bien, à une étape ultérieure.)
8. ⚠️ **ET LE PRIX DE SA PAIRE ATTERRISSAIT DANS UN FILTRE DE RECHERCHE.** Le
   panneau tourne sur **toutes** les pages de Leboncoin ; une page de résultats
   porte « Prix min » / « Prix max », qui collent parfaitement à
   `/prix|price|montant/`. Prouvé au banc sur le code d'avant :
   **`price_min = 24.00`**. `PAS_UN_CHAMP_DE_DEPOT` les écarte **par ce qu'ils
   sont**, pas par l'URL — borner sur l'adresse aurait cassé le pré-remplissage
   aux étapes suivantes du dépôt, dont je ne connais pas les URL (*une nouveauté
   ne doit pas éteindre ce qui marchait*). La garde d'en-tête d'`ebay.js`
   manquait aussi ici ; elle est posée, mais **c'est une précaution, pas une
   découverte** : avec les motifs actuels la barre de recherche n'était pas
   atteignable.

9. ⚠️⚠️ **LA CAPTURE DE SES ANNONCES LEBONCOIN ÉTAIT MORTE, EN SILENCE.** Mesuré
   le 12 septembre : `lbc_listings` **et** `lbc_accounts` sont **absentes** de sa
   base, alors que `lbc_recon` (écrite par un autre chemin) existe depuis le
   2 août. Or le compte Leboncoin se lit sur **n'importe quelle** page dès que
   `__NEXT_DATA__` est là : s'il n'a jamais été écrit, c'est que cet élément
   n'existe plus — Leboncoin est passé au routeur « app » de Next, qui diffuse
   ses données dans **`self.__next_f`** au lieu de `__NEXT_DATA__`.
   ⇒ Conséquence, et c'est elle qui compte : **le « vendue sur Vinted → retire-la
   de Leboncoin » qu'il venait de demander ne pouvait pas fonctionner** (le
   rapprochement passe par la référence lue sur l'annonce Leboncoin), et le
   panneau affichait « 📊 **0** annonce sur Leboncoin » — un zéro **inventé** qui
   cachait exactement ça. C'est « rien lu ne vaut pas rien » sur cet écran.
   - `donneesNext()` essaie les **deux** formats ; `objetsDuFlux()` ne parse que
     du JSON **complet et bien fermé** — un fragment tronqué est ignoré, jamais
     deviné.
   - `lbcJamaisLu` distingue « aucune annonce » de « jamais capté » : un **tiret**
     et la raison, avec **ce que ça empêche**, jamais un zéro (§7).
   - ⚠️ **Je n'ai jamais pu voir la page** (leboncoin.fr me renvoie 403) : c'est
     donc l'extension qui mesure et qui **remonte ce qu'elle a vu**
     (`lbcDiag` → `lbc_recon.capture` : quel format porte la page, combien
     d'annonces). Même méthode que pour le formulaire eBay — faire mesurer par ce
     qui y a accès.
   - ⚠️⚠️ **ET MON DIAGNOSTIC A FAILLI CASSER LA VRAIE CAPTURE** : je l'avais
     nommé `lbcCapture`, un nom **déjà pris** par le message qui transporte les
     annonces. Le fond prenait le premier des deux handlers et **avalait la
     capture réelle**, en silence. C'est le banc qui l'a vu (champs `undefined`)
     avant que ça ne parte. *Un diagnostic ne doit jamais partager le canal de la
     donnée qu'il observe* — et le banc vérifie désormais que les **deux**
     messages partent.

10. ⚠️⚠️ **« TEXTE COPIÉ » SANS RIEN COPIER — UNE PROMESSE REJETÉE NE PASSE PAS
    PAR `catch`.** `copy()` s'écrivait `try { navigator.clipboard.writeText(t) }
    catch (_) { …repli… }` : le repli ne partait **que** si l'appel levait sur
    place. Or `writeText` échoue en rendant une **promesse rejetée** (document
    pas au premier plan, permission refusée, contexte non sécurisé) — donc rien
    n'était copié, **et le panneau annonçait quand même « copié »**. Prouvé au
    banc sur le code d'avant : le rejet ressort en `NotAllowed` (erreur de page
    non gérée) et le presse-papier reste vide. C'est la même famille que « 1
    champ pré-rempli » sur une page où rien n'a été rempli — et ça porte sur le
    texte qui contient la **référence VRM-{n°}**, le seul filet quand le
    formulaire n'a pas de champ pour elle.
11. **Le remplissage automatique s'arrêtait au bout de 90 s, en silence.** Le
    dépôt Leboncoin se fait en ÉTAPES (mesuré : la première page ne porte qu'un
    champ) ; choisir la catégorie et arriver au prix prend plus longtemps. Passé
    le délai, l'extension attendait des champs qu'elle ne surveillait plus. Le
    bandeau le DIT maintenant et renvoie sur « Re-remplir » — lequel **relance**
    la surveillance (sans ça il ne servait qu'une fois).
12. **Et « 🚀 Tout préparer » — le bouton que l'app lui dit d'utiliser — n'avait
    jamais été exécuté.** Il fait quatre choses, toutes vérifiées désormais :
    télécharger les photos dans `VRM-{n°}`, copier le texte complet **avec la
    référence**, **mémoriser la paire** (sans ça le nouvel onglet ne sait pas
    laquelle remplir) et ouvrir la page de dépôt.

13. ⚠️⚠️ **14 DES 57 ANNONCES « EN LIGNE » ÉTAIENT DÉJÀ VENDUES.** Plainte de
    Julien le 13 septembre (« des paires qui sont vendues »). Mesuré : la file
    ne filtrait que sur `is_closed`, or **Vinted ne ferme pas toujours
    l'annonce** après la vente, et une capture peut dater (`julatace3535` à
    **85 h**). La preuve de vente (`transaction → item_id`) **prime sur l'état
    de l'annonce** : une paire prouvée vendue sort de la file, dans l'app comme
    dans le panneau. Et l'écran **le dit** — une file qui rétrécit sans
    explication se lit comme une perte.
14. ⚠️⚠️ **LA CAPTURE A RANGÉ 81 ANNONCES QUI N'ÉTAIENT PAS À LUI.** Mesuré juste
    après la mise à jour : des **chalets, des gîtes, un appartement à La
    Plagne** — le flux `api/discovery/category/53` de la page qu'il regardait.
    Mon parser `__next_f` prenait tout objet en forme d'annonce sans se demander
    **à qui** il est. Le compteur aurait annoncé « 81 annonces sur Leboncoin »,
    et les 81 seraient ressorties en « non reliées ».
    ⇒ On ne garde que ce qu'on peut **attribuer** : l'annonce porte notre
    référence `VRM-{n°}`, ou son propriétaire est le compte connecté. Le reste
    est **ignoré**, pas caché. Et `lbcJamaisLu` vaut « rien vu » quand plus rien
    n'est attribuable — sinon on retombait sur le zéro inventé qu'on venait de
    retirer. *Élargir une lecture sans l'attribuer, c'est inventer des données.*
15. ⚠️⚠️ **ET LE FILTRE D'ATTRIBUTION N'AVAIT ÉTÉ POSÉ QUE CHEZ UN DES TROIS
    LECTEURS.** Mesuré le 13 septembre sur sa vraie base, l'extension à jour et
    qui tourne (`panel_diag_capture.majAt` à la minute) : `lbc_listings`
    contient bien les **81 annonces qui ne sont pas à lui**, rangées le matin
    même à 06:38 depuis `api/discovery/category/53`. Le filtre avait été mis sur
    `lbcCount`… et **seulement là**. `readLbcItems()` rendait tout, donc :
    - le **panneau** affichait « **81** vues sur Leboncoin » et déroulait
      **81 chalets** en « annonces non reliées », sur l'écran qui sert à publier
      ses baskets — pendant que l'**app** en affichait **0** (elle, filtrait).
      Deux lecteurs, deux règles, la même ligne : §11. Et c'est l'app↔extension
      qui diverge, le défaut que `audit-places.cjs` existe pour attraper.
    - ⚠️⚠️ **Et le cas qui coûte** : `adRefKeys` lit « n° 1234 » dans le TITRE de
      **n'importe quelle** annonce. Un chalet nommé « … n°412 » relie la paire
      N°412 et la **sort de sa file en silence** (« déjà en ligne sur
      Leboncoin ») — il ne la publie jamais. Mesuré aujourd'hui : **0 cas réel**,
      mais c'est un rapprochement par ressemblance (§5) sur des données qui ne
      sont **même pas les siennes**. Le banc sert exprès ce chalet-là.
    ⇒ `estALui` vit au **READ** (`readLbcItems`), pas chez un lecteur, et c'est
    **la même** que celle de l'app (`ref || customRef || lbcUser` — celle de
    l'extension oubliait `customRef`, troisième écart sur la même notion). Rien
    n'est supprimé en base. Mesuré après : **81 → 0**, et les deux écrans
    s'accordent. **4 échecs** sur le code d'avant.
    ⚠️ **QUATORZIÈME fois qu'un de mes contrôles est fautif**, et la TROISIÈME
    fois que c'est « il meurt au lieu de rapporter » : sur le code d'avant
    `estALui` n'existe pas, mon premier jet sortait en `TypeError` et le bilan
    n'était jamais imprimé.
16. ⚠️⚠️ **ET UN COMPTE QU'IL A EXCLU ALIMENTAIT ENCORE LA FILE.** Mesuré le
    13 septembre : la file du panneau contenait la **N°118, qui vient de
    `liliand653`** — le compte que Julien a lui-même mis de côté dans l'app. Le
    panneau lui proposait donc de publier sur Leboncoin l'annonce d'un compte
    qu'il a écarté. C'est § « un CHOIX n'est pas une panne » **retourné** : une
    fois le geste fait, l'app n'a plus rien à en tirer.
    ⚠️ Et ce n'était vrai que **là** : `buildEbayData` filtrait, l'**app**
    filtrait (`offAcc`) — seule la file Leboncoin du panneau ne le faisait pas.
    **L'app annonçait 39, le panneau 40**, sur exactement la même donnée (§11).
    ⇒ Mesuré après : **40 → 39**, et le panneau **le dit** en gris et sans
    consigne (« son compte Vinted est exclu de l'app — ton choix »), parce
    qu'une file qui rétrécit sans explication se lit comme une perte.
    **2 échecs** sur le code d'avant.
    ⚠️ **Mesuré au passage, et laissé tel quel** : une paire de la file (**N°30**)
    vient de `3170782324`, un identifiant de moisson qui **n'a plus de compte
    dans VRM**, dernière capture il y a **33 jours**. L'app et le panneau la
    gardent **tous les deux** — donc aucune divergence à corriger, et je
    n'invente pas une troisième règle sans qu'il ait tranché. À lui de dire.
17. **« Des photos qui n'apparaissent pas »** — et je n'ai pas pu trancher :
    Vinted **bloque mes requêtes** (même page de blocage pour deux annonces
    différentes), et l'URL d'une photo ne porte qu'une signature `?s=…`, **sans
    date d'expiration lisible**. Plutôt que de deviner, **la carte le constate
    elle-même** : si l'image ne charge pas, une note apparaît (« le lien Vinted
    a expiré ») avec la porte — rouvrir l'annonce recapte des liens frais. C'est
    la méthode du bandeau eBay appliquée à ce que je ne peux pas mesurer.

⚠️⚠️ **ET `lbc.js` N'AVAIT JAMAIS TOURNÉ** — 480 lignes, le panneau qui SERT à
publier. `node --check` ne lit que la syntaxe. `scripts/bancs/leboncoin.cjs` le
charge dans une fausse page avec un faux `chrome.runtime` : **18 contrôles, 10
échecs sur le code d'avant**. Le plus parlant : « la consigne *supprime-la* est
rendue **3 fois pour 1 vente prouvée** ».
- ⚠️ **Neuvième ET dixième fois qu'un de mes contrôles crie au loup**, et le
  second est le plus instructif. Jet 1 : « le mot *vendue* est interdit dans le
  groupe du doute » → il attrapait « je n'ai pas la preuve qu'elles sont
  **vendues** ». Jet 2 : « le mot *supprime* est interdit » → il attrapait « je
  ne te dis pas de les **supprimer** », c'est-à-dire la NÉGATION de ce qu'il
  traque. ⇒ Ce qui est interdit n'est pas un mot mais une **instruction**, et une
  instruction **se compte** : « supprime-la » ne doit être rendu qu'autant de
  fois qu'il y a de ventes prouvées. *La donnée déclenche, jamais la
  formulation.*
- ⚠️ `EXT_CAPACITES.lbctitre = '5.55.4'` : c'est l'EXTENSION qui publie, avec SA
  version de la règle. Sans cette garde, l'app dirait « le titre exactement tel
  qu'il partira » à une extension qui enverra l'ancien — le défaut le plus
  coûteux du projet, pour la **cinquième** fois.
- ⚠️ **Et les bancs de rendu dépendaient du CDN de Vinted sans le dire** : aucun
  n'interceptait les images. Tant que l'écran rendu n'en avait pas, ça ne se
  voyait pas ; le jour où la liste a eu ses vignettes, `verif_dark` est mort sur
  « page.screenshot: Timeout 30000ms exceeded ». Ce n'était pas un défaut de
  l'app — le banc était à un hoquet de réseau de tomber, depuis toujours. Les
  images externes sont coupées : c'est du déterminisme, pas un moyen de cacher
  une image cassée.
- `audit-places.cjs` ne compare plus l'existence des règles mais **leurs
  sorties** : l'app et l'extension doivent rendre **le même titre** sur les mêmes
  entrées (8 cas réels). Sans ça l'app en montre un et l'extension en publie un
  autre. **7 échecs** sur le code d'avant.


### ⚠️⚠️ ET L'ÉCRAN LEBONCOIN NE CONNAISSAIT QUE DEUX ÉTATS SUR TROIS
Vu **au rendu, sur ses vraies données**, le 15 septembre. Sa phrase
d'introduction s'écrivait `extSait('photoslbc')==='ok' ? A : B` — **deux** états
pour une fonction qui en rend **trois**. Le troisième est celui de son
**iPhone** : `absente`. L'écran lui annonçait donc « photos téléchargées dans un
dossier » — la description d'un comportement **qui ne peut pas avoir lieu**
(sans extension, rien n'est ni téléchargé ni attaché) — au lieu du vrai geste :
ouvrir l'app sur l'ordinateur où elle est installée.
C'est le trou du premier jet d'`extSaitLireCodes` (« l'extension la plus en
retard était la seule à ne rien déclencher »), et **l'écran Annonces, lui,
traitait déjà les trois** : le correctif n'avait été appliqué qu'à un des deux
endroits. *Une suppression « terminée » se vérifie sur ce qui RESTE.*
⚠️ **ON NE JUGE PAS SUR UN MOT** — interdire « télécharg » attraperait la phrase
honnête (onzième piège de ce genre). Le banc `capacites.cjs` rend l'écran dans
les **trois** états et exige **trois phrases différentes** : deux états qui se
ressemblent, c'est un état oublié. **3 échecs** sur le code d'avant, dont
« absente » et « en retard » à **100 % de recouvrement** — mot pour mot la même
phrase de 172 caractères.
⚠️ **DIX-NEUVIÈME FOIS QU'UN DE MES CONTRÔLES CRIE AU LOUP** : le seuil de §7
(60 caractères communs) ne s'applique pas tel quel ici — la phrase a **trois
morceaux** (la file · où ça se passe · les photos) et les deux premiers sont
**légitimement** communs aux trois états. On mesure le recouvrement **relatif** :
mesuré 13 % · 51 % · 13 % après, contre **100 %** sur le défaut.


### ⚠️⚠️ LES ÉTAPES DU DÉPÔT LEBONCOIN NE POUVAIENT PAS ÊTRE ENREGISTRÉES
Le dossier dit depuis deux passes : « *l'extension enregistre désormais chaque
étape distincte (`lbc_recon.etapes`)… un seul dépôt fait à la main suffit à me
donner la carte complète* ». **Mesuré le 16 septembre, et c'était une promesse
qu'aucun code ne pouvait tenir.**
`captureDepositForm()` ne tourne que dans `load()` — au démarrage, au retour sur
l'onglet, et **quand `location.href` CHANGE**. Or le dépôt Leboncoin est un
**assistant** : il remplace l'étape **sur place**, sans toucher à l'adresse. Les
étapes 2, 3, 4… étaient donc **invisibles** — exactement ce pour quoi ce code
existe. Les deux moitiés étaient là (`lbc.js` envoie `etape`, le fond range par
signature) ; c'est le **déclencheur** qui regardait la mauvaise chose.
⇒ On observe le **FORMULAIRE**, pas l'URL (`MutationObserver`, une capture par
seconde au plus, **12 étapes** au maximum, et uniquement sur une page de dépôt).
La signature dédoublonne déjà : réobserver ne coûte rien, **manquer une étape**
coûte la carte entière.
- ⚠️ **C'est une chance UNIQUE** : `lbc_recon.etapes` est absente de sa base. Le
  jour où il fait un dépôt à la main avec une extension à jour, soit
  l'enregistreur marche et j'ai enfin où vivent la catégorie, l'état et le champ
  photo — soit il ne marche pas, et on ne le saura qu'après. §4.10 : **ce code
  n'avait jamais tourné**.
- Le banc simule l'étape suivante **sans changer d'adresse** et exige : deux
  étapes enregistrées, **deux signatures distinctes** (la suivante n'écrase pas
  la précédente), et que l'étape rapporte **les listes déroulantes ET le champ
  photo**. **2 rouges** sur le code d'avant — dont « 0 liste, 0 champ fichier ».
- ⚠️ **Et la promesse de confidentialité n'avait jamais été vérifiée** : le code
  dit « noms de champs et libellés d'options uniquement, **aucun contenu
  saisi** ». Le banc tape une valeur dans un champ et exige qu'elle **ne parte
  pas** avec la structure.
- **Mesuré au passage, et ce n'était PAS un défaut** : le libellé de la page de
  dépôt a changé (« Que proposez-vous aujourd'hui ? » → « **Quel est le titre de
  l'annonce ?** », relevé du 13 septembre dans `lbc_recon.form`). `findField`
  cherche aussi `subject` et `titre` : le titre se remplit toujours. *Avant de
  « corriger », vérifier que c'est cassé.*
- Extension en **5.66.0**, zip régénéré, `EXT_ATTENDUE` suivie.


### ⚠️⚠️⚠️ LE DÉPÔT A ÉTÉ FAIT, ET `storeLbcRecon` JETAIT L'ÉTAPE EN SILENCE
Julien a fait son dépôt Leboncoin à la main le 17 septembre. **Mesuré tout de
suite** : `lbc_recon.form` écrit à **12:18:55 avec 3 champs** — donc
`captureDepositForm` a bel et bien tourné et le handler a bel et bien construit
`etapes` — et **`etapes` toujours absente de la base**.
Cause : `storeLbcRecon` rangeait **clé par clé** (`paths`, `sample`, `quota`,
`form`, `url`) et n'avait **aucune ligne** pour `patch.etapes` ni
`patch.capture`. Les deux moitiés existaient, le raccord manquait — le motif du
tiroir `Nav` (§4.11), sur la donnée attendue depuis trois passes. **Il a fait ce
dépôt pour rien, et c'était de mon fait.**
⚠️ Et ça **réécrit l'histoire de `lbcDiag`** : §8 disait « il n'a jamais tourné » ;
en réalité c'est son **rangement** qui le jetait. *Avant de conclure qu'un code
n'a jamais tourné, vérifier que ce qu'il produit est bien RANGÉ.*
⇒ On ne range plus clé par clé : tout ce qu'un appelant envoie est gardé.
⚠️⚠️ **ET AUCUN BANC NE POUVAIT LE VOIR** : `bancs/leboncoin.cjs` vérifie ce que
`lbc.js` **ENVOIE** (`window.__formes`) — il s'arrête à la frontière. Le
rangement, personne ne le mesurait. *Un contrôle qui s'arrête au message prouve
le message, jamais la donnée.* `audit-lbc-catalogue.cjs` va jusqu'à
l'**ÉCRITURE** et porte la règle sur **toutes** les clés : sur le code d'avant
il nomme les deux perdues, « etapes, capture ».


### ⚠️ ET LE CATALOGUE EST PLUS GROS QUE MON PLAFOND
Bonne nouvelle de la même mesure : **`lbc_catalogue` EXISTE**, écrite par la
nouvelle extension. Mais `fdata` est arrivé **coupé à 400 000** — le drapeau
`coupe` a fait son travail. Plafond porté à **3 000 000** ; la ligne n'est
réécrite que si le corps change, donc ça ne coûte qu'une fois. `fforms` n'est
toujours pas arrivé.


### ⚠️⚠️ LE PRIX PARTAIT À 0,54 € — LE CHAMP LEBONCOIN EST EN CENTIMES
Julien a fait ses dépôts le 17 septembre, et la **carte du formulaire est enfin
arrivée** (`lbc_recon.etapes`). Mesuré le 19 septembre — l'étape cœur porte
`subject` (titre), **`body`** (description), **`price_cents`** (prix), `location`.
Le nom le dit : ce champ attend des **CENTIMES**. Or `lbc.js` y posait `ad.price`
tel quel (« 54 ») → Leboncoin affichait **0,54 €** sur son annonce. Le titre et
la description, eux, tombaient juste (`subject`/`body` matchent les motifs).
⇒ `poserPrix(euros, siVide)` LIT l'unité **dans le nom du champ** : si le nom
contient « cent », il pose l'entier en centimes (`Math.round(n*100)`), sinon les
euros. On ne devine pas — on lit ce que le champ déclare.
⚠️ **Le prix se remplissait à TROIS endroits** (`prefill`, `fillNow` la
surveillance, `fillNowForce` le « Re-remplir »), chacun avec le même défaut :
§11, une notion une règle. Les trois passent désormais par `poserPrix`.
- `scripts/bancs/leboncoin.cjs` sert maintenant la **vraie forme** du champ
  (`name="price_cents"`, §6.3) et exige `99,00 € → 9900`. **Rouge** sur le code
  d'avant (« price_cents = 99.00 »), vert après.
- **Aucune entrée d'`EXT_CAPACITES`** : c'est une correction. Extension en
  **5.82.0**, zip régénéré, `EXT_ATTENDUE` suivie.
- ⚠️ **Ce qui manque encore** : les champs `:form-field-_r_XX_` de l'étape
  catégorie/attributs n'ont **pas de libellé** dans la carte captée (l'extension
  d'alors ne relevait pas les `listes` de ces étapes). `fforms` (52 Ko) et
  `fdata` (682 Ko) sont arrivés **entiers** dans `lbc_catalogue` : c'est de là
  que sortira le mapping catégorie→code. **Rien n'est analysé pour l'instant** —
  on branche à la prochaine passe, pas avant d'avoir relié un `_r_XX_` à son
  libellé.


### ⚠️⚠️ REMESURÉ LE 19 SEPTEMBRE (plus tard) : LE PONT `_r_XX_` → LIBELLÉ EXISTE, ET `choisirListe` EST MORT SUR LE VRAI FORMULAIRE
Le point ci-dessus (« les `_r_XX_` n'ont pas de libellé ») **est périmé** — mesuré
sur sa vraie base ce soir. L'étape attributs de `lbc_recon.etapes` (captée le
17 septembre par une **5.75.0**, donc déjà présente quand j'écrivais le contraire)
porte pour ses **six** champs le libellé **ET** la liste d'options :
| champ (`_r_XX_`) | libellé | options captées |
|---|---|---|
| `_r_15_` | **Univers*** | Femme · Homme · Enfant |
| `_r_1e_` | **Type de chaussures** | Baskets & Sneakers · Mocassins · Bottines… (13) |
| `_r_21_` | **Pointure*** | 16 · 16,5 · … (25) |
| `_r_4c_` | **Marque** | A Bathing Ape · … · Adidas… (**11 — liste filtrée**, pas exhaustive) |
| `_r_4i_` | **Couleur** | Blanc · Bleu / Ciel · Gris / Anthracite… (21) |
| `_r_5d_` | **État** | Neuf avec étiquette · Très bon état · Bon état · État satisfaisant (5) |
- ⚠️⚠️ **ET `choisirListe` NE REMPLIT RIEN SUR CETTE ÉTAPE.** Les six champs sont
  **`tag:"input"` / `forme:"composant"`** — des listes React, **zéro `<select>`
  natif**. Or `choisirListe` fait `document.querySelectorAll('select')` : il
  trouve **0 élément** et remplit donc **0 attribut**. C'est mot pour mot
  « ça ne met pas la catégorie ni le reste » (13 sept.). Le bloc ci-dessus qui
  affirme « la catégorie et l'état sont choisis / les listes ne sont pas des
  `input` » **décrit une réalité qui n'existe pas sur son formulaire** — le
  bandeau, lui, reste honnête (il compte `n`, et `n` n'inclut jamais ces
  champs). *Une suppression « terminée » se vérifie sur ce qui RESTE* :
  `choisirListe` **reste** (une autre étape/variante peut porter un vrai
  `<select>`, §4.11), mais il ne faut pas croire qu'il fait ce travail.
- ⚠️⚠️ **CE QU'ON NE PEUT PAS FAIRE AUJOURD'HUI, ET POURQUOI** : la valeur
  **soumise** par Leboncoin est un **CODE** (`{value,label}`, `fforms`/`fdata`),
  pas le libellé. Poser le texte « Nike » dans un composant React ne pose **pas**
  le code — au mieux rien ne s'enregistre, au pire l'annonce part avec un
  attribut cassé. Écrire un remplisseur de combobox **avant** d'avoir relié
  chaque option à son code serait le défaut le plus coûteux du projet. `fforms`
  (**61 798 car.**) et `fdata` (**808 878 car.**) sont **entiers** dans
  `lbc_catalogue` (`coupe:false`) : la matière du mapping est là, **rien n'est
  encore analysé**. **Ne pas écrire le clic « Publier ».**
- **Ce qui sera mappable avec CERTITUDE** quand on branchera : **Pointure**
  (← `ad.taille`) et **État** (← condition, libellés exacts ci-dessus). **Marque**
  est une liste **filtrée** (11 options = résultats de recherche, pas le
  catalogue) → passe par le code, pas par le libellé. **Univers / Type / Couleur**
  ne se **devinent pas** depuis ses données (*mieux vaut un blanc qu'un faux*) —
  laissés vides, il les choisit.
- **Son extension installée est en `5.80.0`** (`panel_diag_capture.ver`, verAt
  19 sept.) — **derrière la 5.82.0 livrée**. Le correctif du prix en centimes
  (5.82) et l'exclusion des comptes supprimés (5.81) **ne tournent pas encore
  chez lui** ; l'app le dit déjà (diagnostic de version). *Le premier geste
  reste : remplacer le dossier de l'extension par le zip livré.*


### ⚠️⚠️ « FAIS-LE TOUT SEUL » — LE MAPPING EST FAIT, LE CODE DE CHAQUE OPTION MANQUAIT
Julien, 19 sept. (plus tard) : « tu peux faire ça tout seul ». J'ai donc analysé
`fforms`/`fdata` (entiers dans `lbc_catalogue`) pour relier chaque attribut du
dépôt à son **code** — le mapping que le dossier diffère depuis des passes.
**Mesuré, et deux choses ont tranché :**
- ⚠️ **`fforms` capté = `searchAd` UNIQUEMENT** — le formulaire de **RECHERCHE**,
  pas de dépôt. Le dossier supposait « les formulaires par catégorie » : faux
  sur la mesure. La liaison champ→feature ne vient donc pas de `fforms`.
- ✅ **Mais `fdata.features` la donne, par IDENTITÉ D'ENSEMBLE** (§5, jamais par
  ressemblance de libellé — plusieurs features s'appellent « État »/« Marque »).
  Chacun des six champs captés matche **un seul** feature dont l'ensemble
  d'options est identique (ou sur-ensemble pour les listes filtrées) :
  | champ dépôt | feature `fdata` | jointure |
  |---|---|---|
  | Univers* | `shoe_type` (1=Femme·2=Homme·3=Enfant) | ensemble identique |
  | Type de chaussures | `shoe_category_a` | ensemble identique |
  | Pointure* | `shoe_size` | sur-ensemble (liste captée partielle) |
  | Marque | `shoe_brand_a` | sur-ensemble (liste **filtrée** à la frappe) |
  | Couleur | `clothing_color_a` | ensemble identique |
  | État | `clothing_condition_a` (5=Neuf ét.·4·3=TBÉ·2·1) | ensemble identique |
- ⚠️⚠️ **CE QUI RESTAIT NON MESURABLE, ET POURQUOI JE N'AI PAS ÉCRIT LE REMPLISSAGE** :
  Leboncoin **soumet un code**, pas le libellé ; et les six listes sont des
  **composants React**, dont je n'ai **jamais vu** le DOM de sélection (comment
  la liste s'ouvre, où vit le code). Écrire un remplisseur de combobox sur cette
  base serait deviner — et un banc qui sert un faux composant mesure une fiction
  (§6.3). Un mauvais attribut sur une annonce **publiée** est le coût le plus
  élevé (leçon eBay). **Ne pas écrire le remplissage ni le clic « Publier » tant
  que le code réel n'est pas mesuré sur SA page.**
- ⇒ **Ce qui EST livré (mesuré, lecture seule, sans risque)** : la capture des
  étapes relève désormais, pour chaque option de composant, son **code réel**
  (`optcodes` : `{t: libellé, v: value/data-value/data-qa-id/id}`) + `role` et
  `controls` du contrôle. Le jour où sa **5.83** passe sur une page de dépôt,
  j'ai enfin le code de SA page — la jointure `fdata` n'est qu'un filet, pas une
  supposition. `bancs/leboncoin.cjs` sert une option `data-value="3"` et exige
  que `optcodes` la relève (`Très bon état=3`), et vérifie toujours qu'**aucune
  valeur saisie ne fuit**. Extension en **5.83.0**, zip régénéré, `EXT_ATTENDUE`
  suivie. **Aucune entrée d'`EXT_CAPACITES`** : c'est une mesure, l'app ne promet
  rien de neuf.
- **La passe suivante remplira Pointure + État** (code-certains **et**
  valeur-connue : `ad.taille`, condition), en visant le code relevé, prouvé au
  banc sur la vraie forme. **Univers/Type/Couleur restent vides** — leur valeur
  ne se devine pas depuis ses données (*mieux vaut un blanc qu'un faux*), même si
  leur code est connu. **Marque** : liste filtrée → passe par le code, jamais le
  libellé.


### ⚠️⚠️ LEBONCOIN ÉCRIT PARFOIS LA DESCRIPTION LUI-MÊME — ET LA RÉFÉRENCE DISPARAISSAIT
Julien, 19 sept. : « parfois la description et certaines choses sont faites
automatiquement par le bon coin, adapte l'extension ». **Mesuré dans le code**,
et il y avait un défaut des DEUX côtés :
- `fillNow` (surveillance auto) remplissait la description en `setIfEmpty` — donc
  quand Leboncoin l'avait **déjà écrite**, l'extension la respectait (bien) **mais
  la référence `VRM-{n°}` n'y entrait JAMAIS**. Or c'est elle qui relie l'annonce
  à la paire sans rapprochement par titre (§5) : sans elle, « vendue sur Vinted →
  retire-la de Leboncoin » ne reconnaît plus l'annonce, et il la republie ou vend
  deux fois. **La réf disparaissait en silence.**
- `prefill` (« ✍️ Pré-remplir ») et `fillNowForce` (« Re-remplir ») faisaient
  l'inverse : `setField` **écrasait** la description que Leboncoin venait
  d'écrire.
⇒ `poserDescription(ad)` porte la règle pour les trois chemins (§11) : champ vide
  → description complète ; champ **déjà rempli** (Leboncoin ou lui) → on **garde**
  son texte et on **ajoute la référence à la fin, une seule fois** (jamais un
  doublon, garde par regex sur `VRM-{n°}`). On n'écrase plus jamais une
  description. Le bandeau le dit (« ta référence ajoutée à la description que
  Leboncoin a déjà écrite »).
- ⚠️ **On ne devine pas « certaines choses »** : la capture des étapes note
  désormais, par champ, `rempli` (booléen) et `len` (longueur) — **jamais le
  contenu** — pour MESURER ce que Leboncoin auto-remplit vraiment et adapter le
  reste à la prochaine passe, sur mesure et pas sur une supposition.
- `bancs/leboncoin.cjs` pré-remplit la description **avant** que l'extension
  tourne (comme le ferait Leboncoin), sans référence, et exige les deux : le
  texte de Leboncoin **gardé** ET `VRM-401` **ajoutée**. Prouvé rouge sur le code
  d'avant (« la réf a disparu »). **Aucune entrée d'`EXT_CAPACITES`** (l'app ne
  promet rien de neuf) ; extension en **5.84.0**, zip régénéré, `EXT_ATTENDUE`
  suivie.


### ⚠️⚠️ « UNE SEULE PHOTO SE TÉLÉVERSE » — L'UPLOADER LEBONCOIN LES PREND UNE PAR UNE
Julien, 19 sept. (dépôt simulé) : « il n'y a qu'une seule photo qui se téléverse,
il faut qu'elles y soient toutes, tout seul ». **Cause** : `attacherPhotos` posait
**toutes** les photos d'un coup (`input.files = dt.files` avec N fichiers). Or
l'uploader de Leboncoin lit **une** photo par `change`, ajoute sa vignette, puis
**remonte le champ** — un envoi groupé n'y dépose donc qu'**une** vignette.
⇒ Nouvelle stratégie, **débrouillarde** (résiste à un changement de Leboncoin) :
- champ **`multiple`** → on pose tout d'un coup (l'API standard) ;
- sinon → **une par une**, en **re-cherchant le champ** à chaque fois et en
  **comptant les vignettes d'aperçu** (`img[src^="blob:"]`) pour savoir combien
  Leboncoin a réellement acceptées — on avance jusqu'à atteindre notre nombre,
  avec repli **glisser-déposer** si le champ disparaît. S'arrête sur absence de
  progrès (pas de boucle infinie).
- La capture note désormais `multiple`/`accept` du champ fichier + `fichiersMultiple`
  de l'étape : on ne devine plus, on mesure.
- `bancs/leboncoin.cjs` sert l'uploader qui **ne prend qu'une photo** (non
  `multiple`, lit `files[0]`, se vide) : **§6.1 — un envoi groupé n'y dépose
  qu'1 vignette (le défaut) ; l'extension en dépose 3** (une par une). Le champ
  `multiple` (etape2) garde l'envoi groupé.
- Extension en **5.91.0**, zip régénéré, `EXT_ATTENDUE` suivie. Aucune entrée
  d'`EXT_CAPACITES` (correction de fiabilité).
- ⚠️ **« Juste un bouton et ça se poste » — toujours PAS le clic « Publier ».**
  L'arbre catégorie (Mode > Chaussures) et le clic final restent à lui tant que
  je n'ai pas capté l'étape catégorie sur un dépôt complet (le sien s'est arrêté
  avant). Photos + titre + description + prix + pointure + état sont automatiques ;
  publier reste un geste humain (aucune publication à l'aveugle, §5/§3).


### ⚠️ « DIS-MOI QUAND TOUTE L'ANNONCE EST CAPTÉE → PRÊTE POUR LEBONCOIN »
Demande de Julien, 19 sept. : « j'aimerais que ça me dise quand ça capture toute
l'annonce sur Vinted, pour qu'après ça puisse me dire s'il est en capacité de la
mettre sur Leboncoin. »
**Le signal existe grâce à `nPhotos`** (le compte RÉEL de Vinted, mesuré 7-16 par
annonce) : on le compare aux photos **captées** de la page
(`vinted_item_details[id].photos.length`, exposé à l'app par `fetchDescLens` qui
rend désormais `{len, ph}` au lieu d'une simple longueur).
- Par paire (carte Annonces) : **✓ prête pour Leboncoin** (numérotée + toutes ses
  photos captées + une description) · **📷 X/Y photos — rouvre-la sur Vinted** ·
  **à capter — ouvre-la sur Vinted** · **description à capter**. Le CHIFFRE,
  jamais la promesse ; un total inconnu (`photoCount` absent) ne se juge pas (§5).
- Dans le bandeau : « **N à recapturer pour Leboncoin** » (ambre) / « ✓ N prêtes »,
  compté dans `annStats` — **même base que la grille** (§11), jamais un second
  calcul.
- ⚠️ **Ça éclaire le vrai état AUJOURD'HUI** : tant que la 5.87 (capture des
  photos lazy) n'est pas installée et les annonces rouvertes, presque tout est
  « à recapturer » (≤ 6 captées sur ~12 réelles). C'est honnête et actionnable :
  ça lui dit exactement quoi rouvrir.


### ⚠️⚠️ « OÙ EST LA PAIRE : VINTED / LEBONCOIN / QUEL COMPTE » — MESURÉ IMPOSSIBLE AUJOURD'HUI
Demande de Julien, 19 sept. : « dans VRM, dis-moi précisément si la paire est
postée sur Leboncoin, sur quel compte (j'aurai sûrement plusieurs comptes
Leboncoin) ; et vendue sur Vinted → dis-moi de la retirer de Leboncoin, et
inversement. »
**Mesuré sur sa vraie base, et c'est le point de départ honnête** :
- `lbc_listings.items` = **140 annonces qui ne sont PAS les siennes** (le flux
  « découverte » : chalets, locations), **0 avec une réf VRM**, **0 avec un champ
  compte**. `lbc_accounts` est **vide**.
- Le parseur (`handleLbcRaw`) extrait `id, ref, url, status, subject, price,
  images` — mais **aucun owner/compte**, et ses PROPRES annonces (particulier) ne
  sont pas encore captées avec leur `VRM-{n°}`.
⇒ Donc « sur quel compte » et « vendue ici → retire là » **ne peuvent pas être
rendus honnêtement aujourd'hui** : il n'y a ni compte capté, ni lien
paire↔annonce Leboncoin. Les afficher serait promettre ce qu'on ne peut pas
tenir (le défaut le plus coûteux du projet). *Le lien qui survit à plusieurs
comptes Leboncoin est la référence `VRM-{n°}` (déjà mise dans la description au
dépôt) + le compte connecté, à capter.*
⚠️ **CE QU'IL FAUT POUR DÉBLOQUER, et je ne peux pas le faire seul** : Leboncoin
me renvoie **403** — je ne vois pas la page « mes annonces » du compte
particulier ni où vit l'id de compte. Il faut : (1) qu'il **poste une vraie
annonce** et rouvre « mes annonces » sur Leboncoin avec l'extension à jour, pour
que ses ads soient captées avec leur `VRM-{n°}` **et** taguées du compte
connecté ; (2) que je voie la **forme** de cette réponse (recon). Alors seulement
je câble le « où / quel compte » et le « vendue ici → retire là » (les deux sens,
`status` active/inactive existe déjà), prouvé sur des données réelles. *Ne pas
écrire ce lien à l'aveugle.*


### ✅ LE DÉPÔT DU 17 SEPT. A ÉTÉ CAPTÉ — `optcodes` RÉELS, ET LEBONCOIN AUTO-REMPLIT 4/6 ATTRIBUTS
Mesuré sur sa vraie base après son dépôt manuel (extension à jour) : la capture
des étapes remonte enfin, pour chaque champ composant, son **code DOM réel**
(`optcodes: {t:libellé, v:value/data-value/data-qa-id/id}`) — plus une
supposition, la valeur qui part vraiment. Et **Leboncoin remplit lui-même** 4 des
6 attributs (Univers, Type, Pointure, Marque `rempli:true`), laissant **Couleur
et État** vides.
⇒ Ça débloque une passe FUTURE de remplissage d'attributs (Pointure ← `ad.taille`,
État ← condition) **visant le code relevé**, prouvée au banc sur la vraie forme —
**pas maintenant** : tant qu'un banc ne prouve pas le remplissage sur les codes
réels captés, écrire le remplisseur de combobox serait deviner (§6.3), et un
mauvais attribut sur une annonce **publiée** est le coût le plus élevé (leçon
eBay). **Univers/Type/Couleur restent vides** — leur valeur ne se devine pas
depuis ses données (*mieux vaut un blanc qu'un faux*). **Ne pas écrire le clic
« Publier ».**


### ⚠️⚠️ « QU'IL N'Y AIT PLUS D'ERREUR / QUAND JE VENDS ÇA SE SUPPRIME / BORDEREAUX LEBONCOIN » — CE QUI EST DÉJÀ FAIT, ET CE QUI ATTEND SA DONNÉE
Demande de Julien, 20 sept. : « une fois qu'une paire est rentrée dans
l'écosystème, plus d'erreur possible ; **quand je fais une vente que ça supprime
tout seul** ; et vois pour la **génération de bordereaux sur le bon coin** —
capter les bordereaux déjà dans l'app, et en générer comme sur Vinted. Je te
laisse te débrouiller **en attendant que je puisse mettre l'extension.** »

**Mesuré d'abord (§6), et le point de départ honnête** : sa base porte, côté
Leboncoin, seulement `lbc_accounts` · `lbc_catalogue` · `lbc_listings` ·
`lbc_recon` — **aucune vente, aucun bordereau, aucune commande** Leboncoin. Et
`lbc_listings` = **182 annonces qui ne sont PAS les siennes** (le flux
« découverte »), **1 seule** portant une réf `VRM-{n°}`. Leboncoin me renvoie
**403** : je ne vois ni sa page « mes annonces », ni sa messagerie, ni un
bordereau LBC.

**1. « Quand je vends → ça se supprime tout seul » : DÉJÀ FAIT, côté app, et
mesuré live.** `annBase` (App.jsx, la base de l'écran Annonces, des pastilles
« prête pour Leboncoin », de la numérotation) **exclut les paires prouvées
vendues** par `annoncesVendues` — `identiteAnnonce(o)` (jamais le titre, §5),
vente de **≤ 60 j**, `classifyOrderStatus !== 'cancelled'` (un retour/remboursement
la fait revenir). La paire disparaît de l'app **dès que la vente est captée**. Et
la **file Leboncoin** (comme eBay) écarte déjà les paires prouvées vendues
(`lireVentesProuvees`, qui **porte son échec** : « rien lu » ne vide pas la file).
⇒ Tout ce qui est faisable **sans donnée Leboncoin** pour « vendu → retiré » est
en place. Ne pas ré-écrire une seconde règle.

**2. « Retirer l'annonce Leboncoin *elle-même* quand la paire se vend » : BLOQUÉ
sur le lien paire ↔ annonce LBC, pas sur le code.** Ce lien est la réf
`VRM-{n°}` lue **sur l'annonce Leboncoin** + le compte connecté — et cette donnée
n'existe pas encore (`lbc_listings` ne contient pas ses annonces à lui avec leur
réf). L'afficher aujourd'hui serait promettre ce qu'on ne peut pas tenir (le
défaut le plus coûteux du projet). *Ne pas l'écrire à l'aveugle.*

**3. « Générer / capter des bordereaux Leboncoin comme sur Vinted » : BLOQUÉ sur
la MÊME absence, et VRM ne *génère* rien — il *capte*.** Sur Vinted, VRM ne crée
pas le bordereau : Vinted l'émet après la vente, l'extension en capte le **PDF**
(`label_latest.pdfB64`), l'app affiche « prêt à imprimer ». Le pendant Leboncoin
serait identique — capter le PDF du bordereau que **Leboncoin** émet dans la
messagerie/le colis après une vente. Il faut donc d'abord **voir la forme** d'une
vente LBC et de son bordereau. Écrire un analyseur de bordereau LBC sans avoir vu
un seul email/réponse serait deviner (§4.10, §6.3).

**⇒ CE QUI DÉBLOQUE TOUT est UNE seule chose, et l'infra de collecte existe
DÉJÀ** (rien à coder ici — vérifié en relisant `lbc-inject.js`) : dès qu'il
**charge l'extension à jour** et **fait/regarde une vente sur Leboncoin**,
`lbc-inject` remonte automatiquement — `lbc_recon.paths` (tous les chemins vus,
ids → `{id}`), `lbcenvoi` (toute écriture POST/PUT/PATCH/DELETE, **chemins de
clés et types uniquement, jamais les valeurs**), et les réponses `annonces` /
`compte` (`lbcraw`). C'est exactement comme ça que le `PUT …/shipment/order` de
Vinted a été trouvé. **La prochaine passe, sur données réelles**, câble alors :
le lien paire ↔ annonce LBC (réf + compte), le « vendue ici → retire là » (les
deux sens — `status` active/inactive existe déjà dans `handleLbcRaw`), et la
capture du bordereau LBC. **On collecte, on vérifie, PUIS on promet** — pas
avant, et surtout pas depuis une donnée qui n'est même pas la sienne.

⚠️ **Il « ne peut pas encore charger l'extension »** : donc aucune version neuve
ne l'aide tant qu'il ne l'a pas installée, et l'app le dit déjà (diagnostic de
version, `EXT_ATTENDUE`). Le premier geste reste **remplacer le dossier de
l'extension par le zip livré** — c'est lui qui débloque la mesure, donc tout le
reste. Aucune raison de bumper la version ni de régénérer le zip pour cette
passe : rien n'a changé dans `vinted-sync-extension/`, c'est un constat, pas une
promesse neuve.


### ⚠️⚠️ « IL N'Y A QUE LA PHOTO DE COUVERTURE » — LE VRAI UPLOADER LEBONCOIN, ENFIN MESURÉ
Julien, 20 sept. (le dépôt va jusqu'au bout, sauf ça) : « il y a juste la photo
de couverture ». **Mesuré sur sa vraie base** (installé : **5.91**,
`panel_diag_capture.ver`) : le champ photo de l'étape dépôt (`lbc_recon.etapes`)
est **`multiple:true`** (`accept image/*,.heic,…`). Or seule 1 photo arrivait.
- L'ancien `attacherPhotos` avait deux voies : champ `multiple` → **envoi groupé**
  (`input.files = tous`) ; sinon → une par une. Le vrai uploader Leboncoin est
  `multiple` **mais** lit **UNE** photo par `change`, l'envoie au serveur, affiche
  la vignette **renvoyée (URL http)** et **vide** le champ. L'envoi groupé n'y
  dépose donc que la **couverture**.
- Pire, la voie groupée **se croyait finie** : elle comptait les vignettes
  `blob:`/`data:` (`apercusPhotos`) — or Leboncoin les rend en **http**, donc le
  compteur valait **0**, et le code retournait « tout attaché » (n = total). Le
  faux-vert classique (§ « vert sur le défaut »), et le bandeau annonçait « 3
  photos attachées » alors qu'il y en avait 1.
⇒ **Le signal fiable n'est PAS l'attribut `multiple`** — c'est de savoir si le
champ **GARDE** le fichier qu'on vient d'y poser. On pose la **1re** photo, puis :
  · le champ la garde (`input.files` rempli) → **champ contrôlé** → on pose tout
    d'un coup (un séquentiel le remplacerait par une seule) ;
  · le champ s'est vidé → **uploader « à chaque change »** → on continue **une par
    une**, sans jamais reposer la même (pas de doublon), en re-cherchant le champ
    à chaque fois. On pilote sur ce qu'on **POSE**, jamais sur un compteur de
    vignettes aveugle.
- **On ne PRÉTEND jamais plus que ce qu'on sait** : « confirmées » quand on peut
  compter (vignettes blob/data, ou fichiers gardés par un champ contrôlé) ; sinon
  le bandeau dit « **N photos envoyées — vérifie qu'elles y sont toutes** », pas un
  « X/Y attachées » invérifiable.
- ⚠️ **La CAPTURE reste ≤ 6 photos** tant qu'il n'a pas rouvert ses annonces
  Vinted avec la 5.87+ (mesuré : `vinted_item_details` = {1:14,3:1,4:5,5:38,6:60},
  jamais > 6). Même uploader parfait, il n'attachera que ce qui est capté : le
  bandeau le dit et renvoie rouvrir l'annonce Vinted.
- ⚠️ **Deuxième cause possible, non écartée** : le CDN Vinted peut refuser des
  liens périmés (`rates`) → moins d'octets, moins de photos. `attacherPhotos`
  renvoie `rates`, et la **sonde** `photoDiag` (lecture seule, aucun contenu :
  compte des vignettes blob/data/http/canvas/bg + `multiple` + envoyées/rates)
  est rangée dans `lbc_recon.photodiag` — le prochain dépôt tranchera (a) uploader
  vs (b) octets manquants, sans deviner.
- `bancs/leboncoin.cjs` sert le **vrai** uploader (`photosreel` : `multiple` +
  upload-à-chaque-change + vignettes **http**) : **§6.1 — sur le code d'avant
  1 vignette sur 3 et le bandeau ment « 3 attachées » ; après, 3 sur 3 et le
  bandeau dit « envoyées — vérifie ».** Le champ CONTRÔLÉ (`etape2`) garde l'envoi
  groupé (3 fichiers retenus). Extension en **5.94.0**, zip régénéré,
  `EXT_ATTENDUE` suivie. Aucune entrée d'`EXT_CAPACITES` (correction de fiabilité).
- ⚠️ **« La prochaine fois, dépose sans booster »** — c'est déjà le cas : le clic
  « Publier »/boost reste à lui (`BTN_PUBLIER` écarte publier/déposer/payer), et
  l'app ne le fait jamais toute seule.


### Bordereau Leboncoin tamponné comme celui de Vinted (3 octobre, 5.136)
Demande du 2 octobre : « le titre et le N° sur TOUS les bordereaux ». Celui de
Leboncoin s'ouvrait par un simple lien (`voucherUrl`) : le PDF arrivait **nu**,
sans N° — il fallait recopier le numéro à la main sur l'étiquette.
- Le PDF est derrière la session Leboncoin (cookies) : l'app ne peut pas le lire,
  l'extension si. `pdfBordereauLbc(url)` le lit **uniquement** à l'adresse
  `api.leboncoin.fr/api/shippingproxy/v1/parcels/{id}/label` (liste blanche par
  motif), vérifie qu'il commence par `%PDF` (une page HTML de session expirée
  n'est jamais prise pour un bordereau), plafonne à 12 Mo, et ne répond qu'à
  l'origine de l'app. C'est une **lecture** de ses propres colis.
- L'app (`imprimerLbc`) le tamponne avec **le même code que Vinted**
  (`annotateAndDownloadBordereau`, titre + N°) et l'ouvre dans l'onglet réservé
  au clic. PDF illisible ⇒ on le dit et on ouvre le lien d'origine — jamais rien.
- Extension en retard ⇒ le lien d'avant reste, et son infobulle dit pourquoi il
  n'est pas tamponné (`extSait('lbcpdf')`).
- Banc `lbc-bordereau.cjs` (le PDF ouvert PORTE le titre ; ⚠️ pdf-lib compresse
  ses flux, le banc les décompresse avant de chercher le texte) ; `audit-exec.cjs`
  à 15 contrôles, dont « aucune autre adresse ne passe par ce pont ».


### ⚠️⚠️ VENDUE SUR LEBONCOIN → À RETIRER DE VINTED (anti double vente, 4 octobre, 5.152)
Julien : « quand une paire est vendue sur une plateforme, elle doit disparaître
des autres, pour éviter de vendre deux fois la même paire ». Le sens Vinted →
Leboncoin existait (« à retirer de Leboncoin ») ; **l'autre sens n'existait pas** :
une vente Leboncoin ne disait rien de la paire, qui restait en vente sur Vinted.
**Mesuré avant de coder** : 3 ventes Leboncoin où il est le vendeur (dont un colis
à envoyer), toutes sur des annonces reliées à **aucune** paire.
- **Un seul chemin d'identité** (`doublesVenteLbc`, une règle pour l'écran
  Leboncoin ET le tableau de bord, §11) : vente (il est le VENDEUR, pas annulée —
  `lbcAnnulee`) → son annonce (`itemId`) → ses clés (`clesAnnonceLbc` : lien posé
  à la main, réf VRM, « nXXX » du titre) → le N° → l'annonce Vinted de ce N°.
  Encore en vente ⇒ alerte en tête de l'écran Leboncoin, avec le lien Vinted ;
  prouvée vendue sur Vinted aussi ⇒ « vendue deux fois, annule-en une ».
- ⚠️ **VRM ne retire pas l'annonce Vinted tout seul** : §3 (irréversible, sans
  confirmation côté Vinted). C'est lui qui agit ; l'app dit quoi et où.
- **Une vente non reliée ne désigne JAMAIS une paire toute seule** : elle demande
  « quelle paire ? » et PROPOSE jusqu'à trois paires en ligne qui ressemblent
  (`suggestionsPaires` : mots, pointure, prix) — **c'est son clic qui relie**
  (`relierAnnonceLbc`, la même écriture que le champ N°). Une pointure
  DIFFÉRENTE exclut (même modèle, autre paire, §2.4).
  ⚠️ **L'audit a attrapé ma première règle de pointure** : elle prenait le
  premier nombre venu, donc « 90 » dans « Nike Air Max **90** … taille 44 », et
  proposait une paire en 42.
  ⚠️⚠️ **23 octobre, capture de Julien** : une « Adidas Spezial marron taille
  40,5 » vendue 45 € proposait « N°65 Nike LD waffle sacai » — même pointure
  (+3) et prix proche (+2) suffisaient (seuil 4), **sans un seul mot en
  commun**. Deux gardes : une **marque différente** écarte la paire
  (`familleMarque`, sur `extractBrand` ; Jordan = famille Nike), et il faut au
  moins un **mot du modèle** en commun (`motsModele` : ni la marque, ni une
  couleur, ni un nombre, ni low/mid/high). Pointure et prix ne disent rien du
  modèle. `audit-double-vente.cjs` sert ce cas exact (et une Samba à la même
  pointure et au même prix, et l'autre sens : la vraie Spezial reste proposée) ;
  les deux gardes retirées ⇒ 2 rouges.
- ⚠️⚠️ **`account` NE PROUVE PAS QU'UNE ANNONCE EST À LUI.** Mesuré : 58
  annonces portent ce champ, sur **48 comptes** — la 5.88 étiquetait celles
  d'AUTRUI de leur propre propriétaire. J'ai failli l'ajouter à `aLui` (« 57
  annonces à lui ») : ça aurait mis 50 annonces d'inconnus dans « non reliées ».
  Ce qui prouve : une vente où il est le VENDEUR désigne une annonce, dont le
  compte est donc le sien (`comptesLbcProuves`). Chez lui : **1 compte, 8
  annonces, dont 7 qu'aucune règle ne voyait**. Même règle dans l'extension
  (`estALui(ad, prouves)`), `audit-places` compare les deux.
- Une annonce **vendue** sur Leboncoin n'y est plus en vente : elle sort de « en
  ligne », « à retirer » et « non reliées » (app et extension).
- **Le tableau de bord disait « vendue sur Vinted » sur une ABSENCE** (annonce
  publiée sur Leboncoin et plus en ligne sur Vinted — une mise en pause suffisait,
  la règle que l'écran Leboncoin a abandonnée le 12 septembre). Il ne compte plus
  que les ventes prouvées (`soldIdsN`). Il lit les ventes Leboncoin (5 Ko) et ne
  lit les annonces (226 Ko) que si une vente ne se relie pas sans elles, une fois
  par session (`lbcAnnoncesSession`).
- Preuves : `audit-double-vente.cjs` (**20 contrôles**, exécute les vraies règles
  de l'app et de l'extension ; `--prouve` réaffaiblit → **6 rouges**) ; banc
  `double-vente.cjs` (**28**, deux tailles, données inventées, il vit dans le
  dépôt — **20 rouges** sur le build d'avant). Le banc écrit `main` pour de vrai
  quand l'app sauvegarde : sans ça le lien posé « disparaissait » au rechargement
  (§6.3, un banc qui ne garde pas les écritures mesure une fiction).
- Au passage : `lbc-relier.cjs` était rouge depuis la 5.137 (`adRefKeys` appelle
  `cleNum` et `RE_VRM`, que son `vm` ne chargeait pas).
- Extension **5.152.0**, zip régénéré, `EXT_ATTENDUE` suivie. Aucune entrée
  d'`EXT_CAPACITES` : l'app ne promet rien de neuf de l'extension.
- **Reste à faire** : eBay (une autre session s'en occupe) n'entre pas encore
  dans ce contrôle — une vente eBay devra suivre la même règle (SKU `VRM-{n°}`).


### Extension 5.185 — pro/particulier, factures Pro, détourage Vestiaire seul, pack photo, marque Leboncoin, vente annulée (17 octobre)
- **Pro ou particulier (Vinted)** : mesuré, le profil `users/current` (déjà rangé dans `harvest_{uid}_profile`) porte `business`, `business_account`, `business_account_id` — tous ses comptes : `business: false`. Une règle, même texte dans l'app et l'extension (`typeCompteVinted` : true · false · null = pas su, jamais « particulier » par défaut). L'extension la publie dans `panel_comptes_etat.comptes[uid].pro` (un `null` ne remplace jamais un type lu, un changement s'écrit tout de suite) ; Comptes liés affiche « Pro » / « Particulier » (ce que l'extension a publié d'abord, sinon le profil capté). Leboncoin : `lbc_messages.comptes[id].pro` (`is_business_user`) existait déjà. eBay : chantier eBay. Preuves : `audit-etat-compte.cjs` §10-11 (4 rouges sur l'avant, mutations `propasu`/`proefface`), banc `type-compte.cjs` (6 rouges sur l'avant).
- **Factures acheteurs : compte Vinted PRO seulement** (`api/email-inbound`). Seul l'email d'un compte pro porte « En tant que membre Vinted Pro » et le bloc « Coordonnées de l'acheteur » ; `data.pro` exige la MENTION (une adresse email dans le texte ne suffit pas). L'identité de la facture est le **n° de transaction** (pièce jointe `Formulaire-retour-commande-{tx}.pdf`, sinon « Numéro de la transaction ») ⇒ `email_invoice_tx{tx}` ; sans transaction, l'ancienne clé. `audit-routes-revue.cjs` scénario P (email inventé à la forme de celui transmis par Julien ; 5 rouges sur l'avant).
- **Détourage : Vestiaire Collective seul**, sur sa décision (« pas du tout pour Leboncoin, ne le mets pas dans les paramètres »). `photosEnOctets`/`photosPourEbay` rendent les photos d'origine, `vrm_detourage` n'est plus lu ni synchronisé, la carte de Réglages est retirée ; `photosPourVestiaire` détoure toutes les photos (aucune publication Vestiaire n'existe encore : rien n'est dépensé). Le Studio photo (Annonces → Outils, détourage local sans clé) n'est PAS touché. `audit-detourage-ext.cjs` (5 rouges sur l'avant), banc `detourage-reglage.cjs` réécrit (6 rouges sur l'avant).
- **Pack photo Leboncoin** : la page du compte charge `api/usage-consumption-bff/v2/users/me/packages` (mesuré dans `lbc_recon.paths`, corps JAMAIS vu). `noterPackPhoto` écrit `lbc_pack_photo = { actif, at, source:'extension', forme, endpoint }` : un pack nommé « photo » ⇒ true ; liste de packs lisible sans photo (ou vide) ⇒ false ; forme illisible ⇒ AUCUN `actif` (pas su), la forme (clés + types, jamais une valeur) est gardée pour la passe suivante. Le catalogue (`product-catalog`) n'est jamais une preuve. `audit-lbc-pack.cjs` (7 rouges sur l'avant, 3 mutations). ⚠️ Non mesuré : la vraie forme de la réponse — si elle n'a pas de champ nom/type/code, rien ne sera écrit tant qu'on n'aura pas lu `lbc_pack_photo.forme`.
- **Marque Leboncoin** : mesuré sur son dépôt du 15 oct. (5.177) — Univers/Type/Pointure/État remplis, **Marque vide** (le menu ne montre que 11 marques et filtre à la frappe). `choisirComposantRecherche` TAPE `ad.marque` puis ne clique que l'option EXACTE (casse/accents ignorés) ; rien d'exact ⇒ le texte tapé est effacé, deux essais au plus. La description, elle, était bien posée (466 caractères mesurés). La couleur n'est captée nulle part (ni dressing, ni détail) : laissée à lui. Banc `leboncoin.cjs` (1 rouge sur l'avant).
- **Litige** : `A_EXPEDIER` porte `COLIS_DEJA_BOUGE` (même texte que l'app, chantier 4) — la nB546 (`needs_action`, « colis déposé… », transaction 440 « Retour initié ») n'est plus à expédier. Le résumé posé pour le widget/rappels retire les transactions 220 / ≥ 430 (`transactionsQuiNeSExpedientPlus`, lecture ratée ⇒ rien n'est retiré).
- **Vente annulée** : `purgeBordereauxAnnules` (à chaque visite, 20 min de recul) — transaction 500-520 dont l'expédition n'a pas bougé ⇒ PDF retiré de `email_bord_{tx}`, `harvest_{uid}_label_{tx}` et `label_latest` qui la porte, sans attendre 7 jours, métadonnée gardée (`annulee: true`), l'app prévenue (`maj · annulee · tx`). Lecture ratée ⇒ rien. Mesuré : 3 ventes 520 ont encore un bordereau. `audit-purge-bordereaux.cjs` §6-7 (2 rouges sur l'avant ; mutation « expédition jamais bougée » ⇒ 2 rouges).
- Extension **5.185.0**, zip régénéré, `EXT_ATTENDUE` suivie, `EXT_CAPACITES.lbcpack` / `.annulee`.


### Extension 5.186 — booster Leboncoin impossible, publication gratuite jusqu'au bout, compte de session, couleur (17-18 octobre)
- ⚠️⚠️ **Le boost Leboncoin est IMPOSSIBLE par construction** (sa plainte : un dépôt a coché une option payante). Cause : `cliquerContinuer` cliquait « Continuer » sur l'étape `/deposer-une-annonce/options` alors qu'une option était pré-cochée. Désormais : `cliquerContinuer` refuse sur l'étape de publication et tout bouton portant un prix (`PRIX_ARGENT`) ; `publierSansBooster` choisit d'abord le radio GRATUIT, décoche les six options (`gallery`, `gallery30`, `daily_bump`, `daily_bump30`, `sub_toplist`, `urgent`, `NOM_BOOST`), RELIT deux fois, et ne clique qu'un bouton de publication jamais chiffré, jamais « annuler/retour », jamais dans une carte d'option (`dansCarteOption`). Un doute ⇒ rien n'est cliqué, et le bandeau dit pourquoi. Photos pas envoyées (`photosPretes`, `sessionStorage`) ⇒ pas de publication.
- **Publication confirmée, pas supposée** : la page `/deposer-une-annonce/confirmation` (`PAGE_CONFIRMATION`, `confirmerDepot`) marque la paire publiée (`markPosted`) ; un dépôt abandonné ne marque RIEN (clic sans confirmation en 30 s ⇒ « pas su », dit).
- **Le bon compte Leboncoin** : identité lue dans les réponses de SESSION seulement (`LBC_URL_SESSION`, drapeau `courant`, l'objet doit porter un email) — une liste de comptes liés ou une annonce d'autrui ne nomme plus le compte courant ; `vrmLbcCompte` en `v:2` (le badge exige `v===2`).
- **Couleur** : lue sur l'annonce Vinted (`color1`/`color2`, gardés dans `articleMaigre`), posée sur Leboncoin par OPTION EXACTE seulement (`optionCouleurExacte`, `choisirCouleur`) ; rien d'exact ⇒ laissée vide et dite. **Marque/taille/état** : `brand_title`, `size_title`, `status` gardés dans `articleMaigre` ; l'app lit la marque du dressing d'abord, le coffre en repli.
- **Retrait d'argent** : la FORME de `POST /api/v2/users/{id}/payouts` est relevée (`WREQ_FORME`, `formeCorps` : clés et types, jamais une valeur) ; VRM ne l'appelle toujours pas.
- **Relais du téléphone, pont, commandes** : vérifiés avec la 5.186 (bancs `relais-telephone`, `pont`, `publier`, `popup`, `badge` verts).
- ⚠️⚠️ **« La file Leboncoin a moins de paires qu'eBay » — MESURÉ, et ce n'est pas l'extension** (lecture seule, 18 oct.) : la ligne `main` de Julien dans le NUAGE ne porte que les N° **1 à 24** (dont 15 en ligne) — les N° posés depuis ne vivent que dans ses appareils (écritures de `main` en échec depuis le 11 oct., voir « Une paire, une proposition »). La file Leboncoin (extension ET écran Leboncoin de l'app) lit `main` dans le nuage ; la liste eBay de l'app lit la copie LOCALE (`load('vinted_annonce_numeros')`). Les deux règles sont par ailleurs les mêmes (comptes écartés, vendue prouvée, retirée du stock, déjà publiée) ; seules différences légitimes : Leboncoin coché par défaut, et une paire déjà sur Leboncoin (réf VRM 2, 18, 23 captées ; 3 marquées) sort de sa file au lieu d'être grisée. **Geste : réparer l'écriture de `main`** (hors extension). Le « nXXX » d'un titre Vinted reste une clé de repli (0 titre en ligne n'en porte aujourd'hui) — à retirer des deux côtés ensemble (§11) quand on y touche.
- Preuves : `audit-extension-5186.cjs` (12 contrôles, 7 rouges sur la 5.185) ; banc `leboncoin.cjs` fixtures `optionsreel` (vraie forme des six cases) et `confirmation` : **11 rouges sur l'ancien `lbc.js`**, dont `__paye=1` (un bouton payant cliqué).
- ⚠️ **Non mesuré** : la vraie page d'options et de confirmation de leboncoin.fr (403 d'ici ; formes tirées de `lbc_recon.etapes`) ; la forme réelle de la réponse des packs et de la demande de retrait.
- Extension **5.186.0**, zip régénéré, `EXT_ATTENDUE` suivie. Aucune entrée d'`EXT_CAPACITES` : des corrections et des mesures.


### Statistiques à points, URSSAF dans Compta, « ce qui se vend », Compta plus naturelle (17 octobre)
Demande de Julien : graphiques « à points comme Ma journée », les déclarations à payer dans Compta, de vraies stats, des formulaires de dépenses et d'abonnements naturels, le pack Leboncoin facultatif.
- **`CourbeMois`** (même dessin que `CourbeSemaine`, largeur mesurée) remplace les barres « Vendu · 12 mois » (`data-courbe-vendu`), « Évolution — ventes finalisées » (`data-courbe-finalise`, point cliquable = détail) et les deux replis d'archive. Chiffres inchangés : chaque `g[data-mois]` porte `data-valeur` (centimes). Mois en cours : point creux, trait pointillé. `BarresCA12` et `PieChartSVG` (devenus sans appelant) retirés.
- **La carte URSSAF du mois + la prochaine échéance (`CarteUrssafMois`) et le récap comptable mensuel (`RecapComptableMensuel`) vivent dans Comptabilité**, plus dans Statistiques. Propriétaire inchangé : la ligne publiée `vinted_urssaf_mois`, relue au nuage et à chaque publication (`useLigneUrssaf`). `data-stats-carte="mois"` garde son nom (bancs).
- **« Ce qui se vend »** (`RepartitionsVentes`, règle pure `repartitionsVentes`) remplace « Ce qui rapporte » et les camemberts, qui lisaient l'archive vide. Mesuré (lecture seule) : une vente moissonnée ne porte ni pays, ni marque, ni taille ; le pays vit dans `harvest_*_txn_*` → `transaction.buyer.country_code` (421 ventes sur 549), relié par la TRANSACTION ; marque/taille sur l'annonce (transaction → `item_id`), sinon le titre de la vente ; temps de vente = mise en ligne (`dateMiseEnLigneMs`) → vente, sur ~295/601 ventes datées, couverture écrite. Annulées et comptes exclus écartés ; transactions illisibles ⇒ « pas pu lire », jamais un pays. ⚠️ La lecture du pays décompresse le détail de transaction (pas dans `meta`) : une fois par 10 min, à l'ouverture de Statistiques.
- **Formulaires de Compta** : dépense = « c'est pour quoi » en pastilles (`DEPENSE_CATS`, l'exemple suit la catégorie, « Abonnement » n'y est plus), libellés au-dessus des champs, ajout incomplet dit pourquoi ; abonnement = les plus courants en un clic (`ABONNEMENTS_COURANTS` ; prix rempli pour VRM seul, celui des CGV), « jusqu'au (vide s'il continue) ».
- **Pack photo Leboncoin facultatif** : section « Packs & options (facultatif) » ; ligne `lbc_pack_photo` = `{actif, at, source:'extension'}` écrite par l'extension (contrat avec le chantier extension) — trois états, affichée « détecté par l'extension », aucun montant inventé.
- Preuves : banc `stats-compta.cjs` (58 contrôles, deux tailles, données inventées) ; `stats-premium`, `urssaf`, `chiffres-croises` jugent maintenant la carte URSSAF sur l'onglet Compta.


### Leboncoin, les quatre restes : date de vente, vendue hors vente, chemins vivants, compte de la page (20 octobre, 5.198)
Restes mesurés par la passe 5.195 (lecture seule, sa base), tous corrigés.
- ⚠️⚠️ **Date de vente** : la date ne vit QUE dans la liste v3
  (`[].created_at`, ISO, mesuré au format `2026-…T…Z`) — le détail v2 n'en porte
  aucune (`updated_at`, `sent_at` seulement). Ses 3 ventes vendeur viennent du
  détail (10-01, avant la 5.131) et la liste n'a plus été rangée depuis. Cause
  trouvée dans le code : la liste et les détails lus juste après (5 au plus, à
  ~150 ms) arrivaient ENSEMBLE ; chaque `rangerLbcVentes` relisait la ligne puis
  la réécrivait entière — le dernier écrivain, parti d'une lecture d'avant,
  effaçait les `dateVente` de la liste. Prouvé : liste + détail envoyés ensemble
  ⇒ date perdue 5 fois sur 5 sur origin/main. ⇒ Les rangements passent à la file
  (`_lbcVentesChaine`). Et une vente ouverte DIRECTEMENT (lien, notification),
  jamais vue datée : `lbc-inject.js` relit les listes dont il a vu le SITE
  demander l'adresse exacte (`vrm_lbc_listes`, localStorage de la page, 3 au
  plus — jamais une adresse devinée), au plus une fois par 6 h ; ces relectures
  ne relancent pas la lecture des détails (le plafond de 5 par page tient).
  Jamais l'heure de capture.
- **Vendue sur Leboncoin = plus en vente** : une règle, texte pour texte, dans
  l'app, l'extension et le serveur (`<lbc-en-vente-regle>` :
  `annoncesLbcVendues`, `annonceLbcEnVente`) — la vente prouvée (`isSeller`, non
  annulée) prime sur un `status: 'active'` périmé ; jamais un jugement sur une
  absence dans une liste paginée. Les lecteurs l'appliquaient déjà chacun à sa
  façon ; ils passent tous par elle (`lireLbcAnnonces`, compteur, écran
  Leboncoin, `annoncesLbcParNumero`). ⚠️ Un lecteur l'ignorait : la pastille
  « Aussi sur Leboncoin » de l'écran Annonces (`vinted_lbc_posted` seul) — elle
  ne s'affiche plus pour une paire dont la vente Leboncoin est prouvée
  (`lbcAussi`, via `doublesVenteLbc`) ; ventes illisibles ⇒ rien n'est retiré.
- **`lbc_recon.paths`** (300/300, vieux format, plus rien n'entrait) :
  `fusionnerCheminsLbc` — le plus récent d'abord, un chemin revu remonte, les plus
  anciens tombent ; les chemins qui servent (vente, transaction, bordereau, PDF,
  ≥ 400, compte, messagerie…) gardent jusqu'à la moitié des places ; l'ancienne
  forme nue s'efface devant sa forme neuve ; aucun nouveau chemin ⇒ aucune
  écriture. La page envoie ses 200 chemins PLUS RÉCENTS.
- ⚠️⚠️ **Bascule de compte dans le même onglet** : une liste « à moi » (`myads`,
  tableau pro) part avec le compte du compteur relu DANS LE MÊME DOCUMENT
  (avant elle, sinon elle attend le premier compteur — 90 s au plus) ; deux
  comptes dans un document ⇒ plus rien n'est attribué. Le fond tague avec CE
  compte (`sessionDeListe`, jamais un compte lié), plus avec `vrmLbcCompte`
  (le dernier vu, peut-être l'ancien) ; sans compte joint ⇒ rien de tagué.
- Preuves : `audit-lbc-restes.cjs` (vrais `background.js` + `lbc-inject.js` dans
  un `vm`, règle de l'app et route serveur exécutées, données inventées) —
  **15 rouges sur origin/main**, 0 après ; 7 mutations (file retirée, compte du
  fond, chemins figés, règle app sans la vente, déjà-datée ignorée, liste sans
  attente, bascule ignorée) ⇒ toutes rouges. `audit-lbc-session` et
  `audit-lbc-comptes` servent la forme neuve (compte joint par la page).
- ⚠️ **Non mesuré** : qu'une bascule de compte Leboncoin recharge toujours la
  page (si elle ne rechargeait pas, un `myads` arrivé entre la bascule et le
  compteur suivant serait tagué du premier compteur du document) ; la requête
  exacte de la liste des VENTES (onglet Ventes de « Mes transactions ») — seule
  l'adresse vue est relue ; si ses 3 ventes n'y figurent plus, rien ne les datera.
- **Geste de Julien** : installer la 5.198, ouvrir « Mes transactions » sur
  Leboncoin (onglet Ventes) une fois sur le compte particulier.


### Leboncoin : « plus vue sur Leboncoin » et « Mettre en pause » (22 octobre, propositions 14 et 6)
**Mesuré (lecture seule, sa base, 22 oct.)** : 11 annonces à son compte
`8442c3e8…` (Totomondu), toutes `status: 'active'` ; 4 vues le 22/10, 7 jamais
revues depuis le 20/09 (3 vendues, 4 très probablement supprimées par lui le
10/10 : `lbc_recon.envois` porte son `DELETE …/manual/delete/ads`). Sa page
profil charge `POST adfinder/v2/owner_listing` (corps : `limit, offset, sort_by,
sort_order, filters.owner.user_id, filters.enums.ad_type`, réponse `total,
total_active, max_pages, referrer_id, ads[].list_id, ads[].owner.user_id`) ; la
v1 (« autres annonces du vendeur ») exclut l'annonce affichée (`displayed_id`) ;
`dashboard/v1/search` (sa page « Mes annonces ») dit `all_ads: 4, active_ads: 4`
mais rend `ads: []`. La mise en pause a été VUE dans ses gestes (23/09, 5.106) :
`PUT api.leboncoin.fr/api/pintad/v1/public/manual/pause/ads`, corps
`{list_ids:[number]}` — ni sa réponse ni ses en-têtes n'ont jamais été vus.
`lbc-account:<id>` (session privée) = l'`user_id` des annonces (mesuré).
- **(14) « plus vue »** : `lbc-inject.js` n'envoie `lbcListeComplete` que pour une
  liste PROUVÉE complète — `owner_listing` v2 filtré sur le SEUL vendeur (aucun
  mot-clé ni catégorie, `ad_type` absent ou `['offer']`), `referrer_id` vide,
  chaque annonce à ce vendeur, total atteint par les identifiants distincts de
  toutes les pages lues dans le document (même total, < 3 min), total > 0. Le fond
  (`noterListeLbcComplete`, chaîne `enChaineLbcListings` : trois écrivains de
  `lbc_listings`, une file) n'agit que pour un de SES comptes (`comptesMiens`) :
  ses annonces absentes reçoivent `plusVueAt` (un état — jamais « vendue », jamais
  « supprimée », rien d'effacé), une liste complète qui la remontre l'efface ;
  lecture ratée ⇒ rien n'est écrit ; `lectures[compte]` date la lecture.
- **La règle partagée** `<lbc-en-vente-regle>` (app = extension = serveur, §11) :
  plus « en vente » si `lbcSortieDe(ad)` (`plusVueAt` ou `pauseAt` EFFECTIFS, voir
  la revue ci-dessous) ou un état `paus|inacti`. Elle sort donc l'annonce de « à
  retirer », « à vérifier », « non reliée », du compteur, de la double vente
  serveur. `numerosLbcSortis` (une règle, écran Leboncoin + Ma journée) : voir la
  revue — la ligne venue de `vinted_lbc_posted` ne part que sur une PREUVE. Une annonce pas revue depuis plus de 7 jours ne demande plus « quelle
  paire ? » ; une ligne dit le geste (sa page profil Leboncoin). Sans `seenAt` :
  rien ne change (on ne sait pas qu'elle est vieille).
- **(6) « Mettre en pause sur Leboncoin »** : sur la ligne « vendue sur Vinted — à
  retirer », seulement si l'extension d'ici le sait (`lbcPause` dans son état,
  capacité par présence ; en retard ⇒ « mets-la à jour » ; absente ⇒ le lien seul).
  Confirmation qui nomme l'annonce (titre, N°, prix) et dit « pas une
  suppression » ; l'app n'envoie que l'identifiant. Le fond (`pauseLbcDepuisApp`)
  relit l'annonce EN BASE, exige que son compte soit celui de la session privée de
  l'onglet (`vrmLbcTransport`), sinon refuse et nomme le compte ; sans onglet, en
  ouvre un en arrière-plan, attend la session (20 s), le referme ; une à la fois,
  10 par heure. L'ordre passe fond → `lbc-relay.js` (cadre principal, émetteur =
  l'extension) → `lbc-inject.js` (monde MAIN) qui envoie UNE requête à l'adresse
  écrite en dur, avec les en-têtes que le site met lui-même, et rend statut +
  300 caractères + forme. 2xx ⇒ « fait » (`pauseAt` posé), sinon « pas fait » avec
  la réponse, silence ⇒ « je ne sais pas ». La forme de la réponse est rangée
  (`lbc_recon.envois`, clés et types seulement). Une pause encore listée moins
  d'1 h après n'est pas levée (index de recherche, borne non mesurée).
- **Fusion avec main (6056c7d, « sources privées »)** : main range désormais ses
  annonces sous `account: 'lbc-account:{id}'` (0 aujourd'hui en base, les 10 de
  Julien portent l'id nu). Les deux formes sont UNE identité (`idCompteLbc`) pour
  « plus vue » et pour la pause — sinon ses annonces recapturées n'auraient plus
  jamais été marquées, et la pause aurait répondu « autre compte » sur son propre
  compte. Et `storeLbcListings` (main) réécrivait `{items, updatedAt, lastUrl}`
  seul : il garde maintenant les autres clés (`lectures`).
- **Preuves** : `audit-lbc-plus-vue-pause.cjs` (vrais `lbc-inject.js`, `lbc-relay.js`,
  `background.js` en vm) **49 contrôles, 30 rouges sur origin/main (6056c7d)**, et
  `--prouve` : 12 mutations (dont `prefixe`), chacune rouge. Banc `bancs/lbc-pause.cjs` (port 6331,
  données inventées, 390 et 1512 px, 4 scénarios) **38 contrôles, 28 rouges sur le
  build d'origin/main** (dont Ma journée « 2 à retirer » au lieu de 1) ; trois
  builds réaffaiblis, chacun rouge : règle sans `plusVueAt`/`pauseAt` (8),
  pause sans confirmation (4), « quelle paire ? » sur une annonce périmée (2).
  `audit-double-vente` lit encore `let lbcRemoveCount=0;` (orthographe gardée).
  ⚠️ Relancés le 23 oct. AVEC la porte des bancs (`NODE_OPTIONS="--require
  /tmp/claude-0/redir-pw.cjs"`, sinon l'app reste sur la connexion) :
  `lbc-relier.cjs` 18/18 vert ; `double-vente.cjs` 6 rouges À L'IDENTIQUE sur le
  build de 0d68493 et après la revue (listes comparées ligne à ligne).
- **Extension touchée** (`background.js`, `lbc-inject.js`, `lbc-relay.js`), **version
  NON montée** (5.212.0 de main, `audit-extension-zip` rouge jusqu'à l'intégration) ; aucune
  entrée d'`EXT_CAPACITES` (capacité par présence).
- ⚠️ **Non mesuré** : la réponse de Leboncoin à la pause et ses en-têtes requis (le
  premier clic EST la mesure) ; la valeur de `ad_type` et de `referrer_id` dans
  SA requête v2 (si elles diffèrent, rien ne décide : sens sûr) ; quelle page
  déclenche exactement la v2 (l'ordre des chemins désigne la page profil) ; le
  retard de l'index après une pause ; un `account_id` différent de l'`user_id`
  chez un autre vendeur (la pause serait refusée « autre compte » : sens sûr).
  Limite connue : un script de la page leboncoin.fr peut poster l'ordre de pause
  au capteur — il pourrait déjà envoyer cette requête lui-même (même session).
  Non fait : la pastille « Aussi sur Leboncoin » (écran Annonces) suit
  `vinted_lbc_posted`, pas les captures — la relier coûterait 235 Ko par
  ouverture (§4.4).
- **Revue du 22 octobre (relue le 23), deux défauts REPRODUITS par le relecteur,
  corrigés** :
  - ⚠️⚠️ **« Plus vue » et « mise en pause » restaient collées** (haute) : une
    capture privée PLUS RÉCENTE (« Mes annonces », `myads`) qui remontrait
    l'annonce ACTIVE ne les levait pas (`Object.assign(ancien, l)` les gardait, la
    règle ne regardait pas `seenAt`) — reproduit : `en vente = false` après la
    capture, `lireLbcAnnonces` ne la voyait plus ⇒ alerte « à retirer » tombée,
    paire reproposée à la publication. **La donnée la plus récente gagne** :
    `lbcSortieDe` (dans la règle partagée, texte identique ×3, avec
    `LBC_PAUSE_INDEX_MS` = 1 h qui y vit désormais) — « plus vue » ne compte que si
    aucune capture ne l'a revue APRÈS ; une pause, que si aucune ne l'a revue plus
    d'une heure après. Douter ⇒ « en vente » (l'alerte reste, la paire n'est pas
    reproposée : le sens sûr). En base aussi : `storeLbcListings` lève
    `plusVueAt` (et `pauseAt` passé l'heure) sur une capture neuve. Et
    `noterListeLbcComplete` ne marque plus une annonce VUE il y a moins d'une heure
    (l'index public peut ne pas montrer une annonce publiée le matin — l'ordre
    inverse du cas reproduit), et repose une marque levée si une liste complète ne
    la montre toujours pas. Décision : toute capture compte (pas seulement la
    liste privée) — une capture qui revoit une annonce à tort la remet « en
    vente », le sens sûr.
  - **`numerosLbcSortis` retirait l'alerte par ressemblance** (moyenne) : le
    « nXXX » d'un TITRE d'annonce morte effaçait la N°18 « à retirer » (§5), et une
    annonce reliée sortie suffisait alors que `vinted_lbc_posted` ne dit pas QUELLE
    annonce porte la paire (second compte, republication pas encore vue). Les
    annonces sorties désignent leur paire par IDENTITÉ seulement
    (`numeroLbcIdentite` : lien posé à la main, référence VRM) ; les annonces EN
    VENTE gardent toutes leurs clés, titre compris (une ressemblance GARDE
    l'alerte). La ligne ne part (`prouves`) que si une liste COMPLÈTE de CHACUN de
    ses comptes (session vue ou vente prouvée, plus le compte de l'annonce sortie ;
    `lbc-account:{id}` = l'id nu) est POSTÉRIEURE à la marque « publiée »
    (`vinted_lbc_posted.updatedAt`, la dernière écriture : un majorant de chaque
    marque) ; comptes, ventes, annonces ou marque illisibles ⇒ pas de preuve.
    Sinon elle reste, avec « l'annonce reliée n'est plus dans ta liste / est en
    pause depuis VRM » sur la ligne et, UNE fois dans sa carte, le doute et le
    geste (ouvrir sa page profil sur chacun de ses comptes). Même règle dans Ma
    journée (`lbcListingsSession` garde `lectures` ; `lbc_accounts` n'y est lu que
    s'il y a quelque chose à retirer).
  - **Mesuré (lecture seule, 23 oct.)** : `vinted_lbc_posted.updatedAt` existe
    (17/10, 3 paires) ; un seul compte à session vue (`8442c3e8…`, sous ses deux
    écritures) — SHOPCANCALE (`faf3fbba…`) n'a pas de `sessionAt`, il n'est donc
    pas exigé ; aucune `lectures` en base (la fonction n'est pas en production).
  - **Preuves** : `audit-lbc-plus-vue-pause.cjs` **71 contrôles** (sections 2 bis
    et 6, et 2 contrôles de plus par copie de la règle) — **17 rouges sur
    0d68493** (audit copié dans `git archive 0d68493`, lancé depuis la copie ;
    l'ancienne forme de `numerosLbcSortis`, un Set, est lue telle quelle) ;
    `--prouve` **22/22** mutations rouges, dont 10 neuves (`regleRecente`,
    `pauseCollee`, `plusVueCollee`, `pauseFenetre`, `vueRecente`, `remarque`,
    `titreSortis`, `sansPreuve`, `unCompte`, `comptesSortis`), chacune sur SON
    contrôle de comportement (pas seulement l'égalité de texte). Banc
    `lbc-pause.cjs` **50 contrôles** (N°18 marquée « plus vue » puis revue active ;
    scénario « marque publiée après la liste complète » aux deux tailles, Ma
    journée « 2 ») — **32 rouges sur le build de 0d68493** ; builds réaffaiblis :
    preuve ignorée ⇒ 6 rouges, marque collée ⇒ 30 rouges (mutations posées sur bbe1f17).
  - ⚠️ **Non mesuré** : qu'une page publique de Leboncoin ne remontre jamais une
    annonce supprimée (si oui, elle redevient « en vente » jusqu'à la liste
    complète suivante : sens sûr) ; une republication FAITE À LA MAIN après la
    dernière liste complète, hors VRM, ne se voit qu'à la capture suivante (aucune
    marque « publiée » ne bouge).
- **Geste de Julien** : installer l'extension de l'intégration, ouvrir sa page
  profil Leboncoin (les 7 annonces fantômes sortent), puis « Mettre en pause » la
  N°18 depuis VRM → Leboncoin → Annonces.

### Revue argent de l'extension : publier sur Leboncoin, gestes Vinted (20 octobre, 5.194)
Relecture adverse des chemins qui engagent de l'argent ou une vente. Chaque défaut a été REPRODUIT en exécutant le vrai code, il est rouge sur le code d'avant (§6.1) et rouge sous mutation.
- **Leboncoin (`lbc.js`, `publierSansBooster`)** :
  - un bouton de publication qui NOMME une option payante sans prix (« Publier avec le logo Urgent ») était cliqué ⇒ `NOM_BOOST` est vérifié sur le bouton (publication ET « Continuer ») ;
  - un prix écrit « 2 EUR » passait ⇒ `PRIX_ARGENT` lit « eur » ;
  - une option en interrupteur (`aria-pressed="true"`) n'était pas vue ⇒ elle est décochée, sinon rien ne part ;
  - ⚠️ **un prix DÉJÀ sur la page et différent de celui de VRM** (ou illisible) laissait publier : `prixRelu` était calculé et jamais lu. Désormais `noterPrixPage` le relève (sessionStorage) et `prixRefus` bloque la publication avant ET juste avant le clic, en le disant. Le champ prend des euros (mesuré le 16 octobre) ;
  - ⚠️ **la page rechargée après le clic recliquait** (double publication) : le clic est noté dans `vrmPublieClique:{id}` AVANT d'être fait. Stockage illisible ⇒ aucun clic.
- **Vinted (`background.js`)** :
  - ⚠️ une offre ACCEPTÉE par l'app partait sans confirmation : le `confirme` de l'app était jeté par `vmrExecUn` et par `bridge.js`. Il est relayé, et `executerPourApp` refuse l'acceptation sans lui (`code:'confirmation'`). Le relais du téléphone le pose seulement quand la ligne porte `confirme` ;
  - un geste `exec` ou un bordereau en attente dans la file Vinted partait après une bascule de compte : `gardeStricte` est revérifié à son tour, DANS `avecVinted`.
- **Preuves** :
  - `audit-argent-lbc.cjs` (vrai Chromium, six cas, quatre mutations) ;
  - `audit-argent-vinted.cjs` (vrai `background.js`, cinq cas, trois mutations) ;
  - `audit-exec.cjs` et `bancs/leboncoin.cjs` mis à jour : la mutation du banc retire désormais les DEUX gardes du bouton.
- **Examiné sans défaut confirmé** : `ebay.js` (ni prix ni catégorie posés sans formulaire vu) ; `label_latest` (déjà `audit-label-latest`) ; réponses automatiques (`audit-repondre`) ; relais (vus, échéance, confirmation, prise conditionnelle). `vintedSend` part avec le jeton du compte visé : la revérification du cookie est une défense §3, pas une vente fausse.
- **Non mesuré** :
  - le vrai leboncoin.fr (403 d'ici) : libellés réels des boutons et des interrupteurs, forme réelle du champ prix ;
  - une paire vendue entre la mise en file et le clic (fenêtre de quelques secondes).


## 31 octobre — Le compte Leboncoin OUVERT mis en avant, les autres estompés

Julien, mot pour mot : « pareil pour leboncoin et vestiaire je veux que comme pour
vinted les données des comptes ouvert soit mis en avant si un compte est ouvert, les
autres sont floutees comme pour vinted ».

- **Comment l'app connaît le compte ouvert** (vérifié dans `background.js`, rien
  changé à l'extension) : `lbc_accounts.accounts[id].sessionAt`, posé par
  `noterSessionLbc` (compteur de messagerie, que Leboncoin ne relit que pour le
  compte connecté ; jamais pour un compte lié, garde `vrmLbcLies`) et par
  `lireSessionPriveeLbc` (`members/me/account`). Réécrit à CHAQUE changement de
  compte, sinon au plus toutes les 6 h tant qu'il navigue. L'état que l'extension
  rend à l'app (`etatPourApp`) ne porte PAS le compte Leboncoin : la ligne de base
  est la seule source.
- **Règle** (`src/flouCompte.js`, `compteLbcOuvert`) : le `sessionAt` le plus
  récent, s'il date de moins de **12 h** (deux fois la cadence de réécriture ; borne
  choisie, non mesurée). Égalité, date illisible, trop ancienne ⇒ `''` = pas su,
  aucun flou. Identité : `8442…` = `lbc-account:8442…` (`idCompteLbcFlou`), jamais
  un nom.
- Comme Vinted (13 oct.) : le flou ne vaut que si l'extension de CE navigateur est
  là, connectée à CE compte VRM, à jour (`raisonExtGlobale` muette ; la pause
  VINTED ne compte pas). Lecture seule (téléphone) ⇒ tout net.
  ⚠️ Limite : `sessionAt` vient de l'extension de n'importe lequel de ses
  navigateurs (la ligne ne dit pas lequel).
- **Estompé** (même `STYLE_FLOU` que Vinted, remonté en module — une définition,
  §11 ; `data-flou="1"`) : Annonces (`AnnoncesLeboncoin`), Ventes (`CarteLbc`),
  Achats (`LigneAchatLbc`), Messages → Conversations (ligne du compte) et Favoris
  reçus (`ad.account`). Une ligne SANS compte relevé n'est jamais floutée. Les
  alertes (« à retirer de Leboncoin », « à relier ») et Colis restent nettes. Pas de
  sélecteur de compte Leboncoin : rien ne « prime ».
- Preuve : `scripts/bancs/lbc-flou-compte.cjs` (390/1512, données inventées) — 18
  rouges sur le code d'avant, vert après ; rouge sous trois mutations (fraîcheur
  retirée, condition d'extension retirée, flou jamais posé). `filtre-compte`,
  `lbc-comme-vinted`, `lbc-messages` verts.
