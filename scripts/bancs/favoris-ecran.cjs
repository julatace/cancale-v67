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

async function construire() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'favoris-ecran-'));
  const main = fs.readFileSync(path.join(RACINE, 'src', 'main.jsx'), 'utf8');
  const css = [...main.matchAll(/^import\s+'\.\/([^']+\.css)';/gm)].map((m) => path.join(RACINE, 'src', m[1]));
  const src = (f) => JSON.stringify(path.join(RACINE, 'src', f));
  fs.writeFileSync(path.join(dir, 'entree.jsx'), `
${css.map((c) => `import ${JSON.stringify(c)};`).join('\n')}
import React from 'react';
import {createRoot} from 'react-dom/client';
import FavorisVinted from ${src('FavorisVinted.jsx')};
import {MINERAL,variablesTheme} from ${src('themeMineral.js')};
const v=variablesTheme(MINERAL,false);for(const [k,x] of Object.entries(v))document.documentElement.style.setProperty(k,x);
document.body.style.background=MINERAL.bg;document.body.style.color=MINERAL.text;document.body.style.margin='0';
const ARTICLES=${JSON.stringify(ARTICLES)};
const PhotoVinted=({src,alt,repli,...r})=>src?<img src={src} alt={alt} {...r}/>:repli;
function Banc(){
  return <div className="vrm-app-shell"><main className="vrm-main" style={{maxWidth:760,margin:'0 auto',padding:'16px',boxSizing:'border-box'}}><FavorisVinted uid="${UID}" owner="${OWNER}" ownerActuel={()=>"${OWNER}"} base={location.origin} headers={()=>({})} nomCompte="compte_banc" chargementAutomatique={true}
    articlesVendus={new Set(['9004'])} articleFavori={id=>ARTICLES[id]||null} PhotoVinted={PhotoVinted}
    extensionAuto={{disponible:true,raison:''}} favorisDisponible={false} favorisRaison="Ouvre vinted.fr dans Chrome sur ce compte." ouvrirFavori={async x=>{window.ouvertures=(window.ouvertures||[]).concat(x.id);return {ok:true,data:{ouvert:true,preuve:'confirmee'}};}}
    executerFavori={async()=>{window.envois=(window.envois||0)+1;return {ok:false};}} FermeAuRetour={()=>null}/></main></div>;
}
createRoot(document.getElementById('r')).render(<Banc/>);
`);
  await esbuild.build({ entryPoints: [path.join(dir, 'entree.jsx')], bundle: true, outdir: path.join(dir, 'out'), format: 'esm', jsx: 'automatic', loader: { '.js': 'jsx', '.woff2': 'empty', '.woff': 'empty', '.png': 'empty', '.svg': 'empty', '.jpg': 'empty' }, nodePaths: [NM], logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{"MODE":"production","PROD":true,"DEV":false}' }, external: ['/fonts/*', '/images/*', '/textures/*'] });
  fs.writeFileSync(path.join(dir, 'out', 'index.html'), '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/entree.css"></head><body><div id="r"></div><script type="module" src="/entree.js"></script></body></html>');
  return path.join(dir, 'out');
}

(async () => {
  const OUT = await construire();
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  const sauves = [];
  const srv = http.createServer((q, r) => {
    const u = decodeURIComponent(q.url);
    const json = (d, s = 200) => { r.writeHead(s, { 'content-type': 'application/json' }); r.end(JSON.stringify(d)); };
    if (u.startsWith('/rest/v1/app_data')) {
      if (q.method === 'POST') { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { const row = JSON.parse(b); sauves.push(row); json([row]); }); return; }
      if (u.includes(`id=eq.harvest_${UID}_notifications`)) return json([{ owner: OWNER, data: { type: 'notifications', uid: UID, domain: 'www.vinted.fr', capturedAt: iso(MAINT), payload: { notifications: NOTIFS } } }]);
      if (u.includes(`id=eq.harvest_${UID}_favoris_archive`)) return json([]);
      if (u.includes(`id=eq.vrm_favoris_reglages_${UID}`)) return json(sauves.length ? [sauves[sauves.length - 1]] : [{ id: `vrm_favoris_reglages_${UID}`, owner: OWNER, data: { version: 1, message: MESSAGE, pourcentage: 10, offreMode: 'pct', offreValeur: null, arrondi: false, intervalleMinutes: 6, intervalleMaxMinutes: null, envoisActifs: false } }]);
      return json([]);
    }
    if (u.startsWith('/api/compte')) return json({ ok: true, serveur: MAINT, vue: { active: false, raison: '', lot: 'l1', prochain: null, intervalleMinutes: 6, jobs: JOBS, auto: { reglages: { version: 1, actif: true, attenteMin: 10, attenteMax: 60, heureDebut: 9, heureFin: 21, jours: [1, 2, 3, 4, 5, 6, 7], parJour: 30, parHeure: 12 }, demande: null, allumeLe: MAINT - 20 * 24 * H, pauseJusqua: PAUSE, pauseRaison: 'vinted_frein', envois: [MAINT - 4 * H], journal: JOURNAL, etat: 'pause', prochain: null } } });
    let f = u.split('?')[0]; if (f === '/') f = '/index.html';
    const p = path.join(OUT, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
  });
  await new Promise((res) => srv.listen(0, res));
  const PORT = srv.address().port;
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="96"><rect width="80" height="96" fill="hsl(${(n * 47) % 360},35%,72%)"/></svg>`;
  for (const tel of [true, false]) {
    const T = tel ? '390' : '1512';
    const ctx = await nav.newContext(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'fr-FR', timezoneId: 'Europe/Paris' } : { viewport: { width: 1512, height: 950 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.addInitScript((t) => { const vrai = Date.now.bind(Date); const decal = t - vrai(); Date.now = () => vrai() + decal; }, MAINT);
    await pg.route(/vinted\.net\//, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg(m ? Number(m[1]) : 1) }); });
    await pg.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('[data-fav-ligne]', { timeout: 15000 }).catch(() => {});
    await pg.waitForTimeout(1200);
    await pg.screenshot({ path: path.join(SHOTS, `favoris-ecran-${T}.png`), fullPage: true });
    const m = await pg.evaluate(() => {
      const sec = document.querySelector('[data-fav-ecran]') || document.querySelector('section.vrm-favoris-liste');
      const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
      const auto = document.querySelector('[data-fav-auto-etat]');
      const lignes = [...document.querySelectorAll('[data-fav-ligne]')].map((li) => ({ id: li.getAttribute('data-fav-ligne'), etat: li.getAttribute('data-fav-etat'), numero: li.getAttribute('data-fav-numero'), envoyeLe: li.getAttribute('data-fav-envoye-le'), groupe: li.closest('[data-fav-groupe]')?.getAttribute('data-fav-raison') || null, texte: li.innerText, photo: !!li.querySelector('img'), ouvrir: !!li.querySelector('[data-fav-ouvrir]'), feuilles: [...li.querySelectorAll('*')].filter((x) => !x.children.length && x.innerText && x.innerText.trim().length > 0).map((x) => x.innerText.trim()) }));
      const groupes = [...document.querySelectorAll('[data-fav-groupe]')].map((g) => ({ code: g.getAttribute('data-fav-groupe'), raison: g.getAttribute('data-fav-raison'), ton: g.getAttribute('data-fav-ton'), geste: g.querySelector(':scope > header [data-fav-geste]')?.innerText || '', compte: Number(g.querySelector('[data-fav-compte]')?.getAttribute('data-fav-compte')), n: g.querySelectorAll('[data-fav-ligne]').length }));
      const cibles = sec ? [...sec.querySelectorAll('button, a[href], summary, input, select, textarea')].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return { t: (e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 40), h: r.height, w: r.width }; }) : [];
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--vrm-accent').trim();
      const rgb = (() => { const d = document.createElement('div'); d.style.color = accent; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; })();
      const enAccent = sec ? [...sec.querySelectorAll('*')].filter(vis).filter((e) => getComputedStyle(e).backgroundColor === rgb).map((e) => e.innerText.trim().slice(0, 40)) : [];
      const msg = document.querySelector('[data-fav-message]');
      return {
        texte: sec ? sec.innerText : '', auto: auto ? { etat: auto.getAttribute('data-fav-auto-etat'), ton: auto.getAttribute('data-fav-auto-ton'), phrase: auto.querySelector('[data-fav-auto-phrase]')?.innerText || '', geste: auto.querySelector('[data-fav-auto-geste]')?.innerText || '', allume: auto.querySelector('[data-fav-auto-allume]')?.getAttribute('data-fav-auto-allume') } : null,
        message: msg ? { etat: msg.getAttribute('data-fav-message'), texte: msg.querySelector('[data-fav-message-texte]')?.innerText || '', modifier: !!msg.querySelector('[data-fav-message-modifier]') } : null,
        lignes, groupes, cibles, enAccent, deb: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ordreAuto: auto && msg && lignes.length ? (auto.compareDocumentPosition(msg) & 4) && (msg.compareDocumentPosition(document.querySelector('[data-fav-ligne]')) & 4) ? 'ok' : 'non' : 'absent',
      };
    });
    fs.writeFileSync(path.join(SHOTS, `favoris-ecran-${T}.txt`), m.texte);
    dit(!errs.length, `${T} l'écran se monte sans erreur`, errs.join(' | '));
    // 1. Mode auto
    dit(m.auto && m.auto.allume === '1' && m.auto.etat === 'pause', `${T} mode auto en tête : allumé et en pause`, JSON.stringify(m.auto));
    const heurePause = new Date(PAUSE).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
    dit(m.auto && m.auto.phrase.includes(heurePause) && /ralentir/i.test(m.auto.phrase) && !!m.auto.geste, `${T} le frein dit jusqu'à quand (${heurePause}), pourquoi, et le geste`, m.auto && m.auto.phrase + ' | ' + m.auto.geste);
    dit(m.ordreAuto === 'ok', `${T} ordre : mode auto, puis le message, puis la liste`, m.ordreAuto);
    // 2. Message
    dit(m.message && m.message.etat === 'pret' && m.message.texte.includes('merci pour ton favori') && m.message.modifier, `${T} le message enregistré est visible et modifiable`, JSON.stringify(m.message));
    // 3. Une ligne par favori, un état
    dit(m.lignes.length === FAV.length, `${T} une ligne par favori (${FAV.length})`, String(m.lignes.length));
    const faux = FAV.map(([id]) => id).filter((id) => (m.lignes.find((l) => l.id === id) || {}).etat !== ATTENDU[id]);
    dit(!faux.length, `${T} chaque favori porte l'état attendu (envoyé · pas envoyé · à envoyer · à vérifier)`, faux.map((id) => `${id}=${(m.lignes.find((l) => l.id === id) || {}).etat}≠${ATTENDU[id]}`).join(', '));
    const l = (id) => m.lignes.find((x) => x.id === id) || { texte: '', feuilles: [] };
    dit(l('n1').envoyeLe && Math.abs(Date.parse(l('n1').envoyeLe) - (MAINT - 4 * H)) < 1000 && /\d{2}:\d{2}/.test(l('n1').texte), `${T} « envoyé » porte la date et l'heure d'envoi`, JSON.stringify(l('n1')));
    dit(l('n2').groupe === 'conversation' && l('n9').groupe === 'conversation' && l('n4').groupe === 'vendue' && l('n7').groupe === 'limite_heure' && l('n5').groupe === 'destinataire', `${T} « pas envoyé » rangé par raison (conversation, vendue, limite, à qui écrire)`, ['n2', 'n9', 'n4', 'n7', 'n5'].map((x) => x + ':' + l(x).groupe).join(' '));
    dit(FAV.filter(([, , item]) => item).every(([id, , item]) => l(id).numero === ARTICLES[item].numero && l(id).texte.includes(ARTICLES[item].titre)), `${T} N° et titre par identité de l'annonce`, m.lignes.map((x) => x.id + ':' + x.numero).join(' '));
    dit(FAV.every(([id, login]) => l(id).texte.includes(login)), `${T} le pseudo de chaque personne est affiché`);
    dit(FAV.filter(([, , item]) => item).every(([id]) => l(id).photo), `${T} chaque ligne a sa photo`);
    dit(!l('n10').numero, `${T} favori sans annonce lisible : aucun N° deviné`);
    // 4. Gestes
    dit(l('n5').ouvrir && FAV.filter(([id]) => id !== 'n5').every(([id]) => !l(id).ouvrir), `${T} « Ouvrir » seulement là où VRM doit apprendre à qui écrire`);
    const g = (code, raison) => m.groupes.find((x) => x.code === code && (raison == null || x.raison === raison)) || {};
    dit(g('a_verifier').ton === 'geste' && !!g('a_verifier').geste && g('pas_envoye', 'limite_heure').ton === 'geste' && g('pas_envoye', 'conversation').ton === 'neutre' && !g('pas_envoye', 'conversation').geste, `${T} ambre seulement quand un geste débloque`, JSON.stringify(m.groupes.map((x) => [x.code, x.raison, x.ton])));
    dit(m.groupes.every((x) => x.compte === x.n || x.n < x.compte), `${T} chaque groupe dit son nombre une fois`, JSON.stringify(m.groupes.map((x) => [x.code, x.compte, x.n])));
    // 5. Lisibilité
    const compte = new Map();
    for (const li of m.lignes) for (const t of new Set(li.feuilles)) if (t.length >= 12) compte.set(t, (compte.get(t) || 0) + 1);
    const redites = [...compte].filter(([, n]) => n > 1).map(([t, n]) => `${n}× « ${t} »`);
    dit(m.lignes.length > 0 && !redites.length, `${T} aucune phrase répétée sur deux lignes`, redites.join(' | '));
    const JARGON = [/\bfiles?\b/i, /jetons?/i, /\b(?:401|403|429|503)\b/, /\bpont\b/i, /captur/i, /quota/i, /payload|endpoint|\bAPI\b/i, /autorisation/i, /\blots?\b/i, /Vintex/i];
    const jargon = JARGON.filter((re) => re.test(m.texte)).map((re) => String(re) + ' : ' + (m.texte.match(re) || [''])[0]);
    dit(!jargon.length, `${T} aucun mot technique à l'écran`, jargon.join(' | '));
    dit(!/[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}]/u.test(m.texte), `${T} aucun emoji`);
    if (tel) { const petits = m.cibles.filter((c) => c.h < 43.5 || c.w < 43.5); dit(!petits.length, `${T} cibles au doigt ≥ 44 px`, petits.map((c) => `${c.t} ${Math.round(c.w)}×${Math.round(c.h)}`).join(' | ')); }
    dit(m.enAccent.length <= 1, `${T} une seule chose en couleur d'accent`, m.enAccent.join(' | '));
    dit(m.deb <= 1, `${T} aucun débordement horizontal`, m.deb + ' px');
    // 6. Modifier le message ⇒ écrire ⇒ Enregistrer, sans rien envoyer
    if (m.message && m.message.modifier) {
      await pg.click('[data-fav-message-modifier]');
      const champ = pg.locator('[data-favoris-message]');
      await champ.waitFor({ timeout: 5000 }).catch(() => {});
      const vu = await champ.count() ? await champ.inputValue() : null;
      dit(vu === MESSAGE, `${T} « Modifier » ouvre le message enregistré`, String(vu));
      if (vu != null) {
        await champ.fill('Bonjour {username}, merci !');
        await pg.screenshot({ path: path.join(SHOTS, `favoris-ecran-message-${T}.png`) });
        const bouton = pg.locator('[data-favoris-enregistrer-message]');
        dit(await bouton.count() === 1, `${T} sans favori choisi, « Enregistrer » est proposé`);
        if (await bouton.count()) {
          await bouton.click();
          await pg.waitForFunction(() => document.querySelector('[data-fav-message-texte]')?.innerText.includes('Bonjour {username}, merci !'), null, { timeout: 5000 }).catch(() => {});
          dit(sauves.length >= 1 && sauves[sauves.length - 1].data.message === 'Bonjour {username}, merci !' && sauves[sauves.length - 1].data.envoisActifs === false, `${T} le message est enregistré (rien n'est lancé)`, JSON.stringify(sauves[sauves.length - 1] || null));
          dit(await pg.evaluate(() => !window.envois), `${T} enregistrer n'envoie aucun message`);
          dit(await pg.locator('[data-fav-message-texte]').innerText().catch(() => '') === 'Bonjour {username}, merci !', `${T} l'écran montre le nouveau message`);
          sauves.length = 0;
        }
      }
    }
    await ctx.close();
  }
  await nav.close(); srv.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ banc interrompu : ' + e.stack); process.exit(1); });
