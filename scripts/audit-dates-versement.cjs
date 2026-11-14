// ════════════════════════════════════════════════════════════════════════════
//  LES VENTES SANS DATE DE VERSEMENT — CE QUI EST DATÉ, POURQUOI LE RESTE NE
//  L'EST PAS, ET LE GESTE (11 nov., lot DJ7 — docs/passation/2026-11-11-dates-versement.md)
//
//  Julien : « Compta : 1756 ventes sans date de versement ». MESURÉ (lecture
//  seule) : presque toutes d'un seul compte dont le détail de transaction n'a
//  jamais été relu ; aucun relevé de porte-monnaie rangé ne porte de vente.
//  On EXÉCUTE les vrais modules (src/versementReleve.js, src/versementRaisons.js) :
//   1. 50 ventes au MÊME montant le MÊME jour, un relevé aux mêmes montants et
//      jours : seule la ligne qui porte le n° d'une vente la date (identité) ;
//      le relevé dit LESQUELLES il a datées (`versementsParReleve`) ;
//   2. les ventes à dater sont rangées par RAISON, prouvée par la base : détail
//      jamais relu (par compte), relu mais pas finalisé, pas su, Leboncoin… ;
//   3. « datées » compte les lignes à date lue, dont celles du relevé ;
//   4. le câblage : Ventes PUBLIE raisons et datées, « Déclarer » les LIT et
//      propose le geste (Ouvrir Vinted, Dater à la main) — jamais une date devinée.
//  Données inventées. Usage : node scripts/audit-dates-versement.cjs
//  (VRM_RACINE=<dossier> : juger un autre arbre, pour les mutations.)
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const RACINE = process.env.VRM_RACINE ? path.resolve(process.env.VRM_RACINE) : path.join(__dirname, '..');

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const sans = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');
const lire = (f) => { try { return fs.readFileSync(path.join(RACINE, f), 'utf8'); } catch (_) { return ''; } };

(async () => {
  let R = {}, A = {};
  try { R = await import(pathToFileURL(path.join(RACINE, 'src', 'versementReleve.js')).href); } catch (e) { dit(false, 'src/versementReleve.js se charge', e.message); }
  try { A = await import(pathToFileURL(path.join(RACINE, 'src', 'versementRaisons.js')).href); } catch (e) { dit(false, 'src/versementRaisons.js se charge', e.message); }
  const { versementsDuReleve, completerVersementsParReleve, versementsParReleve } = R;
  const { raisonsADater, venteDatees } = A;

  console.log('── 1. 50 ventes identiques : seule l’identité date');
  try {
    const JOUR = '2026-10-14T09:00:00Z';
    const ventes = Array.from({ length: 50 }, (_, i) => ({ transaction_id: 9300000 + i, price: { amount: '45.0' }, date: '2026-10-07T10:00:00Z', status: 'Commande finalisée', _acc: { vinted_user_id: 222 } }));
    // Le relevé : 50 crédits de 45 € le même jour ; UN seul porte le n° d'une vente (la n° 7).
    const lignes = Array.from({ length: 50 }, (_, i) => ({ id: String(800 + i), date: JOUR, montant: 45, devise: 'EUR', type: 'credit', quoi: 'transaction', ref: String(700000 + i) }));
    lignes[7] = { ...lignes[7], tx: '9300007', ref: '9300007' };
    const mR = versementsDuReleve([{ id: 'harvest_222_releve_2026-10', l: lignes }]);
    dit(mR && Object.keys(mR).length === 1 && mR['9300007'] === JOUR, 'même montant, même jour : seule la ligne qui porte SON n° date la vente', JSON.stringify(mR));
    const m450 = { '9300001': '2026-10-12T08:00:00Z' };
    const m = completerVersementsParReleve(m450, mR);
    dit(m && m['9300001'] === '2026-10-12T08:00:00Z' && m['9300007'] === JOUR && Object.keys(m).length === 2, 'la transaction 450 date la sienne, le relevé complète l’autre, rien d’autre', JSON.stringify(m));
    const pr = typeof versementsParReleve === 'function' ? versementsParReleve(m) : null;
    dit(pr instanceof Set && pr.size === 1 && pr.has('9300007'), 'le relevé dit LESQUELLES il a datées (une seule ici)', pr ? JSON.stringify([...pr]) : 'absent');
    dit(JSON.stringify(Object.keys(m).sort()) === '["9300001","9300007"]', 'la carte tx → date ne montre rien de plus à ses lecteurs (propriété non énumérable)', JSON.stringify(Object.keys(m)));
    dit(typeof versementsParReleve === 'function' && versementsParReleve(m450).size === 0 && versementsParReleve(null).size === 0, 'sans relevé : aucune vente « datée par le porte-monnaie »');

    console.log('── 2. Les raisons, prouvées par la base');
    // Les lignes « à dater » telles que `ventesDeclarables` les rend (Vinted porte `o`).
    const aDater = ventes.filter((o) => !m[String(o.transaction_id)]).map((o) => ({ id: 'vinted:' + o.transaction_id, plateforme: 'Vinted', eur: 45, o }));
    aDater.push({ id: 'vinted:9400001', plateforme: 'Vinted', eur: 20, o: { transaction_id: 9400001, _acc: { vinted_user_id: 333 } } });
    aDater.push({ id: 'lbc:1', plateforme: 'Leboncoin', eur: 30 });
    aDater.push({ id: 'lbc:2', plateforme: 'Leboncoin', eur: 31 });
    // L'état des transactions RANGÉES : 9300010 relue (en cours, 400), 9300011 jamais rangée…
    const etats = new Map([['9300010', { s: 400 }], ['9300020', { s: 430 }]]);
    const rs = raisonsADater(aDater, { etat: (tx) => (etats.has(tx) ? etats.get(tx) : null), compteDe: (o) => ({ uid: String(o._acc.vinted_user_id), nom: 'compte_' + o._acc.vinted_user_id }) });
    const par = Object.fromEntries((rs || []).map((r) => [r.cle, r]));
    dit(par['vinted-detail'] && par['vinted-detail'].n === 47, '47 ventes : détail de la transaction jamais relu', JSON.stringify(par['vinted-detail'] && par['vinted-detail'].n));
    const cps = (par['vinted-detail'] && par['vinted-detail'].comptes) || [];
    dit(cps.length === 2 && cps[0].uid === '222' && cps[0].n === 46 && cps[0].nom === 'compte_222' && cps[1].uid === '333' && cps[1].n === 1, 'groupées PAR COMPTE (le geste se fait sur ce compte)', JSON.stringify(cps));
    dit(par['vinted-attente'] && par['vinted-attente'].n === 2, '2 ventes : relues, Vinted ne les dit pas finalisées', JSON.stringify(par['vinted-attente']));
    dit(par.leboncoin && par.leboncoin.n === 2 && par.leboncoin.ca === 61, 'Leboncoin : 2 ventes, 61 €', JSON.stringify(par.leboncoin));
    const total = (rs || []).reduce((t, r) => t + r.n, 0);
    dit(total === aDater.length, 'chaque vente à dater a UNE raison (aucune perdue, aucune comptée deux fois)', `${total} / ${aDater.length}`);
    const passu = raisonsADater(aDater.slice(0, 3), { etat: () => undefined, compteDe: () => null });
    dit(passu.length === 1 && passu[0].cle === 'vinted-passu' && passu[0].n === 3, 'états des transactions pas lus ⇒ « pas su », jamais « jamais relue »', JSON.stringify(passu));

    console.log('── 3. Datées');
    const lignesDatees = ['9300001', '9300007'].map((tx) => ({ plateforme: 'Vinted', ts: Date.parse(m[tx]), o: { transaction_id: Number(tx) } }));
    lignesDatees.push({ plateforme: 'Vinted', ts: null, declaree: true, o: { transaction_id: 1 } });
    lignesDatees.push({ plateforme: 'Leboncoin', ts: Date.parse('2026-10-01') });
    const d = venteDatees(lignesDatees, pr);
    dit(d && d.n === 3 && d.releve === 1, '3 lignes à date lue (une déclarée sans date n’en est pas), dont 1 par le relevé', JSON.stringify(d));
  } catch (e) { dit(false, 'règles exécutées', e && e.message); }

  console.log('── 4. Le câblage');
  const app = sans(lire('src/App.jsx'));
  dit(/ad\.raisons = raisonsADater\(aDater, \{ etat: \(tx\) => etatTxn\(tx\)/.test(app), 'Ventes PUBLIE les raisons (`vinted_urssaf_mois.aDater.raisons`), d’après l’état RANGÉ des transactions');
  dit(/ad\.datees = venteDatees\(lignes, versementsParReleve\(versements\)(?:, sourcesDeVersement\(versements\))?\)/.test(app), 'Ventes PUBLIE les datées, dont par le relevé');
  const compta = sans(lire('src/ecrans/Compta.jsx'));
  const i = compta.indexOf('function ADaterRaisons('), j = compta.indexOf('function PrevisionUrssafCarte(');
  const comp = i > 0 && j > i ? compta.slice(i, j) : '';
  const carte = j > 0 ? compta.slice(j, compta.indexOf('function ComptaFusion(', j)) : '';
  dit(/<ADaterRaisons ad=\{ligne\.aDater\}/.test(carte), '« Déclarer » LIT la ligne publiée (aucun second calcul)');
  dit(/data-adater-geste="vinted"/.test(comp) && /href="https:\/\/www\.vinted\.fr\/"/.test(comp), 'détail pas relu ⇒ « Ouvrir Vinted », par compte');
  dit(/data-adater-geste="main"[^>]*onClick=\{onDater\}/.test(comp), 'Leboncoin ⇒ « Dater à la main » (SON clic)');
  dit(/data-adater-datees=/.test(comp) && /data-adater-sans=/.test(comp), 'la carte dit « N datées ✓ · M sans date »');
  dit(!/encaiss/i.test(comp) && !/Date\.now|new Date\(/.test(comp), 'jamais « encaissé », aucune date fabriquée à l’écran');

  console.log(`\n${ko ? `❌ ${ko} échec(s)` : '✅ tout est vert'} · ${ok} ✅`);
  process.exit(ko ? 1 : 0);
})();
