# 10 nov. 2026 — Textes courts, suite (lot AI)

Branche `claude/textes-courts-suite` (depuis `origin/main` 6201434c, puis un vrai `git merge origin/main` qui
amène « Argent », note privée, achats doubles…), poussée à chaque commit. **Pas de PR, pas de fusion.**

## Ce que Julien a dit

« Encore du texte » ; « je n'aime pas du tout les pop-up, ça n'a rien changé ». Donc : **ne pas déplacer le même
paragraphe dans une feuille, le RÉDUIRE** — une phrase de 12 mots environ (le fait + le geste), le détail sous
« Pourquoi ? » seulement s'il est indispensable. Règle et forme : `docs/passation/2026-11-09-popups-propre.md`.

## Ce qui a été fait

Chaque texte de plus de 90 caractères affiché à l'écran a été **réécrit** (pas déplacé). Le sens ne change jamais :
une alerte dit toujours son geste (§2.7), « pas su » reste « pas lu / — », « au moins » reste, ce qui est
irréversible reste dit (eBay : « sans retour », « TOUT SEUL, sans te demander » ; double vente : « retire-la »).

Relevé statique (textes JSX visibles de plus de 90 caractères, hors attributs ; script en tête de ce récit) :

| fichier | avant | après | ce qui reste |
|---|---|---|---|
| `src/ecrans/Reglages.jsx` | 86 | 12 | 4 du panneau « Sécurité des données » (§5, **pas touché**), des chemins de menu (Gmail, iPhone), le détail replié sous `Pourquoi` |
| `src/ecrans/Ebay.jsx` | 54 | 14 | détails sous `Pourquoi` (double vente, inactives) ; les confirmations et messages d'incertitude (« je ne sais pas si l'annonce est partie… ») gardés tels quels |
| `src/ecrans/Leboncoin.jsx` | 40 | 7 | idem (confirmations de suppression, `Pourquoi`) |
| `src/ecrans/Vestiaire.jsx` | 17 | 3 | carte Photoroom (coût), `Pourquoi` |
| `src/ecrans/MessagesLeboncoin.jsx` | 5 | 0 | — |
| `src/ecrans/Achats.jsx` | 1 | 0 | (textes seulement : `claude/photos-achats` y travaille) |
| `src/App.jsx` | 247 | 144 | dont **~100 dans `Comptabilite`** (pas touchée : `claude/compta-stats` y travaillait), l'écran de connexion (avertissements propriétaire), `ExtEnRetard` (consigne jugée mot à mot par `audit-extension-zip`), CGV/rétractation, seuils DAC7, `Pourquoi` |

Écrans traités, dans l'ordre demandé : **Réglages/Paramètres** (imprimante, comptes liés, notifications, dépannage,
double vérification, fermer le compte, abonnement, parrainage, équipe, affichage, objectif, numéros, N° sur
Vinted, e-mails et adresses, extension), **eBay** (publication, photos, compte, offres, programmation, inactives,
retrait automatique, règles d'offre), **Leboncoin** (dépôt, colis, republier, à retirer, à confirmer, file),
**Vestiaire** (Photoroom, annonces, ventes, messages, publication), **Messages** (Leboncoin, Vestiaire),
**Achats** (Leboncoin, Vestiaire, suivi Vinted, suivis manuels), **Ventes** (Leboncoin), puis **App.jsx** :
recherche, relais téléphone, transporteurs, panne de base, photos bloquées, adresse confirmée, équipe, premiers
pas (installation de l'extension), hors ligne, abonnement requis, double vérification à la connexion, Stock 3D
et rangement, sauvegarde.

Exemples (avant → après) :
- « Je n'ai pas pu lire la liste de tes comptes — elle est vide parce que la lecture a échoué, pas parce
  qu'aucun compte n'est lié. Rien n'est perdu. » → « Liste des comptes pas lue (pas vide) : rien n'est perdu. »
- « VRM ne va rien chercher tout seul sur Vinted. C'est une petite extension… » (×5) → « Une petite extension
  lit tes pages Vinted et range tout ici. »
- eBay : « VRM retire TOUT SEUL d'eBay, sans te demander, un article prouvé vendu sur Vinted (N° sur
  l'annonce). Sans retour : sinon, éteins l'interrupteur. »

## Audits jugés et adaptés

Aucun audit n'a été affaibli. Avant chaque remplacement, un script cherchait dans `scripts/` des morceaux du texte
d'avant ; les libellés qu'un banc lit sont **gardés** dans la phrase courte : `pas pu lire tes brouillons`
(ebay-programmer), `TOUT SEUL` + `sans te demander` (ebay-annonces), `tu ne paies jamais le port` (ebay-form),
`gardée par VRM n'est pas repayée` (photoroom-carte), `service de messagerie à part` et `envoie une réponse
toi-même` (vestiaire-messages, messages-sites), `jamais le texte` (messages-sites), `panier n'est jamais lu`
(vestiaire), `n'a pas pu être lu` / `ne donne pas de date` (suivi-colis), `n'a pas pu être enregistrée`
(sauvegarde), `connecté avec le compte qui a ajouté` (adresses-preuve), `sur l'ordinateur où elle est
installée` (transporteurs), `pas détectée dans ce navigateur` (lbc-supprimer), `Les tiennes restent reçues`,
`un autre compte a déclaré`, `aucun e-mail ne t'est attribué`, `te reviennent` (adresses-preuve,
emails-mis-de-cote), `résiliable à tout moment`, `sans engagement` (abonnement).

## Preuves

- `scripts/bancs/popups-propre.cjs` : `ECRANS` prolongé de 11 écrans (reglages, ventes-vinted, ventes-ebay,
  annonces-ebay, ventes-leboncoin, annonces-leboncoin, ventes-vestiaire, messages, messages-leboncoin, achats,
  achats-vestiaire) ; filtres `ECRANS_SEULS` / `VUES_SEULES` pour les relancer à part. Premier passage : **3 rouges**
  (Réglages « Tout en une fois : ce que tu vends… », Ventes Vestiaire « Pas encore lues : ouvre « Mes ventes »… »,
  Achats Vestiaire « Pas encore lus. Ouvre tes achats… ») ⇒ réécrits ⇒ **239 verts, 0 rouge** (390 tactile sombre
  et clair, 1512 clair). Captures regardées (Achats Vestiaire 390 sombre, Paramètres 1512 clair).
  ⚠️ Avec les données du banc (aucun compte eBay/Leboncoin), `annonces-ebay`/`annonces-leboncoin` et
  `messages-leboncoin` rendent le même écran que Vinted : le filtre de site n'apparaît qu'avec un compte du site.
- `npm run build` vert ; audits `variables`, `tdz`, `coherence`, `identite`, `icones`, `boutons`, `statuts`,
  `urssaf` verts. Comparaison de tous les audits avant/après : voir « Ce qui reste ».
- Zips de l'extension : le build les régénère (octets différents, même contenu) ; remis à l'identique de `main`.

## Ce qui reste

- **Compta / Statistiques** (≈ 100 textes dans `Comptabilite`, 36 dans `src/ecrans/Compta.jsx`) : libre depuis
  « Argent », pas fait faute de temps.
- `src/ecrans/Republier.jsx` (32), `src/Accueil.jsx` (16), `src/FacturePro.jsx` (12), `Operations.jsx`,
  `FavorisVinted.jsx`, `InventaireStock.jsx`… (relevé : ~150 textes hors App.jsx).
- Les messages de confirmation et d'incertitude (toasts, `askConfirm`) d'eBay/Leboncoin : gardés longs exprès
  (ils disent ce qui est irréversible et ce qu'on ne sait pas) — à raccourcir seulement avec Julien.
- Les infobulles `title` (état d'un compte Vinted dans Comptes liés) restent longues (invisibles au doigt).
