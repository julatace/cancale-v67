# 11 nov. 2026 — Textes courts, 5e série

Branche `claude/textes-courts-5` (depuis `origin/main` 3cb90230), poussée à chaque commit, pas de PR. Suite de
`2026-11-10-textes-courts-4.md` ; même règle (`2026-11-09-popups-propre.md`) : un texte affiché de plus de
90 caractères est RÉÉCRIT (le fait + le geste, ≤ 12 mots si possible), le détail utile replié sous « Pourquoi ? »
(`Pourquoi` d'App.jsx, ou `src/composants/PourquoiReplie.jsx` importé sous le nom `Pourquoi` dans les modules qui
ne lisent pas App.jsx), jamais un avertissement, un « pas su », un manque nommé ni un geste retiré.

## Relevé statique (textes JSX visibles > 90 caractères, même relevé que `audit-textes-courts`)

| fichier | avant | après |
|---|---|---|
| `src/ecrans/Reglages.jsx` | 15 | 1 (l'essai gratuit, texte des CGV : exception nommée) |
| `src/ecrans/Ebay.jsx` | 15 | 0 |
| `src/ecrans/Leboncoin.jsx` | 10 | 0 |
| `src/Accueil.jsx` | 11 | 0 |
| `src/ConfigurerTransfert.jsx` · `src/RelierBoite.jsx` · `src/CarteRelais.jsx` | 6 · 3 · 3 | 0 |
| `Stock`, `Vestiaire`, `PrixMarche` (3 chacun), `Compta` (2 + 1 dans « D’où vient ce chiffre ? »), `Republier`, `MessagesLeboncoin`, `PhotoEditor` | 16 | 0 |
| `Bienvenue`, `BoiteEmails`, `JournalEmails`, `ReceptionEmails`, `ebayGestion`, `Tournee`, `JaugeActions`, `ModeEmballage`, `GuideIphone`, `ExpliqueMondialRelay` | 15 | 0 |
| **tous les `.jsx`** | **133** | **42** |

## Ce qui a changé (quelques exemples ; le texte d'avant est sous « Pourquoi ? » quand il était utile)

- **Réglages** : e-mail d'essai, double vérification (« dans Mots de passe (ou Authenticator), touche « + » et
  scanne »), compte propriétaire (« suppression désactivée ici »), mentions légales / prix Stripe (le fichier et la
  clé `vrm_mensuel` restent visibles : banc `abonnement`), mode test, lettre des numéros, boîte collective,
  brouillon repris (« Une modification non enregistrée a été reprise » gardé : test `brouillon-import-interface`),
  preuve d'adresse (« Chaque adresse se confirme une fois » gardé : banc `adresses-preuve`). Les titres de la
  suppression du compte passent de `<span display:block>` à `<div>` (même rendu).
- **eBay** : livraison (« La livraison est gérée par eBay : eBay fixe le montant et l'encaisse. » + « Tu ne paies
  jamais le port. » À L'ÉCRAN, §2.8 — banc `ebay-form` ; le transporteur et le bordereau repliés), règle d'offre
  (sous le prix d'achat, offres déjà faites, rappel du %, engagement « acceptée = vendue » avec « Dont N lue… »
  gardé), programmation (« Annulation pas garantie ; vendu ailleurs avant l'heure, il peut partir. J'ai compris. »),
  inactives, alertes autres comptes, retrait auto, annonces illisibles, lot interrompu.
- **Leboncoin** : référence VRM, fiche (« publiera sa propre version » gardé : banc `lbc-publier-app`), articles
  revenus, prix changé, annonces jamais lues, pas revues (« profil Leboncoin » gardé : banc `lbc-pause`), « à
  confirmer » (« Mes annonces » gardé), vendues à retirer (« Vente certaine : retire-la… »), pause.
- **Accueil (page publique)** : sous-titre, chapô, « Tes comptes restent les tiens » (les deux automatismes en
  liste, `data-automatisme` gardés : banc `accueil`), « Ton ordinateur reste nécessaire : c’est lui qui lit Vinted. »
  et « …allumé, navigateur ouvert. » gardés mot pour mot (`audit-accueil-navigateurs`), FAQ en question / réponse
  courte (`.av-faq-q`), « avec Pro, tous tes comptes vendent, sans limite » gardé (banc `pro-illimite`).
- **E-mails** : `ConfigurerTransfert` (relais Apple, code Gmail ; « VRM ne peut pas vérifier directement » gardé :
  test `transfert-guide-interface`, qui sert désormais aussi le `Pourquoi` replié), `RelierBoite`, journal, boîte.
- **Carte des relais / tournée** : l'attribution OpenFreeMap · © OpenMapTiles · © OpenStreetMap reste à l'écran
  (licence), sur deux lignes ; la règle « un colis n'est rangé sous un point que par ce qui le désigne » repliée.
- **Organisation** : `operations.css`, une ligne — le « ⓘ Pourquoi ? » des formulaires prend la taille de sa note
  (11 px), plus 13 px à côté.

## Pas touchés (exprès)

Panneau « Sécurité des données », confirmations de suppression eBay/Leboncoin, `ExtEnRetard`, le zip « un seul
dossier », CGU / rétractation / essai gratuit (`Reglages` l'essai, `App.jsx`), seuils DAC7 (`Dac7Comptes`, App.jsx),
l'alerte « deux paires sous un même N° » (`Loupe`, `FichePaire`, App.jsx), ce qui part avec un signalement,
`SourceChiffre` de Compta (déjà un repli : ajouté aux replis ignorés de l'audit).

## Preuves

- **`scripts/audit-textes-courts.cjs` étendu** aux 24 fichiers ramenés à zéro (+ exception « Essai gratuit une seule
  fois », + `SourceChiffre` ignoré comme un repli) ; T2 : « Tu ne paies jamais le port » reste À L'ÉCRAN sur eBay ;
  T3 : cinq phrases témoins gardées sous « Pourquoi ? ». Vert ici (48) ; sur `origin/main` (`git archive`,
  `TEXTES_RACINE=…`) : **29 rouges** ; `--prouve` : ancien avertissement des Favoris ET ancien bloc livraison eBay
  recollés ⇒ rouges vus.
- Avant chaque remplacement, les morceaux du texte d'avant cherchés dans `scripts/` ; les phrases lues par un
  audit/banc sont gardées (listées ci-dessus).
- `npm run build` vert ; audits `variables`, `tdz`, `coherence`, `identite`, `icones`, `boutons`,
  `accueil-navigateurs`, `qr-capture-mr`, `journal-emails`, `boite-emails`, `vintedgo-adresse`, `colis-frequent`,
  `villes-colis`, `politique-hotes`, `retraits-irreprochables`, `cibles-notif`, `retrait-preuves` verts ; test
  `transfert-guide-interface` vert (390 et 1512).
- Déjà rouges sur `origin/main`, inchangés : `audit-relier-compte` (5 rouges R7), test
  `brouillon-import-interface` (champ date jamais visible), `audit-accueil-navigateurs --prouve` (3 motifs
  introuvables : une espace insécable dans le motif « ordinateur nécessaire », deux phrases d'avant le 8 nov.).
- Banc `popups-propre` (`BANC_PORT` aléatoire) : **329 verts, 0 rouge** ; captures regardées (Organisation : le
  « ⓘ Pourquoi ? » à la taille de la note ; Paramètres, Annonces 390 sombre).
- Banc `accueil` : 166 verts, 3 rouges qui ne touchent aucune ligne changée ici (prix Pro 19,99 € compté comme
  « autre prix », un « Vestiaire » hors FAQ, le film) ; capture 1512 regardée (FAQ question / réponse, liste des
  deux automatismes).

## Ce qui reste

42 textes longs dans tous les `.jsx` : App.jsx (14, dont CGU, rétractation, essai, DAC7, « deux articles sous un
N° » volontaires), `PlansSoloPro` (3), `RecherchePhoto`, `SmsColis`, `MesuresTerrain`, `Dac7Comptes` (2 chacun),
et une poignée de fichiers à 1 (`ChoixPlateformes`, `EnLigneDeuxFois`, `FacturePro` ×2, `GuideDemarrage`,
`ModeAutoFavoris`, `OutilsArticlesVinted`, `PorteConfidentialite`, `GardeEcran`, `PlantagesTerrain`, `TesDonnees`,
`main.jsx`, `AvatarPersonnel`).
