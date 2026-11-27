// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « À RETIRER » : la fin d'un colis prouvée par ses autres identités,
//  le doute « même point » élargi, un point = une carte (5 nov.).
//  Julien, 5 nov. au soir : « ça me met que j'ai 33 colis à retirer j'en ai à peine
//  10 et ça me met 2 points de retrait alors que c'est le même ».
//  Cas INVENTÉS qui reproduisent les siens (dépôt public : aucun nom, aucune adresse
//  réelle). EXÉCUTE les vraies règles :
//   A. src/retraitPreuves.js — fin par le n° de suivi de la commande reliée ; fin par
//      le code de retrait d'une autre ligne ; une ligne par code ;
//   B. api/_lib/achat-arrive-relais.js `regrouperArrivees` — le doute compte les
//      témoins FINIS, la même adresse de réception, le même LIEU écrit autrement ;
//      une moitié Vinted reliée à une commande sans n° de suivi est un doute ;
//   C. src/relaisColis.js `regrouperRelais` — un point écrit de trois façons = un point,
//      deux adresses vraiment différentes = deux points ;
//   D. src/App.jsx (commentaires retirés) — `pickupUnion` les appelle ; l'écran Achats
//      ne relie plus un colis par son TITRE ; l'équipe ne prend plus `needs_action`
//      pour « à retirer » ; CarteRelais range un point dans UNE section.
//  `--prouve` : chaque règle affaiblie (copie mutée) doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const lire = (r) => fs.readFileSync(path.join(RACINE, r), 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\{\s*\}/g, '{}');

async function charger(sources) {
  // Copies dans un dossier temporaire (pour les mutations) ; aucun import croisé.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-retrait-preuves-'));
  const mods = {};
  for (const [nom, src] of Object.entries(sources)) {
    const f = path.join(dir, nom + '.mjs'); fs.writeFileSync(f, src);
    mods[nom] = await import(pathToFileURL(f).href + '?v=' + Math.random());
  }
  return mods;
}

async function controles(src, dit) {
  let M;
  try { M = await charger({ preuves: src.preuves, arrivee: src.arrivee, relais: src.relais }); }
  catch (e) { dit(false, 'les modules se chargent', String(e.message || e).slice(0, 160)); return; }
  const P = M.preuves, A = M.arrivee, R = M.relais;
  const norm = (s) => String(s || '').toUpperCase().replace(/\s+/g, '');
  const codeDe = (t) => norm(t && t.code), suiviDe = (t) => norm(t && t.suivi);
  // fins : le n° → { retire } (la forme de finsColis, réduite à ce qui est jugé ici)
  const fins = new Map([['11111111', { retire: true, retours: [], incidents: [] }], ['VGS000000000001', { retire: true, retours: [], incidents: [] }]]);
  const sortiParSuivis = (ks, f) => { for (const k of ks) { const x = f.get(norm(k)); if (x && x.retire) return 'retire'; } return null; };
  const suivisDeAchat = (o) => (o && o.suivis) || [];
  const base = { codeDe, suiviDe, suivisDeAchat, fins, sortiParSuivis };

  // ── A. La fin par une AUTRE identité ──────────────────────────────────────
  if (typeof P.finParIdentite !== 'function') { dit(false, 'A0 src/retraitPreuves.js exporte finParIdentite'); return; }
  const cmdRetiree = { transaction_id: 900001, suivis: ['11111111'] };
  const vinted = { source: 'vinted-commande', conv: 'c-1', lieu: 'POINT A, 1 RUE UN, 35000 VILLEA', suivi: '' };
  dit(P.finParIdentite(vinted, { ...base, commande: cmdRetiree, codes: new Map() }) === 'retire',
    'A1 « t\'attend » relié à SA commande, dont le n° de suivi est « livré au destinataire » ⇒ fini');
  const codes = P.indexCodesSuivis([{ code: 'B12345', suivi: 'VGS000000000001' }, { code: '777777', suivi: '22222222' }], { codeDe, suiviDe });
  dit(P.finParIdentite({ code: 'B12345', suivi: '' }, { ...base, commande: null, codes }) === 'retire',
    'A2 « Utilise le code B12345 » et la consigne au MÊME code retirée ⇒ fini (un code = un colis)');
  dit(P.finParIdentite({ code: 'Z99999', suivi: '' }, { ...base, commande: { transaction_id: 1, suivis: [] }, codes }) === null,
    'A3 sans identité commune : rien n\'est décidé (jamais par le titre, le lieu ou la date)');
  dit(P.finParIdentite({ code: '777777', suivi: '22222222' }, { ...base, commande: null, codes }) === null,
    'A4 son propre n° n\'est pas rejugé ici (22222222 pas fini)');
  const idx2 = P.indexCodesSuivis([], { codeDe, suiviDe, achats: [{ code: 'C55555', suivis: ['11111111'] }], codeAchat: (o) => o.code, suivisDeAchat });
  dit(P.finParIdentite({ code: 'C55555' }, { ...base, codes: idx2 }) === 'retire', 'A5 le code lu dans la conversation d\'une commande la relie à SES n° de suivi');
  const L = [{ id: 'a', code: 'B12345', suivi: '', lieu: 'x' }, { id: 'b', code: 'B12345', suivi: 'VGS000000000001' }, { id: 'c', code: 'D1', suivi: '1' }, { id: 'd', code: 'D1', suivi: '2' }];
  const F = P.fusionnerParCode(L, { codeDe, suiviDe, fusion: (m, s) => ({ ...s, ...m, fusion: [m.id, s.id] }) });
  dit(F.length === 3 && F.some((t) => t.id === 'b' && t.fusion) && !F.some((t) => t.id === 'a'), 'A6 une ligne par code de retrait (celle qui a le n° garde la place)', JSON.stringify(F.map((t) => t.id)));
  dit(F.some((t) => t.id === 'c') && F.some((t) => t.id === 'd'), 'A7 même code, deux n° différents : rien n\'est fusionné');
  // ── A8–A20 (27 nov., capture de Julien, Achats, point « Joubert Peintures ») ─────────────────────────────
  // La MÊME paire, au MÊME code 978 216, deux fois : la moitié Vinted (« ton achat t'attend », SANS code écrit, sans limite,
  // reliée à SA commande par la conversation) comptée « Au point · 20 nov. », et l'e-mail Vinted Go (n°, code « 978 216 »,
  // QR, arrivé le 19, limite LUE le 25) sous « Pas compté ». Forme réelle (passation du 23 nov.), valeurs inventées.
  if (typeof P.reunirParIdentite !== 'function') { dit(false, 'A8 src/retraitPreuves.js exporte reunirParIdentite (une moitié « à vérifier » et une moitié comptée du même colis : un colis)'); }
  else {
    const NOW = Date.UTC(2026, 10, 27, 8);
    const POINT = 'Relais Vinted Go, Commerce du Banc, 1 Rue Imaginaire';
    const convCode = new Map([['900001', '978216']]);                 // le code lu dans la conversation de SA commande
    const cmdDe = (t) => (t && t.conv === 'c-900001' ? '900001' : (t && t.tx) || '');
    const codesDe = (t) => [norm(t && t.code), convCode.get(cmdDe(t)) || ''];
    const txDe = (t) => cmdDe(t);
    const score = (t) => (norm(t.code) ? 4 : 0) + (t.lieu ? 2 : 0) + (t.qr ? 1 : 0);
    const fiable = (t) => t.source !== 'vinted-commande';
    const fus = (m, s) => ({ ...s, ...m, code: m.code || s.code, qr: m.qr || s.qr, lieu: m.lieu || s.lieu, limite: m.limite || s.limite });
    const juger = (now) => (t) => (t.limite && Date.parse(t.limite + 'T23:59:59Z') < now ? { etat: 'delai_depasse' } : null);
    const cle = (t) => t.suivi || t.cleLigne || '';
    const opts = (now = NOW, extra = {}) => ({ codesDe, suiviDe, txDe, score, fiable, fusion: fus, juger: juger(now), cle, ...extra });
    const moitieVinted = () => ({ id: 'v', source: 'vinted-commande', conv: 'c-900001', cleLigne: 'vc-1', code: '', suivi: '', lieu: POINT, status: 'available', arriveLe: '2026-11-20T09:00:00Z', limite: null });
    // (A10) l'e-mail Vinted Go sans lieu écrit : la moitié Vinted, plus « complète » au score, ne doit pas faire foi pour la date.
    const vintedGo = () => ({ id: 'g', carrier: 'vinted', suivi: '1792000000000099', code: '978 216', qr: 'img', lieu: '', status: 'available', arriveLe: '2026-11-19T08:00:00Z', limite: '2026-11-25' });
    const avGo = () => ({ kind: 'email', t: vintedGo(), e: { etat: 'delai_depasse' }, o: null });
    const moitieAvecCode = () => ({ ...moitieVinted(), code: '978216' });
    const r = P.reunirParIdentite([moitieVinted()], [avGo()], opts());
    const u = r.aVerifier[0] && r.aVerifier[0].t;
    dit(r.liste.length === 0 && r.aVerifier.length === 1, 'A8 capture de Julien : la moitié Vinted (code de SA conversation) et l\'e-mail Vinted Go « 978 216 » sont UN colis — une ligne, plus de doublon', JSON.stringify({ l: r.liste.map((t) => t.id), v: r.aVerifier.map((x) => x.t.id) }));
    dit(!!u && u.suivi === '1792000000000099' && u.qr === 'img' && u.lieu === POINT && Array.isArray(u.clesMoities) && u.clesMoities.includes('1792000000000099') && u.clesMoities.includes('vc-1'), 'A9 le colis réuni porte les identités des deux moitiés (n°, QR, le point, et les deux clés : « Retiré » marque les deux)', JSON.stringify(u));
    const r10 = P.reunirParIdentite([moitieAvecCode()], [avGo()], opts());
    const u10 = r10.aVerifier[0] && r10.aVerifier[0].t;
    dit(!!u10 && u10.arriveLe === '2026-11-19T08:00:00Z' && u10.limite === '2026-11-25' && u.arriveLe === '2026-11-19T08:00:00Z', 'A10 sa date est celle du TRANSPORTEUR (19 nov., pas l\'estimation Vinted du 20) et sa limite celle qui a été LUE (25 nov.)', JSON.stringify(u10 && [u10.arriveLe, u10.limite]));
    dit(!!r.aVerifier[0] && r.aVerifier[0].e && r.aVerifier[0].e.etat === 'delai_depasse', 'A11 limite LUE et passée ⇒ le colis réuni est « à vérifier » (badge « Date limite dépassée »), jamais compté');
    const rAvant = P.reunirParIdentite([moitieVinted()], [{ kind: 'email', t: vintedGo(), e: { etat: 'sans_suivi' }, o: null }], opts(Date.UTC(2026, 10, 22, 8)));
    dit(rAvant.liste.length === 1 && rAvant.aVerifier.length === 0 && rAvant.liste[0].suivi === '1792000000000099', 'A12 limite LUE pas encore passée ⇒ le colis réuni est compté « à retirer », une fois');
    // Le code écrit différemment sur chaque moitié (« 978 216 » / « 978216 ») : la normalisation de l'appelant les égale.
    const rFmt = P.reunirParIdentite([{ ...moitieAvecCode(), conv: '' }], [avGo()], opts());
    dit(rFmt.liste.length === 0 && rFmt.aVerifier.length === 1, 'A13 « 978 216 » et « 978216 » écrits sur les deux moitiés : le même code, un colis');
    // La transaction seule (le code pas lu dans la conversation) suffit aussi.
    convCode.delete('900001');
    const rTx = P.reunirParIdentite([moitieVinted()], [{ ...avGo(), t: { ...vintedGo(), code: '', tx: '900001' } }], opts());
    dit(rTx.liste.length === 0 && rTx.aVerifier.length === 1, 'A14 la même transaction (sans code commun) : un colis');
    convCode.set('900001', '978216');
    // ── Les garanties gardées (esprit d'audit-identite : 50 paires identiques) ──
    // 50 paires au même titre, au même point, aux mêmes dates, codes et commandes DIFFÉRENTS : jamais réunies.
    const L50 = [], V50 = [];
    for (let k = 0; k < 50; k++) {
      L50.push({ id: 'v' + k, source: 'vinted-commande', titre: 'Nike Air Zoom Alphafly NEXT%', tx: String(800000 + k), code: String(100000 + k), suivi: '', lieu: POINT, status: 'available', arriveLe: '2026-11-20T09:00:00Z' });
      V50.push({ kind: 'email', t: { id: 'g' + k, titre: 'Nike Air Zoom Alphafly NEXT%', suivi: String(1792000000000100 + k), code: String(200000 + k), qr: 'img', lieu: POINT, status: 'available', arriveLe: '2026-11-19T08:00:00Z', limite: '2026-11-25' }, e: { etat: 'delai_depasse' } });
    }
    const r50 = P.reunirParIdentite(L50, V50, opts());
    dit(r50.liste.length === 50 && r50.aVerifier.length === 50 && r50.liste === L50, 'A15 50 paires identiques (titre, point, dates), codes et commandes différents : AUCUNE réunie', `${r50.liste.length}/${r50.aVerifier.length}`);
    const rSans = P.reunirParIdentite([{ id: 'a', source: 'vinted-commande', code: '', suivi: '', lieu: POINT, titre: 'X' }], [{ kind: 'email', t: { id: 'b', code: '', suivi: '', lieu: POINT, titre: 'X' }, e: { etat: 'sans_suivi' } }], opts());
    dit(rSans.liste.length === 1 && rSans.aVerifier.length === 1, 'A16 deux moitiés SANS identité commune (même titre, même point) : jamais réunies');
    const rN = P.reunirParIdentite([{ id: 'v', code: '5', suivi: '1' }], [{ kind: 'email', t: { id: 'q', code: '5', suivi: '2' }, e: {} }], opts());
    dit(rN.aVerifier.length === 1 && rN.liste.length === 1 && rN.liste[0].id === 'v', 'A17 même code, deux n° différents, aucune commande commune : rien n\'est réuni (on ne choisit pas)');
    const rT = P.reunirParIdentite([{ id: 'v', code: '5', tx: '1' }], [{ kind: 'email', t: { id: 'q', code: '5', tx: '2' }, e: {} }], opts());
    dit(rT.aVerifier.length === 1 && rT.liste.length === 1, 'A18 même code, deux commandes différentes : deux colis');
    const rI = P.reunirParIdentite([moitieVinted()], [{ ...avGo(), e: { etat: 'transporteur' } }], opts());
    dit(rI.aVerifier.length === 1 && rI.liste.length === 1, 'A19 un incident du transporteur reste à part « à vérifier »');
    // (banc du 27 nov.) La moitié Vinted classée « peut-être en double » (sa ligne n'écrit pas le code) alors que SA commande porte
    // le code de l'e-mail Vinted Go : elle partage une identité, c'est CE colis — une ligne, « à vérifier » par la limite lue.
    const rD = P.reunirParIdentite([], [{ kind: 'email', t: vintedGo(), e: { etat: 'delai_depasse' } }, { kind: 'email', t: moitieVinted(), e: { etat: 'doute_meme_relais' } }], opts());
    dit(rD.aVerifier.length === 1 && rD.aVerifier[0].t.suivi === '1792000000000099' && rD.aVerifier[0].e.etat === 'delai_depasse', 'A20 un « peut-être en double » qui PARTAGE une identité (le code de SA commande) est ce colis : une ligne', JSON.stringify(rD.aVerifier.map((x) => [x.t.id, x.e.etat])));
    const rD2 = P.reunirParIdentite([vintedGo()], [{ kind: 'email', t: { ...moitieVinted(), conv: 'c-autre' }, e: { etat: 'doute_meme_relais' } }], opts());
    dit(rD2.aVerifier.length === 1 && rD2.liste.length === 1, 'A21 un « peut-être en double » SANS identité commune reste à part (jamais par le point ni la date)');
  }

  // ── B. Le doute « même point » ───────────────────────────────────────────
  const at = (j) => new Date(Date.UTC(2026, 10, 5, 9) + j * 864e5).toISOString();
  const mr = (n, j, extra = {}) => ({ source: '', suivi: String(n), status: 'available', lieu: 'MAISON DU JOURNAL, 4 RUE DU QUAI, 35000 VILLEA', arriveLe: at(j), account: '', recuSur: ['adresse-x@exemple.fr'], ...extra });
  const vt = (n, j, extra = {}) => ({ source: 'vinted-commande', conv: 'v' + n, suivi: '', status: 'available', lieu: 'MAISON DU JOURNAL, 4 RUE DU QUAI, 35000 VILLEA', arriveLe: at(j), account: '', recuSur: ['adresse-x@exemple.fr'], ...extra });
  // Sa forme : 4 « t'attend » sans commande ; 4 Mondial Relay, dont 3 DÉJÀ RETIRÉS (hors liste).
  const enAttente = [mr(1, 0)];
  const temoins = [mr(1, 0), mr(2, -1), mr(3, -1), mr(4, -1)];
  const liste = [...enAttente, vt(1, 0), vt(2, -1), vt(3, -1), vt(4, 0)];
  const r1 = A.regrouperArrivees(liste, { commandeDe: () => null, temoins });
  dit(r1.liste.length === 1 && r1.doutes.length === 4, 'B1 les 4 moitiés Vinted sont des doutes (témoins FINIS compris) : 1 compté, pas 5', `${r1.liste.length}/${r1.doutes.length}`);
  const r1b = A.regrouperArrivees([vt(1, 0), vt(2, 0)], { commandeDe: () => null, temoins: [mr(2, -1)] });
  dit(r1b.liste.length === 0, 'B2 même si le seul témoin est déjà retiré (sinon elles reviennent « à retirer » le lendemain)');
  const cmdSans = { transaction_id: 77, suivis: [] }, cmdAvec = { transaction_id: 78, suivis: ['99'] };
  const r2 = A.regrouperArrivees([vt(5, 0)], { commandeDe: () => cmdSans, temoins: [mr(5, 0)], sansIdentite: (t, c) => !c.suivis.length });
  dit(r2.doutes.length === 1 && r2.doutesCommandes[0] === cmdSans, 'B3 reliée à une commande SANS n° de suivi : doute (sa commande gardée)');
  const r3 = A.regrouperArrivees([vt(6, 0)], { commandeDe: () => cmdAvec, temoins: [mr(6, 0)], sansIdentite: (t, c) => !c.suivis.length });
  dit(r3.liste.length === 1, 'B4 reliée à une commande qui A un n° de suivi : comptée (son n° la juge)');
  const r4 = A.regrouperArrivees([vt(7, 0, { recuSur: ['autre@exemple.fr'] })], { commandeDe: () => null, temoins: [mr(7, 0)] });
  dit(r4.liste.length === 1, 'B5 une autre adresse de réception : pas le même destinataire, pas de doute');
  const r5 = A.regrouperArrivees([vt(8, 0, { lieu: 'MAISON DU JOURNAL, 9 RUE HAUTE, 29000 VILLEB' })], { commandeDe: () => null, temoins: [mr(8, 0)] });
  dit(r5.liste.length === 1, 'B6 un autre lieu (autre code postal) : pas de doute');
  const r6 = A.regrouperArrivees([vt(9, 0)], { commandeDe: () => null, temoins: [mr(9, -8)] });
  dit(r6.liste.length === 1, 'B7 un témoin arrivé 8 jours plus tôt : hors fenêtre, pas de doute');
  const r7 = A.regrouperArrivees([vt(10, 0)], { commandeDe: (t) => (t.source ? { transaction_id: 1 } : { transaction_id: 2 }), temoins: [mr(10, 0)], sansIdentite: () => true });
  dit(r7.liste.length === 1, 'B8 un témoin relié à une AUTRE commande n\'est jamais son témoin');
  const k1 = A.cleLieuDoute('Consigne Vinted Go, Thé du Coin, 13 Rue Basse'), k2 = A.cleLieuDoute('Thé du Coin, 13 Rue Basse, 56000 Villec');
  dit(k1 && k2 && k1.nom === k2.nom, 'B9 « Consigne Vinted Go, Nom, rue » = « Nom, rue, CP Ville » (même lieu)', JSON.stringify([k1, k2]));
  const k3 = A.cleLieuDoute("TAB'OCAP"), k4 = A.cleLieuDoute('TABOCAP, TABOCAP, 2 RUE BASSE, 56000 VILLEC');
  dit(k3 && k4 && k3.nom === k4.nom, 'B10 apostrophe et nom répété : le même nom');

  // ── C. Un point écrit trois fois = un point ──────────────────────────────
  const pts = R.regrouperRelais({ arrives: [
    { id: '1', nom: 'MAISON DU JOURNAL', adresse: '4 RUE DU QUAI, 35000 VILLEA', transporteur: 'mondialrelay' },
    { id: '2', nom: 'Maison du Journal', adresse: '4 Rue du Quai, 35000 Villea', transporteur: '' },
    { id: '3', nom: 'MAISON-DU-JOURNAL', adresse: '4, rue du Quai 35000 VILLEA', transporteur: 'vinted' },
    { id: '4', nom: 'MAISON DU JOURNAL', adresse: '9 RUE HAUTE, 29000 VILLEB', transporteur: 'mondialrelay' },
  ] });
  const mj = pts.filter((p) => /journal/i.test(p.nom));
  dit(mj.length === 2 && mj.some((p) => p.cp === '35000' && p.nArrives === 3), 'C1 majuscules, tirets, virgules : UN point ; même nom ailleurs : un AUTRE point', JSON.stringify(pts.map((p) => [p.cle, p.nArrives])));
  // (27 nov., capture de Julien) « Joubert Peintures · Transporteur, 10 Rue du Bois Aurant, 35400 Saint-Malo » ET « 10 Rue du Bois
  // Aurant · Vinted Go · Saint-Malo » : la MÊME adresse, deux cartes. Adresse inventée, forme réelle (le suivi Vinted Go donne
  // « <n° et rue>, <ville> » sans le nom du commerce).
  const NOMME = { id: 'j', nom: 'Droguerie du Banc', adresse: '10 Rue des Essais, 35400 Villeneuve', transporteur: 'vinted' };
  const points = (...xs) => R.regrouperRelais({ arrives: xs });
  const un = (ps) => ps.length === 1 && ps[0].nArrives === 2 && ps[0].nom === 'Droguerie du Banc';
  dit(un(points(NOMME, { id: 'v', nom: '10 Rue des Essais', rue: '', cp: '', ville: 'Villeneuve', transporteur: 'vinted' })), 'C2 le point nommé de sa RUE (suivi Vinted Go) et le point nommé, même rue + même ville : UNE carte, au vrai nom', JSON.stringify(points(NOMME, { id: 'v', nom: '10 Rue des Essais', ville: 'Villeneuve' }).map((p) => [p.cle, p.nom])));
  dit(un(points(NOMME, { id: 'v', nom: '', rue: '10 rue des essais', ville: 'VILLENEUVE', transporteur: 'vinted' })), 'C3 sans nom, la rue et la ville lues (casse, sans code postal) : la même carte — jamais « pas encore connu »');
  dit(un(points(NOMME, { id: 'v', nom: '10 Rue des Essais', adresse: '10 Rue des Essais, 35400 Villeneuve', transporteur: 'vinted' })), 'C4 même rue, même code postal : une carte');
  dit(points(NOMME, { id: 'v', nom: '12 Rue des Essais', ville: 'Villeneuve' }).length === 2, 'C5 un AUTRE numéro de la même rue : deux points');
  dit(points(NOMME, { id: 'v', nom: '10 Rue des Essais', ville: 'Autreville' }).length === 2, 'C6 la même rue dans une AUTRE ville : deux points');
  dit(points(NOMME, { id: 'v', nom: '10 Rue des Essais', adresse: '10 Rue des Essais, 29000 Villeneuve' }).length === 2, 'C7 la même rue à un AUTRE code postal : deux points');
  dit(points(NOMME, { id: 'v', nom: 'Tabac du Centre', adresse: '10 Rue des Essais, 35400 Villeneuve' }).length === 2, 'C8 deux VRAIS noms différents à la même adresse (une galerie) : deux points (jamais la ressemblance des noms)');
  dit(points(NOMME, { id: 'v', nom: '10 Rue des Essais', ville: 'Villeneuve', sorte: 'consigne' }).length === 2, 'C9 une consigne et un comptoir à la même adresse : deux points');
  dit(points(NOMME, { id: 'v', nom: '10 Rue des Essais', transporteur: 'vinted' }).length === 2, 'C10 la rue SANS ville ni code postal : rien ne prouve l\'adresse, deux points');
  // La forme RENDUE par l'écran (banc retrait-double-code) : le lieu du suivi « 10 Rue …, Ville » coupé en nom = la rue, adresse = la ville.
  const deux = points(NOMME, { id: 'v', nom: '10 Rue des Essais', adresse: 'Villeneuve', transporteur: 'vinted' }, { id: 'w', nom: '10 Rue des Essais', adresse: 'Villeneuve', transporteur: 'vinted' });
  dit(deux.length === 1 && deux[0].nArrives === 3 && deux[0].nom === 'Droguerie du Banc', 'C11 nom = la rue, adresse = la ville seule (forme rendue du suivi Vinted Go) : la même carte', JSON.stringify(deux.map((p) => [p.cle, p.nom, p.nArrives])));
}

function cablage(dit) {
  const app = sansCommentaires(lire('src/App.jsx'));
  const pu = app.slice(app.indexOf('const pickupUnion = useMemoParesseux('), app.indexOf('const groupesRelais = useMemoParesseux(') > 0 ? app.indexOf('const groupesRelais = useMemoParesseux(') : app.indexOf('const pickupUnion = useMemoParesseux(') + 40000);
  dit(/finParIdentite\(t, preuvesIdentite\(t, cmd\)\)/.test(pu) && /fi === 'retire'/.test(pu), 'D1 pickupUnion juge la fin par les autres identités (commande, code)');
  dit(/fusionnerParCode\(emailList/.test(pu), 'D2 pickupUnion : une ligne par code de retrait');
  dit(/reunirParIdentite\(emailList, aVerifier, \{ codesDe: codesLigne, suiviDe: suiviDeLigne, txDe: txLigne/.test(pu), 'D2b pickupUnion : une moitié « à vérifier » et une moitié comptée de la même identité sont un colis');
  dit(/const codesLigne = \(t\) => \{ const o = commandeLigne\(t\); return \[codeLigne\(t\), o \? normCode\(\(colisRelais\[String\(o\.transaction_id\)\]/.test(pu), 'D2c le code d\'une ligne est aussi celui lu dans la conversation de SA commande (la moitié Vinted n\'en écrit pas)');
  dit(/fiable: \(t\) => t\.source !== 'vinted-commande'/.test(pu) && /juger: jugerReuni/.test(pu), 'D2d la ligne du transporteur fait foi, le colis réuni est rejugé (limite lue et passée ⇒ « à vérifier »)');
  const cc = app.slice(app.indexOf('const gesteCollecte = (t, oui) =>'), app.indexOf('const gesteCollecte = (t, oui) =>') + 600);
  dit(/clesDuColis\(t\)/.test(cc), 'D2e « Retiré » marque toutes les moitiés du colis réuni (`clesMoities`)');
  dit(/regrouperArrivees\(emailList, \{[^}]*temoins, sansIdentite(?:, temoinActif: [^}]*)? \}\)/.test(pu), 'D3 pickupUnion donne les témoins (finis compris) et la règle « sans identité »');
  dit(/enDouble/.test(pu) && /doute_meme_relais/.test(pu), 'D4 les doubles possibles sont à part : ni « à retirer », ni « à vérifier »');
  const tfb = app.slice(app.indexOf('const colisParTx = useLecteurParesseux('), app.indexOf('const achatStage ='));
  dit(tfb.length > 0 && !/normTitle/.test(tfb) && /achatParConversation|parConv/.test(tfb), 'D5 l\'écran Achats relie un colis à SA commande par identité, jamais par le titre');
  const eq = app.slice(app.indexOf('function ColisEquipe('), app.indexOf('function ColisEquipe(') + 6000);
  dit(!/needs_action/.test(eq.slice(eq.indexOf('const achats = d.achats'), eq.indexOf('const achats = d.achats') + 300)), 'D6 équipe : `needs_action` n\'est pas « à retirer » (« Commande livrée ! » le porte)');
  const ea = app.slice(app.indexOf('function etapeAchat('), app.indexOf('function etapeAchat(') + 2500);
  dit(/fini = false/.test(ea) && ea.indexOf('commande\\s+livr') > 0 && ea.indexOf('commande\\s+livr') < ea.indexOf("label: 'À retirer'"), 'D7 étape d\'un achat : « Commande livrée » et « fini » passent AVANT « À retirer »');
  const cr = sansCommentaires(lire('src/CarteRelais.jsx'));
  dit(/RANG_SECTION/.test(cr) && /principale/.test(cr), 'D8 Colis → À retirer : un point, une carte (la section de son colis le plus pressé)');
}

(async () => {
  const PROUVE = process.argv.includes('--prouve');
  const sources = { preuves: fs.existsSync(path.join(RACINE, 'src/retraitPreuves.js')) ? lire('src/retraitPreuves.js') : 'export {};', arrivee: lire('api/_lib/achat-arrive-relais.js'), relais: lire('src/relaisColis.js') };
  let ko = 0, ok = 0;
  const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d && !c ? ' — ' + d : '')); };
  await controles(sources, dit);
  cablage(dit);
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  if (PROUVE) {
    const MUT = [
      ['fin par la commande ignorée', 'preuves', (s) => s.replace('if (commande) for (const s of suivisDeAchat(commande) || []) if (s) out.add(s);', '')],
      ['fin par le code ignorée', 'preuves', (s) => s.replace('if (c && codes.has(c)) for (const s of codes.get(c)) out.add(s);', '')],
      ['pas de fusion par code', 'preuves', (s) => s.replace('if (!retire.size) return liste;', 'return liste;')],
      ['le code ne relie plus (règle du 26 nov. : seulement le code écrit)', 'preuves', (s) => s.replace('const tx = croise(a.txs, b.txs), su = croise(a.suivis, b.suivis), co = croise(a.codes, b.codes);', 'const tx = croise(a.txs, b.txs), su = croise(a.suivis, b.suivis), co = false;')],
      ['la transaction ne relie plus', 'preuves', (s) => s.replace('if (!(tx || su || co)) return false;', 'if (!(su || co)) return false;')],
      ['deux n° de suivi réunis', 'preuves', (s) => s.replace('if (a.suivis.size && b.suivis.size && !su && !tx) return false;', '')],
      ['deux commandes réunies', 'preuves', (s) => s.replace('if (a.txs.size && b.txs.size && !tx) return false;', '')],
      ['réunies par ressemblance (toute paire au même point)', 'preuves', (s) => s.replace("const g = (id.codes.size || id.suivis.size || id.txs.size) ? groupes.find((x) => memeColisParIdentite(x.id, id)) : null;", 'const g = groupes[0] || null;')],
      ['colis réuni pas rejugé', 'preuves', (s) => s.replace('const e = juger(f);', 'const e = null;')],
      ['la date Vinted fait foi', 'preuves', (s) => s.replace('(fiable(b.t) ? 1 : 0) - (fiable(a.t) ? 1 : 0) || ', '')],
      ['une seule clé pour « Retiré »', 'preuves', (s) => s.replace("...(cles.length ? { clesMoities: cles } : {})", '')],
      ['incident du transporteur réuni', 'preuves', (s) => s.replace("if (et === 'transporteur') return;", '')],
      ['« peut-être en double » jamais réuni (règle d\'avant)', 'preuves', (s) => s.replace("if (et === 'transporteur') return;", "if (et === 'transporteur' || et === 'doute_meme_relais') return;")],
      ['points : la rue en nom, la ville en adresse ⇒ point isolé (règle d\'avant)', 'relais', (s) => s.replace("      morceaux = { rue: String(nomLu).trim(), cp: '', ville: String(morceaux.rue).trim() };", '      {}')],
      ['témoins finis ignorés (règle d\'avant)', 'arrivee', (s) => s.replace('const doute = Array.isArray(temoins)', 'const doute = false')],
      ['adresse de réception ignorée', 'arrivee', (s) => s.replace('if (a.a && b.a) return a.a === b.a;\n  if (a.r && b.r) return a.r === b.r;', '')],
      ['fenêtre de jours ignorée', 'arrivee', (s) => s.replace('Math.abs(aw - at) <= fenetreJ * 86400000', 'true')],
      ['commande sans n° jamais un doute', 'arrivee', (s) => s.split("(!cmds[i] || (sansIdentite && sansIdentite(t, cmds[i])))").join('!cmds[i]')],
      ['points : la rue seule suffit (ni code postal ni ville)', 'relais', (s) => s.replace("if (p.cp && q.cp) return p.cp === q.cp;\n      const vp = normNomRelais(p.ville || ''), vq = normNomRelais(q.ville || '');\n      return !!vp && vp === vq;", 'return true;')],
      ['points : deux vrais noms réunis', 'relais', (s) => s.replace('&& (nomEstRue(p) || nomEstRue(q) || normNomRelais(p.nom) === normNomRelais(q.nom))', '')],
      ['points : consigne et comptoir réunis', 'relais', (s) => s.replace(' || consigneDe(p) !== consigneDe(q)) return false;', ') return false;')],
      ['points : jamais réunis par l\'adresse (règle d\'avant)', 'relais', (s) => s.replace('if (memes.length !== 1) continue;                       // plusieurs candidats', 'if (true) continue;                       // plusieurs candidats')],
      ['points : rue + ville sans code postal ⇒ « pas connu » (règle d\'avant)', 'relais', (s) => s.replace("        : rueOk && RUE.test(rueOk) && villeLue ? 'adr:' + sorteCle + normNomRelais(rueOk) + '|~' + normNomRelais(villeLue) : CLE_INCONNU);", '        : CLE_INCONNU);')],
      ['lieu : préfixe « Consigne Vinted Go » gardé', 'arrivee', (s) => s.replace("const sansPrefixe = s.replace(NOM_LIEU_PREFIXE, '');", 'const sansPrefixe = s;')],
    ];
    let rouges = 0;
    for (const [nom, cle, f] of MUT) {
      const m = { ...sources, [cle]: f(sources[cle]) };
      if (m[cle] === sources[cle]) { console.log('⚠️  mutation sans effet : ' + nom); continue; }
      let k = 0; await controles(m, (c) => { if (!c) k++; });
      console.log((k ? '✅ rouge sous mutation : ' : '❌ RESTE VERT sous mutation : ') + nom + (k ? ` (${k})` : ''));
      if (k) rouges++;
    }
    console.log(`\n--prouve : ${rouges}/${MUT.length} mutations rougissent l'audit`);
    if (rouges !== MUT.length) process.exitCode = 1;
  }
  if (ko) process.exitCode = 1;
})();
