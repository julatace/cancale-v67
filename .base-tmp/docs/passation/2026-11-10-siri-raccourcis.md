# 10 nov. — Siri / Raccourcis (lot AH, proposition 50 validée)

Branche `claude/siri-raccourcis`.

## Ce que Julien a validé
« Siri / Raccourcis : « Ajoute un achat dans VRM » (lien profond qui ouvre la saisie d'achat
pré-remplie, et « Où est le N°124 ? ») » — proposition 50, validée le 9 nov. au soir (« Fais tout »).

## Ce qui est fait
Une PWA ne peut pas déclarer d'intention Siri. L'app Raccourcis de l'iPhone « Ouvre l'URL » d'un
lien de VRM ; Siri lance le raccourci par son nom. Deux liens profonds, rien d'autre :

| raccourci | lien | ce que VRM fait |
|---|---|---|
| Ajouter un achat | `https://vrm.center/?tab=achats&achat=1` (+ `&titre=…&prix=…&ou=…` si le raccourci les demande) | Achats, « Nouvel achat » OUVERT, pré-rempli, ramené en vue. **Rien n'est écrit sans son « Ajouter l'achat ».** |
| Où est le N° | `https://vrm.center/?tab=journee&q=` + l'entrée fournie | la loupe ouverte sur ce N° (« Tout sur le N° » de la recherche universelle) |

- Règle : `src/raccourcisSiri.js` (pure). Un prix illisible (« quarante », « 12,345 », « -3 ») laisse
  le champ VIDE, jamais deviné ; « 45.50 » (Siri) ⇒ « 45,50 ». Titre ≤ 80, lieu ≤ 40, caractères
  invisibles retirés. `q` passe par la règle du micro de la loupe (`requeteDeLaVoix`) :
  « cent vingt-quatre » ⇒ 124, « B 125 » ⇒ B125 ; > 64 caractères ⇒ rien.
- Branchement : `goto` (App.jsx, la liste blanche des liens) lit `achat=1` et `q` ; `achat=1` sans
  `tab` ouvre aussi Achats ; l'adresse est effacée dès qu'elle est lue (rien ne reste dans la barre).
  La loupe est ouverte par l'événement existant `vrm:fiche-article` (aucun nouveau chemin).
  Le formulaire d'Achats (`AchatsHorsPlateforme`) consomme la demande UNE fois (`vrm:achat-lien`
  si l'écran est déjà monté), oubliée après 2 min.
- Aide : Paramètres → Affichage → « Siri et Raccourcis » (`src/RaccourcisSiri.jsx`, style du guide
  SMS) : pour chaque raccourci, la phrase à dire, le lien, « Copier le lien », 3 étapes ; « Aller plus
  loin » (pré-remplir avec « Demander une entrée ») et « Pourquoi ? » (Safari) repliés.
- **Recherche universelle (lot AX, `claude/recherche-universelle`)** : le lien `?tab=…&q=…` est
  simple ; il pose la requête de la loupe, ce que la recherche fait du N° ne dépend que d'elle.

## Limite connue (dite dans « Pourquoi ? »)
Sur iPhone, « Ouvrir les URL » ouvre Safari, pas l'icône de l'écran d'accueil : il faut être
connecté à VRM dans Safari une fois.

## Preuves
- `scripts/audit-raccourcis-siri.cjs` : 40 contrôles (lecture des liens, liens exacts, 3 étapes
  ≤ 12 mots, branchement `goto`/Achats/Paramètres, rien d'écrit dans le chemin du lien) ;
  `--prouve` : 8 mutations toutes rouges (prix deviné, sans `achat=1`, sans la règle de la voix,
  sans bornes, sans nettoyage, demande non consommée, lien bavard).
- `scripts/bancs/raccourcis-siri.cjs` (390 tactile et 1512, clair et sombre) : tout vert ;
  **14 rouges** sur le build d'origin/main (ae0e418d). Captures regardées (formulaire pré-rempli en
  vue, loupe sur « 124 », aide).
- `achats-hors-plateforme` relancé : vert. Audits variables, tdz, coherence, identite, icones,
  recherche-vocale : verts. `audit-coque-parametres` : 1 rouge DÉJÀ sur origin/main (icônes
  « chart » et « send » en double, pas de ce lot ; « mic » est unique).

## Geste de Julien
Aucun obligatoire. Pour s'en servir : Paramètres → Siri et Raccourcis, copier le lien, 3 étapes.
