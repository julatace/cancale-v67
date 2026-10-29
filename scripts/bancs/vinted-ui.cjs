// Banc : LES ÉCRANS VINTED DU 29 OCTOBRE (données INVENTÉES — il vit dans le dépôt).
//
// Julien, 29 oct. : « augmente la taille des photos dans Vinted » · « l'état d'une
// façon plus originale, avec à côté la saisie du prix d'achat » · « toutes les
// infos qui sont dans les 3 petits points » · « pour le filtre des périodes […]
// un calendrier, comme avec Airbnb » · « accepter les offres automatiquement :
// que ce ne soit pas un bouton comme ça, avec tout le texte, c'est moche » ·
// « la pastille Actions possibles / Lecture seule, améliore-la ».
// Il juge par ATTRIBUTS (`data-*`), jamais par formulation (§6.5), à 390 px
// tactile et 1512 px, en clair et en sombre :
//   A. la fiche d'annonce : photo en grand ; l'état en jauge (`data-etat-niveau`
//      suit la donnée : 5 · 4 · 3 · 1 · « inconnu » · « aucun ») et son mot en
//      entier ; le prix d'achat À CÔTÉ, saisi en place et ENREGISTRÉ ; plus de
//      « ⋯ Gérer l'annonce » : ses gestes sont à la vue, 44 px au doigt ;
//   B. les offres automatiques : UNE ligne courte ; le détail derrière ⓘ ; le
//      statut suit la donnée (nombre d'annonces avec un mini) ; éteindre sans
//      question, allumer DEMANDE (le comportement ne change pas) ;
//   C. le calendrier : deux mois côte à côte à l'ordinateur, un calendrier qui
//      défile au doigt ; un raccourci applique ; deux touchers + Appliquer
//      filtrent la liste et la plage se lit en clair ; le MÊME composant sur
//      Ventes, Achats et Statistiques ;
//   D. la pastille : ton, chevron, panneau avec un en-tête et la chaîne des trois
//      maillons, le geste en bas, dans l'écran.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 9110;
const CAP = process.env.BANC_CAPTURES || '';
const maintenant = new Date();
const iso = (d) => d.toISOString();
const jours = (n) => { const d = new Date(maintenant); d.setDate(d.getDate() - n); d.setHours(12, 0, 0, 0); return d; };
const cle = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ilYa = (j) => Math.floor((Date.now() - j * 86400000) / 1000);

// ── Annonces : un état par niveau, un état que la règle ne connaît pas, aucun état.
const ann = (id, o) => Object.assign({ id, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, brand_title: 'Nike', size_title: '42', view_count: 30, favourite_count: 2, nPhotos: 5, created_at_ts: ilYa(5) }, o);
const ITEMS = [
  ann(9201, { title: 'Nike Air Max 1 inventée taille 42', status: 'Neuf avec étiquette' }),
  ann(9202, { title: 'Salomon XT-6 inventée taille 40', brand_title: 'Salomon', status: 'Neuf sans étiquette' }),
  ann(9203, { title: 'Adidas Spezial inventée taille 38', brand_title: 'Adidas', status: 'Très bon état' }),
  ann(9204, { title: 'New Balance 550 inventée taille 41', brand_title: 'New Balance', status: 'Satisfaisant' }),
  ann(9205, { title: 'Asics Gel inventée taille 43', brand_title: 'Asics', status: 'Comme neuf (vintage)' }),
  ann(9206, { title: 'Puma Suede inventée taille 44', brand_title: 'Puma' }),
];
const ATTENDU = { 9201: '5', 9202: '4', 9203: '3', 9204: '1', 9205: 'inconnu', 9206: 'aucun' };
const MAIN = { vinted_annonce_numeros: {
  '9201': { numero: '201', buyPrice: '25', min: '45' },
  '9202': { numero: '202' },
  '9203': { numero: '203', min: '40' },
  '9204': { numero: '204' },
  '9205': { numero: '205' },
  '9206': { numero: '206' },
} };
// ── Ventes (datées par rapport à aujourd'hui) : 2 dans les 7 derniers jours,
// une au 20e jour, d'autres plus loin.
const V = [[8801, 30, 2], [8802, 41, 5], [8803, 55, 20], [8804, 62, 40], [8805, 70, 100]];
const vente = ([tx, prix, j]) => ({ transaction_id: tx, id: tx, title: 'Baskets inventées ' + tx, price: { amount: String(prix), currency_code: 'EUR' }, status: 'Commande finalisée', date: iso(jours(j)) });
const A = [[7701, 20, 3], [7702, 18, 25], [7703, 22, 60]];
const achat = ([tx, prix, j]) => ({ transaction_id: tx, id: tx, title: 'Achat inventé ' + tx, price: { amount: String(prix), currency_code: 'EUR' }, status: 'Commande finalisée', date: iso(jours(j)), transaction_user_status: 'completed' });
const rows = [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: { capturedAt: iso(maintenant), payload: { items: ITEMS } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(maintenant), payload: { my_orders: V.map(vente) } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(maintenant), payload: { my_orders: A.map(achat) } } },
];
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_invente', domain: 'www.vinted.fr', updated_at: iso(maintenant), created_at: iso(jours(90)) }];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

// Un pont d'extension SIMULÉ (forme de `pont.cjs`, réduite) : une extension à
// jour, connectée à VRM, un compte Vinted ouvert dans Chrome. Sans lui, la
// pastille dit « absente » et le panneau ne montre qu'UN maillon (exprès : sans
// extension ici, « compte VRM » et « compte Vinted » n'ont rien à dire).
const EXT_ATTENDUE = (/const EXT_ATTENDUE = '([^']+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '5.280.0';
const PONT_MINI = ({ version, extId }) => {
  const post = (m) => window.postMessage(m, '*');
  window.chrome = { runtime: { lastError: null, sendMessage(id, msg, cb) { setTimeout(() => cb && cb(msg && msg.type === 'liaison' ? { ok: true, besoin: false } : { ok: true }), 5); } } };
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: extId });
    if (d.__vmr === 'etat' && d.reqId) post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, ext: extId, vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_invente' }, cmds: {} } });
    if (d.__vmr === 'cmd' && d.reqId) post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'recent' } });
  });
  post({ __vmr: 'ready', version, id: extId });
};

async function ouvrir(b, vp, sombre, { pont = false } = {}) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_astuce_numeros', 'false'); if (s) { localStorage.setItem('vinted_dark', 'true'); localStorage.setItem('vrm_bascule_mineral_v1', '1'); } } catch (_) {} }, sombre);
  if (pont) await pg.addInitScript(PONT_MINI, { version: EXT_ATTENDUE, extId: 'abcdefghijklmnopabcdefghijklmnop' });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(maintenant), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, tel };
}
const capture = async (pg, nom) => { if (!CAP) return; fs.mkdirSync(CAP, { recursive: true }); await pg.screenshot({ path: path.join(CAP, nom + '.png') }); };
const lum = (rgb) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(rgb || ''); if (!m) return null; const c = [m[1], m[2], m[3]].map((x) => { x = Number(x) / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };

async function sectionAnnonces(b, vp, sombre) {
  const { ctx, pg, errs, tel } = await ouvrir(b, vp, sombre);
  const nom = `${vp.width}${sombre ? ' sombre' : ''}`;
  try {
    await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('[data-carte-annonce="9201"]', { timeout: 15000 }).catch(() => {});
    await pg.waitForTimeout(800);
    await capture(pg, `annonces-${vp.width}${sombre ? '-sombre' : ''}`);
    if (CAP) { const c = pg.locator('[data-carte-annonce="9201"]'); if (await c.count()) { await c.scrollIntoViewIfNeeded(); await c.screenshot({ path: path.join(CAP, `fiche-${vp.width}${sombre ? '-sombre' : ''}.png`) }).catch(() => {}); } }
    const r = await pg.evaluate(() => {
      const carte = (id) => document.querySelector(`[data-carte-annonce="${id}"]`);
      const box = (el) => { if (!el) return null; const q = el.getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; };
      const niveaux = {}; const mots = {};
      for (const id of ['9201', '9202', '9203', '9204', '9205', '9206']) {
        const c = carte(id); const v = c && c.querySelector('[data-fiche-etat] [data-etat-niveau]');
        niveaux[id] = v ? v.getAttribute('data-etat-niveau') : null;
        const m = c && c.querySelector('.vrm-fiche-etat-mot');
        mots[id] = m ? { t: m.textContent, coupe: m.scrollWidth > m.clientWidth + 1 || m.scrollHeight > m.clientHeight + 1 } : null;
      }
      const c1 = carte('9201');
      const gestes = c1 ? [...c1.querySelectorAll('[data-fiche-gestes] .vrm-fiche-geste')].filter((g) => g.offsetParent !== null).map((g) => ({ t: g.textContent.trim(), h: g.getBoundingClientRect().height })) : [];
      // Les cases qu'on tape (prix d'achat, mini, refuse, boost) : c'est le BOUTON qui se mesure (pas un voile).
      const cases = c1 ? [...c1.querySelectorAll('.vrm-fiche-cell [data-edition]')].filter((g) => g.offsetParent !== null).map((g) => ({ t: g.getAttribute('data-edition'), h: g.getBoundingClientRect().height })) : [];
      const fond = getComputedStyle(document.body).backgroundColor, fondCarte = c1 ? getComputedStyle(c1).backgroundColor : '';
      return {
        photo: box(c1 && c1.querySelector('[data-fiche-photo]')), carte: box(c1),
        etat: box(c1 && c1.querySelector('[data-fiche-etat]')), achat: box(c1 && c1.querySelector('[data-fiche-achat]')),
        achatEtat: c1 && (c1.querySelector('[data-fiche-achat]') || {}).getAttribute && c1.querySelector('[data-fiche-achat]').getAttribute('data-fiche-achat'),
        achat2: (carte('9202') && carte('9202').querySelector('[data-fiche-achat]') || { getAttribute: () => null }).getAttribute('data-fiche-achat'),
        niveaux, mots, gestes, cases,
        detailsGerer: document.querySelectorAll('details.vrm-ann-actions').length,
        plusVisible: !!(c1 && c1.querySelector('[data-fiche-plus]') && c1.querySelector('[data-fiche-plus]').offsetParent !== null),
        infos: !!(c1 && c1.querySelector('[data-fiche-infos] [data-prepa]')),
        nbCartes: document.querySelectorAll('[data-carte-annonce]').length,
        sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        fond, fondCarte,
      };
    });
    dit(!errs.length, `A ${nom} · aucune erreur`, errs[0]);
    dit(r.nbCartes === 6, `A ${nom} · les six annonces inventées sont rendues`, r.nbCartes);
    const plancher = tel ? 300 : 330;
    dit(r.photo && r.photo.w >= plancher && r.photo.h >= plancher && r.photo.w >= r.carte.w - 2, `A ${nom} · la photo est en grand (≥ ${plancher} px, toute la largeur de la fiche)`, r.photo && `${Math.round(r.photo.w)}×${Math.round(r.photo.h)} · fiche ${Math.round(r.carte.w)}`);
    dit(JSON.stringify(r.niveaux) === JSON.stringify(ATTENDU), `A ${nom} · l'état en jauge suit la donnée (neuf avec étiquette 5 · sans étiquette 4 · très bon 3 · satisfaisant 1 · inconnu · aucun)`, JSON.stringify(r.niveaux));
    const coupes = Object.entries(r.mots).filter(([, m]) => !m || m.coupe).map(([id, m]) => `${id}:${m ? m.t : 'absent'}`);
    dit(coupes.length === 0 && /Neuf avec étiquette/.test((r.mots['9201'] || {}).t || '') && /Comme neuf \(vintage\)/.test((r.mots['9205'] || {}).t || ''), `A ${nom} · le mot de l'état se lit EN ENTIER (même « Neuf avec étiquette », et un état inconnu tel que Vinted l'écrit)`, coupes.join(' · '));
    dit(r.etat && r.achat && Math.abs(r.etat.y - r.achat.y) < 2 && r.achat.x > r.etat.x + r.etat.w - 1, `A ${nom} · le prix d'achat est À CÔTÉ de l'état`, r.etat && r.achat && `état x${Math.round(r.etat.x)} y${Math.round(r.etat.y)} · achat x${Math.round(r.achat.x)} y${Math.round(r.achat.y)}`);
    dit(r.achatEtat === 'connu' && r.achat2 === 'inconnu', `A ${nom} · le prix d'achat dit connu / inconnu selon la fiche`, `${r.achatEtat} / ${r.achat2}`);
    dit(r.detailsGerer === 0, `A ${nom} · plus de « ⋯ Gérer l'annonce » replié`, r.detailsGerer);
    const noms = r.gestes.map((g) => g.t).join(' | ');
    dit(r.plusVisible && /Passeport/.test(noms) && /Marquer vendue/.test(noms) && /Relier un achat/.test(noms) && r.infos, `A ${nom} · ce qui était dans « ⋯ » est à la vue (gestes + infos de préparation)`, noms);
    const petits = r.gestes.filter((g) => g.h < (tel ? 43.5 : 35.5));
    dit(petits.length === 0, `A ${nom} · chaque geste fait ${tel ? '44' : '36'} px au moins`, petits.map((g) => `${g.t} ${Math.round(g.h)}`).join(' · '));
    if (tel) { const cp = r.cases.filter((g) => g.h < 43.5); dit(r.cases.length >= 4 && cp.length === 0, `A ${nom} · chaque case qu'on tape (achat, mini, refuse, boost) fait 44 px au doigt`, `${r.cases.length} case(s) · ` + cp.map((g) => `${g.t} ${Math.round(g.h)}`).join(' · ')); }
    dit(r.sw <= r.cw + 1, `A ${nom} · aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
    if (sombre) { const lb = lum(r.fond), lc = lum(r.fondCarte); dit(lb != null && lb < 0.05 && lc != null && lc < 0.08, `A ${nom} · fond et fiche sombres`, `${r.fond} · ${r.fondCarte}`); }
    // Saisie du prix d'achat EN PLACE, à côté de l'état : la carte le dit, et il est enregistré.
    if (!sombre) {
      try {
        await pg.click('[data-carte-annonce="9202"] [data-fiche-achat] [data-edition="achat"]', { timeout: 5000 });
        await pg.keyboard.type('32');
        await pg.keyboard.press('Enter');
        await pg.waitForTimeout(900);
        const apres = await pg.evaluate(() => {
          const c = document.querySelector('[data-carte-annonce="9202"] [data-fiche-achat]');
          let rang = null; try { rang = (JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}')['9202'] || {}).buyPrice; } catch (_) {}
          return { attr: c && c.getAttribute('data-fiche-achat'), t: c ? c.innerText : '', rang };
        });
        dit(apres.attr === 'connu' && /32(,00)?\s*€/.test(apres.t) && String(apres.rang).replace(',', '.') === '32', `A ${nom} · taper 32 dans « Prix d'achat » : la case dit 32 € et la fiche l'enregistre`, JSON.stringify(apres));
      } catch (e) { dit(false, `A ${nom} · saisie du prix d'achat en place`, String(e.message).slice(0, 120)); }
    }
    // ── B. Offres automatiques : une ligne courte, le détail derrière ⓘ.
    const o = await pg.evaluate(() => {
      const c = document.querySelector('[data-offres-auto-carte]'); if (!c) return null;
      const ligne = c.querySelector('.vrm-offres-auto-ligne');
      const sw = c.querySelector('[data-offres-auto-toggle]'), piste = c.querySelector('.vrm-offres-auto-piste'), info = c.querySelector('[data-offres-auto-info]');
      const bb = (el) => el ? el.getBoundingClientRect() : null;
      return { etat: c.getAttribute('data-offres-auto-etat'), h: bb(c).height, ligneH: ligne ? bb(ligne).height : null,
        texte: c.innerText.length, textarea: c.querySelectorAll('textarea').length, detail: !!c.querySelector('[data-offres-auto-detail]'),
        statut: (c.querySelector('[data-offres-auto-statut]') || {}).textContent || '',
        sw: sw && { w: bb(sw).width, h: bb(sw).height }, piste: piste && { w: bb(piste).width, h: bb(piste).height }, info: info && { w: bb(info).width, h: bb(info).height } };
    });
    dit(!!o, `B ${nom} · la carte des offres automatiques est là`);
    if (o) {
      dit(o.etat === 'off' && o.h <= 70 && o.textarea === 0 && !o.detail && o.texte < 60, `B ${nom} · éteintes : UNE ligne courte (≤ 70 px), aucun paragraphe ni champ`, `${Math.round(o.h)} px · ${o.texte} car. · « ${o.statut} »`);
      dit(o.piste && Math.abs(o.piste.w - 46) < 3 && Math.abs(o.piste.h - 28) < 3 && o.piste.w > o.piste.h * 1.4, `B ${nom} · l'interrupteur garde sa forme de pilule (46 × 28)`, o.piste && `${Math.round(o.piste.w)}×${Math.round(o.piste.h)}`);
      dit(o.sw && o.sw.h >= (tel ? 43.5 : 43.5) && o.info && o.info.h >= 43.5 && o.info.w >= 43.5, `B ${nom} · ⓘ et l'interrupteur font 44 px au doigt`, `switch ${o.sw ? Math.round(o.sw.w) + '×' + Math.round(o.sw.h) : 'absent'} · ⓘ ${o.info ? Math.round(o.info.w) + '×' + Math.round(o.info.h) : 'absent'}`);
      if (!sombre) {
        try {
          await pg.click('[data-offres-auto-info]');
          await pg.waitForTimeout(200);
          const d = await pg.evaluate(() => ({ detail: !!document.querySelector('[data-offres-auto-detail]'), exp: document.querySelector('[data-offres-auto-info]').getAttribute('aria-expanded') }));
          dit(d.detail && d.exp === 'true', `B ${nom} · ⓘ déplie le fonctionnement`, JSON.stringify(d));
          await pg.click('[data-offres-auto-toggle]');
          await pg.waitForTimeout(300);
          const confirme = await pg.getByRole('button', { name: 'Oui, accepter tout seul', exact: true }).isVisible().catch(() => false);
          const encoreOff = await pg.evaluate(() => document.querySelector('[data-offres-auto-carte]').getAttribute('data-offres-auto-etat'));
          dit(confirme && encoreOff === 'off', `B ${nom} · allumer DEMANDE une confirmation (rien ne change avant)`, `${confirme} · ${encoreOff}`);
          if (confirme) await pg.getByRole('button', { name: 'Oui, accepter tout seul', exact: true }).click();
          await pg.waitForTimeout(400);
          const on = await pg.evaluate(() => { const c = document.querySelector('[data-offres-auto-carte]'); return { etat: c.getAttribute('data-offres-auto-etat'), mini: c.getAttribute('data-offres-auto-mini'), statut: (c.querySelector('[data-offres-auto-statut]') || {}).textContent || '', refus: !!c.querySelector('[data-offre-refus-msg]') }; });
          dit(on.etat === 'on' && on.mini === '2' && /2 annonces/.test(on.statut) && on.refus, `B ${nom} · allumées : le statut compte les annonces avec un mini (2), le message de refus est dans le détail`, JSON.stringify(on));
          await pg.click('[data-offres-auto-toggle]');
          await pg.waitForTimeout(300);
          const off = await pg.evaluate(() => document.querySelector('[data-offres-auto-carte]').getAttribute('data-offres-auto-etat'));
          dit(off === 'off', `B ${nom} · éteindre se fait d'un geste, sans question`, off);
        } catch (e) { dit(false, `B ${nom} · le parcours ⓘ / allumer / éteindre`, String(e.message).slice(0, 120)); }
      }
    }
  } catch (e) { dit(false, `A ${nom} · l'écran Annonces se rend`, String(e.message).slice(0, 140)); }
  await ctx.close();
}

async function ouvrirCalendrier(pg, racine) {
  const declencheur = pg.locator(`${racine} [data-periode-ouvrir]`).first();
  await declencheur.click({ timeout: 6000 });
  await pg.waitForSelector('[data-periode-panneau]', { timeout: 4000 });
}

async function sectionCalendrier(b, vp, sombre) {
  const { ctx, pg, errs, tel } = await ouvrir(b, vp, sombre);
  const nom = `${vp.width}${sombre ? ' sombre' : ''}`;
  const lignes = () => pg.evaluate(() => document.querySelectorAll('[data-plateforme-vente="vinted"]').length);
  try {
    await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('[data-periode-ouvrir]', { timeout: 15000 }).catch(() => {});
    await pg.waitForFunction(() => document.querySelectorAll('[data-plateforme-vente="vinted"]').length >= 5, null, { timeout: 10000 }).catch(() => {});
    const n0 = await lignes();
    dit(n0 === 5, `C ${nom} · Ventes : les cinq ventes inventées sans période`, n0);
    await ouvrirCalendrier(pg, '');
    // La feuille MONTE (animation) : on la mesure une fois arrivée — même boîte
    // deux fois de suite à 120 ms d'écart — jamais au milieu du mouvement.
    await pg.waitForFunction(() => {
      const pan = document.querySelector('[data-periode-panneau]'); if (!pan) return false;
      // Sous charge, la première image peut tarder : deux mesures égales AVANT le
      // départ de l'animation (décalée de 24 px) passaient pour « arrivée ».
      if (pan.getAnimations && pan.getAnimations({ subtree: true }).some((a) => a.playState !== 'finished')) { window.__vuiPan = ''; return false; }
      const q = pan.getBoundingClientRect(), k = [q.left, q.top, q.width, q.height].map(Math.round).join(',');
      const ok = window.__vuiPan === k; window.__vuiPan = k; return ok;
    }, null, { timeout: 8000, polling: 120 }).catch(() => {});
    await capture(pg, `calendrier-${vp.width}${sombre ? '-sombre' : ''}`);
    const p = await pg.evaluate(() => {
      const pan = document.querySelector('[data-periode-panneau]');
      const mois = [...pan.querySelectorAll('[data-periode-mois]')].map((m) => { const q = m.getBoundingClientRect(); return { k: m.getAttribute('data-periode-mois'), x: q.left, y: q.top, w: q.width }; });
      const q = pan.getBoundingClientRect();
      const jours = [...pan.querySelectorAll('[data-jour]')].filter((j) => !j.disabled).slice(0, 40).map((j) => j.getBoundingClientRect()).map((r) => Math.min(r.width, r.height));
      const rac = [...pan.querySelectorAll('[data-periode-raccourci]')].map((x) => x.getAttribute('data-periode-raccourci'));
      const rangee = pan.querySelector('.vrm-cal-raccourcis'); const racH = rangee ? Math.min(rangee.getBoundingClientRect().height, ...[...rangee.querySelectorAll('button')].map((x) => x.getBoundingClientRect().height)) : 0;
      return { racH, mode: pan.getAttribute('data-periode-mode'), mois, pan: { x: q.left, y: q.top, w: q.width, h: q.height, r: q.right, b: q.bottom }, minJour: Math.min(...jours), rac, fond: getComputedStyle(pan).backgroundColor, vw: innerWidth, vh: innerHeight };
    });
    if (tel) {
      dit(p.mode === 'defile' && p.mois.length >= 12 && p.mois.every((m, i, a) => i === 0 || m.y > a[i - 1].y), `C ${nom} · au doigt : UN calendrier qui défile (mois l'un sous l'autre)`, `${p.mode} · ${p.mois.length} mois`);
      dit(p.minJour >= 43.5, `C ${nom} · chaque jour se touche (44 px au moins)`, Math.round(p.minJour));
      dit(p.pan.x >= -1 && p.pan.r <= p.vw + 1 && p.pan.b <= p.vh + 1, `C ${nom} · la feuille tient dans l'écran`, JSON.stringify(p.pan));
    } else {
      const [g, d] = p.mois;
      dit(p.mode === 'deux-mois' && p.mois.length === 2 && Math.abs(g.y - d.y) < 2 && d.x >= g.x + g.w - 1, `C ${nom} · à l'ordinateur : deux mois CÔTE À CÔTE`, JSON.stringify(p.mois.map((m) => m.k)));
      dit(p.mois.length === 2 && p.mois[1].k === cle(maintenant).slice(0, 7), `C ${nom} · le mois en cours à droite`, p.mois.map((m) => m.k).join(' · '));
      dit(p.pan.x >= -1 && p.pan.r <= p.vw + 1, `C ${nom} · le panneau tient dans l'écran`, JSON.stringify(p.pan));
    }
    dit(p.racH >= (tel ? 43.5 : 33.5), `C ${nom} · les raccourcis se voient en entier et se touchent (${tel ? '44 px au doigt' : 'à la souris'})`, p.racH.toFixed(1));
    dit(['j7', 'j30', 'mois', 'dernier', 'annee'].every((k) => p.rac.includes(k)), `C ${nom} · les cinq raccourcis (7 j · 30 j · ce mois · mois dernier · cette année)`, p.rac.join(','));
    if (sombre) dit(lum(p.fond) != null && lum(p.fond) < 0.08, `C ${nom} · le calendrier est sombre`, p.fond);
    if (!sombre) {
      // Raccourci « 7 jours » : un toucher applique, deux ventes restent.
      await pg.click('[data-periode-panneau] [data-periode-raccourci="j7"]');
      await pg.waitForTimeout(500);
      const v7 = await pg.evaluate(() => ({ val: (document.querySelector('[data-periode-ouvrir]') || {}).getAttribute('data-periode-valeur'), lib: (document.querySelector('[data-periode-libelle]') || {}).textContent, ouvert: !!document.querySelector('[data-periode-panneau]') }));
      const n7 = await lignes();
      const debut7 = cle(jours(6)), fin7 = cle(maintenant);
      dit(!v7.ouvert && v7.val === `${debut7}..${fin7}` && n7 === 2, `C ${nom} · « 7 jours » applique : ${debut7} → ${fin7}, deux ventes`, `${v7.val} · ${n7} vente(s) · « ${v7.lib} »`);
      // Deux touchers + Appliquer : du 25e au 15e jour avant aujourd'hui → la vente du 20e jour.
      await ouvrirCalendrier(pg, '');
      const du = cle(jours(25)), au = cle(jours(15));
      await pg.click(`[data-periode-panneau] [data-jour="${du}"]`);
      const mi = await pg.evaluate(() => (document.querySelector('[data-periode-plage]') || {}).getAttribute('data-periode-plage'));
      await pg.click(`[data-periode-panneau] [data-jour="${au}"]`);
      const plage = await pg.evaluate(() => { const e = document.querySelector('[data-periode-plage]'); return { etat: e.getAttribute('data-periode-plage'), du: e.getAttribute('data-periode-du'), au: e.getAttribute('data-periode-au'), t: e.textContent, dans: document.querySelectorAll('[data-periode-panneau] [data-etat="dans"]').length }; });
      dit(mi === 'debut' && plage.etat === 'choisie' && plage.du === du && plage.au === au && plage.dans >= 9 && /\d+ jours/.test(plage.t), `C ${nom} · premier toucher = début, second = fin ; la plage se dessine et se lit en clair`, JSON.stringify(plage));
      await pg.click('[data-periode-panneau] [data-periode-appliquer]');
      await pg.waitForTimeout(500);
      const nR = await lignes();
      const vR = await pg.evaluate(() => ({ val: document.querySelector('[data-periode-ouvrir]').getAttribute('data-periode-valeur'), lib: document.querySelector('[data-periode-libelle]').textContent }));
      dit(nR === 1 && vR.val === `${du}..${au}` && /^Du \d+/.test(vR.lib), `C ${nom} · Appliquer filtre la liste (une vente) et le bouton dit la plage en clair`, `${nR} · ${JSON.stringify(vR)}`);
      // Effacer revient à toute la période.
      await ouvrirCalendrier(pg, '');
      await pg.click('[data-periode-panneau] [data-periode-effacer]');
      await pg.waitForTimeout(500);
      dit((await lignes()) === 5, `C ${nom} · Effacer revient à toutes les ventes`, await lignes());
      // Le MÊME composant sur Achats et Statistiques.
      await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-achats-onglet="all"]', { timeout: 12000 }).catch(() => {});
      await pg.click('[data-achats-onglet="all"]').catch(() => {});
      await pg.waitForTimeout(600);
      const achats = await pg.evaluate(() => document.querySelectorAll('[data-periode-ouvrir]').length);
      dit(achats >= 1, `C ${nom} · Achats : le même calendrier`, achats);
      if (achats) { await ouvrirCalendrier(pg, ''); const m = await pg.evaluate(() => document.querySelector('[data-periode-panneau]').getAttribute('data-periode-mode')); dit(m === (tel ? 'defile' : 'deux-mois'), `C ${nom} · Achats : il s'ouvre comme sur Ventes`, m); }
      await pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-periode-ouvrir]', { timeout: 12000 }).catch(() => {});
      const stats = await pg.evaluate(() => document.querySelectorAll('[data-periode-ouvrir]').length);
      dit(stats >= 1, `C ${nom} · Statistiques (CA entre deux dates) : le même calendrier`, stats);
      if (stats) {
        await ouvrirCalendrier(pg, '');
        await pg.click('[data-periode-panneau] [data-periode-raccourci="mois"]');
        await pg.waitForTimeout(400);
        const lib = await pg.evaluate(() => document.querySelector('[data-periode-libelle]').textContent);
        dit(/[a-zé]+ \d{4}/i.test(lib), `C ${nom} · Statistiques : « Ce mois » s'écrit en clair`, lib);
      }
    }
    dit(!errs.length, `C ${nom} · aucune erreur`, errs[0]);
  } catch (e) { dit(false, `C ${nom} · le calendrier se déroule`, String(e.message).slice(0, 160)); }
  await ctx.close();
}

async function sectionPastille(b, vp, sombre, pont = false) {
  const { ctx, pg, errs, tel } = await ouvrir(b, vp, sombre, { pont });
  const nom = `${vp.width}${sombre ? ' sombre' : ''}${pont ? ' · extension branchée' : ''}`;
  try {
    await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('[data-etat-actions]', { timeout: 15000 });
    await pg.waitForTimeout(1500);
    const p = await pg.evaluate(() => { const el = [...document.querySelectorAll('[data-etat-actions]')].find((e) => e.offsetParent !== null); if (!el) return null; const q = el.getBoundingClientRect(); return { ton: el.getAttribute('data-etat-ton'), code: el.getAttribute('data-etat-code'), chevron: !!(el.querySelector('.vrm-etat-chevron') && el.querySelector('.vrm-etat-chevron').offsetParent !== null), h: q.height, w: q.width, point: !!el.querySelector('.vrm-etat-point') }; });
    dit(!!p && ['ok', 'attention', 'neutre'].includes(p.ton) && p.point, `D ${nom} · la pastille porte son ton et son point`, JSON.stringify(p));
    if (p) {
      if (!tel) dit(p.chevron, `D ${nom} · à l'ordinateur, un chevron dit qu'elle s'ouvre`, p.chevron);
      dit(p.h >= 31.5, `D ${nom} · la pastille se touche`, Math.round(p.h));
      await pg.locator('[data-etat-actions]').filter({ visible: true }).first().click();
      await pg.waitForSelector('[data-etat-panneau]', { timeout: 4000 });
      await pg.waitForTimeout(350);
      await capture(pg, `pastille-${vp.width}${sombre ? '-sombre' : ''}`);
      const q = await pg.evaluate(() => {
        const pan = document.querySelector('[data-etat-panneau]'); const r = pan.getBoundingClientRect();
        const tete = pan.querySelector('[data-etat-tete]'), chaine = pan.querySelector('[data-etat-chaine]');
        const maillons = chaine ? [...chaine.querySelectorAll('[data-etat-maillon]')].map((m) => m.getAttribute('data-etat-maillon')) : [];
        const zone = pan.querySelector('[data-etat-geste-zone]'); const zr = zone && zone.getBoundingClientRect();
        const geste = zone && zone.querySelector('button, a'); const gr = geste && geste.getBoundingClientRect();
        return { ton: pan.getAttribute('data-etat-ton'), tete: !!(tete && tete.querySelector('.vrm-etat-titre') && tete.querySelector('.vrm-etat-titre').textContent.trim()), maillons,
          r: { x: r.left, y: r.top, rr: r.right, b: r.bottom }, vw: innerWidth, vh: innerHeight,
          zone: zr && { w: zr.width, pan: r.width }, geste: gr && { h: gr.height, w: gr.width }, fond: getComputedStyle(pan).backgroundColor };
      });
      // Branchée : les trois maillons, tous ✓. Sans extension ici : UN maillon
      // (extension — absente ou « sur l'ordinateur »), jamais deux lignes vides.
      const attendu = pont ? ['oui', 'oui', 'oui'] : tel ? ['passu'] : ['non'];
      dit(q.tete && JSON.stringify(q.maillons) === JSON.stringify(attendu), `D ${nom} · le panneau : un en-tête puis la chaîne des maillons (${attendu.join(' · ')})`, JSON.stringify(q.maillons));
      if (pont) dit(p.ton === 'ok' && p.code === 'ok', `D ${nom} · extension à jour et connectée : la pastille dit « Actions possibles » (ton ok)`, JSON.stringify(p));
      dit(q.ton === p.ton, `D ${nom} · le panneau garde le ton de la pastille (même source)`, `${q.ton} / ${p.ton}`);
      dit(q.r.x >= -1 && q.r.rr <= q.vw + 1 && q.r.b <= q.vh + 1, `D ${nom} · le panneau tient dans l'écran`, JSON.stringify(q.r));
      dit(!q.zone || q.zone.w >= q.zone.pan - 40, `D ${nom} · le geste occupe le bas du panneau`, JSON.stringify(q.zone));
      dit(!q.geste || q.geste.h >= (tel ? 43.5 : 39.5), `D ${nom} · le geste se touche`, JSON.stringify(q.geste));
      if (sombre) dit(lum(q.fond) != null && lum(q.fond) < 0.08, `D ${nom} · le panneau est sombre`, q.fond);
    }
    dit(!errs.length, `D ${nom} · aucune erreur`, errs[0]);
  } catch (e) { dit(false, `D ${nom} · la pastille s'ouvre`, String(e.message).slice(0, 160)); }
  await ctx.close();
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const tailles = [{ width: 390, height: 844 }, { width: 1512, height: 950 }];
    const seule = process.env.SECTIONS ? process.env.SECTIONS.split(',') : ['A', 'C', 'D'];
    for (const vp of tailles) {
      for (const sombre of [false, true]) {
        console.log(`── ${vp.width} px${sombre ? ' · sombre' : ''}`);
        if (seule.includes('A')) await sectionAnnonces(b, vp, sombre);
        if (seule.includes('C')) await sectionCalendrier(b, vp, sombre);
        if (seule.includes('D')) { await sectionPastille(b, vp, sombre); if (vp.width >= 1024) await sectionPastille(b, vp, sombre, true); }
      }
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e.message).slice(0, 160)); }
  if (b) await b.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} écrans Vinted du 29 oct. : ${ko ? ko + ' rouge(s)' : 'tout est vert'}`);
  process.exit(ko ? 1 : 0);
})();
