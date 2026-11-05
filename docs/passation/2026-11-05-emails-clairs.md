# 5 nov. 2026 (soir) — Des e-mails « bcp plus clairs »

Branche `v32-emails-clairs` (depuis `origin/main` 3aaa2855), poussée, **pas de PR**.
Demande de Julien, mot pour mot : « améliore les mails ça doit être plus clair stp ça doit être
bcp plus clair stp ». Point de départ : l'écran « E-mails » livré le même jour
(`docs/passation/2026-11-05-onglet-emails.md`), regardé à 390 px.

## Ce qui n'était pas clair (constaté sur les captures du banc, données inventées)

1. **Défaut grave — la feuille de lecture du téléphone laissait voir la liste à travers le texte.**
   Cause mesurée : la feuille (`.vrm-boite-feuille`, portail) s'ouvrait par un FONDU D'OPACITÉ
   (`@keyframes vrm-boite-feuille { from { opacity: 0 } }`, 0,26 s). Pendant le fondu, l'opacité de la
   feuille vaut 0 → 1 : son fond est plein, mais la feuille entière est translucide. Mesuré dans le banc
   sur `origin/main` : opacité **0** à la première image, 15 à 18 images sur 30 transparentes.
2. La liste montrait les **sujets bruts** (« Bordereau d'envoi pour Nike Air Max 90 ») et une étiquette
   de rubrique (« Codes de retrait ») sur chaque ligne.
3. Une seule longue liste, sans jours.
4. Libellés techniques : « Compte (adresse de réception) », « Comptés sur tes 26 derniers e-mails »,
   « (arrivée dans VRM) ».
5. Dans la lecture, « Ce que VRM en a fait » venait après les en-têtes ; le corps affichait en texte
   les balises restées dans l'e-mail (`<img src=x onerror=…>`, `<b>`, `&lt;img…&gt;`).
6. Sur ordinateur, une fois la page défilée, le haut de la lecture (« Fermer ») passait sous la barre
   du haut (déjà le cas avant cette branche).

## Ce qui a été fait

### L'écran (src/BoiteEmails.jsx, src/boiteEmails.js, src/boite-emails.css)
- **Feuille opaque dès la première image** : plus aucun fondu d'opacité sur la feuille ; seul son
  contenu glisse (transformation), sur le fond plein du thème (`--vrm-bg` : `#F2F2F7` clair, `#000`
  sombre, avec repli écrit), `isolation: isolate`. Portail et `FermeAuRetour` inchangés.
- **Chaque ligne dit d'abord ce que c'est** (`titreSimple`, pur) : « Colis à retirer · Relais Tabac du
  Port · code 418 205 · avant le 9 nov. », « Vendu · Nike Air Max 90 · N°42 · bordereau prêt »,
  « Achat · reçu de commande · Nike Air Force 1 · 45,00 € », « Newsletter Vinted — rien à faire »,
  « Offre reçue · 30 € », « Colis en route », « Pas reconnu par VRM · à lire »…
  - **Rien n'est inventé** : chaque mot vient du résumé écrit au classement par les règles d'e-mail
    existantes (`api/_lib/resume-email.js`), la même source que « Ce que VRM en a fait »
    (`lectureEmail`). Un champ non lu n'est pas écrit (« code pas encore lu ») ; un e-mail classé
    avant le résumé (avant le 31 oct.) dit « détail non gardé » — jamais un détail tiré du sujet.
  - **§5** : un N° retrouvé par le TITRE (`nt`) n'est jamais écrit en tête de ligne.
  - Puis, plus petit : l'expéditeur avec le **logo du site** (`LogoSite` : Vinted, Leboncoin, eBay,
    Vestiaire — dessiné dans la couleur du texte ; une initiale neutre pour un transporteur), le
    compte, l'heure, le trombone, « à vérifier » en ambre. Le sujet d'origine reste dans la lecture.
- **Groupés par jour** (`groupesParJour`) : « Aujourd’hui », « Hier », « Mardi 3 novembre »
  (l'année si ce n'est pas la même), « Date non lue » en dernier.
- **Rubriques** : une rangée de pastilles de 44 px, chacune avec SON nombre (Tout compris quand tout
  est compté), qui défile sur une ligne au téléphone.
- **Libellés** : « Compte » ; la phrase de couverture n'apparaît que si les nombres ne disent pas tout
  (« Les nombres sont ceux de compte-deux. », « Les nombres ne comptent que tes 200 derniers
  e-mails. » — §5, un total partiel ne se présente jamais comme complet) ; « (arrivée dans VRM) »
  devient « transmis à VRM le … » dans la ligne discrète.
- **La lecture** : en haut, en gros, ce que c'est + les détails + LE bouton de l'action (« Voir le
  colis à retirer », « Voir le colis à envoyer », « Voir l’achat », « Voir le N°17 » — toujours par
  identité, `objetRelie` inchangé sur le fond) ; « À vérifier / Que faire » en ambre s'il y a lieu ;
  « Dans VRM : … » en petit. Puis « Message d'origine » : le sujet et le corps **nettoyé**
  (`retirerBalises` : balises, `<style>`/`<script>`, commentaires, balise coupée en fin de texte et
  entités qui cachaient une balise RETIRÉS, jamais affichés ni exécutés ; un « < » qui n'ouvre pas de
  balise reste). Puis les pièces jointes. Enfin « De · Reçu sur · date » sur une ligne discrète (12 px).
- **Ordinateur** : la colonne de lecture se colle sous la barre du haut (`top: 86px`) et défile seule
  si l'e-mail est long.

### Les e-mails que VRM envoie (api/_lib/gabarit-email.js, NOUVEAU — pas une fonction, 12/12)
Une seule forme : un **titre** qui dit ce que c'est, une ou deux phrases sur ce qu'il faut faire,
**un seul bouton**, le pied en petit ; le texte brut dans le même ordre ; tout échappé.
- Essai j1 « Bienvenue sur VRM » · j3 « 2 choses ne sont pas encore reliées » (liste, puis la date de
  fin) · j6 « Ton essai se termine demain » (et comment arrêter / reprendre) — bouton « Ouvrir VRM »,
  « ne plus recevoir ces rappels » seulement dans le pied (`api/_lib/relances-essai.js`). Les sujets
  et les règles (qui, quand, une fois, désinscription) sont inchangés.
- Lien de preuve d'adresse « Confirme ton adresse », bouton « Confirmer cette adresse », « Ce lien
  marche pendant 72 heures », « Ce n'est pas toi ? Ne fais rien » (`api/_lib/preuve-adresse.js`).
  Le format du lien est inchangé (le retrait des liens de preuve à la réception marche pareil).
- Facture Pro : l'e-mail d'essai (« VRM — essai d’envoi de tes factures ») était déjà une phrase
  claire ; le message à l'acheteur est SON modèle. Non touchés.

## Preuves (données inventées partout)
- `npm run build` vert.
- **Banc `scripts/bancs/boite-emails.cjs`** (horloge fixée au 5 nov. 2026 16 h 05 Paris) :
  **215 verts / 0 rouge** (390 tactile et 1512, clair et sombre, + mouvement réduit).
  Règles jugées : opacité de la feuille et de ses parents à CHAQUE image pendant 30 images après le
  toucher (toucher et mesure dans le même script), fond sans transparence, la feuille au-dessus de la
  ligne touchée, fond = celui du thème ; tête de ligne (premier élément, gras, plus grande que la
  ligne de l'expéditeur, le sujet brut sur aucune ligne, textes attendus depuis le résumé) ; logo /
  initiale, compte, heure ; groupes Aujourd’hui / Hier / Mardi 3 novembre ; pastilles 44 px avec leur
  nombre, une ligne, défilement ; aucune balise ni entité affichée, aucune exécutée ; ordre de la
  lecture (haut → message → pièces → ligne discrète ≤ 13 px) ; libellés techniques absents ; à
  1512 page défilée, « Fermer » et le titre visibles.
- **Sur `origin/main`** (arbre `git archive` de 3aaa2855, banc copié dedans, construit à part) :
  **123 verts / 52 rouges**, dont la feuille transparente (opacité **0** à la première image, 15 à 18
  images sur 30 transparentes) en clair ET sombre. À 1512, le contrôle « Fermer visible » lève sur
  l'ancien écran (il n'a pas de titre de lecture) : la fin de ces deux contextes n'est pas jouée, d'où
  un total plus petit.
- **Mutation** (code neuf + le fondu d'opacité remis sur la feuille) : **211 / 2** — exactement les
  deux contrôles d'opacité.
- **`audit-boite-emails` : 72/72** (11 contrôles neufs : balises, titreSimple, jours). Sur
  `origin/main` il plante (fonctions absentes). Mutations : balises non retirées ⇒ 1 rouge ; N° par
  le titre écrit ⇒ 1 rouge ; sujet pris pour un e-mail ancien ⇒ 1 rouge.
- **`audit-relances-essai` : 31/31** ; G6 neuf (un titre, un bouton d'action, désinscription en pied
  seulement, texte brut qui commence par le titre) rouge sur `origin/main`.
- Voisins verts : `audit-journal-emails` 58/58, `audit-email-formes`, `audit-preuve-adresse` 56/56,
  `audit-facture-pro` 48/48, `audit-coherence`, `audit-icones`, `audit-fonctions-api`.
- `fusion-echelle --verifier` : `boite-emails.css` dans l'échelle (rouge seulement sur 5 fichiers non
  touchés, déjà le cas sur `origin/main`).
- Captures regardées (clair, sombre, 390, 1512) : liste, lecture, bas de la lecture, compte choisi,
  extrait, et les cinq e-mails envoyés rendus à 390 px (avant / après).

## Ce qui reste
- Les mots de tête viennent du résumé gardé depuis le 31 oct. ; les e-mails plus anciens disent
  « détail non gardé » (pas de reprise rétroactive : il faudrait relire les `email_inconnu_*`, §4.4).
- L'expéditeur n'a un logo que pour les quatre sites servis (`public/brands/`) ; les transporteurs
  (Mondial Relay, Chronopost, Vinted Go…) ont une initiale : aucun logo n'est servi pour eux.
- Les chemins cités dans les rappels (Paramètres → Réglages → Notifications, Comptes liés,
  Abonnement ; E-mails → Relier ma boîte) sont ceux de l'app au 5 nov. : à revoir s'ils bougent.

## Geste de Julien
Ouvrir **E-mails** au téléphone, toucher un code de retrait : la feuille doit être opaque, avec
« Colis à retirer » en gros et « Voir le colis à retirer ».
