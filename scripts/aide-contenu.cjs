// ── LE TEXTE DU CENTRE D'AIDE (8 nov.) — produit par scripts/aide-generer.cjs ──
// Une phrase = une règle de VRM (CLAUDE.md §2, §3, §5) ou un geste qui existe
// dans l'app. Court : Julien n'aime pas les murs de texte. Tutoiement, comme l'app.
// Les slugs sont ceux de src/aideEcrans.js (`ARTICLES_AIDE`) ; audit-aide-ecrans
// vérifie qu'ils correspondent.
'use strict';

const ARTICLES = [
  {
    slug: 'extension', titre: 'Installer l’extension (Chrome, Orion)',
    resume: 'La petite extension qui lit tes pages Vinted et les range dans VRM.',
    mots: 'chrome edge brave opera orion iphone ipad extension installer zip dossier mode développeur mise à jour recharger',
    chapo: 'VRM ne va rien chercher tout seul sur Vinted. Une petite extension, installée dans ton navigateur, lit tes pages quand tu y passes et range tout dans VRM. Elle ne touche jamais à ton mot de passe Vinted.',
    blocs: [
      { titre: 'Sur ordinateur : Chrome, Edge, Brave ou Opera', id: 'chrome' },
      { etapes: [
        'Télécharge l’extension : [VRM-extension.zip](/VRM-extension.zip).',
        'Ouvre le fichier pour le décompresser : tu obtiens **un dossier** « VRM-extension ». Range-le où il ne bougera plus.',
        'Ouvre la page des extensions : `chrome://extensions` dans Chrome (`edge://extensions` dans Edge).',
        'Allume l’interrupteur **Mode développeur**, en haut à droite. C’est normal : l’extension n’est pas sur le magasin.',
        'Clique **Charger l’extension non empaquetée** et choisis le dossier « VRM-extension ».',
        'Touche l’icône de l’extension, puis **Compte VRM** : ton e-mail et ton mot de passe **VRM** (jamais ceux de Vinted).',
        'Ouvre vinted.fr dans ce même navigateur, connecté sur ton compte : la lecture commence.',
      ] },
      { note: 'Une mise à jour se fait en remplaçant le dossier par le nouveau (même nom, même endroit), puis en touchant ⟳ sur la carte VRM de `chrome://extensions`. Sans ⟳, le navigateur garde l’ancien code.', titreNote: 'Mettre à jour.' },
      { note: 'L’extension agit seulement au nom du compte connecté dans l’onglet, une requête à la fois, et jamais plus de 50 gestes par heure et par compte.', titreNote: 'Ce qu’elle s’interdit.' },
      { titre: 'Sur iPhone et iPad : Orion', id: 'orion' },
      'Safari n’accepte pas l’extension. Orion (gratuit) installe les extensions faites pour Firefox, dont VRM.',
      { etapes: [
        'Dans Orion : menu **•••** → **Réglages** → **Extensions** : autorise l’installation des extensions Firefox.',
        'Avec Orion, télécharge [VRM-Orion.xpi](/VRM-Orion.xpi) et enregistre-le dans Fichiers.',
        'Menu **•••** → **Extensions** → **+** → installation depuis un fichier : choisis VRM-Orion.xpi et accepte les permissions.',
        'Si Orion refuse le fichier : télécharge [VRM-Orion-dossier.zip](/VRM-Orion-dossier.zip), touche-le dans Fichiers (iOS en fait un dossier « VRM-Orion »), puis choisis ce dossier à l’étape précédente.',
        'Dans la fenêtre de l’extension : **avec mon mot de passe VRM**, puis ouvre Vinted dans ce même Orion, connecté.',
      ] },
      { note: 'Installer VRM dans Orion ne l’installe ni dans Safari, ni dans l’application Vinted. Une web app Vinted ajoutée à l’écran d’accueil peut s’ouvrir hors d’Orion : ouvre Vinted dans Orion.', titreNote: 'À savoir.' },
      'Firefox : la version de l’extension n’est pas encore publiée dans sa boutique. En attendant, utilise Chrome, Edge, Brave ou Opera.',
    ],
    voir: ['boite-email', 'tout-va-bien'],
  },
  {
    slug: 'boite-email', titre: 'Relier ta boîte e-mail (Gmail, iCloud, Yahoo)',
    resume: 'Fais suivre les e-mails de tes plateformes vers VRM : codes de retrait, bordereaux, ventes.',
    mots: 'gmail icloud yahoo outlook orange sfr free relais apple masquer mon adresse filtre règle transfert adresse vrm',
    chapo: 'Les e-mails de Vinted, Leboncoin, Mondial Relay ou Chronopost portent les codes de retrait, les bordereaux et les dates limites. Ta messagerie en fait suivre une **copie** vers ton adresse VRM. Ton courrier personnel, lui, ne part pas.',
    blocs: [
      'Ton adresse VRM et la règle à copier sont dans VRM : **Réglages → Mes e-mails**. VRM t’envoie aussi un lien à ta boîte : clique-le depuis VRM connecté, il prouve que l’adresse est à toi.',
      { titre: 'Gmail', id: 'gmail' },
      { etapes: [
        'Sur ordinateur, dans Gmail : la roue en haut à droite → **Voir tous les paramètres**.',
        'Onglet **Transfert et POP/IMAP** → **Ajouter une adresse de transfert** → colle l’adresse de VRM.',
        'Gmail envoie un code de validation à VRM : il apparaît dans **Réglages → E-mails → Adresses** une fois ton adresse confirmée. Tape-le dans Gmail.',
        'Dans la barre de recherche : l’icône des options → champ **De** : colle la règle donnée par VRM → **Créer un filtre** → coche **Transférer à** l’adresse de VRM.',
      ] },
      { titre: 'iCloud Mail', id: 'icloud' },
      { etapes: [
        'Sur icloud.com/mail (ordinateur) : la roue → **Réglages** → **Règles**.',
        '**Ajouter une règle** → **Si un message est de** → l’expéditeur (un par règle).',
        '**Alors** → **Transférer à** → colle l’adresse de VRM. Recommence pour chaque expéditeur de la liste.',
      ] },
      { titre: 'Le relais d’Apple (« Masquer mon adresse »)', id: 'relais-apple' },
      'Si ton compte Vinted a été créé avec « Se connecter avec Apple », ses e-mails passent par une adresse relais d’Apple. Ce n’est pas une boîte : Apple fait suivre vers UNE de tes boîtes. Il suffit que ce soit une boîte déjà reliée à VRM.',
      { etapes: [
        'Sur l’iPhone : **Réglages** → ton nom → **iCloud** → **Masquer mon adresse e-mail**.',
        '**Transférer à** → choisis une boîte qui arrive déjà à VRM.',
        '**Réglages** → ton nom → **Connexion et sécurité** → **Se connecter avec Apple** → Vinted : le transfert des e-mails doit être activé.',
      ] },
      { titre: 'Yahoo', id: 'yahoo' },
      'Yahoo ne fait suivre les e-mails qu’avec **Yahoo Mail Plus** (payant), et il envoie alors toute la boîte. Le plus simple, gratuit : dans les paramètres de ton compte Vinted, remplace l’adresse par celle d’une boîte déjà reliée à VRM (Gmail ou iCloud).',
      { note: 'Aucun e-mail n’est jeté : celui qu’aucune règle ne reconnaît est gardé tel quel. C’est l’adresse de réception qui décide à quel compte VRM il appartient, jamais l’expéditeur.', titreNote: 'Rien ne se perd.' },
      { note: 'Certains comptes Outlook refusent le transfert automatique. Si, après le prochain e-mail de Vinted, rien n’arrive dans VRM, c’est qu’Outlook l’a bloqué.', titreNote: 'Outlook.' },
    ],
    voir: ['retirer-colis', 'bordereau'],
  },
  {
    slug: 'numeros', titre: 'Les numéros de rangement',
    resume: 'Un numéro par article : il dit où il est rangé (carton, étagère, bac…), jamais redonné.',
    mots: 'numéro rangement carton étagère stock meuble case doublon rouge réattribué archive B je numérote moi-même sku',
    chapo: 'Chaque paire en ligne reçoit un numéro. Tu l’écris là où tu la ranges (carton, étagère, bac…) : quand elle se vend, VRM te dit laquelle prendre. **Même avec 50 paires identiques, tu ne dois pas pouvoir te tromper.**',
    blocs: [
      { liste: [
        'Le numéro suit l’ordre de mise en ligne : la paire suivante prend le suivant.',
        '**Un numéro n’est jamais redonné** à une autre paire, même quand l’ancienne est vendue : il est peut-être encore écrit sur un rangement.',
        'Un numéro qui monte haut est normal : il compte aussi les paires déjà parties.',
        'Un numéro qui commence par **B** est un ancien numéro d’archive. Il n’est jamais redonné non plus.',
      ] },
      { capture: 'annonces.jpg', alt: 'L’écran Annonces de VRM sur iPhone, avec le numéro de chaque paire', legende: 'Annonces : le numéro de chaque paire, à côté de sa photo.', h: 844 },
      { titre: 'Ce qui peut changer un numéro', id: 'changer' },
      { liste: [
        'Une annonce **sans** numéro en reçoit un.',
        'Deux paires sous le même numéro (un doublon) : VRM le règle seul et liste les **nouveaux numéros à écrire**, jusqu’à ce que tu touches **C’est écrit**.',
        'Une paire republiée garde le numéro de l’ancienne annonce.',
      ] },
      { note: 'Deux paires présentes sous le même numéro, c’est le seul risque d’envoyer la mauvaise chaussure. C’est le seul endroit où VRM met du rouge : vérifie les deux, là où elles sont rangées.', titreNote: 'Le rouge.' },
      { titre: 'Retrouver une paire', id: 'stock' },
      'Dans **Stock**, cherche un numéro : VRM te dit le meuble et la case.',
      { titre: '« Je numérote moi-même »', id: 'moi-meme' },
      'Tu as déjà ta numérotation ? Allume **Réglages → Numéros de rangement → Je numérote moi-même dans mes annonces**. VRM ne donne plus aucun numéro : il lit le tien (fin de description, titre, SKU eBay, référence Leboncoin). Deux numéros dans une annonce, ou un numéro qui contredit l’autre site : la paire est « à vérifier », et c’est toi qui tranches.',
    ],
    voir: ['bordereau', 'tout-va-bien'],
  },
  {
    slug: 'bordereau', titre: 'Imprimer un bordereau',
    resume: 'Les colis prêts, le bordereau tamponné du numéro, la date limite d’envoi.',
    mots: 'bordereau étiquette imprimer pdf colis expédier envoyer date limite imprimante thermique a4 ebay leboncoin vinted',
    chapo: 'Quand une paire se vend, le bordereau arrive avec la vente. VRM le range dans **Colis**, tamponné du numéro de rangement : tu imprimes, tu prends la bonne paire là où elle est rangée, tu déposes.',
    blocs: [
      { etapes: [
        'Ouvre **Colis**. En haut : les colis **prêts à imprimer**.',
        'Touche un colis pour ouvrir son bordereau, puis imprime-le. Le numéro de rangement y est tamponné.',
        'Prends la paire rangée sous ce numéro (carton, étagère, bac…), emballe-la, colle le bordereau, dépose le colis.',
      ] },
      { capture: 'colis.jpg', alt: 'L’écran Colis de VRM sur iPhone, avec les colis prêts à imprimer', legende: 'Colis : ce qui est prêt d’abord, puis ce qui attend, puis ce qui est parti.', h: 844 },
      { liste: [
        'Sur ordinateur, avec l’extension, VRM peut aussi **générer** le bordereau Vinted depuis l’app.',
        'Leboncoin : **Imprimer le bordereau**, tamponné du titre et du numéro.',
        'eBay : c’est l’acheteur qui paie le port. eBay fournit l’étiquette prépayée ; VRM n’achète jamais d’étiquette avec ton argent.',
        'Imprimante : normale (A4) ou thermique, à choisir dans **Réglages → Impression**.',
      ] },
      { titre: 'La date limite', id: 'limite' },
      'La date limite d’envoi est celle de l’e-mail de la plateforme (heure de Paris). Sans cet e-mail, VRM montre une **estimation** (la vente plus 7 jours) — jamais « en retard » sur une estimation.',
      { note: 'Un colis vendu dont le transporteur a pris en charge le numéro passe tout seul dans **Envoyés**, avec la raison.', titreNote: 'Après le dépôt.' },
    ],
    voir: ['numeros', 'retirer-colis'],
  },
  {
    slug: 'retirer-colis', titre: 'Retirer un colis au point relais',
    resume: 'Le code et le QR de chaque point relais, même sans réseau.',
    mots: 'retirer retrait code qr point relais mondial relay chronopost vinted go colissimo date limite hors connexion en grand',
    chapo: 'Tes achats arrivés au point relais sont dans **Colis → À retirer** : une carte par point relais, avec le code de retrait et son QR.',
    blocs: [
      { etapes: [
        'Ouvre **Colis → À retirer**.',
        'Au comptoir, touche **En grand** : le code et le QR s’affichent en grand, faciles à scanner.',
        'Une fois le colis en main, touche **J’ai retiré**. Pendant 5 secondes, **Annuler** le remet.',
      ] },
      { capture: 'a-retirer.jpg', alt: 'L’écran À retirer de VRM sur iPhone, avec le code de retrait d’un point relais', legende: 'À retirer : une carte par point relais, le code à côté.', h: 844 },
      { liste: [
        '**Sans réseau** (au fond d’un magasin), Colis s’ouvre avec le dernier état connu : codes et QR compris.',
        'La date limite et le lieu viennent de l’e-mail du transporteur ; sinon VRM compte la durée de garde du transporteur. Au-delà, le colis passe « à vérifier ».',
        'Quand le transporteur dit que le colis est retiré, il sort de la liste tout seul, avec la raison (« Mondial Relay : retiré le 5 nov. »).',
      ] },
      { note: 'Un colis douteux n’est jamais caché : il va dans « à vérifier », visible avec son code. Un colis caché est un colis perdu.', titreNote: 'Jamais caché.' },
    ],
    voir: ['boite-email', 'bordereau'],
  },
  {
    slug: 'compta-urssaf', titre: 'Compta et URSSAF',
    resume: 'Vendu, reçu, ce qu’il faut déclarer, et quand.',
    mots: 'urssaf déclarer déclaration chiffre affaires ca versement micro entreprise taux 12,4 seuil tva dac7 bénéfice au moins régime',
    chapo: 'VRM te dit ce que tu as vendu, ce que tu as reçu, et ce qu’il faut déclarer à l’URSSAF. Il additionne ce qu’il sait, et dit ce qui manque.',
    blocs: [
      { titre: 'Vendu et reçu, ce n’est pas pareil', id: 'vendu-recu' },
      { liste: [
        '**Vendu** : les ventes, à leur date de vente, toutes plateformes.',
        '**Reçu** : l’argent versé, à la **date du versement**. C’est ce chiffre qui compte pour l’URSSAF.',
        'Une vente sans date de versement n’est dans aucun mois : elle est « à dater », et VRM le dit.',
      ] },
      { capture: 'compta.jpg', alt: 'L’écran Comptabilité de VRM sur iPhone', legende: 'Compta commence par ton statut : VRM ne devine jamais ton régime.', h: 844 },
      { titre: 'Déclarer', id: 'declarer' },
      { etapes: [
        'Ouvre **Compta** : le montant du mois est en haut.',
        'Touche **Déclarer** et suis les trois étapes.',
        'Une fois déclaré sur le site de l’URSSAF, touche **J’ai déclaré ce mois** : VRM ne le coche jamais à ta place.',
      ] },
      { liste: [
        'Le taux par défaut est **12,4 %** (micro-entreprise, achat-revente). Ton régime n’est jamais deviné : choisis-le dans Compta.',
        'Seuls les **comptes sélectionnés** entrent dans les totaux ; un compte exclu n’entre dans aucun.',
        '« **Au moins** » devant un total : il manque une donnée (un prix d’achat, une date de versement). VRM la nomme à côté.',
        'Le bénéfice a besoin de tes prix d’achat : tu les saisis toi-même, VRM ne les devine pas.',
      ] },
      { note: 'Plafond micro-entreprise 2026 : 203 100 € de chiffre d’affaires en achat-revente. TVA : seuils de 85 000 € et 93 500 €. Les plateformes transmettent tes ventes au fisc dès 30 ventes ou plus de 2 000 € dans l’année (DAC7).', titreNote: 'Les seuils.' },
      'VRM aide à préparer ta déclaration ; il ne remplace pas un comptable.',
    ],
    voir: ['tout-va-bien', 'abonnement'],
  },
  {
    slug: 'abonnement', titre: 'L’abonnement',
    resume: '16,99 € par mois, 7 jours d’essai, sans engagement.',
    mots: 'abonnement prix payer carte stripe essai gratuit résilier facture sans engagement remboursement',
    chapo: 'VRM coûte **16,99 € par mois**, avec **7 jours d’essai gratuit** la première fois. Sans engagement.',
    blocs: [
      { liste: [
        'Le paiement passe par Stripe : VRM ne voit jamais ton numéro de carte.',
        'Tes factures sont dans **Réglages → Mon abonnement**.',
        'Pendant l’essai, VRM t’écrit au plus trois fois pour te rappeler où tu en es ; tu peux couper ces e-mails dans **Réglages → Notifications**.',
      ] },
      { titre: 'Résilier', id: 'resilier' },
      { etapes: [
        'Ouvre **Réglages → Mon abonnement**.',
        'Touche **Résilier** et confirme.',
      ] },
      'Tu gardes VRM jusqu’à la fin du mois payé, et aucun autre prélèvement ne part. Tes données restent intactes, et tu peux changer d’avis jusqu’à cette date.',
      { note: 'Les fonctions qui coûtent à l’usage (un détourage de photo, par exemple) passent par **ta** clé, rangée côté serveur — jamais par celle d’un autre. Sans clé, la fonction se tait et dit pourquoi.', titreNote: 'Rien de caché.' },
    ],
    voir: ['compta-urssaf'],
  },
  {
    slug: 'tout-va-bien', titre: '« Tout va bien ? » : quand un chiffre manque',
    resume: 'Pourquoi « — », « au moins », « à confirmer », et où vérifier que VRM fonctionne.',
    mots: 'tout va bien panne chiffre manque tiret au moins à confirmer hors connexion état vrm à jour fraîcheur pas enregistré',
    chapo: 'VRM préfère un blanc à un faux. Quand il ne sait pas, il le dit — et il dit pourquoi.',
    blocs: [
      { liste: [
        '**« — »** : VRM n’a pas pu lire ce chiffre (une lecture ratée, un compte pas mis à jour). Ce n’est pas zéro. La raison est écrite à côté.',
        '**« au moins »** : le total ne compte que ce que VRM connaît ; ce qui manque est nommé.',
        '**« à confirmer »** : la dernière lecture complète d’un compte a plus de 24 heures. Rien n’est supprimé ; repasse sur Vinted connecté sur ce compte.',
        '**« Hors connexion — dernier état du … »** : pas de réseau. Tu vois le dernier état connu ; tes gestes partiront au retour du réseau.',
        '**« Pas enregistré — Réessayer »** : le serveur n’a pas confirmé. Rien n’est perdu, l’écran est revenu comme avant.',
      ] },
      { titre: 'Vérifier que VRM fonctionne', id: 'etat' },
      'La page [vrm.center/etat](/etat) dit si la base, la réception des e-mails et les notifications fonctionnent, vérifiées chaque minute.',
      { titre: 'Mes ventes sont-elles à jour ?', id: 'a-jour' },
      'Les ventes Vinted se mettent à jour quand tu passes sur Vinted avec l’extension. Si un compte n’a pas été lu depuis plus d’un jour, VRM le nomme et te dit d’y repasser.',
    ],
    voir: ['signaler', 'extension'],
  },
  {
    slug: 'signaler', titre: 'Signaler un problème',
    resume: 'Ce qui part, ce qui ne part jamais, et où le trouver.',
    mots: 'signaler problème bug erreur plantage aide contact support capture écran',
    chapo: 'Un écran qui reste vide, un chiffre qui ne colle pas ? Dans VRM, touche **?** à côté de la phrase de l’écran, puis **Signaler un problème**. Tu peux aussi passer par **Réglages → Aide**.',
    blocs: [
      { titre: 'Ce qui part avec ton message', id: 'part' },
      { liste: [
        'L’écran ouvert et celui d’avant, la version de l’app et de l’extension, ton navigateur, ton type d’appareil.',
        'Un **schéma** de l’écran : chaque bloc à sa place, sans un mot ni une image.',
        'Les 50 dernières erreurs de ton appareil et l’état des 30 dernières requêtes (leur code de réponse, jamais leur contenu).',
        'L’identifiant de ton compte VRM, pour savoir à qui répondre, et l’heure.',
      ] },
      { titre: 'Ce qui ne part jamais', id: 'jamais' },
      'Ni ventes, ni pseudos, ni adresses, ni e-mails, ni montants, ni le contenu de l’écran. Une adresse e-mail, un montant, un pseudo connu ou un long numéro tapé dans ton message est masqué avant l’envoi. **Tu vois exactement ce qui part avant d’envoyer.**',
      { note: 'Cinq signalements par heure au plus. « Envoyé » ne s’affiche que quand le serveur a confirmé ; sinon ton texte reste dans le champ.', titreNote: 'À savoir.' },
    ],
    voir: ['tout-va-bien'],
  },
];

module.exports = { ARTICLES };
