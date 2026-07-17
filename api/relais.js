// api/relais.js
// ────────────────────────────────────────────────────────────────────────────
// Points relais d'une ville : géocode la ville (Nominatim) puis liste les
// commerces de retrait (Overpass/OpenStreetMap) qui hébergent les points relais
// en France (tabac-presse, supérettes, supermarchés, bureaux de poste, casiers).
// Fait côté SERVEUR → fiable, pas de blocage CORS/réseau côté téléphone.
//   GET /api/relais?city=Cancale  →  { city, center:{lat,lon}, points:[...] }
// ────────────────────────────────────────────────────────────────────────────

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
      const key = nom.toLowerCase() + '|' + lat.toFixed(4);
      if (seen.has(key)) return null; seen.add(key);
      return { nom, type: isLocker ? 'Casier à colis' : typeLabel(t), carrier: carrier || undefined, locker: isLocker, lat: +lat, lon: +lon };
    }).filter(Boolean)
      // Casiers/points de transporteur d'abord (les plus pertinents), puis alpha.
      .sort((a, b) => (b.carrier ? 1 : 0) - (a.carrier ? 1 : 0) || a.nom.localeCompare(b.nom));
    // Cache CDN 24h : la liste des commerces d'une ville bouge très peu.
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    res.status(200).json({ city, center: { lat: +g.lat, lon: +g.lon }, points });
  } catch (e) {
    res.status(200).json({ city, points: [], error: String(e) });
  }
}
