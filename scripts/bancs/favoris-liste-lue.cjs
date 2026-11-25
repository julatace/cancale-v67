// ═════════════════════════════════════════════════════════════════════════════════════════════
//  BANC « LA LISTE DES FAVORIS SE REDESSINE SEULE APRÈS LA LECTURE DE LA LISTE » (5.440.2, 24 nov.)
//
//  Julien : « c'est à l'extension d'aller capter les favoris et d'actualiser l'écran, pas à moi ».
//  Le VRAI vrm-badge.js + vrm-ui.js + vrm-mots.js sur une page inventée de vinted.fr, faux `chrome` (le harnais de
//  extension-favoris-liste.cjs). La carte est OUVERTE sur 3 favoris ; le fond signale qu'il vient de lire la liste des
//  notifications de Vinted (`vrmFavorisListeLue` dans chrome.storage.local) et VRM en connaît maintenant 4 ⇒ la carte
//  redemande l'aperçu et montre les 4, sans aucun geste et sans attendre la minute de l'aperçu.
//  `BANC_RACINE=<arbre d'avant>` : l'extension d'avant (aucune écoute) ⇒ rouge. Données INVENTÉES.
// ═════════════════════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ICI = path.join(__dirname, '..', '..');
const RACINE = process.env.BANC_RACINE ? path.resolve(process.env.BANC_RACINE) : ICI;
const EXT = path.join(RACINE, 'vinted-sync-extension');
const lire = (f) => { try { return fs.readFileSync(path.join(EXT, f), 'utf8'); } catch (_) { return ''; } };
const UI = lire('vrm-ui.js'), MOTS = lire('vrm-mots.js'), BADGE = lire('vrm-badge.js'), ACTION = lire('vrm-action.js');
const VERSION = JSON.parse(lire('manifest.json')).version;
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 500) : ''}`); } };
const T0 = Date.now(), MIN = 60000;
const IMG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#c9b8a0"/></svg>');
// ── Les pages inventées ────────────────────────────────────────────────────────
const PAGE = {
  vinted: (nuit) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    body{margin:0;font:15px/1.4 -apple-system,system-ui,sans-serif;background:${nuit ? '#121416' : '#fff'};color:${nuit ? '#e8e8e8' : '#171717'}}
    header{display:flex;align-items:center;gap:16px;height:64px;padding:0 24px;border-bottom:1px solid #8883}
    header b{font-size:26px;color:#007782;font-style:italic} header input{flex:1;max-width:520px;height:40px;border-radius:8px;border:0;background:${nuit ? '#24272a' : '#f2f2f2'};padding:0 12px}
    nav{display:flex;gap:28px;padding:12px 24px;color:${nuit ? '#bbb' : '#555'};border-bottom:1px solid #8882;overflow:hidden;white-space:nowrap}
    main{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:18px;padding:24px}
    .it{border-radius:6px}.it i{display:block;aspect-ratio:3/4;border-radius:6px;background:linear-gradient(160deg,#d9d4cc,#b7aea2)}.it p{margin:6px 0 0;font-size:13px}
    button.vinted{margin:24px;padding:10px 16px;border-radius:6px;border:0;background:#007782;color:#fff;font-size:15px}
  </style></head><body><header><b>Vinted</b><input placeholder="Rechercher des articles"></header><nav>Femmes Hommes Articles de créateurs Enfants Maison Électronique Livres</nav>
  <button class="vinted" id="cible" onclick="window.__clicPage=(window.__clicPage||0)+1">Bouton de la page</button>
  <main>${Array.from({ length: 12 }, (_, i) => `<div class="it"><i></i><p>Article inventé ${i + 1}<br><b>${20 + i},00 €</b></p></div>`).join('')}</main></body></html>`,
  leboncoin: (nuit) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font:15px/1.4 system-ui,sans-serif;background:${nuit ? '#1a1a1a' : '#f4f6f7'};color:${nuit ? '#eee' : '#1a1a1a'}}header{height:64px;display:flex;align-items:center;padding:0 24px;background:${nuit ? '#222' : '#fff'}}header b{color:#ec5a13;font-size:24px}main{padding:24px}</style></head><body><header><b>leboncoin</b></header><main><h2>Mes annonces</h2><p>Page inventée pour le banc.</p></main></body></html>`,
  vestiaire: (nuit) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font:15px/1.4 Georgia,serif;background:${nuit ? '#111' : '#fff'};color:${nuit ? '#eee' : '#111'}}header{height:64px;display:flex;align-items:center;justify-content:center;border-bottom:1px solid #8884;letter-spacing:.2em}main{padding:24px}</style></head><body><header>VESTIAIRE (banc)</header><main><h2>Mes articles</h2></main></body></html>`,
};

// ── Les états (inventés) ───────────────────────────────────────────────────────
const MAJ = { nouvelle: true, servie: '5.406.0', lien: 'https://vrm.center/VRM-Orion.xpi', moteur: 'firefox', origine: 'manuel' };
const baseVinted = (o = {}) => Object.assign({ ok: true, plateforme: 'vinted', capte: true, version: VERSION, code: VERSION, vrm: { ok: true, connecte: true, email: 'banc@exemple.fr', cloisonne: true },
  site: { id: '424242', nom: 'compte_banc', choix: 'oui', jauge: { h: 0, maxH: 50, j: 0, maxJ: 182, complet: true }, favoris: { file: null } },
  flux: { okAt: T0 - MIN }, liens: [], capteCoupe: false, secu: { niveau: 'ok', texte: 'Calme · 0 gestes de VRM aujourd’hui', arrete: false },
  capture: { k: 'ok', n: 0, phrase: 'Bordereaux : tous récupérés', geste: '' }, maj: MAJ }, o);
const ETATS = {
  favorisEnCours: () => { const e = baseVinted(); e.site.favoris.file = { actif: true, total: 15, file: { total: 15, envoyes: 3 }, prochain: T0 + 3 * MIN, quoi: 'ouverture', attente: null }; return e; },
  favorisPret: () => baseVinted({ maj: null }),
  leboncoin: () => ({ ok: true, plateforme: 'leboncoin', capte: true, version: VERSION, code: VERSION, vrm: { ok: true, connecte: true, email: 'banc@exemple.fr' }, site: { id: 'lbc-banc', nom: 'lbc_banc' }, flux: { okAt: T0 - 2 * MIN },
    lbc: { compte: { ok: true, texte: 'Compte Leboncoin : lbc_banc' }, annonces: { ok: true, texte: '24 annonces lues en entier {quand}', at: T0 - 3 * MIN }, ventes: { ok: null, texte: 'Ventes : ouvre « Mes transactions » une fois' } }, secu: { niveau: 'ok', texte: 'Calme', arrete: false } }),
  vestiaire: () => ({ ok: true, plateforme: 'vestiaire', capte: true, version: VERSION, code: VERSION, vrm: { ok: true, connecte: true, email: 'banc@exemple.fr' }, site: { id: '777', nom: 'vc_banc' }, flux: { okAt: T0 - 5 * MIN },
    vcCapte: { annonces: { n: 12, at: T0 - 5 * MIN }, ventes: { n: 3, at: T0 - 5 * MIN } }, secu: { niveau: 'ok', texte: 'Calme', arrete: false } }),
  aConnecter: () => ({ ok: true, plateforme: 'vinted', capte: true, version: VERSION, code: VERSION, vrm: { ok: true, connecte: false }, site: { id: '424242', nom: 'compte_banc', choix: 'oui' }, flux: {} }),
};
const LISTES = { ok: true, compte: { nom: 'compte_banc' }, annonces: { liste: [], total: 0 }, ventes: { liste: [], total: 0 }, autres: [] };

async function page(nav, { site = 'vinted', nuit = false, largeur = 1512, hauteur = 900, mobile = false, reduit = false }) {
  const ctx = await nav.newContext(Object.assign({ colorScheme: nuit ? 'dark' : 'light', reducedMotion: reduit ? 'reduce' : 'no-preference', viewport: { width: largeur, height: hauteur } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await pg.route('**/*', (r) => {
    const u = r.request().url();
    if (/vinted\.net|logo-vrm|\.svg|\.webp|\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: IMG });
    return r.fulfill({ status: 200, contentType: 'text/html', body: PAGE[site](nuit) });
  });
  await pg.goto(site === 'vinted' ? 'https://www.vinted.fr/catalog' : site === 'leboncoin' ? 'https://www.leboncoin.fr/mes-annonces' : 'https://www.vestiairecollective.com/profile');
  return { ctx, pg, erreurs };
}
// Le faux `chrome` (mêmes formes que le vrai : rappels), et les fichiers de l'extension.
async function monter(pg, { etat, apercu = null, action = null, fichiers = ['ui', 'mots', 'badge'], stock0 = null }) {
  await pg.evaluate(({ e, ap, act, L, st0 }) => {
    const copie = (x) => JSON.parse(JSON.stringify(x));
    const ecoutes = []; let stock = Object.assign({ vrmActionEnCours: act || undefined }, st0 || {}); window.__stock = () => copie(stock);
    window.__envoyes = []; window.__etatAction = act;
    window.chrome = {
      runtime: { id: 'ext', lastError: null, getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: e ? e.version : '5.406.0' }),
        sendMessage: (msg, cb) => {
          window.__envoyes.push(copie(msg));
          let rep = { ok: true };
          if (msg.action === 'etat' && msg.from === 'vrm-action') rep = { ok: true, action: window.__etatAction || null };
          else if (msg.action === 'arreter' && msg.from === 'vrm-action') { window.__arrete = (window.__arrete || 0) + 1; if (window.__etatAction) window.__etatAction = Object.assign({}, window.__etatAction, { actif: false, fin: { at: Date.now(), raison: 'arret' } }); rep = { ok: true }; }   // comme le fond (finirActionEnCours)
          else if (msg.action === 'etat') rep = e ? copie(e) : null;
          else if (msg.action === 'carteListes') rep = copie(L);
          else if (msg.action === 'favorisCarte' && msg.quoi === 'lancer') rep = { ok: true, etat: { actif: true } };
          else if (msg.action === 'favorisCarte' && msg.quoi === 'apercu') rep = (window.__apNeuf || ap) ? { ok: true, uid: '424242', apercu: copie(window.__apNeuf || ap) } : { ok: false, raison: 'pas su' };
          else if (msg.action === 'numeros') rep = { ok: true, items: { 9001: '124' } };
          setTimeout(() => cb && cb(rep), 0);
        } },
      i18n: { getUILanguage: () => 'fr', getMessage: () => '' },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb(copie(stock)), 0); return Promise.resolve(copie(stock)); }, set: (o, cb) => { stock = Object.assign(stock, o); if (cb) setTimeout(cb, 0); return Promise.resolve(); } },
        onChanged: { addListener: (f) => ecoutes.push(f) } },
    };
    window.__signal = (ch) => { for (const f of ecoutes) { try { f(ch, 'local'); } catch (_) {} } };
    window.__poserAction = (a) => { window.__etatAction = a; for (const f of ecoutes) f({ vrmActionEnCours: { newValue: a } }, 'local'); };
  }, { e: etat || null, ap: apercu, act: action, L: LISTES, st0: stock0 || null });
  for (const f of fichiers) {
    const src = { ui: UI, mots: MOTS, badge: BADGE, action: ACTION }[f];
    if (!src) continue;
    await pg.evaluate((js) => { const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s); }, src);
  }
  await pg.waitForTimeout(350);
}
// Les shadow roots fermées : le banc les ouvre AVANT les fichiers (sinon rien ne se mesure).
const OUVRIR_OMBRES = () => { const o = Element.prototype.attachShadow; Element.prototype.attachShadow = function (x) { const r = o.call(this, Object.assign({}, x, { mode: 'open' })); this.__ombre = r; return r; }; };
async function ouvrirCarte(pg, mobile) {
  const b = await pg.evaluate(() => { const h = document.getElementById('vrm-badge'); const x = h.shadowRoot.querySelector('.btn').getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  if (mobile) await pg.touchscreen.tap(b.x, b.y); else { await pg.mouse.move(b.x, b.y); await pg.mouse.click(b.x, b.y); }
  await pg.waitForTimeout(450);
}

const FAV = (i) => ({ id: 'n' + i, itemId: String(9000 + i), pseudo: 'acheteur_' + i, titre: 'Paire inventée ' + i, prix: 50, date: new Date(T0 - i * 7 * MIN).toISOString(), photo: 'https://images1.vinted.net/t/banc/' + i + '.webp', envoi: 'a_envoyer', cochable: true, offre: 45, texte: 'Bonjour acheteur_' + i + ' !' });
const APERCU = (n) => { const tous = Array.from({ length: n }, (_, i) => FAV(i + 1)); return { etat: 'pret', total: n, max: 15, totalTous: n, message: { intervalleMinutes: 2, versions: 1, offre: { mode: 'pct', valeur: 10, arrondi: false } }, reglages: { version: 1 }, liste: tous, selection: tous.map((x) => x.id), tous }; };
(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    console.log(`extension ${VERSION} (${EXT})`);
    const { ctx, pg, erreurs } = await page(nav, { largeur: 1512, hauteur: 900 });
    await pg.evaluate(OUVRIR_OMBRES);
    await monter(pg, { etat: ETATS.favorisPret(), apercu: APERCU(3), stock0: { vrmCarteOnglet: 'favoris' } });
    await ouvrirCarte(pg, false);
    await pg.waitForTimeout(500);
    const compter = () => pg.evaluate(() => {
      // Les rangées de favoris, où qu'elles soient dessinées (la carte, ou le grand panneau dans sa propre racine fermée, ouverte par le banc).
      const racines = [document]; for (let i = 0; i < racines.length; i++) for (const el of racines[i].querySelectorAll('*')) if (el.shadowRoot) racines.push(el.shadowRoot);
      const noms = new Set(); for (const r of racines) { const tw = document.createTreeWalker(r, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) { const m = /acheteur_\d+/.exec(n.textContent || ''); if (m && n.parentElement && n.parentElement.getClientRects().length) noms.add(m[0]); } }
      return { n: noms.size, ap: window.__envoyes.filter((m) => m.action === 'favorisCarte' && m.quoi === 'apercu').length };
    });
    const a0 = await compter();
    dit(a0.n === 3, 'la carte ouverte montre les 3 favoris de l’aperçu', JSON.stringify(a0));
    // Le fond vient de lire la liste des notifications de Vinted : VRM connaît maintenant 4 favoris.
    await pg.evaluate((ap) => { window.__apNeuf = ap; window.__signal({ vrmFavorisListeLue: { newValue: { uid: '424242', at: Date.now(), pages: 2 } } }); }, APERCU(4));
    await pg.waitForTimeout(900);
    const a1 = await compter();
    await pg.screenshot({ path: path.join(process.env.BANC_CAPTURES || path.join(__dirname, 'captures'), 'favoris-liste-lue.png') }).catch(() => {});
    dit(a1.ap === a0.ap + 1 && a1.n === 4, 'liste des notifications lue par l’extension ⇒ la carte redemande ses favoris et montre le 4ᵉ, seule, sans attendre la minute', JSON.stringify({ avant: a0, apres: a1 }));
    dit(!erreurs.length, 'aucune erreur de page', erreurs.join(' | '));
    await ctx.close();
  } finally { await nav.close(); }
  console.log(ko ? `\n❌ favoris-liste-lue ${VERSION} : ${ko} rouge(s)` : `\n✅ favoris-liste-lue ${VERSION} : ${ok} vert(s), 0 rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
