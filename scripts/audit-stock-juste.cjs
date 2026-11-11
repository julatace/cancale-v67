#!/usr/bin/env node
// ── audit-stock-juste — LOT DJ4 « Stock juste » (11 nov. 2026) ────────────────────
// Julien, 11 nov. : « Dans Stock je veux que ce soit que les paires en ligne, une seule si
// elle est présente sur tous les sites, mais là tu me proposes de vieilles annonces. »
// « L'inventaire physique n'est pas fiable. Pareil pour audit d'inventaire. Pareil répartir
// un lot. » « Je ne sais pas si À trancher sert à quelque chose, surtout un onglet exprès. »
// « Quand l'app me demande si mon article est toujours chez moi après que je l'ai supprimé,
// je veux qu'elle me demande si je veux l'enlever du stock. » « Le bouton Annuler reste
// constamment sur l'app. »
// Exécute les VRAIES règles (src/stockAnnonces.js, src/cycleArticle.js, src/gesteAnnulable.js)
// sur des données INVENTÉES, et lit le code des écrans. Ce qu'il exige :
//   A · le Stock = en ligne : `partagerParEtat` sépare en ligne / à confirmer / masquées ;
//       une paire sur Vinted, Leboncoin, eBay et Vestiaire (même N°) = UN article, 4 sites ;
//       50 paires au même titre, N° différents = 50 articles (jamais réunies par le titre) ;
//       un vieux compte (lu il y a 90 j) ne met RIEN dans « en ligne ».
//   B · « Tu l'as encore ? » (`opsChezToi`) : garder ⇒ chez-moi seul ; enlever = UN toucher (raison facultative, inconnue ⇒ rien) ⇒
//       sinon ; séparée + déclarée partie par IDENTITÉ + case libérée, le N°
//       jamais touché (`vinted_annonce_numeros` absent des opérations) ; une clé de
//       déclaration portée par une AUTRE annonce n'est jamais écrasée ; « plus tard » ⇒ la
//       question se tait (cartesSupprimees) puis revient après 20 h ; une vendue prouvée et
//       une republiée (même N°) ne sont jamais demandées.
//   C · la pilule « Annuler » : une pause (focus, survol) ne dure jamais plus de PAUSE_MAX ;
//       la pilule relit son focus réel à chaque changement (PiluleAnnuler.jsx).
//   D · la vue : plus d'écran « À trancher » ni d'entrée de menu, ses cartes en tête de Ma
//       journée (ouvertes en place) et sur la fiche ; « Répartir un lot », « Inventaire
//       physique », « Audit du stock » hors du menu d'Annonces ; leurs modales et données restent.
//   node scripts/audit-stock-juste.cjs
//   node scripts/audit-stock-juste.cjs --mutation=NOM   (une règle réaffaiblie : doit rougir)
//   node scripts/audit-stock-juste.cjs --prouve         (toutes les mutations)
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const lire = (r) => fs.readFileSync(path.join(RACINE, r), 'utf8');

// [fichier, ancre, remplacement]
const MUTATIONS = {
  'tout-en-ligne': ['src/stockAnnonces.js', "    if (a.etat === 'enligne') enLigne.push(a);", '    if (a) enLigne.push(a);'],
  'raison-facultative': ['src/cycleArticle.js', '  if (!R) return null;\n', "  if (!R) return { texte: '', ops: [] };\n"],
  'non-deux-gestes': ['src/cycleArticle.js', "const R = raison == null ? ['sortie', 'Sortie'] :", 'const R ='],
  'case-gardee': ['src/cycleArticle.js', "  if (kn && S[kn]) ops.push(", '  if (false) ops.push('],
  'plus-tard-muet': ['src/cycleArticle.js', '    if (repousseeJusqua(o.plusTard, id, o.maintenant) > 0) { plusTard++; continue; }\n', ''],
  'pause-annulation': ['src/gesteAnnulable.js', 'if ((pause && pausable()) || visible == null) return;', 'if (pause || visible == null) return;'],
  'pause-sans-fin': ['src/gesteAnnulable.js', "garde = minuterie(() => { garde = null; if (!pause) return; pause = false; if (visible != null) armer(Math.max(1200, resteMs)); }, pauseMax);", 'garde = null;'],
};

async function main(dir) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d != null ? ' — ' + String(d).slice(0, 300) : '')); };
  const imp = (f) => import(pathToFileURL(path.join(dir, f)).href);
  const S = await imp('src/stockAnnonces.js');
  const Y = await imp('src/cycleArticle.js');
  const G = await imp('src/gesteAnnulable.js');
  const cle = (n) => { const s = String(n == null ? '' : n).toUpperCase().replace(/[\s\-_.]/g, ''); return /^\d+$/.test(s) ? String(parseInt(s, 10)) : s; };

  // ── A ───────────────────────────────────────────────────────────────────────
  {
    const it = (id, title, photo) => ({ id, title, photo });
    const vinted = [
      { uid: '1', nom: 'compte_a', ok: true, lu: Date.now() - 60e3, enLigne: [it(101, 'Nike Dunk 42', 'p/101.jpg')], aConfirmer: [], masquees: [it(103, 'Vieille masquée', 'p/103.jpg')] },
      { uid: '2', nom: 'vieux_compte', ok: true, lu: Date.now() - 90 * 86400e3, enLigne: [], aConfirmer: [it(201, 'Annonce d’août', 'p/201.jpg')], masquees: [] },
    ];
    const numeros = { 101: { numero: '12' }, 103: { numero: '40' }, 201: { numero: '7' } };
    const aa = S.annoncesActuelles({ vinted, numeros, ebay: { liste: [{ numero: 'VRM-12'.replace('VRM-', ''), title: 'Nike Dunk 42 eBay', photo: null }], illisibles: [] },
      lbc: [{ numero: '12', title: 'Dunk lbc', photo: null }], vestiaire: { lue: true, lu: Date.now(), vieille: false, complet: true, liste: [{ id: 'v9', numero: '12', titre: 'Dunk VC', photo: null, etat: 'enligne' }], sansNumero: [], nonJugees: [] },
      vendus: new Set(), cle });
    const P = typeof S.partagerParEtat === 'function' ? S.partagerParEtat(aa.articles) : null;
    dit(!!P, 'A0 · `partagerParEtat` existe (src/stockAnnonces.js)');
    if (P) {
      const n12 = P.enLigne.filter((a) => a.cle === '12');
      dit(n12.length === 1 && ['vinted', 'leboncoin', 'ebay', 'vestiaire'].every((x) => n12[0].plateformes.includes(x)), 'A1 · même N° sur Vinted, Leboncoin, eBay et Vestiaire ⇒ UN article, quatre sites', JSON.stringify(n12.map((a) => a.plateformes)));
      dit(P.enLigne.length === 1 && P.enLigne.every((a) => a.etat === 'enligne'), 'A2 · « en ligne » ne porte QUE des annonces en ligne (ni à confirmer, ni masquées)', JSON.stringify(P.enLigne.map((a) => [a.cle, a.etat])));
      dit(P.aConfirmer.length === 1 && P.aConfirmer[0].cle === '7', 'A3 · le vieux compte (lu il y a 90 j) est dit à part, « à confirmer »', JSON.stringify(P.aConfirmer));
      dit(P.masquees.length === 1 && P.masquees[0].cle === '40', 'A4 · la masquée par Vinted est dite à part', JSON.stringify(P.masquees));
      // 50 paires au même titre, même modèle, N° et photos différents.
      const v50 = [{ uid: '1', nom: 'c', ok: true, lu: Date.now(), enLigne: Array.from({ length: 50 }, (_, i) => it(5000 + i, 'Nike Dunk Low Panda taille 42', `p/${5000 + i}.jpg`)), aConfirmer: [], masquees: [] }];
      const n50 = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [5000 + i, { numero: String(100 + i) }]));
      const a50 = S.annoncesActuelles({ vinted: v50, numeros: n50, ebay: { liste: [], illisibles: [] }, lbc: [], vestiaire: undefined, vendus: new Set(), cle, clePhoto: (p) => p });
      dit(S.partagerParEtat(a50.articles).enLigne.length === 50, 'A5 · 50 paires au même titre ⇒ 50 articles (aucune fusion par le titre)', a50.articles.length);
    }
  }

  // ── B ───────────────────────────────────────────────────────────────────────
  {
    const T0 = Date.parse('2026-11-11T10:00:00Z');
    const carte = { id: '7002', numero: '12', title: 'Nike Air Max 42' };
    const f = typeof Y.opsChezToi === 'function' ? Y.opsChezToi : null;
    dit(!!f, 'B0 · `opsChezToi` existe (src/cycleArticle.js)');
    if (f) {
      const base = { carte, decisions: { 9: { choix: 'chez-moi' } }, perdues: { 12: { id: '6000', at: 'x' } }, slots: { 12: { m: 'm1', i: 3 }, 13: { m: 'm1', i: 4 } }, plusTard: {}, cle, maintenant: T0,
        cleDeclaration: (n) => String(n) };
      const g = f({ ...base, reponse: 'garde' });
      dit(g && g.ops.length === 1 && g.ops[0].k === 'vrm_cycle_decisions' && g.ops[0].apres.choix === 'chez-moi' && g.ops[0].avant === undefined, 'B1 · « Oui, je la garde » ⇒ chez-moi, rien d’autre (N° gardé)', JSON.stringify(g));
      // (11 nov., « gagner du temps ») « Non, enlève-la du stock » = UN toucher, sans raison.
      const e1 = f({ ...base, reponse: 'enleve' });
      dit(!!e1 && e1.ops.some((o) => o.k === 'vrm_cycle_decisions' && o.apres.choix === 'separe') && e1.ops.some((o) => o.k === 'vrm_slots'), 'B2 · « Non » en UN toucher ⇒ séparée, case libérée', JSON.stringify(e1));
      dit(f({ ...base, reponse: 'enleve', raison: 'inventee' }) === null, 'B2b · une raison inconnue ⇒ rien n’est écrit');
      const AT = lire('src/ATrancher.jsx');
      dit(/data-a-trancher-non=\{carte\.id\} onClick=\{\(\) => onTrancher\(carte, 'non'\)\}/.test(AT) && !/setRaisons/.test(AT), 'B2c · le bouton « Non » tranche tout de suite (pas d’étape « raison »)');
      const e = f({ ...base, reponse: 'enleve', raison: 'donnee' });
      const ks = e ? e.ops.map((o) => o.k) : [];
      const dec = e && e.ops.find((o) => o.k === 'vrm_cycle_decisions');
      const pl = e && e.ops.find((o) => o.k === 'vinted_pairs_lost');
      const sl = e && e.ops.find((o) => o.k === 'vrm_slots');
      dit(!!dec && dec.apres.choix === 'separe' && dec.apres.raison === 'donnee', 'B3 · « Non » + raison ⇒ séparée, la raison notée', JSON.stringify(dec));
      dit(!!pl && pl.apres.id === '7002' && pl.id === '12@7002' && pl.avant === undefined, 'B4 · déclarée partie par IDENTITÉ ; la clé « 12 » d’une AUTRE annonce (6000) n’est pas écrasée', JSON.stringify(pl));
      dit(!!sl && sl.id === '12' && sl.apres === undefined && sl.avant && sl.avant.i === 3, 'B5 · sa case est libérée (et « Annuler » la rend : avant = la case)', JSON.stringify(sl));
      dit(!ks.includes('vinted_annonce_numeros') && !ks.includes('vinted_annonces_vendues'), 'B6 · le N° n’est jamais touché, aucune vente inventée', ks.join(','));
      dit(Y.RAISONS_SORTIE.map((r) => r[0]).join() === 'donnee,vendue-ailleurs,perdue,rendue', 'B7 · les quatre raisons au choix rapide');
      dit(e && G.appliquerOps(G.appliquerOps(base.slots, e.ops, 'apres', 'vrm_slots'), e.ops, 'avant', 'vrm_slots')[12].i === 3, 'B8 · « Annuler » remet la case exacte');
      // Plus tard.
      const t = f({ ...base, reponse: 'plus-tard' });
      dit(t && t.ops.length === 1 && t.ops[0].k === Y.PLUS_TARD, 'B9 · « Plus tard » n’écrit que son report', JSON.stringify(t));
      const fiches = { 7002: { numero: '12', accountId: '111', photoK: 'pk12' }, 7004: { numero: '14', accountId: '111' }, 7008: { numero: '18', accountId: '111' }, 7009: { numero: '18', accountId: '111' } };
      const lec = new Map([['111', { lu: T0 - 60e3, complet: true, enLigne: new Set(['7009']), masquees: new Set(), aConfirmer: new Set(), venduesDressing: new Set() }]]);
      const x = { lectures: lec, presentes: Y.indexPresentes(fiches, lec, cle), supprimees: new Map([['111', { 7002: new Date(T0 - 3600e3).toISOString(), 7004: new Date(T0 - 3600e3).toISOString(), 7008: new Date(T0 - 3600e3).toISOString() }]]),
        vus: {}, decisions: {}, declaree: () => false, vendusMain: new Set(), exclus: new Set(), cle, recrees: {}, viaVrm: new Set(), ventes: { ids: new Set(['7004']), nums: new Set(), revenues: new Set() }, maintenant: T0 };
      const c0 = Y.cartesSupprimees(fiches, x);
      dit(c0.cartes.map((c) => c.id).join() === '7002', 'B10 · demandée : la supprimée sans preuve (7002) ; jamais la vendue prouvée (7004) ni la republiée sous son N° (7008→7009)', JSON.stringify(c0.cartes.map((c) => c.id)));
      const c1 = Y.cartesSupprimees(fiches, { ...x, plusTard: { 7002: new Date(T0 - 3600e3).toISOString() } });
      dit(c1.cartes.length === 0 && c1.plusTard === 1, 'B11 · « Plus tard » ⇒ la question se tait', JSON.stringify(c1));
      const c2 = Y.cartesSupprimees(fiches, { ...x, plusTard: { 7002: new Date(T0 - 21 * 3600e3).toISOString() } });
      dit(c2.cartes.length === 1, 'B12 · … et revient après 20 h', JSON.stringify(c2));
      dit(Y.etatCycle('7002', { ...x, fiche: fiches[7002], decisions: { 7002: e.ops[0].apres } }).etat === 'sortie', 'B13 · une fois « enlevée », elle n’est plus demandée (sortie du stock)');
    }
  }

  // ── C ───────────────────────────────────────────────────────────────────────
  {
    let t = 0; const timers = [];
    const H = { minuterie: (fn, ms) => { const o = { fn, at: t + ms, vivant: true }; timers.push(o); return o; }, arreter: (o) => { if (o) o.vivant = false; } };
    const avancer = async (ms) => { const fin = t + ms; for (;;) { const p = timers.filter((o) => o.vivant && o.at <= fin).sort((a, b) => a.at - b.at)[0]; if (!p) break; t = p.at; p.vivant = false; p.fn(); await new Promise((r) => setImmediate(r)); } t = fin; };
    const realNow = Date.now; Date.now = () => t;
    try {
      const M = G.creerGestes(H);
      M.lancer({ texte: 'x', cles: ['k'], vue: () => {}, ecrire: async () => ({ ok: true }) });
      await new Promise((r) => setImmediate(r));
      M.suspendre(true);                          // le focus du bouton « Annuler »… jamais rendu
      await avancer(30000);
      dit(!!M.etat().visible, 'C1 · une pause courte garde la pilule (survol, focus)');
      await avancer((G.PAUSE_MAX || 0) + 7000);
      dit(G.PAUSE_MAX > 0 && M.etat().visible === null, 'C2 · une pause jamais levée ne fige plus la pilule : elle part après PAUSE_MAX', JSON.stringify(M.etat()));
      const id2 = M.lancer({ texte: 'y', cles: ['k'], vue: () => {}, ecrire: async () => ({ ok: true }) });
      await avancer(5200);
      dit(M.etat().visible === null && id2 > 0, 'C3 · le geste SUIVANT part à 5 s (la pause ne lui reste pas)', JSON.stringify(M.etat()));
      // « Annulation… » / « Annulé » : rien à toucher ⇒ jamais en pause (le clic d'« Annuler » posait la pause).
      let lacher; const id3 = M.lancer({ texte: 'z', cles: ['q'], vue: () => {}, ecrire: () => new Promise((r) => { lacher = r; }) });
      await new Promise((r) => setImmediate(r));
      M.suspendre(true); M.annuler(id3);
      await avancer(5200);
      dit(M.etat().visible === null, 'C5 · « Annulation… » sous le pointeur part quand même (rien à y toucher)', JSON.stringify(M.etat()));
      M.suspendre(false); if (lacher) lacher({ ok: true });
    } finally { Date.now = realNow; }
    const pil = fs.readFileSync(path.join(dir, 'src/PiluleAnnuler.jsx'), 'utf8');
    dit(/document\.activeElement/.test(pil) && /\[v && v\.id, v && v\.etat/.test(pil), 'C4 · la pilule relit son focus RÉEL à chaque changement (un bouton disparu ne laisse pas de focus fantôme)');
  }

  // ── D ───────────────────────────────────────────────────────────────────────
  {
    const app = fs.readFileSync(path.join(dir, 'src/App.jsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const groupes = (/const GROUPES_PLUS=\[([\s\S]*?)\n\];/.exec(app) || [])[1] || '';
    dit(groupes && !/id:'trancher'/.test(groupes), 'D1 · « À trancher » n’est plus une entrée du menu');
    dit(!/tab==='trancher'&&<GardeEcran/.test(app) && /if\(tab==='trancher'\)\{[\s\S]{0,260}?setTab\('journee'\)/.test(app), 'D2 · plus d’écran « À trancher » : un ancien lien ouvre Ma journée');
    dit(/data-job="a-trancher"/.test(app) && /<ATrancher etat=\{aTrancher\}/.test(app) && /setTrancherOuvert\(\(o\) => !o\)/.test(app), 'D3 · Ma journée : la carte « à trancher » s’ouvre EN PLACE sur les mêmes cartes');
    dit(/questionChezToiFiche\(p\.num\)/.test(app), 'D4 · la même question sur la fiche de la paire');
    const menu = (/\{k:'studio', icon:'camera'[\s\S]{0,200}/.exec(app) || [''])[0];
    dit(!!menu && !/lab:'Répartir un lot'|lab:'Inventaire physique'|lab:'Audit du stock'/.test(app), 'D5 · « Répartir un lot », « Inventaire physique », « Audit du stock » : hors du menu');
    dit(!/setLotOpen\(true\)|setInventOpen\(true\)|setAuditOpen\(true\)/.test(app), 'D6 · plus rien ne les ouvre');
    dit(/const \[lotOpen/.test(app) && /const \[inventOpen/.test(app) && /const \[auditOpen/.test(app), 'D7 · leurs modales (et données) restent : rien n’est supprimé');
    const stock = fs.readFileSync(path.join(dir, 'src/ecrans/Stock.jsx'), 'utf8');
    dit(/partagerParEtat\(/.test(stock) && /f\.etatAnnonce === 'enligne'/.test(stock) && /data-stock-repli=/.test(stock), 'D8 · l’écran Stock : liste et « à ranger » en ligne seulement, le reste en replis');
  }
  return ko;
}

(async () => {
  const arg = process.argv.slice(2);
  const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').slice(11);
  const muter = (nom) => {
    const [f, a, b] = MUTATIONS[nom];
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-juste-'));
    for (const r of ['src', 'api']) fs.cpSync(path.join(RACINE, r), path.join(dir, r), { recursive: true });
    const p = path.join(dir, f); const s = fs.readFileSync(p, 'utf8');
    if (!s.includes(a)) { console.log('❌ ancre de mutation introuvable : ' + nom); process.exit(2); }
    fs.writeFileSync(p, s.replace(a, b));
    return dir;
  };
  if (arg.includes('--prouve')) {
    let tient = 0;
    for (const nom of Object.keys(MUTATIONS)) {
      const r = spawnSync(process.execPath, [__filename, '--mutation=' + nom], { encoding: 'utf8' });
      const rouge = r.status !== 0;
      console.log((rouge ? '✅ ' : '❌ ') + `mutation « ${nom} » : ${rouge ? 'l’audit rougit' : 'RESTE VERT'}`);
      if (!rouge) tient++;
    }
    process.exit(tient ? 1 : 0);
  }
  const dir = mut ? muter(mut) : RACINE;
  const ko = await main(dir);
  console.log(ko ? `\n${ko} rouge(s)` : '\nStock juste : en ligne seulement, une question claire, aucune pilule figée.');
  process.exit(ko ? 1 : 0);
})();
