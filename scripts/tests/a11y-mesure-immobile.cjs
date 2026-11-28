// ════════════════════════════════════════════════════════════════════════════
//  (28 nov.) La mesure de contraste du banc `accessibilite` (E1 « Commencer » 1:1, blanc sur blanc, en CI
//  seulement, par intermittence) : une page qui BOUGE entre la lecture des cadres et la capture.
//  Page inventée : une carte blanche, un bouton noir à texte blanc (21:1). Au moment où la mesure rend le
//  texte transparent, une bande blanche arrive au-dessus (une seule fois) : le bouton descend de 80 px.
//   · l'ancienne mesure lit l'ancien cadre sur la capture ⇒ elle voit du blanc ⇒ « 1:1 » (faux) ;
//   · la mesure relue voit que le cadre a bougé, recommence ⇒ le bouton est noir ⇒ rien à signaler.
//  Lancer : node scripts/tests/a11y-mesure-immobile.cjs   (MESURE=<chemin d'un _a11y-mesure.cjs> pour un autre arbre)
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), assert = require('assert/strict');
const { chromium } = require('playwright');
const M = require(process.env.MESURE ? path.resolve(process.env.MESURE) : path.join(__dirname, '..', 'bancs', '_a11y-mesure.cjs'));

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff;font:16px sans-serif">
<section style="background:#fff;padding:24px">
  <div id="haut"></div>
  <p style="color:#222">Configure VRM</p>
  <button id="b" style="background:#000;color:#fff;border:0;padding:12px 20px;font:16px sans-serif">Commencer</button>
</section>
<script>
  let fait = false;
  new MutationObserver(() => {
    if (fait || !document.getElementById('banc-sans-texte')) return; fait = true;
    const d = document.createElement('div'); d.style.cssText = 'height:80px;background:#fff'; document.getElementById('haut').appendChild(d);
  }).observe(document.head, { childList: true });
</script>`;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  let n = 0;
  try {
    // 1. La page bouge pendant la mesure : aucun faux « 1:1 ».
    const pg = await b.newPage({ viewport: { width: 600, height: 400 } });
    await pg.setContent(PAGE);
    const r = await M.contrastePixels(pg, null);
    assert.deepEqual(r.map((x) => x.texte + ' ' + x.ratio), [], 'page qui bouge : la mesure a lu un cadre périmé');
    n++;
    // 2. Le contrôle sait encore rougir : un vrai blanc sur blanc reste signalé.
    const pg2 = await b.newPage({ viewport: { width: 600, height: 400 } });
    await pg2.setContent(PAGE.replace('background:#000', 'background:#fff').replace('let fait = false', 'let fait = true'));
    const r2 = await M.contrastePixels(pg2, null);
    assert.ok(r2.some((x) => x.texte === 'Commencer' && x.ratio < 1.1), 'un vrai blanc sur blanc doit rester signalé');
    n++;
    console.log(`✅ a11y-mesure-immobile : ${n}/2`);
  } catch (e) { console.error('❌ ' + e.message); process.exitCode = 1; }
  finally { await b.close(); }
})();
