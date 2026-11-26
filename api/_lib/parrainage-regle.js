// ═══════════════════════════════════════════════════════════════════════════
// LE PARRAINAGE À 20 % — LA RÈGLE (25 nov. 2026, décision de Julien)
// ═══════════════════════════════════════════════════════════════════════════
// Mot pour mot : « dès qu'une personne me ramène 1 client, le client économise
// 10 % le premier mois et le parrain touche 20 % de ce que je perçois tous les
// mois tant que son filleul paye ». Versement : « Il choisit s'il veut payer son
// abonnement avec ou s'il veut le virement ». L'ancien mois offert (au parrain ET
// au filleul) devient « 1 semaine offerte », au premier paiement réel du filleul,
// EN PLUS de la nouvelle règle (interprétation écrite dans
// docs/passation/2026-11-25-parrainage-20.md). Les mois déjà gagnés restent acquis.
//
// Ce fichier ne lit RIEN et n'écrit RIEN : des fonctions pures, appelées par le
// webhook Stripe, la route `mode=parrainage`, l'administration de Julien et
// l'export RGPD (une règle, un propriétaire). Lectures/écritures :
// api/_lib/parrainage-gains.js ; tables : supabase/migrations/049-parrainage-20.sql.
//
// LE GAIN DU PARRAIN :
//   · 20 % (`POURCENT_PARRAIN`) de CHAQUE facture d'abonnement réellement payée
//     par le filleul (mêmes filtres que les partenaires, `factureReelle` : payée,
//     > 0, EUR, `subscription_create` / `subscription_cycle`), en centimes
//     arrondis à l'INFÉRIEUR (16,99 € ⇒ 3,39 €) ;
//   · une facture = un gain au plus (clé : l'identifiant de facture) ;
//   · daté du PAIEMENT, DÛ 14 jours après (rétractation) ;
//   · rien avant le rattachement (rien de rétroactif) ; filleul parti ⇒ plus de
//     facture ⇒ plus de gain ; ce qui est gagné reste ;
//   · remboursement, litige, avoir : la règle des partenaires (`remboursementDe`,
//     `commissionNette` — proportionnelle à tout montant, donc à un pourcentage) :
//     tout rendu ou litige ⇒ annulé (gardé, dit) ; partiel ⇒ au prorata ;
//   · règle anti-abus refusée pour ce filleul (même carte, compte Vinted déjà vu…)
//     ⇒ ses gains sont annulés (`anti-abus`) ;
//   · un gain n'est réglé qu'une fois la vérification « pas soi-même » faite (la
//     semaine du filleul créditée prouve qu'elle a passé) : avant, il attend.
// LE RÈGLEMENT (choix du parrain, modifiable à tout moment) :
//   · « credit » (défaut) : les gains DUS sont crédités sur son solde client Stripe
//     (déduits de sa prochaine facture) ; sans client Stripe ⇒ en attente ;
//   · « virement » : les gains DUS s'accumulent ; VRM NE VERSE RIEN — Julien voit
//     « à verser » dès `SEUIL_VIREMENT_CENTIMES` (20 €) et note « Versé » ;
//   · le mode d'un gain est celui en vigueur à sa date d'échéance (`modeAuJour`) :
//     un changement de choix ne touche que les gains devenus dus APRÈS lui, et un
//     gain n'est jamais réglé deux fois.
// PLAFOND : l'ancien plafond de 12 mois offerts par an reste pour la SEMAINE
//   offerte (un cadeau sans contrepartie). Les 20 % n'ont PAS de plafond : ils
//   ne naissent que d'un euro réellement payé par un autre client vérifié (pas
//   soi-même : compte, e-mail, carte, compte Vinted) — se parrainer soi-même
//   coûterait 100 % pour en récupérer 20 %.
// LE FILLEUL : −10 % (`REMISE_FILLEUL_POURCENT`) sur son 1er mois payé, par un
//   coupon Stripe (jamais cumulé avec un code partenaire : un compte est l'un OU
//   l'autre) — voir `COUPON_FILLEUL`.
// Ce qui sort vers le parrain : des NOMBRES, jamais l'identité d'un filleul.
// ═══════════════════════════════════════════════════════════════════════════
import {
  factureReelle, datePaiement, paiementsDeFacture, moisParis, remboursementDe, commissionNette,
  RAISONS_ANNULATION, DELAI_DUE_JOURS, RE_MOIS,
} from './partenaires-regle.js';

export const POURCENT_PARRAIN = 20;
export const REMISE_FILLEUL_POURCENT = 10;
export const JOURS_OFFERTS = 7;                    // « 1 semaine offerte » (remplace le mois offert)
export const SEUIL_VIREMENT_CENTIMES = 2000;       // 20 € : en dessous, rien n'est « à verser »
export const MODES_REGLEMENT = ['credit', 'virement'];
export const MODE_DEFAUT = 'credit';
export const RAISONS_GAIN_ANNULE = [...RAISONS_ANNULATION, 'anti-abus'];
// Le coupon Stripe du filleul. ⚠️ PAS `duration=once` : chez Stripe un coupon « once »
// est consommé par la PREMIÈRE facture finalisée — celle à 0 € de l'essai de 7 jours.
// `repeating` 1 mois court depuis la souscription : il couvre la première facture payée
// (fin d'essai à J+7, ou J0 sans essai) et jamais la suivante (J+30 / J+37).
export const COUPON_FILLEUL = { id: 'VRM_PARRAINAGE_10', percent_off: REMISE_FILLEUL_POURCENT, duration: 'repeating', duration_in_months: 1, name: 'Parrainage VRM : −10 % le 1er mois' };
export { DELAI_DUE_JOURS };

// 20 % d'un montant payé, en centimes, à l'inférieur.
export const gainDeFacture = (centimes) => (Number.isInteger(Number(centimes)) && Number(centimes) > 0 ? Math.floor((Number(centimes) * POURCENT_PARRAIN) / 100) : 0);
// La valeur d'une semaine offerte, d'après le prix d'un mois (16,99 € ⇒ 3,96 €).
export const creditSemaine = (prixMoisCentimes) => Math.round((Number(prixMoisCentimes) || 0) * JOURS_OFFERTS / 30);
// Le gain qui compte (0 annulé, prorata d'un remboursement partiel) : LA règle des partenaires.
export const gainNet = (g) => commissionNette(g);

// LA DÉCISION. `parrainage` = la ligne { filleul, parrain, inscrit, refus } du filleul.
export function decisionGain({ facture, parrainage, existantes = [], signaux = [] }) {
  const r = factureReelle(facture);
  if (!r.ok) return { rien: r.raison };
  if (!parrainage || !parrainage.filleul || !parrainage.parrain) return { rien: 'pas-parraine' };
  if (parrainage.refus) return { rien: 'refuse' };
  const paye = datePaiement(facture);
  const inscrit = Date.parse(parrainage.inscrit || '');
  if (!Number.isFinite(inscrit) || paye < inscrit) return { rien: 'avant-rattachement' };
  if (existantes.some((g) => g && g.facture === facture.id)) return { rien: 'deja' };
  const montant = gainDeFacture(facture.amount_paid);
  if (!(montant > 0)) return { rien: 'zero' };
  const p = paiementsDeFacture(facture);
  const ligne = {
    facture: facture.id, parrain: parrainage.parrain, filleul: parrainage.filleul,
    montant_centimes: montant, facture_centimes: Number(facture.amount_paid),
    paye_le: new Date(paye).toISOString(), mois: moisParis(paye),
    due_le: new Date(paye + DELAI_DUE_JOURS * 86400000).toISOString(),
    charge: p.charge, payment_intent: p.payment_intent,
    annulee_le: null, annulee_raison: null, rembourse_centimes: 0,
  };
  const rb = remboursementDe(signaux, ligne.facture_centimes);
  if (rb.total) { ligne.annulee_le = rb.le || ligne.paye_le; ligne.annulee_raison = rb.raison; }
  else if (rb.centimes > 0) ligne.rembourse_centimes = rb.centimes;
  return { creer: ligne };
}

// Le mode en vigueur à un instant : la dernière ligne de choix posée AVANT lui.
export function modeAuJour(choix = [], instantMs) {
  let mode = MODE_DEFAUT, le = -Infinity;
  for (const c of Array.isArray(choix) ? choix : []) {
    const t = Date.parse(c && c.le || '');
    if (!MODES_REGLEMENT.includes(c && c.mode) || !Number.isFinite(t)) continue;
    if (t <= instantMs && t >= le) { mode = c.mode; le = t; }
  }
  return mode;
}
export const modeActuel = (choix, maintenant = Date.now()) => modeAuJour(choix, maintenant);

// L'état d'un gain : 'annule' · 'attente' (pas encore dû) · 'verification' (dû, « pas soi-même »
// pas encore prouvé) · 'credite' · 'a-crediter' (mode crédit, en attente de son client Stripe)
// · 'a-verser' · 'verse' (versements de Julien répartis du plus ancien au plus récent).
export function etatsGains({ gains = [], choix = [], verifies = null, versements = [], maintenant = Date.now() }) {
  const tries = [...gains].filter((g) => g && g.facture).sort((a, b) => String(a.due_le).localeCompare(String(b.due_le)) || String(a.facture).localeCompare(String(b.facture)));
  let verse = (Array.isArray(versements) ? versements : []).reduce((s, v) => s + (Number(v && v.montant_centimes) || 0), 0);
  return tries.map((g) => {
    const net = gainNet(g);
    const due = Date.parse(g.due_le || '');
    let etat, mode = null;
    if (g.annulee_le || !(net > 0)) etat = 'annule';
    else if (!(Number.isFinite(due) && due <= maintenant)) etat = 'attente';
    else if (verifies && !verifies.has(String(g.filleul))) etat = 'verification';
    else {
      mode = modeAuJour(choix, due);
      if (g.credite_le) { etat = 'credite'; mode = 'credit'; }
      else if (mode === 'credit') etat = 'a-crediter';
      else if (verse >= net) { etat = 'verse'; verse -= net; }
      else etat = 'a-verser';
    }
    return { ...g, net, etat, mode };
  });
}

// ── LES CHIFFRES DU PARRAIN (des nombres, jamais qui) ───────────────────────
// actifs : Set des filleuls dont l'abonnement vit (null = pas su ⇒ « — »).
export function chiffresParrain({ gains = [], choix = [], verifies = null, versements = [], actifs = null, maintenant = Date.now(), limite = 120, rangs = null }) {
  const etats = etatsGains({ gains, choix, verifies, versements, maintenant });
  // (25 nov.) Le rang d'un filleul : l'ordre d'INSCRIPTION (`rangs`, stable), sinon celui du premier paiement.
  const rang = rangs instanceof Map ? new Map(rangs) : new Map();
  [...gains].filter(Boolean).sort((a, b) => String(a.paye_le).localeCompare(String(b.paye_le))).forEach((g) => { if (g.filleul && !rang.has(String(g.filleul))) rang.set(String(g.filleul), rang.size + 1); });
  const moisCourant = moisParis(maintenant);
  const somme = (f) => etats.filter(f).reduce((s, g) => s + g.net, 0);
  const vivants = etats.filter((g) => g.etat !== 'annule');
  const payeurs = new Set(vivants.map((g) => String(g.filleul)));
  const verseCentimes = (Array.isArray(versements) ? versements : []).reduce((s, v) => s + (Number(v && v.montant_centimes) || 0), 0);
  const dusVirement = somme((g) => g.etat === 'a-verser' || g.etat === 'verse');
  // Les 12 derniers mois (le courant en dernier), au mois du PAIEMENT.
  const douze = [];
  { const d = new Date(maintenant); for (let i = 11; i >= 0; i--) { const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 15, 12); douze.push(moisParis(t)); } }
  const parMois = douze.map((m) => ({ mois: m, centimes: vivants.filter((g) => g.mois === m).reduce((s, g) => s + g.net, 0), n: vivants.filter((g) => g.mois === m).length }));
  const historique = [...etats].sort((a, b) => String(b.paye_le).localeCompare(String(a.paye_le))).slice(0, limite).map((g) => ({
    filleul: rang.get(String(g.filleul)) || null, mois: g.mois, payeLe: String(g.paye_le || '').slice(0, 10), dueLe: String(g.due_le || '').slice(0, 10),
    centimes: g.net, brutCentimes: Number(g.montant_centimes) || 0, reduit: Number(g.rembourse_centimes) > 0 && !g.annulee_le, etat: g.etat,
  }));
  const aVerser = Math.max(0, dusVirement - verseCentimes);
  return {
    filleulsPayants: actifs instanceof Set ? [...payeurs].filter((f) => actifs.has(f)).length : null,
    filleulsAyantPaye: payeurs.size,
    moisCentimes: vivants.filter((g) => g.mois === moisCourant).reduce((s, g) => s + g.net, 0),
    totalCentimes: vivants.reduce((s, g) => s + g.net, 0),
    attenteCentimes: somme((g) => g.etat === 'attente' || g.etat === 'verification'),
    crediteCentimes: somme((g) => g.etat === 'credite'),
    aCrediterCentimes: somme((g) => g.etat === 'a-crediter'),
    verseCentimes,
    aVerserCentimes: aVerser,
    // Une annulation APRÈS versement : du trop-versé, dit (jamais caché).
    tropVerseCentimes: Math.max(0, verseCentimes - dusVirement),
    seuilCentimes: SEUIL_VIREMENT_CENTIMES,
    virementPret: aVerser >= SEUIL_VIREMENT_CENTIMES,
    parMois, historique,
  };
}

// Les gains à créditer maintenant (mode crédit, dus, vérifiés, pas encore crédités).
export const gainsACrediter = (o) => etatsGains(o).filter((g) => g.etat === 'a-crediter');
// Les gains d'un filleul refusé par la règle anti-abus : à annuler.
export const gainsAAnnulerAntiAbus = (gains = [], refuses = new Set()) => gains.filter((g) => g && !g.annulee_le && refuses.has(String(g.filleul)));

// ── L'IBAN (mode virement) : contrôle ISO 13616 (mod 97), affiché masqué ────
export function ibanPropre(brut) {
  const t = String(brut == null ? '' : brut).toUpperCase().replace(/[\s-]/g, '');
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(t)) return '';
  if (t.startsWith('FR') && t.length !== 27) return '';
  const r = (t.slice(4) + t.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let m = 0;
  for (const ch of r) m = (m * 10 + Number(ch)) % 97;
  return m === 1 ? t : '';
}
export const ibanMasque = (iban) => { const t = String(iban || ''); return t.length >= 8 ? `${t.slice(0, 4)} •••• ${t.slice(-4)}` : ''; };
export const titulairePropre = (brut) => { const t = String(brut == null ? '' : brut).normalize('NFC').replace(/\s+/g, ' ').trim(); return t.length >= 2 && t.length <= 70 && /\p{L}/u.test(t) && !/[<>{}\\@]/.test(t) ? t : ''; };

// ── LA VUE DE JULIEN : les parrains à verser ────────────────────────────────
// parrains : [{ parrain, gains, choix, versements, verifies }] → triés, le plus ancien dû d'abord.
export function aVerserAdmin(parrains = [], maintenant = Date.now()) {
  const out = [];
  for (const p of parrains) {
    const c = chiffresParrain({ ...p, maintenant });
    if (!(c.aVerserCentimes > 0)) continue;
    const ouverts = etatsGains({ ...p, maintenant }).filter((g) => g.etat === 'a-verser');
    out.push({ parrain: p.parrain, centimes: c.aVerserCentimes, pret: c.virementPret, depuis: ouverts.length ? String(ouverts[0].due_le).slice(0, 10) : null, gains: ouverts.length });
  }
  out.sort((a, b) => Number(b.pret) - Number(a.pret) || String(a.depuis).localeCompare(String(b.depuis)));
  return { parrains: out, totalCentimes: out.filter((x) => x.pret).reduce((s, x) => s + x.centimes, 0), seuilCentimes: SEUIL_VIREMENT_CENTIMES };
}
export { RE_MOIS };

// ════════════════════════════════════════════════════════════════════════════
// (25 nov., Julien) « que le parrain puisse voir TOUS ses filleuls et tous les paiements qu'il serait
// possible qu'il ait si jamais la personne paye ». Une ligne PAR filleul, numérotée dans l'ordre
// d'inscription (stable), SANS identité — sauf le prénom que le FILLEUL a choisi de montrer (`noms`,
// revalidé par l'appelant). Les montants « possibles » sont des ESTIMATIONS, rendues À PART du gagné
// (jamais additionnées : §5 « un total partiel ou estimé ne se présente jamais comme un fait »).
// Entrées :
//   lignes       les parrainages du parrain [{ filleul, inscrit, refus }]
//   abonnements  Map filleul → { statut, plan, fin_periode }   (null ⇒ pas su : états « — »)
//   gains, choix, verifies, versements : comme `chiffresParrain`
//   prix         { solo, pro } en centimes — LES prix des CGV (lus par l'appelant, jamais en dur ici)
//   noms         Map filleul → prénom montré (le choix du filleul)
// Rend { filleuls: [...], potentielMoisCentimes, siTousCentimes, nPayants, nPossibles }.
export const ETATS_FILLEUL_DETAIL = ['inscrit', 'essai', 'paie', 'arrete', 'rembourse', 'refuse'];
const VIVANTS = ['active', 'past_due'];
export function vueFilleuls({ lignes = [], abonnements = null, gains = [], choix = [], verifies = null, versements = [], prix = {}, noms = null, maintenant = Date.now() }) {
  const etats = etatsGains({ gains, choix, verifies, versements, maintenant });
  const tries = [...lignes].filter((x) => x && x.filleul).sort((a, b) => String(a.inscrit || '').localeCompare(String(b.inscrit || '')) || String(a.filleul).localeCompare(String(b.filleul)));
  const prixDe = (plan) => { const c = Number(plan === 'pro' ? prix.pro : prix.solo); return Number.isInteger(c) && c > 0 ? c : null; };
  let potentiel = 0, possibles = 0, nPayants = 0, nPossibles = 0;
  const filleuls = tries.map((l, i) => {
    const f = String(l.filleul);
    const ses = etats.filter((g) => String(g.filleul) === f).sort((a, b) => String(a.paye_le).localeCompare(String(b.paye_le)));
    const vivants = ses.filter((g) => g.etat !== 'annule');
    const annules = ses.filter((g) => g.etat === 'annule');
    const sub = abonnements instanceof Map ? (abonnements.get(f) || null) : undefined;
    const statut = sub ? String(sub.statut || '') : '';
    const plan = sub && sub.plan === 'pro' ? 'pro' : sub ? 'solo' : null;
    let etat, depuis = null, jusquau = null, le = null;
    if (l.refus) etat = 'refuse';
    else if (VIVANTS.includes(statut) && (vivants.length || !annules.length)) { etat = 'paie'; depuis = vivants.length ? String(vivants[0].paye_le).slice(0, 7) : null; }
    else if (!vivants.length && annules.length) etat = 'rembourse';
    else if (statut === 'trialing') { etat = 'essai'; jusquau = sub.fin_periode ? String(sub.fin_periode).slice(0, 10) : null; }
    else if (vivants.length || ['canceled', 'unpaid', 'incomplete_expired'].includes(statut)) { etat = 'arrete'; le = sub && sub.fin_periode ? String(sub.fin_periode).slice(0, 10) : vivants.length ? String(vivants[vivants.length - 1].paye_le).slice(0, 10) : null; }
    else etat = sub === undefined ? null : 'inscrit';
    const p = prixDe(plan || 'solo');
    const part = p == null ? null : gainDeFacture(p);
    // Le mois prochain s'il continue (il paie) · ce qu'il POURRAIT rapporter (inscrit, en essai).
    const prochain = etat === 'paie' ? part : null;
    const pourrait = etat === 'inscrit' || etat === 'essai' ? part : null;
    if (etat === 'paie') nPayants++;
    if (prochain != null) potentiel += prochain;
    if (pourrait != null) { possibles += pourrait; nPossibles++; }
    const nom = noms instanceof Map && typeof noms.get(f) === 'string' && noms.get(f) ? noms.get(f) : null;
    return {
      rang: i + 1, nom, etat, plan, inscritLe: l.inscrit ? String(l.inscrit).slice(0, 10) : null, depuis, jusquau, le,
      moisPayes: vivants.length, gagneCentimes: vivants.reduce((s, g) => s + g.net, 0), prochainCentimes: prochain, pourraitCentimes: pourrait,
      paiements: ses.map((g) => ({ payeLe: String(g.paye_le || '').slice(0, 10), dueLe: String(g.due_le || '').slice(0, 10),
        payeCentimes: Math.max(0, (Number(g.facture_centimes) || 0) - (Number(g.rembourse_centimes) || 0)), partCentimes: g.net, etat: g.etat, raison: g.annulee_raison || null })),
    };
  });
  return { filleuls, nPayants, nPossibles, potentielMoisCentimes: potentiel, siTousCentimes: potentiel + possibles };
}
// Le rang d'inscription de chaque filleul (pour l'historique) : Map filleul → rang.
export const rangsInscription = (lignes = []) => new Map([...lignes].filter((x) => x && x.filleul)
  .sort((a, b) => String(a.inscrit || '').localeCompare(String(b.inscrit || '')) || String(a.filleul).localeCompare(String(b.filleul)))
  .map((x, i) => [String(x.filleul), i + 1]));
