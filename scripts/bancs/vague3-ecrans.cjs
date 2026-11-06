// ════════════════════════════════════════════════════════════════════════════
//  BANC « VAGUE 3 — ÉCRANS » (6 nov.) — quatre défauts relevés par la revue de
//  cohérence (docs/passation/2026-11-05-revue-coherence.md, chantier E2 point 2.30,
//  chantier H « ce qui reste ») ; récit : docs/passation/2026-11-06-vague3-ecrans.md.
//  Données INVENTÉES (le dépôt est public), servies par le harnais du banc
//  `nouveau-vendeur` (aucune écriture ne sort du banc). 390 px tactile et 1512 px,
//  clair et sombre. Il MESURE (data-*, styles calculés, rectangles) :
//   F  LA FRAÎCHEUR UNE FOIS — deux comptes Vinted relus il y a 3 et 4 jours : sur
//      Annonces (Vinted), Ventes (Vinted), Colis et Statistiques, la fraîcheur des
//      lectures est dite par UNE voix (une seule source), jamais deux ;
//   S  « RANGER » VISE SA CASE — 5 meubles (la case visée hors de l'écran) :
//      « Voir au stock » (N° rangé), « Ranger au stock » (N° pas rangé : la première
//      case libre proposée) et la cloche « Où ranger à l'arrivée » ouvrent le Stock
//      la case SÉLECTIONNÉE (`data-case-vise`), défilée (dans l'écran) et ÉCLAIRÉE
//      (`data-cible-eclaire`, le crochet unique de src/cibleNotif.js) ;
//   X  LE COMPTE EXCLU NULLE PART — un troisième compte masqué (`vinted_accounts_hidden`)
//      avec ventes, annulations, notes, annonces et offres : son nom et son identifiant
//      n'apparaissent dans AUCUNE carte de Statistiques (volets ouverts) ;
//   K  LE CONTRASTE DE LA CARTE SOMBRE (`CarteStats` / `CarteMois`) — chaque texte de
//      la carte ≥ 4,5:1 (3:1 pour un grand texte) contre le POINT LE PLUS CLAIR de son
//      fond (l'arrêt le plus clair du dégradé, avec les voiles translucides au-dessus :
//      la case à 10 % de blanc) ; et la couleur vient des jetons (`--vrm-sur-sombre*`).
//   (6 nov., finitions) F : sur Colis, l'ancienne ligne de fraîcheur du bas n'est même plus RENDUE
//      (elle était cachée par fusion.css) ; K : le « — » de la carte Compta lit l'encre des vides
//      (`--vrm-sur-sombre-2`), plus le blanc plein.
//  Réglages : `BANC_PORT` (9600–9649, 9610 par défaut), `LARGEURS=390,1512`,
//  `THEMES=clair,sombre`, `POINTS=F,S,X,K`, `SHOTS=<dossier>` (captures à REGARDER),
//  `BANC_DIST` (un autre dist/, pour juger la base). Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '9610';
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const PORT = NV.PORT;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const POINTS = liste('POINTS', 'F,S,X,K');
const SHOTS = process.env.SHOTS || '';

let ko = 0;
const compte = {};
const dit = (bon, cle, quoi, det) => {
  compte[cle] = compte[cle] || { ok: 0, ko: 0 };
  if (bon) compte[cle].ok++; else { compte[cle].ko++; ko++; }
  if (!bon || process.env.BAVARD) console.log(`${bon ? 'OK  ' : 'KO  '}${cle} ${quoi}${(!bon || process.env.BAVARD) && det ? ' — ' + String(det).slice(0, 600) : ''}`);
};

// ── Les jeux ────────────────────────────────────────────────────────────────
const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString();
const jeu = () => JSON.parse(JSON.stringify(NV.JEU_LIGNES));
const ligne = (l, id) => l.find((x) => x.id === id);

// F : les deux comptes relus il y a 3 et 4 jours (ventes, annonces, achats, messages).
const vieilli = () => {
  const l = jeu();
  for (const r of l) {
    const m = /^harvest_(111|222)_/.exec(r.id);
    if (m && r.data && r.data.capturedAt) r.data.capturedAt = iso(m[1] === '111' ? 3 : 4);
  }
  return l;
};

// S : cinq meubles de 4 × 5 ; les quatre premiers PLEINS (des N° d'archive), la N°1
// rangée dans le cinquième (mE, case 7 = rangée 2, colonne 4). La première case
// libre est donc mE:0 — sous les quatre premiers meubles, hors de l'écran.
const MEUBLES = ['mA', 'mB', 'mC', 'mD', 'mE'].map((id, k) => ({ id, name: `Étagère ${'ABCDE'[k]}`, cols: 4, rows: 5, planches: [], gravite: false }));
const stock = ({ arrive = false } = {}) => {
  const l = jeu();
  const main = ligne(l, 'main').data;
  main.vrm_meubles = MEUBLES;
  const slots = {};
  let n = 900;
  for (const m of MEUBLES.slice(0, 4)) for (let i = 0; i < 20; i++) slots['B' + (n++)] = { m: m.id, i };
  slots['1'] = { m: 'mE', i: 7 };
  main.vrm_slots = slots;
  if (arrive) {
    // L'achat 73001 passe « arrivé » : la cloche propose la première case libre.
    const b = ligne(l, 'harvest_111_orders_purchased').data.payload.my_orders;
    b[1].status = 'Commande finalisée'; b[1].transaction_user_status = 'completed';
  }
  return l;
};

// X : un troisième compte, MASQUÉ, présent dans chaque source de Statistiques.
const EXCLU = { uid: '333', login: 'compte_ecarte_zz' };
const COMPTES_X = [...NV.JEU_COMPTES, { id: 3, vinted_user_id: EXCLU.uid, login: EXCLU.login, domain: 'www.vinted.fr', owner: NV.JEU_COMPTES[0].owner, updated_at: iso(0), created_at: iso(10) }];
const exclu = () => {
  const l = jeu();
  ligne(l, 'main').data.vinted_accounts_hidden = [EXCLU.uid];
  const v = (tx, statut, tus, j, prix) => ({ transaction_id: tx, title: `Jordan 1 Mid zz taille ${40 + (tx % 5)}`, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: iso(j), photo: null });
  const profil = (uid, login, rep, n, neg) => ({ id: `harvest_${uid}_profile`, data: { uid, capturedAt: iso(0.1), payload: { user: { login, feedback_reputation: rep, feedback_count: n, positive_feedback_count: n - neg, neutral_feedback_count: 0, negative_feedback_count: neg } } } });
  l.push(
    { id: `harvest_${EXCLU.uid}_orders_sold`, data: { capturedAt: iso(0.01), payload: { my_orders: [v(66001, 'Commande finalisée', 'completed', 0.5, 95), v(66002, 'Commande annulée', 'failed', 1, 80), v(66003, 'Commande finalisée', 'completed', 2, 110), v(66004, 'Commande annulée', 'failed', 3, 70)] } } },
    { id: `harvest_${EXCLU.uid}_listings`, data: { capturedAt: iso(0.01), payload: { items: [{ id: 59001, title: 'Jordan 1 Mid zz taille 43', price: { amount: '120.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, photo: null, brand_title: 'Jordan', size_title: '43', status: 'Très bon état', view_count: 40, favourite_count: 6, created_at_ts: Math.floor((now - 5 * 86400000) / 1000) }] } } },
    { id: `harvest_${EXCLU.uid}_inbox`, data: { capturedAt: iso(0.01), payload: { conversations: [{ id: 901, unread: true, updated_at: iso(0.1), description: 'Offre : 90 €', opposite_user: { id: 9901, login: 'acheteur_x' } }] } } },
    profil('111', 'vendeuse_a', 0.98, 40, 1), profil('222', 'vendeuse_b', 0.96, 12, 0), profil(EXCLU.uid, EXCLU.login, 0.7, 9, 3),
  );
  return l;
};

// ── Mesures dans la page ────────────────────────────────────────────────────
const calme = (pg) => pg.evaluate(() => new Promise((ok) => {
  const anims = () => (document.getAnimations ? document.getAnimations() : []);
  Promise.race([Promise.all(anims().map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 2500))])
    .then(() => { for (const a of anims()) { try { if (a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations !== Infinity) a.finish(); } catch (_) {} } setTimeout(ok, 120); });
})).catch(() => {});

// F — les VOIX de la fraîcheur visibles dans l'écran : chaque bloc qui dit de quand
// datent les lectures (sources : `dataAge*` des ventes captées, `annLues` des
// dressings, `joursAchatsRelus`). Un bloc contenu dans un autre ne compte pas deux fois.
const VOIX = (pg) => pg.evaluate(() => {
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let p = e; p && p !== document.documentElement; p = p.parentElement) { const s = getComputedStyle(p); if (s.visibility === 'hidden' || s.display === 'none') return false; } return !e.closest('details:not([open]) > :not(summary)'); };
  const main = document.querySelector('.vrm-main') || document.body;
  const SEL = '[data-fraicheur-voix], [data-fraicheur-comptes]:not(.vrm-etat-comptes), [data-fraicheur-ventes], [data-ann-fraicheur], [data-dash-fraicheur], [data-comptes-a-relire], [data-fraicheur-achats], .vrm-fraicheur-plat, .vrm-colis-fraicheur';
  const RE = /(datent d['’]il y a|derni[eè]re lecture|lues? (il y a|hier|aujourd)|pas relus? depuis|annonces lues|ventes vinted à jour|achats relus|comptes? à relire|relus? il y a \d)/i;
  const cands = [...main.querySelectorAll(SEL)].filter((e) => vis(e) && (e.innerText || '').trim() && (RE.test(e.innerText) || e.hasAttribute('data-comptes-a-relire') || e.hasAttribute('data-fraicheur-voix')) && !e.closest('[data-etat-panneau]'));
  const voix = cands.filter((e) => !cands.some((o) => o !== e && o.contains(e)));
  return voix.map((e) => ({ attr: [...e.attributes].map((a) => a.name).filter((n) => n.startsWith('data-')).slice(0, 3).join(' ') || e.className, texte: e.innerText.replace(/\s+/g, ' ').trim().slice(0, 90) }));
});

// K — le contraste de chaque texte de la carte sombre contre son pire fond.
const CONTRASTE = (pg) => pg.evaluate(() => {
  const rgb = (s) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(s || ''); return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null; };
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const sur = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
  const vis = (e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && Number(c.opacity) > 0.05; };
  // Les fonds possibles sous un élément, du plus profond au plus proche : le dégradé de la
  // carte (TOUS ses arrêts), puis chaque voile translucide au-dessus (la case à 10 %).
  const fonds = (e, carte) => {
    const voiles = [];
    let base = null;
    for (let x = e; x; x = x.parentElement) {
      const c = getComputedStyle(x);
      if (c.backgroundImage && /gradient/.test(c.backgroundImage)) { base = (c.backgroundImage.match(/rgba?\([^)]*\)/g) || []).map(rgb).filter(Boolean); break; }
      const b = rgb(c.backgroundColor);
      if (b && b[3] >= 0.999) { base = [b]; break; }
      if (b && b[3] > 0) voiles.unshift(b);
      if (x === carte) break;
    }
    if (!base || !base.length) base = [rgb(getComputedStyle(document.body).backgroundColor) || [0, 0, 0, 1]];
    return base.map((s) => voiles.reduce((acc, v) => sur(v, acc), sur(s, [0, 0, 0])));
  };
  const out = [];
  // La carte sombre (`CarteMois`) et la tête de Ma journée (même fond, `CarteStats` « nu » dedans).
  for (const carte of document.querySelectorAll('.vrm-main .vrm-fu-carte, .vrm-main .vrm-fu-tete')) {
    if (!vis(carte) || carte.parentElement.closest('.vrm-fu-carte, .vrm-fu-tete')) continue;
    const page = carte.getAttribute('data-carte-stats') || carte.className.split(/\s+/).filter((c) => c.startsWith('vrm-fu-') && c !== 'vrm-fu-carte').join('.') || 'carte';
    const tw = document.createTreeWalker(carte, NodeFilter.SHOW_TEXT);
    const vus = new Set();
    while (tw.nextNode()) {
      const t = tw.currentNode; if (!t.textContent.trim()) continue; const e = t.parentElement;
      if (!e || vus.has(e) || !vis(e) || e.closest('svg, .vrm-fu-sr, [disabled], [aria-disabled="true"]')) continue; vus.add(e);
      const c = getComputedStyle(e); const fg = rgb(c.color); if (!fg) continue;
      const fs = parseFloat(c.fontSize), fw = Number(c.fontWeight);
      const grand = fs >= 24 || (fs >= 18.66 && fw >= 700);
      const pire = Math.min(...fonds(e, carte).map((bg) => ratio(sur(fg, bg), bg)));
      out.push({ page, texte: t.textContent.trim().slice(0, 28), couleur: c.color, fs, grand, r: Math.round(pire * 100) / 100, ok: pire >= (grand ? 3 : 4.5) - 0.005 });
    }
  }
  return out;
});

// S — la case visée : sélectionnée, dans l'écran, éclairée.
const CASE = (pg, ici) => pg.evaluate((ici) => {
  const el = document.querySelector(`[data-case-ici="${ici}"]`);
  if (!el) return { la: false };
  const r = el.getBoundingClientRect();
  const H = innerHeight;
  return { la: true, vise: el.hasAttribute('data-case-vise'), eclaire: el.hasAttribute('data-cible-eclaire') || el.getAttribute('data-cible-notif') === 'case', dedans: r.top >= 0 && r.bottom <= H && r.height > 0, top: Math.round(r.top), H, place: el.classList.contains('is-cible') };
}, ici);
const attendreCase = async (pg, ici, ms = 9000) => {
  const t0 = Date.now(); let d = null;
  while (Date.now() - t0 < ms) { d = await CASE(pg, ici); if (d.la && d.vise && d.eclaire && d.dedans) return d; await pg.waitForTimeout(250); }
  return d;
};

const capture = async (pg, nom, plein = true) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  if (!plein) { await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); return; }
  const W = pg.viewportSize().width;
  const H = await pg.evaluate(() => { let h = document.documentElement.scrollHeight; for (const e of document.querySelectorAll('.vrm-main, .vrm-main *')) if (e.scrollHeight > e.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(e).overflowY)) h = Math.max(h, e.scrollHeight + 200); return h; });
  const avant = pg.viewportSize();
  await pg.setViewportSize({ width: W, height: Math.min(7000, Math.max(H, avant.height)) }); await pg.waitForTimeout(400);
  await pg.screenshot({ path: path.join(SHOTS, nom + '.png') });
  await pg.setViewportSize(avant);
};
const ouvrir = async (nav, { W, theme, lignes, comptes = NV.JEU_COMPTES, tab, init = null }) => {
  const base = { lignes, comptes, ecritures: 0 };
  const o = await NV.ouvrir(nav, { W, sombre: theme === 'sombre', base, tab });
  if (init) { await o.pg.evaluate(init.fn, init.arg); }
  await o.pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
  await o.pg.waitForTimeout(2500);
  return o;
};
const allerTab = async (pg, q) => { await pg.evaluate((q) => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: q })), q); await pg.waitForTimeout(2200); };
const ouvrirReplis = async (pg) => {
  await pg.evaluate(() => { for (const d of document.querySelectorAll('.vrm-main details')) d.open = true; });
  for (let k = 0; k < 3; k++) {
    const n = await pg.evaluate(() => { let n = 0; for (const b of document.querySelectorAll('.vrm-main button[aria-expanded="false"]')) { if (b.closest('[data-carte-modifier], .vrm-etat-pastille, [data-centre-notifs-cloche], [data-fiche-plus-bouton], [data-a-confirmer-ouvrir]')) continue; if (/repli|volet|stats|RepliStats/i.test(b.className + ' ' + (b.closest('section') || {}).className)) { b.click(); n++; } } return n; });
    if (!n) break; await pg.waitForTimeout(600);
  }
  await pg.evaluate(() => { for (const d of document.querySelectorAll('.vrm-main details')) d.open = true; });
  await pg.waitForTimeout(800);
};

// ── Les tournées ────────────────────────────────────────────────────────────
async function tourneeF(nav, { W, theme }) {
  const T = `[F ${W}px ${theme}]`;
  const o = await ouvrir(nav, { W, theme, lignes: vieilli(), tab: 'annonces&site=vinted' });
  const ecrans = [
    ['Annonces · Vinted', '?tab=annonces&site=vinted', '[data-ann-fraicheur], .vrm-annonces, .vrm-main'],
    ['Ventes · Vinted', '?tab=ventes&site=vinted', '.vrm-ventes-liste, [data-ventes-vide]'],
    ['Colis', '?tab=cat_bord', '[data-colis-onglet]'],
    ['Statistiques', '?tab=dashboard', '[data-sv-carte]'],
  ];
  for (const [nom, q, sel] of ecrans) {
    await allerTab(o.pg, q);
    await o.pg.waitForSelector(sel, { timeout: 15000 }).catch(() => {});
    await o.pg.waitForTimeout(1500);
    if (nom === 'Statistiques') await ouvrirReplis(o.pg);
    await calme(o.pg);
    const v = await VOIX(o.pg);
    await capture(o.pg, `v3-F-${nom.replace(/[^a-z]/gi, '')}-${W}-${theme}`);
    dit(v.length === 1, 'F', `${T} ${nom} : la fraîcheur des lectures dite par UNE voix (${v.length})`, JSON.stringify(v));
    if (nom === 'Colis') {
      // (6 nov., finitions) Une phrase par écran (§7) : la ligne du bas n'est plus rendue du tout — cachée, elle
      // redisait la puce quand la carte du haut manquait. Aucune `FraicheurDonnees` dans le DOM de Colis.
      const dom = await o.pg.evaluate(() => ({ ligne: document.querySelectorAll('.vrm-colis-fraicheur').length, puce: document.querySelectorAll('[data-comptes-a-relire]').length, phrase: [...document.querySelectorAll('.vrm-main [data-fraicheur-comptes]')].filter((e) => !e.classList.contains('vrm-etat-comptes')).length }));
      dit(dom.ligne === 0 && dom.phrase === 0 && dom.puce === 1, 'F', `${T} Colis : l'ancienne ligne de fraîcheur n'est plus RENDUE (même cachée) ; la puce seule parle`, JSON.stringify(dom));
    }
  }
  dit(!o.journal.erreurs.length, 'F0', `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

async function tourneeS(nav, { W, theme }) {
  const T = `[S ${W}px ${theme}]`;
  const tel = W < 600;
  // 1. « Voir au stock » (N°1, rangée dans mE:7) et 2. « Ranger au stock » (N°2, pas rangée).
  for (const [geste, n, ici] of [['range', '1', 'mE:7'], ['a-ranger', '2', 'mE:0']]) {
    const o = await ouvrir(nav, { W, theme, lignes: stock(), tab: 'annonces&site=vinted' });
    await o.pg.waitForSelector('[data-fiche-stock]', { state: 'attached', timeout: 20000 }).catch(() => {});
    await o.pg.waitForTimeout(800);
    const ok = await o.pg.evaluate(([geste, n]) => {
      const bs = [...document.querySelectorAll(`[data-fiche-stock="${geste}"]`)];
      const b = bs.find((x) => (x.title || '').includes(`N°${n} `)) || null;
      if (!b) return false;
      b.click(); return true;
    }, [geste, n]);
    dit(ok, 'S', `${T} (contrôle du banc) le bouton « ${geste === 'range' ? 'Voir au stock' : 'Ranger au stock'} » de la N°${n} existe`);
    if (!ok) { await o.ctx.close(); continue; }
    await o.pg.waitForSelector('[data-case-ici]', { timeout: 15000 }).catch(() => {});
    const d = await attendreCase(o.pg, ici);
    await o.pg.waitForTimeout(300);
    await capture(o.pg, `v3-S-${geste}-${W}-${theme}`, false);
    dit(!!(d && d.la && d.vise), 'S', `${T} ${geste === 'range' ? '« Voir au stock » N°1' : '« Ranger au stock » N°2'} : la case ${ici} est SÉLECTIONNÉE`, JSON.stringify(d));
    dit(!!(d && d.dedans), 'S', `${T} ${geste === 'range' ? '« Voir au stock »' : '« Ranger au stock »'} : la case ${ici} est défilée dans l'écran`, JSON.stringify(d));
    dit(!!(d && d.eclaire), 'S', `${T} ${geste === 'range' ? '« Voir au stock »' : '« Ranger au stock »'} : la case ${ici} est ÉCLAIRÉE (crochet de cibleNotif)`, JSON.stringify(d));
    if (geste === 'a-ranger') {
      // La case proposée reçoit la paire au toucher (le mode « ranger » reste celui d'avant).
      dit(!!(d && d.place), 'S', `${T} « Ranger au stock » : le Stock attend le toucher d'une case (mode ranger)`, JSON.stringify(d));
      const ecr0 = await o.pg.evaluate(() => 0);
      await o.pg.locator(`[data-case-ici="${ici}"]`).first().click().catch(() => {});
      await o.pg.waitForTimeout(900);
      const pose = await o.pg.evaluate((ici) => { const e = document.querySelector(`[data-case-ici="${ici}"]`); return e ? e.getAttribute('data-case-num') : null; }, ici);
      dit(pose === '2', 'S', `${T} toucher la case proposée y range la N°2`, `${pose} ${ecr0}`);
    }
    dit(!o.journal.erreurs.length, 'S0', `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close();
  }
  // 3. La cloche « Où ranger à l'arrivée » : l'achat 73001 vient d'arriver.
  {
    const o = await ouvrir(nav, { W, theme, lignes: stock({ arrive: true }), tab: 'journee',
      init: { fn: () => { try { localStorage.setItem('vrm_ranger_vus', JSON.stringify({ '73000': 'autre', '73001': 'autre', '73002': 'autre' })); } catch (_) {} }, arg: null } });
    // La cloche relit 4 s après le nuage : on recharge pour que `vrm_ranger_vus` soit lu au montage.
    await o.pg.reload({ waitUntil: 'domcontentloaded' });
    await o.pg.waitForSelector('[data-centre-notifs-cloche]', { timeout: 20000 }).catch(() => {});
    await o.pg.waitForTimeout(6500);
    await o.pg.locator('[data-centre-notifs-cloche]').first().click().catch(() => {});
    await o.pg.waitForSelector('[data-centre-ranger-ouvrir]', { timeout: 8000 }).catch(() => {});
    const prop = await o.pg.evaluate(() => { const l = document.querySelector('[data-centre-ranger-case]'); return l ? l.getAttribute('data-centre-ranger-case') : null; });
    dit(prop === 'mE:0', 'S', `${T} (contrôle du banc) la cloche propose la première case libre mE:0`, prop);
    const b = o.pg.locator('[data-centre-ranger-ouvrir]').first();
    if (await b.count()) {
      await b.click().catch(() => {});
      await o.pg.waitForSelector('[data-case-ici]', { timeout: 15000 }).catch(() => {});
      const d = await attendreCase(o.pg, 'mE:0');
      await capture(o.pg, `v3-S-cloche-${W}-${theme}`, false);
      dit(!!(d && d.la && d.vise), 'S', `${T} cloche « Ranger » : la case mE:0 est SÉLECTIONNÉE`, JSON.stringify(d));
      dit(!!(d && d.dedans), 'S', `${T} cloche « Ranger » : la case mE:0 est défilée dans l'écran`, JSON.stringify(d));
      dit(!!(d && d.eclaire), 'S', `${T} cloche « Ranger » : la case mE:0 est ÉCLAIRÉE`, JSON.stringify(d));
      // Toucher la case sélectionnée (vide) ouvre « choisir l'article » de CETTE case.
      await o.pg.locator('[data-case-ici="mE:0"]').first().click().catch(() => {});
      await o.pg.waitForTimeout(700);
      const modale = await o.pg.evaluate(() => !!document.querySelector('[data-stock-modale]'));
      dit(modale, 'S', `${T} cloche : toucher la case sélectionnée ouvre « choisir l'article » de cette case`);
    } else dit(false, 'S', `${T} cloche : le bouton « Ranger » est là`);
    if (!tel) dit(!o.journal.erreurs.length, 'S0', `${T} cloche : aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close();
  }
}

async function tourneeX(nav, { W, theme }) {
  const T = `[X ${W}px ${theme}]`;
  const o = await ouvrir(nav, { W, theme, lignes: exclu(), comptes: COMPTES_X, tab: 'dashboard' });
  await o.pg.waitForSelector('[data-sv-carte]', { timeout: 20000 }).catch(() => {});
  await o.pg.waitForSelector('[data-sv-annul="lu"], [data-sv-carte="annulations"][data-sv-etat]', { timeout: 15000 }).catch(() => {});
  await o.pg.waitForTimeout(2500);
  await ouvrirReplis(o.pg);
  // Les trois périodes : chacune peut porter le compte.
  for (const p of ['semaine', 'mois', 'annee']) {
    const b = o.pg.locator(`[data-sv-choix="${p}"]`).first();
    if (await b.count()) { await b.click().catch(() => {}); await o.pg.waitForTimeout(1200); await ouvrirReplis(o.pg); }
    const r = await o.pg.evaluate(({ login, uid }) => {
      const main = document.querySelector('.vrm-main') || document.body;
      const ou = [];
      const tw = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) if (n.nodeValue.includes(login) && n.parentElement && n.parentElement.getClientRects().length) { const b = n.parentElement.closest('[data-stats-carte], [data-sv-carte], section'); ou.push(((b && (b.getAttribute('data-stats-carte') || b.getAttribute('data-sv-carte') || b.className)) || '?') + ' : ' + n.nodeValue.trim().slice(0, 60)); }
      const attrs = [];
      for (const e of main.querySelectorAll('*')) for (const a of e.attributes) if (/^data-/.test(a.name) && /compte|uid|meilleur/.test(a.name) && (a.value === uid || a.value.split(/[|,: ]/).includes(uid) || a.value.includes(login))) attrs.push(`${a.name}=${a.value}`);
      const lues = !!main.querySelector('[data-sv-annul="lu"]');
      const notes = !!main.querySelector('[data-sv-notes-compte]');
      return { ou, attrs: [...new Set(attrs)], lues, notes };
    }, { login: EXCLU.login, uid: EXCLU.uid });
    if (p === 'mois') {
      dit(r.lues, 'X', `${T} (contrôle du banc) « Annulations » est lue`, JSON.stringify(r));
      dit(r.notes, 'X', `${T} (contrôle du banc) « Notes reçues » a des lignes`, JSON.stringify(r));
      await capture(o.pg, `v3-X-${W}-${theme}`);
    }
    dit(!r.ou.length && !r.attrs.length, 'X', `${T} Statistiques (${p}) : le compte EXCLU n'est écrit nulle part`, JSON.stringify({ ou: r.ou.slice(0, 6), attrs: r.attrs.slice(0, 6) }));
  }
  dit(!o.journal.erreurs.length, 'X0', `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

async function tourneeK(nav, { W, theme }) {
  const T = `[K ${W}px ${theme}]`;
  const o = await ouvrir(nav, { W, theme, lignes: jeu(), tab: 'ventes' });
  const ecrans = [['Ventes', '?tab=ventes', '[data-carte-stats]'], ['Annonces', '?tab=annonces&site=vinted', '[data-carte-stats]'], ['Colis', '?tab=cat_bord', '.vrm-fu-carte'], ['Ma journée', '?tab=journee', '.vrm-fu-tete'], ['Ventes Leboncoin', '?tab=ventes&site=leboncoin', '.vrm-fu-carte'], ['Compta', '?tab=compta', '.vrm-compta-carte']];
  for (const [nom, q, sel] of ecrans) {
    await allerTab(o.pg, q);
    await o.pg.waitForSelector(sel, { timeout: 15000 }).catch(() => {});
    await o.pg.waitForTimeout(1200);
    await calme(o.pg);
    const m = await CONTRASTE(o.pg);
    const mauvais = m.filter((x) => !x.ok);
    if (W === 1512 || nom === 'Ventes') await capture(o.pg, `v3-K-${nom.replace(/[^a-z]/gi, '')}-${W}-${theme}`, false);
    dit(m.length > 0, 'K', `${T} ${nom} : (contrôle du banc) une carte sombre est mesurée (${m.length} textes)`);
    dit(!mauvais.length, 'K', `${T} ${nom} : chaque texte de la carte sombre ≥ 4,5:1 (3:1 grand) sur son pire fond`, mauvais.slice(0, 6).map((x) => `${x.r}:1 ${x.fs}px « ${x.texte} » ${x.couleur} (${x.page})`).join(' ¦ '));
    if (nom === 'Compta') {
      // (6 nov., finitions) Le « — » d'un chiffre pas su : l'encre des vides (le jeton), comme sur toutes les cartes sombres.
      const v = await o.pg.evaluate(() => { const e = document.querySelector('.vrm-main .vrm-compta-carte .vrm-fu-grand.is-vide'); const s = getComputedStyle(document.documentElement); return e ? { t: e.textContent.trim(), couleur: getComputedStyle(e).color, jeton: s.getPropertyValue('--vrm-sur-sombre-2').trim() } : null; });
      const nums = (c) => (String(c || '').match(/[\d.]+/g) || []).map(Number).join(',');
      dit(!!v && v.t === '—', 'K', `${T} Compta : (contrôle du banc) la carte rend un « — » (bénéfice pas su)`, JSON.stringify(v));
      dit(!!v && nums(v.couleur) === nums(v.jeton), 'K', `${T} Compta : le « — » lit le jeton --vrm-sur-sombre-2 (plus le blanc plein)`, JSON.stringify(v));
    }
  }
  // La couleur des textes secondaires vient des jetons (`--vrm-sur-sombre-2`), pas d'un blanc écrit à la main.
  const jet = await o.pg.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    const v = (n) => s.getPropertyValue(n).trim();
    const el = document.querySelector('.vrm-main .vrm-fu-carte .vrm-fu-surtitre, .vrm-main .vrm-fu-carte .vrm-fu-case > span');
    return { t2: v('--vrm-sur-sombre-2'), t1: v('--vrm-sur-sombre'), fond: v('--vrm-carte-sombre'), couleur: el ? getComputedStyle(el).color : null };
  });
  const nums = (c) => (String(c || '').match(/[\d.]+/g) || []).map(Number).join(',');
  dit(!!jet.t2 && !!jet.fond && nums(jet.couleur) === nums(jet.t2), 'K', `${T} le texte secondaire de la carte sombre = le jeton --vrm-sur-sombre-2 (themeMineral.js)`, JSON.stringify(jet));
  dit(!o.journal.erreurs.length, 'K0', `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

(async () => {
  await new Promise((ok) => NV.srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const T = { F: tourneeF, S: tourneeS, X: tourneeX, K: tourneeK };
  try {
    for (const p of POINTS) for (const theme of THEMES) for (const W of LARGEURS) {
      if ((p === 'F' || p === 'X' || p === 'S') && theme === 'sombre' && W === 1512) continue;   // la règle ne dépend pas du thème : un passage sombre suffit
      try { await T[p](nav, { W, theme }); }
      catch (e) { dit(false, p + '0', `[${p} ${W}px ${theme}] le passage a pu aller au bout`, String(e && e.stack).slice(0, 300)); }
    }
  } catch (e) { dit(false, 'V0', 'le banc a pu aller au bout', String(e && e.stack).slice(0, 400)); }
  await nav.close(); NV.srv.close();
  console.log('\n── Rouges par mesure');
  for (const [k, v] of Object.entries(compte).sort()) console.log(`   ${k} : ${v.ko} rouge(s), ${v.ok} vert(s)`);
  console.log(ko ? `\n❌ vague3-ecrans : ${ko} défaut(s)` : '\n✅ vague3-ecrans : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
