// ════════════════════════════════════════════════════════════════════════════
//  « ANNULER » PARTOUT, GESTES INSTANTANÉS (src/gesteAnnulable.js) — EXÉCUTÉ
//  (6 nov., v36)
//
//  On exécute le VRAI module avec une fausse minuterie et un faux stockage
//  (lecture-écriture asynchrones, comme `save` puis `cloudPush`) :
//   1. optimiste puis confirmé : l'écran change AVANT toute écriture, la pilule
//      dit « envoi », puis « enregistré » seulement après la confirmation ;
//   2. échec ⇒ l'écran REVIENT en arrière, la pilule dit l'échec et propose
//      « Réessayer » (jamais un faux « enregistré ») ; « Réessayer » rejoue ;
//   3. « Annuler » après l'écriture ⇒ l'INVERSE est écrit (la sous-valeur
//      d'avant), l'écran revient ; avant le départ ⇒ RIEN n'est écrit ;
//   4. deux gestes rapides sur la même clé ⇒ aucun n'est perdu, jamais deux
//      écritures en même temps sur une clé ; retiré → annulé → retiré ⇒ retiré ;
//   5. lecture ratée ⇒ rien n'est écrit (pas même l'inverse), l'écran revient ;
//   6. « pas su » (réseau, 5xx) ⇒ le geste reste (« pas encore envoyé »), pas
//      de retour arrière, jamais « enregistré » ;
//   7. l'écrivain de l'app : un « synced » d'un envoi parti AVANT le geste ne le
//      confirme pas ; refus ⇒ définitif ; stockage refusé ⇒ définitif ;
//   8. comparer-et-échanger sur `rev` (ligne dédiée) : devancé ⇒ relu, rev+1 ;
//      lecture ratée ⇒ rien d'écrit ;
//   9. la pilule : 5 s, suspendue au survol / onglet caché, un échec caché remonte ;
//  10. App.jsx branche le module (save → quand, au moins 8 gestes, la pilule).
//  `--prouve` : chaque mutation de la règle doit rendre au moins un rouge.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const racine = path.join(__dirname, '..');
const SRC = path.join(racine, 'src', 'gesteAnnulable.js');
const APP = path.join(racine, 'src', 'App.jsx');

const pause = () => new Promise((r) => setImmediate(r));
const vider = async (n = 30) => { for (let i = 0; i < n; i++) await pause(); };

// Une fausse minuterie (le temps n'avance que quand on le dit).
const horloge = () => {
  let t = 0, id = 0; const file = new Map();
  return {
    minuterie: (f, ms) => { const k = ++id; file.set(k, { f, a: t + ms }); return k; },
    arreter: (k) => file.delete(k),
    avancer: async (ms) => { const fin = t + ms; for (;;) { const p = [...file.entries()].filter(([, x]) => x.a <= fin).sort((a, b) => a[1].a - b[1].a)[0]; if (!p) break; t = p[1].a; file.delete(p[0]); p[1].f(); await vider(5); } t = fin; await vider(); },
  };
};

// Un faux stockage asynchrone : chaque lecture/écriture prend un tour ; il
// compte les écritures et le nombre MAX d'écritures simultanées par clé.
const stockage = (init = {}) => {
  const m = new Map(Object.entries(init).map(([k, v]) => [k, JSON.stringify(v)]));
  const enVol = new Map(); const s = { ecrits: [], maxSimultane: 0, lectureKo: new Set(), refus: new Set(), passu: new Set() };
  s.lire = async (k) => { await pause(); if (s.lectureKo.has(k)) return undefined; return m.has(k) ? JSON.parse(m.get(k)) : null; };
  s.ecrire = async (k, v) => {
    const n = (enVol.get(k) || 0) + 1; enVol.set(k, n); s.maxSimultane = Math.max(s.maxSimultane, n);
    await pause(); await pause();
    enVol.set(k, enVol.get(k) - 1);
    if (s.refus.has(k)) return { ok: false, definitif: true, raison: 'la base a refusé l’envoi (403)' };
    m.set(k, JSON.stringify(v)); s.ecrits.push([k, v]);
    if (s.passu.has(k)) return { ok: null };
    return { ok: true };
  };
  s.val = (k) => (m.has(k) ? JSON.parse(m.get(k)) : null);
  return s;
};

async function juger(dir, bavard) {
  const G = await import(pathToFileURL(path.join(dir, 'gesteAnnulable.js')).href + '?t=' + Date.now() + Math.random());
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard || !c) console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String((e && e.stack) || e).slice(0, 300)); } };

  // Un « écran » : une carte d'état React simulée par une variable.
  const ecran = (init) => { const e = { v: init, vues: [] }; e.set = (f) => { e.v = f(e.v); }; return e; };
  const geste = (moteur, S, e, ops, texte = 'Colis retiré') => moteur.lancer({ texte, cles: G.clesDe(ops), vue: (sens) => { e.vues.push(sens); G.vueDesOps(ops, { [ops[0].k]: e.set })(sens); }, ecrire: (sens) => G.ecrireOps({ ops, sens, lire: S.lire, ecrire: S.ecrire }) });

  await essaie('1. optimiste puis confirmé', async () => {
    const H = horloge(); const M = G.creerGestes(H); const S = stockage({ retires: [] }); const e = ecran(new Set());
    const ops = [{ k: 'retires', type: 'ensemble', id: 'A', apres: true, avant: false }];
    const id = geste(M, S, e, ops);
    dit(e.v.has('A') && S.ecrits.length === 0, '1a. l’écran change AVANT toute écriture (optimiste)');
    dit(M.etat().visible && M.etat().visible.etat === 'envoi' && M.etat().visible.peutAnnuler, '1b. la pilule dit « envoi » avec « Annuler »', JSON.stringify(M.etat()));
    await vider();
    dit(JSON.stringify(S.val('retires')) === '["A"]', '1c. l’écriture est partie', JSON.stringify(S.val('retires')));
    dit(M.etatDe(id) === 'enregistre', '1d. « enregistré » seulement après l’issue', M.etatDe(id));
  });

  await essaie('1e. confirmation différée', async () => {
    const H = horloge(); const M = G.creerGestes(H); let lacher;
    const id = M.lancer({ texte: 'x', cles: ['k'], vue: () => {}, ecrire: async () => ({ ok: true, confirmation: new Promise((r) => { lacher = r; }) }) });
    await vider();
    dit(M.etatDe(id) === 'envoi', '1e. écrit sur l’appareil, nuage pas encore d’accord ⇒ toujours « envoi » (pas un faux « enregistré »)', M.etatDe(id));
    lacher({ ok: true }); await vider();
    dit(M.etatDe(id) === 'enregistre', '1f. le nuage accepte ⇒ « enregistré »', M.etatDe(id));
  });

  await essaie('2. échec ⇒ retour arrière', async () => {
    const H = horloge(); const M = G.creerGestes(H); const S = stockage({ faits: {} }); const e = ecran({});
    S.refus.add('faits');
    const ops = [{ k: 'faits', type: 'cle', id: '42', apres: 1700, avant: undefined }];
    const id = geste(M, S, e, ops, 'Colis fait');
    dit(e.v['42'] === 1700, '2a. optimiste d’abord');
    await vider();
    dit(e.v['42'] === undefined, '2b. refusé ⇒ l’écran REVIENT en arrière', JSON.stringify(e.v));
    const v = M.etat().visible;
    dit(v && v.etat === 'echec' && v.peutReessayer && !v.peutAnnuler, '2c. la pilule dit l’échec avec « Réessayer », sans « Annuler »', JSON.stringify(v));
    S.refus.delete('faits');
    M.reessayer(id); dit(e.v['42'] === 1700, '2d. « Réessayer » repose le geste tout de suite');
    await vider();
    dit(M.etatDe(id) === 'enregistre' && S.val('faits')['42'] === 1700, '2e. « Réessayer » réécrit', JSON.stringify(S.val('faits')));
  });

  await essaie('2f. une exception de l’écrivain', async () => {
    const H = horloge(); const M = G.creerGestes(H); const vues = [];
    const id = M.lancer({ texte: 'x', cles: ['k'], vue: (s) => vues.push(s), ecrire: async () => { throw new Error('QuotaExceeded'); } });
    await vider();
    dit(M.etatDe(id) === 'echec' && vues.join() === 'apres,avant', '2f. une écriture qui lève ⇒ échec et retour arrière', vues.join());
  });

  await essaie('3. annuler ⇒ inverse écrit', async () => {
    const H = horloge(); const M = G.creerGestes(H); const S = stockage({ at: { X: '2026-11-01' } }); const e = ecran({ X: '2026-11-01' });
    const ops = [{ k: 'at', type: 'cle', id: 'X', apres: '2026-11-06', avant: '2026-11-01' }];
    const id = geste(M, S, e, ops);
    await vider();
    dit(S.val('at').X === '2026-11-06', '3a. le geste est écrit');
    M.annuler(id);
    dit(e.v.X === '2026-11-01', '3b. « Annuler » remet l’écran tout de suite');
    await vider();
    dit(S.val('at').X === '2026-11-01' && S.ecrits.length === 2, '3c. l’INVERSE (la sous-valeur d’avant, pas un effacement) est écrit', JSON.stringify(S.ecrits));
    dit(M.etatDe(id) === 'annule', '3d. la pilule dit « Annulé »', M.etatDe(id));
  });

  await essaie('3e. annuler avant le départ', async () => {
    const H = horloge(); const M = G.creerGestes(H); let lacher; const ecrits = [];
    M.lancer({ texte: 'a', cles: ['k'], vue: () => {}, ecrire: () => new Promise((r) => { lacher = () => r({ ok: true }); }) });
    const vues = [];
    const id2 = M.lancer({ texte: 'b', cles: ['k'], vue: (s) => vues.push(s), ecrire: async (s) => { ecrits.push(s); return { ok: true }; } });
    await vider();
    M.annuler(id2);                      // le second attend le premier dans la file de `k`
    lacher(); await vider();
    dit(ecrits.length === 0, '3e. annulé avant son départ ⇒ RIEN n’est écrit', ecrits.join());
    dit(vues.join() === 'apres,avant' && M.etatDe(id2) === 'annule', '3f. l’écran revient, « Annulé »', vues.join());
  });

  await essaie('4. deux gestes rapides', async () => {
    const H = horloge(); const M = G.creerGestes(H); const S = stockage({ retires: [] }); const e = ecran(new Set());
    const opA = [{ k: 'retires', type: 'ensemble', id: 'A', apres: true, avant: false }];
    const opB = [{ k: 'retires', type: 'ensemble', id: 'B', apres: true, avant: false }];
    geste(M, S, e, opA); geste(M, S, e, opB);
    dit(e.v.has('A') && e.v.has('B'), '4a. l’écran porte les deux tout de suite');
    await vider();
    dit(JSON.stringify(S.val('retires').sort()) === '["A","B"]', '4b. les deux sont écrits (aucun perdu)', JSON.stringify(S.val('retires')));
    dit(S.maxSimultane === 1, '4c. jamais deux écritures en même temps sur une clé', 'max ' + S.maxSimultane);
    // Retiré → Annuler → Retiré, sans attendre.
    const opC = [{ k: 'retires', type: 'ensemble', id: 'C', apres: true, avant: false }];
    const c1 = geste(M, S, e, opC); await pause(); M.annuler(c1); const c2 = geste(M, S, e, opC);
    await vider();
    dit(S.val('retires').includes('C') && e.v.has('C'), '4d. retiré → annulé → retiré ⇒ retiré (écran et stockage d’accord)', JSON.stringify(S.val('retires')));
    dit(M.etatDe(c2) === 'enregistre', '4e. le dernier geste est enregistré', M.etatDe(c2));
    dit(S.maxSimultane === 1, '4f. toujours une écriture à la fois', 'max ' + S.maxSimultane);
  });

  await essaie('4g. deux clés', async () => {
    const H = horloge(); const M = G.creerGestes(H); const S = stockage({ a: [], b: {} });
    const ops = [{ k: 'a', type: 'ensemble', id: 'Z', apres: true, avant: false }, { k: 'b', type: 'cle', id: 'Z', apres: 't1', avant: undefined }];
    const e = { a: new Set(), b: {} };
    const id = M.lancer({ texte: 'x', cles: G.clesDe(ops), vue: G.vueDesOps(ops, { a: (f) => { e.a = f(e.a); }, b: (f) => { e.b = f(e.b); } }), ecrire: (sens) => G.ecrireOps({ ops, sens, lire: S.lire, ecrire: S.ecrire }) });
    await vider(); M.annuler(id); await vider();
    dit(S.val('a').length === 0 && S.val('b').Z === undefined && !e.a.has('Z') && e.b.Z === undefined, '4g. un geste à deux clés s’annule sur les deux', JSON.stringify([S.val('a'), S.val('b')]));
  });

  await essaie('5. lecture ratée', async () => {
    const H = horloge(); const M = G.creerGestes(H); const S = stockage({ a: [], b: {} }); S.lectureKo.add('b');
    const ops = [{ k: 'a', type: 'ensemble', id: 'Z', apres: true, avant: false }, { k: 'b', type: 'cle', id: 'Z', apres: 't1', avant: undefined }];
    const vues = [];
    const id = M.lancer({ texte: 'x', cles: G.clesDe(ops), vue: (s) => vues.push(s), ecrire: (sens) => G.ecrireOps({ ops, sens, lire: S.lire, ecrire: S.ecrire }) });
    await vider();
    dit(S.ecrits.length === 0, '5a. lecture ratée ⇒ RIEN n’est écrit (pas même la clé déjà lue, pas l’inverse)', JSON.stringify(S.ecrits));
    dit(M.etatDe(id) === 'echec' && vues.join() === 'apres,avant', '5b. l’écran revient, la pilule dit l’échec', vues.join() + ' ' + M.etatDe(id));
  });

  await essaie('6. pas su', async () => {
    const H = horloge(); const M = G.creerGestes(H); const S = stockage({ k: {} }); S.passu.add('k'); const e = ecran({});
    const ops = [{ k: 'k', type: 'cle', id: '1', apres: 'oui', avant: undefined }];
    const id = geste(M, S, e, ops);
    await vider();
    dit(M.etatDe(id) === 'garde' && e.v['1'] === 'oui', '6a. pas de réponse ⇒ « pas encore envoyé », le geste reste (file d’envoi)', M.etatDe(id));
    dit(M.etat().visible && M.etat().visible.peutAnnuler, '6b. « Annuler » reste possible');
    dit(G.natureEchec('error', 'pas de connexion internet') === 'passager' && G.natureEchec('error', 'la base ne répond pas (503)') === 'passager' && G.natureEchec('error', 'la base n’a pas répondu') === 'passager', '6c. réseau / 5xx / sans réponse ⇒ passager');
    dit(G.natureEchec('refus') === 'definitif' && G.natureEchec('error', "la base a refusé l'envoi (403) — ta session a peut-être expiré") === 'definitif' && G.natureEchec('error', 'la base a répondu 400') === 'definitif' && G.natureEchec('error', 'le stockage de cet appareil a refusé la modification') === 'definitif', '6d. refus / 4xx / stockage ⇒ définitif');
  });

  await essaie('7. écrivain de l’app', async () => {
    let revision = 10, confirme = 10; const subs = new Set(); let quandEnAttente = null;
    const W = G.creerEcrivainLocal({ lire: (k) => (k === 'casse' ? (() => { throw new Error('x'); })() : null), sauver: (k, v, quand) => { revision++; quandEnAttente = quand; }, estSynchro: () => true, revision: () => revision, confirme: () => confirme, abonnerSync: (f) => { subs.add(f); return () => subs.delete(f); } });
    const emet = (st, r) => [...subs].forEach((f) => f(st, r));
    const p = W.ecrire('k', { a: 1 }); quandEnAttente(true); const r = await p;
    dit(r.ok === true && r.confirmation, '7a. écrit sur l’appareil ⇒ une confirmation à suivre');
    let fini = null; r.confirmation.then((x) => { fini = x; });
    confirme = 10; emet('synced'); await vider();
    dit(fini === null, '7b. le « synced » d’un envoi parti AVANT le geste ne le confirme pas');
    confirme = 11; emet('synced'); await vider();
    dit(fini && fini.ok === true, '7c. confirmé quand le nuage a accepté une écriture partie après lui', JSON.stringify(fini));
    const p2 = W.ecrire('k', {}); quandEnAttente(true); const r2 = await p2; let f2 = null; r2.confirmation.then((x) => { f2 = x; });
    emet('refus', 'recharge'); await vider();
    dit(f2 && f2.ok === false && f2.definitif, '7d. refus ⇒ définitif', JSON.stringify(f2));
    const p3 = W.ecrire('k', {}); quandEnAttente(true); const r3 = await p3; let f3 = null; r3.confirmation.then((x) => { f3 = x; });
    emet('error', 'pas de connexion internet'); await vider();
    dit(f3 && f3.ok === null, '7e. réseau ⇒ pas su (null), jamais oui', JSON.stringify(f3));
    const p4 = W.ecrire('k', {}); quandEnAttente(false); const r4 = await p4;
    dit(r4.ok === false && r4.definitif, '7f. stockage refusé ⇒ définitif', JSON.stringify(r4));
    dit(W.lire('casse') === undefined, '7g. une lecture qui lève ⇒ pas su (undefined)');
    dit(subs.size === 0, '7h. aucun abonnement laissé derrière', String(subs.size));
  });

  await essaie('8. comparer-et-échanger', async () => {
    let ligne = { data: { lus: { a: 1 }, rev: 4 }, rev: 4 }; const ecrits = []; let devancer = 1;
    const r = await G.ecrireCas({ lire: async () => ({ data: ligne.data, rev: ligne.rev }), ecrire: async (d, rev) => { if (devancer-- > 0) { ligne = { data: { lus: { a: 1, b: 2 }, rev: 5 }, rev: 5 }; return { devance: true }; } if (rev !== ligne.rev) return { devance: true }; ecrits.push(d); ligne = { data: d, rev: d.rev }; return { ok: true }; }, patch: (d) => ({ ...d, lus: { ...d.lus, c: 3 } }) });
    dit(r.ok === true && ecrits.length === 1 && ecrits[0].rev === 6 && ecrits[0].lus.b === 2 && ecrits[0].lus.c === 3, '8a. devancé ⇒ relu, fusionné, rev+1 (ce que l’autre a écrit reste)', JSON.stringify(ecrits));
    const e2 = []; const r2 = await G.ecrireCas({ lire: async () => undefined, ecrire: async (d) => { e2.push(d); return { ok: true }; }, patch: (d) => d });
    dit(r2.ok === false && r2.ecrit === false && e2.length === 0, '8b. lecture ratée ⇒ rien d’écrit', JSON.stringify(r2));
  });

  await essaie('9. la pilule', async () => {
    const H = horloge(); const M = G.creerGestes(H); const vus = [];
    M.abonner((s) => vus.push(s.visible ? s.visible.etat : null));
    const id = M.lancer({ texte: 'x', cles: ['k'], vue: () => {}, ecrire: async () => ({ ok: true }) });
    await vider(); await H.avancer(4900);
    dit(M.etat().visible && M.etat().visible.id === id, '9a. encore là à 4,9 s');
    await H.avancer(200);
    dit(M.etat().visible === null, '9b. partie à 5 s', JSON.stringify(M.etat()));
    const id2 = M.lancer({ texte: 'y', cles: ['k'], vue: () => {}, ecrire: async () => ({ ok: true }) });
    M.suspendre(true); await H.avancer(20000);
    dit(M.etat().visible && M.etat().visible.id === id2, '9c. suspendue (survol, onglet caché) : elle reste');
    M.suspendre(false); await H.avancer(6000);
    dit(M.etat().visible === null, '9d. reprise : elle part');
    // Un échec d'un geste caché remonte.
    let lacher; const id3 = M.lancer({ texte: 'z', cles: ['q'], vue: () => {}, ecrire: () => new Promise((r) => { lacher = r; }) });
    M.lancer({ texte: 'w', cles: ['r'], vue: () => {}, ecrire: async () => ({ ok: true }) });
    await vider(); lacher({ ok: false, definitif: true, raison: 'refusé' }); await vider();
    dit(M.etat().visible && M.etat().visible.id === id3 && M.etat().visible.etat === 'echec', '9e. l’échec d’un geste caché par un autre remonte (jamais tu)', JSON.stringify(M.etat()));
    dit(G.DUREE_PILULE === 5000, '9f. 5 s');
  });

  await essaie('10. opérations', async () => {
    const a = G.appliquerOp(['A'], { type: 'ensemble', id: 'A', apres: true, avant: false });
    dit(JSON.stringify(a) === '["A"]', '10a. idempotent : poser deux fois ne double pas', JSON.stringify(a));
    const f = G.appliquerOp({ '5': { numero: '12', reattribue: { de: '4' } } }, { type: 'champs', id: '5', apres: { reattribue: { de: '4', ecrit: 't' } }, avant: { reattribue: { de: '4' } } }, 'avant');
    dit(f['5'].numero === '12' && f['5'].reattribue.ecrit === undefined, '10b. « C’est écrit » annulé ⇒ la fiche garde son N°, la ligne revient dans « à écrire »', JSON.stringify(f));
    const g = G.appliquerOp({}, { type: 'champs', id: '9', apres: { x: 1 }, avant: { x: undefined } });
    dit(!('9' in g), '10c. une fiche absente n’est jamais créée par un geste', JSON.stringify(g));
  });
  return ko;
}

// Le branchement dans l'app (lu dans le texte, commentaires retirés).
function texteApp() {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
  const brut = fs.readFileSync(APP, 'utf8');
  const s = brut.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
  dit(/from\s+["']\.\/gesteAnnulable\.js["']/.test(s), '11a. App.jsx importe src/gesteAnnulable.js');
  dit(/const save = \(k,\s*v,\s*quand\)/.test(s) && /_rendreQuand\(k, true\)/.test(s) && /_rendreQuand\(k, false/.test(s), '11b. `save` rend son issue locale (quand(true|false))');
  const n = (s.match(/[^\w.]gesteVrm\(/g) || []).length;
  dit(n >= 8, `11c. au moins 8 gestes branchés (${n})`);
  dit(/<PiluleAnnuler\b/.test(s), '11d. la pilule est rendue');
  dit(!/lastCollected &&/.test(s), '11e. l’ancien bandeau « Colis retiré » (son propre minuteur) n’est plus rendu');
  return ko;
}

const MUTATIONS = [
  ['pas de retour arrière sur échec', (s) => s.replace("g.gen++;\n      try { g.vue('avant'); } catch (_) {}\n      if (r.ecrit !== false) enfiler(g, 'avant'", "g.gen++;\n      if (r.ecrit !== false) enfiler(g, 'avant'")],
  ['pas de file par clé', (s) => s.replace("const attendre = Promise.all(g.cles.map((k) => queues.get(k) || Promise.resolve()));", "const attendre = Promise.resolve();")],
  ['annuler n’écrit pas l’inverse', (s) => s.replace("g.job = enfiler(g, 'avant', g.gen, issueAnnulation);\n      changer(g, 'annulation');", "changer(g, 'annule');")],
  ['annuler avant départ écrit quand même', (s) => s.replace("g.job.abandonne = true; g.etat = 'annule';", "g.etat = 'annule';")],
  ['lecture ratée écrit quand même', (s) => s.replace("if (v === undefined) return { ok: false, definitif: true, ecrit: false, raison: 'lecture' };\n    lues[k] = v;", "lues[k] = v === undefined ? null : v;")],
  ['un « synced » d’avant confirme', (s) => s.replace("if (rev != null && confirme() >= rev) { finir({ ok: true }); return; }", "if (statut === 'synced') { finir({ ok: true }); return; }")],
  ['pas su vaut oui', (s) => s.replace("} else changer(g, 'garde');", "} else changer(g, 'enregistre');")],
  ['ensemble basculé (non idempotent)', (s) => s.replace("return dedans ? [...a, id] : a;", "return l.includes(id) ? a : [...a, id];")],
  ['confirmation ignorée', (s) => s.replace("if (r.ok === true && r.confirmation) {", "if (false) {")],
  ['réseau compté définitif', (s) => s.replace("return 'passager';\n}", "return 'definitif';\n}")],
  ['échec caché tu', (s) => s.replace("else if (etat === 'echec' || etat === 'echec-annulation') montrer(g);", "")],
  ['devancé non relu', (s) => s.replace("if (r && r.devance) continue;", "if (r && r.devance) return { ok: true, ecrit: true };")],
];

const preparer = (dir, mut) => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  const f = fs.readFileSync(SRC, 'utf8');
  fs.writeFileSync(path.join(dir, 'gesteAnnulable.js'), mut ? mut(f) : f);
  return f;
};

(async () => {
  if (!fs.existsSync(SRC)) { console.log('KO  src/gesteAnnulable.js absent : aucun geste annulable'); process.exit(1); }
  if (process.argv.includes('--prouve')) {
    let vertes = 0;
    for (const [nom, mut] of MUTATIONS) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'geste-mut-'));
      const f = preparer(dir, mut);
      if (mut(f) === f) { console.log('KO  mutation sans effet (le texte a changé) : ' + nom); vertes++; fs.rmSync(dir, { recursive: true, force: true }); continue; }
      let ko; try { ko = await juger(dir, false); } catch (e) { ko = 1; }
      fs.rmSync(dir, { recursive: true, force: true });
      console.log((ko ? 'OK  ' : 'KO  ') + `mutation « ${nom} » ⇒ ${ko} rouge(s)`);
      if (!ko) vertes++;
    }
    console.log(vertes ? `\n${vertes} mutation(s) passent : le contrôle ne la voit pas` : '\nchaque mutation est vue');
    process.exit(vertes ? 1 : 0);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'geste-'));
  preparer(dir);
  const ko1 = await juger(dir, true);
  fs.rmSync(dir, { recursive: true, force: true });
  const ko2 = texteApp();
  console.log(ko1 + ko2 ? `\n${ko1 + ko2} KO` : '\nTout est vert');
  process.exit(ko1 + ko2 ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
