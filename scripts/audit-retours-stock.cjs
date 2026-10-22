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
    const l8 = ligne(res, 't8');
    dit(l8 && l8.origine === 'non-reclamee', 'non réclamée par l\'acheteur ⇒ la paire revient aussi', l8 && l8.origine);
    const res2 = R.retoursEnCours({ ...base, ventes: [ventes[0], { ...ventes[4], status: 'Commande livrée ! ', transaction_user_status: 'needs_action', date: iso(2) }] });
    const l = res2.lignes.find(x => x.tx === 't5');
    dit(l && l.etape === 'en-route' && l.livreeSelonVinted && !l.recu, '440 + « Commande livrée » ⇒ en route, « Vinted dit livrée » — jamais « reçu »', l && { e: l.etape, liv: l.livreeSelonVinted, r: l.recu });
    const res3 = R.retoursEnCours({ ...base, recus: { t1: iso(0) } });
    dit(ligne(res3, 't1').recu === true && res3.lignes[0].tx === 't1', 'son clic « Reçu chez moi » ⇒ reçu, en tête de liste', res3.lignes.map(x => x.tx));
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
    const res = R.retoursEnCours({ ...base, recus: { t1: iso(0), t3: iso(0), t5: iso(0) } });
    dit(R.remiseEnStock({ ...ligne(res, 't1'), recu: false }, { numeros, presentes, cleNum }).raison === 'pas-recu', 'pas noté reçu ⇒ refusé (« reçu chez moi » d\'abord)');
    dit(R.remiseEnStock({ ...ligne(R.retoursEnCours({ ...base, recus: { t4: 1 } }), 't4') }, { numeros, presentes, cleNum }).raison === 'sans-numero', 'sans identité ⇒ rien à garder, refusé');
    const a = R.remiseEnStock(ligne(res, 't1'), { numeros, presentes, cleNum });
    dit(a.ok && a.num === '40' && !a.conflit, 'la N°40 revient avec SON N°, aucun conflit', a);
    const b = R.remiseEnStock(ligne(res, 't3'), { numeros, presentes, cleNum });
    dit(b.ok && b.conflit && b.conflit.id === 'autre50', 'le N°50 porté par une autre paire PRÉSENTE ⇒ on demande (conflit nommé)', b);
    const c = R.remiseEnStock(ligne(res, 't3'), { numeros, presentes: new Set(), cleNum });
    dit(c.ok && !c.conflit, 'la même fiche, plus présente ⇒ aucun conflit (l\'historique ne bloque pas)', c);
    const d = R.remiseEnStock(ligne(res, 't5'), { numeros, presentes, cleNum, estArchive: (n) => /^B/.test(n) });
    dit(d.ok && d.archive === true, 'ancien numéro (B60) ⇒ « numéro neuf à la republication »', d);
  });

  console.log(`\n${n - ko} vert(s), ${ko} rouge(s).${mut ? ' (mutation « ' + mut + ' »)' : ''}`);
  process.exit(ko ? 1 : 0);
})();
