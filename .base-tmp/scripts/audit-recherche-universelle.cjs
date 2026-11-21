#!/usr/bin/env node
// ── audit-recherche-universelle — LA LOUPE QUI TROUVE TOUT (6 novembre, v36) ───
// Exécute les VRAIES règles (src/rechercheUnique.js, src/rechercheEcran.js, le
// filtre des e-mails api/_lib/reception-email.js `filtreRecherche`) sur des
// données INVENTÉES au volume mesuré dans sa base le 6 nov. (lecture seule :
// 2 934 ventes, 2 719 achats, 557 annonces en ligne, 992 e-mails) — ici 3 000
// ventes, 2 800 achats, 600 annonces, 2 000 fiches N°, 1 000 e-mails, 400 colis.
// Ce qu'il exige :
//   1. une requête de CHAQUE type trouve le bon objet : N° (partiel et exact),
//      pseudo, n° de suivi, code de retrait (⇒ son colis, ouvert « En grand »),
//      n° de transaction, montant (« 52 € », « 52,00 », « 52.5 » — au centime),
//      mots du titre, marque et taille (champs de l'annonce), n° de facture,
//      e-mail (le filtre côté base de l'écran E-mails) ;
//   2. 50 paires au MÊME titre ⇒ 50 résultats distincts (50 clés, 50 N°, 50
//      fiches ouvertes), jamais fusionnés ; une annonce qui a une fiche est
//      CETTE paire (même id), jamais une seconde ligne ; une vente ne prend un N°
//      que par SA transaction, jamais par son titre ;
//   3. « 52 » seul n'est pas un montant ; 52,01 € ne sort pas pour « 52 € » ;
//   4. vitesse : index + recherche < 300 ms sur ce volume, une frappe < 16 ms ;
//   5. lectures : la loupe ne lit aucune ligne entière (`select=data`) — e-mails
//      par la route projetée de l'écran E-mails, factures en scalaires ;
//   6. frappe fluide : valeur différée, une requête e-mails par pause (250 ms),
//      la précédente ANNULÉE ; mode stream : pseudo et code en `vrm-sensible`,
//      récents tus en stream ; une réponse e-mails illisible = « pas su » (null).
//   node scripts/audit-recherche-universelle.cjs [--mutation=NOM | --prouve]
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RAC = path.join(__dirname, '..');
const F_REGLE = path.join(RAC, 'src', 'rechercheUnique.js');
const F_ECRAN = path.join(RAC, 'src', 'rechercheEcran.js');
const F_APP = path.join(RAC, 'src', 'App.jsx');
const F_RECEPTION = path.join(RAC, 'api', '_lib', 'reception-email.js');

// [fichier, avant, après] — chaque défaut d'avant, remis exprès : il faut du ROUGE.
const MUTATIONS = {
  'paire-par-titre': ['regle', "entrees.push({ type: 'paire', cle: 'paire:' + id,", "entrees.push({ type: 'paire', cle: 'paire:' + normaliser(f.title),"],
  'annonce-en-double': ['regle', 'if (!a || a.id == null || avecFiche.has(str(a.id))) continue;', 'if (!a || a.id == null) continue;'],
  'montant-a-peu-pres': ['regle', 'if (e.montants && e.montants.includes(cents))', 'if (e.montants && e.montants.some((m) => Math.abs(m - cents) <= 100))'],
  'montant-nu': ['regle', 'if (dec == null && !signe) return null;', ''],
  'code-sans-grand': ['regle', "...(r.par === 'code' ? { grand: true } : {})", ''],
  'groupe-borne': ['regle', "const maxDe = (t) => (max && typeof max === 'object' ? (Number.isFinite(max[t]) ? max[t] : MAX_PAR_GROUPE) : max);", 'const maxDe = () => MAX_PAR_GROUPE;'],
  'vente-num-titre': ['ecran', "for (const [tx, item] of Object.entries(txnItem)) { const f = F[str(item)];", "for (const [tx, item] of Object.entries(txnItem)) { const f = Object.values(F)[0];"],
  'emails-vide': ['ecran', "if (!j || j.ok !== true || !Array.isArray(j.emails)) return null;", "if (!j || j.ok !== true || !Array.isArray(j.emails)) return [];"],
  'sans-delai': ['app', 'return piloterEmails({ fil: FIL_RECHERCHE, delai: 250,', 'return piloterEmails({ fil: FIL_RECHERCHE, delai: 0,'],
  'sans-annulation': ['ecran', 'minuterie.annuler(t); t = null; if (ctl) ctl.abort(); ctl = null;', 'minuterie.annuler(t); t = null; ctl = null;'],
  'minuteur-garde': ['ecran', 'minuterie.annuler(t); t = null; if (ctl) ctl.abort(); ctl = null;', 'if (ctl) ctl.abort(); ctl = null;'],
  'montant-aux-emails': ['ecran', "if (!m || montant(q) || !actif())", "if (!m || !actif())"],
  'coque-redessinee': ['app', 'const setGsQ=poserTexteRecherche;', "const [gsQ,setGsQ]=useState('');"],
  'factures-entieres': ['app', 'const facturesPro=await fetchProInvoices({ metadata: true })', 'const facturesPro=await fetchProInvoices()'],
  'pseudo-en-clair': ['app', "const sensible = r.par === 'pseudo' ? 'acheteur' : r.par === 'code' ? 'code' : null;", 'const sensible = null;'],
  'recents-en-stream': ['app', '{!streamOn && gsRecents.length > 0 &&', '{gsRecents.length > 0 &&'],
  'frappe-synchrone': ['app', 'const qBrut = gsQLent;', 'const qBrut = gsQ;'],
};

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ancre = /ancre de mutation introuvable/.test(r.stdout || '');
    const pris = r.status !== 0 && rouges && !ancre;
    console.log(`${pris ? '✅' : '❌'} mutation « ${m} » : ${ancre ? 'ANCRE INTROUVABLE' : rouges + ' rouge(s)'}`);
    if (pris) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

// Retire les commentaires sans toucher aux chaînes.
function sansCommentaires(t) {
  let o = '', i = 0, q = null;
  while (i < t.length) {
    const c = t[i], n = t[i + 1];
    if (q) { o += c; if (c === '\\') { o += n || ''; i += 2; continue; } if (c === q) q = null; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; o += c; i++; continue; }
    if (c === '/' && n === '/' && t[i - 1] !== ':') { while (i < t.length && t[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { const f = t.indexOf('*/', i + 2); i = f < 0 ? t.length : f + 2; continue; }
    o += c; i++;
  }
  return o;
}

(async () => {
  for (const f of [F_REGLE, F_ECRAN, F_APP]) if (!fs.existsSync(f)) { console.log('❌ ' + path.relative(RAC, f) + ' absent : la loupe universelle n’existe pas'); process.exit(1); }
  const src = { regle: fs.readFileSync(F_REGLE, 'utf8'), ecran: fs.readFileSync(F_ECRAN, 'utf8'), app: fs.readFileSync(F_APP, 'utf8') };
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    if (!src[m[0]].includes(m[1])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    src[m[0]] = src[m[0]].replace(m[1], m[2]);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loupe-'));
  fs.writeFileSync(path.join(dir, 'r.mjs'), src.regle); fs.writeFileSync(path.join(dir, 'e.mjs'), src.ecran);
  let R, E, REC;
  try { R = await import(pathToFileURL(path.join(dir, 'r.mjs')).href); E = await import(pathToFileURL(path.join(dir, 'e.mjs')).href); }
  catch (e) { console.log('❌ les règles ne se chargent pas : ' + e.message); process.exit(1); }
  try { REC = await import(pathToFileURL(F_RECEPTION).href); } catch (e) { console.log('❌ api/_lib/reception-email.js ne se charge pas : ' + e.message); process.exit(1); }
  if (typeof R.montantCherche !== 'function' || typeof R.suggestions !== 'function' || typeof E.numerosDesVentes !== 'function') { console.log('❌ la règle ne connaît ni les montants, ni les paires, ni les suggestions'); process.exit(1); }

  let ko = 0, n = 0;
  const dit = (c, msg, det) => { n++; if (c) console.log('✅ ' + msg); else { ko++; console.log('❌ ' + msg + (det !== undefined ? ' — ' + JSON.stringify(det).slice(0, 300) : '')); } };
  const essaie = (nom, fn) => { try { fn(); } catch (e) { ko++; n++; console.log('❌ ' + nom + ' a levé : ' + (e && e.stack || e).toString().split('\n').slice(0, 2).join(' ')); } };

  // ── LES DONNÉES (inventées, forme lue par l'app) ─────────────────────────
  const MARQUES = ['Nike', 'Adidas', 'Salomon', 'Asics', 'New Balance', 'Puma'];
  const MODELES = ['Air Max 90', 'Samba OG', 'XT-6', 'Gel-Kayano 14', '550', 'Speedcat'];
  const iso = (i) => new Date(Date.UTC(2026, 9, 1) + i * 6e5).toISOString();
  const prix = (i) => ({ amount: String(60 + (i % 90) + ((i % 3) ? '.0' : '.5')), currency_code: 'EUR' });
  const ventes = Array.from({ length: 3000 }, (_, i) => ({ transaction_id: 22000000000 + i, title: `${MARQUES[i % 6]} ${MODELES[i % 6]} taille ${36 + (i % 10)}`, status: 'Commande finalisée', date: iso(i), price: prix(i), photo: { url: `https://exemple.test/v${i}.jpg` } }));
  const T = 'Jordan 1 Mid Chicago taille 42';
  // Deux ventes au MÊME titre : seule la première a sa transaction reliée à une annonce (txnItem).
  ventes.push({ transaction_id: 22999990001, title: T, status: 'Bordereau envoyé au vendeur', date: iso(5000), price: { amount: '52.0', currency_code: 'EUR' } });
  ventes.push({ transaction_id: 22999990002, title: T, status: 'Bordereau envoyé au vendeur', date: iso(5001), price: { amount: '52.01', currency_code: 'EUR' } });
  const achats = Array.from({ length: 2800 }, (_, i) => ({ transaction_id: 23000000000 + i, title: `Achat ${MARQUES[(i + 2) % 6]} ${MODELES[(i + 1) % 6]}`, status: 'Commande expédiée', date: iso(i), price: prix(i + 7) }));
  achats.push({ transaction_id: 23999990001, title: 'Veja Campo blanc', status: 'Commande expédiée', date: iso(6000), price: { amount: '52.5', currency_code: 'EUR' } });
  const pseudos = ventes.slice(0, 1500).map((o, i) => ({ tx: String(o.transaction_id), pseudo: 'acheteuse_' + i }));
  pseudos.push({ tx: '22999990001', pseudo: 'poupacho' });
  const bordereaux = ventes.slice(0, 1500).map((o, i) => ({ tx: String(o.transaction_id), suivi: 'XW' + String(300000000 + i) + 'FR' }));
  const colis = Array.from({ length: 400 }, (_, i) => ({ id: 'email_track_' + i, suivi: 'MR' + (7000000 + i), code: String(500000 + i), status: i % 2 ? 'available' : 'delivered', sens: 'entrant', art: `Colis ${MARQUES[i % 6]}`, carrier: 'mondialrelay', at: iso(i) }));
  // 2 000 fiches N° (dont 50 au MÊME titre), 600 annonces en ligne (dont 300 qui ont une fiche).
  const fiches = {};
  for (let i = 1; i <= 2000; i++) fiches['it' + i] = { numero: String(i), title: i > 1900 && i <= 1950 ? T : `${MARQUES[i % 6]} ${MODELES[i % 6]} taille ${36 + (i % 10)}`, price: String(30 + (i % 50)), buyPrice: String(10 + (i % 20)), accountId: '111' };
  fiches.itB125 = { numero: 'B125', title: 'Ancienne paire archive', price: '45', accountId: '111' };
  const annonces = [];
  for (let i = 1; i <= 300; i++) annonces.push({ id: 'it' + i, title: fiches['it' + i].title, brand: MARQUES[i % 6], size: String(36 + (i % 10)), price: { amount: String(30 + (i % 50)) + '.0' }, photo: `https://exemple.test/a${i}.jpg`, uid: '111' });
  for (let i = 0; i < 300; i++) annonces.push({ id: 'libre' + i, title: `Annonce libre ${i}`, brand: i === 7 ? 'Onitsuka Tiger' : MARQUES[i % 6], size: i === 7 ? '44,5' : String(36 + (i % 10)), price: { amount: '61.0' }, photo: '', uid: '111' });
  const txnItem = { 22999990001: 'it1901' };   // la 1re jumelle de titre est reliée à SON annonce
  const factures = E.facturesPourRecherche(
    [{ id: 'f1', number: '2026-0042', productId: '22999990001', itemName: 'Jordan 1 Mid Chicago', buyerName: 'Camille Exemple', sellPrice: '52', saleDate: '2026-11-01' }],
    [{ _id: 'email_invoice_tx77', number: 'PRO-2026-0007', designation: 'Salomon XT-6 gris', prix: 88.4, createdAt: '2026-11-02T10:00:00Z' }, { _id: 'email_invoice_brouillon', number: '', designation: 'brouillon' }]);
  const numerosTx = E.numerosDesVentes(fiches, txnItem, { 22999990002: null });
  const S = { ventes, achats, pseudos, bordereaux, colis, fiches, annonces, factures, numerosTx };

  let tIndex = 0, idx = null;
  essaie('index', () => {
    const t0 = performance.now(); idx = R.indexRecherche(S); tIndex = performance.now() - t0;
    dit(idx.n > 8000, `index de ${idx.n} entrées (ventes, achats, colis, fiches, annonces, factures)`, idx.n);
  });
  const ch = (q, o) => R.chercherPartout(idx, q, { max: 500, ...(o || {}) });
  const cles = (res, g) => res.groupes[g].map((r) => r.e.cle);

  essaie('chaque type trouve SON objet', () => {
    let r = ch('141');
    dit(r.groupes.paire.some((x) => x.e.numero === '141'), '« 141 » ⇒ la paire N°141 (N° partiel)', cles(r, 'paire').slice(0, 5));
    r = ch('141', { numero: '141' });
    dit(r.groupes.paire[0] && r.groupes.paire[0].e.numero === '141' && r.groupes.paire[0].exact && r.groupes.paire[0].par === 'numero', '« 141 » (clé du N° donnée) ⇒ N°141 en tête, exact (laissé à « Tout sur le N° »)', r.groupes.paire.slice(0, 2).map((x) => [x.e.numero, x.exact]));
    r = ch('B125', { numero: 'B125' });
    dit(r.groupes.paire.length >= 1 && r.groupes.paire[0].e.numero === 'B125' && r.groupes.paire[0].exact, '« B125 » ⇒ la paire d’archive B125, jamais la N°125', r.groupes.paire.slice(0, 3).map((x) => x.e.numero));
    dit(!ch('B125', { numero: 'B125' }).groupes.paire.some((x) => x.e.numero === '125' && x.exact), '« B125 » n’est pas la N°125');
    r = ch('poupacho');
    dit(cles(r, 'vente').join() === 'vente:22999990001' && r.groupes.vente[0].par === 'pseudo', 'pseudo ⇒ SA vente (transaction de l’e-mail), pas la jumelle de titre', cles(r, 'vente'));
    r = ch('XW300000777FR');
    dit(cles(r, 'vente').join() === 'vente:22000000777' && r.groupes.vente[0].par === 'suivi', 'n° de suivi ⇒ SA vente', cles(r, 'vente'));
    r = ch('500123');
    dit(cles(r, 'retrait').join() === 'colis:MR7000123' && r.groupes.retrait[0].par === 'code', 'code de retrait ⇒ LE bon colis (parmi 400)', cles(r, 'retrait'));
    const d = R.destinationResultat(r.groupes.retrait[0]);
    dit(d && d.tab === 'cat_bord' && d.cible.type === 'retrait' && d.cible.suivi === 'MR7000123' && d.cible.grand === true, 'le colis trouvé par son code s’ouvre « En grand » (sa carte, par son n° de suivi)', d);
    const d2 = R.destinationResultat(ch('MR7000123').groupes.retrait[0]);
    dit(d2 && !d2.cible.grand, 'trouvé par son n° de suivi : la carte, sans « En grand »', d2);
    r = ch('22000002999');
    dit(cles(r, 'vente').join() === 'vente:22000002999' && r.groupes.vente[0].exact, 'n° de transaction ⇒ SA vente', cles(r, 'vente'));
    r = ch('52 €');
    dit(cles(r, 'vente').join() === 'vente:22999990001' && r.groupes.vente[0].par === 'montant', '« 52 € » ⇒ la vente à 52,00 € (pas celle à 52,01 €)', cles(r, 'vente'));
    dit(r.groupes.facture.length === 1 && r.groupes.facture[0].e.facture === '2026-0042', '« 52 € » ⇒ aussi la facture à 52 €', cles(r, 'facture'));
    dit(cles(ch('52,01'), 'vente').join() === 'vente:22999990002', '« 52,01 » ⇒ la vente à 52,01 € seulement', cles(ch('52,01'), 'vente'));
    dit(cles(ch('52.5'), 'achat').join() === 'achat:23999990001', '« 52.5 » ⇒ l’achat à 52,50 €', cles(ch('52.5'), 'achat'));
    dit(R.montantCherche('52') === null && R.montantCherche('52,00') === 5200 && R.montantCherche('52 €') === 5200 && R.montantCherche('52€') === 5200 && R.montantCherche('52.5') === 5250, '« 52 » seul n’est pas un montant ; « 52,00 », « 52 € », « 52€ », « 52.5 » le sont', [R.montantCherche('52'), R.montantCherche('52,00'), R.montantCherche('52.5')]);
    dit(!ch('52').groupes.vente.some((x) => x.par === 'montant'), '« 52 » ne cherche aucun prix');
    r = ch('samba og taille 37');
    dit(r.groupes.vente.length > 0 && r.groupes.vente.every((x) => /Samba OG taille 37/.test(x.e.titre)), 'mots du titre (tout ordre) ⇒ les ventes qui les portent', r.groupes.vente.slice(0, 2).map((x) => x.e.titre));
    r = ch('onitsuka 44,5');
    dit(cles(r, 'annonce').join() === 'annonce:libre7', 'marque + taille (champs de l’annonce, pas du titre) ⇒ L’annonce', cles(r, 'annonce'));
    r = ch('PRO-2026-0007');
    dit(cles(r, 'facture').length === 1 && r.groupes.facture[0].par === 'facture', 'n° de facture Pro ⇒ SA facture', cles(r, 'facture'));
    const df = R.destinationResultat(r.groupes.facture[0]);
    dit(df && df.tab === 'invoices' && df.facture === '', 'une facture Pro ouvre Factures (la liste des Pro, en tête), sans chercher dans la liste des factures saisies', df);
    const dl = R.destinationResultat(ch('2026-0042').groupes.facture[0]);
    dit(dl && dl.tab === 'invoices' && dl.facture === '2026-0042', 'une facture saisie ouvre Factures cherchée sur SON n°', dl);
    dit(!factures.some((f) => f.titre === 'brouillon'), 'un brouillon de facture sans n° n’est pas une facture');
    r = ch('22999990001');
    dit(r.groupes.facture.some((x) => x.e.facture === '2026-0042'), 'le n° d’article de la facture (sa référence) la trouve aussi', cles(r, 'facture'));
    r = ch('camille');
    dit(cles(r, 'facture').length === 1 && r.groupes.facture[0].par === 'pseudo', 'l’acheteur d’une facture la trouve (pastille masquée en stream)', cles(r, 'facture'));
  });

  essaie('50 paires au même titre', () => {
    const r = ch('jordan chicago');
    const p = r.groupes.paire;
    const nums = new Set(p.map((x) => x.e.numero));
    const ks = new Set(p.map((x) => x.e.cle));
    dit(p.length === 50 && r.totaux.paire === 50 && ks.size === 50 && nums.size === 50, '50 fiches au même titre ⇒ 50 lignes, 50 clés, 50 N° distincts', [p.length, r.totaux.paire, ks.size, nums.size]);
    const dests = new Set(p.map((x) => (R.destinationResultat(x) || {}).fiche));
    dit(dests.size === 50, 'chacune ouvre SA fiche (50 N° ouverts, jamais la même)', dests.size);
    const r2 = R.chercherPartout(idx, 'jordan chicago', { max: { paire: 12 } });
    dit(r2.groupes.paire.length === 12 && r2.totaux.paire === 50, '12 montrées, « Voir les 38 autres » (le total est gardé, rien n’est fusionné)', [r2.groupes.paire.length, r2.totaux.paire]);
    dit(cles(r, 'vente').sort().join() === 'vente:22999990001,vente:22999990002', 'les deux ventes au même titre : deux lignes', cles(r, 'vente'));
    const v1 = r.groupes.vente.find((x) => x.e.tx === '22999990001'), v2 = r.groupes.vente.find((x) => x.e.tx === '22999990002');
    dit(v1 && v1.e.numero === '1901' && v2 && v2.e.numero === '', 'le N° d’une vente vient de SA transaction (→ son annonce → sa fiche) ; la jumelle de titre n’en reçoit aucun', [v1 && v1.e.numero, v2 && v2.e.numero]);
  });

  essaie('annonces et fiches : une paire, une ligne', () => {
    const p = idx.entrees.filter((e) => e.type === 'paire' && e.id === 'it10');
    const a = idx.entrees.filter((e) => e.type === 'annonce' && e.id === 'it10');
    dit(p.length === 1 && a.length === 0 && p[0].enLigne === true, 'une annonce en ligne qui a une fiche N° est CETTE paire (même id) : une ligne, « en ligne »', [p.length, a.length, p[0] && p[0].enLigne]);
    const p2 = idx.entrees.find((e) => e.type === 'paire' && e.id === 'it1500');
    dit(p2 && p2.enLigne === false, 'une fiche dont l’annonce n’est pas dans le dressing lu : « pas en ligne »', p2 && p2.enLigne);
    const sans = R.indexRecherche({ ...S, annonces: null }).entrees.find((e) => e.type === 'paire' && e.id === 'it10');
    dit(sans && sans.enLigne === null, 'dressing pas lu ⇒ « en ligne » pas su (null), jamais « retirée »', sans && sans.enLigne);
    dit(idx.entrees.filter((e) => e.type === 'annonce').length === 300, 'les 300 annonces sans fiche sont dans « Annonces sans N° »');
    const rA = ch('annonce libre 142'); const dA = R.destinationResultat(rA.groupes.annonce[0]);
    dit(rA.groupes.annonce.length === 1 && dA && dA.tab === 'cat_annonces' && dA.cible.type === 'annonce' && dA.cible.id === 'libre142', 'une annonce sans N° ouvre SA carte (son id)', dA);
  });

  essaie('e-mails : le moteur de l’écran E-mails', () => {
    // 1 000 lignes `email_reception_*` (forme de la base) ; le filtre `or=(…ilike…)` est
    // INTERPRÉTÉ comme PostgREST le ferait (ilike, `*` = n'importe quoi, insensible à la casse).
    const rows = Array.from({ length: 1000 }, (_, i) => ({ id: 'email_reception_' + 'abcdef' + String(i).padStart(10, '0'), data: { subject: i === 321 ? 'Ton colis est arrivé' : `Information ${i}`, from: 'no-reply@vinted.fr', resume: i === 321 ? { t: 'suivi', st: 'available', code: '913377', s: 'MR8800321', a: 'Asics Gel-Kayano' } : { t: 'vente', a: `${MARQUES[i % 6]} ${MODELES[i % 6]}` } } }));
    const lit = (row, col) => { let v = row.data; for (const k of col.replace(/^data->>?/, '').split(/->>|->/)) v = v == null ? null : v[k]; return v == null ? '' : String(v); };
    const filtrer = (q) => {
      const f = REC.filtreRecherche(q); if (!f) return null;
      const corps = decodeURIComponent(f.replace(/^or=/, '')).replace(/^\(|\)$/g, '');
      const parts = corps.split(/,(?=data->)/).map((p) => { const m = /^(.+?)\.ilike\."(.*)"$/.exec(p); return m && { col: m[1], re: new RegExp('^' + m[2].split('*').map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'is') }; }).filter(Boolean);
      return rows.filter((r) => parts.some((p) => p.re.test(lit(r, p.col))));
    };
    const t0 = performance.now();
    const a = filtrer('913377'), b = filtrer('MR8800321'), c = filtrer('gel-kayano');
    const tMail = performance.now() - t0;
    dit(a && a.length === 1 && a[0].id.endsWith('abcdef' + String(321).padStart(10, '0')), 'code de retrait ⇒ L’e-mail du colis (côté base, sur les 1 000)', a && a.length);
    dit(b && b.length === 1 && c && c.some((x) => x === a[0]), 'n° de suivi et mots de l’article ⇒ le même e-mail', [b && b.length, c && c.length]);
    dit(E.requeteEmails('52 €') === '52' && E.requeteEmails('a') === '' && E.requeteEmails('Gel-Kayano') === 'Gel-Kayano', 'le mot envoyé : réduit comme côté serveur, rien sous 2 caractères (l’écran n’envoie aucun montant)', [E.requeteEmails('52 €'), E.requeteEmails('a')]);
    const lu = E.emailsDeLaReponse({ ok: true, emails: [{ id: rows[321].id, subject: 'x' }, { id: 'email_inconnu_1' }], suite: false });
    dit(Array.isArray(lu) && lu.length === 1 && lu[0].cle === 'email:' + rows[321].id, 'la réponse de la route ⇒ une ligne par e-mail de la boîte (son id), rien d’autre', lu);
    dit(E.emailsDeLaReponse({ ok: false }) === null && E.emailsDeLaReponse(null) === null && E.emailsDeLaReponse({ ok: true, emails: 'x' }) === null, 'une réponse illisible n’est PAS « aucun e-mail » : null (pas su)');
    console.log(`   (filtre e-mails émulé sur 1 000 lignes : ${tMail.toFixed(1)} ms pour 3 requêtes ; mesuré sur sa base : 7 ms par requête)`);
  });

  essaie('vitesse', () => {
    const qs = ['141', 'nike air', 'poupacho', 'XW300000777FR', '500123', '22000002999', '52 €', 'samba og taille 37', 'onitsuka 44,5', 'PRO-2026-0007', 'jordan chicago', 'a', 'ad', 'adi', 'adid', 'adida', 'adidas'];
    const t0 = performance.now();
    for (let k = 0; k < 3; k++) for (const q of qs) R.chercherPartout(idx, q, { max: { paire: 12, vente: 8, achat: 8, colis: 8, annonce: 8, facture: 6 } });
    const parFrappe = (performance.now() - t0) / (3 * qs.length);
    dit(tIndex + parFrappe < 300, `première recherche (index ${Math.round(tIndex)} ms + frappe ${parFrappe.toFixed(1)} ms) < 300 ms sur ${idx.n} entrées`, [tIndex, parFrappe]);
    dit(parFrappe < 16, `une frappe : ${parFrappe.toFixed(1)} ms (< 16 ms, une image)`, parFrappe);
    const I1 = R.indexMemo(S); const t1 = performance.now(); const I2 = R.indexMemo({ ...S }); const tMemo = performance.now() - t1;
    dit(I1 === I2 && tMemo < 5, 'les mêmes sources ⇒ le MÊME index (mémo, aucune reconstruction à la frappe)', tMemo);
    let k = 0; const f = () => { k++; return { v: k }; };
    const a = E.memoSur('x', [S.fiches, S.annonces], f), b = E.memoSur('x', [S.fiches, S.annonces], f), c = E.memoSur('x', [S.fiches, null], f);
    dit(a === b && c !== a && k === 2, 'le mémo de l’écran ne recalcule que si une source change', k);
    const sg = R.suggestions(idx, { n: 3 });
    dit(sg.colis.length === 3 && sg.colis.every((x) => x.e.c.status === 'available' && x.e.codes.length) && sg.ventes.length === 3, 'champ vide : 3 colis à retirer (avec code) et 3 dernières ventes, par identité', [sg.colis.length, sg.ventes.length]);
  });

  essaie('récents de l’appareil', () => {
    const mem = { m: {}, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = String(v); }, removeItem(k) { delete this.m[k]; } };
    E.noterRecent('141', mem); E.noterRecent('poupacho', mem); E.noterRecent('141', mem);
    dit(E.lireRecents(mem).join() === '141,poupacho', 'les récents : le plus récent d’abord, sans doublon', E.lireRecents(mem));
    for (let i = 0; i < 10; i++) E.noterRecent('q' + i, mem);
    dit(E.lireRecents(mem).length === E.MAX_RECENTS, `au plus ${E.MAX_RECENTS}`);
    const casse = { getItem() { throw new Error('bloqué'); }, setItem() { throw new Error('bloqué'); }, removeItem() { throw new Error('bloqué'); } };
    dit(Array.isArray(E.lireRecents(casse)) && Array.isArray(E.noterRecent('x', casse)) && Array.isArray(E.oublierRecents(casse)), 'un stockage bloqué (navigation privée) ne fait rien tomber');
  });

  await (async () => {
    // LE PILOTE DES E-MAILS, EXÉCUTÉ : minuterie et requête simulées.
    try {
      const fil = E.creerFil({ q: '', emails: null, max: { q: '', m: {} } });
      const minut = []; const minuterie = { poser: (f, ms) => { const x = { f, ms, mort: false }; minut.push(x); return x; }, annuler: (x) => { if (x) x.mort = true; } };
      const appels = [], signaux = [];
      const chercher = async (m, signal) => { appels.push(m); signaux.push(signal); return { ok: true, emails: [{ id: 'email_reception_' + 'a'.repeat(16) }], suite: false }; };
      const stop = E.piloterEmails({ fil, chercher, minuterie, delai: 250, montant: (q) => R.montantCherche(q) != null });
      for (const q of ['g', 'ge', 'gel', 'gel-', 'gel-k', 'gel-ka']) fil.poser({ q });
      const vivants = minut.filter((x) => !x.mort);
      dit(vivants.length === 1 && vivants[0].ms >= 150, `pilote : six lettres tapées ⇒ UN minuteur vivant (${vivants.length}), pause ${vivants[0] && vivants[0].ms} ms`, minut.map((x) => x.mort));
      dit(fil.lire().emails && fil.lire().emails.q === 'gel-ka' && fil.lire().emails.liste === undefined, 'pilote : « en cours » posé pour le dernier texte');
      await vivants[0].f();
      dit(appels.join() === 'gel-ka' && Array.isArray(fil.lire().emails.liste) && fil.lire().emails.liste.length === 1, 'pilote : une seule requête, pour le texte final ; la liste est posée', appels);
      fil.poser({ q: 'gel-kay' });
      const t2 = minut.filter((x) => !x.mort).pop();
      const p2 = t2.f(); fil.poser({ q: 'gel-kaya' });
      await p2;
      dit(signaux[1] && signaux[1].aborted === true, 'pilote : une lettre de plus ANNULE la requête en vol', signaux.map((x) => x && x.aborted));
      dit(fil.lire().emails && fil.lire().emails.q === 'gel-kaya', 'pilote : la réponse annulée n’écrase pas le texte suivant', fil.lire().emails);
      const n0 = minut.length; fil.poser({ q: '52 €' });
      dit(minut.length === n0 && fil.lire().emails === null, 'pilote : un montant n’envoie rien chez les e-mails');
      const panne = E.creerFil({ q: '', emails: null, max: { q: '', m: {} } }); const mt = []; const minut2 = { poser: (f) => { mt.push(f); return f; }, annuler: () => {} };
      E.piloterEmails({ fil: panne, minuterie: minut2, chercher: async () => { throw new Error('réseau'); } });
      panne.poser({ q: 'asics' }); await mt[mt.length - 1]();
      dit(panne.lire().emails && panne.lire().emails.liste === null, 'pilote : une panne ⇒ « pas su » (null), jamais « aucun e-mail »', panne.lire().emails);
      stop();
    } catch (e) { ko++; n++; console.log('❌ le pilote des e-mails a levé : ' + e.message); }
  })();

  essaie('le code de l’écran', () => {
    const A = sansCommentaires(src.app);
    const i0 = A.indexOf('const [gsData,setGsData]=useState(null);'), i1 = A.indexOf('const [numData,setNumData]=useState(null);');
    const bloc = i0 > 0 && i1 > i0 ? A.slice(i0, i1) : '';
    dit(bloc.length > 1000, 'les lectures de la loupe sont trouvées (de `gsData` à `numData`)');
    const sels = [...bloc.matchAll(/select=([^&`'"]*)/g)].map((m) => m[1]);
    const entiere = sels.filter((s) => s.split(',').some((x) => /^(?:[\w]+:)?data$/.test(x.trim()) || x.trim() === '*'));
    dit(!entiere.length && !/fetchProInvoices\(\s*\)/.test(bloc) && /fetchProInvoices\(\{\s*metadata:\s*true\s*\}\)/.test(bloc), 'aucune ligne lue entière : chaque `select=` projette, les factures en scalaires', entiere);
    dit(/\/api\/email-rattacher\?mode=journal&page=0&cherche=/.test(bloc) && !/email_reception_\*&select=data/.test(A), 'les e-mails : la route projetée de l’écran E-mails (aucune lecture directe des lignes)');
    const P = sansCommentaires(fs.readFileSync(F_RECEPTION, 'utf8'));
    const proj = (/const PROJECTION='([^']*)'/.exec(P) || [])[1] || '';
    dit(proj && !proj.split(',').some((x) => /^(?:\w+:)?data$/.test(x.trim())), 'la route des e-mails projette (ni corps, ni texte, ni pièce)', proj);
    dit(/return piloterEmails\(\{ fil: FIL_RECHERCHE, delai: (\d+),/.test(A) && Number((/return piloterEmails\(\{ fil: FIL_RECHERCHE, delai: (\d+),/.exec(A) || [])[1]) >= 150 && /montant: \(q\)=>montantCherche\(q\)!=null/.test(A) && /\{headers:sbAuth\(\),cache:'no-store',signal\}/.test(A), 'l’écran branche le pilote des e-mails : pause ≥ 150 ms, montant écarté, requête annulable (signal)', (/delai: (\d+)/.exec(A) || [])[1]);
    const V = fs.existsSync(path.join(RAC, 'src', 'LoupeVivante.jsx')) ? sansCommentaires(fs.readFileSync(path.join(RAC, 'src', 'LoupeVivante.jsx'), 'utf8')) : '';
    dit(/useSyncExternalStore\(FIL_RECHERCHE\.abonner/.test(V) && /const qLent = React\.useDeferredValue\(s\.q\);/.test(V) && /<RechercheVivante rendre=\{\(fil, gsQLent\)=>\{/.test(A) && /const qBrut = gsQLent;/.test(A), 'frappe : le panneau suit le texte DIFFÉRÉ du fil (la lettre s’affiche d’abord)');
    dit(/const setGsQ=poserTexteRecherche;/.test(A) && !/const \[gsQ,setGsQ\]=useState/.test(A) && /value=\{fil\.q\}/.test(A), 'frappe : le texte tapé n’est PAS un état de la coque (une lettre ne redessine que le champ et le panneau)');
    dit(/const sensible = r\.par === 'pseudo' \? 'acheteur' : r\.par === 'code' \? 'code' : null;/.test(A) && /'vrm-recherche-par' \+ \(sensible \? ' vrm-sensible' : ''\)/.test(A), 'mode stream : la pastille d’un pseudo / d’un code suit les cases du stream (`vrm-sensible`)');
    dit(/\{!streamOn && gsRecents\.length > 0 &&/.test(A), 'mode stream : les recherches récentes sont tues');
    dit(/jetonsStream\('acheteurs_recherche',/.test(A), 'mode stream : les pseudos lus par la loupe sont des jetons à cacher');
  });

  console.log(`\n${n - ko}/${n} contrôles verts.`);
  process.exit(ko ? 1 : 0);
})();
