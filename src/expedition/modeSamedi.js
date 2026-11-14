// ════════════════════════════════════════════════════════════════════════════
//  IDÉE 163 — LE MODE « SAMEDI » : LA JOURNÉE D'ENVOI SUR UN SEUL ÉCRAN (14 nov.)
// ════════════════════════════════════════════════════════════════════════════
//  Tout à imprimer (le parcours d'impression simple, inchangé), tout à emballer (cases), les
//  points relais de dépôt et de retrait dans un ordre de trajet simple, et l'heure limite de
//  chaque point aujourd'hui. Règles PURES ici ; l'écran : `ModeSamedi.jsx`.
//
//  ⚠️ RIEN N'EST AUTOMATIQUE : chaque coche est SON toucher. « Emballé » est un aide-mémoire
//  sur l'appareil (la journée d'aujourd'hui) ; « Déposé » est le geste existant « Colis fait »
//  (annulable 5 s) ; rien d'autre n'est écrit.
//  ⚠️ TRAJET SANS SERVICE PAYANT : distance à vol d'oiseau depuis la ville réglée
//  (`vrm_ville`), le plus proche d'abord puis le plus proche du précédent. Un point sans
//  position connue va à la fin, « distance inconnue » — jamais une position devinée.
//  ⚠️ OÙ DÉPOSER : Vinted ne fixe pas le point de dépôt (tout point du transporteur prend le
//  colis). VRM propose LE plus proche parmi les points que Vinted a listés pour ce
//  transporteur (`nearby_drop_off_points`, capté par l'extension) ; aucun lu ⇒ « n'importe quel
//  point {transporteur} », sans adresse inventée.
//  ⚠️ HEURE LIMITE : celle des horaires LUS (Vinted pour ses points de dépôt, l'e-mail ou
//  Mondial Relay pour un retrait, api/_lib/horaires-relais.js) ; sinon « horaires inconnus ».
// ════════════════════════════════════════════════════════════════════════════
import { horairesValides, momentParis } from '../../api/_lib/horaires-relais.js';
import { cleTransporteur } from '../transporteursVisuels.js';

const JOURS_VINTED = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7 };
const HH = /^([01]\d|2[0-4]):([0-5]\d)$/;
// Les horaires que Vinted donne pour un point de dépôt (`business_hours`, mesuré le 14 nov. :
// [{ weekday: 'monday', hours: [{ opens_at_raw: '09:00', closes_at_raw: '12:00' }, …] }]) ⇒ la
// forme commune [{ jours, plages }], ou null (forme inconnue, un jour dit deux fois…).
export function horairesDeVinted(bh) {
  if (!Array.isArray(bh) || !bh.length) return null;
  const out = [];
  for (const e of bh) {
    const j = e && JOURS_VINTED[String(e.weekday || '').toLowerCase()];
    if (!j || !Array.isArray(e.hours)) return null;
    const plages = [];
    for (const p of e.hours) {
      const de = String((p && p.opens_at_raw) || ''), a = String((p && p.closes_at_raw) || '');
      if (!HH.test(de) || !HH.test(a)) return null;
      plages.push({ de, a: a === '00:00' ? '24:00' : a });
    }
    // Des plages qui se touchent (09:00–12:00 puis 12:00–19:30) n'en font qu'une.
    plages.sort((x, y) => (x.de < y.de ? -1 : 1));
    const fondues = [];
    for (const p of plages) { const d = fondues[fondues.length - 1]; if (d && p.de <= d.a) { if (p.a > d.a) d.a = p.a; } else fondues.push({ ...p }); }
    out.push({ jours: [j], plages: fondues });
  }
  return horairesValides(out);
}

const enMin = (x) => { const [H, M] = String(x).split(':').map(Number); return H * 60 + M; };
// L'heure limite d'un point AUJOURD'HUI (à Paris) :
//   { etat: 'inconnu' } · { etat: 'ferme' } (fermé tout le jour) ·
//   { etat: 'ouvert', fermeA, maintenant: true|false, passe: false } · { etat: 'passe', fermeA } (déjà fermé pour la journée).
export function limiteDuJour(h0, ms = Date.now()) {
  const h = horairesValides(h0); const m = momentParis(ms);
  if (!h || !m) return { etat: 'inconnu' };
  const e = h.find((x) => x.jours.includes(m.jour));
  if (!e) return { etat: 'inconnu' };                       // ce jour-là pas dit : pas su
  if (!e.plages.length) return { etat: 'ferme' };
  const derniere = e.plages[e.plages.length - 1];
  if (m.min >= enMin(derniere.a)) return { etat: 'passe', fermeA: derniere.a };
  const dedans = e.plages.some((p) => enMin(p.de) <= m.min && m.min < enMin(p.a));
  return { etat: 'ouvert', fermeA: derniere.a, maintenant: dedans };
}

// Distance à vol d'oiseau (km).
export function distanceKm(a, b) {
  if (!a || !b || !Number.isFinite(+a.lat) || !Number.isFinite(+a.lon) || !Number.isFinite(+b.lat) || !Number.isFinite(+b.lon)) return null;
  const R = 6371, rad = Math.PI / 180;
  const dLa = (b.lat - a.lat) * rad, dLo = (b.lon - a.lon) * rad;
  const s = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
const aPosition = (p) => !!(p && Number.isFinite(+p.lat) && Number.isFinite(+p.lon) && !(+p.lat === 0 && +p.lon === 0));

// L'ORDRE DU TRAJET : depuis `depart` (la ville réglée), le plus proche, puis le plus proche du
// précédent. Sans départ connu : l'ordre des distances que la plateforme a données (`km`), sinon
// l'ordre reçu. Chaque point reçoit `km` (depuis le précédent, ou depuis le départ) et `rang`.
export function ordreTrajet(depart, points) {
  const L = (points || []).filter(Boolean);
  const avec = L.filter(aPosition), sans = L.filter((p) => !aPosition(p));
  const out = [];
  if (aPosition(depart)) {
    let ici = depart; const reste = [...avec];
    while (reste.length) {
      let bi = 0, bd = Infinity;
      reste.forEach((p, i) => { const d = distanceKm(ici, p); if (d < bd) { bd = d; bi = i; } });
      const p = reste.splice(bi, 1)[0];
      out.push({ ...p, km: bd, depuis: out.length ? 'precedent' : 'depart' });
      ici = p;
    }
  } else {
    [...avec].sort((a, b) => (Number.isFinite(a.kmLu) ? a.kmLu : 1e9) - (Number.isFinite(b.kmLu) ? b.kmLu : 1e9))
      .forEach((p) => out.push({ ...p, km: Number.isFinite(p.kmLu) ? p.kmLu : null, depuis: Number.isFinite(p.kmLu) ? 'plateforme' : '' }));
  }
  for (const p of sans) out.push({ ...p, km: Number.isFinite(p.kmLu) ? p.kmLu : null, depuis: Number.isFinite(p.kmLu) ? 'plateforme' : '' });
  return out.map((p, i) => ({ ...p, rang: i + 1 }));
}

// Le transporteur d'un point de dépôt Vinted (« Shop2Shop by Chronopost », « Colissimo (LaPoste) »…), la clé commune.
export const cleDuPointVinted = (nomTransporteur) => cleTransporteur(nomTransporteur) || '';

// LES POINTS DE LA JOURNÉE.
//  · `colis` (à déposer) : [{ cle, trCle, transporteur }] — groupés par transporteur ;
//  · `depots` : les points que Vinted a listés [{ carrier, points: [{ code, nom, adresse, km, lat, lon, horaires }] }] ;
//  · `retraits` : [{ cle, lieu, adresse, horaires }] — groupés par lieu (le nom ET l'adresse lus, égaux) ;
//  · `depart` : { lat, lon } de la ville réglée, ou null.
export function pointsDuJour({ colis = [], depots = [], retraits = [], depart = null } = {}) {
  const parTr = new Map();
  for (const c of colis) {
    if (!c || !c.cle) continue;
    const k = c.trCle || '';
    if (!parTr.has(k)) parTr.set(k, { trCle: k, transporteur: c.transporteur || '', colis: [] });
    parTr.get(k).colis.push(c.cle);
  }
  const candidats = [];
  for (const d of depots || []) { const k = cleDuPointVinted(d && d.carrier); for (const p of (d && d.points) || []) if (k && p && p.code) candidats.push({ ...p, trCle: k }); }
  const points = [];
  for (const g of parTr.values()) {
    const ceux = g.trCle ? candidats.filter((p) => p.trCle === g.trCle) : [];
    let choisi = null;
    if (ceux.length) {
      const dist = (p) => (aPosition(depart) && aPosition(p) ? distanceKm(depart, p) : Number.isFinite(p.km) ? p.km : Infinity);
      choisi = [...ceux].sort((a, b) => dist(a) - dist(b))[0];
    }
    points.push({ cle: `depot:${g.trCle || 'inconnu'}`, type: 'depot', trCle: g.trCle, transporteur: g.transporteur,
      nom: choisi ? choisi.nom : '', adresse: choisi ? choisi.adresse : '', code: choisi ? choisi.code : '',
      lat: choisi ? +choisi.lat : null, lon: choisi ? +choisi.lon : null, kmLu: choisi && Number.isFinite(choisi.km) ? choisi.km : null,
      horaires: choisi ? horairesValides(choisi.horaires) : null, propose: !!choisi, colis: g.colis });
  }
  const parLieu = new Map();
  for (const r of retraits || []) {
    if (!r || !r.cle) continue;
    const k = `${String(r.lieu || '').trim().toLowerCase()}|${String(r.adresse || '').trim().toLowerCase()}`;
    if (!parLieu.has(k)) parLieu.set(k, { cle: `retrait:${k}`, type: 'retrait', nom: r.lieu || '', adresse: r.adresse || '', lat: Number.isFinite(+r.lat) ? +r.lat : null, lon: Number.isFinite(+r.lon) ? +r.lon : null, horaires: null, colis: [] });
    const g = parLieu.get(k);
    g.colis.push(r.cle);
    const h = horairesValides(r.horaires); if (h && !g.horaires) g.horaires = h;
  }
  return ordreTrajet(depart, [...points, ...parLieu.values()]);
}

// La journée d'aujourd'hui (à Paris) : la clé des cases « Emballé » (elles repartent à vide chaque jour).
export function jourParis(ms = Date.now()) {
  try { return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)); } catch (_) { return new Date(ms).toISOString().slice(0, 10); }
}
export const CLE_EMBALLES = 'vrm_samedi_emballes';
// Les cases lues : celles du jour seulement ; une valeur étrange ⇒ aucune case cochée.
export function emballesDuJour(brut, jour) {
  if (!brut || typeof brut !== 'object' || brut.jour !== jour || !brut.cles || typeof brut.cles !== 'object') return {};
  const out = {}; for (const [k, v] of Object.entries(brut.cles)) if (v === true) out[k] = true; return out;
}
export const basculerEmballe = (cases, cle) => { const u = { ...(cases || {}) }; if (u[cle]) delete u[cle]; else u[cle] = true; return u; };
