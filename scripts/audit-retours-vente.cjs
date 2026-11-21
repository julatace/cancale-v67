#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE SUIVI DES RETOURS DE VENTES (21 nov., lot 77 ; audit-retours-suivi.cjs = les retours d'ACHATS, 15 nov.) : identité du colis retour, N° gardé, CA retiré une fois,
//  rien de « reçu » sans preuve. EXÉCUTE les vraies règles (api/_lib/retour-vente-suivi.js, src/retoursStock.js,
//  src/contenuColis.js, api/_lib/ventes-regle.js) sur des données INVENTÉES (aucune ligne de sa base).
//
//  Puis la preuve par MUTATION : chaque règle est réaffaiblie dans une copie (dossier temporaire) et l'audit relancé
//  dessus — chaque mutation DOIT rendre l'audit rouge (`--sans-mutations` pour ne lancer que les contrôles).
//    aller      la ligne qui porte un n° de l'ALLER est prise pour le retour ;
//    date       une étape datée AVANT le début du retour compte ;
//    absence    « pas de ligne lue » vaut « arrivé » ;
//    partage    un n° porté par deux retours est pris ;
//    numero     la remise en stock donne un N° neuf ;
//    livree     « livrée selon Vinted » (ambigu) vaut « arrivé » ;
//    contenu    un colis à retirer est dit « retour » sans le n° exact.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const DOSSIER = process.env.AUDIT_RETOURS_DOSSIER || RACINE;   // une copie mutée, sinon le dépôt

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 400) : '')); } };
const imp = (rel) => import(pathToFileURL(path.join(DOSSIER, rel)).href);

const J = 864e5, T0 = Date.parse('2026-11-21T10:00:00Z');
const ISO = (j) => new Date(T0 - j * J).toISOString();

async function controles() {
  const R = await imp('api/_lib/retour-vente-suivi.js');
  const S = await imp('src/retoursStock.js');
  const C = await imp('src/contenuColis.js');
  const V = await imp('api/_lib/ventes-regle.js');
  const { suiviRetourVente, numeroDuRetour, numerosPartages, retoursEnRoute } = R;

  console.log('\n── 1. Le n° du retour : par identité, jamais l’aller');
  const debut = ISO(5);
  const luAller = { suivi: '80380675', sv: '80380675', etapes: [{ t: 'Colis livré', at: ISO(8) }] };
  const a = numeroDuRetour({ lu: luAller, aller: ['80380675'], retourLe: debut });
  dit(a.raison === 'aller' && a.suivi === '', `une ligne qui porte le n° de l’ALLER n’est pas le retour (${a.raison})`, a);
  const b = numeroDuRetour({ lu: { suivi: '80999111', etapes: [{ t: 'Colis livré', at: ISO(8) }] }, aller: [], retourLe: debut });
  dit(b.raison === 'pas-prouve' && b.suivi === '', `aller inconnu, étapes d’AVANT le retour seulement : rien n’est pris (${b.raison})`, b);
  const c = numeroDuRetour({ lu: { suivi: '80999111', etapes: [{ t: 'Colis déposé en point relais', at: ISO(3) }] }, aller: [], retourLe: debut });
  dit(c.raison === 'lu' && c.suivi === '80999111', `une étape datée APRÈS le début du retour : le n° est pris (${c.suivi})`, c);
  const d = numeroDuRetour({ lu: { suivi: '80999112', etapes: [] }, aller: ['80380675'], retourLe: null });
  dit(d.raison === 'lu' && d.suivi === '80999112', `aller connu et disjoint : le n° est pris (${d.suivi})`, d);
  const P = numerosPartages([{ suivi: '81111111' }, { suivi: '81111111' }, { suivi: '82222222' }]);
  const e = numeroDuRetour({ lu: { suivi: '81111111', etapes: [{ t: 'En transit', at: ISO(1) }] }, aller: ['X1234567'], retourLe: debut, partages: P });
  dit(e.raison === 'partage' && !e.suivi, `un n° porté par DEUX retours : ni l’un ni l’autre (${e.raison})`, e);
  const deuxN = numeroDuRetour({ lu: { suivi: '83333333', sc: '84444444', sv: '83333333,84444444', etapes: [] }, aller: ['X1234567'] });
  dit(deuxN.suivi === '84444444' && deuxN.numeros.length === 2, `deux transporteurs : le n° COURANT est dit, les deux relient (${deuxN.suivi})`, deuxN);

  console.log('\n── 2. Les étapes du colis qui revient');
  const ligne = { etape: 'en-route', retourLe: debut, recu: false };
  const s0 = suiviRetourVente({ ligne: { etape: 'initie', retourLe: debut }, lu: null });
  dit(s0.etape === 'accepte' && !s0.suivi && s0.raison === 'pas-de-ligne' && !s0.arrive, `rien lu : « Retour accepté », « suivi pas encore lu », jamais arrivé (${s0.etape})`, s0);
  const sE = suiviRetourVente({ ligne, lu: null });
  dit(sE.etape === 'expedie' && !sE.arrive, `Vinted dit « déposé » : « Expédié par l’acheteur » (${sE.etape})`, sE);
  const luT = { suivi: '80999111', transporteur: 'Mondial Relay', etapes: [{ t: 'Colis pris en charge', at: ISO(3) }, { t: 'Livré', at: ISO(9) }] };
  const sT = suiviRetourVente({ ligne, lu: luT, aller: ['80380675'] });
  dit(sT.etape === 'transit' && !sT.arrive, `« pris en charge » après le début ; « Livré » d’AVANT ignoré (${sT.etape}, arrivé ${sT.arrive})`, sT);
  const track = [{ suivi: '80999111', status: 'available', receivedAt: ISO(1), code: '482913', lieu: 'Tabac du Port', limite: '2026-11-28', carrier: 'mondialrelay' }];
  const sP = suiviRetourVente({ ligne, lu: luT, aller: ['80380675'], track });
  dit(sP.etape === 'point' && sP.point && sP.point.code === '482913' && !sP.arrive, `e-mail « disponible » du MÊME n° : au point, code LU (${sP.point && sP.point.code})`, sP);
  const trackAutre = [{ suivi: '80999119', status: 'delivered', receivedAt: ISO(0.5) }];
  const sX = suiviRetourVente({ ligne, lu: luT, aller: ['80380675'], track: trackAutre });
  dit(!sX.arrive, 'un e-mail « livré » d’un AUTRE n° ne fait rien', sX);
  const sA = suiviRetourVente({ ligne, lu: luT, aller: ['80380675'], track: [...track, { suivi: '80999111', status: 'delivered', receivedAt: ISO(0.2), retireLe: ISO(0.2) }] });
  dit(sA.arrive && sA.arriveSource === 'email' && sA.etape === 'arrive', `e-mail « retiré » du même n° : ARRIVÉ, prouvé (${sA.arriveSource})`, sA);
  const sV = suiviRetourVente({ ligne: { ...ligne, livreeSelonVinted: true }, lu: null });
  dit(!sV.arrive, '« Commande livrée ! » de Vinted seul (ambigu) n’est jamais « arrivé »', sV);
  const sAllerLivre = suiviRetourVente({ ligne, lu: { suivi: '80380675', etapes: [{ t: 'Colis livré', at: ISO(1) }] }, aller: ['80380675'] });
  dit(!sAllerLivre.arrive && sAllerLivre.raison === 'aller', 'le colis d’ORIGINE « livré » n’est pas le retour arrivé', sAllerLivre);
  const er = retoursEnRoute([sE, sT, sP, sA, s0]);
  dit(er.n === 3 && er.auPoint === 1, `« Retours en route » : 3 qui roulent, 1 au point (${er.n}/${er.auPoint})`, er);

  console.log('\n── 3. 50 retours IDENTIQUES : seul le n° exact désigne');
  const ventes = [], numeros = {}, txnItem = {}, etats = {}, L = {};
  for (let i = 0; i < 50; i++) {
    const tx = String(23000000000 + i), it = String(7800000000 + i);
    ventes.push({ transaction_id: tx, title: 'Nike Dunk Low gris taille 42', status: 'Retour initié', date: ISO(10), transaction_user_status: 'waiting', price: { amount: '60.0' }, _acc: { vinted_user_id: '1' } });
    txnItem[tx] = it; numeros[it] = { numero: String(400 + i), title: 'Nike Dunk Low gris taille 42' };
    etats[tx] = { s: 440, ss: 'colis déposé en bureau de Poste ou point relais', su: debut };
    L[tx] = { suivi: String(85000000 + i), etapes: [{ t: 'Colis pris en charge', at: ISO(2) }] };
  }
  const trk = [{ suivi: '85000017', status: 'delivered', receivedAt: ISO(0.3), retireLe: ISO(0.3) }];
  const parts = numerosPartages(Object.values(L));
  const presentes = new Set();
  const res = S.retoursEnCours({ ventes, etats: (tx) => etats[tx] || null, txnItem, numeros, numeroVente: () => null, recus: {}, remis: {}, masques: {}, republiee: () => false,
    ebay: [], maintenant: T0, presentes, cleNum: (n) => String(n).toUpperCase(), estArchive: () => false,
    suiviDe: (l) => suiviRetourVente({ ligne: l, lu: L[l.tx] || null, aller: [], track: trk, partages: parts }) });
  dit(res.remises.length === 1 && res.remises[0].tx === '23000000017', `un seul revenu, le bon (${res.remises.map((x) => x.tx).join(',')})`);
  dit(res.lignes.length === 49 && res.lignes.every((l) => !l.recu), `les 49 autres restent « en route », aucun « reçu » (${res.lignes.filter((l) => l.recu).length})`);

  console.log('\n── 4. Le N° est GARDÉ (jamais un neuf), un conflit n’est jamais tranché');
  const r17 = res.remises[0];
  dit(r17 && r17.remis && r17.remis.num === '417' && r17.remis.auto === true && r17.recuPreuve === 'email', `revenu sous SON N° 417, preuve e-mail (${r17 && r17.remis && r17.remis.num})`, r17 && r17.remis);
  const presentes2 = new Set(['9999']); const numeros2 = { ...numeros, 9999: { numero: '417', title: 'autre paire' } };
  const res2 = S.retoursEnCours({ ventes, etats: (tx) => etats[tx] || null, txnItem, numeros: numeros2, numeroVente: () => null, recus: {}, remis: {}, masques: {}, republiee: () => false,
    ebay: [], maintenant: T0, presentes: presentes2, cleNum: (n) => String(n).toUpperCase(), estArchive: () => false,
    suiviDe: (l) => suiviRetourVente({ ligne: l, lu: L[l.tx] || null, aller: [], track: trk, partages: parts }) });
  const c17 = res2.remises[0];
  dit(c17 && c17.remis && c17.remis.num === null && c17.remis.conflit === '9999', `N° 417 porté par une paire PRÉSENTE : en stock SANS N°, rien deviné (${c17 && c17.remis && c17.remis.num})`, c17 && c17.remis);
  const sansSuivi = S.retoursEnCours({ ventes, etats: (tx) => etats[tx] || null, txnItem, numeros, numeroVente: () => null, recus: {}, remis: {}, masques: {}, republiee: () => false,
    ebay: [], maintenant: T0, presentes, cleNum: (n) => String(n), estArchive: () => false });
  dit(sansSuivi.remises.length === 0 && sansSuivi.lignes.length === 50, 'sans suivi lu : aucun « reçu », rien en stock (jamais par absence)');

  console.log('\n── 5. Le CA : la vente retournée sort UNE fois, la remise n’y change rien');
  const finalisee = { transaction_id: '23000000017', title: 'Nike', status: 'Commande finalisée - l’acheteur a validé la commande', date: ISO(20), price: { amount: '60.0' }, _acc: { vinted_user_id: '1' } };
  const autre = { transaction_id: '23100000001', title: 'Adidas', status: 'Commande finalisée - l’acheteur a validé la commande', date: ISO(20), price: { amount: '40.0' }, _acc: { vinted_user_id: '1' } };
  const somme = (x) => x.lignes.reduce((t, l) => t + (Number(l.eur) || 0), 0);
  const avant = somme(V.ventesFaites({ vinted: [finalisee, autre] }));
  const apres = somme(V.ventesFaites({ vinted: [{ ...finalisee, status: 'Retour initié' }, autre] }));
  const apresRemb = V.ventesFaites({ vinted: [{ ...finalisee, status: 'Remboursement effectué', transaction_user_status: 'failed' }, autre] });
  dit(avant === 100 && apres === 40 && somme(apresRemb) === 40 && apresRemb.lignes.every((l) => l.eur > 0), `vendu 100 € ⇒ 40 € après le retour, jamais une ligne négative (${avant} ⇒ ${apres})`);
  const vers = { '23000000017': ISO(15), '23100000001': ISO(15) };
  const dec = V.ventesDeclarables({ vinted: [{ ...finalisee, status: 'Retour initié' }, autre], versements: vers });
  dit(somme(dec) === 40 && !dec.lignes.some((l) => /23000000017/.test(l.id)), `CA déclaré : la vente retournée n’y est pas (${somme(dec)} €)`);

  console.log('\n── 6. Achats › À retirer : « Retour de ta vente » par le n° exact seulement');
  const cRet = C.contenuDuColis({ ligne: { suivi: '85000017' }, suivi: '85000017', retourVente: { tx: '23000000017', titre: 'Nike Dunk Low gris taille 42', num: '417' } });
  dit(cRet && cRet.etat === 'retour' && cRet.num === '417', `le colis du n° du retour : « Retour de ta vente · N°417 » (${cRet && cRet.etat})`, cRet);
  const cRien = C.contenuDuColis({ ligne: { suivi: '85000099' }, suivi: '85000099', retourVente: null });
  dit(cRien && cRien.etat === 'pas-lu', `un autre n° : rien n’est dit « retour » (${cRien && cRien.etat})`, cRien);
  const trT = (k, v) => (k === 'achats.contenu.retourNum' ? `Retour de ta vente · N°${v.num}` : k);
  dit(C.texteContenu(cRet, trT) === 'Retour de ta vente · N°417', 'la phrase dit le N° de la paire (jamais un neuf)');
}

const MUTATIONS = {
  aller: ['api/_lib/retour-vente-suivi.js', "if (N.some((n) => A.has(n))) return { numeros: [], suivi: '', raison: 'aller' };", ''],
  date: ['api/_lib/retour-vente-suivi.js', "if (debut != null ? !(m != null && m >= debut) : !A.size) continue;", ''],
  absence: ['api/_lib/retour-vente-suivi.js', "arrive: !!preuve,", "arrive: !!preuve || id.raison !== 'lu',"],
  partage: ['api/_lib/retour-vente-suivi.js', 'const libres = N.filter((n) => !P.has(n));', 'const libres = N;'],
  numero: ['src/retoursStock.js', "return { ok: true, num: String(ligne.num),", "return { ok: true, num: String(Number(ligne.num) + 1000),"],
  livree: ['api/_lib/retour-vente-suivi.js', "if (l.recu) faits.push(", "if (l.recu || l.livreeSelonVinted) faits.push("],
  contenu: ['src/contenuColis.js', "if (!normaliserSuivi(suivi)) return null;", "if (!normaliserSuivi(suivi)) return null; if (suivi) return { etat: 'retour', tx: '1', titre: '', num: '', photo: null };"],
};

function copieMutee(nom) {
  const [fichier, avant, apres] = MUTATIONS[nom];
  const dos = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-retours-vente-'));
  for (const rel of ['api/_lib', 'src']) fs.mkdirSync(path.join(dos, rel), { recursive: true });
  // Les modules exécutés et ce qu'ils importent (relatifs) : copiés tels quels.
  const copier = (rel) => { const d = path.join(dos, rel); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(RACINE, rel), d); };
  for (const f of fs.readdirSync(path.join(RACINE, 'api/_lib'))) if (f.endsWith('.js')) copier('api/_lib/' + f);
  for (const f of ['retoursStock.js', 'contenuColis.js', 'liensColis.js']) copier('src/' + f);
  // ce que liensColis.js importe à son tour
  const src = fs.readFileSync(path.join(RACINE, 'src/liensColis.js'), 'utf8');
  for (const m of src.matchAll(/from\s+'\.\/([^']+)'/g)) { try { copier('src/' + m[1]); } catch (_) {} }
  fs.writeFileSync(path.join(dos, 'package.json'), '{"type":"module"}');
  const p = path.join(dos, fichier); const t = fs.readFileSync(p, 'utf8');
  if (!t.includes(avant)) throw new Error(`mutation ${nom} : le texte n'est plus là (${fichier})`);
  fs.writeFileSync(p, t.replace(avant, apres));
  return dos;
}

(async () => {
  console.log(`audit-retours-vente${DOSSIER !== RACINE ? ' — COPIE MUTÉE ' + (process.env.AUDIT_RETOURS_MUTATION || '') : ''}`);
  try { await controles(); } catch (e) { ko++; console.log('  ❌ exception : ' + (e && e.stack || e).toString().slice(0, 600)); }
  console.log(`\n${ok} verts, ${ko} rouges`);
  if (DOSSIER !== RACINE || process.argv.includes('--sans-mutations')) process.exit(ko ? 1 : 0);
  if (ko) process.exit(1);
  console.log('\n── Mutations (chacune doit rendre l’audit rouge)');
  let survivantes = 0;
  for (const nom of Object.keys(MUTATIONS)) {
    let dos; try { dos = copieMutee(nom); } catch (e) { console.log(`  ❌ ${nom} : ${e.message}`); survivantes++; continue; }
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RETOURS_DOSSIER: dos, AUDIT_RETOURS_MUTATION: nom }, encoding: 'utf8' });
    const rouges = ((r.stdout || '').match(/❌/g) || []).length;
    if (r.status !== 0 && rouges > 0) console.log(`  ✅ mutation « ${nom} » ⇒ rouge (${rouges})`);
    else { survivantes++; console.log(`  ❌ mutation « ${nom} » a SURVÉCU`); }
    fs.rmSync(dos, { recursive: true, force: true });
  }
  console.log(survivantes ? `\n❌ ${survivantes} mutation(s) survivante(s)` : '\n✅ audit-retours-vente : tout est vert, chaque mutation est prise');
  process.exit(survivantes ? 1 : 0);
})();
