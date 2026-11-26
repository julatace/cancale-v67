// ════════════════════════════════════════════════════════════════════════
//  BANC « DEPUIS TA DERNIÈRE VISITE » COMME UN JEU (25 nov., Julien : « change l'affichage du pop up message, ça doit
//  faire mieux, jeu vidéo » — capture : « 3 messages » puis trois lignes identiques « Nouveau message · Vinted · il y a 12 min »).
//
//  Le VRAI composant `src/capteNotif/FeuilleArrivee.jsx` (ses vraies règles `arrivee.js` et `details.js`, la vraie `Feuille`,
//  les vrais textes `tr()`, les vraies icônes d'ICON_PATHS) assemblé par esbuild. Données SYNTHÉTIQUES seulement : le journal
//  `capte_journal_*` à la forme réelle `{ id, e }`, et les copies captées servies par `lireCopie(compte, ou)` à la forme rangée
//  par l'extension (`alleger('inbox')` : id, description, unread, opposite_user { id, login, photo { url } }, item_photos [{ url }] ;
//  `commandeMaigre` : transaction_id, title, price, photo). Les photos « Vinted » sont des photos d'exemple de l'app (public/exemple/).
//  Il juge (390 tactile et 1512, clair et sombre) :
//   A. ce qui est CONNU s'affiche : pseudo, photo de profil, photo de l'article, extrait (conversation non lue), offre, titre et
//      prix d'une vente ; ce qui ne l'est pas ne s'affiche PAS (conversation lue ⇒ pas d'extrait ; inconnue ⇒ pas de pseudo) ;
//   B. par IDENTITÉ seulement : la boîte d'un AUTRE compte qui a le même n° ne donne rien ; deux conversations sous le même n° ⇒ rien ;
//   C. plus jamais N lignes identiques : trois messages dont on ne sait rien, même compte ⇒ UNE ligne « 3 messages » ;
//   D. le compteur « tombe » de 0 à N ; les cartes arrivent en cascade ; toucher une carte ⇒ SA conversation, la feuille se ferme,
//      « vu » posé ; « Tout vu » ⇒ éclat (confettis, coche), « vu » posé au toucher, puis la feuille se ferme ;
//   E. `prefers-reduced-motion` ⇒ aucune animation (document.getAnimations() vide), même contenu, « Tout vu » ferme aussitôt ;
//   F. lecteur des copies en panne ⇒ la feuille s'affiche quand même, lignes nues regroupées ; cibles ≥ 44 px, rien ne déborde.
//  Captures (390/1512, clair/sombre) et films (une image toutes les ~60 ms de l'ouverture et du « Tout vu ») : `SHOTS`.
//  `BANC_MUTANT=identite|extrait|regroupe|reduit` : la règle affaiblie ⇒ rouge.
// ════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const { execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..', '..');
const NM = [path.join(RACINE, 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const PORT = Number(process.env.BANC_PORT) || 8774;
const MUTANT = process.env.BANC_MUTANT || '';
const FILM = process.env.BANC_FILM !== '0';
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-feuille-retour-jeu');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d != null && d !== '' ? '  → ' + String(d).slice(0, 400) : '')); } };
const MUTATIONS = {
  // le détail pris par ressemblance : la première conversation de N'IMPORTE QUEL compte au même n°, même s'il y en a deux
  identite: ['capteNotif/details.js', '    if (memes.length !== 1) return;', '    if (!memes.length) return;'],
  // l'extrait de la boîte affiché même quand la conversation est lue (le dernier mot peut être le sien)
  extrait: ['capteNotif/details.js', '  if (c.unread === true) {', '  if (true) {'],
  // plus de regroupement : une ligne par entrée nue (les lignes identiques de la capture)
  regroupe: ['capteNotif/details.js', '    if (lots.has(k)) { lots.get(k).entrees.push(e); continue; }', '    if (false) { continue; }'],
  // l'animation n'écoute plus `prefers-reduced-motion`
  reduit: ['capteNotif/capte.css', '@media (prefers-reduced-motion: no-preference) {\n  /* L\'entrée', '@media all {\n  /* L\'entrée'],
};

async function construire() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feuille-retour-jeu-'));
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/);
  fs.writeFileSync(path.join(dir, 'icones.gen.jsx'), "import React from 'react';\nexport " + m[0] + '\n');
  fs.writeFileSync(path.join(dir, 'entree.jsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import FeuilleArrivee from ${JSON.stringify(path.join(RACINE, 'src', 'capteNotif', 'FeuilleArrivee.jsx'))};
import { brancherExtensionCapte } from ${JSON.stringify(path.join(RACINE, 'src', 'capteNotif', 'regle.js'))};
import { poserIcone } from ${JSON.stringify(path.join(RACINE, 'src', 'natif', 'icones.jsx'))};
import { ajouterSourceApp } from ${JSON.stringify(path.join(RACINE, 'src', 'i18n', 'index.js'))};
import frApp from ${JSON.stringify(path.join(RACINE, 'src', 'i18n', 'langues', 'fr.js'))};
import { ICON_PATHS } from './icones.gen.jsx';
ajouterSourceApp(frApp);
poserIcone(({ name, size = 24 }) => { const d = ICON_PATHS[name]; if (!d) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; });
brancherExtensionCapte({ coupe: () => false, regler: async () => ({ ok: true }) });
window.__allers = [];
window.addEventListener('vrm:aller', (e) => window.__allers.push(e.detail));
window.__nuage = Object.assign({}, window.__nuageInit || {});
window.__saves = [];
window.__copies = [];
const load = (k, d) => (k in window.__nuage ? window.__nuage[k] : d);
const save = (k, v) => { window.__nuage[k] = v; window.__saves.push([k, v, performance.now()]); };
const lire = async () => window.__rows;
const lireCopie = async (compte, ou) => { window.__copies.push(compte + '|' + ou); if (window.__copiesPanne) throw new Error('panne'); const c = window.__copiesInit || {}; return (c[compte] && c[compte][ou]) || null; };
createRoot(document.getElementById('r')).render(<div><main style={{ padding: 20 }}><h1>Ventes</h1>{Array.from({ length: 20 }, (_, i) => <p key={i}>Ligne {i}</p>)}</main>
  <FeuilleArrivee pret lire={lire} load={load} save={save} onCloudReady={() => () => {}} nomCompte={(p, c) => (c === '111' ? 'shop_test' : '')} exclu={() => false}
    lireCopie={lireCopie} feuilleOuverte={() => false} abonnerFeuilles={() => () => {}}/></div>);
`);
  const mutant = MUTANT && MUTATIONS[MUTANT];
  if (MUTANT && !mutant) throw Error('mutant inconnu : ' + MUTANT);
  const plugins = mutant ? [{ name: 'mutant', setup(b) {
    b.onLoad({ filter: new RegExp(mutant[0].replace(/[./]/g, (c) => '\\' + c) + '$') }, (a) => {
      let t = fs.readFileSync(a.path, 'utf8');
      if (!t.includes(mutant[1])) throw Error('mutation introuvable : ' + MUTANT);
      t = t.replace(mutant[1], mutant[2]);
      return { contents: t, loader: a.path.endsWith('.css') ? 'css' : 'jsx' };
    });
  } }] : [];
  await esbuild.build({ entryPoints: [path.join(dir, 'entree.jsx')], bundle: true, outdir: path.join(dir, 'out'), format: 'esm', jsx: 'automatic', plugins, external: ['/brands/*'],
    loader: { '.js': 'jsx', '.svg': 'dataurl', '.png': 'dataurl', '.woff2': 'dataurl' }, nodePaths: [NM], logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{"MODE":"production","PROD":true,"DEV":false}' } });
  fs.writeFileSync(path.join(dir, 'out', 'index.html'), '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/entree.css"></head><body style="margin:0;font-family:-apple-system,system-ui,sans-serif"><div id="r"></div><script type="module" src="/entree.js"></script></body></html>');
  return path.join(dir, 'out');
}

// ── Les données SYNTHÉTIQUES (aucune donnée réelle) ──
const T0 = Date.now(), MIN = 60000;
const IMG = (n) => `https://images1.vinted.net/t/banc-${n}/f800/photo.webp`;
const EX = { 'photo-a': 'nike-air-max-90-blanche-120.webp', 'photo-b': 'adidas-campus-00s-marron-120.webp', 'avatar-a': 'adidas-forum-low-blanche-120.webp', 'photo-c': 'adidas-handball-spezial-noire-120.webp' };
const E = (c, s, id, minutes) => ({ p: 'vinted', c, s, id, t: T0 - minutes * MIN });
const JOURNAL = [{ id: 'capte_journal_aaaaaaaaaaaaaaaa', e: [
  E('111', 'messages', '7001@2026', 3), E('111', 'messages', '7002@2026', 5),
  E('111', 'messages', '7003@2026', 12), E('111', 'messages', '7004@2026', 12), E('111', 'messages', '7005@2026', 12),
  E('111', 'offres', '7006:o1', 8), E('111', 'ventes', '91001', 20), E('111', 'achats', '92001', 40),
] }];
const conv = (id, login, desc, unread, photo, avatar) => ({ id, description: desc, unread, updated_at: new Date(T0 - 2 * MIN).toISOString(),
  opposite_user: login ? { id: 5000 + id, login, photo: avatar ? { url: avatar } : null } : null, item_photos: photo ? [{ url: photo }] : null });
const COPIES = {
  '111': {
    inbox: [conv(7001, 'acheteuse_lyon', 'Bonjour, elle taille grand ?', true, IMG('photo-a'), IMG('avatar-a')), conv(7002, 'marc.b', 'Merci, je regarde ça', false, null, null),
      conv(7006, 'paul_75', '45 €', true, IMG('photo-c'), null),
      // deux conversations sous le même n° 7005 (forme cassée) : rien n'est affirmé
      conv(7005, 'double_a', 'A', true, null, null), conv(7005, 'double_b', 'B', true, null, null)],
    sold: [{ transaction_id: 91001, title: 'Nike Air Max 90 blanche 42', price: { amount: '80.0', currency_code: 'EUR' }, photo: { url: IMG('photo-b') } }],
    purchased: [],
  },
  // un AUTRE compte qui a une conversation au n° 7003 : jamais prise pour celle du compte 111
  '222': { inbox: [conv(7003, 'intrus_autre_compte', 'Ne doit jamais apparaître', true, IMG('photo-a'), IMG('avatar-a'))] },
};
const N = JOURNAL[0].e.length;
const VU = { vrm_capte_vu: { at: T0 - 120 * MIN } };

const lire = (pg) => pg.evaluate(() => {
  const f = document.querySelector('[data-capte-arrivee]');
  const vis = (el) => !!(el && el.getClientRects().length);
  const ctl = f ? Array.from(f.querySelectorAll('button, a[href]')).filter(vis) : [];
  const cartes = Array.from(document.querySelectorAll('.vrm-arr-carte'));
  const img = (el, sel) => { const i = el.querySelector(sel); return i ? (i.complete && i.naturalWidth > 0 ? 'ok' : 'pas-chargee') : 'absente'; };
  return { vis: !!f && vis(f), n: f ? Number(f.getAttribute('data-capte-arrivee')) : 0,
    textes: cartes.map((c) => c.innerText.replace(/\s+/g, ' ').trim()),
    cartes: cartes.map((c) => ({ ligne: c.getAttribute('data-capte-ligne'), lot: c.getAttribute('data-capte-lot'), n: c.getAttribute('data-n'), lien: c.getAttribute('data-capte-lien'),
      pseudo: c.getAttribute('data-capte-pseudo'), carte: c.hasAttribute('data-capte-carte'), photo: img(c, '[data-capte-photo-img]'), avatar: img(c, '[data-capte-avatar-img]'),
      second: (c.querySelector('[data-capte-second]') || {}).innerText || '', titre: (c.querySelector('.vrm-arr-titre') || {}).innerText || '',
      nouveau: !!c.querySelector('.vrm-arr-nouveau') })),
    compteur: (() => { const c = document.querySelector('[data-capte-compteur]'); return c ? { fin: Number(c.getAttribute('data-capte-compteur')), v: Number(c.textContent) } : null; })(),
    petits: ctl.filter((b) => b.getBoundingClientRect().height < 44).map((b) => (b.innerText || b.getAttribute('aria-label') || '').slice(0, 20) + ':' + Math.round(b.getBoundingClientRect().height)),
    allers: window.__allers.slice(), saves: window.__saves.map((s) => [s[0], s[1]]), ici: localStorage.getItem('vrm_capte_vu_ici'), debord: document.documentElement.scrollWidth > window.innerWidth,
    confettis: !!document.querySelector('[data-n-confettis]'), eclat: !!document.querySelector('.vrm-arr-pied[data-eclat]'),
    animations: document.getAnimations().length, copies: window.__copies.slice() };
});

(async () => {
  const out = await construire();
  const srv = http.createServer((q, r) => { const f = path.join(out, q.url === '/' ? 'index.html' : q.url.split('?')[0]); if (!fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); r.end(fs.readFileSync(f)); });
  await new Promise((ok2) => srv.listen(PORT, ok2));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const ouvrir = async (W, Hh, mobile, scheme, init, { reduit = false, attendre = 1900 } = {}) => {
    const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, reducedMotion: reduit ? 'reduce' : 'no-preference', viewport: { width: W, height: Hh } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
    const pg = await ctx.newPage();
    const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
    // Les photos « Vinted » synthétiques : des photos d'exemple de l'app, servies ici (jamais Internet).
    await pg.route(/^https:\/\/images1\.vinted\.net\//, (route) => { const k = (/banc-([a-z-]+)\//.exec(route.request().url()) || [])[1]; const f = EX[k] && path.join(RACINE, 'public', 'exemple', EX[k]);
      if (!f || !fs.existsSync(f)) return route.fulfill({ status: 404, body: '' }); return route.fulfill({ status: 200, contentType: 'image/webp', body: fs.readFileSync(f) }); });
    await pg.addInitScript((o) => { window.__rows = o.rows; window.__nuageInit = o.nuage; window.__copiesInit = o.copies; window.__copiesPanne = !!o.panne;
      if (o.sombre) { const poser = () => document.documentElement && document.documentElement.setAttribute('data-theme', 'dark'); if (document.documentElement) poser(); else document.addEventListener('readystatechange', poser, { once: true }); } }, init);
    await pg.goto(`http://127.0.0.1:${PORT}/`);
    if (attendre) await pg.waitForTimeout(attendre);
    return { ctx, pg, erreurs };
  };
  const film = async (pg, nom, n = 16) => {
    const dossier = path.join(SHOTS, 'film-' + nom); fs.rmSync(dossier, { recursive: true, force: true }); fs.mkdirSync(dossier, { recursive: true });
    const t0 = Date.now(); const temps = [];
    for (let i = 0; i < n; i++) { await pg.screenshot({ path: path.join(dossier, String(i).padStart(2, '0') + '.png') }); temps.push(Date.now() - t0); const reste = (i + 1) * 60 - (Date.now() - t0); if (reste > 0) await pg.waitForTimeout(reste); }
    try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '16', '-i', path.join(dossier, '%02d.png'), '-vf', 'scale=390:-1:flags=lanczos', path.join(SHOTS, 'film-' + nom + '.gif')]); } catch (_) {}
    try { execFileSync('convert', [...fs.readdirSync(dossier).sort().map((f) => path.join(dossier, f)), '-resize', '25%', '+append', path.join(SHOTS, 'film-' + nom + '-planche.png')]); } catch (_) {}
    return temps;
  };
  try {
    for (const [W, Hh, mobile] of [[390, 844, true], [1512, 900, false]]) for (const scheme of ['light', 'dark']) {
      const T = `${W} ${scheme}`; console.log('\n' + T);
      const sombre = scheme === 'dark';
      // ── Ouverture : le film d'abord (avant toute attente), puis le contenu.
      let t = await ouvrir(W, Hh, mobile, scheme, { rows: JOURNAL, nuage: VU, copies: COPIES, sombre }, { attendre: 0 });
      await t.pg.waitForSelector('[data-capte-arrivee]', { timeout: 8000 }).catch(() => {});
      let tot = await t.pg.evaluate(() => { const c = document.querySelector('[data-capte-compteur]'); return c ? Number(c.textContent) : null; });
      if (FILM && W === 390) await film(t.pg, 'ouverture-' + scheme); else await t.pg.waitForTimeout(900);
      let a = await lire(t.pg);
      await t.pg.screenshot({ path: path.join(SHOTS, `retour-${W}-${scheme}.png`) });
      await t.pg.evaluate(() => { const f = document.querySelector('.n-feuille'); const p = f && f.querySelector('.n-feuille-poignee'); if (p) p.click(); });
      await t.pg.waitForTimeout(450);
      await t.pg.screenshot({ path: path.join(SHOTS, `retour-${W}-${scheme}-pleine.png`) });
      const carte = (pseudo) => a.cartes.find((c) => c.pseudo === pseudo);
      const c1 = carte('acheteuse_lyon'), c2 = carte('marc.b'), co = carte('paul_75');
      dit(a.vis && a.n === N, `${T} : la feuille s’ouvre avec ${N} nouveautés`, JSON.stringify({ vis: a.vis, n: a.n }));
      dit(!!c1 && c1.photo === 'ok' && c1.avatar === 'ok' && /elle taille grand/.test(c1.second) && /cible=conv&conv=7001/.test(c1.lien) && /compte=111/.test(c1.lien),
        `${T} A : message connu ⇒ pseudo, photo de profil, photo de l’article, extrait, et SA conversation`, JSON.stringify(c1));
      dit(!!c2 && !/Merci/.test(c2.second) && c2.second === 'Nouveau message' && c2.photo === 'absente' && c2.avatar === 'absente', `${T} A : conversation LUE ⇒ pseudo et « Nouveau message », aucun extrait (le dernier mot peut être le sien), aucune photo inventée`, JSON.stringify(c2));
      dit(!!co && /Offre\s*:\s*45/.test(co.second) && co.photo === 'ok', `${T} A : offre non lue ⇒ « Offre : 45 € » et la photo de l’article`, JSON.stringify(co));
      const cv = a.cartes.find((c) => c.ligne === 'ventes');
      dit(!!cv && cv.carte && /Nike Air Max 90 blanche 42/.test(cv.titre) && /Nouvelle vente/.test(cv.second) && /80/.test(cv.second) && cv.photo === 'ok' && /tx=91001/.test(cv.lien),
        `${T} A : vente ⇒ la photo, le titre et le prix de CETTE commande (n° de transaction)`, JSON.stringify(cv));
      const ca = a.cartes.find((c) => c.ligne === 'achats');
      dit(!!ca && !ca.carte && ca.titre === 'Nouvel achat' && ca.photo === 'absente', `${T} A : achat inconnu des copies ⇒ ligne nue, rien d’inventé`, JSON.stringify(ca));
      dit(!a.textes.some((x) => /intrus_autre_compte|Ne doit jamais/.test(x)) && !a.textes.some((x) => /double_a|double_b/.test(x)),
        `${T} B : la boîte d’un AUTRE compte au même n° ne donne rien ; deux conversations sous un même n° ⇒ rien`, JSON.stringify(a.textes));
      const lot = a.cartes.find((c) => c.lot === 'messages');
      dit(!!lot && lot.n === '3' && /3 messages/.test(lot.titre), `${T} C : trois messages dont on ne sait rien (même compte) ⇒ UNE ligne « 3 messages »`, JSON.stringify(a.cartes.map((c) => c.titre)));
      dit(new Set(a.textes).size === a.textes.length, `${T} C : aucune ligne identique à une autre`, JSON.stringify(a.textes));
      dit(a.cartes.length > 0 && a.cartes.every((c) => c.nouveau), `${T} : pastille « NOUVEAU » sur chaque carte`);
      dit(tot !== null && tot < N && a.compteur && a.compteur.v === N, `${T} D : le compteur part de ${tot} et tombe sur ${N}`, JSON.stringify({ tot, c: a.compteur }));
      dit(a.petits.length === 0 && !a.debord, `${T} F : cibles ≥ 44 px, rien ne déborde`, JSON.stringify(a.petits));
      dit(t.erreurs.length === 0, `${T} : aucune erreur de page`, JSON.stringify(t.erreurs));
      await t.ctx.close();
      // ── Toucher une carte : SA conversation, la feuille se ferme, « vu » posé.
      t = await ouvrir(W, Hh, mobile, scheme, { rows: JOURNAL, nuage: VU, copies: COPIES, sombre });
      await t.pg.click('[data-capte-pseudo="acheteuse_lyon"]');
      await t.pg.waitForTimeout(500);
      a = await lire(t.pg);
      dit(!a.vis && a.allers.length === 1 && /cible=conv&conv=7001/.test(a.allers[0]) && a.saves.some(([k, v]) => k === 'vrm_capte_vu' && v && v.at === T0 - 3 * MIN),
        `${T} D : toucher la carte ⇒ SA conversation, la feuille se ferme, « vu » posé`, JSON.stringify({ vis: a.vis, al: a.allers, s: a.saves }));
      await t.ctx.close();
      // ── « Tout vu » : l'éclat, « vu » posé au toucher, puis la feuille se ferme.
      t = await ouvrir(W, Hh, mobile, scheme, { rows: JOURNAL, nuage: VU, copies: COPIES, sombre });
      await t.pg.click('[data-capte-arrivee-vu]');
      a = await lire(t.pg);
      const pendant = { vis: a.vis, confettis: a.confettis, eclat: a.eclat, vu: a.saves.some(([k, v]) => k === 'vrm_capte_vu' && v && v.at === T0 - 3 * MIN) };
      if (FILM && W === 390) await film(t.pg, 'tout-vu-' + scheme, 12); else await t.pg.waitForTimeout(800);
      a = await lire(t.pg);
      dit(pendant.vis && pendant.confettis && pendant.eclat && pendant.vu && !a.vis && a.allers.length === 0,
        `${T} D : « Tout vu » ⇒ éclat (confettis + coche), « vu » posé au toucher, puis la feuille se ferme`, JSON.stringify({ pendant, apres: a.vis }));
      await t.ctx.close();
    }
    // ── E. Mouvement réduit : aucune animation, même contenu, « Tout vu » ferme aussitôt.
    console.log('\nmouvement réduit');
    let t = await ouvrir(390, 844, true, 'light', { rows: JOURNAL, nuage: VU, copies: COPIES }, { reduit: true, attendre: 0 });
    await t.pg.waitForSelector('[data-capte-arrivee]', { timeout: 8000 }).catch(() => {});
    const tot = await t.pg.evaluate(() => { const c = document.querySelector('[data-capte-compteur]'); return c ? Number(c.textContent) : null; });
    await t.pg.waitForTimeout(700);
    let a = await lire(t.pg);
    dit(tot === N && a.compteur && a.compteur.v === N, 'E : le compteur affiche N d’emblée', JSON.stringify({ tot, c: a.compteur }));
    dit(a.animations === 0, 'E : aucune animation (document.getAnimations() vide après l’ouverture)', a.animations);
    const anim = await t.pg.evaluate(() => Array.from(document.querySelectorAll('.vrm-arr-carte, .vrm-arr-medaille, .vrm-arr-nouveau')).map((el) => getComputedStyle(el).animationName).filter((x) => x && x !== 'none'));
    dit(anim.length === 0, 'E : ni cascade, ni médaille, ni pastille animées', JSON.stringify(anim));
    dit(a.cartes.some((c) => c.pseudo === 'acheteuse_lyon' && /elle taille grand/.test(c.second)) && a.cartes.some((c) => c.lot === 'messages'), 'E : même contenu (pseudo, extrait, lot)');
    await t.pg.screenshot({ path: path.join(SHOTS, 'retour-390-reduit.png') });
    await t.pg.click('[data-capte-arrivee-vu]');
    a = await lire(t.pg);
    await t.pg.waitForTimeout(60);
    const apres = await lire(t.pg);
    dit(!a.confettis && !apres.vis && apres.saves.some(([k]) => k === 'vrm_capte_vu'), 'E : « Tout vu » ferme aussitôt, sans confettis, « vu » posé', JSON.stringify({ c: a.confettis, vis: apres.vis }));
    await t.ctx.close();
    // ── F. Copies illisibles : la feuille s'affiche quand même, nue et regroupée (le cas de la capture de Julien).
    console.log('\ncopies en panne');
    t = await ouvrir(390, 844, true, 'light', { rows: JOURNAL, nuage: VU, copies: COPIES, panne: true });
    a = await lire(t.pg);
    await t.pg.screenshot({ path: path.join(SHOTS, 'retour-390-sans-details.png') });
    const lotP = a.cartes.find((c) => c.lot === 'messages');
    dit(a.vis && a.n === N && !a.cartes.some((c) => c.carte) && !!lotP && lotP.n === '5' && new Set(a.textes).size === a.textes.length,
      'F : copies illisibles ⇒ feuille quand même, lignes nues, les 5 messages du même compte en UNE ligne, aucune ligne identique', JSON.stringify(a.textes));
    dit(t.erreurs.length === 0, 'F : aucune erreur de page', JSON.stringify(t.erreurs));
    await t.ctx.close();
  } finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ feuille-retour-jeu : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ feuille-retour-jeu : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})();
