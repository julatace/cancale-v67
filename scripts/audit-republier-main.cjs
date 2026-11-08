// Audit : « REPUBLIER À LA MAIN » RÉGLÉ COMME L'ATELIER (6 nov., Julien : « je veux que
// on puisse régler comme quand c'est VRM qui fait »).
//
// Il EXÉCUTE la règle commune (src/republierReglages.js) et l'extension, et lit le
// branchement de l'app :
//   A. un réglage posé dans l'atelier donne le MÊME résultat à la main :
//      A1 le titre et le prix que l'atelier envoie (`apercuRepub`) sont ceux que la
//         main copie (`annonceRepubliee`) — baisse en %, en €, arrondi, prix commun,
//         plancher (jamais sous le prix d'achat), titre modifié ;
//      A2 le N° est posé selon `vrm_num_vinted` (bas/haut de la description, fin du
//         titre), la lettre reste la dernière ligne, un titre trop long n'est jamais coupé ;
//      A3 la lettre : la fonction de l'EXTENSION (`sansLettre` de `recreerVinted`,
//         extraite de background.js et exécutée) et celle de l'app rendent la même base ;
//      A4 la photo : `photoReglee` + `reglagesPhotoSurs` de l'EXTENSION, exécutées sur une
//         fausse toile, font les MÊMES gestes (filtre, rotation, zoom, bornes) que
//         `dessinerPhotoReglee` (la toile de « à la main ») — et l'aperçu CSS de l'atelier
//         dit le même filtre ;
//      A5 « pas su » reste « pas su » : un prix pas lu reste null, jamais 0 ;
//      A6 l'objet synchronisé se relit à l'identique (atelier → main), une valeur inconnue
//         retombe au neutre, l'ancien réglage photo de la main est repris une fois ;
//      A7 (décision du 6 nov., qui respecte la sienne du 29 oct. : « le prix ne change plus
//         par défaut ») seuls la PHOTO et la LETTRE sont gardés d'une ouverture à l'autre ;
//         la baisse de PRIX et le TITRE repartent de « Garder » / « Ne pas changer » à chaque
//         ouverture — mais valent pour toutes les paires d'une même série à la main ;
//   B. l'app (src/App.jsx, commentaires retirés) : les deux feuilles lisent LA source
//      (`useReglagesRepub`), l'atelier calcule par `apercuRepub`, la main par
//      `annonceRepubliee` et `dessinerPhotoReglee`, AUCUNE copie (ni prix, ni titre, ni
//      filtre, ni rotation) dans App.jsx ni dans annoncesActions.js ; la clé est dans
//      SYNC_KEYS ; « Mêmes réglages » est dit des deux côtés ; « Modifier prix ou titre »
//      garde ses réglages à lui ; rien ne part chez Vinted depuis la main.
// `--prouve` : chaque mutation (une copie qui diverge, une règle affaiblie) doit rougir.
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm'), url = require('url');
const RAC = path.join(__dirname, '..');
const F = {
  regle: path.join(RAC, 'src', 'republierReglages.js'),
  app: path.join(RAC, 'src', 'App.jsx'),
  actions: path.join(RAC, 'src', 'annoncesActions.js'),
  ext: path.join(RAC, 'vinted-sync-extension', 'background.js'),
};

const MUTATIONS = {
  // Une COPIE qui diverge (la crainte de Julien : « régler dans l'un » ≠ « l'autre »).
  copie_prix_app: { f: 'app', m: (s) => s.replace('function AtelierLots(', 'function lotAppliquePrix(base, op, floor) { return { prix: Number(base) * 0.9, sousPlancher: false, flags: [] }; }\nfunction AtelierLots(') },
  copie_filtre_main: { f: 'app', m: (s) => s.replace("if (dessinerPhotoReglee(ctx, img, w, h, r) === 'pixels')", "ctx.filter = `brightness(${r.bright})`; ctx.rotate(r.rot * Math.PI / 180); if (false)") },
  copie_apercu_atelier: { f: 'app', m: (s) => s.replace('const apercu = (a) => apercuRepub(a, regs);', 'const apercu = (a) => ({ titre: null, prix: a.prix != null ? Math.round(a.prix * 0.9) : null, plancher: false, tropLong: false, invalide: false });') },
  copie_texte_main: { f: 'app', m: (s) => s.replace('const ann = annonceRepubliee(', 'const ann0 = annonceRepubliee(').replace("  const marque = String(f.brand || paire.marque || '')", "  const ann = { ...ann0, prix: prixLu };\n  const marque = String(f.brand || paire.marque || '')") },
  reglages_locaux_main: { f: 'app', m: (s) => { const i = s.indexOf('function RepublierALaMain'); return s.slice(0, i) + s.slice(i).replace('const [regs, poserRegs] = useReglagesRepub(encours);', "const [regs, poserRegs] = useState(() => lireReglagesRepub(load('vrm_main_reglages', null)));"); } },
  // (6 nov.) Une baisse (ou un titre) GARDÉE d'une ouverture à l'autre : rouge.
  baisse_gardee_regle: { f: 'regle', m: (s) => s.replace('prix: e ? e.prix : { ...PRIX_NEUTRE }, titre: e ? e.titre : { ...TITRE_NEUTRE } };', 'prix: e ? e.prix : g.prix, titre: e ? e.titre : g.titre };') },
  baisse_gardee_ecrite: { f: 'regle', m: (s) => s.replace('return { photo: r.photo, lettre: r.lettre };', 'return { photo: r.photo, lettre: r.lettre, prix: r.prix, titre: r.titre };') },
  baisse_gardee_app: { f: 'app', m: (s) => s.replace('save(CLE_REGLAGES_REPUB, reglagesGardes(n));', 'save(CLE_REGLAGES_REPUB, n);') },
  baisse_relue_nuage: { f: 'app', m: (s) => s.replace('const n = { ...courant.current, photo: g.photo, lettre: g.lettre };', 'const n = lireReglagesRepub(load(CLE_REGLAGES_REPUB, null));') },
  serie_oublie_prix: { f: 'app', m: (s) => s.replace('onClick={() => onSuivante({ prix: regs.prix, titre: regs.titre })}', 'onClick={() => onSuivante(null)}') },
  reglages_locaux_atelier: { f: 'app', m: (s) => s.replace('const [regsP, poserRegsP] = useReglagesRepub();', 'const [regsP, poserRegsP] = useState(() => lireReglagesRepub(null));') },
  cle_pas_synchro: { f: 'app', m: (s) => s.replace("  'vrm_republier_reglages',\n", '') },
  modifier_partage: { f: 'app', m: (s) => s.replace("const partage = action === 'recreer' || action === 'versBrouillon';", 'const partage = true;') },
  copie_filtre_actions: { f: 'actions', m: (s) => s.replace("export { PHOTO_NEUTRE as REGLAGES_NEUTRES, filtrePhoto as filtreReglages, nomPhotoReglee, appliquerCouleursPixels } from './republierReglages.js';", "export { PHOTO_NEUTRE as REGLAGES_NEUTRES, nomPhotoReglee, appliquerCouleursPixels } from './republierReglages.js';\nexport function filtreReglages(r) { const x = { bright: 1, contrast: 1, sat: 1, rot: 0, zoom: 1, ...(r || {}) }; return { filtre: `brightness(${Math.min(1.6, x.bright)}) contrast(${x.contrast}) saturate(${x.sat})`, rot: x.rot, zoom: Math.min(1.5, x.zoom) }; }") },
  // Une règle affaiblie dans le module commun.
  bornes_divergent: { f: 'regle', m: (s) => s.replace("{ cle: 'zoom', l: 'Zoom', min: 1, max: 2, pas: 0.01 }", "{ cle: 'zoom', l: 'Zoom', min: 1, max: 1.5, pas: 0.01 }") },
  sans_rotation: { f: 'regle', m: (s) => s.replace('ctx.rotate(f.rot * Math.PI / 180); ', '') },
  prix_main_sans_baisse: { f: 'regle', m: (s) => s.replace('prix: ap.prix != null ? ap.prix : prixAvant, prixAvant,', 'prix: prixAvant, prixAvant,') },
  sans_numero: { f: 'regle', m: (s) => s.replace('const titre = e.pose ? e.titre : titre0;', 'const titre = titre0;').replace('const description = e.pose ? e.description : desc0;', 'const description = desc0;') },
  lettre_empilee: { f: 'regle', m: (s) => s.replace('const base = sansLettre(desc);', "const base = String(desc || '').trim();") },
  plancher_oublie: { f: 'regle', m: (s) => s.replace('if (floor != null && isFinite(floor) && p < floor)', 'if (false)') },
  prix_pas_lu_zero: { f: 'regle', m: (s) => s.replace('const prixAvant = a.prix != null && Number(a.prix) > 0 ? Number(a.prix) : null;', 'const prixAvant = Number(a.prix) || 0;') },
  inconnu_garde: { f: 'regle', m: (s) => s.replace("base: BASES_PRIX.includes(p.base) ? p.base : 'aucun',", "base: p.base || 'aucun',") },
};

async function chargerModule(src) {
  if (src == null) return null;
  const f = path.join(os.tmpdir(), `republierReglages-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src.replace(/from '\.\/([^']+)'/g, (_, m) => `from '${url.pathToFileURL(path.join(RAC, 'src', m)).href}'`));
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}
// Une fausse toile qui note chaque geste (arrondi à 4 décimales).
function fausseToile() {
  const gestes = []; const r4 = (x) => (typeof x === 'number' ? Math.round(x * 1e4) / 1e4 : (x && x.__img ? 'IMG' : x));
  const ctx = { _filtre: 'none', fillStyle: '' };
  Object.defineProperty(ctx, 'filter', { get() { return this._filtre; }, set(v) { this._filtre = v; gestes.push(`filter=${v}`); }, enumerable: true });
  for (const k of ['fillRect', 'translate', 'rotate', 'scale', 'drawImage']) ctx[k] = (...a) => gestes.push(`${k}(${a.map(r4).join(',')})`);
  return { ctx, gestes };
}
// La photo réglée de l'EXTENSION (background.js, lue telle quelle, exécutée).
function photoExtension(extSrc) {
  const i = extSrc.indexOf('const RECREER_DEF'); const j = extSrc.indexOf('// ═══', extSrc.indexOf('async function photoReglee'));
  if (i < 0 || j < 0) throw new Error('photoReglee introuvable dans background.js');
  const code = extSrc.slice(i, j) + '\n;globalThis.__x = { reglagesPhotoSurs, photoReglee };';
  let derniere = null;
  const bac = {
    noterDiag() {},
    createImageBitmap: async () => ({ width: 800, height: 1000, __img: true, close() {} }),
    OffscreenCanvas: class { constructor(w, h) { this.w = w; this.h = h; const t = fausseToile(); this.t = t; derniere = t; } getContext() { return this.t.ctx; } async convertToBlob() { return { type: 'image/jpeg' }; } },
  };
  vm.createContext(bac); vm.runInContext(code, bac);
  return {
    surs: bac.__x.reglagesPhotoSurs,
    gestes: async (r) => { derniere = null; await bac.__x.photoReglee({ type: 'image/webp' }, bac.__x.reglagesPhotoSurs(r)); return derniere ? derniere.gestes : null; },
  };
}
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const tranche = (s, debut, fin) => { const i = s.indexOf(debut); if (i < 0) return ''; const j = s.indexOf(fin, i + debut.length); return s.slice(i, j < 0 ? undefined : j); };

async function auditer(src) {
  const out = []; const dit = (ok, m, d) => out.push({ ok: !!ok, m, d });
  // ── A : la règle commune, exécutée ──
  let R = null;
  try { R = await chargerModule(src.regle); } catch (e) { dit(false, 'A0 la règle commune src/republierReglages.js se charge', e.message); }
  if (!R) dit(false, 'A0 la règle commune src/republierReglages.js existe (une source pour l’atelier et la main)', 'absente');
  else {
    const REG = (o) => R.lireReglagesRepub(o);
    const cas = [
      ['−10 %', { prix: { base: 'pct', delta: '-10' } }, { titre: 'Salomon XT-6 blanc 40', prix: 49, floor: null }],
      ['−10 % sous le prix d’achat', { prix: { base: 'pct', delta: '-10' } }, { titre: 'Nike Dunk', prix: 49, floor: 47 }],
      ['−5 € arrondi', { prix: { base: 'fixe', delta: '-5', arrondi: 'euro' } }, { titre: 'Asics', prix: 44.6, floor: null }],
      ['même prix', { prix: { base: 'commun', commun: '35' } }, { titre: 'Puma', prix: 60, floor: 20 }],
      ['titre + suffixe', { titre: { mode: 'suffixe', valeur: ' neuves' } }, { titre: 'Adidas Spezial', prix: 40, floor: null }],
      ['titre remplacé', { titre: { mode: 'remplacer', chercher: 'blanc', valeur: 'white' } }, { titre: 'Salomon blanc', prix: 40, floor: null }],
    ];
    let ok1 = true; const det = [];
    for (const [nom, o, a] of cas) {
      const reg = REG(o); const at = R.apercuRepub(a, reg);
      const envoie = { titre: at.titre != null ? at.titre : a.titre, prix: at.prix != null ? at.prix : a.prix };
      const m = R.annonceRepubliee({ ...a, description: 'Portées deux fois.', numero: '' }, reg, { etiquette: { place: 'aucune' } });
      if (m.titre !== envoie.titre || m.prix !== envoie.prix) { ok1 = false; det.push(`${nom}: atelier ${envoie.titre}/${envoie.prix} ≠ main ${m.titre}/${m.prix}`); }
    }
    dit(ok1, 'A1 un réglage posé dans l’atelier ⇒ à la main, le même titre et le même prix (%, €, arrondi, prix commun, titre)', det.join(' ; '));
    { const m = R.annonceRepubliee({ titre: 'Salomon XT-6', description: 'x', prix: 49, floor: null, numero: '42' }, REG({ prix: { base: 'pct', delta: '-10' } }), { etiquette: { place: 'aucune' } });
      dit(m.prix === 44.1 && m.prixAvant === 49, 'A1b −10 % sur 49 € ⇒ 44,10 € à copier', `${m.prixAvant} → ${m.prix}`); }
    { const m = R.annonceRepubliee({ titre: 'Nike Dunk', description: 'x', prix: 49, floor: 47, numero: '42' }, REG({ prix: { base: 'pct', delta: '-10' } }), { etiquette: { place: 'aucune' } });
      dit(m.prix === 47 && m.plancher, 'A1c jamais sous le prix d’achat (47 €) : ramené et dit', `${m.prix} plancher=${m.plancher}`); }
    // A2 — le N° selon `vrm_num_vinted`, la lettre reste la dernière ligne.
    { const reg = REG({ lettre: true });
      const bas = R.annonceRepubliee({ titre: 'Salomon XT-6', description: 'Portées deux fois.', prix: 49, numero: '42' }, reg, { lettre: 'k', etiquette: { place: 'desc_fin', forme: 'numero' } });
      dit(/Portées deux fois\.\n\nN°42\n\nk$/.test(bas.description) && bas.etiquette.pose, 'A2 N° en bas de la description, la lettre reste la dernière ligne', JSON.stringify(bas.description));
      const haut = R.annonceRepubliee({ titre: 'Salomon XT-6', description: 'Portées deux fois.', prix: 49, numero: 'B125' }, REG({}), { etiquette: { place: 'desc_debut', forme: 'ref' } });
      dit(haut.description === 'Réf B125\n\nPortées deux fois.', 'A2b N° en haut, sous la forme choisie (« Réf B125 »)', JSON.stringify(haut.description));
      const titre = R.annonceRepubliee({ titre: 'Salomon XT-6', description: 'x', prix: 49, numero: '42' }, REG({ titre: { mode: 'suffixe', valeur: ' neuves' } }), { etiquette: { place: 'titre_fin', forme: 'parentheses' } });
      dit(titre.titre === 'Salomon XT-6 neuves (42)', 'A2c fin du titre : le réglage de titre PUIS le N°', titre.titre);
      const long = R.annonceRepubliee({ titre: 'x'.repeat(98), description: 'x', prix: 49, numero: '42' }, REG({}), { etiquette: { place: 'titre_fin', forme: 'numero' } });
      dit(long.titre.length === 98 && !long.etiquette.pose && /100/.test(long.etiquette.refus), 'A2d un titre qui dépasserait 100 : rien n’est coupé, le refus est dit', long.etiquette.refus);
      const rien = R.annonceRepubliee({ titre: 'Salomon', description: 'Portées.', prix: 49, numero: '42' }, REG({}), { etiquette: { place: 'aucune' } });
      dit(rien.description === 'Portées.' && rien.titre === 'Salomon', 'A2e « Nulle part » : le texte ne change pas'); }
    // A3 — la lettre : la fonction de l'extension, exécutée.
    { let ext = null; try { const m = /const sansLettre = (\(t\) => \{[^\n]*\});/.exec(src.ext); ext = m ? vm.runInNewContext(`(${m[1]})`) : null; } catch (_) { ext = null; }
      const entrees = ['Portées deux fois.\n\nk', 'Portées deux fois.', 'k', '  Bon état  \n\nZ', 'Taille 42\n\nAB', ''];
      const ko = ext ? entrees.filter((t) => R.descriptionAvecLettre(t, '') !== ext(t)) : entrees;
      dit(ext && !ko.length, 'A3 la description sans l’ancienne lettre : la règle de l’extension (exécutée) et celle de l’app rendent la même base', ko.map((t) => JSON.stringify(t)).join(' ; '));
      dit(R.descriptionAvecLettre('Portées.\n\nq', 'k') === 'Portées.\n\nk', 'A3b une nouvelle lettre remplace l’ancienne (jamais deux)'); }
    // A4 — la photo : les gestes de l'extension (exécutée) = ceux de la toile « à la main ».
    { let E = null; try { E = photoExtension(src.ext); } catch (e) { dit(false, 'A4 la photo réglée de l’extension s’exécute', e.message); }
      if (E) {
        const reglages = [{ rot: 4, bright: 1.2, contrast: 0.9, sat: 1.1, zoom: 1.3 }, { rot: -15, zoom: 1.8, bright: 1.45 }, { rot: 20, zoom: 3, bright: 1.6, contrast: 0.3, sat: 2.5 }, { sat: 0 }];
        const ko = [];
        for (const r of reglages) {
          const g = await E.gestes(r);
          const t = fausseToile(); R.dessinerPhotoReglee(t.ctx, { __img: true }, 800, 1000, r);
          const app = t.gestes.join(' | '), ext = (g || []).join(' | ');
          if (app !== ext) ko.push(`${JSON.stringify(r)} → app ${app} ≠ ext ${ext}`);
          const css = R.cssApercuPhoto(r); const sur = E.surs(r);
          if (css.filter !== `brightness(${sur.bright}) contrast(${sur.contrast}) saturate(${sur.sat})` || css.transform !== `rotate(${sur.rot}deg) scale(${sur.zoom})`) ko.push(`aperçu ${JSON.stringify(r)} : ${css.filter} ${css.transform}`);
        }
        dit(!ko.length, 'A4 photo traitée : la toile de « à la main », l’aperçu de l’atelier et l’extension font les mêmes gestes, aux mêmes bornes', ko.join(' ; '));
        const b = R.bornerPhoto({ zoom: 9, bright: 0, rot: -40 }); const s = E.surs({ zoom: 9, bright: 0, rot: -40 });
        dit(['rot', 'bright', 'contrast', 'sat', 'zoom'].every((k) => b[k] === s[k]), 'A4b les bornes des curseurs sont celles de l’extension', JSON.stringify(b) + ' / ' + JSON.stringify(s));
        const c = R.CURSEURS_PHOTO.find((x) => x.cle === 'zoom'); dit(c && c.max === s.zoom, 'A4c le curseur « Zoom » va jusqu’où l’extension va', c && c.max);
      } }
    // A5 — pas su ≠ 0.
    { const m = R.annonceRepubliee({ titre: 'Nike', description: '', prix: null, numero: '' }, REG({ prix: { base: 'pct', delta: '-10' } }), { etiquette: { place: 'aucune' } });
      dit(m.prix === null && m.prixAvant === null && m.description === '', 'A5 prix pas lu ⇒ null (jamais 0), description absente ⇒ vide (dite par l’écran)', JSON.stringify({ p: m.prix, d: m.description })); }
    // A6 — l'objet synchronisé.
    { const pose = REG({ photo: { zoom: 1.2 }, prix: { base: 'pct', delta: '-15', arrondi: 'euro' }, titre: { mode: 'prefixe', valeur: 'Neuf ' }, lettre: true });
      const relu = R.lireReglagesRepub(JSON.parse(JSON.stringify(pose)));
      dit(JSON.stringify(relu) === JSON.stringify(pose), 'A6 ce que l’atelier enregistre, la main le relit à l’identique');
      const bizarre = R.lireReglagesRepub({ prix: { base: 'tout-gratuit', delta: '-90' }, titre: { mode: 'effacer' }, photo: { zoom: 'x' }, lettre: 'oui' });
      dit(!R.prixChange(bizarre) && !R.titreChange(bizarre) && bizarre.photo.zoom === 1 && bizarre.lettre === false, 'A6b une valeur inconnue retombe au neutre (un prix ne change jamais sur un doute)');
      const ancien = R.lireReglagesRepub(null, { zoom: 1.25, rot: 3 });
      dit(ancien.photo.zoom === 1.25 && ancien.photo.rot === 3 && !R.prixChange(ancien), 'A6c l’ancien réglage photo de « à la main » est repris une fois, rien d’autre');
      dit(R.CLE_REGLAGES_REPUB === 'vrm_republier_reglages', 'A6d une seule clé', R.CLE_REGLAGES_REPUB);
      // A7 — ce qui est GARDÉ, ce qui repart de zéro.
      const ecrit = R.reglagesGardes(pose);
      dit(!('prix' in ecrit) && !('titre' in ecrit) && ecrit.photo.zoom === 1.2 && ecrit.lettre === true, 'A7 la clé commune ne reçoit que la photo et la lettre, jamais un prix ni un titre', JSON.stringify(ecrit));
      const ouvre = R.reglagesAOuverture(JSON.parse(JSON.stringify({ ...ecrit, prix: pose.prix, titre: pose.titre })));
      dit(!R.prixChange(ouvre) && !R.titreChange(ouvre) && ouvre.photo.zoom === 1.2 && ouvre.lettre === true, 'A7b à l’ouverture : prix « Garder », titre « Ne pas changer » (même si une baisse traînait dans la clé) ; photo et lettre gardées', JSON.stringify(ouvre.prix));
      const serie = R.reglagesAOuverture(ecrit, null, { prix: pose.prix, titre: pose.titre });
      dit(serie.prix.base === 'pct' && serie.prix.delta === '-15' && serie.titre.mode === 'prefixe', 'A7c dans la même série « à la main », la paire suivante garde la baisse et le titre choisis');
      const r1 = R.annonceRepubliee({ titre: 'Nike', description: 'x', prix: 49, numero: '' }, ouvre, { etiquette: { place: 'aucune' } });
      dit(r1.prix === 49, 'A7d une nouvelle ouverture copie le prix tel quel (49 €)', r1.prix); }
  }
  // ── B : le branchement de l'app ──
  const app = sansCommentaires(src.app);
  const main = tranche(app, 'function RepublierALaMain', '\nfunction PrixMiniFeuille');
  const atelier = tranche(app, 'function RepublierVinted(', '\nfunction PhotoEditor(');
  dit(main && atelier, 'B0 les deux feuilles sont dans l’app', `${main.length} / ${atelier.length}`);
  dit(/const \[regs, poserRegs\] = useReglagesRepub\(encours\);/.test(main) && /const \[regsP, poserRegsP\] = useReglagesRepub\(\);/.test(atelier), 'B1 la main et l’atelier lisent LA même source (`useReglagesRepub`)');
  { const crochet = tranche(app, 'function useReglagesRepub(', '\nfunction ');
    dit(/save\(CLE_REGLAGES_REPUB, reglagesGardes\(n\)\)/.test(crochet) && !/save\(CLE_REGLAGES_REPUB, n\)/.test(crochet), 'B1b le crochet n’écrit dans la clé commune que ce qui est gardé (photo, lettre)');
    dit(/reglagesAOuverture\(load\(CLE_REGLAGES_REPUB/.test(app) && /const n = \{ \.\.\.courant\.current, photo: g\.photo, lettre: g\.lettre \};/.test(crochet), 'B1c à l’ouverture et à la relecture du nuage, le prix et le titre ne viennent jamais de la clé'); }
  dit(/onSuivante\(\{ prix: regs\.prix, titre: regs\.titre \}\)/.test(main) && /encours=\{fileM \? fileM\.encours \|\| null : null\}/.test(app), 'B1d la paire suivante d’une série garde le prix et le titre de CETTE ouverture');
  dit(/const apercu = \(a\) => apercuRepub\(a, regs\);/.test(atelier) && /cssApercuPhoto\(reg\)/.test(atelier) && /CURSEURS_PHOTO\.map/.test(atelier) && /REDUCTIONS_RAPIDES/.test(atelier) && /MODES_TITRE\.map/.test(atelier), 'B2 l’atelier calcule et règle par la règle commune (aperçu, photo, curseurs, réductions, titres)');
  dit(/const ann = annonceRepubliee\(/.test(main) && /dessinerPhotoReglee\(ctx, img, w, h, r\)/.test(main) && /cssApercuPhoto\(regs\.photo\)/.test(main) && /CURSEURS_PHOTO\.map/.test(main) && /REDUCTIONS_RAPIDES/.test(main) && /MODES_TITRE\.map/.test(main), 'B2b la main copie et dessine par la même règle (texte, toile, aperçu, curseurs, réductions, titres)');
  const copies = [];
  if (/function lotAppliquePrix\b|function lotAppliqueTitre\b|const TITRE_VINTED_MAX\s*=|function apercuRepub\b|function filtreReglages\b/.test(app)) copies.push('App.jsx redéfinit une règle de prix/titre/photo');
  for (const [nom, t] of [['à la main', main], ['atelier', atelier]]) {
    if (/brightness\(|ctx\.filter\s*=|\.rotate\(|\* \(1 \+|lotAppliquePrix\(|lotAppliqueTitre\(/.test(t)) copies.push(`${nom} : filtre, rotation ou calcul de prix/titre écrit sur place`);
  }
  const actions = sansCommentaires(src.actions);
  if (/brightness\(|function filtreReglages|function appliquerCouleursPixels/.test(actions)) copies.push('annoncesActions.js garde sa copie des photos réglées');
  dit(!copies.length, 'B3 aucune copie qui pourrait diverger (une règle par notion, src/republierReglages.js)', copies.join(' ; '));
  dit(/'vrm_republier_reglages',/.test(tranche(app, 'const SYNC_KEYS', '];')), 'B4 les réglages sont synchronisés (SYNC_KEYS) : régler sur un appareil règle l’autre');
  dit(/data-main-memes-reglages/.test(main) && /Mêmes réglages que Republier/.test(main) && /data-republier-memes-reglages/.test(atelier) && /Mêmes réglages que « Republier à la main »/.test(atelier), 'B5 l’interface le dit, des deux côtés');
  dit(/const partage = action === 'recreer' \|\| action === 'versBrouillon';/.test(atelier) && /const regs = partage \? regsP : regsL;/.test(atelier), 'B6 « Modifier prix ou titre » garde des réglages à lui (neutres à chaque ouverture)');
  dit(!/vmrCmd|executerCommande|method:\s*'(POST|PUT|DELETE)'/.test(main), 'B7 rien ne part chez Vinted depuis « à la main » (c’est lui qui publie)');
  dit(!/data-(main|republier)-(varier|regler)\b/.test(main + atelier) && !/regs\.photo\[\s*paire/.test(main), 'B8 un réglage photo pour toutes : ni « Varier », ni réglage par annonce (retirés, §3)');
  dit(/navigator\.share\(\{ files/.test(main) && /navigator\.canShare\(\{ files \}\)/.test(app), 'B9 iPhone : les photos partent au menu de partage (fichiers), sinon téléchargées');
  return out;
}

(async () => {
  const lire = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return null; } };
  const base = { regle: lire(F.regle), app: lire(F.app) || '', actions: lire(F.actions) || '', ext: lire(F.ext) || '' };
  if (process.argv.includes('--prouve')) {
    let rouges = 0, n = 0;
    for (const [nomM, { f, m }] of Object.entries(MUTATIONS)) {
      n++;
      const s = { ...base, [f]: m(base[f] || '') };
      if (s[f] === base[f]) { console.log(`⚠️  mutation ${nomM} : l’ancre ne correspond plus`); continue; }
      let r; try { r = await auditer(s); } catch (e) { r = [{ ok: false, m: 'plante : ' + e.message }]; }
      const ko = r.filter((x) => !x.ok);
      if (ko.length) rouges++;
      console.log(`${ko.length ? '✅' : '❌'} mutation ${nomM} : ${ko.length} contrôle(s) rouge(s)${ko.length ? ' — ' + ko[0].m : ''}`);
    }
    console.log(`\n${rouges}/${n} mutations attrapées`);
    process.exit(rouges === n ? 0 : 1);
  }
  let r; try { r = await auditer(base); } catch (e) { console.log('❌ l’audit plante : ' + e.message); process.exit(1); }
  for (const x of r) console.log(`${x.ok ? '✅' : '❌'} ${x.m}${x.d !== undefined && x.d !== '' ? ' — ' + x.d : ''}`);
  const ko = r.filter((x) => !x.ok).length;
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s) sur ${r.length}` : `\n✅ republier à la main = réglages de l’atelier : ${r.length} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
