#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT « FINITIONS v36 » (6 nov.) — les restes des chantiers du 6 nov.
//   node scripts/audit-finitions-v36.cjs            (les règles telles qu'elles sont)
//   node scripts/audit-finitions-v36.cjs --prouve   (+ chaque mutation DOIT rougir)
// Récit : docs/passation/2026-11-06-finitions.md. Les points 1, 3 et 7 sont jugés
// dans les audits de leur règle (achats-a-relier, annonces-actions, conflits-numeros,
// en-ligne-deux-fois, rouge-doublon) ; celui-ci juge les autres :
//   N  (point 2) un N° d'ARCHIVE remis en vente : la nouvelle annonce a un N° neuf et
//      entre dans « nouveaux numéros à écrire sur tes cartons » (la liste existante,
//      `reattribue` / `reattribueAEcrire`) — `archivesAEcrire` EXÉCUTÉE : ambigu, encore
//      en ligne, pas d'archive, déjà dit ⇒ rien ; une fois seulement ; et l'app la branche ;
//   C  (point 4) Colis : la ligne de fraîcheur du bas n'est plus rendue (une voix : la puce
//      « N comptes à relire »), aucune feuille ne la cache plus ;
//   D  (point 5) `data-cible` reste le crochet des notifications : la liste « À aller
//      chercher » du Stock porte `data-aller-chercher` ;
//   K  (point 6) plus de blanc translucide écrit à la main (jours futurs de Ma journée : il
//      n'y en a pas ; « — » de la carte Compta) : le « — » rendu lit le jeton `surSombre2`,
//      comme toutes les cartes sombres (≥ 4,5:1 au pire point, deux thèmes) ;
//   T  (point 8) la phrase « code postal inconnu » nomme le geste qui EXISTE (« … » de Colis,
//      « + Ajouter un n° de suivi »), plus « Achats → À retirer » (écran qui n'existe plus).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const R = path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const sansCommentaires = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgba = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (m) { const p = m[1].split(',').map((x) => Number(x.trim())); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; } const h = /#([0-9a-f]{6})/i.exec(s || ''); return h ? [...hex('#' + h[1]), 1] : null; };
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
const sur = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));

const FICHIERS = ['src/repriseNumero.js', 'src/themeMineral.js', 'api/_lib/transporteurs.js', 'src/App.jsx', 'src/design/fusion.css', 'src/styles-colis-colonnes.css', 'src/styles-annonces-ventes.css'];
async function charger(mut) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finitions-v36-'));
  const T = {};
  for (const f of FICHIERS) { let t = lire(f); if (mut && mut.fichier === f) t = mut.fn(t); T[f] = t; }
  for (const f of ['src/repriseNumero.js', 'src/themeMineral.js']) { const p = path.join(dir, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, T[f]); }
  fs.writeFileSync(path.join(dir, 'src', 'package.json'), '{"type":"module"}');
  const Rep = await import('file://' + path.join(dir, 'src', 'repriseNumero.js'));
  const Th = await import('file://' + path.join(dir, 'src', 'themeMineral.js'));
  // La phrase de tête, exécutée (le module serveur n'a que des imports internes : on n'en garde que la fonction).
  const tr = T['api/_lib/transporteurs.js'];
  const dT = tr.indexOf('export function texteCodePostalMr(');
  const ctx = {}; vm.createContext(ctx);
  try { vm.runInContext(tr.slice(dT, tr.indexOf('\n}\n', dT) + 2).replace('export function', 'function') + '\nthis.f = texteCodePostalMr;', ctx); } catch (_) {}
  fs.rmSync(dir, { recursive: true, force: true });
  return { Rep, Th, texteCp: ctx.f, T };
}

function verifier(M, dit) {
  const { Rep, Th, texteCp, T } = M;
  const app = sansCommentaires(T['src/App.jsx']);
  // ── N (point 2)
  const ok = (n) => !/^B/i.test(String(n || '').trim()) && !!String(n || '').trim();   // la règle de l'app : un N° à lettres « B » est une archive
  const cle = (n) => String(n == null ? '' : n).trim().toUpperCase();
  const A = Rep.archivesAEcrire;
  if (typeof A !== 'function') dit(false, 'N', 'archivesAEcrire existe (src/repriseNumero.js)');
  else {
    const base = { enLigneIds: ['9002'], recrees: { 9002: '9001' }, numeros: { 9002: { numero: '45', auto: true } }, anciens: { 9001: 'B230' }, reprenable: ok, cle };
    const r = A(base);
    dit(r['9002'] && r['9002'].de === 'B230' && r['9002'].vers === '45' && Object.keys(r).length === 1, 'N', 'remise en vente d’un N° d’archive (B230) : la nouvelle (N°45) est « à écrire » B230 → 45', JSON.stringify(r));
    dit(!Object.keys(A({ ...base, numeros: { 9002: { numero: '45', reattribue: { de: 'B230', vers: '45', ecrit: '2026-11-06' } } } })).length, 'N', 'après « C’est écrit » (un `reattribue` posé) : rien ne revient');
    dit(!Object.keys(A({ ...base, enLigneIds: [] })).length, 'N', 'la nouvelle pas (encore) en ligne : rien');
    dit(!Object.keys(A({ ...base, anciens: { 9001: '230' } })).length, 'N', 'un N° qui se REPREND (pas une archive) : rien ici (la reprise le remet)');
    dit(!Object.keys(A({ ...base, enLigneIds: ['9002', '9003'], recrees: { 9002: '9001', 9003: '9001' }, numeros: { 9002: { numero: '45' }, 9003: { numero: '46' } } })).length, 'N', 'deux nouvelles pour la même ancienne : on ne devine pas');
    dit(!Object.keys(A({ ...base, numeros: { 9002: {} } })).length, 'N', 'la nouvelle sans N° encore : rien (le N° neuf vient d’abord)');
    const avecFiche = { ...base.numeros, 9001: { numero: 'B230' } };
    dit(!Object.keys(A({ ...base, numeros: avecFiche, anciens: {} })).length && !Object.keys(A({ ...base, numeros: avecFiche, anciens: null })).length, 'N', 'seulement les remises que VRM accompagne (`anciens`), jamais tout l’historique');
  }
  dit(/numArchive:String\(paire\.numAffiche\)/.test(app), 'N', '« Remettre en vente » garde le N° d’archive dans son suivi (`vrm_repub_main.numArchive`)');
  dit(/archivesAEcrire\(\{ enLigneIds: items\.map\(\(x\) => x\.id\), recrees: recreesEff, numeros: nextNum, anciens: anciensArchive,/.test(app) && /reattribue: \{ de: ae\[nid\]\.de, vers: ae\[nid\]\.vers, at: new Date\(\)\.toISOString\(\), archive: true \}/.test(app), 'N', 'l’app pose `reattribue` (la liste « à écrire sur tes cartons » existante) — pas une seconde liste');
  dit(/const reattribueAEcrire = \(f\) => !!\(f && f\.reattribue && !f\.reattribue\.ecrit && cleNum\(f\.numero\) === cleNum\(f\.reattribue\.vers\)\);/.test(app) && /f\.reattribue\.archive \? 'Ancien numéro : il ne se redonne pas'/.test(app), 'N', 'la liste reste `reattribueAEcrire` ; la ligne dit « Ancien numéro : il ne se redonne pas »');
  // ── C (point 4)
  dit(!/vrm-colis-fraicheur/.test(app), 'C', 'Colis : la ligne de fraîcheur du bas n’est plus rendue');
  dit(/data-comptes-a-relire=\{nRelire\}/.test(app), 'C', 'la seule voix reste la puce « N comptes à relire » (`data-comptes-a-relire`)');
  const css = ['src/design/fusion.css', 'src/styles-colis-colonnes.css', 'src/styles-annonces-ventes.css'].map((f) => T[f].replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
  dit(!/vrm-colis-fraicheur/.test(css), 'C', 'aucune feuille ne cache plus une ligne rendue (plus de règle `.vrm-colis-fraicheur`)');
  // ── D (point 5)
  const st = (/<div data-stock-cibles=\{cibles\.length\}[\s\S]*?<\/div>\); \}\)\(\)\}/.exec(app) || [''])[0];
  dit(!!st && /data-aller-chercher=\{k\}/.test(st) && !/data-cible=/.test(st), 'D', 'la liste « À aller chercher » porte `data-aller-chercher`, plus `data-cible` (le crochet des notifications)', st.slice(0, 160));
  // ── K (point 6)
  // Les deux blancs « écrits à la main » visaient des éléments qui n'existent plus : aucun jour futur
  // (la semaine de Ma journée = les 7 derniers jours) et plus de `.vrm-compta-hero` dans la carte
  // « gagné » (CarteStatsApp depuis le 3 nov.). Le « — » RENDU de cette carte est `.vrm-fu-grand.is-vide`,
  // que `.vrm-compta-carte > .vrm-carte-stats .vrm-fu-grand { color: #fff }` forçait au blanc plein.
  for (const [nom, t] of [['clair', Th.MINERAL], ['sombre', Th.MINERAL_DARK]]) {
    const clair = rgba(t.carteSombreClair), fg = rgba(t.surSombre2), caseFond = sur(rgba(t.caseSombre), clair);
    const rF = ratio(sur(fg, clair), clair), rC = ratio(sur(fg, caseFond), caseFond);
    dit(rF >= 4.5 && rC >= 4.5, 'K', `${nom} : le « — » prend surSombre2, ≥ 4,5:1 au pire point (fond ${rF.toFixed(2)}:1, case ${rC.toFixed(2)}:1 ; un grand texte n'en demande que 3)`);
  }
  const fus = T['src/design/fusion.css'].replace(/\/\*[\s\S]*?\*\//g, '');
  dit(/\.vrm-compta-carte > \.vrm-carte-stats \.vrm-fu-grand:not\(\.is-vide\) \{ color: #fff; \}/.test(fus) && /\.vrm-compta-carte > \.vrm-carte-stats \.vrm-fu-grand\.is-vide \{ color: var\(--fu-sur-sombre-2\); \}/.test(fus) && !/\.vrm-compta-carte > \.vrm-carte-stats \.vrm-fu-grand \{ color: #fff; \}/.test(fus), 'K', 'le « — » de la carte Compta lit le jeton (--fu-sur-sombre-2), comme toutes les cartes sombres — plus forcé au blanc');
  dit(/\.vrm-fu-grand\.is-vide \{ color: var\(--fu-sur-sombre-2\); \}/.test(fus), 'K', 'la règle commune des vides (`.vrm-fu-grand.is-vide`) lit le jeton');
  const blancs = fus.split('\n').filter((l) => /color:\s*rgba\(255,\s*255,\s*255,\s*\.(38|5)\)/.test(l));
  dit(!blancs.length, 'K', 'fusion.css : plus de texte blanc à 38 % ou 50 % écrit à la main', blancs.join(' ¦ ').slice(0, 200));
  dit(!/data-futur/.test(fus) && !/data-futur/.test(app), 'K', 'aucune règle pour un « jour futur » qui n’existe pas (la semaine de Ma journée = les 7 derniers jours)');
  // ── T (point 8)
  const tx = typeof texteCp === 'function' ? texteCp({ inconnu: 1 }).join(' ') : '';
  dit(/« … » en haut de Colis/.test(tx) && /« \+ Ajouter un n° de suivi »/.test(tx) && !/Achats → À retirer/.test(tx), 'T', '« code postal inconnu » nomme le geste qui existe (« … » de Colis → « + Ajouter un n° de suivi »)', tx);
  dit(/'\+ Ajouter un n° de suivi'/.test(app) && /data-colis-outils-bascule=""/.test(app), 'T', 'ce geste existe bien : le bouton « + Ajouter un n° de suivi » et « … » de Colis');
  dit(/\{x\.trInconnu \? <span className="vrm-rp-sous" data-transp="transporteur-inconnu">Transporteur pas encore connu : le suivi Vinted ne le nomme pas<\/span> : null\}/.test(app), 'T', 'la ligne ouverte d’un colis dont le suivi ne nomme pas le transporteur le DIT (« pas su » ≠ rien)');
}

const MUTATIONS = [
  ['N', 'tout l’historique ressorti (anciens ignorés : les fiches suffisent)', 'src/repriseNumero.js', (t) => t.replace("const de = String(anciens[a] == null ? '' : anciens[a]).trim();", "const de = String(anciens[a] == null ? ((numeros || {})[a] || {}).numero || '' : anciens[a]).trim();").replace("if (!recrees || typeof recrees !== 'object' || !anciens || typeof anciens !== 'object') return out;", "if (!recrees || typeof recrees !== 'object') return out; anciens = anciens || {};")],
  ['N', '« C’est écrit » oublié : la ligne revient', 'src/repriseNumero.js', (t) => t.replace('    if (f.reattribue) continue;                                // déjà dit (ou « C\'est écrit »)\n', '')],
  ['N', 'deux nouvelles : on devine', 'src/repriseNumero.js', (t) => t.replace('    if (parAncien[a].length !== 1) continue;                   // ambigu : on ne devine pas\n', '')],
  ['N', 'l’archive pas gardée dans le suivi', 'src/App.jsx', (t) => t.replace(", ...(paire.archive && paire.numAffiche ? { numArchive:String(paire.numAffiche) } : {})", '')],
  ['N', 'l’app ne pose plus `reattribue`', 'src/App.jsx', (t) => t.replace('reattribue: { de: ae[nid].de, vers: ae[nid].vers, at: new Date().toISOString(), archive: true }', 'archiveAEcrire: ae[nid]')],
  ['C', 'la ligne du bas remise', 'src/App.jsx', (t) => t.replace("        {!colisSansCompte && <NoAcc/>}", "        <div className=\"vrm-colis-fraicheur\"><FraicheurDonnees jours={liveStats && liveStats.dataAgeJours} siAJour={false}/></div>\n        {!colisSansCompte && <NoAcc/>}")],
  ['D', '`data-cible` remis sur les N° du Stock', 'src/App.jsx', (t) => t.replace('key={k} data-aller-chercher={k} onClick', 'key={k} data-cible={k} onClick')],
  ['K', 'le « — » de Compta reforcé au blanc', 'src/design/fusion.css', (t) => t.replace('.vrm-compta-carte > .vrm-carte-stats .vrm-fu-grand:not(.is-vide) { color: #fff; }', '.vrm-compta-carte > .vrm-carte-stats .vrm-fu-grand { color: #fff; }')],
  ['K', 'un blanc à 50 % remis à la main', 'src/design/fusion.css', (t) => t.replace('.vrm-fu-grand.is-vide { color: var(--fu-sur-sombre-2); }', '.vrm-fu-grand.is-vide { color: rgba(255,255,255,.5); }')],
  ['K', 'le jour futur à 38 % remis', 'src/design/fusion.css', (t) => t + '\n.vrm-fu-jour[data-futur] > b { background: transparent; color: rgba(255,255,255,.38); }\n'],
  ['T', 'la phrase d’avant (Achats → À retirer)', 'api/_lib/transporteurs.js', (t) => t.replace('— ajoute ce n° avec son code postal : « … » en haut de Colis, puis « + Ajouter un n° de suivi ».', '— ajoute ce n° avec son code postal dans « N° de suivi ajoutés » (Achats → À retirer).')],
  ['T', '« transporteur pas encore connu » tu', 'src/App.jsx', (t) => t.replace('{x.trInconnu ? <span className="vrm-rp-sous" data-transp="transporteur-inconnu">', '{false ? <span className="vrm-rp-sous" data-transp="transporteur-inconnu">')],
];

(async () => {
  let ko = 0;
  const parCle = {};
  const dit = (c, k, m, d) => { parCle[k] = parCle[k] || { ok: 0, ko: 0 }; if (c) parCle[k].ok++; else { parCle[k].ko++; ko++; } console.log((c ? '✅ ' : '❌ ') + k + ' ' + m + (!c && d ? ' — ' + d : '')); };
  verifier(await charger(null), dit);
  console.log('\n' + Object.entries(parCle).map(([k, v]) => `${k} : ${v.ok} vert(s), ${v.ko} rouge(s)`).join(' · '));
  if (PROUVE) {
    console.log('\n── Mutations (chacune DOIT rougir)');
    for (const [k, nom, fichier, fn] of MUTATIONS) {
      const avant = lire(fichier);
      if (fn(avant) === avant) { ko++; console.log(`❌ mutation ${k} « ${nom} » : le texte à muter est introuvable`); continue; }
      let rouges = 0;
      try { verifier(await charger({ fichier, fn }), (c) => { if (!c) rouges++; }); } catch (_) { rouges++; }
      if (!rouges) ko++;
      console.log(`${rouges ? '✅' : '❌'} mutation ${k} « ${nom} » : ${rouges} rouge(s)`);
    }
  }
  console.log(ko ? `\n❌ audit-finitions-v36 : ${ko} défaut(s)` : '\n✅ audit-finitions-v36 : tout est vert');
  process.exit(ko ? 1 : 0);
})();
