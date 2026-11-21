// ═══════════════════════════════════════════════════════════════════════════
//  160 · LA VENTE EN MAIN PROPRE EN 2 TOUCHERS (14 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « le N° (ou une recherche), puis le prix ⇒ la paire est vendue hors
// plateforme ». ⚠️ AUCUNE RÈGLE NEUVE : c'est « Vendu ailleurs » (11 nov.,
// src/venteAilleurs.js), la même décision `vrm_cycle_decisions[annonce] =
// { choix: 'vendu-main', … }` (`opsVenduAilleurs`), comptée par les MÊMES règles
// des totaux (`ventesMainPropre` dans `ventesFaites` / `ventesDeclarables`,
// paramètre `main` ; les bilans serveur) : vendue ET encaissée le jour saisi (pas de
// versement d'une plateforme), jamais deux fois avec la vente Vinted de la même annonce.
//
//   · `verdictVenteMain` — ce que la fiche de la paire ET la feuille disent d'un N°
//     (la règle de « Vendu ailleurs » de la fiche, sortie d'App.jsx pour n'en avoir
//     qu'une) : la lecture « Tout sur le N° » (`toutSurLeNumero`, identité par le N°
//     EXACT, « 125 » ≠ « B125 ») et l'étape « vente » de l'histoire de la paire.
//     Rend { etat, … } :
//       'possible'      UNE paire présente, vente lue et absente ⇒ la carte à vendre ;
//       'plusieurs'     deux paires PRÉSENTES sous ce N° (le doublon, §5) ⇒ IL choisit ;
//       'deux-annonces' deux annonces en ligne de la MÊME paire ⇒ refus (rien deviné) ;
//       'vendue'        une vente lue (Vinted, Leboncoin, eBay, Vestiaire), à envoyer, en route ou
//                       finie ⇒ refus clair ; 'deja-main' : déjà vendue en main propre ;
//       'marquee'       marquée vendue dans Annonces ; 'sortie' : enlevée du stock ;
//       'compte-ecarte' sur un compte retiré de ses totaux ⇒ refus (elle ne compterait
//                       nulle part ailleurs, §5 « un compte exclu n'entre dans aucun total ») ;
//       'passu'         ventes ou annonces pas lues ⇒ refus (« pas su » ≠ « pas vendue ») ;
//       'aucune'        aucune paire sous ce N° ; 'archive' : seul l'ancien N° « B… » existe
//                       (proposé, jamais pris à sa place) ; 'invalide' : pas un N°.
//   · `chercherParMots` — une PROPOSITION par le titre, jamais une identité (§5).
//   · `opsVenteMain` — les opérations du geste annulable 5 s (`opsVenduAilleurs` + le
//     paiement + ce qu'il faut pour défaire PLUS TARD : la décision d'avant, la case).
//   · `opsAnnulerVenteMain` — « Remettre en stock » plus tard : l'état d'avant.
//   · `lignesRecu` — le reçu (src/ideesArgent/recuPdf.js) : ni acheteur, ni prix d'achat.
// Module PUR : aucune lecture, aucune écriture. Exécuté par scripts/audit-idees-argent.cjs.
// ═══════════════════════════════════════════════════════════════════════════
import { opsVenduAilleurs, CLE_DECISIONS, CLE_VENDUES, CHOIX_MAIN, PAIEMENTS, aujourdhui, dateValide } from '../venteAilleurs.js';
import { vcVenteAnnulee } from '../../api/_lib/vestiaire-regle.js';

export { PAIEMENTS, aujourdhui, dateValide };
const str = (v) => String(v == null ? '' : v).trim();
// La même identité qu'`cleNum` d'App.jsx (majuscules, sans espace, zéros de tête retirés).
export const cleNumDefaut = (n) => { const s = str(n).toUpperCase().replace(/\s+/g, '').replace(/^N[°O]?(?=\d)/, ''); const m = /^([A-Z]*)0*(\d+)$/.exec(s); return m ? m[1] + m[2] : s; };
// Ce que l'on tape est-il un N° ? (« 124 », « N°124 », « B125 », « b 125 »)
export const estUnNumero = (q) => /^(?:n[°o]?\s*)?[a-z]{0,3}\s*\d{1,6}$/i.test(str(q));
const PRESENTE = new Set(['en-ligne', 'a-confirmer', 'masquee']);
const prixDe = (p) => { const v = p && typeof p === 'object' ? p.amount : p; const n = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null; };
const carteDeAnnonce = (a, numero) => ({ id: String(a.id), numero: str(numero), titre: str(a.title).slice(0, 90), photo: typeof a.photo === 'string' ? a.photo : (a.photo && a.photo.url) || '', prix: prixDe(a.price), compte: a.accountId != null ? String(a.accountId) : '', enLigne: a.etat === 'en-ligne' });

// LA règle (la fiche ET la feuille). rn : `toutSurLeNumero` ; p : l'histoire de la paire
// (`histoireArticle`, son étape « vente ») ; decisions : `vrm_cycle_decisions` ;
// vendues : `vinted_annonces_vendues` ; ecarte(uid) : le compte est-il hors des totaux ;
// choisie : l'annonce touchée quand deux paires portent ce N°.
export function verdictVenteMain({ rn, p = null, decisions = {}, vendues = [], ventesVc, ecarte = () => false, choisie = null, cle: cleDe = cleNumDefaut } = {}) {
  if (!rn || rn.etat === 'invalide' || !rn.cle) return { etat: 'invalide' };
  const cle = rn.cle;
  const annonces = Array.isArray(rn.annonces) ? rn.annonces : [];
  const manque = (x) => (rn.manques || []).includes(x);
  if (!annonces.length) {
    // Les fiches pas lues ⇒ « pas su » ; lues sans ce N° ⇒ aucune paire à vendre (le reste ne change rien).
    if (manque('tes fiches numérotées')) return { etat: 'passu', cle, manques: rn.manques || [] };
    if (rn.ancien) return { etat: 'archive', cle, ancien: str(rn.ancien) };
    return { etat: 'aucune', cle };
  }
  const D = decisions && typeof decisions === 'object' ? decisions : {};
  const V = new Set((Array.isArray(vendues) ? vendues : [...(vendues || [])]).map(String));
  const presentes = annonces.filter((a) => PRESENTE.has(a.etat));
  // Plusieurs annonces dont on ne sait pas lesquelles sont en ligne (dressing pas lu) : on ne choisit pas.
  if (!presentes.length && annonces.length > 1 && annonces.some((a) => a.etat === 'passu')) return { etat: 'passu', cle, manques: rn.manques || [] };
  const l = presentes.length ? presentes : annonces;
  const dej = l.find((a) => D[a.id] && D[a.id].choix === CHOIX_MAIN);
  if (dej) return { etat: 'deja-main', cle, decision: { ...D[dej.id], id: String(dej.id) } };
  const encore = l.filter((a) => !(D[a.id] && D[a.id].choix === 'separe'));
  if (!encore.length) return { etat: 'sortie', cle };
  if (encore.some((a) => V.has(String(a.id)))) return { etat: 'marquee', cle };
  // La vente : l'étape de l'histoire (les mêmes lectures que la fiche). Pas lue ⇒ refus.
  const eV = p && Array.isArray(p.etapes) ? p.etapes.find((e) => e && e.cle === 'vente') : null;
  if (!eV || eV.etat === 'passu') return { etat: 'passu', cle, manques: rn.manques || [] };
  if (eV.etat === 'fait') return { etat: 'vendue', cle, ou: str(eV.titre), lignes: (Array.isArray(eV.evenements) ? eV.evenements : Array.isArray(eV.lignes) ? eV.lignes : []).map((x) => str(x && x.texte)).filter(Boolean) };
  // Vestiaire (pas dans « Tout sur le N° ») : ses ventes par IDENTITÉ (`ventesVcDe`, son N°), la règle de
  // `numerosDejaVendus`. Trois états : liste · null pas su · undefined en cours ⇒ « pas su ».
  if (!Array.isArray(ventesVc)) return { etat: 'passu', cle, manques: [...(rn.manques || []), 'tes ventes Vestiaire'] };
  const vc = ventesVc.find((x) => x && !vcVenteAnnulee(x) && x.num != null && str(x.num) !== '' && cleDe(x.num) === cle);
  if (vc) return { etat: 'vendue', cle, ou: 'Vendue sur Vestiaire', lignes: ['Vestiaire'] };
  const numero = (p && p.num) || cle;
  let a = encore[0];
  if (encore.length > 1) {
    if (!rn.double) return { etat: 'deux-annonces', cle };
    const c = choisie != null ? encore.find((x) => String(x.id) === String(choisie)) : null;
    if (!c) return { etat: 'plusieurs', cle, cartes: encore.map((x) => carteDeAnnonce(x, numero)) };
    a = c;
  }
  if (a.accountId != null && ecarte(String(a.accountId))) return { etat: 'compte-ecarte', cle, compte: String(a.accountId) };
  return { etat: 'possible', cle, double: encore.length > 1, carte: carteDeAnnonce(a, numero) };
}

// Une PROPOSITION par les mots du titre (« dunk 42 ») : chaque mot doit y être. 8 au plus.
// Jamais une identité : la ligne touchée remplace la recherche par SON N° (puis le verdict).
const norm = (s) => str(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function chercherParMots(q, fiches, { vendues = [], decisions = {}, max = 8 } = {}) {
  const mots = norm(q).split(/\s+/).filter((m) => m.length >= 2);
  if (!mots.length) return [];
  const V = new Set((Array.isArray(vendues) ? vendues : [...(vendues || [])]).map(String));
  const out = [];
  for (const [id, f] of Object.entries(fiches && typeof fiches === 'object' ? fiches : {})) {
    const d = decisions && decisions[id];
    if (!f || f.numero == null || str(f.numero) === '' || V.has(String(id)) || (d && (d.choix === CHOIX_MAIN || d.choix === 'separe'))) continue;
    const t = norm([f.title || f.titre, f.size || f.taille, f.brand].filter(Boolean).join(' '));
    if (mots.every((m) => t.includes(m))) out.push({ id: String(id), numero: str(f.numero), titre: str(f.title || f.titre).slice(0, 90), taille: str(f.size || f.taille).slice(0, 20), photo: str(f.photo || ''), prix: prixDe(f.price) });
    if (out.length >= max) break;
  }
  return out;
}

// Les opérations de la vente (geste annulable 5 s, `gesteVrm`), ou null (rien n'est écrit).
//   carte { id, numero, titre } (le verdict 'possible') ; montant > 0 ; date ; paiement ∈ PAIEMENTS
// La décision garde AUSSI ce qu'il faut pour la défaire plus tard, exactement :
// `prec` (la décision d'avant de cette annonce, s'il y en avait une) et `caseAvant` (sa case).
export function opsVenteMain({ carte, montant, date, paiement, decisions = {}, vendues = [], slots = {}, sortieCase = null, cle = cleNumDefaut, maintenant = Date.now() } = {}) {
  if (!carte || !PAIEMENTS.includes(paiement)) return null;
  const r = opsVenduAilleurs({ carte: { id: carte.id, numero: carte.numero, title: carte.titre || '' }, montant, date, paiement, decisions, vendues, slots, sortieCase, cle, maintenant });
  if (!r) return null;
  const D = decisions || {}, S = slots || {}, kn = cle(carte.numero);
  const ops = r.ops.map((o) => (o.k === CLE_DECISIONS ? { ...o, apres: { ...o.apres, ...(D[o.id] ? { prec: D[o.id] } : {}), ...(kn && S[kn] ? { caseAvant: S[kn] } : {}) } } : o));
  return { ops, texte: r.texte.replace('vendu ailleurs', 'vendu en main propre') };
}

// « Remettre en stock » plus tard (une vente notée par erreur) : la décision d'avant revient
// (`prec`, sinon aucune), la marque « vendue » part, et la case revient SI elle est restée libre
// (une autre paire a pu y être rangée depuis : alors on ne déplace rien, et c'est dit).
export function opsAnnulerVenteMain({ id, decisions = {}, vendues = [], slots = {}, cle = cleNumDefaut } = {}) {
  const k = str(id); const d = decisions && decisions[k];
  if (!k || !d || d.choix !== CHOIX_MAIN) return null;
  const ops = [{ k: CLE_DECISIONS, type: 'cle', id: k, apres: d.prec && d.prec.choix !== CHOIX_MAIN ? d.prec : undefined, avant: d }];
  const V = (Array.isArray(vendues) ? vendues : [...(vendues || [])]).map(String);
  if (V.includes(k)) ops.push({ k: CLE_VENDUES, type: 'ensemble', id: k, apres: false, avant: true });
  const kn = cle(d.numero), S = slots || {};
  let caseRendue = null;
  if (kn && d.caseAvant) {
    const prise = S[kn] || Object.entries(S).some(([n, c]) => n !== kn && JSON.stringify(c) === JSON.stringify(d.caseAvant));
    if (!prise) { ops.push({ k: 'vrm_slots', type: 'cle', id: kn, apres: d.caseAvant, avant: undefined }); caseRendue = true; } else caseRendue = false;
  }
  return { ops, numero: str(d.numero), caseRendue };
}

// Les ventes en main propre posées ces `jours` derniers jours (les plus récentes d'abord).
export function ventesMainRecentes(decisions, { jours = 30, maintenant = Date.now() } = {}) {
  const out = [];
  for (const [id, d] of Object.entries(decisions && typeof decisions === 'object' ? decisions : {})) {
    if (!d || d.choix !== CHOIX_MAIN) continue;
    const t = Date.parse(str(d.at));
    if (!Number.isFinite(t) || maintenant - t > jours * 86400000) continue;
    out.push({ id, numero: str(d.numero), montant: Number(d.montant) || null, date: str(d.date), paiement: PAIEMENTS.includes(d.paiement) ? d.paiement : null, at: t });
  }
  return out.sort((a, b) => b.at - a.at);
}

// Le contenu du reçu (aucun nom d'acheteur : VRM ne le connaît pas ; aucun prix d'achat).
//   vendeur : le nom de sa facture (Paramètres) s'il l'a donné, sinon '' (ligne à remplir à la main)
export function lignesRecu({ carte, montant, date, paiement, vendeur = '', numeroRecu = '' } = {}) {
  if (!carte || !(Number(montant) > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(str(date)) || !PAIEMENTS.includes(paiement)) return null;
  const [a, m, j] = str(date).split('-');
  return {
    numeroRecu: str(numeroRecu).slice(0, 30),
    date: `${j}/${m}/${a}`,
    vendeur: str(vendeur).slice(0, 80),
    article: str(carte.titre).slice(0, 90) || '—',
    numero: str(carte.numero),
    montant: Math.round(Number(montant) * 100) / 100,
    paiement,
  };
}
