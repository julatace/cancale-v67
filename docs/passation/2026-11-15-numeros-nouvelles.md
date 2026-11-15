# 15 novembre 2026 — Les nouvelles annonces sans N° (branche `claude/numeros-nouvelles`)

## La demande de Julien

> « Quand je publie une paire sur Vinted directement dans l'application [l'app Vinted
> du téléphone] sans l'extension, je veux que quand je me reconnecte avec l'extension,
> cela attribue des numéros aux paires et que cela me prévienne que ça le fait — quand
> j'ai accepté que ce soit VRM qui fasse la numérotation ; sinon c'est à moi de le
> faire, mais c'est l'application qui me demande à chaque fois quel numéro attribuer
> à chaque paire que je poste. »

Précision du même jour : « article » — chaussures, sacs, vêtements, manuels. Aucune
règle de N° ne dépend de la catégorie ; seuls les MOTS suivent le profil du vendeur
(« paires » pour Sneakers, « articles » sinon, `src/profilVendeur.js`).

## Mesuré avant de coder (code + base de production en lecture seule)

- **La numérotation existait déjà, côté app** : l'effet de numérotation de
  `Comptabilite` (App.jsx) donne `prochainLibre` (plus haut + 1, jamais un trou) à
  toute annonce de `listings.items` sans N°, après les identités (vente de la même
  annonce, N° écrit, N° réservé à côté de « Publier », même photo, annonce
  republiée). Il tourne quand un écran qui lit les annonces est ouvert (Ma journée,
  Annonces, Ventes, Messages, Colis) — y compris sur le signal de l'extension après
  une capture. Rien ne tourne app fermée.
- **`listings.items` excluait déjà les « à confirmer »** (règle `<enligne-regle>`,
  lecture de plus de 24 h) mais **ne regardait pas si la lecture était COMPLÈTE**
  (`complets[uid]`, `lectureDressingComplete`) : une capture partielle numérotait.
- **Ce n'était dit nulle part en dehors d'Annonces** : un bloc replié « N mises en
  ligne numérotées par VRM » (48 h, « C'est bon » rangé sur l'appareil seulement).
  Aucune notification, rien dans Ma journée, rien sur la carte de l'extension.
- **« Je numérote moi-même »** (`vrm_numero_ecrit`, synchronisé, SYNC_KEYS) : VRM lit
  le N° écrit (fin de description, titre, référence) et n'en donne aucun. Une annonce
  sans N° écrit restait simplement « sans numéro » : rien ne lui demandait un N°.
- **Base de Julien** (owner `74eea6e7…`, 15 nov.) : réglage `actif: false` choisi le
  9 nov. (⇒ « VRM numérote ») ; 10 comptes Vinted, 37 annonces ouvertes, **0 sans N°**
  aujourd'hui ; tous ses dressings portent `total_entries` = nombre lu (lectures
  complètes) ; plus haut N° servi : 216 ; journal des N° : 72 N° « auto » depuis le
  1er nov. Le changement ne renumérote donc rien chez lui.

## Ce qui change

Règle : `src/numerosNouvelles.js` (JS pur). Texte : `src/i18n/langues/*/numeros-nouvelles.js`.

1. **Mode « VRM numérote »** — dans le bloc `<numerotation-passage>` d'App.jsx (exécuté
   tel quel par l'audit) :
   - le N° NEUF (`prochainLibre`) n'est donné que sur la **lecture complète** du compte
     de l'annonce (`lectureCompleteDe` : `complets[uid]`, compte qui a répondu) —
     `numeroNeufPermis`. Les identités passent avant, inchangées (republiée ⇒ N° repris,
     N° écrit, réservé par l'id rendu à la publication depuis VRM, photo) ;
   - la fiche d'un N° neuf porte **`nouveau: { at }`** (synchronisée, fusionnée champ par
     champ) ;
   - l'appareil qui l'a donné le **dit** (`direNouveauxNumeros`) : bandeau
     « 3 nouvelles paires numérotées · N°216, 217, 218 », notification si l'app est en
     arrière-plan (`alerteLocale`, jamais en double d'une notification du serveur), et la
     carte de l'extension (ci-dessous) ;
   - **Ma journée, en tête** : « 3 nouveaux articles numérotés · N°… » (Ma journée dit
     « articles » pour tous depuis le 3 nov., `enArticles` : la forme « article » est écrite en
     entier, jamais « nouvelles articles numérotées ») ⇒ la feuille **« Nouveaux N° à écrire sur
     tes cartons »** (« paires » pour un profil Sneakers, « articles » sinon)
     (photo, N° gravé, titre, « C'est écrit » par ligne, « Tout est écrit ») ; « C'est écrit »
     pose `nouveau.ecrit` + `cartonVerifie` (geste annulable), jamais le N°.
2. **Mode « Je numérote moi-même »** — VRM n'attribue RIEN. Une annonce en ligne (lecture
   complète) sans N° ni N° écrit lisible (`demandesNumero`) ⇒ Ma journée en tête :
   « 3 articles sans numéro · Donne-leur un N° » ⇒ une feuille par article (photo, titre,
   « 1 sur 3 », champ pré-rempli avec la proposition `prochainLibre` calculée sur une COPIE,
   rien de réservé ; le rappel « Écris-le aussi à la fin de sa description » si son mode lit
   la description). La validation passe par `poserNumero` (le chemin de la carte : format,
   ancien N° « B… » refusé, N° déjà porté par un article présent ⇒ question, N° déjà servi ⇒
   question), puis le prix d'achat au numérotage (règle du 6 nov.). « Plus tard » arrête la
   série ; la ligne reste jusqu'à ce que chaque article ait son N°. Deux N° écrits / ancien
   N° : pas ici (déjà « à vérifier »).
3. **Réglages → Numéros** : « Qui numérote ? **VRM · Moi** » (deux choix, `sb-touche`,
   `role="radiogroup"`) et la phrase de ce que fait le choix pris ; même réglage synchronisé
   `vrm_numero_ecrit` (rien sur le navigateur seul).
4. **Extension 5.382.0** (`numerotes` dans `EXT_CAPACITES`) : l'app envoie par le canal
   adressé `{ type: 'numerotes', uid, ids: ['id:N°'] }` ; `annoncerNumerotes` (background.js)
   pose un lot « numérotés » (une fois par identité, `annoncerCapte`, événement) ; la carte
   près du logo dit **« VRM a numéroté · 3 paires numérotées »** (le mot du profil,
   `vrm-mots.js`), « Voir » ouvre le dressing. L'extension ne numérote RIEN : seule l'app
   connaît toutes les identités (une numérotation par l'extension aurait donné un N° neuf
   à une annonce republiée depuis le téléphone, reconnue par sa photo).
5. Annonces : le bloc « mises en ligne numérotées par VRM » ne remontre pas une ligne déjà
   « écrite » dans Ma journée.
6. Ma journée : la ligne de la cloche « N annonces sans numéro » (comptée à SON passage,
   souvent avant la numérotation — mesuré au banc : « 2 annonces sans numéro » sous « 2 nouveaux
   articles numérotés ») ne s'ajoute plus quand la ligne des nouvelles annonces est là, ni en
   mode « moi » (la demande la remplace) : le même sujet, une fois (§7).

## Ce qui n'est PAS fait (et pourquoi)

- **Rien ne numérote app fermée.** Le serveur ne porte pas les règles d'identité des
  numéros (republication par photo, ventes de la même annonce…) : une numérotation
  serveur aurait été une seconde règle, donc un risque de N° faux. La prochaine ouverture
  d'un écran de VRM numérote et le dit ; l'extension le dit sur sa carte si l'app est
  ouverte dans un autre onglet au moment de la capture.
- **Pas de notification push du serveur** pour ces N° (même raison) : la notification
  locale de l'app en arrière-plan seulement.

## Preuves

- `node scripts/audit-numeros-nouvelles.cjs` — le bloc `<numerotation-passage>` EXÉCUTÉ
  (vm) avec les vraies règles : lecture complète ⇒ 216, marqué, dit, une fois ; partielle,
  compte muet, autre compte ⇒ rien ; republiée ⇒ N°45 repris ; N° écrit ⇒ pris tel quel ;
  « moi » ⇒ rien attribué, demande créée ; 50 identiques ⇒ 11…60, jamais le N°10 de la
  fiche au même titre ; sac, manuel, paire : même règle ; deux appareils ⇒ la fusion du
  nuage refuse (`conflit`). 44 contrôles. Sur `origin/main` (`--src`) : rouge.
  `--mutation=toutes` : 10 mutations (gate de lecture complète, compte muet, marque,
  notification, demande, « c'est écrit », Ma journée, Réglages, extension).
- Banc `scripts/bancs/numeros-nouvelles.cjs` (données inventées, 390 tactile et 1512,
  clair et sombre) : A (Sneakers et « autre » : une paire + un sac), P (partielle),
  B (« moi »), R (Réglages). **181 verts.** Captures regardées (Ma journée, la feuille
  « à écrire », la feuille « Quel N° », Réglages) ; il a attrapé deux défauts corrigés :
  « 2 nouvelles articles numérotées » (Ma journée remplace « paires » par « articles »
  après coup — la phrase est maintenant écrite en entier) et la ligne de la cloche
  « 2 annonces sans numéro » dite en plus, déjà fausse (les deux venaient d'être numérotées).
- Audits verts : identite, numero-ecrit, accueil-reste, fusion-nuage, numerotation-lecteurs,
  garde-numeros-rapide, renum-b, coherence (capacité `numerotes`), extension-zip (5.382.0
  neuve), traduction, tdz, variables, studio, quoi-de-neuf, et les ~60 audits qui lisent
  `prochainLibre` / `vinted_annonce_numeros`. Rouges identiques sur `origin/main` :
  audit-benefice (App.jsx ne se lit pas : `partageFichiersPossible` déclaré deux fois),
  audit-infos-vinted (I10, copie `vrm-regles-achat.js`).
- Bancs voisins rejoués sur `origin/main` ET sur la branche (dist construits des deux) :
  numero-ecrit (2 rouges à 390 clair, les mêmes : le bloc « à vérifier » est passé dans
  « À faire » avec le Studio), prix-numerotage (12 rouges / 54 verts des deux côtés : les
  sélecteurs de la carte d'annonce d'avant le Studio ; le scénario C, celui qui dépend de la
  numérotation au chargement, vert des deux côtés — sa liste porte maintenant `total_entries`),
  accueil-reste (E3 « un toucher ailleurs la referme », rouge des deux côtés). Le banc
  numero-ecrit touche désormais le choix « Moi ».

## Geste de Julien

Aucun pour que ça marche (il est déjà en « VRM numérote »). Installer l'extension
**5.382.0** pour que la carte du logo dise aussi « VRM a numéroté ».
