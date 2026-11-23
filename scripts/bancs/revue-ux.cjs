require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « REVUE UX » (23 nov. — docs/passation/2026-11-23-revue-ux.md). La RÈGLE de chaque point, par ses data-* :
//    A7  Achats (390) : la 1re rangée de la liste au plus à mi-écran ; ni carte « Rien à retirer », ni « Tout le détail des
//        retraits », ni « Relier achats et ventes » posés au-dessus de la liste (ils sont dans « ⋯ ») ;
//    A8  Achats (390) : « En route · point pas encore dit 60 » ne redit pas le « 60 En route » de la bande ;
//    A9  Achats (390) : le bouton de la bande dit ce qu'il change (pas « Modifier ») ; UN seul bouton nommé dans la barre
//        de recherche (« Filtres »), la calculette dans « ⋯ » ;
//    R10 deux achats au même titre et au même prix ne se ressemblent jamais (n° court + date et heure, src/achatDistinct.js) ;
//    F11 fiche (390) : « Prix d'achat » est une ligne d'Informations, au premier écran ; plus une puce à côté du prix ;
//    F12 fiche : vues et favoris une seule fois (pas de ligne « intérêt » quand « Sur les sites » est là) ;
//    A13 Annonces (1512) : la barre de sélection porte les actions courantes en boutons directs ; ni « Lancer », ni second
//        menu « Choisir une action » en haut ;
//    C22 Annonces (1512) : le nombre de chaque groupe = ses lignes affichées (leur somme = « N annonces » en tête) ;
//    T14 toast des N° : absent quand la carte d'Aujourd'hui le dit (main l'a déjà fait, style-clarte-4 : ce contrôle le garde) ;
//    G15 Argent (390) : reçu pas calculé ⇒ UNE ligne ambre qui se touche, pas de graphique de six mois vides, pas de seconde
//        ligne « Pas encore calculé » au-dessus ;
//    E16 le panneau de l'extension : UN verdict en tête (jamais « Lecture seule » quand l'extension vit ailleurs) ;
//    S30 Stock : l'onglet des paires n'écrit pas « ≥ » ;  N20 la pastille de la cloche : la même couleur clair et sombre ;
//    M   Aujourd'hui (390) : 5 annonces disparues d'un compte ⇒ UNE ligne compacte (photos empilées) ; un toucher ouvre une
//        feuille : la phrase commune, les 5 annonces avec LEUR photo (par identité), « Ouvrir mes messages Vinted » ; aucun orange ;
//    plus les captures Notifications et E-mails (390 et 1512, clair et sombre), à REGARDER.
//  `BANC_DIST=<dist d'avant>` : rouge. `SHOTS=…` les captures.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const { pathToFileURL } = require('url');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-revue-ux');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); } return c; };
const pret = async (pg) => { await pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {}); await pg.waitForTimeout(5500); };
const VIS = `const vis = (x) => !!x && x.getClientRects().length > 0 && getComputedStyle(x).visibility !== 'hidden' && !x.closest('[hidden]');`;

async function achats(nav, b) {
  const { ctx, pg, erreurs } = await ouvrir(nav, { W: 390, sombre: false, b, url: '/?tab=achats' });
  try {
    await pret(pg);
    await pg.waitForSelector('.vrm-buy-list .vrm-buy-row', { timeout: 15000 }).catch(() => {});
    await pg.waitForTimeout(1500);
    const m = await pg.evaluate(new Function(`${VIS}
      for (const c of document.querySelectorAll('.vrm-main')) c.scrollTop = 0; scrollTo(0, 0);
      const liste = [...document.querySelectorAll('.vrm-achats .vrm-buy-list')].find((l) => l.querySelector('.vrm-buy-row') && vis(l));
      const prem = liste && [...liste.querySelectorAll('.vrm-buy-row')].find(vis);
      const dessus = (sel) => [...document.querySelectorAll(sel)].filter((x) => vis(x) && !x.closest('[data-achats-plus-gestes], .vrm-achats-outils') && (!prem || x.getBoundingClientRect().top < prem.getBoundingClientRect().top)).length;
      const barre = document.querySelector('.vrm-achats-filtres');
      const boutons = barre ? [...barre.querySelectorAll('button')].filter((x) => vis(x) && !x.closest('label')).map((x) => (x.innerText || x.getAttribute('aria-label') || '').trim()) : [];
      const modif = [...document.querySelectorAll('.vrm-achats [data-carte-modifier]')].find(vis);
      return { prem: prem ? Math.round(prem.getBoundingClientRect().top) : null, vh: innerHeight, rienARetirer: dessus('[data-rp-vide]'), detail: dessus('[data-v2-detail-retraits]'), relier: dessus('[data-glisser-ouvrir]'),
        sansPoint: dessus('[data-rp-sans-point]'), boutons, calc: barre ? [...barre.querySelectorAll('[data-achats-calculette]')].filter(vis).length : 0, modif: modif ? modif.innerText.trim() : null };`));
    dit(m.prem != null && m.prem <= m.vh / 2, `A7 390 : la 1re rangée d'achat au premier écran, à mi-hauteur au plus (${m.prem} ≤ ${m.vh / 2})`, m.prem);
    dit(!m.rienARetirer && !m.detail && !m.relier, `A7 390 : ni « Rien à retirer », ni « Tout le détail des retraits », ni « Relier achats et ventes » au-dessus de la liste`, m);
    dit(!m.sansPoint, `A8 390 : « En route · point pas encore dit » ne redit pas « En route » de la bande`, m.sansPoint);
    dit(m.modif && !/^Modifier$/i.test(m.modif), `A9 390 : le bouton de la bande dit ce qu'il change (« ${m.modif} »)`, m.modif);
    dit(m.boutons.length === 1 && !m.calc && m.boutons.every((t) => t && /[a-zà-ü]{3,}/i.test(t)), `A9 390 : UN bouton nommé à côté de la recherche (${m.boutons.join(' | ')})`, m);
    await pg.screenshot({ path: path.join(SHOTS, 'achats-390.png') });
    // « ⋯ » porte les gestes rares.
    await pg.locator('[data-achats-plus]').first().click({ timeout: 5000 }).catch(() => {});
    await pg.waitForTimeout(700);
    const g = await pg.evaluate(new Function(`${VIS} const z = document.querySelector('[data-achats-plus-gestes]'); return z && vis(z) ? { relier: !!z.querySelector('[data-glisser-ouvrir]'), detail: !!z.querySelector('[data-achats-detail-retraits]'), calc: !!z.querySelector('[data-achats-calculette]') } : null;`));
    dit(!!g && g.relier && g.detail && g.calc, 'A7 390 : « ⋯ » porte Relier achats et ventes, le détail des retraits, la calculette', g);
    await pg.screenshot({ path: path.join(SHOTS, 'achats-plus-390.png') });
    dit(!erreurs.length, 'Achats 390 : aucune erreur d\'app', erreurs.join(' | '));
  } finally { await ctx.close(); }
}

async function annonces(nav, b) {
  const { ctx, pg, erreurs } = await ouvrir(nav, { W: 1512, sombre: false, b, url: '/?tab=cat_annonces' });
  try {
    await pret(pg);
    await pg.waitForSelector('tr[data-tt-ligne]', { timeout: 15000 }).catch(() => {});
    const c = await pg.evaluate(new Function(`${VIS}
      const n = Number((document.querySelector('[data-tt-nombre]') || { getAttribute: () => NaN }).getAttribute('data-tt-nombre'));
      const g = [...document.querySelectorAll('[data-eg-groupe-n]')].filter(vis).map((x) => Number(x.getAttribute('data-eg-groupe-n')));
      const vieux = [...document.querySelectorAll('.n-tt-intertitre-n')].filter(vis).map((x) => x.innerText);
      return { n, g, vieux, haut: [...document.querySelectorAll('[data-tt-outils] [data-tt-ouvre="action"]')].filter(vis).length };`));
    dit(Number.isFinite(c.n) && c.g.length > 0 && c.g.reduce((a, x) => a + x, 0) === c.n, `C22 1512 : le nombre de chaque groupe = ses lignes affichées (somme ${c.g.join('+')} = ${c.n})`, c);
    dit(c.haut === 0, 'A13 1512 : plus de menu « Choisir une action » en haut du tableau', c.haut);
    await pg.locator('tr[data-tt-ligne] .n-tt-cible-case').first().click({ timeout: 5000 }).catch(() => {});
    await pg.waitForTimeout(700);
    const s = await pg.evaluate(new Function(`${VIS} const b = document.querySelector('[data-tt-barre-sel]'); if (!b) return null;
      return { directes: [...b.querySelectorAll('[data-tt-action-directe]')].filter(vis).map((x) => x.getAttribute('data-tt-action-directe')), lancer: [...b.querySelectorAll('[data-tt-lancer]')].filter(vis).length };`));
    dit(!!s && s.directes.length >= 2 && s.lancer === 0, `A13 1512 : actions directes dans la barre de sélection (${s && s.directes.join(', ')}), plus de « Lancer »`, s);
    await pg.screenshot({ path: path.join(SHOTS, 'annonces-selection-1512.png') });
    dit(!erreurs.length, 'Annonces 1512 : aucune erreur d\'app', erreurs.join(' | '));
  } finally { await ctx.close(); }
}

async function journee(nav, b) {
  const b2 = JSON.parse(JSON.stringify(b));
  b2.main[0].data.vrm_numeros_a_ecrire = { v: 1, items: [{ numero: '301' }, { numero: '302' }, { numero: '303' }] };
  const { ctx, pg, erreurs } = await ouvrir(nav, { W: 390, sombre: false, b: b2, url: '/?tab=journee' });
  try {
    await pret(pg);
    const carte = await pg.evaluate(new Function(`${VIS} return [...document.querySelectorAll('[data-numeros-a-ecrire-journee]')].some(vis);`));
    await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:numeros-donnes', { detail: { message: '3 nouvelles paires numérotées · N° 301, 302, 303' } })));
    await pg.waitForTimeout(600);
    const toast = await pg.evaluate(new Function(`${VIS} return [...document.querySelectorAll('[data-toast-numeros] .n-toast, .n-place-bas .n-toast')].some(vis);`));
    dit(carte && !toast, 'T14 390 : la carte d\'Aujourd\'hui dit les N° neufs ⇒ pas de toast en plus', { carte, toast });
    await pg.screenshot({ path: path.join(SHOTS, 'journee-390.png') });
    // F11 / F12 : la fiche d'une paire.
    await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: '1' })));
    await pg.waitForTimeout(2500);
    const f = await pg.evaluate(new Function(`${VIS} const fi = [...document.querySelectorAll('[data-fiche-paire]')].find(vis); if (!fi) return null;
      const l = fi.querySelector('[data-nf-infos] [data-nf-ligne-prix="achat"]'); const r = l ? l.getBoundingClientRect() : null;
      return { ligne: !!l && vis(l), bas: r ? Math.round(r.bottom) : null, vh: innerHeight, puce: !!fi.querySelector('.nf-pastilles [data-fd-fait="achat"], .nf-pastilles [data-fd-fait="mini"]'),
        interet: !!fi.querySelector('[data-nf-infos] [data-fd-fait="interet"]'), sites: !!fi.querySelector('[data-fd-sites]') };`));
    dit(!!f && f.ligne && !f.puce, 'F11 390 : « Prix d\'achat » est une ligne d\'Informations (plus une puce à côté du prix)', f);
    dit(!!f && f.bas != null && f.bas <= f.vh, `F11 390 : la ligne « Prix d'achat » au premier écran (bas ${f && f.bas} ≤ ${f && f.vh})`, f);
    dit(!!f && (!f.sites || !f.interet), 'F12 390 : vues et favoris une seule fois (« Sur les sites »), pas de ligne « intérêt » dans Informations', f);
    await pg.screenshot({ path: path.join(SHOTS, 'fiche-390.png') });
    await pg.screenshot({ path: path.join(SHOTS, 'fiche-390-plein.png'), fullPage: true });
    dit(!erreurs.length, 'Aujourd\'hui 390 : aucune erreur d\'app', erreurs.join(' | '));
  } finally { await ctx.close(); }
}

async function argent(nav, b, W) {
  const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre: false, b, url: '/?tab=argent' });
  try {
    await pret(pg);
    const a = await pg.evaluate(new Function(`${VIS} const c = [...document.querySelectorAll('[data-v2-argent-recu]')].find(vis); if (!c) return null;
      return { recu: c.getAttribute('data-v2-argent-recu'), geste: [...c.querySelectorAll('[data-arg-recu-geste]')].filter(vis).length, mois: [...c.querySelectorAll('[data-arg-mois]')].filter(vis).length,
        mValeurs: [...c.querySelectorAll('[data-arg-m6-v]')].filter((x) => x.getAttribute('data-arg-m6-v')).length, enHaut: [...document.querySelectorAll('[data-compta-pas-calcule]')].filter(vis).length,
        colsVides: (document.querySelector('[data-arg-cols-vides]') || { getAttribute: () => '' }).getAttribute('data-arg-cols-vides'),
        thAchat: [...document.querySelectorAll('.n-arg-vt-th .n-arg-vt-achat')].filter(vis).length, achats: [...document.querySelectorAll('[data-v2-argent-achat]')].length, lignes: [...document.querySelectorAll('[data-v2-argent-versement]')].length };`));
    if (a && a.recu === '') {
      dit(a.geste === 1 && a.enHaut === 0, `G15 ${W} : reçu pas calculé ⇒ UNE ligne ambre qui se touche (pas de seconde « Pas encore calculé »)`, a);
      dit(a.mois === 0 || a.mValeurs > 0, `G15 ${W} : pas de graphique de six mois vides`, a);
    } else dit(!!a, `G15 ${W} : la carte du reçu est rendue`, a);
    if (W >= 1024 && a && a.lignes > 0 && a.achats === 0) dit(a.thAchat === 0 && /achat/.test(a.colsVides || ''), `G15 ${W} : la colonne « Achat » vide à 100 % n'est pas dessinée`, a);
    await pg.screenshot({ path: path.join(SHOTS, `argent-${W}.png`) });
    await pg.screenshot({ path: path.join(SHOTS, `argent-${W}-plein.png`), fullPage: true });
    dit(!erreurs.length, `Argent ${W} : aucune erreur d'app`, erreurs.join(' | '));
  } finally { await ctx.close(); }
}

async function extension(nav, b) {
  const { ctx, pg, erreurs } = await ouvrir(nav, { W: 1512, sombre: false, b, url: '/?tab=journee' });
  try {
    await pret(pg);
    await pg.evaluate(() => window.dispatchEvent(new Event('vrm:etat-actions-ouvrir')));
    await pg.waitForTimeout(1500);
    const e = await pg.evaluate(new Function(`${VIS} const p = [...document.querySelectorAll('[data-etat-panneau]')].find(vis); if (!p) return null; const t = p.querySelector('.vrm-etat-titre');
      return { niveau: p.getAttribute('data-etat-panneau'), verdict: t ? t.getAttribute('data-etat-verdict') : null, titre: t ? t.innerText.trim() : '' };`));
    dit(!!e && (e.niveau !== 'lecture' || (e.verdict && e.verdict !== 'lecture' && !/Lecture seule/.test(e.titre))), `E16 1512 : UN verdict en tête du panneau de l'extension (« ${e && e.titre} »)`, e);
    await pg.screenshot({ path: path.join(SHOTS, 'extension-panneau-1512.png') });
    dit(!erreurs.length, 'Panneau extension : aucune erreur d\'app', erreurs.join(' | '));
  } finally { await ctx.close(); }
}

async function stockEtCloche(nav, b) {
  const couleurs = [];
  for (const sombre of [false, true]) {
    const { ctx, pg, erreurs } = await ouvrir(nav, { W: 390, sombre, b, url: '/?tab=garage' });
    try {
      await pret(pg);
      if (!sombre) {
        const n = await pg.evaluate(new Function(`${VIS} return [...document.querySelectorAll('.n-segmente-n')].filter(vis).map((x) => x.innerText);`));
        dit(n.length > 0 && !n.some((t) => /≥/.test(t)), `S30 390 : l'onglet des paires n'écrit pas « ≥ » (${n.join(' | ')})`, n);
        await pg.screenshot({ path: path.join(SHOTS, 'stock-390.png') });
      }
      couleurs.push(await pg.evaluate(new Function(`${VIS} const x = [...document.querySelectorAll('.vrm-cn-cloche .vrm-cn-pastille')].find(vis); return x ? getComputedStyle(x).backgroundColor : null;`)));
      dit(!erreurs.length, `Stock 390${sombre ? ' sombre' : ''} : aucune erreur d'app`, erreurs.join(' | '));
    } finally { await ctx.close(); }
  }
  dit(couleurs[0] && couleurs[0] === couleurs[1], `N20 390 : la pastille de la cloche a la même couleur en clair et en sombre (${couleurs.join(' / ')})`, couleurs);
}

async function notifsEtEmails(nav, b) {
  for (const W of [390, 1512]) for (const sombre of [false, true]) {
    const suf = `${W}${sombre ? '-sombre' : ''}`;
    let { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre, b, url: '/?tab=journee' });
    try {
      await pret(pg);
      await pg.locator('[data-centre-notifs-cloche]').first().click({ timeout: 5000 }).catch(() => {});
      await pg.waitForTimeout(1500);
      await pg.screenshot({ path: path.join(SHOTS, `notifications-${suf}.png`) });
      dit(!erreurs.length, `Notifications ${suf} : capturée, aucune erreur d'app`, erreurs.join(' | '));
    } finally { await ctx.close(); }
    ({ ctx, pg, erreurs } = await ouvrir(nav, { W, sombre, b, url: '/?tab=emails' }));
    try {
      await pret(pg);
      await pg.screenshot({ path: path.join(SHOTS, `emails-${suf}.png`) });
      dit(!erreurs.length, `E-mails ${suf} : capturé, aucune erreur d'app`, erreurs.join(' | '));
    } finally { await ctx.close(); }
  }
}

async function moderation(nav, b) {
  const b2 = JSON.parse(JSON.stringify(b));
  const uid = String(b2.accounts[0].vinted_user_id);
  const fiches = b2.main[0].data.vinted_annonce_numeros;
  const ids = Object.keys(fiches).slice(0, 5);
  ids.forEach((id, i) => { fiches[id] = { ...fiches[id], accountId: uid, title: `Nike dunk banc ${i + 1}`, price: { amount: String(40 + i * 5) }, photo: `https://images1.vinted.net/t/banc-disparue-${i}.jpg`, numero: fiches[id].num || String(130 + i) }; });
  const t = Date.now() - 3600e3;
  b2.rows.push({ id: 'moderation_vinted_' + uid, data: { e: ids.map((id, i) => ({ k: 'd' + id, s: 'disparue', t: t + i * 1000, av: t - 2 * 864e5, a: id })) } });
  const { ctx, pg, erreurs } = await ouvrir(nav, { W: 390, sombre: false, b: b2, url: '/?tab=journee' });
  try {
    await pret(pg);
    await pg.waitForTimeout(1500);
    const orange = `const orange = (c) => { const m = String(c).match(/\d+(\.\d+)?/g); if (!m || m.length < 3) return false; const [r, g, bb] = m.map(Number); if (m.length > 3 && Number(m[3]) === 0) return false; const mx = Math.max(r, g, bb), mn = Math.min(r, g, bb); if (mx - mn < 60) return false; let h; if (mx === r) h = 60 * (((g - bb) / (mx - mn)) % 6); else if (mx === g) h = 60 * ((bb - r) / (mx - mn) + 2); else h = 60 * ((r - g) / (mx - mn) + 4); if (h < 0) h += 360; return h >= 15 && h <= 50; };`;
    const m = await pg.evaluate(new Function(`${VIS} ${orange}
      const zone = [...document.querySelectorAll('.vrm-moderation')].find(vis);
      const lignes = [...document.querySelectorAll('[data-moderation-disparues]')].filter(vis);
      const anciennes = [...document.querySelectorAll('.vrm-moderation-ligne[data-moderation-sorte="disparue"]')].filter(vis).length;
      const oranges = zone ? [zone, ...zone.querySelectorAll('*')].filter(vis).filter((x) => { const c = getComputedStyle(x); return orange(c.color) || orange(c.backgroundColor) || orange(c.borderLeftColor); }).length : -1;
      return { lignes: lignes.length, n: lignes[0] ? lignes[0].getAttribute('data-moderation-disparues') : null, anciennes, oranges, h: zone ? Math.round(zone.getBoundingClientRect().height) : null };`));
    dit(m.lignes === 1 && m.n === '5' && m.anciennes === 0 && m.h != null && m.h <= 90, `M 390 : 5 annonces disparues = UNE ligne compacte (${m.h} px), plus cinq blocs`, m);
    dit(m.oranges === 0, 'M 390 : aucun orange dans la carte des annonces disparues', m.oranges);
    await pg.screenshot({ path: path.join(SHOTS, 'moderation-ligne-390.png') });
    await pg.locator('[data-moderation-disparues]').first().click({ timeout: 5000 }).catch(() => {});
    await pg.waitForTimeout(1500);
    const f = await pg.evaluate(new Function(`${VIS} const fe = [...document.querySelectorAll('[data-moderation-feuille]')].find(vis); if (!fe) return null;
      const cases = [...fe.querySelectorAll('[data-moderation-case]')].filter(vis);
      return { cases: cases.length, photos: cases.filter((c) => c.getAttribute('data-moderation-photo') === '1' && c.querySelector('img')).length, phrase: !!fe.querySelector('[data-moderation-phrase]'),
        messages: (fe.querySelector('[data-moderation-geste="disparue"]') || { getAttribute: () => '' }).getAttribute('data-href') || ((fe.querySelector('[data-moderation-geste="disparue"]') || {}).href || ''), toutVu: !!fe.querySelector('[data-moderation-tout-vu]') };`));
    dit(!!f && f.cases === 5 && f.photos === 5 && f.phrase && /vinted\.fr\/inbox/.test(f.messages) && f.toutVu, 'M 390 : la feuille montre les 5 annonces avec leur photo, la phrase commune, « Ouvrir mes messages Vinted », « Tout est vu »', f);
    await pg.screenshot({ path: path.join(SHOTS, 'moderation-feuille-390.png') });
    dit(!erreurs.length, 'Modération 390 : aucune erreur d\'app', erreurs.join(' | '));
  } finally { await ctx.close(); }
}

async function distinct() {
  let D = null; try { D = await import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'achatDistinct.js')).href); } catch (_) {}
  const trois = [{ transaction_id: '22000000417', title: 'Nike achat 0', date: '2026-11-21T14:32:00+01:00' }, { transaction_id: '22000000418', title: 'Nike achat 0', date: '2026-11-21T14:32:00+01:00' }, { transaction_id: '22000009931', title: 'Nike achat 0', date: '2026-11-22T09:05:00+01:00' }];
  const m = D ? trois.map((a) => D.metaDistincte(a)) : [];
  dit(m.length === 3 && new Set(m).size === 3 && m.every((x) => /…\d{4}/.test(x) && /\d{2}:\d{2}/.test(x)), `R10 : trois « Nike achat 0 » au même prix se distinguent (${m.join(' | ')})`, m);
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = base();
  // Le journal des notifications (forme de centre-notifs.cjs) : 3 non lues ⇒ la pastille de la cloche, la feuille pleine.
  const ilYa = (min) => new Date(Date.now() - min * 60000).toISOString();
  b.rows.push({ id: 'push_journal', data: { n: 4, rev: 'r1', entrees: [
    { seq: 4, at: ilYa(12), famille: 'ventes', cat: 'vente', titre: 'Vendu !', texte: 'Baskets de banc taille 42 — 45 €', url: '/?tab=ventes', etat: 'envoyee' },
    { seq: 3, at: ilYa(95), famille: 'arrives', cat: 'colis', titre: 'Ton colis Mondial Relay t’attend', texte: 'Tabac du Quai · code 123456', url: '/?tab=achats', etat: 'calme' },
    { seq: 2, at: ilYa(160), famille: 'offres', cat: 'offre', titre: 'Offre 30 € de acheteur_banc', texte: 'Sur Sneakers de banc blanches', url: '/?tab=messages', etat: 'envoyee' },
    { seq: 1, at: ilYa(60 * 26), famille: 'ventes', cat: 'vente', titre: 'Vendu !', texte: 'Runner de banc 41 — 60 €', url: '/?tab=ventes', etat: 'envoyee' }] } });
  b.rows.push({ id: 'push_journal_lu', data: { luJusqua: 1, lus: [] } });
  try {
    await distinct();
    for (const [nom, f] of [['achats', () => achats(nav, b)], ['annonces', () => annonces(nav, b)], ['journee', () => journee(nav, b)], ['argent390', () => argent(nav, b, 390)], ['argent1512', () => argent(nav, b, 1512)],
      ['extension', () => extension(nav, b)], ['moderation', () => moderation(nav, b)], ['stock', () => stockEtCloche(nav, b)], ['captures', () => notifsEtEmails(nav, b)]]) {
      console.log('\n── ' + nom);
      try { await f(); } catch (e) { dit(false, `${nom} : le banc a pu se dérouler`, String(e && e.message || e)); }
    }
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} revue-ux : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
