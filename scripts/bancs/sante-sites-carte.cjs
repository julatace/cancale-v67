// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA SANTÉ DE CHAQUE SITE DANS LA CARTE DU LOGO » (24 nov., ext. 5.448.0 — `santesites`)
//
//  Julien : « l'extension doit être intelligente ». Le VRAI vrm-badge.js (faux `chrome` : il répond ce que dirait le
//  service worker, dont la règle `santeSites` est exécutée par scripts/audit-ext-adaptatif.cjs sur le VRAI background.js).
//   H1  tout va bien ⇒ « Vinted : tout marche. », sans couleur ;
//   H2  un problème ⇒ « … ne marche plus … Geste : … », à l'ENCRE en gras — aucun orange ni ambre (Julien, 23 nov.) ;
//   H3  « pas encore vu » ⇒ aucune ligne (rien à dire) ;
//   H4  carte Leboncoin (sans les quatre lignes) ⇒ la ligne y est aussi.
//  390 px au doigt et 1512 px, clair et sombre ; captures dans captures/sante-sites-carte. Tout est inventé.
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const RACINE = path.join(__dirname, '..', '..');
const EXT = process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension');
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const LOGO = fs.readFileSync(path.join(EXT, 'logo-vrm-96.png'));
const VERSION = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'sante-sites-carte') : path.join(__dirname, 'captures', 'sante-sites-carte');
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };
const MIN = 60000;
const base = (x) => Object.assign({ ok: true, plateforme: 'vinted', capte: true, version: VERSION, code: VERSION,
  vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true }, site: { id: '111', nom: 'shop_x', choix: 'oui' }, flux: { okAt: Date.now() - 3 * MIN }, bascule: null }, x || {});
async function ouvrir(nav, etat, { scheme = 'light', largeur = 1512, hauteur = 900, mobile = false } = {}) {
  const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, viewport: { width: largeur, height: hauteur } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await pg.route('**/*', (r) => {
    if (/logo-vrm-96\.png/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#fff;font-family:sans-serif"><header style="height:64px;border-bottom:1px solid #ddd;padding:20px">Une page du site</header><main style="padding:20px;height:2000px">Annonces…</main></body></html>' });
  });
  await pg.goto('https://www.vinted.fr/member/1');
  await pg.evaluate(({ e, js }) => {
    window.__envoyes = [];
    // Un vrai `sendMessage` COPIE la réponse : la carte ne peut jamais modifier l'état du service worker.
    const copie = (x) => JSON.parse(JSON.stringify(x));
    const moisInitial = copie(e.mois === undefined ? null : e.mois);
    window.__etat = copie(e);
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    const store = {};
    window.chrome = {
      runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: e.version }), lastError: null,
        sendMessage: (msg, cb) => {
          window.__envoyes.push(msg);
          // Le service worker range le réglage ; l'état suivant le porte (comme moisPourCarte).
          if (msg.action === 'resumeMasque') window.__etat = Object.assign({}, window.__etat, { mois: msg.masque ? { masque: true } : copie(moisInitial) });
          setTimeout(() => cb && cb(msg.action === 'etat' ? copie(window.__etat) : { ok: true, masque: !!msg.masque }), 0);
        } },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { Object.assign(store, o); if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener() {} } },
    };
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: etat, js: BADGE });
  await pg.waitForTimeout(250);
  return { ctx, pg, erreurs };
}

const lire = (pg) => pg.evaluate(() => {
  const h = document.getElementById('vrm-badge'); if (!h || !h.shadowRoot) return null;
  const r = h.shadowRoot; const l = r.querySelector('[data-sante-site]'); const carte = r.querySelector('.carte');
  const b = r.querySelector('.btn') ? r.querySelector('.btn').getBoundingClientRect() : null;
  return { l: !!l, k: l ? l.getAttribute('data-sante-site') : null, texte: l ? l.textContent.trim() : '', visible: !!(l && l.getClientRects().length), couleur: l ? getComputedStyle(l).color : '', gras: l ? Number(getComputedStyle(l).fontWeight) : 0, encre: carte ? getComputedStyle(carte).color : '', btn: b ? { x: b.left, y: b.top, w: b.width, h: b.height } : null, debord: document.documentElement.scrollWidth > window.innerWidth, q4: !!r.querySelector('[data-q4-bloc]'), cls: carte ? carte.className : '', txt: carte ? String(carte.innerText || '').slice(0, 300) : '' };
});
const montrer = async (pg, mobile) => {
  let a = await lire(pg);
  for (let i = 0; i < 20 && (!a || !a.btn || !a.btn.w); i++) { await pg.waitForTimeout(100); a = await lire(pg); }
  if (!a || !a.btn) return;
  if (mobile) await pg.tap('#vrm-badge', { position: { x: a.btn.w / 2, y: a.btn.h / 2 } }).catch(() => {});
  else { await pg.mouse.move(5, 5); await pg.waitForTimeout(80); await pg.mouse.move(a.btn.x + a.btn.w / 2, a.btn.y + a.btn.h / 2); await pg.waitForTimeout(60); await pg.mouse.click(a.btn.x + a.btn.w / 2, a.btn.y + a.btn.h / 2); }
  await pg.waitForTimeout(400);
};
// Une couleur calculée « orange / ambre » : teinte 15–55°, saturée, pas grise.
function orange(c) { const m = /rgba?\((\d+), ?(\d+), ?(\d+)/.exec(String(c || '')); if (!m) return false; const [r, g, b] = [m[1], m[2], m[3]].map(Number).map((x) => x / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 0.2) return false; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; return h >= 15 && h <= 55; }
const OK = { ok: true, k: 'ok', t: 'Vinted : tout marche.' };
const KO = { ok: false, k: 'element', nom: 'envoyer', t: "VRM ne trouve plus le bouton « Envoyer » sur la page Vinted (Vinted a changé sa page). Geste : fais-le toi-même sur vinted.fr cette fois, et touche « Envoyer un rapport » dans la fenêtre de l'extension." };
(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const cap = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };
  try {
    for (const [largeur, hauteur, mobile] of [[1512, 900, false], [390, 760, true]]) for (const scheme of ['light', 'dark']) {
      const nom = `${largeur}-${scheme}`;
      let t = await ouvrir(nav, base({ santeSite: OK }), { scheme, largeur, hauteur, mobile }); await montrer(t.pg, mobile);
      let a = await lire(t.pg); await cap(t.pg, 'ok-' + nom);
      dit(a && a.visible && a.k === 'ok' && a.texte === 'Vinted : tout marche.' && a.couleur === a.encre, `H1 ${nom} : « Vinted : tout marche. », sans couleur`, JSON.stringify(a));
      await t.ctx.close();
      t = await ouvrir(nav, base({ santeSite: KO }), { scheme, largeur, hauteur, mobile }); await montrer(t.pg, mobile);
      a = await lire(t.pg); await cap(t.pg, 'ko-' + nom);
      dit(a && a.visible && a.k === 'element' && /ne trouve plus le bouton « Envoyer »/.test(a.texte) && /Geste : /.test(a.texte) && a.gras >= 600 && !a.debord, `H2 ${nom} : le problème et SON geste, en gras, rien ne déborde`, JSON.stringify(a));
      dit(a && !orange(a.couleur) && a.couleur === a.encre, `H2 ${nom} : à l'encre, AUCUN orange ni ambre (décision du 23 nov.)`, a && a.couleur);
      dit(!t.erreurs.length, `${nom} : aucune erreur de page`, t.erreurs.join(' | '));
      await t.ctx.close();
    }
    for (const scheme of ['light', 'dark']) {
      const KOL = { ok: false, k: 'element', nom: 'envoyer', t: "Leboncoin : le bouton « Envoyer » ne marche plus (la page a changé). Geste : fais ce geste une fois toi-même sur leboncoin.fr, dans ce Chrome (VRM réapprend), puis touche « Envoyer un rapport »." };
      const tl = await ouvrir(nav, base({ plateforme: 'leboncoin', site: { nom: 'vendeur_lbc' }, lbc: { annonces: { n: 12 }, ventes: { n: 2 } }, santeSite: KOL }), { scheme });
      await montrer(tl.pg, false);
      const al = await lire(tl.pg); await cap(tl.pg, 'lbc-' + scheme);
      dit(al && al.visible && /^Leboncoin : le bouton « Envoyer » ne marche plus/.test(al.texte) && al.gras >= 600 && !orange(al.couleur) && al.couleur === al.encre, `H4 Leboncoin ${scheme} : la ligne est là, à l'encre en gras, aucun orange`, JSON.stringify(al));
      await tl.ctx.close();
    }
    let t = await ouvrir(nav, base({ santeSite: { ok: null, k: 'pas-vu', t: 'Vinted : pas encore vu dans ce Chrome.' } })); await montrer(t.pg, false);
    let a = await lire(t.pg);
    dit(a && !a.l, 'H3 « pas encore vu » ⇒ aucune ligne', JSON.stringify(a)); await t.ctx.close();
  } finally { await nav.close(); }
  console.log(ko ? `\n❌ sante-sites-carte : ${ok} verts, ${ko} rouges` : `\n✅ sante-sites-carte : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();
