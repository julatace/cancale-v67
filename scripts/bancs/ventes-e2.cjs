// ════════════════════════════════════════════════════════════════════════════
//  BANC « VENTES » — chantier E2 de la revue de cohérence du 5 nov.
//  (docs/passation/2026-11-05-revue-coherence.md, points 2.12, 2.13, 2.14, 2.30,
//  3.5 et le vocabulaire ; récit : docs/passation/2026-11-05-chantier-e2.md).
//  Données INVENTÉES (le dépôt est public) : le jeu du banc `nouveau-vendeur`
//  (deux comptes Vinted, des ventes, un compte Leboncoin jamais lu), servi par SON
//  harnais — aucune écriture ne sort du banc —, plus des jeux d'annulations.
//  Ventes · Tous et Ventes · Vinted, à 390 px tactile et 1512 px, clair et sombre.
//  Il MESURE (data-*, styles calculés, rectangles — jamais un libellé seul) :
//   V1 UN MONTANT, UNE FOIS (2.12) — « À venir » d'un seul compte : aucune ligne
//      par compte, le total écrit une fois dans la carte ;
//   V2 L'ÉTAT SUR SA LIGNE (2.13) — au téléphone, l'état de chaque vente de « Tous »
//      est sous la ligne site · compte · date, entier (ni ellipse, ni débord) ;
//   V3 PAS DE PHRASE PERMANENTE (2.14) — « jamais lu » replié en UNE ligne (fermée,
//      ≤ 1 ligne de texte), plus de « N sur N résultats » ;
//   V4 LE PIED (2.30) — ni « Vendus ailleurs » ni le bilan des données sous Ventes ;
//      « Compte qui vend le mieux » n'est plus dans Ventes (une place : Statistiques) ;
//   V5 LES MOTS — ni « à poster », ni « à expédier », ni « en transit » dans Ventes ;
//   V6 LES ZÉROS (3.5) — aucun « ,00 € » (centimes inutiles) dans Ventes ;
//   V7 LES COMPOSANTS — vignette sans photo = `PhotoVide`, N° = `Numero` (jamais
//      la pastille blanche en sombre) ;
//   V8 LES COULEURS — aucun texte bleu en aplat d'accent (`C.accent`) ; aucun rouge ;
//      l'ambre seulement sur un geste à faire ;
//   V9 LE DOIGT — au téléphone, chaque commande de Ventes fait 44 px ;
//   A  ANNULATIONS PAR COMPTE — un compte nettement au-dessus des autres sur 30 j
//      est dit UNE fois, avec SES ventes annulées ; rien quand c'est à égalité, quand
//      un compte n'a pas pu être lu (pas su), ni pour un compte exclu ;
//   G  200 VENTES — 60 lignes, « Afficher les 60 suivantes », titre très long sans
//      débord ; VIDE — l'état vide dit quoi faire, aucune phrase « jamais lu » ouverte.
//  Réglages : `BANC_PORT` (9150–9199, 9160 par défaut), `LARGEURS=390,1512`,
//  `THEMES=clair,sombre`, `SCENARIOS=jeu,annul,exclu,ko,egal,gros,vide`,
//  `SHOTS=<dossier>` (une capture par écran, à REGARDER), `BANC_DIST` (un autre
//  dist/, pour juger la base). Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '9160';
// (26 nov., bancs natifs) L'app RÉELLE (« VRM natif », 19 nov.) : jamais le DOM d'avant le 17 nov. (échafaudage
// `vrm_banc_dom_ancien`, _garde-reseau.cjs). Ventes est l'écran natif : À envoyer · En route · Terminées.
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
// (11 nov., webkit-fiable) `NAVIGATEUR=webkit` : le même banc sous le moteur de Safari (_navigateur.cjs).
const { lancer, estWebkit } = require('./_navigateur.cjs');
const PW_NAV = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const PORT = NV.PORT;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const SCENARIOS = liste('SCENARIOS', 'jeu,annul,exclu,ko,egal,gros,vide');
const SHOTS = process.env.SHOTS || '';

let ko = 0;
const compte = {};
const dit = (bon, cle, quoi, det) => {
  compte[cle] = compte[cle] || { ok: 0, ko: 0 };
  if (bon) compte[cle].ok++; else { compte[cle].ko++; ko++; }
  if (!bon || process.env.BAVARD) console.log(`${bon ? 'OK  ' : 'KO  '}${cle} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 500) : ''}`);
};

// ── Les jeux ────────────────────────────────────────────────────────────────
const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString();
const vente = (tx, titre, prix, statut, tus, jours) => ({ transaction_id: tx, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: iso(jours), photo: null });
const jeu = () => JSON.parse(JSON.stringify(NV.JEU_LIGNES));
const ligne = (l, id) => l.find((x) => x.id === id);
// vendeuse_b : 6 ventes en 30 jours dont 3 annulées (50 %) ; vendeuse_a : 8 ventes, aucune annulée.
const ANNULEES_B = [62101, 62102, 62103];
const avecAnnulations = ({ egal = false } = {}) => {
  const l = jeu();
  const a = ligne(l, 'harvest_111_orders_sold').data.payload.my_orders;
  for (let i = 0; i < 5; i++) a.push(vente(62200 + i, `Nike Air Force 1 blanche taille ${39 + i}`, 50 + i, i === 0 && egal ? 'Commande annulée' : 'Commande finalisée', i === 0 && egal ? 'failed' : 'completed', 4 + i * 3));
  if (egal) a.push(vente(62210, 'Puma Suede bleue taille 42', 45, 'Commande annulée', 'failed', 11));
  const b = ligne(l, 'harvest_222_orders_sold').data.payload.my_orders;
  ANNULEES_B.forEach((tx, i) => b.push(vente(tx, `Converse Chuck 70 noire taille ${40 + i}`, 55 + i * 5, 'Commande annulée', 'failed', 2 + i * 4)));
  if (!egal) b.push(vente(62104, 'Vans Old Skool taille 41', 48, 'Commande finalisée', 'completed', 12), vente(62105, 'Vans Knu Skool taille 42', 52, 'Commande finalisée', 'completed', 15));
  else b.push(vente(62104, 'Vans Old Skool taille 41', 48, 'Commande finalisée', 'completed', 12), vente(62105, 'Vans Knu Skool taille 42', 52, 'Commande finalisée', 'completed', 15), vente(62106, 'Vans Era taille 40', 40, 'Commande finalisée', 'completed', 16), vente(62107, 'Vans Era taille 43', 40, 'Commande finalisée', 'completed', 17), vente(62108, 'Vans Era taille 44', 40, 'Commande finalisée', 'completed', 18), vente(62109, 'Vans Era taille 45', 40, 'Commande finalisée', 'completed', 19));
  return l;
};
const exclu = () => { const l = avecAnnulations(); ligne(l, 'main').data.vinted_accounts_hidden = ['222']; return l; };
const LONG = 'Nike Air Max 1 Patta Waves Monarch édition très limitée boîte d’origine double lacets taille 42,5 avec facture et sac anti-poussière jamais portée';
const gros = () => {
  const l = jeu();
  const a = ligne(l, 'harvest_111_orders_sold').data.payload.my_orders;
  a.push(vente(63999, LONG, 249.5, 'Commande finalisée', 'completed', 1));
  for (let i = 0; i < 200; i++) a.push(vente(64000 + i, `Adidas Gazelle ${i} taille ${38 + (i % 8)}`, 30 + (i % 50), 'Commande finalisée', 'completed', 2 + i * 0.4));
  return l;
};
const vide = () => [{ id: 'main', data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) } } }];
const JEUX = {
  jeu: { lignes: jeu, comptes: NV.JEU_COMPTES },
  annul: { lignes: () => avecAnnulations(), comptes: NV.JEU_COMPTES },
  exclu: { lignes: exclu, comptes: NV.JEU_COMPTES },
  // Un TROISIÈME compte (vendeuse_c) a ses jetons mais AUCUNE ligne de ventes lisible : sa lecture
  // rate (« pas su »). Les deux autres sont lus et l'un annule nettement plus — mais le repère « tes
  // autres comptes » est incomplet : aucune alerte.
  ko: { lignes: () => avecAnnulations(), comptes: [...NV.JEU_COMPTES, { ...NV.JEU_COMPTES[1], id: 3, vinted_user_id: '333', login: 'vendeuse_c' }] },
  egal: { lignes: () => avecAnnulations({ egal: true }), comptes: NV.JEU_COMPTES },
  gros: { lignes: gros, comptes: NV.JEU_COMPTES },
  vide: { lignes: vide, comptes: [] },
};

// ── Ce que la page MONTRE ───────────────────────────────────────────────────
// Les entrées animées (fondu d'une liste au premier montage) finissent avant la mesure : sous
// Chromium sans écran une animation peut rester « running » — on la termine après 3 s.
const calme = (pg) => pg.evaluate(() => new Promise((ok) => {
  const anims = () => (document.getAnimations ? document.getAnimations() : []);
  Promise.race([Promise.all(anims().map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 3000))])
    .then(() => { for (const a of anims()) { try { if (a.playState === 'running') a.finish(); } catch (_) {} } setTimeout(ok, 120); });
})).catch(() => {});
const MESURE = async (pg, o) => { await calme(pg); return MESURE_BRUTE(pg, o); };
const MESURE_BRUTE = (pg, { tel, sombre }) => pg.evaluate(({ tel, sombre }) => {
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let p = e; p && p !== document.documentElement; p = p.parentElement) { const s = getComputedStyle(p); if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) < 0.05) return false; } return !e.closest('details:not([open]) > :not(summary)'); };
  const rgba = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const hsl = ({ r, g, b }) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); if (mx === r) h = (g - b) / d + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; } return { h, s, l }; };
  const rouge = (c) => { const x = rgba(c); if (!x || x.a < 0.3) return false; const { h, s, l } = hsl(x); return (h >= 345 || h <= 12) && s >= 0.45 && l >= 0.25 && l <= 0.75; };
  const ambre = (c) => { const x = rgba(c); if (!x || x.a < 0.5) return false; const { h, s, l } = hsl(x); return h > 18 && h <= 48 && s >= 0.6 && l >= 0.3 && l <= 0.7; };
  const nom = (e) => ((e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : e.tagName.toLowerCase()) + ' « ' + (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40) + ' »');
  // (26 nov., natif) La zone jugée : l'écran Ventes entier (`[data-tache="ventes"]`), ce qui y est VISIBLE.
  const ZONES = '[data-tache="ventes"]';
  const zones = [...document.querySelectorAll(ZONES)].filter(vis);
  const dans = (e) => zones.some((z) => z.contains(e));
  const tous = [...new Set(zones.flatMap((z) => [z, ...z.querySelectorAll('*')]))].filter((e) => !e.closest('svg') || e.tagName === 'svg');
  const visibles = tous.filter(vis);
  const texteZones = zones.map((z) => z.innerText || '').join('\n');
  const main = document.querySelector('.vrm-main');
  const texteMain = main ? main.innerText : '';
  // V1 — « À venir ».
  const av = document.querySelector('[data-a-venir]');
  const aVenir = av && vis(av) && dans(av) ? (() => {
    const total = (av.querySelector('[data-a-venir-total]') || av).innerText.replace(/au moins\s*/i, '').trim();
    const occ = total && total !== '—' ? (av.innerText.split(total).length - 1) : 0;
    return { groupes: Number(av.getAttribute('data-a-venir-groupes') || '-1'), lignes: av.querySelectorAll('[role="listitem"][data-a-venir-ligne]').length, resume: !!av.querySelector('[data-a-venir-resume]'), total, occ };
  })() : null;
  // V2 — l'état de chaque vente de « Terminées » (natif : `MetaVente`, src/natif/ecrans/rangeeVente.jsx — l'état est un
  // morceau de la 2ᵉ ligne, jamais rogné ; jugé : visible, entier, écrit UNE fois dans la rangée).
  const etats = [];
  for (const r of document.querySelectorAll('[data-toutes-vente]')) {
    if (!vis(r)) continue;
    const et = r.querySelector('[data-vr-etat]');
    if (!et) continue;
    const texte = (et.textContent || '').trim();
    const mot = et.querySelector('.n-vr-mot') || et;
    const fois = texte ? (r.textContent.split(texte).length - 1) : 0;
    etats.push({ id: r.getAttribute('data-toutes-id'), cle: et.getAttribute('data-vr-etat'), vu: vis(et), entier: mot.scrollWidth <= mot.clientWidth + 1 && !/ellipsis/.test(getComputedStyle(mot).textOverflow), fois, texte });
  }
  // V3 — « jamais lu » ouvert, et « N sur N résultats ».
  const jamaisOuverts = [...document.querySelectorAll('[data-toutes-etat-site][data-etat="jamais"]')].filter((e) => vis(e) && !e.closest('[data-toutes-vide]')).map((e) => e.innerText.trim().slice(0, 60));
  const replis = [...document.querySelectorAll('[data-toutes-repli]')].map((d) => { const s = d.querySelector('summary'); const r = document.createRange(); r.selectNodeContents(s.querySelector('.vrm-toutes-repli-txt') || s); const lignesTxt = new Set([...r.getClientRects()].filter((x) => x.width > 1).map((x) => Math.round(x.top))).size; return { ouvert: d.open, lignes: lignesTxt, h: Math.round(s.getBoundingClientRect().height), sites: d.getAttribute('data-toutes-repli') }; });
  const resultats = /\d+\s+sur\s+\d+\s+résultats?/i.exec(texteMain);
  // V4 — le pied.
  const pied = { vendusAilleurs: [...document.querySelectorAll('.vrm-ventes-controles [data-vendus-ailleurs], .vrm-sales-analysis [data-vendus-ailleurs]')].length, bilan: [...document.querySelectorAll('.vrm-ventes-controles [data-bilan-synchronisation]')].length, compteMieux: /Compte qui vend le mieux|Ventes finalisées par compte/i.test(texteMain) || !!document.querySelector('[data-ventes-par-compte]') };
  // V5 — les mots écartés (src/libelles.js), dans ce que Ventes écrit.
  const mots = (texteZones.match(/\bà poster\b|\bà expédier\b|\ben transit\b|\bexpédiés\b/gi) || []);
  // V6 — les zéros.
  const zeros = (texteZones.match(/\d[\d   ]*,00\s?€/g) || []);
  // V7 — les composants.
  // (26 nov., natif) Une rangée de vente sans photo CHARGÉE porte la vignette vide commune (`Vignette`, `data-n-sans-photo`) —
  // jamais une image cassée ni un carré vide improvisé.
  const rangs = [...document.querySelectorAll('[data-toutes-vente], [data-vn-rang]')].filter(vis);
  const sansPhoto = rangs.filter((r) => !r.querySelector('img') || ![...r.querySelectorAll('img')].some((i) => i.complete && i.naturalWidth > 0));
  const sansPhotoVide = sansPhoto.filter((e) => !e.querySelector('[data-n-sans-photo]') || [...e.querySelectorAll('img')].some((i) => i.complete && i.naturalWidth === 0 && vis(i))).length;
  const pastillesMain = 0;
  // Les N° : la plaque native (`Plaque`, `.n-plaque`) des rangées de Ventes.
  const nums = [...document.querySelectorAll('[data-tache="ventes"] .n-plaque')].filter(vis);
  // (16 nov., bancs-rouges-a) « Verre dépoli » (15 nov., maquette 9 choisie par Julien, studio-verre.css §10) : la plaque N°
  // est une plaquette BLANCHE en relief, l'encre sombre — partout, la nuit aussi. La règle d'avant (« jamais blanc en
  // sombre ») visait une pastille blanche au texte clair, illisible ; ce qui est jugé maintenant : le N° se LIT, encre
  // contre fond (contraste ≥ 4,5, WCAG AA). `numsBlancs` garde son nom : les N° illisibles.
  const lum = (x) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(x.r) + 0.7152 * f(x.g) + 0.0722 * f(x.b); };
  const contraste = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const numsBlancs = sombre ? nums.filter((e) => { const s = getComputedStyle(e); const f = rgba(s.backgroundColor), c = rgba(s.color); return f && c && f.a > 0.5 && contraste(f, c) < 4.5; }).length : 0;
  // V8 — les couleurs.
  // (26 nov., natif) L'accent n'est plus bleu (encre / ardoise, NATIF.md) : « aucun texte bleu » se juge sur TOUT bleu saturé
  // (plus strict que l'ancien seul bleu d'accent) ; le geste ambre porte le repère natif `data-n-ton="ambre"` en plus des anciens.
  const bleu = (c) => { const x = rgba(c); if (!x || x.a < 0.5) return false; const { h, s, l } = hsl(x); return h >= 195 && h <= 245 && s >= 0.6 && l >= 0.3 && l <= 0.7; };
  const bleus = [], rouges = [], ambres = [];
  const GESTE = '[data-ton="action"], [data-ton="urgent"], [data-n-ton="ambre"], [data-achat-etat="manque"], [data-ventes-ko], [data-gestes-ligne], .vrm-fu-seg, [data-toutes-etat-site], [data-recap-litige], .vrm-sale-row[data-depose-attente]';
  for (const e of visibles) {
    const s = getComputedStyle(e);
    let t = ''; for (const n of e.childNodes) if (n.nodeType === 3) t += n.nodeValue;
    const aTexte = !!t.trim();
    const fond = s.backgroundColor.replace(/rgba\((\d+), (\d+), (\d+), 1\)/, 'rgb($1, $2, $3)');
    if (aTexte && bleu(s.color) && !bleu(fond)) bleus.push(nom(e) + ' ' + s.color);
    for (const c of [aTexte ? s.color : '', s.backgroundColor, parseFloat(s.borderTopWidth) > 0 ? s.borderTopColor : '']) if (c && rouge(c)) { rouges.push(nom(e) + ' ' + c); break; }
    if (aTexte && ambre(s.color) && !e.closest(GESTE)) ambres.push(nom(e) + ' ' + s.color);
  }
  // V9 — le doigt.
  const petits = [];
  if (tel) for (const e of visibles.filter((x) => x.matches('button, [role="button"], a[href], summary, input, select'))) {
    if (e.closest('[aria-hidden="true"]') || (e.tagName === 'A' && getComputedStyle(e).display === 'inline')) continue;
    const r = e.getBoundingClientRect(); if (r.height < 43.5 || r.width < 43.5) petits.push(`${(e.innerText || e.getAttribute('aria-label') || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 30)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  // A — les annulations.
  const alertes = [...document.querySelectorAll('[data-annulations-alerte]')].filter(vis).map((a) => ({ uid: a.getAttribute('data-annulations-alerte'), n: a.getAttribute('data-annulations-n'), sur: a.getAttribute('data-annulations-sur'), ventes: [...a.querySelectorAll('[data-annulation-vente]')].map((x) => x.getAttribute('data-annulation-vente')), texte: a.innerText.slice(0, 160) }));
  // G — la liste longue.
  // Les lignes de la page : la liste du téléphone les rend PAR PAQUETS (`ParPaquets`) — son nombre est `data-vt-liste-tel`.
  const listeTel = document.querySelector('[data-vt-liste-tel]');
  const lignesToutes = listeTel ? Number(listeTel.getAttribute('data-vt-liste-tel')) : document.querySelectorAll('[data-toutes-vente]').length;
  const plus = (document.querySelector('[data-toutes-plus]') || {}).innerText || '';
  const plusN = (/(\d+)/.exec(plus) || [])[1] || '';
  const ttNombre = (document.querySelector('[data-ventes-tableau] [data-tt-nombre], [data-tt-nombre]') || { getAttribute: () => null }).getAttribute('data-tt-nombre');
  const debord = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 || [...document.querySelectorAll('[data-tache="ventes"] *')].some((e) => vis(e) && e.getBoundingClientRect().right > innerWidth + 1 && !(() => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return true; return false; })());
  const videEl = [...document.querySelectorAll('[data-toutes-vide], [data-tache="ventes"] .n-vide, [data-tache="ventes"] [data-tt-vide]')].find(vis);
  const videTxt = ((videEl || {}).innerText || '').trim();
  return { aVenir, etats, jamaisOuverts, replis, resultats: resultats ? resultats[0] : '', pied, mots, zeros, sansPhoto: sansPhoto.length, sansPhotoVide, pastillesMain, nums: nums.length, numsBlancs, bleus, rouges, ambres, petits, alertes, lignesToutes, plus, plusN, ttNombre, debord, videTxt };
}, { tel, sombre });

const capture = async (pg, nom) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  const W = pg.viewportSize().width;
  const H = await pg.evaluate(() => { let h = document.documentElement.scrollHeight; for (const e of document.querySelectorAll('.vrm-main, .vrm-main *')) if (e.scrollHeight > e.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(e).overflowY)) h = Math.max(h, e.scrollHeight + 200); return h; });
  const avant = pg.viewportSize();
  await pg.setViewportSize({ width: W, height: Math.min(7000, Math.max(H, avant.height)) }); await pg.waitForTimeout(500);
  // (16 nov.) Une capture de 7 000 px dépasse 30 s sous charge (« gros », 1 000 ventes) : 2 min, c'est une capture, pas un contrôle.
  await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), timeout: 120000 });
  await pg.setViewportSize(avant);
};

// La liste « Terminées » (toutes les ventes, tous sites mêlés) : le segment natif de Ventes.
const allerSegment = async (pg, seg) => {
  // Un vendeur SANS vente (« vide ») n'a pas de segment : l'écran est son état vide, mesuré tel quel.
  const b = pg.locator(`[data-colis-onglet-choix="${seg}"]`).first();
  await b.waitFor({ timeout: 15000 }).catch(() => {});
  if (!(await b.count())) return false;
  await b.click({ timeout: 20000 });
  await pg.waitForTimeout(600);
  if (seg === 'toutes') await pg.waitForSelector('[data-ventes-toutes="lu"] [data-toutes-vente], [data-ventes-toutes="lu"] [data-toutes-vide], [data-ventes-toutes="lu"] [data-tt-vide], [data-ventes-toutes="lu"] [data-tt-etat="vide"]', { timeout: 25000 }).catch(() => {});
  else await pg.waitForSelector(`[data-vn-onglet="${seg}"]`, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(800);
};
// LES ANNULATIONS PAR COMPTE (Statistiques · « Annulations », src/ventesAnnulees.js, la règle de toutes les plateformes —
// 22 nov., Julien : « les ventes annulées pour chaque plateforme doivent être comptabilisées »). La période de l'écran est
// l'année (le jeu : ventes de 2 à 16 jours) ; chaque ligne par SON compte (uid), ses chiffres en data-*.
const ANNUL = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-v2-stats-periode]', { timeout: 25000 });
  await pg.selectOption('[data-v2-stats-periode]', 'annee');
  await pg.waitForSelector('[data-stats-carte="sv-annulations"] [data-sv-annul]:not([data-sv-annul="encours"])', { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(800);
  return pg.evaluate(() => {
    const c = document.querySelector('[data-stats-carte="sv-annulations"]'); if (!c) return null;
    const e = c.querySelector('[data-sv-annul]');
    const note = c.querySelector('[data-sv-annul-manque]');
    return { etat: e ? e.getAttribute('data-sv-annul') : null, pasLues: e ? e.getAttribute('data-sv-annul-pas-lues') : null, manque: note ? note.getAttribute('data-sv-annul-manque') : null, total: (c.querySelector('[data-sv-annul-total]') || { getAttribute: () => null }).getAttribute('data-sv-annul-total'),
      comptes: [...c.querySelectorAll('[data-sv-annul-compte]')].map((d) => ({ uid: d.getAttribute('data-sv-annul-compte'), site: d.getAttribute('data-sv-annul-site'), n: d.getAttribute('data-n'), annulees: d.getAttribute('data-annulees'),
        ventes: [...d.querySelectorAll('[data-sv-annul-vente]')].map((x) => x.getAttribute('data-sv-annul-vente')).sort() })),
      texte: c.textContent.replace(/\s+/g, ' ').slice(0, 300) };
  });
};

async function tournee(nav, { W, theme, scenario }) {
  const sombre = theme === 'sombre', tel = W < 600;
  const T = `[${scenario} ${W}px ${theme}]`;
  const J = JEUX[scenario];
  const base = { lignes: J.lignes(), comptes: J.comptes, ecritures: 0 };
  const o = await NV.ouvrir(nav, { W, sombre, base, tab: 'ventes' });
  await o.pg.waitForSelector('[data-tache="ventes"]', { timeout: 25000 }).catch(() => {});
  await o.pg.waitForTimeout(1500);

  // ── Ventes · Terminées (toutes les ventes, tous sites) ──
  await allerSegment(o.pg, 'toutes');
  const t = await MESURE(o.pg, { tel, sombre });
  await capture(o.pg, `e2-${scenario}-${W}-${theme}-terminees`);
  if (scenario === 'jeu') {
    // V1 : « À venir » a UNE place, Argent (« À venir » en cartes, 24 nov.) ; Ventes ne le répète pas.
    dit(!t.aVenir, 'V1', `${T} Ventes : « À venir » n’est pas répété (sa place : Argent)`, JSON.stringify(t.aVenir));
    if (tel) dit(t.etats.length >= 3 && t.etats.every((e) => e.vu && e.entier && e.fois === 1), 'V2', `${T} Terminées : l’état de chaque vente sur SA ligne, entier, écrit une fois (${t.etats.length})`, JSON.stringify(t.etats.filter((e) => !(e.vu && e.entier && e.fois === 1)).slice(0, 4)));
    dit(!tel || t.etats.some((e) => e.cle === 'envoyer'), 'V5', `${T} Terminées : la vente à faire partir porte l’état « à envoyer »`, JSON.stringify(t.etats.map((e) => e.cle + ':' + e.texte)));
    dit(!t.jamaisOuverts.length && t.replis.length === 1 && !t.replis[0].ouvert && t.replis[0].lignes === 1, 'V3', `${T} Terminées : « jamais lu » replié en UNE ligne fermée`, JSON.stringify({ ouverts: t.jamaisOuverts, replis: t.replis }));
    dit(t.sansPhoto > 0 && t.sansPhotoVide === 0, 'V7', `${T} Terminées : chaque vignette sans photo est la vignette vide commune (${t.sansPhoto})`, `${t.sansPhotoVide} sans`);
    dit(!t.pied.vendusAilleurs && !t.pied.bilan && !t.pied.compteMieux, 'V4', `${T} Ventes : ni « Vendus ailleurs », ni bilan des données, ni « Compte qui vend le mieux »`, JSON.stringify(t.pied));
  }
  if (scenario === 'jeu' || scenario === 'gros') {
    dit(!t.resultats, 'V3', `${T} Terminées : plus de « N sur N résultats »`, t.resultats);
    dit(!t.mots.length, 'V5', `${T} Terminées : aucun mot écarté`, t.mots.join(' ¦ '));
    dit(!t.zeros.length, 'V6', `${T} Terminées : aucun « ,00 € »`, t.zeros.join(' ¦ '));
    dit(!t.bleus.length && !t.rouges.length && !t.ambres.length, 'V8', `${T} Terminées : ni texte bleu, ni rouge, ni ambre sans geste`, JSON.stringify({ bleus: t.bleus.slice(0, 4), rouges: t.rouges.slice(0, 4), ambres: t.ambres.slice(0, 4) }));
    if (tel) dit(!t.petits.length, 'V9', `${T} Terminées : commandes de 44 px au doigt`, t.petits.slice(0, 8).join(' ¦ '));
    dit(!t.debord, 'G', `${T} Terminées : rien ne déborde`);
  }
  if (scenario === 'gros') {
    // Au téléphone, la liste se donne par 60 (`data-toutes-plus`) ; à l'ordinateur, le tableau de travail porte TOUTES les lignes
    // (son nombre `data-tt-nombre`, la règle du tableau). Le titre très long passe à la ligne, le prix reste entier.
    if (tel) dit(t.lignesToutes === 60 && t.plusN === '60', 'G', `${T} Terminées : 60 lignes puis « Afficher les 60 suivantes »`, JSON.stringify({ n: t.lignesToutes, plus: t.plusN }));
    else { const attendu = base.lignes.filter((l) => /^harvest_\d+_orders_sold$/.test(l.id)).flatMap((l) => l.data.payload.my_orders).filter((x) => !/annul/i.test(x.status)).length;
      dit(t.ttNombre === String(attendu), 'G', `${T} Terminées (tableau) : toutes les ventes comptées (${attendu})`, JSON.stringify({ n: t.ttNombre })); }
    const long = await o.pg.evaluate((L) => { const r = [...document.querySelectorAll('[data-toutes-vente]')].find((x) => (x.textContent || '').includes(L.slice(0, 30))); if (!r) return null; const p = r.querySelector('[data-vt-prix], [data-tt-col="prix"]'); return { prix: p ? p.textContent.trim() : '', droite: Math.round(r.getBoundingClientRect().right), entier: p ? p.scrollWidth <= p.clientWidth + 1 : false }; }, LONG);
    dit(long && long.prix === '249,50 €' && long.droite <= W && long.entier, 'G', `${T} Terminées : titre très long, prix « 249,50 € » entier`, JSON.stringify(long));
  }
  if (scenario === 'vide') {
    dit(!t.jamaisOuverts.length && /extension/i.test(t.videTxt) && !/jamais lu/i.test(t.videTxt), 'G', `${T} Terminées (vendeur neuf) : l’état vide dit quoi faire, sans phrase « jamais lu » ouverte`, JSON.stringify({ vide: t.videTxt, ouverts: t.jamaisOuverts }));
  }

  // ── Ventes · À envoyer et En route (les colis) : N° lisibles, couleurs, doigt ──
  if (scenario === 'jeu') {
    for (const seg of ['envoyer', 'envoyes']) {
      await allerSegment(o.pg, seg);
      const v = await MESURE(o.pg, { tel, sombre });
      await capture(o.pg, `e2-${scenario}-${W}-${theme}-${seg}`);
      dit(!v.mots.length, 'V5', `${T} ${seg} : aucun mot écarté`, v.mots.join(' ¦ '));
      dit(!v.zeros.length, 'V6', `${T} ${seg} : aucun « ,00 € »`, v.zeros.join(' ¦ '));
      dit(v.nums >= 1 && !v.numsBlancs, 'V7', `${T} ${seg} : chaque N° est une plaque lisible (${v.nums}), encre/fond ≥ 4,5 en sombre`, JSON.stringify({ blancs: v.numsBlancs }));
      dit(!v.bleus.length && !v.rouges.length && !v.ambres.length, 'V8', `${T} ${seg} : ni texte bleu, ni rouge, ni ambre sans geste`, JSON.stringify({ bleus: v.bleus.slice(0, 4), rouges: v.rouges.slice(0, 4), ambres: v.ambres.slice(0, 4) }));
      if (tel) dit(!v.petits.length, 'V9', `${T} ${seg} : commandes de 44 px au doigt`, v.petits.slice(0, 8).join(' ¦ '));
      dit(!v.debord, 'G', `${T} ${seg} : rien ne déborde`);
    }
    // V1 — Argent · « À venir » d'un seul compte : une carte par ÉTAPE, aucune ligne par compte.
    await o.pg.goto(`http://localhost:${PORT}/?tab=argent`, { waitUntil: 'domcontentloaded' });
    await o.pg.waitForSelector('[data-agv-avenir]', { timeout: 25000 }).catch(() => {});
    await o.pg.waitForTimeout(800);
    const av = await o.pg.evaluate(() => ({ cartes: document.querySelectorAll('[data-agv-avenir] [data-agv-etape]').length, parCompte: [...document.querySelectorAll('[data-a-venir-compte]')].filter((e) => e.getClientRects().length).length, ici: !!document.querySelector('[data-agv-avenir]') }));
    dit(av.ici && av.parCompte === 0, 'V1', `${T} Argent : « À venir » d’un seul compte — aucune ligne par compte`, JSON.stringify(av));
  }

  // ── A : les annulations PAR COMPTE (Statistiques) ──
  if (['annul', 'exclu', 'ko', 'egal'].includes(scenario)) {
    const A = await ANNUL(o.pg);
    await capture(o.pg, `e2-${scenario}-${W}-${theme}-annulations`);
    const de = (uid) => (A && A.comptes.find((c) => c.uid === uid && c.site === 'vinted')) || null;
    if (scenario === 'annul') {
      const b = de('222'), a = de('111');
      dit(!!b && b.annulees === '3' && b.n === '6', 'A', `${T} vendeuse_b : 3 annulées sur 6, sur SA ligne`, JSON.stringify(A));
      dit(!!b && JSON.stringify(b.ventes) === JSON.stringify(ANNULEES_B.map(String).sort()), 'A', `${T} la ligne de vendeuse_b liste SES ventes annulées (et seulement elles)`, JSON.stringify(b));
      dit(!!a && a.annulees === '0', 'A', `${T} vendeuse_a : aucune annulée`, JSON.stringify(a));
    }
    if (scenario === 'egal') {
      const b = de('222'), a = de('111');
      dit(!!a && !!b && a.annulees === '2' && b.annulees === '3', 'A', `${T} des parts proches : chaque compte sur SA ligne (2 et 3 annulées)`, JSON.stringify(A));
    }
    if (scenario === 'exclu') dit(!!A && A.etat === 'lu' && !de('222') && !!de('111'), 'A', `${T} le compte EXCLU n’entre pas (aucune ligne, aucun total)`, JSON.stringify(A));
    if (scenario === 'ko') {
      dit(!!A && !de('333'), 'A', `${T} un compte pas lu : aucune ligne inventée pour lui`, JSON.stringify(A));
      // Le compte pas lu est NOMMÉ par son identité dans la note de la carte (`data-sv-annul-manque`) : jamais un total qui se dit complet.
      dit(!!A && (A.etat !== 'lu' || String(A.manque || '').split(',').includes('333')), 'A', `${T} un compte pas lu : nommé, la carte ne se présente pas comme complète`, JSON.stringify(A));
    }
  }
  dit(!o.journal.erreurs.length, 'V0', `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

(async () => {
  await new Promise((ok) => NV.srv.listen(PORT, ok));
  const nav = await lancer(PW_NAV, { executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const scenario of SCENARIOS) for (const theme of THEMES) for (const W of LARGEURS) {
      if (scenario !== 'jeu' && theme === 'sombre' && W === 1512 && scenario !== 'annul') continue;   // les jeux d'annulation : un passage sombre suffit
      try { await tournee(nav, { W, theme, scenario }); }
      catch (e) { dit(false, 'V0', `[${scenario} ${W}px ${theme}] le passage a pu aller au bout`, String(e && e.stack).slice(0, 300)); }
    }
  } catch (e) { dit(false, 'V0', 'le banc a pu aller au bout', String(e && e.stack).slice(0, 400)); }
  await nav.close(); NV.srv.close();
  console.log('\n── Rouges par mesure');
  for (const [k, v] of Object.entries(compte).sort()) console.log(`   ${k} : ${v.ko} rouge(s), ${v.ok} vert(s)`);
  console.log(ko ? `\n❌ ventes-e2 : ${ko} défaut(s)` : '\n✅ ventes-e2 : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
