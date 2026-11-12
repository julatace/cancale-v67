// Banc (11 nov., lot DJ3) : LA PLANCHE DES LOGOS DE TRANSPORTEURS. Julien : « je veux ceux qui sont sur
// les bordereaux ; tu mets InPost mais InPost appartient à Mondial Relay. » Rend, avec la VRAIE fonction de
// l'app (`svgMarque`, src/transporteursVisuels.js), chaque logo à 22, 44 et 110 px, en clair et en sombre, à
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
    <h2>Les dessins</h2><div class="g">${cles.map((k) => `<div class="c" data-planche="${k}"><div class="r">${V.svgMarque(k, 22)}${V.svgMarque(k, 44)}${V.svgMarque(k, 110)}</div><small>${V.nomDuTransporteur(k) || k}</small></div>`).join('')}</div>
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
      }));
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
