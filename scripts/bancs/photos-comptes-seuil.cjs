// ════════════════════════════════════════════════════════════════════════════
//  LE SEUIL DE « MÊME PHOTO » (11 nov., lot photos-comptes) — MESURÉ, pas deviné.
//
//  Jeu INVENTÉ, dessiné par le banc dans Chromium (aucune photo réelle, le dépôt est
//  public) : 8 « paires » (forme, couleurs, semelle, lacets, logo), chacune
//  photographiée 6 fois DIFFÉREMMENT (cadrage, échelle, inclinaison, fond, lumière,
//  miroir). Chaque photo est ensuite transformée comme le ferait une seconde
//  publication : JPEG 90/50/30 %, réduite de moitié, agrandie ×1,5, plus claire /
//  plus sombre de 15 %, contraste, recadrée de 3 % et 6 % (tout autour) ou de 5 %
//  d'un côté, et une combinaison (recadrage 4 % + JPEG 60 % + moitié).
//  L'empreinte est calculée comme dans l'extension et la page : image dessinée en
//  64 × 64 (`COTE_EMPREINTE`), pixels passés à `empreinteDepuisPixels` (le VRAI
//  src/photoEmpreinte.js, chargé dans la page).
//   S1  même photo transformée ⇒ distance ≤ SEUIL_PHOTO (toutes, aucune exception)
//   S2  deux photos DIFFÉRENTES de la même paire ⇒ distance > SEUIL_PHOTO (toutes)
//   S3  deux paires différentes ⇒ distance > SEUIL_PHOTO (toutes)
//   S4  une image uniforme ⇒ null (« pas su »), jamais une empreinte
//  Distance = dHash + pHash / 2, chacune au meilleur des trois recadrages (src/photoEmpreinte.js).
//  Il imprime la distribution (max « même », min « différente ») : c'est elle qui a
//  fixé le seuil. `--mutation=seuil` (seuil 30) doit rendre S2/S3 rouges, `--mutation=sansrecadrage`
//  (une seule empreinte, sans recadrage) doit rendre S1 rouge.
//  Lancer : node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/photos-comptes-seuil.cjs
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const RACINE = (() => { const i = process.argv.indexOf('--src'); return i > 0 ? path.resolve(process.argv[i + 1]) : path.join(__dirname, '..', '..'); })();
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
let SRC = fs.readFileSync(path.join(RACINE, 'src', 'photoEmpreinte.js'), 'utf8').replace(/^export /gm, '');
if (MUT === 'sansrecadrage') SRC = SRC.replace('const RECADRAGES = [0, 0.04, 0.08];', 'const RECADRAGES = [0, 0, 0];');
let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };

const PAGE = `
<!doctype html><meta charset="utf-8"><body><script>
${SRC}
window.__regle = { empreinteDepuisPixels, distanceEmpreintes, SEUIL_PHOTO, COTE_EMPREINTE };
function alea(s) { return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
function paire(k) {
  const r = alea(1000 + k * 7919);
  const teinte = Math.floor(r() * 360), l = 25 + r() * 50;
  return { haut: 'hsl(' + teinte + ',' + (20 + r() * 60) + '%,' + l + '%)', panneau: 'hsl(' + teinte + ',' + (20 + r() * 50) + '%,' + Math.max(10, Math.min(90, l + (r() - 0.5) * 50)) + '%)',
    accent: 'hsl(' + ((teinte + 120 + r() * 120) % 360) + ',70%,' + (30 + r() * 40) + '%)',
    semelle: r() < 0.5 ? '#f2f0ea' : 'hsl(' + Math.floor(r() * 360) + ',20%,' + (15 + r() * 30) + '%)',
    bout: 0.25 + r() * 0.2, haute: r() < 0.4 ? 70 + r() * 60 : 0, lacets: 4 + Math.floor(r() * 4), logo: r(), trous: r() < 0.5, texte: ['RUN', 'AIR', 'PRO', 'OG', '90', 'LOW'][k % 6], crans: 10 + Math.floor(r() * 14) };
}
function fond(x, vue, r) {
  const g = x.createLinearGradient(0, 0, vue.fondVertical ? 0 : 600, 800);
  g.addColorStop(0, vue.fond1); g.addColorStop(1, vue.fond2);
  x.fillStyle = g; x.fillRect(0, 0, 600, 800);
  x.fillStyle = vue.sol; x.fillRect(0, vue.horizon, 600, 800 - vue.horizon);
  if (vue.motif === 'planches') { for (let y = vue.horizon; y < 800; y += 34 + r() * 20) { x.fillStyle = 'rgba(0,0,0,' + (0.05 + r() * 0.12) + ')'; x.fillRect(0, y, 600, 3); for (let i = 0; i < 8; i++) { x.strokeStyle = 'rgba(60,30,10,' + r() * 0.12 + ')'; x.lineWidth = 1 + r() * 2; x.beginPath(); x.moveTo(0, y + r() * 30); x.bezierCurveTo(200, y + r() * 30, 400, y + r() * 30, 600, y + r() * 30); x.stroke(); } } }
  if (vue.motif === 'carreaux') { x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 3; for (let i = 0; i < 600; i += 90) { x.beginPath(); x.moveTo(i + vue.dx * 0.3, vue.horizon); x.lineTo(i * 1.4 - 120, 800); x.stroke(); } for (let y = vue.horizon; y < 800; y += 60) { x.beginPath(); x.moveTo(0, y); x.lineTo(600, y); x.stroke(); } }
  for (let i = 0; i < 900; i++) { x.fillStyle = 'rgba(' + (r() < .5 ? '0,0,0' : '255,255,255') + ',' + (r() * 0.08) + ')'; x.fillRect(r() * 600, r() * 800, 1 + r() * 8, 1 + r() * 8); }
  if (vue.objet) { x.fillStyle = vue.objet; x.fillRect(vue.ox, vue.oy, 90 + r() * 120, 60 + r() * 140); }
}
function chaussure(x, p, r) {
  // L'ombre
  x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(0, 105, 260, 30, 0, 0, Math.PI * 2); x.fill();
  // La semelle, ses crans, la bande
  x.fillStyle = p.semelle; x.beginPath(); x.moveTo(-260, 50); x.quadraticCurveTo(-285, 105, -225, 108); x.lineTo(245, 108); x.quadraticCurveTo(292, 100, 268, 40); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 3; for (let i = 0; i < p.crans; i++) { const xx = -240 + i * (490 / p.crans); x.beginPath(); x.moveTo(xx, 92); x.lineTo(xx + 6, 108); x.stroke(); }
  x.fillStyle = p.accent; x.fillRect(-250, 70, 505, 7);
  // La tige
  x.fillStyle = p.haut; x.beginPath(); x.moveTo(-252, 58); x.quadraticCurveTo(-262 + 520 * p.bout, -35, 40, -80 - p.haute);
  x.quadraticCurveTo(140, -165 - p.haute, 228, -70 - p.haute * 0.4); x.quadraticCurveTo(286, 0, 266, 52); x.closePath(); x.fill();
  // Les panneaux (bout, talon) et les coutures
  x.fillStyle = p.panneau; x.beginPath(); x.moveTo(-252, 58); x.quadraticCurveTo(-240, -10, -120, -30); x.quadraticCurveTo(-90, 20, -60, 58); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(266, 52); x.quadraticCurveTo(280, -20, 228, -70 - p.haute * 0.4); x.quadraticCurveTo(170, -10, 180, 58); x.closePath(); x.fill();
  x.setLineDash([6, 6]); x.strokeStyle = 'rgba(255,255,255,0.6)'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(-240, 50); x.quadraticCurveTo(-228, -4, -122, -22); x.stroke();
  x.beginPath(); x.moveTo(175, 50); x.quadraticCurveTo(170, -6, 222, -60 - p.haute * 0.4); x.stroke(); x.setLineDash([]);
  // Les perforations
  if (p.trous) { x.fillStyle = 'rgba(0,0,0,0.45)'; for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { x.beginPath(); x.arc(-205 + i * 18, 18 - j * 14 + i * 2, 3, 0, Math.PI * 2); x.fill(); } }
  // Le logo
  x.strokeStyle = p.accent; x.lineWidth = 18; x.lineCap = 'round'; x.beginPath(); x.moveTo(-150, 34 - 40 * p.logo); x.quadraticCurveTo(10, 66, 180, -34 + 30 * p.logo); x.stroke();
  // Les œillets et les lacets
  for (let i = 0; i < p.lacets; i++) { const lx = 30 + i * 24, ly = -64 - i * 10 - p.haute * (i / p.lacets);
    x.fillStyle = '#111'; x.beginPath(); x.arc(lx, ly, 4, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#fafafa'; x.lineWidth = 6; x.beginPath(); x.moveTo(lx - 6, ly - 4); x.lineTo(lx + 22, ly + 14); x.stroke(); }
  // L'étiquette du talon
  x.fillStyle = '#fff'; x.font = 'bold 22px sans-serif'; x.fillText(p.texte, 196, 10);
}
function photo(p, vue) {
  const c = document.createElement('canvas'); c.width = 600; c.height = 800;
  const x = c.getContext('2d');
  const r = alea(vue.graine);
  fond(x, vue, r);
  x.save();
  x.translate(300 + vue.dx, 470 + vue.dy); x.rotate(vue.angle); x.scale(vue.echelle * (vue.miroir ? -1 : 1), vue.echelle * vue.aplati);
  chaussure(x, p, r);
  if (vue.deux) { x.translate(40, 150); x.scale(0.95, 0.95); chaussure(x, p, r); }
  x.restore();
  // La lumière
  const lg = x.createRadialGradient(vue.lx, vue.ly, 10, vue.lx, vue.ly, 520);
  lg.addColorStop(0, 'rgba(255,240,220,' + vue.lumiere + ')'); lg.addColorStop(1, 'rgba(0,0,0,' + (vue.lumiere * 0.6) + ')');
  x.fillStyle = lg; x.fillRect(0, 0, 600, 800);
  return c;
}
function vueDe(k, v) {
  const r = alea(5000 + k * 131 + v * 977);
  const fonds = [['#e9e4dc', '#cfc7bb', '#b9ae9c'], ['#d8e2ea', '#aebccb', '#8a96a3'], ['#f5f5f5', '#e0e0e0', '#c9c9c9'], ['#3b3b3b', '#2a2a2a', '#5a4b3c'], ['#efe1c8', '#d9c29b', '#a98b5e'], ['#e3eedd', '#c4d6b9', '#93a888']];
  const f = fonds[Math.floor(r() * fonds.length)];
  return { graine: 9000 + k * 31 + v * 7, fond1: f[0], fond2: f[1], sol: f[2], fondVertical: r() < 0.5, horizon: 300 + Math.floor(r() * 320),
    motif: ['planches', 'carreaux', 'uni'][Math.floor(r() * 3)], objet: r() < 0.4 ? 'hsl(' + Math.floor(r() * 360) + ',30%,50%)' : '', ox: r() * 500, oy: r() * 300,
    dx: (r() - 0.5) * 140, dy: (r() - 0.5) * 220, angle: (r() - 0.5) * 0.6, echelle: 0.95 + r() * 0.4, aplati: 0.9 + r() * 0.5, miroir: r() < 0.3, deux: r() < 0.3,
    lumiere: r() * 0.3, lx: r() * 600, ly: r() * 800 };
}
async function charge(src) { const i = new Image(); i.src = src; await i.decode(); return i; }
function versCanvas(img, w, h, sx = 0, sy = 0, sw = img.width, sh = img.height, filtre = '') {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; if (filtre) x.filter = filtre;
  x.drawImage(img, sx, sy, sw, sh, 0, 0, w, h); return c;
}
async function jpeg(c, q) { return charge(c.toDataURL('image/jpeg', q)); }
async function empreinte(img) {
  const n = COTE_EMPREINTE; const c = document.createElement('canvas'); c.width = n; c.height = n;
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, n, n);
  return empreinteDepuisPixels(x.getImageData(0, 0, n, n).data, n, n);
}
async function variantes(c) {
  const base = await jpeg(c, 0.92);
  const W = c.width, H = c.height;
  const crop = (f) => versCanvas(base, Math.round(W * (1 - 2 * f)), Math.round(H * (1 - 2 * f)), W * f, H * f, W * (1 - 2 * f), H * (1 - 2 * f));
  return {
    jpeg90: base, jpeg50: await jpeg(c, 0.5), jpeg30: await jpeg(c, 0.3),
    moitie: await jpeg(versCanvas(base, W / 2, H / 2), 0.8), agrandie: await jpeg(versCanvas(base, W * 1.5, H * 1.5), 0.8),
    claire: await jpeg(versCanvas(base, W, H, 0, 0, W, H, 'brightness(1.15)'), 0.85), sombre: await jpeg(versCanvas(base, W, H, 0, 0, W, H, 'brightness(0.85)'), 0.85),
    contraste: await jpeg(versCanvas(base, W, H, 0, 0, W, H, 'contrast(1.15) saturate(1.1)'), 0.85),
    recadre3: await jpeg(crop(0.03), 0.85), recadre6: await jpeg(crop(0.06), 0.85),
    cote5: await jpeg(versCanvas(base, Math.round(W * 0.95), H, W * 0.05, 0, W * 0.95, H), 0.85),
    combo: await jpeg(versCanvas(await jpeg(crop(0.04), 0.6), W / 2, H / 2), 0.7),
  };
}
window.__mesure = async (nPaires, nVues) => {
  const out = { meme: [], memePaire: [], autres: [], originales: [] };
  const toutes = [];
  for (let k = 0; k < nPaires; k++) {
    const p = paire(k);
    for (let v = 0; v < nVues; v++) {
      const c = photo(p, vueDe(k, v));
      const vars = await variantes(c);
      const h0 = await empreinte(vars.jpeg90);
      toutes.push({ k, v, h: h0 });
      for (const [nom, img] of Object.entries(vars)) { if (nom === 'jpeg90') continue; const h = await empreinte(img); out.meme.push({ k, v, nom, d: distanceEmpreintes(h0, h) }); }
    }
  }
  for (let i = 0; i < toutes.length; i++) for (let j = i + 1; j < toutes.length; j++) {
    const a = toutes[i], b = toutes[j]; const d = distanceEmpreintes(a.h, b.h);
    (a.k === b.k ? out.memePaire : out.autres).push({ a: a.k + '/' + a.v, b: b.k + '/' + b.v, d });
  }
  const u = document.createElement('canvas'); u.width = 64; u.height = 64; const ux = u.getContext('2d'); ux.fillStyle = '#888'; ux.fillRect(0, 0, 64, 64);
  out.uniforme = empreinteDepuisPixels(ux.getImageData(0, 0, 64, 64).data, 64, 64);
  out.seuil = SEUIL_PHOTO;
  return out;
};
</script>`;

(async () => {
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    const page = await nav.newPage();
    await page.route('**/*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: PAGE }));
    await page.goto('http://localhost/seuil');
    // `SHOW=0/1,3/2 SHOWDIR=dossier` : écrit ces photos du jeu (pour les regarder).
    if (process.env.SHOW) { for (const kv of process.env.SHOW.split(',')) { const [k, v] = kv.split('/').map(Number); const u = await page.evaluate(([k, v]) => photo(paire(k), vueDe(k, v)).toDataURL('image/png'), [k, v]); fs.writeFileSync(path.join(process.env.SHOWDIR, `img-${k}-${v}.png`), Buffer.from(u.split(',')[1], 'base64')); } process.exit(0); }
    const m = await page.evaluate(() => window.__mesure(8, 6));
    const seuil = MUT === 'seuil' ? 30 : m.seuil;
    const maxMeme = Math.max(...m.meme.map((x) => x.d));
    const minPaire = Math.min(...m.memePaire.map((x) => x.d));
    const minAutres = Math.min(...m.autres.map((x) => x.d));
    const parNom = {};
    for (const x of m.meme) parNom[x.nom] = Math.max(parNom[x.nom] || 0, x.d);
    console.log(`  même photo transformée (${m.meme.length}) : max ${maxMeme} — par transformation : ${Object.entries(parNom).map(([k, v]) => k + ' ' + v).join(', ')}`);
    const hist = (l) => { const h = {}; for (const x of l) { const b = Math.floor(x.d / 4) * 4; h[b] = (h[b] || 0) + 1; } return Object.entries(h).sort((a, b) => a[0] - b[0]).map(([b, n]) => `${b}-${+b + 3}:${n}`).join(' '); };
    console.log(`  même paire, autre photo (${m.memePaire.length}) : min ${minPaire} — ${hist(m.memePaire)}`);
    console.log(`  paires différentes (${m.autres.length}) : min ${minAutres} — ${hist(m.autres)}`);
    console.log(`  seuil ${seuil}`);
    dit(m.meme.every((x) => x.d != null && x.d <= seuil), 'S1 · même photo recompressée / redimensionnée / éclaircie / recadrée ⇒ proche (≤ seuil)', m.meme.filter((x) => !(x.d <= seuil)).slice(0, 5).map((x) => `${x.k}/${x.v} ${x.nom} ${x.d}`).join(', '));
    dit(m.memePaire.every((x) => x.d > seuil), 'S2 · deux photos différentes de la MÊME paire ⇒ loin (> seuil)', m.memePaire.filter((x) => !(x.d > seuil)).slice(0, 5).map((x) => `${x.a}~${x.b} ${x.d}`).join(', '));
    dit(m.autres.every((x) => x.d > seuil), 'S3 · deux paires différentes ⇒ loin (> seuil)', m.autres.filter((x) => !(x.d > seuil)).slice(0, 5).map((x) => `${x.a}~${x.b} ${x.d}`).join(', '));
    dit(m.uniforme === null, 'S4 · une image uniforme ⇒ null (pas su), jamais une empreinte', String(m.uniforme));
  } finally { await nav.close(); }
  console.log(ko ? `\n❌ ${ko} rouge(s)` : '\n✅ seuil mesuré : tout vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
