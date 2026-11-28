// ════════════════════════════════════════════════════════════════════════════
//  L'ASSISTANT DE RANGEMENT — LE MOTEUR SANS IA (28 nov. 2026, lot agent-rangement)
//  CLAUDE.md §2.9 : d'abord SANS IA. Un entretien guidé par règles : une question à la fois, une FILE de questions qui
//  grandit selon les réponses (« 2 pièces » ⇒ une série de questions pour CHACUNE ; « 3 meubles » ⇒ trois séries ; un
//  meuble plein ⇒ « ajouter un étage ? » ; plus d'articles que de places ⇒ « que fait-on ? »). Il rend le MÊME plan
//  JSON que le moteur IA (src/rangement/plan.js), validé de la même façon.
//
//  Module PUR. L'écran (src/rangement/AssistantRangement.jsx) appelle :
//    demarrer(ctx) → etat · question(etat, ctx) → { id, cle, vars, choix: [{ v, cle, vars }], saisie, min, max, photo }
//    repondre(etat, reponse, ctx) → etat   (reponse = { v } — un bouton — ou { texte } — tapé ; jamais les deux)
//    planDe(etat) → le plan (brut, à passer à validerPlan)
//  `ctx` : { meubles, slots, articles (nombre ou null), methode ({ qui } lue), dire(cle, vars) → texte (les noms) }.
//  Les questions et les boutons sont des CLÉS de traduction (`rgt.*`) : l'écran les passe à tr().
//  ⚠️ Aucun N° ici : l'entretien parle de pièces, de meubles, d'étages et de cases. La numérotation n'est que la
//  MÉTHODE (src/etiquetage/methode.js : qui numérote, la série des PROCHAINS N°), jamais un numéro.
// ════════════════════════════════════════════════════════════════════════════
import { TYPES, RANGEES_MAX, COLS_MAX } from '../stockEtageres.js';
import { planDepuisMeubles, capacite, occupation, placesMeuble, MEUBLES_PAR_PIECE_MAX, PIECES_MAX, NOM_MAX, TYPES_PLAN } from './plan.js';

export const PIECES_PROPOSEES = Object.freeze(['chambre', 'garage', 'cave', 'bureau', 'grenier', 'salon']);
const dire0 = (cle, vars) => (vars && vars.type ? `${vars.type} ${vars.n || ''}`.trim() : cle);
const copie = (o) => JSON.parse(JSON.stringify(o));
const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// ── LIRE UN NOMBRE TAPÉ OU DIT (« 3 », « trois », « three », « drei »…) ───────
const MOTS_NOMBRES = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, quinze: 15, vingt: 20,
  one: 1, two: 2, three: 3, four: 4, five: 5, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12,
  uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10,
  eins: 1, ein: 1, eine: 1, zwei: 2, drei: 3, vier: 4, fuenf: 5, 'fünf': 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10,
};
export function lireNombre(texte) {
  const t = String(texte == null ? '' : texte).toLowerCase();
  const m = /(\d{1,3})/.exec(t);
  if (m) return Number(m[1]);
  for (const mot of t.split(/[^a-zàâäéèêëîïôöùûüç]+/)) if (Object.prototype.hasOwnProperty.call(MOTS_NOMBRES, mot)) return MOTS_NOMBRES[mot];
  return null;
}
const sansAccent = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// ── L'ÉTAT ───────────────────────────────────────────────────────────────────
export function demarrer(ctx = {}) {
  const existants = (Array.isArray(ctx.meubles) ? ctx.meubles : []).filter((m) => m && m.id != null);
  const etat = { v: 1, mode: null, plan: { version: 1, pieces: [], retirer: [], etiquetage: null }, file: [], fini: false, incompris: false, vus: [] };
  if (existants.length) etat.file.push({ q: 'mode' });
  else { etat.mode = 'creer'; etat.file.push({ q: 'nbPieces' }); }
  return etat;
}
// Le nom d'un nouveau meuble : son type et une lettre (« Étagère A », « Étagère B »…), dans l'ordre de l'entretien.
const nomMeuble = (plan, type, ctx, sauf) => {
  const dire = ctx.dire || dire0;
  let deja = 0;
  plan.pieces.forEach((p) => p.meubles.forEach((m) => { if (m !== sauf && m.type === type && m.nom) deja++; }));
  return String(dire('rgt.nom.meuble', { type: dire('etag.type.' + type), n: LETTRES[deja % 26] + (deja >= 26 ? String(Math.floor(deja / 26) + 1) : '') })).slice(0, NOM_MAX);
};
const tousMeubles = (etat) => etat.plan.pieces.flatMap((p, a) => p.meubles.map((m, b) => ({ m, a, b, piece: p.nom })));
const choixNombres = (liste) => liste.map((n) => ({ v: n, cle: 'rgt.n', vars: { n } }));
// Les meubles existants pleins (toutes leurs cases prises) : l'assistant propose d'y ajouter un étage.
function meublesPleins(etat, ctx) {
  const occ = occupation(ctx.slots);
  return tousMeubles(etat).filter(({ m }) => m.ref && (occ.get(String(m.ref)) || 0) >= placesMeuble(m));
}

// ── LA QUESTION EN COURS ─────────────────────────────────────────────────────
export function question(etat, ctx = {}) {
  if (!etat || etat.fini || !etat.file.length) return null;
  const f = etat.file[0];
  const P = (a) => etat.plan.pieces[a];
  const M = (a, b) => (P(a) ? P(a).meubles[b] : null);
  const base = { id: f.q, incompris: !!etat.incompris };
  const meublesChoix = (sauf) => tousMeubles(etat).filter((x) => !sauf || !sauf(x)).map((x) => ({ v: `${x.a}.${x.b}`, cle: 'rgt.choix.meuble', vars: { nom: x.m.nom, piece: x.piece } }));
  switch (f.q) {
    case 'mode': return { ...base, cle: 'rgt.q.mode', vars: { n: (ctx.meubles || []).length }, choix: [{ v: 'modifier', cle: 'rgt.c.modifier' }, { v: 'creer', cle: 'rgt.c.creer' }], saisie: null };
    case 'nbPieces': return { ...base, cle: 'rgt.q.nbPieces', choix: choixNombres([1, 2, 3, 4]), saisie: 'nombre', min: 1, max: PIECES_MAX };
    case 'nomPiece': return { ...base, cle: f.a === 0 && etat.plan.pieces.length <= 1 ? 'rgt.q.nomPiece1' : 'rgt.q.nomPiece', vars: { k: f.a + 1 },
      choix: PIECES_PROPOSEES.filter((p) => !etat.plan.pieces.some((x) => sansAccent(x.nom) === sansAccent((ctx.dire || dire0)('rgt.piece.' + p)))).slice(0, 5).map((p) => ({ v: 'rgt.piece.' + p, cle: 'rgt.piece.' + p })), saisie: 'texte', photo: true };
    case 'nbMeubles': return { ...base, cle: 'rgt.q.nbMeubles', vars: { piece: P(f.a) ? P(f.a).nom : '' }, choix: choixNombres([1, 2, 3, 4]), saisie: 'nombre', min: 1, max: MEUBLES_PAR_PIECE_MAX, photo: true };
    case 'type': return { ...base, cle: 'rgt.q.type', vars: { k: f.b + 1, piece: P(f.a) ? P(f.a).nom : '', n: P(f.a) ? P(f.a).meubles.length : 1 },
      choix: TYPES_PLAN.map((t) => ({ v: t, cle: 'rgt.type.' + t })), saisie: null, photo: true };
    case 'etages': { const m = M(f.a, f.b); const d = m ? TYPES[m.type].rows : 4;
      return { ...base, cle: m && m.type === 'pile' ? 'rgt.q.etagesPile' : m && m.type === 'bac' ? 'rgt.q.etagesBac' : 'rgt.q.etages', vars: { nom: m ? m.nom : '' },
        choix: choixNombres([...new Set([d, 3, 4, 5, 6].filter((n) => n >= 1))].sort((x, y) => x - y).slice(0, 5)), saisie: 'nombre', min: 1, max: RANGEES_MAX, photo: true }; }
    case 'cases': { const m = M(f.a, f.b);
      return { ...base, cle: m && m.type === 'pile' ? 'rgt.q.casesPile' : 'rgt.q.cases', vars: { nom: m ? m.nom : '' }, choix: choixNombres(m && m.type === 'pile' ? [1, 2, 3] : [2, 3, 4, 6]), saisie: 'nombre', min: 1, max: COLS_MAX, photo: true }; }
    case 'porte': return { ...base, cle: 'rgt.q.porte', choix: [...meublesChoix(), { v: 'aucun', cle: 'rgt.c.aucunPorte' }], saisie: null };
    case 'numero': { const qui = ctx.methode && ctx.methode.qui;
      return { ...base, cle: 'rgt.q.numero', vars: { actuel: qui || '' },
        choix: [...(qui ? [{ v: 'garder', cle: 'rgt.c.numGarder' }] : []), { v: 'vrm', cle: 'rgt.c.numVrm' }, { v: 'lettre', cle: 'rgt.c.numLettre' }, { v: 'moi', cle: 'rgt.c.numMoi' }], saisie: null }; }
    case 'lettre': return { ...base, cle: 'rgt.q.lettre', choix: [], saisie: 'texte', erreur: f.erreur || null };
    case 'manque': { const c = capacite(etat.plan); const grand = tousMeubles(etat).sort((x, y) => y.m.casesParEtage - x.m.casesParEtage)[0];
      const n = Number(ctx.articles) - c.places; const etages = grand ? Math.ceil(n / grand.m.casesParEtage) : 0;
      return { ...base, cle: 'rgt.q.manque', vars: { n, articles: ctx.articles, places: c.places },
        choix: [...(grand && grand.m.etages + etages <= RANGEES_MAX ? [{ v: 'etages', cle: 'rgt.c.manqueEtages', vars: { n: etages, nom: grand.m.nom } }] : []), { v: 'meuble', cle: 'rgt.c.manqueMeuble' }, { v: 'garder', cle: 'rgt.c.manqueGarder' }], saisie: null }; }
    case 'plein': { const m = M(f.a, f.b); return { ...base, cle: 'rgt.q.plein', vars: { nom: m ? m.nom : '', n: m ? placesMeuble(m) : 0 }, choix: [{ v: 'oui', cle: 'rgt.c.pleinOui' }, { v: 'non', cle: 'rgt.c.non' }], saisie: null }; }
    case 'changer': return { ...base, cle: etat.vus.includes('changer') ? 'rgt.q.changerEncore' : 'rgt.q.changer',
      choix: [{ v: 'ajouterMeuble', cle: 'rgt.c.ajouterMeuble' }, { v: 'ajouterEtages', cle: 'rgt.c.ajouterEtages' }, { v: 'deplacer', cle: 'rgt.c.deplacer' },
        { v: 'ajouterPiece', cle: 'rgt.c.ajouterPiece' }, { v: 'retirer', cle: 'rgt.c.retirer' }, { v: 'numero', cle: 'rgt.c.numero' }, { v: 'fini', cle: 'rgt.c.fini' }], saisie: null };
    case 'quellePiece': return { ...base, cle: 'rgt.q.quellePiece', choix: [...etat.plan.pieces.map((p, a) => ({ v: String(a), cle: 'rgt.choix.piece', vars: { nom: p.nom } })), { v: 'nouvelle', cle: 'rgt.c.nouvellePiece' }], saisie: null };
    case 'quelMeuble': return { ...base, cle: 'rgt.q.quelMeuble.' + f.pour, choix: meublesChoix(), saisie: null };
    case 'combienEtages': { const m = M(f.a, f.b); return { ...base, cle: 'rgt.q.combienEtages', vars: { nom: m ? m.nom : '', n: m ? m.etages : 0 }, choix: choixNombres([1, 2, 3]), saisie: 'nombre', min: 1, max: RANGEES_MAX }; }
    case 'versPiece': { const m = M(f.a, f.b); return { ...base, cle: 'rgt.q.versPiece', vars: { nom: m ? m.nom : '' },
      choix: [...etat.plan.pieces.map((p, a) => ({ v: String(a), cle: 'rgt.choix.piece', vars: { nom: p.nom } })).filter((c) => c.v !== String(f.a)), { v: 'nouvelle', cle: 'rgt.c.nouvellePiece' }], saisie: null }; }
    case 'confirmerRetrait': { const m = M(f.a, f.b); const occ = m && m.ref ? (occupation(ctx.slots).get(String(m.ref)) || 0) : 0;
      return { ...base, cle: occ ? 'rgt.q.retraitPlein' : 'rgt.q.retrait', vars: { nom: m ? m.nom : '', n: occ }, choix: [{ v: 'oui', cle: 'rgt.c.retraitOui' }, { v: 'non', cle: 'rgt.c.non' }], saisie: null }; }
    default: return null;
  }
}

// ── UNE RÉPONSE ──────────────────────────────────────────────────────────────
// Rend un NOUVEL état (l'ancien n'est jamais modifié). Une réponse incomprise garde la question (`incompris`).
export function repondre(etat0, reponse = {}, ctx = {}) {
  const etat = copie(etat0);
  const q = question(etat, ctx);
  if (!q) return etat;
  const f = etat.file[0];
  const dire = ctx.dire || dire0;
  let v = reponse.v;
  // Une réponse TAPÉE : un nombre, ou le nom d'un bouton, ou un texte libre (une pièce, une lettre).
  if (v === undefined && typeof reponse.texte === 'string') {
    const t = reponse.texte.trim();
    const n = lireNombre(t);
    const parNom = (q.choix || []).find((c) => sansAccent(dire(c.cle, c.vars)) === sansAccent(t) || (c.vars && c.vars.nom && sansAccent(c.vars.nom) === sansAccent(t)));
    if (parNom) v = parNom.v;
    else if (q.saisie === 'nombre' && n != null) v = n;
    else if (q.saisie === 'texte' && t) v = { texte: t.slice(0, NOM_MAX) };
    else if (q.choix && q.choix.some((c) => c.v === n)) v = n;
    else if (f.q === 'type') { const ty = TYPES_PLAN.find((x) => sansAccent(t).includes(sansAccent(dire('etag.type.' + x)))); if (ty) v = ty; }
  }
  const nombreOk = (x) => typeof x === 'number' && Number.isInteger(x) && x >= (q.min || 1) && x <= (q.max || 99);
  const valide = q.saisie === 'nombre' ? (nombreOk(v) || (q.choix || []).some((c) => c.v === v)) : q.saisie === 'texte' ? (v && (typeof v.texte === 'string' || (q.choix || []).some((c) => c.v === v))) : (q.choix || []).some((c) => c.v === v);
  if (!valide) { etat.incompris = true; return etat; }
  etat.incompris = false;
  etat.file.shift();
  if (!etat.vus.includes(f.q)) etat.vus.push(f.q);
  const P = etat.plan.pieces;
  const devant = (...qs) => { etat.file.unshift(...qs); };
  const neuf = (a) => { const p = P[a]; p.meubles.push({ ref: null, nom: '', type: 'etagere', etages: 4, casesParEtage: 4, porte: false }); return p.meubles.length - 1; };
  const seriesMeuble = (a, b) => [{ q: 'type', a, b }, { q: 'etages', a, b }, { q: 'cases', a, b }];
  const nouvellePiece = () => { P.push({ nom: '', meubles: [] }); return P.length - 1; };
  switch (f.q) {
    case 'mode':
      if (v === 'modifier') {
        etat.mode = 'modifier';
        etat.plan = planDepuisMeubles(ctx.meubles, { pieceParDefaut: dire('rgt.piece.defaut') });
        const pleins = meublesPleins(etat, ctx);
        devant(...pleins.slice(0, 3).map((x) => ({ q: 'plein', a: x.a, b: x.b })), { q: 'changer' });
      } else { etat.mode = 'creer'; devant({ q: 'nbPieces' }); }
      break;
    case 'nbPieces': {
      const n = Number(v);
      for (let a = 0; a < n; a++) nouvellePiece();
      const suite = [];
      for (let a = 0; a < n; a++) suite.push({ q: 'nomPiece', a }, { q: 'nbMeubles', a });
      devant(...suite);
      break; }
    case 'nomPiece': {
      let nom = typeof v === 'string' ? dire(v) : String(v.texte || '');
      nom = nom.replace(/\s+/g, ' ').trim().slice(0, NOM_MAX) || dire('rgt.piece.defaut');
      // Deux pièces au même nom : la seconde est numérotée (« Chambre 2 »).
      let k = 2, final = nom; while (P.some((p, a) => a !== f.a && sansAccent(p.nom) === sansAccent(final))) final = `${nom} ${k++}`.slice(0, NOM_MAX);
      P[f.a].nom = final;
      break; }
    case 'nbMeubles': {
      const n = Number(v); const suite = [];
      for (let k = 0; k < n; k++) { const b = neuf(f.a); suite.push(...seriesMeuble(f.a, b)); }
      devant(...suite);
      // La dernière pièce décrite : place à « près de la porte », puis à la numérotation.
      if (!etat.file.some((x) => x.q === 'nomPiece' || x.q === 'nbMeubles')) {
        if (etat.mode === 'creer') etat.file.push(...(tousMeubles(etat).length > 1 ? [{ q: 'porte' }] : []), { q: 'numero' }, { q: 'fin' });
      }
      break; }
    case 'type': { const m = P[f.a].meubles[f.b]; m.type = v; m.nom = nomMeuble(etat.plan, v, ctx, m);
      m.etages = TYPES[v].rows; m.casesParEtage = TYPES[v].cols; break; }
    case 'etages': P[f.a].meubles[f.b].etages = Number(v); break;
    case 'cases': P[f.a].meubles[f.b].casesParEtage = Number(v); break;
    case 'porte': tousMeubles(etat).forEach(({ m, a, b }) => { m.porte = v === `${a}.${b}`; }); break;
    case 'numero':
      if (v === 'garder') etat.plan.etiquetage = null;
      else if (v === 'lettre') devant({ q: 'lettre' });
      else etat.plan.etiquetage = v === 'moi' ? { qui: 'moi' } : { qui: 'vrm', serie: 'chiffres' };
      break;
    case 'lettre': {
      const l = String(typeof v === 'object' ? v.texte : v).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
      const archive = String(ctx.archive || '').toUpperCase();
      if (!l || (archive && l === archive)) { devant({ q: 'lettre', erreur: !l ? 'vide' : 'archive' }); break; }
      etat.plan.etiquetage = { qui: 'vrm', serie: 'lettre', lettre: l };
      break; }
    case 'manque':
      if (v === 'etages') { const g = tousMeubles(etat).sort((x, y) => y.m.casesParEtage - x.m.casesParEtage)[0]; const n = Number(ctx.articles) - capacite(etat.plan).places; g.m.etages = Math.min(RANGEES_MAX, g.m.etages + Math.ceil(n / g.m.casesParEtage)); }
      else if (v === 'meuble') { const a = P.length - 1; const b = neuf(a); devant(...seriesMeuble(a, b)); }
      else etat.manqueAccepte = true;
      if (v !== 'garder') etat.file.unshift(...(etat.file[0] && etat.file[0].q === 'fin' ? [] : []));
      break;
    case 'plein': if (v === 'oui') P[f.a].meubles[f.b].etages = Math.min(RANGEES_MAX, P[f.a].meubles[f.b].etages + 1); break;
    case 'changer':
      if (v === 'fini') devant({ q: 'fin' });
      else if (v === 'ajouterMeuble') devant({ q: 'quellePiece' }, { q: 'changer' });
      else if (v === 'ajouterPiece') { const a = nouvellePiece(); devant({ q: 'nomPiece', a }, { q: 'nbMeubles', a }, { q: 'changer' }); }
      else if (v === 'numero') devant({ q: 'numero' }, { q: 'changer' });
      else devant({ q: 'quelMeuble', pour: v }, { q: 'changer' });
      break;
    case 'quellePiece': {
      let a = Number(v);
      if (v === 'nouvelle') { a = nouvellePiece(); devant({ q: 'nomPiece', a }); }
      const b = neuf(a);
      const i = v === 'nouvelle' ? 1 : 0;
      etat.file.splice(i, 0, ...seriesMeuble(a, b));
      break; }
    case 'quelMeuble': {
      const [a, b] = String(v).split('.').map(Number);
      if (f.pour === 'ajouterEtages') devant({ q: 'combienEtages', a, b });
      else if (f.pour === 'deplacer') devant({ q: 'versPiece', a, b });
      else if (f.pour === 'retirer') devant({ q: 'confirmerRetrait', a, b });
      break; }
    case 'combienEtages': P[f.a].meubles[f.b].etages = Math.min(RANGEES_MAX, P[f.a].meubles[f.b].etages + Number(v)); break;
    case 'versPiece': {
      let a = Number(v);
      if (v === 'nouvelle') { a = nouvellePiece(); devant({ q: 'nomPiece', a }); }
      const [m] = P[f.a].meubles.splice(f.b, 1);
      P[a].meubles.push(m);
      // Les autres questions en file qui visaient un meuble de cette pièce par sa place se recalent (rien d'autre ne les vise ici).
      break; }
    case 'confirmerRetrait':
      if (v === 'oui') { const [m] = P[f.a].meubles.splice(f.b, 1); if (m && m.ref) etat.plan.retirer.push(m.ref); }
      break;
    default: break;
  }
  // La fin : d'abord le manque de places (une fois), puis c'est fini.
  if (etat.file[0] && etat.file[0].q === 'fin') {
    const c = capacite(etat.plan);
    // Plus d'articles que de places : l'assistant le DIT et propose (des étages, un meuble), jusqu'à ce que ça tienne ou
    // qu'il choisisse « garder comme ça ».
    if (Number.isFinite(ctx.articles) && ctx.articles > c.places && !etat.manqueAccepte) etat.file.unshift({ q: 'manque' });
    else { etat.file = []; etat.fini = true; }
  }
  return etat;
}

// Le plan brut de l'entretien (à valider par `validerPlan` comme celui de l'IA). Une pièce vide (« ajouter une pièce »
// sans meuble) reste dans le plan : elle est signalée par `incoherences`.
export function planDe(etat) {
  if (!etat) return null;
  const p = copie(etat.plan);
  p.pieces = p.pieces.map((x) => ({ nom: x.nom, meubles: x.meubles.map((m) => ({ ref: m.ref || null, nom: m.nom, type: m.type, etages: m.etages, casesParEtage: m.casesParEtage, porte: !!m.porte })) }));
  if (!p.retirer || !p.retirer.length) delete p.retirer;
  if (!p.etiquetage) delete p.etiquetage;
  return p;
}
