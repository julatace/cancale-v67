#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — SCANNER POUR RETROUVER (15 nov.) : la règle EXÉCUTÉE (src/scanColis.js)
//  Julien : « tu scannes le code-barres d'un colis reçu ou d'un bordereau, et VRM ouvre
//  directement la bonne vente ou le bon achat, grâce au numéro de suivi. Zéro recherche. »
//
//  1. CE QUE CONTIENT UN CODE (`lireCodeColis`) : un code de chaque forme documentée ou
//     mesurée — contenus INVENTÉS, à la forme EXACTE (longueurs, positions, clés de
//     contrôle recalculées ICI par une implémentation indépendante) ⇒ le bon transporteur
//     et le bon n° ; les codes qui ne sont pas un n° de suivi ⇒ null.
//  2. RETROUVER PAR IDENTITÉ (`retrouverParSuivi`) : 50 ventes au MÊME titre aux n° qui se
//     suivent ⇒ chaque scan, SA vente, jamais la voisine ; un n° qui en CONTIENT un autre
//     n'est pas lui ; le même n° sur deux fiches ⇒ la liste (aucune choisie) ; inconnu ⇒ aucun.
//  3. L'APP : les n° d'un enregistrement sont ceux LUS (jamais un titre), le scanner ne
//     cherche que par la règle, « Ouvrir » passe par le chemin des notifications.
//  Mutations (`--prouve`) : chaque règle réaffaiblie ⇒ rouge.
//    node scripts/audit-scan-colis.cjs                 (le contrôle)
//    node scripts/audit-scan-colis.cjs --prouve        (chaque mutation doit rougir)
//    node scripts/audit-scan-colis.cjs --mutation=nom
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const F = { scan: 'src/scanColis.js', app: 'src/App.jsx', ui: 'src/ScannerRetrouver.jsx', src: 'src/retrouverColis.js' };

const MUTATIONS = {
  // L'égalité exacte relâchée : un n° qui CONTIENT l'autre répondrait.
  'normalisation-relachee': ['scan', '  return s === lu.suivi;', '  return s === lu.suivi || s.includes(lu.suivi) || lu.suivi.includes(s);'],
  // La saisie « nettoyée » de tout signe (un « % » mal lu deviendrait 26 chiffres Mondial Relay).
  'nettoyage-relache': ['scan', "  if (!/^[A-Z0-9]+$/.test(s)) return null;", "  if (!/^[A-Z0-9]+$/.test(s)) { const t = s.replace(/[^A-Z0-9]/g, ''); return t ? lireCodeColis(t) : null; }"],
  // La clé S10 plus vérifiée.
  's10-sans-cle': ['scan', '  return !!m && cleS10(m[1]) === Number(m[2]);', '  return !!m;'],
  // Les 26 chiffres Mondial Relay lus à la mauvaise place.
  'mr26-position': ['scan', "s.slice(2, 10), 'mr26')", "s.slice(0, 8), 'mr26')"],
  // Plusieurs fiches ⇒ la première (au lieu de la liste).
  'plusieurs-premier': ['scan', "  if (L.length > 1) return { etat: 'plusieurs', lu, trouves: L };\n", ''],
  // Colissimo sans clé comparé sur un début plus court.
  'colissimo-debut-court': ['scan', '&& s.slice(0, 12) === lu.suivi;', '&& s.slice(0, 10) === lu.suivi.slice(0, 10);'],
  // Le GeoLabel lu à la mauvaise place.
  'geolabel-position': ['scan', "if (/^\\d{14}$/.test(p)) return resultat('dpd', p, 'geolabel');", "if (/^\\d{14}$/.test(p)) return resultat('dpd', geo[1] + p.slice(0, 7), 'geolabel');"],
  // Deux S10 dans un même code : le premier.
  's10-deux-premier': ['scan', '    if (trouves.size === 1) {', '    if (trouves.size >= 1) {'],
  // Un lien de n'importe quel site lu.
  'lien-tout-site': ['scan', "    if (/(^|\\.)mondialrelay\\.(?:com|fr)$/.test(h)) {", "    if (/./.test(h)) {"],
  // L'app range un TITRE parmi les n° d'une vente.
  'app-titre-suivi': ['app', "const suivis = [b && b.suivi, b && b.suiviPdf].filter(Boolean);", "const suivis = [b && b.suivi, b && b.suiviPdf, o.title].filter(Boolean);"],
};
const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const pris = r.status !== 0 && rouges > 0;
    console.log(`${pris ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (pris) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}
let ko = 0, n = 0;
const dit = (c, m, d) => { n++; if (!c) ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d !== undefined ? ' — ' + d : ''}`); };
const J = (x) => JSON.stringify(x);

// ── Une clé S10 calculée ICI (UPU S10 : poids 8 6 4 2 3 5 9 7, 11 − reste ; 10 ⇒ 0 ; 11 ⇒ 5). ──
const cle = (huit) => { const p = [8, 6, 4, 2, 3, 5, 9, 7]; let t = 0; for (let i = 0; i < 8; i++) t += Number(huit[i]) * p[i]; const c = 11 - (t % 11); return c === 10 ? 0 : c === 11 ? 5 : c; };
const s10 = (pre, huit, pays) => `${pre}${huit}${cle(huit)}${pays}`;
const s10Faux = (pre, huit, pays) => `${pre}${huit}${(cle(huit) + 1) % 10}${pays}`;
// Exemples de la norme (Wikipédia, « S10 (UPU standard) ») : 47312482 ⇒ 9 ; 01830004 ⇒ 5 (AG018300045CN).
dit(cle('47312482') === 9 && cle('01830004') === 5, '0 la clé S10 du banc retrouve les exemples publiés de la norme');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-colis-'));
  const src = {};
  for (const [k, f] of Object.entries(F)) src[k] = fs.readFileSync(path.join(R, f), 'utf8');
  if (mut) {
    const [k, a, b] = MUTATIONS[mut] || [];
    if (!k || !src[k].includes(a)) { console.log('❌ mutation introuvable : ' + mut); process.exit(2); }
    src[k] = src[k].replace(a, b);
  }
  fs.writeFileSync(path.join(tmp, 'scanColis.js'), src.scan);
  const S = await import(pathToFileURL(path.join(tmp, 'scanColis.js')));
  const L = (x) => S.lireCodeColis(x);
  const vaut = (x, tr, suivi, extra = {}) => { const r = L(x); return !!r && r.transporteur === tr && r.suivi === suivi && Object.entries(extra).every(([k, v]) => r[k] === v); };

  // ════════ 1. CE QUE CONTIENT UN CODE ════════
  // Mondial Relay / InPost : Code 128 (ou ITF) de 26 chiffres, marque en tête, n° d'expédition aux chiffres 3 à 10.
  dit(vaut('56' + '41235813' + '0101' + '402623166859', 'mondialrelay', '41235813'), '1a Mondial Relay / InPost (26 chiffres « 56… ») ⇒ chiffres 3 à 10');
  dit(vaut('55' + '27182818' + '0101' + '000000004242', 'mondialrelay', '27182818'), '1b « 55… » (26 chiffres) : MESURÉ le 17 nov. sur une étiquette Mondial Relay ⇒ Mondial Relay, chiffres 3 à 10');
  dit(vaut('12' + '31415926' + '5358979323846264'.slice(0, 16), 'mondialrelay', '31415926'), '1c 26 chiffres d’une autre marque : le n° reste aux chiffres 3 à 10 (forme de la spécification)');
  dit(vaut('https://www.mondialrelay.com/public/permanent/tracking.aspx?ens=MRLBCOIN&exp=87654321&language=FR&CodePostal=35260', 'mondialrelay', '87654321'), '1d lien de suivi Mondial Relay (QR, forme mesurée Leboncoin) ⇒ `exp`');
  dit(vaut('41235813', 'mondialrelay', '41235813'), '1e 8 chiffres seuls (n° Mondial Relay, forme mesurée)');
  // Chronopost : S10 (clé vérifiée), seul, dans un code plus long, ou dans son lien.
  const chrono = s10('XW', '20262027', 'TS');
  dit(vaut(chrono, 'chronopost', chrono, { forme: 's10' }), '1f Chronopost XW…TS (S10, clé juste) ⇒ ce n°', J(L(chrono)));
  dit(vaut(s10('XU', '11223344', 'JF'), 'chronopost', s10('XU', '11223344', 'JF')), '1g Chronopost XU…JF ⇒ ce n°');
  dit(vaut('0075' + chrono + '250', 'chronopost', chrono, { forme: 's10-dans-code' }), '1h un S10 (clé juste) posé dans un code plus long ⇒ ce n°');
  dit(vaut('https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=' + chrono, 'chronopost', chrono), '1i lien de suivi Chronopost ⇒ `listeNumerosLT`');
  dit(vaut('https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=XU123456789012A', 'chronopost', 'XU123456789012A'), '1j lien Chronopost à 15 caractères (forme mesurée Leboncoin)');
  // La Poste / postal international : S10.
  const postal = s10('CB', '55443322', 'FR');
  dit(vaut(postal, 'postal', postal), '1k envoi postal S10 (CB…FR, clé juste) ⇒ ce n°');
  // Colissimo : ID13 seul ; GeoLabel 28 caractères (sans la clé de l'ID13).
  dit(vaut('6A' + '12345678901', 'colissimo', '6A12345678901'), '1l Colissimo ID13 (chiffre 6-9, lettre, 11 chiffres)');
  const geoColi = '%' + '0035260' + '11' + '6A' + '1234567890' + '019' + '250';
  dit(geoColi.length === 28 && vaut(geoColi, 'colissimo', '6A1234567890', { sansCle: true }), '1m Colissimo GeoLabel (28 car., « % », « 11 », produit, identifiant) ⇒ l’ID13 sans sa clé', J(L(geoColi)));
  // DPD / réseau Pickup : GeoLabel, n° de colis de 14 chiffres aux caractères 9 à 22.
  const geoDpd = '%' + '0035260' + '05212345678901' + '327' + '250';
  dit(geoDpd.length === 28 && vaut(geoDpd, 'dpd', '05212345678901'), '1n DPD GeoLabel ⇒ les 14 chiffres du n° de colis', J(L(geoDpd)));
  dit(vaut('05212345678901', null, '05212345678901'), '1o 14 chiffres seuls : le n°, transporteur pas deviné');
  // UPS : 1Z, seul ou dans un message ISO 15434 (MaxiCode / PDF417).
  dit(vaut('1Z9999W99999999999', 'ups', '1Z9999W99999999999'), '1p UPS « 1Z » + 16');
  const iso = '[)>\x1e01\x1d96\x1d35260\x1d250\x1d001\x1d1Z9999W99999999999\x1dUPSN\x1d123456\x1d320\x1e\x04';
  dit(vaut(iso, 'ups', '1Z9999W99999999999'), '1q message ISO/IEC 15434 (« [)> », champs GS) : le seul champ de forme connue');
  // Vinted Go (formes mesurées).
  dit(vaut('VGS' + '1234567890123', 'vinted', 'VGS1234567890123'), '1r Vinted Go « VGS » + 13 chiffres');
  dit(vaut('1UW1T3JAB1CDE', 'vinted', '1UW1T3JAB1CDE'), '1s Vinted Go « 1UW1T3 » + 7');
  dit(vaut('2718281828459045', null, '2718281828459045'), '1t 16 chiffres seuls : le n°, transporteur pas deviné');
  dit(vaut(' xw 2026-2027 ' + String(cle('20262027')) + ' ts ', 'chronopost', chrono), '1u saisie à la main : espaces, tirets, minuscules ⇒ le même n°');
  // Ce qui n'est PAS un n° de suivi.
  dit(L('3614272225718') === null, '1v EAN-13 d’une boîte (13 chiffres) ⇒ pas reconnu');
  dit(L(s10Faux('XW', '20262027', 'TS')) === null, '1w S10 à la clé fausse ⇒ pas reconnu (jamais « presque »)');
  dit(L('0075' + chrono + s10('XW', '99887766', 'TS')) === null, '1x deux S10 dans un code ⇒ pas reconnu (jamais le premier)');
  dit(L('https://exemple.test/suivi?exp=12345678') === null && L('https://www.vinted.fr/items/123') === null, '1y lien d’un autre site ⇒ pas reconnu');
  dit(L('https://www.chronopost.fr/x?listeNumerosLT=' + chrono + ',' + s10('XW', '99887766', 'TS')) === null, '1z lien Chronopost à deux n° ⇒ pas reconnu');
  dit(L('%0035260' + '05212345678901' + '32725') === null && L('%00750011234567890123401250') === null, '1A « % » de longueur fausse ⇒ pas reconnu (jamais 26 chiffres « nettoyés »)');
  dit(L('%0035260' + '11AB1234567890' + '019' + '250') === null, '1B GeoLabel au champ colis ni Colissimo ni chiffres ⇒ pas reconnu');
  dit(L('[)>\x1e01\x1d1Z9999W99999999999\x1d' + chrono + '\x1e\x04') === null, '1C message ISO 15434 à deux n° ⇒ pas reconnu');
  dit(L('Nike Air Max 90 blanche') === null && L('') === null && L(null) === null, '1D un titre, un vide ⇒ pas reconnu');
  dit(L('1234567') === null && L('123456789') === null, '1E 7 ou 9 chiffres ⇒ pas reconnu');

  // ════════ 2. RETROUVER PAR IDENTITÉ ════════
  const T = 'Nike Air Max 90 blanche';
  const ventes = Array.from({ length: 50 }, (_, k) => ({ sorte: 'vente', cle: 'v:' + (9000 + k), titre: T, suivis: [s10('XW', String(20262000 + k).padStart(8, '0'), 'TS')] }));
  let bons = 0;
  for (const v of ventes) { const r = S.retrouverParSuivi(L(v.suivis[0]), ventes); if (r.etat === 'un' && r.trouve.cle === v.cle) bons++; }
  dit(bons === 50, '2a 50 ventes au MÊME titre, n° qui se suivent ⇒ chaque scan ouvre SA vente, jamais la voisine', `${bons}/50`);
  const mr = [{ sorte: 'achat', cle: 'a:1', titre: T, suivis: ['41235813'] }, { sorte: 'achat', cle: 'a:2', titre: T, suivis: ['41235814'] }, { sorte: 'achat', cle: 'a:3', titre: T, suivis: ['412358130'] }];
  let r = S.retrouverParSuivi(L('56' + '41235813' + '0101402623166859'), mr);
  dit(r.etat === 'un' && r.trouve.cle === 'a:1', '2b bordereau Mondial Relay ⇒ l’achat de CE n° (pas le voisin, pas celui qui le contient)', J(r.etat === 'un' ? r.trouve.cle : r));
  r = S.retrouverParSuivi(L('1235813'), mr);
  dit(r.etat === 'pasReconnu', '2c un morceau de n° ne désigne rien', J(r));
  r = S.retrouverParSuivi(L('41235815'), mr);
  dit(r.etat === 'aucun' && r.lu && r.lu.suivi === '41235815', '2d n° inconnu ⇒ « aucun », avec ce qui a été lu', J(r));
  const deux = [{ sorte: 'vente', cle: 'v:1', suivis: [chrono] }, { sorte: 'retour', cle: 'r:7', suivis: [' ' + chrono.toLowerCase()] }, { sorte: 'vente', cle: 'v:2', suivis: [postal] }];
  r = S.retrouverParSuivi(L(chrono), deux);
  dit(r.etat === 'plusieurs' && r.trouves.length === 2 && r.trouves.map((x) => x.cle).sort().join() === 'r:7,v:1', '2e le même n° sur deux fiches ⇒ la liste des deux, aucune choisie', J(r.etat));
  r = S.retrouverParSuivi(L(chrono), [deux[0], { ...deux[0] }]);
  dit(r.etat === 'un', '2f la même fiche vue deux fois (sorte + clé) compte pour une');
  const coli = [{ sorte: 'achat', cle: 'a:c1', suivis: ['6A12345678901'] }, { sorte: 'achat', cle: 'a:c2', suivis: ['6A12345678911'] }, { sorte: 'achat', cle: 'a:c3', suivis: ['6A1234567890'] }];
  r = S.retrouverParSuivi(L(geoColi), coli);
  dit(r.etat === 'plusieurs' ? false : r.etat === 'un' && r.trouve.cle === 'a:c1', '2g Colissimo GeoLabel ⇒ l’ID13 dont il est le début exact (12 car.), pas l’ID13 voisin', J(r.etat === 'un' ? r.trouve.cle : r));
  r = S.retrouverParSuivi(L('6A12345678901'), coli);
  dit(r.etat === 'un' && r.trouve.cle === 'a:c1', '2h l’ID13 complet ⇒ lui seul (jamais le n° sans clé rangé à côté)', J(r.etat));
  r = S.retrouverParSuivi(L(geoDpd), [{ sorte: 'vente', cle: 'x', suivis: ['0521234567890'] }, { sorte: 'vente', cle: 'y', suivis: ['052123456789012'] }]);
  dit(r.etat === 'aucun', '2i 13 ou 15 chiffres rangés ne valent pas les 14 lus', J(r.etat));
  r = S.retrouverParSuivi(null, ventes);
  dit(r.etat === 'pasReconnu', '2j rien lu ⇒ « pas reconnu », jamais une fiche');
  r = S.retrouverColis('https://www.mondialrelay.com/public/permanent/tracking.aspx?ens=MRLBCOIN&exp=41235814', mr);
  dit(r.etat === 'un' && r.trouve.cle === 'a:2', '2k le lien d’un QR mène à la fiche de SON n°');

  // ════════ 3. L'APP ════════
  const app = src.app, ui = src.ui, sr = src.src;
  // (17 nov., lot scan-bordereau-vente) l'enregistrement d'une vente vit dans `enregVenteScan`, juste avant la source.
  const debutBloc = app.indexOf('const enregVenteScan = (o) => {') >= 0 ? app.indexOf('const enregVenteScan = (o) => {') : app.indexOf('sourceRetrouver.current = () => {');
  const bloc = app.slice(debutBloc, app.indexOf("return enregistrerSourceColis('comptabilite:'"));
  const affect = [...bloc.matchAll(/(?:const suivis = |suivis: )(\[[^\]]*\](?:\.filter\(Boolean\))?|[\w.]+(?:\([^)]*\))?)/g)].map((m) => m[1]);
  dit(bloc.length > 500 && affect.length >= 5 && affect.every((x) => !/title|titre|\.nom\b|modele|article/.test(x)), '3a App : les n° d’un enregistrement sont ceux LUS (bordereau, suivi, e-mail, retour, Vestiaire), jamais un titre', affect.filter((x) => /title|titre/.test(x)).join(' | '));
  dit(/b && b\.suivi, b && b\.suiviPdf/.test(bloc) && /suivisAchat\(o, indexSuivisAchats\)/.test(bloc) && /suiviDeLigne\(t\)/.test(bloc) && /suivis: \[c\.suivi\]/.test(bloc), '3b App : vente ⇐ son bordereau ; achat ⇐ son suivi et l’e-mail relié ; retour ⇐ son bordereau de retour');
  dit(/pret: ventesLues && achatsLus && bordsLus/.test(bloc), '3c App : une source pas lue n’est jamais « rien » (`pret: false`)');
  const lbc = app.slice(app.indexOf('lbcSourceRef.current = () => {'), app.indexOf("enregistrerSourceColis('leboncoin'"));
  dit(/lireCodeColis\(o\.label && o\.label\.trackingUrl\)/.test(lbc) && /o\.isSeller !== true && o\.isSeller !== false/.test(lbc), '3d Leboncoin : le n° de SON lien de suivi (la même règle), vente ou achat jamais deviné');
  dit(/retrouverParSuivi\(lu, S\.enregistrements\)/.test(ui) && !/includes\(|startsWith\(|indexOf\(/.test(ui.slice(ui.indexOf('const resoudre'), ui.indexOf('const traiter'))), '3e le scanner ne cherche que par la règle (aucune comparaison à lui)');
  dit(/onClick=\{\(\) => onOuvrir\(e\)\}/.test(ui) && /new CustomEvent\('vrm:aller', \{ detail: e\.lien \}\)/.test(ui), '3f « Ouvrir » sur SON toucher, par le chemin des notifications');
  dit(/if \(!S\.pret\)|if \(S\.pret\) \{ finir\(false\); return; \}/.test(ui) && /ATTENTE_SOURCES_MS/.test(ui), '3g une lecture qui attend ses sources (jamais « pas dans VRM » avant d’avoir lu)');
  dit(/startsWith\('comptabilite'\)/.test(sr) && /if \(!r\.pret\) pret = false;/.test(sr), '3h les sources : la principale doit être là et chacune lue');
  dit(!/fetch\(|XMLHttpRequest|sendBeacon/.test(ui), '3i le scanner n’envoie rien (aucune requête : l’image reste dans la page)');

  console.log(`\n${n - ko}/${n} verts${ko ? ` — ${ko} rouge(s)` : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
