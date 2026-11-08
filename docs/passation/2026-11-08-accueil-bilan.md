# 8 nov. 2026 — Page d'accueil qui vend, bilan du mois par e-mail, gestes pour 1 000 vendeurs

Branche `claude/accueil-bilan` (depuis `claude/amazing-lovelace-xd7obl`, puis un vrai `git merge` de
celle-ci). Pas de PR, pas de merge.

## 1. La page d'accueil (vrm.center, visiteur sans session)

`src/Accueil.jsx` refait (mode « Persuade », style Apple de VRM : police système, blanc/encre, bleu
`#0071E3` seulement sur le bouton principal, clair ET sombre selon le système).

- **Haut** : un seul `h1` — « Tes ventes, tes colis et ta compta, au même endroit. » —, une phrase,
  « Créer mon compte » / « Se connecter », la ligne du prix (« Gratuit pour l'instant, puis 16,99 € par
  mois après 7 jours d'essai gratuit · sans engagement ») et le prérequis (l'ordinateur, les navigateurs
  servis). Dessous, l'app sur ordinateur et sur iPhone.
- **La journée en 4 moments** (`#journee`) : le prochain geste chaque matin · colis à envoyer et à
  retirer (code de retrait visible) · numéros de rangement · compta et URSSAF. Sur ordinateur, un
  téléphone reste fixe et change d'écran au fil des chapitres ; ses captures ne se demandent qu'à
  l'approche de la section. Au téléphone, chaque chapitre porte sa capture.
- **Confiance + installation** (bande grise), **Prix** (la carte sombre, signature de VRM), **Questions
  fréquentes** en texte lisible (extension, blocage Vinted, sécurité, résiliation, téléphone, plusieurs
  comptes, autres articles, Vestiaire pas encore compté, aide et état du service), **fin** (une phrase,
  un bouton), **pied** (Aide, État du service `/statut`, CGV, CGU, Confidentialité, Mentions, Cookies,
  Contact depuis `src/contact.js`).
- Les boutons sont de vrais liens `/?inscription` et `/?connexion` (marchent sans script) ; avec script,
  `onEntrer` ouvre l'app sans recharger (comme avant).
- **Aucune preuve inventée** : pas de témoignage, pas de chiffre de clients, pas d'étoile. Chaque
  capture dit « Données d'exemple ».
- Le **prix** vient de `PRIX_MOIS`, l'**essai** de `ESSAI_JOURS` (nouveau, `src/accueil-reglages.js`) :
  le banc les compare aux CGV, à Stripe (`trial_period_days`) et aux relances (`DUREE_ESSAI_JOURS`).
- Le **film** (`?film`, `src/AccueilFilm.jsx`) est gardé tel quel ; il importe désormais lui-même les
  deux feuilles de style de l'ancienne page (`styles-accueil-studio.css`, `styles-accueil-vitrine.css`)
  que la nouvelle page n'importe plus.

### Les captures (vraies, en mode exemple)
`scripts/accueil-captures.cjs` ouvre l'app construite (`dist/`) en **mode exemple**
(`sessionStorage.vrm_mode_exemple`, données de `src/exempleDonnees.js`), coupe tout le réseau hors
localhost, fait les gestes réels (« À retirer », « Code », « Micro-entrepreneur », « Par mois »),
capture à 390 px (×2) et 1440 px, clair et sombre, en **WebP qualité 72 (35–53 Ko)**, et inscrit
l'empreinte de chaque fichier dans `public/accueil/captures.json`. Il REFUSE de capturer si le mode
exemple n'est pas actif. Linux n'a pas SF Pro : la police de l'app est remplacée par Inter le temps de
la capture ; le bandeau « Exemple » est retiré de l'image (la page écrit « Données d'exemple »).
Relancer : `npm run build && node scripts/accueil-captures.cjs`.

### Le banc (`scripts/bancs/accueil.cjs`, refait)
390 px (doigt) et 1512 px, clair et sombre : h1 / prix CGV / essai / prérequis / bouton dans le premier
écran ; avant défilement seules les captures du haut se chargent ; LCP < 2,5 s (local) ; captures
chargées, du bon thème, nettes (≥ 1,5×), **au registre** (empreinte = fichier produit en mode exemple),
WebP ≤ 80 Ko ; contraste 4,5:1 partout ; aucun texte < 12 px ; 44 px au doigt ; aucun débordement ;
bleu seulement en fond de bouton ; aucun violet ; ni l'app ni le film téléchargés ; rien lu en base ;
liens (CGV, confidentialité, aide, `/statut`, réécritures de `vercel.json` suivies) ; honnêteté (prix,
essai, aucun témoignage, Vestiaire seulement en question, aucune promesse refusée) ; mouvement réduit ;
boutons → bon formulaire ; personne d'autre ne voit la page ; poids ; film.
- Résultat : **168 verts, 1 rouge** — « le film est une fonction pure du temps », **déjà rouge sur la
  branche de départ** (vérifié dans un `git archive` de `claude/amazing-lovelace-xd7obl`), pas touché ici.
- Sur la branche de départ, le nouveau banc est rouge en masse (h1, essai, captures, liens…).
- Mutations vérifiées : `ESSAI_JOURS = '14'` ⇒ rouge ; une empreinte du registre changée ⇒ rouge.
- Captures regardées : 390 et 1512, clair et sombre, défilement réel du téléphone fixe.
- `impeccable detect` : seulement des conseils (tailles 14/19 px et rayon 8 px hors de l'échelle de
  l'app — la page publique a sa propre échelle de titres).

## 2. Le bilan du mois par e-mail

- `api/_lib/bilan-mois.js` : le 1er du mois (rattrapage jusqu'au 7), pour le mois écoulé borné à
  l'heure de Paris, un e-mail par vendeur **qui l'a activé** : Ventes, Vendu (jour de la vente), Reçu
  (jour du versement), Bénéfice brut, la plus belle vente (titre de SA commande Vinted), bouton
  « Ouvrir la Compta ». Ce n'est pas la sauvegarde refusée (§3) : aucun fichier, aucune donnée.
- **Mêmes règles que l'app** : vendu/reçu = `calculerBilan` du bilan de la semaine (miroir de
  `ventesFaites`/`ventesDeclarables`) ; bénéfice brut = la publication de Ventes (`vrm_benefice_jours`)
  cumulée par `beneficeDesJours`, **recopiée de l'app par script** dans `api/_lib/benefice-regle.js`
  (`node scripts/audit-bilan-mois.cjs --recopie`, jamais à la main). Partiel ⇒ « au moins » et le
  manque nommé ; pas su ⇒ « — » et la raison ; « au moins 0 » ne se dit jamais.
- **Éteint par défaut** : ligne `bilan_mois_choix` écrite par le SERVEUR seul (`/api/compte?mode=bilan-mois` :
  session depuis Réglages → Notifications « Bilan du mois par e-mail », ou le lien signé « ne plus
  recevoir » — page à un bouton, et le « un clic » RFC 8058). Éteint ⇒ rien n'est lu ni envoyé.
- **Canal existant** : le SMTP des e-mails de l'essai (`RELANCES_SMTP_*`, `RELANCES_EXPEDITEUR`),
  l'adresse DU COMPTE confirmée, le gabarit `api/_lib/gabarit-email.js` (nouvelle option `chiffres` : un
  tableau sobre, compatible avec les e-mails existants).
- **Plafond** : 300 e-mails/jour pour tout VRM (Brevo gratuit, `VRM_EMAILS_PAR_JOUR`) moins les e-mails
  de l'essai du passage, 150 au plus pour le bilan ; le reste le lendemain (1 000 bilans en 7 matins).
- **Jamais deux fois** : réservation `bilan_mois_envois` confirmée AVANT l'envoi ; refus SMTP ⇒ mois
  libéré ; « incertain » ⇒ pas refait. La réponse du cron ne porte que des états.
- Branchement : `api/ship-reminders.js` (`bilanDuMoisVendeur` dans `traiterVendeur`, part posée après
  `passageRelances`). Toujours 12 fonctions, toujours 2 crons. `bilan-semaine.js` rend en plus
  `vendu.meilleure` (montant, site, n° de transaction — jamais dans la réponse du cron).
- **Audit** `scripts/audit-bilan-mois.cjs` : 48 verts (miroir au jeton près, mêmes chiffres que l'app
  exécutée à côté sur une base inventée — bornes de Paris, versement, Leboncoin —, « au moins », « — »,
  éteint/illisible/hors fenêtre ⇒ aucune lecture, plafond avec 6 vendeurs en parallèle, réservation,
  refus, incertain, échappement HTML, jeton signé séparé de celui de l'essai, branchement). Rouge sur la
  branche de départ ; `--prouve` : 7 mutations, toutes rougissent.
- Audits passés : `audit-fonctions-api`, `audit-politique-hotes`, `audit-violet`, `audit-urssaf`,
  `audit-bilan-semaine`, `audit-relances-essai`, `audit-emails-html`, `audit-compte-email`,
  `audit-email-cle`, `audit-accueil-navigateurs`, `audit-accueil-demo`, `audit-lancement`,
  `audit-photos-vinted`, `audit-chrome-en-dur`, `audit-confiance`. `npm run build` vert.

## 3. Les gestes pour 1 000 vendeurs
`docs/gestes-1000-vendeurs.md` : 10 gestes ordonnés, où cliquer, coût mensuel (Vercel Pro 20 $/siège et
Brevo 300/jour gratuit puis Starter dès 9 $ lus sur les pages officielles ; Supabase Pro 25 $, frais
Stripe et boutiques gratuites marqués « à vérifier »).

## Gestes de Julien
- Aucun pour la page. Pour le bilan : poser `RELANCES_SMTP_*` + `RELANCES_EXPEDITEUR` (déjà attendu),
  puis l'allumer dans Réglages → Notifications pour l'essayer.
