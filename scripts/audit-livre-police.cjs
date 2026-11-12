// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LE LIVRE DE POLICE (10 novembre, lot R)
//         node scripts/audit-livre-police.cjs [--mutation=…]
//         node scripts/audit-livre-police.cjs --prouve   (chaque mutation doit rougir)
// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTE src/livrePolice.js sur la VRAIE sortie de `registreDesAchats`
// (src/registres.js), sur des achats INVENTÉS (le dépôt est public). Exige :
//   P1. proposé seulement à un statut PRO choisi (micro, société, marge) —
//       jamais à un particulier, à un statut pas choisi ou pas lu ;
//   P2. le n° d'ordre : continu à partir du dernier, dans l'ordre des dates,
//       jamais changé, jamais réattribué ; un achat arrivé plus tard (même daté
//       avant) prend le numéro SUIVANT ; réinscrire ne change rien ;
//   P3. un achat inscrit puis annulé garde son numéro et sa ligne ;
//   P4. un état abîmé (deux achats sous un numéro) n'inscrit RIEN ;
//   P5. le pseudo du vendeur : la transaction lue CÔTÉ ACHETEUR seulement ;
//       pas lu ⇒ « à compléter » et « Pas lu » nommé ;
//   P6. l'identité civile est TOUJOURS « à compléter » (aucune plateforme ne la
//       donne) ; jamais le mot « conforme » (module, tableur, PDF) ; l'export dit
//       que le fichier ne garantit pas l'intégrité (R321-6) ;
//   P7. une ligne du livre = une ligne du registre des achats (même règle) ;
//   P8. l'écriture : comparer-et-échanger sur `data.rev` ; une lecture ratée
//       n'écrit RIEN ; deux appareils ne donnent jamais un numéro deux fois ;
//   P9. l'écran : monté dans Argent → Déclarer, pas proposé hors statut pro,
//       pseudos lus en PROJECTION (jamais `select=data`) ; sources citées.
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const R0 = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R0, f), 'utf8'); } catch (_) { return ''; } };
let MOD = lire('src/livrePolice.js'), CARTE = lire('src/LivrePoliceCarte.jsx'), COMPTA = lire('src/ecrans/Compta.jsx');
const REG = lire('src/registres.js'), PRIX = lire('src/prixAchatPropose.js');
const muter = (quoi, avant, apres) => {
  const s = quoi === 'carte' ? CARTE : quoi === 'compta' ? COMPTA : MOD;
  if (!s.includes(avant)) { console.log('❌ mutation impossible : motif absent — ' + avant.slice(0, 90)); process.exit(2); }
  const n = s.replace(avant, apres);
  if (quoi === 'carte') CARTE = n; else if (quoi === 'compta') COMPTA = n; else MOD = n;
};
const MUTS = {
  renumerote: () => muter('mod', 'const ordre = { ...e.ordre };\n  let dernier = e.dernier;', 'const ordre = {};\n  let dernier = 0;\n  for (const l of [...Object.keys(e.ordre).map((id) => ({ id, ts: e.ordre[id].ts, titre: e.ordre[id].t }))].sort((a, b) => a.ts - b.ts)) { dernier += 1; ordre[l.id] = { ...e.ordre[l.id], n: dernier }; }'),
  trou: () => muter('mod', 'const dernier = Number.isSafeInteger(d.dernier) && d.dernier >= max ? d.dernier : null;', 'const dernier = max;'),
  side: () => muter('mod', "if (!r || r.side !== 'buyer') return '';", "if (!r) return '';"),
  conforme: () => muter('mod', "'Établi par VRM à partir de tes achats : à vérifier et à compléter.',", "'Registre conforme, établi par VRM.',"),
  identite: () => muter('mod', 'identite: lignes.length,', 'identite: 0,'),
  particulier: () => muter('mod', "const STATUTS_PRO = new Set(['micro', 'societe', 'marge']);", "const STATUTS_PRO = new Set(['micro', 'societe', 'marge', 'particulier']);"),
  abime: () => muter('mod', "if (!id || !e || !Number.isSafeInteger(e.n) || e.n < 1 || vus.has(e.n)) return null;", "if (!id || !e || !Number.isSafeInteger(e.n) || e.n < 1) return null;"),
  cas: () => muter('mod', "const garde = rev == null ? 'data->>rev=is.null' : `data->>rev=eq.${rev}`;", "const garde = 'select=id';"),
  'lecture-ko': () => muter('mod', "    if (!lu) return { ok: false, raison: 'pasLu' };\n    if (!lu.etat)", "    const lu2 = lu || { existe: false, etat: etatVide() };\n    if (!lu2.etat)"),
  disparu: () => muter('mod', 'if (presents.has(id) || !e || !dansPeriode(e.ts)) continue;', 'continue;'),
  projection: () => muter('carte', 'select=id,tx:data->payload->transaction->>id,side:data->payload->transaction->>user_side,vendeur:data->payload->transaction->seller->>login', 'select=id,data'),
  montee: () => muter('compta', '<LivrePoliceCarte lireAchats={lireAchatsRegistre} registreDe={registreAchatsDe} panelOff={panelOff} />', ''),
  garde: () => muter('carte', '  if (!livrePolicePropose(profil)) return null;\n', ''),
  // (11 nov., C7) Un champ pour saisir l'identité ; la phrase retirée.
  'saisie-identite': () => muter('carte', '<div data-livre-identite-export=""', '<input aria-label="Identité du vendeur"/><div data-livre-identite-export=""'),
  'phrase-tue': () => muter('carte', 'L’identité des vendeurs se remplit sur l’export, pas dans VRM.', ''),
};
if (MUT === 'lecture-ko') {
  // la mutation remplace `lu` par `lu2` dans la suite
  MUTS['lecture-ko'](); MOD = MOD.replace('const neuf = inscrire(lu.etat, lignes, { maintenant });', 'const neuf = inscrire(lu2.etat, lignes, { maintenant });').replace('const nouveaux = neuf.dernier - lu.etat.dernier;\n    if (!nouveaux) return { ok: true, etat: lu.etat, nouveaux: 0 };\n    const rev = lu.etat.rev;', 'const nouveaux = neuf.dernier - lu2.etat.dernier;\n    if (!nouveaux) return { ok: true, etat: lu2.etat, nouveaux: 0 };\n    const rev = lu2.etat.rev;').replace('if (!lu.existe) {', 'if (!lu2.existe) {');
} else if (MUT && MUTS[MUT]) MUTS[MUT]();
else if (MUT) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }
if (process.argv.includes('--prouve')) {
  const { spawnSync } = require('child_process');
  let pris = 0; const T = Object.keys(MUTS);
  for (const m of T) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8', env: process.env });
    const rouges = (r.stdout.match(/^ {2}❌ /gm) || []).length;
    const okM = r.status !== 0 && rouges > 0; if (okM) pris++;
    console.log(`${okM ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
  }
  console.log(`\n${pris}/${T.length} mutations attrapées.`);
  process.exit(pris === T.length ? 0 : 1);
}
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-livre-police-'));
  let P = null, RG = null;
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    fs.writeFileSync(path.join(dir, 'prixAchatPropose.js'), PRIX);
    fs.writeFileSync(path.join(dir, 'registres.js'), REG);
    fs.writeFileSync(path.join(dir, 'dateParis.js'), lire('src/dateParis.js'));   // (11 nov.) importé par registres.js
    fs.writeFileSync(path.join(dir, 'livrePolice.js'), MOD.replace("await import('pdf-lib')", `await import('${'file://' + path.join(R0, 'node_modules', 'pdf-lib', 'cjs', 'index.js').replace(/\\/g, '/')}')`));
    RG = await import('file://' + path.join(dir, 'registres.js'));
    P = await import('file://' + path.join(dir, 'livrePolice.js'));
  } catch (e) { dit(false, 'les modules se chargent', e.message); }
  dit(!!P && typeof P.livreDePolice === 'function' && typeof P.inscrire === 'function', 'src/livrePolice.js : livreDePolice et inscrire existent');
  if (!P || !RG || typeof P.livreDePolice !== 'function') { console.log(`\n❌ livre de police : ${ko} rouge(s), ${ok} vert(s)`); process.exit(1); }

  // ── P1 · à qui ──
  const pf = (etat) => ({ etat });
  dit(['micro', 'societe', 'marge'].every((e) => P.livrePolicePropose(pf(e))), 'P1 · proposé à micro, société, marge');
  dit(!['particulier', 'aChoisir', 'inconnu', 'encours', undefined].some((e) => P.livrePolicePropose(pf(e))) && !P.livrePolicePropose(null), 'P1 · jamais à un particulier, à un statut pas choisi ou pas lu');

  // ── Les achats INVENTÉS ──
  const D = (m, j) => new Date(2026, m, j, 12).toISOString();
  const ach = (uid, tx, eur, date, statut = 'Transaction finalisée', titre = 'Baskets inventées') => ({ transaction_id: tx, title: titre, price: { amount: String(eur), currency_code: 'EUR' }, status: statut, date, _uid: uid, compte: 'compte_' + uid });
  let achats = [ach('111', 7001, 40, D(9, 3)), ach('111', 7002, 25, D(9, 1), 'Transaction finalisée', 'Baskets inventées'), ach('222', 7003, 60, D(9, 25))];
  const hors = [{ id: 'h1', title: 'Paire en main propre', price: '30', date: '2026-10-20', source: 'Main propre', numero: '9' }];
  const reg = (periode, a = achats) => RG.registreDesAchats({ achats: a, hors, fiches: {}, periode, montantHors: (b) => Number(b.price), sourceHors: (s) => s });
  const tous = (a = achats) => reg('2026', a).lignes;

  // ── P2 · le n° d'ordre ──
  let E = P.inscrire(P.etatVide(), tous(), { maintenant: Date.UTC(2026, 10, 10) });
  const n = (id) => E.ordre[id] && E.ordre[id].n;
  dit(E && E.dernier === 4 && n('vinted:7002') === 1 && n('vinted:7001') === 2 && n('hors:h1') === 3 && n('vinted:7003') === 4, 'P2 · inscription continue, dans l’ordre des dates d’achat', JSON.stringify(E && Object.fromEntries(Object.entries(E.ordre).map(([k, v]) => [k, v.n]))));
  const E2 = P.inscrire(E, tous());
  dit(E2 && E2.dernier === 4 && JSON.stringify(E2.ordre) === JSON.stringify(E.ordre), 'P2 · réinscrire ne change rien');
  achats = [...achats, ach('111', 7000, 15, D(8, 20))];   // un achat de SEPTEMBRE, arrivé après
  const E3 = P.inscrire(E2, tous());
  dit(E3 && E3.ordre['vinted:7000'] && E3.ordre['vinted:7000'].n === 5 && ['vinted:7002', 'vinted:7001', 'hors:h1', 'vinted:7003'].every((id) => E3.ordre[id].n === E.ordre[id].n), 'P2 · un achat arrivé plus tard prend le numéro SUIVANT, les autres ne bougent pas', JSON.stringify(E3 && Object.fromEntries(Object.entries(E3.ordre).map(([k, v]) => [k, v.n]))));
  // un numéro n'est jamais rendu : un état dont le dernier achat a été retiré à la main garde « dernier »
  const sansDernier = { ...E3, ordre: Object.fromEntries(Object.entries(E3.ordre).filter(([k]) => k !== 'vinted:7000')) };
  const E4 = P.inscrire(sansDernier, [...tous(), { id: 'hors:neuf', ts: Date.parse(D(10, 9)), titre: 'Neuve' }]);
  dit(E4 && E4.ordre['hors:neuf'] && E4.ordre['hors:neuf'].n >= 6, 'P2 · un numéro donné n’est jamais redonné (on repart après le dernier, pas du plus haut restant)', E4 && JSON.stringify(E4.ordre['hors:neuf']));

  // ── P3 · un achat annulé après inscription ──
  const achatsAnnule = achats.map((o) => (o.transaction_id === 7001 ? { ...o, status: 'Commande annulée' } : o));
  const Loct = P.livreDePolice({ registre: reg('2026-10', achatsAnnule), etat: P.etatLu(E3), pseudos: new Map(), dansPeriode: (ts) => new Date(ts).getMonth() === 9 });
  const l7001 = Loct && Loct.lignes.find((l) => l.id === 'vinted:7001');
  dit(!!l7001 && l7001.n === 2 && /plus dans tes achats/.test(l7001.note), 'P3 · annulé après inscription : son n° et sa ligne restent', JSON.stringify(l7001));

  // ── P4 · état abîmé ──
  const abime = { v: 1, dernier: 3, ordre: { a: { n: 1 }, b: { n: 1 } } };
  dit(P.etatLu(abime) === null && P.inscrire(abime, tous()) === null, 'P4 · deux achats sous un même numéro : état illisible, RIEN n’est inscrit');
  dit(P.etatLu({ v: 1, dernier: 1, ordre: { a: { n: 1 }, b: { n: 2 } } }) === null, 'P4 · un numéro au-delà du dernier : illisible');

  // ── P5 · le pseudo ──
  dit(P.pseudoVendeurTx({ side: 'buyer', vendeur: 'vendeuse_inventee' }) === 'vendeuse_inventee', 'P5 · transaction côté acheteur : le pseudo du vendeur');
  dit(P.pseudoVendeurTx({ side: 'seller', vendeur: 'moi_meme' }) === '' && P.pseudoVendeurTx({ vendeur: 'x' }) === '', 'P5 · lue côté vendeur, ou côté inconnu : aucun pseudo');
  const ids = P.idsTransactions(reg('2026-10').lignes, (tx) => (tx === '7003' ? '222' : '111'));
  dit(JSON.stringify(ids) === JSON.stringify(['harvest_111_txn_7001', 'harvest_111_txn_7002', 'harvest_222_txn_7003']), 'P5 · les transactions lues sont celles des achats Vinted de la période', JSON.stringify(ids));
  const Lp = P.livreDePolice({ registre: reg('2026-10'), etat: P.etatLu(E3), pseudos: new Map([['7003', 'vendeuse_inventee']]), dansPeriode: () => false });
  const lp3 = Lp.lignes.find((l) => l.id === 'vinted:7003'), lp1 = Lp.lignes.find((l) => l.id === 'vinted:7001');
  dit(/vendeuse_inventee/.test(lp3.vendeur) && lp1.vendeur === '', 'P5 · le pseudo lu est écrit ; pas lu ⇒ vide (« à compléter » à l’export)', `${lp3.vendeur} · «${lp1.vendeur}»`);
  const LpKO = P.livreDePolice({ registre: reg('2026-10'), etat: P.etatLu(E3), pseudos: null });
  dit(LpKO.pasLu.some((x) => /pseudo/.test(x)), 'P5 · pseudos pas lus : dit « pas lu »', JSON.stringify(LpKO.pasLu));

  // ── P6 · identité, jamais « conforme », R321-6 ──
  dit(Lp.manque.identite === Lp.n && Lp.n > 0, 'P6 · l’identité civile manque sur TOUTES les lignes (aucune plateforme ne la donne)', `${Lp.manque.identite}/${Lp.n}`);
  const csv = P.csvLivre(Lp, { entreprise: { nom: 'Entreprise inventée', siret: '00000000000000' }, maintenant: Date.UTC(2026, 10, 10) });
  const C = csv.replace(/^﻿/, '').split(/\r\n/).map((r) => r.split(';'));
  const iH = C.findIndex((r) => r[0] === 'N° d’ordre');
  const corps = C.slice(iH + 1).filter((r) => r.length > 1);
  const iId = C[iH] ? C[iH].indexOf('Identité du vendeur') : -1;
  dit(iH > 0 && corps.length === Lp.n && corps.every((r) => r[iId] === 'à compléter'), 'P6 · tableur : une ligne par achat, identité « à compléter » partout', `${corps.length}/${Lp.n}`);
  let pdfTxt = '';
  try {
    const octets = await P.pdfLivre(Lp, { entreprise: { nom: 'Entreprise inventée' }, maintenant: Date.UTC(2026, 10, 10) });
    dit(octets && octets.length > 500 && Buffer.from(octets.slice(0, 5)).toString() === '%PDF-', 'P6 · le PDF se crée (dans le navigateur, pdf-lib)');
    try {
      const pdfjs = await import('file://' + path.join(R0, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs'));
      const doc = await pdfjs.getDocument({ data: new Uint8Array(octets), isEvalSupported: false, useSystemFonts: false, standardFontDataUrl: path.join(R0, 'node_modules', 'pdfjs-dist', 'standard_fonts') + '/' }).promise;
      for (let i = 1; i <= doc.numPages; i++) { const tc = await (await doc.getPage(i)).getTextContent(); pdfTxt += tc.items.map((x) => x.str).join(' ') + '\n'; }
    } catch (_) { pdfTxt = ''; }
  } catch (e) { dit(false, 'P6 · le PDF se crée', e.message); }
  const code = sansCommentaires(MOD);
  dit(!/conform/i.test(code + csv + pdfTxt), 'P6 · jamais « conforme » (code, tableur, PDF)');
  dit(/R321-6/.test(csv) && (!pdfTxt || /R321-6/.test(pdfTxt)), 'P6 · l’export dit que le fichier ne garantit pas l’intégrité (R321-6)');
  dit(!pdfTxt || /a completer|à compléter/i.test(pdfTxt), 'P6 · le PDF dit « à compléter »');

  // ── P7 · une ligne = une ligne du registre des achats ──
  const R10 = reg('2026-10');
  dit(JSON.stringify(Lp.lignes.map((l) => l.id).sort()) === JSON.stringify(R10.lignes.map((l) => l.id).sort()), 'P7 · les lignes du livre = celles du registre des achats (même règle)');
  const lh = Lp.lignes.find((l) => l.id === 'hors:h1');
  dit(lh && lh.vendeur === '' && /Main propre/.test(lh.provenance), 'P7 · hors plateforme : la source est la provenance, jamais un vendeur', JSON.stringify(lh && [lh.vendeur, lh.provenance]));

  // ── P8 · l'écriture (comparer-et-échanger) ──
  const base = () => {
    const B = { row: null, ecritures: 0, lectureKO: false };
    B.fetcher = async (url, o = {}) => {
      const m = (o.method || 'GET').toUpperCase();
      if (m === 'GET') { if (B.lectureKO) return { ok: false, status: 522, json: async () => null }; return { ok: true, json: async () => (B.row ? [JSON.parse(JSON.stringify(B.row))] : []) }; }
      if (m === 'POST') { if (B.row) return { ok: false, status: 409, json: async () => null }; B.row = JSON.parse(o.body)[0]; B.ecritures++; return { ok: true, json: async () => null }; }
      if (m === 'PATCH') {
        const g = /data->>rev=eq\.(\d+)/.exec(url), gNull = /data->>rev=is\.null/.test(url);
        const rev = B.row && B.row.data && Number.isSafeInteger(B.row.data.rev) ? B.row.data.rev : null;
        const passe = B.row && ((g && Number(g[1]) === rev) || (gNull && rev === null) || (!g && !gNull));
        if (!passe) return { ok: true, json: async () => [] };
        if (B.avant) { const f = B.avant; B.avant = null; await f(); return B.fetcher(url, o); }
        B.row = { ...B.row, data: JSON.parse(o.body).data }; B.ecritures++; return { ok: true, json: async () => [{ id: 'x' }] };
      }
      return { ok: false, status: 400, json: async () => null };
    };
    return B;
  };
  const deps = (B) => ({ url: 'https://base.invalid', entetes: () => ({}), avecOwner: (r) => r, owner: 'o', cloisonne: true, fetcher: B.fetcher });
  const B1 = base(); B1.lectureKO = true;
  const rKO = await P.inscrireEnBase(tous(), deps(B1));
  dit(!rKO.ok && B1.ecritures === 0, 'P8 · lecture ratée : RIEN n’est écrit', JSON.stringify(rKO));
  const B2 = base();
  const r1 = await P.inscrireEnBase(tous(), deps(B2));
  dit(r1.ok && r1.nouveaux === 5 && B2.row && B2.row.data.dernier === 5 && B2.row.data.rev === 1, 'P8 · première inscription : ligne créée, rev 1', JSON.stringify(r1 && { ok: r1.ok, n: r1.nouveaux }));
  // Un autre appareil inscrit un achat ENTRE la lecture et l'écriture de celui-ci.
  B2.avant = async () => { const d = { ...B2.row.data, ordre: { ...B2.row.data.ordre, 'hors:autre': { n: B2.row.data.dernier + 1, ts: 1, t: 'Autre appareil' } }, dernier: B2.row.data.dernier + 1, rev: B2.row.data.rev + 1 }; B2.row = { ...B2.row, data: d }; };
  const r2 = await P.inscrireEnBase([...tous(), { id: 'hors:ici', ts: Date.parse(D(10, 9)), titre: 'Ici' }], deps(B2));
  const nums = Object.values(B2.row.data.ordre).map((e) => e.n);
  dit(r2.ok && new Set(nums).size === nums.length && (B2.row.data.ordre['hors:autre'] || {}).n === 6 && (B2.row.data.ordre['hors:ici'] || {}).n === 7, 'P8 · deux appareils en même temps : aucun numéro donné deux fois, rien d’effacé', JSON.stringify(Object.fromEntries(Object.entries(B2.row.data.ordre).map(([k, v]) => [k, v.n]))));

  // ── P9 · l'écran ──
  const carte = sansCommentaires(CARTE), compta = sansCommentaires(COMPTA);
  dit(/<LivrePoliceCarte[^>]*registreDe=\{registreAchatsDe\}/.test(compta) && /data-argent-vue="declarer"[\s\S]*<LivrePoliceCarte[\s\S]*data-argent-vue="factures"/.test(compta), 'P9 · monté dans Argent → Déclarer, avec le registre des achats');
  dit(/if \(!livrePolicePropose\(profil\)\) return null;/.test(carte), 'P9 · la carte ne s’affiche qu’à un statut pro');
  dit(/user_side/.test(carte) && /seller->>login/.test(carte) && !/select=data\b(?!->)/.test(carte) && !/select=id,data/.test(carte), 'P9 · pseudos lus en projection (jamais select=data)');
  dit(!/conform/i.test(carte), 'P9 · l’écran ne dit jamais « conforme »');
  // (11 nov., décision C7) L'identité des vendeurs (données de tiers) ne se saisit JAMAIS dans VRM :
  // aucun champ de saisie dans la carte (seul le choix de période), rien d'identité écrit en base,
  // et l'écran le dit en UNE phrase (data-livre-identite-export).
  const champs = (carte.match(/<(input|textarea)\b/g) || []).length;
  dit(champs === 0, 'P10 · (C7) aucun champ pour saisir l’identité d’un vendeur dans VRM', `${champs} champ(s)`);
  dit(!/identite\s*:/.test((/export async function inscrireEnBase[\s\S]*?\n}\n/.exec(sansCommentaires(MOD)) || [''])[0]), 'P10 · (C7) rien d’identité n’est écrit dans la ligne du livre');
  const phrase = (/data-livre-identite-export=""[^>]*>([^<]+)</.exec(carte) || [])[1] || '';
  dit(/export/.test(phrase) && /pas dans VRM/.test(phrase) && phrase.trim().split(/\s+/).length <= 12, 'P10 · (C7) l’écran le dit en une phrase courte', phrase);
  dit(/legifrance\.gouv\.fr\/codes\/article_lc\/LEGIARTI000025213232/.test(MOD) && /F39552/.test(MOD) && /R321-3/.test(MOD), 'P9 · sources officielles citées dans le module');

  console.log(ko ? `\n❌ livre de police : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ livre de police : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();
