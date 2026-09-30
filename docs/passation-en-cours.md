# Passation en cours — prompt du 30 septembre 2026

> **Pour l'IA qui reprend** : lis `CLAUDE.md` en entier, puis ce fichier. Ici vit
> la demande COMPLÈTE de Julien (rien n'a été résumé au point de perdre une
> exigence), découpée en tâches, avec l'état de chacune. Mets l'état à jour et
> pousse après CHAQUE tâche (règle §2.1). Travaille sur une branche `claude/…`,
> PR, merge (autorisation §2.2).
>
> Légende : ⬜ à faire · 🟨 en cours · ✅ fait (commit) · ⛔ bloqué (raison) · 👤 geste de Julien

Lien donné par Julien : https://claude.ai/artifact/SUm7REcQLakN9dpvdafDJ5 — c'est
une **maquette d'accueil « VRM Cash · Menthe »** (CA du mois, « à virer 282 € »,
« en attente chez Vinted 1 944 € », puces Expédier / Retirer / Messages), PAS
l'ancienne conversation. Référence de style pour la future page d'accueil.
⚠️ Les **captures d'écran des messages Leboncoin** annoncées ne sont pas arrivées :
les redemander.

---

## A. Extension ↔ app (comme Vintex / l'extension « vines »)
- ⬜ A1. Clic sur l'icône de l'extension ⇒ ouvre directement l'app VRM : sur
  vinted.fr → onglet Vinted de VRM ; sur leboncoin.fr → onglet Leboncoin. Plus de
  panneau à utiliser sur Vinted : « c'est que sur l'app maintenant que l'on
  retrouve les données qui nous intéressent ». L'extension capte et envoie.
- ⬜ A2. Liaison extension ↔ app : on se connecte à l'extension avec les MÊMES
  identifiants que l'app (existe déjà en partie : popup.js, `vmrAuthEtat`). Les
  données vont au bon compte ; se connecter facilement à différents comptes.
- ⬜ A3. Sur vinted.fr, afficher le **N° de rangement de la paire à côté de la
  paire partout où elle apparaît** (ventes, annonces, etc.), sans l'écrire dans
  l'annonce. (Identité = item_id, jamais le titre — §5.)
- ⬜ A4. « Commande traitée » : un bouton (plutôt dans l'app) ; sur Vinted, la
  vente traitée est floutée / marquée « colis fait », et « tout générer / tout
  imprimer » ignore ces bordereaux.
- ⬜ A5. Multi-comptes : les actions (baisser prix, message aux favoris,
  republier) ne s'appliquent qu'au compte connecté dans l'onglet (garde §3). Quand
  on SÉLECTIONNE une action, ne montrer actifs que les éléments du compte chargé ;
  ceux des autres comptes floutés « ouvre ce compte avec l'extension ».
  Uniquement pendant qu'une action est sélectionnée.
- ⬜ A6. Extension : ne plus exposer le code (« les autres apps ne dévoilent pas
  leur code, on l'installe directement dans Chrome ») ⇒ publication Chrome Web
  Store (👤 compte développeur 5 $) + dépôt privé.

## B. Messages / offres aux favoris (comme Vintex)
- ⬜ B1. Julien installe l'extension Vintex ; capter son mécanisme d'envoi de
  messages / offres aux favoris et le reproduire. ⚠️ §3 : « Vinted ne dit jamais
  QUI a mis en favori » — mesuré. Si Vintex le fait, c'est qu'un endpoint existe :
  MESURER d'abord (mouchard `seen_urls` quand Vintex agit), ne pas deviner.
  Garde-fous anti-blocage (§3, `vanessa5723`) non négociables.
- ⬜ B2. Retirer « Répondre aux messages Vinted » des Réglages ; faire un ONGLET
  dédié (comme Vintex), orienté envoi de messages aux personnes qui ont mis
  l'article en favori.

## C. Leboncoin
- ⬜ C1. Vente Leboncoin : il faut dire que l'article est dispo puis générer le
  bordereau (pas instantané comme Vinted) ; il y a un **code / QR pour imprimer
  en locker**. Afficher ce QR à côté de la vente dans l'app ; le bordereau dans
  un onglet **Ventes Leboncoin**. (Attendre ses captures.)
- ⬜ C2. Vente captée (Air Max 1 olive) : quand l'argent est reçu l'annonce reste
  et on perd la trace ; la vente n'est pas catégorisée dans l'extension alors que
  l'argent est reçu. Corriger le suivi de statut des ventes LBC.
- ⬜ C3. Onglet « à publier » : pas intuitif ; pourquoi « annonce Leboncoin offre
  gratuit » ? Refaire.
- ⬜ C4. « Annonce Leboncoin non reliée » : afficher la photo + pouvoir la relier
  à un N° dans l'app. Le reste de la page « ne convient pas du tout » : refaire.

## D. Accueil / notifications (cloche en haut, à côté du verrou et des réglages)
- ⬜ D1. Centre de notifications plus clair.
- ⬜ D2. Retirer la carte « déclaration URSSAF » ; à la place, notification le
  1er de chaque mois pour la faire.
- ⬜ D3. Retirer « 25 offres reçues » (on les verra via la captation des messages).
- ⬜ D4. Retirer « 20 messages non lus ».
- ⬜ D5. « Vente à expédier » : seulement si VRAIMENT sûr qu'elle n'est pas
  expédiée (il a déjà reçu l'argent pour celle signalée). Revoir la règle.
- ⬜ D6. « Colis à retirer » : le lieu du point relais est souvent en bas du mail
  ou dans ses infos, l'app dit à tort qu'elle ne l'a pas. Mieux extraire.
- ⬜ D7. Notifications push : « très bien ». Mais à une vente, le « en transit »
  en petit dessous doit être pertinent et fiable.
- ⬜ D8. Renommer « push » en **« Notifications téléphone »**.

## E. Ventes
- ⬜ E1. Bordereau à côté de chaque vente (à côté du prix si possible), en plus
  de l'existant.
- ⬜ E2. Comptes pro : à côté, la facture générée par l'app pour la vente + bouton
  « envoyer la facture au client ».
- ⬜ E3. Pouvoir relier une vente à un achat Vinted + sa facture d'achat.
- ⬜ E4. Photo de l'annonce + toutes les infos à côté pour chaque vente ET achat
  (comme Vinted).
- ⬜ E5. Export CSV : ajouter à côté « format Excel / Numbers ».
- ⬜ E6. Litiges : les retirer des Outils (déjà dans « annulée », ce n'est pas un
  problème pour lui).

## F. Achats
- ⬜ F1. Achat en duo / lot sur Vinted : au clic, diviser le lot en articles
  distincts pour attribuer chacun à son annonce.

## G. Compta / fiscal
- ⬜ G1. Tout ce qu'on masque dans la compta ⇒ dans Réglages, onglets « Ventes
  masquées » et « Achats masqués ».
- ⬜ G2. Rapport comptable à améliorer impérativement : il liste les factures
  d'achat par paire mais seulement le montant global des ventes ⇒ détail des
  ventes (et rapprochement).
- ⬜ G3. Régime fiscal « société » : soit parfait (TVA, boosts, frais…), soit on ne
  garde que la micro-entreprise.
- ⬜ G4. Onglet Factures : simulation de facture (logo + toutes les infos légales
  requises) avec aperçu du résultat. La config facture des Réglages déménage dans
  l'onglet Factures.

## H. Annonces / comptes
- ⬜ H1. Onglet Annonces Vinted « le bordel » : la liste des comptes connectés
  va dans Réglages avec infos (email, etc.).
- ⬜ H2. Compte bloqué définitivement par Vinted : ses ANNONCES sortent des
  annonces en ligne, l'app propose de les republier sur un autre compte (s'il y
  en a), sinon garde les infos côté serveur. ⚠️ Les VENTES et ACHATS restent
  (argent reçu, à déclarer).
- ⬜ H3. Fiche d'une annonce : trop d'infos, mal organisée ⇒ beaucoup plus
  intuitive et simple.
- ⬜ H4. Comptes liés : champ numéro de téléphone par compte (multi-compte : savoir
  quels numéros ont servi).

## I. Colis
- ⬜ I1. « Les infos datent de 58 jours » : faux, trouver et corriger.
- ⬜ I2. Retirer « 1 imprime, colle, dépose et clique sur fait ».
- ⬜ I3. Imprimante classique/thermique prend trop de place ⇒ demander le format
  de découpe UNE fois à chaque nouveau type de bordereau capté ; l'app doit
  reconnaître les différents bordereaux (transporteurs ET variantes d'un même
  transporteur), et demander l'emplacement pour thermique ET normal.
- ⬜ I4. Retirer « où aller déposer les colis ».
- ⬜ I5. Bordereaux captés sans vente correspondante : ne pas les afficher ;
  attendre la capture Vinted, les emails ne servent que de sécurité.
- ⬜ I6. Les bordereaux disparaissent quand la vente est expédiée.

## J. Réglages divers
- ⬜ J1. « Mes adresses de réception » : demander à la création du compte ou à la
  connexion d'un nouveau compte Vinted ; ou deviner via l'email du compte Vinted.
- ⬜ J2. Retirer la rédaction d'annonces par l'IA.
- ⬜ J3. Widget : pas convaincu pour l'instant (à revoir / garder discret).

## K. Bugs
- ⬜ K1. Sur ordinateur, impossible de défiler VRM au pavé tactile (obligé
  d'utiliser la barre de défilement). Anormal : corriger.

## L. Stock (ex-Garage)
- ⬜ L1. Renommer « Garage » en **« Stock »**.
- ⬜ L2. Beaucoup plus simple : ranger vêtements, chaussures, montres, tout objet ;
  étages, étagères, par terre, boîtes numérotées ; un « jeu vidéo » pour
  retrouver ses articles plus vite que dans la vraie vie.

## M. Statistiques
- ⬜ M1. Plus de graphiques / représentations 3D (ex. la marque / le logo le plus
  vendu en 3D).

## N. Ensuite, dans cet ordre (après A→M « parfaitement »)
- ⬜ N1. Isolation des données + début du multi-utilisateurs : une extension et
  une adresse email appartiennent à UN compte, lui seul reçoit les infos, aucune
  fuite. Regarder les alertes de vulnérabilité envoyées par Supabase.
- ⬜ N2. Coût pour 200 utilisateurs (Supabase, Vercel…) : l'abonnement actuel
  suffit-il ?
- ⬜ N3. Connexion Google, etc.
- ⬜ N4. Stripe + paiements.
- ⬜ N5. Page d'accueil (« minable ») à refaire — cf. maquette ci-dessus.
- ⬜ N6. Deux environnements : PROD stable (utilisateurs) et BÊTA qui bouge ;
  pareil pour l'extension.
- ⬜ N7. Privatiser le code GitHub (👤 Settings → Danger zone → Change visibility).
- ⬜ N8. Maquettes de motion design pour le site.

---

## Journal de cette session
- 30/09 : prompt reçu, découpé ici.
