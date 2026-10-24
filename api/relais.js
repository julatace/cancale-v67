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

// ── (24 oct.) LE STATUT DES COLIS CHEZ LEUR TRANSPORTEUR (api/_lib/transporteurs*.js)
// Trois modes, sans 13e fonction (le plan Hobby en permet 12) :
//   POST ?mode=transp       — un passage (l'app ouverte, ou une page de suivi
//                             ouverte dans l'extension) : C5 ;
//   GET  ?mode=transp-a-lire — ce que l'extension doit lire depuis le navigateur
//                             (seulement ce que le transporteur a REFUSÉ au
//                             serveur, ou pendant sa pause — Mondial Relay
//                             compris, lu par le serveur depuis le 24 oct.) : C3 ;
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
      res.status(200).json({ ok: true, lus: r.lus, besoinNavigateur: r.besoinNavigateur, pause: r.pause });
    } catch (e) { res.status(500).json({ error: 'panne' }); }
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

async function geocodeCity(city) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=fr&q=${encodeURIComponent(city)}`;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) return null;
  const j = await r.json();
  return (j && j[0]) ? j[0] : null;
}

// Position (lat/lon) → nom de ville, puis on géocode la ville pour sa bbox.
async function cityFromLatLon(lat, lon) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=12`, { headers: UA });
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
  for (const m of mirrors) {
    try {
      const r = await fetch(m, { method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(query) });
      if (r.ok) { const j = await r.json(); if (j && j.elements) return j; }
    } catch (_) {}
  }
  return null;
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
  const mode = String((req.query && req.query.mode) || '');
  if (mode === 'transp' || mode === 'transp-a-lire' || mode === 'transp-brut') { await transp(req, res, mode); return; }
  if (!(await vendeurExige(req, res))) return;
  let city = (req.query && req.query.city ? String(req.query.city) : '').trim();
  const lat = req.query && req.query.lat, lon = req.query && req.query.lon;
  try {
    // Depuis la position : on retrouve d'abord le nom de la ville.
    if (!city && lat && lon) { city = (await cityFromLatLon(lat, lon)) || ''; }
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
    res.status(200).json({ city, points: [], error: String(e) });
  }
}
