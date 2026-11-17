require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  ARGENT ET PARAMÈTRES, NOUVEAU DESIGN (17 nov., phase 2) — src/designV2/ArgentMois.jsx, ArgentNav (App.jsx),
//  argent-v2.css, Reglages.jsx (liste groupée d'iOS). Réglage RÉEL `vrm_design_v2`.
//      npm run build && node scripts/bancs/design-v2-argent.cjs
//  Base INVENTÉE (le jeu de `nouveau-vendeur` + versements lus, micro-entrepreneur mensuel — le scénario B
//  d'argent.cjs). Tailles : 390 tactile sombre et clair, 1512 clair et sombre (`TAILLES=` restreint).
//  Mesure, par taille :
//    F  LES CHIFFRES, ÉTEINT = ALLUMÉ, sur la même base : REÇU (l'affiche = la case « Reçu » d'hier), le mois en
//       cours du graphe = l'affiche, BÉNÉFICE (la case d'hier, le net ou le brut), VENDU (« Comparer » de
//       Statistiques), URSSAF (à payer et chiffre d'affaires de la carte de Déclarer) ; le geste plein existe
//       SI ET SEULEMENT SI la porte « prix à saisir » d'hier existe, avec le même nombre ;
//    S  la structure : grand titre « Argent », UNE ligne comptes, UN segmenté de 4 (Mois · Statistiques ·
//       Déclarer · Factures), le segment allumé est le bon sur les quatre écrans ; l'affiche dit « reçus en » ;
//       graphe ≤ 80 px ; 4 faits ; versements en rangées, l'étiquette N° sur celles qui ont un N° ;
//    P  exactement UN bouton plein sur Mois quand il y a un geste, au plus un ailleurs ;
//    T  cibles ≥ 44 × 44 ; X aucun texte tronqué sans « … », rien ne déborde ; C contraste ≥ 4,5:1 (3:1 en grand) ;
//    R  Paramètres : sections à en-tête 13/600, rangées icône + nom + valeur + chevron ≥ 44, séparateurs indentés ;
//    O  ÉTEINT, RIEN NE CHANGE : signature DOM (balises, classes, noms des data-*) d'Argent (Mois, Déclarer),
//       Statistiques et Paramètres identique à celle du build de référence (`BANC_JSON=f` l'écrit ;
//       `BANC_REFERENCE=f` l'exige — lancer d'abord sur le build de origin/claude/design-v2).
//  `SHOTS=dossier` garde les captures (regarde-les). Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-design-v2-argent');
fs.mkdirSync(SHOTS, { recursive: true });
const TAILLES = String(process.env.TAILLES || '390:sombre,390:clair,1512:clair,1512:sombre').split(',').map((x) => { const [w, t] = x.split(':'); return { W: Number(w), sombre: t === 'sombre' }; });
const JSON_OUT = process.env.BANC_JSON || '';
const REF = process.env.BANC_REFERENCE ? JSON.parse(fs.readFileSync(process.env.BANC_REFERENCE, 'utf8')) : null;
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };

// ── LA BASE (le scénario B d'argent.cjs) ─────────────────────────────────────
const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString();
const txn = (uid, tx, jVerse) => ({ id: `harvest_${uid}_txn_${tx}`, data: { capturedAt: iso(0.01), payload: { transaction: { id: tx, item_id: tx + 500000, status: 450, status_title: 'Commande finalisée', status_updated_at: iso(jVerse) } } } });
const jeu = () => {
  const L = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  const v2 = L.find((r) => r.id === 'harvest_222_orders_sold');
  v2.data.payload.my_orders.push({ transaction_id: 62006, title: 'Asics Gel-1130 argent taille 42', price: { amount: '70', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(12), photo: null });
  L.push(txn(222, 62005, 6), txn(111, 62002, 4));
  const main = L.find((r) => r.id === 'main');
  main.data.vinted_regime = 'micro'; main.data.vinted_urssaf_freq = 'mensuel'; main.data.vrm_urssaf_declare = {};
  return { lignes: L, comptes: NV.JEU_COMPTES, ecritures: 0 };
};

const CONTRASTE = `(() => {
  const rgba = (t) => { t = String(t || ''); const m = t.match(/^rgba?\\(([^)]+)\\)$/); if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    try { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.clearRect(0, 0, 1, 1); x.fillStyle = t; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; } catch (_) { return null; } };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const sur = (h, b) => ({ r: h.r * h.a + b.r * (1 - h.a), g: h.g * h.a + b.g * (1 - h.a), b: h.b * h.a + b.b * (1 - h.a), a: 1 });
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const jeton = (v) => { const d = document.createElement('i'); d.style.color = 'var(' + v + ')'; document.body.appendChild(d); const c = rgba(getComputedStyle(d).color); d.remove(); return c; };
  const fond = (el) => { const couches = []; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { couches.push(c); if (c.a >= 0.99) break; } }
    const lum0 = (() => { const v = jeton('--sv-haut'); return v && v.a > 0 ? v : jeton('--sb-bas'); })(); let f = couches.length && couches[couches.length - 1].a >= 0.99 ? couches.pop() : lum0; for (let i = couches.length - 1; i >= 0; i--) f = sur(couches[i], f); return f; };
  return { rgba, sur, ratio, jeton, fond };
})()`;

// La signature d'un écran : balises, classes triées et NOMS des data-* (jamais les valeurs ni le texte : l'heure bouge).
const SIGNATURE = () => { const m = document.querySelector('.vrm-main'); if (!m) return null; const out = [];
  const pas = (e, d) => { if (d > 60 || e.matches('.vrm-fraicheur-hote, [data-temps-reel-neuf], [data-fraicheur-unique], [data-geste-disque], .vrm-toast')) return; const cl = [...e.classList].sort().join('.'); const da = [...e.attributes].map((a) => a.name).filter((n) => n.startsWith('data-') && !/^data-(sb-|vu$)/.test(n)).sort().join(',');
    out.push(d + ':' + e.tagName + (cl ? '.' + cl : '') + (da ? '[' + da + ']' : '')); for (const c of e.children) pas(c, d + 1); };
  pas(m, 0); return out.join('\n'); };

const aller = async (pg, q, attente = 3200) => {
  await pg.goto(`http://localhost:${NV.PORT}/?${q.includes('=') ? q : 'tab=' + q}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(attente);
  await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click(); }).catch(() => {});
  await pg.waitForTimeout(300);
};
const capture = async (pg, nom) => { await pg.evaluate(() => { window.scrollTo(0, 0); for (const e of document.querySelectorAll('.vrm-main, .vrm-main *')) if (e.scrollTop) e.scrollTop = 0; }); await pg.waitForTimeout(250); await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: false }); };
const allumer = (pg, on) => pg.evaluate((x) => { if (x) localStorage.setItem('vrm_design_v2', '1'); else localStorage.removeItem('vrm_design_v2'); }, on);

// Les chiffres d'hier (éteint) et ceux du nouvel écran (allumé), lus sur les data-* de LEURS règles.
const lireAvant = (pg) => pg.evaluate(() => {
  const at = (s, a) => { const e = document.querySelector(s); return e ? e.getAttribute(a) : null; };
  const brut = document.querySelector('[data-argent-q="benefice"] [data-benef-notion="brut"], [data-argent-q="benefice"] .vg-a-brut');
  return { recu: at('[data-argent-q="recu"]', 'data-argent-valeur'), recuPartiel: at('[data-argent-q="recu"]', 'data-argent-partiel') === '1',
    benefice: at('[data-argent-q="benefice"]', 'data-argent-valeur'), brut: brut ? brut.textContent.replace(/\s/g, '') : null,
    porte: at('[data-benef-porte]', 'data-benef-manque'), apayer: at('[data-prevision-carte]', 'data-prevision-apayer'), ca: at('[data-prevision-carte]', 'data-prevision-ca') };
});
const lireApres = (pg) => pg.evaluate(() => {
  const at = (s, a) => { const e = document.querySelector(s); return e ? e.getAttribute(a) : null; };
  const b = document.querySelector('[data-v2-argent-fait="benefice"]');
  return { recu: at('[data-v2-argent-recu]', 'data-v2-argent-recu'), recuPartiel: at('[data-v2-argent-recu]', 'data-v2-argent-partiel') === '1',
    barres: at('[data-v2-argent-barres]', 'data-v2-argent-barres'), benefice: b ? b.getAttribute('data-v2-argent-valeur') : null, beneficeTexte: b ? b.querySelector('.v2-ar-fait-v').textContent.replace(/\s/g, '') : null,
    geste: at('[data-v2-argent-geste]', 'data-v2-argent-geste'), apayer: at('[data-prevision-carte]', 'data-prevision-apayer'), ca: at('[data-prevision-carte]', 'data-prevision-ca') };
});
const lireVendu = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-comparer-ligne="vendu"]'); return e ? e.getAttribute('data-a') : null; });

// Les mesures communes d'un écran allumé, sur les zones du nouveau design.
async function mesurer(pg, nom, zonesSel) {
  const r = await pg.evaluate(([src, zonesSel]) => { const K = eval(src);
    const zones = [...document.querySelectorAll(zonesSel)];
    const vis = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]');
    const boutons = zones.flatMap((z) => z.matches('button') ? [z] : [...z.querySelectorAll('button')]).filter(vis);
    const petits = boutons.filter((b) => b.offsetHeight < 44 || b.offsetWidth < 44).map((b) => (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 30) + ':' + b.offsetWidth + 'x' + b.offsetHeight);
    const textes = zones.flatMap((z) => [z, ...z.querySelectorAll('*')]).filter(vis).filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    const tronques = textes.filter((e) => { const cs = getComputedStyle(e); return e.scrollWidth > e.clientWidth + 1 && cs.textOverflow !== 'ellipsis' && /hidden|clip/.test(cs.overflowX) && e.clientWidth > 0; }).map((e) => e.className + ':' + e.textContent.trim().slice(0, 30));
    const coupes = textes.filter((e) => { const cs = getComputedStyle(e); return cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1 && !e.closest('.v2-ar-v-titre, .v2-ar-v-date'); }).map((e) => e.textContent.trim().slice(0, 30));
    const W = innerWidth; const deb = document.documentElement.scrollWidth - W;
    const hors = textes.filter((e) => { const q = e.getBoundingClientRect(); return q.right > W + 1 || q.left < -1; }).map((e) => e.textContent.trim().slice(0, 30));
    const contrastes = textes.map((e) => { const cs = getComputedStyle(e); const c = K.rgba(cs.color); if (!c) return null; const f = K.fond(e); const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700);
      if (Number(cs.opacity) === 0) return null; return { t: e.textContent.trim().slice(0, 24), r: Math.round(K.ratio(K.sur(c, f), f) * 100) / 100, min: big ? 3 : 4.5 }; }).filter(Boolean);
    const faibles = contrastes.filter((x) => x.r < x.min);
    const pleins = [...document.querySelectorAll('[data-v2b="principal"], .sb-btn-plein, .vrm-main .vrm-btn-primaire, .vrm-main [data-variante="primaire"]')].filter(vis).filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.width > 0; }).map((e) => e.textContent.trim().slice(0, 30));
    return { nZones: zones.length, n: boutons.length, petits, tronques, coupes, deb, hors, nTextes: contrastes.length, faibles, pleins, minC: contrastes.length ? Math.min(...contrastes.map((x) => x.r)) : null };
  }, [CONTRASTE, zonesSel]);
  dit(r.nZones > 0, `${nom} : le nouveau design est rendu (${r.nZones} zones)`);
  dit(!r.petits.length, `T ${nom} : ${r.n} boutons, tous ≥ 44 × 44`, r.petits);
  dit(!r.tronques.length && !r.coupes.length, `X ${nom} : aucun texte tronqué`, { t: r.tronques, c: r.coupes });
  dit(r.deb <= 1 && !r.hors.length, `X ${nom} : rien ne déborde de l’écran`, { deb: r.deb, hors: r.hors });
  dit(r.nTextes > 0 && !r.faibles.length, `C ${nom} : ${r.nTextes} textes au contraste suffisant (min ${r.minC})`, r.faibles);
  return r;
}

const ZONES_ARGENT = '.v2-argent, .v2-argent-nav, .vrm-screen-head:has(.v2-argent-nav)';

(async () => {
  await new Promise((r) => NV.srv.listen(NV.PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const releve = {};
  try {
    for (const { W, sombre } of TAILLES) {
      const T = `${W} ${sombre ? 'sombre' : 'clair'}`, tel = W < 600, th = sombre ? 'sombre' : 'clair';
      console.log(`\n── ${T}`);
      const o = await NV.ouvrir(nav, { W, sombre, base: jeu(), tab: 'journee' });
      const pg = o.pg;
      try {
        // ── ÉTEINT : les chiffres d'hier et les signatures ──
        await allumer(pg, false);
        await aller(pg, 'cat_ventes', 4500);
        await aller(pg, 'dashboard', 3600);
        const venduAvant = await lireVendu(pg);
        const sigs = { stats: await pg.evaluate(SIGNATURE) };
        await aller(pg, 'compta', 3600);
        const avant = await lireAvant(pg);
        sigs.mois = await pg.evaluate(SIGNATURE);
        await aller(pg, 'argent_declarer', 3000); sigs.declarer = await pg.evaluate(SIGNATURE);
        await aller(pg, 'settings', 2500); sigs.settings = await pg.evaluate(SIGNATURE);
        releve[T] = sigs;
        if (REF && REF[T]) for (const k of Object.keys(REF[T])) {
          const a = String(REF[T][k] || '').split('\n'), b = String(sigs[k] || '').split('\n');
          const i = a.findIndex((x, j) => x !== b[j]);
          dit(REF[T][k] === sigs[k], `O ${T} ${k} : éteint, la signature DOM est celle de la référence (${b.length} nœuds)`, i < 0 ? `longueurs ${a.length}/${b.length}` : `1re différence au nœud ${i} : réf « ${a[i]} » / ici « ${b[i]} »`);
        }
        // ── ALLUMÉ ──
        await allumer(pg, true);
        await aller(pg, 'compta', 4200);
        const apres = await lireApres(pg);
        console.log('     avant', JSON.stringify(avant), '\n     après', JSON.stringify(apres));
        dit(avant.recu != null && apres.recu === avant.recu && apres.recuPartiel === avant.recuPartiel, `F ${T} : REÇU — l’affiche = la case « Reçu » d’hier (${avant.recu} c${avant.recuPartiel ? ', au moins' : ''})`, { avant: avant.recu, apres: apres.recu });
        dit(apres.barres != null && apres.barres.split(',').length === 6 && apres.barres.split(',')[5] === (apres.recu || ''), `F ${T} : le mois en cours du graphe = l’affiche (${apres.barres})`, apres.barres);
        dit(avant.benefice != null && (avant.benefice === '' ? (avant.brut ? apres.beneficeTexte === avant.brut : apres.benefice === '') : apres.benefice === avant.benefice), `F ${T} : BÉNÉFICE — le même que la case d’hier (${avant.benefice || avant.brut || '—'})`, { avant, apres });
        dit((avant.porte == null && apres.geste == null) || (avant.porte != null && apres.geste === avant.porte), `F ${T} : le geste plein existe si et seulement si la porte « prix à saisir » d’hier existe, au même nombre (${avant.porte} / ${apres.geste})`);
        const s = await pg.evaluate(() => {
          const vis = (e) => !!e && e.getClientRects().length > 0 && !e.closest('[hidden]');
          const h = [...document.querySelectorAll('.vrm-main h1, .vrm-main h2.vrm-display')].find(vis);
          const navs = [...document.querySelectorAll('.v2-argent-nav')].filter(vis);
          const segs = navs[0] ? [...navs[0].querySelectorAll('.vrm-seg-btn')].map((b) => ({ id: b.getAttribute('data-section'), on: b.getAttribute('aria-pressed') === 'true', l: b.textContent.trim() })) : [];
          const fig = document.querySelector('.v2-ar-barres'); const af = document.querySelector('.v2-ar-affiche');
          const vers = [...document.querySelectorAll('[data-v2-argent-versement]')].filter(vis);
          const txt = document.querySelector('.vrm-main').innerText;
          return { titre: h ? h.textContent.trim() : '', nNav: navs.length, comptes: navs[0] ? !!navs[0].querySelector('[data-v2-argent-comptes]') : false, segs, affiche: af ? af.textContent.replace(/\s+/g, ' ').trim() : '',
            afficheTaille: af ? parseFloat(getComputedStyle(af.querySelector('.v2-ar-nb')).fontSize) : 0, graphe: fig ? Math.round(fig.getBoundingClientRect().height) : null,
            faits: document.querySelectorAll('[data-v2-argent-fait]').length, vers: vers.length, versN: vers.filter((v) => v.querySelector('.v2-etiquette')).length,
            versNum: vers.filter((v) => v.tagName === 'BUTTON').length, ancienVisible: [...document.querySelectorAll('[data-argent-questions]')].some(vis),
            encaisse: /encaiss/i.test(txt), auMoins0: /au moins 0[,\s]*0?0?\s*€/i.test(txt), nan: /\bNaN\b|undefined|Invalid Date/.test(txt) };
        });
        console.log('     structure', JSON.stringify(s));
        dit(s.titre === 'Argent' && s.nNav === 1 && s.comptes, `S ${T} : « Argent », puis UNE ligne comptes`, s);
        dit(s.segs.length === 4 && s.segs.map((x) => x.l).join('·') === 'Mois·Statistiques·Déclarer·Factures' && s.segs.filter((x) => x.on).map((x) => x.id).join() === 'resume', `S ${T} : UN segmenté Mois · Statistiques · Déclarer · Factures, « Mois » allumé`, s.segs);
        dit(/reçus en/.test(s.affiche) && s.afficheTaille >= 56, `S ${T} : l’affiche « ${s.affiche} » en ${s.afficheTaille} px`, s.affiche);
        dit(s.graphe != null && s.graphe <= 80, `S ${T} : le graphe tient en ${s.graphe} px (≤ 80)`, s.graphe);
        dit(s.faits === 4, `S ${T} : 4 faits (disponible, en attente, bénéfice, coûts saisis)`, s.faits);
        dit(s.vers > 0 && s.versN === s.versNum, `S ${T} : ${s.vers} versements en rangées, l’étiquette N° sur les ${s.versN} qui ont un N°`, s);
        dit(!s.ancienVisible, `S ${T} : l’écran d’hier (les quatre réponses) n’est pas montré en double`);
        dit(!s.encaisse && !s.auMoins0 && !s.nan, `S ${T} : jamais « encaissé », jamais « au moins 0 », ni NaN`, s);
        const mm = await mesurer(pg, `Mois ${T}`, ZONES_ARGENT);
        dit(apres.geste != null ? mm.pleins.length === 1 : mm.pleins.length === 0, `P Mois ${T} : ${apres.geste != null ? 'exactement UN' : 'aucun'} bouton plein (${mm.pleins.join(' | ') || 'aucun'})`, mm.pleins);
        await capture(pg, `argent-mois-${W}-${th}`);
        if (tel) { await pg.evaluate(() => window.scrollTo(0, 560)); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(SHOTS, `argent-mois-bas-${W}-${th}.png`) }); }
        // Déclarer
        await aller(pg, 'argent_declarer', 3400);
        const dcl = await lireApres(pg);
        dit(avant.apayer != null && dcl.apayer === avant.apayer && dcl.ca === avant.ca, `F ${T} : URSSAF — à payer ${dcl.apayer} et chiffre d’affaires ${dcl.ca}, ceux d’hier`, { avant: [avant.apayer, avant.ca], apres: [dcl.apayer, dcl.ca] });
        const segD = await pg.evaluate(() => { const b = document.querySelector('.v2-argent-nav [aria-pressed="true"]'); return b ? b.getAttribute('data-section') : null; });
        dit(segD === 'declarer', `S ${T} : sur Déclarer, « Déclarer » allumé`, segD);
        const md = await mesurer(pg, `Déclarer ${T}`, ZONES_ARGENT);
        dit(md.pleins.length <= 1, `P Déclarer ${T} : au plus un bouton plein (${md.pleins.join(' | ') || 'aucun'})`, md.pleins);
        await capture(pg, `argent-declarer-${W}-${th}`);
        // Factures
        await aller(pg, 'invoices', 3000);
        const segF = await pg.evaluate(() => { const b = document.querySelector('.v2-argent-nav [aria-pressed="true"]'); return b ? b.getAttribute('data-section') : null; });
        dit(segF === 'factures', `S ${T} : sur Factures, « Factures » allumé`, segF);
        await mesurer(pg, `Factures ${T}`, ZONES_ARGENT);
        await capture(pg, `argent-factures-${W}-${th}`);
        // Statistiques
        await aller(pg, 'dashboard', 3600);
        const venduApres = await lireVendu(pg);
        dit(venduAvant != null && venduApres === venduAvant, `F ${T} : VENDU — « Comparer » de Statistiques identique (${venduAvant})`, { venduAvant, venduApres });
        const segS = await pg.evaluate(() => { const b = document.querySelector('.v2-argent-nav [aria-pressed="true"]'); return b ? b.getAttribute('data-section') : null; });
        dit(segS === 'stats', `S ${T} : sur Statistiques, « Statistiques » allumé`, segS);
        await mesurer(pg, `Statistiques ${T}`, ZONES_ARGENT);
        await capture(pg, `argent-stats-${W}-${th}`);
        // Paramètres (téléphone : le premier écran est la liste groupée)
        await aller(pg, 'settings', 2800);
        if (tel) {
          const pm = await pg.evaluate(() => {
            const r = document.querySelector('[data-v2-parametres]'); if (!r) return null;
            const hs = [...r.querySelectorAll('.v2-pm-h')].map((h) => ({ t: h.textContent.trim(), fs: parseFloat(getComputedStyle(h).fontSize), fw: Number(getComputedStyle(h).fontWeight) }));
            const rangs = [...r.querySelectorAll('.v2-pm-liste .vrm-set-ligne')];
            const sep = rangs.slice(1).map((x) => { const b = getComputedStyle(x, '::before'); return parseFloat(b.left); });
            return { hs, n: rangs.length, petits: rangs.filter((x) => x.offsetHeight < 44).length, ic: rangs.filter((x) => x.querySelector('.vrm-pm-cat-ic svg')).length, chev: rangs.filter((x) => x.querySelector('.vrm-set-chev')).length, val: rangs.filter((x) => x.querySelector('.vrm-set-val')).length, sep };
          });
          dit(pm && pm.hs.length >= 2 && pm.hs.every((h) => h.fs === 13 && h.fw === 600), `R ${T} : Paramètres en sections, en-têtes 13/600 (${pm ? pm.hs.map((h) => h.t).join(' · ') : '—'})`, pm);
          dit(pm && pm.n >= 6 && pm.petits === 0 && pm.ic === pm.n && pm.chev === pm.n, `R ${T} : ${pm ? pm.n : 0} rangées ≥ 44 px, chacune icône + nom + chevron (${pm ? pm.val : 0} avec leur valeur)`, pm);
          dit(pm && pm.sep.length && pm.sep.every((x) => x >= 40), `R ${T} : séparateurs indentés (à ${pm && pm.sep[0]} px)`, pm && pm.sep);
          await mesurer(pg, `Paramètres ${T}`, '[data-v2-parametres]');
          await capture(pg, `parametres-${W}-${th}`);
          // L'interrupteur « Nouveau design (essai) » : Apparence et langue → Apparence.
          const inter = await pg.evaluate(() => !!document.querySelector('[data-design-v2-bouton]'));
          dit(inter, `R ${T} : l’interrupteur « Nouveau design (essai) » est monté dans Paramètres`);
        } else await capture(pg, `parametres-${W}-${th}`);
        dit(!o.journal.erreurs.length, `${T} : aucune erreur JS`, o.journal.erreurs);
      } catch (e) { dit(false, `${T} : le banc a planté`, String(e && e.stack || e)); }
      await o.ctx.close();
    }
  } finally {
    if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(releve));
    await nav.close(); NV.srv.close();
    console.log(`\n${ok} ✅  ${ko} ❌   (captures : ${SHOTS})`);
    process.exit(ko ? 1 : 0);
  }
})();
