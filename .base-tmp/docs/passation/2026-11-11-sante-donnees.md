# 11 nov. 2026 — « Santé de tes données » (lot sante-donnees)

Branche `claude/sante-donnees`. Aucune écriture en base réelle, aucune PR ni merge dans `main`.

## La demande

Un seul écran (Paramètres → « Santé de tes données », et une ligne compacte dans
« Tout va bien ? ») qui liste, par ordre de gravité, ce qui cloche ; chaque ligne = un
nombre (règle du propriétaire, jamais recalculée), une phrase, UN bouton qui ouvre le
parcours de correction. « Pas su » ⇒ « — », jamais 0. Rien n'est corrigé tout seul.
« Tout est à jour ✓ » seulement si TOUTES les lectures ont réussi.

## Ce qui est livré

| fichier | rôle |
|---|---|
| `src/santeDonnees.js` | module PUR : les 12 lignes (ordre = gravité), `lignesSante`, `resumeSante`, `aVoirCapture`, la petite publication `vrm_sante` |
| `src/SanteDonnees.jsx` | la forme : `useSanteDonnees`, l'écran `SanteDonnees`, la ligne `LigneSante` |
| `src/styles-sante-donnees.css` | forme de « Tout va bien ? » ; rouge pour la seule ligne « deux articles sous un N° » |
| `src/ToutVaBien.jsx` | appelle `aVoirCapture` (son « N choses à voir » d'avant, déplacé tel quel) et porte `LigneSante` sur SA lecture |
| `src/ecrans/Reglages.jsx` | Paramètres → Mes comptes → « Santé de tes données » (panneau `sante`), sous « Tout va bien ? » |
| `src/App.jsx` | deux publications (`colis-a-confirmer`, `annonces-a-confirmer`), le lien `?tab=settings&section=sante`, l'effet `vrm:sante-aller` de la coque |
| `src/JournalEmails.jsx` | `lireAVerifierEmails` : la lecture du compteur « à vérifier » sortie de `EntreeJournalEmails` (partagée) |
| `scripts/audit-sante-donnees.cjs` | audit qui EXÉCUTE les règles des propriétaires ; `--mutations` (8) |
| `scripts/bancs/sante-donnees.cjs` | banc S/C/G/P/Z, 390 et 1512, clair et sombre |

### D'où vient chaque nombre (aucun n'est recompté)

| ligne (ordre) | propriétaire | bouton |
|---|---|---|
| Deux articles sous le même N° (**rouge**) | Colis/Annonces → `vrm_a_trancher` `numeros-double` | Colis › À envoyer, bloc `[data-numeros-double]` |
| Nouveaux N° à écrire | `numeros-a-ecrire` | Colis, bloc « C'est écrit » |
| Colis à confirmer (« Tout est OK ») | Achats : `aConfirmerVisibles` → `vrm_sante` (NEUF) | Achats, bloc `[data-a-confirmer]` |
| Colis « posté » pas vus partir | `colis-postes` | Colis › Envoyés |
| E-mails mis de côté | `useMisDeCote` (route `email-rattacher?mode=liste`) | E-mails › Relier, « à traiter » |
| E-mails à vérifier | compteur du journal (`compteurs.aVerifier`) | E-mails › journal filtré « à vérifier » |
| Articles sans prix d'achat | `achats-sans-prix` (`aRelierJournee`) | **la saisie en série** (`DEMANDE_SAISIE_PRIX`, celle de « Coût d'achat · 1/184 ») |
| Ventes non reliées à un achat | Ventes → `vrm_sources_ventes`, `beneficeParSource().sansAchat` | la même saisie en série (elle prend ventes et fiches) |
| Ventes sans date de versement | Ventes → `vinted_urssaf_mois.aDater` | Argent › Déclarer `[data-urssaf-dater]` (les raisons, `versementRaisons.js`) |
| Comptes pas relus | `aVoirCapture` = la règle de « Tout va bien ? » (`lignesFraicheur`, pannes) | Paramètres › Tout va bien ? |
| Extension en retard | `aVoirCapture` (`etatVersion`, api/_lib/garde-capture.js) | Paramètres › Tout va bien ? (gestes d'installation) |
| Annonces « à confirmer » | Annonces : `annAConfirmer` (le nombre de `FraicheurAnnonces`) → `vrm_sante` (NEUF) | Annonces |

Trois états partout : `undefined` lecture · `null` pas su (« — » + la raison, et une porte
discrète « Ouvrir » vers l'écran qui le compte) · un entier. Une publication de plus de 12 h
redevient « pas su » (la règle d'À trancher). Une partie des comptes pas lue : un nombre > 0
se dit « au moins », 0 devient « pas su ».

**Interprétations à valider par Julien** : « colis pas confirmé depuis… » = deux lignes,
« Colis à confirmer (« Tout est OK ») » (date limite Vinted) et « Colis coché posté pas vu
partir ». « Ventes non reliées » = les ventes FINALISÉES sans achat relié publiées par Ventes
(toutes périodes).

## Gestes comptés (Julien : « gagner du temps »)

Avant : pour faire le tour, il fallait ouvrir À trancher (N°, prix, ventes à dater), Achats
(colis à confirmer), E-mails (mis de côté, journal), Paramètres › Tout va bien ? (comptes,
extension), Annonces (à confirmer), Argent › Statistiques (ventes sans achat relié) : **6
écrans, ~12 touches** juste pour SAVOIR. Après : **2 touches** (Paramètres → Santé de tes
données), ou 1 depuis « Tout va bien ? » ; puis 1 touche par problème pour arriver au geste.

## Preuves

- `npm run build` vert.
- Audits verts : variables, tdz, coherence, identite, icones, textes-courts, fonctions-api,
  secrets, a-trancher, **sante-donnees** (60 contrôles). Rouges AVANT et APRÈS (pas de ce lot) :
  `audit-colis-envoi` (1), `audit-signalement` (2) — mêmes échecs sur `origin/main`.
- `node scripts/audit-sante-donnees.cjs --mutations` : les 8 mutations (pas su compté 0,
  « à jour » malgré un pas su, rouge retiré, ventes recomptées à part, publication jamais
  vieille, 0 avec une partie pas lue, tri retiré, un geste qui écrit) rendent l'audit ROUGE.
- Sur `origin/main` (`git archive`) : l'audit échoue (module absent), le banc S échoue (4/4,
  écran introuvable).
- Banc `sante-donnees` : 128 verts (S ×4, C ×2, G ×9, P ×2, Z ×2). Bancs voisins :
  `tout-va-bien` 71 verts, `a-trancher` (voir le rapport de session).
- Captures regardées (1512/390, clair/sombre) : deux défauts vus et corrigés (phrase répétée
  « rien à corriger » / « pas lu · » sur chaque ligne ⇒ dite une fois en tête de groupe ;
  « Revérifier » encadré ⇒ forme de « Tout va bien ? » ; valeur compacte rouge ⇒ ambre).

## Ce qui reste

- Les nombres « pas lu » sur un appareil neuf : chaque écran propriétaire doit avoir été ouvert
  une fois sur CET appareil (publication locale, comme À trancher) — la ligne le dit et « Ouvrir »
  y mène.
- Geste de Julien : aucun (rien à installer ; l'écran est dans Paramètres après déploiement).
