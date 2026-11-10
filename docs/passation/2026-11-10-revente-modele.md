# 10 novembre — Lot AV : ce que tu as réellement revendu ce modèle

Branche `claude/revente-modele` (depuis `origin/main`). Proposition 5 (validée) : sur la
fiche d'un achat et à la saisie d'un achat, ce que Julien a RÉELLEMENT vendu ce modèle
les dernières fois. Le passé, jamais un conseil (prix conseillé refusé le 11 oct.).
L'extension n'est pas touchée.

## La règle — `src/reventeModele.js` (pur)
- **Source** : le relevé de l'écran Ventes `vrm_stats_ventes` (§11 : ventes FINALISÉES,
  donc prouvées, prix d'achat relié par identité seulement). Rien n'est relu ni écrit.
- **Modèle** : `modeleSur` de `src/ceQuiRapporte.js` (importé, pas recopié), lu sur le
  titre de LA vente. Une ressemblance d'affichage, jamais une identité ni une action.
  Modèle pas sûr ⇒ rien n'est dit. ⚠️ Limite connue : le relevé ne porte pas la marque ;
  un modèle « numéro seul » (New Balance 550…) n'est reconnu côté ventes que si
  « New Balance » est dans le titre — sinon la vente n'est pas comptée (mieux vaut un
  blanc qu'un faux).
- **Chiffres** sur les 10 ventes les plus récentes du modèle (« sur N », total gardé) :
  prix de vente médian ; bénéfice médian par `beneficePaire` (vente − prix d'achat SAISI −
  frais saisis), seulement sur les ventes au prix d'achat connu (« sur 4 des 5 »), aucune ⇒
  « — » ; délai médian de la mise en ligne (annonce reliée par SA transaction,
  `lireExtrasRepartition` + `dateMiseEnLigneMs`, lu seulement quand on déplie) à la vente,
  phrase `phraseMoitie` ; pas lu ⇒ « — ».
- Moins de 3 ventes ⇒ « Pas assez de ventes de ce modèle (N) » ; 0 ⇒ « Aucune vente de ce
  modèle pour l'instant » ; relevé absent sur l'appareil ⇒ « pas encore lues ici » (jamais 0) ;
  vente au montant illisible ⇒ écartée et comptée.

## Où — `src/ReventeModele.jsx` (repli `vrm-repli`, aucun bouton, aucune écriture)
- Achats → Achats hors plateforme → « + Ajouter »/Modifier : sous « Tu as déjà N paires »
  (`src/ecrans/Achats.jsx`, 3 lignes).
- « Prix d'achat à compléter » : sous « déjà N » (App.jsx, 1 ligne).
- Fiche d'un achat Vinted : menu ⋯ → « Revendu combien ? » (seulement si le modèle est
  reconnu) ⇒ feuille dépliée (App.jsx : 1 état, 1 entrée de menu, 1 feuille).

## Preuves
- `node scripts/audit-revente-modele.cjs` : 25 verts ; `--prouve` 11/11 mutations rouges
  (seuil 3 → 1, modèle ignoré, achat absent pris pour 0, frais ignorés, relevé absent pris
  pour vide, montant illisible pris pour 0, tri ancien, délai négatif, phrase « prix
  conseillé », menu de la fiche tué, saisie tuée). Sur `origin/main` (git archive) : rouge.
- Banc `scripts/bancs/revente-modele.cjs` (390 px tactile sombre + 1512 px, données
  inventées) : 26/26 ; captures regardées `revente-modele-{390,1512}-{saisie,feuille}.png`.
- `npm run build` ; audits `variables`, `tdz`, `coherence`, `identite`, `icones`,
  `plancher-stock`, `ce-qui-rapporte`, `benefice-unique` : verts.

## Reste
- Délai : seulement Vinted (Leboncoin/eBay/Vestiaire n'ont pas de date de mise en ligne reliée).
- Le prix médian s'écrit dans la phrase repliée ET dans la case dépliée (même chiffre deux fois
  une fois ouvert) — à simplifier si Julien le juge redondant.

## Geste de Julien
Aucun. Ouvrir une fois Ventes sur l'appareil (le relevé y est publié).
