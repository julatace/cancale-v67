// ════════════════════════════════════════════════════════════════════════════
// BANC « VRM TRAVAILLE » (11 nov., lot suivi-travail) — la VRAIE feuille et le VRAI
// magasin, montés seuls (harnais : scripts/bancs/suivi-travail/harnais.jsx, bâti par
// esbuild), données INVENTÉES, aucun réseau. 390 px tactile et 1512 px, clair et sombre.
//   1 la feuille couvre tout, le reste est `inert` (un clic derrière n'arrive pas)
//   2 Échap et le retour du navigateur ne ferment rien ; fermer l'onglet DEMANDE (beforeunload)
//   3 N sur M, barre (aria), étape de l'annonce en cours, « environ », compte à rebours de la pause
//   4 une confirmation posée APRÈS le gel (askConfirm, z 20000) reste au-dessus et cliquable ;
//     4b une feuille de l'app plus basse (placement du tampon, z 1000) est relevée au-dessus
//   5 « Mettre en pause » : la boucle s'arrête entre deux annonces, « Reprendre » la relance
//   6 « Arrêter » demande confirmation ; « Continuer » ne change rien
//   7 la fin : récapitulatif (réussies, refusées avec le geste, pas faites), « Fermer » dégèle et garde
//   8 rechargement : « Interrompu », l'annonce en cours « à vérifier » (ou l'étape dite par l'extension)
//   9 rien ne déborde, cibles ≥ 44 px ; captures dans SHOTS (à regarder)
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_garde-reseau.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const { execFileSync } = require('child_process');
const RACINE = process.env.RACINE_BANC || path.join(__dirname, '..', '..');
const NM = path.join(RACINE, 'node_modules');
const { chromium } = require(path.join(NM, 'playwright'));
const PORT = Number(process.env.BANC_PORT) || 4677;
const SHOTS = process.env.SHOTS || '';
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d !== undefined ? '  → ' + JSON.stringify(d).slice(0, 300) : ''}`); };

function batir() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-suivi-'));
  const stub = path.join(out, 'jauge-stub.jsx');
  fs.writeFileSync(stub, "import React from 'react'; export default function J(){ return React.createElement('div',{'data-jauge-stub':''},'12/50 cette heure'); }");
  const plug = path.join(out, 'plug.cjs');
  fs.writeFileSync(plug, `module.exports = { name: 'stub', setup(b) { b.onResolve({ filter: /JaugeActions\\.jsx$/ }, () => ({ path: ${JSON.stringify(stub)} })); } };`);
  const script = path.join(out, 'b.cjs');
  fs.writeFileSync(script, `require(${JSON.stringify(path.join(NM, 'esbuild'))}).build({ entryPoints: [${JSON.stringify(path.join(RACINE, 'scripts/bancs/suivi-travail/harnais.jsx'))}], bundle: true, outdir: ${JSON.stringify(out)}, entryNames: 'h', jsx: 'automatic', loader: { '.js': 'jsx' }, nodePaths: [${JSON.stringify(NM)}], define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false' }, plugins: [require(${JSON.stringify(plug)})], logLevel: 'error' }).catch((e) => { console.error(e); process.exit(1); });`);
  execFileSync(process.execPath, [script], { stdio: 'inherit' });
  return out;
}

(async () => {
  const dist = batir();
  const page0 = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/h.css"></head><body style="margin:0"><script src="/h.js"></script></body></html>`;
  const srv = http.createServer((q, r) => {
    const u = q.url.split('?')[0].split('#')[0];
    if (u === '/h.js' || u === '/h.css') { const f = path.join(dist, u.slice(1)); if (!fs.existsSync(f)) { r.writeHead(200, { 'content-type': 'text/css' }); r.end(''); return; } r.writeHead(200, { 'content-type': u.endsWith('.js') ? 'text/javascript' : 'text/css' }); r.end(fs.readFileSync(f)); return; }
    r.writeHead(200, { 'content-type': 'text/html' }); r.end(page0);
  }).listen(PORT, '127.0.0.1');
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const tailles = [[390, 844, true], [1512, 900, false]];
  const themes = (process.env.THEMES || 'clair,sombre').split(',');
  for (const [w, h, tactile] of tailles) for (const theme of themes) {
    const tag = `${w}/${theme}`;
    const ctx = await nav.newContext({ viewport: { width: w, height: h }, hasTouch: tactile, isMobile: tactile, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const erreurs = []; p.on('pageerror', (e) => erreurs.push(String(e)));
    await p.goto(`http://127.0.0.1:${PORT}/#${theme}`);
    await p.waitForFunction(() => !!window.__lancer);
    await p.evaluate(() => window.__lancer());
    await p.waitForSelector('[data-suivi-travail]');
    // 1
    const fige = await p.evaluate(() => ({ inert: document.getElementById('app').hasAttribute('inert'), dessus: (() => { const b = document.getElementById('derriere').getBoundingClientRect(); const e = document.elementFromPoint(b.x + 20, b.y + 20); return !!(e && e.closest('[data-suivi-travail]')); })() }));
    dit(fige.inert && fige.dessus, `${tag} 1 VRM figé : le reste en inert, la feuille au-dessus`, fige);
    await p.mouse.click(40, 140).catch(() => {});
    dit(await p.evaluate(() => window.__clicsDerriere === 0), `${tag} 1b un clic derrière n'arrive pas`);
    // 2
    await p.keyboard.press('Escape');
    await p.evaluate(() => history.back()); await p.waitForTimeout(300);
    dit(await p.$('[data-suivi-travail]') !== null, `${tag} 2 Échap et retour du navigateur ne ferment rien`);
    // 3
    const lu = await p.evaluate(() => { const f = document.querySelector('[data-suivi-travail]'); const b = f.querySelector('[role=progressbar]'); return { n: f.getAttribute('data-suivi-n'), now: b.getAttribute('aria-valuenow'), max: b.getAttribute('aria-valuemax'), part: Number(b.getAttribute('data-suivi-part')), enCours: (f.querySelector('[data-suivi-en-cours]') || {}).getAttribute && f.querySelector('[data-suivi-en-cours]').getAttribute('data-suivi-en-cours'), ici: (f.querySelector('[data-etat=ici]') || {}).getAttribute ? f.querySelector('[data-etat=ici]').getAttribute('data-suivi-etape-cle') : '', restant: f.querySelector('[data-suivi-restant]').getAttribute('data-suivi-restant'), pause: Number((f.querySelector('[data-suivi-pause]') || { getAttribute: () => -1 }).getAttribute('data-suivi-pause')), lignes: f.querySelectorAll('[data-suivi-ligne]').length }; });
    dit(lu.n === '2/4' && lu.now === '2' && lu.max === '4' && lu.part > 50 && lu.part < 75, `${tag} 3 « 2 sur 4 », barre entre 2 et 3 annonces`, lu);
    dit(lu.enCours === '103' && lu.ici === 'brouillon', `${tag} 3b l'annonce en cours et son étape (brouillon)`, lu);
    dit(Math.abs(Number(lu.restant) - 240) < 10 && lu.pause > 80 && lu.pause <= 95, `${tag} 3c temps restant estimé au rythme réel (4 min pour 2 ⇒ environ 4 min), pause avec compte à rebours`, lu);
    dit(lu.lignes >= 8, `${tag} 3d le journal détaille chaque geste`, lu.lignes);
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, `cours-${w}-${theme}.png`), fullPage: false }); }
    // 4
    const conf = await p.evaluate(() => { const d = document.createElement('div'); d.id = 'conf'; d.style.cssText = 'position:fixed;inset:30% 10%;z-index:20000;background:#fff'; d.innerHTML = '<button id="oui" style="width:100%;height:100%">Oui</button>'; let n = 0; document.body.appendChild(d); d.querySelector('#oui').addEventListener('click', () => { n++; window.__oui = n; }); return true; });
    await p.click('#oui');
    dit(conf && await p.evaluate(() => window.__oui === 1), `${tag} 4 une question posée pendant le travail reste répondable`);
    await p.evaluate(() => document.getElementById('conf').remove());
    // 4b une feuille de l'app à z 1000 (placement du tampon…) posée pendant le travail : relevée au-dessus
    await p.evaluate(() => { const d = document.createElement('div'); d.id = 'tampon'; d.innerHTML = '<div style="position:fixed;inset:20% 5%;z-index:1000;background:#eee"><button id="placer" style="width:100%;height:100%">Placer</button></div>'; document.body.appendChild(d); d.querySelector('#placer').addEventListener('click', () => { window.__place = 1; }); });
    await p.waitForTimeout(100);
    await p.click('#placer', { timeout: 3000 }).catch(() => {});
    dit(await p.evaluate(() => window.__place === 1), `${tag} 4b une feuille de l'app ouverte pendant le travail (z 1000) passe au-dessus et répond`);
    await p.evaluate(() => document.getElementById('tampon').remove());
    // 5
    await p.click('[data-suivi-pause-bouton]');
    const boucle = p.evaluate(() => window.__t.continuer());
    await p.waitForSelector('[data-suivi-statut="pause"]');
    await p.waitForSelector('[data-suivi-reprendre]');
    await p.click('[data-suivi-reprendre]');
    dit((await boucle) === true && await p.$('[data-suivi-statut="cours"]') !== null, `${tag} 5 pause entre deux annonces, puis « Reprendre »`);
    // 6
    await p.click('[data-suivi-arreter]');
    await p.waitForSelector('[data-suivi-conf-arret]');
    await p.click('[data-suivi-continuer]');
    dit(await p.evaluate(() => window.__suivi.lire().demande === null && window.__suivi.lire().statut === 'cours'), `${tag} 6 « Arrêter » demande confirmation ; « Continuer » ne change rien`);
    // 9 (pendant)
    const geo = await p.evaluate(() => ({ deb: document.documentElement.scrollWidth - innerWidth, petits: [...document.querySelectorAll('[data-suivi-travail] button')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 44).map((b) => b.textContent) }));
    dit(geo.deb <= 0 && !geo.petits.length, `${tag} 9 rien ne déborde, boutons ≥ 44 px`, geo);
    // 7
    await p.evaluate(() => { const t = window.__t; t.etape('103', 'accepte'); t.fin('103', { etat: 'ok' }); t.terminer(''); });
    await p.waitForSelector('[data-suivi-statut="arrete"]');
    const rc = await p.evaluate(() => ({ r: Number((document.querySelector('[data-suivi-recap=reussies]') || { getAttribute: () => 0 }).getAttribute('data-n')), f: Number((document.querySelector('[data-suivi-recap=refusees]') || { getAttribute: () => 0 }).getAttribute('data-n')), pc: Number((document.querySelector('[data-suivi-recap=pasCommencees]') || { getAttribute: () => 0 }).getAttribute('data-n')), geste: !!document.querySelector('[data-suivi-recap=refusees] .vrm-st-geste') }));
    dit(rc.r === 2 && rc.f === 1 && rc.pc === 1 && rc.geste, `${tag} 7 récapitulatif : 2 réussies, 1 refusée avec son geste, 1 pas faite`, rc);
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `fin-${w}-${theme}.png`), fullPage: false });
    await p.click('[data-suivi-fermer]');
    await p.waitForFunction(() => !document.querySelector('[data-suivi-travail]'));
    dit(await p.evaluate(() => !document.getElementById('app').hasAttribute('inert') && JSON.parse(localStorage.getItem('vrm_suivi_travaux') || '[]').length === 1), `${tag} 7b « Fermer » dégèle VRM et garde le travail (Ce que VRM a fait)`);
    // 8
    await p.evaluate(() => { window.__lancer(); });
    await p.reload(); await p.waitForSelector('[data-suivi-statut="interrompu"]');
    const rp = await p.evaluate(() => ({ av: !!document.querySelector('[data-suivi-a-verifier]'), reussies: Number(document.querySelector('[data-suivi-recap=reussies]').getAttribute('data-n')) }));
    dit(rp.av && rp.reussies === 1, `${tag} 8 rechargé en plein travail : « Interrompu », l'annonce en cours à vérifier, jamais déclarée faite`, rp);
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `interrompu-${w}-${theme}.png`), fullPage: false });
    dit(!erreurs.length, `${tag} aucune erreur JS`, erreurs);
    // 2b beforeunload (dernier : il ferme la page)
    await p.evaluate(() => { window.__suivi.fermer(); window.__lancer(); });
    await p.waitForSelector('[data-suivi-statut="cours"]');
    let demande = false; p.on('dialog', async (d) => { if (d.type() === 'beforeunload') demande = true; await d.dismiss().catch(() => {}); });
    await p.mouse.click(5, 5).catch(() => {});   // une interaction : Chrome n'arme beforeunload qu'après un geste
    await p.close({ runBeforeUnload: true }); await new Promise((r) => setTimeout(r, 500));
    dit(demande, `${tag} 2b fermer l'onglet pendant le travail DEMANDE confirmation`);
    await ctx.close();
  }
  await nav.close(); srv.close();
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
