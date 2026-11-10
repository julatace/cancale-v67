// api/_lib/notif-apercus.js
// ────────────────────────────────────────────────────────────────────────────
// (5 nov.) CE QUE DIT CHAQUE NOTIFICATION — les textes, et leur APERÇU.
//
// Julien (vocal du 5 nov.) : « une meilleure interface des notifications, plus
// pro, personnalisable comme on veut ». Paramètres → Notifications montre, pour
// chaque famille, ce que le téléphone affichera et où le toucher mène.
//
// Une règle, un propriétaire (§5) : les textes des notifications les plus
// fréquentes sont FABRIQUÉS ICI, et les routes (api/email-inbound.js) appellent
// ces mêmes fonctions. L'aperçu de l'écran passe par elles, avec des données
// d'exemple INVENTÉES (jamais une vente réelle). Les arrivées passent par
// `texteArrivee` (api/_lib/notif-textes.js), la même que toutes les voies.
// ⚠️ (revue du 5 nov.) AUCUN aperçu n'est écrit à la main : chacun sort de la
// fonction qui fabrique la vraie notification (ici, ou dans sa lib : rappel de
// retrait, URSSAF, bilan, double vente). Mesuré : les « exemples » rédigés à la
// main disaient « 58 € sur N°124 » (le vrai rappel des offres au mini ne porte
// ni montant ni N°) et « Ta semaine · 9 ventes · 412 € de chiffre d'affaires »
// (le vrai bilan dit « Vendu : … Reçu : … ») — un aperçu qui ment n'en est pas un.
//
// Pur : aucune lecture, aucune écriture, aucun module Node — l'app l'importe.
// ────────────────────────────────────────────────────────────────────────────
import { texteArrivee } from './notif-textes.js';
import { heureCourte } from './limite-envoi.js';
import { texteRappelRetrait } from './suivi-colis.js';
import { notificationUrssaf } from './rappel-urssaf.js';
import { texteBilan } from './bilan-semaine.js';
import { notificationDoubleVente } from './double-vente.js';
import { texteComptesARelire } from './comptes-a-relire.js';
import { texteCompteRelie } from '../../src/compteRelie.js';

const court = (t, n) => { const x = String(t || ''); return x.length > n ? x.slice(0, n - 1).trimEnd() + '…' : x; };

// (8 nov., Julien : « de belles notifications ») Chaque titre dit LE fait en
// ≤ 40 caractères, sans emoji ; le corps dit l'objet, puis le geste et
// l'échéance. La forme finale (coupe, séparateurs) : api/_lib/notif-belle.js.
const euros = (x) => { const s = String(x == null ? '' : x).trim().replace('.', ','); return s ? `${s} €` : ''; };
const joindre = (...xs) => xs.filter((x) => x && String(x).trim()).join(' · ');

// Une vente Vinted (e-mail « Ton article s'est vendu »).
// (6 nov.) `verification` : la vente « avec Vérification de l'article » (l'e-mail
// ne donne pas de prix — il n'est jamais deviné) ; le colis part au centre de Vinted.
export const texteVendu = ({ article = '', prix = '', compte = '', verification = false } = {}) => ({
  title: prix ? `Vendu · ${euros(prix)}` : 'Vendu',
  body: joindre(article || 'Article', compte, verification ? 'avec Vérification de l’article : envoi au centre de vérification de Vinted' : 'Prépare le colis, le bordereau suit par e-mail'),
});
// L'argent d'une vente arrive (e-mail « Transaction finalisée »).
export const texteArgentRecu = ({ montant = '', article = '', compte = '' } = {}) => ({
  title: montant ? `${euros(montant)} reçus` : 'Argent reçu',
  body: joindre(article ? String(article).slice(0, 50) : 'Transaction finalisée', compte, 'sur ton porte-monnaie Vinted'),
});
// Vendu sur Vestiaire (e-mail de vente Vestiaire). `montant` en euros (nombre).
export const texteVenduVestiaire = ({ titre = '', montant = null, limite = '' } = {}) => ({
  title: 'Vendu sur Vestiaire',
  body: joindre(titre || 'Ton article', Number.isFinite(montant) ? `tu reçois ${String(montant.toFixed(2)).replace('.', ',')} €` : '', limite ? `à envoyer avant le ${String(limite).slice(8, 10)}/${String(limite).slice(5, 7)}` : 'à envoyer'),
});
// Le bordereau d'une vente est arrivé (e-mail « Bordereau d'envoi »).
export const texteBordereau = ({ modele = '', numero = '', tamponne = false, dateLimite = '' } = {}) => ({
  title: tamponne ? 'Bordereau prêt à imprimer' : 'Bordereau reçu',
  body: joindre(modele || 'Article', numero ? `N°${numero}` : '', tamponne ? 'déjà tamponné' : '', dateLimite ? `à déposer avant le ${dateLimite}` : 'à déposer'),
});
// Une offre reçue (e-mail « Nouvelle offre »). `conseil` : la phrase du copilote, déjà formée.
export const texteOffre = ({ montant = '', qui = '', article = '', compte = '', conseil = '' } = {}) => ({
  title: montant ? `Offre de ${euros(montant)}` : 'Nouvelle offre',
  body: joindre(article ? `« ${String(article).trim().slice(0, 40)} »` : 'Un acheteur t\'a fait une offre', qui, compte) + (conseil ? conseil : ' — accepte, refuse ou contre-propose.'),
});
// Un message reçu (e-mail « Nouveau message »).
export const texteMessage = ({ paire = '', qui = '', compte = '', extrait = '' } = {}) => ({
  title: qui ? `Message de ${qui}` : (paire ? court(paire, 40) : 'Message Vinted'),
  body: joindre(qui && paire ? court(paire, 60) : '', compte ? `Nouveau message sur ${compte}` : 'Nouveau message', extrait ? `« ${extrait} »` : 'réponds dans Messages'),
});

// Une annulation demandée (e-mail « … souhaiterait annuler l'achat … »).
export const texteAnnulation = ({ qui = '', article = '', raison = '', compte = '' } = {}) => ({
  title: 'Annulation demandée',
  body: `${joindre(article ? court(article, 60) : '', compte)}${article || compte ? ' · ' : ''}${qui || "L'acheteur"} veut annuler${raison ? ` (« ${court(raison, 70)} »)` : ''} — accepte ou refuse dans la conversation Vinted.`,
});
// Le rappel du cron « offres au-dessus de ton prix mini » (api/ship-reminders.js).
export const texteOffresMini = (n) => ({
  title: n > 1 ? `${n} offres au-dessus de ton prix mini` : 'Une offre au-dessus de ton prix mini',
  body: n > 1 ? `${n} offres à accepter en 1 tap dans VRM.` : 'À accepter en 1 tap dans VRM.',
});
// LE RÉSUMÉ DU SOIR (10 nov., lot AT ; le « rappel de la veille au soir » du 11 oct.,
// amélioré — UNE notification) : seulement ce qu'il y a à faire DEMAIN. La décision
// (envoyer ou non, où mène le toucher) est dans api/_lib/resume-soir.js ; ici, le texte.
//   colis    : { demain, heure, retard, aVerifier } — `demain` = date limite LUE demain
//              (`heure` = la plus proche, lue) ; `retard` = limite lue déjà passée demain ;
//              `aVerifier` = date ESTIMÉE passée (jamais « en retard », revue du 22 oct.) ;
//   retraits : { n, lieu } — dernier jour (lu) demain pour retirer ;
//   offres   : { n } — offres Vestiaire REÇUES qui expirent avant demain soir
//              (Vinted : aucune, ses offres n'expirent pas — Julien, 5 nov.) ;
//   manque   : les sources de colis pas relues ⇒ « au moins », nommées.
const pl = (n, un, plusieurs) => (n > 1 ? plusieurs : un);
const lieuCourt = (l) => String(l || '').split(',')[0].trim().slice(0, 40);
export function texteSoir({ colis = null, retraits = null, offres = null, manque = null } = {}) {
  const c = colis || {};
  const nDemain = c.demain || 0, nRetard = c.retard || 0, nVerif = c.aVerifier || 0;
  const nColis = nDemain + nRetard + nVerif;
  const nRetraits = (retraits && retraits.n) || 0, nOffres = (offres && offres.n) || 0;
  const manques = Array.isArray(manque) ? manque.filter(Boolean) : [];
  const am = manques.length ? 'au moins ' : '';
  const sortes = [nColis, nRetraits, nOffres].filter((x) => x > 0).length;
  const title = sortes > 1
    ? 'Demain : ' + [nColis ? `${am}${nColis} colis` : '', nRetraits ? `${nRetraits} ${pl(nRetraits, 'retrait', 'retraits')}` : '', nOffres ? `${nOffres} ${pl(nOffres, 'offre', 'offres')}` : ''].filter(Boolean).join(', ')
    : nColis ? `Demain : ${am}${nColis} colis à déposer`
      : nRetraits ? `Demain : ${nRetraits} colis à retirer`
        : `Demain : ${nOffres} ${pl(nOffres, 'offre expire', 'offres expirent')}`;
  const H = c.heure ? heureCourte(c.heure) : '';
  const phrases = [];
  if (nDemain) phrases.push(nDemain === 1 ? `1 colis à déposer${H ? ` avant ${H}` : ''} demain.` : `${nDemain} colis à déposer demain${H ? `, le premier avant ${H}` : ''}.`);
  if (nRetard) phrases.push(`${nRetard} déjà en retard : ${pl(nRetard, 'dépose-le', 'dépose-les')} en premier.`);
  if (nVerif) phrases.push(`${nVerif} ${pl(nVerif, 'date estimée passée', 'dates estimées passées')} : vérifie sur Vinted.`);
  if (nRetraits) phrases.push(nRetraits === 1 && lieuCourt(retraits.lieu) ? `Dernier jour pour retirer ton colis à ${lieuCourt(retraits.lieu)}.` : `Dernier jour pour retirer ${nRetraits} colis.`);
  if (nOffres) phrases.push(`${nOffres} ${pl(nOffres, 'offre Vestiaire expire', 'offres Vestiaire expirent')} avant demain soir.`);
  if (manques.length && nColis) phrases.push(`${manques.join(' et ')} pas ${pl(manques.length, 'relu', 'relus')} : il peut y en avoir plus.`);
  return { title, body: phrases.join(' ') };
}

// ── L'APERÇU, famille par famille (ids de api/_lib/notif-textes.js, FAMILLES) ──
// `quoi` : une ligne, ce qui fait sonner ; `exemples` : { title, body, mene }
// — `mene` = l'écran et l'élément que le toucher met en évidence
// (api/_lib/lien-notif.js, DESTINATIONS). Chaque texte sort de la VRAIE
// fabrique (données d'exemple inventées).
const EX = { compte: 'mon_compte', article: 'Nike Air Max 90 taille 42' };
const deux = (o) => ({ title: o.title || o.titre, body: o.body || o.corps });
const DV = notificationDoubleVente([{ numero: '124', plateforme: 'leboncoin', annonces: [{ id: '1' }] }], EX.article, { venduSur: 'vinted' });
const URSSAF = notificationUrssaf({ today: '2026-11-02', main: { vinted_regime: 'micro', vinted_urssaf_freq: 'mensuel', vinted_urssaf_mois: { at: '2026-11-01T12:00:00Z', mois: [{ ym: '2026-10', ca: 1240 }] } } });
const BILAN = texteBilan({ vendu: { etat: 'su', n: 9, eur: 412 }, recu: { etat: 'su', eur: 380 }, colis: { etat: 'su', n: 2 }, dorment: { etat: 'su', n: 4, auMoins: false } }, { lundi: '2026-10-26', dimanche: '2026-11-01' });
export const APERCUS_NOTIF = {
  // (intégration lot 1) Les familles de api/_lib/notif-textes.js depuis le 5 nov. :
  // la double vente a la sienne, la veille au soir est un « rappel ».
  ventes: {
    quoi: 'Une paire vendue, l’argent qui arrive.',
    exemples: [
      { ...texteVendu({ article: EX.article, prix: '65', compte: EX.compte }), mene: 'Ventes · la vente, ouverte' },
      { ...texteArgentRecu({ montant: '61,20', article: EX.article, compte: EX.compte }), mene: 'Ventes' },
      { ...texteVenduVestiaire({ titre: 'Sac Longchamp Le Pliage', montant: 84, limite: '2026-11-12' }), mene: 'Ventes · Vestiaire · la vente' },
    ],
  },
  doublevente: {
    quoi: 'Une paire vendue sur un site et encore en ligne sur un autre.',
    exemples: [
      ...(DV ? [{ ...deux(DV), mene: 'Annonces · Leboncoin · la ligne « à retirer »' }] : []),
    ],
  },
  poster: {
    quoi: 'Un bordereau reçu.',
    exemples: [
      { ...texteBordereau({ modele: 'Air Max 90', numero: '124', tamponne: true, dateLimite: '12/11' }), mene: 'Colis · À envoyer · la carte du colis' },
    ],
  },
  arrives: {
    quoi: 'Un achat arrivé au point relais, avec son code ; le dernier jour pour le retirer.',
    exemples: [
      { ...texteArrivee({ article: 'Adidas Samba OG', lieu: 'Tabac des Halles, 8 Rue des Lilas, 44000 Nantes', code: '454602', limite: '2026-11-12' }), mene: 'Colis · À retirer · la carte du colis, ouverte sur son code' },
      { ...texteRappelRetrait({ etat: 'dernier', transporteur: 'mondialrelay', lieu: 'Tabac des Halles, 8 Rue des Lilas, 44000 Nantes', suivi: '87654321' }), mene: 'Colis · À retirer · la carte du colis' },
    ],
  },
  offres: {
    quoi: 'Une offre reçue, une offre au-dessus de ton prix mini.',
    exemples: [
      { ...texteOffre({ montant: '55', qui: 'acheteur_92', article: EX.article, compte: EX.compte }), mene: 'Messages · la conversation, l’offre en évidence' },
      { ...texteOffresMini(1), mene: 'Messages · la conversation, l’offre en évidence (plusieurs offres : le filtre « Offres »)' },
    ],
  },
  messages: {
    quoi: 'Un message, une annulation demandée, un achat à confirmer, un colis peut-être perdu.',
    exemples: [
      { ...texteMessage({ paire: EX.article, qui: 'acheteur_92', compte: EX.compte }), mene: 'Messages · la conversation, ouverte' },
      { ...texteAnnulation({ qui: 'acheteur_92', article: 'Air Max 90', compte: EX.compte }), mene: 'Messages · la conversation' },
    ],
  },
  rappels: {
    quoi: 'Le soir, ce qu’il y a à faire demain (colis, retraits, offres), la déclaration URSSAF à faire, le bilan de la semaine, un compte Vinted pas relu depuis plus de 24 h.',
    exemples: [
      { ...texteSoir({ colis: { demain: 2, heure: '12:00', retard: 0, aVerifier: 0 }, retraits: { n: 1, lieu: 'Tabac des Halles, 8 Rue des Lilas, 44000 Nantes' }, offres: { n: 0 } }), mene: 'Colis · À envoyer (le premier geste de demain)' },
      ...(URSSAF && URSSAF.envoyer ? [{ ...deux(URSSAF), mene: 'Comptabilité · ta déclaration' }] : []),
      { ...deux(BILAN), mene: 'Ma journée' },
      { ...texteComptesARelire([{ nom: EX.compte, age: 'il y a 2 j' }]), mene: 'Paramètres · Comptes liés' },
    ],
  },
  // (8 nov.) Un compte relié pour la première fois (src/compteRelie.js, le vrai texte).
  comptes: {
    quoi: 'Un compte Vinted, Leboncoin, Vestiaire ou eBay relié pour la première fois.',
    exemples: [
      { ...texteCompteRelie([{ plateforme: 'vinted', id: '123', nom: EX.compte }]), mene: 'Paramètres · Comptes liés' },
    ],
  },
};
export const apercuFamille = (id) => APERCUS_NOTIF[id] || null;
