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
// Revue du 15 octobre (chaque point rouge sur 4c1e3cb) :
//   7. la case « Messages » ouvre l'écran SUR une puce qui dit le MÊME nombre
//      (avant : « 1 » dans la barre, « Non lues 3 » à l'arrivée) ;
//   8. « prix à baisser » : même nombre sur Collectif depuis un appareil neuf
//      (avant : « 2 » par l'ancienne règle des 30 jours, puis « 1 ») ; la
//      publication se rafraîchit même quand le nombre ne change pas ;
//   9. les CARTES des dernières ventes (prix et statut compris) tiennent dans
//      un écran réaliste — 1512×860 et 1440×800 — avec une exception affichée ;
//  10. « N nouvelles » = les cartes marquées ; le reste est dit et marqué sur
//      l'écran Ventes, où « tout voir » emmène ;
//  11. un « — » ou un « ≥ » a sa raison ÉCRITE sous la barre (un téléphone n'a
//      pas d'infobulle), et le nom d'une case partielle dit « Au moins » ;
//  12. la carte « en attente » est un vrai bouton (elle portait « › » et ne
//      réagissait pas).
// ⚠️ Les mesures de place se font sur les CARTES entières, plus sur le haut du
//    titre « Dernières ventes » : un titre visible au-dessus de cartes coupées
//    passait le contrôle d'avant.
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
  const R = [{ id: 'main', data: scen.main || {} }];
  const ventes = [...(scen.calme ? VENTES_A.filter((v) => v.status === 'Commande finalisée') : VENTES_A), ...(scen.ventesEnPlus || [])];
  R.push({ id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: ventes } } });
  R.push({ id: 'harvest_111_orders_purchased', data: { capturedAt: cap, payload: { my_orders: scen.calme ? [] : ACHATS_A } } });
  R.push({ id: 'harvest_111_inbox', data: { capturedAt: cap, payload: { conversations: scen.calme ? [conv(5004, false, J)] : INBOX_A } } });
  // (Une moisson vide « n'est pas une réponse » pour l'app : la journée calme
  //  garde une annonce, qui n'est simplement pas à baisser.)
  R.push({ id: 'harvest_111_listings', data: { capturedAt: cap, payload: { items: scen.calme ? [ANNONCES_A[1]] : [...ANNONCES_A, ...(scen.annoncesEnPlus || [])] } } });
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
  await pg.addInitScript(({ sombre, vues, ls }) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1');
      localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
      localStorage.setItem('vrm_bascule_mineral_v1', '1');   // sinon la bascule « Minéral » remet le clair une fois
      if (vues) localStorage.setItem('vinted_notif_seen_ventes', JSON.stringify(vues));
      // Posé UNE fois (premier chargement) : une navigation suivante garde ce
      // que l'app y a écrit.
      if (ls && !sessionStorage.getItem('__banc_ls')) { for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, JSON.stringify(v)); sessionStorage.setItem('__banc_ls', '1'); }
    } catch (_) {}
  }, { sombre: !!scen.sombre, vues: scen.vues || null, ls: scen.ls || null });
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
  await pg.goto(`http://localhost:${PORT}/?tab=${scen.tab || 'journee'}`, { waitUntil: 'domcontentloaded' });
  if (scen.tab && scen.tab !== 'journee') { await pg.waitForTimeout(800); return { ctx, pg, errs }; }
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
// Le bas de chaque carte des dernières ventes (prix et statut compris).
const basDesCartes = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-derniere-vente]')].map((x) => Math.round(x.getBoundingClientRect().bottom)));
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

    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 860 }]) {
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
            const bas = await basDesCartes(pg);
            dit(bas.length > 0 && Math.max(...bas) <= vp.height, `${vp.width}×${vp.height} : les cartes des dernières ventes, prix et statut compris, visibles sans défiler`, `bas des cartes ${bas.join(',')} / ${vp.height}`);
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
      const nBarre = (entree(await barre(pg), 'messages')).n;
      await pg.click('[data-journee="messages"]'); await pg.waitForTimeout(2500);
      dit(await pg.locator('[data-messagerie-tete]').count() > 0, 'la case « Messages » ouvre la messagerie Vinted');
      // §11 (revue du 15 octobre) : le nombre cliqué est celui qu'on y lit.
      const puce = await pg.evaluate(() => { const b = document.querySelector('[data-filtre-recentes]'); const toutes = [...document.querySelectorAll('.vrm-inbox-filters button')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()); return { n: b ? b.getAttribute('data-filtre-recentes') : null, presse: b ? b.getAttribute('aria-pressed') : null, lignes: document.querySelectorAll('[data-conv]').length, toutes }; });
      dit(puce.n === nBarre && puce.presse === 'true', 'elle l’ouvre SUR la puce « Non lues · 7 j », qui dit le MÊME nombre que la case', `barre ${nBarre} · puce ${JSON.stringify(puce)}`);
      dit(puce.lignes === Number(nBarre), 'et la liste montre exactement ces conversations-là', `${puce.lignes} ligne(s) pour ${nBarre}`);
      dit(puce.toutes.some((t) => /^Non lues 3$/.test(t)), 'l’autre sens : « Non lues » (toutes) garde son propre nombre, sous son nom', JSON.stringify(puce.toutes));
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

    console.log('\n── « Prix à baisser » : un nombre, sur tous les écrans, même sur un appareil neuf');
    // Deux paires qui DORMENT (45 et 50 j) mais déjà à leur prix d'achat (40 €
    // pour un prix de 30 €) : rien à baisser. L'ancien repli du tableau de
    // bord (« annonces de 30 jours ou plus ») les comptait : « 2 ».
    const DORMENT = [
      { id: 503, title: 'Paire Dort Une taille 40', price: { amount: '30.0', currency_code: 'EUR' }, view_count: 2, favourite_count: 0, is_closed: false, created_at_ts: Math.floor((MAINTENANT - 45 * J) / 1000) },
      { id: 504, title: 'Paire Dort Deux taille 41', price: { amount: '30.0', currency_code: 'EUR' }, view_count: 2, favourite_count: 0, is_closed: false, created_at_ts: Math.floor((MAINTENANT - 50 * J) / 1000) },
    ];
    const MAIN_PLANCHER = { vinted_annonce_numeros: { 503: { numero: '7', buyPrice: 40 }, 504: { numero: '8', buyPrice: 40 } } };
    const nPrixTexte = (pg) => pg.evaluate(() => { const m = /(\d+) prix à baisser/.exec(document.body.innerText); return m ? Number(m[1]) : null; });
    await essaie('prix, appareil neuf', async () => {
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 860 }, { vues: VUES, main: MAIN_PLANCHER, annoncesEnPlus: DORMENT, tab: 'collectif' });
      let neuf = null;
      for (let i = 0; i < 40 && neuf == null; i++) { await pg.waitForTimeout(300); neuf = await nPrixTexte(pg); }
      const publie = await pg.evaluate(() => localStorage.getItem('vrm_prix_a_baisser'));
      await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
      try { await pg.waitForFunction(() => { const x = document.querySelector('[data-journee="prix"]'); return x && x.getAttribute('data-etat') === 'lu'; }, null, { timeout: 15000, polling: 200 }); } catch (_) {}
      const p = entree(await barre(pg), 'prix');
      dit(publie === null && neuf === Number(p.n) && neuf === 1, 'appareil neuf, rien de publié : Collectif dit le même nombre que la barre (la même règle, pas les 30 jours)', `collectif ${neuf} · barre ${p.n} · publié ${publie}`);
      await sain(pg, 'prix', errs);
      await ctx.close();
    });
    await essaie('prix, publication de la veille', async () => {
      const veille = MAINTENANT - 13 * H;
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 860 }, { vues: VUES, ls: { vrm_prix_a_baisser: { total: 1, at: veille } } });
      await pg.waitForTimeout(800);
      const v = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_prix_a_baisser')); } catch (_) { return null; } });
      dit(!!v && v.total === 1 && v.at > Date.now() - 10 * 60000, 'même nombre que la veille : Ma journée rafraîchit la date (sinon le tableau de bord retombe sur son repli au bout de 12 h)', JSON.stringify(v));
      await sain(pg, 'publication', errs);
      await ctx.close();
    });

    console.log('\n── Les dernières ventes tiennent dans un écran réel, AVEC une exception');
    for (const vp of [{ width: 1512, height: 860 }, { width: 1440, height: 800 }]) {
      await essaie(`exception ${vp.width}×${vp.height}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, { vues: VUES, main: { vinted_ship_done: { '9302': MAINTENANT - 3 * J } } });
        await pg.waitForTimeout(1200);
        const ex = await pg.evaluate(() => [...document.querySelectorAll('[data-job]')].map((x) => x.getAttribute('data-job')));
        const bas = await basDesCartes(pg);
        await pg.screenshot({ path: path.join(CAPTURES, `journee-exception-${vp.width}x${vp.height}.png`) });
        dit(ex.includes('poste-sans-depart'), 'l’exception « colis coché posté » est affichée (la situation du contrôle)', JSON.stringify(ex));
        dit(bas.length > 0 && Math.max(...bas) <= vp.height, `${vp.width}×${vp.height} : les cartes entières (prix et statut) sans défiler`, `bas ${bas.join(',')} / ${vp.height}`);
        await sain(pg, `exception ${vp.width}`, errs);
        await ctx.close();
      });
    }

    console.log('\n── « N nouvelles » = les cartes marquées ; le reste est dit et marqué sur Ventes');
    await essaie('nouvelles', async () => {
      // 8 ventes arrivées depuis la dernière ouverture, et une vente DÉJÀ VUE
      // plus récente que certaines d'entre elles : 5 tiennent dans les six
      // cartes, 3 non.
      const huit = Array.from({ length: 8 }, (_, i) => vente(9400 + i, 'Neuve ' + i + ' taille 40', 'Commande finalisée', 'completed', (i + 1) * H, '30.0'));
      const vuesToutes = VENTES_A.map((v) => String(v.transaction_id));
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 860 }, { vues: vuesToutes, ventesEnPlus: huit });
      await pg.waitForTimeout(1200);
      const nv = await pg.evaluate(() => { const h = document.querySelector('[data-nouvelles-ventes]'); const a = document.querySelector('[data-nouvelles-ailleurs]'); return { entete: h ? Number(h.getAttribute('data-nouvelles-ventes')) : 0, ailleurs: a ? Number(a.getAttribute('data-nouvelles-ailleurs')) : 0, lien: a ? a.innerText.trim() : null, cartes: document.querySelectorAll('[data-derniere-vente] [data-vente-nouvelle]').length }; });
      dit(nv.entete === nv.cartes && nv.cartes > 0, '« N nouvelles » = le nombre de cartes marquées « Nouvelle »', JSON.stringify(nv));
      dit(nv.entete + nv.ailleurs === 8 && nv.ailleurs > 0 && /\d+ nouvelles?/.test(nv.lien || ''), 'les autres sont DITES sur le lien « tout voir » (aucune ne disparaît)', JSON.stringify(nv));
      if (await pg.locator('[data-nouvelles-ailleurs]').count()) await pg.click('[data-nouvelles-ailleurs]');
      try { await pg.waitForFunction(() => document.querySelectorAll('.vrm-sale-row').length > 0, null, { timeout: 12000, polling: 250 }); } catch (_) {}
      const ventesMarquees = await pg.evaluate(() => document.querySelectorAll('.vrm-sale-row [data-vente-nouvelle]').length);
      dit(ventesMarquees === 8, '« tout voir » mène à l’écran Ventes, où les 8 portent « Nouvelle »', `${ventesMarquees} marquée(s)`);
      await sain(pg, 'nouvelles', errs);
      await ctx.close();
    });

    console.log('\n── La carte « en attente » est un vrai bouton');
    await essaie('en attente', async () => {
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 860 }, { vues: VUES });
      const ea = await pg.evaluate(() => { const x = document.querySelector('[data-en-attente]'); return x ? { tag: x.tagName, txt: x.innerText.replace(/\s+/g, ' ').slice(0, 60) } : null; });
      dit(!!ea && ea.tag === 'BUTTON' && /en attente/.test(ea.txt), 'la carte qui porte « › » est un bouton', JSON.stringify(ea));
      if (ea) await pg.click('[data-en-attente]');
      try { await pg.waitForFunction(() => document.querySelectorAll('.vrm-sale-row').length > 0, null, { timeout: 12000, polling: 250 }); } catch (_) {}
      const v = await pg.evaluate(() => ({ lignes: document.querySelectorAll('.vrm-sale-row').length, filtre: /Filtres actifs/.test(document.body.innerText) }));
      dit(v.lignes === 2 && v.filtre, 'elle ouvre les ventes EN COURS — celles dont elle fait la somme (2 ici)', JSON.stringify(v));
      await sain(pg, 'en attente', errs);
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
      const vm = await pg.evaluate(() => { const v = document.querySelector('[data-vendu-mois]'); return { carte: v ? v.getAttribute('data-vendu-mois') : null, ligne: document.querySelectorAll('[data-ventes-illisibles]').length, raisons: document.querySelectorAll('[data-barre-raison]').length }; });
      dit(vm.carte === null && vm.ligne === 1, 'et « Vendu en octobre » ne dit pas 0 € : une ligne dit que les ventes n’ont pas pu être lues', JSON.stringify(vm));
      dit(vm.raisons === 1, 'UNE ligne dit tout ce qui n’a pas pu être lu (ventes, achats, boîte) — pas une par cause (§7)', JSON.stringify(vm));
      await sain(pg, 'panne', errs);
      await ctx.close();
    });
    // ⚠️ (revue du 15 octobre) La boîte seule en panne : le « — » de
    //    « Messages » n'avait sa raison que dans l'infobulle — invisible sur
    //    un téléphone. La raison s'écrit, dans le premier écran.
    await essaie('panne boîte seule, 390 px', async () => {
      const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 }, { panne: ['_inbox'] });
      const m = entree(await barre(pg), 'messages');
      const r = await pg.evaluate(() => { const x = document.querySelector('[data-barre-raison]'); if (!x) return null; const rc = x.getBoundingClientRect(); return { ids: x.getAttribute('data-barre-raison'), txt: x.innerText.replace(/\s+/g, ' ').trim(), top: Math.round(rc.top), bas: Math.round(rc.bottom), vis: rc.height > 0 }; });
      await pg.screenshot({ path: path.join(CAPTURES, 'journee-boite-ko-390.png') });
      dit(m.etat === 'passu', 'boîte illisible : « Messages » dit « — »', JSON.stringify(m));
      dit(!!r && r.vis && r.ids === 'messages' && /boîte de réception/.test(r.txt) && r.bas <= 844, 'sa raison est ÉCRITE sous la barre, dans le premier écran (pas seulement dans l’infobulle)', JSON.stringify(r));
      dit(/boîte de réception/.test(m.nom), 'et le nom de la case dit ce qui manque', m.nom);
      await sain(pg, 'boîte', errs);
      await ctx.close();
    });
    await essaie('rien en panne', async () => {
      const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 }, {});
      dit(await pg.locator('[data-barre-raison]').count() === 0, 'l’autre sens : tout lu ⇒ aucune ligne de raison (pas de fausse alerte)');
      await sain(pg, 'rien en panne', errs);
      await ctx.close();
    });
    await essaie('un compte muet', async () => {
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 }, { deuxComptes: true, panne: ['harvest_222_inbox'] });
      const m = entree(await barre(pg), 'messages');
      dit(m.etat === 'partiel' && /^≥\s*1/.test(m.txt), 'un compte dont la boîte n’a pas répondu : « ≥ 1 », jamais un total', JSON.stringify(m));
      dit(/^Au moins /.test(m.nom) && /compte_b/.test(m.nom), 'et son NOM le dit aussi : « Au moins … », avec le compte qui manque (avant : annoncé comme un total exact)', m.nom);
      const r = await pg.evaluate(() => { const x = document.querySelector('[data-barre-raison]'); return x ? x.innerText.replace(/\s+/g, ' ').trim() : null; });
      dit(!!r && /compte_b/.test(r) && /≥/.test(r), 'la ligne sous la barre nomme le compte et dit ce que veut dire « ≥ »', r);
      await sain(pg, 'partiel', errs);
      await ctx.close();
    });
    // Un compte EXCLU de l'app n'entre dans aucun total (décision du
    // 3 octobre) : sa boîte qui ne répond pas ne rend pas le nombre partiel.
    await essaie('un compte exclu muet', async () => {
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 860 }, { deuxComptes: true, panne: ['harvest_222_'], ls: { vinted_accounts_hidden: ['222'] } });
      const bs = await barre(pg);
      const m = entree(bs, 'messages');
      dit(m.etat === 'lu' && m.n === '1', 'la boîte d’un compte EXCLU qui ne répond pas ne fait pas écrire « ≥ » (il ne compte nulle part)', JSON.stringify(m));
      dit(await pg.locator('[data-barre-raison]').count() === 0, 'et aucune ligne de raison pour lui', bs.map((x) => `${x.id}:${x.etat}`).join(' '));
      await sain(pg, 'exclu', errs);
      await ctx.close();
    });
    await essaie('suivis illisibles', async () => {
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 }, { panne: ['email_track_'] });
      const r = entree(await barre(pg), 'retrait');
      dit(r.etat === 'partiel' && /^≥\s*1/.test(r.txt), 'emails de suivi illisibles : « à retirer » dit « ≥ 1 »', JSON.stringify(r));
      dit(/^Au moins /.test(r.nom) && /suivis/.test(r.nom), 'et son NOM dit « Au moins … — pas pu lire tes suivis »', r.nom);
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
