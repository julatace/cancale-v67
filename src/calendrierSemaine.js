// ════════════════════════════════════════════════════════════════════════════
//  LA SEMAINE DES COLIS, JOUR PAR JOUR (23 nov., lot calendrier-semaine — validé par Julien)
//  « Vue jour par jour des colis à envoyer, retraits et leurs dates limites LUES (estimations marquées comme telles) ;
//  touche ⇒ fiche. »
//
//  AUCUNE RÈGLE NEUVE (§5 : une règle, un propriétaire) — ce module RANGE par jour ce que les écrans propriétaires ont
//  PUBLIÉ, avec leurs règles :
//    · À ENVOYER = `vrm_colis_aposter.liste` (l'écran Colis / Ma journée : `limiteExpedition`,
//      api/_lib/limite-envoi.js) — la date limite LUE dans l'e-mail du bordereau (heure de Paris), sinon l'ESTIMATION
//      vente + 7 j (`estimee`), dite « estimée », jamais « en retard » ; une estimation passée n'est PAS un retard
//      (« estimation passée ») ; `retard` vient de la règle (une limite lue et dépassée), jamais d'ici ;
//    · À RETIRER = `vrm_colis_retirer.colis` (la règle de « À retirer », api/_lib/retrait-colis.js) — la date limite
//      LUE ([0], ou le jour de [6] `limiteAt`, Vinted Go), sinon `limiteEstimee` (arrivée + la garde MESURÉE de SON
//      transporteur, seulement un transporteur connu), sinon « date limite inconnue » (jamais une garde prêtée) ;
//    · le JOUR est celui de PARIS (`jourDe`), la semaine = aujourd'hui + 6 jours ; au-delà ⇒ « plus tard » (compté).
//  « Pas su » (§5) : une publication absente ⇒ cette moitié est `null` (l'écran dit « — » et pourquoi), jamais une
//  semaine vide. Les autres sites à envoyer (eBay, Leboncoin, Vestiaire) n'ont pas de liste datée publiée : leur NOMBRE
//  est rendu (`autres`), dit « sans date ici », jamais rangé un jour inventé.
//  Identité : un colis à envoyer porte SON N° (celui de la fiche, ou le tampon de son lot) — c'est lui qui ouvre la
//  fiche ; sans N°, le toucher ouvre Colis. Aucun titre ne relie rien.
//  Module PUR. Exécuté par scripts/audit-calendrier-semaine.cjs.
// ════════════════════════════════════════════════════════════════════════════
import { jourParis as jourDe, limiteEstimee } from '../api/_lib/retrait-colis.js';
import { plusJours } from '../api/_lib/bilan-semaine.js';

export const JOURS_SEMAINE = 7;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const str = (v) => String(v == null ? '' : v).trim();
const msIso = (v) => { if (!v) return null; const t = Date.parse(String(v)); return Number.isFinite(t) ? t : null; };

// Un colis à envoyer de la publication ⇒ { sorte, num, nom, jour, heure, estimee, retard } | null (rien de daté).
export function envoiDe(x) {
  if (!x || typeof x !== 'object') return null;
  const jour = ISO.test(str(x.jour)) ? str(x.jour) : '';
  return { sorte: 'envoi', num: str(x.num).slice(0, 12), nom: str(x.nom).slice(0, 60), jour, heure: /^\d{2}:\d{2}$/.test(str(x.heure)) ? str(x.heure) : '',
    estimee: !!x.estimee, retard: !!x.retard && !x.estimee };
}
// Un colis à retirer de la publication (tuple [limite, arriveeMs, transporteur, identité, sûre, n°, limiteAt, nom]).
export function retraitDe(c) {
  if (!Array.isArray(c)) return null;
  const at = msIso(typeof c[6] === 'string' ? c[6] : '');
  const lue = ISO.test(str(c[0])) ? str(c[0]) : (at != null ? jourDe(at) : '');
  const transporteur = str(c[2]);
  let jour = lue, estimee = false;
  if (!jour) { const e = limiteEstimee({ arriveeMs: Number(c[1]) || null, transporteur }); if (e) { jour = e.jour; estimee = true; } }
  return { sorte: 'retrait', id: str(c[3]), nom: str(c[7]).replace(/\s+/g, ' ').slice(0, 60), transporteur, jour, estimee,
    heure: lue && at != null && jourDe(at) === lue ? new Date(at).toISOString() : '' };
}

// LA SEMAINE. `aposter` : `vrm_colis_aposter` | null ; `retirer` : `vrm_colis_retirer` | null.
// Rend { jours: [{ jour, aujourdhui, envois, retraits }] × 7, avant: { envois, retraits }, plusTard: { envois, retraits },
//        sansDate: { envois, retraits }, autres: { ebay, leboncoin, vestiaire } | null, pasSu: { envois, retraits }, at }.
export function calendrierSemaine({ aposter = null, retirer = null, maintenant = Date.now() } = {}) {
  const auj = jourDe(maintenant);
  const jours = Array.from({ length: JOURS_SEMAINE }, (_, i) => ({ jour: plusJours(auj, i), aujourdhui: i === 0, envois: [], retraits: [] }));
  const parJour = new Map(jours.map((j) => [j.jour, j]));
  const fin = plusJours(auj, JOURS_SEMAINE - 1);
  const avant = { envois: [], retraits: [] }, plusTard = { envois: [], retraits: [] }, sansDate = { envois: [], retraits: [] };
  const ranger = (x, cle) => {
    if (!x.jour) { sansDate[cle].push(x); return; }
    if (x.jour < auj) { avant[cle].push(x); return; }
    if (x.jour > fin) { plusTard[cle].push(x); return; }
    parJour.get(x.jour)[cle].push(x);
  };
  const envoisLus = aposter && typeof aposter === 'object' && Array.isArray(aposter.liste);
  if (envoisLus) for (const x of aposter.liste) { const e = envoiDe(x); if (e) ranger(e, 'envois'); }
  const retraitsLus = retirer && typeof retirer === 'object' && Array.isArray(retirer.colis);
  if (retraitsLus) for (const c of retirer.colis) { const r = retraitDe(c); if (r) ranger(r, 'retraits'); }
  const tri = (a, b) => (a.jour || '9').localeCompare(b.jour || '9') || (a.estimee - b.estimee) || (a.heure || '99').localeCompare(b.heure || '99') || a.nom.localeCompare(b.nom, 'fr');
  for (const j of jours) { j.envois.sort(tri); j.retraits.sort(tri); }
  for (const g of [avant, plusTard, sansDate]) { g.envois.sort(tri); g.retraits.sort(tri); }
  const n = (v) => (Number.isFinite(v) && v >= 0 ? v : null);
  return {
    jours, avant, plusTard, sansDate,
    autres: envoisLus ? { ebay: n(aposter.ebay), leboncoin: n(aposter.leboncoin), vestiaire: n(aposter.vestiaire) } : null,
    pasSu: { envois: !envoisLus, retraits: !retraitsLus },
    at: { envois: envoisLus && Number.isFinite(aposter.at) ? aposter.at : null, retraits: retraitsLus && Number.isFinite(retirer.at) ? retirer.at : null },
  };
}
