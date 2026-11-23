#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  BANC « EXTENSION CLAIRE » (19 nov., demande H) — la page « Extension » RENDUE dans la vraie app
//
//  Le vrai `dist/` servi par le monde du banc (_e2e-monde.cjs : faux Supabase à état, vrm.center), une
//  session posée, des données INVENTÉES. L'extension est SIMULÉE par un pont dans la page (le protocole
//  de bridge.js : `ready` puis `etat:result`) : chaque scénario choisit ce qu'elle répond — c'est ce qui
//  permet de montrer des états rares (pause, plafond, deux comptes) sans toucher Vinted.
//  Scénarios :
//    · tout-va-bien   extension 5.409 à jour, compte A ouvert ici, 12/50 cette heure, un 2e navigateur vu ;
//    · aucune         pas d'extension dans ce navigateur ;
//    · freins         compte B ouvert (A ne l'est pas), deux comptes dans les onglets, A à 45/50, B en prudence ;
//    · pastille       depuis Ventes, toucher la pastille de la coque ouvre la page.
//  Rendu à 390 × 844 (tactile) et 1512 × 950, clair et sombre. Jugé sur les data-* de la page (codes de la
//  règle, oui / non par geste), le débordement horizontal, les cibles ≥ 44 px, l'absence de mots techniques
//  dans le texte rendu. Captures (BANC_CAPTURE=dossier) à REGARDER.
//    node scripts/bancs/extension-claire.cjs            (après npm run build)
//    BANC_CAPTURE=/tmp/x node scripts/bancs/extension-claire.cjs
//    node scripts/bancs/extension-claire.cjs --prouve   (chaque mutation du build doit rougir)
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { monde, certificat, HOTES } = require('./_e2e-monde.cjs');
const chargerPw = () => { for (const p of [__dirname, process.cwd(), path.join(__dirname, '..', '..')]) { try { return require(require.resolve('playwright', { paths: [p] })); } catch (_) {} } return null; };
const pw = chargerPw();
const RACINE = path.join(__dirname, '..', '..');
const CHROME = process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const PORT = Number(process.env.BANC_PORT) || 4833;
const DIST0 = path.resolve(process.env.BANC_DIST || path.join(RACINE, 'dist'));
const CAPT = process.env.BANC_CAPTURE || '';
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const MUT = arg('--mutation');
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, ko = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${det ? ' — ' + String(det).slice(0, 400) : ''}`); } };

// Mutations du BUILD (§6.1) : la page doit rougir.
const MUTATIONS = {
  // la page ne lit plus le compte de l'onglet : tout compte paraît « pas ouvert »
  'onglet-ignore': [[/vintedPasSu\)return\{ou:"passu"\}/g, 'vintedPasSu)return{ou:"passu"};if(1)return{ou:"personne-ici"}']],
  // la pastille rouvre l'ancien panneau au lieu de la page
  'pastille-panneau': [[/(\w)\?\1\("extension"\):/g, '$1?$1("ventes"):']],
};
if (process.argv.includes('--prouve')) {
  const lancer = (extra) => spawnSync(process.execPath, [__filename, ...extra], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env, timeout: 900000, encoding: 'utf8' });
  const base = lancer([]); const vert = base.status === 0;
  console.log(`${vert ? '✅' : '❌'} passage sur le code tel quel : ${vert ? 'vert' : 'ROUGE'}`);
  let rate = vert ? 0 : 1;
  for (const m of Object.keys(MUTATIONS)) {
    const r = lancer(['--mutation', m]); const rouges = String(r.stdout).split('\n').filter((l) => /❌/.test(l));
    const bon = r.status !== 0 && rouges.length > 0; if (!bon) rate++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${m} » : ${bon ? `rouge (${rouges.length} contrôle(s))` : 'RESTE VERTE'}`);
    for (const l of rouges.slice(0, 3)) console.log('     ' + l.trim());
  }
  process.exit(rate ? 1 : 0);
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-ext-claire-'));
function preparerDist() {
  const m = MUT && MUTATIONS[MUT];
  if (!m) return DIST0;
  const d = path.join(TMP, 'dist'); fs.cpSync(DIST0, d, { recursive: true }); let touche = 0;
  const marcher = (dir) => { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) marcher(p); else if (/\.js$/.test(f)) { const s = fs.readFileSync(p, 'utf8'); let t = s; for (const [a, b] of m) t = t.replace(a, b); if (t !== s) { fs.writeFileSync(p, t); touche++; } } } };
  marcher(d);
  if (!touche) { console.log(`❌ mutation ${MUT} : rien trouvé à muter dans dist/`); process.exit(2); }
  return d;
}
const regles = () => HOTES.map((h) => `MAP ${h} 127.0.0.1:${PORT}`).concat(['MAP * ~NOTFOUND']).join(', ');
const U = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'vendeur@exemple.test', mdp: 'bon-mot-de-passe' };
const A = '41000001', B = '41000002';
const VERSION = JSON.parse(fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'manifest.json'), 'utf8')).version;

// Le pont simulé : ce que l'extension RÉPOND (la forme de `etatPourApp`, background.js).
function etatPont(sc, t) {
  if (sc === 'aucune') return null;
  const ici = { v: 1, appareil: 'aaaaaaaaaaaaaaaa', onglets: { vinted: sc === 'freins' ? 2 : 1, leboncoin: 0, vestiaire: 0 }, comptesOnglets: sc === 'freins' ? [B, A] : [A],
    vus: { vinted: sc === 'freins' ? { [B]: t - 2 * 60000, [A]: t - 50 * 60000 } : { [A]: t - 3 * 60000 } }, verrou: null, ouverture: null };
  return { ok: true, version: VERSION, code: VERSION, ext: 'abcdefghijklmnopabcdefghijklmnop', vrm: { ok: true, connecte: true, expiree: false, email: U.email, user_id: U.id, cloisonne: true },
    vinted: sc === 'freins' ? { uid: B, login: 'atelier_b' } : { uid: A, login: 'boutique_a' }, cmds: {}, ici, fileReseau: [], rapport: true, origine: 'zip', capte: { coupe: false } };
}
async function contexte(nav, sc, { mobile, sombre }) {
  const ctx = await nav.newContext(Object.assign({ viewport: mobile ? { width: 390, height: 844 } : { width: 1512, height: 950 }, timezoneId: 'Europe/Paris', locale: 'fr-FR', ignoreHTTPSErrors: true },
    mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const s = M.ouvrir(M.USERS.get(U.email));
  const t = Date.now();
  await ctx.addInitScript(({ s, uid, sombre, etat }) => {
    if (location.origin !== 'https://vrm.center') return;
    try { localStorage.setItem('schema_cloisonne', '1'); localStorage.setItem('vrm_ext_separee_' + uid, '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1');
      localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_apparence', JSON.stringify(sombre ? 'sombre' : 'clair'));
      if (!localStorage.getItem('__banc_pose')) { localStorage.setItem('__banc_pose', '1'); localStorage.setItem('vrm_session', JSON.stringify(s)); } } catch (_) {}
    if (!etat) return;
    // Le protocole de bridge.js : un « ready » par ping, puis la réponse à « etat ».
    window.addEventListener('message', (e) => {
      const d = e && e.data; if (e.source !== window || !d || typeof d !== 'object') return;
      if (d.__vmr === 'ping') window.postMessage({ __vmr: 'ready', version: etat.version, id: etat.ext }, '*');
      else if (d.__vmr === 'etat' && d.reqId) window.postMessage({ __vmr: 'etat:result', reqId: d.reqId, resp: Object.assign({}, etat, { pause: window.__pause || undefined }) }, '*');
      else if (d.reqId && typeof d.__vmr === 'string' && !/:result$/.test(d.__vmr)) window.postMessage({ __vmr: d.__vmr + ':result', reqId: d.reqId, resp: null }, '*');
    });
  }, { s: { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Date.now() + 3600e3, user: s.user }, uid: U.id, sombre, etat: etatPont(sc, t) });
  return ctx;
}
let M;
function semer(sc) {
  const t = Date.now();
  const app = M.st.tables.app_data = M.st.tables.app_data.filter((r) => !/^(actions_compte_|ext_appareil_)/.test(r.id));
  M.st.tables.vinted_accounts = [{ vinted_user_id: A, login: 'boutique_a', domain: 'www.vinted.fr', owner: U.id }, { vinted_user_id: B, login: 'atelier_b', domain: 'www.vinted.fr', owner: U.id }];
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
  const heures = (n) => Array.from({ length: n }, (_, i) => t - (50 - i) * 60000);
  const ligne = (uid, n, plus = {}) => ({ id: `actions_compte_${uid}_aaaaaaaaaaaaaaaa`, owner: U.id, updated_at: new Date(t).toISOString(), data: Object.assign({ v: 2, uid, nav: 'aaaaaaaaaaaaaaaa', at: new Date(t).toISOString(), ts: heures(n), max: 50, reserve: 5, jour: { d: jour, n: n + 20 }, maxJour: 190, parJour: 200 }, plus) });
  if (sc === 'freins') { app.push(ligne(A, 45)); app.push(ligne(B, 6, { prudence: t + 5 * 3600000, maxPrudence: 20 })); }
  else { app.push(ligne(A, 12)); app.push(ligne(B, 0)); }
  app.push({ id: 'ext_appareil_bbbbbbbbbbbbbbbb', owner: U.id, updated_at: new Date(t).toISOString(), data: { v: 1, appareil: { paquet: 'orion', nav: 'orion', systeme: 'iphone' }, ver: '5.393.0', code: '5.393.0', at: new Date(t - 3 * 3600000).toISOString(), atMs: t - 3 * 3600000, flux: {}, vus: { vinted: { [B]: t - 3 * 3600000 } } } });
}
const lireEcran = (pg) => pg.evaluate(() => {
  const r = document.querySelector('[data-ecran-extension]');
  if (!r) return null;
  const comptes = [...r.querySelectorAll('[data-ext-compte]')].map((g) => ({ id: g.getAttribute('data-ext-compte'), ouverture: g.getAttribute('data-ext-ouverture'), etat: g.getAttribute('data-ext-etat'), peut: Number(g.getAttribute('data-ext-peut')),
    gestes: [...g.querySelectorAll('[data-ext-geste]')].map((x) => ({ cle: x.getAttribute('data-ext-geste'), oui: x.getAttribute('data-ext-oui') === '1', raison: x.getAttribute('data-ext-raison') || '', note: x.getAttribute('data-ext-note') || '' })),
    jauge: (g.querySelector('[data-ext-jauge]') || { getAttribute: () => null }).getAttribute('data-ext-jauge') }));
  const de = document.documentElement;
  const cibles = [...r.querySelectorAll('button, a[href]')].filter((x) => { const b = x.getBoundingClientRect(); return b.width > 0 && b.height > 0; }).map((x) => { const b = x.getBoundingClientRect(); return { h: Math.round(b.height), w: Math.round(b.width), t: (x.innerText || x.getAttribute('aria-label') || '').trim().slice(0, 30) }; });
  return { nav: r.getAttribute('data-ext-nav'), pastille: r.getAttribute('data-ext-pastille'), comptes, avert: [...r.querySelectorAll('[data-ext-avert]')].map((x) => x.getAttribute('data-ext-avert')),
    etapes: [...r.querySelectorAll('[data-ext-etape]')].map((x) => [x.getAttribute('data-ext-etape'), x.getAttribute('data-ext-fait')]), appareils: r.querySelectorAll('[data-ext-appareil]').length,
    plein: (r.querySelector('[data-ext-plein]') || { getAttribute: () => null }).getAttribute('data-ext-plein'),
    coupes: [...r.querySelectorAll('.n-rangee-titre, .n-rangee-sous-texte')].filter((x) => x.scrollWidth > x.clientWidth + 1 || x.scrollHeight > x.clientHeight + 1).map((x) => (x.innerText || '').slice(0, 40)),
    deborde: de.scrollWidth - de.clientWidth, petites: cibles.filter((c) => c.h < 44 || c.w < 44), texte: (r.innerText || '').replace(/\s+/g, ' ') };
}).catch(() => null);
const attendreEcran = async (pg, bon, ms = 30000) => { const t0 = Date.now(); let e = null; while (Date.now() - t0 < ms) { e = await lireEcran(pg); if (e && bon(e)) return e; await attendre(500); } return e; };
const TECHNIQUES = /\b(429|403|cookie|session|pont|token|jeton|requête|service worker|Lecture seule)\b/i;
const photo = async (pg, nom) => { if (!CAPT) return; try { fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, nom + '.png'), fullPage: true }); } catch (_) {} };

(async () => {
  if (!pw) { console.log('❌ Playwright introuvable'); process.exit(1); }
  if (!fs.existsSync(path.join(DIST0, 'index.html'))) { console.log(`❌ pas de build dans ${DIST0} — lance npm run build`); process.exit(1); }
  if (MUT && !MUTATIONS[MUT]) { console.log(`❌ mutation inconnue : ${MUT}`); process.exit(2); }
  const DIST = preparerDist();
  M = monde({ tls: certificat(TMP), port: PORT, dist: DIST, comptes: {}, journal: [] });
  M.USERS.set(U.email, { id: U.id, email: U.email, mdp: U.mdp });
  try { await M.ecouter(); } catch (e) { console.log(`❌ le port ${PORT} est pris (${e.code}) — BANC_PORT=…`); process.exit(1); }
  const nav = await pw.chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--no-proxy-server', '--ignore-certificate-errors', `--host-resolver-rules=${regles()}`, '--use-angle=swiftshader'] });
  console.log(`app ${DIST}${MUT ? ` · MUTATION « ${MUT} »` : ''} · extension simulée ${VERSION}`);
  try {
    // ── tout va bien, 4 rendus
    semer('ok');
    for (const [mobile, sombre] of [[true, false], [true, true], [false, false], [false, true]]) {
      const nom = `tout-va-bien-${mobile ? '390' : '1512'}-${sombre ? 'sombre' : 'clair'}`;
      console.log(`\n── ${nom}`);
      const ctx = await contexte(nav, 'ok', { mobile, sombre }); const pg = await ctx.newPage();
      await pg.goto('https://vrm.center/?tab=extension', { waitUntil: 'domcontentloaded' });
      await attendreEcran(pg, (x) => x.nav === 'ok' && x.comptes.length === 2, 40000);
      await pg.evaluate(() => { for (const b of document.querySelectorAll('[data-ext-compte] .n-groupe-repli[aria-expanded="false"]')) b.click(); }).catch(() => {});
      const e = await attendreEcran(pg, (x) => x.appareils >= 1 && x.comptes.every((c) => c.gestes.length && c.jauge && c.jauge !== 'lecture'), 20000);
      await attendre(600); await photo(pg, nom);
      const ca = e && e.comptes.find((c) => c.id === 'vinted:' + A), cb = e && e.comptes.find((c) => c.id === 'vinted:' + B);
      dit(!!e && e.nav === 'ok', 'la page est là, extension « à jour et branchée »', JSON.stringify(e && { nav: e.nav }));
      dit(!!ca && ca.ouverture === 'ici' && ca.gestes.length === 9 && ca.gestes.every((g) => g.oui) && ca.jauge === '12/50', 'boutique_a : « ouvert dans ce navigateur », 9 gestes sur 9, 12/50 cette heure', JSON.stringify(ca));
      dit(!!cb && cb.ouverture === 'autre-ici' && cb.gestes.length === 9 && cb.gestes.every((g) => !g.oui && g.raison === 'autre-ouvert'), 'atelier_b : chaque geste « non, c’est boutique_a qui est ouvert »', JSON.stringify(cb));
      dit(!!e && e.etapes.length === 0, 'tout branché : le pas-à-pas n’est plus montré', JSON.stringify(e && e.etapes));
      dit(!!e && e.appareils === 1 && !e.plein, 'l’autre navigateur est listé ; aucun bouton plein (rien à faire)', JSON.stringify(e && { app: e.appareils, plein: e.plein }));
      dit(!!e && e.deborde <= 0, 'aucun débordement horizontal', e && e.deborde);
      dit(!!e && !e.coupes.length, 'aucune phrase coupée en « … »', JSON.stringify(e && e.coupes.slice(0, 4)));
      dit(!!e && (!mobile || !e.petites.length), 'cibles au doigt ≥ 44 px', JSON.stringify(e && e.petites.slice(0, 5)));
      dit(!!e && !TECHNIQUES.test(e.texte), 'aucun mot technique dans le texte rendu', e && (e.texte.match(TECHNIQUES) || [])[0]);
      await ctx.close();
    }
    // ── aucune extension
    console.log('\n── aucune-1512-clair (au téléphone, la règle dit « depuis ton ordinateur » : pas d’installation)');
    { const ctx = await contexte(nav, 'aucune', { mobile: false, sombre: false }); const pg = await ctx.newPage();
      await pg.goto('https://vrm.center/?tab=extension', { waitUntil: 'domcontentloaded' });
      const e = await attendreEcran(pg, (x) => x.nav === 'absente' || x.nav === 'ailleurs', 40000);
      await attendre(600); await photo(pg, 'aucune-1512-clair');
      dit(!!e && (e.nav === 'absente' || e.nav === 'ailleurs') && e.plein === 'installer', 'aucune extension : la phrase et UN bouton « Installer l’extension »', JSON.stringify(e && { nav: e.nav, plein: e.plein }));
      dit(!!e && e.comptes.length === 2 && e.comptes.every((c) => c.gestes.every((g) => !g.oui)), 'aucune extension : aucun geste « oui »', JSON.stringify(e && e.comptes.map((c) => c.gestes.filter((g) => g.oui))));
      dit(!!e && e.etapes.length === 4 && e.etapes[0][1] === '0', 'aucune extension : le pas-à-pas, étape 1 « pas encore »', JSON.stringify(e && e.etapes));
      dit(!!e && e.deborde <= 0, 'aucune extension : aucun débordement', JSON.stringify(e && { d: e.deborde, p: e.petites }));
      await ctx.close(); }
    // ── freins : compte B ouvert, deux comptes dans les onglets, A à 45/50, B en prudence
    semer('freins');
    for (const [mobile, sombre] of [[true, true], [false, false]]) {
      const nom = `freins-${mobile ? '390' : '1512'}-${sombre ? 'sombre' : 'clair'}`;
      console.log(`\n── ${nom}`);
      const ctx = await contexte(nav, 'freins', { mobile, sombre }); const pg = await ctx.newPage();
      await pg.goto('https://vrm.center/?tab=extension', { waitUntil: 'domcontentloaded' });
      await attendreEcran(pg, (x) => x.nav === 'ok' && x.comptes.length === 2, 40000);
      // Un compte pas ouvert ici est replié : le déplier (son toucher), comme le vendeur.
      await pg.evaluate(() => { for (const b of document.querySelectorAll('[data-ext-compte] .n-groupe-repli[aria-expanded="false"]')) b.click(); }).catch(() => {});
      const e = await attendreEcran(pg, (x) => x.comptes.every((c) => c.gestes.length && c.jauge && c.jauge !== 'lecture'), 20000);
      await attendre(600); await photo(pg, nom);
      const ca = e && e.comptes.find((c) => c.id === 'vinted:' + A), cb = e && e.comptes.find((c) => c.id === 'vinted:' + B);
      dit(!!e && e.avert.includes('deux-comptes'), '« deux comptes ouverts dans ce navigateur » dit une fois, en tête', JSON.stringify(e && e.avert));
      dit(!!cb && cb.ouverture === 'ici' && ['baisser', 'favoris', 'offres'].every((k) => { const g = cb.gestes.find((x) => x.cle === k); return g && g.oui && g.note === 'prudence'; }), 'atelier_b (ouvert, en prudence) : « oui, au ralenti jusqu’à … »', JSON.stringify(cb && cb.gestes));
      dit(!!ca && ca.gestes.length === 9 && ca.gestes.every((g) => !g.oui && g.raison === 'autre-ouvert') && ca.jauge === '45/50', 'boutique_a (pas ouvert, 45/50) : « non, c’est atelier_b qui est ouvert », jauge 45/50', JSON.stringify(ca));
      dit(!!e && !e.coupes.length, 'freins : aucune phrase coupée en « … »', JSON.stringify(e && e.coupes.slice(0, 4)));
      dit(!!e && e.deborde <= 0 && (!mobile || !e.petites.length) && !TECHNIQUES.test(e.texte), 'freins : ni débordement, ni petite cible, ni mot technique', JSON.stringify(e && { d: e.deborde, p: e.petites.slice(0, 3) }));
      await ctx.close();
    }
    // ── la pastille de la coque mène à la page
    console.log('\n── pastille (1512)');
    semer('ok');
    { const ctx = await contexte(nav, 'ok', { mobile: false, sombre: false }); const pg = await ctx.newPage();
      await pg.goto('https://vrm.center/?tab=ventes', { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('.vrm-etat-pastille', { timeout: 60000 }).catch(() => {});
      const lib = await pg.evaluate(() => { const p = document.querySelector('.vrm-etat-pastille'); return p ? (p.innerText || '').replace(/\s+/g, ' ').trim() : null; }).catch(() => null);
      await pg.click('.vrm-etat-pastille').catch(() => {});
      const e = await attendreEcran(pg, (x) => !!x.nav, 15000);
      dit(!!e, 'toucher la pastille ouvre la page « Extension »', JSON.stringify(lib));
      dit(lib != null && !/Lecture seule|Extension à installer/.test(lib), 'la pastille dit un mot simple (jamais « Lecture seule »)', lib);
      await ctx.close(); }
  } finally { await nav.close().catch(() => {}); try { M.fermer && M.fermer(); } catch (_) {} try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {} }
  console.log(`\n${ok} verts, ${ko} rouges.`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
