# Annonces, Achats, Colis, loupe : moins de texte — 25 nov. 2026

Branche `claude/moins-texte-a` (depuis `origin/main` fb8916c4a). Pas fusionnée, pas de PR (consigne).
Modèle : `2026-11-25-aujourdhui-moins-texte.md`. Les lots frères : `moins-texte-b` (Argent, Messages, Réglages) et le
chantier des rangées de Ventes (pas touchées ici).

## La demande

Julien (25 nov.) : « je veux vraiment que tu regardes toute l'application et que dès qu'il y a du texte, tu l'enlèves ; ou
alors si c'est vraiment indispensable tu le mets mais tu fais un bel affichage ». Périmètre de ce lot : Annonces (En ligne,
À publier, Dorment, Republier, fiche d'une annonce, menus « ⋯ »), Achats (liste, À retirer, reçus, fiche d'un achat),
Colis/bordereaux (`?tab=cat_bord`, l'impression), la loupe « Tout sur le N° » et la fiche d'un N°.

## Ce qui change

| avant | après | où |
|---|---|---|
| pastille « Arrivé » / « En route » sur chaque achat (téléphone) | une coche / un camion en tête de la sous-ligne (le mot au lecteur d'écran et au survol) ; « À retirer », « À renvoyer », « Annulé », « Payé » gardent leurs mots | `src/ecrans/Comptabilite.jsx`, `src/styles-achats-photos.css` |
| « 23 nov. · depuis 2 j » | « 23 nov. · 2 j » (« depuis » au lecteur d'écran) | idem |
| colonne Statut des tableaux (ordinateur) : « Arrivé », « En route » (Achats), « En ligne » (Annonces) sur chaque ligne | la pastille garde sa couleur, l'icône remplace le mot (coche, camion, œil) ; **opt-in** par `statuts[].icone` : Ventes ne change pas | `src/natif/TableauTravail.jsx` (`Etiquette`), `AchatsTableau.jsx`, `AnnoncesTableau.jsx`, `src/natif/tableau.css` |
| « 120 achats arrivés sans vente / Les relier en série, un par un » | « 120 arrivés sans vente › » (la phrase entière en `aria-label`) | `Comptabilite.jsx`, `achats.serie.*` |
| « Voir plus — 60 affichés sur 240 » | « Voir plus · 60 / 240 » | idem |
| « Achats hors plateforme / Brocante, fournisseur, main propre… » (vide) | le titre seul (le nombre et la somme restent quand il y en a) | `src/ecrans/Achats.jsx` |
| « Carnet des vendeurs / Chez qui tu achètes… », « Ta liste de recherche / Modèles, tailles, prix maximum » | les titres ; un nombre de recherches reste écrit | `src/AchatsPlus.jsx` |
| reçus d'achat : « Aucun reçu d'achat arrivé par e-mail pour l'instant. » + la phrase « Un achat sans… fais-les suivre… » | « Aucun reçu pour l'instant. » ; la phrase (le geste : faire suivre ses e-mails) sous « Pourquoi ? » | `src/RecusEmail.jsx` |
| fiche d'un achat : « Pas de paire reliée à cette ligne. » + « Pour la relier : pose le N°… » | « Aucune paire reliée. » + « Pourquoi ? » (au toucher) ; gestes : « Relier à une vente », « Diviser », « Copier le prix », « Ajouter une note », « Attestation », « Masquer » | `src/FichePaire.jsx`, `achats.*`, `lotachat.diviser` |
| loupe : « Je cherche un N°. » | dit au lecteur d'écran (`role="status"`) | `src/App.jsx` |
| « Tout sur le N°5 » / « Toute l'histoire du N°5 · Achat, stock, annonces, vente, colis, argent » | « N°5 » / « Toute l'histoire › » (les phrases entières au lecteur d'écran) | `src/ecrans/Loupe.jsx` |
| « Ventes et autres plateformes » · « Vente Vinted · Vendue · 23 nov. » · « Bordereau · Posté · Colis de la vente Vinted » | « Ventes » · logo Vinted + « Vendue · 23 nov. » · « Bordereau · Posté » | idem (`LogoSite`) |
| « Ton imprimante » : trois rangées à phrase (« Classique : une feuille A4 par bordereau, ton N° tamponné dessus. »…) | trois tuiles DESSINÉES côte à côte (la feuille A4 et son bordereau, l'étiquette 10×15, la feuille en quatre) + le nom et sa mesure ; la phrase au lecteur d'écran ; « Choisi une fois, puis imprimé. » | `src/ImpressionSimple.jsx` (`PictoPapier`), `src/styles-impression.css` |
| Republier : « Les plus endormies d'abord · en ligne depuis 30 j ou plus · 10 par jour » (coupé à 390) | une lune + « ≥ 30 j · 10/jour » (phrase entière en `aria-label`) | `RepublierPriorite.jsx`, `prio.resume(Long)` |
| « Aucune annonce en ligne depuis 30 j ou plus à republier. » · « Rien ne part d'ici : l'atelier Republier… c'est toi qui lances. » | « Rien à republier. » · « C'est toi qui lances, dans l'extension. » | `prio.vide`, `prio.rienNePart` |
| Annonces : « Mis à jour à l'instant » | rien à l'œil quand c'est frais (< 1 min, dit au lecteur d'écran) ; sinon « il y a 18 min » | `Annonces.jsx`, `tableau.maj.*` |
| fiche d'une annonce : « Taille 36 » à côté de « … taille 36 » ; « 30 € » redit dans « Sur les sites » ; « Pas publiée » à côté de « Publier » ; « Aucune offre en 2 jours » à côté de « En ligne 2 jours » ; « En vente sur Vinted » | la taille dite une fois ; le prix une fois (téléphone, un seul site à prix) ; le bouton « Publier » seul ; « 0 offre » ; « En vente » (le site est dans « Sur les sites ») ; l'intertitre « Informations » au lecteur d'écran | `src/natif/ecrans/Fiche.jsx`, `FichePaire.jsx` (`titreBrut`), `fd.*` |
| menus « ⋯ » : « Changer le prix (tous ses sites) », « Prix mini accepté », « Mettre en brouillon », « Mettre en pause dans l'extension », « Relier mes achats en série », « Publier un article », intertitre « Affichage » | « Prix partout », « Prix mini », « En brouillon », « Pause · extension », « Relier en série », « Nouvel article », sans intertitre | `egalite.*`, `actionsExt.pause`, `la.serie.*`, `Annonces.jsx` |
| « ⋯ » d'Achats : « Scanner un colis arrivé » | « Scanner un colis » | `ach.plus.arrivee` |

Aucune règle métier ni donnée ne change ; aucun `data-*` retiré (ajoutés : `data-achat-statut-icone`, `data-achat-depuis`,
`data-nf-prix-redit`, `data-tt-icone`, `data-impr-picto`). Aucun geste retiré. Les textes passent par `tr()` dans les cinq
langues (clés neuves : `src/i18n/langues/*/moinsTexteA.js` ; valeurs raccourcies des clés existantes).

## Les preuves

- Banc **`scripts/bancs/moins-texte-annonces-achats.cjs`** : l'app RENDUE, base inventée (`design-passe.cjs`, extension à
  jour), 12 écrans ouverts comme un doigt les ouvre (segment, rangée, « ⋯ », loupe, « Imprimer »). Il compte les **mots
  d'interface VUS** : chaque nœud de texte réellement peint (ni transparent, ni rogné, ni recouvert — `elementFromPoint` —, ni
  dans un `<details>` fermé, ni réservé au lecteur d'écran), moins les DONNÉES (nombres, dates, montants, titres, pseudos,
  marque, état d'un article). Il juge M (plafond par écran, voir ci-dessous, et la somme du périmètre ≤ 55 %), T (aucun chiffre
  ni titre rogné), D (fiches : aucun montant écrit deux fois), G (chaque geste là, par `data-*`), E (aucune erreur, aucun
  défilement de côté).
- **Plafonds** : 55 % d'origin/main pour un écran de PHRASES (Achats, Republier, fiche d'un achat, imprimante, loupe) ; 85 %
  pour un écran dont les mots sont surtout des NOMS DE GESTES (Annonces, menus « ⋯ », fiche d'une annonce ou d'un N° : on ne
  retire jamais un geste) ; « rien de plus » pour Colis (ses rangées sont le chantier d'un autre) et le « ⋯ » d'Achats (12 mots).
  ⚠️ C'est un écart à la consigne « ≤ 55 % par écran » : sur ces écrans-là, 55 % voudrait retirer des gestes. Dit, pas caché.
- **Mots** (voir le tableau du rapport, rempli à la dernière mesure).
- Audits verts : traduction, quoi-de-neuf, tdz, coherence, icones, boutons, style-vintex, boutons-natifs ; `npm run build`.
  `audit-stockage-sur` : les mêmes 5 rouges qu'origin/main (fichiers non touchés), aucun ajouté.

## Pas fait ici (à dire)

- **Fiche d'un achat ouverte depuis le tableau (ordinateur)** : le bloc des gestes est VIDE (une carte blanche) — déjà sur
  origin/main (le menu de la rangée n'est passé à la fiche que depuis la liste du téléphone). Pas corrigé ici (ce n'est pas du
  texte) : à reprendre.
- La base de banc montre « À retirer 0 » dans la carte d'Achats et des rangées « À retirer » : la base inventée n'a pas de
  colis du transporteur pour ces achats (la règle `pickupUnion` les compte à part) — rien à voir avec ce lot.
- « Tes meilleures sources » (partagé avec Argent → Statistiques, lot `moins-texte-b`) : pas touché.
- Les rangées de Ventes / Colis : chantier d'un autre agent.
