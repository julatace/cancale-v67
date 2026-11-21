// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DES IDÉES DU 14 NOV. (154, 157, 158) — il EXÉCUTE les règles, sur des
//  données INVENTÉES (le dépôt est public). Lecture seule.
//
//  H · 154 la ligne de temps (src/paireHistoire/ligneDeTemps.js, sur la VRAIE chaîne
//      `toutSurLeNumero` → `histoireArticle`) :
//      H1 50 paires IDENTIQUES (même titre, même prix, même taille) : chaque ligne de
//         temps ne porte QUE les événements de SA paire (ses annonces, SA vente, SON
//         colis, SON versement) — aucun attribué par ressemblance ;
//      H2 « pas su » ne s'invente pas : une source pas lue est NOMMÉE, un événement
//         prouvé sans date va dans « date inconnue », jamais daté ; un achat NON relié
//         n'a pas de « reçue » ;
//      H3 l'ordre des dates ; H4 baisse / hausse datées ; H5 la date de Vinted d'ABORD ;
//      H6 un compte exclu n'apporte rien ; H7 tout pas lu ⇒ rien d'inventé, rien ne casse ;
//      H8 N° porté par deux paires ⇒ AUCUN événement (deux histoires ne se mélangent pas) ;
//      H9 une vente annulée, une vente Leboncoin sans date.
//  D · 157 l'autre taille (src/autreTaille/autreTaille.js + `dupliquerFiche` + le VRAI
//      `prochainLibre` d'App.jsx) : N° NEUF après le plus haut de TOUS les N° servis
//      (cases du Stock et achats hors plateforme compris), taille changée là où elle
//      est marquée seulement, ancienne étiquette retirée, autre N° signalé ; série à lettre ;
//      N° en double ⇒ pas de copie ; « Je numérote moi-même » ⇒ aucun N° donné.
//  T · 158 la meilleure heure (src/meilleureHeure/meilleureHeure.js sur `quandTuVends`) :
//      la case la plus forte, la couverture, « pas assez », « rien ne se détache »,
//      les ventes sans heure hors des cases, les comptes écartés hors (les lignes de
//      Statistiques), lecture en cours / ratée / partielle, jamais un lancement.
//  B · les branchements (fiche, Annonces, atelier Republier) et la lecture du studio
//      en projection scalaire (jamais `select=data`).
//
//  `--src <dossier>` : les règles d'un autre arbre (le code d'avant : il doit rougir).
//  `--prouve` : chaque MUTATION (une règle réaffaiblie) doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const iS = process.argv.indexOf('--src');
const RACINE = iS > 0 ? path.resolve(process.argv[iS + 1]) : path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
let ko = 0, ok = 0;
const dit = (c, nom, det) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${nom}${c || det === undefined ? '' : ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 500)}`); };
const imp = (rel) => import(pathToFileURL(path.join(RACINE, 'src', rel)).href);

// ── LES MUTATIONS (--prouve) : [fichier, avant, après, ce qui doit rougir] ───────
const MUTATIONS = [
  ['src/paireHistoire/ligneDeTemps.js', "const c = id && x.crees ? ms(x.crees[id]) : null;", "const c = x.crees ? ms(Object.values(x.crees)[0]) : null;", 'H1/H5 : la date de mise en ligne d’une AUTRE paire (ressemblance)'],
  ['src/paireHistoire/ligneDeTemps.js', "if (relie && x.reception && ms(x.reception.ms) != null)", "if (x.reception && ms(x.reception.ms) != null)", 'H2 : « reçue » sur un achat pas relié'],
  ['src/paireHistoire/ligneDeTemps.js', "const pose = (e) => evs.push({ site: '', montant: null, avant: null, preuve: '', id: '', ...e, at: isoDe(e.at) });", "const pose = (e) => evs.push({ site: '', montant: null, avant: null, preuve: '', id: '', ...e, at: isoDe(e.at) || new Date().toISOString() });", 'H2 : une date inventée pour un événement sans date'],
  ['src/paireHistoire/ligneDeTemps.js', "if (x.studio === null) pasSu.push('studio');", "if (x.studio === null) {}", 'H2 : le studio pas lu n’est plus nommé'],
  ['src/paireHistoire/ligneDeTemps.js', "quoi: a == null || b == null || a === b ? 'prix' : b < a ? 'baisse' : 'hausse'", "quoi: 'baisse'", 'H4 : une hausse dite baisse'],
  ['src/histoireArticle.js', ".filter((x) => x && idsSet.has(str(x.item)) && Number.isFinite(Number(x.apres)))", ".filter((x) => x && Number.isFinite(Number(x.apres)))", 'H1 : les prix de toutes les paires (ressemblance)'],
  ['src/autreTaille/autreTaille.js', "const re = new RegExp(`(^|[^0-9A-Za-zÀ-ÿ])(${MARQUE_TAILLE}\\\\s?:?\\\\s?)${esc(a)}${apres}`, 'gi');", "const re = new RegExp(`(^|[^0-9A-Za-zÀ-ÿ])()${esc(a)}${apres}`, 'gi');", 'D1 : un « 42 » nu remplacé'],
  ['src/dupliquerFiche.js', "const numero = String(prochainLibre(int, cles, pref));", "const numero = String(prochainLibre(new Set(), new Set(), pref));", 'D3 : un ancien N° redonné'],
  ['src/App.jsx', "  const ns = await numerosServisLus();\n  if (!ns) return { ok: false, raison: 'numéros réservés pas lus' };\n  const pris = ns.int, prisK = ns.cles;", "  const pris = new Set(), prisK = new Set();", 'D3 : dupliquer sans la liste complète des N° servis'],
  ['src/paireHistoire/ligneDeTemps.js', "if (h.double) return { double: true, evenements: [], sansDate: [], pasSu: [] };", "", 'H8 : deux paires sous un N° mêlées en une histoire'],
  ['src/App.jsx', "outilsIdees={p && !p.ancienNumero && !p.double ?", "outilsIdees={p && !p.ancienNumero ?", 'D6 : copier une paire d’un N° en double'],
  ['src/App.jsx', "onCreerTaille={async (champs) => { if (numeroEcritActif()) return { ok: false, raison: tr('at.raison.numeroEcrit') };", "onCreerTaille={async (champs) => {", 'D6 : un N° donné alors qu’il numérote lui-même'],
  ['src/RepubProgramme.jsx', "useMeilleureHeure(!ls || ls.venduEnAttente ? undefined :", "useMeilleureHeure(!ls ? undefined :", 'T8 : une suggestion sur une lecture en cours'],
  ['src/meilleureHeure/meilleureHeure.js', "if (n < seuil) return { etat: 'peu', n, sansHeure, seuil };", "if (n < 1) return { etat: 'peu', n, sansHeure, seuil };", 'T2 : « dimanche 18 h » sur 20 ventes'],
  ['src/meilleureHeure/meilleureHeure.js', "if (best.n < MIN_CASE || best.n < FACTEUR * moyenne) return { etat: 'plat', n, sansHeure, seuil };", "", 'T3 : une case tirée d’un hasard'],
  ['src/statsVentes.js', "else { heures[d.getHours()].n += 1; grille[j][d.getHours()] += 1; }", "else heures[d.getHours()].n += 1;\n    grille[j][d.getHours()] += 1;", 'T4 : les ventes sans heure dans « 0 h »'],
];

function prouver() {
  let rouges = 0;
  for (const [f, a, b, quoi] of MUTATIONS) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'idees-mut-'));
    fs.cpSync(path.join(RACINE, 'src'), path.join(tmp, 'src'), { recursive: true });
    try { fs.symlinkSync(path.join(RACINE, 'package.json'), path.join(tmp, 'package.json')); } catch (_) {}
    const p = path.join(tmp, f);
    const s = fs.readFileSync(p, 'utf8');
    if (!s.includes(a)) { console.log(`❌ mutation introuvable (${f}) : ${quoi}`); rouges = -999; continue; }
    fs.writeFileSync(p, s.replace(a, b));
    const r = spawnSync(process.execPath, [__filename, '--src', tmp], { encoding: 'utf8' });
    const rouge = r.status !== 0;
    console.log(`${rouge ? '✅' : '❌'} mutation « ${quoi} » ⇒ ${rouge ? 'ROUGE' : 'reste vert'}${rouge ? ' (' + (r.stdout.split('\n').filter((l) => l.startsWith('❌')).slice(0, 2).join(' | ').slice(0, 220)) + ')' : ''}`);
    if (rouge) rouges++;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const tous = rouges === MUTATIONS.length;
  console.log(`\n${tous ? '✅ --prouve : les ' + MUTATIONS.length + ' mutations rougissent' : '❌ --prouve : une mutation ne rougit pas'}`);
  process.exit(tous ? 0 : 1);
}
if (PROUVE) prouver();

(async () => {
  let L, H, RN, AT, DF, MH, SV, NE;
  try {
    [L, H, RN, AT, DF, MH, SV, NE] = await Promise.all(['paireHistoire/ligneDeTemps.js', 'histoireArticle.js', 'rechercheNumero.js',
      'autreTaille/autreTaille.js', 'dupliquerFiche.js', 'meilleureHeure/meilleureHeure.js', 'statsVentes.js', 'numeroEcrit.js'].map(imp));
  } catch (e) { dit(false, 'C0 · les règles des idées 154, 157, 158 existent', e.message); console.log(`\n❌ audit-idees-paires : ${ko} rouge(s)`); process.exit(1); }
  const cleNum = NE.cleNumero;
  const J = 86400e3, T0 = Date.parse('2026-09-01T10:00:00Z');
  const isoJ = (j, h = 0) => new Date(T0 + j * J + h * 3600e3).toISOString();

  // ════════ H · LA LIGNE DE TEMPS ════════════════════════════════════════════
  const TITRE = 'Nike Dunk Low Panda 42';
  const N = 50, item = (k) => String(9000000 + k), tx = (k) => String(7000000 + k);
  const fiches = {}, coffres = {}, crees = {}, prixVinted = [];
  for (let k = 1; k <= N; k++) {
    fiches[item(k)] = { numero: String(k), title: TITRE, price: '80', numberedAt: isoJ(k), auto: true, buyPrice: '40', taille: '42',
      ...(k === 7 ? { buyFrom: { title: TITRE, seller: 'vendeur_x', date: isoJ(1) }, buyFromId: '5550007' } : {}) };
    coffres[item(k)] = { firstSavedAt: isoJ(k + 2) };
    crees[item(k)] = T0 + (k + 1) * J;
    prixVinted.push({ item: item(k), avant: 90, apres: 80, at: isoJ(k + 5) });
  }
  prixVinted.push({ item: item(7), avant: 80, apres: 85, at: isoJ(30) });   // une hausse, pour N°7 seulement
  const VENTE7 = { transaction_id: tx(7), title: TITRE, price: { amount: '85', currency_code: 'EUR' }, status: 'Commande finalisée', date: isoJ(40) };
  const VENTE_SOEUR = { transaction_id: '7999999', title: TITRE, price: { amount: '85', currency_code: 'EUR' }, status: 'Commande finalisée', date: isoJ(41) };   // même titre, AUCUN lien (pas de txnItem)
  const D = { fiches, pool: Array.from({ length: N }, (_, i) => String(i + 1)), enLigne: new Set(Object.keys(fiches).filter((id) => id !== item(7))), ventes: [VENTE7, VENTE_SOEUR],
    txnItem: { [tx(7)]: item(7) }, saleOv: {}, bordereaux: [{ tx: tx(7), pdf: true }], imprimes: {}, postes: { [tx(7)]: true }, ebayCommandes: [], ebayAnnonces: [], lbcVentes: [], plan: { items: [] } };
  const oRN = { cleNum, ouStock: () => null, expediee: () => true, aPoster: () => false, revenue: () => false, conflits: () => [] };
  const colisVente = { [tx(7)]: { bord: { at: isoJ(41), suivi: 'XY123456789FR' }, depose: isoJ(42), suivis: [{ status: 'available', at: isoJ(44) }, { status: 'delivered', at: isoJ(45) }] } };
  const dH = (k) => ({ fiches, saleOv: {}, buyByNum: {}, stats: {}, versements: { [tx(7)]: isoJ(48) }, nomCompte: () => 'boutique_test', coffres, offres: [], recus: new Set(['5550007']),
    autresEnLigne: [], colisVente, journalPrix: [], prixVinted, prixLus: null, sortieStock: null });
  const oH = { etapeVente: (v) => ({ label: 'Commande finalisée', step: v && String(v.transaction_id) === tx(7) ? 4 : 0 }), venteAnnulee: () => false, montantRecuEbay: () => ({ eur: null }), commandeEbayEngagee: () => true, lbcAnnulee: () => false, lbcFinalisee: () => false };
  const lignes = {};
  let h1 = [], erreurH = '';
  try {
    for (let k = 1; k <= N; k++) {
      const rn = RN.toutSurLeNumero(String(k), D, oRN);
      const h = H.histoireArticle(rn, dH(k), oH);
      lignes[k] = L.ligneDeTemps(h, { reception: k === 7 ? { ms: T0 + 3 * J, source: 'livraison' } : null, crees, studio: k === 7 ? { dates: [isoJ(4), isoJ(4, 1)] } : { dates: [] } });
      const lt = lignes[k];
      const tous = [...lt.evenements, ...lt.sansDate];
      const idsAutres = tous.filter((e) => { const m = /annonce (\d+)/.exec(e.preuve || ''); return (e.id && e.quoi !== 'vendue' && e.id !== item(k)) || (m && m[1] !== item(k)); });
      const ventes = tous.filter((e) => e.quoi === 'vendue');
      const colis = tous.filter((e) => ['bordereau', 'partie', 'relais', 'livree', 'versement'].includes(e.quoi));
      const pub = tous.filter((e) => e.quoi === 'publiee');
      const bad = [];
      if (idsAutres.length) bad.push(`N°${k} porte ${idsAutres.length} événement(s) d’une autre paire`);
      if (k === 7 ? !(ventes.length === 1 && ventes[0].id === tx(7)) : ventes.length) bad.push(`N°${k} : ventes ${JSON.stringify(ventes.map((v) => v.id))}`);
      if (k === 7 ? colis.length !== 5 : colis.length) bad.push(`N°${k} : colis/versement ${colis.map((e) => e.quoi).join(',')}`);
      if (pub.length !== 1 || pub[0].at !== new Date(crees[item(k)]).toISOString()) bad.push(`N°${k} : publiée ${JSON.stringify(pub)}`);
      if (k !== 7 && tous.some((e) => e.quoi === 'photographiee' || e.quoi === 'recue' || e.quoi === 'achetee' && e.preuve !== 'prix saisi')) bad.push(`N°${k} : achat/photo/réception d’une autre`);
      if (bad.length) h1.push(...bad);
    }
  } catch (e) { erreurH = e.stack || String(e); }
  dit(!erreurH && h1.length === 0, 'H1 · 50 paires identiques : chaque ligne de temps ne porte que SA paire (annonce, vente, colis, versement par identité)', erreurH || h1.slice(0, 4));
  const l7 = lignes[7], l8 = lignes[8];
  dit(!!l7 && ['achetee', 'recue', 'numerotee', 'photographiee', 'publiee', 'baisse', 'hausse', 'vendue', 'bordereau', 'partie', 'relais', 'livree', 'versement'].every((q) => l7.evenements.some((e) => e.quoi === q)),
    'H1b · N°7 : achetée, reçue, numérotée, photographiée, publiée, baisse, hausse, vendue, bordereau, partie, relais, livrée, versement — tous datés', l7 && l7.evenements.map((e) => e.quoi));
  dit(!!l8 && !l8.evenements.some((e) => ['vendue', 'bordereau', 'versement', 'recue'].includes(e.quoi)), 'H1c · N°8 (même titre, même prix) : ni vente, ni colis, ni versement, ni réception', l8 && l8.evenements.map((e) => e.quoi));
  // H2 — pas su
  {
    const rn = RN.toutSurLeNumero('7', D, oRN), h = H.histoireArticle(rn, dH(7), oH);
    const a = L.ligneDeTemps(h, { reception: undefined, crees: null, studio: null });
    const sansDate = L.ligneDeTemps({ num: '1', etapes: [{ cle: 'annonces', etat: 'fait', evenements: [{ at: null, texte: 'Sur Vinted', preuve: 'annonce 1', cle: 'en-ligne' }, { at: null, texte: 'En ligne sur Leboncoin', preuve: 'référence VRM', cle: 'leboncoin' }] }] }, {});
    const nonRelie = L.ligneDeTemps(H.histoireArticle(RN.toutSurLeNumero('8', D, oRN), dH(8), oH), { reception: { ms: T0, source: 'clic' } });
    dit(a.pasSu.includes('recue') && a.pasSu.includes('studio') && a.pasSu.includes('crees') && !a.evenements.some((e) => e.quoi === 'recue' || e.quoi === 'photographiee'),
      'H2a · réception, studio, dates Vinted pas lus ⇒ NOMMÉS, rien d’inventé', a.pasSu);
    dit(sansDate.evenements.length === 0 && sansDate.sansDate.length === 2 && sansDate.sansDate.every((e) => e.at === null), 'H2b · prouvé sans date ⇒ « date inconnue », jamais daté', sansDate);
    dit(!nonRelie.evenements.some((e) => e.quoi === 'recue'), 'H2c · achat pas relié ⇒ aucune « reçue »', nonRelie.evenements.map((e) => e.quoi));
    const passuEt = L.ligneDeTemps({ num: '3', etapes: [{ cle: 'vente', etat: 'passu', evenements: [], detail: 'tes ventes pas toutes lues' }] }, {});
    dit(passuEt.evenements.length === 0 && passuEt.pasSu.includes('tes ventes pas toutes lues'), 'H2d · une étape pas lue ne s’affiche pas : elle est nommée', passuEt);
  }
  // H3 — l'ordre ; H4 — baisse/hausse ; H5 — Vinted d'abord, sinon « vue en ligne »
  {
    const ev = (l7 && l7.evenements) || [];
    dit(ev.length > 5 && ev.every((e, i) => i === 0 || Date.parse(ev[i - 1].at) <= Date.parse(e.at)), 'H3 · du plus ancien au plus récent', ev.map((e) => e.at));
    const b = ev.find((e) => e.quoi === 'baisse'), hh = ev.find((e) => e.quoi === 'hausse');
    dit(!!b && b.avant === 90 && b.montant === 80 && !!hh && hh.avant === 80 && hh.montant === 85, 'H4 · 90 → 80 baisse, 80 → 85 hausse, datées', { b, hh });
    const sansCree = L.ligneDeTemps(H.histoireArticle(RN.toutSurLeNumero('9', D, oRN), dH(9), oH), { crees: {} });
    const v = sansCree.evenements.find((e) => e.quoi === 'vueEnLigne');
    dit(!!v && v.at === new Date(Date.parse(coffres[item(9)].firstSavedAt)).toISOString() && !sansCree.evenements.some((e) => e.quoi === 'publiee'), 'H5 · sans date Vinted : « vue en ligne » (la 1re vue de VRM), jamais « publiée »', v);
  }
  // H6 — un compte exclu : sa fiche n'est pas lue par la recherche (`comptesOk`), elle n'apporte rien.
  {
    const fx = { ...fiches, [item(7)]: { ...fiches[item(7)], accountId: 'compte_exclu' } };
    const rn = RN.toutSurLeNumero('7', { ...D, fiches: fx, comptesOk: new Set(['compte_garde']) }, oRN);
    const lt = L.ligneDeTemps(H.histoireArticle(rn, { ...dH(7), fiches: fx }, oH), { crees, studio: { dates: [] } });
    const tous = [...lt.evenements, ...lt.sansDate];
    dit(!tous.some((e) => ['publiee', 'vueEnLigne', 'baisse', 'hausse', 'numerotee'].includes(e.quoi)), 'H6 · une annonce d’un compte exclu n’apporte aucun événement', tous.map((e) => e.quoi));
  }
  // H7 — rien de lu : aucun événement inventé, les manques nommés, rien ne casse.
  {
    let lt = null, err = '';
    try {
      const rn = RN.toutSurLeNumero('7', { fiches: null, pool: null, enLigne: null, ventes: null, txnItem: null, bordereaux: null, ebayCommandes: null, ebayAnnonces: null, lbcVentes: null, plan: null }, oRN);
      lt = L.ligneDeTemps(H.histoireArticle(rn, { fiches: null, stats: null, versements: null, coffres: null, offres: null, recus: null, colisVente: null, journalPrix: null, prixVinted: null, prixLus: null }, oH), { reception: undefined, crees: null, studio: null });
    } catch (e) { err = e.stack || String(e); }
    dit(!err && (lt === null || (lt.evenements.length === 0 && lt.sansDate.length === 0 && lt.pasSu.length > 0)), 'H7 · rien de lu ⇒ aucun événement inventé, les manques nommés, aucune erreur', err || lt);
  }
  // H8 — deux paires PRÉSENTES sous le même N° : pas une histoire mélangée.
  {
    const fx = { ...fiches, '9100060': { numero: '60', title: TITRE, price: '80', numberedAt: isoJ(3) }, '9200060': { numero: '60', title: TITRE, price: '80', numberedAt: isoJ(4) } };
    const Dd = { ...D, fiches: fx, enLigne: new Set([...D.enLigne, '9100060', '9200060']) };
    const rn = RN.toutSurLeNumero('60', Dd, { ...oRN, conflits: (m) => Object.values(m).filter((l) => l.length > 1) });
    const h = H.histoireArticle(rn, { ...dH(60), fiches: fx }, oH);
    const lt = L.ligneDeTemps(h, { crees: { '9100060': T0 + 3 * J, '9200060': T0 + 4 * J }, studio: { dates: [isoJ(5)] } });
    dit(rn.double === true && lt.double === true && lt.evenements.length === 0 && lt.sansDate.length === 0, 'H8 · N° porté par deux paires ⇒ AUCUN événement (deux histoires ne se mélangent pas)', lt);
  }
  // H9 — une vente annulée (retour), une vente Leboncoin sans date : jamais « vendue » datée à tort.
  {
    const ann = { transaction_id: '7000033', title: TITRE, price: { amount: '70', currency_code: 'EUR' }, status: 'Commande annulée', date: isoJ(50) };
    const Da = { ...D, ventes: [ann], txnItem: { '7000033': item(33) }, lbcVentes: [{ id: 'l33', itemId: 'lbc33', price: 7500, isSeller: true, txId: 't33' }] };
    const rn = RN.toutSurLeNumero('33', Da, { ...oRN, numLbc: (v) => (v.id === 'l33' ? '33' : null) });
    const lt = L.ligneDeTemps(H.histoireArticle(rn, dH(33), { ...oH, venteAnnulee: (v) => /annul/i.test(v.status || '') }), { crees, studio: { dates: [] } });
    const ventes = [...lt.evenements, ...lt.sansDate].filter((e) => e.quoi === 'vendue');
    dit(lt.evenements.some((e) => e.quoi === 'annulee' && e.at === isoJ(50)) && ventes.length === 1 && ventes[0].site === 'Leboncoin' && ventes[0].at === null,
      'H9 · vente annulée ⇒ « annulée » datée ; vente Leboncoin sans date ⇒ « date inconnue », jamais datée', { ev: lt.evenements.map((e) => e.quoi), sans: lt.sansDate });
  }



  // ════════ D · DANS UNE AUTRE TAILLE ══════════════════════════════════════════
  {
    const src = { titre: 'Nike Dunk Low Panda 42', marque: 'Nike', taille: '42', etat: 'Très bon état', description: 'Taille 42, semelle 42 cm.\nPortées 2 fois.\n\nN°12', prix: 80 };
    const c = AT.copieAutreTaille(src, { numeroOrigine: '12', nouvelle: '43' });
    dit(c.ok && c.champs.titre === 'Nike Dunk Low Panda 43' && c.champs.description === 'Taille 43, semelle 42 cm.\nPortées 2 fois.' && c.changes.titre === 1 && c.changes.description === 1 && c.etiquetteRetiree === 1 && !('numero' in c.champs),
      'D1 · taille changée là où elle est marquée (et en fin de titre) ; « 42 cm » intact ; l’étiquette N°12 retirée ; aucun N° choisi ici', c);
    const m = AT.copieAutreTaille({ ...src, description: 'Voir aussi N°99 en 44.' }, { numeroOrigine: '12', nouvelle: '43' });
    dit(m.ok && JSON.stringify(m.autresNumeros) === '["99"]', 'D2 · un autre N° au milieu du texte est SIGNALÉ, jamais effacé', m);
    dit(!AT.copieAutreTaille(src, { nouvelle: '42' }).ok && !AT.copieAutreTaille(src, { nouvelle: ' ' }).ok, 'D2b · même taille ou taille vide ⇒ refusé');
    // D3 — le N° neuf : `dupliquerFiche` + le VRAI `prochainLibre` d'App.jsx, sur TOUS les N° servis.
    const { sourceAppCode: sourceApp } = require(path.join(__dirname, '_source-app.cjs'));
    const APP = sourceApp(RACINE);
    let prochainLibre = null;
    try { const x = /const prochainLibre = \(prisInt, prisCles, pref\) => \{[\s\S]*?\n\};/.exec(APP); prochainLibre = x ? new Function(x[0] + '\nreturn prochainLibre;')() : null; } catch (_) { prochainLibre = null; }
    const pris = new Set([...Array.from({ length: 230 }, (_, i) => i + 1), 240]);   // 240 : écrit dans une case du Stock (`vrm_slots`)
    const prisK = new Set([...[...pris].map(String), 'B231', 'B500']);
    let d3 = null, err = '';
    try { d3 = DF.dupliquerFiche({ ...src, ...c.champs, buyPrice: '40', id: item(12), photos: ['x.jpg'] }, { pris: { int: pris, cles: prisK }, pref: '', prochainLibre, cleNum, id: 'n1' }); } catch (e) { err = e.message; }
    dit(!!d3 && d3.fiche.numero === '241' && !prisK.has(d3.fiche.numero) && d3.fiche.taille === '43' && Array.isArray(d3.fiche.photos) && !d3.fiche.photos.length && !('buyPrice' in d3.fiche) && !/B/.test(d3.fiche.numero),
      'D3 · N° NEUF après le plus haut de TOUS les N° servis (241 : ni un trou, ni 240 du carton, ni un B), nouvelle taille, aucune photo, aucune identité', err || d3);
    const corps = (/async function dupliquerNumero\(rn, extra, remplace = null\) \{[\s\S]*?\n\}/.exec(APP) || [''])[0];
    const servis = (/async function numerosServisLus\(\) \{[\s\S]*?\n\}/.exec(APP) || [''])[0];
    dit(/const ns = await numerosServisLus\(\);/.test(corps) && /pris: \{ int: pris, cles: prisK \}/.test(corps) && /vrm_slots/.test(servis) && /vinted_offvinted_buys/.test(servis) && /panel_num_reserves/.test(servis),
      'D3b · « Dupliquer » et « Dans une autre taille » lisent LA liste des N° servis (cases du Stock, achats hors plateforme, réservés relus)');
    dit(/\['taille', 'titre', 'description'\]\.filter\(\(k\) => typeof remplace\[k\] === 'string'\)/.test(corps), 'D4 · la feuille ne remplace que taille, titre, description (liste blanche)');
    let d5 = null; try { d5 = DF.dupliquerFiche({ ...c.champs }, { pris: { int: new Set([1, 2, 3]), cles: new Set(['C1', 'C2', 'C9', 'B10', '3']) }, pref: 'C', prochainLibre, cleNum, id: 'n2' }); } catch (e) { d5 = e.message; }
    dit(d5 && d5.fiche && d5.fiche.numero === 'C10', 'D5 · série à lettre : C10 après C9 (jamais B, jamais un trou)', d5);
    dit(/outilsIdees=\{p && !p\.ancienNumero && !p\.double \?/.test(APP) && /bloque=\{numeroEcritActif\(\) \? tr\('at\.raison\.numeroEcrit'\)/.test(APP)
      && /onCreerTaille=\{async \(champs\) => \{ if \(numeroEcritActif\(\)\) return \{ ok: false, raison: tr\('at\.raison\.numeroEcrit'\) \};/.test(APP),
      'D6 · N° porté par deux paires ⇒ pas de copie ; « Je numérote moi-même » ⇒ aucun N° donné (dit, refusé)');
    dit(!AT.copieAutreTaille(null, { nouvelle: '43' }).ok === false && AT.copieAutreTaille({}, { nouvelle: '43' }).ok && AT.copieAutreTaille({ taille: '42' }, { nouvelle: 'x'.repeat(21) }).raison === 'taille-longue', 'D7 · données manquantes : une copie sans texte ne casse pas ; taille trop longue refusée');
  }

  // ════════ T · LA MEILLEURE HEURE ═════════════════════════════════════════════
  {
    const maint = new Date(2026, 10, 14, 12, 0, 0).getTime();
    // Un dimanche de référence (heure locale), 18 h 30.
    const dim = (() => { const d = new Date(2026, 10, 8, 18, 30, 0); return d.getTime(); })();
    const v = (ts, extra = {}) => ({ plateforme: 'Vinted', ts, eur: 50, ...extra });
    const lignes = [];
    for (let i = 0; i < 60; i++) lignes.push(v(dim - (i % 20) * 7 * J));                                       // 60 le dimanche 18–21 h
    for (let i = 0; i < 140; i++) lignes.push(v(dim - (i % 40) * J - ((i * 5) % 11) * 3600e3 - 9 * 3600e3)); // le reste, réparti
    const Q = SV.quandTuVends(lignes, maint);
    const r = MH.meilleureHeure(Q);
    dit(r.etat === 'ok' && r.jour === 6 && r.debut === 18 && r.fin === 21 && r.n === 200 && r.nCase >= 60 && r.part === Math.round(r.nCase / 200 * 100),
      'T1 · la case la plus forte (dimanche 18–21 h), avec la couverture (sur 200 ventes datées à l’heure)', r);
    const peu = MH.meilleureHeure(SV.quandTuVends(lignes.slice(0, 20), maint));
    dit(peu.etat === 'peu' && peu.n === 20 && peu.seuil === MH.SEUIL_VENTES && MH.SEUIL_VENTES === 30, 'T2 · sous 30 ventes datées à l’heure : « pas assez de ventes »', peu);
    const plat = []; for (let j = 0; j < 7; j++) for (let c = 0; c < 8; c++) for (let k = 0; k < 3; k++) plat.push(v(new Date(2026, 10, 3 + j, c * 3 + 1, 0, 0).getTime() - k * 7 * J));
    const rp = MH.meilleureHeure(SV.quandTuVends(plat, maint));
    dit(rp.etat === 'plat' && rp.n === 168, 'T3 · ventes réparties également : « aucun moment ne se détache » (jamais un hasard présenté comme une règle)', rp);
    const minuit = []; for (let i = 0; i < 100; i++) minuit.push(v(new Date(2026, 10, 2, 0, 0, 0).getTime() - (i % 10) * 7 * J, { plateforme: 'Leboncoin', heureLue: false }));
    const rm = MH.meilleureHeure(SV.quandTuVends([...minuit, ...lignes.slice(0, 60), ...lignes.slice(60, 100)], maint));
    dit(rm.etat === 'ok' && rm.n === 100 && rm.sansHeure === 100 && !(rm.jour === 0 && rm.debut === 0), 'T4 · une vente sans heure lue n’entre dans AUCUNE case (comptée « sans heure »)', rm);
    dit(MH.meilleureHeure(undefined).etat === 'encours' && MH.meilleureHeure(null).etat === 'passu', 'T5 · en cours / pas su');
    const p = MH.prochainMoment(6, 18, maint); const dp = new Date(p);
    dit(dp.getDay() === 0 && dp.getHours() === 18 && p > maint && p - maint < 7 * J, 'T6 · le prochain dimanche 18 h, dans le futur', dp.toString());
    const COMP = fs.readFileSync(path.join(RACINE, 'src', 'meilleureHeure', 'MeilleureHeure.jsx'), 'utf8') + fs.readFileSync(path.join(RACINE, 'src', 'meilleureHeure', 'meilleureHeure.js'), 'utf8');
    const RP = fs.readFileSync(path.join(RACINE, 'src', 'RepubProgramme.jsx'), 'utf8');
    dit(!/vmrCmd|programmer\(|creerProgramme|poserProgramme|setTimeout/.test(COMP) && /<MeilleureHeure r=\{mh\} incomplet=\{mhIncomplet\} onChoisir=\{\(ms\) => setVal\(valeurLocale\(ms\)\)\}\/>/.test(RP),
      'T7 · une SUGGESTION : le lien met le moment dans le champ, « Programmer » reste SON clic (aucun lancement)');
    dit(/useMeilleureHeure\(!ls \|\| ls\.venduEnAttente \? undefined : ls\.venduPasSu \? null : \(Array\.isArray\(ls\.venduLignes\) \? ls\.venduLignes : undefined\)\)/.test(RP)
      && /incomplet=\{mhIncomplet\}/.test(RP) && /const mhIncomplet = !!\(ls && Array\.isArray\(ls\.venduManque\) && ls\.venduManque\.length\);/.test(RP),
      'T8 · les lignes de Statistiques (comptes écartés hors) ; lecture en cours ⇒ rien, ratée ⇒ « pas su », partielle ⇒ dite');
    const APPt = require(path.join(__dirname, '_source-app.cjs')).sourceAppCode(RACINE);
    dit(/const cachee = \(o\) => hTx\.has\(String\(o && o\.transaction_id\)\) \|\| ecarte\(o && o\._acc && o\._acc\.vinted_user_id\);\s*const v = ventesFaites\(\{ vinted: ventesCoqueEmail,[^\n]*cachee, excluAutre: excluAutreCoque/.test(APPt),
      'T9 · `venduLignes` : ventes des comptes écartés et ventes cachées exclues (`cachee`, `excluAutre`)');
  }

  // ════════ B · LES BRANCHEMENTS ═══════════════════════════════════════════════
  {
    const { sourceAppCode: sourceApp } = require(path.join(__dirname, '_source-app.cjs'));
    const APP = sourceApp(RACINE);
    const FP = fs.readFileSync(path.join(RACINE, 'src', 'FichePaire.jsx'), 'utf8');
    const AC = fs.readFileSync(path.join(RACINE, 'src', 'AnnoncesACompleter.jsx'), 'utf8');
    dit(/vueFiche === 'temps' \? <LigneDeTemps h=\{p\} extra=\{extraTemps \|\| \{\}\}\/> : <ol className="vrm-fp-parcours">/.test(FP) && /<OngletsFiche vue=\{vueFiche\} onVue=\{setVueFiche\}\/>/.test(FP),
      'B1 · la fiche : « Par étape » · « Dans l’ordre » (la ligne de temps à la place du parcours)');
    dit(/extraTemps=\{\{ reception: ex \? ex\.reception : undefined, crees: numData \? \(numData\.crees === undefined \? null : numData\.crees\) : undefined, lireStudio: lireStudioDates(?: \}\}|,)/.test(APP)   /* (15 nov.) l’historique complet ajoute ses sources après */
      && /const lireStudioDates = \(num\) => lireBaseRelue\(`\$\{SUPABASE_URL\}\/rest\/v1\/app_data\?id=eq\.\$\{encodeURIComponent\('studio_photos_' \+ cleNum\(num\)\)\}&select=\$\{selectStudio\(\)\}`\);/.test(APP),
      'B2 · réception, dates Vinted, photos du studio : passées par identité ; studio lu en PROJECTION scalaire (jamais select=data)');
    dit(/<OutilsFicheIdees numero=\{p\.num\} source=\{champsADupliquer\(rn, ex\)\}/.test(APP) && /const r = await dupliquerNumero\(rn, ex, champs\);/.test(APP), 'B4 · la fiche : « Dans une autre taille » passe par dupliquerNumero (N° neuf)');
    dit(!/noteAnnonce|modelesDescription\/|notesAnnonces|RemplirModele/.test(APP + FP + AC), 'B5 · 155 et 156 retirés (décision de Julien) : aucune trace dans l’app');
  }

  console.log(`\n${ko ? '❌ audit-idees-paires : ' + ko + ' rouge(s), ' + ok + ' vert(s)' : '✅ audit-idees-paires : ' + ok + ' verts'}`);
  process.exit(ko ? 1 : 0);
})();
