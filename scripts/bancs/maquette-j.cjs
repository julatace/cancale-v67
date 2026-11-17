// ════════════════════════════════════════════════════════════════════════════
//  BANC — MAQUETTE J « PREMIUM » (17 nov., proposition pour Julien, PAS livrée).
//  npm run build && SHOTS=/tmp/j node scripts/bancs/maquette-j.cjs
//
//  Le prototype (src/maquettes/j/) n'est monté que si l'appareil porte `vrm_banc_maquette` = 'j' —
//  ce banc le pose ; aucun geste de l'app ne le fait. Base INVENTÉE (aucune donnée réelle, dépôt
//  public) : celle de la maquette H (`_base-maquette-h.cjs`, recopiée de claude/maquette-h), plus pour J :
//    · des titres de modèles cohérents (marque + modèle + coloris + taille), des prix plausibles ;
//    · le porte-monnaie de chaque compte (le solde que Vinted annonce) ;
//    · la date de VERSEMENT (transaction 450) des ventes finalisées, étalée sur le mois.
//  Les photos sont des ILLUSTRATIONS inventées (une basket de profil dessinée, coloris tiré de l'adresse),
//  jamais des photos réelles. Mesures (rapportées, un banc ne meurt pas) : ≤ 1 bouton plein visible,
//  cibles ≥ 44 px, 1re ligne/tuile ≤ 50 % de 844, tailles de texte visibles, aucun texte coupé,
//  aucun « … », aucun « undefined/NaN ».
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { baseH } = require('./_base-maquette-h.cjs');
const OUT = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-maquette-j');
const NOW = Date.now();
const iso = (ms) => new Date(NOW - ms).toISOString();

// Le catalogue INVENTÉ (titres cohérents). L'identité (ids, N°, transactions) ne change pas : seuls les libellés.
const CATALOGUE = [
  ['Nike', 'Air Max 90', 'blanc et gris'], ['Adidas', 'Samba OG', 'noir et gomme'], ['New Balance', '550', 'crème et vert'],
  ['Salomon', 'XT-6', 'gris orage'], ['Asics', 'Gel-Kayano 14', 'argent'], ['Nike', 'Dunk Low', 'noir et blanc'],
  ['Adidas', 'Gazelle', 'bleu marine'], ['New Balance', '2002R', 'gris nuage'], ['Vans', 'Old Skool', 'noir'],
  ['Nike', 'Air Force 1', 'blanc'], ['Adidas', 'Spezial', 'bordeaux'], ['Asics', 'Gel-1130', 'blanc et argent'],
  ['New Balance', '990v6', 'gris'], ['Nike', 'Cortez', 'blanc et rouge'], ['Salomon', 'ACS Pro', 'sable'], ['Adidas', 'Campus 00s', 'gris foncé'],
];
const titre = (i, t) => { const [m, mo, c] = CATALOGUE[i % CATALOGUE.length]; return `${m} ${mo} ${c}, taille ${t}`; };
const HEROS_TITRE = /^Nike Air Max 1 ’86/;
function baseJ() {
  const b = baseH();
  const nums = b.main[0].data.vinted_annonce_numeros;
  let k = 0;
  const parItem = new Map();
  for (const r of b.rows) if (/_listings$/.test(r.id)) for (const it of r.data.payload.items) {
    parItem.set(String(it.id), it);
    if (HEROS_TITRE.test(it.title)) continue;
    const t = titre(k, it.size_title || 38 + (k % 8)); it.title = t; it.price = { amount: String(45 + (k * 13) % 110) + '.0', currency_code: 'EUR' };
    if (nums[it.id]) nums[it.id].title = t; k++;
  }
  // Les paires à publier (fiches sans annonce ouverte) : un titre du catalogue aussi.
  Object.entries(nums).forEach(([id, f], i) => { if (!parItem.has(String(id)) && /^\D/.test(f.title || '') && !HEROS_TITRE.test(f.title || '')) f.title = titre(i * 3 + 1, 38 + (i % 8)); });
  b.accounts.forEach((a, ai) => {
    const uid = a.vinted_user_id;
    const sold = b.rows.find((r) => r.id === `harvest_${uid}_orders_sold`).data.payload.my_orders;
    sold.forEach((v, i) => {
      const it = parItem.get(String(v.item_id));
      if (it && !HEROS_TITRE.test(v.title)) { v.title = it.title; v.price = { amount: String(Math.round(Number(it.price.amount) * 0.94)) + '.0', currency_code: 'EUR' }; }
      // La date de VERSEMENT (450) des ventes finalisées : étalée sur les jours écoulés du mois (inventée).
      if (/finalis/i.test(v.status)) {
        const d = new Date(NOW); const jour = 1 + ((i * 7 + ai * 3) % Math.max(1, d.getDate()));
        const le = new Date(d.getFullYear(), d.getMonth(), jour, 10 + (i % 8), 12).toISOString();
        b.rows.push({ id: `harvest_${uid}_txn_${v.transaction_id}`, data: { capturedAt: le, payload: { transaction: { id: v.transaction_id, status: 450, status_updated_at: le } } } });
      }
    });
    b.rows.push({ id: `harvest_${uid}_billing`, data: { capturedAt: iso(3600e3), payload: { user_balance: { available_amount: { amount: ['412.60', '87.20', '0.0'][ai], currency_code: 'EUR' }, escrow_amount: { amount: ['268.00', '154.50', '61.00'][ai], currency_code: 'EUR' } } } } });
  });
  for (const r of b.rows) if (/_orders_purchased$/.test(r.id)) r.data.payload.my_orders.forEach((o, i) => { if (!/big bubble/i.test(o.title)) o.title = titre(i * 5 + 3, 38 + (i % 8)); });
  for (const r of b.rows) if (/^email_track_/.test(r.id) && r.data.artTitle) r.data.artTitle = r.data.artTitle.replace(/ (\d\d)$/, ', taille $1');
  return b;
}

// L'ILLUSTRATION inventée d'une basket (pas une photo) : fond de studio, ombre portée, coloris tiré de l'adresse.
const COLORIS = [
  ['#f4f3ef', '#d8d4cc', '#1d1d1f', '#c8b79a'], ['#1f1f22', '#3a3a3f', '#f2efe8', '#b88a5a'], ['#efe9dc', '#2f6b4f', '#f6f3ec', '#e9e2d2'],
  ['#8b8f96', '#4b4f57', '#cfd2d7', '#2b2d31'], ['#d9dde3', '#9aa3b0', '#f5f6f8', '#3a4a6b'], ['#f6f6f4', '#1c1c1e', '#f6f6f4', '#ffffff'],
  ['#1f2e57', '#f2efe8', '#e8e3d6', '#c7a77a'], ['#b9bdc4', '#6d727b', '#e8eaee', '#9da3ad'], ['#141416', '#f1f1ef', '#ffffff', '#141416'],
  ['#fbfbfa', '#e4e4e2', '#ffffff', '#d2d2d0'], ['#6e1f2b', '#f0e9dc', '#efe8db', '#c49a6c'], ['#eef0f3', '#b7bec8', '#ffffff', '#5a6474'],
];
const FONDS = ['#e9e6e1', '#e3e6ea', '#e8e4dc', '#dfe3e0', '#e6e2e8', '#e2e5ec'];
function basket(graine, force) {
  let h = 2166136261; for (const c of String(graine)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const [dessus, panneau, semelle, lacet] = force || COLORIS[h % COLORIS.length]; const fond = FONDS[(h >>> 8) % FONDS.length];
  const tourne = ((h >>> 4) % 7) - 3;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><defs>
<linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${fond}"/><stop offset="1" stop-color="#cdc8c0"/></linearGradient>
<radialGradient id="o" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".30"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".10"/></linearGradient></defs>
<rect width="800" height="800" fill="url(#f)"/><ellipse cx="410" cy="590" rx="330" ry="36" fill="url(#o)"/>
<g transform="rotate(${tourne} 400 450)">
<path d="M110 520 C118 452 170 424 236 404 L318 366 C350 346 372 304 414 300 C446 298 468 330 500 346 C566 376 648 384 700 414 C730 432 734 474 724 512 L724 540 L110 540 Z" fill="${dessus}"/>
<path d="M236 404 C280 420 330 470 360 540 L250 540 C230 500 210 470 170 440 Z" fill="${panneau}" opacity=".92"/>
<path d="M500 346 C560 376 640 384 700 414 C722 428 730 450 728 476 C650 452 560 444 470 470 C478 420 488 380 500 346 Z" fill="${panneau}" opacity=".92"/>
<path d="M330 452 C420 420 540 430 640 470 L640 486 C540 452 420 446 330 474 Z" fill="${panneau}"/>
<path d="M300 382 L332 420 M332 366 L362 404 M364 350 L392 388 M396 336 L420 372" stroke="${lacet}" stroke-width="9" stroke-linecap="round"/>
<path d="M110 520 C118 452 170 424 236 404 L318 366 C350 346 372 304 414 300 C446 298 468 330 500 346 C566 376 648 384 700 414 C730 432 734 474 724 512 L724 540 L110 540 Z" fill="url(#d)"/>
<path d="M104 540 L728 540 L724 574 C600 588 300 590 132 580 C112 578 102 562 104 540 Z" fill="${semelle}"/>
<path d="M120 566 C300 576 560 576 724 564" stroke="#000" stroke-opacity=".12" stroke-width="4" fill="none"/>
<path d="M660 420 C690 432 712 452 718 480" stroke="#000" stroke-opacity=".10" stroke-width="5" fill="none"/></g></svg>`;
}

async function capture(nav, { W, sombre, hash, nom, b }) {
  const o = await P.ouvrir(nav, { W, sombre, b, url: '/', dsf: W < 600 ? 2 : 1 });
  const img = (r) => { const u = r.request().url(); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: /heros-124/.test(u) ? basket('h', ['#f7f5f0', '#c8102e', '#f2ece0', '#2b2b2b']) : basket(u.replace(/\?.*$/, '')) }); };
  await o.ctx.route(/images1\.vinted\.net/, img); await o.pg.route(/images1\.vinted\.net/, img);
  await o.pg.evaluate(() => { localStorage.setItem('vrm_banc_maquette', 'j'); });
  await o.pg.goto(`http://localhost:${P.PORT}/?maquette=j${hash ? '#' + hash : ''}`, { waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('.j-racine:not(.j-attente)', { timeout: 25000 }).catch(() => {});
  await o.pg.waitForTimeout(1500);
  const f = path.join(OUT, `${nom}-${W}-${sombre ? 'sombre' : 'clair'}.png`);
  await o.pg.screenshot({ path: f });
  const mes = await o.pg.evaluate(({ tel }) => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== 'hidden'; };
    const pleins = [...document.querySelectorAll('[data-plein]')].filter(vis).length;
    const petites = tel ? [...document.querySelectorAll('.j-racine button')].filter(vis).filter((x) => x.getBoundingClientRect().height < 43.5).map((x) => (x.innerText || x.getAttribute('aria-label') || '').slice(0, 30)) : [];
    const l1 = document.querySelector('.j-rangee, .j-tuile, .j-pass--devant, .j-vedette');
    const tailles = new Set();
    for (const el of document.querySelectorAll('.j-racine *')) { if (!vis(el)) continue; if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) tailles.add(getComputedStyle(el).fontSize); }
    const coupes = [...document.querySelectorAll('.j-racine *')].filter(vis).filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible' && !el.matches('.j-pass-defile')).map((el) => el.className).slice(0, 5);
    return { pleins, petites, ligne1: l1 ? Math.round(l1.getBoundingClientRect().top) : null, tailles: [...tailles].sort(), coupes, mauvais: /\bundefined\b|\bNaN\b|\[object Object\]/.test(document.body.innerText), troisPoints: /…/.test(document.body.innerText) };
  }, { tel: W < 600 });
  console.log(path.basename(f), JSON.stringify(mes), o.erreurs.length ? 'ERREURS ' + o.erreurs.join(' | ') : '');
  await o.ctx.close();
  return mes;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const b = baseJ();
  const ECRANS = (process.env.ECRANS || 'journee,ventes,achats,annonces,annonces-liste,argent').split(',').filter(Boolean);
  const hashDe = (e) => (e === 'annonces-liste' ? 'ecran=annonces&vue=liste' : 'ecran=' + e);
  const THEMES = (process.env.THEMES || 'sombre,clair').split(',').filter(Boolean);
  try {
    for (const t of THEMES) for (const e of ECRANS) await capture(nav, { W: 390, sombre: t === 'sombre', hash: hashDe(e), nom: 'j-' + e, b });
    for (const e of (process.env.LARGES === undefined ? 'journee,ventes,achats,annonces,argent' : process.env.LARGES).split(',').filter(Boolean)) await capture(nav, { W: 1512, sombre: process.env.LARGE_SOMBRE === '1', hash: hashDe(e), nom: 'j-' + e, b });
  } finally { await nav.close(); P.srv.close(); }
})();
