# 9 novembre 2026 — Suites serveur (branche `claude/suites-serveur`)

Chantier noté dans `2026-11-09-passation-generale.md` §4 : l'offre Solo appliquée
aussi par ce que calcule le SERVEUR, et l'alerte serveur de double vente Leboncoin
alignée sur « vue en ligne < 24 h » (extension 5.335). Aucune donnée en production,
rien dans `vinted-sync-extension/`, toujours 12 fonctions `api/`.

## 1. L'offre Solo côté serveur

### Ce qui n'allait pas
L'app écartait des totaux les ventes des comptes d'achat d'un Solo
(`compteEcarte = compteEcarteChoix || venteHorsPlanUid`). Le serveur portait la copie
de `compteEcarteChoix` seule (`api/_lib/ventes-regle.js`, alias `compteEcarte`) : le
bilan de la semaine, le bilan du mois, le repli « e-mails » du widget et le rappel des
offres au prix mini comptaient TOUS les comptes. Seules les notifications « vendu » et
« argent reçu » (api/email-inbound.js) suivaient déjà l'offre.

### La règle, une seule
- `src/App.jsx` : la règle devient PURE,
  `compteEcarteRegle(uid, masques, panneau, regle) = compteEcarteChoix(…) || venteHorsPlan(regle, uid)`
  (`venteHorsPlan` d'`api/_lib/plan-regle.js`, importé tel quel par l'app et le serveur) ;
  `compteEcarte = (uid, m, p) => compteEcarteRegle(uid, m, p, reglePlanCourante())` — même
  résultat qu'avant dans l'app.
- `api/_lib/ventes-regle.js` est **refabriqué** (`node scripts/audit-bilan-semaine.cjs --recopie`,
  jamais à la main) : `compteEcarteRegle` au jeton près, et `compteEcarte = compteEcarteRegle`.
  Sans 4e argument (« pas su », ou un appelant qui ne parle que du COMPTE) ⇒ exactement
  `compteEcarteChoix`. `audit-bilan-semaine` exige l'identité au jeton et l'égalité
  app = serveur sur 140 cas (Solo, Pro, pas su, propriétaire × comptes × choix).
- L'offre d'un vendeur, côté serveur : `regleDuVendeur(owner)` (`api/_lib/plan-vendeur.js`),
  lue de la ligne `abonnements` rangée par le webhook (`statut`, `plan`, `compte_vendeur`,
  migration 028 ; projetée, `owner=eq.`, jamais `select=data`). Le webhook y range déjà
  `planDeLAbonnement(...).plan`, donc **un Solo souscrit sous les CGV d'avant le 9 nov. y
  est `null`** (jamais bridé). Nouveau : **le propriétaire de l'installation est Pro**
  (`proprietaireInstallation`), comme l'app (`regleVentes({ proprietaire: true })`).
- **Pas su ⇒ rien n'est bridé** (comme l'app : « pas su ne bride jamais ») : 028 pas passée
  (400), base injoignable, statut résilié, Solo sans compte choisi, vente sans compte relevé.

### Où elle s'applique maintenant
| lecteur | quoi |
|---|---|
| bilan de la semaine (`api/ship-reminders.js` → `calculerBilan`) | `lireDonneesBilan` porte `regle` ; VENDU, REÇU, et les comptes « pas relus » réclamés : un compte d'achat n'est ni compté ni réclamé |
| bilan du mois (`api/_lib/bilan-mois.js`) | mêmes lectures (`lireDonneesBilan`) et même calcul |
| widget (`api/widget.js`) | le repli sur les e-mails de vente du mois (`email_sale_*`, `uid` rangé par l'adresse de réception) ; la photo publiée par l'app (`widget_stats`, `vinted_urssaf_mois`) l'appliquait déjà |
| rappel des offres au prix mini (`ship-reminders`) | l'offre d'une conversation d'un compte d'achat (`harvest_{uid}_conv_*`) ne sonne pas (`plan-regle` : « offres » du compte vendeur) |
| « vendu », « argent reçu » (`email-inbound`) | inchangé (déjà fait le 9 nov.) |

### Volontairement NON bridé (comme l'app)
- **Colis à envoyer** (widget, bilan, rappel du soir, Ma journée) : l'app compte tous les
  comptes (`toShip` n'écarte même pas un compte masqué : « un colis à poster n'est pas une
  préférence d'affichage ») ; le serveur aussi. Un colis caché est un colis perdu.
- **« Compte pas relu depuis 24 h »** et **pannes de capture** : ils parlent du COMPTE (ses
  achats, ses retraits restent en Solo) ; l'app lit `compteEcarteChoix` pour la fraîcheur.
- Double vente, retraits, achats, URSSAF (ligne publiée par l'app, déjà bridée), Leboncoin,
  eBay, Vestiaire (Solo ne porte que sur Vinted aujourd'hui).

## 2. Double vente Leboncoin : vue en ligne < 24 h

`api/_lib/double-vente.js` (`annoncesLbcParNumero`) gardait `annonceLbcEnVente` seule (le
dernier statut capté). Il exige maintenant, après la règle `<lbc-en-vente-regle>` (inchangée,
comparée texte pour texte par `audit-lbc-restes`), `etatEnLigneLbc(...) === 'enligne'` —
**`src/enLigneLbc.js`, le module pur de l'app, importé tel quel** (aucune copie) : la
dernière lecture COMPLÈTE de « Mes annonces » de son compte (`lbc_listings.lectures`, posée
par l'extension 5.335) a moins de 24 h et la montre. Jamais lue, plus vieille, partielle,
absente de la lecture, compte inconnu ⇒ « à confirmer » ⇒ aucune notification.
`api/email-inbound.js` lit `lectures:data->lectures` avec les annonces (petit objet) ;
forme inconnue ⇒ Leboncoin ne dit rien.

⚠️ Conséquence à connaître : tant que Julien n'a pas ouvert « Mes annonces » en entier sur
chaque compte Leboncoin avec la 5.335 (geste déjà demandé), le serveur ne notifie plus
AUCUNE double vente Leboncoin — c'est la règle « à retirer seulement prouvé » qu'il a
demandée ; l'app dit la carte « à confirmer » avec le geste.

## Preuves

| contrôle | aujourd'hui | code d'avant (`git archive 5cb153db`) | mutations |
|---|---|---|---|
| `scripts/audit-suites-serveur.cjs` — VRAIES routes `ship-reminders` (bilan lundi, mardi, offres mini), `widget`, `calculerBilanMois` sur `lireDonneesBilan`, faux Supabase à la forme réelle (`abonnements` projeté, 400 sans 028, `vrm_acces_pour`), 5 vendeurs UUID (Solo, Pro, pas su, Solo résilié, propriétaire) ; l'attendu vient de `compteEcarteRegle` extraite d'App.jsx | 31 verts | **8 rouges** (Solo : 2 ventes · 540 € au lieu de 1 · 40 €, compte d'achat réclamé, widget, offre du compte d'achat, règle absente d'App.jsx) | `--prouve` : 7 mutations (bilan sans `regle`, règle sans `venteHorsPlan`, lecture sans `regle`, propriétaire bridé, statut ignoré, widget, offres) ⇒ chacune rouge |
| `scripts/bancs/double-vente-push.cjs` (vraie route `email-inbound`) | 34 verts (+ cas 2 bis : 25 h, jamais, absente, partielle, illisible) | **5 rouges** | `--mutation=lecture` ⇒ 3 rouges ; les mutations `titre`, `passu`, `dedup` (cassées : la copie mutée n'avait pas `src/`) remarchent, chacune rouge |
| `audit-bilan-semaine` | 54 verts (+ égalité app = serveur avec l'offre) | — | — |
| `audit-double-vente-ailleurs` (27), `audit-lbc-restes`, `tests/lbc-attribution-historique` | verts, données servies avec la lecture complète | — | — |
| `audit-plans-solo-pro` | 56 verts (câblage : la règle pure) | — | — |
| variables, tdz, coherence, identite, statuts, fonctions-api (12), bilan-mois, lbc-a-retirer, comptes-exclus, compte-pas-relu, colis-ventes-email, urssaf, flux-divers, double-vente ; `npm run build` | verts | — | — |
| `audit-registres` (64), `audit-dac7-comptes` (43), `audit-achats-export` (55) : leur chaîne de l'app lit `compteEcarteChoix` + `compteEcarteRegle` (dac7 et achats-export plantaient DÉJÀ sur le code d'avant : `compteEcarteChoix is not defined` depuis Solo/Pro) | verts | 2 plantaient | — |
| 108 audits et bancs qui touchent ces fichiers, rejoués des deux côtés | aucun rouge nouveau | — | — |
| rouges **identiques sur le code d'avant** (pas de ce chantier) : `audit-donnees-ecrans` (`_fmtJourSemaine`), `audit-journal-semaine` (journal en tête de Ma journée), `audit-pagination-ordre` (`api/_lib/pilotage.js:66` sans ordre), `audit-politique-hotes` (liens de `src/profilFiscal.js`), banc `suivi-colis` K, banc `transporteurs` F (« Reçus 1,7 k ») | rouges | les mêmes | — |

## Ce qui reste
- Décider (Julien) : Leboncoin/eBay/Vestiaire dans Solo ? (alors : `excluAutre` + l'offre).
- Offres automatiques et favoris de l'extension ne regardent pas l'offre (extension non
  touchée ici).
- Geste de Julien : aucun nouveau. Pour que l'offre soit lue côté serveur, la migration
  **028** doit être passée (sans elle : « pas su », rien n'est bridé — comme avant).
