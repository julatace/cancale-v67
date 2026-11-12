// ════════════════════════════════════════════════════════════════════════════
//  BANC — « Messages aux favoris » en trois temps (11 nov., lot favoris-clair)
//
//  Julien : « les messages aux favoris, on peut faire en sorte que ce soit
//  BEAUCOUP plus beau et plus COMPRÉHENSIBLE ? » Ce banc MONTE le vrai
//  src/FavorisVinted.jsx (FavorisEtapes, ModeAutoFavoris, le moteur
//  AutomatisationFavoris) ET la vraie feuille commune « VRM travaille »
//  (SuiviTravailHote), avec les feuilles de style de l'app, en clair et en sombre,
//  à 390 px tactile et à 1512 px. La route /api/compte?mode=favoris est une
//  fausse file À ÉTAT (lancer · suivant · terminer · arrêter) ; l'extension est
//  un bouchon qui répond « envoyé » (ou « Vinted a refusé l'offre » au 3e) :
//  RIEN n'est envoyé nulle part. Forme réelle des notifications (pas d'`actor`,
//  « <pseudo> a marqué ton article <titre> comme favori », /items/<id>/want_it).
//  Données INVENTÉES.
//
//  Il juge (data-* et nombres) :
//   1. QUI : une ligne par annonce, le NOMBRE de personnes, AUCUN pseudo à
//      l'écran ; seuls les favoris arrivés après le dernier envoi sont proposés,
//      les anciens comptés à part (« Inclure les anciens » les ajoute) ;
//   2. QUOI : l'aperçu porte la pastille « son pseudo » (jamais « {username} »
//      ni un pseudo), l'offre dite au centime (prix → offre, −€, −%) ;
//   3. QUAND : « Maintenant, comme Vintex » dit 6 à 10 s ;
//   4. le récapitulatif : messages · annonces · environ (n−1)×8 s · gestes
//      (3 par message avec l'offre) dans la limite de 45/h ;
//   5. le garde-fou de marge : une offre à perte ou sous le prix mini BLOQUE
//      « Envoyer » jusqu'à « Je confirme » ;
//   6. RIEN n'est lancé sans « Envoyer » ; puis la feuille « VRM travaille » :
//      N sur M, réussis ✓, le refus avec sa raison, VRM figé (inert) ;
//   7. l'historique : un achat après un message (même annonce ET même
//      personne), une vente d'un autre acheteur pas comptée, une vente sans
//      acheteur su dite à part ; « Ce qui marche » par envoi ; l'offre groupée ;
//   8. état vide : une phrase et le geste ; 44 px, aucun débordement, couleurs.
//  FC_JEU = base · vide · absente. FC_THEME = clair · sombre. FC_MUTANT =
//  max (un plafond fixe par envoi revient) · nouveaux · marge · histo · suivi · envoi · outils (§6.1 : chacune doit rougir).
//  `node scripts/bancs/favoris-clair.cjs` (esbuild). SHOTS=dossier des captures.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = process.env.RACINE || path.join(__dirname, '..', '..');
const NM = [path.join(RACINE, 'node_modules'), path.join(__dirname, '..', '..', 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable'); process.exit(1); }
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const JEU = process.env.FC_JEU || 'base';
const THEMES = process.env.FC_THEME ? [process.env.FC_THEME] : ['clair', 'sombre'];
const MUTANT = process.env.FC_MUTANT || '';
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-favoris-clair');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 400) : '')); } };

const OWNER = '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c', UID = '4242';
const MAINT = Date.parse('2026-11-03T15:00:00Z'), H = 3600000, J = 24 * H;
const iso = (t) => new Date(t).toISOString();
const MESSAGE = 'Salut {username}, merci pour ton favori ! Je te fais un prix.';
const FAV = JEU === 'base' ? [
  ['n1', 'lea_sneakers', 9001, 9 * H], ['n2', 'hugo.b', 9002, 8 * H], ['n3', 'ines_75', 9003, 1 * H],
  ['n4', 'tom-run', 9004, 3 * H], ['n5', 'zoe_k', 9005, 5 * H], ['n6', 'paulo92', 9006, 6 * H],
  ['n7', 'emma.vint', 9007, 7 * H], ['n8', 'noe_shop', 9008, 2 * H], ['n9', 'jade.m', 9009, 26 * H],
  ['n10', 'lina_l', 9003, 30 * 60000], ['n11', 'max.r', 9003, 4 * H + 60000], ['n12', 'sam_b', 9001, 3 * H],
  ['n13', '', 9008, 50 * 60000], ['n14', 'ancien_x', 9010, 40 * J],
] : [];
const PSEUDOS = FAV.map((f) => f[1]).filter(Boolean);
const PSEUDOS_ICI = PSEUDOS;
const TITRES = { 9001: 'Nike Air Max 90 blanche', 9002: 'Adidas Samba noire', 9003: 'New Balance 550 verte', 9004: 'Asics Gel-Lyte III', 9005: 'Jordan 1 Mid bleue', 9006: 'Puma Suede rouge', 9007: 'Sac Longchamp Le Pliage noir', 9008: 'Converse Chuck 70', 9009: 'Reebok Club C', 9010: 'Vans Old Skool' };
const PRIX = { 9001: 65, 9002: 80, 9003: 95, 9005: 120, 9007: 45 };
// La fiche par identité (vinted_annonce_numeros[item_id]) : 9003 achetée 90 € (offre à perte), 9001 mini 60 € (offre sous le mini).
const FICHES = { 9003: { buyPrice: '90' }, 9001: { buyPrice: '30', min: 60 } };
const JOBS0 = [
  { id: '9001:1001', notificationId: 'n1', etat: 'envoye', lot: 'l1', traiteLe: MAINT - 4 * H, envoyeLe: MAINT - 4 * H, ecrits: 3, offre: { mode: 'pct', valeur: 10 } },
  { id: '9006:1006', notificationId: 'n6', etat: 'incertain', lot: 'l1', raison: 'reponse_inconnue' },
  { id: '9007:1007', notificationId: 'n7', etat: 'refuse', lot: 'l1', raison: 'offre_refusee' },
  { id: '9009:1009', notificationId: 'n9', etat: 'envoye', lot: 'l0', traiteLe: MAINT - 20 * H, envoyeLe: MAINT - 20 * H },
  { id: '9005:1001', notificationId: 'zz', etat: 'envoye', lot: 'l0', traiteLe: MAINT - 20 * H, envoyeLe: MAINT - 20 * H },
];
const JOURNAL = [{ at: MAINT - 7 * H, notificationId: 'n2', etat: 'saute', raison: 'conversation_existante' }, { at: MAINT - 4 * H, notificationId: 'n5', etat: 'saute', raison: 'destinataire_non_prouve' }];
const VENDUS = ['9004'];
const VENTES = [{ tx: 't1', itemId: '9001', acheteur: '1001', at: MAINT - 2 * H }, { tx: 't2', itemId: '9009', acheteur: '7777', at: MAINT - 10 * H }, { tx: 't3', itemId: '9009', acheteur: null, at: MAINT - 9 * H }];
const corps = (login, item) => (login ? `${login} a marqué ton article ${TITRES[item].toLowerCase()} comme favori` : `Quelqu’un a marqué ton article ${TITRES[item].toLowerCase()} comme favori`);
const NOTIFS = FAV.map(([id, login, item, age], k) => ({ id, body: corps(login, item), user_id: 1000 + k, link: `/items/${item}/want_it/new?offering_id=${7000 + k}`, image: { url: `https://images1.vinted.net/t/b${item}/f800/photo.jpeg?s=x` }, updated_at: iso(MAINT - age) }));
const ARTICLES = Object.fromEntries(Object.entries(TITRES).filter(([id]) => id !== '9010').map(([id, t], i) => [id, { titre: t, numero: String(101 + i), photo: `https://images1.vinted.net/t/b${id}/f800/photo.jpeg`, prix: PRIX[id] ?? null, fiche: FICHES[id] || null }]));
const AUTO = { reglages: { version: 1, actif: false, attenteMin: 10, attenteMax: 60, heureDebut: 9, heureFin: 21, jours: [1, 2, 3, 4, 5, 6, 7], parJour: 30, parHeure: 12 }, etat: 'eteint', envois: [], journal: JOURNAL, prochain: null };
// Ce que la page DOIT proposer, recalculé ici : nouveaux = favoris arrivés après le dernier envoi (MAINT − 4 h), à envoyer.
const DERNIER = MAINT - 4 * H;
const PRIS = new Set(['n1', 'n2', 'n5', 'n6', 'n7', 'n9']);
const aEcrire = (item, tous) => FAV.filter(([id, , it, age]) => it === item && !PRIS.has(id) && !VENDUS.includes(String(it)) && (tous || MAINT - age > DERNIER)).length;
const CHOISISSABLES = [...new Set(FAV.map((f) => f[2]))].filter((it) => aEcrire(it, false) > 0);
const N_TOUS = CHOISISSABLES.reduce((n, it) => n + aEcrire(it, false), 0);

const MUTATIONS = {
  max: ['favorisParcours.js', 'for (const id of a.aEcrire) { ids.push(id);', 'for (const id of a.aEcrire) { if (ids.length >= 3) continue; ids.push(id);'],   // un plafond fixe par envoi qui revient
  nouveaux: ['favorisParcours.js', 'const nouveau = (p) => depuis == null ||', 'const nouveau = (p) => true ||'],
  marge: ['FavorisEtapes.jsx', 'const peutEnvoyer = peutOuvrir && (!(p.bloquees || []).length || p.confirmeMarge);', 'const peutEnvoyer = peutOuvrir;'],
  histo: ['favorisParcours.js', 'x.personne === String(v.acheteur)', 'true'],
  suivi: ['AutomatisationFavoris.jsx', 'demarrerSuivi(j.vue);', ''],
  outils: ['FavorisVinted.jsx', "          {/* (11 nov., lot favoris-clair) « Plus d'outils » : plus de liste par personne", "          {lignes.map(x=><p key={x.id}>{x.body}</p>)}{/* "],
  envoi: ['AutomatisationFavoris.jsx', 'agirRef.current=agir;', "agirRef.current=agir;React.useEffect(()=>{if(selection.length&&!vue?.active)agir('lancer');},[selection.join(',')]);"],
};

async function construire(theme) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'favoris-clair-'));
  const main = fs.readFileSync(path.join(RACINE, 'src', 'main.jsx'), 'utf8') + '\n' + (fs.existsSync(path.join(RACINE, 'src', 'stylesApp.js')) ? fs.readFileSync(path.join(RACINE, 'src', 'stylesApp.js'), 'utf8') : '');
  const css = [...main.matchAll(/^import\s+'\.\/([^']+\.css)';/gm)].map((m) => path.join(RACINE, 'src', m[1]));
  const src = (f) => JSON.stringify(path.join(RACINE, 'src', f));
  const sombre = theme === 'sombre';
  fs.writeFileSync(path.join(dir, 'entree.jsx'), `
${css.map((c) => `import ${JSON.stringify(c)};`).join('\n')}
import React from 'react';
import {createRoot} from 'react-dom/client';
import FavorisVinted from ${src('FavorisVinted.jsx')};
import SuiviTravailHote from ${src('composants/SuiviTravail.jsx')};
import {ajouterSourceApp} from ${src('i18n/index.js')};
import FR from ${src('i18n/langues/fr.js')};
import * as TH from ${src('themeMineral.js')};
ajouterSourceApp(FR);
const PAL=${sombre}?(TH.MINERAL_DARK||TH.MINERAL):TH.MINERAL;
const v=TH.variablesTheme(PAL,${sombre});for(const [k,x] of Object.entries(v))document.documentElement.style.setProperty(k,x);
document.documentElement.setAttribute('data-theme','${sombre ? 'dark' : 'light'}');
document.body.style.background=PAL.bg;document.body.style.color=PAL.text;document.body.style.margin='0';
const ARTICLES=${JSON.stringify(ARTICLES)};
const PhotoVinted=({src,alt,repli,...r})=>src?<img src={src} alt={alt} {...r}/>:repli;
let n=0;
const executer=async()=>{n++;window.envois=(window.envois||0)+1;return n===3?{ok:false,data:{resultat:'refuse',raison:'offre_refusee',ecrits:1}}:{ok:true,data:{resultat:'envoye',ecrits:3}};};
function Banc(){
  return <div className="vrm-app-shell"><main className="vrm-main" style={{padding:'16px',boxSizing:'border-box'}}><FavorisVinted uid="${UID}" owner="${OWNER}" ownerActuel={()=>"${OWNER}"} base={location.origin} headers={()=>({})} nomCompte="compte_banc" chargementAutomatique={true}
    articlesVendus={new Set(${JSON.stringify(VENDUS)})} articleFavori={id=>ARTICLES[id]||null} PhotoVinted={PhotoVinted} ventesFavoris={${JSON.stringify(VENTES)}}
    extensionAuto={{disponible:true,raison:''}} favorisDisponible={true} favorisPerso={true} favorisRaison="" verifierExtension={async()=>({disponible:true})} ouvrirFavori={async x=>({ok:true,data:{ouvert:true,preuve:'confirmee'}})}
    executerFavori={executer} FermeAuRetour={()=>null}/></main></div>;
}
createRoot(document.getElementById('r')).render(<><Banc/><SuiviTravailHote/></>);
`);
  const mutant = MUTANT && MUTATIONS[MUTANT];
  const plugins = mutant ? [{ name: 'mutant', setup(b) { b.onLoad({ filter: new RegExp(mutant[0].replace('.', '\\.') + '$') }, (a) => { const t = fs.readFileSync(a.path, 'utf8'); if (!t.includes(mutant[1])) throw Error('mutation introuvable : ' + MUTANT); return { contents: t.replace(mutant[1], mutant[2]), loader: 'jsx' }; }); } }] : [];
  // JaugeActions lit la base par App.jsx (`lireTout`) : bouchonné ici (une jauge « 12 cette heure »).
  plugins.push({ name: 'jauge', setup(b) { b.onResolve({ filter: /JaugeActions\.jsx$/ }, () => ({ path: 'jauge-bouchon', namespace: 'b' })); b.onLoad({ filter: /.*/, namespace: 'b' }, () => ({ contents: `import React from 'react';export function useLignesActions(){return [[{id:'actions_compte_${UID}_0123456789abcdef',ts:Array.from({length:12},(_,i)=>${MAINT}-i*60000),max:'50',reserve:'5'}],${MAINT}];}export default function JaugeActions(){return <div data-jauge-bouchon>12/50</div>;}`, loader: 'jsx', resolveDir: path.join(RACINE, 'src') })); } });
  await esbuild.build({ entryPoints: [path.join(dir, 'entree.jsx')], bundle: true, outdir: path.join(dir, 'out'), format: 'esm', jsx: 'automatic', plugins, loader: { '.js': 'jsx', '.woff2': 'empty', '.woff': 'empty', '.png': 'empty', '.svg': 'empty', '.jpg': 'empty' }, nodePaths: [NM], logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{"MODE":"production","PROD":true,"DEV":false}' }, external: ['/fonts/*', '/images/*', '/textures/*'] });
  fs.writeFileSync(path.join(dir, 'out', 'index.html'), '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/entree.css"></head><body><div id="r"></div><script type="module" src="/entree.js"></script></body></html>');
  return path.join(dir, 'out');
}

(async () => {
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="96"><rect width="80" height="96" fill="hsl(${(n * 47) % 360},18%,${70 + (n % 3) * 6}%)"/></svg>`;
  for (const theme of THEMES) {
    const OUT = await construire(theme);
    const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
    let jobs, active, sauves, postes, t0;
    const remettre = () => { jobs = JSON.parse(JSON.stringify(JOBS0)); active = false; sauves = []; postes = []; t0 = Date.now(); };
    remettre();
    const srv = http.createServer((q, r) => {
      const u = decodeURIComponent(q.url);
      const json = (d, st = 200) => { r.writeHead(st, { 'content-type': 'application/json' }); r.end(JSON.stringify(d)); };
      const corpsReq = (f) => { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { let x = {}; try { x = JSON.parse(b || '{}'); } catch (_) {} f(x); }); };
      if (u.startsWith('/rest/v1/app_data')) {
        if (q.method === 'POST') return corpsReq((row) => { sauves.push(row); json([row]); });
        if (u.includes(`id=eq.harvest_${UID}_notifications`)) return json(JEU === 'vide' || JEU === 'absente' ? [] : [{ owner: OWNER, data: { type: 'notifications', uid: UID, domain: 'www.vinted.fr', capturedAt: iso(MAINT), payload: { notifications: NOTIFS } } }]);
        if (u.includes(`id=eq.vrm_favoris_reglages_${UID}`)) return json(sauves.length ? [sauves[sauves.length - 1]] : [{ id: `vrm_favoris_reglages_${UID}`, owner: OWNER, data: { version: 1, message: MESSAGE, pourcentage: 10, offreMode: 'pct', offreValeur: null, arrondi: false, intervalleMinutes: 6, intervalleMaxMinutes: null, envoisActifs: false } }]);
        return json([]);
      }
      if (u.startsWith('/api/compte')) {
        const serveur = MAINT + (Date.now() - t0);
        const vue = () => ({ active, raison: '', lot: active || jobs.some((x) => x.lot === 'L2') ? 'L2' : 'l1', prochain: null, intervalleMinutes: 0, jobs, auto: AUTO });
        const rep = (extra = {}) => json({ ok: true, serveur, vue: vue(), ...extra });
        if (q.method !== 'POST') return rep();
        return corpsReq((b) => {
          postes.push(b);
          if (b.action === 'lancer') {
            const sel = Array.isArray(b.selection) ? b.selection : [];
            sel.forEach((nid, i) => { const f = FAV.find((x) => x[0] === nid); jobs.push({ id: `${f ? f[2] : 0}:${8000 + i}`, notificationId: nid, etat: 'attente', lot: 'L2', offre: { mode: 'pct', valeur: 10 } }); });
            active = sel.length > 0; return rep();
          }
          if (b.action === 'suivant') { const j = jobs.find((x) => x.lot === 'L2' && x.etat === 'attente'); if (!j) { active = false; return rep(); } j.etat = 'reserve'; return rep({ travail: { ...j, jeton: 'j-' + j.notificationId, suivi: 's' } }); }
          if (b.action === 'terminer') { const j = jobs.find((x) => 'j-' + x.notificationId === b.jeton); if (j) { j.etat = b.resultat; if (b.raison) j.raison = b.raison; j.envoyeLe = j.traiteLe = serveur; } if (b.resultat !== 'envoye') active = false; if (!jobs.some((x) => x.lot === 'L2' && x.etat === 'attente')) active = false; return rep(); }
          if (b.action === 'arreter') { jobs.forEach((x) => { if (x.lot === 'L2' && x.etat === 'attente') x.etat = 'annule'; }); active = false; return rep(); }
          return rep();
        });
      }
      let f = u.split('?')[0]; if (f === '/') f = '/index.html';
      const p = path.join(OUT, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
    });
    await new Promise((res) => srv.listen(0, res));
    const PORT = srv.address().port;
    for (const tel of [true, false]) {
      remettre();
      const T = (tel ? '390' : '1512') + ' ' + theme + (JEU !== 'base' ? ' ' + JEU : '');
      const F = `${JEU}-${theme}-${tel ? '390' : '1512'}`;
      const ctx = await nav.newContext(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'fr-FR', timezoneId: 'Europe/Paris' } : { viewport: { width: 1512, height: 950 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
      const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      await pg.addInitScript((t) => { const vrai = Date.now.bind(Date); const decal = t - vrai(); Date.now = () => vrai() + decal; }, MAINT);
      await pg.route(/vinted\.net\//, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg(m ? Number(m[1]) : 1) }); });
      await pg.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector(FAV.length ? '[data-fc-etape="qui"] [data-fc-annonce]' : '[data-fc-vide]', { timeout: 15000 }).catch(() => {});
      await pg.waitForTimeout(800);
      dit(!errs.length, `${T} la page se monte sans erreur`, errs.join(' | '));
      await pg.screenshot({ path: path.join(SHOTS, `fc-${F}.png`) });
      for (const e of ['qui', 'quoi', 'quand', 'historique']) await pg.locator(`[data-fc-etape="${e}"]`).screenshot({ path: path.join(SHOTS, `fc-${F}-${e}.png`) }).catch(() => {});
      const commun = await pg.evaluate(() => {
        const sec = document.querySelector('[data-fc-page]');
        const vis = (e) => { const r = e.getBoundingClientRect(); const st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'; };
        const cibles = sec ? [...sec.querySelectorAll('button, a[href], summary, input, textarea')].filter(vis).map((e) => { const r = e.getBoundingClientRect(); const lab = e.closest('label'); const lr = lab ? lab.getBoundingClientRect() : r; return { t: (e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30), h: Math.max(r.height, e.type === 'checkbox' ? lr.height : 0), w: Math.max(r.width, e.type === 'checkbox' ? lr.width : 0) }; }) : [];
        const sat = (c) => { const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(c); if (!m || (m[4] !== undefined && Number(m[4]) < 0.2)) return null; const [r, g, b] = [m[1], m[2], m[3]].map(Number); return Math.max(r, g, b) - Math.min(r, g, b) > 60 ? [r, g, b] : null; };
        const permis = ([r, g, b]) => (b > 200 && r < 80 && g > 90 && g < 170) || (r > 140 && g > 50 && g < 200 && b < 90);
        const couleurs = sec ? [...sec.querySelectorAll('*')].filter(vis).filter((e) => !e.closest('[data-fc-auto]')).flatMap((e) => { const st = getComputedStyle(e); return [st.backgroundColor, st.color].map(sat).filter(Boolean).filter((x) => !permis(x)).map((x) => `${e.className || e.tagName}:${x}`); }) : [];
        return { texte: sec ? sec.innerText : '', cibles, couleurs, deb: document.documentElement.scrollWidth - document.documentElement.clientWidth, largeur: sec ? sec.getBoundingClientRect().width : 0, vide: sec?.getAttribute('data-fc-vide') || '', geste: !!document.querySelector('[data-fc-vide-geste]') };
      });
      if (tel) { const petits = commun.cibles.filter((c) => c.h < 43.5 || c.w < 43.5); dit(!petits.length, `${T} cibles au doigt ≥ 44 px`, petits.map((c) => `${c.t} ${Math.round(c.w)}×${Math.round(c.h)}`).join(' | ')); }
      dit(commun.deb <= 1, `${T} aucun débordement horizontal`, commun.deb + ' px');
      dit(!commun.couleurs.length, `${T} aucune couleur hors du bleu d’Apple et de l’ambre`, [...new Set(commun.couleurs)].slice(0, 6).join(' | '));
      if (!tel) dit(commun.largeur > 0 && commun.largeur <= 760, `${T} colonne ≤ 760 px`, commun.largeur);
      if (!FAV.length) {
        dit(commun.vide === (JEU === 'vide' ? 'absente' : 'absente') || commun.vide === 'aucun', `${T} état vide : une phrase`, commun.vide);
        dit(commun.geste && /Vinted/.test(commun.texte), `${T} état vide : le geste qui débloque (Ouvrir Vinted)`, commun.texte);
        await ctx.close(); continue;
      }
      // 1. QUI
      const qui = await pg.evaluate(() => [...document.querySelectorAll('[data-fc-etape="qui"] [data-fc-liste] [data-fc-annonce]')].map((e) => ({ item: e.getAttribute('data-fc-annonce'), n: Number(e.querySelector('[data-fc-personnes]')?.getAttribute('data-fc-personnes')), a: Number(e.getAttribute('data-fc-aecrire')) })));
      dit(JSON.stringify(qui.map((x) => Number(x.item)).sort()) === JSON.stringify(CHOISISSABLES.slice().sort()), `${T} QUI : les annonces aux NOUVEAUX favoris à écrire (${CHOISISSABLES.join(', ')})`, JSON.stringify(qui));
      dit(qui.every((x) => x.a === aEcrire(Number(x.item), false) && x.n === FAV.filter((f) => f[2] === Number(x.item)).length), `${T} QUI : chaque annonce dit son nombre de personnes et combien à écrire`, JSON.stringify(qui));
      const pseudosVus = PSEUDOS.filter((p) => commun.texte.includes(p));
      dit(!pseudosVus.length, `${T} aucun pseudo à l’écran (le nombre, jamais qui)`, pseudosVus.join(','));
      dit(!/\{username\}|\{Bonjour\|Salut\}/.test(await pg.evaluate(() => document.querySelector('[data-fc-bulle]')?.innerText || '')) && await pg.locator('[data-fc-bulle] [data-fc-jeton]').count() === 1, `${T} QUOI : l’aperçu porte la pastille « son pseudo », jamais la variable brute`);
      await pg.click('[data-fc-anciens-bascule]');
      await pg.waitForTimeout(200);
      const tous = await pg.evaluate(() => [...document.querySelectorAll('[data-fc-etape="qui"] [data-fc-liste] [data-fc-annonce]')].map((e) => [e.getAttribute('data-fc-annonce'), Number(e.getAttribute('data-fc-aecrire'))]));
      const attendus = [...new Set(FAV.map((f) => f[2]))].filter((it) => aEcrire(it, true) > 0);
      dit(tous.length === attendus.length && tous.every(([it, n]) => n === aEcrire(Number(it), true)), `${T} « Inclure les anciens » : ${attendus.length} annonces, les anciens favoris ajoutés`, JSON.stringify(tous));
      await pg.click('[data-fc-anciens-bascule]');
      await pg.waitForTimeout(200);
      // « Plus d'outils » : plus aucun pseudo (la liste par personne est retirée).
      await pg.click('[data-favoris-ouvrir]');
      await pg.waitForSelector('[data-favoris-feuille]', { state: 'attached', timeout: 5000 }).catch(() => {});
      await pg.waitForTimeout(300);
      const outils = await pg.evaluate(() => { const f = document.querySelector('.vrm-favoris-voile:not([hidden]) [data-favoris-feuille]'); return f ? { texte: f.innerText, cases: f.querySelectorAll('input[type=checkbox]').length } : null; });
      dit(outils && !PSEUDOS_ICI.some((p) => outils.texte.includes(p)) && outils.cases === 0, `${T} « Plus d’outils » : aucun pseudo, aucune case par personne`, outils && outils.texte.slice(0, 200));
      await pg.click('[data-favoris-feuille] .vrm-favoris-fermer').catch(() => {});
      await pg.waitForTimeout(200);
      // 2. tout choisir ⇒ le compte ; aperçu de l'offre
      await pg.click('[data-fc-tout]');
      await pg.waitForTimeout(200);
      const ch = await pg.evaluate(() => Number(document.querySelector('[data-fc-choisis]')?.getAttribute('data-fc-choisis')));
      dit(ch === N_TOUS, `${T} « Tout choisir » : ${N_TOUS} messages`, ch);
      const offre = await pg.evaluate(() => ({ v: document.querySelector('[data-fc-apercu-offre]')?.getAttribute('data-fc-apercu-offre'), l: document.querySelector('[data-fc-offre-ligne]')?.innerText || '' }));
      const ex = (qui.map((x) => Number(x.item)).find((it) => PRIX[it] != null) === Number(qui[0] && qui[0].item)) ? Number(qui[0].item) : null;   // l'aperçu montre la 1re annonce choisie
      if (ex) { const apres = Math.round(PRIX[ex] * 90) / 100; dit(Number(offre.v) === apres && offre.l.includes('−10 %'), `${T} QUOI : l’offre au centime (${PRIX[ex]} € → ${apres} €, −10 %)`, JSON.stringify(offre)); }
      // 3. QUAND : comme Vintex
      await pg.click('[data-fc-rythme="vintex"]');
      const phrase = await pg.evaluate(() => document.querySelector('[data-fc-rythme-phrase]')?.innerText || '');
      dit(/6 à 10 secondes/.test(phrase), `${T} QUAND : « Rapide » expliqué en une phrase (6 à 10 s)`, phrase);
      // 7. historique
      const h = await pg.evaluate(() => ({ achats: Number(document.querySelector('[data-fc-achats]')?.getAttribute('data-fc-achats')), envoyes: Number(document.querySelector('[data-fc-envoyes]')?.getAttribute('data-fc-envoyes')), sans: Number(document.querySelector('[data-fc-sans-acheteur]')?.getAttribute('data-fc-sans-acheteur') || 0), lignes: [...document.querySelectorAll('[data-fc-achat]')].map((e) => e.getAttribute('data-fc-achat')), lots: [...document.querySelectorAll('[data-fc-lot]')].map((e) => [e.getAttribute('data-fc-lot'), e.getAttribute('data-fc-lot-achats')]), groupes: Number(document.querySelector('[data-fc-groupes]')?.getAttribute('data-fc-groupes') || 0) }));
      dit(h.achats === 1 && JSON.stringify(h.lignes) === '["9001"]', `${T} historique : 1 achat après un message (même annonce ET même personne)`, JSON.stringify(h));
      dit(h.sans === 1, `${T} historique : la vente sans acheteur su est dite à part, pas comptée`, h.sans);
      dit(h.lots.some(([l, a]) => l === 'l1' && a === '1') && h.lots.some(([l, a]) => l === 'l0' && a === '0'), `${T} « Ce qui marche » : achats par envoi`, JSON.stringify(h.lots));
      dit(h.groupes === 1, `${T} offre groupée : 1 personne (identité prouvée par la file) sur plusieurs annonces`, h.groupes);
      // 4-5. récapitulatif et garde-fou
      dit(postes.every((x) => x.action !== 'lancer'), `${T} rien n’est lancé avant « Envoyer »`, JSON.stringify(postes.map((x) => x.action)));
      await pg.click('[data-fc-verifier]');
      await pg.waitForSelector('[data-fc-recap]', { timeout: 5000 }).catch(() => {});
      await pg.waitForTimeout(300);
      const rc = await pg.evaluate(() => { const l = document.querySelector('[data-fc-recap-ligne]'); return l ? { m: Number(l.getAttribute('data-fc-messages')), a: Number(l.getAttribute('data-fc-nannonces')), s: l.getAttribute('data-fc-secondes'), t: l.innerText, lim: document.querySelector('[data-fc-limite]')?.getAttribute('data-fc-limite'), g: Number(document.querySelector('[data-fc-limite]')?.getAttribute('data-fc-gestes')), garde: Number(document.querySelector('[data-fc-garde]')?.getAttribute('data-fc-garde') || 0), bloque: [...document.querySelectorAll('[data-fc-bloque]')].map((e) => [e.closest('[data-fc-recap-annonce]')?.getAttribute('data-fc-recap-annonce'), e.getAttribute('data-fc-bloque'), e.getAttribute('data-fc-marge')]), env: document.querySelector('[data-fc-envoyer]')?.disabled, garantie: /Aucune garantie/.test(document.querySelector('[data-fc-avertissement]')?.innerText || '') } : null; });
      const nM = N_TOUS;
      dit(rc && rc.m === nM && rc.a === CHOISISSABLES.length && Number(rc.s) === (nM - 1) * 8 && /environ/.test(rc.t), `${T} récap : ${nM} messages · ${CHOISISSABLES.length} annonces · environ ${(nM - 1) * 8} s`, JSON.stringify(rc));
      dit(rc && rc.g === nM * 3 && rc.lim === 'dedans', `${T} récap : ${nM * 3} gestes, dans la limite de 45/h (12 déjà pris)`, rc && rc.g + ' ' + rc.lim);
      const b9003 = rc && rc.bloque.find((x) => x[0] === '9003'), b9001 = rc && rc.bloque.find((x) => x[0] === '9001');
      dit(b9003 && b9003[1] === 'perte' && Number(b9003[2]) === 8550 - 9000, `${T} marge : 9003 achetée 90 €, offre 85,50 € ⇒ à perte (−4,50 €), bloquée`, JSON.stringify(rc && rc.bloque));
      dit(b9001 && b9001[1] === 'mini', `${T} marge : 9001 offre 58,50 € sous son prix mini 60 € ⇒ bloquée`, JSON.stringify(b9001));
      dit(rc && rc.garde === 2 && rc.env === true, `${T} « Envoyer » bloqué tant qu’il n’a pas confirmé`, JSON.stringify(rc && [rc.garde, rc.env]));
      dit(rc && rc.garantie, `${T} « Aucune garantie contre un blocage Vinted » reste dit`);
      if (tel && theme === 'clair') await pg.screenshot({ path: path.join(SHOTS, `fc-${F}-recap.png`) });
      if (!tel && theme === 'sombre') await pg.screenshot({ path: path.join(SHOTS, `fc-${F}-recap.png`) });
      await pg.click('[data-fc-confirme-marge]');
      dit(!(await pg.evaluate(() => document.querySelector('[data-fc-envoyer]')?.disabled)), `${T} confirmé ⇒ « Envoyer » possible`);
      dit(postes.every((x) => x.action !== 'lancer') && !(await pg.evaluate(() => window.envois || 0)), `${T} toujours rien de lancé ni envoyé avant SON clic`);
      // 6. envoyer ⇒ suivi commun
      await pg.click('[data-fc-envoyer]');
      await pg.waitForSelector('[data-suivi-travail="favoris"]', { timeout: 8000 }).catch(() => {});
      const lances = postes.filter((x) => x.action === 'lancer');
      dit(lances.length === 1 && lances[0].selection.length === nM, `${T} « Envoyer » : UN lancement, ${nM} destinataires`, JSON.stringify(lances.map((x) => x.selection)));
      const fige = await pg.evaluate(() => !!document.querySelector('[data-fc-page]')?.closest('[inert]'));
      dit(fige, `${T} VRM figé pendant l’envoi (inert)`);
      await pg.waitForTimeout(1200);
      if (tel && theme === 'clair') await pg.screenshot({ path: path.join(SHOTS, `fc-${F}-suivi.png`) });
      await pg.waitForFunction(() => ['fini', 'arrete'].includes(document.querySelector('[data-suivi-travail]')?.getAttribute('data-suivi-statut')), null, { timeout: 25000 }).catch(() => {});
      const s = await pg.evaluate(() => { const e = document.querySelector('[data-suivi-travail]'); const n = (k) => Number(document.querySelector(`[data-suivi-recap="${k}"]`)?.getAttribute('data-n') || 0); return e ? { st: e.getAttribute('data-suivi-statut'), n: e.getAttribute('data-suivi-n'), ok: n('reussies'), refus: n('refusees'), pas: n('pasCommencees'), texte: e.innerText } : null; });
      dit(s && s.ok === 2 && s.refus === 1, `${T} suivi : 2 envoyés ✓, 1 refusé`, JSON.stringify(s && { st: s.st, n: s.n, ok: s.ok, refus: s.refus, pas: s.pas }));
      dit(s && /offre de prix/i.test(s.texte), `${T} suivi : le refus dit sa raison (offre refusée)`, s && s.texte.slice(0, 300));
      dit(s && !PSEUDOS.some((p) => s.texte.includes(p)), `${T} suivi : aucun pseudo dans le journal`);
      dit(await pg.evaluate(() => window.envois || 0) === 3, `${T} l’extension (bouchon) a été appelée 3 fois, puis la file s’est arrêtée sur le refus`, await pg.evaluate(() => window.envois || 0));
      if (tel && theme === 'clair') await pg.screenshot({ path: path.join(SHOTS, `fc-${F}-fin.png`) });
      await ctx.close();
    }
    srv.close();
  }
  await nav.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — jeu ${JEU}${MUTANT ? ', mutant ' + MUTANT : ''} — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ banc interrompu : ' + e.stack); process.exit(1); });
