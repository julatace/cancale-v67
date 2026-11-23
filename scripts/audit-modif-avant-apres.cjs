#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  « L'AVANT / APRÈS ET UN MEILLEUR PROCESSUS VISUEL » — LES PREUVES DE CHAQUE ÉTAPE (21 nov., ext. 5.423)
//
//  Julien (21 nov.) : « pour la modification qui est en place dans l'extension, tu peux faire l'avant / après et un
//  meilleur processus visuel ». L'écran plein et le panneau dessinent une FRISE par annonce ; cet audit exige qu'une
//  étape n'y soit cochée QUE sur une preuve réellement obtenue. Le VRAI background.js (scripts/_modif-scenarios.cjs,
//  scripts/_fond-vm.cjs) joue une republication, un arrêt au milieu et un lot de trois prix sur une FAUSSE page
//  vinted.fr ; la VRAIE règle de dessin (vrm-ui.js `<frise-modif-regle>`) est chargée telle quelle. Données inventées.
//    A1  republication : coffre ≤ brouillon ≤ supprimée ≤ en ligne, chacune datée ; le bilan dit avant (dressing rangé :
//        titre, prix, mise en ligne) et après (nouvel identifiant rendu par Vinted, prix posé, date de mise en ligne)
//    A2  AUCUNE étape datée (frise ou bilan) sans le fait qui la prouve au même moment — sur chaque instantané
//    A3  pendant : un instantané « coffre ✓ brouillon ✓ » montre « supprimée » EN COURS et rien d'autre de coché
//    A4  « Tout arrêter » après le brouillon : bilan non réussi, « supprimée » en AMBRE (arrêtée ici), geste « Reprendre »
//    P1  lot de prix : avant = le prix LU chez Vinted, après = le prix RELU ; les 4 étapes datées dans l'ordre
//    P2  Vinted refuse l'enregistrement : « enregistré » en ambre, « Ouvrir sur Vinted », rien de coché après
//    P3  la série : « 3 sur 3 », le bilan garde les 3 annonces du lot
//    P4  la relecture montre un AUTRE prix : jamais « vérifié »
//    U1  la règle de dessin : sans preuve, jamais « faite » (même avec les suivantes prouvées, même à la fin)
//  `--prouve` : rouge sur l'arbre d'avant (--avant <arbre>, défaut : la base `claude/ext-5419`) et par 4 mutations.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm'), cp = require('child_process');
const RACINE = path.join(__dirname, '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const EXT = path.resolve(arg('--ext') || path.join(RACINE, 'vinted-sync-extension'));
const BG = path.join(EXT, 'background.js'), UI = path.join(EXT, 'vrm-ui.js');
const S = require('./_modif-scenarios.cjs');
const SILENCE = !!process.env.SILENCE;
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; if (!SILENCE) console.log('✅ ' + m); } else { ko++; if (!SILENCE) console.log('❌ ' + m + (d ? '  → ' + String(d).slice(0, 600) : '')); } };

function chargerUi() {
  const ctx = { navigator: { language: 'fr-FR' }, console };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(UI, 'utf8'), ctx, { filename: 'vrm-ui.js' });
  return ctx.VRM_UI && ctx.VRM_UI.MODIF ? ctx.VRM_UI.MODIF : null;
}
const etats = (M, m) => (M ? M.frise(m).map((e) => e.k + ':' + e.etat).join(' ') : '');

async function principal() {
  const M = chargerUi();
  dit(!!M, 'la règle de dessin des frises existe (vrm-ui.js `VRM_UI.MODIF`)');
  // ── Republication ──
  const a = await S.jouerRepub(BG);
  const b = a.final && Array.isArray(a.final.bilan) ? a.final.bilan.find((x) => x && x.id === '9101') : null;
  const p = (b && b.preuves) || {};
  dit(b && b.ok === true && p.coffre > 0 && p.coffre <= p.brouillon && p.brouillon <= p.supprimee && p.supprimee <= p.enligne
    && b.avant && b.avant.prix === 60 && b.avant.depuis > 0 && b.titre === 'Basket test 42 cuir blanc' && b.apres && b.apres.id === '88001' && b.apres.prix === 60 && b.apres.depuis === p.enligne,
  'A1 republication : coffre ≤ brouillon ≤ supprimée ≤ en ligne datées ; avant = dressing rangé, après = identifiant rendu par Vinted', JSON.stringify({ r: a.r, b }));
  const fa = S.preuvesSansFait(a.snaps);
  dit(a.snaps.length > 4 && !fa.length, `A2 republication : ${a.snaps.length} instantanés, aucune étape datée sans son fait`, fa.join(' · '));
  const pendant = a.snaps.map((s) => s.a).find((x) => x && x.actif && x.enCours && x.modif && x.modif.preuves && x.modif.preuves.brouillon > 0 && !(x.modif.preuves.supprimee > 0));
  dit(pendant && etats(M, pendant.modif) === 'coffre:faite brouillon:faite supprimee:encours enligne:attente', 'A3 pendant : « coffre ✓ brouillon ✓ », « supprimée » en cours, rien d’autre coché', pendant ? etats(M, pendant.modif) : 'aucun instantané');
  // ── Arrêt au milieu ──
  const c = await S.jouerRepub(BG, { arreterApres: 'brouillon' });
  const bc = c.final && Array.isArray(c.final.bilan) ? c.final.bilan.find((x) => x && x.id === '9101') : null;
  const frc = bc ? etats(M, { sorte: 'republier', preuves: bc.preuves, erreur: bc.erreur, fin: 1 }) : '';
  dit(c.r && c.r.code === 'tout-arrete' && c.final && c.final.fin && c.final.fin.raison === 'arret' && bc && bc.ok === false && bc.erreur && bc.erreur.geste === 'reprendre' && /Reprendre/.test(bc.erreur.raison)
    && frc === 'coffre:faite brouillon:faite supprimee:erreur enligne:attente' && !c.faits.some((x) => x.etape === 'supprimer'),
  'A4 « Tout arrêter » après le brouillon : rien supprimé, « supprimée » en ambre (arrêtée ici), « Reprendre »', JSON.stringify({ r: c.r, bc, frc }));
  dit(!S.preuvesSansFait(c.snaps).length, 'A4b l’arrêt : aucune étape datée sans son fait', S.preuvesSansFait(c.snaps).join(' · '));
  // ── Lot de prix ──
  const d = await S.jouerPrix(BG);
  const bl = (d.final && d.final.bilan) || [];
  const x1 = bl.find((x) => x.id === '91010001'), x2 = bl.find((x) => x.id === '91010002'), x3 = bl.find((x) => x.id === '91010003');
  const lu = (id) => (d.faits.find((f) => f.id === id && f.quoi === 'lu') || {}).prix, relu = (id) => (d.faits.filter((f) => f.id === id && f.quoi === 'relu').pop() || {}).prix;
  const ord = (x) => x && x.preuves.lu > 0 && x.preuves.lu <= x.preuves.tape && x.preuves.tape <= x.preuves.enregistre && x.preuves.enregistre <= x.preuves.verifie;
  dit(x1 && x2 && x1.ok && x2.ok && ord(x1) && ord(x2) && x1.avant.prix === lu('91010001') && x1.apres.prix === relu('91010001') && x2.avant.prix === 75 && x2.apres.prix === 67.5 && relu('91010002') === 67.5,
    'P1 lot de prix : avant = prix LU chez Vinted (60, 75), après = prix RELU (54, 67,50), 4 étapes datées dans l’ordre', JSON.stringify({ x1, x2 }));
  dit(x3 && x3.ok === false && x3.preuves.lu > 0 && !(x3.preuves.enregistre > 0) && !(x3.preuves.verifie > 0) && x3.erreur && x3.erreur.geste === 'vinted' && /422/.test(x3.erreur.raison)
    && etats(M, { sorte: 'baisse', preuves: x3.preuves, erreur: x3.erreur, fin: 1 }) === 'lu:faite tape:faite enregistre:erreur verifie:attente',
  'P2 Vinted refuse (422) : « enregistré » en ambre, « Ouvrir sur Vinted », rien de coché après', JSON.stringify(x3));
  dit(d.final && d.final.total === 3 && bl.length === 3 && d.final.serie && /^prix:/.test(d.final.serie), 'P3 la série du lot : « sur 3 », le bilan garde les 3 annonces', JSON.stringify({ total: d.final && d.final.total, n: bl.length, serie: d.final && d.final.serie }));
  dit(!S.preuvesSansFait(d.snaps).length, `A2b lot de prix : ${d.snaps.length} instantanés, aucune étape datée sans son fait`, S.preuvesSansFait(d.snaps).join(' · '));
  const e = await S.jouerPrix(BG, { relu: { '91010002': 70 } });
  const y2 = ((e.final && e.final.bilan) || []).find((x) => x.id === '91010002');
  dit(y2 && y2.ok === false && !(y2.preuves.verifie > 0) && y2.preuves.enregistre > 0, 'P4 la relecture montre 70 € au lieu de 67,50 € : jamais « vérifié »', JSON.stringify(y2));
  // ── La règle de dessin ──
  if (M) {
    const u1 = etats(M, { sorte: 'republier', preuves: { coffre: 1, supprimee: 3 }, fin: 1 });
    const u2 = etats(M, { sorte: 'baisse', preuves: {}, fin: 1, erreur: { raison: 'x' } });
    const u3 = etats(M, { sorte: 'masquer', preuves: { lu: 5, enregistre: 6, verifie: 7 }, fin: 1 });
    dit(u1 === 'coffre:faite brouillon:attente supprimee:faite enligne:attente' && u2 === 'lu:erreur tape:attente enregistre:attente verifie:attente' && u3 === 'lu:faite enregistre:faite verifie:faite',
      'U1 la règle : sans preuve jamais « faite » (même entre deux étapes prouvées, même à la fin)', JSON.stringify({ u1, u2, u3 }));
  }
  console.log(`\n${ko ? '❌' : '✅'} audit-modif-avant-apres : ${ok} vert(s), ${ko} rouge(s)`);
  return ko;
}

function copieArbre(srcExt) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'modif-aa-'));
  const ext = path.join(tmp, 'vinted-sync-extension'); fs.mkdirSync(ext);
  for (const f of fs.readdirSync(srcExt)) { const p = path.join(srcExt, f); if (fs.statSync(p).isFile()) fs.copyFileSync(p, path.join(ext, f)); }
  return ext;
}
function lancer(ext) { const r = cp.spawnSync(process.execPath, [__filename, '--ext', ext], { encoding: 'utf8', env: Object.assign({}, process.env, { SILENCE: '1' }), timeout: 600000 }); return r.status; }
function prouver() {
  let bons = 0, total = 0;
  const muter = (nom, fichier, de, vers) => {
    total++;
    const ext = copieArbre(EXT); const p = path.join(ext, fichier); const s0 = fs.readFileSync(p, 'utf8');
    if (!s0.includes(de)) { console.log(`❌ mutation ${nom} : motif absent`); return; }
    fs.writeFileSync(p, s0.replace(de, vers));
    const st = lancer(ext);
    if (st === 1) { bons++; console.log(`✅ mutation ${nom} ⇒ rouge`); } else console.log(`❌ mutation ${nom} non détectée (code ${st})`);
  };
  muter('brouillon coché AVANT la réponse de la page', 'background.js', "  etapeRepub(id, 'brouillon');\n  await poserVerrouRecreer('r' + id);", "  etapeRepub(id, 'brouillon'); await preuveModif(id, 'brouillon');\n  await poserVerrouRecreer('r' + id);");
  muter('« enregistré » sans le oui de Vinted', 'background.js', "if (r && r.ok === true && !r.incertain) await preuveModif(id, 'enregistre');", "if (r) await preuveModif(id, 'enregistre');");
  muter('« vérifié » sans relecture juste', 'background.js', "if (r && r.ok === true && !r.incertain) await preuveModif(id, 'enregistre');", "if (r && r.ok === true && !r.incertain) { await preuveModif(id, 'enregistre'); await preuveModif(id, 'verifie'); }");
  muter('le dessin coche une étape sans preuve à la fin', 'vrm-ui.js', 'if (Number.isFinite(at) && at > 0) return { k, etat: \'faite\', at };', 'if ((Number.isFinite(at) && at > 0) || fini) return { k, etat: \'faite\', at };');
  // L'arbre d'avant (la base de ce lot) : la fonction n'existe pas ⇒ rouge.
  total++;
  const avant = arg('--avant');
  let extAvant = avant ? path.join(path.resolve(avant), 'vinted-sync-extension') : null;
  if (!extAvant) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'modif-aa-avant-'));
    const g = cp.spawnSync('sh', ['-c', `git -C "${RACINE}" archive c99b8e43a vinted-sync-extension | tar -x -C "${tmp}"`], { encoding: 'utf8' });
    extAvant = g.status === 0 ? path.join(tmp, 'vinted-sync-extension') : null;
  }
  if (extAvant && fs.existsSync(path.join(extAvant, 'background.js'))) { const st = lancer(extAvant); if (st === 1) { bons++; console.log('✅ arbre d’avant (5.419) ⇒ rouge'); } else console.log(`❌ arbre d’avant non rouge (code ${st})`); }
  else console.log('❌ arbre d’avant introuvable');
  console.log(`\n${bons === total ? '✅' : '❌'} --prouve : ${bons}/${total}`);
  process.exit(bons === total ? 0 : 1);
}
if (process.argv.includes('--prouve')) prouver();
else principal().then((k) => process.exit(k ? 1 : 0), (e) => { console.error(e); process.exit(1); });
