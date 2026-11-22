#!/usr/bin/env node
require('./_source-app.cjs').brancher();   // (22 nov., intégration finale) Comptabilite vit dans src/ecrans/ : la lecture d'App.jsx rend le texte entier
// Audit : LES RESTES DES ÉCRANS (16 nov., lot ecrans-restes) — récit docs/passation/2026-11-16-ecrans-restes.md.
// Exécute les VRAIES règles (modules ESM importés) et lit le code là où la règle est une liaison :
//   S. (27) le stock importé : `importeesAuStock` (par le N°, jamais un titre ; la paire reliée n'est pas deux
//      fois ; un prix absent reste null, jamais 0) ; « Tout sur le N° » le trouve par son N°, et « pas su »
//      n'est dit que pour une lecture ratée ; le bilan serveur compte les ventes importées (exécuté).
//   L. (32) la date limite d'envoi : portée par les bordereaux de « Tout sur le N° », calculée par la règle de
//      Colis fournie (`o.limiteEnvoi`), dite par la ligne d'état et la carte « À déposer » ; la loupe lit la
//      liste publiée par Ventes (`vrm_colis_aposter.liste`).
//   I. (37) « Tout imprimer » tamponne les N° d'un LOT et la garde du §5 vérifie CHACUN.
//   M. (51) « Plus tard » de la carte MFA : clé SYNCHRONISÉE, écrite par `save`, relue par `useStateCle`.
//   D. (57, 28) le code mort retiré ne revient pas (ColisInstantane, CaptureColis, recherche manuelle de relais).
// node scripts/audit-ecrans-restes.cjs [--prouve]   (RACINE=<arbre> pour juger un autre arbre)
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = process.env.RACINE || path.join(__dirname, '..');
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + d : '')); };
const imp = async (f) => { try { return await import(pathToFileURL(path.join(R, f)).href + '?t=' + Date.now()); } catch (e) { return { __err: String(e && e.message || e).slice(0, 160) }; } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).slice(0, 200)); } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

(async () => {
  const { cleNumero } = await imp('src/numeroEcrit.js');
  const cleNum = typeof cleNumero === 'function' ? cleNumero : (v) => String(v || '').trim().toUpperCase();

  console.log('── S. Le stock importé d’un autre outil (27)');
  await essaie('S', async () => {
    const V = await imp('src/stockImporteVue.js');
    dit(typeof V.importeesAuStock === 'function', 'S0 la règle existe (src/stockImporteVue.js)', V.__err);
    if (typeof V.importeesAuStock !== 'function') return;
    const L = [
      { id: 'a', numero: '900', titre: 'Asics Gel', prix: '25,00', emplacement: 'Carton B3', createdAt: '2026-11-01T10:00:00Z' },
      { id: 'b', numero: '0901', titre: 'Puma', prix: '', emplacement: '', createdAt: '2026-11-01T10:00:00Z' },
      { id: 'c', numero: '905', titre: 'NB 550', prix: '30,00', annonce: '6303', createdAt: '2026-11-01T10:00:00Z' },
      { id: 'd', numero: '906', titre: 'Asics Gel', prix: '10,00', createdAt: '2026-11-01T10:00:00Z' },
      { id: 'e', numero: '', titre: 'sans numéro' },
    ];
    const r = V.importeesAuStock(L, { cleNum, numerosPortes: new Set(['906']) });
    dit(r.map((x) => x.cle).join(',') === '900,901', 'S1 montrées par leur N° : la reliée (annonce) et celle dont le N° est porté par une fiche ne sont pas deux fois ; sans N° : rien', JSON.stringify(r.map((x) => x.cle)));
    const p901 = r.find((x) => x.cle === '901');
    dit(!!p901 && p901.prix === null && p901.emplacement === '', 'S2 un prix absent reste « pas dit » (null), jamais 0', JSON.stringify(p901));
    const n = V.importeeDuNumero(L, '906', { cleNum });
    dit(!!n && n.titre === 'Asics Gel' && n.prix === '10,00', 'S3 « Tout sur le N° » : la paire importée de CE N° (906)');
    dit(V.importeeDuNumero(L, '907', { cleNum }) === null, 'S4 un autre N° au même titre ne désigne RIEN (jamais par le titre)');
    const RN = await imp('src/rechercheNumero.js');
    const o = { cleNum, importeeDuNumero: (l, k) => V.importeeDuNumero(l, k, { cleNum }) };
    const base = { fiches: {}, pool: ['900'], enLigne: new Set(), ventes: [], txnItem: {}, bordereaux: [], lbcVentes: [], ebayCommandes: [], ebayAnnonces: [], plan: {} };
    const a = RN.toutSurLeNumero('900', { ...base, importes: L }, o);
    dit(a.etat === 'trouve' && a.importe && a.importe.emplacement === 'Carton B3', 'S5 « Tout sur le N°900 » trouve la paire importée', JSON.stringify(a.importe));
    const b = RN.toutSurLeNumero('900', { ...base, importes: null }, o);
    dit(b.manques.includes('ton stock importé'), 'S6 une lecture ratée (null) est DITE dans les manques');
    const c = RN.toutSurLeNumero('900', { ...base }, o);
    dit(!c.manques.includes('ton stock importé') && c.importe == null, 'S7 un appelant qui ne lit pas l’import (absent) : rien cherché, rien dit');
    // Le bilan du serveur compte la vente importée datée au versement, et pas celle déjà lue (même n°).
    const B = await imp('api/_lib/bilan-semaine.js');
    const debut = Date.parse('2026-11-09T00:00:00+01:00'), fin = Date.parse('2026-11-16T00:00:00+01:00');
    const e = { debut, fin, maintenant: fin + 3600e3, comptes: [{ uid: '1', login: 'x' }], commandes: { 1: { orders: [{ transaction_id: 77, title: 'lu', price: { amount: '40', currency_code: 'EUR' }, status: 'Commande finalisée', date: '2026-11-10T10:00:00Z' }], cap: new Date(fin + 1000).toISOString() } },
      masquesTx: new Set(), masquesComptes: new Set(), panneau: {}, lbc: [], ebay: [], versements: { 77: '2026-11-11T10:00:00Z' },
      importees: [{ id: 'i1', date: '2026-11-12', titre: 'importée', prix: '50,00', plateforme: 'Autre', versement: '2026-11-13', ref: 'A1' },
        { id: 'i2', date: '2026-11-10', titre: 'déjà lue', prix: '40,00', plateforme: 'Vinted', versement: '2026-11-11', ref: '77' }] };
    const bil = B.calculerBilan(e);
    dit(bil.vendu.n === 2 && bil.vendu.eur === 90, 'S8 bilan de la semaine (serveur, EXÉCUTÉ) : la vente importée est vendue, la déjà lue ne compte pas deux fois', JSON.stringify(bil.vendu));
    dit(bil.recu.eur === 90, 'S9 … et reçue au jour du versement de son fichier', JSON.stringify(bil.recu));
    const bil0 = B.calculerBilan({ ...e, importees: null });
    dit(bil0.vendu.manque.some((x) => /import/i.test(x)), 'S10 ventes importées illisibles : le bilan le NOMME', JSON.stringify(bil0.vendu.manque));
    const sr = lire('api/ship-reminders.js');
    dit(/MAIN_BILAN = \[[^\]]*'vrm_ventes_importees'/.test(sr) && /importees: mm \?/.test(sr), 'S11 la route lit `vrm_ventes_importees` dans la ligne main (projection)');
    const app = sansCommentaires(lire('src/App.jsx'));
    dit(/importes: \(\(\) => \{ const imp = load\(CLE_STOCK_IMPORTE, null\)/.test(app) && /importeeDuNumero: \(liste, k\) => importeeDuNumero\(liste, k, \{ cleNum \}\)/.test(app), 'S12 « Tout sur le N° » de l’app reçoit le stock importé et la règle par N°');
    dit(/importeesPourRecherche\(lireStockImporte\(\), \{ cleNum \}\)/.test(app), 'S13 la loupe indexe le stock importé (par N° et par mots)');
    const st = sansCommentaires(lire('src/ecrans/Stock.jsx'));
    dit(/importeesAuStock\(stockImporte, \{ cleNum, numerosPortes: portesImp \}\)/.test(st) && /\{blocImportees\}/.test(st), 'S14 le Stock montre les paires importées (rendu)');
  });

  console.log('── L. La date limite d’envoi (32)');
  await essaie('L', async () => {
    const RN = await imp('src/rechercheNumero.js');
    const FP = await imp('src/fichePaire.js');
    const PR = await imp('src/ficheProduit.js');
    const LE = await imp('api/_lib/limite-envoi.js');
    const o = { cleNum, aPoster: (v) => v.transaction_user_status === 'needs_action' };
    const vente = { transaction_id: 8003, title: 'Nike', price: { amount: '65', currency_code: 'EUR' }, status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: '2026-11-15T09:00:00Z' };
    const base = { fiches: { 6301: { numero: '160', buyPrice: '20' } }, pool: ['160'], enLigne: new Set(), ventes: [vente], txnItem: { 8003: '6301' }, lbcVentes: [], ebayCommandes: [], ebayAnnonces: [], plan: {},
      bordereaux: [{ tx: '8003', pdf: true, dateLimite: '19/11/2026 10 h 00' }] };
    const rn = RN.toutSurLeNumero('160', base, o);
    dit(rn.bordereaux[0] && rn.bordereaux[0].dateLimite === '19/11/2026 10 h 00', 'L1 « Tout sur le N° » porte la date limite LUE du bordereau (par sa transaction)', JSON.stringify(rn.bordereaux));
    const regle = (v, b) => { const l = LE.limiteExpedition(v, b && b.dateLimite ? { dateLimite: b.dateLimite } : null, Date.parse('2026-11-16T09:00:00Z')); return l && l.jour ? { texte: LE.texteLimiteEnvoi(l, Date.parse('2026-11-16T09:00:00Z')), jour: l.jour, estimee: l.limite === 'estimee' } : null; };
    const oP = { etapeVente: () => ({ label: 'À expédier', step: 1 }), limiteEnvoi: regle };
    const p = FP.parcoursPaire(rn, { fiches: base.fiches, versements: {} }, oP);
    dit(p && p.aPoster && p.limiteEnvoi && p.limiteEnvoi.jour === '2026-11-19' && !p.limiteEnvoi.estimee && /19 nov\. à 10 h/.test(p.limiteEnvoi.texte), 'L2 la fiche calcule SA limite par la règle de Colis (celle de l’e-mail)', JSON.stringify(p && p.limiteEnvoi));
    const pSans = FP.parcoursPaire(RN.toutSurLeNumero('160', { ...base, bordereaux: [] }, o), { fiches: base.fiches, versements: {} }, oP);
    dit(pSans && pSans.limiteEnvoi && pSans.limiteEnvoi.estimee === true, 'L3 sans bordereau : vente + 7 j, dite ESTIMÉE (jamais une date lue inventée)', JSON.stringify(pSans && pSans.limiteEnvoi));
    const pNul = FP.parcoursPaire(rn, { fiches: base.fiches, versements: {} }, { etapeVente: oP.etapeVente });
    dit(pNul && pNul.limiteEnvoi === null, 'L4 sans règle fournie : rien (null), jamais deviné');
    const le = PR.ligneEtat({ ...p, resume: { ...(p.resume || {}), vente: 6500 } }, { action: 'relier' });
    dit(le && le.cle === 'fd.etat.vendueLimite' && /19 nov/.test(le.vars.limite) && le.ambre, 'L5 la ligne d’état dit « Vendue … · à poster avant le 19 nov. » (ambre : un geste)', JSON.stringify(le));
    const a = PR.actionFiche({ ...p, resume: { ...(p.resume || {}), achat: 2000 } }, { peutBordereau: true });
    dit(a && a.sorte === 'bordereau' && a.limite && a.limite.jour === '2026-11-19', 'L6 la carte « À déposer » porte la limite', JSON.stringify(a));
    const fpx = sansCommentaires(lire('src/FichePaire.jsx'));
    // (20 nov., chasse-bugs) Fiche refaite (19 nov., fiche-directe) : FichePaire passe la limite à la rangée d'action
    // (`ligneAction` : sa phrase en valeur, `data-fd-limite` en attribut) et la fiche native la rend (`Rangee … attrs`).
    const fnat = sansCommentaires(lire('src/natif/ecrans/Fiche.jsx'));
    const ancienne = /data-fd-limite=\{a\.limite\.jour/.test(fpx) && /\{a\.limite\.texte\}/.test(fpx);
    const native = /valeur: a\.limite \? a\.limite\.texte : ''/.test(fpx) && /'data-fd-limite': a\.limite\.jour/.test(fpx)
      && /<Rangee titre=\{ligneAction\.titre\} valeur=\{ligneAction\.valeur[^}]*\}[^>]*attrs=\{ligneAction\.attrs\}/.test(fnat);
    dit(ancienne || native, 'L7 la carte la REND (data-fd-limite, sa phrase)');
    const app = sansCommentaires(lire('src/App.jsx'));
    dit(/lireTout\('id=like\.email_bord_\*&select=id,tx:meta->>transaction,pdf:meta->>_pdf,dateLimite:meta->>dateLimite'/.test(app), 'L8 la limite est lue en SCALAIRE (meta, jamais le PDF, §4.4)');
    dit(/limiteEnvoi: \(v, b\) => \{ const l = limiteExpedition\(v,/.test(app), 'L9 l’app fournit LA règle de Colis (`limiteExpedition`)');
    dit(/v\.liste = toShip\.slice\(0, 100\)\.map/.test(app) && /avant\.sigListe !== v\.sigListe/.test(app), 'L10 Ventes publie la liste des colis à expédier et la republie quand elle change');
    dit(/etats: \['a-expedier'\], acces: \{\s*titre: \(c\) => c\.nom \|\| '', numero: \(c\) => c\.num \|\| '', etat: \(\) => 'a-expedier', jour: \(c\) => c\.jour \|\| null/.test(app) && /publicationColisFraiche\(pubE\)/.test(app), 'L11 la loupe filtre « à expédier » + jour sur cette liste, crue si fraîche');
  });

  console.log('── I. « Tout imprimer » et les lots (37)');
  await essaie('I', async () => {
    const app = sansCommentaires(lire('src/App.jsx'));
    const i = app.indexOf('const lignesLotTous = () => {'); const corps = i > 0 ? app.slice(i, i + 2600) : '';
    dit(/const lotV = o \? lotDeVente\(o\) : null; const enLotV = !!\(lotV && lotV\.lu\);/.test(corps) && /num: enLotV \? lotV\.tampon :/.test(corps) && /nums: lotV\.nums\.slice\(\)/.test(corps), 'I1 une vente en lot : la ligne du lot porte le tampon de SES N° et leur liste');
    dit(/const numerosDeLigne = \(l\) => \(Array\.isArray\(l && l\.nums\) \? l\.nums\.filter\(Boolean\) : \[l && l\.num\]\);/.test(app) && /const numeros = choisies\.flatMap\(numerosDeLigne\);/.test(app), 'I2 la garde du §5 vérifie CHAQUE N° du lot (pas le tampon entier)');
    dit(!/numerosDemandent\(\[l\.num\]\)/.test(app) && !/\[l\], \[l\.num\]/.test(app), 'I3 aucun chemin d’impression d’une ligne ne vérifie seulement `l.num`');
    dit(/signatureColis\(l\.e\) \+ \(Array\.isArray\(l\.nums\) \? '#lot:'/.test(app), 'I4 le PDF préparé d’un lot change quand son tampon change (signature)');
  });

  console.log('── M. « Plus tard » de la carte MFA (51)');
  await essaie('M', async () => {
    const app = lire('src/App.jsx');
    const i = app.indexOf('const SYNC_KEYS = ['); const j = app.indexOf('];', i);
    const sync = i > 0 ? sansCommentaires(app.slice(i, j)) : '';
    dit(/'vrm_carte_mfa_rangee'/.test(sync), 'M1 la clé est dans SYNC_KEYS (ligne `main` du vendeur, tous ses appareils)');
    const carte = sansCommentaires(lire('src/CarteDoubleVerif.jsx'));
    dit(/save\(CLE_CARTE_MFA, 1\)/.test(carte) && !/localStorage\.setItem\(CLE_CARTE_MFA/.test(carte), 'M2 « Plus tard » écrit par `save` (la file d’envoi et le nuage), plus seulement l’appareil');
    dit(/useStateCle\(CLE_CARTE_MFA, lireRangee\)/.test(carte), 'M3 relue quand le nuage rapporte la clé (rangée ailleurs ⇒ disparaît ici)');
    dit(/v === 1 \|\| v === true \|\| v === '1'/.test(carte), 'M4 l’ancienne valeur de l’appareil (« 1 ») se lit pareil');
  });

  console.log('── D. Le code mort retiré (57, 28)');
  await essaie('D', async () => {
    const src = ['src/App.jsx', 'src/ColisVentesInstantanes.jsx', 'src/colisVentesInstantanes.js'].map((f) => sansCommentaires(lire(f))).join('\n');
    dit(!/\bColisInstantane\b|\bCaptureColis\b|\bcapturerColis\b|\blireInstantaneColis\b|\bcolisMontrable\b/.test(src), 'D1 plus d’instantané de Colis (ni rangé ni montré)');
    dit(!/\bopenRelayPicker\b|\brelayPicker\b|\bOsmMap\b|\baddPointByAddress\b|\bremoveSavedPoint\b/.test(src), 'D2 plus de recherche manuelle de point relais (jamais ouverte)');
    const app = sansCommentaires(lire('src/App.jsx'));
    dit(/const ensureSavedPoint = \(nom, adresse, lat, lon\) =>/.test(app), 'D3 les points LUS dans ses e-mails restent enregistrés (`ensureSavedPoint`)');
    const ie = lire('src/instantaneEcran.js');
    dit(/colis: 'vrm_colis_instantane:'/.test(ie), 'D4 la clé d’un ancien instantané de Colis reste connue : effacée à la déconnexion');
  });

  console.log(ko ? `\n❌ ${ko} rouge(s), ${ok} vert(s)` : `\n✅ ${ok} verts, 0 rouge`);
  if (process.argv.includes('--prouve') && !ko) prouver();
  process.exitCode = ko ? 1 : 0;
})();

function prouver() {
  const MUT = [
    ['src/stockImporteVue.js', "    if (str(x.annonce) || portes.has(cle)) continue;", "    if (portes.has(cle)) continue;"],
    ['src/stockImporteVue.js', "    const prix = x.prix == null || str(x.prix) === '' ? null : str(x.prix);", "    const prix = str(x.prix) || '0';"],
    ['src/stockImporteVue.js', "  const x = importes.find((i) => i && cleNum(str(i.numero)) === cle);", "  const x = importes.find((i) => i && (cleNum(str(i.numero)) === cle || str(i.titre) === str((importes.find((j) => j && cleNum(str(j.numero)) === cle) || {}).titre))) || importes.find((i) => i && str(i.titre) === 'Asics Gel');"],
    ['src/rechercheNumero.js', "  if (D.importes === null) manques.push('ton stock importé');", ";"],
    ['api/_lib/bilan-semaine.js', "  const vf = ventesFaites({ vinted, lbc, ebay, vestiaire, cachee, excluAutre, importees, main });", "  const vf = ventesFaites({ vinted, lbc, ebay, vestiaire, cachee, excluAutre, main });"],
    ['src/rechercheNumero.js', "dateLimite: String((b.dateLimite || av.dateLimite || '')).trim()", "dateLimite: ''"],
    ['src/fichePaire.js', "    if (aPoster && o.limiteEnvoi) { try { limiteEnvoi = o.limiteEnvoi(venteV, b) || null; } catch (_) { limiteEnvoi = null; } }", "    if (aPoster && o.limiteEnvoi) { try { limiteEnvoi = o.limiteEnvoi(venteV, null) || null; } catch (_) { limiteEnvoi = null; } }"],
    ['src/ficheProduit.js', "    if (p.aPoster && action !== 'bordereau' && lim) return", "    if (false && lim) return"],
    ['src/App.jsx', "    const numeros = choisies.flatMap(numerosDeLigne);", "    const numeros = choisies.map((l) => l.num);"],
    ['src/App.jsx', "        num: enLotV ? lotV.tampon : ((b ?", "        num: false ? lotV.tampon : ((b ?"],
    ['src/CarteDoubleVerif.jsx', "  const ranger = () => { save(CLE_CARTE_MFA, 1); setRangee(true); };", "  const ranger = () => { try { window.localStorage.setItem(CLE_CARTE_MFA, '1'); } catch (_) {} setRangee(true); };"],
    ['src/App.jsx', "  'vrm_carte_mfa_rangee',\n", ""],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ecrans-restes-'));
  for (const d of ['src', 'api', 'package.json']) fs.cpSync(path.join(R, d), path.join(tmp, d), { recursive: true });
  let rouges = 0;
  for (const [f, a, b] of MUT) {
    const p = path.join(tmp, f), avant = fs.readFileSync(p, 'utf8');
    if (!avant.includes(a)) { console.log(`  ❌ mutation introuvable : ${f} « ${a.slice(0, 60)} »`); continue; }
    fs.writeFileSync(p, avant.replace(a, b));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, RACINE: tmp }, encoding: 'utf8' });
    fs.writeFileSync(p, avant);
    const rouge = r.status !== 0;
    if (rouge) rouges++;
    console.log(`  ${rouge ? '✅ rouge' : '❌ RESTE VERT'} sous la mutation ${f} « ${a.trim().slice(0, 70)} »`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${rouges}/${MUT.length} mutations rouges`);
  if (rouges !== MUT.length) process.exitCode = 1;
}
