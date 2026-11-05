// ══════════════════════════════════════════════════════════════════════════════
//  LA LIGNE `main` SE FUSIONNE CLÉ PAR CLÉ — elle ne se réécrit plus en entier
//  (1er novembre 2026, audit « conditions difficiles », points 1 et 2)
// ══════════════════════════════════════════════════════════════════════════════
// Mesuré au banc (deux navigateurs sur la même base) : l'appareil resté ouvert
// depuis le matin renvoyait TOUTE la ligne `main` depuis son navigateur au
// moindre réglage touché — le prénom, le prix d'achat, le colis coché, le mois
// URSSAF déclaré saisis entre-temps sur l'autre appareil repartaient à
// l'ancienne valeur, sans un mot.
//
// La règle, une seule, pour l'envoi, le retour au premier plan et l'autre onglet
// (fusion à TROIS voies) : `base` = ce que CET appareil savait du nuage la
// dernière fois qu'ils se sont accordés · `local` = ce que l'appareil porte
// maintenant · `nuage` = ce que la base porte maintenant.
//   · une clé que l'appareil n'a pas touchée (local = base) prend le nuage ;
//   · une clé que le nuage n'a pas touchée (nuage = base) prend l'appareil ;
//   · touchée des deux côtés : un objet se fusionne SOUS-CLÉ par sous-clé (le
//     prix du N°5 d'un côté, celui du N°6 de l'autre : les deux restent), une
//     liste par élément (ajouté ici, retiré là) ; une valeur simple changée des
//     deux côtés : celle de l'appareil qui envoie (le geste le plus récent).
//
// ⚠️⚠️ LES NUMÉROS NE SE DEVINENT JAMAIS (§5). Le pool (`vinted_used_numeros`)
//    est une UNION (append-only, jamais un numéro retiré). Les fiches et les
//    ventes se fusionnent champ par champ, MAIS la fusion refuse (`conflit`) dès
//    qu'elle produirait ce qu'aucun des deux côtés n'avait :
//      · la même fiche numérotée différemment des deux côtés ;
//      · deux paires sous le même numéro alors qu'aucun côté ne les y mettait
//        (deux appareils qui ont chacun donné « 12 » à une paire différente) ;
//      · un numéro neuf donné ici ET là-bas, à deux paires différentes.
//    Un conflit n'écrit RIEN : l'appelant ouvre le bloc « Recharger » (les
//    saisies sont gardées, les numéros de cet écran ne sont pas rejoués) — le
//    même chemin que le refus de la base (migration 013/017).
// ⚠️ `vrm_numerotation` est ÉCRIT PAR LE SERVEUR SEUL : le nuage gagne toujours.
//
// Module PUR (aucun accès au navigateur) : exécuté tel quel par
// `scripts/audit-fusion-nuage.cjs` et rejoué par le banc `deux-appareils.cjs`.

// Une égalité qui ne dépend pas de l'ordre des clés (une carte réécrite par
// `{ ...prev, x }` garde le même contenu dans un autre ordre).
export const jsonStable = (v) => {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(jsonStable).join(',') + ']';
  return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + jsonStable(v[k])).join(',') + '}';
};
export const egal = (a, b) => jsonStable(a) === jsonStable(b);
const estObjet = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// Une liste : ce que l'appareil a ajouté ou retiré depuis `base`, appliqué à la
// liste du nuage (dont l'ordre est gardé). L'identité d'un élément = son contenu.
const fusionListe = (b, l, n) => {
  const bs = new Set((Array.isArray(b) ? b : []).map(jsonStable));
  const ls = new Set(l.map(jsonStable));
  const retires = new Set([...bs].filter((x) => !ls.has(x)));
  const out = n.filter((x) => !retires.has(jsonStable(x)));
  const deja = new Set(out.map(jsonStable));
  for (const x of l) { const c = jsonStable(x); if (!bs.has(c) && !deja.has(c)) { deja.add(c); out.push(x); } }
  return out;
};

// La fusion générique à trois voies. `undefined` = clé absente.
export const fusion3 = (b, l, n, profondeur = 4) => {
  if (egal(l, b)) return n;
  if (egal(n, b)) return l;
  if (egal(l, n)) return l;
  if (estObjet(l) && estObjet(n) && (b === undefined || b === null || estObjet(b)) && profondeur > 0) {
    const bo = estObjet(b) ? b : {};
    const out = {};
    for (const k of new Set([...Object.keys(n), ...Object.keys(l), ...Object.keys(bo)])) {
      const v = fusion3(bo[k], l[k], n[k], profondeur - 1);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  if (Array.isArray(l) && Array.isArray(n) && (b === undefined || b === null || Array.isArray(b))) return fusionListe(b, l, n);
  return l;
};

// ── Les numéros ──────────────────────────────────────────────────────────────
const numDe = (e, cleNum) => (estObjet(e) && e.numero != null && String(e.numero).trim() !== '' ? cleNum(e.numero) : '');
// Les numéros portés par PLUSIEURS fiches d'une carte : { num: [ids triés] }.
const doublons = (carte, cleNum) => {
  const par = new Map();
  for (const [id, e] of Object.entries(estObjet(carte) ? carte : {})) { const c = numDe(e, cleNum); if (!c) continue; if (!par.has(c)) par.set(c, []); par.get(c).push(id); }
  const out = new Map();
  for (const [c, ids] of par) if (ids.length > 1) out.set(c, ids.sort().join(','));
  return out;
};
// Fiches (`vinted_annonce_numeros`) ou ventes (`vinted_sale_overrides`) : la
// fusion champ par champ, et les trois refus. Rend { val } ou { conflit }.
export const fusionFichesNumeros = (cle, b, l, n, cleNum, pools = {}) => {
  const bo = estObjet(b) ? b : {}, lo = estObjet(l) ? l : {}, no = estObjet(n) ? n : {};
  // 1. La même fiche renumérotée des deux côtés, différemment.
  for (const id of new Set([...Object.keys(lo), ...Object.keys(no)])) {
    const nb = numDe(bo[id], cleNum), nl = numDe(lo[id], cleNum), nn = numDe(no[id], cleNum);
    if (nl !== nb && nn !== nb && nl !== nn) return { conflit: `${cle}:${id}:deux-numeros` };
  }
  const val = fusion3(b, l, n);
  if (cle !== 'vinted_annonce_numeros') return { val };
  // 2. Deux paires sous un numéro, que ni l'appareil ni le nuage n'y mettaient.
  const dv = doublons(val, cleNum), dl = doublons(l, cleNum), dn = doublons(n, cleNum);
  for (const [c, ids] of dv) if (dl.get(c) !== ids && dn.get(c) !== ids) return { conflit: `${cle}:${c}:deux-paires` };
  // 3. Le même numéro NEUF donné des deux côtés (pool), à deux paires différentes.
  const pb = new Set((Array.isArray(pools.base) ? pools.base : []).map(cleNum));
  const neufsL = new Set((Array.isArray(pools.local) ? pools.local : []).map(cleNum).filter((c) => c && !pb.has(c)));
  const neufsN = (Array.isArray(pools.nuage) ? pools.nuage : []).map(cleNum).filter((c) => c && !pb.has(c) && neufsL.has(c));
  if (neufsN.length) {
    const porteur = (carte, c) => Object.keys(estObjet(carte) ? carte : {}).filter((id) => numDe(carte[id], cleNum) === c).sort().join(',');
    for (const c of neufsN) if (porteur(lo, c) !== porteur(no, c)) return { conflit: `${cle}:${c}:numero-neuf-des-deux-cotes` };
  }
  return { val };
};
// (5 novembre) UNE FICHE NUMÉROTÉE DU NUAGE NE DISPARAÎT JAMAIS PAR LA FUSION.
// C'est la règle de la base (`vrm_fiche_perdue`, migrations 013/017) : une
// fiche qui porte un N° ne sort de `main` que remplacée par une reprise
// (`repriseDe`). Mesuré le 5 nov. (journaux Postgres, 12:13 UTC) : un appareil
// ouvert depuis la veille a envoyé une fusion sans une fiche numérotée ; la base
// a refusé et l'écran s'est couvert du bloc « Recharger ». On applique la règle
// AVANT d'écrire : la fiche du nuage est remise telle quelle (rien n'est
// renuméroté, aucun numéro deviné).
export const garderFichesNumerotees = (val, nuage, cleNum) => {
  const no = estObjet(nuage) ? nuage : {};
  const out = estObjet(val) ? { ...val } : {};
  const repris = new Set(Object.values(out).map((e) => (estObjet(e) && e.repriseDe != null ? String(e.repriseDe) : '')).filter(Boolean));
  for (const [id, e] of Object.entries(no)) {
    if (!numDe(e, cleNum) || id in out || repris.has(String(id))) continue;
    out[id] = e;
  }
  return out;
};
// Le pool : l'union, dans l'ordre du nuage, puis ce que l'appareil a de plus.
export const unionPool = (l, n, cleNum) => {
  const nn = Array.isArray(n) ? n : [], ll = Array.isArray(l) ? l : [];
  const vus = new Set(nn.map(cleNum).filter(Boolean));
  const out = nn.slice();
  for (const x of ll) { const c = cleNum(x); if (c && !vus.has(c)) { vus.add(c); out.push(x); } }
  return out;
};

// Les clés qui ne se fusionnent pas comme les autres.
export const CLE_POOL = 'vinted_used_numeros';
// (2 nov., soir) + les N° donnés aux annonces Vestiaire : la même annonce
// numérotée différemment des deux côtés est un conflit (rien n'est écrit).
export const CLES_FICHES = ['vinted_annonce_numeros', 'vinted_sale_overrides', 'vrm_vc_numeros'];
export const CLE_SERVEUR = 'vrm_numerotation';

// Toute la ligne : `cles` = les clés synchronisées. Rend { data, conflit } :
// `data` ne porte que les clés présentes (une clé retirée par l'appareil et
// pas touchée ailleurs reste retirée), jamais `rev` (posé par l'écrivain).
// (2 nov., file d'envoi — src/fileEnvoi.js) `nuageGagne` : les clés dont le
// nuage a été écrit APRÈS le dernier geste pas encore envoyé de l'appareil ; sur
// une valeur changée des deux côtés, celle du nuage reste (la fusion est la même,
// les deux côtés échangés — ajouts et retraits de chacun gardés pareil).
export const fusionnerLigne = ({ cles, base, local, nuage, cleNum, localGagne = [], nuageGagne = [] }) => {
  const B = estObjet(base) ? base : {}, L = estObjet(local) ? local : {}, N = estObjet(nuage) ? nuage : {};
  const data = {};
  for (const k of cles) {
    let v;
    const inverse = nuageGagne.includes(k);
    if (k === CLE_SERVEUR) v = N[k] !== undefined ? N[k] : L[k];
    else if (localGagne.includes(k)) v = L[k] !== undefined ? L[k] : N[k];
    else if (k === CLE_POOL) v = (L[k] === undefined && N[k] === undefined) ? undefined : unionPool(L[k], N[k], cleNum);
    else if (CLES_FICHES.includes(k)) {
      const r = inverse
        ? fusionFichesNumeros(k, B[k], N[k], L[k], cleNum, { base: B[CLE_POOL], local: N[CLE_POOL], nuage: L[CLE_POOL] })
        : fusionFichesNumeros(k, B[k], L[k], N[k], cleNum, { base: B[CLE_POOL], local: L[CLE_POOL], nuage: N[CLE_POOL] });
      if (r.conflit) return { conflit: r.conflit };
      v = r.val;
      if (k === 'vinted_annonce_numeros') v = garderFichesNumerotees(v, N[k], cleNum);
    } else v = inverse ? fusion3(B[k], N[k], L[k]) : fusion3(B[k], L[k], N[k]);
    if (v !== undefined && v !== null) data[k] = v;
    else if (v === null && (L[k] === null || N[k] === null)) data[k] = null;
  }
  return { data };
};
