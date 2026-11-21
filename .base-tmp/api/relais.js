// api/relais.js
// ────────────────────────────────────────────────────────────────────────────
// Points relais d'une ville : géocode la ville (Nominatim) puis liste les
// commerces de retrait (Overpass/OpenStreetMap) qui hébergent les points relais
// en France (tabac-presse, supérettes, supermarchés, bureaux de poste, casiers).
// Fait côté SERVEUR → fiable, pas de blocage CORS/réseau côté téléphone.
//   GET /api/relais?city=Cancale  →  { city, center:{lat,lon}, points:[...] }
// ────────────────────────────────────────────────────────────────────────────

import './_lib/sans-bruit.js';
import { vendeurExige, baseCloisonnee } from './_lib/session.js';
import { contexteVendeur } from './_lib/owner.js';
import { accesVendeur } from './_lib/abonnement.js';
import { normaliserSuivi } from './_lib/etat-colis-email.js';
import { passageTransporteurs, transpALire, appliquerReponseBrute, ENVOI_MAX, MAX_APP, BUDGET_APP_MS } from './_lib/transporteurs-lecture.js';
import { corsExtension } from './_lib/cors-extension.js';
import { etiquettesDuVendeur } from './_lib/etiquettes-vendeur.js';
import { MAX_PDF_APP, BUDGET_PDF_APP_MS } from './_lib/transporteur-anciens.js';
import { fetchAvecDelai } from './_lib/fetch-delai.js';   // (11 nov.) chaque appel sortant a un délai

// ── (24 oct.) LE STATUT DES COLIS CHEZ LEUR TRANSPORTEUR (api/_lib/transporteurs*.js)
// Trois modes, sans 13e fonction (le plan Hobby en permet 12) :
//   POST ?mode=transp       — un passage (l'app ouverte, ou une page de suivi
//                             ouverte dans l'extension) : C5 ;
//   GET  ?mode=transp-a-lire — ce que l'extension doit lire depuis le navigateur
//                             (seulement ce que le transporteur a REFUSÉ au
//                             serveur, ou pendant sa pause — Mondial Relay
//                             compris, lu par le serveur depuis le 24 oct., et
//                             relu alors par l'extension par la même route
//                             `_mvc`) : C3 ;
//   POST ?mode=transp-brut  — la réponse BRUTE relayée par l'extension, jugée
//                             ici par la même règle : C4.
// Session du vendeur exigée (jamais un identifiant envoyé par le navigateur),
// base cloisonnée exigée (sinon « pas su » : on ne mélange pas les boutiques),
// abonnement en règle (coupé ⇒ 402 ; « pas su » ne coupe pas), rien en cache.
const corpsDe = (req) => { if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (_) { return undefined; } } return req.body || {}; };
async function transp(req, res, mode) {
  res.setHeader('Cache-Control', 'no-store');
  const methode = String(req.method || 'GET').toUpperCase();
  if ((mode === 'transp-a-lire' && methode !== 'GET') || (mode !== 'transp-a-lire' && methode !== 'POST')) { res.status(405).json({ error: 'methode' }); return; }
  const lg = Number((req.headers && (req.headers['content-length'] || req.headers['Content-Length'])) || 0);
  const brut = typeof req.body === 'string' ? req.body : (req.body ? JSON.stringify(req.body) : '');
  if (mode === 'transp-brut' && (lg > ENVOI_MAX || Buffer.byteLength(brut, 'utf8') > ENVOI_MAX)) { res.status(413).json({ error: 'trop-gros' }); return; }
  const u = await vendeurExige(req, res);
  if (!u) return;
  if (!(await baseCloisonnee())) { res.status(503).json({ error: 'pas-su' }); return; }
  if ((await accesVendeur(u.id)) === false) { res.status(402).json({ error: 'abonnement' }); return; }
  await contexteVendeur.run({ owner: u.id }, async () => {
    try {
      if (mode === 'transp-a-lire') {
        const r = await transpALire();
        if (!r) { res.status(503).json({ error: 'pas-su' }); return; }
        res.status(200).json(r); return;
      }
      const body = corpsDe(req);
      if (!body || typeof body !== 'object') { res.status(400).json({ error: 'forme' }); return; }
      if (mode === 'transp-brut') { const r = await appliquerReponseBrute(body); res.status(r.status).json(r.corps); return; }
      // C5. Un n° donné (page de suivi ouverte) : lu s'il est un achat de ce
      // vendeur et que sa dernière lecture a plus de 5 min — sinon ignoré.
      const suivi = body.suivi == null || body.suivi === '' ? null : normaliserSuivi(body.suivi);
      if (suivi !== null && !/^[A-Z0-9]{8,24}$/.test(suivi)) { res.status(400).json({ error: 'suivi' }); return; }
      const cp = /^\d{5}$/.test(String(body.cp || '')) ? String(body.cp) : '';
      const r = await passageTransporteurs({ max: MAX_APP, budgetMs: BUDGET_APP_MS, suivi, force: !!suivi, cpPage: cp });
      if (!r.ok) { res.status(503).json({ error: 'pas-su' }); return; }
      res.status(200).json({ ok: true, lus: r.lus, departs: r.departs || [], besoinNavigateur: r.besoinNavigateur, pause: r.pause });
    } catch (e) { res.status(500).json({ error: 'panne' }); }
  });
}

// ── (9 nov. au soir, « transporteurs parfaits ») POST ?mode=etiquettes ──────
// Julien : « Ce n'est pas possible d'avoir "transporteur inconnu" sachant que tu as les
// bordereaux en ta possession. » L'app ouverte demande : « lis les étiquettes (PDF) de MES
// bordereaux pas encore lues » — un lot borné (MAX_PDF_APP, BUDGET_PDF_APP_MS), UN PDF par
// requête, au nom du vendeur de la SESSION (jamais un identifiant envoyé par le navigateur),
// même règle que le cron (api/_lib/etiquettes-vendeur.js). Réponse : des nombres seulement
// (`restants` > 0 ⇒ l'app redemande). Lecture ratée ⇒ 503, rien écrit.
async function etiquettes(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (String(req.method || 'GET').toUpperCase() !== 'POST') { res.status(405).json({ error: 'methode' }); return; }
  const u = await vendeurExige(req, res);
  if (!u) return;
  if (!(await baseCloisonnee())) { res.status(503).json({ error: 'pas-su' }); return; }
  if ((await accesVendeur(u.id)) === false) { res.status(402).json({ error: 'abonnement' }); return; }
  await contexteVendeur.run({ owner: u.id }, async () => {
    try {
      const r = await etiquettesDuVendeur({ max: MAX_PDF_APP, budgetMs: BUDGET_PDF_APP_MS });
      if (!r || !r.fait) { res.status(503).json({ error: 'pas-su' }); return; }
      res.status(200).json({ ok: true, lus: r.lus || 0, ranges: r.ranges || 0, vus: r.vus || 0, restants: r.restants || 0 });
    } catch (_) { res.status(500).json({ error: 'panne' }); }
  });
}

// ⚠️ ANTI-ABUS (20 octobre) : cette route était PUBLIQUE, sans session — un
// relais gratuit vers Nominatim et Overpass depuis l'adresse de Vercel, pour
// n'importe qui sur internet. Mesuré : l'app ne l'appelle PLUS nulle part
// (recherche par ville retirée, cf. src/App.jsx). Un abus coûtait deux fois :
// des appels de fonction Vercel, et l'adresse de VRM bannie par Nominatim
// (politique d'usage : un appel par seconde) — ce qui casserait aussi la ville
// de la communauté. Elle exige maintenant une session VRM, et sa réponse n'est
// plus mise en cache par le CDN (un cache public servirait sans session).

const UA = { 'User-Agent': 'VRM/1.0 (points relais)' };

// (11 nov., M42) Nominatim : 1 requête/s au plus (sa politique d'usage) et un
// cache par ville (24 h) dans l'instance : un abus ne fait pas bannir l'adresse
// de VRM. Délai de 8 s (fetch-delai).
const NOMINATIM_ESPACE_MS = 1100;
const CACHE_VILLE_MS = 24 * 3600 * 1000;
const cacheVilles = new Map();
let _prochainNominatim = 0;
export async function freinNominatim(maintenant = Date.now()) {
  const attente = Math.max(0, _prochainNominatim - maintenant);
  if (attente > 3000) return false;   // file trop longue : « indisponible », jamais une attente sans fin
  _prochainNominatim = Math.max(_prochainNominatim, maintenant) + NOMINATIM_ESPACE_MS;
  if (attente) await new Promise((r) => setTimeout(r, attente));
  return true;
}
async function geocodeCity(city) {
  const cle = String(city).toLowerCase();
  const c = cacheVilles.get(cle);
  if (c && Date.now() - c.at < CACHE_VILLE_MS) return c.g;
  if (!(await freinNominatim())) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=fr&q=${encodeURIComponent(city)}`;
  const r = await fetchAvecDelai(url, { headers: UA }, 8000);
  if (!r.ok) return null;
  const j = await r.json();
  const g = (j && j[0]) ? j[0] : null;
  if (g) { if (cacheVilles.size > 500) cacheVilles.delete(cacheVilles.keys().next().value); cacheVilles.set(cle, { g, at: Date.now() }); }
  return g;
}

// Position (lat/lon) → nom de ville, puis on géocode la ville pour sa bbox.
async function cityFromLatLon(lat, lon) {
  try {
    if (!(await freinNominatim())) return null;
    const r = await fetchAvecDelai(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=12`, { headers: UA });
    if (!r.ok) return null;
    const j = await r.json();
    const a = j && j.address;
    const city = a && (a.village || a.town || a.city || a.municipality);
    return city || null;
  } catch (_) { return null; }
}

async function overpass(query) {
  const mirrors = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ];
  // (11 nov., M41) Les trois miroirs en COURSE (le premier qui répond gagne),
  // 8 s chacun : jamais 3 × 25 s en série, au-delà du temps de la fonction.
  const un = async (m) => {
    const r = await fetchAvecDelai(m, { method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(query) }, 8000);
    if (!r.ok) throw new Error('overpass ' + r.status);
    const j = await r.json(); if (j && j.elements) return j;
    throw new Error('overpass vide');
  };
  try { return await Promise.any(mirrors.map(un)); } catch (_) { return null; }
}

const typeLabel = (t) => t.amenity === 'parcel_locker' ? 'Casier à colis'
  : t.amenity === 'post_office' ? 'Bureau de poste'
  : t.shop === 'tobacco' ? 'Tabac'
  : t.shop === 'newsagent' ? 'Presse'
  : t.shop === 'supermarket' ? 'Supermarché'
  : 'Point relais';

// Transporteur déduit des étiquettes OSM (operator / brand / network / name).
function carrierFromTags(t) {
  const s = `${t.operator || ''} ${t.brand || ''} ${t.network || ''} ${t.name || ''}`.toLowerCase();
  if (/mondial\s*relay/.test(s)) return 'mondialrelay';
  if (/chronopost/.test(s)) return 'chronopost';
  if (/\bups\b/.test(s)) return 'ups';
  if (/vinted/.test(s)) return 'vinted';
  if (/relais\s*colis/.test(s)) return 'relaiscolis';
  if (/pickup|dpd/.test(s)) return 'chronopost'; // réseau Pickup = Chronopost/DPD
  if (/coliss|la\s*poste/.test(s)) return 'colissimo';
  if (/amazon/.test(s)) return 'amazon';
  return null;
}

export default async function handler(req, res) {
  if (corsExtension(req, res)) return;   // (8 nov.) Orion : préalable CORS des appels de l'extension
  const mode = String((req.query && req.query.mode) || '');
  if (mode === 'transp' || mode === 'transp-a-lire' || mode === 'transp-brut') { await transp(req, res, mode); return; }
  if (mode === 'etiquettes') { await etiquettes(req, res); return; }
  if (!(await vendeurExige(req, res))) return;
  let city = (req.query && req.query.city ? String(req.query.city) : '').trim().slice(0, 80);   // (11 nov., B123) borné
  const lat = req.query && req.query.lat, lon = req.query && req.query.lon;
  try {
    // Depuis la position : on retrouve d'abord le nom de la ville.
    // (9 nov., revue sécurité) lat/lon partaient TELS QUELS dans l'adresse de
    // Nominatim (« 1&q=… » y ajoutait des paramètres) : des nombres, ou rien.
    const coord = (v, max) => { const t = String(v == null ? '' : v).trim(); const n = Number(t); return /^-?\d{1,3}(\.\d{1,10})?$/.test(t) && Math.abs(n) <= max ? String(n) : ''; };
    const la = coord(lat, 90), lo = coord(lon, 180);
    if (!city && la && lo) { city = (await cityFromLatLon(la, lo)) || ''; }
    if (!city) { res.status(200).json({ city: '', points: [], error: 'ville_introuvable' }); return; }
    const g = await geocodeCity(city);
    if (!g) { res.status(200).json({ city, points: [], error: 'ville_introuvable' }); return; }
    const bb = g.boundingbox; const [S, N, W, E] = [bb[0], bb[1], bb[2], bb[3]];
    const bbox = `${S},${W},${N},${E}`;
    // Priorité aux CASIERS (leur operator dit le transporteur) et aux points
    // de MARQUE (brand/operator = Mondial Relay/Chronopost/Vinted…). Complété
    // par les commerces de retrait classiques (tabac-presse, supérettes…).
    const q = `[out:json][timeout:25];(` +
      `node["amenity"="parcel_locker"](${bbox});` +
      `node["brand"~"Mondial Relay|Chronopost|Relais Colis|Pickup|Vinted|UPS",i](${bbox});` +
      `node["operator"~"Mondial Relay|Chronopost|Relais Colis|Pickup|Vinted|UPS",i](${bbox});` +
      `node["shop"="tobacco"](${bbox});` +
      `node["shop"="newsagent"](${bbox});` +
      `node["shop"="convenience"](${bbox});` +
      `node["shop"="supermarket"](${bbox});` +
      `node["amenity"="post_office"](${bbox});` +
      `);out center 150;`;
    const oj = await overpass(q);
    if (!oj) { res.status(200).json({ city, center: { lat: +g.lat, lon: +g.lon }, points: [], error: 'overpass_indisponible' }); return; }
    const seen = new Set();
    const points = (oj.elements || []).map(e => {
      const lat = e.lat ?? (e.center && e.center.lat), lon = e.lon ?? (e.center && e.center.lon);
      const t = e.tags || {};
      if (!lat || !lon) return null;
      const carrier = carrierFromTags(t);
      const isLocker = t.amenity === 'parcel_locker';
      // Un casier sans nom devient « Casier <Transporteur> ».
      const nom = t.name || (carrier ? `Casier ${({ mondialrelay: 'Mondial Relay', chronopost: 'Chronopost', vinted: 'Vinted Go', ups: 'UPS', colissimo: 'La Poste', amazon: 'Amazon', relaiscolis: 'Relais Colis' })[carrier] || ''}`.trim() : (isLocker ? 'Casier à colis' : null));
      if (!nom) return null;
      // Rue (depuis les tags OSM) : sert à DISTINGUER deux points de même nom
      // (ex. plusieurs « Casier Mondial Relay »).
      const rue = [t['addr:housenumber'], t['addr:street'] || t['addr:place']].filter(Boolean).join(' ').trim() || undefined;
      const key = nom.toLowerCase() + '|' + lat.toFixed(4);
      if (seen.has(key)) return null; seen.add(key);
      return { nom, rue, type: isLocker ? 'Casier à colis' : typeLabel(t), carrier: carrier || undefined, locker: isLocker, lat: +lat, lon: +lon };
    }).filter(Boolean)
      // Casiers/points de transporteur d'abord (les plus pertinents), puis alpha.
      .sort((a, b) => (b.carrier ? 1 : 0) - (a.carrier ? 1 : 0) || a.nom.localeCompare(b.nom));
    // Cache 24 h DANS LE NAVIGATEUR seulement (privé : la route exige une session).
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.status(200).json({ city, center: { lat: +g.lat, lon: +g.lon }, points });
  } catch (e) {
    // (11 nov., B124-125) une panne est un 502 au message fixe, jamais mise en cache.
    console.warn('relais : points', e && e.name);
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ city, points: [], error: 'points_indisponibles' });
  }
}
