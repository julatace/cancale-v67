# Parité des plateformes (11 nov.) — branche `claude/parite-plateformes`

Mission : ce que VRM fait sur Vinted, le faire aussi sur Leboncoin, eBay et Vestiaire
quand c'est honnêtement possible ; dire « pas su » sinon ; aucune donnée inventée,
aucun geste interdit. La matrice mesurée est dans `parite-plateformes.md` (mise à jour,
l'état du 3 nov. gardé tel quel en archive).

## Comment on a mesuré
Deux relevés du code, en lecture seule : l'argent (exports, objectif, Statistiques,
bilans, DAC7/URSSAF) et les colis/messages/frise/textes. Constat : les règles partagées
(`ventesFaites`, `ventesDeclarables`, `vrm_colis_aposter`, widget, rappels, bilans serveur,
export « pour mon comptable », objectif du mois) couvraient déjà les quatre plateformes.
Les trous étaient dans du code d'écran plus ancien, qui relisait Vinted seul.

## Ce qui a changé (par valeur pour un vendeur)
1. **Bug — « Finalisé par plateforme » (Statistiques)** comptait encore les ventes d'un compte
   Leboncoin, eBay ou Vestiaire **écarté** (Paramètres → Comptes liés, ou hors offre Solo),
   alors que tous les autres totaux l'excluent. `caParPlateforme(…, excluAutre)` reçoit le
   prédicat de `useExcluAutre` ; eBay est refait par `caEbayPayees` sur les commandes gardées.
2. **Rapport du mois et registre annuel (Ventes → outils)** : le prix d'achat, le N° et donc la
   marge n'étaient remplis que pour Vinted. Ils viennent maintenant de la paire reliée par
   **identité** (`autresBenefice` → carte `autresParIdRapport`, clé = l'id de la ligne
   déclarable : `lbc:{txId}`, `ebay:{orderId}`, `vestiaire:{id}` — l'audit vérifie que les deux
   règles fabriquent la même clé). Pas reliée ⇒ vide, comme une vente Vinted sans prix. Le
   rapport passe aussi Vestiaire dans « à dater » et le nomme dans « sources non lues ».
3. **Tableur « comptabilite-ventes.csv »** : Vinted seul ⇒ + les ventes Leboncoin/eBay/Vestiaire
   à l'argent reçu (`declRapport`, la règle du CA déclaré), colonne « Plateforme » ajoutée en
   DERNIER (les colonnes d'avant ne bougent pas), plateforme pas lue dite en pied, et une ligne
   qui dit que les ventes en cours / au montant pas sûr n'y sont pas. Le bouton paraît aussi
   pour un vendeur sans vente Vinted.
4. **Statistiques → « CA entre deux dates »** : sommait Vinted seul et l'écrivait « Vinted,
   tous comptes ». Nouvelle règle pure `src/caAutresParJour.js` (la population de « Finalisé
   par plateforme », au jour de vente, comptes écartés hors) ; l'écran attend les autres
   lectures au lieu d'afficher Vinted seul comme complet ; une plateforme pas lue ⇒ « au
   moins » et son nom ; une vente finalisée sans date ou au montant pas sûr ⇒ « hors total » et
   comptée pour être dite. Une date Leboncoin saisie sans heure est le jour même (midi), jamais
   la veille en UTC. `Dashboard` reçoit `lbcLu` (la coque distingue « pas lu » de « vide »).
5. **Colis → récapitulatif** : « au moins » seulement si eBay n'était pas lu ; Leboncoin et
   Vestiaire illisibles donnaient « Aucun colis à envoyer » (mesuré sur le build de `main`).
   Désormais nommés (« ventes Leboncoin pas lues »), et leurs colis dits comme ceux d'eBay.
6. **Accueil public** : nomme Vestiaire avec les trois autres.

Rien ne touche l'extension (pas de nouvelle version), ni la base, ni `api/`.

## Preuves
- `node scripts/audit-parite-plateformes.cjs` : 29 verts ; **17 rouges sur `origin/main`**
  (arbre `git archive`) ; `--mutations` : **16/16** tuées.
- Banc `scripts/bancs/parite-plateformes.cjs` (base inventée, `_minipgrest`, 390 tactile clair
  et sombre, 1512) : **27 verts** ; sur le build de `main` : **18 rouges** (110 € « Vinted, tous
  comptes » au lieu de 305 € ; Leboncoin 115 € avec le compte écarté ; Colis « Aucun colis à
  envoyer » Leboncoin illisible). Captures regardées (carte de la plage, « Finalisé par
  plateforme », clair et sombre).
- `npm run build` vert ; audits variables, tdz, coherence, identite, icones, textes-courts,
  fonctions-api, secrets, extension-zip, finir-compta verts. `audit-donnees-ecrans` : 1 rouge
  (`_fmtJourSemaine is not defined`) **identique sur `origin/main`**, pas de cette branche.
- Banc `vinted-ui.cjs` : 21 rouges **identiques sur le build de `main`** (fiche annonce,
  calendrier) — préexistants, pas de cette branche ; sa partie « CA entre deux dates » n'est
  jamais atteinte (le clic du calendrier échoue avant).

## Ce qui reste (voir la matrice)
Notification « vendu » eBay et Leboncoin ; temps pour vendre Leboncoin (`publieeLe` capté,
jamais lu) ; frise complète hors Vinted ; cycle d'un article hors Vinted ; suppression et
republication Vestiaire (à mesurer). Remarque laissée telle quelle : « Finalisé par
plateforme » écrit Vestiaire « — » dès qu'UNE vente a un montant pas sûr (règle du 2 nov.),
quand « CA entre deux dates » compte les sûres et dit l'autre hors total — deux façons
honnêtes, à unifier si Julien le veut.

## Geste de Julien
Aucun.
