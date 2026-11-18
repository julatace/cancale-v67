#!/usr/bin/env node
// scripts/emails-planche.cjs
// ════════════════════════════════════════════════════════════════════════════
// LA PLANCHE « AVANT → APRÈS » DES E-MAILS DE VRM (17 nov., « Améliore les emails aussi »).
// Chaque e-mail du catalogue (scripts/emails-catalogue.cjs), fabriqué par SA vraie fonction
// sur des données inventées, rendu dans Chromium SANS RÉSEAU (le logo est servi depuis
// public/), à la largeur d'une boîte mail (600) et d'un téléphone (375), client clair et
// client sombre ; puis une planche par ligne : avant (600 clair) · après (600 clair) ·
// après (375 sombre) · après (375 clair, dans une autre langue).
//   node scripts/emails-planche.cjs --avant=<arbre d'avant> --sortie=<dossier> [--planche=<png>]
// Les captures ne montent jamais dans le dépôt.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const { catalogue } = require('./emails-catalogue.cjs');

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const APRES = path.join(__dirname, '..');
const AVANT = arg('avant', '');
const SORTIE = path.resolve(arg('sortie', path.join(require('os').tmpdir(), 'emails-planche')));
const PLANCHE = arg('planche', path.join(SORTIE, 'planche.png'));
const LANGUE_LIGNE = ['en', 'es', 'it', 'de'];

(async () => {
  const { chromium } = require('playwright');
  const exe = fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
  const nav = await chromium.launch({ ...exe, args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const logo = fs.readFileSync(path.join(APRES, 'public', 'vrm-logo-v5-192.png'));
  const capture = async (html, fichier, { largeur, sombre }) => {
    const ctx = await nav.newContext({ viewport: { width: largeur, height: 800 }, colorScheme: sombre ? 'dark' : 'light', deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.route('**/*', (r) => (/vrm-logo-v5-192\.png$/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'image/png', body: logo }) : r.abort()));
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: fichier, fullPage: true });
    await ctx.close();
    return fichier;
  };
  const apres = {}; for (const l of ['fr', ...LANGUE_LIGNE]) apres[l] = await catalogue(APRES, l);
  const avant = AVANT ? await catalogue(path.resolve(AVANT), 'fr') : [];
  const lignes = [];
  for (const [i, m] of apres.fr.entries()) {
    const l = m.marque ? 'fr' : LANGUE_LIGNE[i % LANGUE_LIGNE.length];
    const autre = apres[l].find((x) => x.id === m.id);
    const av = avant.find((x) => x.id === m.id);
    const f = (n) => path.join(SORTIE, `${m.id}-${n}.png`);
    lignes.push({
      m, l, sujets: { avant: av && av.sujet, apres: m.sujet, autre: autre.sujet },
      imgs: [
        av ? await capture(av.html, f('avant-600-clair'), { largeur: 600 }) : null,
        await capture(m.html, f('apres-600-clair'), { largeur: 600 }),
        await capture(m.html, f('apres-375-sombre'), { largeur: 375, sombre: true }),
        await capture(autre.html, f(`apres-375-clair-${l}`), { largeur: 375 }),
      ],
    });
    // Le jeu complet : chaque langue, 600 et 375, clair et sombre.
    for (const lg of ['fr', ...LANGUE_LIGNE]) {
      const x = apres[lg].find((y) => y.id === m.id);
      fs.writeFileSync(path.join(SORTIE, `${m.id}-${lg}.html`), x.html);
      fs.writeFileSync(path.join(SORTIE, `${m.id}-${lg}.txt`), `Sujet : ${x.sujet}\n\n${x.texte}`);
    }
  }
  const esc = (s) => String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const src = (p) => (p ? `data:image/png;base64,${fs.readFileSync(p).toString('base64')}` : '');
  const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#f2f4f7;font:14px -apple-system,Segoe UI,Roboto,sans-serif;color:#0c1d30}
  h1{font-size:22px;margin:0 0 6px}.r{display:grid;grid-template-columns:250px 250px 165px 165px;gap:16px;align-items:start;margin:0 0 28px;padding:16px;background:#fff;border-radius:14px}
  .t{grid-column:1/-1;font-weight:700;font-size:16px}.s{font-size:12px;color:#3f5468;margin-top:4px}.c img{width:100%;border:1px solid #dde3ea;border-radius:8px}.c b{display:block;font-size:12px;margin:0 0 6px}</style>
  <h1>E-mails envoyés par VRM — avant → après (17 nov.)</h1><p class="s">Données inventées. Avant = main, 600 px client clair. Après = 600 clair · 375 client sombre · 375 clair dans une autre langue.</p>
  ${lignes.map((x) => `<div class="r"><div class="t">${esc(x.m.nom)}<div class="s">Sujet avant : ${esc(x.sujets.avant || '—')}<br>Sujet après : ${esc(x.sujets.apres)}<br>Sujet (${x.l}) : ${esc(x.sujets.autre)}</div></div>
  ${['Avant · 600 clair', 'Après · 600 clair', 'Après · 375 sombre', `Après · 375 clair · ${x.l}`].map((t, k) => `<div class="c"><b>${t}</b>${x.imgs[k] ? `<img src="${src(x.imgs[k])}">` : '—'}</div>`).join('')}</div>`).join('')}`;
  const ctx = await nav.newContext({ viewport: { width: 940, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  await p.screenshot({ path: PLANCHE, fullPage: true });
  await nav.close();
  console.log(`planche : ${PLANCHE} (${lignes.length} e-mails) · captures et HTML/texte de chaque langue : ${SORTIE}`);
})().catch((e) => { console.error(e && e.stack); process.exit(1); });
