// Banc : « Deux comptes, une paire » (Ma journée → feuille) et Vestiaire « Ont aimé tes articles »
// (15 nov., lots deux-comptes et favoris-sites). Données INVENTÉES (le dépôt est public), à la forme
// des lignes réelles : `harvest_{uid}_listings` (`capturedAt`, `payload.items`), `main.vinted_annonce_numeros`,
// `photo_emprunte_{uid}` (`payload.annonces`), `vc_listings`, `vc_aimes` (des NOMBRES), `vc_offres_recette`.
// 390 tactile (deviceScaleFactor 2) et 1512, clair et sombre. Il juge ce qui est RENDU :
//   A. la même PHOTO EXACTE sur deux comptes : UNE carte « N°12 en vente sur deux comptes » dans « À faire »,
//      titre sur une ligne, ligne en ambre ; plus de carte « en ligne deux fois » pour elle ; la feuille : les
//      deux annonces CÔTE À CÔTE (photo, compte, prix, depuis), « Retirer celle de compte-beta-long » = un LIEN
//      vers vinted.fr (nouvel onglet) ; le toucher n'envoie AUCUNE commande à l'extension, il note l'heure
//      (`vrm_deux_comptes_retraits`) et la feuille dit « Ouverte à … VRM relira » ; ≤ 1 bouton plein ;
//   P. la même photo à l'EMPREINTE (unique) : « À vérifier », « C'est la même paire » et « Ce n'est pas la même » ;
//   B. 50 paires identiques (même titre, empreintes toutes proches, deux comptes) : AUCUNE carte ;
//   V. Messages · Vestiaire : « Ont aimé tes articles » (3 personnes), « Faire une offre » ⇒ la feuille, −5 % ⇒
//      « Envoyer l'offre de 236 € à 3 personnes » ⇒ UNE commande `vcOffreAimes` ; sans recette : les 3 étapes,
//      aucun bouton d'envoi.
// Lancer : npm run build && NODE_OPTIONS="--require $PWD/scripts/bancs/_porte-banc.cjs" BANC_PORT=9661 node scripts/bancs/deux-comptes.cjs
// Captures : CAPTURES=<dossier>.  `BANC_DIST=<dist>` : rendre un autre build (l'arbre d'avant).
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 9661;
const CAPT = process.env.CAPTURES || '';
// `VUES=390-clair,1512-sombre` : seulement ces rendus.
const VUES = String(process.env.VUES || '').split(',').map((x) => x.trim()).filter(Boolean);

const maintenant = new Date(2026, 10, 15, 15, 30, 0);
const MS = maintenant.getTime();
const iso = (h) => new Date(MS - h * 3600e3).toISOString();
const A = '111', B = '222';
const ACCOUNTS = [
  { id: 1, vinted_user_id: A, login: 'compte-alpha', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
  { id: 2, vinted_user_id: B, login: 'compte-beta-long-nom', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
];
const photo = (dossier, fichier, taille = 'f800') => `https://images1.vinted.net/t/${dossier}/${taille}/${fichier}.jpeg?s=abc`;
const annonce = (id, title, ph, prix = '60.0', jours = 10, fav = 1) => ({ id, title, photo: ph, url: `https://www.vinted.fr/items/${id}-annonce`, price: { amount: prix, currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false,
  created_at_ts: Math.round((MS - jours * 864e5) / 1000), favourite_count: fav, view_count: 10 });
let graine = 11;
const hasard = () => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine; };
const hex = () => Array.from({ length: 96 }, () => ((hasard() >> 16) % 16).toString(16)).join('');
const voisine = (h, k) => { const c = h.split(''); for (let b = 0; b < 6; b++) for (let i = 0; i < k; i++) { const p = b * 16 + i; c[p] = (parseInt(c[p], 16) ^ 1).toString(16); } return c.join(''); };
const cleP = (u) => u.split('?')[0];

const SCENARIOS = {
  A: (() => {
    const pA = [annonce(5000001, 'Nike Air Max 90 blanc 42', photo('05_aaa_d1', '1700000001'), '85.0', 21, 9), annonce(5000002, 'Adidas Samba noir 41', photo('05_bbb_d2', '1700000002'))];
    const pB = [annonce(6000001, 'Air Max 90 blanche', photo('05_aaa_d1', '1700000001', 'f310'), '79.0', 3, 1), annonce(6000002, 'Asics Gel bleu 43', photo('05_ddd_d4', '1700000004'))];
    return { listings: { [A]: { cap: iso(1), items: pA }, [B]: { cap: iso(2), items: pB } },
      fiches: { 5000001: { numero: '12', photoK: '05_aaa_d1/1700000001' }, 5000002: { numero: '13', photoK: '05_bbb_d2/1700000002' }, 6000001: { numero: '40', photoK: '05_aaa_d1/1700000001' }, 6000002: { numero: '41', photoK: '05_ddd_d4/1700000004' } },
      empreintes: null };
  })(),
  P: (() => {
    const h = hex();
    const a = annonce(5100001, 'Jordan 1 Mid 43', photo('05_p1', '1800000001'), '120.0', 30, 6), b = annonce(6100001, 'Jordan 1 Mid gris 43', photo('05_p2', '1800000002'), '115.0', 2, 0);
    return { listings: { [A]: { cap: iso(1), items: [a] }, [B]: { cap: iso(1), items: [b] } },
      fiches: { 5100001: { numero: '42', photoK: '05_p1/1800000001' }, 6100001: { numero: '57', photoK: '05_p2/1800000002' } },
      empreintes: { [A]: { 5100001: { [cleP(a.photo)]: h } }, [B]: { 6100001: { [cleP(b.photo)]: voisine(h, 3) } } } };
  })(),
  B: (() => {
    const base = hex(), lA = [], lB = [], fiches = {}, eA = {}, eB = {};
    for (let i = 0; i < 50; i++) {
      const id = 7000000 + i, ph = photo(`05_${i}_x${i}`, `17100000${i}`);
      (i % 2 ? lA : lB).push(annonce(id, 'Nike Dunk Low Panda 42', ph));
      fiches[id] = { numero: String(100 + i), photoK: `05_${i}_x${i}/17100000${i}` };
      (i % 2 ? eA : eB)[id] = { [cleP(ph)]: voisine(base, (i % 3) + 1) };
    }
    return { listings: { [A]: { cap: iso(1), items: lA }, [B]: { cap: iso(1), items: lB } }, fiches, empreintes: { [A]: eA, [B]: eB } };
  })(),
};

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d && !c ? ' — ' + String(d).slice(0, 300) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 300)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = row.data && row.data.capturedAt || maintenant.toISOString(); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v === 'object' ? JSON.stringify(v) : (/->>/.test(src) ? String(v) : v));
  }
  return out;
};
// Le faux pont de l'extension : il NOTE chaque commande (aucune ne doit partir du retrait).
const PONT = ({ version }) => {
  window.__cmds = [];
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: 'ext-banc' });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, ext: 'ext-banc', vrm: { ok: true, connecte: true, email: '' }, vinted: null, cmds: {}, vcOffreAimes: true } });
    if (d.__vmr === 'cmd') {
      window.__cmds.push(JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k]) => !['__vmr', 'reqId'].includes(k)))));
      const resp = d.cmd === 'vcOffreAimes' ? { accepte: true, etape: 'encours', n: 3, reste: 0 } : { accepte: false, code: 'inconnue' };
      setTimeout(() => post({ __vmr: 'cmd:result', reqId: d.reqId, resp }), 120);
    }
  });
  post({ __vmr: 'ready', version, id: 'ext-banc' });
};

async function ouvrir(b, vp, sc, { sombre = false, onglet = 'journee', vc = null } = {}) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: tel ? 2 : 1, ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = [], ecritures = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_prenom', JSON.stringify('Julien')); if (s) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, sombre);
  await pg.addInitScript(PONT, { version: '5.395.0' });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font', 'document'].includes(r.request().resourceType()) || /api-adresse|openfreemap/.test(r.request().url()) ? r.abort() : r.continue()));
  const LIGNES = sc ? Object.entries(sc.listings).map(([uid, l]) => ({ id: `harvest_${uid}_listings`, data: { capturedAt: l.cap, uid, payload: { items: l.items, pagination: { total_entries: l.items.length } } } })) : [];
  if (sc && sc.empreintes) for (const [uid, an] of Object.entries(sc.empreintes)) LIGNES.push({ id: `photo_emprunte_${uid}`, data: { capturedAt: iso(1), payload: { version: 1, annonces: an } } });
  if (vc) LIGNES.push(...vc);
  const main = { vinted_annonce_numeros: sc ? sc.fiches : {} };
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { ecritures.push({ m: req.method(), u, corps: req.postData() || '' }); return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(sc ? ACCOUNTS : []);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: main }, sel)]);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const dans = /id=in\.\(([^)]*)\)/.exec(u);
    if (dans) { const ids = dans[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map((r) => projette(r, sel))); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${onglet}${onglet === 'messages' ? '&site=vestiaire' : ''}`, { waitUntil: 'domcontentloaded' });
  if (onglet === 'journee') {
    await pg.waitForFunction(() => document.querySelector('.vrm-fu-afaire, [data-tout-a-jour]') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 25000 }).catch(() => {});
    await pg.waitForFunction(() => document.querySelector('[data-journee-deux-comptes]'), null, { timeout: 8000 }).catch(() => {});
  } else await pg.waitForSelector('[data-vc-messages="lu"]', { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(1200);
  return { ctx, pg, errs, ecritures };
}
const capt = async (pg, nom) => { if (CAPT) { fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, nom + '.png') }); } };

const lireCarte = (pg) => pg.evaluate(() => {
  const c = document.querySelector('[data-journee-deux-comptes]');
  if (!c) return { carte: false, deuxFois: !!document.querySelector('[data-en-ligne-deux-fois]'), texte: document.body.innerText.slice(0, 300) };
  const t = c.querySelector('.vrm-day-task-title'), n = c.querySelector('.vrm-day-task-note');
  const lignesDe = (e) => { const rg = document.createRange(); rg.selectNodeContents(e); const ys = [...new Set([...rg.getClientRects()].filter((q) => q.width > 1).map((q) => Math.round((q.top + q.bottom) / 2)))].sort((a, b) => a - b); let k = 0, der = -1e9; for (const y of ys) { if (y - der > 4) { k++; der = y; } } return k; };
  return { carte: true, n: c.getAttribute('data-n'), ids: c.getAttribute('data-journee-deux-comptes'), titre: t && t.textContent, note: n && n.textContent, lt: t ? lignesDe(t) : 0,
    complet: c.getAttribute('title'), couleurNote: n && getComputedStyle(n).color, couleurTitre: t && getComputedStyle(t).color,
    deuxFois: [...document.querySelectorAll('[data-en-ligne-deux-fois]')].map((x) => x.getAttribute('data-en-ligne-deux-fois')).join(' '), deborde: document.documentElement.scrollWidth > window.innerWidth + 1 };
});
const lireFeuille = (pg) => pg.evaluate(() => {
  const s = document.querySelector('[data-deux-comptes]');
  if (!s) return { feuille: false };
  const an = [...s.querySelectorAll('[data-dc-annonce]')].map((e) => { const r = e.getBoundingClientRect(); return { id: e.getAttribute('data-dc-annonce'), role: e.getAttribute('data-dc-role'), prix: e.getAttribute('data-dc-prix'), depuis: e.getAttribute('data-dc-depuis'), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), droite: Math.round(r.right), t: e.innerText }; });
  const ret = s.querySelector('[data-dc-retirer]');
  const fs = document.querySelector('[data-feuille-deux-comptes]') || s;
  const fr = fs.getBoundingClientRect();
  const deborde = [...s.querySelectorAll('*')].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > fr.right + 1 || r.left < fr.left - 1); });
  return { feuille: true, etat: (s.querySelector('[data-dc-etat]') || { getAttribute: () => '' }).getAttribute('data-dc-etat'), an, ou: (s.querySelector('[data-dc-ou]') || {}).textContent || '',
    retirer: ret ? { href: ret.getAttribute('href'), cible: ret.getAttribute('target'), texte: ret.textContent, h: Math.round(ret.getBoundingClientRect().height), id: ret.getAttribute('data-dc-retirer') } : null,
    meme: !!s.querySelector('[data-dc-meme]'), pasMeme: !!s.querySelector('[data-dc-pas-meme]'), pleins: document.querySelectorAll('.sb-btn-plein').length,
    suite: (s.querySelector('[data-dc-suite]') || {}).textContent || '', deborde, largeur: window.innerWidth, ecran: document.documentElement.scrollWidth > window.innerWidth + 1 };
});

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 945 }]) for (const sombre of [false, true]) {
      const nom = `${vp.width}-${sombre ? 'sombre' : 'clair'}`;
      if (VUES.length && !VUES.includes(nom)) continue;
      console.log(`\n── ${nom}`);
      await essaie(`A ${nom}`, async () => {
        const { ctx, pg, errs, ecritures } = await ouvrir(b, vp, SCENARIOS.A, { sombre });
        await capt(pg, `deux-comptes-A-journee-${nom}`);
        const r = await lireCarte(pg);
        dit(r.carte, 'A · même photo exacte sur deux comptes : UNE carte « Deux comptes, une paire »', r.texte);
        if (r.carte) {
          dit(r.n === '1' && r.ids === '5000001+6000001', 'A · une paire, ses deux annonces', `${r.n} ${r.ids}`);
          // (16 nov., intégration vague C) À 1512, la carte est dans la colonne « À faire » de Ma journée (refonte-journee,
          // ≈ 340 px) : le titre y passe sur deux lignes comme les autres rangées, jamais coupé. Au téléphone : une ligne.
          dit(r.titre === 'N°12 en vente sur deux comptes' && (vp.width < 600 ? r.lt === 1 : r.lt <= 2), vp.width < 600 ? 'A · le titre « N°12 en vente sur deux comptes », sur UNE ligne' : 'A · le titre « N°12 en vente sur deux comptes », entier (deux lignes au plus dans la colonne « À faire »)', `${r.titre} / ${r.lt} lignes`);
          dit(/N°12 est en vente sur compte-alpha et compte-beta-long-nom/.test(r.complet || ''), 'A · la phrase entière (les deux comptes) dans l’infobulle', r.complet);
          const rgb = (s) => (/rgba?\(([^)]+)\)/.exec(s || '') || [])[1];
          dit(!!rgb(r.couleurNote) && rgb(r.couleurNote) !== rgb(r.couleurTitre) && !/184,\s*38,\s*26|255,\s*107,\s*94/.test(r.couleurNote), 'A · la ligne en AMBRE (jamais le rouge du doublon)', `${r.couleurNote} / ${r.couleurTitre}`);
          dit(!/5000001\+6000001/.test(r.deuxFois || ''), 'A · plus de carte « en ligne deux fois » pour cette paire (UN endroit)', r.deuxFois);
          dit(!r.deborde, 'A · aucun débordement horizontal');
        }
        await pg.click('[data-journee-deux-comptes]').catch(() => {});
        await pg.waitForSelector('[data-feuille-deux-comptes]', { timeout: 5000 }).catch(() => {});
        await pg.waitForTimeout(500);
        await capt(pg, `deux-comptes-A-feuille-${nom}`);
        const f = await lireFeuille(pg);
        dit(f.feuille && f.etat === 'sur', 'A · la feuille s’ouvre, « Sûr »', JSON.stringify(f).slice(0, 200));
        if (f.feuille) {
          const [g, rt] = f.an;
          dit(f.an.length === 2 && g.role === 'garder' && g.id === '5000001' && rt.role === 'retirer' && rt.id === '6000001', 'A · à garder : la plus aimée (compte-alpha, 9 favoris) ; à retirer : l’autre', JSON.stringify(f.an.map((x) => [x.id, x.role])));
          dit(f.an.length === 2 && Math.abs(g.y - rt.y) <= 2 && g.droite <= rt.x + 1, 'A · les deux annonces CÔTE À CÔTE', JSON.stringify(f.an.map((x) => [x.x, x.y, x.w])));
          dit(f.an.every((x) => x.prix && x.depuis && /compte-/.test(x.t) && /€/.test(x.t) && /En ligne depuis/.test(x.t)), 'A · chacune : compte, prix, depuis quand', JSON.stringify(f.an.map((x) => x.t.replace(/\s+/g, ' '))));
          dit(/compte-alpha et compte-beta-long-nom/.test(f.ou), 'A · « En vente sur compte-alpha et compte-beta-long-nom »', f.ou);
          dit(!!f.retirer && /^https:\/\/www\.vinted\.fr\/items\/6000001/.test(f.retirer.href) && f.retirer.cible === '_blank' && /Retirer celle de compte-beta-long-nom/.test(f.retirer.texte) && f.retirer.h >= 44, 'A · UN geste : « Retirer celle de compte-beta-long-nom », un lien vers l’annonce sur vinted.fr (44 px)', JSON.stringify(f.retirer));
          dit(f.pleins <= 1 && !f.deborde && !f.ecran, 'A · ≤ 1 bouton plein, rien ne déborde de la feuille', JSON.stringify({ p: f.pleins, d: f.deborde, e: f.ecran }));
          const n0 = ecritures.length;
          const c0 = await pg.evaluate(() => window.__cmds.length);
          const ouvre = ctx.waitForEvent('page', { timeout: 3000 }).catch(() => null);
          await pg.click('[data-dc-retirer]').catch(() => {});
          const nouvelle = await ouvre; if (nouvelle) await nouvelle.close().catch(() => {});
          await pg.waitForTimeout(3500);
          const apres = await pg.evaluate((c0) => ({ cmds: window.__cmds.slice(c0), suite: (document.querySelector('[data-dc-suite]') || {}).textContent || '', etat: (document.querySelector('[data-dc-groupe]') || { getAttribute: () => '' }).getAttribute('data-dc-retrait'), note: (() => { try { return localStorage.getItem('vrm_deux_comptes_retraits') || ''; } catch (_) { return ''; } })() }), c0);
          const ecr = ecritures.slice(n0);
          // (Les lectures de fond de l'app — `ventes`… — continuent ; aucune commande ne vise l'annonce ni ne retire.)
          dit(!apres.cmds.some((c) => /6000001|suppr|delete|retir|masqu|hide|pause|vacances/i.test(c)), 'A · le toucher n’envoie AUCUNE commande à l’extension sur l’annonce (VRM ne supprime rien)', JSON.stringify(apres.cmds));
          dit((/"6000001":\{"at":\d+/.test(apres.note) || ecr.some((e) => /vrm_deux_comptes_retraits/.test(e.corps))) && ecr.every((e) => !/DELETE/i.test(e.m)), 'A · il note seulement l’heure (`vrm_deux_comptes_retraits`, clé synchronisée)', JSON.stringify({ note: apres.note, ecr: ecr.map((e) => e.m + ' ' + e.u.slice(0, 60)) }));
          dit(apres.etat === 'ouverte' && /VRM relira/.test(apres.suite), 'A · « Ouverte à … VRM relira »', JSON.stringify(apres));
          await capt(pg, `deux-comptes-A-ouverte-${nom}`);
        }
        dit(errs.length === 0, 'A · aucune erreur JS', errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
      await essaie(`P ${nom}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, SCENARIOS.P, { sombre });
        const r = await lireCarte(pg);
        dit(r.carte && r.ids === '5100001+6100001', 'P · la même photo à l’empreinte sur deux comptes : une carte', JSON.stringify(r).slice(0, 200));
        await pg.click('[data-journee-deux-comptes]').catch(() => {});
        await pg.waitForSelector('[data-feuille-deux-comptes]', { timeout: 5000 }).catch(() => {});
        await pg.waitForTimeout(500);
        await capt(pg, `deux-comptes-P-feuille-${nom}`);
        const f = await lireFeuille(pg);
        dit(f.feuille && f.etat === 'verifier' && f.meme && f.pasMeme, 'P · « À vérifier », avec « C’est la même paire » et « Ce n’est pas la même »', JSON.stringify(f).slice(0, 200));
        dit(errs.length === 0, 'P · aucune erreur JS', errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
      if (!sombre) await essaie(`B ${nom}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, SCENARIOS.B, { sombre });
        const r = await pg.evaluate(() => ({ carte: !!document.querySelector('[data-journee-deux-comptes]'), rendu: !!document.querySelector('.vrm-fu-afaire, [data-tout-a-jour]') }));
        dit(r.rendu && !r.carte, 'B · 50 paires identiques (titre, photos proches), deux comptes : AUCUNE carte', JSON.stringify(r));
        dit(errs.length === 0, 'B · aucune erreur JS', errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
      for (const recette of [true, false]) await essaie(`V ${nom} ${recette ? 'apprise' : 'pas apprise'}`, async () => {
        const art = '66668888';
        const vc = [
          { id: 'vc_listings', data: { items: { [art]: { titre: 'Nike Dunk Low Panda', photo: 'https://images.vestiairecollective.com/produit/66668888-1_2.jpg', compte: '11112222', prix: { valeur: 249, devise: 'EUR', cle: 'product.price.cents' } } }, liens: { [art]: '42' }, capturedAt: iso(1) } },
          { id: 'vc_aimes', data: { produits: { ['n' + art]: { produit: art, n: 3, prevenues: 0, aPrevenir: 3, dernier: iso(3) } }, capturedAt: iso(1) } },
          { id: 'vc_offres_recette', data: recette ? { favori: { appris: true, raison: '', at: iso(24) } } : {} },
          { id: 'vc_messages', data: { compteur: { messages: 0, at: iso(1) }, conversations: {}, lecture: { at: iso(1), total: 0, complet: true, page: '/chat/' } } },
        ];
        const { ctx, pg, errs } = await ouvrir(b, vp, null, { sombre, onglet: 'messages', vc });
        await pg.waitForSelector('[data-aimes-vc-article]', { timeout: 8000 }).catch(() => {});
        await capt(pg, `vestiaire-aimes-${recette ? 'liste' : 'apprendre-liste'}-${nom}`);
        const l = await pg.evaluate(() => { const e = document.querySelector('[data-aimes-vc-article]'); return e ? { n: e.getAttribute('data-aimes-vc-n'), t: e.innerText, h: Math.round(e.getBoundingClientRect().height) } : null; });
        dit(!!l && l.n === '3' && /3 personnes ont aimé/.test(l.t) && /N°\s*42/.test(l.t.replace(/\n/g, ' ')), 'V · « Ont aimé tes articles » : N°42, 3 personnes (un nombre)', JSON.stringify(l));
        await pg.click('[data-aimes-vc-ouvrir]').catch(() => {});
        await pg.waitForSelector('[data-feuille-aimes-vc]', { timeout: 5000 }).catch(() => {});
        await pg.waitForTimeout(400);
        if (recette) {
          await pg.click('[data-aimes-vc-remise="5"]').catch(() => {});
          await pg.waitForTimeout(200);
          await capt(pg, `vestiaire-aimes-feuille-${nom}`);
          const btn = await pg.evaluate(() => { const e = document.querySelector('[data-aimes-vc-envoyer]'); return e ? { t: e.textContent, dis: e.disabled, h: Math.round(e.getBoundingClientRect().height) } : null; });
          dit(!!btn && /Envoyer l’offre de 236\s€ à 3 personnes/.test(btn.t) && !btn.dis && btn.h >= 44, 'V · −5 % ⇒ « Envoyer l’offre de 236 € à 3 personnes »', JSON.stringify(btn));
          const avant = await pg.evaluate(() => window.__cmds.length);
          dit(avant === 0, 'V · rien n’est parti avant SON toucher', String(avant));
          await pg.click('[data-aimes-vc-envoyer]').catch(() => {});
          await pg.waitForTimeout(600);
          const cmds = await pg.evaluate(() => window.__cmds.map((x) => JSON.parse(x)).filter((x) => x.cmd === 'vcOffreAimes'));
          dit(cmds.length === 1 && cmds[0].produit === art && cmds[0].avantCents === 24900 && cmds[0].prixCents === 23600, 'V · UNE commande `vcOffreAimes { produit, avantCents, prixCents }`', JSON.stringify(cmds));
        } else {
          await capt(pg, `vestiaire-aimes-apprendre-${nom}`);
          const f = await pg.evaluate(() => ({ etapes: document.querySelectorAll('[data-aimes-vc-recette] li').length, envoyer: !!document.querySelector('[data-aimes-vc-envoyer]') }));
          dit(f.etapes === 3 && !f.envoyer, 'V · sans recette : les 3 étapes pour l’apprendre, AUCUN bouton d’envoi', JSON.stringify(f));
        }
        dit(errs.length === 0, 'V · aucune erreur JS', errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
    }
  } finally {
    if (b) await b.close();
    srv.close();
  }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
