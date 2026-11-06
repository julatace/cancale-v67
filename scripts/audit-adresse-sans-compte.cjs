#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « ADRESSE SANS COMPTE » DANS E-MAILS → RELIER MA BOÎTE
//  (6 nov., vague 2, point 5 · node scripts/audit-adresse-sans-compte.cjs ·
//  --prouve : chaque mutation rougit)
// ════════════════════════════════════════════════════════════════════════════
// Mesuré (lecture seule) : 66 e-mails le 5 nov. — trois adresses le 6 nov. —
// arrivés chez lui sur une adresse qu'aucun compte Vinted ne porte. Ce fichier
// EXÉCUTE la règle (src/adressesSansCompte.js) et juge l'écran :
//   A1 une adresse sans compte est comptée (ses e-mails, une fois par e-mail) ;
//      une adresse portée par un compte, la boîte collective VRM, une adresse
//      marquée « compte acheteur » ne le sont pas ; « +étiquette » = sa déclarée ;
//   A2 « pas su » (une lecture manque) n'est jamais « aucune » ; en cours ⇒ rien ;
//   A3 le compte n'est JAMAIS deviné : « Relier » écrit le registre existant
//      (`vinted_account_emails`) sur SON clic, confirmé ; une adresse = un compte ;
//      un compte qui a déjà son adresse n'est pas remplacé d'ici ;
//   A4 l'écran : lecture projetée (jamais `select=data`), écriture seulement dans
//      les gestes, « compte acheteur » synchronisé et réversible, posé en tête de
//      E-mails → Relier ma boîte.
// Données INVENTÉES.
'use strict';
const fs = require('fs'), path = require('path');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');

const MUTATIONS = {
  'acheteur-ignore': [['src/adressesSansCompte.js', ' && !ach.has(e.adresse))', ')']],
  'collectrice-comptee': [['src/adressesSansCompte.js', "if (!n || !n.includes('@') || estAdresseCollectrice(n)) return '';", "if (!n || !n.includes('@')) return '';"]],
  'pas-su-vide': [['src/adressesSansCompte.js', "  if (!Array.isArray(lignes) || declarees === null || comptesEmails === null || typeof comptesEmails !== 'object') return null;", "  if (!Array.isArray(lignes) || declarees === null || comptesEmails === null || typeof comptesEmails !== 'object') return [];"]],
  'relier-remplace': [['src/adressesSansCompte.js', '  if (normAdresse(m[u])) return null;\n', '']],
  'relier-double': [['src/adressesSansCompte.js', "  if (Object.keys(m).some((k) => k !== u && normAdresse(m[k]) === a)) return null;\n", '']],
  'compte-devine': [['src/App.jsx', "  const liste = adressesSansCompte({ lignes, declarees, comptesEmails, acheteurs });", "  const liste = adressesSansCompte({ lignes, declarees, comptesEmails, acheteurs });\n  useEffect(() => { if (Array.isArray(liste) && liste[0] && libres[0]) { const u = relierAdresse(comptesEmails, libres[0].vinted_user_id, liste[0].adresse); if (u) save('vinted_account_emails', u); } });"]],
  'select-data': [['src/App.jsx', "lireTout('id=like.email_reception_*&select=at:data->>at,adresses:data->adresses', { strict: true })", "lireTout('id=like.email_reception_*&select=data', { strict: true })"]],
  'acheteur-local': [['src/App.jsx', "  'vrm_adresses_acheteur',\n", '']],
  'sans-confirmation': [['src/App.jsx', "    const ok = await askConfirm({ title: `Relier ${adresse} à ${nomCompte(compte)} ?`", "    const ok = true || await askConfirm({ title: `Relier ${adresse} à ${nomCompte(compte)} ?`"]],
};
if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d && !c ? ' — ' + String(d).slice(0, 300) : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String(e && e.message || e).slice(0, 200)); } };

(async () => {
  await essaie('A1-A3 règle', async () => {
    const S = await import('file://' + path.join(R, 'src/adressesSansCompte.js'));
    const { ADRESSE_COLLECTRICE } = await import('file://' + path.join(R, 'api/_lib/proprietaire-email.js'));
    const declarees = { 'reliee@banc.test': {}, 'orpheline@banc.test': {}, 'acheteuse@banc.test': {} };
    const comptesEmails = { 111: 'Reliee@banc.test' };
    const L = (adresses, j) => ({ at: `2026-11-0${j}T10:00:00.000Z`, adresses });
    const lignes = [
      L(['reliee@banc.test'], 1), L(['orpheline@banc.test'], 2), L(['orpheline+vinted@banc.test', ADRESSE_COLLECTRICE], 4),
      L(['orpheline@banc.test', 'orpheline@banc.test'], 3), L(['acheteuse@banc.test'], 5), L([ADRESSE_COLLECTRICE], 5), L([], 1), {},
    ];
    const r = S.adressesSansCompte({ lignes, declarees, comptesEmails, acheteurs: { 'acheteuse@banc.test': { at: 'x' } } });
    dit(Array.isArray(r) && r.length === 1 && r[0].adresse === 'orpheline@banc.test' && r[0].n === 3 && r[0].dernier === '2026-11-04T10:00:00.000Z', 'A1 seule l’adresse sans compte est comptée : 3 e-mails (une fois par e-mail, « +étiquette » compris), le dernier daté', JSON.stringify(r));
    dit(Array.isArray(r) && !r.some((x) => x.adresse === ADRESSE_COLLECTRICE), 'A1 la boîte collective VRM n’est jamais « une adresse sans compte »');
    const r2 = S.adressesSansCompte({ lignes, declarees, comptesEmails, acheteurs: {} });
    dit(Array.isArray(r2) && r2.map((x) => x.adresse).join(',') === 'orpheline@banc.test,acheteuse@banc.test', 'A1 sans la marque « compte acheteur », l’adresse acheteuse revient (le plus d’e-mails d’abord)', JSON.stringify(r2));
    dit(S.adressesSansCompte({ lignes: null, declarees, comptesEmails }) === null && S.adressesSansCompte({ lignes, declarees: null, comptesEmails }) === null && S.adressesSansCompte({ lignes, declarees, comptesEmails: null }) === null, 'A2 une lecture ratée ⇒ `null` (pas su), jamais « aucune »');
    dit(S.adressesSansCompte({ lignes: undefined, declarees, comptesEmails }) === undefined && S.adressesSansCompte({ lignes, declarees, comptesEmails: undefined }) === undefined, 'A2 en cours ⇒ `undefined` (rien ne s’affirme)');
    dit(Array.isArray(S.adressesSansCompte({ lignes: [], declarees: {}, comptesEmails: {} })) && S.adressesSansCompte({ lignes: [], declarees: {}, comptesEmails: {} }).length === 0, 'A2 lu et vide ⇒ une liste vide (là, c’est « aucune »)');
    // A3 — l'écriture, sur son clic.
    const comptes = [{ vinted_user_id: 111, login: 'vendeuse_a' }, { vinted_user_id: 222, login: 'vendeuse_b' }];
    dit(S.comptesSansAdresse(comptes, comptesEmails).map((a) => a.vinted_user_id).join(',') === '222', 'A3 seuls les comptes SANS adresse sont proposés');
    const u = S.relierAdresse(comptesEmails, 222, 'Orpheline@banc.test');
    dit(u && u['222'] === 'orpheline@banc.test' && u['111'] === 'Reliee@banc.test', 'A3 relier écrit le registre existant (uid → adresse), sans toucher aux autres', JSON.stringify(u));
    dit(S.relierAdresse(comptesEmails, 111, 'orpheline@banc.test') === null, 'A3 un compte qui a déjà son adresse n’est pas remplacé d’ici');
    dit(S.relierAdresse(comptesEmails, 222, 'reliee@banc.test') === null, 'A3 une adresse portée par un AUTRE compte n’est pas reliée deux fois');
    dit(S.relierAdresse(comptesEmails, '', 'orpheline@banc.test') === null && S.relierAdresse(comptesEmails, 222, 'pas-une-adresse') === null, 'A3 sans compte choisi ou sans adresse : rien');
  });

  await essaie('A4 écran', async () => {
    const APP = sansCommentaires(fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8'));
    const comp = (/function AdressesSansCompte\([\s\S]*?\n\}\n/.exec(APP) || [''])[0];
    dit(comp.length > 200, 'A4 le bloc `AdressesSansCompte` existe');
    dit(/lireTout\('id=like\.email_reception_\*&select=at:data->>at,adresses:data->adresses', \{ strict: true \}\)/.test(comp) && !/select=data['&]/.test(comp), 'A4 lecture projetée (date, adresses), toutes les pages — jamais `select=data`');
    const saves = comp.match(/save\('vinted_account_emails'/g) || [];
    const effets = (comp.match(/useEffect\([\s\S]*?\}, \[[^\]]*\]\);/g) || []).join('\n');
    dit(saves.length === 1 && !/save\(/.test(effets) && !/relierAdresse/.test(effets), 'A4 le registre n’est écrit qu’à UN endroit, dans le geste — jamais par un effet (rien deviné au chargement)');
    dit(/const relier = async \(adresse, compte\) => \{\s*const u = relierAdresse\(comptesEmails, compte\.vinted_user_id, adresse\);[\s\S]*?const ok = await askConfirm\([\s\S]*?if \(!ok\) return;\s*save\('vinted_account_emails', u\);/.test(comp), 'A4 « Relier » : SON choix de compte, la règle d’unicité, une confirmation, puis l’écriture');
    dit(/'vrm_adresses_acheteur',/.test(APP) && /save\(CLE_ADRESSES_ACHETEUR, n\)/.test(comp) && /annulerAcheteur/.test(comp), 'A4 « compte acheteur » est synchronisé (SYNC_KEYS) et réversible (« Annuler »)');
    dit(/liste === null\) return <div className="vrm-sans-compte" data-adresses-sans-compte="pas-su"><EtatPanne/.test(comp), 'A4 pas su ⇒ `EtatPanne` avec « Réessayer », jamais un silence présenté comme « aucune »');
    dit(/reglages=\{<><AdressesSansCompte comptes=\{vintedAccounts\}\/><EmailsSetting/.test(APP), 'A4 posé en tête de E-mails → Relier ma boîte');
    dit(/Adresse sans compte : \{x\.n\} e-mail/.test(comp) && /data-relier-compte=/.test(comp) && /data-compte-acheteur=/.test(comp), 'A4 la phrase « adresse sans compte : N e-mails » et ses deux gestes');
  });

  console.log(ko ? `\n❌ audit-adresse-sans-compte : ${ko} rouge(s)` : '\n✅ audit-adresse-sans-compte : tout est vert');
  process.exit(ko ? 1 : 0);
})();
}
