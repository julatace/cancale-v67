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
// Les rappels du cron (matin, soir, URSSAF, bilan) ont leur texte dans leur
// route : leur aperçu est un EXEMPLE écrit à la forme du texte réel, dit tel.
//
// Pur : aucune lecture, aucune écriture, aucun module Node — l'app l'importe.
// ────────────────────────────────────────────────────────────────────────────
import { texteArrivee } from './notif-textes.js';

const court = (t, n) => { const x = String(t || ''); return x.length > n ? x.slice(0, n - 1).trimEnd() + '…' : x; };

// 💸 Une vente Vinted (e-mail « Ton article s'est vendu »).
export const texteVendu = ({ article = '', prix = '', compte = '' } = {}) => ({
  title: '💸 Vendu !',
  body: `${article || 'Article'}${prix ? ` — ${prix} €` : ''}${compte ? ` (${compte})` : ''}`,
});
// 💰 L'argent d'une vente arrive (e-mail « Transaction finalisée »).
export const texteArgentRecu = ({ montant = '', article = '', compte = '' } = {}) => ({
  title: '💰 Argent reçu',
  body: `${montant ? montant + ' € viré sur ton compte Vinted' : 'Transaction finalisée'}${article ? ' — ' + String(article).slice(0, 50) : ''}${compte ? ` (${compte})` : ''}.`,
});
// Vendu sur Vestiaire (e-mail de vente Vestiaire). `montant` en euros (nombre).
export const texteVenduVestiaire = ({ titre = '', montant = null, limite = '' } = {}) => ({
  title: 'Vendu sur Vestiaire',
  body: `${titre || 'Ton article'}${Number.isFinite(montant) ? ` — tu reçois ${String(montant.toFixed(2)).replace('.', ',')} €` : ''}${limite ? ` — à envoyer avant le ${String(limite).slice(8, 10)}/${String(limite).slice(5, 7)}` : ''}.`,
});
// 📦 Le bordereau d'une vente est arrivé (e-mail « Bordereau d'envoi »).
export const texteBordereau = ({ modele = '', numero = '', tamponne = false, dateLimite = '' } = {}) => ({
  title: tamponne ? '📦 Bordereau prêt à imprimer' : '📦 Bordereau reçu',
  body: `${modele || 'Article'}${numero ? ` — N°${numero}` : ''}${tamponne ? ' : déjà tamponné' : ''} — à expédier${dateLimite ? ` avant le ${dateLimite}` : ''}.`,
});
// 💰 Une offre reçue (e-mail « Nouvelle offre »). `conseil` : la phrase du copilote, déjà formée.
export const texteOffre = ({ montant = '', qui = '', article = '', compte = '', conseil = '' } = {}) => ({
  title: `💰 Offre ${montant ? montant + ' €' : ''}${qui ? ' de ' + qui : ''}`,
  body: `${article ? `« ${String(article).trim().slice(0, 40)} »` : 'Un acheteur t\'a fait une offre'}${compte ? ` (${compte})` : ''}${conseil || ''}`,
});
// 💬 Un message reçu (e-mail « Nouveau message »).
export const texteMessage = ({ paire = '', qui = '', compte = '', extrait = '' } = {}) => ({
  title: `💬 ${paire ? court(paire, 70) : (qui || 'Message Vinted')}`,
  body: `${qui && paire ? `${qui} · ` : ''}Nouveau message${compte ? ` sur ${compte}` : ''}${extrait ? ` : « ${extrait} »` : ' — ouvre Vinted pour répondre.'}`,
});

// ── L'APERÇU, famille par famille (ids de api/_lib/notif-textes.js, FAMILLES) ──
// `quoi` : une ligne, ce qui fait sonner ; `exemples` : { title, body, mene,
// exemple? } — `mene` = l'écran et l'élément que le toucher met en évidence
// (api/_lib/lien-notif.js, DESTINATIONS) ; `exemple: true` = texte écrit ici à
// la forme du texte réel (rappels du cron), pas fabriqué par la route.
// Données d'exemple inventées.
const EX = { compte: 'mon_compte', article: 'Nike Air Max 90 taille 42' };
export const APERCUS_NOTIF = {
  ventes: {
    quoi: 'Une paire vendue, l’argent qui arrive, une double vente à régler.',
    exemples: [
      { ...texteVendu({ article: EX.article, prix: '65', compte: EX.compte }), mene: 'Ventes · la vente, ouverte' },
      { ...texteArgentRecu({ montant: '61,20', article: EX.article, compte: EX.compte }), mene: 'Ventes' },
      { ...texteVenduVestiaire({ titre: 'Sac Longchamp Le Pliage', montant: 84, limite: '2026-11-12' }), mene: 'Ventes · Vestiaire · la vente' },
      { title: '⚠️ N°124 vendu sur Vinted · encore en ligne sur Leboncoin', body: EX.article, mene: 'Annonces · Leboncoin · la ligne « à retirer »', exemple: true },
    ],
  },
  poster: {
    quoi: 'Un bordereau reçu, et le rappel des colis à poster.',
    exemples: [
      { ...texteBordereau({ modele: 'Air Max 90', numero: '124', tamponne: true, dateLimite: '12/11' }), mene: 'Colis · À envoyer · la carte du colis' },
      { title: '📮 Demain : 3 colis à poster', body: 'Dont un avant 12 h. Ouvre l’app pour les préparer.', mene: 'Colis · À envoyer', exemple: true },
    ],
  },
  arrives: {
    quoi: 'Un achat arrivé au point relais, avec son code ; le dernier jour pour le retirer.',
    exemples: [
      { ...texteArrivee({ article: 'Adidas Samba OG', lieu: 'Tabac des Halles, 8 Rue des Lilas, 44000 Nantes', code: '454602', limite: '2026-11-12' }), mene: 'Colis · À retirer · la carte du colis, ouverte sur son code' },
      { title: '📍 Dernier jour · Tabac des Halles', body: 'À retirer aujourd’hui avant 19 h · Mondial Relay', mene: 'Colis · À retirer · la carte du colis', exemple: true },
    ],
  },
  offres: {
    quoi: 'Une offre reçue, une offre au-dessus de ton prix mini.',
    exemples: [
      { ...texteOffre({ montant: '55', qui: 'acheteur_92', article: EX.article, compte: EX.compte }), mene: 'Messages · la conversation, l’offre en évidence' },
      { title: 'Une offre au-dessus de ton prix mini', body: '58 € sur N°124 — à accepter en un geste.', mene: 'Messages · la conversation', exemple: true },
    ],
  },
  messages: {
    quoi: 'Un message, une annulation demandée, un achat à confirmer, un colis peut-être perdu.',
    exemples: [
      { ...texteMessage({ paire: EX.article, qui: 'acheteur_92', compte: EX.compte }), mene: 'Messages · la conversation, ouverte' },
      { title: '⚠️ Annulation demandée — Air Max 90', body: 'L’acheteur veut annuler sur mon_compte — accepte ou refuse dans la conversation Vinted.', mene: 'Messages · la conversation', exemple: true },
    ],
  },
  compta: {
    quoi: 'La déclaration URSSAF à faire, le bilan de la semaine.',
    exemples: [
      { title: '🧾 Déclaration URSSAF', body: 'Ta déclaration d’octobre est à faire avant le 30.', mene: 'Comptabilité · ta déclaration', exemple: true },
      { title: '📊 Ta semaine', body: '9 ventes · 412 € de chiffre d’affaires.', mene: 'Ma journée', exemple: true },
    ],
  },
};
export const apercuFamille = (id) => APERCUS_NOTIF[id] || null;
