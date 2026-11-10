#!/usr/bin/env node
// ── audit-litiges-ecran — « LITIGES EN COURS » ET « RETOURS PAR MODÈLE » (10 nov., BB/BI) ──
// Exécute la VRAIE règle (src/litigesEcran.js, avec les vraies src/litiges.js,
// src/retoursStock.js, src/ceQuiRapporte.js) sur des données INVENTÉES à la forme
// mesurée dans sa base le 10 novembre (transactions 440/430, « Remboursement
// effectué » mêlant annulations et retours, e-mail « Action requise » relié par
// SA conversation). Aucune vraie donnée.
// Ce qu'il exige :
//   · la date limite seulement LUE (sinon null, « Date limite non lue ») ;
//   · seules les VENTES (un retour d'ACHAT n'est pas sur cet écran) ;
//   · les preuves par la transaction : suivi + statut du transporteur pour CE n°,
//     « pas lu » quand le transporteur n'a pas pu être lu, bordereau, carton « à venir » ;
//   · Leboncoin / Vestiaire : « jamais vu » NOMMÉ, jamais « aucun litige » ;
//   · BI : retour = transaction 440 (pas un simple remboursement) ; litige relié par
//     conversation UNIQUE (jamais le titre) ; remboursement à cause pas lue compté à
//     part (« au moins ») ; annulation hors du dénominateur ; « Autres » en dernier ;
//   · rien n'est publié pour À trancher quand Vinted ou eBay ne sont pas lus.
//   node scripts/audit-litiges-ecran.cjs                 la règle du dépôt
//   node scripts/audit-litiges-ecran.cjs --mutation=NOM  une règle réaffaiblie
//   node scripts/audit-litiges-ecran.cjs --prouve        toutes les mutations : chacune doit rougir
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const SRC = path.join(RACINE, 'src', 'litigesEcran.js');

const MUTATIONS = {
  // Un remboursement seul compté comme un retour (annulations comprises).
  'rembourse-retour': ["    if (retour) compte = 'retour';", "    if (retour || RE_REMB.test(st)) compte = 'retour';"],
  // Le litige relié par le TITRE du sujet (interdit, §5).
  'litige-titre': ["(conv && convProbleme.has(conv) && parConv.get(conv) === 1));", "(conv && convProbleme.has(conv) && parConv.get(conv) === 1) || [...titresProbleme].some((t) => t && str(o.title).toLowerCase().includes(t)));"],
  // Deux ventes à la même conversation : la première prend le litige.
  'conv-ambigue': ['parConv.get(conv) === 1));', 'parConv.get(conv) >= 1));'],
  // La cause pas lue rangée parmi les ventes (le « au moins » disparaît).
  'inconnue-vente': ["    else if (RE_REMB.test(st) || tus === 'failed') { inconnues++; compte = 'inconnue'; }", ''],
  // Une annulation comptée au dénominateur.
  'annulee-comptee': ['    else if (s === 220 || (s != null && s >= 500)) continue;                           // annulée / paiement échoué : pas une vente', ''],
  // Une date limite inventée (date de la vente + 5 j) quand elle n'est pas lue.
  'limite-inventee': ['      limite: l.limite || null, limiteTexte: lim,', "      limite: l.limite || new Date(Date.parse(l.recuLe || 0) + 5 * 864e5).toISOString(), limiteTexte: lim || 'bientôt',"],
  // Les retours d'ACHAT mêlés aux ventes.
  'achats-meles': ["    if (!l || l.sens !== 'vente') continue;", '    if (!l) continue;'],
  // Leboncoin et Vestiaire tus (« aucun litige » au lieu de « pas su »).
  'sites-tus': ["    if (utilise(s)) plateformes.push({ site: s, etat: 'jamais-vu',", "    if (false) plateformes.push({ site: s, etat: 'jamais-vu',"],
  // Le statut « pas lu » du transporteur pris pour « n° rangé, rien à dire ».
  'transp-passu': ["  else if (transp === null) p.suivi = { etat: 'passu', n };", ''],
  // Le nombre publié même quand Vinted n'est pas lu.
  'publie-partiel': ["  if (r.plateformes.some((p) => (p.site === 'vinted' || p.site === 'ebay') && (p.etat === 'passu' || p.etat === 'encours'))) return null;", ''],
  // « Autres » classé comme un modèle.
  'autres-premier': ["(a.cle === '' ? 1 : 0) - (b.cle === '' ? 1 : 0) || ", ''],
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
  if (!fs.existsSync(SRC)) { console.log('❌ src/litigesEcran.js absent : la règle n’existe pas'); process.exit(1); }
  let src = fs.readFileSync(SRC, 'utf8');
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    if (!src.includes(m[0])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    src = src.replace(m[0], m[1]);
    if (mut === 'litige-titre') src = src.replace('  const parConv = new Map();', "  const titresProbleme = new Set((Array.isArray(emails) ? emails : []).map((r) => { const e = litigeDEmail(r); return e && e.genre === 'probleme' ? str(e.article).toLowerCase() : ''; }));\n  const parConv = new Map();");
  }
  // La copie (mutée ou non) importe les VRAIES règles voisines par chemin absolu.
  for (const f of ['litiges.js', 'retoursStock.js', 'ceQuiRapporte.js']) src = src.replace(`'./${f}'`, JSON.stringify(pathToFileURL(path.join(RACINE, 'src', f)).href));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'litiges-ecran-'));
  const f = path.join(dir, 'litigesEcran.mjs'); fs.writeFileSync(f, src);
  let E, L;
  try { E = await import(pathToFileURL(f).href); L = await import(pathToFileURL(path.join(RACINE, 'src', 'litiges.js')).href); }
  catch (e) { console.log('❌ la règle ne se charge pas : ' + e.message); process.exit(1); }
  let ko = 0, n = 0;
  const dit = (c, msg, det) => { n++; if (c) console.log('✅ ' + msg); else { ko++; console.log('❌ ' + msg + (det !== undefined ? ' — ' + JSON.stringify(det).slice(0, 400) : '')); } };
  const essaie = (nom, fn) => { try { fn(); } catch (e) { ko++; n++; console.log('❌ ' + nom + ' a levé : ' + e.message); } };

  const MAINT = Date.parse('2026-11-10T09:00:00Z');
  const brut = (texte) => JSON.stringify({ from: 'no-reply@vinted.fr', subject: 'x', text: texte });
  const CONV_P = '24618670101', CONV_DOUBLE = '24618670202';
  const T = 'Nike Dunk Low noir taille 42';     // même titre sur plusieurs ventes (§5)
  const ventes = [
    // 8001 retour en cours (440), Dunk
    { transaction_id: 8001, title: T, status: 'Retour initié', transaction_user_status: 'needs_action', conversation_id: '1001', date: '2026-11-01T10:00:00Z' },
    // 8002 Dunk, finalisée, MÊME titre : pas un retour
    { transaction_id: 8002, title: T, status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed', conversation_id: '1002', date: '2026-10-01T10:00:00Z' },
    // 8003 Dunk, remboursée APRÈS un retour (440 lue) ⇒ retour, clos
    { transaction_id: 8003, title: 'Nike Dunk High blanc 41', status: 'Remboursement effectué', transaction_user_status: 'failed', conversation_id: '1003', date: '2026-09-01T10:00:00Z' },
    // 8004 Dunk, remboursée, transaction PAS lue ⇒ cause pas lue (au moins)
    { transaction_id: 8004, title: 'Nike Dunk Low gris 43', status: 'Remboursement effectué', transaction_user_status: 'failed', conversation_id: '1004', date: '2026-09-02T10:00:00Z' },
    // 8005 Samba, annulée (500 lue) ⇒ pas une vente
    { transaction_id: 8005, title: 'Adidas Samba OG 40', status: 'Remboursement effectué', transaction_user_status: 'failed', conversation_id: '1005', date: '2026-09-03T10:00:00Z' },
    // 8006 Samba, e-mail « problème » relié par SA conversation ⇒ litige
    { transaction_id: 8006, title: 'Adidas Samba OG 41', status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', conversation_id: CONV_P, date: '2026-11-05T10:00:00Z' },
    // 8007 / 8008 Samba : deux ventes à la MÊME conversation (ambiguë) + e-mail ⇒ aucun litige
    { transaction_id: 8007, title: 'Adidas Samba OG 42', status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed', conversation_id: CONV_DOUBLE, date: '2026-08-01T10:00:00Z' },
    { transaction_id: 8008, title: 'Adidas Samba OG 43', status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed', conversation_id: CONV_DOUBLE, date: '2026-08-02T10:00:00Z' },
    // 8009 sans modèle reconnu ⇒ Autres, litige 430
    { transaction_id: 8009, title: 'Paire rare vintage', status: 'Transaction suspendue - en attente de vérification.', transaction_user_status: 'waiting', conversation_id: '1009', date: '2026-11-02T10:00:00Z' },
    // 8010 Dunk, finalisée normale
    { transaction_id: 8010, title: 'Nike Dunk Low panda 44', status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed', conversation_id: '1010', date: '2026-07-01T10:00:00Z' },
    // 8011 conversation seule (statut vide) : pas une vente
    { transaction_id: 8011, title: 'Nike Dunk Low 45', status: '', transaction_user_status: '', conversation_id: '1011', date: '2026-07-02T10:00:00Z' },
  ];
  const ETATS = { 8001: { s: 440, ss: '' }, 8003: { s: 440, ss: 'Commande livrée ! ' }, 8005: { s: 500, ss: 'Bordereau envoyé au vendeur' }, 8009: { s: 430, ss: '' }, 8002: { s: 450, ss: '' } };
  const etats = (tx) => ETATS[tx] || null;
  const emails = [
    { id: 'email_inconnu_1', subject: 'Action requise : problème avec la commande « Adidas Samba OG 41 »', receivedAt: '2026-11-07T10:00:00Z', brut: brut(`Bonjour, l'acheteur a signalé un problème. https://www.vinted.fr/inbox/${CONV_P}`) },
    { id: 'email_inconnu_2', subject: 'Action requise : problème avec la commande « Adidas Samba OG 42 »', receivedAt: '2026-11-07T11:00:00Z', brut: brut(`Bonjour. https://www.vinted.fr/inbox/${CONV_DOUBLE}`) },
    // Un retour d'ACHAT avec une date LUE (« d'ici le 16 nov. »)
    { id: 'email_inconnu_3', subject: "Retourne ta commande d'ici le 16 nov. : Asics Gel 1130", receivedAt: '2026-11-07T19:00:00Z', brut: brut('Renvoie le colis.') },
  ];

  // ── BB ──
  essaie('BB', () => {
    const res = L.litigesEnCours({ ventes, achats: [], emails, etats, numeroDe: (o) => (o.transaction_id === 8001 ? '12' : null), ebay: [], maintenant: MAINT });
    const transp = new Map([['3SBXAA000111', { libelle: 'Colis livré au point relais', etatAt: '2026-11-08T10:00:00Z' }]]);
    const preuves = (l) => {
      const tx = String(l.tx);
      if (tx === '8001') return E.preuvesVente({ bord: { suivi: '3SBXAA000111', receivedAt: '2026-11-01T11:00:00Z' }, suivi: '3SBXAA000111', transp, photo: 'https://images1.vinted.net/t/a.jpeg' });
      if (tx === '8006') return E.preuvesVente({ label: { capturedAt: '2026-11-05T12:00:00Z' }, suivi: 'XW123456789FR', transp: null, photo: '' });
      return null;
    };
    const r = E.litigesDesVentes({ res, preuves, sites: new Set(['vinted', 'leboncoin', 'vestiaire']), ebay: [], maintenant: MAINT });
    const cles = r.cartes.map((c) => c.tx || c.cle).sort().join(',');
    dit(r.etat === 'lu' && cles === `8001,8006,8009,c:${CONV_DOUBLE}`, 'BB : les VENTES en litige / retour (8001 retour, 8006 problème relié par conversation, 8009 suspendue, l’e-mail à conversation ambiguë seul) — pas le retour d’ACHAT', cles);
    const cA = r.cartes.find((c) => c.cle === `c:${CONV_DOUBLE}`);
    dit(cA && cA.num === '' && cA.tx === '' && cA.preuves.photo.etat === 'aucun', 'conversation portée par deux ventes : la carte n’est reliée à AUCUNE (ni N°, ni preuve)', cA);
    const c1 = r.cartes.find((c) => c.tx === '8001');
    dit(c1 && c1.limite === null && E.phraseLimite(c1) === 'Date limite non lue', '8001 : aucune date limite écrite ⇒ « Date limite non lue » (jamais inventée)', c1 && [c1.limite, E.phraseLimite(c1)]);
    dit(c1 && c1.num === '12', '8001 : le N° vient de l’identité (numeroDe)', c1 && c1.num);
    dit(c1 && c1.preuves.suivi.etat === 'ok' && c1.preuves.suivi.statut === 'Colis livré au point relais', '8001 : suivi + statut lu chez le transporteur pour CE n°', c1 && c1.preuves.suivi);
    dit(c1 && c1.preuves.bordereau.etat === 'ok' && c1.preuves.photo.etat === 'ok', '8001 : bordereau et photo rangés', c1 && c1.preuves);
    dit(c1 && c1.preuves.carton.etat === 'encours', 'la photo du carton : lecture pas encore revenue ⇒ « … » (jamais « — »)', c1 && c1.preuves.carton);
    // (10 nov., lot AZ livré) Les trois réponses de `aPhotoCarton` : { at } · false · null.
    const pc = (carton) => E.preuvesVente({ carton }).carton.etat;
    dit(pc({ at: '2026-11-10T09:00:00Z' }) === 'ok' && pc(false) === 'aucun' && pc(null) === 'passu' && pc(undefined) === 'encours',
      'photo du carton : rangée ⇒ ✓ · aucune ⇒ — · pas su ⇒ « pas lu » (jamais « aucune ») · en cours ⇒ …', [pc({ at: 'x' }), pc(false), pc(null), pc(undefined)]);
    const c6 = r.cartes.find((c) => c.tx === '8006');
    dit(c6 && c6.genre === 'probleme' && c6.preuves.suivi.etat === 'passu' && c6.preuves.photo.etat === 'aucun', '8006 : transporteur pas lu ⇒ « pas lu » ; pas de photo ⇒ « — »', c6 && c6.preuves);
    const sites = Object.fromEntries(r.plateformes.map((p) => [p.site, p.etat]));
    dit(sites.leboncoin === 'jamais-vu' && sites.vestiaire === 'jamais-vu' && r.manques.includes('Leboncoin') && r.manques.includes('Vestiaire'), 'Leboncoin et Vestiaire : « ne se lit pas encore », NOMMÉS dans ce qui manque', r.plateformes);
    dit(E.nombreLitigesPublie(r) === 4, 'À trancher : 4 publiés (Vinted et eBay lus)', E.nombreLitigesPublie(r));
    const rPassu = E.litigesDesVentes({ res: L.litigesEnCours({ ventes: null, achats: null, emails: null }), sites: new Set(['vinted']) });
    dit(rPassu.etat === 'passu' && E.nombreLitigesPublie(rPassu) === null, 'ventes pas lues ⇒ « pas su », rien de publié', [rPassu.etat, E.nombreLitigesPublie(rPassu)]);
    const rEbay = E.litigesDesVentes({ res, sites: new Set(['vinted', 'ebay']), ebay: null });
    dit(E.nombreLitigesPublie(rEbay) === null && rEbay.manques.includes('eBay'), 'retours eBay pas lus ⇒ rien de publié, eBay nommé', [E.nombreLitigesPublie(rEbay), rEbay.manques]);
    const rMailKo = E.litigesDesVentes({ res: L.litigesEnCours({ ventes, achats: [], emails: null, etats }), sites: new Set(['vinted']) });
    dit(E.nombreLitigesPublie(rMailKo) === null, 'e-mails pas lus ⇒ rien de publié (un compte partiel ne se présente pas complet)', E.nombreLitigesPublie(rMailKo));
    // Une date LUE : un retour eBay avec respondByDate.
    const resE = L.litigesEnCours({ ventes: [], achats: [], emails: [], ebay: [{ retour: { returnId: 'R1', etat: 'OPEN', limite: '2026-11-11T08:00:00Z', titre: 'Asics' }, compte: 'c', num: '30' }], maintenant: MAINT });
    const rE = E.litigesDesVentes({ res: resE, sites: new Set(['vinted', 'ebay']), ebay: [], maintenant: MAINT });
    dit(rE.cartes[0] && rE.cartes[0].limiteTexte && /^Avant le /.test(E.phraseLimite(rE.cartes[0])) && rE.cartes[0].presse, 'eBay : date LUE ⇒ « Avant le … », pressée (< 48 h)', rE.cartes[0]);
  });

  // ── BI ──
  essaie('BI', () => {
    const bi = E.retoursParModele({ ventes, etats, emails });
    const g = Object.fromEntries(bi.lignes.map((l) => [l.cle || 'autres', l]));
    const dunk = g['nike|dunk'], samba = g['adidas|samba'], autres = g.autres;
    dit(!!dunk && dunk.ventes === 4 && dunk.retours === 2 && dunk.litiges === 0, 'Dunk : 4 ventes (8001, 8002, 8003, 8010), 2 retours (440), la conversation seule et l’annulation hors compte', dunk);
    dit(!!dunk && dunk.inconnues === 1 && dunk.auMoins === true && E.texteRetours(dunk) === 'au moins 2 sur 4', 'Dunk : 1 remboursement à cause pas lue ⇒ « au moins 2 sur 4 »', dunk && E.texteRetours(dunk));
    dit(!!samba && samba.ventes === 3 && samba.litiges === 1 && samba.retours === 0, 'Samba : 3 ventes (annulée exclue), 1 litige relié par SA conversation, 0 pour la conversation ambiguë', samba);
    dit(!!autres && autres.nom === 'Autres' && bi.lignes[bi.lignes.length - 1].cle === '', '« Autres » (modèle pas reconnu) en dernier', bi.lignes.map((l) => l.nom));
    dit(bi.inconnues === 1, 'une seule vente à cause pas lue, nommée à part', bi.inconnues);
    dit(E.retoursParModele({ ventes: null }).etat === 'passu' && E.retoursParModele({ ventes: undefined }).etat === 'encours', 'trois états : en cours · pas su', null);
    const sansEtats = E.retoursParModele({ ventes, etats: null, emails });
    dit(sansEtats.manques.includes('l’état des transactions Vinted') && sansEtats.lignes.every((l) => l.cle !== 'nike|dunk' || l.retours === 1), 'états des transactions pas lus ⇒ nommé ; seul le « Retour initié » de la liste compte', sansEtats);
  });

  console.log(`\n${n - ko}/${n} contrôles verts.`);
  process.exit(ko ? 1 : 0);
})();
