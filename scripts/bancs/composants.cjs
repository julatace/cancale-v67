// ════════════════════════════════════════════════════════════════════════════
//  BANC — LES COMPOSANTS PARTAGÉS (5 nov., chantier B de la revue de cohérence)
//
//  Une page de démonstration MONTE chaque composant, avec les vraies feuilles
//  de style (celles de src/main.jsx, dans l'ordre) et la palette de
//  src/themeMineral.js : Bouton (4 variantes, petit, icône, occupé, grisé),
//  Segmente, ChampRecherche, PhotoVide, Numero, EtatPanne et la feuille unique
//  SheetShell (et sa variante lumineuse « En grand »). 390 px tactile et
//  1512 px, en clair et en sombre (+ un passage « mouvement réduit »).
//  Aucune donnée : des libellés de démonstration.
//
//  Il mesure, sur des nombres et des data-* :
//   1. le FOND de la feuille à la PREMIÈRE image (observateur posé avant le
//      clic, relevé au premier rAF) : opacité effective 1 (la feuille ET ses
//      ancêtres) et fond opaque — l'ancienne feuille fondait avec son voile ;
//   2. la croix : une icône (svg, aucun texte), nommée « Fermer », 44 × 44,
//      elle ferme ; le voile ferme ; « retour » ferme ;
//   3. la poignée : un glissé lent revient, un glissé franc ferme ; reprise
//      en plein mouvement d'entrée : AUCUN saut (on repart de la position
//      affichée) ; mouvement réduit : la feuille est en place dès la 1re image ;
//   4. la variante lumineuse : blanche même en sombre ;
//   5. les cibles au doigt (390 tactile) : ≥ 44 px pour la croix, la poignée,
//      les boutons du champ, Bouton (petit compris), EtatPanne ;
//   6. PhotoVide : la case a sa taille, un fond, l'icône centrée, même dessin partout ;
//   7. Numero : contraste ≥ 4,5:1, jamais blanche en sombre, le rouge pour le doublon seul ;
//   8. ChampRecherche : 17 px au doigt, la croix efface et rend le focus,
//      le micro seulement si la voix existe ;
//   9. EtatPanne : UN bouton, « Lecture en cours… » pendant la relecture ;
//  10. aucun débordement horizontal, aucune erreur.
//
//  BANC_MUTANT = fondu · transparent · croix · portail · photo · blanche (§6.1 :
//  chacune doit rendre le banc rouge). BANC_ANCIEN=1 monte l'ANCIENNE feuille
//  (App.jsx d'avant le 5 nov., recopiée mot pour mot) : la mesure 1 doit être rouge.
//  BANC_PORT (8750–8799, défaut 8750). SHOTS : le dossier des captures.
//  `node scripts/bancs/composants.cjs` (esbuild, pas Vite).
// ════════════════════════════════════════════════════════════════════════════
require('../_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = process.env.RACINE || path.join(__dirname, '..', '..');
const NM = [path.join(RACINE, 'node_modules'), path.join(__dirname, '..', '..', 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const PORT = Number(process.env.BANC_PORT) || 8750;
const MUTANT = process.env.BANC_MUTANT || '';
const ANCIEN = process.env.BANC_ANCIEN === '1';
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-composants');
fs.mkdirSync(SHOTS, { recursive: true });

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d != null && d !== '' ? '  → ' + String(d).slice(0, 400) : '')); } };

const MUTATIONS = {
  fondu: ['styles-composants.css', '  will-change: transform;\n  font-family', '  will-change: transform; animation: vrm-fs-voile-entree .2s ease-out both;\n  font-family'],
  transparent: ['styles-composants.css', '  background: var(--vrm-bg, #F2F2F7); color: var(--vrm-ink, #1D1D1F);\n  opacity: 1;', '  background: rgba(242,242,247,.6); color: var(--vrm-ink, #1D1D1F);\n  opacity: 1;'],
  // (La règle générale « Fermer… » de styles-boutons.css garantit aussi 44 px : la
  // mutation rend la croix petite ET anonyme, comme une croix faite main.)
  croix: ['SheetShell.jsx', 'className="vrm-fs-croix" data-feuille-croix="" aria-label="Fermer"', 'className="vrm-fs-croix" data-feuille-croix="" aria-label="×" style={{ width: 30, height: 30, minWidth: 30, minHeight: 30 }}'],
  portail: ['SheetShell.jsx', '  return createPortal(contenu, document.body);', '  return contenu;'],
  photo: ['PhotoVide.jsx', '      <IconeComposant nom="image" taille={icone} trait={1.6}/>\n', ''],
  blanche: ['styles-composants.css', ':root[data-theme="dark"] body .vrm-num { background: #48484A; color: #F5F5F7; }', ':root[data-theme="dark"] body .vrm-num { background: #F5F5F7; color: #1D1D1F; }'],
};

async function construire(theme) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-composants-'));
  // (8 nov., démarrage léger) les feuilles de l'app ont quitté main.jsx pour src/stylesApp.js (même ordre)
  const main = fs.readFileSync(path.join(RACINE, 'src', 'main.jsx'), 'utf8') + '\n' + (fs.existsSync(path.join(RACINE, 'src', 'stylesApp.js')) ? fs.readFileSync(path.join(RACINE, 'src', 'stylesApp.js'), 'utf8') : '');
  const css = [...main.matchAll(/^import\s+'\.\/([^']+\.css)';/gm)].map((m) => path.join(RACINE, 'src', m[1]));
  const src = (f) => JSON.stringify(path.join(RACINE, 'src', f));
  const sombre = theme === 'sombre';
  fs.writeFileSync(path.join(dir, 'entree.jsx'), `
${css.map((c) => `import ${JSON.stringify(c)};`).join('\n')}
import React from 'react';
import {createRoot} from 'react-dom/client';
import * as TH from ${src('themeMineral.js')};
import { SheetShell } from ${src('composants/SheetShell.jsx')};
import { BoutonBase as Bouton, SegmenteBase as Segmente } from ${src('composants/Bouton.jsx')};
import { ChampRecherche } from ${src('composants/ChampRecherche.jsx')};
import { PhotoVide } from ${src('composants/PhotoVide.jsx')};
import { Numero } from ${src('composants/Numero.jsx')};
import { EtatPanne } from ${src('composants/EtatPanne.jsx')};
import { montant } from ${src('format.js')};
import { L, VERBES } from ${src('libelles.js')};
const PAL=${sombre}?TH.MINERAL_DARK:TH.MINERAL;
const v=TH.variablesTheme(PAL,${sombre});for(const [k,x] of Object.entries(v))document.documentElement.style.setProperty(k,x);
document.documentElement.setAttribute('data-theme','${sombre ? 'dark' : 'light'}');
document.body.style.background=PAL.bg;document.body.style.color=PAL.text;document.body.style.margin='0';
// Le « retour » de l'app, réduit à l'essentiel : une entrée d'historique, popstate ferme.
function FermeAuRetour({ fermer }) {
  const ref = React.useRef(fermer); ref.current = fermer;
  React.useEffect(() => { window.__retours = (window.__retours||0) + 1; history.pushState({ banc: 1 }, '');
    const p = () => ref.current && ref.current(); window.addEventListener('popstate', p); return () => window.removeEventListener('popstate', p); }, []);
  return null;
}
// L'ANCIENNE feuille (App.jsx avant le 5 nov.), mot pour mot, pour BANC_ANCIEN=1.
const C = PAL;
function AncienneFeuille({ onClose, children, maxWidth = 460, z = 2000 }) {
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.46)',backdropFilter:'blur(3px)',WebkitBackdropFilter:'blur(3px)',zIndex:z,display:'flex',alignItems:'flex-end',justifyContent:'center',animation:'cancaleFadeIn .18s ease both'}}>
      <FermeAuRetour fermer={onClose}/>
      <div data-feuille="" className="vrm-fs-ancienne" onClick={e => e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth,borderRadius:'22px 22px 0 0',padding:'14px 18px calc(18px + env(safe-area-inset-bottom))',boxShadow:C.shadowLg||'none',maxHeight:'86vh',overflowY:'auto',animation:'cancaleSheet .26s cubic-bezier(.32,.72,0,1) both'}}>
        <div data-feuille-poignee="" style={{width:36,height:4,borderRadius:12,background:C.border,margin:'0 auto 14px'}}/>
        {children}
      </div>
    </div>
  );
}
const Feuille = ${ANCIEN ? 'AncienneFeuille' : 'SheetShell'};
const Section = ({ titre, children, ...r }) => <section style={{background:PAL.card,borderRadius:20,padding:16,margin:'0 0 16px'}} {...r}><h2 style={{margin:'0 0 12px',fontSize:13,fontWeight:600,lineHeight:1.3,color:PAL.muted,textTransform:'none'}}>{titre}</h2>{children}</section>;
const Rangee = ({ children, ...r }) => <div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'center'}} {...r}>{children}</div>;
function Demo() {
  const [feuille, setFeuille] = React.useState(null);
  const [q, setQ] = React.useState('');
  const [q2, setQ2] = React.useState('nike dunk');
  const [seg, setSeg] = React.useState('envoyer');
  const relire = () => new Promise((res) => { window.__relire = res; });
  return (
    <div className="vrm-app-shell"><main className="vrm-main" style={{padding:'16px',boxSizing:'border-box',maxWidth:760,margin:'0 auto',transform:'translateZ(0)'}} data-demo="">
      <h1 style={{fontSize:34,fontWeight:800,lineHeight:1.1,letterSpacing:'-.03em',margin:'8px 0 16px',color:PAL.text}}>Composants</h1>
      <Section titre="Bouton" data-demo-boutons="">
        <Rangee>
          <Bouton variante="primaire" data-b="primaire">{VERBES.imprimer}</Bouton>
          <Bouton variante="secondaire" data-b="secondaire">{VERBES.modifier}</Bouton>
          <Bouton variante="discret" data-b="discret">{VERBES.toutVoir}</Bouton>
          <Bouton variante="danger" data-b="danger">{VERBES.supprimer}</Bouton>
          <Bouton variante="secondaire" taille="petit" data-b="petit">{VERBES.copier}</Bouton>
          <Bouton variante="secondaire" icone="search" aria-label="Rechercher" data-b="icone"/>
          <Bouton variante="secondaire" occupe data-b="occupe">{VERBES.relire}</Bouton>
          <Bouton variante="primaire" disabled title="Rien à imprimer" data-b="grise">{VERBES.toutImprimer}</Bouton>
        </Rangee>
      </Section>
      <Section titre="Segmente" data-demo-segmente="">
        <Segmente label="Colis" value={seg} onChange={setSeg} options={[{ v: 'envoyer', l: L.aEnvoyer, n: 3 }, { v: 'route', l: L.enRoute }, { v: 'arrives', l: L.arrives }]}/>
      </Section>
      <Section titre="ChampRecherche" data-demo-recherche="">
        <div style={{display:'grid',gap:10}}>
          <ChampRecherche valeur={q} onChange={setQ} data-cr="vide"/>
          <ChampRecherche valeur={q2} onChange={setQ2} micro placeholder="N°, pseudo, suivi…" data-cr="plein"/>
        </div>
      </Section>
      <Section titre="PhotoVide" data-demo-photo="">
        <Rangee>
          <PhotoVide taille={40} data-pv="40"/><PhotoVide taille={56} data-pv="56"/><PhotoVide taille={88} data-pv="88"/>
          <span style={{position:'relative',display:'block',width:120,height:150}}><PhotoVide remplir data-pv="remplir"/></span>
        </Rangee>
      </Section>
      <Section titre="Numero" data-demo-numero="">
        <Rangee>
          <Numero n={124} data-nu="normal"/><Numero n="B125" taille="petit" data-nu="petit"/><Numero n={7} taille="grand" data-nu="grand"/>
          <Numero n={45} etat="doublon" data-nu="doublon"/><Numero n={230} etat="aVerifier" data-nu="verifier"/><Numero n={null} data-nu="vide"/>
        </Rangee>
      </Section>
      <Section titre="EtatPanne" data-demo-panne="">
        <div style={{display:'grid',gap:10}}>
          <EtatPanne quoi="Le porte-monnaie Vinted" raison="Vinted a refusé la lecture (trop de demandes). Réessaie dans quelques minutes." onReessayer={relire} data-ep="bouton"/>
          <EtatPanne quoi="Les ventes eBay" raison="Reconnecte eBay dans Paramètres → Comptes liés." data-ep="sans"/>
        </div>
      </Section>
      <Section titre="Montants" data-demo-montants="">
        <p data-montants="" style={{margin:0,color:PAL.text,fontVariantNumeric:'tabular-nums'}}>{[65, 249.5, 1234.5, null, { amount: '12.5', currency_code: 'GBP' }].map((x) => montant(x)).join(' · ')}</p>
      </Section>
      <Section titre="SheetShell" data-demo-feuille="">
        <Rangee>
          <Bouton variante="primaire" data-ouvrir="titre" onClick={() => setFeuille('titre')}>Ouvrir la feuille</Bouton>
          <Bouton variante="secondaire" data-ouvrir="lumineuse" onClick={() => setFeuille('lumineuse')}>{VERBES.enGrand}</Bouton>
        </Rangee>
      </Section>
      {feuille === 'titre' && <Feuille onClose={() => setFeuille(null)} titre="Relier un achat" sousTitre="Choisis l’achat de cette vente" FermeAuRetour={FermeAuRetour} data-feuille-demo="titre">
        <div style={{display:'grid',gap:12,paddingBottom:8}}>
          <ChampRecherche valeur={q} onChange={setQ}/>
          {[1,2,3,4,5,6].map((i) => <div key={i} style={{display:'flex',gap:12,alignItems:'center',background:PAL.card,borderRadius:14,padding:10}}>
            <PhotoVide taille={44}/><div style={{flex:1,minWidth:0,color:PAL.text}}>Nike Dunk Low · 42</div><Numero n={100 + i}/></div>)}
          <Bouton variante="primaire" plein>{VERBES.relier}</Bouton>
        </div>
      </Feuille>}
      {feuille === 'lumineuse' && <Feuille onClose={() => setFeuille(null)} titre="Code de retrait" lumineuse FermeAuRetour={FermeAuRetour} data-feuille-demo="lumineuse">
        <div style={{textAlign:'center',padding:'12px 0 20px'}}>
          <div data-code="" style={{fontSize:44,fontWeight:800,lineHeight:1.1,letterSpacing:'.08em',color:'var(--vrm-ink)'}}>4821 77</div>
          <div style={{marginTop:8,color:'var(--vrm-muted)'}}>Relais Pickup · Tabac du Port</div>
          <div style={{marginTop:12}}><Numero n={124} taille="grand"/></div>
        </div>
      </Feuille>}
    </main></div>
  );
}
createRoot(document.getElementById('r')).render(<Demo/>);
`);
  const mutant = MUTANT && MUTATIONS[MUTANT];
  const plugins = mutant ? [{ name: 'mutant', setup(b) {
    b.onLoad({ filter: new RegExp(mutant[0].replace(/\./g, '\\.') + '$') }, (a) => {
      const t = fs.readFileSync(a.path, 'utf8'); if (!t.includes(mutant[1])) throw Error('mutation introuvable : ' + MUTANT);
      return { contents: t.replace(mutant[1], mutant[2]), loader: a.path.endsWith('.css') ? 'css' : 'jsx' };
    });
  } }] : [];
  await esbuild.build({ entryPoints: [path.join(dir, 'entree.jsx')], bundle: true, outdir: path.join(dir, 'out'), format: 'esm', jsx: 'automatic', plugins,
    loader: { '.js': 'jsx', '.woff2': 'empty', '.woff': 'empty', '.png': 'empty', '.svg': 'empty', '.jpg': 'empty' }, nodePaths: [NM], logLevel: 'error',
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{"MODE":"production","PROD":true,"DEV":false}' }, external: ['/fonts/*', '/images/*', '/textures/*'] });
  // Les deux animations de l'ancienne feuille vivent dans index.html (pour BANC_ANCIEN).
  fs.writeFileSync(path.join(dir, 'out', 'index.html'), '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>@keyframes cancaleSheet{from{transform:translateY(100%)}to{transform:none}}@keyframes cancaleFadeIn{from{opacity:0}to{opacity:1}}body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Arial,sans-serif}</style><link rel="stylesheet" href="/entree.css"></head><body><div id="r"></div><script type="module" src="/entree.js"></script></body></html>');
  return path.join(dir, 'out');
}

// Contraste WCAG entre deux couleurs « rgb(a) ».
const rgb = (c) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(c || ''); return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : +m[4] } : null; };
const lum = ({ r, g, b }) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contraste = (a, b) => { const A = lum(a), B = lum(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };

// Ouvre la feuille et relève, AVANT la première peinture, ce qu'elle montre.
async function ouvrirEtMesurer(pg, quoi) {
  await pg.evaluate(() => {
    window.__img1 = null;
    const prendre = (el) => {
      let op = 1, e = el; const chaine = [];
      while (e && e.nodeType === 1) { const st = getComputedStyle(e); op *= Number(st.opacity); chaine.push(e.className || e.tagName); e = e.parentElement; }
      const st = getComputedStyle(el); const r = el.getBoundingClientRect();
      return { opacite: op, fond: st.backgroundColor, transform: st.transform, haut: r.top, hauteur: r.height, dansBody: el.parentElement && el.parentElement.parentElement === document.body, dansDemo: !!el.closest('[data-demo]') };
    };
    const obs = new MutationObserver(() => {
      const el = document.querySelector('[data-feuille]'); if (!el) return;
      obs.disconnect();
      requestAnimationFrame(() => { window.__img1 = prendre(el); });
    });
    obs.observe(document.body, { childList: true, subtree: true });
  });
  await pg.click(`[data-ouvrir="${quoi}"]`);
  await pg.waitForFunction(() => window.__img1, null, { timeout: 5000 }).catch(() => {});
  return pg.evaluate(() => window.__img1);
}
const posFeuille = (pg) => pg.evaluate(() => { const el = document.querySelector('[data-feuille]'); if (!el) return null; const t = getComputedStyle(el).transform; const m = /matrix\(([^)]+)\)/.exec(t); return m ? Number(m[1].split(',')[5]) : 0; });
// Attendre que plus rien ne bouge (animations finies), jamais un délai fixe (§6.5).
// ⚠️ Chromium sans écran (swiftshader) laisse parfois une animation WAAPI « running »
// sans jamais avancer (vu 1 fois sur 3 passages, 1512 px) : au-delà de 1,5 s, on la
// termine — c'est la CIBLE posée par le geste qu'on juge alors, pas l'horloge du banc.
const calme = async (pg) => {
  await pg.waitForTimeout(30);
  const fini = await pg.waitForFunction(() => !document.getAnimations().some((a) => a.playState === 'running'), null, { timeout: 1500 }).then(() => true, () => false);
  if (!fini) await pg.evaluate(() => { for (const a of document.getAnimations()) if (a.playState === 'running') { try { a.finish(); } catch (_) {} } });
  await pg.waitForTimeout(30);
};
const feuilleOuverte = (pg) => pg.evaluate(() => !!document.querySelector('[data-feuille]'));

(async () => {
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  const sorties = {};
  for (const theme of ['clair', 'sombre']) sorties[theme] = await construire(theme);
  let OUT = sorties.clair;
  const srv = http.createServer((q, r) => {
    let f = decodeURIComponent(q.url).split('?')[0]; if (f === '/') f = '/index.html';
    if (f === '/favicon.ico') { r.writeHead(204); return r.end(); }
    const p = path.join(OUT, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
  });
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); });
  const passages = [['clair', true, false], ['clair', false, false], ['sombre', true, false], ['sombre', false, false], ['clair', true, true]].filter(([t, tel, r]) => !process.env.BANC_PASSAGE || process.env.BANC_PASSAGE === `${t}-${tel ? '390' : '1512'}${r ? '-reduit' : ''}`);
  for (const [theme, tel, reduit] of passages) {
    OUT = sorties[theme];
    const T = `${tel ? '390' : '1512'} ${theme}${reduit ? ' réduit' : ''}`;
    const F = `${theme}-${tel ? '390' : '1512'}${reduit ? '-reduit' : ''}${ANCIEN ? '-ancien' : ''}${MUTANT ? '-' + MUTANT : ''}`;
    const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }),
      locale: 'fr-FR', timezoneId: 'Europe/Paris', colorScheme: theme === 'sombre' ? 'dark' : 'light', reducedMotion: reduit ? 'reduce' : 'no-preference' });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    // La voix « existe » (le micro doit alors apparaître) ; rien n'est écouté.
    await pg.addInitScript(() => { window.webkitSpeechRecognition = function () { this.start = () => {}; this.stop = () => {}; this.abort = () => {}; }; });
    await pg.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('[data-demo]', { timeout: 15000 });
    await pg.waitForTimeout(300);
    await pg.screenshot({ path: path.join(SHOTS, `composants-${F}.png`), fullPage: true });
    // Au téléphone, l'écran défile dans un conteneur de la coque : la pleine page s'arrête
    // à l'écran. Les sections du bas sont capturées une à une.
    if (tel) {
      for (const s of ['numero', 'panne', 'montants']) await pg.locator(`[data-demo-${s}]`).screenshot({ path: path.join(SHOTS, `composants-${F}-${s}.png`) }).catch(() => {});
      await pg.evaluate(() => { for (const e of document.querySelectorAll('*')) if (e.scrollTop) e.scrollTop = 0; window.scrollTo(0, 0); });
    }

    // ── Les composants sur la page ─────────────────────────────────────────
    const m = await pg.evaluate(() => {
      const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, x: r.x, y: r.y }; };
      const st = (e, p) => (e ? getComputedStyle(e)[p] : '');
      const fondReel = (e) => { while (e) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; e = e.parentElement; } return 'rgb(255, 255, 255)'; };
      const b = Object.fromEntries([...document.querySelectorAll('[data-b]')].map((e) => [e.getAttribute('data-b'), { ...box(e), fond: st(e, 'backgroundColor'), couleur: st(e, 'color'), busy: e.getAttribute('aria-busy'), dis: e.disabled }]));
      const pv = Object.fromEntries([...document.querySelectorAll('[data-pv]')].map((e) => { const s = e.querySelector('svg'); const r = e.getBoundingClientRect(); const rs = s ? s.getBoundingClientRect() : null;
        return [e.getAttribute('data-pv'), { ...box(e), fond: st(e, 'backgroundColor'), rayon: st(e, 'borderTopLeftRadius'), svg: !!s, centreX: rs ? Math.abs((rs.x + rs.width / 2) - (r.x + r.width / 2)) : 99, centreY: rs ? Math.abs((rs.y + rs.height / 2) - (r.y + r.height / 2)) : 99, texte: e.innerText.trim(), nom: e.getAttribute('aria-label') }]; }));
      const nu = Object.fromEntries([...document.querySelectorAll('[data-nu]')].map((e) => [e.getAttribute('data-nu'), { ...box(e), fond: st(e, 'backgroundColor'), couleur: st(e, 'color'), texte: e.innerText, rayon: st(e, 'borderTopLeftRadius'), num: st(e, 'fontVariantNumeric') }]));
      const cr = Object.fromEntries([...document.querySelectorAll('[data-cr]')].map((e) => [e.getAttribute('data-cr'), { ...box(e), police: parseFloat(st(e.querySelector('input'), 'fontSize')), effacer: box(e.querySelector('[data-champ-recherche-effacer]')), micro: box(e.querySelector('[data-champ-recherche-micro]')), fond: st(e, 'backgroundColor'), bordure: st(e.querySelector('input'), 'borderTopWidth'), fondSaisie: st(e.querySelector('input'), 'backgroundColor'), rayonSaisie: st(e.querySelector('input'), 'borderTopLeftRadius') }]));
      const ep = Object.fromEntries([...document.querySelectorAll('[data-ep]')].map((e) => [e.getAttribute('data-ep'), { boutons: e.querySelectorAll('button').length, bouton: box(e.querySelector('button')), texte: e.innerText }]));
      const seg = [...document.querySelectorAll('[data-demo-segmente] .vrm-seg-btn')].map(box);
      return { b, pv, nu, cr, ep, seg, montants: document.querySelector('[data-montants]').innerText, fondCarte: fondReel(document.querySelector('[data-demo-numero]')),
        deb: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    dit(m.deb <= 0, `${T} aucun débordement horizontal`, m.deb);
    // Bouton
    const cible = tel ? 44 : 32;
    for (const k of ['primaire', 'secondaire', 'danger', 'petit', 'icone', 'occupe']) dit(m.b[k] && m.b[k].h >= cible - 0.5, `${T} Bouton « ${k} » : ${Math.round(m.b[k] && m.b[k].h)} px (≥ ${cible})`, JSON.stringify(m.b[k]));
    dit(m.b.discret && m.b.discret.h >= 44 - 0.5, `${T} Bouton « discret » : zone de 44 px`, m.b.discret && m.b.discret.h);
    const amb = rgb(m.b.danger && m.b.danger.couleur);
    dit(amb && amb.r > amb.b + 80 && amb.g > 40 && amb.g < 200, `${T} Bouton « danger » : texte AMBRE (jamais rouge)`, m.b.danger && m.b.danger.couleur);
    dit(m.b.occupe && m.b.occupe.busy === 'true' && m.b.occupe.dis, `${T} Bouton « occupé » : grisé et aria-busy`);
    // Segmente (sa règle de dessin est le chantier A) : mesuré, dit.
    dit(m.seg.length === 3 && m.seg.every((s) => s.h >= (tel ? 44 : 28) - 0.5), `${T} Segmente : ${m.seg.map((s) => Math.round(s.h)).join('/')} px`, JSON.stringify(m.seg));
    // ChampRecherche
    dit(m.cr.vide && m.cr.vide.h >= (tel ? 44 : 36) - 0.5 && !m.cr.vide.effacer, `${T} ChampRecherche vide : ${Math.round(m.cr.vide && m.cr.vide.h)} px, pas de croix`, JSON.stringify(m.cr.vide));
    dit(m.cr.plein && m.cr.plein.effacer && m.cr.plein.effacer.w >= (tel ? 44 : 36) - 0.5 && m.cr.plein.effacer.h >= (tel ? 44 : 36) - 0.5, `${T} ChampRecherche : la croix d'effacement ${Math.round(m.cr.plein.effacer && m.cr.plein.effacer.w)} px`, JSON.stringify(m.cr.plein));
    dit(m.cr.plein && m.cr.plein.micro && m.cr.plein.micro.h >= (tel ? 44 : 36) - 0.5, `${T} ChampRecherche : le micro intégré (la voix existe)`, JSON.stringify(m.cr.plein && m.cr.plein.micro));
    dit(!tel || (m.cr.vide && m.cr.vide.police >= 16), `${T} ChampRecherche : ${m.cr.vide && m.cr.vide.police} px (iOS ne zoome pas)`, m.cr.vide && m.cr.vide.police);
    dit(m.cr.vide && m.cr.vide.bordure === '0px' && rgb(m.cr.vide.fond) && rgb(m.cr.vide.fond).a > 0, `${T} ChampRecherche : champ teinté, sans bordure (un seul dessin)`, JSON.stringify(m.cr.vide && [m.cr.vide.fond, m.cr.vide.bordure]));
    // Un seul cadre : la saisie elle-même reste transparente et carrée (les règles
    // générales des champs de l'écran la teintaient en seconde boîte, vu au rendu).
    dit(Object.values(m.cr).every((c) => /rgba\(0, 0, 0, 0\)|transparent/.test(c.fondSaisie) && c.rayonSaisie === '0px'), `${T} ChampRecherche : la saisie n'a pas de seconde boîte (fond transparent, rayon 0)`, JSON.stringify(Object.values(m.cr).map((c) => [c.fondSaisie, c.rayonSaisie])));
    // PhotoVide
    for (const [k, w] of [['40', 40], ['56', 56], ['88', 88]]) dit(m.pv[k] && Math.abs(m.pv[k].w - w) < 0.6 && Math.abs(m.pv[k].h - w) < 0.6, `${T} PhotoVide ${k} : ${m.pv[k] && Math.round(m.pv[k].w)} × ${m.pv[k] && Math.round(m.pv[k].h)}`);
    dit(m.pv.remplir && Math.abs(m.pv.remplir.w - 120) < 1 && Math.abs(m.pv.remplir.h - 150) < 1, `${T} PhotoVide « remplir » prend la case`, JSON.stringify(m.pv.remplir));
    const pvs = Object.values(m.pv);
    dit(pvs.every((p) => p.svg && p.centreX < 1 && p.centreY < 1 && !p.texte && p.nom === 'Pas de photo'), `${T} PhotoVide : l'icône centrée, aucun mot, nom lu « Pas de photo »`, JSON.stringify(pvs.map((p) => [p.svg, p.centreX, p.centreY, p.texte])));
    dit(new Set(pvs.map((p) => p.fond)).size === 1 && rgb(pvs[0].fond) && rgb(pvs[0].fond).a === 1, `${T} PhotoVide : un seul fond partout (${pvs[0] && pvs[0].fond})`);
    // Numero
    const fondCarte = rgb(m.fondCarte);
    for (const k of ['normal', 'petit', 'grand', 'doublon', 'verifier']) {
      const n = m.nu[k]; const f = rgb(n && n.fond), c = rgb(n && n.couleur);
      dit(f && c && contraste(f, c) >= 4.5, `${T} Numero « ${k} » : contraste ${f && c ? contraste(f, c).toFixed(1) : '?'}:1`, n && [n.fond, n.couleur].join(' / '));
    }
    const fn = rgb(m.nu.normal && m.nu.normal.fond);
    dit(theme !== 'sombre' || (fn && lum(fn) < 0.2), `${T} Numero : jamais blanche en sombre`, m.nu.normal && m.nu.normal.fond);
    dit(fn && fondCarte && contraste(fn, fondCarte) >= 1.5, `${T} Numero : la pastille se détache de la carte`, `${m.nu.normal && m.nu.normal.fond} sur ${m.fondCarte}`);
    const estRouge = (c) => { const x = rgb(c); return x && x.r > 180 && x.g < 120 && x.b < 120; };
    dit(estRouge(m.nu.doublon && m.nu.doublon.fond) && !['normal', 'petit', 'grand', 'verifier'].some((k) => estRouge(m.nu[k] && m.nu[k].fond)), `${T} Numero : le rouge pour le doublon SEUL`);
    dit(!m.nu.vide && m.nu.normal && m.nu.normal.texte.replace(/\s/g, '') === 'N°124' && /tabular-nums/.test(m.nu.normal.num) && m.nu.normal.rayon === '6px', `${T} Numero : « N°124 », chiffres alignés, rayon 6, un N° absent ne s'écrit pas`, JSON.stringify(m.nu.normal));
    // EtatPanne
    dit(m.ep.bouton && m.ep.bouton.boutons === 1 && /pas su pour l’instant/.test(m.ep.bouton.texte) && /Réessayer/.test(m.ep.bouton.texte) && m.ep.bouton.bouton.h >= (tel ? 44 : 32) - 0.5, `${T} EtatPanne : la phrase, la raison, UN bouton « Réessayer »`, JSON.stringify(m.ep.bouton));
    dit(m.ep.sans && m.ep.sans.boutons === 0 && /Comptes liés/.test(m.ep.sans.texte), `${T} EtatPanne sans relecture : aucun bouton, la raison dit le geste`);
    // (6 nov., finition) L'espace avant la devise est INSÉCABLE (U+00A0), les milliers à l'espace fine (U+202F) : jugé au caractère près.
    dit(m.montants === '65\u00a0€ · 249,50\u00a0€ · 1\u202f234,50\u00a0€ · — · 12,50\u00a0GBP', `${T} montant() : « ${m.montants} » (insécable avant la devise)`);

    // ── Les gestes (une fois par passage) ────────────────────────────────────
    // ChampRecherche : la croix efface et rend le focus.
    await pg.click('[data-cr="plein"] [data-champ-recherche-effacer]');
    const apresEffacer = await pg.evaluate(() => ({ v: document.querySelector('[data-cr="plein"] input').value, focus: document.activeElement === document.querySelector('[data-cr="plein"] input'), croix: !!document.querySelector('[data-cr="plein"] [data-champ-recherche-effacer]') }));
    dit(apresEffacer.v === '' && apresEffacer.focus && !apresEffacer.croix, `${T} ChampRecherche : « Effacer » vide le champ et y rend le focus`, JSON.stringify(apresEffacer));
    // EtatPanne : pendant la relecture, « Lecture en cours… », puis le bouton revient.
    await pg.click('[data-ep="bouton"] button');
    const pendant = await pg.evaluate(() => { const b = document.querySelector('[data-ep="bouton"] button'); return { t: b.innerText, d: b.disabled }; });
    await pg.evaluate(() => window.__relire && window.__relire()); await pg.waitForTimeout(50);
    const apres = await pg.evaluate(() => { const b = document.querySelector('[data-ep="bouton"] button'); return { t: b.innerText, d: b.disabled }; });
    dit(/Lecture en cours/.test(pendant.t) && pendant.d && apres.t === 'Réessayer' && !apres.d, `${T} EtatPanne : « Lecture en cours… » pendant la relecture, puis « Réessayer »`, JSON.stringify([pendant, apres]));

    // ── La feuille ───────────────────────────────────────────────────────────
    await pg.evaluate(() => window.scrollTo(0, 0));
    const img1 = await ouvrirEtMesurer(pg, 'titre');
    const fond1 = rgb(img1 && img1.fond);
    dit(img1 && img1.opacite === 1, `${T} feuille : opacité effective 1 dès la PREMIÈRE image (feuille et ancêtres)`, JSON.stringify(img1));
    dit(fond1 && fond1.a === 1, `${T} feuille : fond OPAQUE dès la première image (${img1 && img1.fond})`, JSON.stringify(img1));
    dit(img1 && img1.dansBody && !img1.dansDemo, `${T} feuille : posée par un PORTAIL sur <body> (hors de l'écran qui l'ouvre)`, JSON.stringify(img1 && [img1.dansBody, img1.dansDemo]));
    if (reduit) dit(img1 && /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/.test(img1.transform), `${T} mouvement réduit : la feuille est EN PLACE dès la première image (aucune glissade)`, img1 && img1.transform);
    else dit(img1 && img1.transform !== 'none' && /matrix/.test(img1.transform), `${T} la feuille monte du bas (transform seul)`, img1 && img1.transform);
    // Reprise en plein mouvement d'entrée : aucun saut.
    if (!reduit && !ANCIEN) {
      // Le doigt se pose sur la poignée LÀ OÙ ELLE EST (même tâche JS : la feuille ne
      // bouge pas entre la mesure et le toucher), puis on relit sa position.
      const prise = await pg.evaluate(() => new Promise((res) => {
        const el = document.querySelector('[data-feuille]'); const z = el.querySelector('[data-feuille-poignee]');
        const pos = () => { const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(el).transform); return m ? Number(m[1].split(',')[5]) : 0; };
        const r = z.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2;
        const ev = (type, cy) => z.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: cy, bubbles: true, cancelable: true }));
        const avant = pos(); ev('pointerdown', y); const juste = pos();
        requestAnimationFrame(() => requestAnimationFrame(() => { const apres = pos(); ev('pointermove', y + 10); const suivi = pos(); ev('pointerup', y + 10); res({ avant, juste, apres, suivi }); }));
      }));
      dit(prise.avant > 0.5 && Math.abs(prise.juste - prise.avant) < 1 && Math.abs(prise.apres - prise.avant) < 1 && Math.abs(prise.suivi - (prise.avant + 10)) < 1,
        `${T} poignée prise EN PLEIN mouvement : elle s'arrête où elle EST (${Math.round(prise.avant)} px), puis suit le doigt (+10 ⇒ ${Math.round(prise.suivi)}) — aucun saut`, JSON.stringify(prise));
    }
    await calme(pg);
    if (!(await feuilleOuverte(pg))) { await pg.click('[data-ouvrir="titre"]'); await calme(pg); }
    if (process.env.BANC_DEBUG) console.log('   corps :', await pg.evaluate(() => [...document.body.children].map((e) => (e.outerHTML || '').slice(0, 300)).join('\n')));
    await pg.screenshot({ path: path.join(SHOTS, `feuille-${F}.png`) });
    const f = await pg.evaluate(() => {
      const el = document.querySelector('[data-feuille]'); const r = el.getBoundingClientRect();
      const croix = el.querySelector('[data-feuille-croix]'); const rc = croix && croix.getBoundingClientRect();
      const z = el.querySelector('[data-feuille-poignee]'); const rz = z && z.getBoundingClientRect();
      // La poignée se prend aussi juste AU-DESSUS du bord (20 px) : on vise 10 px plus haut.
      const auDessus = z ? document.elementFromPoint(r.x + r.width / 2, Math.max(1, r.top - 10)) : null;
      const titre = el.querySelector('.vrm-fs-titre');
      return { haut: r.top, bas: r.bottom, vh: innerHeight, fond: getComputedStyle(el).backgroundColor,
        croix: rc ? { w: rc.width, h: rc.height, cssW: getComputedStyle(croix).width, cssMinW: getComputedStyle(croix).minWidth, svg: !!croix.querySelector('svg'), texte: croix.innerText.trim(), nom: croix.getAttribute('aria-label') } : null,
        poignee: rz ? { h: rz.height } : null, poigneeHaut: !!(auDessus && auDessus.closest && auDessus.closest('[data-feuille-poignee]')),
        titre: titre ? { t: titre.innerText, c: getComputedStyle(titre).color } : null, dialog: el.getAttribute('role') === 'dialog' && el.getAttribute('aria-modal') === 'true' };
    });
    if (process.env.BANC_DEBUG) console.log('   croix :', JSON.stringify(f.croix));
    dit(f.croix && f.croix.w >= 44 && f.croix.h >= 44 && f.croix.svg && !f.croix.texte && f.croix.nom === 'Fermer', `${T} la croix : une ICÔNE, ${f.croix && Math.round(f.croix.w)} × ${f.croix && Math.round(f.croix.h)} px, nommée « Fermer »`, JSON.stringify(f.croix));
    dit(f.poignee && (f.poignee.h + 20) >= 44 && f.poigneeHaut, `${T} la poignée se prend au doigt sur ≥ 44 px (zone ${f.poignee && Math.round(f.poignee.h)} px + 20 au-dessus du bord)`, JSON.stringify([f.poignee, f.poigneeHaut]));
    dit(f.dialog && f.titre && f.titre.t === 'Relier un achat', `${T} la feuille : un dialogue titré`, JSON.stringify(f.titre));
    dit(Math.abs(f.bas - f.vh) < 1, `${T} la feuille est posée en bas, en place`, `${f.bas} / ${f.vh}`);
    // Glissé lent et court : elle revient.
    const zone = await pg.evaluate(() => { const z = document.querySelector('[data-feuille-poignee]'); const r = z.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    if (process.env.BANC_DEBUG) await pg.evaluate(() => { window.__ev = []; for (const t of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture', 'gotpointercapture']) document.addEventListener(t, (e) => window.__ev.push(t + ':' + e.pointerId + ':' + (e.target.className || e.target.tagName)), true); });
    await pg.mouse.move(zone.x, zone.y); await pg.mouse.down();
    for (let i = 1; i <= 6; i++) { await pg.mouse.move(zone.x, zone.y + i * 8); await pg.waitForTimeout(40); }
    const pendantGlisse = await posFeuille(pg);
    await pg.waitForTimeout(120); await pg.mouse.up(); await calme(pg);
    const revenue = await posFeuille(pg);
    const etatGeste = await pg.evaluate(() => { const el = document.querySelector('[data-feuille]'); return el ? el.getAttribute('data-feuille-geste') + ' · ' + el.style.transform + ' · anims ' + document.getAnimations().map((a) => a.playState).join(',') : 'fermée'; });
    if (process.env.BANC_DEBUG) console.log('   evenements :', JSON.stringify(await pg.evaluate(() => window.__ev)));
    dit(pendantGlisse > 40 && (await feuilleOuverte(pg)) && Math.abs(revenue) < 1, `${T} glissé lent de 48 px : la feuille suit le doigt (${Math.round(pendantGlisse)} px) puis revient`, `${pendantGlisse} ⇒ ${revenue} (${etatGeste})`);
    // Tirée vers le haut : elle résiste (élastique), sans s'arrêter net.
    await pg.mouse.move(zone.x, zone.y); await pg.mouse.down();
    for (let i = 1; i <= 4; i++) { await pg.mouse.move(zone.x, zone.y - i * 30); await pg.waitForTimeout(30); }
    const haut = await posFeuille(pg);
    await pg.mouse.up(); await calme(pg);
    dit(haut < -2 && haut > -120, `${T} tirée de 120 px vers le haut : elle résiste (${Math.round(haut)} px)`, haut);
    // Glissé franc : elle part et se ferme.
    await pg.mouse.move(zone.x, zone.y); await pg.mouse.down();
    for (let i = 1; i <= 5; i++) { await pg.mouse.move(zone.x, zone.y + i * 70); await pg.waitForTimeout(12); }
    await pg.mouse.up(); await calme(pg);
    dit(!(await feuilleOuverte(pg)), `${T} glissé franc vers le bas : la feuille se ferme`);
    // La croix ferme ; le voile ferme ; « retour » ferme.
    await pg.click('[data-ouvrir="titre"]'); await calme(pg);
    await pg.click('[data-feuille-croix]').catch(() => {}); await pg.waitForTimeout(150);
    dit(!(await feuilleOuverte(pg)), `${T} la croix ferme la feuille`);
    await pg.click('[data-ouvrir="titre"]'); await calme(pg);
    await pg.mouse.click(tel ? 195 : 756, 40); await pg.waitForTimeout(150);
    dit(!(await feuilleOuverte(pg)), `${T} toucher le voile ferme la feuille`);
    await pg.click('[data-ouvrir="titre"]'); await calme(pg);
    await pg.goBack().catch(() => {}); await pg.waitForTimeout(200);
    dit(!(await feuilleOuverte(pg)), `${T} « retour » ferme la feuille (FermeAuRetour)`);
    // La variante lumineuse : blanche, même en sombre.
    const imgL = await ouvrirEtMesurer(pg, 'lumineuse');
    await calme(pg);
    const L = await pg.evaluate(() => { const el = document.querySelector('[data-feuille]'); const t = el.querySelector('.vrm-fs-titre'); const c = el.querySelector('[data-code]'); const n = el.querySelector('.vrm-num');
      return { fond: getComputedStyle(el).backgroundColor, titre: getComputedStyle(t).color, code: getComputedStyle(c).color, num: n ? getComputedStyle(n).backgroundColor : '' }; });
    await pg.screenshot({ path: path.join(SHOTS, `feuille-lumineuse-${F}.png`) });
    dit(L.fond === 'rgb(255, 255, 255)' && lum(rgb(L.titre)) < 0.05 && lum(rgb(L.code)) < 0.05, `${T} « En grand » : blanc forcé, encre foncée (${L.fond}, titre ${L.titre})`, JSON.stringify(L));
    dit(imgL && imgL.opacite === 1 && rgb(imgL.fond) && rgb(imgL.fond).a === 1, `${T} « En grand » : opaque dès la première image`, JSON.stringify(imgL));
    await pg.click('[data-feuille-croix]').catch(() => {}); await pg.waitForTimeout(150);

    dit(!errs.length, `${T} aucune erreur dans la page`, errs.join(' | '));
    await ctx.close();
  }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} composants : ${ok} ✅ · ${ko} ❌ — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
