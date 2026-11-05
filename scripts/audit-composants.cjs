// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LES COMPOSANTS PARTAGÉS (5 nov., chantier B de la revue de cohérence)
//
//  Il EXÉCUTE (esbuild → CommonJS, puis require) :
//   1. `montant()` de src/format.js : nombre, centimes, null, chaîne, objet prix
//      Vinted, devise étrangère dite ou écartée, −0, milliers, signe ;
//   2. les quatre anciennes écritures (`fmt`, `fmtE`, `fmtE0`, `prixTxt`, copiées
//      telles qu'elles étaient dans App.jsx avant le 5 nov.) contre leurs alias :
//      CHAQUE écart de rendu est listé et rangé dans une catégorie permise
//      (centimes inutiles · « pas su » ⇒ « — » · « -0 » · chaîne lue · objet
//      prix) — un écart hors catégorie est rouge ;
//   3. les mots de src/libelles.js (le vocabulaire retenu du 5 nov.) ;
//   4. le rendu (react-dom/server) de SheetShell, ChampRecherche, PhotoVide,
//      Numero, EtatPanne, BoutonBase, SegmenteBase ;
//   5. le branchement dans App.jsx (alias, relais SheetShell/Bouton/Segmente)
//      et la feuille de style (fond opaque, aucune animation d'opacité sur la
//      feuille, cibles 44 px, aucun rouge hors du N° en doublon).
//  `--prouve` : chaque mutation réaffaiblit une règle ; l'audit doit devenir rouge.
//  `node scripts/audit-composants.cjs [--prouve] [--ecarts]`
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const R = path.join(__dirname, '..');
const NM = [path.join(R, 'node_modules'), path.join(R, '..', '..', '..', 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
const esbuild = require(path.join(NM, 'esbuild'));
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const ECARTS = process.argv.includes('--ecarts');

// Chaque mutation : [fichier, avant, après]. Le motif doit exister.
const MUTATIONS = {
  null_zero:        ['src/format.js', '  if (n == null) return vide;\n', '  if (n == null) n = 0;\n'],
  centimes_toujours:['src/format.js', "if (mode === 'auto' && decimales === '00') decimales = '';", ''],
  moins_zero:       ['src/format.js', "if (Number(s) === 0) n = 0;", ''],
  etrangere_ignoree:['src/format.js', "if (devise !== 'EUR' && opts.etrangere === 'ecarter') return vide;", ''],
  devise_tue:       ['src/format.js', "${devise === 'EUR' ? '€' : devise}", '€'],
  chaine_nan:       ['src/format.js', "if (!t || !/^[+-]?(\\d+([.,]\\d*)?|[.,]\\d+)$/.test(t)) return null;", ''],
  arrondi_change:   ['src/format.js', ': Math.abs(n).toFixed(2);', ': (Math.floor(Math.abs(n) * 100) / 100).toFixed(2);'],
  prixtxt_arrondi:  ['src/format.js', "montant(p, { vide: 'sans prix', arrondi: 'decimal' })", "montant(p, { vide: 'sans prix' })"],
  fmt_milliers:     ['src/format.js', "export const fmt = (n) => montant(n, { milliers: false });", "export const fmt = (n) => montant(n);"],
  mot_poster:       ['src/libelles.js', "aEnvoyer:    Object.freeze({ titre: 'À envoyer', bas: 'à envoyer'", "aEnvoyer:    Object.freeze({ titre: 'À poster', bas: 'à poster'"],
  recu_colis:       ['src/libelles.js', "arrives:     Object.freeze({ titre: 'Arrivés'", "arrives:     Object.freeze({ titre: 'Reçus'"],
  numero_vide:      ['src/composants/Numero.jsx', '  if (n == null) return null;\n', '  if (n == null) n = \'—\';\n'],
  numero_blanc:     ['src/styles-composants.css', ':root[data-theme="dark"] body .vrm-num { background: #48484A; color: #F5F5F7; }', ':root[data-theme="dark"] body .vrm-num { background: #F5F5F7; color: #1D1D1F; }'],
  panne_deux:       ['src/composants/EtatPanne.jsx', '      ) : null}\n    </div>', '      ) : null}\n      <button type="button">Fermer</button>\n    </div>'],
  feuille_fond:     ['src/composants/SheetShell.jsx', '<div ref={refVoile} className="vrm-fs-voile" data-feuille-voile="" onClick={() => { const f = refFermer.current; if (f) f(); }} aria-hidden="true"/>', ''],
  feuille_opacite:  ['src/styles-composants.css', '  will-change: transform;\n  font-family', '  will-change: transform; animation: vrm-fs-voile-entree .2s ease-out both;\n  font-family'],
  croix_texte:      ['src/composants/SheetShell.jsx', '<span className="vrm-fs-croix-rond"><IconeComposant nom="close" taille={15} trait={2.2}/></span>', '×'],
  sans_portail:     ['src/composants/SheetShell.jsx', '  return createPortal(contenu, document.body);', '  return contenu;'],
  sans_retour:      ['src/composants/SheetShell.jsx', '{FermeAuRetour ? <FermeAuRetour fermer={onClose}/> : null}', ''],
  feuille_fondu_js: ['src/composants/SheetShell.jsx', "[{ transform: 'translate3d(0,100%,0)' }, { transform: 'translate3d(0,0,0)' }]", "[{ transform: 'translate3d(0,100%,0)', opacity: 0 }, { transform: 'translate3d(0,0,0)', opacity: 1 }]"],
  danger_rouge:     ['src/styles-composants.css', 'background: rgba(178,80,0,.1) !important; color: var(--vrm-warn, #B25000) !important;', 'background: rgba(215,0,21,.1) !important; color: #D70015 !important;'],
  croix_petite:     ['src/styles-composants.css', '  width: 44px; height: 44px; min-width: 44px; min-height: 44px; margin: 0; padding: 0;', '  width: 30px; height: 30px; min-width: 30px; min-height: 30px; margin: 0; padding: 0;'],
  recherche_croix:  ['src/composants/ChampRecherche.jsx', '      {valeur ? (\n        <button', '      {false ? (\n        <button'],
};

// Les quatre écritures d'AVANT (App.jsx, base 51c7e618), mot pour mot.
const AVANT = {
  fmt: (n) => isNaN(+n) ? '—' : Number(n).toFixed(2).replace('.', ',') + ' €',
  fmtE: (n) => (n == null ? '—' : Number(n).toFixed(2).replace('.', ',') + ' €'),
  fmtE0: (n) => (n == null ? '—' : Math.round(Number(n)).toLocaleString('fr-FR') + ' €'),
  prixTxt: (p) => (p == null ? 'sans prix' : `${p.toLocaleString('fr-FR', { minimumFractionDigits: p % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`),
};
const CORPUS = [0, 1, 12, 12.5, 12.34, 12.999, 0.001, -0.001, -5, -2.5, -0.4, 0.1 + 0.2, 1.005, 65, 249.5, 999.995, 1234, 1234.5, 15037.88, 1234567.891,
  NaN, Infinity, -Infinity, null, undefined, '', '  ', '12', '12.5', '88.0', '95.0', '12,5', 'abc', '12 €', true, false, [], {}, { amount: '12.5', currency_code: 'EUR' }];
const decrire = (v) => (typeof v === 'string' ? JSON.stringify(v) : (v && typeof v === 'object' ? JSON.stringify(v) : String(v)));

async function construire(mutation) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-composants-'));
  const src = (f) => JSON.stringify(path.join(R, 'src', f));
  fs.writeFileSync(path.join(dir, 'entree.jsx'), `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
export * as F from ${src('format.js')};
export * as Lb from ${src('libelles.js')};
export { SheetShell } from ${src('composants/SheetShell.jsx')};
export { ChampRecherche } from ${src('composants/ChampRecherche.jsx')};
export { PhotoVide } from ${src('composants/PhotoVide.jsx')};
export { Numero } from ${src('composants/Numero.jsx')};
export { EtatPanne } from ${src('composants/EtatPanne.jsx')};
export { BoutonBase, SegmenteBase } from ${src('composants/Bouton.jsx')};
export const rendre = (el) => renderToStaticMarkup(el);
export { React };
`);
  const plugins = mutation ? [{ name: 'mutant', setup(b) {
    const cible = path.join(R, mutation[0]);
    b.onLoad({ filter: /\.(jsx?|css)$/ }, (a) => {
      if (path.resolve(a.path) !== cible) return undefined;
      const t = fs.readFileSync(a.path, 'utf8');
      return { contents: t.replace(mutation[1], mutation[2]), loader: a.path.endsWith('.js') || a.path.endsWith('.jsx') ? 'jsx' : 'css' };
    });
  } }] : [];
  await esbuild.build({ entryPoints: [path.join(dir, 'entree.jsx')], bundle: true, outfile: path.join(dir, 'sortie.cjs'), format: 'cjs', platform: 'node', jsx: 'automatic',
    loader: { '.js': 'jsx' }, nodePaths: [NM], logLevel: 'silent', plugins, define: { 'process.env.NODE_ENV': '"production"' } });
  const M = require(path.join(dir, 'sortie.cjs'));
  return M;
}

// Range un écart (avant ≠ après) dans une catégorie permise, ou rend null.
function categorie(nom, v, avant, apres, M) {
  const vide = nom === 'prixTxt' ? 'sans prix' : '—';
  const nombreFini = typeof v === 'number' && Number.isFinite(v);
  const chaineNum = typeof v === 'string' && M.F.valeurMontant(v) != null;
  const objetPrix = v && typeof v === 'object' && !Array.isArray(v) && M.F.valeurMontant(v) != null;
  if (!nombreFini && !chaineNum && !objetPrix) return apres === vide ? 'pas su ⇒ « ' + vide + ' »' : null;
  if (chaineNum || objetPrix) {
    const n = M.F.valeurMontant(v);
    return apres === M.F[nom](n) ? (chaineNum ? 'chaîne lue comme un nombre' : 'objet prix lu sur `amount`') : null;
  }
  let a = avant;
  const cats = [];
  if (/^-0(,00)? €$/.test(a)) { a = a.replace(/^-/, ''); cats.push('« -0 » ⇒ « 0 »'); }
  if (/,00 €$/.test(a)) { a = a.replace(/,00 €$/, ' €'); cats.push('centimes inutiles'); }
  return a === apres && cats.length ? cats.join(' + ') : null;
}

async function audit(M, bavard) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard && (!c || !m.startsWith('·'))) console.log((c ? '✅ ' : '❌ ') + m + (d != null && d !== '' ? '  → ' + d : '')); };
  const F = M.F, Lb = M.Lb, h = M.React.createElement, rendre = M.rendre;
  const NB = ' ';

  // ── 1. montant() ──────────────────────────────────────────────────────────
  const CAS = [
    [[12], '12 €'], [[12.5], '12,50 €'], [[12.34], '12,34 €'], [[0], '0 €'], [[1234.5], `1${NB}234,50 €`], [[1234567], `1${NB}234${NB}567 €`],
    [[1250, { enCentimes: true }], '12,50 €'], [[1200, { enCentimes: true }], '12 €'],
    [[null], '—'], [[undefined], '—'], [[''], '—'], [['  '], '—'], [[NaN], '—'], [[Infinity], '—'], [['abc'], '—'], [[true], '—'], [[[]], '—'], [[{}], '—'],
    [[null, { vide: 'sans prix' }], 'sans prix'],
    [['88.0'], '88 €'], [['95.0'], '95 €'], [['12,5'], '12,50 €'], [['158.99'], '158,99 €'],
    [[{ amount: '95.0', currency_code: 'EUR' }], '95 €'], [[{ amount: '12.5', currency_code: 'GBP' }], '12,50 GBP'],
    [[{ amount: '12.5', currency_code: 'GBP' }, { etrangere: 'ecarter' }], '—'], [[12, { devise: 'usd' }], '12 USD'], [[12, { devise: 'USD', etrangere: 'ecarter' }], '—'],
    [[-0.001], '0 €'], [[-0.4, { centimes: 'jamais' }], '0 €'], [[-12.5], '-12,50 €'], [[5, { signe: true }], '+5 €'], [[0, { signe: true }], '0 €'], [[-5, { signe: true }], '-5 €'],
    [[12, { centimes: 'toujours' }], '12,00 €'], [[12.3, { centimes: 'toujours' }], '12,30 €'], [[1234.6, { centimes: 'jamais' }], `1${NB}235 €`],
    [[1234, { milliers: false }], '1234 €'], [[12.999], '13 €'], [[0.001], '0 €'], [[1.005, { arrondi: 'decimal' }], '1,01 €'], [[1.005], '1 €'],
  ];
  for (const [args, att] of CAS) {
    let r; try { r = F.montant(...args); } catch (e) { r = 'ERREUR ' + e.message; }
    dit(r === att, `montant(${args.map(decrire).join(', ')}) = « ${att} »`, r);
  }
  dit(F.valeurMontant(null) === null && F.valeurMontant('x') === null && F.valeurMontant('12.5') === 12.5 && F.valeurMontant(1250, { enCentimes: true }) === 12.5,
    'valeurMontant : null pour un montant pas su, le nombre sinon (jamais 0 pour « pas su »)');
  // « Au moins 0,00 € » ne se dit jamais : en mode auto, aucun « ,00 € ».
  const avecZeros = CORPUS.map((v) => F.montant(v)).filter((s) => /,00 /.test(s));
  dit(avecZeros.length === 0, 'aucun « ,00 € » écrit en mode auto', avecZeros.join(' | '));

  // ── 2. Les quatre alias contre les écritures d'avant ─────────────────────
  const ecarts = [];
  let horsCat = 0;
  for (const nom of Object.keys(AVANT)) {
    dit(typeof F[nom] === 'function', `· ${nom} est exporté par format.js`);
    for (const v of CORPUS) {
      let avant; try { avant = AVANT[nom](v); } catch (e) { avant = 'ERREUR ' + e.constructor.name; }
      const apres = F[nom](v);
      if (avant === apres) continue;
      const c = categorie(nom, v, avant, apres, M);
      ecarts.push({ nom, v: decrire(v), avant, apres, c });
      if (!c) horsCat++;
    }
  }
  for (const e of ecarts) dit(!!e.c, `· écart ${e.nom}(${e.v}) : « ${e.avant} » ⇒ « ${e.apres} »${e.c ? ' — ' + e.c : ''}`, e.c ? '' : 'écart NON permis');
  dit(horsCat === 0, `les écarts de rendu des quatre alias sont tous permis (${ecarts.length} écarts, ${horsCat} hors catégorie)`);
  if (bavard && ECARTS) {
    console.log('\n   Écarts de rendu (avant ⇒ après) :');
    for (const e of ecarts) console.log(`   · ${e.nom}(${e.v}) : « ${e.avant} » ⇒ « ${e.apres} » — ${e.c || 'HORS CATÉGORIE'}`);
    console.log('');
  }
  // Un nombre lu ne change que par ses centimes inutiles (le cœur de la consigne).
  const nombresTouches = ecarts.filter((e) => /^-?[\d.]+(e[+-]?\d+)?$/.test(e.v) && !/centimes|-0/.test(e.c || ''));
  dit(nombresTouches.length === 0, 'aucun nombre lu ne change autrement que par ses centimes inutiles (ou un « -0 »)', nombresTouches.map((e) => e.nom + '(' + e.v + ')').join(', '));

  // ── 3. Les mots ────────────────────────────────────────────────────────────
  const ATTENDU = { aEnvoyer: 'À envoyer', enRoute: 'En route', arrives: 'Arrivés', recu: 'Reçu', vendu: 'Vendu', benefice: 'Bénéfice', compta: 'Compta',
    statut: 'Statut', favoris: 'Favoris', comptesLies: 'Comptes liés', emails: 'E-mails', relierBoite: 'Relier ma boîte' };
  for (const [k, w] of Object.entries(ATTENDU)) dit(Lb.L[k] === w, `L.${k} = « ${w} »`, Lb.L[k]);
  const VERBES_ATT = { voir: 'Voir', imprimer: 'Imprimer', reessayer: 'Réessayer', modifier: 'Modifier', annuler: 'Annuler', fermer: 'Fermer', ajouter: 'Ajouter', effacer: 'Effacer' };
  for (const [k, w] of Object.entries(VERBES_ATT)) dit(Lb.VERBES[k] === w, `VERBES.${k} = « ${w} »`, Lb.VERBES[k]);
  const tous = Object.values(Lb.NOTIONS);
  dit(tous.every((n) => n.titre && n.bas && n.titre.charAt(0) === n.titre.charAt(0).toUpperCase() && n.bas === n.titre.charAt(0).toLowerCase() + n.titre.slice(1)),
    'chaque notion a un titre (majuscule) et le même mot en minuscule pour une phrase');
  dit(!tous.some((n) => /brut/i.test(n.titre)), 'aucun titre ne porte « brut »');
  const textes = [...tous.flatMap((n) => [n.titre, n.bas]), ...Object.values(Lb.VERBES).map((v) => (typeof v === 'function' ? v('Vinted') : v)), Lb.PAS_SU.sansRaison, Lb.PAS_SU.enCours, Lb.PAS_SU.phrase('X')];
  dit(!textes.some((t) => /\.\.\./.test(t)), 'aucun « ... » ASCII dans les mots');
  dit(!textes.some((t) => Lb.motsEcartesDans(t).length), 'aucun mot retenu n\'est un mot écarté', textes.filter((t) => Lb.motsEcartesDans(t).length).join(' | '));
  dit(Lb.L.recu === 'Reçu' && Lb.NOTIONS.arrives.ecartes.includes('reçus'), '« Reçu » est réservé à l\'argent (« reçus » écarté pour les colis)');
  dit(JSON.stringify(Lb.motsEcartesDans('3 colis à poster, 2 en transit')) === JSON.stringify(['à poster', 'en transit']) && Lb.motsEcartesDans('Reçu ce mois').length === 0,
    'motsEcartesDans reconnaît « à poster », « en transit » et laisse « Reçu »');
  dit(Lb.PAS_SU.vide === '—', 'le vide « pas su » est « — »');

  // ── 4. Le rendu ────────────────────────────────────────────────────────────
  const n1 = rendre(h(M.Numero, { n: 124 }));
  dit(/class="vrm-num vrm-num-normal"/.test(n1) && /data-num="124"/.test(n1) && />N°<\/span><span[^>]*>124</.test(n1), 'Numero : « N°124 », une seule forme (.vrm-num)', n1);
  dit(rendre(h(M.Numero, { n: null })) === '' && rendre(h(M.Numero, { n: '' })) === '', 'Numero : un N° absent ne s\'écrit pas (jamais « N° — »)');
  dit(/data-num-etat="doublon"/.test(rendre(h(M.Numero, { n: 'B125', etat: 'doublon' }))) && !/data-num-etat/.test(rendre(h(M.Numero, { n: 7, etat: 'rouge' }))),
    'Numero : seul « doublon » (et « aVerifier ») portent un état');
  const pv = rendre(h(M.PhotoVide, { taille: 56 }));
  dit(/role="img"/.test(pv) && /aria-label="Pas de photo"/.test(pv) && /data-photo-vide=""/.test(pv) && /width:56px;height:56px/.test(pv) && /<svg/.test(pv) && !/pas de photo</i.test(pv),
    'PhotoVide : case 56 × 56, icône, nom lu « Pas de photo », aucun mot dedans', pv);
  dit(/border-radius:12px/.test(rendre(h(M.PhotoVide, { taille: 40 }))) && /border-radius:14px/.test(pv), 'PhotoVide : rayon 14 (12 sous 44 px)');
  const ep = rendre(h(M.EtatPanne, { quoi: 'Le porte-monnaie Vinted', raison: 'Vinted a refusé la lecture (429).', onReessayer: () => {} }));
  dit((ep.match(/<button/g) || []).length === 1 && /Réessayer/.test(ep) && /Le porte-monnaie Vinted : pas su pour l’instant\./.test(ep) && /429/.test(ep) && /role="status"/.test(ep),
    'EtatPanne : la phrase « pas su », la raison, UN bouton « Réessayer »', ep);
  const ep2 = rendre(h(M.EtatPanne, { quoi: 'Les ventes' }));
  dit(!/<button/.test(ep2) && /La lecture n’a pas répondu\./.test(ep2), 'EtatPanne sans onReessayer : aucun bouton, une raison par défaut', ep2);
  dit(!/0,00/.test(ep + ep2), 'EtatPanne n\'écrit jamais « 0,00 € »');
  const cr = rendre(h(M.ChampRecherche, { valeur: 'nike', onChange: () => {} }));
  dit(/type="search"/.test(cr) && /data-champ-recherche-effacer/.test(cr) && /aria-label="Effacer la recherche"/.test(cr) && /value="nike"/.test(cr), 'ChampRecherche : la croix d\'effacement quand il y a du texte', cr);
  const cr0 = rendre(h(M.ChampRecherche, { valeur: '', onChange: () => {}, micro: true }));
  dit(!/data-champ-recherche-effacer/.test(cr0) && !/data-champ-recherche-micro/.test(cr0), 'ChampRecherche : champ vide ⇒ pas de croix ; pas d\'API de la voix ⇒ pas de micro (jamais un bouton mort)', cr0);
  const fs1 = rendre(h(M.SheetShell, { onClose: () => {}, titre: 'Titre', FermeAuRetour: () => h('i', { 'data-retour': '' }) }, h('p', null, 'corps')));
  dit(/role="dialog"/.test(fs1) && /aria-modal="true"/.test(fs1) && /data-feuille-croix=""/.test(fs1) && /aria-label="Fermer"/.test(fs1) && /data-retour/.test(fs1) && /data-feuille-poignee/.test(fs1),
    'SheetShell : dialogue, poignée, croix nommée « Fermer », FermeAuRetour monté', fs1);
  dit(/<button[^>]*data-feuille-croix[^>]*><span class="vrm-fs-croix-rond"><svg/.test(fs1), 'SheetShell : la croix est une ICÔNE (pas un « × » ni un mot)');
  const iVoile = fs1.indexOf('vrm-fs-voile'), iFeuille = fs1.indexOf('class="vrm-fs"');
  const voileFerme = fs1.slice(iVoile).indexOf('/>') + iVoile;
  dit(iVoile >= 0 && iFeuille > voileFerme, 'SheetShell : le voile est la SŒUR de la feuille (son fondu ne fait pas fondre la feuille)');
  const fs2 = rendre(h(M.SheetShell, { onClose: () => {} }, 'x'));
  dit(!/data-feuille-croix/.test(fs2), 'SheetShell sans titre : pas de croix ajoutée (les feuilles qui ont la leur ne la doublent pas)');
  dit(/vrm-fs-lumineuse/.test(rendre(h(M.SheetShell, { onClose: () => {}, lumineuse: true, titre: 'En grand' }, 'x'))), 'SheetShell lumineuse : la classe est posée');
  const bd = rendre(h(M.BoutonBase, { variante: 'danger' }, 'Supprimer'));
  dit(/class="vrm-b vrm-b-danger"/.test(bd) && /type="button"/.test(bd), 'Bouton : variante « danger »', bd);
  dit(/vrm-b-petit/.test(rendre(h(M.BoutonBase, { taille: 'petit' }, 'Copier'))) && /aria-busy="true"/.test(rendre(h(M.BoutonBase, { occupe: true }, 'Relire'))) && /disabled=""/.test(rendre(h(M.BoutonBase, { occupe: true }, 'Relire'))),
    'Bouton : taille « petit », « occupe » (grisé, aria-busy)');
  dit(/class="vrm-b vrm-b-secondaire"/.test(rendre(h(M.BoutonBase, { variante: 'rouge' }, 'x'))), 'Bouton : une variante inconnue retombe sur « secondaire »');
  const sg = rendre(h(M.SegmenteBase, { label: 'Site', value: 'a', onChange: () => {}, options: [{ v: 'a', l: 'Vinted', n: 3 }, { v: 'b', l: '', icone: 'search', titre: 'eBay' }] }));
  dit(/aria-pressed="true"/.test(sg) && /aria-label="eBay"/.test(sg) && /title="eBay"/.test(sg) && /vrm-seg-n/.test(sg), 'Segmente : choix pressé, segment en icône seule NOMMÉ, compte', sg);

  return ko;
}

function statiques(bavard) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard) console.log((c ? '✅ ' : '❌ ') + m + (d ? '  → ' + d : '')); };
  const app = lire('src/App.jsx');
  dit(/^const fmt {2}= fmtMontant;$/m.test(app), 'App.jsx : `fmt` est l\'alias de format.js');
  dit(/^ {2}const fmtE = fmtEMontant;/m.test(app) && /^ {2}const fmtE0 = fmtE0Montant;/m.test(app) && /^ {2}const prixTxt = prixTxtMontant;/m.test(app), 'App.jsx : `fmtE`, `fmtE0`, `prixTxt` sont des alias de format.js');
  dit(!/toFixed\(2\)\.replace\('\.',','\)\+' €'\);?\s*$/m.test(app.split('\n').filter((l) => /const (fmt|fmtE|fmtE0|prixTxt)\b/.test(l)).join('\n')), 'App.jsx : plus aucune écriture propre dans ces quatre définitions');
  dit(/function SheetShell\(props\) \{\n {2}return <SheetShellBase \{\.\.\.props\} FermeAuRetour=\{FermeAuRetour\}\/>;/.test(app), 'App.jsx : `SheetShell` relaie la feuille unique avec le vrai FermeAuRetour');
  dit(/function Bouton\(props\) \{\n {2}return <BoutonBase/.test(app) && /function Segmente\(props\) \{\n {2}return <SegmenteBase/.test(app), 'App.jsx : `Bouton` et `Segmente` relaient les composants partagés');
  const main = lire('src/main.jsx');
  const imports = [...main.matchAll(/^import '\.\/([^']+\.css)';/gm)].map((m) => m[1]);
  dit(imports.includes('styles-composants.css') && imports[imports.length - 1] === 'styles-composants.css', 'main.jsx : styles-composants.css chargé, en dernier');
  const css = lire('src/styles-composants.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const regle = (sel) => { const i = css.indexOf(sel + ' {'); return i < 0 ? '' : css.slice(i, css.indexOf('}', i)); };
  const fs = regle('.vrm-fs');
  dit(/background: var\(--vrm-bg/.test(fs) && /opacity: 1;/.test(fs) && !/animation/.test(fs) && !/transition/.test(fs), '.vrm-fs : fond opaque, aucune animation ni transition (seul le JS anime `transform`)', fs.slice(0, 160));
  dit(/width: 44px; height: 44px; min-width: 44px; min-height: 44px/.test(css), 'la croix de la feuille : cible 44 × 44');
  dit(/--cr-h: 44px/.test(css), 'le champ de recherche : 44 px au doigt');
  const rouges = (css.match(/#D70015|#FF6961|rgba\(215, ?0, ?21/gi) || []).length;
  const rougesNum = (css.match(/\.vrm-num\[data-num-etat="doublon"\][^{]*\{[^}]*(#D70015|#FF6961)/g) || []).length;
  dit(rouges === rougesNum && rougesNum === 2, 'aucun rouge hors de la pastille N° en doublon (clair + sombre)', `${rouges} rouge(s), ${rougesNum} sur le doublon`);
  dit(/:root\[data-theme="dark"\] body \.vrm-num \{ background: #48484A; color: #F5F5F7; \}/.test(css), 'la pastille N° n\'est jamais blanche en sombre (#48484A)');
  const tailles = [...css.matchAll(/font(?:-size)?:\s*(?:\d{3}\s+)?(\d+)px/g)].map((m) => +m[1]);
  dit(tailles.every((t) => [11, 12, 13, 15, 17, 20, 22, 28, 34, 38, 44].includes(t)), 'tailles de police sur l\'échelle fermée', tailles.join(','));
  const rayons = [...css.matchAll(/border-radius:\s*([\d\s px]+?)(?:\s*!important)?;/g)].flatMap((m) => m[1].trim().split(/\s+/).map((x) => parseFloat(x))).filter((x) => x > 3);
  dit(rayons.every((r) => [6, 12, 14, 20, 24, 999].includes(r)), 'rayons sur l\'échelle fermée', rayons.join(','));
  const sh = lire('src/composants/SheetShell.jsx');
  dit(/createPortal\(contenu, document\.body\)/.test(sh) && /prefers-reduced-motion/.test(sh) && /translationAffichee\(el\)/.test(sh) && /setPointerCapture/.test(sh),
    'SheetShell : portail, mouvement réduit, reprise depuis la position AFFICHÉE, capture du doigt');
  // La FEUILLE (`el.animate`) n'anime que `transform` ; seul le voile (`v.animate`) anime son opacité.
  const animsFeuille = sh.split('\n').filter((l) => /\bel\.animate\(/.test(l));
  dit(animsFeuille.length >= 2 && animsFeuille.every((l) => !/opacity/.test(l) && /transform/.test(l)), 'SheetShell : la feuille n\'anime que `transform` (aucun fondu d\'opacité)', animsFeuille.join(' | ').slice(0, 300));
  dit(/\bv\.animate\(\[\{ opacity/.test(sh), 'SheetShell : le voile suit la feuille (son opacité, à part)');
  return ko;
}

async function sourceAvecMutation(nom) {
  const [f, a] = MUTATIONS[nom];
  return lire(f).includes(a);
}

(async () => {
  if (process.argv.includes('--prouve')) {
    let rate = 0;
    for (const nom of Object.keys(MUTATIONS)) {
      const mu = MUTATIONS[nom];
      if (!(await sourceAvecMutation(nom))) { console.log(`❌ mutation ${nom} : motif absent de ${mu[0]}`); rate++; continue; }
      let ko = 0;
      if (mu[0].endsWith('.css') || ['croix_texte', 'sans_portail', 'feuille_fond', 'sans_retour', 'feuille_fondu_js'].includes(nom)) {
        // Les règles lues dans les fichiers : on réécrit le fichier le temps du contrôle.
        const p = path.join(R, mu[0]); const avant = fs.readFileSync(p, 'utf8');
        try { fs.writeFileSync(p, avant.replace(mu[1], mu[2])); ko += statiques(false); ko += await audit(await construire(null), false); }
        finally { fs.writeFileSync(p, avant); }
      } else {
        try { ko = await audit(await construire(mu), false); } catch (e) { ko = 1; }
      }
      console.log(`${ko ? '✅' : '❌'} mutation ${nom} : ${ko ? ko + ' rouge(s)' : 'AUCUN rouge'}`);
      if (!ko) rate++;
    }
    console.log(rate ? `\n❌ ${rate} mutation(s) sans rouge` : `\n✅ ${Object.keys(MUTATIONS).length} mutations, toutes rouges`);
    process.exit(rate ? 1 : 0);
  }
  let ko = statiques(true);
  ko += await audit(await construire(null), true);
  console.log(ko ? `\n❌ ${ko} contrôle(s) en échec` : '\n✅ audit-composants : tout est vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
