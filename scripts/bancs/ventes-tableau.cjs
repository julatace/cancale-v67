require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  VENTES EN TABLEAU DE TRAVAIL (20 nov. 2026) — l'écran RENDU, base INVENTÉE de volume (chaque transporteur représenté) et
//  base vide. Julien, sur sa capture de Ventes à l'ordinateur (liste étroite au centre, « AU MOINS 10 À ENVOYER · … · 1 À
//  DÉPOSER », « Imprimer » pâle désactivé, grand volet vide) : « j'aime pas ça du tout, je veux que tu fasses comme Vintex et
//  comme l'extension avec les transporteurs ». Référence : la page « Commandes » du panneau de l'extension 5.410.
//  Code : src/natif/ecrans/Ventes.jsx (VentesBureau), src/natif/TableauTravail.jsx, src/ventes/modeleVentes.js.
//
//  1512 × 950 et 1280 × 800 (ordinateur), 390 × 844 tactile ; clair ET sombre. Mesure :
//    T  ordinateur : un TABLEAU pleine largeur (≥ 85 % de la zone de contenu) ; colonnes N° · Prix · Date · Transporteur ·
//       Statut · Date limite ; UNE recherche ; aucune phrase-en-tête « À ENVOYER · … » ; aucun « à déposer » ;
//    L  chaque transporteur connu est dessiné par SON logo (data-marque), « — » quand il n'est pas lu ; la base en montre ≥ 8 ;
//    E  « À expédier » en étiquette AMBRE sur chaque ligne de « À envoyer » ; En route : étiquettes neutres ;
//    C  les cases sont le lot d'impression : cochées d'office là où le bordereau est prêt, jamais sans bordereau ;
//    P  « Imprimer N bordereaux » dans la barre d'outils, N = les cases cochées ; aucun bouton désactivé à sa place ;
//    S  « Statut ▾ » : la somme de ses compteurs = le nombre de lignes ; cocher un statut ⇒ « N ventes » = son compteur ;
//    V  aucun volet vide permanent : rien à droite avant le toucher ; toucher ⇒ le détail À DROITE, le tableau reste visible ;
//    N  les chiffres ne changent pas : segment « À envoyer N » = lignes = `data-vn-affiche` (la règle publiée) ;
//    K  contraste ≥ 4,5:1 de chaque texte, rien ne déborde, cibles 44 au doigt (téléphone) ;
//    M  téléphone : chaque rangée porte le logo de son transporteur (quand il est lu) et son étiquette d'état ; 1re rangée ≤ 340 px ;
//    Z  base vide : « Aucun colis à envoyer », aucun plein, aucune erreur.
//  `BANC_DIST=…` juge un autre build (le code d'avant : rouge attendu). `SHOTS=dossier` garde les captures (DSF 2).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-ventes-tableau');
fs.mkdirSync(SHOTS, { recursive: true });
const DSF = process.env.SHOTS ? 2 : 1;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARG = liste('VUES', '1512,1280,390').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : '')); } return c; };
const attendre = async (pg, f, ms = 30000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(f, arg).catch(() => false)) return true; await pg.waitForTimeout(300); } return false; };
const sansToasts = async (pg) => { await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click();
  for (const e of document.querySelectorAll('body *')) { if (getComputedStyle(e).position !== 'fixed' || !/paires? numérotées?/.test(e.textContent || '') || e.closest('.n-onglets, .vrm-tabbar')) continue;
    const f = [...e.querySelectorAll('button')].find((b) => /fermer|close|×/i.test((b.getAttribute('aria-label') || '') + b.textContent)); if (f) { f.click(); break; } } }).catch(() => {}); await pg.waitForTimeout(400); };

// La base : celle de design-passe (3 comptes, colis à envoyer, envois partis). Chaque bordereau e-mail INVENTÉ nomme un
// transporteur (le champ que la lecture des PDF pose, `transporteurPdf`), à tour de rôle ; un sur onze n'en nomme aucun (« — »).
const TRANSP = ['Mondial Relay', 'Vinted Go', 'Relais Colis', 'Chronopost', 'Colissimo', 'UPS', 'DPD', 'InPost', 'GLS', 'Chronopost Shop2Shop', ''];
function baseVentes() {
  const b = base();
  // Les ventes À ENVOYER d'abord (statut « needs_action »), chacune un transporteur à tour de rôle, puis les autres.
  const aEnv = new Set();
  for (const r of b.rows) if (/_orders_sold$/.test(r.id)) for (const o of ((r.data && r.data.payload && r.data.payload.my_orders) || [])) if (o.transaction_user_status === 'needs_action') aEnv.add(String(o.transaction_id));
  const bords = b.rows.filter((r) => /^email_bord_/.test(r.id) && r.data);
  const ordre = [...bords.filter((r) => aEnv.has(String(r.data.transaction))), ...bords.filter((r) => !aEnv.has(String(r.data.transaction)))];
  ordre.forEach((r, i) => { const t = TRANSP[i % TRANSP.length]; if (t) r.data.transporteurPdf = t; });
  return b;
}
function baseVide() {
  const bv = base(); for (const k of Object.keys(bv.main[0].data)) if (/^vinted_(sales|orders|transactions)|^harvest|^colis|^label_/.test(k)) delete bv.main[0].data[k];
  bv.rows = bv.rows.filter((x) => !/^(harvest_|label_|colis_|vinted_sales|tx_|email_bord_)/.test(x.id));
  return bv;
}

const CONTRASTE = fs.readFileSync(path.join(__dirname, 'natif-ventes.cjs'), 'utf8').match(/const CONTRASTE = `([\s\S]*?)`;/)[1].replace(/\\\\/g, '\\');

function mesure(src) {
  const K = eval(src);
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false; if (e.closest('[hidden], [aria-hidden="true"], .n-lu-seul, .v2-cache, .n-tt-sr, .vrm-sr-seul')) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const R = (e) => e.getBoundingClientRect();
  const dansVue = (e) => { const r = R(e); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const ecran = document.querySelector('[data-vn="ventes"]');
  const racines = [ecran, ...document.querySelectorAll('[data-vn-detail]')].filter(Boolean);
  const textes = racines.flatMap((z) => [...z.querySelectorAll('*')]).filter(vis).filter(dansVue).filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  const faibles = textes.map((e) => { const cs = getComputedStyle(e); const c = K.rgba(cs.color); if (!c) return null; const fz = parseFloat(cs.fontSize); const big = fz >= 24 || (fz >= 18.66 && Number(cs.fontWeight) >= 700);
    return { t: e.textContent.trim().slice(0, 30), r: Math.round(K.pire(c, e) * 100) / 100, min: big ? 3 : 4.5 }; }).filter((x) => x && x.r < x.min);
  const tactile = matchMedia('(pointer: coarse)').matches;
  const touchables = racines.flatMap((z) => [...z.querySelectorAll('button, a[href], [role=tab], label.n-rangee-case')]).filter(vis).filter(dansVue).filter((e) => !e.closest('.n-rangee-actions'));
  const petits = tactile ? touchables.map((e) => { const r = R(e); return { t: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((x) => x.w < 44 || x.h < 44) : [];
  const table = document.querySelector('[data-vn="ventes"] [data-tt-tableau]');
  const main = document.querySelector('.vrm-main') || document.body;
  const lignes = [...document.querySelectorAll('[data-vn="ventes"] [data-tt-ligne]')].filter(vis).map((l) => {
    const tdT = l.querySelector('[data-tt-col="transporteur"]');
    const et = l.querySelector('.n-tt-etiquette, .n-pastille');
    const c = l.querySelector('input.n-tt-coche, input.n-case');
    return { cle: l.getAttribute('data-tt-ligne'), bord: l.getAttribute('data-vn-bordereau'), statut: l.getAttribute('data-vt-statut'), trCle: l.getAttribute('data-vt-transporteur') || '',
      logo: (l.querySelector('[data-transporteur-logo][data-marque]') || { getAttribute: () => '' }).getAttribute('data-marque'),
      trTexte: tdT ? tdT.textContent.trim() : null, etiquette: et ? et.textContent.trim() : '', ton: et ? (et.getAttribute('data-tt-ton') || et.getAttribute('data-n-ton') || '') : '',
      coche: c ? (c.checked ? 1 : 0) : null, dispo: c ? !c.disabled : null, haut: Math.round(R(l).top), larg: Math.round(R(l).width), droite: Math.round(R(l).right) };
  });
  const rangsTel = [...document.querySelectorAll('[data-vn-liste] [data-vn-rang], [data-vn-liste] [data-vn-route]')].filter(vis).map((r) => ({
    cle: r.getAttribute('data-vn-rang') || r.getAttribute('data-vn-route'), logo: !!r.querySelector('.n-vt-logo [data-transporteur-logo]'), trCle: (r.querySelector('[data-vt-transporteur]') || { getAttribute: () => '' }).getAttribute('data-vt-transporteur'),
    etiquette: (r.querySelector('.n-vt-valeur .n-pastille') || { textContent: '' }).textContent.trim(), haut: Math.round(R(r).top), bas: Math.round(R(r).bottom),
    prix: !!(r.querySelector('.n-vt-valeur > span:not(.n-pastille)') || { textContent: '' }).textContent.trim(),
    sousCoupe: (() => { const x = r.querySelector('.n-rangee-sous-texte'); return !!x && x.scrollWidth > x.clientWidth + 1; })() }));
  const entetes = [...document.querySelectorAll('[data-vn="ventes"] [data-tt-th]')].map((t) => t.getAttribute('data-tt-th'));
  const plein = document.querySelector('[data-vn-plein]');
  const pleins = [...document.querySelectorAll('[data-n-variante="plein"], .sb-btn-plein')].filter(vis);
  const desactives = [...document.querySelectorAll('[data-vn="ventes"] button[disabled], [data-vn="ventes"] button[aria-disabled="true"]')].filter(vis).filter((b) => /imprimer/i.test(b.textContent));
  const recherches = [...document.querySelectorAll('input[type="search"], .vrm-barre-recherche input, [data-n-recherche] input')].filter(vis).length;
  const seg = [...document.querySelectorAll('[data-vn="ventes"] .n-segmente [role="tab"], [data-vn="ventes"] .n-segmente button, .n-vt-segment .n-segmente button, .n-vt-segment .n-segmente [role="tab"]')].filter(vis).map((b) => b.textContent.replace(/\s+/g, ' ').trim());
  const detail = [...document.querySelectorAll('[data-vn-detail], [data-n-coque-detail]')].filter(vis).map((d) => ({ cle: d.getAttribute('data-vn-detail'), gauche: Math.round(R(d).left), larg: Math.round(R(d).width), texte: d.textContent.replace(/\s+/g, ' ').slice(0, 80) }));
  const texte = ecran ? ecran.innerText : '';
  const segN = (i) => { const m = (seg[i] || '').match(/\d+/); return m ? Number(m[0]) : null; };
  return { faibles, petits, deb: document.documentElement.scrollWidth - innerWidth, table: table ? { larg: Math.round(R(table).width), gauche: Math.round(R(table).left) } : null, zone: Math.round(R(main).width),
    lignes, rangsTel, entetes, pleins: pleins.length, plein: plein ? { txt: plein.textContent.trim(), n: Number(plein.getAttribute('data-vn-plein')), vis: vis(plein) } : null, desactives: desactives.length, recherches, seg, segN0: segN(0), segN1: segN(1),
    affiche: ecran ? ecran.getAttribute('data-vn-affiche') : null, nombre: (document.querySelector('[data-vn="ventes"] [data-tt-nombre]') || { getAttribute: () => null }).getAttribute('data-tt-nombre'),
    detail, deposer: /à déposer/i.test(texte), teteAncienne: /sans bordereau ·|à envoyer ·/i.test(texte.toLowerCase()) && !!document.querySelector('[data-vn="ventes"] .n-groupe-tete'),
    vide: !!document.querySelector('[data-vn="ventes"] .n-vide'), texte: texte.replace(/\s+/g, ' ').slice(0, 300) };
}

async function ouvrirVentes(nav, { W, sombre, b }) {
  const { ctx, pg, erreurs } = await ouvrir(nav, { W: W < 600 ? 390 : 1512, sombre, b, url: '/?tab=ventes', dsf: DSF });
  if (W === 1280) await pg.setViewportSize({ width: 1280, height: 800 });
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
  await attendre(pg, () => !!document.querySelector('[data-vn="ventes"]') && (!!document.querySelector('[data-vn="ventes"] [data-tt-ligne], [data-vn-liste] [data-vn-rang]') || !!document.querySelector('[data-vn="ventes"] .n-vide')), 40000);
  await pg.waitForTimeout(1500); await sansToasts(pg);
  return { ctx, pg, erreurs };
}
const segment = async (pg, i) => {
  await pg.locator('[data-vn="ventes"] .n-segmente button, [data-vn="ventes"] .n-segmente [role="tab"], .n-vt-segment .n-segmente button, .n-vt-segment .n-segmente [role="tab"]').nth(i).click({ timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(1500);
};

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  const b = baseVentes();
  try {
    for (const W of LARG) for (const th of THEMES) {
      const sombre = th === 'sombre'; const tel = W < 600;
      console.log(`\n── Ventes · ${W} · ${th}`);
      const { ctx, pg, erreurs } = await ouvrirVentes(nav, { W, sombre, b });
      const m = await pg.evaluate(mesure, CONTRASTE);
      await pg.screenshot({ path: path.join(SHOTS, `ventes-${W}-${th}.png`) });
      dit(m.seg.length === 3 && m.segN0 != null && m.segN1 != null, 'segmenté À envoyer N · En route N · Terminées', m.seg);
      dit(!m.deposer, 'aucun « à déposer » sur l’écran');
      dit(!m.faibles.length, `contraste ≥ 4,5:1 (${m.faibles.length} faibles)`, m.faibles.slice(0, 6));
      dit(m.deb <= 1, `rien ne déborde (${m.deb})`);
      dit(!m.desactives, 'aucun bouton « Imprimer » désactivé');
      if (!tel) {
        dit(!!m.table && m.table.larg >= 0.85 * (m.zone - 48), `un tableau pleine largeur (${m.table && m.table.larg} / ${m.zone})`, m.texte);
        dit(['numero', 'prix', 'date', 'transporteur', 'statut', 'limite'].every((c) => m.entetes.includes(c)) && m.entetes.indexOf('statut') < m.entetes.indexOf('limite'), 'colonnes N° · Prix · Date · Transporteur · Statut · Date limite', m.entetes);
        dit(m.recherches === 1, `UNE recherche (${m.recherches})`);
        dit(!m.teteAncienne, 'plus de phrase-en-tête « … À ENVOYER · … SANS BORDEREAU »');
        dit(m.lignes.length > 0 && m.segN0 === m.lignes.length && String(m.segN0) === m.affiche && m.nombre === String(m.lignes.length), `les chiffres ne changent pas : segment ${m.segN0} = lignes ${m.lignes.length} = publié ${m.affiche}`);
        const marques = new Set(m.lignes.map((l) => l.logo).filter(Boolean));
        dit(m.lignes.every((l) => (l.trCle ? l.logo === l.trCle : l.trTexte === '—')), 'chaque transporteur lu a SON logo, « — » sinon', m.lignes.filter((l) => !(l.trCle ? l.logo === l.trCle : l.trTexte === '—')).slice(0, 4));
        dit(marques.size >= 8, `chaque transporteur représenté (${marques.size} logos : ${[...marques].join(', ')})`);
        dit(m.lignes.some((l) => !l.trCle), 'au moins une ligne sans transporteur lu (« — »)');
        dit(m.lignes.every((l) => /exp[ée]dier/i.test(l.etiquette) && l.ton === 'ambre'), '« À expédier » en étiquette ambre sur chaque ligne', m.lignes.slice(0, 3).map((l) => l.etiquette + ':' + l.ton));
        const r = m.lignes;
        dit(r.every((x) => x.coche !== null) && r.filter((x) => x.bord === 'attente').every((x) => !x.coche && !x.dispo) && r.some((x) => x.coche === 1), 'cases = le lot : cochées d’office là où le bordereau est prêt, jamais sans bordereau', r.filter((x) => x.bord === 'attente' && x.coche).map((x) => x.cle));
        const nC = r.filter((x) => x.coche === 1).length;
        dit(m.plein && m.plein.vis && m.plein.n === nC && new RegExp('Imprimer ' + nC + ' bordereau').test(m.plein.txt) && m.pleins === 1, `« Imprimer ${nC} bordereaux » dans la barre d’outils, UN plein (${m.plein && m.plein.txt} · ${m.pleins})`);
        dit(!m.detail.length, 'aucun volet de détail avant le toucher', m.detail);
        // Statut ▾ : ses compteurs.
        await pg.locator('[data-vn="ventes"] [data-tt-ouvre="statut"]').click({ timeout: 5000 }).catch(() => {});
        await pg.waitForTimeout(400);
        const cpt = await pg.evaluate(() => [...document.querySelectorAll('[data-tt-statuts] [data-tt-statut]')].map((x) => ({ cle: x.getAttribute('data-tt-statut'), n: Number((x.querySelector('[data-tt-n]') || { getAttribute: () => 0 }).getAttribute('data-tt-n')) })));
        await pg.screenshot({ path: path.join(SHOTS, `ventes-${W}-${th}-statut.png`) });
        dit(cpt.length >= 3 && cpt.reduce((a, x) => a + x.n, 0) === r.length, `« Statut ▾ » : compteurs dont la somme = ${r.length} (${cpt.map((x) => x.cle + ' ' + x.n).join(', ')})`);
        const un = cpt.find((x) => x.n > 0 && x.n < r.length);
        if (un) {
          await pg.locator(`[data-tt-statut="${un.cle}"] input`).click({ timeout: 4000 }).catch(() => {});
          await pg.waitForTimeout(400);
          const n = await pg.evaluate(() => (document.querySelector('[data-vn="ventes"] [data-tt-nombre]') || { getAttribute: () => '' }).getAttribute('data-tt-nombre'));
          dit(Number(n) === un.n, `cocher « ${un.cle} » ⇒ « ${n} ventes » = son compteur ${un.n}`);
          await pg.locator(`[data-tt-statut="${un.cle}"] input`).click({ timeout: 4000 }).catch(() => {});
        }
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
        // Toucher une ligne : le détail à droite, le tableau reste.
        const cle = r[1] ? r[1].cle : r[0].cle;
        await pg.locator(`[data-tt-ligne="${cle}"] [data-tt-col="article"]`).first().click({ timeout: 8000 }).catch(() => {});
        await attendre(pg, (c) => !!document.querySelector(`[data-vn-detail="${c}"]`), 8000, cle);
        await pg.waitForTimeout(500);
        const m2 = await pg.evaluate(mesure, CONTRASTE);
        await pg.screenshot({ path: path.join(SHOTS, `ventes-${W}-${th}-detail.png`) });
        const d = m2.detail.find((x) => x.cle === cle);
        const droiteT = m2.lignes.length ? Math.max(...m2.lignes.map((l) => l.droite)) : 0;
        // ≥ 1440 : le détail à CÔTÉ du tableau (rien caché) ; plus étroit : posé au bord droit, par-dessus, le tableau visible à gauche.
        if (W >= 1440) dit(!!d && d.gauche >= droiteT - 1 && m2.lignes.length > 5, `toucher ⇒ SON détail à droite, le tableau reste visible (${d && d.gauche} ≥ ${droiteT})`, m2.detail);
        else dit(!!d && Math.abs(d.gauche + d.larg - W) <= 2 && d.larg <= 0.45 * W && m2.lignes.length > 5, `toucher ⇒ SON détail posé au bord droit (${d && d.gauche}+${d && d.larg} / ${W}), le tableau reste visible`, m2.detail);
        dit(!m2.faibles.length, 'contraste avec le détail ouvert', m2.faibles.slice(0, 6));
        dit(m2.deb <= 1, `rien ne déborde avec le détail ouvert (${m2.deb})`);
        await pg.locator('[data-vt-fermer]').click({ timeout: 4000 }).catch(() => {});
        await pg.waitForTimeout(400);
        dit(!(await pg.evaluate(() => !!document.querySelector('[data-vn-detail]'))), 'le détail se ferme');
        // En route
        await segment(pg, 1);
        const m3 = await pg.evaluate(mesure, CONTRASTE);
        await pg.screenshot({ path: path.join(SHOTS, `route-${W}-${th}.png`) });
        dit(m3.lignes.length > 0 && m3.lignes.length === m.segN1, `En route : ${m3.lignes.length} lignes = segment ${m.segN1}`);
        dit(m3.lignes.every((l) => /route|livr|termin/i.test(l.etiquette) && l.ton === 'neutre'), 'En route : étiquettes « En route / Livrée / Terminée » neutres', m3.lignes.slice(0, 3).map((l) => l.etiquette + ':' + l.ton));
        dit(m3.lignes.every((l) => l.coche === null), 'En route : pas de cases (aucun geste en série)');
        dit(m3.pleins === 0 && !m3.faibles.length && m3.deb <= 1, `En route : aucun plein, contraste, rien ne déborde (${m3.pleins} · ${m3.faibles.length} · ${m3.deb})`, m3.faibles.slice(0, 4));
        dit(!m3.detail.length, 'En route : aucun volet vide');
        // Terminées
        await segment(pg, 2);
        await pg.waitForTimeout(1500);
        const m4 = await pg.evaluate(mesure, CONTRASTE);
        await pg.screenshot({ path: path.join(SHOTS, `terminees-${W}-${th}.png`) });
        dit(m4.recherches === 1 && m4.deb <= 1, `Terminées : une recherche, rien ne déborde (${m4.recherches} · ${m4.deb})`);
        dit(!m4.detail.length, 'Terminées : aucun volet vide');
        const seg4 = await pg.evaluate(() => { const e = document.querySelector('.n-vt-segment-seul'); if (!e) return 'absent'; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
          let x = e, cache = ''; while (x && x !== document.body) { const c = getComputedStyle(x); if (c.display === 'none' || c.visibility === 'hidden') { cache = x.className || x.tagName; break; } x = x.parentElement; } const regles = []; const voir = (L) => { for (const R of L) { if (R.cssRules && !R.selectorText) { try { voir(R.cssRules); } catch (_) {} continue; } try { if (R.selectorText && e.matches(R.selectorText) && /display:\s*none/.test(R.cssText)) regles.push(R.cssText.slice(0, 200)); } catch (_) {} } };
          for (const ss of document.styleSheets) { try { voir(ss.cssRules); } catch (_) {} }
          return { h: Math.round(r.height), top: Math.round(r.top), cache, regles, parent: e.parentElement && e.parentElement.outerHTML.slice(0, 200) }; });
        dit(m4.seg.length === 3, `Terminées : le segmenté reste là pour revenir (${m4.seg.join(' | ')})`, seg4);
      } else {
        const r = m.rangsTel;
        dit(r.length > 0, `la liste du téléphone est rendue (${r.length})`);
        dit(r.filter((x) => x.trCle).length >= 4 && r.every((x) => !x.trCle || x.logo), `logo du transporteur sur chaque rangée qui en a un (${r.filter((x) => x.logo).length}/${r.length})`);
        dit(r.every((x) => /exp[ée]dier/i.test(x.etiquette)), 'étiquette « À expédier » sur chaque rangée', r.slice(0, 3).map((x) => x.etiquette));
        dit(r[0] && r[0].haut <= 340, `1re rangée à ≤ 340 px (${r[0] && r[0].haut})`);
        dit(r.every((x) => x.prix), 'le prix reste sur chaque rangée');
        dit(r.every((x) => !x.sousCoupe), 'la ligne du N° et de la date limite n’est jamais coupée', r.filter((x) => x.sousCoupe).map((x) => x.cle).slice(0, 4));
        dit(r.every((x) => x.bas - x.haut <= 96), `rangées compactes (la plus haute : ${Math.max(...r.map((x) => x.bas - x.haut))} px)`);
        dit(!m.petits.length, 'cibles ≥ 44 × 44', m.petits.slice(0, 6));
        await segment(pg, 1);
        const m3 = await pg.evaluate(mesure, CONTRASTE);
        await pg.screenshot({ path: path.join(SHOTS, `route-${W}-${th}.png`) });
        dit(m3.rangsTel.length > 0 && m3.rangsTel.every((x) => /route|livr|termin/i.test(x.etiquette)), `En route : étiquette d’état sur chaque rangée (${m3.rangsTel.length})`, m3.rangsTel.slice(0, 3));
        dit(!m3.faibles.length && m3.deb <= 1, 'En route : contraste, rien ne déborde', m3.faibles.slice(0, 4));
        await segment(pg, 2);
        const m4 = await pg.evaluate(mesure, CONTRASTE);
        await pg.screenshot({ path: path.join(SHOTS, `terminees-${W}-${th}.png`) });
        dit(m4.seg.length === 3, `Terminées : le segmenté reste là pour revenir (${m4.seg.join(' | ')})`);
      }
      dit(!erreurs.length, 'aucune erreur de page', erreurs.slice(0, 3));
      await ctx.close();
    }
    for (const W of LARG.filter((w) => w === 1512 || w === 390)) for (const th of THEMES.slice(0, 1)) {
      console.log(`\n── Ventes · base vide · ${W} · ${th}`);
      const { ctx, pg, erreurs } = await ouvrirVentes(nav, { W, sombre: th === 'sombre', b: baseVide() });
      const m = await pg.evaluate(mesure, CONTRASTE);
      await pg.screenshot({ path: path.join(SHOTS, `ventes-vide-${W}-${th}.png`) });
      dit(m.vide && !m.lignes.length && !m.rangsTel.length, 'base vide : « Aucun colis à envoyer »', m.texte);
      dit(m.pleins === 0 && !m.desactives, `base vide : aucun plein, aucun bouton désactivé (${m.pleins})`);
      dit(!m.detail.length, 'base vide : aucun volet vide');
      dit(!m.faibles.length, 'base vide : contraste', m.faibles.slice(0, 4));
      dit(!erreurs.length, 'base vide : aucune erreur', erreurs.slice(0, 3));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a rencontré une erreur', String(e && e.stack || e)); }
  await nav.close(); srv.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
