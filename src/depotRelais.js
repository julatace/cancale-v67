// ════════════════════════════════════════════════════════════════════════════
//  OÙ JE DÉPOSE MES COLIS (4 nov., choix de Julien n° 2)
//  Colis → À envoyer, rangé « par point de dépôt » : le TRANSPORTEUR d'un colis
//  (lu : `transporteurDuColis`, src/transporteursVisuels.js) dit le type de
//  point (Mondial Relay, Chronopost / Shop2Shop — le même réseau Pickup —,
//  Vinted Go, Relais Colis, La Poste…) ; Julien associe UNE fois chaque type à
//  SON point de dépôt (`vrm_depot_transporteurs`, synchronisé) ; les colis du
//  jour se rangent sous ce point.
//  · Aucun colis caché (§5) : un transporteur sans point associé, ou pas lu,
//    tombe sous « Point de dépôt à choisir » — toujours visible, toujours en bas.
//  · Ce n'est PAS la Tournée retirée de Ma journée le 1er nov. : pas
//    d'itinéraire, pas d'ordre de passage, rien dans Ma journée.
//  · Les points proposés sont LUS (la liste des points de dépôt que Vinted
//    donne, captée par l'extension, et ses relais préférés) ; rien n'est deviné.
//  Fonctions PURES (scripts/audit-relais-depot.cjs les exécute).
// ════════════════════════════════════════════════════════════════════════════
import { cleTransporteur, nomDuTransporteur } from './transporteursVisuels.js';
import { normNomRelais, nomRelaisPropre, cpDe } from './relaisColis.js';

export const CLE_DEPOT = 'vrm_depot_transporteurs';
export const GROUPE_A_CHOISIR = 'a-choisir';
export const NOM_A_CHOISIR = 'Point de dépôt à choisir';

// Le TYPE de point d'un transporteur : Shop2Shop se dépose dans un Pickup
// Chronopost ; Colissimo à La Poste. `null` = transporteur pas lu.
const FAMILLES = { shop2shop: 'chronopost', chronopost: 'chronopost', colissimo: 'laposte' };
export const familleDepot = (cleTr) => (cleTr ? (FAMILLES[cleTr] || cleTr) : null);
export const NOMS_FAMILLES = { chronopost: 'Chronopost / Shop2Shop', laposte: 'La Poste', mondialrelay: 'Mondial Relay', vinted: 'Vinted Go', relaiscolis: 'Relais Colis' };
export const nomFamille = (f) => NOMS_FAMILLES[f] || nomDuTransporteur(f) || 'Transporteur inconnu';

export const lireDepots = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

// L'identité d'un point de dépôt : son code Vinted s'il en a un, sinon nom + CP.
export const clePointDepot = (pt) => {
  if (!pt) return '';
  if (pt.code) return 'c:' + String(pt.code);
  const n = normNomRelais(nomRelaisPropre(pt.nom || '')); const cp = pt.cp || cpDe(pt.adresse || '');
  return n ? `n:${n}|${cp}` : '';
};

// Associer (ou retirer avec `null`) le point d'une famille. Rend la nouvelle carte.
export function associerDepot(reglage, famille, point, maintenant = Date.now()) {
  const r = { ...lireDepots(reglage) };
  if (!famille) return r;
  if (!point) { delete r[famille]; return r; }
  const cle = clePointDepot(point);
  if (!cle) return r;
  r[famille] = { cle, nom: String(point.nom || ''), adresse: String(point.adresse || ''), code: point.code ? String(point.code) : '', at: new Date(maintenant).toISOString() };
  return r;
}

// Le groupe d'un colis. `tr` = { cle, nom } (ou null).
export function groupeDepot(tr, reglage) {
  const f = familleDepot(tr && tr.cle ? tr.cle : (tr && tr.nom ? cleTransporteur(tr.nom) : null));
  const r = lireDepots(reglage);
  const pt = f ? r[f] : null;
  if (!pt || !pt.cle) return { cle: GROUPE_A_CHOISIR, nom: NOM_A_CHOISIR, aChoisir: true, famille: f };
  return { cle: 'd:' + pt.cle, nom: pt.nom || nomFamille(f), adresse: pt.adresse || '', code: pt.code || '', aChoisir: false, famille: f };
}

// Range les colis par point de dépôt : dans chaque groupe l'ordre reçu (le plus
// pressé d'abord, celui de l'écran) ; les groupes dans l'ordre de leur premier
// colis ; « à choisir » toujours en dernier. Chaque colis EXACTEMENT une fois.
// Rend [{ cle, nom, adresse, aChoisir, familles:[...], items:[...] }].
export function rangerParDepot(items, { trDe, reglage }) {
  const L = Array.isArray(items) ? items : [];
  const groupes = new Map();
  for (const x of L) {
    let g; try { g = groupeDepot(trDe(x), reglage); } catch (_) { g = { cle: GROUPE_A_CHOISIR, nom: NOM_A_CHOISIR, aChoisir: true, famille: null }; }
    if (!groupes.has(g.cle)) groupes.set(g.cle, { cle: g.cle, nom: g.nom, adresse: g.adresse || '', code: g.code || '', aChoisir: !!g.aChoisir, familles: [], items: [] });
    const G = groupes.get(g.cle);
    G.items.push(x);
    const fk = g.famille || 'inconnu';
    if (!G.familles.includes(fk)) G.familles.push(fk);
  }
  const out = [...groupes.values()];
  return [...out.filter((g) => !g.aChoisir), ...out.filter((g) => g.aChoisir)];
}

// Les points LUS proposés pour une famille : ceux de la liste de Vinted dont le
// transporteur est de cette famille (mêmes points une fois), puis les relais
// préférés (src/relaisPreferes.js) — jamais un point inventé.
export function choixPourFamille(famille, { carriers = [], preferes = {} } = {}) {
  const vus = new Set(), out = [];
  for (const c of (Array.isArray(carriers) ? carriers : [])) {
    if (familleDepot(cleTransporteur(c && c.carrier)) !== famille) continue;
    for (const p of (c.points || [])) {
      const pt = { code: p.code || '', nom: p.nom || '', adresse: p.adresse || '', horaires: p.ouverture || '', km: p.km ?? null, source: 'vinted' };
      const k = clePointDepot(pt); if (!k || vus.has(k)) continue; vus.add(k); out.push({ ...pt, cle: k });
    }
  }
  for (const k of Object.keys(preferes || {})) {
    const e = preferes[k] || {};
    const pt = { code: '', nom: e.nom || '', adresse: e.adresse || '', cp: e.cp || '', horaires: '', source: 'prefere' };
    const kk = clePointDepot(pt); if (!kk || vus.has(kk)) continue; vus.add(kk); out.push({ ...pt, cle: kk });
  }
  return out;
}
