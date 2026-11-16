// ══════════════════════════════════════════════════════════════════════════
// LA PHOTO IDENTIQUE EST UNE IDENTITÉ (16 nov., lot photo-identite-sites).
//
// Julien : « quand je poste la paire sur Leboncoin et Vinted sans passer par VRM,
// VRM la reconnaît parce que la photo utilisée est exactement la même — pas les
// autres caractéristiques ». Et : « Vinted utilise ça pour éviter qu'on poste des
// doublons : il voit quand c'est exactement la même photo, alors que quand je poste
// le même article avec des photos différentes, ça passe ».
//
// CLAUDE.md §5 : la photo est une IDENTITÉ (le même fichier) — jamais le titre, la
// marque, la taille. Les sites RECOMPRESSENT (Vinted sert du WebP redimensionné,
// Leboncoin du JPEG réencodé : un hachage du fichier ne se retrouve jamais d'un site
// à l'autre). « La même photo » se reconnaît donc comme le font les plateformes, par
// la même FAMILLE de méthode (empreinte perceptuelle d'une image normalisée) — mais
// avec DEUX mesures de nature différente (src/photoEmpreinte.js puis src/photoFine.js,
// tableau de fiabilité : 0 faux « sûr » sur 84 018 couples de photos différentes,
// dont 2 × 50 exemplaires du même modèle photographiés au même endroit).
//
// • « Même photo · sûr » (les deux mesures nettes, src/memePhoto.js `etatCouple`), une
//   SEULE paire, N° non douteux, photo non générique (< 3 paires), jamais refusée par lui
//   ⇒ IDENTITÉ : l'annonce porte le N° de la paire Vinted, comme un lien posé à la main.
// • Une empreinte seulement PROCHE (« à vérifier ») n'est PAS une identité : elle reste
//   une proposition, SON toucher relie (§5).
// • Deux paires (deux N°) sous la même photo ⇒ RIEN n'est déduit, c'est dit.
// • Rien n'est ÉCRIT : l'identité par la photo est CALCULÉE à chaque lecture et
//   superposée aux liens qu'il a posés (`liensLbcAvecPhoto`, `liensVcAvecPhoto`) ; ses
//   liens gagnent toujours, un lien qu'il a DÉFAIT (valeur vide) n'est jamais refait.
//   Une lecture ratée (empreintes non lues) ⇒ aucune identité par la photo.
// • Leboncoin et Vestiaire seulement : eBay n'a qu'une mesure (pas d'accès aux pixels
//   `i.ebayimg.com` pour la seconde), il n'est donc jamais « sûr » ⇒ jamais une identité.
// • Vestiaire : une annonce à qui VRM a DÉJÀ donné un N° (écrit sur un carton) ne change
//   pas de N° toute seule (§5) : elle reste une proposition (« un seul N° », N° à barrer).
// Module PUR : l'app et `scripts/audit-photo-identite.cjs` exécutent les mêmes fonctions.
// ══════════════════════════════════════════════════════════════════════════

export const SITES_IDENTITE_PHOTO = ['Leboncoin', 'Vestiaire'];
// ⚠️ (16 nov., Julien : « non pas à quoi elle ressemble, mais son CODE ») L'identité AUTOMATIQUE vient du
// CODE EXACT de la photo d'origine (SHA-256 des octets du fichier qu'il téléverse, src/photoOrigine.js).
// La ressemblance (« même photo · sûr », deux mesures) reste une PROPOSITION : son passage en identité
// est ÉTEINT tant que Julien ne l'a pas validé. Ne pas allumer sans sa décision.
export const IDENTITE_PAR_RESSEMBLANCE = false;
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const arr = (a) => (Array.isArray(a) ? a : []);
const cleNumDefaut = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
const plein = (v) => v != null && String(v).trim() !== '';

// Les identités par la photo, d'après le résultat de `propositionsMemePhoto` (src/memePhoto.js).
// `liensLbc` : SES liens Leboncoin (`vrm_lbc_liens`, une clé présente — même vide — est SA décision) ;
// `liensVc`  : SES liens Vestiaire (`vrm_vc_liens`) ; `numerosVc` : les N° que VRM a donnés aux
// annonces Vestiaire (`vrm_vc_numeros`, carte productId ⇒ N°).
// Rend { lu, Leboncoin: { [annonce]: N° }, Vestiaire: { [productId]: { numero, item, de:'', par:'photo' } },
//        liste: [{ plateforme, id, numero, vintedId, proposition }], ids: Set('Site:annonce') }.
export function identitesParPhoto(res, { liensLbc = {}, liensVc = {}, numerosVc = {}, cle = cleNumDefaut, ressemblance = IDENTITE_PAR_RESSEMBLANCE } = {}) {
  const out = { lu: false, Leboncoin: {}, Vestiaire: {}, liste: [], ids: new Set() };
  if (!res || !res.lu) return out;
  out.lu = true;
  if (!ressemblance) return out;                                          // éteinte : la ressemblance propose seulement
  const LL = objet(liensLbc) || {}, LV = objet(liensVc) || {}, NV = objet(numerosVc) || {};
  for (const p of arr(res.propositions)) {
    if (!p || p.etat !== 'sur' || !p.annonce || !SITES_IDENTITE_PHOTO.includes(p.annonce.plateforme)) continue;
    const n = cle(p.numero || '');
    if (!n) continue;
    const id = String(p.annonce.id);
    const v = arr(p.vinted)[0] || {};
    // Toutes les annonces Vinted de la proposition portent le MÊME N° (sinon : ambigu, pas ici).
    if (arr(p.vinted).some((x) => x && plein(x.numero) && cle(x.numero) !== n)) continue;
    if (p.annonce.plateforme === 'Leboncoin') {
      if (Object.prototype.hasOwnProperty.call(LL, id)) continue;          // son lien, ou son « délier »
      out.Leboncoin[id] = String(p.numero);
    } else {
      if (Object.prototype.hasOwnProperty.call(LV, id)) continue;
      if (plein(NV[id])) continue;                                         // un N° déjà donné : jamais changé tout seul
      if (!/^\d{1,15}$/.test(String(v.id || ''))) continue;
      out.Vestiaire[id] = { numero: String(p.numero), item: String(v.id), de: '', at: null, ecrit: null, par: 'photo' };
    }
    out.ids.add(`${p.annonce.plateforme}:${id}`);
    out.liste.push({ plateforme: p.annonce.plateforme, id, numero: String(p.numero), vintedId: v.id != null ? String(v.id) : '', par: 'ressemblance', proposition: p });
  }
  return out;
}

// Ses liens d'abord, puis la photo là où il n'a rien décidé.
export function liensLbcAvecPhoto(manuels, ident) {
  const m = objet(manuels) || {};
  const p = ident && ident.lu ? objet(ident.Leboncoin) || {} : {};
  if (!Object.keys(p).length) return m;
  const out = { ...m };
  for (const [id, n] of Object.entries(p)) if (!Object.prototype.hasOwnProperty.call(m, id) && plein(n)) out[id] = n;
  return out;
}
export function liensVcAvecPhoto(manuels, ident) {
  const m = objet(manuels) || {};
  const p = ident && ident.lu ? objet(ident.Vestiaire) || {} : {};
  if (!Object.keys(p).length) return m;
  const out = { ...m };
  for (const [id, e] of Object.entries(p)) if (!Object.prototype.hasOwnProperty.call(m, id) && e && plein(e.numero)) out[id] = e;
  return out;
}

// Le résultat montré : les propositions qui sont devenues des identités sortent de « à relier »
// (rien à faire pour lui) et passent dans `reconnues` ; les comptes suivent.
export function avecIdentites(res, ident) {
  if (!res) return res;
  if (!res.lu) {
    // Les empreintes (ressemblance) pas lues : les identités par le CODE restent vraies et visibles.
    const reconnues = arr(ident && ident.liste).map((x) => x.reconnue).filter(Boolean);
    const reconnuesParNumero = new Map();
    for (const p of reconnues) { if (!reconnuesParNumero.has(p.numero)) reconnuesParNumero.set(p.numero, []); reconnuesParNumero.get(p.numero).push(p); }
    return { ...res, reconnues, reconnuesParNumero, nReconnues: reconnues.length, ambigusCode: arr(ident && ident.ambigus) };
  }
  const ids = ident && ident.ids instanceof Set ? ident.ids : new Set();
  const cleA = (p) => `${p.annonce.plateforme}:${p.annonce.id}`;
  const ambCode = new Set(arr(ident && ident.ambigus).map((x) => `${x.annonce.plateforme}:${x.annonce.id}`));
  const propositions = arr(res.propositions).filter((p) => !ids.has(cleA(p)) && !ambCode.has(cleA(p)));
  // Reconnues : par le CODE d'origine (`reconnue`, src/photoOrigine.js) ou par la ressemblance (`proposition`).
  const reconnues = arr(ident && ident.liste).map((x) => (x.reconnue ? x.reconnue : x.proposition ? { ...x.proposition, par: x.par || 'ressemblance' } : null)).filter(Boolean);
  const ambigus = [...arr(res.ambigus).filter((x) => !ids.has(`${x.annonce.plateforme}:${x.annonce.id}`) && !ambCode.has(`${x.annonce.plateforme}:${x.annonce.id}`)), ...arr(ident && ident.ambigus)];
  const parNumero = new Map();
  for (const p of propositions) { if (!parNumero.has(p.numero)) parNumero.set(p.numero, []); parNumero.get(p.numero).push(p); }
  const reconnuesParNumero = new Map();
  for (const p of reconnues) { if (!reconnuesParNumero.has(p.numero)) reconnuesParNumero.set(p.numero, []); reconnuesParNumero.get(p.numero).push(p); }
  const nARelier = propositions.length + ambigus.filter((x) => x.raison !== 'sans-numero').length;
  const nSurs = propositions.filter((p) => p.etat === 'sur').length;
  return { ...res, propositions, ambigus, reconnues, parNumero, reconnuesParNumero, nARelier, nSurs, nAVerifier: nARelier - nSurs, nReconnues: reconnues.length };
}

// Les deux sources réunies : le CODE d'abord (exact), la ressemblance ensuite (si allumée) là où le code ne dit rien.
export function fusionnerIdentites(code, ress) {
  const a = code && code.lu ? code : null, b = ress && ress.lu ? ress : null;
  if (!a && !b) return { lu: false, Leboncoin: {}, Vestiaire: {}, liste: [], ids: new Set(), ambigus: [] };
  const out = { lu: true, Leboncoin: { ...((a && a.Leboncoin) || {}) }, Vestiaire: { ...((a && a.Vestiaire) || {}) }, liste: [...((a && a.liste) || [])], ids: new Set((a && a.ids) || []), ambigus: [...((a && a.ambigus) || [])] };
  const bloques = new Set([...out.ids, ...out.ambigus.map((x) => `${x.annonce.plateforme}:${x.annonce.id}`)]);
  for (const x of (b && b.liste) || []) {
    const k = `${x.plateforme}:${x.id}`;
    if (bloques.has(k)) continue;
    if (x.plateforme === 'Leboncoin') out.Leboncoin[x.id] = b.Leboncoin[x.id]; else if (x.plateforme === 'Vestiaire') out.Vestiaire[x.id] = b.Vestiaire[x.id];
    out.ids.add(k); out.liste.push(x);
  }
  return out;
}
// Une signature stable des identités (pour ne prévenir les lecteurs que si elles CHANGENT).
export function signatureIdentites(ident) {
  if (!ident || !ident.lu) return 'pas-su';
  return arr(ident.liste).map((x) => `${x.plateforme}:${x.id}=${x.numero}`).sort().join('|');
}

// ── L'ÉTAT PUBLIÉ (un propriétaire : `chargerMemePhoto`, App.jsx) ─────────────────────────
let _ident = null;                                    // null = pas encore calculé ⇒ aucune identité par la photo
export const EVT_IDENTITES_PHOTO = 'vrm:identites-photo';
export function poserIdentitesPhoto(ident) {
  const avant = signatureIdentites(_ident);
  _ident = ident && ident.lu ? ident : null;
  const change = avant !== signatureIdentites(_ident);
  if (change) { try { window.dispatchEvent(new CustomEvent(EVT_IDENTITES_PHOTO, { detail: { n: _ident ? _ident.liste.length : 0 } })); } catch (_) { /* hors navigateur */ } }
  return change;
}
export const lireIdentitesPhoto = () => _ident;
