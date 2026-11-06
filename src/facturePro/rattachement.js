// ════════════════════════════════════════════════════════════════════════════
//  LA FACTURE PRO — LE BON ACHETEUR, PROUVÉ (6 novembre)
// ════════════════════════════════════════════════════════════════════════════
// Julien (6 nov.) : « je veux avoir à côté le bouton pour envoyer la facture à
// l'acheteur car on a toutes ses infos ; tu dois relier avec l'heure de la vente
// pour être sûr d'envoyer à la bonne personne. »
//
// Module PUR (aucun réseau, aucun DOM) : l'app l'exécute pour dire, sur chaque
// vente, si le bouton existe ; le serveur (api/_lib/facture-pro.js) le RÉEXÉCUTE
// sur ses propres lectures avant d'émettre et avant d'envoyer — la même règle
// des deux côtés (§11), jamais l'acheteur que le navigateur prétend.
//
// ── LA RÈGLE (§5 : jamais par titre, jamais par pseudo, jamais par ressemblance)
// Une facture n'est rattachée à une vente QUE par le n° de transaction :
//   1. la vente Vinted (`orders_sold` d'un compte) porte ce n° — UNE seule ;
//   2. l'e-mail de vente Vinted Pro (`email_sale_*`, pro:true) porte ce n° —
//      un seul acheteur (deux e-mails au même n° et au même acheteur = le même
//      e-mail reçu deux fois ; deux acheteurs = rien) ;
//   3. CONTRÔLES en plus (ils ne relient rien, ils peuvent seulement refuser) :
//      · le compte : l'e-mail et la vente sont du même compte Vinted ;
//      · l'heure : l'e-mail est arrivé entre 2 min AVANT et 15 min APRÈS
//        l'heure de la vente Vinted. Mesuré le 6 nov. sur les 10 ventes Pro
//        réelles : écart de 33 à 118 s (toujours après) ; la fenêtre laisse
//        ~7 fois le pire écart vu, et 2 min d'avance pour des horloges qui ne
//        s'accordent pas à la seconde ;
//      · le montant : le prix de l'e-mail = le prix de la vente, au centime,
//        en euros ;
//      · le brouillon de facture (`email_invoice_tx{n°}`) s'il existe : même
//        n°, même adresse e-mail d'acheteur ;
//   4. l'acheteur a un nom, une adresse postale et une adresse e-mail valide.
// Un seul manque ⇒ PAS de facture, et la raison en mots (« acheteur pas
// prouvé : … »). Mieux vaut un blanc qu'un faux : une facture à la mauvaise
// personne envoie le nom, l'adresse et l'achat d'un client à un autre.

export const FENETRE_AVANT_S = 2 * 60;
export const FENETRE_APRES_S = 15 * 60;
export const TX_RE = /^\d{4,20}$/;

const txt = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
const emailOk = (v) => /^[^\s@<>"',;()[\]\\]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(txt(v));
const minuscules = (v) => txt(v).toLowerCase();

// Un prix en CENTIMES entiers : « 30.00 », « 30,00 », 30, { amount: '30.00' }.
// `null` = pas su (jamais 0).
export function centimesDe(v) {
  const brut = v && typeof v === 'object' ? v.amount : v;
  if (brut == null || brut === '') return null;
  const n = Number(String(brut).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}
const deviseDe = (v) => (v && typeof v === 'object' && v.currency_code ? String(v.currency_code).toUpperCase() : 'EUR');
const instant = (v) => { const t = typeof v === 'number' ? v : Date.parse(v || ''); return Number.isFinite(t) ? t : null; };
const enMinutes = (s) => { const m = Math.round(Math.abs(s) / 60); return m < 1 ? `${Math.round(Math.abs(s))} s` : m < 120 ? `${m} min` : `${Math.round(m / 60)} h`; };

// Le refus, toujours avec sa raison.
const non = (code, raison) => ({ prouve: false, code, raison });
export const phraseRefus = (p) => (p && !p.prouve ? `acheteur pas prouvé : ${p.raison}` : '');

// `tx`        le n° de transaction de la vente (la ligne de Ventes)
// `mails`     les e-mails de vente Vinted Pro rangés (projection scalaire) :
//             { transaction, receivedAt, prix, email, nom|nomComplet, adresse, uid, designation, pro }
// `commandes` les ventes Vinted lues (une entrée de `my_orders` + son compte) :
//             { transaction_id, date, price:{amount,currency_code}, uid, title }
// `brouillon` (facultatif) la ligne `email_invoice_tx{tx}` : { transaction, buyerEmail }
// `adresseLisible` (facultatif) remet l'adresse Vinted en lignes postales.
export function preuveAcheteur({ tx, mails = [], commandes = [], brouillon = null, adresseLisible = (a) => a } = {}) {
  const t = txt(tx);
  if (!TX_RE.test(t)) return non('tx', 'la vente n’a pas de n° de transaction lu');

  // 1. LA VENTE VINTED portant ce n° (une par compte au plus ; deux comptes = deux candidats).
  const vues = new Map();
  for (const c of Array.isArray(commandes) ? commandes : []) {
    if (!c || txt(c.transaction_id) !== t) continue;
    const k = txt(c.uid) || '?';
    if (!vues.has(k)) vues.set(k, c);
  }
  if (!vues.size) return non('vinted', 'la vente n’est pas (encore) lue dans tes ventes Vinted — ouvre Vinted sur ce compte');
  if (vues.size > 1) return non('ventes', 'deux ventes Vinted portent ce n° de transaction');
  const cmd = [...vues.values()][0];

  // 2. L'E-MAIL DE VENTE PRO portant ce n° (un seul acheteur).
  const siens = (Array.isArray(mails) ? mails : []).filter((m) => m && txt(m.transaction) === t && (m.pro === true || m.pro === 'true' || m.pro === undefined));
  if (!siens.length) return non('mail', 'aucun e-mail de vente Vinted Pro pour cette transaction n’est arrivé dans VRM');
  const acheteurs = new Map();
  for (const m of siens) {
    const k = `${minuscules(m.email)}|${minuscules(m.nom != null ? m.nom : m.nomComplet)}`;
    if (!acheteurs.has(k)) acheteurs.set(k, m);
  }
  if (acheteurs.size > 1) return non('mails', 'deux e-mails de vente portent ce n° avec des acheteurs différents');
  const mail = [...acheteurs.values()][0];

  // 3. CONTRÔLES. Le compte.
  if (txt(mail.uid) && txt(cmd.uid) && txt(mail.uid) !== txt(cmd.uid)) return non('compte', 'l’e-mail de vente est celui d’un autre compte Vinted que la vente');
  // L'heure.
  const tMail = instant(mail.receivedAt); const tVente = instant(cmd.date);
  if (tMail == null) return non('heure', 'l’heure d’arrivée de l’e-mail de vente n’est pas lue');
  if (tVente == null) return non('heure', 'l’heure de la vente Vinted n’est pas lue');
  const ecartS = Math.round((tMail - tVente) / 1000);
  if (ecartS < -FENETRE_AVANT_S) return non('heure', `l’e-mail de vente est arrivé ${enMinutes(ecartS)} AVANT la vente Vinted`);
  if (ecartS > FENETRE_APRES_S) return non('heure', `l’e-mail de vente est arrivé ${enMinutes(ecartS)} après la vente (au-delà de ${FENETRE_APRES_S / 60} min)`);
  // Le montant.
  if (deviseDe(cmd.price) !== 'EUR') return non('montant', `la vente est en ${deviseDe(cmd.price)}, pas en euros`);
  const cMail = centimesDe(mail.prix); const cVente = centimesDe(cmd.price);
  if (cMail == null || cVente == null) return non('montant', 'le prix de l’e-mail ou de la vente n’est pas lu');
  if (cMail !== cVente) return non('montant', `le prix diffère (e-mail ${(cMail / 100).toFixed(2).replace('.', ',')}\u00a0€, Vinted ${(cVente / 100).toFixed(2).replace('.', ',')}\u00a0€)`);
  // Le brouillon de facture, s'il existe.
  if (brouillon && typeof brouillon === 'object') {
    if (txt(brouillon.transaction) && txt(brouillon.transaction) !== t) return non('brouillon', 'le brouillon de facture porte un autre n° de transaction');
    if (txt(brouillon.buyerEmail) && minuscules(brouillon.buyerEmail) !== minuscules(mail.email)) return non('brouillon', 'le brouillon de facture porte une autre adresse e-mail d’acheteur');
  }
  // 4. L'acheteur complet.
  const nom = txt(mail.nom != null ? mail.nom : mail.nomComplet);
  const adresse = String(adresseLisible(String(mail.adresse || '')) || '').trim();
  const manque = [];
  if (!nom) manque.push('son nom');
  if (!adresse) manque.push('son adresse');
  if (!emailOk(mail.email)) manque.push('son adresse e-mail');
  if (manque.length) return non('acheteur', `l’e-mail de vente ne donne pas ${manque.join(', ni ')}`);

  return {
    prouve: true,
    tx: t,
    uid: txt(cmd.uid || mail.uid),
    ecartS,
    centimes: cVente,
    venteLe: new Date(tVente).toISOString(),
    designation: txt(mail.designation) || txt(cmd.title),
    acheteur: { nom, adresse, email: txt(mail.email) },
  };
}
