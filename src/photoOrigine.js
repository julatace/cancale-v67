// ══════════════════════════════════════════════════════════════════════════
// LE CODE D'ORIGINE D'UNE PHOTO : UNE IDENTITÉ EXACTE (16 nov., lot photo-identite-sites).
//
// Julien : « quand je poste la paire sur Leboncoin et Vinted sans passer par VRM, VRM la
// reconnaît parce que la photo utilisée est exactement la même » — puis : « non pas à quoi
// elle ressemble, mais son CODE » ; « vas-y, fais ça au moins ».
//
// MESURÉ (16 nov., lecture seule) : le code des photos SERVIES ne peut pas se retrouver d'un site
// à l'autre. Vinted ne sert que des tailles refaites (`/t/…/f800/…`, `310x430`, `150x210`…),
// Leboncoin une « règle » par taille (`?rule=ad-large`, `ad-thumb`, `ad-private`) : chaque site
// réencode le fichier téléversé, aucune variante « originale » n'est servie. Le code exact (SHA-256)
// est donc pris sur le FICHIER D'ORIGINE, au moment où il le téléverse depuis son Chrome avec
// l'extension (5.401) — c'est une LECTURE de ce qu'il fait lui-même, aucune requête en plus :
//   · Vinted : `POST /api/v2/photos` (le fichier choisi) ⇒ l'identifiant de photo rendu par Vinted,
//     puis `POST /api/v2/item_upload/items` (ou `PUT …/{id}`) ⇒ l'annonce qui porte ces photos ;
//     rangé dans `photo_origine_vinted` = { annonces: { [itemId]: { codes: [sha256…], compte, at } } } ;
//   · Leboncoin : `POST api/pintad/v1/public/upload/image` (le fichier choisi) ⇒ le nom d'image rendu
//     (`<40 hex>.jpg`), le même que portent ensuite les adresses des photos de l'annonce ;
//     rangé dans `photo_origine_lbc` = { images: { [nom]: { code, at } } }.
// ⚠️ LIMITE, dite à l'écran : une annonce publiée depuis les APPLIS mobiles (Vinted, Leboncoin) ou un
// autre navigateur sans l'extension n'a pas de code d'origine — elle n'est pas reconnue ainsi.
//
// Règle (« mieux vaut un blanc qu'un faux », §5) :
//   · un code porté par des annonces Vinted d'UN seul N° ⇒ une annonce Leboncoin qui a ce code PORTE
//     ce N° (identité exacte, aucun geste) ;
//   · un code sur DEUX N° différents ⇒ rien n'est déduit, c'est dit (« Même photo sur N°12 et N°40 :
//     laquelle ? », son toucher choisit) ; sur 3 N° ou plus ⇒ photo générique (boîte, fond), ignorée ;
//   · ses décisions gagnent : un lien posé, un « délier » (valeur vide), « ce n'est pas la même »,
//     « pas de paire », une référence VRM (`relie`) ; un N° porté par deux paires n'est jamais donné ;
//   · une lecture ratée ⇒ `lu:false`, aucune identité.
// Module PUR : l'app et `scripts/audit-photo-identite.cjs` exécutent les mêmes fonctions.
// ══════════════════════════════════════════════════════════════════════════

export const CODE_ORIGINE = /^[0-9a-f]{64}$/;
export const GENERIQUE_CODE_PAIRES = 3;
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const arr = (a) => (Array.isArray(a) ? a : []);
const cleNumDefaut = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };

// Le nom d'image Leboncoin d'une adresse servie (toutes tailles : la règle `?rule=` ne change pas le nom).
export function nomImageLbc(url) {
  const m = /\/images\/(?:[0-9a-f]{2}\/){0,3}([0-9a-f]{40})\.(?:jpe?g|png|webp)(?:[?#]|$)/i.exec(String(url || ''));
  return m ? m[1].toLowerCase() : '';
}

// `vinted`    : { [itemId]: { codes: [...] } } (photo_origine_vinted) ; null = pas lu ;
// `lbcImages` : { [nom]: { code } } (photo_origine_lbc) ; null = pas lu ;
// `fiches`    : { [itemId Vinted]: N° } — le N° de SES fiches ;
// `autres`    : ses annonces Leboncoin, à la forme de src/memePhoto.js, avec `photos: [url…]` ;
// `liensLbc`  : SES liens posés (une clé présente — même vide — est SA décision) ;
// `refus`     : { [cleRefus('Leboncoin', id, N°)]: date } ; `numerosDouteux` : Set de N° (cleNum).
// Rend { lu, Leboncoin: { [id]: N° }, Vestiaire: {}, liste: [{ plateforme, id, numero, par:'code', reconnue }],
//        ids: Set, ambigus: [{ id, annonce, raison:'deux-paires', parCode:true, paires }], nCodes, nAnnoncesAvecCode }.
export function identitesParCode({ vinted = null, lbcImages = null, fiches = {}, vintedInfos = {}, autres = [], liensLbc = {}, refus = {}, numerosDouteux = null, cleRefus = null, cle = cleNumDefaut } = {}) {
  const out = { lu: false, Leboncoin: {}, Vestiaire: {}, liste: [], ids: new Set(), ambigus: [], nCodes: 0, nAnnoncesAvecCode: 0 };
  const V = objet(vinted), L = objet(lbcImages);
  if (!V || !L) return out;
  out.lu = true;
  const F = objet(fiches) || {}, LL = objet(liensLbc) || {}, R = objet(refus) || {}, INF = objet(vintedInfos) || {};
  const douteux = numerosDouteux instanceof Set ? numerosDouteux : new Set(arr(numerosDouteux).map((x) => cle(x)));
  // code ⇒ N° (cleNum) ⇒ [itemId Vinted]
  const parCode = new Map();
  for (const [itemId, e] of Object.entries(V)) {
    const n = cle(F[itemId] || '');
    for (const c of arr(e && e.codes)) {
      if (!CODE_ORIGINE.test(String(c))) continue;
      if (!parCode.has(c)) parCode.set(c, new Map());
      if (!n) continue;                                     // une annonce Vinted sans N° ne donne rien
      const m = parCode.get(c); if (!m.has(n)) m.set(n, { numero: String(F[itemId]), ids: [] }); m.get(n).ids.push(String(itemId));
    }
  }
  out.nCodes = parCode.size;
  for (const a of arr(autres)) {
    if (!a || a.plateforme !== 'Leboncoin' || a.id == null) continue;
    const id = String(a.id);
    const noms = [...new Set([...arr(a.photos), a.photo].map(nomImageLbc).filter(Boolean))];
    const codes = [...new Set(noms.map((k) => objet(L[k]) && L[k].code).filter((c) => CODE_ORIGINE.test(String(c || ''))))];
    if (!codes.length) continue;
    out.nAnnoncesAvecCode++;
    if (a.relie || Object.prototype.hasOwnProperty.call(LL, id)) continue;
    const paires = new Map();
    for (const c of codes) {
      const m = parCode.get(c);
      if (!m || !m.size || m.size >= GENERIQUE_CODE_PAIRES) continue;   // inconnu côté Vinted, ou générique
      for (const [n, x] of m) { const p = paires.get(n) || { numero: x.numero, ids: new Set() }; x.ids.forEach((i) => p.ids.add(i)); paires.set(n, p); }
    }
    for (const n of [...paires.keys()]) if (typeof cleRefus === 'function' && R[cleRefus('Leboncoin', id, n)]) paires.delete(n);
    if (!paires.size) continue;
    const vintedDe = (p) => [...p.ids].map((i) => ({ id: i, ...(objet(INF[i]) || {}), numero: p.numero }));
    if (paires.size >= 2) {
      out.ambigus.push({ id: `Leboncoin:${id}`, annonce: a, raison: 'deux-paires', parCode: true,
        paires: [...paires.values()].sort((x, y) => String(x.numero).localeCompare(String(y.numero), 'fr', { numeric: true })).map((p) => ({ numero: p.numero, vinted: vintedDe(p), etat: 'sur', distance: 0, fine: null, raison: null })) });
      continue;
    }
    const [n, p] = [...paires.entries()][0];
    if (douteux.has(n)) continue;
    out.Leboncoin[id] = p.numero;
    out.ids.add(`Leboncoin:${id}`);
    out.liste.push({ plateforme: 'Leboncoin', id, numero: p.numero, vintedId: [...p.ids][0], par: 'code',
      reconnue: { id: `Leboncoin:${id}`, annonce: a, numero: p.numero, vinted: vintedDe(p), photoAutre: a.photo || '', photoVinted: '', distance: 0, etat: 'sur', fine: null, raison: null, par: 'code' } });
  }
  return out;
}
