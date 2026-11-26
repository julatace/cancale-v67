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
//    K  chaque code de la base est dans une carte (rien inventé, rien perdu) ; (21 nov.) plus de « Copier », le code s’ouvre en grand ; QR en miniature là seulement
//       où il existe ; « code pas lu » dit ; photo et prix là où l'achat est relié ;
//    A  (20 nov., Julien : « je ne veux plus de Je suis au point ») plus de mode « au point » : ni bouton, ni plein écran ;
//    G  cibles ≥ 44, rien ne déborde, rien sous la barre d'onglets, aucun « Relier » ;
//    V  base vide : « Rien à retirer » et son illustration.
//  (20 nov., suite — Julien) :
//    T  la BARRE DU TRAJET de chaque colis : Payé · Expédié · En transit · Au point · Retiré, une étape allumée
//       seulement par SA date lue (évènements Mondial Relay du n°, e-mail « en route », date de la commande reliée,
//       arrivée) ; la courante en accent ; une étape non lue est grise, sans date ;
//    D  RÉTENTION : un colis à la date limite DÉPASSÉE reste dans la carte de son point (« date limite dépassée · à
//       vérifier »), code et QR visibles, hors du compte ; un colis RETOURNÉ à l'expéditeur (e-mail « retour ») et un
//       achat ANNULÉ (commande reliée par son n°) en sortent — par preuve seulement ;
//    Q  le QR À DROITE du code, grande vignette nette sur fond blanc ; le toucher ouvre le QR en grand.
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
// (20 nov.) Les cas de rétention, à des points déjà là : [suivi, transporteur, code, lieu, limite (jours), qr, cas]
const RETENTION = [
  ['87100031', 'mondialrelay', '931931', 'TABAC DE LA GARE, 3 RUE EXEMPLE, 22100 DINAN', -2, true, 'depasse'],
  ['87100041', 'mondialrelay', '941941', 'INTERMARCHE TEST, ZA DU TEST, 11111 VILLETEST', 3, false, 'retourne'],
  ['87100051', 'mondialrelay', '951951', 'INTERMARCHE TEST, ZA DU TEST, 11111 VILLETEST', 3, false, 'annule'],
];
const CODES = POINTS.filter((x) => x[2]).map((x) => x[2]);
const RELIES = {};   // suivi → transaction de SON achat (pour juger la photo et le titre montrés)
const CODE_DEPASSE = '931931', CODES_FINIS = ['941941', '951951'];
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
      const t = tx++; RELIES[suivi] = t;
      achats.payload.my_orders.unshift({ transaction_id: t, conversation_id: 900000000 + t, title: `Nike Air Max relié ${suivi.slice(-3)}`, price: { amount: '64.0', currency_code: 'EUR' },
        status: "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais", date: iso(-3 * J), photo: { url: `https://images1.vinted.net/t/r${t}/f800/p.jpeg` }, transaction_user_status: 'needs_action' });
      b.rows.push({ id: `harvest_${uid}_suivi_${t}`, data: { n: 1, v: 1, tx: String(t), suivi, source: 'journey', capturedAt: iso(-60000), transporteur: carrier === 'vinted' ? 'vintedgo' : carrier,
        etapes: [{ t: 'Disponible pour retrait', at: iso(-5 * 3600000), code: 'available_for_pickup' }], dernier: { t: 'Disponible pour retrait', at: iso(-5 * 3600000), code: 'available_for_pickup' } } });
    }
  }
  // (20 nov., Julien : « on doit voir ce qu'il y a à l'intérieur ») 50 ACHATS IDENTIQUES : même titre que les achats reliés,
  // autre photo, finis — aucune ressemblance ne doit faire montrer leur photo dans une carte (§5 : par identité seulement).
  if (achats && achats.payload) for (let k = 0; k < 50; k++) { const t = 99200001 + k; const suf = String(POINTS.filter((x) => x[7])[k % 6][0]).slice(-3);
    achats.payload.my_orders.push({ transaction_id: t, conversation_id: 910000000 + k, title: `Nike Air Max relié ${suf}`, price: { amount: '64.0', currency_code: 'EUR' },
      status: 'Commande finalisée', date: iso(-20 * J), photo: { url: `https://images1.vinted.net/t/leurre${t}/f800/p.jpeg` }, transaction_user_status: 'completed' }); }
  // (20 nov.) LE TRAJET : le colis 87100001 (relié) a ses évènements Mondial Relay (remis, en route, disponible) ;
  // le 87100013 (relié) un e-mail « en route » seulement ; les autres n'ont que leur arrivée.
  b.rows.push({ id: 'transp_mondialrelay_87100001', data: { v: 1, suivi: '87100001', carrier: 'mondialrelay', etat: 'disponible', detail: null, etatAt: iso(-5 * 3600000), lu: iso(-60000), source: 'serveur', fini: false,
    libelle: 'Colis disponible au point de retrait', lieuNom: '', lieuRue: '', lieuCp: '', lieuVille: '', limite: null, limiteSure: false,
    evenements: [{ at: iso(-2.5 * J), code: '', libelle: 'Colis remis à Mondial Relay', lieu: '', cp: '' }, { at: iso(-1.5 * J), code: '', libelle: 'Colis en route vers le point de livraison', lieu: '', cp: '' },
      { at: iso(-5 * 3600000), code: '', libelle: 'Colis disponible au point de retrait', lieu: '', cp: '' }] } });
  b.rows.push({ id: 'email_track_vinted_87100013', data: { type: 'suivi', carrier: 'vinted', suivi: '87100013', status: 'transit', statusLabel: 'En route', subject: 'Ton colis 87100013 est en route', receivedAt: iso(-2 * J), emailAt: iso(-2 * J), code: null, lieu: null, account: '' } });
  // LA RÉTENTION : dépassé (reste, code + QR) · retourné (e-mail « retour » du même n°) · annulé (commande reliée par son n°).
  for (const [suivi, carrier, code, lieu, jl, qr, cas] of RETENTION) {
    b.rows.push({ id: `email_track_${carrier}_${suivi}`, data: { type: 'suivi', carrier, suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`,
      receivedAt: iso(-6 * J), emailAt: iso(-6 * J), arriveLe: iso(-6 * J), code, code2: null, artTitle: `Paire ${suivi.slice(-3)}`, lieu, limite: jour(jl), consigne: false,
      ...(qr ? { qrB64: pngInvente(Number(suivi.slice(-2)) || 7), qrType: 'image/png' } : {}), account: '' } });
    if (cas === 'retourne') b.rows.push({ id: `email_track_vinted_${suivi}`, data: { type: 'suivi', carrier: 'vinted', suivi, status: 'retour', statusLabel: 'Retourné à l’expéditeur', subject: `Ton colis ${suivi} retourne chez l’expéditeur`,
      receivedAt: iso(-3600000), emailAt: iso(-3600000), code: null, lieu: null, account: '' } });
    if (cas === 'annule' && achats && achats.payload) {
      const t = tx++;
      achats.payload.my_orders.unshift({ transaction_id: t, conversation_id: 900000000 + t, title: `Paire annulée ${suivi.slice(-3)}`, price: { amount: '50.0', currency_code: 'EUR' },
        status: 'Commande annulée', date: iso(-8 * J), photo: { url: `https://images1.vinted.net/t/r${t}/f800/p.jpeg` }, transaction_user_status: 'completed' });
      b.rows.push({ id: `harvest_${uid}_suivi_${t}`, data: { n: 1, v: 1, tx: String(t), suivi, source: 'journey', capturedAt: iso(-60000), transporteur: carrier,
        etapes: [{ t: 'Commande annulée', at: iso(-3600000), code: '' }], dernier: { t: 'Commande annulée', at: iso(-3600000), code: '' } } });
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
      gauche: Math.round(c.getBoundingClientRect().left), verifN: Number(c.getAttribute('data-rp-verif-n') || 0) }));
    // (20 nov.) Chaque colis : sa mention « à vérifier », son trajet, la place du QR par rapport au code, le code sur UNE ligne.
    const colis = q('li[data-rp-colis]').map((li) => {
      const code = li.querySelector('[data-rp-code-grand]'); const qrE = li.querySelector('[data-rp-qr]');
      const cb = code ? code.getBoundingClientRect() : null; const qb = qrE ? qrE.getBoundingClientRect() : null;
      const fs = code ? parseFloat(getComputedStyle(code).fontSize) : 0;
      const ct = li.querySelector('[data-rp-contenu]'); const ph = ct ? ct.querySelector('img') : null; const vg = ct ? ct.querySelector('.n-rp-vignette') : null;
      return { contenu: ct ? { etat: ct.getAttribute('data-rp-contenu'), tx: ct.getAttribute('data-rp-contenu-tx') || '', titre: ((ct.querySelector('[data-rp-titre]') || {}).textContent || '').trim(),
          photo: ph ? ph.getAttribute('src') || '' : '', photoSrc: (vg && vg.getAttribute('data-rp-photo-src')) || '', pasLu: ((ct.querySelector('[data-rp-pas-lu]') || {}).textContent || '').trim(), vignette: Math.round((ct.querySelector('.n-rp-vignette') || { getBoundingClientRect: () => ({ width: 0 }) }).getBoundingClientRect().width),
          avantCode: (() => { const c2 = li.querySelector('[data-rp-code-grand], [data-rp-sans-code]'); return !c2 || !!(ct.compareDocumentPosition(c2) & Node.DOCUMENT_POSITION_FOLLOWING); })() } : null,
        cle: li.getAttribute('data-rp-colis'), code: li.getAttribute('data-rp-code'), enGrand: !!li.querySelector('[data-v2-en-grand]'), verif: li.getAttribute('data-rp-verif') || '', mention: (li.querySelector('[data-rp-verif-mention]') || {}).textContent || '',
        trajet: q('[data-rp-etape]', li).map((e) => ({ cle: e.getAttribute('data-rp-etape'), lue: e.getAttribute('data-rp-etape-lue') === '1', courante: e.getAttribute('data-rp-etape-courante') === '1',
          date: (e.querySelector('.n-rp-etape-date') || {}).textContent || '', point: getComputedStyle(e.querySelector('.n-rp-etape-point')).backgroundColor })),
        unLigne: !cb || cb.height < fs * 1.6, deborde: !!code && code.scrollWidth > code.clientWidth + 1,
        qr: qb ? { w: Math.round(qb.width), h: Math.round(qb.height), gauche: Math.round(qb.left), codeDroite: cb ? Math.round(cb.right) : null, fond: getComputedStyle(qrE).backgroundColor,
          img: (() => { const im = qrE.querySelector('img'); return im ? Math.round(im.getBoundingClientRect().width) : 0; })() } : null };
    });
    const r = document.querySelector('[data-rp-resume]');
    const resume = r ? { colis: Number((r.querySelector('[data-rp-resume-colis]') || { getAttribute: () => -1 }).getAttribute('data-rp-resume-colis')), points: Number((r.querySelector('[data-rp-resume-points]') || { getAttribute: () => -1 }).getAttribute('data-rp-resume-points')),
      urgents: Number((r.querySelector('[data-rp-resume-urgents]') || { getAttribute: () => 0 }).getAttribute('data-rp-resume-urgents')), verif: Number((r.querySelector('[data-rp-resume-verif]') || { getAttribute: () => 0 }).getAttribute('data-rp-resume-verif')), texte: r.querySelector('.n-rp-resume-ligne').textContent, plan: q('[data-rp-plan-point]', r).length } : null;
    // Cibles et débordements, dans la vue (rien sous la barre d'onglets : jugé sur ce qui est visible).
    const W = innerWidth;
    const petits = q('.n-rp button, .n-rp a').filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.height < 43.5 || b.width < 43.5); }).map((e) => e.textContent.trim().slice(0, 20) + ':' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
    const deborde = q('.n-rp *').filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > W + 1 || b.left < -1); }).map((e) => e.className).slice(0, 5);
    const relier = q('.n-rp button, .n-rp a').filter((e) => /relier/i.test(e.textContent)).length;
    const det = document.querySelector('[data-v2-detail-retraits]');
    return { cartes, colis, resume, petits, deborde, relier, vide: !!document.querySelector('[data-rp-vide]'), detail87100012: !!det && det.innerHTML.includes('87100012') };
  });
}
// L'écran d'aujourd'hui (le garde-réseau des bancs pose sinon l'échafaudage du DOM d'avant, `vrm_banc_dom_ancien`).
async function allumer(pg) {
  // (23 nov., lot retours-suivi) le BILLET (QR ≥ 110 à droite, photo 48) est désormais la variante « b » ; le défaut C (rangées) est jugé par retrait-point-c.cjs.
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_design_v2', '1'); localStorage.removeItem('vrm_banc_dom_ancien'); localStorage.setItem('vrm_banc_retrait_variante', 'b'); } catch (_) {} });
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
}
async function attendre(pg, f, ms = 30000) { const t0 = Date.now(); let r; while (Date.now() - t0 < ms) { r = await releve(pg); if (f(r)) return r; await pg.waitForTimeout(800); } return r; }

async function cas(nav, { W, H = null, sombre, nom }) {
  const b = baseRV();
  const { ctx, pg, erreurs, tel } = await ouvrir(nav, { W, sombre, b, url: '/?tab=achats' });
  if (H || W === 1280) await pg.setViewportSize({ width: W === 1512 || W === 1280 ? W : 390, height: H || 900 });
  await allumer(pg);
  const r = await attendre(pg, (x) => x.cartes.length >= 6 && x.cartes.reduce((t, c) => t + c.n, 0) >= 14 && x.colis.some((c) => c.verif === 'depasse')
    && (x.colis.find((c) => String(c.cle || '').includes('87100001')) || { trajet: [] }).trajet.some((e) => e.cle === 'expedie' && e.lue));
  await pg.waitForTimeout(1500);
  // (20 nov., bugs-terrain) « Tout le détail des retraits » n'est rendu qu'ouvert : l'ouvrir avant de juger ce qu'il garde.
  await pg.evaluate(() => { const d = document.querySelector('[data-v2-detail-retraits]'); const s = d && (d.querySelector('summary') || d.querySelector('button')); if (d && !d.open && s) s.click(); });
  await pg.waitForTimeout(800);
  const r2 = await releve(pg); Object.assign(r, r2);
  const th = `${nom} ${sombre ? 'sombre' : 'clair'}`;
  const nC = r.cartes.reduce((t, c) => t + c.n, 0), nV = r.cartes.reduce((t, c) => t + c.verifN, 0);
  dit(r.cartes.length === 6 && nC === 14 && nV === 1, `C ${th} : 6 cartes, 14 colis comptés + 1 « à vérifier » gardé (la date dépassée, avec son code)`, r.cartes.map((c) => c.nom + ':' + c.n + '+' + c.verifN));
  // (21 nov., Julien : « simple, calme » — relais-prevision) La bande est UNE ligne : plus de plan des points ; le colis « à vérifier »
  // est dit dans SA carte (« hors du compte »), plus redit en tête.
  dit(!!r.resume && r.resume.colis === 14 && r.resume.points === 6 && r.resume.plan === 0, `R ${th} : la bande dit 14 colis · 6 points, en une ligne (plus de plan)`, r.resume);
  const urg = POINTS.filter((x) => x[2] && x[4] <= 1).length;
  dit(!!r.resume && r.resume.urgents === urg, `R ${th} : « ${urg} à retirer avant demain » (limites lues ≤ demain)`, r.resume);
  const inter = r.cartes.filter((c) => /intermarche/i.test(c.nom));
  dit(inter.length === 2 && inter.some((c) => c.sorte === 'consigne' && c.n === 2) && inter.some((c) => c.sorte === 'comptoir' && c.n === 3), `C ${th} : casier et comptoir du même magasin = deux cartes (2 consigne, 3 comptoir)`, inter);
  const ordre = r.cartes.map((c) => c.rebours);
  dit(ordre[0] === 'aujourdhui' || ordre[0] === 'depasse', `C ${th} : la carte la plus urgente en tête (« aujourd'hui »)`, ordre);
  const tous = r.cartes.flatMap((c) => c.codes);
  const attendus = [...CODES, CODE_DEPASSE];
  dit(attendus.every((c) => tous.includes(c)) && tous.every((c) => attendus.includes(c)), `K ${th} : les 14 codes lus + celui à la date dépassée sont dans les cartes, aucun autre`, { manque: attendus.filter((c) => !tous.includes(c)), en_trop: tous.filter((c) => !attendus.includes(c)) });
  // (14 nov., Julien : « je ne veux pas que tu affiches des colis sans code ») Le colis dont le code n'est pas lu n'a ni code
  // ni QR à garder : pas dans les cartes, mais jamais perdu — dans « Tout le détail des retraits », avec sa raison.
  dit(r.cartes.reduce((t, c) => t + c.pasLu, 0) === 0 && r.detail87100012, `K ${th} : le colis sans code n'est pas une carte, il reste dans « Tout le détail des retraits »`, { pasLu: r.cartes.map((c) => c.pasLu), detail: r.detail87100012 });
  const nQr = POINTS.filter((x) => x[6]).length + 1;
  dit(r.cartes.reduce((t, c) => t + c.qr, 0) === nQr, `K ${th} : un QR sur les ${nQr} colis qui en ont un (dont la date dépassée), nulle part ailleurs`, r.cartes.map((c) => c.qr));
  // (21 nov., relais-prevision) Plus de « Copier » : le code se lit en grand, le toucher l'ouvre en plein écran pour le guichet.
  // (21 nov., relier-code — Julien : « enlève Copier sur les retraits ») toujours aucun « Copier », billet compris.
  dit(r.cartes.reduce((t, c) => t + c.copier, 0) === 0 && r.colis.filter((c) => c.code).every((c) => c.enGrand), `K ${th} : plus de « Copier », chaque code s'ouvre en grand au toucher`, r.colis.map((c) => [c.code, c.enGrand]));
  dit(r.cartes.reduce((t, c) => t + c.photos, 0) >= 1 && r.cartes.reduce((t, c) => t + c.prix, 0) >= 1, `K ${th} : photo et prix payé sur les colis reliés à un achat`, r.cartes.map((c) => [c.photos, c.prix]));
  dit(r.cartes.every((c) => c.itin && c.transp), `C ${th} : chaque carte porte son transporteur et « Itinéraire »`);
  // D — rétention
  const dep = r.colis.find((c) => c.code === CODE_DEPASSE);
  dit(!!dep && dep.verif === 'depasse' && /date limite dépassée/i.test(dep.mention) && !!dep.qr, `D ${th} : date limite dépassée ⇒ le colis RESTE, « date limite dépassée · à vérifier », code ET QR visibles`, dep);
  dit(CODES_FINIS.every((c) => !r.colis.some((x) => x.code === c)), `D ${th} : retourné à l'expéditeur et achat annulé (preuves) ⇒ sortis des cartes`, r.colis.filter((x) => CODES_FINIS.includes(x.code)).map((x) => x.cle));
  // T — le trajet
  const traj = (suivi) => (r.colis.find((c) => String(c.cle || '').includes(suivi)) || {}).trajet || [];
  const lues = (t) => t.filter((e) => e.lue).map((e) => e.cle).join(',');
  const cour = (t) => (t.find((e) => e.courante) || {}).cle || '';
  const t1 = traj('87100001'), t13 = traj('87100013'), t3 = traj('87100003');
  dit(r.colis.every((c) => c.trajet.length === 5), `T ${th} : chaque colis porte sa barre de 5 étapes`, r.colis.filter((c) => c.trajet.length !== 5).map((c) => c.cle));
  dit(lues(t1) === 'paye,expedie,transit,point' && cour(t1) === 'point', `T ${th} : 87100001 (évènements Mondial Relay + achat relié) : Payé · Expédié · En transit · Au point, « Retiré » gris`, t1);
  dit(lues(t13) === 'paye,transit,point', `T ${th} : 87100013 (un e-mail « en route ») : « Expédié » reste GRIS (aucun évènement ne le date)`, t13);
  dit(lues(t3) === 'point' && cour(t3) === 'point', `T ${th} : 87100003 (ni achat ni évènement) : seul « Au point » est allumé`, t3);
  dit(r.colis.every((c) => c.trajet.every((e) => (e.lue ? e.date.trim().length > 0 : e.date.trim() === ''))), `T ${th} : une date sous chaque étape franchie, aucune sous une étape non lue`);
  const pc = t1.find((e) => e.courante), pl = t1.find((e) => e.lue && !e.courante), pg0 = t1.find((e) => !e.lue);
  dit(!!pc && !!pl && !!pg0 && pc.point !== pl.point && pc.point !== pg0.point, `T ${th} : la courante a sa couleur (accent), distincte d'une franchie et d'une grise`, { courante: pc && pc.point, franchie: pl && pl.point, grise: pg0 && pg0.point });
  // I — le contenu d'abord : chaque colis relié montre SA photo et SON titre (50 achats au même titre : le bon), en grand,
  // avant le code ; un colis pas relié dit « Contenu pas encore lu », jamais « Colis Mondial Relay » en titre.
  const relies = Object.entries(RELIES).map(([su, t]) => ({ su, t, c: (r.colis.find((x) => String(x.cle || '').includes(su)) || {}).contenu }));
  dit(relies.length === 6 && relies.every(({ su, t, c }) => c && c.etat === 'relie' && c.tx === String(t) && c.photo.includes(`r${t}/`) && c.titre.startsWith(`Nike Air Max relié ${su.slice(-3)}`)),
    `I ${th} : chaque colis relié montre SA photo et SON titre (50 achats au même titre à côté : aucun leurre)`, relies.map(({ su, t, c }) => [su, t, c && c.tx, c && c.photo.slice(-40), c && c.titre]));
  dit(r.colis.every((x) => !x.contenu || x.contenu.avantCode) && relies.every(({ c }) => c && c.vignette >= 48), `I ${th} : le contenu passe avant le code, la photo ≥ 48 px (le billet compact du 21 nov.)`, relies.map(({ c }) => c && c.vignette));
  const pasRelies = r.colis.filter((x) => x.contenu && x.contenu.etat === 'pas-lu');
  dit(pasRelies.length > 0 && pasRelies.every((x) => /contenu pas encore lu/i.test(x.contenu.pasLu) && !/^colis /i.test(x.contenu.titre) && !x.contenu.photo), `I ${th} : pas relié ⇒ vignette grise + « Contenu pas encore lu », jamais un titre générique`, pasRelies.map((x) => [x.contenu.titre, x.contenu.pasLu]));
  dit(r.colis.every((x) => !/leurre/.test((x.contenu && x.contenu.photo) || '')), `I ${th} : aucune photo d'un des 50 achats identiques`);
  // Q — le QR à droite du code
  const avecQr = r.colis.filter((c) => c.qr);
  const qrMin = W >= 1024 ? 150 : 110;
  dit(avecQr.length === nQr && avecQr.every((c) => c.qr.gauche >= c.qr.codeDroite && c.qr.w >= qrMin && c.qr.img >= qrMin - 24 && /255, 255, 255/.test(c.qr.fond)), `Q ${th} : chaque QR à DROITE de son code, ≥ ${qrMin} px, sur blanc`, avecQr.map((c) => c.qr));
  dit(r.colis.every((c) => c.unLigne && !c.deborde), `Q ${th} : chaque code tient sur UNE ligne, sans déborder`, r.colis.filter((c) => !c.unLigne || c.deborde).map((c) => c.code));
  dit(!r.petits.length, `G ${th} : toutes les cibles ≥ 44`, r.petits);
  dit(!r.deborde.length, `G ${th} : rien ne déborde de l'écran`, r.deborde);
  dit(r.relier === 0, `G ${th} : aucun « Relier » (décision du 19 nov.)`);
  dit(!erreurs.length, `${th} : aucune erreur de page`, erreurs);
  await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click(); }).catch(() => {});
  await evitementCache(pg, th);
  const haut = pg.locator('[data-rp]').first();
  await haut.scrollIntoViewIfNeeded().catch(() => {});
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: path.join(SHOTS, `${nom}-${sombre ? 'sombre' : 'clair'}.png`) });
  const c1 = pg.locator('[data-rp-point]').first();
  await capturerVu(pg, c1, path.join(SHOTS, `${nom}-${sombre ? 'sombre' : 'clair'}-carte1.png`));
  const cv = pg.locator('[data-rp-point]', { has: pg.locator('[data-rp-qr]') }).first();
  await capturerVu(pg, cv, path.join(SHOTS, `${nom}-${sombre ? 'sombre' : 'clair'}-carte-qr.png`));
  const cd = pg.locator('li[data-rp-colis][data-rp-code="931931"]').first();
  if (await cd.count()) { await cd.scrollIntoViewIfNeeded().catch(() => {}); await cd.screenshot({ path: path.join(SHOTS, `${nom}-${sombre ? 'sombre' : 'clair'}-depasse.png`) }).catch(() => {}); }
  const ct = pg.locator('[data-rp-point]', { has: pg.locator('[data-rp-code="111111"]') }).first();
  await evitementCache(pg, th + ' (avant la capture du trajet)'); await carteDecouverte(pg, th);
  await capturerVu(pg, ct, path.join(SHOTS, `${nom}-${sombre ? 'sombre' : 'clair'}-trajet.png`));
  // Q — toucher le QR ⇒ le QR en grand (l'écran « code et QR » d'avant, `openQrView`).
  const bq = pg.locator('[data-rp-colis="r:e:XW700000001TS"] [data-rp-qr], [data-rp-code="601234"] [data-rp-qr]').first();
  if (await bq.count()) {
    await bq.scrollIntoViewIfNeeded().catch(() => {});
    if (tel) await bq.tap().catch(() => {}); else await bq.click().catch(() => {});
    const vu = await pg.waitForSelector('[data-qr-plein]', { timeout: 5000 }).then(() => true).catch(() => false);
    const img = vu ? await pg.evaluate(() => (document.querySelector('[data-qr-plein]') || { getAttribute: () => '' }).getAttribute('data-qr-plein-img')) : '';
    dit(vu && img === '1', `Q ${th} : toucher le QR l'ouvre en grand (l'image lue)`, { vu, img });
    await pg.screenshot({ path: path.join(SHOTS, `${nom}-${sombre ? 'sombre' : 'clair'}-qr-grand.png`) });
    await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(400);
    if (await pg.locator('[data-qr-plein]').count()) await pg.evaluate(() => { const b = document.querySelector('[data-qr-plein] button[aria-label*="ermer"], [data-qr-plein] .vrm-eg-fermer'); if (b) b.click(); }).catch(() => {});
    await pg.waitForTimeout(400);
  } else dit(false, `Q ${th} : le QR du colis Chronopost 601234`);
  // (20 nov., Julien : « je ne veux plus de Je suis au point ») Le mode a disparu : aucun bouton, aucun plein écran.
  const ap = await pg.evaluate(() => ({ bouton: document.querySelectorAll('[data-rp-au-point]').length, plein: document.querySelectorAll('[data-rp-aupoint]').length, texte: /je suis au point/i.test((document.querySelector('[data-rp]') || {}).textContent || '') }));
  dit(!ap.bouton && !ap.plein && !ap.texte, `A ${th} : plus de « Je suis au point » (ni bouton, ni plein écran)`, ap);
  await ctx.close();
}

// (20 nov., Julien : « tu dois appliquer les mêmes dispositions sur toutes les plateformes ») UN ACHETEUR QUI N'A QUE
// LEBONCOIN (ou QUE VESTIAIRE) : aucun compte Vinted, aucun achat Vinted ; ses achats sur le site, chacun relié à SON
// colis par son n° de suivi (le lien Mondial Relay de Leboncoin, le n° de Vestiaire). La même carte : le contenu d'abord
// (photo + titre de l'achat du site), la barre du trajet, le code, le QR, la rétention (un colis à la date dépassée).
const SITE_SEUL = {
  leboncoin: [['87300001', 'mondialrelay', '730001', 'TABAC DU PORT, 1 QUAI TEST, 35400 SAINT-MALO', 2, true], ['87300002', 'mondialrelay', '730002', 'TABAC DU PORT, 1 QUAI TEST, 35400 SAINT-MALO', -1, false]],
  vestiaire: [['XW300000001TS', 'chronopost', '830001', 'RELAIS DE LA PLAGE, 5 RUE TEST, 35800 DINARD', 3, true], ['XW300000002TS', 'chronopost', '830002', 'RELAIS DE LA PLAGE, 5 RUE TEST, 35800 DINARD', -2, true]],
};
function baseSite(site) {
  const b = base();
  b.accounts = [];
  b.rows = b.rows.filter((r) => !/^(email_track_|harvest_|transp_)/.test(r.id));
  const m = b.main[0].data; m.vrm_plateformes_affichees = { sites: [site], at: '2026-11-01T10:00:00.000Z' };
  const lbc = {}, vc = {};
  SITE_SEUL[site].forEach(([suivi, carrier, code, lieu, jl, qr], k) => {
    b.rows.push({ id: `email_track_${carrier}_${suivi}`, data: { type: 'suivi', carrier, suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`,
      receivedAt: iso((jl < 0 ? -6 : -1) * J), emailAt: iso((jl < 0 ? -6 : -1) * J), arriveLe: iso((jl < 0 ? -6 : -1) * J), code, code2: null, lieu, limite: jour(jl), consigne: false,
      ...(qr ? { qrB64: pngInvente(k + 11), qrType: 'image/png' } : {}), account: '' } });
    const img = `https://img.leboncoin.fr/api/v1/lbcpb1/images/test/${suivi}.jpg`;
    if (site === 'leboncoin') lbc['L' + k] = { txId: 'L' + k, itemId: String(600 + k), isSeller: false, title: `Jordan 4 du bon coin ${k + 1}`, price: 9000, image: img, label: { trackingUrl: `https://www.mondialrelay.fr/suivi-de-colis/?exp=${suivi}&pays=FR` } };
    else vc['A' + k] = { nom: `Samba Vestiaire ${k + 1}`, etat: 'shipped', suivi, transporteur: 'Chronopost', photo: `https://images.vestiairecollective.com/test/${suivi}.jpg` };
  });
  if (site === 'leboncoin') b.rows.push({ id: 'lbc_ventes', data: { ventes: lbc } });
  else { b.rows.push({ id: 'vc_achats', data: { achats: vc } }); b.rows.push({ id: 'vc_ventes', data: { ventes: {} } }); b.rows.push({ id: 'vc_listings', data: { liens: {} } }); }
  return b;
}
async function siteSeul(nav, { site, W, sombre }) {
  const b = baseSite(site);
  const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre, b, url: '/?tab=achats' });
  await allumer(pg);
  const r = await attendre(pg, (x) => x.colis.length >= 2, 40000);
  await pg.waitForTimeout(1200);
  const th = `${site} seul ${W} ${sombre ? 'sombre' : 'clair'}`;
  if (process.env.SONDE) console.log(await pg.evaluate(() => [...document.querySelectorAll('li[data-rp-colis]')].map((li) => li.getAttribute('data-rp-colis') + ' ' + (li.querySelector('.n-rp-vignette') || {}).outerHTML).join('\n')));
  const L = SITE_SEUL[site];
  const nomAchat = (k) => site === 'leboncoin' ? `Jordan 4 du bon coin ${k + 1}` : `Samba Vestiaire ${k + 1}`;
  const par = L.map(([suivi, , code, , jl, qr], k) => ({ suivi, code, jl, qr, k, c: r.colis.find((x) => x.code === code) }));
  dit(par.every((p) => !!p.c), `S ${th} : la carte du point montre ses 2 colis, avec leur code`, r.colis.map((x) => x.code));
  dit(par.every((p) => p.c && p.c.contenu && p.c.contenu.etat === 'autre-site' && p.c.contenu.titre === nomAchat(p.k) && p.c.contenu.photoSrc.includes(p.suivi) && p.c.contenu.avantCode),
    `S ${th} : le contenu d'abord — la photo et le titre de SON achat ${site} (relié par son n° de suivi)`, par.map((p) => p.c && p.c.contenu));
  dit(par.every((p) => p.c && p.c.trajet.length === 5 && p.c.trajet.some((e) => e.cle === 'point' && e.lue) && !p.c.trajet.find((e) => e.cle === 'paye').lue), `S ${th} : la barre du trajet (Au point lu ; Payé gris : aucune date lue)`);
  dit(par.every((p) => !p.qr || (p.c && p.c.qr && p.c.qr.gauche >= p.c.qr.codeDroite)), `S ${th} : le QR à droite du code`);
  const dep = par.find((p) => p.jl < 0);
  dit(!!dep && dep.c && dep.c.verif === 'depasse', `S ${th} : date limite dépassée ⇒ gardé, « à vérifier », code visible`, dep && dep.c);
  dit(!erreurs.length, `S ${th} : aucune erreur de page`, erreurs);
  await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click(); }).catch(() => {});
  await evitementCache(pg, th); await carteDecouverte(pg, th);
  await capturerVu(pg, pg.locator('[data-rp-point]').first(), path.join(SHOTS, `${site}-seul-${W}-${sombre ? 'sombre' : 'clair'}.png`));
  await ctx.close();
}

// (20 nov., coordinateur) Le lien d'évitement « Aller au contenu » n'apparaît qu'au focus CLAVIER : sans lui, hors de l'écran.
// (20 nov., coordinateur) Une carte plus haute que l'écran, capturée par `locator.screenshot`, est photographiée dans
// une fenêtre AGRANDIE où les éléments fixes (lien d'évitement, barre du haut) se posent par-dessus : la capture
// montrait « Aller au contenu » et la bulle Messages sur la carte, ce que l'écran réel ne montre pas. On capture
// donc ce que voit l'utilisateur : la carte amenée sous la barre du haut, l'écran tel quel, découpé sur la carte.
async function capturerVu(pg, loc, fichier) {
  if (!(await loc.count())) return;
  const clip = await loc.evaluate((el) => {
    el.scrollIntoView({ block: 'start' });
    const haut = [...document.querySelectorAll('header, [data-n-barre-haut], .vrm-app-header')].reduce((m, h) => { const r = h.getBoundingClientRect(); const st = getComputedStyle(h).position; return (st === 'sticky' || st === 'fixed') && r.top <= 0 + 1 && r.bottom > 0 ? Math.max(m, r.bottom) : m; }, 0);
    window.scrollBy(0, -(haut + 8));
    const r = el.getBoundingClientRect();
    const y = Math.max(0, r.top - 4), b = Math.min(window.innerHeight, r.bottom + 4);
    return { x: Math.max(0, r.left - 4), y, width: Math.min(window.innerWidth, r.right + 4) - Math.max(0, r.left - 4), height: Math.max(1, b - y) };
  }).catch(() => null);
  await pg.waitForTimeout(250);
  if (clip) await pg.screenshot({ path: fichier, clip }).catch(() => {});
}
// (20 nov., coordinateur) La carte n'est recouverte par RIEN : l'étiquette « Comptoir / Consigne », le nom du point et
// son adresse, amenés au milieu de l'écran, sont bien ce qui est sous le doigt (pas la bulle Messages, pas l'avatar).
async function carteDecouverte(pg, th) {
  // `MUTATION=couvrir` : une bande fixe posée sur tout l'écran (comme une barre qui recouvre) ⇒ ce contrôle doit rougir.
  if (process.env.MUTATION === 'couvrir') await pg.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:2147483646'; document.body.appendChild(d); });
  const r = await pg.evaluate(async () => {
    const out = [];
    for (const sel of ['[data-rp-sorte-etiquette]', '.n-rp-nom', '[data-rp-adresse]']) {
      const el = document.querySelector('[data-rp-point] ' + sel); if (!el) { out.push({ sel, absent: true }); continue; }
      el.scrollIntoView({ block: 'center' }); await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
      const q = el.getBoundingClientRect(); const pts = [[q.left + 4, q.top + q.height / 2], [q.left + q.width / 2, q.top + q.height / 2], [q.right - 4, q.top + q.height / 2]];
      const dessus = pts.map(([x, y]) => document.elementFromPoint(x, y)).filter((h) => h && !el.contains(h) && !h.contains(el));
      out.push({ sel, dessus: dessus.map((h) => (h.tagName + '.' + String(h.className || '')).slice(0, 60)) });
    }
    return out;
  });
  dit(r.every((x) => !x.absent && !x.dessus.length), `C ${th} : la carte n'est recouverte par rien (sorte, nom, adresse sous le doigt)`, r);
}

async function evitementCache(pg, th) {
  const e = await pg.evaluate(() => { const a = document.querySelector('[data-aller-contenu]'); if (!a) return { absent: true };
    const r = a.getBoundingClientRect(); return { bas: Math.round(r.bottom), focus: document.activeElement === a, focusVisible: a.matches(':focus-visible'), tf: getComputedStyle(a).transform, actif: (document.activeElement && (document.activeElement.tagName + '.' + document.activeElement.className).slice(0, 80)) || '' }; });
  dit(e.absent || e.bas <= 0 || e.focusVisible, `A ${th} : « Aller au contenu » hors de l'écran tant qu'il n'a pas le focus clavier`, e);
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
    // `CAS=sites` : seulement les bases d'un seul site (Leboncoin, Vestiaire).
    if (process.env.CAS !== 'sites') {
    for (const sombre of [false, true]) await cas(nav, { W: 390, sombre, nom: 'tel-390' });
    await cas(nav, { W: 390, H: 664, sombre: false, nom: 'safari-390x664' });
    for (const sombre of [false, true]) await cas(nav, { W: 1512, sombre, nom: 'ordi-1512' });
    await cas(nav, { W: 1280, sombre: false, nom: 'ordi-1280' });
    await vide(nav, { W: 390, sombre: false }); await vide(nav, { W: 1512, sombre: true });
    }
    await siteSeul(nav, { site: 'leboncoin', W: 390, sombre: false }); await siteSeul(nav, { site: 'leboncoin', W: 1512, sombre: true });
    await siteSeul(nav, { site: 'vestiaire', W: 390, sombre: true }); await siteSeul(nav, { site: 'vestiaire', W: 1512, sombre: false });
  } catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1500)); }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} retraits-visuel : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
