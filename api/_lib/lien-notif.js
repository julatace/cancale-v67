// api/_lib/lien-notif.js
// ────────────────────────────────────────────────────────────────────────────
// L'ADRESSE QU'OUVRE UNE NOTIFICATION (31 octobre, Julien : « quand on reçoit
// une notification, ça doit nous amener précisément à l'endroit où ça doit nous
// amener »). Chaque émetteur (emails, rappels, extension via /api/push) passe
// par ici : l'écran (`tab`), le filtre de site (`site`), la section
// (`section`), la vue (`vue`) et la CIBLE — l'élément précis, nommé par une
// IDENTITÉ (n° de transaction, de suivi, de conversation, N°), jamais par un
// titre. L'app lit ces mêmes clés (`src/cibleNotif.js`, `lireCible`) : c'est
// le contrat entre les deux, une clé inconnue est ignorée là-bas.
//
// ⚠️ Rien de sensible dans l'adresse : ni pseudo, ni montant, ni code de
// retrait. Une identité mal formée est OMISE (l'écran s'ouvre nu, sans cible),
// jamais devinée.
// ────────────────────────────────────────────────────────────────────────────
import { normaliserSuivi } from './etat-colis-email.js';

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const propre = (v) => { const s = String(v == null ? '' : v).trim(); return ID.test(s) ? s : ''; };
// (10 nov., lot BC) `lundi` : la semaine (AAAA-MM-JJ, un lundi) de l'écran « Ma semaine ».
const ORDRE = ['tab', 'site', 'section', 'vue', 'cible', 'conv', 'compte', 'tx', 'suivi', 'num', 'vc', 'plat', 'colonne', 'lundi', 'session'];

export function lienNotif(tab, o = {}) {
  const p = { tab, ...o };
  if (p.suivi != null) p.suivi = normaliserSuivi(p.suivi);
  const parts = [];
  for (const k of ORDRE) {
    const v = propre(p[k]);
    if (v) parts.push(`${k}=${encodeURIComponent(v)}`);
  }
  // Une cible dont l'identité manque n'est pas une cible.
  const garde = (cible, ...cles) => (o.cible === cible && !cles.some((c) => propre(p[c]))) ;
  if (garde('conv', 'conv') || garde('offre', 'conv') || garde('vcvente', 'vc') || garde('vente', 'tx') || garde('colis', 'tx') || garde('achat', 'tx') || garde('retrait', 'tx', 'suivi')) {
    return '/?' + parts.filter((x) => /^(tab|site|section|vue|compte)=/.test(x)).join('&');
  }
  return '/?' + parts.join('&');
}

// Les destinations, une par famille de notification (une seule règle, ici).
export const DESTINATIONS = {
  // Messages · Vinted · la conversation (si l'email en porte l'identité).
  message: ({ conv, compte } = {}) => lienNotif('messages', { site: 'vinted', compte, ...(conv ? { cible: 'conv', conv } : {}) }),
  // (5 nov.) Une offre reçue : SA conversation ouverte, la carte de l'offre en évidence.
  offre: ({ conv, compte } = {}) => lienNotif('messages', { site: 'vinted', compte, ...(conv ? { cible: 'offre', conv } : {}) }),
  offres: () => lienNotif('messages', { site: 'vinted', cible: 'offres' }),
  // (10 nov., lot AT) Messages · Vestiaire, où vivent les cartes d'offres reçues (le résumé du soir).
  vcOffres: () => lienNotif('messages', { site: 'vestiaire' }),
  // Ventes · Vinted · la vente ouverte.
  vente: ({ tx } = {}) => lienNotif('ventes', { site: 'vinted', ...(tx ? { cible: 'vente', tx } : {}) }),
  // (5 nov.) Ventes · Vestiaire · la vente (identité = le productId de l'annonce).
  vcVente: ({ id } = {}) => lienNotif('ventes', { site: 'vestiaire', ...(id ? { cible: 'vcvente', vc: id } : {}) }),
  // Colis · la carte du colis à poster (ou la colonne « Prêts à imprimer »).
  colis: ({ tx } = {}) => lienNotif('cat_bord', tx ? { cible: 'colis', tx } : { cible: 'colonne', colonne: 'prets' }),
  // Colis · « À retirer » · la carte (par transaction ou n° de suivi).
  retrait: ({ tx, suivi } = {}) => lienNotif('cat_bord', (propre(tx) || propre(suivi)) ? { cible: 'retrait', tx, suivi } : { cible: 'colonne', colonne: 'retirer' }),
  // Achats (la liste complète) · la ligne de l'achat.
  achat: ({ tx } = {}) => lienNotif('cat_achats', { vue: 'achats', ...(tx ? { cible: 'achat', tx } : {}) }),
  // Comptabilité · « Ta déclaration URSSAF ».
  urssaf: () => lienNotif('compta', { cible: 'urssaf' }),
  // L'écran où se règle une double vente : eBay → Annonces (« Retirer d'eBay »)
  // ou Leboncoin → Annonces (« à retirer de Leboncoin »).
  doublon: ({ plat, num } = {}) => lienNotif('annonces', { site: plat === 'ebay' ? 'ebay' : 'leboncoin', cible: 'doublon', plat: plat === 'ebay' ? 'ebay' : 'leboncoin', num }),
  favorisFile: () => lienNotif('messages', { site: 'vinted', vue: 'favoris' }),
  favori: () => lienNotif('annonces', { site: 'vinted' }),
  agentEbay: () => lienNotif('plat_ebay', { section: 'agent' }),
  facture: () => lienNotif('compta', { section: 'factures' }),
  journee: () => lienNotif('journee'),
  // (10 nov., lot BC) Le bilan de la semaine ouvre « Ma semaine » sur SA semaine (le lundi).
  semaine: ({ lundi } = {}) => lienNotif('semaine', { lundi: /^\d{4}-\d{2}-\d{2}$/.test(String(lundi || '')) ? lundi : '' }),
  // (5 nov.) Paramètres → Comptes liés : chaque compte, sa dernière relecture.
  comptes: () => lienNotif('vintedaccounts'),
  // (8 nov.) Paramètres → « Tout va bien ? » : un compte qui n'arrive plus (api/_lib/garde-capture.js).
  toutVaBien: () => lienNotif('settings', { section: 'toutvabien' }),
  // (10 nov., lot H) « Nouvel appareil » : Paramètres → Appareils connectés, CETTE session en évidence.
  appareil: ({ session } = {}) => lienNotif('settings', { section: 'appareils', session: /^[0-9a-f-]{36}$/i.test(String(session || '')) ? session : '' }),
  // (6 nov.) Leboncoin a supprimé une annonce (e-mail sans identité) : Annonces · Leboncoin,
  // où l'app dit d'ouvrir « Mes annonces » sur Leboncoin (api/_lib/lbc-suppression.js).
  lbcAnnonces: () => lienNotif('annonces', { site: 'leboncoin' }),
};

// L'identité de la conversation dans un email Vinted : le lien « Répondre »
// mène à `vinted.<pays>/inbox/<id>` (parfois encodé dans un lien de suivi).
// Absent ⇒ '' (la notification ouvre Messages · Vinted, sans cible).
// Jamais un nombre pris ailleurs dans le texte : seulement après `/inbox/`.
const INBOX = /vinted\.[a-z.]{2,8}(?:\/|%2F)inbox(?:\/|%2F)(\d{3,20})(?![\d])/i;
export function conversationDeLEmail(mail) {
  const t = `${(mail && mail.html) || ''}\n${(mail && mail.text) || ''}`;
  const m = INBOX.exec(t);
  return m ? m[1] : '';
}
