// ════════════════════════════════════════════════════════════════════════════
//  LES TAMPONS DES BORDEREAUX : UN SEUL RÉGLAGE, TOUTES LES IMPRESSIONS (16 nov.)
//  Julien : « je veux que l'on puisse simplement y modifier tous les tamponnages ;
//  dans un onglet des paramètres, tous les types/formats de bordereaux et où les
//  tamponnages sont placés sur chaque bordereau » — puis « je veux vraiment un
//  visuel avec TOUS les bordereaux, que je peux modifier si jamais le tamponnage
//  n'est pas au bon endroit ».
//
//  Deux tampons sur un bordereau :
//    · le CARTOUCHE (`n`) : « N° 124 », le titre, la taille — ce que la personne
//      qui prépare le colis lit ;
//    · la MENTION (`m`) « Créé par vrm.center » — petite, secondaire.
//
//  CE FICHIER EST PUR (aucun PDF, aucun DOM) : le réglage `vrm_tampons`, sa
//  migration depuis les choix d'avant, ce qui s'applique à UN bordereau (réglage
//  « pour tous » + exception par type + place posée à la main pour sa forme), et la
//  règle qui REPOUSSE une place posée à la main hors des zones interdites (codes,
//  QR, adresse). `src/App.jsx` (`tamponnerBordereau`, `poserBordereau`) l'applique
//  à CHAQUE impression ; l'onglet Paramètres → Tampons des bordereaux l'écrit.
//
//  ⚠️ UN SEUL PROPRIÉTAIRE (§11) : `vrm_tampons` (SYNC_KEYS). Les clés d'avant
//  (`vrm_impression.tamponA4` / `.tamponTh`, `vrm_tampon_positions`) ne sont plus
//  lues QUE par la migration ci-dessous, tant que `vrm_tampons` n'a jamais été
//  écrit : son choix d'avant est repris tel quel (audit-tampons le vérifie).
// ════════════════════════════════════════════════════════════════════════════

export const CLE_TAMPONS = 'vrm_tampons';

// La taille du texte, par tampon : un facteur sur la taille d'origine.
export const TAILLES_TAMPON = Object.freeze({ S: 0.8, M: 1, L: 1.25 });
// Les places rapides du cartouche : « auto » (la règle de toujours : la première
// zone blanche, jamais sur un code ni l'adresse), ou la zone blanche la plus
// proche d'un coin / du haut / du bas.
export const PLACES_N = Object.freeze(['auto', 'hg', 'hd', 'bg', 'bd', 'haut', 'bas']);
// La mention : « qr » = juste AU-DESSUS du QR code, centrée sur son axe (décision
// de Julien du 16 nov. : « comme ça même si on met du scotch on le voit ») ; sinon
// juste dessous ; sans QR, centrée sous l'adresse du destinataire.
export const PLACES_M = Object.freeze(['qr', 'bas', 'hg', 'hd', 'bg', 'bd']);
// La cible d'une place rapide, en fractions de la page (centre de la boîte voulue).
export const CIBLES = Object.freeze({ hg: [0, 0], hd: [1, 0], bg: [0, 1], bd: [1, 1], haut: [0.5, 0], bas: [0.5, 1] });

// Les quatre contenus possibles (cases à cocher).
export const CONTENUS = Object.freeze(['num', 'titre', 'taille', 'mention']);
const C_A4 = Object.freeze({ num: true, titre: true, taille: false, mention: true });
const C_TH = Object.freeze({ num: true, titre: false, taille: false, mention: true });   // le titre se lirait par le transporteur
export const ORIGINE = Object.freeze({ v: 1, a4: C_A4, th: C_TH, texte: 'M', texteMention: 'M', place: 'auto', placeMention: 'qr', types: Object.freeze({}), formes: Object.freeze({}) });

// LES TYPES DE BORDEREAU (une exception « seulement … » se pose sur l'un d'eux).
// `mise` : la forme du bordereau d'EXEMPLE (src/impression/bordereauExemple.js —
// formes reconstruites, aucune donnée réelle) ; `transporteur` : le nom écrit
// dessus ; `imprime: false` : VRM ne l'imprime pas (eBay fournit son étiquette).
export const FAMILLES = Object.freeze([
  { id: 'mondialrelay', mise: 'a4-notice', transporteur: 'Mondial Relay', service: 'Point Relais · 24R' },
  { id: 'relaiscolis', mise: '10x15-couchee', transporteur: 'Relais Colis', service: 'Relais · R12' },
  { id: 'chronopost', mise: 'a4-colonnes', transporteur: 'Chronopost', service: 'Shop2Shop' },
  { id: 'colissimo', mise: '10x15', transporteur: 'Colissimo', service: 'Point retrait' },
  { id: 'vintedgo', mise: 'a4-notice', transporteur: 'Vinted Go', service: 'Casier · VG12' },
  { id: 'ups', mise: '10x15', transporteur: 'UPS', service: 'Access Point' },
  { id: 'dpd', mise: '10x15', transporteur: 'DPD', service: 'Pickup' },
  { id: 'international', mise: 'a4-2', transporteur: 'Hermes', service: 'International' },
  { id: 'leboncoin', mise: 'a4-notice', transporteur: 'Mondial Relay', service: 'Point Relais · 24R', site: 'leboncoin' },
  { id: 'vestiaire', mise: 'a4-colonnes', transporteur: 'Chronopost', service: 'Shop2Shop', site: 'vestiaire', rotation: 270 },
  { id: 'retour', mise: 'a4-notice', transporteur: 'Mondial Relay', service: 'Retour · 24R', retour: true },
  { id: 'ebay', imprime: false },
]);
export const IDS_FAMILLES = Object.freeze(FAMILLES.map((f) => f.id));
// Les supports : l'A4 telle quelle, 4 par page (les étiquettes isolées comme en
// thermique), et chaque papier thermique (`FORMATS_THERMIQUES` de thermique.js).
export const SUPPORTS = Object.freeze(['a4', 'planche4', '10x15', '10x10', '10x15m', 'dymo4xl', 'ql62']);

const _objT = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const _finiT = (x) => typeof x === 'number' && Number.isFinite(x);
// Un contenu lu : quatre booléens (un champ absent ⇒ `d`).
// (17 nov., lot tampon-qr) Julien : « ne donne pas la possibilité d'enlever créé par vrm ». La mention est TOUJOURS
// posée : une case `mention: false` rangée avant (réglage, exception d'un type, ancien mode « rien ») est relue `true`.
// Sa place suit la règle « juste au-dessus du code » (`placeMention` toujours 'qr', taille M, jamais posée à la main).
const contenuLu = (x, d) => { const o = _objT(x) ? x : {}; const r = {}; for (const k of CONTENUS) r[k] = typeof o[k] === 'boolean' ? o[k] : d[k]; r.mention = true; return r; };
const tailleLue = (x, d) => (x in TAILLES_TAMPON ? x : d);
// Le mode d'avant (num · num_titre · num_titre_taille · rien) → les cases.
export function contenuDuMode(mode) {
  if (mode === 'rien') return { num: false, titre: false, taille: false, mention: true };
  if (mode === 'num') return { num: true, titre: false, taille: false, mention: true };
  if (mode === 'num_titre') return { num: true, titre: true, taille: false, mention: true };
  if (mode === 'num_titre_taille') return { num: true, titre: true, taille: true, mention: true };
  return null;
}
// Les cases → le mode d'avant (pour la liste courte de Paramètres → Impression), ou null.
export function modeDuContenu(c) {
  if (!c) return null;
  if (!c.num && !c.titre && !c.taille) return 'rien';
  if (c.num && !c.titre && !c.taille) return 'num';
  if (c.num && c.titre && !c.taille) return 'num_titre';
  if (c.num && c.titre && c.taille) return 'num_titre_taille';
  return null;
}
// Une place posée à la main : le cartouche { vx, vy, vw, v } (fractions de la page
// AFFICHÉE, coin haut-gauche et largeur ; `v` la variante), la mention { vx, vy, vw }.
export const placeValide = (p) => _objT(p) && [p.vx, p.vy, p.vw].every(_finiT) && p.vw > 0 && p.vw <= 1.0001 && p.vx > -0.0001 && p.vy > -0.0001 && p.vx < 1 && p.vy < 1;
const placeLue = (p) => (placeValide(p) ? { vx: +p.vx.toFixed(5), vy: +p.vy.toFixed(5), vw: +p.vw.toFixed(5), v: (p.v | 0) >= 0 && (p.v | 0) <= 2 ? p.v | 0 : 0 } : null);

// LE réglage lu, toujours complet et valide. `brut` : `vrm_tampons` ; tant qu'il
// n'a jamais été écrit (null), la MIGRATION reprend ses choix d'avant tels quels :
// `impression` (`vrm_impression` brut : tamponA4, tamponTh) et `positions`
// (`vrm_tampon_positions` : { [forme]: { vx, vy, vw, v } }).
export function reglageTampons(brut, { impression = null, positions = null } = {}) {
  if (!_objT(brut)) {
    const imp = _objT(impression) ? impression : {};
    const formes = {};
    if (_objT(positions)) for (const [cle, p] of Object.entries(positions)) {
      const n = placeLue(p); if (!n) continue;
      formes[cle] = { n };
      // La page Vestiaire (Chronopost tourné) a désormais son type : sa place gardée la suit.
      if (/^chronopost·.*·r\d+/.test(cle)) { const cv = cle.replace(/^chronopost/, 'vestiaire'); if (!formes[cv]) formes[cv] = { n }; }
    }
    return {
      ...ORIGINE,
      a4: contenuDuMode(imp.tamponA4) || { ...C_A4 },
      th: contenuDuMode(imp.tamponTh) || { ...C_TH },
      types: {}, formes, migre: true,
    };
  }
  const types = {};
  if (_objT(brut.types)) for (const [id, e] of Object.entries(brut.types)) {
    if (!IDS_FAMILLES.includes(id) || !_objT(e)) continue;
    const x = {};
    if (_objT(e.contenu)) x.contenu = contenuLu(e.contenu, C_A4);
    if (e.texte in TAILLES_TAMPON) x.texte = e.texte;
    if (PLACES_N.includes(e.place)) x.place = e.place;
    if (Object.keys(x).length) types[id] = x;
  }
  const formes = {};
  if (_objT(brut.formes)) for (const [cle, f] of Object.entries(brut.formes)) {
    if (!_objT(f) || typeof cle !== 'string' || cle.length > 120) continue;
    const n = placeLue(f.n);   // la mention n'a pas de place à la main (elle suit le code)
    if (n) formes[cle] = { n };
  }
  return {
    v: 1,
    a4: contenuLu(brut.a4, C_A4), th: contenuLu(brut.th, C_TH),
    texte: tailleLue(brut.texte, 'M'), texteMention: 'M',
    place: PLACES_N.includes(brut.place) ? brut.place : 'auto',
    placeMention: 'qr',
    types, formes, migre: false,
  };
}
// Ce qu'on écrit (sans le drapeau de lecture).
export const aEcrire = (r) => { const { migre, ...x } = r; return x; };
// Un réglage déjà lu, ou brut, ou absent ⇒ le réglage lu (la migration ne vaut que pour la lecture du stockage).
const _normT = (reg) => reglageTampons(_objT(reg) ? aEcrire(reg) : reg);

// LE TYPE D'UN BORDEREAU, pour le réglage : un retour est un retour ; un bordereau
// Leboncoin ou Vestiaire suit sa plateforme ; un bordereau Vinted, son transporteur
// (`typeBordereau` de l'app, lu sur la page — jamais deviné ailleurs).
export function familleDe({ retour = false, site = '', type = '' } = {}) {
  if (retour) return 'retour';
  const s = String(site || '').toLowerCase();
  if (s === 'leboncoin' || s === 'vestiaire') return s;
  const t = String(type || '');
  return IDS_FAMILLES.includes(t) ? t : 'autre';
}

// CE QUI S'APPLIQUE À UN BORDEREAU : le réglage « pour tous » (contenu de l'A4 ou
// du thermique), remplacé par l'exception de SON type quand il y en a une.
// `sources` dit d'où vient chaque choix (l'onglet l'affiche).
export function resoudreTampon(reg, { famille = 'autre', thermique = false } = {}) {
  const r = reg && reg.v === 1 && 'migre' in reg ? reg : _normT(reg);
  const ex = (r.types && r.types[famille]) || {};
  const contenu = { ...(ex.contenu ? ex.contenu : (thermique ? r.th : r.a4)), mention: true };
  const texte = ex.texte || r.texte, texteMention = 'M';
  return {
    famille, contenu,
    texte, k: TAILLES_TAMPON[texte] || 1,
    texteMention, kMention: TAILLES_TAMPON[texteMention] || 1,
    place: ex.place || r.place, placeMention: 'qr',
    sources: { contenu: ex.contenu ? 'type' : 'tous', texte: ex.texte ? 'type' : 'tous', texteMention: 'tous', place: ex.place ? 'type' : 'tous', placeMention: 'tous' },
  };
}
// Les places posées à la main pour une FORME (type · format · sens [· tourné] [· thermique]).
export const placesDeForme = (reg, cle) => { const f = reg && reg.formes && reg.formes[cle]; return { n: f && f.n ? f.n : null, m: null }; };

// Ce que le cartouche écrit, d'après les cases. `taille` : lue sur la vente (jamais
// devinée) ; pas répétée si le titre la porte déjà.
export function texteDuCartouche(c, { numero = '', titre = '', taille = '' } = {}) {
  const n = String(numero == null ? '' : numero).trim(), t = String(titre == null ? '' : titre).trim(), tl = String(taille == null ? '' : taille).trim();
  const cc = c || C_A4;
  const tt = cc.titre ? t : '';
  let titreOut = tt;
  if (cc.taille && tl) {
    const tn = tl.replace(/[^\d.,]/g, '');
    const dejaLa = !!tt && !!tn && new RegExp(`(^|[^\\d])${tn.replace(/[.,]/g, '[.,]')}([^\\d]|$)`).test(tt);
    if (!dejaLa) titreOut = tt ? `${tt} · T ${tl}` : `T ${tl}`;
  }
  return { numero: cc.num ? n : '', titre: titreOut };
}

// ── ÉCRIRE LE RÉGLAGE (l'onglet) : chaque geste rend un NOUVEAU réglage ─────────
// `portee` : 'tous' (pour tous les bordereaux) ou l'id d'un type (« seulement … »).
// `support` : 'a4' ou 'th' — le contenu « pour tous » se règle à part en thermique.
export function avecChoix(reg, portee, patch, { support = 'a4' } = {}) {
  const r = _normT(reg);
  const p = _objT(patch) ? patch : {};
  if (portee === 'tous') {
    const n = { ...r };
    if (p.contenu) n[support === 'th' ? 'th' : 'a4'] = contenuLu({ ...(support === 'th' ? r.th : r.a4), ...p.contenu }, C_A4);
    if (p.texte in TAILLES_TAMPON) n.texte = p.texte;
    if (PLACES_N.includes(p.place)) n.place = p.place;
    return reglageTampons(aEcrire(n));
  }
  if (!IDS_FAMILLES.includes(portee)) return r;
  const ex = { ...(r.types[portee] || {}) };
  if (p.contenu) ex.contenu = contenuLu({ ...(ex.contenu || (support === 'th' ? r.th : r.a4)), ...p.contenu }, C_A4);
  if (p.texte in TAILLES_TAMPON) ex.texte = p.texte;
  if (PLACES_N.includes(p.place)) ex.place = p.place;
  return reglageTampons(aEcrire({ ...r, types: { ...r.types, [portee]: ex } }));
}
// « Comme tous les bordereaux » : l'exception d'un type retirée (ses places à la main restent).
export function sansException(reg, famille) {
  const r = _normT(reg);
  const types = { ...r.types }; delete types[famille];
  return reglageTampons(aEcrire({ ...r, types }));
}
// Une place posée à la main (ou `null` : la place automatique revient) pour une forme.
export function avecPlace(reg, cle, quoi, place) {
  const r = _normT(reg);
  const f = { ...(r.formes[cle] || {}) };
  const p = placeLue(place);
  if (quoi === 'm') return r;   // (17 nov.) la mention ne se pose pas à la main : elle suit le code
  if (p) f.n = p; else delete f.n;
  delete f.m;
  const formes = { ...r.formes }; if (f.n) formes[cle] = f; else delete formes[cle];
  return reglageTampons(aEcrire({ ...r, formes }));
}
// « Revenir au réglage d'origine » : tout ce que VRM fait sans réglage.
export const reglageOrigine = () => reglageTampons(aEcrire({ ...ORIGINE, a4: { ...C_A4 }, th: { ...C_TH }, types: {}, formes: {} }));
export const estOrigine = (reg) => { const a = JSON.stringify(aEcrire(_normT(reg))), b = JSON.stringify(aEcrire(reglageOrigine())); return a === b; };

// ── LE GARDE-FOU : UNE PLACE À LA MAIN NE RECOUVRE JAMAIS UN CODE NI L'ADRESSE ──
// `boite` { x, y, w, h } (points, page affichée), `interdits` [{ x, y, w, h }]
// (codes + leur zone de silence, QR + la sienne, blocs d'adresse), page W × H.
// Rend { x, y, repousse } : la place elle-même si elle est libre, sinon la place
// libre la PLUS PROCHE (même taille, dans la page) — `repousse: true`, et l'écran
// le dit. `null` : aucune place libre de cette taille (l'appelant refuse).
export const chevauche = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export function repousserHorsInterdits(boite, interdits, W, H, pas = 2) {
  const w = Math.min(boite.w, W), h = Math.min(boite.h, H);
  const borne = (x, y) => ({ x: Math.max(0, Math.min(W - w, x)), y: Math.max(0, Math.min(H - h, y)) });
  const libre = (x, y) => !(interdits || []).some((z) => chevauche({ x, y, w, h }, z));
  const b0 = borne(boite.x, boite.y);
  if (libre(b0.x, b0.y)) return { x: b0.x, y: b0.y, repousse: false };
  let best = null;
  for (let y = 0; y <= H - h + 0.001; y += pas) for (let x = 0; x <= W - w + 0.001; x += pas) {
    if (!libre(x, y)) continue;
    const d = (x - b0.x) ** 2 + (y - b0.y) ** 2;
    if (!best || d < best.d) best = { x, y, d };
  }
  return best ? { x: best.x, y: best.y, repousse: true } : null;
}

// L'AIMANTATION de l'éditeur : à `seuil` points d'un axe (centre de la page, axe
// du QR, bords, place « au-dessus du QR »), la boîte s'y colle. Pur.
export function aimanter(boite, axes, seuil) {
  let { x, y } = boite; const w = boite.w, h = boite.h; let colle = null;
  for (const a of axes || []) {
    if (a.cx != null && Math.abs(x + w / 2 - a.cx) <= seuil) { x = a.cx - w / 2; colle = colle || a.nom; }
    if (a.x != null && Math.abs(x - a.x) <= seuil) { x = a.x; colle = colle || a.nom; }
    if (a.X != null && Math.abs(x + w - a.X) <= seuil) { x = a.X - w; colle = colle || a.nom; }
    if (a.y != null && Math.abs(y - a.y) <= seuil) { y = a.y; colle = colle || a.nom; }
    if (a.Y != null && Math.abs(y + h - a.Y) <= seuil) { y = a.Y - h; colle = colle || a.nom; }
  }
  return { ...boite, x, y, colle };
}
