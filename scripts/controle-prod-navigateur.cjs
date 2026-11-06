#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// LA PRODUCTION, OUVERTE DANS UN VRAI NAVIGATEUR — node scripts/controle-prod-navigateur.cjs
// ═══════════════════════════════════════════════════════════════════════════
// (6 nov., filet 5) Après chaque mise en ligne (workflow controle-prod.yml,
// une fois le déploiement Vercel du commit fini), on ouvre https://vrm.center
// comme un visiteur, en iPhone (390 px, tactile) et en ordinateur (1512 px) :
//   · la page d'accueil est RENDUE (pas une page blanche), avec le titre du dépôt ;
//   · `/?tab=journee` charge le bundle de l'app et mène à l'écran de CONNEXION
//     (le formulaire `#vrm-cx-titre-formulaire`), jamais une page blanche ;
//   · aucune erreur JavaScript, aucun fichier /assets/ en 4xx/5xx, aucune
//     erreur de console hors bruit connu (la liste BRUIT de src/plantages.js) ;
//   · /api/sante répond `ok: true`.
// ⚠️ LECTURE SEULE : aucune session, aucun secret, et toute requête qui n'est
// pas une lecture (POST, PUT, PATCH, DELETE) est BLOQUÉE avant de partir (et
// comptée) ; le service worker est bloqué (rien ne s'installe). Rien n'est écrit.
// Un échec fait échouer le job : la passation dit comment revenir en arrière
// sur Vercel (« Instant Rollback ») — JAMAIS automatisé ici.
// `VRM_ORIGINE=http://127.0.0.1:<port>` : jouer le contrôle contre une copie
// locale (la preuve du banc). `VRM_CHROMIUM_PATH` : un Chromium précis.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const ORIGINE = (process.env.VRM_ORIGINE || 'https://vrm.center').replace(/\/+$/, '');
const titreAttendu = (() => { const m = /<title>([^<]+)<\/title>/.exec(fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8')); return m ? m[1].trim() : null; })();

const echecs = [];
const controle = (nom, ok, detail) => {
  if (ok) { console.log(`OK     ${nom}`); return; }
  echecs.push(nom);
  console.log(`ÉCHEC  ${nom}${detail ? ' — ' + String(detail).slice(0, 400) : ''}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=Production (navigateur) : ${nom}::${String(detail || '').replace(/\r?\n/g, ' ').slice(0, 300)}`);
};

(async () => {
  const { BRUIT, estMorceauPerime } = await import(require('url').pathToFileURL(path.join(RACINE, 'src', 'plantages.js')).href);
  let pw;
  try { pw = require(path.join(RACINE, 'node_modules', 'playwright')); } catch (_) { pw = require('playwright'); }
  const exe = process.env.VRM_CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const nav = await pw.chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  console.log(`Contrôle de ${ORIGINE} dans un navigateur — sans session, sans rien écrire.\n`);

  // /api/sante
  try {
    const r = await fetch(ORIGINE + '/api/sante', { headers: { accept: 'application/json' } });
    const j = await r.json().catch(() => null);
    controle('/api/sante répond ok', r.status === 200 && j && j.ok === true, `HTTP ${r.status} ${JSON.stringify(j).slice(0, 120)}`);
  } catch (e) { controle('/api/sante répond ok', false, String(e && e.message)); }

  const APPAREILS = [
    ['iPhone 390 px', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }],
    ['ordinateur 1512 px', { viewport: { width: 1512, height: 950 } }],
  ];
  let ecrituresBloquees = 0;
  for (const [qui, opts] of APPAREILS) {
    for (const [page, chemin] of [['accueil', '/'], ['app (?tab=journee)', '/?tab=journee']]) {
      const T = `[${qui}] ${page}`;
      const ctx = await nav.newContext({ ...opts, locale: 'fr-FR', serviceWorkers: 'block' });
      const pg = await ctx.newPage();
      const erreurs = [], consoleErr = [], assets = [];
      pg.on('pageerror', (e) => erreurs.push(String(e && e.message || e).slice(0, 200)));
      pg.on('console', (m) => {
        if (m.type() !== 'error') return;
        const t = m.text();
        if (BRUIT.test(t) || estMorceauPerime(t) || /^Failed to load resource/.test(t) || /Content Security Policy|Content-Security-Policy/.test(t)) return;
        consoleErr.push(t.slice(0, 200));
      });
      pg.on('response', (r) => { const u = r.url(); if (u.startsWith(ORIGINE + '/assets/') && r.status() >= 400) assets.push(r.status() + ' ' + u.slice(ORIGINE.length)); });
      // ⚠️ Lecture seule : rien qui écrit ne part (ni vers VRM, ni vers la base).
      await pg.route('**/*', (route) => {
        const m = route.request().method();
        if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return route.fallback();
        ecrituresBloquees++;
        return route.abort();
      });
      let ok = true;
      try { await pg.goto(ORIGINE + chemin, { waitUntil: 'load', timeout: 45000 }); } catch (e) { ok = false; controle(`${T} : la page se charge`, false, String(e && e.message)); }
      if (ok) {
        if (chemin === '/') {
          await pg.waitForFunction(() => (document.getElementById('root') || {}).innerText && document.getElementById('root').innerText.trim().length > 200, null, { timeout: 30000 }).catch(() => {});
          const v = await pg.evaluate(() => ({ titre: document.title, n: ((document.getElementById('root') || {}).innerText || '').trim().length }));
          controle(`${T} : la page d’accueil est rendue (${v.n} caractères)`, v.n > 200, JSON.stringify(v));
          controle(`${T} : son titre est celui du dépôt`, !titreAttendu || v.titre === titreAttendu, `« ${v.titre} » au lieu de « ${titreAttendu} »`);
        } else {
          const vu = await pg.waitForSelector('#vrm-cx-titre-formulaire', { timeout: 45000 }).then(() => true).catch(() => false);
          const v = await pg.evaluate(() => ({ n: ((document.getElementById('root') || {}).innerText || '').trim().length, texte: ((document.getElementById('root') || {}).innerText || '').slice(0, 160) }));
          controle(`${T} : le bundle de l’app se charge et mène à l’écran de connexion`, vu, JSON.stringify(v));
          controle(`${T} : jamais le dernier filet (« L'application n'a pas pu démarrer »)`, !/n'a pas pu démarrer/.test(v.texte), v.texte);
        }
        await pg.waitForTimeout(1500);
      }
      controle(`${T} : aucune erreur JavaScript`, !erreurs.length, erreurs.join(' ¦ '));
      controle(`${T} : aucun fichier /assets/ en erreur`, !assets.length, assets.join(' ¦ '));
      controle(`${T} : aucune erreur de console (hors bruit connu)`, !consoleErr.length, [...new Set(consoleErr)].slice(0, 5).join(' ¦ '));
      await ctx.close();
    }
  }
  await nav.close();
  console.log(`\n${ecrituresBloquees} requête(s) d’écriture bloquée(s) avant de partir (le contrôle n’écrit rien).`);
  if (echecs.length) {
    console.log(`\n❌ ${echecs.length} contrôle(s) en échec sur ${ORIGINE}. Revenir en arrière : Vercel → projet → Deployments → le déploiement d’avant → « Instant Rollback » (docs/passation/2026-11-06-filets-anti-bug.md).`);
    process.exit(1);
  }
  console.log(`\n✅ ${ORIGINE} s’ouvre proprement dans un navigateur (iPhone et ordinateur).`);
})().catch((e) => { console.log('❌ le contrôle a levé : ' + ((e && e.stack) || e)); process.exit(1); });
