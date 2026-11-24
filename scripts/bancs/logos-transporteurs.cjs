// ════════════════════════════════════════════════════════════════════════════
//  BANC « LOGOS DES TRANSPORTEURS » (23 nov. — Julien : « il ne peut pas manquer un logo de transporteur »)
//  Chaque transporteur de la table (src/transporteursVisuels.js, la même que scripts/audit-logos-transporteurs.cjs) est
//  RENDU par Chromium dans son cadre (`svgMarque`, la tuile 32 × 32 de l'app), à 20, 28 et 40 px, sur fond clair et
//  sombre ; le banc mesure les pixels : une tuile vide (rien que le fond), un dessin qui déborde du cadre ou un cadre pas
//  carré ⇒ rouge. Planche : SHOTS/logos-transporteurs.png (à REGARDER). `MUTATION=vide` retire un dessin ⇒ rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const { pathToFileURL } = require('url');
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-logos-transporteurs');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 300) : '')); } return c; };

(async () => {
  const T = await import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'transporteursVisuels.js')).href);
  const cles = Object.keys(T.TRANSPORTEURS);
  const svgDe = (cle, t) => (process.env.MUTATION === 'vide' && cle === 'chronopost' ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${t}" height="${t}"><rect width="32" height="32" fill="#FFFFFF"/></svg>` : T.svgMarque(cle, t));
  const ligne = (fond, enc) => `<div style="display:flex;gap:14px;align-items:center;padding:12px;background:${fond};color:${enc};font:13px -apple-system,Arial">${cles.map((k) => `<figure style="margin:0;display:flex;flex-direction:column;align-items:center;gap:6px;width:112px">
    <span style="display:flex;gap:6px;align-items:center">${[20, 28, 40].map((t) => `<span data-logo="${k}" data-t="${t}" style="display:inline-flex;width:${t}px;height:${t}px;border-radius:${Math.round(t * 0.26)}px;overflow:hidden">${svgDe(k, t)}</span>`).join('')}</span>
    <figcaption style="font-size:10px;text-align:center">${T.nomDuTransporteur(k)}</figcaption></figure>`).join('')}</div>`;
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0">${ligne('#F1F3F6', '#111')}${ligne('#0F0F11', '#eee')}</body>`;
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const pg = await nav.newPage({ viewport: { width: Math.max(900, cles.length * 126 + 40), height: 260 }, deviceScaleFactor: 2 });
  await pg.setContent(html); await pg.waitForTimeout(300);
  await pg.screenshot({ path: path.join(SHOTS, 'logos-transporteurs.png'), fullPage: true });
  // Mesure : pour chaque tuile à 40 px, la part de pixels qui ne sont pas la couleur du fond de tuile (le dessin existe),
  // et sa boîte (carrée, la taille voulue).
  for (const k of cles) {
    const el = pg.locator(`[data-logo="${k}"][data-t="40"]`).first();
    const b = await el.boundingBox();
    const img = await el.screenshot();
    const m = await pg.evaluate(async (b64) => {
      const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode();
      const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data; const cx = Math.floor(c.width / 2), cy = Math.floor(c.height * 0.12);
      const f = [d[(cy * c.width + cx) * 4], d[(cy * c.width + cx) * 4 + 1], d[(cy * c.width + cx) * 4 + 2]];
      let diff = 0, n = 0; for (let y = Math.floor(c.height * .15); y < c.height * .85; y++) for (let xx = Math.floor(c.width * .15); xx < c.width * .85; xx++) { const p = (y * c.width + xx) * 4; n++; if (Math.abs(d[p] - f[0]) + Math.abs(d[p + 1] - f[1]) + Math.abs(d[p + 2] - f[2]) > 60) diff++; }
      return { part: Math.round((diff / n) * 1000) / 10 };
    }, img.toString('base64'));
    dit(b && Math.abs(b.width - 40) <= 1 && Math.abs(b.height - 40) <= 1 && m.part >= 4, `${k} (${T.nomDuTransporteur(k)}) : un dessin net dans le cadre carré (${m.part} % de la tuile dessinée)`, { b, m });
  }
  await nav.close();
  console.log(`\n${ko ? '❌' : '✅'} logos-transporteurs : ${ok} verts, ${ko} rouges — planche : ${path.join(SHOTS, 'logos-transporteurs.png')}`);
  process.exit(ko ? 1 : 0);
})();
