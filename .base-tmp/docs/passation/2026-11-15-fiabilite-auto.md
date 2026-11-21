# 15 nov. 2026 — Fiabilité automatique (branche `claude/fiabilite-auto`)

Julien a validé (« vas-y fais tout ») quatre chantiers. Base de prod : LECTURE SEULE, rien
écrit. Extension non touchée. Toujours 12 fonctions `api/`. Aucune PR.

Précision de Julien (relayée par le coordinateur, en cours de lot) : **Ma journée encombrée
de cases au hasard** ⇒ le contrôle de nuit et la santé des comptes ne s'affichent PAS en carte
dans Ma journée ; ils vivent dans Paramètres → « Tout va bien ? ». Ma journée n'en garde qu'UNE
ligne discrète « Tout va bien ? · N points » (posée par `claude/refonte-journee`, qui lit
`usePointsToutVaBien()` / `pointsToutVaBien()`). La notification du matin seulement pour un
écart réel qui demande un geste. **« N ventes à dater » n'est affiché nulle part** (l'extension
les date sans rien lui demander).

## Ce qui existait déjà (pas refait)

- Le contrôle de nuit du 11 nov. (`src/controleNuit.js`, `api/_lib/controle-nuit.js`, branché
  dans `traiterVendeur` du cron du matin) : N° en double (en ligne), ventes sans versement > 30 j,
  comptes pas relus 48 h ; e-mails en quarantaine et Stripe pour le propriétaire.
- Le journal des plantages (`src/plantages.js`), les alertes anonymes `plantages_terrain_*`,
  le panneau « Plantages chez les vendeurs » (Réglages → Sécurité des données).
- « Tout va bien ? » (`src/ToutVaBien.jsx`) : une rangée par compte et par appareil ; la ligne de
  fraîcheur (`src/fraicheur.js`) disait déjà « Extension 5.329 sur Chrome · Mac ».
- `claude/parcours-nouveau` (onglet admin « Nouveaux comptes ») n'est PAS dans la base de cette
  branche : le rapport de plantages est donc un panneau propriétaire à part, vérifié au serveur.

## 1. Contrôle de nuit (le cron du matin, pas une 13ᵉ fonction)

Règles pures dans `src/controleNuit.js`, lecture dans `api/_lib/controle-nuit.js` :

| contrôle | règle | notifié |
|---|---|---|
| `numeros-double` | deux paires PRÉSENTES sous un N° (`cleNum`) : en ligne **et masquées par Vinted** (copie exacte du bloc `<masquees-regle>`, `api/_lib/masquees-regle.js`, refaite par `scripts/_recopie-masquees.cjs --recopie`) | oui (rouge) |
| `vente-sans-numero` | vente Vinted des 7 derniers jours, non annulée, avec un état de commande, sans N° par IDENTITÉ : transaction → annonce (détail de transaction lu) → fiche, ou N° posé sur la transaction, ou lien `vinted_txn_link`. Annonce pas connue ⇒ pas comptée (« pas su » ≠ « sans N° ») | oui |
| `pool-retreci` | un N° porté par une fiche ou une vente absent de `vinted_used_numeros` (lots « 14+15 » compris), ou la liste plus courte que la nuit d'avant (`pool` rangé dans la ligne) — dit, jamais réparé | oui |
| `enligne-24h` | compte gardé dont la lecture « en ligne » a plus de 24 h (`<enligne-regle>` : annonces « à confirmer ») | oui |
| `totaux-mois` | `widget_stats` (ventesMois, caMois = VENDU), `vinted_urssaf_mois.recu[mois]` (REÇU), `vrm_benefice_jours` (finalisées ⊂ vendu) comparés à la règle miroir `calculerBilan` (lecture `lireDonneesBilan`) ; seulement si la publication est PLUS RÉCENTE que la dernière lecture des ventes et la source complète, sinon « pas su » dit ; 1 € de tolérance | non (se recompte à l'ouverture) |
| `versement-30j` | inchangé, COMPTÉ mais **muet** (`CONTROLES_MUETS`) : jamais affiché, jamais notifié | non |

- Rien n'est corrigé ; une lecture ratée ⇒ ce contrôle `n: null` + raison, les autres continuent.
- Notification : `notifierControle` (cron du matin), catégorie « Rappels » (`veille`), UNE par
  écart nouveau (signature des clés et identifiants ; la même qu'hier ⇒ rien), mémo
  `vrm_controle_nuit_dit` écrit AVANT l'envoi et confirmé. Texte : sorte `controleNuit` de
  `api/_lib/notif-redaction.js` (titre ≤ 40, corps ≤ 90, 5 langues, des clés et des nombres,
  jamais un N° ni un n° de transaction) ; elle ouvre « Tout va bien ? ».
- Affichage : `ControleNuitLignes` (src/fiabilite/Fiabilite.jsx) dans « Tout va bien ? » ; la
  carte du contrôle a été RETIRÉE de Ma journée (`src/VeilleJournee.jsx` ne garde que l'alerte
  « un chiffre a chuté »).

## 2. Rapport de plantage automatique

- Règle de Julien : notification au propriétaire SEULEMENT si un même plantage touche ≥ 3
  personnes le même jour (empreinte du jour, jamais un identifiant) ou bloque l'ouverture ; une
  fois par type et par jour, une par heure au plus (`typeADire`, `alerteDue`,
  `src/alertesPlantages.js`). Le propriétaire n'est jamais compté (`api/_lib/mesures-terrain.js`,
  `api/_lib/plantages-comptes.js`).
- Ouverture bloquée : le dernier filet (`origine: 'demarrage'`) ou un **morceau périmé qui revient
  moins d'une minute après le rechargement** (`morceauBloquant`, src/plantages.js). Avant, un
  morceau périmé n'était jamais signalé — même quand l'app ne s'ouvrait plus. L'alerte attend sur
  l'appareil (`vrm_alertes_attente`, 10 au plus) si la collecte n'est pas encore chargée, et part
  avec le premier lot.
- L'appareil en deux mots (« iOS Safari », liste fermée `appareilAlerte`), la version de l'app.
- Rapport : `/api/compte?mode=mesures&quoi=rapport-plantages` (propriétaire seul, 403 sinon),
  `api/_lib/rapport-plantages.js` : par type — message nettoyé, écrans, versions, appareils,
  personnes, fois, ouverture bloquée, « notifié » — plus les morceaux périmés rattrapés comptés
  par les appareils (les mesures). Panneau `RapportPlantages` dans « Tout va bien ? »
  (propriétaire). Aucune identité ne sort.

## 3. Santé de chaque compte

`santeDesComptes` (src/fiabilite/regles.js) → `FeuilleSanteComptes` ouverte par la rangée
« Santé de chaque compte › » de « Tout va bien ? ». Un compte par carte (Vinted, Leboncoin,
Vestiaire, eBay) : dernière lecture complète (dressing pour Vinted), l'appareil qui le lit et sa
version (`vus` des lignes `ext_appareil_*`), prudence / vérification / arrêt (lignes
`actions_compte_*`, `jaugeDuCompte`, son « Reprendre » respecté) ; un état en mots (Va bien ·
Arrêté · N'arrive plus · Délié · Jamais lu · À relire · Ventes en retard · Extension en retard ·
Prudence · Banni · Masqué) et UN geste. **Pas de « ventes sans date »** (décision de Julien).

## 4. Extension en retard, par appareil

- Sur l'appareil en retard : `retardIci` (version du pont de CE navigateur) ⇒ la ligne du haut
  (`src/fraicheur.js`, source `version:ici`, le lien du paquet à côté) et la carte
  `AlerteExtensionIci` de « Tout va bien ? » : « Ce Chrome a la 5.329 : installe la 5.385 »,
  `VRM-extension.zip` (Orion : `VRM-Orion.xpi`), la fiche de la boutique seulement si
  `LIENS_BOUTIQUES` la porte. Jamais pour une version publiée à jour (ni plus récente) ; muette
  (avant 5.26) = ancienne.
- Dans « Tout va bien ? », chaque appareil en retard : « Chrome · Mac a la 5.329 : installe la
  5.385 », et le Chrome Web Store si `LIENS_BOUTIQUES.chrome` est rempli.

## Pour Ma journée (chantier `claude/refonte-journee`)

```js
import { usePointsToutVaBien, textePoints } from './fiabilite/Fiabilite.jsx';
const p = usePointsToutVaBien();   // { etat: 'lecture'|'ok'|'points', n, points:[{cle, source, ton}] }
// p.n > 0 ⇒ une ligne discrète : textePoints(p) (« Tout va bien ? · 2 points ») → Paramètres → Tout va bien ?
```
Règle pure : `pointsToutVaBien({ controle, installation, sante, ici })` (src/fiabilite/regles.js).
Reste à leur charge : la carte « santé des comptes » de Ma journée (App.jsx, `carteSanteComptes`,
lot du 11 nov.) est encore une carte — à replier dans la ligne si Julien le veut.

## Preuves

- `node scripts/audit-fiabilite-auto.cjs` : 72 verts (règles, `controleVendeur` contre une fausse
  base à la forme PROJETÉE + la vraie `calculerBilan`, `notifierControle`, rédaction 5 langues,
  plantages, route au propriétaire, morceau périmé, extension d'ici, santé, points, copie des
  masquées). `--prouve` : **15/15 mutations rouges**. Sur l'arbre de départ
  (`git archive origin/claude/project-review-nsk5su`) : rouge (1 vert, 7 rouges).
- `scripts/audit-aide-signalement.cjs` : la partie alertes de plantage réécrite à la nouvelle
  règle (1 personne / 2 personnes + propriétaire : rien ; la 3ᵉ : une notification ; ouverture
  bloquée : une ; la veille du matin dit le type à dire en attente). Reste 1 rouge AVANT ce lot :
  « Réglages pose le sien » (Reglages.jsx non touché ici).
- `node scripts/audit-fiabilite-auto.cjs` : 74 verts après l'ajout de la ligne de fraîcheur
  (D16-D17) ; `--prouve` 15/15 à la mesure faite (la 16ᵉ mutation, « l'extension d'ici dite deux
  fois », ajoutée ensuite).
- Banc `scripts/bancs/fiabilite-auto.cjs` (390 tactile / 1512, clair / sombre, 8 parcours) :
  **114 verts**. Captures regardées : feuille santé à 1512 en deux colonnes coupait le nom
  (« secon… ») ⇒ une colonne ; le parcours de premier lancement (« Tu vends quoi ? ») couvrait
  l'écran du banc ⇒ posé comme fait dans le banc.
- Banc `veille` : scénarios B et F réécrits (le contrôle et « à dater » ne sont plus dans Ma
  journée). ⚠️ Lui et le banc `tout-va-bien` tombent aujourd'hui sur le même parcours de premier
  lancement qui couvre l'écran (clic bloqué 30 s) — défaut de ces bancs, d'avant ce lot (le
  parcours n'est pas de ce lot) ; à corriger en posant `vrm_je_vends` / `vrm_configuration` /
  `vrm_parcours_plus_tard` comme dans `fiabilite-auto.cjs`.
- Audits verts : traduction, quoi-de-neuf, fonctions-api (12), tdz, variables, identite, studio,
  csp, veille (59), alertes-production (37), notifications, notifs-redaction, cibles-notif,
  conseils, mesures-terrain, purge-mesures, mois-boucle, garde-ecrans, sante-donnees,
  veille-plantages, morceau-perime, coherence, icones, retours-suivi, versement-sources (la
  vérification « Ma journée dit la phrase des ventes à dater » inversée : décision de Julien).
- Rouges d'AVANT ce lot (fichiers non touchés) : fraicheur-unique (App.jsx monte la ligne deux
  fois), safari (lookbehind existants), stockage-sur, vocabulaire-article (App.jsx, extension),
  secrets (src/exempleDonnees.js), textes-courts (Ebay.jsx), aide-signalement « Réglages pose
  le sien ».

## Gestes de Julien

Aucun. Au prochain déploiement : premier contrôle complet le lendemain matin.
