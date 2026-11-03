// ════════════════════════════════════════════════════════════════════════════
//  BANC — « Messages aux favoris », écran « Fusion » (3 novembre 2026)
//
//  Julien (3 nov., 10 h 16) : « fais une meilleure interface pour les messages
//  aux favoris » — premium, peu de couleur, AUCUN texte explicatif, des photos,
//  « article » et pas « paire ». Ce banc MONTE le vrai `src/FavorisVinted.jsx`
//  (ModeAutoFavoris, CarteMois, la feuille d'envoi, le moteur) avec les vraies
//  feuilles de style (celles de src/main.jsx, dans l'ordre) et la palette de
//  src/themeMineral.js, en clair ET en sombre, à 390 px tactile et à 1512 px.
//  Les réponses ont la FORME RÉELLE mesurée en lecture seule le 3 nov. : une
//  notification de favori n'a PAS d'`actor` ; « <pseudo> a marqué ton article
//  <titre> comme favori » ; `image.url` = la photo de l'article ; lien
//  « /items/<id>/want_it/new?offering_id=<n> ». Toutes les données sont INVENTÉES.
//
//  Il juge, sur des data-* et des nombres :
//   1. la carte sombre : N favoris de la période, « sur N articles », les cases
//      envoyés · vendus · en attente ; l'interrupteur du mode auto (freiné ⇒ la
//      ligne dit jusqu'à quand et pourquoi ; bloqué ⇒ le geste, en ambre) ;
//   2. « Ton message » : le VRAI texte, variables remplacées par le pseudo d'un
//      favori réel (jamais « {username} » à l'écran), l'offre dite ;
//   3. UNE carte par ARTICLE (par /items/<id>) : photo, titre, N°, prix, la pile
//      des initiales (chacune = la 1re lettre d'un pseudo écrit par Vinted ;
//      illisible ⇒ rond vide, jamais un nom inventé), UNE puce juste, UN geste ;
//   4. « Envoyer » choisit les favoris de CET article et ouvre la feuille d'envoi
//      — RIEN n'est lancé ni envoyé sans « Lancer » (aucun POST `lancer`) ;
//   5. le détail d'un article (feuille) : une ligne par personne, son état ;
//   6. aucun mot technique, aucun emoji, jamais « paire », cibles ≥ 44 px au
//      doigt, aucune couleur saturée hors du bleu d'Apple et de l'ambre, aucun
//      débordement, colonne ≤ 760 px sur ordinateur ;
//   7. « Modifier » ouvre le message, « Enregistrer » le sauve sans rien envoyer.
//
//  FAV_JEU = base (défaut) · vide (0 favori) · un (1 favori) · gros (300 favoris
//  sur 80 articles) · longs (titres de 160 caractères, pseudos de 40) · sansphoto ·
//  bloque (mode auto allumé, bloqué : un geste demandé). FAV_THEME = clair · sombre
//  (défaut : les deux). FAV_MUTANT = envoi · etat · nom (§6.1 : chacune doit
//  rendre le banc rouge). Variable RACINE : l'arbre à juger.
//  `node scripts/bancs/favoris-ecran.cjs` (esbuild, pas Vite).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = process.env.RACINE || path.join(__dirname, '..', '..');
const NM = [path.join(RACINE, 'node_modules'), path.join(__dirname, '..', '..', 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const JEU = process.env.FAV_JEU || 'base';
const THEMES = process.env.FAV_THEME ? [process.env.FAV_THEME] : ['clair', 'sombre'];
const MUTANT = process.env.FAV_MUTANT || '';
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-favoris-ecran');
fs.mkdirSync(SHOTS, { recursive: true });

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? '  → ' + String(d).slice(0, 400) : '')); } };

const OWNER = '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c', UID = '4242';
const MAINT = Date.parse('2026-11-03T15:00:00Z');
const H = 3600000, J = 24 * H;
const iso = (t) => new Date(t).toISOString();
const PAUSE = MAINT + 5 * H;
const MESSAGE = 'Salut {username}, merci pour ton favori ! Je te fais un prix.';
// Un favori inventé, à la forme réelle : [id, pseudo, item, âge].
let FAV, TITRES, PRIX = {}, SANS_PHOTO = new Set(), JOBS = [], JOURNAL = [], VENDUS = [], AUTO_DEMANDE = null, PAUSE_ACTIVE = true;
if (JEU === 'vide') { FAV = []; TITRES = {}; }
else if (JEU === 'un') { FAV = [['n1', 'lea_sneakers', 9001, 2 * H]]; TITRES = { 9001: 'Nike Air Max 90 blanche' }; PRIX = { 9001: 65 }; }
else if (JEU === 'gros') {
  FAV = []; TITRES = {};
  for (let a = 0; a < 80; a++) TITRES[9100 + a] = ['Salomon XT-6', 'Nike Air Max 1', 'Sac Longchamp Le Pliage', 'Adidas Samba', 'New Balance 990v6'][a % 5] + ' n° ' + (a + 1);
  for (let i = 0; i < 300; i++) FAV.push(['g' + i, 'membre_' + i, 9100 + ((i * 7) % 80), (i % 28) * J + (i % 23) * H]);
  for (let a = 0; a < 80; a += 3) PRIX[9100 + a] = 40 + a;
  JOBS = FAV.filter((_, i) => i % 9 === 0).map(([id, , item], k) => ({ id: item + ':' + (5000 + k), notificationId: id, etat: 'envoye', lot: 'l1', traiteLe: MAINT - 30 * H, envoyeLe: MAINT - 30 * H, ...(k % 2 ? { ecrits: 3 } : { ecrits: 2 }) }));
  VENDUS = ['9105', '9110'];
} else {
  const L = JEU === 'longs';
  const p = (x) => (L ? (x + '_' + 'x'.repeat(40)).slice(0, 40) : x);
  FAV = [
    ['n1', p('lea_sneakers'), 9001, 9 * H], ['n2', p('hugo.b'), 9002, 8 * H], ['n3', p('ines_75'), 9003, 1 * H],
    ['n4', p('tom-run'), 9004, 3 * H], ['n5', p('zoe_k'), 9005, 5 * H], ['n6', p('paulo92'), 9006, 6 * H],
    ['n7', p('emma.vint'), 9007, 7 * H], ['n8', p('noe_shop'), 9008, 2 * H], ['n9', p('jade.m'), 9009, 26 * H],
    ['n10', p('lina_l'), 9003, 30 * 60000], ['n11', p('max.r'), 9003, 4 * H], ['n12', p('sam_b'), 9001, 3 * H],
    ['n13', '', 9008, 50 * 60000], ['n14', p('ancien'), 9010, 40 * J],
  ];
  const T = { 9001: 'Nike Air Max 90 blanche', 9002: 'Adidas Samba noire', 9003: 'New Balance 550 verte', 9004: 'Asics Gel-Lyte III', 9005: 'Jordan 1 Mid bleue', 9006: 'Puma Suede rouge', 9007: 'Sac Longchamp Le Pliage noir', 9008: 'Converse Chuck 70', 9009: 'Reebok Club C', 9010: 'Vans Old Skool' };
  TITRES = L ? Object.fromEntries(Object.entries(T).map(([k, v]) => [k, (v + ' édition limitée collaboration très longue description ').repeat(4).slice(0, 160)])) : T;
  PRIX = { 9001: 65, 9002: 80, 9003: 95, 9005: 120, 9007: 45 };
  if (JEU === 'sansphoto') SANS_PHOTO = new Set(Object.keys(T).map(Number));
  JOBS = [
    { id: '9001:1001', notificationId: 'n1', etat: 'envoye', lot: 'l1', traiteLe: MAINT - 4 * H, envoyeLe: MAINT - 4 * H, ecrits: 3 },
    { id: '9006:1006', notificationId: 'n6', etat: 'incertain', lot: 'l1', raison: 'reponse_inconnue' },
    { id: '9007:1007', notificationId: 'n7', etat: 'refuse', lot: 'l1', raison: 'offre_refusee' },
    { id: '9009:1009', notificationId: 'n9', etat: 'envoye', lot: 'l0', traiteLe: MAINT - 20 * H, envoyeLe: MAINT - 20 * H },
  ];
  JOURNAL = [
    { at: MAINT - 7 * H, notificationId: 'n2', etat: 'saute', raison: 'conversation_existante' },
    { at: MAINT - 4 * H, notificationId: 'n5', etat: 'saute', raison: 'destinataire_non_prouve' },
  ];
  VENDUS = ['9004'];
  if (JEU === 'bloque') { AUTO_DEMANDE = { code: 'dressing_ancien', at: MAINT - H }; PAUSE_ACTIVE = false; }
}
// Le corps tel que Vinted l'écrit ; un pseudo vide ⇒ une phrase sans pseudo lisible.
const corps = (login, item) => (login ? `${login} a marqué ton article ${(TITRES[item] || 'article').toLowerCase()} comme favori` : `Quelqu’un a marqué ton article ${(TITRES[item] || '').toLowerCase()} comme favori`);
const NOTIFS = FAV.map(([id, login, item, age], k) => ({ id, body: corps(login, item), user_id: 1000 + k, link: `/items/${item}/want_it/new?offering_id=${7000 + k}`, ...(SANS_PHOTO.has(item) ? {} : { image: { url: `https://images1.vinted.net/t/b${item}/f800/photo.jpeg?s=x` } }), updated_at: iso(MAINT - age) }));
// Les articles que VRM connaît (Annonces) : titre, N°, photo, prix. 9010 n'y est pas
// (son titre vient de la phrase de Vinted, jamais d'une ressemblance).
const ARTICLES = Object.fromEntries(Object.entries(TITRES).filter(([id]) => id !== '9010').map(([id, t], i) => [id, { titre: t, numero: String(101 + i), photo: SANS_PHOTO.has(Number(id)) ? null : `https://images1.vinted.net/t/b${id}/f800/photo.jpeg`, prix: PRIX[id] ?? null }]));
const AUTO = { reglages: { version: 1, actif: true, attenteMin: 10, attenteMax: 60, heureDebut: 9, heureFin: 21, jours: [1, 2, 3, 4, 5, 6, 7], parJour: 30, parHeure: 12 }, demande: AUTO_DEMANDE, allumeLe: MAINT - 20 * J, ...(PAUSE_ACTIVE ? { pauseJusqua: PAUSE, pauseRaison: 'vinted_frein', etat: 'pause' } : { etat: 'veille' }), envois: [MAINT - 4 * H], journal: JOURNAL, prochain: null };

// ── Ce que l'écran DOIT dire, recalculé ici sans le code jugé ───────────────
const DANS30 = FAV.filter(([, , , age]) => age <= 30 * J);
const etatAttendu = (id) => {
  const j = JOBS.find((x) => x.notificationId === id), jr = JOURNAL.find((x) => x.notificationId === id);
  const item = String((FAV.find((f) => f[0] === id) || [])[2]);
  if (j && j.etat === 'envoye') return j.ecrits === 3 ? 'offre' : 'envoye';
  if (j && j.etat === 'incertain') return 'a_verifier';
  if (VENDUS.includes(item)) return 'vendu';
  if (j || jr) return 'pas_envoye:' + ((j && j.raison) || (jr && jr.raison));
  return 'a_envoyer';
};
const ATT = {};
for (const [id, , item] of DANS30) { (ATT[item] = ATT[item] || []).push(etatAttendu(id)); }
const puceAttendue = (item) => {
  const e = ATT[item] || [], vendu = VENDUS.includes(String(item));
  if (e.includes('a_verifier')) return 'a_verifier';
  if (e.includes('a_envoyer') && !vendu) return 'a_envoyer';
  if (vendu) return 'vendu';
  if (e.some((x) => /offre_refusee|vinted_refus|vinted_frein|vinted_robot/.test(x))) return 'refus';
  if (e.includes('offre')) return 'offre';
  if (e.includes('envoye')) return 'envoye';
  if (e.some((x) => /destinataire_non_prouve/.test(x))) return 'ouvrir';
  return 'pas_envoye';
};
const RESUME = { favoris: DANS30.length, articles: Object.keys(ATT).length, envoyes: DANS30.filter(([id]) => /^(envoye|offre)$/.test(etatAttendu(id))).length, vendus: Object.keys(ATT).filter((x) => VENDUS.includes(String(x))).length, attente: DANS30.filter(([id]) => etatAttendu(id) === 'a_envoyer').length };
const PSEUDOS_ITEM = {};
for (const [, login, item] of DANS30) (PSEUDOS_ITEM[item] = PSEUDOS_ITEM[item] || []).push(login);

// Les mutations (§6.1) : chacune réaffaiblit une règle ; le banc doit devenir rouge.
const MUTATIONS = {
  envoi: ['AutomatisationFavoris.jsx', "const p=progressionFavoris(vue,horloge+decalage.current);", "React.useEffect(()=>{if(selection.length&&!vue?.active)agir('lancer');},[selection.join(',')]);const p=progressionFavoris(vue,horloge+decalage.current);"],
  etat: ['favorisEcran.js', "if(n.a_envoyer&&!c.vendu)return", "if(n.a_envoyer)return"],
  nom: ['favorisEcran.js', "  return m?m[1]:'';\n}", "  return m?m[1]:'Client';\n}"],
};
async function construire(theme) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'favoris-ecran-'));
  const main = fs.readFileSync(path.join(RACINE, 'src', 'main.jsx'), 'utf8');
  const css = [...main.matchAll(/^import\s+'\.\/([^']+\.css)';/gm)].map((m) => path.join(RACINE, 'src', m[1]));
  const src = (f) => JSON.stringify(path.join(RACINE, 'src', f));
  const sombre = theme === 'sombre';
  fs.writeFileSync(path.join(dir, 'entree.jsx'), `
${css.map((c) => `import ${JSON.stringify(c)};`).join('\n')}
import React from 'react';
import {createRoot} from 'react-dom/client';
import FavorisVinted from ${src('FavorisVinted.jsx')};
import * as TH from ${src('themeMineral.js')};
const PAL=${sombre}?(TH.MINERAL_DARK||TH.MINERAL):TH.MINERAL;
const v=TH.variablesTheme(PAL,${sombre});for(const [k,x] of Object.entries(v))document.documentElement.style.setProperty(k,x);
document.documentElement.setAttribute('data-theme','${sombre ? 'dark' : 'light'}');
document.body.style.background=PAL.bg;document.body.style.color=PAL.text;document.body.style.margin='0';
const ARTICLES=${JSON.stringify(ARTICLES)};
const PhotoVinted=({src,alt,repli,...r})=>src?<img src={src} alt={alt} {...r}/>:repli;
function Banc(){
  return <div className="vrm-app-shell"><main className="vrm-main" style={{padding:'16px',boxSizing:'border-box'}}><FavorisVinted uid="${UID}" owner="${OWNER}" ownerActuel={()=>"${OWNER}"} base={location.origin} headers={()=>({})} nomCompte="compte_banc" chargementAutomatique={true}
    articlesVendus={new Set(${JSON.stringify(VENDUS)})} articleFavori={id=>ARTICLES[id]||null} PhotoVinted={PhotoVinted}
    extensionAuto={{disponible:true,raison:''}} favorisDisponible={true} favorisRaison="" verifierExtension={async()=>({disponible:true})} ouvrirFavori={async x=>{window.ouvertures=(window.ouvertures||[]).concat(x.id);return {ok:true,data:{ouvert:true,preuve:'confirmee'}};}}
    executerFavori={async()=>{window.envois=(window.envois||0)+1;return {ok:false};}} FermeAuRetour={()=>null}/></main></div>;
}
createRoot(document.getElementById('r')).render(<Banc/>);
`);
  const mutant = MUTANT && MUTATIONS[MUTANT];
  const plugins = mutant ? [{ name: 'mutant', setup(b) { b.onLoad({ filter: new RegExp(mutant[0].replace('.', '\\.') + '$') }, (a) => { const t = fs.readFileSync(a.path, 'utf8'); if (!t.includes(mutant[1])) throw Error('mutation introuvable : ' + MUTANT); return { contents: t.replace(mutant[1], mutant[2]), loader: 'jsx' }; }); } }] : [];
  await esbuild.build({ entryPoints: [path.join(dir, 'entree.jsx')], bundle: true, outdir: path.join(dir, 'out'), format: 'esm', jsx: 'automatic', plugins, loader: { '.js': 'jsx', '.woff2': 'empty', '.woff': 'empty', '.png': 'empty', '.svg': 'empty', '.jpg': 'empty' }, nodePaths: [NM], logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{"MODE":"production","PROD":true,"DEV":false}' }, external: ['/fonts/*', '/images/*', '/textures/*'] });
  fs.writeFileSync(path.join(dir, 'out', 'index.html'), '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/entree.css"></head><body><div id="r"></div><script type="module" src="/entree.js"></script></body></html>');
  return path.join(dir, 'out');
}

(async () => {
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="96"><rect width="80" height="96" fill="hsl(${(n * 47) % 360},18%,${70 + (n % 3) * 6}%)"/><ellipse cx="40" cy="60" rx="28" ry="10" fill="hsl(${(n * 47) % 360},25%,42%)"/></svg>`;
  for (const theme of THEMES) {
  const OUT = await construire(theme);
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  const sauves = [], postes = [];
  const srv = http.createServer((q, r) => {
    const u = decodeURIComponent(q.url);
    const json = (d, st = 200) => { r.writeHead(st, { 'content-type': 'application/json' }); r.end(JSON.stringify(d)); };
    if (u.startsWith('/rest/v1/app_data')) {
      if (q.method === 'POST') { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { const row = JSON.parse(b); sauves.push(row); json([row]); }); return; }
      if (u.includes(`id=eq.harvest_${UID}_notifications`)) return json(JEU === 'vide' ? [] : [{ owner: OWNER, data: { type: 'notifications', uid: UID, domain: 'www.vinted.fr', capturedAt: iso(MAINT), payload: { notifications: NOTIFS } } }]);
      if (u.includes(`id=eq.harvest_${UID}_favoris_archive`)) return json([]);
      if (u.includes(`id=eq.vrm_favoris_reglages_${UID}`)) return json(sauves.length ? [sauves[sauves.length - 1]] : [{ id: `vrm_favoris_reglages_${UID}`, owner: OWNER, data: { version: 1, message: MESSAGE, pourcentage: 10, offreMode: 'pct', offreValeur: null, arrondi: false, intervalleMinutes: 6, intervalleMaxMinutes: null, envoisActifs: false } }]);
      return json([]);
    }
    if (u.startsWith('/api/compte')) {
      const repondre = () => json({ ok: true, serveur: MAINT, vue: { active: false, raison: '', lot: 'l1', prochain: null, intervalleMinutes: 6, jobs: JOBS, auto: AUTO } });
      if (q.method === 'POST') { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { try { postes.push(JSON.parse(b)); } catch (_) { postes.push({}); } repondre(); }); return; }
      return repondre();
    }
    let f = u.split('?')[0]; if (f === '/') f = '/index.html';
    const p = path.join(OUT, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
  });
  await new Promise((res) => srv.listen(0, res));
  const PORT = srv.address().port;
  for (const tel of [true, false]) {
    const T = (tel ? '390' : '1512') + ' ' + theme + (JEU !== 'base' ? ' ' + JEU : '');
    const F = `${JEU}-${theme}-${tel ? '390' : '1512'}`;
    const ctx = await nav.newContext(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'fr-FR', timezoneId: 'Europe/Paris' } : { viewport: { width: 1512, height: 950 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.addInitScript((t) => { const vrai = Date.now.bind(Date); const decal = t - vrai(); Date.now = () => vrai() + decal; }, MAINT);
    await pg.route(/vinted\.net\//, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg(m ? Number(m[1]) : 1) }); });
    await pg.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector(FAV.length ? '[data-fav-article]' : '[data-fav-vide]', { timeout: 15000 }).catch(() => {});
    await pg.waitForTimeout(900);
    // La liste entière (« Tous ») pour juger chaque article.
    if (FAV.length) { await pg.click('[data-fav-filtre="tous"]').catch(() => {}); while (await pg.locator('[data-fav-plus]').count()) await pg.click('[data-fav-plus]'); }
    await pg.evaluate(() => window.scrollTo(0, 0)); await pg.screenshot({ path: path.join(SHOTS, `favoris-${F}.png`) });
    if (FAV.length > 3) { await pg.locator('[data-fav-article]').nth(2).scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(200); await pg.screenshot({ path: path.join(SHOTS, `favoris-${F}-liste.png`) }); await pg.evaluate(() => { window.scrollTo(0, 0); for (const e of document.querySelectorAll('*')) if (e.scrollTop) e.scrollTop = 0; }); }
    const m = await pg.evaluate(() => {
      const sec = document.querySelector('[data-fav-fusion]');
      const vis = (e) => { const r = e.getBoundingClientRect(); const st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'; };
      const carte = document.querySelector('[data-fu-carte]');
      const auto = document.querySelector('[data-fav-auto-etat]');
      const articles = [...document.querySelectorAll('[data-fav-article]')].map((li) => ({ item: li.getAttribute('data-fav-article'), etat: li.getAttribute('data-fav-etat'), geste: li.getAttribute('data-fav-geste-article'), numero: li.getAttribute('data-fav-numero'), titre: li.querySelector('[data-fav-titre]')?.innerText || '', prix: li.querySelector('[data-fav-prix]')?.innerText || '', photo: !!li.querySelector('img'), n: Number(li.querySelector('[data-fav-personnes]')?.getAttribute('data-fav-personnes')), initiales: [...li.querySelectorAll('[data-fav-initiale]')].map((i) => i.getAttribute('data-fav-initiale')), action: li.querySelector('[data-fav-action]')?.getAttribute('data-fav-action') || '', h: li.getBoundingClientRect().height }));
      const cibles = sec ? [...sec.querySelectorAll('button, a[href], summary, input, select, textarea')].filter(vis).map((e) => { const r = e.getBoundingClientRect(); const a = getComputedStyle(e, '::after'); const ext = a.content !== 'none' && a.position === 'absolute' ? 8 : 0; return { t: (e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30), h: r.height + ext, w: r.width }; }) : [];
      // Couleurs saturées : seulement le bleu d'Apple et l'ambre (et la carte sombre).
      const sat = (c) => { const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(c); if (!m || (m[4] !== undefined && Number(m[4]) < 0.2)) return null; const [r, g, b] = [m[1], m[2], m[3]].map(Number); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx - mn > 60 ? [r, g, b] : null; };
      const permis = ([r, g, b]) => (b > 200 && r < 40 && g > 100 && g < 150) || (r > 140 && g > 50 && g < 200 && b < 90);
      const couleurs = sec ? [...sec.querySelectorAll('*')].filter(vis).flatMap((e) => { const st = getComputedStyle(e); return [st.backgroundColor, st.color].map(sat).filter(Boolean).filter((x) => !permis(x)).map((x) => `${e.className || e.tagName}:${x}`); }) : [];
      const msg = document.querySelector('[data-fav-message]');
      return {
        texte: sec ? sec.innerText : '', carte: !!carte, carteFond: carte ? getComputedStyle(carte).backgroundImage.slice(0, 40) : '',
        total: Number(document.querySelector('[data-fav-total]')?.getAttribute('data-fav-total') ?? NaN), nArticles: Number(document.querySelector('[data-fav-articles]')?.getAttribute('data-fav-articles') ?? NaN),
        cases: Object.fromEntries([...document.querySelectorAll('[data-fav-case]')].map((c) => [c.getAttribute('data-fav-case'), c.getAttribute('data-n')])),
        auto: auto ? { etat: auto.getAttribute('data-fav-auto-etat'), ton: auto.getAttribute('data-fav-auto-ton'), ligne: auto.querySelector('[data-fav-auto-phrase]')?.innerText || '', geste: !!auto.querySelector('.is-geste'), allume: auto.querySelector('[data-fav-auto-allume]')?.getAttribute('data-fav-auto-allume'), dansCarte: !!auto.closest('[data-fu-carte]') } : null,
        message: msg ? { etat: msg.getAttribute('data-fav-message'), texte: msg.querySelector('[data-fav-message-texte]')?.innerText || '', offre: msg.querySelector('[data-fav-message-offre]')?.innerText || '', modifier: !!msg.querySelector('[data-fav-message-modifier]') } : null,
        articles, cibles, couleurs, deb: document.documentElement.scrollWidth - document.documentElement.clientWidth, largeur: sec ? sec.getBoundingClientRect().width : 0,
        vide: document.querySelector('[data-fav-vide]')?.getAttribute('data-fav-vide') || '',
      };
    });
    fs.writeFileSync(path.join(SHOTS, `favoris-${F}.txt`), m.texte);
    dit(!errs.length, `${T} l'écran se monte sans erreur`, errs.join(' | '));
    dit(m.carte && /gradient/.test(m.carteFond), `${T} la carte sombre Fusion est en tête`, m.carteFond);
    // 1. La carte sombre
    if (FAV.length) {
      dit(m.total === RESUME.favoris && m.nArticles === RESUME.articles, `${T} carte : ${RESUME.favoris} favoris sur ${RESUME.articles} articles (30 j)`, `${m.total} / ${m.nArticles}`);
      dit(Number(m.cases.envoyes) === RESUME.envoyes && Number(m.cases.vendus) === RESUME.vendus && Number(m.cases.attente) === RESUME.attente, `${T} cases : ${RESUME.envoyes} envoyés · ${RESUME.vendus} vendus · ${RESUME.attente} en attente`, JSON.stringify(m.cases));
    } else dit(m.total === 0 && /^(aucun|absente)$/.test(m.vide), `${T} aucun favori : « 0 » et une ligne, rien d'inventé`, `${m.total} ${m.vide}`);
    dit(m.auto && m.auto.dansCarte && m.auto.allume === '1', `${T} l'interrupteur du mode auto est dans la carte, allumé`, JSON.stringify(m.auto));
    if (JEU === 'bloque') dit(m.auto && m.auto.ton === 'geste' && m.auto.geste && /dressing/i.test(m.auto.ligne), `${T} mode auto bloqué : UNE ligne, le geste, en ambre`, JSON.stringify(m.auto));
    else { const heurePause = new Date(PAUSE).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }); dit(m.auto && m.auto.etat === 'pause' && m.auto.ligne.includes(heurePause) && /ralentir/i.test(m.auto.ligne), `${T} freiné : jusqu'à ${heurePause} et pourquoi`, m.auto && m.auto.ligne); }
    // 2. Le message
    const premier = FAV.length ? (() => { const a = m.articles.find((x) => x.geste === 'envoyer') || m.articles[0]; return a; })() : null;
    dit(m.message && m.message.etat === 'pret' && !/\{|\}/.test(m.message.texte) && /merci pour ton favori/.test(m.message.texte) && m.message.modifier, `${T} « Ton message » : le vrai texte, sans variable brute, modifiable`, JSON.stringify(m.message));
    if (FAV.length && premier) { const ps = (PSEUDOS_ITEM[premier.item] || []).filter(Boolean); dit(ps.some((x) => m.message.texte.includes(x)), `${T} la variable {username} est remplacée par le pseudo d'un VRAI favori`, m.message.texte); }
    dit(m.message && /−10 %|→/.test(m.message.offre), `${T} l'offre est dite (−10 % ou prix → prix)`, m.message && m.message.offre);
    // 3. Une carte par article
    if (FAV.length) {
      const items = Object.keys(ATT).map(String).sort();
      dit(JSON.stringify(m.articles.map((x) => x.item).sort()) === JSON.stringify(items), `${T} une carte par ARTICLE (${items.length})`, m.articles.map((x) => x.item).join(','));
      const mal = m.articles.filter((x) => x.etat !== puceAttendue(x.item)).map((x) => `${x.item}:${x.etat}≠${puceAttendue(x.item)}`);
      dit(!mal.length, `${T} chaque article porte l'état attendu (à envoyer · vendu · à vérifier · offre faite · envoyé · refusé par Vinted…)`, mal.join(' '));
      dit(m.articles.every((x) => (x.action === 'envoyer') === (puceAttendue(x.item) === 'a_envoyer')), `${T} « Envoyer » seulement sur un article qui a des favoris à envoyer (jamais sur un vendu)`, m.articles.map((x) => x.item + ':' + x.action).join(' '));
      dit(m.articles.every((x) => x.n === (ATT[x.item] || []).length), `${T} chaque carte compte SES favoris`, m.articles.map((x) => x.item + ':' + x.n).join(' '));
      const inventes = m.articles.flatMap((x) => x.initiales.filter((i) => i && !(PSEUDOS_ITEM[x.item] || []).some((p) => p && p[0].toUpperCase() === i)).map((i) => x.item + ':' + i));
      dit(!inventes.length, `${T} chaque initiale vient d'un pseudo écrit par Vinted (aucun nom inventé)`, inventes.join(' '));
      if (JEU === 'base') { const a13 = m.articles.find((x) => x.item === '9008'); dit(a13 && a13.initiales.includes(''), `${T} pseudo illisible ⇒ un rond vide`, JSON.stringify(a13)); }
      dit(m.articles.filter((x) => ARTICLES[x.item]).every((x) => x.numero === ARTICLES[x.item].numero && x.titre.length > 0), `${T} N° et titre par identité de l'annonce`);
      if (JEU === 'base') { const a10 = m.articles.find((x) => x.item === '9010'); dit(!a10, `${T} un favori hors période (40 j) n'est pas dans « 30 j »`); }
      dit(m.articles.filter((x) => ARTICLES[x.item]?.prix).every((x) => /\d+ €/.test(x.prix)), `${T} le prix connu est affiché`);
      dit(m.articles.every((x) => x.photo === !(SANS_PHOTO.has(Number(x.item)))), `${T} une photo par article (ou la vignette vide)`);
      dit(m.articles.every((x) => x.h < 140), `${T} cartes compactes (aucune ne dépasse 140 px)`, Math.max(...m.articles.map((x) => x.h)) + ' px');
    }
    // 6. Lisibilité
    const JARGON = [/\bfiles?\b/i, /jetons?/i, /\b(?:401|403|429|503)\b/, /\bpont\b/i, /captur/i, /quota/i, /payload|endpoint|\bAPI\b/i, /autorisation/i, /\blots?\b/i, /Vintex/i, /\bpaires?\b/i];
    const jargon = JARGON.filter((re) => re.test(m.texte)).map((re) => String(re) + ' : ' + (m.texte.match(re) || [''])[0]);
    dit(!jargon.length, `${T} aucun mot technique, jamais « paire »`, jargon.join(' | '));
    dit(!/[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}♡]/u.test(m.texte), `${T} aucun emoji`);
    if (tel) { const petits = m.cibles.filter((c) => c.h < 43.5 || c.w < 43.5); dit(!petits.length, `${T} cibles au doigt ≥ 44 px`, petits.map((c) => `${c.t} ${Math.round(c.w)}×${Math.round(c.h)}`).join(' | ')); }
    dit(!m.couleurs.length, `${T} aucune couleur hors du bleu d'Apple et de l'ambre`, [...new Set(m.couleurs)].slice(0, 6).join(' | '));
    dit(m.deb <= 1, `${T} aucun débordement horizontal`, m.deb + ' px');
    if (!tel) dit(m.largeur > 0 && m.largeur <= 760, `${T} colonne ≤ 760 px sur ordinateur`, m.largeur + ' px');
    // 4. « Envoyer » : choisit, ouvre, ne lance RIEN
    const env = m.articles.find((x) => x.action === 'envoyer');
    if (env) {
      await pg.click(`[data-fav-article="${env.item}"] [data-fav-action="envoyer"]`);
      await pg.waitForSelector('[data-favoris-feuille]:not([hidden])', { timeout: 5000 }).catch(() => {});
      await pg.waitForTimeout(1500);
      const f = await pg.evaluate(() => ({ etape: document.querySelector('[data-favoris-feuille]')?.getAttribute('data-favoris-etape'), lancer: [...document.querySelectorAll('[data-favoris-feuille] button')].some((b) => /Lancer/.test(b.innerText)), envois: window.envois || 0, visible: !!document.querySelector('.vrm-favoris-voile:not([hidden]) [data-favoris-feuille]') }));
      dit(f.visible && f.etape === 'envoi' && f.lancer, `${T} « Envoyer » ouvre la feuille d'envoi, « Lancer » prêt`, JSON.stringify(f));
      const lances = postes.filter((x) => x.action === 'lancer');
      dit(!lances.length && !f.envois, `${T} rien n'est lancé ni envoyé sans « Lancer »`, JSON.stringify(lances.map((x) => x.selection)));
      if (tel && theme === 'clair') await pg.screenshot({ path: path.join(SHOTS, `favoris-${F}-envoi.png`) });
      await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForSelector('[data-fav-article]', { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(600);
    }
    // 5. Le détail d'un article
    if (FAV.length) {
      const cible = m.articles.slice().sort((a, b) => b.n - a.n)[0];
      await pg.click(`[data-fav-article="${cible.item}"] [data-fav-detail]`).catch(() => pg.click('[data-fav-filtre="tous"]').then(() => pg.click(`[data-fav-article="${cible.item}"] [data-fav-detail]`)));
      await pg.waitForSelector('[data-fav-detail-feuille]', { timeout: 5000 }).catch(() => {});
      const d = await pg.evaluate(() => { const f = document.querySelector('[data-fav-detail-feuille]'); return f ? { n: f.querySelectorAll('[data-fav-personne]').length, pseudos: [...f.querySelectorAll('[data-fav-pseudo]')].map((x) => x.innerText), etats: [...f.querySelectorAll('[data-fav-personne]')].map((x) => x.getAttribute('data-fav-etat')), deb: document.documentElement.scrollWidth - document.documentElement.clientWidth } : null; });
      dit(d && d.n === cible.n, `${T} toucher la carte ⇒ le détail : une ligne par personne (${cible.n})`, JSON.stringify(d));
      dit(d && d.pseudos.every((x) => x === 'Pseudo non lu' || (PSEUDOS_ITEM[cible.item] || []).includes(x)), `${T} détail : chaque pseudo est celui écrit par Vinted`, d && d.pseudos.join(','));
      if (tel) await pg.screenshot({ path: path.join(SHOTS, `favoris-${F}-detail.png`) });
      await pg.keyboard.press('Escape').catch(() => {});
      await pg.click('.vrm-fa-feuille .vrm-fa-fermer').catch(() => {});
    }
    // 7. Modifier le message ⇒ Enregistrer, sans rien envoyer
    if (JEU === 'base' && theme === 'clair') {
      await pg.click('[data-fav-message-modifier]');
      const champ = pg.locator('[data-favoris-message]');
      await champ.waitFor({ timeout: 5000 }).catch(() => {});
      const vu = await champ.count() ? await champ.inputValue() : null;
      dit(vu === MESSAGE, `${T} « Modifier » ouvre le message enregistré`, String(vu));
      if (vu != null) {
        await champ.fill('Bonjour {username}, merci !');
        const bouton = pg.locator('[data-favoris-enregistrer-message]');
        if (await bouton.count()) {
          await bouton.click();
          await pg.waitForFunction(() => /^Bonjour .*merci !$/.test(document.querySelector('[data-fav-message-texte]')?.innerText || ''), null, { timeout: 5000 }).catch(() => {});
          dit(sauves.length >= 1 && sauves[sauves.length - 1].data.message === 'Bonjour {username}, merci !' && sauves[sauves.length - 1].data.envoisActifs === false, `${T} le message est enregistré (rien n'est lancé)`);
          dit(await pg.evaluate(() => !window.envois) && !postes.some((x) => x.action === 'lancer'), `${T} enregistrer n'envoie aucun message`);
          sauves.length = 0;
        } else dit(false, `${T} « Enregistrer » est proposé`);
      }
    }
    await ctx.close();
  }
  srv.close();
  }
  await nav.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — jeu ${JEU}${MUTANT ? ', mutant ' + MUTANT : ''} — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ banc interrompu : ' + e.stack); process.exit(1); });
