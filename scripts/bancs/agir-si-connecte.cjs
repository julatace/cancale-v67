#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  BANC « AGIR SEULEMENT SI L'EXTENSION EST CONNECTÉE » (24 nov.) — la vraie app (dist/), un faux Supabase à état
//  (_e2e-monde.cjs), DEUX comptes Vinted aux MÊMES conversations (même acheteuse, même article, même offre) :
//    · boutique_a (A) — ouvert dans l'onglet de l'ordinateur allumé (`presence_*`, la forme de `publierPresence`) ;
//    · atelier_b (B)  — ouvert nulle part.
//  Ce navigateur n'a pas d'extension (comme l'iPhone) : A passe par la file « À distance » (le chemin d'extension
//  existant), B est en LECTURE SEULE. Rendu à 390 (tactile) et 1512, clair et sombre : Messages (liste, fil de A, fil de
//  B), Annonces, Ventes, Paramètres → Connexions. Jugé sur les data-* (data-agir, data-agir-badge) et sur la BASE (aucune
//  `cmd_dist_*` au nom de B ; une au nom de A après son envoi).
//    node scripts/bancs/agir-si-connecte.cjs                 (après npm run build)
//    BANC_CAPTURE=/tmp/x node scripts/bancs/agir-si-connecte.cjs
//    node scripts/bancs/agir-si-connecte.cjs --prouve        (chaque mutation du build doit rougir)
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { monde, certificat, HOTES } = require('./_e2e-monde.cjs');
const chargerPw = () => { for (const p of [__dirname, process.cwd(), path.join(__dirname, '..', '..')]) { try { return require(require.resolve('playwright', { paths: [p] })); } catch (_) {} } return null; };
const pw = chargerPw();
const RACINE = path.join(__dirname, '..', '..');
const CHROME = process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const PORT = Number(process.env.BANC_PORT) || 4893;
const DIST0 = path.resolve(process.env.BANC_DIST || path.join(RACINE, 'dist'));
const CAPT = process.env.BANC_CAPTURE || '';
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const MUT = arg('--mutation');
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, ko = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${det ? ' — ' + String(det).slice(0, 400) : ''}`); } };

// Mutations du BUILD (§6.1) : la porte affaiblie ⇒ rouge.
const MUTATIONS = {
  // la porte ne compare plus le compte de l'onglet : tout compte d'un ordinateur allumé passe
  'tout-compte': [[/\.some\(\((\w)\)=>\1&&\1\.site===(\w)&&\((\w)\|\|(\w)\(\2,\1\.id\)===(\w)\)\)/g, '.some(($1)=>$1&&$1.site===$2)']],
  // le champ « Répondre » n'est jamais éteint
  'champ-allume': [[/disabled:!(\w)\.ok,"aria-label"/g, 'disabled:!1,"aria-label"']],
};
if (process.argv.includes('--prouve')) {
  const lancer = (extra) => spawnSync(process.execPath, [__filename, ...extra], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env, timeout: 1500000, encoding: 'utf8' });
  const base = lancer([]); const vert = base.status === 0;
  console.log(`${vert ? '✅' : '❌'} passage sur le code tel quel : ${vert ? 'vert' : 'ROUGE'}`);
  if (!vert) console.log(String(base.stdout).split('\n').filter((l) => /❌/.test(l)).slice(0, 6).join('\n'));
  let rate = vert ? 0 : 1;
  for (const m of Object.keys(MUTATIONS)) {
    const r = lancer(['--mutation', m, '--court']); const rouges = String(r.stdout).split('\n').filter((l) => /❌/.test(l));
    const bon = r.status !== 0 && rouges.length > 0; if (!bon) rate++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${m} » : ${bon ? `rouge (${rouges.length} contrôle(s))` : 'RESTE VERTE'}`);
    for (const l of rouges.slice(0, 3)) console.log('     ' + l.trim());
  }
  process.exit(rate ? 1 : 0);
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-agir-'));
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
const A = '41000001', B = '41000002', APP = 'aaaaaaaaaaaaaaaa';
const CONV = { [A]: '7300001', [B]: '7300101' }, TX = { [A]: '8800001', [B]: '8800201' }, OID = { [A]: '9900001', [B]: '9900101' };
let M;

function semer() {
  const t = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const app = M.st.tables.app_data = (M.st.tables.app_data || []).filter((r) => !/^(presence_|cmd_dist_|harvest_|ext_appareil_)/.test(r.id));
  M.st.tables.vinted_accounts = [{ vinted_user_id: A, login: 'boutique_a', domain: 'www.vinted.fr', owner: U.id }, { vinted_user_id: B, login: 'atelier_b', domain: 'www.vinted.fr', owner: U.id }];
  for (const [u, dec] of [[A, 0], [B, 1]]) {
    // LES MÊMES conversations, la même acheteuse, le même article, la même offre — seule l'identité du compte change.
    const conv = CONV[u], tx = TX[u], oid = OID[u];
    app.push({ id: `harvest_${u}_inbox`, owner: U.id, updated_at: iso(t), data: { uid: u, type: 'inbox', domain: 'www.vinted.fr', nItems: 1, capturedAt: iso(t - 2 * 60000),
      payload: { conversations: [{ id: Number(conv), unread: true, updated_at: iso(t - (4 + dec) * 60000), description: 'Elle taille grand ? Je fais du 42', opposite_user: { id: 5001, login: 'acheteuse_lea' }, item_photos: [] }], pagination: {} } } });
    app.push({ id: `harvest_${u}_conv_${conv}`, owner: U.id, updated_at: iso(t), data: { uid: u, type: 'conv', capturedAt: iso(t - 2 * 60000), payload: { conversation: { id: Number(conv), allow_reply: true, opposite_user: { id: 5001, login: 'acheteuse_lea' }, transaction: { id: Number(tx), item_id: 91010001 + dec },
      messages: [
        { entity_type: 'message', created_at_ts: Math.round((t - 30 * 60000) / 1000), entity: { id: 1, body: 'Bonjour, la Nike P-6000 est toujours dispo ?', user_id: 5001 } },
        { entity_type: 'offer_request_message', created_at_ts: Math.round((t - 5 * 60000) / 1000), entity: { offer_request_id: Number(oid), transaction_id: Number(tx), status: 10, current: true, price: { amount: '70.0', currency_code: 'EUR' }, user_id: 5001, status_title: 'En attente' } },
        { entity_type: 'message', created_at_ts: Math.round((t - 4 * 60000) / 1000), entity: { id: 3, body: 'Elle taille grand ? Je fais du 42', user_id: 5001 } },
      ] } } } });
    const item = (id, title, prix) => ({ id: Number(id), title, size: '42', price: { amount: String(prix), currency_code: 'EUR' }, is_hidden: false, is_closed: false, is_draft: false, is_reserved: false, photo: { url: 'https://images1.vinted.net/t/' + id + '.jpg' } });
    app.push({ id: `harvest_${u}_listings`, owner: U.id, updated_at: iso(t), data: { uid: u, type: 'listings', nItems: 2, capturedAt: iso(t - 4 * 60000), payload: { code: 0, pagination: {}, items: [item(91010001 + dec, 'Nike P-6000 noire', 85), item(91020001 + dec, 'Adidas Samba blanche', 60)] } } });
    const order = (txx, title, status, tus, prix) => ({ transaction_id: Number(txx), title, status, transaction_user_status: tus, price: { amount: String(prix), currency_code: 'EUR' }, date: iso(t - 86400000), photo: { url: 'https://images1.vinted.net/t/o' + txx + '.jpg' }, conversation_id: Number(conv) });
    app.push({ id: `harvest_${u}_orders_sold`, owner: U.id, updated_at: iso(t), data: { uid: u, type: 'orders_sold', capturedAt: iso(t - 3 * 60000), payload: { order_details_enabled: true, pagination: {}, my_orders: [
      order(String(8800301 + dec), 'Nike Dunk Low', 'Bordereau envoyé au vendeur', 'needs_action', 95), order(String(8800401 + dec), 'Vans Old Skool', 'Commande finalisée', 'completed', 40)] } } });
  }
  // L'ordinateur allumé : A dans son onglet Vinted (la forme de `publierPresence`, background.js). B nulle part.
  app.push({ id: 'presence_' + APP, owner: U.id, updated_at: iso(t), data: { v: 1, at: iso(t), atMs: t, ver: '5.448.0', code: '5.448.0', appareil: { paquet: 'chromium', nav: 'chrome', systeme: 'mac' },
    comptes: [{ site: 'vinted', id: A, nom: 'boutique_a' }], retenues: [], enCours: '', rt: 'joint', lus: {} } });
  app.push({ id: 'ext_appareil_' + APP, owner: U.id, updated_at: iso(t), data: { v: 1, appareil: { paquet: 'zip', nav: 'chrome', systeme: 'mac' }, ver: '5.448.0', code: '5.448.0', atMs: t, at: iso(t),
    vus: { vinted: { [A]: t - 60000 } }, flux: { vinted: { okAt: t - 60000, koAt: null, refus: [], koStatut: null } }, servie: '5.448.0', depassee: false } });
}
// Tient la présence fraîche (< 3 min) pendant le banc.
function presenceFraiche() { const r = (M.st.tables.app_data || []).find((x) => x.id === 'presence_' + APP); if (r) { r.data.atMs = Date.now(); r.data.at = new Date().toISOString(); } }

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
const photo = async (pg, nom) => { if (!CAPT) return; try { fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, nom + '.png'), fullPage: false }); } catch (_) {} };
const commandes = () => (M.st.tables.app_data || []).filter((r) => /^cmd_dist_/.test(r.id)).map((r) => r.data || {});
const attendreQue = async (pg, f, arg, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { presenceFraiche(); const v = await pg.evaluate(f, arg).catch(() => null); if (v) return v; await attendre(500); } return null; };
const ORANGE = () => [...document.querySelectorAll('[data-agir], [data-agir-badge], [data-agir-composer] *')].some((x) => { for (const p of ['color', 'background-color']) { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(getComputedStyle(x)[p]); if (m && +m[1] > 180 && +m[2] > 80 && +m[2] < 170 && +m[3] < 70) return true; } return false; });

async function ouvrirConv(pg, uid) {
  await pg.evaluate((u) => { const x = document.querySelector(`[data-conv-compte="${u}"]`); if (x) (x.querySelector('button, [role="button"]') || x).click(); }, uid).catch(() => {});
  return attendreQue(pg, () => { const c = document.querySelector('[data-agir-composer="vinted"]'); return c ? { agir: c.getAttribute('data-agir'), compte: c.getAttribute('data-agir-compte') } : null; }, null, 30000);
}

(async () => {
  if (!pw) { console.log('❌ Playwright introuvable'); process.exit(1); }
  if (!fs.existsSync(path.join(DIST0, 'index.html'))) { console.log(`❌ pas de build dans ${DIST0} — lance npm run build`); process.exit(1); }
  const DIST = preparerDist();
  M = monde({ tls: certificat(TMP), port: PORT, dist: DIST, comptes: {}, journal: [] });
  M.USERS.set(U.email, { id: U.id, email: U.email, mdp: U.mdp });
  try { await M.ecouter(); } catch (e) { console.log(`❌ le port ${PORT} est pris (${e.code}) — BANC_PORT=…`); process.exit(1); }
  const nav = await pw.chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--no-proxy-server', '--ignore-certificate-errors', `--host-resolver-rules=${regles()}`, '--use-angle=swiftshader'] });
  console.log(`app ${DIST}${MUT ? ` · MUTATION « ${MUT} »` : ''}`);
  const COURT = process.argv.includes('--court');
  try {
    const formes = COURT ? [[true, false]] : [[true, false], [true, true], [false, false], [false, true]];
    for (const [mobile, sombre] of formes) {
      const nom = `${mobile ? '390' : '1512'}-${sombre ? 'sombre' : 'clair'}`;
      console.log(`\n── ${nom}`);
      semer();
      const ctx = await contexte(nav, { mobile, sombre }); const pg = await ctx.newPage();
      if (process.env.DEBUG) pg.on('pageerror', (e) => console.log('   PAGEERROR', String(e).slice(0, 300)));
      // ── Messages : la liste, le badge par compte
      await pg.goto('https://vrm.center/?tab=messages', { waitUntil: 'domcontentloaded' });
      const liste = await attendreQue(pg, ({ A, B }) => { const a = document.querySelector(`[data-conv-compte="${A}"]`), b = document.querySelector(`[data-conv-compte="${B}"]`); if (!a || !b) return null;
        const badges = [...document.querySelectorAll('[data-agir-badge]')].map((x) => x.getAttribute('data-agir-compte'));
        return badges.length ? { badges } : null; }, { A, B });
      await attendre(600); await photo(pg, `messages-liste-${nom}`);
      dit(!!liste && liste.badges.includes(B) && !liste.badges.includes(A), 'Messages : « Lecture seule » sur atelier_b, rien sur boutique_a (mêmes conversations)', JSON.stringify(liste));
      // ── Le fil de B : visible, champ éteint, raison + geste ; l'offre visible, ses gestes éteints ; un toucher n'envoie rien
      const fb = await ouvrirConv(pg, B);
      await attendre(800); await photo(pg, `messages-B-${nom}`);
      const vb = await pg.evaluate(() => { const c = document.querySelector('[data-agir-composer="vinted"]'); const ta = c && c.querySelector('textarea');
        const btn = c && c.querySelector('[data-agir-envoyer]'); const raison = c && c.querySelector('[data-n-raison]');
        const off = [...document.querySelectorAll('[data-agir-offre] [data-agir]')].map((x) => x.getAttribute('data-agir'));
        const fil = /taille grand/.test(document.body.innerText || '');
        return { ta: ta ? ta.disabled : null, btn: btn ? btn.getAttribute('aria-disabled') : null, raison: raison ? raison.innerText : '', off, fil, orange: false }; }).catch(() => null);
      dit(fb && fb.compte === B && fb.agir === 'lecture', 'fil de atelier_b : la porte dit « lecture seule »', JSON.stringify(fb));
      dit(vb && vb.fil && vb.ta === true && vb.btn === 'true' && /atelier_b/.test(vb.raison) && /Vinted/.test(vb.raison), 'fil de atelier_b : messages lisibles, champ et « Envoyer » éteints mais visibles, « … atelier_b : ouvre Vinted … »', JSON.stringify(vb));
      dit(vb && vb.off.length >= 2 && vb.off.every((x) => x === 'lecture'), 'offre de atelier_b : visible, Accepter / Refuser éteints', JSON.stringify(vb && vb.off));
      await pg.evaluate(() => { const b = document.querySelector('[data-agir-composer="vinted"] [data-agir-envoyer]'); if (b) b.click(); const r = document.querySelector('[data-agir-refuser]'); if (r) r.click(); }).catch(() => {});
      await attendre(1500);
      dit(!commandes().some((c) => c.compte === B), 'toucher « Envoyer » / « Refuser » sur atelier_b : AUCUNE commande au nom de B', JSON.stringify(commandes()));
      const orB = await pg.evaluate(ORANGE).catch(() => null);
      dit(orB === false, 'aucun orange sur les gestes éteints', orB);
      // ── Le fil de A : champ allumé ; un envoi part par la file (une commande au nom de A)
      await pg.goto('https://vrm.center/?tab=messages', { waitUntil: 'domcontentloaded' });
      await attendreQue(pg, ({ A }) => !!document.querySelector(`[data-conv-compte="${A}"]`), { A });
      const fa = await ouvrirConv(pg, A);
      await attendreQue(pg, () => { const c = document.querySelector('[data-agir-composer="vinted"]'); return c && c.getAttribute('data-agir') === 'ok'; }, null, 20000);
      await photo(pg, `messages-A-${nom}`);
      dit(fa && fa.compte === A, 'fil de boutique_a ouvert', JSON.stringify(fa));
      const okA = await pg.evaluate(() => { const c = document.querySelector('[data-agir-composer="vinted"]'); return c ? { agir: c.getAttribute('data-agir'), ta: c.querySelector('textarea').disabled, off: [...document.querySelectorAll('[data-agir-offre] [data-agir]')].map((x) => x.getAttribute('data-agir')) } : null; }).catch(() => null);
      dit(okA && okA.agir === 'ok' && okA.ta === false && okA.off.length >= 2 && okA.off.every((x) => x === 'ok'), 'fil de boutique_a : champ, Accepter et Refuser allumés (l\'ordinateur a A dans son onglet)', JSON.stringify(okA));
      if (!COURT || true) {
        await pg.fill('[data-agir-composer="vinted"] textarea', 'Elle taille normalement, prenez votre pointure.').catch(() => {});
        await pg.click('[data-agir-composer="vinted"] [data-agir-envoyer]').catch(() => {});
        const parti = await attendreQue(pg, () => { const x = document.querySelector('[data-agir-composer="vinted"] [data-agir-issue]'); return x ? x.getAttribute('data-agir-issue') : null; }, null, 15000);
        const cA = commandes().filter((c) => c.compte === A && c.geste === 'repondre');
        dit(parti === 'ok' && cA.length === 1 && cA[0].site === 'vinted' && cA[0].args && cA[0].args.conv === CONV[A] && cA[0].pour === U.id && !commandes().some((c) => c.compte === B),
          'envoi sur boutique_a : UNE commande `repondre` au nom de A (conversation de A), aucune pour B', JSON.stringify({ parti, cmds: commandes() }));
        await photo(pg, `messages-A-envoye-${nom}`);
      }
      if (!COURT) {
        // ── Annonces : le badge sur le groupe de B, pas sur A
        await pg.goto('https://vrm.center/?tab=annonces', { waitUntil: 'domcontentloaded' });
        const an = await attendreQue(pg, () => { const b = [...document.querySelectorAll('[data-agir-badge]')].map((x) => x.getAttribute('data-agir-compte')); return document.querySelector('[data-ad-repli]') ? { b, groupes: [...document.querySelectorAll('[data-ad-repli]')].map((x) => x.getAttribute('data-ad-repli')) } : null; }, null, 40000);
        await attendre(800); await photo(pg, `annonces-${nom}`);
        dit(!!an && an.b.includes(B) && !an.b.includes(A), 'Annonces : « Lecture seule » sur le groupe de atelier_b, pas sur boutique_a', JSON.stringify(an));
        // ── Ventes : la liste reste visible pour les deux comptes
        await pg.goto('https://vrm.center/?tab=ventes', { waitUntil: 'domcontentloaded' });
        const ve = await attendreQue(pg, () => (/Nike Dunk Low/.test(document.body.innerText || '') ? (document.body.innerText.match(/Nike Dunk Low/g) || []).length : null), null, 40000);
        await attendre(800); await photo(pg, `ventes-${nom}`);
        dit(ve >= 2, 'Ventes : les ventes des DEUX comptes restent visibles (lecture seule ≠ caché)', ve);
        // ── Paramètres → Connexions : le badge par compte
        await pg.goto('https://vrm.center/?tab=connexions', { waitUntil: 'domcontentloaded' });
        const cx = await attendreQue(pg, () => { const r = document.querySelector('[data-ecran-connexions]'); if (!r || !r.querySelector('[data-cnx-compte]')) return null; return [...r.querySelectorAll('[data-agir-badge]')].map((x) => x.getAttribute('data-agir-compte')); }, null, 40000);
        await attendre(800); await photo(pg, `parametres-connexions-${nom}`);
        dit(Array.isArray(cx) && cx.includes(B) && !cx.includes(A), 'Paramètres → Connexions : « Lecture seule » sur atelier_b seulement', JSON.stringify(cx));
        const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth).catch(() => null);
        dit(deb != null && deb <= 0, 'aucun débordement horizontal', deb);
      }
      await ctx.close();
    }
  } finally { await nav.close().catch(() => {}); try { M.fermer && M.fermer(); } catch (_) {} try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {} }
  console.log(`\n${ok} verts, ${ko} rouges.`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
