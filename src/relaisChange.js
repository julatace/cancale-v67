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
export function colisRelaisChange(lignes, { maintenant = Date.now(), jours = JOURS_RELAIS_CHANGE } = {}) {
  if (!Array.isArray(lignes)) return null;
  const finis = new Set();
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
    vus.add(n);
    const lieu = String(t.lieu || '').trim();
    out.push({ suivi: n, carrier: t.carrier || '', lieu, ancienLieu: String(t.ancienLieu || '').trim(), ...nomEtAdresse(lieu), at });
  }
  return out.sort((a, b) => (b.at || 0) - (a.at || 0));
}
