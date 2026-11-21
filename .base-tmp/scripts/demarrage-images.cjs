// ════════════════════════════════════════════════════════════════════════════
//  LES ÉCRANS DE LANCEMENT DE L'APP INSTALLÉE SUR L'IPHONE (public/demarrage/)
//  (15 nov., chantier « ouverture ») — refaits en « Verre dépoli ».
//
//  iOS montre ces images entre le toucher sur l'icône et la première image de la
//  page. Elles sont RENDUES ici depuis l'écran de démarrage d'index.html lui-même
//  (ses styles, son logo, son dégradé `--vrm-verre-fond` / `-nuit`) : le logo est
//  au même endroit, le fond est le même — l'icône, l'image de lancement, l'écran de
//  démarrage puis l'app se suivent sans un éclair blanc. Seuls le rail et les
//  phrases sont retirés (une image ne bouge pas).
//  ⚠️ iOS choisit l'image claire ou sombre selon le thème du SYSTÈME (pas le choix
//  `vinted_dark` de l'app) : c'est la limite connue (2026-11-11-app-installable.md).
//
//    node scripts/demarrage-images.cjs        (réécrit public/demarrage/*.jpg)
//    node scripts/demarrage-images.cjs --verifier   (compare, n'écrit rien)
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const { chromium } = require(path.join(R, 'node_modules', 'playwright'));
// JPEG (qualité 88) : un dégradé en PNG pèse 1,4 Mo par image (23 Mo les 24) ; en JPEG ≈ 120 Ko. iOS lit
// une image de lancement JPEG comme une PNG (seules les dimensions exactes comptent : audit-app-installable).
const { jpegjs, PNG } = require(path.join(R, 'node_modules', 'playwright-core', 'lib', 'utilsBundle.js'));
const QUALITE = 88;

const html = fs.readFileSync(path.join(R, 'index.html'), 'utf8');
const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).find((c) => c.includes('--vrm-verre-fond') && c.includes('#vrm-demarrage'));
const div = (/<div id="vrm-demarrage"[\s\S]*?\n<\/div>/.exec(html) || [])[0];
if (!styles || !div) { console.log('❌ écran de démarrage introuvable dans index.html'); process.exit(1); }
const IPHONES = [[440, 956, 3], [430, 932, 3], [402, 874, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3], [414, 896, 3], [375, 812, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2], [320, 568, 2]];
const page = (theme) => `<!doctype html><html lang="fr" data-theme="${theme}" data-vrm-boot><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>body{margin:0}${styles}
#vrm-demarrage .vrm-boot-rail,#vrm-demarrage .vrm-boot-mot,#vrm-demarrage .vrm-boot-lent{display:none!important}
#vrm-demarrage .vrm-boot-logo{animation:none!important}</style></head><body>${div}</body></html>`;

(async () => {
  const verifier = process.argv.includes('--verifier');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  let ecrits = 0;
  for (const [w, h, r] of IPHONES) for (const [theme, nom] of [['light', 'clair'], ['dark', 'sombre']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: r, colorScheme: theme });
    const pg = await ctx.newPage();
    await pg.setContent(page(theme));
    await pg.waitForTimeout(80);
    const img = PNG.sync.read(await pg.screenshot({ type: 'png' }));
    const buf = jpegjs.encode({ data: img.data, width: img.width, height: img.height }, QUALITE).data;
    fs.mkdirSync(path.join(R, 'public', 'demarrage'), { recursive: true });
    const f = path.join(R, 'public', 'demarrage', `vrm-${w}x${h}@${r}-${nom}.jpg`);
    if (!verifier) { fs.writeFileSync(f, buf); ecrits++; }
    await ctx.close();
  }
  await b.close();
  console.log(verifier ? '✅ rendus' : `✅ ${ecrits} images écrites dans public/demarrage/`);
})().catch((e) => { console.error(e); process.exit(1); });
