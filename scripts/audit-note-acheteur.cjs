#!/usr/bin/env node
// audit-note-acheteur (21 nov., ext. 5.430, `noteacheteur`, `traductionlocale`) — LA NOTE DES ACHETEURS ET LA TRADUCTION.
// Julien (21 nov.) : « tu n'acceptes pas les comptes 1 étoile » ; et traduire les messages SANS service en ligne (§2.9).
//  N1. copies identiques (src/noteAcheteur.js ⇄ background.js ; --recopie) ;
//  N2. la RÈGLE : la vraie forme (mesurée : `feedback_reputation` 0–1, `review_count` ; projections `->>` = textes ;
//      0 évaluation porte `feedback_reputation: 0` ⇒ compte NEUF, jamais « 0 étoile ») ; seuil 1,5 par défaut, réglable ;
//      « pas su » ⇒ jamais permis ;
//  N3. le MOTEUR d'offres exécuté (vrai background.js, fausse base, faux Vinted qui compte) : 1 ★ ⇒ jamais accepté
//      (plusieurs passages) ni contre-offre ; note pas lue ⇒ jamais, UNE lecture de profil (budget de lecture), pas de
//      rafale (15 min), puis lue ⇒ acceptée ; seuil réglé respecté ; compte neuf selon SON réglage ;
//  N4. l'AGENT VRM : 1 ★ ⇒ « à toi » (raison dite), aucun geste ; note pas lue ⇒ aucune décision, aucun geste ;
//  N5. SON acceptation à la main : un avertissement d'abord (rien ne part), son second toucher accepte ;
//  N6. la RELANCE automatique : jamais vers un acheteur ≤ seuil ;
//  N7. la TRADUCTION : seulement les API du navigateur (LanguageDetector / Translator) ; aucune adresse de service de
//      traduction, aucun `fetch` dans le code qui traduit (panneau, app) ; rien dans le fond.
// --prouve : chaque garde affaiblie dans une copie ⇒ au moins un rouge.
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os'), cp = require('child_process');
const R = path.join(__dirname, '..');
const F_SRC = path.join(R, 'src/noteAcheteur.js'), F_BG = path.join(R, 'vinted-sync-extension/background.js');
const DEB = '// <note-acheteur-regle>', FIN = '// </note-acheteur-regle>';
const bloc = (t) => { const i = t.indexOf(DEB), j = t.indexOf(FIN); return i < 0 || j < 0 ? null : t.slice(i, j + FIN.length); };
if (process.argv.includes('--recopie')) {
  const b = bloc(fs.readFileSync(F_SRC, 'utf8')); const bg = fs.readFileSync(F_BG, 'utf8'); const vieux = bloc(bg);
  if (!b || !vieux) { console.log('❌ bloc introuvable'); process.exit(1); }
  fs.writeFileSync(F_BG, bg.replace(vieux, () => b)); console.log('✅ bloc <note-acheteur-regle> recopié dans background.js'); process.exit(0);
}
const argSrc = (() => { const i = process.argv.indexOf('--src'); return i > 0 ? path.resolve(process.argv[i + 1]) : F_BG; })();
const BG = fs.readFileSync(argSrc, 'utf8');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? '  → ' + d : '')); } };

// ── N1 / N2 : la règle ──
const ctx0 = {};
try { vm.runInNewContext(bloc(BG) + '\n;globalThis.__f = { naReglage, naNote, naDecision, naPermetAuto, naEtiquette, naMemo, NA_MEMO_MS, NA_REESSAI_MS };', ctx0); }
catch (e) { console.log('❌ N0 bloc absent ou cassé : ' + e.message); process.exit(1); }
const F = ctx0.__f;
dit(argSrc !== F_BG || bloc(fs.readFileSync(F_SRC, 'utf8')) === bloc(BG), 'N1 les deux copies du bloc sont identiques (src/noteAcheteur.js ⇄ background.js)');
const D = (rep, rc, reg) => F.naDecision(F.naNote({ feedback_reputation: rep, review_count: rc }), reg);
dit(JSON.stringify(F.naNote({ feedback_reputation: 0.98, review_count: 132 })) === '{"etoiles":4.9,"n":132}' && JSON.stringify(F.naNote({ feedback_reputation: '0.2', review_count: '3' })) === '{"etoiles":1,"n":3}',
  'N2 la vraie forme (nombres, ou textes d’une projection ->>) : ★ 4,9 · 132 ; ★ 1,0 · 3');
dit(JSON.stringify(F.naNote({ feedback_reputation: 0, review_count: 0 })) === '{"etoiles":null,"n":0}' && D(0, 0) === 'neuf' && D(0, 0, { neufAccepter: false }) === 'neuf-refuse',
  'N2 0 évaluation (feedback_reputation 0) = compte NEUF, jamais « 0 étoile » ; accepté par défaut, refusé si SON réglage le dit');
dit(D(0.2, 3) === 'basse' && D(0.3, 9) === 'basse' && D(0.32, 9) === 'ok' && D(0.96, 40) === 'ok', 'N2 seuil par défaut 1,5 ★ : 1,0 et 1,5 ⇒ « basse » ; 1,6 et 4,8 ⇒ permis');
dit(D(0.5, 10, { seuil: 3 }) === 'basse' && D(0.62, 10, { seuil: 3 }) === 'ok' && D(0.5, 10) === 'ok', 'N2 SON seuil est respecté (3 ★ : 2,5 refusé seul, 3,1 permis ; défaut : 2,5 permis)');
dit([null, {}, { review_count: 4 }, { feedback_reputation: 0.9 }, { feedback_reputation: 2, review_count: 4 }, { feedback_reputation: 'x', review_count: 4 }, { feedback_reputation: 0.9, review_count: -1 }, { feedback_reputation: 0.9, review_count: true }]
  .every((u) => F.naDecision(F.naNote(u), null) === 'pas-su' && !F.naPermetAuto(F.naDecision(F.naNote(u), null))), 'N2 champ absent, hors bornes, pas un nombre ⇒ « pas su » ⇒ jamais permis');
dit(F.naPermetAuto('ok') && F.naPermetAuto('neuf') && !F.naPermetAuto('basse') && !F.naPermetAuto('neuf-refuse') && !F.naPermetAuto('pas-su') && !F.naPermetAuto(undefined), 'N2 un geste automatique n’est permis que sur « ok » et « neuf »');
dit(F.naReglage({ seuil: 9 }).seuil === 1.5 && F.naReglage({ seuil: 2.04 }).seuil === 2 && F.naReglage(null).neufAccepter === true && F.naReglage({ actif: true }).actif === false, 'N2 réglage borné (0,5–4,5), défaut 1,5, compte neuf « oui » ; rien à allumer');
const et = F.naEtiquette(F.naNote({ feedback_reputation: 0.2, review_count: 3 }), null), etN = F.naEtiquette(F.naNote({ feedback_reputation: 0, review_count: 0 }), null), etOk = F.naEtiquette(F.naNote({ feedback_reputation: 0.98, review_count: 132 }), null);
dit(et.ambre && et.k === 'note' && etN.ambre && etN.k === 'neuf' && !etOk.ambre, 'N2 étiquette : ★ 1,0 et compte neuf en ambre ; ★ 4,9 neutre');
dit(F.naMemo({ e: 4.9, n: 132, at: 1000 }, 1000 + F.NA_MEMO_MS - 1) && !F.naMemo({ e: 4.9, n: 132, at: 1000 }, 1000 + F.NA_MEMO_MS + 1) && F.naMemo({ n: 0, at: 5 }, 6).n === 0, 'N2 une note lue vaut 7 jours, pas plus');

(async () => {
  const { faireFond } = require('./_fond-vm.cjs');
  const UID = '111';
  const GARDE_OK = () => ({ v: 1, at: Date.now(), items: [], complet: true, manques: [], ambigus: 0 });
  const conv = ({ item, tx, oid, price, user, note }) => ({ capturedAt: new Date().toISOString(), payload: { conversation: {
    id: '8' + oid, description: 'Nike Air', opposite_user: Object.assign({ id: user, login: 'acheteur' + user }, note || {}), transaction: { item_id: String(item) },
    messages: [{ entity_type: 'offer_request_message', entity: { user_id: user, current: true, status: 10, status_title: '', price: { amount: String(price), currency_code: 'EUR' }, transaction_id: Number(tx), offer_request_id: Number(oid) } }] } } });
  // (22 nov., intégration) `prix` : le moteur d'offres (N3) sert une annonce à 70 € — une offre de 45 € reste dans la garde du prix
  // (5.432 : une acceptation SEULE n'est jamais à plus de 40 % sous le prix) ; l'Agent (N4) garde 100 €.
  const monter = ({ offres, profil = () => ({ status: 500, body: {} }), bleam = null, paliers = false, prix = '100.0' }) => {
    const nums = {}, lignes = {};
    for (const o of offres) { nums[String(o.item)] = { num: String(o.item), min: o.min }; lignes[`harvest_${UID}_conv_${o.oid}`] = conv(o); }
    lignes.main = { vinted_offres_auto: !paliers, vinted_annonce_numeros: nums, vinted_offres_garde: GARDE_OK(), vrm_securite_comptes: { plateformes: { vinted: { repos: { actif: false } } } },
      ...(paliers ? { vinted_offres_paliers: { actif: true, paliers: [50, 80, 100], messages: [] } } : {}) };
    lignes['harvest_' + UID + '_listings'] = { payload: { items: offres.map((o) => ({ id: o.item, title: 'Paire', price: { amount: prix } })) } };
    if (bleam) lignes.vrm_reglages_auto = { v: 1, cles: { vinted_bleam: { v: 1, comptes: { [UID]: bleam } } } };
    const f = faireFond({ src: argSrc, lignes, connecte: UID, vinted: (e) => {
      const m = /^\/api\/v2\/conversations\/(8\d+)$/.exec(e.chemin); const l = m && e.methode === 'GET' ? lignes[`harvest_${UID}_conv_${m[1].slice(1)}`] : null;
      if (l) return { status: 200, body: { conversation: l.payload.conversation } };
      const u = /^\/api\/v2\/users\/(\d+)$/.exec(e.chemin); if (u && e.methode === 'GET') return profil(u[1]);
      return { status: 200, body: { code: 0 } }; } });
    f.ctx.secuGeste = async () => null; f.ctx.porteDiscretion = async () => null;
    return f;
  };
  const passer = async (f, n = 3) => { let t = 0; for (let i = 0; i < n; i++) { const pv = f.store.vrmOffresPrevues || {}; for (const k in pv) if (pv[k]) pv[k].at = Date.now() - 1000; try { t += await f.ctx.autoAccepterOffres(UID); } catch (_) {} } return t; };
  const accepts = (f) => f.j.vinted.filter((v) => v.methode === 'PUT' && /\/offer_requests\/\d+\/accept$/.test(v.chemin)).length;
  const contres = (f) => f.j.vinted.filter((v) => v.methode === 'POST' && /\/transactions\/\d+\/offers$/.test(v.chemin)).length;
  const profils = (f) => f.j.vinted.filter((v) => v.methode === 'GET' && /^\/api\/v2\/users\/\d+$/.test(v.chemin)).length;
  const UNE = { item: 444, tx: 9001, oid: 7001, price: 45, min: 40, user: 501 };

  // N3 — le moteur d'offres
  let f = monter({ prix: '70.0', offres: [Object.assign({}, UNE, { note: { feedback_reputation: 0.96, review_count: 40 } })] });
  await passer(f);
  dit(accepts(f) === 1 && profils(f) === 0, 'N3 acheteur ★ 4,8 · 40 (lu dans la conversation rangée) : UNE acceptation, aucune lecture de profil', `accepts=${accepts(f)} profils=${profils(f)}`);
  f = monter({ prix: '70.0', offres: [Object.assign({}, UNE, { note: { feedback_reputation: 0.2, review_count: 3 } })] });
  await passer(f, 4);
  dit(accepts(f) === 0 && !(f.store.vrmOffresFaites || {})[String(UNE.oid)], 'N3 acheteur ★ 1,0 · 3 : JAMAIS accepté seul (4 passages), l’offre reste à lui (rien noté « faite »)', `accepts=${accepts(f)}`);
  f = monter({ prix: '70.0', offres: [Object.assign({}, UNE, { note: { feedback_reputation: 0.2, review_count: 3 } })], paliers: true });
  await passer(f, 3);
  dit(contres(f) === 0 && accepts(f) === 0, 'N3 négociation par paliers : AUCUNE contre-offre automatique à un acheteur ★ 1,0', `contres=${contres(f)}`);
  f = monter({ prix: '70.0', offres: [Object.assign({}, UNE, { note: { feedback_reputation: 0.2, review_count: 3 } })], paliers: true });
  f.lignes['harvest_' + UID + '_conv_' + UNE.oid].payload.conversation.opposite_user.feedback_reputation = 0.96;
  await passer(f, 3);
  dit(contres(f) === 1, 'N3 (témoin) le même palier à un acheteur ★ 4,8 : la contre-offre part', `contres=${contres(f)}`);
  // note pas lue
  let reponse = { status: 500, body: {} };
  f = monter({ prix: '70.0', offres: [UNE], profil: () => reponse });
  await passer(f, 3);
  const p1 = profils(f);
  dit(accepts(f) === 0 && p1 === 1, 'N3 note PAS lue (absente de la conversation, profil en panne) ⇒ jamais accepté ; UNE lecture de profil, pas de rafale (3 passages)', `accepts=${accepts(f)} profils=${p1}`);
  const es = f.store.vrmNotesEssais || {}; for (const k in es) es[k] = Date.now() - 16 * 60000;
  reponse = { status: 200, body: { user: { id: 501, login: 'acheteur501', feedback_reputation: 0.98, feedback_count: 12 } } };
  await passer(f, 2);
  dit(accepts(f) === 1 && profils(f) === 2, 'N3 nouvelle tentative 15 min plus tard : la note est lue sur le profil (★ 4,9 · 12) ⇒ acceptée une fois', `accepts=${accepts(f)} profils=${profils(f)}`);
  dit(!!(f.store.vrmNotesAcheteurs || {})['501'] && (f.store.vrmNotesAcheteurs || {})['501'].n === 12, 'N3 la note lue est mémorisée (par id d’acheteur, 7 jours)');
  // la lecture passe par le budget de lecture
  f = monter({ prix: '70.0', offres: [UNE], profil: () => ({ status: 200, body: { user: { id: 501, feedback_reputation: 0.98, feedback_count: 12 } } }) });
  const classes = []; const gl0 = f.ctx.gardeLecture; f.ctx.gardeLecture = async (u, a, c) => { classes.push(c); return { ok: false, code: 'trop-de-lectures' }; };
  await passer(f, 2);
  dit(profils(f) === 0 && accepts(f) === 0 && classes.includes('suivi'), 'N3 budget de lecture épuisé ⇒ AUCUNE requête de profil, aucune acceptation (la lecture est dans le budget, classe « suivi »)', JSON.stringify({ p: profils(f), classes }));
  void gl0;
  // seuil réglé, compte neuf
  f = monter({ prix: '70.0', offres: [Object.assign({}, UNE, { note: { feedback_reputation: 0.5, review_count: 10 } })], bleam: { noteAcheteurs: { seuil: 3 } } });
  await passer(f);
  const f2 = monter({ prix: '70.0', offres: [Object.assign({}, UNE, { note: { feedback_reputation: 0.5, review_count: 10 } })] });
  await passer(f2);
  dit(accepts(f) === 0 && accepts(f2) === 1, 'N3 SON seuil (3 ★) respecté : ★ 2,5 pas accepté seul ; au seuil par défaut (1,5) il l’est', `${accepts(f)} / ${accepts(f2)}`);
  f = monter({ prix: '70.0', offres: [Object.assign({}, UNE, { note: { feedback_reputation: 0, review_count: 0 } })], bleam: { noteAcheteurs: { neufAccepter: false } } });
  await passer(f);
  const f3 = monter({ prix: '70.0', offres: [Object.assign({}, UNE, { note: { feedback_reputation: 0, review_count: 0 } })] });
  await passer(f3);
  dit(accepts(f) === 0 && accepts(f3) === 1, 'N3 compte sans évaluation : accepté par défaut (signalé), jamais s’il a choisi « Non »', `${accepts(f)} / ${accepts(f3)}`);

  // N4 — l'agent VRM
  const agent = async (note, profil) => {
    const fa = monter({ offres: [Object.assign({}, UNE, { price: 70, min: 85, note })], profil, bleam: { agent: { actif: true, allumeAt: 1 } }, paliers: true });
    fa.lignes.main.vinted_offres_auto = false; fa.lignes.main.vinted_offres_paliers.actif = false;
    const c = fa.ctx; const gestes = [];
    c.garde = async () => null; c.lireFreinRepub = async () => null; c.delaiOffreMs = () => 0; c.facteurPrudence = async () => 1; c.annonceIndisponibleLue = async () => '';
    c.pauseCompteBloqueDit = async () => null; c.relireOffre = async () => ({ etat: 'attend' });
    c.contreOffreAuto = async (x) => { gestes.push({ g: 'contre', prix: x.prix }); return { ok: true }; };
    c.repondreOffre = async (x) => { gestes.push({ g: x.quoi }); return { ok: true }; };
    for (let i = 0; i < 3; i++) await c.agentTick(UID);
    return { gestes, J: (await c.agentJournal(UID)) || [] };
  };
  let a = await agent({ feedback_reputation: 0.2, review_count: 3 });
  dit(a.gestes.length === 0 && a.J.some((e) => e.geste === 'a_toi' && e.raison === 'note_basse'), 'N4 Agent VRM, acheteur ★ 1,0 : « à toi » (raison : sa note), AUCUN geste', JSON.stringify(a));
  a = await agent(null, () => ({ status: 500, body: {} }));
  dit(a.gestes.length === 0 && !a.J.some((e) => e.sorte === 'offre'), 'N4 Agent VRM, note pas lue : aucune décision écrite, aucun geste (relue au passage suivant)', JSON.stringify(a));
  a = await agent({ feedback_reputation: 0.96, review_count: 40 });
  dit(a.gestes.length === 1 && a.gestes[0].g === 'contre' && a.gestes[0].prix === 93, 'N4 (témoin) acheteur ★ 4,8 : l’agent négocie (contre-offre 93 €)', JSON.stringify(a.gestes));

  // N5 — à la main : l'avertissement, puis SON second toucher
  {
    const fm = monter({ offres: [Object.assign({}, UNE, { note: { feedback_reputation: 0.2, review_count: 3 } })] });
    const c = fm.ctx; const envois = [];
    c.compteConnecte = async () => UID; c.ongletCarte = () => ({ id: 7, url: 'https://www.vinted.fr/inbox' });
    c.offresCarteMemo = async () => ({}); c.offreCarteBloquee = () => null; c.noterOffreCarte = async () => {};
    c.executerPourAppCoeur = async (req) => { envois.push(req); return { ok: true, status: 200, data: { code: 0 } }; };
    c.etatGesteVinted = () => 'confirme';
    const r1 = await c.offreCarte({ quoi: 'accept', tx: String(UNE.tx), oid: String(UNE.oid), confirme: true }, { tab: { id: 7, url: 'https://www.vinted.fr/inbox' } });
    dit(!r1.ok && r1.code === 'note' && r1.decision === 'basse' && r1.note && r1.note.etoiles === 1 && envois.length === 0, 'N5 à la main, acheteur ★ 1,0 : un AVERTISSEMENT d’abord, rien ne part', JSON.stringify(r1));
    const r2 = await c.offreCarte({ quoi: 'accept', tx: String(UNE.tx), oid: String(UNE.oid), confirme: true, noteVue: true }, { tab: { id: 7, url: 'https://www.vinted.fr/inbox' } });
    dit(r2.ok && envois.length === 1 && /\/accept$/.test(envois[0].endpoint), 'N5 son second toucher (« Accepter quand même ») : l’acceptation part, une fois', JSON.stringify({ r2, n: envois.length }));
  }

  // N6 — la relance automatique
  {
    const J = 86400000, now = Date.now(), CONV = '87001';
    const L = { main: { vinted_annonce_numeros: { '7001': { min: '50' } }, vrm_securite_comptes: { plateformes: { vinted: { repos: { actif: false } } } } }, vinted_listing_dates: {},
      ['harvest_' + UID + '_listings']: { payload: { items: [{ id: 7001, title: 'Nike Dunk', price: { amount: '60.0' } }] } },
      ['harvest_' + UID + '_conv_' + CONV]: { capturedAt: new Date(now).toISOString(), payload: { conversation: { id: Number(CONV), opposite_user: { id: 999, login: 'a9', feedback_reputation: 0.2, review_count: 3 }, transaction: { id: 55, item_id: 7001 },
        messages: [{ entity_type: 'offer_request_message', created_at_ts: Math.floor((now - 5 * J) / 1000), entity: { user_id: 999, status: 30, status_title: 'Refusée', price: { amount: '40.0' }, transaction_id: 55, offer_request_id: 66 } }] } } },
      vrm_reglages_auto: { v: 1, cles: { vinted_bleam: { v: 1, comptes: { [UID]: { relanceOffres: { actif: true, jours: 3, taux: 10 } } } } } } };
    const rel = async (rep) => {
      const Lx = JSON.parse(JSON.stringify(L)); Lx['harvest_' + UID + '_conv_' + CONV].payload.conversation.opposite_user.feedback_reputation = rep;
      const Fd = faireFond({ src: argSrc, lignes: Lx, connecte: UID }); const g = [];
      Fd.ctx.compteConnecte = async () => UID; Fd.ctx.garde = async () => null; Fd.ctx.annonceIndisponibleLue = async () => ''; Fd.ctx.delaiOffreMs = () => 0; Fd.ctx.facteurPrudence = async () => 1; Fd.ctx.secuGeste = async () => null;
      Fd.ctx.executerPourAppCoeur = async (req) => { g.push(req); return { ok: true, status: 200, data: { code: 0 } }; };
      Fd.ctx.interfaceVinted = async (acc, geste) => { g.push({ geste }); return { ok: true, status: 200, data: { code: 0 }, vu: true }; };
      for (let i = 0; i < 3; i++) await Fd.ctx.relanceOffresAuto(UID);
      return g.length;
    };
    const n1 = await rel(0.2), n5 = await rel(0.96);
    dit(n1 === 0 && n5 >= 1, 'N6 « Relancer seul » : jamais de contre-offre automatique vers un acheteur ★ 1,0 (témoin ★ 4,8 : elle part)', `${n1} / ${n5}`);
  }

  // N7 — la traduction : le navigateur seul
  {
    const sans = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    const UI = sans(fs.readFileSync(path.join(R, 'vinted-sync-extension/vrm-ui.js'), 'utf8'));
    const i = UI.indexOf('const traduction = Object.freeze('), j = UI.indexOf('globalThis.VRM_UI', i);
    const tradUi = i > 0 && j > i ? UI.slice(i, j) : '';
    const BADGE = sans(fs.readFileSync(path.join(R, 'vinted-sync-extension/vrm-badge.js'), 'utf8'));
    const k = BADGE.indexOf('const TRAD = '), l = BADGE.indexOf('const notesConv', k);
    const tradBadge = k > 0 && l > k ? BADGE.slice(k, l) : '';
    const APP = sans(fs.readFileSync(path.join(R, 'src/TraduireLocal.jsx'), 'utf8'));
    const SERVICES = /translate\.googleapis|translation\.googleapis|deepl|api\.openai|anthropic|libretranslate|mymemory|\/api\/ai|microsofttranslator|translate\.yandex/i;
    dit(tradUi && /self\.Translator/.test(tradUi) && /LanguageDetector/.test(tradUi) && !/fetch\(|XMLHttpRequest|sendMessage/.test(tradUi) && !SERVICES.test(tradUi), 'N7 panneau : la traduction n’utilise que Translator / LanguageDetector du navigateur — aucun fetch, aucun message au fond');
    dit(tradBadge && !/fetch\(|XMLHttpRequest/.test(tradBadge) && !SERVICES.test(tradBadge) && !/action: 'traduire'/.test(BADGE), 'N7 panneau : le geste « Traduire » ne part vers aucun réseau');
    dit(/window\.Translator/.test(APP) && !/fetch\(|XMLHttpRequest/.test(APP) && !SERVICES.test(APP), 'N7 app : « Traduire » par l’API Translator de Chrome seulement, aucun fetch');
    dit(!/Translator\.create|translate\.googleapis|deepl/i.test(sans(BG)), 'N7 le fond (service worker) ne traduit rien et n’appelle aucun service de traduction');
  }
  console.log(`\n${ko ? '❌' : '✅'} audit-note-acheteur : ${ok} verts, ${ko} rouges`);
  if (process.argv.includes('--prouve')) prouver();
  process.exitCode = ko ? 1 : 0;
})().catch((e) => { console.log('❌ N ' + (e && e.stack)); process.exitCode = 1; });

function prouver() {
  const M = {
    moteur: ['        if (!naPermetAuto(nd.decision)) {\n          const dits', '        if (false) {\n          const dits'],
    agent: ["  if (n === 'ok' || n === 'neuf') return r;", '  return r;'],
    seuil: ["  return e <= R.seuil + 1e-9 ? 'basse' : 'ok';", "  return e <= 1 ? 'basse' : 'ok';"],
    pasSu: ["const naPermetAuto = (decision) => decision === 'ok' || decision === 'neuf';", "const naPermetAuto = (decision) => decision !== 'basse' && decision !== 'neuf-refuse';"],
    neuf: ["  if (note.n === 0) return R.neufAccepter ? 'neuf' : 'neuf-refuse';", "  if (note.n === 0) return 'neuf';"],
    main: ["    if (quoi === 'accept' && msg.noteVue !== true) {", '    if (false) {'],
    relance: ['      if (naPermetAuto(nd.decision)) { due = x; break; }', '      due = x; break;'],
    rafale: ['    if (es[String(opp)] && t - Number(es[String(opp)]) < NA_REESSAI_MS) return null;\n', ''],
    budget: ['    const refus = await gardeLecture(uid, acc, classe);\n', '    const refus = null;\n'],
    zeroEtoile: ['  if (n === 0) return { etoiles: null, n: 0 };\n  if (brutR', '  if (brutR'],
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'na-mut-'));
  let rouges = 0;
  for (const [k, [a, b]] of Object.entries(M)) {
    const t = BG.replace(a, b);
    if (t === BG) { console.log('❌ mutation ' + k + ' : motif introuvable'); continue; }
    const f = path.join(dir, k + '.js'); fs.writeFileSync(f, t);
    let code = 0; try { cp.execFileSync(process.execPath, [__filename, '--src', f], { stdio: 'pipe', timeout: 240000 }); } catch (e) { code = e.status || 1; }
    console.log((code ? '✅' : '❌') + ` mutation « ${k} » ⇒ ${code ? 'rouge' : 'reste vert'}`); if (code) rouges++;
  }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`--prouve : ${rouges}/${Object.keys(M).length} mutations rouges`);
  if (rouges !== Object.keys(M).length) process.exitCode = 1;
}
