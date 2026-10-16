# Défauts reproduits par les relecteurs du 15 octobre (lots comptes, fiscal, annonces)
`relire:comptes` est CORRIGÉ et fusionné (commit c1ca0c1). `relire:fiscal` et `relire:annonces` : la correction a été coupée par la limite — corrections partielles dans `p1-fiscal-WIP.patch` et `p1-annonces-WIP.patch`, NON prouvées. Chaque défaut ci-dessous a été REPRODUIT par un relecteur adverse.

## relire:comptes
```json
{
  "defauts": [
    {
      "titre": "Mode stream : dans une fourchette ou une baisse de prix, le premier montant reste lisible",
      "gravite": "haute",
      "reproduction": "Copie de 9de0216 : /tmp/claude-0/-home-user-cancale-v67/31464966-7138-5129-91cc-9bcff32ecc28/scratchpad/p1-relire-comptes (dist construit, fx en lien symbolique, port 5942).\n\n1) Rendu sur les vraies fixtures : `MODE=on TAILLES=390,1512 BANC_PORT=5942 node scripts/bancs/sonde-relecture.cjs`. Sur « Le prix qui marche » (tab=prixmarche), aux deux tailles, 115 lignes « N ventes · de X à ••• € » laissent X en clair (« de 10 à ••• € », « de 26,71 à ••• € »). Capture : scratchpad/p1rc-capt/on-1512-prixmarche.png.\n\n2) Le vrai module sur la même structure de nœuds : `node scripts/sonde-dom.cjs` donne :\n- « 60 → ••• € » : le prix barré du conseil de baisse, App.jsx:31423, `<span>{price}</span> → {sugg} €` ;\n- « fourchette 20–••• € » : App.jsx:32865 ;\n- « de 26,71 à ••• € » : App.jsx:10693.\n\nCause : `RE_MONTANT_APRES` ne prend que le nombre collé à la devise. `texteVoisin` ne regarde que le nœud suivant immédiat (« → », « à »), jamais le montant au-delà.\n\nLe banc du lot ne peut pas le voir : tous ses montants inventés s'écrivent « X € » seuls."
    },
    {
      "titre": "Mode stream : un code de retrait à 4 chiffres (casier Chronopost) s'affiche en clair dans Achats",
      "gravite": "moyenne",
      "reproduction": "`noterValeurSensible` ignore toute valeur de moins de 5 caractères (modeStream.js). Or `codeRetrait` accepte 3 à 10 chiffres. Les fixtures réelles portent 2 colis Chronopost à code ET code2 de 4 chiffres (forme 9999).\n\nCommande, dans la copie : `sed \"s/code: 'C98765'/code: '4821'/\" scripts/bancs/mode-stream.cjs > scripts/bancs/sonde-code4.cjs && BANC_PORT=5944 node scripts/bancs/sonde-code4.cjs`.\n\nSortie :\n- « KO 390 px : aucun écran ne laisse passer une donnée sensible (21 écrans) — cat_achats: 4821 » ;\n- même ligne à 1512 px.\n\n`node scripts/sonde-dom.cjs` le confirme : « Code de retrait 4821 · casier » reste intact, même après `noterValeurSensible('4821')`.\n\nLe banc d'origine (code C98765, 6 caractères) reste vert."
    },
    {
      "titre": "Mode stream : les noms des comptes Leboncoin ne sont pas masqués (Leboncoin → Messages)",
      "gravite": "moyenne",
      "reproduction": "Le dictionnaire du mode stream n'a que trois sources : `vinted`, `ebay` et `moi`. Rien pour `lbc_messages.comptes` ni `lbc_accounts.accounts`, que `MessagesLeboncoin` affiche (App.jsx ~34902, `nomDe`).\n\nCommande, dans la copie : `node scripts/bancs/sonde-lbcnoms.cjs`. C'est lbc-messages.cjs, port 5944, mode stream allumé et noms inventés.\n\nSortie : « STREAM true TEXTE \"Berenice Lbcdupont · relevé à l'instant · 4 non lus · Zorglub Sneakers Pro · pro …\" ». Les deux noms sont lisibles en mode stream.\n\nEn base, lecture seule : Julien a 1 compte Leboncoin nommé dans lbc_accounts (11 caractères). Son id ne correspond pas aujourd'hui au compteur, donc ce nom ne s'affiche pas encore chez lui. Il s'affichera dès qu'ils se recouperont."
    },
    {
      "titre": "Mode stream allumé ailleurs : l'appareil affiche les vraies données tant que le nuage n'a pas répondu (pour toujours si `main` est illisible)",
      "gravite": "moyenne",
      "reproduction": "Commande, dans la copie : `BANC_PORT=5944 node scripts/bancs/sonde-flash.cjs`. C'est le préparateur du banc du lot, avec la lecture `id=eq.main` retardée de 6 s ou servie en 522. Le nuage dit `{on:true}`.\n\nRésultats sur cat_ventes, à 390 et 1512 px :\n- **A** (appareil resté sur « coupé » d'il y a 1 h) : à 1,5 s, 3 s et 4,5 s, `stream=false` et 5 fuites (deux logins, « 312,77 »). Masqué seulement à 9 s.\n- **B** (appareil neuf) : pareil.\n- **C** (`main` en 522, le reste de la base répond) : `stream=false` et 5 fuites encore à 9 s, sans fin.\n\nCause : le « pas su » du nuage vaut « coupé » (`activerStream(!!(STREAM_LOCAL && STREAM_LOCAL.on))`). Le lot applique pourtant la règle inverse côté serveur (« pas su ⇒ on tait »)."
    },
    {
      "titre": "Fiche de compte : la synchro est écrite deux fois, et se contredit quand le compte est en retard",
      "gravite": "moyenne",
      "reproduction": "Commande, dans la copie : `BANC_PORT=5943 CAPT=… node scripts/bancs/sonde-fiche.cjs`. C'est comptes-fiche.cjs avec des captures datées de 30 h et de 5 j.\n\nTexte de la fiche, aux deux tailles :\n- « compte_alpha · capté il y a 30 h · **Capté il y a 30 h** · Actif · Détails » ;\n- « compte_beta · capté il y a 5 j · ouvert dans Chrome · **Pas capté (il y a 5 j)** · Actif · Détails ».\n\nLa nouvelle ligne de synchro (`agoCourt`) répète la pastille de statut (`acctHealth`). En panne, l'une dit « capté », l'autre « pas capté ». C'est sur l'écran dont Julien disait « beaucoup trop d'informations » (§7).\n\nCapture : scratchpad/p1rc-capt/fiche-perimee-390.png."
    },
    {
      "titre": "Notifications du serveur : sur une lecture ratée, `streamDuVendeur` reprend le dernier état connu (« coupé ») au lieu de taire le détail",
      "gravite": "basse",
      "reproduction": "Commande, dans la copie : `node scripts/sonde-push-cache.mjs`. Elle exécute le vrai api/_lib/push.js avec un faux fetch, deux envois de suite sur la même instance : base « coupé », puis base en 522.\n\nSortie, deuxième envoi : « base=panne → notification : 💸 Vendu ! · Zephyr Runner — 487,13 € (zorglub_vend42) ». Le montant et le login partent alors qu'on n'a rien pu lire.\n\nCause : `return _streamVu.has(qui) ? _streamVu.get(qui) : null`. Le commentaire, lui, dit « PAS SU ⇒ on TAIT le détail ».\n\nL'audit du lot appelle `oublierStreamVu()` avant chaque cas, donc ne peut pas le voir."
    },
    {
      "titre": "Adresses de réception : l'explication ne décrit pas ce que Julien a déclaré",
      "gravite": "basse",
      "reproduction": "Base de production, SELECT en lecture seule :\n- `vrm_email_owners` : 1 vendeur, 15 adresses, dont 10 @icloud.com, 2 @privaterelay.appleid.com et 3 @gmail.com ;\n- 6 de ces 15 adresses sont aussi des « Email du compte Vinted » (`vinted_account_emails`).\n\nCe sont donc surtout les adresses où Vinted lui écrit (alias iCloud et relais Apple). Ce ne sont pas des destinations de renvoi.\n\nLe nouveau texte dit pourtant « Les adresses vers lesquelles tu fais suivre tes emails Vinted ». Le code accepte bien les deux (`adressesDeLivraison` lit To et Delivered-To / X-Forwarded-To), mais la phrase n'en nomme qu'une, celle qui ne correspond pas à ses adresses.\n\nAucun lien non plus avec « Email du compte Vinted », dans Détails de la fiche : deux saisies pour en partie les mêmes adresses, sans le dire."
    }
  ],
  "verdict": "Lot globalement solide. Sur les vraies fixtures (23 écrans × 390/1512 px), la recherche globale, le fil de messages, le rapport comptable et le registre annuel ne laissent passer ni login, ni email, ni identifiant long, ni « montant + € ». Le mode coupé voit bien ces mêmes données (la sonde n'est pa"
}
```

## relire:fiscal
```json
{
  "defauts": [
    {
      "titre": "Pour une société ou une EI au réel, Statistiques et le rappel du 1er parlent encore de cotisations URSSAF de micro (« À payer (13,5 %) », « Déclarer sur l'URSSAF »), et pour un micro sans versement libératoire l'écran dit « (versement libératoire) »",
      "gravite": "haute",
      "reproduction": "Sonde : /tmp/claude-0/-home-user-cancale-v67/31464966-7138-5129-91cc-9bcff32ecc28/scratchpad/p1-relire-fiscal/scripts/bancs/sonde-relire-dash.cjs, lancée avec `PORT_BANC=5982 node …`. Elle rend le build de ab3e057 sur ?tab=dashboard, à 1512 et 390 px. Données : vrm_profil_entreprise, vinted_regime et vinted_urssaf_mois (CA du mois = 1000 €).\n\nRésultats :\n- Société avec TVA facturée (vinted_regime=reel) : « À payer (13,5 %) » = true, « 135,00 » = true, « Déclarer sur l'URSSAF » = true, « (versement libératoire) » = true, « Prochaine déclaration URSSAF » = true.\n- EI au réel : mêmes résultats.\n- Micro avec vl:false : « (versement libératoire) » = true.\n\nCapture : …/scripts/bancs/zz-relire-dash-société-societe-1512.png. On y lit « À PAYER (13,5 %) 135,00 € · NET APRÈS PAIEMENT 865,00 € · C'est la somme à verser à la fin du mois (versement libératoire) » et le bouton « Déclarer sur l'URSSAF → ».\n\nLe profil de ce même lot affiche pourtant la règle « Tes cotisations et ton impôt ne sont pas un % du chiffre d'affaires : VRM ne les estime pas ». L'app tient donc deux verdicts sur la même notion (§11). Le choix « Versement libératoire » ne change rien ailleurs que dans la liste des règles (grep vlApplique/p.vl : aucun lecteur).\n\nCôté serveur : /…/scripts/bancs/sonde-relire-urssaf-push.cjs exécute le vrai api/ship-reminders.js, avec la date forcée au 2026-11-01 et un profil société au réel. Sortie : `\"urssaf\":\"envoyé\"`, et le mémo urssaf_reminder_dedup {mois:'2026-11'} est écrit. La notification « pense à déclarer ton chiffre d'affaires sur autoentrepreneur.urssaf.fr » part donc chez une société.\n\nLe banc fiscal.cjs ne rend pas le tableau de bord : il ne peut pas voir ce défaut."
    },
    {
      "titre": "Au réel, l'écran affiche « Cotisations — », mais les exports CSV et PDF du rapport mensuel et du bilan annuel écrivent encore « Estimation cotisations (13,5%) »",
      "gravite": "haute",
      "reproduction": "Sonde : /…/p1-relire-fiscal/scripts/bancs/sonde-relire-rapport.cjs, lancée avec `PORT_BANC=5983`. Données : ventes inventées de rapport.cjs, plus une ligne main {vinted_regime:'reel', profil société TVA facturée}. Parcours : Ventes → Outils → Rapport comptable, puis Registre annuel. Mêmes résultats à 1512 et à 390 px.\n\nÀ l'écran, c'est correct :\n- rapport : « COTISATIONS — au réel : pas un % du CA » ;\n- bilan annuel : « COTISATIONS — au réel : pas un % du CA ».\n\nLes exports, eux, chiffrent :\n- CSV du rapport : `\"Estimation cotisations (13,5%)\";\"46.51\"` ;\n- PDF du rapport : « Estimation cotisations (13,5%) » ;\n- CSV annuel : `\"Estimation cotisations (13,5%)\";\"101.86\"` ;\n- PDF annuel : même ligne.\n\nLes textes PDF ont été lus en décompressant les flux. La cause est dans le code : exportReportCsv (src/App.jsx ~27904), exportReportPdf (~27937), exportAnnualCsv (~28114) et exportAnnualPdf (~28141) ne testent que `regime==='marge'`, jamais 'reel'.\n\nLe document qui part chez le comptable contient donc un chiffre que l'écran refuse d'afficher, alors que le dossier du lot affirme « au réel les cotisations s'écrivent « — », jamais estimées »."
    },
    {
      "titre": "Après « La base n'a pas confirmé… rien ne sera émis deux fois », un second clic sur « Émettre » crée une 2ᵉ facture pour la même vente",
      "gravite": "moyenne",
      "reproduction": "Sonde : /…/scripts/bancs/sonde-relire-incertain.cjs (harnais de fiscal.cjs, port 5982, profil micro en franchise).\n\nÉtape 1 : l'écriture de facture_* est rangée en base mais répond 503, et la recherche `meta->>jeton` répond 522. Résultat :\n- message affiché : « La base n'a pas confirmé l'écriture. Relis la liste avant de réessayer : rien ne sera émis deux fois. » ;\n- le formulaire reste ouvert, toujours rempli ;\n- en base : facture_2026_000001.\n\nÉtape 2 : la base répond de nouveau normalement, et on clique une seconde fois sur « Émettre la facture » dans le même formulaire. Résultat en base :\n`[{\"id\":\"facture_2026_000001\",\"design\":\"Paire inventée Q\",\"ttc\":4500,\"client\":\"Client Q\"},{\"id\":\"facture_2026_000002\",…même vente…}]`.\n\nLa liste affiche alors deux factures de 45,00 €. Cause : chaque clic tire un nouveau jeton, et l'app ne vérifie jamais le sourceId (`vinted:{tx}`) avant d'émettre. Un doublon dans la suite légale ne se corrige ensuite que par un avoir."
    },
    {
      "titre": "Une facture peut être émise sans aucune identité de client : le document imprime « Client » à la place du nom",
      "gravite": "moyenne",
      "reproduction": "Sonde : /…/scripts/bancs/sonde-relire-form.cjs (port 5982), profil société TVA facturée à 20 %, aux deux tailles.\n\nOn remplit seulement la désignation et le prix (120), puis on clique sur Émettre. Résultat :\n- la facture est émise ;\n- la ligne figée porte `client : {\"nom\":\"\",\"email\":\"\",\"adresse\":\"\"}` ;\n- le PDF de l'avoir qui suit affiche « Client Client » (le titre de rubrique, puis le nom de repli `c.nom || c.email || 'Client'` de corpsHtmlDocument).\n\nLe formulaire marque l'adresse du client « (facultatif) » et n'exige rien pour le nom. La demande voulait les mentions obligatoires respectées. L'art. 242 nonies A, ann. II CGI, cité par le lot lui-même, parle du nom et de l'adresse du client. Je n'ai pas pu vérifier le texte officiel d'ici (sources bloquées), mais le comportement est reproduit."
    },
    {
      "titre": "La nouvelle suite repart à 2026-000001 alors que les anciennes factures `vinted_invoices` portent déjà 2026-000001 et 2026-000002 : deux factures ont le même numéro la même année",
      "gravite": "basse",
      "reproduction": "Sonde : /…/scripts/bancs/sonde-relire-factures.cjs (port 5982), avec la ligne main du banc : ANCIENNES = 2026-000001 et 2026-000002, plus un profil franchise complet. On émet une facture.\n\nRésultat :\n- en base : facture_2026_000001, numéro 2026-000001 ;\n- export CSV : `[\"Facture\";\"2026-000001\", \"Facture (avant le 15 octobre)\";\"2026-000001\", …]` ;\n- à l'écran, « 2026-000001 » apparaît deux fois.\n\nCause : prochainRang ignore les anciennes factures.\n\nEn production (lecture seule, comptage seul), 0 ligne main sur 3 porte des vinted_invoices non vides. Le défaut est donc théorique aujourd'hui, mais rien ne le garde si une ancienne facture est créée avant la mise en ligne."
    },
    {
      "titre": "Deux traitements simultanés du même email de vente Pro émettent deux factures pour une seule vente",
      "gravite": "basse",
      "reproduction": "Sonde : /…/p1-relire-fiscal/scripts/sonde-relire-route.cjs. C'est la vraie route api/email-inbound, dans la base à état d'audit-facturation, avec un profil franchise complet. Le même email est envoyé deux fois à la fois, par `Promise.all([envoyer(E), envoyer(E)])`.\n\nRésultat :\n- réponses : HTTP 200 et 200 ;\n- documents émis : facture_2026_000001 et facture_2026_000002, tous deux `sourceId:\"email_sale_9x9wsq\"` et ttc 9900 ;\n- une seule ligne d'envoi, qui pointe vers 000001.\n\nLe contrôle par sourceId ne protège que des rejeux successifs. La seconde facture reste dans la suite, sans envoi, et seul un avoir peut l'annuler."
    },
    {
      "titre": "Une vente Pro reçue pendant que le profil est incomplet ne reçoit jamais sa facture, même une fois le profil complété",
      "gravite": "basse",
      "reproduction": "Même sonde (sonde-relire-route.cjs, scénario S1).\n\n1. Vente « New Balance » reçue avec un profil sans SIREN : HTTP 200, facture = {\"erreur\":\"profil\",\"manque\":[\"ton SIREN\"]}, 0 facture.\n2. On pose le SIREN : toujours 0 facture, et aucune ligne en attente à part email_journal.\n3. Une vente suivante arrive : sa facture est émise. Celle de « New Balance » ne l'est jamais.\n\nLa notification envoyée en (1) dit seulement « complète « Mon entreprise » dans Factures ». Elle laisse croire que la facture suivra une fois le profil complété, ce qui n'arrive pas."
    },
    {
      "titre": "Le suffixe « EI » est doublé quand le nom contient déjà (EI) ou « EI. »",
      "gravite": "basse",
      "reproduction": "Commande : `node --input-type=module -e \"import * as F from './api/_lib/facturation.js'; console.log(F.nomVendeur({forme:'micro', nom:'Julie Exemple (EI)'}))\"`, lancée dans la copie.\n\nSortie : `Julie Exemple (EI) EI`. La regex `(^|\\s)EI(\\s|$)` ne reconnaît ni « (EI) » ni « EI. ».\n\nLa même fonction alimente l'aperçu « Sur tes factures : « … » » et le nom figé dans chaque facture."
    },
    {
      "titre": "« Mon entreprise » : une fois les coordonnées remplies, rien n'indique à quoi correspond chaque champ ; placeholder coupé et texte répété",
      "gravite": "basse",
      "reproduction": "Captures :\n- …/scripts/bancs/z-fiscal-profil-390-sombre.png (banc fiscal.cjs, port 5981, tout vert). Les champs ne montrent plus que leurs valeurs, « 1 rue de la Mer », « 35260 », « Cancale », « FR11123456782 », « SAS », « 1000 », « Saint-Malo », sans aucun libellé visible : seul le placeholder servait de libellé. Rien ne dit que « Saint-Malo » est la ville du RCS et « Cancale » la ville de l'adresse, ni que « 1000 » est le capital.\n- …/scripts/bancs/zz-relire-julien-settings-390-clair.png : à 390 px, le placeholder affiche « Code posta ».\n\nAutres points :\n- L'en-tête annonce « Coordonnées sur tes factures · 4 à compléter », alors que l'un des 4 manques est « ton régime de TVA », qui n'est pas une coordonnée.\n- Dans la liste des factures (sonde-relire-form.cjs), chaque avoir dit deux fois la même chose : « Avoir · facture 2026-000001 », puis « Avoir sur la facture 2026-000001 — … » (§7)."
    }
  ],
  "verdict": "Le cœur du lot tient : profil, clés SIREN/SIRET/TVA, suite unique sans écrasement, documents figés avec empreinte, avoirs, et facture Pro serveur sans doublon au rejeu. Sur la copie de ab3e057, le banc fiscal.cjs est tout vert (port 5981), ainsi que audit-facturation, justificatif, urssaf, chiffres,"
}
```

## relire:annonces
```json
{
  "defauts": [
    {
      "titre": "Le filtre par plateforme reste actif d'un passage à l'autre, même quand sa source est en cours de lecture ou illisible. Résultat : « 0 annonce » dite comme un fait, et « Seulement Vinted » appliqué sur du « pas su », sans aucun bouton allumé.",
      "gravite": "moyenne",
      "reproduction": "Le filtre `annPlat` est rangé en session (`useVueSession('annonces-plateforme')`, src/App.jsx:23239) et appliqué sans regarder l'état des sources (src/App.jsx:25033). Les boutons, eux, disparaissent quand leur nombre vaut 0 ou que Leboncoin n'est pas lu.\n\nCopie de 48f41de, build fait dans la copie, données inventées du banc annonces-plateformes. Le premier passage est normal. On allume un filtre, on change d'écran, la lecture `lbc_ventes` répond 522, puis on revient sur Annonces.\n\nCommande : `node scratchpad/rel-ann-sondes/sonde1.cjs <copie>` (port 5922, 1512 px). Sortie :\n· filtre « Leboncoin » : `recap=\"0 annonce dans cette sélection\"`, « Aucune annonce ne correspond. », filtres visibles `ebay,demandee`, aucun n'est allumé ;\n· filtre « Seulement Vinted » : `\"4 annonces dans cette sélection\"`, cartes 9201,9203,9204,9206. La N°21 (9201) en fait partie alors qu'elle était prouvée sur Leboncoin au premier passage. C'est le « Seulement Vinted sur du pas su » que la garde du bouton devait empêcher.\n\nMême résultat à 390 px : `sonde1b.cjs`, retour par Accueil → Vinted → Annonces, capture rel-ann-sondes/retour-seul-390.png.\n\nIl suffit même que la lecture soit LENTE, sans aucune panne. `sonde3.cjs`, scénario B, lbc_ventes retardé de 4 s : à +800 ms et +1 600 ms, `\"0 annonce dans cette sélection\"` et « Aucune annonce ne correspond. » ; à +5 500 ms, les 2 bonnes cartes apparaissent.\n\nCaptures : /tmp/claude-0/-home-user-cancale-v67/31464966-7138-5129-91cc-9bcff32ecc28/scratchpad/rel-ann-sondes/retour-seul-1512.png, retour-lent-1512.png. Le banc annonces-plateformes ne couvre pas ce cas : il réinitialise avant chaque scénario."
    },
    {
      "titre": "La loupe (recherche globale) affiche encore « 🟠 Leboncoin » pour une publication seulement demandée, alors que la carte Annonces dit « Leboncoin à vérifier ». Le lot crée ainsi deux réponses à la même question (§11).",
      "gravite": "moyenne",
      "reproduction": "La recherche globale construit `gsData.lbc` à partir de `vinted_lbc_posted` (src/App.jsx:38724) et affiche `{p.onLbc && <span style={{color:LBC_ORANGE}}>🟠 Leboncoin</span>}` (src/App.jsx:40272). Ce fichier est justement celui que le lot déclare « demandée, jamais publiée ». Avant le lot, la carte et la loupe disaient la même chose (« Aussi sur Leboncoin » / « 🟠 Leboncoin »). Elles se contredisent maintenant.\n\nCommande : `node scratchpad/rel-ann-sondes/sonde4.cjs <copie>` (port 5924), aux deux tailles. Sortie :\n· `carte N°23 (Leboncoin demandée) : {\"plats\":\"vinted\",\"t\":\"compte_a Leboncoin à vérifier\"}` ;\n· `loupe « 23 » : [\"#23 (sans titre) 🟢 En ligne 🟠 Leboncoin ›\"]`.\n\nCapture : /tmp/claude-0/-home-user-cancale-v67/31464966-7138-5129-91cc-9bcff32ecc28/scratchpad/rel-ann-sondes/loupe-23-390.png.\n\nChez Julien, c'est la N°2 : `vinted_lbc_posted` = [10312441750], mesuré en lecture seule. La loupe dira « Leboncoin » en orange, une couleur hors palette, et la carte « à vérifier »."
    },
    {
      "titre": "Fiche « Où elle est » : quand les annonces eBay du compte n'ont pas pu être lues, elle affirme « eBay · aucune annonce reliée » au lieu de « pas pu lire ».",
      "gravite": "moyenne",
      "reproduction": "Quand la ligne `ebay_listings` d'un compte échoue, `lireEbayTous` rend quand même `items: []` avec `illisibles: [compte]`. Donc `presencesPaires` rend `ebay: 'lu'` (src/App.jsx:34854), et la fiche prend `src = presences.ebay` (src/App.jsx:31657) sans regarder `ebayIllisibles`.\n\nCommande : `node scratchpad/rel-ann-sondes/sonde3.cjs <copie>`, scénario A : ebay_listings en 522, 1512 px. Sortie :\n· ligne du haut : \"Compte eBay compte principal pas lu : ses logos peuvent manquer.\" ;\n· fiche N°22, dont l'annonce eBay porte VRM-22 : `\"ebay\":\"aucune | eBay aucune annonce reliée\"` ;\n· fiche N°25, même chose pour eBay.\n\nC'est « rien lu » présenté comme « rien », à deux centimètres de la ligne qui dit le contraire. Au passage, la ligne du haut écrit « Compte eBay compte principal pas lu » (`nomCompteEbay` rend « compte principal »).\n\nCapture : /tmp/claude-0/-home-user-cancale-v67/31464966-7138-5129-91cc-9bcff32ecc28/scratchpad/rel-ann-sondes/fiche-ebay522-1512.png."
    },
    {
      "titre": "Logo Leboncoin « en ligne » posé sur une observation vieille de plusieurs semaines : la carte ne la distingue pas d'une observation fraîche.",
      "gravite": "basse",
      "reproduction": "`presencesPaires` retient toute annonce Leboncoin au statut `active` (src/App.jsx:34838), sans aucune borne sur `seenAt`. Pour Vinted, le projet a pourtant fixé « une lecture de plus de 24 h ne compte plus en ligne ».\n\nCommande : `node scratchpad/rel-ann-sondes/sonde4.cjs <copie>`, avec l'annonce 6101 vue il y a 40 jours, aux deux tailles. Sortie :\n`carte N°21 : {\"plats\":\"vinted lbc\",\"titres\":[…,\"Leboncoin · Moi_LBC · en ligne · vue il y a 40 j\"]}`.\nLe logo est identique à celui d'une annonce vue aujourd'hui. Seule l'infobulle donne l'âge, avec une phrase qui se contredit (« en ligne · vue il y a 40 j »).\n\nChez Julien, en lecture seule : 7 de ses 8 annonces Leboncoin ont été vues pour la dernière fois le 20 septembre (25 jours). Dès qu'il les relie à une paire, elles porteront le logo « en ligne », alors qu'elles ont pu être vendues ou retirées depuis. La demande était : « jamais un logo sur … une déduction »."
    }
  ],
  "verdict": "J'ai relu le lot p1-annonces (48f41de) sur une copie git archive, build fait dans la copie, rendu aux deux tailles (390 et 1512 px), en clair et en sombre, sur les ports 5921 à 5924.\n\n**Ce qui tient.** Le banc du lot repasse à 100 % vert, et je l'ai vérifié en regardant les captures :\n- logos Vinted"
}
```
