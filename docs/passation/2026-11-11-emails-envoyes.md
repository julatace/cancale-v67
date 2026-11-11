# 11 nov. 2026 — Les e-mails que VRM envoie : lisibles sur téléphone (lot emails-envoyes)

Mission : « les e-mails que VRM envoie au nom du vendeur sont beaux et lisibles sur téléphone ».
Branche `claude/emails-envoyes` (pas de PR, pas de merge dans `main`). Aucun envoi réel, aucune
écriture en base, aucune donnée réelle : tout est jugé sur des données de démonstration inventées.

## Inventaire (mesuré par `grep gabaritMail|envoyerSmtp|htmlBody` dans `api/` et `src/facturePro/`)

Tous les e-mails que VRM envoie passaient DÉJÀ par un seul gabarit, `api/_lib/mail-gabarit.js`
(8 nov., `2026-11-08-mails-envoyes.md`) : essai j1/j3/j6, bilan du mois, lien de preuve d'adresse
(envoyé par le script Gmail), facture et avoir Pro (`src/facturePro/regle.js` `emailFacture`), essai
de la boîte des factures, e-mail d'essai de Réglages, avis avant suppression (`clients-partis.js`),
« compte supprimé » (`suppression-compte.js`). Le travail porte donc sur CE gabarit (et la facture).

**Pas des e-mails** (vérifié) : le résumé du soir (`resume-soir.js`), « Ma semaine » / le bilan de la
semaine et les autres notifications partent en **notification push**, pas par e-mail. Les modèles
d'authentification Supabase (`supabase/templates/`, envoyés par Supabase, fabriqués par
`scripts/modeles-email.cjs` et tenus par `audit-modeles-email`) ne sont pas touchés : ce ne sont pas
des e-mails « au nom du vendeur », et leur forme (520) est gardée par leur propre audit.

## Ce que Julien a demandé (relu avant de coder)

11 nov., lot DJ1 (`2026-11-11-facture-siret.md`) : **plus aucun pied** « Cette facture vous est
envoyée par VRM pour le compte de … » ; la réponse va au vendeur par **Reply-To**, sans le dire.
Donc dans la facture : **aucun mot « VRM »**, pas même une mention discrète « via VRM » en bas. Le nom
d'expéditeur « Boutique via VRM » (en-tête `From`, envoi par VRM) n'est pas du contenu et ne change pas.

## Ce qui change

### Le gabarit (`api/_lib/mail-gabarit.js`) — même contrat d'appel
- **Largeur 600** au plus (520 avant) ; une table « fantôme » `<!--[if mso]>` fixe la largeur sous
  Outlook Windows, qui ignore `max-width`. À 390 px la carte prend l'écran, rien ne déborde.
- **Aucune image** : le logo distant `vrm-logo-v5-192.png` (bloqué par défaut dans la plupart des
  boîtes : un carré vide) est retiré. L'en-tête est un MOT : « VRM » en petit gris pour ses propres
  e-mails, le **nom de la boutique** pour une facture ou un avoir (il se coupe s'il est long).
- **Texte ≥ 14 px** : corps 16, notes sous un chiffre 14 (13 avant), pied 14 (12 avant), phrase
  sous le bouton 14.
- **Contrastes AA** (4,5:1) en clair ET en sombre : gris doux `#636366` en clair (5,6:1 sur blanc ;
  `#6e6e73` avant), `#aeaeb2` en sombre ; le bouton garde `#0071e3` en sombre (le `#0a84ff`
  d'avant ne donnait que 3,6:1 sous un mot blanc).
- **Sombre** : `prefers-color-scheme` (Apple Mail, iOS, Outlook macOS) + les mêmes règles sous
  `[data-ogsc]`/`[data-ogsb]` (Outlook.com). Gmail inverse lui-même : les couleurs restent lisibles.
- **Liens https seulement** (`urlSure`) : une adresse http n'est jamais posée (le bouton disparaît,
  rien d'autre).
- `lang` (paramètre `langue`, « fr » par défaut), `format-detection` (iOS ne transforme plus un
  numéro de facture en lien téléphone), `word-break` sur le titre et le nom de la boutique.

### La facture et l'avoir (`src/facturePro/regle.js`)
Sous le message du vendeur, un petit tableau : **Numéro** et le **montant de la dernière ligne du PDF**,
avec le même libellé (« Net à payer », « Total TTC », « Total à payer », « Montant à rembourser »…,
traduit par la table du PDF quand la facture est bilingue) — fonction `totalDocument`, qui lit
`contenu.totaux.ttc` sans rien recalculer ; un total illisible ⇒ la ligne n'est pas écrite (jamais
« 0,00 € »). Puis « Pièce jointe : Facture-FA-2026-0007.pdf ». Aucun bouton (le document EST la pièce
jointe), rien de VRM.

**Le texte brut de la facture reste exactement SON message** (c'est ce que montre l'aperçu
« Message » de l'app, et `audit-facture-en-tva` F15 l'exige) : le numéro est dans le sujet et dans son
message par défaut, le montant est dans le PDF joint. Seul le petit tableau est propre au HTML. À
trancher par Julien s'il veut aussi le montant dans la version texte.

## Preuves

| contrôle | résultat |
|---|---|
| `scripts/bancs/emails-envoyes.cjs` (NOUVEAU) — 15 e-mails fabriqués par les vraies fonctions (dont facture TVA, avoir, facture bilingue, un lien reçu en http) × 390/700 px × clair/sombre, rendus dans Chromium sans réseau : débordement, carte ≤ 600, texte visible ≥ 14 px, contraste ≥ 4,5:1 sur le fond réel, version texte et même titre, aucun lien http, aucune image ni requête au dehors, aucun script/`on…`, `lang`/une `<h1>`/tables `role="presentation"` ; facture : nom de la boutique en tête, aucun « VRM », montant + libellé du PDF, pièce jointe, aucun lien | **605 verts** |
| le même banc sur `origin/main` (arbre `git archive`) | **142 rouges** : texte 12–13 px (44), logo distant (44), contraste du bouton en sombre (18), facture sans montant ni pièce jointe nommée (32), lien http posé (4) |
| `--mutations` : pied en 12 px, bouton `#0a84ff` en sombre, logo distant, lien http accepté, « via VRM » dans la facture, montant retiré, gris trop pâle, carte rigide 640 px | **8/8 rouges** |
| `audit-mails-envoyes` (forme commune mise à jour : 600 + table Outlook, aucune image, mot « VRM » / nom de la boutique) | 92 verts ; `--mutations` 8/8 |
| audits `variables, tdz, coherence, identite, textes-courts, fonctions-api, secrets, xss-facture, facture-pro, facture-en-tva, factures-autres`, plus `facture-siret, preuve-adresse, relances-essai, bilan-mois, modeles-email` | verts |
| `npm run build` | vert |

Captures regardées (390 et 700, clair et sombre) : facture, avoir, facture bilingue, bilan partiel,
preuve d'adresse. Rien ne déborde, le sombre est lisible, le pied se lit.

Vu, pas changé (contenu métier) : le message par défaut d'un **avoir** dit « Vous trouverez ci-joint
la facture AV-… » (`MESSAGE_DEFAUT` sert aux deux) — à reformuler si Julien le veut.

## Geste de Julien
Aucun. (Réglages → Notifications → « M'envoyer un e-mail d'essai » montre la nouvelle forme une fois
`RELANCES_SMTP_*` posés.)
