#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE DOSSIER « À PUBLIER » (28 nov. 2026, src/aPublier/dossier.js)
//  « dès que c'est publié, le site comprend que ce sont les photos qu'on avait reliées à un achat » ; « étiqueter avant ».
//  Exécute la RÈGLE (module pur) ET le vrai morceau de numérotation de Comptabilite (bloc <numerotation-passage>,
//  scripts/_numerotation-vm.cjs) :
//   1. 50 articles identiques (même titre, même taille, même marque) : seule l'identité de PHOTO relie, chacun au sien ;
//   2. une photo ré-encodée par Vinted (≤ 8) relie ; plus loin (9–16) : ambigu, rien ; le même fichier dans deux brouillons,
//      deux annonces pour un brouillon, une annonce créée avant le brouillon : rien n'est relié seul ;
//   3. le titre n'entre jamais dans la règle (titres échangés ⇒ mêmes liens) ;
//   4. les N° : le prochain libre (du plus haut, jamais un trou), 50 brouillons ⇒ 50 N° distincts, un brouillon retiré garde
//      son N° (jamais redonné), publier ne renumérote pas, aucun doublon créé ;
//   5. la numérotation : l'annonce reprend le N° du brouillon (jamais un second), attend sans empreinte ou si ambigu,
//      un brouillon sans N° ⇒ N° neuf + l'héritage (achat, prix mini) ; le brouillon passe dans « Publiées ».
//  Chaque contrôle est rejoué sous MUTATION (seuils, sens unique, date, N°) : au moins un rouge par mutation (§6.1).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_source-app.cjs').brancher();
const path = require('path'), fs = require('fs');
const { charger, passageAvec, empreinte, voisine } = require('./_numerotation-vm.cjs');
const { arbreMute, RACINE } = require('./_mutation-src.cjs');

async function controles(racine, bavard) {
  let ok = 0, ko = 0; const rouges = [];
  const dit = (c, m, d) => { if (c) { ok++; if (bavard) console.log('✅ ' + m); } else { ko++; rouges.push(m); if (bavard) console.log('❌ ' + m + (d ? `\n   ${String(d).slice(0, 300)}` : '')); } };
  const imp = async (f) => { try { return await import('file://' + path.join(racine, f) + '?t=' + Date.now()); } catch (e) { return null; } };
  const D = await imp('src/aPublier/dossier.js');
  dit(!!D, 'src/aPublier/dossier.js existe (la règle du dossier)');
  if (!D) return { ok, ko, rouges };
  const MAINT = Date.now(), iso = (ms) => new Date(ms).toISOString();
  const cle = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
  const br = (i, o = {}) => ({ id: 'd' + i, creeAt: iso(MAINT - 3 * 3600e3), titre: 'Nike Air Force 1 blanche 42', taille: '42', dossier: { v: 1, creeAt: iso(MAINT - 3 * 3600e3), cle: 'dd' + i,
    photos: [{ id: 'p' + i, h: (i.toString(16).padStart(2, '0')).repeat(32), e: empreinte(1000 + i), ec: '' }] }, ...o });

  // ── 1. 50 articles identiques ──
  const B = Array.from({ length: 50 }, (_, i) => br(i));
  const A = Array.from({ length: 50 }, (_, i) => ({ id: String(20000000 + i), numero: String(300 + i), titre: 'Nike Air Force 1 blanche 42', creee: MAINT - 3600e3, hexes: [voisine(B[i].dossier.photos[0].e, 3, 6, i + 1)] }));
  const c = D.correspondance({ brouillons: B, annonces: A, cle });
  const bons = c.liens.filter((l) => l.annonce === String(20000000 + Number(l.brouillon.slice(1))) && l.de === 'photo').length;
  dit(c.liens.length === 50 && bons === 50 && !Object.keys(c.ambigus).length, '50 articles identiques : chacun relié à SA seule annonce, par sa photo', JSON.stringify({ n: c.liens.length, bons, amb: Object.keys(c.ambigus).length }));
  const melange = D.correspondance({ brouillons: B.map((b, i) => ({ ...b, titre: 'Titre ' + ((i * 7) % 50), taille: String(36 + (i % 10)) })), annonces: A.map((a, i) => ({ ...a, titre: 'Titre ' + i })), cle });
  dit(JSON.stringify(melange.liens) === JSON.stringify(c.liens), 'le titre et la taille n’entrent jamais dans la règle (changés : mêmes liens)');
  const sansPhoto = D.correspondance({ brouillons: B, annonces: A.map((a) => ({ ...a, hexes: [] })), cle });
  dit(!sansPhoto.liens.length, '50 identiques SANS photo lue : rien n’est relié (jamais par le titre)');

  // ── 2. Ré-encodage, ambiguïtés ──
  const b0 = br(0), h0 = b0.dossier.photos[0].e;
  const un = (hexes, o = {}) => D.correspondance({ brouillons: o.B || [b0], annonces: o.A || [{ id: '1', numero: '400', creee: MAINT - 3600e3, hexes }], cle });
  dit(un([voisine(h0, 4, 6, 9)]).liens.length === 1, 'photo ré-encodée par Vinted (distance 7) ⇒ reliée');
  const loin = un([voisine(h0, 8, 8, 9)]);
  dit(!loin.liens.length && (loin.ambigus.d0 || []).length === 1, 'distance 12 (entre 8 et 16) ⇒ rien n’est relié, « Publiée ? Relie-la » propose l’annonce', JSON.stringify(loin));
  dit(!un([voisine(h0, 20, 20, 9)]).liens.length && !Object.keys(un([voisine(h0, 20, 20, 9)]).ambigus).length, 'une autre photo (≥ 19) ⇒ rien, rien proposé');
  const memeFichier = { ...br(1), dossier: { ...br(1).dossier, photos: [{ ...b0.dossier.photos[0], id: 'px' }] } };
  const dbl = un([voisine(h0, 1, 2, 9)], { B: [b0, memeFichier] });
  dit(!dbl.liens.length && D.fichiersEnDouble([b0, memeFichier]).size === 1, 'le MÊME fichier dans deux brouillons : rien n’est relié seul, le doublon est dit', JSON.stringify(dbl));
  const deux = un(null, { A: [{ id: '1', numero: '400', creee: MAINT - 3600e3, hexes: [voisine(h0, 2, 2, 1)] }, { id: '2', numero: '401', creee: MAINT - 3600e3, hexes: [voisine(h0, 2, 2, 2)] }] });
  dit(!deux.liens.length && (deux.ambigus.d0 || []).length === 2, 'deux annonces pour un brouillon : rien n’est relié, il choisit', JSON.stringify(deux));
  const avant = un(null, { A: [{ id: '1', numero: '400', creee: MAINT - 10 * 3600e3, hexes: [voisine(h0, 2, 2, 1)] }] });
  dit(!avant.liens.length, 'une annonce créée AVANT le brouillon n’est jamais reliée seule');
  const dateInconnue = un(null, { A: [{ id: '1', numero: '400', creee: null, hexes: [voisine(h0, 2, 2, 1)] }] });
  dit(!dateInconnue.liens.length, 'date de mise en ligne inconnue : pas su ⇒ rien de relié seul');
  const retire = D.correspondance({ brouillons: [{ ...b0, retireeAt: iso(MAINT) }], annonces: [{ id: '1', numero: '400', creee: MAINT, hexes: [h0] }], cle });
  dit(!retire.liens.length, 'un brouillon retiré ne prend jamais une annonce');
  const parNum = D.correspondance({ brouillons: [{ ...b0, numero: '12' }], annonces: [{ id: '1', numero: '12', creee: MAINT, hexes: [] }, { id: '2', numero: '13', creee: MAINT, hexes: [h0] }], cle });
  dit(parNum.liens.length === 1 && parNum.liens[0].annonce === '1' && parNum.liens[0].de === 'numero', 'un brouillon NUMÉROTÉ est relié par son N° (l’identité), pas par une autre annonce à la même photo', JSON.stringify(parNum));
  // Héritage : un champ posé n'est jamais écrasé.
  const h = D.heritage({ id: 'd0', buyFromId: '7777777', buyFrom: { title: 'x' }, min: '60', minAt: iso(MAINT) }, { buyFromId: '', buyPrice: '45', min: '', minAt: '' });
  dit(h.buyFromId === '7777777' && h.min === '60' && h.buyPrice === undefined, 'l’annonce hérite de l’achat et du prix mini ; son prix d’achat saisi n’est pas touché', JSON.stringify(h));
  const h2 = D.heritage({ id: 'd0', buyFromId: '7777777', min: '60', minAt: iso(MAINT - 86400e3) }, { buyFromId: '1234567', min: '70', minAt: iso(MAINT) });
  dit(h2.buyFromId === undefined && h2.min === undefined, 'un achat déjà relié et un prix mini plus récent sur l’annonce restent les siens', JSON.stringify(h2));
  // Regroupement : SON geste ; la proposition ne s'applique pas seule.
  const ph = [{ id: 'a', t: 1000 }, { id: 'b', t: 2000 }, { id: 'c', t: 2000 + 3600e3 }, { id: 'd', t: 2001 + 3600e3 }];
  dit(D.decouper(ph, new Set()).length === 1 && D.decouper(ph, new Set([2])).length === 2, '« 1 sélection = 1 article » ; SA coupure fait deux articles');
  dit([...D.proposerCoupures(ph)].join() === '2', 'la proposition par heure coupe là où une heure sépare deux prises (une proposition, rendue à part)');
  const g = D.brouillonsDeGroupes([[ph[0]], [ph[1]]], { idDe: (i) => 'n' + i });
  dit(g.length === 2 && g.every((x) => !x.fiche.numero && !x.fiche.buyFromId && x.fiche.min === undefined), 'un brouillon naît SANS N°, sans achat, sans prix mini (rien de deviné)');

  // ── 4. Les N° ──
  const L = await charger(racine);
  const A0 = L.A || {};
  const prochainLibre = A0.prochainLibre;
  const RA = await imp('src/rangementArrivee.js');
  dit(typeof prochainLibre === 'function' && RA && typeof RA.numerosEnSerie === 'function', 'les règles des N° de l’app (prochainLibre, numerosEnSerie) sont chargées');
  if (typeof prochainLibre === 'function' && RA) {
    const pool = [1, 2, 3, 4, 6, 7, 8, 9, 10];                  // 5 est un TROU (peut être écrit sur un carton)
    const neuves = { r: { ...br(90), numero: '11', retireeAt: iso(MAINT) }, ...Object.fromEntries(B.map((b) => [b.id, b])) };
    const pris = { int: new Set([...pool, 11]), cles: new Set([...pool, 11].map(String)) };
    const r = D.numerosPourBrouillons(B.map((b) => b.id), neuves, (n, deja) => RA.numerosEnSerie({ pris: D.prisAvec(pris, deja, cle), pref: '', n, prochainLibre, cleNum: cle }));
    const l = r.ok ? Object.values(r.numeros) : [];
    dit(r.ok && l.length === 50 && new Set(l).size === 50, '50 brouillons ⇒ 50 N° distincts', JSON.stringify(r).slice(0, 200));
    dit(l[0] === '12' && l[49] === '61', 'le prochain libre, du plus haut : 12 à 61 (jamais le trou 5, jamais le 11 d’un brouillon retiré)', l.slice(0, 3).join(','));
    dit(!l.includes('5') && !l.includes('11'), 'un N° retiré ou un trou n’est jamais redonné');
    const deja = D.numerosPourBrouillons(['r', 'd0'], { ...neuves, d0: { ...B[0], numero: '40' } }, () => ['99']);
    dit(deja.ok && !Object.keys(deja.numeros).length, 'un brouillon qui a déjà son N° le garde ; un brouillon retiré n’en reçoit pas', JSON.stringify(deja));
  }

  // ── 5. La numérotation (le vrai morceau de Comptabilite) ──
  dit(!!L.corps && !L.manque.length && !!L.DP, 'la numérotation et le dossier sont chargés');
  if (L.corps && !L.manque.length && L.DP) {
    const U = '3156028798', acc = { vinted_user_id: U };
    const ann = (id, o = {}) => ({ id: String(id), title: 'Nike Air Force 1 blanche 42', photo: `https://images1.vinted.net/t/02_${id}/f800/${id}.jpeg`, _acc: acc, t: MAINT - 3600e3, ...o });
    const pool = Array.from({ length: 216 }, (_, i) => i + 1);
    const hb = empreinte(4242);
    const brN = { ...br(5), id: 'dn', numero: '217', buyFromId: '8888888', buyFrom: { title: 'achat' }, min: '60', minAt: iso(MAINT - 3600e3), dossier: { v: 1, creeAt: iso(MAINT - 3 * 3600e3), cle: 'ddn', photos: [{ id: 'q', h: 'ab'.repeat(32), e: hb, ec: '' }] } };
    const poolN = [...pool, 217];
    const base = (o = {}) => ({ items: [ann('30000001')], fiches: {}, pool: poolN, complets: { [U]: true }, lues: { [U]: MAINT - 60e3 },
      store: { vrm_fiches_neuves: { dn: brN }, ...(o.store || {}) }, empreintes: { [`vinted:${U}`]: { 30000001: o.h === undefined ? { k: voisine(hb, 3, 4, 2) } : o.h } }, ...(o.x || {}) });
    const P = (x) => { const r = passageAvec(L, x); if (r.erreur) dit(false, 'le morceau s’exécute', r.erreur); return r; };
    const n = (r, id) => (r.fiches && r.fiches[id] && r.fiches[id].numero) || null;
    const r1 = P(base());
    dit(n(r1, '30000001') === '217' && !r1.pool.includes(218), 'publiée à la main : l’annonce reconnue par la photo prend le N°217 du brouillon — aucun N° neuf brûlé', JSON.stringify({ f: r1.fiches['30000001'], p: r1.pool.slice(-2) }));
    dit(r1.fiches['30000001'] && r1.fiches['30000001'].buyFromId === '8888888' && r1.fiches['30000001'].min === '60', '… et hérite de l’achat relié et du prix mini du brouillon', JSON.stringify(r1.fiches['30000001']));
    dit(r1.brouillons && r1.brouillons.dn && r1.brouillons.dn.publiee && r1.brouillons.dn.publiee.id === '30000001', '… le brouillon passe dans « Publiées » avec l’annonce qu’il est devenu', JSON.stringify(r1.brouillons));
    if (!(r1.brouillons && r1.brouillons.dn)) return { ok, ko, rouges };
    const r1b = P({ ...base(), fiches: r1.fiches, store: { vrm_fiches_neuves: { dn: { ...brN, publiee: r1.brouillons.dn.publiee } } } });
    if (!(r1.brouillons && r1.brouillons.dn)) return { ok, ko, rouges };
    dit(n(r1b, '30000001') === '217' && !r1b.pool.includes(218), 'le passage suivant ne renumérote pas (publier ne change jamais un N°)');
    const r2 = P(base({ h: {} }));
    dit(!n(r2, '30000001') && (r2.attente || []).includes('30000001'), 'empreinte pas encore lue : l’annonce ATTEND (pas de second N°)', JSON.stringify(r2.fiches['30000001']));
    const r3 = P(base({ h: {}, store: { vrm_republie_attente: { 30000001: iso(MAINT - 25 * 3600e3) } } }));
    dit(n(r3, '30000001') === '218', '… au-delà de 24 h : la règle normale (N° neuf)', JSON.stringify(r3.fiches['30000001']));
    const brN2 = { ...brN, id: 'dn2', numero: '219', dossier: { ...brN.dossier, cle: 'ddn2', photos: [{ id: 'q2', h: 'cd'.repeat(32), e: voisine(hb, 2, 2, 7), ec: '' }] } };
    const r4 = P(base({ store: { vrm_fiches_neuves: { dn: brN, dn2: brN2 } }, x: { pool: [...poolN, 218, 219] } }));
    dit(!n(r4, '30000001') && (r4.attente || []).includes('30000001'), 'deux brouillons à la même photo : rien n’est pris, l’annonce attend son choix', JSON.stringify(r4.fiches['30000001']));
    const r5 = P(base({ x: { items: [ann('30000001'), ann('30000002')], fiches: { 30000002: { numero: '217', accountId: U, auto: true } } } }));
    dit(n(r5, '30000001') !== '217', 'N°217 déjà porté par une autre annonce présente : jamais deux paires sous un N° (aucun doublon créé)', JSON.stringify(r5.fiches['30000001']));
    const brSans = { ...brN, numero: undefined, id: 'ds' }; delete brSans.numero;
    const r6 = P(base({ store: { vrm_fiches_neuves: { ds: brSans } } }));
    dit(n(r6, '30000001') === '218' && r6.fiches['30000001'].buyFromId === '8888888' && r6.brouillons && r6.brouillons.ds, 'brouillon sans N° : l’annonce reçoit un N° neuf, hérite de l’achat, le brouillon est publié', JSON.stringify({ f: r6.fiches['30000001'], b: r6.brouillons }));
    const r7 = P(base({ h: { k: empreinte(999) } }));
    dit(n(r7, '30000001') === '218' && !(r7.brouillons && r7.brouillons.dn), 'une autre photo : la règle normale, le brouillon reste « À publier »');
  }
  // ── 6. L'app : un seul chemin de N°, pool d'abord ──
  const app = fs.readFileSync(path.join(racine, 'src/App.jsx'), 'utf8');
  const fn = app.slice(app.indexOf('async function donnerNumerosBrouillons'), app.indexOf('export { donnerNumerosBrouillons }'));
  dit(/numerosServisLus\(\)/.test(fn) && /numerosEnSerie\(\{ pris: prisAvec\(pris, deja, cleNum\), pref: prefixeNumeros\(\), n, prochainLibre, cleNum \}\)/.test(fn), '« Donner un N° » passe par numerosServisLus + numerosEnSerie (aucun second compteur)');
  dit(fn.indexOf("save('vinted_used_numeros'") > 0 && fn.indexOf("save('vinted_used_numeros'") < fn.indexOf("save('vrm_fiches_neuves'"), '… le pool append-only est écrit AVANT les fiches');
  return { ok, ko, rouges };
}

const MUTATIONS = [
  ['src/aPublier/dossier.js', 'export const SEUIL_LIE = SEUIL_PHOTO_VRM;', 'export const SEUIL_LIE = 30;', 'seuil de lien relâché à 30'],
  ['src/aPublier/dossier.js', 'l.length === 1 && l[0].sur && apres(l[0].a)', 'l.length >= 1 && apres(l[0].a)', 'deux annonces pour un brouillon acceptées'],
  ['src/aPublier/dossier.js', "const apres = (a) => Number.isFinite(Number(a.creee)) && Number(a.creee) > 0 && Number(a.creee) + MARGE_CREE_MS >= t0;", 'const apres = () => true;', 'date de création ignorée'],
  ['src/aPublier/dossier.js', 'if (r.proches.length !== 1 || r.voisins.length !== 1) return attendre', 'if (r.proches.length < 1) return attendre', 'ambiguïté ignorée à la numérotation'],
  ['src/aPublier/dossier.js', "if (!H.length) return attendre('empreintes');", 'if (!H.length) return null;', 'pas d’attente sans empreinte'],
  ['src/aPublier/dossier.js', "filter((f) => estBrouillon(f) && !f.retireeAt && !objet(f.publiee))", 'filter((f) => estBrouillon(f) && !objet(f.publiee))', 'brouillon retiré gardé'],
  ['src/aPublier/dossier.js', '&& !str(T[id].numero) && !T[id].retireeAt', '&& !T[id].retireeAt', 'N° redonné à un brouillon qui en a un'],
  ['src/aPublier/dossier.js', 'const k = Math.min(SERIE_MAX, sans.length - l.length);\n    const p = serie(k, l.slice());', 'const k = Math.min(SERIE_MAX, sans.length - l.length);\n    const p = serie(k, []);', 'paquets sans les N° déjà donnés'],
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
  console.log(`\n${tot ? '❌' : '✅'} audit-dossier-a-publier : ${r.ok} verts, ${r.ko} rouge(s) ; ${MUTATIONS.length - mko}/${MUTATIONS.length} mutations vues`);
  process.exit(tot ? 1 : 0);
})();
