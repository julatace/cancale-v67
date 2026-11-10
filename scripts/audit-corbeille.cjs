#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT : LOT Y (10 nov.) — LA CORBEILLE 30 JOURS (src/corbeille.js)
//  Exécute le VRAI module et lit le code des écrans.
//   A. supprimer puis restaurer rend la valeur d'avant EXACTE (même id, même
//      place, même N°), pour une liste, une sous-liste, une clé, des champs ;
//   B. « Annuler » (l'inverse) et le rejeu ne changent rien de plus (idempotent) ;
//   C. ce qui a changé depuis est GARDÉ (jamais réécrit par une restauration) ;
//   D. §5 : un élément dont le N° est porté maintenant par un autre ne revient pas ;
//   E. une lecture ratée n'écrit RIEN (même pas les clés déjà lues) ;
//   F. la purge : > 30 jours (ou au-delà de 300), et la photo/le ticket d'un
//      élément REVENU ne sont jamais vidés ; rien d'autre que ces lignes ;
//   G. le branchement : chaque suppression dans VRM passe par `gesteCorbeille`,
//      sans « Ça ne se rattrape pas » ; les suppressions SUR UN SITE gardent leur
//      confirmation ; Paramètres → Corbeille est monté ; `vrm_corbeille` synchronisée.
//  Lancer : node scripts/audit-corbeille.cjs
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const J = (v) => JSON.stringify(v);

(async () => {
  const M = await import(path.join(R, 'src', 'corbeille.js'));
  const cleNum = (v) => { const s = String(v == null ? '' : v).toUpperCase().replace(/\s+/g, ''); const x = /^([A-Z]*)0*(\d+)$/.exec(s); return x ? x[1] + x[2] : s; };
  // Un petit « stockage » : clé ⇒ valeur JSON (comme localStorage).
  const magasin = (init) => { const m = JSON.parse(J(init)); return { m, lire: (k) => (k in m ? JSON.parse(J(m[k])) : null), ecrire: (k, v) => { m[k] = JSON.parse(J(v)); return { ok: true }; } }; };
  const jouer = (s, morceaux, sens) => M.ecrireMorceaux({ morceaux, sens, lire: s.lire, ecrire: s.ecrire });
  const T0 = Date.parse('2026-11-10T10:00:00Z');

  // ── A. Une liste par id (achat hors plateforme) ──
  const achats = [{ id: 'ob_1', title: 'Nike Dunk', price: '40,00', photo: true }, { id: 'ob_2', title: 'Nike Dunk', price: '40,00' }, { id: 'ob_3', title: 'Asics' }];
  const s1 = magasin({ vinted_offvinted_buys: achats, vrm_corbeille: {} });
  const e1 = M.creerEntree({ type: 'achat', libelle: 'Nike Dunk', lignes: ['achat_hors_photo_ob_1', 'main', 'vinted_offvinted_buys'], maintenant: T0, id: 'e1',
    morceaux: [{ k: 'vinted_offvinted_buys', type: 'element', idCle: 'id', id: 'ob_1', index: 0, avant: achats[0] }] });
  await jouer(s1, M.morceauxSupprimer(e1), 'apres');
  dit(J(s1.m.vinted_offvinted_buys.map((x) => x.id)) === '["ob_2","ob_3"]' && s1.m.vrm_corbeille.e1 && s1.m.vrm_corbeille.e1.id === 'e1', 'A1 supprimer : sort de la liste (par id, pas le jumeau au même titre) et entre dans la corbeille', J(s1.m.vinted_offvinted_buys.map((x) => x.id)));
  dit(J(e1.lignes) === '["achat_hors_photo_ob_1"]', 'A2 seules les lignes annexes permises sont gardées (jamais `main`)', J(e1.lignes));
  await jouer(s1, M.morceauxRestaurer(e1), 'apres');
  dit(J(s1.m.vinted_offvinted_buys) === J(achats) && !s1.m.vrm_corbeille.e1, 'A3 restaurer : l’achat revient EXACT, à sa place, et sort de la corbeille', J(s1.m.vinted_offvinted_buys.map((x) => x.id)));

  // Sous-liste (vrm_compta.depenses) + clé d'objet (notes) + champs (fiche neuve)
  const compta = { depenses: [{ id: 'd1', libelle: 'Boîtes', montant: 12, ticket: true }, { id: 'd2', libelle: 'Scotch', montant: 3 }], fixes: [{ id: 'f1', libelle: 'Box', montant: 30 }] };
  const notes = { 'n:12': { t: 'tache semelle', at: '2026-11-09T10:00:00Z' } };
  const fiches = { fx: { numero: '41', titre: 'Jordan', retireeAt: undefined } };
  const s2 = magasin({ vrm_compta: compta, vrm_notes_paires: notes, vrm_fiches_neuves: fiches, vrm_corbeille: {} });
  const e2 = M.creerEntree({ type: 'depense', libelle: 'Boîtes', maintenant: T0, id: 'e2', morceaux: [{ k: 'vrm_compta', type: 'element', sous: 'depenses', idCle: 'id', id: 'd1', index: 0, avant: compta.depenses[0] }] });
  const e3 = M.creerEntree({ type: 'note', numero: '12', maintenant: T0, id: 'e3', morceaux: [{ k: 'vrm_notes_paires', type: 'cle', id: 'n:12', avant: notes['n:12'] }] });
  const e4 = M.creerEntree({ type: 'fiche', numero: '41', maintenant: T0, id: 'e4', morceaux: [{ k: 'vrm_fiches_neuves', type: 'champs', id: 'fx', avant: { retireeAt: undefined }, apres: { retireeAt: '2026-11-10T10:00:00.000Z' } }] });
  for (const e of [e2, e3, e4]) await jouer(s2, M.morceauxSupprimer(e), 'apres');
  dit(J(s2.m.vrm_compta.depenses.map((x) => x.id)) === '["d2"]' && J(s2.m.vrm_compta.fixes) === J(compta.fixes) && !('n:12' in s2.m.vrm_notes_paires) && s2.m.vrm_fiches_neuves.fx.retireeAt && Object.keys(s2.m.vrm_corbeille).length === 3,
    'A4 dépense (sous-liste), note (clé), fiche (champ) : retirées, le reste intact, 3 entrées');
  for (const e of [e4, e3, e2]) await jouer(s2, M.morceauxRestaurer(e), 'apres');
  dit(J(s2.m.vrm_compta) === J(compta) && J(s2.m.vrm_notes_paires) === J(notes) && J(s2.m.vrm_fiches_neuves) === J(JSON.parse(J(fiches))) && J(s2.m.vrm_corbeille) === '{}', 'A5 tout revient exactement (la fiche garde son N°41), corbeille vide', J(s2.m.vrm_fiches_neuves));

  // Liste de textes (réponses rapides), clé absente ⇒ la liste par défaut
  const defaut = ['Bonjour !', 'Merci !', 'Envoi demain'];
  const s3 = magasin({ vrm_corbeille: {} });
  const e5 = M.creerEntree({ type: 'reponse', libelle: 'Merci !', maintenant: T0, id: 'e5', morceaux: [{ k: 'vinted_quick_replies', type: 'element', id: 'Merci !', index: 1, avant: 'Merci !', defaut }] });
  await jouer(s3, M.morceauxSupprimer(e5), 'apres');
  dit(J(s3.m.vinted_quick_replies) === '["Bonjour !","Envoi demain"]', 'A6 réponse rapide (texte exact) retirée de la liste par défaut', J(s3.m.vinted_quick_replies));
  await jouer(s3, M.morceauxRestaurer(e5), 'apres');
  dit(J(s3.m.vinted_quick_replies) === J(defaut), 'A7 et revient à sa place', J(s3.m.vinted_quick_replies));

  // ── B. « Annuler » 5 s et rejeu ──
  const s4 = magasin({ vinted_offvinted_buys: achats, vrm_corbeille: {} });
  await jouer(s4, M.morceauxSupprimer(e1), 'apres');
  await jouer(s4, M.morceauxSupprimer(e1), 'apres');
  dit(J(s4.m.vinted_offvinted_buys.map((x) => x.id)) === '["ob_2","ob_3"]' && Object.keys(s4.m.vrm_corbeille).length === 1, 'B1 rejouer la suppression ne retire rien de plus (le jumeau reste)');
  await jouer(s4, M.morceauxSupprimer(e1), 'avant');
  await jouer(s4, M.morceauxSupprimer(e1), 'avant');
  dit(J(s4.m.vinted_offvinted_buys) === J(achats) && J(s4.m.vrm_corbeille) === '{}', 'B2 « Annuler » (rejoué deux fois) remet exactement, une seule fois');

  // ── C. Ce qui a changé depuis est gardé ──
  const s5 = magasin({ vinted_annonce_numeros: { k1: { numero: '7', buyPrice: '30', buyGros: { id: 'g1', part: 3000 } } }, vrm_corbeille: {} });
  const e6 = M.creerEntree({ type: 'fournisseur', maintenant: T0, id: 'e6', morceaux: [{ k: 'vinted_annonce_numeros', type: 'champs', id: 'k1', avant: { buyPrice: '30', buyGros: { id: 'g1', part: 3000 } }, apres: { buyPrice: '', buyGros: null } }] });
  await jouer(s5, M.morceauxSupprimer(e6), 'apres');
  s5.m.vinted_annonce_numeros.k1.buyPrice = '45';                                   // il retape un prix
  const plan6 = M.planRestauration(e6, s5.lire, cleNum);
  await jouer(s5, M.morceauxRestaurer(e6), 'apres');
  dit(s5.m.vinted_annonce_numeros.k1.buyPrice === '45' && J(s5.m.vinted_annonce_numeros.k1.buyGros) === J({ id: 'g1', part: 3000 }) && s5.m.vinted_annonce_numeros.k1.numero === '7' && plan6.gardes === 1,
    'C1 un prix retapé depuis est gardé ; le lien revient ; le N° n’est jamais touché', J(s5.m.vinted_annonce_numeros.k1) + ' gardes=' + plan6.gardes);
  const s6 = magasin({ vinted_offvinted_buys: [achats[1]], vrm_corbeille: {} });
  const e7 = M.creerEntree({ type: 'achat', maintenant: T0, id: 'e7', morceaux: [{ k: 'vinted_offvinted_buys', type: 'element', idCle: 'id', id: 'ob_2', avant: achats[1] }] });
  await jouer(s6, M.morceauxSupprimer(e7), 'apres');
  s6.m.vinted_offvinted_buys.push({ id: 'ob_2', title: 'revenu par un autre appareil', price: '99' });
  await jouer(s6, M.morceauxRestaurer(e7), 'apres');
  dit(s6.m.vinted_offvinted_buys.length === 1 && s6.m.vinted_offvinted_buys[0].price === '99', 'C2 un élément revenu sous le même id n’est ni doublé ni écrasé');

  // ── D. §5 : deux paires sous un N° ──
  const inv = [{ id: 'p1', numero: '12', title: 'A' }, { id: 'p2', numero: '13', title: 'B' }];
  const s7 = magasin({ vinted_inventory: inv, vrm_corbeille: {} });
  const e8 = M.creerEntree({ type: 'article', numero: '12', maintenant: T0, id: 'e8', morceaux: [{ k: 'vinted_inventory', type: 'element', idCle: 'id', id: 'p1', index: 0, avant: inv[0] }] });
  await jouer(s7, M.morceauxSupprimer(e8), 'apres');
  dit(M.planRestauration(e8, s7.lire, cleNum).ok === true, 'D1 N°12 libre : la restauration est permise');
  s7.m.vinted_inventory.push({ id: 'p9', numero: '012', title: 'autre' });
  const p8 = M.planRestauration(e8, s7.lire, cleNum);
  dit(p8.ok === false && p8.conflit === '12', 'D2 N°12 (écrit « 012 ») porté par une autre paire : rien ne revient', J(p8));

  // ── E. Une lecture ratée n'écrit rien ──
  const ecrits = [];
  const rE = await M.ecrireMorceaux({ morceaux: M.morceauxSupprimer(e1), sens: 'apres', lire: (k) => (k === 'vrm_corbeille' ? undefined : achats), ecrire: (k, v) => { ecrits.push(k); return { ok: true }; } });
  dit(rE.ok === false && rE.ecrit === false && ecrits.length === 0, 'E1 la corbeille illisible : la liste n’est pas réécrite non plus', J(rE) + ' ' + J(ecrits));

  // ── F. La purge ──
  const vieux = M.creerEntree({ type: 'achat', maintenant: T0 - 31 * 864e5, id: 'v1', lignes: ['achat_hors_photo_ob_1'], morceaux: [{ k: 'vinted_offvinted_buys', type: 'element', idCle: 'id', id: 'ob_1', avant: achats[0] }] });
  const jeune = M.creerEntree({ type: 'achat', maintenant: T0 - 29 * 864e5, id: 'j1', lignes: ['achat_hors_photo_ob_3'], morceaux: [{ k: 'vinted_offvinted_buys', type: 'element', idCle: 'id', id: 'ob_3', avant: achats[2] }] });
  const pg = M.aPurger({ v1: vieux, j1: jeune }, T0);
  dit(J(pg.ids) === '["v1"]' && M.joursRestants(jeune, T0) === 1, 'F1 purge : plus de 30 jours seulement (29 j ⇒ « dernier jour »)', J(pg.ids));
  dit(J(M.annexesAVider(vieux, () => [])) === '["achat_hors_photo_ob_1"]', 'F2 l’élément n’est pas revenu : sa photo est vidée');
  dit(J(M.annexesAVider(vieux, () => [achats[0]])) === '[]', 'F3 l’élément est revenu (restauré ailleurs) : sa photo n’est JAMAIS vidée');
  const beaucoup = {}; for (let i = 0; i < 305; i++) { const e = M.creerEntree({ type: 'note', maintenant: T0 - i * 1000, id: 'b' + i, morceaux: [{ k: 'x', type: 'cle', id: 'i' + i, avant: 1 }] }); beaucoup[e.id] = e; }
  dit(M.aPurger(beaucoup, T0).ids.length === 5 && M.aPurger(beaucoup, T0).ids.includes('b304'), 'F4 au-delà de 300 : les plus anciennes sortent');
  dit(J(M.lireCorbeille({ x: { id: 'x' }, y: 'abîmé', [e1.id]: e1 })) === J({ [e1.id]: e1 }) && M.entreeValide({ ...e1, morceaux: [{ k: 'vrm_corbeille', type: 'cle', id: 'z' }] }) === false, 'F5 une entrée abîmée (ou qui viserait la corbeille) est ignorée');

  // ── G. Le branchement ──
  const A = sansCommentaires(lire('src/App.jsx')), achatsJsx = sansCommentaires(lire('src/ecrans/Achats.jsx')), comptaJsx = sansCommentaires(lire('src/ecrans/Compta.jsx')), regl = sansCommentaires(lire('src/ecrans/Reglages.jsx'));
  dit(/'vrm_corbeille',/.test(A.slice(A.indexOf('const SYNC_KEYS = ['), A.indexOf('const SYNC_KEYS = [') + 20000)), 'G1 `vrm_corbeille` est une clé synchronisée (ligne `main`, data.rev)');
  dit(/const delOffBuy = \(id\) => \{[\s\S]{0,600}gesteCorbeille\(\{ type: 'achat'/.test(A) && !/Ça ne se rattrape pas/.test(achatsJsx) && !/ecrirePhotoAchatHors\(b\.id, null\)/.test(achatsJsx), 'G2 achat hors plateforme : à la corbeille, sa photo n’est plus vidée tout de suite');
  dit(/const retirer = \(cle, id\) => \{[\s\S]{0,700}gesteCorbeille\(/.test(comptaJsx) && !/ecrireTicket\(id, null\)/.test(comptaJsx), 'G3 dépense / coût / pack / abonnement : à la corbeille, le ticket n’est vidé qu’à la purge');
  dit(/confirmer=\{aLaCorbeille\}/.test(regl) && /gesteCorbeille\(\{ type: 'modele'/.test(regl), 'G4 modèle de description : à la corbeille');
  dit(/gesteCorbeille\(\{ type:'reponse'/.test(A), 'G5 réponse rapide : à la corbeille');
  dit(/gesteCorbeille\(\{ type: 'fiche'/.test(A) && !/Retirer la fiche N°\$\{f\.numero\} \?/.test(A), 'G6 fiche à publier : à la corbeille, même N°');
  dit(/gesteCorbeille\(\{ type: 'note'/.test(A), 'G7 note effacée : à la corbeille');
  dit(/gesteCorbeille\(\{ type: 'fournisseur'/.test(A) && /gesteCorbeille\(\{ type: 'achat-gros'/.test(A) && /title: `Retirer \$\{p\.nom\} \?`/.test(A), 'G8 fournisseur / achat en gros : confirmation gardée (plusieurs prix), puis corbeille');
  dit(/title: l\.length > 1 \? `Supprimer \$\{l\.length\} annonces de Leboncoin \?`/.test(A) && /askConfirm\(\{title:'Supprimer cette annonce d’eBay \?'/.test(sansCommentaires(lire('src/ecrans/Ebay.jsx'))), 'G9 supprimer SUR Leboncoin / eBay garde sa confirmation (pas de corbeille)');
  dit(/id:'corbeille', type:'panneau'[\s\S]{0,300}el:<CorbeilleSetting\/>/.test(regl) && /data-corbeille-restaurer=\{e\.id\}/.test(A), 'G10 Paramètres → Corbeille : la liste et « Restaurer »');
  const corps = A.slice(A.indexOf('const gesteMorceaux'), A.indexOf('function CorbeilleSetting'));
  dit(/ecrireMorceaux\(/.test(corps) && !/vmrCmd|appelEbay|\/api\//.test(corps.replace(/rest\/v1\/app_data/, '')), 'G11 la corbeille n’écrit que ses clés (aucune commande à l’extension, aucun site)');

  console.log(`\n${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
