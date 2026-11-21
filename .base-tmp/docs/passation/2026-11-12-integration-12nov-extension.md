# 12 nov. — intégration de l'extension 5.372 (second agent, intégrateur)

PR #1143, branche `claude/integration-12nov-extension` = `agent2-favoris-compte` (5.372, qui contient
`agent2-ext-boutique` 5.371, `agent2-discretion` 5.370, `agent2-ecriture-humaine`) + main (jusqu'à #1144).

## Ce que l'intégration a ajouté
- **Une seule prudence par compte Vinted** (demande du coordinateur) : la sécurité des comptes (5.366,
  `secuObserver`) ne pose plus sa propre `c.prudence` pour Vinted ; elle appelle `poserPrudence` (5.357 :
  24 h, 20 actions/h, délais doublés). Après une vérification anti-robot levée par une lecture normale :
  la même prudence (`poserPrudence(compte, 0, 'verification')`). Leboncoin/Vestiaire gardent la leur.
  `audit-securite-comptes` E7/E8 jugent « une seule ».
- **Variantes du refus** : chaque variante passe `erreurMessageAuto` avant d'être rangée
  (`changerRefusVariantes`) ; `audit-message-sur` S5.
- Capacités `ecriturehumaine`, `variantes`, `formevinted`, `prudence` à **5.372.0** (aucune version publiée
  ne les porte) ; `fetchAvecDelai` dans `api/_lib/rapport-extension.js` et `verification-vinted.js`.

## Tests portés (jamais affaiblis)
- `scripts/tests/favoris-historique-interface.cjs` : porté de la page « par annonce » sur **la liste par
  compte** (`data-fav-ligne`, case du compte de l'onglet, article vendu retiré et compté
  `data-fav-retires`) — 99 contrôles comme avant. Mutations : « un article vendu reste dans la liste » et
  « un favori déjà écrit reste cochable » ⇒ rouge.
- `scripts/tests/orion-base-validee.py` : `orion-main.js` du paquet = celui du dépôt + la source
  d'`inject.js` du paquet posée en ligne (5.361) ; `homepage_url` commune approuvée (vrm.center seulement).
- `scripts/tests/isolation-comptes.test.mjs` : le contexte fournit `signalDelai` (5.361).
- **Audits qui dépendaient de l'heure** (rouges la nuit seulement) : `audit-robustesse-extension` C (le
  repos de nuit de 5.366 bloquait le moteur d'offres : éteint dans le banc, C juge le verrou) ;
  `audit-moteur-offres` A2 (la nuit, 0 h-7 h Paris, le délai est 30-120 min depuis 5.370 : jugé selon
  l'heure, et les deux fourchettes jugées à heure fixe). Mesuré par horloge décalée de 14 h.

Geste de Julien : installer **5.372.0** (la seule à installer ; 5.368/5.369 inutiles).
