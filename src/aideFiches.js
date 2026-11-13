// ═══════════════════════════════════════════════════════════════════════════
// LE CENTRE D'AIDE INTÉGRÉ — les fiches « Comment faire… ? » (11 nov., lot centre-aide)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « une courte animation par écran, plus une recherche "comment faire…" ».
// Chaque fiche = une question, 1 à 3 étapes, et « M'y emmener » (le bon écran,
// parfois la bonne feuille). Écrites d'après les VRAIES fonctions de l'app :
// chaque lien passe par le chemin des notifications (`?tab=…`, `vrm:aller`),
// et `audit-centre-aide` vérifie qu'il mène à un écran MONTÉ.
// Aucune IA, aucun service (§2.9) : la recherche tourne dans la page.
//
// ADAPTÉ AU VENDEUR :
//   · `vend` : « paire » pour un vendeur de sneakers, « article » sinon. Les mots
//     viennent de `motsArticle` (src/profilVendeur.js) — chaque forme ENTIÈRE
//     ({tes}, {le}, {un}…), jamais un mot recollé dans une phrase.
//   · `seul` : une fiche réservée à un genre de vendeur ('sneakers' | 'autre').
//   · `niveau: 'complet'` : une fonction avancée. En Simple, la liste de l'écran
//     la tait ; la RECHERCHE la trouve quand même (après les autres).
//     (Tranché le 11 nov. : cacher une réponse cherchée ferait perdre du temps.)
// Rien ne s'ouvre tout seul : ce module ne fait que rendre des données.
// ═══════════════════════════════════════════════════════════════════════════
import { motsArticle } from './profilVendeur.js';

// Les écrans qui ont leur « ? » (clés de src/aideEcrans.js).
export const ECRANS_AIDE = ['journee', 'annonces', 'ventes', 'colis', 'messages', 'achats', 'emails', 'compta', 'dashboard', 'garage', 'settings', 'communaute'];

// Les feuilles qu'une fiche peut ouvrir APRÈS l'écran (écoutées par la coque,
// toujours montée). Une feuille d'un écran chargé à la demande n'est pas ici :
// l'événement partirait avant que l'écran l'écoute.
export const FEUILLES_AIDE = ['vrm:calculette', 'vrm:configuration', 'vrm:visite', 'vrm:recherche-photo', 'vrm:centre-notifs'];

// Les panneaux de Réglages qu'un lien `reglage=` sait ouvrir (`DEMANDE_REGLAGE_SOUS`).
export const REGLAGES_AIDE = ['push', 'agenda', 'vacances', 'numeros', 'modeles', 'imprimante', 'regime', 'apparence', 'stream', 'zoom', 'corbeille', 'verifier', 'toutvabien', 'connexions', 'depannage', 'appareils', 'double', 'equipe', 'abonnement', 'widget'];

export const MOTS_MAX_ETAPE = 14;
export const ETAPES_MAX = 3;

// ── LES FICHES ───────────────────────────────────────────────────────────────
// id · ecran · q (la question) · etapes (1–3) · aller { lien, feuille? } · mots
// (ce qu'on tape d'autre, sans accent) · niveau? · seul?
export const FICHES_AIDE = [
  // Ma journée
  { id: 'journee-faire', ecran: 'journee', q: 'Voir ce que j’ai à faire aujourd’hui', etapes: ['Ouvre Ma journée.', 'Le plus pressé est en haut.', 'Touche une tâche pour faire son geste.'], aller: { lien: '?tab=journee' }, mots: ['taches', 'aujourd', 'accueil', 'priorite', 'urgent'] },
  { id: 'journee-semaine', ecran: 'journee', q: 'Voir le bilan de ma semaine', etapes: ['Ouvre Ma semaine.', 'Ventes, colis et argent des sept derniers jours.'], aller: { lien: '?tab=semaine' }, mots: ['bilan', 'semaine', 'recap', 'resume', 'hebdo'] },
  { id: 'journee-trancher', ecran: 'journee', q: 'Trancher ce que VRM n’a pas su décider', etapes: ['Ouvre « À trancher ».', 'Chaque ligne te mène au bon endroit.', 'Ton choix règle la question.'], aller: { lien: '?tab=trancher' }, mots: ['trancher', 'decider', 'choisir', 'doute', 'question'] },
  { id: 'journee-notifs', ecran: 'journee', q: 'Être prévenu sur mon téléphone', etapes: ['Réglages → Notifications du téléphone.', 'Allume ce qui t’intéresse.'], aller: { lien: '?tab=settings&reglage=push' }, mots: ['notification', 'notifs', 'alerte', 'prevenir', 'push', 'telephone'] },
  { id: 'journee-agenda', ecran: 'journee', niveau: 'complet', q: 'Mettre mes échéances dans mon agenda', etapes: ['Réglages → Échéances dans l’agenda.', 'Copie le lien dans ton agenda.'], aller: { lien: '?tab=settings&reglage=agenda' }, mots: ['agenda', 'calendrier', 'echeance', 'rappel', 'google', 'ical'] },

  // Annonces
  { id: 'annonces-numero', ecran: 'annonces', q: 'Noter le N° de {ce} là où il est rangé', etapes: ['Ouvre Annonces.', 'Chaque annonce porte son N° de rangement.', 'Note-le à son emplacement : il ne change jamais.'], aller: { lien: '?tab=annonces' }, mots: ['numero', 'numeroter', 'carton', 'etiquette', 'rangement', 'n°'] },
  { id: 'annonces-prix-achat', ecran: 'annonces', q: 'Saisir le prix d’achat de {ce}', etapes: ['Ouvre l’annonce dans Annonces.', 'Tape le prix payé sur sa carte.', 'Le bénéfice se complète.'], aller: { lien: '?tab=annonces' }, mots: ['prix', 'achat', 'cout', 'paye', 'saisir', 'benefice'] },
  { id: 'annonces-republier', ecran: 'annonces', niveau: 'complet', q: 'Republier des annonces', etapes: ['Annonces → Actions → Republier.', 'Choisis les annonces, l’ordre et l’espacement.', 'Lance : onglet Vinted ouvert.'], aller: { lien: '?tab=annonces&vue=republier' }, mots: ['republier', 'remonter', 'relancer', 'repost', 'remettre'] },
  { id: 'annonces-baisser', ecran: 'annonces', niveau: 'complet', q: 'Baisser le prix de plusieurs annonces', etapes: ['Annonces : coche les annonces.', 'Touche « Baisser le prix… ».', 'Vérifie l’aperçu, puis applique.'], aller: { lien: '?tab=annonces' }, mots: ['baisser', 'prix', 'reduire', 'promo', 'solde', 'diminuer'] },
  { id: 'annonces-leboncoin', ecran: 'annonces', niveau: 'complet', q: 'Publier sur Leboncoin', etapes: ['Annonces → Leboncoin.', 'Coche les annonces à publier.', 'Touche « Publier sur Leboncoin ».'], aller: { lien: '?tab=annonces&site=leboncoin' }, mots: ['leboncoin', 'lbc', 'publier', 'mettre', 'ligne'] },
  { id: 'annonces-ebay', ecran: 'annonces', niveau: 'complet', q: 'Préparer une annonce sur eBay', etapes: ['Annonces → eBay.', 'Choisis l’annonce, vérifie le prix.', 'Touche « Préparer sur eBay ».'], aller: { lien: '?tab=annonces&site=ebay' }, mots: ['ebay', 'publier', 'preparer', 'mettre', 'ligne'] },
  { id: 'annonces-vestiaire', ecran: 'annonces', niveau: 'complet', q: 'Préparer une annonce sur Vestiaire', etapes: ['Annonces → Vestiaire.', 'Touche « Préparer sur Vestiaire ».'], aller: { lien: '?tab=annonces&site=vestiaire' }, mots: ['vestiaire', 'collective', 'publier', 'preparer'] },
  { id: 'annonces-confirmer', ecran: 'annonces', q: 'Comprendre « à confirmer » sur une annonce', etapes: ['Ce compte n’a pas été lu depuis 24 h.', 'Ouvre Vinted connecté sur ce compte.', 'Rien n’est supprimé entre-temps.'], aller: { lien: '?tab=annonces' }, mots: ['confirmer', 'confirmation', 'pas', 'jour', 'lu'] },
  { id: 'annonces-taille', ecran: 'annonces', seul: 'autre', q: 'Taille et marque sont-elles obligatoires ?', etapes: ['Non : elles sont facultatives.', 'VRM ne les réclame pas.'], aller: { lien: '?tab=annonces' }, mots: ['taille', 'marque', 'obligatoire', 'champ', 'facultatif'] },
  { id: 'annonces-identiques', ecran: 'annonces', seul: 'sneakers', q: 'Ne pas confondre deux paires identiques', etapes: ['VRM relie chaque paire par son annonce, jamais par son titre.', 'Vérifie le N° à son emplacement avant d’emballer.'], aller: { lien: '?tab=annonces' }, mots: ['identique', 'pareil', 'meme', 'confondre', 'double', 'erreur'] },

  // Ventes
  { id: 'ventes-retrouver', ecran: 'ventes', q: 'Retrouver une vente', etapes: ['Touche la loupe en haut.', 'Tape un N°, un pseudo ou un montant.', 'Touche la vente pour l’ouvrir.'], aller: { lien: '?tab=ventes' }, mots: ['retrouver', 'chercher', 'trouver', 'vente', 'pseudo', 'acheteur'] },
  { id: 'ventes-tous-sites', ecran: 'ventes', q: 'Voir mes ventes de tous les sites', etapes: ['Ouvre Ventes.', 'Choisis « Tous » en haut.'], aller: { lien: '?tab=ventes&site=toutes' }, mots: ['tous', 'sites', 'plateformes', 'ensemble', 'toutes'] },
  { id: 'ventes-etapes', ecran: 'ventes', q: 'Suivre les étapes d’une vente', etapes: ['Touche la vente.', 'Ses étapes prouvées s’affichent, datées.'], aller: { lien: '?tab=ventes' }, mots: ['etape', 'suivi', 'statut', 'ou', 'en', 'est'] },
  { id: 'ventes-ebay-traiter', ecran: 'ventes', niveau: 'complet', q: 'Traiter mes ventes eBay', etapes: ['Ventes → eBay → À traiter.', 'Chaque commande dit son geste.'], aller: { lien: '?tab=ventes&site=ebay' }, mots: ['ebay', 'commande', 'traiter', 'agent'] },
  { id: 'ventes-facture', ecran: 'ventes', niveau: 'complet', q: 'Faire une facture à un acheteur', etapes: ['Argent → Factures.', 'Complète « Ma facture » une fois.', 'Touche la vente, puis « Facture ».'], aller: { lien: '?tab=invoices' }, mots: ['facture', 'facturer', 'pro', 'siret', 'recu'] },

  // Colis
  { id: 'colis-bordereau', faq: 5, ecran: 'colis', q: 'Imprimer un bordereau', etapes: ['Ouvre Colis → À envoyer.', 'Touche le colis prêt, puis « Imprimer ».', 'Le N° est tamponné sur le bordereau.'], aller: { lien: '?tab=cat_bord' }, mots: ['imprimer', 'bordereau', 'etiquette', 'impression', 'expedition', 'envoi'] },
  { id: 'colis-tout-imprimer', ecran: 'colis', q: 'Imprimer tous les bordereaux du jour', etapes: ['Colis → « Tout imprimer ».', 'Choisis les colis, puis imprime.'], aller: { lien: '?tab=cat_bord&print=bord' }, mots: ['tout', 'imprimer', 'bordereaux', 'lot', 'jour', 'plusieurs'] },
  { id: 'colis-deposer', ecran: 'colis', q: 'Déposer mes colis au point relais', etapes: ['Au relais, ouvre Colis.', 'Touche « Je dépose ».', 'Scanne chaque bordereau.'], aller: { lien: '?tab=cat_bord' }, mots: ['deposer', 'depot', 'relais', 'poster', 'scanner', 'envoyer'] },
  { id: 'colis-retirer', ecran: 'colis', q: 'Retirer un colis au point relais', etapes: ['Ouvre Colis → À retirer.', 'Montre le code ou son QR.', 'Il reste lisible sans réseau.'], aller: { lien: '?tab=retraits' }, mots: ['retirer', 'retrait', 'code', 'qr', 'recuperer', 'relais'] },
  { id: 'colis-emballer', ecran: 'colis', q: 'Emballer {le} du bon colis', etapes: ['Lis le N° tamponné sur le bordereau.', 'Prends {le} de ce N°.'], aller: { lien: '?tab=cat_bord' }, mots: ['emballer', 'emballage', 'carton', 'colis', 'preparer'] },
  { id: 'colis-verifier', ecran: 'colis', q: 'Comprendre un colis « à vérifier »', etapes: ['VRM n’a pas de preuve claire de son état.', 'Il le montre avec son code, jamais caché.'], aller: { lien: '?tab=cat_bord' }, mots: ['verifier', 'perdu', 'bloque', 'doute', 'probleme'] },

  // Messages
  { id: 'messages-repondre', ecran: 'messages', q: 'Répondre à un acheteur', etapes: ['Ouvre Messages.', 'Touche la conversation.', 'Écris, puis envoie : il part de ton navigateur.'], aller: { lien: '?tab=messages' }, mots: ['repondre', 'message', 'acheteur', 'ecrire', 'conversation', 'chat'] },
  { id: 'messages-offre', ecran: 'messages', q: 'Répondre à une offre', etapes: ['Ouvre la conversation de l’offre.', 'Accepte, refuse ou propose un prix.'], aller: { lien: '?tab=messages' }, mots: ['offre', 'accepter', 'refuser', 'contre', 'negocier', 'prix'] },
  { id: 'messages-rapides', ecran: 'messages', q: 'Préparer des réponses rapides', etapes: ['Ouvre une conversation.', 'Touche le crayon au bout des réponses rapides.', 'Un toucher en met une dans la réponse.'], aller: { lien: '?tab=messages' }, mots: ['rapide', 'modele', 'reponse', 'type', 'automatique', 'texte'] },
  { id: 'messages-offres-auto', ecran: 'messages', niveau: 'complet', q: 'Accepter les offres automatiquement', etapes: ['Messages → Outils → Offres automatiques.', 'Pose ton prix mini à côté du N°.', 'Allume : c’est éteint au départ.'], aller: { lien: '?tab=messages' }, mots: ['automatique', 'auto', 'accepter', 'offre', 'mini', 'seuil'] },
  { id: 'messages-favoris', ecran: 'messages', niveau: 'complet', q: 'Faire une offre à ceux qui ont mis en favori', etapes: ['Messages → Favoris & offres.', 'Choisis les annonces et le prix.', 'Lance : onglet Vinted ouvert.'], aller: { lien: '?tab=messages&vue=favoris' }, mots: ['favori', 'favoris', 'like', 'coeur', 'offre', 'relancer'] },

  // Achats
  { id: 'achats-ajouter', ecran: 'achats', q: 'Ajouter un achat de brocante ou de magasin', etapes: ['Achats → « + Ajouter ».', 'Photo, prix payé, lieu.', 'Touche « Ajouter l’achat ».'], aller: { lien: '?tab=achats&achat=1' }, mots: ['ajouter', 'achat', 'brocante', 'magasin', 'nouveau', 'saisir'] },
  { id: 'achats-tableur', ecran: 'achats', q: 'Importer mes achats depuis un tableur', etapes: ['Achats → « + Ajouter » → Importer un tableur.', 'Choisis ton fichier .xlsx ou .csv.', 'Vérifie l’aperçu, puis importe.'], aller: { lien: '?tab=achats&achat=1' }, mots: ['importer', 'import', 'tableur', 'excel', 'csv', 'xlsx', 'fichier'] },
  { id: 'achats-relier', ecran: 'achats', q: 'Relier un achat à {un}', etapes: ['Touche « Choisir un autre achat ».', 'Cherche dans tes achats.', 'Ton clic relie : rien n’est deviné.'], aller: { lien: '?tab=achats' }, mots: ['relier', 'lier', 'associer', 'rattacher', 'achat', 'vente'] },
  { id: 'achats-calculette', ecran: 'achats', q: 'Savoir si un achat est rentable', etapes: ['Ouvre la calculette d’achat.', 'Tape le prix d’achat et le prix de vente.'], aller: { lien: '?tab=achats', feuille: 'vrm:calculette' }, mots: ['calculette', 'calculer', 'rentable', 'marge', 'gagner', 'combien'] },
  { id: 'achats-photo', ecran: 'achats', q: 'Retrouver {un} avec une photo', etapes: ['Touche l’appareil photo de la loupe.', 'Prends {le} en photo.'], aller: { lien: '?tab=achats', feuille: 'vrm:recherche-photo' }, mots: ['photo', 'image', 'appareil', 'retrouver', 'reconnaitre'] },

  // Stock
  { id: 'stock-trouver', ecran: 'garage', q: 'Trouver où est rangé{e} {un}', etapes: ['Ouvre Stock.', 'Tape son N°.', 'VRM dit le meuble et la case.'], aller: { lien: '?tab=garage' }, mots: ['trouver', 'ou', 'range', 'rangement', 'case', 'meuble', 'stock'] },
  { id: 'stock-inventaire', ecran: 'garage', q: 'Faire l’inventaire de mon stock', etapes: ['Stock → « Faire l’inventaire ».', 'Coche ce que tu as sous la main.'], aller: { lien: '?tab=garage' }, mots: ['inventaire', 'compter', 'verifier', 'stock', 'fin', 'annee'] },
  { id: 'stock-numeros', ecran: 'garage', niveau: 'complet', q: 'Choisir comment s’écrivent mes numéros', etapes: ['Réglages → Numéros de rangement.', 'Choisis la forme, ou « Je numérote moi-même ».'], aller: { lien: '?tab=settings&reglage=numeros' }, mots: ['numero', 'format', 'prefixe', 'lettre', 'numeroter'] },
  { id: 'stock-rouge', ecran: 'garage', q: 'Comprendre un N° en rouge', etapes: ['Deux {noms} présent{es} sous le même N°.', 'Vérifie les deux à leur place.'], aller: { lien: '?tab=garage' }, mots: ['rouge', 'doublon', 'deux', 'meme', 'numero'] },

  // Argent
  { id: 'argent-urssaf', ecran: 'compta', q: 'Savoir combien déclarer à l’URSSAF', etapes: ['Argent → Déclarer.', 'Le montant du mois, daté au versement.'], aller: { lien: '?tab=argent_declarer' }, mots: ['urssaf', 'declarer', 'declaration', 'impot', 'chiffre', 'affaires'] },
  { id: 'argent-declare', ecran: 'compta', q: 'Noter que j’ai déclaré un mois', etapes: ['Argent → Déclarer.', 'Touche « J’ai déclaré ce mois ».'], aller: { lien: '?tab=argent_declarer' }, mots: ['declare', 'fait', 'mois', 'marquer', 'urssaf'] },
  { id: 'argent-regime', ecran: 'compta', q: 'Choisir mon statut fiscal', etapes: ['Réglages → Statut fiscal.', 'Choisis ton régime : VRM ne le devine pas.'], aller: { lien: '?tab=settings&reglage=regime' }, mots: ['statut', 'regime', 'micro', 'entreprise', 'taux', 'fiscal'] },
  { id: 'argent-export', ecran: 'compta', niveau: 'complet', q: 'Exporter pour mon comptable', etapes: ['Ouvre Argent.', 'Touche « Exporter ».', 'Choisis la période : tableur et PDF.'], aller: { lien: '?tab=argent' }, mots: ['exporter', 'export', 'comptable', 'tableur', 'excel', 'pdf', 'csv'] },
  { id: 'argent-benefice', ecran: 'compta', q: 'Voir mon bénéfice du mois', etapes: ['Ouvre Argent.', 'Le bénéfice est en tête.', '« Au moins » : un prix d’achat manque.'], aller: { lien: '?tab=argent' }, mots: ['benefice', 'gagne', 'marge', 'mois', 'argent'] },
  { id: 'stats-meilleur', ecran: 'dashboard', q: 'Voir ce qui se vend le mieux', etapes: ['Argent → Statistiques.', 'Choisis la période en haut.'], aller: { lien: '?tab=stats' }, mots: ['statistiques', 'stats', 'mieux', 'vend', 'meilleur', 'top'] },
  { id: 'stats-periode', ecran: 'dashboard', q: 'Changer la période des statistiques', etapes: ['Argent → Statistiques.', 'Choisis la période en haut : mois, année…'], aller: { lien: '?tab=stats' }, mots: ['periode', 'mois', 'annee', 'semaine', 'dates', 'changer'] },
  { id: 'stats-ambre', ecran: 'dashboard', q: 'Comprendre un chiffre en ambre', etapes: ['L’ambre veut dire : un geste t’attend.', 'Touche le chiffre pour voir lequel.'], aller: { lien: '?tab=stats' }, mots: ['ambre', 'orange', 'couleur', 'jaune', 'chiffre'] },
  { id: 'stats-prix-marche', ecran: 'dashboard', niveau: 'complet', q: 'Voir le prix du marché d’un modèle', etapes: ['Statistiques → Prix.', 'Cherche le modèle.'], aller: { lien: '?tab=prixmarche' }, mots: ['prix', 'marche', 'cote', 'modele', 'combien', 'vaut'] },

  // Paramètres
  { id: 'reglages-extension', faq: 2, ecran: 'settings', q: 'Installer l’extension', etapes: ['Réglages → Vérifier mon installation.', 'Télécharge l’extension, dézippe, charge le dossier.', 'Ouvre Vinted dans ce navigateur.'], aller: { lien: '?tab=settings&reglage=verifier' }, mots: ['extension', 'installer', 'chrome', 'module', 'plugin', 'navigateur'] },
  { id: 'reglages-email', faq: 4, ecran: 'emails', q: 'Relier ma boîte e-mail', etapes: ['Ouvre E-mails.', 'Prends ton adresse VRM.', 'Fais suivre les e-mails de tes plateformes.'], aller: { lien: '?tab=emails' }, mots: ['email', 'mail', 'gmail', 'icloud', 'outlook', 'boite', 'relier', 'transfert'] },
  { id: 'reglages-compte-lu', ecran: 'settings', q: 'Savoir si un compte est bien lu', etapes: ['Réglages → Tout va bien ?', 'Chaque compte dit sa dernière lecture.'], aller: { lien: '?tab=settings&reglage=toutvabien' }, mots: ['compte', 'lu', 'jour', 'marche', 'probleme', 'verifier', 'tout', 'va', 'bien'] },
  { id: 'reglages-vacances', ecran: 'settings', q: 'Mettre mes comptes en vacances', etapes: ['Réglages → Mode vacances.', 'Un compte par toucher, celui de l’onglet Vinted.'], aller: { lien: '?tab=settings&reglage=vacances' }, mots: ['vacances', 'pause', 'absent', 'conge', 'fermer'] },
  { id: 'reglages-config', ecran: 'settings', q: 'Passer en Simple ou en Complet', etapes: ['Ouvre « Ma configuration ».', 'Choisis Simple ou Complet, et ce que tu vends.'], aller: { lien: '?tab=settings', feuille: 'vrm:configuration' }, mots: ['simple', 'complet', 'configuration', 'vends', 'quoi', 'mode', 'niveau'] },
  { id: 'reglages-apparence', ecran: 'settings', q: 'Passer en mode sombre', etapes: ['Réglages → Apparence.', 'Clair, sombre, ou comme ton téléphone.'], aller: { lien: '?tab=settings&reglage=apparence' }, mots: ['sombre', 'nuit', 'noir', 'clair', 'theme', 'apparence', 'dark'] },
  { id: 'reglages-zoom', ecran: 'settings', q: 'Agrandir le texte', etapes: ['Réglages → Taille de l’affichage.', 'Agrandis jusqu’à ce que ce soit confortable.'], aller: { lien: '?tab=settings&reglage=zoom' }, mots: ['taille', 'texte', 'grand', 'agrandir', 'zoom', 'lire', 'police'] },
  { id: 'reglages-imprimante', ecran: 'settings', q: 'Régler mon imprimante à bordereaux', etapes: ['Réglages → Imprimante et bordereaux.', 'Choisis le papier : A4 ou étiquette.'], aller: { lien: '?tab=settings&reglage=imprimante' }, mots: ['imprimante', 'papier', 'a4', 'etiquette', 'format', 'thermique'] },
  { id: 'reglages-corbeille', ecran: 'settings', q: 'Récupérer ce que j’ai supprimé', etapes: ['Réglages → Corbeille.', 'Touche « Remettre » : gardé 30 jours.'], aller: { lien: '?tab=settings&reglage=corbeille' }, mots: ['corbeille', 'supprime', 'annuler', 'recuperer', 'efface', 'restaurer'] },
  { id: 'reglages-stream', ecran: 'settings', niveau: 'complet', q: 'Cacher mes chiffres en direct (stream)', etapes: ['Réglages → Ce que le stream cache.', 'Choisis ce qui se floute.'], aller: { lien: '?tab=settings&reglage=stream' }, mots: ['stream', 'live', 'cacher', 'flouter', 'direct', 'twitch'] },
  { id: 'reglages-double', ecran: 'settings', niveau: 'complet', q: 'Protéger mon compte par un code', etapes: ['Réglages → Double vérification.', 'Scanne le QR avec ton app d’authentification.'], aller: { lien: '?tab=settings&reglage=double' }, mots: ['securite', 'double', 'verification', 'code', 'authentification', 'proteger', '2fa'] },
  { id: 'reglages-equipe', ecran: 'settings', niveau: 'complet', q: 'Inviter un aide pour les colis', etapes: ['Réglages → Équipe.', 'Ton aide voit les colis, jamais l’argent.'], aller: { lien: '?tab=settings&reglage=equipe' }, mots: ['equipe', 'aide', 'inviter', 'employe', 'collaborateur'] },
  { id: 'reglages-abonnement', faq: 7, ecran: 'settings', q: 'Gérer ou résilier mon abonnement', etapes: ['Réglages → Mon abonnement.', 'Touche « Résilier » : tes données restent.'], aller: { lien: '?tab=settings&reglage=abonnement' }, mots: ['abonnement', 'resilier', 'payer', 'prix', 'stripe', 'arreter'] },
  { id: 'reglages-visite', ecran: 'settings', q: 'Revoir la visite de VRM', etapes: ['Lance la visite.', 'Les onglets se présentent un par un.'], aller: { lien: '?tab=settings', feuille: 'vrm:visite' }, mots: ['visite', 'tutoriel', 'tuto', 'decouvrir', 'presentation', 'guide'] },
  { id: 'reglages-depannage', ecran: 'settings', q: 'Résoudre un problème', etapes: ['Réglages → Résoudre un problème.', 'Suis le geste proposé.', 'Sinon : « Signaler un problème ».'], aller: { lien: '?tab=settings&reglage=depannage' }, mots: ['probleme', 'bug', 'marche', 'panne', 'erreur', 'depanner', 'aide'] },

  // E-mails
  { id: 'emails-code', ecran: 'emails', q: 'Retrouver un code de retrait reçu par e-mail', etapes: ['Ouvre E-mails.', 'Les codes sont rangés en tête.'], aller: { lien: '?tab=emails' }, mots: ['code', 'retrait', 'email', 'mail', 'recu'] },
  { id: 'emails-chercher', ecran: 'emails', q: 'Retrouver un e-mail', etapes: ['Touche la loupe en haut.', 'Tape un mot, un n° de suivi ou un code.'], aller: { lien: '?tab=emails' }, mots: ['chercher', 'trouver', 'email', 'mail', 'courrier'] },

  // Communauté
  { id: 'communaute-groupe', ecran: 'communaute', q: 'Rejoindre un groupe de revendeurs', etapes: ['Ouvre Communauté.', 'Entre le code que t’a donné son créateur.'], aller: { lien: '?tab=communaute' }, mots: ['groupe', 'rejoindre', 'code', 'communaute', 'revendeur'] },
  { id: 'communaute-classement', ecran: 'communaute', q: 'Apparaître au classement', etapes: ['Ouvre Communauté.', 'Inscris-toi au classement : rien n’est public sans ça.'], aller: { lien: '?tab=communaute' }, mots: ['classement', 'rang', 'top', 'public', 'inscrire'] },
  { id: 'communaute-carte', ecran: 'communaute', q: 'Apparaître sur la carte, ou la quitter', etapes: ['Ouvre Communauté.', 'Rejoins ou quitte la carte.', 'Ta position est arrondie, jamais ton adresse.'], aller: { lien: '?tab=communaute' }, mots: ['carte', 'position', 'quitter', 'apparaitre', 'map'] },

  // (12 nov., ouverture aux clients) LES 10 QUESTIONS LES PLUS PROBABLES d'un nouveau
  // client (`faq: rang`) : 4 fiches ci-dessus + celles-ci. Affichées dans chaque « ? »
  // (« Les questions les plus posées », `faqAide`), et trouvées par la recherche.
  { id: 'faq-prix', faq: 1, ecran: 'settings', q: 'Combien coûte VRM ?', etapes: ['Solo : 16,99 € par mois, un compte vendeur par site.', 'Pro : 19,99 € par mois, comptes vendeurs illimités.', 'Sept jours gratuits au début, sans engagement.'], aller: { lien: '?tab=settings&reglage=abonnement' }, mots: ['prix', 'cout', 'tarif', 'payer', 'abonnement', 'solo', 'pro', 'essai', 'gratuit'] },
  { id: 'faq-vinted', faq: 3, ecran: 'settings', q: 'Relier mon compte Vinted', etapes: ['Installe l’extension VRM dans ton navigateur.', 'Ouvre vinted.fr, connecté à ton compte.', 'L’extension le relie toute seule.'], aller: { lien: '?tab=vintedaccounts' }, mots: ['relier', 'lier', 'compte', 'vinted', 'connecter', 'ajouter'] },
  { id: 'faq-factures', faq: 6, ecran: 'settings', q: 'Trouver les factures de mon abonnement', etapes: ['Réglages → Mon abonnement.', 'Tes factures sont en bas, en PDF.'], aller: { lien: '?tab=settings&reglage=abonnement' }, mots: ['facture', 'abonnement', 'recu', 'pdf', 'paiement', 'stripe'] },
  { id: 'faq-donnees', faq: 8, ecran: 'settings', q: 'Télécharger toutes mes données', etapes: ['Réglages → Mon compte → Tes données.', 'Touche « Exporter mes données ».', 'Un fichier zip arrive, même sans abonnement.'], aller: { lien: '?tab=settings' }, mots: ['donnees', 'exporter', 'telecharger', 'rgpd', 'fichier', 'zip', 'portabilite'] },
  { id: 'faq-supprimer', faq: 9, ecran: 'settings', q: 'Supprimer mon compte', etapes: ['Réglages → Mon compte, tout en bas.', 'Tape SUPPRIMER, puis ton mot de passe.', '30 jours pour annuler, puis tout est effacé sauf tes factures.'], aller: { lien: '?tab=settings' }, mots: ['supprimer', 'effacer', 'compte', 'fermer', 'rgpd', 'quitter'] },
  { id: 'faq-probleme', faq: 10, ecran: 'settings', q: 'J’ai un problème : prévenir VRM', etapes: ['Réglages → Signaler un problème.', 'Écris ce qui ne va pas.', 'Coche « Réponds-moi par e-mail » pour une réponse.'], aller: { lien: '?tab=settings' }, mots: ['probleme', 'bug', 'contact', 'aide', 'support', 'signaler', 'joindre', 'email'] },
];

// ── LES MOTS DU VENDEUR ──────────────────────────────────────────────────────
// Les fiches : des formes ENTIÈRES de `motsArticle` ({tes}, {le}…).
export function remplirMots(texte, vend) {
  const m = motsArticle(vend);
  return String(texte == null ? '' : texte).replace(/\{(\w+)\}/g, (x, k) => (Object.prototype.hasOwnProperty.call(m, k) ? m[k] : x));
}
// Les textes d'avant (gestes et questions du « ? », écrits pour Julien) : une
// table de GROUPES ENTIERS, accord compris (« deux paires présentes » ⇒
// « deux articles présents »). `audit-centre-aide` vérifie qu'aucun « paire »
// ni aucun accord faux (« la article ») ne reste pour un autre vendeur.
const GROUPES_AUTRE = [
  ['Deux paires présentes', 'Deux articles présents'], ['deux paires présentes', 'deux articles présents'],
  ['la mauvaise chaussure', 'le mauvais article'], ['une autre paire', 'un autre article'], ['la bonne paire', 'le bon article'],
  ['Chaque paire', 'Chaque article'], ['chaque paire', 'chaque article'], ['deux paires', 'deux articles'],
  ['Une paire', 'Un article'], ['une paire', 'un article'], ['La paire', 'L’article'], ['de la paire', 'de l’article'], ['la paire', 'l’article'],
  ['Tes paires', 'Tes articles'], ['tes paires', 'tes articles'], ['les paires', 'les articles'], ['des paires', 'des articles'],
];
export function pourVendeur(texte, vend) {
  let t = String(texte == null ? '' : texte);
  if (vend === 'sneakers') return t;
  for (const [a, b] of GROUPES_AUTRE) t = t.split(a).join(b);
  return t;
}

// Les fiches de CE vendeur : mots remplis, `seul` respecté, `avance` marqué.
export function fichesPour({ vend = null, mode = 'complet' } = {}) {
  const v = vend === 'sneakers' ? 'sneakers' : 'autre';
  return FICHES_AIDE.filter((f) => !f.seul || f.seul === v).map((f) => ({
    ...f, q: remplirMots(f.q, v), etapes: f.etapes.map((e) => remplirMots(e, v)),
    avance: f.niveau === 'complet', cachee: mode === 'simple' && f.niveau === 'complet',
  }));
}
// (12 nov.) Les questions les plus posées, dans l'ordre de leur rang (`faq`).
export const faqAide = (fiches) => (fiches || []).filter((f) => Number.isInteger(f.faq)).sort((a, b) => a.faq - b.faq);
// Les 3 à 5 fiches d'un écran (en Simple, les avancées se taisent).
export const fichesEcran = (fiches, ecran, max = 5) => (fiches || []).filter((f) => f.ecran === ecran && !f.cachee).slice(0, max);

// ── LA RECHERCHE « COMMENT FAIRE… ? » ────────────────────────────────────────
// Tolérante : accents, majuscules, pluriels, une faute de frappe (deux sur un
// long mot), un début de mot. Les petits mots (« comment », « je », « un »…)
// ne comptent pas. Chaque mot tapé doit trouver sa place ; sinon les fiches
// qui en trouvent la moitié sortent, marquées `approx`.
export const normaliserAide = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`]/g, ' ').replace(/[^a-z0-9°]+/g, ' ').trim();
const VIDES = new Set(('comment faire fait faut je j tu on il y un une le la les l de du des d mon ma mes ton ta tes son sa ses a au aux pour sur en et ou est ce c ca cela que qu qui quoi quand avec dans par se s me m ne n pas puis peut peux veux voudrais dois doit').split(' '));
// Un mot et ses voisins (le même sens, une autre façon de le dire).
const VOISINS = {
  etiquette: 'bordereau', etiquettes: 'bordereau', bordereaux: 'bordereau',
  impression: 'imprimer', imprime: 'imprimer', imprimer: 'imprimer', print: 'imprimer', sortir: 'imprimer',
  mail: 'email', mails: 'email', courriel: 'email', 'e': 'email',
  paire: 'article', paires: 'article', chaussure: 'article', chaussures: 'article', sneaker: 'article', sneakers: 'article', basket: 'article', baskets: 'article', produit: 'article', objet: 'article', vetement: 'article',
  colis: 'colis', paquet: 'colis', envoi: 'envoyer', expedier: 'envoyer', poster: 'envoyer',
  num: 'numero', no: 'numero', n: 'numero', numeros: 'numero',
};
const racine = (w) => { const v = VOISINS[w] || w; return v.length > 3 ? v.replace(/(s|x)$/, '') : v; };
export const motsRequete = (q) => normaliserAide(q).split(' ').filter((w) => w && !VIDES.has(w)).map(racine);
// Distance d'édition (transposition comprise), arrêtée au-delà de `max`.
export function distance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let mini = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      if (d[i][j] < mini) mini = d[i][j];
    }
    if (mini > max) return max + 1;
  }
  return d[a.length][b.length];
}
const fautesPermises = (w) => (w.length >= 9 ? 2 : w.length >= 4 ? 1 : 0);
// Comment un mot tapé rejoint un mot de la fiche : 1 pareil · 0,8 début · 0,6 faute.
function accord(m, w) {
  if (m === w) return 1;
  if (m.length >= 3 && w.startsWith(m)) return 0.8;
  const f = fautesPermises(m);
  if (f && distance(m, w, f) <= f) return 0.6;
  return 0;
}
const NOMS_ECRANS = { journee: 'ma journee', annonces: 'annonces', ventes: 'ventes', colis: 'colis', messages: 'messages', achats: 'achats', emails: 'email', compta: 'argent compta', dashboard: 'statistiques', garage: 'stock', settings: 'reglages parametres', communaute: 'communaute' };
function sacDe(f) {
  const champ = (t, poids) => motsRequete(t).map((w) => [w, poids]);
  return [...champ(f.q, 3), ...champ((f.mots || []).join(' '), 2), ...champ(f.etapes.join(' '), 1), ...champ(NOMS_ECRANS[f.ecran] || '', 1)];
}
export function chercherAide(fiches, q, { max = 8 } = {}) {
  const mots = [...new Set(motsRequete(q))];
  if (!mots.length) return [];
  const notes = [];
  for (const f of fiches || []) {
    const sac = sacDe(f);
    let score = 0, trouves = 0;
    for (const m of mots) {
      let best = 0;
      for (const [w, p] of sac) { const a = accord(m, w); if (a && a * p > best) best = a * p; }
      if (best) { trouves++; score += best; }
    }
    if (!trouves) continue;
    notes.push({ f, score: score - (f.avance ? 0.5 : 0), tout: trouves === mots.length, part: trouves / mots.length });
  }
  const tout = notes.filter((n) => n.tout);
  let liste = tout.length ? tout : notes.filter((n) => n.part >= 0.5).map((n) => ({ ...n, approx: true }));
  // Loin derrière la meilleure (moins de la moitié de sa note) : du bruit, pas une réponse.
  const haut = Math.max(0, ...liste.map((n) => n.score));
  liste = liste.filter((n) => n.score >= haut / 2);
  liste.sort((a, b) => b.score - a.score || FICHES_AIDE.findIndex((x) => x.id === a.f.id) - FICHES_AIDE.findIndex((x) => x.id === b.f.id));
  return liste.slice(0, max).map((n) => ({ ...n.f, approx: !!n.approx }));
}

// ── « M'Y EMMENER » ──────────────────────────────────────────────────────────
// Le chemin des liens et des notifications (`vrm:aller` → `goto` dans la coque),
// puis, s'il y en a une, la feuille (écoutée par la coque). Rien n'est écrit.
export function emmener(f, { envoyer = (n, d) => window.dispatchEvent(d === undefined ? new Event(n) : new CustomEvent(n, { detail: d })), plusTard = (fn) => setTimeout(fn, 120) } = {}) {
  const a = f && f.aller;
  if (!a || typeof a.lien !== 'string' || !a.lien.startsWith('?tab=')) return false;
  try { envoyer('vrm:aller', a.lien); } catch (_) { return false; }
  if (a.feuille && FEUILLES_AIDE.includes(a.feuille)) plusTard(() => { try { envoyer(a.feuille); } catch (_) {} });
  return true;
}
