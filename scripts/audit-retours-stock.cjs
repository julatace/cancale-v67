#!/usr/bin/env node
// ── audit-retours-stock — RETOUR → STOCK (21 octobre) ─────────────────────────
// Exécute la VRAIE règle (src/retoursStock.js) sur des ventes INVENTÉES à la
// forme mesurée dans sa base (transaction 440 « Retour initié », colis de
// retour « déposé », vente « Remboursement effectué », `failed`).
// Ce qu'il exige : la paire par IDENTITÉ (correction de la vente, sinon
// transaction → annonce → N°), JAMAIS par le titre ; « reçu chez toi » jamais
// déduit (même quand Vinted dit « livrée ») ; trois états (en cours · pas su ·
// lu) ; la remise en stock garde le N° et DEMANDE quand une autre paire
// présente le porte.
//   node scripts/audit-retours-stock.cjs                 la règle du dépôt
//   node scripts/audit-retours-stock.cjs --mutation=NOM  une règle réaffaiblie
//   node scripts/audit-retours-stock.cjs --prouve        toutes les mutations : chacune doit rougir
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const SRC = path.join(__dirname, '..', 'src', 'retoursStock.js');

const MUTATIONS = {
  // La paire sans identité retrouvée par son TITRE (le rapprochement interdit, §5).
  titre: ['  if (!itemId) return { num: null, itemId: null };',
    '  if (!itemId) { for (const id in (numeros || {})) { const e = numeros[id]; if (e && e.title && e.title === vente.title) return { num: String(e.numero), itemId: id }; } return { num: null, itemId: null }; }'],
  // « Vinted dit livrée » pris pour « reçu chez toi ».
  'livre-recu': ["recu: !!R[cle], recuLe: R[cle] || null };\n    const d", "recu: !!R[cle] || et.livreeSelonVinted, recuLe: R[cle] || null };\n    const d"],
  // Le N° porté par une autre paire présente : on ne demande plus.
  'conflit-ignore': ['    conflit = { id: String(id), titre: String(e.title || \'\') };', '    conflit = null;'],
  // « Pas su » lu comme « aucun retour ».
  'passu-vide': ["if (ventes === null) return { etat: 'passu', lignes: [], remises: [], manques: ['tes ventes Vinted'] };", "if (ventes === null) ventes = [];"],
  // Une transaction figée à 440 dont la vente est finalisée reste « en retour ».
  finalisee: ["if (!rembourse && (/finalis/i.test(st) || String(vente.transaction_user_status || '') === 'completed')) return null;", ''],
  // La correction posée sur la vente ignorée (l'annonce gagne).
  correction: ['  if (corr) return { num: String(corr), itemId };', ''],
  // (2 nov.) Le filtre de site ignoré : une ligne Vinted reste sous « eBay ».
  'site-ignore': ["    lignes: res.lignes.filter(l => l.plateforme === site),", "    lignes: res.lignes,"],
  // L'avertissement eBay gardé sous « Vinted ».
  'site-manques': ["    manques: res.manques.filter(m => (site === 'ebay') === estEbay(m)),", "    manques: res.manques,"],
  // (13 nov., point 29) Un retour seulement EN ROUTE passe en stock (pas encore chez lui).
  'auto-en-route': ["  return l.etape === 'rembourse' || !!l.recu;", "  return l.etape === 'rembourse' || l.etape === 'en-route' || !!l.recu;"],
  // Un « ancien » (remboursé il y a plus de 45 j) revient tout seul (il a pu être republié depuis).
  'auto-ancien': ["  if (l.ancien) return false;\n  return l.etape", "  return l.etape"],
  // Un remboursement eBay (possible sans retour) pris pour une preuve.
  'auto-ebay': ["  if (!l || l.plateforme !== 'vinted') return false;", "  if (!l) return false;"],
  // Le N° porté par un autre article PRÉSENT repris quand même (deux paires sous un N°).
  'auto-conflit': ["? { at, num: r.conflit ? null : r.num,", "? { at, num: r.num,"],
  // Une date de retour inventée (« aujourd'hui ») quand Vinted n'en dit aucune.
  'auto-date': ["      const at = ligne.recuLe || su;", "      const at = ligne.recuLe || su || new Date(now).toISOString();"],
  // Revenue alors qu'elle est déjà republiée.
  'auto-republiee': ["    if (retourRevenuSeul(ligne)) {\n      if (republiee && republiee(ligne)) { dejaRepubliees.push(tx); continue; }", "    if (retourRevenuSeul(ligne)) {"],
  // Un retour sans N° connu disparaît au lieu d'être « à numéroter ».
  'auto-sans-num': [": { at, num: null, archive: false, conflit: null, auto: true, aNumeroter: true };", ": null;\n      if (!auto) continue;"],
  // Le Stock reçoit un article sans N° comme s'il avait le N° de la vente.
  'stock-num-vente': ["    const n = l && l.remis && l.remis.num != null ? String(l.remis.num).trim() : '';\n    if (!n) { if", "    const n = l && l.num ? String(l.num).trim() : '';\n    if (!n) { if"],
};

const arg = process.argv.slice(2);
const mut = (arg.find(a => a.startsWith('--mutation=')) || '').split('=')[1] || '';

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
  let src = fs.readFileSync(SRC, 'utf8');
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    if (!src.includes(m[0])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    src = src.replace(m[0], m[1]);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retours-'));
  const f = path.join(dir, 'retoursStock.mjs'); fs.writeFileSync(f, src);
  let R;
  try { R = await import(f); } catch (e) { console.log('❌ la règle ne se charge pas : ' + e.message); process.exit(1); }
  let ko = 0, n = 0;
  const dit = (c, msg, det) => { n++; if (c) console.log('✅ ' + msg); else { ko++; console.log('❌ ' + msg + (det !== undefined ? ' — ' + JSON.stringify(det) : '')); } };
  const essaie = (nom, fn) => { try { fn(); } catch (e) { ko++; n++; console.log('❌ ' + nom + ' a levé : ' + e.message); } };

  const DAY = 864e5, now = Date.parse('2026-10-21T10:00:00Z');
  const iso = (j) => new Date(now - j * DAY).toISOString();
  // Deux paires au MÊME titre (§5) : 40 et 41.
  const numeros = {
    i40: { numero: '40', title: 'Adidas Spezial noir taille 38' },
    i41: { numero: '41', title: 'Adidas Spezial noir taille 38' },
    i50: { numero: '50', title: 'Nike Air Max 1' },
    i60: { numero: 'B60', title: 'Salomon XT-6' },
    autre50: { numero: '50', title: 'Une autre paire' },
  };
  const txnItem = { t1: 'i40', t2: 'i41', t3: 'i50', t5: 'i60', t6: 'i50' };
  const etatsMap = {
    t1: { s: 440, ss: '' },
    t3: { s: 440, ss: "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais" },
    t5: { s: 440, ss: 'Commande livrée ! ' },
    t6: { s: 440, ss: '' },
    t7: { s: 440, ss: '' },
    t8: { s: 520, ss: "Commande non réclamée - Retournée à l'expéditeur.rice" },
  };
  const etats = (tx) => etatsMap[tx] || null;
  const ventes = [
    { transaction_id: 't1', title: 'Adidas Spezial noir taille 38', status: 'Commande livrée ! ', transaction_user_status: 'needs_action', date: iso(5) },
    { transaction_id: 't2', title: 'Adidas Spezial noir taille 38', status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(6) },
    { transaction_id: 't3', title: 'Nike Air Max 1', status: 'Commande livrée ! ', transaction_user_status: 'needs_action', date: iso(3) },
    // Remboursé après retour, vente d'il y a 60 j (« ancien »).
    { transaction_id: 't4', title: 'Adidas Spezial noir taille 38', status: 'Retour initié', transaction_user_status: 'needs_action', date: iso(4) },
    { transaction_id: 't5', title: 'Salomon XT-6', status: 'Remboursement effectué', transaction_user_status: 'failed', date: iso(60) },
    // Transaction figée à 440, vente finalisée : le retour n'a pas eu lieu.
    { transaction_id: 't6', title: 'Nike Air Max 1', status: 'Commande finalisée - l\'acheteur a validé la commande', transaction_user_status: 'completed', date: iso(20) },
    // Retour initié, sans annonce reliée, corrigé à la main sur la vente.
    { transaction_id: 't7', title: 'Adidas Spezial noir taille 38', status: 'Commande livrée ! ', transaction_user_status: 'needs_action', date: iso(2) },
    // Non réclamée : la paire revient.
    { transaction_id: 't8', title: 'Converse', status: 'Remboursement effectué', transaction_user_status: 'failed', date: iso(10) },
  ];
  const base = { ventes, etats, txnItem, numeros, numeroVente: (tx) => (tx === 't7' ? '77' : null), recus: {}, remis: {}, masques: {}, maintenant: now };
  const ligne = (res, tx) => res.lignes.find(l => l.tx === tx) || null;

  console.log('\n1. LA PAIRE PAR IDENTITÉ, JAMAIS PAR LE TITRE');
  essaie('identité', () => {
    const res = R.retoursEnCours(base);
    dit(res.etat === 'lu', 'ventes lues ⇒ état « lu »', res.etat);
    dit(ligne(res, 't1') && ligne(res, 't1').num === '40', 'transaction → annonce → N° : la N°40 (pas la 41 au même titre)', ligne(res, 't1') && ligne(res, 't1').num);
    dit(ligne(res, 't4') && ligne(res, 't4').num === null, 'aucune identité (titre identique à la 40 et la 41) ⇒ « pas reliée », aucun N°', ligne(res, 't4') && ligne(res, 't4').num);
    dit(ligne(res, 't7') && ligne(res, 't7').num === '77', 'la correction posée sur la vente gagne', ligne(res, 't7') && ligne(res, 't7').num);
    dit(!ligne(res, 't2'), 'une vente finalisée (sans retour) n\'est pas un retour');
    dit(!ligne(res, 't6'), 'transaction figée à 440 + vente finalisée ⇒ pas un retour (la paire est chez l\'acheteur)');
  });

  console.log('\n2. LES ÉTAPES — « REÇU CHEZ TOI » N\'EST JAMAIS DÉDUIT');
  essaie('étapes', () => {
    const res = R.retoursEnCours(base);
    dit(ligne(res, 't1').etape === 'initie', '440, colis de retour pas parti ⇒ « initié »', ligne(res, 't1').etape);
    dit(ligne(res, 't3').etape === 'en-route', '440 + « colis déposé » ⇒ « en route »', ligne(res, 't3').etape);
    dit(ligne(res, 't4').etape === 'initie', 'statut de la vente « Retour initié » (sans état de transaction) ⇒ « initié »', ligne(res, 't4').etape);
    const l5 = ligne(res, 't5');
    dit(l5 && l5.etape === 'rembourse' && l5.recu === false, 'remboursé, PAS noté reçu (Vinted disait « livrée ») ⇒ « remboursé », reçu = non', l5 && { e: l5.etape, r: l5.recu });
    dit(l5 && l5.ancien === true, 'remboursé il y a plus de 45 j, pas reçu ⇒ « ancien » (replié, jamais caché)');
    // (13 nov., point 29) remboursée ⇒ revenue tout seule : elle est dans les remises, plus dans les lignes.
    const l8 = res.remises.find(l => l.tx === 't8');
    dit(l8 && l8.origine === 'non-reclamee', 'non réclamée par l\'acheteur ⇒ la paire revient aussi', l8 && l8.origine);
    const res2 = R.retoursEnCours({ ...base, ventes: [ventes[0], { ...ventes[4], status: 'Commande livrée ! ', transaction_user_status: 'needs_action', date: iso(2) }] });
    const l = res2.lignes.find(x => x.tx === 't5');
    dit(l && l.etape === 'en-route' && l.livreeSelonVinted && !l.recu, '440 + « Commande livrée » ⇒ en route, « Vinted dit livrée » — jamais « reçu »', l && { e: l.etape, liv: l.livreeSelonVinted, r: l.recu });
    // (13 nov., point 29) son clic « Reçu chez moi » ⇒ l'article est revenu : en stock, sous SON N°.
    const res3 = R.retoursEnCours({ ...base, recus: { t1: iso(0) } });
    const r1 = res3.remises.find(x => x.tx === 't1');
    dit(!ligne(res3, 't1') && r1 && r1.recu === true && r1.remis.num === '40', 'son clic « Reçu chez moi » ⇒ reçu, en stock sous SON N° (40)', r1 && r1.remis);
  });

  console.log('\n3. TROIS ÉTATS, « PAS SU » DIT');
  essaie('trois états', () => {
    dit(R.retoursEnCours({ ...base, ventes: undefined }).etat === 'encours', 'ventes pas encore lues ⇒ « en cours »');
    const p = R.retoursEnCours({ ...base, ventes: null });
    dit(p.etat === 'passu' && p.lignes.length === 0, 'ventes illisibles ⇒ « pas su », jamais « aucun retour »', p.etat);
    const e = R.retoursEnCours({ ...base, etats: null });
    dit(e.manques.some(m => /transaction/.test(m)) && ligne(e, 't4'), 'états des transactions illisibles ⇒ nommé dans ce qui manque, le statut de la vente détecte encore', e.manques);
    const b = R.retoursEnCours({ ...base, ebay: null });
    dit(b.manques.some(m => /eBay/.test(m)), 'retours eBay illisibles ⇒ « eBay » nommé', b.manques);
  });

  console.log('\n4. REMIS EN STOCK, REPUBLIÉE, MASQUÉE');
  essaie('remises', () => {
    const r = R.retoursEnCours({ ...base, remis: { t1: { at: iso(0), num: '40' } } });
    dit(!ligne(r, 't1') && r.remises.some(x => x.tx === 't1'), 'remise en stock ⇒ sort des retours, passe « à republier »');
    const r2 = R.retoursEnCours({ ...base, remis: { t1: { at: iso(0), num: '40' } }, republiee: (l) => l.tx === 't1' });
    dit(!r2.remises.some(x => x.tx === 't1'), 'republiée ⇒ sort de la liste');
    const r3 = R.retoursEnCours({ ...base, masques: { t3: 1 } });
    dit(!ligne(r3, 't3'), 'masquée à la main ⇒ plus affichée');
  });

  console.log('\n5. eBAY');
  essaie('ebay', () => {
    const eb = [
      { retour: { returnId: '11', orderId: 'o1', itemId: '99', etat: 'RETURN_REQUESTED', titre: 'Autry' }, compte: 'principal', num: '12' },
      { retour: { returnId: '12', orderId: 'o2', itemId: '98', etat: 'CLOSED' }, compte: 'principal', num: '13' },
      { retour: { returnId: '13', orderId: 'o3', itemId: '97', etat: 'CLOSED', rembourse: { value: '50', currency: 'EUR' } }, compte: 'principal', num: null },
      { retour: { returnId: '14', orderId: 'o4', itemId: '96', etat: 'ITEM_SHIPPED' }, compte: 'principal', num: '14' },
    ];
    const r = R.retoursEnCours({ ...base, ebay: eb });
    const g = (id) => r.lignes.find(l => l.returnId === id);
    dit(g('11') && g('11').etape === 'initie' && g('11').num === '12', 'retour demandé ⇒ « initié », N° par le SKU (fourni)');
    dit(!g('12'), 'clos sans remboursement ⇒ rien ne revient, pas de ligne');
    dit(g('13') && g('13').etape === 'rembourse' && g('13').num === null, 'remboursé ⇒ « remboursé » ; sans SKU ⇒ pas reliée');
    dit(g('14') && g('14').etape === 'en-route', 'colis expédié ⇒ « en route »');
  });

  console.log('\n6. LA REMISE EN STOCK GARDE LE N° — ET DEMANDE');
  essaie('remise', () => {
    const cleNum = (v) => String(v || '').toUpperCase().replace(/[\s-]/g, '').replace(/^0+(?=\d)/, '');
    const presentes = new Set(['autre50']);
    // La règle de remise jugée sur la ligne telle qu'elle était AVANT la remise (non reçue), puis reçue.
    const res0 = R.retoursEnCours(base);
    const res = { lignes: res0.lignes.map(l => ({ ...l, recu: true })) };
    dit(R.remiseEnStock({ ...ligne(res, 't1'), recu: false }, { numeros, presentes, cleNum }).raison === 'pas-recu', 'pas noté reçu ⇒ refusé (« reçu chez moi » d\'abord)');
    dit(R.remiseEnStock({ ...ligne(res, 't4') }, { numeros, presentes, cleNum }).raison === 'sans-numero', 'sans identité ⇒ rien à garder, refusé');
    const a = R.remiseEnStock(ligne(res, 't1'), { numeros, presentes, cleNum });
    dit(a.ok && a.num === '40' && !a.conflit, 'la N°40 revient avec SON N°, aucun conflit', a);
    const b = R.remiseEnStock(ligne(res, 't3'), { numeros, presentes, cleNum });
    dit(b.ok && b.conflit && b.conflit.id === 'autre50', 'le N°50 porté par une autre paire PRÉSENTE ⇒ on demande (conflit nommé)', b);
    const c = R.remiseEnStock(ligne(res, 't3'), { numeros, presentes: new Set(), cleNum });
    dit(c.ok && !c.conflit, 'la même fiche, plus présente ⇒ aucun conflit (l\'historique ne bloque pas)', c);
    const d = R.remiseEnStock({ ...ligne(res0, 't5'), recu: true }, { numeros, presentes, cleNum, estArchive: (n) => /^B/.test(n) });
    dit(d.ok && d.archive === true, 'ancien numéro (B60) ⇒ « numéro neuf à la republication »', d);
  });

  console.log('\n7. LE FILTRE DE SITE DE COLIS (2 nov.) — jamais Vinted sous eBay');
  essaie('site', () => {
    const v = { cle: 'v1', plateforme: 'vinted' }, e = { cle: 'e1', plateforme: 'ebay' };
    const lu = { etat: 'lu', lignes: [v, e], remises: [v], manques: ['l\'état des transactions Vinted', 'tes retours eBay'] };
    const sE = R.retoursPourSite(lu, 'ebay');
    dit(sE.lignes.length === 1 && sE.lignes[0].plateforme === 'ebay' && sE.remises.length === 0, 'eBay ⇒ aucune ligne Vinted', sE);
    dit(sE.manques.length === 1 && /eBay/.test(sE.manques[0]), 'eBay ⇒ seul l\'avertissement eBay', sE.manques);
    const sV = R.retoursPourSite(lu, 'vinted');
    dit(sV.lignes.length === 1 && sV.lignes[0].plateforme === 'vinted' && sV.remises.length === 1, 'Vinted ⇒ aucune ligne eBay', sV);
    dit(sV.manques.every(m => !/eBay/.test(m)) && sV.manques.length === 1, 'Vinted ⇒ jamais « pas pu lire tes retours eBay »', sV.manques);
    dit(R.retoursPourSite(lu, 'toutes') === lu, 'Tous les sites ⇒ tout, inchangé');
    dit(R.retoursPourSite(lu, 'vestiaire') === null && R.retoursPourSite(lu, 'leboncoin') === null, 'Vestiaire / Leboncoin ⇒ pas de bloc (retours non suivis)');
    const passu = { etat: 'passu', lignes: [], remises: [], manques: ['tes ventes Vinted'] };
    dit(R.retoursPourSite(passu, 'ebay') === null && R.retoursPourSite(passu, 'vinted') === passu, 'ventes Vinted illisibles : dit sous Vinted, pas sous eBay');
  });

  console.log('\n8. (13 nov., point 29) UN RETOUR PROUVÉ REVIENT EN STOCK SOUS SON N°, SANS RIEN SAISIR');
  essaie('revenu tout seul', () => {
    const cleNum = (v) => String(v || '').toUpperCase().replace(/[\s-]/g, '').replace(/^0+(?=\d)/, '');
    const NUM = { i40: { numero: '40', title: 'Samba blanche 42' }, i41: { numero: '41', title: 'Samba blanche 42' }, i50: { numero: '50', title: 'Dunk' }, autre50: { numero: '50', title: 'Une autre paire en ligne' },
      i60: { numero: '60', title: 'Gazelle' }, i70: { numero: '70', title: 'Spezial' }, i80: { numero: 'B80', title: 'Air Max' } };
    const TI = { r1: 'i40', r2: 'i41', r4: 'i50', r5: 'i60', r8: 'i70', r9: 'i41', r12: 'i80' };
    const SU = iso(6);
    const ET = { r1: { s: 440, ss: '', su: SU }, r2: { s: 440, ss: "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais", su: SU },
      r3: { s: 440, ss: '', su: SU }, r4: { s: 440, ss: '', su: SU }, r5: { s: 440, ss: 'Commande livrée ! ', su: SU }, r7: { s: 500, ss: '' },
      r8: { s: 440, ss: '', su: SU }, r9: { s: 440, ss: 'Commande livrée ! ', su: SU }, r11: { s: 440, ss: '' }, r12: { s: 440, ss: '', su: SU } };
    const vt = (tx, status, tus, j) => ({ transaction_id: tx, title: 'Samba blanche 42', status, transaction_user_status: tus, date: iso(j) });
    const V = [
      vt('r1', 'Remboursement effectué', 'failed', 12),     // retour remboursé, identité → N°40
      vt('r2', 'Commande livrée ! ', 'needs_action', 8),    // retour en route
      vt('r3', 'Remboursement effectué', 'failed', 12),     // retour remboursé, AUCUNE identité (même titre que 40 et 41)
      vt('r4', 'Remboursement effectué', 'failed', 12),     // N°50 porté par un autre article PRÉSENT
      vt('r5', 'Remboursement effectué', 'failed', 60),     // remboursé il y a plus de 45 j : « ancien »
      vt('r7', 'Remboursement effectué', 'failed', 10),     // annulation « article indisponible » remboursée : PAS un retour
      vt('r8', 'Remboursement effectué', 'failed', 12),     // remboursé, mais déjà republié
      vt('r9', 'Commande livrée ! ', 'needs_action', 8),    // 440 + « Vinted dit livrée », pas remboursé
      vt('r10', 'Remboursement effectué', 'failed', 12),    // aucun état de transaction lu : rien n'est prouvé
      vt('r11', 'Remboursement effectué', 'failed', 12),    // retour remboursé, date de transaction NON lue
      vt('r12', 'Remboursement effectué', 'failed', 12),    // ancien N° (B80)
    ];
    const base8 = { ventes: V, etats: (tx) => ET[tx] || null, txnItem: TI, numeros: NUM, numeroVente: () => null, recus: {}, remis: {}, masques: {},
      republiee: (l) => l.tx === 'r8', maintenant: now, presentes: new Set(['autre50']), cleNum, estArchive: (n) => /^B/.test(n) };
    const res = R.retoursEnCours(base8);
    const rem = (tx) => res.remises.find(l => l.tx === tx) || null;
    const lig = (tx) => res.lignes.find(l => l.tx === tx) || null;
    const r1 = rem('r1');
    dit(r1 && r1.remis.auto === true && r1.remis.num === '40' && !lig('r1'), '8a retour REMBOURSÉ ⇒ en stock tout seul, sous SON N° (40 — pas le 41 au même titre)', r1 && r1.remis);
    dit(r1 && r1.retourLe === SU && r1.remis.at === SU, '8b la date du retour est celle LUE sur la transaction', r1 && { le: r1.retourLe, at: r1.remis.at });
    dit(lig('r2') && lig('r2').etape === 'en-route' && !rem('r2'), '8c retour EN ROUTE ⇒ « retour en route », pas encore en stock', lig('r2') && lig('r2').etape);
    const r3 = rem('r3');
    dit(r3 && r3.remis.num === null && r3.remis.aNumeroter === true, '8d sans N° connu ⇒ en stock « à numéroter », aucun N° deviné', r3 && r3.remis);
    const r4 = rem('r4');
    dit(r4 && r4.remis.num === null && r4.remis.conflit === 'autre50', '8e N° porté par un autre article PRÉSENT ⇒ pas repris (rien deviné), le conflit nommé', r4 && r4.remis);
    dit(lig('r5') && lig('r5').ancien && !rem('r5'), '8f « ancien » (remboursé il y a plus de 45 j) ⇒ ne revient pas tout seul, garde son geste', lig('r5') && lig('r5').ancien);
    dit(!lig('r7') && !rem('r7'), '8g une annulation remboursée (500) n\'est pas un retour ⇒ rien ne revient');
    dit(!lig('r8') && !rem('r8') && (res.dejaRepubliees || []).includes('r8'), '8h déjà republiée ⇒ ne revient pas en stock (nommée, pour ne pas être redite en « envoyé »)', res.dejaRepubliees);
    dit(lig('r9') && lig('r9').livreeSelonVinted && !rem('r9'), '8i « Vinted dit livrée » sans remboursement ⇒ jamais en stock tout seul', lig('r9') && lig('r9').etape);
    dit(!lig('r10') && !rem('r10'), '8j aucun état de transaction lu ⇒ rien prouvé, rien ne revient (jamais déduit d\'une absence)');
    const r11 = rem('r11');
    dit(r11 && r11.retourLe === null && r11.remis.at === null, '8k date de transaction non lue ⇒ aucune date inventée', r11 && { le: r11.retourLe, at: r11.remis.at });
    dit(rem('r12') && rem('r12').remis.num === 'B80' && rem('r12').remis.archive === true, '8l ancien N° (B80) : la paire revient sous SON N°, marqué archive (un neuf à la republication)', rem('r12') && rem('r12').remis);
    const S = R.retoursPourStock(res);
    const nums = S.articles.map(a => a.numero).sort().join(',');
    dit(nums === '40,B80', '8m le Stock reçoit les N° revenus (40, B80) — ni le N° en conflit, ni un N° pour le sans-N°', nums);
    dit(S.aNumeroter === 2, '8n les revenus sans N° connu (r3, r11) sont comptés « à numéroter » (le conflit à part)', S.aNumeroter);
    dit(JSON.stringify(R.numsRemisEnStock(res).sort()) === '["40","B80"]', '8o les N° revenus redeviennent présents (`vinted_nums_physiques`)', JSON.stringify(R.numsRemisEnStock(res)));
    const eb = R.retoursEnCours({ ...base8, ventes: [], ebay: [{ retour: { returnId: '9', orderId: 'o', itemId: '1', etat: 'CLOSED', rembourse: { value: '5' } }, compte: 'principal', num: '12' }] });
    dit(eb.lignes.some(l => l.returnId === '9') && !eb.remises.length && !R.retourRevenuSeul({ ...eb.lignes[0] }) && !R.retourRevenuSeul({ plateforme: 'ebay', etape: 'rembourse', recu: true }), '8p un remboursement eBay (possible sans retour) ⇒ jamais en stock tout seul');
    // 50 paires identiques (§2.4) : chaque retour remboursé revient sous SON N°, jamais celui d'une autre.
    const N50 = {}, T50 = {}, E50 = {}, V50 = [];
    for (let i = 1; i <= 50; i++) { N50['it' + i] = { numero: String(100 + i), title: 'Samba blanche 42' }; T50['x' + i] = 'it' + i; E50['x' + i] = { s: 440, ss: '', su: SU }; V50.push(vt('x' + i, 'Remboursement effectué', 'failed', 10)); }
    V50.push(vt('x51', 'Remboursement effectué', 'failed', 10)); E50.x51 = { s: 440, ss: '', su: SU };
    const r50 = R.retoursEnCours({ ...base8, ventes: V50, etats: (tx) => E50[tx] || null, txnItem: T50, numeros: N50, republiee: null, presentes: new Set() });
    const bons = r50.remises.filter(l => l.tx !== 'x51' && l.remis.num === String(100 + Number(l.tx.slice(1)))).length;
    const x51 = r50.remises.find(l => l.tx === 'x51');
    dit(bons === 50 && x51 && x51.remis.num === null && x51.remis.aNumeroter, '8q 50 paires identiques : 50 N° justes, et la 51e sans identité « à numéroter » (aucun N° pris aux autres)', `${bons}/50 · ${x51 && x51.remis.num}`);
  });

  console.log(`\n${n - ko} vert(s), ${ko} rouge(s).${mut ? ' (mutation « ' + mut + ' »)' : ''}`);
  process.exit(ko ? 1 : 0);
})();
