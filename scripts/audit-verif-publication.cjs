// Audit : PRÉVENIR AVANT DE PUBLIER, SANS JAMAIS BLOQUER (11 nov., lot verif-publication).
//
//   A. la règle de l'app (src/verifAnnonce.js), EXÉCUTÉE :
//      · « N° absent de la description » seulement s'il numérote lui-même
//        (`numeroEcrit === true` : réglage allumé ou habitude PROUVÉE) ET que la
//        description qui part est SUE ; le bon N° à la fin, dans la référence
//        native (SKU « VRM-12 ») ou dans le titre coché suffit ; la description
//        décochée (`ou`) n'est pas jugée ; pas su ⇒ rien ;
//      · l'habitude : 5 descriptions lues, 4 sur 5 avec un N° ⇒ vrai, sinon `null`
//        (jamais `false` inventé) ;
//      · « déjà en ligne » seulement sur `dejaEnLigne === true` ;
//      · « Ne plus me le dire » : un code coupé disparaît, un code inconnu n'est
//        jamais coupé, rallumer le rend ;
//      · chaque texte d'alerte tient en 12 mots ; aucun prix conseillé ;
//   B. le fond de l'extension (VRAI background.js dans `_fond-vm.cjs`) :
//      `alertesDepotVinted` (le formulaire vinted.fr) dit les mêmes choses sur les
//      mêmes faits, son habitude rend la même chose que celle de l'app, et
//      `donneesVerifDepot` ne fait AUCUNE requête Vinted (la base VRM seulement) ;
//      base muette ⇒ `null` (aucune alerte) ;
//   C. l'app : `verifierAvantPublication` retire les alertes coupées, la feuille
//      garde « Publier quand même », chaque ligne a « Ne plus me le dire » ;
//      Leboncoin, eBay, Vestiaire, Republier et Annonces passent le N° écrit ;
//      Leboncoin et eBay lisent « déjà en ligne » sur une lecture < 24 h ;
//   D. la page vinted.fr : l'encart ne clique rien, n'intercepte aucun envoi et
//      ne parle qu'au fond (`verifDepot`).
// `--prouve` : chaque règle réaffaiblie doit passer au rouge.
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os'), url = require('url');
const RAC = path.join(__dirname, '..');
const SRC = path.join(RAC, 'src', 'verifAnnonce.js');
const NUM = url.pathToFileURL(path.join(RAC, 'src', 'numeroEcrit.js')).href;
const BG = path.join(RAC, 'vinted-sync-extension', 'background.js');
const CAP = path.join(RAC, 'vinted-sync-extension', 'vinted-capture.js');
const { faireFond } = require('./_fond-vm.cjs');

const MUTATIONS_APP = {
  numero_sans_reglage: (s) => s.replace("if (!x || x.numeroEcrit !== true) return '';", "if (!x) return '';"),
  numero_pas_su_juge: (s) => s.replace("if (!l) return '';   // description pas sue : rien", "if (!l) return 'Aucun N° à la fin de la description';"),
  ou_ignore: (s) => s.replace("if (ou && !ou.includes('description')) return '';", ''),
  ref_ignoree: (s) => s.replace("if (r.etat === 'lu' && r.cle === attendu) return ''; }", '}'),
  habitude_devinee: (s) => s.replace('if (ls.length < HABITUDE_MIN) return null;', 'if (ls.length < 1) return null;'),
  habitude_false: (s) => s.replace('return lus * 5 >= ls.length * 4 ? true : null;', 'return lus * 5 >= ls.length * 4 ? true : false;'),
  enligne_pas_su: (s) => s.replace('if (x.dejaEnLigne === true)', 'if (x.dejaEnLigne !== false)'),
  coupee_ignoree: (s) => s.replace('return (Array.isArray(lignes) ? lignes : []).filter((l) => !(l && c.has(l.code)));', 'return Array.isArray(lignes) ? lignes : [];'),
  coupure_inventee: (s) => s.replace("&& Object.prototype.hasOwnProperty.call(NOMS_ALERTES, k)", ''),
};
const MUTATIONS_BG = {
  bg_sans_reglage: (s) => s.replace("if (d.ecrit === true && ouDesc && lu) {", 'if (ouDesc && lu) {'),
  bg_enligne_pas_su: (s) => s.replace("if (cle && d.enLigne && typeof d.enLigne.has === 'function' && d.enLigne.has(cle))", 'if (cle)'),
  bg_prix_egal: (s) => s.replace('ac != null && ac > 0 && p < ac) out.push', 'ac != null && ac > 0 && p <= ac) out.push'),
  bg_habitude_devinee: (s) => s.replace('if (ls.length < HABITUDE_MIN_EXT) return null;', 'if (ls.length < 1) return null;'),
  bg_coupee_ignoree: (s) => s.replace('return out.filter((a) => !coupees.has(a.code));', 'return out;'),
};

async function charger(src) {
  const f = path.join(os.tmpdir(), `verifPub-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  // (11 nov., intégration 5.355) Toute importation relative de la règle (numeroEcrit.js, profilVendeur.js) est rendue absolue.
  fs.writeFileSync(f, src.replace(/from '\.\/([A-Za-z0-9_-]+\.js)'/g, (_, m) => `from ${JSON.stringify(url.pathToFileURL(path.join(RAC, 'src', m)).href)}`));
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}
const mots = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
const BASE = { titre: 'Nike Air Max 1 blanc', taille: '42', famille: 'chaussures', marque: 'Nike', categorie: 'Chaussures', nPhotos: 5, prix: 80, achat: 40 };
const L = (cle) => ({ etat: 'lu', cle, brut: 'N°' + cle });
const RIEN = { etat: 'rien', raison: 'aucun N° écrit' };

async function regleApp(src, ok) {
  let M; try { M = await charger(src); } catch (e) { ok(false, 'A0 la règle se charge', e.message); return null; }
  const P = M.problemesAnnonce;
  const codes = (a, site = 'lbc') => P({ ...BASE, ...a }, site).map((x) => x.code);
  const texte = (a, site = 'lbc') => (P({ ...BASE, ...a }, site).find((x) => x.code === 'numero') || {}).texte || '';
  ok(codes({ numero: '12', numeroEcrit: true, description: 'Belle paire\nN° 12' }).length === 0, 'A1 le bon N° à la fin de la description : rien à dire');
  ok(codes({ numero: '12', numeroEcrit: true, description: 'Belle paire, taille 42' }).join() === 'numero' && /N°12 absent/.test(texte({ numero: '12', numeroEcrit: true, description: 'Belle paire' })), 'A2 il numérote lui-même, aucun N° à la fin ⇒ « N°12 absent… »');
  ok(/dit N°13, pas N°12/.test(texte({ numero: '12', numeroEcrit: true, description: 'Paire\nN°13' })), 'A3 un autre N° écrit ⇒ dit les deux');
  ok(/Deux N°/.test(texte({ numero: '12', numeroEcrit: true, description: 'N°12 et N°14\nN°12' })), 'A3b deux N° différents ⇒ « Deux N° différents »');
  ok(codes({ numero: '12', description: 'Belle paire' }).length === 0 && codes({ numero: '12', numeroEcrit: null, description: 'Belle paire' }).length === 0, 'A4 il ne numérote pas lui-même (ou pas su) ⇒ rien');
  ok(codes({ numero: '12', numeroEcrit: true }).length === 0, 'A5 description pas sue ⇒ rien');
  ok(codes({ numero: '12', numeroEcrit: true, numeroLu: RIEN }).join() === 'numero' && codes({ numero: '12', numeroEcrit: true, numeroLu: L('12') }).length === 0, 'A6 la lecture rangée (numeroLu) suffit, sans le texte');
  ok(codes({ numero: '12', numeroEcrit: true, numeroLu: { etat: 'bizarre' } }).length === 0, 'A6b une lecture de forme inconnue = pas sue ⇒ rien');
  ok(codes({ numero: '12', numeroEcrit: true, description: 'Belle paire', ref: 'VRM-12' }, 'ebay').length === 0, 'A7 la référence native (SKU VRM-12) porte le N° ⇒ rien');
  ok(codes({ numero: '12', numeroEcrit: true, description: 'Belle paire', ou: ['titre'] }).length === 0, 'A8 description décochée (`ou`) ⇒ pas jugée');
  ok(codes({ numero: '12', numeroEcrit: true, description: 'Belle paire', titre: 'Nike N°12', ou: ['description', 'titre'] }).length === 0, 'A8b le bon N° dans le titre coché ⇒ rien');
  ok(codes({ numeroEcrit: true, description: 'Belle paire' }).join() === 'numero' && /Aucun N°/.test(texte({ numeroEcrit: true, description: 'Belle paire' })), 'A9 sans N° connu : « Aucun N° à la fin de la description »');
  const manque = ['habitudeNumeroEcrit', 'numeroEcritAttendu', 'couperAlerte', 'sansCoupees', 'lireCoupees', 'rallumerAlerte'].filter((k) => typeof M[k] !== 'function');
  ok(!manque.length, 'A0b les fonctions du lot existent', manque.join(', '));
  if (manque.length) return M;
  const H = M.habitudeNumeroEcrit;
  ok(H([L('1'), L('2'), L('3'), L('4'), RIEN]) === true, 'A10 habitude : 4 sur 5 ⇒ vrai');
  ok(H([L('1'), L('2'), L('3'), RIEN, RIEN]) === null && H([L('1'), L('2'), L('3'), L('4')]) === null && H([]) === null, 'A10b 3 sur 5, ou moins de 5 lues ⇒ `null` (pas su), jamais `false`');
  ok(M.numeroEcritAttendu(true, []) === true && M.numeroEcritAttendu(false, []) === null, 'A10c le réglage allumé suffit ; éteint sans preuve ⇒ pas su');
  ok(codes({ numero: '12', dejaEnLigne: true, dejaEnLigneOu: 'sur Leboncoin' }).join() === 'enligne', 'A11 déjà en ligne (lu) ⇒ « Déjà en ligne sur Leboncoin »');
  ok(codes({ numero: '12', dejaEnLigne: null }).length === 0 && codes({ numero: '12', dejaEnLigne: false }).length === 0 && codes({ numero: '12' }).length === 0, 'A11b pas su ou non ⇒ rien');
  const tout = P({ ...BASE, nPhotos: 1, prix: 30, achat: 45, numero: '12', numeroEcrit: true, description: 'x', dejaEnLigne: true, titre: 'x'.repeat(60), taille: '', marque: '', categorie: '' }, 'lbc');
  ok(tout.length >= 8 && tout.every((a) => mots(a.texte) <= 12), 'A12 chaque alerte tient en 12 mots', tout.filter((a) => mots(a.texte) > 12).map((a) => a.texte).join(' | '));
  const montants = tout.map((x) => x.texte + ' ' + x.geste).join(' ').match(/\d+(?:,\d+)?\s?€/g) || [];
  ok(montants.length === 2, 'A13 aucun prix conseillé (seuls le prix et le prix d’achat)', JSON.stringify(montants));
  const brut = M.couperAlerte(null, 'numero');
  ok(M.sansCoupees(tout, brut).every((a) => a.code !== 'numero') && M.sansCoupees(tout, brut).length === tout.length - 1, 'A14 « Ne plus me le dire » : le code coupé disparaît, le reste reste');
  ok(M.lireCoupees(M.couperAlerte(null, 'pirate')).size === 0 && M.lireCoupees({ codes: ['numero', 'xx'] }).size === 1, 'A14b un code inconnu n’est jamais coupé');
  ok(M.sansCoupees(tout, M.rallumerAlerte(brut, 'numero')).length === tout.length && M.lireCoupees(M.rallumerAlerte({ codes: ['numero', 'prix'] }, null)).size === 0, 'A14c rallumer rend l’alerte ; « tout rallumer » vide la liste');
  ok(M.sansCoupees(tout, null).length === tout.length, 'A14d rien coupé (ou réglage pas lu) ⇒ tout est dit');
  return M;
}

async function regleFond(src, ok, M) {
  let f; try { f = faireFond({ src }); } catch (e) { ok(false, 'B0 le fond se charge', e.message); return; }
  const A = f.ctx.alertesDepotVinted;
  if (typeof A !== 'function') { ok(false, 'B0 `alertesDepotVinted` existe dans le fond'); return; }
  const D = { ecrit: true, ou: null, enLigne: new Set(['12']), buyByNum: { 12: '60', 13: '20' }, coupees: [] };
  const c = (page, d = D) => A(page, d).map((x) => x.code).join();
  ok(c({ description: 'Belle paire, taille 42', prix: '50' }) === 'numero', 'B1 il numérote lui-même, aucun N° à la fin ⇒ « numero »');
  ok(c({ description: 'Belle paire\nN°13', prix: '50' }) === '', 'B2 un N° à la fin, pas en ligne, prix au-dessus de l’achat ⇒ rien');
  ok(c({ description: 'Belle paire\nN°12', prix: '50' }) === 'enligne,prix', 'B3 le N° d’une annonce EN LIGNE de ce compte ⇒ « enligne » ; 50 € sous 60 € ⇒ « prix »');
  ok(c({ description: 'Belle paire\nN°12', prix: '60' }) === 'enligne', 'B3b prix = prix d’achat : pas « sous »');
  ok(c({ description: 'Belle paire\nN°12', prix: '50' }, { ...D, enLigne: null, buyByNum: {} }) === '', 'B4 « en ligne » pas su, prix d’achat inconnu ⇒ rien');
  ok(c({ description: 'Belle paire', prix: '50' }, { ...D, ecrit: null }) === '', 'B5 il ne numérote pas lui-même (pas su) ⇒ rien sur le N°');
  ok(c({ description: 'Bel', prix: '' }) === '' && c({ prix: '10' }) === '', 'B6 description encore vide ou introuvable ⇒ rien');
  ok(c({ description: 'Belle paire', prix: '50' }, { ...D, coupees: ['numero'] }) === '', 'B7 une alerte coupée dans l’app ne revient pas sur Vinted');
  ok(c({ description: 'Belle paire', prix: '50' }, { ...D, ou: ['titre'] }) === '', 'B8 description décochée ⇒ pas jugée');
  ok(A({ description: 'Belle paire\nN°12', prix: '50' }, D).every((a) => mots(a.texte) <= 12 && (a.texte.match(/\d+(?:,\d+)?\s?€/g) || []).length <= 2), 'B9 12 mots au plus, aucun prix conseillé');
  if (M && typeof M.habitudeNumeroEcrit === 'function' && typeof f.ctx.habitudeNumeroEcritExt === 'function') {
    const jeux = [[L('1'), L('2'), L('3'), L('4'), RIEN], [L('1'), L('2'), L('3'), RIEN, RIEN], [L('1')], [], [L('1'), L('2'), L('3'), L('4'), L('5'), RIEN, RIEN]];
    ok(jeux.every((j) => f.ctx.habitudeNumeroEcritExt(j) === M.habitudeNumeroEcrit(j)), 'B10 l’habitude du fond = celle de l’app, jeu par jeu');
  } else ok(false, 'B10 `habitudeNumeroEcritExt` existe');
  // La lecture des données : la base VRM seulement, aucune requête Vinted.
  const now = new Date().toISOString();
  const g = faireFond({ src, lignes: {
    main: { vrm_numero_ecrit: { actif: true, ou: ['description'] }, vinted_annonce_numeros: { 5001: { numero: '12', accountId: '111' } }, vinted_buyprice_by_num: { 12: '60' }, vrm_verif_coupees: { codes: ['prix', 'pirate'] } },
    harvest_111_listings: { capturedAt: now, uid: '111', complet: true, payload: { items: [{ id: 5001, title: 'Nike', is_closed: false }, { id: 5002, title: 'Adidas', numEcrit: L('14'), is_closed: false }] } },
  } });
  let d = null; try { if (typeof g.ctx.donneesVerifDepot !== 'function') throw new Error('absente'); d = await g.ctx.donneesVerifDepot('111'); } catch (e) { ok(false, 'B11 donneesVerifDepot s’exécute', e.message); }
  ok(!!d && d.ecrit === true && Array.isArray(d.coupees) && d.coupees.join() === 'prix', 'B11 réglage lu, coupures de l’app reprises (code inconnu écarté)', JSON.stringify(d && { ecrit: d.ecrit, coupees: d.coupees }));
  ok(!!d && (d.enLigne === null || typeof d.enLigne.has === 'function'), 'B11b « en ligne » : un ensemble lu par la règle, ou `null` (pas su)');
  ok(g.j.vinted.length === 0, 'B12 aucune requête Vinted pour préparer l’encart', JSON.stringify(g.j.vinted.map((x) => x.chemin)));
  const h = faireFond({ src, lectureKO: () => true });
  let dk = 'x'; try { if (typeof h.ctx.donneesVerifDepot !== 'function') throw new Error('absente'); dk = await h.ctx.donneesVerifDepot('111'); } catch (_) { dk = 'erreur'; }
  ok(dk === null, 'B13 base muette ⇒ `null` (aucune alerte inventée)');
}

function app(ok) {
  const s = (p) => fs.readFileSync(path.join(RAC, p), 'utf8').replace(/\/\/[^\n]*/g, '');
  const A = s('src/App.jsx');
  ok(/const verifierAvantPublication = async \(tout[^]*?sansCoupees\(tout, coupees\)/.test(A), 'C1 `verifierAvantPublication` retire les alertes coupées avant la feuille');
  ok(/data-verif-couper=\{l\.code\}[^]*?couperAlerte\(/.test(A) || /couperAlerte\([^]*?data-verif-couper=\{l\.code\}/.test(A), 'C2 chaque sorte d’alerte a « Ne plus me le dire » (couperAlerte)');
  ok(/data-verif-publier=""[^]*?close\(true\)/.test(A), 'C3 « Publier quand même » reste (jamais une garde)');
  ok(/'vrm_verif_coupees'/.test(A), 'C4 les coupures sont synchronisées (clé de la liste partagée)');
  ok(/numeroLu: it\.numEcritDesc/.test(A) && /dejaEnLigne: true, dejaEnLigneOu: 'sur ce compte Vinted'/.test(A), 'C5 Annonces/brouillons : la lecture du N° écrit et « déjà en ligne sur ce compte »');
  ok(/pickVerif\(a\.verif\)/.test(s('src/ecrans/Republier.jsx')), 'C6 Republier passe le N° écrit et « déjà en ligne »');
  const lbc = s('src/ecrans/Leboncoin.jsx');
  ok(/dejaEnLigneLbc\(q\.numero\)/.test(lbc) && /description: typeof desc === 'string'/.test(lbc) && /optsNumeroVerif\(\)/.test(lbc), 'C7 Leboncoin : N° dans la description, déjà en ligne sur Leboncoin');
  const eb = s('src/ecrans/Ebay.jsx');
  ok(/dejaEnLigneEbay\(n\)/.test(eb) && /ref: \(item && item\.sku\)/.test(eb) && /optsNumeroVerif\(\)/.test(eb), 'C8 eBay : SKU, description, déjà en ligne sur eBay');
  ok(/optsNumeroVerif\(\)/.test(s('src/ecrans/Vestiaire.jsx')), 'C9 Vestiaire : le N° écrit (si la description est sue)');
  ok(/FRAIS_ENLIGNE_MS = 24 \* 3600 \* 1000/.test(A) && /return toutFrais \? false : null;/.test(A) && /x\.etat === 'enligne'/.test(A), 'C10 « déjà en ligne » eBay/Leboncoin : lecture < 24 h, sinon pas su');
  ok(/data-verif-rallumer=\{c\}/.test(s('src/ecrans/Reglages.jsx')), 'C11 Paramètres rallume une alerte coupée');
}
function page(ok) {
  const c = fs.readFileSync(CAP, 'utf8');
  const bloc = (c.split('AVANT DE PUBLIER : L\'ENCART')[1] || '').split('// Annonces, ventes :')[0].replace(/\/\/[^\n]*/g, '');
  ok(bloc.length > 500 && /action: 'verifDepot'/.test(bloc), 'D1 l’encart ne parle qu’au fond (`verifDepot`)');
  ok(!/\.click\(\)|requestSubmit|\.submit\(|addEventListener\('submit'|fetch\(/.test(bloc), 'D2 il ne clique rien, n’intercepte aucun envoi, ne fait aucune requête');
  ok(/Ne plus me le dire/.test(bloc) && /tu peux publier/.test(bloc), 'D3 discret et jamais une garde : « tu peux publier », « Ne plus me le dire »');
}

(async () => {
  const prouve = process.argv.includes('--prouve');
  const base = fs.readFileSync(SRC, 'utf8'), bg = fs.readFileSync(BG, 'utf8');
  let ko = 0;
  const ok = (c, nom, det) => { if (!c) ko++; if (!prouve) console.log(`${c ? '✅' : '❌'} ${nom}${c || !det ? '' : ' — ' + det}`); };
  const M = await regleApp(base, ok);
  await regleFond(BG, ok, M);
  app(ok); page(ok);
  if (!prouve) { console.log(ko ? `\n❌ ${ko} échec(s)` : '\n✅ prévenir avant de publier : tout est vert'); process.exit(ko ? 1 : 0); }
  if (ko) { console.log(`❌ la base n’est pas verte (${ko})`); process.exit(1); }
  let pris = 0, total = 0;
  for (const [nom, mut] of Object.entries(MUTATIONS_APP)) {
    total++; const m = mut(base); if (m === base) { console.log(`⚠️ mutation ${nom} : ne s’applique pas`); continue; }
    let r = 0; const okm = (c) => { if (!c) r++; }; await regleApp(m, okm);
    if (r) pris++; console.log(`${r ? '✅' : '❌'} mutation ${nom} : ${r} rouge(s)`);
  }
  for (const [nom, mut] of Object.entries(MUTATIONS_BG)) {
    total++; const m = mut(bg); if (m === bg) { console.log(`⚠️ mutation ${nom} : ne s’applique pas`); continue; }
    const f = path.join(os.tmpdir(), `bg-verif-${process.pid}-${nom}.js`); fs.writeFileSync(f, m);
    let r = 0; const okm = (c) => { if (!c) r++; }; try { await regleFond(f, okm, M); } finally { fs.unlinkSync(f); }
    if (r) pris++; console.log(`${r ? '✅' : '❌'} mutation ${nom} : ${r} rouge(s)`);
  }
  console.log(`\n${pris}/${total} mutations attrapées`); process.exit(pris === total ? 0 : 1);
})();
