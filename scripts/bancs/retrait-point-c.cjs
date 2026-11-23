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
    limite: jourParis(Date.now() + (extra.jours || 4) * J), consigne: false, account: '', ...(extra.qr ? { qrB64: QRde(code), qrType: 'image/svg+xml' } : {}) } });
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
  colis('1794500000000001', 'vinted', '551234', 'Relais Vinted Go, Droguerie Banc, 7 Rue Des Essais', { jours: 3, tx: 99100014, titre: 'Asics Gel-1130 banc taille 41' });
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
    return { nom: ((c.querySelector('.n-rp-nom') || {}).textContent || '').trim(), largeur: Math.round(rc.width), rangs, btns };
  });
  return { points, oranges, pleins: [...document.querySelectorAll('.n-rp [data-n-variante="plein"]')].filter(vis).length, deb: document.documentElement.scrollWidth - innerWidth };
};
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
      const vu = await attendre(pg, () => document.querySelectorAll('[data-rp-point] [data-rp-colis]').length >= 4);
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
      dit(it(marche).length === 1 && it(tabac).length === 1 && co(tabac).length === 1 && co(marche).length === 0 && [...marche.btns, ...tabac.btns].every((x) => x.dans && x.h >= (doigt ? 44 : 36) && x.txt.split(/\s+/).length <= 2),
        `K2 « Itinéraire » sur chaque point, « Code » seulement au tabac (un colis), vrais boutons dans la carte`, [marche.btns, tabac.btns]);
      dit(r.pleins === 1, `K2 un seul plein sur l’écran (${r.pleins})`);
      dit(r.oranges && r.oranges.length === 0, 'K3 aucun orange ni ambre dans « À retirer »', r.oranges);
      const vg = r.points.find((p) => /Droguerie Banc/i.test(p.nom));
      const inconnus = await pg.evaluate(() => [...document.querySelectorAll('[data-rp-point]')].filter((c) => c.getAttribute('data-rp-point') === 'inconnu').length);
      const adrVg = await pg.evaluate(() => { const c = [...document.querySelectorAll('[data-rp-point]')].find((x) => /Droguerie Banc/i.test(x.textContent)); return c ? ((c.querySelector('[data-rp-adresse]') || {}).textContent || '').trim() : null; });
      dit(!!vg && inconnus === 0 && /^7 Rue des Essais/i.test(adrVg || ''), `K6 « Relais Vinted Go, Droguerie Banc, 7 Rue des Essais » ⇒ le point « ${vg && vg.nom} », adresse « ${adrVg} » (jamais « Point pas encore connu »)`, { pts: r.points.map((p) => p.nom), inconnus, adrVg });
      dit(r.deb <= 1, `K5 rien ne déborde (${r.deb})`);
      await pg.screenshot({ path: path.join(SHOTS, `point-c-${W}-${th}.png`), fullPage: false });
      const h = await pg.evaluateHandle(() => document.querySelector('.n-rp'));
      if (h.asElement()) await h.asElement().screenshot({ path: path.join(SHOTS, `point-c-liste-${W}-${th}.png`) }).catch(() => {});
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
