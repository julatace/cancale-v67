// ════════════════════════════════════════════════════════════════════════════
//  BANC « TOUTES LES SURFACES DE L'EXTENSION » (5.406, 17 nov.)
//
//  Julien : « fait tout mieux sur l'extension déjà parce qu'elle est horrible ».
//  Chaque surface est dessinée par le VRAI fichier de l'extension, sur une page
//  INVENTÉE qui ressemble à Vinted / Leboncoin / Vestiaire (aucune vraie page, aucune
//  vraie donnée), avec un faux `chrome` qui rend l'état voulu :
//   logo · carte Vinted (favoris en cours = sa capture, aperçu prêt) · carte Leboncoin ·
//   carte Vestiaire · carte « à connecter » · fenêtre de l'icône · écran « action en
//   cours » (plein, réduit, vérification de Vinted, fin) · message bref · bandeau.
//  Il juge (data-* et mesures, jamais un libellé seul) :
//   K. la carte « favoris en cours » : UNE ligne de tête (compte · point · état), UNE ligne
//      principale avec un trait de progression, UN seul plein, la ligne secondaire porte la
//      jauge ; le bandeau de version est FIN (≤ 60 px) et ses étapes REPLIÉES ; les onglets
//      sont UN contrôle segmenté ; « prochain dans » ≤ 6 min avec sa raison ;
//   C. contraste ≥ 4,5:1 de chaque texte de la carte et de l'écran (couleur calculée sur la
//      couleur de fond calculée de l'ancêtre opaque) — clair ET sombre ;
//   G. cibles ≥ 44 px (boutons, liens, onglets) ;
//   O. l'écran plein : présent seulement avec un état actif, couvre la fenêtre, attrape le clic
//      (un clic au milieu n'atteint pas la page), « Réduire » ⇒ pastille et la page reçoit le
//      clic, vérification de Vinted ⇒ l'écran s'écarte et la page reste cliquable ;
//      `prefers-reduced-motion` ⇒ aucune animation ;
//   L. 390, 1280, 1512 px : rien ne déborde de la fenêtre.
//  `BANC_RACINE=<arbre d'avant>` dessine l'ancienne extension (captures « avant »).
//  Captures : BANC_CAPTURES (ou captures/extension-surfaces) — à REGARDER.
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
const SORTIE = process.env.BANC_CAPTURES ? path.resolve(process.env.BANC_CAPTURES) : path.join(__dirname, 'captures', 'extension-surfaces');
const SEULES = (process.argv.find((a) => a.startsWith('--seul=')) || '').slice(7).split(',').filter(Boolean);
const fait = (k) => !SEULES.length || SEULES.includes(k);
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
const APERCU = { etat: 'pret', total: 3, message: { intervalleMinutes: 0, versions: 1 }, reglages: { v: 1 }, nonProuves: 0,
  liste: [0, 1, 2].map((i) => ({ id: 'n' + i, itemId: String(9000 + i), pseudo: 'acheteur_' + (i + 1), titre: ['Baskets cuir blanc 42', 'Running bleu 43', 'Sneakers montantes 41'][i], prix: 40 + i * 5, date: new Date(T0 - (i + 1) * 3600000).toISOString(), photo: PHOTO, texte: 'Bonjour acheteur_' + (i + 1) + ', merci pour le favori !' })) };
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
async function monter(pg, { etat, apercu = null, action = null, fichiers = ['ui', 'mots', 'badge'] }) {
  await pg.evaluate(({ e, ap, act, L }) => {
    const copie = (x) => JSON.parse(JSON.stringify(x));
    const ecoutes = []; let stock = { vrmActionEnCours: act || undefined };
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
          else if (msg.action === 'favorisCarte' && msg.quoi === 'apercu') rep = ap ? { ok: true, uid: '424242', apercu: copie(ap) } : { ok: false, raison: 'pas su' };
          else if (msg.action === 'numeros') rep = { ok: true, items: { 9001: '124' } };
          setTimeout(() => cb && cb(rep), 0);
        } },
      i18n: { getUILanguage: () => 'fr', getMessage: () => '' },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb(copie(stock)), 0); return Promise.resolve(copie(stock)); }, set: (o, cb) => { stock = Object.assign(stock, o); if (cb) setTimeout(cb, 0); return Promise.resolve(); } },
        onChanged: { addListener: (f) => ecoutes.push(f) } },
    };
    window.__poserAction = (a) => { window.__etatAction = a; for (const f of ecoutes) f({ vrmActionEnCours: { newValue: a } }, 'local'); };
  }, { e: etat || null, ap: apercu, act: action, L: LISTES });
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

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const cap = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };
  const neuf = !!UI;
  try {
    // ── 1. La carte Vinted : favoris en cours (sa capture), trois largeurs, clair et sombre ──
    const TAILLES = [[1280, 800, false], [1512, 900, false], [390, 844, true]].filter(([l]) => !process.env.BANC_LARGEURS || process.env.BANC_LARGEURS.split(',').includes(String(l)));
    if (fait('carte')) for (const [largeur, hauteur, mobile] of TAILLES) for (const nuit of [false, true]) {
      const tag = `${largeur}-${nuit ? 'sombre' : 'clair'}`;
      console.log(`\nCarte Vinted · favoris en cours · ${tag}`);
      const { ctx, pg, erreurs } = await page(nav, { nuit, largeur, hauteur, mobile });
      await pg.evaluate(OUVRIR_OMBRES);
      await monter(pg, { etat: ETATS.favorisEnCours() });
      if (largeur === 1280 && !nuit) await cap(pg, 'logo-1280-clair');
      await ouvrirCarte(pg, mobile);
      await cap(pg, `carte-favoris-${tag}`);
      if (neuf) {
        const m = await pg.evaluate(() => {
          const r = document.getElementById('vrm-badge').shadowRoot, q = (s) => r.querySelector(s);
          const vis = (el) => !!(el && el.getClientRects().length);
          const carte = q('.carte'), cr = carte.getBoundingClientRect();
          const maj = q('[data-maj]');
          return {
            tete: !!q('.t5 [data-q4="compte"]') && !!q('.t5 .vu-point') && !!q('.t5 [data-q4="etat"]'),
            principal: !!q('.principal[data-fav="encours"] .vu-barre'), pleins: Array.from(r.querySelectorAll('.carte .vu-plein, .carte .b:not(.sec)')).filter(vis).length,
            sous: !!q('.vu-sous [data-q4="jauge"]'), majH: maj ? Math.round(maj.querySelector('.vu-bandeau').getBoundingClientRect().height) : 0, etapes: q('[data-maj-comment]') ? q('[data-maj-comment]').open : null,
            seg: !!q('.vu-seg[role="tablist"]') && r.querySelectorAll('.vu-seg[role="tablist"] [role="tab"]').length === 3 && r.querySelectorAll('.carte .vu-seg').length === 1 && !!q('.t5 [data-compte-menu]'),
            sousPx: q('.vu-sous') ? parseFloat(getComputedStyle(q('.vu-sous')).fontSize) : 0,
            dans: q('[data-fav-dans]') ? Number(q('[data-fav-dans]').getAttribute('data-fav-dans')) - Date.now() : null, quoi: q('[data-fav-quoi]') ? q('[data-fav-quoi]').getAttribute('data-fav-quoi') : '',
            dedans: cr.left >= 0 && cr.top >= 0 && cr.right <= innerWidth + 0.5 && cr.bottom <= innerHeight + 0.5, debord: document.documentElement.scrollWidth > innerWidth,
          };
        });
        dit(m.tete, 'K · une ligne de tête : compte · point · état');
        dit(m.principal, 'K · une ligne principale avec un trait de progression');
        dit(m.pleins === 1, 'K · un seul plein dans la carte', m.pleins);
        dit(m.sous, 'K · la jauge dans la ligne secondaire');
        dit(m.majH > 0 && m.majH <= 60 && m.etapes === false, 'K · bandeau de version fin, étapes repliées', `${m.majH} px, ouvert=${m.etapes}`);
        dit(m.seg, 'K · UN seul contrôle segmenté (Favoris · Annonces · Ventes) ; le choix du compte est dans la tête (« compte ⌄ »)');
        dit(m.sousPx >= 13, 'K · la ligne d’état secondaire à 13 px au moins', m.sousPx);
        dit(m.dans != null && m.dans <= 6 * MIN && m.quoi === 'ouverture', 'K · « prochain dans » ≤ 6 min, avec sa raison', `${m.dans} ${m.quoi}`);
        dit(m.dedans && !m.debord, 'L · la carte tient dans la fenêtre, rien ne déborde');
        const c = await pg.evaluate(CONTRASTE, 'vrm-badge');
        dit(c.n > 10 && !c.mauvais.length, `C · contraste ≥ 4,5:1 (${c.n} textes)`, JSON.stringify(c.mauvais.slice(0, 6)));
        const g = await pg.evaluate(CIBLES, { hoteId: 'vrm-badge', sel: '.carte button, .carte a[href], .carte summary' });
        dit(!g.length, 'G · cibles ≥ 44 px', JSON.stringify(g.slice(0, 6)));
      }
      dit(!erreurs.length, 'aucune erreur de page', erreurs.join(' | '));
      await ctx.close();
    }
    // ── 2. La carte Vinted : aperçu prêt (Favoris) ────────────────────────────
    if (fait('pret')) for (const nuit of [false, true]) {
      console.log(`\nCarte Vinted · aperçu prêt · ${nuit ? 'sombre' : 'clair'}`);
      const { ctx, pg } = await page(nav, { nuit, largeur: 1512, hauteur: 980 });
      await pg.evaluate(OUVRIR_OMBRES);
      await monter(pg, { etat: ETATS.favorisPret(), apercu: APERCU });
      await ouvrirCarte(pg, false);
      await pg.waitForTimeout(300);
      await cap(pg, `carte-pret-1512-${nuit ? 'sombre' : 'clair'}`);
      if (neuf) {
        const c = await pg.evaluate(CONTRASTE, 'vrm-badge');
        dit(!c.mauvais.length, `C · contraste (${c.n} textes)`, JSON.stringify(c.mauvais.slice(0, 6)));
      }
      await ctx.close();
    }
    // ── 3. Leboncoin, Vestiaire, à connecter ──────────────────────────────────
    if (fait('sites')) for (const [nom, site, etat] of [['leboncoin', 'leboncoin', ETATS.leboncoin()], ['vestiaire', 'vestiaire', ETATS.vestiaire()], ['a-connecter', 'vinted', ETATS.aConnecter()]]) for (const nuit of [false, true]) {
      console.log(`\nCarte ${nom} · ${nuit ? 'sombre' : 'clair'}`);
      const { ctx, pg, erreurs } = await page(nav, { site, nuit, largeur: 1280, hauteur: 860 });
      await pg.evaluate(OUVRIR_OMBRES);
      await monter(pg, { etat });
      await ouvrirCarte(pg, false);
      await pg.waitForTimeout(nom === 'a-connecter' ? 1900 : 200);
      await cap(pg, `carte-${nom}-1280-${nuit ? 'sombre' : 'clair'}`);
      if (neuf) {
        const c = await pg.evaluate(CONTRASTE, 'vrm-badge');
        dit(!c.mauvais.length, `C · contraste (${c.n} textes)`, JSON.stringify(c.mauvais.slice(0, 6)));
        const g = await pg.evaluate(CIBLES, { hoteId: 'vrm-badge', sel: '.carte .b, .carte .vu-btn, .carte .vu-seg button, .carte .fermer' });
        dit(!g.length, 'G · cibles ≥ 44 px', JSON.stringify(g.slice(0, 6)));
      }
      dit(!erreurs.length, 'aucune erreur de page', erreurs.join(' | '));
      await ctx.close();
    }
    // ── 4. L'écran « action en cours » ───────────────────────────────────────
    if (fait('action') && ACTION) for (const [largeur, hauteur, mobile] of [[1512, 900, false], [390, 844, true]]) for (const nuit of [false, true]) {
      const tag = `${largeur}-${nuit ? 'sombre' : 'clair'}`;
      console.log(`\nÉcran « action en cours » · ${tag}`);
      const { ctx, pg, erreurs } = await page(nav, { nuit, largeur, hauteur, mobile });
      await pg.evaluate(OUVRIR_OMBRES);
      await monter(pg, { etat: ETATS.favorisEnCours(), action: null, fichiers: ['ui', 'mots', 'badge', 'action'] });
      const vide = await pg.evaluate(() => { const h = document.getElementById('vrm-action'); return h && getComputedStyle(h).display; });
      dit(vide === 'none', 'O · sans action : rien n’est dessiné', vide);
      const ACT = { v: 1, actif: true, sorte: 'favoris', uid: '424242', fait: 3, total: 15, enCours: false, prochain: Date.now() + 3 * MIN, quoi: 'ouverture', item: { id: '9001', photo: PHOTO, titre: 'Baskets cuir blanc 42' }, suivants: [{ id: '9002', photo: PHOTO, titre: 'Running bleu 43' }, { id: '9003', photo: PHOTO, titre: 'Sneakers montantes 41' }, { id: '9004', photo: PHOTO, titre: 'Mocassins daim 40' }], maj: Date.now() };
      await pg.evaluate((a) => window.__poserAction(a), ACT);
      await pg.waitForTimeout(500);
      await cap(pg, `action-plein-${tag}`);
      const m = await pg.evaluate(() => {
        const r = document.getElementById('vrm-action').shadowRoot, v = r.querySelector('[data-action-plein]');
        if (!v) return null;
        const x = v.getBoundingClientRect(); const el = document.elementFromPoint(innerWidth / 2, 20);
        return { couvre: x.left <= 0 && x.top <= 0 && x.right >= innerWidth && x.bottom >= innerHeight, attrape: el && el.id === 'vrm-action', flou: getComputedStyle(v).backdropFilter || getComputedStyle(v).webkitBackdropFilter || '',
          num: !!r.querySelector('.vu-n[data-num="124"]'), anim: getComputedStyle(v).animationName };
      });
      dit(m && m.couvre && m.attrape, 'O · l’écran couvre la fenêtre et attrape le clic', JSON.stringify(m));
      dit(m && /blur/.test(m.flou), 'O · Vinted flouté derrière', m && m.flou);
      dit(m && m.num, 'O · l’article en cours porte son étiquette N°');
      const g2 = await pg.evaluate(() => { const r = document.getElementById('vrm-action').shadowRoot, b = r.querySelector('.boite').getBoundingClientRect(), p = r.querySelector('.photo img').getBoundingClientRect(); return { w: Math.round(b.width), photo: Math.round(p.width), suiv: r.querySelectorAll('.suiv .mini').length, compteur: parseFloat(getComputedStyle(r.querySelector('.compteur')).fontSize) }; });
      dit(g2.w >= (mobile ? 380 : 560) && g2.photo >= 88 && g2.suiv === 3 && g2.compteur >= 26, 'O · un vrai écran plein : panneau large (feuille au téléphone), photo 96 px, compteur 28 (5.427 : l’échelle du panneau), 3 suivants', JSON.stringify(g2));
      const clics0 = await pg.evaluate(() => window.__clicPage || 0);
      const cb = await pg.evaluate(() => { const b = document.getElementById('cible').getBoundingClientRect(); return { x: b.left + 10, y: b.top + 10 }; });
      if (mobile) await pg.touchscreen.tap(cb.x, cb.y); else await pg.mouse.click(cb.x, cb.y);
      dit((await pg.evaluate(() => window.__clicPage || 0)) === clics0, 'O · un clic sur Vinted n’atteint pas la page pendant l’action');
      const c = await pg.evaluate(CONTRASTE, 'vrm-action');
      dit(c.n > 5 && !c.mauvais.length, `C · contraste (${c.n} textes)`, JSON.stringify(c.mauvais.slice(0, 6)));
      const g = await pg.evaluate(CIBLES, { hoteId: 'vrm-action', sel: 'button' });
      dit(!g.length, 'G · cibles ≥ 44 px', JSON.stringify(g));
      // Réduire ⇒ pastille, la page reçoit le clic.
      await pg.evaluate(() => document.getElementById('vrm-action').shadowRoot.querySelector('[data-reduire]').click());
      await pg.waitForTimeout(300);
      await cap(pg, `action-reduit-${tag}`);
      if (mobile) await pg.touchscreen.tap(cb.x, cb.y); else await pg.mouse.click(cb.x, cb.y);
      dit((await pg.evaluate(() => window.__clicPage || 0)) === clics0 + 1, 'O · « Réduire » : la pastille reste, la page reçoit le clic');
      // Vérification de Vinted ⇒ l'écran s'écarte.
      await pg.evaluate(() => document.getElementById('vrm-action').shadowRoot.querySelector('[data-agrandir]').click());
      await pg.evaluate(() => { const f = document.createElement('iframe'); f.src = 'https://geo.captcha-delivery.com/captcha/?banc=1'; f.style.cssText = 'position:fixed;left:50%;top:50%;width:300px;height:200px;transform:translate(-50%,-50%);border:2px solid #007782;background:#fff'; document.body.appendChild(f); });
      await pg.waitForTimeout(400);
      await cap(pg, `action-captcha-${tag}`);
      const cote = await pg.evaluate(() => { const r = document.getElementById('vrm-action').shadowRoot; return { cote: !!r.querySelector('[data-action-cote="verification"]'), plein: !!r.querySelector('[data-action-plein]') }; });
      const sous = await pg.evaluate(() => { const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return el && el.tagName; });
      dit(cote.cote && !cote.plein && sous === 'IFRAME', 'O · captcha de Vinted : l’écran s’écarte, le dit, le captcha reste visible et touchable', JSON.stringify(cote) + ' ' + sous);
      await pg.evaluate(() => { document.querySelector('iframe').remove(); });
      // Tout arrêter ⇒ dit, puis la fin.
      await pg.waitForTimeout(200);
      await pg.evaluate(() => document.getElementById('vrm-action').shadowRoot.querySelector('[data-arreter]').click());
      await pg.waitForTimeout(250);
      await cap(pg, `action-arrete-${tag}`);
      const ar = await pg.evaluate(() => ({ n: window.__arrete || 0, fin: !!document.getElementById('vrm-action').shadowRoot.querySelector('[data-action-fin="arret"]') }));
      dit(ar.n === 1 && ar.fin, 'O · « Tout arrêter » : la demande part une fois, « Arrêté » est dit', JSON.stringify(ar));
      dit(!erreurs.length, 'aucune erreur de page', erreurs.join(' | '));
      await ctx.close();
    }
    if (fait('action') && ACTION) {
      console.log('\nÉcran « action en cours » · réduire les animations');
      const { ctx, pg } = await page(nav, { reduit: true });
      await pg.evaluate(OUVRIR_OMBRES);
      await monter(pg, { etat: null, action: { v: 1, actif: true, sorte: 'republier', uid: '424242', fait: 2, total: 0, enCours: true, maj: Date.now(), item: { id: '9001', num: '87' } }, fichiers: ['ui', 'action'] });
      await pg.waitForTimeout(300);
      await cap(pg, 'action-republier-1512-clair');
      const anim = await pg.evaluate(() => { const v = document.getElementById('vrm-action').shadowRoot.querySelector('.voile'); return v ? getComputedStyle(v).animationName : 'absent'; });
      dit(anim === 'none', 'O · réduire les animations : aucune animation', anim);
      await ctx.close();
    }
    // ── 5. La fenêtre de l'icône (popup.html), connectée ──────────────────────
    if (fait('popup')) for (const nuit of [false, true]) {
      console.log(`\nFenêtre de l’icône · ${nuit ? 'sombre' : 'clair'}`);
      const ctx = await nav.newContext({ colorScheme: nuit ? 'dark' : 'light', viewport: { width: 360, height: 640 } });
      const pg = await ctx.newPage();
      const html = lire('popup.html').replace('<script src="parcours-popup.js"></script>', '');
      await pg.route('**/*', (r) => { const u = r.request().url();
        if (/vrm-ui\.js/.test(u)) return r.fulfill({ status: 200, contentType: 'text/javascript', body: UI });
        if (/popup\.js/.test(u)) return r.fulfill({ status: 200, contentType: 'text/javascript', body: lire('popup.js') });
        if (/\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(path.join(ICI, 'vinted-sync-extension', 'logo-vrm-96.png')) });
        if (/vrm-badge\.js/.test(u)) return r.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
        return r.fulfill({ status: 200, contentType: 'text/html', body: html.replace('<head>', `<head><script>window.chrome={runtime:{id:'x',lastError:null,getManifest:()=>({version:'${VERSION}'}),getURL:(p)=>p,sendMessage:(m,cb)=>{const r=m.action==='authEtat'?{connecte:false}:m.action==='codeVersion'?{ok:true,code:'${VERSION}'}:m.action==='freshness'?{ok:true,fresh:[]}:{ok:true};setTimeout(()=>cb&&cb(r),0)}},i18n:{getUILanguage:()=>'fr',getMessage:()=>''},storage:{local:{get:(k,cb)=>{cb&&setTimeout(()=>cb({}),0);return Promise.resolve({})},set:(o,cb)=>{cb&&cb();return Promise.resolve()}},onChanged:{addListener(){}}},tabs:{query:(q,cb)=>{cb&&cb([]);return Promise.resolve([])},create(){}}};</script>`) }); });
      await pg.goto('https://ext.test/popup.html');
      await pg.waitForTimeout(600);
      await cap(pg, `popup-${nuit ? 'sombre' : 'clair'}`);
      await ctx.close();
    }
    // ── 6. Message bref et bandeau posés dans la page (Vestiaire) ─────────────
    if (fait('toast')) for (const nuit of [false, true]) {
      console.log(`\nMessage bref et bandeau · ${nuit ? 'sombre' : 'clair'}`);
      const { ctx, pg } = await page(nav, { site: 'vestiaire', nuit, largeur: 1280, hauteur: 700 });
      const src = lire('vc-depot.js');
      const styleAvant = (id) => { const m = new RegExp(`el\\.id = '${id}';\\s*el\\.style\\.cssText = '([^']*)'`).exec(src); return m ? m[1] : ''; };
      await pg.evaluate(({ ui, sT, sB }) => {
        if (ui) { const s = document.createElement('script'); s.textContent = ui; document.documentElement.appendChild(s); }
        const t = document.createElement('div'); t.id = 'vrm-vc-toast'; t.textContent = 'Titre et prix copiés : colle-les dans le formulaire.';
        const b = document.createElement('div'); b.id = 'vrm-vc-b'; b.innerHTML = '📷 <b>3 photos attachées</b><div>Vérifie la catégorie, puis publie.</div><button>Publier</button><button>Fermer</button>';
        if (window.VRM_UI) { window.VRM_UI.habiller(t, 'toast'); window.VRM_UI.habiller(b, 'bandeau'); } else { t.style.cssText = sT; b.style.cssText = sB; }
        document.documentElement.appendChild(t); document.documentElement.appendChild(b);
      }, { ui: UI, sT: styleAvant('vrm-vc-toast'), sB: styleAvant('vrm-vc-b') });
      await pg.waitForTimeout(250);
      await cap(pg, `toast-bandeau-1280-${nuit ? 'sombre' : 'clair'}`);
      await ctx.close();
    }
  } finally { await nav.close(); }
  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s) — captures : ${SORTIE}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ a levé : ' + (e && e.stack || e)); process.exit(1); });
