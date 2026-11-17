# Maquette M — « Une main » (17 nov. 2026)

**Une proposition, pas une livraison** : aucune PR. Branche `claude/maquette-m`. Page blanche autonome,
`docs/maquettes/m/` (rien de `src/` : `index.html`, `m.css`, `m.js`, `fixture.js` inventée par
`fabriquer-fixture.cjs`, polices Fraunces + Instrument Sans sous licence OFL dans `polices/`).
Voir : ouvrir `docs/maquettes/m/index.html` (`#ecran=ventes`, `?theme=dark`). Captures : `node docs/maquettes/m/capturer.cjs <dossier>`.

## Ce que c'est
- Le haut se LIT (champ vert bouteille : titre, menu « Tous les comptes », LE chiffre en serif 72) ; le bas se TOUCHE
  (segmenté 2–3 valeurs, recherche en bas comme Safari + le seul bouton plein, onglets icône + libellé).
- Signature : l'étiquette KRAFT du N° (la matière du carton où il est écrit) et les étiquettes de colis à retirer,
  une par colis, qu'on fait défiler (code en grand, QR seulement s'il a été ENVOYÉ — Mondial Relay : « code seul »).
- Ligne : glisser = geste (Imprimer / Republier), appui long = menu selon l'état de la paire, toucher = feuille à deux crans.
- Journée = groupes « à faire » avec compteur et geste ; Argent = une seule rangée de synthèse.

## Règles gardées
N° par l'id de l'annonce (fixture), « — » quand on ne sait pas, vendu = date de vente, reçu = date de versement,
date limite lue (sinon « vendue le … », jamais « en retard »), ambre = geste seulement, bénéfice « ≥ » (couverture partielle).

## Ce que ça casse
Toute la coque actuelle (fond bleu, verre, styles-vitrine, Inter) ; deux polices à embarquer ; les rangées de pastilles
deviennent un segmenté + un menu au titre ; Leboncoin/eBay/Vestiaire, Messages, Stock derrière le menu et la recherche ;
le « + » central disparaît ; vraies photos Vinted pas sur fond uni (détourage) ; textes à passer par tr().
