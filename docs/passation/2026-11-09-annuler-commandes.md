# Lot B — « Annuler » 5 s au lieu d'une confirmation + ⌘K qui agit — 9 nov. 2026

Branche `claude/annuler-commandes` (depuis `origin/main`). Validé par Julien : « fais
absolument tout » (propositions 2 et 3, `2026-11-09-propositions.md`, lot B de
`2026-11-09-file-des-lots.md`).

## Ce qui change pour lui

**1. Moins de « Tu es sûr ? »** — un geste qui ne touche que SES données dans VRM part tout
de suite ; la pilule sombre du bas (celle du 6 nov., `PiluleAnnulerCoque`) dit ce qui vient
d'être fait et offre **« Annuler »** 5 s. « Annuler » remet **exactement** l'état d'avant.
Tout ce qui part chez Vinted, Leboncoin, eBay, Vestiaire, une facture, un paiement, un N°
changé ou une suppression **garde sa confirmation** (§3 : supprimer passe toujours par son
clic confirmé). Dans le doute, la confirmation est restée.

**2. ⌘K qui agit** — la loupe (⌘K, Ctrl+K, « / », la loupe sur iPhone) propose aussi des
**Actions**, rendues comme ses lignes (même hauteur, ↑ ↓ Entrée) :

| ce qu'il tape | l'action | ce qu'elle ouvre (rien n'est écrit ni envoyé) |
|---|---|---|
| (champ vide) | Imprimer les bordereaux du jour · Colis à retirer · Exporter pour mon comptable · Ma configuration | — (sous les suggestions) |
| « imprimer », « impr », « bordereaux » | Imprimer les bordereaux du jour | Colis → À envoyer + la feuille « Tout imprimer » (il coche, puis « Imprimer » — qui demande toujours sa confirmation) |
| « colis », « retirer », « colis à retirer » | Colis à envoyer / Colis à retirer | Colis sur l'onglet |
| « export », « comptable » | Exporter pour mon comptable | Compta, la carte montrée (repli ouvert, défilée, « Préparer » au focus) — rien n'est lu avant « Préparer » |
| « ma config », « statut » | Ma configuration | la configuration plein écran |
| « journée », « achats », « réglages » | Ma journée / Mes achats / Réglages | l'onglet |
| « baisser le prix de 88 », « prix 88 » | Baisser le prix de N°88 | la feuille du prix (`PrixPartout`) — rien ne part avant « Appliquer » |
| « ouvrir 124 » | Ouvrir N°124 | la fiche de la paire |
| « stock 12 » | Voir N°12 au Stock | le Stock, le N° cherché |
| « 88 » seul | Baisser le prix · Voir au Stock | APRÈS « Tout sur le N° » (qui reste la 1re ligne : Entrée ouvre toujours la fiche) |

Un titre, une taille, une marque (« nike dunk », « nike 42 ») ne proposent **aucune**
action : la recherche reste la recherche. Une action à N° n'apparaît jamais sans N°.

## Les confirmations : remplacées / gardées (inventaire du 9 nov.)

La règle et cet inventaire vivent aussi dans `src/annulerCommandes.js` (`CONFIRMATIONS`).

### Remplacées par « Annuler » 5 s (réversibles dans VRM, état d'avant exact)

| geste | où | ce qui est écrit / remis |
|---|---|---|
| Masquer cet achat | Achats → « … » | une entrée de `vinted_purchases_hidden` ; annulé ⇒ retirée, l'achat revient à SA place (liste et cache) |
| Marquer cet article vendu | Annonces → « … » de la vignette | une entrée de `vinted_annonces_vendues` (rien chez Vinted, l'extension ne la lit pas) |
| Réafficher les annonces marquées vendues | Annonces (bandeau) | les mêmes entrées, retirées ; annulé ⇒ remises |
| Délier une annonce Leboncoin (« Pas le bon article », « Délier ») | Leboncoin | `vrm_lbc_liens[id]` posé à `''` ; annulé ⇒ le MÊME N° revient (avant : `window.confirm`) |
| Délier un N° d'un achat en gros | Achats → Fournisseurs | les champs `buyGros` (+ `buyPrice` posé par l'achat) de SA fiche ; annulé ⇒ les champs d'avant (`champsAvant`), le N° jamais touché |
| Masquer ce bordereau | Colis | une entrée de `vinted_bords_hidden` — ⚠️ le bouton n'est plus affiché dans le design actuel (`design/fusion.css` le cache) : converti quand même |
| Marquer TOUS ces colis récupérés | Ma tournée | les entrées de `vrm_colis_collected` (pas de date, comme avant) — ⚠️ la feuille « Ma tournée » n'est plus ouverte nulle part (aucun `setTourneeOpen(true)`) : converti quand même |
| Relier un achat à une paire (n'avait pas de confirmation) | Achats à relier | son message devient la pilule « Annuler » (champs d'avant de CETTE fiche) |

Déjà annulables depuis le 6 nov. (rien à faire) : « J'ai retiré », « Remettre », « Déposé »,
« Marquer imprimé », « Colis fait » (Leboncoin, Vestiaire), « C'est écrit », « Déjà remise
en vente », « Plus tard ».

### Gardées

| geste | pourquoi |
|---|---|
| Vinted : accepter / refuser une offre, autoriser un nouvel envoi, acceptation auto, favoris, republier, brouillon, mise en ligne, couleur d'un brouillon | part chez Vinted (§3) |
| eBay : publier, modifier prix/stock/texte, supprimer, règle d'offre, programmer, remettre en vente, baisser le prix, déconnecter | part chez eBay, sans retour |
| Leboncoin : supprimer, relancer le dépôt, ouvrir N ventes | part chez Leboncoin |
| Vestiaire : « déjà publiée » (commande `vcMarque` à l'extension), clé Photoroom | passe par l'extension / efface une clé |
| Factures Pro : envoyer, renvoyer, annuler (avoir), déconnecter la boîte | e-mail parti, numérotation légale |
| Réglages : résilier, changer d'offre, se déconnecter partout, déconnecter un appareil, Discord, équipe, adresses e-mail, début de l'import | paiement, sessions, accès d'un tiers |
| Impression : vérifier avant impression, tamponner le bordereau téléchargé | un bordereau imprimé part sur un carton |
| N° : déjà servi, nouveau N°, N° porté par un autre, donner un N° libre, reprendre un ancien N°, remise en ligne « même paire », Vestiaire « Un seul N° » / défaire, remettre en stock (retour) | §5 : un N° s'écrit sur un carton, jamais « annulé » en silence |
| Déclarer perdu, « n'est plus chez toi », « je m'en sépare », « tous chez moi » | sort la paire du stock (vide sa case) ; Ma journée = lot A d'un autre agent |
| Supprimer : fiche neuve, achat hors plateforme, dépense, vente saisie, brouillon eBay, modèle, meuble, pièce, article d'inventaire ; vider une grille | destructif — la corbeille 30 jours est le lot Y |
| Prix d'achat en série : valider N prix, répartir un lot, annuler une répartition, poser N prix, remplacer un prix saisi, retirer un fournisseur / un achat en gros, prix mini | plusieurs prix d'un coup : il relit la liste (il les saisit lui-même, §2.5) |
| Stock : retirer un N° d'une case, libérer une case | le plan a sa propre ligne et sa relecture (`planLu`), pas la file du geste — à faire avec le lot X |
| Importer / restaurer une sauvegarde | remplace des données entières |

## Le code

| fichier | quoi |
|---|---|
| `src/annulerCommandes.js` (nouveau, pur) | `champsAvant`, `CONFIRMATIONS`, `ACTIONS_RECHERCHE`, `actionsPour`, `numeroDansRequete`, `destinationAction`, `DEMANDE_COMMANDE` |
| `src/App.jsx` | `masquerAchat`, `hideBord`, `markAllCollected`, `gesteVendues` (remplace `markSold`/`unmarkSold`), délier gros, relier un achat → `gesteVrm` ; loupe : `actionsGs`, `ligneAction`, `blocActions`, `lancerActionRecherche` ; Colis : écoute `vrm:tout-imprimer` (la feuille « Tout imprimer » quand Colis est déjà ouvert) ; `data-achat-masquer` |
| `src/ecrans/Leboncoin.jsx` | `gesteDelierLbc` (remplace `delierAnnonceLbc` et ses deux `window.confirm`) |
| `src/ecrans/Compta.jsx` | `ComptaPro` montre la carte d'export à la demande (`DEMANDE_COMMANDE.export`, `vrm:export-comptable`) |
| `scripts/bancs/double-vente.cjs` | n'attend plus de `dialog` pour délier |

## Preuves

- `node scripts/audit-annuler-commandes.cjs` : 38/38 (le VRAI module : actions, N°, rien
  pour un titre ; `champsAvant` + `appliquerOp` ⇒ état exact ; confirmations remplacées
  absentes et branchées sur `gesteVrm` ; 11 confirmations extérieures/irréversibles
  toujours là ; `lancerActionRecherche` sans save/vmrCmd/fetch/impression).
- Banc `scripts/bancs/annuler-commandes.cjs` (390 tactile et 1512) — voir le résultat
  et les mutations dans le rapport de la session (section suivante).
- `npm run build`, audits variables, tdz, coherence, identite, statuts, icones,
  geste-annulable verts.

## Geste de Julien

Aucun. Essayer : Annonces → « … » d'une vignette → « Marquer vendue », puis « Annuler » ;
⌘K puis « imprimer » et Entrée ; ⌘K puis « baisser le prix de 88 ».
