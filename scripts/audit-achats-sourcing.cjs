#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — ACHATS : DÉLAI · LOTS RÉPARTIS (4 nov., src/achatsSourcing.js)
//        node scripts/audit-achats-sourcing.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// EXÉCUTE les règles (aucune lecture du texte pour juger) :
//   F. (5 nov.) plus aucun « fournisseur » tiré d'un vendeur Vinted : les
//      fournisseurs sont les personnes qu'IL crée (scripts/audit-fournisseurs.cjs) ;
//   D. délai réception → mise en ligne : date LUE (livraison 400 ou son clic),
//      sinon exclu et compté ; médiane par mois ; « Reçus, pas en ligne » ;
//   L. répartition d'un lot : rien sans `confirme: true`, somme au centime
//      (sinon « reste »), parts égales seulement PROPOSÉES, annulable ;
//   P. prixAchatPropose ne propose jamais le prix ENTIER d'un lot.
// --prouve : chaque mutation DOIT rougir.
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = path.join(__dirname, '..');
const MUTS = {
  'reception-devinee': ["  if (t2 != null) return { ms: t2, source: 'clic' };\n  return null;", "  if (t2 != null) return { ms: t2, source: 'clic' };\n  const t3 = msDe(achat && achat.date); return t3 != null ? { ms: t3, source: 'achat' } : null;"],
  'sans-date-silencieux': ["      if (!rec) exclus.sansReception++;", "      if (!rec) {}"],
  'enligne-pas-su-oui': ["    if (arts.some((x) => x && x.enLigne == null)) { pasSu++; continue; }", ''],
  'liste-sans-lecture': ["pasEnLigne: enLigneLu ? pasEnLigne : null", 'pasEnLigne'],
  'sans-clic': ["  if (confirme !== true) return null;", ''],
  'somme-fausse': ["  const juste = Number.isSafeInteger(total) && parts.length > 0 && illisibles === 0 && reste === 0;", "  const juste = Number.isSafeInteger(total) && parts.length > 0 && illisibles === 0 && Math.abs(reste) <= 100;"],
  'egal-impose': ["  const e = etatRepartition(total, saisies);\n  if (!e.juste) return null;", "  const e = etatRepartition(total, partsEgales(total, articles.length).map((c) => String(c / 100)));\n  if (!e.juste) return null;"],
  'annulation-perdue': ["  return Object.entries(journal.avant).map(([cle, x]) => ({ cle, patch: { buyPrice: x && x.buyPrice != null ? x.buyPrice : '', buyFromId: x ? x.buyFromId : null, buyFrom: x ? x.buyFrom : null } }));", "  return [];"],
  'port-sans-recu': ["    return v && v.trouve && v.somme === 'juste' && Number.isSafeInteger(v.paye) && v.paye > 0 ? v.paye : null;", "    return v && Number.isSafeInteger(v.paye) && v.paye > 0 ? v.paye : prixAchatCentimes(achat);"],
  'lot-prix-entier': ["  if (!lot && !prixSaisi && Number.isSafeInteger(montant) && montant > 0) patch.buyPrice = texteEur(montant);", "  if (!prixSaisi && Number.isSafeInteger(montant) && montant > 0) patch.buyPrice = texteEur(montant);"],
  'ecrase-prix-saisi': ["  if (!lot && !prixSaisi && Number.isSafeInteger(montant)", "  if (!lot && Number.isSafeInteger(montant)"],
};
const MUTS_PAP = {
  'propose-lot-entier': ["  if (typeof estLot === 'function' ? estLot(a) : (/^lot\\b/i.test(String(a.title || '').trim()) || a.lot === true)) return null;", ''],
};
const TOUTES = { ...MUTS, ...MUTS_PAP };
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(TOUTES)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(TOUTES).length} mutations attrapées`); process.exit(n === Object.keys(TOUTES).length ? 0 : 1);
}
let SRC = path.join(R, 'src');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'achsrc-'));
  fs.mkdirSync(path.join(d, 'src'));
  for (const f of ['achatsSourcing.js', 'prixAchatPropose.js', 'registres.js']) fs.copyFileSync(path.join(R, 'src', f), path.join(d, 'src', f));
  const f = path.join(d, 'src', MUTS[MUT] ? 'achatsSourcing.js' : 'prixAchatPropose.js');
  const [de, vers] = TOUTES[MUT]; const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(de)) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(f, s.replace(de, vers)); SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const url = (f) => require('url').pathToFileURL(path.join(SRC, f)).href;

(async () => {
  let S, P, RG;
  try { S = await import(url('achatsSourcing.js')); P = await import(url('prixAchatPropose.js')); RG = await import(url('registres.js')); }
  catch (e) { dit(false, 'src/achatsSourcing.js se charge', e.message); console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`); process.exit(1); }
  const J = 86400e3, T0 = Date.parse('2026-10-01T10:00:00Z');
  const ach = (tx, o = {}) => ({ transaction_id: tx, title: 'Adidas Spezial noir taille 42', date: new Date(T0).toISOString(), price: { amount: '30.0', currency_code: 'EUR' }, status: 'Commande finalisée', ...o });
  const cleNum = (n) => String(n == null ? '' : n).toUpperCase().replace(/\s+/g, '').replace(/^0+(?=\d)/, '');

  console.log('\n── F. Fournisseurs : plus aucune dérivation par vendeur Vinted (5 nov.)');
  // Julien : « c'est une personne à qui tu achètes en gros pas des vendeurs
  // particuliers sur vinted ». Les règles des fournisseurs vivent dans
  // src/fournisseurs.js (scripts/audit-fournisseurs.cjs) ; ici on vérifie que
  // l'ancienne dérivation n'est plus exportée.
  dit(!['fournisseurs', 'fournisseurVinted', 'fournisseurHors', 'trierFournisseurs'].some((k) => typeof S[k] === 'function'), 'F1 src/achatsSourcing.js n’exporte plus de fournisseur tiré des vendeurs Vinted');

  console.log('\n── D. Délai réception → mise en ligne');
  {
    const R1 = Date.parse('2026-10-03T08:00:00Z');
    const infosTx = { 3000001: { livSt: '400', livAt: '2026-10-03T08:00:00Z' }, 3000002: { livSt: '310', livAt: '2026-10-05T08:00:00Z' }, 3000006: { livSt: '400', livAt: '2026-11-02T08:00:00Z' } };
    const recuClic = { 3000002: '2026-10-06T09:00:00Z', 3000004: '2026-10-20T09:00:00Z' };
    const rec = (a) => S.dateReception(a, { infosTx, recuClic });
    dit(rec(ach(3000001)) && rec(ach(3000001)).ms === R1 && rec(ach(3000001)).source === 'livraison', 'D1 « Commande livrée » (400) dans SA transaction : date lue');
    dit(rec(ach(3000002)) && rec(ach(3000002)).source === 'clic', 'D2 en route (310) chez Vinted mais « Récupéré » touché par lui : son clic');
    dit(rec(ach(3000003)) === null, 'D3 aucune date lue ⇒ null (jamais la date de l’achat)');
    const arts = {
      3000001: [{ cle: 'f:a', misEnLigne: R1 + 3 * J + 3600e3, enLigne: true }],
      3000002: [{ cle: 'f:b', misEnLigne: Date.parse('2026-10-11T09:00:00Z'), enLigne: false, vendu: true }],
      3000003: [{ cle: 'f:c', misEnLigne: R1, enLigne: false }],                      // pas de réception lue
      3000004: [{ cle: 'f:d', misEnLigne: null, enLigne: false }],                    // pas de mise en ligne lue
      3000005: [],                                                                    // reçu (Vinted), jamais relié
      3000006: [{ cle: 'f:e', misEnLigne: Date.parse('2026-11-04T08:00:00Z'), enLigne: null }],
      3000007: [{ cle: 'f:f', misEnLigne: Date.parse('2026-09-01T08:00:00Z'), enLigne: true }],
    };
    const infos2 = { ...infosTx, 3000007: { livSt: '400', livAt: '2026-09-10T08:00:00Z' } };
    const achats = [3000001, 3000002, 3000003, 3000004, 3000005, 3000006, 3000007].map((t) => ach(t));
    const d = S.delaisMiseEnLigne({ achats, receptionDe: (a) => S.dateReception(a, { infosTx: infos2, recuClic }), estRecu: (a) => String(a.transaction_id) === '3000005', articlesDe: (tx) => arts[tx] || [], enLigneLu: true, maintenant: Date.parse('2026-11-04T10:00:00Z') });
    const oct = d.mois.find((m) => m.mois === '2026-10'), nov = d.mois.find((m) => m.mois === '2026-11');
    dit(oct && oct.n === 2 && oct.mediane === 4, 'D4 octobre : 3 j et 5 j ⇒ médiane 4 j sur 2', JSON.stringify(d.mois));
    dit(nov && nov.n === 1 && nov.mediane === 2 && d.n === 3, 'D5 novembre à part (mois de la réception)', JSON.stringify(d.mois));
    dit(d.exclus.sansReception === 1 && d.exclus.sansMiseEnLigne === 1 && d.exclus.avant === 1, 'D6 sans date de réception / sans mise en ligne / en ligne avant réception : exclus et comptés', JSON.stringify(d.exclus));
    const pe = (d.pasEnLigne || []).map((x) => x.tx);
    dit(pe.includes('3000004') && pe.includes('3000005') && !pe.includes('3000001') && !pe.includes('3000002') && !pe.includes('3000003'), 'D7 « Reçus, pas en ligne » : reçu sans article en ligne ni vendu, ou jamais relié', pe.join(','));
    dit(!pe.includes('3000006') && d.pasSu === 1, 'D8 un article à l’état « en ligne » pas su n’est pas dit « pas en ligne » (compté pas su)');
    const d2 = S.delaisMiseEnLigne({ achats, receptionDe: rec, articlesDe: (tx) => arts[tx] || [], enLigneLu: false });
    dit(d2.pasEnLigne === null, 'D9 annonces pas lues ⇒ la liste vaut null (pas su), jamais []');
    dit(S.mediane([5, 1, 3]) === 3 && S.mediane([]) === null, 'D10 médiane');
  }

  console.log('\n── L. Lots répartis à SA main');
  {
    const lot = ach(4000001, { title: 'Lot 5 paires Nike', price: { amount: '100', currency_code: 'EUR' } });
    dit(S.estLot(lot) && S.nombreLot(lot) === 5, 'L1 « Lot 5 … » : lot de 5');
    dit(S.estLot(ach(4000002), { nArticlesTx: { 4000002: 2 } }) && S.estLot(ach(4000003), { declares: { 4000003: 3 } }) && !S.estLot(ach(4000004)), 'L2 lot lu dans la transaction (items_count) ou déclaré par lui ; sinon non');
    dit(JSON.stringify(S.partsEgales(10000, 3)) === '[3334,3333,3333]' && S.partsEgales(10000, 3).reduce((a, b) => a + b) === 10000, 'L3 parts égales proposées, justes au centime');
    const articles = ['f:a', 'f:b', 'f:c', 'f:d', 'v:999'].map((cle, i) => ({ cle, numero: String(i + 1), entree: i === 0 ? { buyPrice: '18', buyFromId: '4000001' } : { buyFromId: '4000001' } }));
    const saisies = ['20', '20', '20', '20', '20'];
    dit(S.ecrituresRepartition({ achat: lot, articles, saisies }) === null, 'L4 aucune écriture sans SON clic (confirme)');
    const e1 = S.etatRepartition(10000, ['20', '20', '20', '20', '19,99']);
    dit(!e1.juste && e1.reste === 1, 'L5 99,99 € sur 100 € : « reste 0,01 € », pas juste', JSON.stringify(e1));
    dit(S.ecrituresRepartition({ achat: lot, articles, saisies: ['20', '20', '20', '20', '19,99'], confirme: true }) === null, 'L6 somme fausse ⇒ rien n’est enregistré, même confirmé');
    dit(S.ecrituresRepartition({ achat: lot, articles, saisies: ['20', '20', '20', '20', 'abc'], confirme: true }) === null && S.etatRepartition(10000, ['20', '', '20']).illisibles === 1, 'L7 case vide ou illisible ⇒ pas juste');
    const w = S.ecrituresRepartition({ achat: lot, articles, saisies: ['30', '25', '15', '10,5', '19,50'], confirme: true, at: '2026-11-04' });
    dit(w && w.ecritures.length === 5 && w.ecritures.map((x) => x.patch.buyPrice).join('|') === '30,00|25,00|15,00|10,50|19,50', 'L8 confirmé et juste : chaque N° reçoit SA part (pas une part égale imposée)', w && w.ecritures.map((x) => x.patch.buyPrice).join('|'));
    dit(w && w.ecritures.every((x) => x.patch.buyFromId === '4000001' && x.patch.buyFrom.lot === true && x.patch.buyFrom.prixLot === 100), 'L9 le lien vers l’achat est gardé, l’instantané dit « lot »');
    const somme = w ? w.ecritures.reduce((t, x) => t + S.centimesDe(x.patch.buyPrice), 0) : 0;
    dit(somme === 10000, 'L10 la somme des parts = le prix du lot, au centime');
    const u = S.annulationRepartition(w && w.journal);
    dit(u.length === 5 && u.find((x) => x.cle === 'f:a').patch.buyPrice === '18' && u.find((x) => x.cle === 'f:b').patch.buyPrice === '', 'L11 « Annuler » rend l’état d’avant de chaque N°', JSON.stringify(u.slice(0, 2)));
    const vent = { trouve: true, somme: 'juste', paye: 10870 };
    dit(S.totalARepartir(lot, 'paye', vent) === 10870 && S.totalARepartir(lot, 'paye', { trouve: true, somme: 'fausse', paye: 10870 }) === null && S.totalARepartir(lot, 'paye', null) === null, 'L12 port/frais inclus : seulement sur un reçu qui tombe juste');
    const wp = S.ecrituresRepartition({ achat: lot, articles: articles.slice(0, 2), saisies: ['54,35', '54,35'], inclus: 'paye', ventilation: vent, confirme: true });
    dit(wp && wp.journal.total === 10870 && wp.ecritures[0].patch.buyFrom.inclus === 'paye', 'L13 répartir le montant payé (108,70 €) quand il le choisit');
    // Relier depuis un achat : un lot ne reçoit jamais le prix entier ; un prix saisi n'est pas écrasé.
    const pl = S.ecritureLienAchat({}, lot, { lot: true, montant: 10000 });
    dit(pl && pl.buyPrice === undefined && pl.buyFromId === '4000001', 'L14 relier un N° à un LOT : le lien seul, jamais le prix du lot');
    const ps = S.ecritureLienAchat({ buyPrice: '12' }, ach(4000005), { montant: 3000 });
    dit(ps && ps.buyPrice === undefined, 'L15 un prix déjà saisi par lui n’est pas écrasé');
    const pn = S.ecritureLienAchat({}, ach(4000006), { montant: 3290 });
    dit(pn && pn.buyPrice === '32,90', 'L16 achat simple, prix vide : le montant proposé (son clic) est posé');
    // Le registre des achats (src/registres.js) lit la répartition par SA règle : une ligne, le lot une fois.
    const fichesR = Object.fromEntries(w.ecritures.filter((x) => x.cle.startsWith('f:')).map((x, i) => [x.cle.slice(2), { numero: String(i + 1), ...x.patch }]));
    const ov = w.ecritures.find((x) => x.cle.startsWith('v:'));
    const lotDate = { ...lot, date: '2026-10-01T10:00:00Z' };
    const reg = RG.registreDesAchats({ achats: [lotDate], fiches: { ...fichesR, z: { numero: '5', buyPrice: ov.patch.buyPrice, buyFromId: '4000001' } }, periode: '2026-10' });
    dit(reg && reg.lignes.length === 1 && reg.lignes[0].montant === 100 && reg.lignes[0].source === 'saisi', 'L17 registre des achats : le lot réparti = UNE ligne de 100 € (ses N° saisis), jamais 100 € × 5', JSON.stringify(reg && reg.lignes.map((l) => [l.montant, l.source, l.num])));
  }

  console.log('\n── P. prixAchatPropose : jamais le prix entier d’un lot');
  {
    const lotA = ach(5000001, { title: 'Lot 3 articles', price: { amount: '60', currency_code: 'EUR' } });
    dit(P.propositionPrixAchat({ identite: { achat: lotA, par: 'lien' } }) === null, 'P1 un article relié à un « Lot … » : aucune proposition (Répartir)');
    dit(P.propositionPrixAchat({ identite: { achat: ach(5000002), par: 'lien' }, estLot: (a) => String(a.transaction_id) === '5000002' }) === null, 'P2 lot lu dans la transaction / déclaré (estLot) : aucune proposition');
    const p = P.propositionPrixAchat({ identite: { achat: ach(5000003), par: 'lien' } });
    dit(p && p.centimes === 3000, 'P3 un achat simple garde sa proposition');
  }

  const src = fs.readFileSync(path.join(SRC, 'achatsSourcing.js'), 'utf8').replace(/\/\/.*$/gm, '');
  dit(!/fetch\(|localStorage|\bsave\(|setNumeros|setSaleOverride|\.title\s*===|titre\s*===/.test(src), 'A1 aucune écriture, aucune lecture réseau, aucune comparaison de titre dans src/achatsSourcing.js');

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
