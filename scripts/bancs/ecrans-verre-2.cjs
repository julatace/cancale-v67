// ════════════════════════════════════════════════════════════════════════════
//  BANC « ÉCRANS EN VERRE, 2 » (15 nov., maquettes validées par Julien : « tout est parfait sauf étagères »)
//  Récit : docs/passation/2026-11-15-ecrans-verre-2.md
//
//  Argent (le mois), Argent à venir, Messages (liste, conversation avec une offre), Paramètres (premier
//  écran en tuiles, une catégorie), la fiche d'une paire — sur une base INVENTÉE (1 000 paires, 1 000
//  conversations, 3 comptes : _base-messages-stock.cjs), 390 tactile ET 1512, clair ET sombre.
//  Chaque vue est capturée (SHOTS) et JUGÉE SUR SA RÈGLE (data-* et nombres rendus, jamais un libellé) :
//    A  Argent : le chiffre d'affiche « vendu » ≥ 44 px ; reçu et bénéfice côte à côte (390) ; le bénéfice
//       « au moins » dit sa couverture et le geste des prix à saisir quand il en manque ; l'argent à venir en
//       barre PAR ÉTAPE dont les parts suivent les montants rendus ; l'URSSAF et « J'ai déclaré » ;
//    V  Argent à venir : total une fois, étapes, ventes avec leur N°, le porte-monnaie « pas lu » écrit « — »
//       (jamais 0) quand il n'est pas lu ;
//    M  Messages : groupes PAR COMPTE (compte de l'onglet d'abord), du plus récent au plus ancien DANS chaque
//       groupe (data-*), le N° sur les lignes qui en ont un ; la conversation : la paire en tête, l'offre
//       comparée au prix et au prix mini, UN plein (« Proposer N € ») ;
//    P  Paramètres : le premier écran tient sans défiler (390×844) : recherche, carte Mon compte, les tuiles
//       des catégories ; une catégorie en groupes courts ; les 84 rangées et leurs id inchangés (audit) ;
//    F  la fiche (direction D « fiche produit », 15 nov.) : UN écran 390×844 (F4), photo pleine largeur + plaque, nom 26 px
//       et UNE ligne d'état, UNE carte d'action, Argent · Sites · Histoire (une vue), texte ≥ 15 px, chiffres 28–36 px,
//       « ⋯ » (tuiles + Tout voir), chaque montant une fois ; D1-D3 les trois cas (vendue sans achat relié : l'achat
//       PROPOSÉ et « Relier · 52 € » ; vendue reliée : « Imprimer le bordereau » ; en vente sur 2 sites : « Baisser le prix »).
//    Z  partout : rien ne déborde, cibles ≥ 44 px au doigt, un plein au plus.
//  Un banc ne meurt pas, il rapporte. `VUES=argent,messages` `LARGEURS=390` `THEMES=clair` ; `SHOTS=<dossier>` ;
//  `DSF=2` pour des captures nettes ; `BANC_DIST=<dist>` pour juger un autre arbre (l'arbre d'avant : ROUGE).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');

const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const VUES = {
  'argent-mois': '/?tab=argent', 'argent-avenir': '/?tab=argent', 'messages-liste': '/?tab=messages', 'messages-offre': '/?tab=messages',
  parametres: '/?tab=settings', 'parametres-ventes': '/?tab=settings', 'fiche-paire': '/?tab=journee',
  // (15 nov., fiche D « fiche produit ») les trois cas de la maquette : vendue sans achat relié (un achat PROPOSÉ),
  // vendue reliée (colis à déposer), en vente sur deux sites (Vinted et Leboncoin).
  'fiche-vendue': '/?tab=journee', 'fiche-reliee': '/?tab=journee', 'fiche-2sites': '/?tab=journee',
  // la vue Histoire de la vendue, et sa feuille « ⋯ » ouverte (tuiles + Tout voir)
  'fiche-histoire': '/?tab=journee', 'fiche-plus': '/?tab=journee',
  // (16 nov., finitions) la vente reliée (N°3120, bordereau prêt) OUVERTE DEPUIS SA LIGNE de Ventes, « ⋯ » puis « Tout voir » :
  // le récapitulatif de la vente y est rendu (sa rangée « transporteur · Imprimer le bordereau »).
  'fiche-vente-tout': '/?tab=ventes',
};
const NUM_FICHE = { 'fiche-vente-tout': '3120', 'fiche-paire': '1205', 'fiche-vendue': '3119', 'fiche-reliee': '3120', 'fiche-2sites': '3102', 'fiche-histoire': '3119', 'fiche-plus': '3119' };
// LES TROIS PAIRES DE LA FICHE D (inventées) ajoutées à la base de volume : le premier compte, ses lignes de toujours.
const J = 86400000;
function baseFiches() {
  const b = B.baseVolume();
  const m = b.main[0].data, num = m.vinted_annonce_numeros;
  const uid = b.accounts[0].vinted_user_id;
  const iso = (j) => new Date(Date.now() - j * J).toISOString();
  const photo = (id) => `https://images1.vinted.net/t/${id}/f800/fd.jpeg?s=abc`;
  const lst = b.rows.find((r) => r.id === `harvest_${uid}_listings`);
  const sold = b.rows.find((r) => r.id === `harvest_${uid}_orders_sold`);
  const bought = b.rows.find((r) => r.id === `harvest_${uid}_orders_purchased`);
  // 1. Vendue sans achat relié — N°3119 « Nike Terminator Low » taille 36, mise en ligne il y a 12 j, vendue aujourd'hui.
  // 2. Vendue reliée (achat relié, prix 52) — N°3120, la même paire en deux exemplaires : son bordereau est prêt.
  const ventes = [
    { n: '3119', item: 7699990001, tx: 64000000001, titre: 'Nike Terminator Low taille 36', prix: '110.0', relie: null },
    { n: '3120', item: 7699990002, tx: 64000000002, titre: 'Nike Terminator Low taille 37', prix: '110.0', relie: { tx: '65000000002', prix: '52' } },
  ];
  for (const v of ventes) {
    lst.data.payload.items.push({ id: v.item, title: v.titre, brand_title: 'Nike', size_title: v.n === '3119' ? '36' : '37', status: 'Très bon état', price: { amount: '120.0', currency_code: 'EUR' },
      is_closed: true, is_hidden: false, is_draft: false, favourite_count: 3, view_count: 40, created_at_ts: iso(12), photo: { url: photo(v.item), high_resolution: { timestamp: Math.floor((Date.now() - 12 * J) / 1000) } } });
    num[v.item] = { numero: v.n, num: v.n, accountId: String(uid), numberedAt: iso(12), title: v.titre, photo: photo(v.item), size: v.n === '3119' ? '36' : '37',
      ...(v.relie ? { buyPrice: v.relie.prix, buyFromId: v.relie.tx, buyFrom: { title: 'Nike Terminator Low 37 rose', date: iso(15), photo: '', price: 52, devise: 'EUR', seller: 'lea_sneakers', status: 'Commande finalisée', account: 'vendeur_1' } } : {}) };
    sold.data.payload.my_orders.unshift({ transaction_id: v.tx, title: v.titre, price: { amount: v.prix, currency_code: 'EUR' }, status: 'Le paiement a été validé', date: iso(0.2), item_id: v.item,
      transaction_user_status: 'needs_action', photo: { url: photo(v.item) } });
    b.rows.push({ id: `harvest_${uid}_txn_${v.tx}`, data: { capturedAt: iso(0.2), payload: { transaction: { id: v.tx, item_id: v.item, status: 300, status_title: 'Le paiement a été validé', status_updated_at: iso(0.2), shipment: { status_title: 'En attente' }, item: { id: v.item, title: v.titre } } } } });
    b.rows.push({ id: `email_bord_${v.tx}`, data: { filename: `bordereau-${v.tx}.pdf`, transaction: String(v.tx), receivedAt: iso(0.1), suivi: 'XW' + v.tx, modele: 'x', numero: v.n, ...(v.relie ? { transporteurPdf: 'Mondial Relay' } : {}), dateLimite: new Date(Date.now() + 4 * J).toISOString(), pdfB64: 'JVBERi0xLjQK' } });
  }
  sold.data.nItems = sold.data.payload.my_orders.length;
  // L'ACHAT qui ressemble à la paire N°3119 (même marque, même modèle, même taille, commandé AVANT la mise en ligne) : proposé, jamais relié seul.
  bought.data.payload.my_orders.unshift({ transaction_id: 65000000001, conversation_id: 19000000001, title: 'Nike Terminator Low 36 rose et gris', price: { amount: '52.0', currency_code: 'EUR' },
    status: 'Commande finalisée', date: iso(15), transaction_user_status: 'completed', photo: { url: photo('a65000000001') } });
  bought.data.nItems = bought.data.payload.my_orders.length;
  // 3. En vente sur DEUX sites — N°3102 « Adidas Samba OG » 40 : Vinted (4 favoris) et Leboncoin (lien posé à la main).
  const it = 7699990003;
  lst.data.payload.items.push({ id: it, title: 'Adidas Samba OG taille 40', brand_title: 'Adidas', size_title: '40', status: 'Bon état', price: { amount: '85.0', currency_code: 'EUR' },
    is_closed: false, is_hidden: false, is_draft: false, favourite_count: 4, view_count: 61, created_at_ts: iso(9), photo: { url: photo(it), high_resolution: { timestamp: Math.floor((Date.now() - 9 * J) / 1000) } } });
  num[it] = { numero: '3102', num: '3102', accountId: String(uid), numberedAt: iso(9), title: 'Adidas Samba OG taille 40', photo: photo(it), size: '40', buyPrice: '40' };
  const enl = b.rows.find((r) => r.id === `harvest_${uid}_enligne`);
  if (enl) { enl.data.ids.push(it); enl.data.items.push({ id: it, title: 'Adidas Samba OG taille 40' }); enl.data.n = enl.data.ids.length; }
  lst.data.nItems = lst.data.payload.items.length; lst.data.payload.pagination = { total_entries: lst.data.payload.items.length };
  // (16 nov., finitions) la FORME mesurée (comme scripts/bancs/stock-etageres.cjs) : l'annonce porte son `id` et son compte,
  // la lecture du compte est datée — la fiche lit désormais ses sites comme le Stock (src/stockAnnonces.js).
  b.rows.push({ id: 'lbc_listings', data: { items: { 2900000001: { id: 2900000001, account: 'lbc1', subject: 'Adidas Samba OG 40', price: 85, status: 'active', url: 'https://www.leboncoin.fr/ad/chaussures/2900000001' } },
    lectures: { lbc1: { at: new Date(Date.now() - 3600000).toISOString(), total: 1, n: 1 } } } });
  m.vrm_lbc_liens = { ...(m.vrm_lbc_liens || {}), 2900000001: '3102' };
  m.vinted_used_nums = [...new Set([...(m.vinted_used_nums || []), 3119, 3120, 3102])];
  return b;
}
const VOULUES = liste('VUES', Object.keys(VUES).join(','));
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const DSF = Number(process.env.DSF || 1);
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-ecrans-verre-2');
const CAPTURE = !!process.env.CAPTURE;   // captures seulement (aucun jugement)
fs.mkdirSync(SHOTS, { recursive: true });

const bilan = { ok: 0, ko: 0 };
const dit = (ok, quoi, detail = '') => { if (ok) bilan.ok++; else bilan.ko++; console.log(`${ok ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };

async function preparer(o, vue) {
  const pg = o.pg;
  const toucher = async (sel) => { const l = pg.locator(sel).first(); if (!(await l.count())) return false; try { if (o.tel) await l.tap({ timeout: 4000 }); else await l.click({ timeout: 4000 }); return true; } catch (_) { try { await l.evaluate((e) => e.click()); return true; } catch (__) { return false; } } };
  if (vue.startsWith('argent')) { await pg.waitForSelector('[data-argent-ecran]', { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(1200); }
  if (vue.startsWith('messages')) { await pg.waitForSelector('[data-fil], .vrm-msg-list', { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(600); }
  if (vue.startsWith('parametres')) { await pg.waitForSelector('[data-parametres-accueil], .vrm-reglages-groupe', { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(600); }
  if (vue === 'argent-avenir') {
    await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:argent-a-venir')));
    await pg.waitForSelector('[data-argent-a-venir-ecran]', { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(900);
  }
  if (vue === 'messages-offre') {
    // une conversation qui porte une offre (la base en met une toutes les 9 conversations)
    // la base met une offre sur la conversation n° 4 (i % 9 === 4), la 5e de la liste (de la plus récente)
    const ok = await toucher('[data-fil-offre]');
    if (!ok) { const l = pg.locator('[data-fil]').nth(4); try { if (o.tel) await l.tap({ timeout: 4000 }); else await l.evaluate((e) => e.click()); } catch (_) {} }   // à l'ordinateur, un message de la coque peut couvrir la rangée
    await pg.waitForSelector('.vrm-chat-panel .vrm-chat-history', { timeout: 10000 }).catch(() => {});
    await pg.waitForTimeout(1600);
  }
  if (vue === 'parametres-ventes') {
    const ok = await toucher('[data-categorie-ouvrir="ventes"]');
    if (!ok) await toucher('[data-cat="ventes"]');
    await pg.waitForTimeout(1200);
  }
  if (vue === 'fiche-vente-tout') {
    // Ventes → « Toutes » → la vente (elle mène à la vue Vinted) → SA ligne (son n° de transaction : `data-fl-tx`) : la fiche
    // s'ouvre DEPUIS la ligne, son récapitulatif rendu dans « Tout voir » (la rangée « transporteur · Imprimer le bordereau »).
    await pg.waitForSelector('[data-ventes-seg-choix]', { timeout: 15000 }).catch(() => {});
    await toucher('[data-ventes-seg-choix="toutes"]'); await pg.waitForTimeout(2000);
    await pg.evaluate(() => { const b = [...document.querySelectorAll('.vrm-toutes-ligne')].find((e) => e.getClientRects().length && /Terminator Low taille 37/.test(e.textContent)); if (b) b.click(); });
    await pg.waitForTimeout(2500);
    await pg.evaluate(() => { const l = [...document.querySelectorAll('[data-fiche-ligne][data-fl-tx="64000000002"]')].find((e) => e.getClientRects().length); if (l) { l.scrollIntoView({ block: 'center' }); l.click(); } });
  }
  if (vue.startsWith('fiche-')) {
    if (vue !== 'fiche-vente-tout') await pg.evaluate((n) => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: n })), NUM_FICHE[vue]);
    await pg.waitForSelector('[data-fiche-paire] .fd-s', { timeout: 8000 }).catch(() => {});
    // la fiche a fini de lire (l'achat proposé, les sites) : plus de « lecture » sur la carte d'action
    await pg.waitForFunction(() => !document.querySelector('[data-fd-propose="lecture"], [data-fiche-lecture-en-cours="1"]'), null, { timeout: 12000 }).catch(() => {});
    await pg.waitForTimeout(1200);
    if (vue === 'fiche-histoire') { await toucher('[data-fd-seg="histoire"]'); await pg.waitForTimeout(500); }
    if (vue === 'fiche-plus') { await toucher('[data-fd-plus-ouvrir]'); await pg.waitForTimeout(700); }
    if (vue === 'fiche-vente-tout') {
      await toucher('[data-fd-plus-ouvrir]'); await pg.waitForTimeout(700);
      await toucher('.fd-plus .fd-tout > summary'); await pg.waitForTimeout(700);
      // (16 nov., intégration) F9 : « Tout voir » déplié, la feuille monte haut — un message passager (sonde de la vraie
      // forme, dans la vraie zone `.vrm-toasts`) ne couvre pas sa tête (« Plus », ✕). Mesuré AVANT de faire défiler.
      await pg.evaluate(() => {
        const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 1 && r.height > 1 && c.visibility !== 'hidden' && c.display !== 'none' && !e.closest('[hidden]'); };
        const R = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom), r: Math.round(r.right) }; };
        const z = document.querySelector('.vrm-toasts'); if (!z) { window.__sondeF9 = null; return; }
        const b = document.createElement('div'); b.className = 'vrm-toast'; b.setAttribute('data-sonde-toast', '');
        b.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 16px;max-width:520px;width:100%;box-sizing:border-box;border:1px solid transparent';
        b.innerHTML = '<span class="vrm-toast-icon">i</span><span>24 nouvelles paires numérotées · N°2323, 2324, 2325 · à écrire sur leurs cartons</span>'; z.prepend(b);
        const bulles = [...z.children].filter(vis).map(R), tete = [...document.querySelectorAll('.vrm-fp .fd-plus:not([hidden]) .fd-plus-tete > *')].filter(vis).map(R); b.remove();
        const coupe = (a, c) => a.x < c.r && c.x < a.r && a.y < c.b && c.y < a.b;
        window.__sondeF9 = { place: z.getAttribute('data-toasts-place'), bulles, tete: tete.length, teteR: tete, couvreTete: tete.filter((r) => bulles.some((t) => coupe(t, r))).length };
      });
      await pg.evaluate(() => { const r = document.querySelector('.fd-plus .fd-tout [data-rangee-bord]'); if (r) r.scrollIntoView({ block: 'center' }); });
      await pg.waitForTimeout(400);
    }
  }
}

// ── La mesure, DANS la page : chaque vue rend ses nombres (jamais un libellé). ──
function mesurer(vue) {
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 1 && r.height > 1 && c.visibility !== 'hidden' && c.display !== 'none' && !e.closest('[hidden]'); };
  const R = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom), r: Math.round(r.right) }; };
  const lum = (c) => { const m = String(c).match(/[\d.]+/g); if (!m) return 0; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(+m[0]) + 0.7152 * f(+m[1]) + 0.0722 * f(+m[2]); };
  const out = { vue, W: innerWidth, H: innerHeight };
  const de = document.scrollingElement;
  out.deborde = de.scrollWidth - innerWidth;
  const racine = vue.startsWith('argent-avenir') ? document.querySelector('[data-argent-a-venir-ecran]')
    : vue.startsWith('argent') ? document.querySelector('[data-argent-questions]')
    : vue === 'messages-offre' ? document.querySelector('.vrm-chat-panel')
    : vue.startsWith('messages') ? document.querySelector('[data-fils-tous]')
    : vue.startsWith('parametres') ? document.querySelector('.vrm-pm')
    : document.querySelector('[data-fiche-paire]');
  const racineFiche = vue.startsWith('fiche-');
  out.racine = !!racine;
  if (!racine) return out;
  // Z — cibles au doigt (390) : chaque bouton VISIBLE de la racine fait 44 px (hauteur rendue, ou sa zone ::after) ; pleins visibles
  out.petits = [...racine.querySelectorAll('button, a[href], [role="button"]')].filter(vis).filter((b) => {
    const r = b.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return false;
    const a = getComputedStyle(b, '::after'); const ext = a && a.content !== 'none' && a.position === 'absolute' ? (parseFloat(a.top) < 0 ? -parseFloat(a.top) : 0) + (parseFloat(a.bottom) < 0 ? -parseFloat(a.bottom) : 0) : 0;
    return r.height + ext < 43.5;
  }).map((b) => `${b.className || b.tagName} « ${(b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 18)} » ${Math.round(b.getBoundingClientRect().height)}`).slice(0, 6);
  // la fiche couvre l'écran : seuls ses pleins se voient (ce qui est dessous ne compte pas)
  out.pleins = [...(vue.startsWith('fiche-') ? racine : document).querySelectorAll('.sb-btn-plein, .vrm-chat-btn-p, .vrm-fp-b-plein, .fd-plein')].filter(vis).filter((b) => { const r = b.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).length;
  out.horsRacine = [...racine.querySelectorAll('*')].filter(vis).filter((e) => { const r = e.getBoundingClientRect(); if (r.right <= innerWidth + 1 && r.left >= -1) return false; for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const c = getComputedStyle(a); if (/auto|scroll|hidden|clip/.test(c.overflowX)) return false; } return true; }).length;
  if (vue === 'argent-mois') {
    const q = (id) => document.querySelector(`[data-argent-q="${id}"]`);
    const n = q('vendu') && q('vendu').querySelector('.vrm-argent-w-n');
    out.vendu = n ? { fs: parseFloat(getComputedStyle(n).fontSize), clair: lum(getComputedStyle(n).color) > 0.8, carte: (() => { const bg = getComputedStyle(q('vendu')).backgroundImage; return bg !== 'none'; })() } : null;
    out.duo = q('recu') && q('benefice') ? { recu: R(q('recu').closest('.vg-carte') || q('recu')), benef: R(q('benefice').closest('.vg-carte') || q('benefice')), yQ: [R(q('recu')).y, R(q('benefice')).y] } : null;
    out.ordre = [...document.querySelectorAll('[data-argent-q]')].map((e) => e.getAttribute('data-argent-q')).join(',');
    const av = document.querySelector('section.vrm-a-venir.vg-a-venir');
    if (av) {
      const segs = [...av.querySelectorAll('.vg-av-barre .vrm-av-barre-seg')].map((s) => ({ k: (s.className.match(/is-(\w+)/) || [])[1], w: s.getBoundingClientRect().width }));
      const leg = [...av.querySelectorAll('[data-a-venir-etape][data-eur]')].map((x) => ({ k: x.getAttribute('data-a-venir-etape'), eur: Number(x.getAttribute('data-eur')) }));
      out.avenir = { total: av.getAttribute('data-a-venir'), segs, leg, etapes: (av.querySelector('[data-a-venir-etapes]') || {}).getAttribute ? av.querySelector('[data-a-venir-etapes]').getAttribute('data-a-venir-etapes') : '' };
    } else out.avenir = null;
    const u = document.querySelector('[data-argent-urssaf]');
    out.urssaf = u ? { etat: u.getAttribute('data-argent-urssaf'), apayer: u.getAttribute('data-argent-apayer'), declare: (() => { const b = u.querySelector('[data-urssaf-cest-declare]'); return b ? Math.round(b.getBoundingClientRect().height) : null; })() } : null;
    const brut = document.querySelector('.vg-a-brut');
    out.brutAuMoins = brut ? /au moins/i.test(brut.closest('.vg-a-case').innerText) : false;
  }
  if (vue === 'argent-avenir') {
    const aff = racine.querySelector('[data-av-total]');
    const total = aff ? aff.getAttribute('data-av-total') : '';
    const fr = (c) => (Number(c) / 100).toFixed(2).replace('.', ',').replace(/,00$/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const txt = racine.innerText.replace(/[  ]/g, ' ');
    out.av = { total, fois: total ? txt.split(fr(total)).length - 1 : null, chiffreFs: aff ? parseFloat(getComputedStyle(aff.querySelector('.sb-chiffre-affiche') || aff).fontSize) : 0,
      etapes: [...racine.querySelectorAll('[data-av-etape]:not([data-av-hors-total])')].map((x) => x.getAttribute('data-av-etape')),
      segs: [...racine.querySelectorAll('.vg-av-carte .vrm-av-barre-seg')].map((s) => (s.className.match(/is-(\w+)/) || [])[1]),
      pm: (() => { const x = racine.querySelector('[data-av-somme="dispo"]'); return x ? { eur: x.getAttribute('data-eur'), txt: x.innerText.replace(/\s+/g, ' ') } : null; })(),
      nums: [...racine.querySelectorAll('[data-av-vente][data-num]')].map((x) => ({ n: x.getAttribute('data-num'), plaque: ((x.querySelector('.sb-plaque') || {}).innerText || '').replace(/\s/g, '') })),
      ventes: racine.querySelectorAll('[data-av-vente]').length };
  }
  if (vue === 'messages-liste') {
    const G = [...document.querySelectorAll('[data-msg-groupe]')];
    out.ms = { groupes: G.map((g) => ({ cle: g.getAttribute('data-msg-groupe'), onglet: g.getAttribute('data-msg-groupe-onglet') === '1', ats: [...g.querySelectorAll('[data-fil]')].map((f) => Number(f.getAttribute('data-fil-at') || 0)) })),
      sansPlaque: [...document.querySelectorAll('[data-fil][data-fil-num]')].filter((f) => !((f.querySelector('.vg-fil-plaque') || {}).textContent || '').replace(/\s/g, '').includes(f.getAttribute('data-fil-num'))).length,
      avecNum: document.querySelectorAll('[data-fil][data-fil-num]').length,
      vues: [...document.querySelectorAll('[data-msg-vue]')].map((b) => ({ k: b.getAttribute('data-msg-vue'), h: Math.round(b.getBoundingClientRect().height), on: b.getAttribute('aria-pressed') === 'true' })),
      premiereLigne: (() => { const f = document.querySelector('[data-fil]'); return f ? Math.round(f.getBoundingClientRect().top) : null; })(),
      visibles: [...document.querySelectorAll('[data-fil]')].filter((f) => { const r = f.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }).length };
  }
  if (vue === 'messages-offre') {
    const pa = racine.querySelector('.vrm-chat-paire'), hi = racine.querySelector('.vrm-chat-history');
    const carte = racine.querySelector('.vrm-chat-offre');
    out.conv = { paire: !!pa && vis(pa), paireAvant: pa && hi ? pa.getBoundingClientRect().top < hi.getBoundingClientRect().top : false,
      offre: carte ? carte.getAttribute('data-offre') : null,
      proposer: (() => { const b = racine.querySelector('[data-offre-geste="proposer"]'); return b ? b.classList.contains('vrm-chat-btn-p') : null; })(),
      pleinsCarte: carte ? carte.querySelectorAll('.vrm-chat-btn-p').length : null };
    // (16 nov., finitions) Un message passager dit PENDANT une conversation (« 24 nouvelles paires numérotées ») se posait
    // sur la tête du fil (‹, Retirer) au téléphone. Même sonde que la fiche (F8) : une bulle de la vraie forme posée dans
    // la VRAIE zone `.vrm-toasts`, chaque bulle déjà là jugée aussi, contre chaque geste VISIBLE de la tête du fil.
    out.toastFil = (() => { const z = document.querySelector('.vrm-toasts'); const tete = racine.querySelector('.vrm-chat-head'); if (!z || !tete) return null;
      const b = document.createElement('div'); b.className = 'vrm-toast'; b.setAttribute('data-sonde-toast', '');
      b.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 16px;max-width:520px;width:100%;box-sizing:border-box;border:1px solid transparent';
      b.innerHTML = '<span class="vrm-toast-icon">i</span><span>24 nouvelles paires numérotées · N°2323, 2324, 2325 · à écrire sur leurs cartons</span>'; z.prepend(b);
      const bulles = [...z.children].filter(vis).map(R), gestes = [...tete.querySelectorAll('button, a[href], [role="button"]')].filter(vis).map(R); b.remove();
      const coupe = (a, c) => a.x < c.r && c.x < a.r && a.y < c.b && c.y < a.b;
      return { place: z.getAttribute('data-toasts-place'), tete: R(tete), bulles, gestes: gestes.length, couvre: gestes.filter((g) => bulles.some((t) => coupe(t, g))).length }; })();
  }
  if (vue === 'parametres') {
    const cats = [...document.querySelectorAll('[data-categories-reglages] [data-categorie-ouvrir]')].filter(vis);
    const tuiles = cats.filter((c) => c.classList.contains('vg-pm-tuile'));
    const barre = document.querySelector('.vrm-tabbar');
    out.pm = { cats: cats.length, ids: cats.map((c) => c.getAttribute('data-categorie-ouvrir')).join(','), tuiles: tuiles.length, colonnes: new Set(tuiles.map((t) => Math.round(t.getBoundingClientRect().left))).size,
      basDernier: tuiles.length ? Math.round(Math.max(...tuiles.map((t) => t.getBoundingClientRect().bottom))) : null, hautBarre: barre && vis(barre) ? Math.round(barre.getBoundingClientRect().top) : innerHeight,
      rangees: [...racine.querySelectorAll('.vrm-set-ligne')].filter(vis).filter((l) => !l.closest('.vrm-pm-alerte-liste')).length,
      compte: (() => { const c = document.querySelector('[data-categorie-ouvrir="compte"]'); return c ? R(c) : null; })() };
  }
  if (vue === 'parametres-ventes') {
    const t = [...racine.querySelectorAll('.vrm-pm-cat .vrm-set-titre')].filter(vis);
    out.cat = { titres: t.length, titresClairs: t.filter((x) => lum(getComputedStyle(x).color) > 0.8).length,
      icones: [...racine.querySelectorAll('.vrm-pm-cat .vrm-set-ic')].filter(vis).length,
      rangees: [...racine.querySelectorAll('.vrm-pm-cat .vrm-set-ligne')].filter(vis).map((l) => Math.round(l.getBoundingClientRect().height)),
      titre: (() => { const h = racine.querySelector('.vg-pm-nav-txt h2'); return h ? { fs: parseFloat(getComputedStyle(h).fontSize), clair: lum(getComputedStyle(h).color) > 0.8 } : null; })(),
      retour: (() => { const b = racine.querySelector('[data-categorie-retour]'); return b && vis(b) ? R(b) : null; })() };
  }
  if (vue === 'fiche-vente-tout') {
    // (16 nov., finitions) « Tout voir » d'une vente : la rangée « transporteur · Imprimer le bordereau » du récapitulatif.
    // Le geste ne touche pas la marque du transporteur (8 px au moins, aucun recouvrement), et ce n'est pas un SECOND plein
    // (la fiche a déjà le sien, sa carte d'action « Imprimer le bordereau » : un fond opaque n'est permis qu'au principal).
    const opaque = (e) => { const c = getComputedStyle(e).backgroundColor; const m = String(c).match(/[\d.]+/g); return !!m && (m.length < 4 || Number(m[3]) > 0.5) && !/^rgba\(0, 0, 0, 0\)$/.test(c); };
    out.toutVoirBord = [...racine.querySelectorAll('.fd-plus .fd-tout [data-rangee-bord]')].filter(vis).map((r) => {
      const puce = r.querySelector('.vrm-puce-transp'); const g = [...r.querySelectorAll('button, a[href]')].filter(vis).find((b) => !b.closest('.vrm-puce-transp'));
      if (!puce || !g) return { puce: !!puce, geste: !!g };
      const a = R(puce), b = R(g);
      return { ecart: b.x - a.r, recouvre: a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b, plein: opaque(g) && !g.hasAttribute('data-fiche-principal'), h: b.h };
    });
    out.toastPlus = window.__sondeF9 || null;
    // (16 nov., intégration) le sur-titre de la fiche ouverte depuis sa ligne (« Colis à envoyer ») : la taille du texte courant
    out.ctxFiche = (() => { const e = racine.querySelector('[data-fiche-heros-ctx]'); return e && vis(e) ? parseFloat(getComputedStyle(e).fontSize) : null; })();
    return out;
  }
  if (racineFiche) {
    // (15 nov., fiche D) Ce qui est VU : la hauteur de la fiche (la feuille « ⋯ » fermée), la photo pleine largeur et la plaque,
    // le nom et UNE ligne d'état, UNE carte d'action, le segment (une vue), les tailles de texte et de chiffres, jargon, doublons.
    const cadre = racine.querySelector('.fd-cadre, .vrm-fp-cadre');   // (la fiche d'avant aussi : sa hauteur est jugée, pas sa classe)
    const fs = (e) => (e ? parseFloat(getComputedStyle(e).fontSize) : 0);
    const ph = racine.querySelector('.fd-ph'), plaque = racine.querySelector('.fd-plaque'), nom = racine.querySelector('.fd-nom'), etat = racine.querySelector('.fd-etat');
    const textes = [...racine.querySelectorAll('.fd-s *')].filter(vis).filter((e) => !e.closest('.fd-plus') && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1));
    const chiffres = [...racine.querySelectorAll('.fd-arg-c > b')].filter(vis);
    out.fd = {
      hauteur: cadre ? Math.round(cadre.scrollHeight) : null, hRacine: Math.round(racine.scrollHeight),
      photo: ph ? R(ph) : null, plaque: plaque ? { ...R(plaque), txt: plaque.innerText.replace(/\s/g, '') } : null,
      nom: nom ? { fs: fs(nom), txt: nom.innerText } : null, etats: [...racine.querySelectorAll('.fd-etat')].filter(vis).length,
      etat: etat ? { txt: etat.innerText, ambre: etat.getAttribute('data-fd-ambre') === '1', couleur: getComputedStyle(etat).color } : null,
      actions: [...racine.querySelectorAll('.fd-act')].filter(vis).map((a) => a.getAttribute('data-fd-action')),
      relier: (() => { const b = racine.querySelector('[data-fd-relier]'); return b ? { txt: b.innerText.trim(), cents: b.getAttribute('data-fd-relier-cents'), tx: b.getAttribute('data-fd-relier') } : null; })(),
      propose: (() => { const x = racine.querySelector('[data-fd-achat-propose]'); return x ? x.innerText.replace(/\s+/g, ' ').trim() : null; })(),
      segs: [...racine.querySelectorAll('[data-fd-seg]')].filter(vis).map((b) => ({ k: b.getAttribute('data-fd-seg'), on: b.getAttribute('aria-selected') === 'true', h: Math.round(b.getBoundingClientRect().height) })),
      vue: (racine.querySelector('[data-fd-vue-ouverte]') || { getAttribute: () => '' }).getAttribute('data-fd-vue-ouverte'),
      vues: racine.querySelectorAll('.fd-v > *').length,
      sites: [...racine.querySelectorAll('.fd-site')].filter(vis).map((x) => x.getAttribute('data-fiche-site') + ':' + x.getAttribute('data-fiche-site-etat')),
      petitTexte: textes.filter((e) => fs(e) < 15 && !e.closest('.fd-plaque')).map((e) => `${e.className || e.tagName} ${fs(e)} « ${(e.innerText || '').trim().slice(0, 16)} »`).slice(0, 5),
      chiffres: chiffres.map((e) => ({ fs: fs(e), txt: e.innerText })),
      plus: !!racine.querySelector('[data-fd-plus-ouvrir]'), plusFerme: (racine.querySelector('.fd-plus') || {}).hidden !== false,
      tuilesVues: [...racine.querySelectorAll('[data-fd-tuile]')].filter(vis).map((t) => Math.round(t.getBoundingClientRect().height)),
      feuille: (() => { const f = racine.querySelector('.fd-plus-f'); return f && vis(f) ? R(f) : null; })(),
      histoire: [...racine.querySelectorAll('[data-fiche-hist-etape]')].filter(vis).map((x) => x.getAttribute('data-fiche-hist-etape') + (x.classList.contains('is-am') ? ':am' : '')),
      tuiles: [...racine.querySelectorAll('[data-fd-tuile]')].map((t) => t.getAttribute('data-fd-tuile')),
      toutVoir: !!racine.querySelector('.fd-plus [data-fiche-plus]'),
      jargon: (() => { const t = [...racine.querySelectorAll('.fd-s')].map((x) => x.innerText).join(' '); return (t.match(/\b(annonce|transaction|fiche) \d{6,}|journal des N°|vues par VRM|origine non enregistrée|lu dans le dressing|prix lus depuis|Modifications enregistrées sur cet appareil|à dater|même chaussure/gi) || []); })(),
      // chaque info UNE fois : un montant écrit deux fois sur ce qui est vu
      montants: (() => { const t = [...racine.querySelectorAll('.fd-s')].map((x) => { const c = x.cloneNode(true); c.querySelectorAll('.fd-plein, .fd-plus').forEach((b) => b.remove()); return c.textContent; }).join(' \n '); const l = t.match(/[+−-]?\d[\d  ]*(,\d+)?\s?€/g) || []; const c = {}; l.forEach((x) => { const k = x.replace(/[^\d,]/g, ''); c[k] = (c[k] || 0) + 1; }); return c; })(),
      doublons: (() => { const vus = {}; for (const e of racine.querySelectorAll('.fd-s button, .fd-s summary, .fd-s h1, .fd-s h2, .fd-s h3')) { if (!vis(e)) continue; const k = (e.innerText || '').trim(); if (k.length < 4) continue; vus[k] = (vus[k] || 0) + 1; } return Object.entries(vus).filter(([, n]) => n > 1).map(([k, n]) => `${k} ×${n}`); })(),
      // (16 nov., intégration vague A) Un message passager dit PENDANT la fiche (« 24 nouvelles paires numérotées ») se posait
      // sur ‹ et ⋯ (la coque met les messages EN HAUT quand une feuille est ouverte). Sonde : une bulle de la vraie
      // forme posée dans la VRAIE zone `.vrm-toasts` (montée même vide), sa place mesurée contre les deux ronds, puis retirée.
      toast: (() => { const z = document.querySelector('.vrm-toasts'); if (!z) return null; const b = document.createElement('div'); b.className = 'vrm-toast'; b.setAttribute('data-sonde-toast', '');
        b.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 16px;max-width:520px;width:100%;box-sizing:border-box;border:1px solid transparent';
        b.innerHTML = '<span class="vrm-toast-icon">i</span><span>24 nouvelles paires numérotées</span>'; z.prepend(b);
        // la sonde en PREMIÈRE place, et chaque bulle déjà là (un vrai message de la coque) jugée aussi
        const bulles = [...z.children].filter(vis).map(R), ronds = [...racine.querySelectorAll('.fd-top .fd-rond')].filter(vis).map(R);
        // (16 nov., intégration) la feuille « ⋯ » ouverte : sa tête (« Plus », ✕) jugée aussi (F9)
        const tete = [...racine.querySelectorAll('.fd-plus:not([hidden]) .fd-plus-tete > *')].filter(vis).map(R); b.remove();
        const coupe = (a, c) => a.x < c.r && c.x < a.r && a.y < c.b && c.y < a.b;
        return { place: z.getAttribute('data-toasts-place'), bulles, ronds: ronds.length, couvre: ronds.filter((r) => bulles.some((t) => coupe(t, r))).length, tete: tete.length, couvreTete: tete.filter((r) => bulles.some((t) => coupe(t, r))).length }; })(),
    };
  }
  return out;
}

// ── Le jugement : la RÈGLE de chaque vue, sur les nombres rendus. ──
function juger(m, suf, tel) {
  if (!m.racine) { dit(false, `${suf} : l'écran est rendu`, 'racine absente'); return; }
  dit(m.deborde <= 1 && m.horsRacine === 0, `Z ${suf} : rien ne déborde`, `page +${m.deborde} · ${m.horsRacine} élément(s) hors de l'écran`);
  if (tel) dit(!m.petits.length, `Z ${suf} : chaque cible visible fait 44 px au doigt`, m.petits.join(' | '));
  dit(m.pleins <= 1, `Z ${suf} : un plein au plus`, String(m.pleins));
  if (m.vue === 'argent-mois') {
    dit(!!m.vendu && m.vendu.fs >= 44 && m.vendu.clair && !m.vendu.carte, `A1 ${suf} : « vendu » est le chiffre d'affiche, en blanc sur le fond (≥ 44 px, sans carte)`, JSON.stringify(m.vendu));
    dit(m.ordre === 'vendu,recu,benefice,declarer', `A1 ${suf} : les quatre réponses, dans l'ordre`, m.ordre);
    if (tel) dit(!!m.duo && Math.abs(m.duo.recu.y - m.duo.benef.y) <= 1 && Math.abs(m.duo.yQ[0] - m.duo.yQ[1]) <= 1 && m.duo.recu.x < m.duo.benef.x && m.duo.recu.w < m.W * .6, `A2 ${suf} : reçu et bénéfice côte à côte`, JSON.stringify(m.duo));
    else dit(!!m.duo && Math.abs(m.duo.recu.y - m.duo.benef.y) <= 1, `A2 ${suf} : reçu et bénéfice sur la même ligne (ordinateur)`, JSON.stringify(m.duo));
    if (m.avenir) {
      const A = m.avenir, somme = A.leg.reduce((t, x) => t + x.eur, 0), wTot = A.segs.reduce((t, x) => t + x.w, 0);
      const parts = A.leg.length > 1 ? A.leg.map((x) => { const s = A.segs.find((y) => y.k === x.k); return s && somme ? Math.abs(s.w / wTot - x.eur / somme) : 1; }) : [];
      dit(A.segs.length === A.leg.length || A.leg.length <= 1, `A3 ${suf} : la barre de l'argent à venir a une part par étape`, `${A.segs.length} parts · ${A.leg.length} étapes`);
      dit(!parts.length || Math.max(...parts) < .06, `A3 ${suf} : chaque part suit le montant de son étape (± 6 points ; les écarts de 3 px comptent)`, parts.map((x) => x.toFixed(3)).join(' '));
      dit(!A.total || String(Math.round(somme)) === A.total || A.leg.length <= 1, `A3 ${suf} : les étapes font le total à venir`, `${somme} / ${A.total}`);
    } else dit(true, `A3 ${suf} : rien à venir ⇒ pas de carte (aucune carte vide)`);
    dit(!!m.urssaf, `A4 ${suf} : la carte URSSAF est là (son état : ${m.urssaf && m.urssaf.etat})`);
    if (m.urssaf && m.urssaf.declare != null) dit(m.urssaf.declare >= 44, `A4 ${suf} : « J'ai déclaré » ≥ 44 px`, String(m.urssaf.declare));
    dit(!m.brutAuMoins, `A5 ${suf} : le bénéfice brut ne dit jamais « au moins » (ce n'est pas un plancher)`);
  }
  if (m.vue === 'argent-avenir') {
    const V = m.av;
    dit(!!V && V.fois === 1, `V1 ${suf} : le total à venir est écrit UNE fois`, V && `${V.fois} fois (${V.total})`);
    dit(!!V && V.chiffreFs >= 44, `V1 ${suf} : le total en chiffre d'affiche (≥ 44 px)`, V && String(V.chiffreFs));
    dit(!!V && V.etapes.length === V.segs.length, `V2 ${suf} : une part de barre par étape`, V && `${V.etapes.join(',')} / ${V.segs.join(',')}`);
    dit(!!V && !!V.pm && (V.pm.eur !== '' || (/—/.test(V.pm.txt) && !/\b0[,.]?0*\s*€/.test(V.pm.txt))), `V3 ${suf} : le porte-monnaie pas lu dit « — », jamais 0 €`, V && JSON.stringify(V.pm));
    dit(!!V && V.nums.every((x) => x.plaque.includes(x.n)), `V4 ${suf} : chaque vente au N° connu porte sa plaque (${V ? V.nums.length : 0} sur ${V ? V.ventes : 0} montrées ; un N° pas su reste blanc)`, V && JSON.stringify(V.nums.filter((x) => !x.plaque.includes(x.n)).slice(0, 3)));
  }
  if (m.vue === 'messages-liste') {
    const S = m.ms;
    const iOng = S.groupes.findIndex((g) => g.onglet);
    dit(S.groupes.length > 0, `M1 ${suf} : les conversations sont rangées par compte (${S.groupes.length} groupe(s))`);
    dit(iOng <= 0, `M1 ${suf} : le compte de l'onglet est le premier groupe`, String(iOng));
    const desordre = S.groupes.filter((g) => g.ats.some((t, i) => i && t > g.ats[i - 1]));
    dit(!desordre.length, `M2 ${suf} : dans chaque compte, du plus récent au plus ancien`, desordre.map((g) => g.cle).join(','));
    const tetes = S.groupes.map((g) => g.ats[0] || 0).slice(iOng === 0 ? 1 : 0);
    dit(tetes.every((t, i) => !i || t <= tetes[i - 1]), `M2 ${suf} : les autres comptes, le plus récent d'abord`, tetes.join(','));
    dit(S.sansPlaque === 0, `M3 ${suf} : chaque conversation reliée à une paire montre sa plaque N° (${S.avecNum})`, String(S.sansPlaque));
    dit(S.vues.length === 3 && S.vues.every((v) => v.h >= 44) && S.vues.filter((v) => v.on).length === 1, `M4 ${suf} : « Toutes · Offres · Non lues », 44 px, un seul allumé`, JSON.stringify(S.vues));
    if (tel) dit(S.premiereLigne != null && S.premiereLigne <= 844 * 0.5 && S.visibles >= 6, `M5 ${suf} : la 1re conversation à mi-écran au plus, 6 au moins visibles`, `${S.premiereLigne} px · ${S.visibles} visibles`);
  }
  if (m.vue === 'messages-offre') {
    const K = m.conv;
    dit(K.paire && K.paireAvant, `M6 ${suf} : la paire en tête du fil`, JSON.stringify(K));
    dit(!!m.toastFil && m.toastFil.gestes >= 1 && m.toastFil.couvre === 0, `M8 ${suf} : un message passager ne couvre aucun geste de la tête du fil (‹, Retirer)`, JSON.stringify(m.toastFil));
    if (K.proposer != null) dit(K.proposer === true && K.pleinsCarte === 1, `M7 ${suf} : le plein va à « Proposer N € », un seul`, JSON.stringify(K));
    else console.log(`   ℹ️ M7 ${suf} : pas d'offre à trancher ICI (offre ${K.offre || 'aucune'} : l'extension n'est pas dans ce navigateur) — la règle est jugée sur le code (audit).`);
  }
  if (m.vue === 'parametres') {
    const P = m.pm;
    dit(P.cats === 10, `P1 ${suf} : les dix catégories au premier écran`, P.ids);
    if (tel) {
      dit(P.tuiles === 9 && P.colonnes === 3, `P1 ${suf} : neuf tuiles, trois par rangée ; « Mon compte » en carte`, `${P.tuiles} tuiles · ${P.colonnes} colonnes`);
      dit(P.basDernier != null && P.basDernier <= P.hautBarre, `P2 ${suf} : le premier écran tient sans défiler (dernière tuile à ${P.basDernier} px, au-dessus de la barre du bas à ${P.hautBarre})`);
      dit(P.rangees === 0, `P2 ${suf} : aucune rangée de réglage au premier écran`, String(P.rangees));
    }
  }
  if (m.vue === 'parametres-ventes' && tel) {
    const K = m.cat;
    dit(!!K.titre && K.titre.clair && K.titre.fs >= 24, `P3 ${suf} : le titre de la catégorie, grand et en blanc sur le fond`, JSON.stringify(K.titre));
    dit(K.titres > 0 && K.titresClairs === K.titres, `P3 ${suf} : les titres de groupe en blanc sur le fond`, `${K.titresClairs}/${K.titres}`);
    dit(K.icones === 0 && K.rangees.length > 0 && K.rangees.every((h) => h >= 44), `P3 ${suf} : des rangées sans icône, ≥ 44 px`, `${K.icones} icône(s) · ${K.rangees.join(',')}`);
    dit(!!K.retour && K.retour.w >= 44 && K.retour.h >= 44, `P3 ${suf} : le rond « ‹ » ≥ 44 px`, JSON.stringify(K.retour));
  }
  if (m.toutVoirBord) {
    const T = m.toutVoirBord;
    dit(T.length >= 1 && T.every((x) => x.ecart >= 8 && !x.recouvre), `FV1 ${suf} : « Tout voir » d'une vente — « Imprimer le bordereau » ne touche pas la marque du transporteur (≥ 8 px)`, JSON.stringify(T));
    dit(T.length >= 1 && T.every((x) => x.plein === false), `FV2 ${suf} : … et ce n'est pas un second plein (la fiche porte déjà le sien)`, JSON.stringify(T));
    // (16 nov., intégration, capture de Julien) au téléphone, « ⋯ » puis « Tout voir » : la tête de la feuille (Plus, ✕) jamais
    // sous un message passager (même règle que la fiche et la conversation : sous la tête). À l'ordinateur, en bas à droite.
    dit(m.ctxFiche != null && m.ctxFiche >= 15, `F10 ${suf} : le sur-titre de la fiche ouverte depuis sa ligne au texte courant (≥ 15 px)`, String(m.ctxFiche));
    if (m.W < 744) dit(!!m.toastPlus && m.toastPlus.tete >= 2 && m.toastPlus.couvreTete === 0, `F9 ${suf} : « Tout voir » déplié — un message passager ne couvre pas « Plus ✕ »`, JSON.stringify(m.toastPlus));
  }
  if (m.fd) {
    const F = m.fd, v = m.vue;
    if (tel) dit(F.hauteur != null && F.hauteur <= 844, `F4 ${suf} : la fiche tient en UN écran (${F.hauteur} px ≤ 844)`);
    dit(!!F.photo && F.photo.w >= m.W - (tel ? 1 : 2000) && F.photo.h >= 280 && !!F.plaque && /^N°\d+$/.test(F.plaque.txt), `F1 ${suf} : la photo pleine largeur et la plaque N°`, JSON.stringify({ photo: F.photo, plaque: F.plaque && F.plaque.txt }));
    dit(!!F.nom && F.nom.fs >= 26 && F.etats === 1, `F1 ${suf} : le nom (26 px) et UNE ligne d'état`, JSON.stringify({ nom: F.nom, etats: F.etats }));
    dit(F.actions.length <= 1 && m.pleins <= 1, `F2 ${suf} : UNE carte d'action, un plein au plus`, `${F.actions.join(',')} · ${m.pleins} plein(s)`);
    dit(F.segs.length === 3 && F.segs.filter((x) => x.on).length === 1 && F.segs.every((x) => x.h >= 44) && F.vues === 1, `F3 ${suf} : Argent · Sites · Histoire, une vue à la fois (44 px)`, JSON.stringify(F.segs));
    if (tel) dit(!F.petitTexte.length, `F3 ${suf} : texte ≥ 15 px`, F.petitTexte.join(' | '));
    dit(F.chiffres.every((c) => c.fs >= 22) && (!F.chiffres.length || Math.max(...F.chiffres.map((c) => c.fs)) >= 28), `F3 ${suf} : les chiffres 28–36 px`, JSON.stringify(F.chiffres));
    if (v !== 'fiche-plus') dit(F.plus && F.plusFerme && F.toutVoir && F.tuiles.length >= 4, `F6 ${suf} : « ⋯ » fermé, ses tuiles (${F.tuiles.join(', ')}) et « Tout voir »`);
    else dit(!F.plusFerme && !!F.feuille && F.feuille.r <= m.W + 1 && F.tuilesVues.length >= 8 && F.tuilesVues.every((h) => h >= 44) && F.toutVoir, `F6 ${suf} : « ⋯ » ouvert : ${F.tuilesVues.length} tuiles (≥ 44 px) et « Tout voir », dans l'écran`, JSON.stringify({ feuille: F.feuille, t: F.tuilesVues }));
    dit(!!F.toast && F.toast.ronds === 2 && F.toast.couvre === 0, `F8 ${suf} : un message passager ne couvre ni ‹ ni ⋯ (fiche plein écran)`, JSON.stringify(F.toast));
    // (16 nov., intégration, capture de Julien) « ⋯ » ouvert au téléphone, « Tout voir » déplié : la feuille monte haut et
    // un message passager couvrait « Plus ✕ ». Même règle que la fiche et la conversation : sous la tête.
    if (F.toast && F.toast.tete) dit(F.toast.tete >= 2 && F.toast.couvreTete === 0, `F9 ${suf} : un message passager ne couvre pas la tête de la feuille « ⋯ » (Plus, ✕)`, JSON.stringify(F.toast));
    if (v === 'fiche-histoire') dit(F.vue === 'histoire' && F.histoire.length >= 3 && F.histoire.length <= 5 && F.histoire[0] === 'achat:am' && F.histoire.includes('vente') && F.histoire.includes('colis:am'), `F7 ${suf} : l'histoire en 3 à 5 lignes, l'achat à relier et l'envoi en ambre`, F.histoire.join(','));
    dit(!F.jargon.length, `F5 ${suf} : aucun identifiant ni mot technique à l'écran`, F.jargon.slice(0, 5).join(' | '));
    dit(!F.doublons.length, `F5 ${suf} : chaque geste, chaque titre UNE fois`, F.doublons.slice(0, 5).join(' | '));
    const deux = Object.entries(F.montants).filter(([, n]) => n > 1);
    dit(!deux.length, `F5 ${suf} : chaque montant UNE fois`, JSON.stringify(F.montants));
    if (v === 'fiche-vendue') {
      dit(F.etat && F.etat.ambre && /Vendue 110\s€ · à envoyer/.test(F.etat.txt), `D1 ${suf} : « Vendue 110 € · à envoyer » en ambre (un geste)`, JSON.stringify(F.etat));
      dit(F.actions[0] === 'relier' && !!F.relier && F.relier.tx === '65000000001' && F.relier.cents === '5200' && /Relier · 52\s€/.test(F.relier.txt), `D1 ${suf} : l'achat PROPOSÉ (son n° de transaction) et « Relier · 52 € »`, JSON.stringify(F.relier));
      dit(!!F.propose && /payée 52\s€/.test(F.propose), `D1 ${suf} : la proposition dit le prix payé`, F.propose);
      dit(F.vue === 'argent', `D1 ${suf} : ouverte sur Argent (une vente)`, F.vue);
    }
    if (v === 'fiche-reliee') {
      dit(F.actions[0] === 'bordereau', `D2 ${suf} : reliée ⇒ « Imprimer le bordereau »`, F.actions.join(','));
      dit(F.etat && !F.etat.ambre && /^Vendue 110\s€ le /.test(F.etat.txt), `D2 ${suf} : la carte porte le geste ; la ligne d'état dit la vente, sans ambre`, JSON.stringify(F.etat));
      dit(F.vue === 'argent' && F.chiffres.length === 2 && F.chiffres[0].fs >= 36 && /^\+/.test(F.chiffres[0].txt), `D2 ${suf} : le bénéfice en grand (36), l'achat à côté`, JSON.stringify(F.chiffres));
    }
    if (v === 'fiche-2sites') {
      dit(F.actions[0] === 'baisser', `D3 ${suf} : en vente ⇒ « Baisser le prix »`, F.actions.join(','));
      // (16 nov., finitions) les sites du Stock ; une lecture absente (eBay, Vestiaire…) est une rangée « pas su » à part.
      const vusD3 = F.sites.filter((x) => !/:pas-su$/.test(x));
      dit(F.vue === 'sites' && vusD3.length === 2 && vusD3.includes('vinted:en-ligne') && vusD3.includes('leboncoin:en-ligne'), `D3 ${suf} : ouverte sur Sites, une rangée par site`, F.sites.join(','));
      dit(F.etat && /sur 2 sites/.test(F.etat.txt) && !F.etat.ambre, `D3 ${suf} : « En vente 85 € · sur 2 sites… »`, JSON.stringify(F.etat));
    }
  }
}

module.exports = { VUES, preparer, mesurer, baseFiches };
if (require.main === module) (async () => {
  // M7 (sur le code) — sans l'extension dans ce navigateur, l'offre ne se tranche pas ici : la règle du plein est lue
  // dans le code de la carte d'offre (App.jsx) — « Proposer N € » est LE plein quand une contre-offre est calculée,
  // « Accepter » ne l'est alors pas.
  {
    const app = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8');
    const i = app.indexOf("data-offre-geste=\"proposer\""), bloc = i > 0 ? app.slice(app.lastIndexOf('<div', i), app.indexOf('</div>', i)) : '';
    const prop = (bloc.match(/<button[^>]*data-offre-geste="proposer"[^>]*>/) || [''])[0];
    const acc = (bloc.match(/contre!=null \? <button[^>]*data-offre-geste="accepter"[^>]*>/) || [''])[0];
    dit(/vrm-chat-btn-p/.test(prop) && acc && !/vrm-chat-btn-p/.test(acc), 'M7 (code) : le plein de l\'offre va à « Proposer N € », pas à « Accepter »', `${prop.slice(0, 80)} | ${acc.slice(0, 60)}`);
  }
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const th of THEMES) for (const vue of VOULUES) {
      const suf = `${vue}-${W}-${th}`;
      let o;
      try {
        o = await P.ouvrir(nav, { W, sombre: th === 'sombre', b: vue.startsWith('fiche-') ? baseFiches() : B.baseVolume(), url: VUES[vue], api: B.apiVolume, dsf: DSF });
        await P.pret(o.pg);
        await preparer(o, vue);
        await o.pg.waitForTimeout(500);
        await o.pg.screenshot({ path: path.join(SHOTS, suf + '.png') });
        if (CAPTURE) { console.log('capture', suf); continue; }
        const m = await o.pg.evaluate(mesurer, vue);
        juger(m, suf, W < 600);
        if (o.erreurs.length) console.log(`   (erreurs de page : ${o.erreurs.slice(0, 2).join(' | ')})`);
      } catch (err) { dit(false, `${suf} : ouverture`, String(err.message || err).slice(0, 200)); }
      finally { if (o) await o.ctx.close().catch(() => {}); }
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log(`\n${bilan.ok} ✅ · ${bilan.ko} ❌ (captures : ${SHOTS})`);
  process.exit(bilan.ko ? 1 : 0);
})();
