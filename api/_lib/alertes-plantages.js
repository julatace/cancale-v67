// ═══════════════════════════════════════════════════════════════════════════
// L'ALERTE DE PLANTAGE, CÔTÉ SERVEUR (8 nov.) — la règle : src/alertesPlantages.js
// ═══════════════════════════════════════════════════════════════════════════
// Les événements arrivent avec le lot des temps réels (`/api/compte?mode=mesures`,
// un `sendBeacon` au plus par minute, jeton VÉRIFIÉ — api/_lib/mesures-terrain.js).
// Ici :
//   · repassés par `normaliserEvenements` (rien d'autre qu'écran/message/version/
//     nombre ne passe), ADDITIONNÉS dans la ligne du jour de Paris
//     `plantages_terrain_AAAA-MM-JJ` du PROPRIÉTAIRE de l'installation, par
//     comparer-et-échanger sur `data.rev` (4 essais) ; une lecture ratée n'écrit rien ;
//   · le nombre d'appareils se tient par l'EMPREINTE DU JOUR des temps réels
//     (HMAC du vendeur et du jour) : rien ne se relie d'un jour à l'autre ;
//   · UNE notification groupée par heure au plus : la ligne est écrite avec
//     `notifieA` AVANT d'envoyer (sinon la même repartirait au lot suivant) ;
//     pendant l'heure de repos, les nouveaux types ATTENDENT (le lot suivant
//     après l'heure, ou la veille du matin, les dit) ;
//   · GET (propriétaire) : les 7 derniers jours, sans empreinte.
// ═══════════════════════════════════════════════════════════════════════════
import { sbCle } from './cle.js';
import { normaliserEvenements, jourApresEvenements, alerteDue, apresNotification, texteAlerte, PREFIXE_TERRAIN } from '../../src/alertesPlantages.js';
import { jourParis } from '../../src/mesuresTerrain.js';
import { nomEcran } from './veille-plantages.js';
// (11 nov.) L'envoi passe par le journal des alertes de production : même
// regroupement à l'heure, interrupteur « Un écran plante », 30 jours.
import { signalerProduction } from './alertes-production.js';

async function direPlantages(enAttente, { proprio, env, fetcher, pousser, maintenant }) {
  const notif = texteAlerte(enAttente, nomEcran);
  if (!notif || !pousser) return false;
  const n = enAttente.reduce((a, t) => a + (Number(t.n) || 0), 0);
  const r = await signalerProduction({ proprio, env, fetcher, maintenant, pousser, signal: { type: 'plantage', cle: 'plantage', titre: notif.title, corps: notif.body, n, tag: 'vrm-alerte-plantages', compteur: false } });
  return !!(r && r.notifiees > 0);
}

const cfg = (env) => ({ url: env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co', service: env.SUPABASE_SERVICE_KEY || '' });
export const idTerrain = (jour) => PREFIXE_TERRAIN + jour;
const ESSAIS = 4;
export const JOURS_PANNEAU = 7;

async function lireLigne(env, fetcher, proprio, id) {
  const { url, service } = cfg(env);
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?owner=eq.${proprio}&id=eq.${id}&select=data&limit=1`, { headers: sbCle(service) });
    if (!r.ok) return undefined;
    const j = await r.json().catch(() => null);
    if (!Array.isArray(j)) return undefined;
    return j[0] && j[0].data && typeof j[0].data === 'object' ? j[0].data : null;
  } catch (_) { return undefined; }
}
// Écrit `data` à la place de `avant` (insertion si absente, sinon PATCH conditionnel).
// true · false (devancé) · undefined (la base n'a pas confirmé).
async function ecrireCas(env, fetcher, proprio, id, avant, data, maintenant) {
  const { url, service } = cfg(env);
  const at = new Date(maintenant).toISOString();
  let rep;
  try {
    rep = avant === null
      ? await fetcher(`${url}/rest/v1/app_data?on_conflict=owner,id`, { method: 'POST', headers: { ...sbCle(service), 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify([{ owner: proprio, id, data, updated_at: at }]) })
      : await fetcher(`${url}/rest/v1/app_data?owner=eq.${proprio}&id=eq.${id}&data->>rev=${Number.isSafeInteger(avant.rev) ? 'eq.' + avant.rev : 'is.null'}`, { method: 'PATCH', headers: { ...sbCle(service), 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ data, updated_at: at }) });
  } catch (_) { return undefined; }
  if (!rep.ok) return undefined;
  const j = await rep.json().catch(() => null);
  if (!Array.isArray(j)) return undefined;
  return j.length === 1;
}

// Range les événements d'un lot, puis prévient si l'heure est venue.
// `pousser(notif)` envoie au propriétaire (le chemin push existant).
export async function recevoirAlertesPlantages({ evenements, empreinte, proprio, env = process.env, fetcher = fetch, pousser = null, maintenant = Date.now() }) {
  const evts = normaliserEvenements(evenements);
  if (!evts.length) return { fait: false, raison: 'rien' };
  if (!cfg(env).service || !proprio) return { fait: false, raison: 'non-configure' };
  const jour = jourParis(maintenant);
  const id = idTerrain(jour);
  for (let essai = 0; essai < ESSAIS; essai++) {
    const avant = await lireLigne(env, fetcher, proprio, id);
    if (avant === undefined) return { fait: false, raison: 'base' };     // lecture ratée : rien n'est écrit
    const r = jourApresEvenements(avant ? { ...avant, jour } : { jour }, evts, empreinte, maintenant);
    if (r.refus) return { fait: false, raison: r.refus };
    // La notification groupée est-elle due ? Alors la ligne part DÉJÀ marquée « dite ».
    const { enAttente, due } = alerteDue(r.data, maintenant);
    const data = due ? apresNotification(r.data, maintenant) : r.data;
    const ecrit = await ecrireCas(env, fetcher, proprio, id, avant, data, maintenant);
    if (ecrit === undefined) return { fait: false, raison: 'base' };
    if (!ecrit) continue;   // devancé : relire et rejouer
    let notifie = false;
    if (due && pousser) {
      try { notifie = await direPlantages(enAttente, { proprio, env, fetcher, pousser, maintenant }); } catch (_) { notifie = false; }
    }
    return { fait: true, jour, types: evts.length, due, notifie };
  }
  return { fait: false, raison: 'concurrence' };
}

// La veille du matin : ce qui attend encore (types arrivés pendant l'heure de
// repos, sans lot après) est dit — même règle, même ligne.
export async function vidangerAlertesPlantages({ proprio, env = process.env, fetcher = fetch, pousser = null, maintenant = Date.now() }) {
  if (!cfg(env).service || !proprio) return { fait: false, raison: 'non-configure' };
  const out = [];
  for (const jour of [jourParis(maintenant - 864e5), jourParis(maintenant)]) {
    const id = idTerrain(jour);
    const avant = await lireLigne(env, fetcher, proprio, id);
    if (avant === undefined) { out.push({ jour, fait: false, raison: 'base' }); continue; }
    if (!avant) { out.push({ jour, rien: true }); continue; }
    const { enAttente, due } = alerteDue(avant, maintenant);
    if (!due) { out.push({ jour, attente: enAttente.length }); continue; }
    const ecrit = await ecrireCas(env, fetcher, proprio, id, avant, apresNotification(avant, maintenant), maintenant);
    if (!ecrit) { out.push({ jour, fait: false, raison: 'pas écrit : rien envoyé' }); continue; }
    let notifie = false;
    if (pousser) { try { notifie = await direPlantages(enAttente, { proprio, env, fetcher, pousser, maintenant }); } catch (_) {} }
    out.push({ jour, fait: true, types: enAttente.length, notifie });
  }
  return { fait: true, jours: out };
}

// Ce que le panneau montre : par jour, les types (sans empreinte).
export function terrainPourPanneau(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => {
    const jour = String(r.id || '').slice(PREFIXE_TERRAIN.length);
    const d = r.data && typeof r.data === 'object' ? r.data : {};
    const types = Object.entries(d.types && typeof d.types === 'object' ? d.types : {}).map(([cle, t]) => ({
      cle, message: String(t.message || '').slice(0, 200), n: Number(t.n) || 0, garde: Number(t.garde) || 0,
      appareils: Array.isArray(t.appareils) ? t.appareils.length : 0,
      ecrans: Object.entries(t.ecrans || {}).map(([e, n]) => ({ ecran: e, nom: nomEcran(e), n: Number(n) || 0 })).sort((a, b) => b.n - a.n),
      versions: Object.keys(t.versions || {}).slice(0, 5), premier: t.premier || null, dernier: t.dernier || null, dit: (Number(t.notifie) || 0) >= (Number(t.n) || 0),
    })).sort((a, b) => b.n - a.n);
    return { jour, notifieA: d.notifieA || null, types };
  }).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.jour)).sort((a, b) => b.jour.localeCompare(a.jour));
}

export async function listerPlantagesTerrain({ proprio, env = process.env, fetcher = fetch }) {
  const { url, service } = cfg(env);
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?owner=eq.${proprio}&id=like.${PREFIXE_TERRAIN}*&select=id,data&order=id.desc&limit=${JOURS_PANNEAU}`, { headers: sbCle(service) });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    return Array.isArray(j) ? terrainPourPanneau(j) : null;
  } catch (_) { return null; }
}
