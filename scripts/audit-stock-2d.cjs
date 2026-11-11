#!/usr/bin/env node
// ── audit-stock-2d — LE STOCK EN 2D, LA CASE D'UN VENDU, « VOIR L'ÉTAT » (5 nov.) ──
// Exécute les VRAIES règles (src/stockSortie.js, src/etatArticle.js) sur des
// données INVENTÉES, et vérifie dans App.jsx que l'écran et la sortie
// automatique passent par elles (une règle, un propriétaire — §11).
// Ce qu'il exige :
//   · une case ne se libère que pour un CANDIDAT de la règle de sortie (colis
//     parti), par IDENTITÉ de numéro (« 12 » ne libère pas la N°128), jamais
//     une paire remise à la main (`garder`) ; le numéro n'est jamais touché ;
//   · « Remettre » rend SA case si elle est libre, sinon rien n'est posé ;
//   · un vendu PARTI sans case ne revient pas « à ranger » ; posé, il reste
//     montré ; « pas su » (liste des présents absente) ne cache rien ;
//   · une case vendue est « vendue » (accent), jamais autre chose ;
//   · « Voir l'état » : chaque durée vient de deux dates LUES ; une source pas
//     lue ⇒ « — » et la raison ; une republication sans date d'origine ⇒ « au
//     moins » / « au plus » ; deux dates dans le désordre ⇒ rien de calculé ;
//     un achat pas relié ⇒ pas de durée depuis l'achat ;
//   · App.jsx : le Stock n'a qu'une vue (StockMeubles), la sortie automatique
//     appelle `libererCasesPartis`, l'écran filtre par `resteAuStock`, la fiche
//     calcule `etatArticle`.
//   node scripts/audit-stock-2d.cjs                 la règle du dépôt
//   node scripts/audit-stock-2d.cjs --mutation=NOM  une règle réaffaiblie
//   node scripts/audit-stock-2d.cjs --prouve        toutes les mutations : chacune doit rougir
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const SORTIE = path.join(RACINE, 'src', 'stockSortie.js');
const ETAT = path.join(RACINE, 'src', 'etatArticle.js');
const APP = path.join(RACINE, 'src', 'App.jsx');

// [fichier, ancre, remplacement]
const MUTATIONS = {
  // La case libérée même pour une paire REMISE à la main.
  'garder-ignore': ['sortie', "    if (garder && garder[k]) continue;\n", ''],
  // L'identité de numéro remplacée par une sous-chaîne (« 12 » ⇒ N°128).
  'sous-chaine': ['sortie', "    const s = out[k]; if (!s) continue;", "    const kk = Object.keys(out).find((x) => x.includes(k)); const s = kk ? out[kk] : null; if (!s) continue; if (kk !== k) { if (out === slots) out = { ...slots }; delete out[kk]; }"],
  // « Remettre » pose par-dessus une case prise.
  'remettre-ecrase': ['sortie', "  if (Object.keys(slots).some((c) => slots[c] && slots[c].m === m.id && slots[c].i === i)) return { slots, remise: false, raison: 'sa case est prise' };\n", ''],
  // Un vendu parti revient « à ranger ».
  'parti-revient': ['sortie', "  if (vendus && vendus.has(k) && !physiques.has(k)) return false;", ''],
  // « Pas su » (aucune liste des présents) cache les vendus.
  'passu-cache': ['sortie', "  if (!physiques) return true;\n", "  if (!physiques) return !(vendus && vendus.has(k));\n"],
  // La case vendue n'est plus distinguée.
  'vendue-eteinte': ['sortie', "  return vendus && vendus.has(cle(occupant.numero)) ? 'vendue' : 'occupee';", "  return 'occupee';"],
  // La republication sans date d'origine présentée comme exacte.
  'partiel-tu': ['etat', "if (anc && dateDe(anc) == null) partiel = true;", ''],
  // Deux dates dans le désordre : une durée quand même (valeur absolue).
  'desordre': ['etat', "  if (a < de) return { jours: null, raison: 'dates dans le désordre — rien de calculé' };\n", "  if (a < de) return { jours: Math.floor((de - a) / J), borne };\n"],
  // La réception devinée (date de l'achat) quand elle n'est pas lue.
  'reception-devinee': ['etat', "  const dRec = rec && Number.isFinite(rec.ms) ? rec.ms : null;", "  const dRec = rec && Number.isFinite(rec.ms) ? rec.ms : (rec === null ? t(evA && evA.at) : null);"],
  // Ventes pas lues lues comme « pas encore vendue ».
  'ventes-passu': ['etat', "  const venteSu = !!eV && eV.etat !== 'passu';", "  const venteSu = true;"],
  // Un prix SAISI présenté comme achat relié.
  'source-relie': ['etat', "{ cents, source: relie ? 'relie' : 'saisi', raison: '' }", "{ cents, source: 'relie', raison: '' }"],
  // (revue du 5 nov.) Une paire REMISE à la main dont la case était prise disparaît de l'écran.
  'remise-cachee': ['sortie', "  if (garder && garder[k]) return true;\n", ''],
  // (revue du 5 nov.) Un achat relié sans n° de transaction (lien d'avant) dit « saisi à la main ».
  'relie-sans-tx': ['etat', "/^achat (n°|relié)/", "/^achat n°/"],
};

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';

if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (r.status !== 0 && rouges) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

(async () => {
  for (const f of [SORTIE, ETAT]) if (!fs.existsSync(f)) { console.log('❌ ' + path.relative(RACINE, f) + ' absent : la règle n’existe pas'); process.exit(1); }
  let srcS = fs.readFileSync(SORTIE, 'utf8'), srcE = fs.readFileSync(ETAT, 'utf8');
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    const src = m[0] === 'sortie' ? srcS : srcE;
    if (!src.includes(m[1])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    if (m[0] === 'sortie') srcS = srcS.replace(m[1], m[2]); else srcE = srcE.replace(m[1], m[2]);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock2d-'));
  const fS = path.join(dir, 'stockSortie.mjs'); fs.writeFileSync(fS, srcS);
  fs.copyFileSync(path.join(__dirname, '..', 'src', 'profilVendeur.js'), path.join(dir, 'profilVendeur.js'));   // (lot vocabulaire-article) le mot du vendeur, importé par la règle
  const fE = path.join(dir, 'etatArticle.mjs'); fs.writeFileSync(fE, srcE);
  let S, E;
  try { S = await import(pathToFileURL(fS).href); E = await import(pathToFileURL(fE).href); } catch (e) { console.log('❌ une règle ne se charge pas : ' + e.message); process.exit(1); }
  let ko = 0, n = 0;
  const dit = (c, msg, det) => { n++; if (c) console.log('✅ ' + msg); else { ko++; console.log('❌ ' + msg + (det !== undefined ? ' — ' + JSON.stringify(det).slice(0, 400) : '')); } };
  const essaie = (nom, fn) => { try { fn(); } catch (e) { ko++; n++; console.log('❌ ' + nom + ' a levé : ' + e.message); } };

  // ── 1. LA SORTIE TOUTE SEULE DES CASES ────────────────────────────────────
  essaie('libererCasesPartis', () => {
    const meubles = [{ id: 'mA', name: 'Étagère entrée', cols: 3, rows: 2 }];
    const slots = { '12': { m: 'mA', i: 4 }, '128': { m: 'mA', i: 0 }, '7': { m: 'mA', i: 2 }, 'B230': { m: 'mA', i: 5 } };
    const avant = JSON.stringify(slots);
    const r = S.libererCasesPartis({ slots, meubles, candidats: [{ cle: '12', num: '12', tx: '9001', plateforme: 'Vinted', statut: 'Colis en cours d’acheminement' }], maintenant: 1 });
    dit(!r.slots['12'] && !!r.slots['128'] && !!r.slots['7'], 'la case de N°12 (parti) est libérée ; N°128 et N°7 restent (identité, pas sous-chaîne)', r.slots);
    dit(r.sortis.length === 1 && r.sortis[0].nom === 'rangée 2, colonne 2' && r.sortis[0].itemName === 'Étagère entrée' && r.sortis[0].source === 'meubles' && r.sortis[0].i === 4, 'ce qui est sorti est DIT : meuble, rangée, colonne', r.sortis);
    dit(JSON.stringify(slots) === avant, 'l’entrée n’est jamais modifiée sur place');
    const g = S.libererCasesPartis({ slots, meubles, candidats: [{ cle: '7', num: '7' }], garder: { '7': 123 } });
    dit(g.slots === slots && g.sortis.length === 0, 'une paire REMISE à la main n’est plus jamais sortie toute seule');
    const sc = S.libererCasesPartis({ slots: { '128': { m: 'mA', i: 0 } }, meubles, candidats: [{ cle: '12', num: '12' }] });
    dit(!!sc.slots['128'] && sc.sortis.length === 0, 'N°12 partie sans case : la N°128 reste dans la sienne (jamais une sous-chaîne)', sc);
    const z = S.libererCasesPartis({ slots, meubles, candidats: [{ cle: '9', num: '9' }] });
    dit(z.slots === slots && z.sortis.length === 0, 'un parti sans case ne change rien');
    const b = S.libererCasesPartis({ slots, meubles, candidats: [{ num: 'b 230' }] });
    dit(!b.slots['B230'] && b.sortis.length === 1, 'un N° d’archive se reconnaît par sa clé (« b 230 » = B230)', b.slots);
    const s0 = S.libererCasesPartis({ slots: null, meubles, candidats: [{ cle: '12' }] });
    dit(s0.slots === null && s0.sortis.length === 0, 'cases pas lues : rien ne bouge');
  });

  // ── 2. REMETTRE ───────────────────────────────────────────────────────────
  essaie('remettreCase', () => {
    const meubles = [{ id: 'mA', name: 'E', cols: 3, rows: 2 }];
    const sorti = { cle: '12', num: '12', meubleId: 'mA', i: 4 };
    const a = S.remettreCase({ slots: { '7': { m: 'mA', i: 2 } }, meubles, sorti });
    dit(a.remise && a.slots['12'] && a.slots['12'].i === 4 && a.slots['7'].i === 2, '« Remettre » rend SA case', a);
    const b = S.remettreCase({ slots: { '7': { m: 'mA', i: 4 } }, meubles, sorti });
    dit(!b.remise && !b.slots['12'] && b.slots['7'].i === 4, 'sa case est prise : rien n’est posé (il choisit)', b);
    const c = S.remettreCase({ slots: {}, meubles: [], sorti });
    dit(!c.remise && /meuble/.test(c.raison), 'le meuble n’existe plus : dit', c);
  });

  // ── 3. CE QUE LE STOCK MONTRE ─────────────────────────────────────────────
  essaie('resteAuStock', () => {
    const vendus = new Set(['4', '3']), physiques = new Set(['1', '3']);
    dit(!S.resteAuStock({ numero: '4' }, { pose: false, vendus, physiques }), 'vendu ET parti, sans case : plus « à ranger »');
    dit(S.resteAuStock({ numero: '4' }, { pose: true, vendus, physiques }), 'vendu et parti mais encore dans sa case : montré (allumé) jusqu’à ce qu’il l’enlève');
    dit(S.resteAuStock({ numero: '3' }, { pose: false, vendus, physiques }), 'vendu pas encore parti : montré');
    dit(S.resteAuStock({ numero: '9' }, { pose: false, vendus, physiques }), 'pas vendu (même absent des présents) : montré — on ne cache pas sur une absence');
    dit(S.resteAuStock({ numero: '4' }, { pose: false, vendus, physiques: null }), '« pas su » (présents jamais publiés) : rien n’est caché');
    dit(S.resteAuStock({ numero: '4' }, { pose: false, vendus, physiques, garder: { '4': 1 } }), 'REMISE à la main (« Remettre », sa case prise) : elle attend dans « À ranger », jamais disparue');
    dit(S.etatCase({ numero: '3' }, { vendus }) === 'vendue' && S.etatCase({ numero: '1' }, { vendus }) === 'occupee' && S.etatCase(null, { vendus }) === 'vide', 'une case : vide · occupée · vendue');
  });

  // ── 4. « VOIR L'ÉTAT » ────────────────────────────────────────────────────
  const NOW = Date.parse('2026-11-05T12:00:00Z');
  const hist = ({ achat = 'relie', vente = 'fait', venteAt = '2026-10-20T10:00:00Z', annonces = [] } = {}) => ({
    resume: { achat: achat ? 4000 : null },
    etapes: [
      achat === 'relie' ? { cle: 'achat', etat: 'fait', evenements: [{ at: '2026-10-01T09:00:00.000Z', preuve: 'achat n° 555', cle: 'achat' }] }
        : achat === 'saisi' ? { cle: 'achat', etat: 'fait', evenements: [{ at: null, preuve: 'prix saisi', cle: 'achat' }] }
          : { cle: 'achat', etat: 'absent', evenements: [] },
      { cle: 'annonces', etat: annonces.length ? 'fait' : 'absent', evenements: annonces },
      vente === 'fait' ? { cle: 'vente', etat: 'fait', evenements: [{ at: venteAt, cle: 'vinted' }] }
        : vente === 'passu' ? { cle: 'vente', etat: 'passu', evenements: [], detail: 'tes ventes pas toutes lues' }
          : { cle: 'vente', etat: 'absent', evenements: [] },
    ],
  });
  const L = (r, cle) => r.lignes.find((l) => l.cle === cle);
  essaie('etatArticle', () => {
    const crees = { '1001': Date.parse('2026-10-05T12:00:00Z') };
    const fiches = { '1001': { numero: '1' } };
    const rec = { ms: Date.parse('2026-10-03T10:00:00Z'), source: 'livraison' };
    const r = E.etatArticle(hist(), { fiches, ids: ['1001'], crees, reception: rec, maintenant: NOW });
    dit(r.prixAchat.cents === 4000 && r.prixAchat.source === 'relie', 'prix d’achat : celui de l’achat RELIÉ', r.prixAchat);
    dit(L(r, 'achat-vente').jours === 19 && !L(r, 'achat-vente').borne, 'achat (1 oct.) → vente (20 oct.) : 19 j', L(r, 'achat-vente'));
    dit(L(r, 'reception-en-ligne').jours === 2 && !L(r, 'reception-en-ligne').borne, 'réception (3 oct.) → mise en ligne (5 oct.) : 2 j', L(r, 'reception-en-ligne'));
    dit(L(r, 'en-ligne-vente').jours === 14, 'mise en ligne (5 oct.) → vente (20 oct.) : 14 j', L(r, 'en-ligne-vente'));
    dit(r.republications.n === 0, 'aucune republication');
    // Republiée : l'annonce d'origine sans date ⇒ au moins / au plus.
    const rp = E.etatArticle(hist(), { fiches: { '1001': { numero: '1', recreeDe: '990001' } }, ids: ['1001'], crees, reception: rec, maintenant: NOW });
    dit(L(rp, 'en-ligne-vente').borne === 'au-moins' && L(rp, 'reception-en-ligne').borne === 'au-plus' && rp.republications.n === 1, 'republiée sans date d’origine : « au moins » / « au plus », 1 republication', rp.lignes);
    dit(E.texteDuree(L(rp, 'en-ligne-vente')).replace(/\s/g, ' ') === 'au moins 14 j', 'le texte dit « au moins 14 j »', E.texteDuree(L(rp, 'en-ligne-vente')));
    // Origine datée : exact.
    const ro = E.etatArticle(hist(), { fiches: { '1001': { numero: '1', recreeDe: '990001' } }, ids: ['1001'], crees: { ...crees, '990001': Date.parse('2026-10-04T12:00:00Z') }, reception: rec, maintenant: NOW });
    dit(!L(ro, 'en-ligne-vente').borne && L(ro, 'en-ligne-vente').jours === 14, 'l’origine a une date lue : plus de « au moins »', L(ro, 'en-ligne-vente'));
    // Pas lu.
    const pl = E.etatArticle(hist({ vente: 'passu' }), { fiches, ids: ['1001'], crees: null, reception: null, receptionRaison: 'transaction de l’achat pas lue', maintenant: NOW });
    dit(r && L(pl, 'achat-vente').jours === null && /ventes/.test(L(pl, 'achat-vente').raison), 'ventes pas lues : « — » et la raison (jamais « pas encore vendue »)', L(pl, 'achat-vente'));
    dit(L(pl, 'en-ligne-vente').jours === null && /pas lues/.test(L(pl, 'en-ligne-vente').raison), 'dates de mise en ligne pas lues : « — » et la raison', L(pl, 'en-ligne-vente'));
    dit(L(pl, 'reception-en-ligne').jours === null && /pas lue/.test(L(pl, 'reception-en-ligne').raison), 'réception pas lue : « — » (jamais la date d’achat à la place)', L(pl, 'reception-en-ligne'));
    dit(E.texteDuree(L(pl, 'achat-vente')) === '—', 'le texte d’un pas su est « — »');
    // En cours de lecture.
    const ec = E.etatArticle(hist(), { fiches, ids: ['1001'], crees: undefined, reception: undefined, maintenant: NOW });
    dit(L(ec, 'en-ligne-vente').jours === undefined && E.texteDuree(L(ec, 'reception-en-ligne')) === '…', 'lecture en cours : « … » (ni « — » ni un nombre)', ec.lignes);
    // Pas vendue : « depuis ».
    const pv = E.etatArticle(hist({ vente: 'absent' }), { fiches, ids: ['1001'], crees, reception: rec, maintenant: NOW });
    dit(L(pv, 'achat-vente').borne === 'depuis' && L(pv, 'achat-vente').jours === 35 && L(pv, 'en-ligne-vente').borne === 'depuis', 'pas encore vendue : compté « depuis » (achat 1 oct. → 5 nov. = 35 j)', pv.lignes);
    // Achat pas relié : prix saisi, pas de durée depuis l'achat.
    const ps = E.etatArticle(hist({ achat: 'saisi' }), { fiches, ids: ['1001'], crees, reception: null, maintenant: NOW });
    dit(ps.prixAchat.source === 'saisi' && L(ps, 'achat-vente').jours === null && /pas relié/.test(L(ps, 'achat-vente').raison) && /pas relié/.test(L(ps, 'reception-en-ligne').raison), 'prix SAISI : dit « saisi », aucune durée depuis l’achat ni la réception', ps);
    const pa = E.etatArticle(hist({ achat: null }), { fiches, ids: ['1001'], crees, reception: null, maintenant: NOW });
    dit(pa.prixAchat.cents === null && /pas saisi/.test(pa.prixAchat.raison), 'aucun prix : « — » et la raison', pa.prixAchat);
    // Désordre.
    const ds = E.etatArticle(hist({ venteAt: '2026-09-01T10:00:00Z' }), { fiches, ids: ['1001'], crees, reception: rec, maintenant: NOW });
    dit(L(ds, 'achat-vente').jours === null && /désordre/.test(L(ds, 'achat-vente').raison), 'vente avant l’achat : rien de calculé, c’est dit', L(ds, 'achat-vente'));
    dit(E.etatArticle(hist(), { fiches: null, ids: ['1001'], crees, reception: rec, maintenant: NOW }).republications.n === null, 'fiches pas lues : republications « — »');
  });

  // ── 4 bis. (revue du 5 nov.) L'ACHAT RELIÉ DEPUIS LA VENTE ────────────────
  // Le lien posé depuis une vente (`vinted_sale_overrides`) est un achat relié :
  // l'histoire (`histoireArticle`, la VRAIE) et « Voir l'état » le disent — avant,
  // « saisi à la main » et « achat pas relié à cette paire ».
  await (async () => { try {
    const H = await import(pathToFileURL(path.join(RACINE, 'src', 'histoireArticle.js')).href);
    const rn = { etat: 'ok', cle: '7', num: '7', manques: [], annonces: [{ id: '2001', title: 'Paire inventée', etat: 'plus-en-ligne' }],
      ventes: { vinted: [{ _tx: '8801', transaction_id: '8801', _item: '2001', date: '2026-10-20T10:00:00Z', status: 'Commande finalisée', price: { amount: '70' } }], lbc: [], ebay: [] }, annoncesEbay: [], bordereaux: [] };
    const fiches = { '2001': { numero: '7', title: 'Paire inventée' } };
    const d = { fiches, buyByNum: {}, stats: {}, versements: {}, coffres: {}, offres: [], recus: new Set(), autresEnLigne: [], journalPrix: [], prixVinted: [] };
    const o = { etapeVente: () => ({ label: 'Finalisée', step: 4 }), venteAnnulee: () => false };
    const pV = H.histoireArticle(rn, { ...d, saleOv: { '8801': { buyPrice: '30', buyFromId: '77700011', buyFrom: { title: 'x', date: '2026-10-01T09:00:00Z', price: 30 } } } }, o);
    const eV = E.etatArticle(pV, { fiches, ids: ['2001'], crees: {}, reception: null, maintenant: NOW });
    dit(eV.prixAchat.source === 'relie' && L(eV, 'achat-vente').jours === 19, 'achat relié DEPUIS LA VENTE : « achat relié », achat (1 oct.) → vente (20 oct.) = 19 j', { prix: eV.prixAchat, av: L(eV, 'achat-vente') });
    const pT = H.histoireArticle(rn, { ...d, fiches: { '2001': { numero: '7', buyPrice: '30', buyFrom: { title: 'x', date: '2026-10-01T09:00:00Z' } } }, saleOv: {} }, o);
    const eT = E.etatArticle(pT, { fiches, ids: ['2001'], crees: {}, reception: null, maintenant: NOW });
    dit(eT.prixAchat.source === 'relie' && /pas relié|pas lue/.test(L(eT, 'reception-en-ligne').raison) === true, 'achat relié sans n° de transaction (lien d’avant) : « achat relié », jamais « saisi à la main »', eT.prixAchat);
    const pS = H.histoireArticle(rn, { ...d, fiches: { '2001': { numero: '7', buyPrice: '30' } }, saleOv: {} }, o);
    const eS = E.etatArticle(pS, { fiches, ids: ['2001'], crees: {}, reception: null, maintenant: NOW });
    dit(eS.prixAchat.source === 'saisi' && L(eS, 'achat-vente').jours === null, 'prix tapé à la main : « saisi », aucune durée depuis l’achat', { prix: eS.prixAchat, av: L(eS, 'achat-vente') });
  } catch (e) { ko++; n++; console.log('❌ histoireArticle + etatArticle a levé : ' + e.message); } })();

  // ── 5. L'ÉCRAN PASSE PAR CES RÈGLES ───────────────────────────────────────
  essaie('App.jsx', () => {
    const app = fs.readFileSync(APP, 'utf8').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const garage = app.slice(app.indexOf('function Garage('), app.indexOf('function BackupModal('));
    dit(/<StockMeubles\b[^>]*\/>/.test(garage) && !/<RoomPlan\b/.test(garage) && !/<StockPhotos\b/.test(garage) && !/data-stock-vue=/.test(garage), 'le Stock n’a qu’une vue : les étagères 2D (ni pièce 3D, ni cases de la pièce, ni photos)');
    const sortie = app.slice(app.indexOf('const sortirPartisDuStock'), app.indexOf('function SortisDuStock('));
    dit(/libererCasesPartis\(/.test(sortie) && sortie.indexOf('libererCasesPartis(') < sortie.indexOf('loadRoomPlan('), 'la sortie automatique libère les cases des meubles (avant, et sans dépendre, de la pièce 3D)');
    const meubles = app.slice(app.indexOf('function StockMeubles('), app.indexOf('function ChoixPlanches('));
    dit(/resteAuStock\(/.test(meubles) && /etatCase\(/.test(meubles) && /remettreCase\(/.test(meubles), 'l’écran Stock filtre, allume et remet par les règles partagées');
    dit(/vrm:stock-slots/.test(meubles) && /vrm:stock-slots/.test(sortie), 'l’écran relit les cases quand la sortie automatique les a libérées');
    dit(/etatArticle\(/.test(app) && /data-fiche-voir-etat/.test(meubles), '« Voir l’état » ouvre la fiche, qui calcule `etatArticle`');
    dit(!/saveRoomPlan\(/.test(meubles), 'l’écran Stock ne réécrit jamais l’ancienne pièce 3D');
    // (revue du 5 nov.) « Voir au stock » / « Ranger au stock » d'Annonces, Ventes,
    // Ma journée arrivent dans les étagères ; « rangée » se lit dans « Mes meubles ».
    dit(/<StockMeubles\b[^>]*\blocate=\{locate\}[^>]*\bplaceNum=\{placeNum\}/.test(garage) && /\[locate\]/.test(meubles) && /\[placeNum\]/.test(meubles), '« Voir au stock » / « Ranger au stock » arrivent dans les étagères (recherche, ou paire prise en main)');
    dit(/const inGarage = \(n\)=>[^\n]*meublesNums\.has\(/.test(app), '« Rangée » (Annonces, Ventes) se lit aussi dans « Mes meubles »');
    const lex = app.slice(app.indexOf('async function lireExtraFiche('), app.indexOf('async function lireExtraFiche(') + 3000);
    dit(/vinted_sale_overrides/.test(lex), 'la réception de l’achat relié depuis la VENTE est lue aussi');
    dit(/garder:/.test(meubles.slice(meubles.indexOf('resteAuStock('), meubles.indexOf('resteAuStock(') + 200)), 'une paire remise à la main reste montrée (garder)');
  });

  console.log(`\n${n - ko}/${n} contrôles verts${ko ? ` — ${ko} rouge(s)` : ''}.`);
  process.exit(ko ? 1 : 0);
})();
