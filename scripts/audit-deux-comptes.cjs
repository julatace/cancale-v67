#!/usr/bin/env node
// ── audit-deux-comptes — « DEUX COMPTES, UNE PAIRE » (15 nov., lot deux-comptes) ──────────
// EXÉCUTE les VRAIES règles (src/deuxComptes.js, src/enLigneDeuxFois.js, src/memePhoto.js,
// src/bilanSynchronisation.js, src/retirerAilleurs.js), copiées dans un dossier neuf (pour les
// mutations), sur des données INVENTÉES. Ce qu'il exige :
//   · la même photo (empreinte à ≤ 12) sur DEUX comptes : UNE alerte « à vérifier » ;
//     la même photo EXACTE (identité) : « sûr » ; le même N° sur deux comptes : « à vérifier » ;
//   · 50 paires identiques (même titre, photos presque identiques entre elles, deux comptes) :
//     AUCUNE alerte — un appariement doit être unique et mutuel ; jamais le titre ;
//   · même compte : pas « deux comptes » ; compte pas relu : rien ;
//   · « Ce n'est pas la même » retire un indice, jamais une identité ;
//   · laquelle retirer : la moins aimée, sinon la plus récente ; « plutôt celle de … » change ;
//   · après SON geste : « ouverte » tant qu'aucune lecture complète, « encore en ligne » si la
//     lecture d'après la montre, « retirée ✓ relu » si elle ne la montre plus ;
//   · vendue sur le compte A, encore en ligne sur le compte B (même paire par IDENTITÉ) : en TÊTE
//     de « À retirer ailleurs », geste « à la main » (jamais retirée par VRM) ; sans identité : rien ;
//   · le geste est SON clic : la feuille n'envoie rien (aucune requête, aucune commande), le
//     retrait est un lien vers l'annonce sur vinted.fr ; l'app branche la règle et les identités.
//   node scripts/audit-deux-comptes.cjs                 la règle du dépôt
//   node scripts/audit-deux-comptes.cjs --mutation=NOM  une règle réaffaiblie
//   node scripts/audit-deux-comptes.cjs --prouve        chaque mutation doit rougir
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const FICHIERS = ['src/deuxComptes.js', 'src/memePhoto.js', 'src/photoFine.js', 'src/photoEmpreinte.js', 'src/enLigneDeuxFois.js', 'src/profilVendeur.js',
  'src/bilanSynchronisation.js', 'src/retirerAilleurs.js', 'src/photosComptes.js', 'api/_lib/numerotation.js', 'api/_lib/fetch-delai.js'];

const MUTATIONS = {
  'pas-unique': ['src/deuxComptes.js', "    if (m.size !== 1) continue;                         // proche de plusieurs annonces : rien\n", ''],
  'pas-mutuel': ['src/deuxComptes.js', "    if (!my || my.size !== 1 || !my.has(x)) continue;   // l'appariement doit être mutuel et unique\n", ''],
  'meme-compte': ['src/deuxComptes.js', [["    if ((compteDe.get(x) === compteDe.get(y)) !== memeCompte) continue;  // même compte : pas « deux comptes » (ou SEULEMENT lui)\n", ''], ["    if (new Set(annonces.map((a) => a.uid)).size < 2) return;   // le risque est entre DEUX comptes\n", '']]],
  'seuil-large': ['src/deuxComptes.js', 'refus = {}, choix = {}, cle = cleDefaut, seuil = SEUIL_MEME_PHOTO } = {}) {', 'refus = {}, choix = {}, cle = cleDefaut, seuil = 16 } = {}) {'],
  'empreinte-sure': ['src/deuxComptes.js', "poser(x.ids, 'verifier', ['empreinte'], null, x.distance);", "poser(x.ids, 'sur', ['empreinte'], null, x.distance);"],
  'refus-ignore': ['src/deuxComptes.js', "    if (g.etat !== 'sur' && R[g.id]) continue;", '    if (false) continue;'],
  'refus-cache-sur': ['src/deuxComptes.js', "    if (g.etat !== 'sur' && R[g.id]) continue;", '    if (R[g.id]) continue;'],
  'pas-lus': ['src/deuxComptes.js', "    if (photos.comptesLus && photos.comptesLus[cc] === false) continue;   // compte pas relu : il ne conclut rien\n", ''],
  'par-titre': ['src/deuxComptes.js', "  for (const x of apparieParEmpreinte(photos, { seuil })) poser(x.ids, 'verifier', ['empreinte'], null, x.distance);",
    "  for (const x of apparieParEmpreinte(photos, { seuil })) poser(x.ids, 'verifier', ['empreinte'], null, x.distance);\n  { const t = new Map(); for (const [id] of (photos && photos.annonces ? photos.annonces.map((a) => [String(a.id), a]) : [])) { const i = infoDe(id); if (!i) continue; const k = String(i.titre).toLowerCase(); if (t.has(k) && infoDe(t.get(k)).uid !== i.uid) poser([t.get(k), id], 'verifier', ['titre']); else t.set(k, id); } }"],
  'numero-trois': ['src/deuxComptes.js', "    if (vint.length !== 2 || new Set(vint.map((a) => a.uid)).size !== 2) continue;", "    if (vint.length < 2) continue;"],
  'garder-plus-recente': ['src/deuxComptes.js', '  if (fini(a.depuis) && fini(b.depuis) && a.depuis !== b.depuis) return a.depuis - b.depuis;', '  if (fini(a.depuis) && fini(b.depuis) && a.depuis !== b.depuis) return b.depuis - a.depuis;'],
  'encore-ignore': ['src/deuxComptes.js', "  if (fini(luAt) && luAt > at) return { etat: 'encore', lu: luAt };\n", ''],
  'reglee-sans-relu': ['src/deuxComptes.js', '    if (fini(lu) && lu > at && !enLigne(String(id)))', '    if (!enLigne(String(id)))'],
  'vente-meme-site': ['src/bilanSynchronisation.js', '(v.plateforme === "Vinted" && a.plateforme === "Vinted" && memePaire(v.id, a.id))', '(v.plateforme === "Vinted" && a.plateforme === "Vinted" && String(v.id) !== String(a.id))'],
  'meme-ignore': ['src/bilanSynchronisation.js', '(v.plateforme === "Vinted" && a.plateforme === "Vinted" && memePaire(v.id, a.id))', 'false'],
  'photo-trois': ['src/deuxComptes.js', '  for (const ids of parPhoto.values()) if (ids.length === 2) out.push(ids);', '  for (const ids of parPhoto.values()) if (ids.length >= 2) out.push(ids.slice(0, 2));'],
  'tete-ignoree': ['src/retirerAilleurs.js', "    .sort((a, b) => (a.deuxComptes === b.deuxComptes ? 0 : a.deuxComptes ? -1 : 1) || String(a.numero)", '    .sort((a, b) => String(a.numero)'],
  'app-sans-memes': ['app', '    return { numeros, annonces, ventes, manques, completes, memes };', '    return { numeros, annonces, ventes, manques, completes };'],
  'feuille-supprime': ['feuille', "onClick={() => onOuvrir && onOuvrir(cible, g)}>", "onClick={() => { onOuvrir && onOuvrir(cible, g); try { window.postMessage({ vmrCmd: 'supprimer', id: cible.id }, '*'); } catch (_) {} }}>"],
};

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌/gm) || []).length;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (r.status !== 0 && rouges) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

(async () => {
  let ko = 0, n = 0;
  const dit = (c, m, d) => { n++; if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d != null && !c ? ' — ' + String(d).slice(0, 300) : '')); };
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : ' + e.message); } };
  // Les sources, copiées (et mutées) dans un dossier neuf.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-deux-comptes-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  const sources = {};
  for (const f of FICHIERS) { const p = path.join(RACINE, f); sources[f] = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
  let appSrc = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const feuilleP = path.join(RACINE, 'src', 'DeuxComptes.jsx');
  let feuilleSrc = fs.existsSync(feuilleP) ? fs.readFileSync(feuilleP, 'utf8') : '';
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    for (const [a, b] of Array.isArray(m[1]) ? m[1] : [[m[1], m[2]]]) {
      const cible = m[0] === 'app' ? appSrc : m[0] === 'feuille' ? feuilleSrc : sources[m[0]];
      if (!cible || !cible.includes(a)) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
      if (m[0] === 'app') appSrc = appSrc.replace(a, b); else if (m[0] === 'feuille') feuilleSrc = feuilleSrc.replace(a, b); else sources[m[0]] = sources[m[0]].replace(a, b);
    }
  }
  for (const [f, s] of Object.entries(sources)) { if (s == null) continue; fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), s); }
  const charge = async (f) => { if (sources[f] == null) { dit(false, f + ' absent'); return null; } try { return await import(pathToFileURL(path.join(dir, f)).href); } catch (e) { dit(false, f + ' ne se charge pas : ' + e.message); return null; } };
  const D = await charge('src/deuxComptes.js');
  const E = await charge('src/enLigneDeuxFois.js');
  const B = await charge('src/bilanSynchronisation.js');
  const RA = await charge('src/retirerAilleurs.js');
  const PH = await charge('src/photosComptes.js');
  if (!D || !E || !B || !RA || !PH) { console.log(`\n${n - ko}/${n} contrôles verts`); process.exit(1); }

  // ── Les données inventées ─────────────────────────────────────────────────
  const MAINT = Date.parse('2026-11-15T12:00:00Z'), H = 3600e3;
  let graine = 7;
  const hasard = () => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine; };
  const hexAuHasard = () => Array.from({ length: 96 }, () => ((hasard() >> 16) % 16).toString(16)).join('');
  // Une empreinte à `k` bits d'une autre (dans chacun des 6 blocs : la distance réelle reste petite).
  const voisine = (h, k) => { const c = h.split(''); for (let i = 0; i < k; i++) { const p = (hasard() >> 12) % 96; c[p] = (parseInt(c[p], 16) ^ 1).toString(16); } return c.join(''); };
  // Une empreinte à une distance RÉGLÉE d'une autre : `k` bits changés dans CHACUN des 6 blocs (aux positions
  // `debut`, `debut+1`…) ⇒ distance = k + k / 2 (la règle prend le meilleur recadrage de chaque mesure).
  const decale = (h, k, debut = 0) => { const c = h.split(''); for (let b = 0; b < 6; b++) for (let i = 0; i < k; i++) { const p = b * 16 + ((debut + i) % 16); c[p] = (parseInt(c[p], 16) ^ 1).toString(16); } return c.join(''); };
  const ph = (id) => `https://images1.vinted.net/t/05_${id}/f800/1700${id}.jpeg?s=x`;
  const cle = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
  // Un monde : des comptes, des annonces EN LIGNE { id, uid, titre, numero, h (empreinte), photoK?, favoris, depuis, prix }.
  function monde(annonces, o = {}) {
    const comptes = [...new Set(annonces.map((a) => a.uid))];
    const vinted = comptes.map((uid) => ({ uid, nom: 'compte_' + uid, ok: true, lu: (o.lu && o.lu[uid] != null) ? o.lu[uid] : MAINT - 2 * H,
      enLigne: annonces.filter((a) => a.uid === uid).map((a) => ({ id: a.id, title: a.titre, photo: ph(a.id), url: `https://www.vinted.fr/items/${a.id}-x`, price: { amount: String(a.prix || 80) } })) }));
    const fiches = {};
    for (const a of annonces) fiches[a.id] = { numero: a.numero || '', ...(a.photoK ? { photoK: a.photoK } : {}), ...(a.recreeDe ? { recreeDe: a.recreeDe } : {}) };
    const enLigneDeux = E.enLigneDeuxFois({ vinted, fiches, clePhoto: (u) => String(u).split('?')[0].replace(/\/f\d+\//, '/'), cle, maintenant: MAINT, memes: o.memes || null });
    const empreintes = {};
    for (const a of annonces) { if (!a.h) continue; const cc = 'vinted:' + a.uid; (empreintes[cc] = empreintes[cc] || {})[a.id] = { [ph(a.id).split('?')[0]]: a.h }; }
    const base = PH.annoncesPourPhotos(vinted, { verdict: (c) => E.raisonPasSu(c, MAINT), numeroDe: (id) => fiches[id] ? fiches[id].numero : '' });
    const photos = PH.calculerPhotosComptes({ ...base, empreintes: o.empreintesKo ? null : empreintes });
    const info = new Map(annonces.map((a) => [a.id, { uid: a.uid, nom: 'compte_' + a.uid, titre: a.titre, photo: ph(a.id), url: `https://www.vinted.fr/items/${a.id}-x`, numero: a.numero || '', prix: a.prix || 80, depuis: a.depuis != null ? a.depuis : null, favoris: a.favoris != null ? a.favoris : null }]));
    const res = D.groupesDeuxComptes({ enLigneDeux, photos, infoDe: (id) => info.get(String(id)) || null, refus: o.refus || {}, choix: o.choix || {}, cle });
    return { res, enLigneDeux, photos, fiches };
  }

  await essaie('A · même photo sur deux comptes', () => {
    const h = hexAuHasard();
    const r = monde([{ id: '101', uid: 'nord', titre: 'Dunk', numero: '42', h, favoris: 9, depuis: MAINT - 9 * 24 * H }, { id: '202', uid: 'sud', titre: 'Autre', numero: '57', h: voisine(h, 3), favoris: 2, depuis: MAINT - 2 * 24 * H }]).res;
    const g = r.groupes[0];
    dit(r.pret && r.groupes.length === 1 && g.etat === 'verifier' && g.preuves.join() === 'empreinte', 'la même photo (empreinte proche) sur deux comptes : UNE alerte « à vérifier »', JSON.stringify(r.groupes));
    dit(g && g.garder.id === '101' && g.retirer.length === 1 && g.retirer[0].id === '202', 'on GARDE la plus aimée (9 favoris), on retire l’autre', g && JSON.stringify({ g: g.garder.id, r: g.retirer.map((x) => x.id) }));
    dit(g && g.annonces.every((a) => a.prix === 80 && Number.isFinite(a.depuis) && a.nom.startsWith('compte_')), 'chaque annonce dit son compte, son prix, depuis quand');
    const r2 = monde([{ id: '101', uid: 'nord', titre: 'Dunk', numero: '42', h }, { id: '202', uid: 'nord', titre: 'Dunk', numero: '57', h: voisine(h, 3) }]).res;
    dit(r2.groupes.length === 0, 'la même photo deux fois sur UN compte : pas « deux comptes »', JSON.stringify(r2.groupes));
    const r3 = monde([{ id: '101', uid: 'nord', titre: 'Dunk', numero: '42', h }, { id: '202', uid: 'sud', titre: 'Dunk', numero: '57', h: hexAuHasard() }]).res;
    dit(r3.groupes.length === 0, 'deux photos différentes (même titre) : rien', JSON.stringify(r3.groupes));
    const r4 = monde([{ id: '101', uid: 'nord', numero: '42', h, favoris: 2, depuis: MAINT - 9 * 24 * H }, { id: '202', uid: 'sud', numero: '57', h: voisine(h, 3), favoris: 2, depuis: MAINT - 2 * 24 * H }]).res;
    dit(r4.groupes[0] && r4.groupes[0].garder.id === '101', 'à favoris égaux : on garde la plus ANCIENNE en ligne', r4.groupes[0] && r4.groupes[0].garder.id);
    const r5 = monde([{ id: '101', uid: 'nord', numero: '42', h, favoris: 9 }, { id: '202', uid: 'sud', numero: '57', h: voisine(h, 3), favoris: 2 }], { choix: { '101+202': '101' } }).res;
    dit(r5.groupes[0] && r5.groupes[0].retirer[0].id === '101', '« plutôt celle de … » : SON choix change laquelle retirer', r5.groupes[0] && r5.groupes[0].retirer[0].id);
  });

  await essaie('B · 50 paires identiques', () => {
    const base = hexAuHasard(), l = [];
    for (let i = 0; i < 50; i++) l.push({ id: String(5000 + i), uid: i % 2 ? 'nord' : 'sud', titre: 'Nike Dunk Low Panda 42', numero: String(100 + i), h: voisine(base, 4) });
    const r = monde(l).res;
    dit(r.groupes.length === 0, '50 paires identiques photographiées au même endroit (photos toutes proches), deux comptes : AUCUNE alerte', JSON.stringify(r.groupes.slice(0, 2)));
    const l2 = [];
    for (let i = 0; i < 50; i++) l2.push({ id: String(6000 + i), uid: i % 2 ? 'nord' : 'sud', titre: 'Nike Dunk Low Panda 42', numero: String(200 + i), h: hexAuHasard() });
    const r2 = monde(l2).res;
    dit(r2.groupes.length === 0, '50 paires au même titre, photos différentes : AUCUNE alerte (jamais le titre)', JSON.stringify(r2.groupes.slice(0, 2)));
    const vraie = hexAuHasard();
    const r3 = monde([...l2, { id: '7001', uid: 'nord', titre: 'Nike Dunk Low Panda 42', numero: '300', h: vraie }, { id: '7002', uid: 'sud', titre: 'Nike Dunk Low Panda 42', numero: '301', h: voisine(vraie, 2) }]).res;
    dit(r3.groupes.length === 1 && r3.groupes[0].id === '7001+7002', 'parmi les 50, la SEULE vraie même photo sur deux comptes : exactement une alerte', JSON.stringify(r3.groupes.map((g) => g.id)));
    const r4 = monde([...l, { id: '7001', uid: 'nord', numero: '300', h: base }, { id: '7002', uid: 'sud', numero: '301', h: voisine(base, 1) }]).res;
    dit(r4.groupes.length === 0, 'une photo proche de plusieurs annonces (série identique) : rien — mieux vaut un blanc qu’un faux', JSON.stringify(r4.groupes.map((g) => g.id)));
  });

  await essaie('B2 · appariement unique, mutuel, au seuil strict', () => {
    const A = hexAuHasard(), Bh = decale(A, 5, 0), Ch = decale(Bh, 5, 8);
    const r = monde([{ id: '901', uid: 'nord', numero: '1', h: A }, { id: '902', uid: 'sud', numero: '2', h: Bh }, { id: '903', uid: 'nord', numero: '3', h: Ch }]).res;
    dit(r.groupes.length === 0, 'une annonce proche de DEUX autres (A–B et B–C) : aucune alerte, même pour A seule avec B', JSON.stringify(r.groupes.map((g) => g.id)));
    const r2 = monde([{ id: '911', uid: 'nord', numero: '1', h: A }, { id: '912', uid: 'sud', numero: '2', h: decale(A, 10, 0) }]).res;
    dit(r2.groupes.length === 0, 'deux photos à 15 (au-dessus du seuil strict de 12, sous l’ancien 16) : aucune alerte', JSON.stringify(r2.groupes.map((g) => g.id)));
    const r3 = monde([{ id: '921', uid: 'nord', numero: '1', h: A }, { id: '922', uid: 'sud', numero: '2', h: decale(A, 8, 0) }]).res;
    dit(r3.groupes.length === 1 && r3.groupes[0].distance === 12, 'deux photos à 12 (le seuil) : une alerte', JSON.stringify(r3.groupes.map((g) => [g.id, g.distance])));
  });

  await essaie('C · identités (sûr) et N°', () => {
    const r = monde([{ id: '301', uid: 'nord', numero: '12', photoK: '05_k/1' }, { id: '302', uid: 'sud', numero: '40', photoK: '05_k/1' }]).res;
    dit(r.groupes.length === 1 && r.groupes[0].etat === 'sur' && r.groupes[0].preuves.includes('photo'), 'la même PHOTO EXACTE (fiches) sur deux comptes : « sûr »', JSON.stringify(r.groupes));
    const rR = monde([{ id: '311', uid: 'nord', numero: '7' }, { id: '312', uid: 'sud', numero: '7', recreeDe: '311' }]).res;
    dit(rR.groupes.length === 1 && rR.groupes[0].etat === 'sur' && rR.groupes[0].preuves.includes('recree'), 'recréée par VRM (`recreeDe`) sur un autre compte : « sûr »', JSON.stringify(rR.groupes));
    const rF = monde([{ id: '321', uid: 'nord', numero: '8' }, { id: '322', uid: 'sud', numero: '9' }], { memes: [['321', '322']] }).res;
    dit(rF.groupes.length === 1 && rF.groupes[0].etat === 'sur' && rF.groupes[0].preuves.includes('fusion'), 'deux fiches qu’IL a fusionnées : « sûr »', JSON.stringify(rF.groupes));
    const rM = monde([{ id: '331', uid: 'nord', numero: '33', photoK: '05_m/1' }, { id: '332', uid: 'nord', numero: '34', photoK: '05_m/1' }]).res;
    dit(rM.groupes.length === 0, 'même photo exacte sur UN compte : reste « en ligne deux fois », pas ici', JSON.stringify(rM.groupes));
    const rN = monde([{ id: '341', uid: 'nord', numero: '50' }, { id: '342', uid: 'sud', numero: '050' }]).res;
    dit(rN.groupes.length === 1 && rN.groupes[0].etat === 'verifier' && rN.groupes[0].preuves.join() === 'numero', 'le même N° (« 50 » = « 050 ») sur deux comptes : « à vérifier », jamais sûr', JSON.stringify(rN.groupes));
    const rN3 = monde([{ id: '351', uid: 'nord', numero: '60' }, { id: '352', uid: 'sud', numero: '60' }, { id: '353', uid: 'est', numero: '60' }]).res;
    dit(rN3.groupes.length === 0, 'trois annonces sous un N° : VRM ne choisit pas (le rouge le dit)', JSON.stringify(rN3.groupes));
    const h = hexAuHasard();
    const rX = monde([{ id: '361', uid: 'nord', numero: '70', h }, { id: '362', uid: 'sud', numero: '70', h: voisine(h, 2) }]).res;
    dit(rX.groupes.length === 1 && rX.groupes[0].preuves.join() === 'empreinte,numero' && rX.groupes[0].etat === 'verifier', 'même N° ET photo proche : un groupe, deux indices, toujours « à vérifier »', JSON.stringify(rX.groupes));
  });

  await essaie('D · refus, comptes pas lus', () => {
    const h = hexAuHasard();
    const deux = [{ id: '401', uid: 'nord', numero: '1', h }, { id: '402', uid: 'sud', numero: '2', h: voisine(h, 2) }];
    dit(monde(deux, { refus: { '401+402': '2026-11-15' } }).res.groupes.length === 0, '« Ce n’est pas la même » : l’indice ne revient plus');
    const s = [{ id: '411', uid: 'nord', numero: '3', photoK: '05_s/1' }, { id: '412', uid: 'sud', numero: '4', photoK: '05_s/1' }];
    dit(monde(s, { refus: { '411+412': '2026-11-15' } }).res.groupes.length === 1, '… mais un refus ne cache JAMAIS une identité prouvée');
    const r = monde(deux, { lu: { sud: MAINT - 30 * H } }).res;
    dit(r.groupes.length === 0 && r.manque.some((m) => m.uid === 'sud'), 'un compte lu il y a 30 h ne conclut rien, et il est nommé', JSON.stringify({ g: r.groupes.length, m: r.manque }));
    const r2 = monde(deux, { empreintesKo: true }).res;
    dit(r2.groupes.length === 0, 'empreintes pas lues : aucun indice inventé');
  });

  await essaie('E · après son geste', () => {
    const at = MAINT - H;
    dit(D.etatRetrait(null, MAINT).etat === 'aRetirer', 'sans marque : à retirer');
    dit(D.etatRetrait({ at }, MAINT - 2 * H, MAINT).etat === 'ouverte', 'ouverte, aucune lecture depuis : « VRM relira »');
    dit(D.etatRetrait({ at }, null, MAINT).etat === 'ouverte', 'ouverte, compte jamais relu : « VRM relira » (jamais « retirée »)');
    dit(D.etatRetrait({ at }, MAINT - 10 * 60e3, MAINT).etat === 'encore', 'une lecture complète APRÈS la montre encore : « encore en ligne »');
    dit(D.etatRetrait({ at: MAINT - 8 * 24 * H }, MAINT, MAINT).etat === 'aRetirer', 'une marque de plus de 7 jours ne dit plus rien');
    const m = { 501: { at, uid: 'sud', nom: 'compte_sud', numero: '42' }, 502: { at, uid: 'est' } };
    const rg = D.reglees(m, { enLigne: (id) => id === '502', luDe: (uid) => (uid === 'sud' ? MAINT - 10 * 60e3 : MAINT - 2 * H), maintenant: MAINT });
    dit(rg.length === 1 && rg[0].id === '501', '« retirée ✓ relu » seulement si une lecture APRÈS son geste ne la montre plus', JSON.stringify(rg));
    const rg2 = D.reglees({ 503: { at, uid: 'sud' } }, { enLigne: () => false, luDe: () => MAINT - 2 * H, maintenant: MAINT });
    dit(rg2.length === 0, 'absente mais lecture d’AVANT son geste : pas « retirée »', JSON.stringify(rg2));
  });

  await essaie('F · vendue sur un compte, encore en ligne sur l’autre', () => {
    const fiches = { 601: { numero: '42', photoK: '05_v/1' }, 602: { numero: '42', photoK: '05_v/1' } };
    const memes = D.memesPairesFiches(fiches, []);
    dit(memes.length === 1 && memes[0].sort().join() === '601,602', 'la même photo exacte de deux fiches : une identité', JSON.stringify(memes));
    const data = { numeros: fiches, ventes: [{ id: '601', numero: '42', plateforme: 'Vinted', engagee: true }],
      annonces: [{ id: '601', numero: '42', plateforme: 'Vinted', compte: 'nord', active: false, capture: MAINT - H }, { id: '602', numero: '42', plateforme: 'Vinted', compte: 'sud', compteNom: 'compte_sud', active: true, capture: MAINT - H, lien: 'https://www.vinted.fr/items/602' }] };
    const avec = B.articlesVendusAilleurs({ ...data, memes });
    dit(avec.lignes.length === 1 && avec.lignes[0].id === '602' && !avec.lignes[0].aConfirmer, 'vendue sur le compte nord ⇒ l’annonce du compte sud est « à retirer »', JSON.stringify(avec));
    const sans = B.articlesVendusAilleurs(data);
    dit(sans.lignes.length === 0, 'sans identité (même N° seul) : rien — mieux vaut un blanc qu’un faux', JSON.stringify(sans.lignes));
    const plan = RA.planRetirerAilleurs({ lignes: [...avec.lignes, { id: 'L1', numero: '7', plateforme: 'Leboncoin', compte: 'c', active: true, capture: MAINT - H, ventes: [{ plateforme: 'eBay' }] }] }, { maintenant: MAINT, lbcOk: true });
    dit(plan.articles[0] && plan.articles[0].numero === '42' && plan.articles[0].deuxComptes === true, 'elle passe en TÊTE de « À retirer ailleurs » (avant le N°7)', JSON.stringify(plan.articles.map((a) => a.numero)));
    const s = plan.articles[0] && plan.articles[0].sites[0];
    dit(s && s.plateforme === 'Vinted' && s.voie === 'main' && s.code === 'vinted', 'le geste reste à LUI (« retire-la sur Vinted ») — VRM ne supprime jamais une annonce Vinted', JSON.stringify(s));
    // 50 paires identiques : aucune identité, aucune ligne.
    const f50 = {}, a50 = [], v50 = [];
    for (let i = 0; i < 50; i++) { const id = String(8000 + i); f50[id] = { numero: String(i + 1), photoK: `05_p${i}/1` }; a50.push({ id, numero: String(i + 1), plateforme: 'Vinted', compte: i % 2 ? 'nord' : 'sud', active: i % 2 === 0, capture: MAINT - H }); if (i % 2) v50.push({ id, numero: String(i + 1), plateforme: 'Vinted', engagee: true }); }
    const r50 = B.articlesVendusAilleurs({ numeros: f50, ventes: v50, annonces: a50, memes: D.memesPairesFiches(f50) });
    dit(r50.lignes.length === 0, '50 paires identiques, la moitié vendue : AUCUNE à retirer (aucune identité commune)', JSON.stringify(r50.lignes.slice(0, 2)));
    const trois = D.memesPairesFiches({ 1: { photoK: 'x/1' }, 2: { photoK: 'x/1' }, 3: { photoK: 'x/1' } });
    dit(trois.length === 0, 'trois fiches au même fichier ne disent pas laquelle : aucune identité', JSON.stringify(trois));
  });

  await essaie('G · le geste est le sien, et l’app est branchée', () => {
    const sans = (s) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    const f = sans(feuilleSrc);
    dit(!!f && !/fetch\(|vmrCmd|postMessage|envoyer\(|sendMessage|DELETE|\/delete/i.test(f), 'la feuille n’envoie RIEN (aucune requête, aucune commande, aucune suppression)');
    dit(/className="sb-touche dc-retirer" href=\{lienVinted\(cible\)\} target="_blank"/.test(feuilleSrc), '« Retirer celle de … » est un LIEN vers l’annonce sur vinted.fr (il la retire lui-même)');
    dit(/https:\/\/www\.vinted\.fr\/items\//.test(sources['src/deuxComptes.js'] || ''), 'le lien vise vinted.fr/items/{id}');
    const app = sans(appSrc);
    dit(/groupesDeuxComptes\(\{ enLigneDeux, photos: photosComptes, infoDe:/.test(app), 'l’app passe par la règle, avec les annonces EN LIGNE d’`enLigneDeux` et les empreintes');
    dit(/return \{ numeros, annonces, ventes, manques, completes, memes \};/.test(app) && /const memes = memesPairesFiches\(numeros, pairesFusionnees\(/.test(app), '« À retirer ailleurs » reçoit les IDENTITÉS (photo exacte, recreeDe, fusions)');
    dit(/data-journee-deux-comptes=/.test(app) && /\(deuxComptesJ\.length \? 1 : 0\)/.test(app), 'Ma journée : une carte, comptée dans les gestes');
    dit(/<DeuxComptesAlerte res=\{deuxComptes\}/.test(app) && /<VersAFaire><DeuxComptesAlerte/.test(app), 'Annonces : une ligne dans « À faire »');
    dit(/autreInitial=\{fusionDeux\[1\]\}/.test(app), '« C’est la même paire » ouvre la fusion EXISTANTE (aperçu, SON clic)');
    const gestes = app.slice(app.indexOf('const ouvrirRetraitDeux'), app.indexOf('const deuxComptesTexte'));
    dit(!!gestes && !/vmrCmd|envoyerCmd|sendMessage|fetch\(/.test(gestes), 'les gestes de l’app notent seulement l’heure (aucune commande à l’extension)');
  });

  console.log(`\n${n - ko}/${n} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
