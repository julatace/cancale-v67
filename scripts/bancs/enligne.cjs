// Banc : « IL FAUT VRAIMENT QUE CE SOIT LES PAIRES QUI SONT EN LIGNE ACTUELLEMENT,
// QUI SONT DANS ANNONCES » (Julien, 11 octobre — extension 5.165).
//
// MESURÉ le 11 octobre : l'écran Annonces montrait 27 annonces « en ligne », dont
// 16 d'une lecture du 8 octobre (deux comptes où il ne repassait pas). Il venait
// de tout supprimer pour reposter : l'ancienne annonce + la republiée = la même
// paire deux ou trois fois.
// Sur des données INVENTÉES (il vit dans le dépôt, qui est public), aux deux
// tailles, il exige :
//   1. TROIS annonces de la même paire, dont deux qui ne sont plus en ligne
//      (absente de la lecture publique la plus récente de son compte) ⇒ UNE seule
//      carte, et c'est la REPUBLIÉE (connue seulement par la lecture publique) ;
//   2. un compte figé depuis 3 jours ⇒ ses annonces ne sont PAS dans la grille ni
//      dans « Annonces en ligne » du tableau de bord ; elles sont dites UNE fois,
//      repliées, « à confirmer », et la ligne s'ouvre au clic ;
//   3. la même règle sur le tableau de bord et dans la file Leboncoin de l'app ;
//   4. panne de lecture (lectures publiques illisibles) ⇒ rien ne disparaît en
//      silence : ce qui n'est plus sûr est « à confirmer », jamais retiré sans un mot ;
//   5. l'autre sens : tout est frais ⇒ aucune ligne « à confirmer » ;
//   6. aucun débordement à 390 px, aucune erreur d'app.
// Ce qui est jugé : les cartes (`data-carte-annonce`), les attributs `data-*` et
// les nombres rendus — pas une formulation.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4771;

const now = Date.now();
const iso = (h) => new Date(now - h * 3600e3).toISOString();
const ACCS = ['111', '222', '333', '444'].map((u, i) => ({ id: i + 1, vinted_user_id: u, login: 'compte_' + u, domain: 'www.vinted.fr', updated_at: iso(0) }));
const ann = (id, title, o) => Object.assign({ id, title, price: { amount: '55.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false,
  photo: null, brand: 'Jordan', size: '43', status: 'Très bon état', view_count: 3, favourite_count: 0, nPhotos: 4 }, o);
const PAIRE = 'Zeta Fear Trois 43';
const dressing = (uid, capH, items) => ({ id: `harvest_${uid}_listings`, data: { type: 'listings', uid, capturedAt: iso(capH), nItems: items.length,
  payload: { items, pagination: { total_entries: items.length, total_pages: 1 } } } });
const publique = (uid, capH, items) => ({ id: `harvest_${uid}_enligne`, data: { type: 'enligne', uid, source: 'public', complet: true, capturedAt: iso(capH),
  n: items.length, ids: items.map((x) => String(x.id)), items } });
// compte_111 : dressing du « 8 octobre » (72 h) — 7001 (la paire) et 7011 ; relu en
//   public il y a 1 h : 7001 n'y est plus (supprimée), 7011 y est.
// compte_222 : dressing de 72 h — 7002 (la même paire) ; relu en public : vide.
// compte_333 : dressing de 3 h — 7031 ; relu en public il y a 10 min : 7031 et
//   7003, la paire REPUBLIÉE (jamais vue par son dressing).
// compte_444 : dressing de 72 h, jamais relu — 7041, 7042 : « à confirmer ».
const BASE = () => [
  { id: 'main', data: { vinted_annonce_numeros: {
    '7001': { numero: '11', mp: { lbc: true } }, '7002': { numero: '12', mp: { lbc: true } }, '7003': { numero: '13', mp: { lbc: true } },
    '7011': { numero: '21', mp: { lbc: true } }, '7031': { numero: '31', mp: { lbc: true } }, '7041': { numero: '41', mp: { lbc: true } }, '7042': { numero: '42', mp: { lbc: true } } } } },
  dressing('111', 72, [ann(7001, PAIRE), ann(7011, 'Zeta Garde Alpha 42')]),
  dressing('222', 72, [ann(7002, PAIRE)]),
  dressing('333', 3, [ann(7031, 'Zeta Garde Gamma 41')]),
  dressing('444', 72, [ann(7041, 'Zeta Figee Delta 40'), ann(7042, 'Zeta Figee Epsilon 39')]),
  publique('111', 1, [ann(7011, 'Zeta Garde Alpha 42')]),
  publique('222', 1, []),
  publique('333', 10 / 60, [ann(7031, 'Zeta Garde Gamma 41'), ann(7003, PAIRE, { price: { amount: '49.0', currency_code: 'EUR' } })]),
];
const FRAIS = () => [
  BASE()[0],
  dressing('111', 0.1, [ann(7011, 'Zeta Garde Alpha 42')]),
  dressing('333', 0.1, [ann(7031, 'Zeta Garde Gamma 41'), ann(7003, PAIRE)]),
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
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
// Un pont d'extension À JOUR (5.165), dans la vraie forme ; `sansPont` : un téléphone.
const PONT = () => {
  const version = '5.165.0';
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, vrm: { ok: true, connecte: true, email: 'vendeur@exemple.test', user_id: 'u1' }, vinted: null, cmds: {} } });
  });
  post({ __vmr: 'ready', version });
};

async function rendre(b, { lignes, tel = false, onglet = 'cat_annonces', enligneKO = false, sansPont = false }) {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  if (!sansPont) await pg.addInitScript(PONT);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    // Les lectures publiques ILLISIBLES (522 Cloudflare, en HTML), la base debout par ailleurs.
    if (enligneKO && /_enligne/.test(u)) return route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: (r.data && r.data.capturedAt) || iso(0), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(lignes.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(lignes.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  // Le relais Vinted en panne : l'app ne doit vivre que de NOTRE base.
  await pg.route('**/api/**', (r) => (/vinted-proxy/.test(r.request().url())
    ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"erreur":"pas-su"}' })
    : r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' })));
  await pg.goto(`http://localhost:${PORT}/?tab=${onglet}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4500);
  return { ctx, pg, errs };
}
const lireAnnonces = (pg) => pg.evaluate((PAIRE) => {
  const f = [...document.querySelectorAll('[data-ann-fraicheur]')];
  const el = f[0];
  const cartes = [...document.querySelectorAll('[data-carte-annonce]')];
  return {
    cartes: cartes.map((x) => x.getAttribute('data-carte-annonce')).sort(),
    paire: cartes.filter((x) => x.innerText.includes(PAIRE)).map((x) => x.getAttribute('data-carte-annonce')),
    nFraicheur: f.length,
    aConfirmer: el ? el.getAttribute('data-a-confirmer') : null,
    comptesAC: el ? el.getAttribute('data-a-confirmer-comptes') : null,
    supprimees: el ? el.getAttribute('data-supprimees') : null,
    cap: el ? el.getAttribute('data-cap') : null,
    texte: el ? el.innerText : '',
    liste: [...document.querySelectorAll('[data-a-confirmer-annonce]')].map((x) => x.getAttribute('data-a-confirmer-annonce')).sort(),
    couleurs: el ? [...new Set([...el.querySelectorAll('*')].concat([el]).map((x) => getComputedStyle(x).color))] : [],
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  };
}, PAIRE);

(async () => {
  let b;
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le scénario a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); } };
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

    for (const tel of [false, true]) {
      const t = tel ? '390 px' : '1512 px';
      console.log(`── 1-2. ${t} — trois annonces de la même paire, un compte figé`);
      await essaie('1 ' + t, async () => {
        const r = await rendre(b, { lignes: BASE(), tel });
        const a = await lireAnnonces(r.pg);
        dit(a.paire.length === 1, `${t} : la paire supprimée deux fois et republiée apparaît UNE fois`, JSON.stringify(a.paire));
        dit(a.paire[0] === '7003', `${t} : et c'est la REPUBLIÉE (7003, connue par la lecture publique de ce matin)`, JSON.stringify(a.paire));
        dit(!a.cartes.includes('7001') && !a.cartes.includes('7002'), `${t} : les deux anciennes (absentes de la lecture la plus récente) ne sont plus là`, JSON.stringify(a.cartes));
        dit(a.cartes.includes('7011') && a.cartes.includes('7031'), `${t} : les autres paires en ligne restent`, JSON.stringify(a.cartes));
        dit(!a.cartes.includes('7041') && !a.cartes.includes('7042'), `${t} : le compte figé depuis 3 jours n'est PAS dans la grille`, JSON.stringify(a.cartes));
        dit(a.nFraicheur === 1, `${t} : une seule ligne au-dessus de la grille (§7)`, `${a.nFraicheur} bloc(s)`);
        dit(a.aConfirmer === '2' && a.comptesAC === '444' && /compte_444/.test(a.texte), `${t} : elle dit « 2 annonces de compte_444 à confirmer »`, JSON.stringify({ n: a.aConfirmer, c: a.comptesAC, t: a.texte }));
        dit(/3 j/.test(a.texte), `${t} : avec l'âge de la dernière lecture`, a.texte);
        dit(a.cap === 'ok' && /n.importe lequel de tes comptes/.test(a.texte), `${t} : et le geste vrai pour une extension à jour (n'importe lequel de ses comptes)`, a.texte);
        dit(a.supprimees === '2', `${t} : elle dit aussi combien sont sorties parce qu'elles ne sont plus en ligne`, JSON.stringify(a.supprimees));
        dit(a.liste.length === 0, `${t} : la liste « à confirmer » est REPLIÉE par défaut`, JSON.stringify(a.liste));
        await r.pg.click('[data-a-confirmer-ouvrir]');
        await r.pg.waitForTimeout(300);
        const a2 = await lireAnnonces(r.pg);
        dit(JSON.stringify(a2.liste) === '["7041","7042"]', `${t} : elle s'ouvre au clic, avec ces deux annonces`, JSON.stringify(a2.liste));
        dit(a2.couleurs.every((c) => !/rgb\((2[0-9]{2}), ?([0-9]{1,2}), ?([0-9]{1,2})\)/.test(c)), `${t} : aucune couleur d'alerte (rien n'est cassé, c'est une date)`, JSON.stringify(a2.couleurs));
        dit(a2.sw <= a2.cw + 1, `${t} : aucun débordement`, `${a2.sw} > ${a2.cw}`);
        dit(r.errs.length === 0, `${t} : aucune erreur d'app`, r.errs.join(' | ').slice(0, 160));
        await r.pg.screenshot({ path: path.join(os.tmpdir(), `enligne-annonces-${tel ? 390 : 1512}.png`), fullPage: false });
        await r.ctx.close();
      });
    }

    console.log('── 3. Tableau de bord : le même chiffre, la même ligne');
    await essaie('3', async () => {
      const r = await rendre(b, { lignes: BASE(), onglet: 'dashboard' });
      await r.pg.waitForTimeout(1500);
      const d = await r.pg.evaluate(() => {
        const s = document.querySelector('[data-dash-stat="online"]');
        const f = [...document.querySelectorAll('[data-dash-fraicheur]')];
        return { online: s ? (s.innerText.match(/\d+/) || [null])[0] : null, n: f.length, ac: f[0] ? f[0].getAttribute('data-a-confirmer') : null, texte: f[0] ? f[0].innerText : '' };
      });
      dit(d.online === '3', '« Annonces en ligne » compte 3 (7003, 7011, 7031) — ni les anciennes, ni le compte figé', JSON.stringify(d));
      dit(d.n === 1 && d.ac === '2', 'et la même ligne « à confirmer », une fois', JSON.stringify(d));
      dit(r.errs.length === 0, 'aucune erreur d’app', r.errs.join(' | ').slice(0, 160));
      await r.ctx.close();
    });

    console.log('── 4. File Leboncoin de l’app');
    await essaie('4', async () => {
      const r = await rendre(b, { lignes: BASE(), onglet: 'leboncoin' });
      await r.pg.waitForTimeout(1500);
      const txt = await r.pg.evaluate(() => document.body.innerText);
      const vus = (txt.match(/Zeta [A-Za-z]+ [A-Za-z]+/g) || []).join(' · ');
      dit(/Zeta Fear Trois/.test(txt), 'la republiée est proposée à la publication', vus);
      dit(!/Zeta Figee/.test(txt), 'les annonces « à confirmer » ne sont pas proposées', vus);
      dit(r.errs.length === 0, 'aucune erreur d’app', r.errs.join(' | ').slice(0, 160));
      await r.ctx.close();
    });

    for (const tel of [false, true]) {
      const t = tel ? '390 px' : '1512 px';
      console.log(`── 5. ${t} — panne : les lectures publiques sont illisibles`);
      await essaie('5 ' + t, async () => {
        const r = await rendre(b, { lignes: BASE(), tel, enligneKO: true });
        const a = await lireAnnonces(r.pg);
        await r.pg.click('[data-a-confirmer-ouvrir]').catch(() => {});
        await r.pg.waitForTimeout(300);
        const a2 = await lireAnnonces(r.pg);
        const vues = new Set([...a2.cartes, ...a2.liste]);
        const manquent = ['7001', '7002', '7011', '7031', '7041', '7042'].filter((id) => !vues.has(id));
        dit(!manquent.length, `${t} : rien ne disparaît en silence — chaque annonce connue est soit en ligne, soit « à confirmer »`, `manquent : ${manquent.join(',')}`);
        dit(a.cartes.includes('7031') && !a.cartes.includes('7001'), `${t} : le compte frais reste en ligne, les lectures de 3 jours deviennent « à confirmer »`, JSON.stringify(a.cartes));
        dit(a.supprimees === '0', `${t} : et rien n'est dit « plus en ligne » sur une lecture qui n'a pas eu lieu`, JSON.stringify(a.supprimees));
        dit(r.errs.length === 0, `${t} : aucune erreur d’app`, r.errs.join(' | ').slice(0, 160));
        await r.ctx.close();
      });
    }

    console.log('── 6. Sur un téléphone (sans extension) : la même règle, sur les lignes en base');
    await essaie('6', async () => {
      const r = await rendre(b, { lignes: BASE(), tel: true, sansPont: true });
      const a = await lireAnnonces(r.pg);
      dit(JSON.stringify(a.paire) === '["7003"]' && a.aConfirmer === '2', 'la même grille et la même ligne « à confirmer »', JSON.stringify({ p: a.paire, ac: a.aConfirmer }));
      dit(a.cap === 'absente' && /extension VRM à jour/.test(a.texte), 'et le geste ne promet rien d’un téléphone : il dit à quelle condition', a.texte);
      await r.ctx.close();
    });

    console.log('── 7. L’autre sens : tout est frais');
    await essaie('7', async () => {
      const r = await rendre(b, { lignes: FRAIS() });
      const a = await lireAnnonces(r.pg);
      dit(a.nFraicheur === 0 && a.paire.length === 1, 'aucune ligne quand tout a été lu il y a moins de 30 min, et la paire une fois', JSON.stringify(a));
      await r.ctx.close();
    });
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ enligne : ${ko} rouge(s)` : '\n✅ enligne : tout est vert');
  process.exit(ko ? 1 : 0);
})();
