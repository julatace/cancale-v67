// ⚠️⚠️ CONTRÔLE PERMANENT — « CETTE VENTE ATTEND-ELLE MON ENVOI ? » : UNE RÉPONSE.
//
// Mesuré le 4 octobre sur sa vraie base : pour 3 colis réellement à poster,
// Colis en annonçait 2, Ma journée 3, la cloche 3 et le widget iPhone 6 ; la
// liste des ventes écrivait « En transit » sur un colis encore sur l'étagère
// (« Bordereau envoyé au vendeur ») et « Livrée » sur un colis qui attend au
// relais (« La livraison n'a pas encore eu lieu… ») ; et la vente que l'app
// venait de faire générer (« Bordereau d'envoi commandé ») disparaissait de
// Colis dès que son PDF arrivait.
//
// Vinted fournit pourtant un champ MACHINE, `transaction_user_status`, présent
// sur 1 505 lignes sur 1 505, qui découpe les neuf libellés sans exception.
// Ce contrôle EXÉCUTE les vraies règles — l'app (src/App.jsx), l'extension
// (background.js) et le widget (api/widget.js), extraites par l'analyseur
// Babel, jamais recopiées — sur le corpus MESURÉ (libellés exacts), et exige :
//   · une seule réponse à « à expédier ? », identique aux trois endroits ;
//   · des étiquettes qui ne contredisent pas cette réponse ;
//   · le résumé que l'extension pose pour le widget = la même règle.
// Aucune donnée réelle : seuls des LIBELLÉS de statut Vinted, aucun acheteur.
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log(`${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };
const essaie = (m, f) => { try { f(); } catch (e) { dit(false, m, String(e && e.message || e).slice(0, 180)); } };

let parser;
try { parser = require(path.join(R, 'node_modules', '@babel', 'parser')); }
catch (e) { console.log('❌ analyseur Babel introuvable — ' + e.message); process.exit(1); }

// Le source exact d'une déclaration (const / function) par son nom.
function sources(fichier, noms, opts) {
  const src = fs.readFileSync(path.join(R, fichier), 'utf8');
  const ast = parser.parse(src, Object.assign({ sourceType: 'module', plugins: ['jsx'], errorRecovery: true }, opts || {}));
  const trouve = {};
  const visite = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(visite); return; }
    if (n.type === 'VariableDeclaration') {
      for (const d of n.declarations) {
        const nom = d.id && d.id.name;
        if (nom && noms.includes(nom) && !trouve[nom]) trouve[nom] = 'const ' + src.slice(d.start, d.end) + ';';
      }
    }
    if (n.type === 'FunctionDeclaration' && n.id && noms.includes(n.id.name) && !trouve[n.id.name]) trouve[n.id.name] = src.slice(n.start, n.end);
    for (const k of Object.keys(n)) { if (k === 'loc' || k === 'start' || k === 'end') continue; const v = n[k]; if (v && typeof v === 'object') visite(v); }
  };
  visite(ast.program);
  return trouve;
}
function charge(fichier, noms, base, opts) {
  const t = sources(fichier, noms, opts);
  const ctx = Object.assign({}, base || {});
  vm.createContext(ctx);
  for (const nom of noms) {
    if (!t[nom]) continue;
    try { vm.runInContext(t[nom].replace(/^export\s+/, '') + `\nthis.${nom} = ${nom};`, ctx); } catch (_) { /* une dépendance manque : la fonction reste absente, le contrôle le dira */ }
  }
  return ctx;
}

// ── LE CORPUS MESURÉ (libellés exacts, 4 octobre) ─────────────────────────────
// Ventes (`harvest_*_orders_sold`) : (transaction_user_status, status) → n.
const VENTES = [
  ['completed', "Commande finalisée - l'acheteur a validé la commande"],
  ['failed', 'Remboursement effectué'],
  ['needs_action', 'Bordereau envoyé au vendeur'],
  ['needs_action', "Bordereau d'envoi commandé"],
  ['needs_action', 'Le paiement a été validé'],
  ['waiting', "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais"],
  ['waiting', "Commande expédiée et en cours d'acheminement ! "],
  ['waiting', 'Retour initié'],
  ['waiting', "Commande non réclamée - Retournée à l'expéditeur.rice"],
  // Vus ailleurs : l'ancienne tournure du 1er septembre, et le statut 220 des
  // détails de transaction (le champ machine y vaudrait `failed`).
  ['needs_action', "Commande du bordereau d'envoi validée"],
  ['failed', 'Le paiement a échoué'],
];
// Achats (`harvest_*_orders_purchased`) au relais : `needs_action` = « va retirer ».
const ACHAT_RELAIS = { status: "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais", transaction_user_status: 'needs_action' };

const C = { warn: '#a', danger: '#b', muted: '#c', blue: '#d', accent: '#e' };
const APP_NOMS = ['classifyOrderStatus', 'isAtRelayStatus', 'isAwaitingShipStatus', 'needsBordereau', 'PAS_UN_ENVOI', 'tusDe', 'aExpedier', 'joursAvantLimiteFr', 'DELAI_EXPEDITION_J'];
const app = charge('src/App.jsx', APP_NOMS);
// Les étiquettes vivent dans un composant : on les charge avec leurs voisins.
const appComp = charge('src/App.jsx', ['venteStage', 'achatStage', 'purchasePhase', 'bordShipped'], Object.assign({}, app, {
  C, INV_STATUS: { online: { color: '#f' } },
  venteExpediee: () => false,
  shippedSuivis: new Set(), soldByTxn: {},
}));
const ext = charge('vinted-sync-extension/background.js', ['AWAITING_SHIP', 'AT_RELAY', 'PAS_UN_ENVOI', 'besoinBordereauTexte', 'A_EXPEDIER', 'resumeCommandes'], {}, { sourceType: 'script', plugins: [] });
const wid = charge('api/widget.js', ['awaitingShip', 'PAS_UN_ENVOI', 'besoinBordereauTexte', 'aExpedier'], {});

// La réponse « à expédier ? » de chacun. Sur le code d'avant, la règle unique
// n'existe pas : on mesure alors ce que chaque écran faisait vraiment.
const appA = (o) => app.aExpedier ? app.aExpedier(o) : app.needsBordereau(o.status);          // Ma journée / cloche
const colisA = (o) => appComp.bordShipped ? (() => { appComp.soldByTxn['1'] = o; return !appComp.bordShipped({ transaction: '1' }); })() : appA(o); // Colis
const extA = (o) => ext.A_EXPEDIER ? ext.A_EXPEDIER(o) : ext.AWAITING_SHIP(o.status);
const widA = (o) => wid.aExpedier ? wid.aExpedier(o) : wid.awaitingShip(o.status);

essaie('les règles se chargent', () => {
  dit(typeof app.needsBordereau === 'function' && typeof ext.AWAITING_SHIP === 'function' && typeof wid.awaitingShip === 'function', 'les règles de l\'app, de l\'extension et du widget sont lues dans leurs fichiers');
});

// (a) Avec le champ machine : needs_action ⇔ à expédier, partout, et partout pareil.
essaie('(a) champ machine', () => {
  const faux = [];
  for (const [tus, status] of VENTES) {
    const o = { status, transaction_user_status: tus };
    const attendu = tus === 'needs_action';
    const r = { app: appA(o), colis: colisA(o), ext: extA(o), widget: widA(o) };
    for (const [qui, v] of Object.entries(r)) if (v !== attendu) faux.push(`${qui} : « ${status.trim()} » → ${v}`);
  }
  dit(faux.length === 0, '« à expédier » = les ventes que Vinted marque `needs_action`, dans l\'app, Colis, l\'extension ET le widget', faux.slice(0, 6).join(' · '));  // Une tournure que personne n'a encore vue : c'est le champ machine qui
  // décide, pas une ressemblance de texte (le défaut de « commandé »).
  const neufs = [{ status: 'Colis pris en charge par le relais de départ', transaction_user_status: 'waiting', attendu: false },
    { status: 'Étiquette disponible pour ton envoi', transaction_user_status: 'needs_action', attendu: true }];
  const fauxNeufs = neufs.filter((o) => [appA(o), colisA(o), extA(o), widA(o)].some((v) => v !== o.attendu)).map((o) => `« ${o.status} » (${o.transaction_user_status}) → ${JSON.stringify([appA(o), colisA(o), extA(o), widA(o)])}`);
  dit(fauxNeufs.length === 0, 'une tournure jamais vue : c\'est le champ machine qui décide, partout', fauxNeufs.join(' · '));
});

// (a2) Sans le champ (vieille capture) : la même réponse aux trois endroits, et juste sur les libellés connus.
essaie('(a2) sans champ machine', () => {
  const faux = [];
  for (const [tus, status] of VENTES) {
    const o = { status };
    const attendu = tus === 'needs_action';
    const r = { app: appA(o), colis: colisA(o), ext: extA(o), widget: widA(o) };
    for (const [qui, v] of Object.entries(r)) if (v !== attendu) faux.push(`${qui} : « ${status.trim()} » → ${v}`);
  }
  dit(faux.length === 0, 'sans le champ (vieille capture), le texte seul donne la même réponse partout', faux.slice(0, 6).join(' · '));
  // Un libellé que personne ne connaît encore : app, extension et widget d'accord.
  const inconnu = { status: 'Préparation de la commande en cours' };
  const vs = [appA(inconnu), extA(inconnu), widA(inconnu)];
  dit(vs.every((v) => v === vs[0]), 'un libellé inconnu reçoit la même réponse dans l\'app, l\'extension et le widget', JSON.stringify(vs));
});

// (a3) Un texte qui dit « remboursé / retour / annulé » gagne sur `needs_action`.
essaie('(a3) texte qui exclut', () => {
  const o = { status: 'Retour demandé - accepte ou refuse le retour', transaction_user_status: 'needs_action' };
  dit(!appA(o) && !extA(o) && !widA(o), 'si Vinted réutilise `needs_action` pour « accepte le retour », ce n\'est pas un colis à poster', JSON.stringify([appA(o), extA(o), widA(o)]));
});

// (b)(c) Les étiquettes ne contredisent pas la règle.
essaie('(b) étiquettes des ventes', () => {
  const lab = (status, tus) => appComp.venteStage({ status, transaction_user_status: tus, transaction_id: 1 }).label;
  for (const tus of ['needs_action', undefined]) {
    const l = lab('Bordereau envoyé au vendeur', tus);
    dit(l === 'À expédier', `« Bordereau envoyé au vendeur » s'affiche « À expédier »${tus ? '' : ' (sans le champ machine)'}, jamais « En transit » : le colis est encore chez lui`, l);
  }
  const relais = lab(VENTES[5][1], 'waiting');
  dit(relais === 'Au relais', '« La livraison n\'a pas encore eu lieu - colis déposé… » s\'affiche « Au relais », jamais « Livrée »', relais);
  const route = lab(VENTES[6][1], 'waiting');
  dit(route === 'En transit', '« Commande expédiée et en cours d\'acheminement » s\'affiche « En transit »', route);
  const commande = lab("Bordereau d'envoi commandé", 'needs_action');
  dit(commande === 'À expédier', '« Bordereau d\'envoi commandé » s\'affiche « À expédier »', commande);
  const nr = lab(VENTES[8][1], 'waiting');
  dit(nr !== 'Remboursée' && nr !== 'Annulée', '« Commande non réclamée - Retournée… » n\'est ni « Remboursée » ni « Annulée » (le remboursement n\'est pas établi)', nr);
  const echec = lab('Le paiement a échoué', 'failed');
  dit(echec !== 'À expédier', '« Le paiement a échoué » n\'est pas « À expédier »', echec);
  // Toute vente à expédier selon la règle porte l'étiquette « À expédier ».
  const desaccords = VENTES.filter(([tus, s]) => appA({ status: s, transaction_user_status: tus }) !== (lab(s, tus) === 'À expédier')).map(([, s]) => s.trim());
  dit(desaccords.length === 0, 'sur tout le corpus, l\'étiquette « À expédier » ⇔ la règle', desaccords.join(' · '));
});
essaie('(c) étiquette d\'un achat au relais', () => {
  const st = appComp.achatStage(ACHAT_RELAIS, null);
  dit(st.label === 'À retirer' && st.step === 3, 'un achat « colis déposé en point relais » s\'affiche « À retirer » (étape 3 : lieu, code et QR visibles), jamais « Reçu »', JSON.stringify(st));
});

// (d) Le paiement échoué ne compte nulle part.
essaie('(d) paiement échoué', () => {
  const o = { status: 'Le paiement a échoué' };
  dit(!appA(o) && !extA(o) && !widA(o), '« Le paiement a échoué » n\'est un colis à poster nulle part, même sans le champ machine', JSON.stringify([appA(o), extA(o), widA(o)]));
  dit(app.classifyOrderStatus('Le paiement a échoué') === 'cancelled', '… et ce n\'est pas une vente « en cours »', app.classifyOrderStatus('Le paiement a échoué'));
});

// (e) Colis ne fait plus disparaître la vente qui vient d'être commandée.
essaie('(e) Colis', () => {
  const o = { status: "Bordereau d'envoi commandé", transaction_user_status: 'needs_action' };
  dit(colisA(o) === true, 'Colis garde la vente « Bordereau d\'envoi commandé » quand son PDF arrive (elle attend toujours l\'envoi)', String(colisA(o)));
});

// (f) Le résumé que l'extension pose pour le widget suit la même règle.
essaie('(f) résumé de l\'extension', () => {
  const my_orders = VENTES.map(([tus, status], i) => ({ transaction_id: 100 + i, status, transaction_user_status: tus }));
  const r = ext.resumeCommandes('orders_sold', { my_orders });
  const attendu = my_orders.filter((o) => o.transaction_user_status === 'needs_action').map((o) => String(o.transaction_id));
  dit(r && JSON.stringify(r.txns) === JSON.stringify(attendu), 'le résumé « à expédier » posé pour le widget = exactement les ventes `needs_action`', JSON.stringify(r && r.txns));
  const ra = ext.resumeCommandes('orders_purchased', { my_orders: [Object.assign({ transaction_id: 7 }, ACHAT_RELAIS)] });
  dit(ra && ra.txns.length === 1, 'côté achats, le résumé « à retirer » garde le colis au relais', JSON.stringify(ra && ra.txns));
});

// (g) Le délai : 7 jours mesurés, et la date limite de l'email d'abord.
essaie('(g) délai', () => {
  dit(Number(app.DELAI_EXPEDITION_J) >= 7, 'le délai d\'expédition estimé est d\'au moins 7 jours (mesuré : jamais moins sur 176 bordereaux)', String(app.DELAI_EXPEDITION_J));
  const src = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
  const i = src.indexOf('const toShip = useMemo(');
  const corps = i >= 0 ? src.slice(i, src.indexOf('\n  }, [', i)) : '';
  dit(/joursAvantLimiteFr\(\s*b\.dateLimite\s*\)/.test(corps), 'le rappel de Ma journée prend la date limite écrite dans l\'email du bordereau quand il l\'a');
  dit(/aExpedier\(o\)/.test(corps) && /isBordDone\(b\)/.test(corps), 'Ma journée applique la même règle et les mêmes sorties que Colis (bordereau marqué expédié, suivi transporteur)');
  const d = new Date(); d.setDate(d.getDate() + 2);
  const fr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  dit(app.joursAvantLimiteFr(fr) === 2, 'une date limite dans deux jours donne 2 jours restants', String(app.joursAvantLimiteFr(fr)));
});

console.log(`\n${ko ? `❌ ${ko} échec(s)` : '✅ tout est vert'}`);
process.exit(ko ? 1 : 0);
