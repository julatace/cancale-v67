#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LES BORDEREAUX DE RETOUR DANS « IMPRIMER » (16 nov., lot impression-retours)
// node scripts/audit-impression-retours.cjs  [--prouve : chaque mutation doit rendre l'audit rouge]
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « Les colis imprimés tu peux mettre le retour, mais il faut bien préciser que c'est un retour et
// pas une vente. » Ce qui est tenu ici (le PDF réel est jugé par le banc `impression-retours`) :
//   L  les lignes de retour (`lignesRetoursLot`) : identité par le N° DE TRANSACTION seul, à déposer seulement,
//      ni remboursé, ni contredit par une vente, ni sans PDF ; clé `r:{n°}`, `retour: true` ;
//   C  compter à part : `compterLot` sépare ventes et retours ; `retoursDuPdf` lit les plages ;
//   M  les mots du tampon (RETOUR, N°, « pas une vente ») ;
//   W  le branchement dans l'app : les retours ne sont JAMAIS des lignes de `lignesLotTous` (le nombre du
//      bouton, « à envoyer », `vrm_colis_prets`), ils suivent les ventes dans le PDF (`lancerImpression`), un
//      item de retour prend le cartouche RETOUR (`impIt.retour`), jamais le tampon choisi pour une vente.
'use strict';
const fs = require('fs'), path = require('path');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver } = require('./_mutations-audit.cjs');

const MUTATIONS = {
  'retour-rembourse-garde': [['src/impression/retoursLot.js', " || (c.rembourse && c.rembourse.etat === 'oui')", '']],
  'retour-depose-garde': [['src/impression/retoursLot.js', " || c.etape !== 'a-deposer'", '']],
  'retour-sans-marque': [['src/impression/retoursLot.js', "cle, site: 'retour', retour: true,", "cle, site: 'vinted', retour: false,"]],
  'compte-mele': [['src/impression/retoursLot.js', 'if (estRetour(l)) retours++; else ventes++;', 'ventes++;']],
  'tampon-de-vente': [['src/App.jsx', "      if (it.retour) { impIt.retour = true; impIt.emplacement = ''; }", "      if (false) { impIt.retour = true; impIt.emplacement = ''; }"]],
  'retours-dans-ventes': [['src/App.jsx', '  const lignesLotImpression = () => [...lignesLotTous(), ...lignesRetoursImpr()];', '  const lignesLotImpression = () => lignesLotTous();']],
  'mot-retour-absent': [['src/impression/retoursLot.js', "haut: T('impr.retour.pdfHaut', 'RETOUR'),", "haut: '',"]],
};
if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d && !c ? ' — ' + String(d).slice(0, 300) : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String(e && e.stack || e).slice(0, 300)); } };
const importer = (p) => import('file://' + path.join(R, p));

(async () => {
  await essaie('L les lignes de retour', async () => {
    const L = await importer('src/impression/retoursLot.js');
    const carte = (tx, o = {}) => ({ cle: 'r:' + tx, tx, num: '', titre: 'Nike Dunk 42', pdf: true, contredit: false, rembourse: { etat: 'non' }, etape: 'a-deposer', limiteIso: '2026-11-20T09:00:00.000Z', achat: { seller: 'vendeuse_' + tx }, ...o });
    const res = { etat: 'lu', cartes: [
      carte('9501', { num: '31' }),
      carte('9502', { rembourse: { etat: 'oui' } }),          // remboursé ⇒ rien à imprimer
      carte('9503', { etape: 'depose' }),                       // déjà déposé ⇒ rien
      carte('9504', { pdf: false }),                            // pas de PDF ⇒ rien
      carte('9505', { contredit: true }),                       // le n° est une de SES ventes ⇒ rien
      carte('', {}),                                            // sans n° de transaction ⇒ jamais
      carte('9506', { titre: 'Nike Dunk 42' }),                 // MÊME titre que 9501 : sa propre ligne, son propre n°
    ] };
    const l = L.lignesRetoursLot(res, { imprimes: { 'r:9506': '2026-11-16T08:00:00Z' }, vendeurDe: (o) => o.seller });
    dit(l.map((x) => x.cle).join(',') === 'r:9501,r:9506', 'L1 seuls les retours À DÉPOSER, avec PDF, ni remboursés ni contredits, ont une ligne (identité : le n°)', JSON.stringify(l.map((x) => x.cle)));
    const a = l[0] || {};
    dit(a.retour === true && a.site === 'retour' && a.cochable === true && a.pdf === true && a.num === '31' && a.tx === '9501', 'L2 la ligne est marquée RETOUR (site, drapeau), N°31 par l’achat', JSON.stringify(a));
    dit(a.vendeur === 'vendeuse_9501' && (l[1] || {}).vendeur === 'vendeuse_9506', 'L3 le vendeur est lu sur l’achat relié par SON n° (jamais par le titre)', JSON.stringify(l.map((x) => x.vendeur)));
    dit((l[1] || {}).imprime === true && a.imprime === false, 'L4 un retour déjà imprimé ici n’est plus coché d’office (`imprime`)');
    dit(L.lignesRetoursLot({ etat: 'encours', cartes: [carte('1')] }).length === 0 && L.lignesRetoursLot(null).length === 0, 'L5 pas encore lu ⇒ aucune ligne (jamais devinée)');
  });
  await essaie('C compter à part', async () => {
    const L = await importer('src/impression/retoursLot.js');
    const c = L.compterLot([{ cle: '9420', site: 'vinted' }, { cle: 'r:9501', site: 'retour', retour: true }, { cle: 'r:9506', site: 'retour', retour: true }]);
    dit(c.ventes === 1 && c.retours === 2 && c.total === 3, 'C1 ventes et retours comptés À PART (1 vente, 2 retours)', JSON.stringify(c));
    const p = L.retoursDuPdf({ plages: [{ cle: '9420' }, { cle: 'r:9501', retour: true }] });
    dit(p.n === 2 && p.retours === 1, 'C2 le PDF dit « 2 bordereaux, dont 1 retour » (plages)', JSON.stringify(p));
    const S = await importer('src/lotSelection.js');
    const r = S.resumeLot([{ cle: '9420', site: 'vinted', pdf: true }]);
    dit(r.partent === 1, 'C3 `resumeLot` des ventes (le nombre du bouton) ne voit que les ventes', JSON.stringify(r));
  });
  await essaie('M les mots du tampon', async () => {
    const L = await importer('src/impression/retoursLot.js');
    const m = L.motsTamponRetour({ num: '31' });
    dit(m.haut === 'RETOUR' && m.num === 'N° 31' && /pas une vente/.test(m.bas), 'M1 « RETOUR » en tête, « N° 31 », « pas une vente »', JSON.stringify(m));
    const m2 = L.motsTamponRetour({ num: '' });
    dit(m2.haut === 'RETOUR' && m2.num === '', 'M2 sans N° ⇒ « RETOUR » seul (aucun N° deviné)');
    const t = (k) => ({ 'impr.retour.pdfHaut': 'RETURN', 'impr.retour.pdfBas': 'Purchase sent back · not a sale' })[k] || k;
    dit(L.motsTamponRetour({ num: '7' }, t).haut === 'RETURN', 'M3 les mots suivent la langue (tr)');
    for (const lg of ['fr', 'en', 'es', 'it', 'de']) {
      const d = (await importer(`src/i18n/langues/${lg}/impression.js`)).default;
      const k = ['impr.retour.mot', 'impr.retour.section', 'impr.retour.plus', 'impr.retour.dont', 'impr.retour.pdfHaut', 'impr.retour.pdfBas', 'impr.raison.retourSansPdf'].filter((x) => !d[x]);
      dit(!k.length, `M4 ${lg} : les textes des retours existent`, k.join(','));
    }
  });
  await essaie('W le branchement dans l’app', async () => {
    const app = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
    const corps = (nom) => { const i = app.indexOf(`  const ${nom} = `); return i < 0 ? '' : app.slice(i, app.indexOf('\n  };\n', i) + 5); };
    const lt = corps('lignesLotTous');
    dit(lt && !/Retours|retour/i.test(lt), 'W1 `lignesLotTous` (ventes : bouton, « à envoyer », `vrm_colis_prets`) ne contient aucun retour');
    dit(/v\.lot = r\.partent/.test(app) && /resumeLot\(lignesLotTous\(\)\)/.test(app), 'W2 `vrm_colis_prets.lot` reste le compte des VENTES');
    dit(/const lignesLotImpression = \(\) => \[\.\.\.lignesLotTous\(\), \.\.\.lignesRetoursImpr\(\)\];/.test(app), 'W3 le lot imprimé = les ventes PUIS les retours');
    const li = corps('lancerImpression');
    dit(/retoursChoisis\(/.test(li) && /choisiesV/.test(li), 'W4 `lancerImpression` ajoute les retours choisis aux ventes (jamais dans leur compte)');
    dit(/if \(it\.retour\) \{ impIt\.retour = true;/.test(app) && /choisir: it\.retour \? null/.test(app), 'W5 un item de retour prend le cartouche RETOUR (ni le tampon choisi d’une vente, ni l’aperçu)');
    dit(/const cartoucheTampon = \(bold, reg, numero, titre, v, retour = false\)/.test(app) && /if \(c\.cadre\)/.test(app), 'W6 le cartouche RETOUR existe (mot en grand, cadre noir)');
    dit(/if \(!fiche\.actif && !retour\) return (?:fin\()?\{ mode: 'aucun'/.test(app), 'W7 en thermique, un retour n’est jamais « rien de tamponné »');
    dit(/retour: true \}\);/.test(corps('preparerRetourPdf') || app.slice(app.indexOf('const preparerRetourPdf'), app.indexOf('const imprimerRetourAchat'))), 'W8 « Imprimer le bordereau » de la carte prend le même cartouche RETOUR');
    dit(/<RetoursLot lignes=\{Lret\}/.test(app) && /<RetoursAImprimer r=\{retoursAchatRes\} lignes=\{Lr\}/.test(app), 'W9 la section « Retour · tu renvoies un achat » est rendue (Ventes et « Choisir »)');
  });
  console.log(ko ? `\n❌ ${ko} contrôle(s) en échec` : '\n✅ impression des retours : tout est tenu');
  process.exit(ko ? 1 : 0);
})();
}
