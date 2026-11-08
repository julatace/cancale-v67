// ════════════════════════════════════════════════════════════════════════════
//  DATER UNE VENTE PAR LE RELEVÉ DU PORTE-MONNAIE — PAR SON IDENTITÉ SEULEMENT
//  (extension 5.323 + src/versementReleve.js, 6 nov.)
//
//  MESURÉ (lecture seule, sa base, 6 nov.) : aucune ligne `harvest_*_releve_*`,
//  aucun compteur `releve_*` — `storeReleve` n'avait jamais rien écrit.
//  `GET /api/v2/users/{id}/payouts` (la moisson) répond 404 sur ses comptes ;
//  la page « Porte-monnaie » charge `GET /api/v2/wallet/invoices/current` (200),
//  dont la forme n'a jamais été vue. 1 777 ventes (80 891 €) restent « à dater ».
//
//  On EXÉCUTE le vrai `background.js` (`_fond-vm.cjs`) et le vrai module de l'app :
//   1. la moisson lit `wallet/invoices/current` (plus `payouts`, mort) ; des
//      mouvements un niveau plus bas sont TROUVÉS et rangés ; une ligne qui
//      porte un n° de transaction le garde (`tx`), RIEN de personnel (ni
//      libellé, ni bout d'IBAN) ;
//   2. une réponse du porte-monnaie de forme INCONNUE n'écrit aucun relevé, et
//      sa FORME (noms de clés + types, jamais une valeur) est rangée à part ;
//   3. l'app ne date une vente que par une ligne qui porte SON n° : jamais par
//      un montant et une date qui se ressemblent ; ni attente, ni virement, ni
//      autre devise ; deux jours pour la même vente ⇒ pas su ; la transaction
//      450 garde la main ; relevé illisible ⇒ les dates 450 restent.
//  Données inventées. Usage : node scripts/audit-versement-releve.cjs [--src f]
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const path = require('path');
const { pathToFileURL } = require('url');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const SRC = cheminSource();

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

const UID = '111';
// Une réponse INVENTÉE où les mouvements vivent un niveau plus bas (`invoice`).
const NICHE = {
  invoice: {
    starting_date: '2026-11-01', invoice_lines_has_more: false,
    invoice_lines: [
      { id: 501, date: '2026-11-04T10:00:00Z', type: 'debit', title: 'Vente : Paire de Camille', subtitle: 'acheteur camille_45', amount: { amount: '42.5', currency_code: 'EUR' }, entity_type: 'transaction', entity_id: 9100001 },
      { id: 502, date: '2026-11-05T11:00:00Z', type: 'debit', title: 'Vente', amount: { amount: '30.0', currency_code: 'EUR' }, transaction_id: 9100002 },
      { id: 503, date: '2026-11-05T12:00:00Z', type: 'credit', title: 'Transfert vers le compte bancaire', subtitle: 'FR76 **** 2316', amount: { amount: '-54.0', currency_code: 'EUR' }, entity_type: 'payout', entity_id: 850705781 },
    ],
  },
  balance: { amount: '12.0', currency_code: 'EUR' },
};

(async () => {
  console.log('── 1. La moisson lit le relevé de la page « Porte-monnaie »');
  await essaie('moisson', async () => {
    const f = faireFond({ src: SRC, vinted: (q) => (/\/wallet\/invoices\/current/.test(q.chemin) ? { status: 200, body: NICHE } : /\/users\/current/.test(q.chemin) ? { status: 200, body: { user: { id: 3166370055 } } } : { status: 404, body: {} }) });
    await f.ctx.runActive();
    const chemins = f.j.vinted.map((q) => q.chemin);
    dit(chemins.some((c) => /\/api\/v2\/wallet\/invoices\/current$/.test(c)), 'la moisson lit `wallet/invoices/current` (ce que la page charge)', chemins.join(' · ').slice(0, 300));
    dit(!chemins.some((c) => /\/payouts/.test(c)), 'et plus `users/{id}/payouts` (404 mesuré) — pas une requête de plus', '');
    const id = Object.keys(f.lignes).find((k) => /^harvest_111_releve_/.test(k));
    const d = id && f.lignes[id];
    dit(id === 'harvest_111_releve_2026-11', 'des mouvements un niveau plus bas sont TROUVÉS et rangés (une ligne par mois)', String(id));
    const l = (d && d.lignes) || [];
    const v1 = l.find((x) => x.id === '501'), v2 = l.find((x) => x.id === '502'), vir = l.find((x) => x.id === '503');
    dit(v1 && v1.tx === '9100001' && v2 && v2.tx === '9100002', 'une ligne qui porte le n° de sa transaction le GARDE (`tx`) — nature « transaction » ou clé `transaction_id`', JSON.stringify([v1 && v1.tx, v2 && v2.tx]));
    dit(vir && vir.tx === undefined && vir.quoi === 'payout', 'un virement vers sa banque n’a pas de `tx`', JSON.stringify(vir));
    const texte = JSON.stringify(d || {});
    dit(!/camille|2316|Transfert|Vente/i.test(texte), 'RIEN de personnel : ni libellé, ni pseudo, ni bout d’IBAN', texte.slice(0, 200));
    dit(d && d.nTx === 2 && Array.isArray(d.formeLignes) && d.formeLignes.includes('transaction_id:number') && !d.formeLignes.some((c) => /camille|42\.5/i.test(c)), 'la FORME des mouvements est notée (noms + types, jamais une valeur)', JSON.stringify(d && d.formeLignes).slice(0, 200));
  });

  console.log('── 2. Une forme INCONNUE n’écrit aucun relevé, et le dit');
  await essaie('forme inconnue', async () => {
    const f = faireFond({ src: SRC });
    const inconnu = { wallet: { mouvements: [{ montant: 42.5, quand: '2026-11-04', qui: 'camille_45' }] }, total: 3 };
    await f.ctx.storeHarvest('www.vinted.fr', 'billing', null, JSON.stringify(inconnu), 'https://www.vinted.fr/api/v2/wallet/invoices/current');
    dit(!Object.keys(f.lignes).some((k) => /_releve_/.test(k)), 'aucun relevé écrit (on ne devine pas où vit le montant)', Object.keys(f.lignes).join(','));
    dit(f.j.diags.includes('releve_forme_inconnue'), 'c’est DIT (`releve_forme_inconnue`)');
    const fo = f.lignes.harvest_111_forme_releve;
    dit(!!fo && fo.chemin === '/api/v2/wallet/invoices/current' && Array.isArray(fo.forme) && fo.forme.includes('wallet.mouvements[]:liste') && fo.forme.includes('wallet.mouvements[0].qui:string'), 'sa FORME est rangée à part (chemin + noms de clés + types)', JSON.stringify(fo));
    dit(fo && !/camille|42\.5|2026-11-04/.test(JSON.stringify(fo)), 'sans aucune valeur', '');
    await f.ctx.storeHarvest('www.vinted.fr', 'billing', null, JSON.stringify({ main: { amount: '10' }, escrow: { amount: '5' } }), 'https://www.vinted.fr/api/v2/users/12/balance');
    dit(f.j.diags.filter((x) => x === 'releve_forme_inconnue').length === 1, 'un solde ordinaire (pas une page de relevé) n’est pas une « forme inconnue »', '');
  });

  console.log('── 3. L’app : le relevé date une vente par SON identité, et seulement elle');
  await essaie('règle app', async () => {
    const { versementsDuReleve, completerVersementsParReleve } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'versementReleve.js')).href);
    const L = (o) => Object.assign({ montant: 42.5, date: '2026-11-04T10:00:00Z' }, o);
    const m = versementsDuReleve([{ id: 'harvest_1_releve_2026-11', l: [
      L({ tx: '9100001' }),
      L({ ref: '9100003', quoi: 'Something' }),                     // pas de tx : jamais rapproché
      L({ tx: '9100004', attente: true }),                          // pas encore versé
      L({ tx: '9100005', quoi: 'payout' }),                         // virement vers sa banque
      L({ tx: '9100006', montant: -10 }),                           // un débit
      L({ tx: '9100007', devise: 'GBP' }),                          // autre devise : écartée, jamais convertie
      L({ tx: '9100008', date: '2026-11-04T10:00:00Z' }), L({ tx: '9100008', date: '2026-11-07T10:00:00Z' }),   // deux jours : pas su
      L({ tx: '9100009', date: '' }),
    ] }]);
    dit(m && m['9100001'] === '2026-11-04T10:00:00Z', 'une ligne qui porte le n° de la vente la date', JSON.stringify(m));
    dit(m && !('9100003' in m) && Object.keys(m).length === 1, 'rien d’autre : ni sans identité, ni en attente, ni virement, ni débit, ni autre devise, ni deux jours, ni sans date', JSON.stringify(Object.keys(m || {})));
    // Une vente sans `tx` mais au même montant et au même jour qu'un mouvement : JAMAIS datée.
    const ventes = [{ transaction_id: 9200001, price: { amount: '42.5' }, date: '2026-11-04T09:00:00Z' }];
    const m2 = versementsDuReleve([{ l: [L({ ref: '777' })] }]);
    dit(m2 && !Object.keys(m2).length && !(String(ventes[0].transaction_id) in m2), 'même montant, même jour, sans son n° : la vente reste « à dater » (jamais par ressemblance)', JSON.stringify(m2));
    dit(versementsDuReleve(null) === null, 'relevé illisible ⇒ `null` (pas su), jamais `{}`');
    const c = completerVersementsParReleve({ '9100001': '2026-10-30T08:00:00Z' }, { '9100001': '2026-11-04T10:00:00Z', '9100010': '2026-11-05T10:00:00Z' });
    dit(c['9100001'] === '2026-10-30T08:00:00Z' && c['9100010'] === '2026-11-05T10:00:00Z', 'la transaction 450 garde la main ; le relevé COMPLÈTE une vente qu’elle ne date pas', JSON.stringify(c));
    dit(completerVersementsParReleve(null, { a: 'x' }) === null && JSON.stringify(completerVersementsParReleve({ a: '1' }, null)) === '{"a":"1"}', '450 illisible ⇒ `null` ; relevé illisible ⇒ les dates 450 restent', '');
    // Le câblage de l'app : `fetchVersementsVinted` passe par CE module.
    const app = require('fs').readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');
    const i = app.indexOf('const fetchVersementsVinted = async'), corps = app.slice(i, app.indexOf('\n};', i));
    dit(i > 0 && /completerVersementsParReleve\(map, releve\)/.test(corps) && /versementsDuReleve\(await lireTout\('id=like\.harvest_%25_releve_%25&select=id,l:data->lignes'(?:, \{ memo: true \})?\)\)/.test(corps), 'l’app (`fetchVersementsVinted`) complète les dates 450 par CE module, lecture projetée des seules lignes', corps.slice(-400));
  });

  console.log(`\n${ko ? `❌ ${ko} échec(s)` : '✅ tout est vert'} · ${ok} ✅`);
  process.exit(ko ? 1 : 0);
})();
