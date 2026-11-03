# Parité Vinted → Vestiaire, Leboncoin, eBay (3 novembre)

Julien (3 nov., 10 h 05) : « tout ce qui est fait pour Vinted doit être fait pour le reste
des apps ». Une ligne par fonction que VRM a pour Vinted ; pour chaque autre site :
**fait** · **partiel** (ce qui manque est dit) · **manque** · **impossible** (raison
technique ou règle §3) · **en cours** (une autre branche le livre — ne pas le refaire ici).
Sources : CLAUDE.md §3/§8/§9 et les historiques des plateformes, au 3 nov. après la fusion
de `origin/main` (Fusion, carte réglable, notifications, cycle d'un article, favoris,
compta-outils, messages Vestiaire 5.317.0).

| fonction (Vinted) | Vestiaire | Leboncoin | eBay |
|---|---|---|---|
| **Comptes liés** (liste, état, photo, dans les totaux) | **fait** (3 nov., cette branche ; compte « non identifié » tant que `/users/me` n'est pas lu) | **fait** (3 nov., cette branche) | **fait** (3 nov., cette branche ; Relire/Délier/Relier) |
| **Comptes sélectionnés ⇒ CA / URSSAF / bénéfice / bilan** | **fait** (3 nov., `vrm_comptes_exclus`) | **fait** (idem) | **fait** (idem ; avant : seulement en déconnectant) |
| Annonces en ligne (liste complète qui fait foi, « à confirmer » > 24 h) | **fait** (5.296–5.315, `lotComplet`, fiches) | **fait** (5.288–5.299, liste complète) | **fait** (lecture serveur, relue toute seule) |
| Ventes (liste, étape, montant) | **fait** (5.316, `sellerEarning` ; e-mail de vente lu) | **fait** (`lbc_ventes`, date de vente) | **fait** (commandes, `montantRecuEbay`) |
| Preuve de vente (jamais déduite d'une absence) | **fait** (vente lue par `productId`) | **fait** (`isSeller`, transaction) | **fait** (commande PAID engagée) |
| Colis à expédier + date limite | **fait** (`colisVcAPoster`, limite e-mail) | **fait** (`colisLbcAPoster`) | **fait** (`colisEbay`) |
| Bordereau + impression tamponnée N° | **fait** (PDF rapatrié 5.316, tampon) | **fait** (5.136, tampon) | **partiel** : l'étiquette est achetée/imprimée chez eBay par l'acheteur-payeur (§2.8) ; VRM n'imprime pas l'étiquette eBay — à mesurer : PDF d'étiquette lisible par l'API ? |
| Tampon « fiche colis » toujours possible | **fait** (`tamponnerBordereau`, 3 nov.) | **fait** (même chemin) | **manque** (pas de PDF d'étiquette chez VRM, voir ligne précédente) |
| Codes de retrait (achats au relais) | **partiel** : achats lus (5.239) ; code de retrait seulement par les e-mails transporteur | **partiel** : idem (e-mails transporteur) | **impossible** en général (eBay livre à domicile ; un retrait relais passe par l'e-mail transporteur, déjà lu) |
| Achats (liste, suivi) | **fait** (5.239) | **fait** (`LigneAchatLbc`) | **fait** (eBay → Achats, recherche et fil) |
| Messages (lire) | **fait** (5.317, Stream) | **partiel** : nombre de non-lus seulement (Leboncoin ne charge le fil que dans sa page) | **fait** (`ebay_messages`, résumé) |
| Messages (répondre depuis VRM) | **impossible** aujourd'hui (Stream non rejouable, 5.317) | **manque** — à mesurer (route d'envoi Leboncoin jamais vue) | **partiel** (agent eBay qui DEMANDE ; pas de réponse libre) |
| Offres (accepter/refuser sur son clic) | **manque** — aucune route d'offre Vestiaire vue | **impossible** (Leboncoin n'a pas d'offre structurée) | **fait** (seuil natif eBay sur son clic ; §3) |
| Acceptation automatique d'offres | **impossible** (§3 : forme Vinted seulement ; rien à rejouer) | **impossible** | **fait sous UNE forme** (seuil natif eBay, §3) |
| Favoris (qui ; écrire aux favoris) | **impossible** : Vestiaire ne dit pas QUI (nombre seulement, 5.295) | **impossible** : nombre seulement (§3) | **manque** : « observateurs » eBay lisibles en nombre ; offre aux observateurs déjà faite (règle d'offre) ⇒ **partiel** |
| Republier (atelier sur son clic) | **manque** — forme d'envoi Vestiaire jamais apprise | **fait** (29 oct., Republier Leboncoin) | **partiel** : « Remettre en vente » des inactives (lien), pas d'atelier |
| Supprimer sur son clic, confirmé | **manque** (aucune route vue) | **fait** (5.291, `lbcsupprime`) | **fait** (retrait d'annonce, confirmé ; retrait auto sur vente PROUVÉE ailleurs) |
| Un N° de rangement par annonce | **fait** (`vrm_vc_numeros`, 2 nov.) | **fait** (réf. `VRM-{n°}` / lien posé à la main) | **fait** (SKU `VRM-{n°}`) |
| Double vente (vendue ici ⇒ à retirer ailleurs) | **fait** (« Vestiaire partout », 1er nov.) | **fait** (5.152 + `retraitAilleurs`, 3 nov.) | **fait** (retrait eBay auto par identité, 3 nov.) |
| Cycle d'un article (supprimé sans vente ⇒ carte) | **manque** (Vinted seulement, `src/cycleArticle.js`) | **partiel** (« plus vue sur Leboncoin », pas la carte de décision) | **partiel** (inactives, pas la carte) |
| Propositions « mettre aussi sur … » | **en cours** (`claude/cycle-article` : « chez moi » vers Leboncoin = extension 5.318) | **en cours** (idem) | **fait** (`src/propositionsSites.js`) |
| CA / URSSAF / bénéfice | **fait** (montant sûr seulement, sinon nommé) | **fait** (date de vente ; datée à la main) | **fait** (argent reçu, autre devise écartée) |
| Prix d'achat proposé par identité | **fait** (`src/prixAchatPropose.js`, toutes ventes) | **fait** | **fait** |
| Flou par compte (compte ouvert mis en avant) | **fait** (5.296 ; dépend de `vc_session`) | **fait** (31 oct.) | **fait autrement** (sélecteur de compte eBay) |
| Notifications (vente, colis, retrait) | **partiel** : colis/retrait par e-mails ; vente Vestiaire par e-mail seulement quand la règle iCloud transfère | **partiel** : idem | **partiel** : vente eBay relue par le serveur — à vérifier qu'elle sonne |
| Widget iPhone (colis, vendu) | **fait** (`colis-sites`, `widget_stats` toutes plateformes) | **fait** | **fait** |
| Ma journée (à faire, colis, chiffres) | **fait** (chiffres et colis) ; photos : **en cours** (`claude/journee-photos`) | **fait** ; photos **en cours** | **fait** ; photos **en cours** |
| Colis : 3 onglets toutes plateformes | **en cours** (`claude/journee-photos`) | **en cours** | **en cours** |
| Carte sombre réglable par page | **fait** (`CarteStats`, suit le site) | **fait** | **fait** |
| Frise Vendue → Postée → Livrée → Payée | **manque** (Vinted seulement ; « Reste : frise eBay/Vestiaire ») | **manque** | **manque** |
| Statut chez le transporteur | **fait** (n° de suivi lu, même lecture serveur) | **fait** | **partiel** (suivi eBay, transporteur parfois pas lu) |
| Style « Fusion » | **en cours** (`claude/fusion-app`) | **en cours** | **en cours** |
| Messages Vestiaire | **en cours / fait** (`claude/vc-messages` fusionnée en 5.317) | — | — |

## Ordre retenu pour la suite (argent et colis d'abord, faisable et sûr)
1. **Frise Vendue → Postée → Livrée → Payée** pour Leboncoin, Vestiaire et eBay : les étapes
   existent déjà PROUVÉES dans chaque règle (`etapeVenteVc`, `stepStatus`/`parcelColor`,
   `etatCommandeEbay`) — seulement les relier à `friseVente`.
2. **Cycle d'un article** pour Leboncoin et Vestiaire : la carte de décision quand une annonce
   VUE en ligne disparaît d'une liste COMPLÈTE sans vente prouvée (même règle que Vinted).
3. **Notifications de vente eBay** : vérifier que la relecture serveur pousse « vente ».
4. À mesurer avant tout code (rien n'a jamais été vu) : envoi de message Leboncoin, offres
   Vestiaire, suppression Vestiaire, étiquette eBay en PDF.
