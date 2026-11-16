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
  { cle: 'numeros-double', ou: 'vendeur', ton: 'rouge', notifie: true, get nom() { return `Deux ${motsVendeur().noms} sous un N°`; },
    phrase: (n) => `${n} N° ${pl(n, 'porté', 'portés')} par deux ${motsVendeur().noms} en ligne`,
    geste: { libelle: 'Corriger', aller: '/?tab=cat_bord' } },
  // (15 nov., extension 5.390) Julien : « Enlève les 1741 ventes à dater […] le but est que l'extension récupère ces infos, pas que ça soit à nous de le faire. »
  // « N ventes sans date de versement depuis 30 jours » n'est plus un contrôle de la nuit : ce
  // n'est pas un problème qu'il corrige, l'extension récupère ces dates (`versementsEnRetard`
  // reste exporté pour mesurer).
  { cle: 'comptes-48h', ou: 'vendeur', nom: 'Comptes pas relus',
    phrase: (n) => `${n} ${pl(n, 'compte pas relu', 'comptes pas relus')} depuis 48 h`,
    geste: { libelle: 'Mes comptes', aller: '/?tab=vintedaccounts' } },
  // (15 nov., lot fiabilite-auto) Quatre contrôles de plus. Les mots affichés passent par
  // `tr('fiab.ctl.<cle>…')` (src/fiabilite/ControleNuitLignes.jsx) ; ces phrases-ci servent au
  // serveur et à la réponse du cron (le français fait foi). `notifie` : un écart RÉEL qui
  // demande un geste ⇒ la notification du matin (api/_lib/controle-nuit.js `notifierControle`).
  { cle: 'vente-sans-numero', ou: 'vendeur', nom: 'Ventes sans N°', notifie: true,
    phrase: (n) => `${n} ${pl(n, 'vente récente', 'ventes récentes')} sans N° de rangement`,
    geste: { libelle: 'Voir', aller: '/?tab=ventes' } },
  { cle: 'pool-retreci', ou: 'vendeur', nom: 'Liste des N° rétrécie', notifie: true,
    phrase: (n) => `${n} N° ${pl(n, 'manque', 'manquent')} dans ta liste de numéros`,
    geste: { libelle: 'Voir', aller: '/?tab=settings&section=securite' } },
  { cle: 'enligne-24h', ou: 'vendeur', nom: 'Annonces à confirmer', notifie: true,
    phrase: (n) => `${n} ${pl(n, 'compte', 'comptes')} : annonces pas relues depuis 24 h`,
    geste: { libelle: 'Mes comptes', aller: '/?tab=vintedaccounts' } },
  { cle: 'totaux-mois', ou: 'vendeur', nom: 'Totaux du mois',
    phrase: (n) => `${n} ${pl(n, 'total du mois ne correspond', 'totaux du mois ne correspondent')} pas à tes ventes`,
    geste: { libelle: 'Ouvrir Argent', aller: '/?tab=compta' } },
  { cle: 'emails-quarantaine', ou: 'installation', nom: 'E-mails sans vendeur',
    phrase: (n) => `${n} ${pl(n, 'e-mail', 'e-mails')} en quarantaine, sans vendeur`,
    geste: { libelle: 'Voir', aller: '/?tab=emails' } },
  { cle: 'stripe', ou: 'installation', nom: 'Abonnements Stripe',
    phrase: (n) => `${n} ${pl(n, 'abonnement Stripe incohérent', 'abonnements Stripe incohérents')}`,
    geste: { libelle: 'Voir', aller: '/?tab=settings&section=pilotage' } },
];
export const CLES_CONTROLES = CONTROLES.map((c) => c.cle);
// (15 nov., Julien) « N ventes à dater » ne s'affiche NULLE PART : l'extension les date sans
// rien lui demander. (16 nov., intégration vague C) Le lot versements-auto (5.390) a retiré ce
// contrôle de CONTROLES : une ligne rangée par un cron d'avant qui le porte encore n'est plus
// lue (etatControle ne parcourt que CONTROLES). L'ancienne liste « muets » est retirée avec lui.
export const CONTROLES_NOTIFIES = new Set(CONTROLES.filter((c) => c.notifie).map((c) => c.cle));

// ── (15 nov., lot fiabilite-auto) LES NOUVELLES RÈGLES ─────────────────────────────
const cleN = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
const NUM_FORME = /^([A-Z]{1,3})?\d{1,6}$/;
// Un N° porté par une fiche (« 12 », « B230 », un lot « 12+13 ») ⇒ ses parties.
export const partiesNumero = (v) => String(v == null ? '' : v).split('+').map(cleN).filter((k) => NUM_FORME.test(k));
export const VENTE_RECENTE_J = 7;
// Une vente Vinted RÉCENTE sans N° de rangement — par IDENTITÉ seulement (§5) :
// transaction → annonce (`txItem`, le détail de transaction lu) → fiche ; ou la
// transaction elle-même (`overrides[tx].numero`, `liens[tx]` → fiche). Une vente dont
// l'annonce n'est PAS connue n'est pas comptée (« pas su » ne vaut pas « sans N° »).
// `ventes` : [{ tx, ts, annulee }] ; rend les n° de transaction, du plus récent au plus ancien.
export function ventesSansNumero({ ventes, txItem, fiches, overrides, liens, maintenant = Date.now(), jours = VENTE_RECENTE_J }) {
  if (!Array.isArray(ventes) || !(txItem instanceof Map) || !objet(fiches)) return null;
  const F = fiches, O = objet(overrides) || {}, L = objet(liens) || {};
  const aNum = (k) => !!(k && F[String(k)] && partiesNumero(F[String(k)].numero).length);
  const out = [];
  const vus = new Set();
  for (const v of ventes) {
    if (!v || v.annulee || v.tx == null) continue;
    const tx = String(v.tx);
    if (vus.has(tx)) continue; vus.add(tx);
    const t = Number(v.ts);
    if (!Number.isFinite(t) || maintenant - t > jours * 864e5 || t > maintenant + 864e5) continue;
    if (O[tx] && partiesNumero(O[tx].numero).length) continue;
    if (L[tx] && aNum(L[tx])) continue;
    const item = txItem.get(tx);
    if (!item) continue;                       // annonce pas connue : pas su, pas compté
    if (aNum(item)) continue;
    out.push({ tx, ts: t });
  }
  return out.sort((a, b) => b.ts - a.ts).map((x) => x.tx);
}
// La liste des N° utilisés (`vinted_used_numeros`, append-only, §5) qui a RÉTRÉCI : un N°
// porté par une fiche ou une vente qui n'y est plus, ou moins de N° que la nuit d'avant
// (`avant` = le nombre rangé par le contrôle précédent). Rien n'est réparé : c'est dit.
// Rend { ids, n } (ids : les N° manquants, puis « moins-K » si le nombre a baissé) ou null.
export function poolRetreci({ pool, fiches, overrides, avant = null }) {
  if (!Array.isArray(pool) || !objet(fiches)) return null;
  const P = new Set();
  for (const x of pool) for (const k of partiesNumero(x)) P.add(k);
  const manquent = new Set();
  const voir = (num) => { for (const k of partiesNumero(num)) if (!P.has(k)) manquent.add(k); };
  for (const f of Object.values(fiches)) if (f && typeof f === 'object') voir(f.numero);
  for (const o of Object.values(objet(overrides) || {})) if (o && typeof o === 'object') voir(o.numero);
  const ids = [...manquent].sort((a, b) => (parseInt(a.replace(/\D/g, ''), 10) || 0) - (parseInt(b.replace(/\D/g, ''), 10) || 0) || a.localeCompare(b));
  if (Number.isInteger(avant) && avant > P.size) ids.push(`moins-${avant - P.size}`);
  return { ids, n: P.size };
}
// Les comptes Vinted GARDÉS dans les totaux dont la lecture « en ligne » a plus de 24 h
// (la règle `<enligne-regle>` : des annonces « à confirmer »). `parCompte` : Map uid → le
// résultat de `enLigneDuCompte` ; `gardes` : Set des uid gardés (null = pas su).
export function enLigneVieux(parCompte, gardes) {
  if (!(parCompte instanceof Map) || !(gardes instanceof Set)) return null;
  const out = [];
  for (const [uid, r] of parCompte) if (gardes.has(String(uid)) && r && Array.isArray(r.aConfirmer) && r.aConfirmer.length) out.push(String(uid));
  return out.sort();
}
// LES TOTAUX DU MOIS publiés par l'app, comparés à LEUR source refaite au serveur (la règle
// miroir de l'app, api/_lib/bilan-semaine.js `calculerBilan` : VENDU au jour de la vente,
// REÇU au jour du versement) — et entre eux.
//   · `widget_stats` (ventesMois, caMois) = VENDU du mois ;
//   · `vinted_urssaf_mois.recu[ym]` = REÇU du mois ;
//   · `vrm_benefice_jours` : les ventes FINALISÉES du mois (un sous-ensemble du vendu) ⇒
//     jamais plus que le vendu du widget publié APRÈS lui.
// On ne compare QUE ce qui peut l'être : une publication plus ancienne que la dernière
// lecture des ventes (`sourceAt`), ou une source partielle, n'est pas un écart (« pas su »,
// dit). `src` : { vendu:{etat,n,eur}, recu:{etat,eur} } ; publications : { at (ms), … }.
// Rend { ecarts: ['widget-n', …], compares } ou { passu: raison }.
export const TOLERANCE_EUR = 1;
export function ecartsTotaux({ src, sourceAt, widget, urssaf, benefice, ym }) {
  const ecarts = [];
  let compares = 0;
  const frais = (at) => Number.isFinite(at) && Number.isFinite(sourceAt) && at >= sourceAt;
  const w = objet(widget), u = objet(urssaf), b = objet(benefice);
  const vendu = src && objet(src.vendu), recu = src && objet(src.recu);
  if (w && frais(w.at) && vendu && vendu.etat === 'su') {
    if (Number.isInteger(w.n)) { compares++; if (w.n !== vendu.n) ecarts.push('widget-n'); }
    if (Number.isFinite(w.eur)) { compares++; if (Math.abs(w.eur - vendu.eur) > TOLERANCE_EUR) ecarts.push('widget-ca'); }
  }
  if (u && frais(u.at) && recu && recu.etat === 'su' && Number.isFinite(u.eur)) { compares++; if (Math.abs(u.eur - recu.eur) > TOLERANCE_EUR) ecarts.push('recu-ca'); }
  if (b && w && Number.isInteger(b.n) && Number.isInteger(w.n) && Number.isFinite(b.at) && Number.isFinite(w.at) && w.at >= b.at) { compares++; if (b.n > w.n) ecarts.push('benefice-n'); }
  if (!compares) return { passu: `publiés avant la dernière lecture de tes ventes (${ym})` };
  return { ecarts, compares };
}
// La signature d'un résultat pour la notification : les contrôles NOTIFIÉS en écart, et
// leurs identifiants. La même signature qu'hier ⇒ rien de neuf, rien n'est envoyé.
export function aNotifierControle(data, memo, maintenant = Date.now()) {
  const c = objet(data) && objet(data.controles);
  if (!c) return null;
  const at = Date.parse(String(data.at || ''));
  if (!Number.isFinite(at) || maintenant - at > FRAIS_MS) return null;
  const lignes = [];
  for (const C of CONTROLES) {
    if (!CONTROLES_NOTIFIES.has(C.cle)) continue;
    const x = objet(c[C.cle]);
    if (x && Number.isInteger(x.n) && x.n > 0) lignes.push({ cle: C.cle, n: x.n, ids: Array.isArray(x.ids) ? x.ids.map(String) : [] });
  }
  if (!lignes.length) return null;
  const sig = lignes.map((l) => `${l.cle}:${[...l.ids].sort().join(',')}`).join('|');
  const m = objet(memo);
  if (m && m.sig === sig) return null;
  return { lignes, sig };
}
export const memoControleApres = (n, maintenant = Date.now()) => ({ v: 1, sig: n.sig, at: new Date(maintenant).toISOString() });

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
// (14 nov., lot dates-versement) CE QUI ACCOMPAGNE LE NOMBRE, pour une phrase juste (§2.7) :
// combien sont DÉJÀ datées (`aDater.datees.n`), la cause quand elle est UNE seule (les
// raisons publiées par Ventes, src/versementRaisons.js — `vinted-detail` : Vinted ne donne la
// date qu'en ouvrant chaque vente, l'extension les lit) et combien de comptes. Des nombres et
// une clé : jamais un pseudo. Absent (ligne d'avant ce lot) ⇒ `null` : la phrase d'avant.
export function detailVersement(aDater) {
  const a = objet(aDater);
  if (!a) return null;
  const d = objet(a.datees);
  const datees = d && Number.isInteger(d.n) && d.n >= 0 ? d.n : null;
  const raisons = Array.isArray(a.raisons) ? a.raisons.filter((r) => r && Number(r.n) > 0) : null;
  const cause = raisons && raisons.length ? (raisons.every((r) => r.cle === raisons[0].cle) ? String(raisons[0].cle).slice(0, 20) : 'plusieurs') : null;
  const comptes = raisons && cause === 'vinted-detail' ? raisons.reduce((t, r) => t + (Array.isArray(r.comptes) ? r.comptes.length : 0), 0) : null;
  const total = Number.isInteger(a.n) && a.n >= 0 ? a.n : null;
  if (datees == null && cause == null) return null;
  return { datees, cause, comptes, total };
}
const DETAILS_PERMIS = { datees: 'n', comptes: 'n', total: 'n', cause: 's' };
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
// `details` (14 nov.) : { cle: { datees, comptes, total, cause } } — liste blanche, nombres et clé.
export function resultatControle(valeurs, raisons = {}, maintenant = Date.now(), details = {}, extra = {}) {
  const controles = {};
  for (const [cle, v] of Object.entries(valeurs || {})) {
    if (!CLES_CONTROLES.includes(cle)) continue;
    if (Array.isArray(v)) controles[cle] = { n: v.length, ids: v.slice(0, IDS_MAX).map((x) => String(typeof x === 'object' && x ? (x.cause || x.id || '') : x).slice(0, 40)) };
    else if (Number.isInteger(v) && v >= 0) {
      controles[cle] = { n: v };
      const d = objet(details && details[cle]);
      if (d) for (const [k, t] of Object.entries(DETAILS_PERMIS)) {
        if (t === 'n' && Number.isInteger(d[k]) && d[k] >= 0) controles[cle][k] = d[k];
        if (t === 's' && typeof d[k] === 'string' && /^[a-z-]{1,20}$/.test(d[k])) controles[cle][k] = d[k];
      }
    }
    else controles[cle] = { n: null, raison: String(raisons[cle] || 'pas lu').slice(0, 80) };
  }
  // (15 nov., lot fiabilite-auto) `pool` : le nombre de N° de la liste, relu la nuit suivante.
  const x = objet(extra) || {};
  return { v: 1, at: new Date(maintenant).toISOString(), controles, ...(Number.isInteger(x.pool) && x.pool >= 0 ? { pool: x.pool } : {}) };
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
    if (c.n > 0) {
      lignes.push({ cle: C.cle, n: c.n, ton: C.ton || 'geste', phrase: C.phrase(c.n), geste: C.geste, ids: Array.isArray(c.ids) ? c.ids : [] });
    }
  }
  return { etat: lignes.length ? 'probleme' : passu.length ? 'passu' : 'ok', lignes, passu, at };
}
