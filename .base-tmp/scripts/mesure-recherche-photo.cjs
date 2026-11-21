// ═══════════════════════════════════════════════════════════════════════════
// MESURE : RECHERCHE PAR PHOTO SUR DES PAIRES INVENTÉES EN 3D (6 nov.)
//        (node scripts/mesure-recherche-photo.cjs [--json])
// ═══════════════════════════════════════════════════════════════════════════
// Le cas réel : la photo de l'ANNONCE (de profil, fond clair) et la photo prise
// À LA MAIN avec le téléphone (autre angle, autre fond, autre lumière, un bout
// de main devant). Aucune photo réelle dans le dépôt (public) : des « paires »
// INVENTÉES, dessinées en 3D (three.js, déjà dans les dépendances) — semelle,
// tige, virgule, lacets, talon, chacune ses couleurs — dont une partie se
// ressemble exprès (même tige blanche, seul l'accent change) et des JUMELLES
// (deux annonces du même modèle, même couleur : indécidable, l'écran doit les
// montrer toutes les deux).
//
// Chaque paire : 1 photo d'annonce + 3 photos « à la main » (angle +25°, −40°,
// vue plongeante), soit 3 recherches. On compte : la bonne paire en tête
// (top 1), parmi les 5 proposées (top 5), et les scores (vraie paire vs
// meilleure intruse) pour poser les seuils « très proche / proche / peu sûr ».
// On compare chaque partie de l'empreinte seule et le mélange retenu, avec
// LE VRAI module (src/empreintePhoto.js), chargé tel quel dans la page.
// ⚠️ Ce n'est PAS une mesure sur de vraies chaussures : c'est une mesure
//    reproductible du comportement (angle, fond, lumière, ressemblances).
const { chromium } = require(require('path').join(__dirname, '..', 'node_modules', 'playwright'));
const fs = require('fs'), http = require('http'), path = require('path');
const RACINE = path.join(__dirname, '..');
const PORT = Number(process.env.BANC_PORT) || 10351;
const JSON_SEUL = process.argv.includes('--json');

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff">
<script type="importmap">{"imports":{"three":"/three.module.js"}}</script>
<script type="module">
import * as THREE from 'three';
import * as E from '/empreintePhoto.js';
window.E = E;
const W = 300, H = 400;
const rnd = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1); document.body.appendChild(renderer.domElement);
const c2 = document.createElement('canvas'); c2.width = 192; c2.height = 256; const x2 = c2.getContext('2d', { willReadFrequently: true });

const PALETTE = ['#f4f4f2','#111111','#c8102e','#1d4ed8','#15803d','#f59e0b','#9ca3af','#7c3aed','#0ea5e9','#a16207','#ec4899','#14532d','#e5e7eb','#78350f','#fde047'];
// Les paires inventées : [tige, semelle, virgule, lacets, talon]. Les 10
// premières se ressemblent exprès (tige blanche) ; les 4 dernières sont deux
// couples de JUMELLES (mêmes couleurs, deux annonces).
const MODELES = [];
const r0 = rnd(7);
const pick = () => PALETTE[Math.floor(r0() * PALETTE.length)];
for (let i = 0; i < 10; i++) MODELES.push(['#f4f4f2', i % 3 === 0 ? '#a16207' : '#f4f4f2', PALETTE[2 + (i % 12)], i % 2 ? '#f4f4f2' : '#111111', PALETTE[(i * 5) % 15]]);
for (let i = 0; i < 26; i++) MODELES.push([pick(), pick(), pick(), pick(), pick()]);
MODELES.push(['#111111','#f4f4f2','#f4f4f2','#111111','#111111'], ['#111111','#f4f4f2','#f4f4f2','#111111','#111111']);
MODELES.push(['#1d4ed8','#f4f4f2','#fde047','#f4f4f2','#1d4ed8'], ['#1d4ed8','#f4f4f2','#fde047','#f4f4f2','#1d4ed8']);
const JUMELLES = { 36: 37, 37: 36, 38: 39, 39: 38 };

const mat = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
const chaussure = (m) => {
  const g = new THREE.Group();
  const sole = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.28, 0.95), mat(m[1], 0.9)); sole.position.y = 0.14; g.add(sole);
  const tige = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mat(m[0])); tige.scale.set(1.25, 0.62, 0.46); tige.position.set(-0.05, 0.55, 0); g.add(tige);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.7, 24), mat(m[0])); col.position.set(-0.85, 0.75, 0); g.add(col);
  const talon = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.5), mat(m[4])); talon.position.set(-1.22, 0.6, 0); g.add(talon);
  for (const z of [0.47, -0.47]) {
    const v = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.075, 8, 32, Math.PI * 0.9), mat(m[2], 0.5));
    v.position.set(0.05, 0.45, z); v.rotation.z = Math.PI * 1.05; v.scale.set(1.3, 0.55, 1); g.add(v);
  }
  for (let k = 0; k < 5; k++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.42), mat(m[3])); l.position.set(0.55 - k * 0.22, 0.88 + k * 0.03, 0); g.add(l); }
  return g;
};
const textureSol = (base, rayures, seed) => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  const r = rnd(seed);
  if (rayures) for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(0,0,0,' + (0.05 + r() * 0.12) + ')'; x.fillRect(0, r() * 256, 256, 2 + r() * 6); }
  else for (let i = 0; i < 400; i++) { x.fillStyle = 'rgba(255,255,255,' + r() * 0.08 + ')'; x.fillRect(r() * 256, r() * 256, 3, 3); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
};
// vue : { lacet (degrés autour), plonge (degrés), fond, sol, lumiere, main, recul }
const rendre = (m, vue) => {
  const sc = new THREE.Scene(); sc.background = new THREE.Color(vue.fond);
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ map: textureSol(vue.sol, vue.rayures, vue.seed || 1), roughness: 1 }));
  sol.rotation.x = -Math.PI / 2; sc.add(sol);
  sc.add(new THREE.HemisphereLight(vue.lumiere, '#444444', 1.1));
  const d = new THREE.DirectionalLight(vue.lumiere, 1.6); d.position.set(3, 6, 4); sc.add(d);
  const s = chaussure(m); sc.add(s);
  if (vue.main) { const h = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 6, 12), mat('#d8a07a', 0.8)); h.position.set(0.9, 0.9, 0.55); h.rotation.z = 1.2; sc.add(h); }
  const cam = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
  const a = vue.lacet * Math.PI / 180, p = vue.plonge * Math.PI / 180, R = vue.recul || 4.6;
  cam.position.set(R * Math.sin(a) * Math.cos(p), 0.5 + R * Math.sin(p), R * Math.cos(a) * Math.cos(p));
  cam.lookAt(vue.visee || 0, 0.5, 0);
  renderer.render(sc, cam);
  x2.drawImage(renderer.domElement, 0, 0, 192, 256);
  const d2 = x2.getImageData(0, 0, 192, 256);
  sc.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
  return { px: d2.data, w: 192, h: 256 };
};
const ANNONCE = { lacet: 0, plonge: 12, fond: '#eeeae4', sol: '#e9e4dc', lumiere: '#ffffff', recul: 7 };
const MAIN = [
  { lacet: 25, plonge: 18, fond: '#3b3f46', sol: '#6b4f35', rayures: true, lumiere: '#ffe2b8', main: true, recul: 6.2, visee: 0.25 },
  { lacet: -40, plonge: 10, fond: '#cfd8e3', sol: '#9aa6b2', lumiere: '#dfe9ff', recul: 7.5, visee: -0.2 },
  { lacet: 15, plonge: 45, fond: '#5a4a3a', sol: '#8a7a6a', rayures: true, lumiere: '#fff4e0', main: true, recul: 6.4 },
];
// Les pixels partent vers Node (base64) : l'empreinte y est calculée par le
// MÊME module — et le rendu (lent sous swiftshader) peut être gardé en cache.
const b64 = (px) => { let s = ''; for (let i = 0; i < px.length; i += 0x8000) s += String.fromCharCode.apply(null, px.subarray(i, i + 0x8000)); return btoa(s); };
window.mesurer = () => {
  const index = MODELES.map((m, i) => { const r = rendre(m, { ...ANNONCE, seed: i + 1 }); return { cle: String(i), w: r.w, h: r.h, px: b64(r.px) }; });
  const requetes = [];
  MODELES.forEach((m, i) => MAIN.forEach((v, k) => { const r = rendre(m, { ...v, seed: 100 + i * 7 + k }); requetes.push({ cible: i, vue: k, w: r.w, h: r.h, px: b64(r.px) }); }));
  return { index, requetes, jumelles: JUMELLES };
};
// La planche à REGARDER : 4 paires × (annonce + 3 photos à la main).
window.planche = (ids) => {
  const pl = document.createElement('canvas'); pl.width = 4 * 96; pl.height = ids.length * 128; const px = pl.getContext('2d');
  ids.forEach((i, l) => [ANNONCE, ...MAIN].forEach((v, k) => { rendre(MODELES[i], { ...v, seed: 1 }); px.drawImage(c2, k * 96, l * 128, 96, 128); }));
  renderer.domElement.style.display = 'none'; pl.style.display = 'block'; document.body.appendChild(pl);
};
window.pret = true;
</script>`;

const types = { '.js': 'text/javascript' };
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u === '/') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(PAGE); }
  const f = u === '/three.module.js' ? path.join(RACINE, 'node_modules/three/build/three.module.js')
    : u === '/three.core.js' ? path.join(RACINE, 'node_modules/three/build/three.core.js')
    : u === '/empreintePhoto.js' ? path.join(RACINE, 'src/empreintePhoto.js') : null;
  if (!f || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }); fs.createReadStream(f).pipe(r);
});

// Le classement avec des poids donnés (le module exporte `parties`) : la même
// règle que `similarite`, poids variables pour comparer.
const classerAvec = (E, poids, req, index) => index.map((e) => ({ cle: e.cle, score: E.combiner(E.parties(req, e.empreinte), poids) })).sort((a, b) => b.score - a.score);

(async () => {
  const CACHE = process.env.MESURE_CACHE || '';
  let d = null, dureeRendu = 0;
  if (CACHE && fs.existsSync(CACHE)) d = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  if (!d) {
  srv.listen(PORT);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 320, height: 420 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto(`http://localhost:${PORT}/`);
  await pg.waitForFunction(() => window.pret === true, null, { timeout: 30000 });
  const t0 = Date.now();
  d = await pg.evaluate(() => window.mesurer());
  dureeRendu = Date.now() - t0;
  // Une capture pour REGARDER le jeu (fait partie du test, §6.2).
  if (process.env.SHOTS) { await pg.setViewportSize({ width: 384, height: 768 }); await pg.evaluate(() => window.planche([0, 3, 15, 36, 37, 38])); await pg.screenshot({ path: path.join(process.env.SHOTS, 'mesure-recherche-photo.png') }); }
  await b.close(); srv.close();
  if (errs.length) { console.log('KO  erreurs dans la page :', errs.slice(0, 3).join(' | ')); process.exit(1); }
  if (CACHE) fs.writeFileSync(CACHE, JSON.stringify(d));
  }
  const E = await import(path.join(RACINE, 'src/empreintePhoto.js'));
  const t1 = Date.now();
  const emp = (x) => E.empreinteDePixels(new Uint8ClampedArray(Buffer.from(x.px, 'base64')), x.w, x.h);
  for (const x of d.index) x.empreinte = emp(x);
  for (const x of d.requetes) x.empreinte = emp(x);
  const dureeEmpreinte = (Date.now() - t1) / (d.index.length + d.requetes.length);
  const bon = (req, cle) => Number(cle) === req.cible || d.jumelles[req.cible] === Number(cle);
  const evaluer = (poids) => {
    let top1 = 0, top5 = 0; const vrais = [], intrus = [];
    for (const req of d.requetes) {
      const cl = classerAvec(E, poids, req.empreinte, d.index);
      if (bon(req, cl[0].cle)) top1++;
      if (cl.slice(0, 5).some((x) => bon(req, x.cle))) top5++;
      vrais.push(Math.max(...cl.filter((x) => bon(req, x.cle)).map((x) => x.score)));
      intrus.push(cl.find((x) => !bon(req, x.cle)).score);
    }
    const n = d.requetes.length;
    return { top1: top1 / n, top5: top5 / n, n, vrais, intrus };
  };
  const P = E.POIDS;
  const CONFIGS = {
    'hachage seul (dHash/pHash)': { ...P, couleur: 0, bords: 0, grille: 0, hash: 1 },
    'couleur sans le fond seule': { ...P, couleur: 1, objet: 1, bords: 0, grille: 0, hash: 0 },
    'couleur du centre seule': { ...P, couleur: 1, objet: 0, bords: 0, grille: 0, hash: 0 },
    'bords seuls': { ...P, couleur: 0, bords: 1, grille: 0, hash: 0 },
    'grille seule': { ...P, couleur: 0, bords: 0, grille: 1, hash: 0 },
    'retenu (POIDS)': { ...P },
  };
  const res = {};
  for (const [nom, p] of Object.entries(CONFIGS)) res[nom] = evaluer(p);
  // Une petite grille autour du retenu : le retenu doit en être (ou à une requête près).
  let meilleur = null;
  for (const c of [0.5, 0.6, 0.7, 0.8]) for (const ob of [0.4, 0.6, 0.8, 1]) for (const bo of [0, 0.1, 0.2]) for (const gr of [0, 0.1, 0.2]) {
    const h = Math.round((1 - c - bo - gr) * 100) / 100; if (h < 0) continue;
    const r = evaluer({ couleur: c, objet: ob, bords: bo, grille: gr, hash: h });
    if (!meilleur || r.top1 + r.top5 > meilleur.r.top1 + meilleur.r.top5) meilleur = { p: { couleur: c, objet: ob, bords: bo, grille: gr, hash: h }, r };
  }
  const q = (arr, f) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
  const R = res['retenu (POIDS)'];
  const sortie = {
    paires: d.index.length, recherches: R.n, dureeRenduMs: dureeRendu, msParEmpreinte: +dureeEmpreinte.toFixed(1),
    configs: Object.fromEntries(Object.entries(res).map(([k, v]) => [k, { top1: +(v.top1 * 100).toFixed(1), top5: +(v.top5 * 100).toFixed(1) }])),
    grille: { poids: meilleur.p, top1: +(meilleur.r.top1 * 100).toFixed(1), top5: +(meilleur.r.top5 * 100).toFixed(1) },
    scores: {
      vraie: { p10: q(R.vrais, 0.1), mediane: q(R.vrais, 0.5), p90: q(R.vrais, 0.9) },
      intruse: { p10: q(R.intrus, 0.1), mediane: q(R.intrus, 0.5), p90: q(R.intrus, 0.9), max: Math.max(...R.intrus) },
      seuils: E.SEUILS,
      intrusesAuDessusTresProche: R.intrus.filter((x) => x >= E.SEUILS.tresProche).length,
      vraiesSousProche: R.vrais.filter((x) => x < E.SEUILS.proche).length,
    },
  };
  if (JSON_SEUL) { console.log(JSON.stringify(sortie, null, 1)); return; }
  console.log(`${sortie.paires} paires inventées, ${sortie.recherches} recherches « à la main » (rendu ${dureeRendu} ms, ${sortie.msParEmpreinte} ms par empreinte dans Node)`);
  for (const [k, v] of Object.entries(sortie.configs)) console.log(`  ${k.padEnd(28)} top 1 ${String(v.top1).padStart(5)} %   top 5 ${String(v.top5).padStart(5)} %`);
  console.log(`  meilleur de la grille ${JSON.stringify(sortie.grille.poids)} : top 1 ${sortie.grille.top1} %, top 5 ${sortie.grille.top5} %`);
  console.log('  scores', JSON.stringify(sortie.scores));
})().catch((e) => { console.log('KO  ' + (e && e.stack || e)); process.exit(1); });
