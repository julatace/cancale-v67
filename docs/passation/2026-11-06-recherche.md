# La loupe universelle — 6 novembre (branche `v36-recherche`)

> Julien : une loupe qui trouve TOUT. La loupe globale (« Tout sur le N° », micro,
> appareil photo) devient LE point d'entrée : on tape n'importe quoi, on obtient
> des résultats rangés par type, chacun avec sa vignette, une ligne d'info et le
> geste qui ouvre l'objet. Rien n'est relié par ressemblance (§5) : le titre sert
> à TROUVER, jamais à relier deux objets.

## Ce qui a changé (pour lui)

- **Champ vide** : « Récentes » (ses dernières recherches qui ont ouvert quelque
  chose, sur CET appareil, « Effacer ») ; « Colis à retirer » (ceux qui ont un code,
  le plus récent d'abord) ; « Dernières ventes ». En mode stream, les récentes se
  taisent (une recherche tapée peut être un pseudo).
- **Ce qu'on peut taper** : un N° (« 141 », « B125 », « n141 » — le bloc « Tout sur
  le N° » reste devant, la fiche exacte n'est pas répétée en dessous), un pseudo
  d'acheteur, un n° de suivi, un code de retrait, un n° de transaction, un n° de
  facture, un **montant** (« 52 € », « 52,00 », « 52.5 » — au centime ; « 52 » seul
  reste un N°), des mots du titre, une **marque ou une taille** (champs de
  l'annonce Vinted).
- **Groupes** : Paires · Ventes · Achats · Colis · Annonces sans N° · E-mails ·
  Factures. Chaque ligne : vignette (photo, logo du transporteur, logo du site de
  l'e-mail, icône facture), titre, UNE ligne d'info (état · N° · date · prix), la
  pastille « trouvé par » (pseudo, suivi, code, transaction, montant…). « Voir les
  N autres » sous un groupe long (12 paires, 8 lignes ailleurs, 6 factures d'abord).
- **Le geste** : une paire ouvre SA fiche (`FichePaire`) ; une vente / un achat sa
  ligne ; un colis trouvé **par son code** ouvre SA carte dans Colis → À retirer
  **et passe « En grand »** (le code et le QR, écran du comptoir) ; une annonce
  sans N° SA carte dans Annonces (`data-carte-annonce`) ; un e-mail s'ouvre dans
  E-mails (la lecture de SA ligne) ; une facture saisie ouvre Factures cherchée sur
  SON n°, une facture Pro ouvre Factures (liste « Factures Pro émises » en tête).
- Un nombre long trouvé dans un e-mail (un code de retrait lu) n'affiche plus
  « Tout sur le N°913377 — jamais servi ».

## Comment (le code)

| fichier | rôle |
|---|---|
| `src/rechercheUnique.js` | LA règle (pure) : index (ventes, achats, colis, **fiches, annonces, factures**), `chercherPartout` (montant, N° partiel/exact, facture, groupes bornés par type + `totaux`), `suggestions`, `destinationResultat` |
| `src/rechercheEcran.js` | adaptateurs (annonces des lignes de dressing, N° des ventes, factures), `memoSur`, récents (appareil), demande d'ouverture (facture / e-mail), **fil de la loupe** (`FIL_RECHERCHE`), **pilote des e-mails** (`piloterEmails`) |
| `src/LoupeVivante.jsx` | `Vivant` : s'abonne au fil, texte DIFFÉRÉ (`useDeferredValue`) |
| `src/App.jsx` | le panneau (`panneauRecherche`), le champ, les lectures de la loupe (+ annonces, factures Pro), le pilote branché, `appuyer` de `CibleNotif`, Factures prérempli |
| `src/cibleNotif.js` | cible `annonce` ; `retrait` + `grand` ⇒ `appuyer: [data-colis-plein-ecran]` |
| `src/BoiteEmails.jsx` | ouvre l'e-mail demandé par la loupe (`prendreDemande('email')`) |

**Identité (§5)** : une fiche = l'id de SON annonce (50 fiches au même titre = 50
lignes) ; une annonce en ligne qui a une fiche N° est CETTE paire (même id), pas
une seconde ligne ; une vente ne prend un N° que par SA transaction (la correction
posée à la main, sinon transaction → annonce → fiche — la règle de « Tout sur le
N° ») ; un pseudo / un suivi ne s'attache qu'à la transaction écrite à côté (règle
du 3 nov., inchangée). Dressing pas lu ⇒ « en ligne » pas su (null) : la ligne ne
dit plus « Retirée » sur une lecture qui n'a pas eu lieu.

## Mesuré : base ou mémoire ?

**Sa base (lecture seule, 6 nov., Supabase MCP, comptes et plans seulement)** :
2 934 ventes, 2 719 achats, 557 annonces en ligne, 992 e-mails de la boîte
(`email_reception_*`). Le filtre de l'écran E-mails (`ilike` sur sujet,
expéditeur, article, code, suivi) : **7,2 ms** côté base (Index Scan
`app_data_owner_id_prefixe`, 792 lignes écartées). Les ventes/achats/annonces ne
sont PAS des lignes : une recherche côté base passerait par
`jsonb_array_elements` (21,6 ms pour 100 trouvailles) et une route qui n'existe
pas (plan Hobby : 12 fonctions).

**Décision** :
- ventes, achats, colis, paires, annonces, factures : **index en mémoire** de ce
  que la loupe lit DÉJÀ à son ouverture (projeté, `lireTout`) — audit : index de
  8 506 entrées en 44 ms, une frappe en 1,1 ms ;
- e-mails : **le moteur de l'écran E-mails** (`/api/email-rattacher?mode=journal&cherche=`,
  côté base sur TOUTES ses lignes, projeté) — pas de second moteur. Une requête
  par pause de frappe (250 ms), la précédente annulée, jamais pour un montant.

**La frappe** (banc, Chromium swiftshader, volume réel inventé) : le texte tapé
était un état de la coque — chaque lettre redessinait TOUTE l'app (240-600 ms par
lettre sur Ma journée, même sans résultat). Il vit maintenant dans le fil de la
loupe : seuls le champ et le panneau se redessinent. **Frappe → ligne peinte :
médiane 32 ms, pire 135 ms (36 mesures, 390/1512, clair/sombre)**.

## Lectures

Aucune nouvelle ligne lue entière. En plus de ce que la loupe lisait : les
annonces (tirées des lignes de dressing DÉJÀ lues), les factures Pro en scalaires
(`fetchProInvoices({ metadata: true })`), les e-mails par la route projetée.
`vinted_lbc_posted` est maintenant projetée (`select=ids:data->ids`, c'était
`select=data`). ⚠️ Vu au banc, hors de la loupe : l'écran Colis / Ma journée lit
encore `email_track_*&select=id,data` (lignes de suivi, petites, mais entières)
— pas touché ici.

## Preuves

- `node scripts/audit-recherche-universelle.cjs` : **65/65** — chaque type trouve
  SON objet (N° partiel/exact, B125 ≠ 125, pseudo, suivi, code ⇒ colis « En grand »,
  transaction, montant au centime, mots, marque + taille, facture saisie/Pro,
  e-mail par le filtre côté base émulé sur 1 000 lignes) ; 50 paires au même titre
  ⇒ 50 lignes, 50 N°, 50 fiches ouvertes ; vitesse ; pilote des e-mails EXÉCUTÉ
  (une requête pour six lettres, la requête en vol annulée, montant écarté, panne =
  pas su) ; lectures projetées ; stream. `--prouve` : **17/17 mutations**. Sur
  l'arbre d'avant (`f7f5b16e`) : rouge (« la loupe universelle n'existe pas » ; avec
  `rechercheEcran.js` copié : « la règle ne connaît ni les montants, ni les paires »).
- `audit-recherche-unique` 24/24 (8/8 mutations ; l'ancre « accents » visait
  `̀` en toutes lettres et n'existait pas — comptée « attrapée » à tort ;
  elle vise maintenant la source réelle et mord), `audit-coherence`,
  `audit-identite`, `audit-lectures-lourdes`, `audit-tdz`, `audit-recherche-photo`,
  `audit-recherche-numero`, `audit-recherche-vocale`, `audit-cibles-notif`,
  `audit-flux-divers`, `audit-mode-stream`, `audit-garde-ecrans` : verts.
- Banc `scripts/bancs/recherche-universelle.cjs` (390/1512, clair/sombre + mode
  stream) : vert ; captures `$TMPDIR/loupe-*.png` regardées (champ vide, pseudo,
  code, montant, e-mail, 50 jumelles, « En grand », récents, stream).
  `litiges-recherche`, `recherche-numero`, `recherche-photo` : verts.
  `recherche-en-place` : 2 rouges à 1512 (« défilement 88 → 0 ») — **les mêmes sur
  l'arbre d'avant**, pas de cette branche.

## Geste de Julien

Taper dans la loupe : un code de retrait (le colis s'ouvre en grand), « 52 € », le
nom d'une marque, un pseudo.
