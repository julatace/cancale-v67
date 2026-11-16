// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE RELEVÉ NE DATE RIEN AVANT D'AVOIR ÉTÉ COMPARÉ (15 nov.)
//  node scripts/audit-releve-verif.cjs [--src src/versementReleve.js] [--mutations]
// ════════════════════════════════════════════════════════════════════════════
// La date de versement de VRM = le jour où la vente est créditée (transaction 450,
// « Commande finalisée »). Une ligne du relevé du porte-monnaie qui porte le n° de
// transaction d'une vente ne la date que si le relevé de CE compte a été COMPARÉ :
// au moins `RELEVE_ACCORDS_MIN` ventes où relevé et détail 450 tombent le même jour
// (heure de Paris), et AUCUN désaccord. Sinon « pas su », dit à l'écran. Le détail
// 450 gagne toujours. On EXÉCUTE le vrai module (src/versementReleve.js), la règle du
// serveur (api/_lib/bilan-semaine.js → `versementsDeLignes`, le même module) et la
// règle des sources (`datesDeVersement`, api/_lib/ventes-regle.js, copie de l'app).
// Données INVENTÉES.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), os = require('os'), path = require('path');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? path.resolve(process.argv[i + 1]) : null; };

// Le relevé d'un compte : des lignes rangées par l'extension (`ligneReleve`).
const L = (tx, date, o = {}) => Object.assign({ id: 'l' + tx, date, montant: 45, devise: 'EUR', type: 'credit', quoi: 'transaction', ref: String(tx), tx: String(tx) }, o);
const T450 = (tx, su) => ({ tx: String(tx), s: '450', su });
// 5 ventes où le relevé et la 450 tombent le même jour de Paris, + la vente 9007 que SEUL le relevé date.
const accords = (n, base = 9100) => Array.from({ length: n }, (_, i) => base + i);
const jeu = ({ n = 5, desaccord = false, uid = '222' } = {}) => {
  const tx = accords(n);
  const releve = [{ id: `harvest_${uid}_releve_2026-10`, l: [
    ...tx.map((t) => L(t, '2026-10-14T07:00:00.000Z')),                   // 9 h à Paris
    L(9007, '2026-10-15T09:00:00.000Z'),
    ...(desaccord ? [L(9300, '2026-10-03T10:00:00.000Z')] : []),        // le relevé dit le 3…
  ] }];
  const txn = [...tx.map((t) => T450(t, '2026-10-14T18:30:00+02:00')), ...(desaccord ? [T450(9300, '2026-10-12T10:00:00+02:00')] : [])];   // … la 450 dit le 12
  return { releve, txn };
};

async function controles(SRC, dit) {
  const R = await import(pathToFileURL(SRC).href + '?v=' + Date.now());
  const essaie = async (quoi, fn) => { try { await fn(); } catch (e) { dit(false, quoi + ' — a levé : ' + (e && e.message)); } };
  const N = R.RELEVE_ACCORDS_MIN;

  await essaie('1. accord', async () => {
    dit(N === 5, '1. N = 5 accords (justifié : 0 vente sur 469 finalisée le jour de sa vente — une autre notion se trahit à chaque comparaison)', String(N));
    const { releve, txn } = jeu();
    const v = R.verifierReleve(releve, txn);
    dit(!!v && v['222'] && v['222'].etat === 'verifie' && v['222'].accords === 5 && v['222'].desaccords === 0 && v['222'].lignes === 6, '1. 5 accords, aucun désaccord : le relevé de ce compte est VÉRIFIÉ', JSON.stringify(v));
    const c = R.versementsDuReleveVerifies(releve, txn);
    dit(!!c && c['9007'] === '2026-10-15T09:00:00.000Z', '1. vérifié : la vente que SEUL le relevé date est datée (par SON n°)', JSON.stringify(c));
  });

  await essaie('2. pas assez', async () => {
    const { releve, txn } = jeu({ n: 4 });
    const v = R.verifierReleve(releve, txn);
    dit(v && v['222'].etat === 'a-verifier' && v['222'].accords === 4, '2. 4 accords : « à vérifier »', JSON.stringify(v));
    const c = R.versementsDuReleveVerifies(releve, txn);
    dit(c && Object.keys(c).length === 0, '2. à vérifier : le relevé ne date RIEN (« pas su »)', JSON.stringify(c));
    const nv = R.relevesNonVerifies(c, (u) => (u === '222' ? 'vendeuse_b' : ''));
    dit(nv.length === 1 && nv[0].uid === '222' && nv[0].nom === 'vendeuse_b' && nv[0].accords === 4 && nv[0].min === 5 && nv[0].etat === 'a-verifier', '2. et l’écran le sait : « dates du relevé pas encore vérifiées (4 sur 5) » sur vendeuse_b', JSON.stringify(nv));
  });

  await essaie('3. désaccord', async () => {
    const { releve, txn } = jeu({ n: 8, desaccord: true });
    const v = R.verifierReleve(releve, txn);
    dit(v && v['222'].etat === 'desaccord' && v['222'].accords === 8 && v['222'].desaccords === 1, '3. 8 accords + 1 désaccord : le compte est en DÉSACCORD', JSON.stringify(v));
    const c = R.versementsDuReleveVerifies(releve, txn);
    dit(c && Object.keys(c).length === 0, '3. un seul désaccord : le relevé de ce compte ne date plus rien', JSON.stringify(c));
  });

  await essaie('4. aucun recouvrement', async () => {
    const releve = [{ id: 'harvest_222_releve_2026-10', l: [L(9007, '2026-10-15T09:00:00Z')] }];
    const v = R.verifierReleve(releve, [T450(1, '2026-10-01T10:00:00Z')]);
    dit(v && v['222'].etat === 'sans-recouvrement' && v['222'].compares === 0, '4. aucune vente commune : « sans recouvrement », rien de daté', JSON.stringify(v));
    dit(Object.keys(R.versementsDuReleveVerifies(releve, [T450(1, '2026-10-01T10:00:00Z')])).length === 0, '4. et rien n’est daté');
  });

  await essaie('5. heure de Paris', async () => {
    // 23 h 30 UTC le 14 = 0 h 30 le 15 à Paris : même jour que 9 h le 15 (Paris) ; une coupe en UTC dirait l'inverse.
    const rel = (d) => [{ id: 'harvest_222_releve_2026-10', l: accords(5).map((t) => L(t, d)) }];
    const ref = accords(5).map((t) => T450(t, '2026-10-14T23:30:00Z'));
    dit(R.verifierReleve(rel('2026-10-15T07:00:00Z'), ref)['222'].etat === 'verifie', '5. 23 h 30 UTC le 14 et 9 h le 15 (Paris) : le MÊME jour de Paris ⇒ accord');
    dit(R.verifierReleve(rel('2026-10-14T20:00:00Z'), ref)['222'].etat === 'desaccord', '5. 22 h le 14 et 1 h 30 le 15 (Paris) : deux jours de Paris ⇒ désaccord');
    dit(R.jourParis('2026-07-01T22:30:00Z') === '2026-07-02' && R.jourParis('2026-01-01T23:30:00Z') === '2026-01-02' && R.jourParis('x') === null, '5. `jourParis` : heure d’été (+2) et d’hiver (+1) ; illisible ⇒ null');
  });

  await essaie('6. pas su', async () => {
    const { releve } = jeu();
    dit(R.versementsDuReleveVerifies(null, []) === null, '6. relevé illisible ⇒ `null` (pas su)');
    const c = R.versementsDuReleveVerifies(releve, null);
    dit(c && Object.keys(c).length === 0 && R.verifReleve(c) === null, '6. détails illisibles ⇒ rien n’est vérifiable, rien n’est daté par le relevé', JSON.stringify(c));
  });

  await essaie('7. compte par compte', async () => {
    const a = jeu({ uid: '222' }), b = { releve: [{ id: 'harvest_333_releve_2026-10', l: [L(9555, '2026-10-20T10:00:00Z')] }] };
    const c = R.versementsDuReleveVerifies([...a.releve, ...b.releve], a.txn);
    dit(c['9007'] && !c['9555'], '7. le compte 222 vérifié ne vérifie PAS le compte 333', JSON.stringify(c));
  });

  await essaie('8. la 450 gagne, et le serveur dit pareil', async () => {
    const { releve, txn } = jeu();
    // La vente 9100 : 450 le 14 à 18 h 30 (Paris), relevé le 14 à 9 h : la 450 reste.
    const S = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'bilan-semaine.js')).href);
    const m = S.versementsDeLignes(txn, releve, null, null);
    dit(m && m['9100'] === '2026-10-14T18:30:00+02:00' && m['9007'] === '2026-10-15T09:00:00.000Z', '8. serveur (`versementsDeLignes`) : la 450 gagne, le relevé vérifié complète', JSON.stringify(m));
    const m4 = S.versementsDeLignes(jeu({ n: 4 }).txn, jeu({ n: 4 }).releve, null, null);
    dit(!!m4 && m4['9100'] && !m4['9007'], '8. serveur : relevé pas vérifié (4 accords) ⇒ la vente que seul le relevé date n’est PAS datée', JSON.stringify(m4));
    dit(typeof R.verifReleve === 'function' && R.verifReleve(m4) && R.verifReleve(m4)['222'].etat === 'a-verifier', '8. et le verdict suit la carte', JSON.stringify(m4));
  });

  await essaie('9. câblage', async () => {
    const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
    const i = app.indexOf('const fetchVersementsVinted = async'), corps = app.slice(i, app.indexOf('\n};', i));
    dit(/releve = versementsDuReleveVerifies\(releveL, rows\)/.test(corps) && /porterVerifReleve\(datesDeVersement\(rows, releve, convL, emailsL\), releve\)/.test(corps), '9. l’app (`fetchVersementsVinted`) passe par la voie VÉRIFIÉE, avec les détails 450 qu’elle a lus');
    dit(/ad\.releve = rv/.test(app) && /relevesNonVerifies\(versements, nomDe\)/.test(app), '9. Ventes publie les relevés pas encore vérifiés (`aDater.releve`)');
    const compta = fs.readFileSync(path.join(RACINE, 'src', 'ecrans', 'Compta.jsx'), 'utf8');
    // (15 nov., extension 5.390) « Déclarer » ne dit plus le détail du relevé (aucun geste, une ligne discrète) ;
    // rien n'est daté par un relevé pas vérifié — la règle ci-dessus le prouve.
    dit(!/data-adater-raison/.test(compta) && /<LigneDatesVersement /.test(compta), '9. « Déclarer » : une ligne discrète, plus la carte des raisons (5.390)');
  });
}

async function lancer(SRC) {
  let ok = 0, ko = 0;
  const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d ? ' — ' + String(d).slice(0, 300) : '')); };
  await controles(SRC, dit);
  return { ok, ko };
}

const MUTATIONS = [
  ['seuil retiré', "c.accords >= min ? 'verifie'", "c.accords >= 0 ? 'verifie'"],
  ['désaccord ignoré', "c.etat = c.desaccords > 0 ? 'desaccord' : ", 'c.etat = '],
  ['jour en UTC', 'return p.year && p.month && p.day ? `${p.year}-${p.month}-${p.day}` : null;', 'return new Date(t).toISOString().slice(0, 10);'],
  ['comptes non filtrés', 'releveRows.filter((r) => ok.has(uidDuReleve(r && r.id)))', 'releveRows'],
  ['détails illisibles = vérifié', "if (!Array.isArray(releveRows) || !Array.isArray(txn)) return null;", "if (!Array.isArray(releveRows)) return null; if (!Array.isArray(txn)) txn = [];"],
];

(async () => {
  const SRC = arg('--src') || path.join(RACINE, 'src', 'versementReleve.js');
  const r = await lancer(SRC);
  console.log(r.ko ? `\n❌ relevé vérifié : ${r.ok} vert(s), ${r.ko} rouge(s)` : `\n✅ relevé vérifié : ${r.ok} vert(s), 0 rouge(s)`);
  let koMut = 0;
  if (process.argv.includes('--mutations')) {
    const texte = fs.readFileSync(SRC, 'utf8');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-mut-verif-'));
    for (const [nom, de, vers] of MUTATIONS) {
      if (!texte.includes(de)) { koMut++; console.log(`❌ mutation « ${nom} » : la ligne est introuvable — le contrôle ne prouve rien`); continue; }
      const f = path.join(dir, `versementReleve-${MUTATIONS.findIndex((x) => x[0] === nom)}.mjs`);
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
