#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « MODE ORDINATEUR ALLUMÉ » (28 nov., ext. 5.457.0, capacité `serveur`)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « je laisse un ordinateur allumé toute la journée, comme un serveur […] une notification dès qu'il y a
// vraiment un nouveau message, avec la vraie question et le nom du compte, et agir sur les différents comptes. »
// On EXÉCUTE le VRAI `background.js` (scripts/_fond-vm.cjs : base à état, faux Vinted qui compte chaque requête, faux
// vrm.center : `/api/push` action `serveur` noté, action `tour` jugé par la VRAIE règle `srvTour` sur une ligne partagée,
// comparer-et-échanger). DEUX PROFILS = deux `background.js` indépendants (chacun son stockage, SON compte Vinted), qui
// partagent la base du vendeur et le serveur — comme deux profils Chrome sur le même ordinateur. Tout est inventé.
//   S0  la règle (pure, src/ordinateurServeur.js) et sa copie dans background.js (bloc <serveur-regle> identique)
//   S1  éteint par défaut : AUCUNE requête Vinted de la veille, aucun appel
//   S2  la 1re lecture de la boîte (l'historique) ⇒ AUCUNE notification (point de départ)
//   S3  un message NEUF ⇒ exactement UN appel `serveur`, des identités seulement (compte, conversation, n° du message),
//       le fil RANGÉ dans la base AVANT l'appel ; la lecture est comptée sur le budget de LECTURE du compte
//   S4  le même message revu ⇒ aucun appel ; un message de MOI ⇒ aucun appel
//   S5  l'intervalle suivant est tiré au hasard dans [4 ; 7] min, jamais deux fois le même ; pas avant l'heure ⇒ rien
//   S6  un 429 de Vinted ⇒ la pause est posée, la lecture suivante ne part pas ; captcha, prudence ⇒ rien ne part
//   S7  le budget de lecture plein (14 des 20/h) ⇒ la veille ne lit pas
//   S8  déconnecté (le cookie ne donne plus de compte) ⇒ UN appel « deconnecte » avec le compte, pas deux
//   S9  l'onglet épinglé : aucun onglet vinted.fr ⇒ un onglet épinglé rouvert, en arrière-plan
//   S10 DEUX PROFILS : deux commandes « À distance » (une par compte) ⇒ jamais deux écritures au même moment (le tour),
//       chacune faite UNE fois, par LE profil de SON compte
//   S11 une commande pour le compte A n'est JAMAIS exécutée par le profil du compte B
//   S12 `compterAction` : un autre profil a le tour ⇒ code `tour`, rien compté ; tour pas su ⇒ rien ne part
//   S13 la présence publie `serveur` (compte, dernière lecture, prochaine, actions/h, plafond) — ce que lit la page
//   S14 les messages Vinted de la voie « capte » se taisent quand la veille est allumée (pas deux notifications)
// `--prouve` : chaque mutation rend l'audit rouge. `--src <background.js d'avant>` : rouge (§6.1).
// `--recopie` : recopie le bloc <serveur-regle> de src/ordinateurServeur.js dans background.js.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const args = process.argv.slice(2);
const RACINE = path.join(__dirname, '..');
const BG = path.join(RACINE, 'vinted-sync-extension', 'background.js');
const REGLE = path.join(RACINE, 'src', 'ordinateurServeur.js');
const BLOC_RE = /\/\/ <serveur-regle>[^\n]*\n([\s\S]*?)\/\/ <\/serveur-regle>/;
if (args.includes('--recopie')) {
  const m = BLOC_RE.exec(fs.readFileSync(REGLE, 'utf8'));
  const bg = fs.readFileSync(BG, 'utf8');
  fs.writeFileSync(BG, bg.replace(BLOC_RE, () => '// <serveur-regle> — COPIE de src/ordinateurServeur.js (scripts/audit-ordinateur-serveur.cjs --recopie). Ne pas modifier ici.\n' + m[1] + '// </serveur-regle>'));
  console.log('bloc <serveur-regle> recopié dans background.js');
  process.exit(0);
}
const iSrc = args.indexOf('--src');
const SRC0 = iSrc >= 0 ? path.resolve(args[iSrc + 1]) : BG;
const MUTATIONS = {
  premiere: ["  if (!b) return { base: { depuis: Number(maintenant) || 0, convs }, changees: [], premiere: true };", "  if (!b) return { base: { depuis: 1, convs }, changees: l.filter((c) => c.unread === true).map((c) => String(c.id)), premiere: true };"],
  vus: ['    if (!e || v[srvCle(e)]) continue;', '    if (!e) continue;'],
  demoi: ["    if (!de || de === moi || (opp && de !== opp)) continue;", "    if (!de) continue;"],
  hasard: ['  const ecart = srvIntervalle(Math.random(), Number(etat.precedent) || 0);', '  const ecart = SRV_INTERVALLE_MIN_MS;'],
  prudence: ["  if (await prudenceDe(u)) { await serveurNoterEtat({ code: 'prudence' }); await publierPresence(moi, false).catch(() => {}); return { saute: 'prudence' }; }", ''],
  pause: ["  if (p) { await serveurNoterEtat({ code: 'pause', jusqua: Number(p.jusqua) || 0 }); await publierPresence(moi, false).catch(() => {}); return { saute: 'pause' }; }", ''],
  captcha: ["  if (ar && ar.quoi === 'captcha') { await serveurNoterEtat({ code: 'captcha' }); await publierPresence(moi, false).catch(() => {}); return { saute: 'captcha' }; }", ''],
  budget: ['  const L = await compterLecture(u, SRV_PLAFOND_LECTURES);\n  if (!L || !L.ok)', '  const L = { ok: true };\n  if (!L || !L.ok)'],
  range: ["    if (!range) { delete bases[u].convs[conv]; noterDiag('serveur_fil_pas_range'); continue; }", ''],
  deco: ['        if (r && (r.etat === \'envoye\' || r.etat === \'refuse\')) d.signale = true;', ''],
  tourdist: ["  if (tourPris && tourPris.refus) {", "  if (false) {"],
  tourcompter: ["  return tourAvantEcriture(String(uid), 'action').then((tr) => (tr && tr.refus", "  return Promise.resolve(null).then((tr) => (tr && tr.refus"],
  tourpassu: ["  noterDiag('serveur_tour_passu_' + (rep.status || 'reseau'));\n  return { refus: 'passu', resteMs: 60000 };", "  return null;"],
  onglet: ["    try { t = await chrome.tabs.create({ url: 'https://www.vinted.fr/inbox', pinned: true, active: false });", "    try { t = null; if (t) await chrome.tabs.create({ url: 'https://www.vinted.fr/inbox', pinned: true, active: false });"],
  capte: ["    if (s === 'message' && plateforme === 'vinted' && await serveurAllume()) return { etat: 'serveur' };", ''],
  identites: ["  const rep = await serveurPoster({ action: 'serveur', evenements: lot.map((x) => x.e) });", "  const rep = await serveurPoster({ action: 'serveur', evenements: lot.map((x) => Object.assign({ texte: 'x' }, x.e)) });"],
  decale: ["    if (autre) { await serveurNoterEtat({ prochain: t + 20000", "    if (false) { await serveurNoterEtat({ prochain: t + 20000"],
  presence: ["rt: _distCanal.etat, lus: local[COMPTES_VUS_STORE] || {}, serveur };", "rt: _distCanal.etat, lus: local[COMPTES_VUS_STORE] || {} };"],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 240000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  process.exit(rates ? 1 : 0);
}
let SRC = SRC0;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const [a, b] = MUTATIONS[mut]; const s = fs.readFileSync(SRC0, 'utf8');
  if (!s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); }
  SRC = path.join(os.tmpdir(), `bg-serveur-${mut}-${process.pid}.js`); fs.writeFileSync(SRC, s.split(a).join(b));
}
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 600) : ''}`); } };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const MOI = '0b0b0b0b-0000-4000-8000-00000000000a';
const A = '111', B = '222';
const H = 3600000;

(async () => {
  const regle = await import('file://' + REGLE);
  const { srvIntervalle, srvChangees, srvNeufsDuFil, srvTexte, srvTour, srvLigne, SRV_INTERVALLE_MIN_MS, SRV_INTERVALLE_MAX_MS } = regle;

  console.log('\nS0. La règle, et sa copie dans l’extension');
  { const vs = []; let p = 0; for (let i = 0; i < 400; i++) { const v = srvIntervalle(Math.random(), p); vs.push([v, p]); p = v; }
    dit(vs.every(([v]) => v >= SRV_INTERVALLE_MIN_MS && v <= SRV_INTERVALLE_MAX_MS) && vs.every(([v, q]) => !q || Math.abs(v - q) >= 7000), 'S0a l’intervalle reste dans [4 ; 7] min et deux de suite diffèrent d’au moins 7 s'); }
  dit(srvIntervalle(0.5, 0) !== srvIntervalle(0.5, srvIntervalle(0.5, 0)), 'S0b le même tirage deux fois ⇒ deux temps différents');
  { const r1 = srvChangees(null, [{ id: 1, unread: true, updated_at: 'a' }], 1000); const r2 = srvChangees(r1.base, [{ id: 1, unread: true, updated_at: 'b' }, { id: 2, unread: false, updated_at: 'c' }], 2000);
    dit(r1.premiere && !r1.changees.length && r2.changees.join() === '1', 'S0c 1re lecture : rien à ouvrir ; ensuite seule la conversation NON LUE qui a bougé', JSON.stringify([r1, r2])); }
  { const fil = { conversation: { id: 7, opposite_user: { id: 9 }, messages: [
      { entity_type: 'message', created_at_ts: 100, entity: { id: 1, user_id: 9, body: 'vieux' } },
      { entity_type: 'message', created_at_ts: 300, entity: { id: 2, user_id: 111, body: 'de moi' } },
      { entity_type: 'message', created_at_ts: 400, entity: { id: 3, user_id: 9, body: 'neuf' } },
      { entity_type: 'message', entity: { id: 4, user_id: 9, body: 'sans date' } }] } };
    const n = srvNeufsDuFil(fil, '111', {}, 200000);
    dit(n.evs.length === 1 && n.evs[0].mid === '3' && n.cles.length === 1, 'S0d seul le message de L’AUTRE, daté après le point de départ, compte (ni le vieux, ni le mien, ni sans date)', JSON.stringify(n));
    dit(!srvNeufsDuFil(fil, '111', { [n.cles[0]]: 1 }, 200000).evs.length, 'S0e déjà vu ⇒ rien'); }
  dit(srvTexte('a '.repeat(200), 40).length <= 40 && /…$/.test(srvTexte('mot '.repeat(50), 40)), 'S0f le texte coupé proprement');
  { const d1 = srvTour(null, { action: 'prendre', appareil: 'a'.repeat(16), compte: '1' }, 1000).data; const r = srvTour(d1, { action: 'prendre', appareil: 'b'.repeat(16), compte: '2' }, 2000);
    dit(d1 && d1.par === 'a'.repeat(16) && r.refus === 'occupe' && srvTour(d1, { action: 'prendre', appareil: 'b'.repeat(16), compte: '2' }, d1.jusqua + 1).data, 'S0g le tour : tenu ⇒ refusé ; périmé ⇒ libre'); }
  { const l = srvLigne({ id: 'x', atMs: 1000, serveur: { on: true, uid: '111', nom: 'shop_a', lu: 900, prochain: 5000, actions: 3, cap: 50 } }, 2000);
    dit(l.code === 'pret' && l.compte === '111' && srvLigne({ id: 'x', atMs: 1000, serveur: { on: true, uid: '111' } }, 1000 + 4 * 60000).code === 'eteint' && srvLigne({ id: 'x', atMs: 1000, serveur: { on: true, deconnecte: true } }, 2000).code === 'deconnecte', 'S0h la ligne d’état : prêt · éteint · déconnecté'); }
  { const bloc = BLOC_RE.exec(fs.readFileSync(REGLE, 'utf8')), bgb = BLOC_RE.exec(fs.readFileSync(SRC, 'utf8'));
    dit(bloc && bgb && bloc[1] === bgb[1], 'S0i le bloc <serveur-regle> de background.js est la copie EXACTE de src/ordinateurServeur.js'); }

  // ── Le serveur partagé (le tour, l'annonce) et la boîte de chaque compte ──
  const serveur = { tour: null, rev: 0, annonces: [], tours: [], statut: () => 200, tourKO: false };
  const vrm = (e) => {
    const p = new URL(e.url).pathname;
    if (p !== '/api/push' || !e.corps) return { status: 404, body: {} };
    if (e.corps.action === 'serveur') { serveur.annonces.push(e.corps); const st = serveur.statut(serveur.annonces.length); return { status: st, body: st === 200 ? { ok: true } : {} }; }
    if (e.corps.action === 'tour') {
      serveur.tours.push(e.corps);
      if (serveur.tourKO) return { status: 503, body: { erreur: 'pas-su' } };
      const x = srvTour(serveur.tour, { action: e.corps.quoi, appareil: e.corps.appareil, compte: e.corps.compte, geste: e.corps.geste }, Date.now());
      if (x.refus === 'forme') return { status: 400, body: {} };
      if (x.refus === 'occupe') return { status: 200, body: { ok: false, occupe: true, par: x.tour.par, compte: x.tour.compte, jusqua: x.tour.jusqua } };
      if (x.data) { serveur.tour = x.data; serveur.rev++; }
      return { status: 200, body: { ok: true, jusqua: x.data ? x.data.jusqua : 0 } };
    }
    return { status: 404, body: {} };
  };
  const boites = {};
  const NOW = Date.now();
  const sec = (ms) => Math.floor(ms / 1000);
  function boite(uid) {
    if (!boites[uid]) boites[uid] = { convs: [{ id: 7001, unread: true, updated_at: 'u0', opposite_user: { id: 4444, login: 'leo_x' } }],
      fils: { 7001: { id: 7001, opposite_user: { id: 4444, login: 'leo_x' }, transaction: { item_title: 'Adidas Samba', item_id: 6001 },
        messages: [{ id: 1, entity_type: 'message', created_at_ts: sec(NOW - 5 * H), entity: { id: 50001, user_id: 4444, body: 'Bonjour (historique)' } }] } }, statut: 200 };
    return boites[uid];
  }
  function nouveauMessage(uid, conv, mid, texte, de = 4444, nonLu = null) {
    const b = boite(uid);
    let c = b.convs.find((x) => x.id === conv);
    if (!c) { c = { id: conv, opposite_user: { id: de, login: 'acheteur_' + conv } }; b.convs.unshift(c); b.fils[conv] = { id: conv, opposite_user: { id: de, login: 'acheteur_' + conv }, transaction: { item_title: 'Nike Dunk' }, messages: [] }; }
    c.unread = nonLu == null ? de !== Number(uid) : nonLu; c.updated_at = 'u' + mid;
    b.fils[conv].messages.push({ id: mid, entity_type: 'message', created_at_ts: sec(Date.now() + 1000), entity: { id: mid, user_id: de, body: texte } });
  }
  const tablePartagee = {};
  const lignesPartagees = {};
  const ecritures = [];          // les écritures « chez Vinted » (le geste), avec leur intervalle
  let enVolEcritures = 0, maxEnVolEcritures = 0;
  function profil({ uid, on = true, onglets = null, lignes = null, ecritureKO = () => false } = {}) {
    const st = { vrmCloisonne: true, vrmSession: { access_token: 'jeton.vrm.' + uid, refresh_token: 'rt', expires_at: Date.now() + H, user_id: MOI, email: 'banc@exemple.fr' } };
    if (on) st.vrmServeur = { on: true, at: Date.now() };
    const etat = { connecte: uid };
    const f = faireFond({ src: SRC, lignes: lignes || lignesPartagees, store: st, connecte: uid, vrm, ecritureKO,
      comptes: [{ vinted_user_id: A, login: 'shop_a', domain: 'www.vinted.fr', access_token: 'j1' }, { vinted_user_id: B, login: 'shop_b', domain: 'www.vinted.fr', access_token: 'j2' }],
      onglets: onglets || [{ id: 7, url: 'https://www.vinted.fr/inbox', status: 'complete', pinned: true }],
      vinted: (e) => {
        const b = boite(etat.connecte);
        if (/^\/api\/v2\/inbox\?/.test(e.chemin)) return b.statut !== 200 ? { status: b.statut, body: {} } : { status: 200, body: { conversations: JSON.parse(JSON.stringify(b.convs)), pagination: { current_page: 1 } } };
        const m = /^\/api\/v2\/conversations\/(\d+)$/.exec(e.chemin);
        if (m && e.methode === 'GET') return b.fils[m[1]] ? { status: 200, body: { conversation: JSON.parse(JSON.stringify(b.fils[m[1]])) } } : { status: 404, body: {} };
        if (/^\/api\/v2\/users\/current/.test(e.chemin)) return { status: 200, body: { user: { id: Number(etat.connecte), login: etat.connecte === A ? 'shop_a' : 'shop_b' } } };
        return { status: 404, body: {} };
      } });
    f.ctx.activeAccountId = async () => etat.connecte;
    f.ctx.activeUidForDomain = async () => etat.connecte;
    // Les chemins du CLIC (À distance), remplacés par des espions qui DURENT (une écriture qui prend du temps chez Vinted).
    const gestes = [];
    f.ctx.executerPourApp = async (msg) => {
      // Le vrai `executerPourApp` compte le geste (`gardeStricte` → `compterAction`) : l'espion aussi.
      const c = await f.ctx.compterAction(String(msg.uid), 50);
      if (!c || !c.ok) return { ok: false, rienParti: true, code: (c && c.code) || 'plafond', attendreMs: (c && c.resteMs) || 60000 };
      enVolEcritures++; maxEnVolEcritures = Math.max(maxEnVolEcritures, enVolEcritures);
      const debut = Date.now(); await dormir(60); enVolEcritures--;
      ecritures.push({ par: uid, compte: etat.connecte, pour: String(msg.uid), debut, fin: Date.now() });
      gestes.push({ msg, compte: etat.connecte });
      return { ok: true, status: 200, data: { code: 0 } };
    };
    f.ctx.travailDabord = async () => ({ tabId: 7 });
    return Object.assign(f, { etat, gestes, uid });
  }
  const tick = (f, s = 'banc') => (typeof f.ctx.serveurTick === 'function' ? f.ctx.serveurTick(s) : Promise.resolve({ absent: true }));
  const lectures = (f) => f.j.vinted.filter((x) => /inbox|conversations\/\d+$/.test(x.chemin) && x.methode === 'GET').length;
  const forcer = (f) => { const e = f.store.vrmServeurEtat; if (e) { e.prochain = 0; } };

  console.log('\nS1. Éteint par défaut');
  { const f = profil({ uid: A, on: false, lignes: {} }); await tick(f); await tick(f);
    dit(lectures(f) === 0 && serveur.annonces.length === 0, 'S1 la veille éteinte ne lit RIEN chez Vinted, n’appelle rien', JSON.stringify(f.j.vinted.map((x) => x.chemin))); }

  console.log('\nS2–S4. Un message neuf, une fois');
  const pa = profil({ uid: A, lignes: {} });
  let r = await tick(pa);
  dit(r && r.lu === true && r.premiere === true && serveur.annonces.length === 0, 'S2 la 1re lecture (l’historique) ⇒ AUCUNE notification', JSON.stringify(r));
  dit(lectures(pa) === 1 && ((pa.store.vrmLectures || {})[A] || []).length >= 1, 'S3a la lecture de la boîte est comptée sur le budget de LECTURE du compte', JSON.stringify(pa.store.vrmLectures));
  nouveauMessage(A, 7001, 50005, 'Elle taille grand ? Je fais du 42.');
  forcer(pa); r = await tick(pa);
  const an = serveur.annonces[0];
  dit(serveur.annonces.length === 1 && an && an.evenements.length === 1, 'S3b un message NEUF ⇒ exactement UN appel `serveur`', JSON.stringify([r, serveur.annonces]));
  const ev = an && an.evenements[0] || {};
  dit(ev.s === 'message' && ev.c === A && ev.conv === '7001' && ev.mid === '50005' && Object.keys(ev).every((k) => ['s', 'c', 'conv', 'mid', 'at', 'n'].includes(k)), 'S3c des IDENTITÉS seulement (compte, conversation, n° du message) — jamais le texte', JSON.stringify(ev));
  { const l = pa.lignes[`harvest_${A}_conv_7001`]; const msgs = l && l.payload && l.payload.conversation && l.payload.conversation.messages;
    dit(Array.isArray(msgs) && msgs.some((m) => m.entity && m.entity.id === 50005), 'S3d le fil est RANGÉ dans la base avant l’appel (le serveur relit le texte là)', JSON.stringify(Object.keys(pa.lignes))); }
  forcer(pa); await tick(pa);
  dit(serveur.annonces.length === 1, 'S4a le même message revu ⇒ aucun appel de plus', serveur.annonces.length);
  { const c = boite(A).convs.find((x) => x.id === 7001); c.updated_at = 'u-relu'; c.unread = true; }
  forcer(pa); await tick(pa);
  dit(serveur.annonces.length === 1, 'S4b la conversation bouge sans message neuf (rouverte) ⇒ aucun appel : déjà vu', serveur.annonces.length);
  nouveauMessage(A, 7001, 50006, 'Oui elle taille normalement', Number(A), true);
  forcer(pa); await tick(pa);
  dit(serveur.annonces.length === 1, 'S4c un message de MOI ⇒ aucun appel', serveur.annonces.length);

  { // S3e : le fil n'a pas pu être rangé (base muette) ⇒ rien n'est annoncé ; rangé au passage suivant ⇒ UNE annonce.
    let ko = true; const n0 = serveur.annonces.length;
    const f = profil({ uid: A, lignes: {}, ecritureKO: (id) => ko && /_conv_7301$/.test(id) });
    await tick(f); nouveauMessage(A, 7301, 51001, 'Encore dispo ?'); forcer(f); await tick(f);
    const avant = serveur.annonces.length - n0;
    ko = false; forcer(f); await tick(f);
    const apres = serveur.annonces.slice(n0).flatMap((x) => x.evenements).filter((e) => e.mid === '51001').length;
    dit(avant === 0 && apres === 1, 'S3e le fil pas rangé (base muette) ⇒ rien annoncé ; rangé au passage suivant ⇒ UNE annonce', JSON.stringify([avant, apres]));
  }

  console.log('\nS5. Au hasard, jamais à heure fixe');
  { const e1 = pa.store.vrmServeurEtat || {}; const ecart1 = Number(e1.precedent);
    const n0 = lectures(pa); await tick(pa);
    dit(lectures(pa) === n0, 'S5a avant l’heure tirée : aucune lecture', JSON.stringify([n0, lectures(pa)]));
    forcer(pa); await tick(pa); const ecart2 = Number((pa.store.vrmServeurEtat || {}).precedent);
    forcer(pa); await tick(pa); const ecart3 = Number((pa.store.vrmServeurEtat || {}).precedent);
    dit([ecart1, ecart2, ecart3].every((x) => x >= 4 * 60000 && x <= 7 * 60000) && ecart1 !== ecart2 && ecart2 !== ecart3, 'S5b l’intervalle tiré dans [4 ; 7] min, jamais deux fois le même', JSON.stringify([ecart1, ecart2, ecart3])); }

  console.log('\nS6. 429, captcha, prudence');
  { const f = profil({ uid: A, lignes: {} }); await tick(f); boite(A).statut = 429; forcer(f); await tick(f);
    const pause = f.store.vrmPauseVinted;
    dit(pause && Number(pause.jusqua) > Date.now(), 'S6a un 429 de Vinted ⇒ la pause est posée', JSON.stringify(pause));
    boite(A).statut = 200; const n0 = f.j.vinted.length; forcer(f); r = await tick(f);
    dit(f.j.vinted.length === n0 && r && r.saute === 'pause', 'S6b pendant la pause : aucune requête Vinted', JSON.stringify(r));
    const g = profil({ uid: A, lignes: {} }); g.store.vrmCaptcha = { [A]: { depuis: Date.now() - 1000, quoi: 'captcha' } }; const rg = await tick(g);
    dit(lectures(g) === 0 && rg && rg.saute === 'captcha' && (g.store.vrmServeurEtat || {}).code === 'captcha', 'S6c une vérification (captcha) en cours ⇒ rien ne part, et l’état le DIT (« captcha »)', JSON.stringify(rg));
    const h = profil({ uid: A, lignes: {} }); h.store.vrmPrudence = { [A]: { depuis: Date.now(), jusqua: Date.now() + H, statut: 403, quoi: 'api' } }; const rh = await tick(h);
    dit(lectures(h) === 0 && rh && rh.saute === 'prudence', 'S6d en prudence (lectures de fond suspendues) ⇒ rien ne part, et c’est dit', JSON.stringify(rh)); }

  console.log('\nS7. Le budget de lecture');
  { const f = profil({ uid: A, lignes: {} }); f.store.vrmLectures = { [A]: Array.from({ length: 14 }, () => Date.now() - 1000) }; r = await tick(f);
    dit(lectures(f) === 0 && r && r.saute === 'budget', 'S7 14 lectures déjà faites dans l’heure ⇒ la veille ne lit pas (6 restent à l’argent et aux colis)', JSON.stringify(r)); }

  console.log('\nS8. Déconnecté');
  { const n0 = serveur.annonces.length; const f = profil({ uid: A, lignes: {} }); await tick(f); f.etat.connecte = null; await tick(f);
    const d = serveur.annonces.slice(n0).flatMap((x) => x.evenements).filter((e) => e.s === 'deconnecte');
    dit(d.length === 1 && d[0].c === A && Number(d[0].at) > 0, 'S8a déconnecté ⇒ UN appel « deconnecte » pour CE compte', JSON.stringify(serveur.annonces.slice(n0)));
    await tick(f); await tick(f);
    dit(serveur.annonces.slice(n0).flatMap((x) => x.evenements).filter((e) => e.s === 'deconnecte').length === 1, 'S8b toujours déconnecté ⇒ pas un second appel');
    dit(lectures(f) === 1, 'S8c déconnecté : la veille ne lit plus', lectures(f)); }

  console.log('\nS9. L’onglet épinglé');
  { const f = profil({ uid: A, lignes: {}, onglets: [] }); await tick(f);
    const o = (f.j.ongletsOptions || [])[0] || {};
    dit(o.pinned === true && o.active === false && /vinted\.fr/.test(String(o.url || '')), 'S9 aucun onglet vinted.fr ⇒ un onglet ÉPINGLÉ rouvert en arrière-plan', JSON.stringify(f.j.ongletsOptions)); }

  console.log('\nS9b. Les lectures décalées entre profils');
  { const lp = {}; const f = profil({ uid: A, lignes: lp }); lp.presence_aaaaaaaaaaaaaaaa = { serveur: { on: true, uid: B, lu: Date.now() - 3000 } };
    const r9 = await tick(f);
    dit(lectures(f) === 0 && r9 && r9.saute === 'decale', 'S9b un autre profil vient de lire (3 s) ⇒ cette lecture attend (jamais deux comptes au même moment)', JSON.stringify(r9));
    lp.presence_aaaaaaaaaaaaaaaa.serveur.lu = Date.now() - 60000; forcer(f); if (f.store.vrmServeurEtat) f.store.vrmServeurEtat.prochain = 0;
    await tick(f);
    dit(lectures(f) === 1, 'S9c l’autre a lu il y a 1 min ⇒ elle part', lectures(f)); }

  console.log('\nS10–S11. Deux profils, deux comptes : jamais deux écritures au même moment');
  const empreinte = async (d) => { const m = await import('file://' + path.join(RACINE, 'src', 'aDistance.js')); return m; };
  const AD = await empreinte();
  const cmd = (compte, conv, t) => { const c = AD.nouvelleCommandeDistance({ geste: 'repondre', site: 'vinted', compte, args: { conv, texte: t }, owner: MOI, alea: 'a' + compte + conv }); return c; };
  const p1 = profil({ uid: A, lignes: lignesPartagees }), p2 = profil({ uid: B, lignes: lignesPartagees });
  for (const p of [p1, p2]) { p.store.vrmSecu = { presence: { vinted: Date.now() } }; }
  const c1 = cmd(A, '7101', 'Bonjour, oui'), c2 = cmd(B, '7201', 'Bonjour, non');
  // La file `cmd_dist_*` partagée (la base du vendeur) : la forme que lit `distanceTick`.
  const table = {};
  for (const c of [c1, c2]) table[c.id] = { id: c.id, owner: MOI, data: JSON.parse(JSON.stringify(c.data)) };
  const rep = (status, body) => ({ ok: status >= 200 && status < 400, status, headers: { get: () => 'application/json' }, json: async () => body, text: async () => JSON.stringify(body) });
  for (const p of [p1, p2]) {
    const orig = p.ctx.fetch;
    p.ctx.fetch = async (url, opts = {}) => {
      const u = decodeURIComponent(String(url)); const m = (opts.method || 'GET').toUpperCase();
      if (/\/rest\/v1\/app_data\?/.test(u) && /cmd_dist_/.test(u)) {
        const eq = /[?&]id=eq\.([^&]+)/.exec(u);
        if (m === 'GET') { let rows = Object.values(table); if (/meta->>etat=eq\.attente/.test(u)) rows = rows.filter((x) => x.data.etat === 'attente'); return rep(200, rows.sort((a, b) => a.id.localeCompare(b.id)).map((x) => JSON.parse(JSON.stringify(x)))); }
        if (m === 'PATCH') { const cond = (/meta->>etat=eq\.([^&]+)/.exec(u) || [])[1]; const x = eq && table[eq[1]]; let corps = {}; try { corps = JSON.parse(opts.body || '{}'); } catch (_) {}
          if (!x || (cond && x.data.etat !== cond)) return rep(200, []); x.data = corps.data; return rep(200, [{ id: x.id }]); }
      }
      return orig(url, opts);
    };
  }
  serveur.tour = null;
  for (let i = 0; i < 12 && Object.values(table).some((x) => x.data.etat === 'attente'); i++) {
    for (const p of [p1, p2]) delete p.store.vrmDistSuivant;
    await Promise.all([p1.ctx.distanceTick('banc'), p2.ctx.distanceTick('banc')]);
  }
  const faits = Object.values(table).map((x) => x.data.etat);
  dit(faits.every((e) => e === 'fait'), 'S10a les deux commandes finissent « fait »', JSON.stringify(Object.values(table).map((x) => [x.data.compte, x.data.etat, x.data.code, x.data.attend])));
  dit(maxEnVolEcritures === 1, 'S10b JAMAIS deux écritures au même moment (deux profils, deux comptes)', JSON.stringify([maxEnVolEcritures, ecritures]));
  { const so = ecritures.slice().sort((a, b) => a.debut - b.debut); const chev = so.some((x, i) => i && x.debut < so[i - 1].fin);
    dit(ecritures.length === 2 && !chev, 'S10c aucune écriture ne chevauche une autre', JSON.stringify(ecritures)); }
  dit(serveur.tours.some((t) => t.quoi === 'prendre') && serveur.tours.some((t) => t.quoi === 'rendre'), 'S10d le tour est pris avant, rendu après', JSON.stringify(serveur.tours.map((t) => t.quoi + ':' + t.compte)));
  dit(p1.gestes.length === 1 && p1.gestes[0].compte === A && p1.gestes[0].msg.uid === A && p2.gestes.length === 1 && p2.gestes[0].compte === B && p2.gestes[0].msg.uid === B,
    'S11 la commande du compte A est faite par LE profil de A, celle de B par celui de B — jamais l’inverse', JSON.stringify([p1.gestes.map((g) => [g.compte, g.msg.uid]), p2.gestes.map((g) => [g.compte, g.msg.uid])]));

  console.log('\nS12. compterAction et le tour');
  { serveur.tour = { par: 'f'.repeat(16), compte: B, jusqua: Date.now() + 50000, geste: 'x' };
    const f = profil({ uid: A, lignes: {} }); const c = await f.ctx.compterAction(A, 50);
    dit(c && c.ok === false && c.code === 'tour' && !((f.store.vrmActions || {})[A] || []).length, 'S12a un AUTRE profil a le tour ⇒ code `tour`, rien compté, rien ne part', JSON.stringify(c));
    serveur.tour = null; serveur.tourKO = true;
    const g = profil({ uid: A, lignes: {} }); const c2b = await g.ctx.compterAction(A, 50);
    dit(c2b && c2b.ok === false && c2b.code === 'tour', 'S12b le tour pas su (serveur muet) ⇒ rien ne part (jamais « oui »)', JSON.stringify(c2b));
    serveur.tourKO = false;
    const h = profil({ uid: A, on: false, lignes: {} }); const c3 = await h.ctx.compterAction(A, 50);
    dit(c3 && c3.ok === true, 'S12c mode éteint ⇒ rien ne change (un seul profil)', JSON.stringify(c3)); }

  console.log('\nS13. La présence publie l’état de la veille');
  { const lp = {}; const f = profil({ uid: A, lignes: lp }); await tick(f); await f.ctx.publierPresence(MOI, true);
    const k = Object.keys(lp).find((x) => /^presence_/.test(x)); const s = k && lp[k].serveur;
    dit(s && s.on === true && s.uid === A && s.lu > 0 && s.prochain > Date.now() && Number.isInteger(s.actions) && s.cap > 0, 'S13 `serveur` : compte, dernière lecture, prochaine, actions de l’heure, plafond', JSON.stringify(s)); }

  console.log('\nS14. La voie « capte » se tait pour les messages Vinted');
  { const f = profil({ uid: A, lignes: {} }); const r1 = await f.ctx.pousserCapte('vinted', A, 'messages', ['7001@2026-11-28T10:00:00.000Z']);
    dit(r1 && r1.etat === 'serveur', 'S14 veille allumée ⇒ le message n’est pas annoncé une seconde fois par « capte »', JSON.stringify(r1)); }

  console.log('\nS15. La porte de l’app (`peutAgir`) : « ordinateur allumé · compte X prêt »');
  { const PA = await import('file://' + path.join(RACINE, 'src', 'agir', 'peutAgir.js'));
    const t = Date.now();
    const ligne = (serveur) => AD.adistPresence({ id: 'presence_aaaaaaaaaaaaaaaa', atMs: t - 1000, ver: '5.457.0', appareil: { nav: 'chrome', systeme: 'mac' }, comptes: [{ site: 'vinted', id: A, nom: 'shop_a' }, { site: 'vinted', id: B, nom: 'shop_b' }], serveur }, t);
    const faits = (serveur) => ({ maintenant: t, capacites: { messagerie: '5.135.0', adistance: '5.436.0' }, presences: [ligne(serveur)], ext: {}, noms: { vinted: { [A]: 'shop_a', [B]: 'shop_b' } } });
    const r1 = PA.peutAgir(faits({ on: true, uid: A, code: 'pret' }), { site: 'vinted', compte: A, geste: 'repondre' });
    dit(r1.ok && r1.serveur === true && r1.cle === 'agir.serveur.pret' && r1.vars && r1.vars.nom === 'shop_a', 'S15a profil prêt pour CE compte ⇒ « ordinateur allumé · compte shop_a prêt »', JSON.stringify(r1));
    const r2 = PA.peutAgir(faits({ on: true, uid: A, code: 'pret' }), { site: 'vinted', compte: B, geste: 'repondre' });
    dit(!r2.serveur, 'S15b un AUTRE compte (pas celui de la veille) ⇒ jamais dit « prêt »', JSON.stringify(r2));
    const r3 = PA.peutAgir(faits({ on: true, uid: A, code: 'captcha' }), { site: 'vinted', compte: A, geste: 'repondre' });
    dit(!r3.serveur, 'S15c en vérification ⇒ pas « prêt »', JSON.stringify(r3));
    const e = PA.etatCompteAgir(faits({ on: true, uid: A, code: 'pret' }), 'vinted', A);
    dit(e && e.lecture === false && e.serveur === true && e.cle === 'agir.serveur.pret', 'S15d le badge par compte le porte (`etatCompteAgir`)', JSON.stringify(e)); }

  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ exception : ' + (e && e.stack || e)); process.exit(1); });
