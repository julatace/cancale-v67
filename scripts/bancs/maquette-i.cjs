// ════════════════════════════════════════════════════════════════════════════
//  BANC — MAQUETTE I « L'ÉPURE » (17 nov., proposition pour Julien).
//  npm run build && SHOTS=/tmp/h node scripts/bancs/maquette-i.cjs
//
//  Le prototype (src/maquettes/i/) n'est monté que si l'appareil porte
//  `vrm_banc_maquette` = 'i' — ce banc le pose ; aucun geste de l'app ne le fait.
//  Base INVENTÉE riche (celle de la maquette H, reprise telle quelle) (aucune donnée réelle, le dépôt est public) : celle de la maquette F
//  (recopiée de claude/maquette-f) + pour H : 14 paires sans case, 9 rangées en ligne nulle
//  part, des annonces qui dorment, des achats récents aux vrais modèles. La base de F :
//  celle des bancs de design (3 comptes, 1 000 paires en ligne, 1 000 conversations), plus :
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
const OUT = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-maquette-i');
const J = 86400000, NOW = Date.now();
const iso = (ms) => new Date(NOW - ms).toISOString();
const LOGINS = ['atelier_sneakers_paris', 'second_compte_vintage', 'troisieme_dressing_lyon69'];

function baseH() {
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

  // ══ (H) L'ATELIER — ce qui manque à la base de F pour que chaque POSTE ait du travail (tout inventé) ══
  const MODELES = ['Nike Air Max 90 blanche', 'Adidas Samba OG noire', 'New Balance 550 crème', 'Salomon XT-6 gris', 'Asics Gel-Kayano 14 argent', 'Nike Dunk Low Panda', 'Adidas Gazelle bleue', 'New Balance 2002R gris', 'Vans Old Skool noire', 'Nike Air Force 1 blanche'];
  // Les paires en ligne (fiches `num`) : une case pour toutes sauf les 14 plus récemment numérotées (⇒ Ranger).
  const dejaRangees = new Set(Object.values(grille).flat());
  const enLigneF = Object.values(nums).filter((f) => f && Number(f.numero) >= 1200 && !dejaRangees.has(String(f.numero)));
  enLigneF.forEach((f, i) => { if (i >= 14) cel(f.numero, k++); f.numberedAt = i < 14 ? iso((i + 1) * 3600e3) : iso((20 + (i % 80)) * J); });
  // Les annonces ouvertes : en ligne depuis 0 à 55 jours ; 14 par compte depuis 70 à 150 jours (⇒ Qui dorment).
  b.rows.filter((r) => /_listings$/.test(r.id)).forEach((r) => r.data.payload.items.filter((it) => !it.is_closed).forEach((it, i) => { it.created_at_ts = i < 14 ? iso((70 + i * 6) * J) : iso(((i * 7) % 55 + 0.5) * J); if (i < 14) it.favourite_count = (i * 5) % 13; }));
  // 9 paires numérotées et RANGÉES, en ligne nulle part (⇒ Publier) : une fiche par N°, l'id d'une annonce qui n'existe plus.
  for (let i = 0; i < 9; i++) { const id = String(7990000000 + i), numero = String(1180 + i); nums[id] = { numero, accountId: a0, numberedAt: iso((2 + i) * J), title: MODELES[i] + ' ' + (38 + i), photo: `https://images1.vinted.net/t/apublier-${i}/f800/p.jpeg` }; if (i % 2 === 0) couts[numero] = String(28 + i * 4) + ',00'; cel(numero, k++); }
  // Les achats : de vrais modèles inventés, les 10 derniers jours ; ceux « finalisés » sans fiche reliée ⇒ arrivés, à numéroter.
  b.accounts.forEach((a, ai) => achatsDe(a.vinted_user_id).forEach((o, i) => {
    o.title = MODELES[(i + ai * 3) % MODELES.length] + ' T' + (38 + (i % 8));
    o.date = iso((0.4 + i * 0.35 + ai * 0.2) * J);
    o.photo = { url: `https://images1.vinted.net/t/achat-${ai}-${i}/f800/p.jpeg` };
  }));
  return b;
}

// Une illustration INVENTÉE (pas une photo) pour la paire 124 : une basket de profil, rouge et blanc.
const HEROS = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4F1EC"/><stop offset="1" stop-color="#E4DED4"/></linearGradient></defs>
<rect width="800" height="800" fill="url(#f)"/><ellipse cx="410" cy="585" rx="300" ry="26" fill="#000" opacity=".12"/>
<path d="M120 520 C130 450 190 420 250 400 L330 360 C360 340 380 300 420 300 C450 300 470 330 500 345 C560 372 640 380 690 410 C720 428 725 470 715 510 L715 540 L120 540 Z" fill="#FBFAF7" stroke="#2B2B2B" stroke-width="5"/>
<path d="M120 540 L715 540 L712 568 C600 580 300 582 140 572 C126 571 118 560 120 540 Z" fill="#EDE6D8" stroke="#2B2B2B" stroke-width="5"/>
<path d="M230 470 C260 440 330 430 380 450 C400 470 380 510 340 515 L240 518 C220 510 218 485 230 470 Z" fill="#C8102E"/>
<ellipse cx="300" cy="530" rx="58" ry="22" fill="#9FC3E0" stroke="#2B2B2B" stroke-width="4"/>
<path d="M420 300 C430 340 470 380 540 400 L560 360 C520 350 480 320 470 300 Z" fill="#C8102E"/>
<path d="M500 450 C560 430 640 440 690 470 L700 500 C640 480 580 478 520 490 Z" fill="#C8102E"/>
<path d="M330 380 L350 410 M360 365 L380 395 M392 350 L410 380" stroke="#2B2B2B" stroke-width="5" stroke-linecap="round"/>
<path d="M440 420 C480 400 560 410 600 430" stroke="#2B2B2B" stroke-width="3" fill="none" opacity=".5"/></svg>`;


// Les vignettes INVENTÉES des achats et des paires à publier : une basket en trait, teinte tirée du nom (aucune photo).
const vignetteH = (graine) => {
  let h = 0; for (const c of String(graine)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const t = h % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="hsl(${t} 30% 92%)"/>
<path d="M30 130c4-20 22-28 40-34l26-14c10-6 16-16 28-16 9 0 14 9 22 13 16 8 30 10 36 22 4 8 4 18 2 29H30z" fill="hsl(${t} 45% 55%)" stroke="#2B2B2B" stroke-width="3"/>
<path d="M30 130h154l-1 9c-30 4-110 4-148 1-4-1-6-5-5-10z" fill="#F4F1EC" stroke="#2B2B2B" stroke-width="3"/></svg>`;
};

// LE BANC. Mesures (rapportées, un banc ne meurt pas) : à 390, ≤ 1 bouton plein visible ; cibles ≥ 44 px au doigt ;
// 1re rangée ≤ 50 % de 844 ; aucun texte coupé par « … » (text-overflow) ; au plus 3 tailles de texte dans la page
// (hors barre et feuille) ; aucun « undefined / NaN » ; aucune bordure visible sur une rangée ou un groupe.
async function capture(nav, { W, sombre, hash, nom, b, fond }) {
  const o = await P.ouvrir(nav, { W, sombre, b, url: '/', dsf: W < 600 ? 2 : 1 });
  await o.pg.route(/heros-124/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: HEROS }));
  await o.pg.route(/images1\.vinted\.net\/t\/(achat|apublier)-/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: vignetteH(r.request().url()) }));
  await o.pg.evaluate((f) => { localStorage.setItem('vrm_banc_maquette', 'i'); if (f) localStorage.setItem('vrm_banc_fond', f); else localStorage.removeItem('vrm_banc_fond'); }, fond || '');
  await o.pg.goto(`http://localhost:${P.PORT}/?maquette=i${hash ? '#' + hash : ''}`, { waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('.e-racine:not(.e-attente)', { timeout: 25000 }).catch(() => {});
  await o.pg.waitForTimeout(1400);
  const f = path.join(OUT, `${nom}-${W}-${sombre ? 'sombre' : 'clair'}${fond ? '-' + fond : ''}.png`);
  await o.pg.screenshot({ path: f });
  const mes = await o.pg.evaluate(({ tel }) => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== 'hidden'; };
    const pleins = [...document.querySelectorAll('[data-plein]')].filter(vis).length;
    const petites = tel ? [...document.querySelectorAll('.e-racine button')].filter(vis).filter((x) => x.getBoundingClientRect().height < 43.5).map((x) => (x.innerText || x.getAttribute('aria-label') || '').slice(0, 30)) : [];
    const l1 = document.querySelector('.e-page .e-rangee');
    const tailles = new Set(); const coupes = []; let bords = 0;
    for (const el of document.querySelectorAll('.e-main *')) {
      if (!vis(el) || el.closest('.e-pied')) continue;
      const cs = getComputedStyle(el);
      if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) tailles.add(cs.fontSize);
      if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth) coupes.push(el.innerText.slice(0, 30));
      if (el.matches('.e-rangee, .e-groupe, .e-liste') && ['Top', 'Bottom'].some((c) => parseFloat(cs['border' + c + 'Width']) > 0)) bords++;
    }
    const texte = document.body.innerText;
    return { pleins, petites, ligne1: l1 ? Math.round(l1.getBoundingClientRect().top) : null, tailles: [...tailles], coupes, bords, mauvais: /\bundefined\b|\bNaN\b|\[object Object\]/.test(texte) };
  }, { tel: W < 600 });
  console.log(path.basename(f), JSON.stringify(mes), o.erreurs.length ? 'ERREURS ' + o.erreurs.join(' | ') : '');
  await o.ctx.close();
  return mes;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const b = baseH();
  const ECR = (process.env.ECRANS || 'jour,ventes,achats,annonces,argent').split(',');
  const ann = b.rows.find((r) => /_listings$/.test(r.id)).data.payload.items.find((it) => !it.is_closed && b.main[0].data.vinted_annonce_numeros[it.id]);
  try {
    if (process.env.CLAIR !== '0') for (const e of ECR) await capture(nav, { W: 390, sombre: false, hash: 'ecran=' + e, nom: 'i-' + e, b });
    if (process.env.SOMBRE !== '0') for (const e of ECR) await capture(nav, { W: 390, sombre: true, hash: 'ecran=' + e, nom: 'i-' + e, b });
    if (process.env.LARGE !== '0') for (const e of ECR) await capture(nav, { W: 1512, sombre: false, hash: 'ecran=' + e, nom: 'i-' + e, b });
    if (process.env.EXTRAS !== '0') {
      await capture(nav, { W: 390, sombre: false, hash: 'ecran=annonces&feuille=annonce:' + ann.id, nom: 'i-appui-long', b });
      await capture(nav, { W: 390, sombre: false, hash: 'ecran=achats&feuille=codes:', nom: 'i-codes', b });
      await capture(nav, { W: 390, sombre: true, hash: 'ecran=achats&feuille=codes:', nom: 'i-codes', b });
      await capture(nav, { W: 390, sombre: false, hash: 'ecran=jour', nom: 'i-jour', b, fond: 'bleu' });
    }
  } finally { await nav.close(); P.srv.close(); }
})();
