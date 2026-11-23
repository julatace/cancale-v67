// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  AUDIT : LE POINT D'UN E-MAIL VINTED GO « RELAIS VINTED GO, <commerce>, <rue> » (23 nov., lot retours-suivi)
//  Julien (capture en production) : « c'est quoi ce bordel, comment ça le point relais n'est pas reconnu » — Achats → À retirer
//  disait « Point pas encore connu · adresse pas lue » pour un colis Vinted Go dont l'e-mail portait pourtant le lieu.
//  Mesuré (lecture seule) : `email_track_vinted_*` → lieu « Relais Vinted Go, <commerce>, <n° et rue> », SANS code postal (2 e-mails,
//  15 et 22 nov.) ; « Relais Vinted Go » n'était pas un TYPE connu (`TYPE_LIEU`, App.jsx) ⇒ pris pour le nom, puis écarté comme
//  « que des mots de type » (`nomRelaisPropre`) ⇒ le vrai nom perdu, point « inconnu ».
//  Contrôles (règle EXÉCUTÉE : `cleanLieu` extrait d'App.jsx, `pointsARetirer` de src/relaisColis.js) :
//    V1 « Relais Vinted Go, Droguerie Banc, 7 Rue Des Essais » ⇒ point « Droguerie Banc », jamais inconnu, adresse « 7 Rue… » ;
//    V2 la forme « Consigne Vinted Go, …, 56000 Vannes » inchangée (nom, code postal, adresse) ;
//    V3 le TYPE seul (« Relais Vinted Go ») n'est jamais un nom de point ; sans code postal, deux rues = deux points (jamais rangés
//       par le seul nom du commerce), la même rue = un point.
//    V4 un nom de point écrit sans virgule (« Relais Vinted Go Droguerie Banc ») : le TYPE retiré.
//  (23 nov. au soir, capture iPhone de Julien : « le transporteur inconnu, le logo mal mis ») L'AFFICHAGE du point, RENDU
//  (src/natif/RetraitsPoints.jsx empaqueté par esbuild, rendu par react-dom/server, variante C) sur la forme RÉELLE mesurée du colis
//  de la capture (`lieu` « Relais Vinted Go, <commerce>, <rue> » sans code postal + `horaires` lus) :
//    V5 le point réel est NOMMÉ (`data-rp-nom-de="point"`), adresse et horaires sur sa ligne, l'échéance en texte (`n-rp-echeance`),
//       jamais une pastille ;
//    V6 un point dont le nom n'est PAS lu mais dont les horaires le sont : le titre est le TRANSPORTEUR (« Vinted Go »,
//       `data-rp-nom-de="transporteur"`), jamais « Point pas encore connu », jamais « adresse pas lue » à côté des horaires ;
//    V7 rien de lu (ni nom, ni adresse, ni horaires) : le transporteur en titre, « adresse pas lue » dite (honnête, pas caché).
//  `--prouve` : chaque mutation réaffaiblit la règle ⇒ rouge.
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver } = require('./_mutations-audit.cjs');
const MUTATIONS = {
  'type-relais-vinted-oublie-app': [['src/App.jsx', 'const TYPE_LIEU = /^(?:relais\\s+vinted(?:\\s*go)?|', 'const TYPE_LIEU = /^(?:']],
  'type-relais-vinted-oublie-point': [['src/relaisColis.js', '(?:relais\\s+vinted(?:\\s*go)?|point\\s+relais|', '(?:point\\s+relais|']],
  'titre-point-inconnu-revient': [['src/natif/RetraitsPoints.jsx', "const lieu = p.nom || nomT || tr('retraits.p.pointRelais');", "const lieu = p.nom || tr('v2.retirer.pointInconnu');"]],
  'adresse-pas-lue-a-cote-des-horaires': [['src/natif/RetraitsPoints.jsx', "(p.adresse || horaires ? '' : tr('retraits.v.adressePasLue'))", "(p.adresse ? '' : tr('retraits.v.adressePasLue'))"]],
  'echeance-en-pastille': [['src/natif/RetraitsPoints.jsx', "{!c && echeance ? <span className=\"n-rp-etiquette n-rp-etat\"", "{echeance ? <span className=\"n-rp-etiquette n-rp-etat\""]],
};
if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else (async () => {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d && !c ? ' — ' + String(d).slice(0, 400) : '')); };
  try {
    // `cleanLieu` vit dans App.jsx (non exporté) : ses quatre déclarations sont extraites telles quelles et exécutées.
    const app = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
    const decl = (debut) => { const i = app.indexOf(debut); if (i < 0) throw new Error('introuvable : ' + debut); const j = app.indexOf('\n};', i); return app.slice(i, j + 3); };
    const ligne = (re) => { const m = app.match(re); if (!m) throw new Error('introuvable : ' + re); return m[0]; };
    const code = [ligne(/^const TYPE_LIEU = .*$/m), ligne(/^const titleCasePR = .*$/m), decl('const cleanLieu = (raw) => {'), decl('const cleanLieuCorps = (s) => {'), 'export { cleanLieu };'].join('\n');
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'audit-vgo-')), 'lieu.mjs');
    fs.writeFileSync(tmp, code);
    const { cleanLieu } = await import('file://' + tmp);
    const { pointsARetirer } = await import('file://' + path.join(R, 'src', 'relaisColis.js'));
    const point = (lieus) => pointsARetirer({ colis: lieus.map((l, i) => { const cl = cleanLieu(l); return { id: 'c' + i, cle: 'c' + i, titre: 'T', nom: cl.nom, adresse: cl.adresse, transporteur: 'vinted', code: String(100000 + i), jours: 2 }; }) }).points;
    const p1 = point(['Relais Vinted Go, Droguerie Banc, 7 Rue Des Essais'])[0];
    dit(p1 && !p1.inconnu && p1.nom === 'Droguerie Banc' && /^7 Rue des Essais$/i.test(p1.adresse), `V1 « Relais Vinted Go, Droguerie Banc, 7 Rue Des Essais » ⇒ « ${p1 && p1.nom} » · « ${p1 && p1.adresse} »`, JSON.stringify(p1 && { nom: p1.nom, inconnu: p1.inconnu, adresse: p1.adresse }));
    const p2 = point(['Consigne Vinted Go, Kusmi Banc, 13 Rue Saint-Vincent, 56000 Vannes'])[0];
    dit(p2 && p2.nom === 'Kusmi Banc' && p2.cp === '56000' && /13 Rue Saint-Vincent, 56000 Vannes/i.test(p2.adresse), `V2 « Consigne Vinted Go, …, 56000 Vannes » inchangé (« ${p2 && p2.nom} », ${p2 && p2.cp})`, JSON.stringify(p2));
    const seul = point(['Relais Vinted Go'])[0];
    dit(seul && seul.inconnu && !seul.nom, 'V3 le TYPE seul (« Relais Vinted Go ») n’est jamais un nom de point', JSON.stringify(seul && { nom: seul.nom, inconnu: seul.inconnu }));
    const deux = point(['Relais Vinted Go, Droguerie Banc, 7 Rue Des Essais', 'Relais Vinted Go, Droguerie Banc, 9 Rue Autre']);
    // V4 le nom d'un point écrit SANS virgule (« Relais Vinted Go Droguerie Banc ») : le TYPE retiré, le commerce gardé.
    const p4 = pointsARetirer({ colis: [{ id: 'v4', cle: 'v4', titre: 'T', nom: 'Relais Vinted Go Droguerie Banc', adresse: '7 Rue Des Essais', transporteur: 'vinted', code: '1', jours: 2 }] }).points[0];
    dit(p4 && p4.nom === 'Droguerie Banc', `V4 « Relais Vinted Go Droguerie Banc » ⇒ « ${p4 && p4.nom} »`, JSON.stringify(p4 && p4.nom));
    const meme = point(['Relais Vinted Go, Droguerie Banc, 7 Rue Des Essais', 'Relais Vinted Go, Droguerie Banc, 7 Rue des Essais']);
    dit(deux.length === 2 && meme.length === 1 && meme[0].arrives.length === 2, 'V3 sans code postal : deux rues ⇒ deux points, la même rue ⇒ un point (jamais rangé par le seul nom du commerce)', JSON.stringify([deux.map((p) => p.cle), meme.map((p) => p.cle)]));
    // ── V5–V7 : l'affichage RENDU (variante C) ──
    const esbuild = require(path.join(R, 'node_modules', 'esbuild'));
    const entree = `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server'; import { RetraitsPoints } from './src/natif/RetraitsPoints.jsx';
      export const rendre = (points, horaires) => renderToStaticMarkup(React.createElement(RetraitsPoints, { points, variante: 'c', aides: { titre: () => 'T', nomTransporteur: (k) => (k === 'vinted' ? 'Vinted Go' : ''), horairesDe: () => horaires, qrSrc: () => '', enGrand: () => null } }));`;
    const lot = await esbuild.build({ stdin: { contents: entree, resolveDir: R, loader: 'jsx' }, bundle: true, platform: 'node', format: 'cjs', loader: { '.css': 'empty', '.js': 'jsx' }, jsx: 'automatic', write: false, logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' } });
    const fic = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'audit-vgo-rendu-')), 'rendu.cjs');
    fs.writeFileSync(fic, lot.outputFiles[0].text);
    const { rendre } = require(fic);
    const HOR = 'fermé — ouvre demain à 8 h';
    const colisDe = (cl, i, jours = 3) => ({ id: 'r' + i, cle: 'r' + i, titre: 'T', nom: cl ? cl.nom : '', adresse: cl ? cl.adresse : '', transporteur: 'vinted', code: String(551234 + i), jours });
    const pts = (lieu, i) => pointsARetirer({ colis: [colisDe(lieu == null ? null : cleanLieu(lieu), i)] }).points;
    const attr = (h, re) => { const m = h.match(re); return m ? m[1] : null; };
    const h5 = rendre(pts('Relais Vinted Go, Droguerie Banc, 7 Rue Des Essais', 5), HOR);
    dit(attr(h5, /data-rp-nom-de="([^"]+)"[^>]*>Droguerie Banc</) === 'point' && /data-rp-adresse=""><span class="n-rp-adresse-txt">7 Rue des Essais<\/span><span class="n-rp-horaires"[^>]*> · fermé — ouvre demain à 8 h</i.test(h5)
      && /class="n-rp-echeance[^"]*" data-rp-rebours=/.test(h5) && !/n-rp-etiquette n-rp-etat/.test(h5),
      'V5 la forme réelle (Relais Vinted Go, sans code postal, horaires lus) : point nommé, « adresse · horaires » sur sa ligne, échéance en texte (pas une pastille)', h5.slice(0, 900));
    const h6 = rendre(pts(null, 6), HOR);
    dit(attr(h6, /data-rp-nom-de="([^"]+)"[^>]*>Vinted Go</) === 'transporteur' && !/v2\.retirer\.pointInconnu|pas encore connu/i.test(h6) && !/retraits\.v\.adressePasLue|adresse pas lue/i.test(h6) && h6.includes(HOR),
      'V6 nom pas lu, horaires lus ⇒ titre « Vinted Go » (le transporteur), ni « pas encore connu » ni « adresse pas lue » à côté des horaires', h6.slice(0, 900));
    const h7 = rendre(pts(null, 7), '');
    dit(attr(h7, /data-rp-nom-de="([^"]+)"[^>]*>Vinted Go</) === 'transporteur' && /retraits\.v\.adressePasLue|adresse pas lue/i.test(h7) && !/v2\.retirer\.pointInconnu|pas encore connu/i.test(h7),
      'V7 rien de lu ⇒ le transporteur en titre et « adresse pas lue » dite', h7.slice(0, 900));
  } catch (e) { dit(false, 'l’audit a pu s’exécuter', String(e && e.stack || e)); }
  console.log(ko ? `\n❌ audit-point-vinted-go : ${ko} rouge(s)` : '\n✅ audit-point-vinted-go : tout est vert');
  process.exit(ko ? 1 : 0);
})();
