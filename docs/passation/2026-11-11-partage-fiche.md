# 11 nov. 2026 — « Partager » une fiche d'annonce (lot partage-fiche)

## Ce que ça fait

Depuis une annonce, « Partager » crée un lien propre `vrm.center/p/<jeton>` pour
envoyer l'article à un client hors Vinted (SMS, WhatsApp, iMessage, Instagram).

- **Annonces** → « … » sur la fiche → **Partager**.
- **Stock** → toucher une paire EN LIGNE → **Partager**.
- La feuille montre **exactement** ce que verra le client (la même règle que le
  serveur, `nettoyerFiche`) : photos, titre, taille, état, prix.
- Choix : les liens des annonces en ligne (Vinted, Leboncoin, eBay, Vestiaire —
  trouvés PAR LE N°, la règle de « Prix partout », `sitesDuNumero`), « Montrer mon
  pseudo » (éteint par défaut), durée **1 j / 7 j (défaut) / 30 j**.
- « Créer le lien et partager » : le partage du téléphone (`navigator.share`), sinon
  le lien est copié. Ensuite : « Partager le lien », « Copier », « Mettre à jour »,
  « Arrêter le partage » ; « Mes autres liens actifs (N) » avec « Arrêter ».

**Gestes comptés** : Annonces « … » → « Partager » → « Créer le lien et partager »
= **3** (mesuré par le banc). Stock : la paire → « Partager » → « Créer… » = 3.
Si le téléphone refuse d'ouvrir son partage après l'attente du serveur (Safari peut
le faire), le lien est prêt et « Partager le lien » le rouvre : 4 gestes.

## Ce qui n'est JAMAIS montré

Prix d'achat, N° de rangement, compte VRM, adresse, description (elle peut porter
le N°), acheteur, pseudo non voulu. Le serveur **re-nettoie** tout ce qu'envoie le
navigateur : un champ inconnu est perdu, une photo d'un hôte inconnu
(pixel de pistage) est refusée, un lien n'est gardé que s'il désigne l'ANNONCE sur
un site connu, sans paramètre (ni suivi, ni parrainage). Prix : euros seulement
(§3 International), jamais converti.

⚠️ Tranché : le lien « Voir sur Vinted » mène à l'annonce, où Vinted affiche le
pseudo. La feuille le dit (« L’annonce Vinted montre ton pseudo. ») ; il peut
décocher le lien.

## « Vendu » et la fraîcheur (§5)

- L'identité privée de la paire (`ident` : annonce Vinted, compte, N°) reste dans
  SA ligne, jamais servie.
- L'app est le seul propriétaire de la preuve (`annoncesVendues`, Comptabilite) :
  un effet appelle `synchroniserPartages` → `decisionsSynchro` (pure,
  src/partageFiche.js) → POST `etat`. Annonce ou N° **prouvés** vendus ⇒ la page
  dit « Vendu » (ni prix ni lien). Toujours **en ligne** (lecture complète, non
  partielle) ⇒ « vérifiée », au prix relu. **Jamais vendu par absence** ; ventes ou
  annonces pas lues ⇒ rien. Une vente annulée revenue en ligne ⇒ de nouveau
  disponible (seulement si c'était la preuve qui l'avait dite vendue).
- La page est TOUJOURS datée : « Infos vérifiées le 11 nov. à 14 h 05. » Sans
  confirmation depuis 72 h : « Infos du … À confirmer avec le vendeur. » (ambre).
  Rythme : une synchro au plus toutes les 10 min (tout de suite sur une vente
  nouvelle) ; un vendeur sans lien : un appel léger par heure au plus.

## La page publique

`vercel.json` réécrit `/p/:jeton` vers `/api/compte?mode=partage&p=:jeton` — un mode
de la route existante, **aucune fonction neuve** (12). HTML rendu par le serveur
(les aperçus iMessage/WhatsApp lisent l'Open Graph sans JS) : `og:title`
« Titre · 80 € » (« Vendu · Titre »), `og:description` « Taille 42 · Très bon
état », `og:image` la 1re photo. Aucun script, < 12 Ko, clair/sombre selon le
téléphone, galerie qui glisse (CSS seul).

En-têtes : `CSP default-src 'none'; img-src https: data:; style-src 'unsafe-inline'`,
`Referrer-Policy: no-referrer` (le jeton ne part pas vers Vinted au clic),
`X-Robots-Tag: noindex`, `no-store` (un lien arrêté meurt tout de suite). Le service
worker laisse `/p/` au réseau (sinon la page aurait été rangée sous « / » à la place
de l'app — même piège que les pages légales).

## Sécurité

- Jeton : 32 octets aléatoires (base64url, 43 car.). Rangé dans SA ligne
  `vrm_partage_<16 car.>` ; indexé par son **empreinte** chez le propriétaire neutre
  (`jeton_partage_<sha256>`, api/_lib/jeton-index.js), jamais en clair. L'index ne
  fait pas foi seul : le jeton est re-comparé à durée constante (`memeJeton`).
- Pas d'énumération : inconnu, mal formé, arrêté, expiré, abonnement arrêté ⇒ la
  **même** page 404. Base injoignable ⇒ 503 « Réessaie » (jamais « plus actif »).
- La page lit 2 lignes par leur clé, **projetées** (`fiche`, dates, `vendu`) :
  jamais `ident`, jamais `select=data`.
- Gestes sur SA session (`vendeurExige`), clé de service bornée à `owner = l'id du
  jeton vérifié`. 100 liens actifs au plus. Index raté à la création ⇒ la ligne
  repart (aucun lien à moitié). Expirés : retirés à la lecture de la liste.
- Aucune migration SQL : la table `app_data` existante suffit.

## Preuves

- `node scripts/audit-partage-fiche.cjs` : EXÉCUTE api/compte.js (création, page,
  Open Graph, fuites, échappement, en-têtes, énumération, pannes, abonnement,
  cloisonnement, vendu, périmé, arrêt, expiration, synchro pure, câblage).
  `--prouve` : 12 mutations (titre non échappé, `ident` lu par la page, jeton pas
  re-comparé, panne dite « plus actif », abonnement ignoré, expiration ignorée,
  photo d'hôte inconnu, paramètres gardés, jamais « à confirmer », vendu par
  absence, compte en pseudo, vente prouvée ignorée) ⇒ toutes ROUGES.
- `scripts/bancs/partage-fiche.cjs` : le vrai écran Annonces (données inventées) et
  la vraie route en mémoire, 390 tactile et 1512, clair et sombre. Rouge sur le
  build d'origin/main (pas de « Partager »). Le Stock n'est pas rendu par ce banc
  (la grille demande des meubles) : son bouton est tenu par l'audit (G4).

## Fichiers

`src/partageFiche.js` (la règle, importée aussi par le serveur) ·
`api/_lib/partage-fiche.js` (route + page) · `api/compte.js` (mode `partage`) ·
`vercel.json` · `public/sw.js` · `src/composants/PartageFiche.jsx` + `.css` ·
`src/App.jsx` (bouton Annonces, écouteur `vrm:partager`, feuille, synchro) ·
`src/ecrans/Stock.jsx` (bouton) · `scripts/audit-partage-fiche.cjs` ·
`scripts/bancs/partage-fiche.cjs`.

## Geste de Julien

Aucun.
