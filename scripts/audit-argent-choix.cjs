// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LES QUATRE CHOIX D'ARGENT (14 nov., lot argent-choix)
//   75 coller « N° ; prix »   · 80 modèle et taille, « à racheter »
//   81 objectif du mois (reçu, € par jour) · 82 déclaration annuelle avec sa source
// Il EXÉCUTE les vraies règles (src/collerPrixAchat.js, src/quoiRacheter.js,
// src/objectifMois.js + src/design/carteChiffres.js, src/declarationAnnuelle.js) sur
// une base INVENTÉE (le dépôt est public). Lecture seule.
//   A. le parseur du collage : 56 lignes, dont les pièges (N° en double, « 007 »,
//      prix vide, N° inconnu, deux fiches, colonnes, « 60 70 », en-tête…) ;
//   B. l'aperçu et l'écriture : rien d'écrit sur une base pas lue ; un prix différent
//      jamais remplacé sans « Remplacer » ; une fiche changée depuis l'aperçu pas écrite ;
//      dans l'app, l'écriture passe par `ecriturePrixSaisi` et s'arrête sans base chargée ;
//   C. modèle × taille : sur les ventes RELIÉES seulement, couverture, « à racheter » ;
//   D. objectif sur le reçu : la case « Reçu » du mois, € par jour d'ici le dernier jour ;
//   E. la déclaration : montant = `declarationRevenus`, source recomposée, hors total nommé,
//      statut jamais deviné.
// Lancer : node scripts/audit-argent-choix.cjs [--mutation=<nom>]  (rouge exigé sur une mutation)
//   mutations : cle deux conflit colonnes forme lu remplacer cas app reliees racheter recu parjour source regime
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; if (!c || process.env.BAVARD) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };

// Une copie de src/ (la mutation s'y applique, jamais au dépôt).
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ac-'));
fs.cpSync(path.join(R, 'src'), path.join(T, 'src'), { recursive: true, filter: (s) => !/\.(png|jpe?g|webp|mp4|onnx|woff2?)$/i.test(s) });
fs.writeFileSync(path.join(T, 'package.json'), '{"type":"module"}');
const MUTS = {
  cle: ['src/collerPrixAchat.js', 'const cle = cleNumero(numero);', 'const cle = numero.toUpperCase();'],
  deux: ['src/collerPrixAchat.js', "if (f.length > 1) return { ...l, etat: 'deux', nFiches: f.length };", ''],
  conflit: ['src/collerPrixAchat.js', "if (new Set(memes.map((x) => x.centimes)).size > 1) return { ...l, etat: 'conflit' };", ''],
  colonnes: ['src/collerPrixAchat.js', "if (pleines.length > 2) return { ...base, etat: 'colonnes' };", ''],
  forme: ['src/collerPrixAchat.js', "  if (!formePrix(cellule)) return { etat: 'illisible' };\n", ''],
  lu: ['src/collerPrixAchat.js', "if (!lu || typeof fichesDe !== 'function') return { lu: false,", "if (typeof fichesDe !== 'function') return { lu: false,"],
  remplacer: ['src/collerPrixAchat.js', "(l.etat === 'ok' || (remplacer && l.etat === 'different'))", "(l.etat === 'ok' || l.etat === 'different')"],
  cas: ['src/collerPrixAchat.js', 'if (!fiche || maintenant !== w.avant) { changees += 1; continue; }', 'if (!fiche) { changees += 1; continue; }'],
  reliees: ['src/quoiRacheter.js', 'const reliees = lignes.filter(connu);', 'const reliees = lignes;'],
  racheter: ['src/quoiRacheter.js', ' && g.mediane <= seuil.mediane)', ')'],
  recu: ['src/design/carteChiffres.js', "ventes: 'ventes', recu: 'recu' };", "ventes: 'ventes', recu: 'vendu' };"],
  parjour: ['src/objectifMois.js', 'Math.ceil((eur ? Math.round(reste * 100) / 100 : reste) / jours - 1e-9)', 'Math.round((eur ? Math.round(reste * 100) / 100 : reste) / jours)'],
  source: ['src/declarationAnnuelle.js', 'const totalC = caMoisC + (sur ? c(sur.ca) : 0);', 'const totalC = caMoisC;'],
  regime: ['src/declarationAnnuelle.js', "  if (regime == null) return { etat: 'statut' };\n", ''],
};
if (MUT && MUT !== 'app') {
  const m = MUTS[MUT];
  if (!m) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }
  const f = path.join(T, m[0]); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(m[1])) { console.log('❌ mutation impossible : motif absent — ' + m[1].slice(0, 90)); process.exit(2); }
  fs.writeFileSync(f, s.replace(m[1], m[2]));
}
const imp = (f) => import(pathToFileURL(path.join(T, f)).href).catch((e) => { dit(false, `${f} se charge`, String(e.message).slice(0, 160)); return {}; });

(async () => {
  const CP = await imp('src/collerPrixAchat.js');
  const QR = await imp('src/quoiRacheter.js');
  const CQ = await imp('src/ceQuiRapporte.js');
  const OB = await imp('src/objectifMois.js');
  const CC = await imp('src/design/carteChiffres.js');
  const DA = await imp('src/declarationAnnuelle.js');
  const ME = await imp('src/microEntreprise.js');

  // ── A. Le parseur ─────────────────────────────────────────────────────────
  console.log('── A. Le collage, ligne par ligne');
  const L = CP.lireLigneCollee || (() => null);
  // [texte, état, clé, centimes]
  const CAS = [
    ['12;60', 'ok', '12', 6000], ['12 ; 60', 'ok', '12', 6000], ['12;60,50', 'ok', '12', 6050], ['12;60.50', 'ok', '12', 6050],
    ['12;60 €', 'ok', '12', 6000], ['12;60€', 'ok', '12', 6000], ['12 ; 60,50 €', 'ok', '12', 6050], ['12\t60', 'ok', '12', 6000],
    ['12\t60,5', 'ok', '12', 6050], ['12\t\t60', 'ok', '12', 6000], ['12\t60\t', 'ok', '12', 6000], ['12,60', 'ok', '12', 6000],
    ['12, 60', 'ok', '12', 6000], ['12,60,50', 'ok', '12', 6050], ['12 60', 'ok', '12', 6000], ['12   60', 'ok', '12', 6000],
    ['12 60 €', 'ok', '12', 6000], ['12 : 60', 'ok', '12', 6000], ['#14 = 30', 'ok', '14', 3000], ['N°12 60', 'ok', '12', 6000],
    ['N° 12 ; 60', 'ok', '12', 6000], ['n°12;60', 'ok', '12', 6000], ['007;60', 'ok', '7', 6000], ['007 60', 'ok', '7', 6000],
    ['0012\t45', 'ok', '12', 4500], ['B125;45,50', 'ok', 'B125', 4550], ['b125 45', 'ok', 'B125', 4500], ['B 125 45', 'ok', 'B125', 4500],
    ['B-125;45', 'ok', 'B125', 4500], ['C0123;10', 'ok', 'C0123', 1000], ['12;1 250,00', 'ok', '12', 125000], ['12;1.250,00', 'ok', '12', 125000],
    ['12;1,250.00', 'ok', '12', 125000], ['12;0', 'ok', '12', 0], ['12|60', 'ok', '12', 6000], ['  12 ; 60  ', 'ok', '12', 6000],
    ['12;', 'vide', '12', null], ['12', 'vide', '12', null], ['12 ;   ', 'vide', '12', null], ['12\t', 'vide', '12', null],
    ['12;abc', 'illisible', '12', null], ['12 60 70', 'illisible', '12', null], ['12;-5', 'illisible', '12', null], ['12;60,505', 'illisible', '12', null],
    ['12;2x30', 'illisible', '12', null], ['12;environ 60', 'illisible', '12', null], ['x;y', 'illisible', '', null], ['Nike Dunk 60', 'illisible', '', null],
    ['12.5 6', 'illisible', '', null], ['ABCD12;60', 'illisible', '', null], ['1234567;60', 'illisible', '', null],
    ['12;Nike Dunk;60', 'colonnes', '', null], ['12\tAir Max 90\t60', 'colonnes', '', null], ['12;60;70', 'colonnes', '', null],
    ['N°;Prix', 'entete', '', null], ['numéro prix', 'entete', '', null],
  ];
  let bons = 0; const faux = [];
  for (const [t, e, k, c] of CAS) {
    const r = L(t) || {};
    const bon = r.etat === e && (k === '' || r.cle === k) && (c == null ? r.centimes == null : r.centimes === c);
    if (bon) bons++; else faux.push(`${JSON.stringify(t)} ⇒ ${r.etat}/${r.cle}/${r.centimes} (attendu ${e}/${k}/${c})`);
  }
  dit(CAS.length >= 50 && bons === CAS.length, `${CAS.length} lignes lues comme il faut (séparateurs « ; » « , » tab espace, « 007 » = « 7 », prix vide, pièges)`, faux.slice(0, 6).join(' | '));
  const lc = CP.lireCollage ? CP.lireCollage('N°;Prix\n\n12;60\r\n\n13;40\nN°;Prix') : { lignes: [] };
  dit(lc.lignes.length === 4 && lc.lignes[0].etat === 'entete' && lc.lignes[3].etat === 'illisible' && lc.lignes.map((l) => l.n).join() === '1,2,3,4', 'lignes vides sautées, numérotées ; seul le PREMIER en-tête est ignoré', JSON.stringify(lc.lignes.map((l) => l.etat)));
  const gros = CP.lireCollage ? CP.lireCollage(Array.from({ length: 2005 }, (_, i) => `${i + 1};10`).join('\n')) : { lignes: [], trop: 0 };
  dit(gros.lignes.length === 2000 && gros.trop === 5, '2 000 lignes au plus, le reste compté et dit', `${gros.lignes.length} + ${gros.trop}`);

  // ── B. L'aperçu, l'écriture ────────────────────────────────────────────────
  console.log('── B. L’aperçu et l’écriture');
  // 184 fiches inventées : N°1 à 184, sans prix ; N°7 a 50 € ; N°9 porté par deux fiches ; B125 (archive) a 30 €.
  const FICHES = {};
  for (let i = 1; i <= 184; i++) FICHES[String(i)] = [{ key: 'a' + i, numero: String(i), prix: null, titre: 'Paire inventée ' + i }];
  FICHES['7'] = [{ key: 'a7', numero: '7', prix: 50, titre: 'Paire inventée 7' }];
  FICHES['9'] = [{ key: 'a9', numero: '9', prix: null }, { key: 'x9', numero: '9', prix: null }];
  FICHES.B125 = [{ key: 'b125', numero: 'B125', prix: 30 }];
  const fichesDe = (k) => FICHES[k] || [];
  const TEXTE = ['N° ; prix', '12 ; 60', '007 ; 55', '9 ; 40', '999 ; 10', '13 ; 25', '13 ; 25', '14 ; 30', '14 ; 31', 'B125 ; 30', '15 ;', '16 ; Nike ; 40'].join('\n');
  const A = CP.apercuCollage ? CP.apercuCollage({ texte: TEXTE, fichesDe, lu: true }) : { lignes: [], resume: {} };
  const etats = A.lignes.map((l) => l.etat).join(',');
  dit(etats === 'entete,ok,different,deux,inconnu,ok,doublon,conflit,conflit,identique,vide,colonnes', 'chaque ligne a son état (N° inconnu, deux fiches, collé deux fois, déjà un prix…)', etats);
  const w0 = CP.ecrituresCollage ? CP.ecrituresCollage(A) : [];
  dit(w0.map((w) => w.key).join() === 'a12,a13' && w0.every((w) => w.avant === null), 'à l’écriture : seulement les fiches uniques sans prix (12, 13 une fois) — rien d’écrasé', JSON.stringify(w0));
  const w1 = CP.ecrituresCollage ? CP.ecrituresCollage(A, { remplacer: true }) : [];
  dit(w1.map((w) => w.key).join() === 'a12,a7,a13' && w1.find((w) => w.key === 'a7').avant === 5000, '« Remplacer aussi » : le prix différent (N°7, 50 € ⇒ 55 €) entre, avec son ancien prix', JSON.stringify(w1));
  const AKO = CP.apercuCollage ? CP.apercuCollage({ texte: TEXTE, fichesDe, lu: false }) : { lu: true };
  const wKO = CP.ecrituresCollage ? CP.ecrituresCollage(AKO, { remplacer: true }) : [1];
  dit(AKO.lu === false && wKO.length === 0, 'base pas lue (lecture ratée) ⇒ AUCUNE écriture', JSON.stringify({ lu: AKO.lu, n: wKO.length }));
  // Comparer-et-échanger : une fiche qui a reçu un prix entre l'aperçu et le clic n'est pas écrite.
  const APRES = { ...FICHES, 13: [{ key: 'a13', numero: '13', prix: 22 }] };
  const V = CP.verifierAvantEcriture ? CP.verifierAvantEcriture(w0, (k) => APRES[k] || []) : { garder: w0, changees: 0 };
  dit(V.garder.map((w) => w.key).join() === 'a12' && V.changees === 1, 'une fiche changée depuis l’aperçu (N°13 a reçu 22 €) n’est PAS écrite, et c’est compté', JSON.stringify(V));
  const DEUX = { ...FICHES, 12: [{ key: 'a12', numero: '12', prix: null }, { key: 'z12', numero: '12', prix: null }] };
  const V2 = CP.verifierAvantEcriture ? CP.verifierAvantEcriture(w0, (k) => DEUX[k] || []) : { garder: w0 };
  dit(!V2.garder.some((w) => w.key === 'a12'), 'un N° devenu « deux fiches » depuis l’aperçu n’est pas écrit');
  // 184 prix collés d'un coup.
  const T184 = Array.from({ length: 184 }, (_, i) => `${i + 1}\t${20 + (i % 50)},50`).join('\n');
  const t0 = Date.now();
  const A184 = CP.apercuCollage ? CP.apercuCollage({ texte: T184, fichesDe, lu: true }) : { lignes: [] };
  const ms = Date.now() - t0;
  const w184 = CP.ecrituresCollage ? CP.ecrituresCollage(A184) : [];
  dit(w184.length === 182 && A184.resume.deux === 1 && A184.resume.different === 1 && ms < 300, '184 prix collés : 182 à enregistrer (N°7 a déjà un prix, N°9 deux fiches), en moins de 300 ms', `${w184.length} · ${ms} ms`);
  // Dans l'app : le chemin d'écriture existant, jamais sans base chargée.
  let APP = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
  if (MUT === 'app') APP = APP.replace("    if (!isCloudReady()) { toast(tr('ac.coller.pasLu')); return null; }\n", '');
  const i0 = APP.indexOf('const enregistrerCollage = (ecritures) => {');
  const corps = i0 >= 0 ? APP.slice(i0, APP.indexOf('\n  };\n', i0)) : '';
  const iGarde = corps.indexOf('if (!isCloudReady())'), iSet = corps.indexOf('setNumeros(');
  dit(!!corps && iGarde >= 0 && iSet > iGarde && /return null; \}/.test(corps.slice(iGarde, iSet)), 'app : « Enregistrer » s’arrête AVANT toute écriture quand la base n’est pas chargée');
  dit(/verifierAvantEcriture\(ecritures, fichesCollage\)/.test(corps) && /ecriturePrixSaisi\(w\.prix\)/.test(corps) && /save\('vinted_annonce_numeros'/.test(corps) && /save\('vinted_buyprice_by_num'/.test(corps),
    'app : relu sur les fiches du moment, écrit comme un prix TAPÉ (`ecriturePrixSaisi`), sur les deux clés des prix d’achat');
  dit(/prixAchatDe\(e, buyByNum\)/.test(APP.slice(APP.indexOf('const fichesCollage'), APP.indexOf('const fichesCollage') + 600)) && /cleNum\(e\.numero\) === cle/.test(APP), 'app : le prix d’une fiche par LA règle de l’app (`prixAchatDe`), le N° par `cleNum`');
  dit(/data-coller-ouvrir/.test(APP) && APP.indexOf('data-coller-ouvrir') > APP.indexOf("Prix d'achat à compléter {fillBuyRows"), 'trouvable : « Coller un tableau » dans la saisie en série, qu’ouvre « Coût d’achat · x/y renseignés »');

  // ── C. Modèle et taille ────────────────────────────────────────────────────
  console.log('── C. Modèle et taille, « à racheter »');
  const J = 86400000, T0 = Date.UTC(2026, 9, 1);
  const lignes = [];
  const ms0 = (m, t) => (CQ.modeleSur ? CQ.modeleSur(m, t) : null);
  const vente = (i, titre, marque, taille, eur, achat, delai, devise) => ({ plateforme: 'Vinted', compte: 'boutique', id: 't' + i, ts: T0 + i * J, eur, achat, devise, titre, marque, taille, modeleSur: ms0(marque, titre), enLigne: delai == null ? null : T0 + i * J - delai * J });
  let k = 0;
  for (const d of [3, 4, 5, 6]) lignes.push(vente(++k, 'Nike Dunk Low inventée', 'Nike', '42', 120, 60, d));          // 60 €/paire, 4,5 j
  for (const d of [10, 11, 12, 13, 14]) lignes.push(vente(++k, 'Adidas Samba inventée', 'Adidas', '40', 90, 50, d));     // 40 €, 12 j
  for (const d of [2, 3, 4]) lignes.push(vente(++k, 'New Balance 550 inventée', 'New Balance', '43', 100, 80, d));       // 20 €, 3 j
  for (const d of [20, 25, 30]) lignes.push(vente(++k, 'Asics Gel-Kayano inventée', 'Asics', '41', 150, 70, d));         // 80 €, 25 j
  lignes.push(vente(++k, 'Nike Dunk Low inventée', 'Nike', '42', 120, null, 2));                                        // pas reliée
  lignes.push(vente(++k, 'Nike Dunk Low inventée', 'Nike', '42', 130, '', 2));                                          // pas reliée
  lignes.push(vente(++k, 'Paire inventée sans modèle', '', '42', 50, 20, 5));                                           // reliée, « Autres »
  lignes.push(vente(++k, 'Nike Dunk Low inventée', 'Nike', '42', 100, 40, 3, 'USD'));                                  // autre devise : écartée
  const Q = QR.quoiRacheter ? QR.quoiRacheter(lignes) : null;
  dit(Q && Q.n === 18 && Q.nReliees === 16 && Q.ecartees === 1 && Q.autres.n === 1, 'couverture : 16 ventes reliées sur 18 (une autre devise écartée, une sans modèle dite à part)', Q && JSON.stringify({ n: Q.n, r: Q.nReliees, e: Q.ecartees, a: Q.autres }));
  const g = (cle) => Q && Q.groupes.find((x) => x.nom === cle);
  const dunk = g('Nike Dunk · 42');
  dit(dunk && dunk.n === 4 && dunk.brut === 240 && dunk.moyen === 60 && dunk.marge === 50 && dunk.mediane === 4.5, 'Nike Dunk · 42 : 4 reliées, 240 € de bénéfice, 60 €/paire, marge 50 %, 4,5 j (les 2 non reliées n’y entrent pas)', JSON.stringify(dunk && { n: dunk.n, b: dunk.brut, m: dunk.moyen, ma: dunk.marge, d: dunk.mediane }));
  const ref = CQ.classementRapporte ? CQ.classementRapporte(lignes.filter((l) => l.achat != null && l.achat !== ''), 'modeleTaille').groupes.find((x) => x.nom === 'Nike Dunk · 42') : null;
  dit(ref && dunk && ref.brut === dunk.brut && ref.moyen === dunk.moyen, 'les chiffres sont ceux de `classementRapporte` (une règle par notion)');
  dit(Q && Q.groupes[0] && Q.groupes[0].nom === 'Nike Dunk · 42' && Q.groupes.map((x) => x.nom).join('|') === 'Nike Dunk · 42|Asics Gel-Kayano · 41|Adidas Samba · 40|New Balance 550 · 43', 'tri par bénéfice total', Q && Q.groupes.map((x) => `${x.nom}=${x.brut}`).join(', '));
  const Qv = QR.quoiRacheter ? QR.quoiRacheter(lignes, { tri: 'vite' }) : null;
  dit(Qv && Qv.groupes[0].nom === 'New Balance 550 · 43' && Qv.groupes[Qv.groupes.length - 1].nom === 'Asics Gel-Kayano · 41', 'tri « vite » : le plus court délai d’abord');
  dit(Q && Q.classables === 4 && !Q.peu && Q.seuil.moyen === 50 && Q.seuil.mediane === 8.3 && Q.aRacheter.map((x) => x.nom).join() === 'Nike Dunk · 42',
    '« à racheter » = rentable ET rapide : la Dunk seule (Kayano trop lente, 550 pas assez rentable)', Q && JSON.stringify({ s: Q.seuil, a: Q.aRacheter.map((x) => x.nom) }));
  const Qpeu = QR.quoiRacheter ? QR.quoiRacheter(lignes.slice(0, 9)) : null;
  dit(Qpeu && Qpeu.peu && !Qpeu.aRacheter.length, 'moins de 3 groupes classables ⇒ aucun conseil (rien n’est conclu sur deux ventes)');
  dit(QR.quoiRacheter && QR.quoiRacheter(null) === null, 'relevé pas lu ⇒ null (jamais une liste vide qui dirait « rien »)');
  dit(CQ.cleAxe && CQ.cleAxe({ modeleSur: null, taille: '42' }, 'modeleTaille').k === '' && CQ.cleAxe({ modeleSur: { cle: 'nike|dunk', nom: 'Nike Dunk' }, taille: '' }, 'modeleTaille').k === '', 'sans modèle SÛR ou sans taille ⇒ « Autres » (jamais un modèle deviné)');

  // ── D. L'objectif sur le reçu ──────────────────────────────────────────────
  console.log('── D. Objectif du mois : vendu ou reçu, € par jour');
  const NOW = new Date(2026, 10, 14, 10, 0, 0).getTime();
  const regles = { debutPeriode: (t, p) => { const d = new Date(t); return p === 'mois' ? new Date(d.getFullYear(), d.getMonth(), 1) : new Date(d.getFullYear(), 0, 1); },
    decalerPeriode: (d, p, n) => (p === 'mois' ? new Date(d.getFullYear(), d.getMonth() + n, 1) : new Date(d.getFullYear() + n, 0, 1)),
    bilanLignes: (L2, de, a) => { const x = (L2 || []).filter((l) => l.ts >= de && (a == null || l.ts < a)); return { n: x.length, eur: x.reduce((t, l) => t + l.eur, 0), nb: x.length, ca: x.reduce((t, l) => t + l.eur, 0) }; } };
  const ligneU = { at: NOW - 3600e3, mois: [], sources: { Vinted: 'lu', Leboncoin: 'lu' }, recu: { '2026-11': 700, '2026-10': 1500, '2026-09': 1800, '2026-08': 1200 }, aDater: { n: 2, ca: 90 } };
  const sources = { ligneUrssaf: ligneU, vendu: { lignes: [{ ts: new Date(2026, 6, 1).getTime(), eur: 10 }], manque: [] } };
  const obj = OB.lireObjectif ? OB.lireObjectif({ type: 'recu', valeur: 2000 }) : null;
  dit(obj && obj.type === 'recu' && OB.estEuros('recu') && OB.TYPES_OBJECTIF.recu && OB.TYPES_OBJECTIF.ca, 'un objectif peut se poser sur le REÇU (à côté du vendu), en euros');
  const x = CC.valeurObjectif ? CC.valeurObjectif(obj, sources, regles, NOW) : null;
  const P = OB.progressionObjectif ? OB.progressionObjectif(obj, x) : null;
  dit(P && P.valeur === 700 && P.pct === 35 && P.aDater === 2, 'reçu : la case « Reçu » du mois (700 €, 35 %), les 2 ventes à dater dites, hors total', JSON.stringify(P));
  const RS = OB.resteObjectif ? OB.resteObjectif(P, NOW) : null;
  dit(RS && RS.reste === 1300 && RS.jours === 17 && RS.parJour === 77 && RS.dernier === 30, '« il te faut 77 € par jour d’ici le 30 » : 1 300 € en 17 jours (aujourd’hui compris), arrondi vers le haut', JSON.stringify(RS));
  const xv = CC.valeurObjectif ? CC.valeurObjectif({ type: 'ca', valeur: 2000, cache: {} }, { ...sources, vendu: { lignes: [{ ts: new Date(2026, 10, 3).getTime(), eur: 400 }], manque: [] } }, regles, NOW) : null;
  dit(xv && xv.valeur === 400, 'vendu : la case « Vendu » (date de la vente) — l’autre mesure, au choix', JSON.stringify(xv && { v: xv.valeur, r: xv.raison }));
  const mp = OB.moisPleinsAvant ? OB.moisPleinsAvant(NOW, 3) : [];
  const passes = mp.map((b) => (CC.valeurObjectifMois ? CC.valeurObjectifMois('recu', sources, regles, b, NOW) : null));
  dit(passes.map((p) => p && p.valeur).join() === '1200,1800,1500' && passes.every((p) => p && p.couvert), 'ses 3 mois passés sur le reçu : `recu[ym]` de la même ligne', JSON.stringify(passes.map((p) => p && [p.valeur, p.couvert])));
  const prop = OB.propositionObjectif ? OB.propositionObjectif('recu', passes) : null;
  dit(prop && prop.valeur === 1500, 'proposition sur le reçu : la moyenne des 3 mois (1 500 €)', JSON.stringify(prop));
  const vieille = CC.valeurObjectif ? CC.valeurObjectif(obj, { ...sources, ligneUrssaf: { ...ligneU, at: NOW - 5 * 86400e3 } }, regles, NOW) : { valeur: 1 };
  dit(vieille && vieille.valeur == null, 'ligne publiée trop vieille ⇒ « pas su » (jamais un vieux reçu présenté comme celui du jour)');

  // ── E. La déclaration annuelle ─────────────────────────────────────────────
  console.log('── E. La déclaration de revenus, avec sa source');
  const NOV = new Date(2026, 10, 14, 12);
  const LIGNE = {
    at: NOV.getTime(), sources: { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu', Vestiaire: 'lu' },
    mois: [
      { ym: '2026-10', n: 120, ca: 4500, par: { Vinted: { n: 100, ca: 3700 }, Leboncoin: { n: 20, ca: 800 } } },
      { ym: '2026-09', n: 200, ca: 7340, par: { Vinted: { n: 190, ca: 7000 }, eBay: { n: 10, ca: 340 } } },
      { ym: '2026-03', n: 16, ca: 340, par: { Vinted: { n: 16, ca: 340 } } },
      { ym: '2025-12', n: 50, ca: 2000, par: { Vinted: { n: 50, ca: 2000 } } },
    ],
    aDater: { n: 16, ca: 610, annees: { 2026: { n: 4, ca: 160 } } },
  };
  const D = DA.declarationAnnuelle ? DA.declarationAnnuelle({ ligne: LIGNE, now: NOV, liberatoire: 'non', regime: 'micro' }) : null;
  const dr = ME.declarationRevenus ? ME.declarationRevenus({ ligne: LIGNE, now: NOV, liberatoire: 'non' }) : null;
  dit(D && dr && D.ca === dr.ca && D.ca === 12340 && D.cases.join() === '5KO' && D.montants.length === 1 && D.montants[0].case === '5KO', '12 340 € en case 5KO : LE montant de `declarationRevenus` (pas un second calcul)', JSON.stringify(D && { ca: D.ca, c: D.cases, dr: dr && dr.ca }));
  dit(D && D.source.nVentes === 340 && D.source.nVentesMois === 336 && D.source.aDaterSur.n === 4 && D.source.caMois === 12180, 'la source : 340 ventes reçues en 2026 (336 datées au versement + 4 vendues et finalisées dans l’année)', D && JSON.stringify(D.source));
  const sites = D ? D.source.parSites.map((s) => `${s.plateforme}:${s.n}:${s.ca}`).join(',') : '';
  dit(sites === 'Vinted:306:11040,Leboncoin:20:800,eBay:10:340', 'par site, des mêmes mois (2025 n’y entre pas)', sites);
  dit(D && D.source.horsTotal.aDater.n === 12 && D.source.horsTotal.aDater.ca === 450 && D.partiel && D.etat === 'partiel', '12 ventes sans date de versement (450 €) : hors total, dites ; le montant est « au moins »', D && JSON.stringify(D.source.horsTotal));
  const sommeSites = D ? Math.round(D.source.parSites.reduce((t, s) => t + s.ca * 100, 0)) + Math.round(D.source.aDaterSur.ca * 100) : 0;
  dit(D && sommeSites === Math.round(D.ca * 100), 'la source se recompose au centime : sites + à dater prouvées = montant');
  const Dl = DA.declarationAnnuelle ? DA.declarationAnnuelle({ ligne: LIGNE, now: NOV, liberatoire: null, regime: 'micro' }) : null;
  dit(Dl && Dl.cases.join() === '5KO,5TA' && Dl.montants.map((m) => `${m.case}:${m.si}`).join() === '5KO:sans,5TA:avec' && Dl.liberatoire == null, 'versement libératoire pas répondu ⇒ les DEUX cases, chacune avec sa condition (jamais devinée)', Dl && JSON.stringify(Dl.montants));
  const Do = DA.declarationAnnuelle ? DA.declarationAnnuelle({ ligne: LIGNE, now: NOV, liberatoire: 'oui', regime: 'micro' }) : null;
  dit(Do && Do.cases.join() === '5TA', 'avec versement libératoire ⇒ case 5TA');
  const etat = (o) => (DA.declarationAnnuelle ? DA.declarationAnnuelle(o).etat : '');
  dit(etat({ ligne: LIGNE, now: NOV, regime: null }) === 'statut' && etat({ ligne: LIGNE, now: NOV, regime: undefined }) === 'encours' && etat({ ligne: LIGNE, now: NOV, regime: 'societe' }) === 'sansObjet' && etat({ ligne: null, now: NOV, regime: 'micro' }) === 'passu',
    'statut pas lu ⇒ lecture ; pas choisi ⇒ aucune case ; société ⇒ sans objet ; ligne absente ⇒ pas su (jamais 0)');
  const Dp = DA.declarationAnnuelle ? DA.declarationAnnuelle({ ligne: { ...LIGNE, sources: { ...LIGNE.sources, eBay: 'pasSu' }, mois: [...LIGNE.mois, { ym: '2026-05', n: 3, ca: 'x' }] }, now: NOV, liberatoire: 'non', regime: 'micro' }) : null;
  dit(Dp && Dp.source.horsTotal.pasSu.join() === 'eBay' && Dp.source.horsTotal.illisibles === 1 && Dp.partiel, 'un site pas lu et un mois illisible : nommés, hors total');
  const Dprin = DA.declarationAnnuelle ? DA.declarationAnnuelle({ ligne: LIGNE, now: new Date(2027, 3, 10, 12), liberatoire: 'non', regime: 'micro' }) : null;
  dit(Dprin && Dprin.annee === 2026 && !Dprin.enCours, 'au printemps 2027 : la déclaration des revenus 2026, prête');

  try { fs.rmSync(T, { recursive: true, force: true }); } catch (_) {}
  console.log(`\n${ko ? '❌' : '✅'} audit-argent-choix : ${ko} rouge(s), ${ok} vert(s)${MUT ? ' [mutation ' + MUT + ']' : ''}`);
  process.exit(ko ? 1 : 0);
})();
