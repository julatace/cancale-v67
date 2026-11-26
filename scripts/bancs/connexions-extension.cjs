#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  BANC « CONNEXIONS DE L'EXTENSION » (24 nov.) — Paramètres → Connexions de l'extension, RENDUE dans la vraie app
//  Le vrai `dist/` servi par le monde du banc (_e2e-monde.cjs : faux Supabase à état), une session posée, des lignes
//  INVENTÉES à la forme de la vraie base (mesurée le 24 nov.) : 3 navigateurs (un à jour, un ancien 5.418, un pas vu
//  depuis 2 j), une ligne aux champs manquants, une vieille installation (9 j) ; 4 comptes Vinted (un pas relu depuis 24 h).
//  Rendu à 390 (tactile) et 1512, clair et sombre ; puis Aujourd'hui (la ligne) et Paramètres (l'entrée).
//  Jugé sur les data-* (chaque navigateur une fois, l'ancien nommé avec la version à installer, « pas su » jamais 0 ni ok).
//    node scripts/bancs/connexions-extension.cjs            (après npm run build)
//    BANC_CAPTURE=/tmp/x node scripts/bancs/connexions-extension.cjs
//    node scripts/bancs/connexions-extension.cjs --prouve   (chaque mutation du build doit rougir)
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { monde, certificat, HOTES } = require('./_e2e-monde.cjs');
const chargerPw = () => { for (const p of [__dirname, process.cwd(), path.join(__dirname, '..', '..')]) { try { return require(require.resolve('playwright', { paths: [p] })); } catch (_) {} } return null; };
const pw = chargerPw();
const RACINE = path.join(__dirname, '..', '..');
const CHROME = process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const PORT = Number(process.env.BANC_PORT) || 4871;
const DIST0 = path.resolve(process.env.BANC_DIST || path.join(RACINE, 'dist'));
const CAPT = process.env.BANC_CAPTURE || '';
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const MUT = arg('--mutation');
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, ko = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${det ? ' — ' + String(det).slice(0, 400) : ''}`); } };

// Mutations du BUILD (§6.1).
const MUTATIONS = {
  // l'ancienne version passe pour « à jour »
  'version-ok': [[/etat:"ancienne",ver:(\w),installer:(\w)\}/g, 'etat:"a-jour",ver:$1,installer:$2}']],
  // la santé absente (avant 5.448) se dit « ok »
  'sante-ok': [[/if\(!(\w)\)return (\w)&&(\w+)\((\w),(\w)\)<0\?void 0:null;/g, 'if(!$1)return[];']],
};
if (process.argv.includes('--prouve')) {
  const lancer = (extra) => spawnSync(process.execPath, [__filename, ...extra], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env, timeout: 900000, encoding: 'utf8' });
  const base = lancer([]); const vert = base.status === 0;
  console.log(`${vert ? '✅' : '❌'} passage sur le code tel quel : ${vert ? 'vert' : 'ROUGE'}`);
  if (!vert) console.log(String(base.stdout).split('\n').filter((l) => /❌/.test(l)).slice(0, 5).join('\n'));
  let rate = vert ? 0 : 1;
  for (const m of Object.keys(MUTATIONS)) {
    const r = lancer(['--mutation', m]); const rouges = String(r.stdout).split('\n').filter((l) => /❌/.test(l));
    const bon = r.status !== 0 && rouges.length > 0; if (!bon) rate++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${m} » : ${bon ? `rouge (${rouges.length} contrôle(s))` : 'RESTE VERTE'}`);
    for (const l of rouges.slice(0, 3)) console.log('     ' + l.trim());
  }
  process.exit(rate ? 1 : 0);
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-cnx-'));
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
const A = '41000001', B = '41000002', C = '41000003', D = '41000004';
const ATTENDUE = JSON.parse(fs.readFileSync(path.join(RACINE, 'public', 'extension-version.json'), 'utf8')).version;

async function contexte(nav, { mobile, sombre }) {
  const ctx = await nav.newContext(Object.assign({ viewport: mobile ? { width: 390, height: 844 } : { width: 1512, height: 950 }, timezoneId: 'Europe/Paris', locale: 'fr-FR', ignoreHTTPSErrors: true, serviceWorkers: 'block' },
    mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const s = M.ouvrir(M.USERS.get(U.email));
  await ctx.addInitScript(({ s, uid, sombre }) => {
    if (location.origin !== 'https://vrm.center') return;
    try { localStorage.setItem('schema_cloisonne', '1'); localStorage.setItem('vrm_ext_separee_' + uid, '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1');
      localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_apparence', JSON.stringify(sombre ? 'sombre' : 'clair'));
      if (!localStorage.getItem('__banc_pose')) { localStorage.setItem('__banc_pose', '1'); localStorage.setItem('vrm_session', JSON.stringify(s)); } } catch (_) {}
  }, { s: { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Date.now() + 3600e3, user: s.user }, uid: U.id, sombre });
  return ctx;
}
let M;
function semer() {
  const t = Date.now(), H = 3600000, J = 24 * H;
  const app = M.st.tables.app_data = M.st.tables.app_data.filter((r) => !/^(actions_compte_|ext_appareil_|harvest_)/.test(r.id));
  M.st.tables.vinted_accounts = [A, B, C, D].map((u, i) => ({ vinted_user_id: u, login: ['boutique_a', 'atelier_b', 'shop_c', 'vieux_d'][i], domain: 'www.vinted.fr', owner: U.id }));
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
  app.push({ id: `actions_compte_${A}_0123456789abcdef`, owner: U.id, updated_at: new Date(t).toISOString(), data: { v: 2, uid: A, nav: '0123456789abcdef', at: new Date(t).toISOString(), ts: Array.from({ length: 12 }, (_, i) => t - (50 - i) * 60000), max: 50, reserve: 5, jour: { d: jour, n: 30 }, maxJour: 190, parJour: 200 } });
  const ligne = (id, data) => app.push({ id: 'ext_appareil_' + id, owner: U.id, updated_at: new Date(t).toISOString(), data });
  // à jour (5.448 : sante, servie, depassee)
  ligne('aaaaaaaaaaaaaaaa', { v: 1, appareil: { paquet: 'zip', nav: 'chrome', systeme: 'mac' }, ver: ATTENDUE, code: ATTENDUE, at: new Date(t - 3 * 60000).toISOString(), atMs: t - 3 * 60000,
    vus: { vinted: { [A]: t - 3 * 60000, [B]: t - 40 * 60000 } }, flux: { vinted: { okAt: t - 3 * 60000, koAt: null, refus: [], koStatut: null }, leboncoin: { okAt: t - 2 * H, koAt: null, refus: [], koStatut: null } },
    servie: ATTENDUE, depassee: false, sante: { vinted: { k: 'ok', nom: '' }, lbc: { k: 'ok', nom: '' } } });
  // ancienne 5.418 vue il y a 5 h
  ligne('bbbbbbbbbbbbbbbb', { v: 1, appareil: { paquet: 'zip', nav: 'chrome', systeme: 'mac' }, ver: '5.418.0', code: '5.418.0', at: new Date(t - 5 * H).toISOString(), atMs: t - 5 * H,
    vus: { vinted: { [C]: t - 5 * H } }, flux: { vinted: { okAt: t - 5 * H, koAt: null, refus: [], koStatut: null } }, diag: { auj: { n: { suivi_vu_escrow: 3 }, jour } } });
  // pas vu depuis 2 j (Orion)
  ligne('cccccccccccccccc', { v: 1, appareil: { paquet: 'orion', nav: 'orion', systeme: 'mac' }, ver: ATTENDUE, code: ATTENDUE, at: new Date(t - 2 * J).toISOString(), atMs: t - 2 * J,
    vus: { vinted: { [D]: t - 2 * J } }, flux: { vinted: { okAt: t - 2 * J - H, koAt: t - 2 * J, refus: [{ at: t - 2 * J, statut: 'reseau', famille: 'harvest_inbox', octets: 1660 }], koStatut: null } } });
  // champs manquants
  ligne('dddddddddddddddd', { v: 1, atMs: t - 30 * 60000 });
  // vieille installation (9 j)
  ligne('eeeeeeeeeeeeeeee', { v: 1, appareil: { nav: 'chrome', systeme: 'mac' }, ver: '5.329.0', code: '5.329.0', atMs: t - 9 * J, vus: { vinted: {} }, flux: {} });
  // fraîcheur `harvest_*` (capturedAt) : A relu à l'instant
  app.push({ id: `harvest_${A}_listings`, owner: U.id, updated_at: new Date(t).toISOString(), meta: { capturedAt: new Date(t - 60000).toISOString() }, data: { capturedAt: new Date(t - 60000).toISOString(), payload: { items: [] } } });
}
const lireEcran = (pg) => pg.evaluate(() => {
  const r = document.querySelector('[data-ecran-connexions]');
  if (!r) return null;
  const navs = [...r.querySelectorAll('[data-cnx-navigateur]')].map((x) => ({ id: x.getAttribute('data-cnx-navigateur'), vu: x.getAttribute('data-cnx-vu'), version: x.getAttribute('data-cnx-version'), ver: x.getAttribute('data-cnx-ver'),
    installer: x.getAttribute('data-cnx-installer'), sante: x.getAttribute('data-cnx-sante'), probleme: x.getAttribute('data-cnx-probleme-code'), texte: (x.innerText || '').replace(/\s+/g, ' '),
    geste: (x.querySelector('[data-cnx-geste]') || { getAttribute: () => '' }).getAttribute('data-cnx-geste') }));
  const comptes = [...r.querySelectorAll('[data-cnx-compte]')].map((x) => ({ id: x.getAttribute('data-cnx-compte'), relu: x.getAttribute('data-cnx-relu'), par: x.getAttribute('data-cnx-par'), jauge: x.getAttribute('data-cnx-jauge'), texte: (x.innerText || '').replace(/\s+/g, ' ') }));
  const de = document.documentElement;
  const cibles = [...r.querySelectorAll('button, a[href], summary')].filter((x) => { const b = x.getBoundingClientRect(); return b.width > 0 && b.height > 0; }).map((x) => { const b = x.getBoundingClientRect(); return { h: Math.round(b.height), w: Math.round(b.width), t: (x.innerText || x.getAttribute('aria-label') || '').trim().slice(0, 30) }; });
  return { etat: r.getAttribute('data-cnx-etat'), alerte: r.getAttribute('data-cnx-alerte'), navs, comptes, anciens: Number((r.querySelector('[data-cnx-anciens]') || { getAttribute: () => 0 }).getAttribute('data-cnx-anciens')),
    deborde: de.scrollWidth - de.clientWidth, petites: cibles.filter((c) => c.h < 44), texte: (r.innerText || '').replace(/\s+/g, ' ') };
}).catch(() => null);
const attendreEcran = async (pg, bon, ms = 40000) => { const t0 = Date.now(); let e = null; while (Date.now() - t0 < ms) { e = await lireEcran(pg); if (e && bon(e)) return e; await attendre(500); } return e; };
const photo = async (pg, nom) => { if (!CAPT) return; try { fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, nom + '.png'), fullPage: true }); } catch (_) {} };
const TECHNIQUES = /\b(select=|ext_appareil|actions_compte|harvest_|undefined|null|NaN|\[object)\b/;

(async () => {
  if (!pw) { console.log('❌ Playwright introuvable'); process.exit(1); }
  if (!fs.existsSync(path.join(DIST0, 'index.html'))) { console.log(`❌ pas de build dans ${DIST0} — lance npm run build`); process.exit(1); }
  if (MUT && !MUTATIONS[MUT]) { console.log(`❌ mutation inconnue : ${MUT}`); process.exit(2); }
  const DIST = preparerDist();
  M = monde({ tls: certificat(TMP), port: PORT, dist: DIST, comptes: {}, journal: [] });
  M.USERS.set(U.email, { id: U.id, email: U.email, mdp: U.mdp });
  try { await M.ecouter(); } catch (e) { console.log(`❌ le port ${PORT} est pris (${e.code}) — BANC_PORT=…`); process.exit(1); }
  const nav = await pw.chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--no-proxy-server', '--ignore-certificate-errors', `--host-resolver-rules=${regles()}`, '--use-angle=swiftshader'] });
  console.log(`app ${DIST}${MUT ? ` · MUTATION « ${MUT} »` : ''} · version servie ${ATTENDUE}`);
  try {
    semer();
    for (const [mobile, sombre] of [[true, false], [true, true], [false, false], [false, true]]) {
      const nom = `connexions-${mobile ? '390' : '1512'}-${sombre ? 'sombre' : 'clair'}`;
      console.log(`\n── ${nom}`);
      const ctx = await contexte(nav, { mobile, sombre }); const pg = await ctx.newPage();
      await pg.goto('https://vrm.center/?tab=connexions', { waitUntil: 'domcontentloaded' });
      const e = await attendreEcran(pg, (x) => x.etat !== 'lecture' && x.comptes.length === 4 && x.comptes.every((c) => c.jauge !== 'lecture'));
      await attendre(800); await photo(pg, nom);
      if (!e) { dit(false, 'la page « Connexions » est là', 'rien rendu'); await ctx.close(); continue; }
      const ids = e.navs.map((n) => n.id);
      const g = (id) => e.navs.find((n) => n.id === id.repeat(16)) || {};
      dit(e.etat === '4' && ids.length === 4 && new Set(ids).size === 4, 'chaque navigateur listé une fois (4 vivants)', JSON.stringify(ids));
      dit(e.anciens === 1 && !ids.includes('e'.repeat(16)), 'la vieille installation (9 j) est rangée à part', e.anciens);
      dit(g('a').version === 'a-jour' && g('a').sante === 'ok' && !g('a').probleme, 'Chrome à jour : « À jour », santé ok, aucun problème inventé', JSON.stringify(g('a')));
      dit(g('b').version === 'ancienne' && g('b').ver === '5.418.0' && g('b').installer === ATTENDUE && g('b').geste === 'mettre-a-jour' && g('b').texte.includes(ATTENDUE), `l’ancienne nommée : 5.418 → ${ATTENDUE}, bouton « Mettre à jour »`, JSON.stringify(g('b')));
      dit(g('b').sante === 'trop-ancienne', 'avant 5.448 : santé « trop ancienne pour le dire », jamais ok', g('b').sante);
      dit(g('c').vu === 'absent' && /Pas vu depuis/.test(g('c').texte) && g('c').probleme === 'envoi-reseau', 'Orion : « Pas vu depuis 2 j », envoi raté dit', JSON.stringify(g('c')));
      dit(g('d').version === 'passu' && g('d').sante !== 'ok' && !/À jour/.test(g('d').texte) && !/\b0\b/.test(g('d').texte.replace(/\d+ min/, '')), 'champs manquants : « — », jamais « À jour » ni ok ni 0', JSON.stringify(g('d')));
      const cp = (u) => e.comptes.find((c) => c.id === 'vinted:' + u) || {};
      dit(cp(A).relu === 'frais' && cp(A).jauge === '12/50' && cp(A).par === 'a'.repeat(16), 'boutique_a : relu, par ce Chrome, 12/50', JSON.stringify(cp(A)));
      dit(cp(D).relu === 'vieux' && /Pas relu depuis 24 h/.test(cp(D).texte) && /Ouvrir Vinted/.test(cp(D).texte), 'vieux_d : « Pas relu depuis 24 h » + « Ouvrir Vinted »', JSON.stringify(cp(D)));
      dit(cp(B).jauge === 'pas-su' && !/\b0\/50\b/.test(cp(B).texte), 'jauge pas sue : « — », jamais 0/50', JSON.stringify(cp(B)));
      dit(e.alerte === 'version', 'la page sait la ligne d’Aujourd’hui (extension ancienne vue aujourd’hui)', e.alerte);
      dit(e.deborde <= 0, 'aucun débordement horizontal', e.deborde);
      dit(!mobile || !e.petites.length, 'cibles au doigt ≥ 44 px', JSON.stringify(e.petites.slice(0, 4)));
      dit(!TECHNIQUES.test(e.texte), 'aucun mot technique dans le texte rendu', (e.texte.match(TECHNIQUES) || [])[0]);
      const longs = await pg.evaluate(() => { const out = []; for (const el of document.querySelectorAll('[data-ecran-connexions] *')) { if (el.closest('details:not([open])')) continue; const t = [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join(' ').replace(/\s+/g, ' ').trim(); if (!t) continue; const n = t.split(' ').filter((w) => /[\p{L}\p{N}]/u.test(w)).length; const r = el.getBoundingClientRect(); if (n > 8 && r.width > 1) out.push(t.slice(0, 60)); } return out; }).catch(() => null);
      dit(Array.isArray(longs) && !longs.length, 'aucun texte visible de plus de 8 mots (le détail sous « Pourquoi ? »)', JSON.stringify(longs));
      // Couleurs : aucun ambre/orange dans la page.
      const ambre = await pg.evaluate(() => [...document.querySelectorAll('[data-ecran-connexions] *')].some((x) => { const c = getComputedStyle(x).color; const m = /rgb\((\d+), (\d+), (\d+)/.exec(c); return m && +m[1] > 180 && +m[2] > 90 && +m[2] < 170 && +m[3] < 60; })).catch(() => null);
      dit(ambre === false, 'aucun texte orange/ambre', ambre);
      await ctx.close();
    }
    // Aujourd'hui : la ligne, et elle mène à la page.
    for (const mobile of [true, false]) {
      console.log(`\n── aujourdhui-${mobile ? '390' : '1512'}`);
      const ctx = await contexte(nav, { mobile, sombre: false }); const pg = await ctx.newPage();
      await pg.goto('https://vrm.center/?tab=journee', { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-cnx-journee]', { timeout: 60000 }).catch(() => {});
      const l = await pg.evaluate(() => { const x = document.querySelector('[data-cnx-journee]'); return x ? { code: x.getAttribute('data-cnx-journee'), texte: (x.innerText || '').replace(/\s+/g, ' ') } : null; }).catch(() => null);
      await photo(pg, `aujourdhui-${mobile ? '390' : '1512'}`);
      dit(!!l && l.code === 'version' && l.texte.includes('5.418') && l.texte.includes(ATTENDUE), 'Aujourd’hui : « Extension ancienne 5.418 : installe la … »', JSON.stringify(l));
      await pg.click('[data-cnx-journee] [data-n-action="voir"]').catch(() => {});
      const e = await attendreEcran(pg, (x) => x.etat !== 'lecture', 20000);
      dit(!!e, '« Voir » ouvre la page Connexions');
      await ctx.close();
    }
    // Paramètres : l'entrée.
    { console.log('\n── parametres-1512');
      const ctx = await contexte(nav, { mobile: false, sombre: false }); const pg = await ctx.newPage();
      await pg.goto('https://vrm.center/?tab=settings', { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-reglage-connexions-ext]', { timeout: 60000 }).catch(() => {});
      await pg.click('[data-reglage-connexions-ext]').catch(() => {});
      const e = await attendreEcran(pg, (x) => x.etat !== 'lecture', 30000);
      dit(!!e, 'Paramètres → « Connexions de l’extension » ouvre la page');
      await ctx.close(); }
    // Tout va bien : aucune ligne sur Aujourd'hui.
    { console.log('\n── aujourdhui-rien');
      const app = M.st.tables.app_data;
      M.st.tables.app_data = app.filter((r) => !/^ext_appareil_(b|c|d|e)/.test(r.id));
      M.st.tables.vinted_accounts = M.st.tables.vinted_accounts.filter((a) => a.vinted_user_id === A);
      const ctx = await contexte(nav, { mobile: true, sombre: false }); const pg = await ctx.newPage();
      await pg.goto('https://vrm.center/?tab=journee', { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-tab-actif="journee"], main', { timeout: 60000 }).catch(() => {});
      await attendre(8000);
      const l = await pg.evaluate(() => !!document.querySelector('[data-cnx-journee]')).catch(() => null);
      dit(l === false, 'tout va bien : aucune ligne sur Aujourd’hui', l);
      await ctx.close(); }
  } finally { await nav.close().catch(() => {}); try { M.fermer && M.fermer(); } catch (_) {} try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {} }
  console.log(`\n${ok} verts, ${ko} rouges.`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
