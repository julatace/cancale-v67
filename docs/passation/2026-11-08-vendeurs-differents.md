# 8 nov. — VRM pour des vendeurs différents de Julien

Branche `claude/vendeurs-differents` (depuis `claude/amazing-lovelace-xd7obl`). Julien :
« fais tout » — d'autres vendeurs vont payer. Quatre chantiers.

## 1. Affichage Simple / Complet

- Réglage `vrm_affichage` = `{ choix: 'auto' | 'simple' | 'complet', at }`, synchronisé
  (SYNC_KEYS), dans **Paramètres → Affichage → Affichage** (Automatique · Simple · Complet).
- Règle pure : `src/profilVendeur.js` (`affichageAuto`, `affichageEffectif`).
  Automatique = **Simple seulement si l'on SAIT** : pas le propriétaire de l'installation
  (Julien : jamais), **un** compte Vinted, **moins de 30 ventes lues sur 30 jours**
  (`ventesSur30j` sur les lignes de « Vendu » de la coque ; lecture partielle ⇒ pas su).
  Tout « pas su » ⇒ Complet. Son choix gagne toujours.
- Décidé une fois par la coque (`AppCoeur`, effet « LE PROFIL DU VENDEUR ») et publié dans
  `PROFIL_VENDEUR` (abonnés : `useProfilVendeur`).
- En Simple : `groupesVisibles` (colonne de l'ordinateur et « Plus » du téléphone) passe par
  `entreeMontree` — Stock caché seulement **sans aucun meuble** (`vrm_meubles`/`vrm_slots`),
  Republier seulement **jamais lancé** (`vrm_repub_main`, journal), un site seulement
  **prouvé non relié** (`sitesLus`, comptes eBay du registre). Les filtres de site
  (`FiltreSites`) suivent `siteMontre` (Vinted et le site choisi restent). Ma journée tait
  le seul conseil « Prix à baisser » (`caseJourneeMontree`) ; son compteur reste dans le
  bloc caché `data-tuile`.
- **Aucun total ne change** : le mode n'est lu que par la navigation, les filtres et les
  cases (contrôle B1 de l'audit) ; `VentesToutes` reçoit toujours tous les sites.
  Rien n'est supprimé : chaque écran reste joignable par son lien (`?tab=garage`…).
- Pas fait : un « Organisation » (déjà hors du menu), un sélecteur multi-comptes (avec un
  seul compte il ne s'affiche pas déjà).

## 2. Hors sneakers : taille et marque facultatives

- Réglage `vrm_je_vends` = `{ choix: 'auto' | 'sneakers' | 'autre', at }`, synchronisé,
  dans Paramètres → Affichage → Je vends. Défaut : **Sneakers pour le propriétaire**
  (Julien), Autre sinon (un mot neutre ne trompe personne ; « Taille absente » sur un livre, si).
- `problemesAnnonce` / `champsNonJuges` (src/verifAnnonce.js) : `facultatifs: true` ⇒ ni
  « Taille absente », ni « Marque absente », ni « pas lues ». Passé par les CINQ
  vérifications : Republier (carré d'actions), Publier ailleurs (`manquesEnvoi`), eBay,
  Leboncoin, Vestiaire ; et la liste de qualité (`qualityList`, morte mais gardée juste).
  Un vendeur de sneakers garde exactement les mêmes contrôles qu'avant.
- Mots (« paire » / « article », `motsArticle`, formes écrites en entier, jamais un
  remplacement dans une phrase) : Bienvenue (`demoBienvenue`), le choix de numérotation du
  guide (`choixNumerotation`), le conseil « dorment » (contexte `vend`), Stock (« N articles
  en stock », « à ranger »), Paramètres → Numéros, eBay (« Pointure » → « Taille »).
- **Reste à faire** : « paire » est écrit ~1 800 fois dans l'app (dont beaucoup en
  commentaires) ; seuls les textes du premier parcours ont été passés. Les autres écrans
  (Ventes, Colis, Annonces…) gardent « paire » : à passer écran par écran avec
  `useMotsArticle()`. Les statistiques « prix qui marche » et les filtres taille/marque
  n'avaient rien d'obligatoire (vérifié) ; « N ventes sans taille connue » est une note grise.

## 3. Mode équipe : état exact

- La migration **016 n'est PAS appliquée** (CLAUDE.md §5) — je ne l'ai pas appliquée.
- Côté app, tout existait déjà (invitation, `PorteEquipe`, `ColisEquipe` : colis à
  expédier et à retirer, codes, impression, rien d'autre ; en-tête `x-vrm-equipe`).
- Ajouté : tant que la 016 manque, Réglages → Équipe dit la phrase d'avant (bancs inchangés),
  **qui fait le geste** (propriétaire : « la mise à jour 016 de la base (Supabase) » ; autre
  vendeur : « rien à faire de ton côté ») et **ce que verra l'aide** (`CE_QUE_VOIT_UN_MEMBRE`).
  Aucun bouton « Inviter » qui ne mènerait nulle part.
- Geste de Julien : appliquer la 016 (essai annulé déjà fait), puis
  `node scripts/equipe-sql/essai-annule.cjs --verifier`.

## 4. iPhone seul (Orion)

- Règle : `phraseOuExtension` / `ouExtensionIci` (src/navigateurExtension.js) — Orion
  (iPhone) « dans Orion, sur cet iPhone », Firefox Android « dans Firefox, sur ce téléphone »,
  Safari d'iPhone « sur ton ordinateur ou dans Orion sur iPhone » (si la fiche est publiée),
  ordinateur « dans ce navigateur ».
- Phrases corrigées : Bienvenue (« Installer l'extension … »), Ventes → Tous sans compte
  (deux endroits), Ma journée (date de versement), « Vérifier mon installation »
  (`pont.ici` : sur Orion l'extension s'installe ICI, plus « Elle vit sur ton ordinateur »),
  relais du téléphone (Safari d'iPhone : « ou depuis Orion, sur cet iPhone »), Leboncoin
  (photos : « là où est l'extension »), Messages Leboncoin et Compta (« là où elle est
  installée »), eBay (« ouvre Vinted là où est l'extension »).
- Laissé : les phrases du RELAIS (l'extension d'un autre appareil qui agit pour le téléphone)
  disent « ordinateur » — vrai dans ce mode ; la page d'accueil publique (« Une installation,
  sur ton ordinateur ») ; « Préparer sur eBay / Vestiaire se fait sur l'ordinateur ».
- Parcours rendu au banc dans Orion (agent d'iPhone + `window.KAGI`) : Ma journée, Ventes,
  Paramètres → Vérifier mon installation. **Pas essayé sur un vrai iPhone** (impression d'un
  bordereau en PDF et retrait : les écrans sont les mêmes que sur Safari, déjà couverts par
  les bancs Colis ; l'extension dans Orion reste « essai », src/navigateurExtension.js).

## Preuves

- `node scripts/audit-vendeurs-differents.cjs --prouve` : 42 contrôles verts, **14/14
  mutations** attrapées ; sur la branche de départ (d7ebe93a, `git archive`) : **13 rouges**.
- `scripts/bancs/vendeurs-differents.cjs` (l'app rendue, données de `nouveau-vendeur.cjs`
  réduites à un compte ; `SHOTS=dossier`).
- Audits verts : variables, tdz, identite, statuts, coherence, violet, equipe-sql,
  equipe-ecriture-membre, verif-annonce (`--prouve` 11/11 après mise à jour de la mutation
  `sans_marque`), guide-iphone, accompagnement, conseils, fonctions-api, icones,
  annonces-actions (F5 accepte `verifV`), et 23 autres qui lisent les mêmes textes.
- `audit-benefice` est rouge AVANT ce chantier (« boutiqueOrion déjà déclaré » dans le texte
  recollé de `_source-app.cjs`) : pas de mon fait, à corriger dans `_source-app.cjs`.
