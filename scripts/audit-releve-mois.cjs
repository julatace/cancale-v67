// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE RELEVÉ DU PORTE-MONNAIE MOIS PAR MOIS (extension 5.378, 15 nov.)
//  node scripts/audit-releve-mois.cjs [--src background.js] [--mutations]
// ════════════════════════════════════════════════════════════════════════════
// Julien : « 1 741 ventes à dater ». Une lecture du relevé d'un mois date toutes
// les ventes créditées ce mois-là — À CONDITION de connaître l'adresse du mois,
// qu'on ne devine pas (`users/{id}/payouts?year=&month=` répondait 404 partout).
// Exécute le VRAI `background.js` (`_fond-vm.cjs`) et juge :
//   1. sans recette apprise : AUCUNE requête Vinted (plus d'adresse devinée) ;
//   2. une adresse sans le mois (`current`, l'année seule) n'apprend rien ;
//   3. une réponse d'un mois passé captée EN PASSANT (le compte de l'onglet)
//      apprend la recette ; les mois que Vinted liste (`history`) sont notés ;
//   4. la visite lit les mois listés, du plus récent au plus ancien, au plus
//      `RELEVE_MAX_PAR_VISITE`, des GET une par une, par la recette apprise ;
//   5. chaque ligne rangée porte le n° de transaction SEULEMENT si elle le porte
//      (identité) ; une ligne sans identité ne date rien ; rien de personnel
//      (ni libellé/pseudo, ni bout d'IBAN) ; la règle de l'app ne date que par n° ;
//   6. forme inconnue ⇒ rien écrit pour ce mois, sa forme dans `forme_releve`,
//      recette oubliée ; mois rendu ≠ demandé ⇒ rien écrit, recette oubliée ;
//   7. un autre compte connecté dans l'onglet ⇒ rien ;
//   8. le budget de LECTURE (20/h) : plein ⇒ rien ; chaque lecture y est comptée ;
//   9. un 429 ⇒ pause posée, la série s'arrête, plus rien pendant la pause ;
//  10. le passage de fond (onglet vinted.fr ouvert) lit aussi les mois ; sans onglet, rien.
// Données INVENTÉES (le dépôt est public) ; l'adresse de mois du banc est inventée aussi.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), os = require('os'), path = require('path');
const { pathToFileURL } = require('url');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');

const UID = '111';
const MOIS_URL = (y, m) => `https://www.vinted.fr/api/v2/wallet/invoices/${y}/${String(m).padStart(2, '0')}`;   // INVENTÉE pour le banc
const PSEUDO = 'acheteuse_inventee_42';
// Un mouvement de la forme RÉELLE d'une ligne de relevé (clés vues en base sur un virement :
// id, date, type, title, amount{amount,currency_code}, pending, subtitle, entity_id, entity_type).
const ligne = (o) => Object.assign({ id: 9100000 + Math.floor(Math.random() * 1e5), date: '2026-09-14T10:00:00.000Z', type: 'debit', title: `Vente à ${PSEUDO}`, amount: { amount: '45.0', currency_code: 'EUR' }, pending: false, subtitle: 'FR76 **** 9999' }, o);
const releveDu = (cle, lignes, extra = {}) => Object.assign({ code: 0, balance: { amount: '0.0', currency_code: 'EUR' }, history: [], invoice_lines: lignes, starting_date: cle + '-01', invoice_lines_has_more: false }, extra);
const LIGNES_SEPT = [
  ligne({ transaction_id: 8800001 }),                                     // identité : clé `transaction_id`
  ligne({ entity_type: 'transaction', entity_id: '8800002' }),            // identité : nature « transaction » et son id
  ligne({ entity_type: 'item', entity_id: '5550001' }),                   // SANS identité de vente (même montant, même jour)
  ligne({ amount: { amount: '-30.0', currency_code: 'EUR' }, entity_type: 'payout', entity_id: '777001', title: 'Transfert vers le compte bancaire' }),
];
const vintedMois = (special) => (r) => {
  const m = /\/api\/v2\/wallet\/invoices\/(\d{4})\/(\d{2})$/.exec(r.chemin);
  if (!m) return { status: 404, body: {} };
  const cle = `${m[1]}-${m[2]}`;
  const s = special && special(cle);
  if (s) return s;
  return { status: 200, body: releveDu(cle, cle === '2026-09' ? LIGNES_SEPT : [ligne({ date: `${cle}-10T10:00:00.000Z`, transaction_id: 8900000 + Number(m[2]) })]) };
};
const moisLus = (j) => j.vinted.map((x) => (/\/wallet\/invoices\/(\d{4})\/(\d{2})$/.exec(x.chemin) || []).slice(1, 3).join('-')).filter(Boolean);
const lect = (store) => ((store.vrmLectures || {})[UID] || []).length;
const autresRien = () => { const at = Date.now(); return { vrmLecturesDues: { [UID]: { preuve: { reste: 0, at }, retrait: { reste: 0, at }, versement: { reste: 0, at, nonDatees: 0 } } } }; };
const HIST = [9, 8, 7, 6, 5, 4].map((m) => ({ year: 2026, month: m, title: 'M' + m }));

async function controles(SRC, dit) {
  const essaie = async (quoi, fn) => { try { await fn(); } catch (e) { dit(false, quoi + ' — a levé : ' + (e && e.message)); } };
  const fond = (o = {}) => { const f = faireFond(Object.assign({ src: SRC, lignes: {}, vinted: vintedMois(), store: autresRien() }, o)); f.ctx.__vrmPausesVues = []; return f; };
  // Sa navigation : le relevé courant (liste des mois), puis un mois passé (juillet) ouvert par LUI.
  const naviguer = async (f, urlMois = MOIS_URL(2026, 7)) => {
    await f.ctx.storeHarvest('www.vinted.fr', 'billing', null, JSON.stringify(releveDu('2026-11', [], { history: HIST })), 'https://www.vinted.fr/api/v2/wallet/invoices/current');
    await f.ctx.storeHarvest('www.vinted.fr', 'billing', null, JSON.stringify(releveDu('2026-07', [ligne({ date: '2026-07-10T10:00:00.000Z', transaction_id: 8900007 })])), urlMois);
  };
  const recette = (f) => ((f.store.vrmReleveRecette || {})[UID]) || null;

  await essaie('1. sans recette', async () => {
    // (le profil est là : l'ancienne voie avait tout pour deviner `users/{id}/payouts?year=&month=`)
    const f = fond({ lignes: { [`harvest_${UID}_billing`]: { payload: releveDu('2026-11', [], { history: HIST }) }, [`harvest_${UID}_profile`]: { payload: { user: { id: 3166000 } } } } });
    await f.ctx.capterReleves(UID);
    dit(f.j.vinted.length === 0, '1. sans recette apprise : AUCUNE requête Vinted (plus d’adresse devinée)', f.j.vinted.map((x) => x.chemin).join(' '));
  });

  await essaie('2. pas de mois dans l’adresse', async () => {
    const f = fond();
    await f.ctx.storeHarvest('www.vinted.fr', 'billing', null, JSON.stringify(releveDu('2026-11', [ligne({ date: '2026-11-03T10:00:00Z', transaction_id: 8900011 })], { history: HIST })), 'https://www.vinted.fr/api/v2/wallet/invoices/current');
    await f.ctx.storeHarvest('www.vinted.fr', 'billing', null, JSON.stringify(releveDu('2026-07', [ligne({ date: '2026-07-10T10:00:00Z', transaction_id: 8900007 })])), 'https://www.vinted.fr/api/v2/wallet/invoices/2026?vue=mois');
    await f.ctx.storeHarvest('www.vinted.fr', 'billing', null, JSON.stringify(releveDu('2026-07', [ligne({ date: '2026-07-10T10:00:00Z', transaction_id: 8900007 })])), 'https://www.vinted.fr/api/v2/wallet/invoices/mois/07');
    dit(!recette(f), '2. `current`, une adresse qui ne porte que l’année, ou que le mois, n’apprennent rien', JSON.stringify(f.store.vrmReleveRecette));
  });

  await essaie('3. apprise en passant', async () => {
    const f = fond();
    await naviguer(f);
    const r = recette(f);
    dit(!!r && r.modele === '/api/v2/wallet/invoices/{Y}/{MM}' && r.pad === true, '3. une réponse de juillet captée en passant apprend la recette (année et mois remplacés)', JSON.stringify(r));
    const m = ((f.store.vrmReleveMois || {})[UID] || {}).mois;
    dit(Array.isArray(m) && m.join(',') === '2026-09,2026-08,2026-07,2026-06,2026-05,2026-04', '3. les mois que Vinted liste (`history`) sont notés, des nombres seulement', JSON.stringify(m));
    dit(!!f.lignes[`harvest_${UID}_releve_2026-07`], '3. et le mois capté est rangé dans SA ligne');
    const g = fond({ connecte: '222' });
    g.ctx.compteConnecte = async () => '222';
    await naviguer(g);
    dit(!((g.store.vrmReleveRecette || {})[UID]) && !g.lignes[`harvest_${UID}_releve_2026-07`], '3. capté sur un AUTRE compte : rien n’est rangé ni appris pour celui-ci');
  });

  await essaie('4. la visite', async () => {
    const f = fond();
    await naviguer(f);
    const avant = lect(f.store);
    await f.ctx.capterReleves(UID);
    const lus = moisLus(f.j);
    const cap = Number((/const RELEVE_MAX_PAR_VISITE = (\d+);/.exec(fs.readFileSync(SRC, 'utf8')) || [])[1] || 0);
    dit(cap > 0 && lus.join(',') === '2026-09,2026-08', `4. les mois listés, du plus récent au plus ancien, ${cap} par visite (juillet déjà rangé : pas relu)`, lus.join(','));
    dit(f.j.vinted.every((x) => x.methode === 'GET') && f.j.maxEnVol === 1, '4. des GET, une requête à la fois');
    dit(lect(f.store) - avant === lus.length && lus.length > 0, '4. chaque mois lu compte dans le budget de LECTURE', `${lect(f.store) - avant} compté(s) pour ${lus.length}`);
    const p = (f.ctx.__vrmPausesVues || []).filter((x) => x[0] === 'versement').map((x) => x[1]);
    dit(p.length === lus.length - 1 && p.every((ms) => ms >= 2000 && ms <= 5000), '4. une pause de 2 à 5 s entre deux mois', JSON.stringify(p));
  });

  await essaie('5. identité, rien de personnel', async () => {
    const f = fond();
    await naviguer(f);
    await f.ctx.capterReleves(UID);
    const row = f.lignes[`harvest_${UID}_releve_2026-09`];
    const L = row && Array.isArray(row.lignes) ? row.lignes : [];
    const tx = L.map((x) => x.tx).filter(Boolean).sort();
    dit(tx.join(',') === '8800001,8800002', '5. les lignes rangées portent le n° de transaction SEULEMENT quand la ligne le porte', JSON.stringify(L.map((x) => [x.tx, x.quoi, x.ref])));
    dit(L.length === 4 && L.filter((x) => !x.tx).length === 2, '5. la ligne sans identité de vente (et le virement) : rangées sans n°, elles ne datent rien', String(L.length));
    const brut = JSON.stringify(row || {});
    dit(!!row && !brut.includes(PSEUDO) && !/FR76|\*\*\*\*/.test(brut) && !/"title"|"subtitle"/.test(brut), '5. rien de personnel rangé (ni libellé, ni pseudo, ni bout d’IBAN)', brut.slice(0, 200));
    const R = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'versementReleve.js')).href);
    const carte = R.versementsDuReleve([{ id: `harvest_${UID}_releve_2026-09`, l: L }]);
    dit(carte && Object.keys(carte).sort().join(',') === '8800001,8800002', '5. la règle de l’app (`versementsDuReleve`) ne date que ces deux n°, jamais par montant ni par jour', JSON.stringify(carte));
  });

  await essaie('6. forme inconnue, mauvais mois', async () => {
    const f = fond({ vinted: vintedMois((cle) => (cle === '2026-09' ? { status: 200, body: { wallet: { truc: [{ a: 1 }] } } } : null)) });
    await naviguer(f);
    await f.ctx.capterReleves(UID);
    dit(!f.lignes[`harvest_${UID}_releve_2026-09`] && moisLus(f.j).join(',') === '2026-09', '6. forme inconnue : rien écrit pour ce mois, la série s’arrête', moisLus(f.j).join(','));
    const fr = f.lignes[`harvest_${UID}_forme_releve`];
    dit(!!fr && Array.isArray(fr.forme) && fr.forme.length > 0 && !JSON.stringify(fr).includes('2026-09-14'), '6. sa FORME (noms de clés, jamais une valeur) va dans `harvest_{uid}_forme_releve`', JSON.stringify(fr));
    dit(!recette(f), '6. et la recette est oubliée (plus aucune requête pour rien)', JSON.stringify(f.store.vrmReleveRecette));
    const g = fond({ vinted: vintedMois((cle) => (cle === '2026-09' ? { status: 200, body: releveDu('2026-11', LIGNES_SEPT) } : null)) });
    await naviguer(g);
    await g.ctx.capterReleves(UID);
    dit(!g.lignes[`harvest_${UID}_releve_2026-09`] && !g.lignes[`harvest_${UID}_releve_2026-11`] && !recette(g) && moisLus(g.j).length === 1, '6. mois rendu ≠ demandé : rien écrit, recette oubliée, la série s’arrête', moisLus(g.j).join(','));
    const n = g.j.vinted.length;
    await g.ctx.capterReleves(UID);
    dit(g.j.vinted.length === n, '6. la visite suivante ne redemande rien', `${g.j.vinted.length - n} requête(s)`);
  });

  await essaie('7. autre compte', async () => {
    const f = fond();
    await naviguer(f);
    f.ctx.compteConnecte = async () => '222';
    await f.ctx.capterReleves(UID);
    await f.ctx.tickVersements();
    dit(moisLus(f.j).length === 0, '7. un autre compte connecté dans l’onglet : rien', moisLus(f.j).join(','));
  });

  await essaie('8. budget', async () => {
    const f = fond();
    await naviguer(f);
    f.store.vrmLectures = { [UID]: Array.from({ length: 20 }, () => Date.now()) };
    await f.ctx.capterReleves(UID);
    dit(moisLus(f.j).length === 0 && lect(f.store) === 20, '8. 20 lectures déjà faites dans l’heure : rien de plus', `${moisLus(f.j).length} lu(s), total ${lect(f.store)}`);
  });

  await essaie('9. 429', async () => {
    const f = fond({ vinted: vintedMois(() => ({ status: 429, body: {} })) });
    await naviguer(f);
    await f.ctx.capterReleves(UID);
    dit(moisLus(f.j).length === 1 && !!f.store.vrmPauseVinted, '9. un 429 : la pause est posée, la série s’arrête net', `${moisLus(f.j).length} lu(s) ${JSON.stringify(f.store.vrmPauseVinted)}`);
    const n = f.j.vinted.length;
    await f.ctx.capterReleves(UID);
    await f.ctx.tickVersements();
    dit(f.j.vinted.length === n, '9. pendant la pause : plus rien (visite ni fond)', `${f.j.vinted.length - n} requête(s)`);
  });

  await essaie('10. passage de fond', async () => {
    const f = fond();
    await naviguer(f);
    await f.ctx.tickVersements();
    dit(moisLus(f.j).join(',') === '2026-09,2026-08', '10. onglet vinted.fr ouvert : le passage de fond lit les mois du relevé', moisLus(f.j).join(','));
    const g = fond({ onglets: [] });
    await naviguer(g);
    await g.ctx.tickVersements();
    dit(moisLus(g.j).length === 0, '10. sans onglet vinted.fr : rien');
  });
}

async function lancer(SRC) {
  let ok = 0, ko = 0;
  const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d ? ' — ' + String(d).slice(0, 300) : '')); };
  await controles(SRC, dit);
  return { ok, ko };
}

// Réaffaiblir la règle ⇒ au moins un rouge (§6.1).
const MUTATIONS = [
  ['garde du compte retirée', "const refus = await gardeLecture(uid, acc, 'argent');", 'const refus = null;'],
  ['mois rendu non vérifié', 'if (recu !== cle) {', 'if (false) {'],
  ['identité par entity_id quelconque', 'tx: txDeLigneReleve(l),', 'tx: txDeLigneReleve(l) || (l.entity_id != null ? String(l.entity_id) : undefined),'],
  ['liste blanche percée', 'attente: l.pending === true ? true : undefined,', 'attente: l.pending === true ? true : undefined, titre: l.title,'],
  ['forme inconnue pas dite', 'if (!porteur) await noterFormeReleve(uid, rep.json, chemin);', ''],
  ['recette sans l’année', 'if ((cible.match(reY) || []).length !== 1) return null;', 'if ((cible.match(reY) || []).length > 1) return null;'],
  ['plafond par visite retiré', 'if (n >= RELEVE_MAX_PAR_VISITE) break;', ''],
  ['ordre retiré', ".sort().reverse();   // du plus récent au plus ancien", '.sort();'],
  ['fond sans les mois', 'try { if (await recetteReleve(uid)) await capterReleves(uid); } catch (_) {}', ''],
];

(async () => {
  const SRC = cheminSource();
  const r = await lancer(SRC);
  console.log(r.ko ? `\n❌ relevé mois par mois : ${r.ok} vert(s), ${r.ko} rouge(s)` : `\n✅ relevé mois par mois : ${r.ok} vert(s), 0 rouge(s)`);
  let koMut = 0;
  if (process.argv.includes('--mutations')) {
    const texte = fs.readFileSync(SRC, 'utf8');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-mut-releve-'));
    for (const [nom, de, vers] of MUTATIONS) {
      if (!texte.includes(de)) { koMut++; console.log(`❌ mutation « ${nom} » : la ligne est introuvable — le contrôle ne prouve rien`); continue; }
      const f = path.join(dir, 'background.js');
      fs.writeFileSync(f, texte.replace(de, vers));
      const log = console.log; console.log = () => {};
      let m; try { m = await lancer(f); } finally { console.log = log; }
      if (m.ko > 0) console.log(`✅ mutation « ${nom} » : ${m.ko} rouge(s) — le contrôle mord`);
      else { koMut++; console.log(`❌ mutation « ${nom} » : tout reste vert`); }
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
  process.exit(r.ko || koMut ? 1 : 0);
})();
