# 10 nov. 2026 — Lot AB : un seul fil par acheteur et par paire, toutes plateformes

Branche `claude/fil-unique`. Validé par Julien (propositions du 9 nov., n° 42).

## Ce qui change
- Messages porte **« Tous »** dans la rangée des sites (`TACHES_SITE.messages = { toutes: true, defaut: 'vinted' }`).
  Le défaut reste **Vinted** : `?tab=messages`, les notifications, « Favoris & offres » (lot AL) ne changent pas.
- « Tous » = des **fils** (`src/ecrans/FilsTous.jsx`, règle pure `src/filUnique.js`) :
  conversations Vinted (la liste Vinted, mêmes exclusions : compte retiré/écarté, conversation retirée),
  Leboncoin (`lbc_fil_*`, scalaires `meta`), Vestiaire (`vc_fil_*` + `vc_messages`, N° par la référence/lien VRM).
- **Regroupement (§5)** : deux conversations = un fil seulement si MÊME interlocuteur (identifiant de SA plateforme,
  `opposite_user.id` ; jamais un pseudo) ET une identité de paire commune (annonce, transaction, N° `cleNum`), ou SON lien.
  Leboncoin et Vestiaire ne donnent jamais l'acheteur : jamais fusionnés seuls.
- **Questions** (une à la fois, « Encore N questions ») : « Peut-être la même paire ? » (même acheteur, une conversation
  sans paire) ; « Peut-être le même acheteur ? » (même N° sur deux plateformes). « Oui, même fil » / « Non » écrivent
  `vrm_fils_relies` (SYNC_KEYS) ; « Ce n'est pas le même fil : délier » défait.
- Un fil d'une conversation s'ouvre dans SON fil (Vinted : `openConversation`, réponses/offres ; `FilLeboncoin` ; `FilVestiaire`).
  Un fil de plusieurs : messages dans l'ordre, marque de plateforme sous chaque bulle ; « Répondre sur X » ouvre la
  conversation du DERNIER message dans son fil (règles d'envoi, recettes APPRISES, 50/h inchangées). Rien de daté ⇒ un bouton par plateforme.
- eBay : VRM ne garde pas ses messages (lus en direct) — dit sous la liste. Une source illisible est nommée (« pas pu lire »).

## Fichiers
`src/filUnique.js`, `src/ecrans/FilsTous.jsx` (morceau à la demande), `src/navigationTache.js`, `src/App.jsx`
(prop `filTous` de `Comptabilite`, branche « Tous » de `rendreTache`, `SYNC_KEYS`), exports `FilLeboncoin`,
`FilVestiaire`, `ficheDuNumero` des écrans découpés.

## Preuves
- `scripts/audit-fil-unique.cjs` (31 verts) : 50 paires identiques ⇒ 50 fils, même pseudo ≠ même acheteur, identités,
  propositions, liens, ordre, plateforme de réponse, `cleNum` recopiée = celle de l'app. Sur origin/main : module absent.
- `scripts/bancs/fil-unique.cjs` (41 verts, 390 tactile + 1512, clair et sombre, captures regardées). Sur l'arbre
  d'origin/main (archive) : rouge (« Tous » absent). Mutation « même acheteur suffit » : 3 rouges à l'audit, 9 au banc.
- `npm run build`, audits variables, tdz, coherence, identite, icones verts.

## Ce qui reste
- eBay dans « Tous » : il faudrait lire ses messages en direct (appel serveur) — pas fait.
- Défaut de Messages : Vinted (pour ne casser aucun lien) ; à Julien de dire s'il veut « Tous » par défaut.
