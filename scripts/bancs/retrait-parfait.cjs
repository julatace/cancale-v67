require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  « À RETIRER » PARFAIT — LE COMPTOIR, AVANT, APRÈS (24 nov. 2026, lot retrait-parfait)
//  Julien : « pour le retrait tu dois vraiment faire quelque chose de parfait ». Achats · À retirer RENDU sur une base INVENTÉE
//  aux FORMES RÉELLES mesurées (lecture seule, 24 nov.) : `email_track_{transporteur}_{n°}` avec `lieu` « NOM, n° RUE, CP VILLE »
//  (Mondial Relay, Chronopost), « Relais Vinted Go, <commerce>, <rue> » sans code postal (Vinted Go nommé), AUCUN lieu (18 lignes
//  Vinted Go réelles), `horaires` = [{ jours, plages: [{ de, a }] }] (Chronopost, Vinted Go), `limite` 'AAAA-MM-JJ', `qrB64` ou
//  `qrUrl` hébergé, `code2` (consigne). Relais Colis : aucune ligne réelle — la forme commune des e-mails, transporteur `relaiscolis`.
//  390 × 844 tactile et 1512 × 950, clair et sombre, l'heure FIXÉE (07:10 à Paris, puis 10:00). Mesures RENDUES (data-* et nombres) :
//    P1 un point = UNE carte (6 points, 7 colis) ; rien de caché (chaque code inventé est dans exactement une carte) ;
//    P2 trié par urgence (la date limite LUE la plus proche d'abord ; le « à vérifier » seul en dernier) ;
//    P3 la date limite est celle LUE : en tête du point, et par colis quand un point en a deux différentes ;
//    P4 ouvert / fermé calculé sur les horaires LUS pour l'heure donnée (07:10 ⇒ fermé, ouvre à 8 h ; 10:00 ⇒ ouvert, ferme à 12 h) ;
//    P5 « Itinéraire » (Plans / Google Maps) et « Montrer les codes » au pied de chaque point qui a un code ; aucun orange ;
//    P6 « à vérifier » : visible dans son point, la raison dite, UN geste (« Retiré ») ;
//  le COMPTOIR (src/natif/Guichet.jsx) :
//    G1 toucher un code ouvre la feuille du POINT sur CE colis ; tous les colis du point y sont (glisser / ‹ ›) ;
//    G2 le code ENTIER en très grand (≥ 44 px), chasse fixe, sur BLANC (même en sombre) ; le QR ≥ 260 px au téléphone, sur blanc ;
//    G3 l'écran reste allumé : Wake Lock DEMANDÉ (et relâché à la fermeture) ;
//    G4 « Retiré » sur son toucher : la rangée sort de la carte du point AUSSITÔT, la feuille dit « Retiré ✓ » ; « Annuler » la remet ;
//    G5 le geste RETOUR ferme la feuille (l'écran Achats reste) ; aucun orange dans la feuille ; rien ne déborde ;
//    H1 HORS LIGNE (réseau coupé après le premier chargement) : la feuille montre les codes, le dit, le QR lu (data:) reste.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || process.env.BANC_SHOTS || path.join(os.tmpdir(), 'banc-retrait-parfait');
fs.mkdirSync(SHOTS, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARG = liste('VUES', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 700) : '')); } return c; };
const attendre = async (pg, f, ms = 40000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(f, arg).catch(() => false)) return true; await pg.waitForTimeout(300); } return false; };
const J = 86400000;
const jourParis = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
// L'heure FIXÉE : aujourd'hui (Paris) à 07:10 puis 10:00 — novembre, Paris = UTC+1.
const AUJ = jourParis(Date.now());
const T0710 = Date.parse(AUJ + 'T06:10:00Z'), T1000 = Date.parse(AUJ + 'T09:00:00Z');
const iso = (ms) => new Date(T0710 + ms).toISOString();
const qrcode = require(path.join(__dirname, '..', '..', 'node_modules', 'qrcode-generator'));
const QRde = (texte) => { const q = qrcode(0, 'M'); q.addData(texte); q.make(); return Buffer.from(q.createSvgTag({ cellSize: 4, margin: 2, scalable: true })).toString('base64'); };
// Les horaires de la forme réelle : tous les jours 8–12 / 14–19 (l'heure fixée décide, quel que soit le jour du banc).
const HOR = [{ jours: [1, 2, 3, 4, 5, 6, 7], plages: [{ de: '08:00', a: '12:00' }, { de: '14:00', a: '19:00' }] }];
// Les colis : [suivi, transporteur, code, lieu, jours avant la limite LUE, extra]
const COLIS = [
  ['1794500000000101', 'vinted', '551234', 'Relais Vinted Go, Épicerie Banc, 4 Rue des Essais', 2, { tx: 99200001, titre: 'Nike Air Max 90 banc taille 42', horaires: HOR, qr: true }],
  ['1794500000000102', 'vinted', '552345', 'Relais Vinted Go, Épicerie Banc, 4 Rue des Essais', 4, { tx: 99200002, titre: 'Adidas Samba banc taille 41', horaires: HOR }],
  ['1794500000000103', 'vinted', '663456', null, 3, { tx: 99200003, titre: 'Asics Gel-Kayano 14 banc taille 43', horaires: HOR }],
  ['87200001', 'mondialrelay', '4521', 'LE TABAC BANC, 3 RUE EXEMPLE, 22100 DINAN', 1, { tx: 99200004, titre: 'Salomon XT-6 banc taille 44' }],
  ['RC200000001', 'relaiscolis', '778899', 'PRESSING BANC, 8 AVENUE DES TESTS, 35400 SAINT-MALO', 5, {}],
  ['XW720000001TS', 'chronopost', '345678', 'RELAIS BANC, 12 RUE DES LILAS, 35000 RENNES', 6, { horaires: HOR, qrUrl: 'https://p.vintedgo.com/qr/banc-chronopost.png', code2: '9876' }],
  ['87200002', 'mondialrelay', '7788', 'LIBRAIRIE BANC, 5 RUE DU QUAI, 29200 BREST', -2, { tx: 99200006, titre: 'New Balance 2002R banc taille 42' }],
];
function baseRetrait() {
  const b = base();
  const uid = b.accounts[0].vinted_user_id;
  const achats = (b.rows.find((r) => r.id === `harvest_${uid}_orders_purchased`) || {}).data.payload.my_orders;
  for (const [suivi, carrier, code, lieu, jours, x] of COLIS) {
    b.rows.push({ id: `email_track_${carrier}_${suivi}`, data: { type: 'suivi', carrier, suivi, status: 'available', statusLabel: 'Arrivé au point de retrait',
      subject: `Votre colis ${suivi} est disponible`, receivedAt: iso(-5 * 3600000), emailAt: iso(-5 * 3600000), arriveLe: iso(-5 * 3600000), code, code2: x.code2 || null, artTitle: x.titre || null, lieu,
      limite: jourParis(T0710 + jours * J), consigne: false, account: '', ...(x.horaires ? { horaires: x.horaires } : {}),
      ...(x.qr ? { qrB64: QRde(code), qrType: 'image/svg+xml' } : {}), ...(x.qrUrl ? { qrUrl: x.qrUrl } : {}) } });
    if (x.tx) {
      achats.unshift({ transaction_id: x.tx, conversation_id: x.tx, title: x.titre, price: { amount: '60.0', currency_code: 'EUR' }, status: "La livraison n'a pas encore eu lieu",
        date: iso(-3 * J), photo: { url: `https://images1.vinted.net/t/r${x.tx}/f800/p.jpeg` }, transaction_user_status: 'needs_action' });
      b.rows.push({ id: `harvest_${uid}_suivi_${x.tx}`, data: { n: 1, v: 1, tx: String(x.tx), suivi, source: 'journey', capturedAt: iso(-60000), transporteur: carrier,
        etapes: [{ t: 'Disponible pour retrait', at: iso(-5 * 3600000), code: 'available_for_pickup' }], dernier: { t: 'Disponible pour retrait', at: iso(-5 * 3600000), code: 'available_for_pickup' } } });
    }
  }
  return b;
}
const CODES = COLIS.map((c) => c[2]);
const ORANGE = `(${(() => {
  const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const rgba = (c) => { const v = (String(c).match(/[\d.]+/g) || []).map(Number); return v.length >= 3 ? [v[0], v[1], v[2], v[3] == null ? 1 : v[3]] : null; };
  const orange = (c) => { const v = rgba(c); if (!v || v[3] < 0.15) return false; const [r, g, b] = v.map((x) => x / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 0.12) return false;
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; const l = (mx + mn) / 2; const s = d / (1 - Math.abs(2 * l - 1)); return h >= 18 && h <= 52 && s >= 0.45; };
  return (sel) => { const r = document.querySelector(sel); if (!r) return ['absent']; return [r, ...r.querySelectorAll('*')].filter(vis).filter((e) => { const cs = getComputedStyle(e); return (orange(cs.color) && (e.innerText || '').trim()) || orange(cs.backgroundColor) || (parseFloat(cs.borderTopWidth) > 0 && orange(cs.borderTopColor)); }).map((e) => e.className || e.tagName).slice(0, 6); };
}).toString()})()`;
const releve = () => {
  const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  return [...document.querySelectorAll('[data-rp-point]')].filter(vis).map((c) => ({
    point: c.getAttribute('data-rp-point'), nom: ((c.querySelector('.n-rp-nom') || {}).textContent || '').trim(), nomDe: (c.querySelector('[data-rp-nom-de]') || { getAttribute: () => '' }).getAttribute('data-rp-nom-de'),
    codes: [...c.querySelectorAll('[data-rp-colis]')].filter(vis).map((li) => li.getAttribute('data-rp-code')),
    verif: [...c.querySelectorAll('[data-rp-verif-mention]')].filter(vis).map((v) => ({ m: v.getAttribute('data-rp-verif-mention'), geste: !!v.querySelector('[data-rp-verif-geste]'), txt: v.innerText.trim() })),
    echeance: (c.querySelector('[data-rp-rebours]') || { getAttribute: () => null, textContent: '' }),
    rebours: (c.querySelector('[data-rp-rebours]') || { getAttribute: () => null }).getAttribute('data-rp-rebours'),
    limites: [...c.querySelectorAll('[data-rp-limite-colis]')].filter(vis).map((x) => x.getAttribute('data-rp-limite-colis')),
    ouverture: (c.querySelector('[data-rp-ouverture]') || { getAttribute: () => null }).getAttribute('data-rp-ouverture'),
    horaires: ((c.querySelector('[data-rp-horaires]') || {}).textContent || '').trim(),
    itineraire: (c.querySelector('.n-rp-actions [data-rp-itineraire]') || { getAttribute: () => '' }).getAttribute('href'),
    montrer: (c.querySelector('[data-rp-montrer]') || { getAttribute: () => null }).getAttribute('data-rp-montrer'),
  })).map((p) => ({ ...p, echeance: undefined }));
};
const guichet = () => { const g = document.querySelector('[data-gc]'); if (!g) return null;
  const R = (e) => e.getBoundingClientRect();
  const diapos = [...g.querySelectorAll('[data-gc-diapo]')];
  const ici = diapos.find((d) => { const r = R(d); return Math.abs(r.left - R(g).left) < 4; }) || null;
  const code = ici && ici.querySelector('[data-gc-code-grand]'), blanc = ici && ici.querySelector('[data-gc-blanc]'), qr = ici && ici.querySelector('[data-gc-qr] img');
  return { n: g.getAttribute('data-gc-n'), position: g.getAttribute('data-gc-position'), veille: g.getAttribute('data-gc-veille'), horsLigne: g.getAttribute('data-gc-hors-ligne'),
    bandeHL: !!g.querySelector('[data-gc-bande-hors-ligne]'), nom: ((g.querySelector('[data-gc-nom]') || {}).textContent || '').trim(), codes: diapos.map((d) => d.getAttribute('data-gc-code')),
    ici: ici ? { cle: ici.getAttribute('data-gc-diapo'), code: ici.getAttribute('data-gc-code'), limite: ici.getAttribute('data-gc-limite'), etat: ici.getAttribute('data-gc-etat'), photo: (ici.querySelector('[data-gc-photo]') || { getAttribute: () => '' }).getAttribute('data-gc-photo'),
      texteCode: code ? code.textContent.replace(/\s+/g, '') : '', taille: code ? parseFloat(getComputedStyle(code).fontSize) : 0, police: code ? getComputedStyle(code).fontFamily : '', encre: code ? getComputedStyle(code).color : '',
      fond: blanc ? getComputedStyle(blanc).backgroundColor : '', qr: qr ? { w: Math.round(R(qr).width), charge: qr.complete && qr.naturalWidth > 0, etat: qr.parentElement.getAttribute('data-gc-qr') } : null,
      qrKo: !!ici.querySelector('[data-gc-qr-ko]'), retirer: !!ici.querySelector('[data-gc-retirer]'), annuler: !!ici.querySelector('[data-gc-annuler]'), fait: !!ici.querySelector('[data-gc-retire-fait]') } : null,
    deb: g.scrollWidth - g.clientWidth, debPage: document.documentElement.scrollWidth - innerWidth };
};
const PREP = () => {
  // Le Wake Lock compté (Chromium sans écran le refuserait) : demandé ⇒ +1, relâché ⇒ +1.
  try { Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async (t) => { window.__wl = (window.__wl || 0) + 1; window.__wlType = t; return { release: async () => { window.__wlRel = (window.__wlRel || 0) + 1; }, addEventListener() {} }; } } }); } catch (_) {}
  try { localStorage.setItem('vrm_design_v2', '1'); localStorage.removeItem('vrm_banc_dom_ancien'); localStorage.removeItem('vrm_banc_retrait_variante'); } catch (_) {}
};
async function monter(nav, W, th, b, quand) {
  const o = await ouvrir(nav, { W, sombre: th === 'sombre', b, url: '/?tab=achats', dsf: 2 });
  await o.pg.clock.setFixedTime(new Date(quand));
  await o.pg.addInitScript(PREP);
  await o.pg.reload({ waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
  const vu = await attendre(o.pg, (n) => document.querySelectorAll('[data-rp-point] [data-rp-colis]').length >= n, 45000, COLIS.length);
  await o.pg.waitForTimeout(1200);
  return { ...o, vu };
}
const toucher = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.scrollIntoView({ block: 'center' }); e.click(); return true; }, sel);

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  const b = baseRetrait();
  try {
    for (const W of LARG) for (const th of THEMES) {
      console.log(`\n── À retirer parfait · ${W} · ${th}`);
      const doigt = W < 600;
      const { ctx, pg, erreurs, vu } = await monter(nav, W, th, b, T0710);
      const pts = await pg.evaluate(releve);
      // P1
      const tous = pts.flatMap((p) => p.codes);
      dit(vu && pts.length === 6, `P1 un point = une carte (${pts.length} cartes : ${pts.map((p) => p.nom).join(' · ')})`, pts.map((p) => [p.nom, p.codes]));
      dit(CODES.every((c) => tous.filter((x) => x === c).length === 1) && tous.length === CODES.length, `P1 rien de caché : chaque code dans exactement une carte (${tous.join(',')})`, tous);
      // P2
      const ordre = pts.map((p) => p.codes[0]);
      dit(JSON.stringify(ordre) === JSON.stringify(['4521', '551234', '663456', '778899', '345678', '7788']), `P2 trié par urgence (${ordre.join(' › ')})`, ordre);
      // P3
      const vg = pts.find((p) => p.codes.includes('551234'));
      dit(!!vg && JSON.stringify(vg.limites) === JSON.stringify([jourParis(T0710 + 2 * J), jourParis(T0710 + 4 * J)]), `P3 deux colis, deux dates LUES, chacune sur sa rangée (${vg && vg.limites.join(', ')})`, vg && vg.limites);
      const tabac = pts.find((p) => p.codes.includes('4521'));
      dit(!!tabac && tabac.rebours === 'demain' && tabac.limites.length === 0, `P3 un colis : la date lue en tête seulement (« ${tabac && tabac.rebours} »)`, tabac);
      // P4
      dit(!!vg && vg.ouverture === 'ferme' && /ouvre à 8 h/.test(vg.horaires) && /8 h–12 h, 14 h–19 h/.test(vg.horaires), `P4 07:10 ⇒ fermé, ouvre à 8 h, plages du jour (« ${vg && vg.horaires} »)`, vg && vg.horaires);
      const sansHor = pts.find((p) => p.codes.includes('4521'));
      dit(!!sansHor && sansHor.ouverture == null, `P4 horaires pas lus ⇒ rien de calculé (${sansHor && sansHor.ouverture})`);
      const sansNom = pts.find((p) => p.codes.includes('663456'));
      dit(!!vg && /Épicerie Banc/.test(vg.nom) && !!sansNom && sansNom.nomDe === 'transporteur' && sansNom.nom === 'Vinted Go', `P1 Vinted Go nommé (« ${vg && vg.nom} ») et sans nom (« ${sansNom && sansNom.nom} »)`);
      // P5
      const avecCode = pts.filter((p) => p.montrer);
      dit(avecCode.length === 6 && pts.filter((p) => p.itineraire).every((p) => /maps\.apple\.com|google\.com\/maps/.test(p.itineraire)) && pts.filter((p) => p.itineraire).length >= 5, `P5 « Montrer » sur chaque point, « Itinéraire » (${pts.filter((p) => p.itineraire).length})`, pts.map((p) => [p.montrer, p.itineraire]));
      const or = await pg.evaluate((s) => (0, eval)(s)('.n-rp'), ORANGE);
      dit(or.length === 0, 'P5 aucun orange dans « À retirer »', or);
      // P6
      const brest = pts.find((p) => p.codes.includes('7788'));
      dit(!!brest && brest.verif.length === 1 && brest.verif[0].m === 'depasse' && brest.verif[0].geste, `P6 « à vérifier » visible, raison « ${brest && brest.verif[0] && brest.verif[0].txt} », un geste`, brest && brest.verif);
      // J — LES DÉFAUTS DES CAPTURES DE JULIEN (24 nov., production, iPhone) : jugés sur le rendu.
      const J = await pg.evaluate(() => {
        const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
        const R = (e) => e.getBoundingClientRect();
        const rp = document.querySelector('.n-rp');
        const cartes = [...document.querySelectorAll('[data-rp-point]')].filter(vis);
        const noms = cartes.map((c) => { const n = c.querySelector('.n-rp-nom'); const lh = parseFloat(getComputedStyle(n).lineHeight) || 20; return Math.round(R(n).height / lh); });
        const adresses = cartes.map((c) => c.querySelector('[data-rp-adresse]')).filter(Boolean).map((a) => { const t = a.querySelector('.n-rp-adresse-txt') || a; const cs = getComputedStyle(t);
          return { coupe: t.scrollWidth > t.clientWidth + 1 || (cs.textOverflow === 'ellipsis' && cs.overflow !== 'visible' && t.scrollWidth > t.clientWidth) || R(t).right > R(a.closest('[data-rp-point]')).right + 1, txt: t.textContent }; });
        const logos = cartes.map((c) => { const l = c.querySelector('.n-rp-logo'), t = c.querySelector('.n-rp-nom'); return l && t ? Math.round(Math.abs((R(l).top + R(l).height / 2) - (R(t).top + R(t).height / 2))) : 99; });
        const pastillesNouveau = [...document.querySelectorAll('.n-rp .n-rp-etiquette')].filter(vis).filter((e) => /nouveau/i.test(e.textContent)).length;
        const points = [...document.querySelectorAll('[data-rp-nouveau]')].filter(vis).map((e) => Math.round(R(e).width));
        const jargon = rp ? (rp.innerText.match(/pas dit|pas lue|limite pas|ouvre vinted\.fr/gi) || []) : ['absent'];
        const traits = [...document.querySelectorAll('.n-rp .n-rp-trajet')].filter(vis).length;
        const pasLu = [...document.querySelectorAll('[data-rp-pas-lu]')].filter(vis).map((e) => ({ n: e.textContent.trim().length, pourquoi: !!e.parentElement.querySelector('[data-rp-pas-lu-pourquoi] details') }));
        return { noms, adresses, logos, pastillesNouveau, points, jargon, traits, pasLu };
      });
      dit(J.noms.every((n) => n === 1), `J1 chaque nom de point sur UNE ligne (${J.noms.join(',')})`);
      dit(J.logos.every((d) => d <= 12), `J1 le logo aligné sur le nom (${J.logos.join(',')} px)`, J.logos);
      dit(J.adresses.length >= 5 && J.adresses.every((a) => !a.coupe), `J2 aucune adresse coupée (${J.adresses.length})`, J.adresses.filter((a) => a.coupe));
      dit(J.pastillesNouveau === 0 && J.points.every((w) => w <= 10), `J3 « Nouveau » : aucune pastille, un point discret (${J.points.join(',') || 'aucun'})`);
      dit(J.jargon.length === 0, `J4 aucun jargon (« pas dit », « pas lue », « ouvre vinted.fr ») à l'écran`, J.jargon);
      dit(J.traits === 0, `J5 plus de traits inégaux : la frise se dit (« Au point · 24 nov. »)`, J.traits);
      dit(J.pasLu.every((x) => x.n <= 25 && x.pourquoi), `J6 contenu pas lu : une ligne courte, le geste sous « Pourquoi ? » (${J.pasLu.map((x) => x.n).join(',') || 'aucun'})`, J.pasLu);
      // J7 — un message (« Nouveau code de retrait · … ») ne recouvre aucun contenu.
      await pg.evaluate(() => { const e = document.querySelector('[data-rp-point]:nth-of-type(2)') || document.querySelector('[data-rp-point]'); if (e) e.scrollIntoView({ block: 'end' }); window.dispatchEvent(new CustomEvent('vrm:toast', { detail: { texte: 'Nouveau code de retrait · Mondial Relay Le Tabac Banc', ton: 'info' } })); });
      await pg.waitForTimeout(700);
      const tst = await pg.evaluate(() => {
        const t = document.querySelector('.vrm-toast'); if (!t) return { absent: true };
        const r = t.getBoundingClientRect();
        const sous = [...document.querySelectorAll('[data-rp-colis], [data-rp-point] .n-rp-tete, .n-rp-actions .n-bouton')].filter((e) => { const q = e.getBoundingClientRect(); return q.width && q.bottom > r.top + 1 && q.top < r.bottom - 1 && q.right > r.left && q.left < r.right; }).length;
        return { place: (t.closest('.vrm-toasts') || { getAttribute: () => '' }).getAttribute('data-toasts-place'), sous };
      });
      dit(!tst.absent && tst.sous === 0, `J7 le message ne recouvre aucun contenu (place « ${tst.place} », ${tst.sous} recouvert)`, tst);
      await pg.screenshot({ path: path.join(SHOTS, `message-${W}-${th}.png`) });
      await pg.evaluate(() => { document.querySelectorAll('.vrm-toast').forEach((b) => b.click()); });
      // J8 — le HAUT d'Achats : rien n'est coupé au bord, aucun onglet tronqué (« Annu… »), « N en route ».
      await pg.evaluate(() => { let e = document.querySelector('.n-rp'); while (e && e !== document.documentElement) { if (/(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 2) { e.scrollTop = 0; break; } e = e.parentElement; } window.scrollTo(0, 0); });
      await pg.waitForTimeout(500);
      const haut = await pg.evaluate(() => {
        const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && parseFloat(getComputedStyle(e).opacity) > 0.05;
        const main = document.querySelector('.vrm-main') || document.body;
        const coupes = [...main.querySelectorAll('button, a, [role="tab"], h1, h2, h3, [data-achats-hero] *')].filter(vis).filter((e) => { const r = e.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return false;
          if (e.closest('[data-rp-point], .n-gc, .vrm-toasts, [data-defile-x], .n-rangee-defile')) return false;
          const cs = getComputedStyle(e); const deborde = r.right > innerWidth + 1 || r.left < -1; const tronque = (cs.textOverflow === 'ellipsis' || cs.overflow === 'hidden') && e.scrollWidth > e.clientWidth + 2 && (e.innerText || '').trim().length > 2;
          return deborde || tronque; }).map((e) => (e.innerText || e.getAttribute('aria-label') || e.className || '').toString().trim().slice(0, 40));
        const sp = document.querySelector('[data-rp-sans-point] > summary');
        return { coupes: [...new Set(coupes)].slice(0, 10), sansPoint: sp ? sp.innerText.replace(/\s+/g, ' ').trim() : null };
      });
      dit(haut.coupes.length === 0, `J8 le haut d'Achats : rien de coupé au bord ni tronqué`, haut.coupes);
      dit(haut.sansPoint == null || /^\d+ en route$/.test(haut.sansPoint), `J8 « N en route » (« ${haut.sansPoint} »)`);
      await pg.screenshot({ path: path.join(SHOTS, `haut-${W}-${th}.png`) });
      await pg.evaluate(() => { const e = document.querySelector('.n-rp'); if (e) e.scrollIntoView({ block: 'start' }); });
      await pg.waitForTimeout(400);
      await pg.screenshot({ path: path.join(SHOTS, `liste-${W}-${th}.png`) });
      // G1 — toucher le code du 2e colis Vinted Go
      await toucher(pg, '[data-rp-code="552345"] [data-v2-en-grand], [data-rp-code="552345"] [data-rp-billet]');
      await attendre(pg, () => !!document.querySelector('[data-gc]'), 5000);
      await pg.waitForTimeout(600);
      let g = await pg.evaluate(guichet);
      dit(!!g && g.n === '2' && g.position === '2/2' && g.ici && g.ici.code === '552345' && JSON.stringify(g.codes) === JSON.stringify(['551234', '552345']) && /Épicerie Banc/.test(g.nom),
        `G1 la feuille du point, sur CE colis (${g && g.position}, ${g && g.codes}, « ${g && g.nom} »)`, g);
      dit(!!g && g.ici && g.ici.limite === jourParis(T0710 + 4 * J), `G1 la date limite est celle LUE (${g && g.ici && g.ici.limite})`);
      // glisser / ‹ : vers le 1er colis (QR)
      if (doigt) await pg.evaluate(() => { const r = document.querySelector('[data-gc-rail]'); r.scrollLeft = 0; r.dispatchEvent(new Event('scroll')); });
      else await toucher(pg, '[data-gc-precedent]');
      await pg.waitForTimeout(900);
      g = await pg.evaluate(guichet);
      dit(!!g && g.position === '1/2' && g.ici && g.ici.code === '551234', `G1 ${doigt ? 'glisser' : '‹'} ⇒ le colis d'à côté (${g && g.position})`, g && g.ici);
      // G2
      dit(!!g && g.ici && g.ici.texteCode === '551234' && g.ici.taille >= 44 && /mono|menlo|consolas/i.test(g.ici.police) && /255, 255, 255/.test(g.ici.fond) && /^rgb\(0, 0, 0/.test(g.ici.encre),
        `G2 le code entier ${g && g.ici && g.ici.taille} px, chasse fixe, noir sur blanc`, g && g.ici);
      dit(!!g && g.ici && g.ici.qr && g.ici.qr.charge && g.ici.qr.w >= (doigt ? 260 : 300), `G2 le QR à ${g && g.ici && g.ici.qr && g.ici.qr.w} px, chargé`, g && g.ici && g.ici.qr);
      dit(!!g && g.ici && g.ici.photo === '1', 'G2 la photo de la paire (achat relié par identité)');
      // G3
      const wl = await pg.evaluate(() => ({ n: window.__wl || 0, t: window.__wlType }));
      dit(wl.n >= 1 && wl.t === 'screen' && g && g.veille === 'actif', `G3 l'écran reste allumé : Wake Lock demandé (${wl.n}, ${g && g.veille})`, wl);
      const orG = await pg.evaluate((s) => (0, eval)(s)('[data-gc]'), ORANGE);
      dit(orG.length === 0 && g.deb <= 1 && g.debPage <= 1, `G5 aucun orange, rien ne déborde (${g.deb}, ${g.debPage})`, orG);
      await pg.screenshot({ path: path.join(SHOTS, `comptoir-${W}-${th}.png`) });
      // G5 — le geste RETOUR (la même page : une marque posée avant doit survivre ; aucun rechargement)
      await pg.evaluate(() => { window.__marqueBanc = 1; });
      await pg.evaluate(() => history.back());
      const ferme = await attendre(pg, () => !document.querySelector('[data-gc]'), 4000);
      const reste = await pg.evaluate(() => !!document.querySelector('[data-rp]') && window.__marqueBanc === 1);
      const rel = await pg.evaluate(() => window.__wlRel || 0);
      dit(ferme && reste, `G5 le geste retour ferme la feuille, Achats reste, même page (${ferme}, ${reste})`);
      dit(rel >= 1, `G3 le Wake Lock est relâché à la fermeture (${rel})`);
      // G4 — rouvrir sur le 1er colis, « Retiré » : la rangée sort de la carte aussitôt
      await toucher(pg, '[data-rp-code="551234"] [data-v2-en-grand], [data-rp-code="551234"] [data-rp-billet]');
      await attendre(pg, () => !!document.querySelector('[data-gc]'), 5000);
      await pg.waitForTimeout(600);
      await toucher(pg, '[data-gc-diapo] [data-gc-retirer]');
      const sorti = await attendre(pg, () => !document.querySelector('[data-rp-colis][data-rp-code="551234"]'), 6000);
      g = await pg.evaluate(guichet);
      dit(sorti && g && g.ici && g.ici.fait && g.ici.annuler, `G4 « Retiré » : la rangée sort de la carte, la feuille dit « Retiré ✓ » (${sorti})`, g && g.ici);
      await toucher(pg, '[data-gc-diapo] [data-gc-annuler]');
      const revenu = await attendre(pg, () => !!document.querySelector('[data-rp-colis][data-rp-code="551234"]'), 6000);
      dit(revenu, '« Annuler » remet le colis dans sa carte');
      await toucher(pg, '[data-gc-fermer]');
      const ferme2 = await attendre(pg, () => !document.querySelector('[data-gc]'), 4000);
      dit(ferme2 && await pg.evaluate(() => window.__marqueBanc === 1), `G5 « Fermer » ferme la feuille, même page (${ferme2})`);
      // P4 bis : 10:00 ⇒ ouvert
      await pg.clock.setFixedTime(new Date(T1000));
      await pg.reload({ waitUntil: 'domcontentloaded' });
      await attendre(pg, (n) => document.querySelectorAll('[data-rp-point] [data-rp-colis]').length >= n, 45000, COLIS.length - 1);
      await pg.waitForTimeout(800);
      const pts2 = await pg.evaluate(releve);
      const vg2 = pts2.find((p) => p.codes.includes('551234') || p.codes.includes('552345'));
      dit(!!vg2 && vg2.ouverture === 'ouvert' && /ferme à 12 h/.test(vg2.horaires), `P4 10:00 ⇒ ouvert, ferme à 12 h (« ${vg2 && vg2.horaires} »)`, vg2 && vg2.horaires);
      // H1 — hors ligne
      await ctx.setOffline(true);
      await pg.waitForTimeout(400);
      await toucher(pg, '[data-rp-code="551234"] [data-v2-en-grand], [data-rp-code="551234"] [data-rp-billet]');
      await attendre(pg, () => !!document.querySelector('[data-gc]'), 5000);
      await pg.waitForTimeout(800);
      g = await pg.evaluate(guichet);
      dit(!!g && g.horsLigne === '1' && g.bandeHL && g.ici && g.ici.texteCode === '551234' && g.ici.qr && g.ici.qr.charge, `H1 hors ligne : la feuille le dit, le code et le QR lu sont là (${g && g.ici && g.ici.texteCode})`, g);
      await pg.screenshot({ path: path.join(SHOTS, `hors-ligne-${W}-${th}.png`) });
      await toucher(pg, '[data-gc-fermer]'); await pg.waitForTimeout(500);
      await toucher(pg, '[data-rp-code="345678"] [data-v2-en-grand], [data-rp-code="345678"] [data-rp-billet]');
      await attendre(pg, () => !!document.querySelector('[data-gc]'), 5000);
      await pg.waitForTimeout(1500);
      g = await pg.evaluate(guichet);
      dit(!!g && g.ici && g.ici.texteCode === '345678' && (g.ici.qrKo || (g.ici.qr && (g.ici.qr.etat === 'reserve' || g.ici.qr.charge))), `H1 hors ligne, QR hébergé : la réserve, sinon « donne le code » — jamais une image cassée (${g && g.ici && (g.ici.qrKo ? 'dit' : g.ici.qr && g.ici.qr.etat)})`, g && g.ici);
      await ctx.setOffline(false);
      dit(!erreurs.length, 'aucune erreur de page', erreurs.slice(0, 3));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a rencontré une erreur', String(e && e.stack || e)); }
  await nav.close(); srv.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
