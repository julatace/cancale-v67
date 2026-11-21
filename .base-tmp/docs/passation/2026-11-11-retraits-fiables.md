# 11 nov. — Retraits fiables (branche `claude/retraits-fiables`, depuis `claude/colis-a-leur-place`)

Julien, mot pour mot : « Pour les colis qui sont arrivés, c'est clairement pas clair… beaucoup d'erreurs… pas
fiable. Il faut qu'en temps réel les colis soient tout le temps vérifiés s'ils sont disponibles dans les points
relais respectifs. La lecture des mails dans l'application doit permettre de ne louper aucun colis. On doit
pouvoir voir exactement quel colis est à tel endroit. Là tu me regroupes tout à Super U. Ceux qui ont changé de
point relais, tu les mets dans un autre, mais tu ne donnes pas les codes. Je ne comprends rien. Ce n'est pas
pratique. Personnalisable, peu importe la personne, tout doit marcher. »

Pas d'accès à la base ici : tout est mesuré en EXÉCUTANT la vraie route `api/email-inbound.js` (fausse base à
état, `scripts/_faux-inbound.cjs`) et la vraie app construite, sur des e-mails et colis INVENTÉS. Extension :
rien changé. Fonctions `api/` : aucune ajoutée (12/12). Pas de PR (la session principale intègre).

## 1. Pourquoi « tout à Super U » (la cause, prouvée)

1. **Les listes de suggestions lues comme le point du colis.** Les e-mails et bordereaux des transporteurs
   portent un bloc « Points de proximité », « Autres points près de chez vous », « Pour vos prochains envois,
   déposez… » (relais près de l'expéditeur ou de lui). `lieuSousEnTete` prenait le PREMIER en-tête « Point
   relais » du texte — souvent la première suggestion, le même supermarché de sa ville pour tous ses colis.
   Mesuré au banc (corpus inventé) : « vrai point puis suggestions » ⇒ rangé « SUPER U ACCUEIL » ; « suggestions
   sous un en-tête puis le vrai point » ⇒ « SUPER U ACCUEIL ». (Piste confirmée par le bordereau Chronopost
   Shop2Shop qu'il a envoyé — jamais versé au dépôt.)
2. **Un lieu qui n'est que le TYPE de lieu** pris dans le SUJET : « disponible dans votre Relais Pickup »,
   « un UPS Access Point », « votre relais Shop2Shop » ⇒ tous les colis DPD/UPS/Relais Colis/Shop2Shop d'un
   vendeur rangés sous UN faux point « Votre Relais Pickup », toutes villes confondues.
3. **Le regroupement au nom** (`regrouperRelais`) : clé = nom + code postal (la rue ignorée : deux Super U de la
   même ville = une carte) ; un lieu au NOM SEUL (« LOCKER 24/7 SUPER U », ligne vide entre les lignes de
   l'e-mail) rejoignait « le seul point de ce nom » ; et `completerParPointConnu` donnait à un « Super U » sans
   adresse l'adresse du seul Super U déjà connu — une ressemblance de nom.

## 2. Ce qui change (des règles, aucun cas particulier)

- `api/_lib/retrait-colis.js` : `sansSuggestions` (une zone de suggestions commence à sa ligne d'annonce, finit
  à une ligne qui parle du colis : disponible, t'attend, retrait, code…) ; `ANNONCE_POINT` (« Votre point de
  retrait », « …disponible dans votre Chrono Relais : », « …au Point Relais suivant : ») lu AVANT un en-tête nu ;
  en-têtes de tous les réseaux (Relais Pickup, Locker InPost, UPS Access Point, GLS ParcelShop, Relais Colis,
  Point de retrait, Bureau de poste) ; `lieuGenerique`.
- `api/email-inbound.js` : motifs d'une ligne lus dans le CORPS avant le sujet, lieu générique refusé ; n° de
  suivi « colis n° … », Colissimo `6A…` (11 chiffres) et S10 pour tous (avant : Colissimo / La Poste rangés
  « info », colis nulle part) ; un e-mail « disponible » SANS n° mais avec un code : ligne à lui (sujet + code ;
  avant, deux e-mails au même sujet partageaient une ligne, le second effaçait le premier), `sansSuivi`.
- `src/relaisColis.js` : identité d'un point = nom + code postal + RUE ; nom seul ⇒ carte à part « Adresse pas
  lue », jamais fondu ; sans code postal, seule la même rue numérotée (ou « Nom - Ville » + rue) rejoint ; le
  type seul n'est pas un nom ; « Chrono Relais – » retiré du nom ; clé rendue « nom|cp » quand un seul point la
  porte (compatibilité). `lieuCompleteParTransporteur(lu, tr, emailMs)` : le transporteur dit le colis
  disponible à une autre adresse APRÈS l'e-mail ⇒ son adresse et `lieuDeplace` (« déplacé · selon Vinted Go à
  14:05 ») ; sinon le désaccord reste dit.
- `src/App.jsx` : plus aucune complétion par le registre des points (« le point vient de ce qui est lu pour CE
  colis ») ; un e-mail sans n° avec code ⇒ « à vérifier » (raison dite), sauf si son code est celui d'un colis
  montré (une relance ne fait jamais un 2e colis).
- `src/lieuxRetrait.js` : une ligne déjà rangée dont le lieu n'apparaît QUE dans une liste de suggestions de SON
  e-mail gardé est relue avec la règle (aucune migration, rien écrit).
- `src/relaisChange.js` + `AlerteRelaisChange.jsx` : « Point relais changé » montre le CODE de ce colis (celui
  de l'e-mail du changement, sinon le plus récent d'un autre e-mail/SMS du même n° ; sinon « Code pas encore
  reçu »), en grand, copiable, et « Avant : <ancien point> ».
- `src/CarteRelais.jsx` (la carte d'un point) : le code est LISIBLE sur la ligne (20 px, chiffres alignés), un
  toucher le copie ; « Adresse pas lue » ; « pas confirmé depuis le 8 nov. » en ambre quand aucune source datée
  n'a revu le colis depuis 48 h (`verifieAncien`, src/sourcesRetrait.js) ; « Masquer » un point (préférence de
  CE navigateur) avec la trace « 1 point masqué · Afficher », jamais un point au colis du dernier jour ; ordre
  « Récents » (défaut, sa décision du 9 nov.) ou « Date limite ».

- `src/sourcesRetrait.js` : `verifiePar` — la ligne dit QUI a vérifié en dernier : « vérifié par Chronopost à
  14:05 », « par e-mail à 09:12 », « par Vinted » ; la marque déjà dite n'est pas répétée. Exigence « même sans
  extension » : rien ici ne dépend de l'extension (e-mails, lectures serveur `transp_*`, achats relus) ; la
  lecture serveur de Mondial Relay (Cloudflare) relève du lot `suivi-commandes` (rien poussé à reprendre au
  moment de ce récit : sa branche ne porte que nos commits).

## 3. Le colis fantôme (« allé au relais pour un colis parti depuis une semaine »)

Cause probable, lue dans le code : rien ne disait qu'un colis n'avait été REVU par aucune source. Un colis d'un
réseau que VRM ne lit pas (Colissimo, DPD, UPS, GLS, Relais Colis) ou dont le suivi n'est pas relu (passage de
15 min suspendu au `CRON_SECRET`) restait « à retirer » avec la même assurance jusqu'à sa date limite (ou la
garde de 7 j), même retiré. Côté achat Vinted sans date d'arrivée, la borne d'arrivée est l'heure de la
dernière lecture des achats (elle ne vieillit pas). Corrigé : « pas confirmé depuis le … » (ambre) après 48 h
sans source datée (e-mail, transporteur, conversation, achats relus) ; banc F5 et mutation `jamais-ancien`.
Les fins prouvées (retiré, reparti, commande finie) sortaient déjà le colis (inchangé, « Sortis de à retirer »).

## 4. Gestes (avant ⇒ après)

| geste | avant | après |
|---|---|---|
| lire le code d'un colis au comptoir | 1 toucher (« Code ») | 0 (le code est sur la ligne) |
| copier le code | 1 | 1 |
| code d'un colis au point changé | quitter l'app, retrouver l'e-mail (≈ 4) | 0 (sur l'alerte), 1 pour copier |
| savoir si un colis est encore sûr | ouvrir le détail, lire les heures | 0 (ambre « pas confirmé depuis ») |
| retrouver le bon Super U | impossible (tout sous un point) | 0 (une carte par adresse) |

## 5. Cas testés (liste exhaustive)

`scripts/audit-retraits-fiables.cjs` (95 verts ; arbre d'avant `claude/colis-a-leur-place` : 34 rouges ; `--prouve` 14/14 mutations) :
- A, vraie route, un e-mail inventé par cas ⇒ une ligne, son code, son point : Mondial Relay comptoir (Lille,
  lignes vides) · Mondial Relay casier « LOCKER 24/7 SUPER U » (Brest, rue sans numéro) · « changé de plan »
  avec code (Marseille, en route) · InPost Locker (Strasbourg) · Relais Colis « Relais : … » (Ajaccio) ·
  Chronopost Pickup (Saint-Denis 974) · Colissimo point de retrait (Brest) · La Poste bureau (Fort-de-France
  972) · Vinted Go (Lille, sans code postal) · DPD Pickup (Lyon) · UPS Access Point (Toulouse) · GLS ParcelShop
  (Nantes) · Shop2Shop (Cayenne 973) · Mondial Relay sans n° (⇒ « à vérifier » avec code) · Chronopost
  suggestions puis vrai point · vrai point puis suggestions · Mondial Relay suggestions sous un en-tête puis vrai
  point (2 formes) · e-mail Vinted avec suggestions · sujet « à retirer dans les 10 jours » · DPD « dans votre
  Relais Pickup » avant le vrai point.
- B : relance du même n° ⇒ même ligne, date limite mise à jour · retiré puis e-mail plus ancien traité en
  retard ⇒ reste retiré · deux e-mails sans n° au même sujet ⇒ deux colis, le rappel du même code retombe sur
  sa ligne · e-mail reçu sur l'adresse d'un AUTRE vendeur ⇒ rien chez lui.
- C : deux Super U à Lille, deux rues ⇒ deux points ; même adresse écrite autrement ⇒ un · Super U sans
  adresse ×2 ⇒ deux cartes « adresse pas lue » · même enseigne Lille/Marseille/Ajaccio/Saint-Denis · « votre
  Relais Pickup », « un UPS Access Point » ⇒ point pas su · Super U au code postal seul parmi deux ⇒ aucun
  choisi · `lieuGenerique` serveur.
- D : code du changement · code d'un autre e-mail du même n° · aucun ⇒ « code pas encore reçu », jamais celui
  d'un autre n°.
- E : > 48 h ⇒ « pas confirmé » ; < 48 h non ; aucune date ⇒ rien ; « vérifié par Chronopost à 14:05 » (lecture transporteur la plus récente), « vérifié par e-mail à 09:12 » (seul l'e-mail).
- F : ligne rangée sur une suggestion ⇒ relue au vrai point ; point juste ⇒ inchangé.
- H : transporteur plus récent à une autre adresse ⇒ « déplacé » ; plus ancien ⇒ désaccord dit ; date inconnue
  ⇒ rien choisi.
- G : branchements (aucune complétion par nom, « à vérifier » sans n°, code visible, masqués avec trace, ambre,
  « Adresse pas lue », alerte avec code et ancien point).

Banc `scripts/bancs/retraits-fiables.cjs` (vraie app, 390 tactile sombre + 1512 clair) : **22 verts** — F1
deux Super U de Lille = deux cartes, Marseille/Ajaccio/Saint-Denis à leur point ; F2 casiers au nom seul seuls,
« Adresse pas lue » ; F3 code lisible ; F4 alerte avec code (autre e-mail du même n°) et ancien point ; F5
« pas confirmé depuis le 8 nov. » ; F6 masquer/afficher ; F7 « vérifié par e-mail … » ; débordement ; erreurs. Captures regardées (390
sombre, 1512 clair, alerte).

Cas déjà couverts par les audits existants, relancés verts : deux codes en désaccord, code « sûr » à deux voix,
e-mail en double (même n°, même code), moitié Vinted sans identité « comptée avec » (jamais deux colis), date
limite dépassée ⇒ « à vérifier », faux « retiré » (changé de plan), retiré qui reste retiré, transporteur qui
contredit (`codes-retrait`, `retraits-irreprochables`, `retrait-fiable`, `retrait-preuves`, `retraits-suivi`,
`suivi-colis`, `relais-change`, `villes-colis`, `relais-carte`, `vintedgo-adresse`, `arrivee-colis`,
`transporteurs`, `carte-relais`, `logos-bordereaux`).

## 6. Preuves

- `npm run build` vert ; audits `variables, tdz, coherence, identite, icones, textes-courts, fonctions-api,
  secrets` verts + les 14 audits colis ci-dessus verts.
- Attendus INVERSÉS (décision de Julien « aucune hypothèse ») : `audit-relais-carte` (un nom seul ne rejoint
  plus « le seul point de ce nom » ; « Super U » sans adresse = point à part) ; `audit-villes-colis` H2 (aucune
  complétion par le registre).
- Bancs : `retraits-fiables` 20/0, `colis-retirer-propre` 129/0, `retraits-irreprochables` 26/0 ;
  `retraits-irreprochables` (deux attendus portés : « vérifié par Mondial Relay à 09:40 », marque transporteur non redite) ; `achats-retraits` 68/16 — **les 16 mêmes rouges sur la tête de `claude/colis-a-leur-place`** (le lien
  « → Colis » et la carte sombre retirés par DJ3, « Peut-être en double · 9 », « à vérifier 0/3 ») : hors lot.

## 7. Ce qui reste / tranché

- Tranché : « Récents » reste l'ordre par défaut (sa décision du 9 nov.), « Date limite » au choix ; points
  masqués = préférence de CE navigateur (rien de caché ailleurs) ; un colis au point inconnu (nom seul) a sa
  propre carte plutôt que d'être rangé avec un homonyme.
- Le suivi de Colissimo, DPD, UPS, GLS, Relais Colis n'est toujours pas lu (aucune voie mesurée) : ces colis ne
  sont confirmés que par leurs e-mails ⇒ « pas confirmé » après 48 h.
- Une relance SANS n° rattachée par son code ne met pas à jour la date limite du colis existant (elle ne crée
  rien, n'est pas comptée).
- Le passage « colis » toutes les 15 min dépend toujours du `CRON_SECRET` GitHub (geste déjà listé).
- Pour `suivi-commandes` : les règles réutilisables sont `sansSuggestions`, `lieuSousEnTete`, `lieuGenerique`
  (serveur), `regrouperRelais`, `lieuCompleteParTransporteur`, `colisRelaisChange`, `verifieAncien`.

Geste de Julien : aucun. Ouvrir Achats → À retirer.
