// ════════════════════════════════════════════════════════════════════════════
//  BANC « L'EXTENSION AUSSI BELLE ET PRATIQUE QUE L'APP » (5.351, 11 nov.)
//
//  On charge les VRAIS fichiers de l'extension (vrm-badge.js, popup.html +
//  popup.js, bridge.js) dans Chromium avec un faux `chrome` qui a un vrai
//  stockage local, et le VRAI background.js en VM (scripts/_fond-vm.cjs).
//  Tout est synthétique : aucune requête vers Vinted, aucune base.
//
//  Ce que le banc juge (data-* et géométrie, jamais un libellé seul) :
//   A. UN message principal (`[data-resume]`) en tête de la carte, ≤ 12 mots ;
//      le détail (`details[data-detail]`) REPLIÉ quand tout va bien, OUVERT dès
//      qu'il y a un geste ; « pause » (Vinted freine) n'allume pas l'ambre.
//   B. Connecté : « Ouvrir VRM » puis Colis · Messages · Offres à UN clic, qui
//      demandent au service worker l'écran nommé (et lui, une liste blanche).
//   C. Le logo se glisse (le clic qui suit est mangé), retient sa place PAR SITE,
//      se réduit en pastille ; la carte s'ouvre du côté où il y a la place et
//      reste DANS l'écran (390 et 1512 px).
//   D. La teinte choisie dans VRM (clair / sombre) passe avant le système —
//      carte et fenêtre — et le pont de vrm.center la recopie (le mode seul).
//   E. prefers-reduced-motion : aucune animation.
//   F. Le fond : `etat` porte la pause et le frein LUS dans ce Chrome ; ECRANS
//      en liste blanche (un écran inconnu ouvre VRM comme avant).
//  Captures (clair et sombre) : carte connectée, pause, à connecter, Leboncoin,
//  logo déplacé + pastille, fenêtre — dans BANC_CAPTURES (ou ./captures).
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const RACINE = path.join(__dirname, '..', '..');
const EXT = path.join(RACINE, 'vinted-sync-extension');
const lireExt = (f) => { try { return fs.readFileSync(path.join(EXT, f), 'utf8'); } catch (_) { return ''; } };
const BADGE = lireExt('vrm-badge.js');
const POPUP_HTML = lireExt('popup.html');
const POPUP_JS = lireExt('popup.js');
const BRIDGE = lireExt('bridge.js');
const LOGO = fs.readFileSync(path.join(EXT, 'logo-vrm-96.png'));
const SORTIE = process.env.BANC_CAPTURES || path.join(__dirname, 'captures', 'extension-visuel');

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => {
  if (bon) { ok++; console.log(`  ✅ ${quoi}`); }
  else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 220) : ''}`); }
};
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${String(e && e.message).slice(0, 200)}`); return null; } };

const MIN = 60000;
const base = (x) => Object.assign({ ok: true, plateforme: 'vinted', capte: true, version: '5.351.0', code: '5.351.0',
  vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true }, site: { id: '111', nom: 'shop_x', choix: 'oui' }, flux: { okAt: Date.now() - 3 * MIN }, bascule: null }, x || {});
const ETATS = {
  get ok() { return base(); },
  get pause() { return base({ site: { id: '111', nom: 'shop_x', choix: 'oui', pause: { jusqua: Date.now() + 25 * MIN } } }); },
  get frein() { return base({ site: { id: '111', nom: 'shop_x', choix: 'oui', frein: { jusqua: Date.now() + 20 * MIN, restreint: false } } }); },
  get deco() { return base({ vrm: { ok: true, connecte: false, cloisonne: true } }); },
  get refuse() { return base({ flux: { okAt: Date.now() - 60 * MIN, koAt: Date.now() - 2 * MIN, koStatut: '503' } }); },
  get lbc() { return base({ plateforme: 'leboncoin', site: { id: '9', nom: 'Sophie B.', type: 'particulier' }, lbc: { compte: { ok: true, texte: 'Sophie B.' }, annonces: { ok: true, texte: '37 lues en entier {quand}', at: Date.now() - 4 * MIN }, ventes: { ok: null, texte: 'pas encore lues' }, geste: '' } }); },
  get progres() { return base({ site: { id: '111', nom: 'shop_x', choix: 'oui', dates: { reste: 1751, jours: 7 } } }); },
};

// La page du site, le faux `chrome` (stockage local VRAI : get/set/onChanged).
async function ouvrir(nav, etat, { scheme = 'light', largeur = 1512, hauteur = 900, store = {}, mobile = false, reduit = false, url = 'https://www.vinted.fr/member/1' } = {}) {
  const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, viewport: { width: largeur, height: hauteur }, reducedMotion: reduit ? 'reduce' : 'no-preference' },
    mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await pg.route('**/*', (r) => {
    const u = r.request().url();
    if (/logo-vrm-96\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#fff;font-family:sans-serif"><header style="height:64px;border-bottom:1px solid #ddd;padding:20px">Une page du site</header><main style="padding:20px;height:2000px">Annonces…</main></body></html>' });
  });
  await pg.goto(url);
  await pg.evaluate(({ e, js, store }) => {
    window.__envoyes = [];
    window.__store = store;
    const ecoutes = [];
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    const get = (k) => { const ks = k == null ? Object.keys(window.__store) : Array.isArray(k) ? k : [k]; const o = {}; for (const x of ks) if (x in window.__store) o[x] = JSON.parse(JSON.stringify(window.__store[x])); return o; };
    window.chrome = {
      runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: '5.351.0' }), lastError: null,
        sendMessage: (msg, cb) => { window.__envoyes.push(msg); setTimeout(() => cb && cb(msg.action === 'etat' ? e : { ok: true }), 0); } },
      storage: {
        local: {
          get: (k, cb) => { const o = get(k); if (cb) setTimeout(() => cb(o), 0); return Promise.resolve(o); },
          set: (o, cb) => { const ch = {}; for (const x of Object.keys(o)) { ch[x] = { oldValue: window.__store[x], newValue: o[x] }; window.__store[x] = JSON.parse(JSON.stringify(o[x])); } setTimeout(() => { ecoutes.forEach((f) => f(ch, 'local')); cb && cb(); }, 0); return Promise.resolve(); },
        },
        onChanged: { addListener: (f) => ecoutes.push(f) },
      },
    };
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: etat, js: BADGE, store });
  await pg.waitForTimeout(250);
  return { ctx, pg, erreurs };
}

const lire = (pg) => pg.evaluate(() => {
  const h = document.getElementById('vrm-badge');
  if (!h || !h.shadowRoot) return null;
  const r = h.shadowRoot;
  const q = (s) => r.querySelector(s);
  const carte = q('.carte'), btn = q('.btn'), det = q('details[data-detail]'), res = q('[data-resume]');
  const rect = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
  return {
    resume: res ? res.getAttribute('data-resume') : null,
    resumeTexte: res ? res.innerText.trim() : '',
    detail: det ? (det.open ? 'ouvert' : 'replie') : null,
    point: !!(q('.pt') && getComputedStyle(q('.pt')).display !== 'none'),
    carteVisible: !!(carte && getComputedStyle(carte).display !== 'none'),
    carte: rect(carte), btn: rect(btn),
    ecrans: Array.from(r.querySelectorAll('[data-ouvrir-ecran]')).map((b) => b.getAttribute('data-ouvrir-ecran')),
    ouvrirVrm: !!q('[data-ouvrir-vrm]'),
    hauteursRaccourcis: Array.from(r.querySelectorAll('[data-ouvrir-ecran]')).map((b) => Math.round(b.getBoundingClientRect().height)),
    fond: carte ? getComputedStyle(carte).backgroundColor : '',
    animation: carte ? getComputedStyle(carte).animationName : '',
    theme: h.getAttribute('data-theme'), mini: h.hasAttribute('data-mini'), haut: h.hasAttribute('data-haut'), gauche: h.hasAttribute('data-gauche'),
    progres: !!(q('[data-dates-versement]') && q('[data-dates-versement]').offsetParent),
    lbcVisibles: Array.from(r.querySelectorAll('[data-lbc-etat]')).filter((x) => x.offsetParent && !x.closest('details:not([open])')).length,
    envoyes: window.__envoyes.filter((m) => m.action !== 'etat'),
    store: window.__store,
  };
});
const survoler = async (pg, b) => { await pg.mouse.move(b.x + b.w / 2, b.y + b.h / 2); await pg.waitForTimeout(260); };
const lum = (rgb) => { const m = /(\d+),\s*(\d+),\s*(\d+)/.exec(rgb || ''); return m ? (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 : null; };
const dedans = (c, W, H) => !!c && c.x >= 0 && c.y >= 0 && c.r <= W && c.b <= H;
const mots = (t) => String(t || '').replace(/[✓·:—]/g, ' ').trim().split(/\s+/).filter(Boolean).length;

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const cap = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };

  console.log('A. Un message principal, le détail replié');
  for (const scheme of ['light', 'dark']) {
    await essaie(`A ${scheme}`, async () => {
      const { ctx, pg, erreurs } = await ouvrir(nav, ETATS.ok, { scheme });
      const l0 = await lire(pg); await survoler(pg, l0.btn); const l = await lire(pg);
      await cap(pg, `carte-ok-1512-${scheme}`);
      dit(l.resume === 'ok' && /shop_x/.test(l.resumeTexte), `${scheme} : tout va bien ⇒ UNE ligne d’état qui nomme le compte`, JSON.stringify([l.resume, l.resumeTexte]));
      dit(mots(l.resumeTexte) <= 12, `${scheme} : la ligne tient en 12 mots au plus`, l.resumeTexte);
      dit(l.detail === 'replie', `${scheme} : le détail est replié quand tout va bien`, l.detail);
      dit(!l.point, `${scheme} : aucun point ambre quand tout va bien (§7)`);
      dit(!erreurs.length, `${scheme} : aucune erreur dans la page`, erreurs.join(' | '));
      await ctx.close();
    });
  }
  for (const [nom, attendu] of [['deco', 'geste'], ['refuse', 'geste'], ['pause', 'pause'], ['frein', 'pause']]) {
    await essaie(`A ${nom}`, async () => {
      const { ctx, pg } = await ouvrir(nav, ETATS[nom], { scheme: 'dark' });
      const l0 = await lire(pg); await survoler(pg, l0.btn); const l = await lire(pg);
      if (nom === 'pause' || nom === 'deco') { await cap(pg, `carte-${nom}-1512-dark`); }
      dit(l.resume === attendu, `${nom} : la ligne d’état est « ${attendu} »`, JSON.stringify([l.resume, l.resumeTexte]));
      if (attendu === 'geste') dit(l.detail === 'ouvert' && l.point, `${nom} : un geste ⇒ détail OUVERT et point ambre`, JSON.stringify([l.detail, l.point]));
      else dit(!l.point && l.detail === 'replie', `${nom} : Vinted freine ⇒ dit en gris, sans ambre, détail replié`, JSON.stringify([l.detail, l.point]));
      dit(mots(l.resumeTexte) <= 12, `${nom} : 12 mots au plus`, l.resumeTexte);
      await ctx.close();
    });
  }
  await essaie('A progression', async () => {
    const { ctx, pg } = await ouvrir(nav, ETATS.progres, { scheme: 'light' });
    const l0 = await lire(pg); await survoler(pg, l0.btn); const l = await lire(pg);
    dit(l.progres && l.detail === 'replie', 'les dates de versement en cours de lecture restent VISIBLES (carte de progression), détail replié');
    await ctx.close();
  });
  await essaie('A Leboncoin', async () => {
    for (const scheme of ['light', 'dark']) {
      const { ctx, pg } = await ouvrir(nav, ETATS.lbc, { scheme, url: 'https://www.leboncoin.fr/compte' });
      const l0 = await lire(pg); await survoler(pg, l0.btn); const l = await lire(pg);
      await cap(pg, `carte-leboncoin-1512-${scheme}`);
      dit(l.lbcVisibles === 3 && l.resume === null, `Leboncoin ${scheme} : Compte · Annonces · Ventes restent le message principal, visibles (décision du 9 nov.), pas doublés`, JSON.stringify([l.lbcVisibles, l.resume]));
      await ctx.close();
    }
  });

  console.log('B. Le geste le plus fréquent à un clic');
  await essaie('B', async () => {
    const { ctx, pg } = await ouvrir(nav, ETATS.ok, { scheme: 'light' });
    const l0 = await lire(pg); await survoler(pg, l0.btn); const l = await lire(pg);
    dit(l.ouvrirVrm && JSON.stringify(l.ecrans) === '["colis","messages","offres"]', 'connecté : « Ouvrir VRM » puis Colis · Messages · Offres', JSON.stringify(l.ecrans));
    dit(l.hauteursRaccourcis.length === 3 && l.hauteursRaccourcis.every((h) => h >= 44), 'raccourcis ≥ 44 px', JSON.stringify(l.hauteursRaccourcis));
    await pg.evaluate(() => document.getElementById('vrm-badge').shadowRoot.querySelector('[data-ouvrir-ecran="colis"]').click());
    await pg.waitForTimeout(80);
    const l2 = await lire(pg);
    dit(l2.envoyes.some((m) => m.action === 'ouvrirVRM' && m.ecran === 'colis'), 'un clic sur « Colis » demande VRM sur les colis (écran nommé, pas une adresse)', JSON.stringify(l2.envoyes));
    await ctx.close();
    const d = await ouvrir(nav, ETATS.deco, { scheme: 'light' });
    const m0 = await lire(d.pg); await survoler(d.pg, m0.btn); const m = await lire(d.pg);
    dit(!m.ecrans.length && !m.ouvrirVrm, 'pas connecté : aucun raccourci (la connexion d’abord)', JSON.stringify(m.ecrans));
    await d.ctx.close();
  });

  console.log('C. Déplacer, retenir, réduire — jamais hors de l’écran');
  await essaie('C', async () => {
    const { ctx, pg } = await ouvrir(nav, ETATS.ok, { scheme: 'light' });
    const l0 = await lire(pg);
    const cx = l0.btn.x + 22, cy = l0.btn.y + 22;
    await pg.mouse.move(cx, cy); await pg.mouse.down(); await pg.mouse.move(cx - 60, cy - 60, { steps: 4 }); await pg.mouse.move(cx - 1200, cy - 700, { steps: 8 }); await pg.mouse.up();
    await pg.waitForTimeout(150);
    const l = await lire(pg);
    const p = l.store.vrmBadgePos && l.store.vrmBadgePos.vinted;
    dit(l.btn && l.btn.x < 400 && l.btn.y < 300, 'glissé : le logo a suivi la souris', JSON.stringify([l.btn, l.store.vrmBadgePos]));
    dit(!!p && Number.isFinite(p.r) && Number.isFinite(p.b), 'sa place est retenue POUR CE SITE (stockage local)', JSON.stringify(l.store.vrmBadgePos));
    dit(!l.envoyes.some((m) => m.action === 'ouvrirVRM'), 'glisser n’ouvre PAS VRM (le clic qui suit est mangé)', JSON.stringify(l.envoyes));
    dit(l.haut && l.gauche, 'en haut à gauche : la carte s’ouvrira vers le bas et vers la droite', JSON.stringify([l.haut, l.gauche]));
    await pg.mouse.move(900, 700); await pg.waitForTimeout(300); await survoler(pg, l.btn); const l2 = await lire(pg);
    await cap(pg, 'carte-deplacee-1512-light');
    dit(l2.carteVisible && dedans(l2.carte, 1512, 900), 'la carte reste dans l’écran', JSON.stringify(l2.carte));
    await ctx.close();
    // Une autre visite du même site : à sa place. Leboncoin : pas touché.
    const v = await ouvrir(nav, ETATS.ok, { scheme: 'light', store: { vrmBadgePos: l.store.vrmBadgePos } });
    const lv = await lire(v.pg);
    dit(Math.abs(lv.btn.x - l.btn.x) <= 1 && Math.abs(lv.btn.y - l.btn.y) <= 1, 'page suivante : le logo est à la place retenue', JSON.stringify([lv.btn, l.btn]));
    await v.ctx.close();
    const lb = await ouvrir(nav, ETATS.lbc, { scheme: 'light', store: { vrmBadgePos: l.store.vrmBadgePos }, url: 'https://www.leboncoin.fr/' });
    const ll = await lire(lb.pg);
    dit(ll.btn.r === 1512 - 16 && ll.btn.b === 900 - 16, 'un autre site garde le coin bas-droit (place PAR site)', JSON.stringify(ll.btn));
    await lb.ctx.close();
    // Pastille.
    const m = await ouvrir(nav, ETATS.ok, { scheme: 'dark' });
    const m0 = await lire(m.pg); await survoler(m.pg, m0.btn);
    await m.pg.evaluate(() => document.getElementById('vrm-badge').shadowRoot.querySelector('[data-mini-logo]').click());
    await m.pg.waitForTimeout(120);
    const mm = await lire(m.pg);
    dit(mm.mini && mm.btn.w === 30 && mm.store.vrmBadgeMini === true, 'réduire : le logo devient une pastille de 30 px, et c’est retenu', JSON.stringify([mm.mini, mm.btn, mm.store.vrmBadgeMini]));
    await m.pg.mouse.move(10, 10); await m.pg.waitForTimeout(300); await survoler(m.pg, mm.btn); const m2 = await lire(m.pg);
    await cap(m.pg, 'carte-pastille-1512-dark');
    dit(m2.carteVisible && dedans(m2.carte, 1512, 900) && m2.carte.b <= mm.btn.y, 'pastille : la carte s’ouvre au-dessus, dans l’écran', JSON.stringify([m2.carte, mm.btn]));
    await m.ctx.close();
    // Au doigt, 390 px : dans l'écran.
    const t = await ouvrir(nav, ETATS.ok, { scheme: 'light', largeur: 390, hauteur: 760, mobile: true });
    const t0 = await lire(t.pg); await t.pg.tap(`#vrm-badge`, { position: { x: t0.btn.w / 2, y: t0.btn.h / 2 } }).catch(() => {}); await t.pg.waitForTimeout(300);
    const tt = await lire(t.pg);
    await cap(t.pg, 'carte-ok-390-light');
    dit(tt.carteVisible && dedans(tt.carte, 390, 760), '390 px au doigt : la carte s’ouvre et reste dans l’écran', JSON.stringify(tt.carte));
    await t.ctx.close();
  });

  console.log('D. La teinte choisie dans VRM');
  await essaie('D carte', async () => {
    for (const [mode, scheme, clair] of [['clair', 'dark', true], ['sombre', 'light', false], ['auto', 'dark', false], ['auto', 'light', true]]) {
      const { ctx, pg } = await ouvrir(nav, ETATS.ok, { scheme, store: { vrmApparence: mode } });
      const l0 = await lire(pg); await survoler(pg, l0.btn); const l = await lire(pg);
      const L = lum(l.fond);
      dit(L != null && (clair ? L > 0.7 : L < 0.3), `VRM « ${mode} », système ${scheme} : carte ${clair ? 'claire' : 'sombre'}`, `${l.fond} · theme=${l.theme}`);
      await ctx.close();
    }
  });
  await essaie('D fenêtre', async () => {
    for (const [mode, scheme, clair] of [[null, 'light', true], [null, 'dark', false], ['sombre', 'light', false], ['clair', 'dark', true]]) {
      const ctx = await nav.newContext({ colorScheme: scheme, viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 });
      const pg = await ctx.newPage();
      await pg.route('**/*', (r) => {
        const u = r.request().url();
        if (/logo-vrm-96\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
        if (/popup\.js$/.test(u)) return r.fulfill({ status: 200, contentType: 'text/javascript', body: POPUP_JS });
        if (/\.js$/.test(u)) return r.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
        return r.fulfill({ status: 200, contentType: 'text/html', body: POPUP_HTML });
      });
      await pg.addInitScript((m) => {
        const store = m ? { vrmApparence: m } : {};
        window.chrome = { runtime: { id: 'ext', lastError: null, getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: '5.351.0' }),
          sendMessage: (msg, cb) => setTimeout(() => cb && cb(msg && msg.action === 'authEtat' ? { connecte: false } : { ok: false }), 0), onMessage: { addListener() {} } },
          storage: { local: { get: (k, cb) => { const o = {}; [].concat(k || []).forEach((x) => { if (x in store) o[x] = store[x]; }); if (cb) setTimeout(() => cb(o), 0); return Promise.resolve(o); }, set: () => Promise.resolve() }, onChanged: { addListener() {} } } };
      }, mode);
      await pg.goto('https://ext.test/popup.html');
      await pg.waitForTimeout(500);
      const fond = await pg.evaluate(() => getComputedStyle(document.body).backgroundColor);
      await pg.screenshot({ path: path.join(SORTIE, `fenetre-${mode || 'systeme'}-${scheme}.png`) }).catch(() => {});
      const L = lum(fond);
      dit(L != null && (clair ? L > 0.7 : L < 0.3), `fenêtre : VRM « ${mode || 'pas su'} », système ${scheme} ⇒ ${clair ? 'claire' : 'sombre'}`, fond);
      await ctx.close();
    }
  });
  await essaie('D pont', async () => {
    for (const [cles, attendu] of [[{ vrm_apparence: '"soir"' }, 'soir'], [{ vinted_dark: 'true' }, 'sombre'], [{ vinted_dark: 'false' }, 'clair'], [{ vrm_apparence: '"<img>"' }, null], [{}, null]]) {
      const ctx = await nav.newContext();
      const pg = await ctx.newPage();
      await pg.route('**/*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><body>VRM</body>' }));
      await pg.goto('https://vrm.center/');
      const store = await pg.evaluate(async ({ cles, js }) => {
        for (const k of Object.keys(cles)) localStorage.setItem(k, cles[k]);
        const store = {};
        window.chrome = { runtime: { id: 'ext', getManifest: () => ({ version: '5.351.0' }), lastError: null, sendMessage: (m, cb) => cb && cb({ ok: true }), onMessage: { addListener() {} } },
          storage: { local: { get: (k, cb) => cb({}), set: (o) => Object.assign(store, o) } } };
        try { (0, eval)(js); } catch (_) {}
        await new Promise((r) => setTimeout(r, 60));
        return store;
      }, { cles, js: BRIDGE });
      dit((store.vrmApparence || null) === attendu, `pont : ${JSON.stringify(cles)} ⇒ ${attendu || 'rien écrit'}`, JSON.stringify(store));
      dit(Object.keys(store).every((k) => k === 'vrmApparence'), 'pont : seul le mode est recopié', JSON.stringify(Object.keys(store)));
      await ctx.close();
    }
  });

  console.log('E. Mouvement réduit');
  await essaie('E', async () => {
    const a = await ouvrir(nav, ETATS.ok, { scheme: 'light' });
    const a0 = await lire(a.pg); await survoler(a.pg, a0.btn); const al = await lire(a.pg);
    dit(al.animation && al.animation !== 'none', 'mouvement normal : la carte entre en douceur', al.animation);
    await a.ctx.close();
    const b = await ouvrir(nav, ETATS.ok, { scheme: 'light', reduit: true });
    const b0 = await lire(b.pg); await survoler(b.pg, b0.btn); const bl = await lire(b.pg);
    dit(bl.animation === 'none', 'prefers-reduced-motion : aucune animation', bl.animation);
    await b.ctx.close();
  });

  console.log('F. Le service worker (VRAI background.js en VM)');
  await essaie('F', async () => {
    const { faireFond } = require('../_fond-vm.cjs');
    const f = faireFond({ store: { vrmPauseVinted: { jusqua: Date.now() + 10 * MIN, niveau: 1 }, vrmFreinRepub: { 111: { jusqua: Date.now() + 20 * MIN, restreint: true } } } });
    f.ctx.compteConnecte = async () => '111';
    f.ctx.loginDe = async () => 'shop_x';
    const e = await f.envoyer({ from: 'vrm-badge', action: 'etat' }, { tab: { id: 7, url: 'https://www.vinted.fr/member/1' } });
    dit(!!(e && e.site && e.site.pause && e.site.pause.jusqua > Date.now()), 'etat : la pause posée par un 429/403 est dite à la carte (lue dans ce Chrome)', JSON.stringify(e && e.site));
    dit(!!(e && e.site && e.site.frein && e.site.frein.restreint === true), 'etat : le frein des mises en ligne du compte est dit', JSON.stringify(e && e.site));
    dit(!f.j.vinted.length, 'etat : aucune requête vers Vinted', String(f.j.vinted.length));
    const ouverts = [];
    f.ctx.chrome.tabs.query = (q, cb) => { cb([]); };
    f.ctx.chrome.tabs.create = (o) => { ouverts.push(o.url); };
    for (const ecran of ['colis', 'messages', 'offres', 'journee', 'javascript:alert(1)', '__proto__', '']) {
      await f.envoyer({ from: 'vrm-badge', action: 'ouvrirVRM', ecran }, { tab: { id: 7, url: 'https://www.vinted.fr/' } });
    }
    await new Promise((r) => setTimeout(r, 30));
    const att = ['https://vrm.center/?tab=cat_bord', 'https://vrm.center/?tab=messages', 'https://vrm.center/?tab=messages&vue=favoris', 'https://vrm.center/?tab=journee', 'https://vrm.center/?tab=plat_vinted', 'https://vrm.center/?tab=plat_vinted', 'https://vrm.center/?tab=plat_vinted'];
    dit(JSON.stringify(ouverts) === JSON.stringify(att), 'ouvrirVRM : écrans en liste blanche ; inconnu ⇒ VRM comme avant', JSON.stringify(ouverts));
  });

  await nav.close();
  console.log(`\n  captures : ${SORTIE}`);
  console.log(ko ? `\n❌ extension-visuel : ${ok} verts, ${ko} rouges` : `\n✅ extension-visuel : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();
