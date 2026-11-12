// ════════════════════════════════════════════════════════════════════════════
//  BANC — Les favoris PAR COMPTE, une liste du plus récent au plus ancien
//  (12 nov., ext. 5.372). Julien : « par compte et pas par articles, simplement
//  la liste du plus récent (en haut) au plus vieux en bas, tu enlèves ceux qui
//  sont liés à des articles vendus […] avec la possibilité à côté de chaque
//  favori de cliquer dessus pour le sélectionner ».
//  MONTE le vrai src/FavorisVinted.jsx (FavorisEtapes, FavorisListeCompte), les
//  feuilles de style de l'app, clair et sombre, 390 px tactile et 1512 px. Base
//  SYNTHÉTIQUE (aucune donnée réelle) : 2 comptes Vinted, des favoris datés
//  mélangés, un sans date, un article vendu, un article plus en ligne (lecture
//  complète et fraîche qui ne l'a pas), un « pas su » (lecture ancienne).
//  Il juge (data-* et nombres rendus) :
//   1. le compte de l'onglet d'abord, puis « Autres comptes » ;
//   2. l'ordre : dates rendues (data-fav-date) décroissantes, le sans-date en bas ;
//   3. vendu et plus en ligne : absents ; « pas su » : présent, « à vérifier »,
//      pas coché par « Tout sélectionner » ;
//   4. une case par favori, cible ≥ 44 px ; « Tout sélectionner » ; le bouton dit
//      le nombre ; « Envoyer » lance EXACTEMENT les favoris cochés ;
//   5. le compte de l'onglet est un AUTRE ⇒ aucune case sur ce compte, rien à envoyer ;
//   6. l'autre compte, déplié : sa liste à lire, sans case ;
//   7. aucun débordement, aucune erreur, captures.
//  FC_THEME = clair · sombre. FC_MUTANT = ordre · vendu · onglet · case (§6.1 : chacun doit rougir).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = process.env.RACINE || path.join(__dirname, '..', '..');
const NM = [path.join(RACINE, 'node_modules'), path.join(__dirname, '..', '..', 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable'); process.exit(1); }
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const THEMES = process.env.FC_THEME ? [process.env.FC_THEME] : ['clair', 'sombre'];
const MUTANT = process.env.FC_MUTANT || '';
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-favoris-compte');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 400) : '')); } };

const OWNER = '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c', UID = '4242', AUTRE = '5151';
const MAINT = Date.parse('2026-11-12T15:00:00Z'), H = 3600000, J = 24 * H;
const iso = (t) => new Date(t).toISOString();
// [id, pseudo, article, âge (ms) | null = sans date]
const FAV = [
  ['n1', 'lea_banc', 9001, 9 * H], ['n2', 'hugo_banc', 9002, 30 * 60000], ['n3', 'ines_banc', 9003, 26 * H],
  ['n4', 'tom_banc', 9004, 2 * H],      // article VENDU
  ['n5', 'zoe_banc', 9007, 3 * H],      // article plus en ligne (lecture complète fraîche sans lui)
  ['n6', 'paul_banc', 9006, 4 * H],     // article « pas su » (à confirmer)
  ['n7', 'emma_banc', 9005, 5 * 60000], ['n8', 'noe_banc', 9008, 50 * H], ['n9', 'jade_banc', 9002, null],
  ['n10', 'lina_banc', 9001, 7 * H],
];
const FAV_AUTRE = [['m1', 'max_banc', 9101, 1 * H], ['m2', 'sam_banc', 9102, 10 * H]];
const TITRES = { 9001: 'Nike Air Max 90 blanche', 9002: 'Adidas Samba noire', 9003: 'New Balance 550 verte', 9004: 'Asics Gel-Lyte III', 9005: 'Jordan 1 Mid bleue', 9006: 'Puma Suede rouge', 9007: 'Sac Longchamp noir', 9008: 'Converse Chuck 70', 9101: 'Veja V-10 blanche', 9102: 'Salomon XT-6' };
const corps = (login, item) => `${login} a marqué ton article ${TITRES[item].toLowerCase()} comme favori`;
const notifs = (L, base) => L.map(([id, login, item, age], k) => ({ id, body: corps(login, item), user_id: base + k, link: `/items/${item}/want_it/new?offering_id=${7000 + k}`, image: { url: `https://images1.vinted.net/t/b${item}/f800/photo.jpeg?s=x` }, ...(age == null ? {} : { updated_at: iso(MAINT - age) }) }));
const ARTICLES = Object.fromEntries(Object.entries(TITRES).map(([id, t], i) => [id, { titre: t, numero: String(101 + i), photo: `https://images1.vinted.net/t/b${id}/f800/photo.jpeg`, prix: 50 + i * 5, fiche: null }]));
const acc = (u) => ({ vinted_user_id: u });
const LISTINGS = {
  items: [9001, 9002, 9003, 9004, 9005, 9008].map((id) => ({ id, _acc: acc(UID) })).concat([9101, 9102].map((id) => ({ id, _acc: acc(AUTRE) }))),
  aConfirmer: [{ id: 9006, _acc: acc(UID) }],
  lues: { [UID]: MAINT - 2 * H, [AUTRE]: MAINT - 3 * H }, complets: { [UID]: true, [AUTRE]: true }, ko: [], error: false,
};
const VENDUS = ['9004'];
const MONTRES = FAV.filter(([, , it]) => it !== 9004 && it !== 9007);
const ORDRE = MONTRES.slice().sort((a, b) => (a[3] == null) - (b[3] == null) || (a[3] || 0) - (b[3] || 0)).map((f) => f[0]);
const PAR_DEFAUT = MONTRES.filter(([, , it]) => it !== 9006).map((f) => f[0]);

const MUTATIONS = {
  ordre: ['favorisParCompte.js', 'out.sort((a, b) => (a.date == null) - (b.date == null) || (b.date || 0) - (a.date || 0)', 'out.sort((a, b) => (a.date == null) - (b.date == null) || (a.date || 0) - (b.date || 0)'],
  vendu: ['favorisParCompte.js', "if (vendus && typeof vendus.has === 'function' && vendus.has(id)) return 'vendu';", ''],
  onglet: ['FavorisVinted.jsx', 'const selectionnable=ongletSu&&String(uidOnglet)===String(uid);', 'const selectionnable=true;'],
  envoyable: ['favorisParCompte.js', "if (!chaine(uidOnglet) || chaine(uid) !== chaine(uidOnglet)) return [];", ''],
  case: ['favoris-clair.css', '.vrm-fpc-case { flex: none; width: 44px; height: 44px;', '.vrm-fpc-case { flex: none; width: 24px; height: 24px;'],
};

async function construire(theme, onglet) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'favoris-compte-'));
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
const executer=async()=>{window.envois=(window.envois||0)+1;return {ok:true,data:{resultat:'envoye',ecrits:2}};};
function Banc(){
  return <div className="vrm-app-shell"><main className="vrm-main" style={{padding:'16px',boxSizing:'border-box'}}><FavorisVinted uid="${UID}" owner="${OWNER}" ownerActuel={()=>"${OWNER}"} base={location.origin} headers={()=>({})} nomCompte="compte_banc_a" chargementAutomatique={true}
    uidOnglet="${onglet}" autresComptes={[{uid:"${UID}",nom:"compte_banc_a"},{uid:"${AUTRE}",nom:"compte_banc_b"}]} listingsFavoris={${JSON.stringify(LISTINGS)}}
    articlesVendus={new Set(${JSON.stringify(VENDUS)})} articleFavori={id=>ARTICLES[id]||null} PhotoVinted={PhotoVinted} ventesFavoris={[]}
    extensionAuto={{disponible:true,raison:''}} favorisDisponible={true} favorisPerso={true} favorisRaison="" verifierExtension={async()=>({disponible:true})} ouvrirFavori={async()=>({ok:true,data:{ouvert:true,preuve:'confirmee'}})}
    executerFavori={executer} FermeAuRetour={()=>null}/></main></div>;
}
createRoot(document.getElementById('r')).render(<><Banc/><SuiviTravailHote/></>);
`);
  const mutant = MUTANT && MUTATIONS[MUTANT];
  const plugins = [];
  if (mutant) plugins.push({ name: 'mutant', setup(b) { b.onLoad({ filter: new RegExp(mutant[0].replace('.', '\\.') + '$') }, (a) => { const t = fs.readFileSync(a.path, 'utf8'); if (!t.includes(mutant[1])) throw Error('mutation introuvable : ' + MUTANT); return { contents: t.replace(mutant[1], mutant[2]), loader: /\.css$/.test(a.path) ? 'css' : /\.jsx$/.test(a.path) ? 'jsx' : 'js', resolveDir: path.dirname(a.path) }; }); } });
  plugins.push({ name: 'jauge', setup(b) { b.onResolve({ filter: /JaugeActions\.jsx$/ }, () => ({ path: 'jauge-bouchon', namespace: 'b' })); b.onLoad({ filter: /.*/, namespace: 'b' }, () => ({ contents: `import React from 'react';export function useLignesActions(){return [[{id:'actions_compte_${UID}_x',n:12,at:Date.now()}]];}export default function JaugeActions(){return null;}export function JaugesComptes(){return null;}`, loader: 'jsx', resolveDir: RACINE })); } });
  await esbuild.build({ entryPoints: [path.join(dir, 'entree.jsx')], bundle: true, outdir: path.join(dir, 'out'), format: 'esm', jsx: 'automatic', nodePaths: [NM], plugins, loader: { '.js': 'jsx', '.woff2': 'empty', '.woff': 'empty', '.png': 'empty', '.svg': 'empty', '.jpg': 'empty' }, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
  fs.writeFileSync(path.join(dir, 'out', 'index.html'), '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/entree.css"></head><body><div id="r"></div><script type="module" src="/entree.js"></script></body></html>');
  return { out: path.join(dir, 'out'), dir };
}

(async () => {
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="96"><rect width="80" height="96" fill="hsl(${(n * 47) % 360},18%,${70 + (n % 3) * 6}%)"/></svg>`;
  for (const theme of THEMES) for (const onglet of [UID, AUTRE]) {
    const { out: OUT, dir } = await construire(theme, onglet);
    const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
    const postes = [];
    const srv = http.createServer((q, r) => {
      const u = decodeURIComponent(q.url);
      const json = (d, st = 200) => { r.writeHead(st, { 'content-type': 'application/json' }); r.end(JSON.stringify(d)); };
      const corpsReq = (f) => { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { let x = {}; try { x = JSON.parse(b || '{}'); } catch (_) {} f(x); }); };
      if (u.startsWith('/rest/v1/app_data')) {
        if (q.method === 'POST') return corpsReq((row) => json([row]));
        if (u.includes(`id=eq.harvest_${UID}_notifications`)) return json([{ owner: OWNER, data: { type: 'notifications', uid: UID, domain: 'www.vinted.fr', capturedAt: iso(MAINT), payload: { notifications: notifs(FAV, 1000) } } }]);
        if (u.includes(`id=eq.harvest_${AUTRE}_notifications`)) return json([{ owner: OWNER, data: { type: 'notifications', uid: AUTRE, domain: 'www.vinted.fr', capturedAt: iso(MAINT), payload: { notifications: notifs(FAV_AUTRE, 2000) } } }]);
        if (u.includes('id=eq.vrm_favoris_reglages_')) return json([{ id: `vrm_favoris_reglages_${UID}`, owner: OWNER, data: { version: 1, message: 'Salut {username}, merci pour ton favori !', pourcentage: null, offreMode: null, offreValeur: null, arrondi: false, intervalleMinutes: 0, intervalleMaxMinutes: null, envoisActifs: false, enregistres: true } }]);
        return json([]);
      }
      if (u.startsWith('/api/compte')) {
        const rep = () => json({ ok: true, serveur: MAINT, vue: { active: false, raison: '', lot: null, prochain: null, intervalleMinutes: 0, jobs: [], auto: { reglages: { version: 1, actif: false }, etat: 'eteint', envois: [], journal: [], prochain: null } } });
        if (q.method !== 'POST') return rep();
        return corpsReq((b) => { postes.push(b); rep(); });
      }
      let f = u.split('?')[0]; if (f === '/') f = '/index.html';
      const p = path.join(OUT, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
    });
    await new Promise((res) => srv.listen(Number(process.env.BANC_PORT) || 0, res));
    const PORT = srv.address().port;
    for (const tel of [true, false]) {
      postes.length = 0;
      const T = (tel ? '390' : '1512') + ' ' + theme + (onglet === UID ? '' : ' (onglet sur l’autre compte)');
      const F = `${theme}-${tel ? '390' : '1512'}${onglet === UID ? '' : '-autre'}`;
      const ctx = await nav.newContext(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'fr-FR', timezoneId: 'Europe/Paris' } : { viewport: { width: 1512, height: 950 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
      const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      await pg.addInitScript((t) => { const vrai = Date.now.bind(Date); const decal = t - vrai(); Date.now = () => vrai() + decal; }, MAINT);
      await pg.route(/vinted\.net\//, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg(m ? Number(m[1]) : 1) }); });
      await pg.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-fav-ligne]', { timeout: 15000 }).catch(() => {});
      await pg.waitForTimeout(600);
      dit(!errs.length, `${T} la page se monte sans erreur`, errs.join(' | '));
      await pg.locator('[data-fc-etape="qui"]').screenshot({ path: path.join(SHOTS, `fpc-${F}-qui.png`) }).catch(() => {});
      const L = await pg.evaluate((uid) => [...document.querySelectorAll(`[data-fav-liste="${uid}"] [data-fav-ligne]`)].map((e) => ({ id: e.getAttribute('data-fav-id'), date: e.getAttribute('data-fav-date'), art: e.getAttribute('data-fav-article'), cases: e.querySelectorAll('input[type=checkbox]').length, quand: e.querySelector('[data-fav-quand]')?.innerText || '' })), UID);
      const sections = await pg.evaluate(() => ({ tete: document.querySelector('[data-fav-section]')?.getAttribute('data-fav-section'), autres: [...document.querySelectorAll('[data-fav-autre]')].map((e) => e.getAttribute('data-fav-autre')), onglet: document.querySelector('[data-fav-section] [data-fav-compte-tete]')?.getAttribute('data-fav-onglet') }));
      // 1. compte de l'onglet d'abord
      dit(sections.tete === UID && JSON.stringify(sections.autres) === JSON.stringify([AUTRE]), `${T} le compte ${UID} en tête, puis « Autres comptes » (${AUTRE})`, JSON.stringify(sections));
      // 2. ordre par dates RENDUES
      const dates = L.filter((x) => x.date !== '').map((x) => Number(x.date));
      dit(dates.every((d, i) => i === 0 || d <= dates[i - 1]) && L.length && L[L.length - 1].date === '' && L.filter((x) => x.date === '').length === 1, `${T} du plus récent au plus ancien (dates rendues), le sans-date en bas`, JSON.stringify(L.map((x) => x.id + ':' + x.date)));
      dit(JSON.stringify(L.map((x) => x.id)) === JSON.stringify(ORDRE), `${T} la liste exacte : ${ORDRE.join(' ')}`, L.map((x) => x.id).join(' '));
      // 3. vendu et plus en ligne absents ; pas su présent, à vérifier
      dit(!L.some((x) => x.id === 'n4') && !L.some((x) => x.id === 'n5'), `${T} favori d’un article vendu (n4) et plus en ligne (n5) : absents`, L.map((x) => x.id).join(' '));
      const n6 = L.find((x) => x.id === 'n6');
      dit(n6 && n6.art === 'passu', `${T} « pas su » (lecture ancienne) : présent, marqué à vérifier`, JSON.stringify(n6));
      const retires = await pg.evaluate(() => Number(document.querySelector('[data-fav-section] [data-fav-retires]')?.getAttribute('data-fav-retires') || 0));
      dit(retires === 2, `${T} « 2 favoris d’articles vendus ou retirés : cachés » est dit`, retires);
      // 6. l'autre compte, déplié
      await pg.click(`[data-fav-autre="${AUTRE}"] > summary`);
      await pg.waitForSelector(`[data-fav-liste="${AUTRE}"] [data-fav-ligne]`, { timeout: 5000 }).catch(() => {});
      const A = await pg.evaluate((u) => [...document.querySelectorAll(`[data-fav-liste="${u}"] [data-fav-ligne]`)].map((e) => [e.getAttribute('data-fav-id'), e.querySelectorAll('input').length]), AUTRE);
      dit(JSON.stringify(A) === JSON.stringify([['m1', 0], ['m2', 0]]), `${T} l’autre compte : sa liste, du plus récent au plus ancien, à lire (aucune case)`, JSON.stringify(A));
      if (onglet === UID) {
        // 4. cases, Tout sélectionner, nombre, envoi exact
        dit(L.every((x) => x.cases === 1), `${T} une case par favori`, JSON.stringify(L.map((x) => x.cases)));
        if (tel) {
          const tailles = await pg.evaluate(() => [...document.querySelectorAll('[data-fav-liste] .vrm-fpc-case')].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
          dit(tailles.length && tailles.every(([w, h]) => w >= 44 && h >= 44), `${T} chaque case a une cible ≥ 44 px`, JSON.stringify(tailles.slice(0, 3)));
          const tout = await pg.evaluate(() => { const b = document.querySelector('[data-fav-tout]'); const r = b && b.getBoundingClientRect(); return r ? [r.width, r.height] : null; });
          dit(tout && tout[1] >= 43.5, `${T} « Tout sélectionner » ≥ 44 px`, JSON.stringify(tout));
        }
        await pg.click('[data-fav-tout]');
        await pg.waitForTimeout(200);
        const coches = await pg.evaluate(() => [...document.querySelectorAll('[data-fav-ligne][data-fav-coche="1"]')].map((e) => e.getAttribute('data-fav-id')));
        dit(JSON.stringify(coches.slice().sort()) === JSON.stringify(PAR_DEFAUT.slice().sort()), `${T} « Tout sélectionner » : ${PAR_DEFAUT.length} favoris, pas le « à vérifier »`, coches.join(' '));
        await pg.click('[data-fav-id="n1"] [data-fav-case]');
        await pg.click('[data-fav-id="n6"] [data-fav-case]');
        await pg.waitForTimeout(200);
        const voulus = PAR_DEFAUT.filter((x) => x !== 'n1').concat(['n6']);
        const bouton = await pg.evaluate(() => { const b = document.querySelector('[data-fc-verifier]'); return b ? { n: Number(b.getAttribute('data-fc-n')), t: b.innerText } : null; });
        dit(bouton && bouton.n === voulus.length && bouton.t.includes(String(voulus.length)), `${T} le bouton d’envoi dit le nombre sélectionné (${voulus.length})`, JSON.stringify(bouton));
        if (tel && theme === 'clair') await pg.screenshot({ path: path.join(SHOTS, `fpc-${F}-coches.png`), fullPage: true });
        await pg.click('[data-fc-verifier]');
        await pg.waitForSelector('[data-fc-envoyer]', { timeout: 5000 }).catch(() => {});
        dit(postes.every((x) => x.action !== 'lancer'), `${T} rien n’est lancé avant « Envoyer »`);
        await pg.click('[data-fc-envoyer]').catch(() => {});
        await pg.waitForTimeout(800);
        const lances = postes.filter((x) => x.action === 'lancer');
        dit(lances.length === 1 && JSON.stringify((lances[0].selection || []).slice().sort()) === JSON.stringify(voulus.slice().sort()), `${T} « Envoyer » lance EXACTEMENT les favoris cochés`, JSON.stringify(lances.map((x) => x.selection)));
      } else {
        // 5. l'onglet est sur l'autre compte : rien de cochable ici
        dit(L.every((x) => x.cases === 0) && !(await pg.locator('[data-fav-tout]').count()), `${T} compte qui n’est pas celui de l’onglet : aucune case, pas de « Tout sélectionner »`, JSON.stringify(L.map((x) => x.cases)));
        dit(await pg.evaluate(() => document.querySelector('[data-fc-verifier]')?.disabled === true), `${T} rien à envoyer au nom d’un autre compte`);
      }
      const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      dit(deb <= 1, `${T} aucun débordement horizontal`, deb);
      await pg.screenshot({ path: path.join(SHOTS, `fpc-${F}.png`), fullPage: !tel });
      await ctx.close();
    }
    srv.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  await nav.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s)${MUTANT ? ' — mutant ' + MUTANT : ''} — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ banc interrompu : ' + e.stack); process.exit(1); });
