// ════════════════════════════════════════════════════════════════════════════
//  TRÈS AIMÉES, PAS VENDUES (13 nov., lot 31, point 31 de Julien) — EXÉCUTÉ
//
//  La règle PURE (src/favorisSansVente.js) tourne sur des annonces INVENTÉES :
//    A  par compte : seules les annonces EN LIGNE du compte ; un autre compte, une
//       vendue (preuve partagée), une réservée : absentes ;
//    B  ≥ N favoris LUS (3 par défaut, N réglable) ; favoris pas lus ⇒ pas listée et
//       la raison comptée (jamais 0 deviné) ; « à confirmer » (> 24 h) ⇒ comptée ;
//    C  ≥ 14 j en ligne LUS ; date pas lue ⇒ pas listée, comptée ; prix pas lu ⇒ comptée ;
//    D  tri : favoris décroissants (puis la plus ancienne) ; lecture KO ⇒ « pas su » ;
//    E  à qui écrire : les favoris cochables de CETTE annonce, une personne une fois,
//       jamais un déjà contacté (même par une autre de ses lignes) ;
//    F  l'offre : prix − x % (x le sien), la fonction de l'extension (prixOffreFavori) ;
//       achat connu ⇒ jamais sous l'achat + 10 % (balayage) ; achat inconnu et rien
//       tapé ⇒ rien proposé ; tapé ⇒ proposé ; x invalide ⇒ rien ;
//    G  le garde-fou d'envoi : une annonce venue d'ici dont l'offre retouchée tombe sous
//       l'achat + 10 % ⇒ refusée ;
//    H  le câblage : FavorisVinted rend la liste, le geste pré-remplit SANS lancer
//       (aucun appel à `lancer` dans proposerSv), « Envoyer » est refusé sous le plancher.
//  `--prouve` : chaque mutation doit faire rougir au moins un contrôle.
//  `--racine <dir>` : jouer l'audit sur un autre arbre (branche de départ).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const iR = process.argv.indexOf('--racine');
const R = iR > 0 ? path.resolve(process.argv[iR + 1]) : path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };

const acc = (u) => ({ vinted_user_id: u });
const U = '4242', V = '5151';
const ITEMS = [
  { id: '1', _acc: acc(U), favourites: 12, price: '60.0' },
  { id: '2', _acc: acc(U), favourites: 3, price: '40.0' },
  { id: '3', _acc: acc(U), favourites: 2, price: '40.0' },        // sous le seuil
  { id: '4', _acc: acc(U), favourites: 30, price: '80.0' },       // vendue
  { id: '5', _acc: acc(U), favourites: 9, price: '50.0', reserved: true },
  { id: '6', _acc: acc(U), favourites: null, price: '50.0' },     // favoris pas lus
  { id: '7', _acc: acc(U), favourites: 7, price: '50.0' },        // date pas lue
  { id: '8', _acc: acc(U), favourites: 8, price: '50.0' },        // 10 j en ligne
  { id: '9', _acc: acc(V), favourites: 40, price: '90.0' },       // autre compte
  { id: '10', _acc: acc(U), favourites: 12, price: '55.0' },      // même favoris que 1, plus ancienne
  { id: '11', _acc: acc(U), favourites: 5, price: null },         // prix pas lu
];
const INFOS = { 1: { jours: 20, achat: 30 }, 2: { jours: 14 }, 3: { jours: 40 }, 4: { jours: 40 }, 5: { jours: 40 }, 6: { jours: 40 }, 7: { jours: null }, 8: { jours: 10 }, 9: { jours: 40 }, 10: { jours: 60 }, 11: { jours: 30 } };
const LISTINGS = { items: ITEMS, aConfirmer: [{ id: '12', _acc: acc(U), favourites: 6 }], error: false };

async function controles(fichier, parler) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (parler) console.log((c ? '✅ ' : '❌ ') + m + (d !== undefined && !c ? '  → ' + String(d).slice(0, 300) : '')); };
  let M = null;
  try { M = await import(pathToFileURL(fichier).href + '?v=' + Math.random()); } catch (e) { dit(false, 'src/favorisSansVente.js se charge', e.message); }
  if (M && typeof M.annoncesSansVente === 'function') {
    const res = M.annoncesSansVente({ uid: U, listings: LISTINGS, vendus: new Set(['4']), infosDe: (id) => INFOS[id] || null });
    const ids = res.annonces.map((a) => a.itemId);
    dit(res.lecture === 'ok', 'A0 la lecture du dressing est lue');
    dit(!ids.includes('9'), 'A1 une annonce d’un AUTRE compte n’est pas listée', ids);
    dit(!ids.includes('4'), 'A2 une annonce VENDUE (preuve partagée) n’est pas listée', ids);
    dit(!ids.includes('5') && res.ecartees.reservee === 1, 'A3 une annonce réservée : pas listée, dite', JSON.stringify(res.ecartees));
    dit(!ids.includes('3') && ids.includes('2'), 'B1 ≥ 3 favoris par défaut (3 listée, 2 non)', ids);
    dit(!ids.includes('6') && res.ecartees.favoris === 1, 'B2 favoris pas lus ⇒ pas listée, la raison comptée (jamais 0 deviné)', JSON.stringify(res.ecartees));
    dit(res.ecartees.lecture === 1, 'B3 une annonce « à confirmer » (dressing > 24 h) est comptée', JSON.stringify(res.ecartees));
    const r10 = M.annoncesSansVente({ uid: U, listings: LISTINGS, vendus: new Set(['4']), infosDe: (id) => INFOS[id] || null, seuil: 10 });
    dit(JSON.stringify(r10.annonces.map((a) => a.itemId)) === JSON.stringify(['10', '1']), 'B4 N réglable : ≥ 10 favoris ⇒ 10, 1', JSON.stringify(r10.annonces.map((a) => a.itemId)));
    dit(!ids.includes('7') && res.ecartees.date === 1, 'C1 date de mise en ligne pas lue ⇒ pas listée, comptée', JSON.stringify(res.ecartees));
    dit(!ids.includes('8'), 'C2 10 j en ligne ⇒ pas listée (14 j au moins)', ids);
    dit(ids.includes('2'), 'C3 14 j pile ⇒ listée', ids);
    dit(!ids.includes('11') && res.ecartees.prix === 1, 'C4 prix pas lu ⇒ pas listée, comptée', JSON.stringify(res.ecartees));
    dit(JSON.stringify(ids) === JSON.stringify(['10', '1', '2']), 'D1 tri : favoris décroissants, à égalité la plus ancienne', ids);
    const ko1 = M.annoncesSansVente({ uid: U, listings: { error: 'x', items: [] }, vendus: new Set(), infosDe: () => null });
    dit(ko1.lecture === 'passu' && !ko1.annonces.length, 'D2 lecture du dressing en erreur ⇒ « pas su », rien listé');
    dit(M.annoncesSansVente({ uid: U, listings: null }).lecture === 'passu', 'D3 aucune lecture ⇒ « pas su »');
    // E
    const rows = [
      { id: 'a', itemId: '1', cochable: true, envoi: 'a_envoyer', date: 5 },
      { id: 'b', itemId: '1', cochable: true, envoi: 'a_envoyer', date: 4 },
      { id: 'c', itemId: '1', cochable: false, envoi: 'envoye', date: 3 },
      { id: 'd', itemId: '1', cochable: true, envoi: 'a_envoyer', date: 2 },   // même personne que c
      { id: 'e', itemId: '1', cochable: true, envoi: 'a_envoyer', date: 1 },   // même personne que a
      { id: 'f', itemId: '2', cochable: true, envoi: 'a_envoyer', date: 9 },
      { id: 'g', itemId: '1', cochable: false, envoi: 'pas_envoye', date: 0 },
    ];
    const perso = { a: '1:p1', b: '1:p2', c: '1:p3', d: '1:p3', e: '1:p1', f: '2:p1', g: '1:p4' };
    const c1 = M.favorisAContacter(rows, '1', (id) => perso[id]);
    dit(JSON.stringify(c1.ids) === JSON.stringify(['a', 'b']), 'E1 à qui écrire : les cochables de CETTE annonce, une personne une fois', JSON.stringify(c1));
    dit(!c1.ids.includes('d') && c1.deja === 1, 'E2 une personne déjà contactée (par une autre ligne) n’est pas recontactée', JSON.stringify(c1));
    dit(!c1.ids.includes('f') && !c1.ids.includes('g'), 'E3 ni l’autre annonce, ni une ligne « pas envoyée »', JSON.stringify(c1));
    // F
    const o1 = M.offreSansVente({ prix: 60, achat: 30, remise: '' });
    dit(o1.etat === 'ok' && o1.pct === 10 && o1.apres === 54, 'F1 achat connu, rien tapé ⇒ −10 % proposé (60 € ⇒ 54 €)', JSON.stringify(o1));
    const o2 = M.offreSansVente({ prix: 60, achat: 50, remise: '20' });
    dit(o2.etat === 'ok' && o2.apres >= 55 && o2.limitee === true && o2.pct === 8, 'F2 achat 50 € : −20 % demandé ⇒ limité à −8 % (55,20 € ≥ 55 €, achat + 10 %)', JSON.stringify(o2));
    dit(M.offreSansVente({ prix: 60, achat: 56, remise: '5' }).etat === 'plancher', 'F3 achat 56 € sur 60 € ⇒ aucune remise possible (plancher 62 €)');
    dit(M.offreSansVente({ prix: 60, achat: null, remise: '' }).etat === 'saisir', 'F4 achat inconnu, rien tapé ⇒ rien proposé');
    const o5 = M.offreSansVente({ prix: 60, achat: null, remise: '25' });
    dit(o5.etat === 'ok' && o5.apres === 45 && o5.plancher == null, 'F5 achat inconnu, sa saisie −25 % ⇒ 45 €', JSON.stringify(o5));
    dit(['0', '100', 'abc', '5.5'].every((x) => M.offreSansVente({ prix: 60, achat: 30, remise: x }).etat === 'invalide'), 'F6 x invalide (0, 100, texte, décimal) ⇒ rien');
    const fautes = []; let n = 0;
    let prixOffre = null; try { prixOffre = (await import(pathToFileURL(path.join(path.dirname(fichier), 'favorisMessage.js')).href)).prixOffreFavori; } catch (_) {}
    for (let pc = 500; pc <= 40000; pc += 173) for (const r of [0.2, 0.5, 0.8, 0.9, 0.95]) for (const x of ['', '5', '10', '30', '60']) {
      const prix = pc / 100, achat = Math.round(prix * r * 100) / 100;
      const o = M.offreSansVente({ prix, achat, remise: x });
      if (o.etat !== 'ok') continue; n++;
      if (o.apres < Math.ceil(Math.ceil(Math.round(achat * 100) * 1.1) / 100)) fautes.push(`${prix}/${achat}/${x}: ${o.apres}`);
      if (prixOffre && Number(prixOffre(prix, { mode: 'pct', valeur: o.pct })) !== o.apres) fautes.push(`${prix}: pas le prix de l’extension`);
      if (o.apres >= prix) fautes.push(`${prix}: pas une baisse`);
    }
    dit(n > 500 && !fautes.length, `F7 balayage (${n} offres) : jamais sous l’achat + 10 %, le prix que l’extension calculera, toujours une baisse`, fautes.slice(0, 4).join(' | '));
    // G
    const org = new Map([['1', 50]]);
    dit(M.sousPlancherAchat([{ itemId: '1', offre: { apres: 50 } }], org).length === 1, 'G1 offre retouchée à 50 € (achat 50 €) ⇒ refusée à l’envoi');
    dit(M.sousPlancherAchat([{ itemId: '1', offre: { apres: 56 } }], org).length === 0, 'G2 offre à 56 € (plancher 55 €) ⇒ acceptée');
    dit(M.sousPlancherAchat([{ itemId: '2', offre: { apres: 1 } }], org).length === 0, 'G3 une annonce qui ne vient pas d’ici : la règle d’avant (garde de marge) seule');
  } else if (M) dit(false, 'la règle existe (annoncesSansVente)');
  return ko;
}

function cablage(parler) {
  let ko = 0;
  const dit = (c, m) => { if (!c) ko++; if (parler) console.log((c ? '✅ ' : '❌ ') + m); };
  const fv = lire('src/FavorisVinted.jsx').replace(/\/\/[^\n]*/g, '');
  const fe = lire('src/FavorisEtapes.jsx').replace(/\/\/[^\n]*/g, '');
  const app = lire('src/App.jsx');
  dit(/<FavorisSansVente\b/.test(fv) && /sansVente=\{sansVente\}/.test(fv) && /\{p\.sansVente \|\| null\}\{qui\}/.test(fe), 'H1 la liste est RENDUE sur la page des favoris (avant « Qui »)');
  const prop = (/const proposerSv=\(a,o,ids\)=>\{([\s\S]*?)\n  \};/.exec(fv) || [])[1] || '';
  dit(prop && /setChoisis\(ids\)/.test(prop) && /setReduction\(String\(o\.pct\)\)/.test(prop) && !/lancer|moteur|envoyer\(/.test(prop), 'H2 le geste pré-remplit (favoris + −x %) et ne lance RIEN');
  dit(/selectionnable/.test(prop), 'H3 le geste n’agit qu’au nom du compte de l’onglet');
  dit(/sousPlancherAchat\(recapAnnonces,origines\)\.length\)return;/.test(fv) && /&& !p\.refus/.test(fe), 'H4 « Envoyer » refusé sous l’achat + 10 % pour une annonce venue d’ici');
  dit(/jours:it\?listedAgeDays\(it\):null,achat:prixAchatDe\(fiche,buyByNum\)/.test(app), 'H5 l’app passe les jours en ligne LUS et le prix d’achat SAISI (par identité)');
  return ko;
}

const MUTATIONS = [
  ['vendu', 'if (vendu(id)) continue;', ''],
  ['favoris-devine', 'if (favoris == null) { ecartees.favoris++; continue; }', 'if (favoris == null) { }'],
  ['jours', 'if (jours < JOURS_MIN) continue;', ''],
  ['tri', 'out.sort((a, b) => b.favoris - a.favoris', 'out.sort((a, b) => a.favoris - b.favoris'],
  ['plancher', 'if (a != null && a >= plancher) break; pct--;', 'break;'],
  ['saisir', 'if (plancher == null) return { etat: \'saisir\' };', ''],
  ['deja', 'if (p && (contactees.has(p) || personnes.has(p))) continue;', ''],
  ['compte', "it._acc && chaine(it._acc.vinted_user_id) === u", 'it._acc'],
];

(async () => {
  const fichier = path.join(R, 'src', 'favorisSansVente.js');
  if (!PROUVE) {
    const ko = (await controles(fichier, true)) + cablage(true);
    console.log(`\naudit-favoris-sans-vente : ${ko ? ko + ' rouge(s)' : 'tout est vert'}`);
    process.exit(ko ? 1 : 0);
  }
  const src = fs.readFileSync(fichier, 'utf8');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sans-vente-'));
  for (const f of ['conseilPrix.js', 'favorisMessage.js']) fs.copyFileSync(path.join(R, 'src', f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  let rates = 0;
  for (const [nom, a, b] of MUTATIONS) {
    if (!src.includes(a)) { console.log('❌ mutation introuvable : ' + nom); rates++; continue; }
    const f = path.join(dir, `m-${nom}.js`);
    fs.writeFileSync(f, src.replace(a, b));
    const ko = await controles(f, false);
    console.log((ko ? '✅ ' : '❌ ') + `mutation « ${nom} » ⇒ ${ko} rouge(s)`);
    if (!ko) rates++;
  }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n--prouve : ${rates ? rates + ' mutation(s) NON vue(s)' : 'chaque mutation rougit'}`);
  process.exit(rates ? 1 : 0);
})();
