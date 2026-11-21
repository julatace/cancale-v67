# 10 nov. — Lot R : le livre de police (branche `claude/livre-police`)

Proposition 27, validée par Julien le 9 nov. (« Fais tout ») : le registre des objets mobiliers
achetés pour revente, tenu depuis les achats, dans Argent → Déclarer.

## Ce que dit le droit (et d'où)
Légifrance et service-public.gouv.fr n'étaient **pas joignables** depuis la session (réseau
fermé) : les mentions viennent des extraits officiels rendus par la recherche, recoupés, et
sont citées en tête de `src/livrePolice.js`. À relire sur la source avant d'ajouter une mention.
- Code pénal art. 321-7 (qui : le professionnel qui vend des objets mobiliers usagés ou acquis
  auprès d'autres que ceux qui les fabriquent ou en font le commerce) ; R321-1 à R321-12.
- R321-3 (version du 29 janv. 2012) : n° d'ordre ; nature, provenance, description ; identité
  du vendeur (nom, prénoms, qualité, domicile, pièce d'identité : nature, n°, date, autorité).
- Prix d'achat et mode de règlement : cités par les fiches pratiques (mairie, guides pros)
  au titre de R321-3 à R321-6 ; l'extrait Légifrance lu ne montrait pas ce passage — tenus.
- R321-5 : mesure de protection (patrimoine) le cas échéant — sans objet ici.
- R321-6 : registre informatisé ⇒ intégrité garantie. Un fichier exporté ne la garantit pas :
  l'export le dit.
- Déclaration préalable en préfecture : cerfa 11733*02. Fiche officielle : F39552.

## Ce qui est livré
- `src/livrePolice.js` (pur) : `livrePolicePropose` (micro · société · marge seulement, jamais
  particulier ni statut pas choisi) ; `inscrire` (n° d'ordre à la suite du DERNIER, dans
  l'ordre des dates, jamais changé ni redonné ; un achat arrivé plus tard prend le suivant) ;
  `etatLu` (deux achats sous un n° ⇒ illisible, rien n'est inscrit) ; `livreDePolice` (une
  ligne = une ligne de `registreDesAchats`, la même règle ; un achat inscrit puis annulé garde
  son n° et sa ligne « plus dans tes achats ») ; `pseudoVendeurTx` (transaction lue côté
  ACHETEUR seulement) ; export tableur/PDF (pdf-lib, dans le navigateur) avec les mentions à
  compléter comptées ; `inscrireEnBase` : ligne `vrm_livre_police`, comparer-et-échanger sur
  `data.rev`, lecture ratée ⇒ rien écrit.
- `src/LivrePoliceCarte.jsx` : bloc isolé, monté par UNE ligne dans `src/ecrans/Compta.jsx`
  (« Pour ton comptable », après le récap mensuel). Fermé par défaut (rien lu) ; ouvert :
  inscrits, « Inscrire N achats » (ambre, confirmé), période, PDF, Tableur, « À compléter ».
  Pseudos lus en projection (`user_side`, `seller->>login`), jamais `select=data`.
- L'identité civile n'est jamais stockée : « à compléter » sur chaque ligne. Jamais « conforme ».

## Preuves
- `scripts/audit-livre-police.cjs` : 31 verts ; `--prouve` 13/13 mutations attrapées
  (renumérotation, trou, côté vendeur, « conforme », identité, particulier, état abîmé, CAS,
  lecture KO, annulé disparu, projection, montage, garde de statut). Rouge sur ae0e418d.
- `scripts/bancs/livre-police.cjs` : 57 verts (1512/390, clair/sombre, particulier sans carte) ;
  rouge sur ae0e418d (aucune carte). Captures et PDF regardés.
- build, audits variables, tdz, coherence, identite, icones, registres, argent, urssaf verts.
  `audit-photos-vinted` rouge déjà sur main (ATrancher, BaissePrixSerie… : pas ce lot).

## Reste / gestes
- Julien : relire les mentions sur Légifrance (R321-3) ; compléter l'identité des vendeurs
  sur le papier ou dans le tableur ; se déclarer en préfecture s'il ne l'est pas.
- Pas de saisie de l'identité dans VRM (données personnelles de tiers) : à décider.
