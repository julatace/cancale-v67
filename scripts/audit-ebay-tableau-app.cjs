// AUDIT : eBay complet 2, côté APP (15 nov.) — les règles du tableau (src/ebay/tableau.js) et le
// CA eBay DATÉ AU VERSEMENT (ventesDeclarables, App.jsx → miroir api/_lib/ventes-regle.js).
// EXÉCUTE les vrais modules sur des données inventées. Usage :
//   node scripts/audit-ebay-tableau-app.cjs            (le dépôt)
//   node scripts/audit-ebay-tableau-app.cjs --prouve   (chaque mutation doit rougir)
// On exige :
//   C. une vente eBay dont eBay a dit le versement ARRIVÉ (`_versementEbay`) compte le mois du
//      versement ; sans date de versement, comme avant (le mois de la commande) ; une date mal
//      formée ne date rien ; le montant reste `montantRecuEbay` (jamais le total acheteur) ;
//      l'app pose la date par n° de commande, lue en projection (`d:data->dates`) ;
//   V. « versé ce mois » : versements ARRIVÉS ce mois à Paris, en euros ; en route à part ; une
//      autre devise jamais additionnée ; versements pas lus ⇒ null (jamais 0) ;
//   L. litiges : ceux qui attendent ta réponse d'abord ; rien lu ⇒ null ;
//   F. « À faire » : chaque chose avec sa section ; droit manquant ⇒ reconnecter ; signature ⇒ dite ;
//   D. dates de versement : une valeur qui n'est pas AAAA-MM-JJ est ignorée ;
//   S. santé : rien lu ⇒ null (pas « bon ») ; sous le standard ⇒ attention.
const path = require('path'), fs = require('fs'), os = require('os');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');

async function verifier(racine) {
  const out = []; let ko = 0;
  const dit = (c, m, d) => { out.push((c ? 'OK  ' : 'KO  ') + m + (c || !d ? '' : '  → ' + String(d).slice(0, 200))); if (!c) ko++; };
  let T, VR;
  try { T = await import(pathToFileURL(path.join(racine, 'src', 'ebay', 'tableau.js')).href + '?t=' + Math.random()); } catch (e) { dit(false, 'src/ebay/tableau.js se charge', e.message); return { ko, out }; }
  try { VR = await import(pathToFileURL(path.join(racine, 'api', '_lib', 'ventes-regle.js')).href + '?t=' + Math.random()); } catch (e) { dit(false, 'api/_lib/ventes-regle.js se charge', e.message); }

  // ── C. le CA eBay daté au versement
  if (VR) {
    const cmd = (id, creation, vers) => ({ orderId: id, orderPaymentStatus: 'PAID', creationDate: creation, ...(vers !== undefined ? { _versementEbay: vers } : {}), paymentSummary: { totalDueSeller: { value: '98.00', currency: 'EUR' } }, totalMarketplaceFee: { value: '12.60', currency: 'EUR' }, pricingSummary: { total: { value: '106.50', currency: 'EUR' } }, lineItems: [{ title: 'x' }] });
    const r = VR.ventesDeclarables({ ebay: [cmd('A', '2026-10-28T10:00:00Z', '2026-11-03'), cmd('B', '2026-10-28T10:00:00Z'), cmd('C', '2026-10-28T10:00:00Z', '3 nov')] });
    const l = Object.fromEntries((r.lignes || []).map((x) => [x.id, x]));
    dit(l['ebay:A'] && l['ebay:A'].ym === '2026-11' && l['ebay:A'].dateeAu === 'versement', 'C1. versée le 3 nov. (commande du 28 oct.) ⇒ comptée en NOVEMBRE, datée au versement', JSON.stringify(l['ebay:A'] && { ym: l['ebay:A'].ym, d: l['ebay:A'].dateeAu }));
    dit(l['ebay:B'] && l['ebay:B'].ym === '2026-10' && l['ebay:B'].dateeAu === 'commande', 'C2. sans date de versement : comme avant, le mois de la commande', JSON.stringify(l['ebay:B'] && l['ebay:B'].ym));
    dit(l['ebay:C'] && l['ebay:C'].ym === '2026-10', 'C3. une date de versement mal formée ne date rien', JSON.stringify(l['ebay:C'] && l['ebay:C'].ym));
    dit(l['ebay:A'] && l['ebay:A'].eur === 85.4, 'C4. le montant reste l’argent reçu (98,00 − 12,60), jamais le total acheteur port compris', String(l['ebay:A'] && l['ebay:A'].eur));
  }
  const app = (() => { try { return require(path.join(racine, 'scripts', '_source-app.cjs')).sourceApp(racine); } catch (_) { return fs.readFileSync(path.join(racine, 'src', 'App.jsx'), 'utf8'); } })();
  dit(/lireEbayParCompte\('ebay_versements', 'd:data->dates'/.test(app) && /_versementEbay: datesV\[o\.orderId\]/.test(app), 'C5. l’app lit SEULEMENT la carte des dates (projection, §4.4) et la pose par n° de commande');

  // ── V. versé ce mois
  const M = Date.parse('2026-11-15T09:00:00Z');
  const vs = [
    { id: 'P1', statut: 'SUCCEEDED', date: '2026-11-10T03:00:00Z', montant: { v: 145.4, c: 'EUR' } },
    { id: 'P0', statut: 'SUCCEEDED', date: '2026-10-31T22:30:00Z', montant: { v: 10, c: 'EUR' } },   // 31 oct. 23 h 30 à Paris : octobre
    { id: 'P3', statut: 'SUCCEEDED', date: '2026-10-31T23:30:00Z', montant: { v: 7, c: 'EUR' } },    // 1er nov. 0 h 30 à Paris : novembre
    { id: 'P2', statut: 'INITIATED', date: '2026-11-14T03:00:00Z', montant: { v: 50, c: 'EUR' } },
    { id: 'PG', statut: 'SUCCEEDED', date: '2026-11-09T03:00:00Z', montant: { v: 40, c: 'GBP' } },
    { id: 'PF', statut: 'TERMINAL_FAILED', date: '2026-11-08T03:00:00Z', montant: { v: 30, c: 'EUR' } },
  ];
  const v = T.verseMois(vs, M);
  dit(v && v.eur === 152.4 && v.n === 2, 'V1. versé en novembre : 145,40 + 7,00 (1er nov. 0 h 30 à Paris) ; ni octobre, ni raté', JSON.stringify(v));
  dit(v && v.enRoute.eur === 50 && v.autres.length === 1 && v.autres[0].c === 'GBP', 'V2. en route à part (50), la livre sterling jamais additionnée', JSON.stringify(v && [v.enRoute, v.autres]));
  dit(T.verseMois(null, M) === null && T.verseMois(undefined, M) === null, 'V3. versements pas lus ⇒ null (jamais 0)');
  const dv = T.derniersVersements(vs);
  dit(dv && dv.arrive.id === 'P1' && dv.enRoute.id === 'P2' && dv.echoue.length === 1, 'V4. dernier arrivé, en route, raté', JSON.stringify(dv && [dv.arrive.id, dv.enRoute.id]));

  // ── L. litiges
  const li = T.litigesOuverts({ paiement: [{ id: '1', etat: 'OPEN', repondreAvant: null }], reclamations: [{ id: '2', etat: 'WAITING_SELLER_RESPONSE', repondreAvant: '2026-11-20T00:00:00Z' }, { id: '3', etat: 'CLOSED' }], cas: { ko: { raison: 'scope' } } });
  dit(li && li.n === 2 && li.aToi === 1 && li.lignes[0].id === '2' && li.ko.join() === 'cas', 'L1. ouverts : 2 (le fermé écarté), celui qui attend TA réponse d’abord, les cas pas lus nommés', JSON.stringify(li && { n: li.n, a: li.aToi, p: li.lignes[0].id, ko: li.ko }));
  dit(T.litigesOuverts({ paiement: { ko: {} }, reclamations: { ko: {} }, cas: { ko: {} } }) === null && T.litigesOuverts(undefined) === null, 'L2. rien lu ⇒ null (jamais « aucun litige »)');

  // ── F. À faire
  const tab = { trafic: { ko: { raison: 'scope' } }, argent: { ko: { raison: 'signature' } }, sante: { niveau: { niveau: 'BELOW_STANDARD' }, aCorriger: [{ itemId: '1' }] }, litiges: { paiement: [{ id: '1', etat: 'ACTION_NEEDED' }], reclamations: [], cas: [] } };
  const af = T.aFaireEbay({ tableau: tab, aExpedier: 2 });
  const cles = af.map((x) => x.cle + ':' + (x.section || ''));
  dit(cles.join() === 'expedier:ventes,litiges:sante,corriger:sante,sante:sante,reconnecter:compte,signature:', 'F1. à expédier (Commandes), litige, annonce à corriger, niveau, reconnecter (droit), signature (dite, sans section)', cles.join());
  dit(T.aFaireEbay({ tableau: null, aExpedier: null }).length === 0, 'F2. rien su ⇒ rien inventé');

  // ── D. dates de versement
  const d = T.datesVersementEbay([{ ligne: { d: { '07-1': '2026-11-03', '07-2': '3 nov', 'x y': '2026-11-03' } } }, { ligne: undefined }, { ligne: null }]);
  dit(JSON.stringify(d) === '{"07-1":"2026-11-03"}', 'D1. seules les dates AAAA-MM-JJ d’un n° de commande valide', JSON.stringify(d));

  // ── S. santé
  dit(T.etatSante({ ko: {} }) === null && T.etatSante({ niveau: { ko: {} }, nonConforme: { ko: {} }, nonRecu: { ko: {} } }) === null, 'S1. rien lu ⇒ null (pas « bon »)');
  dit(T.etatSante({ niveau: { niveau: 'BELOW_STANDARD' } }) === 'attention' && T.etatSante({ niveau: { niveau: 'TOP_RATED' }, nonConforme: { note: 'VERY_HIGH' } }) === 'attention' && T.etatSante({ niveau: { niveau: 'TOP_RATED' }, nonConforme: { note: 'LOW' } }) === 'bon', 'S2. sous le standard ou réclamations très élevées ⇒ attention ; sinon bon');
  const tt = T.totauxTrafic({ annonces: [{ affichages: 10, vues: null, ventes: 0 }, { affichages: 5, vues: 2, ventes: 1 }] });
  dit(tt && tt.affichages === 15 && tt.vues === 2 && tt.partiel === true, 'S3. trafic : une vue pas sue rend le total « au moins »', JSON.stringify(tt));
  return { ko, out };
}

const MUTATIONS = {
  'verse-sans-statut': ['src/ebay/tableau.js', "    if (p.statut !== 'SUCCEEDED' || moisParisDe(p.date) !== ym) continue;", '    if (moisParisDe(p.date) !== ym) continue;'],
  'verse-utc': ['src/ebay/tableau.js', "const moisParisDe = (iso) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? moisParis(t) : moisDe(iso); };", 'const moisParisDe = (iso) => moisDe(iso);'],
  'mois-utc': ['src/ebay/tableau.js', 'export const moisParis = (maintenant = Date.now()) => moisParisApp(maintenant);', 'export const moisParis = (maintenant = Date.now()) => new Date(maintenant).toISOString().slice(0, 7);'],
  'devises-melangees': ['src/ebay/tableau.js', "    if (p.montant.c !== 'EUR') { autres[p.montant.c]", "    if (false) { autres[p.montant.c]"],
  'verse-pas-su-zero': ['src/ebay/tableau.js', '  if (!Array.isArray(versements)) return null;\n  const ym', "  if (!Array.isArray(versements)) return { eur: 0, n: 0, autres: [], enRoute: { eur: 0, n: 0 } };\n  const ym"],
  'litiges-rien-vaut-aucun': ['src/ebay/tableau.js', '  if (ko.length === 3) return null;', ''],
  'sante-rien-vaut-bon': ['src/ebay/tableau.js', "  if (niv === undefined && !notes.length) return null;", "  if (niv === undefined && !notes.length) return 'bon';"],
  'dates-libres': ['src/ebay/tableau.js', "&& /^\\d{4}-\\d{2}-\\d{2}$/.test(String(v))) out[id]", ') out[id]'],
  'ca-a-la-commande': ['api/_lib/ventes-regle.js', "const t = Number.isFinite(tVers) ? tVers : Date.parse(e.creationDate || '');", "const t = Date.parse(e.creationDate || '');"],
};
function copie(mut) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ebay-tab-app-'));
  for (const sous of ['api', 'src', 'scripts']) fs.cpSync(path.join(RACINE, sous), path.join(d, sous), { recursive: true, filter: (s) => !/node_modules|captures/.test(s) });
  try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(d, 'node_modules')); } catch (_) {}
  fs.copyFileSync(path.join(RACINE, 'package.json'), path.join(d, 'package.json'));
  const [f, a, b] = MUTATIONS[mut];
  const p = path.join(d, f), t = fs.readFileSync(p, 'utf8');
  if (!t.includes(a)) throw new Error(`ancre absente dans ${f}`);
  fs.writeFileSync(p, t.replace(a, b));
  return d;
}
(async () => {
  if (!process.argv.includes('--prouve')) {
    const { ko, out } = await verifier(RACINE);
    out.forEach((l) => console.log(l));
    console.log(`\n${out.length - ko} contrôle(s) OK, ${ko} en échec`);
    process.exit(ko ? 1 : 0);
  }
  let vertes = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let d; try { d = copie(m); } catch (e) { console.log(`KO  ${m} : ${e.message}`); vertes++; continue; }
    const { ko, out } = await verifier(d);
    console.log(`${ko ? 'OK ' : 'KO '} mutation « ${m} » : ${ko} rouge(s)${ko ? ' — ' + out.filter((l) => l.startsWith('KO')).map((l) => l.slice(4, 70)).slice(0, 2).join(' | ') : ''}`);
    if (!ko) vertes++;
  }
  console.log(`\n${Object.keys(MUTATIONS).length - vertes}/${Object.keys(MUTATIONS).length} mutations rougies`);
  process.exit(vertes ? 1 : 0);
})();
