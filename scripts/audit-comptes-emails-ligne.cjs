#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LA LIGNE « E-MAILS » DES CARTES VINTED DE COMPTES LIÉS
//  (6 nov., vague 2, point 5 · node scripts/audit-comptes-emails-ligne.cjs ·
//  --prouve : chaque mutation rougit)
// ════════════════════════════════════════════════════════════════════════════
// Mesuré le 5 nov. : trois comptes Vinted = 45 % des ventes, aucun e-mail reçu.
// La détection existait (`etatEmailsComptes`, Notifications et Achats) ; elle
// manquait sur la carte du compte. Ce fichier EXÉCUTE la vraie règle d'App.jsx
// (extraite telle quelle) puis sa projection (`ligneEmailsCompte`) :
//   E1 un compte qui reçoit ⇒ « reçoit ses e-mails », sans geste ;
//   E2 un compte MUET prouvé ⇒ « aucun e-mail depuis N j » (N lu de la preuve)
//      + LE geste « Relier sa boîte » ; jamais reçu ⇒ depuis sa 1re vente sans e-mail ;
//   E3 « pas su » (réception ou ventes pas lues) n'est ni « reçoit » ni « aucun » ;
//      en cours ⇒ « Lecture en cours… » ; hors des totaux ⇒ rien ;
//   E4 la carte la porte (chaque carte Vinted, la règle de Notifications — §11)
//      et le geste ouvre E-mails → Relier ma boîte.
// Données INVENTÉES.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');

const MUTATIONS = {
  'muet-dit-recoit': [['src/emailsCompteLie.js', "    case 'muet': {", "    case 'muet': return { etat: 'recoit', texte: 'reçoit ses e-mails', geste: false };\n    case 'muet-x': {"]],
  'pas-su-recoit': [['src/emailsCompteLie.js', "  if (etat === 'pasSu' || etat === null) return { etat: 'passu', texte: '— pas su pour l’instant', geste: false };", "  if (etat === 'pasSu' || etat === null) return { etat: 'recoit', texte: 'reçoit ses e-mails', geste: false };"]],
  'jours-depuis-dernier': [['src/emailsCompteLie.js', "const t = Date.parse(l.depuis || l.premiereSansEmail || '');", "const t = Date.parse(l.last || '');"]],
  'geste-partout': [['src/emailsCompteLie.js', "      return { etat: 'recoit', texte: 'reçoit ses e-mails', geste: false };", "      return { etat: 'recoit', texte: 'reçoit ses e-mails', geste: true };"]],
  'carte-sans-ligne': [['src/App.jsx', '      {emails}\n      {(action || secondaire)', '      {(action || secondaire)']],
  'regle-a-part': [['src/App.jsx', "  const etatEmails = useEtatEmailsComptes(accounts);", "  const etatEmails = { etat: 'lu', lignes: accounts.map((a) => ({ uid: String(a.vinted_user_id), statut: 'recoit' })) };"]],
  // (6 nov., onglets C) Le geste passe par `relierBoiteDe(uid)` (le pas-à-pas DE CE compte, E-mails).
  'geste-ailleurs': [['src/App.jsx', "  const relier = () => relierBoiteDe(uid);", "  const relier = () => {};"]],
};
if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d && !c ? ' — ' + String(d).slice(0, 300) : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String(e && e.message || e).slice(0, 200)); } };
const APP_BRUT = require("./_source-app.cjs").sourceAppDe(path.join(R, 'src/App.jsx'));

// La VRAIE règle de l'app, extraite (Babel) et exécutée.
function chargeApp(noms) {
  const parser = require(path.join(R, 'node_modules', '@babel', 'parser'));
  const ast = parser.parse(APP_BRUT, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  const t = {};
  for (const n of ast.program.body) {
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id && noms.includes(d.id.name)) t[d.id.name] = 'const ' + APP_BRUT.slice(d.start, d.end) + ';';
    if (n.type === 'FunctionDeclaration' && n.id && noms.includes(n.id.name)) t[n.id.name] = APP_BRUT.slice(n.start, n.end);
  }
  const ctx = {}; vm.createContext(ctx);
  for (const nom of noms) { if (!t[nom]) throw new Error(nom + ' introuvable dans App.jsx'); vm.runInContext(t[nom] + `\nthis.${nom}=${nom};`, ctx); }
  return ctx;
}

(async () => {
  await essaie('E1-E3 règle', async () => {
    const { etatEmailsComptes } = chargeApp(['CSE_DELAI_MS', 'CSE_MIN_VENTES', 'CSE_MIN_JOURS', 'estRelaisApple', 'etatEmailsComptes']);
    const { ligneEmailsCompte } = await import('file://' + path.join(R, 'src/emailsCompteLie.js'));
    const J = 86400000, now = Date.parse('2026-11-06T10:00:00Z');
    const iso = (j) => new Date(now - j * J).toISOString();
    const comptes = [{ vinted_user_id: 111, login: 'vendeuse_a' }, { vinted_user_id: 222, login: 'vendeuse_b' }, { vinted_user_id: 333, login: 'vendeuse_c' }, { vinted_user_id: 444, login: 'vendeuse_d' }];
    const v = (uid, tx, j) => ({ _acc: { vinted_user_id: uid }, transaction_id: tx, date: iso(j), status: 'Commande finalisée' });
    const ventes = [v(111, 1, 20), v(111, 2, 10), v(222, 3, 18), v(222, 4, 12), v(222, 5, 9), v(444, 6, 15), v(444, 7, 11)];
    const reception = { parCompte: { vendeuse_a: { n: 12, last: iso(1) }, vendeuse_d: { n: 3, last: iso(16) } }, bordTx: new Set(['1', '2']), debut: iso(60) };
    const e = etatEmailsComptes({ comptes, reception, ventes, ventesKO: [], adresses: {}, exclus: ['333'], maintenant: now, annulee: () => false });
    const de = (uid) => ligneEmailsCompte(e.etat, e.lignes.find((l) => l.uid === uid), now);
    const a = de('111'), b = de('222'), c = de('333'), d = de('444');
    dit(a && a.etat === 'recoit' && a.texte === 'reçoit ses e-mails' && !a.geste, 'E1 un compte qui reçoit : « reçoit ses e-mails », sans geste', JSON.stringify(a));
    dit(b && b.etat === 'muet' && b.geste === true && b.texte === 'aucun e-mail depuis 18 j', 'E2 jamais reçu, 3 ventes sans e-mail : « aucun e-mail depuis 18 j » (sa 1re vente sans e-mail) + le geste', JSON.stringify(b));
    dit(d && d.etat === 'muet' && d.texte === 'aucun e-mail depuis 16 j' && d.jours === 16, 'E2 muet depuis son DERNIER e-mail (il y a 16 j) : le nombre vient de la preuve', JSON.stringify(d));
    dit(c === null, 'E3 un compte hors des totaux ne se juge pas (rien d’écrit)', JSON.stringify(c));
    const ps = etatEmailsComptes({ comptes, reception: null, ventes, ventesKO: [], adresses: {}, exclus: [], maintenant: now });
    const lp = ligneEmailsCompte(ps.etat, null, now);
    dit(lp && lp.etat === 'passu' && !/reçoit|aucun e-mail/.test(lp.texte) && !lp.geste, 'E3 réception pas lue ⇒ « — pas su », ni « reçoit » ni « aucun »', JSON.stringify(lp));
    const ec = ligneEmailsCompte(etatEmailsComptes({ comptes, reception: undefined }).etat, null, now);
    dit(ec && ec.etat === 'encours' && ec.texte === 'Lecture en cours…', 'E3 en cours ⇒ « Lecture en cours… »', JSON.stringify(ec));
    const ko2 = etatEmailsComptes({ comptes, reception, ventes, ventesKO: ['222'], adresses: {}, exclus: [], maintenant: now });
    const b2 = ligneEmailsCompte(ko2.etat, ko2.lignes.find((l) => l.uid === '222'), now);
    dit(b2 && b2.etat === 'passu' && !b2.geste, 'E3 ses ventes pas lues ⇒ pas su (jamais « aucun e-mail »)', JSON.stringify(b2));
  });

  await essaie('E4 la carte', async () => {
    const APP = sansCommentaires(APP_BRUT);
    const carte = (/function CarteCompteLie\([\s\S]*?\n\}/.exec(APP) || [''])[0];
    dit(/emails = null/.test(carte) && /\{emails\}/.test(carte), 'E4 `CarteCompteLie` rend la ligne « E-mails »');
    const ecran = (/function VintedAccounts\([\s\S]*?\n\}\n/.exec(APP) || [''])[0];
    dit(/const etatEmails = useEtatEmailsComptes\(accounts\);/.test(ecran), 'E4 Comptes liés lit la MÊME règle que Notifications et Achats (`useEtatEmailsComptes`)');
    dit(/emails=\{<LigneEmailsCompte ligne=\{emailsDe\(uid\)\} uid=\{uid\}[^>]*\/>\}/.test(ecran) && /ligneEmailsCompte\(etatEmails\.etat,/.test(ecran), 'E4 chaque carte Vinted porte SA ligne (par uid)');
    const ligne = (/function LigneEmailsCompte\([\s\S]*?\n\}/.exec(APP) || [''])[0];
    // (6 nov., onglets C) Le geste ouvre E-mails → Relier ma boîte sur le pas-à-pas DE CE compte (`relierBoiteDe`).
    const relierDe = (/function relierBoiteDe\([^\n]*\n/.exec(APP) || [''])[0];
    dit(/ligne\.geste && <button/.test(ligne) && /relierBoiteDe\(uid\)/.test(ligne) && /vrm:relier-compte/.test(relierDe) && /detail:'emails'/.test(relierDe), 'E4 le geste n’apparaît que sur un compte muet et ouvre E-mails → Relier ma boîte, sur CE compte');
    dit(/data-compte-emails=\{ligne\.etat\}/.test(ligne), 'E4 l’état est porté par `data-compte-emails` (les bancs jugent la règle, pas le libellé)');
  });

  console.log(ko ? `\n❌ audit-comptes-emails-ligne : ${ko} rouge(s)` : '\n✅ audit-comptes-emails-ligne : tout est vert');
  process.exit(ko ? 1 : 0);
})();
}
