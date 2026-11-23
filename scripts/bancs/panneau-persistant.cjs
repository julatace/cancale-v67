// ════════════════════════════════════════════════════════════════════════
//  BANC « LE PANNEAU RESTE OUVERT » + « LE BORDEREAU ET LE LIVREUR » (20 nov., ext. 5.410.2)
//
//  Julien, 20 nov. : « Parfois l'extension se ferme toute seule sur Vinted. » Puis : « Quand j'ai fait une vente,
//  on doit pouvoir imprimer le bordereau, avoir le livreur. » Et : « je ne comprends pas ce qu'est le statut
//  "à confirmer" sur l'extension, ça veut rien dire ».
//
//  Le VRAI vrm-badge.js + vrm-ui.js, posés à CHAQUE chargement de page (comme un script de contenu), dans des
//  pages vinted.fr. Le message `panneauEtat` est servi par le VRAI background.js (scripts/_fond-vm.cjs) : son
//  `chrome.storage.session` vit hors de la page ; « tuer le service worker » = jeter ce `vm` et en refaire un
//  neuf sur les MÊMES stockages (§4.9 : rien en mémoire de module). Le reste du fond est simulé (état, listes).
//  On joue, 1512 px à la souris et 390 px au doigt, clair :
//   1. le panneau ouvert sur Commandes, défilé, une vente cochée ;
//   2. la PAGE retire l'hôte (Next.js qui refait le document) ⇒ il revient, ouvert, même page, même défilement ;
//   3. navigation SPA (pushState + nouveau <body>) ⇒ toujours ouvert ;
//   4. service worker tué puis navigation PLEINE (le script repart de zéro) ⇒ rouvert, même page, sélection,
//      défilement ;
//   5. changement d'onglet (un autre onglet devant, puis retour) ⇒ toujours ouvert ;
//   6. souris qui sort de la fenêtre, toucher/clic sur le voile hors du panneau ⇒ toujours ouvert ;
//   7. son × ⇒ fermé, et une page rechargée ne le rouvre pas ;
//   8. Commandes : logo + nom du transporteur, n° de suivi, date limite, « Imprimer le bordereau » (le PDF du fond
//      téléchargé / ouvert), « Pas encore de bordereau », « Imprimer les 2 bordereaux » ; Accueil : la vente captée
//      dit son livreur et s'imprime ;
//   9. Articles : jamais « à confirmer » dans un texte visible ; « Pas revue depuis 3 j » et UNE phrase de geste.
//  `BANC_EXT=<arbre d'avant>/vinted-sync-extension` : la 5.410.1 (rouge attendu). Tout est inventé (dépôt public).
// ════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { faireFond } = require('../_fond-vm.cjs');

const RACINE = path.join(__dirname, '..', '..');
const EXT = process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension');
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const UI = fs.existsSync(path.join(EXT, 'vrm-ui.js')) ? fs.readFileSync(path.join(EXT, 'vrm-ui.js'), 'utf8') : '';
const FOND = path.join(EXT, 'background.js');
const LOGO = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'logo-vrm-96.png'));
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'panneau-persistant') : path.join(__dirname, 'captures', 'panneau-persistant');

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 300) : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${String(e && e.message).slice(0, 220)}`); return null; } };

const MIN = 60000, H = 3600000, J = 86400000, T0 = Date.now();
const MODELES = ['Nike Air Max 90 blanches', 'Adidas Samba OG noires', 'New Balance 550 crème', 'Puma Suede bleues', 'Asics Gel-Kayano 14 argent', 'Nike Dunk Low Panda'];
const img = (c) => `https://images1.vinted.net/banc/${c}.jpg`;
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO4eechAAUoApeWrujeAAAAAElFTkSuQmCC', 'base64');
const PDF_B64 = Buffer.from('%PDF-1.4\n% bordereau de banc, invente\n' + 'x'.repeat(200) + '\n%%EOF').toString('base64');
const STATUTS = ['en_vente', 'a_confirmer', 'a_confirmer', 'brouillon', 'en_vente', 'a_confirmer'];
const TOUTES = Array.from({ length: 6 }, (_, i) => ({ id: String(7000 + i), titre: `${MODELES[i]} ${39 + i}`, prix: 55 + i * 5, photo: img('a' + i), num: String(120 + i), jours: 3 + i, favoris: i, vues: 10 + i, statut: STATUTS[i] }));
// 24 ventes : assez pour que la liste DÉFILE (le défilement doit revenir au même endroit).
const VEN = Array.from({ length: 24 }, (_, i) => ({ tx: String(91000000000 + i), conv: String(80000 + i), titre: `${MODELES[i % 6]} ${40 + (i % 5)}`, prix: 60 + i, photo: img('v' + i), date: T0 - i * 5 * H,
  etat: i < 3 ? 'a_expedier' : i < 6 ? 'en_route' : 'finalisee', vendue: true, num: String(200 + i), bordereau: i < 2 ? true : i === 2 ? false : null, statutVinted: i < 3 ? 'Envoie le colis' : 'Commande finalisée' }));
VEN[0].transporteur = 'Mondial Relay'; VEN[0].transporteurCle = 'mondialrelay'; VEN[0].suivi = 'MR12345678'; VEN[0].limite = '23/11/2026 10 h 00';
VEN[1].transporteur = 'Chronopost'; VEN[1].transporteurCle = 'chronopost'; VEN[1].suivi = 'XY987654321FR'; VEN[1].limite = '24/11/2026 12 h 00';
const LISTES = { ok: true, plateforme: 'vinted', compte: { id: '111', nom: 'shop_sophie' },
  annonces: { lu: T0 - 3 * J - H, aConfirmer: false, relecture: false, total: 2, liste: TOUTES.filter((x) => x.statut === 'en_vente'), toutes: TOUTES, nTous: TOUTES.length, statuts: { en_vente: 2, brouillon: 1, masque: 0, reserve: 0, vendu: 0, a_confirmer: 3 } },
  ventes: { lu: T0 - 10 * MIN, total: VEN.length, liste: VEN },
  messages: { lu: T0 - 5 * MIN, liste: [{ conv: '60000', qui: 'acheteuse_0', texte: 'Bonjour', at: T0 - H, nonlu: true }] },
  notifications: { vu: T0 - 3 * H, liste: [{ p: 'vinted', c: '111', s: 'ventes', id: VEN[0].tx, t: T0 - H }, { p: 'vinted', c: '111', s: 'messages', id: '60000@x', t: T0 - 2 * H }] },
  automatisations: { offres: { actif: false, minis: 0, refus: false }, favoris: { regle: false, versions: 0, rythme: 'normal', textes: [], auto: { actif: false } }, paliers: { actif: false, paliers: [], remiseMax: null, messages: 0 }, baisse: { actif: false, pct: null, jours: null } }, autres: null };
const ETAT = { ok: true, plateforme: 'vinted', capte: true, version: '5.410.2', code: '5.410.2', vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true },
  site: { id: '111', nom: 'shop_sophie', choix: 'oui', jauge: { h: 3, maxH: 50, j: 9, maxJ: 200, complet: true } }, toutArrete: false, flux: { okAt: T0 - 3 * MIN }, liens: [], capteCoupe: false };

// ── Le fond : le VRAI background.js pour `panneauEtat` (stockages gardés hors du vm), un faux pour le reste.
const stores = { local: {}, session: {} };
let fond = null, fondNo = 0, fondMuet = false;
function nouveauFond() {
  const f = faireFond({ src: FOND, store: stores.local, onglets: [{ id: 7, url: 'https://www.vinted.fr/catalog', status: 'complete' }] });
  const S = stores.session;
  f.ctx.chrome.storage.session = {
    get(k, cb) { const cles = Array.isArray(k) ? k : typeof k === 'string' ? [k] : Object.keys(k || {}); const out = {}; for (const c of cles) if (S[c] !== undefined) out[c] = JSON.parse(JSON.stringify(S[c])); if (typeof cb === 'function') { cb(out); return; } return Promise.resolve(out); },
    set(o, cb) { Object.assign(S, JSON.parse(JSON.stringify(o))); if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
    remove(k, cb) { for (const c of [].concat(k)) delete S[c]; if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
  };
  fondNo++;
  return f;
}
const recus = [];
async function repondre(msg, url, tabId) {
  recus.push(msg);
  if (fondMuet) return { __erreur: 'Could not establish connection. Receiving end does not exist.' };
  if (msg.action === 'panneauEtat') { const r = await fond.envoyer(msg, { tab: { id: tabId, url }, frameId: 0, url }); return r === undefined ? { __erreur: 'muet' } : r; }
  if (msg.action === 'etat') return ETAT;
  if (msg.action === 'carteListes') return LISTES;
  if (msg.action === 'capteLot') return { ok: true, lot: null };
  if (msg.action === 'bordereauCarte') { const txs = msg.txs || []; return { ok: true, pdfs: txs.filter((t) => VEN.find((v) => v.tx === t && v.bordereau === true)).map((tx) => ({ tx, b64: PDF_B64, source: 'vinted' })), manque: txs.filter((t) => !VEN.find((v) => v.tx === t && v.bordereau === true)), passu: [] }; }
  return { ok: true };
}

const INIT = ({ js, ui }) => {
  if (window.top !== window) return;
  window.__ouverts = []; window.__telecharges = [];
  window.open = (u) => { window.__ouverts.push(String(u)); return null; };
  const clicVrai = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__telecharges.push({ nom: this.download, href: String(this.href).slice(0, 5) }); return; } return clicVrai.call(this); };
  const orig = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
  const rt = { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: '5.410.2' }), lastError: null,
    sendMessage: (msg, cb) => { window.__fond(JSON.parse(JSON.stringify(msg)), location.href).then((r) => { if (r && r.__erreur) { rt.lastError = { message: r.__erreur }; try { cb && cb(undefined); } finally { rt.lastError = null; } return; } cb && cb(r); }); } };
  window.chrome = { runtime: rt,
    storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener() {} } } };
  const poser = () => {
    if (ui) { const u = document.createElement('script'); u.textContent = ui; document.documentElement.appendChild(u); }
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poser, { once: true }); else poser();
};

const PAGE = (titre) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${titre}</title></head><body style="margin:0;background:#fff;font-family:sans-serif"><main id="__next"><h1>${titre}</h1>${'<p>Vinted (page de banc).</p>'.repeat(40)}</main></body></html>`;

const lire = (pg) => pg.evaluate(() => {
  const h = document.getElementById('vrm-badge');
  if (!h) return { hote: false };
  const r = h.shadowRoot, q = (s) => r.querySelector(s);
  const carte = q('.carte');
  const vis = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none');
  const corps = q('.corps6');
  return { hote: true, branche: h.isConnected, on: !!(carte && carte.classList.contains('on')), grand: !!(carte && carte.hasAttribute('data-grand')),
    page: q('[data-vx]') ? q('[data-vx]').getAttribute('data-page') : null, defil: corps ? Math.round(corps.scrollTop) : null,
    coches: Array.from(r.querySelectorAll('[data-ven-sel]')).filter((c) => c.checked).map((c) => c.getAttribute('data-ven-sel')),
    visible: carte && vis(carte) ? carte.innerText : '',
    logos: Array.from(r.querySelectorAll('.table6 [data-vente]')).length ? r.querySelectorAll('.table6 .cel6[data-col="transporteur"] svg, .table6 .cel6[data-col="transporteur"] img').length : 0,
    suivis: Array.from(r.querySelectorAll('.table6 [data-suivi]')).map((x) => x.getAttribute('data-suivi')),
    limites: r.querySelectorAll('.table6 [data-limite]').length,
    imprimer: Array.from(r.querySelectorAll('.table6 [data-imprimer]')).filter(vis).map((b) => b.getAttribute('data-imprimer')),
    manque: Array.from(r.querySelectorAll('.table6 [data-bordereau-manque]')).map((b) => b.getAttribute('data-bordereau-manque')),
    impN: q('[data-imprimer-n]') ? { txs: q('[data-imprimer-n]').getAttribute('data-imprimer-n'), texte: q('[data-imprimer-n]').innerText } : null,
    impEtat: q('[data-imp-etat]') ? q('[data-imp-etat]').innerText : '',
    accVente: Array.from(r.querySelectorAll('[data-accueil-vente]')).map((x) => ({ tx: x.getAttribute('data-accueil-vente'), logo: !!x.querySelector('.tr-l6 svg, .tr-l6 img'), suivi: !!x.querySelector('[data-suivi]'), imp: !!x.querySelector('[data-imprimer]') })),
    revue: Array.from(r.querySelectorAll('[data-pas-revue]')).filter(vis).length,
    petitsImp: Array.from(r.querySelectorAll('[data-imprimer],[data-imprimer-n]')).filter(vis).filter((b) => b.offsetHeight < 44).length,
    telecharges: window.__telecharges, ouverts: window.__ouverts };
});
const clic = async (pg, sel) => { await pg.evaluate((s) => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (b) b.click(); }, sel); await pg.waitForTimeout(250); };
const ouvrirPanneau = async (pg, mobile) => {
  const b = await pg.evaluate(() => { const x = document.getElementById('vrm-badge').shadowRoot.querySelector('.btn').getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  if (mobile) await pg.touchscreen.tap(b.x, b.y); else { await pg.mouse.move(b.x, b.y); await pg.mouse.click(b.x, b.y); }
  await pg.waitForTimeout(500);
};
const defiler = (pg, y) => pg.evaluate((y) => { const c = document.getElementById('vrm-badge').shadowRoot.querySelector('.corps6'); if (c) { c.scrollTop = y; c.dispatchEvent(new Event('scroll')); } }, y);
const cocher = (pg, tx) => pg.evaluate((tx) => { const c = document.getElementById('vrm-badge').shadowRoot.querySelector(`[data-ven-sel="${tx}"]`); if (c) { c.checked = true; c.dispatchEvent(new Event('change')); } }, tx);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const cap = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };
  try {
    for (const [largeur, hauteur, mobile] of [[1512, 900, false], [390, 844, true]]) {
      const T = `${largeur}`;
      console.log(`\n${T} ${mobile ? 'doigt' : 'souris'}`);
      for (const k of Object.keys(stores.local)) delete stores.local[k];
      for (const k of Object.keys(stores.session)) delete stores.session[k];
      fond = nouveauFond(); fondMuet = false;
      await essaie(T, async () => {
        const ctx = await nav.newContext(Object.assign({ colorScheme: 'light', viewport: { width: largeur, height: hauteur } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
        const idsOnglets = new WeakMap(); let prochainOnglet = 7;
        await ctx.exposeBinding('__fond', (src, msg, url) => { if (!idsOnglets.has(src.page)) idsOnglets.set(src.page, prochainOnglet++); return repondre(msg, url, idsOnglets.get(src.page)); });
        await ctx.addInitScript(INIT, { js: BADGE, ui: UI });
        const erreurs = [];
        await ctx.route('**/*', (r) => {
          const u = r.request().url();
          if (/logo-vrm-96\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
          if (/vinted\.net\/banc\//.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL });
          return r.fulfill({ status: 200, contentType: 'text/html', body: PAGE(new URL(u).pathname) });
        });
        const pg = await ctx.newPage();
        pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
        await pg.goto('https://www.vinted.fr/catalog');
        await pg.waitForTimeout(600);
        // ── 0. le survol seul n'ouvre pas le grand panneau (souris)
        if (!mobile) {
          await pg.evaluate(() => { const h = document.getElementById('vrm-badge'); h.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })); });
          await pg.waitForTimeout(400);
          let s0 = await lire(pg);
          if (s0.grand) dit(!s0.on, `${T} : le simple survol du logo n'ouvre pas le grand panneau (il se refermait à la sortie de la souris)`, JSON.stringify({ on: s0.on }));
          await pg.evaluate(() => { const h = document.getElementById('vrm-badge'); h.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })); });
          await pg.waitForTimeout(300);
        }
        // ── 1. ouvert sur Commandes, défilé, une vente cochée
        await ouvrirPanneau(pg, mobile);
        await clic(pg, '[data-onglet-b="ventes"]');
        await pg.waitForTimeout(300);
        await cocher(pg, VEN[1].tx);
        await pg.waitForTimeout(200);
        await defiler(pg, 400);
        await pg.waitForTimeout(700);
        let s = await lire(pg);
        await cap(pg, `commandes-${largeur}`);
        dit(s.on && s.grand && s.page === 'ventes' && s.defil > 300 && s.coches.includes(VEN[1].tx), `${T} : 1. panneau ouvert sur Commandes, défilé, une vente cochée`, JSON.stringify({ on: s.on, page: s.page, defil: s.defil, coches: s.coches }));
        const defil1 = s.defil;
        // ── 8. bordereau et livreur
        dit(s.logos >= 2 && s.suivis.includes('MR12345678') && s.suivis.includes('XY987654321FR') && s.limites >= 2, `${T} : 8. chaque vente : logo + nom du transporteur, n° de suivi, date limite (lus)`, JSON.stringify({ logos: s.logos, suivis: s.suivis, limites: s.limites }));
        dit(JSON.stringify(s.imprimer) === JSON.stringify([VEN[0].tx, VEN[1].tx]) && JSON.stringify(s.manque) === JSON.stringify([VEN[2].tx]), `${T} : 8. « Imprimer le bordereau » sur les 2 prêtes, « Pas encore de bordereau » sur celle que Vinted n'a pas fournie`, JSON.stringify({ imp: s.imprimer, manque: s.manque }));
        dit(/Pas encore de bordereau/.test(s.visible), `${T} : 8. « Pas encore de bordereau » est écrit en clair`);
        dit(s.impN && s.impN.txs === VEN[1].tx, `${T} : 8. une sélection ⇒ « Imprimer » porte la sélection seule`, JSON.stringify(s.impN));
        dit(s.petitsImp === 0, `${T} : 8. boutons d'impression ≥ 44 px`, String(s.petitsImp));
        // ── 2. la page retire l'hôte
        await pg.evaluate(() => { const h = document.getElementById('vrm-badge'); h.remove(); });
        await pg.waitForTimeout(1300);
        s = await lire(pg);
        dit(s.hote && s.branche && s.on && s.page === 'ventes' && Math.abs(s.defil - defil1) < 5, `${T} : 2. la page retire l'hôte ⇒ il revient, ouvert, même page, même défilement`, JSON.stringify({ hote: s.hote, on: s.on, page: s.page, defil: s.defil }));
        // Next.js refait tout le document (html > head + body neufs)
        await pg.evaluate(() => { const b = document.createElement('body'); b.innerHTML = '<main><h1>Article</h1></main>'; document.documentElement.replaceChildren(document.createElement('head'), b); });
        await pg.waitForTimeout(1300);
        s = await lire(pg);
        dit(s.hote && s.branche && s.on && s.page === 'ventes', `${T} : 2. le document refait d'un bloc (html > head + body neufs) ⇒ le panneau revient`, JSON.stringify({ hote: s.hote, on: s.on, page: s.page }));
        // ── 3. navigation SPA
        await pg.evaluate(() => { history.pushState({}, '', '/items/123-nike'); document.body.innerHTML = '<main><h1>Nike</h1></main>'; window.dispatchEvent(new PopStateEvent('popstate')); });
        await pg.waitForTimeout(500);
        s = await lire(pg);
        dit(s.on && s.page === 'ventes', `${T} : 3. navigation SPA (pushState + <body> neuf) ⇒ toujours ouvert`, JSON.stringify({ on: s.on, page: s.page }));
        // ── 4. service worker tué (muet un temps, puis un vm NEUF sur les mêmes stockages), puis navigation pleine
        fondMuet = true;
        await pg.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        await pg.waitForTimeout(400);
        s = await lire(pg);
        dit(s.hote && s.on, `${T} : 4. service worker muet (le port se ferme) ⇒ le panneau reste`, JSON.stringify({ hote: s.hote, on: s.on }));
        fond = nouveauFond(); fondMuet = false;
        await pg.goto('https://www.vinted.fr/member/111');
        await pg.waitForTimeout(1500);
        s = await lire(pg);
        await cap(pg, `apres-navigation-${largeur}`);
        dit(s.on && s.grand && s.page === 'ventes' && s.coches.includes(VEN[1].tx) && Math.abs(s.defil - defil1) < 5, `${T} : 4. worker tué + navigation pleine ⇒ rouvert, même page, même sélection, même défilement`, JSON.stringify({ on: s.on, page: s.page, coches: s.coches, defil: s.defil, fonds: fondNo }));
        // ── 5. changement d'onglet
        const autre = await ctx.newPage(); await autre.goto('https://www.vinted.fr/inbox'); await autre.bringToFront(); await pg.waitForTimeout(300);
        await pg.bringToFront(); await pg.waitForTimeout(500);
        s = await lire(pg);
        dit(s.on && s.page === 'ventes', `${T} : 5. un autre onglet devant, puis retour ⇒ toujours ouvert`, JSON.stringify({ on: s.on, page: s.page }));
        const s5 = await lire(autre);
        dit(!s5.on, `${T} : 5. l'état est PAR ONGLET : l'autre onglet ne s'ouvre pas tout seul`, JSON.stringify({ on: s5.on }));
        await autre.close();
        // ── 6. souris qui sort, toucher sur le voile hors du panneau, une page du site touchée
        await pg.evaluate(() => { const h = document.getElementById('vrm-badge'); h.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })); });
        await pg.waitForTimeout(400);
        if (mobile) await pg.touchscreen.tap(2, 2); else await pg.mouse.click(4, 4);
        await pg.evaluate(() => { const ev = new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerType: 'touch' }); document.body.dispatchEvent(ev); });
        await pg.waitForTimeout(400);
        s = await lire(pg);
        dit(s.on && s.page === 'ventes', `${T} : 6. souris hors de la fenêtre, clic sur le voile, toucher sur la page ⇒ toujours ouvert`, JSON.stringify({ on: s.on }));
        // ── 8 (suite). Imprimer
        await clic(pg, `[data-imprimer="${VEN[0].tx}"]`);
        await pg.waitForTimeout(400);
        s = await lire(pg);
        const demandes = recus.filter((m) => m.action === 'bordereauCarte');
        dit(demandes.length >= 1 && JSON.stringify(demandes[demandes.length - 1].txs) === JSON.stringify([VEN[0].tx]) && s.telecharges.some((t) => t.nom === 'bordereau-200.pdf' && t.href === 'blob:'), `${T} : 8. « Imprimer le bordereau » ⇒ le PDF du fond (fichier « bordereau-200.pdf ») — onglet bloqué ⇒ téléchargé`, JSON.stringify({ d: demandes.slice(-1), t: s.telecharges }));
        dit(/téléchargé/.test(s.impEtat), `${T} : 8. dit ce qui s'est passé`, s.impEtat);
        await pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; r.querySelectorAll('[data-ven-sel]').forEach((c) => { if (c.checked) { c.checked = false; c.dispatchEvent(new Event('change')); } }); });
        await pg.waitForTimeout(250);
        s = await lire(pg);
        dit(s.impN && s.impN.txs === `${VEN[0].tx},${VEN[1].tx}` && /2 bordereaux/.test(s.impN.texte), `${T} : 8. sans sélection : « Imprimer les 2 bordereaux » (les prêts seulement)`, JSON.stringify(s.impN));
        await clic(pg, '[data-imprimer-n]'); await pg.waitForTimeout(400);
        s = await lire(pg);
        dit(s.telecharges.filter((t) => /^bordereau-20[01]\.pdf$/.test(t.nom)).length >= 3, `${T} : 8. « Imprimer les 2 » ⇒ deux fichiers`, JSON.stringify(s.telecharges));
        // ── Accueil : la vente captée
        await clic(pg, '[data-onglet-b="accueil"]'); await pg.waitForTimeout(300);
        s = await lire(pg);
        await cap(pg, `accueil-${largeur}`);
        dit(s.accVente.length === 1 && s.accVente[0].tx === VEN[0].tx && s.accVente[0].logo && s.accVente[0].suivi && s.accVente[0].imp, `${T} : 8. Accueil « Depuis ta dernière visite » : la vente dit son livreur, son suivi, et s'imprime`, JSON.stringify(s.accVente));
        // ── 9. Articles : jamais « à confirmer »
        await clic(pg, '[data-onglet-b="annonces"]'); await pg.waitForTimeout(300);
        s = await lire(pg);
        await cap(pg, `articles-${largeur}`);
        dit(!/à confirmer/i.test(s.visible) && /Pas revue depuis 3 j/.test(s.visible) && s.revue === 1, `${T} : 9. Articles : « Pas revue depuis 3 j », une phrase de geste, jamais « à confirmer »`, JSON.stringify({ revue: s.revue, extrait: (s.visible.match(/.{0,30}(confirmer|revue).{0,30}/gi) || []).slice(0, 4) }));
        await pg.evaluate(() => { const d = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-ann-statut-menu]'); if (d) d.open = true; });
        await pg.waitForTimeout(150);
        s = await lire(pg);
        dit(!/à confirmer/i.test(s.visible) && /Pas revues récemment/.test(s.visible), `${T} : 9. le filtre « Statut » dit « Pas revues récemment »`, (s.visible.match(/.{0,30}(confirmer|revue).{0,30}/gi) || []).join(' | '));
        // ── 7. son × ferme ; rechargé, il reste fermé
        await clic(pg, '[data-fermer-carte]'); await pg.waitForTimeout(700);
        s = await lire(pg);
        dit(!s.on, `${T} : 7. son × ferme le panneau`);
        await pg.reload(); await pg.waitForTimeout(1200);
        s = await lire(pg);
        dit(!s.on, `${T} : 7. fermé par son ×, une page rechargée ne le rouvre pas`, JSON.stringify({ on: s.on }));
        dit(!erreurs.length, `${T} : aucune erreur de page`, erreurs.join(' | '));
        await ctx.close();
      });
    }
  } finally { await nav.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
