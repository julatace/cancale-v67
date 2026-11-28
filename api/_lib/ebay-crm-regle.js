// ─────────────────────────────────────────────────────────────────────────────
// LE CRM eBAY — LES RÈGLES PURES (28 nov. 2026, lot ebay-crm).
// Julien : « copie les CRM eBay » (3Dsellers, eDesk, ChannelReply, Seller Hub).
// Ce fichier ne fait AUCUN appel : il est lu par la route (api/_lib/ebay-crm.js)
// ET par l'app (src/crm/…) — UNE règle, un seul propriétaire (§5, §11).
//
// ⚠️ L'IDENTITÉ D'UN ACHETEUR = l'identifiant de SON compte eBay
//   (`buyer.username` de l'API Fulfillment, `SenderID` / `CommentingUser` /
//   `buyerLoginName` ailleurs). Un identifiant eBay est unique sur eBay et ne
//   dépend pas de la casse. JAMAIS le nom, l'adresse, le titre ni une
//   ressemblance : 50 acheteurs nommés « Jean Martin » restent 50 acheteurs
//   (`audit-ebay-crm.cjs` I1). Un identifiant illisible ⇒ '' ⇒ rattaché à
//   personne (mieux vaut un blanc qu'un faux).
// ─────────────────────────────────────────────────────────────────────────────
import { etatCommandeEbay } from './ebay-etat-commande.js';

// Un identifiant de compte eBay : lettres, chiffres, « . _ - * » (les pseudos
// masqués d'eBay portent des « * »), 1 à 64 signes. Rendu en minuscules.
export function cleAcheteur(v) {
  const s = String(v == null ? '' : v).trim();
  return /^[A-Za-z0-9._*-]{1,64}$/.test(s) ? s.toLowerCase() : '';
}
// Les pseudos MASQUÉS (« j***n ») ne désignent personne de façon sûre : eBay
// masque plusieurs comptes de la même façon. Jamais regroupés.
export const acheteurMasque = (v) => String(v == null ? '' : v).includes('*');
export const memeAcheteur = (a, b) => { const x = cleAcheteur(a); return !!x && !acheteurMasque(x) && x === cleAcheteur(b); };
export const acheteurDeCommande = (o) => cleAcheteur(o && o.buyer && o.buyer.username);

// ── Les automatismes (C3 messages, C4 évaluation automatique) ─────────────────
// Chacun ÉTEINT par défaut. Allumé, il ne regarde que les commandes CRÉÉES après
// l'instant où il a été allumé (`depuis`) : allumer ne relance jamais tout
// l'historique. Une fois par commande (journal `faits`), jamais sur un retour,
// un litige, une annulation, un remboursement, ni pour un acheteur exclu.
export const AUTOMATISMES = Object.freeze(['apresVente', 'expedition', 'livraison', 'demandeEval', 'evalAuto']);
export const AUTO_MESSAGE = Object.freeze(['apresVente', 'expedition', 'livraison', 'demandeEval']);
export const VARIABLES = Object.freeze(['acheteur', 'article', 'suivi']);
export const TEXTES_MAX = 5;
export const LONGUEUR_MESSAGE = 2000;
export const LONGUEUR_EVALUATION = 80;     // eBay : 80 caractères pour une évaluation et pour sa réponse
export const LONGUEUR_SUJET = 100;
export const DELAI_DEFAUT = Object.freeze({ apresVente: 0, expedition: 0, livraison: 1, demandeEval: 3, evalAuto: 0 });   // en jours (0 = au passage suivant)
export const DELAI_MAX_J = 30;
export const ENVOIS_PAR_PASSAGE = 6;
export const ENVOIS_PAR_JOUR = 30;

export const variablesDe = (t) => [...new Set([...String(t == null ? '' : t).matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]))];
// Remplit {acheteur} {article} {suivi}. Une variable demandée mais pas sue ⇒ null
// (le texte ne part pas avec un trou, ni avec un « {suivi} » brut).
export function remplir(texte, vars) {
  const t = String(texte == null ? '' : texte);
  for (const v of variablesDe(t)) {
    if (!VARIABLES.includes(v)) return null;
    const val = vars && vars[v];
    if (val == null || String(val).trim() === '') return null;
  }
  return t.replace(/\{([a-zA-Z]+)\}/g, (_, v) => String(vars[v]).trim());
}
// Un texte acceptable pour un réglage : non vide, borné, variables connues.
export function texteValide(t, max = LONGUEUR_MESSAGE) {
  const s = String(t == null ? '' : t).trim();
  return !!s && s.length <= max && variablesDe(s).every((v) => VARIABLES.includes(v));
}
// Une version AU HASARD parmi celles qui peuvent se remplir (jamais toujours la
// première). `aleatoire` ∈ [0, 1[ (injecté : un banc le fixe). Rien de remplissable ⇒ null.
export function choisirTexte(textes, vars, aleatoire = Math.random()) {
  const possibles = (Array.isArray(textes) ? textes : []).map((t, i) => ({ i, t: remplir(t, vars) })).filter((x) => x.t && x.t.trim());
  if (!possibles.length) return null;
  const k = Math.min(possibles.length - 1, Math.max(0, Math.floor(Number(aleatoire) * possibles.length) || 0));
  return possibles[k];
}

const ent = (v, min, max, def) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : def; };
// Les réglages lus (ou absents) ⇒ une forme sûre : tout éteint par défaut.
export function normaliserReglages(d) {
  const src = d && typeof d === 'object' && d.auto && typeof d.auto === 'object' ? d.auto : {};
  const auto = {};
  for (const k of AUTOMATISMES) {
    const a = src[k] && typeof src[k] === 'object' ? src[k] : {};
    const max = k === 'evalAuto' ? LONGUEUR_EVALUATION : LONGUEUR_MESSAGE;
    const textes = (Array.isArray(a.textes) ? a.textes : []).filter((t) => texteValide(t, max)).map((t) => String(t).trim()).slice(0, TEXTES_MAX);
    const depuis = Number.isSafeInteger(a.depuis) && a.depuis > 0 ? a.depuis : null;
    auto[k] = {
      actif: a.actif === true && textes.length > 0 && depuis != null,
      depuis, textes,
      delaiJ: ent(a.delaiJ, 0, DELAI_MAX_J, DELAI_DEFAUT[k]),
      ...(k === 'evalAuto' ? {} : { sujet: String(a.sujet || '').trim().slice(0, LONGUEUR_SUJET) }),
    };
  }
  const modeles = (Array.isArray(d && d.modeles) ? d.modeles : [])
    .filter((m) => m && /^[a-z0-9-]{1,40}$/.test(String(m.id || '')) && String(m.nom || '').trim() && texteValide(m.texte))
    .slice(0, 50).map((m) => ({ id: String(m.id), nom: String(m.nom).trim().slice(0, 60), texte: String(m.texte).trim() }));
  return { version: 1, auto, modeles };
}

// ── La liste d'exclusion (C6), TOUTES plateformes ─────────────────────────────
// Une entrée = (site, identifiant de compte sur ce site). eBay : le pseudo ;
// Vinted : l'identifiant de membre (chiffres, lu dans un lien de profil) ;
// Leboncoin / Vestiaire : l'identifiant de leur profil. Jamais un nom.
export const SITES_EXCLUSION = Object.freeze(['ebay', 'vinted', 'leboncoin', 'vestiaire']);
export function cleExclusion(site, id) {
  const s = String(site || '');
  if (!SITES_EXCLUSION.includes(s)) return '';
  if (s === 'ebay') { const c = cleAcheteur(id); return c && !acheteurMasque(c) ? c : ''; }
  let v = String(id == null ? '' : id).trim();
  // Un lien de profil collé : on n'en garde que l'identifiant.
  const m = s === 'vinted' ? /\/member\/(\d{1,20})/.exec(v) : s === 'leboncoin' ? /\/profil\/([A-Za-z0-9-]{6,64})/.exec(v) : /\/profile\/([A-Za-z0-9_-]{1,64})/.exec(v);
  if (m) v = m[1];
  if (s === 'vinted') return /^\d{1,20}$/.test(v) ? v : '';
  return /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v.toLowerCase() : '';
}
export function normaliserExclus(d) {
  const vus = new Set(), liste = [];
  for (const e of (Array.isArray(d && d.liste) ? d.liste : [])) {
    const id = cleExclusion(e && e.site, e && e.id);
    if (!id || vus.has(e.site + ':' + id)) continue;
    vus.add(e.site + ':' + id);
    liste.push({ site: e.site, id, note: String((e && e.note) || '').slice(0, 120), le: Number.isSafeInteger(e && e.le) ? e.le : null });
  }
  return { version: 1, liste: liste.slice(0, 5000) };
}
// `exclus` : la liste lue. `undefined` (pas su) ⇒ `null` : l'appelant ne fait RIEN.
export function estExclu(exclus, site, id) {
  if (exclus === undefined || exclus === null) return null;
  const c = cleExclusion(site, id);
  if (!c) return null;   // un identifiant illisible : on ne sait pas ⇒ l'appelant s'abstient
  return normaliserExclus(exclus).liste.some((e) => e.site === site && e.id === c);
}
export const exclusDuSite = (exclus, site) => new Set(normaliserExclus(exclus).liste.filter((e) => e.site === site).map((e) => e.id));

// ── Ce qui interdit tout automatisme sur une commande ────────────────────────
// `blocages` : { commandes:Set(orderId), annonces:Set(itemId) } — retours,
// litiges de paiement, réclamations « objet non reçu », cas ouverts (un litige
// ne porte souvent que l'annonce : toute commande de cette annonce s'abstient).
export function raisonBlocage(order, blocages) {
  const e = etatCommandeEbay(order);
  if (e.kind === 'cancelled' || e.kind === 'refunded' || e.kind === 'review') return 'annulee-ou-remboursee';
  if (e.kind === 'payment') return 'pas-payee';
  if (!blocages) return 'litiges-pas-su';
  const id = String((order && order.orderId) || '');
  if (blocages.commandes && blocages.commandes.has(id)) return 'retour-ou-litige';
  for (const l of (order && Array.isArray(order.lineItems) ? order.lineItems : [])) {
    if (blocages.annonces && blocages.annonces.has(String(l.legacyItemId || ''))) return 'retour-ou-litige';
  }
  return null;
}

// Qu'est-ce qu'un automatisme peut faire de cette commande, MAINTENANT ?
// Rend { ok:true } ou { ok:false, raison, plusTard? } — `plusTard` : rien
// d'interdit, l'heure n'est pas venue (ou la livraison pas encore prouvée).
export function jugerAutomatisme({ quoi, order, reglage, faits, exclus, blocages, livreLe, maintenant }) {
  if (!reglage || reglage.actif !== true) return { ok: false, raison: 'eteint' };
  const id = String((order && order.orderId) || '');
  if (!id) return { ok: false, raison: 'commande-illisible' };
  if (faits && faits[id] && faits[id][quoi]) return { ok: false, raison: 'deja-fait' };
  const cree = Date.parse((order && order.creationDate) || '');
  if (!Number.isFinite(cree)) return { ok: false, raison: 'date-illisible' };
  if (cree < reglage.depuis) return { ok: false, raison: 'avant-allumage' };
  const acheteur = acheteurDeCommande(order);
  if (!acheteur || acheteurMasque(acheteur)) return { ok: false, raison: 'acheteur-illisible' };
  const ex = estExclu(exclus, 'ebay', acheteur);
  if (ex === null) return { ok: false, raison: 'exclusion-pas-sue' };
  if (ex) return { ok: false, raison: 'exclu' };
  const b = raisonBlocage(order, blocages);
  if (b) return { ok: false, raison: b };
  const etat = etatCommandeEbay(order);
  const jour = 86400000, delai = (reglage.delaiJ || 0) * jour;
  if (quoi === 'apresVente' || quoi === 'evalAuto') {
    // « Quand il a payé » : PAYÉE (raisonBlocage a écarté le reste).
    return maintenant - cree >= delai ? { ok: true } : { ok: false, raison: 'pas-encore', plusTard: true };
  }
  if (quoi === 'expedition') return etat.expedie ? { ok: true } : { ok: false, raison: 'pas-expediee', plusTard: true };
  if (quoi === 'livraison' || quoi === 'demandeEval') {
    if (!etat.expedie) return { ok: false, raison: 'pas-expediee', plusTard: true };
    // La livraison se PROUVE (ActualDeliveryTime lu chez eBay) : « pas su » ne vaut pas « livrée ».
    if (!Number.isFinite(livreLe)) return { ok: false, raison: 'livraison-pas-prouvee', plusTard: true };
    return maintenant - livreLe >= delai ? { ok: true } : { ok: false, raison: 'pas-encore', plusTard: true };
  }
  return { ok: false, raison: 'inconnu' };
}

// ── LA FICHE ACHETEUR (C1) ────────────────────────────────────────────────────
const centimes = (v) => { const n = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };
export function commandesDeAcheteur(orders, acheteur) {
  const c = cleAcheteur(acheteur);
  if (!c || acheteurMasque(c)) return [];
  return (Array.isArray(orders) ? orders : []).filter((o) => o && typeof o.orderId === 'string' && acheteurDeCommande(o) === c);
}
// Les achats d'un acheteur chez lui, et leur montant. Le total ne compte que les
// commandes payées, ni annulées ni remboursées, EN EUROS ; une autre devise est
// écartée et DITE (jamais convertie), un montant illisible est nommé (« sur N »).
export function resumeAchats(commandes) {
  let eur = 0, nEur = 0, illisibles = 0; const autres = {}; const lignes = [];
  for (const o of commandes) {
    const e = etatCommandeEbay(o);
    const t = o.pricingSummary && o.pricingSummary.total;
    const l0 = Array.isArray(o.lineItems) && o.lineItems[0] ? o.lineItems[0] : {};
    lignes.push({ orderId: o.orderId, date: o.creationDate || null, titre: String(l0.title || '').slice(0, 120), itemId: String(l0.legacyItemId || ''), n: Array.isArray(o.lineItems) ? o.lineItems.length : 0,
      montant: t && Number.isFinite(centimes(t.value)) ? (centimes(t.value) / 100).toFixed(2) : null, devise: t && /^[A-Z]{3}$/.test(String(t.currency || '')) ? t.currency : null,
      etat: { label: e.label, kind: e.kind }, compte: o._compte || 'principal' });
    if (['cancelled', 'refunded', 'review', 'payment'].includes(e.kind)) continue;
    if (!t || !Number.isFinite(centimes(t.value)) || !/^[A-Z]{3}$/.test(String(t.currency || ''))) { illisibles++; continue; }
    if (t.currency === 'EUR') { eur += centimes(t.value); nEur++; } else autres[t.currency] = (autres[t.currency] || 0) + 1;
  }
  lignes.sort((a, b) => (Date.parse(b.date || '') || 0) - (Date.parse(a.date || '') || 0));
  return { commandes: lignes, total: { eur: nEur ? (eur / 100).toFixed(2) : null, nCompte: nEur, illisibles, autresDevises: Object.entries(autres).map(([devise, n]) => ({ devise, n })) } };
}
// L'annuaire : un acheteur par identifiant (jamais par nom), le plus récent d'abord.
// `q` cherche dans l'IDENTIFIANT seulement (une proposition ; c'est son toucher qui ouvre la fiche).
export function annuaireAcheteurs(orders, q = '', max = 200) {
  const par = new Map();
  const qq = String(q || '').trim().toLowerCase();
  for (const o of (Array.isArray(orders) ? orders : [])) {
    const c = acheteurDeCommande(o);
    if (!c || acheteurMasque(c)) continue;
    if (qq && !c.includes(qq)) continue;
    const x = par.get(c) || { acheteur: String(o.buyer.username).trim(), n: 0, dernier: 0, comptes: new Set() };
    x.n++; x.dernier = Math.max(x.dernier, Date.parse(o.creationDate || '') || 0); x.comptes.add(o._compte || 'principal');
    par.set(c, x);
  }
  return [...par.values()].sort((a, b) => b.dernier - a.dernier || a.acheteur.localeCompare(b.acheteur)).slice(0, max)
    .map((x) => ({ acheteur: x.acheteur, n: x.n, dernier: x.dernier ? new Date(x.dernier).toISOString() : null, comptes: [...x.comptes] }));
}
