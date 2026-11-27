# 27 nov. — Chasse aux bugs du code fusionné le 27 nov. (PR #1440 à #1452)

Branche `claude/chasse-bugs-27nov`. Aucune donnée en base, rien dans `vinted-sync-extension/`.
Contrôle : `node scripts/audit-chasse-27nov.cjs --prouve` (et `--src <arbre d'avant>` : il rougit).

## 1. Ventes « Toutes », filtre « Compte » : un compte = son identité, jamais son nom (PR #1444)

- **Chemin** : `toutesLignes` pose `compte` = le NOM lu (Vinted : son étiquette ou le login ; Leboncoin : `accountName`, le nom
  AFFICHÉ, souvent un prénom ; eBay : le pseudo). `comptesDeLignes` / `filtrerCompte` (src/filtrePlateforme.js) filtraient par ce
  nom : deux comptes Leboncoin « Julien », ou « julien35 » sur Vinted et sur eBay, faisaient UN choix qui montrait les ventes
  des deux comptes (§5 : jamais par ressemblance ; §3 « comptes séparés »). Même défaut au tableau de l'ordinateur.
- **Correction** : chaque ligne porte `compteCle` = site + identifiant (`identiteCompteVente` : uid Vinted, compte de la
  transaction Leboncoin, référence eBay) ; `cleCompteLigne` (sans identifiant : site + nom, deux sites ne se mêlent jamais) ;
  `comptesDeLignes` rend `[{ cle, libelle }]` — un nom porté par plusieurs comptes dit son site, puis la fin de l'identifiant
  (« Julien · Leboncoin · …4821 »). Un ancien choix retenu par le nom retombe sur « Tous les comptes ».
- **Preuves** : audit C1–C7, B1–B4 (rouge sur `origin/main` : 9 rouges) ; 4 mutations rougissent ; banc `comptes-securite`
  (PARTIES=A, 390/1512) : clés `compte:vinted:{uid}` et un scénario « deux comptes au même nom » (deux choix, chacun SES ventes),
  captures regardées.

## 2. Aujourd'hui, « Vinted pas lu depuis N jours » d'un compte relu à l'instant (PR #1451)

- **Chemin** : `fraicheurUnique` (src/fraicheur.js, étape 3 bis) range sous `source: 'compte'` les ACHATS d'un compte frais
  (`cle: achats:vinted:{id}`, daté de la lecture de ses achats, au-delà de 2 j). `lecturesAnciennes` prenait toute ligne
  `source: 'compte'` : « Vinted pas lu depuis 3 jours » et « ses annonces en ligne sont à confirmer » d'un compte relu il y a
  une heure — dès qu'il n'ouvre pas « Mes commandes › Achats » deux jours de suite.
- **Correction** : seule la lecture DU COMPTE (`cle` en `compte:`) ou une panne le dit.
- **Preuves** : audit L0 (la forme de src/fraicheur.js), L1–L3 (rouge sur `origin/main`) ; mutation rougit.

## À trancher par Julien

- Messages « Tous » (PR #1444) : un compte qui a une question eBay sans réponse passe AVANT le compte de l'onglet. La règle du
  12 nov. (§3 « Messages, comptes ») dit « compte de l'onglet d'abord ». Les deux décisions se contredisent ; rien changé.
