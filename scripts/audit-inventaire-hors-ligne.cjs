// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — L'INVENTAIRE HORS CONNEXION ET LE COMPTOIR SANS RÉSEAU (9 nov. 2026)
// ════════════════════════════════════════════════════════════════════════════
// Exécute les VRAIES règles (src/inventaireHorsLigne.js, src/inventaire.js,
// src/bordereauxHorsLigne.js) :
//   H1 la liste figée juge EXACTEMENT comme l'attendu en ligne (chaque N°, et le
//      bilan entier) — gel puis dégel, à travers JSON ;
//   H2 « pas su » n'est jamais figé ; la liste d'un autre vendeur n'est jamais
//      servie (sa clé, ou la bonne clé à son nom) ; rien de lourd (ni photo, ni règle) ;
//   H3 le constat FIGÉ : gardé à « Terminer », gagné par le plus récent à la fusion,
//      jamais d'« à chercher » quand la lecture n'a pas eu lieu ;
//   H4 rejouer l'envoi ne double rien (union par saisie ; 2ᵉ envoi = aucune écriture) ;
//   H5 les bordereaux gardés : seulement une ligne de bordereau (jamais `label_latest`),
//      par vendeur, au plus PDF_MAX ;
//   H6 le branchement : le service worker garde `vrm-hl-*`, la déconnexion vide la
//      réserve, `lirePdfLigne` ne garde que pour CE vendeur (jamais l'équipe), l'app
//      rejoue l'inventaire au retour du réseau, AUCUN N° n'est écrit hors connexion ;
//   H7 la vibration : une forme par jugement.
//   node scripts/audit-inventaire-hors-ligne.cjs            la règle du dépôt
//   node scripts/audit-inventaire-hors-ligne.cjs --prouve   chaque mutation doit rougir
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const F_HL = path.join(RACINE, 'src', 'inventaireHorsLigne.js');
const F_INV = path.join(RACINE, 'src', 'inventaire.js');
const F_PDF = path.join(RACINE, 'src', 'bordereauxHorsLigne.js');

// [fichier, ancre, remplacement]
const MUTATIONS = {
  // La liste figée oublie les réponses de `jugeable` : tout N° inconnu devient « jugeable ».
  'jugeable-perdu': [F_HL, "jugeable: (k) => (Object.prototype.hasOwnProperty.call(fiches, String(k)) ? fiches[String(k)] === 1 : f.jugeableInconnu === true),", 'jugeable: () => true,'],
  // Les ventes prouvées oubliées au gel (une vendue redevient « attendue »).
  'vendus-perdus': [F_HL, 'vendus: liste(stock.vendus), physiques', 'vendus: null, physiques'],
  // Une liste « pas su » figée quand même.
  'passu-fige': [F_HL, "if (!uidValide(uid) || !Number.isFinite(at) || !estObjet(stock) || !stock.su) return null;", "if (!uidValide(uid) || !Number.isFinite(at) || !estObjet(stock)) return null;"],
  // La liste d'un autre vendeur servie (le contenu n'est plus vérifié).
  'autre-vendeur': [F_HL, "if (!estObjet(f) || f.uid !== uid || f.v !== VERSION_ATTENDU", "if (!estObjet(f) || f.v !== VERSION_ATTENDU"],
  // Le constat perdu à la fusion.
  'constat-perdu': [F_INV, '    ...(constat ? { constat } : {}) });', '    });'],
  // « À chercher » figé sans lecture.
  'constat-passu': [F_INV, 'manque: bilan.su ? ns(bilan.manque) : [],', 'manque: ns(bilan.manque),'],
  // `label_latest` gardé (la dernière capture du compte : une autre vente).
  'latest-garde': [F_PDF, "  if (/_label_latest$/.test(r)) return false;\n", ''],
  // Le bordereau d'un autre vendeur lu.
  'pdf-autre': [F_PDF, "      const r = await c.match(adressePdf(uid, row));", "      const r = (await c.match(adressePdf(uid, row))) || (await c.match(adressePdf('autre', row)));"],
  // La réserve sans borne.
  'pdf-sans-borne': [F_PDF, '    for (const k of cles.slice(0, Math.max(0, cles.length - PDF_MAX))) await c.delete(k);', ''],
};

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌/gm) || []).length;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (r.status !== 0 && rouges) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

let n = 0, ko = 0;
const dit = (c, m, d) => { n++; if (!c) ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + String(d).slice(0, 400) : ''}`); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le contrôle a tourné jusqu’au bout', e && e.stack); } };

// Une copie de src/ et api/_lib/ dans un dossier temporaire, la mutation posée
// (rien n'est jamais écrit dans le dépôt).
function copieMutee() {
  if (!mut) return { src: path.join(RACINE, 'src'), fin: () => {} };
  const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-inv-hl-'));
  fs.mkdirSync(path.join(dir, 'src')); fs.mkdirSync(path.join(dir, 'api', '_lib'), { recursive: true });
  fs.copyFileSync(path.join(RACINE, 'api', '_lib', 'numerotation.js'), path.join(dir, 'api', '_lib', 'numerotation.js'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  for (const f of [F_HL, F_INV, F_PDF]) {
    let t = fs.readFileSync(f, 'utf8');
    if (f === m[0]) { if (!t.includes(m[1])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); } t = t.replace(m[1], m[2]); }
    fs.writeFileSync(path.join(dir, 'src', path.basename(f)), t);
  }
  return { src: path.join(dir, 'src'), fin: () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} } };
}

// Un faux `caches` (l'API du navigateur) : des réserves nommées, l'ordre d'arrivée gardé.
function fauxCaches() {
  const res = new Map();
  return {
    res,
    async open(nom) {
      if (!res.has(nom)) res.set(nom, new Map());
      const m = res.get(nom);
      return {
        async put(k, r) { const b = new Uint8Array(await r.arrayBuffer()); m.delete(String(k)); m.set(String(k), b); },
        async match(k) { const b = m.get(String(k)); return b ? { ok: true, blob: async () => ({ size: b.length, octets: b }) } : undefined; },
        async keys() { return [...m.keys()]; },
        async delete(k) { return m.delete(String(k)); },
      };
    },
  };
}
const memoire = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };

(async () => {
  const copie = copieMutee();
  let HL, INV, PDF, N;
  try {
    HL = await import(pathToFileURL(path.join(copie.src, 'inventaireHorsLigne.js')).href);
    INV = await import(pathToFileURL(path.join(copie.src, 'inventaire.js')).href);
    PDF = await import(pathToFileURL(path.join(copie.src, 'bordereauxHorsLigne.js')).href);
    N = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'numerotation.js')).href);
  } catch (e) { console.log('❌ les règles ne se chargent pas : ' + e.message); process.exit(1); }
  finally { copie.fin(); }
  const cle = N.cleNum;
  const UID = '11111111-2222-3333-4444-555555555555', AUTRE = '99999999-8888-7777-6666-555555555555';

  // L'attendu du Stock (la forme que reçoit l'inventaire) : compte A lu, compte C en panne.
  const fichesCompte = { '1': 'A', '2': 'A', '3': 'A', '7': 'A', 'B125': 'A', '30': 'C', '60': 'A' };
  const jugeable = (k) => { const u = fichesCompte[k]; return u ? u === 'A' : false; };
  const art = (numero, titre, extra = {}) => ({ cle: cle(numero), numero, titre, photo: 'https://images.exemple/p.jpg', etat: 'enligne', plateformes: ['vinted'], comptes: ['A'], ...extra });
  const stock = {
    su: true, articles: [art('1', 'Même titre'), art('2', 'Même titre'), art('3', 'Même titre', { etat: 'masquee' }), art('B125', 'Vieille', { aussi: ['126'] }), art('40', 'eBay', { plateformes: ['ebay'], comptes: [] }), art('20', 'Vieille lecture', { etat: 'aconfirmer' })],
    manque: [{ nom: 'compte_c', plateforme: 'vinted', raison: 'lecture ratée' }],
    vendus: new Set(['7']), physiques: new Set(['1', '2', '7']), connues: new Set(['1', '2', '3', '7', 'B125', '30', '40', '60']), doublons: new Set(['2']),
    garder: { '55': 123 }, gardees: { '55': { numero: '55', titre: 'Gardée', photo: 'x' } }, slots: { '1': { m: 'm1', i: 0 } }, archive: 'B', jugeable,
  };
  const ESSAIS = ['1', '001', '2', '3', '7', '20', '30', '40', '55', '60', '125', 'B125', 'b125', '126', '777', 'B9', 'abc'];

  await essaie('H1 — la liste figée juge comme en ligne', () => {
    const f = HL.figerAttendu({ uid: UID, at: 1700000000000, stock, fichesCles: Object.keys(fichesCompte), meubles: [{ id: 'm1', name: 'Étagère', cols: 2, rows: 2 }], noms: { A: 'compte_a' } });
    dit(!!f, 'H1 un attendu LU se fige');
    const g = HL.degelerAttendu(JSON.parse(JSON.stringify(f)));
    const forme = (j) => JSON.stringify({ k: j.k, etat: j.etat, raison: j.raison, doublon: j.doublon, parti: j.parti, u: j.unite ? j.unite.cles : null });
    const diff = ESSAIS.filter((x) => forme(INV.jugerSaisie(x, stock, { cle })) !== forme(INV.jugerSaisie(x, g, { cle })));
    dit(diff.length === 0, `H1 chaque N° (${ESSAIS.length}) se juge EXACTEMENT comme en ligne, après gel/dégel par JSON`, diff.map((x) => `${x}: ${forme(INV.jugerSaisie(x, stock, { cle }))} ≠ ${forme(INV.jugerSaisie(x, g, { cle }))}`).join(' | '));
    let s = INV.nouvelleSession({ maintenant: 1, id: 'inv1' });
    for (const [i, k] of ['1', '2', '7', '60', '125', '777', 'B125'].entries()) s = INV.ajouterSaisie(s, { k: cle(k), s: k, at: 10 + i, sid: 's' + i });
    const bl = (b) => JSON.stringify(['manque', 'aConfirmer', 'trop', 'vendus', 'passu', 'doublons', 'attendus'].map((x) => b[x].map((v) => v.k || v.cles.join('+'))).concat([b.vendusNonVus, b.lectures.map((m) => m.nom), b.su]));
    const b1 = INV.bilanInventaire({ session: s, stock, cle }), b2 = INV.bilanInventaire({ session: s, stock: g, cle });
    dit(bl(b1) === bl(b2), 'H1 le bilan entier (à chercher, à vérifier, vendues, pas su, doublons, lectures nommées) est le même', bl(b1) + ' ≠ ' + bl(b2));
    dit(b2.manque.map((u) => u.numero).join(',') === '3,40,55' && b2.trop.map((v) => v.k).join(',') === '60' && b2.passu.map((v) => v.k).join(',') === '125,777', 'H1 hors connexion : à chercher 3, 40, 55 · à vérifier 60 · pas su 125, 777 (une lecture en panne : jamais « en trop »)', bl(b2));
  });

  await essaie('H2 — pas su, autre vendeur, rien de lourd', () => {
    dit(HL.figerAttendu({ uid: UID, at: 1, stock: { ...stock, su: false } }) === null, 'H2 une lecture « pas su » n’est JAMAIS figée');
    const f = HL.figerAttendu({ uid: UID, at: Date.now(), stock, fichesCles: Object.keys(fichesCompte) });
    const brut = JSON.stringify(f);
    dit(!/images\.exemple|"photo"/.test(brut) && !/function|=>/.test(brut), 'H2 ni photo ni règle dans la liste figée (des N°, des titres, des réponses)', brut.slice(0, 200));
    const st = memoire();
    dit(HL.ecrireAttendu(UID, f, st) === true && HL.lireAttendu(UID, st) && HL.lireAttendu(UID, st).uid === UID, 'H2 écrite et relue au nom de CE vendeur');
    dit(HL.ecrireAttendu(AUTRE, f, st) === false, 'H2 la liste d’un vendeur ne s’écrit pas sous la clé d’un autre');
    st.setItem(HL.cleAttendu(AUTRE), brut);
    dit(HL.lireAttendu(AUTRE, st) === null, 'H2 une clé à son nom dont le contenu nomme un AUTRE vendeur est refusée');
    dit(HL.lireAttendu('', st) === null && HL.lireAttendu('a b', st) === null, 'H2 sans vendeur valable : rien');
    dit(HL.ecrireAttendu(UID, { ...f, at: f.at + 1000 }, st, f.at + 2000) === false, 'H2 même contenu dans les 10 min : rien de réécrit');
    dit(/^vrm_/.test(HL.cleAttendu(UID)) && /^vrm_/.test(HL.cleAttente(UID)), 'H2 ses clés commencent par vrm_ : la déconnexion les efface (wipeLocalData)');
  });

  await essaie('H3 — le constat figé', () => {
    let s = INV.nouvelleSession({ maintenant: 100, id: 'inv2' });
    s = INV.ajouterSaisie(s, { k: '1', at: 110, sid: 'a' }); s = INV.ajouterSaisie(s, { k: '60', at: 120, sid: 'b' });
    const b = INV.bilanInventaire({ session: s, stock, cle });
    const c = INV.constatInventaire(b, { base: 1700000000000 });
    const fin = INV.terminerSession(s, 200, c);
    dit(fin.constat && fin.constat.at === 200 && fin.constat.base === 1700000000000 && fin.constat.manque.includes('2') && fin.constat.trop.join() === '60' && fin.constat.vus === 2, 'H3 « Terminer » garde le constat de CE jour-là (à chercher, à vérifier, l’heure de la liste)', JSON.stringify(fin.constat));
    const sansC = INV.terminerSession(s, 210);
    dit(!('constat' in sansC), 'H3 terminer sans constat n’invente rien');
    const ancien = INV.terminerSession(s, 150, { ...c, trop: [] });
    const f1 = INV.fusionnerSession(ancien, fin), f2 = INV.fusionnerSession(fin, ancien), f3 = INV.fusionnerSession(sansC, fin);
    dit(f1.constat && f1.constat.at === 200 && f2.constat && f2.constat.at === 200 && f3.constat && f3.constat.at === 200, 'H3 à la fusion (deux appareils), le constat le plus récent gagne, dans les deux sens ; jamais perdu', JSON.stringify([f1.constat && f1.constat.at, f2.constat && f2.constat.at, f3.constat && f3.constat.at]));
    const fi = INV.fusionnerInventaire({ courant: null, anciens: [fin] }, { courant: INV.nouvelleSession({ maintenant: 500, id: 'inv3' }), anciens: [] });
    dit(fi.anciens[0] && fi.anciens[0].constat && fi.anciens[0].constat.trop.join() === '60', 'H3 un inventaire précédent garde son constat dans « anciens »');
    const cPasSu = INV.constatInventaire(INV.bilanInventaire({ session: s, stock: { ...stock, su: false }, cle }));
    dit(cPasSu && cPasSu.su === false && cPasSu.manque.length === 0, 'H3 lecture pas faite : aucun « à chercher » figé (pas su ≠ manque)', JSON.stringify(cPasSu));
  });

  await essaie('H4 — rejouer ne double rien', async () => {
    let ligne = null, ecr = 0;
    const lire = async () => ({ existe: !!ligne, data: ligne ? JSON.parse(JSON.stringify(ligne)) : {} });
    const ecrire = async ({ existe, rev, data }) => { ecr++; if (!!ligne !== existe) return 'conflit'; if (ligne && ligne.rev !== rev) return 'conflit'; ligne = JSON.parse(JSON.stringify(data)); return 'ok'; };
    let s = INV.nouvelleSession({ maintenant: 1, id: 'inv9' });
    for (const [i, k] of ['3', '60', '125'].entries()) s = INV.ajouterSaisie(s, { k, at: 10 + i, sid: 'h' + i });
    const local = { courant: s, anciens: [] };
    const r1 = await INV.enregistrerInventaire({ lire, ecrire, local });
    const r2 = await INV.enregistrerInventaire({ lire, ecrire, local });
    dit(r1.ok && r1.ecrit && r2.ok && !r2.ecrit && ecr === 1 && Object.keys(ligne.courant.saisies).length === 3, 'H4 la même file envoyée deux fois : une écriture, trois saisies (union par saisie)', JSON.stringify({ r1: r1.ecrit, r2: r2.ecrit, ecr }));
    const rKo = await INV.enregistrerInventaire({ lire: async () => null, ecrire, local });
    dit(!rKo.ok && ecr === 1, 'H4 hors connexion (lecture impossible) : AUCUNE écriture');
  });

  await essaie('H5 — les bordereaux gardés', async () => {
    const ok = ['email_bord_70001', 'harvest_900000001_label_70001'];
    const non = ['harvest_900000001_label_latest', 'recu_70001', 'email_track_x', 'email_bord_1/../x', '', 'main', 'vrm_inventaire'];
    dit(ok.every(PDF.estLigneBordereau) && !non.some(PDF.estLigneBordereau), 'H5 seulement une ligne de bordereau (e-mail, capté par transaction) — jamais label_latest, un reçu, une autre ligne', JSON.stringify(non.filter(PDF.estLigneBordereau).concat(ok.filter((x) => !PDF.estLigneBordereau(x)))));
    const cs = fauxCaches();
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]);
    dit(await PDF.garderPdf(UID, 'email_bord_70001', pdf, cs) === true, 'H5 un bordereau ouvert est gardé');
    dit(await PDF.garderPdf(UID, 'harvest_900000001_label_latest', pdf, cs) === false, 'H5 label_latest n’est jamais gardé');
    const lu = await PDF.lirePdfGarde(UID, ['harvest_900000001_label_70001', 'email_bord_70001'], cs);
    dit(lu && lu.size === pdf.length, 'H5 relu pour CE vendeur (le capté d’abord, l’e-mail ensuite)');
    dit(await PDF.lirePdfGarde(AUTRE, ['email_bord_70001'], cs) === null, 'H5 un autre vendeur ne lit pas ce bordereau');
    for (let i = 0; i < PDF.PDF_MAX + 7; i++) await PDF.garderPdf(UID, 'email_bord_' + (80000 + i), pdf, cs);
    const n = (await (await cs.open(PDF.CACHE_PDF)).keys()).length;
    dit(n === PDF.PDF_MAX && !(await PDF.lirePdfGarde(UID, ['email_bord_70001'], cs)), `H5 au plus ${PDF.PDF_MAX} bordereaux, les plus anciens partent d’abord`, String(n));
    dit(JSON.stringify(PDF.lignesPdfPhoto(['harvest_9_label_70001', null, 'email_bord_70001', 'email_bord_70001', 'harvest_9_label_latest'])) === '["harvest_9_label_70001","email_bord_70001"]', 'H5 la photo ne porte que les lignes de bordereau de LA vente (dédoublonnées, au plus deux)');
  });

  await essaie('H6 — le branchement dans l’app et le service worker', () => {
    const sans = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/[^\n]*/gm, '');
    const app = sans(fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8'));
    const sw = sans(fs.readFileSync(path.join(RACINE, 'public', 'sw.js'), 'utf8'));
    const stockEcran = sans(fs.readFileSync(path.join(RACINE, 'src', 'ecrans', 'Stock.jsx'), 'utf8'));
    dit(/!k\.startsWith\('vrm-hl-'\)/.test(sw) && /k !== CACHE && k !== CACHE_QR/.test(sw), 'H6 le service worker garde les réserves du hors connexion (vrm-hl-*) à la mise à jour');
    dit(/self\.addEventListener\('push'/.test(sw) && /self\.addEventListener\('notificationclick'/.test(sw) && /pushsubscriptionchange/.test(sw), 'H6 les notifications du service worker sont intactes');
    dit(/caches\.delete\(CACHE_PDF\)/.test(app), 'H6 la déconnexion vide la réserve des bordereaux');
    const lp = app.slice(app.indexOf('const lirePdfLigne = async'), app.indexOf('const lirePdfLigne = async') + 1500);
    dit(/if \(!entetes && AUTH\.user && AUTH\.user\.id && estLigneBordereau\(rowId\)\)/.test(lp) && /garderPdf\(AUTH\.user\.id, rowId, octets\)/.test(lp), 'H6 lirePdfLigne garde le bordereau pour CE vendeur seulement (jamais une lecture d’équipe)');
    dit(/pdf: lignesPdfPhoto\(\[cap && cap\.row, b && b\.hasPdf \? b\._row : null\]\)/.test(app), 'H6 la photo relie la vente à SES lignes de bordereau (transaction → capté, e-mail)');
    dit(/useRejouerInventaire\(nuagePret && !exempleActif\(\)\)/.test(app) && /window\.addEventListener\('online', f\)/.test(app), 'H6 l’app rejoue l’inventaire au retour du réseau (après la session)');
    const bloc = app.slice(app.indexOf('function BlocInventaireHorsLigne'), app.indexOf('let _rejeuInventaire'));
    dit(/lire=\{lireInventaireHl\}/.test(bloc) && /ecrire=\{ecrireInventaireHl\}/.test(bloc) && /const lireInventaireHl = async \(\) => null;/.test(app) && /const ecrireInventaireHl = async \(\) => 'ko';/.test(app), 'H6 hors connexion, l’inventaire ne lit ni n’écrit la base (lecture « pas su » ⇒ aucune écriture)');
    dit(!/\bsave\(|saveTout\(|vinted_annonce_numeros|vinted_used_numeros|vrm_slots/.test(bloc), 'H6 l’inventaire hors connexion n’écrit AUCUN N° (ni fiche, ni pool, ni case)');
    dit(/figerAttendu\(\{ uid: uidV, at: Date\.now\(\), stock: st/.test(stockEcran) && /if \(!st \|\| !st\.su\) return;/.test(stockEcran), 'H6 le Stock fige SA liste (la même que la feuille, `fabriquerStockInv`), seulement lue');
    dit(/if \(tab === 'garage'\) return \(/.test(app) && /<BlocInventaireHorsLigne uid=\{uid\}\/>/.test(app), 'H6 hors connexion, le Stock et Ma journée proposent l’inventaire');
  });

  await essaie('H7 — la vibration', () => {
    const f = ['attendu', 'trop', 'vendu', 'doublon', 'illisible', 'passu'].map((e) => JSON.stringify(HL.motifVibration(e)));
    dit(f[0] !== f[1] && f[1] === f[2] && f[3] !== f[0] && f[3] !== f[1] && new Set([f[0], f[1], f[3], f[4], f[5]]).size === 5, 'H7 une forme par jugement : courte (attendu), double (un geste), longue (deux paires sous un N°)', f.join(' '));
  });

  console.log(`\n${n - ko}/${n} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
