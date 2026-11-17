// ⚠️⚠️ BANC — « CRÉÉ PAR VRM.CENTER » JUSTE AU-DESSUS DU QR, POUR CHAQUE TRANSPORTEUR (17 nov., lot tampon-qr)
//
// Julien, 17 nov. : « pour l'impression c'est très bien, seulement je veux que le créé par vrm.center soit vraiment
// juste au-dessus du qrcode, pas en dessous ou sur les côtés là où on met le scotch ».
//
// Ce banc EXÉCUTE le vrai code d'App.jsx (`poserBordereau`, `tamponnerBordereau`… extraits par `_code-impression.cjs`)
// et src/impression/planche4.js dans Chromium (pdf.js), sur des bordereaux INVENTÉS dessinés ici à la forme de chaque
// transporteur (aucune donnée réelle : le dépôt est public) :
//   mondialrelay  A4 debout, notice en haut, étiquette 10×15 en bas, un texte 6 mm au-dessus du QR (place serrée)
//   vintedgo      la page EST l'étiquette 10×15, grand QR au milieu
//   chronopost    A4 COUCHÉE (842 × 595, iText) : fiche à gauche, étiquette à droite, DataMatrix sous l'en-tête
//   vestiaire     la même, page /Rotate 270 (TCPDF) : l'étiquette s'affiche DE TRAVERS
//   colissimo     10×15, DataMatrix à gauche sous « Expédition », gros code-barres en bas
//   relaiscolis   150 × 100 COUCHÉE (sur le rouleau 10×15, VRM la tourne)
//   relaisa4      la même étiquette posée DE TRAVERS (90°) dans une A4 debout, notice droite au-dessus
//   ups           10×15, un MaxiCode (œil de bœuf) en guise de code 2D
//   dpd           10×15, SANS code 2D transporteur (un petit QR décoratif) : repli sur le code-barres principal
//   international l'étiquette Hermes 150 × 100 en Form XObject dans une A4 (« Bordereau-Vinted »)
//   leurre        Mondial Relay + un GRAND QR publicitaire sur la notice : seul celui de l'étiquette compte
// sur les supports : Classique A4 (`a4`), thermique 10×15 (`10x15`) et « 4 par page » (`planche4` : la page thermique
// réimposée sur A4 par `imposerPlanche`).
//
// La MESURE ne lit jamais le code de l'app : le code visé est dessiné en ROUGE pur dans un témoin imprimé SANS tampon
// (le leurre en BLEU), sa boîte est celle des pixels rouges ; le SENS de l'étiquette est celui de son en-tête (texte
// pdf.js du témoin). Dans le sens de l'étiquette, pour chaque transporteur × support :
//   1. la mention est écrite, dans le sens de l'étiquette (jamais de travers) ;
//   2. son centre est sur l'axe du code (± 1 mm) ;
//   3. son bas (jambage du « p ») est 2 à 4 mm AU-DESSUS du bord haut du code (jamais dessous, jamais à côté) ;
//   4. elle ne touche aucune encre de l'étiquette (rendu du témoin, boîte des lettres + 0,25 mm) ;
//   5. elle reste dans la page (1,5 mm du bord au moins) et lisible (4,5 à 7,5 pt) ;
//   6. le code n'a pas un pixel changé (sa boîte + 2 mm, avec et sans tampon) ;
//   7. la même place que dans le témoin en couleur (le noir pur du thermique ne change rien).
// `BANC_MUTATION=dessous|cote|loin` : la mention posée sous le code, à côté, ou 8 mm au-dessus ⇒ rouge (§6.1).
// `CAPTURES=dossier` : chaque rendu en PNG (`<fixture>-<support>.png`) et une planche par support.
// `BANC_SEUL=a4,10x15` : seulement ces supports. `BANC_FX=vestiaire,ups` : seulement ces bordereaux.
require('../_source-app.cjs').brancher();
const path = require('path'), fs = require('fs'), http = require('http');
const CI = require('./_code-impression.cjs');
const RACINE = path.join(__dirname, '..', '..');
const NM = path.join(RACINE, 'node_modules');
const { chromium } = require(path.join(NM, 'playwright'));
const APP = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
const MUT = process.env.BANC_MUTATION || '';
const CAPT = process.env.CAPTURES || '';
const SEUL = process.env.BANC_SEUL || '';
const SEUL_FX = process.env.BANC_FX || '';
const PORT = Number(process.env.BANC_PORT) || (20000 + Math.floor(Math.random() * 20000));
const CHROME = process.env.VRM_CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
let ok = 0, ko = 0;
const rouges = [];
const dit = (c, m, d) => { if (c) ok++; else { ko++; rouges.push(m); } console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };

const regles = CI.regles(); let imp = CI.impression(APP);
const DEBUT = '// ── LE TAMPON DU BORDEREAU', FIN = '// ── IMPRIMANTE NORMALE OU THERMIQUE';
let tampon = APP.slice(APP.indexOf(DEBUT), APP.indexOf(FIN));
if (!imp || APP.indexOf(DEBUT) < 0) { console.log('❌ code d’impression introuvable'); process.exit(1); }
const planche = CI.sansExport(fs.readFileSync(path.join(RACINE, 'src', 'impression', 'planche4.js'), 'utf8'));
// Les mutations : la règle réaffaiblie (la mention reportée sous le code, à côté, ou loin au-dessus) ⇒ rouge.
const muter = (s, a, b) => { if (!s.includes(a)) { dit(false, `mutation « ${MUT} » applicable`, 'motif absent'); return s; } return s.split(a).join(b); };
const POINT_MUT = '/*MUTATION-MENTION*/';
if (MUT === 'dessous') tampon = muter(tampon, POINT_MUT, 'vb = qf.y + qf.h + g + 0.8 * T;');
if (MUT === 'cote') tampon = muter(tampon, POINT_MUT, 'u0 = qf.x + qf.w + 3 * MM_M; vb = qf.y + qf.h / 2;');
if (MUT === 'loin') tampon = muter(tampon, POINT_MUT, 'vb -= 5 * MM_M;');
const SCRIPT = `const chargerPdfjs=async()=>window.pdfjsLib;
let __store={}; const load=(k,d)=>(k in __store?JSON.parse(JSON.stringify(__store[k])):d); const save=(k,v)=>{__store[k]=JSON.parse(JSON.stringify(v));}; const libererOngletPdf=()=>{};
${regles}\n${tampon}\n${imp}\n${planche.replace(/\bconst MM = /, 'const MM_PL = ').replace(/\bMM\b/g, 'MM_PL').replace(/\bA4\b/g, 'A4_PL')}
window.__vrm = { poserBordereau, imposerPlanche, store: (v) => { __store = v; } };`;

const srv = http.createServer((q, r) => {
  const f = q.url.split('?')[0]; let p = '';
  if (f.startsWith('/pdfjs/')) p = path.join(NM, 'pdfjs-dist', 'build', path.basename(f));
  else if (f === '/pdf-lib.js') p = path.join(NM, 'pdf-lib', 'dist', 'pdf-lib.min.js');
  else if (f === '/qrcode.js') p = path.join(NM, 'qrcode-generator', 'dist', 'qrcode.js');
  if (!p) { r.writeHead(200, { 'content-type': 'text/html' }); return r.end('<!doctype html><html><body></body></html>'); }
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' }); fs.createReadStream(p).pipe(r);
});

// ── LES BORDEREAUX INVENTÉS (dans la page) ───────────────────────────────────
// Une étiquette se dessine dans SON repère (mm, origine en bas à gauche) ; la mise en page la pose (droite, de
// travers, en Form XObject). `coul` : le code visé en rouge et le leurre en bleu (le témoin), sinon tout en noir.
const DANS_PAGE = String.raw`
const MMp = 72 / 25.4;
const __b64 = (o) => { let s = ''; for (let i = 0; i < o.length; i += 0x8000) s += String.fromCharCode.apply(null, o.subarray(i, i + 0x8000)); return btoa(s); };
const __oct = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
const __fx = (() => {
  // Le contexte d'une étiquette : dessine en mm dans son repère.
  const ctx = (PL, qrcode, p, f, fb, coul) => {
    const noir = PL.rgb(0, 0, 0), gris = PL.rgb(0.5, 0.5, 0.5);
    const vise = coul ? PL.rgb(1, 0, 0) : noir, leurre = coul ? PL.rgb(0, 0, 1) : noir;
    const c = { PL, p, f, fb, noir, gris, vise, leurre };
    c.T = (t, x, y, s, gras = false, col = noir) => p.drawText(t, { x: x * MMp, y: y * MMp, size: s, font: gras ? fb : f, color: col });
    c.TD = (t, xd, y, s, gras = false) => { const ff = gras ? fb : f; c.T(t, xd - ff.widthOfTextAtSize(t, s) / MMp, y, s, gras); };     // aligné à droite
    c.TC = (t, xc, y, s, gras = false) => { const ff = gras ? fb : f; c.T(t, xc - ff.widthOfTextAtSize(t, s) / MMp / 2, y, s, gras); };
    c.cadre = (x, y, w, h, e = 0.8) => p.drawRectangle({ x: x * MMp, y: y * MMp, width: w * MMp, height: h * MMp, borderColor: noir, borderWidth: e });
    c.trait = (x1, y1, x2, y2, e = 0.6) => p.drawLine({ start: { x: x1 * MMp, y: y1 * MMp }, end: { x: x2 * MMp, y: y2 * MMp }, thickness: e, color: noir });
    // QR (qrcode-generator) de côté 'cote' mm, coin bas-gauche (x, y).
    c.qr = (txt, x, y, cote, col = vise) => { const q = qrcode(0, 'M'); q.addData(txt); q.make(); const n = q.getModuleCount(), m = cote / n * MMp;
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) p.drawRectangle({ x: x * MMp + k * m, y: y * MMp + (n - 1 - r) * m, width: m, height: m, color: col }); };
    // DataMatrix INVENTÉ (la forme seule : bordure en L pleine, piste d'horloge, données au hasard fixe).
    c.dm = (x, y, cote, n = 26, col = vise) => { let s = 11; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647); const m = cote / n * MMp;
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) { const on = k === 0 || r === n - 1 ? true : r === 0 ? k % 2 === 0 : k === n - 1 ? r % 2 === 1 : rnd() < 0.5;
        if (on) p.drawRectangle({ x: x * MMp + k * m, y: y * MMp + (n - 1 - r) * m, width: m, height: m, color: col }); } };
    // MaxiCode INVENTÉ : alvéoles en quinconce (elles s'emboîtent d'une rangée à l'autre, comme des hexagones) et l'œil de
    // bœuf (trois anneaux) au milieu.
    c.maxi = (x, y, cote, col = vise) => { let s = 5; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      const nx = 30, ny = 33, dx = cote / (nx + 0.5), dy = cote / ny, cx = x + cote / 2, cy = y + cote / 2;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const px = x + (i + (j % 2 ? 0.5 : 0) + 0.5) * dx, py = y + (j + 0.5) * dy;
        if (Math.hypot(px - cx, py - cy) < cote * 0.2) continue; if (rnd() < 0.5) p.drawRectangle({ x: (px - dx * 0.4) * MMp, y: (py - dy * 0.52) * MMp, width: dx * 0.8 * MMp, height: dy * 1.04 * MMp, color: col }); }
      for (const r of [0.17, 0.11, 0.05]) p.drawCircle({ x: cx * MMp, y: cy * MMp, size: r * cote * MMp, borderColor: col, borderWidth: cote * 0.022 * MMp }); };
    // Code-barres ITF (vraie forme, 'elementsITF' de bordereauExemple), barre fine X (mm), hauteur h (mm), centré sur xc.
    c.barres = (chiffres, xc, y, X, h, col = noir) => { const el = elementsITF(chiffres); let w = 20 * X; for (const e of el) w += e.large ? 2.5 * X : X;
      let cx = xc - w / 2 + 10 * X; for (const e of el) { const ww = e.large ? 2.5 * X : X; if (e.noir) p.drawRectangle({ x: cx * MMp, y: y * MMp, width: ww * MMp, height: h * MMp, color: col }); cx += ww; } return w; };
    c.adresse = (x, y, s = 9) => { c.T('Destinataire', x, y, 6.5, false, gris); ['Jeanne Exemple', '12 allée Imaginaire', '75000 PARIS', 'FRANCE'].forEach((l, i) => c.T(l, x, y - 4.2 - i * 4, s, i === 0)); };
    c.expediteur = (x, y) => { c.T('Expéditeur', x, y, 6, false, gris); ['Vendeur Exemple', '3 allée des Essais', '35000 RENNES'].forEach((l, i) => c.T(l, x, y - 3.2 - i * 3, 7)); };
    return c;
  };
  // ── Les étiquettes (repère mm, w × h) ──
  const E = {
    mondialrelay: { w: 100, h: 150, entete: 'Mondial Relay', d: (c) => {
      c.cadre(2, 2, 96, 146); c.T('Mondial Relay', 6, 138, 14, true); c.TD('Point Relais · 024R', 94, 139, 8, true);
      c.barres('12345678901234', 50, 112, 0.42, 16); c.TC('1234 5678 9012 34', 50, 107, 9);
      c.adresse(6, 99); c.qr('VRM-EXEMPLE-MR-12345678901234', 64, 36, 28);
      c.TD('Relais 024R · Tournée 7', 94, 70.5, 7);                 // un texte 6 mm au-dessus du QR : la place est serrée
      c.expediteur(6, 60); c.T('24R', 6, 8, 26, true); c.T('Poids 0,5 kg · Colis 1/1', 30, 10, 7, false, c.gris); } },
    vintedgo: { w: 100, h: 150, entete: 'Vinted Go', d: (c) => {
      c.cadre(2, 2, 96, 146); c.T('Vinted Go', 6, 138, 16, true); c.TD('Casier · VG12', 94, 139, 9, true); c.trait(4, 132, 96, 132);
      c.TC('Scanne ce code au casier', 50, 119, 9, true); c.qr('VRM-EXEMPLE-VG-1234-5678-90', 28, 64, 44);
      c.TC('VG-1234-5678-90', 50, 57, 10); c.adresse(6, 46); c.expediteur(60, 46); c.barres('12345678901234', 50, 8, 0.3, 9); } },
    chronopost: { w: 100, h: 150, entete: 'Chronopost', d: (c) => {
      c.cadre(2, 2, 96, 146); c.T('Chronopost', 6, 137.5, 13, true); c.TD('Shop2Shop', 94, 138, 8, true);
      c.dm(6, 106, 24); c.T('Relais : C0123', 36, 124, 8, true); c.T('Tournée 12 · 1/1', 36, 119, 7); c.T('Poids 0,50 kg', 36, 114.5, 7);
      c.barres('12345678901234', 50, 78, 0.38, 18); c.TC('XY 1234 5678 9FR', 50, 73, 9); c.adresse(6, 64, 10); c.expediteur(6, 26); } },
    colissimo: { w: 100, h: 150, entete: 'COLISSIMO', d: (c) => {
      c.cadre(2, 2, 96, 146); c.T('COLISSIMO', 6, 138, 15, true); c.TD('Point retrait', 94, 139, 8, true); c.trait(4, 132, 96, 132);
      c.T('Expédition', 6, 115, 8, true); c.dm(6, 84, 25); c.adresse(38, 106); c.expediteur(38, 80);
      c.barres('12345678901234', 50, 22, 0.45, 26); c.TC('6A 1234 5678 901', 50, 16, 10); } },
    relaiscolis: { w: 150, h: 100, entete: 'Relais Colis', d: (c) => {
      c.cadre(2, 2, 146, 96); c.T('Relais Colis', 6, 88, 14, true); c.TD('Relais · R12', 144, 89, 8, true); c.trait(4, 83, 146, 83);
      c.T('R12 · Tournée 4', 110, 65.5, 7, true); c.qr('VRM-EXEMPLE-RC-12345678901234', 110, 30, 30);
      c.adresse(6, 76, 10); c.expediteur(60, 76); c.barres('12345678901234', 52, 8, 0.4, 16); c.TC('1234 5678 9012 34', 52, 4.5, 8); } },
    ups: { w: 100, h: 150, entete: 'UPS STANDARD', d: (c) => {
      c.cadre(2, 2, 96, 146); c.T('UPS STANDARD', 6, 138, 14, true); c.TD('1 OF 1', 94, 139, 8, true); c.trait(4, 133, 96, 133);
      c.adresse(6, 127, 9); c.T('SHIP TO:', 60, 127, 7, true); c.trait(4, 100, 96, 100);
      c.maxi(8, 62, 30); c.T('FR 750 9-02', 46, 80, 16, true); c.trait(4, 56, 96, 56);
      c.barres('12345678901234', 50, 20, 0.4, 28); c.TC('1Z 999 AA1 01 2345 6784', 50, 14, 9); } },
    dpd: { w: 100, h: 150, entete: 'DPD Pickup', d: (c) => {
      c.cadre(2, 2, 96, 146); c.T('DPD Pickup', 6, 138, 15, true); c.TD('Predict', 94, 139, 8, true);
      c.adresse(6, 126, 9); c.expediteur(60, 126); c.T('Parcel 1/1 · 0,5 kg', 6, 88, 8, true);
      c.barres('12345678901234', 50, 54, 0.5, 26, c.vise); c.TC('0123 4567 8901 23', 50, 48, 10);
      c.qr('VRM-EXEMPLE-APPLI', 84, 8, 9, c.leurre); c.T('Suivez votre colis', 6, 10, 7); } },
    international: { w: 150, h: 100, entete: 'Hermes', d: (c) => {
      c.cadre(2, 2, 146, 96); c.T('Hermes', 6, 88, 14, true); c.TD('International', 144, 89, 8, true);
      c.T('IE · Tracked', 112, 69, 8, true); c.qr('VRM-EXEMPLE-HE-12345678901234', 112, 32, 30);
      c.adresse(6, 76, 10); c.expediteur(60, 76); c.barres('12345678901234', 52, 8, 0.4, 16); c.TC('H0012 3456 7890 1234', 52, 4.5, 8); } },
  };
  const notice = (c, x, y, w, h, titre) => { c.T(titre, x + 4, y + h - 8, 14, true);
    ['1. Imprime cette page.', '2. Découpe l’étiquette en suivant les pointillés.', '3. Colle-la sur le colis, bien à plat.', 'Fiche destinataire : à glisser dans le colis.', 'Dimensions max : 120 cm.'].forEach((l, i) => c.T(l, x + 4, y + h - 16 - i * 5.5, 10)); };
  const pointilles = (c, x1, y1, x2, y2) => { const n = Math.hypot(x2 - x1, y2 - y1); for (let t = 0; t < n; t += 3) { const a = t / n, b = Math.min(1, (t + 1.5) / n); c.trait(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b, 0.5); } };
  // L'étiquette 'nom' posée dans 'p' : origine (ox, oy) mm, tournée de 'a' degrés (sens trigonométrique).
  const poser = (c, nom, ox, oy, a = 0) => {
    const { PL, p } = c, r = a * Math.PI / 180, co = Math.cos(r), si = Math.sin(r);
    p.pushOperators(PL.pushGraphicsState(), PL.concatTransformationMatrix(co, si, -si, co, ox * MMp, oy * MMp));
    E[nom].d(c); p.pushOperators(PL.popGraphicsState());
  };
  const A4 = [595.28, 841.89];
  const mises = {
    mondialrelay: async (PL, d, mk) => { const p = d.addPage(A4), c = mk(p); notice(c, 10, 160, 190, 125, 'Comment utiliser ton étiquette'); pointilles(c, 5, 157, 205, 157); poser(c, 'mondialrelay', 55, 4); },
    leurre: async (PL, d, mk) => { const p = d.addPage(A4), c = mk(p); notice(c, 10, 160, 190, 125, 'Comment utiliser ton étiquette'); c.qr('VRM-EXEMPLE-PUB-TELECHARGE-L-APPLI', 150, 205, 34, c.leurre); c.T('Télécharge l’appli', 150, 200, 9, true); pointilles(c, 5, 157, 205, 157); poser(c, 'mondialrelay', 55, 4); },
    vintedgo: async (PL, d, mk) => { const p = d.addPage([100 * MMp, 150 * MMp]), c = mk(p); poser(c, 'vintedgo', 0, 0); },
    chronopost: async (PL, d, mk) => { const p = d.addPage([A4[1], A4[0]]), c = mk(p); notice(c, 8, 60, 160, 140, 'Fiche destinataire'); pointilles(c, 172, 5, 172, 205); poser(c, 'chronopost', 185, 30); },
    vestiaire: async (PL, d, mk) => { const p = d.addPage([A4[1], A4[0]]), c = mk(p); notice(c, 8, 60, 160, 140, 'Fiche destinataire'); pointilles(c, 172, 5, 172, 205); poser(c, 'chronopost', 185, 30); p.setRotation(PL.degrees(270)); },
    colissimo: async (PL, d, mk) => { const p = d.addPage([100 * MMp, 150 * MMp]), c = mk(p); poser(c, 'colissimo', 0, 0); },
    relaiscolis: async (PL, d, mk) => { const p = d.addPage([150 * MMp, 100 * MMp]), c = mk(p); poser(c, 'relaiscolis', 0, 0); },
    relaisa4: async (PL, d, mk) => { const p = d.addPage(A4), c = mk(p); notice(c, 10, 170, 190, 115, 'Comment utiliser ton étiquette'); pointilles(c, 5, 165, 205, 165); poser(c, 'relaiscolis', 155, 8, 90); },
    ups: async (PL, d, mk) => { const p = d.addPage([100 * MMp, 150 * MMp]), c = mk(p); poser(c, 'ups', 0, 0); },
    dpd: async (PL, d, mk) => { const p = d.addPage([100 * MMp, 150 * MMp]), c = mk(p); poser(c, 'dpd', 0, 0); },
    // « Bordereau-Vinted » : l'étiquette 150 × 100 est un Form XObject posé sur une A4.
    international: async (PL, d, mk, qrcode, coul) => {
      const e = await PL.PDFDocument.create(), f = await e.embedFont(PL.StandardFonts.Helvetica), fb = await e.embedFont(PL.StandardFonts.HelveticaBold);
      const pe = e.addPage([150 * MMp, 100 * MMp]); E.international.d(ctx(PL, qrcode, pe, f, fb, coul));
      const [emb] = await d.embedPdf(await e.save()); const p = d.addPage(A4), c = mk(p);
      p.drawPage(emb, { x: 30 * MMp, y: 180 * MMp }); notice(c, 10, 20, 190, 120, 'Comment utiliser ton étiquette'); },
  };
  const familles = { mondialrelay: 'mondialrelay', leurre: 'mondialrelay', vintedgo: 'vintedgo', chronopost: 'chronopost', vestiaire: 'vestiaire', colissimo: 'colissimo', relaiscolis: 'relaiscolis', relaisa4: 'relaiscolis', ups: 'ups', dpd: 'dpd', international: 'international' };
  const entetes = { leurre: 'Mondial Relay', relaisa4: 'Relais Colis', vestiaire: 'Chronopost' };
  return {
    noms: Object.keys(mises), famille: (n) => familles[n], entete: (n) => entetes[n] || E[n].entete,
    fabriquer: async (PL, qrcode, nom, coul) => {
      const d = await PL.PDFDocument.create(), f = await d.embedFont(PL.StandardFonts.Helvetica), fb = await d.embedFont(PL.StandardFonts.HelveticaBold);
      await mises[nom](PL, d, (p) => ctx(PL, qrcode, p, f, fb, coul), qrcode, coul); return d.save();
    },
  };
})();
// Imprime 'nom' sur 'support' comme « Imprimer » : 'sans' = sans aucun tampon (le témoin), 'coul' = codes en couleur
// (et l'encre « telle quelle » en thermique : le noir pur les noircirait). Rend { b64, page }.
const __SANS = { v: 1, a4: { num: false, titre: false, taille: false, mention: false }, th: { num: false, titre: false, taille: false, mention: false }, types: {}, formes: {} };
window.__imprimer = async ({ nom, support, sans = false, coul = false }) => {
  const PL = window.PDFLib, src = await PL.PDFDocument.load(await __fx.fabriquer(PL, window.qrcode, nom, coul));
  let out = await PL.PDFDocument.create();
  const th = support !== 'a4';
  __vrm.store({ vrm_impression: { format: '10x15', ...(coul ? { encre: 'tel' } : {}) }, ...(sans ? { vrm_tampons: __SANS } : {}) });
  const r = await __vrm.poserBordereau(PL, out, src, { numero: '124', title: 'Veste en jean bleue', pos: null, thermique: th, choisir: null,
    impression: { reg: null, famille: __fx.famille(nom), site: nom === 'vestiaire' ? 'vestiaire' : '', retour: false, taille: '42', photo: null, emplacement: '' } });
  let page = r.poses && r.poses[0] ? r.poses[0].page : 0;
  if (support === 'planche4') { const im = await __vrm.imposerPlanche(PL, out); out = im.doc; page = 0; }
  const pose = r.poses && r.poses[0] ? { mentionBoite: r.poses[0].mentionBoite, mode: r.poses[0].mode, codes: (r.poses[0].codes || []).map((q) => [q.qr ? 'qr' : 'code', Math.round(q.x), Math.round(q.y), Math.round(q.w), Math.round(q.h)]) } : null;
  return { b64: __b64(await out.save()), page, pose, isole: !!r.isole };
};
const __lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
// Le rendu d'une page à 'dpmm' px/mm : textes (origine, sens, taille, longueur — en points, page affichée), boîtes
// des pixels ROUGES (le code visé) et BLEUS (le leurre), et les pixels gardés pour comparer.
window.__lire = async (b64, n, dpmm, png) => {
  const doc = await pdfjsLib.getDocument({ data: __oct(b64), isEvalSupported: false }).promise;
  try {
    const pg = await doc.getPage(n + 1), v1 = pg.getViewport({ scale: 1 });
    const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
    const items = (await pg.getTextContent()).items.filter((it) => it.str).map((it) => { const m = mul(v1.transform, it.transform), t = Math.hypot(m[0], m[1]); return { s: it.str, x: m[4], y: m[5], dx: m[0] / t, dy: m[1] / t, t, l: it.width }; });
    const s = dpmm * 25.4 / 72, v = pg.getViewport({ scale: s });
    const c = document.createElement('canvas'); c.width = Math.ceil(v.width); c.height = Math.ceil(v.height);
    const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    await pg.render({ canvasContext: x, viewport: v }).promise;
    const d = x.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height;
    const boite = (test) => { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) { const i = (yy * W + xx) * 4; if (test(d[i], d[i + 1], d[i + 2])) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; } }
      return x1 < 0 ? null : { x: x0 / s, y: y0 / s, X: (x1 + 1) / s, Y: (y1 + 1) / s }; };
    const rouge = boite((r, g, b) => r > 170 && g < 110 && b < 110), bleu = boite((r, g, b) => b > 170 && r < 110 && g < 110);
    window.__px = window.__px || {}; const cle = Math.random().toString(36).slice(2); window.__px[cle] = { d, W, H, s };
    return { w: v1.width, h: v1.height, items, rouge, bleu, px: cle, png: png ? c.toDataURL('image/png') : null };
  } finally { await doc.destroy(); }
};
// Pixels d'encre (luminance < 200) d'un rendu dans une boîte (points).
window.__encre = (k, b) => { const A = window.__px[k], s = A.s; let n = 0;
  for (let y = Math.max(0, Math.floor(b.y * s)); y < Math.min(A.H, Math.ceil(b.Y * s)); y++) for (let x = Math.max(0, Math.floor(b.x * s)); x < Math.min(A.W, Math.ceil(b.X * s)); x++) if (__lum(A.d, (y * A.W + x) * 4) < 200) n++; return n; };
// Pixels qui diffèrent entre deux rendus de même taille dans une boîte (points).
window.__diff = (a, b, box) => { const A = window.__px[a], B = window.__px[b]; if (!A || !B || A.W !== B.W || A.H !== B.H) return -1; const s = A.s; let n = 0;
  for (let y = Math.max(0, Math.floor(box.y * s)); y < Math.min(A.H, Math.ceil(box.Y * s)); y++) for (let x = Math.max(0, Math.floor(box.x * s)); x < Math.min(A.W, Math.ceil(box.X * s)); x++) { const i = (y * A.W + x) * 4; if (Math.abs(__lum(A.d, i) - __lum(B.d, i)) > 60) n++; } return n; };
// Une capture : le rendu, la boîte du code (rouge) et celle de la mention (vert) dessinées par-dessus.
window.__capture = async (png, cadres) => { const im = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = png; });
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  for (const f of cadres) { x.strokeStyle = f.col; x.lineWidth = 3; x.strokeRect(f.x * f.s, f.y * f.s, (f.X - f.x) * f.s, (f.Y - f.y) * f.s); } return c.toDataURL('image/png'); };
window.__planche = async (pngs, titre) => { const imgs = await Promise.all(pngs.map((p) => new Promise((ok) => { const im = new Image(); im.onload = () => ok({ im, nom: p.nom }); im.src = p.png; })));
  const L = 300, col = 4, h = Math.max(...imgs.map((x) => x.im.height * L / x.im.width)), rows = Math.ceil(imgs.length / col);
  const c = document.createElement('canvas'); c.width = col * (L + 16) + 16; c.height = rows * (h + 40) + 50; const x = c.getContext('2d'); x.fillStyle = '#eee'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#000'; x.font = 'bold 18px sans-serif'; x.fillText(titre, 16, 30);
  imgs.forEach((o, i) => { const X = 16 + (i % col) * (L + 16), Y = 50 + Math.floor(i / col) * (h + 40); const hh = o.im.height * L / o.im.width; x.drawImage(o.im, X, Y, L, hh); x.strokeStyle = '#999'; x.strokeRect(X, Y, L, hh); x.fillStyle = '#000'; x.font = '14px sans-serif'; x.fillText(o.nom, X, Y + hh + 18); });
  return c.toDataURL('image/png'); };
`;

const MM = 72 / 25.4;
const SUPPORTS = ['a4', '10x15', 'planche4'];
// Le repère de l'étiquette : (x, y) affiché → (u le long du texte, v vers le BAS de l'étiquette), selon le sens a
// (0 · 90 · 180 · 270, horaire) de son en-tête.
const repere = (a, W, H) => (a === 90 ? (x, y) => [y, W - x] : a === 180 ? (x, y) => [W - x, H - y] : a === 270 ? (x, y) => [H - y, x] : (x, y) => [x, y]);
const boiteR = (f, b) => { const p = [f(b.x, b.y), f(b.X, b.Y)]; return { x: Math.min(p[0][0], p[1][0]), y: Math.min(p[0][1], p[1][1]), X: Math.max(p[0][0], p[1][0]), Y: Math.max(p[0][1], p[1][1]) }; };
const sensDe = (it) => ((Math.round(Math.atan2(it.dy, it.dx) * 180 / Math.PI / 90) * 90) % 360 + 360) % 360;
// La boîte des LETTRES d'une ligne de texte (points, page affichée) : de la ligne de base, 0,8 T au-dessus (accents)
// et 0,22 T dessous (jambage du « p »), le long de son sens.
const lettres = (it) => { const nx = -it.dy, ny = it.dx;   // la normale « vers le bas » du texte
  const pts = [[0, -0.8], [0, 0.22], [1, -0.8], [1, 0.22]].map(([a, b]) => [it.x + it.dx * it.l * a + nx * it.t * b, it.y + it.dy * it.l * a + ny * it.t * b]);
  return { x: Math.min(...pts.map((p) => p[0])), y: Math.min(...pts.map((p) => p[1])), X: Math.max(...pts.map((p) => p[0])), Y: Math.max(...pts.map((p) => p[1])) }; };
const elargi = (b, m) => ({ x: b.x - m, y: b.y - m, X: b.X + m, Y: b.Y + m });
const bilan = { juste: 0, faux: 0 };

async function cas(pg, nom, support, vignettes) {
  const t = `${nom} · ${support}`;
  let T, S, Sc;
  try {
    const tm = await pg.evaluate((x) => __imprimer(x), { nom, support, sans: true, coul: true });
    const st = await pg.evaluate((x) => __imprimer(x), { nom, support });
    const sc = await pg.evaluate((x) => __imprimer(x), { nom, support, coul: true });
    T = await pg.evaluate(([b, k]) => __lire(b, k, 8, false), [tm.b64, tm.page]);
    S = await pg.evaluate(([b, k, p]) => __lire(b, k, 8, p), [st.b64, st.page, true]);
    Sc = await pg.evaluate(([b, k]) => __lire(b, k, 8, false), [sc.b64, sc.page]);
    S.pose = st.pose;
  } catch (e) { dit(false, `${t} : le bordereau sort`, String(e.message || e).split('\n')[0].slice(0, 200)); bilan.faux++; return; }
  if (process.env.BANC_DIAG) console.log('    (diag) ' + t + ' ' + JSON.stringify(S.pose));
  const code = T.rouge, ent = T.items.find((i) => i.s.trim() === pg.__entetes[nom]);
  if (!code || !ent) { dit(false, `${t} : le témoin se mesure (code rouge, en-tête)`, `code ${!!code} · en-tête ${!!ent}`); bilan.faux++; return; }
  const a = sensDe(ent), F = repere(a, T.w, T.h), qf = boiteR(F, code);
  const m = S.items.find((i) => /Créé par vrm\.center/.test(i.s)), mc = Sc.items.find((i) => /Créé par vrm\.center/.test(i.s));
  let juste = true; const d = (c, msg, det) => { if (!c) juste = false; dit(c, `${t} : ${msg}`, det); };
  const cadres = [{ ...code, col: '#e00', s: 8 * 25.4 / 72 }];
  d(!!m, '1. « Créé par vrm.center » est écrite', S.pose ? `via=${S.pose.mentionBoite ? S.pose.mentionBoite.via : 'rien'}` : '');
  if (m) {
    const lb = lettres(m), lf = boiteR(F, lb); cadres.push({ ...lb, col: '#0a0', s: 8 * 25.4 / 72 });
    d(sensDe(m) === a, `1. écrite dans le sens de l'étiquette (${sensDe(m)}° ; étiquette ${a}°)`);
    const ec = Math.abs((lf.x + lf.X) / 2 - (qf.x + qf.X) / 2) / MM;
    d(ec <= 1, `2. centrée sur l'axe du code (écart ${ec.toFixed(2)} mm ≤ 1 mm)`);
    const gap = (qf.y - lf.Y) / MM;
    d(gap >= 2 && gap <= 4, `3. son bas ${gap.toFixed(2)} mm ${gap >= 0 ? 'au-dessus du' : 'SOUS le haut du'} code (2 à 4 mm au-dessus)`);
    if (mc) {
      const lc = lettres(mc), n = await pg.evaluate(([k, b]) => __encre(k, b), [T.px, elargi(lc, 0.25 * MM)]);
      d(n === 0, `4. elle ne touche aucune encre de l'étiquette (pixels d'encre sous ses lettres : ${n})`);
      const memePlace = Math.abs(lc.x - lb.x) < 0.6 * MM && Math.abs(lc.y - lb.y) < 0.6 * MM;
      d(memePlace, `7. la même place que sur le témoin en couleur`, `${(lb.x / MM).toFixed(1)},${(lb.y / MM).toFixed(1)} / ${(lc.x / MM).toFixed(1)},${(lc.y / MM).toFixed(1)} mm`);
    } else d(false, '4. la mention du témoin en couleur se lit');
    const bord = 1.5 * MM;
    d(lb.x >= bord && lb.y >= bord && lb.X <= S.w - bord && lb.Y <= S.h - bord, '5. dans la page (1,5 mm du bord au moins)');
    // (4 par page : la page thermique est réduite d'au plus 15 % — `ECHELLE_MIN` de planche4.js — la police aussi.)
    const tMin = support === 'planche4' ? 4.5 * 0.85 : 4.4;
    d(m.t >= tMin && m.t <= 7.6, `5. lisible et petite (${m.t.toFixed(1)} pt ≥ ${tMin.toFixed(1)})`);
  }
  const px = await pg.evaluate(([a1, b1, bx]) => __diff(a1, b1, bx), [Sc.px, T.px, elargi(code, 2 * MM)]);
  d(px === 0, `6. le code n'a aucun pixel changé (boîte + 2 mm : ${px})`);
  if (T.bleu && m) { const lb = lettres(m); d(!(lb.X > T.bleu.x - 10 * MM && lb.x < T.bleu.X + 10 * MM && lb.Y > T.bleu.y - 10 * MM && lb.y < T.bleu.Y + 10 * MM), '8. le QR publicitaire n’est pas pris pour le code du transporteur'); }
  if (juste) bilan.juste++; else bilan.faux++;
  const png = await pg.evaluate(([p, c]) => __capture(p, c), [S.png, cadres]);
  vignettes.push({ nom: `${nom}${juste ? '' : ' ✗'}`, png });
  if (CAPT) fs.writeFileSync(path.join(CAPT, `${nom}-${support}.png`), Buffer.from(png.split(',')[1], 'base64'));
}

(async () => {
  await new Promise((okk) => srv.listen(PORT, okk));
  const nav = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const ctx = await nav.newContext({ locale: 'fr-FR' }); const pg = await ctx.newPage();
  if (process.env.BANC_DIAG) { pg.on('console', (m) => { if (/DIAGM/.test(m.text())) console.log('    ' + m.text()); }); }
  pg.on('pageerror', (e) => console.log('   (page) ' + String(e.message).slice(0, 200)));
  await pg.goto(`http://localhost:${PORT}/`);
  for (const s of ['/pdf-lib.js', '/qrcode.js']) await pg.addScriptTag({ url: s });
  await pg.addScriptTag({ type: 'module', content: `import * as m from '/pdfjs/pdf.min.mjs'; m.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs'; window.pdfjsLib = m;` });
  await pg.waitForFunction(() => window.pdfjsLib && window.qrcode, null, { timeout: 15000 });
  await pg.addScriptTag({ content: SCRIPT }); await pg.addScriptTag({ content: DANS_PAGE });
  if (process.env.BANC_DIAG) await pg.evaluate(() => { globalThis.__diagM = 1; });
  const noms = await pg.evaluate(() => __fx.noms);
  pg.__entetes = await pg.evaluate(() => Object.fromEntries(__fx.noms.map((n) => [n, __fx.entete(n)])));
  if (CAPT) fs.mkdirSync(CAPT, { recursive: true });
  for (const sup of SUPPORTS) {
    if (SEUL && !SEUL.split(',').includes(sup)) continue;
    console.log(`\n── ${sup}`); const vig = [];
    for (const nom of noms) { if (SEUL_FX && !SEUL_FX.split(',').includes(nom)) continue; await cas(pg, nom, sup, vig); }
    if (CAPT && vig.length) { const p = await pg.evaluate(([v, ti]) => __planche(v, ti), [vig, `Créé par vrm.center · ${sup} (rouge : le code ; vert : la mention)`]); fs.writeFileSync(path.join(CAPT, `planche-${sup}.png`), Buffer.from(p.split(',')[1], 'base64')); }
  }
  await nav.close(); srv.close();
  console.log(`\n   bordereaux justes : ${bilan.juste} · faux : ${bilan.faux}`);
  console.log(`${ko ? '❌' : '✅'} tampon-qr : ${ok} verts, ${ko} rouges${MUT ? ` (mutation ${MUT})` : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e.stack || e)); process.exit(1); });
