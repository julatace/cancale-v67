# VRM — dossier de passation

**Lis ce fichier en entier avant de coder. Il est court exprès.**
L'historique détaillé (chaque session, chaque mesure, chaque erreur et sa cause)
vit dans **`docs/journal-2026.md`** — 7 700 lignes, à ouvrir seulement si tu
cherches *pourquoi* une règle existe. Tout ce qui est nécessaire pour travailler
sans rien casser est ici.

---

## 1. Le projet en dix lignes

Julien revend des sneakers d'occasion sur Vinted (plusieurs comptes). **VRM** est
son outil de gestion : annonces, ventes, achats, colis, numéros de rangement,
comptabilité. Il n'est **pas développeur** et pilote tout par des sessions Claude.

| pièce | où | quoi |
|---|---|---|
| **App** | `src/App.jsx` — un seul fichier, ~22 000 lignes | React + Vite, styles en ligne |
| **Extension Chrome** | `vinted-sync-extension/` | capte les données Vinted depuis SON navigateur |
| **Serverless** | `api/*.js` | emails entrants, widget iPhone, notifications push, IA |
| **Données** | Supabase `app_data` (clé-valeur JSONB) + `vinted_accounts` | pas de vrai schéma relationnel |
| **Prod** | https://vrm.center (Vercel, auto-déployé sur `main`) | |
| **Dépôt** | `julatace/cancale-v67`, **PUBLIC** ⚠️ | branche de travail : `claude/new-session-gzdgur` |

---

## 2. Les règles de Julien — permanentes, jamais à re-négocier

1. **Pousse à chaque modification.** Aucun travail ne reste en local : une session
   qui perd son conteneur perd tout, et la suivante le refait à l'envers.
2. **Déploie toi-même** (autorisation donnée le 5 septembre) : ouvrir une PR
   depuis la branche et la merger. Ne plus lui demander.
3. **N'invente jamais de données.** Aucune ligne de test dans la base de
   production. Les bancs servent des copies.
4. **« Même avec 50 articles identiques, tu ne dois pas pouvoir te tromper »** —
   aucun rapprochement par ressemblance (titre, marque, taille). Voir §5.
5. **Il saisit les prix d'achat lui-même.** Ne pas les deviner.
6. **L'extension se livre en zip qui se dézippe en UN dossier.**
7. **Il n'est pas développeur** : une alerte qui ne dit pas quoi faire ne sert à
   rien ; un chiffre qu'on ne peut pas vérifier est invendable.

---

## 3. Ce qui est refusé, définitivement (redemandé ~8 fois)

Ce ne sont pas des positions de principe : chacune a une raison technique.

| demande | pourquoi non |
|---|---|
| republication automatique en file, avec délais aléatoires | un délai « faussement humain » n'a qu'un usage : tromper la détection bot. C'est ce qui a fait bloquer `vanessa5723`. |
| accepter une offre automatiquement | ça engage une **vente ferme**, et le champ « offre encore en attente » n'a **jamais été observé** (toutes les offres captées sont déjà acceptées/refusées). On trancherait sur un code inconnu, avec de l'argent réel. |
| piloter la souris / le clavier | Vinted reçoit la **même requête** ; en plus un événement synthétique porte `isTrusted:false`, donc ça **ajoute** une preuve d'automatisation. Et un clic aveugle agit à côté quand la page bouge. |
| modifier les photos pour republier / passer sur un autre compte | Vinted relie les comptes par **appareil, navigateur, adresse, moyen de paiement** — pas par les images. Tourner une photo ne protège de rien. |
| supprimer une annonce automatiquement | irréversible et sans confirmation côté Vinted. |
| envoyer des messages en série aux favoris | **Vinted ne dit jamais QUI a mis en favori** (mesuré : aucun endpoint, aucun champ). Il n'y a pas de destinataire. La remise aux favoris de Vinted, elle, touche tout le monde en un clic. |

**Ce qui EST autorisé et automatique** : générer un bordereau et récupérer son
PDF (ça n'engage aucun argent, la vente est faite, le colis doit partir), et
toute **lecture** sur ses propres données.

**Garde-fous de l'extension, à ne jamais retirer** : agir uniquement au nom du
**compte connecté dans l'onglet** (`garde`), plafond de **20 actions/heure par
compte**, plafond par visite, requêtes **une par une** en attendant la réponse.

---

## 4. Les lois du code — chacune a coûté cher

1. **Une liste vide n'est jamais une réponse.** Session expirée, page pas ouverte,
   appel refusé → `[]`, pas une erreur.
2. **Une capture partielle ne doit jamais écraser une capture complète**
   (`listePlusRiche`). Le compteur se lit **en scalaire** (`select=n:data->>nItems`).
3. **`updated_at` ment** : la table n'a aucun trigger, la colonne garde la date de
   **création**. Utiliser `harvestTs(row)` (lit `data.capturedAt`). Toute écriture
   passe par `withOwner`, qui estampille `updated_at`.
4. **Jamais `select=data` sur une ligne lourde** (bordereaux avec PDF, commandes).
   Projeter les scalaires. Un `select=data` sur le widget a crevé le quota d'égress
   (5,7 Go). Quand tu corriges ça côté app, **vérifie aussitôt les `api/*.js`** :
   ils ont leur propre code de lecture.
5. **Supabase plafonne une réponse à 1 000 lignes sans le dire.** Utiliser
   `lireTout(query)` (pagination par en-tête `Range`).
6. **Piège TDZ** : un `useMemo` s'exécute immédiatement — il doit être placé
   **après** tout ce qu'il lit, sinon écran blanc au premier rendu.
7. **`( {/* … */} )` n'est pas un commentaire, c'est un objet vide** → React
   error #31, écran en erreur.
8. **Un helper n'est utilisable que dans la fonction où il est déclaré**
   (`background.js` en particulier). `node --check` ne le voit pas.
9. **Dans un service worker MV3, aucun tampon ne survit à 30 s en variable de
   module.** Chrome tue le worker. Utiliser `chrome.storage.local`.
10. **Une fonction serverless n'est vérifiée que si un banc l'EXÉCUTE.**
    `npm run build` ne compile pas `api/`.
11. **Une découpe par numéros de ligne se vérifie sur ce qui RESTE.** Deux écrans
    entiers ont disparu comme ça, sans qu'aucune erreur soit levée.
12. **`-0 < 0` est faux en JavaScript** (calcul de délais).

---

## 5. Les règles métier intouchables

### L'identité d'une paire
**Jamais par titre, jamais par ressemblance.** Dans l'ordre :
1. **identifiant d'annonce Vinted** — `transaction_id` → détail de transaction →
   `item_id` (`identiteAnnonce`) ;
2. **photo** (`entryKeyByPhoto` : fichier exact, puis dossier **non ambigu**) ;
3. **n° de transaction**, **n° de suivi** — des identités elles aussi.

Mesuré : 22 % des ventes portent un titre en double, et le titre désignait la
**mauvaise** annonce dans 3 cas réels. **Mieux vaut un blanc qu'un faux** — un
numéro faux ne se voit pas, il envoie la mauvaise chaussure.
`scripts/audit-identite.cjs` pose 50 paires rigoureusement identiques et vérifie
qu'aucune règle n'en désigne une.

### Les numéros de rangement
- **Un numéro n'est JAMAIS réattribué** (il est écrit sur un carton réel). Le pool
  est append-only ; `freedNums` a été supprimé — ne pas le réintroduire.
- Le compteur qui monte à 330 pour 30 paires en stock est **normal** : ça veut
  dire 329 paires passées. Ne pas « corriger ». « Renuméroter à la suite » n'est
  plus proposé nulle part.
- **Rien ne change un numéro tout seul.** Les seuls chemins : les champs N° (annonce
  ou vente), le bouton d'un doublon, le bandeau ♻️ de reprise — **tous sur son clic**.
  Seule exception : une annonce **sans** numéro en reçoit un automatiquement.
- **Deux paires présentes sous le même numéro** est le seul risque irréversible de
  l'app : c'est le seul endroit où le rouge est justifié.

### Les chiffres
- **Un total partiel qui se présente comme complet est pire qu'un total absent.**
  On somme uniquement ce qu'on connaît, et on affiche la couverture à côté
  (« sur 1 vente sur 175 »). Vaut pour le bénéfice, l'argent en attente, l'URSSAF.
- **Une seule règle par notion, un seul propriétaire** : un écran publie
  (`vinted_nums_physiques`, `vinted_urssaf_mois`, `widget_stats`), les autres
  consomment. Ne jamais recalculer ailleurs.
- **Tout est daté au jour de la VENTE.** La date d'encaissement a été retirée
  exprès (elle n'existait que pour une partie des ventes). Ne pas la réintroduire
  sans qu'il le redemande.
- Le rapport comptable dit « CA des ventes finalisées », **jamais « encaissé »** :
  l'URSSAF demande légalement les recettes encaissées, et l'app ne les connaît pas.

### L'extension n'écrit jamais la ligne `main`
Elle écrit dans ses **lignes dédiées** (`panel_bords_done`, `panel_buyprices`,
`panel_accounts_off`, `panel_colis_relais`, …) en lecture-fusion-écriture.
L'app les lit en source supplémentaire, jamais l'inverse.

### Les emails
- **C'est l'adresse de RÉCEPTION qui décide** à quel vendeur appartient un email —
  jamais l'expéditeur, le sujet ou le corps (sinon n'importe qui déposerait des
  données chez un autre).
- **On ne jette aucun email** : ce qu'aucune règle ne reconnaît est conservé entier.
- Le classement d'un colis se lit **sur le SUJET d'abord**, le corps seulement en
  repli (le corps d'un « colis disponible » contient les consignes de retrait).
- **Un colis caché est un colis perdu** : on n'écarte jamais un colis en silence.

---

## 6. Comment on vérifie (et pourquoi ça compte)

**La méthode : mesurer la vraie base AVANT de coder.** La moitié des « bugs »
signalés venaient d'un de mes propres scripts qui lisait le mauvais champ.
Avant de conclure « c'est vide » : vérifier le **nom** et la **forme** du champ
(le prix Vinted est un **objet** `{amount}`, pas un nombre).

| outil | quoi |
|---|---|
| `npm run build` | compile — ne voit ni les variables absentes ni le rendu |
| `node scripts/audit-*.cjs` | **20 audits** : identité, chiffres, cohérence app↔extension, QR, colis, push, URSSAF, relevé, variables non déclarées, secrets… |
| bancs Playwright (scratchpad) | l'app **rendue sur les vraies données**, à 390 px et 1512 px |
| banc `vm` + faux `chrome` | le VRAI code de l'extension exécuté hors de Chrome |

**Trois règles de preuve :**
1. **Un audit doit ÉCHOUER sur le code d'avant**, sinon il ne prouve rien.
   Méthode : `git archive HEAD | tar -x -C /tmp/avN`, **copier le script DEDANS**
   et le lancer **DEPUIS cet arbre** (sinon `__dirname/..` relit le dépôt courant
   et la preuve est truquée).
2. **Regarder la capture d'écran fait partie du test.** Un défaut d'affichage ne
   lève aucune erreur : image cassée, texte en double, écran vide, débordement.
   Un défaut dans un canvas (3D) ne se cherche pas dans le DOM.
3. **Servir TOUTES les familles de lignes et TOUTES les formes de requête** au
   banc (`id=eq.`, `id=like.`, `select=`), sinon on mesure un artefact.

⚠️ Ne jamais lancer `npm run build` pendant qu'un banc sert `dist/`.
⚠️ `git fetch` avant toute comparaison avec la production : une référence locale
jamais rafraîchie ment en silence.

---

## 7. Le visuel

Règle unique, posée après six passes ratées :

> **UNE SEULE couleur d'accent, et elle est RARE.** Tout le reste est neutre. Un
> chiffre ne porte une couleur que s'il y a **vraiment quelque chose à rattraper**.

Famille actuelle : fond gris froid `#F6F7F9`, cartes blanches, encre ardoise
`#10151B`, accent bleu `#1E5FCC`, navigation (rail / barre du bas) en ardoise —
c'est elle, la signature. Mode sombre choisi, pas inversé automatiquement.

- Une couleur en dur qui n'est pas dans `THEMES` ne suivra pas un changement de
  palette : `grep -oE '#[0-9a-fA-F]{6}' src/App.jsx` après chaque passe.
- Un emoji utilisé **comme icône** devient une icône au trait (`ICON_PATHS`, qui
  attend du **JSX**, pas une chaîne — sinon rien ne se dessine).
- **Quand il dit trois fois « c'est pareil », arrêter de retoucher les teintes et
  aller mesurer la composition** à sa résolution de travail (1512 px, ordinateur).
  Les deux vrais défauts trouvés comme ça : une app mobile étirée sur 1440 px, et
  un accueil qui s'arrêtait au tiers de l'écran.

---

## 8. État au 5 septembre 2026

| | |
|---|---|
| annonces en ligne | ~30 · **0 sans numéro · 0 doublon de numéro** ✅ |
| paires numérotées | 278 · **0 prix d'achat** ⚠️ (il les saisit lui-même ; outils : saisie en série, suggestion en un tap) |
| notifications push | ✅ fonctionnent (clé VAPID posée sur Vercel) |
| comptes Vinted | 9, dont 5 dont la boîte **ne fait suivre aucun email** → aucune notification de vente possible pour eux (affiché dans Réglages) |

**Ouvert :**
- **La forme d'une ligne de VENTE dans le relevé du porte-monnaie.** Le relevé daté
  est capté (`harvest_{uid}_releve_{YYYY-MM}`), mais le seul mouvement jamais
  observé est un **virement sortant** — et il porte `type:"credit"`. Donc
  « credit » ≠ « recette ». **Ne baptiser aucun total « CA encaissé » avant
  d'avoir vu une vraie ligne de vente en base.** C'est ce qui débloquera un vrai
  « argent reçu » par mois pour l'URSSAF.
- Le paramètre `?year=&month=` des mois passés : jamais observé, tenté de façon
  bornée, et le compte est marqué muet si Vinted l'ignore.
- **Dépôt PUBLIC** et **RLS désactivé** : la clé « anon » du bundle donne un accès
  complet en lecture/écriture, y compris aux jetons Vinted. Les deux gestes qui
  referment ça (passer le dépôt en privé, appliquer
  `supabase/migrations/001-multi-utilisateurs.sql`) n'appartiennent qu'à lui.
  Détail dans `SECURITE.md`.

---

## 9. Chemins utiles

```
src/App.jsx                     l'app (grep avant de lire — le fichier est énorme)
vinted-sync-extension/          background.js · inject.js · vinted-panel.js · content.js
api/                            email-inbound · push · widget · ship-reminders · ai
scripts/audit-*.cjs             les 20 audits
docs/journal-2026.md            l'historique complet (pourquoi chaque règle existe)
SECURITE.md · .env.example      ce qui doit rester hors du dépôt
```

Chromium du banc : `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
(`--use-angle=swiftshader --no-sandbox`).
