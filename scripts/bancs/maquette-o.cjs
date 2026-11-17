// ════════════════════════════════════════════════════════════════════════════
//  BANC — MAQUETTE O « GALERIE » (17 nov., proposition pour Julien).
//  npm run build && SHOTS=/tmp/o node scripts/bancs/maquette-o.cjs
//
//  Le prototype (src/maquettes/o/) n'est monté que si l'appareil porte
//  `vrm_banc_maquette` = 'o' — ce banc le pose ; aucun geste de l'app ne le fait.
//  La base est celle du banc de la maquette F (ci-dessous, recopiée), plus : des photos
//  de baskets DESSINÉES (aucune photo réelle), des annonces SANS photo, des achats nommés.
//  Base INVENTÉE riche (aucune donnée réelle, le dépôt est public) : celle des bancs de
//  design (3 comptes, 1 000 paires en ligne, 1 000 conversations), plus :
//    · chaque vente porte une annonce NUMÉROTÉE (sa fiche, par l'id de SON annonce) ;
//    · des coûts saisis, des cases de rangement, des achats reliés par n° de transaction ;
//    · LA paire racontée de bout en bout : N° 124, achetée sur un autre compte, case B-3,
//      23 j en ligne, vendue hier, bordereau reçu, à envoyer avant une date lue ;
//    · des colis à retirer (Super U, tabac, consigne) avec code et date limite.
//  Mesures (rapportées, un banc ne meurt pas) : à 390, ≤ 1 bouton plein visible, cibles
//  ≥ 44 px, 1re ligne de liste ≤ 50 % de 844 ; la recherche par le titre ne se dit jamais
//  « exacte » ; la paire 124 dit « reliée par son n° de transaction » ; aucun « undefined/NaN ».
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const OUT = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-maquette-o');
const J = 86400000, NOW = Date.now();
const iso = (ms) => new Date(NOW - ms).toISOString();
const LOGINS = ['atelier_sneakers_paris', 'second_compte_vintage', 'troisieme_dressing_lyon69'];

function baseF() {
  const b = B.baseVolume();
  b.accounts.forEach((a, i) => { a.login = LOGINS[i]; });
  const m = b.main[0].data;
  const nums = m.vinted_annonce_numeros;
  const couts = m.vinted_buyprice_by_num = {};
  const grille = m.vinted_garage_grid = {};
  const cel = (n, i) => { const c = 'ABCDEF'[Math.floor(i / 24) % 6] + '-' + (1 + (Math.floor(i / 3) % 8)); (grille[c] = grille[c] || []).push(String(n)); };
  let n = 300, k = 0;
  const achatsDe = (uid) => b.rows.find((r) => r.id === `harvest_${uid}_orders_purchased`).data.payload.my_orders;
  b.accounts.forEach((a, ai) => {
    const uid = a.vinted_user_id;
    const sold = b.rows.find((r) => r.id === `harvest_${uid}_orders_sold`).data.payload.my_orders;
    const lst = b.rows.find((r) => r.id === `harvest_${uid}_listings`).data.payload.items;
    const autres = achatsDe(b.accounts[(ai + 1) % 3].vinted_user_id);
    sold.forEach((v, i) => {
      if (n === 124) n++;
      const numero = String(n++);
      const enLigne = Date.parse(v.date) - (8 + (i * 7) % 50) * J;
      lst.push({ id: v.item_id, title: v.title, brand_title: v.title.split(' ')[0], size_title: String(37 + (i % 9)), status: 'Très bon état', price: v.price, is_closed: true, is_hidden: false, is_draft: false,
        favourite_count: (i * 3) % 11, view_count: 40 + (i * 17) % 200, created_at_ts: new Date(enLigne).toISOString(), photo: v.photo });
      const f = { numero, accountId: uid, numberedAt: new Date(enLigne - 2 * J).toISOString(), title: v.title };
      if (i % 3 === 0 && autres[i]) { f.buyFromId = String(autres[i].transaction_id); }
      if (i % 5 !== 4) couts[numero] = String(18 + (i * 7) % 40) + ',00';
      nums[v.item_id] = f;
      cel(numero, k++);
    });
  });
  // Les 1 000 paires en ligne : un coût saisi sur deux, une case pour les 300 premières.
  Object.values(nums).filter((f) => Number(f.numero) >= 1200).forEach((f, i) => { if (i % 2 === 0) couts[f.numero] = String(20 + (i * 3) % 50) + ',00'; if (i < 300) cel(f.numero, k++); });

  // ── LA paire racontée de bout en bout : N° 124 ──
  const a0 = b.accounts[0].vinted_user_id, a1 = b.accounts[1].vinted_user_id;
  const TX = 23999000001, ITEM = 7700000001, ACHAT = 23888000001, CONV = 52999000001;
  const vente = iso(20 * 3600e3), limite = new Date(NOW + 3 * J + 6 * 3600e3).toISOString();
  b.rows.find((r) => r.id === `harvest_${a0}_listings`).data.payload.items.push({ id: ITEM, title: 'Nike Air Max 1 ’86 OG Big Bubble Sport Red', brand_title: 'Nike', size_title: '43', status: 'Très bon état',
    price: { amount: '135.0', currency_code: 'EUR' }, is_closed: true, is_hidden: false, is_draft: false, favourite_count: 7, view_count: 214, created_at_ts: iso(24 * J), photo: { url: 'https://images1.vinted.net/t/heros-124/f800/p.jpeg' } });
  b.rows.find((r) => r.id === `harvest_${a0}_orders_sold`).data.payload.my_orders.unshift({ transaction_id: TX, item_id: ITEM, title: 'Nike Air Max 1 ’86 OG Big Bubble Sport Red', price: { amount: '129.0', currency_code: 'EUR' },
    status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: vente, photo: { url: 'https://images1.vinted.net/t/heros-124/f800/p.jpeg' } });
  achatsDe(a1).unshift({ transaction_id: ACHAT, conversation_id: 17999000001, title: 'Air Max 1 86 big bubble rouge T43', price: { amount: '58.9', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(33 * J) });
  nums[ITEM] = { numero: '124', accountId: a0, numberedAt: iso(30 * J), title: 'Nike Air Max 1 ’86 OG Big Bubble Sport Red', buyFromId: String(ACHAT), buyPrice: '62,40' };
  grille['B-3'] = ['124', '118', '131'];
  b.rows.push({ id: `email_bord_${TX}`, data: { filename: `bordereau-${TX}.pdf`, transaction: String(TX), receivedAt: iso(18 * 3600e3), suivi: 'XW482913307FR', numero: '124', dateLimite: limite, pdfB64: 'JVBERi0x' } });
  b.rows.push({ id: `harvest_${a0}_conv_${CONV}`, data: { capturedAt: vente, payload: { conversation: { id: CONV, opposite_user: { id: 990001, login: 'ines_kicks_collector' }, current_user_side: 'seller',
    transaction: { id: TX, item_id: ITEM, status: 300, item_title: 'Nike Air Max 1 ’86 OG Big Bubble Sport Red' }, allow_reply: true,
    messages: [{ id: 1, entity_type: 'message', created_at_ts: vente, entity: { body: 'Merci ! Hâte de la recevoir', user_id: 990001 } }] } } } });
  // Quatre autres ventes à envoyer « avant demain soir » (date lue sur le bordereau).
  b.rows.filter((r) => /^email_bord_/.test(r.id)).slice(0, 4).forEach((r) => { r.data.dateLimite = new Date(NOW + 30 * 3600e3).toISOString(); });
  // ── Colis à retirer (inventés) ──
  const RELAIS = [['Super U Cleunay', '27 rue de Cleunay\n35000 Rennes'], ['Super U Cleunay', '27 rue de Cleunay\n35000 Rennes'], ['Super U Cleunay', '27 rue de Cleunay\n35000 Rennes'],
    ['Tabac Le Narval', '4 place du Marché\n35000 Rennes'], ['Tabac Le Narval', '4 place du Marché\n35000 Rennes'], ['Consigne Gare Sud', 'Hall 2\n35000 Rennes']];
  RELAIS.forEach(([nom, adr], i) => b.rows.push({ id: `email_track_chronopost_XR${700000100 + i}FR`, data: { type: 'suivi', carrier: i < 3 ? 'chronopost' : 'mondialrelay', suivi: `XR${700000100 + i}FR`, status: 'available',
    code: String(482100 + i * 1379), lieu: `${nom}\n${adr}`, limite: new Date(NOW + (2 + i) * J).toISOString(), artTitle: ['Adidas Samba OG blanche 42', 'New Balance 550 crème 41', 'Salomon XT-6 noire 44', 'Asics Gel-1130 argent 40', 'Nike Dunk Low Panda 38', 'Vans Old Skool 43'][i], receivedAt: iso((i + 1) * 3600e3) } }));
  return b;
}

// ── Ce que la maquette O ajoute à la base de F ──
const MARQ = ['Nike', 'Adidas', 'Salomon', 'New Balance', 'Asics', 'Vans'];
const MOD = ['Samba OG', 'Spezial', 'Air Max 1', 'XT-6', 'Gazelle', '550', 'Gel-1130', 'Old Skool', 'Dunk Low', 'Campus 00s'];
function baseO() {
  const b = baseF();
  // Des annonces SANS photo (une sur 23, dont une toute récente) : la galerie ne doit pas avoir de trou.
  const lst0 = b.rows.find((r) => r.id === `harvest_${b.accounts[0].vinted_user_id}_listings`).data.payload.items;
  lst0.forEach((it, i) => { if (i < 1000 && i % 23 === 1) it.photo = null; });
  // Des achats nommés, en photo (sauf un sur sept).
  b.accounts.forEach((a, ai) => {
    const ach = b.rows.find((r) => r.id === `harvest_${a.vinted_user_id}_orders_purchased`).data.payload.my_orders;
    ach.forEach((o, i) => { if (o.transaction_id === 23888000001) return; const k = i + ai * 7; o.title = `${MARQ[k % 6]} ${MOD[(k * 3) % 10]} taille ${37 + (k % 8)}`; if (i % 7 !== 3) o.photo = { url: `https://images1.vinted.net/t/achat-${o.transaction_id}/f800/p.jpeg` }; });
  });
  return b;
}

// ── DES PHOTOS DESSINÉES (inventées, aucune photo réelle) : une basket de profil sur un fond de studio.
// Trois silhouettes (basse, coureuse, montante), des couleurs tirées d'une graine stable.
const UPPERS = ['#F4F3EF', '#1F2024', '#EAE0CB', '#B8BCC2', '#25324E', '#2E4A3A', '#6A2331', '#D8C29E', '#A8C5E2', '#C9372F', '#F1F1EE', '#3A3B40'];
const ACCENTS = ['#1F2024', '#C9372F', '#2B5DAA', '#2E6B47', '#E0A43A', '#F4F3EF', '#7A4B2A', '#8FA9C9'];
const SOLES = ['#F6F5F1', '#F6F5F1', '#C69256', '#F6F5F1', '#2A2B2F'];
function basket(graine) {
  let h = 2166136261; for (const c of String(graine)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const r = (n) => { h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return h % n; };
  const up = UPPERS[r(UPPERS.length)]; let ac = ACCENTS[r(ACCENTS.length)]; if (ac === up) ac = ACCENTS[(ACCENTS.indexOf(ac) + 1) % ACCENTS.length];
  const so = SOLES[r(SOLES.length)]; const forme = r(3); const tf = 30 + r(12);
  const fond = `hsl(${[30, 210, 40, 0][r(4)]},${6 + r(6)}%,${90 + r(4)}%)`;
  const trait = up === '#1F2024' || up === '#3A3B40' || up === '#25324E' ? '#0E0F12' : '#3B3B3E';
  const haut = forme === 2 ? 'C206 150 214 96 244 92 L300 92 C306 120 316 170 330 196' : forme === 1 ? 'C200 168 214 150 236 152 C256 154 264 172 284 182' : 'C196 168 212 150 234 150 C252 150 260 168 278 178';
  const semelle = forme === 1 ? `<path d="M52 256 L348 256 Q358 256 358 268 L358 286 Q358 296 346 296 L64 296 Q50 296 50 284 Z" fill="${so}" stroke="${trait}" stroke-width="2.5"/><path d="M56 276 L354 276" stroke="${trait}" stroke-width="2" opacity=".35"/>`
    : `<path d="M56 262 L344 262 Q352 262 352 272 L352 280 Q352 290 340 290 L66 290 Q54 290 54 278 Z" fill="${so}" stroke="${trait}" stroke-width="2.5"/>`;
  const base = forme === 1 ? 256 : 262;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 400 400"><rect width="400" height="400" fill="${fond}"/>
<g transform="translate(0 ${tf})">
<ellipse cx="204" cy="${base + 34}" rx="160" ry="9" fill="#000" opacity=".09"/>
<path d="M60 ${base} C58 230 82 216 114 208 L168 192 ${haut} C310 196 334 204 342 226 C348 240 348 252 344 ${base} Z" fill="${up}" stroke="${trait}" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M60 ${base} C59 242 70 230 92 224 L118 ${base} Z" fill="${ac}" opacity=".9"/>
<path d="M150 ${base - 8} C184 220 246 206 306 220 L312 238 C252 230 198 238 168 ${base - 4} Z" fill="${ac}"/>
<path d="M314 ${forme === 2 ? 120 : 200} C334 ${forme === 2 ? 150 : 210} 344 222 344 242 L330 244 C328 226 322 214 308 ${forme === 2 ? 132 : 206} Z" fill="${ac}"/>
<g stroke="${trait}" stroke-width="3" stroke-linecap="round" opacity=".8"><path d="M182 ${forme === 2 ? 178 : 186} l12 -8 M198 ${forme === 2 ? 166 : 176} l12 -8 M214 ${forme === 2 ? 152 : 166} l12 -8 ${forme === 2 ? 'M230 136 l12 -8 M244 118 l12 -6' : ''}"/></g>
${semelle}
</g></svg>`;
}

async function capture(nav, { W, sombre, hash, nom, plein = false, b, apres = null }) {
  const o = await P.ouvrir(nav, { W, sombre, b, url: '/', dsf: W < 600 ? 2 : 1 });
  const image = (r) => { const u = r.request().url(); if (/vinted\.net/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: basket(u.replace(/\?.*$/, '')) }); return r.fallback(); };
  await o.ctx.route(/vinted\.net/, image); await o.pg.route(/vinted\.net/, image);
  await o.pg.evaluate(() => { localStorage.setItem('vrm_banc_maquette', 'o'); });
  await o.pg.goto(`http://localhost:${P.PORT}/?maquette=o${hash ? '#' + hash : ''}`, { waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('.o-racine:not(.o-attente)', { timeout: 25000 }).catch(() => {});
  await o.pg.waitForTimeout(1200);
  if (apres) await apres(o.pg);
  const f = path.join(OUT, `${nom}-${W}-${sombre ? 'sombre' : 'clair'}.png`);
  await o.pg.screenshot({ path: f, fullPage: plein });
  const mes = await o.pg.evaluate(({ tel }) => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== 'hidden'; };
    const pleins = [...document.querySelectorAll('[data-plein]')].filter(vis).length;
    const petites = tel ? [...document.querySelectorAll('.o-racine button, .o-racine input')].filter(vis).filter((b) => b.getBoundingClientRect().height < 43.5).map((b) => (b.innerText || b.getAttribute('aria-label') || '').slice(0, 30)) : [];
    const l1 = document.querySelector('.o-grille li, .o-liste li');
    // Un texte tronqué : coupé en largeur (une ligne) ou en hauteur (lignes serrées).
    const tronques = [...document.querySelectorAll('.o-racine *')].filter((el) => el.children.length === 0 && el.textContent.trim() && vis(el) && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2) && getComputedStyle(el).overflow !== 'visible').map((el) => el.textContent.trim().slice(0, 40));
    const tailles = new Set([...document.querySelectorAll('.o-main *, .o-fiche *')].filter((el) => vis(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((el) => getComputedStyle(el).fontSize));
    const texte = document.body.innerText;
    return { pleins, petites, ligne1: l1 ? Math.round(l1.getBoundingClientRect().top) : null, tronques: tronques.slice(0, 6), tailles: [...tailles], sansPhoto: document.querySelectorAll('[data-sans-photo]').length, mauvais: /\bundefined\b|\bNaN\b|\[object Object\]/.test(texte) };
  }, { tel: W < 600 });
  console.log(path.basename(f), JSON.stringify(mes), o.erreurs.length ? 'ERREURS ' + o.erreurs.join(' | ') : '');
  await o.ctx.close();
  return mes;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const b = baseO();
  const VUES = (process.env.VUES || 'journee,annonces,fiche,ventes,achats,argent,ordinateur').split(',');
  const THEMES = (process.env.THEMES || 'clair,sombre').split(',');
  try {
    for (const t of THEMES) {
      const sombre = t === 'sombre';
      for (const e of ['journee', 'annonces', 'ventes', 'achats', 'argent']) if (VUES.includes(e)) await capture(nav, { W: 390, sombre, hash: 'e=' + e, nom: e, b });
      if (VUES.includes('fiche')) {
        await capture(nav, { W: 390, sombre, hash: 'e=annonces', nom: 'fiche-annonce', b, apres: async (pg) => { await pg.click('.o-grille li:nth-child(4) .o-case'); await pg.waitForTimeout(600); } });
        await capture(nav, { W: 390, sombre, hash: 'e=ventes&f=v:23999000001', nom: 'fiche-vente', b });
        await capture(nav, { W: 390, sombre, hash: 'e=achats', nom: 'fiche-colis', b, apres: async (pg) => { await pg.click('.o-ligne--colis'); await pg.waitForTimeout(600); } });
      }
    }
    if (VUES.includes('ordinateur')) for (const t of (process.env.THEMES_ORDI || 'clair').split(',')) {
      const sombre = t === 'sombre';
      await capture(nav, { W: 1512, sombre, hash: 'e=journee', nom: 'o-journee', b });
      await capture(nav, { W: 1512, sombre, hash: 'e=annonces', nom: 'o-annonces', b });
      await capture(nav, { W: 1512, sombre, hash: 'e=annonces', nom: 'o-annonces-fiche', b, apres: async (pg) => { await pg.click('.o-grille li:nth-child(2) .o-case'); await pg.waitForTimeout(600); } });
      await capture(nav, { W: 1512, sombre, hash: 'e=ventes', nom: 'o-ventes', b });
      await capture(nav, { W: 1512, sombre, hash: 'e=achats', nom: 'o-achats', b });
      await capture(nav, { W: 1512, sombre, hash: 'e=argent', nom: 'o-argent', b });
    }
  } finally { await nav.close(); P.srv.close(); }
})();
