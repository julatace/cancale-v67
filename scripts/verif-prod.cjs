#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// « COMME UN VRAI CLIENT », APRÈS CHAQUE MISE EN LIGNE — node scripts/verif-prod.cjs
// ═══════════════════════════════════════════════════════════════════════════
// (11 nov., Julien, agent2-cloisonnement) controle-prod-navigateur.cjs ouvre
// vrm.center SANS compte. Celui-ci entre DANS l'app, comme un client, et :
//   · ouvre chaque écran (navigation de l'app, sans recharger) ;
//   · fait au moins 5 gestes sans écriture (recherche, une feuille ouverte puis
//     fermée, un filtre, le menu du profil, le centre des notifications…) ;
//   · échoue si un écran plante : erreur JavaScript, garde-fou d'écran
//     (`[data-garde-ecran]`), app démontée, page blanche, fichier /assets/ en erreur.
// Deux passages, en iPhone (390 px tactile) et en ordinateur (1512 px) :
//   1. EXEMPLE — « Découvrir avec des exemples » (src/modeExemple.js) : l'app
//      remplie de données INVENTÉES, servies DANS la page ; aucune requête ne
//      part vers la base. Toujours joué, aucun secret.
//   2. COMPTE DE DÉMONSTRATION — seulement si les secrets `VRM_DEMO_EMAIL` et
//      `VRM_DEMO_MOT_DE_PASSE` existent (secrets GitHub posés par Julien) : une
//      vraie connexion sur la vraie base.
// ⚠️⚠️ JAMAIS D'ÉCRITURE EN PRODUCTION : toute requête qui n'est pas une lecture
//    est BLOQUÉE avant de partir (et comptée), sauf deux : la connexion
//    (`/auth/v1/token`, mot de passe ou renouvellement) et les fonctions de
//    LECTURE de la base (`LECTURES_RPC`). Le service worker est bloqué. Aucune
//    déconnexion n'est envoyée (elle révoquerait une session côté serveur).
//    Le compte de démonstration reste donc tel qu'il est, à jamais.
// Un échec fait échouer le job (workflow verif-prod.yml) ; revenir en arrière se
// fait À LA MAIN sur Vercel (« Instant Rollback ») — jamais automatisé ici.
// `VRM_ORIGINE=http://127.0.0.1:<port>` : jouer contre une copie locale (preuve).
// `VRM_CHROMIUM_PATH` : un Chromium précis. `SHOTS=dossier` : les captures.
// `VERIF_PASSAGES=exemple,demo` · `VERIF_LARGEURS=390,1512`.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const ORIGINE = (process.env.VRM_ORIGINE || 'https://vrm.center').replace(/\/+$/, '');
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const PASSAGES = liste('VERIF_PASSAGES', 'exemple,demo');
const LARGEURS = liste('VERIF_LARGEURS', '390,1512').map(Number);
const DEMO = { email: String(process.env.VRM_DEMO_EMAIL || '').trim(), mdp: String(process.env.VRM_DEMO_MOT_DE_PASSE || '') };
// Les écrans ouverts (les onglets de l'app, `vrm:aller`).
const ECRANS = ['journee', 'annonces', 'ventes', 'achats', 'messages', 'compta', 'stockvinted', 'favoris', 'republier', 'emails', 'invoices', 'communaute', 'dashboard', 'semaine', 'garage', 'litiges', 'settings'];
// Fonctions de la base qui ne font que LIRE (le reste des POST rpc est bloqué).
const LECTURES_RPC = /\/rest\/v1\/rpc\/(vrm_acces|vrm_acces_pour|vrm_equipe_lister|vrm_sessions_de|vrm_communaute_(carte|fil|conversations|classement\w*)|vrm_accomp_(lire|apercu|ce_que_voit)|vrm_form_(lire|page))(\?|$)/;

const echecs = [];
const controle = (nom, ok, detail) => {
  if (ok) { console.log(`OK     ${nom}`); return; }
  echecs.push(nom);
  console.log(`ÉCHEC  ${nom}${detail ? ' — ' + String(detail).slice(0, 400) : ''}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=Comme un client : ${nom}::${String(detail || '').replace(/\r?\n/g, ' ').slice(0, 300)}`);
};

async function passage(nav, { quoi, W, BRUIT, estMorceauPerime }) {
  const tel = W < 600;
  const T = `[${quoi} · ${tel ? 'iPhone 390' : 'ordinateur 1512'}]`;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const erreurs = [], assets = [];
  let bloquees = 0, sortiesBase = 0;
  pg.on('pageerror', (e) => { const t = String(e && e.message || e); if (!BRUIT.test(t) && !estMorceauPerime(t)) erreurs.push(t.slice(0, 200)); });
  pg.on('response', (r) => { const u = r.url(); if (u.startsWith(ORIGINE + '/assets/') && r.status() >= 400) assets.push(r.status() + ' ' + u.slice(ORIGINE.length)); });
  // ⚠️ Lecture seule : rien qui écrit ne part.
  await pg.route('**/*', (route) => {
    const req = route.request(), m = req.method(), u = req.url();
    if (/supabase\.co\//.test(u) || /\/api\//.test(u)) sortiesBase++;
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return route.fallback();
    if (quoi === 'démo' && m === 'POST' && /\/auth\/v1\/token\?grant_type=(password|refresh_token)/.test(u)) return route.fallback();
    if (quoi === 'démo' && m === 'POST' && LECTURES_RPC.test(u)) return route.fallback();
    bloquees++;
    return route.abort();
  });
  if (quoi === 'exemple') await pg.addInitScript(() => { try { sessionStorage.setItem('vrm_mode_exemple', '1'); } catch (_) {} });
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'verif-prod' })); localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'verif-prod' })); } catch (_) {} });

  const capture = async (nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `${quoi}-${W}-${nom}.png`) }).catch(() => {}); };
  const etat = () => pg.evaluate(() => ({
    main: !!document.querySelector('.vrm-main'),
    garde: [...document.querySelectorAll('[data-garde-ecran]')].map((e) => e.getAttribute('data-garde-ecran') || 'écran').slice(0, 3),
    n: ((document.getElementById('root') || {}).innerText || '').trim().length,
    filet: /n'a pas pu démarrer/.test((document.getElementById('root') || {}).innerText || ''),
  }));

  try {
    await pg.goto(ORIGINE + '/?tab=journee', { waitUntil: 'load', timeout: 60000 });
  } catch (e) { controle(`${T} la page se charge`, false, String(e && e.message)); await ctx.close(); return; }

  if (quoi === 'démo') {
    // L'écran de connexion de l'app, comme un client : e-mail, mot de passe, « Se connecter ».
    const champ = pg.getByRole('textbox', { name: /^Adresse e-?mail$/ });
    const vu = await champ.waitFor({ timeout: 45000 }).then(() => true).catch(() => false);
    controle(`${T} l'écran de connexion s'affiche`, vu);
    if (!vu) { await capture('connexion'); await ctx.close(); return; }
    await champ.fill(DEMO.email);
    await pg.getByLabel('Mot de passe', { exact: true }).fill(DEMO.mdp);
    await pg.getByRole('button', { name: 'Se connecter', exact: true }).click();
  }
  const entre = await pg.waitForSelector('.vrm-main', { timeout: 60000 }).then(() => true).catch(() => false);
  controle(`${T} l'app s'ouvre${quoi === 'démo' ? ' (connecté)' : ' (exemple)'}`, entre, JSON.stringify(await etat().catch(() => ({}))));
  if (!entre) { await capture('entree'); await ctx.close(); return; }
  await pg.waitForTimeout(2500);
  // Les feuilles d'accueil d'un compte neuf (Ma configuration, parcours) : « Plus tard ».
  for (let i = 0; i < 4; i++) {
    const p = pg.locator('[data-configuration] button:has-text("Plus tard"), [data-parcours-fermer]').first();
    if (!(await p.isVisible().catch(() => false))) break;
    await p.click().catch(() => {}); await pg.waitForTimeout(600);
  }

  // ── Chaque écran ──
  for (const e of ECRANS) {
    const avant = erreurs.length;
    await pg.evaluate((x) => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: x })), e);
    await pg.waitForTimeout(2200);
    const s = await etat();
    const ok = s.main && !s.garde.length && !s.filet && s.n > 40 && erreurs.length === avant;
    controle(`${T} écran « ${e} » s'ouvre sans planter`, ok, JSON.stringify({ ...s, erreurs: erreurs.slice(avant) }));
    if (!ok) await capture('ecran-' + e);
  }
  await capture('fin-ecrans');

  // ── 5 gestes (au moins) sans écriture ──
  const gestes = [];
  const geste = async (nom, f) => {
    const avant = erreurs.length;
    let fait = false;
    try { fait = await f(); } catch (_) { fait = false; }
    await pg.waitForTimeout(900);
    const s = await etat();
    const ok = s.main && !s.garde.length && erreurs.length === avant;
    if (fait) gestes.push(nom);
    controle(`${T} geste « ${nom} »${fait ? '' : ' (pas proposé ici : sauté)'} sans planter`, ok, JSON.stringify({ ...s, erreurs: erreurs.slice(avant) }));
    await pg.keyboard.press('Escape').catch(() => {});
    await pg.waitForTimeout(300);
  };
  const aller = (x) => pg.evaluate((y) => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: y })), x).then(() => pg.waitForTimeout(1500));
  await geste('chercher un article', async () => {
    await aller('ventes');
    const c = pg.locator('input[type="search"], input[placeholder*="echerch"], [role="searchbox"]').first();
    if (!(await c.isVisible().catch(() => false))) return false;
    await c.fill('nike'); await pg.waitForTimeout(600); await c.fill(''); return true;
  });
  await geste('ouvrir une vente puis la fermer', async () => {
    await aller('ventes');
    const l = pg.locator('[data-tx], [data-vente-ligne], .vrm-vente-ligne').first();
    if (!(await l.isVisible().catch(() => false))) return false;
    await l.click(); await pg.waitForTimeout(800); return true;
  });
  await geste('changer de filtre', async () => {
    await aller('annonces');
    const f = pg.locator('.vrm-filtres button, [role="tablist"] [role="tab"], .vrm-segmente button').nth(1);
    if (!(await f.isVisible().catch(() => false))) return false;
    await f.click(); return true;
  });
  await geste('ouvrir le menu du profil', async () => {
    await pg.evaluate(() => window.dispatchEvent(new Event('vrm:profil-ouvrir')));
    await pg.waitForTimeout(500);
    return pg.getByRole('button', { name: 'Se déconnecter', exact: true }).first().isVisible().catch(() => false);
  });
  await geste('ouvrir les notifications', async () => { await pg.evaluate(() => window.dispatchEvent(new Event('vrm:centre-notifs'))); return true; });
  await geste('ouvrir la calculette', async () => { await pg.evaluate(() => window.dispatchEvent(new Event('vrm:calculette'))); return true; });
  await geste('revenir à Ma journée', async () => { await aller('journee'); return true; });
  controle(`${T} au moins 5 gestes faits (${gestes.length} : ${gestes.join(', ')})`, gestes.length >= 5);

  controle(`${T} aucune erreur JavaScript`, !erreurs.length, erreurs.slice(0, 4).join(' ¦ '));
  controle(`${T} aucun fichier /assets/ en erreur`, !assets.length, assets.join(' ¦ '));
  if (quoi === 'exemple') controle(`${T} l'exemple n'a rien demandé à la base`, sortiesBase === 0, `${sortiesBase} requête(s) vers la base ou /api`);
  console.log(`       ${T} ${bloquees} écriture(s) bloquée(s) avant de partir.`);
  await ctx.close();
}

(async () => {
  const { BRUIT, estMorceauPerime } = await import(require('url').pathToFileURL(path.join(RACINE, 'src', 'plantages.js')).href);
  let pw;
  try { pw = require(path.join(RACINE, 'node_modules', 'playwright')); } catch (_) { pw = require('playwright'); }
  const exe = process.env.VRM_CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const nav = await pw.chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--no-proxy-server'] });
  console.log(`« Comme un vrai client » sur ${ORIGINE} — aucune écriture ne part.\n`);
  for (const p of PASSAGES) {
    if (p === 'demo' && !(DEMO.email && DEMO.mdp)) {
      console.log('SAUTÉ  compte de démonstration : secrets VRM_DEMO_EMAIL / VRM_DEMO_MOT_DE_PASSE absents (Julien les pose : docs/passation/2026-11-11-cloisonnement.md).');
      if (process.env.GITHUB_ACTIONS) console.log('::warning title=Comme un client::Compte de démonstration pas configuré (secrets VRM_DEMO_EMAIL, VRM_DEMO_MOT_DE_PASSE) — seul l\'exemple a été joué.');
      continue;
    }
    for (const W of LARGEURS) await passage(nav, { quoi: p === 'demo' ? 'démo' : 'exemple', W, BRUIT, estMorceauPerime });
  }
  await nav.close();
  if (echecs.length) {
    console.log(`\n❌ ${echecs.length} contrôle(s) en échec sur ${ORIGINE}. Revenir en arrière : Vercel → Deployments → le déploiement d'avant → « Instant Rollback ».`);
    process.exit(1);
  }
  console.log(`\n✅ ${ORIGINE} : chaque écran s'ouvre et les gestes passent, sans rien écrire.`);
})().catch((e) => { console.log('❌ le contrôle a levé : ' + ((e && e.stack) || e)); process.exit(1); });
