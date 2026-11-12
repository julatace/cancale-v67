// ══════════════════════════════════════════════════════════════════════════════
//  LE CONTRÔLE DE NUIT — LA RÈGLE (11 nov. 2026, lot agent2-veille)
//  Julien (validé) : chaque nuit, en LECTURE SEULE, on vérifie ce qui ne doit
//  jamais arriver, et Ma journée dit « Tout est en ordre ✓ » ou chaque problème
//  avec son geste.
//
//  Le cron du matin (api/ship-reminders.js → api/_lib/controle-nuit.js) lit,
//  projeté et paginé (jamais `select=data` sur une ligne lourde, §4.4-4.5) :
//    · deux paires EN LIGNE sur Vinted sous un même N° (`cleNum`, l'identité de la
//      paire = l'identifiant d'annonce, §5 ; la règle « en ligne » de l'app,
//      api/_lib/enligne-regle.js) — le seul risque irréversible : ROUGE ;
//    · des ventes sans date de versement vendues il y a plus de 30 jours (le
//      nombre publié par l'écran Ventes, `vinted_urssaf_mois.aDater.plus30`) ;
//    · un compte Vinted gardé dans les totaux pas relu depuis plus de 48 h (la
//      règle de « Tout va bien ? », api/_lib/comptes-a-relire.js) ;
//    · au PROPRIÉTAIRE de l'installation seul : les e-mails en quarantaine que
//      personne n'a réclamés (propriétaire NEUTRE) et les abonnements Stripe
//      incohérents (la table `abonnements` comparée à elle-même et à Stripe).
//  Le résultat est RANGÉ (nombres + identifiants : N°, n° de compte Vinted,
//  identifiant de ligne ; jamais un pseudo, un titre, un e-mail, un montant) dans
//  `vrm_controle_nuit` (chaque vendeur) et `vrm_controle_installation` (le
//  propriétaire). Rien d'autre n'est écrit ; rien n'est corrigé tout seul.
//  « Pas su » (une lecture ratée) ⇒ `n: null` avec sa raison : jamais compté 0,
//  et « Tout est en ordre ✓ » ne se dit QUE si chaque contrôle a été LU.
//  Module PUR : l'app (src/VeilleJournee.jsx), le serveur et l'audit l'exécutent.
// ══════════════════════════════════════════════════════════════════════════════

import { motsVendeur } from './profilVendeur.js';   // (12 nov., intégration) « paire » seulement pour Sneakers
export const CLE_CONTROLE = 'vrm_controle_nuit';
export const CLE_CONTROLE_INSTALLATION = 'vrm_controle_installation';
export const VERSEMENT_JOURS = 30;
export const RELU_MS = 48 * 3600e3;
export const FRAIS_MS = 36 * 3600e3;          // un contrôle de plus de 36 h n'est plus « de cette nuit »
export const IDS_MAX = 20;
export const STRIPE_GRACE_MS = 3 * 864e5;     // une échéance passée depuis 3 jours sans nouvelle de Stripe
const STATUTS_VIVANTS = new Set(['active', 'trialing', 'past_due']);

const pl = (n, s, p) => (n > 1 ? p : s);
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);

// L'ordre = la gravité. `ou` : 'vendeur' (sa ligne) ou 'installation' (le propriétaire).
export const CONTROLES = [
  { cle: 'numeros-double', ou: 'vendeur', ton: 'rouge', get nom() { return `Deux ${motsVendeur().noms} sous un N°`; },
    phrase: (n) => `${n} N° ${pl(n, 'porté', 'portés')} par deux ${motsVendeur().noms} en ligne`,
    geste: { libelle: 'Corriger', aller: '/?tab=cat_bord' } },
  { cle: 'versement-30j', ou: 'vendeur', nom: 'Ventes sans versement',
    phrase: (n) => `${n} ${pl(n, 'vente', 'ventes')} sans date de versement depuis 30 jours`,
    geste: { libelle: 'Voir pourquoi', aller: '/?tab=compta&cible=urssaf' } },
  { cle: 'comptes-48h', ou: 'vendeur', nom: 'Comptes pas relus',
    phrase: (n) => `${n} ${pl(n, 'compte pas relu', 'comptes pas relus')} depuis 48 h`,
    geste: { libelle: 'Mes comptes', aller: '/?tab=vintedaccounts' } },
  { cle: 'emails-quarantaine', ou: 'installation', nom: 'E-mails sans vendeur',
    phrase: (n) => `${n} ${pl(n, 'e-mail', 'e-mails')} en quarantaine, sans vendeur`,
    geste: { libelle: 'Voir', aller: '/?tab=emails' } },
  { cle: 'stripe', ou: 'installation', nom: 'Abonnements Stripe',
    phrase: (n) => `${n} ${pl(n, 'abonnement Stripe incohérent', 'abonnements Stripe incohérents')}`,
    geste: { libelle: 'Voir', aller: '/?tab=settings&section=pilotage' } },
];
export const CLES_CONTROLES = CONTROLES.map((c) => c.cle);

// ── LES RÈGLES ──────────────────────────────────────────────────────────────────
// `parNumero` : Map N° → [{ id }] (les annonces Vinted EN LIGNE par N°,
// `annoncesVintedParNumero`). Deux identifiants différents sous un N° = deux paires.
export function numerosEnDouble(parNumero) {
  if (!(parNumero instanceof Map)) return null;
  const out = [];
  for (const [num, l] of parNumero) {
    const ids = new Set((Array.isArray(l) ? l : []).map((x) => String((x && x.id) || '')).filter(Boolean));
    if (ids.size > 1) out.push(String(num));
  }
  return out.sort((a, b) => (parseInt(a.replace(/\D/g, ''), 10) || 0) - (parseInt(b.replace(/\D/g, ''), 10) || 0) || a.localeCompare(b));
}
// `liste` : `comptesARelire(...)` (déjà : gardés dans les totaux, ni bannis ni
// supprimés, lus au moins une fois) ; `null` = pas su.
export function comptesPasRelus(liste, maintenant = Date.now()) {
  if (!Array.isArray(liste)) return null;
  return liste.filter((c) => c && Number.isFinite(Number(c.lu)) && maintenant - Number(c.lu) > RELU_MS).map((c) => String(c.uid));
}
// `aDater` : `vinted_urssaf_mois.aDater` (publié par l'écran Ventes). Le nombre
// `plus30` est publié depuis le 11 nov. ; absent (ligne d'avant) ⇒ pas su.
export function versementsEnRetard(aDater) {
  const a = objet(aDater);
  if (!a) return null;
  const p = objet(a.plus30);
  return p && Number.isInteger(p.n) && p.n >= 0 ? p.n : null;
}
// Les ventes à dater vendues il y a plus de 30 jours (appelé par l'écran Ventes
// sur SES lignes `aDater` ; `tsVente(l)` = la date de vente, src/aDaterAnnee.js).
export function plus30De(aDater, tsVente, maintenant = Date.now()) {
  let n = 0, ca = 0;
  for (const l of Array.isArray(aDater) ? aDater : []) {
    const t = tsVente(l);
    if (t != null && maintenant - t > VERSEMENT_JOURS * 864e5) { n += 1; ca += Number(l.eur) || 0; }
  }
  return { n, ca: Math.round(ca * 100) / 100 };
}
// Les abonnements incohérents. `rows` : la table `abonnements` (projetée) ;
// `stripe` : Map abonnement_stripe → { statut } | null (Stripe muet) — ou `null`
// (Stripe pas branché : seule la table est comparée à elle-même).
// Rend [{ cause }] (jamais l'identité d'un vendeur hors du serveur).
export function incoherencesStripe(rows, { stripe = null, maintenant = Date.now(), proprio = '' } = {}) {
  if (!Array.isArray(rows)) return null;
  const out = [];
  for (const r of rows) {
    if (!r || String(r.owner || '').toLowerCase() === String(proprio || '').toLowerCase()) continue;
    const st = String(r.statut || '');
    const fin = Date.parse(String(r.fin_periode || ''));
    const vivant = STATUTS_VIVANTS.has(st);
    if (vivant && !r.abonnement_stripe) { out.push({ cause: 'sans-abonnement' }); continue; }
    if (vivant && Number.isFinite(fin) && maintenant - fin > STRIPE_GRACE_MS) { out.push({ cause: 'echeance-passee' }); continue; }
    if (stripe instanceof Map && r.abonnement_stripe && stripe.has(String(r.abonnement_stripe))) {
      const s = stripe.get(String(r.abonnement_stripe));
      if (s && s.statut && s.statut !== st) out.push({ cause: 'statut-different' });
      else if (s && s.absent && vivant) out.push({ cause: 'inconnu-chez-stripe' });
    }
  }
  return out;
}

// ── LE RÉSULTAT RANGÉ ───────────────────────────────────────────────────────────
// `valeurs` : { cle: liste d'identifiants | nombre | null } ; `raisons` : { cle: texte }.
export function resultatControle(valeurs, raisons = {}, maintenant = Date.now()) {
  const controles = {};
  for (const [cle, v] of Object.entries(valeurs || {})) {
    if (!CLES_CONTROLES.includes(cle)) continue;
    if (Array.isArray(v)) controles[cle] = { n: v.length, ids: v.slice(0, IDS_MAX).map((x) => String(typeof x === 'object' && x ? (x.cause || x.id || '') : x).slice(0, 40)) };
    else if (Number.isInteger(v) && v >= 0) controles[cle] = { n: v };
    else controles[cle] = { n: null, raison: String(raisons[cle] || 'pas lu').slice(0, 80) };
  }
  return { v: 1, at: new Date(maintenant).toISOString(), controles };
}

// ── CE QUE MA JOURNÉE MONTRE ────────────────────────────────────────────────────
// `vendeur` / `installation` : les lignes lues (`undefined` = lecture · `null` =
// absente). Rend { etat, lignes, passu, at } :
//   etat 'lecture' · 'absent' (aucun contrôle passé) · 'vieux' (plus de 36 h) ·
//        'probleme' (au moins un nombre > 0) · 'passu' (rien > 0 mais un contrôle pas lu) · 'ok'.
export function etatControle(vendeur, installation, maintenant = Date.now()) {
  if (vendeur === undefined) return { etat: 'lecture', lignes: [], passu: [], at: null };
  const v = objet(vendeur);
  if (!v || !objet(v.controles)) return { etat: 'absent', lignes: [], passu: [], at: null };
  const at = Date.parse(String(v.at || ''));
  if (!Number.isFinite(at) || maintenant - at > FRAIS_MS) return { etat: 'vieux', lignes: [], passu: [], at: Number.isFinite(at) ? at : null };
  const inst = objet(installation);
  const instFrais = inst && objet(inst.controles) && maintenant - Date.parse(String(inst.at || '')) <= FRAIS_MS ? inst.controles : null;
  const lignes = [], passu = [];
  for (const C of CONTROLES) {
    const src = C.ou === 'vendeur' ? v.controles : instFrais;
    if (!src) continue;                                   // le propriétaire seul a ces contrôles
    const c = objet(src[C.cle]);
    if (!c) continue;
    if (!Number.isInteger(c.n)) { passu.push({ cle: C.cle, nom: C.nom, raison: c.raison || 'pas lu' }); continue; }
    if (c.n > 0) lignes.push({ cle: C.cle, n: c.n, ton: C.ton || 'geste', phrase: C.phrase(c.n), geste: C.geste, ids: Array.isArray(c.ids) ? c.ids : [] });
  }
  return { etat: lignes.length ? 'probleme' : passu.length ? 'passu' : 'ok', lignes, passu, at };
}
