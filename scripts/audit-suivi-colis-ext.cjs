#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT (19 nov., extension 5.409, chantier colis-achat-auto) — LE N° DE SUIVI D'UN ACHAT EXPÉDIÉ EST LU,
//  MÊME QUAND LE COMPTE A DÉJÀ LU DANS L'HEURE.
//
//  Julien : « quand je fais l'achat, l'extension doit capter le numéro de suivi […] ça doit être automatique ».
//  Mesuré sur sa base le 19 nov. : aucune ligne de suivi écrite depuis le 11 nov., 15 colis à retirer sur 15 sans
//  contenu. Exécuté (scripts/mesure-famine-suivi.cjs) sur la 5.408 : dès 7 lectures dans l'heure, AUCUN suivi lu.
//
//  Exécute le VRAI background.js (scripts/_fond-vm.cjs), réponses Vinted INVENTÉES à la forme mesurée
//  (`journey_summary` : carriers[].tracking_code, current_carrier, details[]) :
//   F  famine : 12 lectures déjà faites dans l'heure, réserves pas sues ⇒ les achats expédiés sans n° sont lus
//      et leur n° rangé (classe 'suivicolis') ;
//   B  budget global : 20 lectures déjà faites ⇒ rien (le 20/h reste le plafond, tous lecteurs) ;
//   C  compte de l'onglet : un autre compte connecté ⇒ rien ;
//   P  pause 429/403 posée ⇒ rien ;
//   T  « en tête » : un achat vu PASSER à « expédié » (capture, `noterAchatsExpedies`) est lu d'abord, même relu
//      il y a 1 h quand il n'était que payé ; trois au point relais attendent ;
//   N  `noterAchatsExpedies` : payé ⇒ rien noté ; puis expédié ⇒ noté ; aucune requête Vinted ;
//   R  la réserve : les rattrapages de fond (versements) laissent la part du suivi (« pas su » ⇒ 3, noté 2 ⇒ 2) ;
//   O  l'ordre de la visite : le suivi juste après les codes, avant les versements et les relevés ;
//   V  le passage de fond (`tickVersements`) lit le suivi même quand il n'y a plus de date de versement à lire ;
//   D  le diagnostic par navigateur (`diagNavAjoute` : par jour, aujourd'hui + hier ; publié dans `ext_appareil_`).
//  `--prouve` : un témoin vert, puis chaque mutation doit rendre l'audit rouge. `--src chemin` : une autre copie
//  (l'arbre d'avant : rouge).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');

const H = (h) => new Date(Date.now() - h * 3600000).toISOString();
const cmd = (tx, status, tus = 'waiting', h = 48) => ({ transaction_id: Number(tx), title: `Achat banc ${String(tx).slice(-3)}`, status, transaction_user_status: tus, date: H(h) });
const journey = (n) => ({ journey_summary: { status: 'in_transit', user_side: 'buyer', actions: [], carriers: [{ code: 'MONDIAL', tracking_code: n, is_current: true, priority: 1 }],
  current_carrier: { code: 'MONDIAL', tracking_code: n, is_current: true, priority: 1 },
  details: [{ status: 'shipped', message: 'Colis expédié', timestamp: H(20), cell_type: 'default', carrier: { code: 'MONDIAL', tracking_code: n, is_current: true, priority: 1 } }] } });
const repondre = (req) => {
  const m = /\/transactions\/(\d+)(\/shipment\/journey_summary)?$/.exec(req.chemin);
  if (!m) return { status: 200, body: { user: { id: 111 } } };
  return { status: 200, body: m[2] ? journey('8' + m[1].slice(-7)) : { transaction: { id: Number(m[1]) } } };
};
const achats = (liste) => ({ harvest_111_orders_purchased: { type: 'orders_purchased', payload: { my_orders: liste } } });
const lusJourney = (f) => f.j.vinted.filter((v) => /journey_summary/.test(v.chemin)).map((v) => (/transactions\/(\d+)/.exec(v.chemin) || [])[1]);

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; if (!process.env.MUET) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d !== undefined && !c ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); };
const essai = async (nom, fn) => { try { await fn(); } catch (e) { dit(false, `${nom} — le contrôle a tourné`, String(e && e.message).slice(0, 160)); } };

async function juger(src) {
  ko = 0; ok = 0;
  const SRC = fs.readFileSync(src, 'utf8');
  const trois = () => [cmd('32000000201', 'Colis disponible au point relais', 'needs_action', 30), cmd('32000000202', 'Colis expédié', 'waiting', 40), cmd('32000000203', 'Colis expédié', 'waiting', 50)];

  await essai('F', async () => {
    const lignes = achats(trois());
    const f = faireFond({ src, lignes, connecte: '111', vinted: repondre });
    const t = Date.now();
    f.store.vrmLectures = { '111': Array.from({ length: 12 }, (_, i) => t - 60000 * (i + 1)) };
    await f.ctx.capterSuivisAchats('111');
    const lus = lusJourney(f), ecrits = Object.keys(lignes).filter((k) => /_suivi_/.test(k));
    dit(lus.length >= 2 && ecrits.length >= 2, 'F 12 lectures déjà faites, réserves pas sues : les achats expédiés sans n° sont LUS et leur n° rangé', { lus, ecrits });
    const suivi = ecrits.map((k) => lignes[k] && lignes[k].suivi).filter(Boolean);
    dit(suivi.length === ecrits.length && suivi.every((s) => /^8\d{7}$/.test(s)), 'F le n° rangé est celui de la réponse (le même n° que l’e-mail du transporteur)', suivi);
  });
  await essai('B', async () => {
    const f = faireFond({ src, lignes: achats(trois()), connecte: '111', vinted: repondre });
    const t = Date.now();
    f.store.vrmLectures = { '111': Array.from({ length: 20 }, (_, i) => t - 60000 * (i + 1)) };
    await f.ctx.capterSuivisAchats('111');
    dit(lusJourney(f).length === 0, 'B 20 lectures déjà faites : rien (le budget de lecture global 20/h reste le plafond)', lusJourney(f));
  });
  await essai('C', async () => {
    const f = faireFond({ src, lignes: achats(trois()), connecte: '222', vinted: repondre, comptes: [{ vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', access_token: 'j' }] });
    await f.ctx.capterSuivisAchats('111');
    dit(f.j.vinted.length === 0, 'C un autre compte connecté dans l’onglet : aucune lecture', f.j.vinted.map((v) => v.chemin));
  });
  await essai('P', async () => {
    const f = faireFond({ src, lignes: achats(trois()), connecte: '111', vinted: repondre });
    f.store.vrmPauseVinted = { jusqua: Date.now() + 3600000, until: Date.now() + 3600000, at: Date.now(), raison: '429', status: 429 };
    const p = await f.ctx.pauseVinted();
    await f.ctx.capterSuivisAchats('111');
    dit(!!p && f.j.vinted.length === 0, 'P une pause 429/403 posée : aucune lecture', { pause: !!p, req: f.j.vinted.length });
  });
  await essai('T', async () => {
    // trois achats au point relais sans n° (rang 0) et un en route (rang 1) vu PASSER à « expédié » à la dernière
    // capture, déjà relu il y a 1 h (il n'était que payé : le détail n'avait pas de n°).
    const liste = [cmd('32000000301', 'Colis disponible au point relais', 'needs_action', 30), cmd('32000000302', 'Colis disponible au point relais', 'needs_action', 31),
      cmd('32000000303', 'Colis disponible au point relais', 'needs_action', 32), cmd('32000000304', 'Colis payé', 'waiting', 60)];
    const lignes = achats(liste);
    const f = faireFond({ src, lignes, connecte: '111', vinted: repondre });
    if (typeof f.ctx.noterAchatsExpedies !== 'function') { dit(false, 'T `noterAchatsExpedies` existe'); return; }
    await f.ctx.noterAchatsExpedies('111', [liste[3]]);                         // capture : il est payé
    f.store.vrmSuiviFaits = { '32000000304': Date.now() - 3600000 };              // relu il y a 1 h (payé, sans n°)
    liste[3].status = 'Colis expédié';                                            // capture suivante : expédié
    await f.ctx.noterAchatsExpedies('111', [liste[3]]);
    await f.ctx.capterSuivisAchats('111');
    const lus = lusJourney(f);
    dit(lus[0] === '32000000304', 'T l’achat qui vient de passer à « expédié » est lu EN PREMIER, sans attendre les 3 h', lus);
    dit(lus.length <= 3, 'T 3 lectures par visite, inchangé', lus.length);
  });
  await essai('N', async () => {
    const f = faireFond({ src, lignes: {}, connecte: '111', vinted: repondre });
    if (typeof f.ctx.noterAchatsExpedies !== 'function') { dit(false, 'N `noterAchatsExpedies` existe'); return; }
    const o = cmd('32000000401', 'Colis payé', 'waiting', 10);
    await f.ctx.noterAchatsExpedies('111', [o]);
    const avant = Object.keys(((f.store.vrmSuiviAFaire || {})['111']) || {});
    o.status = 'Colis expédié';
    await f.ctx.noterAchatsExpedies('111', [o]);
    const apres = Object.keys(((f.store.vrmSuiviAFaire || {})['111']) || {});
    dit(avant.length === 0 && apres.includes('32000000401') && f.j.vinted.length === 0, 'N payé ⇒ rien ; passé à « expédié » ⇒ en tête de file ; aucune requête Vinted', { avant, apres, req: f.j.vinted.length });
  });
  await essai('R', async () => {
    const f = faireFond({ src, lignes: {}, connecte: '111', vinted: repondre });
    const t = Date.now();
    const zero = { reste: 0, at: t };
    f.store.vrmLecturesDues = { '111': { releve: zero, retrait: zero, preuve: zero } };
    const pasSu = await f.ctx.reserveAutresQueVersement('111');
    f.store.vrmLecturesDues = { '111': { releve: zero, retrait: zero, preuve: zero, suivi: { reste: 2, at: t } } };
    const deux = await f.ctx.reserveAutresQueVersement('111');
    f.store.vrmLecturesDues = { '111': { releve: zero, retrait: zero, preuve: zero, suivi: zero } };
    const rien = await f.ctx.reserveAutresQueVersement('111');
    dit(pasSu === 3 && deux === 2 && rien === 0, 'R les rattrapages de fond laissent la part du suivi (pas su ⇒ 3 · noté 2 ⇒ 2 · rien ⇒ 0)', { pasSu, deux, rien });
    // et le suivi note ce qui lui reste
    const f2 = faireFond({ src, lignes: achats(trois()), connecte: '111', vinted: () => ({ status: 200, body: { user: { id: 111 } } }) });
    f2.store.vrmLectures = { '111': Array.from({ length: 20 }, (_, i) => Date.now() - 60000 * (i + 1)) };
    await f2.ctx.capterSuivisAchats('111');
    const d = (((f2.store.vrmLecturesDues || {})['111']) || {}).suivi;
    dit(!!d && Number(d.reste) === 3, 'R le suivi NOTE ce qui lui reste à lire (3 achats expédiés sans n°, budget plein)', d);
  });
  await essai('O', async () => {
    const i = SRC.indexOf('await capterRetraits(uid);\n    // 5.204') >= 0 ? SRC.indexOf('await capterRetraits(uid);\n    // 5.204') : SRC.lastIndexOf('await capterRetraits(uid);');
    const bloc = SRC.slice(i, SRC.indexOf('planifierImport();', i));
    const s = bloc.indexOf('await capterSuivisAchats(uid);'), v = bloc.indexOf('await capterDatesVersement(uid);'), r = bloc.indexOf('await capterReleves(uid);');
    dit(i >= 0 && s > 0 && v > 0 && r > 0 && s < v && s < r, 'O la visite lit le suivi juste après les codes, avant les versements et les relevés', { s, v, r });
  });
  await essai('V', async () => {
    const lignes = achats(trois());
    const f = faireFond({ src, lignes, connecte: '111', vinted: repondre });
    f.store.vrmLecturesDues = { '111': { versement: { reste: 0, at: Date.now() } } };
    await f.ctx.tickVersements();
    dit(lusJourney(f).length >= 1, 'V le passage de fond (onglet vinted.fr ouvert) lit le suivi des achats expédiés sans n°', lusJourney(f));
  });
  await essai('D', async () => {
    const f = faireFond({ src, lignes: {}, connecte: '111' });
    if (typeof f.ctx.diagNavAjoute !== 'function') { dit(false, 'D `diagNavAjoute` existe'); return; }
    let e = f.ctx.diagNavAjoute(null, 'suivi_lu_colis', '2026-11-19');
    e = f.ctx.diagNavAjoute(e, 'suivi_lu_colis', '2026-11-19');
    e = f.ctx.diagNavAjoute(e, 'lecture_prudence_suivi', '2026-11-20');
    dit(e.auj.jour === '2026-11-20' && e.auj.n.lecture_prudence_suivi === 1 && e.hier && e.hier.n.suivi_lu_colis === 2, 'D le diagnostic des lectures est compté par jour dans CE navigateur (aujourd’hui + hier)', e);
    dit(/DIAG_NAV\]\s*\?\s*\{\s*diag:/.test(SRC) && /RE_DIAG_NAV\.test/.test(SRC), 'D il est publié dans la ligne du navigateur (`ext_appareil_{id}`)');
  });
  return ko;
}

(async () => {
  const src = cheminSource();
  if (process.argv.includes('--prouve')) {
    process.env.MUET = '1';
    const temoin = await juger(src);
    console.log(temoin ? `❌ témoin rouge (${temoin})` : `✅ témoin vert (${ok})`);
    const S = fs.readFileSync(src, 'utf8');
    const mutations = [
      ['la lecture de colis reprend la classe « suivi »', (s) => s.split("gardeLecture(uid, acc, colis ? 'suivicolis' : 'suivi')").join("gardeLecture(uid, acc, 'suivi')")],
      ['le suivi n’est plus un lecteur prioritaire', (s) => s.replace(', suivi: SUIVI_MAX_PAR_VISITE });', ' });')],
      ['« en tête » ignoré', (s) => s.replace('if (tete && tete.has(String(o.transaction_id)) && sansNumero && achatExpedie(o)) return -1;', '')],
      ['le délai de 3 h garde l’achat passé à « expédié »', (s) => s.replace('return tete.has(tx) && Number(aFaire[tx]) > Number(memo[tx]) && Number(memo[tx]) <= Date.now();', 'return false;')],
      ['la capture ne note plus le passage à « expédié »', (s) => s.replace('if (exp && e[tx] !== 1 && !a[tx]) { a[tx] = t; n++; }', '')],
      ['le suivi ne note plus ce qui lui reste', (s) => s.replace("await noterLecturesDues(uid, 'suivi', dusColis());", '')],
      ['la visite lit le suivi après les relevés', (s) => s.replace('    await capterSuivisAchats(uid);\n    // 5.204', '    // 5.204').replace('    await envoyerNotifsSuivi();', '    await capterSuivisAchats(uid);\n    await envoyerNotifsSuivi();')],
      ['le passage de fond ne lit plus le suivi', (s) => s.replace('if (!suSansReste || Object.keys(await suiviAFaire(uid)).length) await capterSuivisAchats(uid);', '')],
      ['le diagnostic n’est plus publié par navigateur', (s) => s.replace("...(local[DIAG_NAV] ? { diag: local[DIAG_NAV] } : {})", '')],
    ];
    let rate = 0;
    for (const [nom, f] of mutations) {
      const m = f(S);
      if (m === S) { console.log(`❌ mutation « ${nom} » : ne s'applique pas`); rate++; continue; }
      const p = path.join(os.tmpdir(), `bg-mut-${process.pid}-${Math.random().toString(36).slice(2)}.js`);
      fs.writeFileSync(p, m);
      let r; try { r = await juger(p); } finally { try { fs.unlinkSync(p); } catch (_) {} }
      console.log(r ? `✅ mutation « ${nom} » : rouge (${r})` : `❌ mutation « ${nom} » : reste verte`);
      if (!r) rate++;
    }
    process.exit(temoin || rate ? 1 : 0);
  }
  const r = await juger(src);
  console.log(r ? `\n❌ audit-suivi-colis-ext : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-suivi-colis-ext : ${ok} verts — le n° de suivi des achats expédiés est lu, dans les garde-fous`);
  process.exit(r ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
