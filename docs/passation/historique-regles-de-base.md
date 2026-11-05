# Historique — regles-de-base

> Texte déplacé TEL QUEL depuis `CLAUDE.md` le 31 octobre 2026 (allègement du dossier : 1,36 Mo → moins de 60 Ko).
> Rien n'a été réécrit : les paragraphes gardent leur ordre d'origine. Le classement par thème est automatique (mots du titre) — en cas de doute, chercher par `grep` dans tous les `docs/passation/historique-*.md`.


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
8. **Sur eBay, c'est l'acheteur qui paie le bordereau** (11 octobre, mot pour
   mot : « pour ebay on est d'accord c'est l'acheteur qui paye le bordereau »).
   Son compte est en livraison gérée par eBay : l'acheteur paie le port à eBay,
   eBay fournit l'étiquette prépayée. VRM n'achète **jamais** une étiquette avec
   son argent, ne pose **jamais** « livraison gratuite », et le port n'est ni une
   recette ni une charge dans sa compta. L'achat d'étiquettes chez un agrégateur
   (chantier K14 de l'agent eBay) est **gelé** pour lui.
9. **Aucune fonction payante à l'usage ne tourne sur SA clé pour les autres**
   (11 octobre : « trouve une solution sans IA ou avec leur clé API mais pas la
   mienne »). Traduction, détourage, IA, lecture d'image : d'abord **sans IA**
   (ce que le navigateur fait seul : reconnaissance vocale, traducteur intégré à
   Chrome, modèle local dans la page) ; sinon **la clé du vendeur**, collée par
   lui, rangée côté serveur, jamais relue par le navigateur. Une fonction qui
   n'a ni l'un ni l'autre se tait et dit pourquoi — jamais un repli sur sa clé.

---

## 3. Ce qui est refusé, définitivement (redemandé ~8 fois)

Ce ne sont pas des positions de principe : chacune a une raison technique.

| demande | pourquoi non |
|---|---|
| republication automatique en file, avec délais aléatoires, SANS lui | un délai « faussement humain » n'a qu'un usage : tromper la détection bot. ⚠️⚠️ **NUANCE DU 27 OCTOBRE, sa demande explicite — ne PAS confondre avec un refus de l'atelier.** Julien : « prépare le brouillon VRM → mets en brouillon sur Vinted → attends un peu → publie ; qu'on puisse baisser de tant de % le prix ; sélectionner les paires en ligne du compte ». L'**atelier de republication** (tranches 1-5, `AtelierBrouillon`/`AtelierLots`/`AtelierFile`) est à LUI : il choisit les annonces, l'ordre, l'espacement (fixe OU variable, SON choix), et il LANCE (double opt-in : case « Publier pour de vrai » + case « Je confirme »). Ce qui est livré en réel (tranche 5, `republierVinted`) est la forme **SÛRE et mesurée** : **baisser le prix EN PLACE** (`PUT …/item_upload/items/{id}`) — jamais une suppression, jamais une création, rien ne peut être perdu. Gardé par : confirmation · compte connecté (garde stricte) · **sauvegarde coffre vérifiée** · **modèle de CETTE annonce appris** du corps que Vinted a accepté (sinon refus — on ne devine pas une structure, §4.10). `audit-republier.cjs` l'EXÉCUTE (§4.10) : tout prêt ⇒ UN PUT au prix baissé · sept cas refusés ⇒ 0 requête · plancher (§19) respecté · Vinted refuse ⇒ « échec », annonce intacte ; `--prouve` : 0 sur le code d'avant. ⚠️ **Ce qui reste REFUSÉ** : la republication **à l'aveugle** (délais aléatoires sans qu'il la lance), ~~et le **delete+recreate** tant que sa forme n'était pas mesurée~~ → **mesurée sur ses requêtes et livrée le 28 octobre (5.248, `recreerVinted`)** : l'ancienne annonce n'est supprimée qu'APRÈS la création confirmée de la nouvelle. `EXT_CAPACITES.republier = '5.240.0'`. **Ne pas re-refuser l'atelier sur cette ligne.** |
| **accepter une offre automatiquement** — ✅ **MOTEUR auto (Vinted) rétabli le 27 oct. (soir), ÉTEINT par défaut ; natif eBay** | coupée le 4 octobre (« je ne veux pas que ça accepte tout seul les offres »), **retirée** le 5 octobre (« enlève l'acceptation de l'offre ») : le moteur de l'extension, ses planchers, le champ « Min. accepté », l'interrupteur de Réglages. Accepter engage une vente ferme, et un programme qui accepte ressemble à un robot (le compte bloqué). **Ne jamais le reproposer** — je l'ai fait par erreur le 5 octobre en lisant l'ancienne version de cette ligne. Reste permis : accepter UNE offre depuis la messagerie, sur son clic, avec confirmation (`executerPourApp`). `audit-offres-auto.cjs` refuse tout autre chemin vers `/accept`. ⚠️ **Tout ce qui précède vaut pour VINTED. Sur eBay, Julien l'a demandé le 9 octobre**, en ses mots : « Je veux juste définir une règle sur chaque annonce et à chaque offre au-dessus ça accepte », puis, à la question « aussi sur Vinted ? » : « **eBay seulement** », et « J'accepte » sur le plan. Sur eBay c'est donc permis, sous UNE seule forme : le **seuil natif d'eBay** (`BestOfferAutoAcceptPrice`), posé annonce par annonce **sur son clic**, avec une confirmation qui dit qu'une offre acceptée vend la paire. C'est eBay qui accepte : VRM n'appelle aucune route d'acceptation et ne décide rien (`audit-offres-auto.cjs` le vérifie aussi pour `api/`, section 5). ⚠️⚠️ **VINTED — REVIREMENT DU 27 OCTOBRE, sa décision en connaissance de cause.** Julien : « à côté du numéro on met un prix minimum et tout au-dessus est accepté », puis, mis devant le risque (c'est le comportement qui a bloqué `vanessa5723`) : « **fais en sorte que je ne sois pas bloqué, trouve quelque chose** ». Vinted n'a **pas** de seuil natif : un moteur qui accepte seul = signal robot = compte bloqué. Un **prix mini** (`vinted_annonce_numeros[id].min`, à côté du N°, synchronisé, l'app propriétaire, l'extension le lit — §11) marque les annonces qu'il laisse partir à ce prix. D'abord livré en **1-tap** (l'offre ≥ mini mise en avant, SON tap accepte). Puis, le 27 octobre au soir : « **non je veux que ça accepte tout seul** » → choix explicite **« Moteur auto (accepte seul) »**, le risque de blocage remis sous ses yeux. ⚠️⚠️ **ET IL A DÉMENTI MA THÉORIE** : « c'est bien mais **ce n'est pas du tout ce qui a fait bloquer Vanessa, enlève-toi ça de la tête** ». En propriétaire du compte, il sait ce qui l'a bloqué, et ce n'est PAS l'acceptation auto. ⇒ Le moteur `autoAccepterOffres` (extension) est **RÉTABLI** : il accepte seul toute offre ≥ mini, **éteint par défaut** (`vinted_offres_auto` ; l'interrupteur de l'app AVERTIT que ça accepte à sa place, il ne rassure pas). Espacement **ALÉATOIRE** entre deux acceptations (il l'avait demandé — « ça peut être aléatoire » — j'avais refusé à tort sur la théorie vanessa, corrigé). GARDE-FOUS jamais retirés : `garde` (compte connecté dans l'onglet, plafond 20/h, arrêt net sur pause 429/403), une requête à la fois, volume borné par visite, chaque offre acceptée **une fois** (mémo `vrmOffresFaites`). `audit-offres-auto.cjs` vérifie que ces gardes tiennent ; `audit-moteur-offres.cjs` **EXÉCUTE** le moteur (§4.10) — offre ≥ mini ⇒ accepte · six cas interdits (sous le mini, éteint, pas su, autre compte, pause, déjà traitée) ⇒ rien · volume borné ⇒ 3 sur 4 ; `--prouve` : 0 sur le code d'avant. La voie MANUELLE (messagerie de l'app, son clic) reste via `executerPourApp`/`EXEC_PERMIS`. **REFUS AUTO (même décision, « tu proposes au vendeur de fixer SA règle ») :** à côté du mini, un seuil **`refuse`** par annonce — une offre SOUS ce seuil est refusée seule (`reject`), et SON message (`vinted_offre_refus_msg`, jamais inventé, **vide par défaut** ⇒ refus sans message) part à l'acheteur après le refus ; entre `refuse` et `min`, VRM ne touche à rien. Même file/garde/plafond que l'accept ; `audit-moteur-offres.cjs` le couvre (offre < refuse ⇒ reject (+ message si texte) · entre les deux ⇒ rien). ⚠️ **Ne JAMAIS re-régler l'espacement en « fixe » ni ré-interdire le moteur sur la théorie « auto = blocage vanessa »** : il l'a explicitement démentie. Détail : « eBay : au-dessus, ça accepte » plus bas. |
| piloter la souris / le clavier | Vinted reçoit la **même requête** ; en plus un événement synthétique porte `isTrusted:false`, donc ça **ajoute** une preuve d'automatisation. Et un clic aveugle agit à côté quand la page bouge. |
| modifier les photos pour republier / passer sur un autre compte | Vinted relie les comptes par **appareil, navigateur, adresse, moyen de paiement** — pas par les images. Tourner une photo ne protège de rien. |
| supprimer une annonce automatiquement | irréversible et sans confirmation côté Vinted. |
| messages automatiques aux favoris | **Nouvelle demande explicite du 23 octobre** : Julien souhaite 10 destinataires maximum par heure et par compte et accepte le risque. Le compteur des annonces ne donne pas les identités ; le capteur de notifications peut en recevoir, mais son rapprochement avec la conversation reste à vérifier. Aucun envoi actif à cette date. Voir `docs/passation/2026-10-23-favoris.md` pour les limites et la suite. |

**Ce qui EST autorisé et automatique** : générer un bordereau et récupérer son
PDF (ça n'engage aucun argent, la vente est faite, le colis doit partir), et
toute **lecture** sur ses propres données.

**Refusé par Julien le 11 octobre (son choix, pas une limite technique) — ne pas
reproposer** : « imprimer la journée » avec une liste de préparation triée par
emplacement ; les étiquettes de carton avec QR code ; le prix conseillé à la mise
en ligne (calculé sur ses ventes passées) ; l'alerte « achat jamais arrivé » ;
l'alerte « argent bloqué » ; le rappel des messages sans réponse depuis 24 h ; le
rappel des évaluations à laisser ; la sauvegarde hebdomadaire envoyée chez lui ;
le widget iPhone enrichi.
Et, le même jour, parmi les nouveautés proposées : le badge « bonne affaire »
sur Vinted, la saisonnalité, la photo d'étiquette → fiche, les acheteurs fidèles.

**Retenu par Julien le 11 octobre (à construire, en plus du reste)** : prix
d'achat au numérotage · double vente app fermée · rappel URSSAF · fiche
« republier » · app plus rapide · page « tout va bien ? » · codes de retrait hors
ligne · rappel la veille au soir · fiche prête à l'arrivée d'un achat · plan des
paires qui dorment · bénéfice réel · récap comptable · réponses rapides · double
vérification de connexion · achats à vérifier avant la date limite · retour →
stock · favoris sans vente (remise native) · boost rentable ? · compte qui vend
le mieux · ce qui part vite · studio photo + détourage · saisie vocale ·
traduction des messages · mode équipe — les fonctions payantes selon la règle
§2.9.


**Garde-fous de l'extension, à ne jamais retirer** : agir uniquement au nom du
**compte connecté dans l'onglet** (`garde`), plafond de **50 actions/heure par
compte** (20 jusqu'au 29 octobre, monté à 50 sur sa décision), plafond par visite, requêtes **une par une** en attendant la réponse.

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
    ⚠️ **Et un composant jamais rendu ne lève rien non plus.** `Nav` (un tiroir de
    navigation avec `TABS` et `ARCHIVE_TABS`) était défini, complet, et
    **référencé nulle part** — un `<Nav …>` n'existait pas dans le fichier. Il
    portait une SECONDE navigation, aux libellés différents de la vraie
    (« Stats » contre « Statistiques », un « Comptabilité » qui n'existe nulle
    part ailleurs) et sept emojis-icônes qui ressortaient à chaque audit du §7.
    Retiré le 7 septembre (66 lignes) après avoir vérifié que « Ancien
    catalogue » et « Anciennes ventes » restent joignables depuis Réglages.
    **Avant de « corriger » une navigation, vérifier qu'elle est rendue** :
    `grep -c '<Nom'` — et compter les écrans montés (`tab===`) avant ET après
    la coupe (13 des deux côtés).
12. **`-0 < 0` est faux en JavaScript** (calcul de délais).

---


## 6. Comment on vérifie (et pourquoi ça compte)

**La méthode : mesurer la vraie base AVANT de coder.** La moitié des « bugs »
signalés venaient d'un de mes propres scripts qui lisait le mauvais champ.
Avant de conclure « c'est vide » : vérifier le **nom** et la **forme** du champ
(le prix Vinted est un **objet** `{amount}`, pas un nombre).

| outil | quoi |
|---|---|
| `npm run build` | compile — ne voit ni les variables absentes ni le rendu |
| `node scripts/audit-*.cjs` | **84 audits** : identité, chiffres, cohérence app↔extension, QR, colis, push, URSSAF, relevé, variables non déclarées, secrets… |
| `scripts/bancs/*.cjs` | les **76 bancs** — l'app **rendue sur les vraies données**, à 390 px et 1512 px — leur `README.md` dit comment les lancer. ⚠️ Leurs fixtures (`fx/`) ne montent **jamais** dans le dépôt : vraies ventes, vrais acheteurs, vraies adresses, dépôt **public**. `audit-bancs.cjs` le vérifie. |
| `node scripts/audit-*.cjs` | **156 audits** : identité, chiffres, cohérence app↔extension, QR, colis, push, URSSAF, relevé, variables non déclarées, secrets… |
| `scripts/bancs/*.cjs` | les **201 bancs** — l'app **rendue sur les vraies données**, à 390 px et 1512 px — leur `README.md` dit comment les lancer. ⚠️ Leurs fixtures (`fx/`) ne montent **jamais** dans le dépôt : vraies ventes, vrais acheteurs, vraies adresses, dépôt **public**. `audit-bancs.cjs` le vérifie. |
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
   ⚠️ **La projection `select=` compte autant que la ligne.** Rendre `{id,data}`
   pour une requête `select=id,filename:data->>filename,…` fait lire
   `r.filename` sur un objet qui ne l'a pas : tous les bordereaux tombaient et
   l'écran Colis affichait « 0 bordereau prêt à imprimer » alors que dix étaient
   en base. C'est ce qui m'a fait chercher au mauvais endroit pendant plusieurs
   passes. Les bancs appliquent la projection (`projette`).
4. **Un écran tombé sur le garde-fou passe TOUS les contrôles.** « Cet écran n'a
   pas pu s'afficher » est un vrai texte, sans débordement et sans `pageerror`
   (React avale l'exception) : le banc répondait « rendu conforme » sur un écran
   MORT. Le contrôle existe maintenant dans les deux bancs de rendu.
5. **Un contrôle qui se déclenche sur la FORMULE est vert sur le code d'avant.**
   Premier jet : « si la phrase parle d'attendre un code, elle doit nommer un
   compte » — sur l'ancien texte la condition tombait à faux, le banc annonçait
   « rien à vérifier » et passait au VERT sur le défaut qu'il devait attraper.
   C'est la BASE qui déclenche : *s'il existe un colis sans code, la ligne doit
   nommer un compte*, quelle que soit la formulation. (Même leçon que
   `audit-identite` : suivre la règle, pas son orthographe.)
6. **Playwright prend la DERNIÈRE route enregistrée en premier** : un fourre-tout
   `**/api/**` posé après `**/api/relais**` avale la route précise et répond
   `{pret:true}` — la carte restait vide sans lever la moindre erreur.

⚠️⚠️ **PLUSIEURS SESSIONS MERGENT SUR `main` EN MÊME TEMPS** (3 octobre : une
session fait l'extension et les colis Leboncoin, une autre eBay). Pour amener
`main` dans sa branche : **`git merge origin/main`, un VRAI merge**, conflits
résolus à la main — **jamais `git merge -s ours`** : il garde l'arbre de la
branche, la PR qui suit **défait en silence** tout ce que les autres ont mergé.
Après le merge, `git diff origin/main --stat` ne doit montrer **que ses propres
fichiers**. Et ne pas toucher au domaine d'une autre session (eBay) : lui laisser.
⚠️⚠️ **LE PLAN GRATUIT DE VERCEL PLAFONNE À 100 DÉPLOIEMENTS PAR 24 H — ET LES
BRANCHES `claude/…` LES AVAIENT TOUS MANGÉS** (4 octobre). Chaque `git push` sur
une branche créait une prévisualisation : 59 ce jour-là (36 pour une seule
session), plus 24 mises en production. Le merge de la PR #441 est tombé sur
« Deployment rate limited — retry in 24 hours » : `main` était à jour, le site,
lui, restait sur la version d'avant. ⇒ `vercel.json` coupe désormais les
déploiements des branches `claude/**` (`git.deploymentEnabled`) ; seul `main`
se déploie. La preuve d'une branche, ce sont **nos** audits et bancs, pas une
prévisualisation. ⚠️ **Ne jamais « promouvoir » une prévisualisation pour
contourner la limite** : les clés de service (Supabase, notifications, cron,
Stripe, eBay) n'existent qu'en Production — la promouvoir couperait la réception
des emails, les notifications et les paiements. Attendre la fenêtre, ou que
Julien décide de passer en Pro.
⚠️ Ne jamais lancer `npm run build` pendant qu'un banc sert `dist/`.
⚠️ `git fetch` avant toute comparaison avec la production : une référence locale
jamais rafraîchie ment en silence.

---

