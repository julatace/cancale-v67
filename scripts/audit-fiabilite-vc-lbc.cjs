#!/usr/bin/env node
// ── audit-fiabilite-vc-lbc — VESTIAIRE : « EN LIGNE » ET « VENDUE », UNE RÈGLE (26 nov. 2026) ──
// Julien : « les données doivent être fiables, pense à Vestiaire Co et Leboncoin ».
// Trois défauts mesurés dans le code (données INVENTÉES ici, jamais la base) :
//   D1. une vente Vestiaire ANNULÉE disait l'annonce « Vendue » (écran Vestiaire, touche « VC n » du
//       sélecteur) alors que le Stock et l'anti double vente la gardent chez lui (`vcVenteAnnulee`) ;
//   D2. une lecture des annonces vieille de plusieurs jours restait « En ligne », comptée (écran
//       Vestiaire, sélecteur) — le Stock et la règle de §5 disent « à confirmer » au-delà de 24 h ;
//   D3. l'écran Annonces de tous les sites ne lisait AUCUNE vente Vestiaire : une annonce vendue
//       restait « En ligne » jusqu'à la relecture de « Mes articles ».
// Exécute les VRAIES règles de l'arbre jugé :
//   · `compterVcEnLigne` (src/plateformes/nombresAnnonces.js, présente aussi dans l'arbre d'avant —
//     c'est là qu'elle rougit) : 50 annonces au MÊME titre ; seule l'identité (productId) décide ;
//   · `etatDeVc` (src/enLigneVc.js) : la règle de l'écran Annonces de tous les sites ;
//   · `etatAnnonceVc` (src/ecrans/Vestiaire.jsx), extraite et exécutée : la ligne de l'écran Vestiaire ;
//   · et le branchement : l'écran Vestiaire tire ses ventes de `vendusVc`, `lireAnnoncesEgalite` lit
//     `vc_ventes` PROJETÉE (jamais `select=data`) et la passe à la règle.
//   node scripts/audit-fiabilite-vc-lbc.cjs                 la règle du dépôt
//   node scripts/audit-fiabilite-vc-lbc.cjs --mutation=NOM  une règle réaffaiblie
//   node scripts/audit-fiabilite-vc-lbc.cjs --prouve        toutes les mutations : chacune doit rougir
//   RACINE=<arbre> node …                                   juger un autre arbre (l'arbre d'avant)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = process.env.RACINE || path.join(__dirname, '..');

// [fichier relatif, ancre, remplacement]
const MUTATIONS = {
  // D1 : une vente annulée prouve de nouveau « vendue ».
  'annulee-vendue': ['src/enLigneVc.js', " && !vcVenteAnnulee(v)) out.add(", ") out.add("],
  // D2 : la fraîcheur de la lecture n'est plus jugée.
  'sans-24h': ['src/enLigneVc.js', "return Number.isFinite(lu) && Number(maintenant) - lu <= VC_FRAIS_MS;", "return true;"],
  // D2 : l'écran Vestiaire ignore « à confirmer » d'une lecture vieille.
  'ecran-vieille': ['src/ecrans/Vestiaire.jsx', "  if (vieille) return { etat: 'a-confirmer'", "  if (false) return { etat: 'a-confirmer'"],
  // D1 : l'écran Vestiaire reprend toutes les ventes, annulées comprises.
  'ecran-toutes-ventes': ['src/ecrans/Vestiaire.jsx', "vendusVc(rv[0].ventes)", "new Set(Object.values(rv[0].ventes || {}).map((v) => String(v && v.productId)))"],
  // D3 : l'écran Annonces de tous les sites ne passe plus les ventes lues.
  'egalite-sans-ventes': ['src/ecrans/AnnoncesEgalite.jsx', "ventesLues: vcv", "ventesLues: null"],
  // D3 : la lecture redevient `select=data` (ligne lourde, §4.4).
  'egalite-select-data': ['src/ecrans/AnnoncesEgalite.jsx', "id=eq.vc_ventes&select=ventes:data->ventes", "id=eq.vc_ventes&select=data"],
  // D4 : ventes Leboncoin pas lues, la touche « LBC n » se présente de nouveau complète.
  'lbc-ventes-ko': ['src/ecrans/Leboncoin.jsx', "lbcRows === null || ventesLbcKO ? null : bilanLbc.enLigne.length", "lbcRows === null ? null : bilanLbc.enLigne.length"],
};
const arg = (k) => { const a = process.argv.find((x) => x.startsWith(k + '=')); return a ? a.slice(k.length + 1) : null; };

if (process.argv.includes('--prouve')) {
  let tous = true;
  for (const nom of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, `--mutation=${nom}`], { encoding: 'utf8', env: process.env });
    const rouge = r.status === 1;
    console.log(`${rouge ? '✅ rougit' : '❌ reste vert'} — mutation ${nom}${rouge ? '' : ' (le contrôle ne la voit pas : statut ' + r.status + ')'}`);
    if (!rouge) tous = false;
  }
  process.exit(tous ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300) : '')); } };

const mut = arg('--mutation');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-fiabilite-vc-'));
for (const d of ['src/plateformes', 'src/ecrans', 'api/_lib']) fs.mkdirSync(path.join(tmp, d), { recursive: true });
fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
for (const f of ['src/enLigneVc.js', 'src/plateformes/nombresAnnonces.js', 'src/ecrans/Vestiaire.jsx', 'src/ecrans/AnnoncesEgalite.jsx', 'src/ecrans/Leboncoin.jsx']) {
  const s = path.join(RACINE, f); if (fs.existsSync(s)) fs.copyFileSync(s, path.join(tmp, f));
}
fs.cpSync(path.join(RACINE, 'api', '_lib'), path.join(tmp, 'api', '_lib'), { recursive: true });
if (mut) {
  const M = MUTATIONS[mut]; if (!M) { console.log('mutation inconnue : ' + mut); process.exit(2); }
  const p = path.join(tmp, M[0]); const s = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  if (!s.includes(M[1])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(3); }
  fs.writeFileSync(p, s.replace(M[1], M[2]));
  console.log('── mutation : ' + mut);
}
try { require('./_copie-imports.cjs').completerImports(RACINE, tmp); } catch (_) {}
const lire = (f) => { try { return fs.readFileSync(path.join(tmp, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

(async () => {
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : a levé', String(e && e.message || e).split('\n')[0]); } };
  const MAINT = Date.parse('2026-11-26T12:00:00Z'), H = 3600e3, iso = (t) => new Date(t).toISOString();
  // 50 annonces au MÊME titre, toutes « on_sale », un compte, vues il y a 2 h.
  const items = (luIlYa) => Object.fromEntries(Array.from({ length: 50 }, (_, i) => ['P' + (i + 1), { titre: 'Nike Dunk Low Panda T42', statut: 'on_sale', compte: 'compteA', vuAt: iso(MAINT - luIlYa) }]));
  const lst = (luIlYa) => ({ items: items(luIlYa), liens: {}, capturedAt: iso(MAINT - luIlYa), complet: true, total: 50 });
  // P1 : une vente ANNULÉE (l'article reste chez lui) ; P2 : une vente à expédier (vendue, preuve par identité).
  const VENTES = { V1: { productId: 'P1', etat: 'cancelled', aExpedier: false, compte: 'compteA' }, V2: { productId: 'P2', etat: 'to_ship', aExpedier: true, compte: 'compteA' } };

  // ── Le compteur du sélecteur (« VC n »), présent dans l'arbre d'avant.
  let N = null;
  await essaie('import de src/plateformes/nombresAnnonces.js', async () => { N = await import(pathToFileURL(path.join(tmp, 'src/plateformes/nombresAnnonces.js')).href); });
  if (!N || typeof N.compterVcEnLigne !== 'function') dit(false, 'compterVcEnLigne existe');
  else {
    // Date.now() réel : la fonction d'avant ne prend pas `maintenant` ⇒ des dates relatives à MAINTENANT réel.
    const vrai = Date.now(), decal = vrai - MAINT;
    const dec = (x) => (Number.isFinite(Date.parse(x || '')) ? iso(Date.parse(x) + decal) : x);
    const decale = (l) => (l ? { ...l, capturedAt: dec(l.capturedAt), items: Object.fromEntries(Object.entries(l.items).map(([k, it]) => [k, { ...it, vuAt: dec(it.vuAt) }])) } : l);
    const cpt = (l, v) => N.compterVcEnLigne(decale(l), v, vrai);
    const n1 = cpt(lst(2 * H), VENTES);
    dit(n1 === 49, 'D1 sélecteur : 50 annonces au même titre, une vendue (identité), une vente ANNULÉE ⇒ 49 en ligne (l’annulée reste)', `rendu ${n1}`);
    const n2 = cpt(lst(5 * 24 * H), VENTES);
    dit(n2 === 0, 'D2 sélecteur : une lecture de 5 jours ⇒ 0 « en ligne » (à confirmer, hors du compte)', `rendu ${n2}`);
    const n3 = cpt(lst(23 * H), null);
    dit(n3 === 50, 'sélecteur : lecture de 23 h, ventes pas lues ⇒ 50 (rien n’est tiré des ventes)', `rendu ${n3}`);
    const n4 = cpt({ items: items(2 * H), liens: {} }, VENTES);
    dit(n4 === null, 'sélecteur : liste jamais datée ⇒ pas su (null), jamais 0', `rendu ${n4}`);
  }

  // ── La règle de l'écran Annonces de tous les sites.
  let E = null;
  await essaie('import de src/enLigneVc.js', async () => { E = await import(pathToFileURL(path.join(tmp, 'src/enLigneVc.js')).href); });
  if (!E || typeof E.etatDeVc !== 'function') dit(false, 'D3 src/enLigneVc.js : la règle `etatDeVc` existe');
  else {
    const L = lst(2 * H);
    const f = E.etatDeVc({ capturedAt: L.capturedAt, ventesLues: [{ ventes: VENTES }], maintenant: MAINT });
    const e = Object.fromEntries(Object.entries(L.items).map(([id, it]) => [id, f(id, it)]));
    dit(e.P2 === 'vendue' && Object.entries(e).filter(([, x]) => x === 'vendue').length === 1, 'D3 Annonces : la vente lue de P2 la dit « vendue », elle seule (50 titres identiques)', e.P2);
    dit(e.P1 === 'en-ligne', 'D1 Annonces : P1, vente annulée, reste « en ligne »', e.P1);
    const g = E.etatDeVc({ capturedAt: L.capturedAt, ventesLues: null, maintenant: MAINT });
    dit(g('P2', L.items.P2) === 'en-ligne', 'D3 Annonces : ventes pas lues ⇒ rien n’est tiré (« vendue » seulement si l’annonce le dit)', g('P2', L.items.P2));
    const V = lst(5 * 24 * H);
    const h = E.etatDeVc({ capturedAt: V.capturedAt, ventesLues: [{ ventes: VENTES }], maintenant: MAINT });
    dit(h('P3', V.items.P3) === 'a-confirmer' && h('P2', V.items.P2) === 'vendue', 'D2 Annonces : lecture de 5 jours ⇒ « à confirmer » ; la vente prouvée reste « vendue »', [h('P3', V.items.P3), h('P2', V.items.P2)]);
    dit(E.etatDeVc({ capturedAt: L.capturedAt, ventesLues: [{ ventes: VENTES }], maintenant: MAINT })('P4', { ...L.items.P4, statut: 'pending_review' }) === 'attente', 'Annonces : la modération lue reste dite (en attente), la règle partagée juge le mot');
  }

  // ── La ligne de l'écran Vestiaire (`etatAnnonceVc`), extraite et exécutée.
  const VJ = lire('src/ecrans/Vestiaire.jsx');
  const fn = (/\nfunction etatAnnonceVc\([\s\S]*?\n\}\n/.exec(VJ) || [])[0];
  dit(!!fn, 'src/ecrans/Vestiaire.jsx porte `etatAnnonceVc`');
  if (fn) {
    let R = null; await essaie('import de api/_lib/vestiaire-regle.js', async () => { R = await import(pathToFileURL(path.join(tmp, 'api/_lib/vestiaire-regle.js')).href); });
    const ctx = { tr: (k) => k, ageCourtVc: () => 'il y a 5 j', VC_ANNONCE_ETATS: R && R.VC_ANNONCE_ETATS, VC_MODERATION: R && R.VC_MODERATION, etatAnnonceVcBrut: R && R.etatAnnonceVcBrut,
      etatVcLu: E && E.etatVcLu ? (id, it, o) => E.etatVcLu(id, it, { ...o, maintenant: MAINT }) : undefined, Date: { parse: Date.parse, now: () => MAINT }, isFinite };
    vm.createContext(ctx);
    await essaie('exécution de etatAnnonceVc', async () => {
      vm.runInContext(fn.replace('function etatAnnonceVc', 'this.etatAnnonceVc = function'), ctx);
      const V = lst(5 * 24 * H), L = lst(2 * H);
      const vieux = ctx.etatAnnonceVc(V.items.P3, false, V.capturedAt);
      dit(vieux.etat === 'a-confirmer' && vieux.label === 'vcmod.aConfirmerVieille', 'D2 écran Vestiaire : lecture de 5 jours ⇒ la ligne dit « à confirmer · lu il y a … » (la lecture est vieille, pas « plus vue »)', vieux);
      const frais = ctx.etatAnnonceVc(L.items.P3, false, L.capturedAt);
      dit(frais.etat === 'en-ligne', 'écran Vestiaire : lecture de 2 h ⇒ « en ligne »', frais);
    });
  }
  // L'écran Vestiaire tire « vendue » de la règle (`vendusVc`), plus de sa propre boucle sur toutes les ventes.
  const VJs = sansCommentaires(VJ);
  const relire = (/function AnnoncesVestiaire\(\)[\s\S]*?setD\(\{ items:/.exec(VJs) || [])[0] || '';
  dit(/vendusVc\(rv\[0\]\.ventes\)/.test(relire) && !/vendus\.add\(String\(v\.productId\)\)/.test(relire), 'D1 écran Vestiaire : « vendue » vient de `vendusVc` (une vente annulée ne prouve rien)');

  // ── Le branchement de l'écran Annonces de tous les sites.
  const AE = sansCommentaires(lire('src/ecrans/AnnoncesEgalite.jsx'));
  const lae = (/export async function lireAnnoncesEgalite[\s\S]*?\n\}\n/.exec(AE) || [])[0] || '';
  const destructure = (/const \[([^\]]*)\] = await Promise\.all\(\[/.exec(lae) || [])[1] || '';
  const lectures = [...lae.matchAll(/borneLecture\(([^\n]*)\),?\n/g)].map((m) => m[1]);
  const posVcv = destructure.split(',').map((x) => x.trim()).indexOf('vcv');
  const lectureVcv = posVcv >= 1 ? (lectures.filter((l) => !/fetchVintedListings/.test(l))[posVcv - 1] || '') : '';
  dit(/id=eq\.vc_ventes&select=ventes:data->ventes/.test(lectureVcv), 'D3 lireAnnoncesEgalite lit `vc_ventes` PROJETÉE (jamais select=data) dans `vcv`', lectureVcv.slice(0, 160));
  dit(/etatDe: etatDeVc\(\{ capturedAt: L\.capturedAt, ventesLues: vcv \}\)/.test(lae), 'D3 lireAnnoncesEgalite juge chaque annonce Vestiaire avec les ventes lues (`etatDeVc`)');

  // ── D4 Leboncoin : la touche « LBC n » du sélecteur. Une annonce vendue reste `active` en base (mesuré le 20 oct.) :
  // sans les ventes lues, le nombre la compterait et se présenterait complet. Le nombre publié est « pas su ».
  const LB = sansCommentaires(lire('src/ecrans/Leboncoin.jsx'));
  const pose = (/poserNombreAnnonces\('leboncoin', ([^\n]*)\);/.exec(LB) || [])[1] || '';
  const kv = (/const ventesLbcKO = ([^;]*);/.exec(LB) || [])[1] || '';
  dit(/lbcVentesRows === null/.test(kv) && /\bventesLbcKO\b[^?]*\?\s*null\s*:/.test(pose), 'D4 Leboncoin : ventes Leboncoin pas lues ⇒ la touche « LBC n » dit pas su (null), jamais un nombre qui compte une annonce vendue', pose);
  console.log(`\n${ko ? '❌' : '✅'} fiabilité Vestiaire et Leboncoin (en ligne, vendue) : ${ok} vert(s), ${ko} rouge(s)`);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  process.exit(ko ? 1 : 0);
})();
