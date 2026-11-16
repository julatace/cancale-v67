// ════════════════════════════════════════════════════════════════════════════
//  LE JEU DE PHOTOS INVENTÉ du banc « même photo · sûr » (meme-photo-fiabilite.cjs) —
//  dessiné dans Chromium, AUCUNE photo réelle d'annonce (le dépôt est public). Les vraies
//  photos de sneakers du mode exemple (public/exemple/, CC0 / domaine public, CREDITS.md)
//  servent aussi, chargées par le banc.
//  Le dessin des paires (paire, vueDe, photo, chaussure, fond) est celui de
//  photos-comptes-seuil.cjs (11 nov.), recopié tel quel. Ajoutés le 15 nov. : l'usure d'un
//  exemplaire, « le même studio », les transformations du cahier, la prise de vue « bougée ».
//  `SOURCE` : le JavaScript de PAGE (canvas) à coller dans la page du banc.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
/* eslint-disable no-unused-vars */
function page() {
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
    x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(0, 105, 260, 30, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = p.semelle; x.beginPath(); x.moveTo(-260, 50); x.quadraticCurveTo(-285, 105, -225, 108); x.lineTo(245, 108); x.quadraticCurveTo(292, 100, 268, 40); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 3; for (let i = 0; i < p.crans; i++) { const xx = -240 + i * (490 / p.crans); x.beginPath(); x.moveTo(xx, 92); x.lineTo(xx + 6, 108); x.stroke(); }
    x.fillStyle = p.accent; x.fillRect(-250, 70, 505, 7);
    x.fillStyle = p.haut; x.beginPath(); x.moveTo(-252, 58); x.quadraticCurveTo(-262 + 520 * p.bout, -35, 40, -80 - p.haute);
    x.quadraticCurveTo(140, -165 - p.haute, 228, -70 - p.haute * 0.4); x.quadraticCurveTo(286, 0, 266, 52); x.closePath(); x.fill();
    x.fillStyle = p.panneau; x.beginPath(); x.moveTo(-252, 58); x.quadraticCurveTo(-240, -10, -120, -30); x.quadraticCurveTo(-90, 20, -60, 58); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(266, 52); x.quadraticCurveTo(280, -20, 228, -70 - p.haute * 0.4); x.quadraticCurveTo(170, -10, 180, 58); x.closePath(); x.fill();
    x.setLineDash([6, 6]); x.strokeStyle = 'rgba(255,255,255,0.6)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(-240, 50); x.quadraticCurveTo(-228, -4, -122, -22); x.stroke();
    x.beginPath(); x.moveTo(175, 50); x.quadraticCurveTo(170, -6, 222, -60 - p.haute * 0.4); x.stroke(); x.setLineDash([]);
    if (p.trous) { x.fillStyle = 'rgba(0,0,0,0.45)'; for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { x.beginPath(); x.arc(-205 + i * 18, 18 - j * 14 + i * 2, 3, 0, Math.PI * 2); x.fill(); } }
    x.strokeStyle = p.accent; x.lineWidth = 18; x.lineCap = 'round'; x.beginPath(); x.moveTo(-150, 34 - 40 * p.logo); x.quadraticCurveTo(10, 66, 180, -34 + 30 * p.logo); x.stroke();
    for (let i = 0; i < p.lacets; i++) { const lx = 30 + i * 24, ly = -64 - i * 10 - p.haute * (i / p.lacets);
      x.fillStyle = '#111'; x.beginPath(); x.arc(lx, ly, 4, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#fafafa'; x.lineWidth = 6; x.beginPath(); x.moveTo(lx - 6, ly - 4); x.lineTo(lx + 22, ly + 14); x.stroke(); }
    x.fillStyle = '#fff'; x.font = 'bold 22px sans-serif'; x.fillText(p.texte, 196, 10);
  }
  // L'USURE d'un exemplaire : deux paires du MÊME modèle ne sont jamais identiques au pixel
  // (plis, éraflures, nœud des lacets). Tirée de la graine de l'EXEMPLAIRE, pas de la prise de vue.
  function usure(x, p, r) {
    x.save();
    for (let i = 0, n = 5 + Math.floor(r() * 5); i < n; i++) {
      const px = -180 + r() * 300, py = -40 + r() * 70;
      x.strokeStyle = 'rgba(0,0,0,' + (0.18 + r() * 0.25) + ')'; x.lineWidth = 1.5 + r() * 2.5;
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 15 + r() * 25, py - 10 + r() * 20, px + 30 + r() * 40, py - 5 + r() * 10); x.stroke();
    }
    for (let i = 0, n = 2 + Math.floor(r() * 4); i < n; i++) {
      x.fillStyle = 'rgba(' + (r() < 0.5 ? '40,30,20' : '250,250,250') + ',' + (0.15 + r() * 0.3) + ')';
      x.beginPath(); x.ellipse(-230 + r() * 470, 40 + r() * 60, 4 + r() * 14, 2 + r() * 6, r() * 3, 0, Math.PI * 2); x.fill();
    }
    x.strokeStyle = 'rgba(250,250,250,0.9)'; x.lineWidth = 5;
    const nx = 60 + r() * 60, ny = -100 - p.haute * 0.6 - r() * 20;
    x.beginPath(); x.moveTo(nx, ny); x.bezierCurveTo(nx - 30 - r() * 30, ny - 30 - r() * 20, nx + 10 + r() * 30, ny - 50 - r() * 30, nx + 25 + r() * 20, ny + 5 + r() * 20); x.stroke();
    x.restore();
  }
  function photo(p, vue) {
    const c = document.createElement('canvas'); c.width = 600; c.height = 800;
    const x = c.getContext('2d');
    const r = alea(vue.graine);
    fond(x, vue, r);
    x.save();
    x.translate(300 + vue.dx, 470 + vue.dy); x.rotate(vue.angle); x.scale(vue.echelle * (vue.miroir ? -1 : 1), vue.echelle * vue.aplati);
    chaussure(x, p, r);
    if (vue.usure != null) usure(x, p, alea(vue.usure));
    if (vue.deux) { x.translate(40, 150); x.scale(0.95, 0.95); chaussure(x, p, r); }
    x.restore();
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
  // « Le même studio » : chaque exemplaire du même modèle photographié au MÊME endroit (même fond,
  // même grain du mur, même lumière), posé à ± 15 px, ± 2°, ± 2 % près. Le cas le plus dur.
  function vueStudio(k, inst) {
    const v = vueDe(k, 0), r = alea(70000 + k * 17 + inst * 131);
    return Object.assign({}, v, { dx: v.dx + (r() - 0.5) * 30, dy: v.dy + (r() - 0.5) * 30, angle: v.angle + (r() - 0.5) * 0.07,
      echelle: v.echelle * (1 + (r() - 0.5) * 0.04), deux: false, usure: 50000 + k * 1000 + inst });
  }
  async function charge(src) { const i = new Image(); i.src = src; await i.decode(); return i; }
  function versCanvas(img, w, h, sx = 0, sy = 0, sw = img.width, sh = img.height, filtre = '') {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; if (filtre) x.filter = filtre;
    x.drawImage(img, sx, sy, sw, sh, 0, 0, w, h); return c;
  }
  async function jpeg(c, q) { return charge(c.toDataURL('image/jpeg', q)); }
  async function webp(c, q) { return charge(c.toDataURL('image/webp', q)); }
  function bandes(img, haut, cote, couleur) {
    const c = document.createElement('canvas'); c.width = img.width + 2 * cote; c.height = img.height + 2 * haut;
    const x = c.getContext('2d'); x.fillStyle = couleur; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, cote, haut); return c;
  }
  // Ce que fait un autre site en reprenant la photo (le cahier : JPEG 50–90, WebP 60–80, réduite de
  // 25 à 50 %, recadrée de quelques px, bandes ajoutées, luminosité, et leurs combinaisons).
  async function transformations(c) {
    if (!c.toDataURL) c = versCanvas(c, c.width, c.height);   // une vraie photo chargée (Image)
    const base = await jpeg(c, 0.92);
    const W = base.width, H = base.height, px = Math.max(2, Math.round(W / 150));   // « quelques px » (4 sur 600)
    const carre = (img, coul) => { const M = Math.max(img.width, img.height); return bandes(img, Math.round((M - img.height) / 2), Math.round((M - img.width) / 2), coul); };
    const lum = (img, f) => versCanvas(img, img.width, img.height, 0, 0, img.width, img.height, 'brightness(' + f + ')');
    const rogne = (img) => versCanvas(img, img.width - 2 * px, img.height - 2 * px, px, px, img.width - 2 * px, img.height - 2 * px);
    return {
      jpeg90: await jpeg(c, 0.9), jpeg70: await jpeg(c, 0.7), jpeg50: await jpeg(c, 0.5),
      webp80: await webp(c, 0.8), webp70: await webp(c, 0.7), webp60: await webp(c, 0.6),
      reduite25: await jpeg(versCanvas(base, Math.round(W * 0.75), Math.round(H * 0.75)), 0.8),
      reduite50: await jpeg(versCanvas(base, Math.round(W * 0.5), Math.round(H * 0.5)), 0.8),
      vignette: await jpeg(versCanvas(base, Math.round(W / 4), Math.round(H / 4)), 0.75),
      rogne_px: await jpeg(rogne(base), 0.85),
      rogne_cote: await jpeg(versCanvas(base, W - 3 * px, H - px, 3 * px, 0, W - 3 * px, H - px), 0.85),
      bandes_carre: await jpeg(carre(base, '#ffffff'), 0.85),
      bandes_noires: await jpeg(bandes(base, Math.round(H * 0.06), 0, '#000'), 0.85),
      bande_cote: await webp(bandes(base, 0, Math.round(W * 0.04), '#f4f4f4'), 0.75),
      plus_claire: await jpeg(lum(base, 1.1), 0.85), plus_sombre: await jpeg(lum(base, 0.9), 0.85),
      cdn: await webp(versCanvas(await jpeg(versCanvas(base, W / 2, H / 2), 0.6), W / 2, H / 2), 0.6),
      tout: await webp(versCanvas(await jpeg(lum(carre(rogne(base), '#fff'), 1.06), 0.7), Math.round(Math.max(W, H) * 0.5), Math.round(Math.max(W, H) * 0.5)), 0.65),
    };
  }
  // Une AUTRE prise de vue d'une vraie photo (public/exemple/, CC0) : l'appareil a bougé (1,5 à 3°,
  // jusqu'à 4 % de décalage, 3 à 6 % d'échelle), la lumière a changé. Jamais « la même photo ».
  function bougee(img, r) {
    const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.fillStyle = '#ddd'; x.fillRect(0, 0, W, H);
    const a = (0.026 + r() * 0.026) * (r() < 0.5 ? -1 : 1), s = 1.03 + r() * 0.03;
    x.translate(W / 2 + (r() - 0.5) * 0.08 * W, H / 2 + (r() - 0.5) * 0.08 * H); x.rotate(a); x.scale(s, s); x.drawImage(img, -W / 2, -H / 2);
    x.setTransform(1, 0, 0, 1, 0, 0);
    const lg = x.createLinearGradient(0, 0, W * r(), H); lg.addColorStop(0, 'rgba(255,245,230,' + (0.05 + r() * 0.12) + ')'); lg.addColorStop(1, 'rgba(0,0,0,' + (0.04 + r() * 0.1) + ')');
    x.fillStyle = lg; x.fillRect(0, 0, W, H);
    return c;
  }
}
const s = page.toString();
module.exports = { SOURCE: s.slice(s.indexOf('{') + 1, s.lastIndexOf('}')) };
