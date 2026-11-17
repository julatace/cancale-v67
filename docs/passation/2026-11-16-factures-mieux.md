# 16 nov. 2026 — Lot factures-mieux : factures de vente, reçus d'achat, rapport comptable

Branche `claude/factures-mieux` (depuis `origin/main` c04cb5996), poussée à chaque commit.
Rien dans `vinted-sync-extension/`. Aucune nouvelle fonction `api/` (toujours 12), aucune migration.

## Ses mots (16 nov., captures iPhone ; données réelles des captures JAMAIS recopiées)

1. « Tu peux améliorer les factures et le procédé » — capture de l'e-mail reçu par un acheteur
   (Gmail sombre : l'anglais PUIS le français empilés, un encadré « Numéro / Number · Net à payer /
   Amount due », le tout dans le cadre bleu épais des e-mails de VRM) et de la feuille « Facture
   FA-… » dans Ventes (phrase longue, journal qui répète l'état).
2. « Fais les mêmes factures d'achat et améliore le visuel du reste » — Rapport comptable, liste
   des achats, PDF « Reçu d'achat » (accents manquants : « Recu », « deductible », « Etabli » ;
   achats écrits « 11.95 € » au point quand les ventes disent « 43,20 € »).
3. La feuille « Reçu d'achat » reconstruite depuis l'e-mail Vinted : « Je veux que ça soit comme
   ça » — pour TOUS les reçus.

## Ce qui a changé

### L'e-mail de la facture (`api/_lib/mail-facture.js`, nouveau ; `src/facturePro/regle.js`)
- **Une langue** (`langueEmail`) : l'anglais quand la facture est en anglais (son clic, ou la case
  pré-cochée pour une adresse prouvée à l'étranger), sinon le français. Plus jamais les deux empilés.
  La facture PDF en anglais reste BILINGUE (loi Toubon, `src/facturePro/anglais.js`) : seul l'e-mail
  parle une langue.
- **Forme sobre, à part** de la forme « Verre dépoli » des e-mails de VRM : fond blanc, le nom de la
  boutique (avec « EI ») sous un filet, un titre (« Votre facture »), SON message, un récapitulatif
  sur filets fins (n°, date d'émission, article, montant = la dernière ligne du PDF via
  `totalDocument(contenu, langue)`, mention de TVA de son régime `mentionTvaEmail` : art. 293 B,
  marge, ou « Dont TVA 20 % : … »), les pièces jointes NOMMÉES (le formulaire de retour aussi —
  `envoyer` passe les noms réels), ses coordonnées au pied (adresse, SIRET…, e-mail en `mailto:`).
  Aucune image, aucun lien http, rien de VRM, texte ≥ 14 px, 600 px + table fantôme Outlook, sombre
  par `prefers-color-scheme` et `[data-ogsc]` (Outlook.com). Texte brut alternatif complet.
- **Objet** : « Votre facture FA-… — boutique » / « Your invoice … » / « Votre avoir … », 60
  caractères au plus (le nom se coupe, jamais le numéro).
- L'aperçu « Message » de la feuille montre `mail.message` (SON texte), le reste est le récapitulatif.

### Le PDF de la facture (`src/facturePro/pdf.js`)
Relu en images avant/après. Avant : rien en haut à gauche sans logo, la date de vente, la nature
et la référence sur une ligne grise coupée. Maintenant : un **bandeau** à sa couleur (texte blanc :
type de document, son nom ou son logo sur pastille blanche, n°, date d'émission), le **montant en
grand**, vendeur | acheteur, la vente en étiquette | valeur, le tableau, les totaux, le paiement,
les mentions, le pied. Colonnes du tableau et colonne acheteur INCHANGÉES (audit-facture-mobile
P1-P8 vert : marges, chevauchements, désignation dans sa colonne, deux verticales de montants).
Aucune mention retirée (audit-factures-mieux L1 les relève une par une au dessin).

### Le parcours (`src/FacturePro.jsx`, textes par `tr()` 5 langues : `src/i18n/langues/*/factures.js`)
- Feuille d'une facture émise : l'état en UNE ligne (« Envoyée le 16 nov. à 16 h 01 · copie à
  toi »), dessous « À <acheteur> · formulaire de retour joint » ; UNE rangée de trois actions de
  même largeur (Voir · Partager · Renvoyer) ; l'historique replié SEULEMENT s'il a plus d'un envoi
  (un seul envoi = il répétait l'état) ; « Vente annulée ou remboursée ? » → « Faire l'avoir »
  (la règle de l'avoir existante, confirmée).
- Ligne de vente : UNE mention courte (« Facture envoyée le 16 nov. », le n° au survol).
- **Même facture par les trois chemins** : `langueFactureParDefaut` (anglais.js) sert la case de
  la feuille ET le serveur quand aucune langue n'est donnée (série Ventes → Sélectionner, « Tout
  envoyer », envoi automatique). Avant : la feuille pré-cochait l'anglais, la série et l'envoi auto
  émettaient en français.

### La facture en PASTILLE sur la ligne de vente (ajout de Julien : « pour facture envoyée, fais mieux »)
- Avant : sous la ligne, « Facture envoyée le 16/11/2026 » + « FA-… » + un gros bouton « Bon de retour »
  (ou « Envoyer la facture ») : la ligne doublait de hauteur.
- Maintenant : UNE pastille compacte (icône document + « Facturée » neutre, « Facture à envoyer » /
  « Facture à vérifier » en ambre — §7, un geste à faire), posée à droite de la ligne de l'état, sous la
  frise, en position absolue : **aucune hauteur ajoutée** (banc : hauteur de la ligne avec / sans la
  pastille, et aucun texte recouvert, mesuré au rectangle du TEXTE). La toucher ouvre la feuille de la
  facture (Voir · Partager · Renvoyer · **Bon de retour** · avoir). « Envoyer la facture » et « Bon de
  retour » ne sont plus sous la ligne : dans cette feuille et dans la fiche de la vente. Vente Pro pas
  prouvée : pas de pastille (la raison est dite en tête de la liste et dans la fiche).
- La pastille est un `<span role="button">` DANS la ligne (qui est un `<button>`) : ses événements et
  ceux de la feuille (portail) sont arrêtés à son hôte, la ligne ne s'ouvre pas en même temps.
- Coordination ventes-clair (#1202, pas encore fusionnée au moment de ce lot) : la pastille vit dans
  la frise (`friseEtat`), que #1202 ne touche pas ; seule la prop `frise` (qui portait l'ancienne
  facture) est vidée. À la fusion de l'un après l'autre, refusionner main : aucun conflit attendu sur
  la rangée l2 (non touchée).

### Le reçu d'achat (`src/recuAchat.js`, nouveau ; `src/ecrans/Achats.jsx` ; `src/App.jsx`)
- Le reçu GÉNÉRÉ d'après la commande (aucun e-mail Vinted) prend la forme du modèle : bandeau
  Vinted, « Reçu d'achat Vinted » + l'article en grand, « Montant payé » en très grand, Vendeur,
  Date, N° de transaction, Compte, N° de rangement. Dans l'app : la MÊME feuille que le reçu
  e-mail (`FeuilleRecuAchat`, `recu._genere`) ; son bouton PDF fabrique le PDF de la même mise en
  page. Un vrai reçu e-mail reste prioritaire (règle inchangée de l'appelant).
- **Rien d'inventé** : la commande ne dit ni le prix de l'article seul, ni le port, ni les frais
  Vinted, ni le moyen de paiement ⇒ (reprise du 16 nov., le modèle de Julien) les lignes **Article,
  Port, Frais Vinted et Mode de paiement restent à leur place avec « — »** (`LIGNES_DETAIL_INCONNU`,
  libellés par `tr()` dans la feuille), une phrase dit pourquoi ; vendeur inconnu « — » ; autre
  devise « — ».
- Pied : « Récapitulatif établi par VRM d'après la commande Vinted — ce n'est pas une facture
  émise par Vinted. » Mentions gardées (« pas de TVA déductible », marge, « Établi le »).
- **Accents** : Helvetica de pdf-lib écrit le WinAnsi (é, ç, à, —, €) ; le défaut venait du TEXTE
  tapé sans accents. Pas de police embarquée nécessaire (mesuré : le texte relevé porte « Reçu »,
  « déductible », « Établi ») ; ce qui n'est pas WinAnsi (espace fine d'Intl, emoji) est remplacé.
- Marge du haut : la pastille « 1 sur 1 » d'une visionneuse ne recouvre plus le titre.
- L'attestation de remboursement : accents, et sa phrase « pas une facture émise par Vinted »
  n'est plus tronquée à 74 caractères (coupée en lignes).
- La photo n'est plus sur le reçu (le modèle choisi n'en a pas).

### Le rapport comptable (`src/App.jsx`, `src/rapport-comptable.css`, `src/rapportPdf.js` nouveau)
- Lignes de ventes et d'achats homogènes (`.vrm-rapport-ligne`) : titre sur 2 lignes au plus, le
  détail dessous, le montant au format français `montant(…, { centimes: 'toujours' })` — les
  achats disaient « 11.95 € » (mois ET année corrigés). « achat — » devient « prix d'achat pas
  saisi ». Le reçu : un bouton de 44 px « Reçu ». En-tête : le statut en une ligne. Boutons
  « Tableur (CSV) » / « Document (PDF) ».
- Le PDF du rapport : bandeau encre, chiffre d'affaires en grand, rangées étiquette | montant,
  registres en tableaux aux montants alignés à droite, « 1 234,50 € » partout, accents écrits,
  pied sur chaque page. Les chiffres sont ceux de `report` (rien recalculé). Le CSV gardait déjà
  la virgule (`e()`).

## Preuves

| contrôle | résultat |
|---|---|
| `scripts/audit-factures-mieux.cjs` (EXÉCUTE regle/pdf/recuAchat/rapportPdf, texte relevé au dessin) | 26 ✅ |
| … `--prouve` : 7 mutations (deux langues empilées · 293 B retirée du PDF · montant retiré du récapitulatif · accent perdu dans le reçu · port inventé · montant à point dans le rapport · série en français forcé) | 7/7 rouges |
| `audit-emails-verre --prouve` (facture : forme sobre S1-S5, + mutations cadre bleu revenu, logo VRM, sombre retiré) | vert, 15/15 mutations |
| `audit-facture-en-tva` (F14-F16, B5 portés sur la règle : une langue, langue par défaut serveur) | 36 ✅ |
| `audit-justificatif` (pied dans recuAchat.js, accents écrits, plus de photo) | vert |
| `audit-facture-pro` 102 ✅ · `audit-mails-envoyes` 92 ✅ · `audit-facture-mobile` 40 ✅ · factures-pro-2, export-zip, factures-autres, facture-siret, xss-facture, config-facture, registres, traduction, coherence, variables, tdz, icones, quoi-de-neuf | verts |
| `scripts/bancs/factures-mieux.cjs` (e-mails rendus 390/700 × clair/sombre/Outlook) | voir « ÉTAT À LA REPRISE » |

Captures regardées (scratchpad de la session) : PDF facture fr/en/TVA avant/après, reçu généré,
rapport ; e-mails rendus.

## Ce qui reste

- La langue de l'e-mail n'est que fr/en : l'adresse prouvée garde le NOM du pays (le code à deux
  lettres est retiré par `adresseVintedLisible`) ; aucune forme réelle mesurée pour d'autres pays ⇒
  pas d'allemand/espagnol/italien deviné. Mesure à faire : la forme de l'adresse dans les e-mails
  Vinted Pro d'acheteurs DE/ES/IT.
- Un message PERSONNALISÉ du vendeur reste le sien (jamais traduit) : dans un e-mail en anglais,
  son texte français garde sa langue, le récapitulatif est en anglais.
- Les boutons « Reçu » du rapport comptable téléchargent le PDF (nouvelle mise en page) ; ils
  n'ouvrent pas la feuille (le rapport est lui-même une feuille).

## ÉTAT À LA REPRISE

Reprise du 16 nov. (soir, session youthful-wozniak) sur la branche existante :
- `git merge origin/main` (vrai merge ; CLAUDE.md : la ligne de la passation générale et celle du
  lot gardées, deux lignes du 15 nov. déplacées telles quelles dans `historique-divers.md`).
- ⚠️ Le commit 9f4c4f1e2 avait régénéré les 4 zips d'extension (même numéro, autre contenu : une
  version publiée ne change jamais) ⇒ remis à ceux de `main`.
- Reçu généré au modèle exact : Article / Port / Frais Vinted / Mode de paiement écrits « — »
  (avant : lignes absentes). `audit-factures-mieux` R1 + R6 nouveaux, ROUGES sur le code d'avant
  (archive du commit précédent), 10/10 mutations (+ « ligne Frais Vinted retirée », « paiement vide »).
  PDF relu en image (scratchpad, données inventées).
- Verts : build, audit-factures-mieux 29, emails-verre, facture-en-tva, justificatif, facture-pro,
  mails-envoyes, facture-mobile, achats-relier, chiffres, urssaf, traduction, coherence,
  quoi-de-neuf, tdz, icones, variables, xss-facture, factures-pro-2, export-zip, factures-autres,
  facture-siret, config-facture, registres.
- Banc `scripts/bancs/achats-relier.cjs` : rouge à l'étape B (`.vrm-ledger-sale-toggle` introuvable :
  les lignes de Ventes ouvrent désormais la fiche, décision du 16 nov.) — banc hors CI, périmé par
  la refonte de Ventes, pas par ce lot ; la feuille du reçu généré n'a pas de capture d'app dédiée
  (le PDF de même mise en page est regardé).

Reprise du 17 nov. (après pause) :
- `git merge origin/main` (après #1202 ventes-clair, #1209 tampons, #1216 argent) : la pastille reste
  dans la frise (`{friseEtat}{fusion.facture}`), hors des rangées refaites par #1202 ; la fusion avait
  doublé l'import de `tr` dans FacturePro.jsx (tdz rouge ⇒ corrigé) ; trois lignes anciennes du §9
  déplacées telles quelles dans `historique-divers.md` (CLAUDE.md < 60 000 octets).
- Verts après fusion : audit-factures-mieux, facture-en-tva, facture-pro, facture-mobile,
  emails-verre, justificatif, achats-relier, chiffres, urssaf, traduction, coherence, variables, tdz.
- Rouges des bancs hors CI DÉJÀ sur main (mesuré le 16 nov. sur l'arbre de main) : facture-pro 28,
  rapport 12, achats-relier 2 (navigation « Outils », bouton d'émission de la feuille, fiche 7004).
- Jugement : la CI de la PR #1218 contre celle du dernier commit de main.

## Geste de Julien

Aucun.
