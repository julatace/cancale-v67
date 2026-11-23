require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LA CARTE DE RETRAIT EN BILLET (21 nov. 2026, lot relier-code) — Achats · À retirer RENDU, base INVENTÉE (design-passe) :
//  RELAIS DU MARCHE porte DEUX colis (« 978216 » avec un QR, « AB12CD34EF » sans), TABAC DE LA GARE un seul (« 4521 »).
//  Julien : « améliore le design du carré où il y a le code de retrait » (façon billet / Wallet, style Vintex).
//  Puis (21 nov., « tu peux faire mieux sur le visuel du colis à retirer », « enlève Copier ») : billet compact, un seul niveau.
//  390 × 844 tactile puis 1512 × 950, clair et sombre ; `VARIANTE=a` capture la variante A (défaut : B) ; mesures RENDUES :
//    C  le code : chasse fixe, ≥ 32 px (6 chiffres), encre NOIRE sur fond BLANC même en sombre, groupé, texte ENTIER ;
//    Q  le QR (un VRAI QR du code, qrcode-generator) scannable (≥ 100 px, carré) sur blanc, à droite du code, sans trou entre eux ;
//    E  le bandeau du point : logo, nom, échéance « à retirer avant le … » (neutre ; ambre à moins de 2 j) ;
//    P  la PHOTO de la paire (vignette 48, place réservée), titre complet ;
//    N  UN seul niveau de carte (jamais une carte dans une carte) ; billet ≤ 240 px de haut au téléphone ;
//    G  « Plein écran » : une icône ≥ 44 px dans la zone du code ; toucher la zone = le guichet ; AUCUN « Copier » (page et guichet) ;
//    S  deux colis au même point = deux billets, chacun SON code, l'en-tête du point UNE fois ;
//    R  ni bleu vif, ni rouge, ni violet dans un billet ; rien ne déborde.
//  `BANC_DIST=…` juge un autre build (le code d'avant : rouge attendu). `SHOTS=dossier` garde les captures.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-retrait-billet');
fs.mkdirSync(SHOTS, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARG = liste('VUES', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const VARIANTE = process.env.VARIANTE === 'a' ? 'a' : 'b';
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
  return b;
}
const releve = () => {
  const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const R = (e) => e.getBoundingClientRect();
  const rgb = (c) => (String(c).match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
  const points = [...document.querySelectorAll('[data-rp-point]')].filter(vis).map((c) => {
    const billets = [...c.querySelectorAll('[data-rp-colis]')].filter(vis).map((li) => {
      const zone = li.querySelector('[data-rp-billet]'), code = li.querySelector('[data-rp-code-grand]'), qr = li.querySelector('[data-rp-qr]');
      const cs = code ? getComputedStyle(code) : null, zs = zone ? getComputedStyle(zone) : null;
      const gestes = [...li.querySelectorAll('[data-rp-plein]')].filter(vis).map((g) => ({ q: 'plein', h: Math.round(R(g).height), w: Math.round(R(g).width), dansZone: !!g.closest('[data-rp-billet]') }));
      // Les niveaux de carte : le billet et ses ancêtres jusqu'à la liste (.n-rp) qui portent un cadre visible.
      let niveaux = 0; for (let e = li; e && !e.classList.contains('n-rp'); e = e.parentElement) { const st = getComputedStyle(e); if (parseFloat(st.borderTopWidth) > 0 && st.borderTopStyle === 'solid' && parseFloat(st.borderLeftWidth) > 0) niveaux++; }
      const ph = li.querySelector('.n-rp-vignette img'); const vg = li.querySelector('.n-rp-vignette');
      const bleus = [...li.querySelectorAll('*')].filter(vis).flatMap((e) => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor]).map(rgb).filter(([r, g, b2]) => b2 > 170 && r < 90 && g < 170).length;
      const copier = [...li.querySelectorAll('button, a, [role="button"]')].filter(vis).filter((e) => e.hasAttribute('data-rp-copier') || /^\s*copi(er|é)\s*$/i.test(e.textContent)).length;
      const zoneB = zone ? R(zone) : null, colB = zone && zone.querySelector('.n-rp-code-col') ? R(zone.querySelector('.n-rp-code-col')) : null, qrB = qr ? R(qr) : null;
      const couleurs = [...li.querySelectorAll('*')].filter(vis).flatMap((e) => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor]).map(rgb)
        .filter(([r, g, b]) => (r > 170 && g < 80 && b < 80) || (r > 120 && b > 150 && g < 100));   // rouge vif ou violet
      const b = R(li);
      return { cle: li.getAttribute('data-rp-colis'), code: code ? code.textContent : '', groupes: code ? Number(code.getAttribute('data-rp-code-groupes')) : 0, taille: cs ? parseFloat(cs.fontSize) : 0,
        police: cs ? cs.fontFamily : '', encre: cs ? rgb(cs.color) : [], fond: zs ? rgb(zs.backgroundColor) : [], qr: qr ? { w: Math.round(R(qr).width), h: Math.round(R(qr).height), fond: rgb(getComputedStyle(qr).backgroundColor) } : null,
        gestes, copier, niveaux, bleus, photo: !!ph, vignette: vg ? Math.round(R(vg).width) : 0, haut: Math.round(R(li).height), zoneW: zoneB ? Math.round(zoneB.width) : 0,
        // le vide entre la colonne du code et le QR (ou le bord droit du panneau sans QR) : jamais un trou laissé par un bouton retiré
        vide: zoneB && colB ? Math.round((qrB ? qrB.left : zoneB.right - 14) - colB.right) : 0, couleurs: couleurs.length, boite: { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right) },
        titre: ((li.querySelector('[data-rp-titre]') || {}).textContent || '').trim(), titreRogne: (() => { const t = li.querySelector('[data-rp-titre]'); return !!t && t.scrollHeight > t.clientHeight + 1; })() };
    });
    return { nom: ((c.querySelector('.n-rp-nom') || {}).textContent || '').trim(), logo: !!c.querySelector('.n-rp-logo svg, .n-rp-logo img'), etat: ((c.querySelector('[data-rp-rebours]') || {}).textContent || '').trim(),
      etatTon: (c.querySelector('[data-rp-rebours]') || { getAttribute: () => '' }).getAttribute('data-n-ton'), billets };
  });
  return { points, tetes: [...document.querySelectorAll('[data-rp-point] .n-rp-tete')].filter(vis).length, deb: document.documentElement.scrollWidth - innerWidth };
};

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  const b = baseBillet();
  try {
    for (const W of LARG) for (const th of THEMES) {
      console.log(`\n── Billet de retrait · ${W} · ${th}`);
      const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre: th === 'sombre', b, url: '/?tab=achats', dsf: 2 });
      try { await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${PORT}` }); } catch (_) {}
      await pg.addInitScript((v) => { try { localStorage.setItem('vrm_design_v2', '1'); localStorage.removeItem('vrm_banc_dom_ancien'); if (v === 'a') localStorage.setItem('vrm_banc_retrait_variante', 'a'); else localStorage.removeItem('vrm_banc_retrait_variante'); } catch (_) {} }, VARIANTE);
      await pg.reload({ waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
      const vu = await attendre(pg, () => document.querySelectorAll('[data-rp-point] [data-rp-colis]').length >= 3);
      if (!vu) await pg.screenshot({ path: path.join(SHOTS, `billet-${W}-${th}-attente.png`) });
      await pg.waitForTimeout(1500);
      const r = await pg.evaluate(releve);
      const marche = r.points.find((p) => /MARCHE/i.test(p.nom)), tabac = r.points.find((p) => /TABAC/i.test(p.nom));
      // Captures : la carte du point au marché, puis le tabac.
      for (const [nom, re] of [['marche', /MARCHE/i], ['tabac', /TABAC/i]]) {
        const h = await pg.evaluateHandle((s) => [...document.querySelectorAll('[data-rp-point]')].find((c) => new RegExp(s, 'i').test(c.textContent)) || null, re.source);
        const el = h.asElement(); if (el) { await el.evaluate((e) => { const y = e.getBoundingClientRect().top + scrollY - 70; scrollTo(0, y); for (const c of document.querySelectorAll('*')) { if (c.scrollHeight > c.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(c).overflowY) && c.contains(e)) c.scrollTop += e.getBoundingClientRect().top - 70; } }); await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(SHOTS, `billet-${VARIANTE}-${W}-${th}-${nom}.png`) }); }
      }
      dit(vu && !!marche && !!tabac, 'les deux points et leurs trois colis sont rendus', r.points.map((p) => [p.nom, p.billets.length]));
      if (!marche || !tabac) { await ctx.close(); continue; }
      const tous = [...marche.billets, ...tabac.billets];
      const b6 = tous.find((x) => x.code === '978216'), bl = tous.find((x) => x.code === 'AB12CD34EF'), b4 = tous.find((x) => x.code === '4521');
      dit(!!b6 && !!bl && !!b4, 'C le texte de chaque code reste ENTIER (978216, AB12CD34EF, 4521)', tous.map((x) => x.code));
      if (b6) {
        dit(b6.groupes === 2, `C « 978216 » groupé en 2 (« 978 216 ») — ${b6.groupes}`);
        dit(b6.taille >= 32 && b6.taille <= 40, `C taille du code ${b6.taille} px (32–40)`);
        dit(/mono|menlo|consolas|courier/i.test(b6.police), `C chasse fixe (${b6.police.slice(0, 40)})`);
        dit(b6.encre.join() === '0,0,0' && b6.fond.join() === '255,255,255', `C encre noire sur fond blanc (${b6.encre} sur ${b6.fond})`);
        dit(!!b6.qr && b6.qr.w >= 100 && Math.abs(b6.qr.w - b6.qr.h) <= 1 && b6.qr.fond.join() === '255,255,255', `Q le QR scannable ≥ 100 px, carré, fond blanc (${b6.qr && b6.qr.w + '×' + b6.qr.h})`);
        dit(!!b6.titre && !b6.titreRogne, `le titre complet de la paire (« ${b6.titre} »)`);
      }
      if (b4) dit(b4.groupes === 2 && b4.taille >= 32, `C « 4521 » en 2 groupes, ${b4.taille} px`);
      if (bl) dit(bl.taille >= 20 && bl.fond.join() === '255,255,255', `C un code long (10 signes) reste sur une ligne, lisible (${bl.taille} px)`);
      dit(marche.logo && tabac.logo, 'E le logo du transporteur dans l’en-tête de chaque point');
      dit(/à retirer avant le \d{1,2} /.test(marche.etat) && marche.etatTon === 'neutre', `E « ${marche.etat} » (neutre : ${marche.etatTon})`);
      dit(/avant le/.test(tabac.etat) && tabac.etatTon === 'ambre', `E moins de 2 j ⇒ ambre (« ${tabac.etat} » : ${tabac.etatTon})`);
      dit(tous.every((x) => x.gestes.length === 1 && x.gestes[0].h >= 44 && x.gestes[0].w >= 44 && x.gestes[0].dansZone), 'G « Plein écran » : une icône ≥ 44 px dans la zone du code', tous.map((x) => x.gestes));
      dit(tous.every((x) => x.photo && x.vignette >= 48), `P la photo de la paire dans chaque billet (vignette ${tous.map((x) => x.vignette).join(', ')} px)`);
      dit(tous.every((x) => x.niveaux <= 1), `N un seul niveau de carte (${tous.map((x) => x.niveaux).join(', ')})`);
      if (W < 600) dit(tous.every((x) => x.haut <= 240), `N billet compact ≤ 240 px (${tous.map((x) => x.haut).join(', ')})`);
      dit(tous.every((x) => !x.bleus), `R aucun bleu vif dans un billet (${tous.map((x) => x.bleus).join(', ')})`);
      dit(r.tetes === r.points.length, `S l'en-tête de chaque point une seule fois (${r.tetes} en-têtes, ${r.points.length} points)`);
      dit(tous.every((x) => !x.copier), 'G aucun « Copier » sur un billet', tous.map((x) => x.copier));
      dit(tous.every((x) => x.vide <= 16), `C le code et le QR alignés, sans trou (${tous.map((x) => x.vide).join(', ')} px)`);
      const [m1, m2] = marche.billets;
      dit(marche.billets.length === 2 && m1.code !== m2.code && (m2.boite.t >= m1.boite.b - 1 || m1.boite.t >= m2.boite.b - 1), 'S deux colis au même point = deux billets séparés, chacun SON code', marche.billets.map((x) => [x.code, x.boite]));
      dit(tous.every((x) => !x.couleurs), 'R aucun rouge ni violet dans un billet', tous.map((x) => x.couleurs));
      dit(r.deb <= 1, `R rien ne déborde (${r.deb})`);
      const plein = await pg.evaluate(async () => { const z = document.querySelector('[data-rp-colis] [data-rp-billet]'); if (!z) return 'absent'; const m = z.querySelector('.n-rp-code-mot'); (m || z).click(); await new Promise((r) => setTimeout(r, 700)); return document.querySelector('.vrm-qr-view, [data-qr-view], [data-relais-plein], [role="dialog"]') ? 'ouvert' : 'rien'; });
      await pg.screenshot({ path: path.join(SHOTS, `billet-${VARIANTE}-${W}-${th}-plein.png`) });
      dit(plein === 'ouvert', `G « Plein écran » ouvre le guichet (${plein})`);
      const copierGuichet = await pg.evaluate(() => { const v = document.querySelector('.vrm-qr-view, [data-qr-view], [data-relais-plein], [role="dialog"]'); return v ? [...v.querySelectorAll('button, a, [role="button"]')].filter((e) => e.getClientRects().length && /copi(er|é)/i.test(e.textContent + ' ' + (e.getAttribute('aria-label') || ''))).length : -1; });
      dit(copierGuichet === 0, `G au guichet (plein écran) : aucun « Copier » (${copierGuichet})`);
      dit(!erreurs.length, 'aucune erreur de page', erreurs.slice(0, 3));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a rencontré une erreur', String(e && e.stack || e)); }
  await nav.close(); srv.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
