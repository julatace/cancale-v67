// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « À RETIRER » : la fin d'un colis prouvée par ses autres identités,
//  le doute « même point » élargi, un point = une carte (5 nov.).
//  Julien, 5 nov. au soir : « ça me met que j'ai 33 colis à retirer j'en ai à peine
//  10 et ça me met 2 points de retrait alors que c'est le même ».
//  Cas INVENTÉS qui reproduisent les siens (dépôt public : aucun nom, aucune adresse
//  réelle). EXÉCUTE les vraies règles :
//   A. src/retraitPreuves.js — fin par le n° de suivi de la commande reliée ; fin par
//      le code de retrait d'une autre ligne ; une ligne par code ;
//   B. api/_lib/achat-arrive-relais.js `regrouperArrivees` — le doute compte les
//      témoins FINIS, la même adresse de réception, le même LIEU écrit autrement ;
//      une moitié Vinted reliée à une commande sans n° de suivi est un doute ;
//   C. src/relaisColis.js `regrouperRelais` — un point écrit de trois façons = un point,
//      deux adresses vraiment différentes = deux points ;
//   D. src/App.jsx (commentaires retirés) — `pickupUnion` les appelle ; l'écran Achats
//      ne relie plus un colis par son TITRE ; l'équipe ne prend plus `needs_action`
//      pour « à retirer » ; CarteRelais range un point dans UNE section.
//  `--prouve` : chaque règle affaiblie (copie mutée) doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const lire = (r) => fs.readFileSync(path.join(RACINE, r), 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\{\s*\}/g, '{}');

async function charger(sources) {
  // Copies dans un dossier temporaire (pour les mutations) ; aucun import croisé.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-retrait-preuves-'));
  const mods = {};
  for (const [nom, src] of Object.entries(sources)) {
    const f = path.join(dir, nom + '.mjs'); fs.writeFileSync(f, src);
    mods[nom] = await import(pathToFileURL(f).href + '?v=' + Math.random());
  }
  return mods;
}

async function controles(src, dit) {
  let M;
  try { M = await charger({ preuves: src.preuves, arrivee: src.arrivee, relais: src.relais }); }
  catch (e) { dit(false, 'les modules se chargent', String(e.message || e).slice(0, 160)); return; }
  const P = M.preuves, A = M.arrivee, R = M.relais;
  const norm = (s) => String(s || '').toUpperCase().replace(/\s+/g, '');
  const codeDe = (t) => norm(t && t.code), suiviDe = (t) => norm(t && t.suivi);
  // fins : le n° → { retire } (la forme de finsColis, réduite à ce qui est jugé ici)
  const fins = new Map([['11111111', { retire: true, retours: [], incidents: [] }], ['VGS000000000001', { retire: true, retours: [], incidents: [] }]]);
  const sortiParSuivis = (ks, f) => { for (const k of ks) { const x = f.get(norm(k)); if (x && x.retire) return 'retire'; } return null; };
  const suivisDeAchat = (o) => (o && o.suivis) || [];
  const base = { codeDe, suiviDe, suivisDeAchat, fins, sortiParSuivis };

  // ── A. La fin par une AUTRE identité ──────────────────────────────────────
  if (typeof P.finParIdentite !== 'function') { dit(false, 'A0 src/retraitPreuves.js exporte finParIdentite'); return; }
  const cmdRetiree = { transaction_id: 900001, suivis: ['11111111'] };
  const vinted = { source: 'vinted-commande', conv: 'c-1', lieu: 'POINT A, 1 RUE UN, 35000 VILLEA', suivi: '' };
  dit(P.finParIdentite(vinted, { ...base, commande: cmdRetiree, codes: new Map() }) === 'retire',
    'A1 « t\'attend » relié à SA commande, dont le n° de suivi est « livré au destinataire » ⇒ fini');
  const codes = P.indexCodesSuivis([{ code: 'B12345', suivi: 'VGS000000000001' }, { code: '777777', suivi: '22222222' }], { codeDe, suiviDe });
  dit(P.finParIdentite({ code: 'B12345', suivi: '' }, { ...base, commande: null, codes }) === 'retire',
    'A2 « Utilise le code B12345 » et la consigne au MÊME code retirée ⇒ fini (un code = un colis)');
  dit(P.finParIdentite({ code: 'Z99999', suivi: '' }, { ...base, commande: { transaction_id: 1, suivis: [] }, codes }) === null,
    'A3 sans identité commune : rien n\'est décidé (jamais par le titre, le lieu ou la date)');
  dit(P.finParIdentite({ code: '777777', suivi: '22222222' }, { ...base, commande: null, codes }) === null,
    'A4 son propre n° n\'est pas rejugé ici (22222222 pas fini)');
  const idx2 = P.indexCodesSuivis([], { codeDe, suiviDe, achats: [{ code: 'C55555', suivis: ['11111111'] }], codeAchat: (o) => o.code, suivisDeAchat });
  dit(P.finParIdentite({ code: 'C55555' }, { ...base, codes: idx2 }) === 'retire', 'A5 le code lu dans la conversation d\'une commande la relie à SES n° de suivi');
  const L = [{ id: 'a', code: 'B12345', suivi: '', lieu: 'x' }, { id: 'b', code: 'B12345', suivi: 'VGS000000000001' }, { id: 'c', code: 'D1', suivi: '1' }, { id: 'd', code: 'D1', suivi: '2' }];
  const F = P.fusionnerParCode(L, { codeDe, suiviDe, fusion: (m, s) => ({ ...s, ...m, fusion: [m.id, s.id] }) });
  dit(F.length === 3 && F.some((t) => t.id === 'b' && t.fusion) && !F.some((t) => t.id === 'a'), 'A6 une ligne par code de retrait (celle qui a le n° garde la place)', JSON.stringify(F.map((t) => t.id)));
  dit(F.some((t) => t.id === 'c') && F.some((t) => t.id === 'd'), 'A7 même code, deux n° différents : rien n\'est fusionné');

  // ── B. Le doute « même point » ───────────────────────────────────────────
  const at = (j) => new Date(Date.UTC(2026, 10, 5, 9) + j * 864e5).toISOString();
  const mr = (n, j, extra = {}) => ({ source: '', suivi: String(n), status: 'available', lieu: 'MAISON DU JOURNAL, 4 RUE DU QUAI, 35000 VILLEA', arriveLe: at(j), account: '', recuSur: ['adresse-x@exemple.fr'], ...extra });
  const vt = (n, j, extra = {}) => ({ source: 'vinted-commande', conv: 'v' + n, suivi: '', status: 'available', lieu: 'MAISON DU JOURNAL, 4 RUE DU QUAI, 35000 VILLEA', arriveLe: at(j), account: '', recuSur: ['adresse-x@exemple.fr'], ...extra });
  // Sa forme : 4 « t'attend » sans commande ; 4 Mondial Relay, dont 3 DÉJÀ RETIRÉS (hors liste).
  const enAttente = [mr(1, 0)];
  const temoins = [mr(1, 0), mr(2, -1), mr(3, -1), mr(4, -1)];
  const liste = [...enAttente, vt(1, 0), vt(2, -1), vt(3, -1), vt(4, 0)];
  const r1 = A.regrouperArrivees(liste, { commandeDe: () => null, temoins });
  dit(r1.liste.length === 1 && r1.doutes.length === 4, 'B1 les 4 moitiés Vinted sont des doutes (témoins FINIS compris) : 1 compté, pas 5', `${r1.liste.length}/${r1.doutes.length}`);
  const r1b = A.regrouperArrivees([vt(1, 0), vt(2, 0)], { commandeDe: () => null, temoins: [mr(2, -1)] });
  dit(r1b.liste.length === 0, 'B2 même si le seul témoin est déjà retiré (sinon elles reviennent « à retirer » le lendemain)');
  const cmdSans = { transaction_id: 77, suivis: [] }, cmdAvec = { transaction_id: 78, suivis: ['99'] };
  const r2 = A.regrouperArrivees([vt(5, 0)], { commandeDe: () => cmdSans, temoins: [mr(5, 0)], sansIdentite: (t, c) => !c.suivis.length });
  dit(r2.doutes.length === 1 && r2.doutesCommandes[0] === cmdSans, 'B3 reliée à une commande SANS n° de suivi : doute (sa commande gardée)');
  const r3 = A.regrouperArrivees([vt(6, 0)], { commandeDe: () => cmdAvec, temoins: [mr(6, 0)], sansIdentite: (t, c) => !c.suivis.length });
  dit(r3.liste.length === 1, 'B4 reliée à une commande qui A un n° de suivi : comptée (son n° la juge)');
  const r4 = A.regrouperArrivees([vt(7, 0, { recuSur: ['autre@exemple.fr'] })], { commandeDe: () => null, temoins: [mr(7, 0)] });
  dit(r4.liste.length === 1, 'B5 une autre adresse de réception : pas le même destinataire, pas de doute');
  const r5 = A.regrouperArrivees([vt(8, 0, { lieu: 'MAISON DU JOURNAL, 9 RUE HAUTE, 29000 VILLEB' })], { commandeDe: () => null, temoins: [mr(8, 0)] });
  dit(r5.liste.length === 1, 'B6 un autre lieu (autre code postal) : pas de doute');
  const r6 = A.regrouperArrivees([vt(9, 0)], { commandeDe: () => null, temoins: [mr(9, -8)] });
  dit(r6.liste.length === 1, 'B7 un témoin arrivé 8 jours plus tôt : hors fenêtre, pas de doute');
  const r7 = A.regrouperArrivees([vt(10, 0)], { commandeDe: (t) => (t.source ? { transaction_id: 1 } : { transaction_id: 2 }), temoins: [mr(10, 0)], sansIdentite: () => true });
  dit(r7.liste.length === 1, 'B8 un témoin relié à une AUTRE commande n\'est jamais son témoin');
  const k1 = A.cleLieuDoute('Consigne Vinted Go, Thé du Coin, 13 Rue Basse'), k2 = A.cleLieuDoute('Thé du Coin, 13 Rue Basse, 56000 Villec');
  dit(k1 && k2 && k1.nom === k2.nom, 'B9 « Consigne Vinted Go, Nom, rue » = « Nom, rue, CP Ville » (même lieu)', JSON.stringify([k1, k2]));
  const k3 = A.cleLieuDoute("TAB'OCAP"), k4 = A.cleLieuDoute('TABOCAP, TABOCAP, 2 RUE BASSE, 56000 VILLEC');
  dit(k3 && k4 && k3.nom === k4.nom, 'B10 apostrophe et nom répété : le même nom');

  // ── C. Un point écrit trois fois = un point ──────────────────────────────
  const pts = R.regrouperRelais({ arrives: [
    { id: '1', nom: 'MAISON DU JOURNAL', adresse: '4 RUE DU QUAI, 35000 VILLEA', transporteur: 'mondialrelay' },
    { id: '2', nom: 'Maison du Journal', adresse: '4 Rue du Quai, 35000 Villea', transporteur: '' },
    { id: '3', nom: 'MAISON-DU-JOURNAL', adresse: '4, rue du Quai 35000 VILLEA', transporteur: 'vinted' },
    { id: '4', nom: 'MAISON DU JOURNAL', adresse: '9 RUE HAUTE, 29000 VILLEB', transporteur: 'mondialrelay' },
  ] });
  const mj = pts.filter((p) => /journal/i.test(p.nom));
  dit(mj.length === 2 && mj.some((p) => p.cp === '35000' && p.nArrives === 3), 'C1 majuscules, tirets, virgules : UN point ; même nom ailleurs : un AUTRE point', JSON.stringify(pts.map((p) => [p.cle, p.nArrives])));
}

function cablage(dit) {
  const app = sansCommentaires(lire('src/App.jsx'));
  const pu = app.slice(app.indexOf('const pickupUnion = useMemo('), app.indexOf('const groupesRelais = useMemo(') > 0 ? app.indexOf('const groupesRelais = useMemo(') : app.indexOf('const pickupUnion = useMemo(') + 40000);
  dit(/finParIdentite\(t, preuvesIdentite\(t, cmd\)\)/.test(pu) && /fi === 'retire'/.test(pu), 'D1 pickupUnion juge la fin par les autres identités (commande, code)');
  dit(/fusionnerParCode\(emailList/.test(pu), 'D2 pickupUnion : une ligne par code de retrait');
  dit(/regrouperArrivees\(emailList, \{[^}]*temoins, sansIdentite \}\)/.test(pu), 'D3 pickupUnion donne les témoins (finis compris) et la règle « sans identité »');
  dit(/enDouble/.test(pu) && /doute_meme_relais/.test(pu), 'D4 les doubles possibles sont à part : ni « à retirer », ni « à vérifier »');
  const tfb = app.slice(app.indexOf('const colisParTx = useMemo('), app.indexOf('const achatStage ='));
  dit(tfb.length > 0 && !/normTitle/.test(tfb) && /achatParConversation|parConv/.test(tfb), 'D5 l\'écran Achats relie un colis à SA commande par identité, jamais par le titre');
  const eq = app.slice(app.indexOf('function ColisEquipe('), app.indexOf('function ColisEquipe(') + 6000);
  dit(!/needs_action/.test(eq.slice(eq.indexOf('const achats = d.achats'), eq.indexOf('const achats = d.achats') + 300)), 'D6 équipe : `needs_action` n\'est pas « à retirer » (« Commande livrée ! » le porte)');
  const ea = app.slice(app.indexOf('function etapeAchat('), app.indexOf('function etapeAchat(') + 2500);
  dit(/fini = false/.test(ea) && ea.indexOf('commande\\s+livr') > 0 && ea.indexOf('commande\\s+livr') < ea.indexOf("label: 'À retirer'"), 'D7 étape d\'un achat : « Commande livrée » et « fini » passent AVANT « À retirer »');
  const cr = sansCommentaires(lire('src/CarteRelais.jsx'));
  dit(/RANG_SECTION/.test(cr) && /principale/.test(cr), 'D8 Colis → À retirer : un point, une carte (la section de son colis le plus pressé)');
}

(async () => {
  const PROUVE = process.argv.includes('--prouve');
  const sources = { preuves: fs.existsSync(path.join(RACINE, 'src/retraitPreuves.js')) ? lire('src/retraitPreuves.js') : 'export {};', arrivee: lire('api/_lib/achat-arrive-relais.js'), relais: lire('src/relaisColis.js') };
  let ko = 0, ok = 0;
  const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d && !c ? ' — ' + d : '')); };
  await controles(sources, dit);
  cablage(dit);
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  if (PROUVE) {
    const MUT = [
      ['fin par la commande ignorée', 'preuves', (s) => s.replace('if (commande) for (const s of suivisDeAchat(commande) || []) if (s) out.add(s);', '')],
      ['fin par le code ignorée', 'preuves', (s) => s.replace('if (c && codes.has(c)) for (const s of codes.get(c)) out.add(s);', '')],
      ['pas de fusion par code', 'preuves', (s) => s.replace('if (!retire.size) return liste;', 'return liste;')],
      ['témoins finis ignorés (règle d\'avant)', 'arrivee', (s) => s.replace('const doute = Array.isArray(temoins)', 'const doute = false')],
      ['adresse de réception ignorée', 'arrivee', (s) => s.replace('if (a.a && b.a) return a.a === b.a;\n  if (a.r && b.r) return a.r === b.r;', '')],
      ['fenêtre de jours ignorée', 'arrivee', (s) => s.replace('Math.abs(aw - at) <= fenetreJ * 86400000', 'true')],
      ['commande sans n° jamais un doute', 'arrivee', (s) => s.replace("(!cmds[i] || (sansIdentite && sansIdentite(t, cmds[i])))", '!cmds[i]')],
      ['lieu : préfixe « Consigne Vinted Go » gardé', 'arrivee', (s) => s.replace("const sansPrefixe = s.replace(NOM_LIEU_PREFIXE, '');", 'const sansPrefixe = s;')],
    ];
    let rouges = 0;
    for (const [nom, cle, f] of MUT) {
      const m = { ...sources, [cle]: f(sources[cle]) };
      if (m[cle] === sources[cle]) { console.log('⚠️  mutation sans effet : ' + nom); continue; }
      let k = 0; await controles(m, (c) => { if (!c) k++; });
      console.log((k ? '✅ rouge sous mutation : ' : '❌ RESTE VERT sous mutation : ') + nom + (k ? ` (${k})` : ''));
      if (k) rouges++;
    }
    console.log(`\n--prouve : ${rouges}/${MUT.length} mutations rougissent l'audit`);
    if (rouges !== MUT.length) process.exitCode = 1;
  }
  if (ko) process.exitCode = 1;
})();
