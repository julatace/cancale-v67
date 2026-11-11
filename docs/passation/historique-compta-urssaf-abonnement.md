# Historique — compta-urssaf-abonnement

> Texte déplacé TEL QUEL depuis `CLAUDE.md` le 31 octobre 2026 (allègement du dossier : 1,36 Mo → moins de 60 Ko).
> Rien n'a été réécrit : les paragraphes gardent leur ordre d'origine. Le classement par thème est automatique (mots du titre) — en cas de doute, chercher par `grep` dans tous les `docs/passation/historique-*.md`.

> **29 octobre (revue 3) — Comptabilité, suivi URSSAF en trimestriel :** un seul trimestre noté (T3 = juillet, août,
> septembre) était encore dit deux fois — l'en-tête « 300,00 € déclarés sur 3 mois · cotisations ≈ 37,20 € » au-dessus de la
> ligne T3 qui dit la même chose. La revue 2 ne retirait le total que pour UN MOIS (`a.n === 1`) ; `suiviUrssaf` rend maintenant
> `annee.periodes` (périodes déclarées de l'année selon le rythme, un trimestre = trois mois) et l'en-tête dit « 1 période notée
> « déclarée » — son détail est juste en dessous ». Aucun chiffre ne change (`data-suivi-annee-ca` inchangé). Preuves : banc
> `compta-simple.cjs` scénario F (390 tactile clair, 1512 sombre) **4 rouges sur la branche d'avant (93824bf7)**, 0 après ;
> mutation « périodes comptées en mois » ⇒ 4 rouges ; banc entier 176 verts. Geste de Julien : aucun.

> **29 octobre (revue) — Comptabilité simple sur SA configuration :** mesuré (lecture seule) : sa ligne `main` est en micro,
> mensuel, **sans `vrm_micro_options`** — « Ta micro-entreprise » s'ouvre donc d'elle-même (règle de l'autre session, gardée) et
> poussait « Tes dépenses » à 3 768 px du haut au téléphone (plus loin qu'avant). **Les dépenses passent juste après la carte URSSAF
> du mois**, avant le suivi et la micro-entreprise (`StatutFiscal` prend `apresMois`, rendu dans TOUS ses états) : 1 741 px au
> téléphone, 1 367 à l'ordinateur. La carte CA s'appelle « Vendu et reçu », dit que sa période ne vaut que pour elle (le bénéfice a la
> sienne, deux libellés distincts) et ne montre plus d'en-tête de tableau vide (« Année »). URSSAF, une phrase une fois (§7) : le
> suivi ne redonne plus l'« à payer » du mois EN COURS (la carte du mois le dit), le calendrier marque d'une coche (sans redire
> « notée déclarée ») ; le titre replié de la micro-entreprise GARDE l'échéance (`suivi-urssaf.cjs` R l'exige : décision de l'autre
> session, pas défaite). « connu pour 1 vente » ; la facturation
> électronique renvoie à « Ton entreprise (Comptabilité → Avancé) » (« Profil fiscal » n'existait plus) ; le « ⓘ » du résultat ne
> dit plus que le bénéfice est « juste en dessous » (il est en haut). Réglages → Organisation dit à quoi sert l'écran. Aucun chiffre
> ne change. Preuves : `compta-simple.cjs` (131 contrôles) **24 rouges sur le code d'avant** (la branche avant cette revue), 0 après ;
> mutation (dépenses après la micro + tableau vide + « juste en dessous ») ⇒ 8 rouges ; `facturx.cjs` suit le nouveau geste.
> ⚠️ Non mesuré : sa vraie base dans l'app. Geste de Julien : aucun (répondre une fois « versement libératoire » referme le bloc).

> **29 octobre — COMPTABILITÉ SIMPLE :** Julien : « pour la compta, améliore tout, mets de côté la facturation électronique et
> fais quelque chose de simple ». **Aucune règle de calcul ne change (§11) : seul l'ordre change.** En haut, ce qu'il regarde :
> Vendu et reçu (`CaParPeriodeCarte`) → Bénéfice (`BeneficeCompta`) → URSSAF (`StatutFiscal` : carte du mois et prochaine
> échéance, « Suivi de tes déclarations URSSAF », puis « Ta micro-entreprise » repliée — le repli et son ouverture d'office sont
> ceux de l'autre session (« Comptabilité allégée », gardés tels quels à la fusion ; mon repli à moi est retiré : une règle pour une
> notion) → **Tes dépenses** (les montants, « Ajouter une dépense », les abonnements). En bas, **« Avancé », replié**
> (`data-compta-avance`) : résultat de l'année, récap mensuel (replié lui aussi, par l'autre session), packs, ton entreprise,
> factures, facturation électronique (Super PDP) — rien n'est supprimé, le sommaire (Vendu et reçu · Bénéfice · URSSAF · Dépenses ·
> Avancé) y mène et l'ouvre. La tuile « Bénéfice — · saisis tes prix d'achat » de la carte URSSAF est retirée : le bénéfice a sa
> carte juste au-dessus (§7, une notion une fois). Preuves : banc `compta-simple.cjs` (port 9311, données inventées, 390 tactile
> clair + 1512 sombre ; 107 contrôles ; `SHOTS=dossier` capture tout l'écran) — **38 rouges sur origin/main (cadafd4)**, et les
> mêmes chiffres sur les deux codes (vendu 60 €, reçu 60 €, bénéfice net −2,93 €, à payer 37,20 €, dépenses du mois 25,49 €,
> résultat 321,52 €) ; 3 mutations rouges sur le code fusionné (« Avancé » ouvert d'office : 12 · Organisation remise au menu : 2 ·
> « Bénéfice — » redit : 2). Les bancs qui lisent les cartes rangées (chiffres-croises, compta-abonnements, compta-stock-ui,
> entreprise-stream, facturx, stats-compta, superpdp) ouvrent « Avancé » d'un toucher, comme lui (`scripts/bancs/_compta.cjs`,
> sans effet sur un code d'avant). ⚠️ Non mesuré : sa vraie base. Geste de Julien : aucun.

> **29 octobre (suite, « c'est trop incompréhensible ») — Comptabilité allégée :** « Ta micro-entreprise » (calendrier,
> seuils, profil, impôts) est REPLIÉE sous une ligne-résumé (taux · prochaine période à déclarer · seuils et impôts,
> `data-micro-repli`) et s'ouvre d'elle-même si quelque chose demande son attention (versement libératoire pas répondu,
> seuil proche ou dépassé : `data-micro-attention`). Le récap comptable mensuel est replié aussi (`data-recap-repli`).
> « Vestiaire Co : pas encore relié » retiré de la carte URSSAF (dit à tous, n'apprenait rien) ; une vente Leboncoin sans
> date renvoie à la saisie. Banc `suivi-urssaf.cjs` section R (replié par défaut, résumé, un geste l'ouvre).

> **29 octobre — Comptabilité plus pro (mise en page) :** l'URSSAF « à faire » d'abord (carte du mois + prochaine
> échéance, puis le suivi), ensuite calendrier · seuils · profil · déclaration de revenus, en GRILLE sur ordinateur
> (`vrm-micro-grille`, deux colonnes ≥ 2 × 440 px), une colonne au téléphone. Les titres « Ton bénéfice », « Ta déclaration
> URSSAF », « Tes charges », les sections et le récap ont tous le même style (15 px, 600, encre, `data-titre-section`) —
> plus de petites capitales grises à côté de titres en gras. Récap mensuel : plus d'emoji, « Exporter (CSV) » en bouton
> secondaire (§7 : un seul aplat d'accent). « Par mois / Par trimestre » (tenait mal à 390 px), espaces insécables
> (« URSSAF ? », « « Compléter » »), « VRM ne remplace pas un comptable » (au lieu de « Je ne suis pas comptable »).
> Aucune règle de calcul touchée. Banc `suivi-urssaf.cjs` : `SHOTS=dossier` capture maintenant tout l'écran.

> **29 octobre — LE REÇU D'ACHAT REÇU PAR EMAIL, SUR LA LIGNE DE CHAQUE ACHAT (Achats) :** Julien : « essaie pour les achats
> de mettre en place les factures si tu les reçois par mail ». **Mesuré (lecture seule)** : 81 reçus Vinted (« Ton reçu pour la
> commande « … » »), **0 PDF**, `transaction` **vide sur les 117** lignes `email_achat_*` (l'astérisque du gras cassait le motif) ;
> par ce n°, **61 reçus = 61 achats distincts** captés ; **20 ne correspondent à aucun achat capté** — dont 2 dont le n° est dans
> SES ventes (achat d'un de ses comptes à un autre), le reste **cause non mesurée** ; **70 des 81 ne nomment aucun compte**.
> **Fait** : règle partagée `api/_lib/recu-achat.js` (§11) — n° lu ligne par ligne, gras retiré ; un achat se relie par SON n° et
> rien d'autre (repli par TITRE retiré, §5) ; les lignes d'un même n° = le même achat (PDF, puis détaillée, puis récente) ;
> « pas su » ne relie rien. Le serveur range le n° dans `transaction` mais garde **une clé PAR EMAIL** (sujet + début du texte +
> n° + PDF) — ⚠️ revue : le premier jet rangeait sous `email_achat_{n°}` et la copie « TR: » d'un reçu ÉCRASAIT le premier, PDF
> compris. Sur la ligne de l'achat : « Reçu d'achat » (`data-achat-facture`, 44 px touchables, y compris sur un achat en litige),
> qui ouvre la feuille ; un PDF joint ne se lit qu'au clic (§4.4). **Un nom pour ce document** (`NOM_RECU_ACHAT`) sur la ligne,
> le menu ⋯, la feuille et la visionneuse — pas « facture » : Vinted envoie un reçu de paiement, aucune facture entre
> particuliers (§5). L'archive (`bilanRecusAchat`) compte les ACHATS reliés (n° distincts), dit à part les reçus sans n° et
> ceux dont le n° n'est porté par aucun achat affiché, ne compare rien pour un compte dont les achats n'ont pas pu être lus
> (« pas su », compte NOMMÉ) — aucune cause devinée. Preuves : `audit-facture-achat.cjs` (la vraie route ; 11 mutations
> rouges, dont `cle-tx` = le premier jet), `audit-identite` §12 sur la RÈGLE exécutée (50+50 reçus au même titre), banc
> `facture-achat.cjs` (390 clair/sombre, 1512, reçus illisibles, litige au doigt, compte pas lu ; 23 rouges sur la branche
> d'avant la revue, 44 sur origin/main), `csp.cjs` injecte la règle partagée (il mourait sur `transactionDeLaLigne`).
> ⚠️ Non mesuré : un vrai reçu avec PDF joint ; un vrai email après déploiement ; la projection `data->>texte` sur SA base.
> **Gestes de Julien** : (1) s'il veut d'autres reçus, faire suivre les emails Vinted de ses autres comptes vers son adresse
> VRM (Réglages → Mes adresses de réception) ; (2) le mot : il avait dit « factures » — s'il y tient malgré §5, c'est
> `NOM_RECU_ACHAT`, une ligne.

> **29 octobre — rattraper les mois d'un coup, et un rappel 3 jours avant l'échéance :** « Noter mes N mois à la suite »
> (Suivi URSSAF, dès 2 mois « pas notée »/« à déclarer ») ouvre le rapport sur le plus ancien ; « Enregistrer » ouvre
> le suivant (`SERIE_DECLARATION`, `allerMoisSuivantSerie` : même formulaire, mêmes gardes) ; « Pas encore déclaré — mois
> suivant » passe sans rien noter ; « Arrêter » ; 30 min sans geste ⇒ série oubliée. Cron du matin :
> `rappelAvantEcheance` (api/_lib/rappel-urssaf.js) — 3 jours ou moins avant la date limite, période pas notée, une fois
> par échéance (`urssaf_reminder_dedup.veille`), même texte et montant que le 1er ; réglages/mémo illisibles ⇒ rien.
> Preuves : `audit-rappel-echeance.cjs` (9 ; mutations seuil/declare/passu rouges), banc `suivi-urssaf.cjs` S (mutation
> « pas d'enchaînement » ⇒ 4 KO).

> **29 octobre — TA MICRO-ENTREPRISE : profil, calendrier, seuils (Comptabilité) :** Julien : « une jauge plafond + seuil de TVA,
> vérifie les seuils officiels 2026 », « vois si la personne a choisi le versement libératoire », « mensuel : elle déclare août
> mais paie en septembre », « plus pro ». **Vérifié sur service-public.gouv.fr le 29 oct.** : plafond vente de marchandises
> **203 100 €** (188 700 € ne vaut plus ; dépassé 2 ans de suite ⇒ sortie au 1er janvier suivant) ; franchise de TVA **85 000 €**
> (dépassé ⇒ TVA au 1er janvier suivant) et seuil majoré **93 500 €** (⇒ TVA dès le jour du dépassement) ; versement libératoire
> +1 %, payé avec les cotisations au même rythme, RFR N-2 < 29 579 € (personne seule), option avant le 30 sept. pour l'année
> suivante ; l'URSSAF ne propose que mensuel ou trimestriel (pas d'annuel). Règle pure `src/microEntreprise.js` (`SEUILS_MICRO` par
> année — une année sans chiffres vérifiés ⇒ la jauge se tait ; `jaugeSeuils` sur la ligne publiée `vinted_urssaf_mois`, « au
> moins » si une plateforme pas lue ou des ventes sans date, N-1 jugé seulement comme MINIMUM, projection après 60 j et jamais sur
> un partiel ; `calendrierUrssaf` : le mois M se déclare ET se paie du 1er au dernier jour de M+1, trimestres 30/04 · 31/07 · 31/10
> · 31/01 ; `optionsMicro`). `MicroEntreprise` (App.jsx) remplace la carte du taux : « Ton profil URSSAF » (rythme — UN réglage
> `vinted_urssaf_freq`, la carte du mois n'a plus son propre choix et le suit, `useFreqUrssaf` — ; versement libératoire DEMANDÉ
> dans `vrm_micro_options`, synchronisé, `null` = « À confirmer », jamais deviné ; ACRE ; taux détaillé ligne par ligne, un taux
> posé à la main n'est jamais réécrit), « Ton calendrier » (3 échéances, ✓ si notée), « Tes seuils {année} » (deux jauges, ambre
> seulement si proche/dépassé). Le mot « encaissé » reste interdit à l'écran (`audit-urssaf`) : « Reçu en 2026 ». Preuves :
> `audit-micro-entreprise.cjs` (20 ; 7 mutations rouges), banc `suivi-urssaf.cjs` section M (profil, question VL, « Non » rangé,
> rythme partagé ; 390/1512). ⚠️ Non mesuré : sa vraie base ; le CA de l'année n'est que ce que VRM a capté (plateformes reliées).

> **29 octobre — « il a laissé en brouillon : pas plus de 15 actions par heure » (5.282) :** une republication comptait
> **5** actions (garde de départ, brouillon, suppression, garde de la mise en ligne, mise en ligne) ; avec la mise en ligne
> planifiée (5.279), d'autres paires passaient entre-temps et la mise en ligne était REFUSÉE par la borne des commandes de
> l'app (15/h) — l'ancienne annonce déjà supprimée, il ne restait qu'un brouillon. Désormais la paire RÉSERVE ses 3 gestes
> (2 pour « En ligne → brouillon ») d'un coup avant le premier (`gardeStricte({actions})`, `compterAction(…, n)`) ; plus
> de place ⇒ rien ne part, l'annonce reste en ligne, c'est dit ; la mise en ligne ne revérifie que le compte et la pause.
> Le plafond (20/h, 15 pour l'app — avant la 5.283 : aujourd'hui 50/h, 45 pour l'app) n'a PAS bougé (§3) : 5 republications par heure et par compte au plus (aujourd'hui 15). Preuve :
> `audit-recreer.cjs` §Q (147 ; 2 rouges sur origin/main : « brouillon-a-refaire … 15 actions »).

> **29 octobre (suite, « parfait ») — le suivi URSSAF corrigé et complété :** ⚠️ la 1ʳᵉ version affichait « payé » le champ
> `montant` du registre — c'est le **CA TAPÉ depuis son espace URSSAF**, pas un paiement. Désormais : déclaré = `montant` s'il
> est tapé, sinon `ca` (VRM au moment de noter) ; un champ **`paye`** (cotisations payées, facultatif) dans le formulaire du
> rapport et dans « Compléter » / « Corriger les montants » du suivi (`completerDeclaration` : mois déjà noté exigé, ventes
> `ids` et date intactes, sur son clic ; `lireMontantSaisi` refuse « 12,345 »). Année : CA déclaré + cotisations payées, sinon
> estimées (dit). Échéance à ≤ 7 j en ambre, « à régulariser » totalisé avec ses cotisations, export CSV (`suiviUrssafCsv`),
> rythme suivi au nuage. Le rapport relit le registre sur `vrm:save` (sinon il effaçait une complétion). Preuves :
> `audit-suivi-urssaf.cjs` (21 ; 15 rouges sur `main` ; `--prouve` 7 rouges), banc `suivi-urssaf.cjs` (390/1512 ; 10 KO sur
> `main`), `audit-urssaf` admet ce 3ᵉ écrivain (il ne crée rien).

> **29 octobre — un VRAI suivi de ses déclarations URSSAF (Comptabilité) :** Julien : « pour l'URSSAF fait un vrai suivi ».
> Carte « Suivi de tes déclarations URSSAF » (`SuiviUrssaf`, sous la carte URSSAF, règle pure `suiviUrssaf` +
> `periodesUrssaf`) : une ligne par période des 12 derniers mois (mois ou trimestre, SON rythme) — échéance, état
> (`declaree` notée « déclarée » le … · `a_declarer` · `en_retard` = « Pas notée », échéance passée · `en_cours`), ce qu'il
> a DÉCLARÉ (CA et montant notés par « J'ai déclaré ce mois », `vrm_urssaf_declare`) et ce que VRM compte AUJOURD'HUI
> (`montantPeriodeUrssaf`, §11). L'écart se DIT, jamais corrigé (moins : ventes déclarées plus dans VRM — compte retiré,
> vente annulée ; plus : à régulariser) ; un chiffre « au moins » n'affirme aucun écart. Total de l'année (CA déclaré,
> cotisations notées sinon estimées). « C'est déclaré » passe par le formulaire du rapport (`demanderDeclaration`).
> Registre pas lu ⇒ « pas su », aucune période dite pas notée. Preuves : `audit-suivi-urssaf.cjs` (13 ; `--prouve` 3
> rouges), banc `declare-urssaf.cjs` A (+1 contrôle par taille ; ses 5 rouges E/F le sont déjà sur `main`).

> **29 octobre — shop_cancale : TOUT est retiré, ventes comprises (sa décision) :** Julien : « en vrai retire tout de ce
> compte » (après lui avoir dit que ses ventes sortaient alors de son CA déclaré). Un compte supprimé pour de bon
> (`vrm_blocked_accounts`, rangé sur l'appareil `vrm_comptes_supprimes`) ne sort plus d'AUCUNE lecture :
> `src/comptesSupprimes.js` filtre `fetch` (toute ligne `harvest_{uid}_…` de ce compte, lectures GET non paginées) et
> `lireTout` filtre après la pagination (une page raccourcie l'aurait arrêtée). Rien n'est effacé en base ; « pas su »
> (liste illisible) ne retire rien ; les écritures passent (purge, suppression). Les écrans par compte lié l'excluaient
> déjà ; ce sont les balayages de famille (Stock, recherche, porte-monnaie, profils, suivis, relevés…) qui le ramassaient.
> Preuve : `audit-comptes-supprimes.cjs` (13 ; 3 rouges sur l'avant ; `--prouve` 4 rouges). ⚠️ Non mesuré : sa vraie base
> (pas de connecteur VRM). Un email (bordereau, suivi) de ce compte n'est pas relié à un compte : il reste.

> ⛔ **28 octobre — DÉCISION DE JULIEN : VRM RESTE SUR LA FRANCE.** Question posée : « est-ce que les
> Américains peuvent utiliser VRM ? » — réponse : pas vraiment (Vinted absent des États-Unis, argent en euros
> seulement, URSSAF/DAC7, CGV et app en français). Julien : « reste sur la France pour l'instant mais fais ça
> bien ». ⇒ Aucun chantier international (traduction, dollars, comptabilité étrangère, Depop/Poshmark/
> Mercari) sans qu'il le redemande. Les comptes eBay.co.uk/.com déjà gérés (26 oct.) restent, sans plus.
> La priorité : que tout ce qui est français soit juste et fiable.

> **29 octobre — PLUS DE VENTES MASQUÉES, et le Stock 3D écarte les comptes supprimés :** Julien : « on ne doit plus pouvoir
> les masquer ». Le bouton ✕ / « Masquer de la compta » d'une vente, « Supprimer cette annulation », le masquage d'un colis
> sans bordereau et l'onglet « Ventes masquées » de l'écran Masqués sont RETIRÉS ; `vinted_sales_hidden` n'est plus lu
> nulle part (`VENTES_MASQUEES_AUCUNE`, app ; widget et rappels côté serveur) — la ligne reste en base, ignorée, et une
> vente masquée d'avant compte de nouveau partout (Vendu, Finalisé, bénéfice, colis à poster). Les ACHATS masqués restent.
> Et « j'avais demandé de supprimer les annonces et elles réapparaissent dans le stock » (shop_cancale) : la vue 3D
> (`fichesStockToutes`) n'appliquait pas `comptesStockEcartes` ; elle l'applique, et celle-ci écarte aussi les comptes
> supprimés pour de bon (`vrm_comptes_supprimes`, rangée sur l'appareil par `fetchVintedAccounts` sur une lecture réussie).
> ⚠️ Non mesuré : sa vraie base (connecteur Supabase de la session sans le projet VRM) — la cause exacte chez lui n'est
> pas prouvée. Preuves : bancs `stock-plateformes` (+ fiche shop_cancale), `bilan-semaine`, `audit-reel-20oct` B,
> `audit-colis-heure` mis à la décision ; `stock-partis` ouvre « Ma pièce ».

> **27 octobre (soir) — le STATUT FISCAL s'adapte à la personne, et les vrais taux :** Julien : « des gens
> sont en société, d'autres pas revendeurs ; ils n'ont pas besoin du taux URSSAF » et « base-toi sur de
> vrais taux ». Mesuré : 4 vendeurs sur 6 n'avaient JAMAIS choisi de régime et recevaient le rappel
> URSSAF (un « marge » aussi). UNE règle (`regimeFiscal`, `urssafConcerne`, `REGIMES_FISCAUX` :
> particulier · micro · société · marge ; jamais choisi = `null`, plus de repli sur « micro ») pour le
> rappel de Ma journée, la notification du 1er (`api/_lib/rappel-urssaf.js` lit `vinted_regime` ;
> illisible ⇒ rien), les cotisations du bénéfice (`sansCotis`), les rapports (`libelleRegime`, taux 0
> hors micro). Comptabilité → `StatutFiscal` : la question (jamais au démarrage), ou la carte du statut,
> ou (micro) le taux composé par ses options. Taux : `TAUX_MICRO` achat-revente BIC 12,3 % + CFP 0,1 % =
> **12,4 %** (défaut, était 13,5 % sans source), versement libératoire +1 %, ACRE 6,2 %. Julien
> (`micro`, aucun taux rangé) passe de 13,5 à 12,4 % : le bouton « Versement libératoire » donne 13,4 %.
> Banc `statut-fiscal.cjs` (20 rouges sur l'avant) ; `audit-rappel-urssaf` (mutations `serveur-statut`,
> `serveur-passu` rouges). ⚠️ Taux lus sur des sources secondaires (urssaf.fr bloqué d'ici).

> **26 octobre — Colis et Ma journée, même traitement :** Ma journée au téléphone : dans la
> carte « Vendu », « Reçu en … » et « Chiffre d'affaires {année} » se CHEVAUCHAIENT (la règle
> de `styles-mobile-studio.css` rangeait UN bloc dans une colonne à droite ; le second s'y
> empilait) — chacun a maintenant sa ligne. Ordinateur : bonjour, date (« lundi 26 octobre »,
> plus « Lundi 26 Octobre ») et « N choses à faire » sur une ligne ; « En attente » en haut de
> sa carte. Colis : la date limite d'une carte revient à la ligne (elle débordait à 390 px) et
> un retard est ambre, plus rouge (§7 ; idem cartes eBay) ; « ✓ Ventes Vinted à jour » ne
> s'affiche plus quand tout est à jour (l'alerte d'une capture ancienne reste) ; imprimante
> et son explication sur une ligne. CSS dans `styles-annonces-ventes.css` (chargé en dernier).
> Banc `annonces-ventes-brouillon.cjs` (vues `cat_bord`, `journee`) : 7 rouges sur main, vert
> après (les contrôles de la ligne de date limite n'ont rien à mesurer sur l'avant : la
> capture montrait le débordement et le rouge).

> **26 octobre (soir) — les bancs rouges réparés, tous en retard sur le code (l'app intacte) :**
> stats-compta (détail replié), retours-stock (base cloisonnée, sinon rien ne part au nuage),
> glisser-onglet (balayage souris retiré le 24 oct. ⇒ l'autre sens au doigt), revendeurs (le
> rappel URSSAF de fin de mois faisait dépendre la vue globale de la DATE), messages-priorite
> (« Envoyer l'offre » dans un repli), extension-leboncoin-installee (Chrome 153 : prendre le
> service worker VIVANT, servir la session privée `members/me/account`), audits supprimees,
> impression, politique-hotes. `audit-preuve-vente` et `session` exigent l'historique Git
> complet (`git fetch --unshallow`). **Chrome 153 (chromium-1243)** : une extension posée par
> CDP n'est plus rechargée au redémarrage ⇒ `--load-extension` ; et une extension
> `--load-extension` rechargée (⟳) DISPARAÎT ⇒ `session` G/P : la réparation automatique n'est
> pas mesurable ici (4 rouges, limite du navigateur, pas de l'app).

> ⛔⛔ **DÉCISION DE JULIEN, 22 OCTOBRE : PAS DE DOUBLE VÉRIFICATION PAR SMS — C'EST PAYANT.**
> Mesuré dans la doc Supabase (« Advanced MFA Phone ») : **75 $/mois** pour le premier projet,
> hors plafond de dépenses, **plus** chaque SMS facturé par Twilio/MessageBird. Julien : « si c'est
> payant ne fais pas, essaie de trouver autre chose ». ⇒ La branche `codex/mfa-sms` **n'est PAS
> fusionnée** et rien ne propose le SMS. **Le chantier devient « double vérification GRATUITE »** :
> la vérification par app d'authentification (TOTP, Réglages → Mon compte → Double vérification,
> déjà sur `main`, gratuite, marche avec l'app « Mots de passe » de l'iPhone) reste LA méthode ; ce
> qui manque est un **chemin de secours gratuit** quand le téléphone est perdu : permettre
> d'ajouter **un second appareil** (un second facteur TOTP — Supabase en accepte plusieurs ; c'est
> la recommandation de sa doc faute de codes de secours), le nommer, le retirer, et le dire sur
> l'écran du code. Les clés d'accès (WebAuthn/passkey) ne sont qu'**expérimentales** chez Supabase
> au 22 octobre : ne pas les livrer. Jamais rien de payant, jamais une invitation forcée au
> démarrage (retirée à sa demande).

### Le reçu d'achat part chez un comptable
Il dit **qui achète** (l'entité des Factures : raison sociale, adresse, SIRET —
pendant des mois il disait « Ma boutique »), et il dit **qu'il n'est pas la
facture de Vinted** (Vinted n'en émet aucune entre particuliers). La photo passe
par l'extension : le CDN Vinted ne renvoie aucun en-tête CORS.
`scripts/audit-justificatif.cjs` protège ces deux points.


### L'argent : « en attente » et « disponible » ne se confondent jamais
Mesuré le 7 septembre sur ses **neuf porte-monnaie** (`harvest_{uid}_billing`) :
**281,94 € disponibles** à virer, à côté de **2 235,80 € retenus** par Vinted.
Ce sont les chiffres de Vinted, pas une estimation — l'accueil ne montrait que
l'attente, et le disponible ne vivait que dans une phrase d'explication de
l'écran Statistiques. Les deux sont maintenant sur la ligne d'accueil, sur deux
lignes et avec deux mots différents (`escrow`/`main` — jamais `balance` mélangé,
§5.14), et un solde de plus de 7 jours annonce son âge.
⚠️ **Le RELEVÉ daté : ce paragraphe disait le contraire de §8, corrigé le
8 septembre.** Il affirmait « introuvable — Vinted ne charge le relevé que si
on ouvre cette page-là ». C'était vrai de la voie PASSIVE : sous `billing`,
l'extension ne capte que le **solde** (`{main, escrow}`). Mais depuis la
**5.52** `capterReleves` va le chercher activement
(`/api/v2/users/{pid}/payouts?year=&month=`, borné, `garde`, un compte marqué
muet s'il ignore le paramètre). `harvest_*_releve_*` = 0 ligne chez lui **parce
que son extension est plus ancienne**, pas parce que la donnée n'existe pas.
Deux sections du dossier se contredisaient sur le même fait — ne pas relire §8
en croyant celle-ci.


### Factures : un pipeline MORT, appelé toutes les 5 minutes
Mesuré le 9 septembre. L'écran Factures appelait `fetchVintedInvoices` — un
**Google Apps Script** (`script.google.com/macros/s/…/exec`) — **au montage et
toutes les 5 minutes**, en silence (`silencieux=true`, donc aucun message).
Interrogé : **404**, réponse HTML. `res.json()` levait, le `catch` avalait, et
l'écran retentait indéfiniment un endpoint qui n'existe plus.
⚠️ Et l'écran vide **disait à Julien** « elles arrivent de tes emails Vinted,
**par ta feuille Google** », avec un bouton « Aller les chercher maintenant » :
il pouvait attendre des factures qui ne pouvaient **pas** arriver, et cliquer
sur un bouton qui ne pouvait **que** échouer — en affichant « Erreur
récupération : … », du vocabulaire d'informaticien par-dessus le marché.
⚠️⚠️ **Le dossier annonçait cette architecture retirée le 30 août** (« plus
AUCUN appelant ») : **c'était faux**, ce caller-ci avait survécu. Même famille
que le tiroir `Nav` — sauf qu'ici le code mort **tournait**. *Une suppression
« terminée » se vérifie sur ce qui RESTE, y compris des mois après.*
⇒ La vraie source vit juste à côté : `fetchProInvoices` lit `email_invoice_*`
en base (les reçus Vinted arrivés par email, `api/email-inbound`). C'est elle
que la boucle des 5 minutes et le bouton relisent maintenant, et c'est elle que
l'écran vide nomme. La porte proposée est « + Nouvelle facture », qui marche.
⚠️ **Et l'URL `/exec` est une URL-CAPACITÉ dans un dépôt PUBLIC** : elle suffit
à invoquer le script, sans mot de passe. `audit-secrets.cjs` la refuse
désormais — elle était morte, mais un Apps Script se redéploie.


### ⚠️⚠️⚠️ « CITÉE DANS UNE TRANSACTION » N'EST PAS « VENDUE » — 15 PAIRES ÉCARTÉES
**Le défaut le plus coûteux de la journée, et il vient de MOI** : `lireVentesProuvees`
(écrite le 15 septembre) prenait **tout `item_id`** vu dans `harvest_*_txn_*`.
En vérifiant la FORME (§6) : sur les **711 lignes**, **468 portent `status: 1` et
un `status_title` VIDE** — ce sont des **conversations**, pas des ventes. Une
seule annonce en portait **treize** (« salomon XT-6 blanc taille 40 », **toujours
en ligne**) : treize acheteurs lui ont écrit, aucun n'a acheté.
⇒ Conséquence sur ses **65 annonces en ligne** : la « preuve » en écartait **15**
des files Leboncoin et eBay — **quinze paires qu'il a encore**, qu'il ne pouvait
donc plus publier ailleurs. Avec un vrai état de commande : **zéro**.
⚠️ **Et c'est ce qui l'a rendue invisible** : sur les **412 annonces FERMÉES** la
preuve tenait (188 états de vente). Elle avait donc l'air juste partout où on la
regardait — sauf là où elle coûtait.
- Une vente est prouvée quand Vinted donne un **état de commande** à la
  transaction (`status_title` non vide) **et** que cet état ne la fait pas
  REVENIR (`PAS_UNE_VENTE` : annulée, retour, suspendue, paiement échoué).
- ⚠️ **On ne liste pas de codes numériques** : un état inconnu demain doit
  compter comme une **vente**, sinon une paire vendue réapparaît dans la file le
  jour où Vinted en ajoute un — le défaut que cette preuve corrigeait. L'audit
  sert exprès « un état que je ne connais pas encore ».
- La règle est la **même des deux côtés** (`PAS_UNE_VENTE` dans l'app et dans
  l'extension) : une seule des deux corrigée, et les deux écrans divergent (§11).
- Mesuré après, sur la vraie base : **file Leboncoin 49 → 64**, panneau
  **58 → 63 annonces en ligne**, valeur du stock **3 461 → 3 653 €**.
⚠️ **ET MON AUDIT EST PASSÉ VERT POUR LA MAUVAISE RAISON.** `lireVentesProuvees`
est **async**, et je ne l'`await`ais pas : `r.vendus` valait `undefined` sur une
Promise, donc « rien n'est vendu » — les contrôles qui attendent une **absence**
passaient, seuls ceux qui attendent une présence tombaient. *Un contrôle vert par
accident est pire qu'absent.* (Et `instanceof Set` est FAUX dans un `vm` : il a
son propre realm — on teste que l'objet sait répondre `has`, pas sa lignée.)
⚠️ **TROISIÈME FOIS QUE MON BANC SERT UNE FORME QUE LE CODE NE LIT PLUS** (§6.3) :
`audit-places.cjs` servait une ligne txn **sans** `status_title` — c'est-à-dire
une conversation — et s'étonnait qu'elle ne prouve rien. Ses fixtures portent
l'état.


### ⚠️⚠️ « APPUIE SUR PUBLIER SANS BOOSTER » — AUTORISÉ, MAIS GATED SUR UNE MESURE (LE BOOST = DE L'ARGENT)
Julien, 20 sept. : « si tout est parfait dans l'app et la publication, je veux que
ce soit TOI qui appuies sur publier **sans booster**, ça me dérange pas du tout ».
C'est un **renversement de la règle** « publier reste manuel » — et c'est **SA
décision d'owner**, elle n'est pas à re-négocier. Mais elle a une condition qu'il
pose lui-même (« **si tout est parfait** ») et un risque unique dans tout le
projet : **le boost coûte de l'argent**.
**Mesuré** (`lbc_recon.etapes`) : le dépôt passe par une étape
`deposer-une-annonce/options` portant `gallery | gallery30 | daily_bump |
daily_bump30 | sub_toplist | urgent` — **les options PAYANTES**. « Publier sans
booster » = traverser cette étape en **ne cochant AUCUNE** option payante, puis
cliquer le publier **gratuit**. Or **je n'ai jamais vu** cette étape jusqu'au
bout (ses dépôts se sont arrêtés avant), ni le bouton final, ni s'il y a une
confirmation/paiement derrière.
⇒ **Écrire le clic « Publier » à l'aveugle à travers une page d'options payantes,
c'est risquer de cocher un boost — dépenser son argent. C'est le SEUL défaut pire
qu'un clic manuel.** Donc, fidèle à tout le dossier (*ne pas promettre / cliquer
ce qu'on n'a pas mesuré*) : **pas de clic automatique tant que je n'ai pas la
carte réelle de l'étape options + publication.**
- L'enregistreur d'étapes (`captureDepositForm`) capte DÉJÀ chaque étape, options
  comprise — **un seul dépôt mené jusqu'à « Publier » (à la main, gratuit)** me
  donne : les vrais libellés/état par défaut des toggles de boost, et le bouton
  de publication gratuite. **Ensuite** je câble le clic, **gaté** : ne cliquer le
  publier que si **zéro** option payante n'est active, **jamais** un bouton de
  boost/paiement (la garde `BTN_PUBLIER`/boost), et seulement quand les champs
  requis sont remplis. Prouvé au banc sur la vraie forme (comme le reste).
- ⚠️ **Ce n'est pas un refus** — c'est l'ordre correct : mesurer l'étape qui
  engage de l'argent AVANT de l'automatiser. Le clic « Continuer » entre étapes
  non-payantes est déjà automatique ; il ne reste que la dernière page.


### ⚠️⚠️ « L'EXTENSION FAIT TOUT » — PUBLIER SANS BOOSTER, ET UN SEUL BOUTON
Julien, 20 sept. : « est-ce que l'extension publie jusqu'à publier sans
booster ? enlève Tout préparer / Pré-remplir / machin, je veux juste que ce soit
téléversé sur le Bon Coin. Maintenant l'extension fait tout. » Deux volets.

**1. Auto-publication SANS booster — livrée, mesurée sûre.** Le dossier différait
ça sur le risque ARGENT (cocher un boost). **Mesuré** (`lbc_recon.etapes`) :
l'étape options ne porte que **6 CASES À COCHER de boost** (gallery, gallery30,
daily_bump, daily_bump30, sub_toplist, urgent) — inspectables — et la page
`/confirmation` prouve que la voie GRATUITE existe et se termine là.
⇒ `publierSansBooster()` (lbc.js) : **décoche toute option payante** ; s'il en
reste une cochée → **on NE publie pas** (on le dit) ; puis clique un bouton de
publication qui matche `publier|déposer mon/l'annonce|mettre en ligne|valider`
**et jamais** un bouton portant un PRIX (`€`, `9,90`, booster, remont, payer,
premium, pack, option). Bouton introuvable ⇒ rien de cliqué, il publie à la main.
- **Gaté sur SA main** : ne se déclenche que pour une paire lancée par le bouton
  (`pending.publier === true`, posé au clic), à l'**étape des boosts** (mesurée),
  et seulement si des **photos ont été envoyées** (sinon Leboncoin refuse). Une
  fois ; après succès, la paire sort de la file (`markPosted`) et `pending` est
  effacé — jamais deux publications.
- ⚠️ **Le clic « Publier » n'est plus interdit — c'est SA décision d'owner**,
  répétée. La garde `BTN_PUBLIER` de `cliquerContinuer` (enchaînement d'étapes)
  reste : on n'AVANCE que par « Continuer », et la publication est un geste
  séparé, borné à `publierSansBooster`.
- `bancs/leboncoin.cjs` : fixture `boost` (cases de boost + un bouton GRATUIT +
  un bouton PAYANT à 9,90 € placé AVANT). **Boosts tous décochés, bouton gratuit
  cliqué 1×, bouton payant JAMAIS.** §6.1 : en retirant la garde « prix », le
  bouton PAYANT est cliqué (`__paid=1`) — la garde protège de la dépense.

**2. Un seul bouton, plus de « machin ».** La carte n'a plus que **🚀 Publier sur
Leboncoin** (ouvre le dépôt + remplit tout + publie sans booster) et **✓ Je l'ai
déjà publiée**. Retirés : Pré-remplir, Titre, Description, Prix, ⬇️ Photos — le
remplissage est **automatique** sur la page de dépôt (`autoPrefill`). Le bandeau
du dépôt n'a plus « Re-remplir »/« Copier la description » ; il montre l'état et
un **↻ Reprendre** qui n'apparaît QUE si le remplissage cale (filet).
- ⚠️ Bancs mis à jour : le pré-remplissage se teste par la voie AUTO (`getPending`
  → la page se remplit seule), plus par un bouton disparu ; et une page de
  **recherche** n'est jamais auto-remplie (garde d'URL de `autoPrefill` — le prix
  n'atterrit pas dans un filtre). Le bouton « Publier » pose `publier:true`.
- Extension **5.97.0**, zip régénéré, `EXT_ATTENDUE` suivie. Aucune entrée
  d'`EXT_CAPACITES` : la publication est un geste du panneau (lbc.js), pas une
  promesse de l'app gatée sur une version.
- ⚠️ **CE QUE JE N'AI TOUJOURS PAS VU (403), et le filet posé pour ça** : le
  bouton de publication réel et l'après-clic (confirmation ? paiement ?). Le
  risque argent est neutralisé (boosts décochés + aucun bouton à prix cliqué), et
  au pire rien n'est cliqué. Si le libellé réel diffère de mes motifs, il publie
  à la main — jamais une dépense, jamais un faux. Le prochain vrai dépôt le
  confirmera.


### ⚠️ « LE BOUTON PUBLIER EST TOUT EN BAS, DEVINE-LE » + LE PANNEAU S'OUVRAIT TOUT SEUL
Julien, 20 sept. (après son dépôt) : « le clic publier sans booster, c'est pas
difficile, il est tout en bas de la page ; même si tu ne l'as pas, essaie de le
deviner » — et « arrête d'ouvrir le panneau à chaque fois que je lance Vinted,
laisse le bouton à droite ». Deux gestes qu'il a explicitement autorisés.
- **Deviner le bouton du bas** : `publierSansBooster` cherche d'abord un libellé
  « Publier/Déposer… » ; s'il n'en trouve pas, il prend le bouton **le plus bas**
  de l'étape. **La garde ARGENT ne bouge pas** : jamais un bouton à prix/boost
  (`PRIX`), jamais « annuler/retour/aperçu » (`NEG`), jamais « Continuer »
  (l'enchaînement des étapes s'en charge). Au pire rien n'est cliqué, jamais une
  dépense, jamais un faux.
  ⚠️⚠️ **ET LE BANC A ATTRAPÉ UN VRAI DÉFAUT** : le « plus bas » cliquait le
  bouton de **NOTRE PROPRE bandeau** (`#vrm-lbc-banner`, en position fixe tout en
  bas), pas celui de Leboncoin. `NOTRE_UI` exclut désormais notre bandeau/témoin/
  panneau du balayage. Le banc sert une étape finale SANS libellé « Publier »
  (bouton gratuit « Terminer » tout en bas, un bouton à 9,90 € et un « Annuler »
  au-dessus) : **Terminer cliqué, le payant JAMAIS, Annuler jamais**. Sans
  l'exclusion, `fin=0` (il cliquait le bandeau) — rouge.
- **Le panneau démarre FERMÉ** (`vinted-panel.js`, `let open = false`) : on ne
  restaure plus l'état ouvert d'une page à l'autre. Le bouton rond « VRM » à
  droite reste, c'est SON clic qui l'ouvre. Extension **5.98.0**, zip régénéré,
  `EXT_ATTENDUE` suivie. Aucune entrée d'`EXT_CAPACITES` (le geste est dans le
  panneau, pas une promesse de l'app).
- ⚠️ **Ce qui reste à mesurer chez lui** (dit à Julien, pas deviné) : (1) le
  **prix** qu'il a vu faux — le code pose le prix Vinted en centimes dans
  `price_cents` ; sans le couple (prix Vinted → prix affiché) je ne peux pas
  distinguer un bug de centimes d'un mauvais champ ; (2) les **photos ≤ 6** —
  c'est la capture qui plafonne tant qu'il n'a pas rouvert ses annonces Vinted
  avec l'extension à jour (la capture passive `capterPhotosAnnonces` les complète
  ensuite toute seule).


### ⚠️⚠️ « L'ÉCRAN ANNONCES, C'EST TOTALEMENT N'IMPORTE QUOI » (3 octobre, 5.132)
Julien : « on ne sait pas sur quelle application, c'est quoi le prix, le boost ».
Mesuré : 70 cartes sur 71 affichaient la **marque** (`it.brand||it.title`),
jamais le titre ; quatre montants dont deux sans libellé ; six teintes (dont
`#0F8A6A`, `#09B1BA` et l'orange Leboncoin en dur) ; le sommeil dit trois fois.
- **La carte** : photo 88×118, **prix** en grand, N° en encre neutre, **titre**
  sur deux lignes, taille · état, « Aussi sur **Leboncoin** » seulement si
  PROUVÉ (`vinted_lbc_posted`), puis une ligne de chiffres **tous libellés**
  (achat · boost · marge ; « — » si inconnu), vues/favoris/âge (« dort » une
  fois, en ambre), compte si plusieurs. Saisie N° + achat + « Vendue » en bas ;
  le reste dans « ⋯ » (plancher, boost payé, achat relié, ranger, passeport,
  baisser le prix, la FILE Leboncoin/eBay — distincte de la présence). L'en-tête
  dit « N en ligne sur Vinted · X aussi sur Leboncoin · Y boostées » UNE fois.
- ⚠️ **La pastille « prête pour Leboncoin » mentait par construction** : `item`
  était reconstruit avec 5 champs, donc `captPhotos` valait toujours 0 →
  « à capter » sur toutes les cartes. La carte lit l'annonce entière.
- ⚠️⚠️ **« Vendue — bordereau reçu » se décidait encore PAR TITRE** en repli
  (`bordForItem`), et ce même repli **retirait l'annonce des annonces en ligne**.
  Mesuré : 7 couples annonce/bordereau au titre identique, 0 même article ; 177
  des 178 bordereaux portent leur transaction. Désormais : N°, sinon
  transaction → annonce (`txnItem`), sinon rien. `audit-identite` le vérifie.
- **Boosts** : Vinted envoie `promoted` dans le dressing ; l'allègement le jetait.
  L'extension le garde (avec `can_push_up`) et la carte dit « Boostée » quand
  c'est `true` — rien quand c'est absent (pas su ≠ non). **Le MONTANT par paire
  reste impossible aujourd'hui** : aucune trace de boost en base (0 nœud dans les
  porte-monnaie, 0 email, 71 réponses « billing » jetées sans échantillon).
  L'extension relève désormais la FORME d'une réponse qui parle de boost (noms de
  clés seulement : `boost_vu`, `boost_forme` dans `panel_diag_capture`). **Ne
  rattacher un coût à une paire que si cette forme prouve un `item_id` et un
  montant par article** — sinon c'est un coût de compte, jamais réparti.
  En attendant, le champ « Boost payé » (⋯) entre dans la marge et le bénéfice.
- Les planchers posés dans l'ANCIEN panneau (`panel_min_prices`, que
  l'extension applique toujours) sont lus en repli et affichés (§11).
- Tri « À booster 💡 » renommé « Vues sans favoris » (deux sens pour 💡).
- Banc `annonces-carte.cjs` (titre, chiffres libellés, Boostée trois états,
  présence prouvée, sommeil une fois, préparation qui suit la donnée, vendue par
  identité, aucune couleur hors palette, 390 px sans débordement).


### ⚠️⚠️ « DATER LA VENTE À LA DATE DE RÉCEPTION D'ARGENT » (3 octobre, 5.133)
Julien : « il faut dater la vente pour le CA du mois à la date de réception
d'argent, c'est ça les ventes finalisées ». C'est la **réintroduction demandée**
de ce que §5 avait retiré (« ne pas la réintroduire sans qu'il le redemande ») —
il l'a redemandé.
- **La date** : celle où la transaction Vinted passe **« Commande finalisée »**
  (`harvest_{uid}_txn_{tx}` → `payload.transaction.status === 450`,
  `status_updated_at`). C'est le moment où l'argent est versé. Lue par
  `fetchVersementsVinted` en **trois scalaires** (§4.4), paginée (`lireTout`).
- **Mesuré avant de coder** : septembre **26 ventes finalisées sur 56** portaient
  déjà cette date (1 601 € sur 3 465 €), août 101/156, juillet 18/76, juin 1/62.
  Les autres n'avaient jamais eu leur détail relu APRÈS la finalisation.
- ⚠️⚠️ **Sans date de versement, une vente n'est dans AUCUN mois** : elle va dans
  « à dater » avec son montant, et l'écran le dit. Retomber sur la date de vente
  serait mettre un chiffre FAUX dans la déclaration (§5 : mieux vaut un blanc
  qu'un faux). Dates illisibles (`null`) ⇒ l'écran Ventes **ne publie rien**.
- **L'extension va chercher les dates** : `capterDatesVersement(uid)` à chaque
  visite Vinted, après la moisson — lecture de `/api/v2/transactions/{tx}` pour
  les ventes finalisées sans date, **5 par visite**, `garde`, pas de nouvel essai
  avant 24 h, rien si les lectures en base ont échoué ; elle prévient l'app
  (`evt maj versements`). Uniquement pour le compte connecté dans l'onglet : les
  dates des autres comptes arrivent quand il y passe.
- Leboncoin : daté au jour de la vente (sa date de versement n'est pas captée),
  et l'écran le dit. eBay : date de la commande payée.
- Les **deux rapports** (mensuel, annuel), la grille des mois déclarables et la
  carte URSSAF du tableau de bord suivent la même règle (`ventesDeclarables`).
  Le mot « encaissé » reste interdit (Leboncoin n'est pas daté au versement).
- `audit-urssaf.cjs` : **9 rouges** sur le code d'avant ; `audit-versement.cjs`
  exécute la vraie fonction (12 contrôles, réaffaiblie → rouge) ;
  `bancs/rapport.cjs` sert une vente vendue le mois dernier et versée ce mois.


### ⚠️⚠️ LA FACTURE EXÉCUTAIT CE QUE L'ACHETEUR ÉCRIT DANS SON NOM (5 octobre)
Trouvé par l'audit de sécurité du 5 octobre. Une facture porte le nom, l'adresse
et l'email de l'**acheteur** (qu'il écrit lui-même sur Vinted) et la
désignation de l'article. Ces valeurs partaient sans échappement :
- dans `buildInvoiceHtml` (serveur), c'est-à-dire le HTML de la facture Pro,
  rangé en base puis envoyé par email à l'acheteur ;
- dans `generatePDF` (app), écrit avec `window.open('')` + `document.write`.

Or une fenêtre ouverte ainsi a **la même origine que l'app**. Un nom
« `<svg onload=…>` » y exécutait son code au moment où Julien imprime, et
pouvait lire sa session. Mesuré au banc sur le code d'avant : **18 exécutions**.

⇒ **Deux défenses, chacune prouvée :**
- toutes les valeurs sont échappées, côté serveur (`h()`) et côté app
  (`xmlEsc`) ;
- `ouvrirDocumentImprimable` écrit en tête du document une politique
  (`default-src 'none'`). Elle couvre aussi les factures **déjà rangées en
  base**, construites avant le correctif. Mesuré dans Chromium : sans elle le
  code s'exécute, avec elle plus rien. L'impression est lancée depuis l'app
  (`w.print()`), car aucun script de la fenêtre ne tourne plus.
- `audit-xss-facture.cjs` exécute les vraies fonctions dans un vrai Chromium.
  Il donne **9 contrôles**, **6 rouges** sur le code d'avant, et repasse au
  rouge quand on retire la politique (`--mutation sanscsp`, les factures
  rangées).
  ⚠️ **Son premier jet était vert sur le défaut** : le piège `<img src=x>`
  attendait une réponse réseau qui ne venait jamais, et le gestionnaire ne se
  déclenchait pas. Le piège n'utilise désormais **aucun réseau**
  (`data:` et `<svg onload>`). *Un banc qui dépend du réseau mesure le réseau.*
- Le **reçu d'achat** (`openReceipt`) échappait déjà ses valeurs, et il garde
  ses boutons en ligne. Il n'est pas touché.
- **Ajouté** : `X-Content-Type-Options: nosniff` (`vercel.json`).
- ✅ **Fait le 21 octobre** : une politique sur toute l'app (section « La
  politique de sécurité du contenu », avant le §6) — scripts en ligne sortis
  d'`index.html`, boutons du reçu branchés depuis l'app, banc qui sert les
  vrais en-têtes de `vercel.json`.


### ⚠️⚠️ UNE FILE, UN FREIN, L'ARGENT AVANT LES PHOTOS, LA BOÎTE QUI BOUGE, LE COLIS COCHÉ MAIS JAMAIS PARTI (6 octobre, 5.162)
Quatre défauts d'une revue appuyée sur sa base, **remesurés avant de coder**.
- ⚠️⚠️ **UN 429/403 DE VINTED NE STOPPAIT RIEN, ET LA MOITIÉ DES REQUÊTES
  ÉTAIT HORS FILE.** `avecVinted` ne couvrait que la génération de bordereaux,
  les réponses et les commandes de l'app ; la moisson, les codes, les
  versements, les relevés et les photos (chaque minute) partaient à côté — le
  banc mesure **jusqu'à 4 requêtes en vol** sur l'avant. Et après un 429 reçu
  dans la moisson d'une visite, **19 requêtes partaient encore** (ventes,
  achats, boîte, porte-monnaie, codes, versements, photos).
  ⇒ **Toute requête Vinted passe par `requeteVinted`**, dans les primitives
  (`vintedGet`, `vintedSend`, `vintedGetHtml`, `vintedGetCookie`, le
  renouvellement de session, la série faite dans la page) : une en vol, quelle
  que soit la source. `avecVinted` reste AU-DESSUS pour l'ordre des gestes ; les
  deux chaînes sont distinctes, donc aucune n'attend l'autre. ⚠️ Une primitive
  ne s'appelle JAMAIS de l'intérieur d'une autre place de la file (elle
  attendrait la sienne pour toujours) : `vintedSend` refait sa requête après un
  401 dans une NOUVELLE place.
  ⇒ Un 429/403 ouvre une **pause rangée dans `chrome.storage.local`**
  (`vrmPauseVinted`, §4.9) : 15 min, puis 30, 1 h, 2 h, 4 h si Vinted recommence
  dans les 6 h ; deux freins à la suite ne montent pas deux paliers. Pendant la
  pause, RIEN ne part : visite, moisson, lecteurs, photos, et les gardes
  (`garde`, `gardeLecture`, `gardeStricte`) refusent — un clic de l'app reçoit
  `code: 'vinted-pause'` et « **Vinted demande de ralentir — réessaie dans X
  min** ». Diagnostic : `vinted_frein_*`, `vinted_pause_palier_*`,
  `vinted_pause_refus`, `rates.vinted_pause`. Aucun plafond monté.
  ⇒ **La moisson faite DANS LA PAGE** (`inject.js`, `activeHarvest`) s'arrête au
  premier 429/403, prévient le fond (`vintedFrein` → même pause) et ne démarre
  pas pendant une pause : `content.js` lui transmet la fin de la pause (un
  nombre). Le fond ne pose une pause que sur NOS requêtes, jamais sur celles que
  la page fait d'elle-même.
- ⚠️ **L'ARGENT ET LES COLIS MANGEAIENT LE BUDGET DES ACTIONS.**
  `capterRetraits`, `capterDatesVersement` et `capterReleves` passaient par
  `garde` → `compterAction` : jusqu'à **10 des 20 actions/heure** par visite
  pour de simples lectures — un bordereau ou une réponse pouvaient ensuite se
  faire refuser. Elles passent sur le budget de LECTURE (`gardeLecture`, 5.144).
  ⚠️ Mais ce budget-là, les photos le vidaient (`tickPhotos`). **Mesuré : 238
  ventes finalisées sans date de versement** (hors compte supprimé) — c'est le
  CA qu'il déclare. Les classes `argent`/`colis`/`clic` ont tout le budget ; les
  `photos` s'arrêtent avant une **réserve** = ce que les lecteurs prioritaires
  ont encore à lire (au plus 5 + 2 + 3), qu'ils notent dans `vrmLecturesDues`.
  « Pas su » (jamais noté, plus d'une heure, une lecture ratée) garde la réserve
  entière ; plus rien à lire ⇒ les photos retrouvent les 20. Le total reste 20.
- ⚠️⚠️ **LA BOÎTE DE RÉCEPTION ÉTAIT FIGÉE SUR UNE PAGE ANCIENNE.** Mesuré :
  `24602614` sur la **page 5** (dernière conversation captée le 27 juillet,
  dernière vente le 2 octobre), `3156028798` sur la page 3. `listePlusRiche`
  compare des NOMBRES : une page profonde rangée en faisant défiler (50
  conversations) refusait toute page 1 fraîche (30). ⇒ `fusionnerInbox`, sur
  les deux voies d'écriture : `current_page === 1` met à jour le HAUT, une page
  profonde ne fait que compléter (jamais une version plus ancienne d'une
  conversation), fusion par identifiant, triée, **bornée à 300**, même forme
  `{pagination, conversations}`. Lecture de la ligne ratée ⇒ rien n'est écrit
  (une page 1 seule effacerait le reste) ; page vide ⇒ rien.
  Côté app (Messages) : quand la dernière vente d'un compte est plus récente
  (de plus d'1 h) que sa dernière conversation captée, une ligne le dit UNE fois
  et nomme le compte — « ouvre ta messagerie Vinted sur ce compte ». Ventes
  illisibles ou aucune conversation captée : on ne juge pas.
- ⚠️⚠️ **« COCHÉ POSTÉ » MAIS JAMAIS VU PARTIR.** Cocher « Colis fait » sort la
  vente de « à envoyer » partout ; rien ne revenait vérifier. **Mesuré : 4 ventes
  cochées dont Vinted dit encore « à expédier »** — mais seules **2** (65 € et
  75 €, cochées il y a 159 h et 92 h) ont un statut lu **après** la coche ; les
  2 autres (compte `3168505556`) ne sont connues que par une capture du
  20 septembre, antérieure à la coche du 29 : **pas su, pas d'alerte**.
  ⇒ `posteSansDepart` (une règle) : coche datée, `aExpedier` encore vrai, aucun
  email du transporteur ne l'a vu passer, statut lu APRÈS la coche
  (`_harvestSeen`), et date limite dépassée OU coche de plus de 48 h.
  `cochesNonPartis` (un propriétaire) est lu par **Colis** (bloc
  `data-poste-sans-depart`, le geste dit une fois, « ↺ Pas encore posté » la
  remet dans « à envoyer ») et **Ma journée** (action « Vérifier N colis
  cochés « posté » », même nombre). `limiteExpedition` porte maintenant la date
  limite pour `toShip` ET cette alerte (§11).
- **Preuves** (le vrai `background.js` dans un `vm`, banc commun
  `scripts/_fond-vm.cjs` : base à état, projection appliquée, Vinted qui compte
  les requêtes en vol, `executeScript` qui exécute vraiment la fonction de la
  page) — **rouges sur 9d71641 (5.161), verts après** :
  `audit-frein-vinted.cjs` **23 contrôles, 17 rouges** (dont « 19 requêtes
  après le 429 », « jusqu'à 4 en vol », le vrai `inject.js` qui continue après
  le 429) ; `audit-budget-lectures.cjs` **13, 8 rouges** ;
  `audit-inbox-fusion.cjs` **26, 16 rouges** ; banc `poste-sans-depart.cjs`
  (données inventées, deux tailles) **24 contrôles, 12 rouges** sur le build
  d'avant, et **8 rouges** quand on retire la condition « lu après la coche »
  (preuve par réaffaiblissement) ; `messagerie.cjs` + 5 contrôles (boîte figée
  dite une fois, et l'autre sens), **4 rouges** sur le build d'avant.
- `audit-versement.cjs` stubbait `garde` pour tester « garde refuse ⇒ rien » :
  il stubbe maintenant AUSSI `gardeLecture` (la règle est la même : un refus de
  la garde ⇒ zéro requête) — forme du banc, pas affaiblissement.
- Extension **5.162.0**, zip régénéré, `EXT_ATTENDUE` suivie. **Aucune entrée
  d'`EXT_CAPACITES`** : l'app ne promet rien de neuf (la ligne de Messages dit
  le geste, pas ce que l'extension fera).
- ⚠️ **Fusion du 8 octobre : DEUX extensions différentes s'appelaient « 5.162 ».**
  `main` (une autre session) avait la sienne : la purge des `email_bord_*` sans
  date lisible GARDE (#468). Ici, la file et le frein ci-dessus. Le code
  fusionné porte les deux, et passe en **5.163.0** : sinon une extension
  installée depuis l'un ou l'autre côté se dirait « à jour » sans l'être. Deux
  contenus ne portent jamais le même numéro.
- ⚠️ **Hors périmètre, constaté** : `inject.js` fait sa PROPRE moisson complète
  (jusqu'à ~66 requêtes, 1 fois / 30 min / onglet) en plus de `runActive` — et
  avec des délais **aléatoires** (`jitter`). Elle respecte désormais la pause et
  le frein, mais elle reste hors de la file du fond (elle vit dans la page). À
  trancher : la garder, ou la confier au fond.


### « Bilan de la semaine » et préparation du lancement (6 octobre, propositions 11 et 15)
**Le bilan (proposition 11).** Une notification par semaine et par vendeur :
vendu (nombre de ventes et montant), reçu, colis à expédier, paires qui dorment.
- ⚠️ **Le lundi vers 10 h (Paris), pas le dimanche soir. C'est un choix.** Le
  seul cron du projet (`ship-reminders`, 08:00 UTC) tourne une fois par jour, à
  ± 59 min près (plan Hobby). Un « bilan du dimanche » partirait le dimanche à
  10 h, sur une semaine pas finie présentée comme complète (§5). Le lundi, la
  semaine du lundi 00:00 au lundi 00:00 (heure de Paris) est terminée. La
  semaine du passage à l'heure d'hiver fait 169 h, et l'audit le vérifie.
  Si la base ne répond pas le lundi, mardi et mercredi réessaient. Le jeudi,
  plus rien. **Un second cron le dimanche soir est à trancher par Julien** : un
  cron refusé au déploiement bloquerait TOUS les déploiements (comme le défaut
  #250 des 13 fonctions).
- **Aucune règle n'est réécrite.** Vendu = `ventesFaites` (date de vente). Reçu
  = `ventesDeclarables`, daté au versement. ⚠️ Le bilan ne lui passe **pas** le
  registre « J'ai déclaré ce mois » : le reçu de la semaine est l'argent
  ARRIVÉ ces sept jours-là, pas ce qu'il a déclaré (sinon une vente déclarée
  sans date de versement sortirait des « sans date », et le reçu se dirait
  complet sans l'être). L'audit le vérifie sur l'appel lui-même. À
  expédier = la règle du widget (`aExpedier`, colis cochés « posté » exclus). Le
  serveur ne peut pas importer `App.jsx`. `api/_lib/ventes-regle.js` est donc
  une **copie exacte**, refabriquée par
  `node scripts/audit-bilan-semaine.cjs --recopie`. ⚠️ **Ne jamais la modifier à
  la main.** L'audit compare les deux codes (hors commentaires) ET leurs
  résultats.
- **Les paires qui dorment.** L'écran Annonces publie `vrm_paires_dorment`
  (clé synchronisée, `{n, total, datesKnown, at}`) et le serveur la lit (§11).
  Une publication de plus de 8 jours vaut « pas su ». Des dates de mise en
  ligne incomplètes donnent « au moins ».
- **Trois états par chiffre, jamais deux.** Chaque chiffre est soit sûr, soit
  partiel (« au moins », avec ce qui manque **nommé**), soit inconnu (aucun
  nombre, « à voir dans l'app »). Le bilan devient partiel dans ces cas :
  - un compte jamais capté, ou capté avant la fin de la semaine
    (« vendeuse_a (lu jeudi) ») ;
  - Vinted, Leboncoin ou eBay illisible ;
  - des ventes Leboncoin sans date ;
  - pour le reçu, des ventes finalisées sans date de versement.
  Si tout est illisible, rien n'est envoyé ni mémorisé, et le cron réessaie
  le lendemain. Jamais « 0 vente ».
- **Un bilan par semaine, jamais deux.** Le mémo `bilan_semaine_dedup` est
  écrit **AVANT** l'envoi, et sa bonne écriture est **vérifiée**. Mémo illisible
  ⇒ rien. Mémo non écrit ⇒ rien. Le bilan passe par la boucle par vendeur déjà
  en place : toutes ses lectures portent `owner=eq.`. La réponse du cron ne
  contient **aucun montant**.
- **Préférence « 📊 Bilan de la semaine »** (`push_prefs.bilan`), activée par
  défaut et coupable dans Réglages → Notifications. Les défauts sont les mêmes
  dans l'app et sur le serveur (l'audit compare `PUSH_CATS` et `PUSH_DEFAUT`).
  Un abonnement coupé coupe déjà tout envoi.

**Le lancement (proposition 15).**
- **(a) Les liens des emails d'inscription ramenaient sur `localhost`.** Mesuré
  le 5 octobre dans les journaux d'authentification : une vraie confirmation
  d'inscription y venait de `http://localhost:3000`, donc le Site URL de
  Supabase est encore `localhost`. L'app envoie maintenant `redirect_to` (son
  adresse ouverte) sur cinq chemins : l'inscription, le renvoi de confirmation,
  le lien magique, l'oubli de mot de passe et le changement d'adresse.
  ⚠️ **Ça ne suffit pas seul.** Supabase ignore un `redirect_to` absent de sa
  liste d'adresses autorisées, et retombe sur le Site URL.
  L'aide de l'inscription parlait d'une « adresse de test » d'envoi, à
  **toute** personne qui s'inscrivait. Elle dit maintenant seulement d'ouvrir
  l'email, et de regarder les indésirables si rien n'arrive. Elle est vraie
  avec ou sans SMTP personnalisé.
- **(b) Les CGV s'acceptent DANS VRM, avant Stripe** (décision prise le 6
  octobre, Julien : « arrête de demander »). Le premier jet faisait porter la
  case par Stripe seul (`consent_collection[terms_of_service]=required`). Or
  Stripe refuse d'ouvrir le paiement tant que l'adresse des conditions n'est
  pas réglée dans SON tableau de bord : personne ne pouvait s'abonner tant que
  Julien n'avait pas fait ce réglage.
  ⇒ Les deux écrans qui vendent l'abonnement (Mon compte, la porte
  d'abonnement) montrent une case **« J'accepte les conditions générales de
  vente »** (`CaseCgv`, une seule pour les deux, §11). « S'abonner » reste grisé
  tant qu'elle n'est pas cochée.
  ⇒ Le serveur **exige** `cgv: true` (400 `cgv` sinon, rien ne part chez Stripe).
  Il range la date d'acceptation et la version des CGV dans les métadonnées de
  l'abonnement (`cgv_acceptees_le`, `cgv_version` = la date de « Dernière mise
  à jour » de cgv.html, comparée par l'audit).
  ⇒ La case de Stripe est toujours demandée en plus. Si Stripe ne sait pas
  l'afficher (adresse absente), on rouvre la session **sans** sa case, sous
  une autre clé d'idempotence (Stripe refuse de rejouer une clé avec d'autres
  paramètres). L'acceptation a déjà eu lieu dans VRM, datée.
  `audit-lancement.cjs` : **4 rouges** sur le code d'avant. Le banc
  `abonnement.cjs` vérifie que le bouton est grisé et que rien ne part sans la
  case, puis que la demande porte `cgv:true` une fois la case cochée.
  ⚠️ Régler l'adresse des CGV dans Stripe reste recommandé (double
  acceptation), mais n'est plus bloquant.
- **(c) « Fermer mon compte »** (Réglages → Mon compte), mode `fermer` de
  `api/compte.js`. Il fallait l'écrire : la politique de confidentialité promet
  l'effacement, et aucun bouton ne le faisait.
  ⚠️ **Mesuré sur la vraie base avant d'écrire** : `app_data.owner` et
  `vinted_accounts.owner` n'ont **aucune clé étrangère** vers `auth.users`.
  Seule `abonnements` en a une. La migration 001 en prévoyait, elle n'est pas
  en place. Supprimer l'utilisateur n'effacerait donc rien : la route efface
  elle-même, table par table, uniquement `owner=eq.<celui du jeton>`.
  Les garde-fous :
  - l'adresse email retapée est vérifiée **par le serveur** ;
  - c'est **refusé au propriétaire** de l'installation, et « pas su » vaut
    refus aussi ;
  - l'ordre est choisi pour qu'un échec se rattrape :
    1. l'abonnement : résilié en fin de période, ou arrêté tout de suite s'il
       est impayé. Stripe ne répond pas ⇒ **rien** n'est effacé ;
    2. les sessions ;
    3. les données, les comptes Vinted, les compteurs ;
    4. les photos détourées ;
    5. **en dernier**, le compte de connexion. Tant qu'il existe, le vendeur
       peut se reconnecter et relancer.
  - Un échec partiel répond 502 « Fermeture INCOMPLÈTE », avec ce qui est fait
    et ce qui ne l'est pas. Jamais « compte fermé ».
  - ⚠️ **Limite dite à l'écran** : un jeton déjà délivré reste valable environ
    1 h. Une extension encore installée peut donc écrire une capture dans
    l'heure (l'écran conseille de la retirer).
  - Les copies du schéma `sauvegarde` ne sont pas touchées : la politique les
    autorise 90 jours.
  - Les CGU donnent le chemin.
- **(d) Le contact vient d'un seul endroit**, `src/contact.js`
  (`CONTACT_EMAIL = ''`). La page d'accueil et Réglages le lisent. Vide, ils
  disent « adresse de contact à venir », jamais une adresse inventée.
  `audit-lancement.cjs` exige que ce soit **la même valeur** que `email` dans
  `public/legal/editeur.js`. Il refuse aussi toute adresse écrite en dur, en
  lien comme en texte. Il exécute `editeur.js` : un champ vide s'affiche
  « à compléter », jamais « null ».
- **Les preuves.** Chaque contrôle sort rouge sur le code d'avant (5ea2602),
  puis rouge sous une **mutation** posée sur le code d'après :

  | contrôle | sur le code d'avant | sous les mutations |
  |---|---|---|
  | `audit-bilan-semaine.cjs` (46 contrôles) | 34 rouges | règle du miroir modifiée → 6 · partiel affiché comme sûr → 4 · bilan éteint par défaut → 2 · publication hors synchro → 1 · reçu passé par le registre des déclarations → 1 |
  | banc `bilan-semaine.cjs` (20, la vraie route, deux vendeurs, faux Web Push) | 14 rouges | règle du miroir modifiée → 1 · partiel affiché comme sûr → 2 · envoi malgré un mémo non écrit → 1 · mémo illisible pris pour « jamais envoyé » → 1 · préférence ignorée → 1 |
  | `audit-fermer-compte.cjs` (25) | 22 rouges | effacement sans filtre de vendeur → 3 · propriétaire accepté → 2 · échec partiel annoncé réussi → 3 |
  | `audit-lancement.cjs` (22) | 16 rouges | case CGV retirée → 2 · `redirect_to` retiré → 5 · adresse écrite en dur sur l'accueil → 2 |
  | bancs `abonnement.cjs` (53) et `accueil.cjs` (40) | 7 et 2 rouges | — |

  Les mutations ont été relancées **après la fusion** avec la branche du jour :
  mêmes rouges. Cette fusion a apporté le registre des déclarations, et
  `ventesDeclarables` appelle maintenant `indexDeclarations` et `moisDeclare`.
  Le miroir les porte (refabriqué par `--recopie`, jamais à la main).
  ⚠️ **Le premier banc du bilan était vert sur un miroir qui comptait les
  ventes remboursées**, car aucune n'était servie. Il en sert une maintenant.
  **Le premier contrôle du contact** ne regardait que les liens `mailto:` : une
  adresse écrite en texte passait. C'est la règle qu'il fallait juger, pas son
  orthographe.
- **Les gestes de Julien :**
  - **Supabase → Authentication → URL Configuration** : Site URL
    `https://vrm.center`, et `https://vrm.center/**` dans les Redirect URLs.
    Puis un **SMTP personnalisé** : l'expéditeur par défaut de Supabase est
    limité et fait pour les essais.
  - **Stripe → Settings → Public details** : Terms of service =
    `https://vrm.center/legal/cgv.html`. Sans ça, le paiement répond « CGV
    absentes ».
  - **Remplir l'adresse de contact** dans `src/contact.js` ET dans
    `public/legal/editeur.js`, avec ses autres mentions légales.
  - Décider s'il veut un second cron le dimanche soir.
- **Non mesuré, ni en production ni ici** :
  - l'heure réelle du cron de Vercel ;
  - le texte exact du refus de Stripe sans adresse de CGV ;
  - Supabase face à un `redirect_to` non autorisé ;
  - la suppression du stockage, de `logout?scope=global` et de
    `admin/users` sur la vraie base ;
  - l'arrivée réelle d'une notification ;
  - ce qu'une extension écrit dans l'heure qui suit une fermeture.


### ⚠️⚠️ Revue des propositions 6, 8, 9, 10, côté app : une vente REMBOURSÉE comptait « vendue » (6-8 octobre)
Les douze défauts de la revue, RE-VÉRIFIÉS sur le code du jour avant d'y toucher
(le planificateur avait été corrigé entre-temps) : **tous reproduisaient encore**.
Repris le 8 octobre après une coupure (le premier jet n'était ni fini ni
vérifié) : relu, complété, puis prouvé.
- ⚠️⚠️ **La preuve de vente Vinted lisait un état PÉRIMÉ.** La ligne
  `harvest_*_txn_*` n'est recaptée que si la transaction est rouverte. Mesuré :
  19 transactions « Remboursement effectué » selon la liste de ses ventes
  (`orders_sold`), dont 3 que leur ligne disait encore « Le paiement a été
  validé » (N°198, 277, 382) — trois paires revenues chez lui, « vendues » pour
  l'app. ⇒ `preuvesVentesVinted` : l'état d'une transaction est **le plus frais
  des deux** — la liste quand elle la porte et qu'elle a été relue après la
  ligne de transaction (`_harvestSeen` contre `meta->>capturedAt`), sinon la
  transaction. Aucun cas « transaction plus fraîche et en désaccord » chez lui
  aujourd'hui : c'est préventif. ⚠️ **On n'écarte PAS une annonce « dès qu'une
  transaction est annulée »** : 22 annonces portent une « Commande annulée —
  article indisponible » (l'acheteur qui a perdu la course) À CÔTÉ de la vraie
  vente. Mesuré aussi : la `date` de `orders_sold` est la date de VENTE (178 sur
  178 antérieures à la finalisation, 8 jours d'écart en moyenne).
- ⚠️⚠️ **Le retrait AUTOMATIQUE est le plus strict** (`retraitsEbayAutoPermis`,
  lancé par `passageRetraitEbayAuto`) : vente CONFIRMÉE par `orders_sold`, N°
  porté par **une seule** fiche (13 N° hérités d'août en portent plusieurs),
  **jamais revenue** (`revenues` : une transaction remboursée, retournée,
  suspendue ou annulée d'après l'une OU l'autre source — hors « article
  indisponible » et paiement échoué ; mesuré, 1 vente confirmée sur 215),
  annonce eBay mise en ligne **AVANT** la vente (`depuis`, le StartTime d'eBay ;
  date inconnue ⇒ rien), toutes ses annonces Vinted lues, eBay ne la disant pas
  déjà terminée. Ce qui ne passe pas RESTE dans l'alerte « à retirer », avec le
  bouton.
- **Une lecture « en vente », deux lecteurs** (`lireAnnoncesVintedEnLigne`) :
  l'écran eBay et la coque lisent TOUS ses comptes liés, écartés compris
  (masquer un compte règle l'affichage, pas ce qui est en vente), et la coque ne
  retire plus des « en vente » ce qu'un titre disait vendu (`soldIdsN`, pas une
  identité). Les lectures sont celles que la coque fait déjà (`cachedRow`,
  60 s) : seuls les comptes écartés coûtent une lecture de plus, et seulement
  quand une annonce eBay porte un SKU VRM.
- **Le passage** : `nuageAuDepart` est noté AVANT toute lecture ; l'annulation du
  passage et l'interrupteur sont relus avant CHAQUE appel ; les fiches N° sont
  relues juste avant ; une annonce qu'eBay dit déjà close ne prend plus une des
  5 places ; un retrait fait mais pas noté dans l'historique (`journal:false`)
  est dit ; un passage qui lève ne retire rien (`.catch`).
- **Proposition 9** : un N° porté par plusieurs fiches ⇒ aucune baisse eBay (et
  c'est dit) ; la confirmation nomme l'annonce **eBay** qui change ; une baisse
  faite pour un prix Vinted n'est plus reproposée après la synchro
  (`vrm_ebay_baisses`, synchronisé, rattrapé par `onCloudReady`) ; le plancher
  lit le prix d'achat comme la carte (`prixAchatDe`, §11 — la N°385 et ses
  15 € saisis par numéro).
- **Changer un prix eBay a trois issues** (`resultatReviseEbay`, les deux
  endroits qui le font) : un 504 « incertain », une page d'erreur HTML ou une
  coupure ⇒ « je ne sais pas si le prix a changé », jamais « rien n'a changé ».
- **Une moyenne par modèle** (`moyennesParModele`, §11) pour l'écran Ventes et le
  repère d'une offre sur Messages (qui comptait les comptes exclus). Les achats
  d'un compte exclu sortent aussi du repère (ils ne comptent nulle part).
  Messages n'affiche plus les offres d'un compte exclu, et dit « toutes réglées
  par une vente » au lieu de se taire ; le repère par modèle nomme un compte
  dont les ventes ou achats n'ont pas pu être lus.
- **Preuves** (données inventées ; « avant » = 66580a5, arbre archivé, scripts
  copiés dedans, build refait là-bas) : `audit-ebay-retrait-auto.cjs` (les vraies
  fonctions dans un `vm`) **20 rouges** sur l'avant — dont la vente remboursée,
  sur une fonction qui existait déjà, et les 5 places prises par des annonces
  closes — et **13 réaffaiblissements sur 13** attrapés (`--prouve`, dont « la
  liste gagne toujours », « une paire revenue acceptée », « article
  indisponible compté comme un retour ») ; bancs `ebay-annonces.cjs` **6
  rouges** (le retrait automatique partait sur 4 annonces au lieu d'une),
  `annonces-carte.cjs` **10**, `messagerie.cjs` **10**, `rapport.cjs` **1** —
  tous verts après.
- ⚠️ **Pas fait, à savoir** : (1) côté serveur, le journal `ebay_retraits_auto`
  reste un lire-ajouter-réécrire (deux retraits simultanés peuvent perdre une
  ligne), et la route pourrait elle-même refuser une annonce dont le `StartTime`
  (lu par `GetItem`) est postérieur à la vente ; (2) **deux autres lecteurs de
  la preuve** gardent la règle « transaction seule » : l'écran Leboncoin de
  l'app (`PAS_UNE_VENTE` sur `harvest_*_txn_*`) et l'extension
  (`lireVentesProuvees`) — ils sur-excluent une paire remboursée de leurs files
  (le sens sûr), mais c'est encore trois lecteurs pour une notion (§11) ;
  (3) ~~une liste de ventes captée il y a longtemps confirme la vente~~ —
  corrigé le 8 octobre, voir ci-dessous.
- ⚠️ **Non mesuré** : que `GetMyeBaySelling` rende `StartTime` pour une annonce
  EN LIGNE (`depuis`). S'il ne le rend pas, AUCUN retrait automatique ne part
  (date inconnue) — l'alerte, elle, reste. Et le texte exact d'eBay pour une
  annonce déjà close (`EBAY_DEJA_TERMINEE` suit l'erreur 1047 documentée).

#### Seconde relecture (8 octobre) : huit défauts reproduits, tous corrigés
Chacun reproduit sur 12c6f26, corrigé, et prouvé rouge sur le build d'avant
(arbre archivé, scripts copiés dedans, build refait là-bas, §6.1).
- ⚠️⚠️ **Après une baisse eBay faite par VRM, l'écran repartait du prix
  PÉRIMÉ.** `revise` ne réécrit pas `ebay_listings` : la liste garde 60 € tant
  qu'eBay n'est pas relu. L'écran disait « 60 € aujourd'hui » pour une annonce à
  53 €, et — Vinted baissé ensuite — proposait de « baisser » de 53 à **56 €**,
  une hausse. ⇒ Le mémo `vrm_ebay_baisses` (le prix posé par VRM) fait foi tant
  que la liste n'a pas été relue APRÈS lui (`ebay_listings.capturedAt`, lu en
  scalaire) ; date inconnue ⇒ le mémo. Jamais une « baisse » vers un prix ≥ au
  prix connu. Banc `annonces-carte.cjs` (sans simuler la synchro) : **3 rouges**
  sur l'avant, et l'autre sens (eBay relu après, 58 € ⇒ la liste gagne).
- ⚠️⚠️ **Une liste de ventes ANCIENNE, ou un compte BLOQUÉ, « confirmait » la
  vente.** Reproduit : liste captée il y a 60 jours sur un compte que Vinted a
  bloqué (capture figée) ⇒ l'annonce eBay était terminée. ⇒ La preuve porte la
  date de la liste qui confirme (`cap`) et son compte ; le retrait automatique
  exige une liste relue depuis moins de **48 h** (`LISTE_VENTES_FRAICHE_MS`,
  raison `liste-perimee`) et refuse un compte de `vinted_accounts_blocked`
  (`compte-bloque`, `comptesBloquesVinted()`) ; liste des comptes bloqués pas
  fournie ⇒ « pas su » ⇒ rien. Un compte masqué n'est pas exclu en soi : la
  fraîcheur de sa liste suffit (s'il ne le relit plus, rien ne part).
- **La ligne d'état de l'interrupteur décrivait l'ANCIENNE règle**, au-dessus de
  deux paires prouvées vendues qui restaient sans un mot. ⇒ `CONDITIONS_RETRAIT_AUTO`
  (une phrase, la même pour la confirmation et la ligne d'état, bornes tirées de
  la règle) ; allumé, chaque ligne « à retirer » porte `data-ebay-auto-raison` —
  `retraitsEbayAutoPermis` jugé par l'écran sur ce qu'il a lu (`toutesLues`
  remonte de `useEbayPaires`) — et dit sa raison (`RAISON_RETRAIT_AUTO`) ; une
  raison commune à toutes les lignes se dit une fois (§7). Banc
  `ebay-annonces.cjs` : **4 rouges** sur l'avant (dont « 21 caractères communs »
  entre la ligne d'état et la confirmation).
- **Un retrait automatique au résultat incertain (504, page d'erreur, coupure)
  ne laissait aucune trace.** Il se dit (« je ne sais pas si l'annonce eBay a été
  retirée — regarde sur eBay ») et se note sur l'appareil
  (`vrm_ebay_auto_incertains`, relu sur la ligne de l'écran eBay) ; un refus
  certain se dit aussi, avec sa raison. ⚠️ **Et il ne s'attribue pas à eBay** :
  le premier jet écrivait « eBay a refusé le retrait automatique (« … rien n'a
  été envoyé à eBay ») » — la plupart des refus viennent de VRM (réglage éteint
  ou illisible côté serveur, SKU changé). « N°X n'a pas été retirée
  automatiquement : « raison du serveur » ». `audit-ebay-retrait-auto.cjs` :
  **2 rouges** sur 5cfa12e, et la mutation qui remet l'attribution repasse au
  rouge.
- **Messages** : « toutes réglées » disait « celle reçue » en ne comptant que les
  réglées (une offre rangée à la main n'y était pas) — la phrase ne dit plus rien
  du total reçu, et les rangées sont comptées à part (`offresAtraiter` rend
  `rangees`). Et le repère d'une offre ne disait pas qu'un compte manquait :
  `ventesNonLues` (une liste, comptes exclus retirés) est lue par le repère de
  l'écran Ventes ET par Messages (§11). Banc `messagerie.cjs` : **6 rouges**.
- **Écran Ventes : un compte illisible était signalé deux fois avec le même
  geste** (bandeau « compte non chargé » + ligne du repère). Le repère ne redit
  que ce qui distingue ; le geste n'y revient que pour un compte dont seuls les
  ACHATS manquent (`achatsSeuls`). Banc `rapport.cjs` : **1 rouge** (« 2 fois »).
- `audit-ebay-retrait-auto.cjs` : **13 rouges** sur 12c6f26, et **19
  réaffaiblissements sur 19** attrapés (`--prouve`, dont « une liste ancienne
  confirme », « un compte bloqué accepté », « comptes bloqués inconnus lus
  aucun », « un retrait incertain tu », « un refus de VRM attribué à eBay »).


### « Ce que Vinted transmet aux impôts » — les seuils DAC7, compte par compte (6 octobre)
Chaque année, Vinted transmet aux impôts les vendeurs qui font **au moins 30
ventes OU plus de 2 000 €** dans l'année civile (directive européenne DAC7).
**Mesuré avant de coder** (lecture seule, sa base) : `grep DAC7` = 0 dans l'app ;
7 comptes liés, aucun exclu ; ventes **finalisées** de 2026 — `julatace35260`
**101 · 3 721,10 €** (les deux seuils), `llloollllaa` **49 · 1 775,70 €**,
`tomj606` **33 · 1 433,50 €** (30 ventes), puis 27 · 20 · 16 · 0, sous les seuils.
- **Où** : Ventes → Outils → **Registre annuel**, UNE carte (`CarteSeuilsVinted`),
  pour l'année choisie. Ton informatif : aucun rouge ni ambre (§7), un seuil
  atteint se dit par le mot, en gras.
- ⚠️ Le premier jet (2c85fe1) disait « pour qu'il n'y ait jamais d'écart avec ce
  que tu déclares » et comptait comme SÛRES des ventes sans date de versement :
  **c'était faux** — voir la revue juste en dessous. Ne pas le remettre.
- **Trois états** : registre pas encore calculé · **lecture ratée ⇒ « — » et la
  raison, jamais « 0 vente »** · lu. Un compte **exclu** n'y entre pas (décision
  du 3 octobre) ; une ligne neutre dit que les exclus ne sont pas comptés, **sans
  les nommer**. « Plus de 2 000 € » se compare en centimes : 2 000,00 € pile ne
  l'atteint pas.
- **Pas mesuré / pas affirmé** : les sources primaires (impots.gouv.fr,
  economie.gouv.fr, Légifrance, EUR-Lex, BOFiP) sont **bloquées par le proxy du
  conteneur** — les seuils sont écrits tels quels, recoupés sur des sources
  secondaires, et **rien d'autre n'est affirmé** (ni date de début, ni ce que
  Vinted envoie au vendeur, ni la date que Vinted retient pour rattacher une
  vente à l'année). Non mesuré : si Vinted juge chaque compte à part ou
  regroupe les comptes d'une même personne ; le montant exact qu'il retient (VRM
  prend le prix de l'article, comme le CA déclaré) ; Leboncoin et eBay, soumis
  aussi à DAC7, ne sont pas dans cette carte.

#### Revue contradictoire du 6 octobre — six défauts, corrigés le 8 octobre
Un relecteur les a REPRODUITS au rendu ; la première correction (d9bac7e) a été
interrompue, reprise et finie.
- ⚠️⚠️ **Le cache des ventes changeait un compte en panne en « 0 vente · sous les
  seuils »** au passage suivant (rechargement ou retour sur l'écran dans les
  3 min) — et le bandeau « compte non chargé » de l'écran Ventes disparaissait
  aussi. `putCache` gardait la liste partielle **sans** dire quels comptes
  avaient raté. Une entrée de cache porte maintenant `failedUids` (version
  `_CACHE_V` : une entrée d'avant, qui ne sait rien de ses échecs, est ignorée),
  et `loadOrders` les rend avec la liste. Une relecture discrète ratée garde ce
  qu'on montrait **du seul compte raté** (elle gardait toute l'ancienne liste
  avec la nouvelle liste d'échecs : un compte raté avant et revenu passait à
  « 0 vente »). Le cache des annonces et des conversations garde aussi ses
  comptes ratés. « Rouvre l'écran Ventes » est devenu un vrai bouton
  **« Relire mes ventes »** (`relireVentes` : vide le cache, relit notre base —
  jamais Vinted — et les dates de versement si elles étaient illisibles).
- **Un échec se juge par l'IDENTITÉ** (`failedUids`), plus par le nom affiché :
  un libellé arrivé du nuage après la lecture faisait passer le compte en panne
  pour lu. Vaut pour la carte, le bandeau de l'écran Ventes, le rapport mensuel
  et le geste « J'ai déclaré ce mois » (`nomsVentesKO`, nommé au rendu).
- ⚠️⚠️ **La partie sûre de la carte EST le chiffre du registre** — mesuré sur la
  copie de sa base du 5 octobre : carte 245 ventes · 9 361 € contre registre
  141 · 5 226 €. Le registre calcule, par compte, ses ventes Vinted de l'année
  (`vintedParUid`, mêmes lignes que son total : mois de la déclaration s'il l'a
  notée, sinon du versement) et sa liste « pas encore datées » ; la carte LIT les
  deux (`seuilsVintedParCompte` ne rappelle plus `ventesDeclarables`, §11).
  Mesuré après sur la même copie : **carte 141 · 5 226,30 € = registre**, plus
  **104 ventes · 4 134,80 € « pas encore datées »**, dites à part comme une
  **estimation** (rattachées à l'année par la date de vente et la borne de
  45 jours : le versement suit la vente — **0 sur 173** avant elle — et au plus
  **25 jours** après, médiane 7,8 j ; une borne mesurée, pas une certitude).
  Un seuil atteint seulement avec elles se dit « **atteint si** … ».
  ⚠️ Le premier correctif recalculait ces ventes **sans** le registre des
  déclarations : une vente déclarée sans date comptait deux fois.
- **VRM ne sait pas si Vinted juge chaque compte à part** : la carte le dit, et
  ajoute une ligne « **Tous tes comptes ensemble** » (« au moins » et « sans X »
  quand un compte manque — jamais « sous les seuils » sur un total partiel).
  Année en cours : « **à ce jour** » et « encore N ventes ou X € avant le seuil »
  (sur la partie sûre ; « plus de 2 000 € » ⇒ il faut 2 000,01 €).
- §7 : la panne et « Lecture des ventes… » se disent **une fois** au-dessus des
  lignes ; la ligne d'un compte pas lu ne porte qu'un « — ».
- **Constaté, laissé tel quel** : l'année suit le fuseau de l'APPAREIL
  (`getFullYear`), comme `ventesDeclarables` et le registre — une vente versée
  le 1er janvier à 00 h 20 (Paris) compte l'année d'avant sur un téléphone réglé
  à Londres. Changer la carte seule la ferait diverger du registre.
- **Preuves** : `audit-seuils-vinted.cjs` (vraie règle dans un `vm`, ventes
  inventées) **39 contrôles**, **34 rouges** sur 2c85fe1, et chacune des **11
  mutations** le refait passer au rouge (`exclus` 4 · `passu` 5 · `versnull` 2 ·
  `encours` 4 · `seuil2000` 3 · `adater` 13 · `recalcule` 17 · `strict` 2 ·
  `totalsous` 1 · `reste` 2 · `acejour` 1). Banc `bancs/seuils-vinted.cjs`
  (port 4802, aucune fixture, 390 et 1512 px, cinq scénarios : comptes,
  cache, libellé tardif, panne totale, année passée) **99 contrôles, tout vert**, **70 rouges**
  sur le build de 2c85fe1, et rouge sur trois builds réaffaiblis du code
  d'après : cache rendu sans ses échecs (**4**), échecs reconnus par le nom
  (**2**), « pas encore datées » recalculées sans les déclarations (**2**).
  `rapport.cjs` et `vendu-recu.cjs` restent verts.
- **Pas mesuré** : la carte n'a pas été vue sur sa vraie base dans l'app (bancs
  sur données inventées ; les chiffres ci-dessus viennent de la règle exécutée
  sur la copie locale du 5 octobre).

#### Deuxième revue (9 octobre) — le cache ne savait pas QUELS comptes il couvrait
Deux défauts, reproduits chacun par deux relecteurs au rendu, corrigés.
- ⚠️⚠️ **Un compte lié depuis la dernière lecture s'affichait « 0 vente · sous
  les seuils »**, et le total « tous tes comptes » se disait complet. L'entrée de
  cache des ventes ne retenait que ses ÉCHECS : liste de comptes du navigateur
  en retard sur la base, ou rechargement dans les 3 min après une liaison ⇒
  `loadOrders` resservait le cache des anciens comptes ; le nouveau n'était ni lu
  ni en échec. Dans l'autre sens, un compte **retiré** restait compté au
  registre (95 ventes contre 62 sur la carte).
  ⇒ L'entrée de cache ET l'état des ventes portent `comptes`, la clé des comptes
  interrogés (`cleComptesVinted` : les identités triées — jamais un nombre, jamais
  un nom). `entreeCache` ne sert qu'une entrée qui couvre **exactement** les
  comptes d'aujourd'hui (`_CACHE_V` = 3), et les relectures suivent `cleComptes`
  au lieu de `accounts.length` (un compte retiré + un lié = même longueur). Même
  règle pour les annonces, les achats et les conversations. Et tant que la
  lecture ne couvre pas les comptes d'aujourd'hui, le registre dit « lecture en
  cours » (`ventesComptees` vaut `null`) et « J'ai déclaré ce mois » attend.
- ⚠️ **Relecture discrète ratée** (signal de l'extension, un compte déjà lu ne
  répond pas) : la liste garde ses ventes d'avant ; le registre les COMPTAIT tout
  en écrivant « ventes de X pas lues », et la carte (« sans X ») donnait un autre
  total. ⇒ **Un compte en échec n'entre dans AUCUN total** (`ventesComptees`
  écarte `failedUids`), qu'on ait déjà vu ses ventes ou non — la liste, elle,
  continue de les montrer. Carte == registre, et la phrase dit ce que le chiffre
  contient. Par ricochet : la ligne publiée au tableau de bord
  (`vinted_urssaf_mois`) ne part plus pendant qu'un compte non exclu est en échec
  (le tableau de bord garde la dernière, complète) ; Ma journée écrit « Reçu en
  {mois} · **sans X (ventes pas lues)** » ; le total « à la date de vente » du
  formulaire de déclaration lit la même liste.
- **Preuves** : banc `seuils-vinted.cjs` **165 contrôles** (scénarios F1 compte
  lié · F2 rechargement · F3 compte retiré · G relecture discrète · H Ma journée,
  plus l'égalité registre == carte après la relecture ratée de B) — **11 rouges**
  sur le build d'avant (e719d0f), et **5 rouges** sur un build où le cache « se
  croit » (entrée sans clé de comptes). `audit-seuils-vinted.cjs` **45 contrôles**
  (+6 sur la clé) ; mutations `clelongueur` 3 rouges, `clenom` 2.
  `audit-urssaf.cjs` exigeait l'orthographe `vinted: sales.items` : il suit la
  règle (Leboncoin et eBay passés à la même fonction).
- **Constaté, laissé tel quel** : les totaux de l'écran Ventes et « Vendu »
  (`ventesFaites`) comptent encore les ventes d'avant d'un compte en échec — de
  l'affichage, pas le CA déclaré ; le bandeau « compte non chargé » le dit.
  **Pas mesuré** : rien n'a été vu sur sa vraie base (données inventées).


### ⚠️⚠️ L'ABONNEMENT : 12,99 €/MOIS (9,99 € JUSQU'AU 11 OCTOBRE), ET QUI NE PAIE PLUS NE VOIT PLUS RIEN (4 octobre)
Julien : « un abonnement à 10 € par mois » puis « **9,99** », « pour tout le monde
sauf moi », « prélevé chaque mois à partir du moment où la personne s'abonne »,
puis « la personne ne doit plus recevoir de notifications, voir ses données,
etc. lorsqu'elle ne paye plus ».
- ⚠️⚠️ **11 OCTOBRE : LE PRIX PASSE À 12,99 € PAR MOIS** — décision de Julien
  après l'étude du coût par abonné (« on va passer à 12,99 par mois » : 12,99 €
  TTC, la TVA arrivant tôt pour lui). Ce qui le dit : les CGV (encadré et
  article 2, « Dernière mise à jour : 11 octobre 2026 » ⇒ `CGV_VERSION =
  '2026-10-11'`, rangée dans les métadonnées Stripe), la page d'accueil (FAQ,
  section Prix), le repli de l'app (`PRIX_CGV_LISIBLE`) et le serveur
  (`PRIX_CGV`, en centimes). Mesuré : **0 ligne dans `abonnements`** — personne
  ne payait 9,99 €, aucun abonné à basculer.
  ⚠️⚠️ **LE GESTE DE JULIEN — ET TANT QU'IL N'EST PAS FAIT, LE PAIEMENT EST
  FERMÉ.** Le montant PRÉLEVÉ est celui du prix rangé chez Stripe sous la clé
  `vrm_mensuel` (encore 9,99 €), et un prix Stripe ne se modifie pas, il se
  recrée : **Stripe → Produits → le produit VRM → « Ajouter un prix » : 12,99 €,
  récurrent, mensuel, clé de recherche `vrm_mensuel`, cocher « transférer la clé
  de recherche »** (l'ancien prix la perd ; l'archiver ensuite). Le connecteur
  Stripe n'était pas autorisé dans la session du 11 octobre : **ce n'est pas
  fait**, et ça ne se simule pas. À refaire en mode réel le jour du passage.
  ⇒ **L'app le détecte, côté serveur** : `checkout` compare le prix lu chez
  Stripe à `PRIX_CGV` (`prixConforme` : mêmes centimes, en euros, une fois par
  mois) et, s'il diffère, **n'ouvre PAS le paiement** — 503 `prix-cgv`, « Le
  paiement n'est pas encore ouvert : rien n'a été prélevé » (au vendeur, SANS
  le montant de Stripe — revue ci-dessous). Jamais 9,99 € prélevés sur des CGV
  acceptées à 12,99 €. La carte « Mon compte » ne relaie pas un prix non
  conforme (`prix: null`, `prixConforme: false` ⇒ « le paiement n'est pas
  encore ouvert », aucun bouton) ; seul le PROPRIÉTAIRE reçoit le montant de
  Stripe (`prixStripe`) et sa carte dit les deux prix et le geste. Stripe muet ⇒
  `prixConforme: null` (« pas su »), jamais « différent ». Les journaux Vercel
  le disent aussi (`[stripe] prix « vrm_mensuel » = … ≠ CGV …`).
  ⚠️ Ce contrôle ne porte que sur les NOUVEAUX paiements : un abonnement déjà
  souscrit garde son prix chez Stripe (aucun aujourd'hui).
  - Preuves : `audit-abonnement.cjs` **74 contrôles**, **11 rouges** sur le code
    d'avant ; trois mutations, chacune rouge : contrôle retiré (7), prix relayé
    quand il diffère (1), intervalle oublié (2). `audit-lancement.cjs` **30** —
    UNE valeur : CGV ×2 = `PRIX_CGV` = `PRIX_CGV_LISIBLE` = page d'accueil ;
    3 rouges sur l'avant, serveur resté à 999 ⇒ rouge, seconde valeur écrite à
    côté de la constante ⇒ rouge. Banc `abonnement.cjs` **60** — 3 rouges sur le
    build d'avant (il affichait « 9,99 € / mois » et « S'abonner » quand Stripe
    différait des CGV).
  ⚠️⚠️ **REVUE DU 11 OCTOBRE — QUATRE DÉFAUTS DE CE CHANGEMENT DE PRIX, REPRODUITS
  AU RENDU (1512 et 390 px) ET EN EXÉCUTANT `api/compte.js`, TOUS CORRIGÉS.**
  Latents aujourd'hui (abonnement facultatif, 0 abonné), réels le jour où il
  passe `abonnement_obligatoire` à '1' sans avoir recréé le prix — et en mode
  réel, il devra le refaire.
  1. ⚠️⚠️ **La PORTE (second écran qui vend l'abonnement, §11) proposait
     « S'abonner » quand le paiement est fermé** : « 12,99 € / mois », la case
     des CGV, un bouton actif — et le clic menait au refus 503, dont le message
     nommait par-dessus **le prix réglé chez Stripe (9,99 €) à un vendeur**. La
     carte « Mon compte » évitait ce bouton, la porte non. ⇒ `paiementFerme`
     (`prixConforme === false`, ou Stripe pas branché, et pas un impayé) : ni
     case, ni bouton, aucun prix — « le paiement n'est pas encore ouvert, rien
     n'a été prélevé, tes données t'attendent » — et « Se déconnecter » reste.
     Un impayé garde « Mettre à jour ma carte ». Le refus 503 ne part jamais au
     propriétaire (409 avant) : il est **générique** pour tout le monde, le
     détail (les deux prix, le geste) reste dans `console.warn` et sur la carte
     du propriétaire.
  2. **Un ANCIEN abonné perdait la liste de ses factures** (sa compta) : la
     branche `prixConforme === false` de la carte rendait la carte seule — les
     factures étaient demandées puis jamais affichées. Elle rend `listeFactures`
     comme la branche d'en dessous.
  3. ⚠️ **L'alerte du propriétaire pouvait écrire deux prix IDENTIQUES** —
     « le prix réglé chez Stripe (12,99 € / mois) n'est pas celui des CGV
     (12,99 € / mois) » pour un prix en dollars, tous les 3 mois ou par semaine
     — **ou « 0,00 € »** pour un prix sans montant fixe : `prixLisible` ignorait
     la devise et le rythme, et `lirePrix` changeait `unit_amount: null` en 0.
     C'est justement quand il se trompe de devise ou de récurrence dans Stripe
     qu'elle doit le lui montrer. ⇒ Le serveur écrit le texte (`prixTexte` :
     montant, **devise** — « 12,99 USD » —, **rythme** — « / semaine »,
     « tous les 3 mois », « en une fois » —, « sans montant fixe » jamais 0) et
     le rend dans `prixStripe.texte` ; la carte l'affiche **tel quel**.
     `prixTexte(PRIX_CGV)` vaut exactement `PRIX_CGV_LISIBLE` (vérifié).
  4. **Un abonné actif lisait « Abonné · 12,99 € / mois » en payant 9,99 €** :
     la carte retombait sur le prix de l'offre (ou des CGV quand le serveur ne
     le relayait pas), juste au-dessus de factures à 9,99 €. Or un abonnement
     Stripe garde le prix auquel il a été souscrit (les CGV le disent). ⇒ le
     serveur lit le prix de **SON** abonnement (`prixAbonnement` : l'article de
     l'abonnement chez Stripe, vérifié sur son client, un seul article) ; pas
     su ⇒ la carte écrit « Abonné » **sans montant**, jamais un prix deviné.
     ⚠️ Ça coûte une lecture Stripe de plus à l'ouverture de « Mon compte »,
     pour un abonné seulement.
  - Preuves : `audit-abonnement.cjs` **91 contrôles**, **17 rouges** sur
    2851ef4 ; quatre mutations, chacune rouge : l'ancien formateur (6), le
    refus qui renomme le prix Stripe au vendeur (1), le prix de l'abonnement lu
    sans vérifier le client (1), `prixAbonnement` = prix de l'offre (5). Banc
    `abonnement.cjs` **82** (la porte aux deux tailles, Stripe ≠ CGV et Stripe
    pas branché) — **13 rouges** sur le build de 2851ef4, et **13 rouges** sur
    un build réaffaibli des quatre correctifs à la fois (chaque groupe de
    contrôles tombe sur SA mutation).
- **Stripe en MODE TEST seulement**, sans bibliothèque (`api/_lib/stripe.js`) :
  Checkout (abonnement), portail de gestion, webhook signé (HMAC sur le corps
  BRUT, comparaison en temps constant, 5 min de tolérance), version d'API
  **figée** (`2026-08-26.dahlia` : `current_period_end` vit sur l'article).
  Prix : clé `vrm_mensuel`. Tout passe par **`api/compte.js`** (le plan Hobby
  plafonne à **12 fonctions** et le projet y est : `api/sante.js` y est devenu
  un mode, `vercel.json` garde `/api/sante` et `/api/stripe-webhook`).
- **Qui paie** : le serveur ne croit JAMAIS un identifiant du navigateur — il
  demande à Supabase qui porte le jeton (`api/_lib/session.js`). Le statut ne
  s'écrit QUE sur un événement Stripe signé, dans `abonnements` (lisible par le
  vendeur, inscriptible par la clé de service seule — migration 005). Un
  événement plus ancien n'écrase pas un plus récent ; une écriture ratée
  répond 5xx (Stripe réessaie). Retour de paiement : adresse FIXE.
- ⚠️⚠️ **LA RÈGLE D'ACCÈS VIT DANS LA BASE, EN UN SEUL ENDROIT** (migration 006,
  `vrm_regle_acces`) : accès si l'abonnement n'est pas obligatoire · ou
  propriétaire · ou `active`/`trialing` · ou `past_due` depuis **moins de
  14 jours** (Stripe réessaie ; `impaye_depuis` garde le PREMIER échec, posé
  par le webhook, effacé au retour du paiement). Elle est lue par :
  · **la base elle-même** — politiques RESTRICTIVES `abonnement_requis` sur
    `app_data` et `vinted_accounts` (en « ET » avec les règles d'owner) : ni
    l'app, ni l'extension, ni un appel à la main ne lisent ni n'écrivent ;
  · **l'app** — `vrm_acces` → `/api/compte?mode=abonnement` rend `acces`, et
    `PorteAbonnement` se ferme sur `acces === false`, sans rien recalculer ;
  · **le serveur** — `vrm_acces_pour` (`api/_lib/abonnement.js`) : plus aucune
    notification (`sendPushToAll` → `coupe:'abonnement'`, sa liste d'appareils
    n'est même pas lue) et le widget répond **402 sans aucun chiffre**.
  ⚠️ Avant, « obligatoire » et « propriétaire » étaient deux variables
  d'environnement : l'écran aurait pu dire « abonné » pendant que la base
  refusait ses lignes (§11). Elles ne sont plus lues.
- **Rien n'est supprimé** : les données d'un vendeur coupé restent intactes
  (la clé de service continue de ranger ses emails) et réapparaissent dès qu'il
  reprend. Ses appareils restent enregistrés : les notifications reviennent
  sans rien réactiver.
- **« Pas su » ne coupe pas** : la base ne répond pas sur l'accès ⇒ on notifie,
  le widget répond, la porte reste ouverte (on ne fait pas rater une vente à un
  payeur pour un hoquet) — mais `/api/compte?mode=abonnement` répond 503, jamais
  une réponse devinée. Le verrou qui compte, ses DONNÉES, est tenu par RLS.
- ⚠️⚠️ **TROUVÉ EN BRANCHANT LA COUPURE : `/api/push` NE SAVAIT PAS À QUI ÉTAIT
  UN TÉLÉPHONE.** Il rangeait l'appareil chez le propriétaire de l'installation :
  le téléphone d'un second vendeur aurait reçu les ventes de Julien. Prouvé au
  banc (« rangé chez 9999… »). Base cloisonnée ⇒ la route exige la session
  (401 sinon) et tout se passe dans le contexte de CE vendeur ; l'app et
  `main.jsx` envoient le jeton (main.jsx attend qu'il soit frais, jamais
  d'envoi anonyme). Et deux défauts voisins : la sonde `cloisonnee()` mémorisait
  « non » sur une panne (lecture SANS filtre = les appareils d'un autre), et
  `pushCategorieActive` passait un booléen à `duVendeur` — dès qu'un vendeur
  était connu, ses préférences de notification étaient ignorées.
  ⚠️ Le `pushsubscriptionchange` du service worker n'a pas de session : il
  reçoit 401, et c'est l'ouverture suivante de l'app qui ré-enregistre.
- **Réglage** : `vrm_reglages.abonnement_obligatoire` vaut **'0'** — RIEN n'est
  bloqué aujourd'hui. Julien le passe à '1' quand Stripe est en mode réel ET que
  les CGV et la page d'accueil sont à jour (fait le 4 octobre, voir plus bas). Le
  propriétaire est `vrm_reglages.proprietaire` (= `VRM_OWNER_UID`).
- **À lui** : `STRIPE_SECRET_KEY` (sk_test_…) sur Vercel — le webhook et son
  secret sont posés. La règle SQL a été exécutée sur la vraie base dans une
  transaction ANNULÉE (cinq cas, rien n'a persisté).
- Preuves : `audit-abonnement.cjs` (**44 contrôles**, exécute les vraies routes —
  **14 rouges** sur le code d'avant, dont le téléphone rangé chez le
  propriétaire et le widget qui montre ses chiffres ; réaffaibli → 5 rouges) ;
  banc `abonnement.cjs` (**27**, rendu : la porte suit `acces`, un impayé de
  plus de 14 jours envoie mettre la carte à jour, jamais repayer — 3 rouges sur
  le build d'avant).


### L'onglet « Mon compte » : abonnement, carte, factures, résiliation (4 octobre)
Julien : « un onglet pour gérer l'abonnement et les factures dans les
paramètres, avec ses infos de compte regroupées ». Les Paramètres ont deux
onglets (`data-onglets-reglages`) : **Réglages** (l'app) et **Mon compte** (la
personne : identité, prénom, abonnement, carte, factures, connexion, ses
données). Sans session, pas d'onglets. `?vue=compte` (retour de Stripe) ouvre
le bon onglet.
- `api/compte.js` : `mode=factures` (SES factures et SA carte — le client Stripe
  vient de SA ligne lue avec son jeton, jamais d'un paramètre ; seules les
  adresses `*.stripe.com` sont transmises ; Stripe muet ⇒ 502, **jamais** « aucune
  facture ») · `mode=resilier` / `mode=reprendre` (POST seulement ;
  `cancel_at_period_end` — la résiliation prend effet en FIN de période, comme le
  portail ; l'abonnement doit appartenir à CE client, sinon 403 ; la ligne est
  réécrite tout de suite depuis la réponse de Stripe). Résilier en ligne est une
  obligation en France (art. L215-1-1).
- **CGV et page d'accueil disent 12,99 € par mois (9,99 € jusqu'au 11 octobre),
  sans engagement.** Tant que
  `abonnement_obligatoire` vaut '0', elles disent aussi que l'accès est offert —
  ⚠️ **le jour où Julien passe le réglage à '1', retirer cette phrase** de
  `src/Accueil.jsx` (FAQ « Combien ça coûte ? » et section Prix) et de l'encadré
  des CGV. Le banc `accueil.cjs` lit le prix DANS les CGV (une seule source).
- Preuves : `audit-abonnement.cjs` **62 contrôles** (14 rouges sur l'avant) ;
  banc `abonnement.cjs` **42** (13 rouges sur le build d'avant).


### ⚠️⚠️ « À EXPÉDIER » : UNE SEULE RÈGLE, LE CHAMP MACHINE DE VINTED (4 octobre)
Julien : « le statut en transit, colis à faire, vendu… doit être beaucoup plus
fluide et fiable quand l'extension est connectée ». **Mesuré** : le même jour,
quatre lecteurs donnaient quatre nombres pour « à expédier » — **Colis 2 · Ma
journée 3 · la cloche 3 · le widget 6** — chacun avec SA lecture du texte du
statut.
- **La règle** (`aExpedier`, la MÊME dans `src/App.jsx`, l'extension
  `A_EXPEDIER` et `api/widget.js`) : le champ machine de Vinted
  `transaction_user_status` d'abord — sur une VENTE, `needs_action` = à expédier,
  `waiting`/`completed`/`failed` = pas à expédier ; le texte n'est lu qu'en repli
  quand le champ manque. `PAS_UN_ENVOI` (annulée, remboursée, retour, suspendue,
  finalisée, paiement échoué) gagne toujours. ⚠️ Sur un ACHAT `needs_action` veut
  dire « à retirer » : ne jamais réutiliser la règle des ventes.
- « Bordereau envoyé au vendeur » n'affichait plus « En transit », un colis au
  relais n'affiche plus « Livrée » ni « Reçu » (le test du relais passe AVANT
  « livr »), et la vente « bordereau commandé » ne disparaît plus de Colis.
- **Un propriétaire** : `toShip` publie `vrm_colis_aposter`, la cloche le
  consomme (< 12 h), son repli recompte avec `aExpedier` — et se recalcule à
  l'arrivée du nuage (`nuagePret`, §5.49 : sur un appareil neuf elle disait 3
  pour 2 et ne se corrigeait jamais).
- **Coché « posté » à la main** (`isShipDone`) : hors d'« À expédier » partout,
  sous « En transit » avec l'étiquette **« Posté »** (elle disait encore
  « À expédier »).
- **« Commande non réclamée — retournée »** est un colis qui REVIENT : rangé
  « annulé » pour l'ARGENT (aucun CA), mais visible dans « En transit » et
  « Toutes » — il n'était que sous « Annulées », un mot faux.
- Ventes : pastilles **« À expédier » / « En transit »** (deux questions
  différentes). Colis : un groupe replié **« Partis — Vinted suit le colis »**
  en lecture seule. Colis à retirer : le même colis se reconnaît à son **code de
  retrait**, jamais à son titre.
- Widget et rappels : ni compte retiré, ni colis coché « posté », ni faux retard
  (date limite de l'email, sinon vente + 7 j) — et une liste de comptes vide ne
  filtre rien (§4.1).
- **Fluidité** : une relecture ne vide plus la liste (`loadOrders` garde ce qui
  est affiché, un numéro de séquence empêche une lecture plus ancienne d'écraser
  une plus récente), un signal de l'extension reçu sur un autre écran n'est plus
  perdu, une lecture ratée n'efface plus les bordereaux d'un compte, et une
  panne de NOTRE base ne déclenche plus d'appel au relais Vinted.
- Preuves : `audit-statuts.cjs` (18 rouges sur l'avant), bancs `statuts-colis.cjs`
  (rendu des cinq écrans, aucune fixture — 38 rouges sur c117b30, 6 sur le
  premier jet), `fluidite.cjs` (12), `widget-colis.cjs` (5).


### Code mort et rappels d'expédition à l'échelle (4 octobre)
- **Sept fonctions sans appelant** retirées (graphique mensuel, export Factur-X
  seul, scène 3D de l'accueil, clé IA locale, pseudo Vinted, distance, état
  Vinted) : 220 lignes. ⚠️ `moisDeVente`, `caUrssafParMois` et `heureCommande`
  n'ont PAS d'appelant dans l'app mais `audit-urssaf.cjs` les exécute : les
  garder. 32 écrans montés avant et après (§4.11).
- **`ship-reminders`** : 8 vendeurs à la fois (mille à la queue leu leu
  dépassaient les 300 s de Vercel), un vendeur qui plante n'arrête plus les
  autres (réponse 500 pour rester visible), la sonde de cloisonnement en panne
  vaut « pas su » (elle faisait basculer en passe GLOBALE, vendeurs mélangés), et
  ses réglages illisibles le font se taire au lieu de compter ses colis déjà
  postés. `ship-multi.cjs` : 3 rouges sur l'avant.

### Revue de cohérence des chiffres entre écrans (17 octobre)
Même notion, même nombre, sur Ma journée, Statistiques, Compta, carte URSSAF,
récap mensuel. Rendu sur données inventées (banc `chiffres-croises.cjs`, deux
comptes, une vente vendue le mois d'avant et versée ce mois, une sans date de
versement). **Vérifié égal** : vendu du mois (Ma journée = Statistiques =
Compta), reçu du mois (Ma journée = Compta), CA déclaré de l'année (Compta =
ligne publiée). **Quatre défauts, corrigés** (aucune règle URSSAF/DAC7 changée) :
- **A. « Prochaine déclaration » (tableau de bord) écrivait « CA finalisé
  0,00 € · à payer 0,00 € »** : elle sommait l'ANCIENNE archive (vide depuis
  juillet). Elle somme maintenant les mois de la ligne publiée
  (`vinted_urssaf_mois`) qui tombent dans SA période (`nextUrssafDeadline`) ;
  pas de ligne publiée ⇒ « — », jamais 0. Attributs `data-echeance-*`.
- **B. La note du récap mensuel disait « à leur date de vente »** au-dessous de
  chiffres lus dans la ligne publiée (datée au versement) — la phrase qui
  explique un chiffre doit venir de sa source (§5). `data-recap-regle`.
- **C. La Compta présentait un CA déclaré complet avec eBay illisible** : il dit
  « au moins », nomme la plateforme non lue (`sources` de la ligne publiée,
  `data-compta-couverture`) et les ventes sans date de versement (`aDater`).
- **D. « Ventes finalisées 3 · sur 4 vendues ce mois-ci »** comparait deux
  dates différentes (versement / vente) comme une couverture : écrit « argent
  versé ce mois · 4 ventes faites ce mois-ci » (`data-mois-vendues`).
- ⚠️ **Deux bancs servaient une forme que le code ne lit plus (§6.3)** :
  `vendu-recu` et `seuils-vinted` simulaient une panne de compte seulement sur
  `harvest_{uid}_orders_*` ; `prechargerDemarrage` lit TOUS les comptes en une
  lecture (`harvest_*_orders_*`) et contournait la panne. La lecture commune
  tombe aussi maintenant (l'app repasse compte par compte, comme en vrai).
- Preuves : `chiffres-croises.cjs` (port `BANC_PORT`, 18 contrôles) **5 rouges
  sur le build d'avant** (§6.1), 0 après ; il juge les nombres par attributs.
- **Noté, pas touché** : `received` de `api/widget.js` vient des emails de
  finalisation, pas de `ventesDeclarables` (zone serveur) ; le « Bénéfice
  estimé » du tableau de bord reste « — » (il ne ment pas, il se tait).


### Colis : litige, annulation, lieux de retrait (17 octobre)
- **Litige nB546 dans « colis à faire »** : la liste des ventes portait `needs_action` avec le statut du colis de RETOUR (« colis déposé… », action « marquer reçu »). `needs_action` + colis qui a déjà bougé (`COLIS_DEJA_BOUGE`) n'est jamais un envoi (app, widget ; **extension : chantier 5**). Et l'état de la transaction l'emporte sur une liste en retard : `TXN_ETATS` (rempli par la lecture partagée `TXN_META_SELECT`, qui porte maintenant `ship_status_title`) — 220 ou ≥ 430 (430 suspendue · 440 retour · 450 · 5xx annulée) ⇒ rien à poster ; 5xx + expédition qui n'a pas bougé ⇒ « Annulée », jamais « Remboursée, la paire est partie » (un bordereau reçu n'est pas une preuve d'envoi). Codes mesurés sur 1 280 transactions. `audit-statuts` : 3 rouges sur l'avant.
- **Un endroit = un bloc** : `cleanLieu` retire le gras (`*`), le type générique en tête (« Consigne Vinted Go », « point relais », « Consigne Pickup » → `type`) et un nom répété ; un colis vu par Vinted dont le lieu porte le nom d'un bloc email rejoint ce bloc (`extraFusion`, nom exact normalisé). Avant : Kusmi Tea et Speed Queen dans un bloc « *Consigne Vinted Go* », et Kusmi Tea une seconde fois plus bas.
- **Code absent de la conversation** (3 colis Mondial Relay, lieu lu, code vide) : plus de « Voir mon code de retrait » ; la carte dit que le code arrive par l'e-mail du transporteur.
- **Serveur** : lieu sans astérisques ni slogan (« ® juste ici ! »), 4 lignes d'adresse, « Consigne Vinted Go » = consigne, « code de retrait **est** 123456 » lu ; code introuvable sur un colis à retirer ⇒ `extraitCode` (lignes code/retrait/PIN, 400 car.) pour mesurer la vraie forme. Les lignes déjà rangées ne sont pas réécrites : `cleanLieu` les nettoie à l'affichage.
- Leboncoin : aucune transaction ne porte de point ni de code (mesuré) ; « Achats Leboncoin » dit où arrive le code.
- Preuves : `audit-colis-retrait.cjs` (13 rouges sur l'avant), banc `retrait-lieux.cjs` (10 rouges sur le build d'avant, port `BANC_PORT`).


### Le widget lit l'argent REÇU publié par l'app (17 octobre)
`api/widget.js` calculait `received` sur `email_final_*` ; Ma journée dit « Reçu en {mois} » par `recuDuMois` (§11). L'écran Ventes publie désormais `recu: {[mois de versement]: €}` dans `vinted_urssaf_mois`, devenue **synchronisée** (SYNC_KEYS : le serveur ne voyait pas cette clé, locale à l'appareil) ; le widget la lit par projection de `main` (`recuDuMoisPublie`). Absente, illisible, d'un autre mois, de plus de 3 jours (`at` ne bouge qu'au changement de contenu) ou sans `recu` ⇒ `received: null` + `receivedRaison` ; une source `pasSu` ⇒ `received: null`, `receivedAuMoins` + `receivedManque` (un vieux script l'aurait affiché complet). Plus aucune lecture `email_final_*`. Banc `widget-multi.cjs` : 9 rouges sur l'avant, 4 mutations rouges. ⚠️ Le script Scriptable de l'iPhone n'est pas dans le dépôt : à lui de lire `receivedAuMoins`.


### Le bénéfice brut et net dans Comptabilité (19 octobre)
Julien : « le bénéfice brut et net ». Comptabilité disait « ce n'est donc pas
encore ton bénéfice net ». Elle affiche maintenant **« Ton bénéfice »**
(Mois · Trimestre · Année, `BeneficeCompta`) : brut, − frais de vente, −
charges, − cotisations URSSAF, net.
- **Une règle, un propriétaire (§11)** : `ajouterVenteBenefice` /
  `resumeBenefice` (centimes entiers, module) servent `totals` de l'écran Ventes
  ET la publication `vrm_benefice_jours` (SYNC_KEYS : cumuls PAR JOUR de vente,
  tableaux de 7 nombres, deux années au plus), que Comptabilité somme
  (`beneficeDesJours`, `beneficePeriode`). Comptabilité ne relit aucun prix
  d'achat. Le prix d'achat d'une fiche : `achatDe(e)` (aussi `buyOf`).
- **Brut et net des ventes** : seulement les ventes au prix d'achat connu
  (« 0 » saisi est connu), couverture écrite (« X ventes sur Y ») avec la porte
  (saisie en série). **Net final** (net des ventes − charges de la période −
  cotisations sur la part VINTED du CA déclaré publié) : « — » si un prix d'achat
  manque (`raison: achats`) ou si le CA déclaré n'est pas publié (`cotisations`).
  Jamais publié ⇒ « se calcule dans Ventes ». Un compte non lu ⇒ Ventes ne
  publie pas (la dernière, complète, reste). Aucune couleur sur un bénéfice.
- Limites dites à l'écran : ventes Vinted seulement (Leboncoin/eBay n'ont pas de
  prix d'achat reliés) ; brut au jour de la VENTE, cotisations au CA VERSÉ.
- Preuves : `audit-benefice.cjs` (vraies fonctions dans un vm, 19 contrôles ;
  `--mutation=duplique|zero|cotis` ⇒ 3 · 4 · 1 rouges) ; banc
  `chiffres-croises.cjs` section E (Compta = Ventes « Ce mois », `data-benef-*`
  / `data-ventes-benef-*`) : **10 rouges sur le build d'avant**, rouge sous la
  mutation « second calcul divergent ».


### « Ton bénéfice » dans Ma journée, sur son choix (20 octobre)
Julien : « la possibilité de mettre le bénéfice dans Ma journée ». Aucun mécanisme
de cartes personnalisables n'existait : un réglage dédié.
- **Facultatif** : `vrm_journee_benefice` (SYNC_KEYS, défaut **éteint**, rattrapé
  par `onCloudReady` seulement s'il est resté à `false`, `useBeneficeJournee`).
  Le geste est dans Ma journée (« + Afficher ton bénéfice dans Ma journée », en
  bas, discret ; « Masquer de Ma journée » sur la carte) et dans Réglages →
  Affichage (`BeneficeJourneeSetting`, interrupteur).
- **Aucun second calcul (§11)** : la carte de Comptabilité et celle de Ma journée
  passent par le MÊME crochet `useBeneficeCalcul(compta, periode)` (publication
  `vrm_benefice_jours`, charges `vrm_compta`, CA déclaré publié, `beneficePeriode`).
  Ma journée dit le **mois** (brut, net final, couverture « prix d'achat connus
  pour X ventes sur Y », raison du « — » : achats · frais eBay · CA déclaré) et
  **aujourd'hui** (`beneficeDesJours` sur la même publication : brut et net des
  ventes ; charges et cotisations se comptent au mois). Jamais publié ⇒ « se
  calcule dans l'écran Ventes », aucun montant. Lien « Détail › » vers
  Comptabilité. Aucune couleur (§7). Attributs `data-journee-benef-*`.
- ⚠️ Ma journée est elle-même un lecteur des ventes (`Comptabilite only="journee"`)
  et PUBLIE le bénéfice dès que les ventes sont lues : « pas de publication » ne
  se voit que si les ventes sont illisibles ou sur un appareil qui n'a rien lu.
- Preuves : banc `scripts/bancs/benefice-journee.cjs` (port `BANC_PORT`, données
  inventées, 1512 et 390 tactile, 52 contrôles ; il GARDE la ligne `main` écrite
  par l'app) — absente par défaut, geste dans Ma journée, « pas su » sans
  publication, brut/net/couverture/raison = Comptabilité (prix complets + une
  charge fixe, puis un prix manquant), Réglages l'éteint. **26 rouges sur le
  build d'origin/main** (§6.1) ; mutation « second calcul divergent » (charges
  ignorées dans Ma journée) ⇒ 2 rouges (net 86,13 € contre 66,13 €).
- Non mesuré : sa vraie base (données inventées) ; un choix basculé puis la page
  rechargée en moins de ~1,3 s revient à l'ancien (délai d'envoi au nuage, comme
  tout réglage synchronisé).


### « Le boost est-il rentable ? » (Statistiques, 21 octobre)
Fonction retenue le 11 octobre. Carte `BoostRentable` sous « Ce qui se vend »
(une seule voix, §7), règle pure `src/boostRentable.js`.
- **Mesuré (lecture seule)** : `promoted` = 0 `true` sur 380 annonces captées (347
  `false`, 33 sans le champ) ; « Boost payé » (`vinted_annonce_numeros[id].fees`)
  saisi sur 0 fiche sur 478 ; `boost_forme` n'a vu que `bumps`
  (`minimum_price.has_free_bumps`, 41 fois) ; `invoice_lines` des porte-monnaie :
  aucune ligne de boost. ⇒ Aujourd'hui la carte dit « pas assez de ventes pour
  juger » — c'est juste.
- **Règle** : vente → annonce par la transaction (`txn[tx].item`), jamais par le
  titre ; boostée = `promoted === true` OU « Boost payé » > 0 ; non boostée =
  `promoted === false` sans montant ; absent = pas compté (dit). Comparaison
  limitée aux tranches de prix (< 30, 30-60, 60-100, ≥ 100 €) où il y a des deux
  côtés ; moins de 5 de chaque côté ⇒ aucun chiffre ; chaque mesure (délai
  médian, vues, favoris, marge médiane boost déduit) exige 5 valeurs connues de
  chaque côté, sinon « — ». La marge d'une boostée exige son montant saisi
  (sinon coût inconnu) et son prix d'achat (`prixAchatDe`). Annulées et comptes
  écartés exclus. Transactions, annonces ou fiches illisibles ⇒ « pas pu lire ».
  Mêmes lectures que « Ce qui se vend » (`lireExtrasRepartition`, qui garde
  maintenant `promoted`, `views`, `favourites`). Un repère : n'entre dans aucun
  total. Aucune couleur verte/rouge.
- ⚠️ Vinted ne dit « boostée » que PENDANT le boost : une paire boostée puis
  vendue après la fin compte parmi « les autres » si le montant n'est pas saisi
  (la carte le dit).
- Preuves : `audit-boost-rentable.cjs` (18 contrôles ; `--prouve` 7/7 mutations :
  seuil, absent = non boostée, sans tranche, boost non déduit, marge sans
  montant, « pas su » lu vide, rapprochement par titre) ; banc
  `bancs/boost-rentable.cjs` (`BANC_PORT`, 1512 + 390 tactile, données
  inventées) 32 contrôles, rouge sur le build d'origin/main, rouge sous mutation.


### Les feuilles sous la barre du bas, sur iPhone : la vraie cause (23 octobre)
Julien, sur iPhone : la feuille « Reçu d'achat » passe SOUS la barre du bas, qui
en cache la fin. Même plainte le 30 sept. (« Se déconnecter ») et le 2 oct.
(« CSV / PDF introuvables »), traitée feuille par feuille par des portails.
- **Mesuré** (code de WebKit, `StyleAdjuster.cpp`) : sur iPhone seulement
  (`ENABLE_WEBKIT_OVERFLOW_SCROLLING_CSS_PROPERTY`), un élément qui défile et
  porte `-webkit-overflow-scrolling: touch` reçoit un z-index 0 — un contexte
  d'empilement. `<main className="vrm-main">` le portait depuis la coque
  (28 sept.) : **toute** feuille rendue dans l'écran était peinte dans la couche
  de `<main>`, sous la barre du bas (z-index 60) et l'en-tête, quel que soit son
  z-index. Chromium ignore la propriété : aucun banc ne pouvait le voir.
  Le zoom 0,8 n'y est pour rien (il est d'ailleurs ramené à 1 par
  `styles-iphone.css`).
- **Corrigé à la racine** : la propriété est retirée de `<main>` (depuis iOS 13
  le défilement à inertie est natif, elle ne servait plus qu'à piéger). Les ~40
  feuilles rendues dans l'écran sortent toutes d'un coup, le bloc du reçu n'est
  pas touché. ⚠️ **Ne jamais remettre `-webkit-overflow-scrolling: touch` sur un
  conteneur qui peut contenir une feuille** (les quelques autres qui la portent
  — rangées défilantes, corps de feuilles — n'en contiennent aucune).
- **Et un défaut de tous les navigateurs** : « 📦 Paires du lot » (z-index 80)
  s'ouvrait depuis le tiroir d'une vente (`vrm-ledger-drawer-host`, z-index 150,
  dans `document.body`)… dessous. Passée à 1300.
- **Preuve** : banc `feuilles-coque.cjs` (ports 9211-9220, fixtures + reçus
  inventés) — en 390 tactile il APPLIQUE la règle de WebKit (style en ligne posé
  par React et règles de la feuille livrée), en 1512 rien. 15 feuilles ouvertes
  comme Julien (reçu, note, outils d'Annonces, passeport, rapport comptable,
  registre, paires du lot, « Tout imprimer », nouvelle facture, « Supprimer ce
  compte »…) : rien par-dessus (coins et bas du panneau, haut du voile), bas du
  contenu touchable, boutons à 44 px. **26 rouges sur le build de bf0a9c8**
  (24 iPhone, 2 ordinateur — le lot), 0 après ; mutation « propriété remise sur
  `<main>` » ⇒ 24 rouges, « lot à 80 » ⇒ 4.
- **Non mesuré** : un vrai iPhone (pas de WebKit d'iOS ici : c'est sa règle,
  lue dans son code, que le banc applique) ; les feuilles qu'aucune donnée de
  banc n'ouvre (Stock, bordereau tamponné, fiche Leboncoin sans extension).
- ⚠️ **`mobile.cjs` meurt parfois** (« reading 'querySelectorAll' » : l'en-tête
  lu juste après `main`) : une course DU BANC, mesurée au même taux (environ une
  page sur trois sous charge) sur bf0a9c8, sur ce correctif et sur ses deux
  mutations. Le relancer seul ; ce n'est pas l'app.

#### Revue du même jour — huit défauts reproduits au banc, corrigés
Chacun ROUGE sur le build de 8a573a4 (le banc final copié dans l'arbre et lancé
depuis lui, §6.1), vert après, rouge sous une mutation.
- ⚠️ **L'ordre des couches est écrit une fois**, en tête de `SheetShell` : les
  écrans et leurs feuilles (≤ 1300), le tiroir d'une vente (150), le lot
  « Bordereaux à imprimer » (9000), « Mon compte » (10000), **une confirmation
  `Z_CONFIRMATION` = 20000**, **les messages `Z_MESSAGES` = 30000**, le bloc
  « Recharger » (100000). Une nouvelle couche se range dans cette liste.
- **D1 + D8 — la confirmation s'ouvrait SOUS le lot** (« C'est la bonne paire,
  imprimer », « Oui, c'est écrit » : `askConfirm` → `SheetShell` à 2000, le lot
  à 9000) : on ne pouvait ni confirmer ni annuler. `ConfirmHost` (et la saisie)
  passe par un portail dans `document.body`, à `Z_CONFIRMATION`.
- **D7 — les messages passaient sous les feuilles** (« Échec de la suppression »
  sous « Supprimer ce compte », « Ces bordereaux n'ont plus leur PDF » sous le
  lot) : le `Toaster` monte à `Z_MESSAGES`, et sur téléphone il se pose **en
  haut** quand une feuille est ouverte (le registre `_feuillesOuvertes` de
  `FermeAuRetour` le prévient : `abonnerFeuilles`, `uneFeuilleOuverte`) — en bas
  il cachait les boutons de la feuille. Sur ordinateur il reste en bas à droite.
- **D2 — les feuilles de l'en-tête** (« Tous les écrans » en variante haute,
  le panneau « État des actions ») vivaient dans l'en-tête sticky (z 50), donc
  sous la barre du bas (z 60) en paysage et sur iPad : bas de la feuille caché,
  barre du bas touchable derrière le voile. Portail dans `document.body` ; le
  panneau est borné à l'écran (`100dvh` moins en-tête et zones sûres, défile).
  ⚠️ Le panneau n'a été pris en défaut qu'en **568 × 320** (petit téléphone en
  paysage) : en 844 × 390 il fait 212 à 224 px et tient au-dessus de la barre,
  avec ou sans extension (mesuré, bf0a9c8 comme 8a573a4).
- **D3 — le bas de 8 feuilles tombait dans la zone de la barre d'accueil**
  (34 px sur iPhone en PWA) : reçu, Répartir un lot, Rapport comptable,
  Registre, Audit, Passeport, « Supprimer ce compte », Paires du lot. Leur
  panneau porte `env(safe-area-inset-bottom)` en bas, comme `SheetShell`.
- **D4 — « Paires du lot » au-dessus du tiroir ne prenait pas le clavier** :
  Échap fermait le tiroir CACHÉ, le lot restait. Le panneau est un `dialog`
  (focus à l'ouverture), Échap le ferme sans aller plus loin, et le focus revient
  à « Voir les paires du lot », retenu AU CLIC (Safari ne donne pas le focus à
  un bouton cliqué). ⚠️ Ce bouton vit dans le repli « Modifier » de la vente :
  replié, il n'est pas focalisable (le premier jet du banc le cliquait par
  script, repli fermé, et concluait à tort que le focus ne revenait pas).
- **D5 — les reçus du banc n'avaient pas la forme réelle** (`prix` « 40,00 € »
  et aucun `texte` : l'écran affichait « 40,00 € € », jamais le détail).
  Mesuré (formes seules, sans valeur) : `prix` sans « € », pas de `montant`,
  un `texte` « *Vendeur* … · Article … · Frais de port … · Protection
  acheteurs … · *Montant payé* … ». Le banc sert cette forme et l'exige au rendu.
- **D6 — l'Inventaire physique et le Studio photo** n'avaient pas de
  `FermeAuRetour` : « retour » quittait la section. Posé (la caméra du Studio se
  coupe au démontage).
- **Preuves** (`feuilles-coque.cjs`, 183 contrôles — parties `confirmation`,
  `messages`, `entete` dont 568 × 320 et une extension simulée qui répond,
  `clavier`, et la zone sûre de 34 px posée par CDP) : **32 rouges sur
  8a573a4**, 54 sur bf0a9c8, 0 après. Mutations, chacune rouge sur SA partie :
  confirmation remise à z 2000 ⇒ 4 · messages à 210 ⇒ 4 · feuilles de l'en-tête sans portail ⇒ 5 · reçu sans zone sûre ⇒ 1 · lot sans gestion du clavier ⇒ 3 · Inventaire sans `FermeAuRetour` ⇒ 4 · reçus du banc à l'ancienne forme ⇒ 2.
- **Non mesuré** : un vrai iPhone (zone sûre posée par le banc, règle de WebKit
  appliquée par lui) ; le toast en haut sous l'encoche d'un vrai téléphone ;
  les feuilles qu'aucune donnée de banc n'ouvre.

---


### Rappel URSSAF à l'échéance (fonction retenue le 11 octobre, 20 octobre)
Le rappel du 30 septembre partait le 1er de chaque mois, sans date ni montant, quel que soit le rythme (trimestriel : deux rappels sur trois pour rien), même pour une période déjà notée « déclaré ». Une règle, `rappelUrssaf` (module, à côté d'`aPayerUrssaf`) : la période de la prochaine échéance (`nextUrssafDeadline`, rythme `vinted_urssaf_freq`) doit être FINIE ; tous ses mois notés dans `vrm_urssaf_declare` ⇒ rien ; rappel les 3 premiers jours du mois ET les 7 derniers jours avant l'échéance (ambre). Montant : la ligne publiée `vinted_urssaf_mois` (mois de la période seulement, `aPayerUrssaf`) ; absente ⇒ aucun montant (« se calcule dans Ventes ») ; ventes sans date de versement ⇒ « au moins ». Ma journée : action `data-job="urssaf"`, `data-urssaf-echeance` (AAAA-MM-JJ local), `data-urssaf-apayer`. Aucun cron, aucune notification serveur (le « rappel la veille au soir » reste à trancher par Julien). Preuves : `audit-rappel-urssaf.cjs` (14 contrôles, `--mutation=rythme|declare|zero|fenetre` 2 · 2 · 2 · 3 rouges) ; banc `rappel-urssaf.cjs` 8 rouges sur le build d'avant, 2 sous la mutation « registre ignoré ».
- **Mesuré, pas construit — « achats à vérifier avant la date limite »** (lecture seule, 20 oct.) : la date limite existe, mais UNIQUEMENT dans le message d'action « Confirmation nécessaire » d'une conversation captée (`entity.subtitle` « d'ici le 21 sept. 15:59 », `interpolation_values.subtitle.return_shipment_date`, sans année ; « tu disposeras de 2 jours »). Vu dans **2 conversations sur ~1 400**, toutes deux anciennes ; les commandes et les transactions n'ont aucun champ de date limite ; **14 achats sur 581** ont leur conversation captée ; aucun achat n'est aujourd'hui dans l'état « livré, à confirmer ». ⚠️ `transaction.current_user_side` vaut « seller » sur ces deux achats où il est l'acheteur : ne pas s'y fier. Pour le construire, l'extension doit lire la conversation des achats livrés (comme `capterRetraits` le fait pour les colis au relais) — chantier extension.
- **Pas construit — « fiche prête à l'arrivée d'un achat »** : rien ne relie un achat à une paire par identité (§5 « prix d'achat : aucun pont automatique » — il rephotographie ses paires) ; une fiche pré-remplie depuis l'achat serait un rapprochement deviné. À définir avec lui.

- ⚠️ **Noté, pas corrigé (session eBay)** : le CA et le bénéfice eBay lisent `pricingSummary.total`, port compris — contraire à §2.8 et à la décision « l'argent que tu reçois » (dû au vendeur − frais). Non mesuré : 0 commande eBay en base, aucune facture manuelle, forme réelle de `cancelState` non vue.


### URSSAF et compta : « C'est déclaré », la notification du 1er, le net avant dépenses, le relevé (22 octobre, propositions 5, 9, 10)
**Mesuré (lecture seule, sa base, 22 oct.)** : `vrm_urssaf_declare` ABSENT de `main` (aucun mois jamais noté) ; `vinted_urssaf_freq` = mensuel ; la ligne publiée `vinted_urssaf_mois` dit septembre 89 ventes, **4 330,90 €** (⇒ 584,67 € à 13,5 %), et 2 ventes Leboncoin sans date (133 €) ; `vrm_compta` ABSENT (aucune dépense, aucun abonnement jamais noté) alors que `vrm_journee_benefice` = true ; 0 ligne `harvest_*_releve_*`, 0 compteur `releve_*`, extension 5.211, et les 4 lignes `_billing` de forme complète portent `history: []`.
- **(5) « C'est déclaré »** sur la carte URSSAF de Comptabilité (« Prochaine déclaration », à côté du lien URSSAF) ET sur la ligne URSSAF de Ma journée. Il pose `DEMANDE_DECLARATION` (le mois, 30 s au plus) et va sur Ventes : le rapport comptable s'y ouvre sur CE mois et le formulaire « Qu'as-tu déclaré ? » se déplie seul — **le même formulaire, pas une copie (§11)** : le registre retient l'identité des ventes, seul le rapport les a. **Mêmes gardes** : lecture encore en cours ⇒ on attend ; lecture ratée (`lectureIncomplete.rates`) ⇒ rien ne s'ouvre, le bouton reste grisé avec sa raison ; registre pas su ⇒ on attend ; mois déjà noté ⇒ le rapport le montre. Période pas finie (trimestre en cours) ⇒ pas de bouton. Tout noté ⇒ « ✓ Notée « déclarée » le … » et l'échéance ne se colore plus (§7). Trimestriel : le bouton nomme le mois à noter (`aNoter`, rendu par `rappelUrssaf`). Ma journée : la ligne devient un groupe de deux boutons (un bouton ne se met pas dans un bouton), et se recalcule dès que le registre est enregistré (`vrm:save` → `colisTick`).
- **La notification du 1er** (api/ship-reminders.js, partie URSSAF seule) passe par la RÈGLE DE L'APP : `rappelUrssaf` recopié dans `api/_lib/urssaf-regle.js` (miroir, **jamais modifié à la main** : `node scripts/audit-rappel-urssaf.cjs --recopie`), appelé par `api/_lib/rappel-urssaf.js` (`notificationUrssaf`, pure). Elle suit le rythme, se tait pour un mois noté, donne le montant de la ligne publiée — le texte est mot pour mot celui de Ma journée — et ouvre Ma journée. `main` illisible ⇒ le rappel d'avant, SANS montant. La réponse du cron ne porte aucun montant. Toujours le 1er seulement, une fois par mois (`urssaf_reminder_dedup`).
- **Tranché** : le montant d'une période (`montantPeriodeUrssaf`, une règle pour le rappel, la notification ET la carte « Prochaine déclaration ») est un **minimum** (« au moins ») quand la ligne a été publiée AVANT la fin de la période — sinon la notification du 1er présentait comme complet un total calculé le 27 si Ventes n'a pas été rouvert. Date de publication illisible ⇒ « au moins ». ⚠️ La ligne ne se republie que si son contenu change : un mois sans aucun mouvement après la fin du mois garde son « au moins » (vrai, juste imprécis).
- **(9) Les charges en trois états** (`depensesEtat`, la même pour Comptabilité et Ma journée via `beneficePeriode`) : `jamais` (rien noté, pas répondu) ⇒ « **Net avant tes dépenses** », la ligne « − charges » à « — », et le choix UNE fois (`ChoixDepenses`) : « Je n'ai pas de dépenses à noter » (range `vrm_compta.sansDepenses = {at}`, synchronisé ; la réponse compte comme une saisie dans `comptaVide`, le rattrapage du nuage ne l'écrase pas) ou « Ajouter une dépense » (le formulaire de Comptabilité, déplié par `DEMANDE_DEPENSE`) ; `aucune` ⇒ 0 € vrai ; `notees` ⇒ inchangé. Le choix n'apparaît qu'une fois le nuage arrivé (pas su ≠ jamais noté). Les `data-benef-*` gardent leurs valeurs (charges 0) : les bancs croisés restent juges.
- **(10) Le relevé n'est plus promis** : « l'extension le récupère à ta prochaine visite » s'affichait dès l'extension à jour, et n'arrivait jamais. Une seule phrase, quelle que soit la version : « VRM n'a pas encore réussi à le lire pour ce mois. Le CA ci-dessus n'en dépend pas ». Aucune adresse Vinted devinée (§3). Lecture du relevé ratée ⇒ « la base n'a pas répondu » (elle valait « rien de capté »). `data-releve` = `encours` · `passu` · `pasencore` · `lu`. `EXT_CAPACITES.releve` reste dans la table (plus lue par l'écran).
- **Preuves** : `audit-rappel-urssaf.cjs` (vraie règle dans un vm + miroir au jeton près + règle de la notification + le VRAI cron exécuté un 1er octobre, faux Web Push) — **24 rouges sur origin/main** (d198bca : aucun montant, `?tab=dashboard`, sonne pour un mois noté, sonne en trimestre en cours) ; mutations `rythme · declare · zero · fenetre · date · serveur-registre · serveur-montant · serveur-passu` ⇒ 3 · 3 · 3 · 5 · 3 · 2 · 6 · 2 rouges. `audit-benefice.cjs` + 6 contrôles (rouge sur main ; mutations `depenses` ⇒ 2, `reponse` ⇒ 1). Banc `scripts/bancs/declare-urssaf.cjs` (données inventées, `BANC_PORT`, 390 tactile et 1512, horloge au 27 octobre, base cloisonnée pour que la déclaration parte au nuage) : **61 contrôles** — Comptabilité et Ma journée ⇒ le formulaire sur septembre, 3 ventes notées par identité, écrites au nuage, le bouton/la ligne partent sans recharger ; versements illisibles ⇒ rien ne s'ouvre ni ne s'écrit ; net avant dépenses, réponse rangée et lue par Comptabilité, « Ajouter » ouvre le formulaire, une dépense notée ⇒ plus de question ; relevé identique extension absente / à jour, « pas su » sur un 522. **23 rouges sur le build d'origin/main** ; un build réaffaibli (garde retirée · ancienne promesse sur extension à jour · `depensesEtat` sans `jamais`) ⇒ **15 rouges**, chaque groupe sur SA mutation. Bancs voisins verts (`rappel-urssaf`, `rapport`, `vendu-recu`, `chiffres-croises`, `stats-compta`, `seuils-vinted`, `bilan-semaine`, `ship-multi`, `serveur`, `rappel-soir`, `widget-multi`) ; `benefice-journee` garde ses 2 rouges D (« éteint ⇒ plus de carte ») — **déjà rouges sur origin/main**, pas de ce lot.
- ⚠️ **Les bancs de rendu qui n'appellent pas `_porte-banc.cjs`** (rappel-urssaf, rapport, vendu-recu, chiffres-croises, stats-compta, seuils-vinted, benefice-journee…) restent sur l'écran de connexion depuis le retrait de l'accès direct : lancés ici par une enveloppe qui pose la porte sur leur playwright absolu. Les y brancher reste à faire.
- **Revue (nuit du 22 au 23 oct.) — trois défauts reproduits, corrigés** (chacun rouge sur 942ab62 — copie `git archive`, contrôle lancé depuis elle —, vert après, rouge sous mutation) :
  1. **Ma journée à 390 px : le choix des dépenses était illisible** (1,3 à 1,7:1 en clair, 2,2-2,7:1 en sombre) : `ChoixDepenses` posait C.text / C.muted / C.accent en ligne, qui battaient les couleurs du bandeau sombre du bilan. En `compact`, plus aucune couleur imposée : le texte hérite de la note (`.vrm-day-note`, couleur posée par le bandeau), les deux gestes sont des `vrm-lien-action` (la couleur des liens de la carte). Mesuré après : phrase 5,5:1, gestes 6,3:1 (390 clair et sombre), 5,8 à 6,3:1 à 1512. Banc `declare-urssaf.cjs` : contraste RENDU calculé (WCAG, fonds remontés jusqu'au premier opaque, un dégradé jugé sur sa PIRE couleur) en E (390 et 1512, clair) et E2 (390 sombre) — **2 rouges sur le build de 942ab62**, et rouge sous la mutation « lien sans `vrm-lien-action` » (1,43:1).
  2. **« à payer ≈ au moins 0,00 € »** dans la notification du 1er quand la ligne publiée date d'AVANT la période (Ventes pas rouvert depuis août) — un zéro qui veut dire « pas su » (§7). `montantPeriodeUrssaf` (une règle : rappel, notification, carte « Prochaine déclaration ») rend **aucun montant** (« Le montant se calcule dans Ventes ») si la ligne est publiée avant le DÉBUT de la période, ou si elle n'en porte AUCUN mois et que son total n'est qu'un minimum (publiée avant la fin, date illisible, ventes sans date de versement). **Tranché au-delà de la proposition du relecteur** : « au moins 0,00 € » ne se dit jamais, quelle qu'en soit la cause. L'autre sens tient : ligne publiée après la fin, lue, sans vente du mois ⇒ un vrai « 0,00 € ». Conséquence assumée : sur un trimestre EN COURS sans vente encore versée, la carte de Comptabilité dit « — » au lieu de « au moins 0,00 € ». La raison du cron dit « ligne publiée trop tôt » (sans montant).
  3. **Le serveur (UTC) et l'app (Paris) ne jugeaient pas « au moins » à la même heure** : la fin de période était minuit LOCAL. Début et fin se calculent en **heure de Paris** (`minuitParisMs`, `Intl`, recopié dans le miroir) : une ligne publiée à 00:30 le 1er (Paris) n'est plus « au moins » côté serveur seulement.
  - `audit-rappel-urssaf.cjs` : +6 contrôles (sonde du relecteur côté app ET serveur, l'autre sens) et une **section 4** qui exécute la règle dans DEUX processus, `TZ=Europe/Paris` (Ma journée) et `TZ=UTC` (la règle comme le serveur l'appelle, et la VRAIE notification du miroir), sur trois publications autour de minuit Paris (hiver, été, et 23:30 la veille ⇒ « au moins » des deux côtés) — **9 rouges sur 942ab62** ; mutations nouvelles `ancienne` ⇒ 4, `fuseau` ⇒ 3, `serveur-ancienne` (le miroir réaffaibli dans une copie) ⇒ 1 ; les huit d'avant restent rouges.
- **Non mesuré** : la notification sur un vrai téléphone ; l'heure réelle du cron ; le rendu sur sa vraie base (données inventées) ; `urssaf.cjs` et `revue-19oct.cjs` (fixtures absentes ici, non lancés) ; le contraste sur un vrai iPhone (calculé dans Chromium).
- **Geste de Julien** : noter septembre (« C'est déclaré » dans Comptabilité ou Ma journée), et août **s'il l'a déclaré à la date de vente** (Ventes → Outils → Rapport comptable → août) — sinon les 30 ventes d'août versées en septembre comptent deux fois. Puis, s'il n'a vraiment aucune dépense, répondre une fois « je n'ai pas de dépenses à noter ».


### Tes colis à l'heure : le rappel du matin, le widget et l'heure limite (22 octobre, propositions 1 et 4)
- **Mesuré (lecture seule)** : le matin du 22, `ship_reminder_dedup` = {total 0} alors que le soir du 21 en comptait 3. Deux règles à lui : il sautait un
  bordereau **imprimé** (`vinted_bords_printed`) comme un colis parti — l'app a décidé l'inverse — et ne partait que des bordereaux reçus par **email** (30 jours :
  angeled92 0/18, tomj606 0/8, arthuror2 1/10). Le widget faisait les deux mêmes erreurs pour son urgence. Et **204 `email_bord_*` sur 205 portent l'heure**
  (« JJ/MM/AAAA HH h MM », 90 à 10 h 00) : `api/email-inbound.js` la gardait déjà dans `dateLimite`, ce sont TOUS les lecteurs qui la jetaient (`frToIso`,
  `joursAvantLimiteFr` à 23:59:59, `bordDeadline` « Date SEULE »). Vente → limite (202 ventes reliées, jour de Paris) : **jamais avant** vente + 7 j —
  140 le jour même, **62 de 1 à 3 jours PLUS TARD** (+1 : 28, +2 : 30, +3 : 4 ; remesuré le 23 oct.). vente + 7 j est un PLANCHER, pas la limite. Les bordereaux captés par l'extension (`harvest_{uid}_label_{tx}`) ne portent **aucune** date limite (clés : url, uid, tx, item, capturedAt).
- **Une règle** : `api/_lib/limite-envoi.js` (pur, importé par l'app comme `colisEbay`) — `lireDateLimite` (heure de **Paris**, Intl ; « 10 h 00 », « 10h00 »,
  « 10:00 » ; heure illisible ou inexistante ⇒ **jour seul**, fin de journée, comme avant), `limiteExpedition(o, b)` (email du bordereau, sinon vente + 7 j
  **estimée**, jour seul ; une limite dépassée vaut ≤ −1 jour **même le jour même**), `texteLimiteEnvoi` (« à poster avant demain 10 h », « en retard —
  c'était avant 7 h aujourd'hui »), `bordsParTransaction` (la table de Colis : PDF présent, le plus récent d'abord, masqué écarté), `compterEcheances`.
- **Le matin** lit la liste du soir (`txsAExpedier`, via `lireDonneesColis` partagé avec le soir) et la limite de l'app ; « imprimé » n'est plus « parti ».
  Texte : « 1 colis à envoyer (1 demain avant 10 h) », « Date estimée pour N » quand une limite est estimée. **Se tait** (pas su) : ventes, comptes, réglages
  ou **bordereaux** illisibles (une date estimée ne remplace pas une heure non lue), aucune vente Vinted captée — l'eBay part quand même. **Le soir** et **le
  widget** comptent avec la même fonction ; le soir écrit « 1 avec la date limite demain à 10 h ». Le widget rend `heureAujourdhui`, `heureDemain`,
  `sansLimite`, `datesPasSu` ; pour une vente sans email il ne lit QUE la ligne de ventes du compte concerné (`id=in.`, 13 à 50 Ko mesurés), jamais tout.
- **L'app** : la carte de Colis dit l'heure (`data-limite`, `data-limite-heure`, `data-jours`) ; Ma journée a une ligne `colis-limite` (le plus pressé, son
  heure, estimée dite) ; la notice des Ventes et Ma journée hors ligne disent la même phrase. `bordDeadline` et `joursAvantLimiteFr` sont retirés.
  La phrase des comptes muets disait « pas de rappel du matin pour leurs colis » : devenue FAUSSE, elle dit « leur date limite est estimée ».
- **Le cron du matin passe à 05:00 UTC** (vercel.json, pas de cron de plus) : 7 h–8 h à Paris jusqu'au 25 octobre, 6 h–7 h l'hiver (plan Hobby : ± 1 h). Le
  rappel URSSAF du 1er et le bilan du lundi arrivent donc plus tôt aussi.
- **Tranché** : le seuil « 0 5 » plutôt que « 0 6 » (la proposition acceptée disait 7 h l'été, 6 h l'hiver) ; `panel_bords_done` n'entre plus dans le matin
  (1 clé, figée depuis le 31 août, plus rien ne l'écrit) ; un bordereau email SANS PDF ne donne pas sa date (la règle de l'app, inchangée).
- **Preuves** : rejeu des VRAIES routes sur la projection de sa base (scratchpad, jamais commitée) — avant : matin **0**, widget 0/0/0 ; après : matin
  « **1 colis à envoyer (1 demain avant 10 h)** » (tomj683, 23236225358), widget tomorrow 1 · 10:00. `audit-colis-heure.cjs` (routes exécutées, 23
  contrôles) : **14 rouges sur origin/main** (copie `git archive`, lancé depuis la copie), vert après ; mutations « imprimé resauté » 3 rouges, « jour
  seul » 6+, « widget email seul » 2, « limite estimée retirée » 5. Banc `colis-heure.cjs` (port 6301, rendu, 390 + 1512 px, horloge fixée au 22 à
  8 h 10 Paris) : vert après, **12 rouges sur le build d'origin/main**, mutation « heure ignorée » dans l'app 6 rouges ; `comptes-sans-email` 4 rouges sur
  ce build. Bancs mis à la forme réelle (§6.3, `filename` porté par 204/204 bordereaux) : `rappel-soir`, `ship-multi`, `widget-colis` ;
  `comptes-sans-email` juge la nouvelle phrase ; `audit-statuts` suit la règle dans le module.
- ⚠️ **Non mesuré** : ce que fait Vinted après l'heure limite (rien n'est promis) ; l'heure réelle du cron chez Vercel ; la limite eBay garde ses jours
  calendaires (`colisEbay`, domaine eBay — une limite eBay d'aujourd'hui passée n'est pas encore « en retard ») ; le script iOS du widget (il peut lire
  `heureDemain`, rien ne l'y oblige).

### Statistiques détaillées : d'où vient chaque chiffre (31 octobre)

Julien : « beaucoup plus de statistiques… de la vraie data ». Aucune règle nouvelle pour
une notion existante : les règles de calcul sont PURES dans `src/statsVentes.js`
(`rythmeVendu`, `quandTuVends`, `margesPar`, `delaisPar`, `stockQuiDort`, `rotationStock`,
`tauxVenteMois`, `tauxAnnulation`), exécutées par `scripts/audit-stats-ventes.cjs`.
- **Vendu** (rythme, semaines, jours, heures, panier) : `liveStats.venduLignes`, les lignes
  de `ventesFaites` publiées par la coque (la population de « Vendu » de Ma journée) ; Ma
  journée (« Tendances ») passe `vendus.lignes`, la même règle. Bornes à minuit LOCAL
  (`minuitLocal`, juste au passage à l'heure d'hiver). Une date sans heure (minuit pile)
  n'est dans aucune heure. Moyenne = 28 jours pleins d'avant, aujourd'hui exclu ; première
  vente plus récente ⇒ moyenne sur les jours depuis elle, et dite. Lecture ratée d'une
  plateforme ⇒ nommée, montants « au moins ».
- **Bénéfice et marge par groupe** : nouveau relevé `vrm_stats_ventes` publié par l'écran
  Ventes dans le MÊME effet que `vrm_benefice_jours` (mêmes ventes finalisées, hors
  masquées, mêmes gardes : rien si un compte, Leboncoin ou eBay n'est pas lu ; prix
  d'achat par `effEntry`/`achatDe`, Leboncoin/eBay par identité via `ventesAutresBenefice`).
  Rangé sur l'appareil seulement (pas dans `main`). Le titre d'une vente Leboncoin/eBay est
  relu par SON identifiant (txId, orderId) pour la marque — `ventesAutresBenefice` ne lit
  toujours aucun titre (`audit-benefice`). Brut = vente − achat sur les seules ventes au
  prix connu ; un groupe sans prix connu n'a ni brut ni marge (« — »), un frais pas su rend
  le net `null`. Couverture affichée « sur N ventes avec prix d'achat (sur M) » et « n/N »
  par ligne. Marque/modèle/taille : `clesVenteStats`, la clé de « Ce qui se vend »
  (`repartitionsVentes` l'utilise désormais aussi).
- **Temps de vente** : Vinted seulement, date de mise en ligne de l'annonce reliée par la
  TRANSACTION (`dateMiseEnLigneMs`) ; republiée après la vente ⇒ hors délai, dans la
  couverture.
- **Stock qui dort, rotation, taux de vente** : `vrm_stats_stock` publié par Annonces
  (`annBase`, `listedAgeDays`, mêmes gardes que `vrm_paires_dorment`). Rotation = annonces
  en ligne ÷ (ventes Vinted des 30 j ÷ 30), dite « un repère, pas une prévision » ; taux du
  mois = vendues Vinted du mois ÷ (vendues + en ligne).
- **Annulations** : commandes Vinted de la coque, `classifyOrderStatus`, comptes exclus
  écartés.
- **Non fait, dit ici** : délai d'expédition (aucune date d'envoi fiable par vente),
  remise prix affiché → prix vendu (le prix affiché d'une annonce vendue n'est pas gardé),
  rentabilité du boost (la carte « Le boost est-il rentable ? » existe déjà).

### Comptabilité et régime : demander, puis dire (1er novembre)

Même tournée que « Paramètres, arrivée guidée et communauté » (historique interface-stock).

- **Supprimer une dépense, un abonnement, un pack ou un coût fixe** (le « × » de la ligne) :
  avant, un toucher supprimait sans rien demander ni dire, sur une cible de 28 px. Après :
  confirmation qui NOMME la ligne et son montant (« 12,50 € sortent de tes charges et de tes
  rapports »), « Supprimé de tes charges » ensuite, cible 44 px. L'écriture part de l'état le
  plus frais (la confirmation est asynchrone : `majFraiche`).
- **« Arrêter » un abonnement** : demande d'abord (« le mois en cours reste compté, les suivants
  non »), puis « ✓ Abonnement arrêté ce mois-ci ».
- **Ajouter** une dépense, un abonnement, un pack : « ✓ … ajouté(e) » (rien ne le disait, le
  formulaire se refermait seulement).
- **Régime fiscal** (Paramètres) : « sur ce que tu encaisses » → « sur ce que tu reçois » (§5 :
  jamais « encaissé ») ; chaque choix montre sa ligne courte (« Je vends mes propres affaires »,
  « SAS, SASU, SARL, EURL… ») pour se reconnaître ; le taux saisi à la main dit
  « ✓ Taux enregistré : 12,4 % », et un taux illisible dit qu'il est remplacé par le défaut
  (avant : en silence) ; la ligne de Paramètres montre le statut choisi, « À choisir » sinon.
- Aucune règle de calcul ne change (§11).

Banc : `compta-abonnements` — « × » ⇒ la confirmation nomme l'abonnement ; « Annuler » ne
retire rien (écran et `vrm_compta`) ; « Supprimer » le retire des deux et le dit.

---

## 2 novembre — La facture Pro refaite : une vraie facture, émise d'un clic sur la vente, envoyée depuis la boîte du vendeur

**Demande de Julien** : « mettre à disposition la possibilité de créer sa propre facture quand on est en
compte Pro […] on remplit toutes les informations nécessaires, on peut mettre son logo, et à côté de chaque
vente professionnelle on appuie sur “Envoyer la facture à l'acheteur” et VRM l'envoie. Une facture
personnalisable mais une vraie facture, parfaite. »

**Mesuré avant (lecture seule)** : 5 ventes Pro réelles (`email_sale_*`, `pro:true`, toutes avec e-mail
d'acheteur et n° de transaction) ; 5 brouillons `email_invoice_tx*` numérotés FA-2026-0001…0005 à
l'ARRIVÉE de l'e-mail, jamais envoyés (la file ne partait que par le script Gmail de Julien, pas recollé) ;
la fiche `vrm_pro_facture` presque vide ; la facture d'avant (`buildInvoiceHtml`) ne portait ni « EI », ni
date de vente, ni quantité/prix unitaire, calculait une TVA sur un prix en régime de la marge (interdit,
art. 297 E) et ne partait que pour le propriétaire de l'installation.

**Ce qui est fait**
- `src/facturePro/regle.js` (pur, app ET serveur) : les mentions obligatoires d'une vente de biens à un
  particulier (L441-9 C. com., 242 nonies A ann. II CGI) — n° unique continu, dates d'émission et de vente
  (heure de Paris), vendeur (nom + « EI » pour un entrepreneur individuel, adresse, SIRET vérifié par Luhn,
  RCS et capital pour une société, n° de TVA si assujetti), acheteur (nom, adresse), désignation, quantité,
  prix unitaire HT, totaux en CENTIMES ; trois régimes jamais devinés : franchise (« TVA non applicable,
  art. 293 B du CGI »), marge (« Régime particulier – Biens d'occasion », AUCUNE TVA écrite), TVA classique
  (HT + TVA = TTC au centime) ; facture acquittée (« payée le … via Vinted ») ; nature « Livraison de
  biens ». `manquantsVendeur` / `manquantsVente` disent ce qui manque, en mots — rien n'est émis sinon.
  L'adresse de l'e-mail Vinted Pro (« rue, n°, ville, CP, code, pays » — forme mesurée sur les 5 réelles)
  est remise en lignes postales (`adresseVintedLisible`).
- `src/facturePro/pdf.js` (pdf-lib, le même dans l'app et sur le serveur) : A4, logo, couleur choisie,
  tableau, totaux, mentions, pied de page légal ; caractères impossibles (emoji) retirés, textes longs
  coupés ; aucune marque VRM.
- `api/_lib/facture-pro.js` (`/api/compte?mode=facture-pro`, 12 fonctions inchangées) :
  - **numérotation sans trou ni doublon** : compteur par vendeur (`vrm_invoice_counter`, avoirs
    `vrm_avoir_counter`) en comparer-et-échanger, avec un JOURNAL n → transaction (deux clics simultanés ou
    une coupure redonnent le MÊME numéro à la même vente) ; compteur ou fiche illisible ⇒ 503, rien de pris ;
    l'ancien compteur (un nombre) est repris ; les 5 brouillons d'avant gardent LEUR numéro ;
  - une facture émise est un **instantané** (`contenu`) qui ne change plus ; la corriger = un **avoir**
    numéroté AV-AAAA-NNNN, montants négatifs, lié à la facture (`annuleePar`) ;
  - **envoi depuis la boîte du VENDEUR** (§2.9 : aucun service d'envoi payé par Julien pour les autres ;
    l'acheteur voit l'adresse du vendeur et lui répond) : mot de passe d'application collé une fois,
    vérifié (connexion + AUTH, sans rien envoyer), rangé CHIFFRÉ dans le coffre (usage `smtp-facture-v1`,
    ligne `facture_boite`), jamais relu par le navigateur ; « M'envoyer un essai » ; copie cachée au
    vendeur (réglable) ; PDF + formulaire de retour Vinted joints, puis ses octets purgés ;
  - **trois issues** (envoyée · refusée · incertaine), « en cours » posé AVANT l'envoi (pas de double
    envoi), « Renvoyer » explicite.
- `api/_lib/smtp.js` : client SMTP sans dépendance (le registre npm n'était pas joignable) — TLS 465 /
  STARTTLS 587 (jamais en clair), AUTH PLAIN/LOGIN, MIME (en-têtes encodés, pièces jointes base64,
  points doublés) ; le serveur d'envoi doit être un NOM public (jamais une IP ni un nom local).
- `api/email-inbound.js` : l'e-mail de vente ne NUMÉROTE plus rien (un numéro se donne à l'émission) ; il
  garde le brouillon (acheteur + formulaire de retour) d'une vente Pro qui a sa transaction.
- `src/FacturePro.jsx` + `src/facture-pro.css` :
  - **sur la vente** (récapitulatif) : « Envoyer la facture à l'acheteur » — seulement sur une vente Pro
    PROUVÉE (e-mail Vinted Pro de SA transaction, ou profil du compte lu « professionnel » par la règle
    `typeCompteVinted`) ; acheteur prérempli par la transaction (jamais par ressemblance) ; aperçu ; une
    confirmation ; « Émettre et envoyer » / « Émettre sans envoyer » ; puis l'état (envoyée le …, à …),
    « Voir le PDF », « Partager » (feuille de partage de l'iPhone), « Renvoyer », « Annuler par un avoir » ;
  - **la fiche** (Comptabilité → Factures → Facturation Pro, ou « Compléter ma fiche » depuis la vente,
    le doigt sur le champ qui manque) : SIRET (nom et adresse retrouvés au registre public), forme, TVA,
    logo (réduit dans le navigateur, ≤ 200 Ko), couleur, début des numéros, note, message de l'e-mail,
    aperçu EN DIRECT, boîte d'envoi ;
  - **la liste des factures émises** (Factures) en scalaires — l'ancienne lecture `select=data` toutes
    les 5 minutes est retirée (§4.4), comme l'ancien circuit « mise en file » Gmail.
- La même ligne `vrm_pro_facture` reste la seule fiche (« Ton entreprise » de Comptabilité l'écrit aussi) :
  la fiche relit la ligne juste avant d'écrire et ne réécrit que SES champs.

**Preuves** : `scripts/audit-facture-pro.cjs` (48 contrôles — vraie route, fausse base à la vraie forme,
FAUX SERVEUR SMTP en TLS qui parle SMTP pour de vrai ; mutations : journal retiré ⇒ trou N5 ;
comparer-et-échanger retiré ⇒ six fois le même numéro) ; banc `scripts/bancs/facture-pro.cjs` (44, 390
clair + 1512 sombre ; mutation : état d'envoi pas gardé ⇒ rouge) ; `audit-routes-revue` A/A2/B et
`audit-vendeur-neutre` D, `compact` remis à la nouvelle règle.

**Gestes de Julien** : compléter sa fiche (Comptabilité → Factures → Facturation Pro : SIRET, forme, régime
de TVA) ; connecter sa boîte (Gmail : « mot de passe d'application ») et s'envoyer un essai ; puis, sur une
vente Pro, « Envoyer la facture à l'acheteur ». Les 5 ventes Pro déjà reçues gardent leurs numéros
FA-2026-0001…0005.

---

## 2 novembre (soir) — Comptabilité en trois questions

**Demande de Julien (20 h 41)** : « il y a beaucoup d'incompréhension de ma part quand je vais dans les
emails ou dans les statistiques, comptabilité, SURTOUT comptabilité. […] le plus simple possible pour les
utilisateurs. »

**Regardé avant (données inventées, 390 tactile clair + 1512 sombre)** : l'écran ouvrait sur « Vendu et
reçu » (trois fois 60,00 € : Vendu, Finalisé, Reçu (versé), plus un tableau), puis un bénéfice en cinq
lignes (« Bénéfice brut — CA − prix d'achat », « − charges », « − cotisations URSSAF », net), puis
« Statut : Micro-entrepreneur · Changer » flottant au milieu, la carte URSSAF (« À payer », « Net après
paiement », « Ventes finalisées », « Calculé sur le CA… »), la prochaine déclaration (« son montant est
celui du mois, juste au-dessus »), trois totaux de dépenses + deux totaux de section, le suivi, la
micro-entreprise ouverte, puis « Avancé ». Le même nombre écrit plusieurs fois (7,44 € à payer = la ligne
« − cotisations » ; 25,49 € deux fois ; 60,00 € quatre fois ; 12,99 € deux fois), du jargon (CA, brut,
Finalisé, charges, cotisations), un sommaire à cinq pastilles, deux sélecteurs de période sans lien.

**Fait (présentation seulement — aucune règle de calcul ne change, §5/§11)** :
1. **« Combien j'ai gagné ? »** (`BeneficeCompta`) : un libellé (« Ton bénéfice · octobre 2026 », ou « Net
   avant tes dépenses »), UN chiffre (`netFinal` de `beneficePeriode`, inchangé, `data-compta-chiffre="gagne"`),
   une phrase venue du même calcul (sa `raison` : « Il manque le prix d'achat de N vente(s) sur M : sans
   lui, VRM ne peut pas calculer ce que tu as gagné », sinon ce qu'il compte), la couverture, le geste
   (« Compléter les prix d'achat », « Ajouter une dépense », ou le choix des dépenses). Les lignes du calcul
   (bénéfice sur tes ventes, frais, dépenses, URSSAF) se replient sous « Le détail du calcul ». Les
   `data-benef-*` sont les mêmes.
2. **« Combien je dois déclarer ? »** (`StatutFiscal partie="declarer"` → `CarteUrssafMois`) : la
   prochaine déclaration EN TÊTE (date, compte à rebours, « À déclarer (argent reçu) » — l'ancien « Reçu
   (versé) » —, « À payer ≈ », « Déclarer sur l'URSSAF », « Noter ma déclaration »), puis « Octobre, en cours
   · à payer (12,4 %) » et sa phrase « À mettre de côté : 12,4 % de l'argent reçu en octobre, toutes
   plateformes (60,00 €, 1 vente) ». **Retirés de la carte** : « Net après paiement » (redisait le bénéfice
   autrement, sans les prix d'achat) et la tuile « Ventes finalisées » (le nombre est dans la phrase,
   `data-urssaf-mois-n`). Statut pas choisi ⇒ la question du statut ici ; autre régime ⇒ sa phrase ici.
3. **« Le détail »**, une liste de replis fermés (`ComptaRepli`, rendus même fermés) : « Vendu et reçu »
   (`CaParPeriodeCarte dansRepli`, une phrase dit vendu/reçu), « Tes dépenses » (deux repères : ce mois-ci,
   depuis janvier ; les totaux de section qui redisaient une ligne sont retirés), « Tes déclarations URSSAF »
   (`SuiviUrssaf sansTitre`), « Ta micro-entreprise » (inchangée, s'ouvre seule sur une question), et
   **« Documents et réglages »** (l'ancien « Avancé », même `id`/`data-compta-avance`) qui commence par
   « Ton statut · Changer ». Le sommaire à pastilles est retiré.
- Les gestes : « Ajouter une dépense » ouvre « Tes dépenses » et son formulaire ; la vente Leboncoin à
  dater renvoie par un bouton qui ouvre « Vendu et reçu » (`ouvrirRepliCompta`). Les gestes d'une réponse
  sont à l'encre, soulignés, 44 px : le bleu d'accent sur l'aplat gris des cartes ne tenait que 4,3:1
  (`--vrm-b-lien` surchargé dans la carte : la règle des liens-boutons passe par un sélecteur à identifiant).
- La facturation électronique renvoie à « Ton entreprise (Comptabilité → Documents et réglages) ».
- Styles : `src/styles-compta-claire.css` (chargée après la finition).

**Preuves** : banc `scripts/bancs/compta-claire.cjs` (données inventées : 5 ventes Vinted dont une en
cours, une Leboncoin pas datée, une Vestiaire, 2 dépenses, un abonnement, prix d'achat complets puis
partiels ; 390 tactile clair + 1512 sombre) : trois questions dans l'ordre, un chiffre puis sa phrase,
replis fermés (rien supprimé), chaque montant visible écrit UNE fois, aucun jargon visible (CA, brut,
Finalisé, encaissé, n/d), aucun débordement, cibles ≥ 44 px, aucune erreur page/console, chiffres
inchangés (−2,93 € · 7,44 € · 25,49 € · 42,68 €), manque nommé et « Compléter » visibles, les deux gestes.
Bancs remis à la nouvelle règle (en le disant dans chacun) : `compta-simple` (176 verts), `urssaf`,
`stats-compta`, `chiffres-croises` (plus de « Net après paiement », le CA et le nombre de ventes lus dans
la phrase), `declare-urssaf` (le libellé du net `data-benef-titre`), `suivi-urssaf`, `dater-lbc` (replis
ouverts d'un toucher, `ouvrirDetailCompta` de `_compta.cjs`) ; `audit-suivi-urssaf` accepte `sansTitre`.
⚠️ Non mesuré : sa vraie base ; un vrai iPhone.
- **Rouge sur le code d'avant** : `compta-claire` lancé depuis un `git archive c4f39ac4` (origin/main) ⇒
  **68 rouges** ; vert ici (98). **Mutation** (« Le détail du calcul » ouvert d'office) ⇒ 4 rouges U
  (7,44 € écrit deux fois). Les rouges « … rangé au nuage » de `declare-urssaf`, `statut-fiscal`,
  `suivi-urssaf` (4 à 6 chacun) sont **les mêmes sur origin/main** (le banc ne voit plus l'écriture de
  `main`) : pas de ce lot, à regarder à part. Le contraste du choix des dépenses (E, 4,3:1, rouge sur
  origin/main) est corrigé. Audits verts : `audit-urssaf`, `audit-micro-entreprise`, `audit-finir-compta`,
  `audit-donnees-ecrans`, `audit-suivi-urssaf`, `audit-icones`, `audit-coherence` ; `audit-benefice`,
  `audit-mentions-paiement`, `audit-vendeur-neutre` exigent `@babel/parser`, `audit-rappel-urssaf`
  `web-push` (absents de ce conteneur : leurs autres contrôles sont verts).
- **À décider par Julien** : retirer « Net après paiement » de la carte URSSAF (fait, réversible) ; le nom du
  bouton (« Noter ma déclaration » gardé, plutôt que « J'ai déclaré ») ; « ventes finalisées » gardé (le mot
  de Vinted) ; « Documents et réglages » au lieu d'« Avancé ».

---

## 3 novembre — « Bénéfice » : un nom, une règle, sur tous les écrans

**Constat d'une critique (mêmes données de banc)** : le « bénéfice du mois » valait « — » dans Ma journée,
103 € dans Statistiques et 80,93 € dans Comptabilité. Julien : tout doit être parfait.

**Cause, mesurée (banc `benefice-unique` et `audit-benefice-unique` sur origin/main)** : ce n'était pas une
copie de règle qui divergeait — le propriétaire est bien unique (`vrm_benefice_jours`, publié par l'écran
Ventes ; `beneficePeriode` pour le mois) — mais **trois notions sous le même nom**, plus un « — » en dur :
- Comptabilité « Ton bénéfice » = ventes − prix d'achat − frais − dépenses − URSSAF (`netFinal`), « — » si
  un prix d'achat manque ;
- Statistiques, tuile « Bénéfice » = le BRUT (vente − achat), sans dépenses ni URSSAF, et « au moins » quand
  des prix manquent (faux : une paire au prix inconnu peut être vendue à perte — pas un plancher) ;
- Ma journée « Bénéfice » = `netFinal`, mais glissait au brut partiel (« Bénéfice brut ») quand le net ne se
  calculait pas : Compta « — », Ma journée « 66 € », Stats « au moins 65,90 € » sur le même jeu ;
- le récap comptable mensuel (Documents et réglages) écrivait « — » en dur dans sa colonne « Bénéfice »
  (`profit: null`), et appelait « Net estimé » le CA − URSSAF (sans aucun prix d'achat) ;
- l'écran Ventes appelait « Bénéfice » / « Bénéfice net » le brut et le brut − frais (ni dépenses ni URSSAF) ;
- **défaut de règle** trouvé en route : depuis le 1er nov. une vente Vestiaire au montant sûr entre dans le
  bénéfice, mais `caBeneficeDuMois` ne sommait que Vinted/Leboncoin/eBay : son URSSAF n'était pas déduite.
Sur le jeu de l'audit, origin/main affiche « Ma journée 66,40 € · Statistiques 102,00 € · Comptabilité
66,40 € · récap — » quand l'attendu calculé à la main est 57,72 € — la forme exacte de la critique.

**Fait** :
- `src/beneficeNoms.js` : trois notions, trois noms — « Bénéfice » (ce qu'il te reste, `beneficePeriode`),
  « Bénéfice brut » (vente − achat, couverture « N sur M », jamais « au moins »), « Après frais de vente »
  (brut − boosts et frais). `chiffreBenefice(B, etat)` / `chiffreBrut` / `chiffreApresFrais` donnent la
  valeur affichée et `data-benef-notion` / `data-benef-valeur` / `data-benef-pourquoi`.
- Ma journée : la case dit toujours « Bénéfice » = `chiffreBenefice` (le net ou « — »), la couverture et la
  porte « N prix d'achat › » dessous ; plus de brut glissé sous un libellé qui change.
- Statistiques : Mois et Année = `useBeneficeCalcul` (la lecture de Comptabilité et de Ma journée, mêmes
  charges, même CA déclaré) ; Semaine = « Bénéfice brut » (dépenses et URSSAF se comptent au mois) ; « au
  moins » retiré ; tableau « Bénéfice brut et marge ».
- Comptabilité : inchangée (propriétaire) ; la ligne brute du détail s'appelle « Bénéfice brut ».
- Récap mensuel : colonne « Bénéfice » = `beneficePeriode` du mois (borné à maintenant), « — » seulement si
  pas su (prix manquant, mois plus ancien que la publication) ; « Net estimé » → « CA après URSSAF » ; une
  phrase dit d'où vient le bénéfice.
- Ventes : « Bénéfice brut » et « Après frais de vente » (plus de « Bénéfice » ni « Bénéfice net »).
- `caBeneficeDuMois` : + Vestiaire (les mêmes plateformes des deux côtés).
- « — » = la règle dit « pas su », partout pareil : un prix d'achat manquant, des frais eBay pas lus, le CA
  déclaré pas publié, rien publié.

**Preuves** :
- `scripts/audit-benefice-unique.cjs` (vraies fonctions d'App.jsx dans un vm + le module ; le chemin de
  chaque écran est LU dans son code) : cas tout connu, prix d'achat manquant, frais eBay pas lus, Vestiaire
  sûr / pas sûr, vente à cheval (vendue en octobre, versée en novembre), compte exclu, aucune vente du mois,
  sans dépenses notées. 24 verts ; **15 rouges sur origin/main** (copié dans un `git archive`) ;
  mutations `stats` 5, `journee` 5, `recap` 6, `vestiaire` 3, `aumoins` 1, `ventes` 1 rouges.
- `scripts/bancs/benefice-unique.cjs` (1512 et 390 tactile, données inventées) : même valeur rendue sur
  Ma journée, Statistiques (Mois), Comptabilité et le récap ; même « — » quand un prix manque ; noms des
  autres notions. 38 verts ; **22 rouges sur le build d'origin/main** ; mutation « tuile au brut » ⇒ 4 rouges.
  Captures regardées (tuile « Bénéfice 67,77 € · après prix d'achat, frais, dépenses et URSSAF » ; case
  « Bénéfice — · 2 sur 3 · 1 prix d'achat › »).
- Bancs remis à la règle (en le disant dedans) : `stats-vitrine` (plus de « au moins »), `benefice-brut-net`
  (« Après frais de vente »).
- `audit-benefice` exige `@babel/parser` (absent du conteneur) : lancé avec un bouchon d'analyse hors dépôt
  (déclarations de premier niveau) — 46 verts, mutations duplique/zero/cotis rouges.

**Mesuré chez Julien (lecture seule, 3 nov. matin)** — valeurs dans le rapport de session seulement.

**Noté, pas fait** : dans Statistiques → « L'argent depuis le début », « Bénéfice estimé », « Taux marge » et
« Bénéfice moyen par vente » valent « — » dès que les ventes sont lues (calcul de l'ancien catalogue) ; la
colonne « Bénéfice » par vente de l'écran Ventes est vente − achat − frais (une autre granularité). À
trancher avec Julien. La branche `claude/design-fusion` réécrit les mêmes lignes de Ma journée et de
Comptabilité (« Bénéfice brut du mois » sous la même case) : à la fusion, garder `chiffreBenefice`.
- Tournée des bancs liés (build de cette branche) : `benefice-journee` 62/62, `stats-compta` 58/58,
  `compta-claire` 98/98, `stats-vitrine` 112/112, `emails-stats-clairs` 53/53, `benefice-brut-net` vert (il
  lisait une rangée vide — 4 rouges aussi sur origin/main : « Chiffres de la plateforme » replié au téléphone,
  première `.vrm-summary-strip` qui n'était pas celle du bénéfice ; réparé). `chiffres-croises` : 1 rouge
  (« VENDU du mois » de Statistiques lu sur `[data-dash-stat="caMois"]`, absent depuis la refonte de
  Statistiques) — **le même rouge sur origin/main**, sans lien avec le bénéfice, laissé à part.

---

## 3 novembre (suite) — « Bénéfice du mois −5 € » : l'URSSAF des MÊMES ventes

**Constat (Julien, 09 h 49, capture de Ma journée)** : « Bénéfice du mois −5 € — je ne comprends pas du tout ».
**Cause (défaut de RÈGLE, pas d'affichage)** : `beneficePeriode` sommait les ventes d'un ensemble (vendues et
finalisées dans le mois, publication `vrm_benefice_jours`) mais retirait l'URSSAF d'un AUTRE ensemble (le CA
déclaré du mois, daté au VERSEMENT, `vinted_urssaf_mois`). En novembre : aucune vente comptée, une vente
d'octobre versée le 2 novembre (38 €) ⇒ 0 − 12,4 % × 38 = **−4,71 €** (arrondi « −5 € » dans la case).

**Règle (sa décision, transmise par la session principale)** : dans le bénéfice (notion de gestion), l'URSSAF
retirée = le taux × le montant des MÊMES ventes que celles comptées (`aPayerUrssaf(v.ca, taux)`), la cotisation
attachée à la vente. Aucune vente comptée ET aucune dépense ⇒ « — » (raison `rien`, « rien à calculer »),
jamais 0 ni un négatif ; un négatif n'apparaît que s'il est réel (vente à perte, dépenses). Les dépenses du
mois restent comptées dans leur mois. **Inchangés** : le CA déclaré daté au versement, « Combien je dois
déclarer ? », `vrm_urssaf_declare`, les rappels, « à mettre de côté » de Ma journée, le récap (colonnes CA et
URSSAF). Conséquence : le bénéfice n'attend plus le CA déclaré publié (raison `cotisations` ne sort plus du
calcul ; `caDecl` reste rendu pour la case « à déclarer »).

**Fait** :
- `beneficePeriode` (App.jsx, seule propriétaire) : `cotis = aPayerUrssaf(v.ca, taux)` ; `rien` ⇒ `netFinal`
  null, raison `rien`. Commentaire de règle dans `src/beneficeNoms.js` (`chiffreBenefice` passe `rien` tel quel).
- Phrases : Statistiques « aucune vente finalisée ni dépense sur la période », Ma journée « aucune vente ce
  mois-ci », Comptabilité « Aucune vente finalisée ni dépense sur la période : rien à calculer. ». Détail du
  calcul : « − URSSAF · 12,4 % des mêmes ventes (X €) » ; la note dit que l'URSSAF à payer, datée au versement,
  se lit dans « Combien je dois déclarer ? ». La case « URSSAF » de la carte garde son libellé court (« URSSAF de
  ces ventes » était tronqué à 390 px, capture regardée) avec une infobulle qui le dit.
- Les quatre écrans (Ma journée, Statistiques mois/année, Comptabilité, récap mensuel) passent déjà tous par
  `beneficePeriode` + `chiffreBenefice` : la règle change partout d'un coup.

**Preuves** :
- `audit-benefice-unique` étendu : mois sans vente avec le versement d'une vente d'octobre (« — », raison
  `rien`, jamais négatif, CA déclaré toujours lu — avec et sans « je n'ai pas de dépenses ») ; ventes et
  versements croisés (CA déclaré 225 € / à payer 27,90 € inchangés, URSSAF du bénéfice 8,06 € sur les 65 €
  vendus) ; vente à perte réelle (−33,72 € exactement) ; dépenses seules (−15,00 € exactement, sans URSSAF des
  versements). **47 verts ; 12 rouges sur origin/main** (dont « −4,71 € » reproduit tel quel) ; mutations
  `urssaf-decl` 6 rouges, `rien` 4 rouges, les anciennes toujours rouges.
- `audit-benefice` remis à la règle (cotisations des ventes comptées, CA déclaré pas publié n'arrête plus le
  bénéfice, aucune vente ni dépense ⇒ `rien`) : 48 verts (bouchon d'analyse hors dépôt, `@babel/parser`
  absent) ; mutations duplique/zero/cotis/depenses rouges.
- Bancs : `benefice-unique` 38/38, `benefice-journee` 52/52, `compta-claire` 92/92 ; `stats-compta` 54/58 —
  les 4 mêmes rouges sur le build d'origin/main (« la déclaration URSSAF est dans Compta », « la prochaine
  échéance est dans Compta » : la restructuration de Compta, sans lien avec le bénéfice). `audit-urssaf` et
  `audit-suivi-urssaf` (21) verts.

**Mesuré chez Julien (lecture seule)** — valeurs dans le rapport de session seulement.

---

## 3 novembre (après-midi) — Trois outils de compta choisis par Julien (13 h 02)

### 1. Prix d'achat en un geste (`src/prixAchatPropose.js`)

**Demande** : quand un article (N°) est relié PAR IDENTITÉ à un achat et que son prix d'achat est vide,
VRM propose le montant réellement payé (« Utiliser 42,90 € »), détail sur une ligne ; rien n'est écrit
sans son tap ; jamais par ressemblance de titre ; une action groupée « Valider les N prix proposés »
avec une confirmation qui liste chaque N° et son montant.

**Mesuré avant de coder (lecture seule, sa base, 3 nov.)** :
- fiches `vinted_annonce_numeros` : 505 (toutes numérotées), 8 avec un prix, **5 reliées à un achat
  (`buyFromId`), toutes avec leur prix** (le lien « Relier un achat » écrit déjà le prix de l'article) ;
  corrections de vente `vinted_sale_overrides` : 561, 165 avec un prix, aucune reliée ;
- achats captés : 632 (430 finalisés) ; reçus d'achat (`email_achat_*`) : 172 lignes, 136 avec n° de
  transaction et « Montant payé », 63 reliés à un achat capté ; aucun des 5 achats reliés n'a de reçu ;
- identité par la photo (achat ↔ vente) : **0 au fichier exact** ; 3 au même DOSSIER (« revendre » de
  Vinted), dont les 3 achats sont « Remboursement validé » (ventes entre ses propres comptes) ;
- ⇒ **aujourd'hui, aucune de ses ventes sans prix d'achat n'a un achat relié par identité** : la
  proposition ne s'affichera chez lui que pour un lien futur sans prix lu, ou une revente au même
  fichier photo. Le titre (seule autre piste) est refusé (§2.4). Le gain réel viendrait d'une identité
  NEUVE achat → annonce (à mesurer : l'annonce créée par « revendre » garde-t-elle le fichier ?).

**Fait** :
- La règle, pure (`src/prixAchatPropose.js`) : identité = le lien qu'IL a posé (`buyFromId`), sinon le
  fichier photo EXACT (`photoKey`, jamais `photoDir`) d'UN seul achat ; écartés : deux achats au même
  fichier, l'achat de la même transaction que la vente, un achat remboursé/annulé/échoué, un achat
  postérieur à la vente, un achat déjà relié à un autre article. Montant : le reçu de l'achat (par SON
  n° de transaction) quand sa ventilation tombe juste au centime (« Article 30,00 € · Frais de port
  2,63 € · Frais Vinted 2,00 € »), sinon le prix de l'article (« Article seul ») ; autre devise ⇒ rien.
  Un achat n'est proposé qu'à UN article (ventes les plus récentes d'abord, puis fiches).
- App.jsx (`propositionsPrix`, après `fillBuySugg`) : calcul sans écriture ; `appliquerProposition` =
  la même écriture que « Relier un achat » (prix + `buyFromId` + instantané `buyFrom`, `recu` en plus).
  Branché sur : la ligne de vente et le récapitulatif (`CoutAchatVente propose`, bouton « Utiliser
  X € » + la ligne de détail ; une vente reliée sans prix montre maintenant le geste), la saisie en série
  (« Prix d'achat à compléter », la piste par ressemblance s'efface derrière la proposition par
  identité), et « Valider les N prix proposés » (Ventes et saisie en série, à partir de 2) avec
  `askConfirm` qui liste « N°12 · 34,63 € » par ligne.
- Ventes relit les achats captés (`chargerAchats`, relecture de l'extension seulement) ; les reçus ne
  sont lus que s'il existe au moins une proposition.

**Preuves** : `scripts/audit-prix-achat-propose.cjs` — 27 verts : 50 articles au même titre et 50 achats
au même titre, un seul relié par son n° (posé sur le DERNIER) ⇒ une seule proposition, la sienne ;
photo exacte / dossier / ambiguë / remboursé / postérieur / même transaction / déjà pris ; montant du
reçu juste, reçu faux, autre devise ; un achat un article ; App.jsx : 4 appels d'écriture, tous dans un
`onClick`/`onUtiliser` ou après la confirmation groupée, aucun dans le calcul, `photoKey` seule, aucun
titre lu. **Rouge sur origin/main** (module absent). **Mutations** : `titre` 2 rouges, `sans-tap` 2,
`dossier` 1, `recu` 1, `unique` 1.

### 2. « Récap de [mois] » — PDF et tableur (`src/recapMois.js`)

**Demande** : Compta → Documents → « Récap de [mois] » ⇒ PDF ET tableur : ventes (date, site, N°, titre,
vendu, reçu, frais), CA déclaré daté au versement, URSSAF, dépenses, bénéfice, couverture ; mêmes règles
que l'écran ; logo et entreprise de la fiche de facturation si remplie ; jamais « encaissé ».

**Fait** :
- `src/recapMois.js` MET EN PAGE, ne calcule rien : bénéfice = `chiffreBenefice(beneficePeriode(mois))`
  (la colonne « Bénéfice » du récap mensuel, Ma journée, Statistiques) ; CA déclaré et URSSAF = la ligne
  du mois publiée par Ventes (`vinted_urssaf_mois`) et `aPayerUrssaf` (les cellules du tableau) ;
  dépenses = `lignesChargesMois` (nouvelle, App.jsx : fixes, dépenses et packs du mois, échéances
  d'abonnement — son total EST `comptaChargesMois(...).total`) ; ventes = le relevé de Ventes
  (`vrm_stats_ventes`, les MÊMES ventes que le bénéfice : finalisées, hors masquées, au jour de la vente),
  auquel s'ajoutent `[8]` le N° de la fiche et `[9]` la date de versement lue (Leboncoin/eBay/Vestiaire :
  leur date ; `ventesAutresBenefice` rend désormais `num`). « Pas su » = « — », raison en une ligne
  (« il manque des prix d'achat ») ; couverture « Prix d'achat connus 2/3 » = celle du bénéfice.
- PDF (pdf-lib, Helvetica, A4) : en-tête avec logo/nom/SIRET/adresse de `vrm_pro_facture` si remplie,
  « Récap de novembre 2026 », résumé (libellé · montant, filets), ventes, dépenses, totaux ; caractères
  impossibles retirés, titres longs coupés. Tableur : CSV `;`, BOM, montants « 12,50 ».
- Écran : carte « Récap de [mois] » en tête de `RecapComptableMensuel` (Documents et réglages), choix du
  mois (13 derniers), « PDF » et « Tableur ». L'ancien « Récap comptable mensuel » (tableau + CSV) reste.

**Preuves** : banc `scripts/bancs/recap-mois.cjs` (données inventées, 1512 sombre + 390 tactile, A tous
les prix connus / B un prix manquant) : le PDF lu par pdf.js et le tableur disent le MÊME bénéfice que
« Combien j'ai gagné ? » et la colonne du récap mensuel (52,31 € ; « — » en B), le même CA déclaré et la
même URSSAF que le tableau (149,40 € · 18,53 €), les dépenses du mois de Comptabilité (32,50 €), le nombre
de ventes et la couverture du bénéfice (3 · 3/3, 2/3), jamais « encaissé », une ligne par vente avec site
et titre, les dépenses listées ; aucun débordement, aucune erreur. **88 verts**. Rouge sur origin/main et
sous mutation : voir plus bas.

### 3. Boîte à dépenses — le ticket en photo (`src/depensesTicket.js`)

**Demande** : ajouter une dépense en un geste depuis Compta avec la PHOTO du ticket ; montant/date/catégorie
saisis par lui ; lecture du montant SEULEMENT si gratuite et locale, sinon champ manuel sans paragraphe ;
catégories Emballage, Achats de stock, Envois, Abonnements, Autre ; les dépenses entrent dans le bénéfice
par la règle existante (dans leur mois).

**Fait** :
- Le formulaire « Ajouter une dépense » (Tes dépenses, ouvert aussi par le geste de « Combien j'ai
  gagné ? ») commence par « Photo du ticket » (`capture="environment"` : l'appareil photo au téléphone),
  aperçu, « Changer la photo », « Retirer ». Photo réduite dans le navigateur (1100 px, JPEG 0,7).
- Lecture du montant DANS la page, gratuite : `TextDetector` du navigateur s'il existe, sinon Tesseract
  5.1.1 en WASM chargé de cdn.jsdelivr.net (déjà autorisé par la CSP : script, connect, wasm) avec ses
  chemins explicites (worker, cœur, langue `fra`) ; borné à 45 s ; tout échec ⇒ champ vide, sans un mot.
  `montantDuTicket` ne prend qu'un TOTAL écrit (net à payer, total TTC, total, CB), jamais le sous-total,
  le HT, la TVA, le rendu ; sans mot de total ⇒ rien. Le montant n'est que PRÉ-REMPLI : « Ajouter » écrit.
- La photo a SA ligne `depense_ticket_{id}` (comme `achat_hors_photo_{id}`, jamais `main` ni
  `vrm_compta`) ; la dépense porte `ticket:true` seulement si la base a accepté la photo, sinon elle est
  gardée sans photo et c'est dit. La ligne de la dépense a un bouton appareil photo qui relit le ticket
  (une lecture, à la demande) et l'affiche ; supprimer la dépense vide la ligne du ticket.
- Catégories = `CATEGORIES_DEPENSE` (exemples sous le champ). Libellé facultatif quand il y a une photo
  (la catégorie le remplace).
- ⚠️ **À trancher par Julien** : « Achats de stock » en DÉPENSE compte deux fois si la paire porte aussi
  son prix d'achat (le bénéfice retire le prix d'achat des ventes ET les dépenses du mois). Gardé tel que
  demandé ; à dire à Julien.
- ⚠️ Non vérifié ici : le chargement réel de Tesseract depuis jsdelivr (le conteneur n'y a pas accès) ;
  à essayer sur l'iPhone (Safari n'a pas `TextDetector` : c'est Tesseract qui lira).

**Preuves** : banc `scripts/bancs/depense-ticket.cjs` (1512 sombre + 390 tactile ; détecteur simulé qui lit
« SOUS-TOTAL 10,42 / TVA 2,08 / TOTAL TTC 12,50 / CB 12,50 », puis aucun détecteur et jsdelivr coupé) :
catégories de Julien, champ pré-rempli à 12,50 (pas 10,42), rien écrit avant « Ajouter », dépense
« Envois » 12,50 € `ticket:true`, image seulement dans `depense_ticket_{id}`, bénéfice du mois de
Comptabilité −12,50 € exactement, bouton du ticket qui rouvre la photo, sans lecture : champ vide et aucun
message, cibles ≥ 44 px. `scripts/audit-depense-ticket.cjs` (10 verts ; mutations `plus-grand` et `ht`
rouges). Le banc `stats-compta` est remis aux catégories de Julien (« Envois » au lieu de « Transport »,
la pastille « Abonnements » n'est plus refusée), en le disant dedans.

### Preuves communes (3 nov., après `git merge origin/main`)
- **Rouge sur origin/main** (arbres `git archive`, bancs copiés dedans) : `recap-mois` 12 rouges / 0 vert,
  `depense-ticket` 12 rouges / 0 vert, `audit-prix-achat-propose` rouge (module absent).
- **Mutations** : récap au bénéfice recalculé à part (vendu − achat − frais) ⇒ `recap-mois` 12 rouges ;
  photo du ticket jamais envoyée ⇒ `depense-ticket` 16 rouges ; `audit-prix-achat-propose` `titre` 2,
  `sans-tap` 2, `dossier` 1, `recu` 1, `unique` 1 ; `audit-depense-ticket` `plus-grand` 1, `ht` 1.
- Verts sur cette branche : `recap-mois` 88, `depense-ticket` 56, `compta-claire` 92, `benefice-unique`
  38, `audit-benefice-unique` 47, `audit-carte-chiffres` 203, `audit-icones`, `audit-urssaf`,
  `audit-fonctions-api`, `audit-coherence`. `stats-compta` 54/58 : les 4 mêmes rouges que sur origin/main
  (« la déclaration URSSAF est dans Compta », « la prochaine échéance ») — sans lien, laissés.
- Captures regardées : carte « Récap de novembre 2026 » (390), formulaire avec la photo et 12,50 pré-rempli
  (390), PDF d'essai (données inventées) sobre, une page.

## 3 novembre (après-midi) — Suggestions d'achat à relier, et « Exporter mes données » (branche `claude/double-vente-export`)

### Suggestions pour relier une annonce / une vente à un achat (`src/suggestionsAchat.js`)
Julien (14 h 12-14 h 14) a REMPLACÉ la « fiche prête à l'arrivée d'un achat » (abandonnée, rien n'a été
fait) par : « je veux juste les SUGGESTIONS » ; « ne prends pas en compte la photo, mais la couleur, la
taille et la marque » ; « on doit pouvoir relier à TOUS les achats non reliés, si ce n'est pas des lots ».
- Tout « Relier un achat » (ligne de vente, récap, fiche d'annonce) ouvre la même feuille, désormais en
  PORTAIL : 1 à 3 suggestions (photo, titre, date, prix payé, compte, « Relier »), puis « Voir tous les
  achats » (recherche titre / marque / n° de transaction, filtres compte et mois).
- Règle : marque obligatoire ; taille obligatoire, connue des deux côtés, normalisée d'écriture
  (« 42,5 » = « 42.5 » = « 42½ », « 42 2/3 » ≠ « 42,5 ») ; couleur (règle de l'app `extractColors`) :
  différente ⇒ écartée, commune ⇒ rang 1, inconnue ⇒ rang 2 ; deux MODÈLES connus et différents ⇒ écartée
  (§5 — mesuré : « spezial » se voyait proposer « samba ») ; achat antérieur à la mise en ligne / vente ;
  pas déjà relié ; pas remboursé (`ACHAT_SANS_COUT`). Rien ne passe ⇒ rien n'est affiché.
- LOTS — forme mesurée (734 achats) : aucun champ de nombre d'articles ; le titre le dit (« Lot 3 articles »
  ×34, « Lot de 2 paires … », 8 « Lot … » sans nombre). Un lot reste proposable jusqu'à son nombre ;
  « lot · 2/3 reliés » ; relier un lot DEMANDE le prix de cet article (champ vide ; « 90 € ÷ 3 ≈ 30 € »
  en indication seulement). Un achat simple : l'écriture de « Relier un achat », prix du reçu
  (`prixAchatPropose`) s'il tombe juste.
- Mesuré (lecture seule, approximation SQL de la règle) : 988 fiches sans achat relié ⇒ **266** auraient
  au moins une suggestion (20 avec marque + taille + couleur), 3,6 candidats en moyenne ; 234 n'ont ni
  marque ni taille lisibles (rien proposé).
- Preuves : `audit-suggestions-achat.cjs` 34 verts (50 articles + 50 achats identiques : aucun lien sans
  tap ; marque / taille / couleur / modèle / postérieur / relié / remboursé écartés ; lots ; recherche et
  filtres) ; `--prouve` 9/9 mutations (dont « marque ignorée ») ; rouge sur main (module absent). Banc
  `relier-achat-suggestions` 390 tactile + 1512 sombre : 28 verts (une seule suggestion juste, portail,
  liste sans l'achat relié, « lot · 0/3 reliés », prix de lot demandé champ vide, annuler n'écrit rien,
  « Relier » relie, 44 px) ; rouge sur main.

### Paramètres → « Exporter mes données » (`src/exportDonnees.js`)
Un zip téléchargé sur l'appareil (rien envoyé ailleurs), 7 tableaux CSV (« ; », virgule décimale, BOM) :
ventes (le relevé de Ventes `vrm_stats_ventes`, toutes plateformes), achats captés (lus PAGINÉS par
`lireTout`, projetés `data->payload->my_orders`, N° relié), stock / N° (fiches), dépenses (`vrm_compta`),
URSSAF par mois (ligne publiée `vinted_urssaf_mois`, à payer par `aPayerUrssaf`), déclarations
(`vrm_urssaf_declare`), factures Pro (métadonnées `email_invoice_*` projetées, jamais le PDF). Aucune
bibliothèque xlsx ni zip dans le dépôt : zip « stored » écrit à la main, CRC-32. Source ratée ⇒ « — ».
Preuves : `audit-export-donnees.cjs` 19 verts (chaque mois = `donneesRecapMois`, URSSAF = ligne publiée,
zip relu + `unzip -t`, aucune écriture, jamais `select=data`) ; `--prouve` 5/5 ; banc `export-donnees`
390 + 1512 sombre 14 verts (zip téléchargé, 7 tableaux, aucune requête d'écriture).
Reste : les achats hors plateforme (saisis à la main) ne sont pas dans le tableau « achats ».


### « Boost rentable ? » refait — une seule carte (Statistiques, 3 novembre)
Choisie par Julien parmi trois améliorations ; remplace la règle du 21 octobre (ci-dessus).
- **Doublon retiré** : il y avait DEUX cartes (« Boost rentable ? » en tête, StatsVitrine, et
  `BoostRentable` « Le boost est-il rentable ? » dans le volet replié « Ce qui se vend »). Il
  n'en reste qu'une, en tête, qui suit la période choisie ; le composant `BoostRentable` est
  supprimé.
- **Mesuré (lecture seule, 3 nov.)** : « Boost payé » (`vinted_annonce_numeros[id].fees`)
  saisi sur 0 fiche sur 1 005 (trois comptes VRM) ⇒ aujourd'hui « Pas assez de données ».
- **Règle** (`src/boostRentable.js`, pure) : la population = les ANNONCES (vendues ou non)
  mises en ligne dans la période ; boostée = montant saisi OU `promoted === true` ; non
  boostée = `promoted === false` sans montant ; absent = « pas su » (compté à part) ; modèle =
  `modeleSur` (src/ceQuiRapporte.js, marque + modèle sûrs ; `title` ajouté à l'index des
  annonces de `lireExtrasRepartition`) ; on ne compare que les modèles présents des deux
  côtés ; vendue = vente non annulée, compte non écarté, reliée par SA transaction (jamais le
  titre). Moins de 3 boostées comparables ⇒ « Pas assez de données · n/3 boostés », aucun
  chiffre. Sinon : vendus (n/N · %), délai médian, prix médian BOOST DÉDUIT (une boostée sans
  montant n'y entre pas), coût = somme des montants saisis, « montant saisi a/b » (« au
  moins » s'il en manque). Aucune couleur de jugement ; un repère, dans aucun total.
- **Preuves** : `audit-boost-rentable.cjs` réécrit (jeu calculé à la main : 4 Dunk boostées /
  3 non boostées, vendus 3/4 contre 1/3, délai 5 j contre 20 j, prix 62,50 € contre 50 €, coût
  5 € 2/4 ; < 3 ⇒ rien ; lecture ratée ⇒ pas su ; une seule carte) — 13 rouges sur
  origin/main, `--prouve` 11/11 mutations ; banc `bancs/boost-rentable.cjs` réécrit (1512
  clair, 1512 et 390 sombres) 48 contrôles, 24 rouges sur le build de main ; banc
  `stats-vitrine` mis à jour (son jeu n'a pas de modèle commun des deux côtés ⇒ « Pas assez de
  données »), 112 verts.
- Geste de Julien : saisir le boost payé dans la fiche des articles qu'il booste.

> **3–4 novembre — SEUILS DE L'ANNÉE (« vers quel mois », DAC7 par plateforme) et PRÉVISION URSSAF** (branche `claude/seuils-notes`) :
> Mesuré avant : la jauge TVA/plafond existait déjà (`jaugeSeuils`, 29 oct.) avec une projection « tu finirais l'année vers X € »
> (jour par jour, mois en cours compris) ; DAC7 n'existait que pour Vinted compte par compte (Registre annuel). Seuils non
> re-vérifiés : ceux de l'historique (203 100 · 85 000 · 93 500 vérifiés le 29 oct. ; DAC7 30 ventes ou plus de 2 000 €).
> **1. `src/seuilsAnnee.js`** (réutilise `caAnnee`/`seuilsDe`, ne recalcule rien ; la ligne publiée `vinted_urssaf_mois`) :
> `moisAtteinte` = projection LINÉAIRE sur les mois FINIS portant des données (du premier mois publié de l'année au mois
> d'avant), mois en cours exclu ; `null` (rien d'affiché) si total partiel (plateforme pas lue, ventes à dater, argent illisible),
> moins de 2 mois finis, seuil déjà dépassé, rythme nul ; `mois: null` = pas atteint cette année. Remplace la phrase « tu
> finirais l'année vers X € » (deux estimations auraient pu se contredire). Écran : « TVA vers novembre · estimation » sous les
> jauges. `dac7ParPlateforme` : par plateforme (tous comptes sélectionnés ensemble), `passu` ⇒ « — », centimes (2 000,00 € pile
> ne l'atteint pas), « atteint si N à dater », jamais « sous » quand des ventes manquent (« au moins »), reste « encore N ventes
> ou X € » ; mêmes seuils que `SEUIL_VINTED_*` de l'app (l'audit l'exige). Carte `Dac7Plateformes` dans « Tes seuils », sans ambre.
> ⚠️ Avec Vestiaire « pas lu » (cas fréquent), le CA est partiel ⇒ la projection se tait : c'est voulu.
> **2. `src/previsionUrssaf.js`** : les règles d'argent sont PASSÉES (`nextUrssafDeadline`, `moisPeriodeUrssaf`,
> `montantPeriodeUrssaf`, `moisDeclare` de l'app ; l'audit passe celles d'api/_lib/urssaf-regle.js, jugées identiques par
> audit-rappel-urssaf). Ajoute : statut pas choisi ⇒ « — » + « Choisir mon statut » ; rythme jamais choisi
> (`vinted_urssaf_freq` absent) ⇒ « — » + Par mois / Par trimestre (jamais « trimestriel » deviné ; mesuré : sa base a
> `mensuel`, 5 vendeurs sur 7 n'ont ni statut ni rythme) ; registre pas lu ⇒ rien ; échéance toute notée ⇒ la suivante ;
> mois de la période déjà déclaré retiré avant le calcul (trimestre à moitié noté) ; « au moins » + « N à dater ».
> ⚠️ Constaté : la carte « Prochaine déclaration » (`CarteUrssafMois`, `[data-stats-carte="mois"]`) est MASQUÉE par la Fusion
> (fusion.css §15) — la prévision vit donc dans `PrevisionUrssafCarte`, en tête de « Combien je dois déclarer ? »
> (`vrm-fu-declaration is-calme`) ; `CarteUrssafMois` porte aussi la prévision (même règle) pour le jour où elle revient.
> **Preuves** : `audit-seuils-annee` 20 (8 mutations rouges : partiel-projete, un-mois, mois-en-cours, dac7-egal, dac7-ou,
> passu-zero, sous-partiel, seuil-depasse) ; `audit-prevision-urssaf` 11 (5 mutations rouges) ; banc `seuils-prevision` 32 verts
> (390 tactile/1512, captures claires et sombres regardées), 20 rouges sur origin/main. ⚠️ Banc : `main` s'écrit par PATCH
> conditionnel — `suivi-urssaf.cjs` ne capte que les POST, d'où ses 6 rouges « rangé au nuage », identiques sur origin/main
> (pas de cette branche ; à corriger dans ce banc). Geste de Julien : regarder Comptabilité (la prévision en tête de « Combien je
> dois déclarer ? », « Ta micro-entreprise » → « Tes seuils »).

## 3-4 nov. — Les deux registres (livre des recettes, registre des achats) et le bénéfice de Statistiques

**Demande** (Julien, chantiers choisis) : les deux registres obligatoires d'une micro-entreprise
d'achat-revente, en PDF et tableur, depuis Comptabilité ; et les cellules « Bénéfice estimé /
marge » de Statistiques alignées sur LA règle du bénéfice.

**Mesuré d'abord (lecture seule, sa base)** : 734 achats Vinted captés (`harvest_*_orders_purchased`,
`price` = objet `{amount, currency_code}`, tous en EUR ; 521 « Transaction finalisée », 185
« Remboursement … », le reste en cours) ; 5 fiches seulement reliées à un achat (`buyFromId`),
8 avec un prix saisi sur la fiche ; aucune dépense dans `vrm_compta.depenses` ; aucun `vc_achats` ;
les achats hors plateforme (`vinted_offvinted_buys`) ne vivent que sur l'appareil (pas dans `main`).

**Ce qui a été fait**
- `src/registres.js` (règle pure) : `livreDesRecettes` RANGE les lignes de `ventesDeclarables`
  (aucune règle de vente refaite) : période = le mois que la règle donne (`l.ym`, versement pour
  Vinted/Vestiaire, vente pour Leboncoin, commande pour eBay) ; « à dater » listées à part, jamais
  dans un total ; montant illisible ⇒ ligne SANS montant (total « au moins ») ; N° et compte par
  identité (relevé `vrm_stats_ventes`, `compteDeVente`). Les déclarations « J'ai déclaré » ne
  déplacent PAS une recette (le livre suit la date réelle du versement, comme Factur-X).
  `registreDesAchats` : achats Vinted hors annulés/remboursés (`achatAnnule`, la règle de
  « Dépensé », désormais partagée avec l'écran Achats) + achats hors plateforme ; montant = reçu
  juste (`montantPropose`) › prix saisis sur les fiches reliées PAR SON CLIC (toutes) › « article
  seul » (prix Vinted sans port ni frais ⇒ « au moins ») › sans montant (autre devise) ; N° relié =
  `buyFromId` seulement. PDF (A4 italienne) et tableur depuis la même mise en page.
- **Décision : les dépenses ne sont PAS des achats de marchandise** — la boîte à dépenses
  (emballage, envois, abonnements) reste hors du registre des achats ; la catégorie « Achats de
  stock » avait été retirée le 3 nov. pour ne pas retirer deux fois le prix d'achat.
- App : `declarablesCompta` (pure) + `useDeclarablesCompta` — la lecture des ventes déclarables de
  Factur-X, désormais partagée avec la carte `RegistresCarte` (Comptabilité → Documents et
  réglages, sous le récap du mois) : un sélecteur de période (année, année d'avant, 13 mois), deux
  rangées (nombre · total, « au moins » si partiel), PDF et Tableur. Aucune phrase d'explication.
- Statistiques → « L'argent depuis le début » (`Dashboard`) : « Bénéfice estimé » (vieux catalogue,
  « — » dès que Vinted était lu) ⇒ « Bénéfice » de l'ANNÉE par `useBeneficeCalcul(…, 'annee')` +
  `chiffreBenefice` ; « Taux marge » ⇒ « Marge » = ce bénéfice ÷ les ventes qu'il compte ;
  « Bénéfice moyen par vente » idem ; « Meilleur jour bénéfice » et les récaps semaine/mois du
  catalogue (vente − achat) disent « bénéfice brut » ; la porte « prix d'achat » n'apparaît que si
  la règle dit `achats`.

**Preuves**
- `scripts/audit-registres.cjs` EXÉCUTE `declarablesCompta → ventesDeclarables` (vm) et le module :
  46 verts ; rouge sur origin/main ; 10/10 mutations rouges (date de vente au lieu du versement,
  compte exclu compté, « à dater » glissé dans la période, sans montant → 0, total toujours
  « complet », remboursé compté, « article seul » complet, reçu ignoré, compte exclu des achats,
  lot à moitié saisi présenté « saisi »). Le PDF est relu par pdf.js.
- Banc `scripts/bancs/registres.cjs` : 84 verts (1512/390, clair/sombre : écran = tableur = PDF,
  ventes VERSÉES de la période, « au moins » sur les achats « article seul », cibles 44 px) ;
  rouge sur le build de main (pas de carte). Captures regardées (boutons regroupés au téléphone
  après la première capture).
- `audit-benefice-unique` étendu (56 verts ; 6 rouges sur main : la cellule disait « — » quand la
  règle donnait −7,28 € / −33,72 € ; mutations `tableau`, `marge`, `libelle` rouges) ; banc
  `benefice-unique` cas D (50 verts ; rouge sur le build de main : « Bénéfice estimé — » contre
  « −84,16 € » pour l'année). Captures regardées.

**Reste** : la date d'un achat Vinted est le champ `date` de `my_orders` (non vérifié qu'il soit
celui du paiement plutôt que du dernier changement d'état) ; un achat fait d'un de ses comptes à un
autre apparaît des deux côtés (recette et achat) ; les achats Vestiaire/Leboncoin/eBay ne sont pas
captés ; les achats hors plateforme ne sont lus que sur l'appareil où ils ont été saisis.
**Geste de Julien** : Comptabilité → Documents et réglages → Registres : choisir 2026, télécharger
les deux PDF et les relire ; relier ses achats aux N° (ou compléter les reçus) pour sortir du
« au moins ».

## 4 nov. — Achats : Fournisseurs · Délai de mise en ligne · Lots répartis (branche `claude/achats-sourcing`)

Trois outils choisis par Julien, sous la carte de l'écran **Achats** (trois entrées sobres « Fournisseurs ·
Délai · Lots », chacune ouvre une feuille, portail + `FermeAuRetour`, Échap ferme). Règles pures :
`src/achatsSourcing.js` ; écran : `src/AchatsOutils.jsx`, `src/styles-achats-outils.css` (jetons Fusion,
réutilise `.vrm-ao-*`). Aucune écriture en base pendant le travail, aucune donnée réelle dans le dépôt.

**Mesuré en base (lecture seule, 4 nov.)** — `my_orders` achetés : clés `title, price, status,
conversation_id, transaction_user_status, date, transaction_id` (734), `photo` (359), `photo_url` (4) ;
**aucun vendeur, aucun nombre d'articles**. Le pseudo du vendeur n'existe que dans la transaction
(`harvest_{uid}_txn_{tx}` → `payload.transaction.seller.login`, `user_side`, `items_count`,
`shipment.status` / `status_updated_at`) : 42 transactions côté acheteur captées, **37 des 728 achats**
distincts ont un pseudo lisible (transaction ou conversation) ; 2 portent `items_count` 2. « Commande
livrée ! » = `shipment.status` 400 (29 achats) : c'est la date de réception LUE. 4 transactions d'achat
sont lues côté vendeur (achats entre ses propres comptes) : leur pseudo n'est pas pris (`user_side` doit
être `buyer`).

1. **Fournisseurs** — un fournisseur = le pseudo lu dans SA transaction, sinon « Vinted » (jamais
   deviné) ; hors plateforme = la source qu'il a saisie (casse ignorée). Par fournisseur : achats,
   Dépensé (prix de la COMMANDE, remboursés/annulés dehors, autre devise comptée « prix illisible »),
   « reliés N/M » (achats avec au moins un article relié par `buyFromId`, ou par le N° d'un achat hors
   plateforme s'il n'en désigne qu'un), revendus (ventes finalisées reliées), bénéfice = somme des
   bénéfices CONNUS (Vinted : `beneficeLigneVente` ; Leboncoin/eBay/Vestiaire : `ventesAutresBenefice`,
   une commande eBay à plusieurs N° n'est pas attribuée), « au plus » gardé, « — » si aucun ; « k/n »
   à côté quand une partie seulement est connue. Couverture en tête : « Pseudo lu N/M » (achats Vinted non remboursés). Triable
   (Dépensé · Achats · Revendus · Bénéfice · Nom ; un « — » va en dernier). Le pseudo reste EN MÉMOIRE
   (`infosTxAchats`, lu en scalaires avec la photo de la transaction, Achats seulement) : rien n'est
   rangé, exporté ni écrit.
2. **Délai achat → mise en ligne** — réception = « Commande livrée » (400) de SA transaction, sinon
   « Récupéré » touché par lui (`vinted_pickup_done[tx]`) ; jamais la date de l'achat. Mise en ligne = la
   PREMIÈRE date connue des articles reliés (`dateMiseEnLigneMs` : `created_at_ts` de l'annonce, sinon
   `vinted_listing_dates`). Jours entiers, médiane par mois de réception. Exclus et comptés à part : sans
   date de réception, sans date de mise en ligne, en ligne AVANT réception. « Reçus, pas encore en
   ligne » : reçu (date lue ou Vinted « finalisé »), aucun article relié en ligne (Vinted présent, ou
   publié ailleurs via `vinted_nums_physiques.autres`) ni vendu ; un article à l'état pas su ⇒ pas listé ;
   annonces pas lues sur un compte ⇒ la liste vaut « — ». Gestes : « Relier » (liste des N° sans achat
   relié, ni N° d'un achat hors plateforme ; son tap pose `buyFromId` + instantané, et le prix proposé
   — reçu juste sinon l'article — seulement si la fiche n'a pas déjà SON prix) ; « Mettre en ligne »
   (vinted.fr/items/new) ; le N° ouvre la fiche.
3. **Lots répartis** — un lot = titre « Lot … », `items_count` > 1 dans SA transaction, ou déclaré
   par lui (« Ajouter un lot », `vrm_lots_declares`, synchronisé). « Répartir » : un montant par N°
   relié, préremplissage = PROPOSITION de parts égales au centime (jamais écrite), « Article » ou
   « Payé » (port/frais inclus, seulement si le reçu tombe juste) ; somme ≠ total ⇒ « Reste X € » en
   ambre et Enregistrer grisé ; Enregistrer ⇒ confirmation qui liste N° et montants ⇒ `buyPrice` de
   chaque fiche (ou correction de vente) + `buyFrom.lot/prixLot/inclus` ; le journal garde l'état
   d'AVANT (`vrm_repartitions_lots`, synchronisé) ⇒ « Annuler la répartition » le rend. « Relier un N° »
   depuis la feuille. Le lot n'est compté qu'une fois : Dépensé / « Dépensé du mois » / Fournisseurs
   lisent la commande ; le registre des achats (`src/registres.js`) en fait UNE ligne (reçu juste, sinon
   la somme des N° saisis = le total réparti). **`prixAchatPropose` ne propose plus jamais le prix ENTIER
   d'un lot à un de ses articles** (`estLot`, nouveau paramètre ; avant : un N° relié à un « Lot 3
   articles » de 60 € se voyait proposer 60 €) ; « Relier un achat » demande le prix d'un article de lot
   aussi pour un lot lu dans la transaction ou déclaré.

**Preuves** : `scripts/audit-achats-sourcing.cjs` — 46 contrôles qui EXÉCUTENT les règles (50 achats et
50 ventes au même titre : aucun relié ; lot 100 € réparti sur 5 : une ligne de 100 € au registre ;
réception jamais devinée ; rien sans `confirme`…), **19/19 mutations attrapées** (`--prouve` : lien par
titre, relié par titre, double compte du lot, pas su compté 0, pseudo deviné, remboursé compté,
réception devinée, exclus silencieux, en ligne pas su = non, liste sans lecture, écriture sans clic,
somme fausse acceptée, parts égales imposées, annulation perdue, port sans reçu, prix entier d'un lot,
prix saisi écrasé, proposition du prix entier d'un lot). Sur `origin/main` : 0/1 (module absent) et,
module copié, P1-P2 rouges (prixAchatPropose proposait le lot entier). Banc `scripts/bancs/achats-sourcing.cjs`
— **120 contrôles**, 390 tactile clair/sombre et 1512 clair/sombre, scénario inventé servi par
`_minipgrest` (projections réelles) ; 0/4 sur `origin/main`. Captures regardées (`z-aso-*.png`).
`fusion-echelle --verifier` vert.

**Reste** : le pseudo n'est lu que pour ~5 % des achats (transactions captées) — le reste est « Vinted »
tant que l'extension n'a pas lu leur transaction ; la date de mise en ligne d'un article VENDU n'est
souvent pas connue (annonce plus en ligne) ⇒ exclu et compté ; Vestiaire/Leboncoin ne comptent pas
dans « en ligne ailleurs » pour Vestiaire (pas publié dans `vinted_nums_physiques`) ; achats
Leboncoin/Vestiaire hors du tableau des fournisseurs (comme « Dépensé »).
**Geste de Julien** : Achats → « Lots » → « Répartir » sur un lot ; Achats → « Délai » → « Relier » ses
reçus pas encore en ligne.

## 4 novembre — Compta → « Porte-monnaie » : le solde LU de chaque compte Vinted (`claude/ext-5319`)

### Mesuré (lecture seule, 4 nov.)
- `harvest_{uid}_billing` : 11 lignes ; deux formes — `{ main, escrow }` (la page porte-monnaie, 9 comptes) et
  `{ balance, pending_balance, invoice_lines, history, previous_balance… }` (`/users/{pid}/payouts`, lu par
  l'extension à CHAQUE visite, 2 comptes) ; une ligne vide (compte supprimé). La dernière réponse gagne (une ligne
  par compte) : les deux formes portent disponible ET en attente.
- `harvest_*_releve_*` : AUCUNE ligne (le relevé n'est rangé que si `invoice_lines` n'est pas vide) ; une seule ligne
  `payout` vue (août, dans le `billing` d'un compte). ⚠️ Constat : une ligne `harvest_{uid}_wreq_api_v2_users_id_payouts`
  du 13 oct. garde le corps d'un virement EN CLAIR (`bank_account_id`) — les plus récentes sont masquées
  (« [retiré : donnée personnelle ou bancaire] ») ; à purger (geste SQL de Julien, `DELETE` confirmé).
- ⇒ Aucune requête ajoutée par l'extension : tout est déjà lu.

### Fait
- `src/porteMonnaie.js` (règle PURE) : disponible = `main` sinon `balance`, en attente = `escrow` sinon
  `pending_balance` (jamais mélangés) ; un compte jamais lu ⇒ « — » (jamais 0, jamais déduit des ventes) ; lecture
  > 24 h ⇒ « à confirmer » ; total des comptes SÉLECTIONNÉS lus, « au moins » s'il en manque (nommés) ; un compte écarté
  (`vinted_accounts_hidden` / panneau) nommé « Hors total » ; virements = lignes `payout` du relevé et du mois courant
  (montant positif, « en cours » si `pending`).
- `src/PorteMonnaie.jsx` + `PorteMonnaieCompta` (App) : repli « Porte-monnaie » dans « Le détail », lectures PROJETÉES
  (jamais `select=data`).
- Preuves : `scripts/audit-argent-offres-masquees.cjs` (partie P ; 13/13 mutations tuées dont « solde deviné »,
  « formes mélangées », « écarté compté »), banc `argent-offres-masquees` (Compta, 390/1512, clair/sombre).

## 4 novembre — Annonces → « Masquées » (masquées par Vinted, par compte)
- `src/annoncesMasquees.js` + `src/AnnoncesMasquees.jsx` : vue rapide « Masquées N » dans Annonces · Vinted, la liste
  par compte (photo, N°, titre, prix, « Corriger ↗ » vers `/items/{id}/edit`), lecture > 24 h ⇒ « à confirmer ». Entrée
  = `masqueesSurEtagere` filtrée comme la grille (une déclarée partie n'y est pas). `<masquees-regle>` et
  `<enligne-regle>` inchangées (une masquée reste parmi les PRÉSENTES, jamais « en ligne »).
- Carte sombre : chiffre « Annonces masquées » au catalogue (`masquees`, `liveStats.annMasquees`, lectures < 24 h ;
  « au moins » sinon), proposé dans « Modifier », pas dans le défaut.

---

## 4 novembre — L'argent à venir, comparer deux mois, les frais par site (branche `claude/argent-mois`)

Trois outils choisis par Julien (le quatrième, le journal de la semaine, est dans l'historique
interface-stock). Une règle pure par outil, un audit qui l'EXÉCUTE, un banc qui la rend.

### 1. « À venir » — ce que les sites te doivent encore (`src/argentAVenir.js`)

**Une seule règle, qui remplace « l'argent en attente »** (Vinted seul, calculé à trois endroits :
la somme des statuts « en cours » de la LISTE des ventes dans Ma journée et Ventes, le solde bloqué
du porte-monnaie dans la carte des chiffres, le résumé Vinted et le widget).
**Mesuré (lecture seule, 4 nov.)** : sur un compte, 3 ventes que la liste dit encore « colis déposé
en bureau de Poste » ont une TRANSACTION finalisée (450, argent versé) — 220 € de trop dans
« en attente » (448 € affichés pour 228 € réellement retenus par Vinted). En écartant les 450 et
les ventes à date de versement lue, la somme par compte tombe sur le solde bloqué lu chez Vinted à
l'euro près, sur chaque compte dont le porte-monnaie a été lu après les ventes ; les écarts
restants sont des ventes plus récentes que la lecture du porte-monnaie. Le porte-monnaie ne sert
donc plus de total (il retarde et ne dit pas QUELLE vente) ; « À virer » (le disponible) reste.
- **Vinted** : statut ni annulé ni finalisé (`classifyOrderStatus`), transaction ni 450, ni 220,
  ni ≥ 430 (suspendue, retour, annulée — `TXN_ETATS`), pas de date de versement (450,
  `fetchVersementsVinted`, désormais lue aussi par la coque). Aucune date prévue.
  Dates de versement pas lues ⇒ Vinted NOMMÉ, aucune vente Vinted comptée (un versé ne passe
  jamais pour « à venir »).
- **Leboncoin** : vente prouvée, ni annulée ni finalisée (`lbcAnnulee`, `lbcFinalisee`).
- **eBay** : seulement un paiement RETENU par eBay (`paymentSummary.payments[].paymentHolds`,
  état pas « libéré »), au montant retenu, daté par `expectedReleaseDate` quand eBay l'écrit.
  ⚠️ Aucune commande eBay en base chez lui le 4 nov. (`ebay_orders` vide) : forme prise dans la
  documentation de l'API Fulfillment, pas mesurée. Le CA eBay reste daté à la création de la
  commande (règle existante) : une commande retenue est donc à la fois dans le « reçu » d'eBay et
  dans « à venir » — à trancher si eBay vend vraiment.
- **Vestiaire** : ni annulée, ni versée, ni terminée, ni `etapesVc.sellerPayment = done`, au
  montant reçu SÛR ; date = « paiement estimé » ÉCRIT par Vestiaire (`paiementEstime`, mesuré :
  « 24 novembre 2026 »), dite « vers le 24 nov. ».
- Trois états : source pas lue ⇒ en cours ; lecture ratée ⇒ nommée, « au moins » ; montant
  illisible ⇒ nommé, jamais 0 €.
- **Où** : calculée UNE fois dans la coque (`liveStats.aVenir`, `aVenirCoque`) ; consommée par
  Ventes (carte « À venir » en tête : Vinted = sa part, « Tous » = toutes plateformes, une ligne
  par site et compte), Ma journée (case « À venir » et tendance), le résumé Vinted, la carte des
  chiffres (`attente`, devenu « Argent à venir », tous les sites, par compte Vinted) et le widget
  (seulement complète). La case « En attente » de la rangée des totaux de Ventes (statuts « en
  cours » de la période) est retirée.
- Preuves : `audit-argent-a-venir` (51 verts ; 12 rouges sur origin/main, dont « l'en attente de
  Ma journée compte 384,5 € » au lieu de 140,50 € sur le jeu ; mutations tx450 9, versement 6,
  holds 2, libere 4, vcverse 5, zero 1, site 4 rouges) ; `audit-carte-chiffres` remis à la règle
  (210 verts).

### 2. « Comparer » — deux mois (Statistiques, `src/comparerMois.js`)

Ce mois face au mois d'avant ou au même mois l'an dernier (`Segmente`, choix gardé sur l'appareil).
Ventes et CA vendu = lignes de `ventesFaites` + `bilanLignes` ; reçu = la ligne publiée
`vinted_urssaf_mois` (`recuPublieEntre`, même fraîcheur de 3 jours, mêmes sources nommées) ;
bénéfice = `beneficeDuMoisPub` (la lecture du récap mensuel, sortie en fonction, `beneficePeriode`
+ `chiffreBenefice`). **Un mois en cours se compare AU MÊME POINT** (la règle de Statistiques :
« un mois commencé ne se compare pas à un mois entier ») : du 1er à maintenant face au 1er → même
quantième, même heure. Pour cela : `beneficePeriode` reçoit `jusqua` (les ventes s'arrêtent au
jour de la coupe inclus, les dépenses restent celles du mois ; absent = inchangé) et Ventes publie
le reçu JOUR par jour (`recuJours`, mêmes lignes, 14 mois) — une publication plus ancienne ⇒ « — ».
Écart en € et en % seulement si les deux côtés sont complets ; pas de % contre 0 ni un négatif.
- Preuves : `audit-comparer-mois` (23 verts, 7 rouges sur origin/main ; mutations coupe 8, partiel,
  pct0, jours, jusqua 1 chacune) ; `audit-benefice-unique` 47 verts (règle d'avant inchangée).

### 3. « Frais par site » (Statistiques, période choisie, `src/fraisPlateformes.js`)

Mesuré ce que chaque site écrit : Vinted aucune commission vendeur (frais = ce qu'il a saisi sur
les fiches, déjà dans le relevé `vrm_stats_ventes`, + packs/options Vinted de Comptabilité) ;
Leboncoin prix final = ce qu'il touche (frais = packs/options saisis) ; eBay `totalMarketplaceFee`
par commande (base = dû au vendeur, port exclu) ; Vestiaire : la vente rangée ne garde que le versé
(`sellerEarning`), la commission n'est PAS lue ⇒ « commission pas lue », aucun %. Couverture dite
« frais lus sur N/M ventes » ; % sur les seules ventes aux frais lus.
- Preuves : `audit-frais-plateformes` (13 verts, 3 rouges sur origin/main ; 5 mutations rouges).
- Reste : la commission Vestiaire demande que l'extension range le prix (`sellerPrice`) à côté du
  versé — hors de ce chantier (l'extension n'est pas touchée).

### Banc commun

`scripts/bancs/argent-mois.cjs` (données inventées, 390 tactile et 1512, clair et sombre) :
100 verts. Captures regardées (carte « À venir », journal, Comparer, Frais). **52 rouges** sur le
build d'origin/main (8d01ecc9).


## Déplacé de CLAUDE.md §9 le 11 nov. (taille)

- **11 nov. · Ventes sans date de versement (lot DJ7)** : mesuré, 1 751 sur UN compte, détail de transaction jamais relu ; relevé : 0 vente datable. « Déclarer » : « N datées ✓ · M sans date », une raison par ligne + geste (« Ouvrir Vinted » par compte, Leboncoin à la main) ; jamais devinée (`src/versementRaisons.js`). `docs/passation/2026-11-11-dates-versement.md`. Geste : ouvrir vinted.fr sur ce compte.
