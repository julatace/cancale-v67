require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  « AUJOURD'HUI » AVEC MOINS DE TEXTE (25 nov.) — Julien, sur ses captures iPhone (style Monochrome) :
//  « C'est pas mal mais trop de texte, améliore. » Récit : docs/passation/2026-11-25-aujourdhui-moins-texte.md.
//
//  L'app RENDUE (dist/), base INVENTÉE qui REPRODUIT ses captures (aucune donnée réelle : le dépôt est public) :
//  un compte « shop_cancale », 5 annonces disparues entre deux lectures, « Tout arrêter » posé, l'ordinateur éteint
//  depuis 07:37, le vendu des 7 derniers jours ÉGAL à celui des 7 jours d'avant (écart ±0 %), 12 N° à écrire, le
//  porte-monnaie lu il y a 13 jours, une paire à republier en priorité, un seul site qui a vendu.
//  Il juge (les data-* et les nombres rendus, jamais un libellé) :
//    M  MOTS     — le nombre de mots rendus dans la colonne principale (innerText de `.vrm-main`) ≤ MOTS_MAX ;
//    T  COUPÉ    — aucun chiffre ni titre de carte tronqué (scrollWidth ≤ clientWidth + 1) à 390 et 1512 ;
//    Z  ±0 %     — un écart nul n'a ni flèche montante ni couleur de hausse (ni vert, ni la classe `n-heros-hausse`) ;
//    S  PAR SITE — la carte « Par site » est ABSENTE quand un seul site a vendu dans la fenêtre ;
//    D  DOUBLON  — aucun montant (≥ 100 €) écrit deux fois dans l'écran ;
//    G  GESTES   — chaque geste reste là : Reprendre, C'est écrit, Imprimer, les 2 cases Colis, la rangée de l'ordinateur,
//                  la ligne des annonces disparues (qui ouvre sa feuille), le porte-monnaie (ses deux montants).
//    P  PAUSE    — (27 nov., Julien sur « ● En pause · Reprendre » : « je ne comprends pas à quoi ça sert ») la carte « Tout
//                  arrêter » dit ce qui est arrêté : un titre VU d'au moins 3 mots (plus « En pause » seul), une ligne VUE qui
//                  nomme les sortes arrêtées (`data-tout-quoi` = offres favoris republications) et l'heure de l'arrêt
//                  (`data-tout-depuis` = l'heure de Paris de `tout.at`, écrite dans la ligne), « Pourquoi ? » replié, le bouton ≥ 44 px.
//  Réglages : `BANC_DIST` (un autre build : l'AVANT), `LARGEURS=390,1512`, `THEMES=clair,sombre`, `STYLES=,monochrome`,
//  `SHOTS=<dossier>` (captures à REGARDER), `DSF=2`, `MOTS_MAX` (défaut : la moitié des mots VUS d'origin/main sur la même base, 106 à 390 px et 124 à 1512 px), `MUTATION=fleche|site|tronque|pause` (rouge attendu).
//  Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.TZ = 'Europe/Paris';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { fabriquer } = require('./_base-volume.cjs');
const SHOTS = process.env.SHOTS || '';
const MUT = process.env.MUTATION || '';
const liste = (v, d) => String(process.env[v] == null ? d : process.env[v]).split(',').map((x) => x.trim());
const LARGEURS = liste('LARGEURS', '390,1512').filter(Boolean).map(Number), THEMES = liste('THEMES', 'clair,sombre').filter(Boolean);
const STYLES = liste('STYLES', ',monochrome');
const DSF = Number(process.env.DSF || 1);
// La moitié des mots VUS d'origin/main sur la même base (25 nov. : 213 à 390 px, 249 à 1512 px).
// (27 nov.) + 11 : la carte « Tout arrêter » DEMANDÉE claire (Julien sur « En pause » : « je ne comprends pas à quoi ça sert ») —
// « Gestes automatiques arrêtés » · « Offres, favoris, republications : rien ne part · depuis HH:MM » · « Pourquoi ? » à la place
// de « En pause » (mesuré : +11 mots à 390 et à 1512 sur cette base). Le reste de l'écran garde son budget.
const MOTS_CARTE_PAUSE = 11;
// (27 nov., ameliorations-27nov — Julien : « Ordinateur éteint · 21:20 », « Vas-y fais tout ») + 8 : la phrase DEMANDÉE sous
// « Ordinateur éteint » (« Rien ne part tant qu’il est éteint », 7 mots) et son « Pourquoi ? » (mesuré : +8 à 390 et à 1512).
const MOTS_ORDI_ETEINT = 8;
const MOTS_MAX = (W) => Number(process.env.MOTS_MAX || (W < 600 ? 106 : 124) + MOTS_CARTE_PAUSE + MOTS_ORDI_ETEINT);
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : '')); } return c; };

const J = 86400000;
const minuit = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const APPAREIL = '0123456789abcdef';
const ICI = 'data:image/svg+xml,' ;
const vignette = (i) => ICI + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="hsl(${(i * 47) % 360} 14% ${58 + (i % 4) * 7}%)"/><path d="M14 52c10-2 22-14 30-14s12 8 22 8v10H14z" fill="#fff" opacity=".85"/></svg>`);

function baseCapture() {
  const b = fabriquer({ comptes: 1, qr: true });
  const m = b.main[0].data; const at = '2026-11-01T10:00:00.000Z';
  m.vrm_bienvenue_vue = { at }; m.vrm_visite_vue = { at }; m.vrm_je_vends = { choix: 'sneakers', at };
  m.vrm_configuration = { etat: 'fait', at, statut: null, version: 1 }; m.vrm_plateformes_affichees = { sites: ['vinted', 'leboncoin', 'ebay'], at };
  m.vrm_parcours = { etat: 'fini', at }; m.vrm_bilan_minute = { vu: at, fin: 'vu' };
  const a = b.accounts[0]; const uid = String(a.vinted_user_id);
  a.login = 'shop_cancale';
  for (const r of b.rows) { const u = r.data && r.data.payload && r.data.payload.user; if (u && String(u.id) === uid) u.login = 'shop_cancale'; }
  m.vinted_account_labels = { [uid]: 'shop_cancale' };
  // L'extension de ce navigateur : vue il y a une minute (la lecture « en ligne » reste fraîche).
  b.rows.push({ id: 'ext_appareil_' + APPAREIL, data: { appareil: { paquet: 'chromium', nav: 'chrome', systeme: 'mac' }, ver: '5.440.3', code: '5.440.3', atMs: Date.now() - 60000, flux: {}, vus: { vinted: { [uid]: Date.now() - 120000 } } } });
  // L'ordinateur qui agit à distance : éteint depuis 07:37 aujourd'hui (sa présence date de là).
  const eteint = new Date(); eteint.setHours(7, 37, 0, 0); if (eteint.getTime() > Date.now()) eteint.setDate(eteint.getDate() - 1);
  b.rows.push({ id: 'presence_' + APPAREIL, data: { v: 1, at: eteint.toISOString(), atMs: eteint.getTime(), ver: '5.440.3', code: '5.440.3', appareil: { paquet: 'chromium', nav: 'chrome', systeme: 'mac' },
    comptes: [{ site: 'vinted', id: uid, nom: 'shop_cancale' }], retenues: [], enCours: '', rt: 'joint', lus: {} } });
  // « Tout arrêter » posé (le réglage de discrétion, synchronisé).
  m.vinted_discretion = { tout: { on: true, at: Date.now() - 3 * 3600000 } };
  b.rows.push({ id: `actions_compte_${uid}_${APPAREIL}`, data: { uid, nav: APPAREIL, ts: [], at: new Date(Date.now() - 4 * 60000).toISOString(), max: 50, ta: { on: true, at: Date.now() - 3 * 3600000 } } });
  // 12 N° neufs à écrire sur les rangements.
  m.vrm_numeros_a_ecrire = { v: 1, items: ['252', '253', '258', '259', '260', '261', '262', '263', '264', '265', '266', '267'].map((numero) => ({ numero, at: Date.now() - 3600000 })) };
  // 5 annonces disparues de shop_cancale entre le 21 et le 23 (deux lectures du dressing).
  const T = minuit() - 2 * J + 9 * 3600000, AV = minuit() - 4 * J + 9 * 3600000;
  const fiches = m.vinted_annonce_numeros = m.vinted_annonce_numeros || {};
  const evts = [];
  for (let i = 0; i < 5; i++) { const id = String(2000000 + i); evts.push({ k: `disparue:${id}:${T - i * 60000}`, s: 'disparue', t: T - i * 60000, a: id, av: AV });
    fiches[id] = { numero: String(132 + i * 3), numberedAt: new Date(Date.now() - 20 * J).toISOString(), title: `Nike Air Max 90 blanche taille ${39 + i}`, photo: vignette(i) }; }
  b.rows.push({ id: `moderation_vinted_${uid}`, data: { uid, v: '5.350.0', e: evts } });
  // Le porte-monnaie Vinted lu il y a 13 jours : 2 165 € en attente, 111,09 € disponibles.
  const bill = b.rows.find((r) => r.id === `harvest_${uid}_billing`);
  const billing = { capturedAt: new Date(Date.now() - 13 * J).toISOString(), payload: { escrow: { amount: '2165.0', currency_code: 'EUR' }, main: { amount: '111.09', currency_code: 'EUR' } } };
  if (bill) bill.data = billing; else b.rows.push({ id: `harvest_${uid}_billing`, data: billing });
  // Le vendu des 7 derniers jours = celui des 7 jours d'avant (écart ±0 %) : la vente la plus récente de la fenêtre la
  // plus basse porte la différence. Un seul site vend (Vinted).
  const sold = b.rows.find((r) => /_orders_sold$/.test(r.id));
  const vent = sold.data.payload.my_orders;
  const M7 = minuit() - 6 * J, M14 = M7 - 7 * J;
  const compte = (o) => !/Remboursement/.test(o.status) && o.price && o.price.amount !== '';
  const fen = (de, a) => vent.filter((o) => { const t = Date.parse(o.date); return t >= de && t < a && compte(o); });
  const somme = (L) => L.reduce((s, o) => s + Number(o.price.amount), 0);
  const A = fen(M7, Date.now() + J), B = fen(M14, M7);
  const d = Math.round((somme(A) - somme(B)) * 100) / 100;
  const cible = d > 0 ? B[0] : A[0];
  if (cible && d) cible.price.amount = String(Math.round((Number(cible.price.amount) + Math.abs(d)) * 100) / 100);
  // « Reçu » incomplet (CLAUDE.md §5 : « au moins ») : une vente finalisée de ce mois, hors des deux fenêtres, au prix illisible.
  const debutMois = new Date(minuit()); debutMois.setDate(1);
  const illisible = vent.find((o) => o.status === 'Commande finalisée' && Date.parse(o.date) >= debutMois.getTime() && Date.parse(o.date) < M14);
  if (illisible) illisible.price = { amount: '', currency_code: 'EUR' };
  b.attendu = { uid, sept: somme(fen(M7, Date.now() + J)), avant: somme(fen(M14, M7)) };
  return b;
}

async function ouvrir(nav, { W, sombre, style, b }) {
  const { ctx, pg, erreurs } = await P.ouvrir(nav, { W: W < 600 ? 390 : 1512, sombre, b, url: '/?tab=journee', dsf: DSF });
  if (W < 600) { try { const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34, left: 0, right: 0 } }); } catch (_) { /* sans zone sûre */ } }
  await pg.evaluate(([style, uid]) => { try {
    localStorage.setItem('vrm_design_v2', '1');
    if (style) localStorage.setItem('vrm_style', JSON.stringify(style)); else localStorage.removeItem('vrm_style');
    localStorage.setItem('vrm_repub_priorite', JSON.stringify({ owner: uid, n: 1, montres: 1, jours: 30, at: Date.now() }));
  } catch (_) {} }, [style, P.UID]);
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-v2-ecran="aujourdhui"]', { timeout: 45000 }).catch(() => {});
  await pg.waitForFunction(() => { const e = document.querySelector('[data-v2-ecran="aujourdhui"]'); return !!e && !e.hasAttribute('data-v2-attente'); }, null, { timeout: 45000 }).catch(() => {});
  let avant = '', egaux = 0;
  for (let k = 0; k < 16 && egaux < 2; k++) { await pg.waitForTimeout(1200); const s = await pg.evaluate(() => { const e = document.querySelector('.vrm-main'); return e ? e.innerText : ''; }); if (s && s === avant) egaux++; else egaux = 0; avant = s; }
  await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast, [data-toast-numeros] button')) t.click(); }).catch(() => {});
  await pg.waitForTimeout(600);
  if (MUT) await pg.evaluate((mut) => {
    // Les mutations remettent le défaut DANS la page : chacune doit rougir SA mesure.
    if (mut === 'fleche') { const e = document.querySelector('[data-pil-ecart]'); if (e) { e.className = 'n-heros-hausse'; e.textContent = '▲ ' + e.textContent; } }
    if (mut === 'site') { const h = document.querySelector('[data-v2-ecran="aujourdhui"]'); const c = document.createElement('section'); c.setAttribute('data-v2-bloc', 'sites'); c.textContent = 'Par site · 7 jours · Vinted 654,10 € 100 %'; h.appendChild(c); }
    if (mut === 'pause') { const c = document.querySelector('[data-tout-arrete]'); if (c) { const t = c.querySelector('[data-tout-titre]'); if (t) t.textContent = 'En pause'; const l = c.querySelector('[data-tout-ligne]'); if (l) l.remove(); } }
    if (mut === 'tronque') { const e = document.querySelector('[data-pil-recu], [data-pil-benef-fen]'); if (e) { e.style.maxWidth = '40px'; e.style.overflow = 'hidden'; e.style.whiteSpace = 'nowrap'; e.style.display = 'block'; e.textContent = 'au moins 1 234,56 € reçus en novembre'; } }
  }, MUT);
  return { ctx, pg, erreurs };
}

// La mesure, DANS la page.
const MESURER = () => {
  const main = document.querySelector('.vrm-main') || document.body;
  // Les mots VUS : le texte réservé au lecteur d'écran (1 px, découpé) ne compte pas — il est retiré le temps de la lecture.
  const caches = [...main.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width <= 1 && r.height <= 1 && (cs.clipPath !== 'none' || cs.clip !== 'auto') && cs.position === 'absolute'; });
  const avant = caches.map((e) => e.style.display); caches.forEach((e) => { e.style.display = 'none'; });
  const texte = main.innerText || '';
  caches.forEach((e, i) => { e.style.display = avant[i]; });
  // Un nombre est UN mot (« 2 165 € », « 100 000 ») : les espaces entre ses groupes de chiffres ne coupent pas.
  const mots = texte.replace(/(\d)[\s\u202f\u00a0](?=\d)/g, '$1').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const ecran = document.querySelector('[data-v2-ecran="aujourdhui"]');
  // T : les chiffres et titres coupés (un texte plus large que sa boîte, sans retour à la ligne permis).
  const coupes = [];
  const cand = main.querySelectorAll('.n-heros-trio *, .n-cc-valeur, .n-cc-sous, .n-cc-libelle, .n-carte-titre, .n-rangee-titre, .n-rangee-sous, .n-heros-valeur, .n-heros-sous, [data-pil-recu], [data-pil-benef-fen], [data-pil-avenir], .vrm-mod-disp-titre, .vrm-mod-disp-quand, .vrm-verif-texte, h2, h3');
  for (const e of cand) {
    if (!e.getClientRects().length || e.children.length > 3 || e.getBoundingClientRect().width <= 1) continue;   // le texte réservé au lecteur d'écran n'est pas « coupé »
    const cs = getComputedStyle(e);
    if (e.scrollWidth > e.clientWidth + 1 && (cs.overflow !== 'visible' || cs.textOverflow === 'ellipsis' || cs.overflowX !== 'visible')) coupes.push((e.className || e.tagName) + ' « ' + (e.innerText || '').slice(0, 40) + ' » ' + e.scrollWidth + '>' + e.clientWidth);
  }
  // Z : l'écart nul.
  const ec = document.querySelector('[data-pil-ecart]');
  const ecart = ec ? { v: ec.getAttribute('data-pil-ecart'), cls: ec.className, txt: ec.innerText, couleur: getComputedStyle(ec).color, vert: (() => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(ec).color); return !!m && +m[2] > +m[1] + 30 && +m[2] > +m[3] + 10; })() } : null;
  // S : par site.
  const sites = main.querySelectorAll('[data-v2-bloc="sites"]').length;
  const nSites = (() => { const h = document.querySelector('[data-pil-sites]'); return h ? h.getAttribute('data-pil-sites').split(',').filter(Boolean).length : 0; })();
  // D : les montants ≥ 100 € écrits plus d'une fois (texte visible).
  const montants = {}; for (const mm of texte.matchAll(/(\d{1,3}(?:[\s  ]\d{3})+|\d{3,})(?:,\d{2})?\s?€/g)) { const k = mm[0].replace(/[\s  ]/g, ''); montants[k] = (montants[k] || 0) + 1; }
  const doubles = Object.entries(montants).filter(([, n]) => n > 1).map(([k, n]) => k + '×' + n);
  // G : les gestes.
  const g = (s) => !!main.querySelector(s) || !!document.querySelector(s);
  const gestes = { reprendre: g('[data-tout-reprendre]'), ecrit: g('[data-numeros-ecrits="journee"]'), imprimer: g('[data-v2-principal], [data-v2-imprimer-rien]'),
    envoyer: g('[data-v2-cj-ligne="envoyer"]'), retirer: g('[data-v2-cj-ligne="retirer"]'), ordi: g('[data-adist-jour-rangee]'), disparues: g('[data-moderation-disparues]'),
    recuPartiel: !!document.querySelector('[data-pil-recu-partiel="1"]') || !document.querySelector('[data-pil-recu]'),
    pm: !!document.querySelector('[data-v2-bloc="portemonnaie"][data-pm-attente="216500"][data-pm-dispo="11109"]'), prio: g('[data-prio-journee]') };
  // P : la carte « Tout arrêter ».
  const vu = (e) => !!e && e.getClientRects().length > 0 && e.getBoundingClientRect().width > 1 && getComputedStyle(e).visibility !== 'hidden';
  const nMots = (e) => (e && e.innerText || '').trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const pc = document.querySelector('[data-tout-arrete]');
  const pause = pc ? (() => { const t = pc.querySelector('[data-tout-titre]'), l = pc.querySelector('[data-tout-ligne]'), b = pc.querySelector('[data-tout-reprendre]');
    return { at: Number(pc.getAttribute('data-tout-arrete')), quoi: (pc.getAttribute('data-tout-quoi') || '').split(/\s+/).filter(Boolean), depuis: pc.getAttribute('data-tout-depuis') || '',
      titreVu: vu(t), titreMots: nMots(t), ligneVue: vu(l), ligneMots: nMots(l), ligneHeure: !!l && !!pc.getAttribute('data-tout-depuis') && l.innerText.includes(pc.getAttribute('data-tout-depuis')),
      pourquoi: !!pc.querySelector('details[data-tout-pourquoi]'), bouton: b ? Math.round(b.getBoundingClientRect().height) : 0 }; })() : null;
  return { pause, mots: mots.length, texte, coupes, ecart, sites, nSites, doubles, gestes, ecran: !!ecran, debord: document.documentElement.scrollWidth > window.innerWidth + 1 };
};

// (27 nov.) La base et l'ouverture servent aussi le banc `actions-rondes-onglets.cjs` (la même capture de Julien).
module.exports = { baseCapture, ouvrir };
if (require.main === module) (async () => {
  const b = baseCapture();
  console.log(`Base : vendu 7 j ${b.attendu.sept} € · 7 j d'avant ${b.attendu.avant} €`);
  await new Promise((ok) => P.srv.listen(P.PORT, ok));
  const nav = await P.chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const resume = [];
  try {
    for (const W of LARGEURS) for (const theme of THEMES) for (const style of STYLES) {
      const nom = `${W}-${theme}${style ? '-' + style : ''}`;
      console.log(`\n▶ ${nom}`);
      const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre: theme === 'sombre', style, b });
      try {
        const r = await pg.evaluate(MESURER);
        resume.push({ nom, mots: r.mots });
        if (SHOTS) {
          // L'écran entier : la page défile dans son conteneur, la fenêtre prend la hauteur de ce qui défile.
          fs.mkdirSync(SHOTS, { recursive: true }); fs.writeFileSync(path.join(SHOTS, nom + '.txt'), r.texte);
          const h = await pg.evaluate(() => { let m = document.documentElement.scrollHeight; for (const e of document.querySelectorAll('body *')) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4) m = Math.max(m, e.scrollHeight + e.getBoundingClientRect().top + 120); } return Math.ceil(m); });
          const v = pg.viewportSize(); await pg.setViewportSize({ width: v.width, height: Math.min(6000, Math.max(v.height, h)) }); await pg.waitForTimeout(700);
          await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); await pg.setViewportSize(v);
        }
        dit(r.ecran, 'l\'écran Aujourd\'hui est rendu');
        dit(!erreurs.length, 'aucune erreur JS', erreurs);
        dit(!r.debord, 'aucun défilement de côté');
        dit(r.mots <= MOTS_MAX(W), `M mots rendus ${r.mots} ≤ ${MOTS_MAX(W)}`);
        dit(!r.coupes.length, 'T aucun chiffre ni titre coupé', r.coupes);
        dit(!!r.ecart && r.ecart.v === '0', 'Z la base sert un écart nul (data-pil-ecart="0")', r.ecart);
        if (r.ecart && r.ecart.v === '0') dit(!/hausse/.test(r.ecart.cls) && !/[▲▼↑↗]/.test(r.ecart.txt) && !r.ecart.vert, 'Z ±0 % sans flèche ni couleur de hausse', r.ecart);
        dit(r.sites === 0, 'S « Par site » absent avec un seul site', { sites: r.sites, nSites: r.nSites });
        dit(!r.doubles.length, 'D aucun montant écrit deux fois', r.doubles);
        const manque = Object.entries(r.gestes).filter(([, v]) => !v).map(([k]) => k);
        dit(!manque.length, 'G chaque geste est là', manque);
        const pa = r.pause; const heureAt = pa && pa.at > 0 ? new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(pa.at)) : '?';
        dit(!!pa && pa.titreVu && pa.titreMots >= 3, 'P le titre de la carte « Tout arrêter » se voit et dit ce qui est arrêté (≥ 3 mots, plus « En pause » seul)', pa);
        dit(!!pa && pa.ligneVue && pa.ligneMots >= 4 && ['offres', 'favoris', 'republications'].every((q) => pa.quoi.includes(q)), 'P la ligne VUE nomme ce qui ne part plus (offres, favoris, republications)', pa);
        dit(!!pa && pa.depuis === heureAt && pa.ligneHeure, `P « depuis ${heureAt} » (heure de Paris de l'arrêt) écrit dans la ligne`, pa);
        dit(!!pa && pa.pourquoi && pa.bouton >= 44, 'P « Pourquoi ? » replié et « Tout relancer » ≥ 44 px', pa);
      } catch (e) { dit(false, 'mesure ' + nom, String(e && e.stack || e).slice(0, 400)); }
      await ctx.close();
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log('\nMots rendus : ' + resume.map((x) => x.nom + ' ' + x.mots).join(' · '));
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
