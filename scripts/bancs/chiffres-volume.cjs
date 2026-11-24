// ════════════════════════════════════════════════════════════════════════════
//  « AUCUN CHIFFRE NE CHANGE » (12 nov., lot vitesse-volume)
//  node scripts/bancs/chiffres-volume.cjs <dist> <sortie.json> [port]
//  VENTES=20000 : la base d'un gros vendeur (`_base-volume`), sinon la base par défaut.
//
//  Ouvre, dans le même navigateur (1512, sans bridage), Ma journée, Ventes, Achats,
//  Colis, Argent (Résumé, Déclarer) et Statistiques ; sur chaque écran, attend le
//  CALME (aucune lecture depuis 4 s), puis relève :
//   · chaque montant (« 1 234,56 € ») et chaque compte (« 12 ventes », « 3 colis »)
//     du contenu de l'écran, dans l'ordre ;
//   · les nombres portés par les attributs `data-*` de l'écran ;
//  et, à la fin, ce que les écrans PUBLIENT (le `localStorage` : bénéfice par jour,
//  URSSAF du mois, colis à poster / à retirer, statistiques, widget…), sans les
//  horodatages. Le tout est écrit dans <sortie.json>.
//
//  `scripts/compare-chiffres-volume.cjs avant.json apres.json` compare au centime.
//  Deux passes du MÊME build doivent être identiques (le banc est déterministe) ;
//  un build qui change une règle de calcul diffère. Aucune donnée réelle.
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const RACINE = path.join(__dirname, '..', '..');
let chromium;
try { ({ chromium } = require(path.join(RACINE, 'node_modules', 'playwright'))); } catch (_) { ({ chromium } = require('playwright')); }
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const DIST = process.argv[2] || path.join(RACINE, 'dist');
const SORTIE = process.argv[3] || '';
const PORT = +(process.argv[4] || process.env.BANC_PORT || 9660);
const ONGLETS = (process.env.TABS || 'journee,ventes,achats,cat_bord,argent,argent_declarer,stats').split(',');
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/json', '.json': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const t = types[path.extname(p)] || 'application/octet-stream'; const b = fs.readFileSync(p);
  if (/javascript|css|html|json|svg/.test(t)) { r.writeHead(200, { 'content-type': t, 'content-encoding': 'gzip' }); r.end(zlib.gzipSync(b)); }
  else { r.writeHead(200, { 'content-type': t }); r.end(b); }
}).listen(PORT);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
// Horodatages et jetons : ils changent d'une passe à l'autre sans être des chiffres.
const HEURE = /^(at|ts|t|le|depuis|maj|majLe|capturedAt|updatedAt|updated_at|calculeLe|publieLe|lu|luLe|vu|vuLe|heure|date|quand|expire|exp|token|jeton|id|nonce|rev|cle|v|version|seed)$/i;
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d/;
function nettoie(x, k) {
  if (Array.isArray(x)) return x.map((v) => nettoie(v));
  if (x && typeof x === 'object') { const o = {}; for (const [kk, v] of Object.entries(x).sort()) { if (HEURE.test(kk)) continue; o[kk] = nettoie(v, kk); } return o; }
  if (typeof x === 'string' && ISO.test(x)) return '·date·';
  if (typeof x === 'number' && x > 1.6e12 && x < 2.2e12) return '·ms·';
  return x;
}
// Ce que les écrans publient (les notions) — les autres clés sont des préférences ou des caches.
const PUBLIE = /^(vinted_urssaf_mois|vrm_benefice_jours|vrm_colis_aposter|vrm_colis_retirer|vrm_colis_prets|widget_stats|vinted_nums_physiques|vrm_stats_ventes|vrm_stats_stock|vrm_stock_vendus|vrm_paires_dorment|vrm_num_doublons|vrm_compta|vrm_lbc_a_retirer_pub)$/;

(async () => {
  const base = fabriquer({ volumeReel: true, ventes: Number(process.env.VENTES) || 0 });
  // (20 nov., lectures-legeres) `FORME=reelle` : commandes à la forme de SA base (`_commandes-forme`) ;
  // `SESSION=1` : connecté, base cloisonnée, et `/api/compte?mode=commandes-lire` = la VRAIE route
  // (`_route-commandes`, exécutée ici) ; `ROUTE=panne` : sa base répond 500 (l'app doit retomber sur la
  // lecture d'avant) ; `ROUTE=absente` : 404 (un déploiement sans la route).
  if (process.env.FORME === 'reelle') require(path.join(__dirname, '_commandes-forme.cjs')).formeReelle(base);
  const SESSION = process.env.SESSION ? { access_token: 'aaa.bbb.banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'banc@exemple.fr' } } : null;
  const executer = SESSION ? require(path.join(__dirname, '_route-commandes.cjs')).routeCommandes({ base, repondre, uid: SESSION.user.id, panne: process.env.ROUTE === 'panne' ? 'base' : null }) : null;
  const routeVue = [];
  const b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  const res = { ventes: Number(process.env.VENTES) || 0, ecrans: {}, publie: {}, erreurs: [] };
  try {
    // (16 nov., vitesse-moteur) CAPTURES=<préfixe> : une capture par écran relevé ; LARGEUR=390 (tactile) ; SOMBRE=1.
    const larg = Number(process.env.LARGEUR) || 1512, tel = larg < 600;
    const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: larg, height: tel ? 844 : 982 }, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
    if (SESSION) await ctx.addInitScript(([s, sombre]) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id); localStorage.setItem('schema_cloisonne', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); if (sombre) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, [SESSION, !!process.env.SOMBRE]);
    else await ctx.addInitScript((sombre) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); if (sombre) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, !!process.env.SOMBRE);
    let derniere = Date.now();
    await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
    await ctx.route('**/rest/v1/**', async (route) => {
      const rq = route.request(); derniere = Date.now();
      if (rq.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
      const h = await rq.allHeaders();
      if (SESSION && /select=owner\b/.test(decodeURIComponent(rq.url()))) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      const rep = repondre(rq.url(), h.range, base);
      return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body: JSON.stringify(rep.body) });
    });
    await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: !SESSION ? '{}' : r.request().url().includes('mode=confidentialite') ? JSON.stringify({ ok: true, uid: SESSION.user.id })
      : r.request().url().includes('mode=abonnement') ? JSON.stringify({ ok: true, proprietaire: true, acces: true, statut: 'active', configure: true })
      : r.request().url().includes('mode=equipe') ? JSON.stringify({ ok: false, erreur: 'non-installe' }) : '{}' }));
    if (SESSION) {
      await ctx.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(/\/auth\/v1\/user/.test(r.request().url()) ? { id: SESSION.user.id, email: SESSION.user.email, aud: 'authenticated', role: 'authenticated', email_confirmed_at: '2026-01-01T00:00:00Z', identities: [], app_metadata: { provider: 'email' }, user_metadata: {} } : /factors|aal/.test(r.request().url()) ? { currentLevel: 'aal1', nextLevel: 'aal1', all: [], totp: [] } : { access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
      await ctx.route('**/api/compte?mode=commandes-lire*', async (route) => {
        derniere = Date.now();
        if (process.env.ROUTE === 'absente') { routeVue.push(404); return route.fulfill({ status: 404, contentType: 'text/html', body: '<html>404</html>' }); }
        const h = await route.request().allHeaders();
        const rep = await executer(route.request().url(), { authorization: h.authorization, 'accept-encoding': 'gzip' });
        routeVue.push(rep.status); derniere = Date.now();
        return route.fulfill({ status: rep.status, contentType: 'application/json', body: rep.clair });
      });
    }
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => res.erreurs.push(e.message.slice(0, 200)));
    for (const tab of ONGLETS) {
      await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'commit', timeout: 240000 });   // (16 nov.) machine chargée : l'écran d'avant peut tenir la page longtemps
      await pg.waitForSelector('.vrm-main', { timeout: 90000 }).catch(() => {});
      derniere = Date.now(); const fin = Date.now() + 120000;
      while (Date.now() - derniere < 4000 && Date.now() < fin) await attendre(250);
      await attendre(1500);
      // (22 nov., latence-totale) Les longues listes se posent PAR PAQUETS (src/composants/ParPaquets.jsx), la suite venant
      // quand le bas de la liste approche. Pour relever tout ce que l'écran PEUT montrer (sur un build d'avant, posé d'un coup,
      // comme d'après) : chaque partie fermée qui porte une suite (un repli <details>, un bloc `hidden`, `display: none`) est
      // ouverte LE TEMPS du relevé, chaque liste amenée à son bas tant qu'un paquet reste à poser, puis tout est refermé
      // tel quel avant de lire (le texte visible reste celui de l'écran).
      await pg.evaluate(() => { window.__vrmOuverts = []; });
      for (let i = 0; i < 160; i++) {
        const reste = await pg.evaluate(() => { const m = document.querySelector('.vrm-main') || document.body; const O = window.__vrmOuverts;
          const S = [...m.querySelectorAll('[data-par-paquets]')];
          for (const x of S) {
            for (let e = x.parentElement; e && e !== m; e = e.parentElement) {
              if (e.localName === 'details' && !e.open) { O.push(['details', e]); e.open = true; }
              if (e.hidden) { O.push(['hidden', e]); e.hidden = false; }
              if (getComputedStyle(e).display === 'none') { O.push(['style', e, e.style.display]); e.style.display = 'block'; }
            }
            try { x.scrollIntoView({ block: 'end' }); } catch (_) {}
          }
          return S.length; }).catch(() => 0);
        if (process.env.DEBUG_PAQUETS) console.log('paquets ' + tab + ' ' + i + ' : ' + reste);
        if (!reste) break;
        await attendre(200);
      }
      await pg.evaluate(() => { for (const [k, e, v] of (window.__vrmOuverts || []).reverse()) { if (k === 'details') e.open = false; else if (k === 'hidden') e.hidden = true; else e.style.display = v; } window.__vrmOuverts = []; window.scrollTo(0, 0); const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; }).catch(() => {});
      { derniere = Date.now(); const fin2 = Date.now() + 60000; while (Date.now() - derniere < 2500 && Date.now() < fin2) await attendre(250); await attendre(800); }
      const releve = () => pg.evaluate(() => {
        const main = document.querySelector('.vrm-main') || document.body;
        const texte = (main.innerText || '').replace(/[\u00a0\u202f]/g, ' ');
        const montants = texte.match(/-?\d[\d ]*(?:,\d{1,2})? ?€/g) || [];
        const comptes = texte.match(/\b\d[\d ]* (?:ventes?|achats?|colis|annonces?|paires?|comptes?|bordereaux?)\b/g) || [];
        const attrs = [];
        // (20 nov., bugs-terrain) Les attributs d'UN élément dans l'ordre de leur NOM : leur ordre dans le DOM dit seulement à quel
        // rendu chacun a été posé (un attribut posé par un second rendu passe en dernier), pas un chiffre.
        for (const e of main.querySelectorAll('*')) attrs.push(...[...e.attributes].filter((a) => a.name.startsWith('data-') && /^-?\d+(?:[.,]\d+)?$/.test(a.value)).map((a) => a.name + '=' + a.value).sort());
        return { montants, comptes, attrs };
      });
      // (24 nov., vitesse-moteur) LE RELEVÉ D'UN ÉCRAN STABLE. « Aucune lecture depuis 4 s » ne dit pas que l'écran a fini :
      // à 20 000 ventes, sur une machine chargée, le calcul et le rendu des réponses arrivées continuent sans aucune lecture
      // (mesuré : Ventes relevé sans ses « 14 bordereaux / 35 bordereaux » une passe sur deux, même build). Le relevé est
      // donc refait toutes les 3 s jusqu'à DEUX relevés identiques de suite (sans lecture entre eux) ; jamais
      // stable en 3 min ⇒ `instable` noté, et compare-chiffres-volume le dit rouge (jamais un vert sur un écran pas fini).
      { let r0 = await releve(), essais = 1, stable = false; const finS = Date.now() + 180000;
        while (Date.now() < finS) {
          const d0 = derniere; await attendre(3000);
          while (Date.now() - derniere < 2500 && Date.now() < finS) await attendre(250);
          const r1 = await releve(); essais++;
          if (derniere === d0 && JSON.stringify(r1) === JSON.stringify(r0)) { stable = true; break; }
          r0 = r1;
        }
        res.ecrans[tab] = r0; res.ecrans[tab].releves = essais; if (!stable) res.ecrans[tab].instable = true; }
      // (22 nov., P1 — Annonces virtualisée) L'IDENTITÉ de chaque rangée : article ↔ N° ↔ sites, relevée en faisant défiler
      // TOUTE la liste (une liste virtualisée ne pose que les rangées visibles : on les relève toutes, au fil du défilement).
      if (/^annonces/.test(tab)) {
        const vus = new Map();
        for (let i = 0; i < 400; i++) {
          const r = await pg.evaluate(() => {
            const L = [...document.querySelectorAll('[data-eg-article]')].map((e) => [e.getAttribute('data-eg-article'), (e.getAttribute('data-eg-numero') || '') + '|' + (e.getAttribute('data-eg-sites') || '') + '|' + (e.getAttribute('data-eg-compte') || '')]);
            const avant = window.scrollY; const zone = [...document.querySelectorAll('.vrm-main, .vrm-main *')].find((x) => x.scrollHeight > x.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(x).overflowY)) || document.scrollingElement;
            const a0 = zone.scrollTop; zone.scrollTop = a0 + Math.max(300, zone.clientHeight * 0.8); window.scrollBy(0, 600);
            return { L, bouge: zone.scrollTop !== a0 || window.scrollY !== avant };
          });
          for (const [k, v] of r.L) vus.set(k, v);
          if (!r.bouge) break;
          await attendre(120);
        }
        res.ecrans[tab].identites = [...vus.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([k, v]) => k + '=' + v);
      }
      if (process.env.CAPTURES) await pg.screenshot({ path: `${process.env.CAPTURES}-${tab}.png` }).catch(() => {});
    }
    const ls = await pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
    for (const [k, v] of Object.entries(ls)) { const kk = k.replace(/_[0-9a-f-]{36}$/, ''); if (!PUBLIE.test(kk)) continue; let x = v; try { x = JSON.parse(v); } catch (_) {} res.publie[kk] = nettoie(x); }
    await ctx.close();
  } finally { await b.close(); srv.close(); }
  const s = JSON.stringify(res, null, 1);
  if (SORTIE) fs.writeFileSync(SORTIE, s);
  if (SESSION) console.log(`route des commandes : ${routeVue.length} appel(s) ${JSON.stringify(routeVue.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {}))}`);
  console.log(`chiffres relevés : ${Object.entries(res.ecrans).map(([t, e]) => `${t} ${e.montants.length} € · ${e.comptes.length} n · ${e.attrs.length} data`).join(' | ')} · publiés ${Object.keys(res.publie).length} · erreurs ${res.erreurs.length}`);
})();
