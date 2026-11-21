// ── « LA PAIRE À SORTIR EN PREMIER » (15 nov. 2026, maquette validée par Julien) ──────────
// Quand une vente tombe, Ma journée montre d'abord OÙ est l'article : son meuble, sa rangée,
// sa case (le mini-plan du meuble, la case allumée), puis le geste « Je l'ai sortie ».
//
// Module PUR (aucun accès au navigateur ni à la base) : Ma journée (src/PaireASortir.jsx,
// App.jsx) et le banc `scripts/bancs/paire-a-sortir.cjs` exécutent les MÊMES fonctions.
//
// ⚠️ L'EMPLACEMENT VIENT DU STOCK, PAR IDENTITÉ (§5). La vente porte SON N° (décidé ailleurs,
//    par identité : le bordereau de SA transaction, la fiche de SON annonce — jamais un titre) ;
//    la case est celle de CE N° dans `vrm_slots` ({ [cleNum]: { m, i } }). Deux articles au
//    même titre n'échangent jamais leur case : le titre n'est lu nulle part ici.
// ⚠️ « PAS SU » SE DIT. Sans N°, sans case notée, meuble disparu, case hors du meuble, ou N°
//    porté par deux paires (doublon : la case peut être celle de l'autre) ⇒ `lieu: null` et la
//    RAISON ; l'écran le dit franchement et propose « Ranger d'abord ». Rien n'est deviné.
// ⚠️ « SORTIE » SE PROUVE par SON geste : la déclaration `vinted_pairs_lost` de CE N° (et de
//    CETTE annonce quand la clé porte `@id`), celle qu'écrit « Je l'ai sortie » du Stock.
// ⚠️ L'ORDRE DE SORTIE : la date limite d'abord (la plus pressée) ; à date égale, le même meuble
//    à la suite (on finit un meuble avant d'aller à l'autre : moins d'allers-retours), puis la
//    rangée et la case ; une vente sans emplacement connu vient après celles du même jour.

const estObjet = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
export const cleDefaut = (n) => {
  const s = String(n == null ? '' : n).toUpperCase().replace(/\s+/g, '').replace(/^N[°O]?(?=\d)/, '');
  const m = /^([A-Z]*)0*(\d+)$/.exec(s);
  return m ? m[1] + m[2] : s;
};
const dims = (m) => ({ cols: Math.max(1, Math.floor(Number(m && m.cols)) || 1), rows: Math.max(1, Math.floor(Number(m && m.rows)) || 1) });
const colonnesPile = (m) => {
  const { cols } = dims(m); const out = new Set();
  if (!m) return out;
  if (m.gravite === true || m.type === 'pile') { for (let c = 1; c <= cols; c++) out.add(c); return out; }
  for (const x of (Array.isArray(m.piles) ? m.piles : [])) { const c = Math.floor(Number(x)); if (c >= 1 && c <= cols) out.add(c); }
  return out;
};

// L'emplacement d'UN N° : { meubleId, nom, type, pile, rangee, colonne, cols, rows, i, depuisBas } ou
// { lieu: null, raison } — raison ∈ 'sansNumero' · 'pasRange' · 'meubleAbsent' · 'horsMeuble' · 'doublon'.
export function emplacementDe(num, { slots, meubles, doublons = null, cle = cleDefaut } = {}) {
  const k = cle(num);
  if (!k) return { lieu: null, raison: 'sansNumero' };
  if (doublons && typeof doublons.has === 'function' && doublons.has(k)) return { lieu: null, raison: 'doublon' };
  const s = estObjet(slots) ? slots[k] : null;
  if (!s || s.m == null) return { lieu: null, raison: 'pasRange' };
  const m = (Array.isArray(meubles) ? meubles : []).find((x) => x && String(x.id) === String(s.m));
  if (!m) return { lieu: null, raison: 'meubleAbsent' };
  const { cols, rows } = dims(m);
  const i = Number(s.i);
  if (!Number.isInteger(i) || i < 0 || i >= cols * rows) return { lieu: null, raison: 'horsMeuble' };
  const rangee = Math.floor(i / cols) + 1, colonne = (i % cols) + 1;
  const pile = colonnesPile(m).has(colonne);
  return { lieu: { meubleId: String(m.id), nom: String(m.name == null || m.name === '' ? '' : m.name), type: typeof m.type === 'string' ? m.type : 'etagere',
    pile, rangee, colonne, cols, rows, i, depuisBas: rows - rangee + 1 }, raison: null };
}

// La vente est-elle déjà sortie (SON geste) ? La déclaration de CE N° — `N°` nu, ou `N°@idAnnonce`
// pour CETTE annonce seulement (une autre paire au même N° ne la fait pas sortir).
export function estSortie(num, idAnnonce, perdues, cle = cleDefaut) {
  const k = cle(num); if (!k || !estObjet(perdues)) return false;
  const id = idAnnonce == null ? '' : String(idAnnonce);
  for (const brut of Object.keys(perdues)) {
    if (!perdues[brut]) continue;
    const at = brut.lastIndexOf('@');
    if (at < 0) { if (cle(brut) === k) return true; continue; }
    if (cle(brut.slice(0, at)) === k && id && brut.slice(at + 1) === id) return true;
  }
  return false;
}

// Les cases d'un meuble autour de la cible, pour le mini-plan : au plus `max` rangées et colonnes
// (une fenêtre centrée sur la case visée dans un grand meuble), chaque case { r, c, etat }
// où etat ∈ 'cible' · 'prise' · 'vide'. Les numéros de rangée/colonne restent les VRAIS.
export function planAutour(lieu, slots, { max = 6 } = {}) {
  if (!lieu) return null;
  const { cols, rows, rangee, colonne, meubleId } = lieu;
  const fen = (n, c) => { if (n <= max) return [1, n]; let a = Math.max(1, c - Math.floor((max - 1) / 2)); let b = a + max - 1; if (b > n) { b = n; a = n - max + 1; } return [a, b]; };
  const [r0, r1] = fen(rows, rangee), [c0, c1] = fen(cols, colonne);
  const prises = new Set();
  for (const k of Object.keys(estObjet(slots) ? slots : {})) { const s = slots[k]; if (s && String(s.m) === String(meubleId)) prises.add(Number(s.i)); }
  const lignes = [];
  for (let r = r0; r <= r1; r++) {
    const l = [];
    for (let c = c0; c <= c1; c++) { const i = (r - 1) * cols + (c - 1); l.push({ r, c, etat: r === rangee && c === colonne ? 'cible' : prises.has(i) ? 'prise' : 'vide' }); }
    lignes.push({ r, cases: l });
  }
  return { lignes, cols: Array.from({ length: c1 - c0 + 1 }, (_, k) => c0 + k), coupe: rows > max || cols > max };
}

// La colonne d'une pile, du haut vers le bas : [cleNum | null] (pour « Avant / Maintenant »).
export function colonneDe(lieu, slots) {
  if (!lieu) return [];
  const out = Array(lieu.rows).fill(null);
  for (const k of Object.keys(estObjet(slots) ? slots : {})) {
    const s = slots[k]; if (!s || String(s.m) !== String(lieu.meubleId)) continue;
    const i = Number(s.i); if ((i % lieu.cols) + 1 !== lieu.colonne) continue;
    const r = Math.floor(i / lieu.cols); if (r >= 0 && r < lieu.rows) out[r] = k;
  }
  return out;
}

// L'ORDRE DE SORTIE. ventes : [{ cle, num, idAnnonce, jours (entier, null = pas su), … }].
// Rend { aSortir: [{ …vente, lieu, raison }], sorties: [{ …vente }] } — `aSortir` dans l'ordre où
// il faut les sortir ; `sorties` : celles déjà sorties par SON geste (pour « 2 sur 3 sorties »).
// `depuis` : le meuble de la DERNIÈRE paire sortie (il est devant) — à date égale, on y reste.
export function ordreDeSortie(ventes, { slots, meubles, perdues = null, doublons = null, cle = cleDefaut, depuis = null } = {}) {
  const ordreMeuble = new Map((Array.isArray(meubles) ? meubles : []).map((m, k) => [String(m && m.id), Number.isFinite(Number(m && m.ordre)) && m.ordre !== null && m.ordre !== '' ? Number(m.ordre) : k]));
  const aSortir = [], sorties = [];
  for (const v of (Array.isArray(ventes) ? ventes : [])) {
    if (!v) continue;
    if (v.num && estSortie(v.num, v.idAnnonce, perdues, cle)) { sorties.push(v); continue; }
    const e = emplacementDe(v.num, { slots, meubles, doublons, cle });
    aSortir.push({ ...v, lieu: e.lieu, raison: e.raison });
  }
  const jour = (v) => (Number.isFinite(v.jours) ? v.jours : 9999);
  aSortir.sort((a, b) => jour(a) - jour(b));
  // À date égale : on chaîne les meubles — d'abord celui de la vente d'avant, puis les autres
  // dans l'ordre de la pièce ; dans un meuble, de haut en bas, de gauche à droite ; sans lieu à la fin.
  const out = []; let dernier = depuis == null ? null : String(depuis);
  for (let k = 0; k < aSortir.length;) {
    let f = k; while (f < aSortir.length && jour(aSortir[f]) === jour(aSortir[k])) f++;
    const groupe = aSortir.slice(k, f);
    const rang = (v) => {
      if (!v.lieu) return [2, 0, 0, 0];
      const m = v.lieu.meubleId;
      return [m === dernier ? 0 : 1, m === dernier ? 0 : (ordreMeuble.has(m) ? ordreMeuble.get(m) : 9999), v.lieu.rangee, v.lieu.colonne];
    };
    // Le premier choisi fixe le meuble ; les suivants du même meuble viennent à la suite.
    const reste = groupe.slice();
    while (reste.length) {
      reste.sort((a, b) => { const A = rang(a), B = rang(b); for (let i = 0; i < 4; i++) if (A[i] !== B[i]) return A[i] - B[i]; return 0; });
      const x = reste.shift(); out.push(x);
      if (x.lieu) dernier = x.lieu.meubleId;
    }
    k = f;
  }
  return { aSortir: out, sorties };
}

// La place en mots courts (« tout en haut, 3ᵉ case », « 2ᵉ boîte du bas ») : des CLÉS de traduction
// et leurs variables, l'écran les dit par tr().
export function aideLieu(lieu) {
  if (!lieu) return null;
  if (lieu.pile) return null;   // une pile se dit déjà par « 2ᵉ boîte du bas »
  if (lieu.rows === 1) return { cle: 'sortir.aide.seule', c: lieu.colonne };
  if (lieu.rangee === 1) return { cle: 'sortir.aide.haut', c: lieu.colonne };
  if (lieu.rangee === lieu.rows) return { cle: 'sortir.aide.bas', c: lieu.colonne };
  return { cle: 'sortir.aide.milieu', r: lieu.rangee, c: lieu.colonne };
}
