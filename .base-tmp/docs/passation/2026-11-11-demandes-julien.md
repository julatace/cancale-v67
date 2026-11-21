# Demandes de Julien — 11 novembre 2026 (matin)

Message reçu le 11 nov. (« Regarde ce que tu as fait et fait ce que tu as pas fait »), découpé
en lots. Chaque lot a sa branche `claude/<lot>` ; la session principale intègre (PR + merge).
Rien ici n'annule une règle de CLAUDE.md §2–§5 (identité jamais par ressemblance, « pas su » ≠ 0,
50 actions/h, rien inventé).

| lot | demande (ses mots, résumés) | branche |
|---|---|---|
| **DJ1 Facture Pro** | SIRET saisi ⇒ recherche animée ⇒ nom, RCS, forme juridique remplis tout seuls ⇒ « Vérifie que c'est bien toi » ; pareil quand on choisit le statut ; visuel plus beau. Factures générées et envoyées SEULEMENT sur un compte professionnel (sinon on demande sur quel compte). Bouton « Envoyer la facture à l'acheteur » à côté de chaque vente d'un compte pro (absent sur sa vente Pro du jour) + **bon de retour** à côté de chaque vente pro. Retirer le pied d'e-mail « Cette facture vous est envoyée par VRM pour le compte de … » (« je veux pas de ce message »). | `claude/facture-siret` |
| **DJ2 Pas que des sneakers** | Première question de la configuration : « Sneakers ou autre chose ? » avec plein de propositions (vêtements, lunettes, sacs, montres, jeux vidéo, livres…) ; adapter tout le vocabulaire : plus d'allusion aux chaussures dans les suggestions de notes ; le N° « dit dans quel carton est l'article » est FAUX (étagère, bac, tiroir…) ⇒ « où est l'article » ; l'étape « Simple ou complet ? » n'est pas claire. | `claude/vendeur-generaliste` |
| **DJ3 Colis rangés à leur place** | « À expédier » dans **Ventes**, « À retirer » dans **Achats** (tout garder, seulement déplacer, jamais deux fois la même chose) ; logos des transporteurs = ceux des **bordereaux** (InPost / Mondial Relay : le logo imprimé sur le bordereau) ; se servir des codes de retrait lus dans les e-mails reçus par l'app partout où c'est utile. | `claude/colis-a-leur-place` |
| **DJ4 Stock juste** | Stock = seulement les paires **en ligne**, UNE seule fois si elle est sur plusieurs sites (par identité), pas de vieilles annonces. Inventaire physique, audit d'inventaire, « Répartir un lot » : pas fiables / inutiles ⇒ retirés de la vue (données gardées). « À trancher » : pas d'onglet exprès (le fondre dans Ma journée). Après une suppression, « Est-ce toujours chez toi ? » ⇒ proposer « L'enlever du stock ? » (parcours pensé de bout en bout) ; bug : le bouton « Annuler » reste affiché en permanence après cette suppression. | `claude/stock-juste` |
| **DJ5 Achats** | Proposition de relier un achat : pouvoir choisir UN AUTRE achat (aujourd'hui seulement « mettre un prix ») ; « Reçu » d'une annonce reliée OUVRE le reçu (visionneuse comme dans Achats), ne le télécharge pas ; « Achat hors brocante » à améliorer ; nouveaux logos (icônes) d'Annonces et de Ma journée. | `claude/achats-relier` |
| **DJ6 Profil** | Photo de profil = celle de Discord/Google si le compte est relié ; téléverser sa photo ; masquer son nom ; Paramètres caché derrière le profil (clic sur la photo ⇒ le menu) ; vérifier la connexion Discord (elle a créé un NOUVEAU compte avec l'adresse de Discord au lieu de relier le sien). | `claude/profil-photo` |
| **DJ7 Ventes à dater (1 756)** | Les dates de versement sont dans le porte-monnaie (relevé), parfois incomplètes quand l'acheteur paie avec son solde. « jsp comment faire si c'est vraiment important » ⇒ oui (CA déclaré daté au versement, §5) : mesurer le relevé et dater tout ce qui est PROUVÉ, le reste dit. | `claude/dates-versement` |
| **DJ8 Offres auto + republier** | Offres automatiques « tu peux faire mieux » ; étudier comment ne jamais se faire bannir (rythme, plafonds, signaux) ; Republier : la republication à la main au premier plan, parfaite. | `claude/offres-sures` |

En cours au même moment (lancés avant ce message) : bancs rouges A et B, audits rouges, textes
courts 5e série, extension 5.340 (journal du mode vacances, `sellerPrice` Vestiaire, avis datés).
