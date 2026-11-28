// ════════════════════════════════════════════════════════════════════════════
//  LA NUMÉROTATION DES ANNONCES, EXÉCUTÉE (15 nov., lot numeros-masquees)
//  Le morceau de l'effet de `Comptabilite` (src/App.jsx) qui va de « const items = »
//  (les annonces parcourues) jusqu'à la balise `// </numerotation-passage>`, EXÉCUTÉ
//  tel quel dans une vm, avec les VRAIES fonctions d'App.jsx (`cleNum`, `entreePool`,
//  `prochainLibre`, `photoKey`, `ficheEcrite`, `entryPhotoKey`, `annonceDeclareePartie`)
//  et les VRAIS modules (src/numerosNouvelles.js, src/repriseNumero.js,
//  src/numeroEcrit.js, src/accueilReste/cartonsNumeros.js, src/republieTelephone.js).
//  Seul ce qui vient d'ailleurs (la base, l'état React) est servi par l'appelant.
//  `racine` : l'arbre jugé (un `git archive` du code d'avant, §6.1) — un module absent
//  de cet arbre vaut `null` et le morceau d'avant ne l'appelle pas.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

function constante(app, nom) {
  let i = app.indexOf(`\nconst ${nom} = `);
  if (i < 0) { i = app.indexOf(`\nfunction ${nom}(`); if (i < 0) return null; }
  const lignes = app.slice(i + 1).split('\n');
  if (/;\s*$/.test(lignes[0]) && (lignes[0].match(/\{/g) || []).length === (lignes[0].match(/\}/g) || []).length) return lignes[0];
  const out = [];
  for (const l of lignes) { out.push(l); if (l === '};' || l === '}') break; }
  return out.join('\n');
}

async function charger(racine) {
  const lire = (f) => { try { return fs.readFileSync(path.join(racine, f), 'utf8'); } catch (_) { return ''; } };
  const imp = async (f) => { if (!fs.existsSync(path.join(racine, f))) return null; try { return await import('file://' + path.join(racine, f)); } catch (e) { return null; } };
  const APP = lire('src/App.jsx');
  const h = APP.indexOf('── Numérotation AUTOMATIQUE des annonces en ligne');
  const d = h > 0 ? APP.indexOf('const items = ', h) : -1;
  const f = d > 0 ? APP.indexOf('// </numerotation-passage>', d) : -1;
  const corps = d > 0 && f > d ? APP.slice(d, f) : '';
  const noms = ['cleNum', 'NUM_OK', 'entreePool', 'prochainLibre', 'photoKey', 'ficheEcrite', 'entryPhotoKey', 'annonceDeclareePartie'];
  const aides = noms.map((n) => [n, constante(APP, n)]);
  const manque = aides.filter(([, t]) => !t).map(([n]) => n);
  const ctxA = vm.createContext({});
  if (!manque.length) vm.runInContext(aides.map(([, t]) => t).join('\n') + `\n;globalThis.__a = { ${noms.join(', ')} };`, ctxA);
  const mods = {
    N: await imp('src/numerosNouvelles.js'), R: await imp('src/repriseNumero.js'), E: await imp('src/numeroEcrit.js'),
    C: await imp('src/accueilReste/cartonsNumeros.js'), RT: await imp('src/republieTelephone.js'), AA: await imp('src/annoncesActions.js'),
    DP: await imp('src/aPublier/dossier.js'),   // (28 nov.) le dossier « À publier » (absent d'un arbre d'avant : null)
  };
  return { corps, manque, A: ctxA.__a || null, ...mods, APP };
}

// Un passage : ce que l'appareil sait + ce que la lecture rend ⇒ ce que la numérotation écrit.
function passageAvec(L, x) {
  const { N, R, E, C, RT, A, DP } = L;
  const fiches = JSON.parse(JSON.stringify(x.fiches || {}));
  const pool = x.pool || [];
  const store = { vrm_numero_ecrit: x.moi ? { actif: true, depuis: '2026-11-01T00:00:00.000Z' } : { actif: false, choisi: '2026-11-01T00:00:00.000Z' }, ...(x.store || {}) };
  const reprenable = (n) => { const s = String(n == null ? '' : n).trim(); return s && !/^B\d/i.test(s) ? s : null; };
  const lecture = (it) => E.lireNumeroEcrit({ titre: it && it.title, description: it && it.desc });
  const complets = x.complets || {};
  const ctx = {
    listings: { items: x.items || [], aConfirmer: x.aConfirmer || [], brouillons: x.brouillons || [], complets, ko: x.ko || [], lues: x.lues || {} },
    masqueesSurEtagere: x.masquees || [], annoncesANumeroter: N && N.annoncesANumeroter,
    sales: { items: [] }, txnPret: true, reservesNum: { parItem: x.reserves || {}, cles: new Set(Object.values(x.reserves || {}).map(String)) },
    recreesEff: x.recrees || {}, numPasse: true, setNumPasse: () => {}, takenNums: pool, numeros: fiches, usedNumeros: pool, takenCles: pool.map(String),
    ajouterNumerosHorsEcran: () => {}, load: (k, dflt) => (k in store ? store[k] : dflt), saleOv: x.saleOv || {},
    numVentesParIdentite: { parItem: x.ventesParItem || {}, parPhoto: {} }, repubMain: {}, fichesAnciennesAnnulees: () => ({}),
    dateMiseEnLigneMs: (it) => it.t || 0, listingDates: {}, numeroEcritActif: () => !!x.moi, annonceNumerotable: () => true,
    lectureEcriteVinted: lecture, retenirNumerosNeufs: C.retenirNumerosNeufs, CLE_NUMERO_ECRIT: 'vrm_numero_ecrit', clesLuesEnDouble: C.clesLuesEnDouble,
    decisionEcrite: E.decisionEcrite, numeroNeufPermis: N.numeroNeufPermis, lectureCompleteAnnonce: N.lectureCompleteAnnonce, lectureCompleteDe: N.lectureCompleteDe,
    marquerNouveau: N.marquerNouveau, repriseNumerosRecreation: R.repriseNumerosRecreation, archivesAEcrire: R.archivesAEcrire,
    horsLigneMaintenant: () => false, prefNum: '', numeroReprenable: reprenable,
    lireObjet: (k) => { const v = store[k]; return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; },
    VUS_EN_LIGNE: 'vrm_vus_en_ligne', CYCLE_DECISIONS: 'vrm_cycle_decisions',
    CLE_PHOTOS_VRM: 'vrm_photos_vrm', CLE_EMPREINTES_FICHES: 'vrm_empreintes_fiches', CLE_REPUB_REPONSES: 'vrm_republie_reponses', CLE_REPUB_ATTENTE: 'vrm_republie_attente',
    empreintesVinted: x.empreintesPasLues ? undefined : (x.empreintes === undefined ? {} : x.empreintes), disparuesDuCompte: RT && RT.disparuesDuCompte, decisionRepublie: RT && RT.decisionRepublie, empreintesDe: RT && RT.empreintesDe,
    venduesVinted: new Set((x.venduesVinted || []).map(String)), pairsLost: x.pairsLost || {}, changed: false,
    decisionNumeroBrouillon: DP ? DP.decisionNumeroBrouillon : undefined, brouillonsOuverts: DP ? DP.brouillonsOuverts : undefined,
    correspondanceBrouillons: DP ? DP.correspondance : undefined, heritageBrouillon: DP ? DP.heritage : undefined,
    ...A,
  };
  vm.createContext(ctx);
  const code = `(() => { with (this) { ${L.corps}
    return { fiches: nextNum, pool: [...nextUsed], nouveaux: typeof nouveauxNum !== 'undefined' ? nouveauxNum : [],
      reconnus: typeof reconnusNum !== 'undefined' ? reconnusNum : [], attente: typeof republieAttente !== 'undefined' ? republieAttente : [],
      propositions: typeof republiePropositions !== 'undefined' ? republiePropositions : [],
      brouillons: typeof brouillonsMaj !== 'undefined' ? brouillonsMaj : null, changed }; } }).call(this)`;
  let r;
  try { r = vm.runInContext(code, ctx); } catch (e) { return { erreur: String(e && e.message || e) }; }
  return r || { fiches, pool, nouveaux: [], reconnus: [], attente: [], propositions: [], vide: true };
}

// Une empreinte INVENTÉE (96 hex : 3 dHash puis 3 pHash de 64 bits) et sa variante à une distance
// voulue (a bits de dHash + b bits de pHash retournés à l'identique dans les 3 recadrages ⇒ a + b/2).
function alea(s) { return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
function empreinte(graine) { const r = alea(graine * 7919 + 13); let h = ''; for (let i = 0; i < 96; i++) h += Math.floor(r() * 16).toString(16); return h; }
function voisine(h, a, b, graine = 1) {
  const r = alea(graine * 104729 + 7);
  const bits = (n) => { const s = new Set(); while (s.size < n) s.add(Math.floor(r() * 64)); return [...s]; };
  const da = bits(a), pb = bits(b);
  const t = h.split('');
  const flip = (bloc, bit) => { const i = bloc * 16 + Math.floor(bit / 4); t[i] = (parseInt(t[i], 16) ^ (1 << (bit % 4))).toString(16); };
  for (let k = 0; k < 3; k++) { for (const x of da) flip(k, x); for (const x of pb) flip(3 + k, x); }
  return t.join('');
}

module.exports = { charger, passageAvec, empreinte, voisine };
