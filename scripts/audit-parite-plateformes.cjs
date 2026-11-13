// AUDIT — PARITÉ DES PLATEFORMES (11 nov.)
//
// Ce que VRM fait pour une vente Vinted, il doit le faire pour une vente Leboncoin,
// eBay ou Vestiaire quand la plateforme donne l'information — et DIRE « pas su »
// sinon. Ce contrôle EXÉCUTE les vraies règles sur des données INVENTÉES à la vraie
// forme (prix Leboncoin en centimes, commandes eBay `paymentSummary.totalDueSeller`,
// ventes Vestiaire `{ etat, montant:{valeur,devise,cle}, date }`) :
//   P1  « Finalisé par plateforme » (Statistiques) : un compte Leboncoin, eBay ou
//       Vestiaire ÉCARTÉ (Comptes liés) n'y entre plus — il y était encore compté ;
//   P2  « CA entre deux dates » : Leboncoin, eBay, Vestiaire comptés à leur jour de
//       vente, comptes écartés hors, plateforme pas lue NOMMÉE, sans date / montant
//       pas sûr hors total et dit ; l'écran les somme avec Vinted (plus « Vinted »
//       seul) ;
//   P3  rapport du mois, registre annuel, tableur des ventes : le prix d'achat et le N°
//       d'une vente Leboncoin/eBay/Vestiaire viennent de la paire reliée par IDENTITÉ
//       (`autresBenefice`, même id que la ligne) — jamais du titre ; le tableur liste
//       ces ventes ; « sources non lues » nomme Vestiaire ;
//   P4  Colis : le récapitulatif dit « au moins » quand Leboncoin ou Vestiaire n'ont
//       pas pu être lus (avant : eBay seulement).
//
//   node scripts/audit-parite-plateformes.cjs              → le contrôle
//   node scripts/audit-parite-plateformes.cjs --mutations  → chaque règle réaffaiblie
//        dans une copie : le contrôle doit passer au ROUGE (§6.1).
// Aucune donnée réelle : tout est inventé ici.
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');

if (process.argv.includes('--mutations')) {
  const MUT = [
    ['P1 compte écarté recompté (Leboncoin)', 'src/ecrans/Stats.jsx', ".filter(garde('leboncoin')).filter(o => !lbcAnnulee(o) && lbcFinalisee(o));", ".filter(o => !lbcAnnulee(o) && lbcFinalisee(o));"],
    ['P1 compte écarté recompté (Vestiaire)', 'src/ecrans/Stats.jsx', "caVestiaireFinalise(Array.isArray(ventesVc) ? ventesVc.filter(garde('vestiaire')) : ventesVc)", "caVestiaireFinalise(ventesVc)"],
    ['P1 compte écarté recompté (eBay)', 'src/ecrans/Stats.jsx', "ebayCommandes.filter(garde('ebay'))", "ebayCommandes"],
    ['P1 Dashboard ne passe pas le prédicat', 'src/ecrans/Stats.jsx', "const plateformes = caParPlateforme(liveStats, lbcVentes, ebayCa, ebayCommandes, ventesVc, excluAutreDash);", "const plateformes = caParPlateforme(liveStats, lbcVentes, ebayCa, ebayCommandes, ventesVc);"],
    ['P2 compte écarté compté', 'src/caAutresParJour.js', "const exclu = (p, v) => !!(excluAutre && excluAutre(p, v));", "const exclu = () => false;"],
    ['P2 Leboncoin pas lu muet', 'src/caAutresParJour.js', "if (lbc === null) pasLues.push('Leboncoin');\n  else for", "if (false) pasLues.push('Leboncoin');\n  else for"],
    ['P2 Vestiaire au montant pas sûr compté 0', 'src/caAutresParJour.js', "if (eur == null) { horsTotal.Vestiaire = (horsTotal.Vestiaire || 0) + 1; continue; }", "if (eur == null) { ajoute('Vestiaire', R.dateVenteVc(v), 0); continue; }"],
    ['P2 eBay au total payé (port compris)', 'src/caAutresParJour.js', "const eur = R.montantRecuEbay(o).eur;", "const eur = Number(o.pricingSummary && o.pricingSummary.total && o.pricingSummary.total.value);"],
    ['P2 date Leboncoin sans heure en UTC', 'src/caAutresParJour.js', "? Date.parse(d + 'T12:00:00') : Date.parse(d)", ": Date.parse(d)"],
    ['P2 l\'écran ne somme que Vinted', 'src/ecrans/Stats.jsx', "return {ca:Math.round((v.ca+a.ca)*100)/100,count:v.count+a.count,", "return {ca:Math.round((v.ca)*100)/100,count:v.count,"],
    ['P3 rapport du mois sans prix d\'achat hors Vinted', 'src/App.jsx', "        // reliée par IDENTITÉ (`autresBenefice`, même id `lbc:`/`ebay:`/`vestiaire:` que la\n        // ligne) — jamais par le titre. Pas relié ⇒ vide, comme une vente Vinted sans prix.\n        const a = autresParIdRapport.get(String(l.id));", "        const a = null;"],
    ['P3 registre annuel sans prix d\'achat hors Vinted', 'src/App.jsx', "        // (11 nov., parité) Même identité que le rapport du mois (`autresParIdRapport`).\n        const a = autresParIdRapport.get(String(l.id));", "        const a = null;"],
    ['P3 relié par le titre', 'src/App.jsx', "new Map((autresBenefice || []).map((x) => [String(x.id), x]))", "new Map((autresBenefice || []).map((x) => [String(x.titre || x.id), x]))"],
    ['P3 tableur Vinted seul', 'src/App.jsx', "      if (!l || l.plateforme === 'Vinted') continue;\n      const a = autresParIdRapport.get(String(l.id));", "      if (true) continue;\n      const a = autresParIdRapport.get(String(l.id));"],
    ['P3 Vestiaire absent des sources non lues', 'src/App.jsx', ", ventesVc === null ? 'Vestiaire' : null].filter(Boolean);\n    // Registre des ventes", "].filter(Boolean);\n    // Registre des ventes"],
    ['P4 Colis : Leboncoin pas lu sans « au moins »', 'src/App.jsx', "colisAutres.leboncoin === null ? 'Leboncoin' : null, colisAutres.vestiaire === null ? 'Vestiaire' : null].filter(Boolean);", "].filter(Boolean);"],
  ];
  let tues = 0;
  for (const [nom, fichier, de, vers] of MUT) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-mut-'));
    for (const d of ['api', 'src', 'scripts']) fs.cpSync(path.join(R, d), path.join(tmp, d), { recursive: true, filter: (s) => !/node_modules|\/fx\//.test(s) });
    try { fs.symlinkSync(path.join(R, 'node_modules'), path.join(tmp, 'node_modules')); } catch (_) {}
    fs.writeFileSync(path.join(tmp, 'package.json'), fs.readFileSync(path.join(R, 'package.json')));
    const f = path.join(tmp, fichier); const txt = fs.readFileSync(f, 'utf8');
    if (!txt.includes(de)) { console.log(`❌ mutation « ${nom} » : le texte à réaffaiblir est introuvable (mettre la mutation à jour)`); fs.rmSync(tmp, { recursive: true, force: true }); continue; }
    fs.writeFileSync(f, txt.replace(de, vers));
    const r = spawnSync('node', [path.join(tmp, 'scripts', 'audit-parite-plateformes.cjs')], { encoding: 'utf8', env: { ...process.env, VRM_RACINE: tmp } });
    const rouges = ((r.stdout || '').match(/^❌/mg) || []).length;
    console.log(`${rouges ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} contrôle(s) rouge(s)${rouges ? '' : ' — LA MUTATION SURVIT'}`);
    if (rouges) tues++;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\n${tues}/${MUT.length} mutations tuées`);
  process.exit(tues === MUT.length ? 0 : 1);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m, String((e && e.message) || e).split('\n')[0]); } };
const imp = async (f) => { try { return await import('file://' + path.join(R, f)); } catch (e) { return { __erreur: e.message }; } };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
// La source d'App.jsx et de ses écrans découpés, lue dans l'arbre jugé (VRM_RACINE).
const APP = [path.join(R, 'src', 'App.jsx'), ...['ecrans', 'coeur'].flatMap((d) => { try { return fs.readdirSync(path.join(R, 'src', d)).filter((f) => /\.jsx?$/.test(f)).sort().map((f) => path.join(R, 'src', d, f)); } catch (_) { return []; } })]   // (11 nov.) + src/coeur/
  .map((f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return ''; } }).join('\n');
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const APPc = sansCommentaires(APP);
function extraire(src, nom) {
  const m = new RegExp(`^(?:async )?function ${nom}\\(|^const ${nom}\\s*=\\s*`, 'm').exec(src);
  if (!m) return '';
  const estFn = /function/.test(m[0]); let prof = 0, vuCorps = false;
  for (let i = m.index; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') { prof--; if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1); }
    else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1);
  }
  return '';
}
const charger = (noms, ctx) => {
  vm.createContext(ctx);
  for (const n of noms) { const t = extraire(APP, n); if (!t) continue; try { vm.runInContext(t.replace(/^const /, 'var ') + `\n;this.${n} = ${n};`, ctx); } catch (_) {} }
  return ctx;
};

(async () => {
  const VC = await imp('api/_lib/vestiaire-regle.js');
  const CE = await imp('api/_lib/comptes-exclus.js');
  const iso = (t) => new Date(t).toISOString();
  const jour = (y, m, d, h = 15) => new Date(y, m - 1, d, h, 0, 0).getTime();
  // Les ventes inventées, à la vraie forme — deux comptes par plateforme, l'un ÉCARTÉ.
  const lbc = [
    { txId: 'L1', isSeller: true, parcelColor: 'finished', price: 4500, account: 'lbc-account:A', dateVente: iso(jour(2026, 11, 3)) },
    { txId: 'L2', isSeller: true, parcelColor: 'finished', price: 7000, account: 'lbc-account:B', dateVente: iso(jour(2026, 11, 3)) },
    { txId: 'L3', isSeller: true, parcelColor: 'finished', price: 2000, account: 'lbc-account:A', dateVente: '2026-11-05' },
  ];
  const eb = (id, compte, net, fee, j) => ({ orderId: id, _compte: compte, orderPaymentStatus: 'PAID', creationDate: iso(j), paymentSummary: { totalDueSeller: { value: String(net), currency: 'EUR' } }, totalMarketplaceFee: { value: String(fee), currency: 'EUR' }, pricingSummary: { total: { value: String(net + 9), currency: 'EUR' } }, lineItems: [{ sku: 'VRM-1', title: 'Article' }] });
  const ebay = [eb('E1', 'ebA', 100, 12, jour(2026, 11, 4)), eb('E2', 'ebB', 50, 5, jour(2026, 11, 4))];
  const vc = [
    { id: 'V1', compte: 'vcA', etat: 'Payout sent', montant: { valeur: 150, devise: 'EUR', cle: 'sellerPayout' }, date: iso(jour(2026, 11, 6)) },
    { id: 'V2', compte: 'vcB', etat: 'Payout sent', montant: { valeur: 80, devise: 'EUR', cle: 'sellerPayout' }, date: iso(jour(2026, 11, 6)) },
    { id: 'V3', compte: 'vcA', etat: 'completed', montant: { valeur: 60, devise: 'EUR', cle: 'price.amount' }, date: iso(jour(2026, 11, 6)) },
  ];
  const exclus = { leboncoin: ['B'], ebay: ['ebB'], vestiaire: ['vcB'] };
  const excluAutre = CE.excluAutreDe ? CE.excluAutreDe(exclus, null) : null;
  dit(typeof excluAutre === 'function', 'le prédicat des comptes écartés (api/_lib/comptes-exclus.js) se construit', CE.__erreur || '');

  console.log('\n── P1 · « Finalisé par plateforme » : un compte écarté n\'y entre pas');
  await essaie('caParPlateforme', async () => {
    const c = charger(['commandeEbayEngagee', 'montantRecuEbay', 'caEbayPayees', 'etatCaEbay', 'NOTE_CA_EBAY', 'lbcAnnulee', 'lbcFinalisee', 'caVestiaireFinalise', 'caParPlateforme'],
      { Math, Number, String, Array, Object, JSON, isFinite, vcVenteAnnulee: VC.vcVenteAnnulee, etapeMotVc: VC.etapeMotVc, montantRecuVc: VC.montantRecuVc });
    if (typeof c.caParPlateforme !== 'function') throw new Error('caParPlateforme introuvable');
    const vcSur = vc.filter((v) => v.id !== 'V3');
    const l = c.caParPlateforme({ caEncaisse: 10 }, { ventes: lbc }, c.caEbayPayees(ebay), ebay, vcSur, excluAutre);
    const de = (n) => l.find((x) => x.nom === n || (n === 'Vestiaire' && /Vestiaire/.test(x.nom)));
    dit(de('Leboncoin').ca === 65, 'Leboncoin : 45 + 20 € du compte gardé ; les 70 € du compte écarté hors', JSON.stringify(de('Leboncoin')));
    dit(de('eBay').ca === 88, 'eBay : 100 − 12 € reçus du compte gardé ; le compte écarté hors (et jamais le port)', JSON.stringify(de('eBay')));
    dit(de('Vestiaire').ca === 150, 'Vestiaire : 150 € versés du compte gardé ; le compte écarté hors', JSON.stringify(de('Vestiaire')));
    const sans = c.caParPlateforme({ caEncaisse: 10 }, { ventes: lbc }, c.caEbayPayees(ebay), ebay, vcSur, null);
    dit(sans.find((x) => x.nom === 'Leboncoin').ca === 135 && sans.find((x) => x.nom === 'eBay').ca === 133, 'aucun compte écarté ⇒ tout compté, comme avant', JSON.stringify(sans.map((x) => x.ca)));
  });
  const ST = sansCommentaires(lire('src/ecrans/Stats.jsx'));
  dit((ST.match(/caParPlateforme\([^)]*excluAutreDash\)/g) || []).length >= 2, 'les deux appels de l\'écran passent les comptes écartés (`excluAutreDash`)');
  dit(/const excluAutreDash\s*=\s*useExcluAutre\(\)/.test(ST), '… lus par la même règle que le reste (`useExcluAutre`)');

  console.log('\n── P2 · « CA entre deux dates » : toutes plateformes, rien deviné');
  const CJ = await imp('src/caAutresParJour.js');
  await essaie('caAutresParJour', async () => {
    if (CJ.__erreur) throw new Error(CJ.__erreur);
    const c = charger(['commandeEbayEngagee', 'montantRecuEbay', 'lbcAnnulee', 'lbcFinalisee'], { Math, Number, String, Array, Object, JSON, isFinite });
    const RG = { lbcAnnulee: c.lbcAnnulee, lbcFinalisee: c.lbcFinalisee, commandeEbayEngagee: c.commandeEbayEngagee, montantRecuEbay: c.montantRecuEbay, etapeMotVc: VC.etapeMotVc, vcVenteAnnulee: VC.vcVenteAnnulee, montantRecuVc: VC.montantRecuVc, dateVenteVc: VC.dateVenteVc };
    const r = CJ.caAutresParJour({ lbc, ebay, vestiaire: vc, excluAutre, R: RG });
    dit(r.parJour['2026-11-03'] && r.parJour['2026-11-03'].ca === 45 && r.parJour['2026-11-03'].n === 1, 'Leboncoin le 3 : 45 € (le compte écarté hors)', JSON.stringify(r.parJour['2026-11-03']));
    dit(r.parJour['2026-11-05'] && r.parJour['2026-11-05'].ca === 20, 'Leboncoin daté à la main « 2026-11-05 » : le 5 (jamais la veille en UTC)', JSON.stringify(r.parJour));
    dit(r.parJour['2026-11-04'] && r.parJour['2026-11-04'].ca === 88, 'eBay le 4 : 88 € reçus (frais retirés, port jamais compté, compte écarté hors)', JSON.stringify(r.parJour['2026-11-04']));
    dit(r.parJour['2026-11-06'] && r.parJour['2026-11-06'].ca === 150, 'Vestiaire le 6 : 150 € versés (compte écarté hors)', JSON.stringify(r.parJour['2026-11-06']));
    dit(r.horsTotal.Vestiaire === 1, 'Vestiaire au montant pas sûr : hors total ET compté pour être dit', JSON.stringify(r.horsTotal));
    dit(r.pasLues.length === 0, 'tout lu ⇒ aucune plateforme nommée « pas lue »', JSON.stringify(r.pasLues));
    const p = CJ.caAutresParJour({ lbc: null, ebay: [], vestiaire: null, R: RG });
    dit(p.pasLues.join(',') === 'Leboncoin,Vestiaire', 'lecture ratée (`null`) ⇒ NOMMÉE (« au moins »), jamais 0', JSON.stringify(p.pasLues));
    const s = CJ.sommePlage(r.parJour, '2026-11-04', '2026-11-05');
    dit(s.ca === 108 && s.count === 2, 'plage du 4 au 5 : 88 + 20 = 108 €, 2 ventes (bornes comprises)', JSON.stringify(s));
  });
  dit(/sommePlage\(autresJour\.parJour,caDu,caAu\)/.test(ST) && /ca:Math\.round\(\(v\.ca\+a\.ca\)\*100\)\/100,count:v\.count\+a\.count/.test(ST), 'l\'écran somme Vinted ET les autres plateformes sur la plage');
  dit(/if\(autresJour===undefined\) return \{ passu:true, enCours:true \}/.test(ST), '… et attend les autres plateformes au lieu d\'afficher Vinted seul comme complet');
  dit(!/· Vinted, tous comptes`/.test(ST), 'la phrase ne dit plus « Vinted, tous comptes » sous un total toutes plateformes');
  dit(/'au moins ':''\)\+fmt\(caRange\.ca\)/.test(ST), 'une plateforme pas lue ⇒ « au moins » devant le montant');

  console.log('\n── P3 · Rapport du mois, registre annuel, tableur : la paire par IDENTITÉ');
  dit(/const autresParIdRapport = useMemo\(\(\) => new Map\(\(autresBenefice \|\| \[\]\)\.map\(\(x\) => \[String\(x\.id\), x\]\)\)/.test(APPc), 'la carte des ventes reliées est indexée par l\'id de la vente (jamais le titre)');
  dit((APPc.match(/const a = autresParIdRapport\.get\(String\(l\.id\)\);/g) || []).length >= 3, 'rapport du mois, registre annuel et tableur y lisent le prix d\'achat et le N° (3 lectures)', String((APPc.match(/autresParIdRapport\.get\(String\(l\.id\)\)/g) || []).length));
  // Les ids des lignes déclarables et des ventes reliées sont les MÊMES (sinon la carte ne trouve rien).
  const D = extraire(APP, 'ventesDeclarables'), B = extraire(APP, 'ventesAutresBenefice');
  for (const [pref, nom] of [["'lbc:' + v.txId", 'Leboncoin'], ["'ebay:' + e.orderId", 'eBay'], ["'vestiaire:' + v.id", 'Vestiaire']]) {
    const prefB = pref.replace('e.orderId', 'o.orderId');
    dit(D.includes(pref) && B.includes(prefB), `${nom} : même identité dans la ligne déclarable et dans la vente reliée (${pref})`);
  }
  const CSV = (() => { const i = APPc.indexOf('const exportCsv = () => {'); return i < 0 ? '' : APPc.slice(i, i + 5000); })();
  dit(/for \(const l of \(\(declRapport && declRapport\.lignes\) \|\| \[\]\)\) \{\s*if \(!l \|\| l\.plateforme === 'Vinted'\) continue;/.test(CSV), 'le tableur des ventes liste aussi Leboncoin, eBay, Vestiaire (à l\'argent reçu)');
  dit(/Ventes pas lues : \$\{sourcesAutresKO\.join/.test(CSV), '… et nomme une plateforme pas lue');
  dit(/ventesVc === null \? 'Vestiaire' : null\]\.filter\(Boolean\);\s*saleLines\.sort/.test(APPc), 'rapport du mois : « sources non lues » nomme Vestiaire');

  console.log('\n── P4 · Colis : « au moins » pour Leboncoin et Vestiaire');
  dit(/const autresPasLusRecap = \[colisEb === null \? 'eBay' : null, colisAutres\.leboncoin === null \? 'Leboncoin' : null, colisAutres\.vestiaire === null \? 'Vestiaire' : null\]/.test(APPc), 'le récapitulatif nomme chaque plateforme pas lue');
  dit(/\{autresPasLusRecap\.length \? 'au moins ' : ''\}\{tot\}/.test(APPc), '… et écrit « au moins » devant le total');

  console.log(`\n${ko ? '❌' : '✅'} parité des plateformes : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
