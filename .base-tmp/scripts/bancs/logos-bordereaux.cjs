// Banc (11 nov., lot DJ3) : LA PLANCHE DES LOGOS DE TRANSPORTEURS. Julien : « je veux ceux qui sont sur
// les bordereaux ; tu mets InPost mais InPost appartient à Mondial Relay. » Rend, avec la VRAIE fonction de
// l'app (`svgMarque`, src/transporteursVisuels.js), chaque logo à 20, 44 et 110 px, en clair et en sombre, à
// 390 px tactile et 1512 px ; puis, pour chaque texte qu'un bordereau ou un e-mail écrit, le logo que l'app
// MONTRE (`cleTransporteur` ⇒ `svgMarque`). Exige : chaque dessin a une surface, aucune requête ne part,
// « InPost » et « Mondial Relay by InPost » montrent le dessin Mondial Relay. Captures dans SHOTS (à regarder).
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const R = process.env.BANC_RACINE || path.join(__dirname, '..', '..');
const SHOTS = process.env.SHOTS || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
(async () => {
  const V = await import('file://' + path.join(R, 'src/transporteursVisuels.js'));
  const cles = Object.keys(V.DESSINS_TRANSPORTEURS);
  const TEXTES = ['Mondial Relay', 'InPost', 'Mondial Relay by InPost', 'Chronopost', 'Shop2Shop', 'Colissimo', 'La Poste', 'Relais Colis', 'Vinted Go', 'UPS', 'DPD', 'GLS', 'Colis Privé'];
  const page = (sombre) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>
    body{margin:0;padding:16px;font:14px -apple-system,system-ui,sans-serif;background:${sombre ? '#000' : '#F2F2F7'};color:${sombre ? '#F5F5F7' : '#1D1D1F'}}
    h2{font-size:17px;margin:18px 0 8px} .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
    .c{background:${sombre ? '#1C1C1E' : '#fff'};border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:6px;align-items:flex-start;min-width:0}
    .r{display:flex;gap:8px;align-items:flex-end} small{color:${sombre ? '#98989D' : '#6E6E73'};overflow-wrap:anywhere}</style>
    <h2>Les dessins</h2><div class="g">${cles.map((k) => `<div class="c" data-planche="${k}"><div class="r">${V.svgMarque(k, 20)}${V.svgMarque(k, 44)}${V.svgMarque(k, 110)}</div><small>${V.nomDuTransporteur(k) || k}</small></div>`).join('')}</div>
    <h2>Ce que montre l’app pour le texte du bordereau</h2><div class="g">${TEXTES.map((t) => { const k = V.cleTransporteur(t); return `<div class="c" data-texte="${t}" data-cle="${k || ''}"><div class="r">${V.svgMarque(k, 44)}</div><small>« ${t} » ⇒ ${V.nomDuTransporteur(k) || '—'}</small></div>`; }).join('')}</div>`;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair'], [{ width: 1512, height: 982 }, true, '1512-sombre']]) {
      console.log(`\n— ${nom}`);
      const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
      const pg = await ctx.newPage(); let requetes = 0;
      await pg.route('**/*', (r) => { requetes++; r.abort(); });
      await pg.setContent(page(sombre));
      const m = await pg.evaluate(() => ({
        vides: [...document.querySelectorAll('[data-planche] svg')].filter((s) => { const r = s.getBoundingClientRect(); return !(r.width > 0 && r.height > 0); }).length,
        nb: document.querySelectorAll('[data-planche]').length,
        inpost: [...document.querySelectorAll('[data-texte*="InPost"] svg')].map((s) => s.getAttribute('data-marque')),
        deb: document.documentElement.scrollWidth - window.innerWidth,
        // (13 nov.) LE GABARIT : chaque tuile carrée, de la taille demandée, au même arrondi ; et le DESSIN (sans le fond ni
        // le liseré) dans la marge commune — mesuré sur la boîte du dessin rendu (getBBox), en unités de la tuile (32).
        gabarit: [...document.querySelectorAll('[data-planche]')].map((c) => {
          const svgs = [...c.querySelectorAll(':scope > .r > svg')];
          const tailles = svgs.map((s) => { const r = s.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; });
          const s = svgs[2]; const kids = [...s.children].slice(1).filter((e) => e.getAttribute('vector-effect') !== 'non-scaling-stroke');
          let x0 = 99, y0 = 99, x1 = -99, y1 = -99;
          for (const e of kids) { const bb = e.getBBox(); let x = bb.x, y = bb.y, w = bb.width, h = bb.height;
            const t = e.transform && e.transform.baseVal && e.transform.baseVal.consolidate(); if (t) { const M = t.matrix; x = M.a * x + M.e; y = M.d * y + M.f; w *= M.a; h *= M.d; }
            if (e.tagName === 'svg') { x = +e.getAttribute('x'); y = +e.getAttribute('y'); w = +e.getAttribute('width'); h = +e.getAttribute('height'); }
            x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h); }
          const lis = s.lastElementChild;
          return { k: c.getAttribute('data-planche'), tailles, rayon: svgs.map((e) => getComputedStyle(e).borderRadius), marge: +Math.min(x0, y0, 32 - x1, 32 - y1).toFixed(2), boite: [x0, y0, x1, y1].map((v) => +v.toFixed(1)), lisere: !!lis && lis.getAttribute('vector-effect') === 'non-scaling-stroke' };
        }),
      }));
      const gab = m.gabarit;
      dit(gab.every((g) => g.tailles.join() === '20x20,44x44,110x110'), 'chaque logo carré, aux tailles demandées (20, 44, 110)', gab.filter((g) => g.tailles.join() !== '20x20,44x44,110x110').map((g) => g.k + ':' + g.tailles).join(' '));
      dit(new Set(gab.map((g) => g.rayon.join())).size === 1, 'le même arrondi pour tous (26 %)', [...new Set(gab.map((g) => g.rayon.join()))].join(' | '));
      dit(gab.every((g) => g.lisere), 'le même liseré (un trait d’un pixel, quelle que soit la taille) sur chaque tuile', gab.filter((g) => !g.lisere).map((g) => g.k).join(' '));
      // Mondial Relay garde le dessin du bordereau (le « r » descend au bord, comme sur l’étiquette) : seule exception nommée.
      const horsMarge = gab.filter((g) => !['mondialrelay', 'inpost'].includes(g.k) && (g.marge < 2.5 || g.marge > 7));
      dit(!horsMarge.length, 'chaque dessin dans la marge commune (2,5 à 7 sur 32 : ni collé au bord, ni perdu au milieu)', horsMarge.map((g) => `${g.k}:${g.marge} ${g.boite}`).join(' · '));
      if (nom === '390-clair') console.log('     marges : ' + gab.map((g) => `${g.k} ${g.marge}`).join(' · '));
      dit(m.nb >= 13 && m.vides === 0, `chaque dessin a une surface (${m.nb} logos)`, String(m.vides));
      dit(m.inpost.length === 2 && m.inpost.every((x) => x === 'mondialrelay'), '« InPost » et « Mondial Relay by InPost » montrent le logo Mondial Relay', m.inpost.join(','));
      dit(requetes === 0, 'aucune requête (rien ne part chez un transporteur)', String(requetes));
      dit(m.deb <= 0, 'rien ne déborde', String(m.deb));
      if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `logos-bordereaux-${nom}.png`), fullPage: true });
      await ctx.close();
    }
  } finally { await b.close(); }
  console.log(ko ? `\n❌ ${ko} rouge(s), ${ok} vert(s)` : `\n✅ Logos des bordereaux : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
