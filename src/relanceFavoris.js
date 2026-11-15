// ════════════════════════════════════════════════════════════════════════════
//  RELANCER LES FAVORIS AU BON MOMENT (15 nov. 2026, chantier « vendre plus », validé par Julien)
// ════════════════════════════════════════════════════════════════════════════
// « 5 personnes aiment N°124 · depuis 9 j, ni offre ni vente » ⇒ le geste EXISTANT :
//   · Vinted   : « Envoyer une offre aux favoris » (Messages → Favoris, file serveur à
//                autorisation unique, offre Vinted réelle, plafonds de l'extension) — la
//                liste s'ouvre avec les favoris de CETTE annonce cochés, RIEN ne part sans
//                SON « Envoyer » (src/FavorisVinted.jsx) ;
//   · eBay     : « Faire une offre aux observateurs » (la fiche de l'annonce eBay, eBay
//                choisit les destinataires, §3) ;
//   · Vestiaire: les « aimés » ne sont pas lus aujourd'hui (aucune lecture ne les range) :
//                une annonce Vestiaire sans compteur LU n'a jamais de carte.
// LE BON MOMENT : au moins N personnes (compteur LU sur l'annonce, jamais deviné) ET rien
// depuis 7 jours — la dernière date CONNUE parmi : la mise en ligne (âge LU), le dernier
// favori daté (la cloche de Vinted), la dernière offre reçue LUE, la dernière relance
// envoyée par VRM. Aucune date connue ⇒ pas de carte (on ne sait pas si c'est le moment).
// Les offres reçues pas lues ne valent pas « aucune » (§5) : la carte le dit
// (« offres pas lues ») au lieu d'écrire « ni offre ».
// Une annonce VENDUE (preuve partagée, par identité) n'a jamais de carte. Identité : la
// plateforme + l'identifiant de l'annonce — 50 annonces au même titre restent 50 cartes.
// Module PUR (aucune lecture, aucune écriture, `maintenant` passé). Exécuté par
// scripts/audit-relance-favoris.cjs.

export const RELANCE_MIN_DEFAUT = 3;
export const CALME_J = 7;
export const MAX_CARTES = 5;
const JOUR = 86400000;
const str = (v) => String(v == null ? '' : v).trim();
const compteur = (v) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : (typeof v === 'string' && /^\d{1,6}$/.test(v) ? Number(v) : null));
const ms = (v) => { if (v == null || v === '') return null; const n = typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(n) && n > 0 ? (n < 1e12 ? n * 1000 : n) : null; };
export const PLATEFORMES_RELANCE = ['vinted', 'ebay', 'vestiaire'];

// Le seuil N réglable (1 à 99), sinon le défaut.
export const seuilRelance = (v) => { const n = Number(str(v)); return Number.isInteger(n) && n >= 1 && n <= 99 ? n : RELANCE_MIN_DEFAUT; };

// Les dates des favoris Vinted, par annonce, depuis les lignes de la cloche
// (`lireFavorisVinted` : { lien, date }) : l'annonce par l'identifiant /items/<id> du LIEN.
export function datesFavorisParAnnonce(lignes) {
  if (!Array.isArray(lignes)) return null;
  const m = {};
  for (const l of lignes) {
    const id = (/\/items\/([1-9]\d{0,19})(?:[-/?#]|$)/.exec(str(l && l.lien)) || [])[1];
    const t = ms(l && l.date);
    if (!id || t == null) continue;
    if (!m[id] || t > m[id]) m[id] = t;
  }
  return m;
}

// LES CARTES.
//   annonces : [{ plateforme, id, uid, compte, numero, titre, photo, favoris (compteur LU),
//               age (jours LUS | null), derniereOffre (ms | null), offresLues (bool) }]
//   datesFavoris : { [id]: ms du dernier favori daté } (Vinted) | null
//   relances     : { [plateforme:id]: ms de la dernière relance envoyée } | null
//   vendus       : Set des `plateforme:id` vendus (preuve partagée) — par identité
// → { cartes, n, ecartees: { pasLu, peu, recent, sansDate, vendue }, seuil }
export function cartesRelance({ annonces, datesFavoris = null, relances = null, vendus = null, seuil = RELANCE_MIN_DEFAUT, calme = CALME_J, maintenant = Date.now(), max = MAX_CARTES } = {}) {
  if (!Array.isArray(annonces)) return null;
  const s = seuilRelance(seuil);
  const ecartees = { pasLu: 0, peu: 0, recent: 0, sansDate: 0, vendue: 0 };
  const vues = new Set();
  const toutes = [];
  for (const a of annonces) {
    const plat = str(a && a.plateforme) || 'vinted';
    const id = str(a && a.id);
    if (!id || !PLATEFORMES_RELANCE.includes(plat)) continue;
    const cle = plat + ':' + id;
    if (vues.has(cle)) continue;
    vues.add(cle);
    if (vendus && typeof vendus.has === 'function' && vendus.has(cle)) { ecartees.vendue++; continue; }
    const f = compteur(a.favoris);
    if (f == null) { ecartees.pasLu++; continue; }
    if (f < s) { ecartees.peu++; continue; }
    const age = a.age == null || a.age === '' ? NaN : Number(a.age);
    const dates = [];
    if (Number.isFinite(age) && age >= 0) dates.push(maintenant - age * JOUR);
    if (plat === 'vinted' && datesFavoris && datesFavoris[id] != null) dates.push(Number(datesFavoris[id]));
    const off = ms(a.derniereOffre); if (off != null) dates.push(off);
    const rel = relances ? ms(relances[cle]) : null; if (rel != null) dates.push(rel);
    const der = dates.filter((t) => Number.isFinite(t) && t <= maintenant + 60000);
    if (!der.length) { ecartees.sansDate++; continue; }
    const depuis = Math.max(...der);
    const depuisJ = Math.floor((maintenant - depuis) / JOUR);
    if (depuisJ < calme) { ecartees.recent++; continue; }
    toutes.push({ cle, plateforme: plat, id, uid: str(a.uid), compte: str(a.compte), numero: str(a.numero), titre: str(a.titre), photo: str(a.photo),
      personnes: f, depuisJ, offresLues: a.offresLues === true, relanceeAvant: rel != null });
  }
  // Le plus de personnes d'abord, puis le plus long calme, puis l'identité (stable).
  toutes.sort((x, y) => y.personnes - x.personnes || y.depuisJ - x.depuisJ || (x.cle < y.cle ? -1 : x.cle > y.cle ? 1 : 0));
  return { cartes: toutes.slice(0, Math.max(0, max)), n: toutes.length, ecartees, seuil: s, calme };
}

// Le geste d'une carte : { k, bloque } — `bloque` (une phrase) quand il ne peut pas partir
// d'ici (§2.7 : jamais en silence). `cap(nom)` → 'ok'|'retard'|'absente' (`extSait`).
export function gesteRelance(carte, { cap = () => 'ok', version = () => '' } = {}) {
  if (!carte) return null;
  if (carte.plateforme === 'vinted') {
    if (!carte.uid) return { k: 'favoris', bloque: 'compte' };
    return { k: 'favoris', bloque: cap('favoris') === 'ok' ? '' : 'extension', version: version('favoris') || '' };
  }
  if (carte.plateforme === 'ebay') return { k: 'observateurs', bloque: '' };
  return { k: 'ouvrir', bloque: '' };
}
