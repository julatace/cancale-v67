# 15 nov. 2026 — Paramètres rangés en dix catégories

Julien (iPhone surtout, il va ouvrir VRM à d'autres vendeurs) : « je veux que les
paramètres soient améliorés », « quelque chose de pratique et de compréhensible »,
« un meilleur visuel ». Branche `claude/parametres` (pas de PR ouverte, sur consigne).

## 1. Mesuré AVANT (origin/main `70fbef70`, base inventée `design-passe.cjs`, 390 tactile)

| | avant |
|---|---|
| niveaux | 3 onglets (Réglages · Mon compte · Abonnement) ⇒ (repli « Réglages avancés ») ⇒ panneau |
| onglet « Réglages » | **73 rangées**, 15 groupes, **5 127 px = 6,1 écrans d'iPhone** |
| onglet « Mon compte » | 11 rangées, 1 818 px (2,2 écrans) |
| onglet « Abonnement » | la carte d'abonnement, d'un bloc |
| phrases | 67 rangées sur 84 portent une phrase (56 caractères en moyenne) ; 11 une valeur à droite |
| recherche | **dans l'onglet « Réglages » seul** : « mot de passe », « double vérification », « supprimer mon compte », « appareils », « journal » ne trouvaient rien |
| liens `?tab=settings&reglage=X` | 20 ids acceptés (`REGLAGES_AIDE`) ; `reglage=mes-plateformes` (tests/navigation-plateformes) n'ouvrait rien |

**En double / qui se confond** (relevé dans le code et les captures) :
- ⚠️ **un défaut** : la clé `reglages.securite.lib` était écrite DEUX fois dans chaque langue
  (« Sécurité des données » puis « Sécurité des comptes ») ; la seconde gagnait ⇒ la rangée du
  panneau expert « Sécurité des données » s'appelait « Sécurité des comptes », comme la rangée
  des gardes de l'extension. Corrigé : `parametres.securiteDonnees.lib`, la première écriture retirée.
- « Mon abonnement » : une rangée-renvoi dans « Réglages » ET l'onglet « Abonnement ».
- Quatre écrans d'état voisins : « Tout va bien ? », « État des connexions », « Vérifier mon
  installation », « Santé de tes données » (gardés : chacun a son rôle ; rangés ensemble dans Aide
  ou Mes plateformes).
- « Mode sombre » (interrupteur) + « Apparence » (panneau) ; « Mode stream » + « Ce que le stream
  cache » ; « Revoir la visite » + « Visite, mots expliqués » (gardés, côte à côte dans leur groupe).
- 9 icônes portées par deux ou trois rangées (`audit-coque-parametres` rouge connu « une icône par ligne »).

**Introuvable** : tout « Mon compte » par la recherche ; « Sécurité des données » sous un repli
« Réglages avancés » ET sous le mauvais nom ; « Organisation » = un lien sous un groupe.

**Technique hors « Sécurité des données »** : « Widget iPhone · Ton lien privé pour Scriptable »,
« Raccourcis clavier · « g » puis une lettre » (gardés : ils ne servent qu'à ceux qui les cherchent,
rangés dans Apparence et langue → Raccourcis).

Captures avant : `docs/design/avant-apres/parametres-avant.png` (l'onglet Réglages en entier).

## 2. Après

**Premier écran** (téléphone) : le titre et son « ? », **la recherche** (« Chercher : papier,
URSSAF, numéro… »), **« Tout va bien ? Pas tout à fait »** en tête QUAND quelque chose ne va pas
(une rangée ambre, un geste « Voir » ⇒ le panneau « Tout va bien ? »), puis **dix catégories** :

| catégorie | ce qu'elle range | état à droite |
|---|---|---|
| Mon compte | profil (photo, prénom), « Protège ton compte VRM », **Abonnement** (l'ancien 3e onglet, même composant), e-mail, mot de passe, Google/Discord/Apple, double vérification, appareils, code à l'ouverture, connexion par QR, Équipe, lien pour ton aide, Se déconnecter, Supprimer mon compte (tout en bas) | — |
| Mes plateformes | « À terminer » (adresses e-mail), comptes liés, état des connexions, vérifier mon installation (extension), comptes eBay ; plateformes affichées, historique ; e-mails, adresse VRM, import des e-mails | « 3 comptes » |
| Ventes et colis | imprimante et bordereaux ; SMS de colis, carte de remerciement ; mes modèles | « Normale · A4 » |
| Stock et numéros | groupe « Stock et rangement » : numéros de rangement, je vends ; **lien Organisation** dessous (CLAUDE.md §3) | « Chiffres » |
| Argent | statut, compléter les prix d'achat, achats masqués, objectif du mois | « À choisir » |
| Notifications | téléphone, rappels, agenda, alertes dans l'app, ce que l'extension capte | — |
| Apparence et langue | langue, apparence, mode sombre, taille ; écrans (affichage, Ma journée, ma configuration, écran d'atelier) ; stream ; raccourcis (widget, Siri, clavier) | « Français » |
| Sécurité des comptes | sécurité des comptes, discrétion, mode vacances, santé des comptes, copie de mes annonces | — |
| Aide et « Tout va bien ? » | tout va bien, santé des données, état de VRM, résoudre un problème ; centre d'aide, support, signaler, quoi de neuf ; revoir (visite, bilan, premier colis, aides, conseils) ; propriétaire | — |
| **Sécurité des données** (à part, en dessous) | le panneau expert `SecuriteSetting` **tel quel** (§5) avec une ligne « pour les experts » ; sauvegarde (complète, restaurer, revenir en arrière, corbeille, importer, exporter) ; confidentialité, journal, données et conditions | « Sauvée il y a 3 j » / « Jamais sauvée » (ambre à 30 j) |

Une catégorie s'ouvre en sous-écran (« ‹ Paramètres », grand titre, ses groupes) ; un réglage
dans le sien (« ‹ Mon compte ») ; un réglage trouvé par la recherche revient à la recherche.
**Ordinateur** : le sommaire collant à gauche (la catégorie choisie enfoncée + diode), les dix
catégories dépliées à droite. Design « Studio bleu clair » : rangées de porcelaine (64 px pour
une catégorie, 56 pour un réglage), icône gravée, aucun bouton plein ajouté.

**Rien de perdu** : les 84 rangées d'avant gardent leur `id`, leurs `data-*` et leur panneau
(montés cachés comme avant ; seul l'abonnement est monté ouvert, comme l'onglet d'avant). Le
rangement est une RÈGLE (`src/parametres/categories.js`) : chaque rangée y est nommée
(`audit-parametres`) ; une rangée ajoutée plus tard dans un groupe d'avant sans y être nommée
part dans la catégorie de son groupe (**le filet**) — « Qui numérote ? » posé dans le groupe
`stock` arrive dans « Stock et numéros », un réglage de notifications dans « Notifications ».
Les agents en parallèle (numéros, partenaires, retours, notifications) : ajouter l'`id` de leur
rangée dans le bon groupe de `CATEGORIES` (sinon le filet la range quand même).

**Recherche** : dans les dix catégories ; le nom de la catégorie et du groupe comptent ; mots de
vendeur ajoutés (`src/rechercheReglages.js` : papier, URSSAF, mot de passe, facture, 2fa…).

**Liens profonds** : `?tab=settings&reglage=X` accepte maintenant chaque réglage nommé dans
`LIENS_PROFONDS` (avant : 20). La catégorie s'ouvre, puis le panneau.

## 3. Table des liens profonds (relevée dans le code : `grep -rn "reglage=" src api`, `DEMANDE_REGLAGE_SOUS.id`, `section=`)

| lien | rangée | catégorie |
|---|---|---|
| `?tab=settings&reglage=push` | `push` | Notifications |
| `?tab=settings&reglage=agenda` | `agenda` | Notifications |
| `?tab=settings&reglage=vacances` | `vacances` | Sécurité des comptes |
| `?tab=settings&reglage=numeros` | `numeros` | Stock et numéros |
| `?tab=settings&reglage=modeles` | `modeles` | Ventes et colis |
| `?tab=settings&reglage=imprimante` | `imprimante` | Ventes et colis |
| `?tab=settings&reglage=regime` | `regime` | Argent |
| `?tab=settings&reglage=apparence` | `apparence` | Apparence et langue |
| `?tab=settings&reglage=stream` | `stream` | Apparence et langue |
| `?tab=settings&reglage=zoom` | `zoom` | Apparence et langue |
| `?tab=settings&reglage=corbeille` | `corbeille` | Sécurité des données |
| `?tab=settings&reglage=verifier` | `verifier` | Mes plateformes |
| `?tab=settings&reglage=toutvabien` | `toutvabien` | Aide et « Tout va bien ? » |
| `?tab=settings&reglage=connexions` | `connexions` | Mes plateformes |
| `?tab=settings&reglage=depannage` | `depannage` | Aide et « Tout va bien ? » |
| `?tab=settings&reglage=appareils` | `appareils` | Mon compte |
| `?tab=settings&reglage=double` | `double` | Mon compte |
| `?tab=settings&reglage=equipe` | `equipe` | Mon compte |
| `?tab=settings&reglage=abonnement` | `abonnement` | Mon compte |
| `?tab=settings&reglage=widget` | `widget` | Apparence et langue |
| `?tab=settings&reglage=mes-plateformes` | `mes-plateformes` | Mes plateformes |
| `?tab=settings&reglage=sante` | `sante` | Aide et « Tout va bien ? » |
| `?tab=settings&reglage=santecomptes` | `santecomptes` | Sécurité des comptes |
| `?tab=settings&reglage=discretion` | `discretion` | Sécurité des comptes |
| `?tab=settings&reglage=rappels` | `rappels` | Notifications |
| `?tab=settings&reglage=importer` | `importer` | Sécurité des données |
| `?tab=settings&reglage=demandes-aide` | `demandes-aide` | Aide et « Tout va bien ? » |
| `?tab=settings&reglage=fermer` | `fermer` | Mon compte |
| `?tab=settings&reglage=signalements` | `signalements` | Aide et « Tout va bien ? » |
| `?tab=settings&reglage=ebay` | `ebay` | Mes plateformes |
| `?tab=settings&reglage=securite-comptes` | `securite-comptes` | Sécurité des comptes |
| `?tab=settings&reglage=historique` | `historique` | Mes plateformes |
| `?tab=settings&reglage=copieannonces` | `copieannonces` | Sécurité des comptes |
| `?tab=settings&reglage=journal-vrm` | `journal-vrm` | Sécurité des données |
| `?tab=settings&reglage=tes-donnees` | `tes-donnees` | Sécurité des données |
| `?tab=settings&section=notifications` | `push` | Notifications |
| `?tab=settings&section=supprimer` | `fermer` | Mon compte |
| `?tab=settings&section=demandesaide` | `demandes-aide` | Aide et « Tout va bien ? » |
| `?tab=settings&section=rappels` | `rappels` | Notifications |
| `?tab=settings&section=appareils` | `appareils` | Mon compte |
| `?tab=settings&section=importer` | `importer` | Sécurité des données |
| `?tab=settings&section=toutvabien` | `toutvabien` | Aide et « Tout va bien ? » |
| `?tab=settings&section=sante` | `sante` | Aide et « Tout va bien ? » |
| `?tab=settings&section=santecomptes` | `santecomptes` | Sécurité des comptes |
| `?tab=settings&section=discretion` | `discretion` | Sécurité des comptes |
| `?tab=settings&vue=compte` (retour Discord) | — | Mon compte |
| `?abonnement=merci` / `?vue=abonnement` (retour Stripe) | `abonnement` | Mon compte |
| conseils `reglages:X`, cloche, ligne de fraîcheur, santé, MFA (`DEMANDE_REGLAGE_SOUS`) | X | sa catégorie (`allerAuReglage`) |

## 4. Les bancs d'avant

~70 bancs touchaient `[data-sous-ouvrir="X"]` ou `[data-onglets-reglages] [data-vue="compte"]`
dès `?tab=settings`. Au téléphone, une rangée vit maintenant DANS sa catégorie.
`scripts/bancs/_reglages-compat.cjs` (posé par `_porte-banc.cjs`, et en tête des 21 bancs qui ne
la chargent pas) fait le geste du vendeur et rien d'autre : avant qu'un banc touche / attende / lise
une rangée de Paramètres qui n'est pas visible, il remonte (« ‹ ») puis touche la catégorie qui la
range (`[data-categorie-contient~="X"]`). La rangée « Mon compte » porte `data-vue="compte"`, la
rangée Abonnement `data-vue="abonnement"`. `parametres-refonte.cjs` juge le chemin à la main
(`BANC_REGLAGES_SANS_AIDE=1`). `refonte-plateformes-reglages.cjs` (R : chaque réglage d'avant
joignable) parcourt maintenant les dix catégories au lieu des trois vues.
Audits mis à la nouvelle forme (même règle) : `audit-coque-parametres` (bloc « Mon compte »),
`audit-centre-aide` (liste fermée = `REGLAGES_AIDE` + `LIENS_PROFONDS`), `audit-onglets-d` (C1, C3, C4).

## 5. Preuves

RÉSULTATS — voir §6 (rempli après les bancs).

## 6. Résultats

(voir ci-dessous)
