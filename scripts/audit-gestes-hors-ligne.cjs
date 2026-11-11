// ════════════════════════════════════════════════════════════════════════════
//  LES GESTES HORS LIGNE (src/gestesHorsLigne.js) — EXÉCUTÉS (11 nov.)
//
//  On exécute le VRAI module (et la vraie src/fusionNuage.js) avec un registre
//  en mémoire (« fermer l'app » = un registre neuf sur le même stockage) et un
//  faux nuage à comparer-et-échanger sur `data.rev` (la forme de `cloudPush`) :
//   1. un `save` hors ligne ⇒ un geste PAR SOUS-VALEUR, avant/après, identifiant ;
//      « Fait » puis « Annuler » ⇒ plus rien ; le prix tapé deux fois ⇒ UN geste ;
//   2. l'app fermée puis rouverte ⇒ les gestes sont toujours là ;
//   3. au retour : rejoués UN PAR UN (une écriture par geste, rev + 1) ;
//   4. envoyé, réponse perdue ⇒ jamais appliqué deux fois (identifiant) ;
//   5. changé ailleurs pendant la coupure ⇒ À TRANCHER avec les deux versions,
//      rien d'écrit, l'appareil reprend la valeur de la base ;
//   6. un ensemble (colis retiré) fait des deux côtés ⇒ d'accord, rien à écrire ;
//   7. 429 / 503 au milieu ⇒ arrêt, la suite reste en attente, dans l'ordre ;
//   8. devancé ⇒ relu, rejugé, ce que l'autre appareil a écrit reste ;
//   9. lecture ratée ⇒ rien écrit ;
//  10. N° saisi à la main : porté par une autre fiche ou donné ailleurs ⇒ à
//      trancher ; sinon écrit ET ajouté au pool ;
//  11. trancher « la mienne » ⇒ rejoué contre la valeur vue ; « l'autre » ⇒ rangé ;
//  12. un nouvel achat ⇒ ajouté une fois, jamais deux ;
//  13. le registre d'un autre compte n'est jamais rejoué ;
//  14. App.jsx branche le module (save hors ligne, cloudPush attend le rejeu,
//      interdits, mention de la coque).
//  `--prouve` : chaque mutation de la règle doit rendre au moins un rouge.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const racine = path.join(__dirname, '..');
const SRC = path.join(racine, 'src', 'gestesHorsLigne.js');
const SRC_FUSION = path.join(racine, 'src', 'fusionNuage.js');
const cleNum = (v) => { const s = String(v == null ? '' : v).toUpperCase().replace(/\s+/g, ''); const m = /^([A-Z]*)0*(\d+)$/.exec(s); return m ? m[1] + m[2] : s; };
const J = (o) => JSON.parse(JSON.stringify(o));

// Le faux nuage : la ligne `main`, PATCH conditionnel sur rev.
const nuage = (data) => ({ data: J({ rev: 7, ...data }), existe: true, lectures: 0, ecritures: 0, panneLecture: false, statut: null, reponsePerdue: false, avantEcriture: null });
const lireN = (N) => async () => { N.lectures++; if (N.panneLecture) return undefined; return { existe: N.existe, data: J(N.data), rev: N.data.rev }; };
const ecrireN = (N) => async (data, rev) => {
  if (N.avantEcriture) { const f = N.avantEcriture; N.avantEcriture = null; f(N); }
  if (N.statut) { const s = N.statut; if (typeof s === 'number') return { status: s }; N.statut = s - 1; }
  if (N.data.rev !== rev) return { devance: true };
  N.data = J(data); N.ecritures++;
  if (N.reponsePerdue) { N.reponsePerdue = false; throw new Error('réponse perdue'); }
  return { ok: true };
};

async function juger(dir, bavard = true) {
  const G = await import(pathToFileURL(path.join(dir, 'gestesHorsLigne.js')).href + '?t=' + Date.now() + Math.random());
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard || !c) console.log((c ? 'OK  ' : 'KO  ') + m + (d !== undefined && !c ? ' — ' + d : '')); };
  const U = 'uid-julien';
  const opt = (N, extra = {}) => ({ uid: U, lire: lireN(N), ecrire: ecrireN(N), cleNum, ...extra });

  // 1. noter
  {
    const st = G.stockageMemoireGestes();
    await G.noterGestes(st, U, 'vinted_ship_done', { a: 1 }, { a: 1, tx1: 111, tx2: 222 });
    let g = await G.lireGestes(st, U);
    dit(g.length === 2 && g.every((x) => x.etat === 'attente' && x.id && x.k === 'vinted_ship_done'), '1. deux colis cochés ⇒ deux gestes, en attente, avec identifiant', JSON.stringify(g));
    dit(new Set(g.map((x) => x.id)).size === 2, '1. identifiants uniques');
    await G.noterGestes(st, U, 'vinted_ship_done', { a: 1, tx1: 111, tx2: 222 }, { a: 1, tx2: 222 });
    g = await G.lireGestes(st, U);
    dit(g.length === 1 && g[0].chemin[0] === 'tx2', '1. « Annuler » hors ligne ⇒ le geste part (rien à envoyer)', JSON.stringify(g.map((x) => x.chemin)));
    await G.noterGestes(st, U, 'vinted_buyprice_by_num', { 12: '30' }, { 12: '3' });
    await G.noterGestes(st, U, 'vinted_buyprice_by_num', { 12: '3' }, { 12: '35' });
    g = await G.lireGestes(st, U);
    const p = g.filter((x) => x.k === 'vinted_buyprice_by_num');
    dit(p.length === 1 && p[0].avant === '30' && p[0].apres === '35', '1. prix tapé en deux fois ⇒ UN geste, avant d\'origine gardé', JSON.stringify(p));
    await G.noterGestes(st, U, 'vinted_annonce_numeros', { i1: { numero: '5', photo: 'a' } }, { i1: { numero: '5', photo: 'a', manuelAt: 'x' } });
    g = await G.lireGestes(st, U);
    dit(g.some((x) => x.k === 'vinted_annonce_numeros' && x.chemin.length === 2 && x.chemin[1] === 'manuelAt'), '1. une fiche se note CHAMP par champ');
    const r = await G.noterGestes(st, U, 'vinted_accounts', [], [{ id: 1 }]);
    dit(r && r.notes === 0, '1. une clé hors liste (comptes, jetons) n\'est jamais un geste');
    // 2. fermer / rouvrir : même stockage, rien de perdu
    const g2 = await G.lireGestes(st, U);
    dit(g2.length === g.length, '2. app fermée puis rouverte ⇒ les gestes sont là');
    // Le stockage qui refuse ⇒ pas su
    const casse = { lire: async () => null, ecrire: async () => false };
    const rr = await G.noterGestes(casse, U, 'vinted_ship_done', {}, { t: 1 });
    dit(rr === null, '1. registre illisible ⇒ « pas su » (null), jamais « noté »');
  }

  // 3. rejeu un par un + 4. jamais deux fois
  {
    const st = G.stockageMemoireGestes();
    const N = nuage({ vinted_ship_done: { z: 1 }, vinted_buyprice_by_num: { 12: '30' }, vinted_achat_notes: {} });
    await G.noterGestes(st, U, 'vinted_ship_done', { z: 1 }, { z: 1, tx1: 111 });
    await G.noterGestes(st, U, 'vinted_buyprice_by_num', { 12: '30' }, { 12: '35' });
    await G.noterGestes(st, U, 'vinted_achat_notes', {}, { tx9: 'carton bleu' });
    const b = await G.rejouer({ stockage: st, ...opt(N) });
    dit(b.envoyes === 3 && b.arret === null && N.ecritures === 3 && N.data.rev === 10, '3. trois gestes ⇒ trois écritures, une par geste, rev 7 → 10', JSON.stringify({ b, e: N.ecritures, rev: N.data.rev }));
    dit(N.data.vinted_ship_done.tx1 === 111 && N.data.vinted_ship_done.z === 1 && N.data.vinted_buyprice_by_num['12'] === '35' && N.data.vinted_achat_notes.tx9 === 'carton bleu', '3. la base porte les trois gestes, rien d\'autre n\'a bougé');
    dit((N.data.vrm_gestes_faits || []).length === 3, '3. leurs identifiants sont notés dans la base');
    const c = G.compter(await G.lireGestes(st, U));
    dit(c.attente === 0 && c.envoye === 3, '3. tous « envoyés »');
    const b2 = await G.rejouer({ stockage: st, ...opt(N) });
    dit(b2.envoyes === 0 && N.ecritures === 3, '3. rejoué deux fois ⇒ rien de plus');
  }
  {
    const st = G.stockageMemoireGestes();
    const N = nuage({ vinted_offvinted_buys: [{ id: 'ob_1', prix: 10 }] });
    await G.noterGestes(st, U, 'vinted_offvinted_buys', [{ id: 'ob_1', prix: 10 }], [{ id: 'ob_2', prix: 40, photo: 'data:x' }, { id: 'ob_1', prix: 10 }]);
    N.reponsePerdue = true;
    const b = await G.rejouer({ stockage: st, ...opt(N) });
    dit(b.arret === 0 && N.ecritures === 1, '4. écrit mais réponse perdue ⇒ le geste reste en attente (pas su ≠ envoyé)', JSON.stringify(b));
    // l'autre appareil retire l'achat entre-temps ; le rejeu NE le remet PAS (identifiant noté)
    N.data.vinted_offvinted_buys = N.data.vinted_offvinted_buys.filter((x) => x.id !== 'ob_2'); N.data.rev++;
    const b2 = await G.rejouer({ stockage: st, ...opt(N) });
    dit(b2.envoyes === 1 && N.ecritures === 1 && !N.data.vinted_offvinted_buys.some((x) => x.id === 'ob_2'), '4. au rejeu : identifiant déjà dans la base ⇒ jamais appliqué deux fois', JSON.stringify(N.data.vinted_offvinted_buys));
  }
  // 12. nouvel achat ajouté une fois
  {
    const st = G.stockageMemoireGestes();
    const N = nuage({ vinted_offvinted_buys: [{ id: 'ob_1', prix: 10 }] });
    await G.noterGestes(st, U, 'vinted_offvinted_buys', [{ id: 'ob_1', prix: 10 }], [{ id: 'ob_2', prix: 40 }, { id: 'ob_1', prix: 10 }]);
    await G.rejouer({ stockage: st, ...opt(N) });
    await G.rejouer({ stockage: st, ...opt(N) });
    dit(N.data.vinted_offvinted_buys.filter((x) => x.id === 'ob_2').length === 1 && N.data.vinted_offvinted_buys.length === 2, '12. nouvel achat ⇒ ajouté UNE fois, l\'ancien gardé', JSON.stringify(N.data.vinted_offvinted_buys));
  }

  // 5. conflit
  {
    const st = G.stockageMemoireGestes();
    const N = nuage({ vinted_buyprice_by_num: { 12: '30', 13: '20' } });
    await G.noterGestes(st, U, 'vinted_buyprice_by_num', { 12: '30', 13: '20' }, { 12: '35', 13: '20' });
    N.data.vinted_buyprice_by_num['12'] = '32'; // l'autre appareil, pendant la coupure
    const poses = [];
    const b = await G.rejouer({ stockage: st, ...opt(N), poserLocal: (k, ch, v) => poses.push([k, ch, v]) });
    const g = (await G.lireGestes(st, U))[0];
    dit(b.conflits === 1 && N.ecritures === 0 && N.data.vinted_buyprice_by_num['12'] === '32', '5. changé ailleurs ⇒ rien n\'est écrit, la valeur de l\'autre appareil reste', JSON.stringify({ b, v: N.data.vinted_buyprice_by_num }));
    dit(g.etat === 'atrancher' && g.apres === '35' && g.nuage === '32', '5. le geste est « à trancher » avec les DEUX versions', JSON.stringify(g));
    dit(poses.length === 1 && poses[0][2] === '32', '5. l\'appareil reprend la valeur de la base (l\'envoi suivant ne l\'écrase pas)');
    // 11. trancher « la mienne »
    await G.trancher(st, U, g.id, 'mien');
    const b2 = await G.rejouer({ stockage: st, ...opt(N) });
    dit(b2.envoyes === 1 && N.data.vinted_buyprice_by_num['12'] === '35', '11. « garder la mienne » ⇒ rejoué contre la valeur vue, écrit', JSON.stringify(N.data.vinted_buyprice_by_num));
  }
  {
    const st = G.stockageMemoireGestes();
    const N = nuage({ vrm_notes_paires: { 5: 'a' } });
    await G.noterGestes(st, U, 'vrm_notes_paires', { 5: 'a' }, { 5: 'b' });
    N.data.vrm_notes_paires['5'] = 'c';
    await G.rejouer({ stockage: st, ...opt(N) });
    const g = (await G.lireGestes(st, U))[0];
    N.data.vrm_notes_paires['5'] = 'd'; // encore changé avant qu'il tranche
    await G.trancher(st, U, g.id, 'mien');
    await G.rejouer({ stockage: st, ...opt(N) });
    const g2 = (await G.lireGestes(st, U))[0];
    dit(g2.etat === 'atrancher' && N.data.vrm_notes_paires['5'] === 'd', '11. « la mienne » mais la base a encore changé ⇒ à trancher de nouveau, rien écrasé');
    await G.trancher(st, U, g2.id, 'autre');
    const c = G.compter(await G.lireGestes(st, U));
    dit(c.atrancher === 0 && c.attente === 0 && N.data.vrm_notes_paires['5'] === 'd', '11. « garder l\'autre » ⇒ rangé, rien écrit');
  }

  // 6. ensemble
  {
    const st = G.stockageMemoireGestes();
    const N = nuage({ vinted_pickup_done: {}, vrm_colis_collected: ['c1'] });
    await G.noterGestes(st, U, 'vinted_pickup_done', {}, { tx5: '2026-11-11T10:00' });
    await G.noterGestes(st, U, 'vrm_colis_collected', ['c1'], ['c1', 'c2']);
    N.data.vinted_pickup_done.tx5 = '2026-11-11T10:05'; N.data.vrm_colis_collected.push('c2');
    const b = await G.rejouer({ stockage: st, ...opt(N) });
    dit(b.conflits === 0 && b.envoyes === 2 && N.ecritures === 0, '6. retiré des deux côtés ⇒ d\'accord, rien à écrire, rien à trancher', JSON.stringify(b));
  }

  // 7. 429 / 503 au milieu
  for (const st0 of [429, 503]) {
    const st = G.stockageMemoireGestes();
    const N = nuage({ vinted_ship_done: {} });
    for (const t of ['t1', 't2', 't3']) await G.noterGestes(st, U, 'vinted_ship_done', (await G.lireGestes(st, U)).reduce((o, g) => ({ ...o, [g.chemin[0]]: 1 }), {}), { ...(await G.lireGestes(st, U)).reduce((o, g) => ({ ...o, [g.chemin[0]]: 1 }), {}), [t]: 1 });
    let n = 0; const ecr = ecrireN(N);
    const b = await G.rejouer({ stockage: st, uid: U, lire: lireN(N), cleNum, ecrire: async (d, r) => (++n === 2 ? { status: st0 } : ecr(d, r)) });
    const gs = await G.lireGestes(st, U);
    dit(b.arret === st0 && N.ecritures === 1 && gs.filter((g) => g.etat === 'attente').map((g) => g.chemin[0]).join() === 't2,t3', `7. ${st0} au 2e geste ⇒ arrêt, t2 et t3 en attente, dans l'ordre`, JSON.stringify({ b, gs: gs.map((g) => [g.chemin[0], g.etat]) }));
    const b2 = await G.rejouer({ stockage: st, ...opt(N) });
    dit(b2.envoyes === 2 && Object.keys(N.data.vinted_ship_done).sort().join() === 't1,t2,t3', `7. ${st0} passé ⇒ la suite part`);
  }

  // 8. devancé
  {
    const st = G.stockageMemoireGestes();
    const N = nuage({ vinted_ship_done: {}, vrm_prenom: 'Julien' });
    await G.noterGestes(st, U, 'vinted_ship_done', {}, { t1: 1 });
    N.avantEcriture = (n) => { n.data.vrm_prenom = 'Ju'; n.data.rev++; };
    const b = await G.rejouer({ stockage: st, ...opt(N) });
    dit(b.envoyes === 1 && N.data.vrm_prenom === 'Ju' && N.data.vinted_ship_done.t1 === 1, '8. devancé ⇒ relu, rejugé : le geste ET la valeur de l\'autre appareil restent', JSON.stringify(N.data));
  }

  // 9. lecture ratée
  {
    const st = G.stockageMemoireGestes();
    const N = nuage({ vinted_ship_done: {} });
    await G.noterGestes(st, U, 'vinted_ship_done', {}, { t1: 1 });
    N.panneLecture = true;
    const b = await G.rejouer({ stockage: st, ...opt(N) });
    dit(b.arret === 'pas-su' && N.ecritures === 0 && G.compter(await G.lireGestes(st, U)).attente === 1, '9. lecture ratée ⇒ rien écrit, le geste attend');
    // « lecture KO, écriture OK » : la base accepterait l'écriture (rev 0).
    const st2 = G.stockageMemoireGestes();
    const N2 = nuage({ vinted_ship_done: {}, vrm_prenom: 'Julien' }); N2.data.rev = 0; N2.panneLecture = true;
    await G.noterGestes(st2, U, 'vinted_ship_done', {}, { t1: 1 });
    await G.rejouer({ stockage: st2, ...opt(N2) });
    dit(N2.ecritures === 0 && N2.data.vrm_prenom === 'Julien', '9. lecture KO, écriture possible ⇒ rien écrit, rien effacé');
  }

  // 10. numéros
  {
    const mk = async (data, avant, apres, extra) => {
      const st = G.stockageMemoireGestes();
      const N = nuage(data);
      await G.noterGestes(st, U, 'vinted_annonce_numeros', avant, apres, { extra });
      const b = await G.rejouer({ stockage: st, ...opt(N) });
      return { st, N, b };
    };
    const a = await mk({ vinted_annonce_numeros: { i1: {}, i2: { numero: '40' } }, vinted_used_numeros: ['40'] }, { i1: {} }, { i1: { numero: '040' } }, () => ({ dejaDansPool: true }));
    dit(a.b.conflits === 1 && a.N.ecritures === 0, '10. N° porté par une autre fiche de la base ⇒ à trancher, rien écrit (jamais deux paires sous un N°)', JSON.stringify(a.b));
    const b = await mk({ vinted_annonce_numeros: { i1: {} }, vinted_used_numeros: ['1', '41'] }, { i1: {} }, { i1: { numero: '41' } }, () => ({ dejaDansPool: false }));
    dit(b.b.conflits === 1 && b.N.ecritures === 0, '10. N° donné ailleurs pendant la coupure (entré au pool) ⇒ à trancher');
    const c = await mk({ vinted_annonce_numeros: { i1: {} }, vinted_used_numeros: ['1'] }, { i1: {} }, { i1: { numero: '42' } }, () => ({ dejaDansPool: false }));
    dit(c.b.envoyes === 1 && c.N.data.vinted_annonce_numeros.i1.numero === '42' && c.N.data.vinted_used_numeros.includes('42') && c.N.data.vinted_used_numeros.includes('1'), '10. N° libre ⇒ écrit, ajouté au pool (union)', JSON.stringify(c.N.data));
  }

  // 13. un autre compte
  {
    const st = G.stockageMemoireGestes();
    const N = nuage({ vinted_ship_done: {} });
    await G.noterGestes(st, 'uid-autre', 'vinted_ship_done', {}, { t1: 1 });
    const b = await G.rejouer({ stockage: st, ...opt(N) });
    dit(b.envoyes === 0 && N.ecritures === 0, '13. les gestes d\'un autre compte VRM ne sont jamais rejoués');
    // Un registre abîmé qui mêle un geste d'un autre compte sous le nôtre.
    const g = (await G.lireGestes(st, 'uid-autre'))[0];
    await st.ecrire(U, { uid: U, seq: 1, gestes: [g] });
    const b2 = await G.rejouer({ stockage: st, ...opt(N) });
    dit(b2.envoyes === 0 && N.ecritures === 0, '13. même rangé sous notre compte, un geste d\'un autre n\'est jamais rejoué');
  }
  return ko;
}

function texteApp() {
  let ko = 0;
  const dit = (c, m) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m); };
  let app = fs.readFileSync(path.join(racine, 'src', 'App.jsx'), 'utf8');
  app = app.replace(/^\s*\/\/.*$/gm, '');
  const save = (/const save = \(k,v(?:,quand)?\) => \{[\s\S]*?\n\};/.exec(app) || [''])[0];
  dit(/horsLigneMaintenant\(\)[\s\S]{0,200}noterGesteHL\(/.test(save), '14. `save` note le geste quand le réseau est coupé');
  const push = (/const cloudPush = \(\) => \{[\s\S]*?\n\};/.exec(app) || [''])[0];
  dit(/if \(gestesBloquentEnvoi\(\)\)/.test(push) && push.split('gestesBloquentEnvoi()').length >= 3, '14. `cloudPush` attend le rejeu des gestes (au départ ET avant l\'aller-retour)');
  dit(/rejouerGestes\(/.test(app) && /addEventListener\('online'[^\n]*rejouerGestesBientot/.test(app), '14. le retour du réseau rejoue les gestes');
  dit(/<GestesHorsLigneCoque/.test(app), '14. la coque dit « Hors ligne · N gestes en attente »');
  dit(/refusHorsLigne\('extension'\)/.test(app) && /refusHorsLigne\('numero'\)/.test(app) && /refusHorsLigne\('paiement'\)/.test(app), '14. extension, nouveau N°, paiement refusés hors ligne, raison dite');
  // 15. Toute l'app hors ligne : les morceaux de CE build sont rangés en ligne (un écran jamais ouvert
  //     s'ouvre sans réseau), et la purge d'un déploiement ne les jette pas. Comportement : banc gestes-hors-ligne.
  const sw = fs.readFileSync(path.join(racine, 'public', 'sw.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  const vite = fs.readFileSync(path.join(racine, 'vite.config.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  dit(/fileName: 'hors-ligne-assets\.json'/.test(vite) && /plugins: \[[^\]]*listeHorsLigne\(\)/.test(vite), '15. le build publie la liste de ses morceaux');
  dit(/relireCoquille\(req, cache\)\.then\(\(\) => rechaufferMorceaux\(cache\)\)/.test(sw) && /purgerAncienneVersion\(fresh\.clone\(\)\)\.then\(\(\) => rechaufferMorceaux\(cache\)\)/.test(sw), '15. le service worker range les morceaux, à la 1re ouverture comme aux suivantes');
  dit(/new Set\(\[\.\.\.noms, \.\.\.\(await nomsGardesHorsLigne\(cache\)\)\]\)/.test(sw), '15. la purge d\'un déploiement garde les morceaux de la liste');
  return ko;
}

const MUTATIONS = [
  ['identifiant ignoré', (s) => s.replace("if (faits.includes(g.id)) return { etat: 'deja', raison: 'identifiant' };", '')],
  ['conflit ⇒ le geste écrase', (s) => s.replace("if (!memeVal(cur, g.avant)) return { etat: 'conflit', autre: clone(cur), raison: 'change-ailleurs' };", '')],
  ['union oubliée', (s) => s.replace("if (g.sorte === 'ensemble' && !vide(cur) && !vide(g.apres)) return { etat: 'deja', raison: 'union' };", '')],
  ['N° porté ailleurs accepté', (s) => s.replace("if (autre) return { etat: 'conflit'", "if (false) return { etat: 'conflit'")],
  ['N° pris au pool accepté', (s) => s.replace("if (dansPool && !g.dejaDansPool) return", "if (false) return")],
  ['pool pas complété', (s) => s.replace("if (!dansPool) data2 = { ...data2, [CLE_POOL]: [...pool, g.apres] };", '')],
  ['lecture ratée ⇒ on écrit', (s) => s.replace("if (!snap) { bilan.arret = 'pas-su'; return bilan; }", "if (!snap) snap = { existe: true, data: {}, rev: 0 };")],
  ['429 ⇒ on saute le geste', (s) => s.replace("bilan.arret = (r && r.status) || 0; return bilan;", "fini = true; break;")],
  ['devancé ⇒ écrase sans relire', (s) => s.replace("snap = s2; continue;", "snap = { ...snap, rev: s2.rev }; continue;")],
  ['avant d\'origine perdu', (s) => s.replace("gestes[i] = { ...g, apres: clone(d.apres), at: maintenant };", "gestes[i] = { ...g, avant: clone(d.avant), apres: clone(d.apres), at: maintenant };")],
  ['« Annuler » envoyé quand même', (s) => s.replace("if (memeVal(g.avant, d.apres)) { gestes.splice(i, 1); continue; }", '')],
  ['autre compte rejoué', (s) => s.replace("r.gestes.filter((g) => g && g.uid === uid)", 'r.gestes')],
  ['ids non notés', (s) => s.replace("[CLE_FAITS]: [...faits, g.id].slice(-FAITS_MAX)", '[CLE_FAITS]: faits')],
  ['trancher mien contre l\'ancienne base', (s) => s.replace("avant: g.nuage === null ? undefined : g.nuage, nuage: undefined", "nuage: undefined")],
  ['l\'appareil garde sa valeur après un conflit', (s) => s.replace("if (typeof poserLocal === 'function') { try { poserLocal(g.k, g.chemin, dec.autre); } catch (_) {} }", '')],
  ['fiche jugée en entier', (s) => s.replace("if (regle.forme === 'fiches' && (estObjet(a[id]) || estObjet(b[id]))) {", "if (false) {")],
];

const preparer = (dir, mut) => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  const g = fs.readFileSync(SRC, 'utf8');
  fs.writeFileSync(path.join(dir, 'gestesHorsLigne.js'), mut ? mut(g) : g);
  fs.copyFileSync(SRC_FUSION, path.join(dir, 'fusionNuage.js'));
  return g;
};

(async () => {
  if (process.argv.includes('--prouve')) {
    let vertes = 0;
    for (const [nom, mut] of MUTATIONS) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gestes-hl-mut-'));
      const g = preparer(dir, mut);
      if (mut(g) === g) { console.log('KO  mutation sans effet (le texte a changé) : ' + nom); vertes++; continue; }
      let ko; try { ko = await juger(dir, false); } catch (e) { ko = 1; }
      fs.rmSync(dir, { recursive: true, force: true });
      console.log((ko ? 'OK  ' : 'KO  ') + `mutation « ${nom} » ⇒ ${ko} rouge(s)`);
      if (!ko) vertes++;
    }
    console.log(vertes ? `\n${vertes} mutation(s) passent : le contrôle ne la voit pas` : '\nchaque mutation est vue');
    process.exit(vertes ? 1 : 0);
  }
  if (!fs.existsSync(SRC)) { console.log('KO  src/gestesHorsLigne.js absent : aucun geste hors ligne noté'); process.exit(1); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gestes-hl-'));
  preparer(dir);
  let ko = await juger(dir);
  fs.rmSync(dir, { recursive: true, force: true });
  if (!process.argv.includes('--module')) ko += texteApp();
  console.log(ko ? `\n${ko} rouge(s)` : '\ntout est vert');
  process.exit(ko ? 1 : 0);
})();
