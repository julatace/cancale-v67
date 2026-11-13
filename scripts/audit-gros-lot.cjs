if (!process.argv.includes('--prouve') && !process.env.MUT) require('./_source-app.cjs').brancher();   // (11 nov., découpe 2) lit l'app RECOLLÉE (scripts/brancher-audits.cjs)
// ⚠️ LE MODE « GROS LOT » À L'ACHAT (11 nov., lot gros-lot)
//
// Ce contrôle EXÉCUTE la règle (src/grosLot.js) sur des lots INVENTÉS ici et prouve :
//   1. un lot de 20 : parts égales, prorata d'un prix visé, à la main — la somme des parts vaut
//      prix + frais AU CENTIME, le reste est dit et posé sur des articles nommés (plus grand reste) ;
//   2. rien n'est deviné : un prix visé manquant, un écart à la main ⇒ refus (sauf cases vides : le reste y va) ;
//   3. les N° : consécutifs après le plus haut (la règle de l'app passée en paramètre), jamais un
//      N° déjà servi ; tapés (« Je numérote moi-même ») : vide, illisible, archive, déjà servi, double ⇒ refus ;
//   4. le plan : UN achat (prix = total + frais, ses N fiches), N fiches reliées à SON lot par id
//      et rang (jamais un titre), N coûts — et « Annuler » retire exactement ce qui a été posé,
//      jamais le pool des N° ;
//   5. l'app branche la règle (coque, formulaire, ancien répartiteur) ;
//   6. --prouve : chaque mutation de la règle rougit.
//
//   node scripts/audit-gros-lot.cjs           → le contrôle
//   node scripts/audit-gros-lot.cjs --prouve  → les mutations
// Aucune donnée réelle.
const fs = require('fs'), path = require('path'), os = require('os');
const R = path.join(__dirname, '..');

const MUTATIONS = [
  ['dernier-absorbe', "const r = repartirPrixLot(cible, rangs.map(() => ({ prix: null })));", "const r = { parts: rangs.map((i) => (i === n - 1 ? cible - Math.floor(cible / n) * (n - 1) : Math.floor(cible / n))) };"],
  ['visee-devinee', "if (manquent.length) return echec('visee', { rangs: manquent });", "if (manquent.length) { const r = repartirPrixLot(cible, rangs.map(() => ({ prix: null }))); return { ok: true, cible, parts: r.parts, reste: { centimes: 0, sur: [] } }; }"],
  ['ecart-accepte', "if (ecart !== 0) return echec('ecart', { ecart, cible });", ""],
  ['numero-deja-servi', "if (!num || avant.has(k) || out.some((x) => cleNum(x) === k)) throw new Error('numéro déjà servi');", "if (!num) throw new Error('vide');"],
  ['tape-deja-servi', "else if (pris.has(c)) raison = 'pris';", ""],
  ['fiche-sans-lot', "origine: ORIGINE_LOT, achat: String(lotId), rang: i + 1, cout: part,", "origine: ORIGINE_LOT, cout: part,"],
  ['case-oubliee', "if (place) { fiches[id].case = place; fiches[id].rangeAt = maintenant; slots[numero] = place; }", ""],
  ['case-hors-geste', "  for (const [num, c] of Object.entries(plan.slots || {})) m.push({ k: 'vrm_slots', type: 'cle', id: num, avant: undefined, apres: c });\n", ""],
  ['pool-annule', "export function morceauxGrosLot(plan) {\n  const m = [", "export function morceauxGrosLot(plan) {\n  const m = [{ k: 'vinted_used_numeros', type: 'cle', id: 'lot', avant: undefined, apres: 1 }, "],
];

async function jouer(dir, { silencieux = false } = {}) {
  let ko = 0, ok = 0;
  const dit = (c, m, d) => { if (c) ok++; else ko++; if (!silencieux || !c) console.log(`${c ? '✅' : '❌'} ${m}${d && !c ? ' — ' + d : ''}`); };
  const G = await import('file://' + path.join(dir, 'grosLot.js') + '?v=' + Math.random()).catch((e) => { dit(false, 'src/grosLot.js se charge', e.message); return null; });
  const Cb = await import('file://' + path.join(R, 'src', 'corbeille.js')).catch(() => null);
  if (!G) return { ok, ko };
  const somme = (p) => p.reduce((s, x) => s + x, 0);

  if (!silencieux) console.log('── 1. Un lot de 20, trois répartitions, au centime');
  const N = 20, TOTAL = 41250, FRAIS = 1730, CIBLE = TOTAL + FRAIS;   // 412,50 € + 17,30 € de port (inventés)
  {
    const r = G.repartirGrosLot({ total: TOTAL, frais: FRAIS, n: N, mode: 'egal' });
    dit(r.ok && r.parts.length === N && somme(r.parts) === CIBLE, 'parts égales : la somme vaut 429,80 € au centime', JSON.stringify(r.parts));
    dit(r.ok && r.parts.every((p) => p === 2149 || p === 2149 + 1) && r.reste.centimes === CIBLE - 2149 * N, 'parts égales : 21,49 € chacun, le reste (0 ct ici) dit', JSON.stringify(r.reste));
    const r3 = G.repartirGrosLot({ total: 10000, n: 3, mode: 'egal' });
    dit(r3.ok && r3.parts.join(',') === '3334,3333,3333' && r3.reste.centimes === 1 && r3.reste.sur.join(',') === '0', '100 € en 3 : 33,34 + 33,33 + 33,33, le centime posé sur l’article 1 (dit)', JSON.stringify(r3));
    const r7 = G.repartirGrosLot({ total: 10000, frais: 5, n: 7, mode: 'egal' });
    dit(r7.ok && somme(r7.parts) === 10005 && r7.reste.centimes === 10005 - 1429 * 7 && r7.reste.sur.length === r7.reste.centimes, '100,05 € en 7 : chaque centime de reste sur un article nommé', JSON.stringify(r7));
    const visees = Array.from({ length: N }, (_, i) => 2000 + i * 350 + (i % 3) * 7);
    const rv = G.repartirGrosLot({ total: TOTAL, frais: FRAIS, n: N, mode: 'revente', visees });
    const sv = somme(visees);
    const exacts = visees.map((v) => (CIBLE * v) / sv);
    dit(rv.ok && somme(rv.parts) === CIBLE, 'prorata du prix visé : somme = 429,80 € au centime', String(rv.ok && somme(rv.parts)));
    dit(rv.ok && rv.parts.every((p, i) => Math.abs(p - exacts[i]) < 1), 'prorata : chaque part à moins d’un centime de sa part exacte', rv.ok ? JSON.stringify(rv.parts.map((p, i) => (p - exacts[i]).toFixed(2))) : rv.raison);
    dit(rv.ok && rv.reste.sur.length === rv.reste.centimes && rv.reste.centimes < N, 'prorata : le reste dit, un centime par article nommé', JSON.stringify(rv.ok && rv.reste));
    const manuels = Array.from({ length: N }, (_, i) => (i % 4 === 3 ? null : 1500 + i * 10));
    const rm = G.repartirGrosLot({ total: TOTAL, frais: FRAIS, n: N, mode: 'main', manuels });
    const vides = manuels.map((m, i) => (m == null ? i : -1)).filter((i) => i >= 0);
    dit(rm.ok && somme(rm.parts) === CIBLE && manuels.every((m, i) => m == null || rm.parts[i] === m), 'à la main : ce qu’il a tapé est gardé, la somme tombe juste', rm.ok ? '' : rm.raison);
    dit(rm.ok && rm.reste.cases && rm.reste.sur.join(',') === vides.join(',') && rm.reste.centimes === CIBLE - somme(manuels.filter((x) => x != null)), 'à la main : le reste va dans les cases vides, nommées', JSON.stringify(rm.reste));
  }

  if (!silencieux) console.log('── 2. Rien n’est deviné');
  {
    const v = Array.from({ length: N }, (_, i) => (i === 6 ? null : 3000));
    const r = G.repartirGrosLot({ total: TOTAL, frais: FRAIS, n: N, mode: 'revente', visees: v });
    dit(!r.ok && r.raison === 'visee' && r.rangs.join(',') === '6', 'un prix visé manquant ⇒ refus, l’article 7 nommé', JSON.stringify(r));
    const plein = Array.from({ length: 3 }, () => 3000);
    const e = G.repartirGrosLot({ total: 10000, n: 3, mode: 'main', manuels: plein });
    dit(!e.ok && e.raison === 'ecart' && e.ecart === 1000, 'à la main, 90 € tapés sur 100 € ⇒ refus « il manque 10,00 € »', JSON.stringify(e));
    const t = G.repartirGrosLot({ total: 10000, n: 3, mode: 'main', manuels: [5000, 6000, null] });
    dit(!t.ok && t.raison === 'trop', 'à la main, 110 € sur 100 € ⇒ refus « de trop »', JSON.stringify(t));
    const ill = G.repartirGrosLot({ total: 10000, n: 2, mode: 'main', manuels: [NaN, null] });
    dit(!ill.ok && ill.raison === 'illisible', 'un montant illisible ⇒ refus', JSON.stringify(ill));
    dit(!G.repartirGrosLot({ total: null, n: 3, mode: 'egal' }).ok && !G.repartirGrosLot({ total: 100, n: 1, mode: 'egal' }).ok, 'sans prix total, ou un seul article ⇒ pas un lot');
    dit(G.centimesTapes('412,5') === 41250 && G.centimesTapes('1 200,00') === 120000 && G.centimesTapes('') === null && Number.isNaN(G.centimesTapes('12,345')) && Number.isNaN(G.centimesTapes('-3')), 'montants tapés lus au centime (vide ⇒ rien, illisible ⇒ dit)');
  }

  if (!silencieux) console.log('── 3. Les N°');
  {
    const cleNum = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
    // La règle de l'app (App.jsx `prochainLibre`), recopiée ICI pour le banc seulement : l'app passe la sienne.
    const prochainLibre = (prisInt, prisCles, pref) => { if (!pref) { let c = 1; for (const x of prisInt) { const n = Number(x); if (Number.isFinite(n) && n >= c) c = n + 1; } prisInt.add(c); return String(c); } let c = 1; for (const k of prisCles) { const m = String(k).match(/^([A-Z]{1,3})(\d+)$/); if (m && m[1] === pref && Number(m[2]) >= c) c = Number(m[2]) + 1; } prisCles.add(pref + c); return pref + c; };
    const pris = { int: new Set([1, 2, 3, 7, 44]), cles: new Set(['1', '2', '3', '7', '44', 'B230']) };   // un trou (4-6) qui ne se comble jamais
    const nums = G.numerosDuLot(N, { pris, prochainLibre, cleNum });
    dit(nums.length === N && nums[0] === '45' && nums[N - 1] === '64', '20 N° consécutifs après le plus haut : N°45 à N°64 (jamais le trou 4-6)', nums.join(','));
    dit(pris.int.size === 5, 'les N° pris donnés à la règle ne sont pas modifiés (copie)');
    const nA = G.numerosDuLot(3, { pris: { int: new Set(), cles: new Set(['A9', 'A10']) }, pref: 'A', prochainLibre, cleNum });
    dit(nA.join(',') === 'A11,A12,A13', 'série à lettres : A11, A12, A13', nA.join(','));
    let leve = false; try { G.numerosDuLot(1, { pris: { int: new Set([5]), cles: new Set(['5']) }, prochainLibre: () => '5', cleNum }); } catch (_) { leve = true; }
    dit(leve, 'une règle qui rendrait un N° déjà servi ⇒ rien (lève)');
    const prisK = new Set(['45', '12', 'B7']);
    const v = G.verifierNumerosTapes(['', 'X', 'B8', '45', '50', '050'], { pris: prisK, archive: 'B', cleNum });
    const raisons = v.erreurs.map((e) => `${e.i}:${e.raison}`).join(',');
    dit(!v.ok && raisons === '0:vide,1:illisible,2:archive,3:pris,5:double', 'tapés : vide, illisible, archive B, déjà servi, « 050 » = « 50 » en double ⇒ refusés, chacun dit', raisons);
    dit(G.verifierNumerosTapes(['60', '61'], { pris: prisK, archive: 'B', cleNum }).ok, 'tapés neufs ⇒ acceptés');
    dit(G.verifierNumerosTapes(['60'], { pris: null, cleNum }).erreurs[0].raison === 'passu', 'N° servis pas lus ⇒ « pas su », rien accepté');
    dit(G.suiteDepuis('A12', 3, cleNum).join(',') === 'A12,A13,A14' && G.suiteDepuis('045', 2, cleNum).join(',') === '45,46', '« À la suite » depuis le 1er N° tapé');
  }

  if (!silencieux) console.log('── 4. Le plan : un achat, N fiches reliées par id, N coûts ; « Annuler » ne rend jamais les N°');
  {
    const rep = G.repartirGrosLot({ total: TOTAL, frais: FRAIS, n: N, mode: 'egal' });
    const articles = Array.from({ length: N }, (_, i) => ({ titre: i < 2 ? 'Nike Air Max 90' : '', taille: String(38 + (i % 8)), visee: null, photo: i === 0 }));
    const numeros = Array.from({ length: N }, (_, i) => String(45 + i));
    const ids = numeros.map((_, i) => 'fiche_' + i);
    let p = null; try { p = G.planGrosLot({ lotId: 'ob_lot1', titre: 'Déstockage', date: '2026-11-11', source: 'Brocante', total: TOTAL, frais: FRAIS, mode: 'egal', articles, numeros, repartition: rep, ids, maintenant: '2026-11-11T10:00:00.000Z' }); } catch (e) { dit(false, 'le plan se calcule', e.message); }
    if (p) {
      dit(p.achat.id === 'ob_lot1' && p.achat.price === '429,80' && p.achat.lot.n === N && p.achat.lot.prix === TOTAL && p.achat.lot.frais === FRAIS, 'UN achat : 429,80 € (prix + frais), le lot de 20 dedans');
      dit(G.lotJuste(p.achat), 'la somme des parts du lot = ce qui est sorti de sa poche');
      const fs_ = Object.values(p.fiches);
      dit(fs_.length === N && fs_.every((f, i) => f.achat === 'ob_lot1' && f.rang === i + 1 && f.numero === numeros[i] && f.cout === rep.parts[i]), 'N fiches, chacune reliée à SON lot par id et rang, son N°, son coût');
      dit(fs_[0].titre === fs_[1].titre && fs_[0].achat === fs_[1].achat && fs_[0].numero !== fs_[1].numero, 'deux fiches au même titre restent deux identités (N° et rang)');
      dit(fs_[0].photoLigne === G.PREFIXE_PHOTO_LOT + 'fiche_0' && !('photoLigne' in fs_[1]), 'la photo facultative : sa ligne seulement si elle a été écrite');
      dit(Object.keys(p.couts).length === N && p.couts['45'] === '21,49' && Object.values(p.couts).reduce((s, c) => s + G.centimesTapes(c), 0) === CIBLE, 'N coûts par N° (`vinted_buyprice_by_num`), somme = 429,80 €');
      const m = G.morceauxGrosLot(p);
      dit(!m.some((x) => x.k === 'vinted_used_numeros'), 'le geste annulable ne touche pas le pool : un N° servi le reste');
      if (Cb) {
        const avant = { vinted_offvinted_buys: [{ id: 'ob_ancien', title: 'Ancien', price: '10' }], vrm_fiches_neuves: { autre: { id: 'autre', numero: '9' } }, vinted_buyprice_by_num: { 9: '5,00' } };
        const apres = {}; for (const k of Object.keys(avant)) apres[k] = Cb.appliquerMorceaux(avant[k], m, 'apres', k).valeur;
        dit(apres.vinted_offvinted_buys.length === 2 && apres.vinted_offvinted_buys[0].id === 'ob_lot1' && Object.keys(apres.vrm_fiches_neuves).length === N + 1 && Object.keys(apres.vinted_buyprice_by_num).length === N + 1, 'Ajouter : l’achat en tête, les fiches et les coûts posés, l’existant gardé');
        const retour = {}; for (const k of Object.keys(avant)) retour[k] = Cb.appliquerMorceaux(apres[k], m, 'avant', k).valeur;
        dit(Object.keys(avant).every((k) => Cb.egal(retour[k], avant[k])), '« Annuler » rend exactement l’état d’avant (achat, fiches, coûts)');
      } else dit(false, 'src/corbeille.js se charge');
      // (intégration g1) avec des cases : la fiche porte sa case, la case est notée par N°, « Annuler » la rend.
      const cases = numeros.map((_, i) => (i < 2 ? { m: 'meuble_a', i: 7 + i } : null));
      let pc = null; try { pc = G.planGrosLot({ lotId: 'ob_lot2', total: TOTAL, frais: FRAIS, mode: 'egal', articles, numeros, repartition: rep, ids, cases, maintenant: '2026-11-11T10:00:00.000Z' }); } catch (e) { dit(false, 'le plan avec cases se calcule', e.message); }
      if (pc) {
        const f0 = pc.fiches.fiche_0, f2 = pc.fiches.fiche_2;
        dit(f0.case && f0.case.m === 'meuble_a' && f0.case.i === 7 && f0.rangeAt === '2026-11-11T10:00:00.000Z' && !f2.case && Object.keys(pc.slots).join() === '45,46' && pc.slots['46'].i === 8, 'cases : la fiche porte SA case, la case est notée sous SON N° ; un article sans case libre n’en reçoit aucune');
        const mc = G.morceauxGrosLot(pc).filter((x) => x.k === 'vrm_slots');
        dit(mc.length === 2 && mc.every((x) => x.avant === undefined), 'les cases font partie du MÊME geste annulable (« Annuler » les libère)');
      }
      let refusC = false; try { G.planGrosLot({ lotId: 'y', total: TOTAL, frais: FRAIS, mode: 'egal', articles, numeros, repartition: rep, ids, cases: [null] }); } catch (_) { refusC = true; }
      dit(refusC, 'des cases qui ne vont pas avec les articles ⇒ refus');
      let refus = false; try { G.planGrosLot({ lotId: 'x', total: 100, mode: 'egal', articles: [{}, {}], numeros: ['1', '2'], ids: ['a', 'b'], repartition: { ok: true, parts: [40, 40], reste: { centimes: 0, sur: [] } } }); } catch (_) { refus = true; }
      dit(refus, 'un plan dont les parts ne font pas le total est refusé (rien n’est écrit)');
    }
  }
  return { ok, ko };
}

function appli() {
  let ko = 0, ok = 0;
  const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${d && !c ? ' — ' + d : ''}`); };
  console.log('── 5. L’app branche la règle');
  const sans = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const app = sans(fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8'));
  const ach = sans(fs.readFileSync(path.join(R, 'src', 'ecrans', 'Achats.jsx'), 'utf8'));
  const bloc = fs.existsSync(path.join(R, 'src', 'GrosLot.jsx')) ? sans(fs.readFileSync(path.join(R, 'src', 'GrosLot.jsx'), 'utf8')) : '';
  const c = (() => { const i = app.indexOf('async function creerGrosLot'); return i < 0 ? '' : app.slice(i, app.indexOf('\n}\n', i)); })();
  dit(!!c, 'la coque `creerGrosLot` existe');
  dit(/repartirGrosLot\(/.test(c), 'la coque REJOUE la répartition (la même règle que l’écran)');
  dit(/numerosServisRelus\(\)/.test(c) && /if \(!pris\) return/.test(c), 'les N° servis sont RELUS (réservés en base compris) ; pas su ⇒ rien');
  dit(/numeroEcritActif\(\)[\s\S]*verifierNumerosTapes/.test(c), '« Je numérote moi-même » : les N° tapés sont vérifiés');
  dit(c.indexOf("save('vinted_used_numeros'") > 0 && c.indexOf("save('vinted_used_numeros'") < c.indexOf('gesteMorceaux('), 'le pool est écrit AVANT le geste annulable (jamais rendu)');
  dit(/gesteMorceaux\([^)]*morceauxGrosLot\(plan\)/.test(c), 'UN geste annulable 5 s (la pilule « Annuler »)');
  dit(/d\.apercu[\s\S]*'decale'/.test(c), 'une suite de N° qui a bougé depuis l’aperçu ⇒ rien écrit, dit');
  dit(/lot=\{(?:horsLigneVue \? null : )?\{\s*creer:/.test(app), 'le formulaire « Nouvel achat » reçoit le mode lot (hors ligne : pas de lot, ses N° viennent du serveur)');
  // (intégration g1) le branchement gros-lot ↔ rangement-guide : les cases en série par la règle du rangement guidé.
  const cl = (() => { const i = app.indexOf('function casesLotApercu'); return i < 0 ? '' : app.slice(i, app.indexOf('\n}\n', i)); })();
  dit(/casesEnSerie\(\{[^}]*habitude: caseHabitude\(/.test(cl), 'les cases du lot : la règle du rangement guidé (`casesEnSerie`, après la dernière rangée)');
  dit(/Array\.isArray\(d\.cases\)[\s\S]*casesLotApercu\(n\)[\s\S]*'decale'/.test(c) && /cases: places/.test(c), 'les cases REJOUÉES à « Ajouter » ; une suite qui a bougé ⇒ rien écrit, dit');
  dit(/cases: casesLotApercu/.test(app) && /apercuCases=\{lot\.cases\}/.test(ach) && /casesDuLot\(form\.lot, lot\.cases\)/.test(ach), 'le formulaire montre les cases et envoie celles qu’il a gardées');
  dit(/data-lot-ranger/.test(bloc) && /data-lot-case=/.test(bloc), 'l’écran : « Ranger dans ces cases » (décochable) et la case de chaque article');
  dit(/data-achat-mode/.test(ach) && /BlocGrosLot/.test(ach) && /lot\.creer\(/.test(ach), 'le formulaire : « Un article · Un lot », le bloc, « Ajouter le lot »');
  dit(/cleFacture\('hors', r\.id\)/.test(ach), 'UNE pièce justificative, rangée sous l’identité du lot');
  dit(/repartirGrosLot\(/.test(bloc) || /repartitionDuLot/.test(bloc), 'l’écran calcule les parts par la même règle');
  const vieux = (() => { const i = app.indexOf('const lotShares = () =>'); return i < 0 ? '' : app.slice(i, app.indexOf('const applyLot', i)); })();
  dit(/repartirGrosLot\(/.test(vieux) && !/toFixed\(2\)/.test(vieux), 'l’ancien « Répartir un lot » (hors menu) suit la même règle du centime');
  return { ok, ko };
}

(async () => {
  const src = path.join(R, 'src');
  if (process.argv.includes('--prouve')) {
    let rouges = 0;
    const base = fs.readFileSync(path.join(src, 'grosLot.js'), 'utf8');
    for (const [nom, a, b] of MUTATIONS) {
      if (!base.includes(a)) { console.log(`❌ mutation ${nom} : motif absent`); continue; }
      const d = fs.mkdtempSync(path.join(os.tmpdir(), 'gl-mut-'));
      fs.writeFileSync(path.join(d, 'grosLot.js'), base.replace(a, b));
      fs.copyFileSync(path.join(src, 'venteLot.js'), path.join(d, 'venteLot.js'));
      const r = await jouer(d, { silencieux: true });
      console.log(`${r.ko ? '✅' : '❌'} mutation ${nom} ⇒ ${r.ko} rouge(s)`);
      if (r.ko) rouges++;
      fs.rmSync(d, { recursive: true, force: true });
    }
    console.log(`\n${rouges}/${MUTATIONS.length} mutations rougissent`);
    process.exit(rouges === MUTATIONS.length ? 0 : 1);
  }
  const r = await jouer(src);
  const a = appli();
  console.log(`\n${r.ok + a.ok} ✅ · ${r.ko + a.ko} ❌`);
  process.exit(r.ko + a.ko ? 1 : 0);
})();
