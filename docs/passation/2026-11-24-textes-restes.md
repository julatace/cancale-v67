# 24 novembre 2026 — Textes, aide et traduction : les restes

Branche `claude/textes-restes`. Reprend les trois morceaux « app » de l'ancienne PR #1191
(jamais fusionnée) qui n'avaient pas été refaits : (20) les chemins de l'aide, (19) les textes
hors `tr()`, (18) « paire / article » par langue. Lot léger : textes et un banc, rien d'autre.
**Le français affiché ne change que là où il était faux** (un chemin qui menait nulle part).

## 1. Les chemins de l'aide — joués dans l'app rendue

### Le contrôle : `scripts/bancs/chemins-aide.cjs`

```
npm run build && node scripts/bancs/chemins-aide.cjs
CHEMIN=Achats node scripts/bancs/chemins-aide.cjs          # seulement les chemins qui contiennent « Achats »
SONDE="Paramètres → Mon compte" node scripts/bancs/chemins-aide.cjs   # suit un chemin et imprime l'écran (pour corriger un texte)
```

- **Ce qu'il lit** : l'aide publique (`scripts/aide-contenu.cjs` : articles et gestes du « ? »),
  les fiches de l'aide intégrée (`src/aideFiches.js`) et **chaque texte français du
  dictionnaire** (`src/i18n/langues/fr*.js`) qui écrit « Écran → … ». Un « Ouvre Colis. » (un
  écran seul) est lu aussi. 67 chemins aujourd'hui.
- **Ce qu'il fait** : au téléphone (390 px, tactile), base vide + un compte Vinted, pour chaque
  chemin : le 1er nom est un onglet de la barre du bas ou une tuile du menu (☰) ; chaque nom
  suivant est un bouton, un onglet ou une rangée **visible** après le geste d'avant (texte ou
  `aria-label`, guillemets, « + » et nombre d'un compteur ignorés) — il le **touche** ; le
  dernier nom peut n'être qu'un titre, ou le début d'une phrase (« … → Mon abonnement le dit »).
  Un nom introuvable rougit, avec la source du texte et ce que l'écran montrait.
- **Pas jugé (dit)** : les chemins d'AUTRES logiciels (iPhone, Gmail, Yahoo, Windows, Orion,
  eBay.com — `DEHORS`, `HORS_CLES`) ; la suite d'un chemin après un **site** (« Annonces →
  Leboncoin → … ») : le menu de plateforme n'apparaît qu'avec des comptes reliés sur plusieurs
  sites, la base du banc est vide — le banc vérifie que l'écran range ses sites (Annonces,
  Ventes, Achats, Messages) et s'arrête là, ligne « ℹ️ » au bilan.
- Machine partagée : un onglet qui plante est remplacé (une seconde chance par chemin) ; écrans
  chargés à la demande attendus 9 s au plus.

### Preuves

- **Rouge avant** : sur le `dist/` construit depuis `origin/main` (1acadda1d), **49 rouges sur 92**
  chemins : `Colis → À retirer`, `Colis → À envoyer`, `Ouvre Compta`, `Statistiques → Prix`,
  `Paramètres → Aide → …` (la catégorie s'appelle « Aide et « Tout va bien ? » »),
  `Paramètres → Comptes liés / État des connexions / Comptes eBay / Langue / Mode vacances /
  Numéros` (sans leur catégorie), `Réglages → …`, `Ventes → Outils → Registre annuel`,
  `Messages → Outils → Offres automatiques`, `Taille`, `Imprimante`, `Vérifier mon installation`
  rangé dans Aide (il est dans Mes plateformes), `Mon compte → Journal` (il est dans Sécurité des
  données), `eBay → À traiter`…
- **Vert après** : **70 verts, 0 rouge** (67 chemins + ouverture + aucune erreur de page), 6 chemins jugés jusqu'au site (« ℹ️ ») ; lancé par `lourd.sh` sur le build de la branche (machine saturée : ~40 s par chemin).
- **Mutation (faite, rouge les deux fois)** : remettre `Ouvre **Colis → À retirer**.` dans `scripts/aide-contenu.cjs`, ou
  `Paramètres → Aide → Signaler un problème.` dans `src/aideFiches.js` ⇒ rouge (le banc relit les
  sources à chaque lancement : pas besoin de reconstruire).

### Ce qui a changé dans les textes

- Aide publique (régénérée par `node scripts/aide-generer.cjs`) : Bordereaux → **Ventes → À
  envoyer** ; À retirer → **Achats → À retirer** ; Compta → **Argent → Déclarer** ; « Vérifier mon
  installation » → **Paramètres → Mes plateformes** ; la liste des dix catégories corrigée ;
  « Même photo » → la carte d'Aujourd'hui ; « Qui numérote ? Moi » écrit en geste.
- Fiches : « Ouvre Aujourd’hui », « Ventes → À envoyer », « Achats → À retirer », « Automatismes »
  et « Messages aux favoris » (tuiles du menu, s'ouvrent sur Vinted), « Argent → Statistiques →
  Prix qui marche », les noms exacts des rangées (« Taille du texte », « Imprimante et
  bordereaux »).
- 30 textes du dictionnaire, **dans les cinq langues**, avec les noms que chaque langue affiche
  (ex. de : « Einstellungen → Meine Plattformen → Verknüpfte Konten », « Finanzen → Melden »).

## 2. Les textes hors `tr()`

- **Appareils connectés** (Paramètres → Mon compte) : tout le panneau — sessions, « Cet appareil »,
  « Détail / Masquer », « Déconnecter », « Voir les appareils (N) », anciennes connexions, les
  confirmations et les toasts, « Se déconnecter partout », les heures (« il y a 5 min », date dans
  la langue). La phrase de confirmation « partout » : `cleConfirmationPartout` (src/securiteCompte.js)
  rend la CLÉ ; les trois phrases sont écrites en entier dans chaque langue.
- **La porte de confidentialité** (`src/PorteConfidentialite.jsx`) : titres, phrases, boutons,
  l'heure du bandeau hors ligne.
- **Mes plateformes** : « Associer une adresse », « N adresses à confirmer », « Vérifier » (`src/reglagesActions.js`, repli français hors de l'app comme son titre) — vu en français sur la capture allemande.
- **La rangée « Comptes liés »** de Paramètres : c'était le mot français de `src/libelles.js` dans
  toutes les langues ; maintenant `reglages.liens.lib`.
- Clés : `src/i18n/langues/{fr,en,es,it,de}/textesRestes.js` (54 clés).
- Captures en anglais et en allemand à 390 px (Appareils connectés, Mes plateformes, Achats) : aucun débordement (`scrollWidth` = largeur), aucun mot coupé.
- `audit-traduction` F protège ces zones (rouge sur l'ancien code : 30 textes en dur relevés).
  `audit-appareils-groupes` G4 et `audit-comptes-securite` 3.6 jugent désormais la clé et sa
  valeur française ; le test `deconnexion-proprietaire` reçoit `tr`.

## 3. « paire » par langue

Le français écrit « paire » dans 142 textes ; six traductions disaient « item / artículo /
articolo / Artikel » à la place (`studio.paires.plus`, `studio.paires.ficheIntrouvable`,
`vis.journee.loupe.p`, `nouveaux.reglage.bilan.desc`, `liaL.aucune` en anglais,
`glisser.aideCible`). Toutes disent maintenant « pair / par / paio / Paar » : aucune langue ne
mélange plus les deux mots là où le français n'en a qu'un.

## Pas fait (dit, pas caché)

- Les fiches d'aide (`src/aideFiches.js`) et l'aide publique restent en **français seulement**.
- Le mécanisme « paire » ⇄ « article » **selon ce que vend le vendeur** dans les autres langues
  (l'ancien `src/motsLangues.js` de #1191) n'est pas refait : en/es/it/de disent « pair » partout
  où le français fixe dit « paire ».
- Le reste de Paramètres → Sécurité des données → Journal (`JournalVrm`, `src/securiteCompte.js`
  `LIBELLES_TYPE`) et les autres sous-panneaux gardent du français en dur.
- `textes-visibles` n'existe pas encore sur `main` (il arrive avec le train) : pas lancé ici.

## Gestes de Julien

Aucun.
