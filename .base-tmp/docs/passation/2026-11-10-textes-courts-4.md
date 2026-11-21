# 10 nov. 2026 — Textes courts, 4e série

Branche `claude/textes-courts-4` (depuis `origin/main` ff6b6a8e, puis un vrai `git merge origin/main`), poussée
à chaque commit, pas de PR. Suite de `2026-11-10-textes-courts-3.md` ; même règle
(`2026-11-09-popups-propre.md`) : chaque texte affiché de plus de 90 caractères est RÉÉCRIT (le fait + le geste),
le détail utile replié sous « Pourquoi ? », jamais un avertissement, un « pas su », un manque nommé ni un geste retiré.

## La forme : `src/composants/PourquoiReplie.jsx`

Favoris, Organisation, Communauté, fil eBay, inventaire, configuration se chargent à la demande et ne lisent pas
`App.jsx` (pas d'import circulaire). Ce petit composant rend le même `<details class="vrm-pourquoi vrm-pourquoi-ecrit">`
que le `Pourquoi` d'App.jsx (« ⓘ Pourquoi ? », le texte d'avant ENTIER dedans). Jamais dans un `<p>` : les `<p>`
qui le portent sont devenus des `<div>` (même classe).

## Relevé statique (textes JSX visibles > 90 caractères, hors `Pourquoi`/`details`)

| fichier | avant | après |
|---|---|---|
| `src/FavorisVinted.jsx` | 7 | 0 |
| `src/operations/Operations.jsx` (+ `description.js`) | 9 | 0 |
| `src/communaute/Communaute.jsx` | 7 | 0 |
| `src/communaute/Accompagnement.jsx` | 7 | 0 |
| `src/ebayRecherche.jsx` | 6 | 0 |
| `src/InventaireStock.jsx` | 5 | 0 |
| `src/StudioPhoto.jsx` | 4 | 0 |
| `src/ConfigurationDepart.jsx` | 6 | 0 |
| `src/composants/SignalerProbleme.jsx` | 4 | 1 (ce qui part avec un signalement : vie privée, gardé mot pour mot) |
| `src/App.jsx` | 39 | 15 |
| **tous les `.jsx`** | **213** | **135** |

### Favoris (les avertissements, à garder au sens exact)
- « Garde cet écran ouvert et visible… Une conversation qui contient déjà des messages est ignorée. Aucune garantie
  contre un blocage Vinted. » → à l'écran, en gras : **« Aucune garantie contre un blocage Vinted. »** + « Garde cet
  écran ouvert. » ; la phrase entière (mot pour mot) sous « Pourquoi ? » (`data-favoris-avertissement`).
- Rythme « Comme Vintex » : « Un message toutes les 6 à 10 secondes environ, tiré au hasard : le rythme mesuré chez
  Vintex. » → « Un message toutes les 6 à 10 s, au hasard (rythme mesuré chez Vintex). » (même sens, à l'écran).
- Rythme (tous) : « Le premier part tout de suite. Garde l’onglet vinted.fr ouvert. » + le détail d'avant replié.
- Offre : « Ex. : annonce à 50,00 € ⇒ offre à 45,00 € » ; « vraie offre Vinted… prix illisible ⇒ message sans offre »
  replié. Variables, choix des favoris, « Vérifier », extension 5.281 : une phrase.

### Organisation
Notes des formulaires (mission, réservation, lot, consommable, veille eBay, dossier, réception) : une phrase,
le détail d'avant replié. `DESCRIPTION_ORGANISATION` (lue aussi par Réglages) : « À plusieurs : tâches, paires
mises de côté, achats en lot, emballages. » ; la panne : « Organisation pas lue — rien n’est perdu. Réessaie dans
un instant. » (trouvées par le banc, pas par le relevé : une constante et un `throw`).

### Communauté, Accompagnement
« Visible : ton pseudo et ta ville (à 5 km près), rien d’autre. ⓘ » (« Jamais ton adresse, ton e-mail ni tes
comptes Vinted » replié) ; base pas à jour, abonnement, code à donner, classement, groupe de comparaison, ce que
verront les membres (« pseudo, ville et nombre de ventes Vinted — jamais un montant ») ; accompagnement : code et
lien, « rien ne se voit avant que tu valides » (le reste replié), chiffres pas encore publiés.

### App.jsx : connexion et installation de l'extension
- Nouveau compte Discord/Google : « « X » sert de pseudo à sh•••@…, pas pour te connecter. Ce nouveau compte est
  vide. » ; « Ensuite : » en deux étapes numérotées (connecte-toi · Paramètres → Mon compte → Comptes associés →
  « Connecter X »). Banc `discord-nouveau-compte` : « pas pour te connecter », « Connecter Discord » gardés.
- Connexion depuis l'extension : « Connecte-toi ici : l'extension … se connecte aussi, rien à taper. » ; lien trop
  vieux : deux lignes, « reclique « Continuer avec Google » (ou Discord) » gardé (banc `extension-oauth-app`).
- Extension pas reliée : version trop ancienne (deux lignes), « Je la connecte d’ici, sans rien à taper » gardé
  (banc `premierjour`), icône + mot de passe VRM sous « Pourquoi ? » ; Orion iPhone, boutique, Safari, Mode développeur.
- Pas touchés : `ExtEnRetard`, le zip « un seul dossier », « Sécurité des données », confirmations eBay/Leboncoin,
  l'acceptation des CGU à l'inscription (texte légal), les seuils DAC7, la rétractation et l'essai gratuit
  (`Abonnement`), l'aide des offres automatiques (déjà repliée), les chemins de menu d'iPhone/Vinted des comptes
  muets, l'alerte rouge « deux articles sous un N° » (§7), `InfoPop` de la configuration (déjà repliée).
- Aussi : numéros périmés (deux lignes : « Numéros peut-être faux : n'en écris aucun, n'imprime rien d'ici. » /
  « Recharge : ce que tu as tapé ici est gardé. »), aperçu sans abonnement (« rien n'est supprimé » gardé, banc
  `abonnement-propre`), hors ligne, comptes muets (« date limite estimée » + détail replié), Vestiaire achats vides,
  Stock 3D (meuble, planches), tampon (fiche colis, bande), adresse sans compte, boîte illisible, prix moyen.

### Autres fichiers
Fil eBay (« relectures du jour » gardé une fois : banc `ebay-achats-recherche` ; « Ko reçus d’eBay » gardé),
inventaire (« Hors connexion · liste des paires du … » gardé : banc `inventaire`), studio photo
(`data-studio-passu` gardé), configuration (« Argent → Factures → Ma facture », nom d'aujourd'hui), signalement.

## Preuves

- **Audit neuf `scripts/audit-textes-courts.cjs`** (relevé babel des 9 fichiers passés à 0) : T1 aucun texte long,
  T2 « Aucune garantie contre un blocage Vinted » et le rythme restent À L'ÉCRAN (hors repli), T3 six phrases
  témoins gardées sous « Pourquoi ? ». Vert ici (18) ; sur `origin/main` (`git archive`, `TEXTES_RACINE=…`) :
  **16 rouges** ; `--prouve` : l'ancien avertissement recollé ⇒ 2 rouges (T1 + T3).
- **Banc `popups-propre`** prolongé de `favoris`, `organisation` (chaque formulaire ouvert un à un, P1 jugé dessus ;
  route `/api/compte?mode=operations` servie avec un espace vide, forme de `VIDE()`), `communaute`.
  Premier passage : Organisation rouge (`DESCRIPTION_ORGANISATION` 125 car., la panne 97 car.) ⇒ réécrites.
  Résultats : voir « Banc » ci-dessous.
- Avant chaque remplacement, les morceaux du texte d'avant cherchés dans `scripts/` (script de vérification) ;
  les phrases lues par un banc sont gardées (listées plus haut).
- `npm run build` vert ; audits `variables`, `tdz`, `coherence`, `identite`, `icones`, `favoris-ecran`,
  `accompagnement`, `formateurs`, `configuration-depart`, `inventaire`, `inventaire-hors-ligne`, `ebay-recherche`,
  `extension-navigateurs`, `atelier`, `politique-hotes`, `guide-iphone`, `boutons`, `statuts` verts.

## Ce qui reste

- ≈ 135 textes longs dans tous les `.jsx` (relevé statique) : Réglages (15), Ebay (15), Leboncoin (10), Accueil
  (11), `ConfigurerTransfert`/`RelierBoite` (pipeline e-mails, un autre lot y travaillait), `CarteRelais`
  (attribution de la carte, explication des sources), App.jsx (15, volontaires ci-dessus).
- Le banc ne monte pas la feuille des Favoris (il faut des favoris lus) ni la carte de la Communauté (la base du
  banc ne la sert pas) : ces textes sont jugés par l'audit statique.
