// ════════════════════════════════════════════════════════════════════════════
//  LA FILE D'ENVOI (src/fileEnvoi.js) — EXÉCUTÉE (2 nov.)
//
//  « Rien ne se perd si le réseau coupe. » On exécute le VRAI module (et la
//  vraie fusion src/fusionNuage.js), avec un faux stockage d'appareil et un
//  faux nuage à comparer-et-échanger sur `rev` (la forme de `cloudPush`) :
//   1. coupure pendant l'écriture ⇒ la saisie et sa base restent dans la file,
//      l'app peut être fermée (un stockage neuf relit la même file) ;
//   2. au retour (chargement) ⇒ la saisie n'est pas recopiée par le nuage,
//      elle part, la file se vide ; la fois suivante, rien à renvoyer ;
//   3. envoyée sans réponse ⇒ à la reprise, aucun doublon (liste, carte) ;
//   4. une valeur changée ici pendant la coupure ET là-bas plus tard ⇒ celle
//      de là-bas reste ; ce que l'autre appareil n'a pas touché arrive ;
//   5. « lecture KO, écriture OK » ⇒ rien n'est écrit, rien d'effacé, la file
//      reste (pas su ≠ envoyé) ;
//   6. un geste pendant l'aller-retour ⇒ son entrée reste dans la file ;
//   7. stockage qui refuse la lecture ⇒ la file n'est pas réécrite ; la file
//      d'un AUTRE vendeur n'est jamais appliquée ;
//   8. NUMÉROS : un N° donné sans réseau qui croise celui d'un autre appareil
//      n'est PAS rejoué (le prix l'est) ; après une remise à zéro, la file des
//      fiches est écartée ;
//   9. le compte affiché : un prix = 1, les chiffres publiés ne comptent pas,
//      « 12 » = 12 dans le pool ;
//  10. App.jsx branche le module : `save` note, `cloudPush` n'acquitte qu'après
//      une écriture acceptée, le chargement passe par `fusionAuChargement`.
//  Le réseau RÉEL (l'app entière, coupure, fermeture, réouverture) est joué par
//  le banc `scripts/bancs/file-envoi.cjs` — rouge sur le build d'avant.
//  `--prouve` : chaque mutation de la règle doit rendre au moins un rouge.
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const racine = path.join(__dirname, '..');
const SRC = path.join(racine, 'src', 'fileEnvoi.js');
const SRC_FUSION = path.join(racine, 'src', 'fusionNuage.js');
const cleNum = (v) => { const s = String(v == null ? '' : v).toUpperCase().replace(/\s+/g, ''); const m = /^([A-Z]*)0*(\d+)$/.exec(s); return m ? m[1] + m[2] : s; };

// Un stockage d'appareil (survit à la « fermeture » : on le garde, on recrée l'app).
const stockage = (init = {}) => {
  const m = new Map(Object.entries(init));
  const s = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { s.ecrits++; m.set(k, String(v)); }, removeItem: (k) => { s.ecrits++; m.delete(k); }, ecrits: 0, m };
  return s;
};
const lit = (st, k) => { const t = st.getItem(k); return t == null ? undefined : JSON.parse(t); };
// Le faux nuage : une ligne { data (avec rev), maj }, PATCH conditionnel sur rev.
const nuage = (data, maj) => ({ data: JSON.parse(JSON.stringify(data)), maj: maj || new Date(Date.now() - 3600e3).toISOString(), ecritures: 0, panneLecture: false, panneEcriture: false, reponsePerdue: false });
const lireNuage = (N) => { if (N.panneLecture) return undefined; return { data: JSON.parse(JSON.stringify(N.data)), rev: N.data.rev, maj: N.maj }; };
const patch = (N, rev, data, maj) => {
  if (N.panneEcriture) throw new Error('réseau coupé');
  if (N.data.rev !== rev) return { devance: true };
  N.data = JSON.parse(JSON.stringify(data)); N.maj = maj; N.ecritures++;
  if (N.reponsePerdue) { N.reponsePerdue = false; throw new Error('réponse perdue'); }
  return { ok: true };
};

async function charger(dir) {
  const F = await import(pathToFileURL(path.join(dir, 'fileEnvoi.js')).href + '?t=' + Date.now() + Math.random());
  const U = await import(pathToFileURL(path.join(dir, 'fusionNuage.js')).href + '?t=' + Date.now() + Math.random());
  return { F, U };
}

// L'appareil, comme App.jsx : `save` écrit le navigateur puis note la file ;
// `envoyer` = cloudPush (lit si besoin, fusionne clé par clé, PATCH sur rev,
// acquitte SEULEMENT si accepté) ; `ouvrir` = le chargement (lit le nuage, rejoue
// la file au lieu de recopier, puis envoie).
function appareil(M, st, owner, cles) {
  const { F, U } = M;
  const app = { base: null, snap: null };
  app.save = (k, v, quand = Date.now()) => {
    const avant = st.getItem(k);
    const txt = JSON.stringify(v);
    st.setItem(k, txt);
    if (txt !== avant || (F.lireFile(st, owner) || { cles: {} }).cles[k]) F.noterSaisie(st, owner, k, app.base ? app.base[k] : (avant == null ? undefined : JSON.parse(avant)), quand);
  };
  const local = () => { const L = {}; for (const k of cles) { const v = lit(st, k); if (v !== undefined) L[k] = v; } return L; };
  app.envoyer = (N) => {
    const file = F.lireFile(st, owner);
    const inst = F.instantane(st, owner);
    if (!app.snap) { const c = lireNuage(N); if (c === undefined) return 'pas-su'; app.snap = c; app.base = {}; for (const k of cles) if (c.data[k] !== undefined) app.base[k] = c.data[k]; }
    for (let essai = 0; essai < 4; essai++) {
      const L = local();
      const f = U.fusionnerLigne({ cles, base: app.base, local: L, nuage: app.snap.data, cleNum, nuageGagne: F.nuagePlusRecent(file, app.snap.maj) });
      if (f.conflit) return 'conflit';
      if (cles.every((k) => U.egal(f.data[k], app.snap.data[k]))) { for (const k of cles) if (f.data[k] !== undefined) st.setItem(k, JSON.stringify(f.data[k])); app.base = { ...f.data }; F.acquitter(st, owner, inst); return 'rien-de-neuf'; }
      const data = { ...f.data, rev: (app.snap.rev || 0) + 1 };
      const maj = new Date().toISOString();
      let r;
      try { r = patch(N, app.snap.rev, data, maj); } catch (_) { return 'pas-su'; }
      if (r.ok) { for (const k of cles) if (f.data[k] !== undefined) st.setItem(k, JSON.stringify(f.data[k])); app.base = { ...f.data }; app.snap = { data, rev: data.rev, maj }; F.acquitter(st, owner, inst); return 'ecrit'; }
      const c = lireNuage(N); if (c === undefined) return 'pas-su';   // une lecture ratée n'écrit rien
      app.snap = c;
    }
    return 'pas-fini';
  };
  app.ouvrir = (N, { numerosOk = true } = {}) => {
    const c = lireNuage(N);
    if (c === undefined) return 'pas-su';
    const file = F.lireFile(st, owner);
    const L = local();
    const r = F.fusionAuChargement({ file, local: L, nuage: c.data, majNuage: c.maj, cleNum, numerosOk });
    for (const k of cles) {
      if (c.data[k] === undefined) continue;
      let v = Object.prototype.hasOwnProperty.call(r.vals, k) ? r.vals[k] : c.data[k];
      if (k === 'vinted_used_numeros') v = U.unionPool(L[k], c.data[k], cleNum);
      st.setItem(k, JSON.stringify(v));
    }
    for (const k of r.ecartees) F.oublierCle(st, owner, k);
    app.snap = c; app.base = {}; for (const k of cles) if (c.data[k] !== undefined) app.base[k] = c.data[k];
    app.reprise = r;
    return app.envoyer(N);
  };
  return app;
}

async function juger(dir, bavard) {
  const M = await charger(dir);
  const { F } = M;
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard) console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
  const OW = 'vendeur-a';
  const CLES = ['vinted_annonce_numeros', 'vinted_used_numeros', 'vinted_buyprice_by_num', 'vinted_achat_notes', 'vinted_offvinted_buys', 'vrm_prenom', 'vinted_urssaf_mois'];
  const fiches = () => ({ a1: { numero: '1', title: 'Dunk 1' }, a2: { numero: '2', title: 'Dunk 2' }, a3: { numero: '3', title: 'Dunk 3' } });
  const depart = () => ({ rev: 4, vinted_annonce_numeros: fiches(), vinted_used_numeros: ['1', '2', '3'], vinted_buyprice_by_num: {}, vinted_achat_notes: {}, vinted_offvinted_buys: [], vrm_prenom: 'Julien' });
  const remplir = (st, d) => { for (const k of CLES) if (d[k] !== undefined) st.setItem(k, JSON.stringify(d[k])); };
  const prix = (d, id) => ((d.vinted_annonce_numeros || {})[id] || {}).buyPrice;
  const prixF = (fiches, id) => ((fiches || {})[id] || {}).buyPrice;

  // ── 1-2. Coupure, fermeture, réouverture ─────────────────────────────────
  {
    const N = nuage(depart()); const st = stockage(); remplir(st, N.data);
    let A = appareil(M, st, OW, CLES);
    dit(A.envoyer(N) === 'rien-de-neuf', '1 : l\'appareil et le nuage d\'accord au départ');
    N.panneEcriture = true; N.panneLecture = true;
    const f1 = { ...lit(st, 'vinted_annonce_numeros') }; f1.a1 = { ...f1.a1, buyPrice: '41' };
    A.save('vinted_annonce_numeros', f1);
    A.save('vinted_achat_notes', { a1: 'semelle à nettoyer' });
    dit(A.envoyer(N) === 'pas-su', '1 : l\'envoi échoue (réseau coupé)');
    const file = F.lireFile(st, OW);
    dit(file && file.cles.vinted_annonce_numeros && file.cles.vinted_achat_notes, '1 : la saisie (prix, note) est dans la file', JSON.stringify(Object.keys((file || {}).cles || {})));
    dit(F.compterEnAttente(st, OW) === 2, '1 : « 2 changements en attente »', String(F.compterEnAttente(st, OW)));
    // L'app est fermée ; le réseau revient ; un AUTRE appareil a écrit entre-temps une autre clé.
    N.panneEcriture = false; N.panneLecture = false;
    N.data = { ...N.data, vrm_prenom: 'Ju', rev: N.data.rev + 1 }; N.maj = new Date(Date.now() - 1000).toISOString();
    A = appareil(M, st, OW, CLES);
    const r = A.ouvrir(N);
    dit(r === 'ecrit', '2 : rouverte avec le réseau, la saisie part', r);
    dit(prix(N.data, 'a1') === '41' && (N.data.vinted_achat_notes || {}).a1 === 'semelle à nettoyer', '2 : prix et note en base', JSON.stringify({ p: prix(N.data, 'a1'), n: N.data.vinted_achat_notes }));
    dit(prixF(lit(st, 'vinted_annonce_numeros'), 'a1') === '41', '2 : et toujours sur l\'appareil (pas recopié par le nuage)');
    dit(N.data.vrm_prenom === 'Ju', '2 : ce que l\'autre appareil a écrit reste');
    dit(F.compterEnAttente(st, OW) === 0 && !Object.keys(F.lireFile(st, OW).cles).length, '2 : la file est vide après l\'acceptation');
    const avant = N.ecritures;
    A = appareil(M, st, OW, CLES);
    dit(A.ouvrir(N) === 'rien-de-neuf' && N.ecritures === avant, '2 : la réouverture suivante n\'écrit rien (envoyé une fois)');
  }
  // ── 3. Envoyé sans réponse ⇒ aucun doublon ────────────────────────────────
  {
    const N = nuage(depart()); const st = stockage(); remplir(st, N.data);
    let A = appareil(M, st, OW, CLES); A.envoyer(N);
    A.save('vinted_offvinted_buys', [{ id: 'x1', prix: 30 }]);
    N.reponsePerdue = true;
    dit(A.envoyer(N) === 'pas-su', '3 : écrit en base mais la réponse se perd (pas su)');
    dit(!!F.lireFile(st, OW).cles.vinted_offvinted_buys, '3 : « pas su » ≠ « envoyé » : la saisie reste dans la file');
    A = appareil(M, st, OW, CLES);
    A.ouvrir(N);
    dit((N.data.vinted_offvinted_buys || []).length === 1, '3 : à la reprise, l\'achat n\'est pas en double', JSON.stringify(N.data.vinted_offvinted_buys));
    dit(!Object.keys(F.lireFile(st, OW).cles).length, '3 : la file se vide (le nuage le portait déjà)');
  }
  // ── 4. Plus récent ailleurs ───────────────────────────────────────────────
  {
    const N = nuage(depart()); const st = stockage(); remplir(st, N.data);
    let A = appareil(M, st, OW, CLES); A.envoyer(N);
    N.panneEcriture = true;
    const t0 = Date.now() - 60e3;
    const f = { ...lit(st, 'vinted_annonce_numeros') }; f.a2 = { ...f.a2, buyPrice: '42' }; f.a3 = { ...f.a3, buyPrice: '43' };
    A.save('vinted_annonce_numeros', f, t0);
    A.save('vinted_buyprice_by_num', { 2: '42' }, t0);
    A.envoyer(N);
    // Plus tard, l'autre appareil met 52 au N°2 (carte et fiche) et 9 au N°1.
    N.panneEcriture = false;
    const fn = JSON.parse(JSON.stringify(N.data.vinted_annonce_numeros)); fn.a2.buyPrice = '52'; fn.a1.buyPrice = '9';
    N.data = { ...N.data, vinted_annonce_numeros: fn, vinted_buyprice_by_num: { 2: '52' }, rev: N.data.rev + 1 }; N.maj = new Date(t0 + 30e3).toISOString();
    A = appareil(M, st, OW, CLES);
    A.ouvrir(N);
    dit(prix(N.data, 'a2') === '52' && N.data.vinted_buyprice_by_num['2'] === '52', '4 : la valeur posée PLUS TARD ailleurs n\'est pas réécrite', JSON.stringify({ fiche: prix(N.data, 'a2'), carte: N.data.vinted_buyprice_by_num }));
    dit(prix(N.data, 'a3') === '43' && prix(N.data, 'a1') === '9', '4 : ce qu\'un seul côté a touché reste (43 d\'ici, 9 de là-bas)');
    dit(prixF(lit(st, 'vinted_annonce_numeros'), 'a2') === '52', '4 : l\'appareil affiche la valeur la plus récente');
    // Et l'inverse : la saisie est la plus récente ⇒ elle gagne.
    const N2 = nuage(depart()); const st2 = stockage(); remplir(st2, N2.data);
    let B = appareil(M, st2, OW, CLES); B.envoyer(N2);
    N2.data = { ...N2.data, vinted_buyprice_by_num: { 2: '52' }, rev: N2.data.rev + 1 }; N2.maj = new Date(Date.now() - 120e3).toISOString();
    N2.panneEcriture = true; B.save('vinted_buyprice_by_num', { 2: '42' }); B.envoyer(N2); N2.panneEcriture = false;
    B = appareil(M, st2, OW, CLES); B.ouvrir(N2);
    dit(N2.data.vinted_buyprice_by_num['2'] === '42', '4 : saisie plus récente que la ligne ⇒ elle gagne (le geste le plus récent)', JSON.stringify(N2.data.vinted_buyprice_by_num));
  }
  // ── 5. Lecture KO, écriture OK ────────────────────────────────────────────
  {
    const N = nuage(depart()); const st = stockage(); remplir(st, N.data);
    let A = appareil(M, st, OW, CLES); A.envoyer(N);
    N.panneEcriture = true; A.save('vinted_buyprice_by_num', { 1: '11' }); A.envoyer(N); N.panneEcriture = false;
    N.data = { ...N.data, vrm_prenom: 'Autre', rev: N.data.rev + 1 };
    const avant = JSON.stringify(N.data);
    N.panneLecture = true;   // les écritures passeraient
    A = appareil(M, st, OW, CLES);
    dit(A.ouvrir(N) === 'pas-su' && N.ecritures === 0 && JSON.stringify(N.data) === avant, '5 : lecture KO ⇒ aucune écriture, rien d\'effacé');
    // Même chose au milieu d'un envoi : devancé puis relecture KO.
    const st2 = stockage(); remplir(st2, N.data); N.panneLecture = false;
    const B = appareil(M, st2, OW, CLES); B.envoyer(N);
    N.data = { ...N.data, vrm_prenom: 'Encore', rev: N.data.rev + 1 };
    B.save('vinted_buyprice_by_num', { 3: '33' });
    N.panneLecture = true;
    const av2 = JSON.stringify(N.data);
    dit(B.envoyer(N) === 'pas-su' && JSON.stringify(N.data) === av2, '5 : devancé + relecture KO ⇒ rien n\'est écrit');
    dit(!!F.lireFile(st, OW).cles.vinted_buyprice_by_num && !!F.lireFile(st2, OW).cles.vinted_buyprice_by_num, '5 : la saisie reste dans la file');
    N.panneLecture = false;
    A = appareil(M, st, OW, CLES);
    dit(A.ouvrir(N) === 'ecrit' && N.data.vinted_buyprice_by_num['1'] === '11' && N.data.vrm_prenom === 'Encore', '5 : la panne finie, la saisie arrive, fusionnée', JSON.stringify(N.data.vinted_buyprice_by_num));
  }
  // ── 6. Un geste pendant l'aller-retour ────────────────────────────────────
  {
    const st = stockage();
    F.noterSaisie(st, OW, 'vrm_prenom', 'Julien');
    const inst = F.instantane(st, OW);
    F.noterSaisie(st, OW, 'vrm_prenom', 'Ju');   // un geste arrive pendant l'envoi (la mémoire a bougé entre-temps)
    F.acquitter(st, OW, inst);
    dit(!!F.lireFile(st, OW).cles.vrm_prenom, '6 : un geste fait pendant l\'envoi reste dans la file');
    dit(F.lireFile(st, OW).cles.vrm_prenom.base === 'Julien', '6 : la base d\'origine est gardée (pas celle du second geste)');
  }
  // ── 7. Stockage qui refuse, autre vendeur ─────────────────────────────────
  {
    const st = stockage(); st.getItem = () => { throw new Error('SecurityError'); };
    dit(F.lireFile(st, OW) === null, '7 : lecture du stockage refusée ⇒ « pas su » (null)');
    const avant = st.ecrits;
    dit(F.noterSaisie(st, OW, 'vrm_prenom', 'x') === false && st.ecrits === avant, '7 : …et rien n\'est écrit par-dessus');
    const st2 = stockage(); F.noterSaisie(st2, 'vendeur-b', 'vrm_prenom', 'B');
    st2.setItem('vrm_prenom', JSON.stringify('Bébé'));
    const r = F.fusionAuChargement({ file: F.lireFile(st2, OW), local: { vrm_prenom: 'Bébé' }, nuage: { vrm_prenom: 'Julien' }, majNuage: null, cleNum });
    dit(!('vrm_prenom' in r.vals), '7 : la file d\'un AUTRE vendeur n\'est jamais appliquée');
    const avant2 = st2.getItem(F.CLE_FILE);
    F.noterSaisie(st2, OW, 'vrm_prenom', 'x');
    dit(st2.getItem(F.CLE_FILE) === avant2, '7 : …ni réécrite par ce vendeur-ci');
  }
  // ── 8. Les numéros ────────────────────────────────────────────────────────
  {
    const N = nuage(depart()); const st = stockage(); remplir(st, N.data);
    let A = appareil(M, st, OW, CLES); A.envoyer(N);
    N.panneEcriture = true;
    // Sans réseau : une paire neuve (n1) reçoit le N°4, et un prix sur a1.
    // (et, à la main, la paire a3 passe du N°3 au N°7 — un numéro de la file)
    const f = { ...lit(st, 'vinted_annonce_numeros'), n1: { numero: '4', title: 'Neuve ici' } }; f.a1 = { ...f.a1, buyPrice: '41' }; f.a3 = { ...f.a3, numero: '7', manuelAt: 'x' };
    A.save('vinted_annonce_numeros', f); A.save('vinted_used_numeros', ['1', '2', '3', '4']);
    A.envoyer(N); N.panneEcriture = false;
    // Pendant ce temps, l'autre appareil a donné le N°4 à une AUTRE paire.
    const fn = { ...JSON.parse(JSON.stringify(N.data.vinted_annonce_numeros)), m1: { numero: '4', title: 'Neuve là-bas' } };
    N.data = { ...N.data, vinted_annonce_numeros: fn, vinted_used_numeros: ['1', '2', '3', '4'], rev: N.data.rev + 1 };
    A = appareil(M, st, OW, CLES);
    A.ouvrir(N);
    const vals = A.reprise.vals.vinted_annonce_numeros || {};
    const porteurs = Object.entries(vals).filter(([, e]) => e && cleNum(e.numero) === '4').map(([id]) => id);
    dit(A.reprise.conflits.includes('vinted_annonce_numeros'), '8 : le N°4 donné des deux côtés est REFUSÉ par la fusion', JSON.stringify(A.reprise.conflits));
    dit(porteurs.length === 1 && porteurs[0] === 'm1', '8 : le numéro donné sans réseau n\'est pas rejoué (une seule paire sous le N°4)', porteurs.join(','));
    dit(prixF(vals, 'a1') === '41', '8 : le prix, lui, est rejoué');
    dit(cleNum((vals.a3 || {}).numero) === '3' && !(vals.a3 || {}).manuelAt, '8 : aucun champ de numéro de la file n\'est rejoué quand la fusion refuse', JSON.stringify(vals.a3));
    // Une remise à zéro (013) : la file des fiches est écartée.
    const st3 = stockage(); remplir(st3, depart());
    F.noterSaisie(st3, OW, 'vinted_annonce_numeros', fiches());
    const r = F.fusionAuChargement({ file: F.lireFile(st3, OW), local: { vinted_annonce_numeros: { ...fiches(), z: { numero: '9' } } }, nuage: { vinted_annonce_numeros: {} }, majNuage: null, cleNum, numerosOk: false });
    dit(r.ecartees.includes('vinted_annonce_numeros') && !('vinted_annonce_numeros' in r.vals), '8 : après une remise à zéro, les fiches de la file ne sont pas rejouées');
  }
  // ── 9. Le compte affiché ──────────────────────────────────────────────────
  {
    const st = stockage(); remplir(st, depart());
    F.noterSaisie(st, OW, 'vinted_used_numeros', ['1', '2', '3']); st.setItem('vinted_used_numeros', JSON.stringify([1, 2, 3]));
    F.noterSaisie(st, OW, 'vinted_urssaf_mois', undefined); st.setItem('vinted_urssaf_mois', JSON.stringify({ mois: [1, 2] }));
    F.noterSaisie(st, OW, 'vinted_achat_notes', {}); st.setItem('vinted_achat_notes', JSON.stringify({ a1: 'note' }));
    dit(F.compterEnAttente(st, OW) === 1, '9 : une note = « 1 changement » (le pool réécrit en nombres et un chiffre publié ne comptent pas)', String(F.compterEnAttente(st, OW)));
  }
  return ko;
}

function texteApp() {
  let ko = 0;
  const dit = (c, m) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m); };
  const app = fs.readFileSync(path.join(racine, 'src', 'App.jsx'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  const save = (/const save = \(k,v(?:,quand)?\) => \{[\s\S]*?\n\};/.exec(app) || [''])[0];   // (6 nov., v36) `quand` : l'issue locale du geste annulable
  dit(/noterSaisie\(localStorage, owner, k,/.test(save), 'App.jsx : `save` note le geste dans la file');
  dit(/localStorage\.setItem\(k,txt\)[\s\S]*noterSaisie/.test(save), 'App.jsx : …après l\'avoir gardé dans le navigateur');
  const push = (/const cloudPush = \(\) => \{[\s\S]*?\n\};/.exec(app) || [''])[0];
  const acq = push.split('acquitterFile()').length - 1;
  dit(acq === 2 && /const acquitterFile/.test(push), 'App.jsx : `cloudPush` n\'acquitte que sur ses deux chemins acceptés', String(acq));
  dit(!/planifierReprise\(\);[^\n]*acquitterFile\(\)/.test(push) && !/catch \(_\) \{[^\n]*acquitterFile/.test(push), 'App.jsx : jamais d\'acquittement sur un échec');
  dit(/nuageGagne: nuagePlusRecent\(/.test(push), 'App.jsx : `cloudPush` laisse gagner un nuage plus récent');
  dit(/fusionAuChargement\(\{ file: fileUtile/.test(app) && /repriseFile\.vals\[k\]/.test(app), 'App.jsx : le chargement rejoue la file au lieu de recopier le nuage');
  dit(/<EnAttenteEnvoi\/>(?:\s*\{\/\*[\s\S]*?\*\/\})?\s*(?:<GestesHorsLigneCoque[^>]*\/>\s*)?\{horsLigne(?: &&[^?]*)? \?/.test(app), 'App.jsx : la mention est sur la coque, au-dessus de l\'écran hors ligne aussi');
  dit(/addEventListener\('online'[^\n]*fileNonVide\(\)/.test(app), 'App.jsx : le retour du réseau renvoie la file');
  return ko;
}

const MUTATIONS = [
  ['acquitter sans regarder seq', 'F', (s) => s.replace("if (k in inst && f.cles[k].seq === inst[k])", "if (k in inst)")],
  ['chargement : le nuage recopié (avant)', 'F', (s) => s.replace("vals[k] = r.data[k];", "vals[k] = N[k];")],
  ['chargement : l\'appareil écrase', 'F', (s) => s.replace("vals[k] = r.data[k];", "vals[k] = L[k];")],
  ['plus récent ailleurs ignoré', 'F', (s) => s.replace("return Object.keys(file.cles).filter((k) => Number.isFinite(file.cles[k].at) && t > file.cles[k].at);", "return [];")],
  ['lecture refusée = file vide', 'F', (s) => s.replace("try { t = stock.getItem(CLE_FILE); } catch (_) { return null; }", "try { t = stock.getItem(CLE_FILE); } catch (_) { return { owner, cles: {} }; }")],
  ['autre vendeur appliqué', 'F', (s) => s.replace("if (owner && o.owner && o.owner !== owner) return { owner, cles: {}, autre: o.owner };", "")],
  ['numéros rejoués malgré le refus', 'F', (s) => s.replace("if (CHAMPS_NUMERO.includes(c)) continue;", "")],
  ['refus des numéros ignoré', 'F', (s) => s.replace("if (r.conflit) {", "if (false) {")],
  ['base écrasée à chaque geste', 'F', (s) => s.replace("f.cles[k] = e ? { ...e, at: maintenant, seq }", "f.cles[k] = false ? 0")],
  ['remise à zéro ignorée', 'F', (s) => s.replace("if (numerique && (!numerosOk ||", "if (numerique && (false ||")],
  ['chiffres publiés comptés', 'F', (s) => s.replace("if (CLES_PUBLIEES.includes(k)) continue;", "")],
  ['fusion : nuageGagne sans effet', 'U', (s) => s.replace("const inverse = nuageGagne.includes(k);", "const inverse = false;")],
];

const preparer = (dir, mutF, mutU) => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  const f = fs.readFileSync(SRC, 'utf8'), u = fs.readFileSync(SRC_FUSION, 'utf8');
  fs.writeFileSync(path.join(dir, 'fileEnvoi.js'), mutF ? mutF(f) : f);
  fs.writeFileSync(path.join(dir, 'fusionNuage.js'), mutU ? mutU(u) : u);
  return { f, u };
};

(async () => {
  if (process.argv.includes('--prouve')) {
    let vertes = 0;
    for (const [nom, cible, mut] of MUTATIONS) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-envoi-mut-'));
      const { f, u } = preparer(dir, cible === 'F' ? mut : null, cible === 'U' ? mut : null);
      const change = cible === 'F' ? mut(f) !== f : mut(u) !== u;
      if (!change) { console.log('KO  mutation sans effet (le texte a changé) : ' + nom); vertes++; fs.rmSync(dir, { recursive: true, force: true }); continue; }
      let ko; try { ko = await juger(dir, false); } catch (e) { ko = 1; }
      fs.rmSync(dir, { recursive: true, force: true });
      console.log((ko ? 'OK  ' : 'KO  ') + `mutation « ${nom} » ⇒ ${ko} rouge(s)`);
      if (!ko) vertes++;
    }
    console.log(vertes ? `\n${vertes} mutation(s) passent : le contrôle ne la voit pas` : '\nchaque mutation est vue');
    process.exit(vertes ? 1 : 0);
  }
  if (!fs.existsSync(SRC)) { console.log('KO  src/fileEnvoi.js absent : aucune file d\'envoi'); process.exit(1); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-envoi-'));
  preparer(dir);
  const ko1 = await juger(dir, true);
  fs.rmSync(dir, { recursive: true, force: true });
  const ko2 = texteApp();
  console.log(ko1 + ko2 ? `\n${ko1 + ko2} KO` : '\nTout est vert');
  process.exit(ko1 + ko2 ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
