// ════════════════════════════════════════════════════════════════════════════
//  LES DATES DE VERSEMENT ARRIVENT VITE — SANS RISQUE DE PLUS (extension 5.341)
//
//  Mesuré le 11 nov. : 1 751 ventes de son grand compte sans date de versement,
//  parce que le détail de la transaction n'avait jamais été relu (≈ 10 par jour
//  ⇒ 6 mois). La 5.341 lit jusqu'à 10 détails par passage, jusqu'à 15 par heure
//  DANS le budget de lecture (20/h), et un passage de fond relit onglet ouvert.
//
//  On EXÉCUTE le vrai `background.js` (`_fond-vm.cjs`) et on COMPTE ce qui part
//  chez Vinted :
//   1. une visite : 10 détails au plus, la plus ANCIENNE d'abord hors des 45
//      derniers jours (5.376 ; 2025 avant 2026), une pause ALÉATOIRE de 2 à 5 s entre deux détails, des GET ;
//   2. le budget horaire : 15 lectures d'argent au plus dans l'heure, le total
//      des lectures jamais au-dessus de 20 ;
//   3. « quand rien d'autre n'attend » : au-delà de la part ordinaire, jamais la
//      place des codes, preuves et relevés (« pas su » ⇒ leur réserve entière) ;
//   4. un 429 : la série s'arrête net, la pause est posée, plus rien ne part ;
//   5. un autre compte connecté dans l'onglet : rien ;
//   6. une requête à la fois, et jamais deux passages en même temps (aucune
//      transaction lue deux fois) ;
//   7. le passage de fond : rien sans onglet vinted.fr ;
//   8. la carte dit « N restantes · environ X jours ».
//  §6.1 : rouge sur origin/main (`--src <copie>`), et par MUTATION (`--mutations`).
//  Données inventées. Usage : node scripts/audit-versement-rapide.cjs [--src f] [--mutations]
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), os = require('os'), path = require('path');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');

const UID = '111';
const FINALISEE = "Commande finalisée - l'acheteur a validé la commande";
// 40 ventes finalisées, 2025 et 2026 mêlées dans le désordre (dates inventées).
const VENTES = Array.from({ length: 40 }, (_, i) => {
  const an = i % 2 ? 2025 : 2026, mois = 1 + (i * 7) % 10, jour = 1 + (i * 3) % 27;
  return { transaction_id: 7000 + i, title: 'Paire ' + i, status: FINALISEE, date: `${an}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}T10:00:00+01:00` };
});
const lignes = () => ({ [`harvest_${UID}_orders_sold`]: { capturedAt: new Date().toISOString(), payload: { my_orders: VENTES } } });
const vintedAvec = (stat) => (r) => {
  const m = /\/api\/v2\/transactions\/(\d+)$/.exec(r.chemin);
  if (!m) return { status: 404, body: {} };
  const s = stat ? stat(m[1]) : 200;
  if (s !== 200) return { status: s, body: {} };
  return { status: 200, body: { transaction: { id: Number(m[1]), status: 450, status_title: 'Commande finalisée', status_updated_at: '2026-10-01T10:00:00Z' } } };
};
const txLus = (j) => j.vinted.map((x) => (/\/transactions\/(\d+)$/.exec(x.chemin) || [])[1]).filter(Boolean);
const lect = (store) => ((store.vrmLectures || {})[UID] || []).length;
// Les autres lecteurs prioritaires viennent de dire « rien à lire ».
const autresRien = () => { const at = Date.now(); return { vrmLecturesDues: { [UID]: { preuve: { reste: 0, at }, retrait: { reste: 0, at }, releve: { reste: 0, at } } } }; };

async function controles(SRC, dit) {
  const essaie = async (quoi, fn) => { try { await fn(); } catch (e) { dit(false, quoi + ' — a levé : ' + (e && e.message)); } };
  const fond = (o = {}) => { const f = faireFond(Object.assign({ src: SRC, lignes: lignes(), vinted: vintedAvec() }, o)); f.ctx.__vrmPausesVues = []; return f; };

  await essaie('1. une visite', async () => {
    const f = fond({ store: autresRien() });
    await f.ctx.capterDatesVersement(UID);
    const lus = txLus(f.j);
    dit(lus.length === 10, '1. une visite lit 10 détails, pas plus (40 à dater)', `${lus.length} lu(s)`);
    // (14 nov., 5.376, lot dates-versement) Hors des 45 derniers jours : la plus ANCIENNE
    // d'abord (l'URSSAF se déclare mois après mois ; audit-versement-sources juge les 45 jours).
    const d = (tx) => Date.parse(VENTES.find((v) => String(v.transaction_id) === tx).date);
    const anciennes = [...VENTES].sort((a, b) => Date.parse(a.date) - Date.parse(b.date)).slice(0, 10).map((v) => String(v.transaction_id));
    dit(lus.length > 0 && lus.every((tx, i) => i === 0 || d(lus[i - 1]) <= d(tx)) && lus.every((tx) => anciennes.includes(tx)),
      '1. la plus ancienne d’abord (2025 avant 2026, hors 45 derniers jours)', lus.map((tx) => VENTES.find((v) => String(v.transaction_id) === tx).date.slice(0, 10)).join(' '));
    const p = (f.ctx.__vrmPausesVues || []).filter((x) => x[0] === 'versement').map((x) => x[1]);
    dit(p.length === Math.max(0, lus.length - 1) && p.length > 0 && p.every((ms) => ms >= 2000 && ms <= 5000) && new Set(p).size > 1,
      '1. une pause ALÉATOIRE de 2 à 5 s entre deux détails', JSON.stringify(p));
    dit(f.j.vinted.every((x) => x.methode === 'GET'), '1. rien n’est écrit chez Vinted (des GET seulement)');
  });

  await essaie('2. budget horaire', async () => {
    const f = fond({ store: autresRien() });
    for (let i = 0; i < 4; i++) { Object.assign(f.store, autresRien()); await f.ctx.capterDatesVersement(UID); }
    const n = txLus(f.j).length;
    dit(n === 15, '2. quatre visites dans l’heure : 15 lectures d’argent, pas une de plus', `${n} lue(s)`);
    dit(lect(f.store) <= 20 && lect(f.store) === n, '2. comptées sur le budget de LECTURE (20/h), jamais au-dessus', `lectures=${lect(f.store)}`);
    const g = fond({ store: Object.assign(autresRien(), { vrmLectures: { [UID]: Array.from({ length: 12 }, () => Date.now()) } }) });
    await g.ctx.capterDatesVersement(UID);
    dit(lect(g.store) <= 20 && txLus(g.j).length === 8, '2. 12 lectures déjà faites : 8 de plus, le total reste 20', `${txLus(g.j).length} lue(s), total ${lect(g.store)}`);
  });

  await essaie('3. la place des autres', async () => {
    const f = fond({ store: {} });                  // autres lecteurs : pas su ⇒ réserve entière (3 + 3 + 2)
    await f.ctx.tickVersements();
    await f.ctx.tickVersements();
    const n = txLus(f.j).length;
    dit(n === 12, '3. autres lecteurs « pas su » : le fond s’arrête à 12 (20 − 8 réservées aux codes, preuves, relevés)', `${n} lue(s)`);
    dit(f.j.diags.includes('versement_laisse_la_place'), '3. et il le note (`versement_laisse_la_place`)');
    const g = fond({ store: { vrmLectures: { [UID]: Array.from({ length: 12 }, () => Date.now()) } } });
    await g.ctx.capterDatesVersement(UID);
    dit(txLus(g.j).length === 5, '3. une visite garde sa part ordinaire (5), pas le rattrapage, quand les autres attendent', `${txLus(g.j).length} lue(s)`);
  });

  await essaie('4. 429', async () => {
    let n = 0;
    const f = fond({ store: autresRien(), vinted: vintedAvec(() => (++n === 3 ? 429 : 200)) });
    await f.ctx.capterDatesVersement(UID);
    dit(txLus(f.j).length === 3, '4. un 429 au 3e détail : la série s’arrête net', `${txLus(f.j).length} lu(s)`);
    const p = f.store.vrmPauseVinted;
    dit(!!p && p.statut === 429, '4. la pause est posée', JSON.stringify(p));
    const avant = f.j.vinted.length;
    await f.ctx.capterDatesVersement(UID);
    await f.ctx.tickVersements();
    dit(f.j.vinted.length === avant, '4. pendant la pause : plus rien (visite ni fond)', `${f.j.vinted.length - avant} requête(s)`);
  });

  await essaie('5. autre compte', async () => {
    const f = fond({ store: autresRien() });
    f.ctx.compteConnecte = async () => '222';
    await f.ctx.capterDatesVersement(UID);
    await f.ctx.tickVersements();
    dit(txLus(f.j).length === 0, '5. un autre compte connecté dans l’onglet : rien', `${txLus(f.j).length} lu(s)`);
  });

  await essaie('6. une à la fois', async () => {
    const f = fond({ store: autresRien() });
    await Promise.all([f.ctx.capterDatesVersement(UID), f.ctx.tickVersements(), f.ctx.capterDatesVersement(UID)]);
    const lus = txLus(f.j);
    dit(f.j.maxEnVol === 1, '6. jamais deux requêtes Vinted en vol', `jusqu'à ${f.j.maxEnVol}`);
    dit(lus.length > 0 && new Set(lus).size === lus.length && lus.length <= 10, '6. un seul passage à la fois : aucune transaction lue deux fois', `${lus.length} lue(s), ${new Set(lus).size} distincte(s)`);
  });

  await essaie('7. sans onglet', async () => {
    const f = fond({ store: autresRien(), onglets: [] });
    await f.ctx.tickVersements();
    dit(txLus(f.j).length === 0, '7. le passage de fond ne lit rien sans onglet vinted.fr');
    const g = fond({ store: autresRien() });
    const n = await g.ctx.tickVersements();
    dit(n === 10 && txLus(g.j).length === 10, '7. avec l’onglet ouvert, le passage de fond lit (10)', `${txLus(g.j).length} lu(s)`);
  });

  await essaie('8. la carte', async () => {
    const f = fond({ store: autresRien() });
    f.ctx.compteConnecte = async () => UID;
    await f.ctx.capterDatesVersement(UID);
    const e = await f.ctx.etatSite('https://www.vinted.fr/member/1', 7);
    const dt = e && e.site && e.site.dates;
    dit(!!dt && dt.reste === 30 && dt.jours === 1, '8. la carte reçoit « 30 restantes · environ 1 jour »', JSON.stringify(dt));
    const g = fond({ store: {} });
    g.ctx.compteConnecte = async () => UID;
    const e2 = await g.ctx.etatSite('https://www.vinted.fr/', 7);
    dit(!!e2 && e2.site && e2.site.dates == null, '8. jamais lu : la carte ne dit rien (pas su)', JSON.stringify(e2 && e2.site));
  });
}

async function lancer(SRC) {
  let ko = 0, ok = 0;
  await controles(SRC, (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } });
  return { ko, ok };
}

const MUTATIONS = [
  ['10 par visite → 40', 'const VERSEMENT_MAX_PAR_VISITE = 10;', 'const VERSEMENT_MAX_PAR_VISITE = 40;'],
  ['plafond horaire retiré', 'const VERSEMENT_MAX_HEURE = 15;', 'const VERSEMENT_MAX_HEURE = 99;'],
  ['réserve des autres ignorée', "const plafond = rattrapage ? LECTURES_MAX_HEURE - (await reserveAutresQueVersement(uid)) : LECTURES_MAX_HEURE;", 'const plafond = LECTURES_MAX_HEURE;'],
  ['pause retirée', 'if (n > 0) await pauseLectureArgent();', ''],
  ['ordre retiré', 'const finalisees = ordreVersements(ventes.filter(', 'const finalisees = (ventes.filter('],
  ['verrou retiré', "if (_versementEnCours) { try { noterDiag('versement_deja_en_cours'); } catch (_) {} return 0; }", ''],
  ['garde du compte retirée', "const refus = await gardeLecture(uid, acc, 'argent', plafond);", 'const refus = null;'],
  ['fond sans onglet', 'if (!tabs || !tabs.length) return 0;', ''],
];

(async () => {
  const SRC = cheminSource();
  const r = await lancer(SRC);
  console.log(r.ko ? `\n❌ dates de versement rapides : ${r.ok} vert(s), ${r.ko} rouge(s)` : `\n✅ dates de versement rapides : ${r.ok} vert(s), 0 rouge(s)`);
  let koMut = 0;
  if (process.argv.includes('--mutations')) {
    const texte = fs.readFileSync(SRC, 'utf8');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-mut-versement-'));
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
