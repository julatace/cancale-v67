// Audit : ANNONCES — SÉLECTIONNER, PUIS « ACTIONS POSSIBLES » (5 nov., Julien).
//
//   A. l'état d'une annonce (src/annoncesActions.js) : en ligne · brouillon ·
//      masquée · en vérification par Vinted (`is_processing`, `item_alert_type`) —
//      un champ absent ne dit JAMAIS « en vérification » (pas su ≠ oui), et une
//      annonce en vérification ne se coche pas ;
//   B. `actionsPossibles` : une action qui ne peut pas partir reste dans la liste,
//      grisée, avec SA raison — sélection vide, deux comptes mélangés (« un compte
//      à la fois »), état qui ne va pas (brouillon ≠ en ligne), une seule annonce
//      pour « à la main », compte de Chrome pas su / aucun / autre, extension trop
//      ancienne ; « à la main » ne dépend ni de Chrome ni de l'extension ;
//   C. republier à la main : le lien nouvelle → ancienne vient de SON clic
//      (`liensRepubMain`), les annonces qu'il peut désigner sont du MÊME compte,
//      jamais l'ancienne, jamais une annonce numérotée à la main, jamais une
//      mise en ligne bien avant qu'il commence ; la règle des republications
//      (`repriseNumerosRecreation`) remet le N° une fois l'ancienne hors ligne ;
//   D. vérifier avant (src/verifAnnonce.js, site « vinted ») : sans titre, sans
//      prix, description < 5, couleur, état — jugés seulement s'ils ont été LUS ;
//      les autres sites ne changent pas ; ce qui n'est pas lu est nommé à part ;
//   E. les photos réglées : bornes des réglages, pixels neutres intacts ;
//   F. l'app (src/App.jsx) : la règle est branchée (sélection, carré, Republier qui
//      démarre après « Choisir », table des liens AJOUTÉE à celle de l'extension,
//      `vrm_repub_main` synchronisé).
// `--prouve` : chaque règle réaffaiblie doit passer au rouge.
const fs = require('fs'), path = require('path'), os = require('os');
const RAC = path.join(__dirname, '..');
const SRC = path.join(RAC, 'src', 'annoncesActions.js');
const VERIF = path.join(RAC, 'src', 'verifAnnonce.js');
const REPRISE = path.join(RAC, 'src', 'repriseNumero.js');
const APP = path.join(RAC, 'src', 'App.jsx');

const MUTATIONS = {
  deux_comptes: { f: 'src', m: (s) => s.replace("else if (comptes.length > 1) raison", "else if (comptes.length > 99) raison") },
  etat_ignore: { f: 'src', m: (s) => s.replace('if (hors.length) raison', 'if (false) raison') },
  verif_jamais: { f: 'src', m: (s) => s.replace("if (enVerificationVinted(it)) return 'verification';", '') },
  verif_devinee: { f: 'src', m: (s) => s.replace("return typeof a === 'string' && a.trim() !== '';", "return a === undefined || (typeof a === 'string' && a.trim() !== '');") },
  chrome_ignore: { f: 'src', m: (s) => s.replace("else if (String(chrome) !== comptes[0]) raison", "else if (false) raison") },
  // (6 nov.) L'ancre suivait un « else if » qui n'existe plus (la mutation n'agissait sur rien, base comprise).
  chrome_passu_oui: { f: 'src', m: (s) => s.replace("if (chrome === undefined) raison", "if (false) raison") },
  candidats_tous_comptes: { f: 'src', m: (s) => s.replace(".filter((it) => it && String(it.uid || '') === u && String(it.id) !== anc", ".filter((it) => it && String(it.id) !== anc") },
  candidats_main: { f: 'src', m: (s) => s.replace("return !(e && String(e.numero || '').trim() && (!e.auto || e.manuelAt));", 'return true;') },
  seule_ignore: { f: 'src', m: (s) => s.replace("else if (A.seule && sel.length > 1) raison", "else if (false) raison") },
  desc_non_jugee: { f: 'verif', m: (s) => s.replace("if (d == null || d < DESCRIPTION_MIN) pose('description'", "if (false) pose('description'") },
  non_lu_juge: { f: 'verif', m: (s) => s.replace("if (x.couleur !== undefined && x.couleur !== null && vide(x.couleur)) pose('couleur', 'Couleur absente');", "if (vide(x.couleur)) pose('couleur', 'Couleur absente');") },
  // (revue du 5 nov.) G : chaque défaut corrigé, réaffaibli, doit repasser au rouge.
  prix_null_juge: { f: 'verif', m: (s) => s.replace("if (x.prix !== undefined && x.prix !== null && !(num(x.prix) > 0))", "if (x.prix !== undefined && !(num(x.prix) > 0))") },
  dressing_null_absent: { f: 'src', m: (s) => s.replace("const v = (k) => (x[k] != null && String(x[k]).trim() !== '' ? String(x[k]) : '');", "const v = (k) => (x[k] !== undefined ? String(x[k] == null ? '' : x[k]) : undefined);").replace('catalogId: v(\'catalog_id\') || undefined,', "catalogId: v('catalog_id'),").replace('couleur: couleur || undefined,', 'couleur,') },
  masquee_passe: { f: 'src', m: (s) => s.replace('if (pres.has(a) || Object.prototype.hasOwnProperty.call(prouve, n)) continue;', 'if (Object.prototype.hasOwnProperty.call(prouve, n)) continue;') },
  main_ecrase_preuve: { f: 'src', m: (s) => s.replace('return { ...m, ...(recrees || {}) };', 'return { ...(recrees || {}), ...m };') },
  candidat_deja_recree: { f: 'src', m: (s) => s.replace("return !(e && e.recreeDe && String(e.recreeDe) !== anc) && !(r && String(r) !== anc);", 'return true;') },
  suivi_sans_num: { f: 'src', m: (s) => s.replace("if (s && !String(s.num || '').trim()) return 'fait';", '') },
  app_presentes_ignorees: { f: 'app', m: (s) => s.replace('liensRepubMain(repubMain, { presentes: pres, dejaRecrees: recreesNum || {} })', 'liensRepubMain(repubMain)') },
  app_liens_ignores: { f: 'app', m: (s) => s.replace('recrees: recreesEff,', 'recrees: recreesNum,') },
  app_sans_depart: { f: 'app', m: (s) => s.split(" depart={repubDepart?'modif':null}").join('') },
  // (6 nov., finitions) La phrase à deux comptes retombe dans l'à-peu-près : « Prix mini » tu, ou dit possible sans l'être.
  mini_possible_tu: { f: 'src', m: (s) => s.replace("if (possibles.length) for (const x of res)", "if (false) for (const x of res)") },
  mini_toujours_dit: { f: 'src', m: (s) => s.replace("res.filter((x) => x.ok && (ACTIONS_SELECTION", "res.filter((x) => (ACTIONS_SELECTION") },
  phrase_d_avant: { f: 'src', m: (s) => s.replace("). ${PAR_COMPTE} : un compte à la fois.`", ") : une action se lance sur un seul compte à la fois.`") },
};

async function charger(src) {
  const f = path.join(os.tmpdir(), `annoncesActions-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  // Le module importe ses voisins en relatif : copié ailleurs, on les pointe vers src/.
  fs.writeFileSync(f, src.replace(/from '\.\/([^']+)'/g, (_, m) => `from '${require('url').pathToFileURL(path.join(__dirname, '..', 'src', m)).href}'`));
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

async function auditer(sources) {
  const out = [];
  const dit = (ok, m, d) => out.push({ ok: !!ok, m, d });
  const R = await charger(sources.src);
  const V = await charger(sources.verif);
  const P = await charger(sources.reprise);
  // ── A ──
  const e = R.etatAnnonceVinted;
  dit(e({ id: 1 }) === 'en-ligne', 'A1 une annonce ouverte est « en ligne »');
  dit(e({ id: 1, is_draft: true }) === 'brouillon' && e({ id: 1, _vrmBrouillon: true }) === 'brouillon', 'A2 un brouillon est « brouillon »');
  dit(e({ id: 1, is_hidden: true }) === 'masquee' && e({ id: 1, _vrmMasquee: true }) === 'masquee', 'A3 une masquée est « masquée »');
  dit(e({ id: 1, is_processing: true }) === 'verification' && e({ id: 1, is_hidden: true, item_alert_type: 'under_review' }) === 'verification', 'A4 Vinted la vérifie ⇒ « en vérification », même masquée');
  dit(e({ id: 1, is_hidden: true }) !== 'verification' && e({ id: 1, item_alert_type: null, is_processing: false }) === 'en-ligne', 'A5 champs absents ou vides ⇒ jamais « en vérification » deviné');
  dit(!!R.raisonPasSelectionnable('verification') && !R.raisonPasSelectionnable('masquee') && !R.raisonPasSelectionnable('brouillon'), 'A6 seule une annonce en vérification ne se coche pas (brouillons et masquées se cochent)');
  // ── B ──
  const caps = () => true;
  const parK = (l) => Object.fromEntries(l.map((x) => [x.k, x]));
  const nom = (u) => ({ 111: 'compte_a', 222: 'compte_b' })[u] || '';
  const L = (selection, chrome = '111', capOk = caps) => parK(R.actionsPossibles({ selection, chrome, capOk, nomCompte: nom }));
  { const a = L([]); dit(Object.values(a).every((x) => !x.ok && x.raison), 'B1 rien de coché ⇒ toutes grisées, avec une raison'); }
  { const a = L([{ id: '1', uid: '111', etat: 'en-ligne' }, { id: '2', uid: '222', etat: 'en-ligne' }]);
    // (6 nov., vague 2) « Prix mini… » (`multiComptes`) n'agit pas au nom d'un compte : une écriture
    // dans ses fiches. Toutes les AUTRES actions restent bloquées par le mélange des comptes.
    const parCompte = Object.values(a).filter((x) => x.k !== 'mini');
    dit(parCompte.length >= 5 && parCompte.every((x) => !x.ok && /2 comptes/.test(x.raison) && /compte_a/.test(x.raison) && /compte_b/.test(x.raison)), 'B2 deux comptes mélangés ⇒ aucune action qui agit au nom d’un compte, les comptes nommés', a.recreer.raison);
    dit(a.mini && a.mini.ok && a.mini.robot === false, 'B16 « Prix mini… » sur deux comptes ⇒ possible (rien ne part chez Vinted, aucun robot)', a.mini && a.mini.raison);
    // (6 nov., finitions) La phrase commune dit JUSTE : ce qui se lance au nom d'un compte, et que « Prix mini » reste possible.
    const tete = R.raisonCommune(Object.values(a)).tete;
    dit(/Republier, modifier, brouillon, mise en ligne : un compte à la fois/.test(tete) && /Prix mini : possible/.test(tete) && !/une action se lance sur un seul compte/.test(tete), 'B19 deux comptes : « Republier, modifier, brouillon, mise en ligne : un compte à la fois · Prix mini : possible »', tete); }
  { const a = L([{ id: '1', uid: '111', etat: 'brouillon' }, { id: '2', uid: '222', etat: 'en-ligne' }]);
    const tete = R.raisonCommune(Object.values(a)).tete;
    dit(a.mini && !a.mini.ok && /un compte à la fois/.test(tete) && !/Prix mini : possible/.test(tete), 'B20 deux comptes et un brouillon coché : « Prix mini » n’est PAS dit possible (il ne l’est pas)', tete); }
  { const a = L([{ id: '5', uid: '111', etat: 'brouillon' }]);
    dit(a.mini && !a.mini.ok && /en ligne/.test(a.mini.raison), 'B17 « Prix mini… » sur un brouillon ⇒ grisé (une offre n’arrive que sur une annonce en ligne), raison dite', a.mini && a.mini.raison);
    const sel = R.ACTIONS_SELECTION.filter((A) => A.multiComptes);
    dit(sel.length === 1 && sel[0].k === 'mini' && sel[0].robot === false && sel[0].lien === true && !R.ACTIONS_TUILES.includes('mini'), 'B18 seul « Prix mini… » ignore le compte : non robot, un lien sous les tuiles', JSON.stringify(sel.map((A) => A.k))); }
  { const a = L([{ id: '1', uid: '111', etat: 'en-ligne' }, { id: '3', uid: '111', etat: 'en-ligne' }]);
    dit(a.recreer.ok && a.modifier.ok && a.versBrouillon.ok, 'B3 en ligne, compte de Chrome ⇒ republier, modifier, en ligne → brouillon possibles');
    dit(!a.enLigne.ok && /en ligne/.test(a.enLigne.raison), 'B4 « brouillon → en ligne » grisé sur des annonces en ligne, raison dite', a.enLigne.raison);
    dit(!a.main.ok && /une/i.test(a.main.raison), 'B5 « à la main » : une annonce à la fois', a.main.raison);
    dit(a.recreer.ids.join(',') === '1,3', 'B6 les identifiants partent dans l’ordre de ses clics'); }
  { const a = L([{ id: '5', uid: '111', etat: 'brouillon' }]);
    dit(a.enLigne.ok && !a.recreer.ok && !a.versBrouillon.ok && !a.modifier.ok, 'B7 un brouillon ⇒ seulement « brouillon → en ligne » (et « à la main »)');
    dit(a.main.ok, 'B8 « à la main » marche sur un brouillon'); }
  { const a = L([{ id: '1', uid: '111', etat: 'en-ligne' }, { id: '5', uid: '111', etat: 'brouillon' }]);
    dit(!a.recreer.ok && /1 brouillon/.test(a.recreer.raison) && !a.enLigne.ok && /1 annonce en ligne/.test(a.enLigne.raison), 'B9 sélection mélangée ⇒ chaque action dit ce qui ne va pas', `${a.recreer.raison} / ${a.enLigne.raison}`); }
  { const a = L([{ id: '7', uid: '111', etat: 'masquee' }]);
    dit(!a.recreer.ok && !a.enLigne.ok && a.main.ok, 'B10 une masquée ⇒ « à la main » seulement (les moteurs ne prennent que leurs annonces)'); }
  { const a = L([{ id: '1', uid: '222', etat: 'en-ligne' }], '111');
    dit(!a.recreer.ok && /compte_a/.test(a.recreer.raison) && /compte_b/.test(a.recreer.raison) && a.main.ok, 'B11 Chrome sur un AUTRE compte ⇒ moteurs grisés (les deux comptes nommés), « à la main » reste', a.recreer.raison); }
  { const a = parK(R.actionsPossibles({ selection: [{ id: '1', uid: '111', etat: 'en-ligne' }], chrome: undefined, capOk: caps, nomCompte: nom }));
    dit(!a.recreer.ok && /ne sait pas/.test(a.recreer.raison), 'B12 compte de Chrome pas su ⇒ rien ne part (pas su ≠ oui)', a.recreer.raison);
    const b = L([{ id: '1', uid: '111', etat: 'en-ligne' }], null);
    dit(!b.recreer.ok && /Aucun compte/.test(b.recreer.raison), 'B13 aucun compte ouvert dans Chrome ⇒ le geste est dit', b.recreer.raison); }
  { const a = L([{ id: '1', uid: '111', etat: 'en-ligne' }], '111', (c) => c !== 'recreer');
    dit(!a.recreer.ok && /extension/.test(a.recreer.raison) && a.modifier.ok, 'B14 extension trop ancienne pour une action ⇒ elle seule est grisée'); }
  { const a = L([{ id: '1', uid: '', etat: 'en-ligne' }]); dit(Object.values(a).filter((x) => x.k !== 'mini').every((x) => !x.ok), 'B15 compte inconnu ⇒ rien qui agisse au nom d’un compte'); }
  // ── C ──
  dit(JSON.stringify(R.liensRepubMain({ 10000001: { nouvelId: '10000009' }, 10000002: {}, abc: { nouvelId: '1' }, 10000003: { nouvelId: '10000003' } })) === JSON.stringify({ 10000009: '10000001' }), 'C1 seuls les liens qu’il a posés comptent (identifiants valides, jamais elle-même)');
  {
    const t0 = Date.parse('2026-11-05T10:00:00Z');
    const enLigne = [
      { id: '20000001', uid: '111', titre: 'Nike Dunk', createdTs: (t0 + 5 * 60000) / 1000 },        // la nouvelle
      { id: '20000002', uid: '111', titre: 'Nike Dunk', createdTs: (t0 - 30 * 86400e3) / 1000 },     // même titre, bien AVANT
      { id: '20000003', uid: '222', titre: 'Nike Dunk', createdTs: (t0 + 6 * 60000) / 1000 },         // autre compte
      { id: '20000004', uid: '111', titre: 'Adidas', createdTs: null },                               // date inconnue
      { id: '20000005', uid: '111', titre: 'Asics', createdTs: (t0 + 60000) / 1000 },                  // numérotée à la main
      { id: '10000001', uid: '111', titre: 'Nike Dunk', createdTs: (t0 - 40 * 86400e3) / 1000 },      // l'ancienne
    ];
    const numeros = { 20000005: { numero: '77', manuelAt: '2026-11-05' }, 20000001: { numero: '901', auto: true } };
    const c = R.candidatsNouvelle({ ancienId: '10000001', uid: '111', enLigne, numeros, suivis: {}, debut: t0 }).map((x) => x.id);
    dit(c.includes('20000001') && c.includes('20000004'), 'C2 proposées : la nouvelle (même compte, après), et une sans date (rien n’est deviné)', c.join(','));
    dit(!c.includes('20000003') && !c.includes('10000001') && !c.includes('20000005') && !c.includes('20000002'), 'C3 jamais : un autre compte, l’ancienne, une numérotée à la main, une mise en ligne bien avant', c.join(','));
    dit(c[0] === '20000001', 'C4 la plus récente en tête (rien n’est choisi à sa place)');
    const c2 = R.candidatsNouvelle({ ancienId: '10000001', uid: '111', enLigne, numeros, suivis: { 10000008: { nouvelId: '20000001' } }, debut: t0 }).map((x) => x.id);
    dit(!c2.includes('20000001'), 'C5 une annonce déjà désignée pour une autre n’est plus proposée');
    // La reprise : la MÊME règle que les republications.
    const nums = { 10000001: { numero: '42' }, 20000001: { numero: '901', auto: true } };
    const liens = R.liensRepubMain({ 10000001: { nouvelId: '20000001' } });
    const k = (n) => String(n || '').trim().toUpperCase();
    const avant = P.repriseNumerosRecreation({ enLigneIds: ['10000001', '20000001'], numeros: nums, recrees: liens, cle: k });
    dit(!avant['20000001'], 'C6 l’ancienne encore en ligne ⇒ le N° attend (jamais deux annonces sous un N°)');
    const apres = P.repriseNumerosRecreation({ enLigneIds: ['20000001'], numeros: nums, recrees: liens, cle: k });
    dit(apres['20000001'] && apres['20000001'].numero === '42' && apres['20000001'].recreeDe === '10000001' && apres['20000001'].numeroRendu, 'C7 l’ancienne hors ligne ⇒ la nouvelle reprend le N°42 (son N° auto reste brûlé)');
    const mainN = P.repriseNumerosRecreation({ enLigneIds: ['20000001'], numeros: { ...nums, 20000001: { numero: '55', manuelAt: 'x' } }, recrees: liens, cle: k });
    dit(!mainN['20000001'], 'C8 un N° posé à la main sur la nouvelle est gardé');
    dit(R.etatSuiviMain({ nouvelId: '20000001', num: '42' }, { numeros: { 20000001: { numero: '42' } } }) === 'fait' && R.etatSuiviMain({ num: '42' }, {}) === 'attente' && R.etatSuiviMain({ nouvelId: '2', num: '42' }, { numeros: {} }) === 'lie', 'C9 l’état du suivi : attente · lié · fait');
  }
  // ── D ──
  const pv = (a) => V.problemesAnnonce(a, 'vinted').map((x) => x.code).sort().join(',');
  dit(pv({ titre: 'Nike', prix: 40, nPhotos: 5, descLen: 2, couleur: '', etat: '' }) === 'couleur,description,etat', 'D1 Vinted : description < 5, couleur, état absents ⇒ dits', pv({ titre: 'Nike', prix: 40, nPhotos: 5, descLen: 2, couleur: '', etat: '' }));
  dit(pv({ titre: '', prix: 0 }) === 'prixVide,titreVide', 'D2 Vinted : sans titre, sans prix ⇒ dits', pv({ titre: '', prix: 0 }));
  dit(pv({ titre: 'Nike', prix: 40, nPhotos: 5 }) === '', 'D3 ce qui n’a pas été lu n’est pas jugé (aucun faux manque)');
  dit(V.problemesAnnonce({ titre: '', prix: 0, descLen: 0, couleur: '' }, 'lbc').length === 0, 'D4 les autres sites ne changent pas');
  { const p = V.problemesAnnonce({ descLen: 0 }, 'vinted')[0]; dit(p && p.geste && /Vinted/.test(p.geste), 'D5 chaque manque a son geste'); }
  { const n = V.champsNonJuges({ titre: 'x', prix: 3 }, 'vinted'); dit(n.includes('la couleur') && n.includes('la catégorie') && !n.includes('le titre'), 'D6 ce que VRM n’a pas lu est nommé à part', n.join(', ')); }
  dit(V.champsNonJuges({ famille: 'sacs' }, 'vinted').every((x) => x !== 'la taille') && V.champsNonJuges({}, 'lbc').length === 0, 'D7 un sac n’a pas de taille à lire ; hors Vinted, rien');
  // ── E ──
  { const f = R.filtreReglages({ rot: 90, zoom: 4, bright: 9 }); dit(f.rot === 15 && f.zoom === 1.5 && /brightness\(1\.6\)/.test(f.filtre), 'E1 réglages bornés (±15°, zoom 1,5, lumière 160 %)'); }
  { const d = new Uint8ClampedArray([10, 20, 30, 255]); R.appliquerCouleursPixels(d, {}); dit(d.join() === '10,20,30,255', 'E2 réglages neutres ⇒ pixels intacts');
    const d2 = new Uint8ClampedArray([100, 100, 100, 255]); R.appliquerCouleursPixels(d2, { bright: 1.2 }); dit(d2[0] === 120 && d2[3] === 255, 'E3 lumière +20 % ⇒ +20 % (l’opacité intacte)', d2.join()); }
  dit(R.nomPhotoReglee('B42', 0) === 'VRM-B42-01.jpg' && R.nomPhotoReglee('', 9) === 'VRM-annonce-10.jpg', 'E4 photos nommées VRM-{N°}-{rang}.jpg');
  // ── F ── l'app
  const app = sources.app;
  dit(/actionsPossibles\(\{ selection:/.test(app) && /<ChoixAnnoncesVinted /.test(app) && /<ActionsSelectionFeuille /.test(app), 'F1 la sélection et le carré « Actions possibles » sont rendus');
  dit(/repriseNumerosRecreation\(\{[\s\S]{0,600}?recrees: recreesEff,/.test(app) && /fusionLiensRecrees\(recreesNum, liensRepubMain\(repubMain, \{ presentes: pres, dejaRecrees: recreesNum \|\| \{\} \}\)\)/.test(app), 'F2 la table de SES liens s’ajoute à celle de l’extension (même règle de reprise), anciennes encore présentes écartées');
  dit(/depart=\{repubDepart\?'modif':null\}/.test(app) && /depart=\{repubDepart\?'envoi':null\}/.test(app), 'F3 Republier ouvert depuis la sélection commence après « Choisir »');
  dit(/'vrm_repub_main',/.test(app.slice(app.indexOf('const SYNC_KEYS'), app.indexOf('const SYNC_KEYS') + 30000)), 'F4 `vrm_repub_main` est synchronisé');
  dit(/problemesAnnonce\(a\.verif \|\| \{\}, 'vinted'\)/.test(app) && /champsNonJuges\(a\.verif/.test(app), 'F5 le carré dit, paire par paire, ce qui manque (la règle de « vérifier avant »)');
  dit(!/titre[^;\n]{0,40}===[^;\n]{0,40}titre/.test(app.slice(app.indexOf('function RepublierALaMain'), app.indexOf('function RepublierVinted('))), 'F6 « à la main » ne relie jamais par le titre');
  // ── G ── revue adverse du 5 nov. : ce qui affichait faux ou cassait une règle
  dit(V.problemesLot([{ numero: '12', titre: 'Nike', prix: null }], 'vinted').every((x) => x.code !== 'prixVide'), 'G1 un prix illisible (`null`, Republier existant) n’est jamais « Sans prix »');
  dit(V.problemesAnnonce({ titre: null, couleur: null, etat: null, descLen: null }, 'vinted').length === 0, 'G2 `null` = pas lu : aucun manque inventé');
  { const d = R.lusDuDressing({ color1: null, color1_id: null, catalog_id: null, status: 'Très bon état' });
    dit(d.couleur === undefined && d.catalogId === undefined && d.statusLu === true, 'G3 dressing à `null` (mesuré) ⇒ couleur et catégorie « pas lues », jamais absentes', JSON.stringify(d));
    const v = { titre: 'Nike', prix: 40, ...(d.couleur !== undefined ? { couleur: d.couleur } : {}), ...(d.catalogId !== undefined ? { categorie: d.catalogId } : {}) };
    dit(V.problemesAnnonce(v, 'vinted').length === 0, 'G4 … donc ni « Couleur absente » ni « Catégorie absente » sur une annonce qui en a');
    const e = R.lusDuDressing({ color1: 'Noir', catalog_id: 1242 }); dit(e.couleur === 'Noir' && e.catalogId === '1242', 'G5 une valeur lue reste lue'); }
  { const nums = { 10000001: { numero: '42' }, 20000001: { numero: '901', auto: true } };
    const liens = R.liensRepubMain({ 10000001: { nouvelId: '20000001' } }, { presentes: new Set(['10000001']) });
    const rep = P.repriseNumerosRecreation({ enLigneIds: ['20000001'], numeros: nums, recrees: liens });
    dit(!rep['20000001'], 'G6 ancienne MASQUÉE (ou brouillon) encore chez lui ⇒ le N° attend (jamais deux paires présentes sous un N°)');
    const rep2 = P.repriseNumerosRecreation({ enLigneIds: ['20000001'], numeros: nums, recrees: R.liensRepubMain({ 10000001: { nouvelId: '20000001' } }, { presentes: new Set() }) });
    dit(rep2['20000001'] && rep2['20000001'].numero === '42', 'G7 ancienne partie de partout ⇒ le N° passe'); }
  { const f = R.fusionLiensRecrees({ 20000001: '10000005' }, { 20000001: '10000001', 20000002: '10000003' });
    dit(f['20000001'] === '10000005' && f['20000002'] === '10000003', 'G8 un lien posé à la main ne remplace jamais l’identité prouvée par l’extension');
    dit(R.fusionLiensRecrees(undefined, { 1: 2 }) === undefined, 'G9 table de l’extension pas lue ⇒ on attend');
    const c = R.candidatsNouvelle({ ancienId: '10000001', uid: '111', enLigne: [{ id: '20000001', uid: '111' }, { id: '20000002', uid: '111' }], numeros: { 20000002: { numero: '7', auto: true, recreeDe: '10000005' } }, suivis: {}, recrees: { 20000001: '10000009' } }).map((x) => x.id);
    dit(c.length === 0, 'G10 une annonce déjà remplaçante d’une AUTRE n’est pas proposée', c.join(',')); }
  dit(R.etatSuiviMain({ num: '' }, {}) === 'fait' && R.etatSuiviMain({ nouvelId: '20000001', num: '' }, { numeros: {} }) === 'fait', 'G11 rien à remettre (pas de N°) ⇒ le suivi ne reste pas ouvert à vie');
  return out;
}

(async () => {
  const lire = (f) => fs.readFileSync(f, 'utf8');
  const base = { src: lire(SRC), verif: lire(VERIF), reprise: lire(REPRISE), app: lire(APP) };
  if (process.argv.includes('--prouve')) {
    let rouges = 0, n = 0;
    for (const [nomM, { f, m }] of Object.entries(MUTATIONS)) {
      n++;
      const s = { ...base, [f]: m(base[f]) };
      if (s[f] === base[f]) { console.log(`⚠️  mutation ${nomM} : l'ancre ne correspond plus`); continue; }
      let r; try { r = await auditer(s); } catch (e) { r = [{ ok: false, m: 'plante : ' + e.message }]; }
      const ko = r.filter((x) => !x.ok);
      if (ko.length) rouges++;
      console.log(`${ko.length ? '✅' : '❌'} mutation ${nomM} : ${ko.length} contrôle(s) rouge(s)${ko.length ? ' — ' + ko[0].m : ''}`);
    }
    console.log(`\n${rouges}/${n} mutations attrapées`);
    process.exit(rouges === n ? 0 : 1);
  }
  let r; try { r = await auditer(base); } catch (e) { console.log('❌ l’audit plante : ' + e.message); process.exit(1); }
  for (const x of r) console.log(`${x.ok ? '✅' : '❌'} ${x.m}${x.d ? ' — ' + x.d : ''}`);
  const ko = r.filter((x) => !x.ok).length;
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s) sur ${r.length}` : `\n✅ annonces, sélection et actions : ${r.length} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
