// ═══════════════════════════════════════════════════════════════════════════
// « QUOI DE NEUF » — les nouveautés de VRM, versionnées dans le dépôt (11 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « plus beau, simple, surtout PRATIQUE ». Après une mise en ligne, une
// petite carte en haut de Ma journée (« Nouveau · 3 nouveautés »), JAMAIS une
// fenêtre bloquante ; elle s'ouvre en feuille : une ligne par nouveauté, « Voir »
// mène à l'écran, « Tout vu » la range. Aussi dans Paramètres → Aide → « Quoi de neuf ».
//
// ⚠️ RÈGLE POUR LA SUITE (CLAUDE.md §9) : chaque lot VISIBLE ajoute SA ligne en
// tête de `NOUVEAUTES` — `scripts/audit-quoi-de-neuf.cjs` vérifie le format :
//   id      unique, [a-z0-9-], jamais réutilisé (l'état « vu » est rangé par id) ;
//   date    'AAAA-MM-JJ', le jour de la mise en ligne, du plus récent au plus ancien ;
//   titre   8 mots au plus ;  phrase  12 mots au plus ;
//   tab     un écran que `?tab=` sait ouvrir (ONGLETS_LIENS d'App.jsx) ;
//   pour    'tous' · 'sneakers' · 'autre' (pas que des sneakers) · 'pro' (micro, société, marge) ·
//           'proprietaire' (16 nov. : le propriétaire de l'installation SEUL — Julien ; pas su ⇒ caché) ;
//   mode    'tous' · 'complet' (un écran que l'affichage Simple ne montre pas).
//
// L'état « vu » : `vrm_nouveautes_vues` = { vues: { [id]: iso } }, dans SYNC_KEYS
// (le même sur tous ses appareils, par compte VRM). Règles PURES : aucune lecture.
// ═══════════════════════════════════════════════════════════════════════════

// (20 nov., iphone-rapide) La clé vit dans src/nouveautesCle.js : la coque la lit au démarrage sans emporter la liste.
export { CLE_NOUVEAUTES_VUES } from './nouveautesCle.js';
export const POUR = Object.freeze(['tous', 'sneakers', 'autre', 'pro', 'proprietaire']);
export const MODES = Object.freeze(['tous', 'complet']);
export const TITRE_MOTS_MAX = 8;
export const PHRASE_MOTS_MAX = 12;

export const NOUVEAUTES = Object.freeze([
  // (26 nov., achats-rangee-compacte — capture de Julien sur iPhone : « ici c'est pas beau ») src/styles-achats-photos.css (fin)
  { id: 'achats-rangee-compacte', date: '2026-11-26', titre: 'Achats : des rangées plus nettes', phrase: 'L’état s’écrit à côté de la date.', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (26 nov., loupe-fondue — captures de Julien : « les couleurs sont moches, c'est mal fondu ») src/styles-recherche.css (fin)
  { id: 'loupe-fondue', date: '2026-11-26', titre: 'La recherche par N°, plus douce', phrase: 'Cartes arrondies, icônes légères, champ fin.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (26 nov., journee-fondue — capture de Julien d'Aujourd'hui : « ça rend pas hyper bien ») src/natif/natif.css · src/natif/jeu.css
  { id: 'journee-fondue', date: '2026-11-26', titre: 'Cartes sans halo sur le gris', phrase: 'Dernières ventes : la 1re photo ne touche plus le bord.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (26 nov., emails-plus-beau — Julien : « fais en sorte que ça soit plus beau ») src/emails-mail.css · src/BoiteEmails.jsx
  { id: 'emails-plus-beau', date: '2026-11-26', titre: 'E-mails : comptes à relier plus clairs', phrase: 'Une rangée par compte, un bouton « Relier ».', tab: 'emails', pour: 'tous', mode: 'tous' },
  // (26 nov., feuille-retour-jeu — Julien : « change l'affichage du pop up message, ça doit faire mieux, jeu vidéo ») src/capteNotif/FeuilleArrivee.jsx
  { id: 'retour-comme-un-jeu', date: '2026-11-26', titre: 'Ton retour sur l’app, comme un jeu', phrase: 'Qui écrit, la photo, le message ; « Tout vu » en un toucher.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (25 nov. soir, filtre-plateformes — Julien : « un filtre avec toutes les plateformes et par plateforme dans les onglets ») docs/passation/2026-11-25-filtre-plateformes.md
  { id: 'filtre-plateformes', date: '2026-11-25', titre: 'Filtre par plateforme dans chaque onglet', phrase: 'Toutes, ou un seul site : Annonces, Ventes, Achats.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (25 nov., sombre-par-defaut — Julien : « La deuxième couleur est pas mal, mets en mode sombre ») docs/passation/historique-interface-stock.md (fin)
  { id: 'sombre-par-defaut', date: '2026-11-25', titre: 'VRM s’ouvre en sombre', phrase: 'Le clair reste au choix : Paramètres → Apparence.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (25 nov., ventes-rangee — Julien : « c'est atroce, la mise en page est catastrophique ») docs/passation/2026-11-25-ventes-rangee.md
  { id: 'ventes-rangee-compacte', date: '2026-11-25', titre: 'Ventes : des lignes compactes avec photo', phrase: 'Photo, prix, un seul état, le transporteur entier : sept ventes par écran.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (25 nov., aujourdhui-moins-texte — Julien : « C'est pas mal mais trop de texte, améliore. ») docs/passation/2026-11-25-aujourdhui-moins-texte.md
  { id: 'aujourdhui-moins-texte', date: '2026-11-25', titre: 'Aujourd’hui : deux fois moins de texte', phrase: 'Un titre court, un chiffre ; le détail derrière ›.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (25 nov., achats-retours-design — Julien : « tu peux améliorer ce design ») docs/passation/2026-11-25-achats-retours-design.md
  { id: 'retours-cartes-compactes', date: '2026-11-25', titre: 'Tes retours tiennent en un coup d’œil', phrase: 'Un état, un bouton ; les retours remboursés se replient.', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (25 nov., logo-vinted-pp — Julien : « le logo de Vinted, mais pour le compte la pp du compte Vinted ») docs/passation/2026-11-25-logo-vinted-pp.md
  { id: 'logo-vinted-pp', date: '2026-11-25', titre: 'Chaque compte avec sa photo de profil', phrase: 'Le V Vinted en couleur, puis la photo du compte.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (25 nov., gris-moyen — Julien : « fais entre les deux, la couleur », puis « gris moyen c'est d'accord ») docs/passation/2026-11-25-gris-moyen.md
  { id: 'clair-gris-moyen', date: '2026-11-25', titre: 'Le clair passe au gris moyen', phrase: 'Entre le clair et le sombre : cartes claires, texte bien noir.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (25 nov., parrainage-20 — Julien : « le parrain touche 20 % … tant que son filleul paye ») docs/passation/2026-11-25-parrainage-20.md
  //   `proprietaire` tant que le programme est éteint (vrm_reglages.parrainage) : passer à 'tous' en l'ouvrant.
  { id: 'parrainage-20', date: '2026-11-25', titre: 'Parrainage : 20 % chaque mois', phrase: 'Ton filleul a −10 %, toi 20 % de chaque mois payé.', tab: 'parrainage', pour: 'proprietaire', mode: 'tous' },
  // (25 nov., style-c3 — Julien : « fait un mélange c3 vintex », « le gris de fond un peu foncé ») docs/passation/2026-11-25-style-c3.md
  { id: 'style-c3-doux', date: '2026-11-25', titre: 'Un douzième style : C3', phrase: 'Gris un peu foncé, cartes blanches, boutons nets : à essayer.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (25 nov., chargement-propre — Julien : « je dois fermer l'app et la rouvrir pour avoir les nouvelles infos ») docs/passation/2026-11-25-chargement-propre.md
  { id: 'maj-sans-relancer', date: '2026-11-25', titre: 'Les nouvelles infos arrivent seules', phrase: 'Vente, e-mail, retour sur l’app : à jour sans la rouvrir.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (25 nov., chargement-propre — Julien : « quand les données s'affichent c'est moche, long et déstructuré ») même récit
  { id: 'chargement-propre', date: '2026-11-25', titre: 'Les écrans se remplissent sans sauter', phrase: 'Un chiffre pas encore lu se dessine, rien ne bouge.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (24 nov., suivi-ventes — Julien : « retrait des articles vendus, fais un vrai suivi ») docs/passation/2026-11-24-suivi-ventes.md
  { id: 'suivi-envois', date: '2026-11-24', titre: 'Tes colis vendus, du dépôt au versement', phrase: 'Au point, retiré, argent versé : chaque étape lue, datée.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (24 nov., lot retrait-parfait — Julien : « pour le retrait tu dois vraiment faire quelque chose de parfait ») docs/passation/2026-11-24-retrait-parfait.md
  { id: 'retrait-comptoir', date: '2026-11-24', titre: 'Au comptoir : tous les codes du point', phrase: 'Code en grand, QR, Retiré d’un geste, même hors ligne.', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (24 nov., parcours-iphone — Julien : « elle bug trop encore ») docs/passation/2026-11-24-parcours-iphone.md
  { id: 'comptoir-retour', date: '2026-11-24', titre: 'Code au comptoir : le retour le ferme', phrase: 'Sur iPhone, le geste retour ne quitte plus VRM.', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (24 nov., visuel-annonces — Julien : « toute l'application visuelle », « sans latence ») docs/passation/2026-11-24-visuel-annonces.md
  { id: 'visuel-annonces', date: '2026-11-24', titre: 'Annonces en grandes photos, comme un inventaire', phrase: 'Le N°, le compte, les vues et favoris sur chaque photo.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (24 nov., visuel-argent — Julien : « toute l'application visuelle », « sans latence ») docs/passation/2026-11-24-visuel-argent.md
  { id: 'visuel-argent', date: '2026-11-24', titre: 'Argent en un coup d’œil', phrase: 'Anneau de l’objectif, seuils en jauges, à venir en cartes.', tab: 'compta', pour: 'tous', mode: 'tous' },
  // (24 nov., livrable-2) docs/passation/2026-11-24-livrable.md (Suite)
  { id: 'aujourdhui-sans-saut', date: '2026-11-24', titre: 'Aujourd’hui ne bouge plus au chargement', phrase: 'Chaque carte tient sa place avant ses chiffres.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (24 nov., visuel-jeu — Julien : « c'est pas visuel, hésite pas à faire des designs comme jeu vidéo ») docs/passation/2026-11-24-visuel-jeu.md
  { id: 'visuel-jeu', date: '2026-11-24', titre: 'Pop-ups et ventes en grandes photos', phrase: 'La paire en grand, son N°, une petite fête par vente.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (24 nov., livrable — Julien : « écran de chargement etc., tout doit être parfait ») docs/passation/2026-11-24-livrable.md
  { id: 'chargement-squelette', date: '2026-11-24', titre: 'Ouverture plus calme, sans tirets', phrase: 'Les chiffres en lecture se dessinent à leur place.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (24 nov., wcag-aa — Julien : plugin fairmind-design, accessibilité) docs/passation/2026-11-24-wcag-aa.md
  { id: 'wcag-aa-24nov', date: '2026-11-24', titre: 'Plus lisible, aussi avec un lecteur d’écran', phrase: 'Le bilan se lit la nuit ; feuilles et messages sont bien annoncés.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (24 nov., moderation-carte réconciliée avec la revue UX — Julien : « c'est moche ») src/AlerteModeration.jsx
  { id: 'annonces-disparues-groupees', date: '2026-11-24', titre: 'Annonces disparues : leurs photos et un geste', phrase: 'Une ligne par compte ; touche-la : photos, N°, quoi faire.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (24 nov., ext. 5.440.3 — Julien : « capte absolument tout ce que fait Bleam ») docs/passation/2026-11-24-observation-vinted.md
  { id: 'observer-vinted', date: '2026-11-24', titre: 'Observer Vinted pendant un envoi', phrase: 'Le chemin de la page Vinted noté 10 min, sans tes données.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (24 nov., vente-mail-annonce — Julien : « la vente a été détectée par les mails […] l'annonce n'a pas encore été supprimée ») docs/passation/2026-11-24-vente-mail-annonce.md
  { id: 'vente-mail-annonce', date: '2026-11-24', titre: 'Vendue par e-mail : l’annonce quitte « en ligne »', phrase: 'La vente prend son N°, sinon « Relier à l’annonce ».', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (24 nov., ext. 5.440.2 — Julien : « Sauté · Favori trop ancien » pour des favoris de la veille) docs/passation/2026-11-24-favoris-ancien.md
  { id: 'favoris-ancien', date: '2026-11-24', titre: 'Favoris : plus de « trop ancien » à tort', phrase: 'Les notifications sont lues jusqu’au bout avant de sauter un favori.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (24 nov., style-graphite — Julien : « un peu plus foncé en gris […] améliore tous les boutons […] change de style pour l'iPhone ») docs/passation/2026-11-24-style-graphite.md
  { id: 'styles-a-essayer', date: '2026-11-24', titre: 'Onze styles à essayer, dont Monochrome', phrase: 'Paramètres → Apparence → Style : touche, c’est appliqué.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (23 nov., colis-danger — Julien : « te prévient avant qu'il reparte ») docs/passation/2026-11-23-colis-danger.md
  { id: 'colis-en-danger', date: '2026-11-23', titre: 'Colis pas retiré : VRM te prévient', phrase: 'Vinted Go : la veille et le jour où il repart.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (23 nov., revue UX) docs/passation/2026-11-23-revue-ux.md
  { id: 'revue-ux-23nov', date: '2026-11-23', titre: 'Achats et fiches plus clairs', phrase: 'La liste d’abord, le prix d’achat dans la fiche, photos des disparues.', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (23 nov. soir, ext. 5.440.1 — Julien : « 0 envoyé · 1 sauté », phrase coupée) docs/passation/2026-11-23-favoris-identite.md
  { id: 'favoris-identite', date: '2026-11-23', titre: 'Messages aux favoris : le nouveau lien de Vinted', phrase: 'Un favori pas confirmé est dit et sauté, la file continue.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (23 nov., bugs-totale — Julien : « une vente reçue par mail […] pas actualisée dans l'application ») docs/passation/2026-11-22-bugs-totale.md
  { id: 'vente-email-partout', date: '2026-11-23', titre: 'Une vente reçue par e-mail se voit partout', phrase: 'Ventes, Ma journée et Colis, avant même le passage de l’extension.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (23 nov. au soir, lot retours-suivi — Julien : « le transporteur inconnu, le logo mal mis ») docs/passation/2026-11-23-retours-suivi.md
  { id: 'retraits-point-clair', date: '2026-11-23', titre: 'Points relais nommés, plus clairs, sans orange', phrase: 'Le nom du point Vinted Go, son logo, sa date limite.', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (23 nov., lot retours-suivi — Julien : « fais le suivi des colis retournés ») docs/passation/2026-11-23-retours-suivi.md
  { id: 'retours-achat-suivi', date: '2026-11-23', titre: 'Tes retours suivis jusqu’au remboursement', phrase: 'Chaque étape cochée, mise à jour toute seule, boutons clairs.', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (23 nov., photos-nettes — Julien : « toutes les photos sont floues ») docs/passation/2026-11-23-photos-nettes.md
  { id: 'photos-nettes', date: '2026-11-23', titre: 'Photos plus nettes, surtout en grand', phrase: 'La plus grande taille connue s’affiche dès qu’elle est chargée.', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (23 nov., ext. 5.440 — Julien : « l'app doit s'adapter toute seule au bouton favoris ») docs/passation/2026-11-23-favoris-auto.md
  { id: 'favoris-sans-geste', date: '2026-11-23', titre: 'Messages aux favoris : plus aucun geste demandé', phrase: 'VRM trouve seul la cloche de Vinted et montre chaque envoi.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (23 nov., audit « chaque bouton marche ») docs/passation/2026-11-23-audit-boutons.md
  { id: 'mode-presentation', date: '2026-11-23', titre: 'Mode présentation', phrase: 'Chiffres et pseudos cachés à l’écran : Paramètres → Apparence et langue.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'boutons-reveilles', date: '2026-11-23', titre: 'Les boutons qui ne faisaient rien, réparés', phrase: 'Poignée des feuilles, retour au téléphone, Échap, menu des achats.', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (22 nov., latence-totale — Julien : « l'app bug beaucoup trop ») docs/passation/2026-11-22-latence.md
  { id: 'onglets-plus-rapides', date: '2026-11-23', titre: 'Achats et Ventes s’ouvrent plus vite', phrase: 'Les longues listes de colis arrivent au fil du défilement.', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (22 nov., Julien : « les ventes annulées pour chaque plateforme doivent être comptabilisées » ; « sur Vestiaire, voir quand une annonce est en attente de validation ») docs/passation/2026-11-22-annulees-vc.md
  { id: 'annulees-partout', date: '2026-11-22', titre: 'Ventes annulées : comptées sur chaque site', phrase: 'Nombre, montant et taux d’annulation par site, par compte, par mois.', tab: 'stats', pour: 'tous', mode: 'tous' },
  { id: 'vc-validation', date: '2026-11-22', titre: 'Vestiaire : en attente de validation', phrase: 'En attente, à corriger ou refusée : écrit sur l’annonce.', tab: 'plat_vestiaire', pour: 'tous', mode: 'tous' },
  // (22 nov., lot achats-lot — Julien : « l'app comprend que c'est un lot, divise l'achat ») docs/passation/2026-11-22-achats-lot.md
  { id: 'achats-lot-diviser', date: '2026-11-22', titre: 'Diviser un achat en plusieurs paires', phrase: 'Lot ou achat simple : chaque paire, son N° et son prix.', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (22 nov., ext. 5.438) note de santé, compte précieux, relances, lots et brouillons seuls.
  { id: 'sante-note', date: '2026-11-22', titre: 'Une note de santé par compte', phrase: 'Elle baisse ? La cadence ralentit seule, puis remonte.', tab: 'adistance', pour: 'tous', mode: 'tous' },
  { id: 'compte-precieux', date: '2026-11-22', titre: 'Compte précieux : tout à la main', phrase: 'Cadence divisée par deux, rien en série ni d’automatique.', tab: 'adistance', pour: 'tous', mode: 'tous' },
  { id: 'relances-lots-seuls', date: '2026-11-22', titre: 'Relances, lots et brouillons qui partent seuls', phrase: 'Éteints par défaut, réglés dans le panneau de l’extension.', tab: 'adistance', pour: 'tous', mode: 'tous' },
  // (22 nov., ext. 5.437) docs/passation/2026-11-22-ext-5437.md
  { id: 'prix-mini-publier', date: '2026-11-22', titre: 'Le prix minimum demandé à la publication', phrase: 'Rangé à côté du N°, la négociation descend vers lui, jamais dessous.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'nuit-aussi', date: '2026-11-22', titre: 'Tes automatisations tournent aussi la nuit', phrase: 'Mêmes plafonds et même rythme que le jour, ordinateur gardé éveillé.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (22 nov., ext. 5.436, Julien : « mes comptes à distance, comme Bleam Cloud mais sans risque de ban ») docs/passation/2026-11-22-a-distance.md
  { id: 'a-distance', date: '2026-11-22', titre: 'Tes comptes à distance, par ton ordinateur', phrase: 'Réponds, tranche une offre, relis un compte depuis ton iPhone.', tab: 'adistance', pour: 'tous', mode: 'tous' },
  // (22 nov., Julien : « un mélange de 2 et 1 », « j'aime bien en noir ») docs/passation/2026-11-22-style-clarte.md
  { id: 'style-encre', date: '2026-11-22', titre: 'Aujourd’hui en tableau de bord, en noir', phrase: 'Le bénéfice du mois en grand, le graphique, les gestes en disques.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (22 nov., choix 1, 23 et 27 de Julien) docs/passation/2026-11-22-apres-finale-app.md
  { id: 'reprise-appareil', date: '2026-11-22', titre: 'Reprendre sur l’autre appareil', phrase: 'La fiche ouverte sur l’iPhone, en haut d’Aujourd’hui sur l’ordinateur.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'plus-vue', date: '2026-11-22', titre: 'Annonces qui ne sont plus vues', phrase: '« Plus vue depuis 6 j » et « Republier » pour cette paire.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (22 nov., chasse aux bugs P1-4) docs/passation/2026-11-22-chasse-bugs.md
  { id: 'mois-a-dater', date: '2026-11-22', titre: 'Argent : chaque mois dit ses ventes à dater', phrase: 'Un mois incomplet dit « au moins » et combien manquent.', tab: 'compta', pour: 'tous', mode: 'tous' },
  // (22 nov., ext. 5.435, choix 22 et 2 de Julien) docs/passation/2026-11-22-apres-finale-ext.md
  { id: 'sauvegarde-reglages', date: '2026-11-22', titre: 'Sauvegarde et restauration de tes réglages', phrase: 'Dans l’extension : un fichier, sans secret ; restaurer demande « Oui ».', tab: 'extension', pour: 'tous', mode: 'tous' },
  { id: 'sites-egalite', date: '2026-11-22', titre: 'Leboncoin et Vestiaire comme Vinted', phrase: 'En pause, hors ligne, offres, retours et messages dans la recherche.', tab: 'cat_msg', pour: 'tous', mode: 'tous' },
  // (22 nov., choix n° 33, 35 et 36 de Julien) docs/passation/2026-11-22-offres-photos-resume.md
  { id: 'offres-sans-reponse', date: '2026-11-22', titre: 'Les offres restées sans réponse', phrase: 'La plus ancienne d’abord, avec le prix et ton plancher.', tab: 'messages', pour: 'tous', mode: 'tous' },
  { id: 'photo-en-double', date: '2026-11-22', titre: 'Même photo sur deux annonces', phrase: 'Annonces → « Photo en double » : la même paire en ligne deux fois ?', tab: 'cat_annonces', pour: 'tous', mode: 'tous' },
  { id: 'resume-mois-email', date: '2026-11-22', titre: 'Le résumé du mois par e-mail', phrase: 'Le 1er : ventes, reçu, bénéfice, colis non retirés, URSSAF.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (22 nov., Julien : « j'ai fait 3 ventes mais pas que sur Leboncoin ») docs/passation/2026-11-22-integration-finale.md
  { id: 'annonces-vendues', date: '2026-11-22', titre: 'Annonces : toutes tes ventes, tous sites', phrase: 'Vendue montre aussi Vinted et eBay ; un filtre Site juste.', tab: 'cat_annonces', pour: 'tous', mode: 'tous' },
  // (21 nov., ux-reglages — Julien : Paramètres en liste, écrans vides, « Nouveau », « Bien démarrer ») docs/passation/2026-11-21-ux-reglages.md
  { id: 'ux-reglages', date: '2026-11-21', titre: 'Paramètres en liste, écrans vides plus clairs', phrase: 'Une seule apparence, des écrans vides qui disent quoi faire.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (21 nov., Julien : style « comme Vintex — 2e jet » pour toute l'app) docs/passation/2026-11-21-style-vintex.md
  { id: 'style-sobre', date: '2026-11-21', titre: 'Une app plus claire, plus dense', phrase: 'Textes plus petits, cartes fines, étiquettes de couleur, accent vert sapin.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (21 nov., choix 5 et 7 de Julien) docs/passation/2026-11-21-fiche-sites.md
  { id: 'fiche-sites', date: '2026-11-21', titre: 'La fiche dit où la paire est publiée', phrase: 'Une rangée par site, et « Publier » là où elle manque.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'serie-achats', date: '2026-11-21', titre: 'Relier tes achats arrivés, un par un', phrase: 'Dans Achats : la vente proposée, « Relier » ou « Passer ».', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (21 nov., Julien : « ça me propose des paires que je n'ai pas retirées », « ne compte pas quand je suis remboursé ») docs/passation/2026-11-21-relier-retires.md
  { id: 'relier-retires', date: '2026-11-21', titre: 'Relier : seulement les paires déjà chez toi', phrase: 'Au point relais : « Je l’ai retiré » d’abord. Remboursé : hors dépenses.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'non-retires', date: '2026-11-21', titre: 'Statistiques des colis non retirés', phrase: 'Combien, quel argent, quel transporteur, quel point.', tab: 'dashboard', pour: 'tous', mode: 'tous' },
  // (21 nov., Julien : « rends relier les achats à la vente / à l'annonce plus facile ») docs/passation/2026-11-21-relier-code.md
  { id: 'retrait-billet', date: '2026-11-21', titre: 'Le code de retrait, en billet compact', phrase: 'Photo de la paire, code en gros, QR à côté.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'relier-facile', date: '2026-11-21', titre: 'Relier : la meilleure proposition en tête', phrase: 'Un toucher puis « Oui » ; ou en série, vente après vente.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (21 nov., lot transp-depenses) docs/passation/2026-11-21-transp-depenses.md
  { id: 'depense-rapide', date: '2026-11-21', titre: '« + Dépense » en deux touchers', phrase: 'Montant, catégorie : c’est noté et déduit de ton bénéfice net.', tab: 'compta', pour: 'tous', mode: 'tous' },
  { id: 'transporteurs-sites', date: '2026-11-21', titre: 'Transporteurs : Leboncoin, eBay et Vestiaire aussi', phrase: 'Les mêmes délais pour chaque site, le site de chaque colis.', tab: 'stats', pour: 'tous', mode: 'tous' },
  // (21 nov., choix n° 36 et 41 de Julien) docs/passation/2026-11-21-rentabilite.md
  { id: 'vends-mieux', date: '2026-11-21', titre: 'Ce que tu vends le mieux', phrase: 'Par modèle, marque, taille : marge, vitesse, et quoi racheter.', tab: 'stats', pour: 'tous', mode: 'tous' },
  { id: 'cout-reel-vente', date: '2026-11-21', titre: 'Le coût réel de chaque vente', phrase: 'Commission, boost, emballage, port, achat : le net de la paire.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (21 nov., choix n° 12 et 15 de Julien) docs/passation/2026-11-21-prio-recherche.md
  { id: 'republier-priorite', date: '2026-11-21', titre: 'Les paires à republier en priorité, chaque jour', phrase: 'Classées avec leur raison ; coche, et l’atelier s’ouvre dans l’extension.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'recherche-partout', date: '2026-11-21', titre: 'La recherche tolère les fautes de frappe', phrase: 'Logo du site sur chaque résultat ; un N° reste exact.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (21 nov., choix 77 de Julien : « Suivi des retours ») docs/passation/2026-11-21-retours-suivi.md
  { id: 'retours-suivi', date: '2026-11-21', titre: 'Retours : le colis qui revient, suivi', phrase: 'Son n°, ses étapes, le code au point ; arrivé, remets-le en ligne.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (21 nov., ext. 5.429, Julien : brouillons préparés, photos dans l'ordre, descriptions types, boost rentable, republier à la main) docs/passation/2026-11-21-ext-5429.md
  { id: 'brouillons-prepares', date: '2026-11-21', titre: 'Prépare tes fiches, dépose-les demain', phrase: '« Préparer » dans À publier, puis « Déposer N sur Vinted » dans l’extension.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'boost-rentable', date: '2026-11-21', titre: 'Le boost a-t-il servi ?', phrase: 'Vues pendant le boost contre la même durée avant, sur ta fiche.', tab: 'stats', pour: 'tous', mode: 'tous' },
  { id: 'republier-maintenant', date: '2026-11-21', titre: 'Republier une annonce en un geste', phrase: '« Republier » sur l’annonce : l’avant / après, puis « Republier maintenant ».', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (21 nov., Julien : « refonds toute l'application dans le style de Vintex ») docs/passation/2026-11-21-argent-vintex.md
  { id: 'argent-rangees', date: '2026-11-21', titre: 'Argent du mois, chaque montant en entier', phrase: 'Des rangées fines, les six mois chiffrés, un seul compteur de prix.', tab: 'compta', pour: 'tous', mode: 'tous' },
  // (21 nov., Julien sur ses captures iPhone de Ventes : vignettes trop petites, nom coupé, prix d'achat derrière « ⋯ ») docs/passation/2026-11-21-ventes-lisibles.md
  { id: 'ventes-lisibles', date: '2026-11-21', titre: 'Ventes : grandes photos, prix d’achat direct', phrase: 'Le nom entier ; « Relier » et le prix d’achat sur chaque vente.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (21 nov., ext. 5.433, Julien, choix n° 97, 99, 101, 102 : « une seule file visible », « pause après celle-ci », réessayer intelligemment, apprendre les boutons) docs/passation/2026-11-21-ext-5433.md
  { id: 'ext-5433', date: '2026-11-21', titre: 'Une seule file d’actions, et la pause', phrase: 'Tout passe dans l’ordre ; réordonne, retire, ou mets en pause.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (21 nov., ext. 5.430, Julien : traduire les messages étrangers ; « tu n'acceptes pas les comptes 1 étoile ») docs/passation/2026-11-21-ext-5430.md
  { id: 'ext-5430', date: '2026-11-21', titre: 'Traduction sur l’appareil, note des acheteurs', phrase: 'Messages étrangers traduits ; jamais d’offre acceptée seule d’un acheteur 1 étoile.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (21 nov., ext. 5.421, Julien : réponses rapides sans IA, offre lot, relance des offres, « un agent autonome qui négocie par paliers ») docs/passation/2026-11-21-ext-5421.md
  { id: 'ext-5421', date: '2026-11-21', titre: 'Agent VRM, réponses rapides, lots, relances', phrase: 'Réponses prêtes, lots aux favoris, offres relancées, agent en essai.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (21 nov., ext. 5.422, Julien : « des notifications sur mon téléphone », « programmer la republication ») docs/passation/2026-11-21-ext-5422.md
  { id: 'push-capte', date: '2026-11-21', titre: 'Ventes et offres sur ton téléphone', phrase: 'Dès que l’extension les capte, une fois, avec le geste à faire.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'repub-programmee', date: '2026-11-21', titre: 'Republier à l’heure que tu choisis', phrase: 'Dans l’atelier : « Programmer à … », annulable, jamais répété.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (21 nov., ext. 5.423, Julien : « pour la modification qui est en place dans l'extension, tu peux faire l'avant / après et un meilleur processus visuel ») docs/passation/2026-11-21-ext-5423.md
  { id: 'ext-5423', date: '2026-11-21', titre: 'Avant / après de chaque modification', phrase: 'Relis ce qui change, suis chaque étape prouvée, puis le bilan.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (21 nov., ext. 5.427, Julien : « le visuel doit être mieux que ça ») docs/passation/2026-11-21-ext-visuel.md
  { id: 'ext-5427-visuel', date: '2026-11-21', titre: 'Le panneau de l’extension, plus net', phrase: 'Textes plus petits, contours fins, N° discret, étapes lisibles au téléphone.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (21 nov., ext. 5.432, Julien : choix A « changer le prix partout en un geste » et B « garde-fou sur le prix ») docs/passation/2026-11-21-ext-5432.md
  { id: 'ext-5432', date: '2026-11-21', titre: 'Le prix partout, et une garde', phrase: 'Un prix change sur chaque site ; un prix suspect demande ton oui.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (21 nov., ext. 5.424, Julien, choix n° 45 : « il faut que ce soit parfait et irréprochable ») docs/passation/2026-11-21-ext-5424.md
  { id: 'ext-5424', date: '2026-11-21', titre: 'Publier aussi sur Leboncoin et Vestiaire', phrase: 'Depuis ton annonce Vinted : chaque champ vérifié, puis publié en un geste.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (21 nov., ext. 5.425, Julien : « acheteurs qui ne finalisent pas, ou ne vont pas chercher le colis » ; tri des conversations) docs/passation/2026-11-21-ext-5425.md
  { id: 'ext-5425', date: '2026-11-21', titre: 'Relancer les acheteurs, trier les messages', phrase: 'Livré non confirmé, colis au relais : un message poli prêt.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (21 nov., ext. 5.426, choix 49 de Julien : « c'est la force de l'app ») docs/passation/2026-11-21-ext-5426.md
  { id: 'retirer-partout', date: '2026-11-21', titre: 'Vendue sur un site, retirée partout', phrase: 'Masquée, mise en pause ou signalée sur les autres sites, réversible.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (21 nov., ext. 5.419, Julien : « je veux un message pré-rempli », « les trois minutes d'attente », « sélectionner les commandes ») docs/passation/2026-11-21-ext-5419.md
  // (21 nov., ext. 5.428, choix 57-58-59 de Julien) docs/passation/2026-11-21-ext-5428.md
  { id: 'ext-5428', date: '2026-11-21', titre: 'En direct, courbe des annonces, masquées', phrase: 'Ce que fait l’extension, vues jour par jour, annonces masquées.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'ext-5420', date: '2026-11-21', titre: 'Favoris en 4 étapes, santé des comptes', phrase: 'Sélection, réduction, message, puis Lancer ; un seul PDF pour tes bordereaux.', tab: 'extension', pour: 'tous', mode: 'tous' },
  { id: 'ext-5419', date: '2026-11-21', titre: 'Favoris : taux, message prêt, envoi immédiat', phrase: 'Choisis la réduction, relis le message ; Commandes : imprime la sélection.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (21 nov., Julien : « les annonces sont moches » ; « quand un compte est ban je veux quand même voir ses annonces ») docs/passation/2026-11-21-annonces-dressing.md
  { id: 'annonces-dressing', date: '2026-11-21', titre: 'Annonces en grille photo, comme un dressing', phrase: 'Grille ou liste, au choix ; vues, favoris et jours sur chaque carte.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'annonces-compte-bloque', date: '2026-11-21', titre: 'Un compte bloqué garde ses annonces visibles', phrase: 'Segment « Bloqués » : ses dernières annonces connues, datées, hors des totaux.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (21 nov., onglets-menu, Julien : « réorganise les onglets » puis « garde les onglets ») docs/passation/2026-11-21-onglets-menu.md
  { id: 'onglets-menu', date: '2026-11-21', titre: 'Un Menu en tuiles sous ta photo', phrase: 'Stock, E-mails, l’extension, le thème et la langue en un toucher.', tab: 'menu', pour: 'tous', mode: 'tous' },
  // (21 nov., fluidité — Julien : « des écrans qui se superposent », vignettes grises au téléphone) docs/passation/2026-11-21-fluidite.md
  { id: 'photos-fluidite', date: '2026-11-21', titre: 'Photos partout et écrans sans saut', phrase: 'Annonces, Ventes, Achats montrent leurs photos au téléphone ; plus d’écran vide.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (21 nov., ext. 5.417, Julien : « on n'a pas la possibilité de personnaliser, améliore ça ») docs/passation/2026-11-21-favoris-perso.md
  { id: 'favoris-perso', date: '2026-11-21', titre: 'Tes messages aux favoris, personnalisés', phrase: 'Versions, prénom, marque, taille, règles par heure ou prix, aperçu réel.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (21 nov., ext. 5.416.0, Julien : « on ne fait plus les requêtes », « pour tous les sites ») docs/passation/2026-11-21-lbc-interface.md
  { id: 'lbc-interface', date: '2026-11-21', titre: 'Leboncoin : VRM agit par la page', phrase: 'Pause, suppression, prix, réponses : appris de ton geste, refait par la page.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (21 nov., ext. 5.415.0, Julien : « au moment de la connexion ça doit s'améliorer ») docs/passation/2026-11-21-extension-connexion.md
  { id: 'connexion-extension', date: '2026-11-21', titre: 'Connecter l’extension : deux chemins clairs', phrase: 'Mot de passe dans l’extension, ou liaison par vrm.center.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (21 nov., ext. 5.414, Julien : « elle ne doit pas se tromper […] on ne fait plus les requêtes ») docs/passation/2026-11-21-extension-interface.md
  { id: 'extension-interface', date: '2026-11-21', titre: 'L’extension clique et tape : plus aucune requête', phrase: 'Messages, offres, republication : tout passe par la page Vinted, vérifié.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (21 nov., ext. 5.413.0, Julien : « je veux que ce soit dans ce style-là, surtout sur le téléphone ») docs/passation/2026-11-21-panneau-telephone.md
  { id: 'panneau-telephone', date: '2026-11-21', titre: 'Le panneau de l’extension sur iPhone', phrase: 'Cinq onglets en bas, rangées lisibles, titres complets, menus en feuille.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (21 nov., ext. 5.412.0, Julien : « au moins lire les messages et écrire aux personnes ») docs/passation/2026-11-21-vestiaire-messages.md
  { id: 'vestiaire-ecrire', date: '2026-11-21', titre: 'Vestiaire : lire et répondre depuis l’extension', phrase: 'Le fil dans le panneau ; ton message tapé sur la page.', tab: 'messages', pour: 'tous', mode: 'tous' },
  // (21 nov., ext. 5.411, Julien : « prévoir les colis à aller chercher pour chaque point relais ») docs/passation/2026-11-21-relais-prevision.md
  { id: 'relais-prevision', date: '2026-11-21', titre: 'À retirer : chaque point relais, ce qui arrive', phrase: 'Les colis arrivés et en route, rangés par point, avec leur date.', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (21 nov., ext. 5.410.8, Julien : « je ne peux pas sélectionner les favoris », « l'onglet doit être bloqué », « pas d'offre en plus ») docs/passation/2026-11-21-favoris-corrections.md
  // (21 nov., lot journee-stats, Julien : « bénéfice dans Ma journée, brut et net » ; « beaucoup plus de statistiques ») docs/passation/2026-11-21-journee-stats.md
  // (21 nov., lot journee-stats, Julien : « fais les stats par transporteur, achat et vente »)
  { id: 'stats-transporteurs', date: '2026-11-21', titre: 'Statistiques par transporteur, ventes et achats', phrase: 'Délais de dépôt, de livraison et de retrait, sur dates lues.', tab: 'compta', pour: 'tous', mode: 'tous' },
  { id: 'journee-stats', date: '2026-11-21', titre: 'Ma journée courte, bénéfice brut et net', phrase: 'Colis et chiffres en haut, le détail dans Statistiques.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'favoris-corriges', date: '2026-11-21', titre: 'Favoris : cases, offre et onglet bloqué', phrase: 'Une file annulée se renvoie ; l’offre part toujours ; l’onglet VRM est voilé.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (21 nov., ext. 5.410.7, Julien : « une liste pour les favoris comme pour les ventes » ; « ouvre un autre onglet pour travailler ») docs/passation/2026-11-21-favoris-tableau.md
  { id: 'favoris-tableau', date: '2026-11-21', titre: 'Les favoris en tableau, comme les commandes', phrase: 'Dans l’extension, page Favoris : cocher, envoyer, suivre chaque rangée.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (20 nov. soir, capture de Julien 22:29) docs/passation/2026-11-20-captcha-visible.md — ext. 5.410.5
  // (21 nov., ext. 5.410.6) fausse alerte « vérification » : les cadres reCAPTCHA invisibles de vinted.fr ne comptent plus
  { id: 'verif-visible', date: '2026-11-21', titre: 'Plus de fausse alerte de vérification', phrase: 'VRM ne parle de vérification que si Vinted l’affiche.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'verification-visible', date: '2026-11-20', titre: 'Envois comme Bleam, vérification jamais cachée', phrase: 'Un onglet de travail VRM ; le panneau s’écarte devant une vérification.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (20 nov., « tout comme Bleam », la suite) docs/passation/2026-11-20-bleam-suite.md — ext. 5.410.4
  { id: 'bleam-apres-vente', date: '2026-11-20', titre: 'Après-vente, cycle de vie et stock auto', phrase: 'Dans l’extension, onglet Automatisations ; tout est éteint au départ.', tab: 'extension', pour: 'tous', mode: 'tous' },
  { id: 'compte-personnel', date: '2026-11-20', titre: 'Un compte Vinted personnel, hors URSSAF', phrase: 'Comptes liés › Gérer : vente, achats ou personnel.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (20 nov., Julien : « 4 litiges avec 2 écritures différentes » ; « fais un beau logo pour relier ») src/natif/ecrans/RetoursVentes.jsx, celluleAchat.jsx
  { id: 'ventes-retours', date: '2026-11-20', titre: 'Retours rangés, relier en un toucher', phrase: 'Un groupe « Retours et litiges » ; les maillons relient la vente.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (20 nov. soir, Julien : « tu vas aussi enlever les onglets par plateforme, ça ne marche pas du tout ») docs/passation/2026-11-20-sans-selecteur.md
  { id: 'sans-selecteur', date: '2026-11-20', titre: 'Tous tes sites ensemble, sans onglets', phrase: 'Chaque ligne porte le logo de son site.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (20 nov., Julien : « trop long à charger », « les écrans de chargement sont atroces ») docs/passation/2026-11-20-instantane.md
  { id: 'affichage-instantane', date: '2026-11-20', titre: 'Chaque écran s’ouvre tout de suite', phrase: 'Ta dernière liste d’abord, datée, puis la mise à jour en place.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (20 nov. au soir, décision de Julien : « on fait absolument tout comme Bleam », ext. 5.410.3) docs/passation/2026-11-20-comme-bleam.md
  { id: 'repub-formulaire', date: '2026-11-20', titre: 'Republier par le formulaire de Vinted', phrase: 'Champ par champ, dans un onglet nommé ; l’ancienne méthode au choix.', tab: 'extension', pour: 'tous', mode: 'tous' },
  { id: 'favoris-bleam', date: '2026-11-20', titre: 'Favoris : le message, puis l’offre', phrase: 'Message « lot » si on aime plusieurs articles ; offre jamais sous ton plancher.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (20 nov., Julien sur sa capture : « fais comme Vintex et comme l'extension avec les transporteurs ») src/natif/ecrans/Ventes.jsx (VentesBureau)
  // (20 nov., Julien : « trie du plus récent, des filtres, jamais un achat pas encore livré, il manque des paires ») docs/passation/2026-11-20-relier-achats.md
  { id: 'relier-achats', date: '2026-11-20', titre: 'Relier : toutes tes paires, plus récentes d’abord', phrase: 'Filtres plateforme, marque, taille ; seuls les achats reçus.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'achats-suivi', date: '2026-11-20', titre: 'Achats : n° de suivi en colonne', phrase: 'À l’ordinateur : touche pour copier, ↗ pour suivre.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'ventes-tableau', date: '2026-11-20', titre: 'Ventes en tableau, transporteur en logo', phrase: 'À l’ordinateur : tri, statut, imprimer ; la vente s’ouvre à droite.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (20 nov., Julien : « tout le site doit être comme la fiche Paramètres, simple et minimaliste » ; « les mêmes dispositions sur toutes les plateformes ») docs/passation/2026-11-20-minimaliste.md
  { id: 'minimaliste', date: '2026-11-20', titre: 'Tout l’écran simple, comme Paramètres', phrase: 'Des groupes sobres ; Ventes pareil sur chaque site.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (20 nov., Julien : « Améliore le visuel, tu n'as pas respecté ce qu'on avait dit ») docs/passation/2026-11-20-argent-natif.md
  { id: 'argent-natif', date: '2026-11-20', titre: 'Argent plus clair, en cartes sobres', phrase: 'Le mois, ta déclaration et tes statistiques, sans rien de chargé.', tab: 'compta', pour: 'tous', mode: 'tous' },
  // (20 nov., ext. 5.410.2) docs/passation/2026-11-20-extension-5412.md — panneau qui reste ouvert, bordereau et livreur.
  { id: 'panneau-bordereau', date: '2026-11-20', titre: 'Imprime le bordereau depuis l’extension', phrase: 'Chaque vente dit son livreur, son suivi et sa date limite.', tab: 'extension', pour: 'tous', mode: 'tous' },
  { id: 'panneau-reste-ouvert', date: '2026-11-20', titre: 'Le panneau de l’extension reste ouvert', phrase: 'Même page après une navigation : seul ton × le ferme.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (20 nov., Julien : « pour l'extension, tu fais pareil que Vintex ») docs/passation/2026-11-20-panneau-vintex.md
  { id: 'panneau-extension', date: '2026-11-20', titre: 'Le panneau de l’extension, en vrai tableau', phrase: 'Barre à gauche, articles et commandes en colonnes, automatisations côte à côte.', tab: 'extension', pour: 'tous', mode: 'tous' },
  // (20 nov., décision de Julien : « toute action doit être faite dans l'extension ») docs/passation/2026-11-20-actions-extension.md.
  { id: 'gestes-extension', date: '2026-11-20', titre: 'Tes gestes se font dans l’extension', phrase: 'Baisser, republier, répondre : VRM ouvre le panneau sur le site.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (20 nov., ext. 5.410) Republier copie l'annonce telle quelle et vérifie avant ; messages qui sautent ce qui serait refusé — docs/passation/2026-11-20-repub-messages-malins.md
  { id: 'repub-verifie-avant', date: '2026-11-20', titre: 'Republier vérifie chaque annonce avant de lancer', phrase: 'Copie exacte de l’annonce, taille corrigée seule, le reste demandé.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'favoris-sautes-dits', date: '2026-11-20', titre: 'Favoris : ce qui serait refusé est sauté', phrase: 'Vendus, sous ton prix mini, texte refusé : sautés, et dit au bilan.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (20 nov., Julien : « on reçoit quand une personne est intéressée sur Leboncoin ; pour Vestiaire trouve une solution ») docs/passation/2026-11-20-lbc-vc-interesses.md
  { id: 'lbc-interesses', date: '2026-11-20', titre: 'Leboncoin : qui t’a écrit, par annonce', phrase: 'Leur écrire depuis le panneau VRM, une personne à la fois.', tab: 'messages', pour: 'tous', mode: 'tous' },
  { id: 'vc-date-baisse', date: '2026-11-20', titre: 'Vestiaire : date en ligne, baisse par règle', phrase: 'Lue chez Vestiaire, sinon « au moins » ; éteinte par défaut.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (20 nov., Julien : « on ne peut pas relier des annonces comme ça, on est obligé d'appuyer dessus ») src/natif/ecrans/PropositionLiaison.jsx
  { id: 'relier-depuis-liste', date: '2026-11-20', titre: 'Relie une annonce depuis la liste', phrase: 'Sa paire proposée sur la rangée : un toucher, annulable 10 s.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (20 nov., Julien : « des boutons pas très beaux, pas fiables, améliore ça ») docs/passation/2026-11-20-boutons-natifs.md
  { id: 'boutons-natifs', date: '2026-11-20', titre: 'Des boutons nets et fiables partout', phrase: 'Un double toucher ne fait qu’un geste ; un bouton grisé dit pourquoi.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (20 nov., chantier « ce qui manque ») vues et favoris, stock au prix affiché, compte bloqué, Stock personnaliser.
  { id: 'vues-favoris', date: '2026-11-20', titre: 'Tes vues et favoris, chaque jour', phrase: 'Le total de tes annonces en ligne, et le gain du jour.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'stock-prix-affiche', date: '2026-11-20', titre: 'Ton stock au prix affiché', phrase: 'Une paire comptée une fois, même publiée sur plusieurs sites.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'meuble-personnaliser', date: '2026-11-20', titre: 'Personnalise tes meubles, range la pièce', phrase: 'Style, couleur, cases, nom ; à la souris, glisse une paire.', tab: 'garage', pour: 'tous', mode: 'complet' },
  // (20 nov., Julien : « l'app lui donne son N°, te dit dans quelle case la ranger ») docs/passation/2026-11-20-arrivee-scan.md
  { id: 'arrivee-scan', date: '2026-11-20', titre: 'Un colis arrive : son N°, sa case', phrase: '« J’ai retiré » ou le scan : range-le en un toucher.', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (20 nov., Julien : « un parcours de 5 minutes […] une démo […] Tout va bien ? qui dit exactement quoi faire ») docs/passation/2026-11-20-demarrage-store.md
  { id: 'bien-demarrer', date: '2026-11-20', titre: 'Bien démarrer en 5 minutes', phrase: 'Sites, extension, comptes, étiquetage, import : rouvrable depuis Paramètres.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'tout-va-bien-points', date: '2026-11-20', titre: 'Tout va bien ? dit quoi faire', phrase: 'Chaque point a son geste, le plus important d’abord.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (19 nov., Julien : « qu'il occupe toute la largeur de l'écran […] une animation quand je range ») docs/passation/2026-11-19-stock-etiquetage.md
  // (20 nov.) Colis à retirer : contenu d'abord, trajet, QR à droite, code gardé jusqu'à la fin prouvée — docs/passation/2026-11-20-retraits-visuel.md.
  { id: 'retraits-visuel', date: '2026-11-20', titre: 'Colis à retirer : contenu, trajet et QR', phrase: 'La paire en grand, son trajet daté, le QR à droite.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'stock-meubles', date: '2026-11-19', titre: 'Tes meubles dessinés, sur toute la largeur', phrase: '« Ranger » sur chaque article : il vole dans sa case.', tab: 'garage', pour: 'tous', mode: 'complet' },
  { id: 'methode-etiquetage', date: '2026-11-19', titre: 'Choisis ta méthode d’étiquetage', phrase: 'Qui numérote, lettre ou chiffres, étiquette écrite ou imprimée.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (19 nov., fiche directe) Un toucher ouvre la fiche, qui montre tout : faits, sites, gestes — docs/passation/2026-11-19-fiche-directe.md.
  { id: 'fiche-directe', date: '2026-11-19', titre: 'La fiche montre tout, d’un seul toucher', phrase: 'Prix, achat, bénéfice, sites, gestes : touche une valeur pour la changer.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (19 nov., Julien : « la liaison des articles entre les différentes applications […] irréprochable ») docs/passation/2026-11-19-liaison-sites-guidee.md
  { id: 'liaison-sites-guidee', date: '2026-11-19', titre: 'Relie tes annonces, photo contre photo', phrase: 'Leboncoin, eBay, Vestiaire : touche le bon article, annulable 10 s.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (19 nov. soir, NATIF.md §2 bis) docs/passation/2026-11-19-app-tableaux.md
  { id: 'app-tableaux', date: '2026-11-19', titre: 'Annonces, ventes, achats en tableaux de travail', phrase: 'Statut à compteurs, colonnes, tri, sélection ; et l’écran Automatisations.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (19 nov., Julien : « un agent 100 % autonome, sans IA » ; « c'est l'extension qui va publier ») docs/passation/2026-11-19-publier-agent.md
  { id: 'publier-agent', date: '2026-11-19', titre: 'Publier sur… : VRM remplit chaque site', phrase: 'Catégorie, marque, pointure posées seules ; une question s’il doute.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (19 nov., Julien : « l'onglet e-mails est absolument catastrophique » ; « relier la boîte : beaucoup plus accompagné ») docs/passation/2026-11-19-emails-mail.md
  { id: 'emails-mail', date: '2026-11-19', titre: 'E-mails comme Mail, plein écran', phrase: 'Segments en haut, la liste en grand, l’e-mail lisible à côté.', tab: 'emails', pour: 'tous', mode: 'tous' },
  { id: 'relier-boite-guide', date: '2026-11-19', titre: 'Relier ta boîte, pas à pas', phrase: 'Gmail, Outlook, iCloud : une étape par écran, essai vérifié en direct.', tab: 'emails', pour: 'tous', mode: 'tous' },
  // (19 nov., Julien : « reconnaître absolument tous les types de code de retrait », « je dois voir quand un nouveau QR ou colis est détecté ») docs/passation/2026-11-19-retraits-parfaits.md
  { id: 'retraits-parfaits', date: '2026-11-19', titre: 'Nouveau code de retrait : VRM te prévient', phrase: 'Consigne ou comptoir dit, colis retirés relus, codes de casier lus.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'ventes-natif', date: '2026-11-19', titre: 'Ventes redessinées, tes colis cochés d’office', phrase: 'À envoyer, en route, terminées ; sur ordinateur, la vente s’ouvre à droite.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (19 nov., ext. 5.409) docs/passation/2026-11-19-extension-utile.md
  { id: 'negociation-paliers', date: '2026-11-19', titre: 'Contre-offres par paliers, jamais sous le plancher', phrase: 'Une offre trop basse reçoit une contre-offre, palier par palier.', tab: 'messages', pour: 'tous', mode: 'tous' },
  { id: 'panneau-vinted', date: '2026-11-19', titre: 'Un grand panneau VRM sur Vinted', phrase: 'Messages, annonces, favoris, ventes : tout dans l’onglet Vinted.', tab: 'extension', pour: 'tous', mode: 'tous' },
  { id: 'arrivee-capte', date: '2026-11-19', titre: 'Ce que l’extension a capté, à ton arrivée', phrase: 'Ventes, codes, messages : une feuille les dit, chacun mène à l’élément.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (19 nov., Julien : « je veux que ça demande pour mettre en suspens les annonces et que ça les remette ») docs/passation/2026-11-19-compte-bloque.md
  { id: 'compte-bloque', date: '2026-11-19', titre: 'Compte bloqué par Vinted : VRM te demande', phrase: 'Ses annonces en pause, remises seules quand Vinted le débloque.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (19 nov., Julien : « ça doit être rangé dans les onglets dédiés […] d'autres choses plus intéressantes pour cet onglet »)
  // src/aujourdhui/modele.js, src/designV2/aRegler.js — docs/passation/2026-11-19-aujourdhui-propre.md
  { id: 'aujourdhui-chiffres', date: '2026-11-19', titre: 'Aujourd’hui : tes chiffres d’abord', phrase: 'CA, bénéfice, ventes, panier : jour, semaine, mois. Le reste dans ses onglets.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (19 nov., photo du Mac de Julien : « Extension à installer » alors qu'elle vit dans un autre Chrome) docs/passation/2026-11-19-vite-et-sans-bug.md
  { id: 'page-extension', date: '2026-11-19', titre: 'Une page pour l’extension et tes comptes', phrase: 'Compte ouvert, ce que VRM peut faire, et pourquoi : en clair.', tab: 'extension', pour: 'tous', mode: 'tous' },
  { id: 'extension-ou-elle-est', date: '2026-11-19', titre: 'VRM dit où est ton extension', phrase: 'Installée ici mais muette, ou vivante dans un autre navigateur : dit.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (19 nov., Julien : « ça doit être automatique […] on ne doit pas avoir le bouton relier un achat ») docs/passation/2026-11-19-colis-achat-auto.md
  // (19 nov., capture iPhone : « À retirer · 15 » sous Leboncoin, aucun colis) src/retirerSite.js
  { id: 'retirer-filtre-site', date: '2026-11-19', titre: 'À retirer suit le site choisi', phrase: 'Sous Leboncoin, eBay ou Vestiaire : ses colis et ses nombres seulement.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'colis-achat-auto', date: '2026-11-19', titre: 'Colis à retirer : ce qu’il y a dedans', phrase: 'L’achat s’affiche tout seul ; plus de « Relier l’achat ».', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (19 nov., Julien : « 2 oui ») src/prixAchatRecu.js — le montant du reçu d'un achat relié, jamais un lot, jamais sur une saisie.
  { id: 'prix-achat-recu', date: '2026-11-19', titre: 'Prix d’achat repris du reçu', phrase: 'Achat relié, reçu lu : le prix se pose seul (pas les lots).', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (19 nov., Julien : « trouve autre chose pour relier les achats, mettre les prix plancher […] pratique, pas chiant ») docs/passation/2026-11-19-completer-infos.md
  { id: 'completer-infos', date: '2026-11-19', titre: 'Compléter : une question à la fois', phrase: 'Prix d’achat, prix mini, N° : un toucher par réponse.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (19 nov., Julien : « c'est à l'extension de baisser les prix, c'est pas à moi ») src/PrixPartout.jsx, src/prixAttente.js, extension 5.409.
  // (19 nov., décisions de Julien « 1 oui, 3 oui ») src/reglesAuto.js, background.js regleBaisseTick / masquerAilleursTick, extension 5.409.
  { id: 'regles-auto', date: '2026-11-19', titre: 'Baisse automatique, et vendue ailleurs masquée', phrase: 'Changer le prix → « Baisser seul ». Vendue ailleurs : masquée sur Vinted.', tab: 'cat_annonces', pour: 'tous', mode: 'tous' },
  { id: 'prix-sans-manuel', date: '2026-11-19', titre: 'Changer un prix : un seul geste', phrase: 'Tape le prix, « Appliquer » : l’extension baisse, ou ça part dès que possible.', tab: 'cat_annonces', pour: 'tous', mode: 'tous' },
  // (19 nov., Julien : « quelque chose de drastique, nouveau, totalement différent ») docs/passation/2026-11-19-natif-fondation.md
  { id: 'annonces-egalite', date: '2026-11-19', titre: 'Toutes tes annonces, tous sites, à égalité', phrase: 'Prix mini, acheté, N° pour Leboncoin, eBay et Vestiaire aussi.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'coque-native', date: '2026-11-19', titre: 'Une nouvelle barre, comme sur iPhone', phrase: 'Cinq onglets en bas ; le reste derrière ta photo.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (19 nov., Julien : « quelque chose de drastique, nouveau, totalement différent ») docs/design/NATIF.md, docs/passation/2026-11-19-lisible-partout.md
  //  — les entrées « VRM adopte le design de l’aperçu » et « Essaie le style Apple » (18 nov.) sont retirées : ces habillages et le réglage « Style » n'existent plus.
  { id: 'un-seul-design', date: '2026-11-19', titre: 'Un seul design, clair et lisible', phrase: 'Plus de réglage Style ni Ancien design : tout se lit.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (17 nov., Julien : « tout doit être parfait […] de annonce à brouillon et de brouillon à en ligne ») docs/passation/2026-11-17-republication-parfaite.md
  { id: 'republication-parfaite', date: '2026-11-17', titre: 'Republier : chaque étape visible, tout se reprend', phrase: 'Coffre, brouillon, supprimée, en ligne ; « Reprendre » finit une paire arrêtée.', tab: 'republier', pour: 'tous', mode: 'tous' },
  // (17 nov., Julien : « il faut une liste avec les favoris pour pouvoir les sélectionner etc ») docs/passation/2026-11-17-extension-favoris-liste.md
  { id: 'extension-favoris-liste', date: '2026-11-17', titre: 'Tes favoris en liste, à cocher, sur Vinted', phrase: 'Installe la 5.407 : coche, relis le récapitulatif, puis confirme.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (17 nov., Julien : « pas échanger des messages dans mon app, mais sur Discord ») docs/passation/2026-11-17-carte-coucou.md
  { id: 'carte-coucou', date: '2026-11-17', titre: 'Sur la carte aussi, un coucou', phrase: 'Plus de messages dans VRM : on s’écrit sur Discord.', tab: 'communaute', pour: 'tous', mode: 'tous' },
  // (17 nov., chasse-bugs — Julien : « il y a 4 bordereaux de sélectionné ») docs/passation/2026-11-17-chasse-bugs.md
  { id: 'ventes-ligne-propre', date: '2026-11-17', titre: 'Les lignes de ventes ne se chevauchent plus', phrase: '« Prix d’achat ? » sur sa ligne, pseudo et état entiers.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'imprimer-compte-exact', date: '2026-11-17', titre: 'Imprimer compte ce qui est coché', phrase: 'Les retours cochés comptent ; les colis absents sont nommés.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'ecrans-en-haut', date: '2026-11-17', titre: 'Chaque écran s’ouvre en haut', phrase: 'Après « J’ai déclaré » ou un segment d’Argent, plus au milieu.', tab: 'compta', pour: 'tous', mode: 'tous' },
  // (17 nov., lot stock-rangement) docs/passation/2026-11-17-stock-rangement.md — dans le nouveau design (essai)
  { id: 'stock-ranger-seance', date: '2026-11-17', titre: 'Ranger le stock, une paire à la fois', phrase: 'Nouveau design : la case proposée, un toucher, la suivante arrive.', tab: 'garage', pour: 'sneakers', mode: 'tous' },
  // (17 nov., Julien : « que les personnes puissent se faire coucou […] sur Discord ») docs/passation/2026-11-17-groupes-coucou.md
  { id: 'groupes-coucou', date: '2026-11-17', titre: 'Groupes en trois étapes, et le coucou', phrase: 'Photo, QR code, Discord ; un coucou, puis on s’écrit sur Discord.', tab: 'communaute', pour: 'tous', mode: 'tous' },
  // (17 nov., lot design-v2 — Julien : « Le + dégueulasse ») plus de disque dans la barre ; ses gestes à leur place
  { id: 'plus-de-disque', date: '2026-11-17', titre: 'Plus de « + » dans la barre', phrase: 'Scanner dans la recherche, Publier sur Annonces, Imprimer sur ta journée.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (17 nov., lot design-v2-argent) docs/passation/2026-11-17-design-v2-argent.md — dans l'essai du nouveau design
  { id: 'design-v2-argent', date: '2026-11-17', titre: 'Argent revu dans le nouveau design', phrase: 'Le reçu du mois en grand, six mois, chaque versement numéroté.', tab: 'compta', pour: 'tous', mode: 'tous' },
  // (17 nov., lot design-v2-ventes) docs/passation/2026-11-17-design-v2-ventes.md — Ventes dans le nouveau design (essai)
  { id: 'design-v2-ventes', date: '2026-11-17', titre: 'Ventes revue dans le nouveau design', phrase: 'Imprimer en haut, colis rangés par date limite, recherche avec scanner.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (17 nov., lot design-v2) docs/passation/2026-11-17-design-v2.md — l'essai, éteint par défaut
  { id: 'design-v2-essai', date: '2026-11-17', titre: 'Essaie le nouveau design', phrase: 'Paramètres → Apparence : Aujourd’hui, passes de retrait, un menu par plateforme.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (17 nov., lot design-v2-messages) docs/passation/2026-11-17-design-v2-messages.md — le nouveau design
  { id: 'design-v2-messages', date: '2026-11-17', titre: 'Messages et e-mails, nouveau design', phrase: 'Un compte par groupe, À traiter · Colis · Ventes · Achats, « C’est à moi ».', tab: 'messages', pour: 'tous', mode: 'tous' },
  // (17 nov., lot tampon-qr) docs/passation/2026-11-17-tampon-qr.md
  { id: 'mention-juste-au-dessus', date: '2026-11-17', titre: '« Créé par vrm.center » collé au QR', phrase: 'Juste au-dessus du code, dans le sens de l’étiquette, chaque transporteur.', tab: 'cat_bord', pour: 'tous', mode: 'tous' },
  // (17 nov., Julien : « Améliore les emails aussi ») docs/passation/2026-11-17-emails-beaux.md
  { id: 'emails-cinq-langues', date: '2026-11-17', titre: 'Les e-mails de VRM dans ta langue', phrase: 'Bilan, essai, sécurité : dans la langue choisie, partout lisibles.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (17 nov., Julien : « il faut être très très proche… je veux que ce soit instantané ») docs/passation/2026-11-17-scan-instantane.md
  { id: 'scan-instantane', date: '2026-11-17', titre: 'Le scanner lit de plus loin, aussitôt', phrase: 'Zoom 2×, lecture sans figer ; la fiche de la vente s’ouvre aussitôt.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (17 nov., Julien : « l'extension c'est de la merde… je veux que quand on fait une action sur vinted l'extension prenne tout le site ») docs/passation/2026-11-17-extension-carte-v2.md
  { id: 'extension-carte-v2', date: '2026-11-17', titre: 'L’extension refaite : claire, et plein écran pendant', phrase: 'Installe la 5.406 : messages aux favoris sans 10 min d’attente.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (17 nov., audit d'accessibilité WCAG 2.1 AA) docs/passation/2026-11-17-accessibilite.md
  { id: 'accessibilite-clavier', date: '2026-11-17', titre: 'Plus lisible, et tout au clavier', phrase: 'Focus visible partout, textes sur le bleu éclaircis, « Aller au contenu ».', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (17 nov., Julien : un colis arrivé, deux lignes — envoi à deux transporteurs) docs/passation/2026-11-17-suivi-multi-transporteurs.md
  { id: 'colis-deux-transporteurs', date: '2026-11-17', titre: 'Un colis à deux transporteurs, une ligne', phrase: 'Les deux n° de suivi relient le colis à ton achat.', tab: 'retraits', pour: 'tous', mode: 'tous' },
  // (17 nov., Julien : « on me laisse choisir autre chose que les articles achetés choisis par VRM ») docs/passation/2026-11-17-relier-tout-achat.md
  { id: 'relier-glisser-iphone', date: '2026-11-17', titre: 'Relier achats et ventes : défilement réparé', phrase: 'Une liste à la fois ; touche l’achat, puis la vente.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'relier-tout-achat', date: '2026-11-17', titre: 'Relier : choisis parmi tous tes achats', phrase: 'Un achat relié n’est plus proposé ; un lot, article par article.', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (17 nov., Julien : « je veux qu'il y ait la taille […] à côté des articles achetés pour pouvoir relier ») docs/passation/2026-11-17-relier-taille.md
  { id: 'relier-taille', date: '2026-11-17', titre: 'La taille à côté de chaque achat', phrase: 'Pour relier : taille, état, vendeur ; « ✓ » si c’est la même.', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (17 nov., lot scan-bordereau-vente) docs/passation/2026-11-17-scan-bordereau-vente.md
  { id: 'scan-bordereau-vente', date: '2026-11-17', titre: 'Scanne n’importe quel code du bordereau', phrase: 'Le grand code aussi : VRM ouvre la vente de cette étiquette.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (17 nov., Julien : « je dois rester appuyé sur l'achat […] on ne voit pas ce que j'ai sélectionné ») docs/passation/2026-11-17-relier-toucher.md
  { id: 'relier-toucher', date: '2026-11-17', titre: 'Relier un achat en deux touchers', phrase: 'Touche l’achat, puis la vente : le choix reste affiché en haut.', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (16 nov., lot scan-achat) docs/passation/2026-11-16-scan-achat.md
  { id: 'scan-achat', date: '2026-11-16', titre: 'Scanne un colis reçu : vois ce qu’il contient', phrase: 'Articles, prix payé, vendeur ; « Ranger » ou « Relier à un achat ».', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (16 nov., lot tampons-parametres) docs/passation/2026-11-16-tampons-parametres.md
  { id: 'tampons-apercu', date: '2026-11-16', titre: 'Place ton N° avant d’imprimer', phrase: 'Chaque bordereau en vignette : glisse le tampon, puis Imprimer.', tab: 'cat_bord', pour: 'tous', mode: 'tous' },
  { id: 'tampons-mention-qr', date: '2026-11-16', titre: '« Créé par vrm.center » au-dessus du QR', phrase: 'Visible même sous le scotch ; réglable dans Paramètres → Imprimante.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (16 nov., lot argent-mieux) docs/passation/2026-11-16-argent-mieux.md
  { id: 'argent-lisible', date: '2026-11-16', titre: 'Argent : tout se lit, clair ou sombre', phrase: 'Les ventes pas comptées tiennent en une ligne par raison.', tab: 'argent', pour: 'tous', mode: 'tous' },
  // (16 nov.) docs/passation/2026-11-16-design-restes.md
  { id: 'paire-monte-sites', date: '2026-11-16', titre: 'Leboncoin, eBay, Vestiaire : la paire monte', phrase: 'Touche une annonce : prix, jours, favoris et prix d’achat sur place.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (16 nov., lot extension-restes, extension 5.395) docs/passation/2026-11-16-extension-restes.md
  { id: 'fiche-numero-publier', date: '2026-11-16', titre: 'Son N° à côté de « Publier »', phrase: 'Ouvre Vinted depuis la fiche : l’annonce prend son N°.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'creer-vinted-studio', date: '2026-11-16', titre: 'Créer sur Vinted reprend tes photos du studio', phrase: 'Une fiche sans photo prend celles de son N°.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (16 nov., lot compta-donnees) docs/passation/2026-11-16-compta-donnees.md
  { id: 'partenaires-prorata', date: '2026-11-16', titre: 'Partenaires : remboursement partiel, commission au prorata', phrase: '1 € rendu sur 16,99 € : il reste 2,82 € dus.', tab: 'settings', pour: 'proprietaire', mode: 'tous' },
  { id: 'serie-facture-vrm', date: '2026-11-16', titre: 'Factures en série : envoyer avec VRM', phrase: 'Ta boîte pas connectée ? VRM les envoie, toi en copie.', tab: 'compta', pour: 'pro', mode: 'tous' },
  // (16 nov., lot transporteurs-suivi) docs/passation/2026-11-16-transporteurs-suivi.md
  { id: 'mondial-relay-ventes', date: '2026-11-16', titre: 'Tes colis Mondial Relay vendus sont suivis', phrase: 'Le code postal du point est lu sur ton étiquette.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (16 nov., lot impression-retours) docs/passation/2026-11-16-impression-retours.md
  { id: 'impression-retours', date: '2026-11-16', titre: 'Tes retours s’impriment avec tes envois', phrase: 'Tamponnés RETOUR en grand, comptés à part des ventes.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (16 nov., lot vitesse-lectures) docs/passation/2026-11-16-vitesse-lectures.md
  { id: 'veille-sites', date: '2026-11-16', titre: 'Leboncoin, Vestiaire, messages : à jour tout seuls', phrase: 'Ce que l’extension lit arrive sans recharger, même sur iPhone.', tab: 'messages', pour: 'tous', mode: 'tous' },
  // (16 nov., Julien : « Reprendre là où j'étais ») docs/passation/2026-11-16-reprendre-ou-jetais.md
  { id: 'reprendre-12h', date: '2026-11-16', titre: 'VRM rouvre là où tu étais', phrase: 'Même écran, même filtre, même position, jusqu’à 12 h après.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (16 nov., lot ecrans-restes) docs/passation/2026-11-16-ecrans-restes.md
  { id: 'stock-importe-visible', date: '2026-11-16', titre: 'Ton stock importé se voit au Stock', phrase: 'Sous son N°, avec l’emplacement de ton fichier ; la loupe le trouve.', tab: 'garage', pour: 'tous', mode: 'tous' },
  { id: 'fiche-date-limite', date: '2026-11-16', titre: 'La fiche dit avant quand poster', phrase: 'La date limite du bordereau, sinon l’estimation, comme Colis.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (16 nov., lot abonnement-clair) docs/passation/2026-11-16-abonnement-clair.md
  { id: 'abonnement-rappel', date: '2026-11-16', titre: 'Un rappel 3 jours avant chaque prélèvement', phrase: 'Date et montant lus chez Stripe ; Gérer ou Résilier en un toucher.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (16 nov., ebay-a-traiter) docs/passation/2026-11-16-ebay-a-traiter.md
  { id: 'ebay-a-traiter', date: '2026-11-16', titre: 'eBay À traiter : tâches et retours relus', phrase: 'Aucun retour s’écrit « aucun » ; un refus mène à la reconnexion.', tab: 'ebay_agent', pour: 'tous', mode: 'tous' },
  // (16 nov., Julien : « irréprochable, on ne peut pas se faire bloquer ») docs/passation/2026-11-16-favoris-offres-irreprochable.md
  { id: 'favoris-irreprochable', date: '2026-11-16', titre: 'Favoris et offres : encore plus prudents', phrase: 'Offre relue juste avant ; jamais deux fois le même texte.', tab: 'favoris', pour: 'tous', mode: 'tous' },
  // (16 nov., captures iPhone de Julien) docs/passation/2026-11-16-ventes-clair.md
  // (16 nov., Julien : « comme quand on reste appuyé sur une app sur iPhone ») docs/passation/2026-11-16-relier-glisser.md
  { id: 'relier-glisser', date: '2026-11-16', titre: 'Relier un achat en le glissant', phrase: 'Reste appuyé sur l’achat, pose-le sur la vente ou l’annonce.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'ventes-clair', date: '2026-11-16', titre: 'Ventes plus clair : la liste tout de suite', phrase: 'Les infos sont rangées dans « À regarder » ; une vente, trois lignes.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (16 nov., Julien : « La personnalisation doit être plus simple. ») docs/passation/2026-11-16-personnalisation-simple.md
  { id: 'personnalisation-simple', date: '2026-11-16', titre: '« Modifier ma journée » plus simple', phrase: 'Un interrupteur pour cacher, ↑ ↓ ou glisser pour ranger.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (16 nov., lot retirer-case-compact) docs/passation/2026-11-16-retirer-case-compact.md
  { id: 'stock-case-allumee', date: '2026-11-16', titre: 'Stock : la case vendue reste allumée', phrase: 'Touche-la quand l’article est sorti ; « Annuler » la remet.', tab: 'garage', pour: 'tous', mode: 'tous' },
  // (16 nov., bancs-rouges-a) docs/passation/2026-11-16-bancs-rouges-a.md
  // (16 nov., Julien : « la liaison pour relier l'achat beaucoup plus fiable ») docs/passation/2026-11-16-relier-fiable.md
  { id: 'fiche-delier-recu', date: '2026-11-16', titre: 'Fiche : délier un achat, ouvrir son reçu', phrase: 'À côté de « Achetée » : « Reçu » et « Délier », confirmé.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'relier-fiable', date: '2026-11-16', titre: 'Relier un achat : seulement les propositions sûres', phrase: 'Même taille, même couleur, un seul achat ; le reste dans « Autres pistes ».', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (16 nov., lot vente-email-absente) docs/passation/2026-11-16-vente-email-absente.md
  { id: 'vente-email-particulier', date: '2026-11-16', titre: 'Une vente vue par e-mail est dans Ventes', phrase: 'Même sur un compte particulier, avant que l’extension la lise.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'fiche-porte-achat', date: '2026-11-16', titre: 'Le « ? » d’« Achetée » ouvre la saisie', phrase: 'Et « Déplacer » est sous ⋯, sans « Tout voir ».', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (16 nov., lot achats-qr) docs/passation/2026-11-16-achats-qr.md
  { id: 'achats-qr', date: '2026-11-16', titre: 'À retirer : le QR en un toucher', phrase: 'Bouton QR visible, jours justes, achat relié par ton clic.', tab: 'retraits', pour: 'tous', mode: 'tous' },
  // (16 nov., Julien : « j'ai demandé un retour […] ne me la propose pas ») docs/passation/2026-11-16-achats-retour.md
  { id: 'relier-sans-retour', date: '2026-11-16', titre: 'Un achat renvoyé n’est plus proposé', phrase: 'Retour, litige ou remboursement : il reste dans Retours, pas dans « Relier ».', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (16 nov., lot barre-achats — Julien : « ajoute les Achats dans la barre » ; « je ne veux pas qu'on puisse glisser
  // entre les onglets ») docs/passation/2026-11-16-barre-achats.md
  { id: 'barre-achats', date: '2026-11-16', titre: 'Achats a son onglet dans la barre', phrase: 'Et glisser du doigt ne change plus d’onglet.', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (16 nov., lot ventes-selection) docs/passation/2026-11-16-ventes-selection.md
  { id: 'selection-visible', date: '2026-11-16', titre: 'Sélection : seulement les lignes affichées', phrase: '« Tout sélectionner » prend ce que tu vois, rien de caché.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (16 nov., stabilite-iphone — « l'app bug un peu » sur iPhone) docs/passation/2026-11-16-stabilite-iphone.md
  { id: 'iphone-fluide', date: '2026-11-16', titre: 'Ventes plus fluide sur iPhone', phrase: 'La barre du bas se lit ; eBay « À traiter » aussi.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'captures-16nov', date: '2026-11-16', titre: 'Ma journée : chaque doute une fois', phrase: '« Colis à vérifier » dit quoi faire ; la fiche d’un colis sans doublon.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (15 nov., maquettes validées : « tout est parfait ») docs/passation/2026-11-15-refonte-ventes.md
  // (16 nov., lot plateformes-restes) docs/passation/2026-11-16-plateformes-restes.md
  { id: 'douchette-ebay-lbc', date: '2026-11-16', titre: 'La douchette reconnaît eBay et Leboncoin', phrase: 'N° de commande, SKU VRM ou bordereau Mondial Relay : la vente s’ouvre.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'relier-achats-sites', date: '2026-11-16', titre: 'Relie un achat Leboncoin ou Vestiaire', phrase: 'Ils sont dans la feuille « Relier un achat », avec les achats Vinted.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'facture-ebay-lot', date: '2026-11-16', titre: 'Facture d’une commande eBay à plusieurs articles', phrase: 'Une facture, une ligne par article.', tab: 'compta', pour: 'pro', mode: 'tous' },
  { id: 'ventes-verre', date: '2026-11-15', titre: 'Ventes : colis cochés, place dans le stock', phrase: 'Chaque colis dit où est le carton ; imprime les cochés.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'achats-code-comptoir', date: '2026-11-15', titre: 'Le code de retrait en grand au comptoir', phrase: 'Un chiffre par case, « Je l’ai retiré » juste dessous.', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien choisit la direction D « fiche produit ») docs/passation/2026-11-15-fiche-d.md
  { id: 'fiche-d', date: '2026-11-15', titre: 'La fiche d’un article tient en un écran', phrase: 'La photo, son état, la seule chose à faire ; le reste derrière ⋯.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (15 nov., maquettes validées : « tout est parfait sauf étagères ») docs/passation/2026-11-15-ecrans-verre-2.md
  { id: 'ecrans-verre-2', date: '2026-11-15', titre: 'Argent, Messages, Paramètres : le verre aussi', phrase: 'Le mois en trois chiffres, tes messages par compte, des tuiles.', tab: 'compta', pour: 'tous', mode: 'tous' },
  // (15 nov., refonte-journee) docs/passation/2026-11-15-refonte-journee.md — la maquette validée par Julien.
  { id: 'paire-a-sortir', date: '2026-11-15', titre: 'Une vente tombe : VRM montre le carton', phrase: 'Le meuble, la case allumée, puis « Je l’ai sortie ».', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'journee-verre', date: '2026-11-15', titre: 'Ma journée refaite comme la maquette', phrase: 'Le mois en un verre, les colis avec N°, codes, messages.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'annonces-verre', date: '2026-11-15', titre: 'Annonces : la liste d’abord, chaque rangée claire', phrase: 'Photo, N°, sites et compte, prix ; celles à baisser en ambre.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien : « Le transporteur inconnu n'est pas possible ») docs/passation/2026-11-15-transporteur-connu.md
  { id: 'transporteur-connu', date: '2026-11-15', titre: 'À envoyer : chaque colis a son transporteur', phrase: 'Lu sur l’étiquette ; sinon VRM dit quel compte ouvrir.', tab: 'cat_bord', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien : « Enlève ça, on range une ANNONCE, pas un achat ») docs/passation/2026-11-15-pas-ranger-achat.md
  { id: 'pas-ranger-achat', date: '2026-11-15', titre: 'Plus de rangement proposé sur un achat', phrase: 'Tu ranges l’article au Stock : une case à lui, jamais la même.', tab: 'garage', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien : « vas-y fais tout ») docs/passation/2026-11-15-atelier-arrivee.md — quatre lots.
  { id: 'atelier-arrivee', date: '2026-11-15', titre: 'Achat retiré : de la boîte à en ligne', phrase: 'N°, case, photos, prix payé, fiche, publication : une étape après l’autre.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'historique-complet', date: '2026-11-15', titre: 'Toute l’histoire d’un article, datée', phrase: 'Achat, baisses, offres, masquages, vente, retour : sur sa fiche.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'note-conversation', date: '2026-11-15', titre: 'Ta note, à côté de la conversation', phrase: 'Écrite ou dictée, elle suit l’article jusqu’au message de l’acheteur.', tab: 'messages', pour: 'tous', mode: 'tous' },
  { id: 'taille-texte', date: '2026-11-15', titre: 'Taille du texte réglable', phrase: 'Quatre tailles dans Paramètres, toute l’app suit.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (15 nov., lot fiabilite-auto) docs/passation/2026-11-15-fiabilite-auto.md — VRM se vérifie chaque nuit.
  { id: 'fiabilite-auto', date: '2026-11-15', titre: 'VRM se vérifie seul chaque nuit', phrase: 'Un écart ? Il est dans Tout va bien, avec le geste.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (15 nov., vendre plus) docs/passation/2026-11-15-vendre-plus.md — baisse conseillée, relance des favoris, loupe.
  { id: 'baisses-conseillees', date: '2026-11-15', titre: 'Baisses conseillées pour les annonces qui dorment', phrase: 'Baisser ou garder, la raison, ton plancher ; tu appliques.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'relance-favoris', date: '2026-11-15', titre: 'Relancer les favoris au bon moment', phrase: 'Des gens l’aiment, rien depuis 7 jours : une offre, ton clic.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'loupe-stock-retours', date: '2026-11-15', titre: 'La loupe trouve le stock et les retours', phrase: 'Un lieu de rangement, un suivi de retour : tout se trouve.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (15 nov., lot argent-plus) docs/passation/2026-11-15-argent-plus.md — bilan de fin de mois, seuils, bénéfice, sauvegarde.
  { id: 'bilan-fin-mois', date: '2026-11-15', titre: 'Ton bilan du mois, le 1er', phrase: 'Vendu, reçu, URSSAF, qui dorment : en notification, PDF et tableur.', tab: 'compta', pour: 'tous', mode: 'tous' },
  { id: 'alertes-seuils', date: '2026-11-15', titre: 'Prévenu à 80 % de tes seuils', phrase: 'Plafond micro, TVA, DAC7 : une alerte, une phrase sourcée.', tab: 'compta', pour: 'tous', mode: 'tous' },
  { id: 'benefice-article', date: '2026-11-15', titre: 'Le vrai bénéfice de chaque article', phrase: 'Frais du site et frais notés déduits, le manque nommé.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'sauvegarde-toutes-donnees', date: '2026-11-15', titre: 'Télécharger toutes tes données en un zip', phrase: 'Tableaux, données par catégorie et bordereaux, faits dans ton navigateur.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien : « Je veux que ce soit parfait et irréprochable ») docs/passation/2026-11-15-retour-parfait.md
  { id: 'retour-parfait', date: '2026-11-15', titre: 'Retours : chaque étape jusqu’au remboursement', phrase: 'Imprime depuis l’iPhone ; VRM te rappelle la veille de la date.', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien : « vas-y fais tout ») docs/passation/2026-11-15-securite-ventes.md — trois lignes, trois écrans.
  { id: 'alerte-arnaque-langues', date: '2026-11-15', titre: 'Alerte arnaque dans tes messages, cinq langues', phrase: 'Une phrase dit le risque et quoi faire, rien n’est envoyé.', tab: 'messages', pour: 'tous', mode: 'tous' },
  { id: 'ou-vendre-fiche', date: '2026-11-15', titre: 'Où vendre ? Ce que tu touches par site', phrase: 'Sur la fiche, frais déduits, le meilleur mis en avant.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'objectif-anneau', date: '2026-11-15', titre: 'Ton objectif du mois en anneau', phrase: 'Ma journée dit ce qui reste et le rythme par jour.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien : « Améliore le parcours », « un onglet admin », « Signaler un problème qui t'arrive vraiment ») docs/passation/2026-11-15-parcours-nouveau.md
  { id: 'parcours-nouveau', date: '2026-11-15', titre: 'Signaler un problème : la réponse arrive ici', phrase: 'Reçu, puis la réponse dans Paramètres → Mes signalements.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien : « pratique et compréhensible ») docs/passation/2026-11-15-parametres.md
  { id: 'parametres-categories', date: '2026-11-15', titre: 'Paramètres rangés en dix catégories', phrase: 'Cherche « papier » ou « URSSAF » : le bon réglage s’ouvre.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (15 nov., eBay complet 3) docs/passation/2026-11-15-ebay-complet.md — les gestes (2e tour).
  { id: 'ebay-gestes', date: '2026-11-15', titre: 'eBay : compléter une annonce en un toucher', phrase: 'Pourquoi elle ne se voit pas, et le geste qui corrige.', tab: 'plat_ebay', pour: 'tous', mode: 'tous' },
  // (15 nov., eBay complet 2) docs/passation/2026-11-15-ebay-complet.md — Tableau, Argent, Trafic, Santé.
  { id: 'ebay-tableau', date: '2026-11-15', titre: 'eBay : tableau, versements, trafic et santé', phrase: 'Frais réels, annonces qui ne se voient pas, litiges : tout ici.', tab: 'plat_ebay', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien : « J'aime la 9 ») docs/passation/2026-11-15-verre-extension-site.md — carte, fenêtre, site.
  { id: 'verre-extension-site', date: '2026-11-15', titre: 'Extension et site en verre dépoli', phrase: 'La carte du logo et vrm.center : bleu profond, plaques de verre.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (15 nov., extension 5.388, Julien : « que ça soit parfaitement fiable ») docs/passation/2026-11-15-meme-photo-sure.md
  { id: 'meme-photo-sure', date: '2026-11-15', titre: 'Même photo : « sûr » ou « à vérifier »', phrase: 'Deux mesures différentes doivent dire la même photo pour « sûr ».', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (15 nov., extension 5.390) Julien : « Enlève les 1741 ventes à dater » — l'extension les récupère, aucun geste.
  { id: 'versements-auto', date: '2026-11-15', titre: 'Dates de versement : l’extension s’en occupe', phrase: 'Plus rien à dater toi-même : une ligne dit où elle en est.', tab: 'compta', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien : « tu scannes le code-barres d'un colis… VRM ouvre directement la bonne vente ») docs/passation/2026-11-15-scanner-colis.md
  { id: 'scanner-retrouver', date: '2026-11-15', titre: 'Scanne un colis : VRM ouvre sa vente', phrase: 'Code-barres du colis ou du bordereau : la bonne vente, le bon achat.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien : « J'aime la 9 ») docs/passation/2026-11-15-verre-depoli.md — le thème « Verre dépoli ».
  { id: 'verre-depoli', date: '2026-11-15', titre: 'Nouveau thème : verre dépoli sur bleu profond', phrase: 'Le chiffre du jour en blanc, tout se lit sur le verre.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (15 nov., lot deux-comptes) docs/passation/2026-11-15-deux-comptes-favoris.md — la même paire sur deux comptes Vinted.
  { id: 'deux-comptes', date: '2026-11-15', titre: 'Une paire en vente sur deux comptes', phrase: 'VRM la montre côte à côte : tu retires l’une sur Vinted.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (15 nov., lot favoris-sites, extension 5.392) — une offre aux personnes qui ont aimé, sur Vestiaire.
  { id: 'vestiaire-aimes', date: '2026-11-15', titre: 'Vestiaire : une offre à ceux qui aiment', phrase: 'Messages → Vestiaire : une offre par personne, sur ton toucher.', tab: 'messages', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien : « imagine que la personne publie sur l'app Vinted… ») docs/passation/2026-11-15-numeros-masquees.md
  { id: 'republiee-telephone', date: '2026-11-15', titre: 'Republiée dans l’app Vinted ? Ton N° suit', phrase: 'Même photo : VRM te demande avant de donner un N°.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien) docs/passation/2026-11-15-numeros-nouvelles.md — les annonces publiées hors de VRM.
  { id: 'numeros-nouvelles-annonces', date: '2026-11-15', titre: 'Tes nouvelles annonces reçoivent leur N°', phrase: 'VRM numérote et te le dit, ou te demande le N°.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien : « améliore la liaison entre les achats et les articles ») docs/passation/2026-11-15-achats-liaison.md
  { id: 'achats-liaison', date: '2026-11-15', titre: 'Achat et article côte à côte, vendus compris', phrase: 'Pourquoi, taille, couleur, retrait ; valide les très probables d’un toucher.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien : « l'app bug quand je l'ouvre, améliore l'onglet de chargement ») docs/passation/2026-11-15-ouverture.md
  { id: 'ouverture-verre', date: '2026-11-15', titre: 'Ouverture en verre, sans écran d’erreur', phrase: 'Après une mise à jour, la nouvelle version s’ouvre directement.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien : « tu supprimes les bordereaux lorsque la vente est finalisée et que on a reçu l'argent ») docs/passation/2026-11-15-purge-bordereaux.md
  { id: 'bordereaux-apres-versement', date: '2026-11-15', titre: 'Bordereaux allégés après le versement', phrase: 'Vente finalisée, argent reçu, aucun retour : le PDF part, l’historique reste.', tab: 'colis', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien : « c'est moche et il y a des bugs ») docs/passation/2026-11-15-annonces-achats.md
  { id: 'annonces-achats-cartes', date: '2026-11-15', titre: 'Prix d’achat : cartes nettes, recherche lisible', phrase: 'Une suggestion, Relier en un toucher ; la recherche ne se mélange plus.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien : « tout doit être beaucoup mieux, accompagné, même la publication tout court ») docs/passation/2026-11-15-republier-main.md
  { id: 'republier-main-guide', date: '2026-11-15', titre: 'Republier à la main, pas à pas', phrase: 'Photos dans ta galerie d’un toucher, puis Vinted guidé étape par étape.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien : « tout doit être parfait », « enlève les écritures ») docs/passation/2026-11-15-finition-ecrans.md
  { id: 'finition-ecrans', date: '2026-11-15', titre: 'Chaque écran repassé : rien ne déborde', phrase: 'Moins de phrases, plus rien de coupé, des cibles au doigt.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien : « le retrait sur Leboncoin… hyper intuitif, accompagné ») docs/passation/2026-11-15-retrait-ailleurs.md
  { id: 'retrait-ailleurs', date: '2026-11-15', titre: 'Vendue ? Retire-la ailleurs en un toucher', phrase: 'En tête de Ma journée : un bouton par site, VRM suit tout.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (15 nov.) docs/passation/2026-11-15-argent-attente.md — l'écran « Argent à venir ».
  { id: 'argent-a-venir-etapes', date: '2026-11-15', titre: 'L’argent à venir, étape par étape', phrase: 'Touche « À venir » : par étape, par site, par compte.', tab: 'cat_ventes', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien : « le nombre de cases que l'on veut, des couleurs, la règle des piles ») docs/passation/2026-11-15-stock-etageres.md
  { id: 'stock-etageres', date: '2026-11-15', titre: 'Ton stock en étagères colorées et piles', phrase: 'Autant de cases que tu veux ; une pile se tasse toute seule.', tab: 'garage', pour: 'tous', mode: 'tous' },
  // (15 nov., extension 5.383) Ventes Vestiaire : l'état le plus frais gagne, l'état en mots, le prix de vente.
  { id: 'vestiaire-ventes-justes', date: '2026-11-15', titre: 'Ventes Vestiaire : le vrai état, le vrai prix', phrase: 'Expédiée, en livraison, payée : plus de code ni de faux retard.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (15 nov., extension 5.384, Julien : « vraiment exactement la même photo ») docs/passation/2026-11-15-meme-photo.md
  { id: 'meme-photo', date: '2026-11-15', titre: 'Même photo qu’une paire Vinted : relier', phrase: 'Leboncoin, eBay, Vestiaire : la même photo est reconnue, tu relies.', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (15 nov., lot retours) docs/passation/2026-11-15-retours.md — « À renvoyer » : une carte par retour d'achat.
  { id: 'retours-a-renvoyer', date: '2026-11-15', titre: 'Retours : bordereau, date et heure, une carte', phrase: 'En tête de Ma journée : imprime, dépose, suis le remboursement.', tab: 'achats', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien : « fais de plus belles notifications ») docs/passation/2026-11-15-notifications-belles.md
  { id: 'notifications-belles', date: '2026-11-15', titre: 'Des notifications courtes, la paire nommée', phrase: 'Dates en clair, sans pseudo d’acheteur, le toucher ouvre le bon écran.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (15 nov., extension 5.381) docs/passation/2026-11-15-publier-partout-categories.md — src/correspondances.js
  { id: 'publier-partout-categories', date: '2026-11-15', titre: 'Publier partout : la bonne catégorie sur chaque site', phrase: 'Catégorie Vinted traduite pour Leboncoin, Vestiaire, eBay ; sinon VRM demande.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (15 nov., extension 5.380, captures de Julien) La carte du logo sur vinted.fr : docs/passation/2026-11-15-carte-extension.md
  { id: 'carte-extension-studio', date: '2026-11-15', titre: 'La carte VRM sur Vinted, refaite', phrase: 'Favoris en liste, ventes sans tiret, liens qui marchent, bleu clair.', tab: 'messages', pour: 'tous', mode: 'tous' },
  // (15 nov., extension 5.379, Julien sur Orion iPhone : « Leboncoin marche pas ») docs/passation/2026-11-15-lbc-orion.md
  { id: 'lbc-orion-de-cote', date: '2026-11-15', titre: 'Leboncoin vide sur iPhone : VRM s’écarte', phrase: 'Page vide ? VRM se met de côté et le dit.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (15 nov., extension 5.378) Dates de versement : relevé vérifié avant de dater, délai en heures de Vinted ouvert.
  { id: 'versements-releve-verifie', date: '2026-11-15', titre: 'Dates de versement : relevé vérifié, délai honnête', phrase: 'Le relevé ne date rien avant cinq accords ; délai en heures.', tab: 'compta', pour: 'tous', mode: 'tous' },
  // (15 nov., Julien : « horriblement moche », « ne mets pas paires, tu mets annonces ») docs/passation/2026-11-15-annonces-propre.md
  { id: 'annonces-propre', date: '2026-11-15', titre: 'Annonces : logos nets, nombre par site', phrase: '« Paires » devient « Annonces » ; Relier à Vinted tient dans la ligne.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (14 nov., décision de Julien) Studio bleu clair : la fondation (coque, barre, disque, quatre formes de bouton).
  { id: 'studio-bleu-clair', date: '2026-11-14', titre: 'VRM en bleu clair, un disque en bas', phrase: 'Touche le « + » : chercher, scanner, publier, imprimer.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'studio-paires', date: '2026-11-14', titre: 'Tes paires : touche-en une, elle monte', phrase: 'Liste en rangées, prix, acheté, jours, favoris ; Baisser ou Republier.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'studio-ventes', date: '2026-11-14', titre: 'À expédier : un chiffre, un bouton Imprimer', phrase: 'Tuiles pour filtrer, À retirer en tête d’Achats avec ses codes.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'studio-argent-messages-reglages', date: '2026-11-14', titre: 'Argent, Messages et Paramètres en bleu clair', phrase: 'Grands chiffres posés, quatre formes de bouton, rien n’a disparu.', tab: 'compta', pour: 'tous', mode: 'tous' },
  { id: 'imprimer-un-toucher', date: '2026-11-14', titre: 'Imprimer en un toucher', phrase: 'Le PDF tamponné s’ouvre tout de suite ; le tampon se corrige après.', tab: 'cat_bord', pour: 'tous', mode: 'tous' },
  // (14 nov., 160) src/ideesArgent/ — la vente en main propre
  { id: 'vente-main-propre', date: '2026-11-14', titre: 'Vente en main propre en deux touchers', phrase: 'Le N°, le prix : sortie du stock, comptée dans ton CA.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  // (14 nov., soir — « je n'ai plus les retraits d'achat ») « À retirer » ouvert en tête d'Achats dès qu'un colis attend.
  { id: 'retraits-achats-en-tete', date: '2026-11-14', titre: 'Tes colis à retirer, en tête d’Achats', phrase: 'Ouverts dès qu’un colis attend, avec ses codes.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'studio-journee', date: '2026-11-14', titre: 'Ma journée en tuiles, sous la lumière', phrase: 'Chaque tuile porte son geste ; touche-la, elle se déplie.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'accompagnement', date: '2026-11-14', titre: 'Chaque geste dit ce qu’il fait', phrase: 'Avant, pendant, après ; et si ça bloque, pourquoi et quoi faire.', tab: 'cat_bord', pour: 'tous', mode: 'tous' },
  // (14 nov., idées 154, 157, 158) docs/passation/2026-11-14-idees-paires.md
  { id: 'ligne-de-temps-paire', date: '2026-11-14', titre: 'L’histoire d’une paire, dans l’ordre', phrase: 'Achetée, publiée, baissée, vendue, livrée : chaque date avec sa preuve.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'dupliquer-autre-taille', date: '2026-11-14', titre: 'Dupliquer une annonce dans une autre taille', phrase: 'Mêmes textes, nouvelle taille, N° neuf ; puis Créer sur Vinted.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'meilleure-heure-republier', date: '2026-11-14', titre: 'La meilleure heure pour republier', phrase: 'Tirée de tes ventes datées, proposée quand tu programmes.', tab: 'republier', pour: 'tous', mode: 'tous' },
  // (14 nov., extension 5.377) « L'extension a capté » et la carte du logo en trois onglets.
  { id: 'extension-capte', date: '2026-11-14', titre: 'L’extension dit ce qu’elle vient de capter', phrase: 'Un petit message près du logo VRM : ventes, bordereaux, messages captés.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'carte-favoris-annonces-ventes', date: '2026-11-14', titre: 'Favoris, annonces, ventes dans la carte VRM', phrase: 'Le compte connecté d’abord ; les autres floutés, sans action possible.', tab: 'favoris', pour: 'tous', mode: 'tous' },
  { id: 'exemple-impossible-a-confondre', date: '2026-11-14', titre: 'Exemple avec photos, impossible à confondre', phrase: 'Vraies photos de paires, bandeau et cadre « Exemple » partout.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'refonte-listes', date: '2026-11-14', titre: 'Annonces et Ventes : la liste d’abord', phrase: 'Chiffres en une bande, compte en menu, alertes dans « À faire ».', tab: 'annonces', pour: 'tous', mode: 'tous' },
  // (14 nov., lot colis-plus : propositions 96 à 101, puis l'impression guidée)
  { id: 'impression-guidee', date: '2026-11-14', titre: 'Tout imprimer, guidé pas à pas', phrase: 'Ton imprimante, le tampon de chaque bordereau, puis « Tout est sorti ? ».', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'colis-format-modele', date: '2026-11-14', titre: 'Le bon carton proposé pour chaque modèle', phrase: 'Ton dernier choix pour ce modèle revient ; tu le prends d’un toucher.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'colis-fournitures', date: '2026-11-14', titre: 'Scotch et cartons décomptés à chaque colis', phrase: 'Alerte au seuil que tu choisis, avant d’en manquer.', tab: 'garage', pour: 'tous', mode: 'tous' },
  { id: 'bordereaux-4-par-page', date: '2026-11-14', titre: '4 bordereaux par feuille A4', phrase: 'Sans imprimante thermique : dans l’ordre, avec un trait de coupe.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'douchette-ordinateur', date: '2026-11-14', titre: 'Bipe un bordereau, la vente s’ouvre', phrase: 'Une douchette USB ou Bluetooth sur ordinateur suffit.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'mains-libres-emballage', date: '2026-11-14', titre: 'Emballe sans toucher l’écran', phrase: '« Suivant », « imprimer », « fait » à la voix dans Préparer mes colis.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'temps-par-colis', date: '2026-11-14', titre: 'Ton temps par colis et ton gain', phrase: 'Mesuré dans Préparer mes colis : au moins, jamais deviné.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'ouverture-instantanee', date: '2026-11-14', titre: 'VRM s’ouvre tout de suite, même sans réseau', phrase: 'Tes derniers chiffres de Ma journée, datés, puis tout se relit.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'infos-paire-reponse', date: '2026-11-14', titre: 'Taille réelle et défauts dans ta réponse', phrase: 'Un toucher les met dans le message ; tu envoies.', tab: 'messages', pour: 'tous', mode: 'tous' },
  { id: 'questions-frequentes', date: '2026-11-14', titre: '« Dispo ? » repéré, réponse proposée', phrase: 'Cinq langues, sans IA ; ton clic envoie.', tab: 'messages', pour: 'tous', mode: 'tous' },
  { id: 'catalogue-prive', date: '2026-11-14', titre: 'Catalogue privé en un lien', phrase: 'Photos, tailles, prix ; jamais ton prix d’achat. Expire seul.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'liste-recherche', date: '2026-11-14', titre: 'Ta liste de recherche sur Vinted', phrase: 'L’encart VRM te dit quand l’annonce ouverte correspond.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'carnet-vendeurs', date: '2026-11-14', titre: 'Carnet des vendeurs chez qui tu achètes', phrase: 'Ce que leurs paires ont rapporté, délais, soucis.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'achat-meme-annonce', date: '2026-11-14', titre: 'Annonce déjà achetée signalée', phrase: 'Par son identifiant Vinted, dans Achats et sur Vinted.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'carte-logo-favoris', date: '2026-11-14', titre: 'Messages aux favoris lancés depuis Vinted', phrase: 'Sur vinted.fr, le logo VRM montre à qui écrire et lance l’envoi.', tab: 'favoris', pour: 'tous', mode: 'tous' },
  { id: 'carte-logo-site', date: '2026-11-14', titre: 'Le logo ouvre tes pages Vinted', phrase: 'Ventes, messages, dressing du compte ouvert, sans quitter Vinted.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'creer-vinted-guide', date: '2026-11-14', titre: 'Créer sur Vinted, étape par étape', phrase: 'Ce qui va se passer avant, le brouillon ou la raison après.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'extension-capture', date: '2026-11-14', titre: 'Bordereaux Vinted récupérés, même un peu tard', phrase: 'L’extension relance seule et renvoie ce qui n’était pas parti.', tab: 'colis', pour: 'tous', mode: 'tous' },
  { id: 'dates-versement-conversation', date: '2026-11-14', titre: 'Dates de versement lues dans la conversation', phrase: 'Les ventes sans date se datent par leur conversation Vinted.', tab: 'compta', pour: 'tous', mode: 'tous' },
  { id: 'accueil-cartons-numeros', date: '2026-11-14', titre: 'Tes N° de cartons repris tels quels', phrase: 'VRM lit les N° de tes descriptions et te demande avant.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'accueil-trouve-chez-toi', date: '2026-11-14', titre: 'Ce que VRM a trouvé chez toi', phrase: 'Après l’import, une liste des choses à régler, avec le geste.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'accueil-visite-ecrans', date: '2026-11-14', titre: 'Une visite guidée de quatre écrans', phrase: 'Des bulles sur les bons boutons ; le « ? » la rejoue.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'accueil-mots-conseil', date: '2026-11-14', titre: 'Mots expliqués et conseil du jour', phrase: 'Touche un mot souligné ; un conseil par jour, 30 jours.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'accueil-essai-bilan', date: '2026-11-14', titre: 'Ce que VRM a fait pendant ton essai', phrase: 'Colis suivis, bordereaux imprimés, temps estimé, jours restants.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'refonte-coque', date: '2026-11-14', titre: 'Quatre onglets et un menu en haut', phrase: 'Paires réunit Annonces, Stock, Achats ; le reste sous ☰.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'ergonomie-gestes', date: '2026-11-14', titre: 'Republier ou publier partout depuis la loupe', phrase: 'Tape le N° : « Republier à la main » ou « Publier partout ».', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'refonte-achats', date: '2026-11-14', titre: 'Achats plus dense, plus net', phrase: 'Huit achats par écran, tes sources en chiffres, recherche par N°.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'refonte-messages-stock', date: '2026-11-14', titre: 'Messages, E-mails et Stock : la liste d’abord', phrase: 'Rangées denses, recherche en haut, fil comme sur iPhone.', tab: 'garage', pour: 'tous', mode: 'tous' },
  { id: 'photo-floue', date: '2026-11-14', titre: 'Photo floue ou sombre signalée', phrase: 'Mesuré sur ton téléphone, avant la mise en ligne. Jamais bloquant.', tab: 'cat_annonces', pour: 'tous', mode: 'tous' },
  { id: 'seance-photo', date: '2026-11-14', titre: 'Séance photo, dans l’ordre des N°', phrase: 'Les paires sans photo ou à reprendre, cochées une à une.', tab: 'cat_annonces', pour: 'tous', mode: 'tous' },
  { id: 'recherche-couleur', date: '2026-11-14', titre: 'Chercher tes paires par couleur', phrase: 'Tape « bleu » dans la loupe : la couleur vient de tes photos.', tab: 'cat_annonces', pour: 'tous', mode: 'tous' },
  { id: 'note-dictee', date: '2026-11-14', titre: 'Dicter une note sur une paire', phrase: 'Ton téléphone écrit ce que tu dis dans sa note.', tab: 'cat_annonces', pour: 'tous', mode: 'tous' },
  { id: 'certificat-paire', date: '2026-11-14', titre: 'Le certificat d’authenticité rangé avec la paire', phrase: 'PDF ou photo, dans sa fiche, prêt à envoyer à un acheteur.', tab: 'cat_annonces', pour: 'tous', mode: 'tous' },
  { id: 'fusion-fiches', date: '2026-11-14', titre: 'Fusionner deux fiches de la même paire', phrase: 'Sur ton clic, avec un aperçu ; aucun N° perdu, réversible 30 jours.', tab: 'cat_annonces', pour: 'tous', mode: 'tous' },
  { id: 'journee-selon-heure', date: '2026-11-14', titre: 'Ma journée change selon l’heure', phrase: 'Les colis le matin, le bilan le soir. Ton ordre reste prioritaire.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'ecran-atelier', date: '2026-11-14', titre: 'Écran d’atelier toujours allumé', phrase: 'Colis du jour et chiffre du jour, mis à jour tout seuls.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'connexion-qr', date: '2026-11-14', titre: 'Connexion à l’ordinateur avec ton iPhone', phrase: 'Un QR, ton clic sur l’iPhone, sans retaper ton mot de passe.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'lien-aide', date: '2026-11-14', titre: 'Un lien de 24 h pour ton aide', phrase: 'Colis, codes et bordereaux seulement, aucun montant, coupable à tout moment.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'dossier-litige-echanges', date: '2026-11-14', titre: 'Dossier de litige avec les échanges', phrase: 'Photos, suivi, messages et dates de la vente dans un PDF.', tab: 'litiges', pour: 'tous', mode: 'tous' },
  { id: 'code-ouverture', date: '2026-11-14', titre: 'Code à 4 chiffres à l’ouverture', phrase: 'Gardé sur ton téléphone uniquement, redemandé après quelques minutes.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'apercu-annonce', date: '2026-11-14', titre: 'Aperçu de l’annonce avant Créer sur Vinted', phrase: 'Telle que l’acheteur la verra, dessinée ici, rien envoyé.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'inventaire-tournant', date: '2026-11-14', titre: 'Chaque jour, 10 N° à vérifier', phrase: 'Vu ou pas trouvé : aucun numéro changé, rien supprimé.', tab: 'garage', pour: 'tous', mode: 'tous' },
  { id: 'carte-merci', date: '2026-11-14', titre: 'Carte de remerciement à glisser dans le colis', phrase: 'À ton nom, quatre par page, sans rien de l’acheteur.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'fiche-partout', date: '2026-11-14', titre: 'Une seule fiche pour chaque paire', phrase: 'Touche une vente, un colis, une annonce : sa fiche s’ouvre.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'frais-carte-ventes', date: '2026-11-14', titre: 'Frais de l’année et carte de tes ventes', phrase: 'Ce que chaque site t’a coûté, et où partent tes paires.', tab: 'stats', pour: 'tous', mode: 'tous' },
  { id: 'accueil-nouveaux-tarifs', date: '2026-11-14', titre: 'Une page des tarifs claire', phrase: 'Solo et Pro côte à côte, l’essai, la suite : vrm.center/tarifs.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'accueil-nouveaux-premier-colis', date: '2026-11-14', titre: 'Ton premier colis, accompagné', phrase: 'Imprimer, coller, déposer, suivre : rejouable dans Paramètres → Aide.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'accueil-nouveaux-bilan', date: '2026-11-14', titre: 'Ton bilan en une minute', phrase: 'Ventes de l’année, colis, paires en ligne : rejouable dans Paramètres → Aide.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'accueil-nouveaux-plateformes', date: '2026-11-14', titre: 'Un démarrage pour Leboncoin, Vestiaire, eBay', phrase: 'Sans Vinted, les étapes de tes plateformes, chacune prouvée.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'argent-prix-offres', date: '2026-11-14', titre: 'Offres acceptées et payées, compte par compte', phrase: 'Le taux d’acceptation et de paiement, avec sa couverture.', tab: 'stats', pour: 'tous', mode: 'tous' },
  { id: 'argent-prix-voulu', date: '2026-11-14', titre: 'Le prix à afficher pour toucher ton montant', phrase: 'Frais de chaque site compris, et la même paire à deux prix.', tab: 'stats', pour: 'tous', mode: 'tous' },
  { id: 'argent-prix-soldes', date: '2026-11-14', titre: 'Soldes jusqu’à une date, prix remis ensuite', phrase: 'Baisser le prix → « Jusqu’au… » ; Ma journée propose de remettre.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'argent-prix-comptable', date: '2026-11-14', titre: 'Un lien lecture seule pour ton comptable', phrase: 'La compta seule, expirant, révocable ; et la révision du mois.', tab: 'compta', pour: 'tous', mode: 'tous' },
  { id: 'refonte-sites-reglages', date: '2026-11-14', titre: 'Sites et Paramètres : la liste d’abord', phrase: 'Leboncoin, eBay, Vestiaire : « À faire » en une ligne, rangées denses.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'argent-choix', date: '2026-11-14', titre: 'Coller tes prix, quoi racheter, déclaration prête', phrase: 'Un tableau « N° ; prix » collé, le bénéfice par modèle et taille.', tab: 'stats', pour: 'tous', mode: 'tous' },
  { id: 'recherche-phrase', date: '2026-11-14', titre: 'Chercher en phrase : « nike 42 pas vendue »', phrase: 'Ta phrase devient des filtres que tu changes d’un toucher.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'glisser-selection', date: '2026-11-14', titre: 'Cocher plusieurs annonces en glissant le doigt', phrase: 'Dans Sélectionner, glisse depuis une case, comme dans Photos.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'epingles', date: '2026-11-14', titre: 'Épingle tes paires en haut', phrase: 'Jusqu’à 20, les mêmes sur tous tes appareils.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'comparer-paires', date: '2026-11-14', titre: 'Comparer deux paires côte à côte', phrase: 'Achat, prix, marge, en ligne depuis, état : aligné.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'design-passe-reglages', date: '2026-11-14', titre: 'Paramètres et Notifications plus simples', phrase: 'Choix en un toucher, cartes sans cadre, plus de barre vide.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'design-passe-autres-ecrans', date: '2026-11-14', titre: 'E-mails, Achats et Leboncoin plus nets', phrase: 'Mêmes cartes, mêmes boutons, un seul N° par ligne de recherche.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'design-passe-ecrans', date: '2026-11-14', titre: 'Fiche du N° et écrans plus nets', phrase: 'Tailles, graisses et gris unifiés, boutons à bonne hauteur, textes plus contrastés.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'design-systeme', date: '2026-11-13', titre: 'Un VRM plus calme et plus net', phrase: 'Mêmes écrans, mêmes gestes : formes, boutons et titres harmonisés.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'traduction-ecrans', date: '2026-11-11', titre: 'VRM en anglais, espagnol, italien, allemand', phrase: 'Ma journée, ventes, achats, stock, argent : dans ta langue.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'publier-partout', date: '2026-11-11', titre: 'Publier partout depuis ton annonce Vinted', phrase: 'Leboncoin, Vestiaire, eBay : chaque réglage, par défaut ou par annonce.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'import-historique-sites', date: '2026-11-11', titre: 'Ton historique Leboncoin, Vestiaire et eBay aussi', phrase: 'Anciennes ventes et achats récupérés, site par site.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'favoris-clair', date: '2026-11-11', titre: 'Messages aux favoris : qui, quoi, quand', phrase: 'Choisis tes annonces, vois l’aperçu et l’offre, puis envoie.', tab: 'favoris', pour: 'tous', mode: 'tous' },
  { id: 'lbc-baisse-prix', date: '2026-11-11', titre: 'Baisser tes prix Leboncoin en série', phrase: 'VRM propose les annonces sans favori ; tu choisis et lances.', tab: 'leboncoin', pour: 'tous', mode: 'tous' },
  { id: 'lbc-remise-main-propre', date: '2026-11-11', titre: 'Remise en main propre organisée', phrase: 'Jour, heure, lieu, rappel une heure avant, puis « Remis ».', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'lbc-republier-atelier', date: '2026-11-11', titre: 'Republier sur Leboncoin comme sur Vinted', phrase: 'Ton ordre, ton rythme, par l’extension ou à la main.', tab: 'leboncoin', pour: 'tous', mode: 'tous' },
  { id: 'vestiaire-parcours', date: '2026-11-11', titre: 'Vestiaire : ta vente étape par étape', phrase: 'Envoyé, arrivé, authentifié, payé : chaque étape lue chez Vestiaire.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'vestiaire-baisse-prix', date: '2026-11-11', titre: 'Baisse tes prix Vestiaire en série', phrase: 'Fais-le une fois à la main : VRM apprend ton geste.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'vestiaire-offres-journee', date: '2026-11-11', titre: 'Tes offres Vestiaire dans Ma journée', phrase: 'Celle qui expire le plus tôt d’abord, avec « Répondre ».', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'creer-vinted', date: '2026-11-11', titre: 'Créer sur Vinted depuis une fiche', phrase: 'Un brouillon prêt sur Vinted ; c’est toi qui publies.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'republier-programme', date: '2026-11-11', titre: 'Republier à l’heure que tu choisis', phrase: 'Prépare ta sélection, fixe l’heure : VRM part à ce moment-là.', tab: 'annonces', pour: 'tous', mode: 'complet' },
  { id: 'suivi-travail', date: '2026-11-11', titre: 'Pendant que VRM travaille, tu vois tout', phrase: 'Une barre, chaque étape, pause ou arrêt quand tu veux.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'sante-comptes', date: '2026-11-11', titre: 'La santé de chaque compte Vinted', phrase: 'Note, envois, annulations : « En forme » ou « À surveiller ».', tab: 'stats', pour: 'tous', mode: 'tous' },
  { id: 'photos-comptes', date: '2026-11-11', titre: 'La même photo sur deux comptes', phrase: 'VRM te montre les photos en double entre tes comptes Vinted.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'tva-marge', date: '2026-11-11', titre: 'TVA sur marge : ta déclaration prête', phrase: 'Vente par vente, avec les ventes à compléter. Export CSV et PDF.', tab: 'invoices', pour: 'pro', mode: 'tous' },
  { id: 'achats-email-sites', date: '2026-11-11', titre: 'Achats Leboncoin, eBay, Vestiaire lus par e-mail', phrase: 'Tes confirmations d’achat arrivent : un toucher les ajoute.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'vinted-pro-comptes', date: '2026-11-11', titre: 'Tes comptes Vinted Pro reconnus', phrase: 'Pro seulement si Vinted le dit, et leur argent compté juste.', tab: 'vintedaccounts', pour: 'pro', mode: 'tous' },
  { id: 'ebay-tous-reglages', date: '2026-11-11', titre: 'eBay : tous les réglages de publication', phrase: 'Enchères, offres, retours, politiques : VRM demande ce qui manque.', tab: 'ebay_annonces', pour: 'tous', mode: 'tous' },
  { id: 'visuels-reseaux', date: '2026-11-11', titre: 'Un visuel pour tes réseaux', phrase: 'Carré ou story, depuis une annonce : partage ou télécharge.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'retours-bordereaux', date: '2026-11-11', titre: 'Tes bordereaux de retour, prêts à imprimer', phrase: 'Tamponnés « RETOUR », avec la date limite et le remboursement.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'retour-pas-a-pas', date: '2026-11-11', titre: 'Un retour, pas à pas', phrase: 'Délais, preuves, dossier PDF, puis le retour au stock.', tab: 'litiges', pour: 'tous', mode: 'tous' },
  { id: 'colis-a-leur-place', date: '2026-11-11', titre: 'Tes colis rangés dans Ventes et Achats', phrase: 'À expédier en tête de Ventes, à retirer en tête d’Achats.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'retirer-lisible', date: '2026-11-11', titre: 'À retirer : le code sur chaque ligne', phrase: 'Code, n° de suivi et itinéraire, sans carte.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'ventes-logo-transporteur', date: '2026-11-11', titre: 'Le logo du transporteur sur chaque vente', phrase: 'Au même endroit, dès que son transporteur est connu.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'impression-thermique', date: '2026-11-11', titre: 'Bordereaux pour ton imprimante thermique', phrase: '10 × 15, Dymo, Brother ou ta taille : choisis le tampon.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'toute-app-hors-ligne', date: '2026-11-11', titre: 'Toute l’app marche sans réseau', phrase: 'Tes gestes attendent et partent au retour du réseau.', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'gros-lot-achat', date: '2026-11-11', titre: 'Un lot de N articles, une saisie', phrase: 'Le coût réparti au centime, les fiches et N° en série.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'rangement-guide', date: '2026-11-11', titre: 'Un achat retiré, rangé en un geste', phrase: 'N° et case libre proposés, la fiche déjà remplie.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'livre-registre', date: '2026-11-11', titre: 'Livre des recettes et registre des achats complets', phrase: 'Client, règlement, pièce : par mois, en PDF, CSV ou Excel.', tab: 'compta', pour: 'pro', mode: 'tous' },
  { id: 'alerte-arnaque', date: '2026-11-11', titre: 'Arnaque possible ? VRM te prévient', phrase: 'WhatsApp, faux lien, code SMS : une alerte sur la conversation.', tab: 'messages', pour: 'tous', mode: 'tous' },
  { id: 'prix-mini-manquants', date: '2026-11-11', titre: 'Prix mini manquants, saisis en série', phrase: 'Tape le mini de chaque annonce : le bénéfice s’affiche aussitôt.', tab: 'cat_msg', pour: 'tous', mode: 'tous' },
  { id: 'quoi-republier', date: '2026-11-11', titre: 'Quelles annonces republier ?', phrase: 'Anciennes et peu vues, triées : un toucher les coche, tu lances.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'achetes-pas-en-ligne', date: '2026-11-11', titre: 'Achetés, mais pas encore en ligne', phrase: 'Ce qui dort chez toi depuis plus de 14 jours, prouvé.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'alertes-ebay', date: '2026-11-11', titre: 'Alertes d’achat sur tes recherches eBay', phrase: 'Une nouvelle annonce ? VRM te prévient, avec la marge possible.', tab: 'plat_ebay', pour: 'tous', mode: 'tous' },
  { id: 'securite-comptes', date: '2026-11-11', titre: 'Tes comptes protégés, comme par toi', phrase: 'Pas la nuit, pas en rafale, arrêt au premier refus.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'import-depart', date: '2026-11-11', titre: 'Tout ton historique Vinted, relu', phrase: 'Laisse vinted.fr ouvert : ventes et achats arrivent peu à peu.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'stats-categories', date: '2026-11-11', titre: 'Tes statistiques par catégorie', phrase: 'Ventes, vendu et bénéfice, catégorie par catégorie.', tab: 'stats', pour: 'tous', mode: 'tous' },
  { id: 'achat-photo-ticket', date: '2026-11-11', titre: 'Un achat en photo du ticket', phrase: 'VRM lit le ticket, tu valides le montant.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'partage-fiche', date: '2026-11-11', titre: 'Partage la fiche d’un article', phrase: 'Un lien avec photos et prix, jamais ton prix d’achat.', tab: 'annonces', pour: 'tous', mode: 'tous' },
  { id: 'objectif-mois-v2', date: '2026-11-11', titre: 'Ton objectif du mois, en clair', phrase: 'Ce qu’il reste par jour, et si tu es en avance.', tab: 'stats', pour: 'tous', mode: 'tous' },
  { id: 'pour-mon-comptable', date: '2026-11-11', titre: 'Pour ton comptable, en un clic', phrase: 'Un dossier zip : récap PDF, tableur et factures du mois.', tab: 'compta', pour: 'pro', mode: 'tous' },
  { id: 'aide-integree', date: '2026-11-11', titre: 'Le « ? » de chaque écran montre comment', phrase: 'Une petite animation, puis des fiches « M’y emmener ».', tab: 'journee', pour: 'tous', mode: 'tous' },
  { id: 'app-installable', date: '2026-11-11', titre: 'Installe VRM sur ton téléphone', phrase: 'Elle s’ouvre aussitôt, comme une vraie app.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'facture-siret', date: '2026-11-11', titre: 'Facture Pro : ton entreprise retrouvée', phrase: 'Tape ton SIRET : VRM retrouve ton entreprise, tu confirmes.', tab: 'invoices', pour: 'pro', mode: 'tous' },
  { id: 'tu-vends-quoi', date: '2026-11-11', titre: 'VRM parle de ce que tu vends', phrase: 'Vêtements, livres, lunettes : les mots et exemples suivent tes articles.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'ebay-sans-pointure', date: '2026-11-11', titre: 'eBay : moins de champs', phrase: 'Seuls les champs utiles à tes articles sont demandés.', tab: 'ebay_annonces', pour: 'autre', mode: 'tous' },
  { id: 'profil-photo', date: '2026-11-11', titre: 'Ta photo ouvre ton menu', phrase: 'Touche ta photo : Paramètres et ton compte sont là.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'offres-auto-sures', date: '2026-11-11', titre: 'Offres auto plus sûres', phrase: 'Une jauge, un arrêt en deux gestes, réponses depuis l’onglet Vinted.', tab: 'favoris', pour: 'tous', mode: 'complet' },
  { id: 'republier-main', date: '2026-11-11', titre: 'Republier à la main, en trois gestes', phrase: '« Vinted ↗ » copie aussi la description.', tab: 'republier', pour: 'tous', mode: 'complet' },
  { id: 'cree-par-vrm', date: '2026-11-11', titre: 'Une petite mention sur tes bordereaux', phrase: '« Créé par vrm.center », seulement là où il reste de la place.', tab: 'cat_bord', pour: 'tous', mode: 'tous' },
  { id: 'dates-versement', date: '2026-11-11', titre: 'Les dates de versement arrivent plus vite', phrase: 'Laisse vinted.fr ouvert : l’extension les relève en quelques jours.', tab: 'argent_declarer', pour: 'pro', mode: 'tous' },
  { id: 'messages-tous', date: '2026-11-11', titre: 'Messages s’ouvre sur toutes tes conversations', phrase: 'Vinted, Leboncoin et Vestiaire ensemble, dès l’ouverture.', tab: 'messages', pour: 'tous', mode: 'tous' },
  { id: 'resume-soir-heure', date: '2026-11-11', titre: 'Choisis l’heure du résumé du soir', phrase: 'Entre 18 h et 22 h, dans Paramètres → Notifications.', tab: 'settings', pour: 'tous', mode: 'tous' },
  { id: 'import-tableur', date: '2026-11-10', titre: 'Importe tes achats depuis un tableur', phrase: 'Un fichier .csv ou .xlsx : tu vois tout avant d’importer.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'partage-photo', date: '2026-11-10', titre: 'Partage une photo vers VRM', phrase: 'Photos → Partager → VRM ouvre un nouvel achat avec elle.', tab: 'achats', pour: 'tous', mode: 'tous' },
  { id: 'chercher-photo', date: '2026-11-09', titre: 'Retrouve un article par sa photo', phrase: 'Dans le Stock, l’appareil photo retrouve l’article et son N°.', tab: 'garage', pour: 'tous', mode: 'complet' },
]);

export const motsDe = (s) => String(s || '').trim().split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
export const lienDe = (n) => `?tab=${encodeURIComponent(n.tab)}`;

// Le jour civil local (AAAA-MM-JJ) d'une date d'inscription ; illisible ⇒ null (pas su).
export function jourDe(iso) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const lireVues = (r) => {
  const v = r && typeof r === 'object' && r.vues && typeof r.vues === 'object' && !Array.isArray(r.vues) ? r.vues : {};
  const out = {};
  for (const k of Object.keys(v)) if (typeof v[k] === 'string') out[k] = v[k];
  return out;
};

// Pour qui, selon ce qu'il vend et son statut. « Pas su » (null) ⇒ on ne montre pas
// une nouveauté qui ne vaut que pour certains (un faux « pour toi » ne sert à rien).
//   vend        'sneakers' | 'autre' | null
//   categories  les tuiles de « Tu vends quoi ? » (null = pas répondu)
//   pro         true | false | null (régime micro, société ou marge)
//   proprietaire true | false | null (le propriétaire de l'installation ; pas su ⇒ caché)
//   mode        'simple' | 'complet'
export function pourLui(n, { vend = null, categories = null, pro = null, proprietaire = null, mode = 'complet' } = {}) {
  if (!n) return false;
  if (n.mode === 'complet' && mode === 'simple') return false;
  const cats = Array.isArray(categories) ? categories : null;
  if (n.pour === 'sneakers') return vend === 'sneakers' || !!(cats && cats.includes('sneakers'));
  if (n.pour === 'autre') return vend === 'autre' && !(cats && cats.length === 1 && cats[0] === 'sneakers');
  if (n.pour === 'pro') return pro === true;
  if (n.pour === 'proprietaire') return proprietaire === true;
  return n.pour === 'tous';
}

// Ce qui le concerne, inscription comprise : un compte ne voit QUE ce qui est arrivé
// APRÈS le jour de son inscription (jamais l'historique) ; date d'inscription pas sue ⇒ rien.
export function nouveautesDuCompte(ctx = {}, liste = NOUVEAUTES) {
  const depuis = jourDe(ctx.inscritLe);
  if (!depuis) return [];
  return liste.filter((n) => n && n.date > depuis && pourLui(n, ctx));
}

// Celles à montrer sur la carte : pas encore vues.
export function nouveautesAVoir(ctx = {}, vuesBrut = null, liste = NOUVEAUTES) {
  const vues = lireVues(vuesBrut);
  return nouveautesDuCompte(ctx, liste).filter((n) => !vues[n.id]);
}

// L'état à ranger après « Vu » (ou « Voir » sur une ligne) : on AJOUTE, on n'efface rien.
export function marquerVues(vuesBrut, ids, at = new Date().toISOString()) {
  const vues = lireVues(vuesBrut);
  for (const id of ids || []) if (typeof id === 'string' && id && !vues[id]) vues[id] = at;
  return { vues };
}

// « 1 nouveauté » / « 3 nouveautés ».
export const libelleNombre = (k) => `${k} nouveauté${k > 1 ? 's' : ''}`;

// (21 nov., ux-reglages — Julien : « ce qui a changé après chaque mise en ligne ») LA FEUILLE « NOUVEAU », UNE FOIS :
// à la première ouverture après une mise en ligne, les nouveautés pas encore vues ET jamais montrées par la feuille
// (`deja` = la clé CLE_NOUVEAU_FEUILLE : { ids }), les plus récentes d'abord, 3 au plus. Rien de neuf ⇒ [] (pas de feuille).
export const FEUILLE_MAX = 3;
export function feuilleNouveau(aVoir, deja, max = FEUILLE_MAX) {
  const montrees = new Set(deja && Array.isArray(deja.ids) ? deja.ids.filter((x) => typeof x === 'string') : []);
  const neuves = (Array.isArray(aVoir) ? aVoir : []).filter((n) => n && typeof n.id === 'string' && !montrees.has(n.id));
  if (!neuves.length) return [];
  return [...neuves].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, Math.max(1, max | 0));
}
// Ce qu'on range dès que la feuille s'ouvre : TOUTES les nouveautés à voir de ce moment (pas seulement les 3 montrées) —
// elle ne revient pas pour la 4e. On ajoute, on n'efface rien (borné aux 400 dernières).
export function feuilleMontree(deja, ids, at = new Date().toISOString()) {
  const avant = deja && Array.isArray(deja.ids) ? deja.ids.filter((x) => typeof x === 'string') : [];
  const tout = [...new Set([...avant, ...(ids || []).filter((x) => typeof x === 'string' && x)])];
  return { ids: tout.slice(-400), at };
}
