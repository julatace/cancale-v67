# 11 nov. — Alerte arnaque dans les messages (lot `anti-arnaque`, branche `claude/anti-arnaque`)

## La demande (validée par Julien)
Repérer dans un message **reçu** les motifs typiques d'escroquerie, **sans IA** (§2.9,
règles écrites) ; une bannière ambre sur la conversation « Attention · arnaque possible :
<raison> » + le bon geste ; un compteur discret dans Messages ; **jamais d'action
automatique** (ni signalement ni blocage) ; **jamais de faux positif sur SES messages**.

## Ce qui est livré
- **Règle pure `src/antiArnaque.js`** : `normaliser`, `motifsDuTexte`, `alerteArnaque(messages)`,
  `motifDeLApercu(texte, deMoi)`, `MOTIFS_ARNAQUE` (ordre = priorité) :
  `codeSms` · `fauxBlocage` · `lienImite` (domaine non officiel qui contient vinted,
  leboncoin, paypal, vestiaire, ebay, mondialrelay, colissimo, chronopost, laposte,
  relaiscolis — y compris déguisé 0/1/l — ou « vinted-securite… ») · `lienRaccourci`
  (bit.ly, tinyurl…) · `paiementHors` (PayPal entre proches / paypal.me, virement hors
  plateforme, RIB/IBAN, Lydia, Paylib, Wero, Western Union, mandat cash) ·
  `envoieDabord` · `transporteurPerso` · `horsPlateforme` (WhatsApp, Telegram, wa.me,
  e-mail, portable 06/07/+33, « contacte-moi par mail »).
- **Qui a écrit** : seuls les messages PROUVÉS de l'autre (`deMoi === false`) sont lus.
  Auteur pas su (null) ⇒ pas lu. Vinted : nouveau champ `autre` sur le message lu
  (`user_id === opposite_user.id`), l'équipe Vinted n'est jamais lue ; liste Vinted :
  seulement l'extrait du FIL capté avec `de === 'eux'` (l'aperçu de la boîte n'a pas
  d'auteur). Vestiaire : `deMoiSu` (trois états) ajouté, l'ancien `deMoi` booléen
  confondait « pas su » et « l'autre ». eBay : le corps n'est lu que pour une question
  d'acheteur (`estQuestion`), ses réponses jamais.
- **À l'écran** (`src/AlerteArnaque.jsx`, aucun import d'App.jsx, aucune action) :
  `AlerteArnaque` (bannière ambre, raison la plus grave, geste, « Signale-le sur
  {site} » — lien vers la conversation sur le site quand il est connu —, « + N autres
  signes », infobulle « Repéré sans IA… Rien n'est signalé ni bloqué à ta place. ») ;
  `CompteurArnaque` (« N conversations à surveiller », point ambre) ; `PastilleArnaque`
  (« Arnaque possible » sur la ligne). Branchés : Messages Vinted (fil + liste +
  compteur), Leboncoin (fil + liste + compteur), Vestiaire (fil + liste + compteur),
  eBay (fil), Tous (fil fusionné + liste + compteur).
- Textes : clés `antiArnaque.*` dans fr, en, es, it, de. « Quoi de neuf » : `alerte-arnaque`.

## Choix tranchés
- PayPal seul ne déclenche pas (Vinted accepte PayPal au paiement) : seulement « entre
  proches / amis et famille » ou `paypal.me`. « virement » dans une phrase qui nomme la
  plateforme (« le virement Vinted ») ne déclenche pas. Remise en main propre (Leboncoin)
  ne déclenche pas. Un numéro de portable déclenche aussi sur Leboncoin (demande de
  Julien : « numéro de téléphone ») — c'est une alerte, rien n'est bloqué.
- Le compteur compte les conversations dont le DERNIER message (aperçu) est un motif
  prouvé de l'autre : ce qui est lu, pas plus (une conversation pas ouverte dont un
  ancien message était suspect n'y est pas — la bannière la dira à l'ouverture).

## Preuves
- `node scripts/audit-anti-arnaque.cjs --prouve` : 34 vrais positifs, 28 messages
  normaux (« je paie via Vinted », n° de suivi 13 chiffres, point relais, lien vinted.fr,
  code de retrait, code promo…), qui-a-écrit, 5 langues, branchement, bannière sans
  action ; mutation : chaque motif désactivé ⇒ ses vrais positifs rougissent ; lire SES
  messages ⇒ M rougit.
- Banc `scripts/bancs/anti-arnaque.cjs` (données inventées) : liste Vinted (compteur 1,
  pastille sur la seule conversation de l'arnaqueur ; SA conversation avec WhatsApp + 06
  sans alerte), fil ouvert (codeSms en tête, horsPlateforme gardé, lien vers
  vinted.fr/inbox, ambre), Tous (compteur 1 = Leboncoin, bannière paiementHors), aucune
  commande ni écriture, 390/1512 clair et sombre. **Mutation du banc** : build où SES
  messages Vinted comptent comme ceux de l'autre ⇒ C rouge (302, 1512 et 390).
- Captures regardées (390 sombre, 1512 clair, fil Leboncoin 390) : bannière ambre lisible,
  rien ne déborde. Le navigateur du banc est en anglais : les textes `en` s'affichent.
- Audits verts : variables, tdz, coherence, identite, icones, textes-courts,
  fonctions-api, secrets, quoi-de-neuf, traduction, fil-unique, anti-arnaque --prouve.

## Limite connue
Dans « Tous », une ligne Vinted porte l'aperçu de la BOÎTE (auteur pas su, `filUnique`
`deMoi: null`) : elle n'est donc jamais comptée ni marquée là (la bannière s'affiche
bien à l'ouverture du fil). La rendre comptable demanderait de passer à `convVinted`
l'auteur prouvé du fil capté (`extraitConversation` … `de === 'eux'`) — pas fait.

## ÉTAT À LA REPRISE
Livré et poussé sur `claude/anti-arnaque` (merge `origin/main` fait, à jour). Pas de PR
(consigne du lot). Geste de Julien : aucun.
