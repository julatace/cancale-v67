#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LOTS BJ, BM, BN (10 nov.) — DOSSIER DE LITIGE EN PDF, VITESSE
//         D'ENVOI, AVIS VINTED LUS
//         node scripts/audit-dossier-vitesse-avis.cjs [--mutation=…] [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTE src/dossierLitige.js (avec le VRAI pdf-lib : le PDF est fabriqué puis
// relu par pdfjs-dist), src/vitesseEnvoi.js (avec la vraie tolérance de
// api/_lib/depart-colis.js) et src/notesRecues.js, sur des données INVENTÉES de
// la forme MESURÉE (le dépôt est public), et lit le code des écrans :
//   D. le dossier : N°, titre, compte, date de vente, n° de transaction ; les
//      étapes PROUVÉES seulement (une étape « pas lue » n'y est pas) ; rien de
//      l'acheteur (ni pseudo, ni nom, ni adresse) même quand la vente les porte ;
//      une photo pas récupérée est DITE ; la page du bordereau (qui porte
//      l'adresse) n'est jointe que s'il coche, case décochée par défaut ; aucun
//      service : pdf-lib dans le navigateur ;
//   M. la vitesse : délai = dépôt PROUVÉ − vente, médiane par compte, sur 30
//      jours ; une raison sans date (expédié à la main) ou une date avant la vente
//      ⇒ « sans date de dépôt prouvée », jamais 0 ; une vente encore à envoyer,
//      annulée, une conversation ne comptent pas ; Statistiques LIT la
//      publication (aucun second calcul du départ) ;
//   N. les avis : la forme mesurée { id, rating, feedback } SANS date est lue
//      (avant : tous écartés) ; l'ordre de la page (plus récent d'abord) ; aucune
//      date inventée ; évolution 10 contre 10, au moins 5 de chaque côté ; texte
//      court ; rien capté ⇒ « Avis pas encore lus : ouvre ton profil Vinted » ;
//      projection (jamais `select=data`) ; aucun rappel d'évaluation.
// `--mutation=…` réaffaiblit une règle dans une copie de src/ et api/ : rouge exigé.
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUTS = {
  'etape-pas-lue': ["frise.etapes.filter((e) => e && e.etat === 'fait')", "frise.etapes.filter((e) => e && e.etat !== 'geste')", 'dossierLitige.js'],
  'acheteur': ["    ['Date de vente', jourDossier(vente && vente.date) || '—'],\n", "    ['Date de vente', jourDossier(vente && vente.date) || '—'],\n    ['Acheteur', str(vente && (vente.user_login || (vente.buyer && vente.buyer.login)))],\n", 'dossierLitige.js'],
  'bordereau-toujours': ['if (contenu.avecBordereau && bordereauPdf) {', 'if (bordereauPdf) {', 'dossierLitige.js'],
  'photo-ratee-tue': ["const p = contenu.photos[cle] === 'ok' ? 'pas récupérée'", "const p = contenu.photos[cle] === 'ok' ? '' : ''; void", 'dossierLitige.js'],
  'case-cochee': ['const [avecB, setAvecB] = React.useState(false);', 'const [avecB, setAvecB] = React.useState(true);', 'LitigesEnCours.jsx'],
  'app-vente-entiere': ['carte: c, vente: o ? { date: o.date } : null,', 'carte: c, vente: o,', 'App.jsx'],
  'vitesse-sans-date-zero': ['else { e.sansDate++; sansDateTout++; }', 'else { e.d.push(0); tous.push(0); }', 'vitesseEnvoi.js'],
  'vitesse-avant-vente': ['    if (depart != null && depart < vente - TOLERANCE_AVANT_VENTE_MS) depart = null;   // contredit la vente\n', '', 'vitesseEnvoi.js'],
  'vitesse-30j': ['if (!l || !Number.isFinite(l.vente) || l.vente < de || l.vente > maintenant) continue;', 'if (!l || !Number.isFinite(l.vente) || l.vente > maintenant) continue;', 'vitesseEnvoi.js'],
  'vitesse-moyenne': ['n: d.length, mediane: mediane(d),', 'n: d.length, mediane: d.length ? Math.round(d.reduce((s, x) => s + x, 0) / d.length) : null,', 'vitesseEnvoi.js'],
  'vitesse-a-envoyer': ['    if (!r && !estPartie(o)) continue;                   // encore à envoyer : pas un colis\n', '', 'vitesseEnvoi.js'],
  'vitesse-stats-recalcule': ["import './styles-vitesse-avis.css';", "import './styles-vitesse-avis.css';\nimport { ventesPartiesParPreuve } from '../api/_lib/depart-vente.js';", 'VitesseEnvoi.jsx'],
  'avis-sans-date-ecarte': ['  return { note, ts: isFinite(t) ? t : null, rang,', '  if (!isFinite(t)) return null;\n  return { note, ts: isFinite(t) ? t : null, rang,', 'notesRecues.js'],
  'avis-ordre': ['x.rang - y.rang', 'y.rang - x.rang', 'notesRecues.js'],
  'avis-evolution-maigre': ['export const MIN_EVOLUTION = 5;', 'export const MIN_EVOLUTION = 1;', 'notesRecues.js'],
  'avis-date-inventee': ['return { note, ts: isFinite(t) ? t : null, rang,', 'return { note, ts: isFinite(t) ? t : Date.now(), rang,', 'notesRecues.js'],
  'avis-select-data': ['&select=id,avis:data->payload->user_feedbacks,pag:data->payload->pagination', '&select=id,data,avis:data->payload->user_feedbacks,pag:data->payload->pagination', 'ecrans/Stats.jsx'],
  'avis-vide-tu': ['Avis pas encore lus : ouvre ton profil Vinted.', 'Aucun avis.', 'AvisVinted.jsx'],
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
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'dossier-vitesse-avis-'));
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true });
  fs.cpSync(path.join(R, 'api'), path.join(d, 'api'), { recursive: true });
  fs.symlinkSync(path.join(R, 'node_modules'), path.join(d, 'node_modules'));
  fs.copyFileSync(path.join(R, 'package.json'), path.join(d, 'package.json'));
  const f = path.join(d, 'src', MUTS[MUT][2]); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(MUTS[MUT][0])) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(f, s.replace(MUTS[MUT][0], MUTS[MUT][1]));
  SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const lireOrig = (f) => { try { return require('fs').readFileSync.call(fs, path.join(SRC, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const url = (f) => require('url').pathToFileURL(path.join(SRC, f)).href;
const zlib = require('zlib');
// Une petite image PNG valide (16×12, gris), fabriquée ici : aucune photo réelle.
function png(w = 16, h = 12) {
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const bloc = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  const brut = Buffer.alloc((w * 3 + 1) * h, 0x88); for (let y = 0; y < h; y++) brut[y * (w * 3 + 1)] = 0;
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), bloc('IHDR', ih), bloc('IDAT', zlib.deflateSync(brut)), bloc('IEND', Buffer.alloc(0))]));
}

(async () => {
  let D, V, N, PL, PJ;
  try { D = await import(url('dossierLitige.js')); V = await import(url('vitesseEnvoi.js')); N = await import(url('notesRecues.js')); }
  catch (e) { dit(false, 'src/dossierLitige.js, src/vitesseEnvoi.js, src/notesRecues.js existent et se chargent', e.message); console.log(`\n${ok} verts, ${ko} rouges`); process.exit(1); }
  PL = await import('pdf-lib');
  PJ = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const texteDe = async (u8) => {
    const doc = await PJ.getDocument({ data: new Uint8Array(u8), useSystemFonts: false, isEvalSupported: false, verbosity: 0 }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) { const p = await doc.getPage(i); const t = await p.getTextContent(); pages.push(t.items.map((x) => x.str).join(' ')); }
    return { n: doc.numPages, pages, tout: pages.join(' \n ') };
  };

  // ── D. LE DOSSIER ─────────────────────────────────────────────────────────
  console.log('\n── D. Le dossier de litige en PDF');
  const T0 = Date.parse('2026-11-01T09:00:00Z'), J = 864e5;
  const carte = { cle: 'v:9001', plateforme: 'vinted', genre: 'retour', libelle: 'Retour', etape: 'En route vers toi', tx: '9001', num: '42', titre: 'Nike Dunk Low Panda 42', compte: null, limiteTexte: '', acheteur: 'jeanne_m',
    preuves: { photo: { etat: 'ok', src: 'x' }, bordereau: { etat: 'ok' } } };
  // La vente porte, comme dans la vraie forme, l'acheteur : il ne doit RIEN en sortir.
  const vente = { date: new Date(T0).toISOString(), user_login: 'jeanne_m', buyer: { login: 'jeanne_m', real_name: 'Jeanne Mouette' }, address: '12 rue des Mouettes 75011 Paris' };
  const frise = { etapes: [
    { cle: 'vendue', label: 'Vendue', etat: 'fait', t: T0 },
    { cle: 'bordereau', label: 'Bordereau', etat: 'fait', t: T0 + 3600e3 },
    { cle: 'deposee', label: 'Déposée', etat: 'fait', t: T0 + J + 2 * 3600e3 },
    { cle: 'enroute', label: 'En route', etat: 'paslu', t: null },
    { cle: 'livree', label: 'Livrée', etat: 'fait', t: null },
    { cle: 'finalisee', label: 'Finalisée', etat: 'geste', t: null, geste: 'à faire' },
    { cle: 'versee', label: 'Versée', etat: 'paslu', t: null },
  ], bifurcation: { libelle: 'Retour', sous: 'En route vers toi' } };
  const C = D.contenuDossierLitige({ carte, vente, compte: 'atelier_shop', frise, bordereau: { suivi: 'XA123456789FR', at: T0 + 3600e3 }, photos: { annonce: 'ok', carton: 'ratee' }, avecBordereau: false, maintenant: T0 + 9 * J });
  const js = JSON.stringify(C);
  dit(C.num === '42' && /Nike Dunk Low Panda 42/.test(js) && /atelier_shop/.test(js) && /9001/.test(js) && /1 novembre 2026/.test(js), 'D1 N°, titre, compte, n° de transaction et date de vente dans le dossier', js.slice(0, 300));
  dit(!/jeanne|Mouette|Paris|75011|rue des/i.test(js), 'D2 rien de l’acheteur dans le contenu (la vente le portait : pseudo, nom, adresse)', js);
  const cles = (C.etapes || []).map((e) => e.cle).join(',');
  dit(cles === 'vendue,bordereau,deposee,livree', 'D3 seules les étapes PROUVÉES (« pas lue » et « à faire » absentes)', cles);
  const livree = (C.etapes || []).find((e) => e.cle === 'livree');
  dit(livree && livree.quand === 'date non lue', 'D4 une étape prouvée sans date dit « date non lue » (jamais une date inventée)', JSON.stringify(livree));
  // Le PDF lui-même (vrai pdf-lib), relu par pdfjs.
  const bordereauPdf = await (async () => { const d = await PL.PDFDocument.create(); d.addPage([283, 425]).drawText('ETIQUETTE TEST', { x: 20, y: 300, size: 12 }); d.addPage([283, 425]); return d.save(); })();
  const images = { annonce: { octets: png(), type: 'png' }, carton: null };
  const pdf1 = await D.pdfDossierLitige(C, { PDFLib: PL, images, bordereauPdf });
  const t1 = await texteDe(pdf1);
  dit(/Dossier de litige/.test(t1.tout) && /N°42/.test(t1.tout) && /Nike Dunk Low Panda 42/.test(t1.tout) && /XA123456789FR/.test(t1.tout), 'D5 le PDF porte le N°, le titre, le n° de suivi', t1.tout.slice(0, 300));
  dit(!/jeanne|Mouette|75011|rue des/i.test(t1.tout), 'D6 rien de l’acheteur dans le PDF', t1.tout);
  dit(/Déposée/.test(t1.tout) && !/En route\s+\d/.test(t1.tout) && !/Versée/.test(t1.tout) && !/Finalisée/.test(t1.tout), 'D7 le suivi du PDF : étapes prouvées seulement', t1.tout);
  dit(/pas r[ée]cup[ée]r[ée]e/.test(t1.tout), 'D8 la photo du carton pas récupérée est DITE dans le PDF', t1.tout);
  dit(t1.n === 1, 'D9 case décochée : la page du bordereau (adresse) n’est PAS jointe', `${t1.n} pages`);
  const C2 = D.contenuDossierLitige({ carte, vente, compte: 'atelier_shop', frise, bordereau: { suivi: 'XA123456789FR', at: T0 }, photos: { annonce: 'ok', carton: 'absente' }, avecBordereau: true, maintenant: T0 });
  const t2 = await texteDe(await D.pdfDossierLitige(C2, { PDFLib: PL, images, bordereauPdf }));
  dit(t2.n === 3 && /ETIQUETTE TEST/.test(t2.pages[1] || ''), 'D10 case cochée : les pages du bordereau sont jointes, à la suite', `${t2.n} pages`);
  const C3 = D.contenuDossierLitige({ carte: { ...carte, num: '' }, vente: null, compte: '', frise: null, bordereau: null, photos: {} });
  const t3 = await texteDe(await D.pdfDossierLitige(C3, { PDFLib: PL }));
  dit(/Sans N°/.test(t3.tout) && /Suivi pas lu/.test(t3.tout) && /Aucun bordereau lu/.test(t3.tout) && /aucune rang[ée]e/.test(t3.tout), 'D11 sans N° ni frise ni bordereau : « Sans N° », « Suivi pas lu », « Aucun bordereau lu » (jamais inventés)', t3.tout);
  dit(D.nomFichierDossier({ num: 'B12' }, T0) === 'dossier-litige-B12-2026-11-01.pdf', 'D12 nom du fichier : N° et date', D.nomFichierDossier({ num: 'B12' }, T0));
  const lit = sansCommentaires(require('./_source-app.cjs').enFrancais(lireOrig('LitigesEnCours.jsx'), path.join(__dirname, '..')));   // (11 nov.) tr() ⇒ sa phrase française
  dit(/Dossier PDF/.test(lit) && /const \[avecB, setAvecB\] = React\.useState\(false\)/.test(lit) && /il porte l’adresse/.test(lit), 'D13 la carte : « Dossier PDF », case « Joindre le bordereau (il porte l’adresse) » décochée par défaut');
  const dos = sansCommentaires(lireOrig('dossierLitige.js'));
  dit(!/https?:\/\/|\/api\/|supabase|anthropic|openai|apikey/i.test(dos) && /import\('pdf-lib'\)/.test(dos), 'D14 aucun service ni clé : pdf-lib dans le navigateur');
  const app = sansCommentaires(require('./_source-app.cjs').sourceApp(path.dirname(SRC)));
  dit(/carte: c, vente: o \? \{ date: o\.date \} : null,/.test(app) && /onDossier=\{fabriquerDossierLitige\}/.test(app) && /photoCartonDe\(tx, 'vinted'\)/.test(app), 'D15 l’app : la vente passe sa DATE seule, la photo du carton par la transaction, l’écran reçoit le geste');

  // ── M. LA VITESSE D'ENVOI ─────────────────────────────────────────────────
  console.log('\n── M. La vitesse d’envoi');
  const NOW = Date.parse('2026-11-10T12:00:00Z'), H = 3600e3;
  const v = (tx, uid, joursAvant, status = 'Commande finalisée', extra = {}) => ({ transaction_id: tx, status, date: new Date(NOW - joursAvant * J).toISOString(), title: 'Nike Dunk Low Panda 42', _acc: { vinted_user_id: uid, login: uid === '1' ? 'atelier' : 'paris' }, ...extra });
  const ventes = [
    v(1, '1', 5), v(2, '1', 6), v(3, '1', 7), v(4, '2', 3), v(5, '2', 4),
    v(6, '1', 8),                                  // expédié à la main : pas de date
    v(7, '2', 9),                                  // « départ » 3 jours AVANT la vente : contredit
    v(8, '1', 40),                                 // hors des 30 jours
    v(9, '1', 2, 'Bordereau d’envoi commandé'),    // encore à envoyer, aucune preuve
    v(10, '1', 3, 'Commande annulée'),             // annulée
    v(11, '1', 3, ''),                             // une conversation
    v(12, '2', 5),                                 // partie d'après Vinted, aucune preuve datée
  ];
  const at = (tx, h) => { const o = ventes.find((x) => x.transaction_id === tx); return Date.parse(o.date) + h * H; };
  const partis = new Map([
    ['1', { type: 'colis-fait', at: at(1, 10) }], ['2', { type: 'email', at: at(2, 30) }], ['3', { type: 'transporteur', at: at(3, 50) }],
    ['4', { type: 'colis-fait', at: at(4, 20) }], ['5', { type: 'panneau', at: at(5, 4) }],
    ['6', { type: 'expedie-main', at: null }], ['7', { type: 'email', at: at(7, -72) }], ['8', { type: 'colis-fait', at: at(8, 5) }],
    ['10', { type: 'colis-fait', at: at(10, 5) }],
  ]);
  const lignes = V.lignesVitesse({ ventes, partis,
    estAnnulee: (o) => /annul/i.test(o.status), estPartie: (o) => !/bordereau/i.test(o.status),
    compteDe: (o) => ({ cle: o._acc.vinted_user_id, nom: o._acc.login }) });
  const txs = (lignes || []).map((l) => l.tx).sort((a, b) => a - b).join(',');
  dit(txs === '1,2,3,4,5,6,7,8,12', 'M1 les colis partis seulement (ni à envoyer, ni annulée, ni conversation)', txs);
  const W = V.vitesseParCompte(lignes, { maintenant: NOW });
  const c1 = W.comptes.find((c) => c.cle === '1'), c2 = W.comptes.find((c) => c.cle === '2');
  dit(c1 && c1.n === 3 && c1.mediane === 30 * H && c1.sansDate === 1, 'M2 atelier : médiane 30 h sur 3 colis ; « expédié à la main » = sans date (jamais 0) ; la vente de 40 j hors fenêtre', JSON.stringify(c1));
  dit(c2 && c2.n === 2 && c2.mediane === 12 * H && c2.sansDate === 2, 'M3 paris : médiane 12 h sur 2 ; départ AVANT la vente et vente sans preuve datée = sans date', JSON.stringify(c2));
  dit(W.tout.n === 5 && W.tout.mediane === 20 * H && W.tout.sansDate === 3, 'M4 tous comptes : médiane 20 h sur 5 colis, 3 sans date NOMMÉS', JSON.stringify(W.tout));
  dit(V.texteDuree(30 * H) === '1 j 6 h' && V.texteDuree(12 * H) === '12 h' && V.texteDuree(5 * J) === '5 j' && V.texteDuree(null) === '—' && V.texteDuree(20 * 60e3) === '< 1 h', 'M5 la durée en clair', [V.texteDuree(30 * H), V.texteDuree(12 * H), V.texteDuree(5 * J)].join(' | '));
  dit(V.texteCouvertureVitesse(c2) === 'sur 2 colis · 2 sans date de dépôt prouvée', 'M6 la couverture dite : « sur N colis » + le manque nommé', V.texteCouvertureVitesse(c2));
  dit(V.vitesseParCompte(null).etat === 'passu' && V.lignesVitesse({ ventes: null }) === null, 'M7 ventes pas lues ⇒ pas su (jamais « 0 colis »)');
  const veJsx = sansCommentaires(lireOrig('VitesseEnvoi.jsx'));
  dit(!/depart-vente|ventesPartiesParPreuve|raisonDepartVente|tsCommande/.test(veJsx) && /lireVitesse/.test(veJsx), 'M8 Statistiques et Ma semaine LISENT la publication (aucun second calcul du départ)');
  dit(/lignesVitesse\(\{\s*ventes, partis: partisVinted/.test(app) && /publierVitesse\(lignes/.test(app) && /vitesse=\{<LigneVitesse/.test(app), 'M9 l’app publie avec la règle unique du départ (`partisVinted`) ; Ma semaine reçoit la ligne');
  const stats = sansCommentaires(lireOrig('ecrans/Stats.jsx'));
  dit(/<VitesseEnvoi owner=/.test(stats), 'M10 Argent → Statistiques montre la carte');

  // ── N. LES AVIS ───────────────────────────────────────────────────────────
  console.log('\n── N. Les avis Vinted lus');
  // Forme MESURÉE le 10 nov. : { id (10 chiffres), rating, feedback }, AUCUNE date, du plus récent au plus ancien.
  const avis = Array.from({ length: 20 }, (_, i) => ({ id: String(9000000020 - i), rating: i < 10 ? 5 : (i % 2 ? 4 : 3), feedback: i === 0 ? 'Parfait, envoi rapide et paire impeccable, je recommande vivement ce vendeur sérieux et très réactif à chaque message !' : 'Très bien' }));
  const NN = N.notesParCompte({ profils: [{ uid: '1', login: 'atelier', at: new Date(NOW).toISOString(), rep: 0.98, n: 120, pos: 118, neu: 1, neg: 1, avis, pag: { total_entries: 120, total_pages: 6 } }], comptes: [{ uid: '1', nom: 'atelier' }], maintenant: NOW });
  const L = NN.comptes[0] && NN.comptes[0].liste;
  dit(L && L.lus === 20, 'N1 la forme mesurée (sans date) est LUE : 20 avis (avant : tous écartés)', JSON.stringify(L && { lus: L.lus }));
  dit(L && L.dernieres.map((x) => x.id).join(',') === '9000000020,9000000019,9000000018,9000000017,9000000016', 'N2 les 5 derniers dans l’ordre de la page (le plus récent d’abord)', L && L.dernieres.map((x) => x.id).join(','));
  dit(L && L.dernieres.every((x) => x.ts === null), 'N3 aucune date inventée (Vinted n’en donne pas)', L && JSON.stringify(L.dernieres.map((x) => x.ts)));
  dit(L && L.evolution && L.evolution.recent === 5 && L.evolution.avant === 3.5 && L.evolution.sens === 'hausse', 'N4 évolution : 10 derniers 5 contre 10 d’avant 3,5', JSON.stringify(L && L.evolution));
  dit(L && L.moyenneLus === 4.3 && L.total === 120, 'N5 moyenne des avis lus (4,3) et le total Vinted (120)', JSON.stringify(L && { m: L.moyenneLus, t: L.total }));
  dit(N.evolutionAvis(avis.slice(0, 13).map((a, i) => N.lireAvis(a, i))) === null, 'N6 moins de 5 avis d’un côté ⇒ pas d’évolution (jamais une flèche sur 3 avis)');
  const court = N.texteCourtAvis(avis[0].feedback);
  dit(court.length <= 90 && court.endsWith('…'), 'N7 texte court (≤ 90 caractères)', court);
  const datee = N.lireAvis({ id: 1, rating: 4, created_at: '2026-11-02T10:00:00+01:00' }, 0);
  dit(datee && Number.isFinite(datee.ts), 'N8 une date LUE est gardée (si Vinted la donne un jour)', JSON.stringify(datee));
  dit(N.lireAvis({ id: 2, rating: 4.5 }) === null && N.lireAvis({ id: 3, rating: 'x' }) === null, 'N9 une note illisible n’est pas un avis');
  const av = sansCommentaires(lireOrig('AvisVinted.jsx'));
  dit(/Avis pas encore lus : ouvre ton profil Vinted\./.test(av), 'N10 rien capté ⇒ « Avis pas encore lus : ouvre ton profil Vinted » (jamais « aucun avis »)');
  dit(!/rappel|laisse(r)? un avis|[ée]valuer/i.test(av) && !/login|pseudo\b(?! de)/i.test(av.replace(/jamais le pseudo/gi, '')), 'N11 aucun rappel d’évaluation, aucun pseudo d’acheteur');
  const req = (stats.match(/app_data\?id=like\.harvest_\*_feedbacks[^`]*/) || [''])[0];
  dit(req && !/select=data\b|select=[^&]*,data(,|$)/.test(req) && /data->>type=eq\.feedbacks/.test(req) && /pagination/.test(req), 'N12 lecture projetée (jamais `select=data`), lignes `type=feedbacks` seulement', req);
  dit(/<AvisLus comptes=\{N\.comptes\}\/>/.test(stats), 'N13 Argent → Statistiques, carte « Notes reçues » : les avis lus');

  console.log(`\n${ko ? '❌' : '✅'} audit-dossier-vitesse-avis${MUT ? ' [' + MUT + ']' : ''} : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ erreur : ' + (e && e.stack || e)); process.exit(1); });
