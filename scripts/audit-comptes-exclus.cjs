require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : les comptes Leboncoin, Vestiaire et eBay écartés des totaux (3 nov.)
//   node scripts/audit-comptes-exclus.cjs            (les règles telles qu'elles sont)
//   node scripts/audit-comptes-exclus.cjs --prouve   (+ chaque mutation DOIT rougir)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « Comptes liés : il doit y avoir les comptes Leboncoin, Vestiaire et
// eBay ; tout ce qui est fait pour Vinted doit être fait pour le reste ».
// Vinted a « les comptes sélectionnés » : un compte écarté n'entre dans AUCUN
// total. Ce que cet audit EXÉCUTE (données inventées) :
//   1. la règle (api/_lib/comptes-exclus.js) : identité Leboncoin (`lbc-account:`),
//      eBay (`_compte`), Vestiaire (`compte`, vide = « non identifié ») ; une vente
//      SANS compte n'est jamais écartée ; rien d'écarté ⇒ aucun prédicat ;
//   2. VENDU (`ventesFaites`) et REÇU / CA déclaré (`ventesDeclarables`, `exclues`)
//      du miroir serveur (= App.jsx au jeton près, audit-bilan-semaine) ;
//   3. le BÉNÉFICE (`ventesAutresBenefice`, lu dans App.jsx) ;
//   4. le bilan de la semaine (`calculerBilan`, exclusAutres) et les commandes
//      eBay du serveur marquées de leur compte ;
//   5. chaque appel d'App.jsx qui calcule un total passe `excluAutre` ; la clé
//      est synchronisée et lue par le serveur.
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const R = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const PROUVE = process.argv.includes('--prouve');

// Une déclaration de premier niveau `const X = …;` d'App.jsx, par comptage.
function extraire(src, nom) {
  const i = src.indexOf(`const ${nom} = `);
  if (i < 0) return null;
  let prof = 0, j = i, vu = false;
  for (; j < src.length; j++) {
    const c = src[j];
    if (c === '(' || c === '{' || c === '[') { prof++; vu = true; }
    else if (c === ')' || c === '}' || c === ']') prof--;
    else if (c === ';' && prof === 0 && vu) break;
  }
  return src.slice(i, j + 1);
}

async function charger(mut) {
  // Copie des modules dans un dossier temporaire, mutation appliquée au texte.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cexcl-'));
  const lib = path.join(dir, 'api', '_lib'); fs.mkdirSync(lib, { recursive: true });
  for (const f of fs.readdirSync(path.join(R, 'api', '_lib'))) if (f.endsWith('.js')) {
    let t = lire('api/_lib/' + f);
    if (mut && mut.fichier === f) t = mut.fn(t);
    fs.writeFileSync(path.join(lib, f), t);
  }
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true }); fs.copyFileSync(path.join(R, 'src', 'profilVendeur.js'), path.join(dir, 'src', 'profilVendeur.js'));   // (lot vocabulaire-article) importé par bilan-semaine
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(path.join(dir, 'api', 'package.json'), '{"type":"module"}');
  const imp = (f) => import('file://' + path.join(lib, f));
  let app = require("./_source-app.cjs").sourceApp();
  if (mut && mut.fichier === 'App.jsx') app = mut.fn(app);
  return { ex: await imp('comptes-exclus.js'), vr: await imp('ventes-regle.js'), bil: await imp('bilan-semaine.js'), eae: await imp('ebay-a-expedier.js'), vcr: await imp('vestiaire-regle.js'), app, dir };
}

async function verifier(M, dit) {
  const { ex, vr, bil, eae, vcr, app } = M;
  // ── 1. La règle
  const exclus = { leboncoin: ['lbc-account:BBB'], ebay: ['cle0000000000001'], vestiaire: [ex.SANS_COMPTE_VC] };
  const p = ex.excluAutreDe(exclus);
  dit(ex.excluAutreDe({}) === null && ex.excluAutreDe(null) === null, 'rien d\'écarté ⇒ aucun prédicat (le chemin d\'avant)');
  dit(!!p && p('leboncoin', { account: 'BBB' }) === true, 'Leboncoin : « lbc-account:BBB » écarté ⇒ la vente du compte « BBB » l\'est (une identité)');
  dit(!!p && p('leboncoin', { account: 'AAA' }) === false, 'Leboncoin : un autre compte compte toujours');
  dit(!!p && p('leboncoin', { account: '' }) === false && p('leboncoin', {}) === false, 'Leboncoin : une vente SANS compte relevé n\'est jamais écartée (pas su ≠ oui)');
  dit(!!p && p('ebay', { _compte: 'cle0000000000001' }) === true && p('ebay', { _compte: 'principal' }) === false && p('ebay', {}) === false, 'eBay : écarté par la référence du compte (`_compte`), jamais sans');
  dit(!!p && p('vestiaire', { compte: '' }) === true && p('vestiaire', { compte: '77' }) === false, 'Vestiaire : « non identifié » écarte les ventes sans compte, pas celles d\'un compte relevé');
  const b1 = ex.basculerExclu({}, 'leboncoin', 'lbc-account:CCC'), b2 = ex.basculerExclu(b1, 'leboncoin', 'CCC');
  dit(JSON.stringify(b1) === '{"leboncoin":["CCC"]}' && JSON.stringify(b2) === '{}', 'basculer : ajoute puis retire (même identité), rend une valeur neuve', JSON.stringify([b1, b2]));

  // ── 2. VENDU et REÇU
  const now = Date.parse('2026-10-15T12:00:00Z');
  const lbc = [
    { txId: 'L1', isSeller: true, price: 10000, dateVente: '2026-10-10T10:00:00Z', parcelColor: 'finished', account: 'lbc-account:AAA' },
    { txId: 'L2', isSeller: true, price: 5000, dateVente: '2026-10-11T10:00:00Z', parcelColor: 'finished', account: 'BBB' },
    { txId: 'L3', isSeller: true, price: 2000, dateVente: '2026-10-12T10:00:00Z', parcelColor: 'finished' },
  ];
  const ebayO = (id, compte, eur) => ({ orderId: id, _compte: compte, orderPaymentStatus: 'PAID', creationDate: '2026-10-12T10:00:00Z', paymentSummary: { totalDueSeller: { value: String(eur + 5), currency: 'EUR' } }, totalMarketplaceFee: { value: '5', currency: 'EUR' }, lineItems: [{ title: 'x' }] });
  const ebay = [ebayO('E1', 'principal', 30), ebayO('E2', 'cle0000000000001', 40)];
  const vf0 = vr.ventesFaites({ lbc, ebay });
  const vf = vr.ventesFaites({ lbc, ebay, excluAutre: p });
  const somme = (l) => Math.round(l.reduce((t, x) => t + x.eur, 0) * 100) / 100;
  dit(somme(vf0.lignes) === 240, 'VENDU sans exclusion : tout compte (100 + 50 + 20 + 30 + 40)', String(somme(vf0.lignes)));
  dit(somme(vf.lignes) === 150, 'VENDU : le compte Leboncoin et le compte eBay écartés sortent (100 + 20 + 30)', String(somme(vf.lignes)));
  const vd = vr.ventesDeclarables({ lbc, ebay, excluAutre: p });
  dit(somme(vd.lignes) === 150 && vd.exclues === 2, 'REÇU / CA déclaré : les mêmes sortent, et sont COMPTÉES à part (`exclues`)', `${somme(vd.lignes)} · exclues ${vd.exclues}`);
  // Vestiaire : une vente sans compte, au montant reçu sûr, versée.
  const vcVente = { id: 'V1', compte: '', etat: 'versee', montant: { recu: 80 }, date: '2026-10-12T10:00:00Z' };
  const avecVc = vr.ventesFaites({ vestiaire: [vcVente] }), sansVc = vr.ventesFaites({ vestiaire: [vcVente], excluAutre: p });
  dit((avecVc.lignes.length + avecVc.nonComptees.length) === 1 && (sansVc.lignes.length + sansVc.nonComptees.length) === 0, 'Vestiaire « non identifié » écarté : la vente ne compte NI dans le montant NI parmi les non comptées');

  // ── 3. BÉNÉFICE
  const code = ['lbcAnnulee', 'lbcFinalisee', 'commandeEbayEngagee', 'montantRecuEbay', 'ventesAutresBenefice'].map((n) => extraire(app, n)).filter(Boolean).join('\n');
  const ctx = vm.createContext({ ficheUniqueDuNumero: () => null, cleNum: (x) => x, ...vcr });
  vm.runInContext(code + '\nthis.f = ventesAutresBenefice;', ctx);
  const ben = (x) => ctx.f({ lbc, ebay, vestiaire: [], numeros: {}, achat: () => null, numLbc: () => '', numEbayLigne: () => '', excluAutre: x });
  dit(ben(null).length === 5 && ben(p).length === 3, 'BÉNÉFICE (`ventesAutresBenefice`) : les ventes des comptes écartés n\'y entrent pas', `${ben(null).length} → ${ben(p).length}`);

  // ── 4. Le bilan de la semaine, et les commandes eBay du serveur
  const debut = Date.parse('2026-10-06T00:00:00+02:00'), fin = Date.parse('2026-10-13T00:00:00+02:00');
  const e = { debut, fin, maintenant: now, lbc, ebay, versements: {} };
  const b0 = bil.calculerBilan(e), bx = bil.calculerBilan({ ...e, exclusAutres: exclus });
  dit(b0.vendu.eur === 240 && bx.vendu.eur === 150, 'bilan de la semaine : le VENDU suit les comptes écartés', `${b0.vendu.eur} → ${bx.vendu.eur}`);
  const reg = { comptes: [{ principal: true, cle: 'cle000000000000a', pseudo: 'p' }, { cle: 'cle0000000000001', pseudo: 'q' }] };
  const lus = await eae.lireCommandesEbayServeur({
    lireLigne: async () => reg,
    lireToutes: async () => [{ id: 'ebay_orders', orders: [{ orderId: 'E1' }] }, { id: 'ebay_orders_cle0000000000001', orders: [{ orderId: 'E2' }] }],
    comptesActifs: (r) => r.comptes.map((c) => ({ ...c, suffixe: c.principal ? '' : '_' + c.cle })),
    normaliserRegistre: (r) => r,
  });
  dit(Array.isArray(lus) && lus.map((o) => o._compte).join(',') === 'principal,cle0000000000001', 'serveur : chaque commande eBay porte son compte (`_compte`)', JSON.stringify(lus));

  // ── 5. Les appels de l'app, la clé synchronisée
  const sansCom = app.replace(/\/\/[^\n]*/g, '');
  const appels = [...sansCom.matchAll(/\b(ventesFaites|ventesDeclarables|ventesAutresBenefice)\(\{([\s\S]*?)\}\)/g)];
  const vintedSeul = (a) => /^\s*vinted: ventes, masquee, versements\s*$/.test(a[2]);
  const sans = appels.filter((a) => !vintedSeul(a) && !/\bexcluAutre\b/.test(a[2]));
  dit(appels.length >= 9 && sans.length === 0, `chaque total de l'app passe \`excluAutre\` (${appels.length} appels)`, sans.map((a) => a[0].slice(0, 90)).join(' | '));
  dit(/'vrm_comptes_exclus'/.test(sansCom.slice(sansCom.indexOf('SYNC_KEYS'), sansCom.indexOf('SYNC_KEYS') + 40000)), 'la clé `vrm_comptes_exclus` est synchronisée (SYNC_KEYS)');
  dit(/MAIN_BILAN = \[[^\]]*'vrm_comptes_exclus'/.test(lire('api/ship-reminders.js')) && /exclusAutres: mm \?/.test(lire('api/ship-reminders.js')), 'le bilan du serveur lit le choix dans `main`');
}

const MUTATIONS = [
  { nom: 'Leboncoin comparé sans l\'identité « lbc-account: »', fichier: 'comptes-exclus.js', fn: (t) => t.replace("replace(/^lbc-account:/i, '')", "replace(/^$/, '')") },
  { nom: 'une vente sans compte écartée (pas su = oui)', fichier: 'comptes-exclus.js', fn: (t) => t.replace('return c != null && s.has(c);', 'return c == null || s.has(c);') },
  { nom: 'VENDU ignore les comptes écartés (Leboncoin)', fichier: 'ventes-regle.js', fn: (t) => t.replace("if (excluAutre && excluAutre('leboncoin', v)) continue;", '') },
  { nom: 'REÇU ignore les comptes écartés (eBay)', fichier: 'ventes-regle.js', fn: (t) => t.split("if (excluAutre && excluAutre('ebay', e)) { exclues += 1; continue; }").join('') },
  { nom: 'le bilan ne passe pas le choix', fichier: 'bilan-semaine.js', fn: (t) => t.replace('const excluAutre = excluAutreDe(e.exclusAutres);', 'const excluAutre = null;') },
  { nom: 'le BÉNÉFICE ignore les comptes écartés', fichier: 'App.jsx', fn: (t) => t.replace("if (excluAutre && excluAutre('leboncoin', v)) continue;   // (3 nov.) compte écarté par son choix\n    const eur = v.price != null ? Number(v.price) / 100 : NaN;\n    if (!isFinite(eur) || vus.has", "const eur = v.price != null ? Number(v.price) / 100 : NaN;\n    if (!isFinite(eur) || vus.has") },
  { nom: 'un écran oublie `excluAutre`', fichier: 'App.jsx', fn: (t) => t.replace('vestiaire: ventesVcCoque || [], cachee, excluAutre: excluAutreCoque });', 'vestiaire: ventesVcCoque || [], cachee });') },
  { nom: 'eBay du serveur sans `_compte`', fichier: 'ebay-a-expedier.js', fn: (t) => t.replace("out.push(o && typeof o === 'object' && refDe.get(r.id) ? { ...o, _compte: refDe.get(r.id) } : o);", 'out.push(o);') },
];

(async () => {
  let ko = 0, ok = 0;
  const M = await charger(null);
  await verifier(M, (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); });
  fs.rmSync(M.dir, { recursive: true, force: true });
  if (PROUVE) {
    console.log('\n── Mutations (chacune doit rougir)');
    for (const mu of MUTATIONS) {
      let rouges = 0, appliquee = true;
      const avant = mu.fichier === 'App.jsx' ? require("./_source-app.cjs").sourceApp() : lire('api/_lib/' + mu.fichier);
      if (mu.fn(avant) === avant) appliquee = false;
      const Mm = await charger(mu);
      try { await verifier(Mm, (c) => { if (!c) rouges++; }); } catch (_) { rouges++; }
      fs.rmSync(Mm.dir, { recursive: true, force: true });
      const bon = appliquee && rouges > 0;
      if (!bon) ko++; else ok++;
      console.log(`${bon ? '✅' : '❌'} mutation « ${mu.nom} » ⇒ ${appliquee ? rouges + ' rouge(s)' : 'PAS APPLIQUÉE (le texte visé a changé)'}`);
    }
  }
  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
