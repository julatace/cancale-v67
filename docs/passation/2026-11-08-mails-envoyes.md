# 8 nov. (nuit) — Les e-mails que VRM envoie : un gabarit soigné

Demande de Julien (8 nov., 23 h 40) : « Fais des beaux mails à envoyer. » Le SMTP est
branché (Brevo, `VRM <noreply@vrm.center>`, DKIM/DMARC). Les modèles d'authentification
Supabase (`supabase/templates/*.html`) sont faits par une AUTRE branche
(`claude/recuperation-mails`) : pas touchés ici.

Branche : `claude/mails-envoyes` (pas de PR, pas de merge).

## 1. Inventaire mesuré (grep `envoyerSmtp`, `RELANCES_SMTP`, `gabaritEmail`, `html:` dans `api/`)

| e-mail | fichier | déclencheur | canal | facultatif ? |
|---|---|---|---|---|
| Essai gratuit j1 « Bienvenue » | `api/_lib/relances-essai.js` `texteRelance('j1')` | cron du matin (`api/ship-reminders.js` → `passageRelances`), jour 1-2 de l'essai | `RELANCES_SMTP_*` | oui (désinscription signée + « Gérer mes e-mails ») |
| Essai gratuit j3 « ce qui n'est pas relié » | idem `j3` | cron du matin, jour 3-5 | idem | oui |
| Essai gratuit j6 « se termine demain » | idem `j6` | cron du matin, la veille de la fin | idem | oui |
| Bilan du mois | `api/_lib/bilan-mois.js` `texteBilanMois` / `bilanMoisVendeur` | cron du matin, du 1er au 7, si ACTIVÉ (Réglages → Notifications) | idem, 150/jour au plus | oui |
| Lien de preuve d'adresse | `api/_lib/preuve-adresse.js` `emailConfirmation` | écrit par `api/email-inbound.js`, ENVOYÉ par le script Gmail (`scripts/gmail-forwarder.gs`, `GmailApp.sendEmail(…, {htmlBody})`) | boîte Gmail de VRM | non (transactionnel) |
| Facture / avoir Pro à l'acheteur | `src/facturePro/regle.js` `emailFacture`, envoyé par `api/_lib/facture-pro.js` | clic du vendeur « Envoyer » | `RELANCES_SMTP_*` (« X via VRM », vendeur en copie) ou SA boîte | non (transactionnel, vouvoiement, nom du VENDEUR en tête) |
| Essai de SA boîte d'envoi des factures | `api/_lib/facture-pro.js` `mailBoiteEssai` | clic « Essayer » (Ma facture → Envoi) | SA boîte, vers elle-même | non |
| **Nouveau** : e-mail d'essai VRM | `api/_lib/mail-essai.js` | clic « M'envoyer un e-mail d'essai » (Réglages → Notifications) | `RELANCES_SMTP_*` | non |

Pas des e-mails (vérifié) : les alertes de plantage groupées (`api/_lib/alertes-plantages.js`,
`veille-plantages.js`), l'alerte « compte pas relu » (`garde-capture.js`) et les signalements
partent en **notification push**, pas par e-mail.

## 2. Le gabarit : `api/_lib/mail-gabarit.js` (aucune fonction serverless de plus)

Remplace `api/_lib/gabarit-email.js` (supprimé ; même contrat d'appel, `gabaritEmail` reste
un alias). Tables, styles en ligne, largeur 520, préentête caché, logo
`https://vrm.center/vrm-logo-v5-192.png` (texte de remplacement « VRM », jamais un lien),
titre, paragraphes, liste à puces bleues, tableau de chiffres alignés (`tabular-nums`, la
note SOUS le chiffre pour ne pas écraser le libellé à 390 px), UN bouton bleu `#0071e3`
(44 px, `#0a84ff` en sombre), puis sous un filet : lien en clair de secours, pourquoi on
reçoit ce mail, « Ne plus recevoir », « Gérer mes e-mails »
(`https://vrm.center/?tab=settings&section=notifications`, ouvre Réglages → Notifications —
`src/App.jsx` lit maintenant `section=notifications`) pour un e-mail FACULTATIF, et
l'identité de l'éditeur SEULEMENT si `public/legal/editeur.js` est rempli (aujourd'hui tout
est `null` ⇒ rien n'est écrit). Mode sombre : `color-scheme` + `prefers-color-scheme` en
`<style>` (Apple Mail, iOS) ; ailleurs le clair en ligne s'applique. Texte brut fabriqué du
même contenu (multipart). Tout est échappé ; une URL non http(s) n'est jamais posée dans un
lien. Français seulement (VRM reste sur la France). La métadonnée `langue: 'en'` de l'autre
agent n'est PAS lue : ces e-mails restent en français (traduire bilan et essai n'est pas
trivial et contredirait §3 « International »).

Facture Pro : marque = le NOM du vendeur (pas le logo VRM), aucun bouton, son texte
inchangé (le texte brut reste exactement le sien — l'aperçu de l'app ne bouge pas).

## 3. Ce qui a changé dans chaque e-mail (aucun chiffre, règle, destinataire ni déclencheur changé)

- Sujets courts : « Bienvenue sur VRM : ton premier geste », « Ce qui n’est pas encore
  relié à VRM », « Ton essai VRM se termine demain », « Ton bilan d’octobre 2026 »,
  « Confirme ton adresse de réception VRM » (garde « confirme ton adresse », que
  `email-inbound.js` reconnaît), « Essai d’envoi de tes factures », « Ton e-mail d’essai VRM ».
- Défaut corrigé (j3) : un compte dont TOUT était « pas su » recevait le sujet « VRM — tout
  est relié » ; il reçoit « Où en est ton compte VRM » (comme son titre).
- Défaut corrigé (bilan, §5) : un bénéfice PARTIEL nul s'écrivait « au moins 0,00 € » ; il
  s'écrit « — » comme vendu et reçu. Couverture affichée : « sur 4 ventes de 6 · 2 prix
  d’achat manquent » ; complet : « vente − prix d’achat, sur 23 ventes ». « pas su » du reçu
  devient « versements pas lus ».
- Défaut corrigé (smtp.js) : un nom d'expéditeur avec `< > " , ;` (« Boutique <x> via VRM »)
  partait brut dans `From:` et cassait l'adresse ; il part toujours encodé (`nomEncode`).
- Essai de la boîte des factures : avait un texte seul, a maintenant le HTML du gabarit.

## 4. « M'envoyer un e-mail d'essai » (Réglages → Notifications)

Il n'existait pas (il y a un « Envoyer un e-mail d’essai » dans « Ton adresse VRM », mais
c'est un `mailto:` VERS son adresse de réception, l'inverse). Ajouté :
`POST /api/compte?mode=mail-essai` (route existante `api/compte.js`, aucune fonction de plus) :
session exigée, adresse = celle DU COMPTE confirmée (`adresseDuCompte`), jamais une adresse
du corps ; 3 par heure, compteur `mail_essai_{uid}` sous le propriétaire NEUTRE
(comparer-et-échanger, `modifierNeutre`) ; pas configuré / base muette / adresse non
confirmée ⇒ rien ne part et l'écran le dit. Composant `MailEssaiSetting` (`src/ecrans/Reglages.jsx`).

## 5. Preuves

- `node scripts/audit-mails-envoyes.cjs` — 92 verts. EXÉCUTE chaque fonction d'envoi
  (`bilanMoisVendeur`, `envoyerMailEssai`, et les textes de l'essai, de la preuve, de la
  facture passés par le VRAI `envoyerSmtp`) contre un faux serveur SMTP local, relit le MIME :
  texte + HTML, `<script>` échappé (pseudo, titre de vente, nom d'acheteur, message), aucun
  « encaissé », aucun « 0,00 € » pour « pas su », un seul bouton, préentête/520/sombre, logo,
  « Gérer mes e-mails » seulement sur les facultatifs, mentions seulement remplies, 3/h.
- `--mutations` : 8/8 détectées (échappement des chiffres retiré, URL de bouton non vérifiée,
  bilan pas facultatif, « au moins 0 » réautorisé, plafond 30/h, 2e lien dans le corps, nom
  d'expéditeur brut, mentions inventées).
- Sur `origin/main` (arbre `git archive`, avec un alias `mail-gabarit.js → gabarit-email.js`) :
  27 rouges, dont de VRAIS défauts : `javascript:` posé dans un lien, « au moins 0,00 € »,
  `From: Boutique <script>… via VRM <…>`.
- Audits verts : relances-essai 31, bilan-mois 48, facture-pro 95, preuve-adresse 56,
  fonctions-api, urssaf, vendeur-neutre 21 ; `npm run build` OK.
- Aperçus : `node scripts/mails-apercus.cjs <dossier>` (données de démonstration inventées),
  9 e-mails × 390/600 px × clair/sombre = 36 captures, regardées en deux tours (tour 1 : note
  écrasée à 390 px → passée sous le chiffre ; « ne plus recevoir » sans majuscule après un
  point ; guillemets coupés en fin de ligne → espaces insécables).

## Geste de Julien

Réglages → Notifications → « M’envoyer un e-mail d’essai » pour voir un vrai e-mail.
(Remplir `public/legal/editeur.js` fera apparaître l'identité de l'éditeur au pied.)
