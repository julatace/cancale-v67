# 10 nov. — Colis propre, vrais logos, « Point relais changé », SMS avec les e-mails (branche `claude/colis-propre-logos`)

Julien, mot pour mot, sur captures iPhone du 10 nov. :
1. « Je veux que ce soit le logo Mondial Relay et Chronopost, lorsque c'est des colis Chronopost / Mondial
   Relay, et pareil tu n'as pas mis à jour ça dans toute l'application car il y a des endroits où c'est
   marqué transporteur inconnu. »
2. « Enlève imprime bordereaux … Et imprimer garde tout imprimer. »
3. « 1 colis de tomj606 : ses e-mails n'arrivent pas (bordereau, date limite, codes de retrait) — Enlève ça,
   car c'est déjà marqué au-dessus ou alors faire un truc plus beau. »
4. E-mail Mondial Relay « Votre colis a changé de plan » montré livré / à retirer : « Regarde le colis a pas
   été livré c'est pas bon. » + (validé par Julien, proposition 2) une alerte AMBRE « Point relais changé »,
   le nouveau point lu, et « Itinéraire ».
5. « Pour les SMS Mondial Relay, fais quelque chose de plus clair et mets ça avec les e-mails. »

Aucune base réelle lue d'ici. Extension : rien changé. 12/12 fonctions `api/` (aucune ajoutée).

## 1. Les vrais logos

`src/transporteursVisuels.js` `DESSINS_TRANSPORTEURS` (un dessin SVG 32×32 par clé, valeurs figées, aucune
image, aucune requête) ; `LogoTransporteur` (src/PastilleTransporteur.jsx) et `svgMarque` (épingle de la
carte) le rendent. Tout ce qui passait par la marque maison (puce, badge de vignette, tête de point relais,
épingle, pastilles d'Envoyés, Achats, Ma journée, `CarrierBadge`) montre donc le logo, sans autre changement.

| transporteur | source du dessin |
|---|---|
| Mondial Relay | TRACÉ d'après le logo raster publié dans le paquet npm `@ovh-ux/ng-ovh-mondial-relay` (300×185) : « r » blanc, rond et carré grèges `#CFC8BF` sur framboise `#C90547` (couleurs relevées au pixel) |
| UPS, DPD, DHL, FedEx, Vinted Go (le V) | tracés de `simple-icons` 16.37 (licence CC0), couleurs de marque publiées par ce paquet ; ® retiré |
| Chronopost, Colissimo, InPost, Relais Colis, Shop2Shop, GLS, Colis Privé | aucun tracé libre trouvé (réseau du conteneur fermé hors npm) : mot-symbole écrit aux couleurs du logo public — **à comparer à un vrai colis** ; un tracé exact se pose à la même clé sans rien changer d'autre |

Usage nominatif (désigner le transporteur d'un colis), accepté par Julien. Inconnu ⇒ pictogramme neutre
(carton gris), « Transporteur inconnu » seulement en `aria-label`.

**Le mot « inconnu » n'est plus écrit en gros** : en-têtes de groupe de « Tout imprimer » et de la tournée
⇒ logo + « Transporteur à identifier » (`libelleTransp`, src/colisEnvoyes.js) ; phrase d'Envoyés ⇒ « N colis
sans transporteur lu : … » (raisons inchangées). La clé interne `INCONNU` reste (règles, pastilles, bancs).
La règle d'identité ne change pas (`transporteurDuColis` / `transporteurDeVente` : ligne du transporteur,
étiquette PDF, plateforme, e-mail du même n°, forme du n°) — jamais le titre.

## 2-3. Colis sans doublons (§7)

- La ligne « prochain geste » de Colis (« N bordereaux à imprimer — Imprimer », « 1 à envoyer en priorité »,
  le point à retirer) n'est plus rendue : le bouton « Tout imprimer », la limite sur la carte et la liste
  À retirer le disent déjà. `src/prochainGesteColis.js` reste (Ma journée, conseils).
- « N comptes n'envoient aucun e-mail à VRM » : plus écrit sur Colis (`ComptesMuetsColis` ne rend que le
  chiffre du conseil) — la ligne de fraîcheur unique le dit.
- « N colis de X : ses e-mails n'arrivent pas » (`ComptesARelierColis`) : retiré ; à la place une petite
  marque grise « ✉ sans e-mail » sur la carte du colis concerné (`data-colis-sans-email`), qui ouvre le
  pas-à-pas « Relier la boîte » de ce compte.

## 4. « Votre colis a changé de plan »

- `api/_lib/etat-colis-email.js` `changementDeRelais` : SUJET d'abord (« changé de plan », « changement de
  point », « nouveau point relais », « redirigé ») ⇒ `transit` — sauf si le sujet constate lui-même une
  arrivée/un retrait ; dans le corps, seulement une phrase qui le CONSTATE (« a été redirigé », « le Point
  Relais … est temporairement indisponible », « dans le Point Relais suivant »), jamais une condition
  (« en cas de point indisponible », « si votre Point Relais est fermé »).
- `api/email-inbound.js` `parseCarrierEmail` : `label: 'Point relais changé'`, `relaisChange: true`, `lieu` =
  le NOUVEAU point lu sous la ligne « nouveau / suivant » (`nouveauPointDansTexte`, api/_lib/retrait-colis.js,
  code postal exigé) — sinon aucun lieu, jamais l'ancien. La ligne rangée porte `relaisChange` et `ancienLieu`
  (le lieu de la ligne d'avant) ; l'ancien lieu n'est plus recopié sur un colis redirigé.
- `api/_lib/suivi-colis.js` `relireLigneSuivi` : une ligne DÉJÀ rangée « arrivé » ou « livré » par cet
  e-mail (son sujet est celui qui a posé l'état) est relue EN ROUTE — l'app, le widget, le rappel du matin
  la relisent : la ligne de Julien se corrige sans rien réécrire en base.
- L'app : `src/relaisChange.js` (`colisRelaisChange` : en route, < 21 j, pas sortant, aucun autre e-mail du
  même n° qui le dit arrivé/retiré/reparti) et `src/AlerteRelaisChange.jsx` : carte ambre « Point relais
  changé · Colis N · pas encore arrivé », nom + adresse lus, bouton « Itinéraire » (Plans sur Apple, Google
  Maps ailleurs, 44 px). Rendue sur Colis → À retirer et Achats → À retirer / En route.
- **L'épingle de la carte des relais** : la carte compte les colis À RETIRER (règle du 9 nov.) ; un colis
  redirigé roule encore, il n'y a donc pas d'épingle tant qu'il n'est pas arrivé — et à l'arrivée, l'e-mail
  « disponible » porte le nouveau point : l'épingle est là, plus jamais à l'ancien point (le lieu rangé est le
  nouveau). Pas d'épingle « en route » ajoutée (elle mentirait sur « à retirer »).

## 5. SMS de colis, avec les e-mails

Réglages : l'élément `sms-colis` passe de « Notifications » à « Mes e-mails » (sous « Relier ma boîte »),
nommé « SMS de colis ». `src/SmsColis.jsx` : UNE phrase, « Copier l'adresse » en premier (après « Créer mon
adresse SMS »), l'adresse, les gestes du jeton en liens discrets, les 6 étapes en liste courte numérotée
(`court`, src/smsColis.js) ; dessins, mots exacts de chaque écran et expéditeurs lus repliés dans « Voir
chaque écran en détail ». Rien retiré (mêmes `data-sms-*`). Fichiers des e-mails de transfert
(branche `claude/emails-transfert`) non touchés.

## Preuves (§6)

| contrôle | branche | origin/main | mutations |
|---|---|---|---|
| `audit-relais-change` (EXÉCUTE `etatColisDepuisTexte`, `parseCarrierEmail`, `relireLigneSuivi`, `colisRelaisChange`, faux e-mail inventé) | 29 verts | 12 rouges | 8/8 rouges (sujet ignoré, corps ignoré, condition oubliée, ancien point gardé, pas de drapeau, relecture oubliée, arrivée ignorée, alerte pas rendue) |
| banc `colis-propre-logos` (390 tactile clair/sombre, 1512 clair/sombre : colis redirigé hors « à retirer », alerte + nouveau point + Itinéraire 44 px, vrai logo MR, logo Chronopost, aucune ligne prochain geste / bandeau e-mails, aucun « inconnu », pas de débordement, pas d'erreur) | 40 verts | 24 rouges | — |
| `audit-colis-prochain` (mis à la décision du 10 nov.) | 30 verts | — | — |
| bancs `transporteurs-logos` (texte jugé hors du logo : Chronopost est un mot-symbole), `colis-sms` (6 étapes : Vestiaire comprise — rouge identique sur main avant), `onglets-c` C4 (marque discrète au lieu du bandeau) | verts | — | — |

- Verts aussi : `npm run build`, `audit-{variables,tdz,coherence,identite,icones,transporteurs,codes-retrait,sms-colis,statuts,fonctions-api,retrait-fiable,retraits-suivi}`, banc `colis-envoyes-tri` (92).
- Rouges IDENTIQUES sur origin/main, pas touchés : `audit-colis-envoi` (1, « la barre ne dépend pas de
  l'onglet »), `audit-a-envoyer-preuves` (2, e-mail de dépôt Mondial Relay).
- Captures regardées : À retirer 390 clair (alerte ambre sous les points, logos MR/Chronopost sur les
  vignettes et en tête de point), 1512 sombre, SMS de colis 390 sombre ; aperçu des 13 logos à 22/44/110 px
  clair et sombre.

## Ce qui reste
- Chronopost, Colissimo, InPost, Relais Colis, Shop2Shop, GLS, Colis Privé : mots-symboles, pas des tracés
  exacts (Julien : dire si l'un ne se reconnaît pas ; un tracé se pose à la même clé).
- La forme EXACTE de l'e-mail « Votre colis a changé de plan » n'a pas été lue (pas d'accès à sa base) :
  la règle juge le sujet ; si le nouveau point est écrit autrement que sous « nouveau / suivant », il n'est
  pas lu (dit « regarde l'e-mail du transporteur »), jamais deviné. Requête de contrôle (lecture seule) :
  `select id, meta->>status, meta->>statusLabel, meta->>lieu from app_data where id like 'email_track_%' and meta->>subject ilike '%chang%plan%';`
- Le statut chez le transporteur (`transp_*`) n'a pas de notion de « redirigé » : si le serveur Mondial
  Relay dit « disponible » au nouveau point, c'est vrai (le colis y est arrivé).
