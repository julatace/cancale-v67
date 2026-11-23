// ══════════════════════════════════════════════════════════════════════════
//  LES OFFRES REÇUES RESTÉES SANS RÉPONSE (22 nov. 2026, Julien — choix n° 33)
//  docs/passation/2026-11-22-offres-photos-resume.md
// ══════════════════════════════════════════════════════════════════════════
// « Offres reçues restées sans réponse » : la liste des offres REÇUES encore EN ATTENTE auxquelles il n'a ni répondu
// ni réagi, de la plus ancienne à la plus récente (« il y a 2 h », « hier »), avec la paire, le prix proposé face au
// prix de l'annonce et au plancher, la note de l'acheteur si elle est lue. Un toucher ouvre la conversation dans le
// PANNEAU de l'extension (les gestes d'offre se font là, CLAUDE.md §3) — rien n'est accepté, refusé ni écrit ici.
//
// ⚠️ UNE SEULE SOURCE PAR SITE (§5 « une seule règle par notion ») — ce module ne JUGE aucune offre :
//   · Vinted : `offreVintedEnAttente` (src/offresVinted.js), LA règle du fil — l'offre courante de l'ACHETEUR, statut
//     10 PROUVÉ (jamais déduit d'une absence), son identité (transaction + offre) ; l'app la lit déjà pour Messages
//     (`fetchOffresConversations`). Puis les règles qui la font sortir, celles de Messages : une offre confirmée
//     acceptée / refusée (`confirmees`), une annonce PROUVÉE plus en vente (`offreOuverte`). Une contre-offre de sa
//     part rend l'offre « précédente » (plus courante) : elle sort par la règle du fil, pas ici ;
//   · Vestiaire : `offresVestiaire(ligne).aTrancher` (src/offresVestiaire.js) — l'offre « à toi », ouverte, dernier
//     geste de l'acheteur, pas expirée (une expirée ne se tranche plus).
// ⚠️ « NI RÉPONDU NI RÉAGI » (Vinted) : un message de LUI dans le fil, daté APRÈS l'offre, la fait sortir (il a
//    réagi, l'offre l'attend dans le fil). Date de l'offre ou des messages pas lue ⇒ on ne sait pas qu'il a répondu ⇒
//    l'offre RESTE (une offre cachée à tort fait rater une vente ; « pas su » ne vaut pas « oui »).
// ⚠️ eBay et Leboncoin : aucune offre n'est rangée dans la base (eBay : lue en direct sur son écran ; Leboncoin : pas
//    d'offre lue) — ils sont NOMMÉS dans `nonLus`, jamais comptés « 0 ».
// Trois états : `undefined` en cours · `null` pas su · objet lu. Module PUR : scripts/audit-offres-sans-reponse.cjs
// l'exécute (avec les vraies règles des deux sites).

const arr = (a) => (Array.isArray(a) ? a : []);
const nb = (v) => (v == null || v === '' ? NaN : Number(v));
const tsDe = (m) => {
  const e = (m && m.entity) || {};
  const brut = m && m.created_at_ts != null ? m.created_at_ts : e.created_at_ts != null ? e.created_at_ts : m && m.created_at != null ? m.created_at : e.created_at;
  if (brut == null || brut === '') return null;
  const n = Number(brut);
  if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
  const p = Date.parse(brut);
  return Number.isFinite(p) ? p : null;
};

// A-t-il écrit dans le fil APRÈS l'offre ? true · false · null (pas su : date de l'offre absente, ou un message de
// lui sans date). `opp` = l'acheteur (opposite_user.id). Les messages de Vinted (sans auteur) ne comptent pas.
export function aReponduApres(messages, opp, tsOffre) {
  if (opp == null) return null;
  const t0 = nb(tsOffre);
  let pasSu = !Number.isFinite(t0);
  for (const m of arr(messages)) {
    if (!m || m.entity_type === 'offer_request_message') continue;
    const e = m.entity || {};
    if (e.user_id == null || String(e.user_id) === String(opp)) continue;   // l'acheteur, ou un message de Vinted
    const t = tsDe(m);
    if (t == null || !Number.isFinite(t0)) { pasSu = true; continue; }
    if (t > t0) return true;
  }
  return pasSu ? null : false;
}

// « il y a 2 h », « hier »… : rend { cle, n } pour `tr('osr.age.' + cle, { n })` (le texte vit dans src/i18n).
export function ageOffre(ts, maintenant = Date.now()) {
  const t = nb(ts);
  if (!Number.isFinite(t)) return { cle: 'inconnu', n: 0 };
  const d = Math.max(0, Number(maintenant) - t);
  const min = Math.floor(d / 60000);
  if (min < 60) return { cle: 'minutes', n: Math.max(1, min) };
  const h = Math.floor(min / 60);
  const debut = new Date(maintenant); debut.setHours(0, 0, 0, 0);
  const hier = debut.getTime() - 86400000;
  if (t >= debut.getTime()) return { cle: 'heures', n: h };
  if (t >= hier) return { cle: 'hier', n: 1 };
  return { cle: 'jours', n: Math.max(2, Math.round((debut.getTime() - new Date(t).setHours(0, 0, 0, 0)) / 86400000)) };
}

// L'entrée :
//   vinted   : Map `${uid}_${conv}` → { prix, tx, oid, ts, titre, item, side, msgs?, opp?, note? }  (fetchOffresConversations)
//              · undefined (en cours) · null (pas su)
//   confirmees : Set des clés `uid:tx:oid` dont l'acceptation / le refus est confirmé (Messages)
//   ouverte  : (off, uid) → off | null — la règle de Messages (`offreOuverte`) : null = annonce prouvée partie
//   vestiaire : `offresVestiaire(ligne)` (etat 'lu' | 'passu' | 'encours' | 'jamais')
//   comptes  : Set des uid de SES comptes vendeurs retenus (un compte écarté n'entre pas) ; null = tous
//   ficheDe(uid, item) → { prix, mini, plancher } | null — le prix de l'annonce, SON prix mini, le plancher (lus par
//              l'app : la fiche par IDENTITÉ de l'annonce, jamais le titre)
// Rend { etat, lignes, n, nonLus } — `lignes` de la plus ancienne à la plus récente (date pas lue : à la fin).
export function offresSansReponse({ vinted, confirmees = null, ouverte = (o) => o, vestiaire = null, comptes = null, ficheDe = () => null, maintenant = Date.now() } = {}) {
  const nonLus = ['ebay', 'leboncoin'];
  if (vinted === undefined && (!vestiaire || vestiaire.etat === 'encours')) return { etat: 'encours', lignes: [], n: 0, nonLus };
  const lignes = [];
  let pasSu = false, unLu = false;
  if (vinted instanceof Map) {
    unLu = true;
    for (const [cle, off0] of vinted) {
      const m = /^(\d+)_(\d+)$/.exec(String(cle));
      if (!m || !off0) continue;
      const [, uid, conv] = m;
      if (comptes && typeof comptes.has === 'function' && !comptes.has(uid)) continue;
      if (off0.side === 'buyer') continue;                                     // une contre-offre d'un vendeur à qui IL achète
      if (confirmees && typeof confirmees.has === 'function' && confirmees.has(`${uid}:${off0.tx}:${off0.oid}`)) continue;
      const off = ouverte(off0, uid);
      if (!off) continue;                                                       // l'annonce est prouvée partie
      if (off0.msgs !== undefined && aReponduApres(off0.msgs, off0.opp, off0.ts) === true) continue;
      const f = ficheDe(uid, off0.item) || null;
      lignes.push({ site: 'vinted', cle: `v:${uid}:${off0.tx}:${off0.oid}`, uid, conv, id: conv, tx: String(off0.tx), oid: String(off0.oid),
        offre: Number(off0.prix), titre: String(off0.titre || ''), item: off0.item != null ? String(off0.item) : '',
        prix: f && Number.isFinite(f.prix) ? f.prix : null, mini: f && Number.isFinite(f.mini) ? f.mini : null, plancher: f && Number.isFinite(f.plancher) ? f.plancher : null,
        numero: f && f.numero ? String(f.numero) : '', photo: f && f.photo ? f.photo : null,
        ts: Number.isFinite(nb(off0.ts)) ? nb(off0.ts) : null, note: off0.note || null, age: ageOffre(off0.ts, maintenant) });
    }
  } else if (vinted === null) { pasSu = true; nonLus.unshift('vinted'); }
  if (vestiaire && vestiaire.etat === 'lu') {
    unLu = true;
    for (const o of arr(vestiaire.aTrancher)) {
      if (!o || !o.id) continue;
      const ts = Number.isFinite(o.dernierAt) ? o.dernierAt : null;
      lignes.push({ site: 'vestiaire', cle: `vc:${o.id}`, uid: String(o.compte || ''), conv: '', id: String(o.id), tx: '', oid: String(o.id),
        offre: Number.isFinite(o.offre) ? o.offre / 100 : null, titre: String(o.titre || ''), item: String(o.produit || ''),
        prix: Number.isFinite(o.initial) ? o.initial / 100 : null, mini: Number.isFinite(o.min) ? o.min / 100 : null, plancher: null, numero: '', photo: o.photo || null,
        ts, note: null, expire: Number.isFinite(o.expire) ? o.expire : null, age: ageOffre(ts, maintenant) });
    }
  } else if (vestiaire && vestiaire.etat === 'passu') { pasSu = true; nonLus.push('vestiaire'); }
  lignes.sort((a, b) => (a.ts == null ? Infinity : a.ts) - (b.ts == null ? Infinity : b.ts) || String(a.cle).localeCompare(String(b.cle)));
  if (!unLu) return { etat: pasSu ? 'passu' : 'encours', lignes: [], n: 0, nonLus };
  return { etat: 'lu', lignes, n: lignes.length, nonLus, partiel: pasSu };
}

// L'offre face au prix et au plancher : 'sous' (sous le prix mini ou le plancher) · 'ok' · null (rien à comparer).
export function offreFace(l) {
  if (!l || !Number.isFinite(l.offre)) return null;
  const bas = [l.mini, l.plancher].filter((x) => Number.isFinite(x));
  if (!bas.length) return null;
  return l.offre < Math.max(...bas) ? 'sous' : 'ok';
}

// Ce que l'écran publie pour Aujourd'hui (un propriétaire, §11) : le compte et la plus ancienne, sur CET appareil.
export const CLE_PUB_OSR = 'vrm_offres_sans_reponse';
export const EVT_OSR = 'vrm:offres-sans-reponse';
export function publierOffresSansReponse(res, { owner = '', maintenant = Date.now() } = {}) {
  if (!res || res.etat !== 'lu') return false;
  // (23 nov., Conseiller) + la somme des offres au montant LU (`nSomme` dit combien en ont un : le Conseiller ne la dit que
  // si TOUTES l'ont) et jusqu'à 4 photos de SES annonces concernées (le mini-visuel du conseil). Jamais un acheteur.
  const avecMontant = res.lignes.filter((l) => l && Number.isFinite(Number(l.offre)) && Number(l.offre) > 0);
  const p = { owner: String(owner || ''), n: res.n, plusAncienne: res.lignes[0] ? res.lignes[0].ts : null, partiel: !!res.partiel, at: maintenant,
    somme: Math.round(avecMontant.reduce((t, l) => t + Number(l.offre), 0) * 100) / 100, nSomme: res.partiel ? -1 : avecMontant.length,
    photos: res.lignes.map((l) => (l && typeof l.photo === 'string' ? l.photo : '')).filter(Boolean).slice(0, 4) };
  try {
    const avant = JSON.parse(localStorage.getItem(CLE_PUB_OSR) || 'null');
    if (avant && JSON.stringify({ ...avant, at: 0 }) === JSON.stringify({ ...p, at: 0 })) return false;
    localStorage.setItem(CLE_PUB_OSR, JSON.stringify(p));
  } catch (_) { return false; }
  try { window.dispatchEvent(new CustomEvent(EVT_OSR, { detail: p })); } catch (_) {}
  return true;
}
