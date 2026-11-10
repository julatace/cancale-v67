// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : NOTE PRIVÉE D'UNE PAIRE (lot BD) + ACHAT SAISI DEUX FOIS (lot BH)
//        node scripts/audit-note-achat-double.cjs
// EXÉCUTE src/notePaire.js et src/achatsDoubles.js, puis lit l'app.
//  BD 1. une note se range sous l'IDENTITÉ de la paire : `n:<cleNum>` (« 007 » = « 7 »,
//        « b125 » = « B125 »), sinon `a:<id d'annonce>` ; sans identité, rien ;
//     2. 50 paires au même titre : la note du N°27 n'est QUE sur le N°27 — le titre
//        n'entre jamais dans la règle (une paire « au même titre » sans identité : rien) ;
//     3. une republication garde la note (même N° ; ou `recreeDe` sans N°) ;
//     4. un N° porté par deux paires présentes cache la note (jamais la mauvaise) ;
//        une chaîne de republication (recreeDe) est UNE paire ;
//     5. écrire : ≤ 200 caractères, une ligne ; effacer ; écrire sous le N° retire la
//        note posée avant sur l'annonce ; l'inverse est EXACT (annulable) ;
//     6. l'app : la clé est synchronisée (ligne `main`), écrite par un geste annulable,
//        et JAMAIS lue ailleurs que par la note (ni description, ni extension, ni api/).
//  BH 7. même n° de transaction / commande / facture ⇒ un groupe ; 50 achats
//        identiques (titre, prix, date) sans référence ⇒ AUCUN groupe ; références
//        courtes (< 6) ⇒ rien ; « 9400 0001 » = « 94000001 » ;
//     8. « Garder celle-ci » ne masque que les AUTRES du groupe (Vinted : le masquage
//        existant ; hors plateforme : sa clé) ; un achat masqué sort des totaux ;
//     9. l'app : la source « À trancher » est publiée par l'écran Achats ; les totaux
//        de l'écran et de Compta lisent les achats hors plateforme SANS les masqués.
// `AUDIT_RACINE=<dossier>` : juger un autre arbre (preuve sur le code d'avant / mutation).
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const RACINE = process.env.AUDIT_RACINE || path.join(__dirname, '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const lire = (rel) => { try { return fs.readFileSync(path.join(RACINE, rel), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

(async () => {
  let N = null, D = null;
  try { N = await import(path.join(RACINE, 'src', 'notePaire.js')); } catch (e) { dit(false, 'BD · src/notePaire.js existe et se charge', String(e && e.message).slice(0, 120)); }
  try { D = await import(path.join(RACINE, 'src', 'achatsDoubles.js')); } catch (e) { dit(false, 'BH · src/achatsDoubles.js existe et se charge', String(e && e.message).slice(0, 120)); }

  if (N) {
    // 1
    dit(JSON.stringify(N.clesPaire({ numero: '007', itemId: '123456' })) === '["n:7","a:123456"]', 'BD 1 · « 007 » = « 7 », puis l’annonce', JSON.stringify(N.clesPaire({ numero: '007', itemId: '123456' })));
    dit(N.cleEcriture({ numero: 'b125' }) === 'n:B125' && N.cleEcriture({ itemId: '8101' }) === 'a:8101', 'BD 1 · s’écrit sous le N° (« b125 » = « B125 »), sinon sous l’annonce');
    dit(N.cleEcriture({ titre: 'Adidas Spezial noir 38' }) === '' && N.noteDe({ 'n:7': { t: 'x' } }, { titre: 'Adidas Spezial noir 38' }) === null, 'BD 1 · sans identité : ni écriture, ni lecture');
    // 2 — cinquante paires identiques
    const TITRE = 'adidas spezial noir taille 38';
    const notes = { 'n:27': { t: 'petite tache semelle gauche', at: '2026-11-10T10:00:00Z' } };
    const paires = Array.from({ length: 50 }, (_, i) => ({ numero: String(i + 1), itemId: String(810000 + i), titre: TITRE, title: TITRE }));
    const avec = paires.filter((p) => N.noteDe(notes, p));
    dit(avec.length === 1 && avec[0].numero === '27', 'BD 2 · 50 paires au même titre : la note du N°27 n’est que sur le N°27', avec.map((p) => p.numero).join(','));
    const sansId = { titre: TITRE, title: TITRE, numero: '', itemId: '' };
    dit(N.noteDe({ ...notes, ['t:' + TITRE]: { t: 'piège' }, [TITRE]: { t: 'piège' } }, sansId) === null && N.clesPaire(sansId).length === 0 && N.cleEcriture(sansId) === '', 'BD 2 · une paire au même titre SANS identité : aucune clé, aucune note (jamais par le titre)');
    // 3
    dit((N.noteDe(notes, { numero: '27', itemId: '999001', recreeDe: '810026' }) || {}).texte === 'petite tache semelle gauche', 'BD 3 · republiée (nouvelle annonce, même N°) : la note suit');
    dit((N.noteDe({ 'a:810026': { t: 'taille petit' } }, { itemId: '999001', recreeDe: '810026' }) || {}).texte === 'taille petit', 'BD 3 · republiée sans N° : la note de l’ancienne annonce suit (`recreeDe`)');
    // 4
    const fiches = { 1: { numero: '5' }, 2: { numero: '5' }, 3: { numero: '6' }, 4: { numero: '6', recreeDe: '3' }, 5: { numero: '05' } };
    const amb = N.numerosAmbigus(fiches);
    dit(amb.has('5') && !amb.has('6'), 'BD 4 · deux paires sous le N°5 = ambigu ; une republication (recreeDe) = une paire', JSON.stringify([...amb]));
    dit(N.numerosAmbigus(fiches, { presents: new Set(['1', '3', '4']) }).size === 0, 'BD 4 · seules les paires présentes comptent quand on le sait');
    const cachee = N.noteDe({ 'n:5': { t: 'x' } }, { numero: '5' }, { ambigu: (k) => amb.has(k) });
    dit(!!cachee && cachee.cachee === true && !cachee.texte, 'BD 4 · N° ambigu : la note est CACHÉE (jamais montrée sur la mauvaise paire)', JSON.stringify(cachee));
    // 5
    const long = 'a'.repeat(260) + '\n\tb';
    dit(N.nettoyerNote(long).length === 200 && !/[\n\t]/.test(N.nettoyerNote('a\nb\tc')), 'BD 5 · 200 caractères au plus, une ligne');
    const cur = { 'a:8101': { t: 'avant numérotage', at: 'x' } };
    const ops = N.opsNote(cur, { numero: '7', itemId: '8101' }, ' taille  petit ', { maintenant: 'T' });
    dit(ops.length === 2 && ops[0].id === 'n:7' && ops[0].apres.t === 'taille petit' && ops[0].avant === undefined && ops[1].id === 'a:8101' && ops[1].apres === undefined && ops[1].avant.t === 'avant numérotage',
      'BD 5 · écrire sous le N° retire la note d’annonce ; chaque op garde sa valeur d’avant (annulable)', JSON.stringify(ops));
    const eff = N.opsNote({ 'n:7': { t: 'x' } }, { numero: '7' }, '   ');
    dit(eff.length === 1 && eff[0].apres === undefined && eff[0].avant.t === 'x', 'BD 5 · vide = effacer');
    dit(N.opsNote({ 'n:7': { t: 'x' } }, { numero: '7' }, 'x').length === 0, 'BD 5 · rien de changé : rien écrit');
    dit(Object.keys(N.notesPropres({ 'n:7': { t: 'ok' }, 'titre:abc': { t: 'non' }, 'n:8': { t: '' }, 'a:12': { t: 'court' } })).join() === 'n:7', 'BD 5 · la carte gardée ne prend que les identités valides');
  }

  // 6 — l'app
  const app = sansCommentaires(lire('src/App.jsx'));
  dit(/'vrm_notes_paires',\s*'vrm_achats_hors_masques'/.test(lire('src/App.jsx')), 'BD 6 · les deux clés sont synchronisées (SYNC_KEYS, ligne `main`)');
  const coque = (/function NotePaireCoque\([\s\S]*?\n\}/.exec(app) || [''])[0];
  dit(/noteDe\(/.test(coque) && /ambigu/.test(coque) && !/title|titre/.test(coque.replace(/titre=|title=/g, '')), 'BD 6 · la note se lit dans `NotePaireCoque`, par identité (N°, annonce), avec l’ambiguïté — jamais par le titre');
  const edit = (/const editerNotePaire = async[\s\S]*?\n\};/.exec(app) || [''])[0];
  dit(/gesteVrm\(/.test(edit) && /opsNote\(/.test(edit) && !/vmrCmd|fetch\(|appelEbay/.test(edit), 'BD 6 · écrite par un geste annulable (gesteVrm), rien d’extérieur');
  dit((app.match(/\bnoteDe\(/g) || []).length === 1 && (app.match(/lireNotesPaires\(\)/g) || []).length <= 3, 'BD 6 · la note n’est lue nulle part ailleurs dans l’app');
  const ext = ['vinted-sync-extension', 'api'].flatMap((d) => { try { return fs.readdirSync(path.join(RACINE, d), { recursive: true }).filter((f) => /\.(js|cjs|mjs)$/.test(f)).map((f) => path.join(d, f)); } catch (_) { return []; } });
  const fuites = ext.filter((f) => /vrm_notes_paires|notePaire/.test(lire(f)));
  dit(ext.length > 0 && fuites.length === 0, 'BD 6 · ni l’extension ni le serveur ne lisent la note (jamais envoyée à une plateforme)', fuites.join(','));
  const usages = ['src/NotePaire.jsx', 'src/FichePaire.jsx', 'src/PreparerColis.jsx', 'src/ScannerColis.jsx', 'src/ecrans/Stock.jsx'].filter((f) => /note/i.test(lire(f)));
  dit(/<NotePaireCoque numero=\{num\} itemId=\{it\.id\}/.test(app) && /data-vente-notes/.test(app) && /note=\{p && p\.num/.test(app) && /note=\{\(c\) =>/.test(app) && /<NotePaireCoque numero=\{a\.numero\}/.test(lire('src/ecrans/Stock.jsx')),
    'BD 6 · visible partout où la paire apparaît : Annonces, Ventes, fiche paire, Préparer/scan, Stock', usages.join(','));

  if (D) {
    // 7
    const V = [{ transaction_id: 94000001, title: 'Nike Dunk' }, { transaction_id: 94000002, title: 'Nike Dunk' }];
    const H = [{ id: 'a', title: 'Nike Dunk', ref: '9400 0001' }, { id: 'b', title: 'Nike Dunk', ref: '94000003' }];
    const g = D.achatsEnDouble({ vinted: V, hors: H });
    dit(g.length === 1 && g[0].ref === '94000001' && g[0].achats.map((a) => a.id).join() === 'tx:94000001,ob:a', 'BH 7 · même n° (« 9400 0001 » = « 94000001 ») : UN groupe, les deux achats', JSON.stringify(g.map((x) => x.achats.map((a) => a.id))));
    const cinquante = Array.from({ length: 50 }, (_, i) => ({ id: 'x' + i, title: 'adidas spezial noir taille 38', price: '30', date: '2026-11-01', source: 'Brocante' }));
    dit(D.achatsEnDouble({ vinted: [], hors: cinquante }).length === 0, 'BH 7 · 50 achats identiques (titre, prix, date) sans référence : aucun doublon');
    const vintedPareils = Array.from({ length: 50 }, (_, i) => ({ transaction_id: 95000000 + i, title: 'adidas spezial noir taille 38', price: { amount: '30' }, date: '2026-11-01' }));
    dit(D.achatsEnDouble({ vinted: vintedPareils, hors: cinquante.map((b, i) => ({ ...b, ref: 'FAC' + (100000 + i) })) }).length === 0, 'BH 7 · 50 achats Vinted identiques + 50 factures distinctes : aucun doublon');
    dit(D.achatsEnDouble({ vinted: [], hors: [{ id: 'p', ref: '12' }, { id: 'q', ref: '12' }] }).length === 0, 'BH 7 · une référence courte (« 12 ») n’est pas une identité');
    dit(D.achatsEnDouble({ vinted: [], hors: [{ id: 'p', ref: 'FAC-2026-0042' }, { id: 'q', ref: 'fac 2026 0042' }] }).length === 1, 'BH 7 · une facture tapée deux fois (casse, tirets) : le même achat');
    dit(D.achatsEnDouble({ vinted: V, hors: H, masquesHors: new Set(['a']) }).length === 0, 'BH 7 · un achat masqué ne fait plus un doublon');
    // 8
    const ops = D.opsGarder(g[0], 'tx:94000001');
    dit(ops.length === 1 && ops[0].k === 'vrm_achats_hors_masques' && ops[0].id === 'a' && ops[0].type === 'ensemble' && ops[0].apres === true && ops[0].avant === false, 'BH 8 · garder l’achat Vinted masque l’achat tapé (sa clé), rien d’autre', JSON.stringify(ops));
    const ops2 = D.opsGarder(g[0], 'ob:a');
    dit(ops2.length === 1 && ops2[0].k === 'vinted_purchases_hidden' && ops2[0].id === '94000001', 'BH 8 · garder l’achat tapé masque l’achat Vinted (le masquage existant)', JSON.stringify(ops2));
    dit(D.opsGarder(g[0], 'ob:zzz').length === 0, 'BH 8 · un id hors du groupe : rien');
    dit(D.horsVisibles(H, ['a']).map((b) => b.id).join() === 'b', 'BH 8 · un achat masqué sort des totaux');
  }
  // 9
  dit(/publierATrancher\('achats-doubles'/.test(app) && /achatsEnDouble\(\{ vinted: buysBase/.test(app), 'BH 9 · « À trancher » : publié par l’écran Achats, sur les achats lus');
  dit(/const offBuys = useMemo\(\(\) => horsVisibles\(offBuysTous, horsMasques\)/.test(app) && /horsVisibles\(load\('vinted_offvinted_buys'/.test(lire('src/ecrans/Compta.jsx')), 'BH 9 · les totaux (Achats, Compta) lisent les achats hors plateforme sans les masqués');
  const regle = sansCommentaires(lire('src/achatsDoubles.js'));
  const corpsRegle = (/export function achatsComparables[\s\S]*?\nexport function opsGarder/.exec(regle) || [''])[0];
  dit(!!corpsRegle && !/\.title|\.price|\.date|normTitle|titre/.test(corpsRegle), 'BH 9 · la règle ne lit ni titre, ni prix, ni date');

  console.log(ko ? `\n${ko} rouge(s)` : '\nNote privée et achat en double : par identité seulement.');
  process.exit(ko ? 1 : 0);
})();
