#!/usr/bin/env node
if (!process.argv.includes('--prouve') && !process.env.MUT) require('./_source-app.cjs').brancher();   // (11 nov., découpe 2) lit l'app RECOLLÉE (scripts/brancher-audits.cjs)
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT : REVENIR EN ARRIÈRE (11 nov.) — src/restauration.js
//  Exécute le VRAI module (ou une copie mutée, `--prouve`) et lit le branchement.
//   A. l'instantané : projeté (ni titre ni photo), « pas su » ⇒ aucun point, léger ;
//   B. l'aperçu est EXACT (« 12 prix d'achat remis · 3 notes · 0 numéro ») et par identité ;
//   C. rien de plus récent n'est effacé sans être montré ET demandé (conflits) ;
//   D. les NUMÉROS ne reculent jamais : attribué depuis = gardé ; rendu seulement
//      s'il n'est porté par AUCUNE autre (fiche, vente, lien Leboncoin), une seule
//      fois ; le pool ne fait que grandir ; 50 paires identiques ne se confondent pas ;
//   E. écriture conditionnelle : changé entre l'aperçu et l'écriture ⇒ gardé et
//      compté ; lecture ratée ⇒ RIEN écrit ; jamais une fiche créée ;
//   F. « Annuler la restauration » remet l'état d'avant, garde ce qui a changé
//      depuis, et ne retire jamais un N° rendu ;
//   G. les points : 30 jours, 24 emplacements, le libre puis l'expiré puis le plus
//      ancien ; le point du jour se décide sur la liste du serveur (« pas su » ⇒ rien) ;
//   H. un fichier de sauvegarde d'une autre numérotation ne rend aucun N° ;
//   I. le branchement : points avant série et import, l'import n'écrit rien sans
//      son point, la liste se lit par `meta`, pas de localStorage côté décision,
//      l'écran monté dans Paramètres, la migration 033 (garde des emplacements).
//  Lancer : node scripts/audit-restauration.cjs            (tout)
//           node scripts/audit-restauration.cjs --prouve   (chaque mutation doit le faire tomber)
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const lireF = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
let ko = 0, ok = 0;
const SEUL = process.env.RESTAURATION_SECTIONS ? new Set(process.env.RESTAURATION_SECTIONS.split(',')) : null;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const J = (v) => JSON.stringify(v);
const C = (v) => JSON.parse(J(v));

// ── --prouve : chaque mutation de la règle doit faire tomber l'audit ──────────
const MUTATIONS = [
  ['M1 un N° attribué depuis peut être remplacé', "if (cn != null) {                                      // attribué depuis (ou changé) : il reste", "if (cn != null && false) {"],
  ['M2 « ajouté depuis » remis sans demander', "const etat = vide(pv) ? 'conflit' : retouche(pv, lv, cv) ? 'conflit' : 'remis';", "const etat = retouche(pv, lv, cv) ? 'conflit' : 'remis';"],
  ['M3 le pool peut rétrécir', "if (m.apres === undefined) return { valeur, change: false, ignore: true };\n    const L = Array.isArray(valeur)", "if (m.apres === undefined) return { valeur: (Array.isArray(valeur) ? valeur : []).filter((x) => String(x) !== String(m.avant)), change: true, ignore: false };\n    const L = Array.isArray(valeur)"],
  ['M4 l’annulation retire le N° rendu', ".filter((m) => m && !m.sansRetour && m.k !== CLE_POOL)", ".filter((m) => m && m.k !== CLE_POOL)"],
  ['M5 écrire sans tout lire d’abord', "if (v === undefined) return { ok: false, definitif: true, ecrit: false, raison: 'lecture', ignores: 0 };\n    lues[k] = v;", "lues[k] = v === undefined ? null : v;"],
  ['M6 N° rendu même porté ailleurs', "if (autres.length || ailleurs.has(c) || rendus.has(c)) {", "if (false) {"],
  ['M7 conflits écrits sans réponse', "if (nConflits && conflits !== 'garder' && conflits !== 'remettre') return null;", ""],
  ['M8 point du jour sur un « pas su »', "if (!Array.isArray(rows)) return false;\n  const j = jourParis(maintenant);", "if (!Array.isArray(rows)) return true;\n  const j = jourParis(maintenant);"],
  ['M10 une fiche nommée par son ANCIEN N°', "const lib = estObjet(cur[id]) && cur[id].numero != null && String(cur[id].numero).trim() ? nom(id, cur[id]) :", "const lib = true ? nom(id, { ...(P[id] || {}), ...(cur[id] || {}), numero: (cur[id] || {}).numero || (P[id] || {}).numero }) :"],
  ['M9 emplacement hors des 24', "for (let s = 0; s < MAX_POINTS; s++) if (!vivants.has(s)) {", "for (let s = 0; s < MAX_POINTS + 50; s++) if (!vivants.has(s) && s >= vivants.size) {"],
];
if (process.argv.includes('--prouve')) {
  const src = lireF('src/restauration.js');
  let tombe = 0;
  for (const [nom, de, vers] of MUTATIONS) {
    if (!src.includes(de)) { console.log(`?? ${nom} : le texte à muter n'existe plus (mettre à jour MUTATIONS)`); process.exitCode = 2; continue; }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'restauration-mut-'));
    fs.writeFileSync(path.join(dir, 'restauration.js'), src.replace(de, vers));
    fs.copyFileSync(path.join(R, 'src', 'corbeille.js'), path.join(dir, 'corbeille.js'));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, RESTAURATION_MODULE: path.join(dir, 'restauration.js') }, encoding: 'utf8' });
    const rouges = (r.stdout.match(/^KO .*/gm) || []);
    if (r.status !== 0 && rouges.length) { tombe++; console.log(`OK  ${nom} : attrapée (${rouges.length} rouge(s), ex. ${rouges[0].slice(4, 90)})`); }
    else console.log(`KO  ${nom} : PAS attrapée`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(`${tombe}/${MUTATIONS.length} mutations attrapées`);
  process.exit(tombe === MUTATIONS.length && process.exitCode !== 2 ? 0 : 1);
}

(async () => {
  const MOD = process.env.RESTAURATION_MODULE || path.join(R, 'src', 'restauration.js');
  const M = await import(pathToFileURL(MOD).href);
  const cleNum = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
  // Un « appareil » : clé ⇒ valeur (null = absente). `pasSu` : clés illisibles.
  const magasin = (init, pasSu = []) => { const m = C(init); return { m, lire: (k) => (pasSu.includes(k) ? undefined : k in m ? C(m[k]) : null), ecrire: async (k, v) => { m[k] = C(v); return { ok: true }; } }; };
  const TOUT = { prix: true, liens: true, notes: true, depenses: true, reglages: true, numeros: true };
  const section = (s) => !SEUL || SEUL.has(s);

  // Une base inventée (rien de réel) : 20 paires, des ventes, des notes, une dépense.
  const fiches = {};
  for (let i = 1; i <= 20; i++) fiches[`it${i}`] = { numero: String(i), title: 'Nike Dunk Low 42', photo: `https://x/${i}.jpg`, buyPrice: 30 + i, account: 'shop_a' };
  const base = {
    vinted_annonce_numeros: fiches,
    vinted_sale_overrides: { tx9: { buyPrice: 55, numero: '50' } },
    vinted_buyprice_by_num: { 1: 31, 2: 32 },
    vinted_used_numeros: Array.from({ length: 50 }, (_, i) => i + 1),
    vrm_notes_paires: { 'n:1': { t: 'tache semelle', at: '2026-11-01T10:00:00Z' }, 'n:2': { t: 'boîte abîmée', at: '2026-11-01T10:00:00Z' }, 'n:3': { t: 'lacets neufs', at: '2026-11-01T10:00:00Z' } },
    vinted_achat_notes: { b1: 'payé en espèces' },
    vrm_compta: { depenses: [{ id: 'd1', libelle: 'Scotch', montant: 6 }], fixes: [], packs: [], abonnements: [] },
    vinted_offvinted_buys: [{ id: 'ob1', title: 'Asics', price: '20' }],
    vinted_dark: false, vinted_regime: 'micro', vrm_prenom: 'Test',
    vrm_lbc_liens: {},
  };
  const T0 = Date.parse('2026-11-11T08:00:00Z');

  // ── A. L'instantané ──
  if (section('A')) {
    const s = M.instantane(magasin(base).lire);
    dit(s && s.v === 1 && Object.keys(s.fiches).length === 20, 'A1 instantané des 20 fiches');
    dit(s && !J(s).includes('Nike') && !J(s).includes('https://'), 'A2 projeté : ni titre ni photo dans le point (prix, liens, N° seulement)');
    dit(M.instantane(magasin(base, ['vrm_notes_paires']).lire) === null, 'A3 une clé « pas su » ⇒ AUCUN point (un point vide restaurerait du vide)');
    const gros = { ...base, vinted_annonce_numeros: {} };
    for (let i = 0; i < 2000; i++) gros.vinted_annonce_numeros['g' + i] = { numero: String(i), title: 'x'.repeat(200), photo: 'y'.repeat(300), buyPrice: 40, buyFromId: 'tx' + i };
    const sg = M.instantane(magasin(gros).lire);
    const lg = M.lignePoint({ snap: sg, raison: 'jour', maintenant: T0 });
    dit(lg && lg.taille < 200000, 'A4 2 000 fiches ⇒ un point de moins de 200 Ko', lg ? `${Math.round(lg.taille / 1024)} Ko` : 'null');
    dit(M.empreinte(M.instantane(magasin(base).lire)) === M.empreinte(M.instantane(magasin(C(base)).lire)), 'A5 empreinte stable (deux points identiques n’en font qu’un)');
  }

  // ── B. L'aperçu exact ──
  if (section('B')) {
    const point = M.instantane(magasin(base).lire);
    const cur = C(base);
    for (let i = 1; i <= 12; i++) cur.vinted_annonce_numeros[`it${i}`].buyPrice = 99;   // une saisie en série ratée
    cur.vinted_buyprice_by_num[1] = 99; cur.vinted_buyprice_by_num[2] = 99;               // et son miroir par N°
    delete cur.vrm_notes_paires['n:1']; delete cur.vrm_notes_paires['n:2']; cur.vrm_notes_paires['n:3'] = { t: 'X', at: '2026-11-11T09:00:00Z' };
    const ap = M.apercu({ point, actuel: magasin(cur).lire, cleNum });
    dit(ap.ok && ap.parCat.prix.remis === 12 && ap.parCat.notes.remis === 3 && ap.parCat.numeros.remis === 0, 'B1 12 prix d’achat · 3 notes · 0 numéro', J({ p: ap.parCat.prix, n: ap.parCat.notes }));
    const t = M.texteResume(ap, { prix: true, notes: true, numeros: true }, 'garder');
    dit(t === '12 prix d’achat remis · 3 notes · 0 numéro', 'B2 le résumé dit « 12 prix d’achat remis · 3 notes · 0 numéro »', t);
    const l1 = ap.lignes.find((l) => l.cat === 'prix' && l.id === 'it1');
    dit(l1 && l1.morceaux.length === 2 && l1.morceaux.some((m) => m.k === 'vinted_buyprice_by_num'), 'B3 le miroir par N° suit sa fiche : UNE ligne par paire', l1 && J(l1.morceaux.map((m) => m.k)));
    {
      const pt = C(base); delete pt.vinted_annonce_numeros.it5.numero; pt.vinted_annonce_numeros.it5.buyPrice = 99; pt.vinted_annonce_numeros.it31 = { numero: '5', title: 'Autre' };
      const a5 = M.apercu({ point, actuel: magasin(pt).lire, cleNum }).lignes.find((l) => l.cat === 'prix' && l.id === 'it5');
      dit(a5 && !/N°5/.test(a5.libelle) && /it5/.test(a5.libelle), '§5 une fiche qui a perdu son N° (porté maintenant par une autre) n’est JAMAIS nommée par l’ancien N°', a5 && a5.libelle);
    }
    dit(ap.lignes.filter((l) => l.cat === 'prix').every((l) => /^it\d+$/.test(l.id)), 'B4 chaque ligne nomme sa paire par son IDENTITÉ (id d’annonce), jamais par son titre');
    const rien = M.apercu({ point, actuel: magasin(base).lire, cleNum });
    dit(rien.ok && rien.lignes.length === 0, 'B5 rien n’a changé ⇒ aperçu vide');
    dit(!M.apercu({ point, actuel: magasin(base, ['vrm_compta']).lire, cleNum }).ok, 'B6 une clé courante « pas su » ⇒ pas d’aperçu (on ne compare pas à du vide)');
  }

  // ── C. Conflits ──
  if (section('C')) {
    const b = C(base); delete b.vinted_annonce_numeros.it20.buyPrice;
    const point = M.instantane(magasin(b).lire);
    const cur = C(b); cur.vinted_annonce_numeros.it20.buyPrice = 45; cur.vinted_annonce_numeros.it1.buyPrice = 99;
    cur.vrm_compta.depenses.push({ id: 'd2', libelle: 'Cartons', montant: 12 });
    const ap = M.apercu({ point, actuel: magasin(cur).lire, cleNum });
    const l20 = ap.lignes.find((l) => l.id === 'it20' && l.cat === 'prix');
    dit(l20 && l20.etat === 'conflit' && l20.raison === 'ajoute-depuis', 'C1 un prix tapé DEPUIS (absent au moment choisi) = conflit, jamais effacé en silence');
    const d2 = ap.lignes.find((l) => l.id === 'd2');
    dit(d2 && d2.etat === 'conflit', 'C2 une dépense ajoutée depuis = conflit');
    dit(M.morceauxChoisis(ap, TOUT, null) === null, 'C3 conflit sans réponse ⇒ AUCUN morceau (rien ne s’écrit)');
    const s1 = magasin(cur); await M.ecrireRestauration({ morceaux: M.morceauxChoisis(ap, TOUT, 'garder'), lire: s1.lire, ecrire: s1.ecrire });
    dit(s1.m.vinted_annonce_numeros.it20.buyPrice === 45 && s1.m.vinted_annonce_numeros.it1.buyPrice === 31 && s1.m.vrm_compta.depenses.length === 2, 'C4 « Les garder » : 45 € et la dépense restent, 99 € redevient 31 €');
    const s2 = magasin(cur); await M.ecrireRestauration({ morceaux: M.morceauxChoisis(ap, TOUT, 'remettre'), lire: s2.lire, ecrire: s2.ecrire });
    dit(s2.m.vinted_annonce_numeros.it20.buyPrice === undefined && s2.m.vrm_compta.depenses.length === 1, 'C5 « Revenir quand même » (SA réponse) : l’état du moment choisi exactement');
    // Retouché APRÈS un point plus récent ⇒ conflit ; changé avant lui seulement ⇒ remis.
    const P = M.instantane(magasin(base).lire);
    const mid = C(base); mid.vinted_annonce_numeros.it1.buyPrice = 70; mid.vinted_annonce_numeros.it2.buyPrice = 71;
    const Lp = M.instantane(magasin(mid).lire);
    const now = C(mid); now.vinted_annonce_numeros.it1.buyPrice = 80;
    const ap2 = M.apercu({ point: P, actuel: magasin(now).lire, plusRecent: Lp, cleNum });
    const a1 = ap2.lignes.find((l) => l.id === 'it1' && l.cat === 'prix'), a2 = ap2.lignes.find((l) => l.id === 'it2' && l.cat === 'prix');
    dit(a1 && a1.etat === 'conflit' && a1.raison === 'retouche', 'C6 retouché après un point plus récent ⇒ conflit (peut-être SA correction)');
    dit(a2 && a2.etat === 'remis', 'C7 changé une fois depuis le moment choisi ⇒ remis');
  }

  // ── D. Les numéros ne reculent jamais ──
  if (section('D')) {
    const b = C(base);
    b.vinted_annonce_numeros.it5.numero = '5'; delete b.vinted_annonce_numeros.it19.numero;
    const point = M.instantane(magasin(base).lire);   // au moment choisi : it19 portait 19, it5 portait 5
    const cur = C(base);
    delete cur.vinted_annonce_numeros.it7.numero;                  // perdu : 7 libre ⇒ rendu
    delete cur.vinted_annonce_numeros.it8.numero; cur.vinted_annonce_numeros.it30 = { numero: '8', title: 'autre' };   // 8 porté par une autre ⇒ refus
    delete cur.vinted_annonce_numeros.it9.numero; cur.vinted_sale_overrides.tx77 = { numero: '9' };                     // 9 porté par une vente ⇒ refus
    delete cur.vinted_annonce_numeros.it10.numero; cur.vrm_lbc_liens = { lbc1: '10' };                                 // 10 posé sur Leboncoin ⇒ refus
    cur.vinted_annonce_numeros.it11.numero = '61';                 // changé depuis ⇒ le N° actuel reste
    cur.vinted_annonce_numeros.it12.numero = 'B12';                // idem (numéro à lettres)
    cur.vinted_annonce_numeros.it40 = { numero: '62', title: 'neuve' };   // attribué depuis ⇒ reste
    cur.vinted_used_numeros.push(61, 62);
    const ailleurs = Object.values(cur.vrm_lbc_liens);
    const ap = M.apercu({ point, actuel: magasin(cur).lire, cleNum, numerosAilleurs: ailleurs });
    const N = (id) => ap.lignes.find((l) => l.cat === 'numeros' && l.id === id);
    dit(N('it7') && N('it7').etat === 'remis', 'D1 une fiche qui a perdu son N° le retrouve (porté par aucune autre)');
    dit(N('it8') && N('it8').etat === 'refus' && N('it8').raison === 'numero-pris', 'D2 N° porté par une AUTRE fiche ⇒ pas rendu (deux paires sous un N°, §5)');
    dit(N('it9') && N('it9').etat === 'refus', 'D3 N° porté par une vente ⇒ pas rendu');
    dit(N('it10') && N('it10').etat === 'refus', 'D4 N° posé sur Leboncoin ⇒ pas rendu');
    dit(N('it11') && N('it11').etat === 'garde' && N('it12') && N('it12').etat === 'garde', 'D5 un N° changé depuis reste (jamais remplacé par l’ancien)');
    dit(N('it40') && N('it40').etat === 'garde' && N('it40').raison === 'attribue-depuis', 'D6 un N° attribué depuis reste attribué');
    const s = magasin(cur);
    const ms = M.morceauxChoisis(ap, TOUT, 'remettre');
    await M.ecrireRestauration({ morceaux: ms, lire: s.lire, ecrire: s.ecrire });
    const F = s.m.vinted_annonce_numeros;
    dit(F.it7.numero === '7' && F.it8.numero === undefined && F.it9.numero === undefined && F.it11.numero === '61' && F.it12.numero === 'B12' && F.it40.numero === '62', 'D7 écrit : 7 rendu ; 8, 9 vides ; 61, B12, 62 intacts même avec « Revenir quand même »', J({ 7: F.it7.numero, 8: F.it8.numero, 11: F.it11.numero, 40: F.it40.numero }));
    dit(cur.vinted_used_numeros.every((x) => s.m.vinted_used_numeros.includes(x)), 'D8 le pool n’a rien perdu (append-only)');
    // Deux fiches qui voudraient le MÊME N° : un seul le reçoit.
    const p2 = M.instantane(magasin({ ...base, vinted_annonce_numeros: { a: { numero: '70' }, b: { numero: '70' } } }).lire);
    const ap2 = M.apercu({ point: p2, actuel: magasin({ ...base, vinted_annonce_numeros: { a: { title: 'x' }, b: { title: 'x' } } }).lire, cleNum });
    dit(ap2.lignes.filter((l) => l.cat === 'numeros' && l.etat === 'remis').length === 1, 'D9 un même N° n’est jamais rendu à deux fiches');
    // Un N° rendu absent du pool y entre ; un morceau du pool ne peut qu’ajouter.
    const p3 = M.instantane(magasin({ ...base, vinted_annonce_numeros: { a: { numero: '90' } } }).lire);
    const cur3 = { ...base, vinted_annonce_numeros: { a: { title: 'x' } } };
    const ap3 = M.apercu({ point: p3, actuel: magasin(cur3).lire, cleNum });
    const s3 = magasin(cur3); await M.ecrireRestauration({ morceaux: M.morceauxChoisis(ap3, TOUT, 'garder'), lire: s3.lire, ecrire: s3.ecrire });
    dit(s3.m.vinted_used_numeros.includes('90') && s3.m.vinted_used_numeros.length === 51, 'D10 un N° rendu entre dans le pool');
    const r = M.appliquerMorceau([1, 2, 3], { k: 'vinted_used_numeros', type: 'element', id: 2, avant: 2 });
    dit(J(r.valeur) === '[1,2,3]', 'D11 un morceau du pool ne peut pas retirer un N°', J(r.valeur));
    // 50 paires identiques (même titre, même prix) : seule celle dont l'id a changé est touchée.
    const id50 = {}; for (let i = 0; i < 50; i++) id50['z' + i] = { numero: String(100 + i), title: 'Nike Dunk Low Panda 42', buyPrice: 60 };
    const b50 = { ...base, vinted_annonce_numeros: id50, vinted_used_numeros: Object.values(id50).map((f) => f.numero) };
    const p50 = M.instantane(magasin(b50).lire);
    const c50 = C(b50); c50.vinted_annonce_numeros.z37.buyPrice = 5; delete c50.vinted_annonce_numeros.z12.numero;
    const ap50 = M.apercu({ point: p50, actuel: magasin(c50).lire, cleNum });
    dit(ap50.lignes.length === 2 && ap50.lignes.some((l) => l.id === 'z37' && l.cat === 'prix') && ap50.lignes.some((l) => l.id === 'z12' && l.cat === 'numeros' && l.etat === 'remis'), '§5 50 paires identiques : seules z37 (prix) et z12 (son N°) sont touchées', J(ap50.lignes.map((l) => l.id + ':' + l.cat)));
  }

  // ── E. Écriture conditionnelle ──
  if (section('E')) {
    const point = M.instantane(magasin(base).lire);
    const cur = C(base); cur.vinted_annonce_numeros.it1.buyPrice = 99; cur.vinted_annonce_numeros.it2.buyPrice = 99; delete cur.vrm_notes_paires['n:1'];
    const ap = M.apercu({ point, actuel: magasin(cur).lire, cleNum });
    const ms = M.morceauxChoisis(ap, TOUT, 'garder');
    const s = magasin(cur); s.m.vinted_annonce_numeros.it2.buyPrice = 75;     // retapé entre l'aperçu et la confirmation
    const r = await M.ecrireRestauration({ morceaux: ms, lire: s.lire, ecrire: s.ecrire });
    dit(s.m.vinted_annonce_numeros.it1.buyPrice === 31 && s.m.vinted_annonce_numeros.it2.buyPrice === 75 && r.ignores >= 1, 'E1 changé entre l’aperçu et l’écriture ⇒ gardé et compté', `ignores=${r.ignores}`);
    let ecrits = 0;
    const sk = magasin(cur, ['vrm_notes_paires']);   // la 2e clé lue est illisible
    const rk = await M.ecrireRestauration({ morceaux: ms, lire: sk.lire, ecrire: async () => { ecrits++; return { ok: true }; } });
    dit(rk.ok === false && rk.raison === 'lecture' && ecrits === 0, 'E2 une lecture ratée ⇒ RIEN écrit (même pas les clés déjà lues)');
    const curX = C(cur); delete curX.vinted_annonce_numeros.it1;
    const apX = M.apercu({ point, actuel: magasin(curX).lire, cleNum });
    const lX = apX.lignes.find((l) => l.id === 'it1' && l.cat === 'prix');
    dit(lX && lX.etat === 'refus' && lX.raison === 'fiche-absente' && !lX.morceaux.length, 'E3 une fiche disparue n’est jamais recréée (refus dit)');
    const st = magasin({ ...cur, vinted_dark: true });
    const apR = M.apercu({ point, actuel: st.lire, cleNum });
    await M.ecrireRestauration({ morceaux: M.morceauxChoisis(apR, { reglages: true }, 'garder'), lire: st.lire, ecrire: st.ecrire });
    dit(st.m.vinted_dark === false && st.m.vinted_annonce_numeros.it1.buyPrice === 99, 'E4 seulement les catégories cochées (réglages ⇒ les prix ne bougent pas)');
    const pose = M.apercu({ point: { ...point, reglages: {} }, actuel: magasin(cur).lire, cleNum });
    dit(pose.lignes.filter((l) => l.cat === 'reglages').every((l) => l.etat === 'garde' && !l.morceaux.length), 'E5 un réglage posé depuis n’est jamais effacé');
  }

  // ── F. Annuler la restauration ──
  if (section('F')) {
    const point = M.instantane(magasin(base).lire);
    const cur = C(base); cur.vinted_annonce_numeros.it1.buyPrice = 99; cur.vinted_annonce_numeros.it3.buyPrice = 98; delete cur.vinted_annonce_numeros.it4.numero; delete cur.vrm_notes_paires['n:1'];
    const avant = C(cur);
    const ap = M.apercu({ point, actuel: magasin(cur).lire, cleNum });
    const ms = M.morceauxChoisis(ap, TOUT, 'garder');
    const s = magasin(cur);
    await M.ecrireRestauration({ morceaux: ms, lire: s.lire, ecrire: s.ecrire });
    dit(s.m.vinted_annonce_numeros.it4.numero === '4', 'F1 restauré (N°4 rendu)');
    s.m.vinted_annonce_numeros.it3.buyPrice = 50;   // retouché APRÈS la restauration
    const un = M.morceauxAnnulation(ms);
    await M.ecrireRestauration({ morceaux: un, lire: s.lire, ecrire: s.ecrire });
    dit(s.m.vinted_annonce_numeros.it1.buyPrice === 99 && J(s.m.vrm_notes_paires) === J(avant.vrm_notes_paires), 'F2 annuler remet exactement l’état d’avant la restauration');
    dit(s.m.vinted_annonce_numeros.it3.buyPrice === 50, 'F3 ce qui a changé APRÈS la restauration est gardé');
    dit(s.m.vinted_annonce_numeros.it4.numero === '4', 'F4 le N° rendu RESTE (un N° ne recule jamais)');
    dit(un.every((m) => !m.sansRetour && m.k !== 'vinted_used_numeros'), 'F5 l’inverse ne porte ni N° rendu ni morceau du pool');
    const s2 = C(s.m);
    await M.ecrireRestauration({ morceaux: un, lire: s.lire, ecrire: s.ecrire });
    dit(J(s.m) === J(s2), 'F6 rejouer l’annulation ne change rien de plus (idempotent)');
  }

  // ── G. Les points ──
  if (section('G')) {
    const row = (slot, at, extra = {}) => ({ id: `restore_${slot}`, meta: { at: new Date(at).toISOString(), raison: 'jour', empreinte: 'e' + slot, rev: 3, ...extra } });
    dit(M.MAX_POINTS === 24 && M.DUREE_POINTS_J === 30, 'G1 24 emplacements, 30 jours');
    const pts = M.lirePoints([row(0, T0 - 31 * 864e5), row(1, T0 - 864e5), { id: 'restore_x', meta: { at: '2026-11-01' } }, { id: 'restore_24', meta: { at: new Date(T0).toISOString() } }, row(2, T0 - 2 * 864e5, { vide: true }), { id: 'main', meta: {} }], T0);
    dit(pts.length === 1 && pts[0].slot === 1, 'G2 un point expiré, vidé, abîmé ou hors des 24 n’est pas montré', J(pts.map((p) => p.slot)));
    dit(M.choisirEmplacement([], T0).slot === 0 && M.choisirEmplacement([], T0).existe === false, 'G3 premier point : emplacement 0, à créer');
    const e1 = M.choisirEmplacement([row(0, T0 - 864e5), row(1, T0 - 40 * 864e5)], T0);
    dit(e1.slot === 1 && e1.existe === true && e1.rev === 3, 'G4 un emplacement expiré est repris (avec sa révision pour le comparer-et-échanger)', J(e1));
    const pleins = Array.from({ length: 24 }, (_, i) => row(i, T0 - (i === 17 ? 20 : i % 5 + 1) * 864e5));
    const e2 = M.choisirEmplacement(pleins, T0);
    dit(e2.slot === 17, 'G5 24 points vivants ⇒ le plus ancien est remplacé', J(e2));
    let max = 0; let rows = [];
    for (let k = 0; k < 100; k++) { const e = M.choisirEmplacement(rows, T0 + k * 1000); rows = rows.filter((r) => r.id !== `restore_${e.slot}`).concat([row(e.slot, T0 + k * 1000)]); max = Math.max(max, rows.length); }
    dit(max === 24 && rows.every((r) => M.slotDe(r.id) != null), 'G6 100 points de suite ⇒ jamais plus de 24 lignes', `max=${max}`);
    dit(M.pointDuJourManque(null, T0) === false, 'G7 liste « pas su » ⇒ pas de point du jour (rien sur un pas su)');
    dit(M.pointDuJourManque([], T0) === true && M.pointDuJourManque([row(0, T0 - 3600e3)], T0) === false && M.pointDuJourManque([row(0, T0 - 864e5)], T0) === true, 'G8 un point du jour : seulement si aucun point aujourd’hui (heure de Paris)');
    const snap = M.instantane(magasin(base).lire);
    const l = M.lignePoint({ snap, raison: 'serie', libelle: 'Saisie en série', maintenant: T0, rev: 3 });
    dit(l && l.rev === 4 && l.at === new Date(T0).toISOString() && l.raison === 'serie' && typeof l.empreinte === 'string', 'G9 la ligne d’un point : rev + 1, date, raison, empreinte');
    dit(Object.entries(l).filter(([k, v]) => k !== 'snap' && k !== 'annulation').every(([, v]) => v === null || typeof v !== 'object'), 'G10 tout ce que la liste lit est un SCALAIRE de premier niveau (la colonne `meta`)');
    dit(M.pointInutile([{ empreinte: l.empreinte, annulable: false }], snap) === true && M.pointInutile([{ empreinte: l.empreinte, annulable: true }], snap) === false, 'G11 deux points identiques de suite n’en font qu’un (sauf un point d’annulation)');
    const gros = { ...snap, fiches: {} }; for (let i = 0; i < 9000; i++) gros.fiches['f' + i] = { buyPrice: 1, buyFromId: 'x'.repeat(100), numero: String(i) };
    dit(M.lignePoint({ snap: gros, raison: 'jour', maintenant: T0 }) === null, 'G12 un point trop gros n’est pas écrit (et c’est dit)');
    dit(M.pointSuivant([{ at: '2026-11-03T00:00:00Z', slot: 3 }, { at: '2026-11-02T00:00:00Z', slot: 2 }, { at: '2026-11-01T00:00:00Z', slot: 1 }], { at: '2026-11-01T00:00:00Z' }).slot === 2, 'G13 le point suivant d’un point (pour juger « retouché depuis »)');
  }

  // ── H. Un fichier de sauvegarde complète ──
  if (section('H')) {
    const keys = C(base); keys.vrm_numerotation = { version: 1 };
    const f1 = M.instantaneFichier({ _cancale_backup: 3, exportDate: '2026-11-01T10:00:00Z', keys }, 1);
    dit(f1.ok && f1.snap.fiches.it1.numero === '1' && !f1.numerosFermes, 'H1 un fichier de la même numérotation : ses N° comptent');
    const f2 = M.instantaneFichier({ _cancale_backup: 3, keys: { ...keys, vrm_numerotation: { version: 0 } } }, 1);
    dit(f2.ok && f2.numerosFermes && Object.values(f2.snap.fiches).every((f) => f.numero === undefined), 'H2 un fichier d’AVANT la remise à zéro (013) ne rend aucun N°');
    dit(!M.instantaneFichier({ catalog: [] }, 1).ok, 'H3 un fichier qui n’est pas une sauvegarde complète est refusé');
  }

  // ── I. Le branchement ──
  if (section('I') && !process.env.RESTAURATION_MODULE) {
    const app = sansCommentaires(lireF('src/App.jsx'));
    const reg = sansCommentaires(lireF('src/ecrans/Reglages.jsx'));
    const bloc = (deb, fin) => { const i = app.indexOf(deb); const j = app.indexOf(fin, i + deb.length); return i >= 0 && j > i ? app.slice(i, j) : ''; };
    dit(/useEffect\(\(\) => \{ if \(fillBuyOpen\) pointAvant\('serie'/.test(app), 'I1 un point AVANT la saisie en série des prix');
    dit(/onImporter: \(\{ achats, couts \}\) => \{\s*pointAvant\('import'/.test(app), 'I2 un point AVANT l’import d’un tableur d’achats');
    dit(/pointAvant\('serie', `Répartition d’un lot[^`]*`\);\s*for \(const x of w\.ecritures\) poserPatchAchat/.test(app), 'I3 un point AVANT la répartition d’un lot');
    dit(/const pt=await poserPoint\('import'[^;]*;\s*if\(!pt\.ok\)\{[^}]*return; \}/.test(app), 'I4 l’import d’une sauvegarde complète n’écrit RIEN sans son point');
    const rm = bloc('const restaurerMorceaux = async', 'const annulerRestauration');
    dit(/poserPoint\('restauration'[\s\S]*if \(!pt\.ok\) return[\s\S]*ecrireRestauration/.test(rm), 'I5 une restauration pose d’abord SON point (l’inverse), sinon rien ne s’écrit');
    const lp = bloc('const listerPointsServeur = async', 'const lirePointServeur');
    dit(/select=id,meta&id=like\.\$\{PREFIXE_POINT\}\*/.test(lp) && !/select=data/.test(lp), 'I6 la liste des points se lit par `meta` (jamais `select=data`, §4.4)');
    const lu = bloc('const lirePointServeur = async', 'const ecrirePointServeur');
    dit(/select=data&id=eq\.\$\{idPoint\(slot\)\}/.test(lu), 'I7 un point entier n’est lu que par SON id, à son ouverture');
    const pp = bloc('const poserPoint = (', 'const pointAvant');
    const jour = bloc('// Le point du jour', 'const numerosPortesAilleurs');
    dit(pp && !/localStorage/.test(pp) && /listerPointsServeur\(\)/.test(pp) && /choisirEmplacement\(rows/.test(pp), 'I8 l’emplacement se choisit sur la liste du SERVEUR (aucun localStorage)');
    dit(/pointDuJourManque\(rows\)/.test(app) && !/localStorage/.test(jour.replace(/[\s\S]*onCloudReady/, '')), 'I9 le point du jour se décide sur la liste du serveur, jamais sur un drapeau de l’appareil');
    dit(/if \(!isCloudReady\(\) \|\| !AUTH\.user\?\.id\) return Promise\.resolve\(\{ ok: false, raison: 'nuage' \}\)/.test(pp), 'I10 pas de point avant que le nuage soit lu (§4.1)');
    const ep = bloc('const ecrirePointServeur = async', 'const _pointsAbonnes');
    dit(/data->>rev=eq\.\$\{rev\}/.test(ep) && /withOwner\(\{ id, data \}\)/.test(ep), 'I11 l’écriture d’un point : comparer-et-échanger sur `data.rev`, sous SON propriétaire');
    const sk = (() => { const i = app.indexOf('const SYNC_KEYS = ['); return app.slice(i, app.indexOf('];', i)); })();
    dit(!/restore_/.test(sk), 'I12 les points ne sont PAS dans la ligne `main` (SYNC_KEYS)');
    dit(/ecrireRestauration\(\{ morceaux: ms, lire: lireCleRestauration, ecrire: ecrireCleCorbeille/.test(rm), 'I13 les clés s’écrivent par l’écrivain de la corbeille (comparer-et-échanger de `cloudPush`)');
    dit(/id:'revenir', type:'panneau'[^\n]*el:<RevenirEnArriere\/>/.test(reg), 'I14 Paramètres → Sécurité et sauvegarde → « Revenir en arrière » est monté');
    const mig = fs.readdirSync(path.join(R, 'supabase', 'migrations')).find((f) => /^033-/.test(f));
    const sql = mig ? lireF(path.join('supabase', 'migrations', mig)) : '';
    dit(!!mig && /restore_/.test(sql) && /< *24|>= *24/.test(sql) && /octet_length/.test(sql), 'I15 migration 033 : la base refuse un emplacement hors des 24 et un point trop gros', mig || 'absente');
    dit(Object.keys(M.REGLAGES).every((k) => !/numer|offres_auto|retrait_auto|repond_auto|token|cle/.test(k)), 'I16 aucun réglage de numérotation, de jeton, ni interrupteur qui agit sur un site');
  }

  console.log(`\n${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
