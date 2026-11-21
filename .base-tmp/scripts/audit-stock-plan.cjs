// Audit : LES RÈGLES DE LA PIÈCE DU STOCK (src/stockRegles.js, 17 octobre).
//
// Julien : « on doit pouvoir faire la forme que l'on veut à notre entrepôt…
// rien ne doit traverser un meuble… si deux numéros sont empilés et qu'on enlève
// celui du dessous, celui du dessus descend ». Ce qui DÉCIDE vit dans un module
// pur : on l'EXÉCUTE (pas de lecture du texte) et on juge ce qu'il rend.
//   · pièce en L : un meuble qui mord sur le coin rentrant est refusé, un meuble
//     dans une branche est accepté, un meuble hors de la pièce est refusé ;
//   · une forme qui se recoupe, ou de moins d'1 m², n'est pas une pièce ;
//   · « placer sans traverser » pousse hors d'un meuble et, s'il n'y a aucune
//     place, rend null (l'appelant garde l'ancienne position) ;
//   · une case-pile : celle du dessous retirée, celles du dessus descendent ;
//     une case pleine refuse ;
//   · une étagère métal tient 2 boîtes par case (37,5 cm de plateau) ;
//   · « posé sur » reconnaît une pile sur une table, pas une pile au sol.
// `--prouve` rejoue l'audit sur des règles RÉAFFAIBLIES : chacune doit le faire
// passer au rouge (« la fonction n'existait pas avant » ne prouve rien).
const fs = require('fs'), path = require('path'), os = require('os');
const SRC = path.join(__dirname, '..', 'src', 'stockRegles.js');

const MUTATIONS = {
  piece_sans_obstacles: (s) => s.replace("if (!rectDans(r.cx, r.cy, mw, md, poly) || obstacles.some((o) => chevauche(r, o))) continue;", "if (!rectDans(r.cx, r.cy, mw, md, poly)) continue;"),
  piece_sans_porte: (s) => s.replace("const obstacles = [{ cx: W / 2, cy: H - 0.18, w: 1.0, h: 0.36 }, { cx: W / 2, cy: H - 0.35 - ALLEE / 2, w: 1.2, h: ALLEE }];", "const obstacles = [];"),
  piece_trop: (s) => s.replace("&& meubles.length < voulu; cx += pas", "; cx += pas"),
  coins_seuls: (s) => s.replace("if (poly.some(([x, y]) => x > x0 && x < x1 && y > y0 && y < y1)) return false;", '').replace(/for \(let i = 0; i < poly\.length; i\+\+\) \{\n    const a = poly\[i\], b = poly\[\(i \+ 1\) % poly\.length\];\n    for \(let k = 0; k < 4; k\+\+\) if \(segCoupe\(a, b, coins\[k\], coins\[\(k \+ 1\) % 4\]\)\) return false;\n  \}/, ''),
  sans_obstacles: (s) => s.replace("const libre = (x, y) => rectDans(x, y, w, h, poly) && !obstacles.some((o) => chevauche({ cx: x, cy: y, w, h }, o));", "const libre = (x, y) => rectDans(x, y, w, h, poly);").replace('for (const s of obstacles) {', 'for (const s of []) {'),
  pas_de_descente: (s) => s.replace("const reste = pile.slice(0, i).concat(pile.slice(i + 1));", "const reste = pile.slice(0, i);"),
  sans_plafond: (s) => s.replace("if (pile.length >= cap) return null;", ''),
  croisee_ok: (s) => s.replace("if (seCroise(out)) return null;", ''),
  // Le défaut du 17 oct. : retirer sur TOUTE la liste (« ça décolle tout »).
  pile_toute_liste: (s) => s.replace("const col = a.slice(deb, fin); col.splice(idx - deb, 1);", "const col = a.slice(deb); col.splice(idx - deb, 1); return sansTrouFinal([...a.slice(0, deb), ...col]);"),
  hauteur_ignoree: (s) => s.replace("const h = hauteurPile(R, hauteurs, c);\n    for (let p = 0; p < h; p++) {", "const h = R;\n    for (let p = 0; p < h; p++) {"),
  hauteur_reflow: (s) => s.replace("for (let p = 0; p < R2; p++) out.push(p < part.length ? part[p] : '');", "part.forEach((x) => { if (!estTrou(x)) out.push(x); });"),
  hauteur_sans_garde: (s) => s.replace("if (haut + 1 > nh) return", "if (false) return"),
  trou_ignore: (s) => s.replace("const t = a.findIndex(estTrou);", "const t = -1;"),
  place_haut_dabord: (s) => s.replace("for (let r = nr - 1; r >= 0; r--) for (let c = 0; c < nc; c++) {\n    const k = r + '_' + c; if (n(k) >= capR(r)) continue;", "for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {\n    const k = r + '_' + c; if (n(k) >= capR(r)) continue;"),
};

async function charger(src) {
  const f = path.join(os.tmpdir(), `stockRegles-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

async function audit(src, bavard) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard) console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
  const essaie = (m, fn) => { try { fn(); } catch (e) { dit(false, m, String(e && e.message).slice(0, 120)); } };
  const R = await charger(src);
  const L = R.FORMES.L(8, 6);   // [[0,0],[8,0],[8,3],[4.5,3],[4.5,6],[0,6]] (calé à 25 cm)
  essaie('pièce en L', () => {
    dit(R.rectDans(2, 2, 1.5, 1, L), 'un meuble dans la grande branche du L tient');
    dit(R.rectDans(6.5, 1.5, 2, 1, L), 'un meuble dans la petite branche du L tient');
    dit(!R.rectDans(4.5, 3, 1.5, 1.5, L), 'un meuble qui MORD sur le coin rentrant est refusé');
    dit(!R.rectDans(6, 4.5, 1, 1, L), 'un meuble dans le vide du L (hors pièce) est refusé');
    dit(R.rectDans(0.5, 0.25, 1, 0.5, L), 'un meuble collé contre le mur est DEDANS (bord compris)');
    // Pièce en U : un meuble posé en travers du creux a ses quatre coins DANS la
    // pièce (deux dans le fond, un dans chaque branche)… et traverse deux murs.
    const U = R.FORMES.U(9, 6);
    dit(!R.rectDans(4.5, 4, 5, 3, U), 'pièce en U : un meuble en travers du creux (4 coins dedans) est refusé — il traverserait les murs');
    dit(R.rectDans(1.5, 4.5, 2, 2, U), 'pièce en U : un meuble dans une branche tient');
  });
  essaie('forme invalide', () => {
    dit(R.normaliserPoly([[0, 0], [6, 0], [1, 4], [5, 5]]) === null, 'une forme qui se recoupe (nœud papillon, 4,5 m²) n’est pas une pièce');
    dit(R.normaliserPoly([[0, 0], [0.5, 0], [0.5, 0.5]]) === null, 'une forme de moins d’1 m² n’est pas une pièce');
    const n = R.normaliserPoly([[2, 1], [10, 1], [10, 7], [2, 7]]);
    dit(n && n.w === 8 && n.h === 6 && n.dx === 2 && n.dy === 1 && n.poly[0][0] === 0, 'une forme est ramenée au coin (0,0) et dit de combien elle a glissé', n ? JSON.stringify(n) : 'null');
  });
  essaie('non-traversée', () => {
    const poly = R.rectPoly(6, 4);
    const tbl = { cx: 3, cy: 2, w: 2, h: 1 };
    const p = R.placerSansTraverser(3, 2, 1, 0.5, [tbl], poly);
    dit(p && !R.chevauche({ cx: p.cx, cy: p.cy, w: 1, h: 0.5 }, tbl), 'lâché sur une table, un meuble est poussé à côté (il ne la traverse pas)', JSON.stringify(p));
    const p2 = R.placerSansTraverser(2, 2, 1, 0.5, [], L);
    dit(p2 && p2.cx === 2 && p2.cy === 2, 'sans obstacle, il reste où on l’a lâché');
    const plein = R.placerSansTraverser(1, 1, 1.5, 1.5, [{ cx: 1, cy: 1, w: 2, h: 2 }], R.rectPoly(2, 2));
    dit(plein === null, 'aucune place libre ⇒ null (l’appelant garde l’ancienne position)', JSON.stringify(plein));
    const p3 = R.placerSansTraverser(5.8, 4.5, 1, 1, [], L);
    dit(p3 && R.rectDans(p3.cx, p3.cy, 1, 1, L), 'lâché dans le vide du L, il revient DANS la pièce', JSON.stringify(p3));
  });
  essaie('gravité dans une case', () => {
    const r = R.retirerDeCase({ '1_0': ['10', '11', '12'] }, '1_0', '10');
    dit(r && JSON.stringify(r.slots['1_0']) === '["11","12"]', 'celle du dessous retirée : celles du dessus descendent d’un cran', r ? JSON.stringify(r.slots) : 'null');
    dit(r && JSON.stringify(r.descendus) === '["11","12"]', 'et l’app sait lesquelles ont glissé (pour les faire tomber)');
    const r2 = R.retirerDeCase({ '1_0': ['10'] }, '1_0', '10');
    dit(r2 && !('1_0' in r2.slots), 'la dernière boîte retirée : la case est vide');
    dit(R.retirerDeCase({ '1_0': ['10'] }, '1_0', '99') === null, 'un numéro absent : rien n’est changé');
    const e = R.empilerDansCase({ '0_0': ['1'] }, '0_0', '2', 2);
    dit(e && JSON.stringify(e['0_0']) === '["1","2"]', 'on empile AU-DESSUS');
    dit(R.empilerDansCase({ '0_0': ['1', '2'] }, '0_0', '3', 2) === null, 'une case pleine refuse (rien ne déborde du plateau)');
    const pile = R.retirerDePile(['1', '2', '3', '4'], 0, 4);
    dit(JSON.stringify(pile) === '["2","3","4"]', 'cartons au sol : celui du dessous retiré, les autres descendent');
    // Le cas de Julien (17 oct.) : PLUSIEURS colonnes. Retirer le bas de la
    // 1re colonne ne doit faire descendre QUE la 1re colonne.
    const p3 = R.retirerDePile(['1', '2', '3', '4', '5', '6', '7', '8', '9'], 0, 3);
    dit(JSON.stringify(p3) === '["2","3","","4","5","6","7","8","9"]', 'plusieurs colonnes : seule la colonne du carton retiré descend, les autres restent à leur place', JSON.stringify(p3));
    const p4 = R.retirerDePile(['1', '2', '3', '4', '5', '6', '7'], 4, 3);
    dit(JSON.stringify(p4) === '["1","2","3","4","6","","7"]', 'au milieu d’une colonne : celui du dessus descend, la colonne suivante ne bouge pas', JSON.stringify(p4));
    const p5 = R.retirerDePile(['1', '2', '3', '4', '5'], 3, 3);
    dit(JSON.stringify(p5) === '["1","2","3","5"]', 'dans la DERNIÈRE colonne : elle raccourcit simplement', JSON.stringify(p5));
    dit(R.retirerDePile(['1', '', '3'], 1, 3) === null, 'une place vide ne se « retire » pas');
    // (28 oct.) Une hauteur par pile : `rows` = 3 (le pas), la pile 1 n'en prend que 2.
    const h1 = R.ajouterAPile(['1', '2', '', '4', '5', '6'], '99', 3, [2, 3]);
    dit(JSON.stringify(h1) === '["1","2","","4","5","6","99"]', 'hauteur par pile : la place au-dessus de la hauteur de la pile 1 n’est jamais comblée', JSON.stringify(h1));
    const h2 = R.ajouterAPile(['1', '', '', '4', '5'], '99', 3, [2, 3]);
    dit(JSON.stringify(h2) === '["1","99","","4","5"]', 'hauteur par pile : une pile pas pleine reçoit le carton', JSON.stringify(h2));
    const c1 = R.changerHauteurPile(['1', '2', '3', '4', '5', '6'], 3, null, 1, 5);
    dit(c1 && JSON.stringify(c1.nums) === '["1","2","3","","","4","5","6"]' && c1.rows === 5 && JSON.stringify(c1.hauteurs) === '[3,5]', 'agrandir la pile 2 : chaque carton garde sa pile et sa place, la pile 1 reste à 3', JSON.stringify(c1));
    const c2 = R.changerHauteurPile(['1', '2', '3', '4', '5', '6'], 3, null, 0, 2);
    dit(c2 && c2.erreur && !c2.nums, 'réduire une pile sous ses cartons : refusé, rien ne bouge', JSON.stringify(c2));
    const c3 = R.changerHauteurPile(['1', '2', '3', '', '', '4', '5', '6'], 5, [3, 5], 1, 3);
    dit(c3 && JSON.stringify(c3.nums) === '["1","2","3","4","5","6"]' && c3.rows === 3 && c3.hauteurs === null, 'deux piles revenues à la même hauteur : une seule hauteur, comme avant', JSON.stringify(c3));
    const c4 = R.retirerDePile(['1', '2', '', '4', '5', '6'], 0, 3);
    dit(JSON.stringify(c4) === '["2","","","4","5","6"]', 'pile plus basse : retirer son carton du bas ne touche pas la pile voisine', JSON.stringify(c4));
    const a1 = R.ajouterAPile(['2', '3', '', '4', '5', '6'], '99');
    dit(JSON.stringify(a1) === '["2","3","99","4","5","6"]', 'ajouter comble d’abord la place vide (le haut de la colonne entamée)', JSON.stringify(a1));
    dit(JSON.stringify(R.ajouterAPile(['1', '2'], '3')) === '["1","2","3"]', 'sans place vide, il se pose au-dessus');
    dit(JSON.stringify(R.cartonsDePile(['1', '', '3'])) === '["1","3"]', 'les places vides ne comptent pas comme des cartons');
  });
  essaie('prochaine place libre', () => {
    const metal = { build: 'metal', cases: 'pile', h3d: 1.25 };
    const pp = R.prochainePlaceMeuble({ rows: 5, cols: 2, h3d: 1.25, slots: { '4_0': ['1', '2'] } }, metal, 3.4);
    dit(pp && pp.cell === '4_1', 'étagère : le plateau du BAS d’abord, la case pleine est sautée', JSON.stringify(pp));
    const pc = R.prochainePlaceMeuble({ rows: 1, cols: 3, slots: { '0_0': ['1'] } }, { cases: 'cintre' }, 3.4);
    dit(pc && pc.cell === '0_1', 'portant : le premier cintre libre', JSON.stringify(pc));
    const pg = R.prochainePlaceMeuble({ rows: 3, cols: 2, slots: { '2_0': ['1'] } }, { build: 'grille' }, 3.4);
    dit(pg && pg.cell === '1_0', 'mur de boîtes : au-dessus de la dernière boîte de la colonne', JSON.stringify(pg));
    dit(R.prochainePlaceMeuble({ rows: 1, cols: 1, slots: { '0_0': ['1'] } }, { cases: 'cintre' }, 3.4) === null, 'meuble plein : aucune place inventée');
    dit(R.prochainePlaceMeuble({ rows: 1, cols: 1 }, { deco: true }, 3.4) === null, 'un décor ne range rien');
  });
  essaie('contenance', () => {
    const metal = { build: 'metal', cases: 'pile', rows: 5, h3d: 1.25 };
    dit(R.capaciteCase(metal, { rows: 5, h3d: 1.25 }, 3.4) === 2, 'une étagère métal tient 2 boîtes empilées par case', String(R.capaciteCase(metal, { rows: 5, h3d: 1.25 }, 3.4)));
    dit(R.capaciteCase({ cases: 'cintre' }, {}, 3.4) === 1, 'un cintre porte UN numéro');
    dit(R.capaciteCase({ build: 'metal', bacs: true, cases: 'pile', h3d: 1.25 }, { rows: 2, h3d: 1.25 }, 3.4) === 1, 'une étagère À BACS tient UN bac par case, même haute', String(R.capaciteCase({ build: 'metal', bacs: true, cases: 'pile', h3d: 1.25 }, { rows: 2, h3d: 1.25 }, 3.4)));
    dit(R.capaciteCase({ build: 'table', cases: 'pile', h3d: 0.5 }, {}, 3.4) >= 5, 'une table tient une pile de plusieurs boîtes');
  });
  essaie('posé sur', () => {
    const table = { x: 2, y: 2, w: 2, h: 1 };
    dit(R.estPoseSur({ x: 2.5, y: 2.25, w: 0.5, h: 0.5, lift: 0.75 }, table), 'une pile posée sur la table est reconnue (elle la suivra)');
    dit(!R.estPoseSur({ x: 2.5, y: 2.25, w: 0.5, h: 0.5, lift: 0 }, table), 'une pile au sol n’est pas « posée sur »');
    dit(!R.estPoseSur({ x: 6, y: 6, w: 0.5, h: 0.5, lift: 0.75 }, table), 'une pile posée sur un AUTRE meuble n’est pas sur celle-ci');
  });
  essaie('créer ma pièce', () => {
    if (typeof R.proposerPiece !== 'function') { dit(false, 'proposerPiece existe'); return; }
    const chev = (a, b) => ((a.w + b.w) / 2 - Math.abs(a.cx - b.cx)) > 0.003 && ((a.h + b.h) / 2 - Math.abs(a.cy - b.cy)) > 0.003;
    for (const [w, h, besoin] of [[4, 3, 64], [8, 6, 200], [12, 5, 400], [2, 2, 10]]) {
      const P = R.proposerPiece({ w, h, mw: 1.2, md: 0.5, cap: 10, besoin });
      const fps = P.meubles.map((m) => ({ cx: m.cx, cy: m.cy, w: 1.2, h: 0.5 })).concat([{ cx: P.porte.cx, cy: P.porte.cy, w: 1, h: 0.36 }]);
      let croise = 0; for (let i = 0; i < fps.length; i++) for (let j = i + 1; j < fps.length; j++) if (chev(fps[i], fps[j])) croise++;
      const dehors = fps.filter((f) => !R.rectDans(f.cx, f.cy, f.w, f.h, R.rectPoly(w, h))).length;
      dit(croise === 0 && dehors === 0, `pièce ${w}×${h} : aucun meuble ne traverse un autre ni la porte, aucun ne sort`, `${croise} croisement(s), ${dehors} dehors`);
      dit(P.capacite === P.meubles.length * 10 && P.manque === Math.max(0, besoin - P.capacite), `pièce ${w}×${h} : places et manque comptés juste`, `${P.meubles.length} meubles, ${P.capacite} places, manque ${P.manque}`);
      dit(P.meubles.length <= Math.ceil(besoin / 10), `pièce ${w}×${h} : pas plus de meubles que nécessaire`);
      const passage = { cx: P.porte.cx, cy: h - 0.35 - 0.5, w: 1.2, h: 1.0 }; const devant = P.meubles.filter((m) => chev({ cx: m.cx, cy: m.cy, w: 1.2, h: 0.5 }, passage));
      dit(devant.length === 0, `pièce ${w}×${h} : l'entrée devant la porte reste libre`);
    }
    const P = R.proposerPiece({ w: 4, h: 3, mw: 1.2, md: 0.5, cap: 20, besoin: 12 });
    dit(P.meubles.length === 1 && P.manque === 0, '12 articles, 20 places par meuble : un seul meuble, rien ne manque');
    const G = R.proposerPiece({ w: 2, h: 2, mw: 1.2, md: 0.5, cap: 10, besoin: 100 });
    dit(G.manque > 0, 'une pièce trop petite DIT ce qui manque (jamais un meuble en travers)', `manque ${G.manque}`);
  });
  return ko;
}

(async () => {
  const src = fs.readFileSync(SRC, 'utf8');
  if (process.argv.includes('--prouve')) {
    let tient = 0;
    for (const [nom, mut] of Object.entries(MUTATIONS)) {
      const m = mut(src);
      if (m === src) { console.log(`KO  mutation « ${nom} » : rien n'a été réaffaibli (texte introuvable)`); tient++; continue; }
      const ko = await audit(m, false);
      console.log(`${ko ? 'OK ' : 'KO '} mutation « ${nom} » : ${ko} rouge(s)`);
      if (!ko) tient++;
    }
    console.log(tient ? `\n❌ ${tient} mutation(s) restée(s) verte(s)` : '\n✅ toutes les mutations passent au rouge');
    process.exit(tient ? 1 : 0);
  }
  const ko = await audit(src, true);
  console.log(ko ? `\n❌ règles de la pièce : ${ko} rouge(s)` : '\n✅ règles de la pièce : tout est vert');
  process.exit(ko ? 1 : 0);
})();
