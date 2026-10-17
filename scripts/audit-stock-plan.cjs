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
  coins_seuls: (s) => s.replace("if (poly.some(([x, y]) => x > x0 && x < x1 && y > y0 && y < y1)) return false;", '').replace(/for \(let i = 0; i < poly\.length; i\+\+\) \{\n    const a = poly\[i\], b = poly\[\(i \+ 1\) % poly\.length\];\n    for \(let k = 0; k < 4; k\+\+\) if \(segCoupe\(a, b, coins\[k\], coins\[\(k \+ 1\) % 4\]\)\) return false;\n  \}/, ''),
  sans_obstacles: (s) => s.replace("const libre = (x, y) => rectDans(x, y, w, h, poly) && !obstacles.some((o) => chevauche({ cx: x, cy: y, w, h }, o));", "const libre = (x, y) => rectDans(x, y, w, h, poly);").replace('for (const s of obstacles) {', 'for (const s of []) {'),
  pas_de_descente: (s) => s.replace("const reste = pile.slice(0, i).concat(pile.slice(i + 1));", "const reste = pile.slice(0, i);"),
  sans_plafond: (s) => s.replace("if (pile.length >= cap) return null;", ''),
  croisee_ok: (s) => s.replace("if (seCroise(out)) return null;", ''),
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
    const pile = R.retirerDePile(['1', '2', '3', '4'], 0);
    dit(JSON.stringify(pile) === '["2","3","4"]', 'cartons au sol : celui du dessous retiré, les autres descendent');
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
