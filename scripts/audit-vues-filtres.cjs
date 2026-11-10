// AUDIT — lot X (10 nov.) : filtres enregistrés (src/vuesFiltres.js) et sélection en série
// (src/selectionSerie.js), EXÉCUTÉS tels quels. Ce qui doit tenir :
//  1. une combinaison se range PROPRE (site, compte, état, période) — rien d'autre (pas de recherche tapée) ;
//  2. un état ou une période qui ne s'appliqueraient pas (hors Vinted) ne sont pas rangés ;
//  3. un nom vide, en double, ou des filtres déjà rangés sont REFUSÉS et dits ; 12 au plus par écran ;
//  4. la puce « appuyée » est celle dont les filtres sont EXACTEMENT ceux de l'écran ;
//  5. la sélection : chaque geste compte ce qu'il TOUCHE, les ventes n'ont jamais « Masquer »,
//     une ligne sans geste est comptée à part, une case qui n'est plus visible ne compte plus ;
//  6. la clé est synchronisée (SYNC_KEYS) et écrite par un geste annulable (gesteVrm), jamais localStorage seul.
const path = require('path'), fs = require('fs');
const racine = path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + d : '')); };
(async () => {
  const V = await import(path.join(racine, 'src', 'vuesFiltres.js'));
  const S = await import(path.join(racine, 'src', 'selectionSerie.js'));
  // 1-2
  const p = V.filtresPropres({ site: 'vinted', compte: '111', etat: 'aexpedier', periode: { from: '2026-11-01', to: '2026-11-09' }, recherche: 'nike', acheteur: 'x' }, 'ventes');
  dit(p && Object.keys(p).sort().join() === 'compte,etat,periode,site' && p.etat === 'aexpedier' && p.compte === '111' && p.periode.from.startsWith('2026-11-01'), '1 la combinaison se range propre (rien d’autre que site, compte, état, période)', JSON.stringify(p));
  const lbc = V.filtresPropres({ site: 'leboncoin', compte: '111', etat: 'aexpedier', periode: { from: '2026-11-01' } }, 'ventes');
  dit(lbc && lbc.etat === '' && lbc.periode === null, '2 hors Vinted : ni état ni période rangés (ils ne s’appliqueraient pas)', JSON.stringify(lbc));
  dit(V.filtresPropres({ site: 'vinted', etat: 'nimportequoi' }, 'ventes') === null, '2b un état inconnu n’est pas rangé');
  dit(V.filtresPropres({ site: 'vinted', periode: { from: '2026-11-09', to: '2026-11-01' } }, 'ventes') === null, '2c une période à l’envers n’est pas rangée');
  dit(V.filtresPropres({ site: 'mars' }, 'ventes') === null && V.filtresPropres({ site: 'vinted' }, 'stock') === null, '2d plateforme ou écran inconnus refusés');
  const c = V.filtresPropres({ site: 'toutes', compte: '111', etat: 'envoyes' }, 'colis');
  dit(c && c.compte === '' && c.etat === 'envoyes', '2e Colis : l’onglet est rangé, jamais le compte (Colis n’est pas filtré par compte)', JSON.stringify(c));
  // 3
  let map = {};
  const pose = (r) => { for (const op of r.ops || []) { if (op.apres === undefined) delete map[op.id]; else map[op.id] = op.apres; } };
  const r1 = V.opsAjoutVue(map, 'ventes', '  À envoyer  a ', { site: 'vinted', compte: '111', etat: 'aexpedier' }, { id: 'v1', at: 1 });
  dit(r1.ops && r1.ops.length === 1 && r1.ops[0].k === V.CLE_VUES_FILTRES && r1.ops[0].type === 'cle' && r1.ops[0].apres.nom === 'À envoyer a', '3 ajout : UNE op annulable sur la clé synchronisée, nom nettoyé', JSON.stringify(r1));
  pose(r1);
  dit(!!V.opsAjoutVue(map, 'ventes', 'à ENVOYER A', { site: 'vinted', etat: 'all' }, { id: 'v2', at: 2 }).erreur, '3b un nom en double est refusé (sans tenir compte des majuscules)');
  dit(!!V.opsAjoutVue(map, 'ventes', 'Autre', { site: 'vinted', compte: '111', etat: 'aexpedier' }, { id: 'v3', at: 3 }).erreur, '3c les mêmes filtres deux fois sont refusés');
  dit(!!V.opsAjoutVue(map, 'ventes', '   ', { site: 'vinted' }, { id: 'v4', at: 4 }).erreur, '3d un nom vide est refusé');
  dit(!V.opsAjoutVue(map, 'achats', 'À envoyer a', { site: 'vinted', etat: 'route' }, { id: 'v5', at: 5 }).erreur, '3e un même nom est permis sur un autre écran');
  for (let i = 0; i < 11; i++) pose(V.opsAjoutVue(map, 'ventes', 'N' + i, { site: 'vinted', compte: String(200 + i) }, { id: 'w' + i, at: 10 + i }));
  dit(V.vuesDe(map, 'ventes').length === 12 && !!V.opsAjoutVue(map, 'ventes', 'Treize', { site: 'ebay' }, { id: 'z', at: 99 }).erreur, '3f 12 filtres au plus par écran (le 13e est refusé et dit)');
  const sup = V.opsSupprimerVue(map, 'v1');
  dit(sup.length === 1 && sup[0].apres === undefined && sup[0].avant && sup[0].avant.nom === 'À envoyer a', '3g supprimer : une op dont l’inverse rend la vue (Annuler)');
  // 4
  const vues = V.vuesDe(map, 'ventes');
  dit(V.vueActive(vues, { site: 'vinted', compte: '111', etat: 'aexpedier', periode: null }, 'ventes') === 'v1', '4 la puce appuyée = les filtres EXACTS de l’écran');
  dit(V.vueActive(vues, { site: 'vinted', compte: '111', etat: 'all', periode: null }, 'ventes') === null, '4b un filtre différent : aucune puce appuyée');
  dit(V.vuesDe({ x: { e: 'ventes', nom: 'ok', f: { site: 'vinted', etat: 'pirate' } }, y: 'n', z: { e: 'ventes', nom: '', f: { site: 'vinted' } } }, 'ventes').length === 0, '4c une entrée abîmée (nuage, autre version) est ignorée, jamais appliquée');
  // 5
  const lignes = [{ cle: '1', imprimable: true, deposable: true, masquable: true }, { cle: '2', imprimable: false, deposable: true }, { cle: '3' }, { cle: '4', imprimable: true }];
  const g = S.gestesSerie('ventes', lignes, new Set(['1', '2', '3']));
  const n = Object.fromEntries(g.gestes.map((x) => [x.id, x.n]));
  dit(g.n === 3 && n.imprimer === 1 && n.depose === 2 && !('masquer' in n) && g.sansGeste === 1, '5 Ventes : chaque geste compte ce qu’il touche, jamais « Masquer », la ligne sans geste comptée à part', JSON.stringify(g));
  const a = S.gestesSerie('achats', lignes, ['1', '3']);
  dit(a.gestes.length === 1 && a.gestes[0].id === 'masquer' && a.gestes[0].n === 1 && a.sansGeste === 1, '5b Achats : « Masquer » seul', JSON.stringify(a));
  const vis = S.garderVisibles(new Set(['1', '9']), ['1', '2']);
  dit(vis.size === 1 && vis.has('1'), '5c une case qui n’est plus visible ne compte plus');
  dit(S.gestesSerie('ventes', lignes, []).gestes.length === 0, '5d rien coché : aucun geste');
  // 6
  const app = fs.readFileSync(path.join(racine, 'src', 'App.jsx'), 'utf8').replace(/\/\/.*$/gm, '');
  const sync = /const SYNC_KEYS = \[([\s\S]*?)\n\];/.exec(app);
  dit(!!sync && /\bCLE_VUES_FILTRES\b/.test(sync[1]), '6 la clé des filtres est SYNCHRONISÉE (ses données, tous ses appareils)');
  dit(/gesteVrm\('Filtres enregistrés', r\.ops/.test(app) && !/localStorage\.setItem\([^)]*vrm_vues_filtres/.test(app), '6b écrite par un geste annulable, jamais par le localStorage seul');
  dit(/masquerAchatsSerie = [\s\S]{0,700}gesteVrm\(/.test(app) && /gesteColisFaitSerie = [\s\S]{0,900}gesteVrm\(/.test(app), '6c les gestes en série passent par gesteVrm (annulables), comme leur geste un par un');
  console.log(ko ? `\n❌ audit vues-filtres : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ audit vues-filtres : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
