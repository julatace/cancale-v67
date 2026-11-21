// ════════════════════════════════════════════════════════════════════════════
//  STATISTIQUES PAR TRANSPORTEUR — VENTES ET ACHATS (21 nov., lot journee-stats). Julien : « fais les stats par
//  transporteur, achat et vente ». Module PUR (aucune lecture, aucun React), LE propriétaire de ces chiffres :
//    · `ligneVente` / `ligneAchat` : UN colis, rangé à partir de ce que l'écran a LU pour lui, PAR IDENTITÉ (le n° de
//      suivi de SON bordereau, la ligne `depart_`/`transp_` de CE n°, SA commande) — jamais par titre ;
//    · `delai` : un délai en jours sur les SEULES paires de dates lues (une date manquante ⇒ la ligne sort du calcul,
//      la couverture « sur N » est rendue) ; moins de 3 colis mesurés ⇒ null (« — ») ; médiane quand les écarts sont
//      forts, moyenne sinon — et le mode est rendu (l'écran dit lequel) ;
//    · `statsTransporteurs` : par transporteur (le transporteur LU, `cleStatTransporteur` ; « inconnu » compté à part).
//  Aucune date n'est estimée ici : un dépôt est une prise en charge LUE chez le transporteur, une livraison l'arrivée
//  au point de l'acheteur ou chez lui LUE, une limite celle de l'e-mail du bordereau (jamais « vente + 7 j »).
// ════════════════════════════════════════════════════════════════════════════
import { cleStatTransporteur, nomDuTransporteur } from './transporteursVisuels.js';

const JOUR = 86400000;
export const MIN_COLIS = 3;
// Les écarts sont « forts » quand la moyenne s'écarte de plus d'un quart de la médiane, ou que le plus long dépasse
// trois fois la médiane : la médiane est alors rendue (un colis bloqué une semaine ne tire pas le chiffre).
export const ECART_FORT = 0.25;
const ms = (v) => { if (v == null || v === '') return null; if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null; const t = Date.parse(String(v)); return Number.isFinite(t) && t > 0 ? t : null; };

// Le sort d'une vente lu dans SON état Vinted : retour (l'article revient) · litige (transaction suspendue, réclamation).
export function issueVente(status) {
  const s = String(status || '');
  if (/retour|rembours/i.test(s)) return 'retour';
  if (/suspend|litige|r[ée]clamation/i.test(s)) return 'litige';
  return null;
}

// `tr` : { cle, nom } (transporteurDeVente) ; `venteAt` : la date de la vente ; `depart` : la ligne `depart_` du n° de SON
// bordereau (priseAt, etat, etatAt) ou null ; `limiteAt` : la limite LUE dans l'e-mail du bordereau (ms) ou null ;
// `status` : l'état Vinted de la commande.
export function ligneVente({ tr = null, venteAt = null, depart = null, limiteAt = null, status = '' } = {}) {
  const d = depart && typeof depart === 'object' ? depart : null;
  const depotAt = d ? ms(d.priseAt) : null;
  const livreAt = d && (d.etat === 'disponible' || d.etat === 'livre') ? ms(d.etatAt) : null;
  const lim = ms(limiteAt);
  return {
    t: cleStatTransporteur(tr), nom: (tr && tr.nom) || '', venteAt: ms(venteAt), depotAt, livreAt: livreAt != null && depotAt != null && livreAt < depotAt ? null : livreAt,
    retard: depotAt != null && lim != null ? depotAt > lim : null,
    issue: issueVente(status) || (d && d.etat === 'retour_expediteur' ? 'renvoye' : null),
    aVerifier: !!(d && d.etat === 'incident'),
  };
}

// `trajet` : le rendu de src/retraitTrajet.js `etapesTrajet` pour CE colis (ou null) ; `ligne` : la ligne `transp_`
// de SON n° (etat, etatAt, lieuNom, lieuVille) ; `payeAt` : la date de SA commande ; `status` : l'état Vinted de l'achat.
export function ligneAchat({ tr = null, payeAt = null, ligne = null, trajet = null, status = '' } = {}) {
  const l = ligne && typeof ligne === 'object' ? ligne : null;
  const at = (k) => { const e = trajet && Array.isArray(trajet.etapes) ? trajet.etapes.find((x) => x.cle === k) : null; return e && e.lue ? ms(e.at) : null; };
  const pointAt = at('point') ?? (l && l.etat === 'disponible' ? ms(l.etatAt) : null);
  const retireAt = at('retire') ?? (l && l.etat === 'retire' ? ms(l.etatAt) : null);
  const point = l && l.lieuNom ? [String(l.lieuNom).trim(), String(l.lieuVille || '').trim()].filter(Boolean).join(', ').slice(0, 60) : '';
  return {
    t: cleStatTransporteur(tr), nom: (tr && tr.nom) || '', payeAt: ms(payeAt) ?? at('paye'), expedieAt: at('expedie'), pointAt,
    retireAt: retireAt != null && pointAt != null && retireAt < pointAt ? null : retireAt,
    nonReclame: !!(l && l.etat === 'retour_expediteur') || /non\s+r[ée]clam/i.test(String(status || '')),
    point,
  };
}

// Un délai en jours sur des paires [début, fin] LUES (fin ≥ début). Rend { jours, mode, n, sur } ou { jours: null, … }.
export function delai(paires) {
  const L = Array.isArray(paires) ? paires : [];
  const v = L.filter(([a, b]) => a != null && b != null && b >= a).map(([a, b]) => (b - a) / JOUR).sort((x, y) => x - y);
  const sur = L.length, n = v.length;
  if (n < MIN_COLIS) return { jours: null, mode: null, n, sur };
  const moy = v.reduce((t, x) => t + x, 0) / n;
  const med = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
  const fort = med > 0 ? (Math.abs(moy - med) / med > ECART_FORT || v[n - 1] > 3 * med) : moy > 0;
  const x = fort ? med : moy;
  return { jours: Math.round(x * 10) / 10, mode: fort ? 'mediane' : 'moyenne', n, sur };
}

const NOMS = { 'pas-lu': '', autre: '' };
const groupe = (L) => { const m = new Map(); for (const x of L) { const k = x.t || 'pas-lu'; if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
const nomDe = (k, L) => (NOMS[k] !== undefined ? (k === 'autre' ? (L.find((x) => x.nom) || {}).nom || '' : '') : nomDuTransporteur(k) || (L.find((x) => x.nom) || {}).nom || k);
const plusFrequent = (L) => { const c = new Map(); for (const x of L) if (x) c.set(x, (c.get(x) || 0) + 1); let best = null; for (const [k, n] of c) if (!best || n > best.n) best = { nom: k, n }; return best; };

// `ventes`, `achats` : les lignes rangées (ou null = pas su) ; `de`, `a` : la fenêtre (ms). Une vente est dans la fenêtre
// par sa date de vente, un achat par sa date de paiement ; sans cette date, il n'est dans aucune fenêtre (et c'est dit).
export function statsTransporteurs({ ventes = null, achats = null, de, a }) {
  const dans = (t) => t != null && t >= de && t < a;
  const partie = (L, dateDe, faire) => {
    if (!Array.isArray(L)) return null;
    const F = L.filter((x) => dans(dateDe(x)));
    const total = F.length;
    const G = groupe(F);
    const rangs = [...G.entries()].filter(([k]) => k !== 'pas-lu').map(([k, X]) => ({ cle: k, nom: nomDe(k, X), n: X.length, part: total ? Math.round((X.length / total) * 100) : 0, ...faire(X) }))
      .sort((x, y) => y.n - x.n || (x.nom < y.nom ? -1 : 1));
    const inc = G.get('pas-lu') || [];
    return { total, sansDate: L.filter((x) => dateDe(x) == null).length, transporteurs: rangs, inconnu: inc.length ? { n: inc.length, part: Math.round((inc.length / total) * 100), ...faire(inc) } : null };
  };
  return {
    ventes: partie(ventes, (x) => x.venteAt, (X) => {
      const juges = X.filter((x) => x.retard != null);
      return {
        depot: delai(X.map((x) => [x.venteAt, x.depotAt])),
        livraison: delai(X.map((x) => [x.depotAt, x.livreAt])),
        // À temps : sur les SEULS colis dont la limite est LUE et le dépôt constaté ; moins de 3 ⇒ pas de part (« — »).
        aTemps: juges.length >= MIN_COLIS ? { ok: juges.filter((x) => !x.retard).length, retard: juges.filter((x) => x.retard).length, sur: juges.length } : { ok: null, retard: null, sur: juges.length },
        retours: X.filter((x) => x.issue === 'retour' || x.issue === 'renvoye').length,
        litiges: X.filter((x) => x.issue === 'litige').length,
        aVerifier: X.filter((x) => x.aVerifier).length,
      };
    }),
    achats: partie(achats, (x) => x.payeAt, (X) => ({
      expedition: delai(X.map((x) => [x.payeAt, x.expedieAt])),
      arrivee: delai(X.map((x) => [x.expedieAt, x.pointAt])),
      retrait: delai(X.map((x) => [x.pointAt, x.retireAt])),
      nonReclames: X.filter((x) => x.nonReclame).length,
      point: plusFrequent(X.map((x) => x.point)),
    })),
  };
}

// Ce qu'on garde d'une ligne dans la publication (`vrm_stats_transporteurs`, sur cet appareil) : les dates et les drapeaux,
// ni titre, ni acheteur, ni n° de suivi.
export const CLE_PUB_TRANSP = 'vrm_stats_transporteurs';
export const JOURS_PUB_TRANSP = 120;

// ════════════════════════════════════════════════════════════════════════════
//  (21 nov., lot relier-retires) LES COLIS QU'IL N'EST PAS ALLÉ CHERCHER. Julien : « statistiques des colis que je ne suis
//  pas allé chercher ». Un colis NON RÉCLAMÉ se PROUVE par SON achat (jamais par titre) : l'état Vinted de la commande ou de
//  SA transaction (« Commande non réclamée - Retournée à l'expéditeur »), ou la ligne du transporteur de SON n° de suivi
//  (`retour_expediteur`). L'argent : ce qu'il a payé (lu), ce qui a été remboursé (statut, transaction annulée, e-mail du
//  remboursement — src/coutAchatNet.js), en attente (rien de lu). En cours : les colis AU POINT (src/achatChezMoi.js) depuis N
//  jours, avec la date limite de garde LUE (e-mail du transporteur) — sans elle, le risque est « — », jamais deviné.
//  Publié par l'écran Achats (`vrm_stats_non_retires`, sur cet appareil, TOUS ses achats lus : la période « tout »), lu par
//  Statistiques · Transporteurs. Ni titre, ni n°, ni vendeur : les dates, le transporteur, le point, les montants.
// ════════════════════════════════════════════════════════════════════════════
export const CLE_PUB_NON_RETIRES = 'vrm_stats_non_retires';
const cents = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100));

// Un achat, compact. `remb` : { etat: 'rembourse' | 'partiel' | 'attente' | 'aucun', montant } (src/coutAchatNet.js) ;
// `nonReclame` : prouvé par l'appelant (statut, transaction, transporteur) ; `auPoint` : la règle « chez moi » le dit au point ;
// `limiteAt` : la date limite de garde LUE ; `pointAt` / `retireAt` : lues (ligneAchat).
export function ligneNonRetire({ t = '', nom = '', payeAt = null, pointAt = null, retireAt = null, nonReclame = false, auPoint = false, point = '', limiteAt = null, prix = null, remb = null } = {}) {
  const r = remb && typeof remb === 'object' ? remb : null;
  const etat = r && ['rembourse', 'partiel', 'attente'].includes(r.etat) ? r.etat : null;
  return { t: t || '', nom: nom || '', p: ms(payeAt), pt: ms(pointAt), rt: ms(retireAt), nr: nonReclame ? 1 : 0, ap: auPoint && !nonReclame ? 1 : 0,
    pn: String(point || '').slice(0, 60), lim: ms(limiteAt), c: cents(prix), re: etat, rc: etat === 'rembourse' ? (cents(r.montant) ?? cents(prix)) : etat === 'partiel' ? cents(r.montant) : null };
}

// `achats` : les lignes `ligneNonRetire` (ou null = pas su) ; `de`, `a` : la fenêtre (ms), ou null pour « tout ».
export function statsNonRetires({ achats = null, de = null, a = null, maintenant = Date.now() } = {}) {
  if (!Array.isArray(achats)) return null;
  const dans = (x) => (de == null && a == null) || (x.p != null && x.p >= de && x.p < a);
  const F = achats.filter(dans);
  const NR = F.filter((x) => x.nr);
  const total = F.length;
  // L'argent : payé (lu, « sur N »), remboursé (lu), pas encore remboursé (en attente), pas su.
  const payes = NR.filter((x) => x.c != null);
  const remb = NR.filter((x) => x.re === 'rembourse' || x.re === 'partiel');
  const attente = NR.filter((x) => x.re === 'attente');
  const pasSu = NR.filter((x) => !x.re);
  const somme = (L, k) => L.reduce((t, x) => t + (x[k] || 0), 0);
  const argent = {
    paye: { c: payes.length ? somme(payes, 'c') : null, connus: payes.length, sur: NR.length },
    rembourse: { c: remb.length ? remb.reduce((t, x) => t + (x.rc != null ? x.rc : 0), 0) : null, n: remb.length },
    attente: { n: attente.length, c: attente.some((x) => x.c != null) ? somme(attente.filter((x) => x.c != null), 'c') : null },
    pasSu: pasSu.length,
  };
  // Par transporteur : non réclamés sur SES colis de la période.
  const parT = new Map();
  for (const x of F) { const k = x.t || 'pas-lu'; if (!parT.has(k)) parT.set(k, { cle: k, nom: nomDe(k, [{ nom: x.nom }]), total: 0, n: 0 }); const e = parT.get(k); e.total++; if (x.nr) e.n++; }
  const transporteurs = [...parT.values()].filter((e) => e.n > 0).map((e) => ({ ...e, part: e.total ? Math.round((e.n / e.total) * 100) : 0 }))
    .sort((x, y) => y.n - x.n || (x.nom < y.nom ? -1 : 1));
  const parP = new Map();
  for (const x of NR) { if (!x.pn) continue; parP.set(x.pn, (parP.get(x.pn) || 0) + 1); }
  const points = [...parP.entries()].map(([nom, n]) => ({ nom, n })).sort((x, y) => y.n - x.n || (x.nom < y.nom ? -1 : 1)).slice(0, 5);
  // Le délai qu'il avait : de l'arrivée au point à la date limite de garde, LUES toutes les deux.
  const garde = delai(NR.map((x) => [x.pt, x.lim]));
  // En cours : au point maintenant (toute date de paiement), depuis N jours ; le risque sur la limite LUE.
  const enCours = achats.filter((x) => x.ap).map((x) => {
    const depuis = x.pt != null ? Math.max(0, Math.floor((maintenant - x.pt) / JOUR)) : null;
    const reste = x.lim != null ? Math.floor((x.lim - maintenant) / JOUR) : null;
    const risque = reste == null ? null : reste < 0 ? 'depasse' : reste <= 1 ? 'proche' : 'ok';
    return { t: x.t, nom: nomDe(x.t || 'pas-lu', [{ nom: x.nom }]), point: x.pn, depuis, reste, risque };
  }).sort((x, y) => ((x.reste ?? 1e9) - (y.reste ?? 1e9)) || ((y.depuis ?? -1) - (x.depuis ?? -1)));
  return { total, n: NR.length, part: total ? Math.round((NR.length / total) * 100) : null, argent, transporteurs, points, garde, enCours,
    sansDate: de == null && a == null ? 0 : achats.filter((x) => x.p == null).length };
}
