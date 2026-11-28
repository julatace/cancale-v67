#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « RELIER À UN ACHAT » ET « PRIX MINIMUM ACCEPTÉ » AVANT DE PUBLIER (28 nov. 2026, src/publier/avantPublier.js)
//  Julien : « avant de publier, relier à un achat, et un bouton pour dire quel est le prix le plus bas à accepter … comme ça
//  l'extension peut faire des contre-offres ».
//   1. 50 paires identiques : une suggestion n'est jamais un lien (rien n'écrit sans SON toucher : `ecritureLien` n'est
//      appelé que par le bouton « Relier » de la feuille) ; une autre marque / aucun mot de modèle commun écarte ;
//   2. le prix d'achat : celui du REÇU de CET achat (par SON n° de transaction) ; un lot n'est jamais divisé ; une saisie
//      n'est jamais écrasée ;
//   3. la garde du prix sur le prix mini : 0 / au-dessus du prix refusés ; ×10, ÷10 et sous l'achat ⇒ SA confirmation ;
//   4. UN champ (`vinted_annonce_numeros[id].min`, + la clé par N° de la ligne des réglages) atteint CHAQUE consommateur du
//      VRAI background.js : moteur des offres (`offreAutoReglages` → `reg.mins`), contre-offre (`palierContreOffre`), Agent
//      VRM (`agDecisionOffre`), offres aux favoris (`plancherFavori`), baisse par règle (`plancherBaisse`) ;
//   5. la ligne « Offres » dit ce que les moteurs feront (jamais une contre-offre sous le prix mini) ;
//   6. chaque écriture de l'app range le prix mini dans ce même champ.
//  Rejoué sous MUTATION : au moins un rouge par mutation (§6.1).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const { arbreMute, RACINE } = require('./_mutation-src.cjs');
const BG = path.join(RACINE, 'vinted-sync-extension/background.js');

async function controles(racine, bavard) {
  let ok = 0, ko = 0; const rouges = [];
  const dit = (c, m, d) => { if (c) { ok++; if (bavard) console.log('✅ ' + m); } else { ko++; rouges.push(m); if (bavard) console.log('❌ ' + m + (d ? `\n   ${String(d).slice(0, 300)}` : '')); } };
  const imp = async (f) => { try { return await import('file://' + path.join(racine, f) + '?t=' + Date.now()); } catch (e) { return null; } };
  const AP = await imp('src/publier/avantPublier.js');
  dit(!!AP, 'src/publier/avantPublier.js existe (la règle)');
  if (!AP) return { ok, ko, rouges };
  const marques = ['nike', 'adidas', 'asics', 'new balance'];
  const marqueDe = (t) => { const s = String(t || '').toLowerCase(); return marques.find((m) => s.includes(m)) || null; };
  const couleursDe = (t) => ['blanc', 'noir', 'rouge'].filter((c) => String(t || '').toLowerCase().includes(c));
  // ── 1. 50 paires identiques ──
  const achats = Array.from({ length: 50 }, (_, i) => ({ transaction_id: String(9000000 + i), title: 'Nike Air Force 1 blanc 42', date: new Date(Date.UTC(2026, 9, 1 + (i % 28))).toISOString(), price: { amount: '40.00', currency_code: 'EUR' }, status: 'Commande finalisée' }));
  achats.push({ transaction_id: '9100000', title: 'Adidas Samba blanc 42', date: '2026-10-02T10:00:00Z', price: { amount: '50', currency_code: 'EUR' }, status: 'Commande finalisée' });
  achats.push({ transaction_id: '9100001', title: 'Nike Pegasus blanc 42', date: '2026-10-02T10:00:00Z', price: { amount: '50', currency_code: 'EUR' }, status: 'Commande finalisée' });
  const cible = { titre: 'Nike Air Force 1 blanc 42', taille: '42', dateRef: '2026-11-20T10:00:00Z' };
  const r = AP.achatsARelier({ cible, achats, liens: new Map(), marqueDe, couleursDe });
  dit(r.libres.length + r.suggestions.length === 52, 'la feuille montre TOUS ses achats pas reliés (50 identiques + 2 autres)', JSON.stringify({ s: r.suggestions.length, l: r.libres.length }));
  dit(r.suggestions.length > 0 && r.suggestions.every((a) => /air force/i.test(a.title)), 'les suggestions (ressemblance) ne gardent que la même marque et un mot de modèle commun', r.suggestions.map((a) => a.title).join(' | '));
  dit(!r.suggestions.some((a) => /samba|pegasus/i.test(a.title)), 'une autre marque (Adidas) ou aucun mot de modèle commun (Pegasus) n’est jamais suggéré');
  const dates = r.libres.map((a) => Date.parse(a.date));
  dit(dates.every((d, i) => i === 0 || dates[i - 1] >= d), 'les achats pas reliés, du plus récent au plus ancien');
  const lie = new Map([[String(9000003), 1]]);
  dit(!AP.achatsARelier({ cible, achats, liens: lie, marqueDe, couleursDe }).libres.concat(AP.achatsARelier({ cible, achats, liens: lie, marqueDe, couleursDe }).suggestions).some((a) => a.transaction_id === '9000003'), 'un achat déjà relié ailleurs n’est plus proposé');
  // Rien ne relie seul : `ecritureLien` n'a qu'un appelant dans l'interface — le bouton « Relier » de la feuille.
  const ui = ['src/publier/AvantPublier.jsx', 'src/publier/AvantPublierHote.jsx', 'src/aPublier/DossierAPublier.jsx', 'src/aPublier/HoteDossier.jsx', 'src/depot/PreparerFiche.jsx'].map((f) => { try { return fs.readFileSync(path.join(racine, f), 'utf8'); } catch (_) { return ''; } }).join('\n');
  const appels = (ui.match(/ecritureLien\(/g) || []).length;
  const feuille = (() => { const t = fs.readFileSync(path.join(racine, 'src/publier/AvantPublier.jsx'), 'utf8'); const i = t.indexOf('export function RelierAchatFeuille'); return t.slice(i, t.indexOf('\nexport function', i + 10)); })();
  dit(appels === 1 && /const relier = async \(\) => \{\s*if \(!a \|\| !onRelier\) return;/.test(feuille) && /onClick=\{relier\} indisponible=\{!a\}/.test(feuille), '`ecritureLien` n’est appelé que par « Relier » (SON toucher, sur l’achat qu’il a choisi) — jamais par une suggestion', `appels=${appels}`);
  // ── 2. Le prix d'achat ──
  const a0 = achats[0];
  const recu = { source: 'recu', tx: a0.transaction_id, centimes: 4590 };
  const w = AP.ecritureLien(a0, { proposition: recu, estLot: false });
  dit(w && w.buyFromId === a0.transaction_id && w.buyPrice === '45,90' && w.buyPriceSource === 'recu', 'relié : le montant du REÇU de CET achat (45,90 €)', JSON.stringify(w));
  dit(AP.ecritureLien(a0, { proposition: { ...recu, tx: '1234567' }, estLot: false }).buyPrice === undefined, 'le reçu d’un AUTRE achat n’est jamais posé (identité)');
  dit(AP.ecritureLien(a0, { proposition: { ...recu, source: 'article' }, estLot: false }).buyPrice === undefined, 'sans reçu juste (prix de l’article seul) : rien n’est deviné — « prix d’achat à saisir »');
  const lot = AP.ecritureLien({ ...a0, title: 'Lot 3 articles' }, { proposition: recu });
  dit(lot.buyPrice === undefined && lot.buyFrom.aSaisir === true, 'un LOT n’est jamais divisé : relié, prix à saisir', JSON.stringify(lot));
  dit(AP.champsLien({ buyPrice: '30' }, w).buyPrice === undefined && AP.champsLien({ buyPrice: '0' }, w).buyPrice === undefined && AP.champsLien({}, w).buyPrice === '45,90', 'une saisie (même « 0 ») n’est jamais écrasée');
  dit(AP.etatAchat({ buyFromId: a0.transaction_id, buyPrice: '45,90', buyPriceSource: 'recu' }).etat === 'recu' && AP.etatAchat({ buyFromId: a0.transaction_id }).etat === 'a-saisir' && AP.etatAchat({ buyFromId: a0.transaction_id, buyFrom: { aSaisir: true } }).etat === 'lot', '« Acheté 45,90 € (reçu) » / « prix d’achat à saisir » / « lot : à saisir »');
  // ── 3. La garde du prix ──
  const V = (t, o) => AP.verifierMini(t, o);
  dit(V('', {}).etat === 'vide' && V('abc', {}).etat === 'illisible', 'vide ⇒ rien (jamais pré-rempli) ; illisible ⇒ dit');
  dit(V('0', { prixC: 10000 }).etat === 'refuse' && V('120', { prixC: 10000 }).etat === 'refuse', '0 € et au-dessus du prix : refusés');
  dit(V('8', { prixC: 8000 }).etat === 'confirmer' && V('800', { prixC: 8000 }).etat === 'refuse' && V('7,9', { prixC: 7900 }).etat === 'confirmer', '×10 / ÷10 du prix (faute de frappe) ⇒ SA confirmation');
  dit(V('35', { prixC: 8000, achatC: 4000 }).etat === 'confirmer' && V('35', { prixC: 8000, achatC: 4000, confirmeC: 3500 }).etat === 'ok', 'sous le prix d’achat ⇒ confirmation du chiffre exact, puis ok');
  dit(V('42', { prixC: 8000, achatC: 4000 }).etat === 'ok' && V('30', { prixC: 8000 }).etat === 'ok', 'entre l’achat et le prix : ok (un prix mini 60 % sous le prix n’est pas une faute)');
  dit(AP.indiceMini(4999) === 5500 && AP.indiceMini(null) === null, 'l’indication « achat + 10 % » (55 € pour 49,99 €) ; sans achat : aucune');
  // ── 5. La ligne « Offres » ──
  dit(AP.ligneOffres({ miniC: null }).cle === 'ap.offres.sansMini', 'sans prix mini : « rien d’automatique »');
  const lc = AP.ligneOffres({ miniC: 6000, prixC: 10000, paliers: { actif: true } });
  dit(lc.cle === 'ap.offres.contre' && lc.vars.c === 6000, 'paliers allumés : « contre-offre auto jusqu’à 60 € » (le prix mini)', JSON.stringify(lc));
  dit(AP.ligneOffres({ miniC: 6000, autoAccepte: true }).cle === 'ap.offres.accepte' && AP.ligneOffres({ miniC: 6000 }).cle === 'ap.offres.eteint', 'moteur seul : « acceptée dès 60 € » ; tout éteint : dit');
  const NP = await imp('src/negociationPaliers.js');
  if (NP) {
    let pire = Infinity; for (let o = 10; o <= 99; o += 3) { const p = NP.palierSuivant({ prix: 100, mini: 60, offre: o, joues: [], reglages: { actif: true, paliers: [50, 80, 100] } }); if (p && !p.accepter) pire = Math.min(pire, p.prix); }
    const pI = NP.palierSuivant({ prix: 100, mini: 60, offre: 20, joues: [0, 1, 2], reglages: { actif: true, intelligente: true } });
    dit(pire >= 60 && (!pI || pI.accepter || pI.prix >= 60), 'la contre-offre (paliers et intelligente) ne descend jamais sous le prix mini (60 €)', `pire=${pire} ${JSON.stringify(pI)}`);
  }
  // ── 4. Le vrai background.js ──
  let faireFond = null; try { ({ faireFond } = require('./_fond-vm.cjs')); } catch (e) { dit(false, '_fond-vm', e.message); }
  const ecrit = AP.ecritureMini(6000, Date.parse('2026-11-28T10:00:00Z'));
  dit(ecrit.min === '60' && /^2026-11-28/.test(ecrit.minAt), 'l’écriture de l’app : `min: "60"` + `minAt` (le champ des moteurs, lisible par toutes les versions)', JSON.stringify(ecrit));
  if (faireFond && fs.existsSync(BG)) {
    const lignes = { main: { vinted_offres_auto: true, vinted_offres_paliers: { actif: true, paliers: [50, 80, 100] }, vinted_annonce_numeros: { 5551: { numero: '7', ...ecrit, buyPrice: '40' }, 5552: { numero: '8' } }, vinted_buyprice_by_num: {} },
      vrm_reglages_auto: { v: 1, rev: 1, cles: { vrm_prix_mini: { v: 1, parNum: { 8: { min: 33, at: Date.now() } }, parItem: {} } } } };
    const F = faireFond({ src: BG, connecte: '111', lignes });
    const C = F.ctx;
    const reg = await C.offreAutoReglages();
    dit(reg && reg.mins && reg.mins['5551'] === 60, 'moteur des offres (`autoAccepterOffres` → `offreAutoReglages`) : le prix mini de la fiche (60 €)', JSON.stringify(reg && reg.mins));
    dit(reg && reg.mins && reg.mins['5552'] === 33, '… et le prix mini rangé PAR N° avant la publication (brouillon, Préparer) atteint l’annonce qui porte ce N° (33 €)');
    const pal = reg ? C.palierContreOffre({ prix: 100, mini: reg.mins['5551'], achat: reg.achats['5551'], nArticles: 1, offre: 30, joues: [], reglages: reg.paliers }) : null;
    dit(pal && pal.prix >= 60, 'contre-offre du fond (`palierContreOffre`, la MÊME valeur `reg.mins`) : jamais sous 60 €', JSON.stringify(pal));
    if (typeof C.agDecisionOffre === 'function') {
      const ag = C.agDecisionOffre({ agent: C.agReglage({ actif: true }), offre: 30, prix: 100, mini: reg.mins['5551'], achat: reg.achats['5551'], paliers: reg.paliers, palier: C.palierContreOffre, joues: [], note: 'ok', enVente: true, gardeOk: true });
      dit(ag && ag.geste === 'contre' && Number(ag.prix) >= 60, 'Agent VRM (`agDecisionOffre`, `reg.mins`) : n’accepte pas 30 €, ne contre-offre jamais sous 60 €', JSON.stringify(ag));
      const ag2 = C.agDecisionOffre({ agent: C.agReglage({ actif: true }), offre: 65, prix: 100, mini: reg.mins['5551'], achat: reg.achats['5551'], paliers: reg.paliers, palier: C.palierContreOffre, joues: [], note: 'ok', enVente: true, gardeOk: true });
      dit(ag2 && ag2.geste === 'accepter', 'Agent VRM : une offre AU-DESSUS du prix mini (65 €) est acceptée (son moteur allumé)', JSON.stringify(ag2));
    }
    const pf = await C.plancherFavori('5551');
    dit(pf && pf.c === 6000 && pf.de === 'mini', 'offres aux favoris (`plancherFavori`) : jamais sous 60 €', JSON.stringify(pf));
    const pb = C.plancherBaisse(lignes.main.vinted_annonce_numeros['5551'], {});
    dit(pb && pb.c === 6000 && pb.de === 'mini', 'baisse par règle (`plancherBaisse`) : plancher 60 €', JSON.stringify(pb));
  } else dit(false, 'le vrai background.js est exécuté');
  // ── 6. Chaque écriture de l'app range le prix mini dans `min` (+ `minAt`) ──
  const hote = fs.readFileSync(path.join(racine, 'src/publier/AvantPublierHote.jsx'), 'utf8');
  dit(/const w = ecritureMini\(c\);[\s\S]{0,200}k: 'vinted_annonce_numeros', type: 'champs', id: String\(itemId\), apres: w/.test(hote), 'fiche de la paire / « Publier aussi sur… » : `ecritureMini` sur la fiche de l’annonce (par identité)');
  const prep = fs.readFileSync(path.join(racine, 'src/depot/PreparerFiche.jsx'), 'utf8');
  dit(/onMini=\{\(c\) => avant\(ecritureMini\(c\)\)\}/.test(prep), '« Préparer » : `ecritureMini` (puis la clé par N° de la ligne des réglages)');
  const dos = fs.readFileSync(path.join(racine, 'src/aPublier/DossierAPublier.jsx'), 'utf8');
  dit(/modifier\(String\(b\.id\), \{ min: c == null \? '' : String\(c \/ 100\), minAt: at \}/.test(dos) && /poserMiniNum\(String\(b\.numero\), c\)/.test(dos), 'dossier : `min` + `minAt` sur le brouillon, et par N° dès qu’il en a un');
  return { ok, ko, rouges };
}

const MUTATIONS = [
  ['src/publier/avantPublier.js', "const recu = !lot && proposition && proposition.source === 'recu' && proposition.tx === tx", "const recu = proposition && proposition.source === 'recu'", 'reçu d’un autre achat / lot accepté'],
  ['src/publier/avantPublier.js', "if (lien.buyPrice != null && vide(f.buyPrice))", 'if (lien.buyPrice != null)', 'saisie écrasée'],
  ['src/publier/avantPublier.js', "const raisons = g.raisons.filter((r) => r === 'zero' || r === 'plancher' || r === 'frappe');", "const raisons = g.raisons.filter((r) => r === 'zero');", 'garde du prix muette'],
  ['src/publier/avantPublier.js', "if (p != null && c > p) return { etat: 'refuse', c, raisons: ['au-dessus'] };", '', 'prix mini au-dessus du prix accepté'],
  ['src/publier/avantPublier.js', "return { min: String(Math.round(c) / 100), minAt: at };", "return { prixMini: String(Math.round(c) / 100), minAt: at };", 'un autre champ que `min`'],
  ['src/publier/avantPublier.js', "if (contre) return { cle: autoAccepte === true ? 'ap.offres.contreEtAccepte' : 'ap.offres.contre', vars: { c: jusqua, min: miniC } };", "if (contre) return { cle: 'ap.offres.contre', vars: { c: Math.round(miniC * 0.8), min: miniC } };", 'ligne « Offres » sous le prix mini'],
];

(async () => {
  const r = await controles(RACINE, true);
  let mko = 0;
  console.log('\n— Mutations (chacune doit faire passer au moins un contrôle au rouge)');
  for (const [f, de, vers, nom] of MUTATIONS) {
    let a; try { a = arbreMute(f, de, vers); } catch (e) { console.log('❌ mutation impossible : ' + e.message); mko++; continue; }
    try { const m = await controles(a.racine, false); if (m.ko > 0) console.log(`✅ mutation « ${nom} » ⇒ ${m.ko} rouge(s) (${m.rouges[0].slice(0, 70)}…)`); else { console.log(`❌ mutation « ${nom} » : aucun contrôle ne la voit`); mko++; } }
    finally { a.nettoyer(); }
  }
  const tot = r.ko + mko;
  console.log(`\n${tot ? '❌' : '✅'} audit-publier-achat-mini : ${r.ok} verts, ${r.ko} rouge(s) ; ${MUTATIONS.length - mko}/${MUTATIONS.length} mutations vues`);
  process.exit(tot ? 1 : 0);
})();
