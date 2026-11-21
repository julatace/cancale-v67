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
//  A  L'APP RENDUE (base inventée, 390 tactile, 1512 et 1280, clair et sombre) — depuis le 16 nov. (lot
//     retirer-case-compact) l'ABSENCE : A1 plus de carte « La paire à sortir » sur Ma journée (le Stock allume la case,
//     banc stock-case-a-sortir.cjs) ; A2 aucune fenêtre à sa place ; A3 rien ne déborde ; A4 aucune erreur JS.
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
function base({ seulementInconnue = false } = {}) {
  const b = P.base();
  const m = b.main[0].data;
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

// (16 nov., lot retirer-case-compact — Julien : « enlever la paire de sa case ça prend trop de place », puis « dans
// l'onglet Stock, la case doit être en surbrillance si l'article n'est pas rangé/retiré — PAS DE POP-UP ») La carte
// « La paire à sortir en premier » n'est plus posée sur Ma journée (ni carte, ni fenêtre) : la case allumée du Stock
// fait tout (banc stock-case-a-sortir.cjs). Ce scénario sert les MÊMES ventes qu'avant (quatre ventes rangées,
// à expédier) et exige l'absence — l'arbre du 15 nov. le rend rouge (sa carte y est), et il mesure la place rendue.
async function scenario(nav, { W, th }) {
  const sombre = th === 'sombre', T = `[${W} ${th}]`;
  const o = await P.ouvrir(nav, { W, sombre, b: base(), url: '/?tab=journee', dsf: W < 600 ? 2 : 1 });
  if (W >= 600 && W !== 1512) await o.pg.setViewportSize({ width: W, height: W <= 1280 ? 800 : 900 });
  await P.pret(o.pg);
  await o.pg.waitForSelector('.sj-journee', { timeout: 30000 }).catch(() => {});
  await o.pg.waitForTimeout(2500);
  const m = await o.pg.evaluate(() => {
    const vis = (e) => { if (!e || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const s = document.querySelector('[data-sortir]');
    return { journee: !!document.querySelector('.sj-journee'), la: !!s, h: s && vis(s) ? Math.round(s.getBoundingClientRect().height) : 0,
      fenetres: [...document.querySelectorAll('[role="dialog"], .vrm-confirmation, [data-sortir-pop]')].filter(vis).length,
      geste: !!document.querySelector('[data-sortir-geste], [data-sortir-compris]'), sw: document.documentElement.scrollWidth, iw: innerWidth };
  });
  await o.pg.screenshot({ path: path.join(SHOTS, `sortir-${W}-${th}.png`) }).catch(() => {});
  console.log(`MESURE ${T} : hauteur de « La paire à sortir en premier » = ${m.h} px`);
  dit(m.journee, `${T} A1 Ma journée est rendue`, JSON.stringify(m));
  dit(!m.la && !m.geste && m.h === 0, `${T} A1 plus de carte « La paire à sortir » ni de « Je l'ai sortie » sur Ma journée`, `${m.h} px`);
  dit(m.fenetres === 0, `${T} A2 aucune fenêtre ne s'ouvre à sa place`, String(m.fenetres));
  dit(m.sw <= m.iw + 1, `${T} A3 rien ne déborde`, JSON.stringify([m.sw, m.iw]));
  dit(o.erreurs.length === 0, `${T} A4 aucune erreur JS`, o.erreurs.join(' | '));
  await o.ctx.close();
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
      try { await scenario(nav, { W, th }); } catch (e) { dit(false, `[${W} ${th}] le scénario a pu s'exécuter`, String(e && e.stack || e).slice(0, 300)); }
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log(ko ? `\n${ko} KO` : '\nTOUT VERT');
  process.exit(ko ? 1 : 0);
})();
