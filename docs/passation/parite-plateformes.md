# Parité Vinted → Leboncoin, eBay, Vestiaire — état mesuré dans le code (11 nov.)

Julien (3 nov.) : « tout ce qui est fait pour Vinted doit être fait pour le reste des apps ».
Le 11 nov., chaque ligne a été **remesurée dans le code** (`src/App.jsx`, `src/ecrans/*`,
`api/*`, `vinted-sync-extension/`), pas recopiée. **fait** · **partiel** (ce qui manque est
dit) · **manque** (faisable, pas fait) · **impossible** (raison : la plateforme ne donne pas
l'information, ou règle §3). Les cases marquées ★ ont été comblées le 11 nov. (récit :
`2026-11-11-parite-plateformes.md`, audit `audit-parite-plateformes.cjs`, banc
`bancs/parite-plateformes.cjs`).

| fonction | Vinted | Leboncoin | eBay | Vestiaire |
|---|---|---|---|---|
| Ventes lues (liste, montant) | fait | fait (`lbc_ventes`, prix en centimes) | fait (commandes, `montantRecuEbay`) | fait (`vc_ventes`, `montantRecuVc` ; montant pas sûr ⇒ dit) |
| « Vendue » prouvée (jamais par absence) | fait (`<preuve-vente-regle>`) | fait (`isSeller` + transaction) | fait (commande PAID engagée) | fait (vente lue par id) |
| Annonces en ligne (lecture complète qui fait foi) | fait | fait (5.288+) | fait (lecture serveur) | fait (5.296+) |
| Date de vente | fait | fait (relevée, ou datée à la main `vrm_lbc_dates`) | fait (`creationDate`) | fait (`dateVenteVc`) |
| Date de versement (CA déclaré) | fait (transaction 450 ; 5.341 accélère) | **impossible** : Leboncoin n'en donne pas ⇒ date de vente (règle §5) | **impossible** : pas de date de versement lue ⇒ date de commande | fait (`dateVersementVc`) |
| Colis à expédier : nombre (Ma journée, cloche, widget, rappels) | fait | fait (`colisLbcAPoster`) — sans date limite (Leboncoin n'en donne pas : jamais « en retard ») | fait | fait |
| Colis : récapitulatif « au moins » si une source n'est pas lue | fait | ★ fait (avant : eBay seul) | fait | ★ fait |
| Filtre « Leboncoin » de Colis | — | fait autrement : ouvre l'écran Colis Leboncoin (bordereau, QR) | fait | fait |
| Bordereau + impression tamponnée N° | fait | fait (5.136) | **impossible** : l'étiquette est achetée chez eBay par l'acheteur (§2.8), VRM n'a pas de PDF | fait (5.316) |
| Codes de retrait (achats au relais) | fait | partiel : seulement par l'e-mail/SMS du transporteur (la transaction n'a ni point ni code) | **impossible** en général (livraison à domicile ; un relais passe par l'e-mail transporteur, déjà lu) | partiel : e-mail transporteur seulement |
| Messages : lire | fait | fait (5.318, `lbcfil`) | fait (`GetMyMessages`) | fait (5.317, Stream) |
| Messages : répondre sur son clic | fait | fait après une recette APPRISE (`lbcrepondre`) | fait (`AddMemberMessageRTQ`) | fait après recette apprise (`vcrepondre`) |
| Offres : répondre sur son clic | fait | **impossible** : Leboncoin n'a pas d'offre structurée | fait (`RespondToBestOffer`) | fait après recette apprise (5.319) |
| Acceptation automatique d'offres | fait (éteint par défaut, §3) | impossible | fait sous UNE forme (seuil natif eBay, §3) | **impossible** (§3 : forme Vinted seulement) |
| Favoris : qui | fait | **impossible** (nombre seulement) | **impossible** (observateurs en nombre) | **impossible** (nombre seulement, 5.295) |
| Facture Pro | fait | fait (compte dit pro) | fait (compte dit pro) | fait (5.340, prix de vente lu) |
| CA déclaré / URSSAF / DAC7 | fait | fait | fait | fait |
| Comptes écartés hors des totaux | fait | fait — ★ y compris « Finalisé par plateforme » (il les comptait encore) | ★ idem | ★ idem |
| Statistiques : vendu, semaines, comparer les mois, marge et frais par plateforme | fait | fait | fait | fait |
| Statistiques : « CA entre deux dates » | fait | ★ fait (avant : Vinted seul, écrit « Vinted, tous comptes ») | ★ fait | ★ fait (montant pas sûr : dit hors total) |
| Statistiques : temps pour vendre, ce qui part vite, rotation | fait | **manque** : la date de mise en ligne Leboncoin est captée (`publieeLe`) mais jamais lue par l'app | partiel : `StartTime` lu côté serveur seulement | **impossible** aujourd'hui : aucune date de mise en ligne relevée |
| Statistiques : « Finalisé sur Vinted », moyennes, CA par compte | fait | — (cartes Vinted, titrées « Vinted » : c'est vrai) | — | — |
| Export comptable (Compta → « Exporter pour mon comptable », livre des recettes, e-reporting, DAC7) | fait | fait | fait | fait |
| Rapport du mois et registre annuel (Ventes) : prix d'achat, N°, marge | fait | ★ fait, par identité (`autresBenefice`, id `lbc:`) ; avant : vides | ★ fait (id `ebay:`) | ★ fait (id `vestiaire:`) ; « sources non lues » nomme Vestiaire ★ |
| Tableur « comptabilite-ventes.csv » | fait | ★ fait (ventes finalisées, colonne Plateforme) | ★ fait | ★ fait |
| Objectif du mois | fait | fait (`ventesFaites`) | fait | fait |
| Bilan semaine / mois (e-mail), Ma semaine | fait | fait | fait | fait |
| Notification « vendu » | fait (e-mail de vente) | **manque** : aucun e-mail de vente Leboncoin appris (`email-inbound.js`) | **manque** : la relecture serveur des commandes ne sonne pas | fait (e-mail de vente) |
| Frise d'une vente | fait (7 étapes prouvées, `FriseVente.jsx`) | partiel (4 étapes, `friseVenteLue`) | partiel (4 étapes ; « Livrée » jamais cochée seule) | partiel (4 étapes) |
| N° écrit dans la description | fait (lu et appliqué, « Prendre / Garder ») | partiel : aperçu dans Réglages seulement (réf + description + titre) | fait autrement (SKU `VRM-{n°}`) ; aperçu seulement | partiel : aperçu, titre seulement |
| Cycle d'un article (supprimé sans vente ⇒ carte) | fait | **manque** | **manque** | **manque** |
| Republier (atelier sur son clic) | fait | fait | partiel (remise en vente des inactives) | **manque** (forme d'envoi jamais apprise) |
| Supprimer sur son clic, confirmé | refusé en automatique (§3) | fait (5.291) | fait | **manque** (aucune route vue) |
| Un N° de rangement par annonce, double vente | fait | fait | fait | fait |
| Widget iPhone | fait | fait | fait | fait |

## Ce qui reste, par valeur pour un vendeur (faisable sans rien inventer)
1. **Notification « vendu » eBay** : la relecture serveur (`api/ebay.js`) voit les commandes neuves ;
   il faut une mémoire « déjà annoncée » par commande (une ligne serveur) avant de pousser.
2. **Temps pour vendre Leboncoin** : `publieeLe` est déjà rangé par l'extension
   (background.js) — l'app ne le lit pas ; relier la vente à SON annonce par identité (`itemId`).
3. **Frise complète** Leboncoin/eBay/Vestiaire : les étapes prouvées existent
   (`etapeVenteVc`, `parcelColor`, `etatCommandeEbay`) ; eBay « Livrée » demande le suivi lu.
4. **Cycle d'un article** Leboncoin/Vestiaire : même règle que Vinted (liste COMPLÈTE, vente non prouvée).
5. À mesurer avant tout code : suppression Vestiaire, republication Vestiaire, e-mail de vente Leboncoin.

## Ce qui est impossible, et où l'écran le dit
- Date de versement Leboncoin/eBay : le CA déclaré prend la date de vente (Leboncoin) ou de commande (eBay), règle §5 ; une vente Leboncoin sans date est dite dans « Déclarer » avec son geste (« à la main », `src/versementRaisons.js`).
- Bordereau eBay : Colis le dit sur la ligne (« L’étiquette se prend dans eBay, prépayée par le port de l’acheteur », lien vers la commande).
- Favoris « qui » : Leboncoin → Messages dit « Leboncoin donne le nombre de favoris, jamais qui : VRM n'écrit à personne » ; Vestiaire montre le nombre par annonce (`vcfavoris`).
- Offres Leboncoin : il n'y en a pas (rien à afficher).
- Date limite d'envoi Leboncoin : jamais « en retard » (rien de lu ⇒ aucune date dite).

---

# Archive : l'état du 3 novembre (tel quel)

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
