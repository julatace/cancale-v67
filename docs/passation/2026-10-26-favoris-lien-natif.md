# Favoris 5.228 — le lien natif de la cloche relié au favori enregistré

## Ce que disait le parcours manuel du vendeur (VRM Capture 1.0.0, 25 oct.)

- La cloche et la notification cliquée sont des liens `<a>`. La notification est
  affichée en `flex` et porte `href` et `data-testid`.
- Le lien cliqué porte **`receiver_id` et `item_id`**, et aucun autre paramètre.
- Il n'est ni `/items/…`, ni `/inbox/{nombre}`, ni `/member/…`. Le collecteur le
  classe « autre ».
- Aucune requête `api/v2/conversations` n'a été vue après les deux clics. La page
  atteinte est vraisemblablement celle d'écriture du message : la conversation
  n'est créée qu'à l'envoi. Ce point n'est **pas prouvé**.

## Ce qui a été mesuré dans sa base (lecture seule, formes seulement)

- Les 21 notifications de favori ont toutes la forme
  `/items/{article}/want_it/new?offering_id={nombre}`.
- `offering_id` n'apparaît nulle part ailleurs : 0 interlocuteur capté, 0 autre
  champ de la notification.
- Les archives `harvest_*_favoris_archive` ne contiennent **aucune** preuve native
  (0 création, 0 lecture liée). Les clics manuels n'ont rien laissé : le lien
  receiver_id n'était pas reconnu comme un contexte de favori.

## La cause du refus `favori_non_trouve`

Le détecteur ne cherchait que l'URL **identique** à celle de la notification. La
cloche de Vinted en affiche une autre. Aucun lien exact n'est donc présent, et la
préparation reste bloquée (`favoris_preuve_absente`).

## Le correctif (identités, rien de deviné)

**Page** (`suivreFavoriAffiche`, même texte dans `background.js` et `inject.js`).
Le lien exact garde la priorité : s'il est présent, même masqué, il reste la seule
voie. Sans lien exact, un lien natif n'est suivi que si toutes ces conditions
tiennent :

- même origine ;
- exactement les clés `item_id` et `receiver_id`, chacune une seule fois et
  numérique ;
- `item_id` = l'article du lien enregistré ;
- `receiver_id` = l'**unique** paramètre numérique du lien enregistré (égalité de
  valeurs, aucun nom traduit). Un lien enregistré à deux paramètres n'a aucune
  équivalence ;
- chemin de messagerie (`/inbox|conversation(s)|message(s)/…`) ou
  `/items/{article}/…` ;
- **un seul** candidat visible.

Trois compteurs s'ajoutent à l'inspection : `natifsMemeArticle`, `natifs` et
`natifsVisibles`. Si le refus continue, ils diront si Vinted affiche cet article
pour un autre destinataire.

**Fond** (`ouvrirFavoriNatif`).

- La ligne sondée est revérifiée par `natifConcorde`. Si elle désigne un autre
  destinataire, le code est `favori_destinataire_different` et rien n'est cliqué.
- La ligne cliquée doit être celle qui a été sondée.
- `confirmerNavigationNative` observe ensuite l'adresse de l'onglet pendant 6 s
  (`tabs.onUpdated` et `tabs.get`). Elle doit montrer exactement ce chemin, avec
  `item_id` et `receiver_id` égaux.
- Le compte VRM et le compte Vinted sont revérifiés. La preuve
  `{method:'NAV', path, itemId, recipientId, contexteFavori}` est alors rangée dans
  `lecturesLiees`, et `archiveNotifications` la revalide.
- Une route d'un autre destinataire donne `destinataire_different`.
- Une route jamais vue donne `navigation_non_confirmee`, sans rejeu du clic.
- Une conversation native, lue ou créée, vers un autre destinataire met le
  contexte en erreur.

**Serveur** (`resoudreCiblesFavoris`).

- Une preuve `NAV` ne vaut que si son destinataire est égal à l'unique paramètre
  numérique du lien enregistré, avec le même article et un chemin compatible.
- Elle confirme **ce** favori seul.
- La règle existante de généralisation s'applique : il faut **deux destinataires
  distincts** prouvés avant d'adresser un favori jamais ouvert.
- Deux preuves contradictoires bloquent le favori.

La file, le quota de 10 messages par heure **par compte**, « conversation déjà
commencée ⇒ ignorée » et l'absence de rejeu ne changent pas. Aucune requête Vinted
n'est ajoutée.

## Preuves

- `scripts/tests/favoris-lien-natif.cjs` : 34 contrôles.
  - Partie page : 18 cas DOM, dont mauvais destinataire, mauvais article,
    paramètres dupliqués ou contradictoires, paramètre en trop, origine externe,
    destination sans rapport, deux candidats, lien masqué, priorité du lien exact.
  - Partie fond : 9 cas, avec le vrai `background.js`.
  - Partie serveur : 6 cas.
  - Sur `origin/main` : **14 rouges**.
  - Mutations : sans le test du destinataire sur la page, 2 rouges ; sans
    l'égalité côté serveur, 1 rouge.
- Tous les tests `favoris-*` sont verts. `favoris-relais-page` attendait les
  quatre anciens compteurs ; `favoris-extension` attendait « 5.223.0 » en dur et
  lit maintenant le manifeste. Ce second test était déjà rouge sur `main`.

## Ce qui n'est pas confirmé

- Le chemin exact du lien natif : `/inbox/want_it` est une hypothèse du banc. Le
  code accepte toute la famille de chemins de messagerie, pas un chemin inventé.
- Que `offering_id` soit bien le destinataire. Si ce n'est pas le cas, aucune
  ligne ne correspondra : le refus reste `favori_non_trouve`, avec
  `natifsMemeArticle > 0` et `natifs = 0`. C'est un échec sûr, jamais un faux
  destinataire.
- Qu'un clic programmatique soit accepté par la vraie cloche. Il l'est pour les
  liens exacts depuis la 5.221 ; ce n'est pas vérifié sur ce compte.
- Le parcours réel sur le compte du vendeur. Aucun message n'a été envoyé.

## Geste du vendeur

1. Installer la 5.228 (remplacer le dossier, puis ⟳ dans Chrome).
2. VRM → Favoris → « Vérifier sur Vinted » sur **deux favoris de personnes
   différentes**.
3. Attendre « Lien enregistré » sur chacun.
4. Relancer la sélection.

Si le refus continue, copier le contrôle : les compteurs `natifs*` diront pourquoi.
