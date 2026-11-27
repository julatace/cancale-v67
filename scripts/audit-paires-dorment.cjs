// ════════════════════════════════════════════════════════════════════════════
// AUDIT — « PAIRES QUI DORMENT », LE PLAN (27 nov., choix de Julien ; retenu le 11 oct.)
// Exécute la VRAIE règle (src/pairesDorment.js) sur un jeu inventé (jamais une donnée réelle) :
//   P1 plus de 21 jours en ligne (21 j pile n'y est pas) ; date pas lue ⇒ hors plan, comptée à part ;
//   P2 seulement « en ligne » (ni masquée, ni à confirmer, ni vendue, ni bloquée) ; un compte « achats » écarté ;
//   P3 rangées par l'argent qui dort (achat CONNU, du plus grand au plus petit), achat inconnu après (jamais un 0) ;
//   P4 le total = la somme des achats connus, la couverture « k sur n » à côté ;
//   P5 IDENTITÉ : 50 paires au MÊME titre (deux comptes) ⇒ 50 lignes, chacune SES chiffres, SA clé ; la courbe d'un autre
//      compte n'est jamais prise ;
//   P6 vues et favoris : le DERNIER jour LU de la courbe (jamais interpolé, un point vide ne compte pas), sinon le dressing,
//      sinon « pas lu » (null) ;
//   P7 la baisse va à SON plancher (prix mini, sinon achat + 10 %, à l'euro au-dessus) ; sans plancher ⇒ aucune baisse ;
//      déjà au plancher ⇒ aucune ; la garde du prix signale la grosse chute ;
//   P8 chaque geste passe par LA porte : non ⇒ éteint avec SON verdict ; tout le plan refusé ⇒ UNE raison en tête ;
//      republier et favoris : Vinted seulement ; favoris 0 ou pas lus ⇒ éteint ;
//   P9 le branchement : la vue n'envoie rien (aucune porte, aucun envoi dans PairesDorment.jsx) ; l'écran juge par
//      `agirMaintenant`, republie par `republierDansApp` (SA confirmation), baisse par `envoyerGeste` APRÈS `askConfirm`.
// `--prouve` : chaque mutation de la règle doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const { pathToFileURL } = require('url');
const R = process.env.PDO_RACINE || path.join(__dirname, '..');
const SRC = path.join(R, 'src', 'pairesDorment.js');
const J = 24 * 3600e3, NOW = Date.UTC(2026, 10, 27, 12);

const MUTATIONS = {
  seuil_large: (s) => s.replace('if (!(jours > s)) continue;', 'if (!(jours >= s)) continue;'),
  date_devinee: (s) => s.replace('if (!datees.length) { sansDate++; continue; }', 'if (!datees.length) { sansDate++; }'),
  masquee_admise: (s) => s.replace("x && x.etat === 'enligne' && str(x.id)", "x && ['enligne', 'masquee'].includes(x.etat) && str(x.id)"),
  achat_zero: (s) => s.replace('const achatC = centimes(a.achat);', 'const achatC = centimes(a.achat) ?? 0;'),
  tri_age: (s) => s.replace('if (x.achatC != null && y.achatC != null && x.achatC !== y.achatC) return y.achatC - x.achatC;', ''),
  courbe_autre_compte: (s) => s.replace("if (!r || !str(r.id).startsWith(pre) || !Array.isArray(r[k])) continue;", 'if (!r || !Array.isArray(r[k])) continue;'),
  courbe_point_vide: (s) => s.replace('if (!pointValide(x) || (x[1] === null && x[2] === null)) continue;', 'if (!pointValide(x)) continue;'),
  favoris_zero: (s) => s.replace("const r = l.favoris == null ? 'favoris-pas-lus' : l.favoris === 0 ? 'sans-favori'", "const r = l.favoris === 0 ? 'sans-favori'"),
  sans_porte: (s) => s.replace("const porte = (site, geste, par) => { const v = j(site, l.compte, geste, par) || { ok: false, raison: 'passu' }; return v.ok ? null : v; };", 'const porte = () => null;'),
  sous_plancher: (s) => s.replace('Math.max(100, Math.ceil(plancher.c / 100) * 100)', 'Math.max(100, Math.floor(plancher.c / 100) * 100 - 500)'),
  cle_par_titre: (s) => s.replace("export const cleLignePlan = (article, annonce) => str(article && article.cle) + '|' + str(annonce && annonce.site) + ':' + str(annonce && annonce.compte) + ':' + str(annonce && annonce.id);", "export const cleLignePlan = (article) => str(article && article.titre);"),
};

async function charger(src) {
  const f = path.join(path.dirname(SRC), `.pdo-audit-${process.pid}-${Math.random().toString(36).slice(2)}.js`);
  fs.writeFileSync(f, src);
  try { return await import(pathToFileURL(f).href); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}
// Un article dans la forme de src/articles/modele.js.
const art = (cle, { titre = 'Nike Air Max 1 bleu marine 42', achat = null, prixMini = null, numero = '', annonces = [] } = {}) => ({ cle, titre, achat, prixMini, numero, annonces });
const ann = (id, { site = 'vinted', compte = '111', etat = 'enligne', jours = 40, prix = 80, vues = null, favoris = null, verif = '' } = {}) =>
  ({ site, id: String(id), compte, etat, depuis: jours == null ? null : NOW - jours * J - 3600e3, prix, vues, favoris, verif });

async function audit(src, bavard) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard) console.log((c ? '✅ ' : '❌ ') + m + (!c && d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 400) : '')); };
  let M;
  try { M = await charger(src); } catch (e) { dit(false, 'la règle se charge', e.message); return ko || 1; }
  const P = (arts, o = {}) => M.planPairesDorment(arts, { maintenant: NOW, ...o });

  // ── P1 / P2 ──
  const jeu = [
    art('a1', { achat: 30, annonces: [ann(1001, { jours: 22 })] }),
    art('a2', { achat: 60, annonces: [ann(1002, { jours: 21 })] }),
    art('a3', { achat: 45, annonces: [ann(1003, { jours: null })] }),
    art('a4', { achat: 90, annonces: [ann(1004, { jours: 80, etat: 'masquee' })] }),
    art('a5', { achat: 70, annonces: [ann(1005, { jours: 80, etat: 'aconfirmer' })] }),
    art('a6', { achat: 75, annonces: [ann(1006, { jours: 80, etat: 'vendue' })] }),
    art('a7', { achat: 20, annonces: [ann(1007, { jours: 50, compte: '999' })] }),
    art('a8', { achat: null, annonces: [ann(1008, { jours: 120, prix: 150 })] }),
    art('a9', { achat: 30, annonces: [ann(1009, { jours: 60 })] }),
    art('a10', { achat: '12,50', annonces: [ann('lb10', { site: 'leboncoin', compte: 'lbc1', jours: 30, prix: 40 })] }),
  ];
  const r = P(jeu, { comptesExclus: new Set(['999']) });
  const ids = r ? r.lignes.map((l) => l.id) : [];
  dit(r && ids.includes('1001') && !ids.includes('1002'), 'P1 plus de 21 j : 22 j entre, 21 j pile n’entre pas', ids);
  dit(r && !ids.includes('1003') && r.sansDate === 1, 'P1 date de mise en ligne pas lue ⇒ hors plan, comptée à part (1)', r && r.sansDate);
  dit(r && !['1004', '1005', '1006'].some((x) => ids.includes(x)), 'P2 masquée, à confirmer, vendue : jamais dans le plan', ids);
  dit(r && !ids.includes('1007'), 'P2 un compte « achats » est écarté', ids);
  // ── P3 / P4 ──
  dit(r && ids.join(',') === '1009,1001,lb10,1008', 'P3 rangées par l’achat connu (30 € à 120 j avant 30 € à 22 j, puis 12,50 €), achat inconnu après', ids);
  const l8 = r && r.lignes.find((l) => l.id === '1008');
  dit(l8 && l8.achatC === null, 'P3 achat inconnu ⇒ null (« — »), jamais 0', l8 && l8.achatC);
  dit(r && r.argentC === 3000 + 3000 + 1250 && r.achatsConnus === 3 && r.n === 4, 'P4 total = 72,50 € (achats connus), couverture 3 sur 4', r && { a: r.argentC, k: r.achatsConnus, n: r.n });
  dit(M.planPairesDorment(null) === null, 'P4 rien lu ⇒ null (jamais un plan vide)');

  // ── P5 IDENTITÉ : 50 paires au même titre, deux comptes ──
  const cinquante = [];
  for (let i = 0; i < 50; i++) cinquante.push(art('vinted#' + (5000 + i), { achat: 10 + i, annonces: [ann(5000 + i, { compte: i % 2 ? '111' : '222', jours: 30 + i, vues: i, favoris: i % 3 })] }));
  const sel = M.selectCourbesPlan(cinquante.map((a) => a.annonces[0].id));
  const rows = [
    // compte 111, navigateur chrome : la courbe de 5001 ; compte 222 : une courbe AU MÊME identifiant 5001 (jamais prise pour 111).
    { id: 'courbes_annonces_111_chrome', [sel.alias['5001']]: [[20400, 7, 2, 8000, 600], [20410, 9, 3, 8000, 700]] },
    { id: 'courbes_annonces_222_chrome', [sel.alias['5001']]: [[20419, 999, 99, 8000, 700]] },
  ];
  const r5 = P(cinquante, { courbes: { rows, alias: sel.alias } });
  const cles = new Set(r5.lignes.map((l) => l.cle));
  dit(r5.n === 50 && cles.size === 50, 'P5 50 paires au même titre ⇒ 50 lignes, 50 clés distinctes', { n: r5.n, cles: cles.size });
  dit(r5.lignes.every((l) => l.achatC === Math.round((10 + Number(l.id) - 5000) * 100) && l.article.annonces[0].id === l.id), 'P5 chaque ligne porte l’achat de SA paire (jamais celui d’une jumelle)');
  const l5001 = r5.lignes.find((l) => l.id === '5001');
  dit(l5001 && l5001.vues === 9 && l5001.favoris === 3 && l5001.source === 'courbe', 'P5 la courbe d’un AUTRE compte au même identifiant n’est jamais prise (9 vues, pas 999)', l5001 && { v: l5001.vues, f: l5001.favoris });
  dit(r5.lignes.filter((l) => l.id !== '5001').every((l) => l.vues === Number(l.id) - 5000 && l.source === 'lecture'), 'P5 sans courbe : les vues lues du dressing de SA paire');

  // ── P6 COURBES ──
  const s6 = M.selectCourbesPlan(['7001', '7002', '7003']);
  const rows6 = [
    { id: 'courbes_annonces_111_chrome', [s6.alias['7001']]: [[20400, 5, 1, null, 600], [20412, null, null, 9000, 900]], [s6.alias['7002']]: [[20405, 3, 0, null, 100]] },
    { id: 'courbes_annonces_111_edge', [s6.alias['7001']]: [[20408, 6, 1, null, 800]] },
  ];
  const r6 = P([art('c1', { annonces: [ann(7001, { vues: 50, favoris: 9 })] }), art('c2', { annonces: [ann(7002, { vues: 40, favoris: 4 })] }), art('c3', { annonces: [ann(7003, { vues: null, favoris: null })] })], { courbes: { rows: rows6, alias: s6.alias } });
  const g6 = (id) => r6.lignes.find((l) => l.id === id);
  dit(g6('7001').vues === 6 && g6('7001').favoris === 1, 'P6 le dernier jour LU qui porte des vues (deux navigateurs) — un point sans vues ni favoris ne compte pas', g6('7001'));
  dit(g6('7002').vues === 3 && g6('7002').favoris === 0 && g6('7002').source === 'courbe', 'P6 favoris 0 LU reste 0 (lu), la courbe gagne sur le dressing');
  dit(g6('7003').vues === null && g6('7003').favoris === null && g6('7003').source === '', 'P6 rien lu ⇒ null (« — »), jamais 0');
  dit(M.selectCourbesPlan(['abc', '12']) === null && /p0:data->a->%227001%22/.test(s6.select) && !/select=data\b/.test(s6.select), 'P6 la lecture est PROJETÉE par annonce (jamais la ligne entière), identifiants vérifiés');

  // ── P7 BAISSE AU PLANCHER ──
  const r7 = P([
    art('b1', { achat: 40, annonces: [ann(8001, { prix: 60 })] }),                 // plancher 44 € ⇒ 44 € (−27 %, sans alerte)
    art('b2', { achat: 40, prixMini: 55, annonces: [ann(8002, { prix: 80 })] }),   // prix mini 55 € ⇒ 55 €
    art('b3', { annonces: [ann(8003, { prix: 80 })] }),                            // ni l'un ni l'autre ⇒ aucune
    art('b4', { achat: 50, annonces: [ann(8004, { prix: 55 })] }),                 // plancher 55 € ⇒ déjà au plancher
    art('b5', { achat: '40,10', annonces: [ann(8005, { prix: 200 })] }),           // 44,11 € ⇒ 45 € ; chute > 40 % ⇒ à confirmer
  ]);
  const b = (id) => r7.lignes.find((l) => l.id === id);
  dit(b('8001').baisseC === 4400 && b('8002').baisseC === 5500, 'P7 vers SON plancher : achat + 10 % (44 €), sinon le prix mini (55 €)', [b('8001').baisseC, b('8002').baisseC]);
  dit(b('8005').baisseC === 4500 && b('8005').baisseC >= b('8005').plancher.c, 'P7 à l’euro AU-DESSUS du plancher (45 €), jamais dessous', b('8005'));
  dit(b('8005').aConfirmer === true && b('8001').aConfirmer === false, 'P7 la garde du prix signale la grosse chute (200 € → 45 €)', [b('8005').aConfirmer, b('8001').aConfirmer]);
  const okPartout = () => ({ ok: true, voie: 'ici' });
  const gB = (id) => M.gestesLignePlan(b(id), okPartout).find((g) => g.k === 'baisser');
  dit(gB('8003').ok === false && gB('8003').raison === 'sans-plancher' && b('8003').baisseC === null, 'P7 ni prix mini ni achat ⇒ aucune baisse (« Pose un prix mini »)', gB('8003'));
  dit(gB('8004').ok === false && gB('8004').raison === 'au-plancher', 'P7 déjà au plancher ⇒ aucune baisse', gB('8004'));

  // ── P8 LA PORTE ──
  const r8 = P([
    art('d1', { achat: 40, annonces: [ann(9001, { compte: 'A', favoris: 3, vues: 10 })] }),
    art('d2', { achat: 40, annonces: [ann(9002, { compte: 'B', favoris: 3, vues: 10 })] }),
    art('d3', { achat: 40, annonces: [ann(9003, { compte: 'A', favoris: 0, vues: 10 })] }),
    art('d4', { achat: 40, annonces: [ann(9004, { compte: 'A', favoris: null, vues: null })] }),
    art('d5', { achat: 40, annonces: [ann('lb5', { site: 'leboncoin', compte: 'lbcA', favoris: 3 })] }),
  ]);
  const appels = [];
  const juge = (site, compte, geste, par) => { appels.push([site, compte, geste, par]); return compte === 'A' || compte === 'lbcA' ? { ok: true, voie: 'ici' } : { ok: false, raison: 'pas-ouvert', cle: 'agir.raison.pas-ouvert', vars: {} }; };
  const G = (id) => M.gestesLignePlan(r8.lignes.find((l) => l.id === id), juge);
  const gA = G('9001'), gBn = G('9002');
  dit(gA.map((g) => g.k + ':' + (g.ok ? 1 : 0)).join(',') === 'republier:1,baisser:1,favoris:1', 'P8 compte A connecté : Republier, Baisser, Favoris allumés', gA);
  dit(gBn.every((g) => !g.ok && g.verdict && g.verdict.raison === 'pas-ouvert'), 'P8 compte B pas connecté : les trois éteints, avec le verdict de la porte', gBn);
  dit(appels.some((x) => x[2] === 'republier' && x[3] === 'file') && appels.some((x) => x[2] === 'baisser' && x[3] === 'file') && appels.some((x) => x[2] === 'favoris' && x[3] === 'panneau'), 'P8 la porte est interrogée pour CHAQUE geste (republier/baisser par la file, favoris par le panneau)', appels.slice(0, 6));
  dit(G('9003').find((g) => g.k === 'favoris').raison === 'sans-favori' && G('9004').find((g) => g.k === 'favoris').raison === 'favoris-pas-lus', 'P8 favoris : 0 lu ⇒ « Aucun favori » ; pas lus ⇒ « Favoris pas lus » (jamais un envoi sur un doute)');
  dit(G('lb5').map((g) => g.k).join(',') === 'baisser', 'P8 Leboncoin : seulement « Baisser » (republier et favoris n’existent que sur Vinted)', G('lb5'));
  const tousNon = () => ({ ok: false, raison: 'aucune', cle: 'agir.raison.aucune', vars: {} });
  dit(M.lectureSeulePlan(r8.lignes, tousNon) && M.lectureSeulePlan(r8.lignes, tousNon).raison === 'aucune' && M.lectureSeulePlan(r8.lignes, juge) === null, 'P8 extension connectée nulle part ⇒ UNE raison en tête (lecture seule) ; un compte connecté ⇒ aucune');
  dit(M.gestesLignePlan(r8.lignes[0], null).every((g) => !g.ok), 'P8 porte absente ⇒ « pas su » ⇒ rien d’allumé');
  return ko;
}

// ── P9 LE BRANCHEMENT (statique, sur le code tel qu'il est) ──
function branchement(bavard) {
  let ko = 0;
  const dit = (c, m) => { if (!c) ko++; if (bavard) console.log((c ? '✅ ' : '❌ ') + m); };
  const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8').replace(/\/\/[^\n]*/g, ''); } catch (_) { return ''; } };
  const V = lire('src/natif/ecrans/PairesDorment.jsx'), E = lire('src/ecrans/AnnoncesEgalite.jsx'), A = lire('src/natif/ecrans/Annonces.jsx');
  dit(V && !/agir\/porte|envoyerGeste|republierDansApp|ouvrirPanneau|fetch\(/.test(V), 'P9 la vue n’envoie rien (ni porte, ni envoi, ni panneau)');
  dit(/const jugerPlan = \([^)]*\) => agirMaintenant\(/.test(E), 'P9 l’écran juge chaque geste par LA porte (`agirMaintenant`)');
  dit(/republierDansApp\(\[\{ compte: l\.compte, id: l\.id[^\]]*\], confirmerRepub\)/.test(E), 'P9 Republier : `republierDansApp` au nom du compte de SON annonce, avec SA confirmation');
  const iC = E.indexOf("title: tr('pdo.baisse.titre'"), iE = E.indexOf("geste: 'baisser', distGeste: 'prix'");
  dit(iC > 0 && iE > iC && /if \(!oui\) return;/.test(E.slice(iC, iE)), 'P9 Baisser : la file `prix` APRÈS SA confirmation (`askConfirm`), rien si « Non »');
  dit(/page: 'favoris', ids: \[l\.id\]/.test(E), 'P9 Favoris : la page favoris du panneau, CETTE annonce');
  dit(/dorment && dorment\.entree/.test(A) && /<VueAnnonces dorment=/.test(E), 'P9 l’entrée est posée sur le segment « Dorment » d’Annonces (téléphone et tableau)');
  return ko;
}

(async () => {
  const src = fs.readFileSync(SRC, 'utf8');
  if (process.argv.includes('--prouve')) {
    let tenues = 0;
    for (const [nom, m] of Object.entries(MUTATIONS)) {
      const mut = m(src);
      if (mut === src) { console.log('❌ mutation ' + nom + ' : ne s’applique pas (le code a changé)'); process.exitCode = 1; continue; }
      let k; try { k = await audit(mut, false); } catch (e) { k = 1; }
      if (k > 0) { tenues++; console.log('✅ mutation ' + nom + ' ⇒ rouge (' + k + ')'); } else { console.log('❌ mutation ' + nom + ' ⇒ resté VERT'); process.exitCode = 1; }
    }
    console.log(`\n${tenues}/${Object.keys(MUTATIONS).length} mutations rougissent`);
    return;
  }
  const k = (await audit(src, true)) + branchement(true);
  console.log(k ? `\n❌ ${k} contrôle(s) rouge(s)` : '\n✅ audit-paires-dorment : tout est vert');
  process.exitCode = k ? 1 : 0;
})();
