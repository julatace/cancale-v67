// ════════════════════════════════════════════════════════════════════════════
//  OÙ PARTENT TES PAIRES — LA CARTE DES VENTES (14 nov., frais-carte — proposition
//  124 choisie par Julien : « tu peux même faire du monde »). Règle PURE.
//
//  LA POPULATION : les ventes FAITES (`liveStats.venduLignes`, `ventesFaites` de
//  api/_lib/ventes-regle.js — la règle de « Vendu », comptes sélectionnés, ventes
//  prouvées, toutes plateformes) ; rien n'est recompté ici (§11), on les PLACE.
//
//  LE LIEU — par IDENTITÉ seulement (§5), jamais par ressemblance :
//   · Vinted   : le PAYS du profil de l'acheteur, lu dans le détail de SA transaction
//                (`harvest_*_txn_{tx}` → `transaction.buyer.country_code`, la lecture
//                de « Ce qui se vend », `lireExtrasRepartition`) — Vinted ne donne
//                aucune ville d'une vente (mesuré le 14 nov.) ;
//   · eBay     : la VILLE, le code postal et le pays de livraison de SA commande
//                (`fulfillmentStartInstructions[0].shippingStep.shipTo.contactAddress`,
//                `city`, `postalCode`, `countryCode`) — jamais le nom, jamais la rue ;
//   · Leboncoin, Vestiaire : aucun lieu rangé ⇒ « sans lieu », dit.
//  Rien d'autre ne sort d'ici : ni nom, ni pseudo, ni adresse, ni compte, ni n° de
//  transaction — une vente listée = son N° (relevé de Ventes, par identité), sa
//  date, son montant, sa plateforme.
//
//  L'AGRÉGAT : par PAYS (le monde) ; en France, par VILLE quand la ville est connue
//  ET placée (repère gardé, `coordVille`), sinon par DÉPARTEMENT (préfecture, repère
//  embarqué, `approx`) — jamais une épingle inventée. Une vente française sans ville
//  (Vinted) compte dans la bulle « France » du monde, et à part en France
//  (`franceSansVille`). Un pays absent de la table des repères ⇒ listé `horsCarte`.
//  Montants en CENTIMES ; un montant illisible ne s'additionne pas (`nSansMontant`).
//  Exécuté par scripts/audit-frais-carte.cjs.
// ════════════════════════════════════════════════════════════════════════════
import { REPERES_PAYS, PREFECTURES, departementDuCp } from './lieuxTables.js';

export const PLATEFORMES_LIEU = ['Vinted', 'eBay', 'Vestiaire', 'Leboncoin', 'Ailleurs'];
const PREFIXE = { Vinted: '', Leboncoin: 'lbc:', eBay: 'ebay:', Vestiaire: 'vestiaire:' };
const cents = (e) => (e != null && e !== '' && Number.isFinite(Number(e)) ? Math.round(Number(e) * 100) : null);

// L'identité d'une vente dans le relevé de Ventes (`vrm_stats_ventes`, [2]).
export const idReleve = (l) => {
  if (!l || l.tx == null || l.tx === '') return '';
  const tx = String(l.tx);
  if (l.plateforme in PREFIXE) return (tx.startsWith(PREFIXE[l.plateforme]) ? '' : PREFIXE[l.plateforme]) + tx;
  return tx;
};
// N° par identité : [plateforme, compte, id, ts, …, [8] N°].
export function numerosDuReleve(releve) {
  const m = new Map();
  for (const r of (Array.isArray(releve) ? releve : [])) {
    if (!Array.isArray(r) || r[2] == null) continue;
    const k = String(r[0]) + '|' + String(r[2]);
    const n = String(r[8] || '').trim();
    if (n && !m.has(k)) m.set(k, n);
  }
  return m;
}

// « LYON » ⇒ « Lyon » ; « saint-étienne » ⇒ « Saint-Étienne » ; le reste tel quel.
export const nomVille = (v) => {
  const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!s) return '';
  if (s === s.toUpperCase() || s === s.toLowerCase()) return s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  return s;
};
export const cleVille = (dep, ville) => 'v|' + dep + '|' + String(ville || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\bst\b/g, 'saint').replace(/[^a-z0-9]+/g, ' ').trim();

// Le lieu d'UNE vente : { pays, ville?, cp?, dep?, source } | null (pas de lieu connu) — jamais un nom.
export function lieuDeVente(l, { paysVinted, ebayParId } = {}) {
  if (!l) return null;
  if (l.plateforme === 'Vinted') {
    const cc = paysVinted && l.tx != null ? paysVinted[String(l.tx)] : null;
    const pays = cc && typeof cc === 'object' ? cc.cc : cc;
    return pays && /^[A-Za-z]{2}$/.test(String(pays)) ? { pays: String(pays).toUpperCase(), source: 'profil' } : null;
  }
  if (l.plateforme === 'eBay') {
    const o = ebayParId && l.tx != null ? ebayParId.get(String(l.tx).replace(/^ebay:/, '')) : null;
    const ins = o && Array.isArray(o.fulfillmentStartInstructions) ? o.fulfillmentStartInstructions[0] : null;
    const adr = ins && ins.shippingStep && ins.shippingStep.shipTo && ins.shippingStep.shipTo.contactAddress;
    if (!adr || !/^[A-Za-z]{2}$/.test(String(adr.countryCode || ''))) return null;
    const pays = String(adr.countryCode).toUpperCase();
    const ville = nomVille(adr.city);
    const cp = String(adr.postalCode || '').replace(/\s+/g, '');
    const dep = pays === 'FR' || pays === 'MC' ? departementDuCp(cp) : null;
    return { pays: pays === 'MC' ? 'MC' : pays, ...(ville ? { ville } : {}), ...(cp ? { cp } : {}), ...(dep ? { dep } : {}), source: 'livraison' };
  }
  return null;
}

// La raison pour laquelle une vente n'a pas de lieu (une clé, dite par l'écran).
const raisonSansLieu = (l, paysVinted) => {
  if (l.plateforme === 'Vinted') return paysVinted == null ? 'paysPasLu' : 'detailPasLu';
  if (l.plateforme === 'eBay') return 'adresseAbsente';
  return 'siteNeDonnePas';
};

// lignes : `venduLignes` | null (pas su) | undefined (en cours) ; paysVinted : { tx: 'FR' | {cc} } | null | undefined ;
// ebay : commandes | null ; releve : lignes de `vrm_stats_ventes` (les N°) ; [de, a) en ms ;
// plateforme : 'tout' | nom ; coordVille(cle) → { lat, lon } | null (repère gardé d'une ville).
export function lieuxVentes({ lignes, paysVinted, ebay, releve, de = -Infinity, a = Infinity, plateforme = 'tout', coordVille = () => null, ecarte = null } = {}) {
  if (lignes === undefined) return { etat: 'encours' };
  if (!Array.isArray(lignes)) return { etat: 'passu' };
  const ebayParId = new Map();
  for (const o of (Array.isArray(ebay) ? ebay : [])) if (o && o.orderId != null) ebayParId.set(String(o.orderId), o);
  const nums = numerosDuReleve(releve);
  const R = { etat: 'lu', n: 0, c: 0, nSansMontant: 0, avecLieu: 0, plateformes: [], pays: [], france: [], franceSansVille: { n: 0, c: 0 },
    sansLieu: { n: 0, c: 0, par: {} }, paysEnCours: paysVinted === undefined };
  const vues = new Set();
  const P = new Map(), F = new Map();
  const bulle = (M, cle, init) => M.get(cle) || (M.set(cle, { cle, ...init, n: 0, c: 0, nSansMontant: 0, ventes: [] }), M.get(cle));
  const compter = (b, v) => { b.n += 1; if (v.c == null) b.nSansMontant += 1; else b.c += v.c; b.ventes.push(v); };
  for (const l of lignes) {
    if (!l || !Number.isFinite(l.ts) || l.ts < de || l.ts >= a) continue;
    if (typeof ecarte === 'function' && ecarte(l)) continue;
    vues.add(String(l.plateforme || ''));
    if (plateforme !== 'tout' && l.plateforme !== plateforme) continue;
    const v = { num: nums.get(String(l.plateforme) + '|' + idReleve(l)) || '', ts: l.ts, c: cents(l.eur), plateforme: String(l.plateforme || '') };
    R.n += 1; if (v.c == null) R.nSansMontant += 1; else R.c += v.c;
    const lieu = lieuDeVente(l, { paysVinted, ebayParId });
    if (!lieu) {
      const k = raisonSansLieu(l, paysVinted);
      R.sansLieu.n += 1; if (v.c != null) R.sansLieu.c += v.c;
      const p = R.sansLieu.par[v.plateforme] || (R.sansLieu.par[v.plateforme] = { n: 0, raison: k });
      p.n += 1;
      continue;
    }
    R.avecLieu += 1;
    const rep = REPERES_PAYS[lieu.pays];
    compter(bulle(P, lieu.pays, { pays: lieu.pays, lat: rep ? rep[0] : null, lon: rep ? rep[1] : null, horsCarte: !rep }), v);
    if (lieu.pays !== 'FR') continue;
    if (!lieu.dep) { R.franceSansVille.n += 1; if (v.c != null) R.franceSansVille.c += v.c; continue; }
    const cv = lieu.ville ? cleVille(lieu.dep, lieu.ville) : null;
    const pos = cv ? coordVille(cv) : null;
    if (cv && pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lon)) {
      compter(bulle(F, cv, { niveau: 'ville', ville: lieu.ville, dep: lieu.dep, cp: lieu.cp || '', lat: pos.lat, lon: pos.lon, approx: false }), v);
    } else {
      const pr = PREFECTURES[lieu.dep];
      const b = bulle(F, 'd|' + lieu.dep, { niveau: 'departement', dep: lieu.dep, lat: pr[0], lon: pr[1], approx: true, villes: [] });
      compter(b, v);
      if (cv && !b.villes.some((x) => x.cle === cv)) b.villes.push({ cle: cv, ville: lieu.ville, cp: lieu.cp || '' });
    }
  }
  const ordre = (x, y) => y.n - x.n || y.c - x.c || String(x.cle).localeCompare(String(y.cle));
  const fin = (b) => { b.ventes.sort((x, y) => y.ts - x.ts); return b; };
  R.pays = [...P.values()].map(fin).sort(ordre);
  R.france = [...F.values()].map(fin).sort(ordre);
  R.plateformes = PLATEFORMES_LIEU.filter((p) => vues.has(p));
  // Les villes à placer (une recherche par VILLE, jamais par vente) : celles qui n'ont pas encore de repère.
  R.villesAPlacer = R.france.filter((b) => b.niveau === 'departement').flatMap((b) => b.villes.map((x) => ({ cle: x.cle, ville: x.ville, cp: x.cp, dep: b.dep })));
  return R;
}

// Le rayon d'une bulle (px) : l'aire suit le nombre de ventes, sur une échelle FIXE (deux cartes, deux vues :
// 15 ventes ont toujours la même taille), bornée.
export const rayonBulle = (n, _max, { min = 9, maxi = 30, k = 2.2 } = {}) => (!(n > 0) ? min : Math.round(Math.max(min, Math.min(maxi, 6 + k * Math.sqrt(n)))));
