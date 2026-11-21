# 13 nov. 2026 — Intégration, étape 2 : la traduction (lot 2) sur le main du jour

Branche `claude/integration-13nov-traduction` (second agent, intégrateur), depuis `claude/traduction`
(15 commits, base f04d4a580, 1 041 commits de retard sur main). Décision de Julien du 11 nov. 14 h 40 :
`docs/passation/2026-11-11-traduction.md` (elle remplace le refus « International » de CLAUDE.md §3).
L'argent reste en euros ; aucune règle de calcul n'est changée.

## La méthode (vrai `git merge origin/main`)
20 fichiers en conflit. Règle suivie : **le code de main gagne**, puis la migration est **rejouée** par
l'outil de la branche (`scripts/i18n-migrer.cjs lister … / appliquer …`), écran par écran, sur le code de main :

| fichier (main) | zones | textes passés par tr() | clés neuves |
|---|---|---|---|
| `App.jsx` Ma journée | `Comptabilite#journee`, Frise, Performance, Bénéfice, Grille, Hors ligne, Semaine, Argent à venir | 218 | 27 |
| `App.jsx` Ventes | `Comptabilite#ventes`, coût d'achat, bordereau, retirer l'argent, ligne compacte, notes e-mail, photos | 212 | 19 |
| `App.jsx` Achats | `Comptabilite#achats`, transporteurs, suivi Vinted, code de retrait, réception e-mails | 284 | 23 |
| `App.jsx` Annonces | `Comptabilite#annonces`, fraîcheur, choix, compte rendu, achats à relier, Vestiaire, carton | 375 | 28 |
| `App.jsx` communs | MicDictee, ScreenHead, LoadError, PhotoVinted, dateFr, LigneConv, FavorisConnectes | 11 | 0 |
| `ecrans/Stock.jsx` | tout | 270 | 11 |
| `ecrans/Compta.jsx` (Argent) | tout | 849 | 24 |
| `ecrans/Stats.jsx`, `PrixMarche.jsx` | tout | 333 | 9 |
| `ecrans/Achats.jsx`, `FilsTous.jsx`, `MessagesLeboncoin.jsx`, `LitigesEnCours.jsx` | tout | 192 | 9 |

Les clés déjà traduites par la branche sont **réutilisées** (même texte français ⇒ même clé) ; seules
**150 clés neuves** (textes que main a ajoutés depuis le 11 nov.) ont été traduites dans les quatre langues
(fichiers `src/i18n/langues/<l>/<écran>.js`). `OffresAuto.jsx` : celui de main (déjà passé à `tr()`, clés `oa.*`).
Les dictionnaires `fr/en/es/it/de.js` : les deux côtés gardés (les fichiers par écran de la branche + les
clés posées par main depuis).

**Laissés en français (dit, pas caché)** : les textes dont une variable porte un MOT français accordé
(`motsVendeur()` — « paire/article », « e », « es », « le/la ») : 30 textes (`Enlever 3 paires du stock ?`,
`{Noms} rangé{e}s…`). Les traduire demande une version de `motsVendeur` par langue — lot à part.
Restent aussi « à la main » ceux que l'outil liste (gabarits qui portent du texte, texte comparé ailleurs).

## Les preuves
- **Le français à l'écran est inchangé mot pour mot** : relevé du texte de `.vrm-main` sur 9 écrans
  (Ma journée, Ventes, Achats, Annonces, Stock, Argent, Statistiques, Messages, E-mails) à 390 et 1512 px,
  harnais de `nouveau-vendeur` (données inventées), main (68ada92a9) contre la branche : **18/18 identiques**
  (seule différence : l'heure affichée dans Messages, relevés à 2 min d'écart).
- `audit-traduction` : 45 verts, 0 rouge (dictionnaires, variables identiques dans les cinq langues, clés appelées).
- `audit-variables`, `audit-tdz` : verts ; `npm run build` vert.
- Banc `traduction` : **400 OK / 10 KO** ; sur main **250 OK / les MÊMES 10 KO** (« la navigation dit les
  noms du dictionnaire » : la barre a changé depuis le lot 1 — préexistant).
- CI de la PR : tous les audits et bancs principaux (voir la PR).

Geste de Julien : aucun. (Avant d'ouvrir VRM hors de France : relecture native des traductions.)
