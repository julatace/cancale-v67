// ════════════════════════════════════════════════════════════════════════════
//  LE COLIS D'UN RETOUR QUI REVIENT CHEZ TOI — PAR IDENTITÉ (21 nov., lot 77 « Suivi des retours »)
// ════════════════════════════════════════════════════════════════════════════
// Julien (21 nov., choix 77) : pour chaque retour accepté, le n° de suivi du colis RETOUR et son transporteur,
// les étapes du colis qui revient (« Retour accepté · Expédié par l'acheteur · En transit · Arrivé chez toi / au
// point »), le code de retrait s'il revient en point relais ; quand l'arrivée est PROUVÉE, « Remettre en ligne ».
//
// MESURÉ (lecture seule, sa base, 21 nov.) :
//   · les 9 ventes en retour (transaction 440, `user_side: seller`) n'ont AUCUN n° de suivi en base : la transaction
//     ne porte que `shipment { id, status, status_title, status_updated_at }` — et ce `shipment` est déjà celui du
//     RETOUR (230 « Bordereau envoyé au vendeur », 310 « colis déposé… » alors que la vente avait été livrée) ;
//   · aucune ligne `harvest_{uid}_suivi_{tx}` pour une vente (l'extension ne lisait le suivi que des ACHATS) ;
//   · aucun e-mail « retour » ne porte de transaction : les seuls e-mails de retour sont ceux d'un ACHAT qu'il
//     renvoie (« Bordereau de retour », « Retourne ta commande ») — l'autre sens (api/_lib/retour-suivi.js).
// Donc le n° vient de la lecture de l'extension (5.431.0, `capterSuivisRetours`) : le suivi que Vinted montre de
// CETTE transaction en retour (`/transactions/{tx}/shipment/journey_summary`), rangé dans `harvest_{uid}_retour_{tx}`.
//
// LA RÈGLE (une, l'app ET le serveur — `api/_lib/retour-vente-notif.js` importe CE fichier) :
//   · LE N° DU RETOUR. La ligne lue est celle du RETOUR seulement si (a) AUCUN de ses n° n'est un n° de l'ALLER (le
//     bordereau de CETTE vente, par SA transaction) — un n° de l'aller prouve que Vinted montre encore le colis
//     d'origine : rien n'est pris (« suivi pas encore lu ») — et (b) l'aller est connu OU une étape est datée APRÈS le
//     début du retour (`retourLe`, la date que Vinted a posée en passant la transaction à 440). Ni l'un ni l'autre ⇒
//     rien (mieux vaut un blanc qu'un faux) ;
//   · un n° porté par DEUX retours ⇒ ni l'un ni l'autre (`partages`) ;
//   · LES ÉTAPES : celles de la ligne lue datées après le début du retour (toutes si l'aller est connu et disjoint et le
//     début inconnu), les e-mails du transporteur du MÊME n° (égalité exacte), l'état Vinted de la transaction
//     (« déposé » ⇒ expédié par l'acheteur). Le plus avancé gagne ;
//   · « ARRIVÉ » SE PROUVE : une étape « livré / retiré » du transporteur (Vinted ou e-mail, même n°) — ou SON toucher
//     « Reçu » (le caller). Jamais par absence, jamais « Vinted dit livrée » seul (ambigu, retoursStock.js) ;
//   · AU POINT : une étape « disponible » ; le code, le lieu et la date limite LUS dans l'e-mail du même n° (jamais
//     fabriqués).
// PUR (aucune lecture, aucune horloge) : l'app, le serveur et `scripts/audit-retours-suivi.cjs` exécutent CES fonctions.
import { etatColisDepuisTexte, normaliserSuivi } from './etat-colis-email.js';

const str = (v) => String(v == null ? '' : v);
const msDe = (v) => { const t = Date.parse(str(v)); return Number.isFinite(t) ? t : null; };
const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());

export const ETAPES_RETOUR_VENTE = Object.freeze(['accepte', 'expedie', 'transit', 'point', 'arrive']);
const RANG = { accepte: 0, expedie: 1, transit: 2, point: 3, arrive: 4 };
// L'identifiant de la ligne rangée par l'extension (5.431.0) pour une vente en retour de CE compte.
export const idLigneRetour = (uid, tx) => `harvest_${uid}_retour_${tx}`;
export const RE_LIGNE_RETOUR = /^harvest_(\d+)_retour_(\d{4,20})$/;

// Les n° d'une ligne lue (`suivi`, `suiviCourant`, `suivisVinted` en liste « a,b »), normalisés, sans doublon.
export function numerosDeLigne(lu) {
  if (!lu || typeof lu !== 'object') return [];
  const brut = [lu.sc, lu.suiviCourant, lu.suivi, ...str(lu.sv != null ? lu.sv : lu.suivisVinted).split(',')];
  const out = [];
  for (const x of brut) { const n = normaliserSuivi(x); if (n && /^[A-Z0-9]{6,40}$/.test(n) && !out.includes(n)) out.push(n); }
  return out;
}

// La classe d'un texte d'étape : 'transit' · 'point' · 'arrive' · null (rien de constaté).
export function classeEtape(t) {
  const c = etatColisDepuisTexte(str(t));
  return c === 'available' ? 'point' : c === 'delivered' ? 'arrive' : c === 'transit' ? 'transit' : null;
}
const CLASSE_EMAIL = { transit: 'transit', available: 'point', delivered: 'arrive' };

// LE N° DU RETOUR (identité) : { numeros, suivi, raison } — raison : 'lu' · 'pas-de-ligne' · 'aller' (la ligne montre
// encore le colis d'origine) · 'pas-prouve' (ni aller connu, ni étape après le début du retour) · 'sans-numero' · 'partage'.
// (22 nov., ext. 5.435) `explicite` : le n° vient d'un champ que le SITE nomme « retour » (Leboncoin, Vestiaire, eBay — jamais
// le résumé de trajet Vinted, ambigu) ; l'égalité avec un n° de l'aller reste refusée, mais la date n'est plus exigée.
export function numeroDuRetour({ lu = null, aller = [], retourLe = null, partages = null, explicite = false } = {}) {
  if (!lu || typeof lu !== 'object') return { numeros: [], suivi: '', raison: 'pas-de-ligne' };
  const A = new Set((Array.isArray(aller) ? aller : []).map(normaliserSuivi).filter(Boolean));
  const N = numerosDeLigne(lu);
  if (N.some((n) => A.has(n))) return { numeros: [], suivi: '', raison: 'aller' };
  const debut = msDe(retourLe);
  const apres = debut != null && (Array.isArray(lu.etapes) ? lu.etapes : []).some((e) => { const m = msDe(e && e.at); return m != null && m >= debut; });
  if (!A.size && !apres && explicite !== true) return { numeros: [], suivi: '', raison: 'pas-prouve' };
  const P = partages instanceof Set ? partages : new Set();
  const libres = N.filter((n) => !P.has(n));
  if (!libres.length) return { numeros: [], suivi: '', raison: N.length ? 'partage' : 'sans-numero' };
  const courant = normaliserSuivi(lu.sc != null ? lu.sc : lu.suiviCourant);
  return { numeros: libres, suivi: libres.includes(courant) ? courant : libres[0], raison: 'lu' };
}

// Les n° portés par PLUSIEURS retours (les lignes lues de tous les retours) : aucun des deux ne les prend.
export function numerosPartages(lignes) {
  const vus = new Map();
  for (const lu of lignes || []) for (const n of numerosDeLigne(lu)) vus.set(n, (vus.get(n) || 0) + 1);
  return new Set([...vus.entries()].filter(([, k]) => k > 1).map(([n]) => n));
}

// LE SUIVI D'UN RETOUR. Entrées :
//   ligne    { etape: 'initie'|'en-route'|'rembourse', retourLe, recu, recuLe } (la ligne de `retoursEnCours`) ;
//   lu       la ligne rangée (projection : suivi, sc, sv, transporteur, etapes [{ t, at }], rn, rc, rv, cap) ·
//            null (aucune ligne) · undefined (lecture en cours) ;
//   aller    les n° du colis d'ORIGINE de cette vente (son bordereau, par SA transaction) ;
//   track    les e-mails du transporteur (`email_track_*` : { suivi, status, receivedAt|emailAt, retireLe, code,
//            code2, lieu, limite, carrier }) ;
//   partages `numerosPartages(...)`.
// Rend { suivi, numeros, transporteur, raison, etape, at, source, etapes: [{ cle, fait, at }], arrive, arriveAt,
//        arriveSource: 'transporteur'|'email'|'toi'|null, point: { nom, adresse, code, code2, limite } | null }.
export function suiviRetourVente({ ligne = null, lu, aller = [], track = [], partages = null, explicite = false } = {}) {
  const l = ligne || {};
  const id = lu === undefined ? { numeros: [], suivi: '', raison: 'en-cours' } : numeroDuRetour({ lu, aller, retourLe: l.retourLe, partages, explicite });
  const faits = [{ etape: 'accepte', at: msDe(l.retourLe), source: 'vinted' }];
  if (l.etape === 'en-route' || l.etape === 'rembourse') faits.push({ etape: 'expedie', at: null, source: 'vinted' });
  let transporteur = '';
  let point = null;
  if (id.raison === 'lu') {
    transporteur = str(lu.transporteur).trim().slice(0, 60);
    const debut = msDe(l.retourLe);
    const A = new Set((Array.isArray(aller) ? aller : []).map(normaliserSuivi).filter(Boolean));
    for (const e of (Array.isArray(lu.etapes) ? lu.etapes : [])) {
      const m = msDe(e && e.at);
      if (debut != null ? !(m != null && m >= debut) : (!A.size && explicite !== true)) continue;
      const c = classeEtape(e && e.t);
      if (c) faits.push({ etape: c, at: m, source: 'transporteur' });
    }
    if (lu.rn) point = { nom: str(lu.rn).slice(0, 80), adresse: [lu.rr, [lu.rc, lu.rv].filter(Boolean).join(' ')].filter(Boolean).join(', ').slice(0, 160), code: '', code2: '', limite: '' };
    const K = new Set(id.numeros);
    for (const t of (Array.isArray(track) ? track : [])) {
      if (!t || !K.has(normaliserSuivi(t.suivi))) continue;
      const c = CLASSE_EMAIL[str(t.status)];
      if (!c) continue;
      const at = (c === 'arrive' ? msDe(t.retireLe) : null) ?? msDe(t.emailAt) ?? msDe(t.receivedAt);
      faits.push({ etape: c, at, source: 'email' });
      if (!transporteur && t.carrier) transporteur = str(t.carrier).slice(0, 60);
      if (c === 'point') point = { nom: str(t.lieu).slice(0, 120) || (point ? point.nom : ''), adresse: point ? point.adresse : '', code: str(t.code).trim().slice(0, 20), code2: str(t.code2).trim().slice(0, 20), limite: str(t.limite).slice(0, 10) };
    }
  }
  if (l.recu) faits.push({ etape: 'arrive', at: msDe(l.recuLe), source: 'toi' });
  // Le plus avancé gagne ; à rang égal, le plus récent (un fait daté avant un fait sans date).
  const haut = faits.reduce((a, b) => (RANG[b.etape] > RANG[a.etape] || (RANG[b.etape] === RANG[a.etape] && (b.at || 0) > (a.at || 0)) ? b : a));
  const rangHaut = RANG[haut.etape];
  const etapes = ETAPES_RETOUR_VENTE.map((cle) => {
    const f = faits.filter((x) => x.etape === cle && x.at != null).map((x) => x.at);
    return { cle, fait: RANG[cle] <= rangHaut, at: f.length ? iso(Math.min(...f)) : null };
  });
  const arrives = faits.filter((f) => f.etape === 'arrive');
  const preuve = arrives.find((f) => f.source === 'transporteur') || arrives.find((f) => f.source === 'email') || arrives[0] || null;
  return {
    suivi: id.suivi, numeros: id.numeros, transporteur, raison: id.raison,
    etape: haut.etape, at: iso(haut.at), source: haut.source, etapes,
    arrive: !!preuve, arriveAt: preuve ? iso(preuve.at) : null, arriveSource: preuve ? preuve.source : null,
    point: haut.etape === 'point' ? point : null,
  };
}

// Les retours qui ROULENT vers lui (expédié, en transit, au point — pas encore arrivés) : la ligne
// « Retours en route · N » (Ventes) et, pour ceux au point, Achats › À retirer.
export function retoursEnRoute(suivis) {
  const L = (suivis || []).filter((s) => s && !s.arrive && (s.etape === 'expedie' || s.etape === 'transit' || s.etape === 'point'));
  return { n: L.length, auPoint: L.filter((s) => s.etape === 'point').length };
}

// ════════════════════════════════════════════════════════════════════════════
//  (22 nov., ext. 5.435, Julien choix 2b) LEBONCOIN, VESTIAIRE, EBAY : LE MÊME SUIVI, PAR LA MÊME RÈGLE
// ════════════════════════════════════════════════════════════════════════════
// « Leboncoin et Vestiaire à égalité avec Vinted ». ⚠️ AUCUN RETOUR N'A ÉTÉ MESURÉ sur ces sites (21 nov. : « aucun retour
// n'est lu aujourd'hui »). L'extension 5.435 range ce que le site NOMME retour, sans rien deviner :
//   · Leboncoin : `lbc_ventes.ventes[tx].retour` = { suivi, transporteur, statut, at } — un objet du détail de la
//     transaction dont la CLÉ dit retour (`return`, `return_parcel`…), son n° sous une clé de suivi ; `retourForme` (les
//     chemins de clés, sans valeur) garde la forme vue la 1re fois ;
//   · Vestiaire : `vc_ventes.ventes[produit].retourVc` = { suivi, transporteur, statut, at } — l'étape de la frise vendeur
//     dont la clé dit retour (`buyerReturn`, `returnShipment`…) ;
//   · eBay : le retour Post-Order (`retoursEbay`) porte `suiviRetour` / `transporteurRetour` si eBay les donne
//     (`returnShipmentInfo.shipmentTracking`, documentation Post-Order — NON mesuré).
// Ces n° sont EXPLICITES (le site dit « retour ») : la règle `suiviRetourVente` s'applique avec `explicite` — un n° égal à
// celui de l'aller est toujours refusé, un n° porté par deux retours aussi ; « arrivé » se prouve pareil (transporteur ou
// e-mail du MÊME n°, ou SON toucher). Rien n'est lu ⇒ « suivi pas encore lu ».
export const SITES_RETOUR_AUTRES = Object.freeze(['leboncoin', 'vestiaire', 'ebay']);
// La ligne lue (forme de `suiviRetourVente`) d'une vente d'un autre site, et les n° de son ALLER. null = rien de lu.
export function retourDeVenteAutreSite(site, vente) {
  const v = vente && typeof vente === 'object' ? vente : null;
  if (!v || !SITES_RETOUR_AUTRES.includes(site)) return null;
  const r = site === 'leboncoin' ? v.retour : site === 'vestiaire' ? v.retourVc : { suivi: v.suiviRetour, transporteur: v.transporteurRetour, statut: v.statut, at: v.date };
  if (!r || typeof r !== 'object') return null;
  const n = normaliserSuivi(r.suivi);
  const aller = [];
  // L'aller Leboncoin : le n° du bordereau, lu dans l'adresse de suivi de SON étiquette (chaque valeur et le dernier morceau du
  // chemin qui ont la forme d'un n° — une liste d'EXCLUSION : en prendre trop n'écarte qu'un faux retour, jamais un vrai aller).
  if (site === 'leboncoin') { const lab = v.label && typeof v.label === 'object' ? v.label : {};
    try { const u = new URL(str(lab.trackingUrl)); for (const x of [...u.searchParams.values(), u.pathname.split('/').filter(Boolean).pop() || '']) if (/^[A-Za-z0-9]{8,40}$/.test(x)) aller.push(x); } catch (_) {}
    if (v.suivi) aller.push(v.suivi); }
  if (site === 'vestiaire' && v.suivi) aller.push(v.suivi);
  if (site === 'ebay' && Array.isArray(v.suivisAller)) aller.push(...v.suivisAller);
  const etapes = (Array.isArray(r.etapes) ? r.etapes : []).filter((e) => e && typeof e === 'object').slice(0, 30).map((e) => ({ t: str(e.t).slice(0, 120), at: str(e.at).slice(0, 40) }));
  if (!n && !etapes.length && !r.statut) return null;
  return { lu: { suivi: n, transporteur: str(r.transporteur).slice(0, 60), etapes }, aller, debut: str(r.at) || null, statut: str(r.statut).slice(0, 60) };
}
// LE SUIVI d'un retour Leboncoin / Vestiaire / eBay : `suiviRetourVente` sur la ligne lue, n° explicite.
//   ligne { etape, retourLe, recu, recuLe } (absente : « accepté » daté de la 1re fois que le retour a été vu) ;
//   track les e-mails du transporteur ; partages `numerosPartages` des lignes de TOUS les retours (tous sites).
export function suiviRetourAutreSite({ site, vente, ligne = null, track = [], partages = null } = {}) {
  const x = retourDeVenteAutreSite(site, vente);
  const l = Object.assign({ etape: 'initie', retourLe: x ? x.debut : null }, ligne || {});
  if (!x) return suiviRetourVente({ ligne: l, lu: null, aller: [], track, partages, explicite: true });
  return suiviRetourVente({ ligne: l, lu: x.lu, aller: x.aller, track, partages, explicite: true });
}
