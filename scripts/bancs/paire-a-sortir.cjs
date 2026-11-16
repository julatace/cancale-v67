require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA PAIRE À SORTIR EN PREMIER » (15 nov. 2026, maquette validée par Julien)
//  Récit : docs/passation/2026-11-15-refonte-journee.md · règle : src/paireASortir.js ·
//  écran : src/PaireASortir.jsx (Ma journée).
//
//  R  LA RÈGLE, exécutée (le vrai module, importé tel quel) puis RÉAFFAIBLIE (mutations du texte
//     du module : chacune doit rendre au moins un contrôle ROUGE) :
//     R1 l'emplacement vient du Stock PAR IDENTITÉ (le N° de la vente) : deux ventes AU MÊME TITRE ont
//        chacune SA case, une annonce en ligne au même titre (rangée ailleurs) n'est jamais prise ;
//     R2 « pas su » se dit : sans N°, pas rangé, meuble disparu, case hors du meuble, N° en double ⇒ aucun
//        lieu, la raison ;
//     R3 l'ordre de sortie : la plus pressée d'abord ; à date égale, le même meuble à la suite ; un lieu
//        inconnu après ceux de sa date ;
//     R4 « sortie » se prouve par SA déclaration (`N°` nu, ou `N°@id` de CETTE annonce seulement) ;
//     R5 après une sortie, à date égale on reste dans le meuble où l'on est (il est devant).
//  A  L'APP RENDUE (base inventée, 390 tactile, 1512 et 1280 — les maquettes ordinateur —, clair et sombre) :
//     A1 la section est là ; (16 nov., Julien) au téléphone PAS tout en haut : sous le chiffre du jour, la tuile
//        « À envoyer » et la liste « À faire », et compacte (moins de 60 % de l'écran) ;
//     B  (16 nov.) cachée par lui (« Modifier ma journée », réglage du nuage) ⇒ rien ; un réglage enregistré
//        AVANT elle (l'ancien ordre de départ) ne la remonte pas ;
//     A2 la première carte = la vente la plus pressée, SA case (meuble, rangée, case ; la case allumée du plan) ;
//     A3 l'ordre de la suite (date, puis le même meuble), chaque rangée avec SA case ; la vente au même titre
//        que la première a la sienne, jamais celle de l'autre ; la vente jamais rangée dit « place pas connue » ;
//     A4 un seul bouton plein visible ; chaque bouton de la section ≥ 44 px au doigt ; rien ne déborde ;
//     A5 « Je l'ai sortie » (390 clair, et 1512 sombre) : la case se libère, la pile descend (les N° ne
//        changent pas), c'est DIT une fois (Avant / Maintenant, « Compris »), la déclaration est écrite, la
//        pilule d'accompagnement du geste paraît ; la suivante (même meuble) monte en tête, avec sa NOUVELLE case ;
//     A6 sans emplacement connu (une seule vente, jamais rangée) : dit franchement, « Ranger d'abord » ouvre
//        le Stock pour CE N° ;
//     A7 aucune erreur JS.
//  Données INVENTÉES (design-passe : 3 comptes Vinted, pseudos et montants fabriqués). `LARGEURS=390`
//  `THEMES=clair` ; `BANC_DIST=<dist>` (l'arbre de départ : il doit être ROUGE) ; `SHOTS=<dossier>`.
//  Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const RACINE = path.join(__dirname, '..', '..');
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512,1280').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const SHOTS = process.env.SHOTS || P.SHOTS;
fs.mkdirSync(SHOTS, { recursive: true });
let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det != null ? ' — ' + String(det).slice(0, 400) : ''}`); };

// ── R. LA RÈGLE, et ses mutations ──────────────────────────────────────────────
const SRC = fs.readFileSync(path.join(RACINE, 'src', 'paireASortir.js'), 'utf8');
const charger = (texte) => import('data:text/javascript;base64,' + Buffer.from(texte).toString('base64'));
const MEUBLES = [{ id: 'A', name: 'Étagère A', cols: 4, rows: 5 }, { id: 'B', name: 'Pile B', cols: 1, rows: 4, type: 'pile' }];
const SLOTS = { 777: { m: 'A', i: 0 }, 502: { m: 'A', i: 6 }, 501: { m: 'B', i: 3 }, 504: { m: 'B', i: 2 }, 590: { m: 'B', i: 1 }, 610: { m: 'Z', i: 0 }, 611: { m: 'A', i: 99 }, 620: { m: 'A', i: 3 } };
const TITRE = 'Adidas Samba OG blanche taille 41';
function controlesRegle(M) {
  const r = [];
  const ventes = [
    { cle: 'v2', num: '502', titre: TITRE, jours: 3, idAnnonce: '9002' },
    { cle: 'v3', num: '503', titre: 'Nike Air Max 90', jours: 3, idAnnonce: '9003' },
    { cle: 'v4', num: '504', titre: 'Asics Gel-1130', jours: 3, idAnnonce: '9004' },
    { cle: 'v1', num: '501', titre: TITRE, jours: 1, idAnnonce: '9001' },   // (arrivée en dernier : seule la date la met en tête)
  ];
  const o = M.ordreDeSortie(ventes, { slots: SLOTS, meubles: MEUBLES, perdues: {}, doublons: new Set(['620']) });
  const par = Object.fromEntries(o.aSortir.map((v) => [v.num, v]));
  r.push(['R1 deux ventes au même titre : chacune SA case (N°501 → Pile B r4, N°502 → Étagère A r2 c3), jamais celle de l\'annonce au même titre (N°777)',
    par['501'] && par['501'].lieu && par['501'].lieu.meubleId === 'B' && par['501'].lieu.rangee === 4 && par['502'] && par['502'].lieu && par['502'].lieu.meubleId === 'A' && par['502'].lieu.i === 6,
    JSON.stringify(o.aSortir.map((v) => [v.num, v.lieu && v.lieu.meubleId, v.lieu && v.lieu.i]))]);
  const e = (n, extra = {}) => M.emplacementDe(n, { slots: SLOTS, meubles: MEUBLES, doublons: new Set(['620']), ...extra });
  r.push(['R2 pas su : sans N°, pas rangé, meuble disparu, hors du meuble, N° en double ⇒ aucun lieu, la raison',
    e('').raison === 'sansNumero' && e('503').raison === 'pasRange' && e('610').raison === 'meubleAbsent' && e('611').raison === 'horsMeuble' && e('620').raison === 'doublon' && e('620').lieu === null,
    JSON.stringify(['', '503', '610', '611', '620'].map((n) => e(n).raison))]);
  r.push(['R3 l\'ordre : la plus pressée (N°501), puis à date égale le même meuble (N°504, Pile B), puis l\'autre meuble (N°502), l\'inconnue en dernier (N°503)',
    o.aSortir.map((v) => v.num).join(',') === '501,504,502,503', o.aSortir.map((v) => v.num).join(',')]);
  const o2 = M.ordreDeSortie(ventes, { slots: SLOTS, meubles: MEUBLES, perdues: { '501': { id: '9001' }, '502@9999': { id: '9999' } } });
  r.push(['R4 sortie prouvée : N°501 (déclaré) sort de la liste ; « 502@9999 » (une AUTRE annonce) ne fait pas sortir N°502',
    o2.sorties.map((v) => v.num).join(',') === '501' && o2.aSortir.some((v) => v.num === '502'), JSON.stringify({ sorties: o2.sorties.map((v) => v.num), reste: o2.aSortir.map((v) => v.num) })]);
  const o3 = M.ordreDeSortie(ventes.filter((v) => v.num !== '501'), { slots: SLOTS, meubles: MEUBLES, perdues: {}, depuis: 'B' });
  r.push(['R5 après une sortie dans la Pile B, à date égale on y reste : N°504 avant N°502 (Étagère A, pourtant la première de la pièce)',
    o3.aSortir.map((v) => v.num).join(',') === '504,502,503', o3.aSortir.map((v) => v.num).join(',')]);
  return r;
}
const MUTATIONS = [
  ['rapprochement par TITRE (la case de la première vente au même titre)', 'const e = emplacementDe(v.num, { slots, meubles, doublons, cle });', 'const e = emplacementDe((ventes.find((w) => w && w.titre === v.titre) || v).num, { slots, meubles, doublons, cle });'],
  ['sans la date limite (ordre d\'arrivée)', 'aSortir.sort((a, b) => jour(a) - jour(b));', ''],
  ['sans enchaîner le même meuble', 'return [m === dernier ? 0 : 1, m === dernier ? 0 : (ordreMeuble.has(m) ? ordreMeuble.get(m) : 9999), v.lieu.rangee, v.lieu.colonne];', 'return [1, ordreMeuble.has(m) ? ordreMeuble.get(m) : 9999, v.lieu.rangee, v.lieu.colonne];'],
  ['le meuble de la dernière sortie oublié', 'let dernier = depuis == null ? null : String(depuis);', 'let dernier = null;'],
  ['N° en double pris quand même', "if (doublons && typeof doublons.has === 'function' && doublons.has(k)) return { lieu: null, raison: 'doublon' };", ''],
  ['une déclaration d\'une AUTRE annonce fait sortir', "if (cle(brut.slice(0, at)) === k && id && brut.slice(at + 1) === id) return true;", 'if (cle(brut.slice(0, at)) === k) return true;'],
];

// ── A. LA BASE INVENTÉE ────────────────────────────────────────────────────────
const J = 86400000;
const enJours = (j) => new Date(Date.now() + j * J).toISOString();
function base({ seulementInconnue = false, perso } = {}) {
  const b = P.base();
  const m = b.main[0].data;
  if (perso !== undefined) m.vrm_journee_perso = perso;   // (16 nov.) « Modifier ma journée », venu du nuage
  const uid0 = b.accounts[0].vinted_user_id;
  // Les ventes « à expédier » du premier compte qui ont leur e-mail de bordereau : le banc en garde quatre.
  const sold = b.rows.find((r) => r.id === `harvest_${uid0}_orders_sold`).data.payload.my_orders;
  const choisies = sold.filter((o) => o.transaction_user_status === 'needs_action' && b.rows.some((r) => r.id === `email_bord_${o.transaction_id}`)).slice(0, 4);
  // Toutes les autres ventes « à expédier » sont finies : le banc maîtrise ses quatre ventes.
  for (const r of b.rows) {
    if (!/_orders_sold$/.test(r.id)) continue;
    for (const o of (r.data.payload.my_orders || [])) if (o.transaction_user_status === 'needs_action') { o.transaction_user_status = 'completed'; o.status = 'Commande finalisée'; }
  }
  const plan = seulementInconnue ? [['503', 2]] : [['501', 1], ['502', 3], ['503', 3], ['504', 3]];
  plan.forEach(([num, j], k) => {
    const o = choisies[k]; o.transaction_user_status = 'needs_action'; o.status = 'Le paiement a été validé';
    if (num === '501' || num === '502') o.title = TITRE;
    m.vinted_annonce_numeros[o.item_id] = { num, numero: num, numberedAt: enJours(-30), title: o.title };
    const em = b.rows.find((r) => r.id === `email_bord_${o.transaction_id}`); em.data.dateLimite = new Date(Date.now() + j * J).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }) + ' 10 h 00'; em.data.numero = num;
    o.date = new Date(Date.now() - 3600000).toISOString(); em.data.receivedAt = o.date;   // vendue il y a une heure : la date limite LUE (format de l'e-mail) fait foi
  });
  // Une annonce EN LIGNE au même titre que N°501/N°502, rangée ailleurs (N°777) : jamais sa case.
  const lst = b.rows.find((r) => r.id === `harvest_${uid0}_listings`);
  const it = lst.data.payload.items.find((x) => !x.is_closed);
  it.title = TITRE; m.vinted_annonce_numeros[it.id] = { ...(m.vinted_annonce_numeros[it.id] || {}), num: '777', numero: '777' };
  m.vrm_meubles = MEUBLES.map((x) => ({ ...x }));
  m.vrm_slots = seulementInconnue ? { 777: { m: 'A', i: 0 } } : { 777: { m: 'A', i: 0 }, 502: { m: 'A', i: 6 }, 501: { m: 'B', i: 3 }, 504: { m: 'B', i: 2 }, 590: { m: 'B', i: 1 } };
  return b;
}

// ── A. LA MESURE DANS LA PAGE ──────────────────────────────────────────────────
const mesurer = (pg) => pg.evaluate(() => {
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let p = e; p && p !== document.documentElement; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false; } return true; };
  const s = document.querySelector('[data-sortir]');
  const aff = document.querySelector('.sj-journee [data-sj-affiche]');
  const prem = s && s.querySelector('[data-sortir-premier]');
  const suite = s ? [...s.querySelectorAll('[data-sortir-rang]')].map((e) => ({ num: e.getAttribute('data-sortir-num'), lieu: e.getAttribute('data-sortir-lieu'), txt: e.textContent })) : [];
  const pleins = [...document.querySelectorAll('.sb-btn-plein')].filter(vis).filter((e) => !e.closest('.vrm-fs')).length;
  const petits = s ? [...s.querySelectorAll('button')].filter(vis).map((e) => ({ e, r: e.getBoundingClientRect() })).filter(({ r }) => r.width < 43.5 || r.height < 43.5).map(({ e, r }) => `${e.className} ${Math.round(r.width)}×${Math.round(r.height)}`) : [];
  const deborde = s ? [...s.querySelectorAll('*')].filter(vis).filter((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; }).map((e) => e.className).slice(0, 4) : [];
  let ls = {}; try { ls = { slots: JSON.parse(localStorage.getItem('vrm_slots') || 'null'), perdues: JSON.parse(localStorage.getItem('vinted_pairs_lost') || 'null') }; } catch (_) {}
  return {
    la: !!s, top: s ? Math.round(s.getBoundingClientRect().top) : null, topAffiche: aff ? Math.round(aff.getBoundingClientRect().top) : null, h: innerHeight,
    // (16 nov.) Les repères au-dessus desquels elle ne doit plus être (téléphone) : la tuile « À envoyer », la liste « À faire ».
    topEnvoyer: (() => { const e = [...document.querySelectorAll('.sj-journee [data-tuile="envoyer"]')].find(vis); return e ? Math.round(e.getBoundingClientRect().top) : null; })(),
    topAFaire: (() => { const e = [...document.querySelectorAll('.sj-journee [data-fu-gestes]')].find(vis); return e ? Math.round(e.getBoundingClientRect().top) : null; })(),
    hCarte: prem ? Math.round(prem.getBoundingClientRect().height) : null,
    n: s ? s.getAttribute('data-sortir-n') : null, sorties: s ? s.getAttribute('data-sortir-sorties') : null,
    premier: prem ? { num: prem.getAttribute('data-sortir-num'), lieu: prem.getAttribute('data-sortir-lieu'), raison: prem.getAttribute('data-sortir-raison'),
      meuble: (prem.querySelector('[data-sortir-meuble]') || {}).textContent || '', place: (prem.querySelector('[data-sortir-place]') || {}).textContent || '',
      plan: (prem.querySelector('[data-so-plan]') || { getAttribute: () => null }).getAttribute('data-so-plan'), cible: !!prem.querySelector('[data-so-case="cible"]'),
      ranger: prem.querySelector('[data-sortir-ranger]') ? prem.querySelector('[data-sortir-ranger]').getAttribute('data-sortir-ranger') : null,
      inconnu: !!prem.querySelector('[data-sortir-inconnu]'), geste: !!prem.querySelector('[data-sortir-geste="sortie"]'), compact: prem.hasAttribute('data-sortir-compact') } : null,
    suite, pleins, petits, deborde, sw: document.documentElement.scrollWidth, iw: innerWidth,
    apres: (() => { const a = document.querySelector('[data-sortir-apres]'); return a ? { num: a.getAttribute('data-sortir-apres'), desc: a.getAttribute('data-sortir-descendus'), phrase: !!a.querySelector('[data-sortir-phrase]'), vis: vis(a) } : null; })(),
    pilule: !!document.querySelector('[data-acc-apres="stock.sortir"]'),
    ls,
  };
});

async function scenario(nav, { W, th, sortir }) {
  const sombre = th === 'sombre', T = `[${W} ${th}]`;
  const o = await P.ouvrir(nav, { W, sombre, b: base(), url: '/?tab=journee', dsf: W < 600 ? 2 : 1 });
  if (W >= 600 && W !== 1512) await o.pg.setViewportSize({ width: W, height: W <= 1280 ? 800 : 900 });   // la maquette 1280 × 800
  await P.pret(o.pg);
  await o.pg.waitForSelector('[data-sortir] [data-sortir-premier]', { timeout: 30000 }).catch(() => {});
  await o.pg.waitForTimeout(1500);
  const m = await mesurer(o.pg);
  await o.pg.screenshot({ path: path.join(SHOTS, `sortir-${W}-${th}.png`) }).catch(() => {});
  dit(m.la, `${T} A1 « La paire à sortir » est sur Ma journée`, JSON.stringify(m).slice(0, 200));
  if (!m.la) { await o.ctx.close(); return; }
  // (16 nov., lot personnalisation-simple — Julien : « je ne veux pas qu'elle soit tout en haut ») La règle a CHANGÉ : au
  // téléphone, la section n'est plus la première de Ma journée — sous le chiffre du jour, sous la grille (« À envoyer ») et
  // sous la liste « À faire » (la carte `sortir` de la zone « En bas »). Jugé sur les positions RENDUES (data-*).
  if (W < 600) dit(m.top != null && m.topAffiche != null && m.top > m.topAffiche && m.topEnvoyer != null && m.top > m.topEnvoyer && (m.topAFaire == null || m.top > m.topAFaire),
    `${T} A1 PAS tout en haut : sous le chiffre du jour (${m.topAffiche} px), sous « À envoyer » (${m.topEnvoyer} px) et « À faire » (${m.topAFaire} px) — elle à ${m.top} px`, JSON.stringify([m.top, m.topAffiche, m.topEnvoyer, m.topAFaire]));
  if (W < 600) dit(!!(m.premier && m.premier.compact) && m.hCarte != null && m.hCarte < m.h * 0.6, `${T} A1 compacte au téléphone (vignette, « Je l'ai sortie » gardé) : la carte fait ${m.hCarte} px sur ${m.h}`, JSON.stringify([m.hCarte, m.h, m.premier && m.premier.compact]));
  const p = m.premier || {};
  dit(p.num === '501' && p.lieu === 'B:3' && /Pile B/.test(p.meuble) && p.plan === '4:1' && p.cible, `${T} A2 la plus pressée d'abord (N°501) : SA case — Pile B, la boîte du bas, la case allumée`, JSON.stringify(p));
  const nums = m.suite.map((x) => x.num).filter((x) => ['502', '503', '504'].includes(x));
  dit(nums.join(',') === '504,502,503', `${T} A3 l'ordre : N°504 (même meuble), N°502 (l'autre meuble), N°503 (inconnue)`, JSON.stringify(m.suite.map((x) => [x.num, x.lieu])));
  const s502 = m.suite.find((x) => x.num === '502'), s503 = m.suite.find((x) => x.num === '503'), s504 = m.suite.find((x) => x.num === '504');
  dit(s502 && s502.lieu === 'A:6' && s504 && s504.lieu === 'B:2', `${T} A3 au même titre que N°501, N°502 a SA case (Étagère A, i 6) — jamais B:3 ni celle de N°777 (A:0)`, JSON.stringify([s502, s504]));
  dit(s503 && s503.lieu === '', `${T} A3 N°503, jamais rangée : aucune case inventée (« place pas connue »)`, JSON.stringify(s503));
  dit(m.pleins === 1, `${T} A4 un seul bouton plein visible (« Je l'ai sortie »)`, m.pleins);
  if (W < 600) dit(m.petits.length === 0, `${T} A4 chaque bouton de la section ≥ 44 × 44 px`, m.petits.join(' · '));
  dit(m.sw <= m.iw + 1 && m.deborde.length === 0, `${T} A4 rien ne déborde`, JSON.stringify([m.sw, m.iw, m.deborde]));
  if (sortir) {
    await o.pg.click('[data-sortir-premier] [data-sortir-geste="sortie"]');
    await o.pg.waitForSelector('[data-sortir-apres]', { timeout: 8000 }).catch(() => {});
    // Les cases s'écrivent par le geste du Stock (après la déclaration) : on attend l'ÉCRITURE elle-même, jamais un délai
    // fixe (sous charge, 900 ms ne suffisaient pas) ; pas écrite en 12 s ⇒ le contrôle d'en dessous dit son rouge.
    await o.pg.waitForFunction(() => { try { const s = JSON.parse(localStorage.getItem('vrm_slots') || 'null'); return !!s && !s['501']; } catch (_) { return false; } }, null, { timeout: 12000 }).catch(() => {});
    await o.pg.waitForTimeout(900);
    const a = await mesurer(o.pg);
    await o.pg.screenshot({ path: path.join(SHOTS, `sortir-${W}-${th}-apres.png`) }).catch(() => {});
    const desc = String((a.apres && a.apres.desc) || '').split(',').filter(Boolean).sort().join(',');
    dit(a.apres && a.apres.num === '501' && a.apres.vis && desc === '504,590' && a.apres.phrase, `${T} A5 « Je l'ai sortie » : N°501 sortie, N°504 et N°590 descendus — dit (Avant / Maintenant)`, JSON.stringify(a.apres));
    const sl = (a.ls && a.ls.slots) || {};
    dit(!sl['501'] && sl['504'] && sl['504'].i === 3 && sl['590'] && sl['590'].i === 2 && sl['502'] && sl['502'].i === 6, `${T} A5 les cases écrites : 501 libérée, la pile tassée (504 → i 3, 590 → i 2), les autres intactes ; les N° ne changent pas`, JSON.stringify(sl));
    dit(!!(a.ls && a.ls.perdues && Object.keys(a.ls.perdues).some((k) => /^501(@|$)/.test(k))), `${T} A5 la déclaration du Stock est écrite (vinted_pairs_lost, N°501)`, JSON.stringify(a.ls && a.ls.perdues));
    dit(a.pilule, `${T} A5 la pilule d'accompagnement du geste paraît (data-acc-apres="stock.sortir")`);
    dit(a.premier && a.premier.num === '504' && a.premier.lieu === 'B:3' && a.sorties === '1', `${T} A5 la suivante monte en tête : N°504, avec sa NOUVELLE case (B:3)`, JSON.stringify([a.premier, a.sorties]));
    dit(a.pleins === 1, `${T} A5 après le geste : toujours un seul plein`, a.pleins);
    await o.pg.click('[data-sortir-compris]').catch(() => {});
    await o.pg.waitForTimeout(500);
    const c = await mesurer(o.pg);
    dit(!c.apres, `${T} A5 « Compris » : dit une fois, puis plus`, JSON.stringify(c.apres));
  }
  dit(o.erreurs.length === 0, `${T} A7 aucune erreur JS`, o.erreurs.join(' | '));
  await o.ctx.close();
}

async function inconnue(nav, { W, th }) {
  const T = `[${W} ${th} · sans emplacement]`;
  const o = await P.ouvrir(nav, { W, sombre: th === 'sombre', b: base({ seulementInconnue: true }), url: '/?tab=journee', dsf: W < 600 ? 2 : 1 });
  await P.pret(o.pg);
  await o.pg.waitForSelector('[data-sortir] [data-sortir-premier]', { timeout: 30000 }).catch(() => {});
  await o.pg.waitForTimeout(1200);
  const m = await mesurer(o.pg);
  await o.pg.screenshot({ path: path.join(SHOTS, `sortir-${W}-${th}-inconnue.png`) }).catch(() => {});
  const p = m.premier || {};
  dit(p.num === '503' && p.raison === 'pasRange' && p.inconnu && !p.lieu && p.ranger === '503' && p.geste, `${T} A6 dit franchement (aucune case), « Ranger d'abord » pour CE N°`, JSON.stringify(p));
  await o.pg.click('[data-sortir-ranger]').catch(() => {});
  await o.pg.waitForTimeout(2500);
  const ec = await o.pg.evaluate(() => { const e = document.querySelector('.vrm-main[data-ecran]'); return e ? e.getAttribute('data-ecran') : (new URL(location.href)).searchParams.get('tab'); });
  dit(ec === 'garage', `${T} A6 « Ranger d'abord » ouvre le Stock`, ec);
  dit(o.erreurs.length === 0, `${T} A7 aucune erreur JS`, o.erreurs.join(' | '));
  await o.ctx.close();
}

// (16 nov., lot personnalisation-simple) B — SES choix : cachée ⇒ rien ; l'ancien ordre de départ (enregistré avant que la
// carte existe : la tête, « À faire », puis « En bas » sans elle) ⇒ elle reste sous la grille, jamais tout en haut.
async function choixDeLui(nav, { W, th }) {
  const T = `[${W} ${th} · ses choix]`;
  const vieux = ['phrase', 'prochain', 'frise', 'ailleurs', 'deux-fois', 'envoyer', 'retirer', 'messages', 'prix', 'notifs', 'guide'];
  for (const [nom, perso, attendu] of [['cachée', { v: 1, ordre: [], choix: { sortir: false } }, 'absente'], ['ancien ordre de départ', { v: 1, ordre: vieux, choix: {} }, 'basse']]) {
    const o = await P.ouvrir(nav, { W, sombre: th === 'sombre', b: base({ perso }), url: '/?tab=journee', dsf: W < 600 ? 2 : 1 });
    await P.pret(o.pg);
    await o.pg.waitForSelector('.sj-journee [data-tuile="envoyer"]', { timeout: 30000 }).catch(() => {});
    if (attendu === 'basse') await o.pg.waitForSelector('[data-sortir] [data-sortir-premier]', { timeout: 20000 }).catch(() => {});
    await o.pg.waitForTimeout(1500);
    const m = await mesurer(o.pg);
    await o.pg.screenshot({ path: path.join(SHOTS, `sortir-${W}-${th}-${attendu}.png`) }).catch(() => {});
    if (attendu === 'absente') dit(!m.la && m.topEnvoyer != null, `${T} B ${nom} par lui : « La paire à sortir » ne s'affiche pas (Ma journée, elle, est là)`, JSON.stringify([m.la, m.topEnvoyer]));
    else dit(m.la && m.top > m.topEnvoyer, `${T} B ${nom} : toujours sous « À envoyer » (${m.top} > ${m.topEnvoyer} px)`, JSON.stringify([m.la, m.top, m.topEnvoyer]));
    dit(o.erreurs.length === 0, `${T} B aucune erreur JS (${nom})`, o.erreurs.join(' | '));
    await o.ctx.close();
  }
}

(async () => {
  // R : la règle, puis chaque mutation.
  const M = await charger(SRC);
  for (const [quoi, bon, det] of controlesRegle(M)) dit(bon, quoi, det);
  for (const [nom, de, vers] of MUTATIONS) {
    if (!SRC.includes(de)) { dit(false, `mutation « ${nom} » : le texte visé n'est plus dans le module (à mettre à jour)`); continue; }
    const Mm = await charger(SRC.replace(de, vers));
    const rouges = controlesRegle(Mm).filter((x) => !x[1]).map((x) => x[0].slice(0, 3));
    dit(rouges.length > 0, `mutation « ${nom} » : le banc devient ROUGE (${rouges.join(', ') || 'aucun'})`);
  }
  if (process.env.SANS_RENDU === '1') { console.log(ko ? `\n${ko} KO` : '\nTOUT VERT'); process.exit(ko ? 1 : 0); }
  await new Promise((ok) => P.srv.listen(P.PORT, ok));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const W of LARGEURS) for (const th of THEMES) {
      const sortir = (W < 600 && th === 'clair') || (W >= 600 && th === 'sombre') || (W === 1280 && th === 'clair');
      try { await scenario(nav, { W, th, sortir }); } catch (e) { dit(false, `[${W} ${th}] le scénario a pu s'exécuter`, String(e && e.stack || e).slice(0, 300)); }
    }
    try { await inconnue(nav, { W: LARGEURS[0], th: THEMES[0] }); } catch (e) { dit(false, 'le scénario « sans emplacement » a pu s\'exécuter', String(e && e.stack || e).slice(0, 300)); }
    if (LARGEURS[0] < 600) { try { await choixDeLui(nav, { W: LARGEURS[0], th: THEMES[0] }); } catch (e) { dit(false, 'le scénario « ses choix » a pu s\'exécuter', String(e && e.stack || e).slice(0, 300)); } }
  } finally { await nav.close(); P.srv.close(); }
  console.log(ko ? `\n${ko} KO` : '\nTOUT VERT');
  process.exit(ko ? 1 : 0);
})();
