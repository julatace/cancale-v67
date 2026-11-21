# 6 novembre — Facture Pro : le bon acheteur prouvé, le bouton sur la vente, « Ma facture », l'envoi par VRM

Branche `v36-facture-pro` (depuis `claude/project-review-nsk5su`), **non poussée**.

## Les demandes

Julien (6 nov.) : « Là j'ai mon compte pro, j'ai des ventes ; je veux avoir à côté le bouton pour envoyer la
facture à l'acheteur car on a toutes ses infos ; tu dois relier avec l'heure de la vente pour être sûr d'envoyer
à la bonne personne. Je veux un endroit où on met toutes ses infos et on peut visuellement voir à quoi elle va
ressembler pour tous les futurs acheteurs. »

Puis sa décision : « Ça peut être VRM qui envoie et met en copie le vendeur. »

## Mesuré sur la vraie base (lecture seule, SELECT, chiffres et noms de champs seulement)

| quoi | mesure |
|---|---|
| ventes Pro (`email_sale_*`, `pro:true`) | **10** |
| … avec un n° de transaction | **10/10** (aussi e-mail et adresse d'acheteur : 10/10) |
| champs d'un `email_sale_*` Pro | `account, adresse, designation, email, nomComplet, numero, prix, pro, pseudo, receivedAt, transaction, type, uid` |
| brouillons `email_invoice_tx*` | **10**, tous `draft`, **0 émis, 0 envoyé** ; **5** numérotés (les anciens FA-2026-0001…0005), 5 sans numéro |
| … même e-mail / même nom / même prix que l'e-mail de vente de SA transaction | **10/10** chacun ; formulaire de retour joint : 10/10 |
| compteur `vrm_invoice_counter` | **5** (l'ancienne forme : un nombre) ⇒ la prochaine facture neuve est la **0006** |
| boîte d'envoi du vendeur (`facture_boite`) | **absente** (aucune boîte connectée) |
| fiche `vrm_pro_facture` | nom, SIRET, adresse, code postal, ville **vides** ; forme et régime de TVA **absents** ; préfixe et l'ancien `tauxTva` remplis |
| file d'envoi de l'ancien circuit (`status=queued`, `mode=factures` du script Gmail) | **0** ligne : depuis le 2 nov. plus rien n'est mis en file ; une facture ne pouvait donc PAS partir |
| `harvest_199082413_orders_sold` (compte Pro) | 2 000 ventes, ~190 Ko, `transaction_id` = **nombre**, `price` = `{amount, currency_code}`, `date` ISO |
| rattachement des 10 ventes Pro | **10/10** : UNE seule vente Vinted à ce n° (tous comptes du vendeur), même compte |
| écart « e-mail reçu − heure de la vente Vinted » | **33 à 118 s**, toujours APRÈS (médiane ≈ 70 s) |
| montant e-mail = montant Vinted | **10/10** au centime |
| ventes non Pro avec un n° de transaction | 11 (aucune facture : pas Pro) |

## La règle de rattachement (`src/facturePro/rattachement.js`, la même dans l'app et le serveur)

Une facture n'est rattachée à une vente **que par le n° de transaction** :
1. une seule vente Vinted (`orders_sold`) porte ce n° (deux comptes ⇒ rien) ;
2. un seul acheteur dans les e-mails de vente Pro qui portent ce n° (le même e-mail reçu deux fois = un ;
   deux acheteurs ⇒ rien) ;
3. **contrôles** (ils ne relient rien, ils refusent seulement) : même compte Vinted ; **heure** : e-mail arrivé
   entre **2 min avant** et **15 min après** l'heure de la vente (pire écart mesuré 118 s ⇒ ~7 fois de marge ;
   2 min d'avance pour des horloges qui ne s'accordent pas à la seconde) ; **montant** identique au centime, en
   euros ; brouillon de facture : même n°, même adresse d'acheteur ;
4. l'acheteur a un nom, une adresse, un e-mail valide.

Jamais par pseudo, jamais par titre. Un manque ⇒ **pas de bouton**, la ligne dit « acheteur pas prouvé : … »
(l'écart d'heure, les deux prix, « deux e-mails… », « aucun e-mail de vente Pro… »).

Le **serveur relit lui-même** la preuve (`lirePreuve` : e-mails Pro par n° en scalaires, `orders_sold` filtré
par n° avec `cs`, jamais `select=data`) à l'émission ET à l'envoi ; l'acheteur, le prix et la date de la facture
viennent de cette preuve, jamais du navigateur. Une facture garde sa preuve (`preuve`) ; sans elle, VRM ne
l'envoie pas.

## Ce qui a changé

- **Ventes** : sur la LIGNE de chaque vente d'un compte Pro, « Envoyer la facture » (prouvée) ou la raison
  (non prouvée) ; « Facture envoyée le … » une fois partie. La fiche de la vente dit la même chose.
- **La feuille** (SheetShell) : destinataire (nom, e-mail), pourquoi c'est lui (n°, écart, montant),
  désignation modifiable, prix lu, l'e-mail (de, objet, message, pièce jointe), l'aperçu exact (même instantané
  que le PDF) ; « Envoyer la facture » (confirmé) ou « Émettre sans envoyer » ; ensuite l'état, le **journal
  des envois** (date, heure, destinataire caché en mode stream, chemin), « Renvoyer » confirmé, « Annuler par
  un avoir ». Un envoi impossible : le bouton dit le geste et y mène (ajouter son e-mail, connecter sa boîte…).
- **« Ma facture »** (Comptabilité → Factures, le bouton s'appelait « Facturation Pro » — même écran, pas de
  doublon) : formulaire à gauche, **aperçu en direct** à droite (≥ 1000 px), dessous à 390 px avec « Voir
  l'aperçu ». L'aperçu se dessine même incomplet : chaque mention obligatoire manquante y est écrite « … : à
  compléter » (ambre) ; « Mentions obligatoires : N sur 14 ». Champs ajoutés : mentions de paiement,
  « RCS ou RM », le choix de l'envoi ; la numérotation affiche le **prochain n°** lu au compteur.
- **Envoi par VRM (défaut, décision de Julien)** : SMTP de VRM (`RELANCES_SMTP_*`, `RELANCES_EXPEDITEUR`,
  les mêmes variables que les e-mails de l'essai, `api/_lib/relances-essai.js` — pas de nouvelle fonction,
  pas de clé nouvelle) ; From « <vendeur> via VRM » <adresse de VRM>, **Reply-To = l'e-mail du vendeur**,
  **Cc = le vendeur**, To = l'acheteur prouvé ; texte + HTML ; Message-ID, Date ; **pas** de
  List-Unsubscribe (transactionnel) ; PDF (et formulaire de retour Vinted) joints. Garde-fous : un envoi =
  son clic confirmé ; **plafond 50 factures / jour / vendeur** (réservé avant l'envoi) ; SMTP de VRM absent ⇒
  rien ne part (la carte nomme les variables au propriétaire seulement) ; « en cours » écrit AVANT d'envoyer,
  écriture ratée ⇒ rien ne part ; trois issues (envoyée · pas envoyée · incertaine). L'option « depuis ma
  propre boîte » (2 nov.) reste, au choix dans « Ma facture ».
- **Numérotation** : inchangée (séquence continue par vendeur, comparer-et-échanger + journal, une facture
  émise ne change plus, avoir AV-… pour corriger) ; vérifié en plus : un numéro annulé par un avoir n'est
  jamais redonné.
- `api/_lib/smtp.js` : `cc` (en-tête + RCPT) et `replyTo`.

## Mentions obligatoires (vente de biens d'un micro-entrepreneur à un particulier)

Vérifiées contre les textes : Code de commerce **L441-9** ; CGI **art. 242 nonies A** de l'annexe II ; CGI
**art. 293 B** (« TVA non applicable, art. 293 B du CGI ») ; CGI **art. 297 A / 297 E** (biens d'occasion :
aucune TVA écrite) ; Code de commerce **L526-22** et décret **2022-725** (« EI » accolé au nom). Fiches
officielles : service-public.fr « Facturation : mentions obligatoires »
(https://entreprendre.service-public.fr/vosdroits/F31808) et economie.gouv.fr « Quelles sont les mentions
obligatoires sur une facture ? »
(https://www.economie.gouv.fr/entreprises/gerer-son-entreprise-au-quotidien/gerer-sa-comptabilite-et-ses-demarches/factures-mentions-obligatoires).
⚠️ Ces deux sites n'étaient pas joignables depuis la session (réseau) : la liste suit les textes cités ; à
relire une fois. Les 14 mentions comptées (`MENTIONS_OBLIGATOIRES`) : n° unique, date d'émission, date de la
vente, nom (+ EI), forme, adresse du vendeur, SIREN/SIRET, immatriculation et capital (société), n° de TVA
(si assujetti), nom et adresse de l'acheteur, désignation-quantité-prix unitaire, total, TVA ou la mention qui
la remplace, date du paiement. L'envoi est refusé tant qu'une manque (fiche incomplète ⇒ pas d'émission).

## Délivrabilité et limites (geste de Julien)

- Le domaine de `RELANCES_EXPEDITEUR` doit avoir **SPF et DKIM** chez le fournisseur SMTP (Brevo : adresse
  d'expéditeur vérifiée, domaine authentifié) — `docs/ouvrir-aux-clients.md` §2b. Sans cela, les factures
  tombent en indésirables.
- **Brevo gratuit : 300 e-mails / jour pour toute l'installation** (factures + e-mails de l'essai + liens) ; le
  plafond VRM de 50 / jour / vendeur ne protège qu'un vendeur à la fois.
- §2.9 : c'est le serveur d'envoi de VRM qui sert les autres vendeurs — décision explicite de Julien (6 nov.),
  sur l'offre gratuite ; à revoir si le volume dépasse.

## Preuves

| contrôle | résultat |
|---|---|
| `scripts/audit-facture-pro.cjs` | **95 verts** (48 → 95 : R1-R10 règle, V1-V13 route et envoi par VRM, M10-M14 aperçu et mentions, N10) |
| … sur l'arbre d'avant (`eeac9f1d`) | **rouge** (la route d'avant numérote une vente sans preuve, l'audit lève) |
| … 16 mutations (fenêtre 24 h, deux acheteurs, deux ventes, montant, acheteur du navigateur, émission sans preuve, envoi sans preuve, preuve pas relue, Cc retiré, Reply-To retiré, plafond retiré, SMTP pas vérifié, journal pas tenu, témoin de l'aperçu, mention 293 B, numéro sans CAS) | **16/16 rouges** |
| `scripts/bancs/facture-pro.cjs` (390 tactile et 1512, clair et sombre) | **128 verts** (captures regardées) |
| … sur l'arbre d'avant (dist d'avant) | **rouge partout** (390 clair et 1512 sombre : 7 scénarios sur 7 en échec — aucun bouton ni raison sur la ligne, pas de « Ma facture ») ; arrêté après deux passes |
| `bancs/reglages.cjs` (bouton renommé « Ma facture ») | 6 KO, **les mêmes 6 sur l'arbre d'avant** (préexistants) ; les contrôles « facturation Pro » passent |
| `bancs/compact.cjs` (preuve semée : `receivedAt` +60 s, `prix`, `uid`) | rouge AVANT la partie facture, **déjà rouge sur l'arbre d'avant** (« ligne repliée … photo 60×60 », puis « accueil compact ») — la partie facture n'a pas pu être jouée |
| `npm run build`, `audit-coherence`, `audit-identite`, `audit-fonctions-api` (12), `audit-secrets`, `audit-tdz`, `audit-routes-revue`, `audit-vendeur-neutre`, `audit-mentions-paiement` | verts |

## Gestes de Julien

1. Comptabilité → Factures → **Ma facture** : nom, SIRET, adresse, code postal, ville, forme (EI), régime de
   TVA (franchise en général), **ton e-mail** (copie et réponses).
2. Vercel : `RELANCES_SMTP_HOTE`, `RELANCES_SMTP_PORT`, `RELANCES_SMTP_UTILISATEUR`,
   `RELANCES_SMTP_MOT_DE_PASSE`, `RELANCES_EXPEDITEUR` (Brevo conseillé, SPF/DKIM — §2b), puis redéployer.
3. Ventes : sur une vente Pro, « Envoyer la facture ». Les 5 brouillons déjà numérotés gardent FA-2026-0001…0005 ;
   la première facture neuve sera FA-2026-0006.
