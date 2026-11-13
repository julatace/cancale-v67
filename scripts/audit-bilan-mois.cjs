// ⚠️⚠️ LE BILAN DU MOIS PAR E-MAIL — LES CHIFFRES DE L'APP, ÉTEINT PAR DÉFAUT, BORNÉ
//
// (8 nov.) Le 1er du mois, un e-mail par vendeur QUI L'A ACTIVÉ (api/_lib/bilan-mois.js).
// Ce contrôle EXÉCUTE la règle sur une base INVENTÉE et exige :
//   1. le miroir du bénéfice (api/_lib/benefice-regle.js) est la règle de l'app au
//      jeton près (Babel), et rend la même chose qu'elle ;
//   2. les MÊMES chiffres que l'app : ventes et vendu (`ventesFaites`, jour de la
//      vente), reçu (`ventesDeclarables`, jour du VERSEMENT), bénéfice brut
//      (`beneficeDesJours` sur la publication de Ventes) — les règles de l'APP
//      exécutées à côté sur les mêmes données, mois borné à l'heure de Paris ;
//   3. « au moins » quand c'est partiel (compte lu avant la fin du mois, prix
//      d'achat manquants), « — » quand ce n'est pas su, jamais « 0 » inventé ni
//      « au moins 0 » ;
//   4. réglage éteint (absent, faux, illisible) ⇒ AUCUN envoi et AUCUNE lecture
//      des ventes ; hors du 1er au 7 ⇒ rien ;
//   5. le plafond : jamais plus d'envois que la part du jour (Brevo 300/j, après
//      les e-mails de l'essai) ; un mois jamais envoyé deux fois ; réservation
//      non confirmée ⇒ rien ; refus SMTP ⇒ le mois est libéré ;
//   6. le texte : lien vers Compta, désinscription signée (un clic), aucun
//      « encaissé », HTML échappé ; le canal existant (RELANCES_SMTP_*) ;
//   7. le branchement : le cron du matin l'appelle par vendeur avec la part du
//      jour, la route `?mode=bilan-mois` existe, Réglages porte l'interrupteur.
//
//   node scripts/audit-bilan-mois.cjs            → le contrôle
//   node scripts/audit-bilan-mois.cjs --recopie  → refabrique le miroir du bénéfice depuis App.jsx
//   node scripts/audit-bilan-mois.cjs --prouve   → chaque mutation de la règle doit faire ROUGIR
// Aucune donnée réelle : tout est inventé ici.
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');

let parser;
try { parser = require(path.join(R, 'node_modules', '@babel', 'parser')); }
catch (e) { console.log('❌ analyseur Babel introuvable — ' + e.message); process.exit(1); }

const NOMS_B = ['jourClef', 'BENEF_CHAMPS', 'beneficeVide', 'cumulerBenefice', 'resumeBenefice', 'beneficeDesJours'];
const NOMS_V = ['classifyOrderStatus', 'tsCommande', 'montantCommande', 'montantCommandeLu', 'lbcAnnulee', 'lbcFinalisee', 'lbcExpediee', 'venteFinalisee', 'commandeEbayEngagee', 'montantRecuEbay', 'ymDeTs', 'indexDeclarations', 'moisDeclare', 'ventesDeclarables', 'ventesFaites', 'compteEcarte'];
const lire = (f, r = R) => { try { return fs.readFileSync(path.join(r, f), 'utf8'); } catch (_) { return null; } };
function declarations(src, plugins) {
  const out = {};
  if (src == null) return out;
  const ast = parser.parse(src, { sourceType: 'module', plugins, errorRecovery: true, tokens: true });
  for (const n of ast.program.body) {
    const d0 = n.type === 'ExportNamedDeclaration' ? n.declaration : n;
    if (!d0 || d0.type !== 'VariableDeclaration') continue;
    for (const d of d0.declarations) {
      const nom = d.id && d.id.name;
      if (!nom || out[nom]) continue;
      const jetons = ast.tokens.filter((t) => t.start >= d.start && t.end <= d.end && t.type !== 'CommentLine' && t.type !== 'CommentBlock')
        .map((t) => (t.type && t.type.label ? t.type.label : t.type) + ':' + (t.value === undefined ? '' : String(t.value)));
      out[nom] = { texte: 'const ' + src.slice(d.start, d.end) + ';', jetons: jetons.join(' ') };
    }
  }
  return out;
}
const app = require('./_source-app.cjs').sourceApp();
const declApp = declarations(app, ['jsx']);

const TETE_MIROIR = `// ── LE BÉNÉFICE BRUT, CÔTÉ SERVEUR — UN MIROIR, PAS UNE COPIE (8 nov.) ────────
// Le bilan du mois par e-mail (api/_lib/bilan-mois.js) cumule la publication de
// l'écran Ventes (\`vrm_benefice_jours\`) avec la règle de l'APP (§11).
// ⚠️ NE RIEN MODIFIER ICI À LA MAIN : modifier App.jsx, puis refabriquer ce
//    fichier avec \`node scripts/audit-bilan-mois.cjs --recopie\` — l'audit exige
//    que chaque déclaration soit celle d'App.jsx au jeton près, puis les exécute.
/* eslint-disable */
`;
if (process.argv.includes('--recopie')) {
  let corps = TETE_MIROIR;
  for (const n of NOMS_B) { if (!declApp[n]) { console.log(`❌ ${n} introuvable dans App.jsx`); process.exit(1); } corps += 'export ' + declApp[n].texte + '\n\n'; }
  fs.writeFileSync(path.join(R, 'api/_lib/benefice-regle.js'), corps.replace(/\n+$/, '\n'));
  console.log(`✅ miroir du bénéfice refabriqué (${NOMS_B.length} déclarations)`);
  process.exit(0);
}

// ── LE CONTRÔLE, sur un dossier `api/_lib` donné (le vrai, ou une copie mutée) ──
async function controler(lib, { taire = false } = {}) {
  let ko = 0, ok = 0;
  const dit = (c, m, d) => { if (c) ok++; else ko++; if (!taire) console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };
  const titre = (t) => { if (!taire) console.log('\n── ' + t); };
  const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m, String((e && e.stack) || e).split('\n').slice(0, 2).join(' ')); } };
  const imp = async (f) => import(pathToFileURL(path.join(lib, f)).href + '?v=' + Date.now() + Math.random());
  let M = {}, S = {};
  try { M = await imp('bilan-mois.js'); } catch (e) { dit(false, 'api/_lib/bilan-mois.js se charge', e.message); return { ko: ko || 1, ok }; }
  try { S = await imp('bilan-semaine.js'); } catch (e) { dit(false, 'bilan-semaine.js se charge', e.message); }

  titre('1. Le miroir du bénéfice est la règle de l’app');
  const declSrv = declarations(lire('benefice-regle.js', lib), []);
  for (const n of NOMS_B) dit(!!declApp[n] && !!declSrv[n] && declApp[n].jetons === declSrv[n].jetons, `${n} : identique dans App.jsx et api/_lib/benefice-regle.js`, !declSrv[n] ? 'absent du serveur' : 'diffère — `--recopie`');
  const ctx = vm.createContext({});
  for (const n of [...NOMS_B, ...NOMS_V]) if (declApp[n]) try { vm.runInContext(declApp[n].texte + `\nthis.${n} = ${n};`, ctx); } catch (_) {}
  try { const vc = await imp('vestiaire-regle.js'); for (const k of Object.keys(vc)) ctx[k] = vc[k]; } catch (_) {}

  // ── LA BASE INVENTÉE : octobre 2026 (heure d'hiver le 25), deux comptes ──
  const iso = (s) => new Date(s).toISOString();
  const orders = {
    A: [
      { transaction_id: 101, title: 'Paire A1 inventée', status: 'Commande finalisée', date: iso('2026-10-01T00:30:00+02:00'), price: { amount: '80.0' } },      // 1er oct. 00 h 30 Paris : DANS le mois
      { transaction_id: 102, title: 'Paire A2 inventée', status: 'Commande finalisée', date: iso('2026-10-14T12:00:00+02:00'), price: { amount: '215.5' } },
      { transaction_id: 103, title: 'Remboursée', status: 'Remboursement effectué', date: iso('2026-10-15T12:00:00+02:00'), price: { amount: '999' } },
      { transaction_id: 104, title: 'Septembre', status: 'Commande finalisée', date: iso('2026-09-30T23:30:00+02:00'), price: { amount: '40' } },       // 30 sept. Paris : HORS du mois
      { transaction_id: 105, title: 'Novembre', status: 'Commande finalisée', date: iso('2026-11-01T00:10:00+01:00'), price: { amount: '33' } },         // 1er nov. Paris : HORS
    ],
    B: [
      { transaction_id: 201, title: 'Paire B1 inventée', status: 'Commande finalisée', date: iso('2026-10-31T23:30:00+01:00'), price: { amount: '60' } },   // 31 oct. 23 h 30 Paris : DANS
      { transaction_id: 202, title: 'En cours', status: 'Le paiement a été validé', date: iso('2026-10-20T10:00:00+02:00'), price: { amount: '25' } },
    ],
  };
  const capFin = iso('2026-11-01T06:00:00+01:00');
  const versements = { 101: iso('2026-10-05T10:00:00+02:00'), 102: iso('2026-10-31T22:00:00+01:00'), 104: iso('2026-10-02T10:00:00+02:00'), 105: iso('2026-11-04T10:00:00+01:00'), 201: iso('2026-11-02T10:00:00+01:00') };
  const lbc = [{ txId: 'L1', isSeller: true, price: 4500, dateVente: iso('2026-10-10T15:00:00+02:00'), stepStatus: 'done', at: iso('2026-10-10T16:00:00+02:00') }];
  const base = (cap = { A: capFin, B: capFin }) => ({
    comptes: [{ uid: 'A', login: 'vendeuse_inventee_a' }, { uid: 'B', login: 'vendeuse_inventee_b' }],
    commandes: { A: { orders: orders.A, cap: cap.A }, B: { orders: orders.B, cap: cap.B } },
    masquesTx: new Set(), masquesComptes: new Set(), panneau: {}, exclusAutres: {},
    lbc, ebay: [], vestiaire: [], versements,
  });
  // La publication de Ventes (`vrm_benefice_jours`), construite par la règle DE L'APP.
  const pubDe = (achats, at) => {
    const jours = {};
    const ajoute = (ts, eur, achat) => { const k = ctx.jourClef(new Date(ts)); const acc = ctx.beneficeVide(); acc.n = 1; acc.ca = Math.round(eur * 100); const connu = achat != null; if (connu) { acc.nCout = 1; acc.cout = Math.round(achat * 100); acc.caCouvert = acc.ca; } jours[k] = (jours[k] ? ctx.cumulerBenefice(ctx.cumulerBenefice(ctx.beneficeVide(), jours[k]), acc) : acc); };
    ajoute('2026-10-01T10:00:00Z', 80, achats[101]); ajoute('2026-10-14T10:00:00Z', 215.5, achats[102]); ajoute('2026-10-31T10:00:00Z', 60, achats[201]); ajoute('2026-10-10T10:00:00Z', 45, achats.L1);
    ajoute('2026-09-30T10:00:00Z', 40, 10); ajoute('2026-11-01T10:00:00Z', 33, 3);
    const tab = {}; for (const [k, b] of Object.entries(jours)) tab[k] = ctx.BENEF_CHAMPS.map((c) => b[c] || 0);
    return { v: 2, jours: tab, at };
  };
  const T = Date.parse('2026-11-01T06:00:00+01:00');          // le cron du 1er novembre
  const mois = M.moisPasse ? M.moisPasse(T) : null;

  titre('2. Les mêmes chiffres que l’app (base inventée)');
  await essaie('mois', async () => {
    dit(mois && mois.ym === '2026-10' && mois.jour === 1 && mois.debut === Date.parse('2026-10-01T00:00:00+02:00') && mois.fin === Date.parse('2026-11-01T00:00:00+01:00'), 'le mois écoulé est borné à l’heure de Paris (1er oct. 00:00 CEST → 1er nov. 00:00 CET)', JSON.stringify(mois));
    const j = M.moisPasse(Date.parse('2027-01-03T08:00:00+01:00'));
    dit(j.ym === '2026-12' && j.jour === 3, 'en janvier, le mois écoulé est décembre de l’année d’avant', JSON.stringify(j));
  });
  await essaie('chiffres', async () => {
    const d = base();
    const pub = pubDe({ 101: 50, 102: 120, 201: 30, L1: 20 }, Date.parse('2026-11-01T05:00:00+01:00'));
    const b = M.calculerBilanMois({ d, pub, mois, maintenant: T });
    // L'APP, exécutée à côté sur les mêmes ventes.
    const vinted = [...orders.A.map((o) => ({ ...o, _acc: { vinted_user_id: 'A' } })), ...orders.B.map((o) => ({ ...o, _acc: { vinted_user_id: 'B' } }))];
    const dans = (t) => t >= mois.debut && t < mois.fin;
    const vf = ctx.ventesFaites({ vinted, lbc, ebay: [], vestiaire: [], cachee: () => false });
    const lv = vf.lignes.filter((l) => dans(l.ts));
    const vd = ctx.ventesDeclarables({ vinted, lbc, ebay: [], vestiaire: [], versements });
    const recuApp = Math.round(vd.lignes.filter((l) => dans(l.ts)).reduce((t, l) => t + l.eur * 100, 0)) / 100;
    const venduApp = Math.round(lv.reduce((t, l) => t + l.eur * 100, 0)) / 100;
    const benApp = ctx.beneficeDesJours(pub.jours, new Date(Date.UTC(2026, 9, 1)), new Date(Date.UTC(2026, 10, 1)));
    dit(b.vendu.etat === 'su' && b.vendu.n === lv.length && b.vendu.n === 5 && b.vendu.eur === venduApp, `Ventes ${b.vendu.n} · vendu ${b.vendu.eur} € = l’app (${lv.length} · ${venduApp} €), au jour de la vente`, JSON.stringify(b.vendu));
    dit(b.recu.eur === recuApp && recuApp === 380.5 && b.recu.etat === 'su', `Reçu ${b.recu.eur} € = l’app (${recuApp} €), au jour du VERSEMENT (la vente de septembre versée le 2 oct. y est, celle du 31 oct. versée le 2 nov. n’y est pas ; Leboncoin au jour de la vente)`, JSON.stringify(b.recu));
    dit(b.benefice.etat === 'su' && b.benefice.brut === Math.round(benApp.brut * 100) / 100 && b.benefice.brut === 180.5, `Bénéfice brut ${b.benefice.brut} € = l’app (${benApp.brut} €), sur les ventes du mois`, JSON.stringify(b.benefice));
    dit(b.meilleure && b.meilleure.eur === 215.5 && b.meilleure.titre === 'Paire A2 inventée' && b.meilleure.plateforme === 'Vinted', 'la plus belle vente est la plus haute du mois, avec le titre de SA commande', JSON.stringify(b.meilleure));
    const t = M.texteBilanMois(b, { lien: 'https://vrm.center/api/compte?mode=bilan-mois&d=x' });
    dit(/Ventes : 5\b/.test(t.texte) && t.texte.includes(M.euros(venduApp)) && t.texte.includes(M.euros(recuApp)) && t.texte.includes(M.euros(180.5)) && !/au moins/i.test(t.texte), 'l’e-mail dit ces chiffres-là, sans « au moins » quand tout est lu', t.texte.slice(0, 300));
  });

  titre('3. « Au moins » quand c’est partiel, « — » quand ce n’est pas su');
  await essaie('partiel', async () => {
    const d = base({ A: capFin, B: iso('2026-10-28T10:00:00+01:00') });   // B lu le 28 : la fin du mois manque
    const pub = pubDe({ 101: 50, 102: 120 }, Date.parse('2026-11-01T05:00:00+01:00'));   // deux prix d'achat manquent
    const b = M.calculerBilanMois({ d, pub, mois, maintenant: T });
    const t = M.texteBilanMois(b, {});
    dit(b.vendu.etat === 'partiel' && b.vendu.manque.some((x) => /vendeuse_inventee_b/.test(x)), 'un compte lu avant la fin du mois rend le vendu PARTIEL et le NOMME', JSON.stringify(b.vendu.manque));
    dit(/Vendu : au moins /.test(t.texte) && /vendeuse_inventee_b/.test(t.texte), '… et l’e-mail dit « au moins » et le compte qui manque');
    dit(b.benefice.etat === 'partiel' && b.benefice.brut === 125.5 && /2 prix d’achat manquent/.test(b.benefice.manque.join(' ')), 'des prix d’achat manquent ⇒ bénéfice PARTIEL, le manque compté', JSON.stringify(b.benefice));
    // (13 nov., lot 53) Jamais « au moins » devant un bénéfice (src/beneficeNoms.js) : le brut
    // connu, sa couverture et le manque nommé.
    dit(!/Bénéfice brut : au moins/.test(t.texte) && /Bénéfice brut : 125,50\s€ \(sur 2 ventes de 4 · 2 prix d’achat manquent/.test(t.texte), '… « Bénéfice brut : 125,50 € (sur 2 ventes de 4 · 2 prix d’achat manquent) » — jamais « au moins » devant un bénéfice', t.texte.split('\n').find((l) => /Bénéfice/.test(l)));
  });
  await essaie('pas su', async () => {
    const d = { ...base(), versements: null };
    const b = M.calculerBilanMois({ d, pub: null, mois, maintenant: T });
    const t = M.texteBilanMois(b, {});
    dit(b.benefice.etat === 'pas-su' && /Bénéfice brut : —/.test(t.texte), 'jamais publié ⇒ « Bénéfice brut : — » et la raison, jamais 0 €', t.texte.split('\n').find((l) => /Bénéfice/.test(l)));
    dit(b.recu.etat === 'pas-su' && /Reçu : —/.test(t.texte), 'versements illisibles ⇒ « Reçu : — »', t.texte.split('\n').find((l) => /Reçu/.test(l)));
    const sansCout = M.calculerBilanMois({ d: base(), pub: pubDe({}, Date.parse('2026-11-01T05:00:00+01:00')), mois, maintenant: T });
    dit(sansCout.benefice.etat === 'pas-su' && sansCout.benefice.brut === undefined, 'aucun prix d’achat noté ⇒ « — », pas « 0 € »', JSON.stringify(sansCout.benefice));
    const vieux = M.calculerBilanMois({ d: base(), pub: pubDe({ 101: 50, 102: 120, 201: 30, L1: 20 }, Date.parse('2026-10-20T10:00:00+02:00')), mois, maintenant: T });
    dit(vieux.benefice.etat === 'partiel' && /calculé le/.test(vieux.benefice.manque.join(' ')), 'une publication d’avant la fin du mois ⇒ « au moins » et « calculé le … »', JSON.stringify(vieux.benefice));
    const zero = M.texteBilanMois({ libelle: 'octobre 2026', vendu: { etat: 'partiel', n: 0, eur: 0, manque: ['Vinted (illisible)'] }, recu: { etat: 'partiel', eur: 0, manque: [] }, benefice: { etat: 'pas-su', raison: 'x' }, meilleure: null }, {});
    dit(!/au moins 0/i.test(zero.texte) && /Vendu : —/.test(zero.texte), '« au moins 0 » ne se dit jamais : un partiel nul s’écrit « — »', zero.texte.split('\n').filter((l) => /Vendu|Ventes|Reçu/.test(l)).join(' | '));
    dit(!/encaiss/i.test(t.texte + t.html), 'jamais « encaissé »');
  });

  titre('4. Le défaut (13 nov., lot 53) : activé pour un compte créé depuis le 13 nov., éteint avant ; éteint ⇒ aucune lecture');
  const faux = (o = {}) => {
    const j = { lectures: 0, envois: [], memo: o.memo === undefined ? null : o.memo, ecrituresOk: o.ecrituresOk !== false };
    return { j, p: {
      owner: o.owner || '0b6f2f4e-1111-4222-8333-444455556666', maintenant: o.maintenant || T,
      lireChoix: async () => (o.choix === undefined ? null : o.choix), lireEnvois: async () => j.memo,
      ecrireEnvois: async (data) => { if (!j.ecrituresOk) return false; j.memo = data; return true; },
      lireDonnees: async () => { j.lectures++; return base(); }, lirePub: async () => pubDe({ 101: 50 }, Date.parse('2026-11-01T05:00:00+01:00')),
      adresse: async () => ({ etat: 'ok', email: 'vendeur@exemple.invalid', ...(o.creeLe !== undefined ? { creeLe: o.creeLe } : {}) }),
      envoyer: async (m) => { j.envois.push(m); return { issue: o.issue || 'envoye' }; },
      compteur: o.compteur || { reste: 10 }, config: o.config === undefined ? { pret: true } : o.config, service: 'cle-de-service-inventee',
    } };
  };
  for (const [nom, choix, creeLe] of [['absent, date de création pas sue', undefined], ['absent, compte d’avant le 13 nov.', undefined, '2026-10-01T10:00:00Z'], ['éteint', { actif: false }], ['valeur douteuse « oui », compte d’avant', { actif: 'oui' }, '2026-09-01T10:00:00Z']]) {
    await essaie(nom, async () => {
      const { j, p } = faux({ choix, creeLe }); const r = await M.bilanMoisVendeur(p);
      dit(j.envois.length === 0 && j.lectures === 0, `réglage ${nom} ⇒ aucun e-mail, aucune lecture des ventes`, `${r} · ${j.envois.length} envoi(s) · ${j.lectures} lecture(s)`);
    });
  }
  await essaie('défaut neuf', async () => {
    const { j, p } = faux({ creeLe: '2026-11-20T10:00:00Z', maintenant: Date.parse('2026-12-01T06:00:00+01:00') });
    const r = await M.bilanMoisVendeur(p);
    dit(j.envois.length === 1 && r && r.parDefaut === true, 'absent, compte créé depuis le 13 nov. ⇒ UN e-mail (activé par défaut)', JSON.stringify(r));
    const { j: j2, p: p2 } = faux({ choix: { actif: false }, creeLe: '2026-11-20T10:00:00Z', maintenant: Date.parse('2026-12-01T06:00:00+01:00') });
    await M.bilanMoisVendeur(p2);
    dit(j2.envois.length === 0 && j2.lectures === 0, 'compte neuf qui l’a coupé ⇒ rien (un choix posé gagne)');
  });
  await essaie('illisible', async () => {
    const { j, p } = faux({}); p.lireChoix = async () => undefined;
    const r = await M.bilanMoisVendeur(p);
    dit(j.envois.length === 0 && j.lectures === 0, 'réglage illisible ⇒ rien (« pas su » ne vaut pas « oui »)', String(r));
  });
  await essaie('hors fenêtre', async () => {
    const { j, p } = faux({ choix: { actif: true }, maintenant: Date.parse('2026-11-08T06:00:00+01:00') });
    let lu = 0; p.lireChoix = async () => { lu++; return { actif: true }; };
    const r = await M.bilanMoisVendeur(p);
    dit(r === null && lu === 0 && j.envois.length === 0, 'le 8 du mois ⇒ rien n’est lu ni envoyé (rattrapage du 2 au 7 seulement)', String(r));
  });
  await essaie('allumé', async () => {
    const { j, p } = faux({ choix: { actif: true } });
    const r = await M.bilanMoisVendeur(p);
    const m = j.envois[0] || {};
    dit(j.envois.length === 1 && r && r.issue === 'envoye', 'réglage allumé ⇒ UN e-mail', JSON.stringify(r));
    dit(m.a === 'vendeur@exemple.invalid' && /bilan d’octobre 2026/.test(m.sujet || '') && /\?tab=compta/.test(m.html || '') && /\?tab=compta/.test(m.texte || ''), 'à l’adresse DU COMPTE, sujet du mois, lien vers Compta', `${m.a} · ${m.sujet}`);
    dit(/^<https:\/\/vrm\.center\/api\/compte\?mode=bilan-mois&d=[0-9a-f-]{36}\.[A-Za-z0-9_-]{32}>$/.test((m.entetes || {})['List-Unsubscribe'] || '') && (m.entetes || {})['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click', 'désinscription en un clic, par un lien signé', JSON.stringify(m.entetes));
    const { j: j2, p: p2 } = faux({ choix: { actif: true }, memo: j.memo });
    const r2 = await M.bilanMoisVendeur(p2);
    dit(j2.envois.length === 0 && /déjà/.test(String(r2)), 'relancé le même mois ⇒ rien (un bilan par mois)', String(r2));
  });
  await essaie('non configuré', async () => {
    const { j, p } = faux({ choix: { actif: true }, config: { pret: false } });
    const r = await M.bilanMoisVendeur(p);
    dit(j.envois.length === 0 && j.lectures === 0, 'envoi non configuré (RELANCES_SMTP_*) ⇒ rien', String(r));
  });

  titre('5. Le plafond, la réservation, le refus');
  await essaie('plafond', async () => {
    const compteur = { reste: 2 }; let envoyes = 0; const issues = [];
    await Promise.all(Array.from({ length: 6 }, (_, i) => (async () => {
      const { j, p } = faux({ choix: { actif: true }, compteur, owner: `0b6f2f4e-1111-4222-8333-44445555660${i}` });
      issues.push(String((await M.bilanMoisVendeur(p)) && 'x')); envoyes += j.envois.length;
    })()));
    dit(envoyes === 2 && compteur.reste === 0, '6 vendeurs allumés, 8 à la fois, part du jour = 2 ⇒ exactement 2 e-mails', `${envoyes} envoyé(s) · reste ${compteur.reste}`);
    dit(M.partBilan({ env: {}, dejaEnvoyes: 0 }) === 150 && M.partBilan({ env: {}, dejaEnvoyes: 200 }) === 100 && M.partBilan({ env: {}, dejaEnvoyes: 300 }) === 0 && M.partBilan({ env: { VRM_EMAILS_PAR_JOUR: '1000' }, dejaEnvoyes: 0 }) === 150,
      'la part du jour : 300 − les e-mails déjà partis (essai), 150 au plus');
  });
  await essaie('réservation', async () => {
    const { j, p } = faux({ choix: { actif: true }, ecrituresOk: false });
    const r = await M.bilanMoisVendeur(p);
    dit(j.envois.length === 0 && p.compteur.reste === 10, 'réservation non confirmée par la base ⇒ rien ne part (et la part n’est pas consommée)', String(r));
    const { j: j3, p: p3 } = faux({ choix: { actif: true }, issue: 'refuse' });
    await M.bilanMoisVendeur(p3);
    dit(j3.envois.length === 1 && !(j3.memo.mois && j3.memo.mois['2026-10']) && p3.compteur.reste === 10, 'refus SMTP avant le message ⇒ le mois est libéré (demain) et la part rendue', JSON.stringify(j3.memo));
    const { j: j4, p: p4 } = faux({ choix: { actif: true }, issue: 'incertain' });
    await M.bilanMoisVendeur(p4);
    const { j: j5, p: p5 } = faux({ choix: { actif: true }, memo: j4.memo });
    await M.bilanMoisVendeur(p5);
    dit(j5.envois.length === 0, 'un envoi « incertain » ne se refait pas (jamais deux bilans)');
  });

  titre('6. Le texte et le lien');
  await essaie('texte', async () => {
    const b = M.calculerBilanMois({ d: { ...base(), commandes: { A: { orders: [{ transaction_id: 9, title: '<script>x</script>', status: 'Commande finalisée', date: iso('2026-10-03T10:00:00+02:00'), price: { amount: '30' } }], cap: capFin } }, comptes: [{ uid: 'A', login: 'a' }], lbc: [] }, pub: null, mois, maintenant: T });
    const t = M.texteBilanMois(b, { lien: 'https://vrm.center/x' });
    dit(!t.html.includes('<script>') && t.html.includes('&lt;script&gt;'), 'un titre de vente est échappé dans le HTML');
    dit(/ €/.test(t.texte) && !/\d €/.test(t.texte), 'montants avec espace insécable avant « € »');
    const tok = M.jetonBilan('0b6f2f4e-1111-4222-8333-444455556666', 's');
    dit(M.lireJetonBilan(tok, 's') === '0b6f2f4e-1111-4222-8333-444455556666' && M.lireJetonBilan(tok.slice(0, -1) + (tok.endsWith('A') ? 'B' : 'A'), 's') === null && M.lireJetonBilan(tok, 'autre') === null, 'le lien « ne plus recevoir » est signé : un caractère changé ou une autre clé ⇒ refusé');
    let rel = null; try { rel = await imp('relances-essai.js'); } catch (_) {}
    dit(!rel || M.lireJetonBilan(rel.jetonDesinscription('0b6f2f4e-1111-4222-8333-444455556666', 's'), 's') === null, 'le jeton des e-mails de l’essai ne coupe pas le bilan (signatures séparées)');
  });
  return { ko, ok };
}

function branchements() {
  let ko = 0, ok = 0;
  const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };
  console.log('\n── 7. Le branchement : cron, route, Réglages, canal');
  const cron = lire('api/ship-reminders.js') || '';
  dit(/bilanMoisVendeur\(/.test(cron) && /partBilan\(/.test(cron) && /relances && relances\.envoyes/.test(cron), 'le cron du matin appelle le bilan par vendeur, avec la part du jour après les e-mails de l’essai');
  dit(/lireDonnees:\s*lireDonneesBilan/.test(cron) && /'vrm_benefice_jours'/.test(cron), '… avec les lectures du bilan de la semaine (projetées) et la publication du bénéfice');
  dit(/configurationRelances\(\)/.test(cron) && /RELANCES_SMTP_HOTE/.test(cron), '… par le canal existant (RELANCES_SMTP_*)');
  const cpt = lire('api/compte.js') || '';
  dit(/mode === 'bilan-mois'/.test(cpt) && /lireJetonBilan/.test(cpt), 'la route `/api/compte?mode=bilan-mois` existe (Réglages, lien signé)');
  const src = require('./_source-app.cjs').sourceApp();
  dit(/data-bilan-mois/.test(src) && /mode=bilan-mois/.test(src), 'Réglages porte l’interrupteur « Bilan du mois par e-mail »');
  dit((lire('vercel.json') || '').split('"path"').length - 1 <= 2, 'aucun cron de plus (toujours 2)');
  return { ko, ok };
}

// ── --prouve : chaque mutation de la règle doit faire rougir le contrôle ──
const MUTATIONS = [
  ['réglage ignoré', "if (!choix || choix.actif !== true) return 'éteint';", "if (choix === false) return 'éteint';"],
  ['plafond ignoré', "if (compteur.reste <= 0) return 'plafond du jour — demain';\n  compteur.reste -= 1;", 'compteur.reste -= 1;'],
  ['« au moins » retiré', "`${etat === 'partiel' ? 'au moins ' : ''}${f(x)}`", '`${f(x)}`'],
  ['« pas su » devenu 0', "be.etat === 'pas-su' ? '—' :", "be.etat === 'pas-su' ? euros(0) :"],
  ['mois en UTC', 'const debut = minuitParis(`${ym}-01`), fin = minuitParis(`${y}-${String(m).padStart(2, \'0\')}-01`);', 'const debut = Date.parse(`${ym}-01T00:00:00Z`), fin = Date.parse(`${y}-${String(m).padStart(2, \'0\')}-01T00:00:00Z`);'],
  ['réservation ignorée', "{ compteur.reste += 1; return 'réservation non confirmée — rien'; }", '{}'],
  ['hors fenêtre lu', 'if (mois.jour > JOUR_MAX) return null;', ''],
];

(async () => {
  const LIB = path.join(R, 'api', '_lib');
  if (process.argv.includes('--prouve')) {
    let rouges = 0;
    for (const [nom, de, vers] of MUTATIONS) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bilan-mois-'));
      fs.cpSync(LIB, tmp, { recursive: true });
      const f = path.join(tmp, 'bilan-mois.js'); const s = fs.readFileSync(f, 'utf8');
      if (!s.includes(de)) { console.log(`❌ mutation « ${nom} » : texte introuvable`); rouges++; continue; }
      fs.writeFileSync(f, s.replace(de, vers));
      const r = await controler(tmp, { taire: true });
      fs.rmSync(tmp, { recursive: true, force: true });
      console.log(`${r.ko ? '✅' : '❌'} mutation « ${nom} » : le contrôle ${r.ko ? `rougit (${r.ko} rouge(s))` : 'reste VERT — il ne la voit pas'}`);
      if (!r.ko) rouges++;
    }
    process.exit(rouges ? 1 : 0);
  }
  const a = await controler(LIB);
  const b = branchements();
  const ko = a.ko + b.ko, ok = a.ok + b.ok;
  console.log(`\n${ko ? '❌' : '✅'} audit-bilan-mois : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ l’audit a levé : ' + ((e && e.stack) || e)); process.exit(1); });
