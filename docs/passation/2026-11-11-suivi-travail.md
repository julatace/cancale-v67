# Suivi d'un travail long — VRM figé, détail, barre de progression (11 nov.)

Demande de Julien : « quand l'app republie, publie de Vinted à Leboncoin, je veux que VRM reste FIGÉ et qu'il y ait un DÉTAIL de toutes les infos que VRM fait, avec une BARRE DE PROGRESSION. »
Branche `claude/suivi-travail`. Aucune PR, aucune fusion sur `main`. **Aucun changement d'extension** (elle annonce déjà ses étapes fines ; la 5.360 réservée n'est pas prise).

## Ce qui est livré

- **Règle** `src/suiviTravail.js` (pure + petit magasin `suivi`) et **feuille** `src/composants/SuiviTravail.jsx` (+ `suivi-travail.css`).
- **Feuille plein écran** (portail `<body>`, z 15000 — SOUS les confirmations 20000 : une question posée pendant le travail, couleur d'un brouillon, champ manquant, reste répondable) ; tout le reste de `<body>` passe en `inert` ; Échap neutralisé ; le retour du navigateur reposé ; `beforeunload` tant que ça tourne. Impossible à fermer par erreur : deux gestes seulement, **« Mettre en pause »** (l'étape en cours finit, puis VRM s'arrête entre deux annonces) et **« Arrêter »** (confirmé dans la feuille, « Continuer » ne change rien). En pause : « Reprendre » / « Arrêter ».
- **Progression réelle** : « N sur M », barre (`role=progressbar`) = annonces finies + part de l'étape en cours ; l'annonce en cours et ses étapes (✓ faites, celle en cours, à venir) ; écoulé ; **temps restant « environ »** mesuré au rythme réel (écoulé ÷ finies × restantes), **« — » tant qu'aucune n'est finie** ; pause de sécurité avec compte à rebours (entre deux annonces, pause au hasard de l'extension, « Vinted demande d'attendre ») ; jauge 50/h du compte (`JaugeActions`).
- **Journal** horodaté, en français simple, une ligne par geste, désigné par le N° ; **rien de personnel** (les écrans ne passent jamais de pseudo ; `nettoyer` retire en filet adresses, @pseudos, téléphones, liens de profil) ; refus en clair avec le geste ; **copiable** ; gardé (≤ 20 travaux, `vrm_suivi_travaux`, sur cet appareil) dans **Paramètres → Ce que VRM a fait** (`TravauxPasses`). Le journal reste en français (c'est une trace copiable, comme une donnée) ; tout le reste de la feuille passe par `tr()` (41 clés `suivi.*`, 5 langues).
- **Récapitulatif** à la fin : réussies · à finir à la main (raison + geste + lien) · refusées (raison + geste) · pas faites ; « Fermer » dégèle VRM.
- **Reprise après rechargement** : l'état est écrit à chaque pas (`vrm_suivi_travail`) ; au démarrage (`SuiviTravailCoque` dans `AppCoeur`) le travail revient **« Interrompu »** (la boucle de l'écran est morte) ; l'annonce qui était en cours n'est **jamais déclarée faite ni ratée** : « à vérifier », sauf si l'extension (ses `cmds`, `__vmrJobs`) dit elle-même son étape pour CETTE annonce.

## Branchements

| travail | où | étapes suivies |
|---|---|---|
| Republier (recréer, modifier, brouillon, mettre en ligne) | `src/ecrans/Republier.jsx` (`lancerFile`, effet miroir de `st`/`prog`/`prochaine`/`arretJusqua`) | celles de l'extension (`ETAPES_REPUB`) + « Acceptée par Vinted ✓ » cochée seulement sur le « fait » rendu ; mise en ligne programmée ⇒ étape « attente » « programmée vers hh:mm » ; double / incertain ⇒ « à finir à la main » ; a-refaire / échec ⇒ refus avec le geste. Pause / Arrêter ⇒ `setMode('pause'|'fini')` ; Reprendre ⇒ `setMode('run')` (refusé, dit, si Vinted demande encore d'attendre) |
| Republier sur Leboncoin (série) | `RepublierLeboncoin` (`src/ecrans/Leboncoin.jsx`) | suppression · remise dans la file · dépôt · `progres.etape` de l'extension · publiée ✓ |
| Publier sur Leboncoin (fiche, bouton) / Préparer sur eBay (bouton) | `suivrePublicationSite` (Leboncoin.jsx) | jusqu'au « fait » dit APRÈS le départ ; geste attendu / abandon / 15 min ⇒ « à la main » ; eBay préparé ⇒ « relis et mets en vente » |
| Publier sur eBay (API) | `publier` (`src/ecrans/Ebay.jsx`) | envoi · acceptée par eBay ✓ ; pas de réponse ⇒ « à la main » |
| Vestiaire (préparer / publier) | `preparer` (`src/ecrans/Vestiaire.jsx`) | formulaire ouvert · publiée ✓ (auto) |
| Baisser le prix en série | `src/BaissePrixSerie.jsx` (`lancer` : `t.continuer()` entre deux annonces) | envoi (ancien → nouveau) · prix relu |
| Retirer des autres sites | `retirerDesAutresSites` (`src/App.jsx`) — voies enveloppées | demande au site · retrait accepté |
| Mode vacances | `src/ModeVacances.jsx` (`lancer`) | envoi · état relu (le compte n'est jamais nommé) |

## Élargissement (précision de Julien, 11 nov.) : TOUTE action en cours

« Dès qu'il y a une action en cours, fige VRM avec une fenêtre qui s'ouvre avec une barre de progression. »
⇒ **une API unique, `lancerTravail`** (src/suiviTravail.js), que n'importe quel écran appelle. Une action qui finit sous ~1 s (`seuilMs`, défaut 1000) et sans souci ne fige rien et ne laisse rien (`suivi.oublier`) ; sinon la feuille s'ouvre et reste sur le récapitulatif. Une question posée pendant le travail (confirmation, feuille de placement du tampon…) est **relevée au-dessus** de la feuille (MutationObserver sur `<body>` : un nœud ajouté après le gel passe à z 15001), sans quoi une action qui attend une réponse resterait bloquée derrière.
Branché en plus : **toute action de la barre « N sélectionnés »** (`BarreSerie` → `lancerTravail`, une action) et **Tout imprimer / bordereaux** (`batchBordereaux` : chaque PDF lu, refusé avec le geste, puis « dans le PDF à imprimer ✓ » sur la réponse de la fusion). Mode d'emploi recopié dans `docs/passation/COORDINATION-AGENTS.md` (branche `claude/coordination`, cb7f9d500).
**Pas branché ici (à faire par leurs lots avec l'API)** : messages aux favoris (envoi, mode auto lancé), baisses Leboncoin / Vestiaire, import d'historique lancé à la main, exports comptables / registres, restauration, Publier partout, eBay complet.

### `lancerTravail` — mode d'emploi
```js
import { lancerTravail } from '../suiviTravail.js';
const r = await lancerTravail({
  titre, sorte, etapes,                 // étapes d'UN article (facultatif)
  articles: [{ id, num, titre }],       // OU total: N ; OU rien = une seule action
  uid, entreMs, seuilMs = 1000,
  executer: async (article, o) => {     // une seule action : executer(o)
    o.etape(cle, detail); o.noter(texte, ton); o.pause(ms, raison); o.doitSArreter();
    return { etat: 'ok'|'main'|'refus'|'saute', raison, geste, lien, arreterTout };
  },                                    // true/rien ⇒ ok · false ⇒ refus · exception ⇒ refus · { annule: true } ⇒ rien gardé
});
// r = { statut: 'fini'|'arrete'|'pause'|'occupe', resultats, valeur }
```

## API bas niveau (boucle pilotée par l'état React, comme Republier)

```js
import { suivi, suivreJob } from '../suiviTravail.js';
const t = suivi.demarrer({
  sorte: 'publier-partout',            // libre, sert de data-suivi-travail
  titre: 'Publier partout',            // en tête de la feuille (jamais un pseudo)
  etapes: [['envoi', 'Envoi'], ['accepte', 'Accepté ✓']],   // les étapes d'UN article
  articles: [{ id, num, titre }],      // la file, figée au lancement ; ids uniques
  uid,                                 // facultatif : compte Vinted de la jauge 50/h
  surGeste: (quoi) => {},              // facultatif : 'pause' | 'arret' | 'reprendre' (boucle pilotée par état React)
});                                    // null si un autre travail tourne (un seul à la fois)
t.etape(id, cle, detail?)   // l'étape en cours (commence l'article) ; même étape + même détail = rien de neuf
t.noter(texte, id?, ton?)   // une ligne au journal (ton : info · ok · refus · pause)
t.pause({ ms | jusqua, raison }) · t.finPause()      // pause de sécurité, compte à rebours
t.fin(id, { etat: 'ok'|'main'|'refus'|'saute', raison, geste, lien })   // une seule fois par article
await t.continuer()         // ENTRE deux articles : true = continuer ; sur « pause » attend Reprendre/Arrêter
t.doitSArreter()            // pour couper une attente (pause entre deux) dès la demande
t.terminer(raison?, 'pause'|'arrete'?)   // fin de boucle : statut décidé par la demande et ce qui reste
await suivreJob(t, id, { jobId, lireJobs: () => __vmrJobs, depuis, delaiMs })   // une commande de l'extension
//  → { fin: 'fait'|'abandonne'|'geste'|'delai'|'arret' } ; « fait » seulement si daté APRÈS `depuis`
```
La feuille se monte seule (`SuiviTravailCoque` dans `AppCoeur`) : rien à monter dans l'écran.

## Preuves

- `node scripts/audit-suivi-travail.cjs --prouve` : **67 ✅ · 0 ❌** (L1–L7 : l'API unique — rapide sans rien, refus montré, `arreterTout`, occupé, exception, annulé, valeur rendue), dont 10 mutations (+ « action rapide avec un refus jamais montrée », « la suite part après un refus pour tout »), et les 8 premières toutes rouges (temps restant inventé, pseudo laissé, annonce en cours déclarée faite au rechargement, « fait » d'avant le départ accepté, pause sans fin, issue inconnue = réussie, Republier « double » compté réussi, feuille au-dessus des confirmations). Sur la tête d'avant (9d7d1b7a) l'audit n'existe pas et ses contrôles B (branchements, montage) y seraient tous rouges.
- Banc `scripts/bancs/suivi-travail.cjs` (vraie feuille + vrai magasin, harnais esbuild `scripts/bancs/suivi-travail/harnais.jsx`, jauge bouchonnée, 390 tactile / 1512, clair / sombre, `SHOTS=dossier`, `THEMES`) : **68 ✅ · 0 ❌** — gel `inert`, clic derrière perdu, Échap et retour sans effet, `beforeunload`, « 2 sur 4 », étape en cours, « environ 4 min » au rythme réel, compte à rebours, question posée pendant le travail répondable (confirmation à z 20000, et feuille de l’pp à z 1000 relevée au-dessus), pause / reprise, Arrêter confirmé, récapitulatif, Fermer dégèle et garde, rechargement ⇒ Interrompu / à vérifier. Mutation (inert et beforeunload retirés) ⇒ 4 rouges. Captures regardées (390 clair, 1512 sombre, fin, interrompu) : deux défauts vus et corrigés (pied collant qui laissait passer le journal dessous ; police sans repli hors coque).
- `npm run build` vert.

## ÉTAT

Livré, poussé, `origin/main` déjà fusionné (rien de neuf au moment de la fin). Rien de rouge connu. Pas vérifié en vrai : le rendu DANS l'app complète (le banc monte la feuille seule) — à regarder au premier Republier réel.
- Audits communs : variables, tdz, coherence, identite, icones, textes-courts, fonctions-api, secrets, quoi-de-neuf, traduction — verts.

## Pièges

- `inert` est posé sur les enfants de `<body>` présents au gel ; une confirmation créée APRÈS (portail `askConfirm`) reste vivante et au-dessus (20000 > 15000). Ne pas monter la feuille au-dessus de 20000.
- Republier : plusieurs annonces peuvent être « en cours » (une mise en ligne programmée attend pendant que la suivante commence) ; la feuille montre la dernière touchée (`vuAt`).
- La boucle de Republier vit dans l'écran : après un rechargement, le travail est « interrompu » ; ne jamais le reprendre seul.
- `t.terminer` ne fait rien sur un travail déjà arrêté / fini (un « Arrêter » en pause ne redevient pas « terminé »).
