#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LA LIAISON ACHAT ⇄ ARTICLE (15 nov., src/liaisonAchat.js)
//        node scripts/audit-liaison-achat.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// Julien (15 nov.) : « Je veux que tu améliores la liaison entre les achats et les articles en
// vente ou vendus, avec les titres, dates de retrait, couleur de l'article, etc. »
// EXÉCUTE la règle (src/liaisonAchat.js) avec la marque, les couleurs et le modèle de l'APP
// (extractBrand / extractColors / extractModel, extraits de src/App.jsx et exécutés) :
//   P  la PRÉCISION, mesurée sur un jeu INVENTÉ à la forme de sa vérité terrain (titres d'achat
//      sans taille, en six langues, sans mot de modèle ; mises en ligne 5 à 20 j après la commande ;
//      des achats voisins : autre taille, autre version, plus anciens, remboursés, postérieurs) —
//      l'ancienne règle (`suggestionsAchat`) et la nouvelle, top-1 et top-3 ; aucune « très
//      probable » fausse ;
//   I  « même avec 50 articles identiques… » : aucune « très probable » ; une marque différente
//      n'est jamais proposée ; un achat n'est jamais « très probable » pour deux articles ; deux
//      versions différentes (« novablast 4 » / « 3 ») écartées ; achat postérieur jamais ; « Ce n'est
//      pas lui » retenu ; un lot jamais « très probable » ; la phrase POURQUOI ; la taille US ;
//   R  relier SANS son clic est impossible : le module n'écrit rien, ne modifie pas ses entrées ;
//      l'app ne relie que dans un onClick (la carte, la feuille « Valider ») ;
//   S  le branchement (src/App.jsx) : vendus compris, « Ce n'est pas lui » synchronisé, la feuille
//      qui MONTRE la liste avant SON toucher, Achats → l'article proposé ;
//   V  la vitesse : 1 000 articles × 1 000 achats.
// Aucune donnée réelle : tout est inventé ici. (La mesure sur sa vraie base, en lecture seule, est
// dans docs/passation/2026-11-15-achats-liaison.md.)
// --prouve : chaque mutation réaffaiblit une règle ⇒ l'audit DOIT rougir.
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { execFileSync } = require('child_process');
const R = path.join(__dirname, '..');
const MUTS = {
  'marque-ignoree': ['src/liaisonAchat.js', "if (!ok) return null; }", '}'],
  // (16 nov., relier-fiable) L'affectation exclusive : meilleur couple d'abord, dominance mutuelle.
  'unicite-article': ['src/liaisonAchat.js', '    if (e.score - rival < ECART_TRES_PROBABLE) continue;\n', ''],
  'unicite-achat': ['src/liaisonAchat.js', '    if (e.score - rivalA < ECART_TRES_PROBABLE) continue;\n', ''],
  'version-ignoree': ['src/liaisonAchat.js', 'if (va && va !== v) return null;', ''],
  'taille-ignoree': ['src/liaisonAchat.js', 'if (ta.taille && !tailleOk && !ta.us) return null;', ''],
  'couleur-ignoree': ['src/liaisonAchat.js', 'if (!couleur) return null; }', '}'],
  'posterieur': ['src/liaisonAchat.js', 'if (!Number.isFinite(A.date) || (Number.isFinite(P.ref) && !(A.date < P.ref))) return null;', ''],
  'refus-ignore': ['src/liaisonAchat.js', "if (refus.size && refus.has(P.key + '>' + A.tx)) return null;", ''],
  'lot-tres-probable': ['src/liaisonAchat.js', 'const fort = !A.lot && !generique && score', 'const fort = !generique && score'],
  'un-seul-sens': ['src/liaisonAchat.js', 'couv = ((tot > 0 ? com / tot : 0) + (totA > 0 ? com / totA : 0)) / 2;', 'couv = tot > 0 ? com / tot : 0;'],
  'sans-chrono': ['src/liaisonAchat.js', 'if (jours != null) score += POIDS.chrono * Math.exp(-jours / POIDS.chronoJours);', ''],
  // (deux gardes : l'index ne pèse que les achats qui partagent un mot, et `evaluer` exige un mot commun)
  'mot-commun-ignore': ['src/liaisonAchat.js', 'if (!COMMUNS.length) return null;', '', 'for (const A of sansMots) {', 'for (const A of As) { if (A.vu === tampon) continue;'],
  'app-auto-relie': ['src/App.jsx', '  const vueLiaison = ', "  useEffect(() => { if (liaison) for (const v of aValider(liaison.parArticle)) { const x = articlesLiaison.get(v.key); if (x && x.item) relierAchatAnnonce(x.item, v.achat, { silencieux: true }); } }, [liaison]);\n  const vueLiaison = "],
  'app-valider-sans-feuille': ['src/App.jsx', 'onClick={() => setValider({ coches: new Set(tp.map((v) => v.key)) })}', 'onClick={() => { setValider({ coches: new Set(tp.map((v) => v.key)) }); setTimeout(validerCoches, 0); }}'],
  'app-refus-local': ['src/App.jsx', "  'vrm_liaison_refus',\n", ''],
  'app-vendus-oublies': ['src/App.jsx', '.concat((fileVendus || []).map((x) => x.cible));', ';'],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let SRC = path.join(R, 'src');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'liaison-achat-'));
  process.on('exit', () => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} });   // (le disque est partagé : rien ne reste)
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true, filter: (s) => !/node_modules/.test(s) });
  const [f, ...paires] = MUTS[MUT];
  const p = path.join(d, f); let s = fs.readFileSync(p, 'utf8');
  for (let i = 0; i < paires.length; i += 2) { if (!s.includes(paires[i])) { console.log('motif introuvable : ' + MUT); process.exit(2); } s = s.replace(paires[i], paires[i + 1]); }
  fs.writeFileSync(p, s); SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };

// Les règles de l'app, exécutées telles quelles.
const APP = fs.readFileSync(path.join(SRC, 'App.jsx'), 'utf8');
const bout = (debut, fin) => { const a = APP.indexOf(debut); const b = APP.indexOf(fin, a); if (a < 0 || b < 0) throw new Error('introuvable : ' + debut); return APP.slice(a, b + fin.length); };
const ctx = {};
vm.runInNewContext([bout('const KNOWN_BRANDS=[', '];'), bout('function extractBrand(text){', '\n}'), bout('const COULEURS = {', '\n};'),
  bout('function extractColors(text){', '\n}'), bout('const KNOWN_MODELS = [', '];'), bout('function extractModel(text){', '\n}'), bout('function contientModele(t,k){', '\n}'),
  'this.extractBrand=extractBrand; this.extractColors=extractColors; this.extractModel=extractModel;'].join('\n'), ctx);
const { extractBrand: marqueDe, extractColors: couleursDe, extractModel: modeleDe } = ctx;
const regles = { marqueDe, couleursDe, modeleDe };

// ── Le jeu inventé, à la forme de sa vérité terrain ─────────────────────────
// Chaque cas : l'article (titre, taille du champ, marque du champ) et LE bon achat (titre tel qu'un
// vendeur l'écrit : souvent sans taille, dans sa langue), puis des voisins qui ne sont PAS lui.
const J = 86400e3, T0 = Date.parse('2026-03-01T10:00:00Z');
const CAS = [
  ['Salomon XT-6 noir taille 42', '42', 'Salomon', 'Salomon S-LAB XT 6 Noire 42', ['Salomon XT6 noir taille 44', 'Salomon xt-6 blanc']],
  ['salomon XT-6 vert kaki taille 41,5', '41,5', 'Salomon', 'Salomon xt-6 vert kaki', ['Salomon XT-6 noir 41.5', 'Salomon speedcross vert 41,5']],
  ['salomon XT-6 noir taille 36', '36', 'Salomon', 'Salomon XT 6 Noir', ['Salomon XT-6 rose 38']],
  ['nike air max 1 lemonade 2020 vert taille 43', '43', 'Nike', 'Nike Air Max 1 Lemonade (yellow and green)', ['Nike air max 1 maat 43', 'Nike Air Max 90 vert 43']],
  ['Adidas Samba beige taille 35,5', '35,5', 'adidas', 'Adidas samba 35,5', ['Adidas samba noir 37', 'Adidas gazelle beige 35,5']],
  ['Adidas Handball Spezial bleu marine taille 37,5', '37,5', 'adidas', 'Adidas handball spezial navy size 37.5', ['Adidas Spezial noir 38', 'Adidas handball spezial rot 37,5']],
  ['asics novablast 4 noir taille 44,5', '44,5', 'ASICS', 'ASICS Novablast 4 schwarz (44.5)', ['ASICS NovaBlast 3 44,5', 'Asics novablast 4 blanc 42']],
  ['New balance 550 vert taille 40', '40', 'New Balance', 'New balance 550 verte et blanche taille 40', ['New balance 530 vert 40', 'New balance 550 gris 42']],
  ['Saucony triumph 21 taille 45', '45', 'Saucony', 'Saucony Triumph 21 taglia 45', ['Saucony triumph 20 45', 'Saucony ride 17 45']],
  ['Nike zoom fly 5 noir taille 35,5', '35,5', 'Nike', 'Paire de baskets Nike Zoom Fly 5 noires – Taille 35,5', ['Nike zoom fly 4 noir 35,5', 'Nike pegasus 40 noir 35,5']],
  ['Salomon speedcross 3 rose taille 38', '38', 'Salomon', 'Salomon Speedcross 3 Damen pink 38', ['Salomon Speedcross 5 rose 38']],
  ['Nike Initiator blanc taille 38,5', '38,5', 'Nike', 'Nike Initiator EUR 38,5', ['Nike Initiator noir 40']],
  ['Asics gel resolution 9 jaune fluo taille 43,5', '43,5', 'ASICS', 'Asics gel resolution 9 jaune fluo', ['Asics gel resolution 8 jaune 43,5', 'Asics gel kayano 14 jaune 43,5']],
  ['onitsuka tiger mexico 66 blanc taille 42,5', '42,5', 'Onitsuka Tiger', 'Onitsuka Tiger México 66 All White 42.5', ['Onitsuka Tiger Mexico 68 blanc 42,5']],
  ['Nike air force 1 blanc taille 42', '42', 'Nike', 'Nike Air force 1 weiß in 42', ['Nike air force 1 noir 42', 'Nike air force 1 blanc 43']],
  ['Nike vomero 5 gris taille 41', '41', 'Nike', 'Nike Zoom Vomero 5 grau US 8', ['Nike vomero 5 gris 44']],
  ['Nike shox r4 noir taille 37,5', '37,5', 'Nike', 'Nike Shox schwarz Gr. 37,5', ['Nike shox tl noir 40']],
  ['Autry reelwind low noir taille 39', '39', 'Autry', 'Autry Reelwind Low sneakers – zwart – maat 39', ['#Adidas Spezial, schwarz, Gr. 39']],
  ['Nike p-6000 noir taille 39', '39', 'Nike', 'Nike Schuhe Gr 39', ['Nike P-6000 blanc 41']],
  ['Nike Shox TL Hyper Royal bleu taille 42', '42', 'Nike', 'Nike shox', ['Nike Shox TL', 'Blue Nike Tl']],
];
// Les 4 derniers cas sont durs (titre d'achat sans modèle, ou plusieurs achats aussi proches) :
// ils restent « possible » ou ambigus — jamais une « très probable » fausse.
function jeu() {
  const achats = [], cibles = [], verite = {};
  let tx = 1000;
  CAS.forEach(([titre, taille, marque, bon, voisins], i) => {
    const commande = T0 + i * 9 * J;
    const enLigne = commande + (5 + (i * 7) % 16) * J;
    const key = 'a:' + (500 + i);
    cibles.push({ key, titre, taille, marque, dateRef: new Date(enLigne).toISOString(), prix: { amount: '60.0' } });
    const t = String(++tx);
    achats.push({ transaction_id: Number(t), title: bon, date: new Date(commande).toISOString(), price: { amount: '35.5', currency_code: 'EUR' }, status: 'Transaction finalisée' });
    verite[key] = t;
    voisins.forEach((v, j) => achats.push({ transaction_id: ++tx, title: v, date: new Date(commande - (40 + 20 * j) * J).toISOString(), price: { amount: '30.0', currency_code: 'EUR' }, status: 'Transaction finalisée' }));
    // Le même modèle, acheté APRÈS la mise en ligne, et remboursé : jamais proposés.
    achats.push({ transaction_id: ++tx, title: bon, date: new Date(enLigne + 2 * J).toISOString(), price: { amount: '33.0' }, status: 'Transaction finalisée' });
    achats.push({ transaction_id: ++tx, title: bon, date: new Date(commande - 3 * J).toISOString(), price: { amount: '33.0' }, status: 'Remboursement validé' });
  });
  return { achats, cibles, verite };
}

(async () => {
  let L = null, S0 = null;
  try { L = await import(require('url').pathToFileURL(path.join(SRC, 'liaisonAchat.js')).href); } catch (e) { dit(false, 'src/liaisonAchat.js se charge', e.message); }
  try { S0 = await import(require('url').pathToFileURL(path.join(SRC, 'suggestionsAchat.js')).href); } catch (_) {}
  if (!L) {
    // L'arbre d'avant : la règle de proposition était `suggestionsAchat` — sa précision sur le même jeu.
    if (S0) {
      const { achats, cibles, verite } = jeu(); let t1 = 0, t3 = 0;
      for (const c of cibles) { const i = S0.suggestionsAchat({ cible: { titre: c.titre, marque: c.marque, taille: c.taille, dateRef: c.dateRef }, achats, liens: new Map(), ...regles, max: 3 }).map((s) => String(s.achat.transaction_id)).indexOf(verite[c.key]); if (i === 0) t1++; if (i >= 0) t3++; }
      dit(t1 >= Math.ceil(0.75 * cibles.length), `P1 top-1 ≥ 75 % (règle d'avant : ${t1}/${cibles.length})`);
      dit(t3 >= Math.ceil(0.85 * cibles.length), `P2 top-3 ≥ 85 % (règle d'avant : ${t3}/${cibles.length})`);
    }
    console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`); process.exit(1);
  }

  console.log('\n── P. La précision, sur un jeu inventé à la forme de sa vérité terrain');
  const { achats, cibles, verite } = jeu();
  const mesurer = (rangDe) => { let t1 = 0, t3 = 0; for (const c of cibles) { const r = rangDe(c); if (r === 0) t1++; if (r >= 0 && r < 3) t3++; } return { t1, t3, n: cibles.length }; };
  const pc = (x, n) => Math.round((100 * x) / n);
  const avant = S0 ? mesurer((c) => S0.suggestionsAchat({ cible: { titre: c.titre, marque: c.marque, taille: c.taille, dateRef: c.dateRef }, achats, liens: new Map(), ...regles, max: 3 }).map((s) => String(s.achat.transaction_id)).indexOf(verite[c.key])) : { t1: 0, t3: 0, n: cibles.length };
  const res = L.affecterPropositions({ cibles, achats, liens: new Map(), ...regles });
  // (16 nov., relier-fiable) L'ordre que voit Julien : la « très probable » en ligne (au plus une), puis les PISTES
  // (repliées dans la feuille « Choisir un autre achat »).
  const rangs = (r, k) => [...(r.parArticle[k] || []), ...((r.pistes || {})[k] || [])];
  const apres = mesurer((c) => rangs(res, c.key).map((p) => String(p.achat.transaction_id)).indexOf(verite[c.key]));
  console.log(`   ancienne règle : top-1 ${apres.n ? pc(avant.t1, avant.n) : 0} % (${avant.t1}/${avant.n}) · top-3 ${pc(avant.t3, avant.n)} %`);
  console.log(`   nouvelle règle : top-1 ${pc(apres.t1, apres.n)} % (${apres.t1}/${apres.n}) · top-3 ${pc(apres.t3, apres.n)} % · très probables ${res.tresProbables.length}`);
  dit(apres.t1 >= Math.ceil(0.75 * apres.n), 'P1 top-1 ≥ 75 % (le bon achat proposé en premier)', `${apres.t1}/${apres.n}`);
  dit(apres.t3 >= Math.ceil(0.85 * apres.n), 'P2 top-3 ≥ 85 %', `${apres.t3}/${apres.n}`);
  dit(apres.t1 - avant.t1 >= Math.ceil(0.25 * apres.n), 'P3 la nouvelle règle fait nettement mieux que l’ancienne (+25 points au moins en top-1)', `avant ${avant.t1}, après ${apres.t1}`);
  const fausses = res.tresProbables.filter((x) => verite[x.key] !== x.tx);
  dit(res.tresProbables.length >= 6 && !fausses.length, 'P4 des « très probables » (6 au moins), aucune fausse', JSON.stringify({ n: res.tresProbables.length, fausses }));
  const durs = cibles.slice(-2).map((c) => (res.parArticle[c.key] || [])[0]);
  dit(durs.every((p) => !p || p.niveau !== 'tres-probable'), 'P5 les cas durs (titre d’achat sans modèle, plusieurs achats aussi proches) restent « possible »');

  console.log('\n── I. « Même avec 50 articles identiques, tu ne dois pas pouvoir te tromper »');
  const memes = Array.from({ length: 50 }, (_, i) => ({ key: 'a:' + i, titre: 'Nike Air Max 90 noir taille 42', taille: '42', dateRef: new Date(T0 + 30 * J).toISOString() }));
  const achatsMemes = Array.from({ length: 50 }, (_, i) => ({ transaction_id: 9000 + i, title: 'Nike Air Max 90 noir 42', date: new Date(T0 + (i % 10) * J).toISOString(), price: { amount: '40' }, status: 'Transaction finalisée' }));
  const r50 = L.affecterPropositions({ cibles: memes, achats: achatsMemes, ...regles });
  // (16 nov., relier-fiable) Plus rien EN LIGNE : seulement des pistes, repliées, dites ambiguës.
  dit(r50.tresProbables.length === 0 && memes.every((c) => !(r50.parArticle[c.key] || []).length && (r50.pistes[c.key] || []).length > 0 && r50.pistes[c.key][0].niveau === 'piste'), 'I1 50 paires identiques × 50 achats identiques : AUCUNE proposition en ligne, aucune « très probable » (des pistes repliées)', String(r50.tresProbables.length));
  dit(memes.every((c) => r50.pistes[c.key][0].ambigu === true), 'I1b chaque piste est dite AMBIGUË (« à toi de choisir »)');
  const tout = (o) => [...L.propositionsArticle(o), ...L.pistesArticle(o)];
  const autry = tout({ cible: { titre: 'Autry reelwind low rose taille 36', marque: 'adidas', taille: '36', dateRef: new Date(T0 + 30 * J).toISOString() }, achats: [{ transaction_id: 1, title: '#Adidas Spezial, dunkelblau, Gr. 36', date: new Date(T0).toISOString(), price: { amount: '20' } }], ...regles });
  const puma = tout({ cible: { titre: 'Puma suede noir taille 42', taille: '42', dateRef: new Date(T0 + 30 * J).toISOString() }, achats: [{ transaction_id: 2, title: 'Nike suede noir 42', date: new Date(T0).toISOString(), price: { amount: '20' } }, { transaction_id: 3, title: 'Adidas Suede schwarz 42', date: new Date(T0).toISOString(), price: { amount: '20' } }], ...regles });
  dit(!autry.length && !puma.length, 'I2 une marque différente n’est jamais proposée (« Autry » marquée « adidas », « Puma » / « Nike »)', JSON.stringify([autry.length, puma.length]));
  const deux = L.affecterPropositions({ cibles: [{ key: 'a:1', titre: 'Asics gel kayano 14 argent taille 42', taille: '42', dateRef: new Date(T0 + 10 * J).toISOString() }, { key: 'a:2', titre: 'Asics gel kayano 14 argent taille 42', taille: '42', dateRef: new Date(T0 + 12 * J).toISOString() }],
    achats: [{ transaction_id: 77, title: 'Asics Gel-Kayano 14 silver 42', date: new Date(T0).toISOString(), price: { amount: '50' } }], ...regles });
  dit(!deux.tresProbables.length && !deux.parAchat['77'] && (deux.pistes['a:1'] || []).length === 1 && (deux.pistes['a:2'] || []).length === 1, 'I3 un achat proche de DEUX articles n’est proposé à aucun (deux pistes : il choisit)', JSON.stringify(deux.tresProbables));
  dit(new Set(res.tresProbables.map((x) => x.tx)).size === res.tresProbables.length, 'I3b un achat n’est jamais « très probable » pour deux articles (jeu P)');
  const v = tout({ cible: { titre: 'asics novablast 4 taille 44,5', taille: '44,5', dateRef: new Date(T0 + 10 * J).toISOString() }, achats: [{ transaction_id: 5, title: 'ASICS NovaBlast 3 44,5', date: new Date(T0).toISOString(), price: { amount: '40' } }], ...regles });
  dit(!v.length, 'I4 deux versions différentes du modèle (« novablast 4 » / « NovaBlast 3 ») : écarté');
  const post = tout({ cible: { titre: 'Adidas samba noir taille 40', taille: '40', dateRef: new Date(T0).toISOString() }, achats: [{ transaction_id: 6, title: 'Adidas samba noir 40', date: new Date(T0 + J).toISOString(), price: { amount: '40' } }], ...regles });
  dit(!post.length, 'I5 un achat commandé APRÈS la mise en ligne n’est jamais proposé');
  const c1 = cibles[4]; const avantRefus = rangs(res, c1.key)[0];
  const r2 = L.affecterPropositions({ cibles, achats, refus: { [L.cleRefusLiaison(c1.key, verite[c1.key])]: '2026-11-15' }, ...regles });
  dit(avantRefus && String(avantRefus.achat.transaction_id) === verite[c1.key] && !rangs(r2, c1.key).some((p) => String(p.achat.transaction_id) === verite[c1.key]), 'I6 « Ce n’est pas lui » : ce couple n’est plus proposé');
  const lot = L.affecterPropositions({ cibles: [{ key: 'a:9', titre: 'Saucony jazz 81 rouge taille 41', taille: '41', dateRef: new Date(T0 + 8 * J).toISOString() }], achats: [{ transaction_id: 8, title: 'Lot de 2 paires Saucony jazz 81 rouge 41', date: new Date(T0).toISOString(), price: { amount: '60' } }], ...regles });
  dit(!(lot.parArticle['a:9'] || []).length && (lot.pistes['a:9'] || []).length === 1 && lot.pistes['a:9'][0].niveau === 'piste' && !L.aValider(lot.parArticle).length, 'I7 un LOT peut être proposé, jamais « très probable » ni dans « Valider » (le prix de l’article est à saisir)');
  const p0 = rangs(res, cibles[0].key)[0];
  const m = p0 ? L.morceauxPourquoi(p0).map((x) => x.cle) : [];
  dit(m[0] === 'marque' && m.includes('mots') && m.includes('taille') && m.includes('couleur') && m.some((k) => /^jours\.en-ligne\.commande$/.test(k)), 'I8 POURQUOI : marque · mots · taille · couleur · jours depuis la commande', JSON.stringify(m));
  const recu = tout({ cible: { titre: 'Nike air max plus bleu taille 47', taille: '47', dateRef: new Date(T0 + 20 * J).toISOString() }, achats: [{ transaction_id: 11, title: 'Nike air max plus blue 47', date: new Date(T0).toISOString(), price: { amount: '70' } }], receptionDe: () => ({ ms: T0 + 18 * J, source: 'clic' }), ...regles });
  dit(recu.length && recu[0].jours === 2 && L.morceauxPourquoi(recu[0]).some((x) => x.cle === 'jours.en-ligne.retrait' && x.vars.n === '2'), 'I9 la date de RETRAIT lue fait la chronologie (« mise en ligne 2 j après le retrait »)', JSON.stringify(recu[0] && recu[0].pourquoi));
  dit(L.tailleAchat('Nike Zoom Vomero 5 grau US 8', 'nike').taille === '41' && L.tailleAchat('Adidas samba us 9', 'adidas').taille === '42 2/3' && L.tailleAchat('Puma suede US 9', 'puma').taille === '', 'I10 une taille US se convertit par la table de SA marque (sinon : pas su)');
  dit(L.couleursTexte('Salomon xt-6 vert kaki', couleursDe).includes('vert') && L.couleursTexte('Nike dunkelblau', couleursDe).includes('bleu') && L.couleursTexte('Nike Shox schwarz', couleursDe).includes('noir'), 'I11 couleurs du titre en plusieurs langues (kaki, dunkelblau, schwarz)');

  const ref = new Date(T0 + 30 * J).toISOString();
  const un = (titre, taille, titresAchats, joursAvant = 10) => tout({ cible: { titre, taille, dateRef: ref }, achats: titresAchats.map((t, i) => ({ transaction_id: 700 + i, title: t, date: new Date(T0 + (30 - (Array.isArray(joursAvant) ? joursAvant[i] : joursAvant)) * J).toISOString(), price: { amount: '30' } })), ...regles });
  const deuxAchats = un('Nike Dunk Low panda noir taille 42', '42', ['Nike dunk low panda 42', 'Nike Dunk Low panda noir 42']);
  dit(deuxAchats.length === 2 && deuxAchats[0].niveau === 'piste' && deuxAchats[0].ambigu, 'I12 un article, deux achats aussi proches ⇒ ni l’un ni l’autre « très probable » (à lui de choisir)', JSON.stringify(deuxAchats.map((p) => [p.score, p.niveau])));
  dit(!un('Adidas samba noir taille 40', '40', ['Adidas samba noir 43']).length, 'I13 tailles écrites des deux côtés et différentes ⇒ écarté');
  dit(!un('Nike dunk low vert taille 42', '42', ['Nike dunk low rouge 42']).length, 'I14 couleurs écrites des deux côtés et sans couleur commune ⇒ écarté');
  dit(!un('Nike zoom fly 5 noir et rose taille 40', '40', ['Nike speakers maat 40']).length, 'I15 aucun mot du modèle en commun ⇒ écarté (« Nike speakers maat 40 »)');
  const proche = un('Salomon speedcross 5 noir taille 43', '43', ['Salomon speedcross 5 noir 43'], 5)[0], loin = un('Salomon speedcross 5 noir taille 43', '43', ['Salomon speedcross 5 noir 43'], 170)[0];
  dit(proche && loin && proche.score - loin.score >= 1.5, 'I16 la chronologie pèse : mise en ligne 5 j après la commande > 170 j après', JSON.stringify([proche && proche.score, loin && loin.score]));
  // Un titre d'achat COURT (« Nike shox ») retrouve tous ses mots dans l'annonce : il reste devant un achat
  // qui partage moins de ses mots (la part se lit dans les deux sens).
  const court = un('Nike Shox TL Hyper Royal bleu taille 42', '42', ['Nike shox tl turbo custom spécial édition', 'Nike shox tl'], [8, 8]);
  dit(court.length === 2 && court[0].achat.transaction_id === 701, 'I17 un titre d’achat court qui retrouve TOUS ses mots passe devant (la part des mots, dans les deux sens)', JSON.stringify(court.map((p) => [p.achat.title, p.score])));

  console.log('\n── R. Relier sans son clic : impossible');
  const src = fs.readFileSync(path.join(SRC, 'liaisonAchat.js'), 'utf8').replace(/\/\/.*$/gm, '');
  dit(!/fetch\(|localStorage|save\(|setNumeros|setSaleOverride|updatePair|buyFromId\s*=/.test(src), 'R1 le module n’écrit nulle part (ni base, ni navigateur, ni fiche)');
  const gel = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const k of Object.keys(o)) gel(o[k]); } return o; };
  let geleOk = true; try { L.affecterPropositions({ cibles: gel(JSON.parse(JSON.stringify(cibles))), achats: gel(JSON.parse(JSON.stringify(achats))), liens: new Map(), ...regles }); } catch (e) { geleOk = false; }
  dit(geleOk, 'R2 les entrées gelées : la règle ne modifie ni un article ni un achat');
  const { sourceApp } = require('./_source-app.cjs');
  const APPS = (MUT ? APP : sourceApp()).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
  const effets = APPS.match(/useEffect\(\(\) => \{[^\n]*/g) || [];
  dit(!effets.some((l) => /relierAchatAnnonce|relierAchatVente|validerCoches|refuserLiaison/.test(l)), 'R3 aucun effet ne relie, ne valide ni ne refuse (seul SON toucher)');
  dit(/onClick=\{\(\) => setValider\(\{ coches: new Set\(tp\.map\(\(v\) => v\.key\)\) \}\)\}/.test(APPS) && /data-ar-valider-ok=\{valider\.coches\.size\}[^\n]*onClick=\{validerCoches\}/.test(APPS), 'R4 « Valider les N très probables » OUVRE la liste ; seul « Relier ces N » (dans la feuille) relie');
  dit(/<input type="checkbox" checked=\{coche\}/.test(APPS), 'R5 la feuille montre chaque couple, cochable un par un');

  console.log('\n── S. Le branchement dans l’app');
  dit(/^\s*'vrm_liaison_refus',\s*$/m.test(APPS) && /setLiaisonRefus\(\(v\) => \(v && Object\.keys\(v\)\.length\) \? v : lu\('vrm_liaison_refus'\)\)/.test(APPS) && /k: 'vrm_liaison_refus', type: 'cle'/.test(APPS), 'S1 « Ce n’est pas lui » : synchronisé (SYNC_KEYS), relu quand le nuage arrive, posé par SON geste');
  dit(/const fileVendus = useMemo\(/.test(APPS) && /classifyOrderStatus\(o\.status\) === 'cancelled'/.test(APPS) && /365 \* 86400e3/.test(APPS) && /\.concat\(\(fileVendus \|\| \[\]\)\.map\(\(x\) => x\.cible\)\)/.test(APPS), 'S2 les VENDUS des 12 derniers mois, sans achat ni prix, entrent dans l’affectation');
  dit(/affecterPropositions\(\{ cibles, achats: achatsLiaison, liens: liensAchats, refus: liaisonRefus/.test(APPS) && /receptionDe: \(a\) => dateReception\(a,/.test(APPS), 'S3 l’affectation lit les liens posés, ses refus et la date de retrait LUE');
  dit(/<PropositionAchat p=\{lp\} art=\{art\}/.test(APPS) && /\(numA == null \|\| numA === ''\) && liaison/.test(APPS), 'S4 Achats : sous un achat sans article relié, l’article proposé');
  dit(/vendus=\{fileVendus\} liaison=\{liaison\} onRelierVente=\{relierAchatVente\}/.test(APPS) && /const w = await ecritureRelierAchat\(a\); if \(!w\) return;\s*const o = l\.o;/.test(APPS), 'S5 « Relier » une vente : l’écriture de « Relier un achat » (prix du reçu, lot demandé)');
  dit(/import \{ propositionsArticle \} from '\.\/liaisonAchat\.js';/.test(fs.readFileSync(path.join(SRC, 'achatsARelier.js'), 'utf8')), 'S6 la meilleure suggestion d’une annonce passe par la MÊME règle (une notion, une règle)');
  const achatsJsx = fs.readFileSync(path.join(SRC, 'ecrans', 'Achats.jsx'), 'utf8');
  dit(/const sugg = useMemo\(\(\) => \(Array\.isArray\(achats\) \? propositionsArticle\(\{ cible, achats, liens,/.test(achatsJsx), 'S7 la feuille « Relier un achat » propose par la MÊME règle');

  console.log('\n── V. 1 000 articles × 1 000 achats');
  const gros = []; const ga = [];
  const modeles = ['air max 90', 'air force 1', 'dunk low', 'samba', 'spezial', 'xt-6', 'speedcross 5', 'novablast 4', 'gel kayano 14', '550', '2002r', 'vomero 5'];
  const marques = ['Nike', 'Nike', 'Nike', 'Adidas', 'Adidas', 'Salomon', 'Salomon', 'Asics', 'Asics', 'New Balance', 'New Balance', 'Nike'];
  const coul = ['noir', 'blanc', 'gris', 'vert', 'bleu', 'rose'];
  for (let i = 0; i < 1000; i++) { const k = i % 12; gros.push({ key: 'a:' + i, titre: `${marques[k]} ${modeles[k]} ${coul[i % 6]} taille ${36 + (i % 10)}`, taille: String(36 + (i % 10)), dateRef: new Date(T0 + (i % 200) * J).toISOString() });
    ga.push({ transaction_id: 50000 + i, title: `${marques[k]} ${modeles[k]} ${coul[(i + 1) % 6]} ${i % 3 ? '' : 36 + (i % 10)}`, date: new Date(T0 + ((i % 200) - 10) * J).toISOString(), price: { amount: '30' } }); }
  const t0 = Date.now(); L.affecterPropositions({ cibles: gros, achats: ga, ...regles }); const ms = Date.now() - t0;
  dit(ms < 4000, `V1 1 000 articles × 1 000 achats en ${ms} ms (< 4 s ici ; calcul après le rendu dans l’app)`);

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
