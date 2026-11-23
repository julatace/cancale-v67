// AUDIT · le fond de l'écran Ventes « VRM natif » (src/ventes/modeleVentes.js + la recherche de src/ventesVerre.js), 19 nov.
// Le module range en rangées-objets ce que l'écran d'avant savait ; cet audit EXÉCUTE ses gardes (§5 de CLAUDE.md) :
//   D  la date limite : LUE ⇒ « avant le … » + « dans N j » ; ESTIMÉE ⇒ « vers le … », jamais « dans », JAMAIS « en retard » ;
//      l'ambre = la règle de l'écran (`presse`), jamais sur une estimée dépassée ; pas de limite ⇒ rien ;
//   B  l'état du bordereau : imprimé · prêt · attente ; un autre site ⇒ null (pas « attente ») ;
//   K  la case : cochée d'office par la règle du lot ; sans bordereau ou non cochable ⇒ grisée, JAMAIS cochée ;
//   S  la sélection du lot de bout en bout : d'office, décocher ⇒ N − 1, le plein dit N, rien de coché ⇒ sa raison ;
//   E  la place : lue ou null, jamais devinée ;
//   G  l'écart nommé : compté sur les rangées (sans bordereau, imprimés), les autres sites hors compte ;
//   Q  la recherche : N° (« 124 », « n°124 », « B188 »), titre sans accents, acheteur, suivi ; contient, jamais « ressemble » ;
//   R  En route : quatre étapes sur preuve ; « pour toi » seulement avec un prix lu ;
//   C  le détail à l'ordinateur : la rangée choisie, sinon AUCUNE (jamais une autre vente à sa place).
// `--prouve` : chaque garde est réaffaiblie dans une copie du module ⇒ l'audit doit ROUGIR (preuve par mutation, §6).
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const SRC = path.join(__dirname, '..', 'src');

async function juger(dir, muet) {
  let ok = 0, ko = 0; const rouges = [];
  const dit = (c, m, d) => { if (c) ok++; else { ko++; rouges.push(m); } if (!muet) console.log((c ? '✅ ' : '❌ ') + m + (c || d == null ? '' : ' — ' + JSON.stringify(d))); };
  const M = await import(path.join(dir, 'ventes', 'modeleVentes.js') + '?' + Date.now() + Math.random());
  const V = await import(path.join(dir, 'ventesVerre.js') + '?' + Date.now() + Math.random());
  const L = await import(path.join(dir, 'lotSelection.js'));

  // D — la date limite
  const lue = M.echeanceRangee({ code: 'date', texte: '22 nov.', ecart: 3 }, { estimee: false });
  dit(lue && lue.sorte === 'lue' && lue.dans === 3 && lue.texte === '22 nov.', 'D limite LUE : « avant le 22 nov. · dans 3 j »', lue);
  const est = M.echeanceRangee({ code: 'date', texte: '22 nov.', ecart: 3 }, { estimee: true });
  dit(est && est.sorte === 'estimee' && est.dans === null, 'D limite ESTIMÉE : « vers le … », jamais « dans N j »', est);
  const estRetard = M.echeanceRangee({ code: 'retard', texte: '2 j de retard', ecart: -2 }, { estimee: true, presse: true });
  dit(estRetard && estRetard.code === 'estimee-depassee' && estRetard.ambre === false, 'D une estimation n’est JAMAIS « en retard » (ni ambre une fois dépassée)', estRetard);
  const lueRetard = M.echeanceRangee({ code: 'retard', texte: '2 j de retard' }, { estimee: false, presse: true });
  dit(lueRetard && lueRetard.code === 'retard' && lueRetard.ambre === true, 'D une limite LUE dépassée dit son retard, en ambre', lueRetard);
  dit(M.echeanceRangee({ code: 'demain', texte: 'demain 12 h' }, { presse: true }).ambre === true && M.echeanceRangee({ code: 'date', texte: '30 nov.', ecart: 9 }, { presse: false }).ambre === false, 'D l’ambre = la règle « avant demain » de l’écran');
  dit(M.echeanceRangee(null) === null && M.echeanceRangee({}) === null, 'D pas de limite ⇒ rien d’écrit');
  dit(M.echeanceRangee({ code: 'date', texte: '20 nov.', ecart: 1 }, {}).dans === null, 'D « dans 1 j » ne se dit pas (c’est « demain »)');

  // B — le bordereau
  dit(M.etatBordereau({ pdf: true }) === 'pret' && M.etatBordereau({ pdf: false }) === 'attente' && M.etatBordereau({ pdf: true, imprime: true }) === 'imprime', 'B imprimé · prêt · attente');
  dit(M.etatBordereau({ autreSite: true }) === null, 'B un autre site : null (son bordereau ne se prend pas ici)');

  // K — la case
  const lot = [{ cle: '1', pdf: true }, { cle: '2', pdf: true, imprime: 1 }, { cle: '3', pdf: false }, { cle: 'eb', cochable: false, pdf: false }];
  const off = V.cochesEffectives(lot, null);
  const k = (c, s) => M.caseDeRangee(lot.find((l) => l.cle === c) || null, s);
  dit(k('1', off).on && k('1', off).possible, 'K bordereau prêt ⇒ cochée d’office');
  dit(!k('2', off).on && k('2', off).possible, 'K déjà imprimé ⇒ décochée d’office, recochable (on ne réimprime jamais seul)');
  dit(!k('3', off).possible && !k('3', new Set(['3'])).on, 'K sans bordereau ⇒ grisée, jamais cochée même si sa clé traîne');
  dit(!k('eb', new Set(['eb'])).possible && !k('eb', new Set(['eb'])).on, 'K non cochable (eBay) ⇒ grisée');
  dit(!k('absent', off).possible && k('absent', off).cle === null, 'K hors du lot ⇒ grisée');

  // S — la sélection du lot, de bout en bout
  const nOff = L.resumeLot(lot, off).partent;
  const s1 = V.basculerCoche(lot, null, '1'); const n1 = L.resumeLot(lot, s1).partent;
  dit(nOff === 1 && n1 === 0, 'S décocher ⇒ N − 1', { nOff, n1 });
  const pl = M.pleinImprimer({ nC: nOff, nR: 2, total: 3 });
  dit(pl.n === 3 && pl.dispo && pl.nVentes === 1 && pl.nRetours === 2, 'S le plein = ventes cochées + retours cochés', pl);
  dit(M.pleinImprimer({ nC: 0, nR: 0, total: 3 }).raison === 'rien-coche' && M.pleinImprimer({ nC: 0, nR: 0, total: 0 }).raison === 'aucun-bordereau' && !M.pleinImprimer({ nC: 0, total: 3 }).dispo, 'S rien de coché ⇒ indisponible AVEC sa raison');
  dit(!M.pleinImprimer({ nC: 2, occupe: true }).dispo, 'S pendant l’impression ⇒ indisponible');
  dit(V.memeQueDefaut(lot, null) && !V.memeQueDefaut(lot, s1), 'S la sélection d’office se reconnaît (le PDF préparé d’avance sert tel quel)');

  // E — la place
  dit(JSON.stringify(M.placeDeRangee({ nom: 'Étagère A', rangee: 1, colonne: 3 })) === '{"nom":"Étagère A","rangee":1,"colonne":3}', 'E la place lue du Stock');
  dit(M.placeDeRangee(null) === null && M.placeDeRangee({ nom: 'A', rangee: NaN, colonne: 1 }) === null, 'E rien lu ⇒ null, jamais devinée');

  // La rangée entière
  const r = M.rangeeEnvoyer({ cle: 'v:9', num: ' 124 ', titre: 'Nike Cortez', taille: '38', prix: '60 €', pdf: true, ligneLot: lot[0], coches: off, echeance: { code: 'date', texte: '22 nov.', ecart: 3 }, limiteEstimee: true, place: null, attente: 2 });
  dit(r.num === '124' && r.bordereau === 'pret' && r.coche.on && r.echeance.sorte === 'estimee' && r.place === null && r.vendueIlYa === 2 && r.numAttendu === false, 'La rangée : N°, bordereau, case, limite estimée, pas de place', r);
  dit(M.rangeeEnvoyer({ cle: 'v:1' }).numAttendu === true && M.rangeeEnvoyer({ cle: 'e:1', autreSite: true }).numAttendu === false, 'La rangée : « N° en attente » pour Vinted seulement');

  // G — l'écart
  const rangs = [M.rangeeEnvoyer({ cle: 'a', pdf: true }), M.rangeeEnvoyer({ cle: 'b' }), M.rangeeEnvoyer({ cle: 'c' }), M.rangeeEnvoyer({ cle: 'd', pdf: true, imprime: true }), M.rangeeEnvoyer({ cle: 'e', autreSite: true })];
  const g = M.ecartNomme(rangs, 1);
  dit(g.coches === 1 && g.sans === 2 && g.imprimes === 1, 'G « 1 coché · 2 sans bordereau · 1 imprimé » (l’autre site hors compte)', g);

  // Q — la recherche
  const Rg = [M.rangeeEnvoyer({ cle: 'a', num: '124', titre: 'Nike Cortez crème', acheteur: 'paul_r' }), M.rangeeEnvoyer({ cle: 'b', num: 'B188', titre: 'Adidas Samba', transporteur: 'Mondial Relay' }), M.rangeeRoute({ cle: 'c', num: '12', titre: 'New Balance 574', suivi: 'XW22000000254' })];
  const q = (t) => M.filtrerRangs(Rg, t).map((x) => x.cle).join();
  dit(q('124') === 'a' && q('n°124') === 'a' && q('N° 124') === 'a', 'Q le N° : « 124 », « n°124 », « N° 124 »', [q('124'), q('n°124'), q('N° 124')]);
  dit(q('b188') === 'b' && q('creme') === 'a' && q('PAUL') === 'a' && q('mondial') === 'b' && q('22000000254') === 'c', 'Q N° à lettres, sans accents, acheteur, transporteur, suivi');
  dit(q('') === 'a,b,c' && q('   ') === 'a,b,c', 'Q rien tapé ⇒ toute la liste');
  dit(q('cortes') === '' && q('nike air') === '', 'Q contient, jamais « ressemble » (une faute ne trouve rien)', [q('cortes'), q('nike air')]);

  // R — En route
  const rt = M.rangeeRoute({ cle: 'p:1', prix: '80 €', pourToi: true, lues: { depose: true, enroute: true }, etat: 'En route' });
  dit(rt.etapes.map((e) => (e.fait ? '1' : '0') + (e.ici ? '*' : '')).join() === '1,1*,0,0' && rt.pourToi, 'R quatre étapes, cochées sur preuve', rt.etapes);
  dit(M.rangeeRoute({ cle: 'p:2', pourToi: true }).pourToi === false && M.rangeeRoute({ cle: 'p:3' }).etapes.every((e) => !e.fait), 'R « pour toi » seulement avec un prix lu ; rien prouvé ⇒ rien coché');

  // C — le détail
  dit(M.rangChoisi(Rg, 'b').cle === 'b' && M.rangChoisi(Rg, 'partie') === null && M.rangChoisi(Rg, null) === null && M.rangChoisi(Rg, '') === null, 'C la rangée choisie, sinon AUCUNE (jamais une autre vente à sa place)');
  return { ok, ko, rouges };
}

const MUTATIONS = [
  ['estimée en retard', 'ventes/modeleVentes.js', "if (estimee && code === 'retard') code = 'estimee-depassee';", ''],
  ['estimée dit « dans N j »', 'ventes/modeleVentes.js', 'date && !estimee && Number.isFinite(ec.ecart)', 'date && Number.isFinite(ec.ecart)'],
  ['ambre sur une estimée dépassée', 'ventes/modeleVentes.js', "ambre: !!presse && code !== 'estimee-depassee'", 'ambre: !!presse'],
  ['case cochée sans bordereau', 'ventes/modeleVentes.js', 'ligne.cochable !== false && ligne.pdf !== false', 'ligne.cochable !== false'],
  ['case cochée sans être possible', 'ventes/modeleVentes.js', 'on: possible && !!(coches && coches.has(ligne.cle))', 'on: !!(ligne && coches && coches.has(ligne.cle))'],
  ['autre site compté « sans bordereau »', 'ventes/modeleVentes.js', 'if (autreSite) return null;', ''],
  ['place devinée', 'ventes/modeleVentes.js', 'if (!e || !Number.isFinite(e.rangee) || !Number.isFinite(e.colonne)) return null;', 'if (!e) return null;'],
  ['détail : une autre vente à la place', 'ventes/modeleVentes.js', '(rangs || []).find((r) => r && r.cle === c) || null) : null', '(rangs || []).find((r) => r && r.cle === c) || (rangs || [])[0] || null) : null'],
  ['plein actif sans rien de coché', 'ventes/modeleVentes.js', 'dispo: n > 0 && !occupe', 'dispo: !occupe'],
  ['« pour toi » sans prix', 'ventes/modeleVentes.js', 'pourToi: !!f.pourToi && !!str(f.prix)', 'pourToi: !!f.pourToi'],
  ['recherche : « n° » pas retiré', 'ventesVerre.js', ".replace(/^n°\\s*/, '')", ''],
  ['recherche : accents gardés', 'ventesVerre.js', ".normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')", ''],
];

(async () => {
  const base = await juger(SRC, false);
  console.log(base.ko ? `\n❌ audit-ventes-modele : ${base.ko} rouge(s), ${base.ok} vert(s)` : `\n✅ audit-ventes-modele : ${base.ok} verts`);
  let echec = base.ko > 0;
  if (process.argv.includes('--prouve')) {
    let rougies = 0;
    for (const [nom, fichier, avant, apres] of MUTATIONS) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-ventes-'));
      fs.mkdirSync(path.join(dir, 'ventes'));
      for (const f of ['ventes/modeleVentes.js', 'ventesVerre.js', 'lotSelection.js']) fs.copyFileSync(path.join(SRC, f), path.join(dir, f));
      fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
      const t = fs.readFileSync(path.join(dir, fichier), 'utf8');
      if (!t.includes(avant)) { console.log(`❌ mutation « ${nom} » : son texte est introuvable`); echec = true; continue; }
      fs.writeFileSync(path.join(dir, fichier), t.replace(avant, apres));
      let r; try { r = await juger(dir, true); } catch (e) { r = { ko: 1, rouges: ['le module ne se charge plus : ' + String(e.message).slice(0, 80)] }; }
      if (r.ko > 0) { rougies++; console.log(`✅ mutation « ${nom} » ⇒ rouge (${r.rouges[0].slice(0, 70)})`); } else { console.log(`❌ mutation « ${nom} » : l'audit reste vert`); echec = true; }
      fs.rmSync(dir, { recursive: true, force: true });
    }
    console.log(`\nMutations : ${rougies}/${MUTATIONS.length} rougissent.`);
  }
  process.exit(echec ? 1 : 0);
})();
