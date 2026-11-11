// ════════════════════════════════════════════════════════════════════════════
//  POINT RELAIS CHANGÉ (10 nov.)
//  Julien, sur l'e-mail Mondial Relay « Votre colis a changé de plan » (le point
//  prévu est indisponible, le colis part vers un autre) : « Regarde le colis a pas
//  été livré c'est pas bon ». Le serveur range maintenant cet e-mail EN ROUTE, avec
//  le NOUVEAU point lu dans l'e-mail (api/email-inbound.js, `relaisChange`, `lieu`) ;
//  la relecture d'une ligne rangée avant corrige l'état (api/_lib/suivi-colis.js).
//
//  Ici : la liste de ces colis pour l'alerte AMBRE (un geste à faire : aller à un
//  autre endroit, §7) — le nouveau point tel qu'il est LU (jamais deviné), et
//  le lien d'itinéraire vers cette adresse.
//  ⚠️ Identité : le n° de suivi. Un autre e-mail du même n° qui dit le colis
//  arrivé, retiré ou reparti l'emporte (la ligne n'est plus « en route »).
// ════════════════════════════════════════════════════════════════════════════
import { normaliserSuivi } from '../api/_lib/etat-colis-email.js';

export const JOURS_RELAIS_CHANGE = 21;   // au-delà, l'alerte n'a plus de sens (le colis est arrivé ou reparti)

const codeOk = (c) => /^[A-Z0-9]{4,10}$/i.test(String(c || '').trim()) && /\d/.test(String(c || ''));
const msDe = (v) => { const t = Date.parse(String(v || '')); return Number.isFinite(t) ? t : null; };

// « INTERMARCHE, 4 AVENUE …, 35350 VILLE » ⇒ { nom, adresse } (le nom = la 1re partie lue).
export function nomEtAdresse(lieu) {
  const p = String(lieu || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!p.length) return { nom: '', adresse: '' };
  if (p.length === 1) return { nom: p[0], adresse: '' };
  return { nom: p[0], adresse: p.slice(1).join(', ') };
}

// Le lien d'itinéraire vers l'adresse LUE : Plans sur un appareil Apple, Google Maps ailleurs.
export function lienItineraire(lieu, apple = false) {
  const q = encodeURIComponent(String(lieu || '').trim());
  if (!q) return '';
  return apple ? `https://maps.apple.com/?daddr=${q}&dirflg=d` : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

export const appareilApple = () => {
  try { return /iPhone|iPad|iPod|Macintosh/.test(String((typeof navigator !== 'undefined' && navigator.userAgent) || '')); } catch (_) { return false; }
};

// Les colis redirigés, encore en route : [{ suivi, carrier, lieu, ancienLieu, nom, adresse, at }].
// `lignes` : les lignes de suivi déjà relues (`relireLigneSuivi`). `null` (pas su) ⇒ `null`.
// (10 nov., retraits irréprochables) `transp` : Map(n° → lecture chez le transporteur). Un n° que le
// TRANSPORTEUR dit arrivé (disponible), retiré ou reparti n'est plus « en route » : mesuré au banc, le
// colis redirigé et disponible était À RETIRER ET annoncé « pas encore arrivé » sur le même écran.
const ETATS_ARRIVE = new Set(['disponible', 'retire', 'retour_expediteur']);
export function colisRelaisChange(lignes, { maintenant = Date.now(), jours = JOURS_RELAIS_CHANGE, transp = null } = {}) {
  if (!Array.isArray(lignes)) return null;
  const finis = new Set();
  // …par un événement daté APRÈS l'e-mail du changement (une lecture plus ancienne ne dit rien du nouveau point).
  const arriveApres = (n, ligneMs) => {
    const t = transp && typeof transp.get === 'function' ? transp.get(n) : null;
    if (!t || !ETATS_ARRIVE.has(t.etat)) return false;
    const e = msDe(t.etatAt);
    return e != null && (ligneMs == null || e > ligneMs);
  };
  for (const t of lignes) {
    if (!t) continue;
    const n = normaliserSuivi(t.suivi);
    if (n && ['available', 'delivered', 'retour'].includes(t.status)) finis.add(n);
  }
  const vus = new Set();
  const out = [];
  for (const t of lignes) {
    if (!t || !t.relaisChange || t.status !== 'transit' || t.sens === 'sortant') continue;
    const n = normaliserSuivi(t.suivi);
    if (!n || finis.has(n) || vus.has(n)) continue;
    const at = msDe(t.emailAt) || msDe(t.receivedAt);
    if (at != null && maintenant - at > jours * 86400000) continue;
    if (arriveApres(n, at)) continue;
    vus.add(n);
    const lieu = String(t.lieu || '').trim();
    // (11 nov., retraits fiables — Julien : « ceux qui ont changé de point relais… tu ne donnes pas les
    // codes ») LE CODE DE CE COLIS, PAR SON N° : celui de l'e-mail du changement, sinon le plus récent des
    // autres e-mails / SMS du MÊME n° (une identité) ; aucun ⇒ '' (« code pas encore reçu »).
    // (11 nov., intégration colis — arbitrage d) Le code d'un AUTRE e-mail ne vaut que s'il est daté APRÈS le changement de
    // point (un code d'avant pouvait être celui de l'ancien point) ; un code plus ancien, ou sans date, ⇒ « à confirmer »,
    // jamais montré comme le bon.
    const dateDe = (x) => msDe(x.emailAt) || msDe(x.receivedAt);
    const avecCode = lignes.filter((x) => x && x !== t && normaliserSuivi(x.suivi) === n && codeOk(x.code))
      .sort((a, b) => (dateDe(b) || 0) - (dateDe(a) || 0));
    const apres = avecCode.filter((x) => at != null && dateDe(x) != null && dateDe(x) > at);
    const code = codeOk(t.code) ? String(t.code).trim() : (apres[0] ? String(apres[0].code).trim() : '');
    const codeDe = codeOk(t.code) ? 'changement' : code ? 'autre-email' : avecCode.length ? 'a-confirmer' : '';
    out.push({ suivi: n, carrier: t.carrier || '', lieu, ancienLieu: String(t.ancienLieu || '').trim(), ...nomEtAdresse(lieu), at, code, codeDe });
  }
  return out.sort((a, b) => (b.at || 0) - (a.at || 0));
}
