// ════════════════════════════════════════════════════════════════════════════
//  LES TROIS RÈGLES DE L'APP DU 4 NOVEMBRE (5.319), EXÉCUTÉES
//   P · Porte-monnaie (src/porteMonnaie.js) — le solde LU de chaque compte, les
//       deux formes mesurées en base ({main,escrow} et {balance,pending_balance}),
//       « — » si jamais lu (jamais 0, jamais déduit des ventes), > 24 h ⇒ à
//       confirmer, un compte écarté NOMMÉ hors total, les virements (payout).
//   M · Masquées (src/annoncesMasquees.js) — par compte, lien Vinted, > 24 h ⇒
//       à confirmer, une déclarée partie n'y est pas.
//   O · Offres Vestiaire (src/offresVestiaire.js) — à trancher (pas expirées),
//       geste « prêt » seulement appris ET extension à jour, bornes de la
//       contre-offre, « fait » jamais dit sur un doute.
//   A · le branchement dans App.jsx (lu sans commentaires).
//  Données INVENTÉES (le dépôt est public). `--dir chemin` : une autre copie de
//  src/ (preuve sur le code d'avant). `--prouve` : mutations ⇒ rouge.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : d; };
const DIR = arg('--dir', path.join(__dirname, '..', 'src'));

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['soldeDeviné', 'porteMonnaie.js', "if (!p) return { uid, nom: c.nom || uid, dispo: null, attente: null,", "if (!p) return { uid, nom: c.nom || uid, dispo: 0, attente: 0,"],
    ['formeVersement', 'porteMonnaie.js', 'const dispo = montant(r.main) != null ? montant(r.main) : montant(r.balance);', 'const dispo = montant(r.main);'],
    ['attenteMelangee', 'porteMonnaie.js', 'const attente = montant(r.escrow) != null ? montant(r.escrow) : montant(r.pending);', 'const attente = montant(r.escrow) != null ? montant(r.escrow) : montant(r.balance);'],
    ['exclusComptes', 'porteMonnaie.js', 'const dedans = lignes.filter((l) => !l.exclu);', 'const dedans = lignes;'],
    ['vieuxJamais', 'porteMonnaie.js', 'vieux: !(p.at && maintenant - p.at <= PM_FRAIS_MS)', 'vieux: false'],
    ['virementsTous', 'porteMonnaie.js', "const estVirement = quoi === 'releve' ? l.quoi === 'payout' : l.entity_type === 'payout';", 'const estVirement = true;'],
    ['masqueeFraiche', 'annoncesMasquees.js', 'const aConfirmer = !(lu && maintenant - lu <= MASQUEE_FRAIS_MS);', 'const aConfirmer = false;'],
    ['masqueePartie', 'annoncesMasquees.js', '|| (parties && parties.has(id))', ''],
    ['offreExpiree', 'offresVestiaire.js', "d.par === 'acheteur' && !expiree) aTrancher.push(x);", "d.par === 'acheteur') aTrancher.push(x);"],
    ['gesteSansRecette', 'offresVestiaire.js', "return r.appris === true ? { etat: 'pret', raison: '' }", "return true ? { etat: 'pret', raison: '' }"],
    ['gesteVieilleExt', 'offresVestiaire.js', "if (cap !== 'ok') return", "if (false) return"],
    ['bornesContre', 'offresVestiaire.js', "if (offre && offre.offre != null && cents <= offre.offre) return { cents: null, erreur: 'Au-dessus de son offre.' };", ''],
    ['faitSurDoute', 'offresVestiaire.js', "if (r.accepte === true && r.etape === 'fait') return { ton: 'ok', texte: fait };", "if (r.accepte === true) return { ton: 'ok', texte: fait };"],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-aom-'));
  let tous = true;
  for (const [nom, f, avant, apres] of MUT) {
    const d = path.join(tmp, nom); fs.mkdirSync(d);
    for (const x of ['porteMonnaie.js', 'annoncesMasquees.js', 'offresVestiaire.js', 'App.jsx']) fs.copyFileSync(path.join(DIR, x), path.join(d, x));
    const txt = fs.readFileSync(path.join(d, f), 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    fs.writeFileSync(path.join(d, f), txt.replace(avant, apres));
    const r = spawnSync(process.execPath, [__filename, '--dir', d], { encoding: 'utf8', timeout: 120000 });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0;
    if (!ok) tous = false;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} rouge(s)${ok ? '' : ' — LA RÈGLE N’EST PAS PROTÉGÉE'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(tous ? '\n✅ chaque règle réaffaiblie fait rougir l’audit' : '\n❌ une mutation passe inaperçue');
  process.exit(tous ? 0 : 1);
}

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${ok || !det ? '' : ' — ' + String(det).slice(0, 300)}`); };
const charge = async (f) => { try { return await import(pathToFileURL(path.join(DIR, f)).href); } catch (e) { dit(false, `${f} se charge`, e.message); return {}; } };
const NOW = Date.parse('2026-11-04T12:00:00Z');
const h = (n) => new Date(NOW - n * 3600e3).toISOString();

(async () => {
  // ── P · le porte-monnaie ──────────────────────────────────────────────────
  const { porteMonnaieParCompte } = await charge('porteMonnaie.js');
  if (porteMonnaieParCompte) {
    const comptes = [{ uid: '101', nom: 'alpha' }, { uid: '202', nom: 'beta' }, { uid: '303', nom: 'gamma' }, { uid: '404', nom: 'delta' }];
    const billing = [
      { id: 'harvest_101_billing', cap: h(2), main: { amount: '12.5' }, escrow: { amount: '115.0' } },
      { id: 'harvest_202_billing', cap: h(30), balance: { amount: '38.0' }, pending: { amount: '107.0' }, lignes: [{ id: 9, entity_type: 'payout', amount: { amount: '-54.0' }, date: '2026-11-01T18:00:00Z', pending: true }, { id: 10, entity_type: 'transaction', amount: { amount: '80.0' }, date: '2026-11-02T18:00:00Z' }] },
      { id: 'harvest_404_billing', cap: h(1), main: { amount: '500.0' }, escrow: { amount: '0.0' } },
      { id: 'harvest_999_billing', cap: h(1), main: { amount: '57.23' }, escrow: { amount: '0' } },                // compte supprimé
      { id: 'harvest_303_billing', cap: h(1), minimum_price: { amount: '1' } },                                    // pas un porte-monnaie
    ];
    const releves = [{ id: 'harvest_101_releve_2026-10', lignes: [{ id: '7', quoi: 'payout', montant: -108, date: '2026-10-13T14:09:31Z' }, { id: '8', quoi: 'transaction', montant: 40, date: '2026-10-12T10:00:00Z' }] }];
    const pm = porteMonnaieParCompte({ billing, releves, comptes, ecarte: (u) => u === '404', maintenant: NOW });
    const L = Object.fromEntries((pm.lignes || []).map((l) => [l.uid, l]));
    dit(pm.etat === 'lu' && L['101'].dispo === 12.5 && L['101'].attente === 115, 'P1 · forme porte-monnaie `{main, escrow}` : disponible = main, en attente = escrow', JSON.stringify(L['101']));
    dit(L['202'] && L['202'].dispo === 38 && L['202'].attente === 107, 'P1 · forme versement `{balance, pending_balance}` : disponible = balance, en attente = pending (jamais mélangés)', JSON.stringify(L['202']));
    dit(L['303'] && L['303'].jamais === true && L['303'].dispo === null && L['303'].attente === null, 'P2 · un compte jamais lu (ou une réponse qui n’est pas un porte-monnaie) ⇒ « — », jamais 0', JSON.stringify(L['303']));
    dit(!pm.lignes.some((l) => l.uid === '999'), 'P2 · un compte supprimé n’apparaît pas (son argent n’est plus chez toi)', JSON.stringify(pm.lignes.map((l) => l.uid)));
    dit(L['202'].vieux === true && L['101'].vieux === false, 'P3 · une lecture de plus de 24 h ⇒ « à confirmer »', JSON.stringify([L['202'].vieux, L['101'].vieux]));
    dit(pm.total.dispo === 50.5 && pm.total.attente === 222 && pm.total.lus === 2 && pm.total.sur === 3, 'P4 · le total : les comptes sélectionnés LUS seulement (12,50 + 38 ; 115 + 107)', JSON.stringify(pm.total));
    dit(JSON.stringify(pm.total.manque) === '["gamma"]' && JSON.stringify(pm.total.exclus) === '["delta"]' && JSON.stringify(pm.total.vieux) === '["beta"]', 'P4 · le manque NOMMÉ (gamma jamais lu), l’écarté NOMMÉ hors total (delta), le vieux nommé', JSON.stringify(pm.total));
    dit(pm.virements.length === 2 && pm.virements[0].montant === 54 && pm.virements[0].enCours === true && pm.virements[0].nom === 'beta' && pm.virements[1].montant === 108 && pm.virements[1].nom === 'alpha', 'P5 · les virements vers la banque (relevé + mois courant), seulement `payout`, du plus récent au plus ancien', JSON.stringify(pm.virements));
    dit(porteMonnaieParCompte({ billing: null, comptes }).etat === 'passu' && porteMonnaieParCompte({ billing: undefined, comptes }).etat === 'encours', 'P6 · lecture ratée ⇒ « pas su » ; en cours ⇒ en cours (trois états)');
    const vide = porteMonnaieParCompte({ billing: [], releves: [], comptes, maintenant: NOW });
    dit(vide.total.dispo === null && vide.total.attente === null, 'P6 · aucun porte-monnaie lu ⇒ total « — », jamais 0 €', JSON.stringify(vide.total));
  }
  // ── M · les masquées ──────────────────────────────────────────────────────
  const { masqueesParCompte } = await charge('annoncesMasquees.js');
  if (masqueesParCompte) {
    const A = { vinted_user_id: '101', login: 'alpha', domain: 'www.vinted.fr' }, B = { vinted_user_id: '202', login: 'beta' };
    const mq = [
      { id: 501, title: 'Nike Dunk', photo: 'p1', price: { amount: '80.0' }, _acc: A, _vrmVueMasqueeLe: NOW - 2 * 3600e3 },
      { id: 502, title: 'Air Max', _acc: A, _vrmVueMasqueeLe: NOW - 2 * 3600e3 },
      { id: 503, title: 'Samba', _acc: B, _vrmVueMasqueeLe: NOW - 30 * 3600e3 },
      { id: 504, title: 'Partie', _acc: B, _vrmVueMasqueeLe: NOW - 1 * 3600e3 },
      { id: 501, title: 'Nike Dunk (doublon)', _acc: A, _vrmVueMasqueeLe: NOW },
    ];
    const r = masqueesParCompte(mq, { maintenant: NOW, numeroDe: (id) => (id === '501' ? '12' : ''), parties: new Set(['504']) });
    const gA = r.groupes && r.groupes.find((g) => g.uid === '101'), gB = r.groupes && r.groupes.find((g) => g.uid === '202');
    dit(r.etat === 'lu' && r.n === 3 && gA && gA.items.length === 2 && gB && gB.items.length === 1, 'M1 · par compte, chaque annonce une fois, une déclarée partie n’y est pas', JSON.stringify(r.groupes && r.groupes.map((g) => [g.uid, g.items.map((x) => x.id)])));
    dit(gA && gA.items[0].lien === 'https://www.vinted.fr/items/501/edit' && gA.items[0].num === '12' && gA.items[0].prix === 80, 'M2 · le lien pour corriger sur Vinted, le N°, le prix', JSON.stringify(gA && gA.items[0]));
    dit(gB && gB.aConfirmer === true && gB.items[0].aConfirmer === true && gA.aConfirmer === false && r.nAConfirmer === 1 && r.nFrais === 2, 'M3 · une lecture de plus de 24 h ⇒ « à confirmer »', JSON.stringify({ a: gA && gA.aConfirmer, b: gB && gB.aConfirmer, n: r.nAConfirmer }));
    const sansLu = masqueesParCompte([{ id: 9, _acc: A }], { maintenant: NOW });
    dit(sansLu.nAConfirmer === 1, 'M3 · sans date de lecture ⇒ « à confirmer » (pas su ≠ frais)', JSON.stringify(sansLu));
    dit(masqueesParCompte(null).etat === 'passu' && masqueesParCompte(undefined).etat === 'encours', 'M4 · trois états');
  }
  // ── O · les offres Vestiaire ──────────────────────────────────────────────
  const O = await charge('offresVestiaire.js');
  if (O.offresVestiaire) {
    const of = (id, o) => Object.assign({ id, produit: '6000' + id.slice(-1), ouverte: true, aToi: true, offre: 20000, initial: 24900, net: 16000, expire: '2026-11-05T00:00:00Z', dernier: { action: 'offer', par: 'acheteur', cents: 20000, at: '2026-11-04T08:00:00Z' } }, o || {});
    const ligne = { offres: { n1001: of('1001'), n1002: of('1002', { expire: '2026-11-04T11:00:00Z' }), n1003: of('1003', { aToi: false, dernier: { action: 'offer', par: 'vendeur', cents: 23000, at: '2026-11-04T09:00:00Z' } }), n1004: of('1004', { ouverte: false, aToi: false, dernier: { action: 'accept', par: 'vendeur', at: '2026-11-01T00:00:00Z' } }) }, capturedAt: h(1) };
    const e = O.offresVestiaire(ligne, NOW);
    dit(e.etat === 'lu' && e.aTrancher.map((x) => x.id).join() === '1001' && e.enAttente.map((x) => x.id).join() === '1003', 'O1 · à trancher : ouverte, dernier geste de l’acheteur, PAS expirée ; ta contre-offre en attente à part', JSON.stringify([e.aTrancher.map((x) => x.id), e.enAttente.map((x) => x.id)]));
    dit(e.parProduit['60001'] && e.parProduit['60001'].id === '1001', 'O1 · l’offre se retrouve par l’ARTICLE (identité Vestiaire), pour la carte de la conversation');
    dit(O.offresVestiaire(null).etat === 'passu' && O.offresVestiaire(undefined).etat === 'encours' && O.offresVestiaire({}).etat === 'jamais', 'O2 · trois états (et « jamais lues »)');
    const rec = { accepter: { appris: true }, refuser: { appris: false, raison: 'valeur-inconnue' } };
    dit(O.etatGeste(rec, 'accepter', 'ok').etat === 'pret' && O.etatGeste(rec, 'refuser', 'ok').etat === 'pas-sur' && O.etatGeste(rec, 'contre', 'ok').etat === 'pas-appris', 'O3 · un geste est prêt seulement s’il est APPRIS (pas sûr, pas appris sinon)');
    dit(O.etatGeste(rec, 'accepter', 'retard').etat === 'ext-retard' && O.etatGeste(rec, 'accepter', 'absente').etat === 'ext-absente', 'O3 · une extension d’avant la 5.319 (ou absente) ne propose aucun geste');
    const x = { offre: 20000, initial: 24900 };
    dit(O.prixContre('225', x).cents === 22500 && O.prixContre('225,5', x).cents === 22550 && O.prixContre('200', x).cents === null && O.prixContre('249', x).cents === null && O.prixContre('abc', x).cents === null, 'O4 · la contre-offre : au-dessus de SON offre, sous ton prix, en euros');
    dit(O.etiquetteOffre({ accepte: true, etape: 'incertain', raison: 'je ne sais pas' }, 'accepter').ton === 'muet' && O.etiquetteOffre(null, 'accepter').ton === 'muet' && O.etiquetteOffre({ accepte: true, etape: 'fait' }, 'accepter').ton === 'ok' && O.etiquetteOffre({ accepte: false, raison: 'rien' }, 'contre').ton === 'ko', 'O5 · « fait » seulement sur « fait » ; un doute est dit comme un doute');
  }
  // ── A · le branchement ────────────────────────────────────────────────────
  const APP = require("./_source-app.cjs").sourceAppDe(path.join(DIR, 'App.jsx')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  dit(/<OffresVestiaire etat=\{offresEtat\} recettes=\{d\.recettesOffres\} cap=\{extSait\('vcoffrerepondre'\)\}/.test(APP) && /id=eq\.vc_offres&select=offres:data->offres/.test(APP), 'A1 · Messages · Vestiaire lit `vc_offres` (projeté) et montre les offres, gestes jugés par `vcoffrerepondre`');
  dit(/data-vc-conv-offre=/.test(APP), 'A1 · la conversation d’un article qui a une offre à trancher la montre');
  dit(/<PorteMonnaieCompta accounts=\{accounts\} panelOff=\{panelOff\}\/>/.test(APP) && /id=like\.harvest_\*_billing&select=id,cap:data->>capturedAt,main:/.test(APP) && !/harvest_\*_billing&select=data\b/.test(APP), 'A2 · Compta → Porte-monnaie, lectures projetées (jamais `select=data`)');
  dit(/annSort==='masquees' \? \(\s*<AnnoncesMasquees/.test(APP) && /setAnnSort\('masquees'\)/.test(APP), 'A3 · Annonces → « Masquées » (vue rapide) ouvre la liste par compte');
  dit(/masqueesSurEtagere = useMemo\(\(\) => masqueesPresentes\(listings\.masquees/.test(APP) && /\.\.\.masqueesSurEtagere\]\)/.test(APP), 'A3 · la règle « en ligne » ne change pas : une masquée reste parmi les PRÉSENTES');
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ porte-monnaie, masquées, offres (règles de l’app) : tout est vert');
  process.exit(ko ? 1 : 0);
})();
