require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  COLIS À RETIRER, LA VUE (20 nov.) — l'app RENDUE. Julien : « Colis à retirer beaucoup plus visuel, c'est pas
//  exceptionnel, tu peux encore faire ». Récit : docs/passation/2026-11-20-retraits-visuel.md.
//  Base INVENTÉE (`design-passe.cjs`) + 15 colis à retirer dans 6 points : un comptoir et une consigne du MÊME
//  magasin, des QR (image PNG inventée), un colis sans photo, un « code pas lu », 6 reliés à un achat (photo, prix) ;
//  et une base VIDE. Téléphone 390 × 844 tactile (zone sûre), « Safari » 390 × 664, 1512 et 1280, clair et sombre.
//    R  la bande résumé (« 15 colis · 6 points · N à retirer avant demain ») = la somme des cartes ; le plan des points ;
//    C  une carte par point, triées par urgence (la limite lue la plus proche d'abord) ; chaque carte : nom, sorte,
//       transporteur, adresse + Itinéraire, compte à rebours ; le casier et le comptoir du même magasin : deux cartes ;
//    K  chaque code de la base est dans une carte (rien inventé, rien perdu) ; « Copier » ; QR en miniature là seulement
//       où il existe ; « code pas lu » dit ; photo et prix là où l'achat est relié ;
//    A  « Je suis au point » : plein écran, tous les codes de ce point en très grand, le QR sur blanc, « J'ai tout retiré »
//       puis « Annuler » (rien n'est retiré pendant 10 s) ;
//    L  à l'ordinateur (≥ 1024) deux colonnes de cartes ;
//    G  cibles ≥ 44, rien ne déborde, rien sous la barre d'onglets, aucun « Relier » ;
//    V  base vide : « Rien à retirer » et son illustration.
//  `SHOTS=dossier` garde les captures (regarde-les). Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-retraits-visuel');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : '')); } return c; };

// Un PNG noir et blanc inventé (un damier de 25 × 25, chaque case 4 px) : la forme d'une image de QR, aucun contenu.
function pngInvente(graine) {
  const N = 25, S = 4, W = N * S;
  const rows = [];
  for (let y = 0; y < W; y++) { const r = [0]; for (let x = 0; x < W; x++) { const a = Math.floor(x / S), b = Math.floor(y / S); const coin = (a < 7 && b < 7) || (a > 17 && b < 7) || (a < 7 && b > 17); const v = coin ? ((Math.max(Math.abs(a % 18 - 3), Math.abs(b % 18 - 3)) % 2) ? 0 : 255) : (((a * 7 + b * 13 + graine) % 5) < 2 ? 0 : 255); r.push(v); } rows.push(Buffer.from(r)); }
  const crc = (buf) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const o of buf) x = t[(x ^ o) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const bloc = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4); ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloc('IHDR', ihdr), bloc('IDAT', zlib.deflateSync(Buffer.concat(rows))), bloc('IEND', Buffer.alloc(0))]).toString('base64');
}

const J = 86400000;
const iso = (ms) => new Date(Date.now() + ms).toISOString();
const jour = (d) => iso(d * J).slice(0, 10);
// [suivi, transporteur, code (null = pas lu), lieu, limite (jours), consigne, qr, relié à un achat]
const POINTS = [
  ['87100001', 'mondialrelay', '111111', 'INTERMARCHE TEST, ZA DU TEST, 11111 VILLETEST', 1, false, false, true],
  ['87100002', 'mondialrelay', '222222', 'INTERMARCHE TEST, ZA DU TEST, 11111 VILLETEST', 3, false, false, true],
  ['87100003', 'mondialrelay', '333333', 'INTERMARCHE TEST, ZA DU TEST, 11111 VILLETEST', 3, false, false, false],
  ['87100004', 'mondialrelay', '444444', 'LOCKER 24/7 INTERMARCHE TEST, ZA DU TEST, 11111 VILLETEST', 2, true, false, true],
  ['87100005', 'mondialrelay', '555555', 'LOCKER 24/7 INTERMARCHE TEST, ZA DU TEST, 11111 VILLETEST', 4, true, false, false],
  ['XW700000001TS', 'chronopost', '601234', 'RELAIS DU MARCHE, 12 RUE DES LILAS, 35000 RENNES', 0, false, true, true],
  ['XW700000002TS', 'chronopost', '602345', 'RELAIS DU MARCHE, 12 RUE DES LILAS, 35000 RENNES', 5, false, true, false],
  ['XW700000003TS', 'chronopost', '603456', 'RELAIS DU MARCHE, 12 RUE DES LILAS, 35000 RENNES', 5, false, true, false],
  ['1790000000000101', 'vinted', 'B12345', 'Consigne Vinted Go, Kiosque Test, 24 Rue Exemple, 56000 Vannes', 6, true, true, true],
  ['1790000000000102', 'vinted', 'C67890', 'Consigne Vinted Go, Kiosque Test, 24 Rue Exemple, 56000 Vannes', 6, true, true, false],
  ['87100011', 'mondialrelay', '711111', 'TABAC DE LA GARE, 3 RUE EXEMPLE, 22100 DINAN', 4, false, false, false],
  ['87100012', 'mondialrelay', null, 'TABAC DE LA GARE, 3 RUE EXEMPLE, 22100 DINAN', 4, false, false, false],
  ['87100013', 'mondialrelay', '733333', 'TABAC DE LA GARE, 3 RUE EXEMPLE, 22100 DINAN', 4, false, false, true],
  ['87100021', 'chronopost', '801234', 'LA BOUTIQUE TEST, 1 PLACE DU TEST, 29000 QUIMPER', 9, false, false, false],
  ['87100022', 'chronopost', '802345', 'LA BOUTIQUE TEST, 1 PLACE DU TEST, 29000 QUIMPER', 9, false, false, false],
];
const CODES = POINTS.map((x) => x[2]).filter(Boolean);
function baseRV() {
  const b = base();
  const uid = b.accounts[0].vinted_user_id;
  const achats = (b.rows.find((r) => r.id === `harvest_${uid}_orders_purchased`) || {}).data;
  let tx = 99100001;
  for (const [suivi, carrier, code, lieu, jl, consigne, qr, relie] of POINTS) {
    b.rows.push({ id: `email_track_${carrier}_${suivi}`, data: { type: 'suivi', carrier, suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`,
      receivedAt: iso(-5 * 3600000), emailAt: iso(-5 * 3600000), arriveLe: iso(-5 * 3600000), code, code2: null, artTitle: relie ? null : `Paire ${suivi.slice(-3)}`, lieu, limite: jour(jl), consigne,
      ...(qr ? { qrB64: pngInvente(Number(suivi.slice(-2)) || 3), qrType: 'image/png' } : {}), account: '' } });
    if (relie && achats && achats.payload) {
      const t = tx++;
      achats.payload.my_orders.unshift({ transaction_id: t, conversation_id: 900000000 + t, title: `Nike Air Max relié ${suivi.slice(-3)}`, price: { amount: '64.0', currency_code: 'EUR' },
        status: "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais", date: iso(-3 * J), photo: { url: `https://images1.vinted.net/t/r${t}/f800/p.jpeg` }, transaction_user_status: 'needs_action' });
      b.rows.push({ id: `harvest_${uid}_suivi_${t}`, data: { n: 1, v: 1, tx: String(t), suivi, source: 'journey', capturedAt: iso(-60000), transporteur: carrier === 'vinted' ? 'vintedgo' : carrier,
        etapes: [{ t: 'Disponible pour retrait', at: iso(-5 * 3600000), code: 'available_for_pickup' }], dernier: { t: 'Disponible pour retrait', at: iso(-5 * 3600000), code: 'available_for_pickup' } } });
    }
  }
  return b;
}
function baseVide() {
  const b = base();
  b.rows = b.rows.filter((r) => !/^email_track_/.test(r.id));
  return b;
}

async function releve(pg) {
  return pg.evaluate(() => {
    const q = (s, r = document) => [...r.querySelectorAll(s)];
    const cartes = q('[data-rp-point]').map((c) => ({ nom: (c.querySelector('.n-rp-nom') || {}).textContent || '', n: Number(c.getAttribute('data-rp-n')), sorte: c.getAttribute('data-rp-sorte'),
      rebours: (c.querySelector('[data-rp-rebours]') || { getAttribute: () => '' }).getAttribute('data-rp-rebours'), codes: q('[data-rp-code-grand]', c).map((e) => e.textContent.trim()),
      qr: q('[data-rp-qr]', c).length, pasLu: q('[data-rp-sans-code]', c).length, photos: q('[data-rp-photo="1"]', c).length, prix: q('[data-rp-prix]', c).length,
      itin: !!c.querySelector('[data-rp-itineraire]'), transp: (c.querySelector('[data-rp-transp]') || { getAttribute: () => '' }).getAttribute('data-rp-transp'), copier: q('[data-rp-copier]', c).length,
      gauche: Math.round(c.getBoundingClientRect().left) }));
    const r = document.querySelector('[data-rp-resume]');
    const resume = r ? { colis: Number((r.querySelector('[data-rp-resume-colis]') || { getAttribute: () => -1 }).getAttribute('data-rp-resume-colis')), points: Number((r.querySelector('[data-rp-resume-points]') || { getAttribute: () => -1 }).getAttribute('data-rp-resume-points')),
      urgents: Number((r.querySelector('[data-rp-resume-urgents]') || { getAttribute: () => 0 }).getAttribute('data-rp-resume-urgents')), texte: r.querySelector('.n-rp-resume-ligne').textContent, plan: q('[data-rp-plan-point]', r).length } : null;
    // Cibles et débordements, dans la vue (rien sous la barre d'onglets : jugé sur ce qui est visible).
    const W = innerWidth;
    const petits = q('.n-rp button, .n-rp a').filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.height < 43.5 || b.width < 43.5); }).map((e) => e.textContent.trim().slice(0, 20) + ':' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
    const deborde = q('.n-rp *').filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > W + 1 || b.left < -1); }).map((e) => e.className).slice(0, 5);
    const relier = q('.n-rp button, .n-rp a').filter((e) => /relier/i.test(e.textContent)).length;
    return { cartes, resume, petits, deborde, relier, vide: !!document.querySelector('[data-rp-vide]') };
  });
}
// L'écran d'aujourd'hui (le garde-réseau des bancs pose sinon l'échafaudage du DOM d'avant, `vrm_banc_dom_ancien`).
async function allumer(pg) {
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_design_v2', '1'); localStorage.removeItem('vrm_banc_dom_ancien'); } catch (_) {} });
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
}
async function attendre(pg, f, ms = 30000) { const t0 = Date.now(); let r; while (Date.now() - t0 < ms) { r = await releve(pg); if (f(r)) return r; await pg.waitForTimeout(800); } return r; }

async function cas(nav, { W, H = null, sombre, nom }) {
  const b = baseRV();
  const { ctx, pg, erreurs, tel } = await ouvrir(nav, { W, sombre, b, url: '/?tab=achats' });
  if (H || W === 1280) await pg.setViewportSize({ width: W === 1512 || W === 1280 ? W : 390, height: H || 900 });
  await allumer(pg);
  const r = await attendre(pg, (x) => x.cartes.length >= 6 && x.cartes.reduce((t, c) => t + c.n, 0) >= 15);
  await pg.waitForTimeout(1500);
  const th = `${nom} ${sombre ? 'sombre' : 'clair'}`;
  const nC = r.cartes.reduce((t, c) => t + c.n, 0);
  dit(r.cartes.length === 6 && nC === 15, `C ${th} : 6 cartes, 15 colis`, r.cartes.map((c) => c.nom + ':' + c.n));
  dit(!!r.resume && r.resume.colis === 15 && r.resume.points === 6 && r.resume.plan === 6, `R ${th} : la bande dit 15 colis · 6 points, le plan nomme les 6`, r.resume);
  const urg = POINTS.filter((x) => x[4] <= 1).length;
  dit(!!r.resume && r.resume.urgents === urg, `R ${th} : « ${urg} à retirer avant demain » (limites lues ≤ demain)`, r.resume);
  const inter = r.cartes.filter((c) => /intermarche/i.test(c.nom));
  dit(inter.length === 2 && inter.some((c) => c.sorte === 'consigne' && c.n === 2) && inter.some((c) => c.sorte === 'comptoir' && c.n === 3), `C ${th} : casier et comptoir du même magasin = deux cartes (2 consigne, 3 comptoir)`, inter);
  const ordre = r.cartes.map((c) => c.rebours);
  dit(ordre[0] === 'aujourdhui' || ordre[0] === 'depasse', `C ${th} : la carte la plus urgente en tête (« aujourd'hui »)`, ordre);
  const tous = r.cartes.flatMap((c) => c.codes);
  dit(CODES.every((c) => tous.includes(c)) && tous.every((c) => CODES.includes(c)), `K ${th} : les 14 codes lus sont dans les cartes, aucun autre`, { manque: CODES.filter((c) => !tous.includes(c)), en_trop: tous.filter((c) => !CODES.includes(c)) });
  dit(r.cartes.reduce((t, c) => t + c.pasLu, 0) === 1, `K ${th} : le colis sans code dit « code pas encore lu »`);
  dit(r.cartes.reduce((t, c) => t + c.qr, 0) === POINTS.filter((x) => x[6]).length, `K ${th} : QR en miniature sur les 5 colis qui en ont un, nulle part ailleurs`, r.cartes.map((c) => c.qr));
  dit(r.cartes.reduce((t, c) => t + c.copier, 0) === 14, `K ${th} : « Copier » à côté de chacun des 14 codes`);
  dit(r.cartes.reduce((t, c) => t + c.photos, 0) >= 1 && r.cartes.reduce((t, c) => t + c.prix, 0) >= 1, `K ${th} : photo et prix payé sur les colis reliés à un achat`, r.cartes.map((c) => [c.photos, c.prix]));
  dit(r.cartes.every((c) => c.itin && c.transp), `C ${th} : chaque carte porte son transporteur et « Itinéraire »`);
  dit(!r.petits.length, `G ${th} : toutes les cibles ≥ 44`, r.petits);
  dit(!r.deborde.length, `G ${th} : rien ne déborde de l'écran`, r.deborde);
  dit(r.relier === 0, `G ${th} : aucun « Relier » (décision du 19 nov.)`);
  if (W >= 1024) { const g = new Set(r.cartes.map((c) => c.gauche)); dit(g.size === 2, `L ${th} : deux colonnes de cartes`, [...g]); }
  dit(!erreurs.length, `${th} : aucune erreur de page`, erreurs);
  await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click(); }).catch(() => {});
  const haut = pg.locator('[data-rp]').first();
  await haut.scrollIntoViewIfNeeded().catch(() => {});
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: path.join(SHOTS, `${nom}-${sombre ? 'sombre' : 'clair'}.png`) });
  const c1 = pg.locator('[data-rp-point]').first();
  await c1.screenshot({ path: path.join(SHOTS, `${nom}-${sombre ? 'sombre' : 'clair'}-carte1.png`) }).catch(() => {});
  const cv = pg.locator('[data-rp-point]', { has: pg.locator('[data-rp-qr]') }).first();
  if (await cv.count()) await cv.screenshot({ path: path.join(SHOTS, `${nom}-${sombre ? 'sombre' : 'clair'}-carte-qr.png`) }).catch(() => {});
  // « Je suis au point » : la carte Chronopost (3 codes, des QR).
  const btn = pg.locator('[data-rp-point]', { has: pg.locator('[data-rp-code="601234"]') }).locator('[data-rp-au-point]').first();
  if (await btn.count()) {
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    if (tel) await btn.tap().catch(() => {}); else await btn.click().catch(() => {});
    await pg.waitForTimeout(700);
    const ap = await pg.evaluate(() => { const d = document.querySelector('[data-rp-aupoint]'); if (!d) return null; const b = d.getBoundingClientRect();
      return { plein: b.width >= innerWidth - 1 && b.height >= innerHeight - 1, codes: [...d.querySelectorAll('[data-rp-ap-code-grand]')].map((e) => e.textContent.trim()), taille: Math.max(0, ...[...d.querySelectorAll('[data-rp-ap-code-grand]')].map((e) => parseFloat(getComputedStyle(e).fontSize))),
        qr: [...d.querySelectorAll('[data-rp-ap-qr]')].map((e) => getComputedStyle(e).backgroundColor), fond: getComputedStyle(d).backgroundColor }; });
    dit(!!ap && ap.plein && ap.codes.join(',') === '601234,602345,603456' && ap.taille >= 48, `A ${th} : « Je suis au point » plein écran, les 3 codes l'un sous l'autre, très grands`, ap);
    dit(!!ap && ap.qr.length === 3 && ap.qr.every((c) => /255, 255, 255/.test(c)), `A ${th} : les QR sur fond blanc`, ap && ap.qr);
    await pg.screenshot({ path: path.join(SHOTS, `${nom}-${sombre ? 'sombre' : 'clair'}-au-point.png`) });
    const tout = pg.locator('[data-rp-ap-tout]').first();
    if (await tout.count()) { if (tel) await tout.tap().catch(() => {}); else await tout.click().catch(() => {}); }
    await pg.waitForTimeout(500);
    const pend = await pg.evaluate(() => ({ annuler: !!document.querySelector('[data-rp-ap-tout-annuler]'), retires: document.querySelectorAll('.n-rp-ap-colis.is-retire').length }));
    dit(pend.annuler && pend.retires === 3, `A ${th} : « J'ai tout retiré » ⇒ « Annuler » pendant 10 s, les 3 colis grisés`, pend);
    await pg.screenshot({ path: path.join(SHOTS, `${nom}-${sombre ? 'sombre' : 'clair'}-au-point-annuler.png`) });
    const an = pg.locator('[data-rp-ap-tout-annuler]').first();
    if (await an.count()) { if (tel) await an.tap().catch(() => {}); else await an.click().catch(() => {}); }
    await pg.waitForTimeout(11000);
    const apres = await pg.evaluate(() => ({ retires: document.querySelectorAll('.n-rp-ap-colis.is-retire').length, codes: document.querySelectorAll('[data-rp-ap-code-grand]').length }));
    dit(apres.retires === 0 && apres.codes === 3, `A ${th} : annulé, rien n'est retiré (10 s après, les 3 codes sont là)`, apres);
    await pg.keyboard.press('Escape').catch(() => {});
  } else dit(false, `A ${th} : le bouton « Je suis au point » de la carte Chronopost`);
  await ctx.close();
}

async function vide(nav, { W, sombre }) {
  const b = baseVide();
  const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre, b, url: '/?tab=achats' });
  await allumer(pg);
  const r = await attendre(pg, (x) => x.vide, 30000);
  dit(r.vide && r.cartes.length === 0, `V ${W} ${sombre ? 'sombre' : 'clair'} : base vide ⇒ « Rien à retirer » et son illustration`, r);
  const v = pg.locator('[data-rp-vide]').first(); if (await v.count()) await v.screenshot({ path: path.join(SHOTS, `vide-${W}-${sombre ? 'sombre' : 'clair'}.png`) }).catch(() => {});
  dit(!erreurs.length, `V ${W} : aucune erreur de page`, erreurs);
  await ctx.close();
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const sombre of [false, true]) await cas(nav, { W: 390, sombre, nom: 'tel-390' });
    await cas(nav, { W: 390, H: 664, sombre: false, nom: 'safari-390x664' });
    for (const sombre of [false, true]) await cas(nav, { W: 1512, sombre, nom: 'ordi-1512' });
    await cas(nav, { W: 1280, sombre: false, nom: 'ordi-1280' });
    await vide(nav, { W: 390, sombre: false }); await vide(nav, { W: 1512, sombre: true });
  } catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1500)); }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} retraits-visuel : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
