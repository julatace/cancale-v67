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

export const CLE_NOUVEAUTES_VUES = 'vrm_nouveautes_vues';
export const POUR = Object.freeze(['tous', 'sneakers', 'autre', 'pro', 'proprietaire']);
export const MODES = Object.freeze(['tous', 'complet']);
export const TITRE_MOTS_MAX = 8;
export const PHRASE_MOTS_MAX = 12;

export const NOUVEAUTES = Object.freeze([
  // (17 nov., chasse-bugs — Julien : « il y a 4 bordereaux de sélectionné ») docs/passation/2026-11-17-chasse-bugs.md
  { id: 'ventes-ligne-propre', date: '2026-11-17', titre: 'Les lignes de ventes ne se chevauchent plus', phrase: '« Prix d’achat ? » sur sa ligne, pseudo et état entiers.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'imprimer-compte-exact', date: '2026-11-17', titre: 'Imprimer compte ce qui est coché', phrase: 'Les retours cochés comptent ; les colis absents sont nommés.', tab: 'ventes', pour: 'tous', mode: 'tous' },
  { id: 'ecrans-en-haut', date: '2026-11-17', titre: 'Chaque écran s’ouvre en haut', phrase: 'Après « J’ai déclaré » ou un segment d’Argent, plus au milieu.', tab: 'compta', pour: 'tous', mode: 'tous' },
  // (17 nov., Julien : « l'extension c'est de la merde… je veux que quand on fait une action sur vinted l'extension prenne tout le site ») docs/passation/2026-11-17-extension-carte-v2.md
  { id: 'extension-carte-v2', date: '2026-11-17', titre: 'L’extension refaite : claire, et plein écran pendant', phrase: 'Installe la 5.406 : messages aux favoris sans 10 min d’attente.', tab: 'settings', pour: 'tous', mode: 'tous' },
  // (17 nov., audit d'accessibilité WCAG 2.1 AA) docs/passation/2026-11-17-accessibilite.md
  { id: 'accessibilite-clavier', date: '2026-11-17', titre: 'Plus lisible, et tout au clavier', phrase: 'Focus visible partout, textes sur le bleu éclaircis, « Aller au contenu ».', tab: 'journee', pour: 'tous', mode: 'tous' },
  // (17 nov., Julien : un colis arrivé, deux lignes — envoi à deux transporteurs) docs/passation/2026-11-17-suivi-multi-transporteurs.md
  { id: 'colis-deux-transporteurs', date: '2026-11-17', titre: 'Un colis à deux transporteurs, une ligne', phrase: 'Les deux n° de suivi relient le colis à ton achat.', tab: 'retraits', pour: 'tous', mode: 'tous' },
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
  // (16 nov., lot ecrans-restes) docs/passation/2026-11-16-ecrans-restes.md
  { id: 'stock-importe-visible', date: '2026-11-16', titre: 'Ton stock importé se voit au Stock', phrase: 'Sous son N°, avec l’emplacement de ton fichier ; la loupe le trouve.', tab: 'garage', pour: 'tous', mode: 'tous' },
  { id: 'fiche-date-limite', date: '2026-11-16', titre: 'La fiche dit avant quand poster', phrase: 'La date limite du bordereau, sinon l’estimation, comme Colis.', tab: 'ventes', pour: 'tous', mode: 'tous' },
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
