# Lot T — Facture en anglais + seuil de TVA à côté des factures (10 nov. 2026)

Branche `claude/facture-en-tva`. Propositions 29 et 30 (`2026-11-09-propositions.md`), validées.

## 1. « Facture en anglais » — une option par facture

**Où** : la feuille « Envoyer la facture » d'une vente Pro (section « L'article »),
une case de 44 px. Pré-cochée seulement quand l'adresse PROUVÉE de l'acheteur
(remise en lignes par `adresseVintedLisible`) finit par un pays étranger
(`acheteurHorsFrance`, un indice — c'est son clic qui émet).

**Ce que ça fait** : la facture devient BILINGUE, pas « traduite » :
- chaque libellé s'écrit « français / English » à la même taille, le français d'abord
  (`bi()`, `src/facturePro/anglais.js`) — aperçu, PDF, objet et e-mail ;
- les mentions légales restent MOT POUR MOT en français (« TVA non applicable,
  art. 293 B du CGI », « Régime particulier – Biens d'occasion… »), suivies de leur
  traduction (marge : la formule de la directive 2006/112/CE art. 226-14,
  « Margin scheme – Second-hand goods ») ;
- devise : toujours l'euro (CLAUDE.md §3) ; dates jj/mm/aaaa ; l'app reste en français ;
- les textes libres du vendeur (désignation, note, mention de paiement, message
  personnalisé) ne sont jamais traduits ; le message PAR DÉFAUT devient anglais puis français.

**Pourquoi bilingue** (sources en tête de `src/facturePro/anglais.js`) :
- loi n° 94-665 (« Toubon ») art. 2 : français obligatoire dans « les factures et
  quittances », non exclusif ; la réponse ministérielle QE n° 2838 (15e lég.) exige
  que le français soit « aussi lisible et intelligible » que la traduction ;
- service-public F31411 : une facture peut être en langue étrangère, mais
  l'administration peut exiger une traduction certifiée par un traducteur juré.
- ⚠️ entreprendre.service-public.gouv.fr et legifrance n'étaient pas joignables
  depuis la session (réseau) : les citations viennent de recherches ; à relire par
  un humain si besoin.

**Figée** : `contenuFacture(..., { langue: 'en' })` ajoute `contenu.anglais`
(mentions traduites, phrase de paiement) à l'instantané ; sans l'option, l'instantané
est OCTET POUR OCTET celui d'avant (aucune clé ajoutée). Le serveur
(`api/_lib/facture-pro.js`, `emettre`) ne lit que `corps.langue === 'en'`. Une facture
émise ne change plus de langue ; un avoir reprend l'instantané (« AVOIR / CREDIT
NOTE », « Amount refunded to the buyer. »). L'envoi automatique (lot Q) émet en français.

## 2. Seuil de TVA à côté des factures

**Où** : Argent → Factures, en tête (carte DA6, `src/SeuilTvaFactures.jsx`, chargée à la demande).

**Règle** (`src/seuilTvaFacture.js`) : AUCUN chiffre recalculé — `jaugeSeuils`
(`src/microEntreprise.js`, la jauge de Comptabilité) sur la ligne publiée
`vinted_urssaf_mois` (CA daté au versement), seuils 2026 vérifiés (85 000 € /
93 500 €, services 37 500 € / 41 250 €), borne `PROCHE_PCT` 80 %. Une seule lecture
ajoutée : `tva_regime` de « Ma facture » (le cache partagé `useFicheFacturation`).
- pas de ligne / pas de seuils ⇒ rien ;
- fiche en lecture ou illisible ⇒ jamais d'alerte ;
- TVA classique ou marge ⇒ « Tu factures déjà la TVA. », aucune alerte ;
- franchise ou régime pas choisi : ≥ 80 % ⇒ ambre « Tu factures sans TVA : 82 % du
  seuil. » + « TVA dès le 1er janvier N+1 » ; > 85 000 € « dépassé » ; > 93 500 € « due
  le jour du dépassement » ; CA N-1 > 85 000 € « due depuis janvier » ;
- CA partiel = un minimum : l'alerte seulement quand elle est certaine, « au moins ».
- Porte : « Mon régime de TVA » ouvre « Ma facture » sous la carte, sur le champ `tva_regime`.

## Preuves
- `scripts/audit-facture-en-tva.cjs` (36) : règles EXÉCUTÉES, PDF décompressé et lu,
  e-mail, avoir, seuil (bornes, pas su, assujetti, partiel, services), branchement.
- `scripts/audit-facture-pro.cjs` T1-T4 (99 au total) : la VRAIE route émet en anglais, figé.
- Sur `origin/main` (git archive) : l'audit lève (module absent), T1/T3 rouges.
- Mutations (copie, `scratchpad/mutations-T.sh`) : alerte sur fiche illisible (S10),
  borne 70 % (S4, S12), mention française retirée du PDF (F9), libellés anglais seuls
  (F9, F10, F13), alerte à l'assujetti (S9), serveur forçant l'anglais (T2, T4),
  traduction non figée (F3) ⇒ toutes rouges.
- Banc `scripts/bancs/facture-en-tva.cjs` (88/0) : 390 tactile et 1512, clair et sombre ;
  captures regardées (un fond blanc en sombre corrigé : jeton `--vrm-surface`, et le banc
  le vérifie désormais).
- `npm run build` ; audits variables, tdz, coherence, identite, icones, seuils-annee,
  fonctions-api, factures-pro-2 : verts.

## Geste de Julien
Aucun. (Compléter « Ma facture », déjà listé, rend l'alerte précise sur son régime.)
