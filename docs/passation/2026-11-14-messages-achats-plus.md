# 14 nov. — Messages et achats, en plus (lot `messages-achats-plus`, propositions 108, 109, 110, 111, 125, 131)

Branche `claude/messages-achats-plus`. Validé par Julien (« fais tout »). Extension **5.376.0**.

## Ce qui existait (mesuré avant de coder)

| existant | ce qu'on en a fait |
|---|---|
| Réponses rapides (`RapidesConv`, `vinted_quick_replies`) | gardées telles quelles ; la nouvelle rangée d'aide se pose AU-DESSUS, sans les remplacer |
| `src/modelesDescription.js` (variables `{taille}`… pour une DESCRIPTION) | pas réutilisé : il remplit une description d'annonce, pas une réponse ; même principe « une variable sans valeur ne se devine pas » |
| `src/notePaire.js` (note privée, clés d'identité `n:`/`a:`) | **réutilisé** : les infos à partager prennent EXACTEMENT ses clés d'identité (`clesPaire`, `cleEcriture`), et le même « N° sur deux paires ⇒ caché ». La note reste privée : jamais insérée dans un message |
| « Partage la fiche d'un article » | **absent de `main`** (lot `partage-fiche` jamais fusionné, `docs/passation/2026-11-11-visuels-reseaux.md`) : le catalogue privé est neuf, sur le modèle du lien d'agenda (`api/_lib/agenda-ics.js` : jeton, index chez le propriétaire neutre) |
| Encart `annonceDUnAutre` / `achatvinted` (5.339, `vinted-infos.js`) | **complété** : la liste de recherche et « déjà achetée » vivent dans le MÊME encart, lus dans la MÊME lecture de `main` (`donneesInfosPage`) |
| « Alertes d'achat sur tes recherches eBay » (veilles d'Organisation) | pas réutilisé : ce sont des recherches eBay (mots libres, appels à eBay, 10 au plus). La liste de recherche Vinted est structurée (marque, modèle, tailles, prix max) et ne déclenche AUCUNE recherche |
| `src/meilleuresSources.js` (« Tes meilleures sources ») | **relu** : le carnet prend le bénéfice par achat de SA publication (`lireMeilleures`, source `vinted`), jamais recalculé |
| `src/achatsDoubles.js` (« achat saisi deux fois », même n° de transaction) | autre chose : 131 = deux transactions, la MÊME annonce (`item_id`) |

Mesure de la vraie base (lecture seule, formes seulement) : le détail d'une transaction porte `seller_id`, `buyer_id`, `user_side`, `seller` (1 417 transactions : 43 côté acheteur) ; `orders_purchased.my_orders` n'a ni vendeur ni identifiant d'annonce (3 333 achats) ; 16 conversations côté acheteur portent `opposite_user.id`. ⇒ Le carnet et « déjà achetée » ont une couverture faible aujourd'hui (elle monte avec la relecture des transactions d'achat, 5.372 `suivinumero`) : elle est DITE (« vendeur connu pour N achats sur M »).

## 108 · Une info de la fiche glissée dans la réponse
- `src/infosPaire.js` (pur) : `vrm_infos_paires` = `{ 'n:<N°>' | 'a:<id>': { taille, defauts, semelle, at } }` — taille réelle et défauts dans SES mots, semelle en cm (10–40, sinon refusée). Synchronisée (SYNC_KEYS + CLES_GESTES), écrite par un geste annulable (`ecrireInfosPaire` → `gesteVrm`).
- Fiche « Tout sur le N° » : la ligne « Infos à partager » (`InfosPaireCoque`) et sa feuille (`src/InfosPaire.jsx`).
- Messages Vinted (côté vendeur) : `AideReponseCoque` → `src/AideReponse.jsx`, au-dessus des réponses rapides. Un toucher INSÈRE (`insererDansReponse` : vide ⇒ la phrase, sinon ajoutée, jamais deux fois). La phrase suit la langue du MESSAGE (fr/en/es/it/de) ; ses mots à lui ne sont jamais traduits.
- Rien ne part sans son clic : la rangée ne reçoit pas `onEnvoyer`.

## 109 · Questions fréquentes repérées, réponse proposée, sans IA
- `src/questionsFrequentes.js` (pur, aucun import réseau) : sept sujets (`dispo`, `taille`, `etat`, `mesures`, `prix`, `envoi`, `mainpropre`), une liste FERMÉE de mots par langue (mot entier, « mot* » = début de mot), langue du message par les mots repérés.
- Seuls les messages de l'acheteur APRÈS sa dernière réponse sont lus (`questionEnAttente`).
- La réponse ne contient que ce qui est su : taille ⇒ la taille de la fiche + SES mots ; défauts / semelle ⇒ ses infos. Sans l'info : RIEN de proposé, une puce « + Taille réelle » ouvre la fiche. « Toujours disponible » jamais sous une annonce prouvée partie (règle de `rapidesDuFil`).
- Pas de proposition pour « authentique ? » ni « photos ? » (ce serait affirmer quelque chose qu'on ne sait pas).

## 110 · Catalogue privé en un lien
- Annonces → ⋯ Outils → « Catalogue privé » (`src/CataloguePrive.jsx`) : il coche (sélection d'Annonces pré-cochée, recherche par titre ou N°), 1/7/30 jours (7 par défaut), « Montrer le N° » (coché par défaut, décochable), un nom facultatif. Le navigateur n'envoie QUE des identifiants d'annonces.
- Serveur : `api/_lib/catalogue-prive.js`, mode `catalogue` de `api/compte.js` (aucune 13e fonction) ; `vercel.json` réécrit `/catalogue/<jeton>`.
  - Création : SES dressings lus AVEC SA SESSION (RLS) ⇒ un identifiant qui n'est pas chez lui est absent (« N pas trouvés »), jamais la donnée d'un autre vendeur ; projection refaite par le serveur (photo, titre, marque, taille, prix affiché, N° si coché) ; le prix d'achat n'est même pas lu.
  - Lien : jeton 32 octets ; ligne `vrm_catalogue_<id>` chez lui ; index `jeton_catalogue_<sha256>` chez le propriétaire NEUTRE (seul le serveur l'écrit) qui porte l'EXPIRATION.
  - Page : HTML sans script, CSP `default-src 'none'`, `noindex`, `no-referrer`, langue du visiteur (5), liste blanche refiltrée à la sortie (une ligne retouchée n'ajoute rien).
  - Expiré ⇒ 404 ; retiré ⇒ 404 (index retiré ET ligne marquée) ; jeton inconnu ⇒ 404 ; abonnement arrêté ⇒ 404 ; base muette ⇒ 503. 20 liens actifs au plus, 60 articles par lien.

## 111 · Ta liste de recherche, signalée par l'encart
- `src/listeRecherche.js` (pur, recopié dans l'extension) : `vrm_liste_recherche` = `[{ id, marque, modele, tailles, prixMax, actif }]` (50 au plus ; sans marque NI modèle ⇒ refusée, trop large). Achats → « Pour mieux acheter » → « Ta liste de recherche ».
- Correspondance = critères structurés : marque (de la page, sinon `extractBrand` du titre), TOUS les mots du modèle dans le titre, même taille (`tailleCle` : 42,5 = 42.5, 44 2/3, XL), prix ≤ max. Un critère posé mais pas lu sur la page ⇒ pas de signal (pas su ≠ oui). C'est un signal, jamais une identité.
- Extension 5.376 : `donneesInfosPage` lit `vrm_liste_recherche` et `vrm_annonces_achetees` dans la même lecture de `main` (Supabase) ; `vinted-infos.js` compare l'annonce DÉJÀ affichée (`signauxAchat`). **Aucune requête Vinted ajoutée** (appels de `requeteVinted` comptés dans le vrai `background.js` : 3 = origin/main ; le vrai fond exécuté par `_fond-vm.cjs` : 0 requête Vinted).
- `EXT_CAPACITES.rechercheachat = '5.376.0'` (fonction `vinted-infos.js:signauxAchat`) : la feuille dit « Il faut l'extension 5.376 » tant qu'elle n'est pas là.

## 125 · Carnet des vendeurs chez qui tu achètes
- `src/carnetVendeurs.js` (pur). Vendeur = `transaction.seller_id` du détail de la transaction côté acheteur, sinon l'interlocuteur de la conversation de CETTE transaction quand Vinted y dit `current_user_side = buyer`. Les deux se contredisent ⇒ personne. Deux vendeurs au même pseudo restent deux (affichés « pseudo · #id »).
- Lu À L'OUVERTURE (Achats → « Carnet des vendeurs ») : le détail des transactions de SES achats par identifiant exact (`id=in.(harvest_{uid}_txn_{tx})`, par 100), projeté (`seller_id`, `user_side`, `seller.login`, `meta` statut et date), plus les résumés de conversations déjà lus ailleurs.
- Ce que leurs paires ont rapporté = le bénéfice par achat de « Tes meilleures sources » (relu) ; « au plus » si frais pas confirmés ; investi « au moins » si un prix manque ; délai = achat → commande finalisée (450) ; soucis = annulé (500–520, ou la règle de « Dépensé »), retour (440), suspendu (430), paiement échoué (220).
- Couverture dite en tête : « Vendeur connu pour N achats sur M ». Rappel : « acheteurs fidèles » reste REFUSÉ — ici ce sont ceux chez qui IL achète.

## 131 · Annonce déjà achetée
- `src/achatMemeAnnonce.js` (pur, recopié dans l'extension). Achats PUBLIE `vrm_annonces_achetees` (`{ v, at, total, connus, ids: { [itemId]: [{ tx, c, d }] } }`, ni prix ni titre ni pseudo), seulement quand elle change, rien tant qu'un compte d'achats a raté ou que les transactions ne sont pas lues. Achats annulés et masqués exclus.
- Dans Achats : « Même annonce achetée deux fois » (point ambre, seulement s'il y en a), feuille par groupe. Dans l'encart sur Vinted : « Annonce déjà achetée le … » (en-tête, sans rien ouvrir). Rien n'est bloqué ni masqué.

## Preuves
- `node scripts/audit-messages-achats-plus.cjs` — EXÉCUTE les règles : 40 messages (8 par langue, dont un « merci » sans question par langue), le catalogue contre une fausse base à état (projection sans prix d'achat ni pseudo, expiré/révoqué/inconnu ⇒ 404, autre vendeur ⇒ rien, panne ⇒ 503), le vrai `background.js` (encart : liste + achats rendus, 0 requête Vinted), 50 achats identiques sans identifiant ⇒ aucun signal. **20 rouges sur origin/main** (copié dans l'arbre d'avant, §6.1), **vert après**.
- `bash scripts/mutations-messages-achats-plus.sh "$PWD" <tmp>` — 14 mutations (mots allemands retirés, taille devinée, dispo sous annonce partie, infos par titre, projection qui garde tout, expiration/révocation ignorées, article d'un autre accepté, achat par titre, vendeur par pseudo, couverture tue, prix pas su = oui, une requête Vinted de plus, la rangée qui envoie) : **14/14 rouges**.
- `scripts/bancs/messages-achats-plus.cjs` — l'app RENDUE, 390 tactile clair + sombre et 1512, données inventées, pont d'extension simulé qui NOTE chaque commande : 71 contrôles verts (rangée d'aide, insertion, aucune réponse envoyée sans clic + témoin : son clic part bien, puces 44 px, rien ne déborde, aucune puce bleu plein ; même annonce 9301+9401 et pas le titre identique ; carnet 4/5, 501/502/503 ; liste de recherche ; catalogue : un seul bouton plein, le navigateur n'envoie que des identifiants). Sur le build d'origin/main (`BANC_DIST=<build d'avant>`) : **24 rouges** (rangée d'aide, insertion, témoin, « même annonce », catalogue absents).
- Gardés verts : build, audits traduction, tdz, coherence, variables, identite, csp, fonctions-api, extension-zip, quoi-de-neuf, icones, infos-vinted, note-achat-double, meilleures-sources, `regles-achat-extension.cjs`.

## Pièges rencontrés
- `vrm-achats-plus` / `data-achats-plus` existaient déjà (le bouton « … » d'Achats, 44 × 44 px) : le groupe s'appelle `vrm-pour-acheter` / `data-pour-acheter`, et le banc mesure sa largeur (≥ 300 px) pour qu'un style d'un autre élément ne le rétrécisse plus en silence.
- Les règles fortes de l'app (`:root:root:root body …`) reprenaient la hauteur des puces (32 px) et le fond des rangées : les styles du lot ont la même force (`src/styles-aide-reponse.css`).
- Le dossier de travail partagé : un arbre « avant » nommé `avant` a été effacé par une autre session pendant le banc ; utiliser un nom propre au lot.

## Geste de Julien
Installer l'extension **5.376.0** (remplacer le dossier, ⟳ dans chaque Chrome ; Orion : `VRM-Orion-dossier.zip`). Rien d'autre : pas de migration, pas de variable. Le carnet et « déjà achetée » se remplissent à mesure que les transactions d'achat sont relues.
