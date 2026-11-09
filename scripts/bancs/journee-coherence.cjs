// ════════════════════════════════════════════════════════════════════════════
//  BANC « MA JOURNÉE ET LES CARTES SOMBRES » — chantier E1 de la revue de
//  cohérence du 5 nov. (docs/passation/2026-11-05-revue-coherence.md, points
//  2.1 à 2.4, 2.11, 1.7, 3.1, 3.2 ; récit : docs/passation/2026-11-05-chantier-e1.md).
//  Données INVENTÉES (le dépôt est public) : le petit jeu du banc
//  `nouveau-vendeur`, servi par SON harnais (aucune écriture ne sort du banc), et
//  trois ajouts :
//   · une paire N°42 VENDUE (vente finalisée, reliée à son annonce par la
//     transaction) et toujours posée dans une case de « Mes meubles » ;
//   · une vente Leboncoin du N°5 dont l'annonce Vinted est encore en ligne
//     (« Vendus ailleurs ») ;
//   · des ventes finalisées SANS date de versement (« à dater »).
//  Scénarios : `plein` (tout ça), `calme` (le jeu seul, versements datés : rien
//  de vendu ailleurs, rien de rangé vendu). À 390 px tactile et 1512 px, clair et
//  sombre. Il MESURE (data-*, rectangles, styles calculés, pixels — jamais un
//  libellé sauf le verbe et la raison qui SONT la règle) :
//   E1 GESTES    — « N gestes » = le nombre de cartes visibles de « À faire » ;
//   E2 AILLEURS  — « Vendus ailleurs » est une carte DE la liste, seulement
//                  quand il y a quelque chose à vérifier (jamais hors liste) ;
//   E3 SEMAINE   — (9 nov., Ma journée v2) la semaine passée n'est plus une carte à
//                  part : elle se touche DANS la frise de la tête (« Semaine du … »,
//                  44 px), et la touchée montre la semaine (`data-journal-semaine`)
//                  dans la tête, sans filet de « liste déroulante » ;
//   E4 SOMBRE    — en sombre, la tête sombre se détache des cartes (pixels) ;
//   E5 VERBE     — un seul verbe pour ouvrir un écran (« Voir ») ; un vrai geste
//                  garde le sien ; deux sortes de carte n'ont pas la même icône ;
//   E6 MODIFIER  — « Modifier » ne chevauche rien de la carte sombre (Ma journée
//                  et Ventes) ;
//   E7 REÇU      — « Reçu · mois » sans date de versement : « — » ET la raison
//                  écrite (« à dater »), jamais « 0 € » ; daté : un montant ;
//   E8 SURTITRE  — les surtitres de la tête et des cartes sombres suivent UNE
//                  règle (casse, taille, graisse, espacement) ;
//   E9 STOCK     — « N°42 vendue, toujours rangée » + la case, « Voir » mène au
//                  Stock sur ce N°, puis la carte ne revient pas (une fois) ;
//   E10 ALIGNÉ   — le texte de chaque carte « À faire » commence au même endroit ;
//   E11 JOURS    — une marque (la barre du vendu, 9 nov.) sous chaque jour où il a vendu (aucune ailleurs) ;
//   E0 GÉNÉRAL   — aucune erreur JS, aucun débordement, 44 px au doigt dans la
//                  zone, aucun « 0,00 € » sur la tête, aucun mot écarté.
//  Réglages : `BANC_PORT` (9100–9149, 9121 par défaut), `LARGEURS`, `THEMES`,
//  `SCENARIOS=plein,calme`, `SHOTS=<dossier>` (captures à REGARDER),
//  `BANC_DIST` (un autre dist/, pour juger la base).
//  Un banc ne meurt pas : il rapporte (le nombre de rouges par mesure, à la fin).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '9121';
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const PORT = NV.PORT;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const SCENARIOS = liste('SCENARIOS', 'plein,calme');
const SHOTS = process.env.SHOTS || '';

let ko = 0;
const compte = {};
const dit = (bon, cle, quoi, det) => {
  compte[cle] = compte[cle] || { ok: 0, ko: 0 };
  if (bon) compte[cle].ok++; else { compte[cle].ko++; ko++; }
  if (!bon || process.env.BAVARD) console.log(`${bon ? 'OK  ' : 'KO  '}${cle} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 700) : ''}`);
};

// ── LE JEU ──────────────────────────────────────────────────────────────────
const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString();
const jeu = (scenario) => {
  const l = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  const main = l.find((x) => x.id === 'main');
  const v1 = l.find((x) => x.id === 'harvest_111_orders_sold');
  // Les transactions des deux ventes finalisées (62002, 62005) : reliées à leur annonce.
  // `plein` : sans date de versement (« à dater ») ; `calme` : versées hier.
  const versee = scenario === 'calme' ? iso(1) : null;
  // La vraie forme (data.payload.transaction, lue par `meta->>` : _meta.cjs).
  const txn = (uid, tx, item) => ({ id: `harvest_${uid}_txn_${tx}`, data: { capturedAt: iso(0.01), payload: { transaction: { id: tx, item_id: item, status: 450, status_title: 'Commande finalisée', ...(versee ? { status_updated_at: versee } : {}), shipment: { status_title: 'Livré' } } } } });
  if (scenario === 'plein') {
    // N°42 : vendue (finalisée), plus en ligne, toujours posée dans une case.
    main.data.vinted_annonce_numeros['51900'] = { numero: '42', title: 'Nike Air Max 1 rouge taille 43', accountId: '111' };
    l.push(txn(111, 62002, 51900));
    main.data.vrm_meubles = [{ id: 'm1', name: 'Étagère A', cols: 4, rows: 3 }];
    main.data.vrm_slots = { 42: { m: 'm1', i: 6 } };
    // « Remettre » posé à la main : la sortie automatique ne la libère pas (il a dit qu'elle est là).
    main.data.vrm_stock_garder = { 42: now - 86400000 };
    // Vendu sur Leboncoin, encore en ligne sur Vinted : le N°5 (annonce Vinted 51004).
    const lbcL = l.find((x) => x.id === 'lbc_listings');
    lbcL.data.items['3100000005'] = { id: '3100000005', ref: '5', customRef: 'VRM-5', subject: 'Salomon XT-6 grise T42', status: 'sold', account: 'lbcA', seenAt: iso(0.5), price: 90 };
    l.find((x) => x.id === 'lbc_ventes').data.ventes = { v5: { id: 'v5', itemId: '3100000005', isSeller: true, title: 'Salomon XT-6 grise T42', price: 90, date: iso(1), stepLabel: 'Colis envoyé' } };
  } else {
    l.push(txn(111, 62002, 51007));
  }
  l.push(txn(222, 62005, 51013));
  return l;
};

// ── CE QUE LA PAGE MONTRE ───────────────────────────────────────────────────
const MESURE = (pg, tel) => pg.evaluate((tel) => {
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let p = e; p && p !== document.documentElement; p = p.parentElement) { const s = getComputedStyle(p); if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) < 0.05) return false; } return !e.closest('details:not([open]) > :not(summary)'); };
  const R = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height, r: r.right, b: r.bottom + scrollY }; };
  const txt = (e) => (e ? (e.innerText || '').trim().replace(/\s+/g, ' ') : '');
  const ecran = document.querySelector('.vrm-fu-journee');
  const out = { ecran: !!ecran };
  if (!ecran) return out;
  // E1 / E2 — « À faire ».
  const sec = ecran.querySelector('.vrm-fu-afaire');
  const lst = sec && sec.querySelector('[data-barre-jour]');
  const cartes = lst ? [...lst.children].flatMap((c) => (getComputedStyle(c).display === 'contents' ? [...c.children] : [c])).filter(vis) : [];
  out.gestesDit = sec && sec.querySelector('[data-fu-gestes]') ? Number(sec.querySelector('[data-fu-gestes]').getAttribute('data-fu-gestes')) : null;
  out.gestesTexte = sec && sec.querySelector('[data-fu-gestes]') ? txt(sec.querySelector('[data-fu-gestes]')) : '';
  const va = [...document.querySelectorAll('[data-vendus-ailleurs]')].filter(vis);
  // Une carte « à faire » posée HORS de la liste compte aussi : c'est un geste montré.
  // (9 nov., Ma journée v2) La prochaine chose à faire est posée EN TÊTE (`data-prochain`) : elle
  // est un geste de « À faire » (comptée dans « N gestes »), hors de la liste « Ensuite ».
  const pro = [...document.querySelectorAll('[data-prochain]')].filter(vis);
  out.nCartes = cartes.length + pro.filter((e) => !(lst && lst.contains(e))).length + va.filter((e) => !(lst && lst.contains(e)) && !e.hasAttribute('data-prochain')).length;
  out.ailleurs = va.map((e) => ({ dansListe: !!(lst && lst.contains(e)) || e.hasAttribute('data-prochain'), n: e.getAttribute('data-n') || '', texte: txt(e).slice(0, 80) }));
  // E5 — les verbes et les icônes des cartes.
  out.cartes = cartes.map((c) => {
    const act = c.querySelector('.vrm-day-task-action-mot, .vrm-day-task-action, .vrm-day-task-geste');
    const svg = c.querySelector('.vrm-day-task-photos svg, .vrm-pile-vignettes svg, [data-pile-vignettes] svg, svg');
    const photo = !!c.querySelector('img');
    const sorte = c.getAttribute('data-tuile') || c.getAttribute('data-job') || (c.hasAttribute('data-vendus-ailleurs') ? 'vendus-ailleurs' : '') || (c.hasAttribute('data-stock-sortie') ? 'stock-sortie' : '') || c.className;
    return { sorte, verbe: act ? txt(act).replace(/[›↗]/g, '').trim() : '', icone: !photo && svg ? [...svg.querySelectorAll('path,circle,rect,line,polyline')].map((p) => p.getAttribute('d') || p.outerHTML.replace(/\s+/g, '')).join('|').slice(0, 300) : '', titre: txt(c.querySelector('.vrm-day-task-title, .vrm-day-task-textes')).slice(0, 70), h: Math.round(c.getBoundingClientRect().height) };
  });
  // E3 — la carte Semaine.
  const tete = ecran.querySelector('.vrm-fu-tete');
  const sem = ecran.querySelector('[data-journal-semaine]');
  out.tete = tete ? R(tete) : null;
  // (9 nov., DA 6 « Widgets ») Le fond sombre de la tête est peint par son `::before` sur les rangées du
  // haut ; les cases sont des widgets posés SOUS lui. Le « bas de la tête sombre » est donc le bas de ce
  // fond peint (sinon on mesurerait un widget). La règle E4 ne change pas : c'est l'endroit mesuré.
  if (out.tete && tete) { const av = getComputedStyle(tete, '::before'); const h = parseFloat(av.height);
    if (av.content !== 'none' && av.position === 'absolute' && /gradient/.test(av.backgroundImage) && h > 40) out.tete.b = Math.round(tete.getBoundingClientRect().top + scrollY + h); }
  out.sem = sem && vis(sem) ? R(sem) : null;
  const semB = ecran.querySelector('[data-jv2-semaine]');
  out.semBouton = semB && vis(semB) ? { h: Math.round(semB.getBoundingClientRect().height), dansTete: !!(tete && tete.contains(semB)) } : null;
  out.semCarteAPart = [...ecran.querySelectorAll('.vrm-journal-semaine')].filter(vis).length;
  out.carte0 = cartes[0] ? R(cartes[0]) : null;
  if (sem && vis(sem)) {
    const filets = [];
    for (const e of [sem, ...sem.querySelectorAll('*')]) {
      if (!vis(e)) continue;
      const s = getComputedStyle(e);
      for (const c of ['Top', 'Bottom']) if (e !== sem && parseFloat(s['border' + c + 'Width']) > 0 && s['border' + c + 'Style'] !== 'none' && !/rgba\(\d+, \d+, \d+, 0\)/.test(s['border' + c + 'Color'])) filets.push(`${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)} ${c}`);
    }
    out.semFilets = filets;
    const b = sem.querySelector('[data-journal-bascule]');
    out.semBascule = b ? { h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width) } : null;
    out.semReplie = sem.getAttribute('data-journal-replie');
  }
  // E6 — « Modifier » ne chevauche rien sur sa carte.
  out.modifier = [];
  for (const m of document.querySelectorAll('.vrm-fu-modifier')) {
    if (!vis(m)) continue;
    const carte = m.closest('.vrm-fu-tete, .vrm-fu-carte, .vrm-fu-carte-nu');
    const rm = m.getBoundingClientRect();
    const touche = [];
    for (const e of carte.querySelectorAll('svg, .vrm-fu-surtitre, .vrm-fu-grand, .vrm-fu-sous, .vrm-fu-case, .vrm-fu-titre-tete, .vrm-fu-bonjour, .vrm-fu-semaine, .vrm-fu-jour')) {
      if (!vis(e) || m.contains(e) || e.contains(m)) continue;
      // le texte réel, pas la boîte (un titre en bloc prend toute la largeur)
      let rs = [];
      if (e.tagName.toLowerCase() === 'svg') rs = [e.getBoundingClientRect()];
      else { const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (!/\S/.test(n.nodeValue) || !vis(n.parentElement)) continue; const rg = document.createRange(); rg.selectNodeContents(n); rs.push(...rg.getClientRects()); } if (e.matches('.vrm-fu-case, .vrm-fu-jour > b')) rs.push(e.getBoundingClientRect()); }
      for (const r of rs) if (r.width > 1 && r.left < rm.right - 1 && r.right > rm.left + 1 && r.top < rm.bottom - 1 && r.bottom > rm.top + 1) { touche.push(`${e.tagName.toLowerCase()}.${String(e.getAttribute('class') || '').split(' ')[0]} « ${txt(e).slice(0, 20)} »`); break; }
    }
    out.modifier.push({ page: m.getAttribute('data-carte-modifier'), touche, h: Math.round(rm.height) });
  }
  // E7 — Reçu · mois.
  const recu = [...document.querySelectorAll('[data-carte-chiffre="recu"]')].filter(vis)[0];
  out.recu = recu ? { valeur: recu.getAttribute('data-carte-valeur'), texte: txt(recu), raison: txt(recu.querySelector('[data-carte-raison]')), titre: recu.getAttribute('title') || '' } : null;
  out.casesTete = [...ecran.querySelectorAll('.vrm-fu-tete .vrm-fu-case')].filter(vis).map((c) => ({ v: c.getAttribute('data-carte-valeur'), texte: txt(c), raison: txt(c.querySelector('[data-carte-raison]')) }));
  // E8 — les surtitres.
  out.surtitres = [...document.querySelectorAll('.vrm-fu-surtitre, .vrm-fu-bonjour')].filter(vis).map((e) => { const s = getComputedStyle(e); return { classe: e.className, texte: txt(e).slice(0, 20), regle: [s.textTransform, s.fontSize, s.fontWeight, s.letterSpacing].join(' ') }; });
  // E9 — la sortie du Stock.
  const so = [...document.querySelectorAll('[data-stock-sortie]')].filter(vis);
  out.stock = so.map((e) => ({ dansListe: !!(lst && lst.contains(e)) || e.hasAttribute('data-prochain'), nums: e.getAttribute('data-stock-sortie'), texte: txt(e).slice(0, 120) }));
  // E10 — un alignement : le texte de chaque carte commence au même endroit.
  out.textesX = cartes.map((c) => { const t = c.querySelector('.vrm-day-task-textes'); return t ? Math.round(t.getBoundingClientRect().left) : null; }).filter((x) => x != null);
  // E11 — les jours où il a vendu portent un point (`data-vendu` = la règle « Vendu »).
  out.jours = [...ecran.querySelectorAll('.vrm-fu-jour')].map((l) => { const b = l.querySelector('.vrm-jv2-barre'); return { n: l.getAttribute('data-vendu'), point: !!(b && b.hasAttribute('data-barre') && b.getBoundingClientRect().height > 0.5) }; });
  // E0 — débordement, cibles, zéros.
  out.debord = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  out.petits = [];
  if (tel) for (const e of ecran.querySelectorAll('button, [role="button"], a[href], summary')) {
    if (!vis(e) || e.closest('[aria-hidden="true"], svg')) continue;
    if (e.tagName === 'A' && getComputedStyle(e).display === 'inline') continue;
    const r = e.getBoundingClientRect(); if (r.height < 43.5 || r.width < 43.5) out.petits.push(`${txt(e).slice(0, 30) || e.getAttribute('aria-label')} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  out.zeroTete = tete ? /(^|\s)0,00\s*€/.test(txt(tete)) : false;
  out.texteEcran = txt(ecran);
  return out;
}, tel);

// E4 — pixels : la couleur moyenne d'une zone de la capture (décodée dans le navigateur).
async function moyenne(pg, nav, clip) {
  const png = await pg.screenshot({ clip });
  const p2 = await nav.newPage();
  const m = await p2.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    return { r: r / n, g: g / n, b: b / n };
  }, png.toString('base64'));
  await p2.close();
  return m;
}
const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ecartCouleur = (a, b) => Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);

const VERBES_GESTES = /^(Imprimer|Emballer|Noter|Supprimer|Réessayer|Répondre|Trancher|Renvoyer|Suivre|Chez moi|Vendu.*|Séparé.*|…)$/;
// Les mots écartés (src/libelles.js). « Bénéfice brut » est le nom d'une AUTRE notion
// (ventes − prix d'achat, audit-benefice-unique) : rapporté à part, pas jugé ici.
// (`\b` ne voit pas une frontière avant « à » : les mots se cherchent entre espaces.)
const ECARTES = [/(^|[\s(«])à poster(?![\p{L}])/iu, /(^|[\s(«])à expédier(?![\p{L}])/iu, /(^|[\s(«])en transit(?![\p{L}])/iu, /(^|[\s(«])encaissé/iu, /(^|[\s(«])régime fiscal/iu, /(^|[\s(«])likes(?![\p{L}])/iu, /(^|[\s(«])comptes connectés/iu];

async function tournee(nav, { W, theme, scenario }) {
  const sombre = theme === 'sombre', tel = W < 600;
  const T = `[${scenario} ${W}px ${theme}]`;
  const base = { lignes: jeu(scenario), comptes: NV.JEU_COMPTES, ecritures: 0 };
  const o = await NV.ouvrir(nav, { W, sombre, base, tab: 'journee' });
  const pg = o.pg;
  await pg.waitForSelector('.vrm-fu-journee', { timeout: 20000 }).catch(() => {});
  // La lecture « Vendus ailleurs » part au montage : on la laisse répondre (et la publication des
  // ventes prouvées, pour la sortie du Stock).
  await pg.waitForTimeout(5200);
  if (scenario === 'plein') await pg.waitForSelector('[data-stock-sortie]', { timeout: 8000 }).catch(() => {});
  const m = await MESURE(pg, tel);
  if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `e1-${scenario}-${W}-${theme}.png`), fullPage: true }); }
  if (!m.ecran) { dit(false, 'E0', `${T} l'écran Ma journée est rendu`); await o.ctx.close(); return; }

  // E1
  dit(m.gestesDit === m.nCartes, 'E1', `${T} « ${m.gestesTexte} » = ${m.nCartes} carte(s) visibles dans « À faire »`, `dit ${m.gestesDit}, vu ${m.nCartes} : ${m.cartes.map((c) => c.sorte).join(', ')}`);
  // E2
  const horsListe = m.ailleurs.filter((a) => !a.dansListe);
  dit(!horsListe.length, 'E2', `${T} « Vendus ailleurs » n'est jamais hors de la liste « À faire »`, JSON.stringify(horsListe));
  if (scenario === 'plein') dit(m.ailleurs.length === 1 && m.ailleurs[0].dansListe, 'E2', `${T} quelque chose à vérifier : « Vendus ailleurs » est UNE carte de la liste`, JSON.stringify(m.ailleurs));
  else dit(m.ailleurs.length === 0, 'E2', `${T} rien à vérifier : pas de carte « Vendus ailleurs »`, JSON.stringify(m.ailleurs));
  // E3
  // (9 nov., Ma journée v2) La semaine se touche dans la frise de la tête ; plus de carte à part.
  dit(!!(m.semBouton && m.semBouton.dansTete && m.semBouton.h >= 44) && m.semCarteAPart === 0, 'E3', `${T} « Semaine du … » se touche dans la tête (44 px), aucune carte Semaine à part`, JSON.stringify({ bouton: m.semBouton, aPart: m.semCarteAPart }));
  {
    await pg.locator('[data-jv2-semaine]').first().click().catch(() => {});
    await pg.waitForTimeout(500);
    const w = await pg.evaluate(() => { const t = document.querySelector('.vrm-fu-tete'); const s = t && t.querySelector('[data-journal-semaine]'); if (!s) return null;
      const filets = []; for (const e of s.querySelectorAll('*')) { const c = getComputedStyle(e); for (const k of ['Top', 'Bottom']) if (parseFloat(c['border' + k + 'Width']) > 0 && c['border' + k + 'Style'] !== 'none' && !/rgba\(\d+, \d+, \d+, 0\)/.test(c['border' + k + 'Color'])) filets.push(e.className + ' ' + k); }
      return { lundi: s.getAttribute('data-journal-semaine'), filets }; });
    dit(!!(w && w.lundi && !w.filets.length), 'E3', `${T} touchée, la semaine passée s'affiche dans la tête, sans filet de liste déroulante`, JSON.stringify(w));
    await pg.locator('[data-jv2-semaine]').first().click().catch(() => {});
    await pg.waitForTimeout(300);
  }
  // E4
  if (sombre && m.tete && m.carte0) {
    const t = await moyenne(pg, nav, { x: m.tete.x + 4, y: m.tete.b - 18, width: Math.min(60, m.tete.w / 4), height: 10 });
    const c = await moyenne(pg, nav, { x: m.carte0.x + m.carte0.w - 40, y: m.carte0.y + 4, width: 30, height: 8 });
    const rap = (Math.max(lum(t), lum(c)) + 0.05) / (Math.min(lum(t), lum(c)) + 0.05);
    const ec = ecartCouleur(t, c);
    dit(ec >= 14, 'E4', `${T} la tête sombre se détache des cartes (écart de couleur ${Math.round(ec)} ≥ 14, contraste ${rap.toFixed(2)})`, `tête rgb(${Math.round(t.r)},${Math.round(t.g)},${Math.round(t.b)}) carte rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})`);
  }
  // E5
  const ouvrir = m.cartes.filter((c) => c.verbe && !VERBES_GESTES.test(c.verbe));
  const mauvais = ouvrir.filter((c) => c.verbe !== 'Voir');
  dit(!mauvais.length, 'E5', `${T} un seul verbe pour ouvrir un écran : « Voir » (${ouvrir.length} carte(s))`, mauvais.map((c) => `${c.sorte} « ${c.verbe} »`).join(' ¦ '));
  const parIcone = {};
  // Une SORTE de carte = une famille de choses : « Vendus ailleurs » et les doubles ventes disent
  // la même chose (vendu ici, encore en ligne là) ; les retraits entre eux ; les envois entre eux.
  const famille = (s) => /^(double-vente|vendus-ailleurs)/.test(s) ? 'double-vente' : /^(retirer|retrait-)/.test(s) ? 'retrait' : /^(envoyer|emballer|colis-|poste-|vestiaire-envoyer|ebay-ne-pas)/.test(s) ? 'envoi' : /messages/.test(s) ? 'messages' : s;
  for (const c of m.cartes) if (c.icone) (parIcone[c.icone] = parIcone[c.icone] || new Set()).add(famille(c.sorte));
  const partagees = Object.values(parIcone).filter((s) => s.size > 1).map((s) => [...s].join(' = '));
  dit(!partagees.length, 'E5', `${T} deux sortes de carte n'ont jamais la même icône`, partagees.join(' ¦ '));
  // E6
  for (const x of m.modifier) dit(!x.touche.length && x.h >= 44, 'E6', `${T} « Modifier » (${x.page}) ne chevauche rien et fait 44 px`, `${x.h} px · ${x.touche.join(' ¦ ')}`);
  if (!m.modifier.length) dit(false, 'E6', `${T} « Modifier » est sur la tête`);
  // E7
  if (m.recu) {
    if (scenario === 'plein') dit(m.recu.valeur === '' && /—/.test(m.recu.texte) && /à dater/.test(m.recu.raison) && !/(^|\s)0(,00)?\s*€/.test(m.recu.texte), 'E7', `${T} « Reçu » sans date de versement : « — » et la raison écrite`, JSON.stringify(m.recu));
    else dit(m.recu.valeur !== '' && Number(m.recu.valeur) > 0 && !/à dater/.test(m.recu.texte), 'E7', `${T} « Reçu » daté : un montant, pas de raison`, JSON.stringify(m.recu));
  } else dit(false, 'E7', `${T} la case « Reçu » est sur la tête`);
  const sansRaison = m.casesTete.filter((c) => c.v === '' && !c.raison);
  dit(!sansRaison.length, 'E7', `${T} chaque « — » de la tête dit sa raison`, JSON.stringify(sansRaison));
  // E8
  const regles = [...new Set(m.surtitres.map((s) => s.regle))];
  dit(m.surtitres.length >= 2 && regles.length === 1 && !/uppercase/.test(regles[0] || ''), 'E8', `${T} les surtitres suivent une règle (${m.surtitres.length} vus)`, m.surtitres.map((s) => `${s.classe.split(' ')[0]} « ${s.texte} » ${s.regle}`).join(' ¦ '));
  // E9
  if (scenario === 'plein') {
    const s = m.stock[0];
    dit(m.stock.length === 1 && s.dansListe && /N°\s?42/.test(s.texte) && /Étagère A/.test(s.texte), 'E9', `${T} « N°42 vendue, toujours rangée » + sa case, une carte de la liste`, JSON.stringify(m.stock));
  } else dit(m.stock.length === 0, 'E9', `${T} rien de rangé vendu : pas de carte`, JSON.stringify(m.stock));
  // E10
  dit(m.textesX.length > 1 && Math.max(...m.textesX) - Math.min(...m.textesX) <= 1, 'E10', `${T} le texte de chaque carte « À faire » commence au même endroit`, m.textesX.join(', '));
  // E11
  const avec = m.jours.filter((j) => Number(j.n) > 0), sans = m.jours.filter((j) => !(Number(j.n) > 0));
  dit(avec.length > 0 && avec.every((j) => j.point) && sans.every((j) => !j.point), 'E11', `${T} une marque (la barre du vendu) sous chaque jour où il a vendu, aucune ailleurs (${avec.length} jour(s))`, JSON.stringify(m.jours));
  // E0
  dit(!m.debord, 'E0', `${T} aucun débordement horizontal`);
  if (tel) dit(!m.petits.length, 'E0', `${T} au doigt, 44 px dans Ma journée`, m.petits.join(' ¦ '));
  dit(!m.zeroTete, 'E0', `${T} aucun « 0,00 € » sur la tête`);
  const ec = ECARTES.filter((re) => re.test(m.texteEcran)).map(String);
  dit(!ec.length, 'E0', `${T} aucun mot écarté (src/libelles.js)`, ec.join(' ¦ '));

  // E2 (suite) — « Voir » ouvre la feuille « Vendus ailleurs » (SheetShell) : l'annonce, ses gestes.
  if (scenario === 'plein' && m.ailleurs.length === 1) {
    await pg.locator('.vrm-fu-afaire [data-vendus-ailleurs]').first().click().catch(() => {});
    await pg.waitForTimeout(900);
    const f = await pg.evaluate(() => { const d = document.querySelector('[data-feuille-ailleurs]'); return d ? { n: d.querySelectorAll('article').length, croix: !!d.querySelector('[data-feuille-croix]'), texte: (d.innerText || '').replace(/\s+/g, ' ').slice(0, 900), vide: !!d.querySelector('article [data-photo-vide]') } : null; });
    if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `e1-ailleurs-${W}-${theme}.png`) });
    dit(!!f && f.n === 1 && f.croix && /N°5/.test(f.texte) && f.vide && /Leboncoin · encore/.test(f.texte), 'E2', `${T} « Voir » ouvre la feuille « Vendus ailleurs » (N°5, encore en ligne)`, JSON.stringify(f));
    await pg.locator('[data-feuille-ailleurs] [data-feuille-croix]').click().catch(() => {});
    await pg.waitForTimeout(500);
  }
  // E9 (suite) — « Voir » mène au Stock sur CE N°, puis la carte ne revient pas.
  if (scenario === 'plein' && m.stock.length === 1 && W === LARGEURS[0] && theme === THEMES[0]) {
    const b = pg.locator('[data-stock-sortie] .vrm-day-task-action, [data-stock-sortie]').first();
    await b.click().catch(() => {});
    await pg.waitForTimeout(2200);
    const lieu = await pg.evaluate(() => ({ url: location.search, stock: !!document.querySelector('[data-stock-annonce], .vrm-s2d, [data-case-num]'), q: [...document.querySelectorAll('.vrm-main input')].map((i) => i.value).join('|'), vise: [...document.querySelectorAll('[data-case-vise]')].map((e) => e.getAttribute('data-case-num')) }));
    // (8 nov.) Depuis la vague 3 (6 nov.), un N° qui a SA case est visé sur la case (recherche vide) ;
    // sans case, la recherche s'ouvre sur lui. L'un OU l'autre, et seulement CE N°.
    dit(/42/.test(lieu.q) || (lieu.vise.length === 1 && lieu.vise[0] === '42'), 'E9', `${T} « Voir » ouvre le Stock sur le N°42`, JSON.stringify(lieu));
    await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('.vrm-fu-journee', { timeout: 20000 }).catch(() => {});
    await pg.waitForTimeout(4000);
    const m2 = await MESURE(pg, tel);
    dit(m2.stock.length === 0 && m2.gestesDit === m2.nCartes, 'E9', `${T} vue une fois : la carte ne revient pas (et le compte suit)`, JSON.stringify(m2.stock) + ` ${m2.gestesDit}/${m2.nCartes}`);
  }
  // E6 sur Ventes (la même carte).
  if (scenario === 'plein') {
    await pg.goto(`http://localhost:${PORT}/?tab=ventes`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
    await pg.waitForTimeout(3000);
    const v = await pg.evaluate(() => [...document.querySelectorAll('.vrm-fu-modifier')].length);
    const mv = await MESURE(pg, tel).catch(() => null);
    if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `e1-ventes-${W}-${theme}.png`), fullPage: false });
    const mods = await pg.evaluate(() => {
      const vis = (e) => !!(e && e.getClientRects().length);
      return [...document.querySelectorAll('.vrm-fu-modifier')].filter(vis).map((m) => {
        const carte = m.closest('.vrm-fu-carte, .vrm-fu-carte-nu'); const rm = m.getBoundingClientRect(); const touche = [];
        for (const e of carte.querySelectorAll('svg, .vrm-fu-surtitre, .vrm-fu-grand, .vrm-fu-sous, .vrm-fu-case')) {
          if (!vis(e) || m.contains(e)) continue;
          let rs = []; if (e.tagName.toLowerCase() === 'svg' || e.matches('.vrm-fu-case')) rs = [e.getBoundingClientRect()]; else { const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (!/\S/.test(n.nodeValue)) continue; const rg = document.createRange(); rg.selectNodeContents(n); rs.push(...rg.getClientRects()); } }
          for (const r of rs) if (r.width > 1 && r.left < rm.right - 1 && r.right > rm.left + 1 && r.top < rm.bottom - 1 && r.bottom > rm.top + 1) { touche.push(`${e.tagName.toLowerCase()}.${String(e.getAttribute('class') || '').split(' ')[0]}`); break; }
        }
        return { touche, h: Math.round(rm.height) };
      });
    });
    void v; void mv;
    const texteCarte = await pg.evaluate(() => [...document.querySelectorAll('.vrm-fu-carte')].map((c) => c.innerText).join(' '));
    const ecV = ECARTES.filter((re) => re.test(texteCarte)).map(String);
    dit(!ecV.length, 'E0', `${T} Ventes : aucun mot écarté sur la carte sombre`, ecV.join(' ¦ '));
    for (const x of mods) dit(!x.touche.length && x.h >= 44, 'E6', `${T} Ventes : « Modifier » ne chevauche rien et fait 44 px`, `${x.h} px · ${x.touche.join(' ¦ ')}`);
    if (!mods.length) dit(false, 'E6', `${T} Ventes : la carte sombre a son « Modifier »`);
  }
  dit(!o.journal.erreurs.length, 'E0', `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

(async () => {
  await new Promise((ok) => NV.srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const scenario of SCENARIOS) for (const theme of THEMES) for (const W of LARGEURS) await tournee(nav, { W, theme, scenario });
  } catch (e) { dit(false, 'E0', 'le banc a pu aller au bout', String(e && e.stack).slice(0, 400)); }
  await nav.close(); NV.srv.close();
  console.log('\n── Rouges par mesure');
  for (const [k, v] of Object.entries(compte).sort()) console.log(`   ${k} : ${v.ko} rouge(s), ${v.ok} vert(s)`);
  console.log(ko ? `\n❌ journee-coherence : ${ko} défaut(s)` : '\n✅ journee-coherence : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
