#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// LE CONTRÔLE QUOTIDIEN DE LA PRODUCTION, EN NAVIGATEUR
//   node scripts/controle-prod-quotidien.cjs
// ═══════════════════════════════════════════════════════════════════════════
// (9 nov.) Lancé chaque matin à 7 h 10 (heure de Paris) par
// .github/workflows/controle-prod-quotidien.yml, et à la main. Il ouvre
// https://vrm.center comme un visiteur, dans un vrai Chromium, en iPhone
// (390 px, tactile) et en ordinateur (1512 px), et regarde ce qu'un client
// verrait :
//   A. page d'accueil : rendue, titre « VRM… », bouton « Créer mon compte »
//      (`data-cta="inscription"`, vers /?inscription) et « Se connecter »,
//      aucune erreur JavaScript ni de console (hors bruit connu de
//      src/plantages.js), aucun fichier /assets/ en erreur, rendue sous le seuil ;
//   S. /statut : la page publique d'état se rend, sans erreur ;
//   H. /aide : le centre d'aide liste ses articles, le premier s'ouvre ;
//   R. /recuperation.html ouverte par un lien EXPIRÉ (les formes que Supabase
//      envoie : `#error=…&error_code=otp_expired`, la même en `?`) : elle dit
//      « expiré » et montre le renvoi — sans AUCUN appel à Supabase (aucun
//      e-mail ne part ; le formulaire de renvoi n'est jamais soumis) ;
//   E. mode exemple (« Voir VRM avec des exemples ») : Ma journée, Colis,
//      Ventes se rendent avec le bandeau d'exemple et AUCUNE requête n'atteint
//      la base (lecture comprise) ni n'écrit ;
//   P. /api/sante : `ok: true`, chaque clé de `sante()` (api/compte.js du dépôt)
//      un oui/non, `etat` lisible et sans panne ;
//   X. l'extension servie : /VRM-extension.zip est un zip d'UN seul dossier
//      (§2.6) dont le manifeste porte `EXT_ATTENDUE` (src/App.jsx du dépôt) ;
//   M. /manifest.webmanifest et chacune de ses icônes (des images) ;
//   T. en-têtes de sécurité : ceux que vercel.json du dépôt pose sur « / »,
//      valeur exacte ;
//   C. (seulement si les secrets PROD_DEMO_EMAIL et PROD_DEMO_MDP existent)
//      connexion au compte de DÉMO dédié : Ma journée se rend. Sans eux : sauté,
//      et dit. Ce script ne crée JAMAIS de compte.
// ⚠️⚠️ LECTURE SEULE (§2.3) : aucune requête autre que GET/HEAD/OPTIONS ne
// part — elles sont bloquées AVANT de partir et comptées. Seule exception, et
// seulement en C : la connexion elle-même (`/auth/v1/token`, qui ne crée rien).
// Le service worker est bloqué (rien ne s'installe). Rien n'est écrit, nulle part.
//
// `VRM_ORIGINE=http://127.0.0.1:<port>` : jouer le contrôle contre une copie
// locale (scripts/audit-controle-prod-quotidien.cjs).
// `CAPTURES=dossier` : une capture PNG par page et par appareil (artefact du run).
// `SEUIL_RENDU_MS` (défaut 8000) : délai maximal pour que l'accueil soit rendu.
// `RESULTAT=fichier.json` : le bilan, lu par le workflow pour l'issue GitHub.
// `VRM_CHROMIUM_PATH` : un Chromium précis.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const RACINE = path.join(__dirname, '..');
const ORIGINE = (process.env.VRM_ORIGINE || 'https://vrm.center').replace(/\/+$/, '');
const CAPTURES = process.env.CAPTURES || '';
const SEUIL_RENDU_MS = Number(process.env.SEUIL_RENDU_MS) || 8000;
const RESULTAT = process.env.RESULTAT || '';
const DEMO_EMAIL = process.env.PROD_DEMO_EMAIL || '';
const DEMO_MDP = process.env.PROD_DEMO_MDP || '';
const HOTE_BASE = 'supabase.co';

// ── Ce que le dépôt attend (lu dans la copie du dépôt, jamais recopié ici) ──
const lireDepot = (rel) => { try { return fs.readFileSync(path.join(RACINE, rel), 'utf8'); } catch (_) { return ''; } };
const versionAttendue = (() => { const m = /const EXT_ATTENDUE\s*=\s*'([0-9.]+)'/.exec(lireDepot('src/App.jsx')); return m ? m[1] : null; })();
// Les clés oui/non de `sante()` : `nom: valeur` dans l'objet passé à repondre(…).
const clesSante = (() => {
  const src = lireDepot('api/compte.js');
  const i = src.indexOf('function sante(');
  if (i < 0) return null;
  const corps = src.slice(i, src.indexOf('\n}', i));
  const bloc = corps.slice(corps.indexOf('{', corps.indexOf('repondre(')));
  return [...bloc.matchAll(/\b([A-Za-z]+):/g)].map((m) => m[1]);
})();
// Les en-têtes que vercel.json pose sur « / » (le dernier bloc qui correspond gagne).
const entetesAttendus = (() => {
  let conf; try { conf = JSON.parse(lireDepot('vercel.json')); } catch (_) { return null; }
  const out = {};
  for (const b of conf.headers || []) {
    let re; try { re = new RegExp('^' + b.source + '$'); } catch (_) { continue; }
    if (!re.test('/')) continue;
    for (const h of b.headers || []) if (!/^cache-control$/i.test(h.key)) out[h.key.toLowerCase()] = h.value;
  }
  return out;
})();

// ── Lire un zip (répertoire central), sans dépendance ────────────────────────
function paquetExtension(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) return null;
  let fin = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { fin = i; break; }
  if (fin < 0) return null;
  const n = buf.readUInt16LE(fin + 10), debut = buf.readUInt32LE(fin + 16);
  const entrees = [];
  for (let k = 0, p = debut; k < n; k++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) return null;
    const methode = buf.readUInt16LE(p + 10), taille = buf.readUInt32LE(p + 20);
    const ln = buf.readUInt16LE(p + 28), lx = buf.readUInt16LE(p + 30), lc = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    entrees.push({ nom: buf.slice(p + 46, p + 46 + ln).toString('utf8'), methode, taille, local });
    p += 46 + ln + lx + lc;
  }
  const lire = (e) => {
    const p = e.local;
    if (buf.readUInt32LE(p) !== 0x04034b50) return null;
    const d = p + 30 + buf.readUInt16LE(p + 26) + buf.readUInt16LE(p + 28);
    const brut = buf.slice(d, d + e.taille);
    return e.methode === 0 ? brut : e.methode === 8 ? zlib.inflateRawSync(brut) : null;
  };
  const man = entrees.filter((e) => /(^|\/)manifest\.json$/.test(e.nom)).sort((a, b) => a.nom.length - b.nom.length)[0];
  let version = null;
  if (man) { try { version = JSON.parse(lire(man).toString('utf8')).version || null; } catch (_) {} }
  const tetes = [...new Set(entrees.map((e) => e.nom.split('/')[0] + (e.nom.includes('/') ? '/' : '')))];
  return { version, tetes };
}

// ── Le bilan ─────────────────────────────────────────────────────────────────
const resultats = [];
const controle = (nom, ok, detail) => {
  resultats.push({ nom, ok: !!ok, detail: ok ? undefined : String(detail || '').slice(0, 400) });
  if (ok) { console.log(`OK     ${nom}`); return; }
  console.log(`ÉCHEC  ${nom}${detail ? ' — ' + String(detail).slice(0, 400) : ''}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=Contrôle quotidien : ${nom.replace(/[:,]/g, ' ')}::${String(detail || '').replace(/\r?\n/g, ' ').slice(0, 300)}`);
};
const saute = (nom, raison) => { resultats.push({ nom, ok: true, saute: raison }); console.log(`SAUTÉ  ${nom} — ${raison}`); };

const APPAREILS = [
  ['iphone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }],
  ['ordinateur', { viewport: { width: 1512, height: 950 } }],
];

let ecrituresBloquees = 0;
const ecrituresParPage = {};

(async () => {
  const { BRUIT, estMorceauPerime } = await import(require('url').pathToFileURL(path.join(RACINE, 'src', 'plantages.js')).href);
  let pw;
  try { pw = require(path.join(RACINE, 'node_modules', 'playwright')); } catch (_) { pw = require('playwright'); }
  const exe = process.env.VRM_CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const nav = await pw.chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  if (CAPTURES) fs.mkdirSync(CAPTURES, { recursive: true });
  console.log(`Contrôle quotidien de ${ORIGINE} — navigateur, lecture seule, sans compte${DEMO_EMAIL && DEMO_MDP ? ' (puis le compte de démo)' : ''}.\n`);

  // Une page « surveillée » : erreurs, fichiers en erreur, requêtes vers la base,
  // et TOUTE écriture bloquée avant de partir (sauf `permettre`, pour la connexion).
  async function ouvrir(appareil, cle, { initScript, permettre } = {}) {
    const ctx = await nav.newContext({ ...APPAREILS.find((a) => a[0] === appareil)[1], locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' });
    if (initScript) await ctx.addInitScript(initScript);
    const pg = await ctx.newPage();
    const s = { erreurs: [], console: [], assets: [], base: [], ecritures: [] };
    pg.on('pageerror', (e) => s.erreurs.push(String((e && e.message) || e).slice(0, 200)));
    pg.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (BRUIT.test(t) || estMorceauPerime(t) || /^Failed to load resource/.test(t)) return;
      s.console.push(t.slice(0, 200));
    });
    pg.on('response', (r) => { const u = r.url(); if (u.startsWith(ORIGINE + '/') && /\/assets\//.test(u) && r.status() >= 400) s.assets.push(r.status() + ' ' + u.slice(ORIGINE.length)); });
    await ctx.route('**/*', (route) => {
      const q = route.request(), m = q.method(), u = q.url();
      if (u.includes(HOTE_BASE)) s.base.push(m + ' ' + u.replace(/\?.*$/, '').slice(0, 120));
      if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return route.fallback();
      if (permettre && permettre(m, u)) return route.fallback();
      ecrituresBloquees++; ecrituresParPage[cle] = (ecrituresParPage[cle] || 0) + 1;
      s.ecritures.push(m + ' ' + u.replace(/\?.*$/, '').slice(0, 120));
      return route.abort();
    });
    return { ctx, pg, s };
  }
  async function capture(pg, nom) {
    if (!CAPTURES) return;
    try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: true, timeout: 20000 }); } catch (_) {
      try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), timeout: 10000 }); } catch (_) {}
    }
  }
  const propre = (T, s, { console: juger = true } = {}) => {
    controle(`${T} : aucune erreur JavaScript`, !s.erreurs.length, s.erreurs.join(' ¦ '));
    controle(`${T} : aucun fichier /assets/ en erreur`, !s.assets.length, s.assets.join(' ¦ '));
    if (juger) controle(`${T} : aucune erreur de console (hors bruit connu)`, !s.console.length, [...new Set(s.console)].slice(0, 5).join(' ¦ '));
  };
  const aller = async (pg, T, url) => {
    try { const r = await pg.goto(url, { waitUntil: 'load', timeout: 45000 }); return r; } catch (e) { controle(`${T} : la page se charge`, false, String(e && e.message).split('\n')[0]); return null; }
  };

  for (const [appareil] of APPAREILS) {
    // ── A. Page d'accueil ────────────────────────────────────────────────────
    {
      const T = `[${appareil}] accueil`;
      const { ctx, pg, s } = await ouvrir(appareil, 'accueil');
      const t0 = Date.now();
      const r = await aller(pg, T, ORIGINE + '/');
      if (r) {
        controle(`${T} : HTTP 200`, r.status() === 200, `HTTP ${r.status()}`);
        const rendu = await pg.waitForFunction(() => { const e = document.getElementById('root'); return !!(e && e.innerText && e.innerText.trim().length > 200); }, null, { timeout: 30000 }).then(() => true).catch(() => false);
        const ms = Date.now() - t0;
        controle(`${T} : la page est rendue`, rendu, 'moins de 200 caractères dans #root après 30 s');
        controle(`${T} : rendue en moins de ${SEUIL_RENDU_MS} ms (${ms} ms)`, rendu && ms <= SEUIL_RENDU_MS, `${ms} ms`);
        const v = await pg.evaluate(() => {
          const cta = document.querySelector('[data-cta="inscription"]');
          const cx = document.querySelector('[data-cta-nav="connexion"]');
          const vis = (e) => { if (!e) return false; const b = e.getBoundingClientRect(); const st = getComputedStyle(e); return b.width > 0 && b.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'; };
          return { titre: document.title, cta: !!cta, ctaVisible: vis(cta), ctaHref: cta ? cta.getAttribute('href') : null, ctaTexte: cta ? cta.innerText.trim() : '', connexion: cx ? cx.getAttribute('href') : null, h: cta ? cta.getBoundingClientRect().height : 0 };
        });
        controle(`${T} : son titre dit VRM`, /^VRM\b/.test(v.titre || ''), `« ${v.titre} »`);
        controle(`${T} : bouton « ${v.ctaTexte || 'Créer mon compte'} » visible, vers /?inscription`, v.cta && v.ctaVisible && v.ctaHref === '/?inscription', JSON.stringify(v));
        controle(`${T} : lien « Se connecter » vers /?connexion`, v.connexion === '/?connexion', JSON.stringify(v));
        await pg.waitForTimeout(1500);
        await capture(pg, `${appareil}-accueil`);
      }
      propre(T, s);
      await ctx.close();
    }

    // ── S. /statut ───────────────────────────────────────────────────────────
    {
      const T = `[${appareil}] /statut`;
      const { ctx, pg, s } = await ouvrir(appareil, 'statut');
      const r = await aller(pg, T, ORIGINE + '/statut');
      if (r) {
        controle(`${T} : HTTP 200`, r.status() === 200, `HTTP ${r.status()}`);
        await pg.waitForTimeout(2500);
        const v = await pg.evaluate(() => ({ titre: document.title, n: (document.body.innerText || '').trim().length, app: !!document.getElementById('root') }));
        controle(`${T} : la page d’état se rend (pas l’app, pas une page vide)`, /statut/i.test(v.titre) && v.n > 80 && !v.app, JSON.stringify(v));
        await capture(pg, `${appareil}-statut`);
      }
      propre(T, s);
      await ctx.close();
    }

    // ── H. /aide ─────────────────────────────────────────────────────────────
    {
      const T = `[${appareil}] /aide`;
      const { ctx, pg, s } = await ouvrir(appareil, 'aide');
      const r = await aller(pg, T, ORIGINE + '/aide');
      if (r) {
        controle(`${T} : HTTP 200`, r.status() === 200, `HTTP ${r.status()}`);
        const liens = await pg.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="/aide/"]')].map((a) => a.getAttribute('href')).filter((h) => /^\/aide\/[a-z-]+$/.test(h)))]);
        controle(`${T} : le centre d’aide liste ses articles (${liens.length})`, liens.length >= 3, JSON.stringify(liens));
        await capture(pg, `${appareil}-aide`);
        if (liens.length) {
          const r2 = await aller(pg, `${T} ${liens[0]}`, ORIGINE + liens[0]);
          if (r2) {
            const v = await pg.evaluate(() => ({ h1: ((document.querySelector('h1') || {}).innerText || '').trim(), n: (document.body.innerText || '').trim().length }));
            controle(`${T} : l’article ${liens[0]} s’ouvre`, r2.status() === 200 && v.h1.length > 0 && v.n > 200, `HTTP ${r2.status()} ${JSON.stringify(v)}`);
            if (appareil === 'iphone') await capture(pg, `${appareil}-aide-article`);
          }
        }
      }
      propre(T, s);
      await ctx.close();
    }

    // ── R. /recuperation.html, ouverte par un lien expiré ────────────────────
    const FORMES = [
      ['dièse', '/recuperation.html#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'],
      ['paramètre', '/recuperation.html?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'],
    ];
    for (const [forme, chemin] of FORMES) {
      const T = `[${appareil}] récupération, lien expiré (${forme})`;
      const { ctx, pg, s } = await ouvrir(appareil, 'recuperation');
      const r = await aller(pg, T, ORIGINE + chemin);
      if (r) {
        await pg.waitForFunction(() => { const m = document.getElementById('message'); return m && !/Ouverture de ton lien/.test(m.textContent); }, null, { timeout: 15000 }).catch(() => {});
        const v = await pg.evaluate(() => {
          const vis = (id) => { const e = document.getElementById(id); return !!e && !e.hidden && e.getBoundingClientRect().height > 0; };
          return { message: ((document.getElementById('message') || {}).textContent || '').trim(), renvoi: vis('renvoi'), nouveau: vis('nouveau') };
        });
        controle(`${T} : dit « expiré »`, /expir/i.test(v.message), `« ${v.message} »`);
        controle(`${T} : montre le renvoi d’e-mail, pas le formulaire du mot de passe`, v.renvoi && !v.nouveau, JSON.stringify(v));
        controle(`${T} : aucun appel à Supabase (aucun e-mail ne part)`, !s.base.length && !s.ecritures.length, [...s.base, ...s.ecritures].join(' ¦ '));
        if (forme === 'dièse') await capture(pg, `${appareil}-recuperation-expire`);
      }
      propre(T, s);
      await ctx.close();
    }

    // ── E. Mode exemple : Ma journée, Colis, Ventes, sans rien lire ni écrire ─
    for (const [ecran, tab] of [['Ma journée', 'journee'], ['Colis', 'cat_bord'], ['Ventes', 'cat_ventes']]) {
      const T = `[${appareil}] mode exemple, ${ecran}`;
      const { ctx, pg, s } = await ouvrir(appareil, 'exemple', { initScript: () => { try { sessionStorage.setItem('vrm_mode_exemple', '1'); } catch (_) {} } });
      const r = await aller(pg, T, ORIGINE + '/?tab=' + tab);
      if (r) {
        const vu = await pg.waitForSelector('[data-exemple-bandeau]', { timeout: 45000 }).then(() => true).catch(() => false);
        await pg.waitForSelector('.vrm-main', { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(3000);
        const v = await pg.evaluate(() => ({ n: ((document.querySelector('.vrm-main') || {}).innerText || '').trim().length, fatal: /n'a pas pu démarrer|n’a pas pu démarrer/.test((document.getElementById('root') || {}).innerText || '') }));
        controle(`${T} : l’écran se rend avec le bandeau d’exemple`, vu && v.n > 80 && !v.fatal, JSON.stringify(v));
        controle(`${T} : aucune requête vers la base (lecture comprise)`, !s.base.length, s.base.slice(0, 5).join(' ¦ '));
        controle(`${T} : rien d’écrit (aucune requête d’écriture tentée vers l’extérieur)`, !s.ecritures.length, s.ecritures.slice(0, 5).join(' ¦ '));
        await capture(pg, `${appareil}-exemple-${tab}`);
      }
      propre(T, s);
      await ctx.close();
    }
  }

  // ── P. /api/sante ──────────────────────────────────────────────────────────
  const api = await pw.request.newContext();
  try {
    const r = await api.get(ORIGINE + '/api/sante', { headers: { accept: 'application/json' }, timeout: 30000 });
    let j = null; try { j = await r.json(); } catch (_) {}
    controle('/api/sante : HTTP 200 et du JSON', r.status() === 200 && j && typeof j === 'object', `HTTP ${r.status()}`);
    if (j && typeof j === 'object') {
      controle('/api/sante : « ok » est vrai', j.ok === true, JSON.stringify(j).slice(0, 200));
      if (!clesSante || !clesSante.length) controle('/api/sante : clés attendues lues dans api/compte.js du dépôt', false, 'illisibles');
      else {
        const manque = clesSante.filter((k) => !(k in j));
        controle(`/api/sante : les ${clesSante.length} clés de sante() sont là`, !manque.length, `absente(s) : ${manque.join(', ')}`);
        const pasBool = clesSante.filter((k) => k in j && typeof j[k] !== 'boolean');
        controle('/api/sante : chaque clé est un oui/non', !pasBool.length, pasBool.join(', '));
      }
      const e = j.etat;
      controle('/api/sante : « etat » lisible (base, emails, notifications)', !!(e && typeof e === 'object' && ['base', 'emails', 'notifications'].every((k) => typeof e[k] === 'string')), JSON.stringify(e));
      if (e && typeof e === 'object') {
        const pannes = ['base', 'emails', 'notifications'].filter((k) => e[k] === 'panne');
        controle('/api/sante : aucune panne affichée', !pannes.length, pannes.join(', '));
      }
    }
  } catch (e) { controle('/api/sante : répond', false, String(e && e.message).split('\n')[0]); }

  // ── X. L'extension servie ──────────────────────────────────────────────────
  try {
    const r = await api.get(ORIGINE + '/VRM-extension.zip', { timeout: 60000 });
    const buf = await r.body();
    const p = r.status() === 200 ? paquetExtension(buf) : null;
    controle('extension servie : HTTP 200 et un zip lisible', !!p, `HTTP ${r.status()}, ${buf.length} octets${/^\s*<!doctype html/i.test(buf.slice(0, 100).toString()) ? ' (la page de l’app servie à la place)' : ''}`);
    if (p) {
      const dossiers = p.tetes.filter((t) => t.endsWith('/'));
      controle('extension servie : se dézippe en UN seul dossier', p.tetes.length === 1 && dossiers.length === 1, `têtes : ${p.tetes.slice(0, 6).join(', ')}`);
      controle(`extension servie : version ${versionAttendue} (EXT_ATTENDUE du dépôt)`, !!versionAttendue && p.version === versionAttendue, `servie : ${p.version}, attendue : ${versionAttendue}`);
    }
  } catch (e) { controle('extension servie : répond', false, String(e && e.message).split('\n')[0]); }

  // ── M. Manifeste et icônes ─────────────────────────────────────────────────
  try {
    const r = await api.get(ORIGINE + '/manifest.webmanifest', { timeout: 30000 });
    let m = null; try { m = JSON.parse(await r.text()); } catch (_) {}
    controle('manifeste : HTTP 200, nom, départ et icônes', r.status() === 200 && m && m.name && m.start_url && Array.isArray(m.icons) && m.icons.length > 0, `HTTP ${r.status()}`);
    if (m && Array.isArray(m.icons)) {
      const mortes = [];
      for (const i of m.icons) {
        const src = i && i.src; if (!src) continue;
        const x = await api.get(new URL(src, ORIGINE + '/').href, { timeout: 30000 }).catch(() => null);
        if (!x || x.status() !== 200 || !/^image\//.test(x.headers()['content-type'] || '')) mortes.push(`${src} (${x ? x.status() + ' ' + (x.headers()['content-type'] || '') : 'injoignable'})`);
      }
      controle(`manifeste : ses ${m.icons.length} icônes répondent (des images)`, !mortes.length, mortes.join(', '));
    }
  } catch (e) { controle('manifeste : répond', false, String(e && e.message).split('\n')[0]); }

  // ── T. En-têtes de sécurité ────────────────────────────────────────────────
  try {
    const r = await api.get(ORIGINE + '/', { timeout: 30000 });
    const h = r.headers();
    if (!entetesAttendus || !Object.keys(entetesAttendus).length) controle('en-têtes de sécurité : lus dans vercel.json du dépôt', false, 'illisibles');
    else {
      const ecarts = Object.entries(entetesAttendus).filter(([k, v]) => (h[k] || '') !== v).map(([k, v]) => `${k} : ${h[k] ? '« ' + h[k].slice(0, 60) + '… »' : 'absent'} (attendu « ${v.slice(0, 60)}${v.length > 60 ? '…' : ''} »)`);
      controle(`en-têtes de sécurité : les ${Object.keys(entetesAttendus).length} de vercel.json, valeur exacte`, !ecarts.length, ecarts.join(' ¦ '));
    }
  } catch (e) { controle('en-têtes de sécurité : la page répond', false, String(e && e.message).split('\n')[0]); }
  await api.dispose();

  // ── C. Compte de démo (seulement s'il existe) ──────────────────────────────
  if (!DEMO_EMAIL || !DEMO_MDP) saute('connexion au compte de démo', 'secrets PROD_DEMO_EMAIL / PROD_DEMO_MDP absents : aucun compte n’est utilisé (et aucun n’est créé)');
  else {
    const T = '[ordinateur] compte de démo, Ma journée';
    // Seule écriture permise : la connexion elle-même (elle ne crée rien).
    const { ctx, pg, s } = await ouvrir('ordinateur', 'demo', { permettre: (m, u) => m === 'POST' && u.includes(HOTE_BASE) && /\/auth\/v1\/token\?grant_type=(password|refresh_token)/.test(u) });
    const r = await aller(pg, T, ORIGINE + '/?connexion');
    if (r) {
      const champ = await pg.waitForSelector('.vrm-cx-form input[type="email"]', { timeout: 45000 }).catch(() => null);
      if (!champ) controle(`${T} : le formulaire de connexion s’affiche`, false, 'champ e-mail introuvable');
      else {
        await pg.fill('.vrm-cx-form input[type="email"]', DEMO_EMAIL);
        await pg.fill('.vrm-cx-form input[type="password"]', DEMO_MDP);
        await pg.press('.vrm-cx-form input[type="password"]', 'Enter');
        const vu = await pg.waitForSelector('.vrm-main', { timeout: 45000 }).then(() => true).catch(() => false);
        await pg.waitForTimeout(4000);
        const v = await pg.evaluate(() => ({ n: ((document.querySelector('.vrm-main') || {}).innerText || '').trim().length, fatal: /n'a pas pu démarrer|n’a pas pu démarrer/.test((document.getElementById('root') || {}).innerText || '') }));
        controle(`${T} : connecté, l’écran se rend`, vu && v.n > 80 && !v.fatal, JSON.stringify(v));
        // La capture d'un vrai compte n'est PAS gardée (le dépôt est public, l'artefact aussi).
      }
    }
    controle(`${T} : aucune erreur JavaScript`, !s.erreurs.length, s.erreurs.join(' ¦ '));
    console.log(`       (${s.ecritures.length} écriture(s) de l’app bloquée(s) pendant la visite du compte de démo)`);
    await ctx.close();
  }

  await nav.close();
  const echecs = resultats.filter((r) => !r.ok);
  console.log(`\n${ecrituresBloquees} requête(s) d’écriture bloquée(s) avant de partir (${Object.entries(ecrituresParPage).map(([k, n]) => `${k} : ${n}`).join(', ') || 'aucune'}).`);
  if (RESULTAT) {
    try { fs.writeFileSync(RESULTAT, JSON.stringify({ origine: ORIGINE, date: new Date().toISOString(), echecs: echecs.length, total: resultats.length, resultats }, null, 1)); } catch (_) {}
  }
  if (echecs.length) {
    console.log(`\n❌ ${echecs.length} contrôle(s) en échec sur ${ORIGINE} :`);
    for (const e of echecs) console.log(`   · ${e.nom} — ${e.detail}`);
    process.exit(1);
  }
  console.log(`\n✅ ${ORIGINE} : ${resultats.length} contrôles verts (navigateur, lecture seule).`);
})().catch((e) => {
  console.log('❌ le contrôle a levé : ' + ((e && e.stack) || e));
  if (RESULTAT) { try { fs.writeFileSync(RESULTAT, JSON.stringify({ origine: ORIGINE, echecs: 1, resultats: [...resultats, { nom: 'le contrôle a levé', ok: false, detail: String((e && e.message) || e).slice(0, 300) }] })); } catch (_) {} }
  process.exit(1);
});
