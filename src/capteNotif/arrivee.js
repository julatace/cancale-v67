// ═══════════════════════════════════════════════════════════════════════════
// « CE QUE L'EXTENSION A CAPTÉ DEPUIS TA DERNIÈRE VISITE » (19 nov., ext. 5.409) — règles PURES
// ═══════════════════════════════════════════════════════════════════════════
// Julien, mot pour mot : « je veux que quand je rentre sur l'app, et que l'extension a capté
// quelque chose, on est informé avec un pop up ».
// La SOURCE est celle du toast de la 5.377 (`annoncerCapte` dans background.js : une écriture
// RÉUSSIE, nouveau PAR IDENTITÉ, jamais au point de départ), rangée désormais dans les lignes
// `capte_journal_{navigateur}` (une par Chrome) : { e: [{ p, c, s, id, t, q? }] }.
// Ici :
//   · `fusionner(rows)` : toutes les lignes (tous les Chrome), UNE entrée par identité
//     (site | compte | sorte | identité) — deux Chrome qui ont rangé la même vente = une ligne ;
//   · `depuis(entrees, vu)` : ce qui est né APRÈS le marqueur « vu » ; marqueur absent (premier
//     passage sur cet appareil ET nulle part ailleurs) ⇒ rien (pas su ce qui est nouveau), on pose
//     le marqueur en silence ;
//   · `groupes(entrees)` : par sorte, dans l'ordre fixe, le plus récent d'abord ;
//   · `lienDe(entree)` : l'adresse de l'élément, par IDENTITÉ seulement (api/_lib/lien-notif.js,
//     la même que les notifications) — jamais un titre ;
//   · `marqueur(local, nuage)` : le plus récent des deux (vu ici OU vu sur un autre appareil).
// ═══════════════════════════════════════════════════════════════════════════
import { lienNotif, DESTINATIONS } from '../../api/_lib/lien-notif.js';

export const SORTES_ARRIVEE = Object.freeze(['refus', 'ventes', 'codes', 'bordereaux', 'achats', 'offres', 'messages', 'versements', 'numerotes', 'annonces']);
const SITES = new Set(['vinted', 'leboncoin', 'vestiaire']);
const RE_ID = /^[\w:.@+-]{1,120}$/;
const RE_COMPTE = /^[\w:.-]{1,80}$/;
export const LIGNE_JOURNAL_CAPTE = 'capte_journal_';
export const SELECT_JOURNAL_CAPTE = 'id=like.capte_journal_*&select=id,e:data->e';
export const CLE_VU_NUAGE = 'vrm_capte_vu';         // synchronisé (SYNC_KEYS) : { at }
export const CLE_VU_ICI = 'vrm_capte_vu_ici';       // cet appareil seulement (localStorage)
export const PAR_GROUPE = 5;                         // au-delà : « Voir les N autres »

export function entreeValide(x) {
  if (!x || typeof x !== 'object') return null;
  if (!SITES.has(x.p) || !SORTES_ARRIVEE.includes(x.s)) return null;
  const c = String(x.c == null ? '' : x.c), id = String(x.id == null ? '' : x.id), t = Number(x.t);
  if (!RE_COMPTE.test(c) || !RE_ID.test(id) || !(t > 1.5e12 && t < 4e12)) return null;
  const e = { p: x.p, c, s: x.s, id, t };
  if (x.s === 'refus' && /^[a-z0-9]{1,12}$/.test(String(x.q || ''))) e.q = String(x.q);
  return e;
}
export const cleEntree = (e) => `${e.p}|${e.c}|${e.s}|${e.id}`;

// Toutes les lignes ⇒ une entrée par identité (la PREMIÈRE fois qu'un Chrome l'a rangée).
export function fusionner(rows) {
  if (!Array.isArray(rows)) return null;              // pas su
  const m = new Map();
  for (const r of rows) {
    if (!r || !/^capte_journal_[0-9a-f]{16}$/.test(String(r.id || ''))) continue;
    for (const x of Array.isArray(r.e) ? r.e : []) {
      const e = entreeValide(x); if (!e) continue;
      const k = cleEntree(e), a = m.get(k);
      if (!a || e.t < a.t) m.set(k, e);
    }
  }
  return [...m.values()];
}
export function marqueur(local, nuage) {
  const a = Number(local), b = Number(nuage && typeof nuage === 'object' ? nuage.at : nuage);
  const v = Math.max(Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0);
  return v > 0 ? v : null;
}
// Ce qui est né après le marqueur ; `comptesExclus` : un compte retiré n'est jamais dit.
export function depuis(entrees, vu, { comptesExclus = null } = {}) {
  if (!Array.isArray(entrees) || !(Number(vu) > 0)) return [];
  return entrees.filter((e) => e.t > Number(vu) && !(comptesExclus && comptesExclus.has(`${e.p}:${e.c}`)));
}
export function groupes(entrees) {
  const out = [];
  for (const s of SORTES_ARRIVEE) {
    const l = (entrees || []).filter((e) => e.s === s).sort((a, b) => b.t - a.t);
    if (l.length) out.push({ s, n: l.length, entrees: l });
  }
  return out;
}
// L'identité de l'élément dans l'entrée (« tx:code » pour un code, « conv@date » pour un message…).
export function identiteDe(e) {
  const id = String(e.id);
  if (e.s === 'codes') return { tx: id.split(':')[0] };
  if (e.s === 'messages' || e.s === 'offres') return { conv: id.split(/[@:]/)[0] };
  if (e.s === 'numerotes') { const [item, num] = id.split(':'); return { item, num }; }
  return { tx: id };
}
// L'adresse de l'élément (par identité ; site inconnu de la cible ⇒ l'écran, sans cible).
export function lienDe(e) {
  const i = identiteDe(e), p = e.p;
  const tx = /^\d{1,20}$/.test(String(i.tx || '')) ? i.tx : '';
  switch (e.s) {
    case 'ventes': case 'versements':
      if (p === 'vinted') return DESTINATIONS.vente({ tx });
      if (p === 'vestiaire') return DESTINATIONS.vcVente({ id: i.tx });
      return lienNotif('ventes', { site: p, ...(i.tx ? { cible: 'lbcvente', tx: i.tx } : {}) });
    case 'bordereaux': return DESTINATIONS.colis({ tx });
    case 'codes': return DESTINATIONS.retrait({ tx });
    case 'achats': return p === 'vinted' ? DESTINATIONS.achat({ tx }) : lienNotif('achats', { vue: 'achats' });
    case 'messages': case 'offres':
      if (p === 'vinted') return lienNotif('messages', { site: 'vinted', compte: e.c, ...(/^\d{1,20}$/.test(i.conv || '') ? { cible: e.s === 'offres' ? 'offre' : 'conv', conv: i.conv } : {}) });
      return lienNotif('messages', { site: p });
    case 'numerotes': case 'annonces': return lienNotif('annonces', { site: p });
    case 'refus': return DESTINATIONS.toutVaBien();
    default: return lienNotif('journee');
  }
}
// L'écran d'un groupe entier (« Voir les N autres »).
export function lienGroupe(g) {
  const p = (g.entrees[0] || {}).p || 'vinted';
  switch (g.s) {
    case 'ventes': case 'versements': return lienNotif('ventes', { site: p });
    case 'bordereaux': return DESTINATIONS.colis({});
    case 'codes': return DESTINATIONS.retrait({});
    case 'achats': return DESTINATIONS.achat({});
    case 'messages': case 'offres': return lienNotif('messages', { site: p });
    case 'refus': return DESTINATIONS.toutVaBien();
    default: return lienNotif('annonces', { site: p });
  }
}
// Le marqueur à poser quand il a vu la feuille : l'entrée la plus récente montrée (jamais « maintenant » :
// ce qui arrive pendant qu'il la lit sera dit la prochaine fois).
export function vuJusqua(entrees, avant) {
  let m = Number(avant) || 0;
  for (const e of entrees || []) if (e.t > m) m = e.t;
  return m || null;
}
