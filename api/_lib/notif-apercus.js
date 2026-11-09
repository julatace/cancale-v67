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
// Le rappel du soir (api/ship-reminders.js, `rappelDuSoir`) — déplacé ici tel quel.
// `aVerifier` : les dates ESTIMÉES (pas d'email de bordereau) qui seront
// passées demain — jamais « déjà en retard » (revue du 22 octobre).
export function texteSoir({ n, auMoins, retard, aVerifier = 0, demain, heureDemain = null, manque = null }) {
  const N = `${auMoins ? 'au moins ' : ''}${n} colis à poster`;
  const H = heureDemain ? heureCourte(heureDemain) : '';
  const parts = [];
  if (retard) parts.push(`${retard} déjà en retard`);
  if (aVerifier) parts.push(`${aVerifier} à vérifier sur Vinted (date estimée passée)`);
  if (demain) parts.push(`${demain} avec la date limite demain${H ? (demain === 1 ? ` à ${H}` : `, la première à ${H}`) : ''}`);
  return {
    title: `Demain : ${N}`,
    body: `${parts.length ? `Dont ${parts.join(', ')}. ` : ''}${auMoins ? `Les ventes ${(Array.isArray(manque) && manque.length ? manque : ['eBay']).join(' et ')} n'ont pas pu être relues : il peut y en avoir plus. ` : ''}Prépare-les ce soir.`,
  };
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
    quoi: 'La veille au soir (colis à poster demain), la déclaration URSSAF à faire, le bilan de la semaine, un compte Vinted pas relu depuis plus de 24 h.',
    exemples: [
      { ...texteSoir({ n: 3, auMoins: false, retard: 0, demain: 1, heureDemain: '12:00' }), mene: 'Colis · À envoyer' },
      ...(URSSAF && URSSAF.envoyer ? [{ ...deux(URSSAF), mene: 'Comptabilité · ta déclaration' }] : []),
      { ...deux(BILAN), mene: 'Ma journée' },
      { ...texteComptesARelire([{ nom: EX.compte, age: 'il y a 2 j' }]), mene: 'Paramètres · Comptes liés' },
    ],
  },
};
export const apercuFamille = (id) => APERCUS_NOTIF[id] || null;
