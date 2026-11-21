// ════════════════════════════════════════════════════════════════════════════
//  « LANCER MAINTENANT » OU « PROGRAMMER À … » DANS L'ATELIER REPUBLIER (21 nov., ext. 5.422, `repubprogramme`)
//
//  On EXÉCUTE le vrai `background.js` (scripts/_fond-vm.cjs, base et Vinted inventés ; `chrome.alarms`
//  noté ; `executerCommande` noté — le chemin de « Lancer »). CLAUDE.md §3 : la republication n'est
//  permise que quand C'EST LUI qui choisit les paires, l'ordre, l'espacement ET qui lance ; jamais à
//  l'aveugle, jamais répétée.
//   P1. sans SA confirmation, hors vinted.fr, heure passée ou à moins de 2 min, au-delà de 7 jours :
//       rien n'est programmé, aucun réveil ;
//   P2. programmée : SES paires dans SON ordre, SON espacement, figés ; UN réveil `when` = SON heure,
//       jamais `periodInMinutes` ; une seule programmation à la fois par compte ;
//   P3. avant l'heure : rien ne part ;
//   P4. à l'heure : la file posée est EXACTEMENT celle de « Lancer » (mêmes paires, même ordre, même
//       espacement, même réglage photo, même lettre) et les commandes envoyées sont les MÊMES que
//       celles d'un « Lancer » (`recreerVinted`, une à la fois, dans son ordre) ;
//   P5. jamais répétée : après le départ, ni le réveil ni le filet de 30 s ne relancent, même le
//       lendemain ; aucun réveil reposé ;
//   P6. navigateur fermé à l'heure dite (réveil plus de 10 min après) : rien ne part, « pas partie »
//       (`ferme`) ; « Relancer maintenant » (SON toucher) lance la MÊME sélection ;
//   P7. sans onglet vinted.fr, onglet sur un autre compte, un atelier déjà en cours : rien ne part, dit ;
//   P8. annulée : réveil retiré, rien ne part à l'heure ;
//   P9. un réveil perdu : le filet de 30 s (`vrm-relais`) part à l'heure, une seule fois.
//  §6.1 : `--src <ancien background.js>` ⇒ rouge. `--prouve` : chaque mutation rend l'audit rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const args = process.argv.slice(2);
const iSrc = args.indexOf('--src');
const SRC0 = iSrc >= 0 ? path.resolve(args[iSrc + 1]) : path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
const MUTATIONS = {
  fenetre: ["if (maintenant - Number(p.at) > ATELIER_PROG_FENETRE_MS) return atelierProgPasPartie(progs, p, 'ferme', maintenant);", ''],
  repete: ["    p.etat = 'partie'; p.partieLe = maintenant;", "    p.partieLe = maintenant;"],
  periode: ["chrome.alarms.create(ATELIER_PROG_ALARME + uid, { when: at })", "chrome.alarms.create(ATELIER_PROG_ALARME + uid, { when: at, periodInMinutes: 1440 })"],
  onglet: ["  if (!(tabs || []).length) return { code: 'onglet' };\n", ''],
  compte: ["  if (String(uidOnglet || '') !== uid) return { code: 'compte' };\n", ''],
  confirme: ["if (msg.confirme !== true) return { ok: false, code: 'confirmation', raison: 'Rien n’est programmé sans ta confirmation.' };", ''],
  une: ["if (cur && cur.etat === 'attente') return { ok: false, code: 'deja',", "if (false) return { ok: false, code: 'deja',"],
  annuler: ["    delete progs[String(uid)];\n    if (!(await atelierProgsEcrire(progs))) return { ok: false, code: 'stockage', raison: RAISON_STOCKAGE };\n    if (p.etat === 'attente') logActivity", "    if (p.etat === 'attente') logActivity"],
  ordre: ["const a = Object.assign({ v: 1, uid: String(uid), ids: prep.ids.slice(),", "const a = Object.assign({ v: 1, uid: String(uid), ids: prep.ids.slice().reverse(),"],
  avant: ["if (maintenant < Number(p.at)) { atelierProgAlarme(String(uid), Number(p.at)); return { etat: 'attente' }; }", ''],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 180000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  process.exit(rates ? 1 : 0);
}
let SRC = SRC0;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) { const [a, b] = MUTATIONS[mut]; const s = fs.readFileSync(SRC0, 'utf8'); if (!s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); } SRC = path.join(os.tmpdir(), `bg-repub-prog-${mut}-${process.pid}.js`); fs.writeFileSync(SRC, s.split(a).join(b)); }
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 500) : ''}`); } };
const UID = '111';
const IDS = ['5000000001', '5000000002', '5000000003'];
const vinted = { tab: { id: 7, url: 'https://www.vinted.fr/member/111' } };
const ESP = { mode: 'aleatoire', min: 4, max: 8 };
const PHOTO = { rot: 2, bright: 1.1, contrast: 1, sat: 1, zoom: 1 };
function monter({ onglets } = {}) {
  const f = faireFond({ src: SRC, connecte: UID, lignes: {}, ...(onglets ? { onglets } : {}) });
  const reveils = [], retires = [];
  f.ctx.chrome.alarms = { create: (n, o) => { reveils.push({ n, o: JSON.parse(JSON.stringify(o || {})) }); }, clear: async (n) => { retires.push(n); return true; }, onAlarm: { addListener() {} } };
  const cmds = [];
  f.ctx.executerCommande = async (m) => { cmds.push(JSON.parse(JSON.stringify(m))); return { accepte: true, etape: 'fait', nouvelId: 'n' + m.id }; };
  f.ctx.lireMain = async () => ({ vinted_annonce_numeros: {}, vinted_buyprice_by_num: {} });
  return { f, reveils, retires, cmds };
}
const lireStore = (f, k) => JSON.parse(JSON.stringify(f.store[k] === undefined ? null : f.store[k]));
const sansDates = (a) => { const x = JSON.parse(JSON.stringify(a || {})); for (const k of ['prochain', 'lanceLe', 'programme', 'paires']) delete x[k]; return x; };
// Déroule l'atelier jusqu'au bout (l'espacement est sauté : `prochain` remis à 0 à chaque tour).
async function derouler(m) {
  for (let i = 0; i < 10; i++) {
    const a = m.f.store.vrmAtelierRepub; if (!a || a.etat !== 'cours') break;
    a.prochain = 0;
    await m.f.ctx.atelierRepubTick(Date.now());
  }
}
(async () => {
  {
    const t = monter();
    if (typeof t.f.ctx.atelierProgrammer !== 'function' || typeof t.f.ctx.atelierProgDepart !== 'function') { dit(false, 'atelierProgrammer / atelierProgDepart existent'); console.log(`\n❌ audit-repub-programmee : ${ok} vert(s), ${ko + 1} rouge(s)`); process.exit(1); }
  }
  const prog = (m, at, extra = {}) => m.f.ctx.atelierProgrammer(Object.assign({ ids: IDS.slice(), espacement: ESP, photo: PHOTO, lettre: true, at, confirme: true }, extra), vinted);

  console.log('\nP1. Rien sans SA confirmation, hors vinted.fr, ni à une heure impossible');
  {
    const m = monter(); const at = Date.now() + 3600e3;
    const r0 = await prog(m, at, { confirme: false });
    const r1 = await m.f.ctx.atelierProgrammer({ ids: IDS, espacement: ESP, at, confirme: true }, { tab: { id: 8, url: 'https://www.leboncoin.fr/' } });
    const r2 = await prog(m, Date.now() + 30e3);
    const r3 = await prog(m, Date.now() - 60e3);
    const r4 = await prog(m, Date.now() + 8 * 864e5);
    dit(![r0, r1, r2, r3, r4].some((r) => r && r.ok) && !m.reveils.length && !lireStore(m.f, 'vrmAtelierProg'), 'sans confirmation, hors vinted.fr, dans 30 s, passée, dans 8 jours : rien n’est programmé, aucun réveil', JSON.stringify([r0, r1, r2, r3, r4].map((r) => r && r.code)));
  }

  console.log('\nP2. Programmée : SA sélection figée, UN réveil à SON heure, une par compte');
  const AT = Math.ceil((Date.now() + 2 * 3600e3) / 60000) * 60000;
  const m = monter();
  {
    const r = await prog(m, AT);
    const p = (lireStore(m.f, 'vrmAtelierProg') || { progs: {} }).progs[UID];
    dit(r && r.ok && p && p.etat === 'attente' && p.at === AT && JSON.stringify(p.ids) === JSON.stringify(IDS) && p.espacement.mode === 'aleatoire' && p.espacement.min === 4 && p.espacement.max === 8 && p.lettre === true, 'ses paires dans SON ordre, son espacement 4–8 min, sa lettre : figés', JSON.stringify(p));
    dit(m.reveils.length === 1 && m.reveils[0].n === 'vrm-atelier-prog:' + UID && m.reveils[0].o.when === AT && m.reveils[0].o.periodInMinutes === undefined && m.reveils[0].o.delayInMinutes === undefined, 'UN réveil `when` = son heure, sans `periodInMinutes`', JSON.stringify(m.reveils));
    const r2 = await prog(m, AT + 3600e3);
    dit(r2 && !r2.ok && r2.code === 'deja' && m.reveils.length === 1, 'une seconde programmation sur le même compte : refusée, dite', JSON.stringify(r2));
  }

  console.log('\nP3. Avant l’heure : rien ne part');
  {
    const r = await m.f.ctx.atelierProgDepart(UID, AT - 1000);
    dit(r && r.etat === 'attente' && !m.f.store.vrmAtelierRepub && !m.cmds.length, 'une seconde avant : aucune file, aucune commande', JSON.stringify(r));
    await m.f.ctx.atelierProgTick(AT - 1000);
    dit(!m.f.store.vrmAtelierRepub && !m.cmds.length, 'le filet de 30 s non plus');
  }

  console.log('\nP4. À l’heure : EXACTEMENT « Lancer »');
  const l = monter();
  {
    const rL = await l.f.ctx.atelierLancer({ ids: IDS.slice(), espacement: ESP, photo: PHOTO, lettre: true, confirme: true }, vinted);
    const aL = lireStore(l.f, 'vrmAtelierRepub');
    await derouler(l);
    const r = await m.f.ctx.atelierProgDepart(UID, AT + 5000);
    const aP = lireStore(m.f, 'vrmAtelierRepub');
    dit(rL && rL.ok && r && r.etat === 'partie' && aP && aP.etat === 'cours', 'la programmation part à l’heure', JSON.stringify(r));
    dit(JSON.stringify(sansDates(aP)) === JSON.stringify(sansDates(aL)), 'la file posée est celle de « Lancer » (paires, ordre, espacement, photo, lettre)', JSON.stringify([sansDates(aP), sansDates(aL)]));
    await derouler(m);
    const net = (c) => c.map((x) => { const y = Object.assign({}, x); delete y.lettre; return y; });
    dit(m.cmds.length === 3 && m.cmds.every((c) => c.cmd === 'recreerVinted' && c.confirme === true && c.uid === UID) && JSON.stringify(m.cmds.map((c) => c.id)) === JSON.stringify(IDS), 'trois `recreerVinted`, une à la fois, dans SON ordre (coffre → brouillon → suppression → mise en ligne : le chemin de « Lancer »)', JSON.stringify(m.cmds.map((c) => [c.cmd, c.id])));
    dit(JSON.stringify(net(m.cmds)) === JSON.stringify(net(l.cmds)) && m.cmds.every((c) => /^[a-z]$/.test(c.lettre || '')), 'les MÊMES commandes qu’un « Lancer » (la lettre tirée au hasard dans les deux)', JSON.stringify([net(m.cmds), net(l.cmds)]));
    dit(m.retires.includes('vrm-atelier-prog:' + UID), 'le réveil est retiré au départ');
  }

  console.log('\nP5. Jamais répétée');
  {
    const n0 = m.cmds.length, rv0 = m.reveils.length;
    const r1 = await m.f.ctx.atelierProgDepart(UID, AT + 6000);
    const r2 = await m.f.ctx.atelierProgTick(AT + 864e5);
    const r3 = await m.f.ctx.atelierProgDepart(UID, AT + 864e5 + 1000);
    const a = lireStore(m.f, 'vrmAtelierRepub');
    dit(r1.etat === 'rien' && r3.etat === 'rien' && m.cmds.length === n0 && a.etat === 'finie' && m.reveils.length === rv0, 'le réveil qui resonne, le filet du lendemain : rien ne repart, aucun réveil reposé', JSON.stringify([r1, r2, r3, a.etat, m.cmds.length - n0, m.reveils.length - rv0]));
    const src = fs.readFileSync(SRC, 'utf8');
    const bloc = src.slice(src.indexOf('const ATELIER_PROG ='), src.indexOf('// 3. TRANCHER UNE OFFRE'));
    dit(bloc.length > 1000 && !/periodInMinutes|setInterval|delayInMinutes/.test(bloc), 'aucune période, aucun intervalle dans le code de la programmation');
  }

  console.log('\nP6. Navigateur fermé à l’heure dite ⇒ rien, dit ; « Relancer maintenant »');
  {
    const n = monter(); const at = Date.now() + 3 * 3600e3;
    await prog(n, at);
    const r = await n.f.ctx.atelierProgDepart(UID, at + 30 * 60000);
    const p = lireStore(n.f, 'vrmAtelierProg').progs[UID];
    dit(r.etat === 'pas-partie' && p.etat === 'pas-partie' && p.code === 'ferme' && !n.f.store.vrmAtelierRepub && !n.cmds.length, 'réveillé 30 min après (navigateur fermé) : rien ne part, « pas partie » (fermé)', JSON.stringify([r, p.code]));
    const r0 = await n.f.ctx.atelierProgRelancer({}, vinted);
    dit(r0 && !r0.ok && !n.f.store.vrmAtelierRepub, '« Relancer » sans SON toucher confirmé : rien');
    const rr = await n.f.ctx.atelierProgRelancer({ confirme: true }, vinted);
    const a = lireStore(n.f, 'vrmAtelierRepub');
    dit(rr && rr.ok && a && a.etat === 'cours' && JSON.stringify(a.ids) === JSON.stringify(IDS) && !(lireStore(n.f, 'vrmAtelierProg').progs[UID]), '« Relancer maintenant » : la MÊME sélection part, la programmation est effacée', JSON.stringify([rr && rr.code, a && a.ids]));
  }

  console.log('\nP7. Sans onglet, autre compte, atelier en cours ⇒ rien, dit');
  {
    const n = monter(); const at = Date.now() + 3600e3;
    await prog(n, at);
    n.f.ctx.chrome.tabs.query = async () => [];
    const r = await n.f.ctx.atelierProgDepart(UID, at + 1000);
    dit(r.etat === 'pas-partie' && r.code === 'onglet' && !n.f.store.vrmAtelierRepub, 'aucun onglet vinted.fr : rien ne part (« onglet »)', JSON.stringify(r));
    const n2 = monter(); await prog(n2, at);
    n2.f.ctx.activeAccountId = async () => '999';
    const r2 = await n2.f.ctx.atelierProgDepart(UID, at + 1000);
    dit(r2.etat === 'pas-partie' && r2.code === 'compte' && !n2.f.store.vrmAtelierRepub, 'l’onglet sur un AUTRE compte : rien ne part (« compte »)', JSON.stringify(r2));
    const n3 = monter(); await prog(n3, at);
    n3.f.store.vrmAtelierRepub = { v: 1, uid: UID, ids: ['5000000009'], i: 0, etat: 'cours', espacement: { mode: 'fixe', min: 3, max: 3 }, paires: {} };
    const r3 = await n3.f.ctx.atelierProgDepart(UID, at + 1000);
    dit(r3.etat === 'pas-partie' && r3.code === 'en-cours' && JSON.stringify(n3.f.store.vrmAtelierRepub.ids) === '["5000000009"]', 'un atelier déjà en cours : rien ne part, il n’est pas remplacé', JSON.stringify(r3));
  }

  console.log('\nP8. Annulée ⇒ rien à l’heure');
  {
    const n = monter(); const at = Date.now() + 3600e3;
    await prog(n, at);
    const ra = await n.f.ctx.atelierProgAnnuler({}, vinted);
    const r = await n.f.ctx.atelierProgDepart(UID, at + 1000);
    dit(ra && ra.ok && ra.annulee === true && n.retires.includes('vrm-atelier-prog:' + UID) && r.etat === 'rien' && !n.f.store.vrmAtelierRepub && !n.cmds.length, 'annulée : réveil retiré, rien ne part à l’heure', JSON.stringify([ra, r]));
    const r2 = await prog(n, at + 600e3);
    dit(r2 && r2.ok, 'une nouvelle programmation est ensuite possible');
  }

  console.log('\nP9. Un réveil perdu : le filet de 30 s part à l’heure, une fois');
  {
    const n = monter(); const at = Date.now() + 3600e3;
    await prog(n, at);
    const r = await n.f.ctx.atelierProgTick(at + 20e3);
    const r2 = await n.f.ctx.atelierProgTick(at + 50e3);
    const a = lireStore(n.f, 'vrmAtelierRepub');
    dit(r.faits.length === 1 && r.faits[0].etat === 'partie' && r2.faits.length === 0 && a && a.etat === 'cours', 'le filet : parti une fois, pas deux', JSON.stringify([r, r2]));
  }

  console.log(`\n${ko ? '❌' : '✅'} audit-repub-programmee : ${ok} vert(s), ${ko} rouge(s)`);
  if (mut) try { fs.unlinkSync(SRC); } catch (_) {}
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ a levé : ' + (e && e.stack || e)); process.exit(1); });
