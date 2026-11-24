#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA CONVERSATION REFAITE » (24 nov., lot messages-pro) — la vraie app (dist/), un faux Supabase à état
//  (_e2e-monde.cjs), le monde du banc agir-si-connecte : DEUX comptes Vinted, la même acheteuse, la même offre de 70 € sur
//  une paire affichée 85 € :
//    · boutique_a (A) — ouvert dans l'onglet de l'ordinateur allumé ⇒ on peut agir ; prix d'achat SAISI (40 € + 6 € de
//      frais confirmés ⇒ plancher 46 € ⇒ « +24 € de marge ») ;
//    · atelier_b (B)  — ouvert nulle part ⇒ LECTURE SEULE ; prix d'achat pas saisi (l'état exact de la capture de Julien).
//  Scénarios × 390 (tactile) et 1512, clair et sombre : A + offre · B + offre · A sans offre, fil long.
//  Jugé sur les data-* et la BASE (aucune `cmd_dist_*` au nom de B ; Accepter ne part qu'après SA confirmation) :
//    la raison de la lecture seule UNE fois · Accepter demande · rien ne part en lecture seule · aucun orange calculé ·
//    cibles ≥ 44 px · aucun débordement · la puce de marge seulement quand le prix d'achat est connu · le fil reste visible.
//    node scripts/bancs/messages-pro.cjs                 (après npm run build ; BANC_DIST=… pour un autre build)
//    BANC_CAPTURE=/tmp/x node scripts/bancs/messages-pro.cjs
//    node scripts/bancs/messages-pro.cjs --prouve        (chaque mutation du build doit rougir)
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { monde, certificat, HOTES } = require('./_e2e-monde.cjs');
const chargerPw = () => { for (const p of [__dirname, process.cwd(), path.join(__dirname, '..', '..')]) { try { return require(require.resolve('playwright', { paths: [p] })); } catch (_) {} } return null; };
const pw = chargerPw();
const RACINE = path.join(__dirname, '..', '..');
const CHROME = process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const PORT = Number(process.env.BANC_PORT) || 4894;
const DIST0 = path.resolve(process.env.BANC_DIST || path.join(RACINE, 'dist'));
const CAPT = process.env.BANC_CAPTURE || '';
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const MUT = arg('--mutation');
const COURT = process.argv.includes('--court');
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, ko = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${det ? ' — ' + String(det).slice(0, 500) : ''}`); } };

// Mutations du BUILD (§6.1) : chaque règle affaiblie ⇒ rouge. [motif, remplacement, fichiers ('js' | 'css')]
const MUTATIONS = {
  // le bouton éteint redit la raison dessous (trois fois à l'écran, comme avant)
  'raison-repetee': [[/raison:(\w+)\.ok\|\|(\w+)\?"":/g, 'raison:$1.ok?"":', 'js']],
  // le champ reste un champ en lecture seule (la grande boîte grise d'avant)
  'champ-en-lecture': [[/return (\w+)\.ok\?(\w+)\.jsxs\("div",\{className:"vrm-agir-composer vrm-mp-compose",/g, 'return !0?$2.jsxs("div",{className:"vrm-agir-composer vrm-mp-compose",', 'js']],
  // une marge inventée sans prix d'achat (le prix d'achat « pas saisi » lu comme 0)
  'marge-sans-achat': [[/etat:(\w+)\.buyPrice!=null&&String\(\1\.buyPrice\)\.trim\(\)!==""\?"illisible":"achat",plancher:null/g, 'etat:"ok",plancher:1', 'js']],
  // Accepter part sans demander
  'accepter-direct': [[/onClick:\(\)=>(\w+)\(!0\),attrs:\{"data-agir-accepter"/g, 'onClick:()=>{},attrs:{"data-agir-accepter"', 'js']],
  // de l'orange revient sur la carte
  'orange': [[/\.vrm-mp-offre\{/g, '.vrm-mp-offre{border:2px solid #d9a441;', 'css']],
  // des puces trop petites pour le doigt
  'petites-cibles': [[/(\.vrm-mp-rr\{[^}]*?)min-height:44px/g, '$1min-height:30px', 'css']],
  // la carte déborde de l'écran
  'debordement': [[/\.vrm-mp-offre-fil\{([^}]*?)width:min\(100%,352px\)/g, '.vrm-mp-offre-fil{$1width:520px;flex:none', 'css']],
};
if (process.argv.includes('--prouve')) {
  const lancer = (extra) => spawnSync(process.execPath, [__filename, ...extra], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env, timeout: 1500000, encoding: 'utf8' });
  const base = lancer(['--court']); const vert = base.status === 0;
  console.log(`${vert ? '✅' : '❌'} passage sur le code tel quel : ${vert ? 'vert' : 'ROUGE'}`);
  if (!vert) console.log(String(base.stdout).split('\n').filter((l) => /❌/.test(l)).slice(0, 8).join('\n'));
  let rate = vert ? 0 : 1;
  for (const m of Object.keys(MUTATIONS)) {
    const r = lancer(['--mutation', m, '--court']); const rouges = String(r.stdout).split('\n').filter((l) => /❌/.test(l));
    const bon = r.status !== 0 && rouges.length > 0; if (!bon) rate++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${m} » : ${bon ? `rouge (${rouges.length} contrôle(s))` : 'RESTE VERTE'}`);
    for (const l of rouges.slice(0, 3)) console.log('     ' + l.trim());
  }
  process.exit(rate ? 1 : 0);
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-mpro-'));
function preparerDist() {
  const m = MUT && MUTATIONS[MUT];
  if (MUT && !m) { console.log(`❌ mutation inconnue ${MUT}`); process.exit(2); }
  if (!m) return DIST0;
  const d = path.join(TMP, 'dist'); fs.cpSync(DIST0, d, { recursive: true }); let touche = 0;
  const marcher = (dir) => { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) marcher(p); else { const ext = (/\.(js|css)$/.exec(f) || [])[1]; if (!ext) continue;
    const s = fs.readFileSync(p, 'utf8'); let t = s; for (const [a, b, sorte] of m) if (sorte === ext) t = t.replace(a, b); if (t !== s) { fs.writeFileSync(p, t); touche++; } } } };
  marcher(d);
  if (!touche) { console.log(`❌ mutation ${MUT} : rien trouvé à muter dans dist/`); process.exit(2); }
  return d;
}
const regles = () => HOTES.map((h) => `MAP ${h} 127.0.0.1:${PORT}`).concat(['MAP * ~NOTFOUND']).join(', ');
const U = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'vendeur@exemple.test', mdp: 'bon-mot-de-passe' };
const A = '41000001', B = '41000002', APP = 'aaaaaaaaaaaaaaaa';
const CONV = { [A]: '7300001', [B]: '7300101' }, TX = { [A]: '8800001', [B]: '8800201' }, OID = { [A]: '9900001', [B]: '9900101' };
const ITEM = { [A]: 91010001, [B]: 91010002 };
// La fiche par IDENTITÉ (item_id) : A a son prix d'achat et ses frais confirmés ; B n'a rien (comme la capture de Julien).
const NUMEROS = { [String(ITEM[A])]: { numero: '124', buyPrice: '40', fees: '6', fraisComplets: true }, [String(ITEM[B])]: { numero: '57' } };
let M;

function semer(scenario) {
  const t = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const app = M.st.tables.app_data = (M.st.tables.app_data || []).filter((r) => !/^(presence_|cmd_dist_|harvest_|ext_appareil_)/.test(r.id));
  M.st.tables.vinted_accounts = [{ vinted_user_id: A, login: 'boutique_a', domain: 'www.vinted.fr', owner: U.id }, { vinted_user_id: B, login: 'atelier_b', domain: 'www.vinted.fr', owner: U.id }];
  for (const [u, dec] of [[A, 0], [B, 1]]) {
    const conv = CONV[u], tx = TX[u], oid = OID[u];
    const long = scenario === 'long' && u === A;
    const ts = (min) => Math.round((t - min * 60000) / 1000);
    const messages = long
      ? Array.from({ length: 30 }, (_, k) => ({ entity_type: 'message', created_at_ts: ts(600 - k * 18), entity: { id: 100 + k, user_id: k % 3 === 2 ? Number(u) : 5001,
        body: k % 3 === 2 ? `Oui, la paire est en très bon état (message ${k + 1}).` : (k % 2 ? `Est-ce que la semelle est propre ? (message ${k + 1})` : `Bonjour, je peux passer la chercher ? Je suis à Lyon (message ${k + 1}).`) } }))
      : [
        { entity_type: 'message', created_at_ts: ts(30), entity: { id: 1, body: 'Bonjour, la Nike P-6000 est toujours dispo ?', user_id: 5001 } },
        { entity_type: 'message', created_at_ts: ts(26), entity: { id: 2, body: 'Bonjour ! Oui, toujours disponible.', user_id: Number(u) } },
        { entity_type: 'offer_request_message', created_at_ts: ts(5), entity: { offer_request_id: Number(oid), transaction_id: Number(tx), status: 10, current: true, price: { amount: '70.0', currency_code: 'EUR' }, user_id: 5001, status_title: 'En attente' } },
        { entity_type: 'message', created_at_ts: ts(4), entity: { id: 3, body: 'Elle taille grand ? Je fais du 42', user_id: 5001 } },
      ];
    app.push({ id: `harvest_${u}_inbox`, owner: U.id, updated_at: iso(t), data: { uid: u, type: 'inbox', domain: 'www.vinted.fr', nItems: 1, capturedAt: iso(t - 2 * 60000),
      payload: { conversations: [{ id: Number(conv), unread: true, updated_at: iso(t - (4 + dec) * 60000), description: long ? 'Bonjour, je peux passer la chercher ?' : 'Elle taille grand ? Je fais du 42', opposite_user: { id: 5001, login: 'acheteuse_lea' }, item_photos: [] }], pagination: {} } } });
    app.push({ id: `harvest_${u}_conv_${conv}`, owner: U.id, updated_at: iso(t), data: { uid: u, type: 'conv', capturedAt: iso(t - 2 * 60000), payload: { conversation: { id: Number(conv), allow_reply: true, opposite_user: { id: 5001, login: 'acheteuse_lea' },
      transaction: { id: Number(tx), item_id: ITEM[u] }, messages } } } });
    const item = (id, title, prix) => ({ id: Number(id), title, size: '42', price: { amount: String(prix), currency_code: 'EUR' }, is_hidden: false, is_closed: false, is_draft: false, is_reserved: false, photo: { url: 'https://images1.vinted.net/t/' + id + '.jpg' } });
    app.push({ id: `harvest_${u}_listings`, owner: U.id, updated_at: iso(t), data: { uid: u, type: 'listings', nItems: 2, capturedAt: iso(t - 4 * 60000), payload: { code: 0, pagination: {}, items: [item(ITEM[u], 'Nike P-6000 noire', 85), item(91020001 + dec, 'Adidas Samba blanche', 60)] } } });
  }
  app.push({ id: 'presence_' + APP, owner: U.id, updated_at: iso(t), data: { v: 1, at: iso(t), atMs: t, ver: '5.448.0', code: '5.448.0', appareil: { paquet: 'chromium', nav: 'chrome', systeme: 'mac' },
    comptes: [{ site: 'vinted', id: A, nom: 'boutique_a' }], retenues: [], enCours: '', rt: 'joint', lus: {} } });
  app.push({ id: 'ext_appareil_' + APP, owner: U.id, updated_at: iso(t), data: { v: 1, appareil: { paquet: 'zip', nav: 'chrome', systeme: 'mac' }, ver: '5.448.0', code: '5.448.0', atMs: t, at: iso(t),
    vus: { vinted: { [A]: t - 60000 } }, flux: { vinted: { okAt: t - 60000, koAt: null, refus: [], koStatut: null } }, servie: '5.448.0', depassee: false } });
}
function presenceFraiche() { const r = (M.st.tables.app_data || []).find((x) => x.id === 'presence_' + APP); if (r) { r.data.atMs = Date.now(); r.data.at = new Date().toISOString(); } }

async function contexte(nav, { mobile, sombre }) {
  const ctx = await nav.newContext(Object.assign({ viewport: mobile ? { width: 390, height: 844 } : { width: 1512, height: 950 }, timezoneId: 'Europe/Paris', locale: 'fr-FR', ignoreHTTPSErrors: true, serviceWorkers: 'block' },
    mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const s = M.ouvrir(M.USERS.get(U.email));
  await ctx.addInitScript(({ s, uid, sombre, numeros }) => {
    if (location.origin !== 'https://vrm.center') return;
    try { localStorage.setItem('schema_cloisonne', '1'); localStorage.setItem('vrm_ext_separee_' + uid, '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1');
      localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_apparence', JSON.stringify(sombre ? 'sombre' : 'clair'));
      if (!localStorage.getItem('__banc_pose')) { localStorage.setItem('__banc_pose', '1'); localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(numeros)); } } catch (_) {}
  }, { s: { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Date.now() + 3600e3, user: s.user }, uid: U.id, sombre, numeros: NUMEROS });
  return ctx;
}
const photo = async (pg, nom) => { if (!CAPT) return; try { fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, nom + '.png'), fullPage: false }); } catch (_) {} };
const commandes = () => (M.st.tables.app_data || []).filter((r) => /^cmd_dist_/.test(r.id)).map((r) => r.data || {});
const attendreQue = async (pg, f, arg, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { presenceFraiche(); const v = await pg.evaluate(f, arg).catch(() => null); if (v) return v; await attendre(500); } return null; };

async function ouvrirConv(pg, uid, attendu) {
  const t0 = Date.now();
  while (Date.now() - t0 < 45000) {
    presenceFraiche();
    const v = await pg.evaluate(({ u, attendu }) => { const c = document.querySelector('[data-agir-composer="vinted"]'); if (c && c.getAttribute('data-agir-compte') === u && (!attendu || c.getAttribute('data-agir') === attendu)) return { agir: c.getAttribute('data-agir'), compte: u };
      if (c && c.getAttribute('data-agir-compte') === u) return null;
      const x = document.querySelector(`[data-msg-groupe="vinted:${u}"] button[data-fil]`); if (x) x.click(); return null; }, { u: uid, attendu }).catch(() => null);
    if (v) return v;
    await attendre(1200);
  }
  return null;
}

// ── Les mesures, dans la page ─────────────────────────────────────────────────────────────────────────────────────────
function mesurer() {
  const P = document.querySelector('.vrm-chat-panel');
  if (!P) return null;
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  // ORANGE : toute couleur calculée (texte, fond, bord, ombre) de teinte 15–50° bien saturée, dans le panneau.
  const rgbs = (v) => [...String(v || '').matchAll(/rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)(?:,\s*([\d.]+))?\)/g)].map((m) => [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]]);
  const orange = ([r, g, b, a]) => { if (a < 0.15) return false; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx - mn < 60 || mx < 120) return false; let h; const d = mx - mn;
    if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4); if (h < 0) h += 360; return h >= 15 && h <= 50 && (d / mx) > 0.45; };
  const oranges = [];
  for (const e of P.querySelectorAll('*')) { if (!vis(e)) continue; const s = getComputedStyle(e);
    for (const p of ['color', 'background-color', 'border-top-color', 'border-left-color', 'box-shadow', 'outline-color']) { if (p.startsWith('border') && parseFloat(s[p.replace('color', 'width')]) === 0) continue; if (p === 'outline-color' && s.outlineStyle === 'none') continue;
      if (rgbs(s[p]).some(orange)) { oranges.push((e.className && String(e.className).slice(0, 40)) + ' ' + p + ' ' + s[p]); break; } } }
  // Cibles : tout ce qu'on touche dans les pièces refaites.
  const cibles = [...P.querySelectorAll('[data-mp-bandeau] a, [data-mp-offre] button, [data-agir-composer] button, [data-agir-composer] textarea, .vrm-mp-rr')].filter(vis)
    .map((e) => { const r = e.getBoundingClientRect(); return { k: (e.getAttribute('data-agir-accepter') != null ? 'accepter' : e.className || e.tagName).toString().slice(0, 30), h: Math.round(r.height), w: Math.round(r.width) }; });
  const petites = cibles.filter((c) => c.h < 44 || c.w < 44);
  // Débordement : la page et chaque pièce refaite tiennent dans la largeur.
  const W = document.documentElement.clientWidth;
  const deborde = [...P.querySelectorAll('[data-mp-bandeau], [data-mp-offre], .vrm-mp-offre-fil, [data-agir-composer], .vrm-mp-gestes')].filter(vis)
    .filter((e) => { const r = e.getBoundingClientRect(); return r.right > W + 1 || r.left < -1 || e.scrollWidth > e.clientWidth + 1; }).map((e) => e.className);
  const pageDeb = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  // La raison : combien de fois elle est ÉCRITE à l'écran (texte visible du panneau).
  const raison = (document.querySelector('[data-mp-raison]') || {}).innerText || '';
  const texte = P.innerText || '';
  const fois = raison ? texte.split(raison).length - 1 : 0;
  const raisonsBoutons = [...P.querySelectorAll('[data-n-raison]')].filter(vis).length;
  // Le fil : une bulle visible dans la zone qui défile (la conversation n'est plus écrasée par le pied).
  const H = P.querySelector('.vrm-chat-history');
  const hr = H ? H.getBoundingClientRect() : null;
  const bulles = H ? [...H.querySelectorAll('.vrm-bulle')].filter((b) => { const r = b.getBoundingClientRect(); return hr && r.bottom > hr.top + 4 && r.top < hr.bottom - 4; }).length : 0;
  const carte = P.querySelector('[data-mp-offre]');
  const g = (s) => P.querySelector(s);
  return {
    oranges: oranges.slice(0, 5), petites, deborde, pageDeb, raison, fois, raisonsBoutons, bandeaux: P.querySelectorAll('[data-mp-bandeau]').length,
    filH: hr ? Math.round(hr.height) : 0, bulles, defile: H ? H.scrollHeight > H.clientHeight + 4 : false,
    carte: !!carte, carteDansFil: !!(carte && H && H.contains(carte)), marge: g('[data-offre-marge]') ? { c: g('[data-offre-marge]').getAttribute('data-offre-marge'), t: g('[data-offre-marge]').innerText } : null,
    ajouter: !!g('[data-plancher-saisir]'), offreGestes: [...P.querySelectorAll('[data-agir-offre] [data-agir]')].map((x) => x.getAttribute('data-agir') + ':' + (x.getAttribute('aria-disabled') || '')),
    champ: !!g('[data-agir-composer] textarea'), barre: (g('[data-mp-compose-ro]') || {}).getAttribute ? g('[data-mp-compose-ro]').getAttribute('data-mp-compose-ro') : null,
    puces: P.querySelectorAll('[data-rr-puces] button').length, ouvrir: !!g('[data-mp-ouvrir]'), montant: (g('[data-mp-montant]') || {}).innerText || '', affiche: (g('[data-mp-affiche]') || {}).innerText || '',
  };
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
  const communs = (m, nom) => {
    dit(m && m.oranges.length === 0, `${nom} : aucun orange dans les couleurs calculées`, m && JSON.stringify(m.oranges));
    dit(m && m.petites.length === 0, `${nom} : cibles ≥ 44 px`, m && JSON.stringify(m.petites));
    dit(m && m.deborde.length === 0 && m.pageDeb <= 0, `${nom} : aucun débordement`, m && JSON.stringify({ d: m.deborde, p: m.pageDeb }));
  };
  try {
    const formes = COURT ? [[true, false]] : [[true, false], [true, true], [false, false], [false, true]];
    for (const [mobile, sombre] of formes) {
      const nom = `${mobile ? '390' : '1512'}-${sombre ? 'sombre' : 'clair'}`;
      console.log(`\n── ${nom}`);
      semer('offre');
      const ctx = await contexte(nav, { mobile, sombre }); const pg = await ctx.newPage();
      if (process.env.DEBUG) pg.on('pageerror', (e) => console.log('   PAGEERROR', String(e).slice(0, 300)));
      await pg.goto('https://vrm.center/?tab=messages', { waitUntil: 'domcontentloaded' });
      await attendreQue(pg, ({ B }) => !!document.querySelector(`[data-msg-groupe="vinted:${B}"] button[data-fil]`), { B });

      // ── B : lecture seule + offre, prix d'achat inconnu (la capture de Julien)
      const fb = await ouvrirConv(pg, B, 'lecture');
      await attendreQue(pg, () => !!document.querySelector('[data-mp-bandeau]') && !!document.querySelector('[data-mp-offre]'), null, 20000);
      await attendre(900); await photo(pg, `B-lecture-offre-${nom}`);
      const mb = await pg.evaluate(mesurer).catch((e) => ({ err: String(e) }));
      dit(fb && fb.agir === 'lecture', `${nom} B : la porte dit « lecture seule »`, JSON.stringify(fb));
      dit(mb && mb.bandeaux === 1 && mb.fois === 1 && mb.raisonsBoutons === 0 && /atelier_b/.test(mb.raison), `${nom} B : la raison écrite UNE fois (le bandeau), aucune sous les boutons`, JSON.stringify(mb && { b: mb.bandeaux, f: mb.fois, rb: mb.raisonsBoutons, r: mb.raison }));
      dit(mb && mb.ouvrir, `${nom} B : « Ouvrir Vinted » dans le bandeau`);
      dit(mb && mb.offreGestes.length >= 2 && mb.offreGestes.every((x) => x === 'lecture:true'), `${nom} B : Accepter / Refuser visibles et éteints`, mb && JSON.stringify(mb.offreGestes));
      dit(mb && !mb.champ && mb.barre === 'bandeau', `${nom} B : pas de grande boîte grise — une barre fine`, mb && JSON.stringify({ champ: mb.champ, barre: mb.barre }));
      dit(mb && mb.ajouter && !mb.marge, `${nom} B : prix d'achat inconnu ⇒ « Ajouter le prix d'achat », AUCUNE marge`, mb && JSON.stringify({ a: mb.ajouter, m: mb.marge }));
      dit(mb && mb.carteDansFil && /70/.test(mb.montant) && /85/.test(mb.affiche), `${nom} B : la carte « Offre de 70 € », 85 € barré, dans le fil`, mb && JSON.stringify({ f: mb.carteDansFil, m: mb.montant, a: mb.affiche }));
      dit(mb && mb.bulles >= 1, `${nom} B : le fil reste visible (au moins une bulle à l'écran)`, mb && JSON.stringify({ h: mb.filH, b: mb.bulles }));
      communs(mb, `${nom} B`);
      await pg.evaluate(() => { for (const s of ['[data-agir-refuser]', '[data-agir-accepter]', '[data-agir-contre]', '[data-agir-envoyer]']) { const b = document.querySelector(s); if (b) b.click(); } }).catch(() => {});
      await attendre(1500);
      const feuilleB = await pg.evaluate(() => !!document.querySelector('[data-agir-accepter-confirmer]')).catch(() => null);
      dit(!commandes().some((c) => c.compte === B) && feuilleB === false, `${nom} B : toucher Refuser / Accepter ⇒ RIEN ne part, aucune confirmation ouverte`, JSON.stringify({ cmds: commandes(), feuilleB }));

      // ── A : connecté + offre, prix d'achat connu
      await pg.goto('https://vrm.center/?tab=messages', { waitUntil: 'domcontentloaded' });
      await attendreQue(pg, ({ A }) => !!document.querySelector(`[data-msg-groupe="vinted:${A}"] button[data-fil]`), { A });
      const fa = await ouvrirConv(pg, A, 'ok');
      await attendreQue(pg, () => !!document.querySelector('[data-offre-marge]'), null, 20000);
      await attendre(900); await photo(pg, `A-connecte-offre-${nom}`);
      const ma = await pg.evaluate(mesurer).catch((e) => ({ err: String(e) }));
      dit(fa && fa.agir === 'ok', `${nom} A : la porte laisse agir`, JSON.stringify(fa));
      dit(ma && ma.bandeaux === 0 && ma.raisonsBoutons === 0, `${nom} A : aucun bandeau, aucune raison`, ma && JSON.stringify({ b: ma.bandeaux, r: ma.raisonsBoutons }));
      dit(ma && ma.marge && ma.marge.c === '2400' && /\+24 € de marge/.test(ma.marge.t.replace(/[  ]/g, ' ')) && !ma.ajouter, `${nom} A : prix d'achat connu ⇒ « +24 € de marge » (70 − 40 − 6)`, ma && JSON.stringify(ma.marge));
      dit(ma && ma.offreGestes.length >= 2 && ma.offreGestes.every((x) => x === 'ok:'), `${nom} A : Accepter / Refuser allumés`, ma && JSON.stringify(ma.offreGestes));
      dit(ma && ma.champ && ma.puces >= 1, `${nom} A : le champ en pilule et ses puces de réponses`, ma && JSON.stringify({ c: ma.champ, p: ma.puces }));
      dit(ma && ma.bulles >= 1, `${nom} A : le fil reste visible`, ma && JSON.stringify({ h: ma.filH, b: ma.bulles }));
      communs(ma, `${nom} A`);
      // Une puce remplit le champ, rien ne part.
      const avantPuce = commandes().length;
      await pg.evaluate(() => { const b = document.querySelector('[data-rr-puces] button[data-rr-app-remplir]'); if (b) b.click(); }).catch(() => {});
      const rempli = await attendreQue(pg, () => { const t = document.querySelector('[data-agir-composer] textarea'); return t && t.value.length > 10 ? t.value : null; }, null, 8000);
      dit(!!rempli && commandes().length === avantPuce, `${nom} A : une puce remplit le champ (texte entier), rien ne part`, JSON.stringify({ rempli, n: commandes().length }));
      await photo(pg, `A-puce-remplie-${nom}`);
      // Accepter DEMANDE : la feuille s'ouvre, rien ne part avant « Oui, accepter ».
      await pg.click('[data-agir-accepter]').catch(() => {});
      const feuille = await attendreQue(pg, () => !!document.querySelector('[data-agir-accepter-confirmer]'), null, 8000);
      await attendre(500); await photo(pg, `A-accepter-confirme-${nom}`);
      dit(feuille && !commandes().some((c) => c.geste === 'accepter'), `${nom} A : Accepter ouvre la confirmation, rien n'est parti`, JSON.stringify(commandes()));
      await pg.click('[data-agir-accepter-confirmer]').catch(() => {});
      const parti = await attendreQue(pg, () => (document.querySelector('[data-agir-offre] [data-agir-issue]') || {}).getAttribute ? document.querySelector('[data-agir-offre] [data-agir-issue]').getAttribute('data-agir-issue') : null, null, 15000);
      const acc = commandes().filter((c) => c.geste === 'accepter');
      dit(parti === 'ok' && acc.length === 1 && acc[0].compte === A && acc[0].args && acc[0].args.oid === OID[A], `${nom} A : « Oui, accepter » ⇒ UNE commande au nom de A, pour CETTE offre`, JSON.stringify({ parti, acc }));
      // Envoyer : une commande `repondre`.
      await pg.fill('[data-agir-composer="vinted"] textarea', 'Elle taille normalement, prenez votre pointure.').catch(() => {});
      await pg.click('[data-agir-composer="vinted"] [data-agir-envoyer]').catch(() => {});
      await attendreQue(pg, () => (document.querySelector('[data-agir-composer] [data-agir-issue]') || null) && true, null, 15000);
      const rep = commandes().filter((c) => c.geste === 'repondre' && c.compte === A);
      dit(rep.length === 1 && !commandes().some((c) => c.compte === B), `${nom} A : Envoyer ⇒ UNE commande repondre au nom de A, aucune pour B`, JSON.stringify(rep));
      await ctx.close();

      // ── A : pas d'offre, fil long
      if (!COURT || true) {
        semer('long');
        const ctx2 = await contexte(nav, { mobile, sombre }); const pg2 = await ctx2.newPage();
        await pg2.goto('https://vrm.center/?tab=messages', { waitUntil: 'domcontentloaded' });
        await attendreQue(pg2, ({ A }) => !!document.querySelector(`[data-msg-groupe="vinted:${A}"] button[data-fil]`), { A });
        await ouvrirConv(pg2, A, 'ok');
        await attendreQue(pg2, () => document.querySelectorAll('.vrm-chat-history .vrm-bulle').length >= 20, null, 20000);
        await attendre(900); await photo(pg2, `A-fil-long-sans-offre-${nom}`);
        const ml = await pg2.evaluate(mesurer).catch((e) => ({ err: String(e) }));
        dit(ml && !ml.carte && ml.bulles >= 3 && ml.defile, `${nom} fil long : aucune carte d'offre, le fil défile et se lit`, ml && JSON.stringify({ c: ml.carte, b: ml.bulles, d: ml.defile, h: ml.filH }));
        communs(ml, `${nom} fil long`);
        await ctx2.close();
      }
    }
  } finally { await nav.close().catch(() => {}); try { M.fermer && M.fermer(); } catch (_) {} try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {} }
  console.log(`\n${ok} verts, ${ko} rouges.`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
