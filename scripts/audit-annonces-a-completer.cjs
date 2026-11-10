// ════════════════════════════════════════════════════════════════════════════
//  ANNONCES À COMPLÉTER + AVIS SUR CHAQUE VENTE (10 nov., lot U)
//  Exécute les VRAIES règles (src/annoncesACompleter.js, src/avisVente.js) sur des
//  annonces et des avis FABRIQUÉS (le dépôt est public), et lit App.jsx pour le
//  branchement.
//   C1  un manque n'est dit que LU : photos absentes, champ jamais vu ⇒ « pas su », pas un manque.
//   C2  moins de 5 photos ⇒ « N photos sur 5 » ; 5 et plus ⇒ rien.
//   C3  champ lu vide (marque, taille, état) ⇒ manque nommé.
//   C4  N° : seulement réglage « je numérote moi-même » ; description pas lue ⇒ pas su ;
//       rien à la fin ⇒ manque ; N° ailleurs ⇒ « N° pas à la fin » ; réglage éteint ⇒ jamais.
//   C5  prix d'achat absent ⇒ manque « Prix d'achat », geste VRM (pas Vinted).
//   C6  lien « modifier » par IDENTIFIANT (/items/{id}/edit) ; geste Vinted seulement s'il y a un manque Vinted.
//   C7  lecture en cours / ratée ⇒ 'encours' / 'passu', jamais une liste vide.
//   C8  50 annonces au même titre : chacune garde SES manques (identité = id).
//   A1  avis relié par n° de transaction SEULEMENT (même note/texte/titre ailleurs : rien).
//   A2  la forme MESURÉE ({ id, rating, feedback }) ⇒ « pas relié », jamais un avis deviné.
//   A3  avis pas lus ⇒ 'pasLu' (aucune ligne) ; en cours ⇒ 'encours'.
//   A4  deux avis contradictoires sur la même transaction ⇒ pas relié.
//   B1  App.jsx : vue « À compléter » branchée, ligne d'avis dans le récap, projection (jamais select=data).
//   B2  aucun rappel d'évaluation (refusé le 11 oct.).
//  `--src <dossier>` : lit les règles d'un autre arbre (preuve sur le code d'avant).
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path');
const i = process.argv.indexOf('--src');
const RACINE = i > 0 ? path.resolve(process.argv[i + 1]) : path.join(__dirname, '..');
let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${ok || !det ? '' : ' — ' + det}`); };

(async () => {
  let R, A;
  try {
    R = await import(path.join(RACINE, 'src', 'annoncesACompleter.js'));
    A = await import(path.join(RACINE, 'src', 'avisVente.js'));
  } catch (e) { dit(false, 'C0 · les règles existent (src/annoncesACompleter.js, src/avisVente.js)', e.message); console.log(`\n${ko} contrôle(s) rouge(s)`); process.exit(1); }
  const { manquesAnnonce, annoncesACompleter, texteManque } = R;
  const tous = { marque: true, taille: true, etat: true };
  const base = { nPhotos: 6, marque: 'Nike', taille: '42', etat: 'Très bon état', champsLus: tous, prixAchat: 40 };
  const cles = (r) => r.manques.map((m) => m.cle).join(',');

  // C1
  { const r = manquesAnnonce({ ...base, nPhotos: undefined, champsLus: {}, marque: null, taille: null, etat: null });
    dit(cles(r) === '' && ['photos', 'marque', 'taille', 'etat'].every((k) => r.pasSu.includes(k)), 'C1 · pas lu ⇒ « pas su », jamais un manque', JSON.stringify(r)); }
  // C2
  { const r = manquesAnnonce({ ...base, nPhotos: 3 }); const r5 = manquesAnnonce({ ...base, nPhotos: 5 });
    dit(cles(r) === 'photos' && texteManque(r.manques[0]) === '3 photos sur 5' && cles(r5) === '', 'C2 · moins de 5 photos', JSON.stringify([r, r5])); }
  // C3
  { const r = manquesAnnonce({ ...base, marque: '', taille: null, etat: '  ' });
    dit(cles(r) === 'marque,taille,etat', 'C3 · champ lu vide ⇒ manque', cles(r)); }
  // C4
  { const sansDesc = manquesAnnonce({ ...base }, { numeroEcrit: true });
    const rien = manquesAnnonce({ ...base, descNumero: { etat: 'rien', raison: 'aucun N° écrit' } }, { numeroEcrit: true });
    const ailleurs = manquesAnnonce({ ...base, descNumero: { etat: 'rien', raison: 'x', ailleurs: '12' } }, { numeroEcrit: true });
    const lu = manquesAnnonce({ ...base, descNumero: { etat: 'lu', cle: '12', brut: 'N° 12' } }, { numeroEcrit: true });
    const eteint = manquesAnnonce({ ...base, descNumero: { etat: 'rien', raison: 'aucun N° écrit' } }, { numeroEcrit: false });
    dit(sansDesc.pasSu.includes('numero') && cles(sansDesc) === '' && cles(rien) === 'numero' && texteManque(ailleurs.manques[0]) === 'N° pas à la fin' && cles(lu) === '' && cles(eteint) === '',
      'C4 · N° à la fin de la description, seulement s\'il numérote lui-même', JSON.stringify({ sansDesc, rien, ailleurs, lu, eteint })); }
  // C5 + C6
  { const res = annoncesACompleter([{ id: 101, ...base, prixAchat: null, titre: 'A' }, { id: 102, ...base, nPhotos: 2, titre: 'B', domaine: 'www.vinted.fr' }, { id: 103, ...base, titre: 'C' }]);
    const a = res.items.find((x) => x.id === '101'), b = res.items.find((x) => x.id === '102');
    dit(res.n === 2 && res.total === 3 && a && a.achat && !a.vinted && cles(a) === 'achat', 'C5 · prix d\'achat absent ⇒ geste VRM seul', JSON.stringify(a));
    dit(b && b.vinted && b.lien === 'https://www.vinted.fr/items/102/edit' && !b.achat, 'C6 · lien « modifier » par identifiant', JSON.stringify(b)); }
  // C7
  { const e = annoncesACompleter(undefined), p = annoncesACompleter(null);
    dit(e.etat === 'encours' && p.etat === 'passu', 'C7 · en cours / pas su ≠ liste vide', JSON.stringify([e, p])); }
  // C8
  { const ann = Array.from({ length: 50 }, (_, k) => ({ id: 5000 + k, titre: 'Nike Air Max 90 42', ...base, nPhotos: k === 17 ? 2 : 6, prixAchat: k === 33 ? null : 40 }));
    const res = annoncesACompleter(ann);
    const ids = res.items.map((x) => x.id).sort().join(',');
    dit(res.n === 2 && ids === '5017,5033' && cles(res.items.find((x) => x.id === '5017')) === 'photos', 'C8 · 50 paires identiques : chacune SES manques', JSON.stringify(res.items.map((x) => [x.id, cles(x)]))); }

  // A1..A4
  const { avisDeLaVente } = A;
  { const avis = [{ id: 1, rating: 5, feedback: 'Super', transaction_id: 777 }, { id: 2, rating: 1, feedback: 'Nul', transaction_id: 888 }];
    const r = avisDeLaVente('888', avis), r2 = avisDeLaVente('999', avis);
    dit(r.etat === 'relie' && r.note === 1 && r.texte === 'Nul' && r2.etat === 'aucun', 'A1 · relié par n° de transaction seulement', JSON.stringify([r, r2])); }
  { const mesure = [{ id: '1234567890', rating: 5, feedback: 'Parfait' }, { id: '1234567889', rating: 4, feedback: 'Bien' }];
    const r = avisDeLaVente('888', mesure);
    dit(r.etat === 'nonRelie' && r.lus === 2 && r.note === undefined, 'A2 · forme mesurée ⇒ « pas relié », rien deviné', JSON.stringify(r)); }
  { dit(avisDeLaVente('1', null).etat === 'pasLu' && avisDeLaVente('1', undefined).etat === 'encours', 'A3 · pas lus / en cours'); }
  { const r = avisDeLaVente('5', [{ rating: 5, transaction_id: 5 }, { rating: 2, transaction_id: 5 }]);
    dit(r.etat === 'nonRelie', 'A4 · deux avis contradictoires ⇒ pas relié', JSON.stringify(r)); }

  // B1, B2
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const sansCom = app.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
  const vue = /annSort==='acompleter'\s*\?\s*\(\s*<VueACompleter[^>]*res=\{annACompleter\}/.test(sansCom) && /setAnnSort\('acompleter'\)/.test(sansCom);
  const ligneAvis = /<AvisVente\s+uid=\{o\._acc\.vinted_user_id\}\s+tx=\{String\(o\.transaction_id\)\}/.test(sansCom);
  const lus = /champsLus: \{ photos: Number\.isFinite\(it\.nPhotos\), marque: \['brand', 'brand_title'\]\.some/.test(sansCom);
  const proj = /harvest_\$\{uid\}_feedbacks&select=avis:data->payload->user_feedbacks/.test(sansCom);
  dit(vue && ligneAvis && proj && lus, 'B1 · branchement (vue, ligne du récap, projection, champs lus)', JSON.stringify({ vue, ligneAvis, proj, lus }));
  const comp = fs.readFileSync(path.join(RACINE, 'src', 'AvisVente.jsx'), 'utf8') + fs.readFileSync(path.join(RACINE, 'src', 'avisVente.js'), 'utf8');
  const code = comp.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
  dit(!/laisse[rz]? (un|une|ton|ta) (avis|évaluation)|évaluer l.acheteur|rappel/i.test(code), 'B2 · aucun rappel d\'évaluation');

  console.log(`\n${ko ? ko + ' contrôle(s) rouge(s)' : 'tout vert'}`);
  process.exit(ko ? 1 : 0);
})();
