// ════════════════════════════════════════════════════════════════════════════
//  BANC « FICHE DIRECTE » (19 nov. 2026 — docs/passation/2026-11-19-fiche-directe.md)
//
//  Julien, 19 nov. : « les fiches des paires de chaussures : je dois cliquer sur la paire puis cliquer sur les points
//  pour avoir des informations. Ce n'est pas normal, ça doit être beaucoup plus accessible et beaucoup plus simple » ;
//  « l'outil doit être pratique, pas chiant ». Ce banc juge LA RÈGLE, sur l'app rendue, par ses `data-*` (jamais un
//  libellé, jamais une classe de style : il reste vrai quand la fiche change d'habillage — contrat « VRM natif ») :
//    U  UN SEUL TOUCHER : depuis Annonces, Ventes, le Stock, Aujourd'hui et la recherche, toucher la rangée d'un
//       article ouvre LA fiche de CET article (son N°, par identité) — aucune étape intermédiaire ;
//    F  le PREMIER ÉCRAN (390 × 844) porte, sans défiler ni toucher : la photo, le N°, le titre, UNE ligne d'état, les
//       FAITS (prix, achat, bénéfice, taille, date, place — et prix mini, favoris et vues quand ils existent), les
//       sites, le bouton principal ; un fait pas su s'écrit « — » avec sa raison, jamais 0 ;
//    P  rien d'utile seulement derrière « ⋯ » : plus d'onglets, les gestes sont SUR la fiche, tout montant ou toute
//       date de la feuille « ⋯ » est aussi sur la fiche ; à l'ordinateur, aucun « ⋯ » ;
//    S  les valeurs se changent SUR PLACE : toucher « Achat — » ouvre son champ à sa place (la fiche reste ouverte,
//       aucune feuille), Entrée écrit ; « Prix mini » de même ; le prix ouvre « Prix partout » en un toucher ;
//    Q  la qualité : un seul plein, cibles ≥ 44 px, contrastes ≥ 4,5:1 sur le fond rendu, rien ne déborde, aucun mot
//       coupé, la fiche entière ≤ 1,5 écran, un message passager ne couvre ni la barre ni la photo.
//  Base INVENTÉE : `baseFiches()` du banc ecrans-verre-2 (vendue sans achat N°3119, vendue reliée N°3120, en vente
//  sur 2 sites N°3102) + les cas qui cassent : sans photo (N°3103), titre très long et prix à 4 chiffres (N°3104),
//  6 sites (N°3105), tout pas su (N°3106). 390 tactile, 1512 et 1280, clair et sombre.
//  `CAS=3102,3106` `LARGEURS=390` `THEMES=clair` `SHOTS=<dossier>` `DSF=2` · `BANC_DIST=<dist>` (l'arbre d'avant : ROUGE) ·
//  `MUTATION=faits|photo|pleins|onglets|plus|montee` (chacune rougit son contrôle). Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const E = require('./ecrans-verre-2.cjs');

const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const CAS = { 3119: 'vendue sans achat', 3120: 'vendue reliée', 3102: 'en vente sur 2 sites', 3103: 'sans photo', 3104: 'titre très long, 1 250 €', 3105: '6 sites', 3106: 'tout pas su', 3107: 'Leboncoin seul', 3108: 'eBay seul' };
const VOULUS = liste('CAS', Object.keys(CAS).join(','));
const LARGEURS = liste('LARGEURS', '390,1512,1280').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const CHEMINS = liste('CHEMINS', 'annonces,ventes,stock,journee,recherche');
const DSF = Number(process.env.DSF || 1);
const MUT = process.env.MUTATION || '';
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-fiche-directe');
fs.mkdirSync(SHOTS, { recursive: true });
const J = 86400000;
const bilan = { ok: 0, ko: 0 };
const dit = (ok, quoi, detail = '') => { if (ok) bilan.ok++; else bilan.ko++; console.log(`${ok ? '✅' : '❌'} ${quoi}${detail && !ok ? ' — ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 420) : ''}`); return ok; };

// ── La base : celle de la fiche D, plus les cas qui cassent (inventés). ──
function baseDirecte() {
  const b = E.baseFiches();
  const m = b.main[0].data, num = m.vinted_annonce_numeros;
  const uid = b.accounts[0].vinted_user_id;
  const iso = (j) => new Date(Date.now() - j * J).toISOString();
  const photo = (id) => `https://images1.vinted.net/t/${id}/f800/fd.jpeg?s=abc`;
  const lst = b.rows.find((r) => r.id === `harvest_${uid}_listings`);
  const enl = b.rows.find((r) => r.id === `harvest_${uid}_enligne`);
  const lbc = b.rows.find((r) => r.id === 'lbc_listings');
  const enLigne = (id, n, titre, prix, extra = {}, fiche = {}) => {
    lst.data.payload.items.push({ id, title: titre, brand_title: 'Nike', size_title: '', status: 'Bon état', price: { amount: prix, currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false,
      favourite_count: 2, view_count: 30, created_at_ts: iso(20), photo: { url: photo(id), high_resolution: { timestamp: Math.floor((Date.now() - 20 * J) / 1000) } }, ...extra });
    num[id] = { numero: n, num: n, accountId: String(uid), numberedAt: iso(20), title: titre, photo: extra.photo === null ? '' : photo(id), ...fiche };
    if (enl) { enl.data.ids.push(id); enl.data.items.push({ id, title: titre }); }
    m.vinted_used_nums.push(Number(n));
  };
  // SANS PHOTO — ni l'annonce ni la fiche n'en portent.
  enLigne(7699990013, '3103', 'Asics Gel-Kayano 14 argent taille 41', '95.0', { photo: null }, { buyPrice: '50' });
  // TITRE TRÈS LONG, prix à quatre chiffres, prix d'achat à quatre chiffres.
  enLigne(7699990014, '3104', 'Nike Air Jordan 1 Retro High OG Chicago Lost and Found édition anniversaire avec boîte d’origine et lacets de rechange taille 43 1/3', '1250.0', {}, { buyPrice: '1020', min: '1100' });
  // SIX SITES — Vinted et cinq annonces Leboncoin reliées à la main au même N° (comptes différents).
  enLigne(7699990015, '3105', 'New Balance 550 blanc vert taille 42', '70.0', {}, { buyPrice: '30' });
  for (let k = 1; k <= 5; k++) { const id = 2900000100 + k; lbc.data.items[id] = { subject: 'New Balance 550 blanc vert 42', price: 70 + (k === 5 ? 5 : 0), status: 'active', url: `https://www.leboncoin.fr/ad/chaussures/${id}`, account: 'compte_lbc_' + k, accountName: 'boutique_lbc_' + k }; m.vrm_lbc_liens[id] = '3105'; }
  // TOUT PAS SU — un N° dont la fiche existe, sans annonce lue, sans prix d'achat, sans taille, sans place.
  num[7699990016] = { numero: '3106', num: '3106', accountId: String(uid), numberedAt: iso(40), title: 'Sac en toile', photo: '' };
  m.vinted_used_nums.push(3106);
  // (19 nov., Julien : « Vinted n'est pas la plateforme principale des autres ») L'ARTICLE SANS AUCUNE ANNONCE VINTED.
  // LEBONCOIN SEUL — une annonce Leboncoin reliée au N°3107 (lien posé à la main), son prix d'achat posé par N°.
  lbc.data.items[2900000201] = { subject: 'Salomon XT-6 noir taille 43', price: 120, status: 'active', url: 'https://www.leboncoin.fr/ad/chaussures/2900000201', images: [photo('lbc2900000201')], publieeLe: iso(6), stats: { favoris: 3 }, accountName: 'boutique_lbc' };
  m.vrm_lbc_liens[2900000201] = '3107'; m.vinted_buyprice_by_num = { ...(m.vinted_buyprice_by_num || {}), 3107: '60' }; m.vinted_used_nums.push(3107);
  // EBAY SEUL — une annonce eBay dont le SKU désigne le N°3108 (VRM-3108), sans prix d'achat.
  const garder = (id, data) => { const r = b.rows.find((x) => x.id === id); if (r) return r; const n = { id, data }; b.rows.push(n); return n; };
  garder('ebay_comptes', { rev: 1, comptes: [{ cle: 'aaaaaaaaaaaaaaaa', pseudo: 'vendeur_ebay', principal: true, deconnecteLe: null }] });
  const eb = garder('ebay_listings', { capturedAt: Date.now(), items: [] }); eb.data.capturedAt = Date.now(); eb.data.items = [...(eb.data.items || []), { itemId: '5550108', sku: 'VRM-3108', price: '140.00', currency: 'EUR', title: 'Asics Gel-Lyte III crème taille 44', depuis: iso(11), photo: photo('eb5550108'), observateurs: 5 }];
  garder('ebay_orders', { orders: [], capturedAt: Date.now() });
  // Aujourd'hui, un SKU « VRM-3108 » ne désigne un N° que si UNE fiche numérotée le porte (`numEbayLu`, la garde d'identité) :
  // la fiche existe (numérotée avant la mise en ligne), sans aucune annonce Vinted lue. Le modèle « à égalité » (branche
  // claude/annonces-a-egalite) portera le N° par l'annonce du site elle-même ; l'entrée de la fiche (`articleFiche`) est la même.
  num[7699990018] = { numero: '3108', num: '3108', accountId: String(uid), numberedAt: iso(40), title: 'Asics Gel-Lyte III crème taille 44', photo: '' };
  m.vinted_used_nums.push(3108);
  if (enl) enl.data.n = enl.data.ids.length;
  lst.data.nItems = lst.data.payload.items.length; lst.data.payload.pagination = { total_entries: lst.data.payload.items.length };
  return b;
}

async function ouvrir(nav, W, sombre, url) {
  const o = await P.ouvrir(nav, { W, sombre, b: baseDirecte(), url, api: B.apiVolume, dsf: DSF });
  if (W === 1280) await o.pg.setViewportSize({ width: 1280, height: 800 });
  // Le design de la production (allumé par défaut) : le banc ne juge pas « Ancien design ».
  await o.pg.evaluate(() => { try { localStorage.setItem('vrm_design_v2', '1'); } catch (_) {} });
  await o.pg.reload({ waitUntil: 'domcontentloaded' });
  await P.pret(o.pg);
  return o;
}
const fermerToasts = (pg) => pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click(); }).catch(() => {});
async function muter(pg) {
  if (MUT === 'faits') await pg.addStyleTag({ content: '[data-fd-faits]{display:none!important}' });
  if (MUT === 'photo') await pg.addStyleTag({ content: '[data-fiche-heros]{min-height:560px!important}' });
  if (MUT === 'pleins') await pg.evaluate(() => { const f = document.querySelector('[data-fiche-paire]'); const t = f && f.querySelector('[data-fd-tuile]'); if (t) t.setAttribute('data-fd-plein', ''); });
  if (MUT === 'onglets') await pg.evaluate(() => { const f = document.querySelector('[data-fiche-paire]'); const g = f && f.querySelector('[data-fd-faits]'); if (g) { const t = document.createElement('div'); t.setAttribute('role', 'tablist'); t.innerHTML = '<button role="tab">Argent</button>'; g.before(t); g.hidden = true; } });
  if (MUT === 'plus') await pg.evaluate(() => { const f = document.querySelector('[data-fiche-paire]'); const s = f && f.querySelector('[data-fd-plus]'); const g = f && f.querySelector('[data-fd-tuiles]'); if (s && g) (s.querySelector('[role="dialog"]') || s).append(g); });
}

// ── La mesure de la fiche, DANS la page. ──
function mesurerFiche() {
  const f = document.querySelector('[data-fiche-paire]');
  if (!f) return null;
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 1 && r.height > 1 && c.visibility !== 'hidden' && c.display !== 'none' && !e.closest('[hidden]'); };
  const R = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom), r: Math.round(r.right) }; };
  const boite = R(f);
  const dansEcran = (e) => { if (!vis(e)) return false; const r = e.getBoundingClientRect(); return r.top >= boite.y - 1 && r.bottom <= Math.min(innerHeight, boite.b) + 1; };
  const plus = f.querySelector('[data-fd-plus]');
  const horsPlus = (e) => !(plus && plus.contains(e));
  const faits = [...f.querySelectorAll('[data-fd-fait]')].map((e) => ({ cle: e.getAttribute('data-fd-fait'), su: e.getAttribute('data-fd-fait-su') === '1', porte: e.getAttribute('data-fd-fait-porte') || '', txt: e.innerText.replace(/\s+/g, ' ').trim(), vu: dansEcran(e), ...R(e), bouton: e.tagName === 'BUTTON' }));
  const pleins = [...f.querySelectorAll('[data-fd-plein]')].filter(vis).filter(horsPlus);
  const texte = (e) => (e ? e.innerText.replace(/[  ]/g, ' ') : '');
  const montants = (t) => [...new Set((t.match(/[+−-]?\d[\d ]*(?:,\d+)?\s?€|\b\d{1,2} (?:janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc)\.?/g) || []).map((x) => x.replace(/\s+/g, ' ').trim()))];
  const page = f.cloneNode(true); page.querySelectorAll('[data-fd-plus]').forEach((x) => x.remove());
  const dPage = document.createElement('div'); dPage.style.cssText = 'position:fixed;left:-9999px;top:0;width:390px'; dPage.append(page); document.body.append(dPage);
  const tPage = texte(page); dPage.remove();
  const sonde = (() => { const z = document.querySelector('.vrm-toasts'); if (!z) return null; const b = document.createElement('div'); b.className = 'vrm-toast';
    b.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 16px;max-width:520px;width:100%;box-sizing:border-box;border:1px solid transparent';
    b.innerHTML = '<span class="vrm-toast-icon">i</span><span>24 nouvelles paires numérotées · N°3245, 3246, 3247, 3248, 3249 +19 · à écrire sur leurs rangements</span>'; z.prepend(b);
    const bulles = [...z.children].filter(vis).map(R); b.remove();
    const zones = [f.querySelector('[data-fd-barre], .n-barre-titre'), f.querySelector('[data-fiche-heros]')].filter(vis).map(R);
    const coupe = (a, c) => a.x < c.r && c.x < a.r && a.y < c.b && c.y < a.b;
    return { place: z.getAttribute('data-toasts-place'), bulles, zones: zones.length, couvre: zones.filter((r) => bulles.some((t) => coupe(t, r))).length }; })();
  const cadre = f.firstElementChild && f.scrollHeight;
  return {
    num: f.getAttribute('data-fiche-paire'), W: innerWidth, H: innerHeight, boite, hauteur: f.scrollHeight, cadre,
    onglets: [...f.querySelectorAll('[role="tab"], [role="tablist"]')].filter(vis).filter((e) => !e.closest('[data-fiche-plus]')).length,
    photo: (() => { const e = f.querySelector('[data-fiche-heros-photo]'); return e ? { ...R(e), vu: dansEcran(e), image: e.getAttribute('data-fiche-heros-photo') === '1', bouton: e.tagName === 'BUTTON' } : null; })(),
    plaque: (() => { const e = f.querySelector('[data-fiche-grand-num]'); return e ? { txt: e.innerText.replace(/\s/g, ''), vu: dansEcran(e) } : null; })(),
    titre: (() => { const e = f.querySelector('[data-fd-titre]'); if (!e) return null; const lh = parseFloat(getComputedStyle(e).lineHeight) || 24; return { vu: dansEcran(e), lignes: Math.round(e.getBoundingClientRect().height / lh), txt: e.innerText.slice(0, 40) }; })(),
    etats: [...f.querySelectorAll('[data-fd-etat]')].filter(vis).map((e) => ({ vu: dansEcran(e), ambre: e.getAttribute('data-fd-ambre') === '1', txt: e.innerText })),
    faits, sites: (() => { const e = f.querySelector('[data-fd-sites]'); return e ? { n: Number(e.getAttribute('data-fd-sites')), vu: dansEcran(e), rangees: [...e.querySelectorAll('[data-fiche-site]')].filter(vis).length, pasLus: (e.querySelector('[data-fd-sites-pas-lus]') || { getAttribute: () => '' }).getAttribute('data-fd-sites-pas-lus'), ...R(e) } : null; })(),
    sitesListe: [...f.querySelectorAll('[data-fiche-site]')].filter(vis).map((x) => x.getAttribute('data-fiche-site') + ':' + x.getAttribute('data-fiche-site-etat')),
    texte: (() => { const c = f.cloneNode(true); c.querySelectorAll('[data-fd-plus], [data-fiche-plus]').forEach((x) => x.remove()); return c.textContent.replace(/\s+/g, ' '); })(),
    pleins: pleins.map((b) => ({ txt: b.innerText.trim(), vu: dansEcran(b), ...R(b) })),
    action: (f.querySelector('[data-fd-action]') || { getAttribute: () => '' }).getAttribute('data-fd-action'),
    tuiles: [...f.querySelectorAll('[data-fd-tuile]')].map((t) => ({ k: t.getAttribute('data-fd-tuile'), page: horsPlus(t) && vis(t), h: Math.round(t.getBoundingClientRect().height) })),
    histoire: (() => { const e = f.querySelector('[data-fd-histoire]'); return e ? { etat: e.getAttribute('data-fd-histoire'), vues: [...e.querySelectorAll('[data-fiche-hist-etape]')].filter(vis).map((x) => x.getAttribute('data-fiche-hist-etape')), total: Number((e.querySelector('[data-fiche-hist]') || { getAttribute: () => 0 }).getAttribute('data-fiche-hist')), toutVoir: !!e.querySelector('[data-fd-tout-voir]') } : null; })(),
    plusOuvrir: [...f.querySelectorAll('[data-fd-plus-ouvrir]')].filter(vis).length,
    plusSeul: plus ? montants(texte(plus)).filter((x) => !tPage.replace(/\s+/g, ' ').includes(x)) : [],
    zeros: faits.filter((x) => !x.su && /(^|\s)[+−-]?0(,00)?\s?€/.test(x.txt)).map((x) => x.cle),
    deborde: document.scrollingElement.scrollWidth - innerWidth,
    hors: [...f.querySelectorAll('*')].filter(vis).filter((e) => { const r = e.getBoundingClientRect(); if (r.right <= boite.r + 1 && r.left >= boite.x - 1) return false; for (let a = e.parentElement; a && a !== f; a = a.parentElement) { const c = getComputedStyle(a); if (/auto|scroll|hidden|clip/.test(c.overflowX)) return false; } return true; }).map((e) => (e.className || e.tagName) + ' « ' + (e.innerText || '').slice(0, 20) + ' »').slice(0, 4),
    rognes: [...f.querySelectorAll('*')].filter(vis).filter((e) => e.children.length === 0 && (e.innerText || '').trim().length > 1 && e.scrollWidth > e.clientWidth + 1 && /hidden|clip/.test(getComputedStyle(e).overflowX) && getComputedStyle(e).textOverflow !== 'ellipsis').map((e) => (e.innerText || '').slice(0, 24)).slice(0, 4),
    toast: sonde,
  };
}

function jugerFiche(m, n, suf, tel) {
  if (!dit(!!m && m.num === n, `F0 ${suf} : la fiche du N°${n} est rendue`, m && m.num)) return;
  const cles = m.faits.map((x) => x.cle);
  const il = (k) => m.faits.find((x) => x.cle === k);
  const attendus = ['prix', 'achat', 'taille', 'quand', 'place'].concat(cles.includes('si-vendue') ? ['si-vendue'] : ['benefice']);
  dit(m.onglets === 0, `P1 ${suf} : plus d'onglets (Argent · Sites · Histoire) — tout est sur la fiche`, String(m.onglets));
  dit(attendus.every((k) => il(k)), `F1 ${suf} : les faits attendus sont là (${cles.join(', ')})`, attendus.filter((k) => !il(k)).join(','));
  dit(attendus.every((k) => il(k) && il(k).vu), `F2 ${suf} : chaque fait est visible au premier écran, sans défiler ni toucher`, m.faits.filter((x) => !x.vu).map((x) => `${x.cle}@${x.y}-${x.b}`).join(' '));
  dit(!!m.photo && m.photo.vu && !!m.plaque && m.plaque.vu && new RegExp('^N°' + n + '$').test(m.plaque.txt) && !!m.titre && m.titre.vu && m.titre.lignes <= 2, `F3 ${suf} : en-tête compact — photo, N°, titre sur 2 lignes au plus`, { photo: m.photo, plaque: m.plaque, titre: m.titre });
  dit(m.etats.filter((e) => /\S/.test(e.txt)).length >= 1 && m.etats.every((e) => e.vu), `F3 ${suf} : la ligne d'état est au premier écran`, m.etats);
  if (tel) dit(!!m.photo && m.photo.h >= 110 && m.photo.h <= 170, `F3 ${suf} : la photo fait 110 à 170 px (${m.photo && m.photo.h})`);
  if (n !== '3106') dit(!!m.sites && m.sites.vu && m.sites.rangees === m.sites.n && m.sites.n >= 1, `F4 ${suf} : les sites (${m.sites && m.sites.n}) au premier écran, une rangée par site`, m.sites);
  if (n === '3105') dit(!!m.sites && m.sites.n === 6, `F4 ${suf} : six sites, six rangées`, m.sites);
  if (m.action) dit(m.pleins.length === 1 && m.pleins[0].vu, `F5 ${suf} : le bouton principal (« ${m.pleins[0] && m.pleins[0].txt} ») est au premier écran`, m.pleins);
  dit(m.pleins.length <= 1, `Q1 ${suf} : un seul plein`, m.pleins.map((x) => x.txt).join(' | '));
  dit(m.faits.filter((x) => !x.su).every((x) => /—/.test(x.txt) && x.txt.replace(/—/g, '').trim().split(' ').length >= 2) && !m.zeros.length, `F6 ${suf} : un fait pas su s'écrit « — » avec sa raison, jamais 0`, m.faits.filter((x) => !x.su).map((x) => x.txt).join(' | '));
  dit(m.tuiles.length > 0 && m.tuiles.every((t) => t.page), `P2 ${suf} : les gestes (${m.tuiles.map((t) => t.k).join(', ')}) sont SUR la fiche, pas derrière « ⋯ »`, m.tuiles.filter((t) => !t.page).map((t) => t.k).join(','));
  dit(!m.plusSeul.length, `P3 ${suf} : aucun montant ni date seulement derrière « ⋯ »`, m.plusSeul.join(' | '));
  if (!tel) dit(m.plusOuvrir === 0, `P4 ${suf} : à l'ordinateur, aucun menu « ⋯ »`, String(m.plusOuvrir));
  dit(!!m.histoire && m.histoire.vues.length <= 3 && m.histoire.toutVoir && (m.histoire.total <= 3 || m.histoire.vues.length === 3), `F7 ${suf} : l'histoire repliée à ses 3 dernières étapes (${m.histoire && m.histoire.vues.join(' → ')}) et « Tout voir »`, m.histoire);
  // 1,5 écran ; chaque site au-delà de deux est une rangée d'information de plus (≈ 50 px), jamais cachée (F4).
  const plafond = Math.round(844 * 1.5 + 50 * Math.max(0, ((m.sites && m.sites.n) || 0) - 2));
  if (tel) dit(m.hauteur <= plafond + 1, `Q2 ${suf} : la fiche entière tient sur 1,5 écran${plafond > 1266 ? ' (+ une rangée par site au-delà de deux)' : ''} (${m.hauteur} px ≤ ${plafond})`);
  dit(m.deborde <= 1 && !m.hors.length && !m.rognes.length, `Q3 ${suf} : rien ne déborde, aucun texte rogné`, { page: m.deborde, hors: m.hors, rognes: m.rognes });
  if (tel) dit(!!m.toast && m.toast.zones >= 2 && m.toast.couvre === 0, `Q4 ${suf} : un message passager ne couvre ni la barre ni la photo de la fiche`, m.toast);
  if (n === '3119') dit(il('achat') && !il('achat').su && il('achat').porte && il('benefice') && !il('benefice').su, `F8 ${suf} : vendue sans achat — « Achat — » est la porte, le bénéfice dit « — » et pourquoi`, m.faits.map((x) => x.txt).join(' | '));
  if (n === '3120') dit(il('benefice') && il('benefice').su && /\+58\s?€/.test(il('benefice').txt) && !/au moins/i.test(il('benefice').txt) && m.action === 'bordereau', `F8 ${suf} : vendue reliée — bénéfice +58 €, jamais « au moins », plein « bordereau »`, { b: il('benefice'), a: m.action });
  if (n === '3102') dit(m.action === 'baisser' && il('mini') && il('interet') && /4\s·\s61/.test(il('interet').txt) && m.sites.n === 2, `F8 ${suf} : en vente sur 2 sites — prix mini, favoris · vues (4 · 61), plein « baisser »`, { a: m.action, f: cles });
  if (n === '3104') dit(il('prix') && /1\s?250\s?€/.test(il('prix').txt) && il('achat') && /1\s?020\s?€/.test(il('achat').txt), `F8 ${suf} : prix à quatre chiffres écrits en entier`, m.faits.map((x) => x.txt).join(' | '));
  if (n === '3103') dit(!!m.photo && !m.photo.image && m.photo.vu, `F8 ${suf} : sans photo — la place de la photo reste (silhouette), rien ne saute`, m.photo);
  if (n === '3107' || n === '3108') {
    const site = n === '3107' ? 'leboncoin' : 'ebay';
    dit(!!m.titre && !/jamais servi|sans titre/i.test(m.titre.txt) && m.titre.txt.trim().length > 6 && !!m.photo && m.photo.image, `A1 ${suf} : l'article a SON titre et SA photo (ceux de son annonce ${site})`, { t: m.titre, p: m.photo });
    dit(il('prix') && il('prix').su && il('quand') && il('quand').su && !!m.sites && m.sites.n === 1 && m.sitesListe.join() === site + ':en-ligne', `A2 ${suf} : prix, jours en ligne et site lus sur ${site} — rien de vide`, { f: m.faits.map((x) => x.txt), s: m.sitesListe });
    dit(!/vinted/i.test(m.texte), `A3 ${suf} : rien ne dit « Vinted » (ni « relie à Vinted »)`, (m.texte.match(/.{0,30}vinted.{0,30}/i) || [''])[0]);
    dit(m.tuiles.length >= 3 && m.pleins.length === 1, `A4 ${suf} : ses gestes (${m.tuiles.map((t) => t.k).join(', ')}) et UN bouton principal`, m.pleins);
    if (n === '3107') dit(il('achat') && il('achat').su && /60\s?€/.test(il('achat').txt) && il('si-vendue') && il('si-vendue').su && il('interet') && /3/.test(il('interet').txt), `A5 ${suf} : achat 60 € (posé par N°), bénéfice prévu, 3 favoris lus chez Leboncoin`, m.faits.map((x) => x.txt).join(' | '));
    if (n === '3108') dit(il('achat') && !il('achat').su && il('achat').porte === 'achat', `A5 ${suf} : « Achat — » se tape sur place, sans annonce Vinted`, il('achat'));
  }
  if (n === '3106') dit(m.faits.filter((x) => !x.su).length >= 5, `F8 ${suf} : tout pas su — cinq faits au moins disent « — »`, m.faits.map((x) => x.txt).join(' | '));
}

async function ouvrirParNum(pg, n) {
  await pg.evaluate((x) => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: x })), n);
  await pg.waitForSelector(`[data-fiche-paire="${n}"]`, { timeout: 12000 }).catch(() => {});
  await pg.waitForSelector(`[data-fiche-paire="${n}"][data-n-etat="ouverte"], [data-fiche-paire="${n}"]:not([data-n-etat])`, { timeout: 4000 }).catch(() => {});
  await pg.waitForFunction(() => !document.querySelector('[data-fd-propose="lecture"], [data-fiche-lecture-en-cours="1"]'), null, { timeout: 12000 }).catch(() => {});
  await pg.waitForTimeout(1300);
}

// U — UN SEUL TOUCHER depuis chaque liste.
async function unToucher(nav, chemin, W, sombre) {
  const suf = `${chemin}-${W}-${sombre ? 'sombre' : 'clair'}`;
  const url = { annonces: '/?tab=annonces', ventes: '/?tab=ventes', stock: '/?tab=garage', journee: '/?tab=journee', recherche: '/?tab=journee' }[chemin];
  let o;
  try {
    o = await ouvrir(nav, W, sombre, url);
    const pg = o.pg;
    await pg.waitForTimeout(2200); await fermerToasts(pg);
    if (chemin === 'recherche') { await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-article', { detail: '3102' }))); await pg.waitForSelector('[data-tout-annonce]', { timeout: 12000 }).catch(() => {}); await pg.waitForTimeout(600); }
    const sel = chemin === 'recherche' ? '[data-tout-annonce]' : '[data-fiche-ligne]';
    await pg.waitForSelector(sel + (chemin === 'recherche' ? '' : '[data-fl-num]'), { timeout: 20000, state: 'attached' }).catch(() => {}); await pg.waitForTimeout(600);
    // La rangée VISIBLE (celle qu'un doigt atteint) et le N° qu'elle porte, par identité.
    const chercher = ([sel, rech]) => { for (const e of document.querySelectorAll(sel)) { const r = e.getBoundingClientRect(); if (r.width < 40 || r.height < 30 || r.top < 110 || r.bottom > innerHeight - 110) continue;
      const x = Math.min(innerWidth - 8, r.left + Math.min(r.width * 0.5, 190)), y = r.top + r.height / 2; const t = document.elementFromPoint(x, y); if (!t || !e.contains(t)) continue;
      const num = rech ? '3102' : (e.getAttribute('data-fl-num') || ''); if (!num || num.includes(',')) continue; return { x, y, num }; } return null; };
    let cible = await pg.evaluate(chercher, [sel, chemin === 'recherche']);
    // À l'ordinateur, une liste peut commencer plus bas que le premier écran : on défile jusqu'à sa première rangée (comme lui).
    if (!cible) { await pg.evaluate((sel) => { const e = [...document.querySelectorAll(sel + '[data-fl-num]')].find((x) => x.getClientRects().length); if (e) e.scrollIntoView({ block: 'center' }); }, sel); await pg.waitForTimeout(700); cible = await pg.evaluate(chercher, [sel, chemin === 'recherche']); }
    if (!dit(!!cible, `U ${suf} : une rangée d'article est à l'écran`)) return;
    if (MUT === 'montee') await pg.evaluate(() => document.addEventListener('click', (e) => { if (e.target.closest('[data-fiche-ligne]')) { e.preventDefault(); e.stopImmediatePropagation(); } }, true));
    if (o.tel) await pg.touchscreen.tap(cible.x, cible.y); else await pg.mouse.click(cible.x, cible.y);
    await pg.waitForSelector('[data-fiche-paire]', { timeout: 6000 }).catch(() => {});
    await pg.waitForTimeout(900);
    const r = await pg.evaluate(() => { const f = document.querySelector('[data-fiche-paire]'); const vis = (e) => e && e.getClientRects().length;
      return { num: f ? f.getAttribute('data-fiche-paire') : null, faits: f ? f.querySelectorAll('[data-fd-fait]').length : 0, montee: [...document.querySelectorAll('[data-sb-avant="1"], [data-sb-avant-corps], [data-sr-fiche]')].filter(vis).length,
        autres: [...document.querySelectorAll('[role="dialog"]')].filter(vis).filter((d) => !d.closest('[data-fiche-paire]') && !d.hasAttribute('data-fiche-paire') && !/recherche|loupe/i.test(d.className + (d.getAttribute('aria-label') || ''))).map((d) => (d.getAttribute('aria-label') || d.className || '').slice(0, 40)) }; });
    await pg.screenshot({ path: path.join(SHOTS, `u-${suf}.png`) });
    dit(r.num === cible.num && r.faits >= 5 && r.montee === 0, `U ${suf} : UN toucher sur la rangée du N°${cible.num} ouvre SA fiche, ses faits visibles, sans étape intermédiaire`, r);
    if (o.erreurs.length) console.log(`   (erreurs de page : ${o.erreurs.slice(0, 2).join(' | ')})`);
  } catch (err) { dit(false, `U ${suf} : ouverture`, String(err.message || err).slice(0, 200)); }
  finally { if (o) await o.ctx.close().catch(() => {}); }
}

// S — LES VALEURS SE CHANGENT SUR PLACE.
async function surPlace(nav, sombre) {
  const suf = `sur-place-390-${sombre ? 'sombre' : 'clair'}`;
  let o;
  try {
    o = await ouvrir(nav, 390, sombre, '/?tab=journee');
    const pg = o.pg; await fermerToasts(pg);
    // « Achat — » d'une paire en vente sans prix d'achat : la base de volume en a (N°1205 n'a pas de prix d'achat).
    await ouvrirParNum(pg, '1205'); await fermerToasts(pg);
    const avant = await pg.evaluate(() => { const c = document.querySelector('[data-fiche-paire] [data-fd-fait="achat"]'); return c ? { su: c.getAttribute('data-fd-fait-su'), porte: c.getAttribute('data-fd-fait-porte'), r: c.getBoundingClientRect().top } : null; });
    dit(!!avant && avant.su === '0' && avant.porte === 'achat', `S1 ${suf} : « Achat — » est une porte (N°1205, sans prix d'achat)`, avant);
    await pg.locator('[data-fiche-paire] [data-fd-fait="achat"]').first().tap({ timeout: 4000 }).catch(() => {});
    await pg.waitForTimeout(400);
    const pendant = await pg.evaluate(() => { const f = document.querySelector('[data-fiche-paire]'); const c = f && f.querySelector('[data-fd-fait="achat"] [data-fd-fait-champ]'); const vis = (e) => e && e.getClientRects().length;
      return { champ: !!c, focus: !!c && document.activeElement === c, taille: c ? parseFloat(getComputedStyle(c).fontSize) : 0, haut: c ? c.getBoundingClientRect().top : null, fiche: f ? f.getAttribute('data-fiche-paire') : null,
        feuilles: [...document.querySelectorAll('[role="dialog"]')].filter(vis).filter((d) => d !== f && !(f && f.contains(d) && d.closest('[hidden]'))).filter((d) => vis(d)).length }; });
    dit(pendant.champ && pendant.focus && pendant.taille >= 16 && pendant.fiche === '1205' && pendant.feuilles === 0 && Math.abs(pendant.haut - avant.r) < 60, `S2 ${suf} : UN toucher ouvre le champ À SA PLACE (16 px au moins, la fiche reste, aucune feuille)`, pendant);
    await pg.keyboard.type('45'); await pg.keyboard.press('Enter');
    await pg.waitForFunction(() => { const c = document.querySelector('[data-fiche-paire] [data-fd-fait="achat"]'); return c && c.getAttribute('data-fiche-resume-achat') === '4500'; }, null, { timeout: 8000 }).catch(() => {});
    const apres = await pg.evaluate(() => { const f = document.querySelector('[data-fiche-paire]'); const c = f && f.querySelector('[data-fd-fait="achat"]'); const b = f && f.querySelector('[data-fd-fait="si-vendue"], [data-fd-fait="benefice"]');
      return { achat: c ? c.getAttribute('data-fiche-resume-achat') : null, txt: c ? c.innerText.replace(/\s+/g, ' ') : '', benef: b ? b.getAttribute('data-fd-fait-su') : null, fiche: f ? f.getAttribute('data-fiche-paire') : null }; });
    await pg.screenshot({ path: path.join(SHOTS, `s-${suf}.png`) });
    dit(apres.achat === '4500' && apres.fiche === '1205', `S3 ${suf} : « 45 » + Entrée ⇒ Achat 45 € écrit, la fiche toujours ouverte (2 gestes : toucher, taper)`, apres);
    dit(apres.benef === '1', `S3 ${suf} : le bénéfice prévu suit aussitôt (il n'est plus « — »)`, apres);
    // « Prix mini » de l'annonce en ligne (N°3102) : la même saisie sur place.
    await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(500);
    await ouvrirParNum(pg, '3102'); await fermerToasts(pg);
    await pg.locator('[data-fiche-paire="3102"] [data-fd-fait="mini"]').first().tap({ timeout: 4000 }).catch(() => {});
    await pg.waitForTimeout(300);
    await pg.keyboard.type('70'); await pg.keyboard.press('Enter');
    await pg.waitForFunction(() => { const c = document.querySelector('[data-fiche-paire="3102"] [data-fd-fait="mini"]'); return c && c.getAttribute('data-fd-fait-su') === '1'; }, null, { timeout: 8000 }).catch(() => {});
    const mini = await pg.evaluate(() => { const c = document.querySelector('[data-fiche-paire="3102"] [data-fd-fait="mini"]'); return c ? { su: c.getAttribute('data-fd-fait-su'), txt: c.innerText.replace(/\s+/g, ' ') } : null; });
    dit(!!mini && mini.su === '1' && /70\s?€/.test(mini.txt), `S4 ${suf} : « Prix mini » se tape sur place (70 €)`, mini);
    // Le prix : UN toucher sur la valeur ouvre « Prix partout », son champ prêt.
    await pg.locator('[data-fiche-paire="3102"] [data-fd-fait="prix"]').first().tap({ timeout: 4000 }).catch(() => {});
    await pg.waitForSelector('[data-prix-champ]', { timeout: 6000 }).catch(() => {});
    const px = await pg.evaluate(() => { const c = document.querySelector('[data-prix-champ]'); return { champ: !!c, focus: !!c && document.activeElement === c }; });
    dit(px.champ && px.focus, `S5 ${suf} : toucher la valeur du prix ouvre « Prix partout », le champ prêt à taper`, px);
    if (o.erreurs.length) console.log(`   (erreurs de page : ${o.erreurs.slice(0, 2).join(' | ')})`);
  } catch (err) { dit(false, `S ${suf} : ouverture`, String(err.message || err).slice(0, 200)); }
  finally { if (o) await o.ctx.close().catch(() => {}); }
}

module.exports = { baseDirecte, mesurerFiche, CAS };
if (require.main === module) (async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    if (!process.env.SANS_FICHES) for (const W of LARGEURS) for (const th of THEMES) {
      let o;
      try {
        o = await ouvrir(nav, W, th === 'sombre', '/?tab=journee');
        for (const n of VOULUS) {
          const suf = `N°${n} (${CAS[n] || '?'}) ${W} ${th}`;
          await fermerToasts(o.pg);
          await ouvrirParNum(o.pg, n); await fermerToasts(o.pg); await o.pg.waitForTimeout(300);
          await muter(o.pg);
          await o.pg.screenshot({ path: path.join(SHOTS, `fiche-${n}-${W}-${th}.png`) });
          const m = await o.pg.evaluate(mesurerFiche);
          jugerFiche(m, n, suf, W < 600);
          // Q5 — cibles et contrastes, par la mesure commune (design-passe) : la fiche seule.
          const q = await o.pg.evaluate(P.mesurer, { tactile: W < 600, sombre: th === 'sombre', racines: ['[data-fiche-paire]'] });
          dit(!q.cibles.length, `Q5 ${suf} : chaque cible fait ${W < 600 ? 44 : 36} px (${q.nCibles} mesurées)`, q.cibles.slice(0, 4));
          dit(!q.contraste.length, `Q6 ${suf} : contrastes ≥ 4,5:1 sur le fond rendu (${q.nTextes} textes)`, q.contraste.slice(0, 4));
          dit(!q.coupes.length && !q.rognes.length, `Q7 ${suf} : aucun mot coupé, aucun chiffre rogné`, [...q.coupes, ...q.rognes].slice(0, 4));
          await o.pg.keyboard.press('Escape').catch(() => {}); await o.pg.waitForTimeout(500);
          await o.pg.evaluate(() => { const b = document.querySelector('[data-fiche-paire] [data-fiche-fermer], [data-fiche-paire] [data-fiche-retour]'); if (b) b.click(); }); await o.pg.waitForTimeout(400);
        }
        if (o.erreurs.length) console.log(`   (erreurs de page : ${o.erreurs.slice(0, 2).join(' | ')})`);
      } catch (err) { dit(false, `fiches ${W} ${th} : ouverture`, String(err.message || err).slice(0, 200)); }
      finally { if (o) await o.ctx.close().catch(() => {}); }
    }
    if (!process.env.SANS_TOUCHER) for (const ch of CHEMINS) { await unToucher(nav, ch, 390, false); if (ch === 'annonces' || ch === 'stock') await unToucher(nav, ch, 1512, false); }
    if (!process.env.SANS_SAISIE) for (const th of THEMES) await surPlace(nav, th === 'sombre');
  } finally { await nav.close(); P.srv.close(); }
  console.log(`\n${bilan.ok} ✅ · ${bilan.ko} ❌ (captures : ${SHOTS})`);
  process.exit(bilan.ko ? 1 : 0);
})();
