require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « PRIX PARTOUT » + « GARDE DU PRIX » DANS LE PANNEAU (21 nov., ext. 5.432 — `prixpartout`, `gardeprix`)
//
//  Le VRAI vrm-badge.js / vrm-ui.js dessinent le panneau sur une fausse page vinted.fr ; chaque message au fond
//  (`prixPartoutSites`, `prixCarte`) est répondu par le VRAI background.js (scripts/_fond-vm.cjs, base inventée :
//  50 annonces Leboncoin au MÊME titre, une seule reliée à la paire par le lien posé ; une annonce Vestiaire au N°).
//  À 390 px (Orion, au doigt, clair puis sombre) et 1512 px (clair puis sombre) :
//   P1  la saisie : sous l'annonce, SES autres sites (Leboncoin 60 € → …, Vestiaire « à changer sur Vestiaire ») ;
//       « Sur tous les sites où elle est en ligne » coché d'office ; « Même prix partout » / « +10 % … »
//   P2  « +10 % sur Leboncoin / Vestiaire » : l'avant / après montre CHAQUE site (Vinted 60 → 6, Leboncoin 60 → 6,60)
//   P3  « Lancer » à 6 € au lieu de 60 € : le fond refuse (« à confirmer »), RIEN n'est rangé ; le panneau montre le
//       chiffre EN GRAND, « au lieu de 60 € », la raison (faute de frappe, 90 % sous le prix), « Oui, 6 € » / « Corriger »
//   P4  « Oui » ⇒ le fond range UNE commande par site (Vinted, Leboncoin — la reliée, jamais une autre au même titre),
//       le chiffre confirmé joint ; Leboncoin « en attente », dit
//   T   cibles ≥ 44 px, rien ne déborde, aucune erreur de page
//  `--prouve` : la confirmation dessinée sans le chiffre (le titre seul) ⇒ rouge. Captures : BANC_CAPTURES ou
//  scripts/bancs/captures/prix-partout-garde (jamais commitées). Aucune donnée réelle.
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const RACINE = path.join(__dirname, '..', '..');
const EXT = process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension');
const S = require(path.join(RACINE, 'scripts', '_modif-scenarios.cjs'));
const { faireFond } = require(path.join(RACINE, 'scripts', '_fond-vm.cjs'));
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'prix-partout-garde') : path.join(__dirname, 'captures', 'prix-partout-garde');
const PROUVE = process.argv.includes('--prouve');
const UI = fs.readFileSync(path.join(EXT, 'vrm-ui.js'), 'utf8'), MOTS = fs.readFileSync(path.join(EXT, 'vrm-mots.js'), 'utf8');
let BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
if (PROUVE) {
  const de = '<b class="garde6-chiffre" data-garde-prix="${c.prixC}">${esc(euroTxt(c.prixC / 100))}</b>';
  if (!BADGE.includes(de)) { console.log('❌ --prouve : motif absent'); process.exit(1); }
  BADGE = BADGE.replace(de, '');
}
let ok = 0, ko = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; if (!PROUVE) console.log(`  ✅ ${quoi}`); } else { ko++; if (!PROUVE) console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 500) : ''}`); } };
const IMG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#d9cdb8"/><rect x="12" y="34" width="56" height="20" rx="8" fill="#5a4a3a"/></svg>');
const PAGE = (nuit) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vinted (banc)</title><style>body{margin:0;font:15px/1.4 system-ui,sans-serif;background:${nuit ? '#121416' : '#fff'};color:${nuit ? '#eee' : '#111'}}header{height:56px;border-bottom:1px solid #ddd}</style></head><body><header></header><main><p style="padding:16px">Catalogue (faux)</p></main></body></html>`;
const UID = S.UID, ID = '91010001', TITRE = 'Nike Air Max 90 blanches 42';

function fond() {
  const lignes = { main: { vinted_annonce_numeros: S.copie(S.NUMS), vinted_buyprice_by_num: {}, vrm_lbc_liens: { '3000000007': '120' } }, vinted_listing_dates: {},
    [`harvest_${UID}_listings`]: { payload: { items: S.copie(S.DRESSING) } } };
  const lbc = {}; for (let i = 0; i < 50; i++) lbc[String(3000000000 + i)] = { id: String(3000000000 + i), subject: TITRE, status: 'active', price: [60], account: 'lbc-account:77' };
  lignes.lbc_listings = { items: lbc };
  lignes.vc_listings = { items: { '45678901': { titre: TITRE, statut: 'published', prix: { valeur: 60 }, ref: 'VRM-120', compte: '9' }, '45678902': { titre: TITRE, statut: 'published', prix: { valeur: 60 }, ref: 'VRM-999', compte: '9' } } };
  const f = faireFond({ lignes, connecte: UID });
  f.ctx.relaisSessionOwner = async () => 'owner-banc';
  f.ctx.prixAttenteTick = () => Promise.resolve({});
  return f;
}

async function page(nav, { largeur, hauteur, mobile, orion, scheme }) {
  const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, viewport: { width: largeur, height: hauteur } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}, orion ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1 Orion/1.0' } : {}));
  const pg = await ctx.newPage(); const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await pg.route('**/*', (r) => (/vinted\.net|\.svg|\.png/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'image/svg+xml', body: IMG }) : r.fulfill({ status: 200, contentType: 'text/html', body: PAGE(scheme === 'dark') })));
  await pg.addInitScript(() => { const o = Element.prototype.attachShadow; Element.prototype.attachShadow = function (x) { return o.call(this, Object.assign({}, x, { mode: 'open' })); }; });
  await pg.goto('https://www.vinted.fr/catalog');
  return { ctx, pg, erreurs };
}

async function panneau(nav, vp, T, N, cap) {
  const F = fond();
  const t = await page(nav, vp); const { pg } = t;
  const toutes = S.DRESSING.map((x) => ({ id: String(x.id), titre: x.title, prix: Number(x.price.amount), photo: x.photo.url, photos: [x.photo.url], num: S.NUMS[String(x.id)].numero, depuis: x.created_at_ts * 1000, jours: Math.floor((Date.now() - x.created_at_ts * 1000) / 864e5), statut: 'en_vente', favoris: 0, vues: 0 }));
  const L = { ok: true, plateforme: 'vinted', compte: { id: UID, nom: 'shop_sophie' }, offres: [], annonces: { lu: Date.now() - 600000, aConfirmer: false, total: toutes.length, liste: toutes, toutes, nTous: toutes.length, statuts: { en_vente: toutes.length, brouillon: 0, masque: 0, reserve: 0, vendu: 0 } },
    automatisations: { offres: { actif: false, minis: 0, refus: false }, favoris: { regle: false, versions: 0, rythme: 'normal', textes: [], auto: { actif: false } }, paliers: { actif: false, paliers: [], remiseMax: null, messages: 0 }, baisse: { actif: false, pct: null, jours: null }, gardePrix: { seuil: 40, bloquees: [] } },
    notifications: { vu: Date.now(), liste: [] }, ventes: { lu: Date.now(), total: 0, liste: [] }, messages: { lu: Date.now(), liste: [] }, autres: null };
  const ETAT = { ok: true, plateforme: 'vinted', capte: true, version: '5.432.0', code: '5.432.0', vrm: { ok: true, connecte: true, email: 'banc@exemple.fr', cloisonne: true }, site: { id: UID, nom: 'shop_sophie', choix: 'oui', jauge: { h: 3, maxH: 50, j: 10, maxJ: 200, complet: true } } };
  const sender = { tab: { id: 7, url: 'https://www.vinted.fr/catalog' } };
  const recus = [];
  await pg.exposeFunction('__fond', async (msg) => {
    recus.push(JSON.parse(JSON.stringify(msg)));
    if (msg.action === 'prixPartoutSites') return F.ctx.prixPartoutSites(msg, sender);
    if (msg.action === 'prixCarte') return F.ctx.changerPrixCarte(msg, sender);
    return null;
  });
  await pg.evaluate(({ L0, E0 }) => {
    const copie = (v) => JSON.parse(JSON.stringify(v));
    const ecoutes = [];
    window.chrome = { runtime: { id: 'ext', lastError: null, getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: '5.432.0' }),
      sendMessage: (msg, cb) => {
        const rep = (r) => { if (typeof cb === 'function') setTimeout(() => cb(r == null ? undefined : copie(r)), 0); };
        if (msg && (msg.action === 'prixPartoutSites' || msg.action === 'prixCarte')) { window.__fond(copie(msg)).then(rep); return; }
        if (msg && msg.action === 'etat') return rep(E0);
        if (msg && msg.action === 'carteListes') return rep(L0);
        if (msg && msg.action === 'numeros') return rep({ ok: true, items: {} });
        return rep({ ok: true });
      },
      onMessage: { addListener() {} }, connect: () => ({ onMessage: { addListener() {} }, onDisconnect: { addListener() {} }, postMessage() {} }) },
      i18n: { getUILanguage: () => 'fr', getMessage: () => '' },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, session: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener: (f) => ecoutes.push(f) } } };
  }, { L0: L, E0: ETAT });
  for (const s of [UI, MOTS, BADGE]) await pg.evaluate((js) => { const e = document.createElement('script'); e.textContent = js; document.documentElement.appendChild(e); }, s);
  await pg.waitForTimeout(400);
  const R = (fn, a) => pg.evaluate(fn, a);
  const clic = async (sel) => { await R((s) => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (b) b.click(); }, sel); await pg.waitForTimeout(350); };
  const b = await R(() => { const x = document.getElementById('vrm-badge').shadowRoot.querySelector('.btn').getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  if (vp.mobile) await pg.touchscreen.tap(b.x, b.y); else await pg.mouse.click(b.x, b.y);
  await pg.waitForTimeout(500);
  await clic('[data-onglet-b="annonces"]');
  await R((id) => { const r = document.getElementById('vrm-badge').shadowRoot; for (const c of r.querySelectorAll('[data-ann-sel]')) { const v = c.getAttribute('data-ann-sel') === id; if (c.checked !== v) { c.checked = v; c.dispatchEvent(new Event('change')); } } }, ID);
  await pg.waitForTimeout(150);
  await R(() => { const s = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-ann-action]'); s.value = 'baisser'; s.dispatchEvent(new Event('change')); });
  await pg.waitForTimeout(900);
  await R((id) => { const c = document.getElementById('vrm-badge').shadowRoot.querySelector(`[data-prix-nouveau="${id}"]`); c.value = '6'; c.dispatchEvent(new Event('input')); }, ID);
  await R(() => { const r = document.getElementById('vrm-badge').shadowRoot; const x = r.querySelector('[data-pp-tous]'); if (x) x.scrollIntoView({ block: 'center' }); });
  const p1 = await R(() => { const r = document.getElementById('vrm-badge').shadowRoot; return { sites: [...r.querySelectorAll('[data-pp-site]')].map((l) => l.getAttribute('data-pp-site') + ':' + l.getAttribute('data-pp-id') + ':' + l.getAttribute('data-pp-mode')), tous: !!(r.querySelector('[data-pp-tous]') || {}).checked, ebay: !!r.querySelector('[data-pp-ebay]'), seg: r.querySelectorAll('[data-pp-ajuste]').length }; });
  dit(p1.sites.join(' ') === 'leboncoin:3000000007:ext vestiaire:45678901:dit' && p1.tous && p1.ebay && p1.seg === 2,
    `P1 ${T} la saisie : SES autres sites (Leboncoin RELIÉ parmi 50 au même titre, Vestiaire dit), « Sur tous les sites » coché d'office, deux choix de prix`, JSON.stringify(p1));
  await pg.waitForTimeout(150); await cap(pg, N('saisie'));
  await clic('[data-pp-ajuste="plus"]');
  await clic('[data-prix-confirmer]');
  const p2 = await R(() => { const r = document.getElementById('vrm-badge').shadowRoot; return { lignes: [...r.querySelectorAll('[data-aa-ligne]')].map((l) => l.getAttribute('data-aa-ligne') + '|' + ((l.querySelector('[data-aa-resume]') || {}).textContent || '') + '|' + ((l.querySelector('[data-aa-site]') || {}).textContent || '')), un: !!r.querySelector('[data-pp-un]') }; });
  dit(p2.lignes.join(' ; ') === `vinted:${ID}|60 € → 6 €|Vinted ; leboncoin:3000000007|60 € → 6,60 €|Leboncoin` && p2.un,
    `P2 ${T} « +10 % sur Leboncoin » : l'avant / après montre CHAQUE site (Vinted 60 → 6, Leboncoin 60 → 6,60), « un site à la fois »`, JSON.stringify(p2));
  await cap(pg, N('avant-apres'));
  await clic('[data-prix-confirmer]');
  await pg.waitForTimeout(500);
  const cmds0 = Object.keys(F.lignes).filter((k) => /^cmd_prix_/.test(k)).length;
  const p3 = await R(() => { const r = document.getElementById('vrm-badge').shadowRoot; const d = r.querySelector('[data-garde-confirme]'); if (d) d.scrollIntoView({ block: 'center' }); return d ? { n: d.getAttribute('data-garde-confirme'), chiffres: [...d.querySelectorAll('[data-garde-prix]')].map((x) => x.getAttribute('data-garde-prix') + '=' + x.textContent), texte: d.textContent, oui: (d.querySelector('[data-garde-oui]') || {}).textContent || '', taille: d.querySelector('.garde6-chiffre') ? parseFloat(getComputedStyle(d.querySelector('.garde6-chiffre')).fontSize) : 0, lancer: !!(r.querySelector('[data-aa-vue] [data-prix-confirmer]') || {}).disabled } : null; });
  dit(p3 && p3.n === '2' && p3.chiffres.join(' ') === '600=6,00 € 660=6,60 €' && /au lieu de 60,00 €/.test(p3.texte) && /faute de frappe/i.test(p3.texte) && /90 % sous le prix actuel/.test(p3.texte) && /^Oui, 6,00 €, 6,60 €$/.test(p3.oui) && p3.taille >= 28 && p3.lancer && cmds0 === 0,
    `P3 ${T} « Lancer » à 6 € au lieu de 60 € : RIEN rangé ; le chiffre EN GRAND (≥ 28 px), « au lieu de 60 € », la raison, « Oui, 6,00 €, 6,60 € » / « Corriger »`, JSON.stringify({ p3, cmds0 }));
  const m = await R(() => { const o = document.getElementById('vrm-badge').shadowRoot; const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const petits = [...o.querySelectorAll('[data-garde-confirme] button, [data-pp-choix] button, [data-pp-choix] label')].filter(vis).map((b) => Math.round(b.getBoundingClientRect().height)).filter((h) => h < 44);
    const deb = [...o.querySelectorAll('[data-garde-confirme], .vu-aa')].filter(vis).some((el) => { const r = el.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; });
    return { petits, deb }; });
  dit(!m.petits.length && !m.deb, `T ${T} confirmation : cibles ≥ 44 px, rien ne déborde`, JSON.stringify(m));
  await cap(pg, N('garde-confirmer'));
  await clic('[data-garde-oui]');
  await pg.waitForTimeout(700);
  const cmds = Object.keys(F.lignes).filter((k) => /^cmd_prix_/.test(k)).map((k) => F.lignes[k]);
  const etat = await R(() => { const r = document.getElementById('vrm-badge').shadowRoot; const e = r.querySelector('[data-geste-etat]'); if (e) e.scrollIntoView({ block: 'center' }); return e ? e.textContent : ''; });
  dit(cmds.length === 2 && cmds.some((d) => d.site === 'vinted' && d.args.id === ID && d.gardeConfirmeC === 600) && cmds.some((d) => d.site === 'leboncoin' && d.args.id === '3000000007' && d.gardeConfirmeC === 660) && /Leboncoin : en attente/.test(etat),
    `P4 ${T} « Oui » ⇒ UNE commande par site (Vinted, le Leboncoin relié), le chiffre confirmé joint ; « Leboncoin : en attente », dit`, JSON.stringify({ cmds: cmds.map((d) => d.site + ':' + d.args.id + ':' + d.gardeConfirmeC), etat }));
  await cap(pg, N('apres'));
  dit(!t.erreurs.length, `T ${T} panneau : aucune erreur de page`, t.erreurs.join(' | '));
  await t.ctx.close();
}

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const cap = async (pg, nom) => { if (PROUVE) return; try { await pg.waitForTimeout(150); await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };
  try {
    for (const vp of [{ largeur: 390, hauteur: 844, mobile: true, orion: true, scheme: 'light' }, { largeur: 390, hauteur: 844, mobile: true, orion: true, scheme: 'dark' }, { largeur: 1512, hauteur: 900, mobile: false, orion: false, scheme: 'light' }, { largeur: 1512, hauteur: 900, mobile: false, orion: false, scheme: 'dark' }]) {
      const T = `${vp.largeur}${vp.orion ? ' Orion' : ''} ${vp.scheme}`;
      const N = (k) => `${vp.largeur}-${vp.orion ? 'orion-' : ''}${vp.scheme}-${k}`;
      if (!PROUVE) console.log(`\n${T}`);
      try { await panneau(nav, vp, T, N, cap); } catch (e) { ko++; console.log(`  ❌ ${T} a levé : ${String(e && e.stack).slice(0, 400)}`); }
      if (PROUVE) break;
    }
  } finally { await nav.close(); }
  if (PROUVE) { console.log(ko ? `✅ --prouve : la confirmation sans le chiffre ⇒ ${ko} rouge(s)` : '❌ --prouve : la mutation passe'); process.exit(ko ? 0 : 1); }
  console.log(`\n${ko ? '❌' : '✅'} prix-partout-garde : ${ok} vert(s), ${ko} rouge(s) — captures : ${SORTIE}`);
  process.exit(ko ? 1 : 0);
})();
