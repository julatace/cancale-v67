// ════════════════════════════════════════════════════════════════════════════
//  BANC — « Très aimées, pas vendues » (13 nov., lot 31, point 31 de Julien) :
//  les annonces très mises en favori mais pas vendues, et l'offre proposée à
//  leurs favoris par le flux EXISTANT des messages aux favoris.
//  MONTE le vrai src/FavorisVinted.jsx (FavorisEtapes, FavorisSansVente,
//  FavorisListeCompte), les feuilles de style de l'app, clair et sombre, 390 px
//  tactile et 1512 px. Base SYNTHÉTIQUE (aucune donnée réelle) : 2 comptes.
//  Il juge (data-* et nombres rendus, jamais un libellé) :
//   1. la liste du compte de l'onglet : ≥ 3 favoris LUS, ≥ 14 j, pas vendue, pas
//      d'un autre compte, triée par favoris décroissants ; photo, N°, prix,
//      favoris, jours ; favoris pas lus ⇒ pas listée, raison dite ;
//   2. à qui écrire : les favoris pas encore contactés de CETTE annonce, une
//      personne une fois (un déjà contacté n'est pas recompté) ;
//   3. l'offre : −10 % proposé quand l'achat est connu, limitée à l'achat + 10 % ;
//      achat inconnu ⇒ rien proposé, geste fermé, jusqu'à SA saisie ;
//   4. le geste pré-remplit le flux (favoris cochés EXACTEMENT, offre −x %) et ne
//      lance RIEN ; « Envoyer » lance exactement ces favoris avec cette offre ;
//   5. une offre retouchée sous l'achat + 10 % ⇒ « Envoyer » fermé, dit ;
//   6. l'onglet sur un AUTRE compte ⇒ aucun geste ; les autres comptes à lire ;
//   7. N réglable ; cibles ≥ 44 px ; aucun débordement, aucune erreur, captures.
//  SV_THEME = clair · sombre. SV_MUTANT = dedup · prefill · onglet · refus · tri (§6.1 : chacun doit rougir).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = process.env.RACINE || path.join(__dirname, '..', '..');
const NM = [path.join(RACINE, 'node_modules'), path.join(__dirname, '..', '..', 'node_modules'), path.join(__dirname, '..', '..', '..', '..', '..', 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable'); process.exit(1); }
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const THEMES = process.env.SV_THEME ? [process.env.SV_THEME] : ['clair', 'sombre'];
const MUTANT = process.env.SV_MUTANT || '';
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-favoris-sans-vente');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 400) : '')); } };

const OWNER = '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d', UID = '4242', AUTRE = '5151';
const MAINT = Date.parse('2026-11-13T15:00:00Z'), H = 3600000, J = 24 * H;
const iso = (t) => new Date(t).toISOString();
// Les annonces (forme de l'app : `favourites`, `price`, `_acc`). jours / achat : par la fiche.
const A = {
  9001: { t: 'Nike Air Max 90 blanche', fav: 12, prix: 60, jours: 20, achat: 30, num: '12' },
  9002: { t: 'Adidas Samba noire', fav: 5, prix: 40, jours: 30, achat: null, num: '7' },
  9003: { t: 'New Balance 550 verte', fav: 2, prix: 45, jours: 40, achat: 20, num: '3' },      // sous le seuil
  9004: { t: 'Asics Gel-Lyte III', fav: 30, prix: 80, jours: 40, achat: 20, num: '4' },        // VENDUE
  9005: { t: 'Jordan 1 Mid bleue', fav: 8, prix: 90, jours: 10, achat: 40, num: '5' },         // 10 j
  9006: { t: 'Puma Suede rouge', fav: null, prix: 50, jours: 40, achat: 20, num: '6' },         // favoris pas lus
  9007: { t: 'Converse Chuck 70', fav: 4, prix: 50, jours: 15, achat: 44, num: '9' },          // plancher 49 €
  9101: { t: 'Veja V-10 blanche', fav: 20, prix: 70, jours: 40, achat: 30, num: '21' },        // autre compte
};
const LISTINGS = {
  items: Object.entries(A).map(([id, a]) => ({ id, title: a.t, price: { amount: String(a.prix) + '.0', currency_code: 'EUR' }, favourites: a.fav, _acc: { vinted_user_id: id === '9101' ? AUTRE : UID } })),
  aConfirmer: [], lues: { [UID]: MAINT - 2 * H, [AUTRE]: MAINT - 3 * H }, complets: { [UID]: true, [AUTRE]: true }, ko: [], error: false,
};
const ARTICLES = Object.fromEntries(Object.entries(A).map(([id, a]) => [id, { titre: a.t, numero: a.num, photo: `https://images1.vinted.net/t/b${id}/f800/photo.jpeg`, prix: a.prix, fiche: a.achat == null ? null : { numero: a.num, buyPrice: String(a.achat) }, jours: a.jours, achat: a.achat }]));
const VENDUS = ['9004'];
// [id, pseudo, article, user_id, âge]
const FAV = [
  ['n1', 'lea_banc', 9001, 1001, 2 * H], ['n2', 'hugo_banc', 9001, 1002, 5 * H],
  ['n3', 'ines_banc', 9001, 1003, 40 * H],     // déjà contactée (envoyé)
  ['n4', 'lea_banc', 9001, 1001, 60 * H],      // la MÊME personne que n1 (deuxième favori)
  ['n5', 'tom_banc', 9002, 1005, 3 * H], ['n6', 'zoe_banc', 9007, 1006, 7 * H], ['n7', 'max_banc', 9004, 1007, 1 * H],
];
const corps = (login, item) => `${login} a marqué ton article ${A[item].t.toLowerCase()} comme favori`;
const notifs = FAV.map(([id, login, item, user, age]) => ({ id, body: corps(login, item), user_id: user, link: `/items/${item}/want_it/new?offering_id=${7000 + user}`, image: { url: `https://images1.vinted.net/t/b${item}/f800/photo.jpeg?s=x` }, updated_at: iso(MAINT - age) }));
const JOBS = [{ id: '9001:1003', notificationId: 'n3', etat: 'envoye', lot: 'L1', envoyeLe: MAINT - 30 * H, traiteLe: MAINT - 30 * H }];
const ORDRE = ['9001', '9002', '9007'];

const MUTATIONS = {
  dedup: ['favorisSansVente.js', 'if (p && (contactees.has(p) || personnes.has(p))) continue;', ''],
  prefill: ['FavorisVinted.jsx', "setReduction(String(o.pct));", ''],
  onglet: ['FavorisVinted.jsx', 'const selectionnable=ongletSu&&String(uidOnglet)===String(uid);', 'const selectionnable=true;'],
  refus: ['FavorisEtapes.jsx', '&& !p.refus;', ';'],
  tri: ['favorisSansVente.js', 'out.sort((a, b) => b.favoris - a.favoris', 'out.sort((a, b) => a.favoris - b.favoris'],
};

async function construire(theme, onglet) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'favoris-sv-'));
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
function Banc(){
  return <div className="vrm-app-shell"><main className="vrm-main" style={{padding:'16px',boxSizing:'border-box'}}><FavorisVinted uid="${UID}" owner="${OWNER}" ownerActuel={()=>"${OWNER}"} base={location.origin} headers={()=>({})} nomCompte="compte_banc_a" chargementAutomatique={true}
    uidOnglet="${onglet}" autresComptes={[{uid:"${UID}",nom:"compte_banc_a"},{uid:"${AUTRE}",nom:"compte_banc_b"}]} listingsFavoris={${JSON.stringify(LISTINGS)}}
    articlesVendus={new Set(${JSON.stringify(VENDUS)})} articleFavori={id=>ARTICLES[id]||null} PhotoVinted={PhotoVinted} ventesFavoris={[]}
    extensionAuto={{disponible:true,raison:''}} favorisDisponible={true} favorisPerso={true} favorisRaison="" verifierExtension={async()=>({disponible:true})} ouvrirFavori={async()=>({ok:true,data:{ouvert:true,preuve:'confirmee'}})}
    executerFavori={async()=>({ok:true,data:{resultat:'envoye',ecrits:3}})} FermeAuRetour={()=>null}/></main></div>;
}
try{localStorage.removeItem('vrm_sans_vente_favoris_min');}catch{}
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

const lignesSv = (pg, uid) => pg.evaluate((u) => [...document.querySelectorAll(`[data-sv-liste="${u}"] [data-sv-annonce]`)].map((e) => ({ id: e.getAttribute('data-sv-annonce'), fav: Number(e.getAttribute('data-sv-favoris')), jours: Number(e.getAttribute('data-sv-jours')), prix: Number(e.getAttribute('data-sv-prix')), n: e.getAttribute('data-sv-n'), offre: e.getAttribute('data-sv-offre'), pct: e.getAttribute('data-sv-pct'), etat: e.getAttribute('data-sv-etat'), num: e.querySelector('[data-sv-num]')?.getAttribute('data-sv-num') || '', photo: !!e.querySelector('img'), bouton: e.querySelector('[data-sv-proposer]') ? (e.querySelector('[data-sv-proposer]').disabled ? 'ferme' : 'ouvert') : 'aucun', deja: e.querySelector('[data-sv-deja]')?.getAttribute('data-sv-deja') })), uid);

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
        if (u.includes(`id=eq.harvest_${UID}_notifications`)) return json([{ owner: OWNER, data: { type: 'notifications', uid: UID, domain: 'www.vinted.fr', capturedAt: iso(MAINT), payload: { notifications: notifs } } }]);
        if (u.includes('id=eq.vrm_favoris_reglages_')) return json([{ id: `vrm_favoris_reglages_${UID}`, owner: OWNER, data: { version: 1, message: 'Salut {username}, merci pour ton favori !', pourcentage: null, offreMode: null, offreValeur: null, arrondi: false, intervalleMinutes: 0, intervalleMaxMinutes: null, envoisActifs: false, enregistres: true } }]);
        return json([]);
      }
      if (u.startsWith('/api/compte')) {
        const rep = () => json({ ok: true, serveur: MAINT, vue: { active: false, raison: '', lot: null, prochain: null, intervalleMinutes: 0, jobs: JOBS, auto: { reglages: { version: 1, actif: false }, etat: 'eteint', envois: [], journal: [], prochain: null } } });
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
      await pg.waitForSelector('[data-sv-annonce]', { timeout: 5000 }).catch(() => {});
      await pg.waitForTimeout(800);
      dit(!errs.length, `${T} la page se monte sans erreur`, errs.join(' | '));
      await pg.locator('[data-fc-etape="sans-vente"]').screenshot({ path: path.join(SHOTS, `sv-${F}-liste.png`) }).catch(() => {});
      const L = await lignesSv(pg, UID);
      // 1. la liste
      dit(JSON.stringify(L.map((x) => x.id)) === JSON.stringify(ORDRE), `${T} la liste : ≥ 3 favoris, ≥ 14 j, pas vendue, ce compte, par favoris décroissants (${ORDRE.join(' ')})`, L.map((x) => x.id).join(' '));
      dit(L.length === 3 && L.every((x) => x.fav === A[x.id].fav && x.jours === A[x.id].jours && x.prix === A[x.id].prix && x.num === A[x.id].num && x.photo), `${T} chaque ligne : photo, N°, prix, favoris, jours en ligne`, JSON.stringify(L));
      const ec = await pg.evaluate(() => { const e = document.querySelector('[data-sv-compte] [data-sv-ecartees]'); return e ? JSON.parse(e.getAttribute('data-sv-ecartees')) : null; });
      dit(ec && ec.favoris === 1, `${T} favoris pas lus (9006) : pas listée, la raison dite`, JSON.stringify(ec));
      // les autres comptes, à lire
      await pg.click('[data-sv-autres] > summary', { timeout: 4000 }).catch(() => {});
      await pg.waitForTimeout(200);
      const B = await lignesSv(pg, AUTRE);
      dit(JSON.stringify(B.map((x) => [x.id, x.bouton])) === JSON.stringify([['9101', 'aucun']]), `${T} autres comptes : leur liste, à lire (aucun geste)`, JSON.stringify(B));
      // 7. N réglable
      await pg.fill('[data-sv-seuil]', '10', { timeout: 4000 }).catch(() => {});
      await pg.waitForTimeout(200);
      const L10 = await lignesSv(pg, UID);
      dit(JSON.stringify(L10.map((x) => x.id)) === JSON.stringify(['9001']), `${T} N = 10 ⇒ seule 9001`, L10.map((x) => x.id).join(' '));
      await pg.fill('[data-sv-seuil]', '3', { timeout: 4000 }).catch(() => {});
      await pg.waitForTimeout(200);
      if (onglet === UID) {
        const l1 = L.find((x) => x.id === '9001'), l2 = L.find((x) => x.id === '9002'), l7 = L.find((x) => x.id === '9007');
        // 2. à qui écrire
        dit(l1 && l1.n === '2' && l1.deja === '1', `${T} 9001 : 2 favoris à qui écrire (une personne une fois), 1 déjà contacté`, JSON.stringify(l1));
        // 3. l'offre
        dit(l1 && l1.etat === 'ok' && l1.pct === '10' && Number(l1.offre) === 54 && l1.bouton === 'ouvert', `${T} 9001 (achat 30 €) : −10 % proposé, 54 €`, JSON.stringify(l1));
        dit(l7 && l7.etat === 'ok' && l7.pct === '2' && Number(l7.offre) === 49, `${T} 9007 (achat 44 €) : limité à −2 %, 49 € (achat + 10 %)`, JSON.stringify(l7));
        dit(l2 && l2.etat === 'saisir' && l2.offre === '' && l2.bouton === 'ferme', `${T} 9002 (achat inconnu) : rien proposé, geste fermé`, JSON.stringify(l2));
        await pg.fill('[data-sv-annonce="9002"] [data-sv-remise]', '20', { timeout: 4000 }).catch(() => {});
        await pg.waitForTimeout(150);
        const l2b = (await lignesSv(pg, UID)).find((x) => x.id === '9002');
        dit(l2b && l2b.etat === 'ok' && Number(l2b.offre) === 32 && l2b.bouton === 'ouvert', `${T} 9002 : SA saisie −20 % ⇒ 32 €, geste ouvert`, JSON.stringify(l2b));
        if (tel) {
          const t = await pg.evaluate(() => [...document.querySelectorAll('[data-sv-proposer], [data-sv-remise], [data-sv-seuil]')].map((e) => Math.round(e.getBoundingClientRect().height)));
          dit(t.length && t.every((h) => h >= 44), `${T} gestes et champs ≥ 44 px`, JSON.stringify(t));
        }
        // 4. le geste pré-remplit, ne lance rien
        await pg.click('[data-sv-proposer="9001"]', { timeout: 4000 }).catch(() => {});
        await pg.waitForTimeout(400);
        const coches = await pg.evaluate(() => [...document.querySelectorAll('[data-fav-ligne][data-fav-coche="1"]')].map((e) => e.getAttribute('data-fav-id')).sort());
        dit(JSON.stringify(coches) === JSON.stringify(['n1', 'n2']), `${T} « Proposer » coche EXACTEMENT les 2 favoris à contacter de 9001`, coches.join(' '));
        const pct = await pg.evaluate(() => ({ offre: document.querySelector('[data-fc-offre][aria-pressed="true"]')?.getAttribute('data-fc-offre'), v: document.querySelector('[data-fc-etape="quoi"] [data-favoris-offre-valeur]')?.value, apercu: document.querySelector('[data-fc-apercu-offre]')?.getAttribute('data-fc-apercu-offre') }));
        dit(pct.offre === 'pct' && pct.v === '10' && Number(pct.apercu) === 54, `${T} l’offre du flux est pré-remplie : −10 %, aperçu 54 €`, JSON.stringify(pct));
        dit(!postes.some((x) => x.action === 'lancer'), `${T} rien n’est lancé par « Proposer »`);
        if (tel && theme === 'clair') await pg.screenshot({ path: path.join(SHOTS, `sv-${F}-prepare.png`), fullPage: true });
        // 5. retouche sous le plancher
        await pg.fill('[data-fc-etape="quoi"] [data-favoris-offre-valeur]', '50', { timeout: 4000 }).catch(() => {});
        await pg.waitForTimeout(200);
        await pg.click('[data-fc-verifier]', { timeout: 4000 }).catch(() => {});
        await pg.waitForSelector('[data-fc-recap]', { timeout: 5000 }).catch(() => {});
        const refus = await pg.evaluate(() => ({ dit: !!document.querySelector('[data-fc-refus-plancher]'), ferme: document.querySelector('[data-fc-envoyer]')?.disabled === true }));
        dit(refus.dit && refus.ferme, `${T} offre retouchée à −50 % (30 € < achat + 10 %) : « Envoyer » fermé, dit`, JSON.stringify(refus));
        if (tel && theme === 'clair') await pg.screenshot({ path: path.join(SHOTS, `sv-${F}-refus.png`) });
        await pg.click('[data-fc-recap] .vrm-fc-recap-pied .vrm-fc-bouton:not(.is-principal)').catch(() => {});
        await pg.waitForTimeout(200);
        await pg.fill('[data-fc-etape="quoi"] [data-favoris-offre-valeur]', '10', { timeout: 4000 }).catch(() => {});
        await pg.waitForTimeout(200);
        await pg.click('[data-fc-verifier]', { timeout: 4000 }).catch(() => {});
        await pg.waitForSelector('[data-fc-envoyer]', { timeout: 5000 }).catch(() => {});
        await pg.click('[data-fc-envoyer]').catch(() => {});
        await pg.waitForTimeout(900);
        const lances = postes.filter((x) => x.action === 'lancer');
        const l0 = lances[0] || {};
        dit(lances.length === 1 && JSON.stringify((l0.selection || []).slice().sort()) === JSON.stringify(['n1', 'n2']) && l0.reglages && l0.reglages.offreMode === 'pct' && Number(l0.reglages.pourcentage) === 10, `${T} « Envoyer » lance EXACTEMENT ces 2 favoris, offre −10 % (la file serveur)`, JSON.stringify(lances.map((x) => ({ s: x.selection, o: x.reglages && [x.reglages.offreMode, x.reglages.pourcentage] }))));
      } else {
        // 6. l'onglet est sur l'autre compte : aucun geste
        dit(L.length && L.every((x) => x.bouton === 'aucun'), `${T} compte qui n’est pas celui de l’onglet : aucun geste`, JSON.stringify(L.map((x) => x.bouton)));
      }
      const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      dit(deb <= 1, `${T} aucun débordement horizontal`, deb);
      dit(!errs.length, `${T} aucune erreur pendant les gestes`, errs.join(' | '));
      await pg.screenshot({ path: path.join(SHOTS, `sv-${F}.png`), fullPage: !tel });
      await ctx.close();
    }
    srv.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  await nav.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s)${MUTANT ? ' — mutant ' + MUTANT : ''} — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ banc interrompu : ' + e.stack); process.exit(1); });
