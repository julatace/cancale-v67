# 12 nov. — Vitesse à 20 000 ventes (second agent, branche `claude/agent2-vitesse-volume`)

Partie de `claude/agent2-vert-vitesse` (à intégrer avec elle ou après elle).

## 1. La preuve qu'aucun chiffre ne change
- `scripts/bancs/chiffres-volume.cjs <dist> <sortie.json>` (`VENTES=20000` ou base par défaut) : ouvre
  Ma journée, Ventes, Achats, Colis, Argent, Déclarer, Statistiques dans le même navigateur, attend le
  calme sur chaque écran, relève chaque montant (« € »), chaque compte (« N ventes / colis / comptes… »),
  chaque nombre porté par un attribut `data-*`, et ce que les écrans publient (`vinted_urssaf_mois`,
  `vrm_benefice_jours`, `vrm_colis_aposter`, `vrm_colis_retirer`, `widget_stats`, `vrm_compta`…, sans
  les horodatages). Bénéfice, CA vendu, CA déclaré par mois, URSSAF, argent en attente, colis, comptes :
  tout ce que l'écran montre ou publie.
- `scripts/compare-chiffres-volume.cjs avant.json apres.json` : compare au centime (35 relevés).
- Le banc est déterministe : deux passes du MÊME build ⇒ 35/35 identiques (une heure dans un attribut,
  `data-rp-verifie`, est neutralisée).
- Il voit un changement de règle : mutation « un remboursement n'est plus une annulation » ⇒ rouge sur
  Ma journée (3 227 € → 3 787 €), Ventes (140 → 210 ventes), et le reste.
- Résultat final : **20 000 ventes 35/35 identiques ; base par défaut 35/35 identiques.**

## 2. Ce qui a changé (aucune règle, seulement « calculer une fois »)
- **Ventes visibles par version des données** : `isHidden` garde sa réponse par vente tant que ventes
  masquées, comptes masqués / écartés et l'offre (`signaturePlan`) ne changent pas (`isHiddenCalcul` est
  la règle d'avant, mot pour mot) ; `acctOff` garde sa réponse par compte (comptes masqués / écartés).
- **`classifyOrderStatus` et `photoKey`** : une mémoire par chaîne posée SUR la fonction (`f.memo`),
  le corps d'avant enveloppé tel quel — les audits qui extraient ces fonctions les exécutent toujours.
  Miroir serveur refabriqué (`audit-bilan-semaine --recopie` ⇒ `api/_lib/ventes-regle.js`).
- **Les règles d'identité** (`entryKeyByPhoto`, `identiteAnnonce`, `resolvedEntry`, `effEntry`) passent de
  `memoRendu` (une mémoire d'un SEUL rendu) à `memoVersion(nom, règle, clé)` : la mémoire est gardée tant
  que TOUT ce que la règle lit est identique (par identité) — `numeros`, les index par photo, `txnItem`,
  `txnLink`, `onlineAnnonceIds`, `saleOv`, `buyByNum`, `bordsVenteEmailParTx`, `bordLinks`,
  `labelsCaptes`, et les réglages du module (coupure, archive, « N° écrit »). La clé est relue une fois
  par calcul synchrone. Mesuré : Comptabilite se rend ~19 fois avant « prêt » à 20 000 ventes.
- Audits portés sur la nouvelle forme (même règle jugée) : `audit-plans-solo-pro`, `audit-identite`,
  `audit-bordereau-des-email`, `audit-numerotation-lecteurs`.

## 3. La vitesse, en médiane
- `scripts/bancs/vitesse-volume.cjs <distA> <distB>` : `_mesure-demarrage` (390, CPU ×4, 4G,
  `VENTES=20000`) PASSES fois, builds alternés, médiane. Une passe seule varie du simple au double
  (machine partagée) : seule la médiane se compare.
- Médiane de 5, avant (branche vert-vitesse) → après :

| écran | prêt | tâches longues | plus longue |
|---|---|---|---|
| Ma journée | 16,1 → **12,8 s** | 15,5 → 12,2 s | 4,1 → 3,4 s |
| Ventes | 19,1 → **16,2 s** | 19,0 → 15,3 s | 4,4 → 3,5 s |
| Achats | 18,8 → 8,4 s (très dispersé : 7,5 à 25 s avant) | 15,3 → 14,0 s | 10,3 → 8,5 s |

  Ma journée et Ventes : chaque passe « après » est sous chaque passe « avant ».
- **Objectif < 2 s non atteint** (la machine du banc était chargée : la même mesure donnait 7 à 9 s
  plus tôt dans la journée). Le reste, au profil (Ventes, après) : `propositionsPrix` ~1,5 s (useMemo
  aux dépendances qui bougent pendant le chargement : `achatsIdentite`, `indexRecusAchat`,
  `linkedBuyIds`), `cartesColis` ~1,1 s (au rendu, sans mémoire), `totals` ~0,9 s, `ajusterChiffre`
  0,5 s, `listeEnvoyes` 0,3 s. Prochaine étape : rendre ces dépendances stables, mémoriser
  `cartesColis`, ou calculer Argent seulement à son ouverture — toujours sous `chiffres-volume`.
- `scripts/budget-vitesse.json` (lectures, octets, JS) : non touché par ce lot (rien relevé).

## 4. Preuves
- `npm run build` ; audits tdz, variables, identite, coherence, plans-solo-pro, bordereau-des-email,
  numerotation-lecteurs, bilan-semaine (54/0), annulations-compte, doublons-historique,
  en-ligne-deux-fois, flux-divers, achats-export, ce-qui-rapporte, urssaf, et tous les audits qui
  lisent `classifyOrderStatus` / `photoKey` : verts.

## 5. Gestes de Julien
Aucun.
