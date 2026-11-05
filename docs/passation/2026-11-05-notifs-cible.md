# 5 nov. — Notifications : le toucher mène à l'objet (branche `v31-notifs-cible`)

<!-- Section déplacée telle quelle de la fin de CLAUDE.md lors de l'intégration `integration-lot1` (5 nov.). -->

## 11. Notifications : le toucher mène à l'objet (5 nov., branche `v31-notifs-cible`)

- **Fait** : un crochet unique `data-cible` (jetons « type:identité », `attrCible` de
  `src/cibleNotif.js`) sur chaque élément visé ; `CibleNotif` le cherche d'abord, défile,
  pose ~4 s un contour d'accent (`data-cible-eclaire`, un attribut — React effaçait la
  classe ; poids de deux identifiants — les lignes de conversation et de vente l'annulaient,
  invisible avant), ouvre la ligne d'un colis arrivé sur son code, lève la ville choisie,
  ouvre un `<details>` replié ; offre ⇒ conversation puis carte de l'offre ; vente
  Vestiaire ⇒ sa ligne ; rappel « à poster » ⇒ la liste (l'intertitre visé n'existait
  plus). Serveur : `DESTINATIONS.offre`, `DESTINATIONS.vcVente` ; textes fréquents
  fabriqués dans `api/_lib/notif-apercus.js` (lu aussi par l'aperçu). Paramètres →
  Notifications : trois groupes, ce qui fait sonner, aperçu + « Toucher ouvre », écriture
  refusée ⇒ interrupteur remis. Alertes locales : un toucher ouvre leur écran.
- **Prouvé** : banc `cible-evidence` 130 verts (64 rouges sur le code d'avant ; mutations
  « ligne pas ouverte » et « sélecteur faible » ⇒ 18 rouges) ; `audit-cibles-notif` (28
  rouges avant) ; `notifs-destination` 56, `rappel-soir` 17, `notif-messages` 38,
  `colis-relais-push` 14 verts — ces deux derniers étaient rouges sur la base (textes et
  défauts d'avant le 3 nov.), remis sur la règle. `npm run build` vert.
- **Non mesuré** : un vrai toucher sur iPhone (service worker réel) ; les e-mails sans
  identité (argent reçu, « à confirmer », commande Vinted au relais) ouvrent l'écran nu ;
  double vente Vinted/Vestiaire ⇒ écran sans ligne ; Leboncoin/eBay n'envoient aucun e-mail
  de vente ; un toucher qui change la ville choisie (« Toutes ») la garde changée.
- **Revue du 5 nov.** : vente Vestiaire de l'extension (clé ≠ productId) jamais trouvée ⇒
  la ligne porte aussi le productId ; « Faire une offre » sans offre n'est plus montrée comme
  l'offre (une ligne le dit) ; aperçus tirés des vraies fabriques (`texteSoir`,
  `texteOffresMini`, `texteAnnulation` dans `notif-apercus.js`) ; offre au mini ⇒
  `cible=offre`. `cible-evidence` 156 verts (6 rouges avant), `audit-cibles-notif` (7).
