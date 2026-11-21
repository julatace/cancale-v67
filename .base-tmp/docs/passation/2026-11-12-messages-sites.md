# 12 nov. 2026 — Messages Leboncoin, Vestiaire, eBay : la même refonte que Vinted

Branche `claude/agent2-messages-sites` (second agent), partie de `origin/claude/agent2-messages`
(refonte de Messages · Vinted du 11 nov., récit `2026-11-11-messages.md`) puis `origin/main` fusionné.
**Elle CONTIENT `agent2-messages` : n'intégrer qu'elle.** Pas d'extension.
Demande de Julien (12 nov.) : « fais les messages Vestiaire, etc. ».

## Ce qui était déjà fait par `agent2-messages` (vérifié vue par vue)
- Ordre du plus récent au plus ancien par horodatage (`src/ordreConversations.js`) : Leboncoin
  (fils), Vestiaire (plus les non-lus devant), eBay Tout et Questions — banc : ordre vert sur les trois.
- Heure « 19:52 / hier / 14 oct. », bulles arrondies (les siennes à droite), fiche compacte à côté du fil
  et pas de volet sans conversation, fil plein écran au téléphone : ces pièces sont PARTAGÉES
  (`LigneConv`, `BulleConv`, `CadreFil`, `FicheConvVolet`, `styles-messages-naturel.css`).
- Réponses rapides : la rangée partagée `RapidesConv`, une seule entrée sur chaque site (le crayon
  de réglage reste sur Vinted : la feuille vit dans Messages · Vinted).

## Ce qui change ici
- **Envoi visible dans le fil** (les trois sites) : bulle pâle « Envoi… » pendant, « Envoyé ✓ » quand
  le site l'a accepté, « Pas envoyé · Réessayer » sur un refus SÛR (SON clic renvoie, le texte reste),
  « Pas confirmé · vérifie sur … » sinon (aucun « Réessayer » : un doublon chez l'acheteur est pire).
  Règle pure `src/envoiFil.js` (`etatEnvoiExtension`, `etatEnvoiEbay`) ; une réponse absente ou de forme
  inconnue = « pas confirmé », jamais « envoyé » (§5). Composant `src/composants/EnvoiDansFil.jsx`
  (reçoit `BulleConv`, n'importe rien d'App.jsx). « Envoyé sur Leboncoin/Vestiaire » n'est plus redit
  au-dessus du champ ; les refus y restent (ils disent le geste). eBay : « Réponse acceptée par eBay »
  remplacé par « Envoyé ✓ » sous sa réponse ; la phrase d'erreur n'est plus dite deux fois (haut + pied).
  **Règles d'envoi INCHANGÉES** : `lbcRepondre` (recette `lbc_envoi` apprise), `vcRepondre` (recette
  `vc_envoi`), route eBay `repondre` avec confirmation ; compte de l'onglet, 50 actions/h (extension).
- **Fil vide ≠ rien** : un fil sans message que la liste annonce ⇒ « Ce fil n'est pas encore lu en
  entier. Relire » (Leboncoin, Vestiaire ; eBay : un échange sans texte ⇒ relit l'échange).
- **Lecture ratée ≠ vide** : un fil que la base ne rend pas ⇒ la raison et « Réessayer » ; eBay : une
  liste que la route ne rend pas n'est plus muette (« Messages eBay pas lus pour l'instant · Réessayer »),
  jamais « Aucune question ».
- **Doublons fondus** : eBay — le même échange rendu deux fois (même n° de message) ⇒ une ligne, la copie la
  plus fraîche (avant : deux lignes, même clé React) ; Leboncoin — `sansDoublons` par n° de conversation.
  Vestiaire : la liste est déjà une clé par conversation. Le fil « Tous » (lot AB) n'est pas touché.
- **Offre Vestiaire dans SA conversation** : la carte de l'offre de l'article (même `productId`, jamais le
  titre) s'ouvre en tête du fil, avec ses gestes seulement quand c'est à lui (`OffresVestiaire` et
  `vcoffrerepondre` inchangés) ; au-dessus de la liste, elle n'est plus redite (les autres y restent).
  Leboncoin ne donne pas d'offres ; eBay garde ses offres dans eBay → Offres (route existante).

## Preuves
- `scripts/bancs/messages-sites-naturel.cjs` (1512 souris, 390 tactile, clair et sombre ; données inventées) :
  par site, ordre, fil vide annoncé, lecture ratée, une entrée de réponses rapides, bulles, mise en page,
  envoi tenu → « Envoi… » → « Envoyé ✓ », refus → « Pas envoyé · Réessayer » (un renvoi par clic),
  incertain → « Pas confirmé » ; Vestiaire : l'offre dans le fil une seule fois ; eBay : doublon, liste
  illisible. **Vert** ; **102 rouges** sur le build d'origin/main ; mutation (incertain ⇒ refus, doublon
  eBay gardé) ⇒ 12 rouges.
- `scripts/audit-envoi-fil.cjs` : vert ; `--prouve` 8/8 mutations rouges ; rouge sur origin/main (règle absente).
- `audit-ordre-messages` mis à jour (Leboncoin : `sansDoublons` avant le tri) : vert, `--prouve` 8/8.
- Bancs `lbc-repondre` et `vestiaire-messages` mis à la règle « Envoyé ✓ sous la bulle, une seule fois ».
- Bancs existants : voir la ligne de COORDINATION (aucun nouveau rouge par rapport à la branche de départ).
- Build ; audits variables, tdz, coherence, identite, icones, questions-ebay, fil-unique, ordre-recent,
  fonctions-api, ebay-messages-nonlus, textes-courts, vendeurs-differents verts (politique-hotes et
  lectures-lourdes : rouges d'avant, fichiers hors de ce lot).
- Planches : `docs/passation/planches-messages/sites-*-avant-apres.png`.

## Reste / notes
- Le crayon « Modifier mes réponses rapides » n'existe que sur Vinted (la feuille vit dans Messages ·
  Vinted) ; ailleurs la rangée suffit (une entrée). À faire si Julien le veut : un événement d'ouverture.
- Leboncoin redit « 2 messages non lus » en tête et sur la ligne du compte (d'avant, pas touché).
- `vestiaire-plus` (agent principal) retouche `OffresVestiaire.jsx` (tr()) : aucun conflit, ce lot ne
  touche pas ce fichier. App.jsx : non touché.
- Geste de Julien : aucun.
