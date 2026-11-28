#!/usr/bin/env node
// Audit : « L'ASSISTANT DE RANGEMENT » (28 nov. 2026, lot agent-rangement). Récit : docs/passation/2026-11-28-agent-rangement.md.
// Julien : « je veux un vrai agent IA qui pose des questions, totalement intelligent, qui adapte les étages, les pièces ».
//
// EXÉCUTE les vrais modules (src/rangement/plan.js, entretien.js, moteurIA.js ; api/_lib/rangement-ia.js), données INVENTÉES :
//   E1  1 pièce / 1 meuble : l'entretien sans IA rend un plan VALIDE (validerPlan), sans question « porte » inutile ;
//   E2  3 pièces / 6 meubles : une série de questions par pièce et par meuble, le meuble « près de la porte » en premier
//       dans l'ordre appliqué, la lettre des PROCHAINS N° (l'archive « B » refusée, redemandée) ;
//   E3  plus d'articles que de places : « il manque N places » est DEMANDÉ ; « ajouter des étages » fait tenir ;
//       « garder comme ça » le laisse, et `incoherences` le dit ;
//   E4  modifier un plan existant : meuble plein ⇒ « ajouter un étage ? » ; ajouter un meuble, déplacer un meuble de pièce,
//       retirer un meuble plein ⇒ ses cartons reçoivent des DÉPLACEMENTS proposés ; AUCUN N° changé (mêmes clés de
//       `vrm_slots`, seules m et i bougent), aucune paire non concernée déplacée ; meuble rétréci, pile tassée ;
//   V   validerPlan refuse : clé inconnue, type faux, étages hors bornes, ref inconnue, ref en double, gardé ET retiré ;
//   I1  le chemin IA : une réponse de modèle SIMULÉE (question puis plan) passe `handleRangement` puis `lireReponseIA` ;
//   I2  une réponse INVALIDE (texte libre, JSON tronqué, plan faux, question sans réponse possible) est REFUSÉE proprement ;
//   I3  le contexte envoyé au modèle ne contient ni titre, ni N°, ni prix (seulement les meubles et leurs comptes) ;
//   K   api/ai.js : le mode rangement ne lit JAMAIS une clé du corps, prend la clé du COFFRE, la clé du serveur pour le
//       SEUL propriétaire ; « pas su » ⇒ 503 (jamais un repli).
// `--mutation` : réaffaiblit chaque règle dans une copie et vérifie que l'audit rougit.
const fs = require('fs'), path = require('path'), os = require('os');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const esbuild = require(path.join(__dirname, '..', 'node_modules', 'esbuild'));

function charger(racine) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-rangement-'));
  const entree = path.join(dir, 'e.js');
  fs.writeFileSync(entree, `export * as plan from ${JSON.stringify(path.join(racine, 'src/rangement/plan.js'))};
export * as ent from ${JSON.stringify(path.join(racine, 'src/rangement/entretien.js'))};
export * as ia from ${JSON.stringify(path.join(racine, 'src/rangement/moteurIA.js'))};
export * as srv from ${JSON.stringify(path.join(racine, 'api/_lib/rangement-ia.js'))};`);
  const out = path.join(dir, 'b.cjs');
  esbuild.buildSync({ entryPoints: [entree], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'silent', nodePaths: [path.join(__dirname, '..', 'node_modules')] });
  return require(out);
}

async function juger(racine, bavard = true) {
  let ok = 0, ko = 0; const rouges = [];
  const dit = (c, nom, detail) => { if (c) { ok++; if (bavard) console.log('  ✓ ' + nom); } else { ko++; rouges.push(nom); if (bavard) console.log('  ✗ ' + nom + (detail ? '\n     ' + detail : '')); } };
  let M;
  try { M = charger(racine); } catch (e) { dit(false, 'les modules se chargent', String(e.message || e).slice(0, 200)); return { ok, ko, rouges }; }
  const { plan: P, ent: E, ia: IA, srv: S } = M;
  const dire = (cle, v) => (cle === 'rgt.nom.meuble' ? `${v.type} ${v.n}` : cle.startsWith('etag.type.') ? cle.slice(10) : cle.startsWith('rgt.piece.') ? cle.slice(10) : cle);
  // Joue une suite de réponses ; chaque réponse est { attendu: id de question, v | texte }.
  const jouer = (ctx, reponses) => {
    let e = E.demarrer(ctx); const vues = [];
    for (const r of reponses) {
      const q = E.question(e, ctx);
      if (!q) { vues.push('(fin)'); break; }
      vues.push(q.id);
      if (r.attendu && r.attendu !== q.id) return { e, vues, faux: `attendu ${r.attendu}, eu ${q.id}` };
      e = E.repondre(e, r.texte !== undefined ? { texte: r.texte } : { v: r.v }, ctx);
    }
    return { e, vues, q: E.question(e, ctx) };
  };

  // ── E1 ──
  {
    const ctx = { meubles: [], slots: {}, articles: 12, methode: null, dire };
    const r = jouer(ctx, [{ attendu: 'nbPieces', v: 1 }, { attendu: 'nomPiece', v: 'rgt.piece.chambre' }, { attendu: 'nbMeubles', texte: 'un' },
      { attendu: 'type', v: 'etagere' }, { attendu: 'etages', v: 4 }, { attendu: 'cases', texte: '5 boîtes' }, { attendu: 'numero', v: 'vrm' }]);
    const v = P.validerPlan(E.planDe(r.e), { existants: [] });
    dit(!r.faux && r.e.fini && !r.q, 'E1 1 pièce / 1 meuble : l\'entretien finit (7 questions, aucune « porte » pour un meuble seul)', r.faux || r.vues.join(' → '));
    dit(v.ok && v.plan.pieces.length === 1 && v.plan.pieces[0].nom === 'chambre' && v.plan.pieces[0].meubles[0].etages === 4 && v.plan.pieces[0].meubles[0].casesParEtage === 5,
      'E1 le plan est VALIDE : 1 pièce « chambre », 1 étagère de 4 étages × 5 boîtes', JSON.stringify(v));
    dit(!r.vues.includes('porte'), 'E1 aucune question « près de la porte » pour un seul meuble', r.vues.join(' → '));
    const a = P.appliquerPlan({ meubles: [], slots: {}, plan: v.plan, idNeuf: (k) => 'n' + k });
    dit(a && a.meubles.length === 1 && a.meubles[0].rows === 4 && a.meubles[0].cols === 5 && a.meubles[0].piece === 'chambre' && Object.keys(a.slots).length === 0,
      'E1 appliqué : un meuble 5 colonnes × 4 rangées, sa pièce notée, aucune case écrite', JSON.stringify(a && a.meubles));
  }
  // ── E2 ──
  {
    const ctx = { meubles: [], slots: {}, articles: 40, methode: { qui: 'vrm' }, archive: 'B', dire };
    const seq = [{ attendu: 'nbPieces', texte: 'trois' }];
    const pieces = [['rgt.piece.chambre', 2], [null, 3], ['rgt.piece.cave', 1]];
    pieces.forEach(([nom, n], a) => {
      seq.push(nom ? { attendu: 'nomPiece', v: nom } : { attendu: 'nomPiece', texte: 'Le dressing' });
      seq.push({ attendu: 'nbMeubles', v: n });
      for (let k = 0; k < n; k++) seq.push({ attendu: 'type', v: a === 2 ? 'pile' : 'etagere' }, { attendu: 'etages', v: a === 2 ? 6 : 3 }, { attendu: 'cases', v: a === 2 ? 1 : 4 });
    });
    seq.push({ attendu: 'porte', v: '1.2' }, { attendu: 'numero', v: 'lettre' }, { attendu: 'lettre', texte: 'b' }, { attendu: 'lettre', texte: 'c' });
    const r = jouer(ctx, seq);
    const v = P.validerPlan(E.planDe(r.e));
    const nQ = (id) => r.vues.filter((x) => x === id).length;
    dit(!r.faux && r.e.fini, 'E2 3 pièces / 6 meubles : l\'entretien suit les réponses jusqu\'au bout', r.faux || r.vues.join(' → '));
    dit(nQ('nomPiece') === 3 && nQ('nbMeubles') === 3 && nQ('type') === 6 && nQ('etages') === 6 && nQ('cases') === 6, 'E2 une série par pièce (3) et par meuble (6) — l\'entretien s\'adapte', r.vues.join(' → '));
    dit(nQ('lettre') === 2, 'E2 la lettre des anciens N° (« B », archive) est refusée et REDEMANDÉE', r.vues.join(' → '));
    dit(v.ok && v.plan.pieces.length === 3 && v.plan.pieces.reduce((n, p) => n + p.meubles.length, 0) === 6 && v.plan.pieces[1].nom === 'Le dressing' && v.plan.etiquetage && v.plan.etiquetage.lettre === 'C',
      'E2 plan VALIDE : 3 pièces, 6 meubles, « Le dressing » tapé, série « C »', JSON.stringify(v).slice(0, 300));
    const a = P.appliquerPlan({ meubles: [], slots: {}, plan: v.plan, idNeuf: (k) => 'n' + k });
    dit(a && a.meubles[0].porte === true && a.meubles[0].piece === 'Le dressing' && a.meubles.every((m, k) => m.ordre === k), 'E2 le meuble près de la porte passe EN PREMIER (ses cases proposées d\'abord)', JSON.stringify(a && a.meubles.map((m) => [m.name, m.piece, m.porte])));
    const noms = a ? a.meubles.map((m) => m.name) : [];
    dit(new Set(noms).size === noms.length, 'E2 chaque nouveau meuble a un nom distinct (Étagère A, B…)', noms.join(', '));
    dit(a && a.meubles.filter((m) => m.type === 'pile').every((m) => m.gravite === true), 'E2 une pile de boîtes est empilée (gravité)', '');
  }
  // ── E3 ──
  {
    const ctx = { meubles: [], slots: {}, articles: 50, methode: null, dire };
    const debut = [{ attendu: 'nbPieces', v: 1 }, { attendu: 'nomPiece', v: 'rgt.piece.garage' }, { attendu: 'nbMeubles', v: 1 }, { attendu: 'type', v: 'etagere' }, { attendu: 'etages', v: 2 }, { attendu: 'cases', v: 3 }, { attendu: 'numero', v: 'moi' }];
    const r1 = jouer(ctx, [...debut]);
    dit(r1.q && r1.q.id === 'manque' && r1.q.vars.n === 44, 'E3 50 articles pour 6 places : « il manque 44 places » est demandé avant la fin', r1.q ? r1.q.id + ' ' + JSON.stringify(r1.q.vars) : 'fin');
    const r2 = jouer(ctx, [...debut, { attendu: 'manque', v: 'etages' }]);
    const v2 = P.validerPlan(E.planDe(r2.e));
    dit(r2.e.fini && v2.ok && P.capacite(v2.plan).places >= 50 && !P.incoherences(v2.plan, { articles: 50 }).some((x) => x.k === 'manque'), 'E3 « ajouter des étages » : le plan tient les 50', JSON.stringify(v2.ok && P.capacite(v2.plan)));
    const r3 = jouer(ctx, [...debut, { attendu: 'manque', v: 'meuble' }, { attendu: 'type', v: 'casier' }, { attendu: 'etages', v: 2 }, { attendu: 'cases', v: 2 }, { attendu: 'manque', v: 'garder' }]);
    const v3 = P.validerPlan(E.planDe(r3.e));
    dit(!r3.faux && r3.e.fini && v3.ok && P.incoherences(v3.plan, { articles: 50 }).some((x) => x.k === 'manque' && x.n === 40), 'E3 « un meuble de plus » puis « garder » : redemandé tant que ça ne tient pas, puis l\'incohérence DITE (manque 40)', r3.faux || r3.vues.join(' → '));
    dit(P.incoherences({ pieces: [{ nom: 'x', meubles: [{ type: 'pile', etages: 20, casesParEtage: 1, nom: 'p' }] }, { nom: 'y', meubles: [] }] }, { articles: null }).map((x) => x.k).sort().join(',') === 'pieceVide,pileHaute',
      'E3 une pile de 20 et une pièce vide sont signalées ; « pas su » (articles null) ne dit aucun manque', '');
  }
  // ── E4 ──
  {
    const meubles = [{ id: 'm1', name: 'Étagère garage', cols: 4, rows: 2, piece: 'Garage', couleur: 'ardoise', planches: [1] },
      { id: 'm2', name: 'Armoire', cols: 3, rows: 2 }, { id: 'm3', name: 'Pile', cols: 1, rows: 4, gravite: true, type: 'pile' }];
    const slots = {}; const N = ['1', '2', '3', '7', '12', 'B230', '15', '16']; N.forEach((n, i) => { slots[n] = { m: 'm1', i }; });   // m1 plein (8/8)
    slots['20'] = { m: 'm2', i: 0 }; slots['21'] = { m: 'm2', i: 4 }; slots['22'] = { m: 'm2', i: 5 };
    slots['30'] = { m: 'm3', i: 3 }; slots['31'] = { m: 'm3', i: 2 };
    slots['99'] = { m: 'inconnu', i: 0 };
    const avant = JSON.parse(JSON.stringify(slots));
    const ctx = { meubles, slots, articles: 14, methode: { qui: 'vrm' }, dire };
    const r = jouer(ctx, [{ attendu: 'mode', v: 'modifier' }, { attendu: 'plein', v: 'oui' }, { attendu: 'changer', v: 'retirer' }, { attendu: 'quelMeuble', v: '1.0' }, { attendu: 'confirmerRetrait', v: 'oui' },
      { attendu: 'changer', v: 'ajouterMeuble' }, { attendu: 'quellePiece', v: 'nouvelle' }, { attendu: 'nomPiece', texte: 'Cave' }, { attendu: 'type', v: 'casier' }, { attendu: 'etages', v: 2 }, { attendu: 'cases', v: 3 },
      { attendu: 'changer', v: 'deplacer' }, { attendu: 'quelMeuble', v: '0.0' }, { attendu: 'versPiece', v: '2' }, { attendu: 'changer', v: 'fini' }]);
    dit(!r.faux && r.e.fini, 'E4 modifier : meuble plein ⇒ « ajouter un étage ? », retirer, ajouter dans une nouvelle pièce, déplacer, fini', r.faux || r.vues.join(' → '));
    const v = P.validerPlan(E.planDe(r.e), { existants: meubles });
    dit(v.ok && v.plan.retirer.join() === 'm2', 'E4 plan VALIDE ; seul le meuble nommé est retiré', JSON.stringify(v).slice(0, 400));
    const a = v.ok ? P.appliquerPlan({ meubles, slots, plan: v.plan, idNeuf: (k) => 'n' + k }) : null;
    const m1 = a && a.meubles.find((m) => m.id === 'm1');
    dit(m1 && m1.rows === 3 && m1.cols === 4 && String(m1.piece).toLowerCase() === 'cave' && m1.couleur === 'ardoise', 'E4 m1 : un étage de plus, déplacé dans « Cave », sa couleur d\'hier gardée', JSON.stringify(m1));
    const clesAvant = Object.keys(avant).sort(), clesApres = a ? [...Object.keys(a.slots), ...a.aRanger.map((x) => x.cle)].sort() : [];
    dit(a && JSON.stringify(clesAvant) === JSON.stringify(clesApres), 'E4 AUCUN N° changé : les mêmes clés de `vrm_slots` (aucune créée, aucune renommée)', clesApres.join(','));
    dit(a && Object.keys(a.slots).every((k) => avant[k] && Object.keys(a.slots[k]).sort().join() === Object.keys(avant[k]).sort().join()), 'E4 seules m et i changent dans une case', '');
    dit(a && N.every((n) => a.slots[n] && a.slots[n].m === 'm1' && a.slots[n].i === avant[n].i), 'E4 les 8 paires de m1 gardent LEUR case (même rangée, même colonne)', JSON.stringify(a && N.map((n) => a.slots[n])));
    const dep = a ? a.deplacements.map((d) => d.cle).sort().join() : '';
    dit(dep === '20,21,22' && a.aRanger.length === 0, 'E4 les 3 cartons du meuble retiré reçoivent un DÉPLACEMENT proposé (aucun autre ne bouge)', dep + ' / à ranger ' + JSON.stringify(a && a.aRanger));
    const prises = a ? Object.values(a.slots).filter((s) => s && s.m !== 'inconnu').map((s) => s.m + ':' + s.i) : [];
    dit(new Set(prises).size === prises.length, 'E4 jamais deux cartons dans la même case', prises.join(' '));
    dit(a && a.slots['99'] && a.slots['99'].m === 'inconnu', 'E4 une case d\'un meuble inconnu n\'est pas touchée', '');
    // Rétrécir (ref gardée, moins de colonnes) : les cartons hors des cases restantes sont relogés, jamais renumérotés.
    const plan2 = { version: 1, pieces: [{ nom: 'Garage', meubles: [{ ref: 'm1', nom: 'Étagère garage', type: 'etagere', etages: 2, casesParEtage: 2 }, { ref: 'm2', nom: 'Armoire', type: 'armoire', etages: 3, casesParEtage: 3 }, { ref: 'm3', nom: 'Pile', type: 'pile', etages: 4, casesParEtage: 1 }] }] };
    const v2 = P.validerPlan(plan2, { existants: meubles });
    const b = v2.ok ? P.appliquerPlan({ meubles, slots, plan: v2.plan }) : null;
    dit(b && b.slots['1'].i === 0 && b.slots['2'].i === 1 && b.slots['12'].i === 2 && b.slots['B230'].i === 3, 'E4 rétréci à 2 colonnes : les paires des colonnes 1-2 gardent rangée et colonne', JSON.stringify(b && ['1', '2', '12', 'B230'].map((n) => b.slots[n])));
    dit(b && ['3', '7', '15', '16'].every((n) => b.deplacements.some((d) => d.cle === n)) && Object.keys(b.slots).length + b.aRanger.length === Object.keys(slots).length,
      'E4 … celles des colonnes 3-4 reçoivent un déplacement ou repartent « à ranger », DIT', JSON.stringify(b && { dep: b.deplacements.map((d) => d.cle), ar: b.aRanger.map((x) => x.cle) }));
    const r3 = b && b.slots['30'], r31 = b && b.slots['31'];
    dit(r3 && r3.i === 3 && r31 && r31.i === 2, 'E4 la pile reste tassée (rien ne flotte)', JSON.stringify([r3, r31]));
    dit(P.appliquerPlan({ meubles: null, slots, plan: v2.plan }) === null && P.appliquerPlan({ meubles, slots: undefined, plan: v2.plan }) === null, 'E4 meubles ou cases pas lus ⇒ RIEN (null), jamais un plan sur du vide', '');
    // Un plan qui OUBLIE un meuble existant ne le retire pas.
    const v3 = P.validerPlan({ version: 1, pieces: [{ nom: 'Garage', meubles: [{ ref: 'm1', nom: 'E', type: 'etagere', etages: 2, casesParEtage: 4 }] }] }, { existants: meubles });
    const c = P.appliquerPlan({ meubles, slots, plan: v3.plan });
    dit(c && c.meubles.length === 3 && c.gardes.sort().join() === 'm2,m3' && c.deplacements.length === 0, 'E4 un meuble oublié par le plan est GARDÉ tel quel (seul « retirer » retire)', JSON.stringify(c && c.gardes));
  }
  // ── V ──
  {
    const ex = [{ id: 'm1', name: 'A', cols: 2, rows: 2 }];
    const bon = () => ({ version: 1, pieces: [{ nom: 'Chambre', meubles: [{ ref: null, nom: 'Étagère A', type: 'etagere', etages: 3, casesParEtage: 4 }] }] });
    const cas = [
      ['clé inconnue', (p) => { p.pieces[0].meubles[0].couleur = 'rouge'; }],
      ['clé inconnue en tête', (p) => { p.numeros = { 12: 13 }; }],
      ['type faux', (p) => { p.pieces[0].meubles[0].type = 'frigo'; }],
      ['étages 999', (p) => { p.pieces[0].meubles[0].etages = 999; }],
      ['étages 2.5', (p) => { p.pieces[0].meubles[0].etages = 2.5; }],
      ['cases en texte', (p) => { p.pieces[0].meubles[0].casesParEtage = '4'; }],
      ['ref inconnue', (p) => { p.pieces[0].meubles[0].ref = 'mX'; }],
      ['ref en double', (p) => { p.pieces[0].meubles[0].ref = 'm1'; p.pieces[0].meubles.push({ ref: 'm1', nom: 'B', type: 'bac', etages: 1, casesParEtage: 2 }); }],
      ['gardé ET retiré', (p) => { p.pieces[0].meubles[0].ref = 'm1'; p.retirer = ['m1']; }],
      ['nom vide', (p) => { p.pieces[0].nom = '  '; }],
      ['deux pièces au même nom', (p) => { p.pieces.push({ nom: 'chambre', meubles: [] }); }],
      ['version 2', (p) => { p.version = 2; }],
      ['aucune pièce', (p) => { p.pieces = []; }],
    ];
    dit(P.validerPlan(bon(), { existants: ex }).ok, 'V un plan juste passe', '');
    for (const [nom, f] of cas) { const p = bon(); f(p); dit(!P.validerPlan(p, { existants: ex }).ok, 'V refusé : ' + nom, JSON.stringify(P.validerPlan(p, { existants: ex }))); }
  }
  // ── I ──
  {
    const existants = [{ id: 'm1', name: 'Étagère garage', cols: 4, rows: 2, piece: 'Garage' }];
    const faux = (texte, status = 200, extra = {}) => async (url, opts) => { faux.dernier = { url, corps: JSON.parse(opts.body) }; return { ok: status < 300, status, json: async () => ({ content: [{ type: 'text', text: texte }], stop_reason: 'end_turn', ...extra }) }; };
    const res = () => { const r = { code: 0, corps: null, status(c) { r.code = c; return r; }, json(o) { r.corps = o; return r; } }; return r; };
    const corps = IA.corpsRequete({ historique: [{ role: 'assistant', texte: 'Combien de pièces ?' }, { role: 'user', texte: '2' }], contexte: IA.contexteIA({ meubles: existants, slots: { '12': { m: 'm1', i: 0 } }, articles: 30, methode: { qui: 'vrm' } }) });
    const r1 = res();
    await S.handleRangement(r1, 'sk-ant-test', corps, { appel: faux('```json\n{"type":"question","texte":"Combien d\'étages a l\'étagère du garage ?","choix":["2","3","4"],"saisie":"nombre","photo":true}\n```') });
    const q = r1.corps && r1.corps.ok ? IA.lireReponseIA(r1.corps.reponse, { existants }) : null;
    dit(q && q.ok && q.type === 'question' && q.choix.length === 3 && q.saisie === 'nombre', 'I1 réponse simulée « question » : lue, validée, prête à afficher', JSON.stringify(r1.corps));
    const envoye = JSON.stringify(faux.dernier && faux.dernier.corps);
    dit(faux.dernier && faux.dernier.corps.messages[0].role === 'user' && faux.dernier.corps.messages[faux.dernier.corps.messages.length - 1].role === 'user', 'I1 les messages commencent et finissent par l\'utilisateur (exigé par l\'API)', envoye.slice(0, 200));
    dit(!/"12"/.test(JSON.stringify(corps.contexte)) && !/title|titre|prix|price|"numero"|"num"/i.test(JSON.stringify(corps.contexte)), 'I3 le contexte envoyé : ni N°, ni titre, ni prix (les meubles et leurs comptes seulement)', JSON.stringify(corps.contexte));
    const planIA = { type: 'plan', explication: 'Deux pièces.', plan: { version: 1, pieces: [{ nom: 'Garage', meubles: [{ ref: 'm1', nom: 'Étagère garage', type: 'etagere', etages: 3, casesParEtage: 4, porte: true }] }, { nom: 'Chambre', meubles: [{ ref: null, nom: 'Armoire A', type: 'armoire', etages: 5, casesParEtage: 3 }] }], etiquetage: null } };
    const r2 = res(); await S.handleRangement(r2, 'k', corps, { appel: faux(JSON.stringify(planIA)) });
    const p = r2.corps && r2.corps.ok ? IA.lireReponseIA(r2.corps.reponse, { existants }) : null;
    dit(p && p.ok && p.type === 'plan' && p.plan.pieces.length === 2, 'I1 réponse simulée « plan » : validée par validerPlan', JSON.stringify(p));
    const invalides = [
      ['texte libre', 'Bien sûr ! Voici ma question : combien de pièces ?', 'format'],
      ['JSON tronqué', '{"type":"question","texte":"Combien', 'format'],
      ['type inconnu', '{"type":"action","faire":"supprimer"}', 'format'],
    ];
    for (const [nom, t, raison] of invalides) { const r = res(); await S.handleRangement(r, 'k', corps, { appel: faux(t) }); dit(r.corps && r.corps.ok === false && r.corps.reason === raison && r.corps.facture === true, 'I2 refusé au serveur : ' + nom + ' (et l\'appel payé est DIT)', JSON.stringify(r.corps)); }
    const mauvais = [
      ['plan à ref inconnue', { ...planIA, plan: { ...planIA.plan, pieces: [{ nom: 'G', meubles: [{ ref: 'mZZ', nom: 'X', type: 'etagere', etages: 3, casesParEtage: 3 }] }] } }],
      ['plan qui renumérote (clé en plus)', { ...planIA, plan: { ...planIA.plan, numeros: { 12: 99 } } }],
      ['plan à 999 étages', { ...planIA, plan: { ...planIA.plan, pieces: [{ nom: 'G', meubles: [{ ref: null, nom: 'X', type: 'etagere', etages: 999, casesParEtage: 3 }] }] } }],
      ['question sans réponse possible', { type: 'question', texte: 'Alors ?', choix: [], saisie: 'aucune' }],
      ['question à 12 boutons', { type: 'question', texte: 'Combien ?', choix: Array.from({ length: 12 }, (_, k) => String(k)) }],
      ['question avec une action', { type: 'question', texte: 'OK ?', choix: ['oui'], executer: 'retirer m1' }],
    ];
    for (const [nom, o] of mauvais) { const l = IA.lireReponseIA(o, { existants }); dit(l && l.ok === false, 'I2 refusé au navigateur : ' + nom, JSON.stringify(l)); }
    const r3 = res(); await S.handleRangement(r3, 'k', corps, { appel: faux('', 401) });
    dit(r3.corps && r3.corps.reason === 'cle-refusee', 'I2 clé refusée par Anthropic (401) : dit, rien d\'inventé', JSON.stringify(r3.corps));
    const r4 = res(); await S.handleRangement(r4, 'k', corps, { appel: faux('{}', 200, { stop_reason: 'refusal' }) });
    dit(r4.corps && r4.corps.ok === false && r4.corps.reason === 'refus', 'I2 refus du modèle : dit', JSON.stringify(r4.corps));
    const r5 = res(); await S.handleRangement(r5, 'k', IA.corpsRequete({ historique: [], contexte: {}, photo: 'data:image/jpeg;base64,QUJD' }), { appel: faux('{"type":"question","texte":"Je vois 4 étages ?","choix":["Oui","Non"]}') });
    const dern = faux.dernier.corps.messages[faux.dernier.corps.messages.length - 1];
    dit(Array.isArray(dern.content) && dern.content[0].type === 'image' && dern.content[0].source.media_type === 'image/jpeg', 'I1 la photo jointe part avec la dernière réponse (image base64)', JSON.stringify(dern).slice(0, 160));
  }
  // ── K (lu dans le code, commentaires retirés) ──
  {
    const src = fs.readFileSync(path.join(racine, 'api/ai.js'), 'utf8').replace(/\/\/.*$/gm, '');
    const bloc = (src.match(/if \(b\.mode === 'rangement'\) \{[\s\S]*?return handleRangement\(res, k, b\);\s*\}/) || [''])[0];
    dit(!!bloc, 'K api/ai.js porte le mode rangement', '');
    dit(bloc && !/b\.key|cleVendeur/.test(bloc), 'K le mode rangement ne lit JAMAIS une clé envoyée par le navigateur', bloc.slice(0, 200));
    dit(/lireCleIa\(u\.id\)/.test(bloc) && /=== undefined\)[^\n]*503/.test(bloc), 'K la clé du COFFRE du vendeur ; « pas su » ⇒ 503, jamais un repli', '');
    dit(/u\.id === proprio \? cleServeur : ''/.test(bloc) && /no-key/.test(bloc), 'K la clé du serveur pour le SEUL propriétaire ; sinon « no-key »', '');
    const iaCle = fs.readFileSync(path.join(racine, 'api/_lib/ia-cle.js'), 'utf8');
    dit(/chiffrerCoffre\(USAGE/.test(iaCle) && !/data:\s*\{[^}]*\bcle\s*[,}]/.test(iaCle.replace(/\{ cle \}/g, '')) && /return repondre\(res, 400, \{ erreur: 'refusee'/.test(iaCle),
      'K la clé du vendeur est rangée CHIFFRÉE (jamais en clair), une clé refusée n\'est pas rangée', '');
    dit(!/\bcle\b\s*:/.test((iaCle.match(/const publique = [^\n]*/) || [''])[0]), 'K ce que le navigateur apprend : jamais la clé (4 derniers caractères seulement)', '');
  }
  return { ok, ko, rouges };
}

const MUTATIONS = [
  ['src/rangement/plan.js', "for (const k of cles(m, ['ref', 'nom', 'type', 'etages', 'casesParEtage', 'porte'])) err.push(`${ici}:cle:${k}`);", '', 'validerPlan accepte une clé inconnue'],
  ['src/rangement/plan.js', "if (!entierDans(m.etages, 1, RANGEES_MAX)) err.push(ici + ':etages');", '', 'validerPlan accepte 999 étages'],
  ['src/rangement/plan.js', "if (typeof m.ref !== 'string' || !ids.has(m.ref)) err.push(ici + ':ref');", "if (typeof m.ref !== 'string') err.push(ici + ':ref');", 'validerPlan accepte une ref inconnue'],
  ['src/rangement/plan.js', "if (c) { out[k] = { ...slots[k], m: c.meubleId, i: c.i };", "if (c) { out[k + 'x'] = { ...slots[k], m: c.meubleId, i: c.i };", 'appliquerPlan change la clé (le N°) d\'un carton déplacé'],
  ['src/rangement/plan.js', "out[k] = { ...s, i: r * f.cols + c };", "out[k] = { ...s, i: c * f.cols + r };", 'appliquerPlan ne garde pas rangée/colonne'],
  ['src/rangement/plan.js', "if (mentionnes.has(id) || retires.has(id)) continue;", "continue;", 'un meuble oublié par le plan est supprimé'],
  ['src/rangement/plan.js', "const ordreDe = (e) => (e.x.porte ? 0 : 1);", "const ordreDe = () => 0;", 'la porte n\'est plus en premier'],
  ['src/rangement/entretien.js', "if (Number.isFinite(ctx.articles) && ctx.articles > c.places && !etat.manqueAccepte) etat.file.unshift({ q: 'manque' });", '', 'le manque de places n\'est plus demandé'],
  ['src/rangement/entretien.js', "if (!l || (archive && l === archive))", "if (!l)", 'la lettre d\'archive est acceptée'],
  ['src/rangement/entretien.js', "for (let a = 0; a < n; a++) suite.push({ q: 'nomPiece', a }, { q: 'nbMeubles', a });", "suite.push({ q: 'nomPiece', a: 0 }, { q: 'nbMeubles', a: 0 });", 'une seule pièce interrogée'],
  ['src/rangement/moteurIA.js', "if (!v.ok) err.push(...v.erreurs);", '', 'un plan IA invalide passe'],
  ['src/rangement/moteurIA.js', "for (const k of Object.keys(r)) if (!permis.includes(k)) err.push('cle:' + k);", '', 'une question IA porteuse d\'une action passe'],
  ['api/_lib/rangement-ia.js', "if (!o || (o.type !== 'question' && o.type !== 'plan'))", "if (!o)", 'le serveur laisse passer un type inconnu'],
  ['api/ai.js', "const k = cleV || (cleServeur && proprio && u.id === proprio ? cleServeur : '');", "const k = cleV || cleServeur;", 'la clé du serveur sert à tous (§2.9)'],
];

(async () => {
  console.log('audit-agent-rangement');
  const r = await juger(R);
  if (process.argv.includes('--mutation')) {
    let rouges = 0;
    for (const [f, de, vers, nom] of MUTATIONS) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-rgt-'));
      for (const x of ['src/rangement', 'api/_lib']) fs.cpSync(path.join(R, x), path.join(dir, x), { recursive: true });
      for (const x of ['src/stockEtageres.js', 'src/ouRanger.js', 'src/stockRegles.js', 'src/stockSortie.js', 'api/ai.js']) { fs.mkdirSync(path.dirname(path.join(dir, x)), { recursive: true }); fs.copyFileSync(path.join(R, x), path.join(dir, x)); }
      const p = path.join(dir, f); const s = fs.readFileSync(p, 'utf8');
      if (!s.includes(de)) { console.log('  ? mutation introuvable : ' + nom); rouges--; continue; }
      fs.writeFileSync(p, s.replace(de, vers));
      let m; try { m = await juger(dir, false); } catch (e) { m = { ko: 1 }; }   // une règle cassée qui fait tomber l'audit est rouge aussi
      if (m.ko > 0) { rouges++; console.log(`  ✓ mutation rouge (${m.ko}) : ${nom}`); } else console.log('  ✗ mutation VERTE : ' + nom);
    }
    console.log(`mutations : ${rouges}/${MUTATIONS.length} rouges`);
    if (rouges !== MUTATIONS.length) r.ko++;
  }
  console.log(`\naudit-agent-rangement : ${r.ok} vert(s), ${r.ko} rouge(s)`);
  process.exit(r.ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
