# « Me le rappeler » sur un article, une vente, un achat (11 nov. 2026)

Branche `claude/rappels-perso` (depuis `origin/main`). Aucune PR, aucun merge dans `main`,
aucune écriture en base réelle.

## Ce que voit Julien

- **Où le poser** : la fiche d'un article (« Tout sur le N° » → fiche de la paire, sous la note
  privée), le menu « … » d'une annonce Vinted (Annonces → fiche → actions), la fiche d'une vente
  Vinted (le récapitulatif, grille d'actions), le menu ⋯ d'un achat. Le bouton dit « Me le
  rappeler » ; une fois posé, « Rappel demain » / « Rappel lundi 17 nov. » (un toucher le modifie).
- **La feuille** : Quand — Demain matin · Dans 3 jours · Dans 7 jours · Une date (aujourd'hui ou
  plus tard) — puis une note courte facultative (80 caractères) et des choix rapides selon ce
  qu'on vise (article : « Rebaisser le prix », « Republier »… ; vente : « Relancer l'acheteur »,
  « Vérifier le colis »… ; achat : « Vérifier l'arrivée », « Aller retirer le colis »…). La phrase
  du bas dit le jour : « Une notification demain à 9 h, et la carte dans Ma journée. »
  « Enregistrer » ; la pilule « Annuler » 5 s comme tout geste interne (`gesteVrm`).
- **Le jour dit, à 9 h (Paris)** : UNE notification « Rappel · N°124 · Rebaisser le prix »
  (sans note : « Rappel · N°124 » + « tu as demandé qu'on te le rappelle aujourd'hui »). Plusieurs
  le même matin : UNE seule, « 2 rappels aujourd'hui », qui ouvre Ma journée.
- **Le toucher** ouvre l'élément par son identité : la vente (Ventes, cible `vente`), l'achat
  (Achats, cible `achat`), la fiche de la paire (N°). Un bandeau en bas dit « Rappel · N°124 ·
  … » avec **Fait** / **Reporter**. Si l'article a été **vendu** entre-temps (annonce dans
  `vinted_annonces_vendues`) ou **n'est plus présent** (N° absent de `vinted_nums_physiques`),
  ou si la vente a été **annulée**, le bandeau le DIT (« N°5 a été vendu entre-temps. ») et
  propose « Voir son histoire » au lieu d'ouvrir un écran vide. Liste des présents pas publiée ⇒
  « pas su » : on n'affirme rien, la fiche s'ouvre.
- **Ma journée** : la carte « Rappels du jour » sous « À faire » (seulement s'il y en a) : ceux du
  jour et ceux en retard (« Prévu hier »), le plus ancien d'abord ; Fait · Reporter · Supprimer.
- **Paramètres → Notifications → Rappels** : Aujourd'hui · À venir · Faits ces 30 derniers jours.
- **Agenda** (le lien .ics existant, lot H) : « Rappel · N°124 · Rebaisser le prix » à 9 h, alarme
  à l'heure. La ligne de Paramètres le dit (« Tes rappels : le N° et ta note »).

## Le refus du 11 octobre (§3) — respecté

Julien a refusé les rappels AUTOMATIQUES « messages sans réponse depuis 24 h » et « évaluations à
laisser ». Ici rien n'est proposé ni créé par VRM : un seul endroit du code crée un rappel, le
bouton « Enregistrer » de la feuille (`audit-rappels-perso` X1/X2 l'exigent).

## Comment c'est fait

| pièce | où |
|---|---|
| La règle (UNE, partagée app + serveur, pure, sans Node) | `api/_lib/rappels-perso.js` |
| La forme (feuille, carte, liste, bandeau, bouton) | `src/Rappels.jsx`, `src/styles-rappels.css` |
| L'état et les gestes (`useRappels`, `gesteRappel`, `HoteRappels`, `BoutonRappel`, `RappelsJourCoque`, `RappelsSetting`) | `src/App.jsx` (bloc « ME LE RAPPELER », après la note privée) |
| L'envoi | `api/ship-reminders.js` `rappelsPersoSur` — passages existants : réveil (GitHub, toutes les 30 min de 4 h à 13 h), matin (Vercel), soir et passage horaire du soir |
| La famille | `rappel` → « Rappels » (`notif-textes.js`), défaut allumé (`PUSH_DEFAUT.rappel`), genre `rappel-` (regroupement, `notif-belle.js`) |
| L'adresse | `lien-notif.js` : clé `rappel` ajoutée ; l'app la lit dans `goto` (`DEMANDE_RAPPEL`) |
| L'agenda | `agenda-ics.js` : `rappels:data->vrm_rappels` dans la projection, `evenementsRappels`, alarme `-PT30M` |

**La donnée** : `vrm_rappels` dans `main` (ajoutée à `SYNC_KEYS` et aux clés « gestes » rejouées),
`{ [id]: { id, sorte, num?, item?, tx?, plat?, jour, note?, creeAt, majAt, etat, faitAt?, reports? } }`.
Fusion par id entre appareils (`fusion3`). Supprimer pose `etat: 'supprime'` (pierre tombale purgée
après 30 jours par l'app, jamais une clé retirée qu'un autre appareil recréerait). **Identité seulement**
(§5) : N° (`cleNum`), id d'annonce Vinted, n° de transaction — jamais un titre (un rappel sans
identité n'est pas créé ; le bouton ne s'affiche pas).

**Le serveur** : `main` lu PROJETÉ (`select=vrm_rappels:data->vrm_rappels`, §4.4). Mémo
`rappels_perso_dedup` (`{ envoyes: { "<id>@<jour>": jour } }`, purgé à 60 j) lu en trois états
(illisible ⇒ rien) et écrit AVANT l'envoi, confirmé (sinon rien ne part). Un report change le jour ⇒
ré-arme. Famille « Rappels » coupée ⇒ rien. **Heures calmes** : le serveur N'ENVOIE PAS et n'écrit pas
le mémo — le passage suivant après la fin des heures calmes le fait sonner tel quel (plutôt que de le
ranger « calme » pour le récapitulatif). Plus de 2 jours de retard ⇒ ne sonne plus (la carte le
garde). La réponse du cron ne porte que des nombres (`etat`, `n`) : jamais une note ni un N°.

**Corrigé au passage — le curseur du réveil** : depuis le cron par lots (7 nov.), le passage
`?moment=reveil` avait UN curseur par jour (`cron_curseur_reveil_<jour>`) : le premier passage de
GitHub (4 h 07) marquait chaque vendeur « fait » pour la journée, et ni le récapitulatif de 8 h ni un
rappel de 9 h ne pouvaient plus partir. Le curseur est désormais par demi-heure
(`reveil-h<UTC><a|b>`), comme le passage horaire du soir (C8) ; les mémos de chaque envoi évitent les
doublons. (Mutation « curseur un par jour » ⇒ rouge dans `audit-rappels-perso`, B8/B9.)

## Preuves

| preuve | résultat |
|---|---|
| `node scripts/audit-rappels-perso.cjs` — EXÉCUTE la règle, l'agenda (`echeancesAgenda` + `fichierIcs`) et la VRAIE route `api/ship-reminders.js` (`?moment=reveil` et `soir`) contre une fausse base à la vraie forme (projections, mémos, curseurs persistés), `sendPushToAll` réel, web-push intercepté, horloge fixée | **43/43** |
| `--prouve` : 6 mutations (mémo ignoré, heures calmes ignorées, mémo non confirmé, curseur « un par jour », article sans identité, 9 h ignorée) | **6/6 rouges** |
| `--sur` l'arbre d'`origin/main` | rouge (A0 : la règle n'existe pas) |
| banc `scripts/bancs/rappels-perso.cjs` (J Ma journée, V fiche d'une vente, N adresse de notification, P Paramètres), 390 tactile et 1512, clair et sombre | **78/78** sur le code fusionné avec `main` (bandeau au premier plan, 44 px, rien ne déborde, aucune erreur JS ni requête en échec) ; captures regardées |
| `npm run build` ; audits `variables`, `tdz`, `coherence`, `identite`, `icones`, `textes-courts`, `fonctions-api` (12/12), `secrets`, `csp` | verts |
| audits voisins `notifs-belles` 41, `notifications` 31, `reveil-calme` 13, `cron-lots` 18, `agenda-appareil`, `cibles-notif`, `flux-divers`, `notifs-centre` 28, `push`, `sans-bruit` 44, `file-envoi`, `rappel-urssaf` | verts |

## Gestes de Julien

Aucun pour que ça marche (le secret `CRON_SECRET` de GitHub, déjà demandé pour le réveil, fait partir
les rappels à 9 h ; sans lui, le cron du matin de Vercel les rattrape à son heure, et le soir aussi).
Pour essayer : ouvrir une vente → « Me le rappeler » → « Demain matin ».

## Limites dites

- L'heure est fixe (9 h, ou la fin des heures calmes si elles finissent plus tard) : pas d'heure au choix.
- Vestiaire, Leboncoin et eBay : pas de bouton sur leurs ventes (identités d'une autre forme) ; un
  article (N°) vendu là se rappelle par sa fiche N°.
- « Vendu entre-temps » s'appuie sur ce que l'app a déjà lu (`vinted_annonces_vendues`,
  `vinted_nums_physiques`) : rien lu ⇒ « pas su », jamais une affirmation.
