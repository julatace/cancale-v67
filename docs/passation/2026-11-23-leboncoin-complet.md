# 23 nov. 2026 — Leboncoin : le panneau montre tout (branche `claude/leboncoin-complet`, extension 5.445.0)

Demande de Julien : « pareil pour Leboncoin » (= ce qu'il a demandé pour Vestiaire : où sont les infos à capter, où
envoyer des messages, les favoris ; « le panneau de l'extension n'affiche rien et ne marche pas » ; les achats pour
toutes les plateformes ; les statuts des colis ; « tout doit être irréprochable »).

Sources lues : CLAUDE.md (§3 garde-fous, « Leboncoin : il ne dit pas QUI a mis en favori, VRM n'écrit à personne »,
suppression automatique refusée ; §5 identité ; §8 lignes lbc*), `historique-leboncoin.md`, `2026-11-21-lbc-interface.md`,
`2026-11-20-lbc-vc-interesses.md`, le plan Leboncoin §1.3 de `2026-11-23-plateformes-repub-favoris.md` (branche plat-rf).
Base lue en LECTURE seule (projections scalaires, aucune valeur personnelle recopiée ici) ; journaux d'API Supabase.

⚠️ Les fichiers `captures-julien/lbc-1.jpg … lbc-10.jpg` reçus sont OCTET POUR OCTET les captures Vestiaire
(`vc-5 … vc-14`, mêmes empreintes md5). Le constat Leboncoin ci-dessous vient de la description du coordinateur
(pages, textes du panneau, toasts) et de la base.

## 1. Diagnostic — la cause exacte du panneau « vide » sur leboncoin.fr

1. **Le panneau s'ouvre bien** sur leboncoin.fr (`vrm-badge.js` est dans le bloc `*.leboncoin.fr` du manifeste depuis la
   5.43x ; le constat « injecté sur Vinted seulement » du plan plat-rf est périmé).
2. **La capture marche** (mesuré le 23 nov., 12:51–12:53 UTC) : `lbc_listings` réécrite (9 annonces du compte de l'onglet
   relues aujourd'hui), `lbc_ventes` (16 transactions), `lbc_accounts` (compte privé prouvé `membre-prive-v1`),
   `lbc_messages` (non-lus), un `lbc_fil_*`.
3. **Le fond répondait** : les journaux d'API montrent, à chaque ouverture du panneau Leboncoin, la suite complète de
   `carteListesSite` (lbc_listings → lbc_ventes → lbc_fil_* → lbc_messages → capte_journal → vrm_capte_vu → baisse →
   retraits), toutes en 200.
4. **Cause** : `carteListesSite` rendait, tant que le compte de l'onglet n'était pas encore reconnu (la page n'a pas
   encore chargé `members/me/account`) ou sans session, `{ ok, plateforme, compte: null }` — **sans `annonces`, `ventes`,
   `messages`, `notifications`**. Le panneau prenait cette réponse pour une liste lue : `annonces` absentes ⇒ « Tes
   annonces n'ont pas pu être lues », `ventes` ⇒ « Tes ventes n'ont pas pu être lues », `messages` ⇒ « Sur Leboncoin,
   tes messages sont dans les pages du site », `notifications` ⇒ « Le journal n'a pas pu être lu » — et la **gardait 60 s**
   (`chargerListes` non forcé), même après la reconnaissance du compte quelques secondes plus tard. Même chose si la
   lecture levait (`pasDeListe`).
5. **Le bandeau « Ouvre « Mes transactions » »** : `resumeCarteLbc` ne regardait que la réception de CET onglet
   (`vrmLbcTransport[tab].receptions.transactions`) ; les ventes lues dans un autre onglet (« 12 ventes lues ») ne
   comptaient pas, et le panneau posait ce geste dans `extras` de **chaque** écran.
6. **Défauts de données trouvés en plus** (sur la vraie forme de `lbc_ventes`) :
   - la ligne mêle **ventes (`isSeller: true`, 3) et ACHATS (`false`, 7)** ; 6 lignes de la liste v3 n'ont pas de sens.
     Le panneau montrait tout en « ventes » ;
   - l'état venait de `stepStatus` seul : `validation` ⇒ « Action requise : à expédier », alors que ces ventes sont
     livrées et payées (`parcelColor: finished`, « Paiement effectué ») ;
   - `price` est en **centimes** (5800 pour 58 €, comme `lbcEuro` de l'app) : le panneau affichait 5 800 € ;
   - aucun transporteur, aucun n° de suivi (pourtant rangés : `deliveryLabel`, `label.reference`, `label.trackingUrl`).
7. Messagerie : seuls le compteur de non-lus et les fils OUVERTS étaient rangés ; la liste des conversations
   (`messaging-items-api/v3/conversations`, forme mesurée dans `lbc_recon.schemas`) ne l'était pas.
8. Porte-monnaie : `ewallet-account-public-api/v1/ewallet` est demandé par la page (forme mesurée : `{available,
   incoming}`), jamais rangé. **L'unité n'est pas mesurée** (seul un solde à 0 a été vu).
9. Favoris : `stats` n'a jamais été relevé en production (0 annonce sur 194) ; `myads` ne porte ni vues ni favoris
   (schéma mesuré) — seule la page « Statistiques » d'une annonce les donne.

## 2. Ce qui est fait (extension 5.445.0)

| pièce | fichier |
|---|---|
| `<lbc-tx-regle>` : `lbcTxAnnulee` / `lbcTxFinalisee` / `lbcTxExpediee` recopiées de l'app ; `txLbcPanneau` (sens par `isSeller` seulement, état, prix en centimes ⇒ euros, transporteur, n° de suivi = `label.reference`, adresse de suivi chez un transporteur connu seulement, lien vers la transaction) | `background.js` |
| `carteListesSite` Leboncoin : `ventes` (isSeller true) · `achats` (false) · `inconnues` (sens pas su, comptées à part) ; `attente: 'vrm' | 'compte' | 'erreur'` sur chaque sortie anticipée ; messages = `lbc_conversations` de CE compte + fils ouverts ; `porteMonnaie` de CE compte (`jamais` si jamais lu) ; vues/favoris en nombres (`stats`) | `background.js` |
| capture passive : liste des conversations (`lbcconvs` : conversation, article, titre, photo, aperçu, date, non-lus ; JAMAIS `partners[].name`) et porte-monnaie (`lbcporte` : deux nombres) ; rangées par compte (`lbc_conversations`, `lbc_porte_monnaie`) pour le compte de L'ONGLET (session privée, pas ambigu ; les conversations : aussi `metadata.current_user` et un de SES comptes), lire-fusionner-réécrire, lecture ratée ⇒ rien écrit | `lbc-inject.js`, `lbc-relay.js`, `background.js` (`rangerLbcConversations`, `rangerLbcPorteMonnaie`) |
| « Mes transactions » lue notée PAR COMPTE (`vrmLbcTxLu`) : un autre onglet du même compte ne redemande plus le geste | `background.js` (`noterReceptionLbc`, `resumeCarteLbc`) |
| panneau : une réponse `attente` est redemandée seule (4 s, 8 fois) et dite (« Je reconnais ton compte Leboncoin… », puis « recharge la page »), « Réessayer » ; le geste de la carte sur l'Accueil seulement, et tu quand ses ventes/achats sont rangés ; Commandes = **Ventes · Achats** (état, transporteur + n° de suivi, « Suivre le colis », « Voir sur Leboncoin ») ; Accueil : porte-monnaie (0 ⇒ « 0,00 € », autre ⇒ « Lu, à vérifier sur Leboncoin »), tuile « Achats en cours » ; Favoris : le NOMBRE par annonce + « Baisser le prix » (la baisse gardée de toujours), « Baisser le prix ne prévient personne d'office » | `vrm-badge.js`, `vrm-ui.js` (5 langues) |
| version 5.445.0 : `CODE_VERSION`, manifeste, `CAPTEUR_VERSION`, relais, `EXT_ATTENDUE`, `public/extension-version.json` ; capacités `lbcpanneau` (`txLbcPanneau`), `lbcconvs` (`rangerLbcConversations`), `lbcporte` (`rangerLbcPorteMonnaie`) | `src/App.jsx`, `scripts/audit-coherence.cjs` |
| Quoi de neuf `lbc-panneau` | `src/nouveautes.js` |

App : les achats Leboncoin existaient déjà (`AchatsSiteLeboncoin`, `etapeAchatLbc` : Annulé · Reçu · En transit · Payé,
sur la même règle) — rien à changer.

## 3. Pas fait — et pourquoi

- **Republier sur Leboncoin (supprimer puis recréer)** : NON livré. Mesuré : `lbc_publiees` (l'identité « annonce créée
  par VRM ↔ paire source ») **n'existe pas** dans sa base ; aucune de ses annonces Leboncoin n'est reliée par identité à
  une fiche VRM. `publierDepuisApp` (`lbcPublier`) recrée depuis la fiche d'une paire VRM, pas depuis l'annonce
  Leboncoin : sans source prouvée, « la même fiche » n'est pas garantie — et la suppression est irréversible. Il faut
  d'abord (a) une source prouvée par annonce (`lbc_publiees`, ou le N° écrit lu `numEcrit` ⇒ la paire, à décider avec
  Julien — c'est une identité §5 mais la fiche VRM peut différer de l'annonce Leboncoin), (b) l'orchestration du plan
  §1.3 (fiche relue avant, une à la fois, supprimer → 15–40 s → recréer → relire, « à remettre » si la recréation est
  refusée) avec son audit sur le vrai `background.js`. Ce lot ne supprime rien de plus qu'avant.
- Vues/favoris : affichés dès qu'ils sont relevés ; aujourd'hui « — » (geste : ouvrir « Statistiques » d'une annonce).
- Porte-monnaie non nul : jamais converti tant que l'unité n'est pas mesurée (un passage avec un solde non nul suffit :
  comparer le nombre rangé à « Solde disponible » de la page).
- Date limite d'envoi d'une vente Leboncoin : aucune source lue (« — »).

## 4. Preuves

- `scripts/audit-lbc-panneau.cjs` (vrai `background.js` sur `_fond-vm.cjs` + la vraie règle de l'app) : **29 ✅** ;
  `--prouve` : **origin/main ⇒ 18 ❌** ; 9 mutations (sens deviné, finalisée ignorée, prix pas converti, suivi chez
  n'importe qui, attente muette, conversation d'un autre compte rangée, lecture ratée qui écrit, geste par onglet
  seulement, règle d'annulation divergente) ⇒ chacune 1–2 ❌.
  R (630 cas, même verdict que l'app), V (ventes/achats/sens inconnu, livrée ≠ à expédier, centimes, suivi, autre
  compte), A (attente compte / vrm), M (conversations et porte-monnaie de CE compte, aucun nom), C (capture : compte de
  l'onglet seulement, autre compte gardé, aucun nom, lecture ratée n'écrit rien, onglet ambigu), G (geste tu après une
  lecture ailleurs). `--prouve` : voir ÉTAT À LA REPRISE.
- `scripts/bancs/lbc-panneau.cjs` (vrais vrm-ui.js + vrm-badge.js, fausse page leboncoin.fr, 1512 puis 390) : P1–P6 —
  **26 ✅** (13 par largeur) ; sur l'extension d'origin/main **20 ❌** (le symptôme de Julien reproduit : « Tes annonces
  n'ont pas pu être lues », « Ouvre « Mes transactions » » sur Messagerie). Captures regardées (Commandes, Achats,
  Favoris, Accueil, Messagerie, Articles ; 1512 et 390). TMPDIR court obligatoire (chemin de socket de Chromium).
- Build OK. Passe complète (`lancer-audits`, 832 audits) : 32 rouges, tous rouges aussi dans les passes d'autres
  branches du jour (`sa-audits`, `aoc-audits`) — aucun nouveau.
- Audits portés sur la règle : `audit-panneau-carte` F (une vente se prouve par `isSeller` ; la vente de l'autre compte
  l'est aussi, seul le compte l'écarte), `audit-relais-lbc-kinds` (exemples `lbcconvs`, `lbcporte`).
- Verts : coherence, discretion, ext-contrat-messages, extension-moyennes, lbc-clair, lbc-details, lbc-interface,
  lbc-mes-annonces, lbc-messages, lbc-restes, lbc-session, lbc-ventes, lecture-bornee, lectures-partagees,
  panneau-carte, relais-lbc-kinds, carte-listes, traduction, lbc-repondre, lbc-vc-interesses, capture-vc-lbc, fusion,
  lectures, quoi-de-neuf.

## Gestes de Julien
1. Installer la 5.445.0 (remplacer le dossier, ⟳ dans chaque Chrome).
2. Sur leboncoin.fr : ouvrir « Messages » (la liste des conversations se range), « Mes transactions » → Ventes puis
   Achats, et son compte (le porte-monnaie se range).
3. Pour les favoris : ouvrir une fois « Statistiques » d'une annonce.
4. Captures utiles (les vraies, pas celles de Vestiaire) : le panneau sur « Mes annonces », Commandes → Ventes et
   Achats, Messagerie, Accueil (porte-monnaie) ; et « Mon compte → Porte-monnaie » le jour où le solde n'est pas nul.

## ÉTAT À LA REPRISE
- Branche `claude/leboncoin-complet` poussée, origin/main fusionné (vrai merge), **PR #1331 ouverte, PAS fusionnée**
  (consigne : aucune fusion avant le 24 nov. 07:00 UTC ; ordre des versions 5.441 → 5.444 → 5.445).
- À faire au moment de fusionner : si une 5.441–5.444 est passée avant, refaire le vrai merge (les numéros, `EXT_CAPACITES`,
  §8, `vrm-badge.js`/`vrm-ui.js`/`background.js carteListesSite` se croiseront avec `claude/vestiaire-complet` — garder
  les deux : la ligne de retour de `carteListesSite` ajoute `achats`/`porteMonnaie` pour Leboncoin seulement),
  régénérer les zips (`node scripts/zip-extension.cjs`), relancer `audit-lbc-panneau`, `audit-panneau-carte`,
  `audit-relais-lbc-kinds`, `audit-coherence`, le banc `lbc-panneau` (TMPDIR court), comparer la CI à celle de main.
- Reste : republication Leboncoin (§3 ci-dessus) ; unité du porte-monnaie (une mesure) ; vues/favoris (une visite de
  « Statistiques »).
