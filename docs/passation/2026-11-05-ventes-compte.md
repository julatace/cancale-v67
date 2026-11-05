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
