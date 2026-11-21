// ════════════════════════════════════════════════════════════════════════════
//  LA FACTURE PRO — « À ENVOYER », L'ENVOI AUTOMATIQUE, LE REGISTRE (10 nov., lot Q)
// ════════════════════════════════════════════════════════════════════════════
// Module PUR (aucun réseau, aucun DOM) : l'app l'exécute pour la liste « À envoyer »
// et le registre ; le serveur (api/_lib/factures-auto.js) l'exécute pour l'envoi
// automatique — la MÊME règle des deux côtés (§11).
//
// ── L'ÉTAT D'UNE VENTE PRO (`etatVentePro`) ──────────────────────────────────
// L'identité est le n° de transaction (§5), jamais un titre ni un pseudo. Dans l'ordre :
//   · un AVOIR émis ⇒ « annulée » (rien à faire) ;
//   · la vente Vinted dit « annulée / remboursée / retour… » (`classer`, la règle
//     `classifyOrderStatus` de l'app et du serveur) : facture émise ⇒ « avoir à
//     faire » (PROPOSÉ, son clic) ; pas de facture ⇒ rien à facturer ;
//   · facture envoyée ⇒ « envoyée » ; envoi en cours ou incertain ⇒ « à vérifier »
//     (jamais renvoyée toute seule : un double envoi ne se rattrape pas) ;
//   · facture émise SANS preuve ⇒ VRM ne l'envoie pas (le PDF se partage à la main) ;
//   · sinon la PREUVE de l'acheteur (src/facturePro/rattachement.js) : prouvé ⇒
//     « à envoyer » ; pas prouvé ⇒ la raison ; ventes Vinted pas lues ⇒ « pas su ».
// Trois états pour la lecture des ventes : `undefined` en cours · `null` pas su · liste.
import { preuveAcheteur, phraseRefus } from './rattachement.js';
import { jourParis } from './regle.js';

const txt = (v) => String(v == null ? '' : v).trim();
const etatEnvoi = (f) => (f && f.envoi && typeof f.envoi === 'object' ? String(f.envoi.etat || '') : '');

export function etatVentePro({ tx, mails = [], facture = null, avoir = null, commandes, classer = () => 'pending', adresseLisible = (a) => a } = {}) {
  const t = txt(tx);
  const emise = !!(facture && facture.emiseLe);
  const mail = (Array.isArray(mails) ? mails : [])[0] || null;
  const base = {
    tx: t, emise, numero: emise ? txt(facture.numero) : '',
    venteLe: txt((commandes && commandes[0] && commandes[0].date) || (mail && mail.receivedAt) || ''),
    designation: txt((mail && mail.designation) || (commandes && commandes[0] && commandes[0].title) || ''),
    compte: txt((mail && mail.account) || ''),
    envois: Array.isArray(facture && facture.envois) ? facture.envois.length : 0,
  };
  if (avoir && avoir.emiseLe) return { ...base, etat: 'annulee', numeroAvoir: txt(avoir.numero) };
  if (commandes === undefined) return { ...base, etat: 'lecture' };
  if (commandes === null) return { ...base, etat: 'pas-su', raison: 'tes ventes Vinted n’ont pas pu être lues' };
  const annulee = (Array.isArray(commandes) ? commandes : []).some((c) => c && txt(c.transaction_id) === t && classer(c.status) === 'cancelled');
  if (annulee) return { ...base, etat: emise ? 'a-annuler' : 'annulee-sans-facture' };
  const e = etatEnvoi(facture);
  if (e === 'envoyee') return { ...base, etat: 'envoyee' };
  if (e === 'incertaine' || e === 'en-cours') return { ...base, etat: 'a-verifier', raison: e === 'incertaine' ? 'un envoi précédent est incertain : regarde tes messages envoyés' : 'un envoi est en cours' };
  if (emise && !facture.preuve) return { ...base, etat: 'sans-preuve', raison: 'émise sans preuve de l’acheteur : VRM ne l’envoie pas' };
  const preuve = preuveAcheteur({ tx: t, mails, commandes, brouillon: facture, adresseLisible });
  if (!preuve.prouve) return { ...base, etat: 'pas-prouvee', code: preuve.code, raison: phraseRefus(preuve) };
  return { ...base, etat: 'a-envoyer', preuve, refusee: e === 'refusee', venteLe: preuve.venteLe, designation: preuve.designation || base.designation };
}

// Ce que la liste « À envoyer » montre (le reste est fait, ou n'est pas à facturer).
export const A_MONTRER = new Set(['a-envoyer', 'pas-prouvee', 'a-annuler', 'a-verifier', 'sans-preuve', 'pas-su']);

// La liste, le plus récent en haut (une date absente va en bas).
// `ventesPro` : Map tx → [e-mails Pro] · `factures` / `avoirs` : Map tx → ligne projetée ·
// `commandesParTx` : Map tx → [ventes Vinted portant ce n°] (ou null = pas su).
export function listeAEnvoyer({ ventesPro, factures, avoirs, commandesParTx, classer, adresseLisible, txsEnPlus = [] }) {
  const txs = new Set([...(ventesPro ? ventesPro.keys() : []), ...[...(factures ? factures.values() : [])].filter((f) => f && f.emiseLe).map((f) => String(f.transaction)), ...txsEnPlus.map(String)]);
  const out = [];
  for (const tx of txs) {
    if (!/^\d{4,20}$/.test(tx)) continue;
    const commandes = commandesParTx === undefined ? undefined : commandesParTx === null ? null : (commandesParTx.get(tx) || []);
    const it = etatVentePro({ tx, mails: (ventesPro && ventesPro.get(tx)) || [], facture: (factures && factures.get(tx)) || null, avoir: (avoirs && avoirs.get(tx)) || null, commandes, classer, adresseLisible });
    if (A_MONTRER.has(it.etat) || it.etat === 'lecture') out.push(it);
  }
  const t = (x) => { const n = Date.parse(x.venteLe || ''); return Number.isFinite(n) ? n : -Infinity; };
  return out.sort((a, b) => t(b) - t(a) || String(b.tx).localeCompare(String(a.tx)));
}

// ── L'ENVOI AUTOMATIQUE ─────────────────────────────────────────────────────
// ÉTEINT par défaut. Allumé seulement par son geste (`envoiAuto: true` + la date
// `envoiAutoDepuis`, posées ensemble par « Ma facture ») ; une date absente ou
// illisible vaut « éteint ». Une vente part toute seule seulement si :
//   · elle est « à envoyer » (acheteur PROUVÉ, vente pas annulée) ;
//   · elle a eu lieu APRÈS qu'il a allumé (les ventes d'avant restent dans
//     « À envoyer », à son clic) ;
//   · aucune tentative d'envoi n'a jamais eu lieu sur cette facture (ni à la
//     main, ni par l'automatique) : chaque facture part au plus UNE fois seule ;
//   · « pas prouvé » se retente au plus toutes les 2 h, et pas au-delà de 48 h.
export const AUTO_FENETRE_MS = 48 * 3600 * 1000;
export const AUTO_REESSAI_MS = 2 * 3600 * 1000;
export const autoAllume = (cfg) => !!(cfg && cfg.envoiAuto === true && Number.isFinite(Date.parse(cfg.envoiAutoDepuis || '')));
export function eligibleAuto(it, { cfg, essai = null, maintenant = Date.now() } = {}) {
  if (!autoAllume(cfg) || !it) return false;
  const depuis = Date.parse(cfg.envoiAutoDepuis);
  const vente = Date.parse(it.venteLe || '');
  if (!Number.isFinite(vente) || vente < depuis) return false;
  if (maintenant - vente > AUTO_FENETRE_MS) return false;
  if (it.envois > 0) return false;
  if (essai && essai.issue !== 'pas-prouvee') return false;
  if (essai && maintenant - (Date.parse(essai.at || '') || 0) < AUTO_REESSAI_MS) return false;
  return it.etat === 'a-envoyer' && !it.refusee;
}

// ── LE REGISTRE ─────────────────────────────────────────────────────────────
// Les lignes projetées `email_invoice_*` (jamais `select=data`) : factures ET avoirs
// émis. Le reçu Vinted d'un ACHAT vit aussi sous `email_invoice_tx…` : seules les
// pièces de VRM (`facture_pro`, `avoir_pro`) entrent.
const estPiece = (x) => !!(x && (x.type === 'facture_pro' || x.type === 'avoir_pro'));
// (11 nov.) La lecture PROJETÉE des factures et avoirs (jamais le PDF) : la même pour l'écran Factures et l'export comptable.
export const SELECT_FACTURES_PRO = 'id,numero:data->>number,status:data->>status,transaction:data->>transaction,emiseLe:data->>emiseLe,envoi:data->envoi,envois:data->envois,retour:data->>retourNom,annuleePar:data->>annuleePar,type:data->>type,buyerEmail:data->>buyerEmail,acheteur:data->contenu->acheteur->>nom,ttc:data->contenu->totaux->>ttc,ht:data->contenu->totaux->>ht,tva:data->contenu->totaux->>tva,regime:data->contenu->>regime,emiseJour:data->contenu->>emiseJour,venteJour:data->contenu->>venteJour,designation:data->contenu->lignes->0->>designation,origine:data->>origine,preuve:data->preuve->>tx';
export const estAvoir = (x) => !!(x && (x.type === 'avoir_pro' || /^email_invoice_av/.test(String(x.id || ''))));
const centimes = (v) => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? Math.round(n) : null; };
export function lignesRegistre(rows) {
  return (Array.isArray(rows) ? rows : []).filter((x) => estPiece(x) && x.emiseLe && txt(x.numero)).map((x) => ({
    id: x.id, numero: txt(x.numero), avoir: estAvoir(x), emiseLe: x.emiseLe, emiseJour: txt(x.emiseJour) || jourParis(x.emiseLe),
    venteJour: txt(x.venteJour), acheteur: txt(x.acheteur), designation: txt(x.designation), regime: txt(x.regime),
    ht: centimes(x.ht), tva: centimes(x.tva), ttc: centimes(x.ttc), origine: txt(x.origine), annuleePar: txt(x.annuleePar),
    envoi: x.envoi && typeof x.envoi === 'object' ? x.envoi : null, transaction: txt(x.transaction),
  })).sort((a, b) => String(a.emiseLe).localeCompare(String(b.emiseLe)) || a.numero.localeCompare(b.numero, 'fr', { numeric: true }));
}
// Une période : « 2026-11 » (un mois, heure de Paris) ou « 2026 » (une année).
const cleMois = (iso) => { const j = jourParis(iso); return j ? `${j.slice(6, 10)}-${j.slice(3, 5)}` : ''; };
export const dansPeriode = (l, periode) => (/^\d{4}$/.test(periode) ? cleMois(l.emiseLe).slice(0, 4) === periode : cleMois(l.emiseLe) === periode);
export function periodesRegistre(lignes) {
  const mois = new Set(); const ans = new Set();
  for (const l of lignes) { const m = cleMois(l.emiseLe); if (m) { mois.add(m); ans.add(m.slice(0, 4)); } }
  return { mois: [...mois].sort().reverse(), ans: [...ans].sort().reverse() };
}
// LES TROUS DE LA NUMÉROTATION : une série (factures, avoirs) va de 1 au plus haut n°
// donné, sans trou. Un brouillon numéroté avant le 2 nov. (jamais émis) n'est pas un
// trou : il est dit à part. Un n° pris sans pièce écrite (coupure) EST un trou : dit.
const suffixe = (n) => { const m = /-(\d{1,9})$/.exec(txt(n)); return m ? Number(m[1]) : null; };
// (11 nov.) Une SÉRIE = le préfixe du numéro (« FA-2026 », « AV-2025 »…) : FA-2025-0040 ne masque plus
//    les trous de 2026 et n'en invente pas. `facture` / `avoir` disent la série la plus récente ;
//    `series` les dit toutes (préfixe → { max, manquants, brouillons }).
const prefixe = (n) => txt(n).replace(/-?\d{1,9}$/, '');
const etatSerie = (m) => {
  const max = m.size ? Math.max(...m.keys()) : 0;
  const manquants = []; for (let i = 1; i <= max && manquants.length < 50; i++) if (!m.has(i)) manquants.push(i);
  return { max, manquants, brouillons: [...m].filter(([, e]) => e === 'brouillon').map(([n]) => n).sort((a, b) => a - b) };
};
export function trousNumerotation(rows) {
  const series = { facture: new Map(), avoir: new Map() };   // type → préfixe → (n → état)
  for (const x of Array.isArray(rows) ? rows : []) {
    if (!estPiece(x) || !txt(x.numero)) continue;
    const n = suffixe(x.numero); if (!n) continue;
    const parType = estAvoir(x) ? series.avoir : series.facture;
    const p = prefixe(x.numero);
    if (!parType.has(p)) parType.set(p, new Map());
    parType.get(p).set(n, x.emiseLe ? 'emise' : 'brouillon');
  }
  const out = {};
  for (const [s, parPrefixe] of Object.entries(series)) {
    const prefixes = [...parPrefixe.keys()].sort();
    const toutes = {}; for (const p of prefixes) toutes[p] = etatSerie(parPrefixe.get(p));
    const recente = prefixes.length ? toutes[prefixes[prefixes.length - 1]] : etatSerie(new Map());
    out[s] = { ...recente, prefixe: prefixes.length ? prefixes[prefixes.length - 1] : '', series: toutes };
  }
  return out;
}
// Le CSV du registre : point-virgule, virgule décimale, BOM (Excel et Numbers l'ouvrent).
const eur = (c) => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','));
const cell = (v) => { const s = String(v == null ? '' : v); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const REGIMES = { franchise: 'Franchise (293 B)', marge: 'Marge (297 A)', normal: 'TVA' };
const motEnvoi = (l) => (l.annuleePar ? `annulée par ${l.annuleePar}` : !l.envoi ? 'pas envoyée' : l.envoi.etat === 'envoyee' ? 'envoyée' : l.envoi.etat === 'incertaine' ? 'incertaine' : l.envoi.etat === 'en-cours' ? 'en cours' : 'pas envoyée');
export const ENTETES_CSV = ['Numéro', 'Type', 'Date d’émission', 'Date de la vente', 'Client', 'Désignation', 'Total HT', 'TVA', 'Total TTC', 'Régime de TVA', 'Annule la facture', 'Envoi', 'Envoyée le', 'Transaction Vinted'];
export function csvRegistre(lignes) {
  const l = [ENTETES_CSV.map(cell).join(';')];
  for (const x of lignes) l.push([x.numero, x.avoir ? 'Avoir' : 'Facture', x.emiseJour, x.venteJour, x.acheteur, x.designation, eur(x.ht), eur(x.tva), eur(x.ttc), REGIMES[x.regime] || x.regime, x.origine, motEnvoi(x), x.envoi && x.envoi.etat === 'envoyee' ? jourParis(x.envoi.at) : '', x.transaction].map(cell).join(';'));
  return '﻿' + l.join('\r\n') + '\r\n';
}
export const totauxRegistre = (lignes) => lignes.reduce((t, x) => ({ ht: t.ht + (x.ht || 0), tva: t.tva + (x.tva || 0), ttc: t.ttc + (x.ttc || 0), n: t.n + 1, inconnus: t.inconnus + (x.ttc == null ? 1 : 0) }), { ht: 0, tva: 0, ttc: 0, n: 0, inconnus: 0 });
export const nomZip = (periode) => `Factures-${periode}.zip`;
