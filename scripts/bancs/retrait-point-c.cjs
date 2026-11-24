require('./_porte-banc.cjs');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  « À RETIRER » — PROPOSITION C, regroupé par point relais (23 nov. 2026, lot retours-suivi) — Achats · À retirer RENDU,
//  la base INVENTÉE de retrait-billet.cjs (RELAIS DU MARCHE : « 978216 » avec QR + « AB12CD34EF » ; TABAC DE LA GARE : « 4521 »,
//  à retirer avant DEMAIN). Julien : « améliore le design des colis à retirer » ; « trop de texte, pas assez de beaux boutons » ;
//  « gris clair, AUCUN orange ». 390 × 844 tactile et 1512 × 950, clair et sombre. Mesures RENDUES :
//    K1 chaque colis est une RANGÉE compacte (≤ 120 px au téléphone) DANS la carte de son point, le code ENTIER à droite
//       (chasse fixe, ≥ 17 px), le QR en vignette (≥ 40 px, fond blanc) quand il existe ;
//    K2 au pied de chaque point, de VRAIS boutons dans la carte (≥ 44 px au doigt) : « Itinéraire » partout, « Code » seulement où
//       UN colis attend ; UN seul plein sur l'écran (le premier point) ;
//    K3 AUCUN orange ni ambre dans « À retirer » (l'échéance proche se dit à l'encre) ;
//    K4 toucher une rangée ouvre le guichet (plein écran : le geste d'avant) ; « Code » aussi ;
//    K5 rien ne déborde ; aucune erreur ;
//    K6 un e-mail Vinted Go « Relais Vinted Go, <commerce>, <rue> » (forme réelle mesurée, sans code postal) nomme SON point et son adresse.
//  (23 nov. au soir, capture iPhone de Julien : « le transporteur inconnu, le logo mal mis ça va pas et puis l'affichage est moche »)
//  La forme RÉELLE du colis de la capture (mesurée, lecture seule : `email_track_vinted_{n°}` → `lieu` « Relais Vinted Go, <commerce>,
//  <rue> » SANS code postal, `horaires` = [{jours:[1..4], plages:[{de,a},…]}, …, {jours:[7], plages:[]}]) ; et un colis Vinted Go
//  SANS lieu (18 lignes réelles n'en ont pas) mais avec ses horaires, pour la règle « jamais inconnu ET horaires connus » ; un colis
//  à date limite dépassée (« à vérifier », jamais caché). Mesures RENDUES (data-* et nombres, jamais un libellé seul) :
//    K7 le point de la forme réelle est NOMMÉ, ses horaires dits ; son titre sur UNE ligne ; le logo centré sur le titre (± 3 px) ;
//       tous les logos de transporteur de la même boîte ;
//    K8 aucun point ne se dit « pas encore connu » : sans lieu, le titre est le TRANSPORTEUR (« Vinted Go », `data-rp-nom-de`) ;
//    K9 l'échéance LUE est un texte calme dans la ligne du transporteur, pas une pastille (fond transparent, aucun contour) ;
//    K10 aucun orange ni ambre CALCULÉ sur tout l'écran Achats (y compris « Colis à vérifier ») ;
//    K11 le titre d'un colis tient sur 1–2 lignes ; « N en route » (sans « point pas encore dit » au titre) ;
//    K12 (téléphone) le dernier lien, « Tout le détail des retraits », défilé en bas, ENTIER au-dessus de la barre du bas.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || process.env.BANC_SHOTS || path.join(os.tmpdir(), 'banc-retrait-point-c');
fs.mkdirSync(SHOTS, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARG = liste('VUES', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 700) : '')); } return c; };
const attendre = async (pg, f, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(f).catch(() => false)) return true; await pg.waitForTimeout(300); } return false; };
const J = 86400000;
const iso = (ms) => new Date(Date.now() + ms).toISOString();
const jourParis = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
// Un VRAI QR du code (qrcode-generator, déjà dans node_modules), en SVG base64 : inventé pour le banc, scannable.
const qrcode = require(path.join(__dirname, '..', '..', 'node_modules', 'qrcode-generator'));
const QRde = (texte) => { const q = qrcode(0, 'M'); q.addData(texte); q.make(); return Buffer.from(q.createSvgTag({ cellSize: 4, margin: 2, scalable: true })).toString('base64'); };
function baseBillet() {
  const b = base();
  const colis = (suivi, carrier, code, lieu, extra = {}) => { b.rows.push({ id: `email_track_${carrier}_${suivi}`, data: { type: 'suivi', carrier, suivi, status: 'available', statusLabel: 'Arrivé au point de retrait',
    subject: `Votre colis ${suivi} est disponible`, receivedAt: iso(-5 * 3600000), emailAt: iso(-5 * 3600000), arriveLe: iso(-5 * 3600000), code, code2: null, artTitle: extra.titre || null, lieu,
    limite: jourParis(Date.now() + (extra.jours == null ? 4 : extra.jours) * J), consigne: false, account: '', ...(extra.horaires ? { horaires: extra.horaires } : {}), ...(extra.qr ? { qrB64: QRde(code), qrType: 'image/svg+xml' } : {}) } });
  // Chaque colis relié à SON achat par le n° de suivi (comme relais-prevision) : la vignette porte la photo de la paire.
  if (extra.tx) {
    const uid = b.accounts[0].vinted_user_id;
    const my = (b.rows.find((r) => r.id === `harvest_${uid}_orders_purchased`) || {}).data.payload.my_orders;
    my.unshift({ transaction_id: extra.tx, conversation_id: extra.tx, title: extra.titre, price: { amount: '64.0', currency_code: 'EUR' }, status: "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais",
      date: iso(-3 * J), photo: { url: `https://images1.vinted.net/t/r${extra.tx}/f800/p.jpeg` }, transaction_user_status: 'needs_action' });
    b.rows.push({ id: `harvest_${uid}_suivi_${extra.tx}`, data: { n: 1, v: 1, tx: String(extra.tx), suivi, source: 'journey', capturedAt: iso(-60000), transporteur: carrier,
      etapes: [{ t: 'Disponible pour retrait', at: iso(-5 * 3600000), code: 'available_for_pickup' }], dernier: { t: 'Disponible pour retrait', at: iso(-5 * 3600000), code: 'available_for_pickup' } } });
  } };
  colis('XW700000001TS', 'chronopost', '978216', 'RELAIS DU MARCHE, 12 RUE DES LILAS, 35000 RENNES', { qr: true, tx: 99100011, titre: 'Nike Air Zoom Alphafly NEXT% Eliud Kipchoge taille 42' });
  colis('XW700000002TS', 'chronopost', 'AB12CD34EF', 'RELAIS DU MARCHE, 12 RUE DES LILAS, 35000 RENNES', { tx: 99100012, titre: 'Adidas Handball Spezial bleu marine taille 40' });
  colis('87100011', 'mondialrelay', '4521', 'TABAC DE LA GARE, 3 RUE EXEMPLE, 22100 DINAN', { jours: 1, tx: 99100013, titre: 'Salomon XT-6 noir taille 43' });
  // (23 nov., Julien : « comment ça le point relais n'est pas reconnu ») La forme RÉELLE mesurée d'un e-mail Vinted Go (2 e-mails, 15 et
  // 22 nov.) : « Relais Vinted Go, <nom du commerce>, <n° et rue> » — sans code postal. Valeurs inventées, forme exacte.
  // (23 nov. au soir) Avec ses HORAIRES, à la forme réelle (lundi–jeudi 8–12 / 13 h 30–18, vendredi …, samedi matin, dimanche fermé).
  const HOR = [{ jours: [1, 2, 3, 4], plages: [{ de: '08:00', a: '12:00' }, { de: '13:30', a: '18:00' }] }, { jours: [5], plages: [{ de: '08:00', a: '12:00' }, { de: '13:30', a: '17:00' }] }, { jours: [6], plages: [{ de: '09:00', a: '13:00' }] }, { jours: [7], plages: [] }];
  colis('1794500000000001', 'vinted', '551234', 'Relais Vinted Go, Droguerie Banc, 7 Rue Des Essais', { jours: 3, tx: 99100014, titre: 'Nike Air Zoom Alphafly NEXT% Eliud Kipchoge (Kenya/White edition) banc taille 44', horaires: HOR });
  // Un colis Vinted Go SANS lieu lu (forme réelle de 18 lignes), mais des horaires : le point n'est pas nommé, il ne se dit jamais « inconnu ».
  colis('1794500000000002', 'vinted', '662345', null, { jours: 5, tx: 99100015, titre: 'Asics Gel-1130 banc taille 41', horaires: HOR });
  // Un colis dont la date limite LUE est passée : « à vérifier », montré dans son point, jamais caché.
  colis('87100022', 'mondialrelay', '7788', 'LIBRAIRIE DU PORT, 5 RUE DU QUAI, 29200 BREST', { jours: -2, tx: 99100016, titre: 'New Balance 2002R banc taille 42' });
  return b;
}
const releve = () => {
  const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const R = (e) => e.getBoundingClientRect();
  const rgba = (c) => { const v = (String(c).match(/[\d.]+/g) || []).map(Number); return v.length >= 3 ? [v[0], v[1], v[2], v[3] == null ? 1 : v[3]] : null; };
  const orange = (c) => { const v = rgba(c); if (!v || v[3] < 0.15) return false; const [r, g, b] = v.map((x) => x / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 0.12) return false;
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; const l = (mx + mn) / 2; const s = d / (1 - Math.abs(2 * l - 1)); return h >= 18 && h <= 52 && s >= 0.45; };
  const rp = document.querySelector('.n-rp');
  const oranges = rp ? [rp, ...rp.querySelectorAll('*')].filter(vis).filter((e) => { const cs = getComputedStyle(e); return (orange(cs.color) && (e.innerText || '').trim()) || orange(cs.backgroundColor) || (parseFloat(cs.borderTopWidth) > 0 && orange(cs.borderTopColor)) || /inset 0px 0px 0px/.test(cs.boxShadow) && orange((cs.boxShadow.match(/rgba?\([^)]+\)/) || [''])[0]); }).map((e) => String(e.className).slice(0, 40)) : null;
  const points = [...document.querySelectorAll('[data-rp-point]')].filter(vis).map((c) => {
    const rc = R(c);
    const rangs = [...c.querySelectorAll('[data-rp-colis]')].filter(vis).map((li) => {
      const code = li.querySelector('[data-rp-code-grand]'), qr = li.querySelector('[data-rp-qr]'), b = R(li);
      return { code: code ? code.textContent : '', taille: code ? parseFloat(getComputedStyle(code).fontSize) : 0, police: code ? getComputedStyle(code).fontFamily : '', droite: code ? Math.round(R(code).right - rc.left) : 0,
        qr: qr && vis(qr) ? { w: Math.round(R(qr).width), fond: getComputedStyle(qr).backgroundColor } : null, haut: Math.round(b.height), dans: b.left >= rc.left - 1 && b.right <= rc.right + 1 };
    });
    const btns = [...c.querySelectorAll('.n-rp-actions .n-bouton')].filter(vis).map((e) => { const b = R(e); return { cle: e.hasAttribute('data-rp-itineraire') ? 'itineraire' : e.hasAttribute('data-rp-code-plein') ? 'code' : '?', h: Math.round(b.height), plein: e.getAttribute('data-n-variante') === 'plein', dans: b.left >= rc.left - 1 && b.right <= rc.right + 1 && b.bottom <= rc.bottom + 1, txt: e.innerText.trim() }; });
    const nomEl = c.querySelector('.n-rp-nom'), txt = c.querySelector('.n-rp-tete-txt'), logo = c.querySelector('.n-rp-logo'), ech = c.querySelector('[data-rp-rebours]');
    const lh = nomEl ? parseFloat(getComputedStyle(nomEl).lineHeight) || 20 : 20;
    const titres = [...c.querySelectorAll('[data-rp-titre]')].filter(vis).map((t) => Math.round(R(t).height / (parseFloat(getComputedStyle(t).lineHeight) || 18)));
    const ce = ech ? getComputedStyle(ech) : null;
    return { nom: ((nomEl || {}).textContent || '').trim(), nomDe: nomEl ? nomEl.getAttribute('data-rp-nom-de') : null, point: c.getAttribute('data-rp-point'), largeur: Math.round(rc.width), rangs, btns,
      nomLignes: nomEl ? Math.round(R(nomEl).height / lh) : 0, logo: logo ? { w: Math.round(R(logo).width), h: Math.round(R(logo).height), ecart: txt ? Math.round(Math.abs((R(logo).top + R(logo).height / 2) - (R(txt).top + R(txt).height / 2))) : 99, tuile: (() => { const t = logo.querySelector('[data-transporteur-logo]'); return t ? Math.round(R(t).width) : 0; })() } : null,
      horaires: !!c.querySelector('[data-rp-horaires]'), texte: c.innerText,
      adrLignes: (() => { const a = c.querySelector('[data-rp-adresse]'); return a ? Math.round(R(a).height / (parseFloat(getComputedStyle(a).lineHeight) || 18)) : 0; })(),
      horairesEntiers: (() => { const h = c.querySelector('[data-rp-horaires]'); return !h || h.scrollWidth <= h.clientWidth + 1; })(),
      echeance: ech ? { cle: ech.getAttribute('data-rp-rebours'), dansLigne: !!ech.closest('.n-rp-transp, [data-rp-sous-titre]'), fond: rgba(ce.backgroundColor) ? rgba(ce.backgroundColor)[3] : 0, ombre: ce.boxShadow, bord: parseFloat(ce.borderTopWidth) || 0 } : null, titres };
  });
  const main = document.querySelector('.vrm-main') || document.body;
  const orangesEcran = [main, ...main.querySelectorAll('*')].filter(vis).filter((e) => { const cs = getComputedStyle(e); return (orange(cs.color) && (e.innerText || '').trim()) || orange(cs.backgroundColor) || (parseFloat(cs.borderTopWidth) > 0 && orange(cs.borderTopColor)); }).map((e) => String(e.className).slice(0, 40) + ':' + (e.innerText || '').trim().slice(0, 30));
  const sp = document.querySelector('[data-rp-sans-point] > summary');
  return { points, oranges, orangesEcran, sansPoint: sp ? sp.innerText.replace(/\s+/g, ' ').trim() : null, pleins: [...document.querySelectorAll('.n-rp [data-n-variante="plein"]')].filter(vis).length, deb: document.documentElement.scrollWidth - innerWidth };
};
// Le conteneur qui défile (la page de l'app ne défile pas la fenêtre) : le premier ancêtre de « À retirer » qui déborde.
const DEFILEUR = `(() => { let e = document.querySelector('.n-rp'); while (e && e !== document.documentElement) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2) return e; e = e.parentElement; } return document.scrollingElement; })()`;
const guichet = () => !!document.querySelector('.vrm-qr-view, [data-qr-view], [data-relais-plein], [role="dialog"]');

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  const b = baseBillet();
  try {
    for (const W of LARG) for (const th of THEMES) {
      console.log(`\n── À retirer · proposition C · ${W} · ${th}`);
      const doigt = W < 600;
      const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre: th === 'sombre', b, url: '/?tab=achats', dsf: 2 });
      await pg.addInitScript(() => { try { localStorage.setItem('vrm_design_v2', '1'); localStorage.removeItem('vrm_banc_dom_ancien'); localStorage.removeItem('vrm_banc_retrait_variante'); } catch (_) {} });
      await pg.reload({ waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
      const vu = await attendre(pg, () => document.querySelectorAll('[data-rp-point] [data-rp-colis]').length >= 6);
      await pg.waitForTimeout(1500);
      const r = await pg.evaluate(releve);
      const marche = r.points.find((p) => /MARCHE/i.test(p.nom)), tabac = r.points.find((p) => /TABAC/i.test(p.nom));
      dit(vu && !!marche && !!tabac, 'les deux points et leurs trois colis sont rendus', r.points.map((p) => [p.nom, p.rangs.length]));
      if (!marche || !tabac) { await ctx.close(); continue; }
      const tous = [...marche.rangs, ...tabac.rangs];
      const r6 = tous.find((x) => x.code === '978216');
      dit(tous.length === 3 && tous.every((x) => x.dans && x.code && x.taille >= 17 && /mono|menlo|consolas|courier/i.test(x.police) && x.droite >= 0.6 * marche.largeur) && (!doigt || tous.every((x) => x.haut <= 120)),
        `K1 trois RANGÉES compactes dans leur carte, le code entier à droite en chasse fixe (${tous.map((x) => x.code + ' ' + x.taille + 'px ' + x.haut + 'px').join(' · ')})`, tous);
      dit(!!r6 && !!r6.qr && r6.qr.w >= 40 && /255, 255, 255/.test(r6.qr.fond), `K1 le QR en vignette sur blanc (${r6 && r6.qr && r6.qr.w} px)`, r6 && r6.qr);
      const it = (p) => p.btns.filter((x) => x.cle === 'itineraire'), co = (p) => p.btns.filter((x) => x.cle === 'code');
      dit(it(marche).length === 1 && it(tabac).length === 1 && co(tabac).length === 1 && co(marche).length === 1 && [...marche.btns, ...tabac.btns].every((x) => x.dans && x.h >= (doigt ? 44 : 36) && x.txt.split(/\s+/).length <= 3),
        `K2 « Itinéraire » et « Montrer le(s) code(s) » sur chaque point (24 nov., retrait-parfait : le comptoir du point), vrais boutons dans la carte`, [marche.btns, tabac.btns]);
      dit(r.pleins === 1, `K2 un seul plein sur l’écran (${r.pleins})`);
      dit(r.oranges && r.oranges.length === 0, 'K3 aucun orange ni ambre dans « À retirer »', r.oranges);
      const vg = r.points.find((p) => /Droguerie Banc/i.test(p.nom));
      const inconnus = await pg.evaluate(() => [...document.querySelectorAll('[data-rp-point]')].filter((c) => c.getAttribute('data-rp-point') === 'inconnu').length);
      const adrVg = await pg.evaluate(() => { const c = [...document.querySelectorAll('[data-rp-point]')].find((x) => /Droguerie Banc/i.test(x.textContent)); return c ? ((c.querySelector('[data-rp-adresse]') || {}).textContent || '').trim() : null; });
      dit(!!vg && vg.point !== 'inconnu' && inconnus <= 1 && /^7 Rue des Essais/i.test(adrVg || ''), `K6 « Relais Vinted Go, Droguerie Banc, 7 Rue des Essais » ⇒ le point « ${vg && vg.nom} », adresse « ${adrVg} » (jamais « Point pas encore connu »)`, { pts: r.points.map((p) => p.nom), inconnus, adrVg });
      dit(r.deb <= 1, `K5 rien ne déborde (${r.deb})`);
      // K7–K12 (23 nov. au soir, capture de Julien)
      dit(!!vg && vg.horaires && vg.nomLignes === 1, `K7 le point réel (Vinted Go, sans code postal, horaires) est nommé « ${vg && vg.nom} », horaires dits, titre sur ${vg && vg.nomLignes} ligne`, vg && { horaires: vg.horaires, nomLignes: vg.nomLignes });
      dit(r.points.every((p) => p.nomLignes === 1 && p.adrLignes <= 2 && p.horairesEntiers), `K7 chaque point : nom sur une ligne, l’adresse ENTIÈRE (deux lignes au plus, 24 nov. : jamais coupée), horaires entiers (${r.points.map((p) => p.nomLignes + '/' + p.adrLignes).join(' ')})`, r.points.map((p) => [p.nom, p.nomLignes, p.adrLignes, p.horairesEntiers]));
      const logos = r.points.map((p) => p.logo).filter(Boolean);
      dit(logos.length === r.points.length && logos.every((l) => l.ecart <= 3) && new Set(logos.map((l) => l.w + 'x' + l.h)).size === 1 && logos.every((l) => l.tuile === l.w),
        `K7 chaque logo centré sur son titre (écarts ${logos.map((l) => l.ecart).join(',')} px), même boîte (${[...new Set(logos.map((l) => l.w + 'x' + l.h))].join(' / ')}), le logo ENTIER la remplit (${logos.map((l) => l.tuile).join(',')})`, logos);
      const sansLieu = r.points.find((p) => p.rangs.some((x) => x.code === '662345'));
      dit(!!sansLieu && sansLieu.nomDe === 'transporteur' && /^Vinted Go$/.test(sansLieu.nom) && r.points.every((p) => !/pas encore connu/i.test(p.texte)), `K8 sans lieu lu, le titre est le transporteur (« ${sansLieu && sansLieu.nom} », ${sansLieu && sansLieu.nomDe}) ; aucun « pas encore connu »`, sansLieu && { nom: sansLieu.nom, nomDe: sansLieu.nomDe, horaires: sansLieu.horaires });
      const echs = r.points.map((p) => p.echeance).filter(Boolean);
      dit(echs.length >= 3 && echs.every((e) => e.dansLigne && e.fond < 0.05 && (e.ombre === 'none' || !e.ombre) && e.bord === 0), `K9 l’échéance est un texte calme dans la ligne du transporteur (${echs.map((e) => e.cle).join(',')})`, echs);
      dit(r.orangesEcran.length === 0, 'K10 aucun orange ni ambre calculé sur l’écran Achats', r.orangesEcran.slice(0, 8));
      const lignesTitres = r.points.flatMap((p) => p.titres);
      dit(lignesTitres.length >= 6 && lignesTitres.every((n) => n >= 1 && n <= 2), `K11 chaque titre de colis sur 1–2 lignes (${lignesTitres.join(',')})`, lignesTitres);
      dit(r.sansPoint == null || /^\d+ en route$/.test(r.sansPoint), `K11 la rangée sans point dit « N en route » (« ${r.sansPoint} »)`);
      if (doigt) {
        const bas = await pg.evaluate(async (d) => {
          const sc = (0, eval)(d);
          const s = document.querySelector('[data-v2-detail-retraits] > summary, [data-v2-detail-retraits]');
          if (!s) return { absent: true };
          // Le geste du doigt qui amène le lien en bas de l'écran : « scrollIntoView » (bloc fin) respecte le scroll-padding du défileur.
          s.scrollIntoView({ block: 'end' }); await new Promise((r) => setTimeout(r, 500));
          // La barre du bas : sous le doigt au pied de l'écran, l'ancêtre le plus large qui reste une barre (< 220 px de haut).
          let haut = null; for (let q = document.elementFromPoint(innerWidth / 2, innerHeight - 20); q && q !== document.body; q = q.parentElement) { const r = q.getBoundingClientRect(); if (r.height < 220 && r.width > innerWidth * 0.6) haut = r.top; }
          const b = s.getBoundingClientRect();
          return { bas: Math.round(b.bottom), haut: haut == null ? null : Math.round(haut), defileur: String(sc.className || sc.tagName).slice(0, 40) };
        }, DEFILEUR);
        dit(!bas.absent && bas.haut != null && bas.bas <= bas.haut, `K12 « Tout le détail des retraits » amené en bas de l’écran, entier au-dessus de la barre du bas (${bas.bas} ≤ ${bas.haut})`, bas);
        await pg.screenshot({ path: path.join(SHOTS, `point-c-bas-${W}-${th}.png`), fullPage: false });
        await pg.evaluate((d) => { (0, eval)(d).scrollTop = 0; }, DEFILEUR);
      }
      // Les captures : le haut d'Achats (« Colis à vérifier »), puis « À retirer » défilé écran par écran.
      await pg.evaluate((d) => { (0, eval)(d).scrollTop = 0; }, DEFILEUR); await pg.waitForTimeout(300);
      await pg.screenshot({ path: path.join(SHOTS, `point-c-haut-${W}-${th}.png`), fullPage: false });
      await pg.evaluate((d) => { const sc = (0, eval)(d), e = document.querySelector('.n-rp'); if (e) sc.scrollTop += e.getBoundingClientRect().top - (innerWidth < 600 ? 110 : 80); }, DEFILEUR); await pg.waitForTimeout(400);
      await pg.screenshot({ path: path.join(SHOTS, `point-c-${W}-${th}.png`), fullPage: false });
      if (doigt) for (let k = 2; k <= 3; k++) { await pg.evaluate((d) => { (0, eval)(d).scrollTop += innerHeight - 200; }, DEFILEUR); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(SHOTS, `point-c-${W}-${th}-${k}.png`), fullPage: false }); }
      await pg.evaluate((d) => { (0, eval)(d).scrollTop = 0; }, DEFILEUR);
      // K4 : « Code » ouvre le guichet ; puis (page relue) toucher la rangée aussi.
      const toucher = (sel) => pg.evaluate(async ([sl, g]) => { const z = document.querySelector(sl); if (!z) return 'absent'; z.click(); await new Promise((r) => setTimeout(r, 800)); return (new Function('return (' + g + ')()'))() ? 'ouvert' : 'fermé'; }, [sel, guichet.toString()]);
      const ouvre2 = await toucher('[data-rp-code-plein]');
      dit(ouvre2 === 'ouvert', `K4 « Code » ouvre le guichet (${ouvre2})`);
      // Le guichet ouvert garde l'écran : un contexte NEUF (mêmes données, mêmes réglages) pour toucher la rangée.
      const o2 = await ouvrir(nav, { W, sombre: th === 'sombre', b, url: '/?tab=achats', dsf: 2 });
      const pg2 = o2.pg;
      await pg2.addInitScript(() => { try { localStorage.setItem('vrm_design_v2', '1'); localStorage.removeItem('vrm_banc_dom_ancien'); localStorage.removeItem('vrm_banc_retrait_variante'); } catch (_) {} });
      await pg2.reload({ waitUntil: 'domcontentloaded' });
      await attendre(pg2, () => document.querySelectorAll('[data-rp-point] [data-rp-colis]').length >= 4, 40000);
      await pg2.waitForTimeout(800);
      const ouvre1 = await pg2.evaluate(async ([sl, g]) => { const z = document.querySelector(sl); if (!z) return 'absent'; z.click(); await new Promise((r) => setTimeout(r, 800)); return (new Function('return (' + g + ')()'))() ? 'ouvert' : 'fermé'; }, ['[data-rp-colis] [data-rp-billet]', guichet.toString()]);
      dit(ouvre1 === 'ouvert', `K4 toucher la rangée ouvre le guichet (${ouvre1})`);
      await o2.ctx.close();
      dit(!erreurs.length, 'K5 aucune erreur de page', erreurs.slice(0, 3));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a rencontré une erreur', String(e && e.stack || e)); }
  await nav.close(); srv.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
