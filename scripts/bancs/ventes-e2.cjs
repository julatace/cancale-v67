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
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
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
  const ZONES = '.vrm-ventes-toutes, [data-a-venir], .vrm-ventes-liste, .vrm-filtres-et-outils, .vrm-ventes-controles, .vrm-sales-analysis, [data-annulations-alerte]';
  const zones = [...document.querySelectorAll(ZONES)].filter(vis);
  const dans = (e) => zones.some((z) => z.contains(e));
  const tous = [...new Set(zones.flatMap((z) => [z, ...z.querySelectorAll('*')]))].filter((e) => !e.closest('svg') || e.tagName === 'svg');
  const visibles = tous.filter(vis);
  const texteZones = zones.map((z) => z.innerText || '').join('\n');
  const main = document.querySelector('.vrm-main');
  const texteMain = main ? main.innerText : '';
  // V1 — « À venir ».
  const av = document.querySelector('[data-a-venir]');
  const aVenir = av && vis(av) ? (() => {
    const total = (av.querySelector('[data-a-venir-total]') || av).innerText.replace(/au moins\s*/i, '').trim();
    const occ = total && total !== '—' ? (av.innerText.split(total).length - 1) : 0;
    return { groupes: Number(av.getAttribute('data-a-venir-groupes') || '-1'), lignes: av.querySelectorAll('[role="listitem"][data-a-venir-ligne]').length, resume: !!av.querySelector('[data-a-venir-resume]'), total, occ };
  })() : null;
  // V2 — l'état de chaque vente de « Tous ».
  const etats = [];
  for (const r of document.querySelectorAll('[data-toutes-vente]')) {
    if (!vis(r)) continue;
    const meta = r.querySelector('.vrm-toutes-meta'), et = r.querySelector('.vrm-toutes-etat');
    const attendu = !!(r.querySelector('[data-toutes-etat]'));
    if (!attendu) continue;
    const m = meta && vis(meta) ? meta.getBoundingClientRect() : null, e = et && vis(et) ? et.getBoundingClientRect() : null;
    etats.push({ id: r.getAttribute('data-toutes-id'), vu: !!e, dessous: !!(m && e && e.top >= m.bottom - 1), entier: !!(et && et.scrollWidth <= et.clientWidth + 1 && !/ellipsis/.test(getComputedStyle(et).textOverflow)), dansMeta: !!(meta && et && meta.innerText.includes(et.innerText.trim())), texte: et ? et.innerText.trim() : '' });
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
  const sansPhoto = [...document.querySelectorAll('[data-toutes-photo="0"]')].filter(vis);
  const sansPhotoVide = sansPhoto.filter((e) => !e.querySelector('[data-photo-vide]')).length;
  const pastillesMain = [...document.querySelectorAll('.vrm-ventes-liste .vrm-fu-num, .vrm-ventes-toutes [data-toutes-num]:not(:has([data-num]))')].filter(vis).length;
  const nums = [...document.querySelectorAll('.vrm-ventes-liste [data-num], .vrm-ventes-toutes [data-num]')].filter(vis);
  const numsBlancs = sombre ? nums.filter((e) => { const x = rgba(getComputedStyle(e).backgroundColor); return x && x.a > 0.5 && hsl(x).l > 0.8; }).length : 0;
  // V8 — les couleurs.
  const ACCENT = sombre ? 'rgb(10, 132, 255)' : 'rgb(0, 113, 227)';
  const bleus = [], rouges = [], ambres = [];
  const GESTE = '[data-ton="action"], [data-ton="urgent"], [data-achat-etat="manque"], [data-ventes-ko], [data-gestes-ligne], .vrm-fu-seg, [data-toutes-etat-site], [data-recap-litige], .vrm-sale-row[data-depose-attente]';
  for (const e of visibles) {
    const s = getComputedStyle(e);
    let t = ''; for (const n of e.childNodes) if (n.nodeType === 3) t += n.nodeValue;
    const aTexte = !!t.trim();
    const fond = s.backgroundColor.replace(/rgba\((\d+), (\d+), (\d+), 1\)/, 'rgb($1, $2, $3)');
    if (aTexte && s.color.replace(/rgba\((\d+), (\d+), (\d+), 1\)/, 'rgb($1, $2, $3)') === ACCENT && fond !== ACCENT) bleus.push(nom(e));
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
  const lignesToutes = document.querySelectorAll('[data-toutes-vente]').length;
  const plus = (document.querySelector('[data-toutes-plus]') || {}).innerText || '';
  const debord = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 || [...document.querySelectorAll('.vrm-ventes-toutes *, .vrm-ventes-liste *')].some((e) => vis(e) && e.getBoundingClientRect().right > innerWidth + 1 && !(() => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return true; return false; })());
  const videTxt = ((document.querySelector('[data-toutes-vide]') || {}).innerText || '').trim();
  return { aVenir, etats, jamaisOuverts, replis, resultats: resultats ? resultats[0] : '', pied, mots, zeros, sansPhoto: sansPhoto.length, sansPhotoVide, pastillesMain, nums: nums.length, numsBlancs, bleus, rouges, ambres, petits, alertes, lignesToutes, plus, debord, videTxt };
}, { tel, sombre });

const allerSite = async (pg, site) => {
  if (site === 'toutes') { const t = pg.locator('[data-selecteur-logos] button[data-site="toutes"]').first(); if (await t.count()) await t.click().catch(() => {}); }
  else await pg.locator(`[data-selecteur-logos] button[data-site="${site}"]`).first().click();
  await pg.waitForTimeout(1200);
  if (site === 'vinted') await pg.waitForSelector('.vrm-ventes-liste [data-tx], [data-ventes-vide], [data-ventes-ko]', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(1400);
};
const capture = async (pg, nom) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  const W = pg.viewportSize().width;
  const H = await pg.evaluate(() => { let h = document.documentElement.scrollHeight; for (const e of document.querySelectorAll('.vrm-main, .vrm-main *')) if (e.scrollHeight > e.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(e).overflowY)) h = Math.max(h, e.scrollHeight + 200); return h; });
  const avant = pg.viewportSize();
  await pg.setViewportSize({ width: W, height: Math.min(7000, Math.max(H, avant.height)) }); await pg.waitForTimeout(500);
  await pg.screenshot({ path: path.join(SHOTS, nom + '.png') });
  await pg.setViewportSize(avant);
};

async function tournee(nav, { W, theme, scenario }) {
  const sombre = theme === 'sombre', tel = W < 600;
  const T = `[${scenario} ${W}px ${theme}]`;
  const J = JEUX[scenario];
  const base = { lignes: J.lignes(), comptes: J.comptes, ecritures: 0 };
  const o = await NV.ouvrir(nav, { W, sombre, base, tab: 'ventes' });
  await o.pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
  await o.pg.waitForTimeout(2000);
  // La liste est LUE (une vente, ou l'état vide) — jamais mesurée pendant le chargement.
  await o.pg.waitForSelector('[data-ventes-toutes="lu"] [data-toutes-vente], [data-ventes-toutes="lu"] [data-toutes-vide]', { timeout: 25000 }).catch(() => {});
  if (scenario !== 'vide') await o.pg.waitForSelector('[data-a-venir]', { timeout: 20000 }).catch(() => {});
  await o.pg.waitForTimeout(800);

  // ── Ventes · Tous ──
  const t = await MESURE(o.pg, { tel, sombre });
  await capture(o.pg, `e2-${scenario}-${W}-${theme}-tous`);
  if (scenario === 'jeu') {
    dit(t.aVenir && t.aVenir.groupes === 1 && t.aVenir.lignes === 0 && t.aVenir.resume && t.aVenir.occ === 1, 'V1', `${T} Tous : « À venir » d’un seul compte — aucune ligne par compte, le total écrit une fois`, JSON.stringify(t.aVenir));
    if (tel) dit(t.etats.length >= 3 && t.etats.every((e) => e.vu && e.dessous && e.entier && !e.dansMeta), 'V2', `${T} Tous : l’état de chaque vente sur SA ligne, entier (${t.etats.length})`, JSON.stringify(t.etats.filter((e) => !(e.vu && e.dessous && e.entier && !e.dansMeta)).slice(0, 4)));
    dit(t.etats.some((e) => e.texte === 'À envoyer') || !tel, 'V5', `${T} Tous : la vente à faire partir dit « À envoyer »`, JSON.stringify(t.etats.map((e) => e.texte)));
    dit(!t.jamaisOuverts.length && t.replis.length === 1 && !t.replis[0].ouvert && t.replis[0].lignes === 1, 'V3', `${T} Tous : « jamais lu » replié en UNE ligne fermée`, JSON.stringify({ ouverts: t.jamaisOuverts, replis: t.replis }));
    dit(t.sansPhoto > 0 && t.sansPhotoVide === 0, 'V7', `${T} Tous : chaque vignette sans photo est \`PhotoVide\` (${t.sansPhoto})`, `${t.sansPhotoVide} sans`);
  }
  if (scenario === 'jeu' || scenario === 'gros') {
    dit(!t.resultats, 'V3', `${T} Tous : plus de « N sur N résultats »`, t.resultats);
    dit(!t.mots.length, 'V5', `${T} Tous : aucun mot écarté`, t.mots.join(' ¦ '));
    dit(!t.zeros.length, 'V6', `${T} Tous : aucun « ,00 € »`, t.zeros.join(' ¦ '));
    dit(!t.bleus.length && !t.rouges.length && !t.ambres.length, 'V8', `${T} Tous : ni texte bleu d’aplat, ni rouge, ni ambre sans geste`, JSON.stringify({ bleus: t.bleus.slice(0, 4), rouges: t.rouges.slice(0, 4), ambres: t.ambres.slice(0, 4) }));
    if (tel) dit(!t.petits.length, 'V9', `${T} Tous : commandes de 44 px au doigt`, t.petits.slice(0, 8).join(' ¦ '));
    dit(!t.debord, 'G', `${T} Tous : rien ne déborde`);
  }
  if (scenario === 'gros') {
    dit(t.lignesToutes === 60 && /Afficher les 60 suivantes/.test(t.plus), 'G', `${T} Tous : 60 lignes puis « Afficher les 60 suivantes »`, JSON.stringify({ n: t.lignesToutes, plus: t.plus }));
    const long = await o.pg.evaluate((L) => { const r = [...document.querySelectorAll('[data-toutes-vente]')].find((x) => (x.innerText || '').includes(L.slice(0, 30))); if (!r) return null; const p = r.querySelector('[data-toutes-prix]'); return { prix: p ? p.innerText : '', droite: Math.round(r.getBoundingClientRect().right) }; }, LONG);
    dit(long && long.prix === '249,50 €' && long.droite <= W, 'G', `${T} Tous : titre très long à la ligne, prix « 249,50 € » entier`, JSON.stringify(long));
  }
  if (scenario === 'vide') {
    dit(!t.jamaisOuverts.length && /extension/i.test(t.videTxt) && !/jamais lu/i.test(t.videTxt), 'G', `${T} Tous (vendeur neuf) : l’état vide dit quoi faire, sans phrase « jamais lu » ouverte`, JSON.stringify({ vide: t.videTxt, ouverts: t.jamaisOuverts }));
  }

  // ── Ventes · Vinted ──
  if (scenario !== 'vide') {
    await allerSite(o.pg, 'vinted');
    const v = await MESURE(o.pg, { tel, sombre });
    await capture(o.pg, `e2-${scenario}-${W}-${theme}-vinted`);
    if (scenario === 'jeu') {
      dit(v.aVenir && v.aVenir.lignes === 0 && v.aVenir.occ === 1, 'V1', `${T} Vinted : « À venir » d’un seul compte — le total une fois, aucune ligne`, JSON.stringify(v.aVenir));
      dit(!v.mots.length, 'V5', `${T} Vinted : aucun mot écarté (filtres, lignes)`, v.mots.join(' ¦ '));
      dit(!v.zeros.length, 'V6', `${T} Vinted : aucun « ,00 € »`, v.zeros.join(' ¦ '));
      dit(v.nums >= 3 && !v.pastillesMain && !v.numsBlancs, 'V7', `${T} Vinted : chaque N° est \`Numero\` (${v.nums}), jamais blanc en sombre`, JSON.stringify({ main: v.pastillesMain, blancs: v.numsBlancs }));
      dit(!v.bleus.length && !v.rouges.length && !v.ambres.length, 'V8', `${T} Vinted : ni texte bleu d’aplat, ni rouge, ni ambre sans geste`, JSON.stringify({ bleus: v.bleus.slice(0, 4), rouges: v.rouges.slice(0, 4), ambres: v.ambres.slice(0, 4) }));
      dit(!v.pied.vendusAilleurs && !v.pied.bilan, 'V4', `${T} Vinted : ni « Vendus ailleurs » ni le bilan des données en pied`, JSON.stringify(v.pied));
      if (tel) dit(!v.petits.length, 'V9', `${T} Vinted : commandes de 44 px au doigt`, v.petits.slice(0, 8).join(' ¦ '));
      dit(!v.debord, 'G', `${T} Vinted : rien ne déborde`);
      // L'analyse dépliée : « Compte qui vend le mieux » n'y est plus (une place : Statistiques).
      const b = o.pg.locator('.vrm-sales-analysis button[aria-expanded]').first();
      if (await b.count()) { await b.click(); await o.pg.waitForTimeout(600); }
      const v2 = await MESURE(o.pg, { tel, sombre });
      dit(!v2.pied.compteMieux, 'V4', `${T} Vinted · Analyse : « Compte qui vend le mieux » n’est plus dans Ventes`, JSON.stringify(v2.pied));
      dit(!v2.zeros.length && !v2.mots.length, 'V6', `${T} Vinted · Analyse : ni « ,00 € » ni mot écarté`, JSON.stringify({ z: v2.zeros.slice(0, 4), m: v2.mots }));
    }
    if (scenario === 'annul') {
      dit(v.alertes.length === 1 && v.alertes[0].uid === '222' && v.alertes[0].n === '3' && v.alertes[0].sur === '6', 'A', `${T} un compte à 50 % d’annulations contre 0 % : dit UNE fois (vendeuse_b, 3 sur 6)`, JSON.stringify(v.alertes));
      const s = o.pg.locator('[data-annulations-alerte] summary').first();
      if (await s.count()) { await s.click(); await o.pg.waitForTimeout(400); }
      const v3 = await MESURE(o.pg, { tel, sombre });
      const ids = (v3.alertes[0] || { ventes: [] }).ventes.slice().sort();
      dit(JSON.stringify(ids) === JSON.stringify(ANNULEES_B.map(String).sort()), 'A', `${T} l’alerte liste SES ventes annulées (et seulement elles)`, JSON.stringify(ids));
      dit(!v3.rouges.length && !v3.ambres.length, 'A', `${T} l’alerte n’a ni rouge ni ambre (aucun geste urgent)`, JSON.stringify({ r: v3.rouges.slice(0, 3), a: v3.ambres.slice(0, 3) }));
      if (tel) dit(!v3.petits.length, 'A', `${T} l’alerte ouverte : 44 px au doigt`, v3.petits.slice(0, 6).join(' ¦ '));
      await capture(o.pg, `e2-${scenario}-${W}-${theme}-vinted-alerte`);
      // Le compte choisi : vendeuse_a ⇒ rien ; vendeuse_b ⇒ l'alerte.
      const choisir = async (login) => { const c = o.pg.locator(`button:has-text("${login}")`).first(); if (await c.count()) { await c.click(); await o.pg.waitForTimeout(1200); return true; } return false; };
      if (await choisir('vendeuse_a')) { const va = await MESURE(o.pg, { tel, sombre }); dit(!va.alertes.length, 'A', `${T} compte vendeuse_a choisi : pas d’alerte (elle n’annule pas)`, JSON.stringify(va.alertes)); }
      if (await choisir('vendeuse_b')) { const vb = await MESURE(o.pg, { tel, sombre }); dit(vb.alertes.length === 1, 'A', `${T} compte vendeuse_b choisi : l’alerte est là`, JSON.stringify(vb.alertes)); }
    }
    if (scenario === 'exclu') dit(!v.alertes.length && !/vendeuse_b/.test(JSON.stringify(v.alertes)), 'A', `${T} le compte EXCLU : aucune alerte`, JSON.stringify(v.alertes));
    if (scenario === 'egal') dit(!v.alertes.length, 'A', `${T} des parts proches (2/8 contre 3/9) : aucune alerte`, JSON.stringify(v.alertes));
    if (scenario === 'ko') {
      const koVu = await o.pg.evaluate(() => !!document.querySelector('[data-ventes-ko]'));
      dit(koVu, 'A', `${T} (contrôle du banc) le compte vendeuse_c n’a pas pu être lu`);
      dit(!v.alertes.length, 'A', `${T} un compte pas lu : « pas su », aucune alerte`, JSON.stringify(v.alertes));
    }
  }
  dit(!o.journal.erreurs.length, 'V0', `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

(async () => {
  await new Promise((ok) => NV.srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
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
