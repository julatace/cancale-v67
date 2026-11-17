# 17 nov. 2026 — Partager le stock avec un aidant (lot `partage-aidant`, mission 7)

Branche `claude/partage-aidant` (depuis `origin/main`). Mission :
`docs/passation/file-attente-16nov/7-partage-aidant.md` (validée par Julien). Rien dans `vinted-sync-extension/`,
aucune migration, aucune fonction `api/` neuve.

## Ce qui existait (lu avant de coder)
- Le « partage de fiche » cité par la mission n'est PAS sur main (branche jamais fusionnée ; `/p/` sert aux
  partenaires). La mécanique réutilisée est celle, sur main, du **lien comptable** (`api/_lib/comptable-lien.js`,
  `/c/<jeton>`, page sans l'app `src/VueComptable.jsx`) : jeton signé et expirant, index par empreinte
  (`api/_lib/jeton-index.js`), liste blanche côté serveur, `/api/compte?mode=…`.
- Mode équipe (016) pas appliqué : on n'en dépend pas.

## Ce qui change
- `api/_lib/aidant-lien.js` (neuf) : jeton `<aléa 24 octets>.<expiration>.<HMAC>` (clé `AIDANT_SECRET`, sinon
  la clé de service), 24 h (défaut) ou 7 jours, **10 liens actifs** au plus par vendeur, rangés dans SA ligne
  `vrm_aidant` et indexés par empreinte chez le propriétaire neutre (genre `aidant`).
  Route publique (GET seulement, aucune écriture, pas même un journal) : débit limité AVANT toute lecture
  (`prendreDebit('aidant')`, 20/min et 200/h par adresse ET par jeton) ; forme/signature fausse ⇒ 404 ;
  **expiré ⇒ 410 ; révoqué ⇒ 410** (la liste du vendeur fait foi, même si l'index n'a pas pu être retiré) ;
  base injoignable ⇒ 503. Réponse = `vueAidant` : par N° rangé, **num, lieu, titre, photo** (https d'image
  seulement) — jamais un prix, un montant, un pseudo, un compte, une adresse, un acheteur (liste blanche à
  l'écriture ET à la lecture). Projection `l:data->liens,v:data->vue`, jamais `select=data`.
  Vendeur (sa session, sa ligne seulement) : liste des liens actifs (identifiant court, jamais le jeton),
  `creer` (24 h/7 j + le stock), `publier` (mettre à jour le stock), `couper` (révoquer).
- `api/compte.js` : `mode=aidant` ; `jeton-index.js` : genre `aidant` ; `debit-vendeur.js` : `aidant` ;
  `vercel.json` : `/a/<jeton>` ⇒ `/?aidant=<jeton>`.
- `src/aidantStock.js` : le stock publié par le navigateur = chaque N° rangé (`stockPourRecherche` : plan + garage),
  son lieu (pièce · meuble · case), titre et photo de SA fiche par identité de N° (deux fiches au même N° ⇒ ni
  titre ni photo).
- `src/VueAidant.jsx` + `vue-aidant.css` : la page publique, sans l'app ni session (`src/main.jsx`), recherche
  sans accent, clair/sombre. `src/PartageAidant.jsx` : Paramètres → Stock et rangement → « Partager le stock
  avec un aidant » (`PartageAidantSetting`, App.jsx). Textes `aidant.*` en 5 langues (`langues/<l>/aidant.js`).

## Preuves
- `node scripts/audit-partage-aidant.cjs` (neuf) : **EXÉCUTE la route** contre une base en mémoire à la forme
  PostgREST — 32 contrôles verts (24 h/7 j, 410 expiré/révoqué, 404 retouché, aucun champ interdit, aucune
  écriture publique, 405 sur POST, 429 avant lecture, 503, cloisonnement entre deux vendeurs, projection,
  stock du navigateur, branchement). `--prouve` : **15/15 mutations**.
- Banc `scripts/bancs/partage-aidant.cjs` (page publique, 390 tactile clair/sombre et 1512, `fr-FR`) : **24/24** —
  liste N° + lieu, recherche « case 3 », aucun prix/pseudo/adresse, une seule requête (GET du lien), 410 ⇒ « plus
  valable », 503 ⇒ « Réessayer » ≥ 44 px. Captures regardées (le titre était invisible en sombre : corrigé).
  Sur origin/main la page n'existe pas (`?aidant=` ouvre l'app) : la preuve par mutation est celle de l'audit.
- `audit-jeton-index` 23/23, `audit-limites-client` 13/13, `audit-routes-revue` 31/31, `audit-argent-prix`
  64/64, `audit-robustesse-serveur`, `audit-csp`, `audit-fonctions-api` (12 fonctions), `audit-traduction`,
  `audit-quoi-de-neuf` verts ; build vert.

## ÉTAT À LA REPRISE
- PR ouverte (voir le rapport). Le réglage de Paramètres n'a pas de banc de rendu propre (build vert, branché
  comme `LienComptable`) : à capturer au prochain passage.
- Geste de Julien (facultatif) : poser `AIDANT_SECRET` sur Vercel (sinon la clé de service signe, comme le lien
  comptable).
