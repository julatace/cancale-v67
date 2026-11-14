# 14 nov. — « Une seule fiche partout » (proposition 62, choisie par Julien)

Branche `claude/fiche-partout`. Julien : « Toucher n'importe quelle ligne (vente, colis, annonce,
achat) ouvre la même fiche de la paire, avec toutes ses actions. »

## Ce qui est livré

- **Un toucher sur une ligne ouvre LA fiche** (`src/FichePaire.jsx`, la même que « Tout sur le N° »),
  quelle que soit la liste : Ventes (Vinted, Leboncoin, eBay, Vestiaire — `LigneVenteCompacte`),
  À expédier (colis Vinted, eBay, Leboncoin, Vestiaire), Annonces Vinted / Leboncoin / eBay / Vestiaire,
  Stock (une case occupée), Achats, À retirer.
- **Par identité, jamais par titre (§5)** — `src/ficheLigne.js` :
  - la rangée porte son identité en `data-fl-*` (`attrsFicheLigne`) : les N° que la LISTE a déjà trouvés
    par identité, l'identifiant d'annonce, le n° de transaction, le n° de suivi, la photo exacte ;
  - `numeroDeLigne` désigne la paire dans cet ordre : N° de la ligne → fiche de l'annonce → transaction
    (→ son annonce → sa fiche) → photo EXACTE. Le titre, la photo et le prix posés à côté ne servent
    qu'à l'affichage ;
  - plusieurs N° (un lot) : la fiche les montre, **aucun n'est choisi** (son toucher choisit) ;
  - aucun : **la fiche de la LIGNE** (« Pas de paire reliée à cette ligne » + le geste pour relier) ;
    une lecture ratée : « — pas su » (jamais « rien ») ;
  - deux paires présentes sous un N° (`p.double`) : la fiche le dit en rouge et **ne montre aucun
    chiffre d'une des deux** (tuiles achat / vente / bénéfice et « L'état » retirés, `data-fiche-choisit="0"`).
- **La partie utile au contexte en haut** : une vente ouvre la fiche avec SON récapitulatif (l'argent,
  la frise prouvée, les détails) ; un colis avec le bordereau et ses gestes ; un achat avec ses gestes ;
  une case du Stock avec sa place et ses gestes. Puis « Actions », puis l'histoire de la paire.
- **Aucune action perdue** : les gestes de la ligne sont les MÊMES éléments React (mêmes fonctions,
  mêmes `data-*`), rendus dans la fiche par `src/DansFiche.jsx` (un portail vers la place « contexte » ou
  « actions » de la fiche) — rien n'est réécrit.
- **Feuille par portail**, `FermeAuRetour` (le retour ferme la fiche et rend la liste au même défilement),
  **glisser vers le bas pour fermer** au doigt (en haut de la fiche ; jamais pendant une saisie ni un
  défilement horizontal ; ressort court ; `prefers-reduced-motion` respecté), Échap à l'ordinateur.
- Ouverte depuis une ligne, la fiche est **sous** les feuilles que la liste ouvre par-dessus (relier un
  achat, code en grand… z ≥ 1000) et au-dessus des barres (z 950). Depuis la loupe : 9000, inchangé.
- **Vitesse (1 000 articles)** : la fiche a son propre hôte (`HoteFicheLigne`) — ouvrir ne redessine
  pas la liste dessous ; les lectures de la fiche (`numData`) partent APRÈS sa première image (un effet
  né d'un toucher est rejoué par React avant l'image : mesuré 300–700 ms sans ce délai) ; le morceau
  `FichePaire` se charge l'app au repos et au premier appui ; à 1 000 rangées, seule la rangée ouverte
  se redessine (`useSyncExternalStore` par clé).

## Le dessin (AJOUT 3 de Julien, 14 nov. 09:01)

Pas de grande carte sombre : en tête compacte sur le fond de la page (photo 72, N° 28/700, titre 17/600
sur deux lignes, prix 22/700 à l'encre, le contexte en 13 gris). **Un seul bouton plein accent** :
l'action principale du contexte (le premier « principal » rendu — imprimer, emballer…, marqué
`data-fiche-principal`) ; toutes les autres actions en **rangées de liste**, texte accent, filet fin
indenté. Les chiffres en bande (pas de cartes) ; un chiffre qui manque n'est jamais une case « — » :
une ligne grise, avec sa porte (« Saisir »). Textes nouveaux par `tr()`, 5 langues
(`src/i18n/langues/*/fiche.js`).

## Inventaire AVANT (mesuré sur origin/main 9236d48b, banc `EXPLORE=1`) → APRÈS

| liste | avant : un toucher sur la ligne | ses actions | après |
|---|---|---|---|
| Ventes (Vinted) | le tiroir « récap » de la vente (`vrm-ledger-drawer`) | photo en grand, emballage (saisir), photo du carton, Fiche de l'article, Me le rappeler, Voir sur Vinted, Conversation, Frais / N° / prix d'achat (repli), bordereau, remettre en vente, article perdu, facture | LA fiche, le récap EN HAUT (mêmes éléments) ; « Fiche de l'article » caché (on y est) |
| Ventes Leboncoin / eBay / Vestiaire | le même tiroir (`LigneVenteCompacte`) | celles de chaque site | LA fiche, le détail en haut |
| À expédier (colis) | rien (actions sur la carte) | Imprimer / Générer le bordereau, « … » : Imprimé, Colis fait, Voir sur Vinted | LA fiche, ces gestes dans « Actions » (aussi sur la carte : rien ne bouge dessous) |
| Annonces Vinted | dépli « Détails et gestes » | Changer le prix, Ranger au stock, « Autres gestes » (places, Publier partout, Visuels, Relier un achat, Passeport, Histoire · Dupliquer, Me le rappeler, Marquer vendue) | LA fiche, ces gestes dedans |
| Annonces Leboncoin | rien | Gérer ↗, Supprimer (quand permis) | LA fiche, ces gestes dedans |
| Annonces eBay | dépli de la carte (`vrm-eb-fiche`) | modifier, règle d'offre, relire, offre aux observateurs, supprimer | LA fiche, la fiche eBay en haut |
| Annonces Vestiaire | rien | Relier / Délier Vinted | LA fiche, dans « Actions » |
| Stock (case occupée) | la feuille du Stock (`data-stock-modale`) | Voir l'état, Déplacer, Retirer de la case, Je l'ai sortie, Encore là | LA fiche, la place et ces gestes en haut (« Voir l'état » caché : on y est) |
| Achats | rien (icônes + menu « ⋯ ») | code de retrait, suivre, copier le prix payé, note, Me le rappeler, reçu / justificatif, attestation, joindre une facture, « revendu combien ? », étiquette, masquer | LA fiche, le menu entier dans « Actions » |
| À retirer | dépli de la ligne | le code (sources, désaccord), gestes, J'ai retiré | LA fiche (de la LIGNE si aucune paire reliée), le détail en haut, « J'ai retiré » aussi |
| Ma journée | des cartes de TÂCHES (« 1 numéro en double · Voir », colis à poster…) qui mènent aux listes ; aucune rangée par paire | — | inchangé : leurs listes ouvrent la fiche |

## Preuves

- `scripts/bancs/fiche-partout.cjs` (données inventées : 50 paires au même titre N°201–250, 1 000 paires
  et 1 000 ventes de plus) : pour chaque liste, toucher ⇒ `[data-fiche-paire]` sur le BON N° par
  identité (227, 241 — jamais un autre au même titre), contexte, inventaire dans la fiche, retour au même
  défilement, 44 px, aucun débordement, aucune erreur ; la ligne sans identité ⇒ « pas de paire reliée ».
  **Rouge sur origin/main** (aucune fiche ne s'ouvre), **vert après**, **mutation** (numéro par titre)
  rouge. Le temps mesuré est celui où la fiche est POSÉE (rendu React) ; le recalcul de style qui suit
  est celui de toute feuille de l'app (mesuré : poser un voile vide coûte 80–700 ms sur la machine de
  banc chargée — à traiter à part, ce n'est pas la fiche).
- Gardés verts : build, audits traduction, tdz, icones, coherence, variables, composants, identite,
  rouge-doublon, quoi-de-neuf ; bancs fiche-paire, recherche-fiche, design-passe, design-passe-2.

## Ce qui reste / limites

- Deux paires sous un N° : l'app les règle seule (décision du 20 oct.), l'état est passager ; la règle
  « ne choisit pas » de la fiche est en place mais le banc ne peut pas la poser par les données.
- Les captures avant/après : `SHOTS=… node scripts/bancs/fiche-partout.cjs` (`fp-*.png`).
- Geste de Julien : aucun.
