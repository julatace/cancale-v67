// ════════════════════════════════════════════════════════════════════════
//  BANC « PANNEAU 5.428 » (21 nov., choix 57 et 58) — le VRAI vrm-badge.js + vrm-ui.js sur une fausse page vinted.fr
//  (le faux `chrome` répond comme le fond : `moderationCarte`, `courbeAnnonce` — séries calculées par LA règle
//  src/courbeAnnonce.js). Données INVENTÉES. 390 × 844 au doigt (agent d'Orion), 390 sombre, 1512.
//   M. Accueil : « Masquées par Vinted » en tête — « Nike Air Max 1 taille 42 masquée par Vinted », la raison de Vinted
//      et son conseil ; sans raison « Vinted ne dit pas pourquoi » ; « Ouvrir l'annonce » mène à l'annonce ; rien
//      masqué ⇒ aucune section ; lecture ratée ⇒ aucune section (jamais une alerte sur « pas su »).
//   C. Fiche d'une annonce : « Vues et favoris », la ligne coupée aux jours non lus, repères ; pas su ⇒ « — ».
//  Mesuré : aucun débordement, cibles ≥ 44 px, pas de couleur hors jetons. Captures (BANC_CAPTURES) à REGARDER.
//  `BANC_EXT=<arbre d'avant>/vinted-sync-extension` : rouge attendu.
// ════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const RACINE = path.join(__dirname, '..', '..');
const EXT = process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension');
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const UI = fs.existsSync(path.join(EXT, 'vrm-ui.js')) ? fs.readFileSync(path.join(EXT, 'vrm-ui.js'), 'utf8') : '';
const LOGO = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'logo-vrm-96.png'));
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'panneau-5428') : path.join(require('os').tmpdir(), 'banc-panneau-5428');
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 300) : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${String(e && e.message).slice(0, 220)}`); return null; } };
const MIN = 60000, H = 3600000, J = 86400000, T0 = Date.now();
const img = (c) => `https://images1.vinted.net/banc/${c}.jpg`;
const ANN = Array.from({ length: 4 }, (_, i) => ({ id: String(7000000 + i), titre: ['Nike Air Max 1 Travis Scott Baroque Brown taille 42,5', 'Adidas Samba OG noires 40', 'New Balance 550 crème 41', 'Puma Suede bleues 43'][i], prix: 60 + i * 5, photo: img('a' + i), photos: [img('a' + i)], num: String(120 + i), jours: 3 + i, favoris: i, depuis: T0 - i * J, taille: String(40 + i), marque: 'Nike', etat: 'Très bon état', vues: 30 + i, description: '', mini: null, achat: null, statut: 'en_vente' }));
const LISTES = { ok: true, plateforme: 'vinted', compte: { id: '111', nom: 'shop_sophie' }, offres: [],
  annonces: { lu: T0 - 20 * MIN, aConfirmer: false, total: ANN.length, liste: ANN, toutes: ANN, nTous: ANN.length, statuts: { en_vente: 4, brouillon: 0, masque: 0, reserve: 0, vendu: 0, a_confirmer: 0 } },
  automatisations: null, notifications: { vu: T0, liste: [] }, ventes: { lu: T0 - 10 * MIN, total: 0, liste: [] }, messages: { lu: T0 - 5 * MIN, liste: [] }, autres: null };
const ETAT = { ok: true, plateforme: 'vinted', capte: true, version: '5.428.0', code: '5.428.0', vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true },
  site: { id: '111', nom: 'shop_sophie', choix: 'oui', jauge: { h: 12, maxH: 50, j: 40, maxJ: 200, complet: true }, favoris: null }, secu: { niveau: 'ok', texte: '' }, toutArrete: false, flux: { okAt: T0 - 3 * MIN }, liens: [], capteCoupe: false };
const MASQ = [{ k: 'masquee:7000001:1', s: 'masquee', t: T0 - 2 * H, a: '7000001', ti: 'Nike Air Max 1', ta: '42', r: 'Possible counterfeit item', c: 'authenticite' },
  { k: 'masquee:7000002:1', s: 'masquee', t: T0 - 5 * H, a: '7000002', ti: 'Adidas Samba OG noires' }];
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8sPfefwAHiQM0TP3mWgAAAABJRU5ErkJggg==', 'base64');

async function ouvrir(nav, { scheme = 'light', largeur = 1512, hauteur = 900, mobile = false, orion = false, moderation, courbe }) {
  const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, viewport: { width: largeur, height: hauteur } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}, orion ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1 Orion/1.0' } : {}));
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await pg.route('**/*', (r) => {
    const u = r.request().url();
    if (/logo-vrm-96\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    if (/vinted\.net\/banc\//.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL });
    return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#fff"><main style="height:2000px">Annonces…</main></body></html>' });
  });
  await pg.goto('https://www.vinted.fr/catalog');
  await pg.evaluate(({ e, js, ui, L, moderation, courbe }) => {
    window.__envoyes = [];
    const copie = (x) => JSON.parse(JSON.stringify(x));
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    window.chrome = {
      runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: e.version }), lastError: null,
        sendMessage: (msg, cb) => {
          window.__envoyes.push(copie(msg));
          let rep = { ok: true };
          if (msg.action === 'etat') rep = copie(e);
          else if (msg.action === 'carteListes') rep = copie(L);
          else if (msg.action === 'capteLot') rep = { ok: true, lot: null };
          else if (msg.action === 'moderationCarte') rep = copie(moderation);
          else if (msg.action === 'courbeAnnonce') rep = copie(courbe);
          setTimeout(() => cb && cb(rep), 0);
        } },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener() {} } },
    };
    if (ui) { const u = document.createElement('script'); u.textContent = ui; document.documentElement.appendChild(u); }
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: ETAT, js: BADGE, ui: UI, L: LISTES, moderation, courbe });
  await pg.waitForTimeout(250);
  return { ctx, pg, erreurs };
}
const montrer = async (pg, mobile) => {
  const b = await pg.evaluate(() => { const x = document.getElementById('vrm-badge').shadowRoot.querySelector('.btn').getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  if (mobile) await pg.touchscreen.tap(b.x, b.y); else { await pg.mouse.move(5, 5); await pg.mouse.move(b.x, b.y); await pg.mouse.click(b.x, b.y); }
  await pg.waitForTimeout(500);
};
const clic = async (pg, sel) => { await pg.evaluate((s) => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (b) b.click(); }, sel); await pg.waitForTimeout(400); };
const mesure = (pg, sel) => pg.evaluate((sel) => {
  const r = document.getElementById('vrm-badge').shadowRoot;
  const zone = r.querySelector(sel);
  const vis = (el) => { if (!el || !el.getClientRects().length) return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const petits = [];
  if (zone) for (const el of zone.querySelectorAll('button, a[href]')) { if (!vis(el)) continue; const b = el.getBoundingClientRect(); if (b.height < 43.5 || b.width < 43.5) petits.push(Math.round(b.width) + 'x' + Math.round(b.height) + ':' + el.innerText.slice(0, 20)); }
  const debords = [r.querySelector('.carte'), r.querySelector('.corps6'), zone].filter((x) => x && vis(x) && x.scrollWidth > x.clientWidth + 1).map((x) => x.className);
  return { la: !!zone, texte: zone ? zone.innerText : '', petits, debords, attrs: zone ? Object.fromEntries([...zone.attributes].map((a) => [a.name, a.value])) : null,
    lignes: zone ? [...zone.querySelectorAll('[data-moderation-item]')].map((x) => ({ a: x.getAttribute('data-moderation-item'), r: x.getAttribute('data-moderation-raison'), lien: (x.querySelector('a') || {}).href || '' })) : [],
    traces: zone ? [...zone.querySelectorAll('[data-cb-trace]')].map((x) => ({ k: x.getAttribute('data-cb-trace'), seg: Number(x.getAttribute('data-cb-segments')), pts: Number(x.getAttribute('data-cb-points')), lignes: x.querySelectorAll('polyline').length, trou: (x.querySelector('rect[data-cb-lu="0"] title') || {}).textContent || '' })) : [] };
}, sel);

(async () => {
  const C = await import('file://' + path.join(RACINE, 'src', 'courbeAnnonce.js'));
  const j0 = C.jourCourbe(T0);
  const serie = C.serieCourbe([{ p: [[j0 - 20, 12, 0, 9000, 600], [j0 - 19, 18, 1, 9000, 600], [j0 - 12, 35, 2, 8500, 700], [j0 - 11, 40, 3, 8500, 700], [j0 - 1, 58, 4, 8500, 800], [j0, 61, 4, 8500, 900]], e: [[j0 - 12, 'p'], [j0 - 16, 'r'], [j0 - 5, 'f']] }], { maintenant: T0, jours: 30 });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const cap = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };
  const jeux = [['390-orion', { largeur: 390, hauteur: 844, mobile: true, orion: true }], ['390-sombre', { largeur: 390, hauteur: 844, mobile: true, scheme: 'dark' }], ['1512', { largeur: 1512, hauteur: 900 }]];
  try {
    for (const [T, o] of jeux) {
      console.log(`\n${T}`);
      await essaie(T + ' M', async () => {
        const t = await ouvrir(nav, { ...o, moderation: { ok: true, uid: '111', liste: MASQ }, courbe: { ok: true, serie } });
        await montrer(t.pg, o.mobile);
        await clic(t.pg, '[data-onglet-b="accueil"]');
        await t.pg.waitForTimeout(400);
        const m = await mesure(t.pg, '[data-accueil-moderation]');
        dit(m.la && m.lignes.length === 2, `${T} · M : « Masquées par Vinted » en tête de l’Accueil, deux rangées`, JSON.stringify(m.lignes));
        dit(/Nike Air Max 1 taille 42 masquée par Vinted/.test(m.texte) && /Raison : Possible counterfeit item/.test(m.texte) && /Que faire : ajoute des photos de l’étiquette/.test(m.texte), `${T} · M : titre et taille, la raison de Vinted, le conseil qui la suit`, m.texte);
        dit(/Adidas Samba OG noires masquée par Vinted/.test(m.texte) && /Vinted ne dit pas pourquoi/.test(m.texte) && m.lignes[1].r === 'inconnue', `${T} · M : sans raison ⇒ « Vinted ne dit pas pourquoi »`, m.texte);
        dit(m.lignes.every((x) => /^https:\/\/www\.vinted\.fr\/items\/\d+$/.test(x.lien)), `${T} · M : « Ouvrir l’annonce » mène à SON annonce (identité)`, JSON.stringify(m.lignes));
        dit(!m.petits.length && !m.debords.length, `${T} · M : cibles ≥ 44 px, aucun débordement`, JSON.stringify([m.petits, m.debords]));
        await cap(t.pg, `${T}-accueil`);
        // C : la fiche de l'annonce 7000001
        await clic(t.pg, '[data-onglet-b="annonces"]');
        await clic(t.pg, '[data-fiche-b="a:7000001"]');
        await t.pg.waitForTimeout(500);
        const c = await mesure(t.pg, '[data-courbe]');
        dit(c.la && c.attrs['data-courbe'] === 'lu' && c.attrs['data-cb-lus'] === '6', `${T} · C : « Vues et favoris » dans la fiche (6 jours lus)`, JSON.stringify(c.attrs));
        const v = c.traces.find((x) => x.k === 'vues');
        dit(v && v.seg === 3 && v.lignes === 3 && v.pts === 6 && /— pas lu/.test(v.trou), `${T} · C : la ligne coupée aux jours non lus (3 morceaux), « — pas lu » au survol`, JSON.stringify(c.traces));
        dit(['p', 'r', 'f'].every((k) => String(c.attrs['data-cb-reperes'] || '').split(',').includes(k)) && /Prix baissé par VRM/.test(c.texte) && /Republiée/.test(c.texte), `${T} · C : les repères nommés (baisse VRM, republiée, offre aux favoris)`, c.texte.slice(0, 300));
        dit(!c.debords.length, `${T} · C : aucun débordement`, JSON.stringify(c.debords));
        await t.pg.evaluate(() => { const z = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-courbe]'); if (z) z.scrollIntoView({ block: 'center' }); });
        await t.pg.waitForTimeout(300);
        await cap(t.pg, `${T}-courbe`);
        dit(!t.erreurs.length, `${T} : aucune erreur de page`, t.erreurs.join(' | '));
        await t.ctx.close();
      });
    }
    console.log('\nrien masqué · lecture ratée · courbe pas sue (390)');
    for (const [nom, mod, cb, attendu] of [['rien', { ok: true, uid: '111', liste: [] }, { ok: false }, 'pas-su'], ['pas-su', { ok: false }, { ok: true, serie: { jours: [], reperes: [], lus: 0 } }, 'vide']]) {
      await essaie(nom, async () => {
        const t = await ouvrir(nav, { largeur: 390, hauteur: 844, mobile: true, moderation: mod, courbe: cb });
        await montrer(t.pg, true);
        await clic(t.pg, '[data-onglet-b="accueil"]');
        const m = await mesure(t.pg, '[data-accueil-moderation]');
        dit(!m.la, `${nom} : aucune section « Masquées par Vinted »`);
        await clic(t.pg, '[data-onglet-b="annonces"]');
        await clic(t.pg, '[data-fiche-b="a:7000001"]');
        const c = await mesure(t.pg, '[data-courbe]');
        dit(c.la && c.attrs['data-courbe'] === attendu && /—/.test(c.texte), `${nom} : courbe « ${attendu} » dite « — » (jamais une courbe vide présentée comme une mesure)`, JSON.stringify(c.attrs));
        await cap(t.pg, `390-${nom}`);
        dit(!t.erreurs.length, `${nom} : aucune erreur de page`, t.erreurs.join(' | '));
        await t.ctx.close();
      });
    }
  } finally { await nav.close(); }
  console.log(`\n${ko ? '❌' : '✅'} panneau-5428 : ${ko} rouge(s) sur ${ko + ok} — captures dans ${SORTIE}`);
  process.exit(ko ? 1 : 0);
})();
