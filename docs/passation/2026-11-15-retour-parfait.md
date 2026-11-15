# 15 nov. 2026 — Le retour d'un achat, de bout en bout (branche `claude/retour-parfait`)

Julien : « Tu as bien mis en place le retour de mon achat avec son bordereau ? Je veux que ce soit parfait
et irréprochable. » Suite de `2026-11-15-retours.md` et `2026-11-15-retours-suivi.md`. Branche partie de
`origin/claude/project-review-nsk5su` + vrai merge de `origin/claude/numeros-masquees` (`txAchatsEnRetour`,
`achatEnRetour`). Pas de PR (l'intégration la fusionne). Aucune version d'extension (rien n'y était
indispensable).

## 1. Mesuré d'abord (lecture seule, base de production)

Ses deux lignes `email_bordretour_{tx}` (scalaires `meta`, aucune valeur recopiée ici) :

| retour | transporteur | n° | limite | PDF | `transporteurPdf` | fait lu |
|---|---|---|---|---|---|---|
| Nike (compte kenelle…) | Mondial Relay (PDF « MondialRelay », A4 portrait) | 8 chiffres | 16 nov. 10 h | oui | **absent** | e-mail Mondial Relay « en transit » du même n° le 10 nov. (sortant) |
| Autry (shop_…) | **Chronopost** (voir §2) | `XU#########JF` | **lun. 23 nov. 10 h** (Paris) | oui, ~76 Ko, A4 **paysage** 842×595 | **absent** | aucun |

- Les achats : l'Autry dit encore « La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste
  ou point relais » (la forme qui faisait « à retirer ») ; le Nike « Commande expédiée et en cours
  d'acheminement ». Photos présentes (par n° de transaction).
- Aucun `email_rembachat_` de ces deux n° ; aucun « Déposé » de sa main (`vrm_retours_deposes`).
- ⚠️ La consigne disait « dim. 23 nov. » : le 23 novembre 2026 est un **lundi** (vérifié, `Intl`, Paris).

## 2. Le transporteur de l'Autry : Chronopost — la preuve

- **L'étiquette elle-même** (texte du flux de contenu du PDF, décompressé dans le carnet local, jamais
  copié dans le dépôt) : « **Chrono Relais Europe** », « **Consignement : XU…JF** », « N° de colis :
  XU…JF », « 2SHOP EUR », et le pied « **Chronopost** 3 Boulevard Romain Rolland - 75014 Paris - France ·
  Société par Actions simplifiée … RCS Créteil » (+ « submitted to Geopost », le groupe de Chronopost). La
  règle de la réception (`decisionTexteBordereau`) rend `{ etat: 'ok', t: 'chronopost' }` sur ce texte.
- **La forme publique** : un n° Chronopost a 13 caractères, « 2 lettres, 9 chiffres, 2 lettres »
  (laposte.fr « Suivre une lettre, un Colissimo ou un Chronopost » ; parcelsapp.com « Chronopost France » ;
  packlink.com « Suivi Chronopost »), la forme UPU **S10** (2 lettres de service, 8 chiffres, 1 chiffre de
  contrôle, 2 lettres).
- **La clé S10** (poids 8 6 4 2 3 5 9 7, 11 − somme mod 11) du n° réel de l'Autry est **juste** (calculée
  sur la valeur lue en base, non recopiée). Le chantier scanner (`claude/scanner-colis`, `src/scanColis.js`)
  a mesuré 187 n° Chronopost rangés sur 187 à clé juste, préfixes `XW/ZW/XU/ZU` et suffixes `TS/SP/JF` :
  `lireCodeColis` dit « chronopost ». Ce fichier est repris **tel quel** (identique octet pour octet à la
  branche scanner : une seule version) et sert à la carte quand l'étiquette n'a rien dit
  (`transporteurSource: 'forme'`) ; l'étiquette passe d'abord ; une clé fausse ⇒ personne. Côté serveur,
  `transporteurDeForme` (XW/ZW…TS/SP) n'est pas élargi dans ce lot : le départ est lu par l'étiquette
  (`transporteurPdf`, §3).
- Le suivi public : `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=<n°>` (l'adresse
  déjà attestée de `lienSuivi`).

## 3. Rattrapage du transporteur des lignes anciennes — `api/_lib/reclasser-retours.js`

`transporteursRetours`, appelé par `/api/email-rattacher?mode=reclasser` (SA session ; l'app l'appelle à
l'ouverture d'Achats et de Ma journée, au plus une fois par heure) — aucune fonction `api/` de plus :
- SES lignes `email_bordretour_*` avec PDF (`meta._pdf`) jamais lues (`meta.pdfLu` absent), 4 par appel,
  UNE ligne par lecture (`id=eq.`), la MÊME lecture que la réception (`transporteurDuPdf`) ;
- n'écrit QUE le manquant : `pdfLu` (la marque), `pdfRegle`, et `transporteurPdf` / `suiviPdf` seulement
  absents ET lus ; un transporteur déjà rangé n'est jamais remplacé ;
- écriture CONDITIONNELLE (`PATCH … &meta->>pdfLu=is.null`) : une réception rejouée entre-temps n'est
  jamais écrasée ; une lecture ratée ⇒ rien écrit, 503 ; idempotent (la marque) ;
- l'app relit ses retours si un transporteur a été rangé (`transporteurs` dans la réponse).
Conséquence en chaîne : `transporteurPdf: chronopost` ⇒ la carte a le logo et « Suivre ↗ » Chronopost, et
le serveur LIT le départ du retour chez Chronopost (`depart_chronopost_…`, jamais `transp_`) — sans le
champ, `carrierDepart` ne le choisissait pas (la forme ne suffit pas). Mondial Relay ne se lit toujours pas
côté serveur pour un colis qu'il poste (décision du 8 nov.) : ses e-mails font foi (le cas Nike).

## 4. La carte « À renvoyer » — la maquette « Verre dépoli » (`src/RetoursLitiges.jsx`, `src/retoursAchat.js`)

- En tête : photo (par SON n° de transaction), titre, N° s'il en a un, compte.
- **La bande ambre** (tant qu'il n'est pas déposé) : « **À déposer avant lun. 23 nov. 10 h** » · « dans 8
  jours · sinon tu gardes l'article et le vendeur est payé » (la règle écrite par Vinted dans son avis).
- **Les étapes jusqu'au remboursement** (`etapesRetour`, pur) : Bordereau reçu (transporteur) · À déposer /
  Déposé (date) · En route vers le vendeur · Livré au vendeur / Au point relais du vendeur (date) ·
  Remboursé (montant). Chaque coche est PROUVÉE (e-mail du transporteur, lecture du départ, e-mail
  « … a été remboursée », ou SON clic « Déposé » — dit « noté par toi ») ; une étape passée que rien ne
  prouve (remboursé sans aucun fait) est GRISÉE, jamais cochée. La phrase unique d'avant est retirée (la
  même date n'est plus écrite deux fois). Ma journée garde la carte courte (bande + gestes).
- Le n° de suivi : logo, n° (un toucher = copié), « Suivre ↗ » (page publique du bon transporteur).
- **« Imprimer le bordereau »** : LE PDF de ce retour (par son n°), tamponné par **le chemin des bordereaux
  de vente** (`tamponnerBordereau` : zone blanche trouvée sur le rendu, sinon fiche 10×15 APRÈS
  l'étiquette). Avant, le tampon « RETOUR · N° » était un rectangle blanc posé en haut à gauche — sur
  l'étiquette Chronopost paysage il couvrait l'en-tête de la fiche (positions relevées dans le flux). La
  page d'origine garde sa taille (842×595 / 595×842) : iOS l'ajuste à la feuille choisie, rien de rogné.
  Sur iPhone la feuille de partage (« Imprimer ») ne s'ouvre que DANS le toucher : le PDF est **préparé dès
  l'affichage de la carte** et le toucher l'ouvre sans attendre ; pas encore prêt ⇒ « Ouvrir le
  bordereau » (son second toucher), jamais un téléchargement muet. Ordinateur : la visionneuse imprime.
- « Déposé » : son geste, enfoncé + coche, tant qu'aucun fait n'est lu ; un fait lu le remplace.
- « Tout imprimer » → Retours : seulement ce qui reste à déposer.
- Pas de faux rappel : tant que les e-mails du transporteur ne sont pas lus (`trackEnCours`), aucun retour
  qui a un n° n'est pressé « à déposer » en tête de Ma journée (le Nike déjà parti ne clignote plus).

## 5. Ce qui avance tout seul — et ce qui reste son geste

| fait | d'où | la carte | notification |
|---|---|---|---|
| bordereau reçu | e-mail Vinted | bande + « Bordereau reçu · <transporteur> » | « À renvoyer : … » (à la réception) |
| la veille de la limite, pas déposé | cron du soir (18 h UTC) | — | **« Retour à déposer avant demain 10 h »** |
| le jour de la limite, pas déposé | cron du matin | — | **« Dernier jour pour ton retour · À déposer avant 10 h »** |
| pris en charge | e-mail du transporteur, OU lecture Chronopost/Vinted Go (`depart_`) | « Déposé · <date> » ✓, en route ici | « Retour déposé · Pris en charge par … » (une fois, < 72 h) |
| au relais du vendeur | e-mail / départ | « Au point relais du vendeur · <date> » | — |
| livré au vendeur | e-mail / départ | « Livré au vendeur · <date> » ✓, remboursé ici (sous 2 jours) | « Retour livré au vendeur » (une fois, < 72 h) |
| remboursé | e-mail « … a été remboursée » | tout coché, « Remboursé · 34,32 € » | « Remboursé · 34,32 € » (une fois) |

Rappels et notifications du cron : `api/_lib/retour-notifs.js` (pur + passe injectée) appelé par
`api/ship-reminders.js` (matin ET soir), famille « colis », réservation dans `push_dedup` avec **la clé de
la voie e-mail** (`retour-depose-{tx}`, `retour-livre-{tx}`) : jamais deux fois. Pas de rappel après SON
« Déposé » ni après un remboursement ; une lecture ratée n'envoie rien. Textes : `api/_lib/notif-redaction.js`
(sorte `retourRappel`, 5 langues, titre ≤ 40, corps ≤ 90).

Reste son geste : imprimer, déposer (et toucher « Déposé » si le transporteur n'écrit pas).

## 6. Jamais « à retirer »

Les deux achats sont « en retour » par LEUR bordereau (n° de transaction) : app (Achats, Colis, Ma journée),
widget iPhone et rappel du matin (règle partagée `api/_lib/suivi-colis.js`, exécutée par
`audit-retour-pas-a-retirer` sur la forme mesurée « colis déposé en bureau de Poste ou point relais ») ; le
colis du retour est SORTANT (e-mail « disponible » au relais du vendeur rangé sortant, départ lu en
`depart_`) ; aucune notification de retour n'a la forme « à retirer ».

## 7. Preuves

- `scripts/audit-retour-parfait.cjs` (EXÉCUTE la lecture du PDF, la vraie route `email-rattacher` sur la
  fausse base — filtres `meta->>` maintenant servis sur demande par `_faux-inbound.cjs` —, la clé S10 et la
  règle du scanner, le choix des départs, la règle de la carte, la passe des notifications, les textes
  5 langues) : **vert** ; **rouge sur l'arbre de départ** (`git archive origin/claude/project-review-nsk5su`) ;
  **14/14 mutations attrapées** (`--prouve`).
- `scripts/bancs/retour-parfait.cjs` (390 tactile iPhone et 1512, clair et sombre ; pdf.js local) : **86
  verts** — les deux cartes, la bande (≥ 4,5:1), l'encre de la carte (titre, compte, n°, liens ≥ 4,5:1 en tête
  de Ma journée ET dans Achats), l'impression ouvre LE PDF inventé de l'Autry à sa taille d'origine 842×595
  (feuille de partage DANS le toucher sur iPhone ; visionneuse sur ordinateur : étiquette intacte + fiche
  10×15 après elle), l'avancement sur un faux e-mail Chronopost puis livré + remboursé.
- Trouvé et corrigé en route : (1) dans la tête de Ma journée en mode clair, la carte « À renvoyer »
  héritait de l'ENCRE CLAIRE du fond (titre, compte, « Sur Vinted ↗ » blancs sur le verre clair) — rouge
  aussi sur l'arbre de départ (`retours-renvoyer`) : `.vrm-ret-carte` ajoutée aux surfaces qui remettent
  l'encre sombre (`studio-verre.css` §7) ; (2) un retour déjà déposé ressortait « à déposer » le temps de
  relire les e-mails du transporteur (une lecture faite pour la liste vide du premier rendu) : la lecture
  porte désormais SA liste de n° (`retoursTrackLu`) et rien n'est pressé pendant la lecture (`trackEnCours`).
- Bancs voisins : `retours-suivi` vert, `retours-renvoyer` vert (2 rouges sur l'arbre de départ, corrigés),
  `retours-litiges` 1 rouge DÉJÀ rouge au départ (« Paire revenue » à 36 px sur ordinateur, feuille Pas à
  pas, hors de ce lot) ; son fixture 9501 portait un libellé « Déposé en point relais » qui, depuis la règle
  retours-suivi, fait avancer le retour (rouge au départ) : libellé d'avant le dépôt.
- Audits verts : retour-parfait, retour-pas-a-retirer, retour-vinted, retours-emails, retours-litiges,
  retours-stock, retours-suivi, notifs-redaction, notifications, notifs-belles, suivi-colis, fonctions-api
  (12), identite, traduction, tdz, variables, studio, quoi-de-neuf, csp.

## 8. Geste de Julien

Aucun pour le rattrapage : ouvrir Achats ou Ma journée une fois la version en ligne (le serveur range
`transporteurPdf: chronopost` sur l'Autry ; le cron lit ensuite son départ chez Chronopost). Pour l'Autry :
« Imprimer le bordereau » (iPhone : « Imprimer » dans la feuille), déposer avant **lun. 23 nov. 10 h** ;
la carte avancera seule dès que Chronopost l'aura pris en charge.
