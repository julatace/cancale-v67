// ── LE TABLEAU DE BORD eBAY : LES RÈGLES (15 nov., eBay complet 2) ───────────────
// Pures, sans texte (les clés `ebt.*` sont dans src/i18n/langues/<l>/ebaytableau.js).
// Elles lisent ce que rend la route (`api/_lib/ebay-tableau.js`) et ce que l'app a déjà
// (commandes rangées) ; elles ne CALCULENT aucune règle d'argent nouvelle :
//   · « versé ce mois » = la somme des versements ARRIVÉS (SUCCEEDED) ce mois-ci, en
//     euros ; une autre devise est comptée À PART (jamais additionnée, jamais convertie) ;
//   · « pas su » ≠ 0 partout : une partie que la route n'a pas lue rend `null`.
// Trois états d'une partie : `undefined` en cours · `{ ko }` pas su (avec sa raison) · lue.

import { moisParis as moisParisApp } from '../dateParis.js';

export const etatPartie = (p) => (p === undefined ? 'en-cours' : !p || p.ko ? 'ko' : 'lu');

const moisDe = (iso) => (typeof iso === 'string' && iso.length >= 7 ? iso.slice(0, 7) : null);
// Le mois courant à Paris (« AAAA-MM ») : un versement du 1er à 0 h 30 de Paris est de ce mois
// (la règle de src/dateParis.js, la seule de l'app).
export const moisParis = (maintenant = Date.now()) => moisParisApp(maintenant);
const moisParisDe = (iso) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? moisParis(t) : moisDe(iso); };

// « Versé ce mois » : { eur, n, autres: [{ c, v }], enRoute: { eur, n } } ; null si pas su.
export function verseMois(versements, maintenant = Date.now()) {
  if (!Array.isArray(versements)) return null;
  const ym = moisParis(maintenant);
  let eur = 0, n = 0, eurRoute = 0, nRoute = 0; const autres = {};
  for (const p of versements) {
    if (!p || !p.montant) continue;
    if (p.statut === 'INITIATED') { if (p.montant.c === 'EUR') { eurRoute += p.montant.v; nRoute++; } continue; }
    if (p.statut !== 'SUCCEEDED' || moisParisDe(p.date) !== ym) continue;
    if (p.montant.c !== 'EUR') { autres[p.montant.c] = Math.round(((autres[p.montant.c] || 0) + p.montant.v) * 100) / 100; continue; }
    eur += p.montant.v; n++;
  }
  return { eur: Math.round(eur * 100) / 100, n, autres: Object.entries(autres).map(([c, v]) => ({ c, v })), enRoute: { eur: Math.round(eurRoute * 100) / 100, n: nRoute } };
}
// Le dernier versement arrivé et celui en route (s'il y en a un).
export function derniersVersements(versements) {
  if (!Array.isArray(versements)) return null;
  const tri = [...versements].filter((p) => p && p.date).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return { arrive: tri.find((p) => p.statut === 'SUCCEEDED') || null, enRoute: tri.find((p) => p.statut === 'INITIATED') || null, echoue: tri.filter((p) => /FAILED|REVERSED/.test(p.statut || '')) };
}

// Les totaux du trafic : une valeur « pas su » rend le total « au moins » (`partiel`).
export function totauxTrafic(trafic) {
  if (!trafic || trafic.ko || !Array.isArray(trafic.annonces)) return null;
  const t = { affichages: 0, vues: 0, ventes: 0, n: trafic.annonces.length, partiel: false };
  for (const a of trafic.annonces) for (const k of ['affichages', 'vues', 'ventes']) { if (a[k] == null) t.partiel = true; else t[k] += a[k]; }
  return t;
}
// Le taux de transformation d'une annonce : ventes / vues (null si l'un manque ou 0 vue).
export const transformation = (a) => (a && a.vues > 0 && a.ventes != null ? Math.round((a.ventes / a.vues) * 1000) / 10 : null);

// La santé en un mot : 'bon' · 'attention' (sous le standard, réclamations élevées) · null (pas su).
export function etatSante(sante) {
  if (!sante || sante.ko) return null;
  const niv = sante.niveau && !sante.niveau.ko ? sante.niveau.niveau : undefined;
  const notes = [sante.nonConforme, sante.nonRecu].filter((x) => x && !x.ko).map((x) => x.note);
  if (niv === undefined && !notes.length) return null;
  if (niv === 'BELOW_STANDARD' || notes.some((n) => n === 'HIGH' || n === 'VERY_HIGH')) return 'attention';
  return niv === null && !notes.length ? null : 'bon';
}
export const nbACorriger = (sante) => (sante && !sante.ko && Array.isArray(sante.aCorriger) ? sante.aCorriger.length : null);

const OUVERT = /^(OPEN|ACTION_NEEDED|UNDER_REVIEW|WAITING_SELLER_RESPONSE|WAITING_FOR_SELLER|PENDING|ESCALATED|CS_CLOSED_WAITING|WAITING_BUYER_RESPONSE)$/;
const ATTEND_TOI = /^(ACTION_NEEDED|WAITING_SELLER_RESPONSE|WAITING_FOR_SELLER)$/;
// Les litiges ouverts : { n, aToi, lignes, ko: [parties pas lues] } ; null si RIEN n'est lu.
export function litigesOuverts(litiges) {
  if (!litiges || litiges.ko) return null;
  const lignes = [], ko = [];
  for (const k of ['paiement', 'reclamations', 'cas']) {
    const l = litiges[k];
    if (!Array.isArray(l)) { ko.push(k); continue; }
    for (const x of l) if (OUVERT.test(x.etat || '')) lignes.push({ ...x, partie: k, aToi: ATTEND_TOI.test(x.etat || '') });
  }
  if (ko.length === 3) return null;
  lignes.sort((a, b) => (b.aToi - a.aToi) || String(a.repondreAvant || '9').localeCompare(String(b.repondreAvant || '9')));
  return { n: lignes.length, aToi: lignes.filter((x) => x.aToi).length, lignes, ko };
}

// « À faire » sur eBay : chaque chose avec son geste (une clé `ebt.afaire.*` et sa section).
// Un manque de DROIT ou de SIGNATURE est un geste aussi (reconnecter / poser la clé).
export function aFaireEbay({ tableau, aExpedier }) {
  const out = [];
  if (aExpedier > 0) out.push({ cle: 'expedier', n: aExpedier, section: 'ventes' });
  if (!tableau) return out;
  const li = litigesOuverts(tableau.litiges);
  if (li && li.aToi) out.push({ cle: 'litiges', n: li.aToi, section: 'sante' });
  const ac = nbACorriger(tableau.sante);
  if (ac) out.push({ cle: 'corriger', n: ac, section: 'sante' });
  const inv = tableau.trafic && !tableau.trafic.ko && tableau.trafic.invisibles ? tableau.trafic.invisibles.invisibles.length : 0;
  if (inv) out.push({ cle: 'invisibles', n: inv, section: 'trafic' });
  if (etatSante(tableau.sante) === 'attention') out.push({ cle: 'sante', n: null, section: 'sante' });
  const raisons = new Set([tableau.argent, tableau.trafic, tableau.sante && tableau.sante.niveau, tableau.litiges && tableau.litiges.paiement].filter((p) => p && p.ko).map((p) => p.ko.raison));
  if (raisons.has('scope')) out.push({ cle: 'reconnecter', n: null, section: 'compte' });
  if (raisons.has('signature') || raisons.has('signature-refusee')) out.push({ cle: 'signature', n: null, section: null });
  return out;
}

// Les dates de versement eBay (par n° de commande), lues sur chaque compte
// (`ebay_versements{suffixe}`, projection `d:data->dates`). Une ligne illisible ⇒ ses
// commandes restent datées comme avant (date de la commande) : rien n'est perdu.
export function datesVersementEbay(lignes) {
  const out = {};
  for (const x of (Array.isArray(lignes) ? lignes : [])) {
    const d = x && x.ligne && x.ligne.d;
    if (!d || typeof d !== 'object') continue;
    for (const [id, v] of Object.entries(d)) if (/^[A-Za-z0-9-]{1,64}$/.test(id) && /^\d{4}-\d{2}-\d{2}$/.test(String(v))) out[id] = String(v);
  }
  return out;
}

// La commande VRM d'une transaction eBay (par n° de commande, jamais par le titre) :
// le titre et le N° viennent de la commande rangée.
export function commandeDe(commandes, orderId) {
  if (!Array.isArray(commandes) || !orderId) return null;
  return commandes.find((o) => o && (o.orderId === orderId || o.legacyOrderId === orderId)) || null;
}

// ── (15 nov., 2e tour) LE CALENDRIER DES VERSEMENTS : ce qui arrive et ce qui est arrivé.
// `enRoute` : versements lancés (INITIATED), du plus proche au plus lointain ; `recents` :
// arrivés depuis 7 jours ; `rates` : ratés (geste : vérifier son IBAN dans eBay). Pas lu ⇒ null.
export function calendrierVersements(versements, maintenant = Date.now()) {
  if (!Array.isArray(versements)) return null;
  const t = (p) => Date.parse((p && p.date) || '');
  const lus = versements.filter((p) => p && p.montant);
  return {
    enRoute: lus.filter((p) => p.statut === 'INITIATED').sort((a, b) => t(a) - t(b)),
    recents: lus.filter((p) => p.statut === 'SUCCEEDED' && Number.isFinite(t(p)) && maintenant - t(p) <= 7 * 86400000).sort((a, b) => t(b) - t(a)),
    rates: lus.filter((p) => /FAILED|REVERSED/.test(p.statut || '')),
  };
}
// « Corriger les évidentes » : par annonce, les caractéristiques MANQUANTES pour lesquelles eBay
// ne propose QU'UNE valeur (la liste est montrée avant ; le serveur relit tout avant d'écrire).
export function correctionsEvidentes(aCorriger) {
  const out = [];
  for (const c of (Array.isArray(aCorriger) ? aCorriger : [])) {
    if (!c || !/^\d{1,19}$/.test(String(c.itemId || ''))) continue;
    const aspects = {};
    for (const p of (c.problemes || [])) for (const s of (p.suggestions || [])) if (s && s.nom && Array.isArray(s.valeurs) && s.valeurs.length === 1 && (!(p.manque || []).length || p.manque.includes(s.nom))) aspects[s.nom] = s.valeurs[0];
    if (Object.keys(aspects).length) out.push({ itemId: String(c.itemId), sku: c.sku || '', aspects });
  }
  return out;
}
