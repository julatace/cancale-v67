// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « LA VENTE VUE PAR E-MAIL, PAS ENCORE RELUE SUR VINTED » (6 nov.)
//  Récit : docs/passation/2026-11-06-vente-email-fraiche.md.
//  Il EXÉCUTE la règle (src/venteEmailFraiche.js) sur des données INVENTÉES
//  (le dépôt est public), puis les règles de l'app qui la reçoivent
//  (`classifyOrderStatus`, `ventesFaites`, `ventesDeclarables`, extraites de
//  src/App.jsx), et la ligne de fraîcheur des comptes (src/fraicheurComptes.js) :
//   F1 une vente e-mail sans n° de transaction numérique ⇒ rien ;
//   F2 n° déjà dans la liste Vinted (de CE compte ou d'un autre) ⇒ UNE ligne,
//      la ligne Vinted ;
//   F3 e-mail plus vieux que la dernière lecture ⇒ rien (la lecture fait foi) ;
//   F4 compte non lié, écarté (son choix), liste pas lue, lecture non datée ⇒ rien ;
//   F5 un e-mail de STATUT (« Commande mise à jour », tout type ≠ vente) ⇒ rien ;
//   F6 le cas mesuré (vente e-mail fraîche) ⇒ une ligne, datée, son compte, son
//      prix, son statut ; deux e-mails du même n° ⇒ une ligne ;
//   F7 elle compte dans VENDU (`ventesFaites`) et JAMAIS dans le CA déclaré
//      (`ventesDeclarables`, daté au versement) ; « en cours », jamais annulée ;
//   F8 l'écran : la liste et VENDU lisent la liste fusionnée ; Colis, numéros et
//      CA déclaré lisent la liste Vinted seule ; aucun N° pris d'un bordereau ;
//   F9 l'indicateur : ventes plus vieilles que les annonces (> 1 h) ⇒ dit, daté
//      (heure de Paris), avec le geste ; sinon rien ; une date manquante ⇒ rien.
//  `--prouve` : chaque mutation réaffaiblit une règle ⇒ l'audit doit tomber.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { pathToFileURL } = require('url');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

if (process.argv.includes('--prouve')) {
  prouver(__filename, path.join(__dirname, '..'), {
    'sans la condition « après la lecture »': [['src/venteEmailFraiche.js', 'if (!(p.t > lu)) continue;', '']],
    'n° non numérique admis': [['src/venteEmailFraiche.js', 'if (!RE_TX_VENTE_EMAIL.test(tx)) return null;', '']],
    'tout type admis (un statut entre)': [['src/venteEmailFraiche.js', "if (String(m.type || '') !== 'vente') return null;", '']],
    'compte non lié admis': [['src/venteEmailFraiche.js', 'const acc = parUid.get(p.uid); if (!acc) continue;', "const acc = parUid.get(p.uid) || { vinted_user_id: p.uid };"]],
    'compte écarté admis': [['src/venteEmailFraiche.js', "if (typeof ecarte === 'function' && ecarte(p.uid)) continue;", '']],
    'deux lignes pour un n°': [['src/venteEmailFraiche.js', "const ajout = fraiches.filter((o) => o && !connues.has(String(o.transaction_id)));", 'const ajout = fraiches.filter(Boolean);']],
    'la liste de Ventes sans les ventes e-mail': [['src/App.jsx', 'let arr = (ventesListe || [])', 'let arr = (sales.items || [])']],
    'le CA déclaré reçoit les ventes e-mail': [['src/App.jsx', 'const decl = ventesDeclarables({ vinted: ventes, lbc, ebay, vestiaire, masquee', 'const decl = ventesDeclarables({ vinted: ventesVendu || ventes, lbc, ebay, vestiaire, masquee']],
    'ventes en retard jamais dites': [['src/fraicheurComptes.js', 'return v != null && a != null && a - v > RETARD_VENTES_MS;', 'return false;']],
  });
  return;
}

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + String(d).slice(0, 400) : ''}`); };

// ── Les fonctions de l'app (Babel), comme audit-statuts ─────────────────────
let parser;
try { parser = require(path.join(__dirname, '..', 'node_modules', '@babel', 'parser')); }
catch (e) { console.log('❌ analyseur Babel introuvable — ' + e.message); process.exit(1); }
const SRC_APP = require("./_source-app.cjs").sourceAppDe(path.join(R, 'src', 'App.jsx'));
function charge(noms) {
  const ast = parser.parse(SRC_APP, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  const trouve = {};
  const visite = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(visite); return; }
    if (n.type === 'VariableDeclaration' && n.kind === 'const') for (const d of n.declarations) { const nom = d.id && d.id.name; if (nom && noms.includes(nom) && !trouve[nom]) trouve[nom] = 'const ' + SRC_APP.slice(d.start, d.end) + ';'; }
    if (n.type === 'FunctionDeclaration' && n.id && noms.includes(n.id.name) && !trouve[n.id.name]) trouve[n.id.name] = SRC_APP.slice(n.start, n.end);
    for (const k of Object.keys(n)) { if (k === 'loc' || k === 'start' || k === 'end') continue; const v = n[k]; if (v && typeof v === 'object') visite(v); }
  };
  visite(ast.program);
  const ctx = { load: () => ({}), console };
  vm.createContext(ctx);
  for (const nom of noms) { if (!trouve[nom]) continue; try { vm.runInContext(trouve[nom] + `\nthis.${nom} = ${nom};`, ctx); } catch (_) {} }
  return ctx;
}
const APP = charge(['classifyOrderStatus', 'venteFinalisee', 'tsCommande', 'montantCommandeLu', 'ymDeTs', 'indexDeclarations', 'moisDeclare', 'ventesFaites', 'ventesDeclarables']);

(async () => {
  let M = null, F = null;
  try { M = await import(pathToFileURL(path.join(R, 'src', 'venteEmailFraiche.js')).href); } catch (e) { dit(false, 'la règle existe (src/venteEmailFraiche.js)', e.message); }
  try { F = await import(pathToFileURL(path.join(R, 'src', 'fraicheurComptes.js')).href); } catch (e) { dit(false, 'src/fraicheurComptes.js se charge', e.message); }
  const fraiches = M && typeof M.ventesEmailFraiches === 'function' ? M.ventesEmailFraiches : () => null;
  const fusion = M && typeof M.avecVentesEmail === 'function' ? M.avecVentesEmail : (v) => v;

  // ── Le jeu inventé ─────────────────────────────────────────────────────────
  const T0 = Date.parse('2026-11-06T08:00:00Z');
  const h = (n) => new Date(T0 - n * 3600e3).toISOString();
  const A = { vinted_user_id: '9001', login: 'boutique_a' }, B = { vinted_user_id: '9002', login: 'boutique_b' };
  const comptes = [A, B];
  const lectures = { 9001: T0 - 18 * 3600e3, 9002: T0 - 1 * 3600e3 };   // A relue il y a 18 h, B il y a 1 h
  const venteV = (tx, acc, j) => ({ transaction_id: tx, title: 'Paire inventée ' + tx, price: { amount: '50.0', currency_code: 'EUR' }, status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', date: h(j), _acc: acc });
  const ventes = [venteV(70000001, A, 30), venteV(70000002, B, 5)];
  const mail = (o) => ({ id: 'email_sale_x' + Math.random().toString(16).slice(2, 8), type: 'vente', tx: '70000099', uid: '9001', at: h(0.2), titre: 'Baskets inventées taille 42', prix: '45.00', ...o });
  const base = { comptes, ventes, lectures, ko: [], ecarte: () => false };
  const n = (mails, x = {}) => { const r = fraiches({ ...base, ...x, mails }); return Array.isArray(r) ? r.length : -1; };

  // F6 · le cas mesuré
  const r6 = fraiches({ ...base, mails: [mail()] }) || [];
  const l6 = r6[0] || {};
  dit(r6.length === 1 && l6.transaction_id === '70000099' && l6._venteEmail === true && l6._acc === A, 'F6 la vente e-mail fraîche (n° prouvé, compte lié, après la lecture) ⇒ UNE ligne, sur SON compte', JSON.stringify(r6));
  dit(l6.date === h(0.2) && l6.price && l6.price.amount === '45.00' && l6.price.currency_code === 'EUR', 'F6 datée à l\'arrivée de l\'e-mail, au prix de l\'e-mail (objet {amount})', JSON.stringify(l6));
  dit(M && l6.status === M.STATUT_VENTE_EMAIL && /pas encore relue sur Vinted/.test(String(l6.status)), 'F6 son statut DIT qu\'elle n\'est pas encore relue sur Vinted', l6.status);
  dit(n([mail(), mail({ at: h(0.1) })]) === 1, 'F6 deux e-mails du même n° (une copie transférée) ⇒ une ligne', n([mail(), mail({ at: h(0.1) })]));
  dit((fraiches({ ...base, mails: [mail({ at: h(0.1) }), mail({ at: h(0.3) })] }) || [])[0]?.date === h(0.3), 'F6 la plus ancienne date des deux e-mails', JSON.stringify(fraiches({ ...base, mails: [mail({ at: h(0.1) }), mail({ at: h(0.3) })] })));
  dit(n([mail({ prix: 'n/c' })]) === 1 && (fraiches({ ...base, mails: [mail({ prix: 'n/c' })] }) || [])[0]?.price?.amount === null, 'F6 un prix illisible ⇒ `null` (jamais 0 €)', '');

  // F1 · sans n° numérique
  dit(n([mail({ tx: '' })]) === 0 && n([mail({ tx: null })]) === 0 && n([mail({ tx: 'mail:9001:x' })]) === 0 && n([mail({ tx: '12345' })]) === 0, 'F1 sans n° de transaction numérique (vide, absent, inventé, trop court) ⇒ rien', [n([mail({ tx: '' })]), n([mail({ tx: 'mail:9001:x' })]), n([mail({ tx: '12345' })])].join(','));

  // F2 · déjà dans la liste Vinted
  dit(n([mail({ tx: '70000001' })]) === 0, 'F2 n° déjà dans la liste Vinted de CE compte ⇒ aucune ligne e-mail', '');
  dit(n([mail({ tx: '70000002', uid: '9001' })]) === 0, 'F2 n° déjà dans la liste d\'un AUTRE compte ⇒ aucune ligne e-mail (l\'identité est le n°)', '');
  const avant = fraiches({ ...base, mails: [mail()] }) || [];
  const releve = [...ventes, venteV(70000099, A, 0.1)];
  const fus = fusion(releve, avant) || [];
  const parTx = fus.filter((o) => String(o.transaction_id) === '70000099');
  dit(parTx.length === 1 && !parTx[0]._venteEmail, 'F2 la liste relue porte le n° ⇒ UNE ligne, la ligne Vinted (la ligne e-mail sort)', JSON.stringify(parTx));
  const fus2 = fusion(ventes, avant) || [];
  dit(fus2.length === 3 && fus2.filter((o) => o._venteEmail).length === 1, 'F2 avant la relecture : la liste + la ligne e-mail, une seule fois', fus2.length);
  dit(fusion(null, avant) === null, 'F2 une liste « pas su » reste « pas su » (rien ajouté)', JSON.stringify(fusion(null, avant)));

  // F3 · plus vieux que la lecture
  dit(n([mail({ at: h(19) })]) === 0, 'F3 e-mail arrivé AVANT la dernière lecture du compte ⇒ rien (la lecture fait foi)', '');
  dit(n([mail({ uid: '9002', at: h(2) })]) === 0 && n([mail({ uid: '9002', at: h(0.5) })]) === 1, 'F3 même règle compte par compte (B relu il y a 1 h : 2 h ⇒ rien, 30 min ⇒ une ligne)', [n([mail({ uid: '9002', at: h(2) })]), n([mail({ uid: '9002', at: h(0.5) })])].join(','));

  // F4 · compte
  // Une lecture datée existe pour 9999 (une ligne `orders_sold` restée en base) : seul « lié » l'écarte.
  dit(n([mail({ uid: '9999' })], { lectures: { ...lectures, 9999: T0 - 48 * 3600e3 } }) === 0, 'F4 compte non lié (même avec une vieille liste en base) ⇒ rien', '');
  dit(n([mail()], { ecarte: (u) => u === '9001' }) === 0, 'F4 compte écarté (masqué, hors des totaux : son choix) ⇒ rien', '');
  dit(n([mail()], { ko: ['9001'] }) === 0, 'F4 liste du compte pas lue (pas su) ⇒ rien', '');
  dit(n([mail()], { lectures: {} }) === 0, 'F4 aucune lecture datée du compte ⇒ rien (on ne peut juger « après »)', '');
  dit(n([mail({ uid: '' })]) === 0, 'F4 e-mail sans compte de réception ⇒ rien', '');
  dit(n([mail()], { ventes: null }) === 0 && n(null) === 0 && n(undefined) === 0, 'F4 ventes ou e-mails « pas su » ⇒ rien', '');

  // F5 · un statut
  dit(n([mail({ type: 'commande-mise-a-jour' })]) === 0 && n([mail({ type: 'statut' })]) === 0 && n([mail({ type: 'achat' })]) === 0 && n([mail({ type: '' })]) === 0, 'F5 un e-mail de statut (« Commande mise à jour »…) ou d\'achat ⇒ rien', '');

  // F7 · Vendu oui, CA déclaré non
  const st = M ? M.STATUT_VENTE_EMAIL : '';
  dit(typeof APP.classifyOrderStatus === 'function' && APP.classifyOrderStatus(st) === 'pending', 'F7 son statut est « en cours » (ni finalisée, ni annulée)', APP.classifyOrderStatus && APP.classifyOrderStatus(st));
  if (typeof APP.ventesFaites === 'function' && typeof APP.ventesDeclarables === 'function') {
    const liste = fusion(ventes, avant) || [];
    const vf = APP.ventesFaites({ vinted: liste });
    dit(vf.lignes.length === 3 && vf.lignes.some((l) => l.tx === '70000099' && l.eur === 45 && l.ts === Date.parse(h(0.2))), 'F7 VENDU la compte : 45 €, au jour de l\'e-mail', JSON.stringify(vf.lignes));
    const d = APP.ventesDeclarables({ vinted: liste, versements: { 70000099: h(0.1) } });
    const tous = [...d.lignes, ...d.aDater, ...d.ecartees].map((l) => String(l.id));
    dit(!tous.includes('vinted:70000099'), 'F7 le CA déclaré ne la voit JAMAIS (pas finalisée, même avec une date de versement)', JSON.stringify(tous));
  } else dit(false, 'F7 `ventesFaites` et `ventesDeclarables` se chargent depuis src/App.jsx', '');

  // F8 · l'écran
  const S = sansCommentaires(SRC_APP);
  dit(/const ventesListe = useMemo\(\(\) => avecVentesEmail\(sales\.items, ventesEmail\)/.test(S), 'F8 la liste de l\'écran Ventes = liste Vinted + ventes e-mail fraîches (`avecVentesEmail`)', '');
  dit(/const ventesAffichees = useMemo\(\(\) => \{[\s\S]{0,200}let arr = \(ventesListe \|\| \[\]\)/.test(S), 'F8 « ventesAffichees » part de la liste fusionnée', '');
  dit(/const vendus = useMemo\(\(\) => ventesFaites\(\{ vinted: ventesListe \|\| \[\]/.test(S), 'F8 VENDU (Ventes, Ma journée) lit la liste fusionnée', '');
  dit(/ventesFaites\(\{ vinted: ventesCoqueEmail,/.test(S) && /ventesFaites\(\{ vinted: ventesVendu \|\| ventes,/.test(S), 'F8 VENDU de la coque et « Vendu et reçu » aussi', '');
  dit(!/ventesDeclarables\(\{[^}]*vinted: (ventesListe|ventesCoqueEmail|ventesVendu)/.test(S) && !/aVenirCoque\(\{ vinted: ventesCoqueEmail/.test(S), 'F8 le CA déclaré et l\'argent à venir ne reçoivent jamais la liste fusionnée', '');
  dit(/publierVentesCoque\(ventesCoque, ventesKO\)/.test(S), 'F8 la coque publie la liste Vinted SEULE (numéros, colis, annulations la lisent)', '');
  dit(/const peutDeposer = !o\._venteEmail &&/.test(S) && /if \(o\._venteEmail && \(vFilter === 'aexpedier' \|\| vFilter === 'transit'\)\) return false;/.test(S), 'F8 une vente e-mail n\'a aucun geste d\'envoi et n\'est ni « à expédier » ni « en transit »', '');
  const modSrc = sansCommentaires(fs.existsSync(path.join(R, 'src', 'venteEmailFraiche.js')) ? fs.readFileSync(path.join(R, 'src', 'venteEmailFraiche.js'), 'utf8') : '');
  dit(modSrc.length > 0 && !/numero|bord/i.test(modSrc), 'F8 la règle ne lit aucun N° (ni d\'un bordereau, ni du titre) : le N° passe par l\'identité', '');
  dit(/select=id,type:meta->>type,tx:meta->>transaction/.test(modSrc) && !/select=data/.test(modSrc), 'F8 lecture projetée (`meta->>`), jamais `select=data`', '');
  dit(/gesteVenteEmail\(dans\)/.test(S) && /motsNavigateur|NAV\.dans/.test(S) && !/Mes commandes[^`'"]*Chrome/.test(S + modSrc), 'F8 le geste nomme le navigateur par `motsNavigateur` (jamais « Chrome » en dur)', '');

  // F9 · l'indicateur
  if (F && typeof F.ligneFraicheur === 'function') {
    const maint = Date.parse('2026-11-06T08:00:00Z');
    const c = { plateforme: 'vinted', id: '9001', nom: 'boutique_a', lu: maint - 60e3, ouvert: true, ventesLu: Date.parse('2026-11-05T14:11:00Z'), annoncesLu: maint - 10 * 60e3 };
    const l = F.ligneFraicheur(c, { maintenant: maint, dans: 'dans Orion' });
    dit(l.ventesRetard && l.geste === true && /ventes relues hier 15 h 11/.test(l.bloque) && /Mes commandes/.test(l.bloque) && /dans Orion/.test(l.bloque), 'F9 ventes figées la veille, annonces fraîches ⇒ « ventes relues hier 15 h 11 » (heure de Paris) + le geste, en ambre', JSON.stringify(l));
    dit(!/relu à chaque passage/.test(l.bloque), 'F9 « relu à chaque passage » ne se dit plus quand ses ventes sont en retard', l.bloque);
    const l2 = F.ligneFraicheur({ ...c, ventesLu: maint - 40 * 60e3 }, { maintenant: maint, dans: 'dans Orion' });
    dit(!l2.ventesRetard && !/ventes relues/.test(l2.bloque), 'F9 ventes à moins d\'une heure des annonces ⇒ rien de plus', JSON.stringify(l2));
    const l3 = F.ligneFraicheur({ ...c, ventesLu: null }, { maintenant: maint, dans: 'dans Orion' });
    dit(!l3.ventesRetard, 'F9 date des ventes inconnue ⇒ rien (« pas su » n\'est pas « en retard »)', JSON.stringify(l3));
    const l4 = F.ligneFraicheur({ ...c, masque: true }, { maintenant: maint, dans: 'dans Orion' });
    dit(!l4.ventesRetard, 'F9 compte masqué (son choix) ⇒ rien', JSON.stringify(l4));
    const l5 = F.ligneFraicheur({ ...c, ventesLu: Date.parse('2026-11-03T08:05:00Z') }, { maintenant: maint, dans: 'dans Orion' });
    dit(/ventes relues le 3 nov\. 9 h 05/.test(l5.bloque), 'F9 plus vieux qu\'hier ⇒ « le 3 nov. 9 h 05 »', l5.bloque);
  } else dit(false, 'F9 `ligneFraicheur` se charge', '');
  dit(/data-fraicheur-ventes-retard=/.test(S) && /ventesLu: capsDetail/.test(S), 'F9 le panneau passe la date des ventes et des annonces de chaque compte', '');

  console.log(ko ? `\n❌ ${ko} contrôle(s) en échec` : '\n✅ vente e-mail fraîche : tout est vert');
  process.exit(ko ? 1 : 0);
})();
