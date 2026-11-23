// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA COPIE D'UN ÉCRAN » (20 nov., affichage instantané — src/copieEcran.js, src/CopieEcran.jsx)
//
//    node scripts/bancs/copie-ecran.cjs <dist> [port]
//    Mutations (un build fait avec `VRM_COPIE_MUTATION=…`, rouge attendu) :
//      compte → la copie n'est plus par compte  ⇒ B ROUGE ;   panne → une lecture ratée ne garde plus la copie ⇒ C ROUGE.
//
//  390 × 844 tactile, base INVENTÉE (`_base-volume`), un profil de navigateur PERSISTANT (le même appareil d'une étape
//  à l'autre : IndexedDB et localStorage survivent, comme sur son iPhone). Il juge des RÈGLES, jamais un libellé :
//   A) UNE COPIE N'ÉCRIT RIEN ET NE DÉCIDE RIEN — toutes les lectures de la base TENUES (la copie reste à l'écran) :
//      elle est montrée (`[data-copie-ecran]`), inerte, datée ; on la touche (3 rangées : `.n-rangee` ou, depuis le 21 nov., `[data-ad-rangee]` d'Annonces), on presse Entrée : AUCUNE
//      requête d'écriture (POST/PATCH/PUT/DELETE vers la base ou /api), aucune fiche ouverte, l'adresse ne bouge pas ;
//      son HTML ne porte ni gestionnaire `on*`, ni `href`, ni `id`, ni script. Lectures rendues : l'écran vrai la remplace.
//   B) UN CHANGEMENT DE COMPTE N'AFFICHE JAMAIS LA COPIE D'UN AUTRE — le vendeur A a ses copies sur l'appareil ; B se
//      connecte sur le même navigateur : de la navigation au calme, AUCUNE copie n'apparaît (ni avant l'app, ni dedans).
//   C) UNE LECTURE RATÉE GARDE LA COPIE — la liste des comptes répond 503 (base injoignable) : la copie reste, « pas à
//      jour » (`data-copie-etat="pas-a-jour"`) avec SON bouton Réessayer, 6 s plus tard toujours là, jamais un écran vide.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const base = fabriquer({ volumeReel: true, qr: true, ventes: 600, achats: 300, annonces: 400 });
const DIST = path.resolve(process.argv[2] || path.join(RACINE, 'dist'));
const PORT = +(process.argv[3] || process.env.BANC_PORT || (21000 + Math.floor(Math.random() * 9000)));
const UID_A = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', UID_B = '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c';
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let verts = 0, rouges = 0;
const dit = (ok, quoi) => { if (ok) { verts++; console.log('  ✅ ' + quoi); } else { rouges++; console.log('  ❌ ' + quoi); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream', 'cache-control': /^\/assets\//.test(f) ? 'public, max-age=31536000, immutable' : 'no-cache' }); r.end(fs.readFileSync(p));
}).listen(PORT);

// L'état du banc : lectures tenues ? comptes en panne ? écritures vues.
const etat = { tenir: false, attente: [], panneComptes: false, ecritures: [], session: [] };
async function preparer(ctx) {
  await ctx.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await ctx.route('**/rest/v1/**', async (route) => {
    const rq = route.request();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(rq.method())) { etat.ecritures.push(rq.method() + ' ' + rq.url().replace(/^.*\/rest\/v1\//, '').slice(0, 80)); return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); }
    if (etat.tenir) await new Promise((ok) => etat.attente.push(ok));
    if (etat.panneComptes && /\/rest\/v1\/vinted_accounts/.test(rq.url())) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"panne"}' });
    const h = await rq.allHeaders();
    const rep = repondre(rq.url(), h.range, base);
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body: JSON.stringify(rep.body) }).catch(() => {});
  });
  await ctx.route('**/api/**', (r) => {
    const rq = r.request(); const u = rq.url();
    // La vérification d'APPAREIL de la session (src/appareilNouveau.js, `action: 'verifier'`) part à chaque ouverture de
    // l'app, copie ou pas : notée à part (`etat.session`), jamais confondue avec un geste.
    if (rq.method() !== 'GET' && /mode=appareils/.test(u) && /"verifier"/.test(rq.postData() || '')) etat.session.push(u);
    else if (rq.method() !== 'GET' && !/mode=(confidentialite|equipe|abonnement)/.test(u)) etat.ecritures.push(rq.method() + ' ' + u.replace(/^.*\/api\//, 'api/').slice(0, 80));
    const corps = /mode=equipe/.test(u) ? { ok: true, equipe: [], invitations: [], membreDe: [], aBoutique: true }
      : /mode=abonnement/.test(u) ? { ok: true, acces: true, statut: 'active', configure: true } : { pret: true, devices: 1 };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
  });
}
const relacher = () => { etat.tenir = false; const l = etat.attente.splice(0); for (const ok of l) ok(); };
// Une sonde posée AVANT tout script : toute copie qui apparaît (avant l'app ou dedans) est notée.
const sondeCopies = () => {
  window.__vrmCopiesVues = [];
  const voir = () => { for (const e of document.querySelectorAll('[data-copie-ecran]')) { const k = e.getAttribute('data-copie-ecran') + '@' + e.getAttribute('data-copie-t'); if (!window.__vrmCopiesVues.includes(k)) window.__vrmCopiesVues.push(k); } };
  new MutationObserver(voir).observe(document, { subtree: true, childList: true });
};
async function contexte(dossier, uid) {
  process.env.BANC_SESSION_UID = uid;
  const ctx = await chromium.launchPersistentContext(dossier, { executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--explicitly-allowed-ports=' + PORT],
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', serviceWorkers: 'block' });
  await preparer(ctx);
  await ctx.addInitScript(sondeCopies);
  return ctx;
}
// Ouvrir un écran, attendre qu'il soit prêt, puis le temps que sa copie soit prise (≈ 1,5 s après le calme).
async function visiter(ctx, ecran) {
  const pg = await ctx.newPage();
  await pg.goto(`http://localhost:${PORT}/?tab=${ecran}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pg.waitForSelector(`[data-attente-ecran="${ecran}"][data-attente="pret"]`, { timeout: 120000 }).catch(() => {});
  await attendre(6000);
  const n = await pg.evaluate((e) => new Promise((ok) => { try { const rq = indexedDB.open('vrm-copies-ecrans', 1); rq.onsuccess = () => { try { const g = rq.result.transaction('copies', 'readonly').objectStore('copies').getAll(); g.onsuccess = () => ok(g.result.filter((c) => c.ecran === e).length); g.onerror = () => ok(-1); } catch (_) { ok(-1); } }; rq.onerror = () => ok(-1); } catch (_) { ok(-1); } }), ecran);
  await pg.close();
  return n;
}

(async () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-copie-'));
  console.log(`Banc copie-ecran · ${path.relative(process.cwd(), DIST) || DIST}`);
  try {
    // ── Le vendeur A ouvre Annonces et Ventes : ses copies sont prises ──
    let ctx = await contexte(dossier, UID_A);
    const nA = await visiter(ctx, 'annonces'); await visiter(ctx, 'ventes');
    dit(nA === 1, `A : la copie d'Annonces est rangée sur l'appareil (${nA})`);

    // ── A) Une copie n'écrit rien et ne décide rien ──
    console.log('A) une copie n\'écrit rien, ne décide rien');
    {
      etat.ecritures = []; etat.tenir = true;
      const pg = await ctx.newPage();
      const url0 = `http://localhost:${PORT}/?tab=annonces`;
      await pg.goto(url0, { waitUntil: 'domcontentloaded', timeout: 120000 });
      const vue = await pg.waitForSelector('#root [data-copie-ecran="annonces"][data-copie-contenu]', { timeout: 60000 }).then(() => true, () => false);
      dit(vue, 'lectures tenues : la copie d\'Annonces est À L\'ÉCRAN dans l\'app');
      const ecritAvant = etat.ecritures.length;
      // Les rangées de la copie, touchées ; Entrée pressée.
      const cibles = await pg.evaluate(() => [...document.querySelectorAll('#root [data-copie-ecran] .n-rangee, #root [data-copie-ecran] [data-ad-rangee]')].slice(0, 3).map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }).filter((p) => p.y > 0 && p.y < innerHeight - 80));
      for (const c of cibles) { await pg.touchscreen.tap(c.x, c.y).catch(() => {}); await attendre(400); }
      await pg.keyboard.press('Enter').catch(() => {}); await attendre(1200);
      const apres = await pg.evaluate(() => {
        const cop = document.querySelector('#root [data-copie-ecran="annonces"]');
        const h = cop;   // le conteneur de la copie EST son contenu inerte (src/CopieEcran.jsx)
        const tout = h ? [...h.querySelectorAll('*')] : [];
        return {
          inerte: !!(h && h.hasAttribute('inert')), etat: cop && cop.getAttribute('data-copie-etat'), age: cop && cop.getAttribute('data-copie-age'),
          mention: !!(cop && cop.parentElement.querySelector('[data-copie-mention]')), on: tout.filter((e) => [...e.attributes].some((a) => /^on/i.test(a.name))).length,
          href: tout.filter((e) => e.hasAttribute('href')).length, idDevant: tout.filter((e) => e.id && document.getElementById(e.id) === e && [...document.querySelectorAll('#' + CSS.escape(e.id))].length > 1).length, script: tout.filter((e) => /^(script|iframe|object|embed)$/i.test(e.localName)).length,
          fiche: !!document.querySelector('[data-fiche-paire]'), url: location.pathname + location.search, encore: !!cop, rangees: cop ? cop.querySelectorAll('.n-rangee, [data-ad-rangee]').length : 0,
        };
      });
      dit(cibles.length >= 2, `${cibles.length} rangées de la copie touchées`);
      dit(etat.ecritures.length === 0, `AUCUNE requête d'écriture pendant la copie (${etat.ecritures.length}${etat.ecritures.length ? ' : ' + etat.ecritures.slice(0, 3).join(' | ') : ''})`);
      dit(etat.ecritures.length === ecritAvant, 'les touchers et Entrée sur la copie n\'ont rien déclenché');
      dit(!apres.fiche, 'aucune fiche ouverte depuis la copie');
      dit(apres.encore && apres.inerte, 'la copie est toujours là, INERTE');
      dit(apres.mention && apres.etat === 'mise-a-jour' && apres.age != null, `elle est DATÉE (« Mis à jour il y a ${apres.age} min ») et dit sa mise à jour`);
      dit(apres.on === 0 && apres.href === 0 && apres.script === 0, `son HTML est nettoyé (on* ${apres.on}, href ${apres.href}, script ${apres.script})`);
      dit(apres.idDevant === 0, `aucun id de la copie ne passe devant l'écran vrai (${apres.idDevant})`);
      dit(apres.rangees >= 5, `elle montre des rangées (${apres.rangees})`);
      relacher();
      const remplacee = await pg.waitForFunction(() => !document.querySelector('#root [data-copie-ecran="annonces"]') && !!document.querySelector('[data-attente-ecran="annonces"][data-attente="pret"]'), null, { timeout: 60000 }).then(() => true, () => false);
      dit(remplacee, 'lectures rendues : l\'écran vrai la REMPLACE');
      await pg.close();
    }

    // ── C) Une lecture ratée garde la copie ──
    console.log('C) une lecture ratée garde la copie');
    {
      etat.panneComptes = true;
      const pg = await ctx.newPage();
      await pg.goto(`http://localhost:${PORT}/?tab=annonces`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      const vue = await pg.waitForSelector('#root [data-copie-ecran="annonces"][data-copie-etat="pas-a-jour"]', { timeout: 60000 }).then(() => true, () => false);
      dit(vue, 'base injoignable : la copie est montrée « Pas à jour »');
      await attendre(6000);
      const r = await pg.evaluate(() => { const c = document.querySelector('#root [data-copie-ecran="annonces"]'); return { la: !!c, etat: c && c.getAttribute('data-copie-etat'), bouton: !!(c && c.parentElement.querySelector('[data-copie-reessayer]')), rangees: c ? c.querySelectorAll('.n-rangee, [data-ad-rangee]').length : 0 }; });
      dit(r.la && r.etat === 'pas-a-jour', '6 s plus tard, la copie est TOUJOURS là (jamais un écran vide)');
      dit(r.bouton, 'avec SON bouton « Réessayer »');
      dit(r.rangees >= 5, `ses rangées restent lisibles (${r.rangees})`);
      etat.panneComptes = false;
      await pg.close();
    }
    await ctx.close();

    // ── B) Un autre compte sur le même appareil ──
    console.log('B) un changement de compte n\'affiche jamais la copie d\'un autre');
    {
      ctx = await contexte(dossier, UID_B);
      const pg = await ctx.newPage();
      // La session de A part (déconnexion) ; la porte du banc range celle de B à la navigation suivante.
      await pg.goto(`http://localhost:${PORT}/vide-banc`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await pg.evaluate(() => { try { localStorage.removeItem('vrm_session'); } catch (_) {} });
      for (const ecran of ['annonces', 'ventes']) {
        await pg.goto(`http://localhost:${PORT}/?tab=${ecran}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await pg.waitForSelector(`[data-attente-ecran="${ecran}"][data-attente="pret"]`, { timeout: 120000 }).catch(() => {});
        await attendre(1500);
        const r = await pg.evaluate(() => ({ vues: window.__vrmCopiesVues || [], uid: (() => { try { return JSON.parse(localStorage.getItem('vrm_session')).user.id; } catch (_) { return null; } })() }));
        dit(r.uid === '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c', `B est bien connecté (${String(r.uid).slice(0, 8)}…)`);
        const deA = r.vues.filter((k) => k.startsWith(ecran + '@'));
        dit(deA.length === 0, `${ecran} : AUCUNE copie montrée à B (${deA.length ? deA.join(', ') : 'aucune'})`);
      }
      await ctx.close();
    }
  } finally { srv.close(); try { fs.rmSync(dossier, { recursive: true, force: true }); } catch (_) {} }
  console.log(`\n${rouges ? '❌' : '✅'} copie-ecran : ${verts} vert(s), ${rouges} rouge(s)`);
  process.exit(rouges ? 1 : 0);
})().catch((e) => { console.error(e); srv.close(); process.exit(1); });
