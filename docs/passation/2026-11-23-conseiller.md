# 23 nov. 2026 — Le Conseiller (« Conseils du jour » et « Demande à VRM »)

Branche `claude/conseiller`. Demande de Julien : « on doit vraiment avoir un agent intégré dans l'app qui conseille,
qui est incroyable ».

## ÉTAT À LA REPRISE
(mis à jour en fin de session — voir la dernière section)

## La conception

### Tranche 1 — le conseiller SANS IA, gratuit, pour tous (la base)
Un moteur de règles PUR (`src/conseiller/regles.js`, aucun React, aucune lecture) qui reçoit les sorties des
PROPRIÉTAIRES existants (§5 « une seule règle par notion ») et rend 0 à 10 conseils, classés par urgence. Chaque conseil :
`{ id, rang, ton, titre, preuve, geste: { cible, libelle }, chiffres }` — un titre court chiffré, la preuve (« pourquoi »,
les nombres d'où il vient, avec leur couverture), UN geste qui ouvre l'écran VRM où il le fait LUI-MÊME (rien ne part
du conseiller). Un conseil sans données suffisantes ne s'affiche pas (pas su ⇒ rien, jamais un conseil deviné).

Les sources (toutes déjà calculées ailleurs, jamais recalculées) — rassemblées par `src/conseiller/sources.js`, LA même
fonction pour la carte d'Aujourd'hui et l'écran Conseiller (mêmes chiffres partout) :

| conseil | propriétaire (même source que l'écran) | seuil pour parler |
|---|---|---|
| colis à envoyer avant la limite | `vrm_colis_aposter.liste` (Ventes, règle `limiteExpedition`), publication < 12 h | une date limite LUE (jamais l'estimation vente + 7 j) qui tombe aujourd'hui ou demain |
| offres qui attendent | `vrm_offres_sans_reponse` (écran Offres sans réponse) | n ≥ 1, publication < 24 h |
| seuils URSSAF / DAC7 | `alertesSeuils` + `alertesADire` (la règle d'Argent, registre « Compris ») | un palier 80 % ou 100 % pas encore compris |
| paires à baisser | `vrm_baisses_conseillees` (publiée par Annonces : `decisionsBaisse`, règle `baisseConseillee` / `conseilPrix` — 30 j en ligne, −10 % au plus, jamais sous achat + 10 %) | n ≥ 1, publication < 24 h |
| prix d'achat à saisir | `lireValeurStock` (publication d'Annonces : n, nPrix) | au moins 1 paire en ligne sans prix d'achat |
| quoi racheter | `vendsMieux` → `quoiRacheter.prioritaires` (Statistiques › Finances), 90 j | 3 ventes reliées ET datées, bénéfice moyen > 0 |
| ce qui ne rapporte pas | `classementRapporte` (même classement), 90 j | 3 ventes au prix d'achat connu, bénéfice moyen ≤ 0 |
| paires qui dorment | `valeurChiffre('dorment')` (la carte des chiffres) | 5 paires ou plus |
| le jour où ça vend | relevé des ventes (dates LUES), 90 j | 40 ventes datées ; le meilleur jour ≥ 1,3 × la moyenne |
| le compte qui vend le mieux | `parCompteEtSite` (Statistiques), 30 j | 2 comptes ou plus ; le 1er ≥ 5 ventes et ≥ 1,5 × le 2e |

**Respect du §3 (refus du 11 oct.)** : aucun prix conseillé à la MISE EN LIGNE (la baisse ne vise que les paires en ligne
depuis 30 j, règle existante) ; pas de badge « bonne affaire » ; pas de saisonnalité (un jour de la SEMAINE n'est pas une
saison : aucune comparaison de mois ou d'année) ; pas d'« acheteurs fidèles » (le conseiller ne lit aucun acheteur) ;
pas d'alerte « achat jamais arrivé », « argent bloqué », messages sans réponse depuis 24 h, évaluations à laisser.
Les offres : le conseil OUVRE la liste ; accepter / contre-offrir se fait à son clic dans le panneau (§3).

**Place** : une carte « Conseils du jour » sur Aujourd'hui (3 au plus, « Tout voir » ⇒ l'écran) ; l'écran « Conseiller »
(onglet `conseiller`, icône `conseiller`, tuile dans Menu › Gestion), iPhone et ordinateur, composants natifs (jetons
`--n-*`), aucun style en ligne.

### Tranche 2 — « Demande à VRM » (question libre, IA avec la clé DU VENDEUR seulement, §2.9)
- Clé Claude collée par LUI dans l'écran Conseiller (« Ta clé Claude »), envoyée UNE fois, vérifiée chez Anthropic
  (`GET /v1/models`, gratuit), CHIFFRÉE dans le coffre (`api/_lib/coffre.js`, usage `claude-v1`, ligne `claude_cle`),
  jamais renvoyée au navigateur (il n'apprend que : posée, 4 derniers caractères, date) — le modèle de la clé Photoroom.
- Route : un mode de `api/ai.js` (`mode=conseiller`) — aucune 13e fonction. Pas de clé du vendeur ⇒ 200
  `{ ok:false, reason:'no-key' }` et l'écran se tait, dit pourquoi et montre les conseils sans IA. **La clé du serveur
  n'est JAMAIS utilisée pour ce mode, même pour le propriétaire** (il colle la sienne comme les autres).
- L'IA ne voit que des AGRÉGATS déjà calculés par VRM (le même `sources.js` que les écrans : totaux, classements par
  modèle, comptes, conseils) — aucun nom d'acheteur, aucun message, aucune adresse. Elle doit citer ses chiffres et ne
  fait aucune action : elle peut proposer un geste parmi une liste FERMÉE (les gestes des conseils) que l'app affiche en
  bouton ; c'est SON toucher qui agit.
- Modèle : `claude-haiku-5-5` (le plus économique de la génération actuelle, demande « économique » de Julien) ;
  coût affiché : estimation avant la question (taille du contexte envoyé × prix), coût réel après (usage rendu).
