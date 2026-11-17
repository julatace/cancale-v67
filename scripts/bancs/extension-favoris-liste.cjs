// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA LISTE DES FAVORIS À COCHER » DE LA CARTE (5.407, 17 nov.)
//
//  Julien : « il faut une liste avec les favoris pour pouvoir les sélectionner etc ».
//  Le VRAI vrm-badge.js + vrm-ui.js sur une page INVENTÉE qui ressemble à vinted.fr, faux
//  `chrome` qui rend un aperçu inventé de 120 favoris (déjà contactés, en cours, pas prouvés,
//  libres ; N° en kraft). Aucune vraie donnée. Il juge (data-* et mesures) :
//   F1. la liste : 120 rangées, du plus récent au plus ancien ; chaque rangée a sa case (cible
//       ≥ 44 px), sa photo, son titre, « il y a … » ; un déjà contacté est grisé, sa case
//       inactive, sa raison écrite (« offre déjà envoyée » / « message déjà envoyé ») ;
//   F2. « N cochés », « Tout cocher » (au plus 15) / « Rien », les filtres (une annonce,
//       « pas encore contactés ») ; cocher ne redessine pas la liste (même nœud, < 50 ms) ;
//   F3. le choix survit à un rechargement (chrome.storage.local, par compte) ;
//   F4. « Envoyer à N favoris » ouvre un récapitulatif (par annonce, l'offre, le message, la
//       durée « environ … · 15 par heure maximum ») ; RIEN n'est envoyé avant « Confirmer
//       l'envoi » ; puis l'extension reçoit EXACTEMENT les favoris cochés, `confirme: true` ;
//   C/G/L. contraste ≥ 4,5:1, cibles ≥ 44 px, rien de coupé ni de débordant — 390 (tactile),
//       1280, 1512, clair et sombre. Captures : BANC_CAPTURES (ou captures/extension-favoris-liste).
//  `BANC_RACINE=<arbre d'avant>` dessine l'extension d'avant (la liste n'y est pas : rouge).
// ════════════════════════════════════════════════════════════════════════════
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
const SORTIE = process.env.BANC_CAPTURES ? path.resolve(process.env.BANC_CAPTURES) : path.join(__dirname, 'captures', 'extension-favoris-liste');
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 500) : ''}`); } };
const T0 = Date.now(), MIN = 60000;
const PHOTO = 'https://images1.vinted.net/t/banc/photo.webp';
const IMG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#c9b8a0"/><rect x="14" y="30" width="52" height="22" rx="8" fill="#5a4a3a"/></svg>');

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
          else if (msg.action === 'favorisCarte' && msg.quoi === 'apercu') rep = ap ? { ok: true, uid: '424242', apercu: copie(ap) } : { ok: false, raison: 'pas su' };
          else if (msg.action === 'numeros') rep = { ok: true, items: { 9001: '124' } };
          setTimeout(() => cb && cb(rep), 0);
        } },
      i18n: { getUILanguage: () => 'fr', getMessage: () => '' },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb(copie(stock)), 0); return Promise.resolve(copie(stock)); }, set: (o, cb) => { stock = Object.assign(stock, o); if (cb) setTimeout(cb, 0); return Promise.resolve(); } },
        onChanged: { addListener: (f) => ecoutes.push(f) } },
    };
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
// Contraste : chaque bout de texte visible d'une racine, sa couleur et le fond OPAQUE sous lui
// (couleurs calculées, en remontant jusqu'à un fond opaque ; un dégradé compte par sa couleur unie).
const CONTRASTE = (hoteId) => {
  const h = document.getElementById(hoteId); const r = h && h.shadowRoot; if (!r) return { n: 0, mauvais: [] };
  const rgb = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const melange = (haut, bas) => ({ r: haut.r * haut.a + bas.r * (1 - haut.a), g: haut.g * haut.a + bas.g * (1 - haut.a), b: haut.b * haut.a + bas.b * (1 - haut.a), a: 1 });
  const fondDe = (el) => {
    const pile = [];
    for (let x = el; x; x = x.parentElement || (x.getRootNode && x.getRootNode().host) || null) {
      const cs = getComputedStyle(x); let c = rgb(cs.backgroundColor);
      if ((!c || c.a === 0) && cs.backgroundImage && cs.backgroundImage !== 'none') { const m = /rgba?\([^)]+\)/.exec(cs.backgroundImage); c = m ? rgb(m[0]) : null; }
      if (c && c.a > 0) { pile.push(c); if (c.a >= 0.999) break; }
      if (x === h) break;
    }
    let f = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = pile.length - 1; i >= 0; i--) f = melange(pile[i], f);
    return f;
  };
  const out = [], tw = document.createTreeWalker(r, NodeFilter.SHOW_TEXT); let n;
  while ((n = tw.nextNode())) {
    const t = n.textContent.trim(); const el = n.parentElement; if (!t || !el) continue;
    if (!el.getClientRects().length) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.6 || el.closest('[inert]') || el.closest('summary') && !el.closest('details')) continue;
    if (el.closest('button:disabled')) continue;
    const c = rgb(cs.color); if (!c) continue;
    const f = fondDe(el), cc = melange(c, f);
    const L1 = lum(cc), L2 = lum(f), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const grand = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700);
    out.push({ t: t.slice(0, 40), ratio: Math.round(ratio * 100) / 100, seuil: grand ? 3 : 4.5 });
  }
  return { n: out.length, mauvais: out.filter((x) => x.ratio < x.seuil) };
};
const CIBLES = ({ hoteId, sel }) => {
  const r = document.getElementById(hoteId).shadowRoot;
  return Array.from(r.querySelectorAll(sel)).filter((b) => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden' && !b.closest('[inert]') && !b.closest('details:not([open]) > :not(summary)'))
    .map((b) => { const x = b.getBoundingClientRect(); return { t: (b.innerText || b.getAttribute('aria-label') || b.className).trim().slice(0, 30), h: Math.round(x.height), w: Math.round(x.width) }; })
    .filter((x) => x.h < 44 || x.w < 24);
};


// ── L'aperçu inventé : 120 favoris sur 8 annonces ─────────────────────────────
const TITRES = ['Baskets cuir blanc 42', 'Running bleu nuit 43', 'Sneakers montantes 41', 'Air rétro gris 44', 'Mocassins daim 40', 'Basket toile écrue 38', 'Trail noir 45', 'Tennis vintage 39'];
const NUMS = ['124', 'B230', '87', '', '9', '1032', '56', ''];
const TOUS = Array.from({ length: 250 }, (_, i) => {
  const k = i % 8, envoi = i % 11 === 3 ? 'envoye' : i % 17 === 5 ? 'en_cours' : 'a_envoyer';
  const raison = envoi === 'a_envoyer' && i % 13 === 7 ? 'non_prouve' : '';
  const cochable = envoi === 'a_envoyer' && !raison;
  return { id: 'n' + i, itemId: String(9000 + k), pseudo: 'acheteur_' + (i + 1), titre: TITRES[k], prix: 40 + k * 5, date: new Date(T0 - (i * 37 + 5) * MIN).toISOString(), photo: PHOTO,
    num: NUMS[k] || undefined, envoi, ...(envoi === 'envoye' && i % 2 ? { offreFaite: true } : {}), ...(raison ? { raison } : {}), cochable,
    ...(cochable ? { offre: Math.round((40 + k * 5) * 0.9), texte: 'Bonjour acheteur_' + (i + 1) + ', ça te plaît toujours ? Je te fais une petite offre.' } : {}) };
});
const APERCU = { etat: 'pret', total: TOUS.filter((x) => x.cochable).length, max: 15, totalTous: 250, retires: 4,
  message: { intervalleMinutes: 2, intervalleMaxMinutes: 4, versions: 3, offre: { mode: 'pct', valeur: 10, arrondi: true } }, reglages: { version: 1 },
  liste: TOUS.filter((x) => x.cochable).slice(0, 15), selection: TOUS.filter((x) => x.cochable).slice(0, 15).map((x) => x.id), tous: TOUS };
const LIGNE = (r, id) => r.querySelector(`.fl-l[data-fav-qui="${id}"]`);

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const cap = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };
  const touche = async (pg, mobile, sel) => {
    const b = await pg.evaluate((s) => { const el = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (!el) return null; el.scrollIntoView({ block: 'center' }); const x = el.getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; }, sel);
    if (!b) return false;
    if (mobile) await pg.touchscreen.tap(b.x, b.y); else await pg.mouse.click(b.x, b.y);
    await pg.waitForTimeout(120);
    return true;
  };
  try {
    for (const [largeur, hauteur, mobile] of [[390, 844, true], [1280, 800, false], [1512, 900, false]]) for (const nuit of [false, true]) {
      const tag = `${largeur}-${nuit ? 'sombre' : 'clair'}`;
      console.log(`\nListe des favoris · ${tag}`);
      const { ctx, pg, erreurs } = await page(nav, { nuit, largeur, hauteur, mobile });
      await pg.evaluate(OUVRIR_OMBRES);
      await monter(pg, { etat: ETATS.favorisPret(), apercu: APERCU });
      await ouvrirCarte(pg, mobile);
      await pg.waitForTimeout(400);
      await cap(pg, `liste-${tag}`);
      const m = await pg.evaluate(() => {
        const r = document.getElementById('vrm-badge').shadowRoot, q = (s) => r.querySelector(s);
        const lignes = Array.from(r.querySelectorAll('.fl-l'));
        const dates = lignes.map((l) => Date.parse(l.getAttribute('data-fav-date') || ''));
        const off = lignes.filter((l) => l.hasAttribute('data-fav-off'));
        const cases = lignes.slice(0, 6).map((l) => { const x = l.querySelector('label.fl-case').getBoundingClientRect(); return [Math.round(x.width), Math.round(x.height)]; });
        const coupes = Array.from(r.querySelectorAll('.fl-tete span, .fl-px, .fl-me, .fl-etat, .fl-puce, [data-fav-envoyer], .fl-ti')).filter((el) => el.getClientRects().length && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)).map((el) => el.className + ':' + el.textContent.slice(0, 30));
        const carte = q('.carte').getBoundingClientRect();
        // Le plein « Envoyer à N favoris » est EN VUE à l'ouverture (rien à faire défiler), et rien ne le couvre.
        const env = q('[data-fav-envoyer]'), er = env ? env.getBoundingClientRect() : null;
        const enVue = !!er && er.top >= 0 && er.bottom <= innerHeight && (() => { const x = r.elementFromPoint(er.left + er.width / 2, er.top + er.height / 2); return x === env || env.contains(x); })();
        // Le filtre d'annonce : son texte tient dans la boîte (une liste déroulante ne dit pas qu'elle coupe : on mesure).
        const sel = q('[data-fav-annonce]'), cs = sel ? getComputedStyle(sel) : null;
        const cv = document.createElement('canvas').getContext('2d'); if (cs) cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const selTient = !!sel && cv.measureText(sel.options[sel.selectedIndex].text).width <= sel.clientWidth - parseFloat(cs.paddingLeft) - 26;
        const sb = q('[data-fav-suite]');
        return { enVue, selTient, suite: sb ? Number(sb.getAttribute('data-fav-suite')) : 0, maxTxt: /15 par heure maximum/.test((q('[data-fav-max]') || {}).textContent || ''), n: lignes.length, vue: q('[data-fav-vue]') && q('[data-fav-vue]').getAttribute('data-fav-vue'), trie: dates.every((d, i) => isFinite(d) && (i === 0 || dates[i - 1] >= d)),
          offOk: off.length > 0 && off.every((l) => l.querySelector('input').disabled && (l.querySelector('.fl-etat') || {}).textContent),
          offreTxt: !!lignes.find((l) => l.getAttribute('data-fav-envoi') === 'envoye' && /offre/.test((l.querySelector('.fl-etat') || {}).textContent || '')),
          msgTxt: !!lignes.find((l) => l.getAttribute('data-fav-envoi') === 'envoye' && /message/.test((l.querySelector('.fl-etat') || {}).textContent || '')),
          kraft: r.querySelectorAll('.fl-photo .vu-n').length, photos: r.querySelectorAll('.fl-photo img').length, quand: lignes.slice(0, 5).every((l) => /il y a|instant/.test(l.querySelector('.fl-me').textContent)),
          coches: Number(q('[data-fav-coches]') && q('[data-fav-coches]').getAttribute('data-fav-coches')), bouton: q('[data-fav-envoyer]') ? q('[data-fav-envoyer]').textContent : '',
          cases, coupes, dedans: carte.left >= 0 && carte.right <= innerWidth + 0.5 && carte.bottom <= innerHeight + 0.5, debord: document.documentElement.scrollWidth > innerWidth,
          pleins: Array.from(r.querySelectorAll('.carte .vu-plein, .carte .b:not(.sec)')).filter((el) => el.getClientRects().length).length };
      });
      console.log(`     mesuré : ${m.n} rangées · ${m.coches} cochés · « ${m.bouton} » · ${m.kraft} étiquettes N° · cases ${JSON.stringify(m.cases.slice(0, 2))}`);
      dit(m.vue === 'liste' && m.n === 100 && m.suite === 100, 'F1 · la liste : les 100 plus récents, puis « Voir les 100 suivants »', `${m.vue} ${m.n} ${m.suite}`);
      dit(m.maxTxt, 'F2 · la raison du plafond à côté du compteur : « 15 par heure maximum »');
      dit(m.trie, 'F1 · du plus récent au plus ancien');
      dit(m.photos >= 100 && m.kraft > 0 && m.quand, 'F1 · photo, étiquette N° en kraft, « il y a … »', `${m.photos} ${m.kraft} ${m.quand}`);
      dit(m.offOk && m.offreTxt && m.msgTxt, 'F1 · déjà contactés : case inactive, raison écrite (« offre déjà envoyée » / « message déjà envoyé »)');
      dit(m.cases.length && m.cases.every(([w, h]) => w >= 44 && h >= 44), 'G · chaque case : cible ≥ 44 × 44 px', JSON.stringify(m.cases));
      dit(m.coches === 15 && /15/.test(m.bouton), 'F2 · par défaut : les 15 plus récents qu’on peut contacter, « Envoyer à 15 favoris »', `${m.coches} « ${m.bouton} »`);
      dit(m.pleins === 1, 'un seul plein dans la carte', m.pleins);
      dit(!m.coupes.length, 'L · rien de coupé (compteur, prix, qui, état, titre, boutons)', JSON.stringify(m.coupes.slice(0, 6)));
      dit(m.dedans && !m.debord, 'L · la carte tient dans la fenêtre, rien ne déborde');
      dit(m.enVue, 'L · « Envoyer à N favoris » en vue à l’ouverture, rien ne le couvre');
      dit(m.selTient, 'L · « Toutes les annonces » tient dans le filtre (pas coupé)');
      const c = await pg.evaluate(CONTRASTE, 'vrm-badge');
      dit(c.n > 40 && !c.mauvais.length, `C · contraste ≥ 4,5:1 (${c.n} textes)`, JSON.stringify(c.mauvais.slice(0, 6)));
      const g = await pg.evaluate(CIBLES, { hoteId: 'vrm-badge', sel: '.carte button, .carte select, .carte a[href]' });
      dit(!g.length, 'G · boutons, filtres, liens ≥ 44 px', JSON.stringify(g.slice(0, 6)));
      // ── Les gestes : à 390 (doigt) et 1512 clair ─────────────────────────────
      if (!nuit && largeur !== 1280) {
        await touche(pg, mobile, '[data-fav-tout="aucun"]');
        const zero = await pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; return { n: r.querySelector('[data-fav-coches]').getAttribute('data-fav-coches'), dis: r.querySelector('[data-fav-envoyer]').disabled }; });
        dit(zero.n === '0' && zero.dis, 'F2 · « Rien » : 0 coché, « Envoyer » inactif', JSON.stringify(zero));
        const avant = await pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; window.__liste = r.querySelector('.fl-liste'); return true; });
        const choix = TOUS.filter((x) => x.cochable).slice(2, 5).map((x) => x.id);
        const t = [];
        for (const id of choix) { const t0 = Date.now(); await touche(pg, mobile, `.fl-l[data-fav-qui="${id}"] .fl-ti`); t.push(Date.now() - t0); }
        const dur = await pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; const t0 = performance.now(); const c = r.querySelector('.fl-l:not([data-fav-off]) input'); c.click(); c.click(); return performance.now() - t0; });
        const trois = await pg.evaluate((ids) => { const r = document.getElementById('vrm-badge').shadowRoot; return { n: r.querySelector('[data-fav-coches]').getAttribute('data-fav-coches'), b: r.querySelector('[data-fav-envoyer]').textContent, meme: r.querySelector('.fl-liste') === window.__liste, ok: ids.every((id) => r.querySelector(`[data-fav-coche="${id}"]`).checked) }; }, choix);
        dit(trois.n === '3' && /3/.test(trois.b) && trois.ok, 'F2 · trois favoris touchés (la rangée entière) : « 3 cochés », « Envoyer à 3 favoris »', JSON.stringify(trois));
        dit(trois.meme && dur < 50, `F2 · cocher ne redessine pas la liste de 120 (même nœud ; deux cases en ${dur.toFixed(1)} ms)`, JSON.stringify({ meme: trois.meme, dur }));
        // Un déjà contacté ne se coche pas.
        const offId = TOUS.find((x) => x.envoi === 'envoye').id;
        await touche(pg, mobile, `.fl-l[data-fav-qui="${offId}"] .fl-ti`);
        const off = await pg.evaluate((id) => document.getElementById('vrm-badge').shadowRoot.querySelector(`[data-fav-coche="${id}"]`).checked, offId);
        dit(off === false, 'F2 · toucher un favori déjà contacté ne le coche pas');
        // Filtres.
        await touche(pg, mobile, '[data-fav-nouveaux]');
        const nouv = await pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; const l = Array.from(r.querySelectorAll('.fl-l')); return { n: l.length, tous: l.every((x) => x.getAttribute('data-fav-envoi') === 'a_envoyer'), coches: r.querySelector('[data-fav-coches]').getAttribute('data-fav-coches') }; });
        dit(nouv.n > 0 && nouv.n <= 100 && nouv.tous && nouv.coches === '3', '« Pas encore contactés » : seulement eux, le choix gardé', JSON.stringify(nouv));
        await touche(pg, mobile, '[data-fav-nouveaux]');
        await pg.evaluate(() => { const s = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-fav-annonce]'); s.value = '9002'; s.dispatchEvent(new Event('change')); });
        await pg.waitForTimeout(150);
        const ann = await pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; const l = Array.from(r.querySelectorAll('.fl-l')); return { n: l.length, une: l.every((x) => x.getAttribute('data-fav-item') === '9002') }; });
        dit(ann.n === TOUS.filter((x) => x.itemId === '9002').length && ann.une, 'F2 · filtre « une annonce » : ses favoris seulement', JSON.stringify(ann));
        if (!mobile) await cap(pg, `filtre-${tag}`);
        await touche(pg, mobile, '[data-fav-tout="aucun"]');
        await touche(pg, mobile, '[data-fav-tout="tous"]');
        const tt = await pg.evaluate(() => document.getElementById('vrm-badge').shadowRoot.querySelector('[data-fav-coches]').getAttribute('data-fav-coches'));
        const nAnn = TOUS.filter((x) => x.itemId === '9002' && x.cochable).length;
        dit(Number(tt) === nAnn, `F2 · « Tout cocher » sur le filtre : chacun de ses favoris qu’on peut contacter (${tt})`, `${tt}/${nAnn}`);
        await touche(pg, mobile, '[data-fav-tout="aucun"]');
        await pg.evaluate(() => { const s = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-fav-annonce]'); s.value = ''; s.dispatchEvent(new Event('change')); });
        await pg.waitForTimeout(150);
        for (const id of choix) await touche(pg, mobile, `.fl-l[data-fav-qui="${id}"] .fl-ti`);
        await pg.waitForTimeout(300);
        // F3 : le choix survit à un rechargement (une page neuve, le même stockage).
        const stock = await pg.evaluate(() => window.__stock());
        const sel = stock.vrmFavSelection && stock.vrmFavSelection['424242'];
        dit(!!sel && JSON.stringify(sel.ids.slice().sort()) === JSON.stringify(choix.slice().sort()), 'F3 · le choix est rangé PAR COMPTE dans chrome.storage.local', JSON.stringify(sel));
        {
          const p2 = await page(nav, { nuit, largeur, hauteur, mobile });
          await p2.pg.evaluate(OUVRIR_OMBRES);
          await monter(p2.pg, { etat: ETATS.favorisPret(), apercu: APERCU, stock0: { vrmFavSelection: stock.vrmFavSelection } });
          await ouvrirCarte(p2.pg, mobile); await p2.pg.waitForTimeout(400);
          const re = await p2.pg.evaluate((ids) => { const r = document.getElementById('vrm-badge').shadowRoot; return { n: r.querySelector('[data-fav-coches]').getAttribute('data-fav-coches'), ok: ids.every((id) => r.querySelector(`[data-fav-coche="${id}"]`).checked) }; }, choix);
          dit(re.n === '3' && re.ok, 'F3 · après rechargement : les mêmes 3 favoris cochés', JSON.stringify(re));
          await p2.ctx.close();
        }
        // F4 : le récapitulatif, puis « Confirmer l'envoi ».
        await touche(pg, mobile, '[data-fav-envoyer]');
        await pg.waitForTimeout(250);
        await cap(pg, `recap-${tag}`);
        const rc = await pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot, q = (s) => r.querySelector(s);
          return { vue: q('[data-fav-vue]') && q('[data-fav-vue]').getAttribute('data-fav-vue'), annonces: r.querySelectorAll('[data-fav-recap-item]').length, duree: q('[data-fav-duree]') ? q('[data-fav-duree]').textContent : '', ms: q('[data-fav-duree]') ? Number(q('[data-fav-duree]').getAttribute('data-fav-duree')) : 0,
            msg: q('[data-fav-message]') ? q('[data-fav-message]').textContent : '', offre: q('[data-fav-offre]') ? q('[data-fav-offre]').textContent : '', lances: window.__envoyes.filter((m) => m.quoi === 'lancer').length,
            coupes: Array.from(r.querySelectorAll('.fl-recap .fl-ti, .fl-recap .fl-me, .fl-recap .fl-px, .fl-duree, [data-fav-lancer]')).filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1).map((el) => el.className) }; });
        console.log(`     récapitulatif : ${rc.annonces} annonce(s) · « ${rc.duree} » · « ${rc.offre} »`);
        dit(rc.vue === 'recap' && rc.annonces >= 1 && /acheteur_/.test(rc.msg) && /−10 %/.test(rc.offre), 'F4 · récapitulatif : par annonce, l’offre, le message', JSON.stringify(rc).slice(0, 300));
        dit(/15 par heure maximum/.test(rc.duree) && /Environ \d/.test(rc.duree) && rc.ms >= 60000 && rc.ms < 3600000, 'F4 · la durée au vrai rythme (« Environ … · 15 par heure maximum »)', rc.duree);
        dit(rc.lances === 0, 'F4 · rien n’est envoyé avant « Confirmer l’envoi »', rc.lances);
        dit(!rc.coupes.length, 'L · récapitulatif : rien de coupé', JSON.stringify(rc.coupes));
        const c2 = await pg.evaluate(CONTRASTE, 'vrm-badge');
        dit(!c2.mauvais.length, `C · récapitulatif : contraste (${c2.n} textes)`, JSON.stringify(c2.mauvais.slice(0, 6)));
        const g2 = await pg.evaluate(CIBLES, { hoteId: 'vrm-badge', sel: '.carte button, .carte a[href]' });
        dit(!g2.length, 'G · récapitulatif : cibles ≥ 44 px', JSON.stringify(g2.slice(0, 6)));
        await touche(pg, mobile, '[data-fav-lancer]');
        await pg.waitForTimeout(250);
        const l = await pg.evaluate(() => window.__envoyes.filter((m) => m.quoi === 'lancer'));
        dit(l.length === 1 && l[0].confirme === true && JSON.stringify(l[0].selection.slice().sort()) === JSON.stringify(choix.slice().sort()) && l[0].items.length === 3,
          'F4 · « Confirmer l’envoi » : l’extension reçoit EXACTEMENT les 3 favoris cochés, confirmés', JSON.stringify(l).slice(0, 300));
        // F5 : rien hors d'atteinte — « Voir les 100 suivants » jusqu'au dernier.
        {
          const p3 = await page(nav, { nuit, largeur, hauteur, mobile });
          await p3.pg.evaluate(OUVRIR_OMBRES);
          await monter(p3.pg, { etat: ETATS.favorisPret(), apercu: APERCU });
          await ouvrirCarte(p3.pg, mobile); await p3.pg.waitForTimeout(400);
          await touche(p3.pg, mobile, '[data-fav-suite]'); await p3.pg.waitForTimeout(200);
          await touche(p3.pg, mobile, '[data-fav-suite]'); await p3.pg.waitForTimeout(200);
          const tout = await p3.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; return { n: r.querySelectorAll('.fl-l').length, suite: !!r.querySelector('[data-fav-suite]'), dernier: !!r.querySelector('.fl-l[data-fav-qui="n249"]') }; });
          dit(tout.n === 250 && !tout.suite && tout.dernier, 'F5 · « Voir les suivants » : les 250 favoris atteignables, le plus ancien compris', JSON.stringify(tout));
          // F6 : 15 par heure — « Tout cocher » (plus de 15) ⇒ « Envoyer à 15 favoris », les autres restent cochés ;
          // après l'envoi, « Envoyer les 15 suivants à HH:MM » (attend l'heure).
          await touche(p3.pg, mobile, '[data-fav-tout="tous"]');
          const avant = await p3.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; return { n: Number(r.querySelector('[data-fav-coches]').getAttribute('data-fav-coches')), b: r.querySelector('[data-fav-envoyer]').textContent, dis: r.querySelector('[data-fav-envoyer]').disabled, note: r.querySelector('[data-fav-note]').textContent }; });
          const nCoch = TOUS.filter((x) => x.cochable).length;
          dit(avant.n === nCoch && /Envoyer à 15 favoris/.test(avant.b) && !avant.dis && new RegExp(`Les ${nCoch - 15} autres restent cochés`).test(avant.note), `F6 · ${nCoch} cochés ⇒ « Envoyer à 15 favoris », les ${nCoch - 15} autres restent cochés (dit)`, JSON.stringify(avant));
          await touche(p3.pg, mobile, '[data-fav-envoyer]'); await p3.pg.waitForTimeout(250);
          await touche(p3.pg, mobile, '[data-fav-lancer]'); await p3.pg.waitForTimeout(700);
          const apres = await p3.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; const l = window.__envoyes.filter((m) => m.quoi === 'lancer'); const b = r.querySelector('[data-fav-envoyer]'); return { lances: l.map((x) => x.selection.length), n: Number((r.querySelector('[data-fav-coches]') || {}).getAttribute && r.querySelector('[data-fav-coches]').getAttribute('data-fav-coches')), b: b ? b.textContent : '', dis: b ? b.disabled : null, a: b ? Number(b.getAttribute('data-fav-a')) : 0 }; });
          dit(apres.lances.length === 1 && apres.lances[0] === 15, 'F6 · l’envoi part avec 15 favoris (le plafond, gardé)', JSON.stringify(apres.lances));
          dit(apres.n === nCoch - 15 && /Envoyer les 15 suivants à \d{2}:\d{2}/.test(apres.b) && apres.dis === true && apres.a > Date.now() + 55 * MIN, 'F6 · les autres restent cochés ; « Envoyer les 15 suivants à HH:MM » attend l’heure', JSON.stringify(apres));
          await cap(p3.pg, `suivants-${tag}`);
          await p3.ctx.close();
        }
      }
      dit(!erreurs.length, 'aucune erreur de page', erreurs.join(' | '));
      await ctx.close();
    }
    // Le récapitulatif en sombre (capture à regarder), 1512 et 390.
    for (const [largeur, hauteur, mobile] of [[1512, 900, false], [390, 844, true]]) {
      const { ctx, pg } = await page(nav, { nuit: true, largeur, hauteur, mobile });
      await pg.evaluate(OUVRIR_OMBRES);
      await monter(pg, { etat: ETATS.favorisPret(), apercu: APERCU });
      await ouvrirCarte(pg, mobile); await pg.waitForTimeout(400);
      await touche(pg, mobile, '[data-fav-envoyer]'); await pg.waitForTimeout(250);
      await cap(pg, `recap-${largeur}-sombre`);
      const c = await pg.evaluate(CONTRASTE, 'vrm-badge');
      dit(!c.mauvais.length, `C · récapitulatif sombre ${largeur} : contraste (${c.n} textes)`, JSON.stringify(c.mauvais.slice(0, 6)));
      await ctx.close();
    }
  } finally { await nav.close(); }
  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s) · captures : ${SORTIE}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ a levé : ' + (e && e.stack || e)); process.exit(1); });
