// ════════════════════════════════════════════════════════════════════════════
//  4 BORDEREAUX PAR PAGE A4 (14 nov., proposition 98 validée par Julien)
//  Pour qui n'a PAS d'imprimante thermique : les étiquettes isolées par la règle de
//  toujours (`poserBordereau` en mode étiquette — les mêmes PDF, le même tampon, le
//  même « page entière quand on ne sait pas »), puis rangées QUATRE par feuille A4,
//  2 × 2, dans l'ORDRE du lot, avec un trait de coupe en pointillés.
//
//  ⚠️ RIEN N'EST INVENTÉ : chaque case est une page du PDF produit (jamais redessinée) ;
//  ⚠️ JAMAIS UN CODE ÉCRASÉ : une étiquette est réduite d'UNE échelle commune (celle
//     de la plus grande, `ECHELLE_MIN` au moins, dite à l'écran : « à 95 % ») ; une page
//     qui ne tient pas dans un quart sans descendre sous `ECHELLE_MIN` (une A4 entière,
//     une déclaration en douane) part SEULE sur sa feuille, à 100 % — l'ordre est
//     gardé : la feuille entamée est close avant elle ;
//  ⚠️ LES BORDS : MARGE_MM autour de la feuille (une imprimante de bureau n'imprime pas
//     jusqu'au bord), GOUTTIERE_MM de chaque côté du trait de coupe.
//  `planDePlanche` est PUR (scripts/audit-colis-plus.cjs : 9 bordereaux ⇒ 3 feuilles,
//  ordre conservé) ; `imposerPlanche` le pose avec pdf-lib.
// ════════════════════════════════════════════════════════════════════════════
export const MM = 72 / 25.4;
export const A4 = { w: 210 * MM, h: 297 * MM };
export const MARGE_MM = 5;
export const GOUTTIERE_MM = 1;
export const ECHELLE_MIN = 0.85;
export const PAR_FEUILLE = 4;

// La boîte utile de la case k (0 haut-gauche, 1 haut-droite, 2 bas-gauche, 3 bas-droite).
export function caseA4(k, { marge = MARGE_MM * MM, gouttiere = GOUTTIERE_MM * MM } = {}) {
  const col = k % 2, lig = k < 2 ? 0 : 1;
  const W = A4.w / 2, H = A4.h / 2;
  const x = col === 0 ? marge : W + gouttiere;
  const w = W - marge - gouttiere;
  const yHaut = A4.h - (lig === 0 ? marge : H + gouttiere);   // PDF : y vers le haut
  const h = H - marge - gouttiere;
  return { x, y: yHaut - h, w, h };
}

// L'échelle d'une page (w × h points) dans une case, droite ou tournée d'un quart.
export function echelleDans(p, boite) {
  const droit = Math.min(boite.w / p.w, boite.h / p.h, 1);
  const tourne = Math.min(boite.w / p.h, boite.h / p.w, 1);
  return tourne > droit + 1e-6 ? { echelle: tourne, tourne: true } : { echelle: droit, tourne: false };
}

// pages : [{ w, h }] (points), dans l'ordre. Rend { feuilles: [{ type: 'planche', cases:
// [{ index, k }] } | { type: 'entiere', index }], echelle, etiquettes, entieres }.
// Une page « étiquette » tient dans une case à ECHELLE_MIN au moins ; les étiquettes
// d'un lot partagent UNE échelle (la plus petite nécessaire).
export function planDePlanche(pages) {
  const P = Array.isArray(pages) ? pages : [];
  const b0 = caseA4(0);
  const info = P.map((p) => (p && p.w > 0 && p.h > 0 ? echelleDans(p, b0) : { echelle: 0, tourne: false }));
  const estEtiquette = info.map((x) => x.echelle >= ECHELLE_MIN);
  const echelles = info.filter((x, i) => estEtiquette[i]).map((x) => x.echelle);
  const echelle = echelles.length ? Math.min(...echelles) : 1;
  const feuilles = [];
  let cur = null;
  P.forEach((p, i) => {
    if (!estEtiquette[i]) { cur = null; feuilles.push({ type: 'entiere', index: i }); return; }
    if (!cur || cur.cases.length >= PAR_FEUILLE) { cur = { type: 'planche', cases: [] }; feuilles.push(cur); }
    cur.cases.push({ index: i, k: cur.cases.length, tourne: info[i].tourne });
  });
  return { feuilles, echelle, etiquettes: estEtiquette.filter(Boolean).length, entieres: estEtiquette.filter((x) => !x).length };
}

// Pose le plan : `src` (PDFDocument aux pages déjà produites) ⇒ un nouveau PDFDocument A4.
export async function imposerPlanche(PL, src) {
  const { PDFDocument, rgb, degrees } = PL;
  const pagesSrc = src.getPages();
  const plan = planDePlanche(pagesSrc.map((p) => { const s = p.getSize(); return { w: s.width, h: s.height }; }));
  const out = await PDFDocument.create();
  for (const f of plan.feuilles) {
    if (f.type === 'entiere') { const [cp] = await out.copyPages(src, [f.index]); out.addPage(cp); continue; }
    const feuille = out.addPage([A4.w, A4.h]);
    const emb = await out.embedPages(f.cases.map((c) => pagesSrc[c.index]));
    f.cases.forEach((c, j) => {
      const b = caseA4(c.k), e = emb[j], s = plan.echelle;
      const w = (c.tourne ? e.height : e.width) * s, h = (c.tourne ? e.width : e.height) * s;
      const x0 = b.x + (b.w - w) / 2, y0 = b.y + (b.h - h) / 2;
      // Tournée d'un quart (sens inverse des aiguilles) autour de son coin : elle est
      // reposée à droite de sa place pour retomber dedans.
      if (c.tourne) feuille.drawPage(e, { x: x0 + w, y: y0, xScale: s, yScale: s, rotate: degrees(90) });
      else feuille.drawPage(e, { x: x0, y: y0, xScale: s, yScale: s });
    });
    // Le trait de coupe : en pointillés gris clair, seulement entre des cases posées.
    const gris = rgb(0.6, 0.6, 0.6), n = f.cases.length;
    const tirets = { dashArray: [4, 4], thickness: 0.5, color: gris };
    if (n > 1) feuille.drawLine({ start: { x: A4.w / 2, y: n > 2 ? MARGE_MM * MM : A4.h / 2 }, end: { x: A4.w / 2, y: A4.h - MARGE_MM * MM }, ...tirets });
    if (n > 2) feuille.drawLine({ start: { x: MARGE_MM * MM, y: A4.h / 2 }, end: { x: A4.w - MARGE_MM * MM, y: A4.h / 2 }, ...tirets });
  }
  return { doc: out, plan };
}
