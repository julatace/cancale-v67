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
