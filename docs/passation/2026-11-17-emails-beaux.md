# 17 nov. 2026 — Les e-mails que VRM envoie : beaux, clairs, courts, pareils, dans ta langue (lot emails-beaux)

Demande de Julien : « Améliore les emails aussi ». Branche `claude/emails-beaux`. Aucun envoi réel,
aucune écriture en base, données inventées partout.

## Inventaire (grep `envoyerSmtp`, `gabaritMail`, `htmlBody` dans `api/`, `src/facturePro/`, `scripts/*.gs`)

| e-mail | fabrique | quand | canal | boutons |
|---|---|---|---|---|
| Essai j1 « Bienvenue » | `relances-essai.js` `texteRelance('j1')` | cron du matin, jour 1-2 de l'essai | `RELANCES_SMTP_*` | 1 |
| Essai j3 « ce qui n'est pas relié » | idem `j3` | jour 3-5 | idem | 1 |
| Essai j6 « se termine demain » | idem `j6` | la veille de la fin | idem | 1 |
| Bilan du mois | `bilan-mois.js` `texteBilanMois` | cron, du 1er au 7, si activé | idem | 1 |
| Lien de preuve d'adresse | `preuve-adresse.js` `emailConfirmation` | écrit par `email-inbound.js`, envoyé par le script Gmail | boîte Gmail VRM | 1 |
| E-mail d'essai | `mail-essai.js` `mailEssai` | son clic (Réglages → Notifications) | `RELANCES_SMTP_*` | 1 |
| Essai de SA boîte des factures | `facture-pro.js` `mailBoiteEssai` | son clic (Ma facture → Envoi) | SA boîte | 0 (rien à ouvrir) |
| Avis avant suppression (abonnement fini depuis 11 mois) | `clients-partis.js` `mailAvis` | cron | `RELANCES_SMTP_*` | 1 |
| Suppression demandée (30 jours) | `suppression-differee.js` `mailDemande` | son clic | idem | 1 |
| Compte supprimé (3 motifs) | `suppression-compte.js` `mailSuppression` | suppression faite | idem | 0 (plus de compte) |
| Facture / avoir Pro | `src/facturePro/regle.js` `emailFacture` | son clic « Envoyer » | VRM « X via VRM » ou SA boîte | 0 (le PDF est joint) |
| 6 modèles de compte (confirmation, invitation, code de connexion, changement d'adresse, mot de passe, réauthentification) | `scripts/modeles-email.cjs` → `supabase/templates/` | Supabase Auth | SMTP de Supabase | 1 (sauf réauthentification : le code) |

**Pas des e-mails (vérifié, rien changé)** : nouvel appareil / nouvelle connexion (`appareil-nouveau.js`),
rappels colis la veille et le jour J (`rappel-colis.js`, `retour-notifs.js`), rappels d'abonnement Stripe
(`abonnement-push.js`), résumé du soir, bilan de la semaine, invitations d'équipe (`vrm_equipe_inviter`,
sans e-mail de VRM) : ce sont des **notifications push**. Les reçus de paiement d'abonnement sont ceux
de **Stripe** (pas fabriqués par VRM).

## Ce qui change

- **Cinq langues** : `api/_lib/mail-textes.js` (pur, sans import) — une table par langue, les mêmes
  clés ; la langue est celle du COMPTE qui reçoit (`user_metadata.langue`, Paramètres → Langue).
  Lue par `adresseDuCompte` (crons : essai, bilan, avis, suppressions) et par `utilisateurDe`
  (routes : e-mail d'essai, boîte des factures, suppression) ; le lien de preuve range la langue
  dans la demande (`email-rattacher.js`) ; les cinq sujets de la preuve sont reconnus au retour
  (`SUJETS_PREUVE` dans `email-inbound.js`). Inconnue ⇒ français. **Le français reste mot pour mot
  celui d'avant.** La facture et l'avoir gardent la langue de l'ACHETEUR (PDF bilingue ou non) :
  rien n'y change, mentions légales comprises.
- **Montants** : français = la règle d'avant (`eurosFr`, espace fine) ; autres langues = la forme
  traduite de l'app (`Intl.NumberFormat`, euros, comme `monnaie` de src/i18n). Les manques NOMMÉS
  du bilan (« compte_x (lu le 28 oct.) ») sont des phrases françaises de `bilan-semaine.js` : dans
  une autre langue, l'e-mail dit « une partie n'a pas été lue, le détail est dans Compta ».
- **Bouton à toute épreuve** (`mail-verre.js` `boutonVerre`) : un `v:roundrect` VML pour Outlook
  Windows (même adresse, même mot), la forme HTML cachée à Outlook. Ailleurs rien ne change.
- **Qui envoie** : « Envoyé par VRM, ton outil de revente · vrm.center » au pied de chaque e-mail
  de VRM (jamais dans la facture d'un vendeur : décision du 11 nov.).
- **Sujets** : le bilan dit le vendu quand il est su en entier (« Ton bilan d’octobre 2026 :
  1 842,50 € vendus »), sinon le sujet d'avant ; tous ≤ 70 caractères dans les 5 langues.
- **« Compte supprimé »** dans une autre langue : la liste « ce qui a été fait » est refaite
  depuis les mêmes étapes (`faitDansLaLangue`) ; en français, la liste d'avant telle quelle.
- **Modèles Supabase** : fr/en → fr/en/es/it/de (`{{ if eq $l "en" }} … {{ else }}fr{{ end }}`),
  rendus par le vrai moteur Go (`scripts/outils/modeles-email-rendu.go`, 8 cas).

La forme « Verre dépoli » (choisie par Julien le 15 nov.) n'est pas changée.

## Preuves

| contrôle | résultat |
|---|---|
| `node scripts/audit-emails-beaux.cjs --mutations` (NOUVEAU) : 13 e-mails × 5 langues — forme commune, boutons (1 ; 0 déclarés), VML, texte brut, aucun pixel, montants tels quels et aucun autre, sujet ≤ 70, `lang`, aucun trou `{…}`, sujet/titre traduits, table des mots complète, qui envoie, « Gérer mes e-mails » sur les facultatifs | vert ; 13/13 mutations vues |
| le même audit sur `origin/main` | rouge (mail-textes.js absent) ; avec la seule table copiée : 55 « qui envoie » absent, 45 sans VML, 44 sujets/titres restés en français, 44 `lang`, montants pas dans la langue |
| `audit-modeles-email --prouve` (5 langues, 3 liens dont le VML, rendu Go fr/en/es/it/de) | vert, 12 mutations vues |
| `audit-mails-envoyes` (pied : 3 paragraphes avec la signature), `audit-emails-verre` (5 blocs) | verts |
| planche avant → après : `scripts/emails-planche.cjs --avant=<arbre main>` | regardée (600 clair, 375 sombre, 375 dans une autre langue) |

## Geste de Julien
Recoller les 6 modèles `supabase/templates/*.html` et leurs sujets (`sujets.json`, champ `sujet`)
dans Supabase → Authentication → Emails → Templates (sinon es/it/de restent en français pour les
e-mails de compte). Rien d'autre.
