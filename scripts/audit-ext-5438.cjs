#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  EXT. 5.438 (22 nov. 2026, Julien, choix 1, 2, 3, 5, 6, 11) — docs/passation/2026-11-22-ext-5438.md
//  On EXÉCUTE la copie LIVRÉE des règles (blocs <sante-note-regle>, <lot-relance-regle> de background.js) et le VRAI
//  background.js (scripts/_fond-vm.cjs), puis on lit le panneau et l'app. Valeurs inventées (le dépôt est public).
//   A. la note de santé : chaque point avec sa raison, le palier (2 vérifications en 24 h ⇒ 30/h), la remontée par
//      marches (24 h entières, ½ à 48 h, ¼ à 72 h), « pas su » ⇒ null, source illisible nommée, vues mesurées ;
//      « compte précieux » divise par deux, jamais au-dessus de son réglage ;
//   B. la relance d'une offre ACCEPTÉE sans achat (prouvée par l'annonce relue en vente APRÈS le délai), 24 h par
//      défaut, acheteur 1 étoile sauté, palier de la négociation, message varié (jamais deux fois le même de suite),
//      bilan par n° de transaction, lot une fois par personne ET par ensemble ;
//   C. le vrai fond : la cadence APPLIQUÉE baisse seule (compterAction), « précieux » coupe la série et chaque moteur,
//      un refus lu va au carnet, la note est publiée dans la ligne de la jauge, « à nouveau visible » dit, un brouillon
//      préparé seul une seule fois ;
//   D. le panneau et l'app : la note (Accueil, Santé, Paramètres), l'interrupteur, « Mes comptes », la carte « Vinted
//      ne masque plus », textes en 5 langues, capacités 5.438.0.
//  `--recopie` : recopie <sante-note-regle> de src/santeNote.js dans background.js.
//  `--src chemin` : un autre background.js (le code d'AVANT doit être ROUGE). `--prouve` : chaque mutation ⇒ rouge.
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { execFileSync } = require('child_process');
const R = path.join(__dirname, '..');
const F_SN = path.join(R, 'src/santeNote.js'), F_BG0 = path.join(R, 'vinted-sync-extension/background.js');
const bloc = (t, a, b) => { const i = t.indexOf(a), j = t.indexOf(b); return i < 0 || j < 0 ? null : t.slice(i, j + b.length); };
const SN_A = '// <sante-note-regle>', SN_B = '// </sante-note-regle>';
const LR_A = '// <lot-relance-regle>', LR_B = '// </lot-relance-regle>';
const args = process.argv.slice(2);
if (args.includes('--recopie')) {
  const b = bloc(fs.readFileSync(F_SN, 'utf8'), SN_A, SN_B); const bg = fs.readFileSync(F_BG0, 'utf8'); const v = bloc(bg, SN_A, SN_B);
  if (!b || !v) { console.log('❌ bloc introuvable'); process.exit(1); }
  fs.writeFileSync(F_BG0, bg.replace(v, () => b)); console.log('✅ bloc <sante-note-regle> recopié dans background.js'); process.exit(0);
}
const MUTATIONS = {
  'poids-captcha': ["const SN_POIDS = { captcha: 15,", "const SN_POIDS = { captcha: 0,"],
  'decroissance': ["const SN_FENETRES_H = [[24, 1], [48, 0.5], [72, 0.25]];", "const SN_FENETRES_H = [[72, 1]];"],
  'passu': ["if (!Array.isArray(x.ev)) return { note: null, pct: 100, points: [], principal: null, manque: ['carnet'] };", "if (!Array.isArray(x.ev)) x.ev = [];"],
  'precieux-moitie': ["const k = (precieux === true ? 0.5 : 1) * pNote / 100;", "const k = pNote / 100;"],
  'jamais-plus': ["const borne = (v, base, min) => Math.min(base, Math.max(Math.min(min, base), Math.floor(v)));", "const borne = (v, base, min) => Math.max(min, Math.floor(v));"],
  'cadence-appliquee': ["    const cad = await cadenceEffective(uid);\n    const capH", "    const cad = await cadenceCompte(uid);\n    const capH"],
  'precieux-atelier': ["  if (ids.length > 1) { const pb = await precieuxBloque(uid, 'repub-serie'); if (pb) return pb; }", ""],
  'precieux-offres': ["    if (await precieuxBloque(uid, 'offre-auto')) return 0;", ""],
  'sans-achat-relire': ["if (r.etat === 'acceptee' && ligne.etat === 'pret' && !(Number(x.luA) >= quand)) { ligne.etat = 'attente'; ligne.raison = 'relire'; }", ""],
  'une-etoile': ["if (typeof x.uneEtoile === 'function' && x.uneEtoile(r.acheteur, r) === true) { ligne.raison = 'note_basse'; out.push(ligne); continue; }", ""],
  'message-dernier': ["const autres = ok.length > 1 ? ok.filter((t) => t !== dernier) : ok;", "const autres = ok;"],
  'bilan-tx': ["if (prouvees.has(tx)) { ventes++;", "if (true) { ventes++;"],
  'refus-note': ["  if (!natif && !(st >= 400 && st < 500 && ![401, 403, 429].includes(st))) return '';", "  return '';"],
  'demasquee': ["const revenues = tous.filter((e) => e && e.s === 'masquee' && Number(e.f) > 0 && Date.now() - Number(e.f) < 3 * 864e5);", "const revenues = [];"],
  'brouillon-une-fois': ["!f.manqueBrouillon.length && !e[f.id] && Number(f.nPhotos) > 0", "!f.manqueBrouillon.length && Number(f.nPhotos) > 0"],
  'prog-verif-compte': ["  if (String(e.p.uid) !== String(uid || '')) return { ok: false, code: 'compte', raison: 'L’onglet est connecté sur un autre compte Vinted.' };", ""],
  'jauge-note': ["    try { disc.note = resumeNote(await cadenceEffective(String(uid))); } catch (_) {}", ""],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 600000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
const argSrc = (() => { const i = args.indexOf('--src'); return i >= 0 ? path.resolve(args[i + 1]) : F_BG0; })();
let SRC = argSrc;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const [a, b] = MUTATIONS[mut] || [];
  const s = fs.readFileSync(argSrc, 'utf8');
  if (!a || !s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); }
  SRC = path.join(os.tmpdir(), `bg-5438-${mut}-${process.pid}.js`); fs.writeFileSync(SRC, s.split(a).join(b));
}
const BG = fs.readFileSync(SRC, 'utf8');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 400) : '')); } };
const essai = async (nom, fn) => { try { await fn(); } catch (e) { dit(false, nom + ' — exception', e && e.stack); } };
const H = 3600000, J = 864e5, T0 = Date.UTC(2026, 10, 22, 12);

// ── A et B : les règles, la copie LIVRÉE ──
let SN = null, LR = null;
try { const c = {}; vm.runInNewContext(bloc(BG, SN_A, SN_B) + '\n;globalThis.__f = { snNote, snCadence, snPhrase, snVuesTendance, snPrecieuxBloque, snPoidsAge };', c); SN = c.__f; } catch (e) { dit(false, 'A0 bloc <sante-note-regle> absent ou cassé dans background.js', e.message); }
try { const c = {}; vm.runInNewContext(bloc(BG, LR_A, LR_B) + '\n;globalThis.__f = { lrOffreSansAchat, lrRelances, lrMessageRelance, lrBilan, lrCleLot, lrReglageLot, lrReglageRelance, lrOffreRatee };', c); LR = c.__f; } catch (e) { dit(false, 'B0 bloc <lot-relance-regle> (5.438) absent ou cassé', e.message); }

(async () => {
  if (SN) await essai('A', async () => {
    dit(argSrc !== F_BG0 || mut || bloc(fs.readFileSync(F_SN, 'utf8'), SN_A, SN_B) === bloc(BG, SN_A, SN_B), 'A1 la copie de <sante-note-regle> est celle de src/santeNote.js');
    const ev = (l) => l.map(([h, s]) => ({ t: T0 - h * H, s }));
    const vide = SN.snNote({ ev: [], masquees: [], vues: { lu: true, avant: 100, apres: 90, baisse: false } }, T0);
    dit(vide.note === 100 && vide.pct === 100 && vide.points.length === 0 && vide.manque.length === 0, 'A2 rien en 72 h ⇒ 100/100, toute sa cadence, aucun point', JSON.stringify(vide));
    const deux = SN.snNote({ ev: ev([[2, 'captcha'], [20, 'captcha']]), masquees: [], vues: null }, T0);
    const c2 = SN.snCadence({ actionsHeure: 50, favorisHeure: 15 }, deux, false);
    const ph = SN.snPhrase(deux, c2);
    dit(deux.note === 70 && deux.pct === 60 && c2.actionsHeure === 30 && c2.favorisHeure === 9 && c2.reduite === true, 'A3 2 vérifications en 24 h ⇒ 70/100 ⇒ cadence réduite à 30/h (favoris 9/h)', JSON.stringify({ n: deux.note, c2 }));
    dit(ph.cle === 'reduite' && ph.raison && ph.raison.k === 'captcha' && ph.raison.n === 2 && ph.raison.h === 24 && ph.v.cap === 30, 'A3 la phrase dit « cadence réduite à 30/h : 2 vérifications en 24 h »', JSON.stringify(ph));
    dit(deux.points[0] && deux.points[0].k === 'captcha' && deux.points[0].n24 === 2 && deux.points[0].retire === 30, 'A3 le point a SA raison : la sorte, combien en 24 h, ce qu’il retire', JSON.stringify(deux.points));
    const n30 = SN.snNote({ ev: ev([[30, 'captcha'], [44, 'captcha']]), masquees: [], vues: null }, T0);
    const n60 = SN.snNote({ ev: ev([[60, 'captcha'], [70, 'captcha']]), masquees: [], vues: null }, T0);
    const n80 = SN.snNote({ ev: ev([[80, 'captcha'], [90, 'captcha']]), masquees: [], vues: null }, T0);
    dit(n30.note === 85 && n30.pct === 100 && n60.note === 93 && n80.note === 100, 'A4 la note REMONTE par marches : 70 (24 h) → 85 (24–48 h) → 93 (48–72 h) → 100', `${n30.note} ${n60.note} ${n80.note}`);
    const ps = SN.snNote({ ev: null, masquees: [], vues: null }, T0);
    const cps = SN.snCadence({ actionsHeure: 50, favorisHeure: 15 }, ps, false);
    dit(ps.note === null && SN.snPhrase(ps, cps).cle === 'passu' && cps.actionsHeure === 50, 'A5 carnet illisible ⇒ note « pas sue » (null), rien de réduit sur un doute, jamais un 100 inventé', JSON.stringify(ps));
    const mq = SN.snNote({ ev: [], masquees: null, vues: { lu: false, raison: 'peu_annonces' } }, T0);
    dit(mq.note === 100 && mq.manque.includes('masquees') && mq.manque.includes('vues'), 'A6 masquées et vues pas lues ⇒ NOMMÉES dans « manque », ne retirent rien', JSON.stringify(mq.manque));
    const ms = SN.snNote({ ev: [], masquees: [T0 - 3 * H, T0 - 30 * H], vues: null }, T0);
    dit(ms.note === 85 && ms.points[0].k === 'masquee' && ms.points[0].n24 === 1 && ms.points[0].n72 === 2, 'A6 annonces masquées par Vinted : une récente (−10), une de 30 h (−5)', JSON.stringify(ms.points));
    const jf = 20000, courbe = (avant, apres) => [[jf - 6, 100, 0, 0, 600], [jf - 3, 100 + avant, 0, 0, 600], [jf, 100 + avant + apres, 0, 0, 600]];
    const memo = {}; for (let i = 0; i < 6; i++) memo[String(1000 + i)] = courbe(20, 4);
    const vt = SN.snVuesTendance(memo, jf);
    dit(vt.lu === true && vt.baisse === true && vt.avant === 120 && vt.apres === 24 && vt.pct === 80, 'A7 vues MESURÉES : 24 vues ces 3 jours contre 120 avant ⇒ baisse de 80 % (−10)', JSON.stringify(vt));
    dit(SN.snVuesTendance({ 1001: courbe(20, 4), 1002: courbe(20, 4) }, jf).lu === false && SN.snVuesTendance(null, jf).lu === false, 'A7 deux annonces lues seulement ⇒ « pas assez lu », jamais une baisse inventée');
    const pr = SN.snCadence({ actionsHeure: 50, favorisHeure: 15 }, vide, true);
    const pr2 = SN.snCadence({ actionsHeure: 50, favorisHeure: 15 }, deux, true);
    dit(pr.actionsHeure === 25 && pr.favorisHeure === 7 && pr.par.join() === 'precieux' && pr2.actionsHeure === 15 && SN.snPhrase(deux, pr2).cle === 'reduite_precieux', 'A8 compte précieux : cadence divisée par deux (25/h) ; avec 2 vérifications : 15/h, les deux raisons dites', JSON.stringify({ pr, pr2 }));
    const bas = SN.snCadence({ actionsHeure: 10, favorisHeure: 1 }, SN.snNote({ ev: ev([[1, 'captcha'], [2, 'captcha'], [3, 'captcha'], [4, '403']]), masquees: [], vues: null }, T0), true);
    dit(bas.actionsHeure === 5 && bas.favorisHeure === 1, 'A9 jamais sous 5 actions/h ni 1 favori/h', JSON.stringify(bas));
    const haut = SN.snCadence({ actionsHeure: 12, favorisHeure: 3 }, vide, false);
    dit(haut.actionsHeure === 12 && haut.favorisHeure === 3 && SN.snCadence({ actionsHeure: 4, favorisHeure: 1 }, deux, false).actionsHeure <= 4, 'A9 jamais au-dessus de SON réglage (même sous le minimum)', JSON.stringify(haut));
    dit(['repub-serie', 'favoris-auto', 'offre-auto', 'agent', 'relance-auto', 'lot-auto', 'brouillon-auto'].every((s) => SN.snPrecieuxBloque(true, s)) && !SN.snPrecieuxBloque(true, 'clic') && !SN.snPrecieuxBloque(false, 'offre-auto'), 'A10 précieux bloque la série, les favoris auto, les offres auto, l’agent, les relances, lots et brouillons seuls — jamais ses clics');
  });
  if (LR) await essai('B', async () => {
    const acc = { conv: '7001', opp: '9001', login: 'acheteur_a', item: '50001', tx: '8001', cap: new Date(T0).toISOString(),
      messages: [{ entity_type: 'offer_request_message', entity: { user_id: 9001, status: 20, price: { amount: '40.0' }, created_at_ts: (T0 - 30 * H) / 1000, transaction_id: 8001 } }] };
    const x = LR.lrOffreSansAchat(acc);
    dit(x && x.etat === 'acceptee' && x.offre === 4000 && x.at === T0 - 30 * H && x.relanceVue === false, 'B1 offre ACCEPTÉE (statut 20) lue : 40 €, l’heure de l’offre', JSON.stringify(x));
    dit(LR.lrOffreRatee(acc) === null, 'B1 une offre acceptée n’est pas une offre « ratée » (la règle d’avant ne change pas)');
    const apres = JSON.parse(JSON.stringify(acc)); apres.messages.push({ entity_type: 'offer_message', entity: { user_id: 1, price: { amount: '42' } } });
    dit(LR.lrOffreSansAchat(apres).relanceVue === true, 'B1 une offre du vendeur APRÈS ⇒ déjà relancée (jamais deux)');
    dit(LR.lrReglageRelance({}).jours === 1 && LR.lrReglageRelance({}).actif === false && LR.lrReglageLot({}).actif === false && LR.lrReglageLot({ actif: true }).actif === true, 'B2 délai par défaut 24 h (1 j), relance et lot seuls ÉTEINTS par défaut, allumables');
    const ctx = (o) => Object.assign({ maintenant: T0, jours: 1, taux: 10, deja: new Set(), etatArticle: () => 'en_vente', prixArticle: () => 50, planchers: () => ({ mini: 35 }) }, o);
    let l = LR.lrRelances([x], ctx({ luA: T0 - 10 * H }))[0];
    dit(l.etat === 'attente' && l.raison === 'relire', 'B3 dressing lu AVANT la fin du délai ⇒ elle attend la lecture suivante (« pas acheté » se PROUVE)', JSON.stringify(l));
    l = LR.lrRelances([x], ctx({ luA: T0 - 1 * H }))[0];
    dit(l.etat === 'pret' && l.prix === 4000, 'B3 annonce relue encore en vente APRÈS 24 h ⇒ prête, au prix qu’il avait obtenu (40 €)', JSON.stringify(l));
    l = LR.lrRelances([x], ctx({ luA: T0, etatArticle: () => 'vendu' }))[0];
    dit(l.etat === 'ecarte' && l.raison === 'plus_en_vente', 'B3 vendue ou réservée ⇒ écartée');
    l = LR.lrRelances([x], ctx({ luA: T0, uneEtoile: () => true }))[0];
    dit(l.etat === 'ecarte' && l.raison === 'note_basse', 'B4 acheteur noté 1 étoile ⇒ jamais relancé', JSON.stringify(l));
    const ref = { conv: '7002', acheteur: '9002', pseudo: 'b', item: '50002', tx: '8002', offre: 3000, etat: 'refusee', at: T0 - 30 * H, atSur: true, relanceVue: false };
    l = LR.lrRelances([ref], ctx({ palier: () => 44 }))[0];
    dit(l.etat === 'pret' && l.prix === 4400 && l.palier === 4400, 'B5 le palier de SA négociation (44 €) remplace le taux', JSON.stringify(l));
    l = LR.lrRelances([ref], ctx({ palier: () => 20 }))[0];
    dit(l.prix === 3500, 'B5 jamais sous le plancher (prix mini 35 €)', JSON.stringify(l));
    const V = ['Bonjour {pseudo}, toujours partant à {prix} ?', 'Re {pseudo} ! {prix} pour toi.', 'Salut {pseudo}, {article} : {prix}.'];
    const vars = { pseudo: 'acheteur_a', prix: 4000, article: '' };
    const m1 = LR.lrMessageRelance(V, vars, '', 0);
    const m2 = LR.lrMessageRelance(V, vars, m1, 0);
    dit(m1 === 'Bonjour acheteur_a, toujours partant à 40 € ?' && m2 !== m1 && m2.includes('40 €'), 'B6 message varié : une version, jamais la même deux fois de suite, {prix} rempli', `${m1} | ${m2}`);
    dit(!V.slice(2).map((t) => LR.lrMessageRelance([t], vars, '', 0)).some(Boolean) && LR.lrMessageRelance([], vars, '', 0) === '', 'B6 une variable inconnue ({article} vide) ⇒ version sautée ; aucune version ⇒ rien');
    const b = LR.lrBilan([{ sorte: 'relance', tx: '8001', prix: 4000 }, { sorte: 'relance', tx: '8002', prix: 3500 }, { sorte: 'lot', conv: '1' }], new Set(['8001']), 'relance');
    dit(b.envoyees === 2 && b.ventes === 1 && b.montant === 4000, 'B7 bilan : 2 relances, 1 vente obtenue — par n° de transaction', JSON.stringify(b));
    dit(LR.lrBilan([{ sorte: 'relance', tx: '8001' }], null, 'relance').ventes === null, 'B7 preuves pas lues ⇒ « — » (null), jamais 0');
    dit(LR.lrCleLot('9001', [{ itemId: '3' }, { itemId: '1' }]) === LR.lrCleLot('9001', ['1', '3']) && LR.lrCleLot('9001', ['1', '3']) !== LR.lrCleLot('9001', ['1', '4']), 'B8 lot : une fois par personne ET par ensemble (identifiants triés)');
  });

  // ── C : le VRAI fond ──
  const { faireFond } = require('./_fond-vm.cjs');
  const UID = '111';
  const jourParis = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
  const fond = (extra = {}) => { const t = Date.now(); return faireFond({ src: SRC, connecte: UID, lignes: Object.assign({ main: { vinted_discretion: { parJour: 1000 } } }, extra.lignes || {}), store: Object.assign({ vrmJourTire: { [UID]: { d: jourParis(t), f: 1, at: t } } }, extra.store || {}) }); };
  const compter = async (C, plafond, n) => { let k = 0; for (let i = 0; i < n; i++) { const r = await C.compterAction(UID, plafond); if (r.ok) k++; else return { k, code: r.code }; } return { k }; };
  const precieuxLigne = (on) => ({ vrm_reglages_auto: { v: 1, rev: 1, cles: { vinted_bleam: { v: 1, comptes: { [UID]: { precieux: { actif: on } } } } } } });
  await essai('C1', async () => {
    const t = Date.now();
    const f0 = fond();
    const a0 = await compter(f0.ctx, 50, 80);
    const f = fond({ store: { vrmCarnet: { [UID]: [{ t: t - 2 * H, s: 'captcha' }, { t: t - 5 * H, s: 'captcha' }] } } });
    const a = await compter(f.ctx, 50, 80);
    dit(a0.k === 50 && a.k === 30, 'C1 le VRAI compteur : 50/h sans rien, 30/h après 2 vérifications en 24 h — la cadence baisse SEULE', `${a0.k} → ${a.k}`);
    const ce = await f.ctx.cadenceEffective(UID);
    dit(ce.applique && ce.applique.reduite && ce.sn && ce.sn.note === 70 && (await f.ctx.cadenceCompte(UID)).actionsHeure === 50, 'C1 SON réglage reste 50/h (les curseurs ne bougent pas) ; la cadence APPLIQUÉE est 30/h', JSON.stringify(ce && ce.applique));
    const ligne = Object.entries(f.lignes).find(([id]) => id.startsWith('actions_compte_' + UID + '_'));
    const no = ligne && ligne[1] && ligne[1].note;
    dit(no && no.n === 70 && no.cap === 30 && no.ph === 'reduite' && no.raison && no.raison.k === 'captcha' && Array.isArray(no.manque), 'C2 la note est publiée dans la ligne de la jauge (lue par « Mes comptes ») : 70, 30/h, la raison', JSON.stringify(no));
    const s = await f.ctx.santeComptes();
    const c = s && s.comptes && s.comptes.find((x) => x.uid === UID);
    dit(c && c.note && c.note.note === 70 && c.phrase && c.phrase.cle === 'reduite' && c.maxH === 30, 'C2 la page Santé du panneau reçoit la note, la phrase et le plafond appliqué (30)', JSON.stringify(c && { n: c.note && c.note.note, ph: c.phrase, maxH: c.maxH }));
  });
  await essai('C3', async () => {
    const f = fond({ lignes: precieuxLigne(true) });
    const a = await compter(f.ctx, 50, 80);
    dit(a.k === 25, 'C3 compte précieux : 25 actions/h (la moitié)', a.k);
    const p = await f.ctx.atelierPreparer({ ids: ['10001', '10002'], espacement: { mode: 'fixe', min: 5, max: 5 } }, UID);
    dit(p && p.ok === false && p.code === 'precieux' && /une paire à la fois/.test(p.raison), 'C3 précieux : l’atelier refuse une SÉRIE et le dit (une paire à la fois)', JSON.stringify(p));
    const p1 = await f.ctx.atelierPreparer({ ids: ['10001'], espacement: { mode: 'fixe', min: 5, max: 5 } }, UID);
    dit(!(p1 && p1.code === 'precieux'), 'C3 précieux : UNE paire sur son toucher passe', JSON.stringify(p1));
    const off = fond({ lignes: precieuxLigne(false) });
    dit(!(await off.ctx.precieuxBloque(UID, 'offre-auto')) && (await compter(off.ctx, 50, 80)).k === 50, 'C3 précieux éteint : rien bloqué, 50/h');
    const pb = await f.ctx.precieuxBloque(UID, 'offre-auto');
    dit(pb && pb.code === 'precieux' && pb.sorte === 'offre-auto', 'C3 précieux : l’acceptation automatique est refusée, avec SA raison', JSON.stringify(pb));
    const corps = (nom) => { const i = BG.indexOf('async function ' + nom + '('); if (i < 0) return ''; const j = BG.indexOf('\nasync function ', i + 10); const k = BG.indexOf('\nfunction ', i + 10); return BG.slice(i, Math.min(j < 0 ? Infinity : j, k < 0 ? Infinity : k)); };
    const gardes = { autoAccepterOffresUnPassage: 'offre-auto', agentTick: 'agent', relanceOffresAuto: 'relance-auto', piloteFavorisTick: 'favoris-auto', lotFavorisAuto: 'lot-auto', brouillonsAutoTick: 'brouillon-auto', cycleVieTickUn: 'repub-serie', atelierRepubTick: 'repub-serie' };
    const manque = Object.entries(gardes).filter(([fn, so]) => !new RegExp(`precieuxBloque\\((?:a\\.)?uid, '${so}'\\)`).test(corps(fn)));
    dit(!manque.length, 'C3 chaque moteur automatique passe par « précieux » (offres, agent, relances, favoris, lots, brouillons, cycle, série en cours)', manque.map((x) => x[0]).join(', '));
    // Il le SAIT précieux puis la base ne répond plus : le dernier état lu tient (jamais « normal » sur un doute).
    const g = f.ctx, orig = g.sbGet; g.sbGet = async (q) => (/vrm_reglages_auto|id=eq\.main/.test(String(q)) ? null : orig(q));
    f.store.vrmPrecieuxConnu[UID].at = 0;
    dit((await g.precieuxDe(UID)) === true, 'C3 base muette : un compte connu précieux le reste');
  });
  await essai('C4', async () => {
    const C = fond().ctx;
    dit(C.refusLuPourNote({ ok: false, status: 400 }, 'message') === 'msgrefus' && C.refusLuPourNote({ ok: false, status: 422 }, 'offre') === 'refus' && C.refusLuPourNote({ ok: false, status: 200, data: { code: 106 } }, 'offre') === 'refus',
      'C4 Vinted a RÉPONDU non ⇒ le carnet compte un refus (message refusé à part)');
    dit(C.refusLuPourNote({ ok: false, rienParti: true, status: 0 }, 'message') === '' && C.refusLuPourNote({ ok: false, status: 403 }, 'offre') === '' && C.refusLuPourNote({ ok: true, status: 200 }, 'offre') === '' && C.refusLuPourNote({ ok: false, incertain: true }, 'offre') === '',
      'C4 rien parti, un doute, un 403 (déjà compté) ou un succès ⇒ rien au carnet');
  });
  await essai('C5', async () => {
    const t = Date.now();
    const f = fond({ lignes: { ['moderation_vinted_' + UID]: { uid: UID, v: 1, e: [{ k: 'masquee:50001:1', s: 'masquee', t: t - 30 * H, a: '50001', f: t - 2 * H }, { k: 'masquee:50002:1', s: 'masquee', t: t - 5 * H, a: '50002' }] } } });
    const C = f.ctx;
    const r = await C.moderationCarte({ tab: { id: 7, url: 'https://www.vinted.fr/' }, url: 'https://www.vinted.fr/' });
    dit(r && r.ok && Array.isArray(r.revenues) && r.revenues.length === 1 && r.revenues[0].a === '50001' && r.liste.length === 1 && r.liste[0].a === '50002', 'C5 Accueil : l’annonce que Vinted ne masque plus est DITE (« à nouveau visible »), l’autre reste en alerte', JSON.stringify(r));
    const sn = await C.noteCompteDe(UID, { frais: true });
    dit(sn && sn.points.some((p) => p.k === 'masquee' && p.n24 === 1 && p.n72 === 2), 'C5 la note compte les annonces masquées par Vinted (ligne de modération)', JSON.stringify(sn && sn.points));
  });
  await essai('C6', async () => {
    const C = fond().ctx;
    const fi = [{ id: 'a', prepare: true, depose: '', manqueBrouillon: ['photos'], nPhotos: 0 }, { id: 'b', prepare: true, depose: 'brouillon', manqueBrouillon: [], nPhotos: 3 }, { id: 'c', prepare: true, depose: '', manqueBrouillon: [], nPhotos: 4 }, { id: 'd', prepare: false, depose: '', manqueBrouillon: [], nPhotos: 4 }];
    const x = C.brouillonAutoSuivant(fi, {});
    dit(x && x.id === 'c', 'C6 brouillon préparé seul : la fiche PRÊTE (rien d’obligatoire ne manque), pas sur Vinted', x && x.id);
    dit(C.brouillonAutoSuivant(fi, { c: 1 }) === null, 'C6 une fiche déjà tentée ne l’est jamais deux fois');
    const s = BG.slice(BG.indexOf('async function brouillonsAutoTick('), BG.indexOf('function brouillonAutoSuivant('));
    dit(/B\.brouillonsAuto\.actif !== true\) return 0/.test(s) && /compteConnecte\(/.test(s) && /garde\(uid, acc, \{ compter: false, sorte: 'depot', rythme: true \}\)/.test(s) && /depotEtat\(\)[\s\S]{0,80}etat === 'cours'\) return 0/.test(s) && /essayees\[x\.id\] = Date\.now\(\)[\s\S]*chrome\.storage\.local\.set\(\{ \[BROUILLONS_AUTO\]/.test(s), 'C6 éteint par défaut ; compte de l’onglet ; gardes et rythme des gestes automatiques ; un dépôt à la fois ; noté AVANT');
    const p = BG.slice(BG.indexOf('async function depotPublierUn('), BG.indexOf('// ── LES MISES EN LIGNE PLANIFIÉES'));
    dit(/msg\.confirme !== true/.test(p) && /code: 'prix-mini'/.test(p) && /publierBrouillon\(/.test(p), 'C6 « Publier » : SON toucher, le prix mini demandé avant (sinon redemandé), le chemin gardé de la mise en ligne');
  });

  await essai('C7', async () => {
    // La programmation d'avant en pause « en vérification » (5.437) : montrée et reprise sur SON toucher (5.438).
    const t = Date.now();
    const pv = { p1: { p: { id: 'p1', uid: UID, action: 'recreer', reglages: {} }, restants: ['10002', '10003'], deja: 1, verif: { nouvelId: '10009', titre: 'Nike Dunk', depuis: t - 25 * H, n: 6, prochaine: t + 30 * 60000, aToi: true } },
      p2: { p: { id: 'p2', uid: '999', action: 'recreer' }, restants: ['1'], deja: 0, verif: { nouvelId: '2', depuis: t, n: 1, prochaine: t + 5 * 60000 } } };
    const f = fond({ store: { vrmProgVerif: JSON.parse(JSON.stringify(pv)) } });
    const C = f.ctx, sender = { tab: { id: 7, url: 'https://www.vinted.fr/' }, url: 'https://www.vinted.fr/' };
    const l = await C.progVerifPour(UID);
    dit(Array.isArray(l) && l.length === 1 && l[0].id === 'p1' && l[0].aToi === true && l[0].restants === 2, 'C7 la programmation d’avant en pause « en vérification » est rendue au panneau (ce compte seulement, 24 h ⇒ à toi)', JSON.stringify(l));
    const r0 = await C.progVerifReprendre({ id: 'p1' }, sender);
    const r1 = await C.progVerifReprendre({ id: 'p2', confirme: true }, sender);
    dit(r0.ok === false && r0.code === 'confirmation' && r1.ok === false && r1.code === 'compte' && !!f.store.vrmProgVerif.p1, 'C7 sans SA confirmation, ou pour un autre compte que celui de l’onglet : rien ne repart', JSON.stringify({ r0, r1 }));
    const r2 = await C.progVerifReprendre({ id: 'p1', confirme: true }, sender);
    dit(r2.ok === true && !f.store.vrmProgVerif.p1 && !!f.store.vrmProgVerif.p2, 'C7 « Reprendre la série » : la pause levée, les paires restantes repartent par le même chemin', JSON.stringify(r2));
  });

  // ── D : le panneau et l'app ──
  const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
  const badge = lire('vinted-sync-extension/vrm-badge.js'), ui = lire('vinted-sync-extension/vrm-ui.js'), depot = lire('vinted-sync-extension/vrm-depot.js'), app = lire('src/App.jsx');
  const adist = lire('src/aDistance/EcranADistance.jsx'), alerte = lire('src/AlerteModeration.jsx');
  dit(/progVerifHtml\(\) \+ moderationHtml\(\)/.test(badge) && /action: 'progVerifReprendre'[\s\S]{0,140}confirme: true/.test(badge), 'D0 panneau : la programmation d’avant en pause est dite sur l’Accueil, « Reprendre la série » sur SON toucher');
  dit(/\$\{noteSanteHtml\(c\)\}/.test(badge) && /noteAccueilHtml\(\)/.test(badge) && /\$\{precieuxHtml\(\)\}/.test(badge) && /brancher5438\(racine\)/.test(badge), 'D1 panneau : la note dans Santé, sur l’Accueil, et « Compte précieux » dans Paramètres');
  dit(/bmEnvoyer\('precieux', true, false/.test(badge) && /bmEnvoyer\('precieux', false, true/.test(badge), 'D1 « précieux » : l’allumer sans question, l’éteindre sur SA confirmation');
  dit(/id: 'lot', titre: 'bm_lot'/.test(badge) && /id: 'brouillons', titre: 'bm_brouillons'/.test(badge) && /bilanHtml\('relance'\)/.test(badge) && /bmTexte\('relanceOffres', 'messages'/.test(badge), 'D2 Automatisations : lot seul, brouillons seuls, messages et bilan des relances');
  dit(/data-depot-publier-un/.test(depot) && /action: 'depotPublierUn'/.test(depot) && /PRIX_MINI/.test(depot), 'D3 dépôt : « Publier » en un toucher sur un brouillon prêt, prix mini demandé (5.437)');
  const cles = [...new Set((badge.match(/TU\('((?:sn|pr|bi|lot_auto|bm_lot|bm_brouillons|br|rel_messages|rel_sans|rel_r_note|rel_r_relire|md_visible|md_modifier|md_contacter)[a-z_]*)'/g) || []).map((x) => x.slice(4, -1)))];
  const sansLangue = cles.filter((k) => !/_$/.test(k)).filter((k) => { const m = new RegExp(`\\n    ${k}: \\{([^\\n]*)\\}`).exec(ui); return !m || !['fr:', 'en:', 'es:', 'it:', 'de:'].every((lg) => m[1].includes(lg)); });
  dit(cles.length >= 30 && !sansLangue.length, `D4 les ${cles.length} textes du panneau existent en 5 langues`, sansLangue.join(', '));
  dit(/notesDesLignes/.test(adist) && /<GroupeNote /.test(adist) && /data-adist-note-rangee/.test(adist), 'D5 app « Mes comptes » : la note sur chaque rangée et la santé dans la page du compte');
  dit(/mod5438\.visible/.test(alerte) && /mod5438\.modifier/.test(alerte) && /mod5438\.contacter/.test(alerte) && /:f'/.test(alerte), 'D6 app : la carte dit « à nouveau visible » (une fois, « C’est vu ») et les gestes vérifier · modifier · contacter Vinted');
  const lg = {}; for (const l of ['fr', 'en', 'es', 'it', 'de']) { try { const t = lire(`src/i18n/langues/${l}/ext5438.js`); lg[l] = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch (_) { lg[l] = null; } }
  const clesApp = [...new Set(((adist + alerte).match(/tr\('((?:adist\.note|mod5438)\.[\w.]+)'/g) || []).map((x) => x.slice(4, -1)))];
  const dyn = ['adist.note.ph.normale', 'adist.note.ph.reduite', 'adist.note.ph.precieux', 'adist.note.k.captcha', 'adist.note.k.masquee', 'adist.note.manque.vues', 'adist.note.raison'];
  const absentes = clesApp.filter((k) => !/\.$/.test(k)).concat(dyn).filter((k) => !['fr', 'en', 'es', 'it', 'de'].every((l) => lg[l] && typeof lg[l][k] === 'string' && lg[l][k]));
  dit(clesApp.length >= 8 && !absentes.length, `D7 les textes de l’app (${clesApp.length} + clés calculées) existent en 5 langues`, absentes.join(', '));
  let N = null; try { N = await import(path.join(R, 'src/noteCompteLue.js')); } catch (e) { dit(false, 'D8 src/noteCompteLue.js absent ou cassé', e.message); }
  if (N) {
  const rows = [{ id: 'actions_compte_111_a', at: new Date(T0 - 2 * H).toISOString(), note: { n: 70, pct: 60, cap: 30, ph: 'reduite', reduite: true, raison: { k: 'captcha', n: 2, h: 24 } } },
    { id: 'actions_compte_111_b', at: new Date(T0 - 30 * H).toISOString(), note: { n: 100, pct: 100, cap: 50, ph: 'normale' } },
    { id: 'actions_compte_222_a', at: new Date(T0).toISOString(), note: { n: null } }, { id: 'actions_compte_333_a', at: new Date(T0).toISOString() }];
  const n = N.notesDesLignes(rows, T0);
  dit(n['111'] && n['111'].n === 70 && n['111'].cap === 30 && !n['222'] && !n['333'] && N.notesDesLignes(null) === null, 'D8 l’app lit la note la PLUS FRAÎCHE des navigateurs ; note absente ou pas sue ⇒ rien (jamais un 100 inventé)', JSON.stringify(n));
  dit(N.notesDesLignes([rows[1]], T0)['111'].vieille === true, 'D8 une note de plus de 24 h est dite « ancienne »');
  }
  const caps = (/const EXT_CAPACITES = \{([^}]*)\}/.exec(app) || [])[1] || '';
  dit(['santenote', 'precieux', 'relancesansachat', 'lotauto', 'brouillonsauto', 'demasquee'].every((k) => new RegExp(`\\b${k}: '5\\.438\\.0'`).test(caps)) && (() => { const v = (re) => { const m = re.exec(app + '\n' + BG); return m ? m[1].split('.').map(Number) : null; }; const ok = (x) => !!x && (x[0] > 5 || (x[0] === 5 && x[1] >= 438)); return ok(v(/const EXT_ATTENDUE = '(\d+\.\d+\.\d+)'/)) && ok(v(/const CODE_VERSION = '(\d+\.\d+\.\d+)'/)); })(), 'D9 capacités 5.438.0, EXT_ATTENDUE et CODE_VERSION (5.438.0 ou plus, 5.440 : la version suivante)');
  dit(!/heure.{0,30}(nuit|22|23).{0,40}return 0/.test(BG.slice(BG.indexOf('async function lotFavorisAuto('), BG.indexOf('function brouillonAutoSuivant('))), 'D10 aucun blocage à la nuit dans les nouveaux moteurs (ils tournent la nuit, dans les plafonds)');

  console.log(`\n${ko ? '❌' : '✅'} audit-ext-5438 : ${ok} verts, ${ko} rouge(s)`);
  if (mut) { try { fs.unlinkSync(SRC); } catch (_) {} }
  process.exit(ko ? 1 : 0);
})();
