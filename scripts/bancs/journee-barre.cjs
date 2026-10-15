// ═══════════════════════════════════════════════════════════════════════════
// BANC : MA JOURNÉE — UNE BARRE DE QUATRE ACTIONS, SANS BANNIÈRE (15 octobre)
//        (node scripts/bancs/journee-barre.cjs — après `npm run build`)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, 15 octobre :
//  · « enlève la bannière bleue quand on rentre sur l'application qui donne le
//    nombre de messages et de notifications » ;
//  · « le logo Colis à envoyer, Colis à retirer, Répondre aux messages et
//    Baisser les prix soient les seules choses, sans les textes à côté, une
//    barre en largeur un peu comme le montant en attente — ça permet de voir
//    les dernières ventes » ;
//  · « enlève répondre à 112 messages, c'est totalement incohérent » ;
//  · « enlève l'onglet Messages tout en haut à côté des paramètres, et
//    Réglages : laisse le nuage, lecture seule et la loupe ».
//
// Données INVENTÉES (le banc vit dans le dépôt, qui est public). Un compte
// `compte_a` (et `compte_b` pour le cas « un compte n'a pas répondu ») :
//   ventes   9301 payée il y a 2 h (à envoyer) · 9302 payée il y a 10 j (à
//            envoyer, EN RETARD) · 9303…9308 finalisées ⇒ « à envoyer » = 2
//   achats   8301 « déposé en point relais » ⇒ « à retirer » = 1
//   boîte    une non lue d'il y a 2 j (compte) · une non lue de 40 j · une non
//            lue de 10 j · une lue d'hier ⇒ « messages » = 1 (l'ancien
//            compteur disait 3 : « Répondre à 3 messages »)
//   annonces 501 très vue sans favori (à baisser) · 502 récente et aimée
//            ⇒ « prix à baisser » = 1
// Il juge les ATTRIBUTS (`data-journee`, `data-n`, `data-etat`) et des
// positions mesurées, jamais une formulation (§6.5) :
//   1. la barre : quatre cases, dans cet ordre, chacune son nombre ;
//   2. trois états : « … » / « — » (lecture ratée, jamais 0) / « ≥ n » (un
//      compte n'a pas répondu) ;
//   3. plus de bandeau d'ouverture, plus de « Répondre à N messages » ni de
//      sous-titre ; une vente nouvelle est marquée « Nouvelle » sur sa carte ;
//   4. l'en-tête : nuage, lecture seule, loupe — ni Messages ni Réglages, qui
//      restent joignables (barre latérale, menu, case « Messages ») ;
//   5. 390 px : la barre tient sur UNE ligne, dans le premier écran ; 1512 px :
//      les dernières ventes visibles sans défiler ;
//   6. clair et sombre, aucun débordement, aucune erreur, aucun écran tombé.
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');   // jamais un chemin absolu (§6.1)
const PORT = Number(process.env.BANC_PORT) || 5901;
const CAPTURES = process.env.CAPTURE_DIR || path.join(os.tmpdir(), 'journee-barre');
try { fs.mkdirSync(CAPTURES, { recursive: true }); } catch (_) {}

const MAINTENANT = Date.now();
const H = 3600000, J = 24 * H;
const ilYa = (ms) => new Date(MAINTENANT - ms).toISOString();
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYa(0) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: ilYa(0) },
];
const vente = (tx, titre, status, tus, age, prix) => ({ transaction_id: tx, title: titre, price: { amount: prix, currency_code: 'EUR' }, status, transaction_user_status: tus, date: ilYa(age) });
const VENTES_A = [
  vente(9301, 'Alpha Journée taille 42', 'Le paiement a été validé', 'needs_action', 2 * H, '65.0'),
  vente(9302, 'Bravo Journée taille 41', 'Le paiement a été validé', 'needs_action', 10 * J, '75.0'),
  ...[3, 4, 5, 6, 7, 8].map((i) => vente(9300 + i, `Vente ${i} Journée taille 4${i}`, 'Commande finalisée', 'completed', (i + 1) * J, '40.0')),
];
const ACHATS_A = [{ transaction_id: 8301, title: 'Achat Relais taille 40', price: { amount: '30.0', currency_code: 'EUR' }, status: 'Colis déposé en point relais', date: ilYa(3 * J), conversation_id: 77001 }];
const conv = (id, unread, age) => ({ id, unread, updated_at: ilYa(age), description: 'Bonjour', opposite_user: { id: id + 1, login: 'membre_' + id }, item_photos: [] });
const INBOX_A = [conv(5001, true, 2 * J), conv(5002, true, 40 * J), conv(5003, true, 10 * J), conv(5004, false, 1 * J)];
const INBOX_B = [conv(6001, true, 1 * J)];
const ANNONCES_A = [
  { id: 501, title: 'Paire Très Vue taille 42', price: { amount: '60.0', currency_code: 'EUR' }, view_count: 80, favourite_count: 0, is_closed: false, created_at_ts: Math.floor((MAINTENANT - 5 * J) / 1000) },
  { id: 502, title: 'Paire Aimée taille 43', price: { amount: '50.0', currency_code: 'EUR' }, view_count: 5, favourite_count: 3, is_closed: false, created_at_ts: Math.floor((MAINTENANT - 2 * J) / 1000) },
];

// Une base. `scen` : { panne:[motifs d'id qui répondent 522], calme:bool, deuxComptes:bool }
const lignes = (scen) => {
  const cap = ilYa(5 * 60000);
  const R = [{ id: 'main', data: {} }];
  const ventes = scen.calme ? VENTES_A.filter((v) => v.status === 'Commande finalisée') : VENTES_A;
  R.push({ id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: ventes } } });
  R.push({ id: 'harvest_111_orders_purchased', data: { capturedAt: cap, payload: { my_orders: scen.calme ? [] : ACHATS_A } } });
  R.push({ id: 'harvest_111_inbox', data: { capturedAt: cap, payload: { conversations: scen.calme ? [conv(5004, false, J)] : INBOX_A } } });
  // (Une moisson vide « n'est pas une réponse » pour l'app : la journée calme
  //  garde une annonce, qui n'est simplement pas à baisser.)
  R.push({ id: 'harvest_111_listings', data: { capturedAt: cap, payload: { items: scen.calme ? [ANNONCES_A[1]] : ANNONCES_A } } });
  if (scen.deuxComptes) {
    R.push({ id: 'harvest_222_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } });
    R.push({ id: 'harvest_222_orders_purchased', data: { capturedAt: cap, payload: { my_orders: [] } } });
    R.push({ id: 'harvest_222_inbox', data: { capturedAt: cap, payload: { conversations: INBOX_B } } });
    R.push({ id: 'harvest_222_listings', data: { capturedAt: cap, payload: { items: [] } } });
  }
  return R;
};

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.zip': 'application/zip' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
const ecouter = () => new Promise((res, rej) => {
  srv.once('error', (e) => rej(e.code === 'EADDRINUSE' ? new Error(`le port ${PORT} est pris — relance ce banc seul`) : e));
  srv.listen(PORT, () => res());
});
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = row.data.capturedAt || ilYa(0); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};
const HTML522 = '<!DOCTYPE html><html><head><title>522: Connection timed out</title></head><body>Connection timed out</body></html>';

async function ouvrir(b, vp, scen = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ sombre, vues }) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1');
      localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
      localStorage.setItem('vrm_bascule_mineral_v1', '1');   // sinon la bascule « Minéral » remet le clair une fois
      if (vues) localStorage.setItem('vinted_notif_seen_ventes', JSON.stringify(vues));
    } catch (_) {}
  }, { sombre: !!scen.sombre, vues: scen.vues || null });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  const R = lignes(scen);
  const panne = scen.panne || [];
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(scen.deuxComptes ? ACCOUNTS : ACCOUNTS.slice(0, 1));
    if (panne.some((m) => u.includes(m))) return route.fulfill({ status: 522, contentType: 'text/html', body: HTML522 });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel ? projette(r, sel) : r);
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(R.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(R.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  // Le relais Vinted, quand notre base ne répond pas, ne répond pas non plus
  // (il lit ses jetons dans la base) : 503, jamais un faux « 0 ».
  await pg.route('**/api/vinted-proxy**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"base"}' }));
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  // On attend que la barre ait fini de lire (plus aucun « … »), borné.
  try {
    await pg.waitForFunction(() => { const b = document.querySelectorAll('[data-journee]'); return b.length === 4 && ![...b].some((x) => x.getAttribute('data-etat') === 'encours'); }, null, { timeout: 15000, polling: 200 });
  } catch (_) {}
  await pg.waitForTimeout(800);
  return { ctx, pg, errs };
}
const barre = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-journee-actions] [data-journee]')].map((x) => {
  const r = x.getBoundingClientRect();
  return { id: x.getAttribute('data-journee'), etat: x.getAttribute('data-etat'), n: x.getAttribute('data-n'), txt: x.innerText.replace(/\s+/g, ' ').trim(), nom: x.getAttribute('aria-label') || '', top: Math.round(r.top), bas: Math.round(r.bottom), droite: Math.round(r.right) };
}));
const entree = (bs, id) => bs.find((x) => x.id === id) || {};
async function sain(pg, ecran, errs) {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
  dit(!errs.length, `${ecran} : aucune erreur d'app`, errs.slice(0, 2).join(' | ').slice(0, 160));
}
// Le bandeau d'ouverture, le compteur « 112 messages », les sous-titres et la
// ligne « N choses à faire » : leur texte, pour s'assurer qu'aucun ne revient.
const ANCIENS = [
  [/\d+\s+nouvelles?\s+ventes?/i, 'le bandeau « N nouvelles ventes »'],
  [/nouveaux?\s+messages?\s+sur Vinted/i, 'le bandeau « N nouveaux messages sur Vinted »'],
  [/comptabilisée/i, 'le bandeau « vente comptabilisée »'],
  [/Répondre à \d+ messages?/i, '« Répondre à N messages »'],
  [/Un acheteur attend/i, '« Un acheteur attend » (jamais prouvé)'],
  [/choses? à faire aujourd/i, '« N choses à faire aujourd’hui » (le nombre redit)'],
];

(async () => {
  let b;
  try {
    await ecouter();
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const VUES = VENTES_A.map((v) => String(v.transaction_id)).filter((t) => t !== '9301');   // 9301 = arrivée depuis la dernière ouverture

    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      for (const sombre of [false, true]) {
        const nomVue = `${vp.width} px ${sombre ? 'sombre' : 'clair'}`;
        console.log(`\n── ${nomVue} : la barre, l'en-tête, les dernières ventes`);
        await essaie(nomVue, async () => {
          const { ctx, pg, errs } = await ouvrir(b, vp, { sombre, vues: VUES });
          await pg.screenshot({ path: path.join(CAPTURES, `journee-${vp.width}-${sombre ? 'sombre' : 'clair'}.png`) });
          const bs = await barre(pg);
          dit(bs.map((x) => x.id).join(',') === 'colis,retrait,messages,prix', 'une barre de QUATRE cases, dans l’ordre : à envoyer, à retirer, messages, prix', bs.map((x) => x.id).join(','));
          const c = entree(bs, 'colis'), r = entree(bs, 'retrait'), m = entree(bs, 'messages'), p = entree(bs, 'prix');
          dit(c.etat === 'lu' && c.n === '2', 'à envoyer = 2 (les deux ventes payées)', `${c.etat} ${c.n}`);
          dit(/en retard/.test(c.nom), 'le retard ne se perd pas : il est dans le nom de la case', c.nom);
          dit(r.etat === 'lu' && r.n === '1', 'à retirer = 1', `${r.etat} ${r.n}`);
          dit(m.etat === 'lu' && m.n === '1', 'messages = 1 : la seule non lue de moins de 7 jours (pas 3)', `${m.etat} ${m.n} — ${m.nom}`);
          dit(p.etat === 'lu' && p.n === '1', 'prix à baisser = 1', `${p.etat} ${p.n}`);
          dit(bs.every((x) => x.txt.length <= 24 && !/[.!?]/.test(x.txt)), 'chaque case : un nombre et deux mots, aucune phrase', bs.map((x) => `« ${x.txt} »`).join(' '));
          const txt = await pg.evaluate(() => document.body.innerText);
          const vus = ANCIENS.filter(([re]) => re.test(txt)).map(([, q]) => q);
          dit(!vus.length, 'ni bandeau d’ouverture, ni « Répondre à N messages », ni sous-titre', vus.join(' + '));
          // L'en-tête : nuage, lecture seule, loupe — rien d'autre.
          const tete = await pg.evaluate(() => {
            const h = document.querySelector('.vrm-app-header');
            const n = (s) => !!(h && h.querySelector(s));
            return { msg: n('[aria-label="Ouvrir les messages Vinted"]'), reg: n('[aria-label="Ouvrir les paramètres"]'), nuage: n('[aria-label="Voir la synchronisation"]'), loupe: n('[aria-label="Rechercher une paire"]'), lect: n('[data-etat-actions]') };
          });
          dit(!tete.msg && !tete.reg, 'l’en-tête ne porte plus les raccourcis Messages et Réglages', JSON.stringify(tete));
          dit(tete.nuage && tete.loupe && tete.lect, 'il garde le nuage, la lecture seule et la loupe', JSON.stringify(tete));
          // Une vente arrivée depuis la dernière ouverture : marquée là où elle est.
          const nv = await pg.evaluate(() => { const h = document.querySelector('[data-nouvelles-ventes]'); return { n: h ? h.getAttribute('data-nouvelles-ventes') : null, cartes: document.querySelectorAll('[data-vente-nouvelle]').length }; });
          dit(nv.n === '1' && nv.cartes === 1, 'la vente nouvelle est marquée « Nouvelle » sur sa carte (et comptée une fois)', JSON.stringify(nv));
          // Disposition.
          const ventes = await pg.evaluate(() => { const l = [...document.querySelectorAll('.vrm-label')].find((x) => /Dernières ventes/.test(x.textContent)); return l ? Math.round(l.getBoundingClientRect().top) : null; });
          if (vp.width < 600) {
            dit(bs.length === 4 && Math.max(...bs.map((x) => x.top)) - Math.min(...bs.map((x) => x.top)) <= 2 && Math.max(...bs.map((x) => x.droite)) <= vp.width, '390 px : la barre tient sur UNE ligne, dans la largeur', bs.map((x) => `${x.id}@${x.top}→${x.droite}`).join(' '));
            dit(bs.length && Math.max(...bs.map((x) => x.bas)) <= vp.height, '390 px : les quatre cases sont dans le premier écran', `bas ${Math.max(...bs.map((x) => x.bas))} / ${vp.height}`);
            dit(ventes != null && ventes < vp.height * 1.5, '390 px : les dernières ventes à moins d’une demi-hauteur de défilement', `titre à ${ventes} px`);
          } else {
            dit(ventes != null && ventes < vp.height - 120, '1512 px : les dernières ventes visibles sans défiler', `titre à ${ventes} px / ${vp.height}`);
          }
          await sain(pg, nomVue, errs);
          await ctx.close();
        });
      }
    }

    console.log('\n── Réglages et Messages restent joignables sans l’en-tête (§4.11)');
    await essaie('joignables 1512', async () => {
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 });
      const lien = pg.locator('.vrm-sidebar-settings');
      dit(await lien.isVisible(), 'ordinateur : « Réglages » est dans la barre latérale');
      await lien.click(); await pg.waitForTimeout(1200);
      dit(await pg.evaluate(() => [...document.querySelectorAll('h2')].some((h) => h.innerText.trim() === 'Paramètres')), 'et il ouvre les réglages');
      await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-journee="messages"]', { timeout: 10000 });
      await pg.click('[data-journee="messages"]'); await pg.waitForTimeout(2500);
      dit(await pg.locator('[data-messagerie-tete]').count() > 0, 'la case « Messages » ouvre la messagerie Vinted');
      await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-journee="prix"]', { timeout: 10000 });
      await pg.waitForTimeout(1500);
      await pg.click('[data-journee="prix"]');
      try { await pg.waitForFunction(() => /Repricing — \d+ paire/.test(document.body.innerText), null, { timeout: 12000, polling: 250 }); } catch (_) {}
      await pg.screenshot({ path: path.join(CAPTURES, 'journee-prix-1512.png') });
      dit(/Repricing — \d+ paire/.test(await pg.evaluate(() => document.body.innerText)), 'la case « Prix à baisser » ouvre les annonces SUR le repricing');
      await sain(pg, 'navigation', errs);
      await ctx.close();
    });
    await essaie('joignables 390', async () => {
      const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 });
      await pg.click('.vrm-app-header [aria-label="Tous les écrans"]'); await pg.waitForTimeout(500);
      const item = pg.getByRole('menuitem', { name: /Réglages/ });
      dit(await item.count() > 0, 'téléphone : « Réglages » est dans le menu ☰');
      await item.first().click(); await pg.waitForTimeout(1200);
      dit(await pg.evaluate(() => [...document.querySelectorAll('h2')].some((h) => h.innerText.trim() === 'Paramètres')), 'et il ouvre les réglages');
      await sain(pg, 'menu', errs);
      await ctx.close();
    });

    console.log('\n── Trois états : une lecture ratée s’écrit « — », jamais 0');
    await essaie('panne ventes + boîte', async () => {
      const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 }, { panne: ['harvest_111_orders_', '_inbox'] });
      await pg.screenshot({ path: path.join(CAPTURES, 'journee-panne-390.png') });
      const bs = await barre(pg);
      const c = entree(bs, 'colis'), m = entree(bs, 'messages'), r = entree(bs, 'retrait'), p = entree(bs, 'prix');
      dit(c.etat === 'passu' && c.txt.startsWith('—') && c.n === '', 'ventes illisibles : « à envoyer » dit « — », pas 0', JSON.stringify(c));
      dit(m.etat === 'passu' && m.txt.startsWith('—'), 'boîte illisible : « messages » dit « — », pas 0', JSON.stringify(m));
      dit(r.etat === 'passu' && r.txt.startsWith('—'), 'achats illisibles (même lecture que les ventes) : « à retirer » dit « — », pas « ≥ 0 »', JSON.stringify(r));
      dit(p.etat === 'lu' && p.n === '1', 'l’autre sens : ce qui a été lu garde son nombre', JSON.stringify(p));
      dit(!/Tout est à jour/.test(await pg.evaluate(() => document.body.innerText)), 'et rien n’est fêté sur une lecture ratée');
      const vm = await pg.evaluate(() => { const v = document.querySelector('[data-vendu-mois]'); return { carte: v ? v.getAttribute('data-vendu-mois') : null, ligne: document.querySelectorAll('[data-ventes-illisibles]').length }; });
      dit(vm.carte === null && vm.ligne === 1, 'et « Vendu en octobre » ne dit pas 0 € : une ligne dit que les ventes n’ont pas pu être lues', JSON.stringify(vm));
      await sain(pg, 'panne', errs);
      await ctx.close();
    });
    await essaie('un compte muet', async () => {
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 }, { deuxComptes: true, panne: ['harvest_222_inbox'] });
      const m = entree(await barre(pg), 'messages');
      dit(m.etat === 'partiel' && /^≥\s*1/.test(m.txt), 'un compte dont la boîte n’a pas répondu : « ≥ 1 », jamais un total', JSON.stringify(m));
      await sain(pg, 'partiel', errs);
      await ctx.close();
    });
    await essaie('suivis illisibles', async () => {
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 }, { panne: ['email_track_'] });
      const r = entree(await barre(pg), 'retrait');
      dit(r.etat === 'partiel' && /^≥\s*1/.test(r.txt), 'emails de suivi illisibles : « à retirer » dit « ≥ 1 »', JSON.stringify(r));
      await sain(pg, 'suivis', errs);
      await ctx.close();
    });

    console.log('\n── L’autre sens : une journée calme se dit, sans phrase de trop');
    await essaie('calme', async () => {
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 }, { calme: true });
      const bs = await barre(pg);
      dit(bs.length === 4 && bs.every((x) => x.etat === 'lu' && x.n === '0'), 'quatre cases à 0, LUES (une case à zéro reste)', bs.map((x) => `${x.id}:${x.etat}:${x.n}`).join(' '));
      dit(await pg.locator('[data-tout-a-jour]').count() === 1, '« Tout est à jour » se dit, une fois');
      await sain(pg, 'calme', errs);
      await ctx.close();
    });
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ journee-barre : ${ko} rouge(s)` : '\n✅ journee-barre : tout est vert');
  console.log('   captures : ' + CAPTURES);
  process.exit(ko ? 1 : 0);
})();
