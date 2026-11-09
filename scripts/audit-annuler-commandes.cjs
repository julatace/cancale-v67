#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT : LOT B (9 nov.) — « Annuler » au lieu d'une confirmation + ⌘K qui agit
//  Exécute le VRAI module (src/annulerCommandes.js) et lit le code de l'app.
//   A. ⌘K : les actions proposées (champ vide, mots, N° seul, N° + mots, rien pour
//      un titre), leur destination (aucune ne nomme une écriture ni un envoi) ;
//   B. champsAvant : l'état d'avant EXACT (un champ absent revient absent) ;
//   C. les confirmations REMPLACÉES ne sont plus demandées, chacune passe par
//      `gesteVrm` (la pilule « Annuler ») ;
//   D. les confirmations EXTÉRIEURES / IRRÉVERSIBLES sont toujours là ;
//   E. `lancerActionRecherche` n'écrit rien et n'envoie rien (ni save, ni vmrCmd,
//      ni fetch, ni gesteVrm).
//  Lancer : node scripts/audit-annuler-commandes.cjs
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

(async () => {
  const M = await import(path.join(R, 'src', 'annulerCommandes.js'));
  const N = await import(path.join(R, 'src', 'rechercheNumero.js'));
  const cleNum = (v) => { const s = String(v == null ? '' : v).toUpperCase().replace(/\s+/g, ''); const x = /^([A-Z]*)0*(\d+)$/.exec(s); return x ? x[1] + x[2] : s; };
  const lireNumero = (t) => N.lireNumeroCherche(t, { cleNum }, ['B']);
  const ids = (q) => M.actionsPour(q, { lireNumero }).map((a) => a.id + (a.num ? ':' + a.num : ''));

  // A. Les actions
  dit(ids('').join() === 'imprimer-jour,colis-retirer,export-comptable,ma-configuration', 'A1 champ vide : 4 actions', ids('').join());
  dit(ids('imprimer')[0] === 'imprimer-jour' && ids('impr')[0] === 'imprimer-jour', 'A2 « imprimer », « impr » ⇒ imprimer les bordereaux du jour');
  dit(ids('colis à retirer')[0] === 'colis-retirer' && ids('retirer')[0] === 'colis-retirer', 'A3 « colis à retirer » ⇒ colis-retirer en tête', ids('colis à retirer').join());
  dit(ids('Exporter pour mon comptable')[0] === 'export-comptable' && ids('export')[0] === 'export-comptable', 'A4 export comptable');
  dit(ids('ma configuration')[0] === 'ma-configuration', 'A5 Ma configuration');
  dit(ids('baisser le prix de N°88').join() === 'baisser-prix:88' && ids('prix 88').join() === 'baisser-prix:88' && ids('baisser b125')[0] === 'baisser-prix:B125', 'A6 « baisser le prix de N°88 » ⇒ baisser-prix:88 (et B125)', ids('baisser le prix de N°88').join());
  dit(ids('88').join() === 'baisser-prix:88,stock-num:88', 'A7 un N° seul : prix et Stock (la fiche est déjà « Tout sur le N° »)', ids('88').join());
  dit(ids('ouvrir 124').join() === 'ouvrir-num:124', 'A8 « ouvrir 124 » ⇒ la fiche du N°124');
  dit(!ids('nike dunk').length && !ids('nike 42').length && !ids('Air Max 90').length && !ids('a').length, 'A9 un titre, une taille, une lettre : aucune action (la recherche reste la recherche)');
  dit(!ids('baisser').some((x) => /baisser-prix/.test(x)), 'A10 une action à N° n’apparaît jamais sans N°');
  const dest = M.ACTIONS_RECHERCHE.map((a) => M.destinationAction({ id: a.id, num: a.num ? '88' : null }));
  dit(dest.every((d) => d && Object.keys(d).every((k) => ['tab', 'colis', 'feuille', 'num', 'stock'].includes(k))), 'A11 chaque action a une destination (onglet / feuille), rien d’autre', JSON.stringify(dest));
  dit(M.destinationAction({ id: 'baisser-prix', num: '88' }).feuille === 'prix' && M.destinationAction({ id: 'imprimer-jour' }).feuille === 'lot', 'A12 « baisser le prix » ouvre la feuille du prix ; « imprimer » la feuille « Tout imprimer »');

  // B. champsAvant
  const av = M.champsAvant({ buyGros: { id: 'g1' }, buyPrice: '40', numero: '88' }, { buyGros: null, buyPrice: '', autre: 1 });
  dit(egal(av, { buyGros: { id: 'g1' }, buyPrice: '40', autre: undefined }) && Object.prototype.hasOwnProperty.call(av, 'autre') && av.autre === undefined && !('numero' in av), 'B1 champsAvant : les champs touchés seulement, un champ absent revient ABSENT', JSON.stringify(av));
  const G = await import(path.join(R, 'src', 'gesteAnnulable.js'));
  const fiche = { f1: { numero: '88', buyPrice: '40', buyGros: { id: 'g1' } } };
  const patch = { buyGros: null, buyPrice: '' };
  const op = { k: 'x', type: 'champs', id: 'f1', apres: patch, avant: M.champsAvant(fiche.f1, patch) };
  const apres = G.appliquerOp(fiche, op, 'apres'); const retour = G.appliquerOp(apres, op, 'avant');
  dit(egal(retour, fiche) && apres.f1.numero === '88', 'B2 délier puis « Annuler » ⇒ la fiche EXACTE d’avant, le N° jamais touché', JSON.stringify(retour));
  const sansPrix = { f2: { numero: '9' } }; const p2 = { buyFromId: 'tx1', buyPrice: '12,00' };
  const op2 = { k: 'x', type: 'champs', id: 'f2', apres: p2, avant: M.champsAvant(sansPrix.f2, p2) };
  dit(egal(G.appliquerOp(G.appliquerOp(sansPrix, op2, 'apres'), op2, 'avant'), sansPrix), 'B3 relier puis « Annuler » ⇒ aucun champ posé ne reste');

  // C. Remplacées : plus de confirmation, un geste annulable
  const app = lire('src/App.jsx'), lbc = lire('src/ecrans/Leboncoin.jsx');
  const sans = (s) => s.replace(/\/\/[^\n]*/g, '');
  const A = sans(app), L = sans(lbc);
  dit(!/askConfirm\(\s*['"]Masquer ce bordereau/.test(A) && /gesteVrm\('Bordereau masqué'/.test(A), 'C1 masquer un bordereau : plus de confirmation, gesteVrm');
  dit(!/title:\s*'Masquer cet achat \?'/.test(A) && /gesteVrm\('Achat masqué'/.test(A), 'C2 masquer un achat : plus de confirmation, gesteVrm');
  dit(!/Marquer TOUS ces colis comme récupérés/.test(A) && /const markAllCollected = \(list\) => \{[\s\S]{0,600}gesteVrm\(/.test(A), 'C3 tout marquer retiré : plus de confirmation, gesteVrm');
  dit(!/Marquer cet article VENDU/.test(A) && !/Réafficher toutes les annonces marquées vendues \?/.test(A) && /const gesteVendues = [\s\S]{0,700}gesteVrm\(/.test(A), 'C4 marquer vendue / réafficher : gesteVrm');
  dit(!/window\.confirm\(`(Ce n'est pas la|Retirer le lien avec la) N°/.test(L) && /function gesteDelierLbc[\s\S]{0,900}gesteVrm\(/.test(L) && (L.match(/gesteDelierLbc\(/g) || []).length >= 3, 'C5 délier Leboncoin : plus de confirmation, gesteVrm (deux boutons)');
  dit(!/title: `Délier le N°\$\{e\.numero\} \?`/.test(A) && /délié[\s\S]{0,200}type: 'champs'[\s\S]{0,120}champsAvant\(e, patch\)/.test(A), 'C6 délier un achat en gros : gesteVrm, champs d’avant');
  dit(/gesteVrm\(`N°\$\{f\.numero\} relié`/.test(A), 'C7 relier un achat : la pilule « Annuler »');

  // D. Gardées : extérieures ou irréversibles
  const ebay = sans(lire('src/ecrans/Ebay.jsx')), rep = sans(lire('src/ecrans/Republier.jsx'));
  const gardees = [
    ['Supprimer de Leboncoin', /title: l\.length > 1 \? `Supprimer \$\{l\.length\} annonces de Leboncoin \?`/.test(A)],
    ['Vérifier avant impression', /askConfirm\(\{title:'Vérifier les articles avant impression'/.test(A)],
    ['Accepter une offre Vinted', /askConfirm\(\{ title: `Accepter \$\{fmtE\(off\.prix\)\} \?`/.test(A)],
    ['Acceptation auto des offres', /askConfirm\(\{ title: 'Accepter les offres tout seul sur Vinted \?'/.test(A)],
    ['Supprimer une annonce eBay', /askConfirm\(\{title:'Supprimer cette annonce d’eBay \?'/.test(ebay)],
    ['Mettre un brouillon en ligne (Vinted)', /askConfirm\(\{ title: 'Mettre ce brouillon en ligne \?'/.test(rep)],
    ['Nouveau N° (carton)', /title: `Nouveau numéro pour « \$\{it\.title\} »`/.test(A)],
    ['Déclarer perdu', /Déclarer l'article N°\$\{n\} PERDU \?/.test(A)],
    ['Déconnecter un compte Vinted', /askConfirm\(\{title:`Déconnecter « \$\{accNameOf\(a\)\} » \?`/.test(A)],
    ['Restaurer une sauvegarde', /askConfirm\(`Restaurer cette sauvegarde \?/.test(A)],
    ['Vestiaire « Un seul N° »', /title: `Un seul N° : N°\$\{numVinted\}`/.test(A)],
  ];
  for (const [nom, c] of gardees) dit(c, `D la confirmation reste : ${nom}`);
  dit(M.CONFIRMATIONS.filter((c) => c.decision === 'annuler').length === 8 && M.CONFIRMATIONS.every((c) => c.pourquoi && c.geste && ['annuler', 'gardee'].includes(c.decision)), 'D l’inventaire dit chaque décision et sa raison', String(M.CONFIRMATIONS.length));

  // E. Les actions de la loupe n'écrivent rien, n'envoient rien
  const m = /const lancerActionRecherche = \(a, qBrut\) => \{([\s\S]*?)\n  \};/.exec(A);
  dit(!!m, 'E1 lancerActionRecherche existe');
  const corps = m ? m[1] : '';
  dit(m && !/\bsave\(|vmrCmd|fetch\(|gesteVrm|cloudPush|askConfirm|appliquerPrix|batchBordereaux|ouvrirLot\(/.test(corps), 'E2 elle n’écrit rien et n’envoie rien (ni save, ni vmrCmd, ni fetch, ni impression)');
  dit(/const actionsGs = actionsPour\(qBrut/.test(A) && /data-recherche-action=\{a\.id\}/.test(A) && /className="vrm-recherche-ligne" onClick=\{\(\)=>lancerActionRecherche/.test(A), 'E3 la loupe rend les actions comme ses lignes (vrm-recherche-ligne : ↑ ↓ Entrée)');
  dit(/\{q && estNumQ && <ToutSurLeNumero[\s\S]{0,700}\}\/>\}\s*\{q && estNumQ && blocActions\}/.test(A), 'E4 un N° tapé : « Tout sur le N° » reste en tête, les actions après');

  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
function egal(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
