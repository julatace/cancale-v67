# Bugs terrain — 24 novembre 2026 (`claude/bugs-terrain-24nov`)

Julien, le 24 au matin : « elle bug trop encore ». Consigne : partir des **vrais signaux** de
production (lecture seule), classer par fréquence × gravité, corriger le haut de la liste.

## 1. Ce qui a été mesuré (lecture seule, aucune donnée personnelle recopiée)

| source | fenêtre | résultat |
|---|---|---|
| Vercel `get_runtime_errors` (projet cancale-v67) | 72 h | **0 erreur** |
| Vercel journaux d'exécution (`error`/`warning`/`fatal`) | 45 min (Hobby : 1 h de rétention) | **0** |
| `app_data` `plantage_*` (journal des plantages de l'app, `src/plantages.js`) | 72 h | **3 lignes** (détail ci-dessous) |
| `app_data` `mesures_jour_*` (`src/mesuresCollecte.js`), case `morceau` | 14 jours | **10 à 20 par jour, presque tous au téléphone** |
| `app_data` `signalement_*` (« Signaler un problème ») | tout | **0** |
| `app_data` `ext_appareil_*` (diag de l'extension) | 3 jours | `suivi_forme_inattendue_escrow` = `suivi_vu_escrow` sur **chaque** appareil (extension) |

Les trois plantages des 72 h :

| message | écran | appareil | statut |
|---|---|---|---|
| `Icon is not defined` / `Can't find variable: Icon` (RetraitsPoints) | Achats → Colis | Mac Edge (22 nov.), iOS Safari (23 nov. 13:57 UTC, version 12:46) | **déjà corrigé** : #1313 fusionnée le 23 à 14:19 UTC (après l'erreur) ; aucune récidive depuis |
| `CSP connect-src ← https://img.leboncoin.fr` | Annonces | Mac Chrome (22 nov.) | **corrigé ici** (§2) |
| (plus ancien, 20 nov.) `Cannot read properties of undefined (reading 'default')` au démarrage | — | Android Chrome, **version du 12 nov.** gardée en cache | corrigé le 15 nov. (`src/chargementSur.js`) ; plus vu sur une version récente |

Classement (fréquence × gravité) :
1. **Morceau périmé au téléphone** (≈ 15/jour) : une page iPhone restée ouverte demande, après une
   mise en ligne, un morceau d'écran que le serveur n'a plus ⇒ relance, puis rechargement (ou
   « Mettre à jour VRM » après 8 s). Rattrapé, pas un écran tombé — mais c'est un « ça bug » visible,
   et le train de ~30 fusions du 24 nov. le multipliera. **Pas corrigé ici** (§3).
2. **Colis à retirer sans photo** — écran Achats tombé : déjà corrigé (#1313).
3. **Photo Leboncoin lue par `fetch`** — refusée par la politique de sécurité : corrigé ici.
4. **Extension : forme du suivi `escrow` jamais reconnue** — signalé (§3), pas touché.

## 2. Corrigé : une photo d'un hôte refusé par `connect-src` n'est plus demandée

Cause : trois lecteurs de photo « génériques » font `fetch(url)` sur n'importe quelle adresse
`https:` : `lirePhotoVisuel` (Visuels réseaux, App.jsx), `photoNoirePourFiche` (fiche de
préparation, App.jsx), `imageEnOctets` (dossier de litige, `src/dossierLitige.js`). Une photo
Leboncoin (`img.leboncoin.fr`) n'est pas dans `connect-src` (vercel.json) : le navigateur refuse,
rien n'est lu, et chaque essai est noté comme plantage (bruit qui cache les vrais).

Correction (minimale) : `src/lisibleParLaPage.js` — la **recopie** du `connect-src` de vercel.json
et la règle `lisibleParLaPage(url)` (même origine, data:, blob:, les origines listées, `*.vinted.net`).
Les trois lecteurs demandent d'abord : pas permis ⇒ `null` tout de suite. Rien ne change à l'écran
(la photo Leboncoin n'était déjà jamais lue : le visuel / la fiche / le dossier partaient sans elle),
mais plus de requête refusée ni de plantage noté.

Preuve : `scripts/audit-lecture-csp.cjs` (lancé par `lancer-audits`) :
- la recopie égale **exactement** le `connect-src` de chaque en-tête de vercel.json ;
- la règle exécutée (Leboncoin, faux sous-domaine, `http:` refusés ; Vinted, la base, la même
  origine, data:, blob: permis) ;
- les trois lecteurs **exécutés** avec un `fetch` espion : une photo Leboncoin ⇒ 0 requête ;
  une photo vinted.net ⇒ 1 requête (la garde ne coupe pas tout) ;
- **rouge sur origin/main** (1acadda1d, arbre `git archive`, règle copiée dedans) : les 3 lecteurs
  demandent la photo Leboncoin ;
- **5 mutations, toutes rouges** : règle toujours vraie, garde retirée de chacun des 3 lecteurs,
  une origine de plus dans vercel.json.

Voisins verts : audit-confort-securite (liste de copie complétée du nouveau module),
audit-dossier-vitesse-avis, audit-visuels-reseaux, audit-litiges, audit-litiges-ecran,
audit-retours-litiges, audit-fonctions-api ; `npm run build` vert. Rien de visible ⇒ pas de capture,
pas de ligne dans `nouveautes.js`.

## 3. Ce qui reste, et pourquoi

- **Morceaux périmés au téléphone (le plus fréquent).** Le mécanisme existe déjà et est épais
  (`src/chargementSur.js`, `src/main.jsx` autoUpdate, `public/sw.js` : coquille, réchauffage de tous
  les morceaux 15 s après l'ouverture, purge à chaque nouvelle coquille). Hypothèse non prouvée : la
  purge retire les morceaux de la version que la page iPhone encore ouverte exécute (elle ne garde que
  la nouvelle liste). Piste : garder la liste de la version PRÉCÉDENTE quelques heures dans la purge.
  Pas fait ici : toucher le service worker pendant le train de fusions, sans pouvoir l'essayer sur un
  vrai iPhone, risque plus qu'il ne rapporte. Mesure de suivi : la case `morceau` de `mesures_jour_*`.
- **Extension (pas touchée, un autre agent la tient)** : sur chaque appareil, chaque suivi `escrow`
  lu est déclaré « forme inattendue » (`diag` de `ext_appareil_*` : `suivi_vu_escrow` = 
  `suivi_forme_inattendue_escrow`, 1 à 11 par jour et par appareil, versions 5.410 → 5.440) ⇒ le suivi
  de ces achats n'est pas rangé. Plusieurs Chrome sont encore en 5.410/5.418.
- La veille des chiffres (`vrm_veille_chiffres`) n'a plus de stock (`s: null`) depuis le 18 nov. :
  voulu (un compte a ses annonces « à confirmer », plus de 24 h sans relecture) — pas un défaut ;
  le geste est de repasser sur Vinted avec ce compte.
