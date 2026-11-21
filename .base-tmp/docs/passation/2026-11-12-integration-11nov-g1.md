# Intégration 11nov-g1 — 14 lots réunis sur integration-11nov-f (12 nov. 2026)

Branche : `claude/integration-11nov-g1`, partie de `origin/claude/integration-11nov-f` (c4449d2e1).
Pas de PR ici (le coordinateur fusionne).

## Ce qui est réuni (vrais `git merge`, dans cet ordre)
1. `revue-colis` (76ad411ea, avec journee-perso) · 2. `thermique` · 3. `retours-litiges` · 4. `hors-ligne` ·
5. `gros-lot` · 6. `rangement-guide` · 7. `livre-registre` · 8. `anti-arnaque` · 9. `favoris-clair` ·
10. `prix-mini` · 11. `quoi-republier` · 12. `pas-en-ligne` · 13. `alertes-ebay` (+ `.github/workflows/alertes-ebay.yml`) ·
14. `ebay-rouges` (contient ebay-complet) · puis `origin/main` (f04d4a580, déjà inclus par F).

## Extension
Aucun des 14 lots ne touche `vinted-sync-extension/` (vérifié `git diff --stat`). `thermique` portait des zips
refaits d'une version plus ancienne : les zips 5.365.0 de F sont gardés. Version inchangée : **5.365.0**.

## Conflits et résolution (les deux intentions gardées)
- **Ma journée « À faire »** : une seule liste qui compte TOUTES les cartes des lots (photos-comptes, santé,
  avis négatif, « Commandes à vérifier », « Nouveaux favoris », « Quoi republier », « Achetés, pas en ligne »),
  dans `nParCarteAF` et `nGestesTout` ; feuilles avis, photos et pas-en-ligne gardées. journeePerso.js : union
  (banc journee-perso : 19 cartes attendues à l'éditeur au moment de revue-colis, voir bancs).
- **À trancher** : écran « Ventes » (Colis rangé dans Ventes, revue-colis) + vocabulaire du vendeur (F).
- **Hors ligne × DJ3** : vues hors ligne dédiées = Ma journée + Colis + Ventes + Achats (les codes au relais) ;
  le bandeau « Enregistré ✓ » (F) gardé, tu quand la pastille des gestes hors ligne dit déjà le nombre.
- **Achats** : « Un lot » (gros-lot) + hors ligne (N° au retour) + « Payé en » (livre-registre) ; hors ligne,
  pas de lot (ses N° viennent du serveur) ; `import { tr }` en double retiré.
- **N° servis** : gros-lot (`numerosServisRelus`) et rangement-guide (`numerosServisRangement`) lisaient deux
  listes presque égales ⇒ UNE lecture `numerosServisLus`, toutes les sources des deux (fiches neuves, achats
  hors plateforme, cases du Stock) ; l'aperçu du lot lit aussi les cases.
- **Offres auto (prix-mini) × vocabulaire-article** : textes par `tr` ; les clés qui nomment l'article ont une
  variante `.art` (5 langues), choisie par `tv` ; « Régler par {nom} » ouvre `cat_msg`.
- **Croisement vocabulaire** (audit S1 rouge, 25 textes « paire » de prix-mini, retours-litiges, livre-registre) :
  Retours `pap.….art` (5 langues), registre des achats (en-tête et nature au mot du vendeur, getter), Quoi de neuf
  neutre ; PERMIS seulement pour les variantes Sneakers et les clés `oa.paires.*`. `VOCAB_TOUT=1` liste tout.
- **Notifications** : onze familles (modération, avis, alertes d'achat eBay) ; Réglages « Comptes et avis » + « Achats ».
- eBay : guides + remises (F) ET calculette sur Achats (alertes-ebay) ; exports d'App.jsx : union.
- i18n (5 langues), nouveautes.js, audit-traduction, CLAUDE.md, historique-divers : union.

## Branchements demandés
**a) gros-lot ↔ rangement-guide** : le lot de N articles reçoit ses cases en série par la règle du rangement
guidé (`casesEnSerie` + `caseHabitude` : première case libre après la dernière rangée, empilement respecté).
Écran : « Ranger dans ces cases · A → B » (décochable), la case sous chaque article ; « Ajouter » rejoue la règle
(une suite qui a bougé ⇒ rien écrit, « décalé » dit) ; la fiche porte `case` + `rangeAt`, `vrm_slots` noté sous
son N°, dans le MÊME geste annulable. Un gros lot rangé compte comme dernier rangement (le dernier rang l'emporte
à la même heure). Preuves : audit-gros-lot 52 verts (9/9 mutations, dont `case-oubliee`, `case-hors-geste`) ;
audit-rangement-guide C2b + 2 mutations (14/14).

**b) Messages, lectures en double** : sonde (build non minifié, pile de chaque lecture) : « Lire mes messages
eBay » (POST `/api/ebay` action `messages`, Messages · Tous) vidait TOUT le partage ; ebay_orders, ebay_listings,
lbc_ventes, harvest_*_orders_sold repartaient. La route n'écrit que `ebay_messages{suffixe}` (+ `ebay_tokens*`,
illisible pour l'app) : `appelEbay` le déclare (`vrmEcritLignes`), `lecturesPartagees` et `memoEcritures` ne
vident que ce qui peut porter ces lignes (`lecturePeutPorterPrefixes`). Préfixe trop court, ou écriture vers la
BASE ⇒ comme avant. audit-lectures-partagees §13 + 2 mutations. `email_bordretour_*` (retours-litiges) : lecture
en vol partagée. Exception retirée de `scripts/budget-vitesse.json` ; Messages : 25 ⇒ 15 lectures en double.
Banc vitesse : les morceaux rangés EN FOND par le service worker du lot hors-ligne (`Sec-Fetch-Dest: empty`) ne
comptent plus dans le JS de l'ouverture (notés à part).

## Tests node
Les 3 rouges connus corrigés (le TEST ne servait plus la vraie forme) : journee-instantanee (phrase du lot
objectifs-mois), retraits-confirmes (clé de service du banc), lbc-persistance (bascule jouée sur `sbGetLbc`).

## Vérifications
Voir la fin du récit (chiffres de la passe complète).
