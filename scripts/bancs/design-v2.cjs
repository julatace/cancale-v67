require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LE NOUVEAU DESIGN « STUDIO PREMIUM », PHASE 1 (17 nov.) — l'app RENDUE.
//  Récit : docs/passation/2026-11-17-design-v2.md · code : src/designV2/.
//
//  Base INVENTÉE (`design-passe.cjs` : 3 comptes, ventes, bordereaux, colis à retirer avec codes,
//  vignettes SVG), garde réseau. À 390 tactile clair ET sombre, et à 1512 :
//    E  ÉTEINT ⇒ l'app est celle d'avant : la signature du DOM (balises, classes, data-*) de Ma journée,
//       Achats, Ventes, Annonces et Argent est IDENTIQUE à celle de origin/main (`SIGNATURE_AVANT=…`,
//       écrite par le même banc lancé sur le build de main : `BANC_DIST=<dist de main>`) ;
//    R  le réglage existe (Paramètres → Apparence) et l'allume ;
//    B  allumé : la barre du bas porte Aujourd'hui · Annonces · Achats · Ventes · Argent, aucun disque « + » ;
//    J  Aujourd'hui remplace Ma journée : le chiffre en affiche = la case « À envoyer » d'avant (même règle,
//       même nombre — aucune donnée inventée), la bande = ce nombre de colis (au plus 12), « À retirer » =
//       la case d'avant, le plein = le nombre de bordereaux prêts, au pouce AU-DESSUS de la barre, et le
//       bas du contenu défile au-dessus du plein (marge) ;
//    A  Achats : une passe par point relais ; chaque code d'une passe est un code qu'Achats montrait avant
//       (et tous y sont) ; QR seulement là où l'écran d'avant en avait un ;
//    M  Ventes : UN menu plateforme · compte sous le grand titre ; la rangée de pastilles n'est plus à
//       l'écran ; le menu ouvre sa feuille avec les mêmes contrôles ;
//    P  au plus UN bouton plein visible par écran ;
//    T  cibles ≥ 44 × 44 pour tout bouton du nouveau design ;
//    K  tout bouton du nouveau design passe par le composant (`data-v2b` ou rangée `data-v2-rangee`),
//       aucun `display:inline-flex` ;
//    X  aucun texte tronqué sans points de suspension (scrollWidth ≤ clientWidth), aucun libellé de bouton
//       coupé, rien ne déborde de l'écran ;
//    C  contraste ≥ 4,5:1 de chaque texte du nouveau design sur son fond EFFECTIF (fonds composés jusqu'à la
//       lumière du Studio, au pire endroit : le bas) ;
//    Z  la planche des boutons (chaque rôle × chaque état, clair et sombre) est rendue et capturée.
//  `SHOTS=dossier` garde les captures (regarde-les). Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-design-v2');
fs.mkdirSync(SHOTS, { recursive: true });
const SIG_AVANT = process.env.SIGNATURE_AVANT || '';
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); } return c; };
const pret = async (pg) => { await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {}); await pg.waitForTimeout(3200); };

const CONTRASTE = `(() => {
  const rgba = (t) => { t = String(t || ''); const m = t.match(/^rgba?\\(([^)]+)\\)$/); if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    try { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.clearRect(0, 0, 1, 1); x.fillStyle = t; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; } catch (_) { return null; } };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const sur = (h, b) => ({ r: h.r * h.a + b.r * (1 - h.a), g: h.g * h.a + b.g * (1 - h.a), b: h.b * h.a + b.b * (1 - h.a), a: 1 });
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const jeton = (v) => { const d = document.createElement('i'); d.style.color = 'var(' + v + ')'; document.body.appendChild(d); const c = rgba(getComputedStyle(d).color); d.remove(); return c; };
  // Le fond EFFECTIF d'un élément : ses ancêtres composés jusqu'au premier fond opaque, sinon la lumière du Studio (le bas, le pire).
  const fond = (el) => { const couches = []; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { couches.push(c); if (c.a >= 0.99) break; } }
    const lum0 = (() => { const v = jeton('--sv-haut'); return v && v.a > 0 ? v : jeton('--sb-bas'); })(); let f = couches.length && couches[couches.length - 1].a >= 0.99 ? couches.pop() : lum0; for (let i = couches.length - 1; i >= 0; i--) f = sur(couches[i], f); return f; };
  return { rgba, sur, ratio, jeton, fond };
})()`;

// La signature d'un écran : balises, classes triées et NOMS des data-* (jamais les valeurs ni le texte : l'heure bouge).
const SIGNATURE = () => { const m = document.querySelector('.vrm-main'); if (!m) return null; const out = [];
  const pas = (e, d) => { if (d > 60 || e.matches('.vrm-fraicheur-hote, [data-temps-reel-neuf], [data-fraicheur-unique], [data-geste-disque]')) return; const cl = [...e.classList].sort().join('.'); const da = [...e.attributes].map((a) => a.name).filter((n) => n.startsWith('data-') && !/^data-(sb-|v2|vu$)/.test(n)).sort().join(',');
    out.push(d + ':' + e.tagName + (cl ? '.' + cl : '') + (da ? '[' + da + ']' : '')); for (const c of e.children) pas(c, d + 1); };
  pas(m, 0); return out; };

const ECRANS = [['journee', '/?tab=journee'], ['achats', '/?tab=achats'], ['ventes', '/?tab=ventes'], ['annonces', '/?tab=annonces'], ['compta', '/?tab=compta']];

// Les messages passagers (« toasts ») d'avant la capture sont touchés (ils se ferment) : la capture montre l'écran.
async function sansToasts(pg) { await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click(); }).catch(() => {}); await pg.waitForTimeout(400); }
async function allumer(pg) { await pg.evaluate(() => localStorage.setItem('vrm_design_v2', '1')); await pg.reload({ waitUntil: 'domcontentloaded' }); await pret(pg);
  // Sur Aujourd'hui, attendre que les ventes soient LUES (le chiffre quitte « — ») : la machine de banc est partagée.
  await pg.waitForFunction(() => !document.querySelector('[data-v2-ecran="aujourdhui"]') || !!document.querySelector('[data-v2-affiche]:not([data-v2-affiche=""])'), null, { timeout: 40000 }).catch(() => {}); await pg.waitForTimeout(800); }

// Les mesures communes d'un écran allumé : cibles, composant, troncatures, débordement, contraste, pleins.
async function mesurerEcran(pg, nom, tel) {
  const r = await pg.evaluate((src) => { const K = eval(src);
    const zones = [...document.querySelectorAll('.v2-ecran, .v2-achats-retirer, .v2-menu')];
    const vis = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
    const horsAncien = (e) => !e.closest('[data-v2-detail-retraits], .v2-feuille-corps');
    const boutons = zones.flatMap((z) => z.matches('button') ? [z] : [...z.querySelectorAll('button')]).filter(vis).filter(horsAncien);
    const petits = boutons.filter((b) => { return b.offsetHeight < 44 || b.offsetWidth < 44; }).map((b) => (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 30) + ':' + b.offsetWidth + 'x' + b.offsetHeight);
    const horsComposant = boutons.filter((b) => !b.hasAttribute('data-v2b') && !b.hasAttribute('data-v2-rangee')).map((b) => b.className.slice(0, 40));
    const inlineFlex = [...document.querySelectorAll('.v2b, .v2b-hote, .v2-rangee')].filter((e) => getComputedStyle(e).display === 'inline-flex').length;
    const textes = zones.flatMap((z) => [...z.querySelectorAll('*')]).filter(vis).filter(horsAncien).filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    const tronques = textes.filter((e) => { const cs = getComputedStyle(e); return e.scrollWidth > e.clientWidth + 1 && cs.textOverflow !== 'ellipsis' && /hidden|clip/.test(cs.overflowX) && e.clientWidth > 0; }).map((e) => e.className + ':' + e.textContent.trim().slice(0, 30));
    const libsCoupes = [...document.querySelectorAll('.v2b-lib')].filter(vis).filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim());
    const W = innerWidth; const deb = document.documentElement.scrollWidth - W;
    const hors = textes.filter((e) => !e.closest('.v2-bande, .v2-passe-piste')).filter((e) => { const q = e.getBoundingClientRect(); return q.right > W + 1 || q.left < -1; }).map((e) => e.textContent.trim().slice(0, 30));
    const contrastes = textes.map((e) => { const cs = getComputedStyle(e); const c = K.rgba(cs.color); if (!c) return null; const f = K.fond(e); const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700);
      const op = Number(cs.opacity) * (e.closest('[aria-disabled="true"]') ? 0 : 1); if (op === 0) return null; return { t: e.textContent.trim().slice(0, 24), r: Math.round(K.ratio(K.sur(c, f), f) * 100) / 100, min: big ? 3 : 4.5 }; }).filter(Boolean);
    const faibles = contrastes.filter((x) => x.r < x.min);
    const pleins = [...document.querySelectorAll('[data-v2b="principal"], .sb-btn-plein')].filter(vis).length;
    return { n: boutons.length, petits, horsComposant, inlineFlex, tronques, libsCoupes, deb, hors, nTextes: contrastes.length, faibles, pleins, minC: contrastes.length ? Math.min(...contrastes.map((x) => x.r)) : null };
  }, CONTRASTE);
  dit(r.pleins <= 1, `P ${nom} : au plus un bouton plein visible (${r.pleins})`, r.pleins);
  dit(!r.petits.length, `T ${nom} : ${r.n} boutons du nouveau design, tous ≥ 44 × 44`, r.petits);
  dit(!r.horsComposant.length && r.inlineFlex === 0, `K ${nom} : chaque bouton passe par le composant, aucun inline-flex`, { hors: r.horsComposant, inlineFlex: r.inlineFlex });
  dit(!r.tronques.length && !r.libsCoupes.length, `X ${nom} : aucun texte tronqué sans « … », aucun libellé de bouton coupé`, { t: r.tronques, b: r.libsCoupes });
  dit(r.deb <= 1 && !r.hors.length, `X ${nom} : rien ne déborde de l’écran`, { deb: r.deb, hors: r.hors });
  dit(r.nTextes > 0 && !r.faibles.length, `C ${nom} : ${r.nTextes} textes ≥ 4,5:1 sur leur fond (min ${r.minC})`, r.faibles);
  return r;
}

async function telephone(nav, sombre, b, sigs) {
  const th = sombre ? 'sombre' : 'clair';
  console.log(`\n── 390 tactile · ${th}`);
  // ÉTEINT : la signature de chaque écran, et ce que l'app d'avant montre (le nombre à envoyer, à retirer, les codes).
  const avant = {};
  for (const [id, url] of ECRANS) {
    const { ctx, pg, erreurs } = await ouvrir(nav, { W: 390, sombre, b, url }); await pret(pg);
    const sig = await signatureStable(pg);
    const x = await pg.evaluate((s) => ({ sig: null, env: (document.querySelector('[data-tuile="envoyer"]') || { getAttribute: () => null }).getAttribute('data-n'),
      ret: (document.querySelector('[data-tuile="retirer"]') || { getAttribute: () => null }).getAttribute('data-n'),
      codes: [...new Set([...document.querySelectorAll('.vrm-colis-retirer [data-code-retrait]')].map((e) => e.getAttribute('data-code-retrait')))],
      qr: document.querySelectorAll('.vrm-colis-retirer [data-rp-a-qr="1"]').length,
      attr: document.documentElement.getAttribute('data-design'),
      // (17 nov.) Plus de disque « + », réglage éteint aussi ; ses gestes, chacun à sa place.
      disque: !!document.querySelector('[data-sb-disque], .sb-disque'), onglets: document.querySelectorAll('.vrm-tabbar > .vrm-tab').length,
      loupe: !!document.querySelector('button[data-recherche-loupe]'), publier: !!document.querySelector('[data-geste-disque="publier"] button'),
      imprimer: !!document.querySelector('[data-sj-imprimer], [data-imprimer-prets]'), ajouterAchat: !!document.querySelector('[data-achat-hors-ajouter], [data-achats-hors-entete]') }), SIGNATURE.toString());
    x.sig = sig; avant[id] = x;
    if (!sombre) sigs[id] = x.sig;
    if (id === 'journee') dit(x.attr == null && !erreurs.length, `E éteint : aucun data-design sur <html>, aucune erreur (${th})`, { attr: x.attr, erreurs });
    dit(!x.disque && x.onglets === 5, `D éteint · ${id} : aucun disque « + », cinq onglets (${th})`, x);
    if (id === 'journee') {
      dit(x.loupe && x.imprimer, `D éteint · Ma journée : Chercher (la loupe) et Imprimer N à un toucher (${th})`, x);
      await pg.locator('button[data-recherche-loupe]').first().tap({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(700);
      dit(await pg.evaluate(() => !!document.querySelector('[data-recherche-scanner]')), `D éteint : Scanner = l’icône dans le champ de recherche (${th})`);
    }
    if (id === 'annonces') dit(x.publier, `D éteint · Annonces : Publier sur la ligne du titre (${th})`, x);
    if (id === 'achats') dit(x.ajouterAchat, `D éteint · Achats : Ajouter un achat (${th})`, x);
    if (!sombre && id === 'journee') await sansToasts(pg); await pg.screenshot({ path: path.join(SHOTS, `eteint-journee-390-${th}.png`) });
    await ctx.close();
  }
  if (!sombre && SIG_AVANT && fs.existsSync(SIG_AVANT)) {
    const ref = JSON.parse(fs.readFileSync(SIG_AVANT, 'utf8'));
    for (const [id] of ECRANS) {
      // `data-vu` (une image chargée ou pas encore) suit le réseau, pas le code : retiré des deux côtés.
      const net = (l) => (l || []).map((x) => x.replace(/,data-vu(?=[,\]])|\[data-vu\]|(?<=\[)data-vu,/g, ''));
      const a = net(ref[id]), c = net(sigs[id]);
      let i = 0; while (i < a.length && i < c.length && a[i] === c[i]) i++;
      dit(a.length > 20 && a.length === c.length && i === a.length, `E éteint : ${id} a le DOM de origin/main (${c.length} nœuds)`, i < Math.max(a.length, c.length) ? { n: [a.length, c.length], ecart: i, main: a[i], ici: c[i] } : undefined);
    }
  }

  // ALLUMÉ, par le vrai réglage : Paramètres → Apparence.
  let { ctx, pg, erreurs } = await ouvrir(nav, { W: 390, sombre, b, url: '/?tab=settings' }); await pret(pg);
  {
    const ap = pg.locator('[data-sous-ouvrir="apparence"]').first();
    await ap.waitFor({ timeout: 30000 }).catch(() => {});
    if (await ap.count()) { await ap.click().catch(() => {}); await pg.waitForTimeout(900); }
    const bt = pg.locator('[data-design-v2-bouton]').first();
    const vu = await bt.count();
    if (vu) { await bt.scrollIntoViewIfNeeded().catch(() => {}); await bt.tap().catch(() => {}); await pg.waitForTimeout(500); }
    const etat = await pg.evaluate(() => ({ ls: localStorage.getItem('vrm_design_v2'), attr: document.documentElement.getAttribute('data-design') }));
    dit(vu > 0 && etat.ls === '1' && etat.attr === 'v2', `R Paramètres → Apparence → « Nouveau design (essai) » l’allume (${th})`, { vu, ...etat });
    if (!sombre) await sansToasts(pg); await pg.screenshot({ path: path.join(SHOTS, `reglage-390-${th}.png`) });
  }
  await ctx.close();

  // Aujourd'hui.
  ({ ctx, pg, erreurs } = await ouvrir(nav, { W: 390, sombre, b, url: '/?tab=journee' })); await allumer(pg);
  const j = await pg.evaluate(() => { const bar = document.querySelector('.vrm-tabbar'); const br = bar && bar.getBoundingClientRect();
    const po = document.querySelector('[data-v2-pouce]'); const pr = po && po.getBoundingClientRect(); const pl = document.querySelector('[data-v2-principal]');
    return { ecran: !!document.querySelector('[data-v2-ecran="aujourdhui"]'), ancien: !!document.querySelector('.sj-journee'),
      onglets: [...document.querySelectorAll('.vrm-tabbar > .vrm-tab')].map((t) => t.getAttribute('data-nav-entree')), libs: [...document.querySelectorAll('.vrm-tabbar .vrm-nav-label')].map((l) => l.textContent.trim()),
      badges: document.querySelectorAll('.vrm-tabbar [data-badge-nav]').length, disque: !!document.querySelector('[data-sb-disque]'),
      affiche: (document.querySelector('[data-v2-affiche]') || { getAttribute: () => null }).getAttribute('data-v2-affiche'),
      bande: document.querySelectorAll('[data-v2-colis]').length, ret: (document.querySelector('[data-v2-groupe="retirer"] [data-v2-n]') || { getAttribute: () => null }).getAttribute('data-v2-n'),
      plein: pl ? pl.getAttribute('data-v2-principal') : null, pleinTexte: pl ? pl.textContent.trim() : '', pouce: pr && br ? { bas: Math.round(pr.bottom), barre: Math.round(br.top) } : null,
      afaire: document.querySelectorAll('[data-v2-job]').length, gestes: document.querySelectorAll('[data-v2-job] [data-v2b]').length }; });
  dit(j.ecran && !j.ancien, 'J Aujourd’hui remplace Ma journée', j);
  dit(j.onglets.join() === 'journee,paires,achats,ventes,compta' && !j.disque, `B barre : ${j.libs.join(' · ')} — aucun disque « + »`, j);
  dit(j.libs[0] === 'Aujourd’hui' && j.libs.includes('Achats'), 'B Aujourd’hui et Achats sont dans la barre, avec leur libellé', j.libs);
  dit(j.affiche != null && j.affiche === avant.journee.env, `J le chiffre en affiche (${j.affiche}) = la case « À envoyer » d’avant (${avant.journee.env})`, { v2: j.affiche, avant: avant.journee.env });
  dit(j.bande === Math.min(12, Number(j.affiche) || 0), `J la bande porte ${j.bande} paires (= le chiffre, au plus 12)`, j.bande);
  dit(String(j.ret || '0') === String(avant.journee.ret || '0'), `J « À retirer » (${j.ret}) = la case d’avant (${avant.journee.ret})`, { v2: j.ret, avant: avant.journee.ret });
  dit(j.plein && /\d/.test(j.pleinTexte) && j.pleinTexte.includes(j.plein), `J le plein dit son nombre : « ${j.pleinTexte} »`, j);
  dit(j.pouce && j.pouce.bas <= j.pouce.barre - 4, 'J le plein est au pouce, AU-DESSUS de la barre du bas', j.pouce);
  dit(j.afaire > 0 && j.gestes <= j.afaire, `J « À faire » : ${j.afaire} groupes, UN geste au plus chacun`, j);
  await sansToasts(pg); await pg.screenshot({ path: path.join(SHOTS, `aujourdhui-390-${th}.png`) });
  // Le bas du contenu, défilé tout en bas, reste au-dessus du plein (la marge est posée).
  const bas = await pg.evaluate(async () => { const m = document.querySelector('.vrm-main'); m.scrollTo(0, m.scrollHeight); await new Promise((r) => setTimeout(r, 400));
    const e = document.querySelector('.v2-ecran'); const pp = document.querySelector('[data-v2-pouce]'); if (!e || !pp) return null; const enf = [...e.children].filter((x) => !x.matches('[data-v2-pouce]') && x.getClientRects().length); const der = enf[enf.length - 1];
    const po = pp.getBoundingClientRect(); return { der: Math.round(der.getBoundingClientRect().bottom), pouce: Math.round(po.top) }; });
  dit(!!bas && bas.der <= bas.pouce, 'J défilé en bas, le dernier groupe passe au-dessus du plein (rien de caché)', bas);
  await sansToasts(pg); await pg.screenshot({ path: path.join(SHOTS, `aujourdhui-bas-390-${th}.png`) });
  await pg.evaluate(() => document.querySelector('.vrm-main').scrollTo(0, 0));
  await mesurerEcran(pg, 'Aujourd’hui', true);
  dit(!erreurs.length, 'aucune erreur JS (Aujourd’hui)', erreurs);
  await ctx.close();

  // Achats : les passes.
  ({ ctx, pg, erreurs } = await ouvrir(nav, { W: 390, sombre, b, url: '/?tab=achats' })); await allumer(pg);
  // Les passes arrivent avec les lectures (achats, e-mails de suivi) : relevées quand leur nombre ne bouge plus.
  { let v = -1; for (let k = 0; k < 12; k++) { const n = await pg.evaluate(() => document.querySelectorAll('[data-v2-face]').length); if (n === v && n > 0) break; v = n; await pg.waitForTimeout(1500); } }
  const a = await pg.evaluate(() => ({ passes: [...document.querySelectorAll('[data-v2-passe]')].map((p) => ({ n: Number(p.getAttribute('data-v2-passe-n')), faces: p.querySelectorAll('[data-v2-face]').length })),
    codes: [...new Set([...document.querySelectorAll('[data-v2-code-grand]')].map((e) => e.textContent.trim()))], qr: document.querySelectorAll('[data-v2-qr]').length,
    limiteAvantQr: [...document.querySelectorAll('[data-v2-face]')].every((f) => { const l = f.querySelector('.v2-passe-limite'), q = f.querySelector('[data-v2-qr]'); return !q || (l && l.getBoundingClientRect().bottom <= q.getBoundingClientRect().top + 1); }),
    pages: [...document.querySelectorAll('.v2-passe-pages')].map((p) => p.textContent.trim()), enRoute: document.querySelectorAll('[data-v2-achat]').length }));
  dit(a.passes.length > 0 && a.passes.every((p) => p.n === p.faces), `A ${a.passes.length} passes (un point = une passe), chaque colis du point a sa face`, a.passes);
  const tousAvant = avant.achats.codes;
  const nFaces = a.passes.reduce((t, p) => t + p.faces, 0);
  dit(a.codes.length > 0 && a.codes.every((c) => tousAvant.includes(c)), `A les ${a.codes.length} codes des passes sont des codes qu’Achats portait avant (${tousAvant.length}, à vérifier compris) — aucun inventé`, { v2: a.codes, avant: tousAvant });
  dit(String(nFaces) === String(avant.journee.ret), `A ${nFaces} colis en passes = « À retirer » de Ma journée d’avant (${avant.journee.ret})`, { faces: nFaces, avant: avant.journee.ret });
  dit(a.qr <= avant.achats.qr && a.qr <= nFaces, `A QR seulement s’il existe (${a.qr} ici, ${avant.achats.qr} lignes « QR » avant)`, a);
  dit(a.limiteAvantQr, 'A la date limite est AU-DESSUS du QR');
  dit(a.passes.every((p) => p.n < 2) || a.pages.some((t) => /1/.test(t)), 'A plusieurs colis au même point : « 1 sur N », on glisse de code en code', a.pages);
  await sansToasts(pg); await pg.screenshot({ path: path.join(SHOTS, `achats-390-${th}.png`) });
  await sansToasts(pg); await pg.screenshot({ path: path.join(SHOTS, `achats-plein-390-${th}.png`), fullPage: false });
  await mesurerEcran(pg, 'Achats', true);
  dit(!erreurs.length, 'aucune erreur JS (Achats)', erreurs);
  await ctx.close();

  // Ventes : le menu plateforme · compte ; l'écran d'hier dans la coque neuve.
  ({ ctx, pg, erreurs } = await ouvrir(nav, { W: 390, sombre, b, url: '/?tab=ventes' })); await allumer(pg);
  const m = await pg.evaluate(() => { const h = document.querySelector('.v2-tete-tache h1, .vrm-tache-tete h1'); const me = document.querySelector('[data-v2-menu]');
    const pastilles = [...document.querySelectorAll('.vrm-main [data-selecteur-sites], .vrm-main .vrm-selecteur-sites')].filter((e) => e.getClientRects().length && !e.closest('[data-v2-feuille]')).length;
    return { menu: !!me, sous: me && h ? Math.round(me.getBoundingClientRect().top - h.getBoundingClientRect().bottom) : null, texte: me ? me.textContent.trim() : '', pastilles }; });
  dit(m.menu && m.sous != null && m.sous >= -2 && m.sous <= 24, `M UN menu sous le grand titre : « ${m.texte} »`, m);
  dit(m.pastilles === 0, 'M la rangée de pastilles n’est plus à l’écran', m);
  await sansToasts(pg); await pg.screenshot({ path: path.join(SHOTS, `ventes-390-${th}.png`) });
  await pg.locator('[data-v2-menu]').first().tap({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(600);
  const f = await pg.evaluate(() => { const h = document.querySelector('[data-v2-feuille]:not([hidden])'); return { ouverte: !!h, controles: h ? h.querySelectorAll('.v2-feuille-corps button').length : 0 }; });
  dit(f.ouverte && f.controles > 0, `M la feuille s’ouvre avec les mêmes contrôles (${f.controles})`, f);
  await sansToasts(pg); await pg.screenshot({ path: path.join(SHOTS, `menu-390-${th}.png`) });
  await pg.locator('[data-v2-feuille-fermer]').first().tap({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(400);
  dit(await pg.evaluate(() => !document.querySelector('[data-v2-feuille]:not([hidden])')), 'M la feuille se referme');
  dit(await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 1), 'X Ventes (écran d’hier dans la coque neuve) : rien ne déborde');
  dit(!erreurs.length, 'aucune erreur JS (Ventes)', erreurs);
  // ANNONCES (17 nov., la capture de Julien : « les boutons sont dégueulasses, c'est mal proportionné »).
  await pg.goto(`http://localhost:${PORT}/?tab=annonces`, { waitUntil: 'domcontentloaded' }); await pret(pg); await pg.waitForTimeout(1500);
  const an = await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); const vis = (e) => e && e.getClientRects().length && getComputedStyle(e).display !== 'none';
    const q = (e) => e.getBoundingClientRect();
    const rows = [...m.querySelectorAll('[data-v2l]')].filter(vis);
    const premiere = rows[0] ? Math.round(q(rows[0]).top) : null;
    const hauteurs = rows.slice(0, 6).map((r) => Math.round(q(r).height));
    const visibles = rows.filter((r) => q(r).top >= 0 && q(r).bottom <= innerHeight - 70).length;
    const barre = m.querySelector('[data-ann-barre]'); const champ = barre && barre.querySelector('.vrm-annbar-recherche'); const plus = barre && barre.querySelector('.vrm-ann-outils > button');
    const alignes = champ && plus ? { champ: [Math.round(q(champ).top), Math.round(q(champ).height)], plus: [Math.round(q(plus).top), Math.round(q(plus).height)] } : null;
    const cpt = rows.filter((r) => /vendeur_\d/.test(r.textContent)).length;
    const relierPuce = [...m.querySelectorAll('.vrm-ann-card .vrm-ann-relier')].filter(vis).filter((b) => !b.classList.contains('v2-ann-relier')).length;
    const relierTexte = [...m.querySelectorAll('.v2-ann-relier')].filter(vis).length;
    const puces = vis(m.querySelector('.vrm-stock-views')); const selPaires = vis(m.querySelector('.vrm-paires-selecteur')); const stats = vis(m.querySelector('.vrm-carte-stats'));
    const seg = m.querySelector('[data-v2-ann-segment]'); const segN = seg ? seg.querySelectorAll('button').length : 0;
    const tete = m.querySelector('.v2-ann-groupe'); const ct = tete && getComputedStyle(tete);
    const coupes = [...m.querySelectorAll('[data-v2-ann-segment] button, [data-ann-barre] button')].filter(vis).filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent.trim());
    return { premiere, hauteurs, visibles, alignes, cpt, relierPuce, relierTexte, puces, selPaires, stats, segN, teteFond: ct ? ct.backgroundColor + '|' + ct.backgroundImage : '', teteTaille: ct ? ct.fontSize : '', coupes,
      publierHaut: (() => { const p = document.querySelector('[data-v2-principal="publier"]'); return p ? Math.round(p.getBoundingClientRect().top) : null; })(), disque: !!document.querySelector('[data-sb-disque]'), pleins: [...document.querySelectorAll('[data-v2b="principal"], .sb-btn-plein')].filter(vis).length, plein: (document.querySelector('[data-v2-principal]') || {}).textContent || '' }; });
  dit(an.premiere != null && an.premiere <= 380, `N la 1re annonce commence à ${an.premiere} px (≤ 380)`, an);
  dit(!an.puces && !an.selPaires && !an.stats && an.segN === 3, 'N ni puces, ni « Annonces | Stock », ni chiffres : UN segmenté (En ligne · Qui dorment · À publier)', an);
  dit(an.alignes && an.alignes.champ[1] >= 44 && an.alignes.plus[1] >= 44 && Math.abs((an.alignes.champ[0] + an.alignes.champ[1] / 2) - (an.alignes.plus[0] + an.alignes.plus[1] / 2)) <= 1, `N recherche et « ⋯ » : ≥ 44 px, centrés sur la même ligne`, an.alignes);
  dit(an.hauteurs.length >= 3 && an.hauteurs.every((h) => [80, 88, 104, 112].includes(h)), `N rangées de 88 px (112 quand le titre prend deux lignes) (${an.hauteurs.join(', ')})`, an.hauteurs);
  dit(an.visibles >= 4, `N ${an.visibles} annonces lisibles en entier sur le premier écran (≥ 4, trois lignes d’informations chacune)`, an.visibles);
  dit(an.cpt === 0, 'N le compte n’est plus redit sur chaque rangée (il est dans l’en-tête du groupe)', an.cpt);
  dit(an.relierPuce === 0, `N « Relier un achat » : plus de grosse puce sous la rangée (${an.relierTexte} en texte ambre)`, an);
  dit(/rgba\(0, 0, 0, 0\)|transparent/.test(an.teteFond) && an.teteTaille === '13px', 'N l’en-tête du groupe est un en-tête simple (13 px, sans bande)', an.teteFond);
  dit(!an.coupes.length, 'N aucun libellé coupé (segmenté, barre)', an.coupes);
  dit(!an.disque && an.pleins === 1 && /\S/.test(an.plein) && an.publierHaut != null && an.publierHaut < 200, `N pas de « + » ; UN plein, compact, en haut : « ${an.plein.trim()} »`, an);
  await sansToasts(pg); await pg.screenshot({ path: path.join(SHOTS, `annonces-v2-390-${th}.png`) });
  {
    await pg.locator('[data-ann-barre] .vrm-ann-outils > button').first().tap({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(500);
    const me = await pg.evaluate(() => [...document.querySelectorAll('[data-v2-ann-vue]')].map((b) => b.getAttribute('data-v2-ann-vue')));
    dit(['grille', 'selection', 'republier', 'stock'].every((k) => me.includes(k)) && await pg.evaluate(() => !!document.querySelector('[data-v2-feuille="outils"] [data-v2-ann-affichage]')), `N « ⋯ » porte les vues, le tri, la grille et Stock (${me.join(', ')})`, me);
    await pg.screenshot({ path: path.join(SHOTS, `annonces-v2-menu-390-${th}.png`) });
    await pg.evaluate(() => { const v = document.querySelector('[data-v2-feuille="outils"] .v2-voile'); if (v) v.click(); }); await pg.waitForTimeout(300);
  }
  for (const [id, url] of [['annonces', '/?tab=annonces'], ['argent', '/?tab=compta']]) {
    await pg.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' }); await pret(pg);
    dit(await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 1 && (document.querySelector('.vrm-main').innerText || '').trim().length > 40), `X ${id} (écran d’hier) se rend dans la coque neuve, sans débordement`);
    await sansToasts(pg); await pg.screenshot({ path: path.join(SHOTS, `${id}-390-${th}.png`) });
  }
  await ctx.close();
}

async function ordinateur(nav, sombre, b) {
  const th = sombre ? 'sombre' : 'clair';
  console.log(`\n── 1512 · ${th}`);
  const { ctx, pg, erreurs } = await ouvrir(nav, { W: 1512, sombre, b, url: '/?tab=journee' }); await allumer(pg);
  const r = await pg.evaluate(() => { const pl = document.querySelector('[data-v2-principal]'); const t = document.querySelector('.v2-titre'); const q = pl && pl.getBoundingClientRect(), tq = t && t.getBoundingClientRect();
    return { rail: !!document.querySelector('.vrm-sidebar'), plein: q ? { haut: Math.round(q.top), droite: Math.round(innerWidth - q.right), titre: tq ? Math.round(tq.top) : null } : null, disque: !!document.querySelector('[data-sb-disque]') }; });
  dit(r.rail && !r.disque, 'N 1512 : la colonne de gauche, pas de disque', r);
  dit(r.plein && r.plein.haut < 200, 'N 1512 : le plein est EN HAUT (sur la ligne du titre), à droite', r.plein);
  await sansToasts(pg); await pg.screenshot({ path: path.join(SHOTS, `aujourdhui-1512-${th}.png`) });
  await mesurerEcran(pg, 'Aujourd’hui 1512', false);
  await pg.goto(`http://localhost:${PORT}/?tab=achats`, { waitUntil: 'domcontentloaded' }); await pret(pg);
  await sansToasts(pg); await pg.screenshot({ path: path.join(SHOTS, `achats-1512-${th}.png`) });
  await mesurerEcran(pg, 'Achats 1512', false);
  await pg.goto(`http://localhost:${PORT}/?tab=ventes`, { waitUntil: 'domcontentloaded' }); await pret(pg);
  await sansToasts(pg); await pg.screenshot({ path: path.join(SHOTS, `ventes-1512-${th}.png`) });
  dit(!erreurs.length, 'aucune erreur JS (1512)', erreurs);
  await ctx.close();
}

// Z — la planche des boutons : le VRAI composant, rendu seul (esbuild), chaque rôle × chaque état, clair et sombre.
async function planche(nav) {
  console.log('\n── planche des boutons');
  const racine = path.join(__dirname, '..', '..');
  const dossier = path.join(SHOTS, 'planche'); fs.mkdirSync(dossier, { recursive: true });
  try {
    require(path.join(racine, 'node_modules', 'esbuild')).buildSync({ entryPoints: [path.join(__dirname, '_planche-boutons-v2.jsx')], bundle: true, outfile: path.join(dossier, 'p.js'),
      loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file', '.png': 'file', '.svg': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error' });
  } catch (e) { dit(false, 'Z la planche se construit', String(e.message || e).slice(0, 300)); return; }
  fs.writeFileSync(path.join(dossier, 'index.html'), '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="p.css"><body style="margin:0;min-height:100vh;background:linear-gradient(180deg,var(--sv-haut),var(--sv-bas))"><div id="r"></div><script src="p.js"></script>');
  for (const sombre of [false, true]) {
    const ctx = await nav.newContext({ viewport: { width: 1520, height: 1300 }, deviceScaleFactor: 1 });
    const pg = await ctx.newPage();
    await pg.goto('file://' + path.join(dossier, 'index.html'));
    await pg.evaluate((s) => document.documentElement.setAttribute('data-theme', s ? 'dark' : 'light'), sombre);
    await pg.waitForTimeout(400);
    const z = await pg.evaluate(() => ({ n: document.querySelectorAll('[data-planche]').length, boutons: document.querySelectorAll('button[data-v2b]').length,
      petits: [...document.querySelectorAll('button[data-v2b]')].filter((b) => b.offsetHeight < 44 || b.offsetWidth < 44).length,
      plein: (() => { const b = document.querySelector('[data-planche="principal:repos"] button'); return b ? Math.round(b.getBoundingClientRect().height) : null; })(),
      raisons: document.querySelectorAll('[data-v2b-raison]').length, petitsQui: [...document.querySelectorAll('button[data-v2b]')].filter((b) => b.offsetHeight < 44 || b.offsetWidth < 44).map((b) => b.closest('[data-planche]').getAttribute('data-planche') + ':' + Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height)), roues: document.querySelectorAll('.v2b-roue').length }));
    dit(z.n === 23 && z.petits === 0 && z.plein === 50 && z.raisons === 4 && z.roues === 4, `Z planche ${sombre ? 'sombre' : 'claire'} : ${z.boutons} boutons, plein 50 px, raison dite ×4, roue ×4, cibles ≥ 44`, z);
    await sansToasts(pg); await pg.screenshot({ path: path.join(SHOTS, `planche-boutons-${sombre ? 'sombre' : 'clair'}.png`), fullPage: true });
    const rien = await pg.evaluate(() => { const r = document.querySelector('[data-planche-rien] [data-v2-rien]'); return r ? r.textContent.trim() : ''; });
    dit(/Rien à faire/.test(rien), `Z « Rien à faire », calme, quand tout est fait (${sombre ? 'sombre' : 'clair'})`, rien);
    const el = await pg.$('[data-planche-rien]'); if (el) await el.screenshot({ path: path.join(SHOTS, `rien-a-faire-${sombre ? 'sombre' : 'clair'}.png`) });
    await ctx.close();
  }
}

// La base de la passe de design + les colis Chronopost « au point relais » (codes, QR en image) de `_base-volume`
// (`qr: true`), dont DEUX au même point (pour « 1 sur 2 »). Inventés : aucun vrai code, aucun vrai lieu.
function baseV2() {
  const b = base();
  const q = require('./_base-volume.cjs').fabriquer({ comptes: 3, qr: true });
  const ch = q.rows.filter((r) => /^email_track_chronopost_/.test(r.id));
  if (ch[1] && ch[0]) ch[1].data.lieu = ch[0].data.lieu;
  b.rows.push(...ch);
  return b;
}
// Une signature STABLE : relevée jusqu'à ce que deux relevés d'affilée soient égaux (les lectures arrivent par vagues).
async function signatureStable(pg) {
  // Trois relevés égaux d'affilée (1,5 s d'écart), après 3 s : les colis d'« À envoyer » arrivent parfois à 5 s.
  await pg.waitForTimeout(3000);
  let avant = null, egaux = 0;
  for (let k = 0; k < 20; k++) { const s = await pg.evaluate((f) => eval('(' + f + ')')(), SIGNATURE.toString()); if (avant && JSON.stringify(s) === JSON.stringify(avant)) { if (++egaux >= 2) return s; } else egaux = 0; avant = s; await pg.waitForTimeout(1500); }
  return avant;
}
(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = baseV2();
  const sigs = {};
  try {
    for (const sombre of [false, true]) await telephone(nav, sombre, b, sigs);
    await ordinateur(nav, false, b); await ordinateur(nav, true, b);
    await planche(nav);
  } catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1500)); }
  fs.writeFileSync(path.join(SHOTS, 'signature-eteint.json'), JSON.stringify(sigs));
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} design-v2 : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
