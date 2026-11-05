# 5 novembre — le compte sur chaque vente (branche `v31-ventes-compte-suite`)

<!-- Section déplacée telle quelle de CLAUDE.md (fin du fichier) lors de l'intégration `integration-lot1`. -->

## 5 novembre — le compte sur chaque vente ; un compte récent compte partout (branche `v31-ventes-compte-suite`)
- **Fait** : le compte (login Vinted, compte Leboncoin, pseudo eBay) écrit sur CHAQUE vente, ligne repliée (bureau et
  téléphone) et détail, même avec un seul compte (§7 « une fois » abandonné ICI) ; pas su ⇒ « compte … non relevé »
  (`CompteVente`, `compteVenteLbc`, `compteVenteEbay`) ; aussi la carte « Argent eBay » des Paramètres. Liste des comptes
  relue sans recharger (`maj · comptes`, compte inconnu, retour, 2 min ; ratée ⇒ rien ne change). « CA Vinted par
  compte » : chaque compte lié non écarté (0,00 € + en cours, « — » pas lu, « au moins » si un prix est illisible). Un
  compte « refusé » localement garde son argent ; ses annonces non lues EXPRÈS ne font plus dire « annonces pas lues »
  au widget (défaut trouvé en revue).
- **Prouvé** : banc `ventes-compte` (données inventées, 390/1512) 49 verts ; 27 rouges sur 85dad5b0, 4 sur 43c483e3 (avant
  revue) ; audits tdz, variables, identite, coherence, urssaf, benefice, revue-argent verts ; 15 bancs voisins identiques à 85dad5b0.
- **Non mesuré** : sa vraie base dans l'app (loladupuis35260 : 1 vente EN COURS, lu en base). Vestiaire : pas de nom de
  compte lu (`vc_session` n'a qu'un id). Ancienne branche `v31-ventes-compte` (967b9999, périmée) à fermer.

## Intégration `integration-lot1` (5 nov.) — une seule règle avec `v31-plateformes-logo`

La base (`claude/project-review-nsk5su`) portait déjà le lot `v31-plateformes-logo`, qui écrivait
aussi le compte sur chaque vente (`nomCompteVente`, recopié dans `sous`). La fusion en garde UNE :
- **Rendu** : `CompteVente` / `texteCompteVente` (trois états : un nom · `null` = « compte …
  non relevé » · `undefined` = rien) ; `''` (l'ancienne convention) vaut « non fourni »
  (`compteFourni`), jamais « non relevé ». Le compte n'est plus recopié dans `sous`, ni dans le
  détail eBay (`meta`) : une fois par ligne et une fois dans le détail.
- **Identités** : eBay = `_pseudo` de la commande, sinon le registre pour `identiteCompteVente`
  (src/plateformes.js), sinon « non relevé » (jamais « compte principal » comme un nom) ;
  Leboncoin = nom joint, sinon `lbc_accounts` sous l'identité (`useAnnuaireLbc`, un seul lecteur,
  relu à la réception, normalisé par `annuaireLbc`), sinon le nom de l'annonce SEULEMENT si elle
  porte le même compte, sinon « n° id » (`nomCompteVente`) ; Vestiaire = « n° id » relevé, sinon
  rien ; « Tous les sites » passe par les mêmes fonctions.
- **Preuves** : banc `ventes-compte` 55 verts (+ L5 « voisin » et « une fois VU ») — 2 rouges sur
  a7f1fac4 (le nom du voisin), 33 sur la base, 3 sous la mutation « compte recopié dans sous » ;
  banc `plateformes-logo` 198 ; `audit-plateformes-logo` 60/60, 30/30 mutations (4 neuves :
  vide-dit-non-relevé, compte-voisin-lbc, ebay-sans-identité, compte-dans-sous).
