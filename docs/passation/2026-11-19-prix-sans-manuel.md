# 19 nov. 2026 — « Changer le prix » en UN geste, et les gestes « à la main » qui restent

Branche `claude/prix-sans-manuel` (partie de `origin/main` ed9399cb). Extension **5.409.0**.

## La demande

Julien, 19 nov., sur une capture de son iPhone (fiche N°134 → « Changer le prix », 59 → 58) :
« Regarde ce genre de fonctionnalité qui pue, tu me les enlèves tout de suite, catastrophique : c'est à
l'extension de baisser les prix, c'est pas à moi. » Et juste avant : « l'outil doit être pratique, pas chiant ».
La feuille répondait « Proposé : à toi de confirmer » avec un SECOND bouton « Baisser sur Vinted », le plein
devenait « Appliquer à nouveau », et les textes de la rangée se chevauchaient.

Puis une photo de son Mac (Annonces → Leboncoin, « Publier sur Leboncoin », N°234) : « Photos : 0 sur 0 captées
(13 sur Vinted) · Pas de photo (Leboncoin la refuse) : ouvre l'annonce sur Vinted. », une puce
« {taille} · {marque} · {N°} » affichée brute, et un bouton éteint qui ne disait pas quoi faire.

## Ce qui est décidé (à ne pas défaire)

1. **« Appliquer » EST son clic**, pour chaque site coché. Plus d'état intermédiaire où il devrait confirmer
   ailleurs, plus de second bouton sur une rangée, plus de plein qui change de nom.
2. **L'extension agit, ou la baisse ATTEND.** Elle ne lui est jamais « rendue » pour un geste que l'extension sait faire.
3. **Aucun garde-fou retiré, aucune route nouvelle** chez Vinted, Leboncoin ou Vestiaire : la baisse passe par
   `baisserPrixVinted` / `baisserPrixLbc` / `baisserPrixVestiaire` tels qu'ils étaient (compte de l'onglet, prix lu
   avant et RELU après, 45/h, plafond du jour, pause 429/403, frein, une requête à la fois).
4. **Une hausse ne part jamais** par ces chemins (seule la remise d'un solde remonte un prix, §3) : la rangée dit
   « Hausse à faire sur Vinted » avec « Ouvrir », sans commande ni attente.
5. **Les photos se demandent à l'extension**, elles ne se « font pas capter » par une visite à la main.

## Ce que voit Julien maintenant

- Il tape le prix, touche **Appliquer**. Sur l'ordinateur où Vinted est ouvert sur le bon compte : « Envoi… »,
  puis la feuille se ferme et une ligne dit « N°134 à 58 € : fait ». Le prix affiché « fait » est celui que le site
  a RELU.
- Sur l'iPhone (pas d'extension), ou si l'onglet est sur un autre compte, s'il n'y a pas d'onglet, si le plafond
  de l'heure est atteint, pendant une pause : la feuille se ferme et dit « N°134 à 58 € : en attente pour Vinted,
  ça partira tout seul ». Rouverte, la rangée dit « 58 € · En attente : partira dès que Vinted est ouvert sur
  {compte} », avec **Annuler** (un toucher).
- La feuille ne reste ouverte que s'il y a quelque chose à LIRE : un refus (« Rien n'est parti : sur Vinted le
  prix est maintenant 55 € »), un « pas sûr », une hausse.
- Leboncoin et Vestiaire : le même geste (recette apprise). Recette pas apprise : une phrase sur la rangée, dite
  avant même d'appliquer.
- La rangée : le site à gauche, « 59 € → 58 € » sur UNE ligne, l'état dessous, au plus un geste texte à droite
  (« Annuler » ou « Ouvrir »). Un seul plein. Disposition du contrat « VRM natif » (`docs/design/NATIF.md`),
  classes `pp-*` (`src/prix-partout.css`), jetons `--n-*` quand ils sont posés, sinon leurs valeurs du contrat.
- « Publier sur Leboncoin » : à l'ouverture, les photos qui manquent sont demandées à l'extension (« lecture… 0 sur
  13 », puis elles apparaissent) ; si elle ne peut pas maintenant : « Les photos seront lues dès que Vinted est
  ouvert sur {compte}. » Les puces de modèles sont précédées de « Insérer : » et montrent ce qui sera inséré
  (« 39,5 · Adidas · 234 »). Sans extension dans le navigateur, le bouton éteint porte « Installer l'extension ».

## Comment marche l'attente (`src/prixAttente.js`, `prixAttenteTick` dans `background.js`)

- **Une ligne `cmd_prix_{id}` dans SA base = une commande = un prix = une annonce.** Elle porte le site, le compte,
  l'annonce, le prix voulu, **le prix qu'il a vu** (`prixAvant`), `confirme: true`, la date et l'échéance (24 h).
  Une famille d'identifiants à part de `cmd_relais_*` : une extension plus ancienne ne la voit pas (elle l'aurait
  refusée « expirée » au bout de 10 min).
- **Déposer** (`deposerPrixAttente`) remplace d'abord la baisse qui attendait déjà pour CETTE annonce ; lecture
  ratée ⇒ rien n'est rangé. **Annuler** (`annulerPrixAttente`) : écriture conditionnelle, une commande déjà prise
  ne s'annule pas.
- **L'extension 5.409**, toutes les 30 s et à chaque visite sur Vinted : rien sans session VRM ; ligne à son
  vendeur seulement ; forme revérifiée (baisse seulement, confirmée) ; périmée ⇒ écrite « expirée », jamais exécutée ;
  deux lignes pour une annonce ⇒ la plus récente ; **elle ne part que si le site est ouvert sur le compte de
  l'annonce, sans pause** (sinon la ligne n'est pas touchée) ; **prise par une écriture conditionnelle
  `attente → pris`, notée dans `chrome.storage.local` AVANT d'agir** (jamais rejouée, même après un redémarrage du
  service worker) ; exécutée par le chemin de baisse existant ; sur Vinted elle suit le rythme (`programme`) ; **une
  au plus par passage, 25 à 90 s entre deux** ; un refus où rien n'est parti et qui se lève seul (plafond, pause,
  autre compte, moment calme) ⇒ remise en attente, 40 fois au plus ; « Tout arrêter » ou une vérification anti-robot
  ⇒ refusée et dite (un arrêt n'est jamais une attente).
- **Le prix lu avant d'agir doit être celui vu à la saisie** : sinon aucun envoi, refus `prix-change` avec le prix
  lu. Si le site montre DÉJÀ le prix voulu : « fait », sans rien envoyer (une baisse n'est jamais faite deux fois).
- **L'issue** est écrite dans la ligne (prix relu). L'app la dit : dans la feuille rouverte, par une ligne passagère
  si l'app est ouverte, et dans « Ce que VRM a fait » (`api/_lib/securite-compte.js`, source `prix_attente` :
  refusée, pas sûre, pas partie en 24 h ; « faite » sur Vinted reste notée par l'extension, pas deux fois).
- **La phrase est vraie** : si aucune extension 5.409 n'est connue (ni ici, ni par le battement `relais_ext` de
  l'ordinateur), la rangée dit « En attente : mets l'extension à jour sur ton ordinateur, puis ouvre Vinted ».
- Le bloc `<prix-attente-regle>` (forme d'une commande, sens d'une réponse, refus qui attendent) est le MÊME dans
  l'app et l'extension : `node scripts/audit-prix-attente.cjs --recopie`.

## ⚠️⚠️ Ce qui reste « à la main » et qui compte le plus : le « format appris » d'une annonce Vinted

L'extension ne baisse un prix Vinted qu'en rejouant **le corps que Vinted a accepté pour CETTE annonce**
(`vrm_vinted_modele`), appris seulement quand il enregistre l'annonce sur vinted.fr dans un navigateur avec
l'extension, ou quand VRM l'a créée (Republier). Sans lui, `baisserPrixVinted` refuse (« modifie-la une fois à la
main sur Vinted »).

**Mesuré le 19 nov. sur la vraie base (lecture seule, des comptes seulement) : 31 annonces en ligne sur 198 ont ce
format ; 190 ont leur sauvegarde coffre.** Pour 167 annonces sur 198, la baisse depuis VRM est donc refusée —
c'était déjà vrai avant ce lot (« Baisser le prix » en série refuse de la même façon).

Ce lot ne le contourne pas (bâtir le corps d'une modification sans l'avoir vu, c'est risquer d'effacer une taille,
un état ou des photos : §2.3, §6 « mesurer avant de coder »). Il le DIT avant d'appliquer : la rangée d'une annonce
sans format dit « VRM ne sait pas encore changer le prix de cette annonce : change-le sur Vinted » avec « Ouvrir »,
et rien n'est envoyé ni rangé pour elle.

**Le lot qui suit, à faire en premier** : apprendre à bâtir le corps du `PUT /api/v2/item_upload/items/{id}` depuis
la LECTURE que l'extension fait déjà (`GET` de la même adresse, étape 1 de la baisse).
1. Mesurer d'abord (lecture seule) : pour les 63 annonces qui ont un format, comparer les CLÉS du corps accepté
   (`vrm_vinted_modele[id].corps`) à celles de la lecture (`brouillon_lu_forme`, échantillons de clés déjà rangés) :
   quelles clés du corps viennent telles quelles de la lecture, lesquelles changent de nom (`photos` →
   `assigned_photos {id, orientation}`), lesquelles manquent.
2. N'écrire que si chaque clé du corps est couverte ; sinon refuser comme aujourd'hui.
3. Banc : rejouer la construction sur les 63 corps réels (dans `fx/`, jamais dans le dépôt) et exiger l'égalité au
   prix près ; mutation « une clé oubliée » rouge.
4. Premier essai sur UNE annonce, relue.

## L'inventaire des gestes « à la main »

| Où | Ce que VRM demandait | L'extension sait ? | Sort |
|---|---|---|---|
| Fiche → Changer le prix, Vinted | « Proposé : à toi de confirmer » + « Baisser sur Vinted » | oui (`baisseprix`) | **Fait** : un geste, direct ou en attente |
| Changer le prix, Leboncoin / Vestiaire | « À faire sur le site » | oui si recette apprise (`lbcprix`, `vcprix`) | **Fait** : même geste ; recette pas apprise ⇒ une phrase |
| Changer le prix, annonce Vinted sans format appris | (refus long de l'extension après coup) | **non, pour 167 annonces sur 198** | **Dit avant d'appliquer** ; lot suivant ci-dessus |
| Publier sur Leboncoin, photos | « ouvre l'annonce sur Vinted » | oui (commande `photos`, lecture de fond `tickPhotos`) | **Fait** : demandées à l'ouverture, sinon lues seules |
| Leboncoin → À publier (« Aucune photo », « Une seule photo », « +N ») | « Ouvre l'annonce sur Vinted… » | oui (lecture de fond) | **Fait** : « VRM lit les photos tout seul dès que… » |
| Vendre sur eBay, photos | « rouvre l'annonce sur Vinted » | oui (déjà demandé au choix de la paire) | **Fait** : même phrase, plus de consigne |
| Publier sur Leboncoin, puces de modèles | « {taille} · {marque} · {N°} » brut | — | **Fait** : « Insérer : » + ce qui sera inséré |
| Publier sur Leboncoin, bouton éteint | « Extension VRM pas détectée » sans geste | — | **Fait** : lien « Installer l'extension » (la détection est traitée par un autre agent) |
| Annonces → Baisser le prix en série, annonces d'un autre compte | « Ouvre {compte} sur Vinted » (ligne bloquée) | oui | **À faire, décrit** : déposer une ligne `cmd_prix_*` par annonce de l'autre compte (la file existe) ; touche `src/baissePrix.js` (`lignesBaisse`, le blocage « autre compte »), `BaissePrixSerie.jsx` et `audit-baisse-prix` R3/R7 |
| Baisse en série Leboncoin / Vestiaire, mode vacances | « Fais-le une fois à la main, VRM apprendra » | non tant que la recette n'est pas apprise | **Pas touché** : aucune route n'est devinée (§3) ; c'est l'apprentissage sur SON geste |
| Mode vacances, autres comptes | un compte à la fois (celui de l'onglet) | oui, compte par compte | **Décrit** : même file possible (« partira dès que Vinted est ouvert sur X ») ; pas fait |
| Remettre les prix d'un solde | sur son clic, compte de l'onglet | oui (`remiseprix`) | **Pas touché** : une HAUSSE ne part jamais en attente, exprès |
| Messages → offre, sans extension ici ni ordinateur allumé | « Proposer X € · à faire sur Vinted ↗ » | oui (relais du téléphone quand l'ordinateur est allumé) | **Décrit, pas fait** : une offre partie des heures plus tard peut vendre à un prix qui n'est plus le bon — à décider par lui |
| Retirer ailleurs, Leboncoin, sans extension ici | « À faire sur Leboncoin — ici, pas d'extension » | oui sur l'ordinateur (`lbcsupprime`) | **Décrit, pas fait** : une suppression est irréversible ; la ranger pour plus tard demande sa décision |
| Retirer ailleurs, Vinted ; « En ligne deux fois » ; « Deux comptes » | « ouvre l'annonce et supprime-la sur Vinted » | — | **Refusé par §3** : supprimer une annonce Vinted automatiquement |
| Retirer ailleurs, Vestiaire | « à faire sur Vestiaire » | non (aucune voie) | **Pas touché** |
| Publier partout : « à finir sur eBay / Vestiaire » | finir le brouillon sur le site | en partie | **Pas touché** : eBay = un brouillon qu'il met en ligne (sa décision) ; Vestiaire = formulaire à relire |
| Republier : brouillon à refaire, question « il manque la taille » | sa réponse, son clic | — | **Pas touché** : c'est LUI qui lance et qui choisit (§3) ; pas de republication à l'aveugle |
| Offres auto, favoris | — | déjà automatiques ou en file | rien à faire |

## Ce qui a changé dans le code

- `src/prixAttente.js` (neuf) : la règle partagée, la forme d'une ligne, la vue, déposer / lire / annuler.
- `src/prixPartout.js` : modes `ext` (Vinted, Leboncoin, Vestiaire), états `attente` et `hausse`, `toutEstDit`,
  `envoisPrix` (une commande de baisse par annonce, sinon `deposer`), `formats` et `recettes`.
- `src/PrixPartout.jsx` + `src/prix-partout.css` : la feuille refaite ; textes par `tr()` (5 langues,
  `src/i18n/langues/*/prixSansManuel.js`) ; `prixPartout.propose`, `.baisser`, `.relu`, `.aMettre` retirés.
- `src/App.jsx` : `HotePrixPartout`, `envoisPrixVrm`, `suivrePrixAttente` ; la feuille « Baisser le prix » de la
  coque (`baisse-coque`), qui ne s'ouvrait que par l'ancien second bouton, est retirée ; `EXT_ATTENDUE` 5.409.0,
  `EXT_CAPACITES.prixattente`.
- `vinted-sync-extension/background.js` : `prixAttenteTick` et le bloc recopié ; alarme `vrm-relais` et visite.
- `src/ecrans/Leboncoin.jsx`, `src/ecrans/Ebay.jsx`, `src/ModelesDescription.jsx` : photos, puces, bouton éteint.
- `api/_lib/securite-compte.js`, `src/securiteCompte.js` : l'issue d'une baisse en attente dans « Ce que VRM a fait ».
- Zips régénérés une fois (`node scripts/zip-extension.cjs`).

## Preuves

- `node scripts/audit-prix-attente.cjs --prouve` : la règle de l'app et le VRAI `background.js` (vm) — une commande
  sur « Appliquer », pas de second geste, prix relu ; extension absente / autre compte / pas d'onglet / plafond /
  pause ⇒ une ligne en attente, exécutée une seule fois au retour, périmée après 24 h, annulable ; prix changé
  entre-temps ⇒ rien ne part, dit ; hausse ⇒ aucune commande ; 45/h et pause respectés ; autre compte ⇒ rien ;
  « Tout arrêter » ⇒ refusée. Mutations toutes rouges ; rouge sur le code d'`origin/main`.
- `node scripts/bancs/prix-sans-manuel.cjs` (390 × 844 tactile et 1512, clair et sombre) : aucun texte n'en
  chevauche un autre (mesuré au glyphe), rien ne déborde, cibles ≥ 44, contrastes ≥ 4,5:1, un seul plein, jamais de
  bouton de baisse sur une rangée, prix actuel → nouveau prix sur une ligne. Captures regardées.
- Mis à jour en citant la décision : `audit-annonces-outils` (P8, P9, P10, P12, P15, A1, A2), `audit-publier-partout`
  (J1, J3, G16).
- Verts : extension-zip, coherence, ext-boutique, paquets-boutiques, extension-navigateurs, moteur-offres,
  offres-auto, budget-lectures, relais, baisse-prix, discretion, securite-comptes, traduction, quoi-de-neuf, confiance.

## Gestes de Julien

- Installer l'extension **5.409.0** (remplacer le dossier, ⟳ dans chaque Chrome) : sans elle, une baisse rangée
  depuis l'iPhone attend (la rangée le dit).
- Décider : ranger aussi en attente une suppression Leboncoin et une offre faite depuis le téléphone ?
