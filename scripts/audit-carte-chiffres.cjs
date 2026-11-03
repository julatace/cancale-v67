// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LA CARTE SOMBRE RÉGLABLE PAR PAGE DIT LES CHIFFRES DE LEURS RÈGLES
//         node scripts/audit-carte-chiffres.cjs [--mutation=site|recalc|zero|benef|recu|compte|aumoins]
// ═══════════════════════════════════════════════════════════════════════════
// Julien, 3 nov. : « je veux juste le CA, le bénéfice etc. dans cette case
// sombre sur chaque onglet », « modifiable en fonction de ce qu'on a
// sélectionné ». La carte (src/design/carteChiffres.js) ne doit RIEN
// recalculer : chaque chiffre vient de sa règle propriétaire, et suit la
// sélection (site, compte, période) sans jamais inventer un 0.
//
// Cet audit EXÉCUTE le module et les vraies fonctions d'App.jsx (extraites,
// dans un vm) sur des ventes INVENTÉES (le dépôt est public), et compare, pour
// chaque chiffre du catalogue et chaque sélection site × compte × période :
//   1. la valeur de la carte = celle de la RÈGLE PROPRIÉTAIRE (resumeVendu pour
//      « aujourd'hui » et « ce mois » de Ma journée, caParPeriodes de Compta,
//      bilanLignes de Ventes, rythmeVendu de Statistiques, beneficePeriode /
//      chiffreBenefice de Compta, beneficeDesJours / chiffreBrut, la lecture du
//      reçu du widget `recuDuMoisPublie`, les publications de Colis) ;
//   2. la même valeur calculée ICI À LA MAIN depuis les ventes inventées ;
//   3. « — » (null) quand ce n'est pas su ou que le chiffre n'a pas de sens
//      pour la sélection (bénéfice par site, URSSAF par compte), jamais 0 ;
//      « au moins » seulement avec un manque nommé, jamais « au moins 0 » ;
//   4. le réglage : une page ne touche pas les autres, un chiffre inconnu
//      retombe sur le défaut, jamais deux fois le même nombre sur une carte ;
//   5. le branchement (lu dans App.jsx) : les règles passées sont les
//      propriétaires, `bilanVentes` de Ventes passe par la même `bilanLignes`,
//      le réglage est synchronisé, chaque page monte SA carte.
// `--mutation=…` réaffaiblit la règle dans une copie : rouge exigé.
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; if (!c || process.env.BAVARD) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
let APP = lire('src/App.jsx');
let MODULE = lire('src/design/carteChiffres.js');
const muter = (avant, apres) => {
  if (!MODULE.includes(avant)) { console.log('❌ mutation impossible : motif absent — ' + avant.slice(0, 90)); process.exit(2); }
  MODULE = MODULE.replace(avant, apres);
};
// Le site n'est plus filtré : Vinted dit le vendu de tous les sites.
if (MUT === 'site') muter("const garde = (l) => (!plateforme || l.plateforme === plateforme)", "const garde = (l) => (true)");
// Une somme refaite à part (les lignes du mois civil en UTC, sans la règle de Ventes).
else if (MUT === 'recalc') muter("const r = regles.bilanLignes(lignes, B.de, B.a == null ? null : B.a - 1);", "const r = { n: lignes.filter((l) => new Date(l.ts).toISOString().slice(0, 7) === new Date(B.de).toISOString().slice(0, 7)).length, eur: lignes.filter((l) => new Date(l.ts).toISOString().slice(0, 7) === new Date(B.de).toISOString().slice(0, 7)).reduce((t, l) => t + l.eur, 0) };");
// « Pas su » rendu 0.
else if (MUT === 'zero') muter("if (!V || !Array.isArray(V.lignes)) return vide('pasSu', { p });", "if (!V || !Array.isArray(V.lignes)) return { valeur: 0, partiel: false, manque: [], hors: '', p };");
// Le « bénéfice » de la carte glisse au brut.
else if (MUT === 'benef') muter("if (id === 'benefice') { const CB = regles.chiffreBenefice(Bn, etat);", "if (id === 'benefice') { const CB = regles.chiffreBrut(Bn);");
// Le reçu d'une ligne publiée il y a dix jours compte encore.
else if (MUT === 'recu') muter("if (ymParis(at) !== ym || maintenant - at > RECU_MAX_AGE_MS)", "if (ymParis(at) !== ym)");
// Le compte n'est plus filtré.
else if (MUT === 'compte') muter("(!login || (l.plateforme === 'Vinted' && String(l.compte || '') === login))", "(true)");
// « Au moins 0 € » se dit.
else if (MUT === 'aumoins') muter("if (partiel && !(val > 0)) return vide('partiel', { p, manque: [...manque, ...nc.map((x) => x.plateforme)] });", "");
else if (MUT) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }

const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
function extraire(src, nom) {
  const m = new RegExp(`^(?:export )?(?:async )?function ${nom}\\(|^(?:export )?const ${nom}\\s*=\\s*`, 'm').exec(src);
  if (!m) return '';
  const estFn = /function/.test(m[0]); let prof = 0, vuCorps = false;
  for (let i = m.index; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') { prof--; if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1); }
    else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1);
  }
  return '';
}
const charger = async (texte, nom) => {
  const tmp = path.join(os.tmpdir(), `${nom}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, texte);
  try { return await import('file://' + tmp); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
};
const proche = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(Number(a) - Number(b)) < 0.005);

(async () => {
  console.log('── Le module, les règles d’App.jsx, la lecture du widget');
  let M = null;
  if (MODULE) { try { M = await charger(MODULE, 'carte-chiffres'); } catch (e) { dit(false, 'src/design/carteChiffres.js se charge', e.message); } }
  dit(!!M && typeof M.valeursCarte === 'function' && typeof M.valeurChiffre === 'function', 'le module de la carte existe (src/design/carteChiffres.js)');
  const N = await charger(lire('src/beneficeNoms.js'), 'benefice-noms');
  const SV = await charger(lire('src/statsVentes.js'), 'stats-ventes');

  const NOMS = ['bilanLignes', 'resumeVendu', 'BENEF_CHAMPS', 'beneficeVide', 'ajouterVenteBenefice', 'jourBeneficeEnTableau', 'cumulerBenefice', 'resumeBenefice', 'jourClef', 'beneficeDesJours',
    'ymCourant', 'debutPeriode', 'decalerPeriode', 'MOIS_COMPTA', 'libellePeriodeCa', 'caParPeriodes', 'echeancesAbonnement', 'chargeAbonnement', 'comptaChargesMois', 'comptaChargesAnnee',
    'caVintedDuMois', 'caBeneficeDuMois', 'aPayerUrssaf', 'depensesEtat', 'beneficePeriode', 'beneficeDe'];
  const ctx = { Date, Math, Number, String, Object, Array, JSON, Set, isFinite, parseFloat, isNaN, tauxUrssaf: () => 12.4, urssafConcerne: (r) => r === 'micro', console };
  vm.createContext(ctx);
  const absents = [];
  for (const n of NOMS) { const t = extraire(APP, n); if (!t) { absents.push(n); continue; } try { vm.runInContext(t.replace(/^const /, 'var ') + `\n;this.${n} = ${n};`, ctx); } catch (e) { absents.push(n + ' (' + e.message + ')'); } }
  dit(!absents.length, 'les règles propriétaires se lisent dans App.jsx', absents.join(', '));
  // La lecture du reçu du widget de l'iPhone (api/widget.js), la même ligne publiée.
  const W = lire('api/widget.js');
  const wctx = { Date, Number, Object, isFinite, Math };
  vm.createContext(wctx);
  try { vm.runInContext(extraire(W, 'RECU_MAX_AGE_MS').replace(/^export const /, 'var ') + '\n' + extraire(W, 'recuDuMoisPublie').replace(/^export /, '') + '\n;this.recuDuMoisPublie = recuDuMoisPublie;', wctx); } catch (e) { dit(false, 'recuDuMoisPublie (api/widget.js) se lit', e.message); }
  if (!M || absents.length) { console.log(`\n❌ carte-chiffres : ${ko} rouge(s), ${ok} vert(s)`); process.exit(1); }

  // ── Les données inventées ─────────────────────────────────────────────────
  // Réf. : mercredi 18 novembre 2026, 15 h (heure de l'appareil).
  const MAINT = new Date(2026, 10, 18, 15).getTime();
  const T = (m, j, h = 12) => new Date(2026, m, j, h).getTime();
  // Les lignes de `ventesFaites` : { plateforme, ts, eur, compte }.
  const LIGNES = [
    { plateforme: 'Vinted', ts: T(10, 18, 9), eur: 45.5, compte: 'alice' },
    { plateforme: 'Vinted', ts: T(10, 17, 20), eur: 60, compte: 'bruno' },
    { plateforme: 'Vinted', ts: T(10, 16, 10), eur: 32.9, compte: 'alice' },     // lundi : même semaine
    { plateforme: 'Vinted', ts: T(10, 15, 23), eur: 18, compte: 'alice' },       // dimanche : semaine d'avant
    { plateforme: 'Vinted', ts: T(10, 1, 0, 30), eur: 70, compte: 'bruno' },     // 1er à 00 h 30 : novembre en local, octobre en UTC
    { plateforme: 'Vinted', ts: T(9, 31, 23), eur: 25, compte: 'alice' },        // 31 octobre au soir
    { plateforme: 'Leboncoin', ts: T(10, 18, 11), eur: 40, compte: 'lbc1' },
    { plateforme: 'Leboncoin', ts: T(10, 3), eur: 55, compte: 'lbc1' },
    { plateforme: 'eBay', ts: T(10, 12), eur: 80.25, compte: 'ebayx' },
    { plateforme: 'eBay', ts: T(8, 20), eur: 66, compte: 'ebayx' },              // septembre : trimestre d'avant
    { plateforme: 'Vestiaire', ts: T(10, 9), eur: 120, compte: '' },
    { plateforme: 'Vestiaire', ts: T(0, 10), eur: 90, compte: '' },              // janvier : dans l'année seulement
  ];
  const COMPTES = { alice: { uid: '11', login: 'alice', nom: 'alice' }, bruno: { uid: '22', login: 'bruno', nom: 'Bruno' } };
  // La publication du bénéfice (celle de l'écran Ventes) et le CA déclaré publié.
  const jours = {};
  const ajoute = (ts, eur, achat, frais, p) => { const k = ctx.jourClef(new Date(ts)); ctx.ajouterVenteBenefice(jours[k] || (jours[k] = ctx.beneficeVide()), eur, achat, frais, p); };
  ajoute(T(10, 16), 32.9, 12, 1, 'Vinted'); ajoute(T(10, 3), 55, 20, 0, 'Leboncoin'); ajoute(T(10, 12), 80.25, 30, 0, 'eBay'); ajoute(T(9, 20), 44, 10, 0, 'Vinted'); ajoute(T(10, 18), 45.5, 15, 0.5, 'Vinted');
  const PUB = { v: 2, jours: Object.fromEntries(Object.keys(jours).sort().map((k) => [k, ctx.jourBeneficeEnTableau(jours[k])])) };
  const LIGNE_U = { at: MAINT - 3600000, mois: [{ ym: '2026-11', ca: 168.15, n: 3, par: { Vinted: { ca: 32.9, n: 1 }, Leboncoin: { ca: 55, n: 1 }, eBay: { ca: 80.25, n: 1 } } }, { ym: '2026-10', ca: 44, n: 1, par: { Vinted: { ca: 44, n: 1 } } }],
    recu: { '2026-11': 133.15, '2026-10': 44 }, sources: { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu', Vestiaire: 'lu' }, nonComptees: { n: 0, par: {} } };
  const COMPTA = { depenses: [{ id: 'd1', date: '2026-11-04', montant: 5 }], fixes: [], packs: [], abonnements: [] };
  const LIVE = { walletAttente: 210.4, walletDispo: 33.1, walletParCompte: [{ uid: '11', login: 'alice', dispo: 20 }, { uid: '22', login: 'bruno', dispo: 13.1 }], online: 57, annEnLigne: { 11: 40, 22: 17 } };
  const sourcesDe = (o = {}) => ({
    vendu: { lignes: LIGNES, manque: [], enAttente: false, nonComptees: [] },
    beneficeDe: (p) => ({ B: ctx.beneficeDe({ pub: PUB, compta: COMPTA, ligneUrssaf: LIGNE_U, regime: 'micro' }, p), etat: 'lu' }),
    joursBenef: PUB, etatBenef: 'lu', ligneUrssaf: LIGNE_U,
    colisAPoster: { total: 9, vinted: 5, ebay: 2, leboncoin: 1, vestiaire: 1, at: MAINT }, colisARetirer: { total: 4, at: MAINT },
    dorment: { n: 12, total: 57, datesKnown: 57, at: MAINT }, live: LIVE, ...o,
  });
  const REGLES = { bilanLignes: ctx.bilanLignes, rythmeVendu: SV.rythmeVendu, chiffreBenefice: N.chiffreBenefice, chiffreBrut: N.chiffreBrut, beneficeDesJours: ctx.beneficeDesJours, debutPeriode: ctx.debutPeriode, decalerPeriode: ctx.decalerPeriode, fmt: String };
  const V = (id, sel, src = sourcesDe(), place = {}) => M.valeurChiffre(id, { id, ...place }, src, sel, REGLES, MAINT);

  // ATTENDU à la main : fenêtres en heure locale.
  const lundi = T(10, 16, 0), d1 = T(10, 1, 0), t4 = T(9, 1, 0), an = T(0, 1, 0), minuit = T(10, 18, 0);
  const DEBUT = { jour: minuit, semaine: lundi, mois: d1, trimestre: t4, annee: an };
  const main = (p, plateforme, login) => { const L = LIGNES.filter((l) => l.ts >= DEBUT[p] && (!plateforme || l.plateforme === plateforme) && (!login || (l.plateforme === 'Vinted' && l.compte === login))); return { n: L.length, eur: Math.round(L.reduce((t, l) => t + l.eur, 0) * 100) / 100 }; };

  console.log('── 1. Vendu et nombre de ventes : chaque site × compte × période = la règle');
  const SITE_PL = { toutes: null, vinted: 'Vinted', vestiaire: 'Vestiaire', leboncoin: 'Leboncoin', ebay: 'eBay' };
  for (const site of Object.keys(SITE_PL)) for (const login of [null, 'alice']) for (const p of ['jour', 'semaine', 'mois', 'trimestre', 'annee']) {
    const sel = { site, compte: login ? COMPTES[login] : null, periode: null };
    const v = V('vendu', sel, undefined, { p }), n = V('ventes', sel, undefined, { p });
    const lib = `${site}${login ? ' · ' + login : ''} · ${p}`;
    if (login && site !== 'vinted' && site !== 'toutes') { dit(v.valeur == null && !!v.hors, `vendu ${lib} : « — » (un compte Vinted ne se lit pas sur ${site})`, JSON.stringify(v)); continue; }
    const att = main(p, SITE_PL[site], login);
    dit(proche(v.valeur, att.eur) && n.valeur === att.n, `vendu ${lib} = à la main (${att.eur} € · ${att.n})`, `${v.valeur} · ${n.valeur}`);
    // La règle propriétaire, sur les MÊMES lignes du périmètre.
    const L = LIGNES.filter((l) => (!SITE_PL[site] || l.plateforme === SITE_PL[site]) && (!login || (l.plateforme === 'Vinted' && l.compte === login)));
    const prop = p === 'jour' ? ctx.resumeVendu(L, MAINT).jour : p === 'mois' ? ctx.resumeVendu(L, MAINT).mois : ctx.caParPeriodes({ vendu: L }, p, 1, MAINT)[0].vendu;
    dit(proche(v.valeur, prop.eur) && n.valeur === prop.n, `vendu ${lib} = ${p === 'jour' || p === 'mois' ? 'resumeVendu (Ma journée)' : 'caParPeriodes (Compta)'}`, `${v.valeur} / ${prop.eur}`);
  }
  // Toutes plateformes, mois : le chiffre de la carte de Ventes d'avant (`bilanVentes` du 1er du mois).
  dit(proche(V('vendu', { site: 'toutes' }, undefined, { p: 'mois' }).valeur, ctx.bilanLignes(LIGNES, d1, null).eur), 'vendu du mois = bilanLignes(1er du mois) — la carte de Ventes');
  // Une plage du calendrier de Ventes (du 10 au 17 novembre inclus).
  const plage = { de: T(10, 10, 0), a: T(10, 18, 0), label: 'du 10 au 17 nov.' };
  const vp = V('vendu', { site: 'vinted', compte: null, periode: plage });
  const attP = LIGNES.filter((l) => l.plateforme === 'Vinted' && l.ts >= plage.de && l.ts < plage.a).reduce((t, l) => t + l.eur, 0);
  dit(proche(vp.valeur, attP), 'vendu sur une plage choisie dans Ventes = à la main', `${vp.valeur} / ${attP}`);
  dit(V('benefice', { site: 'toutes', periode: plage }).valeur == null && !!V('benefice', { site: 'toutes', periode: plage }).hors, 'bénéfice sur une plage de dates : « — » (la règle se compte au mois)');
  // (3 nov., le calendrier de la carte) Une plage LIBRE posée sur la place elle-même (feuille « Modifier »).
  const vpl = V('vendu', { site: 'vinted', compte: null, periode: null }, undefined, { p: plage });
  dit(proche(vpl.valeur, attP), 'vendu, plage libre de la place = à la main (la même règle que la plage de Ventes)', `${vpl.valeur} / ${attP}`);
  const vbp = V('benefice', { site: 'toutes', periode: null }, undefined, { p: plage });
  dit(vbp.valeur == null && !!vbp.hors, 'bénéfice, plage libre de la place : « — » (jamais un faux total)', JSON.stringify(vbp));
  if (typeof M.reglageDePage === 'function') {
    const rg = M.reglageDePage({ v: 1, pages: { ventes: { g: { id: 'vendu', p: plage }, c: [{ id: 'benefice', p: plage }, { id: 'ventes', p: plage }] } } }, 'ventes');
    dit(rg && rg.g.p && typeof rg.g.p === 'object' && rg.g.p.de === plage.de && rg.g.p.a === plage.a, 'réglage rangé : la plage du vendu est gardée', JSON.stringify(rg && rg.g));
    dit(rg && !rg.c.some((x) => x.id === 'benefice' && x.p && typeof x.p === 'object'), 'réglage rangé : une plage sur le bénéfice n’est pas gardée (il retombe sur sa période)', JSON.stringify(rg && rg.c));
    const rk = M.reglageDePage({ v: 1, pages: { ventes: { g: { id: 'vendu', p: { de: 5, a: 2 } } } } }, 'ventes');
    dit(rk && rk.g.p === 'mois', 'une plage illisible (fin avant début) n’est pas gardée : le mois', JSON.stringify(rk && rk.g));
  }

  console.log('── 2. Partiel, pas su, jamais 0');
  const srcKO = sourcesDe({ vendu: { lignes: LIGNES, manque: ['bruno', 'eBay'], enAttente: false, nonComptees: [] } });
  const vT = V('vendu', { site: 'toutes' }, srcKO, { p: 'mois' }), vV = V('vendu', { site: 'vinted' }, srcKO, { p: 'mois' }), vL = V('vendu', { site: 'leboncoin' }, srcKO, { p: 'mois' }), vE = V('vendu', { site: 'ebay' }, srcKO, { p: 'mois' });
  dit(vT.partiel && vT.manque.includes('bruno') && vT.manque.includes('eBay'), 'tous les sites, un compte et eBay pas lus : « au moins », les deux NOMMÉS', JSON.stringify(vT.manque));
  dit(vV.partiel && vV.manque.join() === 'bruno', 'Vinted : seul le compte Vinted manque', JSON.stringify(vV.manque));
  dit(!vL.partiel, 'Leboncoin : un compte Vinted pas lu ne le rend pas partiel');
  dit(vE.partiel && proche(vE.valeur, 80.25), 'eBay pas lu mais une vente lue : « au moins 80,25 € »', JSON.stringify(vE));
  const vA = V('vendu', { site: 'toutes', compte: COMPTES.alice }, srcKO, { p: 'mois' });
  dit(!vA.partiel, 'le compte alice : bruno pas lu ne la rend pas partielle');
  const srcRien = sourcesDe({ vendu: { lignes: [], manque: ['eBay'], enAttente: false, nonComptees: [] } });
  dit(V('vendu', { site: 'ebay' }, srcRien, { p: 'mois' }).valeur == null, 'rien lu sur eBay : « — », jamais « au moins 0 € »');
  dit(V('panier', { site: 'toutes' }, srcKO).valeur == null, 'panier moyen sur une partie des ventes : « — » (une moyenne partielle n’est pas un minimum)');
  const vide = { vendu: null, beneficeDe: () => ({ B: null, etat: 'passu' }), joursBenef: null, etatBenef: 'passu', ligneUrssaf: null, colisAPoster: null, colisARetirer: null, dorment: null, live: null };
  for (const id of M.IDS_CHIFFRES) {
    const r = V(id, { site: 'toutes' }, vide);
    dit(r.valeur === null, `${id} sans source : « — » (null), jamais 0`, JSON.stringify(r.valeur));
  }

  console.log('── 3. Panier moyen = rythmeVendu (Statistiques)');
  for (const site of ['toutes', 'vinted', 'ebay']) {
    const L = LIGNES.filter((l) => !SITE_PL[site] || l.plateforme === SITE_PL[site]);
    dit(proche(V('panier', { site }).valeur, SV.rythmeVendu(L, MAINT).panier30.moyen), `panier ${site} = rythmeVendu(…).panier30`, `${V('panier', { site }).valeur}`);
  }

  console.log('── 4. Bénéfice, à déclarer, URSSAF, brut, finalisées = la lecture de Compta');
  for (const p of ['mois', 'trimestre', 'annee']) {
    const B = ctx.beneficePeriode({ jours: PUB.jours, compta: COMPTA, ligneUrssaf: LIGNE_U, taux: 12.4, periode: p, maintenant: MAINT, toutes: true, urssaf: true });
    const cb = N.chiffreBenefice(B, 'lu');
    dit(proche(V('benefice', { site: 'toutes' }, undefined, { p }).valeur, cb.valeur), `bénéfice ${p} = chiffreBenefice(beneficePeriode)`, `${V('benefice', { site: 'toutes' }, undefined, { p }).valeur} / ${cb.valeur}`);
    dit(proche(V('declarer', { site: 'toutes' }, undefined, { p }).valeur, B.caDecl), `à déclarer ${p} = B.caDecl`, `${B.caDecl}`);
    dit(proche(V('urssaf', { site: 'toutes' }, undefined, { p }).valeur, B.cotis), `URSSAF ${p} = B.cotis`, `${B.cotis}`);
    dit(proche(V('brut', { site: 'toutes' }, undefined, { p }).valeur, N.chiffreBrut(B).valeur), `bénéfice brut ${p} = chiffreBrut(B)`, `${N.chiffreBrut(B).valeur}`);
    dit(V('finalisees', { site: 'toutes' }, undefined, { p }).valeur === B.n, `ventes finalisées ${p} = B.n`, `${B.n}`);
  }
  // À la main (novembre) : ventes 32,9 + 55 + 80,25 + 45,5 ; achats 12 + 20 + 30 + 15 ; frais 1 + 0,5 ; dépense 5 ;
  // URSSAF 12,4 % des MÊMES ventes (213,65 €, la règle de main depuis le 3 nov. : la cotisation attachée à la vente).
  const urssafMain = Math.round(213.65 * 0.124 * 100) / 100;
  const netMain = Math.round((213.65 - 77 - 1.5 - 5 - urssafMain) * 100) / 100;
  dit(proche(V('benefice', { site: 'toutes' }, undefined, { p: 'mois' }).valeur, netMain), `bénéfice de novembre = à la main (${netMain} €)`, `${V('benefice', { site: 'toutes' }, undefined, { p: 'mois' }).valeur}`);
  const sem = ctx.beneficeDesJours(PUB.jours, new Date(lundi), new Date(T(10, 23, 0)));
  dit(proche(V('brut', { site: 'toutes' }, undefined, { p: 'semaine' }).valeur, N.chiffreBrut(sem).valeur), 'bénéfice brut de la semaine = chiffreBrut(beneficeDesJours)', `${N.chiffreBrut(sem).valeur}`);
  for (const site of ['vinted', 'leboncoin', 'ebay', 'vestiaire']) for (const id of ['benefice', 'declarer', 'urssaf', 'recu', 'brut']) {
    const r = V(id, { site }, undefined, { p: 'mois' });
    dit(r.valeur == null && !!r.hors, `${id} sur ${site} seul : « — » et pas proposé`, JSON.stringify(r));
  }
  dit(V('urssaf', { site: 'toutes', compte: COMPTES.alice }).valeur == null, 'URSSAF par compte : « — »');
  const sansCotis = sourcesDe({ beneficeDe: (p) => ({ B: ctx.beneficeDe({ pub: PUB, compta: COMPTA, ligneUrssaf: LIGNE_U, regime: 'societe' }, p), etat: 'lu' }) });
  dit(V('urssaf', { site: 'toutes' }, sansCotis, { p: 'mois' }).valeur == null && !!V('urssaf', { site: 'toutes' }, sansCotis, { p: 'mois' }).hors, 'URSSAF hors micro-entreprise : « — », pas un 0 inventé');
  const prixManque = {}; const kk = ctx.jourClef(new Date(T(10, 5))); prixManque[kk] = ctx.beneficeVide(); ctx.ajouterVenteBenefice(prixManque[kk], 99, null, 0, 'Vinted');
  const PUB2 = { v: 2, jours: { ...PUB.jours, [kk]: ctx.jourBeneficeEnTableau(prixManque[kk]) } };
  const src2 = sourcesDe({ beneficeDe: (p) => ({ B: ctx.beneficeDe({ pub: PUB2, compta: COMPTA, ligneUrssaf: LIGNE_U, regime: 'micro' }, p), etat: 'lu' }), joursBenef: PUB2 });
  dit(V('benefice', { site: 'toutes' }, src2, { p: 'mois' }).valeur == null, 'un prix d’achat manque : bénéfice « — » (la règle de Compta)');
  const b2 = V('brut', { site: 'toutes' }, src2, { p: 'mois' });
  dit(b2.valeur != null && b2.partiel && b2.couverture === '4 sur 5', 'le brut garde sa couverture « 4 sur 5 », jamais « au moins »', JSON.stringify(b2));

  console.log('── 5. Reçu = la lecture du widget (même ligne publiée)');
  const pubs = {
    'fraîche': LIGNE_U,
    'partielle': { ...LIGNE_U, sources: { ...LIGNE_U.sources, eBay: 'pasSu' } },
    'Vestiaire pas sûr': { ...LIGNE_U, nonComptees: { n: 1, par: { 'Vestiaire|montant pas sûr': 1 } } },
    'de dix jours': { ...LIGNE_U, at: MAINT - 10 * 86400000 },
    'du mois d’avant': { ...LIGNE_U, at: T(9, 30) },
    'absente': null,
    'mois sans versement': { ...LIGNE_U, recu: { '2026-10': 44 } },
  };
  for (const [nom, pub] of Object.entries(pubs)) {
    const w = wctx.recuDuMoisPublie(pub, '2026-11', MAINT);
    const att = w.received != null ? w.received : w.receivedAuMoins;
    const v = V('recu', { site: 'toutes' }, sourcesDe({ ligneUrssaf: pub }), { p: 'mois' });
    dit((att == null && v.valeur == null) || (att != null && v.valeur != null && Math.round(v.valeur) === att && v.partiel === (w.received == null)), `reçu, ligne ${nom} = recuDuMoisPublie (widget)`, `${v.valeur}${v.partiel ? ' au moins' : ''} / ${JSON.stringify(att)}`);
  }

  console.log('── 6. Colis, porte-monnaie, annonces : les publications, par site et compte');
  dit(V('aposter', { site: 'toutes' }).valeur === 9 && V('aposter', { site: 'vinted' }).valeur === 5 && V('aposter', { site: 'ebay' }).valeur === 2 && V('aposter', { site: 'vestiaire' }).valeur === 1, 'à poster = vrm_colis_aposter (total, puis la part de chaque site)');
  const apKO = sourcesDe({ colisAPoster: { total: 5, vinted: 5, ebay: null, leboncoin: 0, vestiaire: 0 } });
  dit(V('aposter', { site: 'toutes' }, apKO).partiel && V('aposter', { site: 'ebay' }, apKO).valeur == null, 'eBay pas lu : « au moins 5 » sur tous les sites, « — » sur eBay');
  dit(V('retirer', { site: 'toutes' }).valeur === 4 && V('retirer', { site: 'vinted' }).valeur == null, 'à retirer = vrm_colis_retirer ; « — » sur un site seul (la publication ne le sépare pas)');
  dit(V('attente', { site: 'toutes' }).valeur === 210.4 && V('attente', { site: 'ebay' }).valeur == null, 'argent en attente = le porte-monnaie Vinted ; « — » sur eBay');
  dit(V('dispo', { site: 'vinted', compte: COMPTES.bruno }).valeur === 13.1 && V('dispo', { site: 'vinted' }).valeur === 33.1, 'disponible : celui du compte choisi, sinon le total');
  dit(V('enligne', { site: 'vinted', compte: COMPTES.alice }).valeur === 40 && V('enligne', { site: 'vinted' }).valeur === 57, 'annonces en ligne : celles du compte choisi, sinon toutes');
  dit(V('enligne', { site: 'vinted', compte: { uid: '99', login: 'zoe' } }).valeur == null, 'un compte jamais lu : « — », pas 0');
  dit(V('dorment', { site: 'vinted' }).valeur === 12 && V('dorment', { site: 'vinted' }, sourcesDe({ dorment: { n: 12, total: 57, datesKnown: 40 } })).partiel, 'qui dorment = vrm_paires_dorment, « au moins » quand des dates manquent');

  console.log('── 7. Le réglage par page');
  for (const page of M.PAGES) {
    const r = M.reglageDePage(null, page, { enroute: { nom: 'x', court: 'x', type: 'n' }, apayer: { nom: 'y', court: 'y', type: 'n' }, imprimer: { nom: 'i', type: 'n' }, deposes: { nom: 'd', type: 'n' }, ca: { nom: 'c', type: 'eur' }, encours: { nom: 'e', type: 'n' }, 'finalisees-site': { nom: 'f', type: 'n' }, depense: { nom: 'D', type: 'eur' }, recus: { nom: 'R', type: 'n' } });
    dit(!!r && !!r.g && r.c.length === 3 && r.defaut, `${page} : un grand chiffre et trois cases par défaut`, JSON.stringify(r));
  }
  const reg = M.reglageAEnregistrer(null, 'colis', { g: { id: 'vendu', p: 'semaine' }, c: [{ id: 'retirer' }, { id: 'aposter' }, { id: 'vendu', p: 'semaine' }] });
  const rc = M.reglageDePage(reg, 'colis', null), rv = M.reglageDePage(reg, 'ventes-toutes', null);
  dit(rc.g.id === 'vendu' && rc.g.p === 'semaine' && !rc.defaut, 'le choix de Colis est relu (vendu de la semaine en grand)');
  dit(rc.c.filter((x) => x.id === 'vendu' && x.p === 'semaine').length === 0, 'le même chiffre à la même période n’est jamais deux fois sur la carte');
  dit(rv.defaut && rv.g.id === 'vendu' && rv.g.p === 'mois', 'le choix de Colis ne touche pas Ventes');
  dit(M.reglageDePage({ v: 1, pages: { compta: { g: { id: 'inconnu' }, c: [{ id: 'benefice', p: 'jamais' }] } } }, 'compta', null).g.id === 'benefice', 'un chiffre inconnu retombe sur le défaut de la page');
  dit(M.reglageDePage({ v: 1, pages: { compta: { g: { id: 'urssaf', p: 'jamais' } } } }, 'compta', null).g.p === 'mois', 'une période inconnue retombe sur celle du chiffre');
  dit(!M.chiffresProposes({ site: 'ebay' }).includes('benefice') && M.chiffresProposes({ site: 'toutes' }).includes('benefice'), 'la feuille ne propose pas le bénéfice sur eBay seul');
  const vc = M.valeursCarte('ventes-toutes', null, sourcesDe(), { site: 'toutes' }, REGLES, MAINT);
  dit(vc.perimetre === 'Novembre', 'périmètre « Novembre » sur tous les sites', vc.perimetre);
  dit(M.valeursCarte('ventes', null, sourcesDe({ locaux: { enroute: { valeur: 1 }, apayer: { valeur: 2 } } }), { site: 'vinted', compte: COMPTES.bruno }, REGLES, MAINT).perimetre === 'Novembre · Vinted · Bruno', 'périmètre « Novembre · Vinted · Bruno »');
  dit(M.valeursCarte('compta', null, sourcesDe(), { site: 'toutes', periode: 'annee' }, REGLES, MAINT).perimetre === '2026', 'Compta à l’année : « 2026 » (le filtre de la page l’emporte)');

  console.log('── 8. Le branchement dans App.jsx (lu dans le code, sans commentaires)');
  const A = sansCommentaires(APP);
  dit(/const REGLES_CARTE = \{ bilanLignes, rythmeVendu, chiffreBenefice, chiffreBrut, beneficeDesJours, debutPeriode, decalerPeriode, fmt \}/.test(A), 'les règles passées à la carte sont les propriétaires');
  dit(/const bilanVentes = React\.useCallback\(\(depuisTs, jusquaTs\) => bilanLignes\(vendus\.lignes, depuisTs, jusquaTs\)/.test(A), 'le vendu de Ventes (`bilanVentes`) passe par la même `bilanLignes`');
  dit(/const B = beneficeDe\(\{ pub, compta, ligneUrssaf, regime \}, periode\);/.test(A) && /beneficeDe: \(p\) => \(\{ B: beneficeDe\(\{ pub, compta, ligneUrssaf, regime \}, p\), etat \}\)/.test(A), 'Compta et la carte lisent le bénéfice par la même `beneficeDe`');
  dit(/lignes: liveStats\.venduLignes/.test(A), 'le vendu de la carte = les lignes de `ventesFaites` de la coque (liveStatsVus)');
  dit(/'vrm_carte_stats',/.test(A) && /onCloudReady\(\(\) => setV\(\(cur\) => cur === null \? lireReglageCarte\(\) : cur\)\)/.test(A), 'le réglage est synchronisé (`main`) et rattrapé par onCloudReady');
  for (const page of ['journee', 'ventes', 'ventes-toutes', 'vestiaire', 'colis', 'compta']) dit(new RegExp(`<CarteStatsApp page="${page}"`).test(A), `la page « ${page} » monte sa carte`);
  dit(/<CarteStatsApp page=\{plateforme\}/.test(A) && /<KpiVentes plateforme="leboncoin"/.test(A) && /<KpiVentes plateforme="ebay"/.test(A), 'Leboncoin et eBay montent leur carte (KpiVentes)');
  // (3 nov.) Achats monte SA carte dans l'écran Achats, avec ses chiffres d'achat (jamais « Vendu · mois »).
  dit(/page="annonces"/.test(A) && /page="achats"[^>]*locaux=\{\{\s*depense:/.test(A), 'Annonces et Achats montent leur carte (Achats : chiffres d’achat)');
  dit(M.PAGES_CARTE.achats.g.id === 'depense' && ![M.PAGES_CARTE.achats.g, ...M.PAGES_CARTE.achats.c].some((x) => ['vendu', 'ventes', 'attente', 'aposter'].includes(x.id)), 'Achats : aucun chiffre de vente par défaut');

  console.log(`\n${ko ? '❌' : '✅'} carte-chiffres : ${ok} vert(s), ${ko} rouge(s)${MUT ? ` (mutation ${MUT})` : ''}`);
  process.exit(ko ? 1 : 0);
})();
