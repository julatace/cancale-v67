// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : RECHERCHE PAR PHOTO (6 nov.) — node scripts/audit-recherche-photo.cjs
// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTE l'empreinte et le classement (src/empreintePhoto.js, le vrai module)
// sur un jeu d'images INVENTÉES, dessinées ici pixel par pixel (des « paires »
// faites de formes et de couleurs : semelle, tige, col, bande, lacets, sur un
// fond mur + sol). Aucune photo réelle (dépôt public).
//   A. la MÊME image recadrée, rééclairée, bruitée, réduite, retournée revient
//      EN TÊTE, jamais « peu sûr », « très proche » au moins 9 fois sur 10 ;
//   B. deux images DIFFÉRENTES au MÊME titre ne sont jamais fusionnées : deux
//      lignes, deux identités, chacune son score ; changer les titres ne change
//      pas le classement (le titre n'entre pas dans le calcul, §5) ;
//   C. le mot dit d'un score n'est jamais « c'est elle » ;
//   D. aucune écriture, aucun réseau, aucune adresse tierce dans la feuille,
//      l'index et l'empreinte ; l'app les charge À LA DEMANDE (React.lazy) ;
//   E. une entrée sans empreinte (photo pas lue) n'est pas classée à zéro, elle
//      n'est pas classée du tout (elle est comptée à part par la feuille).
// AUDIT_MUTATION=titre | aveugle | lumiere : la règle réaffaiblie ⇒ l'audit doit rougir.
const fs = require('fs'), path = require('path'), os = require('os');
const RACINE = path.join(__dirname, '..');
const MUT = process.env.AUDIT_MUTATION || '';
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

// ── Le module, tel quel (ou muté dans une copie temporaire) ──────────────────
const SRC = path.join(RACINE, 'src', 'empreintePhoto.js');
const MUTATIONS = {
  // Le classement fusionne les entrées au même TITRE (ce que §5 interdit).
  titre: ['if (!e || e.cle == null || vus.has(String(e.cle)) || !e.empreinte) continue;\n    vus.add(String(e.cle));', 'if (!e || e.cle == null || vus.has(String(e.titre)) || !e.empreinte) continue;\n    vus.add(String(e.titre));'],
  // Le score ne regarde plus l'image.
  aveugle: ['combiner(parties(a, b))', 'combiner({ objet: 0.5, centre: 0.5, bords: 0.5, grille: 0.5, hash: 0.5 })'],
  // La luminosité n'est plus rapportée à l'objet, et la même photo n'est plus reconnue par le hachage.
  lumiere: ['const v = Math.min(1, v0 / vref);', 'const v = v0 / 255;'],
};

(async () => {
  if (!fs.existsSync(SRC)) { dit(false, 'src/empreintePhoto.js existe', 'absent : la recherche par photo n’existe pas sur cet arbre'); return fin(); }
  let chemin = SRC;
  if (MUT) {
    const m = MUTATIONS[MUT]; let s = fs.readFileSync(SRC, 'utf8');
    if (!m || !s.includes(m[0])) { console.log('KO  mutation inconnue ou plus applicable : ' + MUT); process.exit(2); }
    s = s.replace(m[0], m[1]);
    if (MUT === 'lumiere') { if (!s.includes('return base + bonus;')) { console.log('KO  mutation plus applicable : lumiere (bonus)'); process.exit(2); } s = s.replace('return base + bonus;', 'return base;'); }
    chemin = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mut-photo-')), 'empreintePhoto.mjs');
    fs.writeFileSync(chemin, s);
    console.log('── mutation : ' + MUT);
  }
  const E = await import(chemin);

  // ── Le jeu inventé ─────────────────────────────────────────────────────────
  const W = 240, H = 320;
  const rnd = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const PAL = ['#f4f4f2', '#111111', '#c8102e', '#1d4ed8', '#15803d', '#f59e0b', '#9ca3af', '#7c3aed', '#0ea5e9', '#a16207', '#ec4899', '#14532d', '#78350f', '#fde047', '#e5e7eb'];
  const FONDS = [['#eeeae4', '#d9d2c7'], ['#e8ecef', '#c9cfd6'], ['#f5f5f5', '#e0e0e0'], ['#efe9df', '#cbbba5']];
  const dessiner = (m) => {
    const px = new Uint8ClampedArray(W * H * 4);
    const [mur, sol] = [hex(m.fond[0]), hex(m.fond[1])];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = y < H * 0.58 ? mur : sol, i = (y * W + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255; }
    const poser = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; };
    const ellipse = (cx, cy, rx, ry, c, yMax = H) => { for (let y = Math.floor(cy - ry); y <= cy + ry && y < yMax; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) poser(x, y, c); };
    const rect = (x0, y0, x1, y1, c) => { for (let y = Math.round(y0); y < y1; y++) for (let x = Math.round(x0); x < x1; x++) poser(x, y, c); };
    const k = m.forme;
    ellipse(W * 0.48, H * (0.53 - k * 0.02), W * (0.36 + k * 0.03), H * (0.12 + k * 0.02), hex(m.tige), H * 0.64);
    ellipse(W * (0.24 + k * 0.02), H * 0.46, W * 0.1, H * 0.09, hex(m.col));
    rect(W * 0.1, H * 0.62, W * 0.9, H * (0.68 + k * 0.015), hex(m.semelle));
    for (let t = 0; t <= 1; t += 0.01) { const x = W * (0.28 + 0.42 * t), y = H * (0.6 - 0.1 * t + 0.08 * t * (1 - t) * m.courbe); ellipse(x, y, W * 0.022, W * 0.022, hex(m.bande)); }
    for (let j = 0; j < 5; j++) rect(W * (0.5 + j * 0.05), H * (0.43 + j * 0.006), W * (0.53 + j * 0.05), H * (0.455 + j * 0.006), hex(m.lacets));
    return { px, w: W, h: H };
  };
  const r0 = rnd(11), pick = () => PAL[Math.floor(r0() * PAL.length)];
  const MODELES = [];
  for (let i = 0; i < 30; i++) MODELES.push({ tige: pick(), col: pick(), semelle: pick(), bande: pick(), lacets: pick(), fond: FONDS[i % 4], forme: (i % 3) - 1, courbe: 1 + (i % 4) });
  // Deux paires DIFFÉRENTES vendues sous le MÊME titre (§5 : 22 % des ventes ont un titre en double).
  MODELES.push({ tige: '#f4f4f2', col: '#f4f4f2', semelle: '#f4f4f2', bande: '#c8102e', lacets: '#f4f4f2', fond: FONDS[0], forme: 0, courbe: 2 });
  MODELES.push({ tige: '#f4f4f2', col: '#1d4ed8', semelle: '#a16207', bande: '#1d4ed8', lacets: '#111111', fond: FONDS[1], forme: 1, courbe: 1 });
  const A = MODELES.length - 2, B = MODELES.length - 1;
  const titre = (i) => (i === A || i === B ? 'Nike Air Force 1 blanc taille 42' : `Paire inventée ${i}`);
  const images = MODELES.map(dessiner);
  const index = images.map((im, i) => ({ cle: 'https://images1.vinted.net/t/banc/f800/' + (100 + i) + '.jpeg', numero: String(200 + i), titre: titre(i), empreinte: E.empreinteDePixels(im.px, im.w, im.h) }));

  // ── Les transformations de la MÊME image ───────────────────────────────────
  const recadrer = (im, fx0, fy0, fx1, fy1) => { const x0 = Math.round(im.w * fx0), y0 = Math.round(im.h * fy0), w = Math.round(im.w * (fx1 - fx0)), h = Math.round(im.h * (fy1 - fy0)); const px = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) px.set(im.px.subarray(((y + y0) * im.w + x0) * 4, ((y + y0) * im.w + x0 + w) * 4), y * w * 4); return { px, w, h }; };
  const eclairer = (im, gain, biais, teinte) => { const px = new Uint8ClampedArray(im.px.length); for (let i = 0; i < px.length; i += 4) { for (let c = 0; c < 3; c++) px[i + c] = (im.px[i + c] * gain + biais) * teinte[c]; px[i + 3] = 255; } return { px, w: im.w, h: im.h }; };
  const bruiter = (im, s, graine) => { const r = rnd(graine), px = new Uint8ClampedArray(im.px.length); for (let i = 0; i < px.length; i += 4) { for (let c = 0; c < 3; c++) px[i + c] = im.px[i + c] + (r() + r() + r() - 1.5) * s * 2; px[i + 3] = 255; } return { px, w: im.w, h: im.h }; };
  const reduireIm = (im, f) => { const w = Math.round(im.w * f), h = Math.round(im.h * f), px = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = (Math.floor(y / f) * im.w + Math.floor(x / f)) * 4, d = (y * w + x) * 4; px[d] = im.px[s]; px[d + 1] = im.px[s + 1]; px[d + 2] = im.px[s + 2]; px[d + 3] = 255; } return { px, w, h }; };
  const retourner = (im) => { const px = new Uint8ClampedArray(im.px.length); for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) { const s = (y * im.w + x) * 4, d = (y * im.w + (im.w - 1 - x)) * 4; for (let c = 0; c < 4; c++) px[d + c] = im.px[s + c]; } return { px, w: im.w, h: im.h }; };
  const TRANSFOS = {
    'recadrée (85 %, centrée)': (im) => recadrer(im, 0.075, 0.075, 0.925, 0.925),
    'recadrée (décalée)': (im) => recadrer(im, 0, 0.1, 0.88, 0.98),
    'plus sombre (×0,6)': (im) => eclairer(im, 0.6, 0, [1, 1, 1]),
    'plus claire et chaude': (im) => eclairer(im, 1.15, 12, [1.06, 1, 0.88]),
    'lumière froide, contraste bas': (im) => eclairer(im, 0.75, 30, [0.9, 0.97, 1.08]),
    'bruitée (comme un JPEG de téléphone)': (im) => bruiter(im, 7, 3),
    'réduite (×0,45)': (im) => reduireIm(im, 0.45),
    'retournée (l’autre côté)': (im) => retourner(im),
    'recadrée + sombre + bruitée': (im) => bruiter(eclairer(recadrer(im, 0.05, 0.08, 0.95, 0.9), 0.7, 5, [1.04, 1, 0.92]), 5, 9),
  };

  // A. La même image revient en tête, dite « très proche ».
  for (const [nom, f] of Object.entries(TRANSFOS)) {
    let tete = 0, tres = 0, peuSur = 0; const rates = [];
    images.forEach((im, i) => {
      const q = E.empreinteDePixels(...Object.values(f(im)));
      const cl = E.classer(q, index, { max: 5 });
      if (cl[0] && cl[0].cle === index[i].cle) tete++; else rates.push(`${i}→${cl[0] && cl[0].numero}`);
      if (process.env.DBG && cl[0].cle !== index[i].cle) { const moi0 = cl.find((x) => x.cle === index[i].cle); console.log(nom, i, 'tête', cl[0].numero, cl[0].score, JSON.stringify(E.parties(q, cl[0].empreinte)), 'moi', moi0 && moi0.score, JSON.stringify(E.parties(q, index[i].empreinte))); }
      const moi = cl.find((x) => x.cle === index[i].cle);
      if (!moi || moi.niveau === 'peu-sur') peuSur++;
      if (moi && moi.niveau === 'tres-proche') tres++; else if (process.env.DBG) console.log('niveau', nom, i, moi && moi.score, moi && moi.relatif, JSON.stringify(E.parties(q, index[i].empreinte)));
    });
    // En tête TOUJOURS ; jamais « peu sûr » ; « très proche » au moins 9 fois sur 10
    // (une lumière froide ET voilée peut ne laisser que « proche » : c'est dit, pas caché).
    dit(tete === images.length && !peuSur && tres >= Math.ceil(images.length * 0.9), `A. ${nom} : la même image en tête ${tete}/${images.length}, « très proche » ${tres}/${images.length}, « peu sûr » ${peuSur}`, rates.slice(0, 6).join(' '));
  }

  // B. Deux images différentes au même titre : deux lignes, jamais fusionnées.
  {
    const qA = E.empreinteDePixels(...Object.values(TRANSFOS['recadrée + sombre + bruitée'](images[A])));
    const qB = E.empreinteDePixels(...Object.values(TRANSFOS['plus claire et chaude'](images[B])));
    const sousIndex = [index[A], index[B], ...index.slice(0, 6)];
    const clA = E.classer(qA, sousIndex, { max: 8 }), clB = E.classer(qB, sousIndex, { max: 8 });
    const deux = (cl) => cl.filter((x) => x.titre === titre(A)).map((x) => x.numero);
    dit(clA[0] && clA[0].cle === index[A].cle && clB[0] && clB[0].cle === index[B].cle, 'B. même titre : la photo de A désigne A, celle de B désigne B', `A→${clA[0] && clA[0].numero}, B→${clB[0] && clB[0].numero}`);
    dit(deux(clA).length === 2 && deux(clB).length === 2 && new Set(deux(clA)).size === 2, 'B. les deux paires au même titre restent deux lignes, deux N°', JSON.stringify(deux(clA)));
    const cles = clA.map((x) => x.cle);
    dit(new Set(cles).size === cles.length, 'B. chaque entrée une seule fois (identité = la clé, jamais le titre)');
    // Le titre n'entre pas dans le calcul : les mêmes titres pour tout le monde ⇒ même classement.
    const meme = sousIndex.map((x) => ({ ...x, titre: 'Même titre partout' }));
    const clT = E.classer(qA, meme, { max: 8 });
    dit(JSON.stringify(clT.map((x) => [x.cle, x.score])) === JSON.stringify(clA.map((x) => [x.cle, x.score])), 'B. des titres tous identiques ne changent ni l’ordre ni les scores', `${clT.length} lignes au lieu de ${clA.length}`);
    // Deux annonces à la MÊME photo (la même paire republiée) : deux lignes, le même score — c'est SON clic qui choisit.
    const jum = [index[A], { ...index[A], cle: index[A].cle + '?autre', numero: '999' }, ...index.slice(0, 4)];
    const clJ = E.classer(qA, jum, { max: 5 });
    dit(clJ.length >= 2 && clJ[0].score === clJ[1].score && new Set([clJ[0].numero, clJ[1].numero]).size === 2, 'B. deux annonces à la même photo : deux lignes au même score, aucune choisie à sa place');
  }

  // C. Le mot d'un score.
  {
    const mots = Object.values(E.NIVEAUX).join(' | ');
    dit(!/c['’]est (elle|la bonne|la m[eê]me)|identique|certain/i.test(mots) && Object.keys(E.NIVEAUX).length === 3, 'C. les mots d’un score : ' + mots);
    dit(E.niveauDe(1) === 'tres-proche' && E.niveauDe(0) === 'peu-sur' && E.SEUILS.tresProche > E.SEUILS.proche, 'C. trois niveaux ordonnés');
  }

  // D. Rien n'écrit, rien ne part, et rien ne pèse au premier chargement.
  {
    const sans = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    const fichiers = ['src/empreintePhoto.js', 'src/indexPhotos.js', 'src/RecherchePhoto.jsx'];
    for (const f of fichiers) {
      if (!fs.existsSync(path.join(RACINE, f))) { dit(false, `D. ${f} existe`); continue; }
      const s = sans(f);
      const fautes = [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /localStorage/, /\bsave\s*\(/, /method\s*:\s*['"]POST/i, /https?:\/\//, /new\s+WebSocket/, /import\s*\(\s*['"]https?:/].filter((re) => re.test(s)).map(String);
      dit(!fautes.length, `D. ${f} : aucune requête, aucune écriture, aucune adresse tierce`, fautes.join(' '));
    }
    const app = fs.readFileSync(path.join(RACINE, 'src/App.jsx'), 'utf8');
    dit(/React\.lazy\(\s*\(\)\s*=>\s*import\(\s*['"]\.\/RecherchePhoto\.jsx['"]\s*\)\s*\)/.test(app), 'D. la feuille est chargée à la demande (React.lazy)');
    dit(!/^\s*import[^;]*from\s*['"]\.\/(empreintePhoto|indexPhotos|RecherchePhoto)(\.jsx?)?['"]/m.test(app), 'D. App.jsx n’importe ni l’empreinte, ni l’index, ni la feuille au chargement');
    // Le chemin des octets est celui de l'app (extension d'abord, puis la route de VRM) — jamais un service tiers.
    dit(/lireOctets=\{\(u\)=>chargerPhotoBoite\(u\)\}/.test(app), 'D. les octets d’une photo Vinted passent par `chargerPhotoBoite` (extension, puis la route de VRM)');
    // L'index est rangé par URL exacte (clé IndexedDB = l'URL).
    const ix = sans('src/indexPhotos.js');
    dit(/s\.put\(v,\s*url\)/.test(ix) && !/titre|title/.test(ix), 'D. l’index est rangé par URL exacte, jamais par titre');
  }

  // E. Une entrée sans empreinte n'est pas classée (comptée à part par la feuille).
  {
    const cl = E.classer(index[0].empreinte, [{ ...index[1], empreinte: null }, index[0]], { max: 5 });
    dit(cl.length === 1 && cl[0].cle === index[0].cle, 'E. une photo pas lue n’est pas classée (ni à zéro, ni devinée)');
  }
  fin();
})().catch((e) => { dit(false, 'l’audit a pu s’exécuter', String(e && e.stack || e).split('\n').slice(0, 3).join(' ')); fin(); });

function fin() { console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTout est vert'); process.exitCode = ko ? 1 : 0; }
