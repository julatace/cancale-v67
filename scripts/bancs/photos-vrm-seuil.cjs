// ════════════════════════════════════════════════════════════════════════════
//  LE SEUIL « SÛR » D'UNE PHOTO FABRIQUÉE PAR VRM (15 nov., lot numeros-masquees, point 3)
//  Julien : « quand VRM reconnaît la photo qu'elle a modifiée, elle attribue le numéro ».
//  Une photo que VRM a PRODUITE pour un N° (src/republierReglages.js, JPEG 92 %) puis
//  republiée dans l'app Vinted : Vinted la recompresse et la redimensionne (grande image
//  ~800 px, JPEG ~80 % ; miniature ~310 px, celle que l'extension lit quand Vinted la donne).
//  On MESURE, sur le jeu INVENTÉ du banc `photos-comptes-seuil.cjs` (aucune photo réelle),
//  la distance entre l'empreinte de la photo produite et celle de ce que Vinted en rend,
//  face aux autres photos de la MÊME paire et aux autres paires. Le seuil SÛR
//  (`SEUIL_PHOTO_VRM`, src/republieTelephone.js) doit séparer les deux avec une marge :
//   V1  photo VRM passée par Vinted (f800 q80, miniature q75, f800 q60, moitié q70) ⇒ ≤ seuil sûr
//   V2  autre photo de la même paire ⇒ > 2 × seuil sûr (marge)
//   V3  autre paire ⇒ > 2 × seuil sûr
//  `--mutation=seuil` (seuil sûr 16) doit rendre V2 rouge.
//  Lancer : node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/photos-vrm-seuil.cjs
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const RACINE = (() => { const i = process.argv.indexOf('--src'); return i > 0 ? path.resolve(process.argv[i + 1]) : path.join(__dirname, '..', '..'); })();
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
let SRC = fs.readFileSync(path.join(RACINE, 'src', 'photoEmpreinte.js'), 'utf8').replace(/^export /gm, '');
const SURE = (() => { const m = /export const SEUIL_PHOTO_VRM = (\d+)/.exec(fs.readFileSync(path.join(RACINE, 'src', 'republieTelephone.js'), 'utf8')); return m ? Number(m[1]) : NaN; })();
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
  const vrm = await jpeg(c, 0.92);                       // ce que VRM produit (usePhotosReglees)
  const W = c.width, H = c.height, f = 800 / Math.max(W, H);
  return {
    vrm,
    f800q80: await jpeg(versCanvas(vrm, Math.round(W * f), Math.round(H * f)), 0.8),
    mini310: await jpeg(versCanvas(vrm, 310, Math.round(H * 310 / W)), 0.75),
    f800q60: await jpeg(versCanvas(vrm, Math.round(W * f), Math.round(H * f)), 0.6),
    moitieq70: await jpeg(versCanvas(vrm, W / 2, H / 2), 0.7),
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
      const h0 = await empreinte(vars.vrm);
      toutes.push({ k, v, h: h0 });
      for (const [nom, img] of Object.entries(vars)) { if (nom === 'vrm') continue; const h = await empreinte(img); out.meme.push({ k, v, nom, d: distanceEmpreintes(h0, h) }); }
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
    const seuil = MUT === 'seuil' ? 16 : SURE;
    const maxMeme = Math.max(...m.meme.map((x) => x.d));
    const minPaire = Math.min(...m.memePaire.map((x) => x.d));
    const minAutres = Math.min(...m.autres.map((x) => x.d));
    const parNom = {};
    for (const x of m.meme) parNom[x.nom] = Math.max(parNom[x.nom] || 0, x.d);
    console.log(`  photo VRM passée par Vinted (${m.meme.length}) : max ${maxMeme} — ${Object.entries(parNom).map(([k, v]) => k + ' ' + v).join(', ')}`);
    console.log(`  même paire, autre photo (${m.memePaire.length}) : min ${minPaire}`);
    console.log(`  paires différentes (${m.autres.length}) : min ${minAutres}`);
    console.log(`  seuil sûr ${seuil}`);
    dit(Number.isFinite(seuil), 'le seuil sûr est lu dans src/republieTelephone.js', String(seuil));
    dit(m.meme.every((x) => x.d != null && x.d <= seuil), 'V1 · photo VRM recompressée / redimensionnée par Vinted ⇒ ≤ seuil sûr', m.meme.filter((x) => !(x.d <= seuil)).slice(0, 5).map((x) => `${x.k}/${x.v} ${x.nom} ${x.d}`).join(', '));
    dit(m.memePaire.every((x) => x.d > 2 * seuil), 'V2 · autre photo de la MÊME paire ⇒ > 2 × seuil sûr', m.memePaire.filter((x) => !(x.d > 2 * seuil)).slice(0, 5).map((x) => `${x.a}~${x.b} ${x.d}`).join(', '));
    dit(m.autres.every((x) => x.d > 2 * seuil), 'V3 · autre paire ⇒ > 2 × seuil sûr', m.autres.filter((x) => !(x.d > 2 * seuil)).slice(0, 5).map((x) => `${x.a}~${x.b} ${x.d}`).join(', '));
  } finally { await nav.close(); }
  console.log(ko ? `\n❌ ${ko} rouge(s)` : '\n✅ seuil sûr mesuré : tout vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
