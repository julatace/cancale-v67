// Audit : REPUBLIER À SON HEURE + HISTORIQUE DES REPUBLICATIONS (11 nov., lot republier-programme).
//   · src/repubProgramme.js — la programmation (SON heure, jamais décalée ; une par compte ;
//     conditions vérifiées au départ, « pas su » ⇒ rien ne part ; départ pris par UN appareil en
//     comparer-et-échanger ; fenêtre passée ⇒ « pas partie » ; les paires programmées seulement) ;
//   · src/historiqueRepub.js — l'historique par IDENTITÉ (jamais par titre), « pas su » ≠ 0 ;
//   · l'extension 5.368 EXÉCUTÉE (scripts/_fond-vm.cjs) : `etatDepartRepub` dit l'onglet et le
//     frein, « pas su » quand le stockage ne répond pas ;
//   · les branchements (veille montée, journal écrit sur « fait » seulement, atelier).
// `--prouve` : chaque règle réaffaiblie doit faire passer l'audit au rouge.
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const SRC_P = fs.readFileSync(path.join(R, 'src', 'repubProgramme.js'), 'utf8');
const SRC_H = fs.readFileSync(path.join(R, 'src', 'historiqueRepub.js'), 'utf8');
const SRC_L = fs.readFileSync(path.join(R, 'src', 'ligneCas.js'), 'utf8');
const APP = require('./_source-app.cjs').sourceAppDe(path.join(R, 'src', 'App.jsx'));
const REP = fs.readFileSync(path.join(R, 'src', 'ecrans', 'Republier.jsx'), 'utf8');
const UI = fs.readFileSync(path.join(R, 'src', 'RepubProgramme.jsx'), 'utf8');
const BG = fs.readFileSync(path.join(R, 'vinted-sync-extension', 'background.js'), 'utf8');

const MUTATIONS = {
  heure_decalee: { p: (s) => s.replace("action, ids: liste, at: t, creeAt", "action, ids: liste, at: t + Math.floor(alea() * 600000), creeAt") },
  deux_par_compte: { p: (s) => s.replace("if (cur && cur.etat === 'attente' && cur.id !== p.id && !remplacer) return { refus: 'deja', actuelle: cur };", '') },
  onglet_pas_su_vaut_oui: { p: (s) => s.replace("if (!rp || rp.onglet == null) m.push({ cle: 'onglet-passu' });", 'if (false) {}') },
  frein_ignore: { p: (s) => s.replace("else if (rp.frein && Number(rp.frein.jusqua) > maintenant) m.push(", "else if (false) m.push(") },
  jauge_pas_sue_vaut_oui: { p: (s) => s.replace("if (jauge == null || !Number.isFinite(Number(jauge.n)) || !Number.isFinite(Number(jauge.pourApp))) m.push({ cle: 'plafond-passu' });\n  else if", "if (jauge == null) {} else if") },
  autre_compte_accepte: { p: (s) => s.replace("else if (e.present && String(e.uidOnglet || '') !== String(prog.uid)) m.push({ cle: 'compte' });", '') },
  quota_jour_ignore: { p: (s) => s.replace("else if (Number(jour) + prog.ids.length > REPUB_PAR_JOUR)", "else if (false)") },
  depart_rattrape: { p: (s) => s.replace("return maintenant - prog.at <= FENETRE_DEPART_MS ? 'heure' : 'passee';", "return 'heure';") },
  depart_deux_fois: { p: (s) => s.replace("export const prendreDepart = (data, uid, id, appareil, maintenant = Date.now()) => changer(data, uid, id, ['attente'],", "export const prendreDepart = (data, uid, id, appareil, maintenant = Date.now()) => changer(data, uid, id, ['attente', 'partie'],") },
  paire_remplacee: { p: (s) => s.replace("const partent = prog.ids.filter((id) => dispo.has(id));", "const partent = prog.ids.filter((id) => dispo.has(id)).concat([...dispo].filter((id) => !prog.ids.includes(id)));") },
  lecture_ko_ecrit: { l: (s) => s.replace("    const lu = await lireLigne(id, ctx);\n    if (!lu) return null;", "    const lu = (await lireLigne(id, ctx)) || { existe: false, data: null };") },
  cas_sans_garde: { l: (s) => s.replace("&${garde}&select=id", "&select=id") },
  histo_par_titre: { h: (s) => s.replace("  const j = journal && journal[id] && journal[id].anc; if (j) return { anc: j, src: 'journal' };", "  const j = journal && journal[id] && journal[id].anc; if (j) return { anc: j, src: 'journal' };\n  const t = d0 && d0.titres && d0.titres[id]; if (t) { const autre = Object.keys(d0.titres).find((k) => k !== id && d0.titres[k] === t); if (autre) return { anc: autre, src: 'titre' }; }").replace("function ancienneDe(id, { recrees, numeros, journal }) {", "function ancienneDe(id, d0) { const { recrees, numeros, journal } = d0;") },
  histo_pas_su_zero: { h: (s) => s.replace("let favoris = null, vues = null;", "let favoris = 0, vues = 0;") },
  histo_sans_borne: { h: (s) => s.replace("const a = ancienneDe(cur, d); if (!a || vus.has(a.anc)) break;", "const a = ancienneDe(cur, d); if (!a) break;") },
};

async function charger(srcP = SRC_P, srcH = SRC_H, srcL = SRC_L) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-'));
  fs.writeFileSync(path.join(dir, 'ligneCas.mjs'), srcL);
  fs.writeFileSync(path.join(dir, 'p.mjs'), srcP.replace("from './ligneCas.js'", "from './ligneCas.mjs'"));
  fs.writeFileSync(path.join(dir, 'h.mjs'), srcH.replace("from './ligneCas.js'", "from './ligneCas.mjs'"));
  try { return { P: await import(pathToFileURL(path.join(dir, 'p.mjs')).href), H: await import(pathToFileURL(path.join(dir, 'h.mjs')).href) }; }
  finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }
}

// Une fausse base à une ligne, gardée par `data.rev` comme PostgREST (`data->>rev=eq.N`).
function fausseBase({ lectureKO = false } = {}) {
  const lignes = {}; const j = { ecritures: 0 };
  const rep = (status, body) => ({ ok: status < 400, status, json: async () => body });
  const fetcher = async (url, o = {}) => {
    const u = new URL(url); const id = decodeURIComponent((u.searchParams.get('id') || '').replace(/^eq\./, ''));
    const m = (o.method || 'GET').toUpperCase();
    if (m === 'GET') { if (lectureKO) return rep(503, {}); return rep(200, lignes[id] ? [{ id, data: JSON.parse(JSON.stringify(lignes[id])) }] : []); }
    if (m === 'POST') { const [row] = JSON.parse(o.body); if (lignes[row.id]) return rep(409, {}); lignes[row.id] = row.data; j.ecritures++; return rep(201, null); }
    if (m === 'PATCH') {
      const g = u.searchParams.get('data->>rev'); const cur = lignes[id]; if (!cur) return rep(200, []);
      const rev = cur.rev == null ? 'is.null' : `eq.${cur.rev}`;
      if (g != null && g !== rev) return rep(200, []);
      lignes[id] = JSON.parse(o.body).data; j.ecritures++; return rep(200, [{ id }]);
    }
    return rep(405, {});
  };
  return { lignes, j, ctx: { url: 'https://base.test', entetes: () => ({}), avecOwner: (x) => x, owner: 'o1', cloisonne: false, fetcher } };
}

async function verifier(mods = {}) {
  const sP = mods.p ? mods.p(SRC_P) : SRC_P, sH = mods.h ? mods.h(SRC_H) : SRC_H, sL = mods.l ? mods.l(SRC_L) : SRC_L;
  const { P, H } = await charger(sP, sH, sL);
  const res = [];
  const dit = (ok, quoi) => res.push({ ok: !!ok, quoi });
  const T0 = Date.UTC(2026, 10, 12, 17, 0, 0);
  const NOW = T0 - 3 * 3600e3;
  const ids = ['9001', '9002', '9003'];
  // ── P1 programmation
  const c = P.creerProgramme({ uid: '111', compte: 'shop', action: 'recreer', ids, at: T0, reglages: { regs: { prix: { base: 'pct' } }, plan: { 9002: 75 } }, maintenant: NOW });
  dit(c.ok && c.prog.at === T0, 'P1 l’heure programmée est SON heure, au milliseconde près (jamais tirée ni décalée)');
  dit(c.ok && c.prog.ids.join() === ids.join() && c.prog.reglages.plan['9002'] === 75 && c.prog.reglages.regs.prix.base === 'pct', 'P1 SES paires, dans SON ordre, et SES réglages figés tels quels');
  dit(!P.creerProgramme({ uid: '111', action: 'recreer', ids, at: NOW + 60000, reglages: {}, maintenant: NOW }).ok, 'P1 une heure dans moins de 2 min est refusée');
  dit(!P.creerProgramme({ uid: '111', action: 'recreer', ids, at: NOW + 8 * 86400e3, reglages: {}, maintenant: NOW }).ok, 'P1 plus de 7 jours à l’avance est refusé');
  dit(!P.creerProgramme({ uid: '111', action: 'recreer', ids: [], at: T0, reglages: {}, maintenant: NOW }).ok, 'P1 aucune paire ⇒ rien de programmé');
  // ── P2 une par compte
  const d1 = P.poserProgramme(null, c.prog).data;
  const c2 = P.creerProgramme({ uid: '111', action: 'recreer', ids: ['9004'], at: T0 + 3600e3, reglages: {}, maintenant: NOW, id: 'autre' });
  const r2 = P.poserProgramme(d1, c2.prog);
  dit(r2.refus === 'deja', 'P2 une seconde programmation en attente sur le MÊME compte est refusée (« Remplacer ? »)');
  const r3 = P.poserProgramme(d1, c2.prog, { remplacer: true });
  dit(r3.data && P.programmesDe(r3.data)['111'].id === 'autre', 'P2 « Remplacer » : la nouvelle prend la place, l’ancienne ne partira pas');
  const c3 = P.creerProgramme({ uid: '222', action: 'recreer', ids: ['8001'], at: T0, reglages: {}, maintenant: NOW });
  dit(P.poserProgramme(d1, c3.prog).data && Object.keys(P.programmesDe(P.poserProgramme(d1, c3.prog).data)).length === 2, 'P2 un autre compte a la sienne');
  // ── P3 conditions
  const bon = { present: true, capOk: true, uidOnglet: '111', repub: { onglet: true, frein: null } };
  const J = { n: 10, pourApp: 45 };
  const cond = (o) => P.conditionsDepart({ prog: c.prog, ext: bon, jauge: J, jour: 5, occupe: false, maintenant: T0, ...o });
  dit(cond({}).ok, 'P3 tout est là ⇒ le départ est permis');
  const cas = [
    ['extension absente', { ext: { present: false } }, 'extension'],
    ['extension pas à jour', { ext: { ...bon, capOk: false } }, 'version'],
    ['aucun onglet vinted.fr', { ext: { ...bon, repub: { onglet: false, frein: null } } }, 'onglet'],
    ['onglet PAS SU', { ext: { ...bon, repub: { onglet: null, frein: null } } }, 'onglet-passu'],
    ['onglet sur un autre compte', { ext: { ...bon, uidOnglet: '999' } }, 'compte'],
    ['compte de l’onglet PAS SU', { ext: { ...bon, uidOnglet: undefined } }, 'compte-passu'],
    ['frein de Vinted en cours', { ext: { ...bon, repub: { onglet: true, frein: { jusqua: T0 + 600000, restreint: false } } } }, 'frein'],
    ['frein PAS SU', { ext: { ...bon, repub: { onglet: true, frein: undefined } } }, 'frein-passu'],
    ['jauge PAS LUE', { jauge: null }, 'plafond-passu'],
    ['plafond de l’heure plein', { jauge: { n: 43, pourApp: 45 } }, 'plafond'],
    ['republications du jour PAS COMPTÉES', { jour: null }, 'jour-passu'],
    ['quota du jour dépassé', { jour: 48 }, 'jour'],
    ['un autre travail tourne', { occupe: true }, 'occupe'],
  ];
  for (const [nom, o, cle] of cas) { const r = cond(o); dit(!r.ok && r.manques.some((m) => m.cle === cle), `P3 ${nom} ⇒ RIEN ne part (${cle})`); }
  dit(cond({ ext: { ...bon, repub: { onglet: true, frein: { jusqua: T0 - 1000 } } } }).ok, 'P3 un frein terminé ne bloque plus');
  // ── P4 moment et appareil
  dit(P.decision(c.prog, { ext: bon, maintenant: T0 - 60000 }).quoi === 'attendre', 'P4 avant l’heure : on attend');
  dit(P.decision(c.prog, { ext: bon, maintenant: T0 + 1000 }).quoi === 'verifier', 'P4 à l’heure, sur le bon appareil : vérification');
  dit(P.decision(c.prog, { ext: { present: false }, maintenant: T0 + 60000 }).quoi === 'attendre', 'P4 un appareil sans extension n’ouvre ni ne déclare rien pendant la fenêtre');
  dit(P.decision(c.prog, { ext: bon, maintenant: T0 + 11 * 60000 }).quoi === 'manquee', 'P4 fenêtre passée (10 min) ⇒ « pas partie », jamais un départ en retard');
  dit(P.decision({ ...c.prog, etat: 'annulee' }, { ext: bon, maintenant: T0 + 1000 }).quoi === 'rien', 'P4 annulée ⇒ rien');
  // ── P5 départ pris une fois (CAS)
  const B = fausseBase();
  await P.modifierProgrammes((d) => P.poserProgramme(d, c.prog), B.ctx);
  const [a, b] = await Promise.all([
    P.modifierProgrammes((d) => P.prendreDepart(d, '111', c.prog.id, 'A', T0), B.ctx),
    P.modifierProgrammes((d) => P.prendreDepart(d, '111', c.prog.id, 'B', T0), B.ctx),
  ]);
  const gagnants = [a, b].filter((x) => x && x.ok && x.progs['111'].appareil === (x === a ? 'A' : 'B')).length;
  dit(gagnants === 1 && ['A', 'B'].includes(B.lignes.vrm_repub_programme.programmes['111'].appareil), 'P5 deux Chrome à l’heure : UN SEUL prend le départ (comparer-et-échanger sur data.rev)');
  const an = await P.modifierProgrammes((d) => P.annulerProgramme(d, '111', c.prog.id), B.ctx);
  dit(an && !an.ok && P.programmesDe(B.lignes.vrm_repub_programme)['111'].etat === 'partie', 'P5 une programmation partie ne s’annule plus');
  const K = fausseBase({ lectureKO: true });
  const rk = await P.modifierProgrammes((d) => P.poserProgramme(d, c.prog), K.ctx);
  dit(rk === null && K.j.ecritures === 0, 'P5 lecture ratée ⇒ RIEN n’est écrit (et « pas su » rendu)');
  // ── P6 les paires au départ
  const pd = P.pairesAuDepart(c.prog, [{ id: '9003' }, { id: '9001' }, { id: '7777' }]);
  dit(pd.partent.join() === '9001,9003' && pd.absentes.join() === '9002', 'P6 seules les paires programmées encore en ligne partent, dans SON ordre ; aucune autre ne les remplace');
  const pp = P.marquerPasPartie(d1, '111', c.prog.id, [{ cle: 'onglet' }], T0);
  dit(P.programmesDe(pp)['111'].etat === 'pas-partie' && P.programmesDe(pp)['111'].raisons[0].cle === 'onglet', 'P6 « pas partie » garde la raison (dite sur la carte et la notification)');

  // ── H historique
  const d = { recrees: { C: '', 5003: '5002', 5002: '5001' }, numeros: {}, journal: H.entreesDe({ e: { 5002: ['5001', T0 - 30 * 86400e3, 2, 40], 5003: ['5002', T0 - 12 * 86400e3, 5, 80] } }), stats: { 5003: { favoris: 4, vues: 33 } }, vendues: new Set() };
  const h = H.historiqueAnnonce('5003', d);
  dit(h && h.n === 2 && h.liste[0].nouvelId === '5003' && h.liste[1].nouvelId === '5002', 'H1 la chaîne se remonte par identifiant (5003 ← 5002 ← 5001) : republiée 2 fois');
  dit(h && h.liste[0].resultat.favoris === 4 && h.liste[1].resultat.favoris === 5 && h.liste[1].resultat.vues === 80, 'H1 ce que chacune a donné : l’annonce en ligne (lu aujourd’hui), la précédente (lu quand elle a été remplacée)');
  const r = H.resumeHistorique(h, T0);
  dit(r && r.n === 2 && r.jours === 12 && r.favoris === 4, 'H1 « republiée 2 fois · dernière il y a 12 j · +4 favoris »');
  const memes = {}; const titres = {}; for (let i = 0; i < 50; i++) { titres[String(6000 + i)] = 'Nike Air Force 1 blanche 42'; }
  const h50 = Object.keys(titres).map((id) => H.historiqueAnnonce(id, { recrees: {}, numeros: memes, journal: {}, stats: {}, vendues: null, titres }));
  dit(h50.every((x) => x && x.n === 0), 'H2 50 annonces au MÊME titre, aucun lien : aucune n’est « republiée » (jamais par titre)');
  const hp = H.historiqueAnnonce('5003', { recrees: { 5003: '5002' }, numeros: {}, journal: {}, stats: {}, vendues: null });
  dit(hp && hp.n === 1 && hp.liste[0].at === null && hp.liste[0].resultat.favoris === null && hp.liste[0].resultat.vendue === null, 'H3 sans journal ni compteur lu : date, favoris et vente « pas su » (null), jamais 0');
  const h2 = H.historiqueAnnonce('5003', { recrees: { 5003: '5002', 5002: '5001' }, numeros: {}, journal: {}, stats: {}, vendues: null });
  dit(h2 && h2.n === 2 && h2.liste[1].resultat.favoris === null && h2.liste[1].resultat.vues === null, 'H3 une republication d’avant le journal : ses favoris / vues « pas su », jamais 0');
  const hb = H.historiqueAnnonce('5003', { recrees: { 5003: '5002', 5002: '5003' }, numeros: {}, journal: {}, stats: {} });
  dit(hb && hb.n === 1, 'H4 une boucle de liens s’arrête (pas de chaîne infinie)');
  const hv = H.historiqueAnnonce('5003', { ...d, vendues: new Set(['5002']) });
  dit(hv.liste[1].resultat.vendue === true && hv.liste[0].resultat.vendue === false, 'H5 « vendue » = une vente prouvée portant CET identifiant');
  const n1 = H.noterRepublication(null, { ancienId: '5001', nouvelId: '5002', at: T0, favoris: 3, vues: 9 });
  dit(n1 && H.noterRepublication(n1, { ancienId: '5001', nouvelId: '5002', at: T0 + 5 }) === undefined, 'H6 une republication n’est notée qu’une fois');
  dit(H.noterRepublication(null, { ancienId: 'titre', nouvelId: '5002' }) === undefined, 'H6 une identité illisible n’est jamais notée');

  // ── E l'extension EXÉCUTÉE
  const { faireFond, cheminSource } = require('./_fond-vm.cjs');
  const src = mods.bg ? (() => { const f = path.join(os.tmpdir(), `bg-rp-${process.pid}.js`); fs.writeFileSync(f, mods.bg(BG)); return f; })() : cheminSource();
  const f1 = faireFond({ src, store: { vrmFreinRepub: { 111: { jusqua: Date.now() + 600000, restreint: true } } } });
  const e1 = typeof f1.ctx.etatDepartRepub === 'function' ? await f1.ctx.etatDepartRepub('111') : null;
  dit(e1 && e1.onglet === true && e1.frein && e1.frein.restreint === true, 'E1 l’extension dit l’onglet vinted.fr ouvert et le frein du compte');
  const f2 = faireFond({ src, onglets: [] });
  const e2 = typeof f2.ctx.etatDepartRepub === 'function' ? await f2.ctx.etatDepartRepub('111') : null;
  dit(e2 && e2.onglet === false && e2.frein === null, 'E2 aucun onglet ⇒ onglet: false ; aucun frein ⇒ null');
  const f3 = faireFond({ src });
  f3.ctx.chrome.storage.local.get = () => Promise.reject(new Error('muet'));
  const e3 = typeof f3.ctx.etatDepartRepub === 'function' ? await f3.ctx.etatDepartRepub('111') : null;
  dit(e3 && e3.frein === undefined, 'E3 stockage muet ⇒ frein « pas su » (undefined), jamais « aucun frein »');
  const etat = typeof f1.ctx.etatPourApp === 'function' ? await f1.ctx.etatPourApp().catch(() => null) : null;
  dit(etat && etat.repub && etat.repub.onglet === true && etat.repub.frein && etat.repub.frein.restreint === true, 'E4 l’état rendu à l’app porte `repub` (onglet, frein)');
  dit(!(f1.j.vinted || []).length && !(f2.j.vinted || []).length, 'E5 rien n’est envoyé à Vinted pour le dire (lecture seule)');

  // ── B branchements
  const sans = (s) => s.replace(/\/\/[^\n]*/g, '');
  dit(/<ProgrammeRepubVeille\s*\/>/.test(APP), 'B1 la veille du départ est montée dans la coque');
  dit(/reporterNumero\(a\.id, String\(r\.nouvelId\)\); noterRepubJournal\(a, r\.nouvelId/.test(sans(APP)) && !/noterRepubJournal\(a, [^)]*\)[^\n]*etape==='incertain'/.test(APP), 'B2 le journal n’est écrit que sur « fait » / « double » rendu par l’extension');
  dit(/pairesAuDepart\(programme, aFaireCalc\)/.test(REP) && /noterPasPartie\(programme, \[\{ cle: 'vide' \}\]\)/.test(REP), 'B3 l’atelier part avec les paires programmées seulement, et dit « pas partie » s’il n’en reste aucune');
  dit(/prendreDepart\(dd, p\.uid, p\.id, appareilId\)/.test(UI) && /pr\.appareil !== appareilId/.test(UI), 'B4 la veille n’ouvre l’atelier que si SON écriture a pris le départ');
  dit(/conditionsDepart\(\{ prog: p, ext: extPourDepart\(\), jauge, jour, occupe \}\)/.test(UI) && /if \(!c\.ok\) \{ await noterPasPartie\(p, c\.manques\); return; \}/.test(UI), 'B5 conditions vérifiées AU DÉPART ; une manque ⇒ « pas partie » + notification, rien ne part');
  dit(/repubdepart: '5\.368\.0'/.test(APP), 'B6 la capacité `repubdepart` est déclarée (5.368.0)');
  return res;
}

(async () => {
  const prouve = process.argv.includes('--prouve');
  const res = await verifier();
  let rouges = 0;
  for (const x of res) { console.log(`${x.ok ? '✅' : '❌'} ${x.quoi}`); if (!x.ok) rouges++; }
  if (prouve) {
    // E-mutation : l'extension qui rend « aucun frein » quand le stockage ne répond pas.
    MUTATIONS.ext_passu_aucun = { bg: (s) => s.replace("return f && Number(f.jusqua) > Date.now() ? { jusqua: Number(f.jusqua) || 0, restreint: !!f.restreint } : null; } catch (_) { return undefined; }", "return f && Number(f.jusqua) > Date.now() ? { jusqua: Number(f.jusqua) || 0, restreint: !!f.restreint } : null; } catch (_) { return null; }") };
    let tues = 0; const total = Object.keys(MUTATIONS).length;
    for (const [nom, m] of Object.entries(MUTATIONS)) {
      const avant = { p: m.p ? m.p(SRC_P) : SRC_P, h: m.h ? m.h(SRC_H) : SRC_H, l: m.l ? m.l(SRC_L) : SRC_L, bg: m.bg ? m.bg(BG) : BG };
      if (avant.p === SRC_P && avant.h === SRC_H && avant.l === SRC_L && avant.bg === BG) { console.log(`❌ mutation ${nom} : le motif n'a rien remplacé`); rouges++; continue; }
      const r = await verifier(m).catch((e) => [{ ok: false, quoi: String(e) }]);
      const rouge = r.filter((x) => !x.ok);
      if (rouge.length) { tues++; console.log(`✅ mutation ${nom} ⇒ rouge (${rouge[0].quoi})`); } else { console.log(`❌ mutation ${nom} ⇒ toujours vert`); rouges++; }
    }
    console.log(`\n${tues}/${total} mutations rouges`);
  }
  console.log(`\n${rouges ? '❌' : '✅'} audit-republier-programme : ${res.filter((x) => x.ok).length} verts, ${rouges} rouge(s)`);
  process.exit(rouges ? 1 : 0);
})();
