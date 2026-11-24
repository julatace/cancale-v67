require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';   // l'app telle qu'elle est servie (pas le DOM d'avant des vieux bancs)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  STYLE ET CLARTÉ (22 nov., docs/passation/2026-11-22-style-clarte.md) — ce que Julien a demandé, mesuré sur l'app RENDUE.
//    C1 Aujourd'hui : la carte héros (bénéfice du mois) + le graphique (7 barres par défaut, 30 au choix) + le trio ;
//    C2 aucune tuile n'écrit un LIEN comme valeur (« Ouvrir Ventes », « Compléter ») ;
//    C3 au téléphone, les cartes d'Aujourd'hui sont à 16 px du bord (plus le cadre qui doublait la marge : 32 px) ;
//    C4 l'accent est l'encre (décision du 22 nov.) : --n-accent rendu = rgb(22, 24, 29) (nuit : rgb(244, 244, 245)) ;
//    C5 une seule ligne « extension » sur Aujourd'hui quand rien ne tourne (pas le groupe « En direct » + un autre message) ;
//    C6 la feuille « Ton extension » : ≤ 520 px de large à l'ordinateur, les comptes en groupes (À relire / À jour / …),
//       chaque rangée garde ses data-fraicheur-* ;
//    C7 les actions rondes : Imprimer porte data-v2-principal (LE plein), chaque disque ≥ 44 × 44 au doigt ;
//    C8 rien ne déborde à 390 ni à 1512.
//  `BANC_DIST=<dist d'avant>` : rouge sur origin/main (C1, C2 si la base le montre, C3, C4, C5, C6, C7). `SHOTS=…` les captures.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-style-clarte');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };
const pret = async (pg) => { await pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {}); await pg.waitForTimeout(4500); };

async function journee(nav, b, W, sombre) {
  const t = `${W} ${sombre ? 'sombre' : 'clair'}`;
  const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre, b, url: '/?tab=journee' });
  try {
    await pret(pg);
    await pg.waitForSelector('[data-v2-bloc="pilotage"]', { timeout: 15000 }).catch(() => {});
    const m = await pg.evaluate(() => {
      const h = document.querySelector('[data-v2-bloc="pilotage"]');
      const tuiles = [...document.querySelectorAll('.n-tuile-valeur')].map((x) => x.textContent.trim());
      const cartes = [...document.querySelectorAll('.n-page-contenu .n-carte, .n-page-contenu .n-tuiles, .n-page-contenu .n-heros')].filter((x) => x.getClientRects().length).map((x) => Math.round(x.getBoundingClientRect().left));
      const acc = getComputedStyle(document.documentElement).getPropertyValue('--n-accent').trim();
      const sonde = document.createElement('span'); sonde.style.color = 'var(--n-accent)'; document.body.appendChild(sonde); const accRendu = getComputedStyle(sonde).color; sonde.remove();
      const direct = [...document.querySelectorAll('[data-direct-lieu="journee"]')];
      const enDirectTitre = direct.some((g) => /En direct/.test((g.querySelector('.n-groupe-titre') || { textContent: '' }).textContent));
      const imprimer = document.querySelector('.n-action-ronde[data-v2-principal]');
      const disques = [...document.querySelectorAll('.n-action-ronde')].map((x) => { const r = x.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
      return { heros: !!(h && h.matches('.n-heros')), barres: h ? h.querySelectorAll('[data-n-jour]').length : 0, trio: h ? h.querySelectorAll('.n-heros-trio-case').length : 0,
        tuiles, cartes, accRendu, acc, direct: direct.length, enDirectTitre, court: direct.some((g) => g.hasAttribute('data-direct-court')), imprimer: !!imprimer, disques,
        deborde: document.documentElement.scrollWidth - innerWidth };
    });
    dit(m.heros && m.barres === 7 && m.trio === 3, `C1 ${t} : la carte héros, 7 barres (fenêtre 7 j), le trio`, m);
    dit(!m.tuiles.some((x) => /^(Ouvrir Ventes|Compléter)$/i.test(x)), `C2 ${t} : aucune tuile n'écrit un lien comme valeur`, m.tuiles);
    if (W < 600) dit(m.cartes.length > 0 && m.cartes.every((x) => x >= 12 && x <= 20), `C3 ${t} : les cartes à 16 px du bord (pas 32)`, m.cartes);
    dit(m.accRendu === (sombre ? 'rgb(244, 244, 245)' : 'rgb(22, 24, 29)'), `C4 ${t} : l'accent est l'encre`, m.accRendu);
    dit(!m.enDirectTitre || !m.court, `C5 ${t} : « En direct » sans en-tête quand rien ne tourne (une ligne)`, m);
    // C5 bis (23 nov., style-clarte-3) « jamais une carte vide en tête » : sans action en cours, « En direct » n'est jamais une carte /
    // un groupe pleine largeur — rien (lecture, rien en cours) ou une PUCE de moins de 70 % de la largeur et de 48 px de haut au plus.
    const dx = await pg.evaluate(() => { const g = [...document.querySelectorAll('[data-direct-lieu="journee"]')]; const c = document.querySelector('.n-page-contenu') || document.body;
      const lc = c.getBoundingClientRect().width;
      return g.map((x) => { const r = x.getBoundingClientRect(); const code = x.getAttribute('data-direct'); const vis = x.getClientRects().length > 0;
        const enfant = x.querySelector('button, .n-rangee'); const re = enfant ? enfant.getBoundingClientRect() : r;
        return { code, vis, carte: x.matches('.n-groupe, .n-carte') || !!x.querySelector('.n-groupe-liste, .n-carte-corps'), w: Math.round(re.width), h: Math.round(re.height), lc: Math.round(lc) }; }); });
    dit(dx.length >= 1 && dx.every((d) => ['action', 'verification', 'arret', 'pause', 'muette'].includes(d.code) || !d.vis || (!d.carte && d.w <= d.lc * 0.8 && d.h <= 48)), `C5 bis ${t} : « En direct » rien ou une puce (pas de carte pleine largeur)`, dx);
    dit(m.imprimer && m.disques.length >= 3 && m.disques.every(([w, h]) => w >= 44 && h >= 44), `C7 ${t} : Imprimer = le plein des disques ; chaque disque ≥ 44`, m.disques);
    dit(m.deborde <= 1, `C8 ${t} : rien ne déborde`, m.deborde);
    await pg.screenshot({ path: path.join(SHOTS, `journee-${W}-${sombre ? 'sombre' : 'clair'}.png`) });
    // C13 (23 nov.) les actions rondes : Publier et Relier (les parcours existants), aucun libellé qui en touche un autre, cibles ≥ 44.
    const ar = await pg.evaluate(() => { const L = [...document.querySelectorAll('.n-action-ronde')].filter((x) => x.getClientRects().length);
      const txt = L.map((x) => { const l = x.querySelector('.n-action-ronde-libelle'); const r = document.createRange(); r.selectNodeContents(l); const q = r.getBoundingClientRect(); const o = l.getBoundingClientRect();
        return { l: Math.max(q.left, o.left), r: Math.min(q.right, o.right), coupe: l.scrollWidth > l.clientWidth + 1 }; });
      let touche = 0; for (let i = 1; i < txt.length; i++) if (txt[i].l - txt[i - 1].r < 4) touche++;
      return { cles: L.map((x) => x.hasAttribute('data-v2-publier') ? 'publier' : x.hasAttribute('data-v2-relier') ? 'relier' : x.hasAttribute('data-v2-principal') || x.hasAttribute('data-v2-imprimer-rien') ? 'imprimer' : x.hasAttribute('data-v2-scanner') ? 'scanner' : 'autre'), touche, coupes: txt.filter((x) => x.coupe).length,
        cibles: L.map((x) => { const r = x.getBoundingClientRect(); return Math.min(Math.round(r.width), Math.round(r.height)); }) }; });
    dit(ar.cles.includes('publier') && ar.cles.includes('relier') && ar.touche === 0 && ar.coupes === 0 && ar.cibles.every((c) => c >= 44), `C13 ${t} : Publier et Relier, libellés séparés et entiers, cibles ≥ 44`, ar);
    // C15 (23 nov.) Publier ouvre LE parcours existant (choisir l'article), Relier ouvre la feuille « Relier achats et ventes » d'Achats.
    if (W >= 1024 && !sombre) {
      await pg.locator('[data-v2-publier]').first().click({ timeout: 5000 }).catch(() => {});
      const pub = await pg.waitForSelector('[data-publier-ailleurs]', { timeout: 8000 }).then(() => true).catch(() => false);
      await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(400);
      await pg.evaluate(() => { const v = document.querySelector('.vrm-ao-voile'); if (v) v.click(); });
      await pg.waitForTimeout(400);
      await pg.locator('[data-v2-relier]').first().click({ timeout: 5000 }).catch(() => {});
      const rel = await pg.waitForSelector('[data-relier-glisser]', { timeout: 20000 }).then(() => true).catch(() => false);
      dit(pub && rel, `C15 ${t} : Publier ouvre le parcours de publication, Relier la feuille « Relier achats et ventes »`, { pub, rel });
      await pg.screenshot({ path: path.join(SHOTS, `relier-${W}.png`) });
      await pg.goto(pg.url().replace(/\?.*$/, '') + '?tab=journee').catch(() => {}); await pret(pg);
    }
    // C14 (23 nov., style-clarte-4) Les N° neufs à écrire : une CARTE en ligne (sous les gestes, avant Colis), jamais un toast flottant ;
    // un message court se range DANS le flux au-dessus de la barre (téléphone) : aucun chiffre ni bouton recouvert.
    {
      const nn = await pg.evaluate(() => { const c = document.querySelector('[data-numeros-a-ecrire-journee]'); const a = document.querySelector('.n-actions-rondes'); const k = document.querySelector('[data-n-colis-duo]');
        const y = (e) => (e ? Math.round(e.getBoundingClientRect().top) : null);
        return { carte: !!c, n: c ? c.getAttribute('data-numeros-a-ecrire-journee') : null, ordre: c && a && k ? y(a) < y(c) && y(c) < y(k) : null, flotte: !!document.querySelector('[data-toast-numeros] .n-toast') }; });
      dit(nn.carte && nn.ordre && !nn.flotte, `C14 ${t} : les N° neufs = une carte en ligne entre les gestes et Colis, aucun toast flottant`, nn);
      await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:toast', { detail: { texte: 'Banc : un message court pour vérifier sa place, assez long pour tenir deux lignes au téléphone.' } })));
      await pg.waitForSelector('.vrm-toast', { timeout: 4000 }).catch(() => {});
      await pg.waitForTimeout(400);
      const to = await pg.evaluate(() => { const tt = document.querySelector('.vrm-toast'); if (!tt) return null; const r = tt.getBoundingClientRect();
        const coupe = (q) => Math.min(r.right, q.right) - Math.max(r.left, q.left) > 1 && Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > 1;
        // La part VISIBLE de chaque élément (coupée par le cadre qui défile, <main>) : un élément hors de la vue n'est pas « couvert ».
        const m = document.querySelector('.vrm-main'); const rm = m ? m.getBoundingClientRect() : { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
        const vue = (q) => ({ left: Math.max(q.left, rm.left), top: Math.max(q.top, rm.top), right: Math.min(q.right, rm.right), bottom: Math.min(q.bottom, rm.bottom) });
        const cibles = [...document.querySelectorAll('.n-cc-valeur, .n-heros-valeur, .n-heros-trio dd, .n-tuile-valeur, [data-chiffre], .vrm-main button, .vrm-main a')].filter((e) => e.getClientRects().length && !tt.contains(e));
        const sous = cibles.filter((e) => coupe(vue(e.getBoundingClientRect()))).map((e) => (e.textContent || '').trim().slice(0, 24));
        const barre = document.querySelector('[data-n-onglets]'); const rb = barre ? barre.getBoundingClientRect() : null;
        return { sous, place: (tt.closest('[data-toasts-place]') || { getAttribute: () => '' }).getAttribute('data-toasts-place'), auDessus: !rb || r.bottom <= rb.top + 1 }; });
      dit(to && to.sous.length === 0 && to.auDessus, `C14 ${t} : un message court ne couvre aucun chiffre ni bouton, au-dessus de la barre`, to);
      await pg.screenshot({ path: path.join(SHOTS, `toast-${W}-${sombre ? 'sombre' : 'clair'}.png`) });
      await pg.evaluate(() => { const b = document.querySelector('.vrm-toast'); if (b) b.click(); });
    }
    // 30 jours : 30 barres
    await pg.locator('[data-v2-bloc="pilotage"] .n-segmente-choix').nth(1).click({ timeout: 5000 }).catch(() => {});
    await pg.waitForTimeout(500);
    const n30 = await pg.evaluate(() => { const h = document.querySelector('[data-v2-bloc="pilotage"]'); return h ? h.querySelectorAll('[data-n-jour]').length : 0; });
    dit(n30 === 30, `C1 ${t} : « 30 j » montre 30 jours`, n30);
    // C9 (22 nov. soir, maquettes) « Mois » : un point par jour écoulé du mois (au plus 30), la courbe en AIRE.
    await pg.locator('[data-v2-bloc="pilotage"] .n-segmente-choix').nth(2).click({ timeout: 5000 }).catch(() => {});
    await pg.waitForTimeout(500);
    const mo = await pg.evaluate(() => { const h = document.querySelector('[data-v2-bloc="pilotage"]'); return h ? { n: h.querySelectorAll('[data-n-jour]').length, aire: h.querySelectorAll('.n-graphe-aire, .n-graphe-courbe').length, f: h.getAttribute('data-pil-fenetre') } : null; });
    dit(mo && mo.f === 'mois' && mo.n === Math.min(30, new Date().getDate()) && mo.aire >= 1, `C9 ${t} : « Mois » = les jours du mois, en courbe`, mo);
    // C10 le pied du héros : Vendu · Reçu · À venir (chaque case porte sa source).
    const pied = await pg.evaluate(() => [...document.querySelectorAll('[data-v2-bloc="pilotage"] .n-heros-trio-case')].map((c) => (c.hasAttribute('data-pil-benef-fen') ? 'benef' : c.hasAttribute('data-pil-recu') ? 'recu' : c.hasAttribute('data-pil-avenir') ? 'avenir' : '?')).join(','));
    dit(pied === 'benef,recu,avenir', `C10 ${t} : le pied du héros = Bénéfice (la fenêtre) · Reçu · À venir (le vendu est le grand chiffre)`, pied);
    // C12 (23 nov.) le GRAND CHIFFRE suit la fenêtre : il vaut la somme des jours de la courbe (quand tous sont lus), en 7 j, 30 j et Mois.
    const suit = [];
    for (const k of [0, 1, 2]) {
      await pg.locator('[data-v2-bloc="pilotage"] .n-segmente-choix').nth(k).click({ timeout: 5000 }).catch(() => {});
      await pg.waitForTimeout(400);
      suit.push(await pg.evaluate(() => { const h = document.querySelector('[data-v2-bloc="pilotage"]'); if (!h) return null;
        const v = h.querySelector('.n-heros-valeur'); const txt = v ? v.textContent.replace(/[\s\u00a0\u202f]/g, '').replace('€', '').replace(/[^0-9,]/g, '').replace(',', '.') : '';
        return { f: h.getAttribute('data-pil-fenetre'), heros: txt === '' ? null : Math.round(Number(txt) * 100), somme: h.getAttribute('data-pil-somme'), vendu: h.getAttribute('data-pil-vendu') }; }));
    }
    dit(suit.every((x) => x && (x.somme === '' || String(x.heros) === x.somme) && String(x.heros) === x.vendu), `C12 ${t} : le grand chiffre = le vendu de la fenêtre choisie (7 j · 30 j · Mois), la somme de la courbe`, suit);
    // C11 Colis en deux cases côte à côte (à envoyer | à retirer), chacune ≥ 44 de haut ; à l'ordinateur l'en-tête porte relire + cloche.
    const cx = await pg.evaluate(() => { const c = [...document.querySelectorAll('[data-n-colis-duo] [data-v2-cj-ligne]')].map((x) => x.getBoundingClientRect());
      return { n: c.length, cote: c.length === 2 && Math.abs(c[0].top - c[1].top) < 2 && c[1].left > c[0].right - 2, h: c.map((r) => Math.round(r.height)),
        tete: !!document.querySelector('[data-tete-droite] [data-tete-relire]') && !!document.querySelector('[data-tete-droite] [data-tete-cloche]') }; });
    dit(cx.n === 2 && cx.cote && cx.h.every((h) => h >= 44), `C11 ${t} : Colis = deux cases côte à côte`, cx);
    if (W >= 1024) dit(cx.tete, `C11 ${t} : l'en-tête porte relire et la cloche`, cx);
    // La feuille d'état de l'extension
    await pg.evaluate(() => window.dispatchEvent(new Event('vrm:etat-actions-ouvrir')));
    await pg.waitForFunction(() => { const x = document.querySelector('[data-fraicheur-comptes]'); return x && x.getAttribute('data-fraicheur-comptes') !== 'encours'; }, null, { timeout: 10000 }).catch(() => {});
    const f = await pg.evaluate(() => {
      const p = document.querySelector('.vrm-etat-panneau'); if (!p) return null;
      const r = p.getBoundingClientRect();
      return { l: Math.round(r.width), groupes: [...p.querySelectorAll('[data-ec-groupe]')].map((g) => g.getAttribute('data-ec-groupe')), lignes: p.querySelectorAll('[data-fraicheur-compte][data-fraicheur-id][data-fraicheur-etat]').length,
        deborde: p.scrollWidth > p.clientWidth + 1 };
    });
    dit(f && (W < 600 || f.l <= 520) && f.groupes.length >= 1 && f.lignes >= 1 && !f.deborde, `C6 ${t} : la feuille « Ton extension » compacte, comptes en groupes`, f);
    await pg.screenshot({ path: path.join(SHOTS, `extension-${W}-${sombre ? 'sombre' : 'clair'}.png`) });
    dit(!erreurs.length, `${t} : aucune erreur d'app`, erreurs.join(' | '));
  } finally { await ctx.close(); }
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = base();
  try {
    for (const [W, s] of [[390, false], [390, true], [1512, false]]) { console.log(`\n── Aujourd'hui ${W} ${s ? 'sombre' : 'clair'}`); await journee(nav, b, W, s); }
  } catch (e) { ko++; console.log('  ❌ le banc a planté — ' + String(e && e.stack || e).slice(0, 400)); }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} style-clarte : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
