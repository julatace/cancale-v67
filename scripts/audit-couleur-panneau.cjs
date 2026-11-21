// ════════════════════════════════════════════════════════════════════════════
//  « DES COULEURS BLEU VIF QUI NE VONT PAS ENSEMBLE » — LA PALETTE DU PANNEAU DE L'EXTENSION (21 nov., ext. 5.419)
//
//  Julien (21 nov., panneau 5.418) : « l'affichage doit être mieux : on a un style assez simple et après des couleurs
//  bleu vif qui ne vont pas ensemble ». La palette voulue (façon Vintex) : encre pour le bouton plein, contours gris
//  fins, étiquettes pastel (vert = fait/prêt, ambre = geste, gris = attente, teal doux = en route), accent VERT SAPIN
//  rare (#0F6B4C, nuit #3FD49A) pour l'onglet actif et les interrupteurs ; rouge seulement doublon de N° ; pas de violet.
//  On lit CHAQUE couleur écrite dans les fichiers de l'interface de l'extension (hex et rgb/rgba) :
//   C1. aucun BLEU (teinte 185°–255°, saturation ≥ 30 %, luminosité 12 %–92 %) ;
//   C2. aucun VIOLET (teinte 256°–320°, saturation ≥ 30 %) ;
//   C3. l'accent du grand panneau est le vert sapin (clair et nuit), le bouton plein est l'encre ;
//  Les logos des transporteurs (`LOGOS_TRANSP`, leurs couleurs de marque) ne sont pas jugés.
//  5.427 (Julien : « le visuel doit être mieux que ça ») — le panneau DESSINÉ par son vrai code (scripts/_panneau-faux.cjs,
//  données inventées), à 390 Orion (clair, sombre) et 1512 :
//   C4. l'échelle : aucun texte visible du panneau au-dessus de 22 px ; un titre de rangée (Articles, Commandes, listes,
//       favoris) à 15 px au plus ;
//   C5. les étapes du parcours des favoris : aucun libellé coupé (« … », texte qui déborde de sa case) ;
//   C6. la plaque N° : 22 px de haut au plus (fine et discrète, plus l'étiquette kraft de 24–40 px).
//  §6.1 : `--racine <arbre d'avant>` ⇒ rouge. `--prouve` : un bleu remis, un titre à 28 px, des étapes coupées, une plaque
//  de 40 px ⇒ chacun rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const args = process.argv.slice(2);
const iR = args.indexOf('--racine');
let EXT = path.join(iR >= 0 ? path.resolve(args[iR + 1]) : path.join(__dirname, '..'), 'vinted-sync-extension');
const FICHIERS = ['vrm-badge.js', 'vrm-ui.js', 'vrm-dressing.js', 'vrm-action.js', 'popup.html', 'vrm-formulaire.js'];
if (args.includes('--prouve')) {
  // Une mutation = une copie de l'extension avec UNE règle réaffaiblie ; chacune doit rendre l'audit rouge.
  const CSS_FIN = (css) => (t) => { const i = t.indexOf('\n</style>'); return t.slice(0, i) + '\n  ' + css + t.slice(i); };
  const MUT = [
    ['#0068D6 remis', (t) => t.replace('--n-accent:#0F6B4C;', '--n-accent:#0068D6;')],
    ['titre à 28 px', CSS_FIN('.carte[data-grand] .tete6 h1 { font-size: 28px !important; }')],
    ['rangées à 17 px', CSS_FIN('.carte[data-grand] .tr6 .art6 .ti { font-size: 17px !important; }')],
    ['libellés d’étapes coupés', CSS_FIN('.carte[data-grand] .et10 li { flex: 1 1 0 !important; font-size: 13px !important; height: auto !important; padding: 8px 6px !important; } .carte[data-grand] .et10 li i { display: inline-flex !important; width: 22px !important; } .carte[data-grand] .et10 li span { display: inline !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }')],
    ['plaque N° de 40 px', CSS_FIN('.carte[data-grand] .vu-n, .carte[data-grand] .plaque { height: 40px !important; }')],
  ];
  let bon = 0;
  for (const [nom, f] of MUT) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'couleur-'));
    fs.mkdirSync(path.join(tmp, 'vinted-sync-extension'));
    for (const x of FICHIERS.concat(['background.js'])) if (fs.existsSync(path.join(EXT, x))) fs.copyFileSync(path.join(EXT, x), path.join(tmp, 'vinted-sync-extension', x));
    const pb = path.join(tmp, 'vinted-sync-extension', 'vrm-badge.js');
    const avant = fs.readFileSync(pb, 'utf8'), apres = f(avant);
    if (apres === avant) { console.log(`❌ mutation « ${nom} » : introuvable`); continue; }
    fs.writeFileSync(pb, apres);
    const r = require('child_process').spawnSync(process.execPath, [__filename, '--racine', tmp], { encoding: 'utf8' });
    if (r.status === 1) { bon++; console.log(`✅ mutation « ${nom} » ⇒ rouge`); } else console.log(`❌ mutation « ${nom} » non détectée`);
  }
  process.exit(bon === MUT.length ? 0 : 1);
}
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 700) : ''}`); } };
function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const M = Math.max(r, g, b), m = Math.min(r, g, b), l = (M + m) / 2, d = M - m;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}
const bleus = [], violets = [];
for (const f of FICHIERS) {
  const p = path.join(EXT, f); if (!fs.existsSync(p)) continue;
  fs.readFileSync(p, 'utf8').split('\n').forEach((ligne, i) => {
    if (/LOGOS_TRANSP|^\s*(google|discord): '<svg/.test(ligne)) return;   // logos de marque (transporteurs, Google, Discord)
    const cs = [];
    for (const m of ligne.matchAll(/#([0-9a-fA-F]{6})\b/g)) cs.push([m[0], parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)]);
    for (const m of ligne.matchAll(/#([0-9a-fA-F]{3})\b(?![0-9a-fA-F])/g)) cs.push([m[0], ...m[1].split('').map((c) => parseInt(c + c, 16))]);
    for (const m of ligne.matchAll(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/g)) cs.push([m[0] + ')', +m[1], +m[2], +m[3]]);
    for (const [txt, r, g, b] of cs) {
      const c = hsl(r, g, b);
      if (c.h >= 185 && c.h <= 255 && c.s >= 0.30 && c.l >= 0.12 && c.l <= 0.92) bleus.push(`${f}:${i + 1} ${txt}`);
      if (c.h > 255 && c.h <= 320 && c.s >= 0.30 && c.l >= 0.12 && c.l <= 0.92) violets.push(`${f}:${i + 1} ${txt}`);
    }
  });
}
console.log('\nC1. Aucun bleu dans l’interface de l’extension');
dit(!bleus.length, `aucun bleu (${bleus.length} trouvés)`, bleus.slice(0, 30).join(' · '));
console.log('\nC2. Aucun violet');
dit(!violets.length, `aucun violet (${violets.length} trouvés)`, violets.slice(0, 20).join(' · '));
console.log('\nC3. L’accent du grand panneau : vert sapin, rare ; le plein : l’encre');
const B = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
dit(/\.carte\[data-grand\] \{[^}]*--n-accent:#0F6B4C;/.test(B), 'clair : --n-accent #0F6B4C');
dit((B.match(/--n-accent:#3FD49A;/g) || []).length >= 2, 'nuit (système et choisi) : --n-accent #3FD49A');
dit(/--vu-plein:#111114;/.test(B) && /--vu-plein:#F2F2F7;/.test(B), 'bouton plein : encre (#111114 ; nuit #F2F2F7)');
const BG = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
dit(!/#0068D6|#409CFF/i.test(BG), 'background.js : plus de #0068D6 / #409CFF (voile de l’onglet de travail)');

// ── C4–C6 : le panneau DESSINÉ (vrai code, données inventées) ─────────────────────────────────────────────────────────
const mesurer = (pg) => pg.evaluate(() => {
  const r = document.getElementById('vrm-badge').shadowRoot;
  const vis = (el) => { if (!el || !el.getClientRects().length) return false; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const nom = (el) => el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : '');
  const gros = [], titres = [], plaques = [], etapes = [];
  for (const el of r.querySelectorAll('.carte *')) {
    if (!vis(el) || el.matches('svg, svg *, input, textarea, select')) continue;
    const t = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!t || t === '×' || t === '✕' || t === '⋯' || t === '…' || t === '›' || t === '‹') continue;
    const f = parseFloat(getComputedStyle(el).fontSize);
    if (f > 22.01) gros.push(nom(el) + ' ' + f + 'px « ' + t.slice(0, 24) + ' »');
  }
  for (const el of r.querySelectorAll('.tr6 .art6 .ti, .carte[data-grand] .rang .ti, .fl-ti, .au6-i .ti, .trn5 .ti')) if (vis(el)) { const f = parseFloat(getComputedStyle(el).fontSize); if (f > 15.01) titres.push(nom(el) + ' ' + f + 'px'); }
  for (const el of r.querySelectorAll('.vu-n, .plaque')) if (vis(el)) { const h = el.getBoundingClientRect().height; if (h > 22.01) plaques.push(nom(el) + ' ' + Math.round(h) + 'px « ' + el.textContent.trim() + ' »'); }
  for (const li of r.querySelectorAll('.et10 li')) {
    if (!vis(li)) continue;
    for (const el of [li, ...li.querySelectorAll('*')]) {
      if (!vis(el)) continue;
      const cs = getComputedStyle(el), txt = el.textContent.trim();
      if (/…$/.test(txt) || (txt && el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible')) etapes.push(li.getAttribute('data-fav-etape-pas') + ' « ' + txt.slice(0, 20) + ' » ' + el.scrollWidth + '>' + el.clientWidth);
    }
  }
  return { gros, titres, plaques, etapes, n: r.querySelectorAll('.et10 li').length };
});
(async () => {
  let pw = null;
  try { pw = require('playwright'); } catch (_) { pw = null; }
  console.log('\nC4–C6. Le panneau dessiné : échelle, étapes entières, plaque N° fine');
  dit(!!pw, 'Chromium (playwright) joignable pour dessiner le panneau', 'pas de playwright ici : rien n’est conclu');
  if (pw) {
    const { charger } = require('./_panneau-faux.cjs');
    const F = charger(EXT);
    const nav = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const PAGES = ['accueil', 'annonces', 'ventes', 'messages', 'favoris', 'notifications', 'automatisations', 'sante', 'parametres'];
    const PLUS = ['favoris', 'notifications', 'automatisations', 'sante', 'parametres'];
    try {
      for (const [T, o] of [['390 Orion', { largeur: 390, hauteur: 844, mobile: true, orion: true }], ['390 sombre', { largeur: 390, hauteur: 844, mobile: true, orion: true, scheme: 'dark' }], ['1512', { largeur: 1512, hauteur: 900 }]]) {
        const t = await F.ouvrir(nav, Object.assign({ scheme: 'light' }, o));
        await F.montrer(t.pg, o.mobile);
        const G = [], TI = [], PL = [];
        for (const p of PAGES) {
          if (o.mobile && PLUS.includes(p)) { await F.toucher(t.pg, '[data-vx-plus]'); await F.toucher(t.pg, `[data-vx-plus-feuille] [data-onglet-b="${p}"]`); }
          else await F.clic(t.pg, `.side6 [data-onglet-b="${p}"]`);
          await t.pg.waitForTimeout(250);
          const m = await mesurer(t.pg);
          G.push(...m.gros.map((x) => p + ': ' + x)); TI.push(...m.titres.map((x) => p + ': ' + x)); PL.push(...m.plaques.map((x) => p + ': ' + x));
        }
        // Le parcours des favoris : trois favoris cochés, « Envoyer » ⇒ la feuille, l'étape 1.
        await F.clic(t.pg, '.side6 [data-onglet-b="favoris"]');
        if (o.mobile) { await F.toucher(t.pg, '[data-vx-plus]'); await F.toucher(t.pg, '[data-vx-plus-feuille] [data-onglet-b="favoris"]'); }
        await t.pg.waitForTimeout(300);
        for (const id of ['n0', 'n1', 'n2']) await F.clic(t.pg, `[data-fav-coche="${id}"]`);
        await F.clic(t.pg, '[data-fav-envoyer]');
        await t.pg.waitForTimeout(600);
        const e = await mesurer(t.pg);
        PL.push(...e.plaques.map((x) => 'feuille : ' + x));
        dit(!G.length, `${T} · C4 : aucun texte au-dessus de 22 px (titres 18–22, texte 14, méta 12)`, G.slice(0, 6).join(' | '));
        dit(!TI.length, `${T} · C4 : titres de rangée à 15 px au plus`, TI.slice(0, 6).join(' | '));
        dit(e.n === 4 && !e.etapes.length, `${T} · C5 : les 4 étapes du parcours des favoris, aucun libellé coupé (« … »)`, e.n === 4 ? e.etapes.slice(0, 4).join(' | ') : `${e.n} étape(s) dessinée(s)`);
        dit(!PL.length, `${T} · C6 : la plaque N° fait 22 px de haut au plus`, PL.slice(0, 6).join(' | '));
        await t.ctx.close();
      }
    } finally { await nav.close(); }
  }
  console.log(`\n${ko ? '❌' : '✅'} audit-couleur-panneau : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
