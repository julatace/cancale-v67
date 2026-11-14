// ═══════════════════════════════════════════════════════════════════════════
//  160 · LA VENTE EN MAIN PROPRE EN 2 TOUCHERS (14 nov., idées argent)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « N° (ou recherche) puis prix ⇒ vendue hors plateforme ». Rien de neuf
// côté règles : c'est la décision « vendu en main propre » qui existe déjà
// (`vrm_cycle_decisions[annonce] = { choix: 'vendu-main', … }`, src/venteAilleurs.js,
// « Vendu ailleurs » de la fiche) — la MÊME écriture (`opsVenduAilleurs`), les MÊMES
// règles des totaux (`ventesMainPropre` dans `ventesFaites` / `ventesDeclarables`,
// paramètre `main`) : vendu le jour saisi, encaissé ce jour-là (pas de versement
// d'une plateforme), jamais compté deux fois avec la vente Vinted de la même annonce.
// Ce module ajoute seulement ce qu'il faut pour y arriver depuis un N° tapé :
//
//   · `trouverParNumero` — l'IDENTITÉ par le N° EXACT (`cleNum` : « 007 » = « 7 »,
//     « b125 » = « B125 ») : 0 fiche ⇒ « aucune » ; 1 ⇒ elle ; 2 et plus ⇒ la liste,
//     et c'est LUI qui choisit (§5 : « même avec 50 articles identiques… ») ;
//   · `chercherParMots` — une PROPOSITION par le titre (marque, modèle, taille) :
//     jamais une identité ; elle ne relie rien, son toucher choisit (§5) ;
//   · `opsVenteMain` — les opérations du geste annulable (le N° gardé, la case
//     libérée, la paire sort du stock et des annonces) + le mode de paiement ;
//   · `opsAnnulerVenteMain` — la remettre en stock plus tard (décision et marque
//     « vendue » retirées ; la case n'est pas reprise : il la range) ;
//   · `lignesRecu` — le reçu (PDF dessiné dans le navigateur, src/ideesArgent/recuPdf.js).
// Module PUR : aucune lecture, aucune écriture. Exécuté par scripts/audit-idees-argent.cjs.
// ═══════════════════════════════════════════════════════════════════════════
import { opsVenduAilleurs, CLE_DECISIONS, CLE_VENDUES, CHOIX_MAIN, PAIEMENTS, aujourdhui, dateValide } from '../venteAilleurs.js';

export { PAIEMENTS, aujourdhui, dateValide };
const str = (v) => String(v == null ? '' : v).trim();
// La même identité qu'`cleNum` d'App.jsx (majuscules, sans espace, zéros de tête retirés).
export const cleNumDefaut = (n) => { const s = str(n).toUpperCase().replace(/\s+/g, '').replace(/^N[°O]?(?=\d)/, ''); const m = /^([A-Z]*)0*(\d+)$/.exec(s); return m ? m[1] + m[2] : s; };
// Ce que l'on tape est-il un N° ? (« 124 », « N°124 », « B125 », « b 125 »)
export const estUnNumero = (q) => /^(?:n[°o]?\s*)?[a-z]{0,3}\s*\d{1,6}$/i.test(str(q));

// Une fiche encore « chez lui » : ni marquée vendue, ni vendue en main propre, ni enlevée du stock.
const SORTIES = new Set([CHOIX_MAIN, 'separe']);
const sortie = (id, vendues, decisions) => {
  const d = decisions && decisions[id];
  return (vendues && vendues.has(id)) || !!(d && SORTIES.has(d.choix));
};
const prixDe = (f) => {
  const p = f && f.price;
  const v = p && typeof p === 'object' ? p.amount : p;
  const n = Number(String(v == null ? '' : v).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};
const photoDe = (f) => str((f && (f.photo || f.photoUrl || f.image)) || (f && Array.isArray(f.photos) && f.photos[0] && (f.photos[0].url || f.photos[0])) || '');
// Ce qu'une ligne de choix montre : jamais le prix d'achat, jamais l'acheteur.
const carteDe = (id, f) => ({ id: String(id), numero: str(f.numero), titre: str(f.title || f.titre).slice(0, 90), taille: str(f.size || f.taille).slice(0, 20), photo: photoDe(f), prix: prixDe(f), compte: str(f.compte || f.login || '') });

// Les fiches (`vinted_annonce_numeros`, { [idAnnonce]: fiche }) qui portent EXACTEMENT ce N°.
//   etat 'vide' (rien tapé) · 'aucune' · 'une' · 'plusieurs' (il choisit) · 'deja' (toutes déjà sorties)
export function trouverParNumero(q, fiches, { vendues = [], decisions = {}, cle = cleNumDefaut } = {}) {
  const k = cle(q);
  if (!k || !/\d/.test(k)) return { etat: 'vide', cle: '', cartes: [] };
  const V = new Set((Array.isArray(vendues) ? vendues : [...(vendues || [])]).map(String));
  const portent = Object.entries(fiches && typeof fiches === 'object' ? fiches : {})
    .filter(([, f]) => f && f.numero != null && str(f.numero) !== '' && cle(f.numero) === k);
  const presentes = portent.filter(([id]) => !sortie(String(id), V, decisions));
  if (!portent.length) return { etat: 'aucune', cle: k, cartes: [] };
  if (!presentes.length) return { etat: 'deja', cle: k, cartes: portent.map(([id, f]) => carteDe(id, f)) };
  const cartes = presentes.map(([id, f]) => carteDe(id, f));
  return { etat: cartes.length === 1 ? 'une' : 'plusieurs', cle: k, cartes };
}

// Une PROPOSITION par les mots du titre (« dunk 42 ») : chaque mot doit y être. 8 au plus.
// Jamais une identité : la ligne touchée choisit, rien n'est relié sans son toucher.
const norm = (s) => str(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function chercherParMots(q, fiches, { vendues = [], decisions = {}, max = 8 } = {}) {
  const mots = norm(q).split(/\s+/).filter((m) => m.length >= 2);
  if (!mots.length) return [];
  const V = new Set((Array.isArray(vendues) ? vendues : [...(vendues || [])]).map(String));
  const out = [];
  for (const [id, f] of Object.entries(fiches && typeof fiches === 'object' ? fiches : {})) {
    if (!f || f.numero == null || str(f.numero) === '' || sortie(String(id), V, decisions)) continue;
    const t = norm([f.title || f.titre, f.size || f.taille, f.brand].filter(Boolean).join(' '));
    if (mots.every((m) => t.includes(m))) out.push(carteDe(id, f));
    if (out.length >= max) break;
  }
  return out;
}

// Les opérations de la vente (geste annulable 5 s, `gesteVrm`), ou null (rien n'est écrit).
//   carte { id, numero, titre } ; montant (nombre > 0) ; date « AAAA-MM-JJ » ; paiement ∈ PAIEMENTS
export function opsVenteMain({ carte, montant, date, paiement, decisions = {}, vendues = [], slots = {}, cle = cleNumDefaut, maintenant = Date.now() } = {}) {
  if (!carte || !PAIEMENTS.includes(paiement)) return null;
  const r = opsVenduAilleurs({ carte: { id: carte.id, numero: carte.numero, title: carte.titre || '' }, montant, date, paiement, decisions, vendues, slots, cle, maintenant });
  return r ? { ...r, texte: r.texte.replace('vendu ailleurs', 'vendu en main propre') } : null;
}

// La remettre en stock (une vente notée par erreur), plus tard : la décision et la marque
// « vendue » retirées. Seulement une décision « vendu en main propre » existante.
export function opsAnnulerVenteMain({ id, decisions = {}, vendues = [] } = {}) {
  const k = str(id); const d = decisions && decisions[k];
  if (!k || !d || d.choix !== CHOIX_MAIN) return null;
  const ops = [{ k: CLE_DECISIONS, type: 'cle', id: k, apres: undefined, avant: d }];
  const V = (Array.isArray(vendues) ? vendues : [...(vendues || [])]).map(String);
  if (V.includes(k)) ops.push({ k: CLE_VENDUES, type: 'ensemble', id: k, apres: false, avant: true });
  return { ops, numero: str(d.numero) };
}

// Les ventes en main propre posées ces `jours` derniers jours (les plus récentes d'abord) —
// pour « Annuler une vente » dans la feuille.
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
    article: [str(carte.titre).slice(0, 90), carte.taille ? str(carte.taille) : ''].filter(Boolean).join(' · ') || '—',
    numero: str(carte.numero),
    montant: Math.round(Number(montant) * 100) / 100,
    paiement,
  };
}
