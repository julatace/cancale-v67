// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LES DATES DE VERSEMENT, RÉCUPÉRÉES TOUTES SEULES (extension 5.390, 15 nov.)
//  node scripts/audit-versements-auto.cjs [--src background.js] [--mutations]
// ════════════════════════════════════════════════════════════════════════════
// Julien (15 nov., mot pour mot) : « Enlève les 1741 ventes à dater, cela n'a aucun
// sens. Le but est que l'extension récupère ces infos, pas que ça soit à nous de le
// faire. »  Récit : docs/passation/2026-11-15-versements-auto.md.
//
// L'EXTENSION — on EXÉCUTE le vrai `background.js` (`_fond-vm.cjs`) et on COMPTE ce
// qui part chez Vinted :
//   E1. une visite lit 20 détails (la 5.389 : 10), la vente la plus RÉCENTE d'abord
//       (le mois en cours et le précédent en tête), des GET, une pause aléatoire ;
//   E2. le budget de LECTURE (20/h, tous lecteurs) n'est jamais dépassé : deux
//       visites dans l'heure = 20 lectures, pas une de plus ; 12 déjà faites ⇒ 8 ;
//   E3. la réserve des codes, preuves et relevés reste entière (« pas su » ⇒ 8 places
//       gardées : le passage de fond s'arrête à 12) ;
//   E4. un 429 : la série s'arrête net, la pause est posée, plus rien ne part ;
//   E5. un autre compte connecté dans l'onglet : rien ;
//   E6. « pas su » ⇒ rien : la liste des ventes ou les détails rangés illisibles
//       (base muette) ⇒ AUCUNE requête Vinted ;
//   E7. un détail encore à 230 (« paiement validé ») : rangé, PAS daté (aucune date
//       inventée), compté parmi celles qui restent ;
//   E8. UNE page de relevé du porte-monnaie (forme réelle, recette apprise sur SON
//       geste) date 30 ventes D'UN COUP par la règle de l'app (vérifiée : 5 accords
//       avec le détail 450) — une lecture au lieu de 30 ; une forme inconnue ⇒ rien
//       rangé (sa forme seule, `harvest_{uid}_forme_releve`) ;
//   E9. la carte du logo dit « N restantes · environ X h » au rythme de l'app (la même
//       constante des deux côtés : 18 par heure) et ne demande AUCUN geste.
// L'ÉCRAN — la règle et les sources :
//   A1. `ligneDatesVersement` : rien quand tout est daté (ou pas su), sinon { n, heures } ;
//   A2. le total qui laisse des ventes sans date dit « au moins » (jamais « + N ventes à
//       dater ») ; une case sans valeur dit « dates en lecture », sans nombre ;
//   A3. plus aucun « à dater » ni geste de datation dans les écrans d'Argent, de Ma
//       journée, des choses à trancher, de la santé des données et du contrôle de nuit
//       (commentaires retirés avant de chercher) ; plus de « Dater à la main » Leboncoin ;
//   A4. le délai avant / après pour 1 741 ventes (dit dans le rapport, jamais une date).
// §6.1 : ROUGE sur l'arbre de départ (copier ce fichier DANS `git archive f782040f`, le
// lancer depuis là) et par MUTATION (`--mutations`). Données INVENTÉES (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { pathToFileURL } = require('url');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');

const RACINE = path.join(__dirname, '..');
const UID = '111';
const FINALISEE = "Commande finalisée - l'acheteur a validé la commande";
const now = new Date();
const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
// 60 ventes finalisées, données dans le DÉSORDRE : 6 ce mois-ci, 6 le mois dernier, le
// reste de 2025 à début 2026 (dates inventées, jamais deux fois la même).
const VENTES = Array.from({ length: 60 }, (_, i) => {
  let d;
  if (i < 6) d = new Date(now.getFullYear(), now.getMonth(), 1, 9 + i);
  else if (i < 12) d = new Date(now.getFullYear(), now.getMonth() - 1, 2 + i, 10);
  else d = new Date(2025, (i * 7) % 12, 1 + (i % 27), 8 + (i % 10));
  return { transaction_id: 7000 + ((i * 37) % 60), title: 'Paire ' + i, status: FINALISEE, date: d.toISOString() };
});
const parDate = [...VENTES].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
const lignes = (plus = {}) => Object.assign({ [`harvest_${UID}_orders_sold`]: { capturedAt: new Date().toISOString(), payload: { my_orders: VENTES } } }, plus);
const vintedAvec = (stat, statut = () => 450) => (r) => {
  const m = /\/api\/v2\/transactions\/(\d+)$/.exec(r.chemin);
  if (!m) return { status: 404, body: {} };
  const s = stat ? stat(m[1]) : 200;
  if (s !== 200) return { status: s, body: {} };
  const st = statut(m[1]);
  return { status: 200, body: { transaction: { id: Number(m[1]), status: st, status_title: st === 450 ? 'Commande finalisée' : 'Paiement validé', status_updated_at: '2026-10-01T10:00:00Z' } } };
};
const txLus = (j) => j.vinted.map((x) => (/\/transactions\/(\d+)$/.exec(x.chemin) || [])[1]).filter(Boolean);
const lect = (store) => ((store.vrmLectures || {})[UID] || []).length;
const autresRien = () => { const at = Date.now(); return { vrmLecturesDues: { [UID]: { preuve: { reste: 0, at }, retrait: { reste: 0, at }, releve: { reste: 0, at } } } }; };

// Le relevé du porte-monnaie, forme RÉELLE d'une ligne (clés vues en base sur un virement :
// id, date, type, title, amount{amount,currency_code}, pending, subtitle, entity_id, entity_type).
const MOIS_URL = (y, m) => `https://www.vinted.fr/api/v2/wallet/invoices/${y}/${String(m).padStart(2, '0')}`;   // INVENTÉE pour le banc
const ligneR = (o) => Object.assign({ id: 9100000 + Math.floor(Math.random() * 1e5), date: '2026-09-14T10:00:00.000Z', type: 'credit', title: 'Vente à acheteuse_inventee', amount: { amount: '45.0', currency_code: 'EUR' }, pending: false }, o);
const releveDu = (cle, l, extra = {}) => Object.assign({ code: 0, balance: { amount: '0.0', currency_code: 'EUR' }, history: [], invoice_lines: l, starting_date: cle + '-01', invoice_lines_has_more: false }, extra);
const SEPT = Array.from({ length: 30 }, (_, i) => ligneR({ transaction_id: 8800000 + i, date: `2026-09-${String(1 + (i % 28)).padStart(2, '0')}T10:00:00.000Z` }));
const vintedMois = (special) => (r) => {
  const m = /\/api\/v2\/wallet\/invoices\/(\d{4})\/(\d{2})$/.exec(r.chemin);
  if (!m) return { status: 404, body: {} };
  const cle = `${m[1]}-${m[2]}`;
  const s = special && special(cle);
  if (s) return s;
  return { status: 200, body: releveDu(cle, cle === '2026-09' ? SEPT : []) };
};
const lire = (rel) => fs.readFileSync(path.join(RACINE, rel), 'utf8');
// Les commentaires retirés avant de chercher (§6.4) ; « https:// » n'est pas un commentaire.
const sansCommentaires = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1');

async function controles(SRC, dit) {
  const essaie = async (quoi, fn) => { try { await fn(); } catch (e) { dit(false, quoi + ' — a levé : ' + (e && e.message)); } };
  const fond = (o = {}) => { const f = faireFond(Object.assign({ src: SRC, lignes: lignes(), vinted: vintedAvec() }, o)); f.ctx.__vrmPausesVues = []; return f; };

  await essaie('E1', async () => {
    const f = fond({ store: autresRien() });
    await f.ctx.capterDatesVersement(UID);
    const lus = txLus(f.j);
    dit(lus.length === 20, 'E1 une visite lit 20 détails (60 à dater)', `${lus.length} lu(s)`);
    const attendu = parDate.slice(0, 20).map((v) => String(v.transaction_id));
    dit(lus.join(',') === attendu.join(','), 'E1 la plus RÉCENTE d’abord, partout (le mois en cours, puis le précédent, puis l’historique en remontant)',
      lus.map((tx) => (VENTES.find((v) => String(v.transaction_id) === tx) || {}).date.slice(0, 10)).join(' '));
    const deuxMois = new Set([ym(now), ym(new Date(now.getFullYear(), now.getMonth() - 1, 1))]);
    dit(lus.slice(0, 12).every((tx) => deuxMois.has(ym(new Date(VENTES.find((v) => String(v.transaction_id) === tx).date)))), 'E1 les 12 ventes du mois en cours et du précédent passent les premières');
    const p = (f.ctx.__vrmPausesVues || []).filter((x) => x[0] === 'versement').map((x) => x[1]);
    dit(p.length === lus.length - 1 && p.every((ms) => ms >= 2000 && ms <= 5000) && new Set(p).size > 1, 'E1 une pause aléatoire de 2 à 5 s entre deux détails', JSON.stringify(p.slice(0, 6)));
    dit(f.j.vinted.every((x) => x.methode === 'GET') && f.j.maxEnVol === 1, 'E1 des GET, une requête à la fois');
  });

  await essaie('E2', async () => {
    const f = fond({ store: autresRien() });
    for (let i = 0; i < 3; i++) { Object.assign(f.store, autresRien()); await f.ctx.capterDatesVersement(UID); }
    const n = txLus(f.j).length;
    dit(n === 20 && lect(f.store) === 20, 'E2 trois visites dans l’heure : 20 lectures en tout, le budget de LECTURE (20/h) jamais dépassé', `${n} lue(s), budget ${lect(f.store)}`);
    const g = fond({ store: Object.assign(autresRien(), { vrmLectures: { [UID]: Array.from({ length: 12 }, () => Date.now()) } }) });
    await g.ctx.capterDatesVersement(UID);
    dit(txLus(g.j).length === 8 && lect(g.store) === 20, 'E2 12 lectures déjà faites (photos, relecture…) : 8 de plus, le total reste 20', `${txLus(g.j).length} lue(s), total ${lect(g.store)}`);
  });

  await essaie('E3', async () => {
    const f = fond({ store: {} });                  // autres lecteurs : pas su ⇒ réserve entière
    await f.ctx.tickVersements();
    await f.ctx.tickVersements();
    dit(txLus(f.j).length === 12, 'E3 codes, preuves, relevés « pas su » : le fond s’arrête à 12 (20 − 8 gardées pour eux)', `${txLus(f.j).length} lue(s)`);
    const g = fond({ store: {} });
    await g.ctx.capterDatesVersement(UID);
    dit(txLus(g.j).length === 12, 'E3 une visite aussi : au-delà de sa part ordinaire, jamais la place des autres', `${txLus(g.j).length} lue(s)`);
  });

  await essaie('E4', async () => {
    let n = 0;
    const f = fond({ store: autresRien(), vinted: vintedAvec(() => (++n === 3 ? 429 : 200)) });
    await f.ctx.capterDatesVersement(UID);
    dit(txLus(f.j).length === 3, 'E4 un 429 au 3e détail : la série s’arrête net', `${txLus(f.j).length} lu(s)`);
    const p = f.store.vrmPauseVinted;
    dit(!!p && p.statut === 429, 'E4 la pause est posée', JSON.stringify(p));
    const avant = f.j.vinted.length;
    await f.ctx.capterDatesVersement(UID); await f.ctx.tickVersements();
    dit(f.j.vinted.length === avant, 'E4 pendant la pause : plus rien (visite ni fond)', `${f.j.vinted.length - avant} requête(s)`);
  });

  await essaie('E5', async () => {
    const f = fond({ store: autresRien() });
    f.ctx.compteConnecte = async () => '222';
    await f.ctx.capterDatesVersement(UID); await f.ctx.tickVersements();
    dit(txLus(f.j).length === 0, 'E5 un autre compte connecté dans l’onglet : rien', `${txLus(f.j).length} lu(s)`);
  });

  await essaie('E6', async () => {
    const f = fond({ store: autresRien(), lectureKO: (u) => /orders_sold/.test(u) });
    await f.ctx.capterDatesVersement(UID);
    dit(f.j.vinted.length === 0, 'E6 la liste des ventes illisible (base muette) : AUCUNE requête Vinted', `${f.j.vinted.length} requête(s)`);
    const g = fond({ store: autresRien(), lectureKO: (u) => /_txn_/.test(decodeURIComponent(u)) });
    await g.ctx.capterDatesVersement(UID);
    dit(g.j.vinted.length === 0, 'E6 les détails rangés illisibles : rien ne part (sinon tout l’historique serait relu)', `${g.j.vinted.length} requête(s)`);
  });

  await essaie('E7', async () => {
    const t230 = String(parDate[0].transaction_id);
    const f = fond({ store: autresRien(), vinted: vintedAvec(null, (tx) => (tx === t230 ? 230 : 450)) });
    await f.ctx.capterDatesVersement(UID);
    const row = f.lignes[`harvest_${UID}_txn_${t230}`];
    const t = row && row.payload && row.payload.transaction;
    dit(!!t && String(t.status) === '230' && f.j.diags.includes('versement_statut_230'), 'E7 un détail encore à 230 : rangé tel que Vinted le dit, PAS daté', JSON.stringify(t && { s: t.status }));
    const d = ((f.store.vrmLecturesDues || {})[UID] || {}).versement;
    dit(!!d && d.nonDatees === 60 - 19, 'E7 il reste compté parmi les ventes sans date (60 − 19 datées), aucune date inventée', JSON.stringify(d));
  });

  await essaie('E8', async () => {
    // SON geste : le relevé courant (mois listés), puis UN mois passé ouvert par LUI ⇒ la recette.
    const f = faireFond({ src: SRC, lignes: {}, vinted: vintedMois(), store: (() => { const at = Date.now(); return { vrmLecturesDues: { [UID]: { preuve: { reste: 0, at }, retrait: { reste: 0, at }, versement: { reste: 0, at, nonDatees: 0 } } } }; })() });
    f.ctx.__vrmPausesVues = [];
    await f.ctx.storeHarvest('www.vinted.fr', 'billing', null, JSON.stringify(releveDu('2026-11', [], { history: [{ year: 2026, month: 9 }, { year: 2026, month: 7 }] })), 'https://www.vinted.fr/api/v2/wallet/invoices/current');
    await f.ctx.storeHarvest('www.vinted.fr', 'billing', null, JSON.stringify(releveDu('2026-07', [ligneR({ date: '2026-07-10T10:00:00.000Z', transaction_id: 8900007 })])), MOIS_URL(2026, 7));
    await f.ctx.capterReleves(UID);
    const lusMois = f.j.vinted.filter((x) => /\/wallet\/invoices\/2026\/09$/.test(x.chemin)).length;
    const row = f.lignes[`harvest_${UID}_releve_2026-09`];
    const L = row && Array.isArray(row.lignes) ? row.lignes : [];
    dit(lusMois === 1 && L.filter((x) => x.tx).length === 30, 'E8 UNE lecture du relevé de septembre range 30 ventes (chacune par SON n° de transaction)', `${lusMois} lecture(s), ${L.filter((x) => x.tx).length} n°`);
    const R = await import(pathToFileURL(path.join(RACINE, 'src', 'versementReleve.js')).href);
    const txn = Array.from({ length: 5 }, (_, i) => ({ tx: String(8800000 + i), s: '450', su: SEPT[i].date }));   // 5 accords, le même jour (Paris)
    const carte = typeof R.versementsDuReleveVerifies === 'function' ? R.versementsDuReleveVerifies([{ id: `harvest_${UID}_releve_2026-09`, l: L }], txn) : null;
    dit(!!carte && Object.keys(carte).length === 30, 'E8 vérifié (5 accords avec le détail 450, aucun désaccord) : les 30 sont datées d’un coup par la règle de l’app', String(carte && Object.keys(carte).length));
    const carte4 = typeof R.versementsDuReleveVerifies === 'function' ? R.versementsDuReleveVerifies([{ id: `harvest_${UID}_releve_2026-09`, l: L }], txn.slice(0, 4)) : null;
    dit(!!carte4 && Object.keys(carte4).length === 0, 'E8 4 accords seulement : rien n’est daté par le relevé (« pas su » ne vaut pas « oui »)', String(carte4 && Object.keys(carte4).length));
    // Une forme inconnue : rien rangé, sa forme seule.
    const g = faireFond({ src: SRC, lignes: {}, vinted: vintedMois((cle) => (cle === '2026-09' ? { status: 200, body: { wallet: { truc: [{ a: 1 }] } } } : null)), store: f.store.vrmLecturesDues ? { vrmLecturesDues: JSON.parse(JSON.stringify(f.store.vrmLecturesDues)) } : {} });
    g.ctx.__vrmPausesVues = [];
    await g.ctx.storeHarvest('www.vinted.fr', 'billing', null, JSON.stringify(releveDu('2026-11', [], { history: [{ year: 2026, month: 9 }] })), 'https://www.vinted.fr/api/v2/wallet/invoices/current');
    await g.ctx.storeHarvest('www.vinted.fr', 'billing', null, JSON.stringify(releveDu('2026-07', [])), MOIS_URL(2026, 7));
    await g.ctx.capterReleves(UID);
    const fr = g.lignes[`harvest_${UID}_forme_releve`];
    dit(!g.lignes[`harvest_${UID}_releve_2026-09`] && !!fr && !JSON.stringify(fr).includes('truc":[{"a":1'), 'E8 une forme inconnue : rien rangé pour ce mois, sa FORME seule (`forme_releve`)', JSON.stringify(fr).slice(0, 160));
  });

  await essaie('E9', async () => {
    const f = fond({ store: autresRien() });
    f.ctx.compteConnecte = async () => UID;
    await f.ctx.capterDatesVersement(UID);
    const e = await f.ctx.etatSite('https://www.vinted.fr/member/1', 7);
    const dt = e && e.site && e.site.dates;
    const ext = Number((/const VERSEMENT_PAR_HEURE_ESTIME = (\d+);/.exec(fs.readFileSync(SRC, 'utf8')) || [])[1]);
    const app = Number((/export const VERSEMENTS_PAR_HEURE = (\d+);/.exec(lire('src/versementRaisons.js')) || [])[1]);
    dit(ext === 18 && app === 18, 'E9 le même rythme des deux côtés : 18 par heure (l’argent a tout le budget de lecture, 2 de marge pour les autres)', `extension ${ext}, app ${app}`);
    dit(!!dt && dt.reste === 40 && dt.heures === Math.ceil(40 / 18), 'E9 la carte du logo : « 40 restantes · environ 3 h avec Vinted ouvert »', JSON.stringify(dt));
    const badge = sansCommentaires(fs.readFileSync(path.join(path.dirname(SRC), 'vrm-badge.js'), 'utf8'));
    dit(!/Porte-monnaie → Historique/.test(badge) && /l'extension les récupère/.test(badge), 'E9 la carte ne demande aucun geste (plus « ouvre Porte-monnaie → Historique »)');
  });

  // ── L'ÉCRAN ────────────────────────────────────────────────────────────────
  await essaie('A1', async () => {
    const V = await import(pathToFileURL(path.join(RACINE, 'src', 'versementRaisons.js')).href);
    const f = V.ligneDatesVersement;
    dit(typeof f === 'function', 'A1 `ligneDatesVersement` existe (la ligne discrète, une seule règle)');
    if (typeof f !== 'function') return;
    dit(f(null) === null && f(undefined) === null && f({ n: 0 }) === null && f({}) === null, 'A1 tout daté, ou pas su : rien à dire (aucune ligne)');
    const L = f({ n: 1741, raisons: [{ cle: 'vinted-detail', n: 1732 }, { cle: 'leboncoin', n: 9 }] });
    dit(!!L && L.n === 1741 && L.heures === Math.ceil(1732 / 18), 'A1 1 741 sans date dont 1 732 lues par l’extension : « ≈ 1 741 restantes · environ 97 h »', JSON.stringify(L));
    const L2 = f({ n: 4, raisons: [{ cle: 'leboncoin', n: 4 }] });
    dit(!!L2 && L2.n === 4 && L2.heures === 0, 'A1 rien à lire sur Vinted : la ligne sans délai', JSON.stringify(L2));
  });

  await essaie('A2', async () => {
    const K = await import(pathToFileURL(path.join(RACINE, 'src', 'design', 'carteChiffres.js')).href);
    const a = K.raisonCourte({ valeur: 120, aDater: 1741, partiel: false });
    const b = K.raisonCourte({ valeur: null, raison: 'a-dater', aDater: 1741 });
    dit(a === 'au moins', 'A2 un montant qui laisse des ventes sans date : « au moins » (jamais « + 1 741 ventes à dater »)', a);
    dit(!!b && !/\d/.test(b) && !/dater/i.test(b), 'A2 rien de daté : « — » avec « dates en lecture », sans nombre ni geste', b);
  });

  await essaie('A3', async () => {
    const ECRANS = ['src/ecrans/Compta.jsx', 'src/design/carteChiffres.js', 'src/design/CarteStats.jsx', 'src/argent.js', 'src/aTrancher.js', 'src/santeDonnees.js',
      'src/controleNuit.js', 'src/VeilleJournee.jsx', 'src/MoisBoucle.jsx', 'src/ClotureAnnee.jsx', 'src/fichePaire.js', 'src/Dac7Comptes.jsx'];
    const INTERDIT = /à dater|À dater|Les dater|La dater|Dater à la main|data-urssaf-dater|data-adater-geste|data-dater-lbc|tr\('compta\.dater|compta\.daterMain|compta\.metsExtensionJour|'ventes-a-dater'|'versement-30j'/;
    const fautes = [];
    for (const f of ECRANS) { const s = sansCommentaires(lire(f)); const m = INTERDIT.exec(s); if (m) fautes.push(`${f} : « ${m[0]} »`); }
    dit(!fautes.length, 'A3 plus aucun « à dater » ni geste de datation dans Argent, Ma journée, À trancher, Santé, contrôle de nuit', fautes.join(' · '));
    const C = await import(pathToFileURL(path.join(RACINE, 'src', 'controleNuit.js')).href);
    const T = await import(pathToFileURL(path.join(RACINE, 'src', 'aTrancher.js')).href);
    dit(!C.CLES_CONTROLES.includes('versement-30j') && !T.CLES_SOURCES.includes('ventes-a-dater'), 'A3 ni contrôle de nuit ni « chose à trancher » pour les ventes sans date', `${C.CLES_CONTROLES} | ${T.CLES_SOURCES}`);
    const compta = sansCommentaires(lire('src/ecrans/Compta.jsx'));
    dit(/<LigneDatesVersement\b/.test(compta) && !/function DaterVentesLbc|function ADaterRaisons/.test(compta), 'A3 « Déclarer » et « Vendu et reçu » montrent la ligne discrète ; plus de saisie de date Leboncoin, plus de carte des raisons');
  });

  await essaie('A4', async () => {
    const avant = Math.ceil(1741 / 12), apres = Math.ceil(1741 / 18);
    dit(apres < avant, `A4 1 741 ventes : environ ${avant} h de vinted.fr ouvert avant (12/h, 10 par visite), environ ${apres} h après (18/h, 20 par visite)`);
  });
}

async function lancer(SRC) {
  let ko = 0, ok = 0;
  await controles(SRC, (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + String(det).slice(0, 300) : ''}`); } });
  return { ko, ok };
}

// Les mutations de l'extension (le fichier passé par --src) ; celles de l'app se jouent
// sur une copie de `src/` (la règle réaffaiblie ⇒ rouge).
const MUTATIONS = [
  ['20 par visite → 10', 'const VERSEMENT_MAX_PAR_VISITE = 20;', 'const VERSEMENT_MAX_PAR_VISITE = 10;'],
  ['budget de lecture 20 → 40 (tous lecteurs)', 'const LECTURES_MAX_HEURE = 20;', 'const LECTURES_MAX_HEURE = 40;'],
  ['la plus ancienne d’abord', 'return (b[2] - a[2]) || (a[1] - b[1]);', 'return (a[2] - b[2]) || (a[1] - b[1]);'],
  ['réserve des autres ignorée', "const plafond = rattrapage ? LECTURES_MAX_HEURE - (await reserveAutresQueVersement(uid)) : LECTURES_MAX_HEURE;", 'const plafond = LECTURES_MAX_HEURE;'],
  ['garde du compte retirée', "const refus = await gardeLecture(uid, acc, 'argent', plafond);", 'const refus = null;'],
  ['« pas su » ⇒ on lit quand même', 'const det = await sbGetTout(`app_data?id=like.harvest_${uid}_txn_*&select=id,s:meta->>status,su:meta->>status_updated_at`);', 'const det = (await sbGetTout(`app_data?id=like.harvest_${uid}_txn_*&select=id,s:meta->>status,su:meta->>status_updated_at`)) || [];'],
  ['230 daté', "if (String(t.status) === '450' && t.status_updated_at) { ecrites++;", "if (t.status_updated_at) { ecrites++;"],
  ['rythme de la carte ≠ app', 'const VERSEMENT_PAR_HEURE_ESTIME = 18;', 'const VERSEMENT_PAR_HEURE_ESTIME = 12;'],
];
const MUTATIONS_APP = [
  ['ligne : tout daté ⇒ quand même une ligne', 'src/versementRaisons.js', 'if (!(n > 0)) return null;', 'if (!(n > 0)) return { n: 0, heures: 0 };'],
  ['« + N ventes à dater » remis', 'src/design/carteChiffres.js', "if (x.valeur != null) return x.aDater > 0 || x.partiel ? 'au moins' : '';", "if (x.valeur != null) return x.aDater > 0 ? `+ ${x.aDater} ventes à dater` : x.partiel ? 'au moins' : '';"],
];

(async () => {
  const SRC = cheminSource();
  const r = await lancer(SRC);
  console.log(r.ko ? `\n❌ versements auto : ${r.ok} vert(s), ${r.ko} rouge(s)` : `\n✅ versements auto : ${r.ok} vert(s), 0 rouge(s)`);
  let koMut = 0;
  if (process.argv.includes('--mutations')) {
    const texte = fs.readFileSync(SRC, 'utf8');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-mut-vauto-'));
    fs.copyFileSync(path.join(path.dirname(SRC), 'vrm-badge.js'), path.join(dir, 'vrm-badge.js'));
    const { execFileSync } = require('child_process');
    // Chaque mutation dans un processus à part (le vrai background.js pèse : plusieurs `vm` dans un
    // seul processus manquent de mémoire).
    for (const [nom, de, vers] of MUTATIONS) {
      if (!texte.includes(de)) { koMut++; console.log(`❌ mutation « ${nom} » : la ligne est introuvable — le contrôle ne prouve rien`); continue; }
      const f = path.join(dir, 'background.js');
      fs.writeFileSync(f, texte.replace(de, vers));
      let rouge = false;
      try { execFileSync(process.execPath, [__filename, '--src', f], { stdio: 'pipe', timeout: 300000 }); } catch (_) { rouge = true; }
      if (rouge) console.log(`✅ mutation « ${nom} » : rouge — le contrôle mord`);
      else { koMut++; console.log(`❌ mutation « ${nom} » : tout reste vert`); }
    }
    // L'app : la mutation est écrite en place puis RESTAURÉE (le module est rechargé par un sous-processus).
    for (const [nom, fichier, de, vers] of MUTATIONS_APP) {
      const p = path.join(RACINE, fichier), avant = fs.readFileSync(p, 'utf8');
      if (!avant.includes(de)) { koMut++; console.log(`❌ mutation « ${nom} » : la ligne est introuvable`); continue; }
      fs.writeFileSync(p, avant.replace(de, vers));
      let rouge = false;
      try { execFileSync(process.execPath, [__filename, '--src', SRC], { stdio: 'pipe' }); } catch (_) { rouge = true; }
      finally { fs.writeFileSync(p, avant); }
      if (rouge) console.log(`✅ mutation « ${nom} » : rouge — le contrôle mord`);
      else { koMut++; console.log(`❌ mutation « ${nom} » : tout reste vert`); }
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
  process.exit(r.ko || koMut ? 1 : 0);
})();
