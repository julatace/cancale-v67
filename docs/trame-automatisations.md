# Trame des automatisations Vinted — pour construire l'équivalent de Vintex

Version du 1er octobre 2026. Cette trame donne les ordres pas-à-pas, aussi précis
que possible, pour construire les 4 automatisations que fait Vintex. Elle
s'appuie sur `docs/guide-extension-vinted.md` (session, garde, appels, lectures,
écritures — tout y est en code) : lis-le d'abord, il contient les briques.

Rappels valables pour les 4 :
- Tout part **du navigateur**, avec la session du compte ouvert dans l'onglet.
- Toute écriture passe par `ecrire(...)` du guide (garde : 20/h, 3/visite, une à
  la fois, arrêt sur 401/403).
- Rien ne part sur un compte autre que celui de l'onglet (`compteActif()`).
- Les compteurs, mémos et files vivent dans `chrome.storage.local` (un service
  worker MV3 meurt à 30 s).
- ❓ = à mesurer avant de coder (méthode : DevTools → Network → Payload/Response).
- **Aucune pause « faussement humaine », aucune retouche d'image pour tromper la
  détection.** C'est ce qui a fait bloquer `vanessa5723`.

---

## 1. Sauvegardes cloud — « une copie de l'annonce, restaurable sur n'importe quel compte »

**But.** Garder une copie complète de chaque annonce (texte + codes + photos)
pour pouvoir la republier telle quelle, y compris sur un AUTRE de tes comptes.

**Ce qui existe déjà.** L'extension VRM ≥ 5.120 capte la fiche d'une annonce
(`vinted_item_details[id]` : titre, description, `codes`, `photoIds`) en lisant
la page. C'est 90 % de la sauvegarde.

**Ce qu'il reste à faire.**
1. **Copier les octets des photos** (pas seulement leurs URL, qui expirent).
   Pour chaque photo de la fiche : `fetch(url)` depuis le service worker
   (`host_permissions: *.vinted.net`), stocker le blob. ⚠️ Ne PAS mettre les
   octets dans Supabase (le quota d'égress a déjà explosé) : les garder dans
   **IndexedDB** de l'extension, ou les proposer au téléchargement dans un dossier
   `VRM-sauvegardes/VRM-{n°}/`.
2. **Une ligne par annonce sauvegardée** : `panel_coffre` (déjà amorcé côté
   background : `coffreRecord`). Clé = id d'annonce. Contenu : la fiche + un
   drapeau « photos copiées oui/non ».
3. **Restaurer sur un autre compte** = republier (voir §4) sur le compte
   actuellement ouvert, quel que soit le compte d'origine. La création
   (`POST /api/v2/item_upload/items`) part du compte de l'onglet : c'est
   automatiquement « sur ce compte-ci ».

**UI (app).** Écran « Coffre » : liste des annonces sauvegardées, bouton
« Sauvegarder tout le dressing », bouton « Restaurer » par annonce (ouvre la
republication sur le compte ouvert). Dire clairement le compte cible.

**Garde-fous.** Copier les photos = un `fetch` par photo : borne à ~30 photos
par visite pour ne pas marteler le CDN. C'est une **lecture**, pas une action
Vinted : elle ne passe pas par la garde des 20/h (celle-ci ne protège que les
écritures vers Vinted).

---

## 2. Négociations automatiques — « répondre aux offres selon des paliers, avec un plancher »

**But.** Quand une offre arrive, répondre tout seul selon des règles : accepter
au-dessus d'un seuil, contre-offrer par paliers, refuser sous un plancher.

**Ce qui existe déjà.** VRM a `autoAccepterOffres` (accepte au-dessus du prix
plancher). Il faut y ajouter les **paliers de contre-offre**.

**Les données (mesurées).**
- Les offres reçues arrivent dans les conversations : `harvest_{uid}_conv_{id}` →
  `conversation.messages` avec `entity_type: "offer"` (❓ vérifier le nom exact du
  champ offre dans une vraie conversation avec offre — ouvre-en une, DevTools).
  Le montant de l'offre et l'`offer_request_id` y sont.
- Répondre : `PUT …/transactions/{tx}/offer_requests/{id}/accept` ou `/reject` ;
  contre-offre : `POST …/transactions/{tx}/offers` `{"offer":{"price":"90","currency":"EUR"}}`.

**La règle, par annonce (dans `vinted_annonce_numeros[id]`, la même ligne que le
N°) :**
```
autoNego: {
  actif: true,
  plancher: 45,        // sous ce prix → refuser
  accepterDes: 60,     // à ce prix ou plus → accepter
  paliers: [ {si: '<50', contre: 55}, {si: '<60', contre: 58} ],  // sinon contre-offre
  maxTours: 2,         // au-delà, on laisse Julien trancher
}
```

**Le moteur (background), à chaque visite, pour le compte de l'onglet :**
1. Lire les conversations captées, repérer celles qui portent une offre EN
   ATTENTE (`offer_request` sans réponse).
2. Identité de l'offre = `offer_request_id` (jamais le texte, jamais la date).
   Mémo `chrome.storage.local` : ne jamais répondre deux fois à la même offre.
3. Charger la règle de l'annonce (`item_id` de la transaction). Pas de règle, ou
   pas de plancher → **on ne touche pas** (`if (!(isFinite(plancher) && plancher>0)) continue`).
4. Appliquer : offre ≥ `accepterDes` → accept. Offre < `plancher` → reject.
   Sinon, premier palier qui correspond → contre-offre. Compter le tour.
5. Chaque réponse passe par `ecrire(...)`. Borne : 3 par visite.

**⚠️ Accepter une offre = une vente ferme, non annulable.** C'est pour ça que le
plancher est **obligatoire** par annonce, et que rien ne part sans lui.

**UI (app).** Sur chaque annonce : un petit panneau « Négociation auto » avec
plancher / accepter dès / paliers, éteint par défaut. Un onglet « Offres » qui
liste ce qui a été répondu automatiquement (montant, à qui, quand — relisible).

**Bench.** `audit-nego.cjs` : exécute le vrai `background.js`, sert des
conversations avec offres à divers montants, vérifie accept/reject/contre selon
la règle, jamais deux fois la même offre, rien sans plancher, borne 3/visite.

---

## 3. Messages aux favoris — « écrire aux acheteurs qui mettent en favori, avec règles jour/créneau/remise »

**But.** Quand quelqu'un met un article en favori, lui écrire (et/ou proposer une
remise), selon des règles horaires.

**Ce qui existe déjà.** VRM ≥ 5.117 capte les **notifications** Vinted
(`harvest_{uid}_notifications`) — c'est là que Vinted dit QUI a mis en favori
(« X a marqué ton article Y comme favori »). ⚠️ Il faut d'abord **ouvrir la
cloche sur vinted.fr** une fois pour que la forme soit captée, puis vérifier :
pseudo/id de la personne, id de l'article, date.

**Les données à relever (❓) dans `harvest_{uid}_notifications` :**
- le champ qui porte l'`user_id` de la personne (pas juste le pseudo) ;
- le champ qui porte l'`item_id` de l'article ;
- la date, pour la règle « pas deux fois ».

**Les règles (comme Vintex), rangées dans `panel_fav_regles` :**
```
regles: [
  { texte: "Bonjour, merci pour le favori 😊 je peux faire un petit prix.",
    offre: null,                 // ou un % de remise
    jours: [1,2,3,4,5],          // lundi=1 … dimanche=7
    creneau: { de: "18:00", a: "22:00" },
    siAuMoins: 2,                // seulement si la personne a ≥ 2 favoris chez toi
  },
  ...
]
delaiAvantEnvoi: 15,             // minutes après le favori
delaiAvantReecrire: 1440,       // minutes avant de réécrire à la même personne
```
Quand plusieurs règles correspondent, **en tirer une au hasard** parmi celles
qui collent (Vintex le fait pour varier ; ce n'est PAS un délai faussement
humain, c'est le choix du message).

**Le moteur (background), par visite, compte de l'onglet :**
1. Lire les notifications de favori récentes.
2. Pour chacune : identité = `user_id + item_id`. Mémo storage : jamais deux
   fois la même paire (délai `delaiAvantReecrire`).
3. Filtrer par jour, créneau, ancienneté (`delaiAvantEnvoi`), et `siAuMoins`
   (compter les favoris de cette personne dans les notifications captées).
4. Choisir une règle, ouvrir la conversation
   (`POST /api/v2/conversations {initiator:"seller_enters_notification", item_id, opposite_user_id}`),
   envoyer le message (`…/replies`), et l'offre si prévue
   (`…/transactions/{tx}/offers` après avoir lu la transaction de la conversation).
5. `ecrire(...)`, borne 3/visite.

**UI (app).** Onglet « Favoris » (celui que Julien a déjà demandé) : la liste des
personnes ayant mis en favori (nommées), l'éditeur de règles, un bilan « N
messages envoyés / à qui / quand ». Éteint par défaut.

**⚠️ Le plus gros risque de blocage.** 60 messages/jour envoyés par un programme,
c'est le signal robot exact de `vanessa5723`. Garder un **plafond quotidien** bas
et réglable, en plus des 20/h.

**Bench.** `audit-favoris.cjs` : sert des notifications de favori, vérifie le
filtrage (jour/créneau/siAuMoins), l'anti-doublon `user_id+item_id`, l'ouverture
de conversation + message, borne, rien sans règle active.

---

## 4. Articles — « republier en lot (retouche comprise), modifier, dupliquer, publier brouillons, masquer, supprimer »

**But.** Tout le dressing sur une page, avec des actions en lot.

**Les données (mesurées).**
- Republier proprement : §8 du guide (créer d'abord, vérifier en ligne, supprimer
  ensuite, reporter le N°). Endpoints : `POST /api/v2/photos` (❓ champs du
  FormData), `POST /api/v2/item_upload/items`, `POST /api/v2/items/{id}/delete`.
- Modifier : `PUT /api/v2/item_upload/items/{id}` (même corps, avec `id`).
- Publier un brouillon : `POST /api/v2/item_upload/drafts/{id}/completion` (vu
  dans tes requêtes).
- Masquer / afficher : ❓ endpoint à relever (masque une annonce sur Vinted).
- Dupliquer : créer une nouvelle annonce à partir de la fiche, SANS supprimer
  l'ancienne.

**En lot = une file, une action à la fois.** Pour N annonces cochées : traiter
la première entièrement (avec ses photos), attendre, passer à la suivante.
Chaque annonce compte pour la garde (une republication à 12 photos = 14
écritures → ~1 annonce/heure au plafond de 20/h ; le dire à l'écran).

**⚠️ Retouche photo : NON telle que Vintex la fait.** Vintex tourne/recadre/
tamponne les photos pour que Vinted ne reconnaisse pas la republication — c'est
de l'évasion de détection, refusée (§3 du dossier). La retouche utile (recadrer,
redresser) existe déjà dans VRM (`PhotoEditor`) comme geste MANUEL ; on ne
l'applique jamais automatiquement pour tromper Vinted.

**UI (app).** Écran « Articles / Dressing » : cases à cocher, menu « Choisir une
action » (Republier · Modifier · Dupliquer · Publier les brouillons · Masquer ·
Afficher · Supprimer). ⚠️ Quand une action est choisie, ne garder actives que les
annonces du **compte de l'onglet ouvert** (les autres floutées, « ouvre ce compte
avec l'extension ») — voir la demande générale ci-dessous.

**Bench.** `audit-articles-lot.cjs` : file d'une action à la fois, compte de
l'onglet uniquement, ordre create→verify→delete pour la republication, N reporté.

---

## Règle transversale — « n'agir que sur le compte ouvert dans l'onglet »

Julien : quand je choisis une action (republier / favoris / messages) sur VRM,
ne me proposer que les éléments du compte où l'extension est allumée, et flouter
les autres.

- Le compte ouvert = `compteActif()` (le cookie de session de l'onglet). L'app le
  connaît via le pont (`vmrAuthEtat` / la ligne de diagnostic de l'extension).
- Quand une action « qui écrit sur Vinted » est sélectionnée : filtrer la liste
  sur `_acc.vinted_user_id === compteActif`, flouter le reste avec le message
  « Ouvre ce compte dans Chrome pour agir dessus ».
- Uniquement pendant qu'une action est sélectionnée (sinon on voit tout).

---

## Ce que je ne construirai jamais dans ces automatisations
- Boost favoris (échange de favoris entre membres) : gonflage artificiel, contre
  les CGU Vinted.
- Pauses aléatoires « pour paraître humain ».
- Retouche d'image automatique pour esquiver la détection de doublon.
- Republication qui supprime avant de recréer (perte d'annonce possible).

Chacune de ces automatisations se livre **éteinte par défaut**, avec ses plafonds,
et chaque envoi doit être **relisible** après coup (qui, quoi, quand).
