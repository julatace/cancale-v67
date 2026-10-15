# Étude : rapprochement bancaire, facturation électronique, Indy (15 octobre 2026)

Demande du 15 octobre : « étudier rapprochement bancaire, facturation
électronique, intégration Indy (API, autorisations, coûts, obligations) avant
toute promesse ». Cette note **ne promet rien dans l'app** : l'écran Comptabilité
dit seulement « Banque, facturation électronique, Indy : rien n'est connecté ».

⚠️ **Fiabilité des sources.** impots.gouv.fr et economie.gouv.fr ne répondent
pas depuis ce conteneur (`ENOTFOUND`, mesuré le 15 octobre). Tout ce qui suit
vient de sources **secondaires** (éditeurs, presse) lues le 15 octobre 2026,
listées en bas. Une date ou une obligation n'est à afficher dans l'app qu'après
lecture de la source officielle, datée.

## 1. Facturation électronique

| point | ce que disent les sources secondaires | à vérifier sur la source officielle |
|---|---|---|
| Réception | obligatoire pour **toutes** les entreprises au **1er septembre 2026**, micro-entreprises en franchise de TVA comprises : il faut être inscrit sur une **plateforme agréée** (PA, ex-« PDP ») | la date, et la liste des PA (impots.gouv.fr) |
| Émission | micro-entreprises, PME : **1er septembre 2027** ; formats cités : Factur-X, UBL 2.1, CII | la date pour SON cas |
| Ventes aux particuliers (B2C) | relèvent de l'**e-reporting** (transmission de données, pas de facture électronique à l'acheteur) | le périmètre exact pour des ventes entre particuliers sur Vinted, eBay, Leboncoin |
| Sanctions | une source cite 50 € par facture, 500 € sans plateforme — **non confirmé** | — |

**Ce que VRM a déjà** : un générateur Factur-X (XML CII embarqué dans le PDF)
pour les factures émises depuis l'écran Factures — conformité PDF/A-3 non
certifiée, et la catégorie de TVA est écrite en dur (« E », 0 %), fausse pour un
assujetti ou au régime de la marge.

**Ce qu'il faudrait pour aller plus loin** : choisir une plateforme agréée
(c'est SON geste : il y crée un compte, avec ses identifiants) ; puis, si la
plateforme a une API, y déposer les factures émises par VRM et en lire les
factures reçues. Aucune plateforme n'est choisie aujourd'hui : rien à coder.

## 2. Rapprochement bancaire

- **Comment** : lire les opérations de SON compte bancaire passe par un
  agrégateur agréé au titre de la DSP2 (service d'information sur les comptes,
  AISP), par exemple Bridge ou Powens — présentés comme agréés par l'ACPR (à
  vérifier sur le registre public de l'ACPR).
- **Autorisations** : consentement du titulaire du compte, renouvelé
  périodiquement (DSP2) ; données bancaires = données sensibles (politique de
  confidentialité, stockage cloisonné par vendeur).
- **Coût** : aucune grille publique trouvée — **sur devis** (Bridge, Powens).
- **Fiabilité** : la presse spécialisée rapporte des API bancaires instables
  (« dès qu'une API saute, le solde est faux »).
- **Le piège §5** : rapprocher un versement Vinted d'une opération bancaire par
  le **montant et la date** est un rapprochement par ressemblance. Il faut une
  identité commune (référence du virement) — non mesurée.
- **Ce qui existe déjà sans banque** : le relevé du porte-monnaie Vinted
  (`capterReleves`, extension ≥ 5.52) dit ce qui a été viré vers la banque.
  Mesuré le 15 octobre : **0 ligne** `harvest_*_releve_*` chez Julien.

## 3. Indy

- **API** : aucune documentation publique trouvée pour importer des ventes ou
  des factures dans Indy. Un recensement (API Tracker) cite une documentation
  développeurs **sur demande** (formulaire), sans détail public.
- **Ce qui est possible sans API** : un export fichier (le CSV des dépenses de
  la Comptabilité, le registre annuel CSV/PDF de Déclarations) que Julien
  importe lui-même — à condition qu'Indy accepte ce format (non vérifié).
- **Avant d'écrire une ligne** : demander à Indy (support ou formulaire
  développeurs) s'il existe une API d'import, ses autorisations et son coût.
  Partager les ventes avec un tiers demande son consentement et une mise à jour
  de la politique de confidentialité.

## 4. Ce que fait l'app aujourd'hui (et ne fait pas)

- Comptabilité : dépenses, abonnements (périodicité, TVA, payé), exports CSV ;
  « Banque, facturation électronique, Indy : rien n'est connecté. »
- Aucune promesse de date, de conformité ni de connexion.

## Sources (secondaires, lues le 15 octobre 2026)

- [Tide — facturation électronique](https://www.tide.co/fr-FR/blog/facturation-et-tresorerie/facturation-electronique/)
- [La Micro by Flo — calendrier micro-entreprise](https://lamicrobyflo.fr/calendrier-facturation-electronique-micro-entreprise/)
- [La Fabrique du Net — obligations 2026](https://www.lafabriquedunet.fr/logiciels/tendances/facture-electronique-auto-entrepreneur-2026)
- [Dougs — auto-entrepreneur](https://www.dougs.fr/blog/facturation-electronique-auto-entrepreneur/)
- [Eurex — guide 2026 (PDF)](https://www.eurex.fr/wp-content/uploads/2026/05/Guide-FE-Eurex-2026.pdf)
- [API Tracker — Indy](https://www.apitracker.io/a/indy-fr/developers)
- [Open Banking Tracker — Bridge vs Powens](https://openbankingtracker.com/api-aggregators/bridgeapi-io/vs/powens)
- [Journal du Net — l'addition de la DSP2](https://www.journaldunet.com/fintech/1497635-pour-les-fintech-l-addition-tres-salee-de-la-dsp2)
- [Journal du Net — API des banques françaises](https://www.journaldunet.com/fintech/1444996-dsp2-les-api-des-banques-francaises-en-retard-mais-sur-la-bonne-voie/)
