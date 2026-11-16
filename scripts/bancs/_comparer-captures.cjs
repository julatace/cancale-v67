// ════════════════════════════════════════════════════════════════════════════
//  OUTIL (16 nov., stabilite-iphone) — LE MÊME ASPECT À L'ŒIL, PIXEL À PIXEL.
//  Julien : « J'aime bien le fond justement » — retirer un flou ne doit rien changer à l'œil.
//  1) `node scripts/bancs/_comparer-captures.cjs capturer <dist> <dossier>` : Argent, Ventes, Achats, Ma journée
//     (+ Ventes · Toutes), 390 tactile, clair et sombre, base INVENTÉE (_base-messages-stock.cjs), horloge figée
//     par la base ; les animations coupées (`reducedMotion`) pour que deux prises se comparent.
//  2) `node scripts/bancs/_comparer-captures.cjs comparer <dossierA> <dossierB>` : écart moyen par canal (0–255)
//     et part des pixels qui changent de plus de 8, image par image. Rouge au-delà de `SEUIL_MOYEN` (défaut 1,0).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const [, , mode, a, b] = process.argv;
if (mode === 'capturer' || mode === 'flou') process.env.BANC_DIST = path.resolve(a);
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const ECRANS = { argent: '/?tab=compta', ventes: '/?tab=ventes&site=vinted', toutes: '/?tab=ventes&site=vinted', achats: '/?tab=achats', journee: '/?tab=journee' };

async function capturer(dossier) {
  fs.mkdirSync(dossier, { recursive: true });
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  for (const th of ['clair', 'sombre']) for (const [e, url] of Object.entries(ECRANS)) {
    const o = await P.ouvrir(nav, { W: 390, sombre: th === 'sombre', b: B.baseVolume(), url, api: B.apiVolume });
    await o.pg.emulateMedia({ reducedMotion: 'reduce' });
    await P.pret(o.pg);
    // l'écran STABLE : plus aucun squelette, et le texte de l'écran inchangé pendant 2 s (machine chargée)
    await o.pg.waitForFunction(() => !document.querySelector('.vrm-skeleton, .vrm-squelette, .vrm-ar-squelette, .vrm-boite-squelette, [class*="skeleton"]'), null, { timeout: 60000 }).catch(() => {});
    for (let i = 0, avant = ''; i < 20; i++) { const t = await o.pg.evaluate(() => (document.querySelector('.vrm-main') || document.body).innerText); if (t === avant) break; avant = t; await o.pg.waitForTimeout(2000); }
    if (e === 'toutes') { await o.pg.evaluate(() => { const x = [...document.querySelectorAll('.vrm-main button')].find((y) => /^Toutes/.test(y.textContent.trim())); if (x) x.click(); }); await o.pg.waitForTimeout(2500); }
    // les éléments qui bougent seuls (heure, pastille « Mis à jour », curseur) : masqués des deux côtés
    await o.pg.addStyleTag({ content: '.vrm-neuf, .vrm-neuf-hote, [data-heure-relative], .vrm-chargement, .vrm-fraicheur-hote{visibility:hidden!important} *{caret-color:transparent!important}' });
    await o.pg.waitForTimeout(800);
    await o.pg.screenshot({ path: path.join(dossier, `${e}-${th}.png`) });
    // et défilé à mi-hauteur : le contenu passe sous la barre du bas
    await o.pg.evaluate(() => { const se = [...document.querySelectorAll('*')].filter((x) => /auto|scroll/.test(getComputedStyle(x).overflowY) && x.scrollHeight > x.clientHeight + 40).sort((p, q) => q.clientHeight - p.clientHeight)[0] || document.scrollingElement; se.scrollTop = Math.min(900, se.scrollHeight); });
    await o.pg.waitForTimeout(800);
    await o.pg.screenshot({ path: path.join(dossier, `${e}-${th}-defile.png`) });
    await o.ctx.close();
    console.log('capturé', e, th);
  }
  await nav.close(); P.srv.close();
}

async function comparer(da, db) {
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const pg = await nav.newPage();
  const seuil = Number(process.env.SEUIL_MOYEN || 1);
  let ko = 0;
  for (const f of fs.readdirSync(da).filter((x) => x.endsWith('.png')).sort()) {
    if (!fs.existsSync(path.join(db, f))) continue;
    const r = await pg.evaluate(async ([x, y, bas]) => {
      const lire = async (b64) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const k = c.getContext('2d'); k.drawImage(i, 0, 0); return k.getImageData(0, 0, i.width, i.height); };
      const A = await lire(x), Bm = await lire(y);
      if (A.width !== Bm.width || A.height !== Bm.height) return { taille: true };
      let s = 0, n = 0, chg = 0;
      const fin = A.width * Math.max(0, A.height - bas) * 4;   // `MASQUE_BAS` : la barre du bas hors du calcul (changée exprès)
      for (let i = 0; i < fin; i += 4) { let m = 0; for (let k = 0; k < 3; k++) { const d = Math.abs(A.data[i + k] - Bm.data[i + k]); s += d; if (d > m) m = d; } n += 3; if (m > 8) chg++; }
      return { moyen: +(s / n).toFixed(3), change: +(100 * chg / (fin / 4)).toFixed(2) };
    }, [fs.readFileSync(path.join(da, f)).toString('base64'), fs.readFileSync(path.join(db, f)).toString('base64'), Number(process.env.MASQUE_BAS || 0)]);
    const bon = !r.taille && r.moyen <= seuil;
    if (!bon) ko++;
    console.log(`${bon ? '✅' : '❌'} ${f} : écart moyen ${r.moyen} / 255 · ${r.change} % des pixels > 8${r.taille ? ' (tailles différentes)' : ''}`);
  }
  await nav.close();
  process.exit(ko ? 1 : 0);
}

// 3) `node scripts/bancs/_comparer-captures.cjs flou <dist>` : sur la MÊME page chargée (aucune différence de données),
//    Ventes · À envoyer et · Toutes, clair et sombre, en haut et défilé : la capture avec le flou des listes, puis
//    la même sans (la règle 12 bis de studio-verre.css, injectée), et l'écart. Seuil `SEUIL_MOYEN` (défaut 1,0).
async function flou(dist) {
  process.env.BANC_DIST = path.resolve(dist);
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const cmp = await nav.newPage();
  const seuil = Number(process.env.SEUIL_MOYEN || 1); let ko = 0;
  const ecart = (x, y) => cmp.evaluate(async ([x, y]) => {
    const lire = async (b64) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const k = c.getContext('2d'); k.drawImage(i, 0, 0); return k.getImageData(0, 0, i.width, i.height); };
    const A = await lire(x), Bm = await lire(y); let s = 0, n = 0, chg = 0, pire = 0;
    for (let i = 0; i < A.data.length; i += 4) { let m = 0; for (let k = 0; k < 3; k++) { const d = Math.abs(A.data[i + k] - Bm.data[i + k]); s += d; if (d > m) m = d; } n += 3; if (m > 8) chg++; if (m > pire) pire = m; }
    return { moyen: +(s / n).toFixed(3), change: +(100 * chg / (A.data.length / 4)).toFixed(2), pire };
  }, [x.toString('base64'), y.toString('base64')]);
  for (const th of (process.env.THEMES || 'clair,sombre').split(',')) for (const vue of (process.env.VUES || 'envoyer,toutes').split(',')) {
    const o = await P.ouvrir(nav, { W: 390, sombre: th === 'sombre', b: B.baseVolume(), url: '/?tab=ventes&site=vinted', api: B.apiVolume });
    await o.pg.emulateMedia({ reducedMotion: 'reduce' });
    await P.pret(o.pg);
    await o.pg.waitForFunction(() => !document.querySelector('[class*="skeleton"], [class*="squelette"]'), null, { timeout: 60000 }).catch(() => {});
    if (vue === 'toutes') await o.pg.evaluate(() => { const x = [...document.querySelectorAll('.vrm-main button')].find((y) => /^Toutes/.test(y.textContent.trim())); if (x) x.click(); });
    await o.pg.waitForTimeout(3000);
    await o.pg.addStyleTag({ content: '*{animation:none!important;transition:none!important;caret-color:transparent!important}' });
    for (const pos of ['defile', 'haut']) {   // défilé d'abord : l'écran a fini d'arriver (photos, pastilles) quand on revient en haut
      { const y = pos === 'defile' ? 700 : 0; await o.pg.evaluate((y) => { const se = [...document.querySelectorAll('*')].filter((x) => /auto|scroll/.test(getComputedStyle(x).overflowY) && x.scrollHeight > x.clientHeight + 40).sort((p, q) => q.clientHeight - p.clientHeight)[0] || document.scrollingElement; se.scrollTop = y; }, y); await o.pg.waitForTimeout(pos === 'haut' ? 6000 : 800); }
      const flous = await o.pg.evaluate(() => [...document.querySelectorAll('.vrm-main :is(.vrm-colis-grille, .vrm-toutes-liste, .vv-seg, .vv-liste)')].filter((e) => { const c = getComputedStyle(e); return (c.backdropFilter || c.webkitBackdropFilter || 'none') !== 'none'; }).length);
      const avec = await o.pg.screenshot({ timeout: 180000 });
      const st = await o.pg.addStyleTag({ content: process.env.STYLE_SANS || '.vrm-main :is(.vrm-colis-grille, .vrm-toutes-liste, .vv-seg, .vv-liste){-webkit-backdrop-filter:none!important;backdrop-filter:none!important}' });   // `STYLE_SANS` : une autre règle à juger de la même façon
      await o.pg.waitForTimeout(500);
      const sans = await o.pg.screenshot({ timeout: 180000 });
      await st.evaluate((n) => n.remove());
      const r = await ecart(avec, sans);
      if (process.env.SHOTS) { fs.mkdirSync(process.env.SHOTS, { recursive: true }); fs.writeFileSync(path.join(process.env.SHOTS, `${vue}-${th}-${pos}-avec.png`), avec); fs.writeFileSync(path.join(process.env.SHOTS, `${vue}-${th}-${pos}-sans.png`), sans); }
      const bon = r.moyen <= seuil; if (!bon) ko++;
      console.log(`${bon ? '✅' : '❌'} Ventes · ${vue} · ${th} · ${pos} : ${flous} liste(s) floutée(s) avant · écart moyen ${r.moyen} / 255 · ${r.change} % des pixels > 8 · pire ${r.pire}`);
    }
    await o.ctx.close();
  }
  await nav.close(); P.srv.close();
  process.exit(ko ? 1 : 0);
}

(mode === 'capturer' ? capturer(b) : mode === 'flou' ? flou(a) : comparer(a, b)).catch((e) => { console.error(e); process.exit(2); });
