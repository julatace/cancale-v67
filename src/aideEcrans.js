// ── LE « ? » DE CHAQUE ÉCRAN : TROIS QUESTIONS, UN ARTICLE (8 nov.) ───────────
// Julien (8 nov., « des vendeurs vont payer ») : sur chaque écran, un « ? » qui
// répond aux trois questions qu'on se pose LÀ, renvoie à l'article du centre
// d'aide (vrm.center/aide) et propose « Signaler un problème ». Pas de visite
// forcée, pas d'IA : du texte écrit, vrai d'après le code (chaque réponse dit
// une règle de CLAUDE.md §3/§5 ou un geste qui existe dans l'app).
//
// Une source : les clés sont celles de `PHRASES_ECRAN` (src/phrasesEcran.js).
// `audit-aide-ecrans` vérifie : chaque écran à phrase a ses 3 questions, chaque
// réponse est courte (`MOTS_MAX_REPONSE`), sans jargon (`JARGON`), et chaque
// article existe dans public/aide/ (et dans l'index de la recherche).

export const MOTS_MAX_REPONSE = 45;

// Les articles du centre d'aide (public/aide/<slug>.html).
export const ARTICLES_AIDE = {
  extension: 'Installer l’extension (Chrome, Orion)',
  'boite-email': 'Relier ta boîte e-mail (Gmail, iCloud, Yahoo)',
  numeros: 'Les numéros de rangement',
  bordereau: 'Imprimer un bordereau',
  'retirer-colis': 'Retirer un colis au point relais',
  'compta-urssaf': 'Compta et URSSAF',
  abonnement: 'L’abonnement',
  'tout-va-bien': '« Tout va bien ? » : quand un chiffre manque',
  signaler: 'Signaler un problème',
};

export const AIDE_ECRANS = {
  journee: { article: 'tout-va-bien', questions: [
    ['Pourquoi un chiffre affiche « — » ?', 'VRM n’a pas pu le lire (une lecture ratée, un compte pas mis à jour). Il préfère « — » à un faux zéro, et la raison est écrite à côté.'],
    ['D’où viennent les choses à faire ?', 'De tes ventes à envoyer, de tes colis à retirer et des e-mails de tes plateformes. Une tâche part quand la preuve arrive : bordereau, colis déposé, colis retiré.'],
    ['Mes ventes sont-elles à jour ?', 'Elles se rafraîchissent quand tu passes sur Vinted avec l’extension. Si un compte n’a pas été lu depuis plus d’un jour, VRM le nomme.'],
  ] },
  annonces: { article: 'numeros', questions: [
    ['À quoi sert le numéro ?', 'À retrouver la paire sur ton étagère, sur Leboncoin et sur eBay. Il suit l’ordre de mise en ligne et n’est jamais redonné à une autre paire.'],
    ['Pourquoi une annonce est « à confirmer » ?', 'La dernière lecture complète de ce compte a plus de 24 heures. Rien n’est supprimé : repasse sur Vinted, connecté sur ce compte.'],
    ['Où saisir le prix d’achat ?', 'Sur la carte de l’annonce. VRM ne le devine jamais : tant qu’il manque, le bénéfice s’écrit « au moins ».'],
  ] },
  ventes: { article: 'compta-urssaf', questions: [
    ['Quand une vente est-elle comptée ?', 'Quand la plateforme montre une vraie commande (payée, envoyée, finalisée). Une conversation n’est pas une vente, et une vente annulée sort des totaux.'],
    ['Pourquoi « vendu » et « reçu » diffèrent ?', 'Vendu suit la date de la vente. Reçu suit la date du versement de l’argent : c’est lui qui compte pour l’URSSAF.'],
    ['Puis-je masquer une vente ?', 'Non. Une vente ne se masque pas : tes totaux et ta déclaration restent justes.'],
  ] },
  colis: { article: 'bordereau', questions: [
    ['Comment imprimer un bordereau ?', 'Un colis « prêt » a son bordereau : ouvre-le et imprime. Le numéro de rangement y est tamponné, pour emballer la bonne paire.'],
    ['Où est mon code de retrait ?', 'Dans « À retirer », sur la carte du point relais, avec son QR. Il reste lisible même sans réseau.'],
    ['Pourquoi un colis est « à vérifier » ?', 'VRM n’a pas de preuve claire de son état. Il le montre avec son code plutôt que de le cacher : un colis caché est un colis perdu.'],
  ] },
  messages: { article: 'extension', questions: [
    ['Pourquoi je ne vois pas mes messages Vinted ?', 'L’extension les lit dans ton navigateur quand tu passes sur Vinted. Installe-la, puis reste connecté sur Vinted.'],
    ['Les offres sont-elles acceptées toutes seules ?', 'Seulement si tu l’as allumé (c’est éteint au départ), et seulement au-dessus du prix mini que tu as posé.'],
    ['VRM écrit-il à ma place ?', 'Non. Un message part sur ton clic, au nom du compte ouvert dans ton navigateur, et jamais plus de 50 gestes par heure et par compte.'],
  ] },
  achats: { article: 'retirer-colis', questions: [
    ['Comment un achat arrive ici ?', 'L’extension lit tes achats Vinted, et les reçus par e-mail complètent. Un achat se relie par son numéro de transaction, jamais par son titre.'],
    ['Quand un achat est-il « à retirer » ?', 'Quand une preuve dit qu’il est arrivé au point relais (e-mail, suivi). Il sort de la liste dès qu’il est retiré.'],
    ['Pourquoi un achat n’a pas de suivi ?', 'Le suivi arrive quand le vendeur expédie. Tant qu’il manque, l’achat reste « en route », sans date inventée.'],
  ] },
  emails: { article: 'boite-email', questions: [
    ['Comment mes e-mails arrivent ici ?', 'Ta messagerie fait suivre les e-mails de tes plateformes vers ton adresse VRM (un filtre Gmail, une règle iCloud). Ton courrier personnel ne part pas.'],
    ['Un e-mail peut-il se perdre ?', 'Non. Un e-mail qu’aucune règle ne reconnaît est gardé tel quel : rien n’est jeté.'],
    ['Et Yahoo, ou le relais d’Apple ?', 'Yahoo ne fait suivre qu’avec Yahoo Mail Plus. Le relais d’Apple fait suivre vers une boîte déjà reliée à VRM : relie celle-là.'],
  ] },
  compta: { article: 'compta-urssaf', questions: [
    ['Quel montant déclarer à l’URSSAF ?', 'Celui du mois du versement : une vente compte le mois où l’argent arrive, pas le jour où elle a été faite.'],
    ['Pourquoi « au moins » devant un total ?', 'Il manque des données (une date de versement, un prix d’achat). VRM additionne ce qu’il sait et nomme ce qui manque.'],
    ['Quel taux est appliqué ?', '12,4 % par défaut (micro-entreprise, achat-revente). Ton régime n’est jamais deviné : choisis-le dans Compta.'],
  ] },
  dashboard: { article: 'compta-urssaf', questions: [
    ['D’où viennent ces chiffres ?', 'De tes ventes, sur les sites et les comptes que tu as choisis. Un compte exclu n’entre dans aucun total.'],
    ['Pourquoi un bénéfice manque ?', 'Sans prix d’achat, pas de bénéfice : le chiffre dit sur combien de ventes il porte.'],
    ['Que veut dire l’ambre ?', 'Un geste à faire. Le reste reste neutre : seul ce qui est à rattraper prend une couleur.'],
  ] },
  garage: { article: 'numeros', questions: [
    ['Comment retrouver une paire ?', 'Cherche son numéro : VRM te dit le meuble et la case.'],
    ['Un numéro peut-il changer ?', 'Presque jamais. Une annonce sans numéro en reçoit un, et un doublon se règle. Les nouveaux numéros à écrire là où tes articles sont rangés restent listés jusqu’à « C’est écrit ».'],
    ['Pourquoi du rouge ?', 'Deux paires présentes sous le même numéro : c’est le seul risque d’envoyer le mauvais article. Vérifie les deux là où ils sont rangés.'],
  ] },
  settings: { article: 'extension', questions: [
    ['Comment installer l’extension ?', 'Télécharge-la et dézippe-la. Dans chrome://extensions, allume « Mode développeur », puis « Charger l’extension non empaquetée » et choisis le dossier.'],
    ['Comment relier ma boîte e-mail ?', 'Dans Réglages, partie « Mes e-mails » : VRM te donne ton adresse et la règle à copier dans Gmail, iCloud ou Outlook.'],
    ['Comment résilier ?', 'Dans Réglages, « Mon abonnement » : « Résilier ». Tu gardes VRM jusqu’à la fin du mois payé, et tes données restent intactes.'],
  ] },
  communaute: { article: 'signaler', questions: [
    ['Qui voit ma position ?', 'Les revendeurs de la carte voient une position ARRONDIE, jamais ton adresse ni ton e-mail. Tu peux quitter la carte à tout moment.'],
    ['Le classement est-il public ?', 'Tu n’y apparais que si tu t’y inscris. Le chiffre est compté par la base, pas déclaré.'],
    ['Comment rejoindre un groupe ?', 'Avec le code que son créateur te donne. Tu peux le quitter quand tu veux.'],
  ] },
};
