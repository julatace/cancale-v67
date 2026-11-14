// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « FRAIS DE L'ANNÉE » ET « CARTE DE TES VENTES » (14 nov., frais-carte ;
//  docs/passation/2026-11-14-frais-carte.md). Données INVENTÉES (dépôt public).
//  Il EXÉCUTE les vraies règles — src/fraisPlateformes.js (`fraisAnnee`, sur
//  `fraisParPlateforme`) et src/lieuxVentes.js (`lieuxVentes`) — et vérifie :
//   F1 des frais inconnus ne valent jamais 0 (eBay sans frais lus, Vinted rien noté ⇒ null, « inconnu ») ;
//   F2 une commande eBay dans une autre devise est écartée ET dite (`autreDevise`, `devises`), jamais convertie ;
//   F3 un compte exclu n'entre dans aucun total (eBay `excluAutre`) ;
//   F4 couverture : « au moins » + lus/n quand une partie seulement est lue ; complet sinon ;
//   F5 §2.8 : le port eBay n'est ni recette ni charge (seul `totalMarketplaceFee`) ;
//   F6 le même chiffre que « Frais par site » (`fraisParPlateforme` sur les mêmes bornes) ;
//   F7 une année plus ancienne que le relevé ⇒ « pas su » (`avantReleve`), jamais 0 ;
//   F8 boosts notés sur une fiche : mis à part, déjà dans le total (pas comptés deux fois) ;
//   L1 une vente sans lieu est comptée à part, avec sa raison, jamais placée ;
//   L2 deux ventes de la même ville sont UNE bulle (ville placée) — ou UN département sinon ;
//   L3 aucun nom, pseudo, adresse, compte ni n° de transaction dans la sortie ;
//   L4 un compte écarté ne sort pas ; la période et la plateforme filtrent ;
//   L5 le N° vient du relevé par identité ; une vente française sans ville compte dans « France »
//      et dans `franceSansVille` ; un pays inconnu est « hors carte », jamais deviné ;
//   L6 2 000 ventes agrégées en moins de 50 ms ;
//   S  le code : les blocs n'importent pas App.jsx, aucune requête Nominatim, la recherche de ville
//      passe par la file (une par ville), les deux blocs sont RENDUS dans Argent (Stats.jsx).
//  `--prouve` : chaque mutation de la règle doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = process.env.AUDIT_RACINE || path.join(__dirname, '..');

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; if (!bon || !process.env.MUET) console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && det !== undefined ? '  → ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 400) : ''}`); };

const MUTATIONS = [
  ['src/fraisPlateformes.js', "if (connu === 0) return { ...base, etat: 'inconnu', frais: null,", "if (connu === 0) return { ...base, etat: 'inconnu', frais: 0,", 'F1 Vinted rien noté ⇒ 0'],
  ['src/fraisPlateformes.js', "if (s.couverture.lus === 0 && connu === 0) return { ...base, etat: 'inconnu', frais: null,", "if (false) return { ...base, etat: 'inconnu', frais: null,", 'F1 eBay sans frais lus ⇒ 0'],
  ['src/fraisPlateformes.js', "if (dev) { S.nDevise += 1; S.devises.add(dev); continue; }", "if (dev) { continue; }", 'F2 devise étrangère tue'],
  ['src/fraisPlateformes.js', "if (excluAutre && excluAutre('ebay', o)) continue;", "", 'F3 compte exclu compté'],
  ['src/fraisPlateformes.js', "const complet = s.couverture.lus === s.couverture.n;", "const complet = true;", 'F4 partiel présenté complet'],
  ['src/fraisPlateformes.js', "const avantReleve = Array.isArray(releve) && y < premiereAnneeReleve(releveAt, maintenant);", "const avantReleve = false;", 'F7 année avant le relevé ⇒ vide'],
  ['src/lieuxVentes.js', "R.sansLieu.n += 1;", "R.avecLieu += 0;", 'L1 vente sans lieu pas comptée'],
  ['src/lieuxVentes.js', "const cv = lieu.ville ? cleVille(lieu.dep, lieu.ville) : null;", "const cv = lieu.ville ? cleVille(lieu.dep, lieu.ville) + '|' + Math.random() : null;", 'L2 une bulle par vente'],
  ['src/lieuxVentes.js', "const v = { num:", "const v = { compte: l.compte, num:", 'L3 compte dans la sortie'],
  ['src/lieuxVentes.js', "const ville = nomVille(adr.city);", "const ville = nomVille(adr.city) + ' · ' + ins.shippingStep.shipTo.fullName;", 'L3 nom de l’acheteur dans la sortie'],
  ['src/lieuxVentes.js', "if (typeof ecarte === 'function' && ecarte(l)) continue;", "", 'L4 compte écarté sorti'],
  ['src/lieuxVentes.js', "compter(bulle(P, lieu.pays, { pays: lieu.pays, lat: rep ? rep[0] : null, lon: rep ? rep[1] : null, horsCarte: !rep }), v);", "compter(bulle(P, lieu.pays, { pays: lieu.pays, lat: rep ? rep[0] : 0, lon: rep ? rep[1] : 0, horsCarte: false }), v);", 'L5 pays inconnu placé au hasard'],
];

async function charger(racine) {
  const u = (f) => pathToFileURL(path.join(racine, f)).href + '?t=' + Date.now();
  return { F: await import(u('src/fraisPlateformes.js')), L: await import(u('src/lieuxVentes.js')) };
}

const AN = 2026;
const T0 = new Date(AN, 5, 15, 12).getTime();          // 15 juin 2026, midi local
const MAINT = new Date(AN, 10, 14, 12).getTime();       // 14 nov. 2026
const j = (k) => T0 + k * 86400000;
const iso = (t) => new Date(t).toISOString();
const m = (v, d = 'EUR') => ({ value: String(v), currency: d });
const adr = (city, postalCode, countryCode) => ({ fulfillmentStartInstructions: [{ shippingStep: { shipTo: { fullName: 'Gaspard Inventé', primaryPhone: { phoneNumber: '0600000000' }, email: 'gaspard@exemple.test', contactAddress: { addressLine1: '12 rue Imaginaire', city, postalCode, countryCode } } } }] });
const cmd = (id, t, du, fee, extra = {}) => ({ orderId: id, creationDate: iso(t), orderPaymentStatus: 'PAID', paymentSummary: { totalDueSeller: du }, totalMarketplaceFee: fee, pricingSummary: { deliveryCost: m(9.9) }, buyer: { username: 'pseudo_acheteur_ebay' }, _pseudo: 'ma_boutique_ebay', ...extra });
const R = { commandeEbayEngagee: () => true, fraisVc: (v) => (v && v.prix != null && v.verse != null ? { lu: true, cFrais: Math.round((v.prix - v.verse) * 100), cPrix: Math.round(v.prix * 100), cVerse: Math.round(v.verse * 100) } : { lu: false }) };

async function verifier(racine) {
  const { F, L } = await charger(racine);
  // ── F : les frais de l'année ────────────────────────────────────────────
  const releve = [
    ['Vinted', 'compte_a', '9001', j(0), 60, 30, 2.5, 'Nike Dunk', '12', '', null, [250, 0, 0, 0]],   // boost noté 2,50
    ['Vinted', 'compte_a', '9002', j(1), 45, 20, 0, 'Asics', '13', ''],
    ['Leboncoin', '', 'lbc:77', j(2), 80, 40, 0, 'Salomon', '14', ''],
    ['Vestiaire', '', 'vestiaire:V1', j(3), 212.5, 100, 0, 'Sac', '15', ''],
    ['Vestiaire', '', 'vestiaire:V2', j(4), 100, 50, 0, 'Ceinture', '16', ''],
  ];
  const vestiaire = [{ id: 'V1', prix: 250, verse: 212.5 }, { id: 'V2' }];
  const ebay = [
    cmd('E1', j(0), m(100), m(12.4)),                     // frais lus
    cmd('E2', j(1), m(80), m(9.6)),                       // frais lus
    cmd('E3', j(2), m(70), null),                         // frais pas lus
    cmd('E4', j(3), m(50, 'GBP'), m(6, 'GBP')),            // autre devise
    cmd('E5', j(4), m(500), m(60), { _compte: 'exclu' }), // compte exclu
  ];
  const excluAutre = (site, o) => site === 'ebay' && o._compte === 'exclu';
  const packs = [{ date: `${AN}-03-02`, montant: 4.99, plateforme: 'Vinted' }];
  const A = F.fraisAnnee({ releve, releveAt: MAINT, ebay, packs, annee: AN, excluAutre, R, vestiaire, maintenant: MAINT });
  const s = (p) => A.sites.find((x) => x.plateforme === p) || {};
  dit(s('eBay').etat === 'auMoins' && s('eBay').frais === 22 && s('eBay').couverture && s('eBay').couverture.lus === 2 && s('eBay').couverture.n === 4,
    'F4 eBay : au moins 22 € · frais connus sur 2 des 4 ventes (la GBP comptée dans n, jamais dans les frais)', s('eBay'));
  dit(s('eBay').autreDevise === 1 && JSON.stringify(s('eBay').devises) === '["GBP"]', 'F2 la commande en GBP est écartée ET dite', s('eBay'));
  dit(!(s('eBay').n === 5) && s('eBay').frais !== 82, 'F3 le compte exclu n’entre dans aucun total eBay', s('eBay'));
  dit(s('eBay').frais === 22, 'F5 §2.8 : le port eBay (9,90 € par commande) n’est ni recette ni charge', s('eBay'));
  dit(s('Vinted').etat === 'auMoins' && s('Vinted').frais === 7.49 && s('Vinted').raison === 'boostsPasLus', 'F1/F8 Vinted : au moins 7,49 € (2,50 noté + pack 4,99), boosts pas lus chez Vinted', s('Vinted'));
  dit(s('Vinted').boosts === 2.5, 'F8 le boost noté sur la fiche est mis à part (déjà dans le total)', s('Vinted'));
  dit(s('Leboncoin').etat === 'inconnu' && s('Leboncoin').frais === null && s('Leboncoin').raison === 'optionsPasLues', 'F1 Leboncoin rien noté ⇒ « — » (null), jamais 0', s('Leboncoin'));
  dit(s('Vestiaire').etat === 'auMoins' && s('Vestiaire').frais === 37.5 && s('Vestiaire').couverture.lus === 1, 'F4 Vestiaire : commission lue sur 1 des 2 ventes ⇒ au moins 37,50 €', s('Vestiaire'));
  dit(A.total === 66.99 && A.auMoins === true, 'F4 total = 22 + 7,49 + 37,50 = 66,99 €, « au moins » (une source partielle)', A);
  const B = F.fraisParPlateforme({ releve, ebay, packs, ...F.bornesAnnee(AN), excluAutre, R, vestiaire });
  const memes = ['eBay', 'Vinted', 'Vestiaire'].every((p) => (B.sites.find((x) => x.plateforme === p) || {}).frais === s(p).frais);
  dit(memes, 'F6 le même chiffre que « Frais par site » sur les mêmes bornes', B.sites.map((x) => [x.plateforme, x.frais]));
  const seulEbayInconnu = F.fraisAnnee({ releve: [], releveAt: MAINT, ebay: [cmd('X', j(0), m(50), null)], packs: [], annee: AN, R, maintenant: MAINT });
  dit(seulEbayInconnu.total === null && seulEbayInconnu.sites[0].etat === 'inconnu' && seulEbayInconnu.sites[0].frais === null && seulEbayInconnu.sites[0].raison === 'fraisPasLus',
    'F1 eBay sans aucun frais lu ⇒ total null (« — »), jamais 0', seulEbayInconnu);
  const vieux = F.fraisAnnee({ releve, releveAt: MAINT, ebay: [], packs: [], annee: AN - 3, R, maintenant: MAINT });
  dit(vieux.avantReleve === true && vieux.sites.filter((x) => x.plateforme !== 'eBay').every((x) => x.etat === 'passu' && x.raison === 'avantReleve' && x.frais === null),
    'F7 une année plus ancienne que le relevé ⇒ « pas relevé », jamais 0', vieux);
  const pasLu = F.fraisAnnee({ releve: null, ebay: null, packs: [], annee: AN, R, maintenant: MAINT });
  dit(pasLu.total === null && pasLu.sites.every((x) => x.etat === 'passu'), 'F1 rien de lu ⇒ tout « — »', pasLu);
  const ans = F.anneesFrais({ releve, ebay: [cmd('Y', new Date(AN - 2, 3, 1).getTime(), m(1), m(0.1))], maintenant: MAINT });
  dit(JSON.stringify(ans) === JSON.stringify([AN, AN - 2]), 'F  les années proposées : l’année en cours puis celles des ventes connues', ans);

  // ── L : la carte ─────────────────────────────────────────────────────────
  const lignes = [
    { plateforme: 'Vinted', ts: j(0), eur: 60, compte: 'compte_a', uid: '111', tx: '9001' },
    { plateforme: 'Vinted', ts: j(1), eur: 45, compte: 'compte_a', uid: '111', tx: '9002' },
    { plateforme: 'Vinted', ts: j(2), eur: 30, compte: 'compte_b', uid: '222', tx: '9003' },   // pas de détail ⇒ sans lieu
    { plateforme: 'Vinted', ts: j(3), eur: 70, compte: 'compte_b', uid: '222', tx: '9004' },   // pays inconnu de la table
    { plateforme: 'eBay', ts: j(0), eur: 100, compte: 'ma_boutique_ebay', tx: 'E1' },
    { plateforme: 'eBay', ts: j(1), eur: 80, compte: 'ma_boutique_ebay', tx: 'E2' },
    { plateforme: 'eBay', ts: j(2), eur: 70, compte: 'ma_boutique_ebay', tx: 'E3' },
    { plateforme: 'eBay', ts: j(3), eur: 55, compte: 'ma_boutique_ebay', tx: 'E6' },
    { plateforme: 'Leboncoin', ts: j(2), eur: 80, compte: 'lbc_moi', tx: '77' },
    { plateforme: 'Vinted', ts: j(-400), eur: 99, compte: 'compte_a', uid: '111', tx: '8000' },   // hors période
    { plateforme: 'Vinted', ts: j(5), eur: 999, compte: 'compte_exclu', uid: '999', tx: '9999' }, // écarté
  ];
  const paysVinted = { 9001: 'FR', 9002: { cc: 'IT', item: '5' }, 9004: 'ZZ', 8000: 'FR', 9999: 'DE' };
  const ebayL = [
    { orderId: 'E1', ...adr('LYON', '69003', 'FR') },
    { orderId: 'E2', ...adr('Lyon', '69007', 'FR') },
    { orderId: 'E3', ...adr('Bruxelles', '1000', 'BE') },
    { orderId: 'E6' },                                     // pas d'adresse
  ];
  const releveN = [['Vinted', 'compte_a', '9001', j(0), 60, 30, 0, 't', '12', ''], ['eBay', '', 'ebay:E1', j(0), 100, 40, 0, 't', 'B230', '']];
  const de = new Date(AN, 0, 1).getTime(), a = new Date(AN + 1, 0, 1).getTime();
  const ecarte = (l) => l.uid === '999';
  const sansCoord = L.lieuxVentes({ lignes, paysVinted, ebay: ebayL, releve: releveN, de, a, ecarte });
  const avecCoord = L.lieuxVentes({ lignes, paysVinted, ebay: ebayL, releve: releveN, de, a, ecarte, coordVille: (k) => (k === L.cleVille('69', 'Lyon') ? { lat: 45.76, lon: 4.84 } : null) });
  const P = (R0, cc) => R0.pays.find((x) => x.pays === cc) || {};
  dit(sansCoord.n === 9 && sansCoord.sansLieu.n === 3 && sansCoord.sansLieu.par.Leboncoin.n === 1 && sansCoord.sansLieu.par.Leboncoin.raison === 'siteNeDonnePas'
    && sansCoord.sansLieu.par.Vinted.raison === 'detailPasLu' && sansCoord.sansLieu.par.eBay.raison === 'adresseAbsente',
    'L1 trois ventes sans lieu, comptées à part avec leur raison', sansCoord.sansLieu);
  dit(P(sansCoord, 'FR').n === 3 && P(sansCoord, 'FR').c === 24000, 'L5 France (monde) = 1 Vinted (pays) + 2 eBay Lyon = 3 ventes, 240 €', P(sansCoord, 'FR'));
  dit(sansCoord.franceSansVille.n === 1, 'L5 la vente Vinted française sans ville est comptée à part en France', sansCoord.franceSansVille);
  const dep = sansCoord.france.find((x) => x.cle === 'd|69');
  dit(sansCoord.france.length === 1 && dep && dep.n === 2 && dep.approx === true && dep.villes.length === 1,
    'L2 Lyon 69003 et « LYON » 69007, ville pas encore placée : UNE bulle (département 69), une ville à placer', sansCoord.france);
  const vl = avecCoord.france.find((x) => x.niveau === 'ville');
  dit(avecCoord.france.length === 1 && vl && vl.n === 2 && vl.ville === 'Lyon' && vl.c === 18000 && !vl.approx, 'L2 ville placée : UNE bulle « Lyon », 2 ventes, 180 €', avecCoord.france);
  dit(P(sansCoord, 'ZZ').horsCarte === true && P(sansCoord, 'ZZ').lat === null, 'L5 un pays absent de la table est « hors carte », jamais placé', P(sansCoord, 'ZZ'));
  dit(!P(sansCoord, 'DE').n && sansCoord.n === 9, 'L4 la vente du compte écarté ne sort pas ; celle hors période non plus', sansCoord.pays.map((x) => x.pays));
  const fr = P(sansCoord, 'FR').ventes;
  dit(fr.some((v) => v.num === '12' && v.plateforme === 'Vinted') && fr.some((v) => v.num === 'B230' && v.plateforme === 'eBay') && fr.some((v) => v.num === ''),
    'L5 le N° vient du relevé par identité (12 · B230), sinon vide', fr);
  const sortie = JSON.stringify([sansCoord, avecCoord]);
  const interdits = ['Gaspard', 'Inventé', 'Imaginaire', 'gaspard@', '0600000000', 'pseudo_acheteur_ebay', 'ma_boutique_ebay', 'compte_a', 'compte_b', 'lbc_moi', '"9001"', '"E1"', '"tx"', '"uid"', '"compte"', 'fullName', 'addressLine'];
  const fuites = interdits.filter((x) => sortie.includes(x));
  dit(!fuites.length, 'L3 aucun nom, pseudo, adresse, compte ni n° de transaction dans la sortie', fuites);
  const seulEbay = L.lieuxVentes({ lignes, paysVinted, ebay: ebayL, releve: releveN, de, a, ecarte, plateforme: 'eBay' });
  dit(seulEbay.n === 4 && seulEbay.plateformes.join(',') === 'Vinted,eBay,Leboncoin', 'L4 le filtre plateforme garde eBay seulement (les choix restent tous proposés)', { n: seulEbay.n, p: seulEbay.plateformes });
  dit(L.lieuxVentes({ lignes: null }).etat === 'passu' && L.lieuxVentes({}).etat === 'encours', 'L  ventes pas lues ⇒ « pas su », en cours ⇒ « en cours » (jamais une carte vide)');
  // L6 : 2 000 ventes inventées.
  const big = [], pv = {}, eb = [];
  const PAYS = ['FR', 'IT', 'ES', 'DE', 'NL', 'BE', 'PT', 'IE', 'AT', 'LU', 'PL'];
  for (let i = 0; i < 2000; i++) {
    const tx = String(100000 + i);
    if (i % 5 === 0) { big.push({ plateforme: 'eBay', ts: j(i % 300 - 150), eur: 50 + (i % 90), tx: 'O' + i }); eb.push({ orderId: 'O' + i, ...adr(['Lyon', 'Paris', 'Lille', 'Nantes'][i % 4], ['69001', '75011', '59000', '44000'][i % 4], 'FR') }); }
    else { big.push({ plateforme: 'Vinted', ts: j(i % 300 - 150), eur: 40 + (i % 70), tx }); if (i % 7) pv[tx] = PAYS[i % PAYS.length]; }
  }
  const t0 = process.hrtime.bigint();
  const G = L.lieuxVentes({ lignes: big, paysVinted: pv, ebay: eb, releve: [], de: -Infinity, a: Infinity });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  dit(ms < 50 && G.n === 2000 && G.pays.reduce((t, x) => t + x.n, 0) + G.sansLieu.n === 2000, `L6 2 000 ventes agrégées en ${ms.toFixed(1)} ms (< 50), rien perdu`, { ms, n: G.n });

  // ── S : le code ──────────────────────────────────────────────────────────
  const lire = (f) => { try { return fs.readFileSync(path.join(racine, f), 'utf8'); } catch (_) { return ''; } };
  const sansCom = (s0) => s0.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const cv = sansCom(lire('src/CarteVentes.jsx')), fp = sansCom(lire('src/FraisPlateformes.jsx')), st = sansCom(lire('src/ecrans/Stats.jsx'));
  dit(cv && fp && !/from ['"]\.\/App\.jsx['"]/.test(cv + fp), 'S  les deux blocs n’importent pas App.jsx');
  dit(!/nominatim/i.test(cv), 'S  aucune requête Nominatim (pas de requêtes en masse)');
  const fetchs = (cv.match(/fetch\(/g) || []).length;
  dit(fetchs === 1 && /for \(const v of file\)/.test(cv) && /\.slice\(0, 40\)/.test(cv), 'S  une seule recherche de ville, dans la file (une par VILLE, 40 au plus par ouverture)', fetchs);
  dit(/<FraisAnneeArgent\b/.test(st) && /<CarteVentesArgent\b/.test(st) && /<FraisPlateformes\b/.test(st) && /<CarteVentes\b/.test(st), 'S  les deux blocs sont RENDUS dans Argent (Stats.jsx)');
  dit(/fraisAnnee\(/.test(fp) && !/totalMarketplaceFee/.test(fp), 'S  l’écran des frais ne recalcule rien (la règle `fraisAnnee`)');
}

(async () => {
  if (process.argv.includes('--prouve')) {
    let tues = 0;
    for (const [f, avant, apres, nom] of MUTATIONS) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-mut-'));
      for (const g of ['src/fraisPlateformes.js', 'src/lieuxVentes.js', 'src/lieuxTables.js', 'src/CarteVentes.jsx', 'src/FraisPlateformes.jsx', 'src/ecrans/Stats.jsx']) {
        fs.mkdirSync(path.dirname(path.join(tmp, g)), { recursive: true });
        fs.copyFileSync(path.join(RACINE, g), path.join(tmp, g));
      }
      const p = path.join(tmp, f), s0 = fs.readFileSync(p, 'utf8');
      if (!s0.includes(avant)) { console.log(`❌ mutation introuvable (${nom}) : le texte a changé`); ko++; continue; }
      fs.writeFileSync(p, s0.replace(avant, apres));
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
      const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: tmp, MUET: '1' }, encoding: 'utf8' });
      const rouge = r.status !== 0;
      console.log(`${rouge ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouge ? 'rouge' : 'VERT (le contrôle ne la voit pas)'}`);
      if (rouge) tues++; else ko++;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
    console.log(`\n${tues}/${MUTATIONS.length} mutations tuées`);
    process.exit(ko ? 1 : 0);
  }
  try { await verifier(RACINE); } catch (e) { dit(false, 'l’audit a planté', e && e.stack); }
  console.log(`\n${ko ? '❌' : '✅'} audit-frais-carte : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
