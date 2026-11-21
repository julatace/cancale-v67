// ════════════════════════════════════════════════════════════════════════════
//  LA TOURNÉE DE MA JOURNÉE (1er nov., maquette « journee-A-tournee » choisie)
//  Imprimer → Emballer → Déposer → Retirer : la journée rangée en étapes.
//
//  ⚠️ CE MODULE NE COMPTE RIEN LUI-MÊME. Chaque étape reçoit des listes que les
//  règles de l'app ont DÉJÀ faites (§11, un seul propriétaire par notion) :
//   · Imprimer  — les lignes de « Imprimer les N prêts » de Colis (`lignesLot`,
//                 chacune avec `imprime` = la date où VRM l'a imprimée,
//                 `vinted_bords_printed`) ;
//   · Emballer / Déposer — les colis à poster de Ma journée (`toShip` + les
//                 ventes eBay à poster, le nombre publié dans `vrm_colis_aposter`) ;
//   · Retirer   — les points relais de la colonne « À retirer » de Colis
//                 (`pointsARetirer`), le nombre de `pickupUnion.total`
//                 (`vrm_colis_retirer`).
//  Une étape se COCHE sur une donnée réelle, jamais sur une case décorative :
//   · Imprimer : tous les prêts ont été imprimés par VRM (ou plus aucun prêt
//     et une impression aujourd'hui) ;
//   · Emballer et Déposer : plus aucun colis à poster ET au moins un colis
//     marqué déposé aujourd'hui (`vinted_ship_done`). Rien ne garde la trace de
//     l'emballage seul : un colis déposé est un colis emballé — l'étape se coche
//     avec le dépôt, et c'est dit (`sourceFait`) ;
//   · Retirer : plus aucun colis à retirer ET au moins un colis noté retiré
//     aujourd'hui (`vrm_colis_collected_at`, `vinted_pickup_done`).
//  « Pas su » n'est pas « rien » (§5) : une source pas lue rend l'étape `passu`
//  (« — »), jamais « 0 » ni « faite ».
//
//  Les ARRÊTS de la tournée (le mode plein écran) : les dépôts, regroupés par
//  transporteur (le point de dépôt d'un colis n'est relié à lui par aucune
//  identité : jamais deviné), et les points relais où des colis attendent. Ils
//  sont rangés par DATE LIMITE la plus proche — ce n'est PAS un itinéraire, et
//  l'écran le dit. Aucune distance, aucune durée inventée.
//  ⛔ Pas d'impression de la journée triée par emplacement (refusé le 11 oct.).
// ════════════════════════════════════════════════════════════════════════════

// Une date de geste (nombre en ms, ou texte ISO) ⇒ ms, sinon null.
export const msDe = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v === 'string' && v) { const t = Date.parse(v); return Number.isFinite(t) ? t : null; }
  return null;
};
// Combien de gestes d'une table { clé: date } datent d'aujourd'hui (depuis `minuit`).
export const gestesDepuis = (table, minuit) => {
  if (!table || typeof table !== 'object') return 0;
  let n = 0;
  for (const v of Object.values(table)) { const t = msDe(v); if (t != null && t >= minuit) n++; }
  return n;
};

const NOMS_TRANSPORTEUR = { mondialrelay: 'Mondial Relay', chronopost: 'Chronopost', vinted: 'Vinted Go', vintedgo: 'Vinted Go', colissimo: 'Colissimo', laposte: 'La Poste', relaiscolis: 'Relais Colis', ups: 'UPS', dpd: 'DPD', gls: 'GLS', inpost: 'InPost' };
export const nomTransporteur = (c) => NOMS_TRANSPORTEUR[String(c || '').toLowerCase().replace(/[^a-z]/g, '')] || '';

const etatEtape = ({ n, passu, faitAujourdhui }) => (passu ? 'passu' : n > 0 ? 'afaire' : faitAujourdhui > 0 ? 'fait' : 'rien');

// lignesImpr  : [{ cle, imprime }]      (lignesLot)
// aPoster     : [{ cle, num, titre, transporteur, jours, site }] — Vinted puis eBay
// nAPoster    : le nombre de la case « À envoyer » (null = pas su)
// points      : pointsARetirer(...).points
// nARetirer   : pickupUnion.total (null = pas su)
// gestes      : { imprimes, deposes, retires } — gestes d'aujourd'hui
// nPrets / pretsAuMoins : Ma journée ne lit pas les bordereaux captés par
// l'extension (Colis les lit et publie `vrm_colis_prets`) — le nombre est celui
// de la case « À envoyer » (« au moins » quand il n'est pas complet) ; une étape
// dont on ne sait pas TOUT n'est jamais cochée.
export function etapesTournee({ lignesImpr = [], nPrets = null, pretsAuMoins = false, imprPasSu = false, aPoster = [], nAPoster = null, points = [], nARetirer = null, gestes = {} } = {}) {
  const g = { imprimes: 0, deposes: 0, retires: 0, ...gestes };
  const prets = Array.isArray(lignesImpr) ? lignesImpr : [];
  const totalImpr = Number.isFinite(nPrets) ? Math.max(nPrets, prets.length) : prets.length;
  const restantImpr = totalImpr - prets.filter((l) => l.imprime).length;
  const imprimer = {
    id: 'imprimer', n: totalImpr, reste: restantImpr, auMoins: !!pretsAuMoins,
    etat: imprPasSu ? 'passu' : totalImpr > 0 ? (restantImpr === 0 && !pretsAuMoins ? 'fait' : 'afaire') : (pretsAuMoins ? 'passu' : g.imprimes > 0 ? 'fait' : 'rien'),
    sourceFait: 'vinted_bords_printed',
    // Le détail, par transporteur (« Mondial Relay ×2 · Vinted Go ×1 ») — les mêmes lignes.
    parTransporteur: compterPar(prets.map((l) => nomTransporteur(l.transporteur) || 'transporteur pas encore connu')),
  };
  const passuPoster = nAPoster == null;
  const nPoster = passuPoster ? null : nAPoster;
  const emballer = {
    id: 'emballer', n: nPoster, etat: etatEtape({ n: nPoster || 0, passu: passuPoster, faitAujourdhui: g.deposes }),
    sourceFait: 'vinted_ship_done',
    // Les N° des paires à aller chercher, dans l'ordre de leur date limite (la
    // même que Colis) — jamais rangés par emplacement (refusé le 11 oct.).
    numeros: (aPoster || []).filter((x) => x && x.num).map((x) => String(x.num)),
    sansNumero: (aPoster || []).filter((x) => x && !x.num).length,
  };
  const depots = depotsTournee(aPoster);
  const deposer = {
    id: 'deposer', n: nPoster, etat: etatEtape({ n: nPoster || 0, passu: passuPoster, faitAujourdhui: g.deposes }),
    sourceFait: 'vinted_ship_done', depots,
  };
  const passuRetirer = nARetirer == null;
  const pts = (points || []).filter((p) => p && (p.nComptes > 0));
  const retirer = {
    id: 'retirer', n: passuRetirer ? null : nARetirer, etat: etatEtape({ n: passuRetirer ? 0 : nARetirer, passu: passuRetirer, faitAujourdhui: g.retires }),
    sourceFait: 'vrm_colis_collected_at+vinted_pickup_done',
    points: pts.map((p) => ({ cle: p.cle, nom: p.nom || '', inconnu: !!p.inconnu, adresse: p.adresseCourte || '', n: p.nComptes, jours: p.prochaineLimite == null ? null : p.prochaineLimite })),
  };
  const etapes = [imprimer, emballer, deposer, retirer];
  // L'étape « en cours » : la première qui reste à faire (son numéro prend l'accent).
  const courante = etapes.find((e) => e.etat === 'afaire');
  for (const e of etapes) e.courante = !!courante && e === courante;
  const utile = etapes.some((e) => e.etat === 'afaire' || e.etat === 'fait');
  return { etapes, utile, faites: etapes.filter((e) => e.etat === 'fait').length };
}

function compterPar(noms) {
  const m = new Map();
  for (const n of noms) m.set(n, (m.get(n) || 0) + 1);
  return [...m.entries()].map(([nom, n]) => ({ nom, n }));
}

// Les dépôts : un arrêt par transporteur. Un colis sans transporteur lu reste
// compté, sous « transporteur pas encore connu » (§5 : un colis caché est perdu).
export function depotsTournee(aPoster) {
  const m = new Map();
  for (const x of (aPoster || [])) {
    if (!x) continue;
    const nom = x.site === 'ebay' ? 'eBay' : (nomTransporteur(x.transporteur) || '');
    const cle = 'd:' + (x.site === 'ebay' ? 'ebay' : (nom || '?'));
    const d = m.get(cle) || { cle, type: 'depot', nom, inconnu: !nom, n: 0, jours: null, numeros: [] };
    d.n++;
    if (Number.isFinite(x.jours)) d.jours = d.jours == null ? x.jours : Math.min(d.jours, x.jours);
    if (x.num) d.numeros.push(String(x.num));
    m.set(cle, d);
  }
  return [...m.values()];
}

// Les arrêts du mode plein écran : dépôts + retraits, rangés par la date limite
// la plus proche (sans date : à la fin), puis le plus chargé. Numérotés 1, 2, 3…
// (le même numéro sur l'épingle et dans la liste).
export function arretsTournee({ depots = [], points = [] } = {}) {
  const retraits = (points || []).filter((p) => p && p.nComptes > 0).map((p) => ({
    cle: 'r:' + p.cle, cleRelais: p.cle, type: 'retrait', nom: p.nom || '', inconnu: !!p.inconnu, adresse: p.adresseCourte || '',
    n: p.nComptes, jours: p.prochaineLimite == null ? null : p.prochaineLimite, point: p,
  }));
  const tous = [...(depots || []).map((d) => ({ ...d })), ...retraits];
  const j = (x) => (x.jours == null ? 9999 : x.jours);
  tous.sort((a, b) => j(a) - j(b) || (a.type === b.type ? 0 : a.type === 'depot' ? -1 : 1) || b.n - a.n || String(a.nom).localeCompare(String(b.nom), 'fr'));
  // « Point pas encore connu » ne reçoit pas de numéro d'épingle (il n'a pas de lieu).
  let k = 0;
  return tous.map((x) => ({ ...x, numero: ++k }));
}

// « dernier jour aujourd'hui » — la phrase de date limite, la même que Colis.
export const texteJours = (j, type) => {
  if (j == null) return type === 'depot' ? 'date limite pas lue' : '';
  if (type === 'depot') return j < 0 ? 'date limite passée' : j === 0 ? "à déposer aujourd'hui" : j === 1 ? 'à déposer demain' : `encore ${j} jours`;
  return j < 0 ? 'date limite passée' : j === 0 ? 'dernier jour aujourd’hui' : j === 1 ? 'dernier jour demain' : `encore ${j} jours`;
};
