// ── LA CARTE DE LA COMMUNAUTÉ : les règles pures (testables sans écran) ──────
// Une personne est une CELLULE (sa ville arrondie à 0,05°, ≈ 5 km — la base
// n'en stocke jamais davantage). On regroupe les cellules par ville, on mesure
// ce qui est « près de toi », et on ne compte QUE ce qui est sur la carte :
// aucun chiffre inventé, aucun faux utilisateur.

export const RAYON_PRES_KM = 30;

export function distanceKm(a, b) {
  if (!a || !b) return Infinity;
  const r = Math.PI / 180, R = 6371;
  const dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const cleVille = (p) => String(p.pays || '') + '|' + String(p.ville || '').trim().toLocaleLowerCase('fr');

// Les cellules : { cle, lat, lon, personnes:[…], ville, pays, moi, pres }
export function cellules(profils, moi) {
  const m = new Map();
  for (const p of profils || []) {
    const lat = Number(p.lat), lon = Number(p.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const cle = lat.toFixed(2) + ',' + lon.toFixed(2);
    if (!m.has(cle)) m.set(cle, { cle, lat, lon, personnes: [], villes: new Set(), moi: false });
    const c = m.get(cle);
    c.personnes.push(p); c.villes.add(p.ville);
    if (p.moi) c.moi = true;
  }
  const ici = moi && Number.isFinite(Number(moi.lat)) ? { lat: Number(moi.lat), lon: Number(moi.lon) } : null;
  return [...m.values()].map((c) => ({ ...c, villes: [...c.villes], pres: !!ici && !c.moi && distanceKm(ici, c) <= RAYON_PRES_KM }));
}

// Ce que l'écran affiche en haut : tout vient de la liste lue.
export function resume(profils, moi) {
  const liste = profils || [];
  const autres = liste.filter((p) => !p.moi);
  const villes = new Set(liste.map(cleVille));
  const maVille = moi ? cleVille(moi) : null;
  const ici = moi ? { lat: Number(moi.lat), lon: Number(moi.lon) } : null;
  const dansMaVille = maVille ? autres.filter((p) => cleVille(p) === maVille).length : 0;
  const pres = ici ? autres.filter((p) => distanceKm(ici, { lat: Number(p.lat), lon: Number(p.lon) }) <= RAYON_PRES_KM).length : 0;
  const moiProfil = liste.find((p) => p.moi);
  return { total: liste.length, autres: autres.length, villes: villes.size, dansMaVille, pres, premier: !!(moiProfil && moiProfil.premier) };
}

// Regroupement à l'écran : les cellules dont les épingles se touchent (en
// pixels, au zoom courant) ne font qu'une, avec le nombre total.
export function grouperParPixels(cells, projeter, taille = 52) {
  const g = new Map();
  for (const c of cells) {
    const p = projeter(c);
    const k = Math.floor(p.x / taille) + ':' + Math.floor(p.y / taille);
    if (!g.has(k)) g.set(k, { cells: [], n: 0, x: 0, y: 0, moi: false, pres: false });
    const x = g.get(k);
    x.cells.push(c); x.n += c.personnes.length; x.moi = x.moi || c.moi; x.pres = x.pres || c.pres;
  }
  return [...g.values()].map((x) => ({ ...x,
    lat: x.cells.reduce((s, c) => s + c.lat * c.personnes.length, 0) / x.n,
    lon: x.cells.reduce((s, c) => s + c.lon * c.personnes.length, 0) / x.n }));
}

export const COUCOU = (ville) => `Coucou 👋 Je suis revendeur${ville ? ' à ' + ville : ''} moi aussi, sur VRM. On échange ?`;

export const quandCourt = (iso) => {
  const d = new Date(iso); if (!Number.isFinite(d.getTime())) return '';
  const auj = new Date(); const memeJour = d.toDateString() === auj.toDateString();
  const h = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (memeJour) return h;
  const hier = new Date(auj); hier.setDate(auj.getDate() - 1);
  if (d.toDateString() === hier.toDateString()) return 'hier ' + h;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + h;
};
