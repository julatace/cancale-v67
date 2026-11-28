#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  5.455.8 — « JE VEUX UN VRAI AGENT AUTONOME QUI ENVOIE DES MESSAGES AUX FAVORIS » (Julien, 28 nov.)
//  L'interrupteur par compte (« Envoyer automatiquement aux nouveaux favoris », éteint tant qu'IL ne l'allume pas) ; allumé,
//  chaque NOUVEAU favori part seul par le MÊME chemin que son envoi à la main (conversation → offre jamais sous le plancher →
//  message), dans les mêmes plafonds, l'écart protégé de l'agent (3 à 12 min au hasard, inchangé), le compte de l'onglet seulement.
//  On EXÉCUTE la vraie route du serveur (`auto_regler`, `auto`, `suivant`, `terminer`) et le vrai background.js
//  (`piloteFavorisTick`), l'horloge sautant au prochain tour que l'agent se donne :
//   A1 3 nouveaux favoris ⇒ 3 envois (3 conversations, 3 offres à 49,50 €, 3 messages), espacés de 3 à 12 min au hasard ;
//      le journal de l'agent (heure, personne, article, offre, message) et « N envoyés aujourd'hui » ;
//   A2 les mêmes favoris revus ⇒ rien de plus (jamais deux fois) ;
//   A3 son plafond de l'heure atteint (2/h) ⇒ le 3ᵉ ATTEND (rien ne part, l'heure de reprise posée) ;
//   A4 une vérification de Vinted (captcha) ⇒ arrêt : rien ne part ;
//   A5 éteint (jamais allumé, ou « Arrêter ») ⇒ rien ne part ; « Pause » ⇒ rien ne part, « Reprendre » ⇒ il repart.
//  `--prouve` : chaque mutation rend l'audit rouge. Données inventées.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const RACINE = process.env.FAV_AGENT_RACINE ? path.resolve(process.env.FAV_AGENT_RACINE) : path.join(__dirname, '..');
const MUTATIONS = {
  'ecart-20-60': ['src/favorisAuto.js', 'export const AUTO_ECART_MS = [3 * 60000, 12 * 60000];', 'export const AUTO_ECART_MS = [20000, 60000];'],
  'sans-pause': ['vinted-sync-extension/background.js', "    if (st.pause && st.pause[uid]) return fin('pause_agent', { uid });", ''],
  'sans-captcha': ['vinted-sync-extension/background.js', "    if (av && av.stop) return fin(av.stop, { uid });     // captcha ('verification'), Tout arrêter, stockage : ARRÊT", ''],
  'sans-journal': ['vinted-sync-extension/background.js', "      st.journal[uid] = [{ at: maintenant,", "      st.journal[uid + 'x'] = [{ at: maintenant,"],
  'eteint-ignore': ['vinted-sync-extension/background.js', "    if (!r.actif) return fin('eteint', { uid });", ''],
};
const argMut = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (process.argv.includes('--prouve')) {
  let rate = 0;
  for (const m of Object.keys(MUTATIONS)) { const r = cp.spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8', timeout: 600000 }); const rouge = r.status === 1 && /❌ A\d/.test(r.stdout || ''); console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ⇒ ${rouge ? 'rouge' : 'PAS rouge'}`); if (!rouge) { rate++; console.log((r.stdout || '').slice(-600)); } }
  process.exit(rate ? 1 : 0);
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 600) : '')); } };
(async () => {
  let racine = RACINE;
  if (argMut) {
    const M = MUTATIONS[argMut]; if (!M) { console.log('mutation inconnue'); process.exit(2); }
    racine = fs.mkdtempSync(path.join(os.tmpdir(), 'fav-agent-'));
    for (const d of ['api', 'src', 'vinted-sync-extension', 'scripts']) fs.cpSync(path.join(RACINE, d), path.join(racine, d), { recursive: true, filter: (s) => !/\/captures(\/|$)|\.zip$|\.png$/.test(s) });
    fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(racine, 'node_modules'));
    fs.writeFileSync(path.join(racine, 'package.json'), fs.readFileSync(path.join(RACINE, 'package.json')));
    const f = path.join(racine, M[0]), s = fs.readFileSync(f, 'utf8'); if (!s.includes(M[1])) { console.log('mutation introuvable : ' + argMut); process.exit(2); }
    fs.writeFileSync(f, s.split(M[1]).join(M[2]));
    // La copie de src/favorisAuto.js dans background.js (GARDES_APP) suit la source, comme le générateur.
    process.on('exit', () => { try { fs.rmSync(racine, { recursive: true, force: true }); } catch (_) {} });
  }
  const { monde } = require('./_favoris-monde-reel.cjs');
  const MIN = 60000;
  const REG = { actif: true, attenteMin: 10, attenteMax: 15, heureDebut: 0, heureFin: 24, jours: [1, 2, 3, 4, 5, 6, 7], parJour: 30, parHeure: 15 };
  // Allumé à T0 − 30 min ; les 3 favoris arrivent APRÈS (T0 − 20, −19, −18 min) ⇒ dus 10 à 15 min plus tard.
  const nouveauMonde = (o = {}) => monde(racine, Object.assign({ n: 3, notifAt: (i, T0) => T0 - (20 - i) * MIN, avant: async ({ call, h }) => {
    if (o.allumer === false) return;
    const t = h.t; h.t = t - 30 * MIN; const r = await call('auto_regler', { reglages: Object.assign({}, REG, o.reglages || {}), confirme: true }); h.t = t;
    if (r.code !== 200) throw new Error('auto_regler : ' + JSON.stringify(r.body));
  } }, o.monde || {}));
  // Les tours de l'agent : l'horloge saute à SON prochain tour (au plus `max` tours).
  const tours = async (m, max = 30, fin = null) => {
    const vus = [];
    for (let k = 0; k < max; k++) {
      const st0 = m.f.store.vrmPiloteFavoris || {};
      if (Number(st0.prochain) > m.h.t) m.h.t = Number(st0.prochain) + 1;
      const r = await m.f.ctx.piloteFavorisTick(m.h.t);
      vus.push(r && r.etat);
      if (fin && fin()) break;
      m.h.t += 1000;
    }
    return vus;
  };
  const W = (m, re) => m.f.j.vinted.filter((v) => v.methode !== 'GET' && re.test(v.chemin)).map((v) => { try { return Object.assign({ at: v.at }, JSON.parse(v.corps)); } catch (_) { return { at: v.at }; } });
  try {
    console.log('\nA1. Trois nouveaux favoris : trois envois, espacés au hasard (3 à 12 min, l’écart protégé)');
    const m = await nouveauMonde();
    const vus = await tours(m, 40, () => W(m, /replies$/).length >= 3);
    const dem = W(m, /inquiries$/), off = W(m, /\/offers$/), msg = W(m, /replies$/);
    const fs0 = m.fileServeur(), jobs = (fs0 && Object.values(fs0.groupes)[0].jobs) || [];
    const env = jobs.filter((j) => j.etat === 'envoye').sort((a, b) => a.envoyeLe - b.envoyeLe);
    const ecarts = env.slice(1).map((j, i) => j.envoyeLe - env[i].envoyeLe);
    console.log(`     mesuré : ${dem.length} conversations · ${off.length} offres · ${msg.length} messages · écarts ${ecarts.map((x) => (x / 60000).toFixed(1) + ' min').join(', ')} · tours ${vus.join(',')}`);
    dit(dem.length === 3 && new Set(dem.map((x) => String(x.receiver_id))).size === 3 && off.length === 3 && off.every((x) => x.offer && x.offer.price === '49.5') && msg.length === 3, 'A1 3 envois : 3 conversations (3 personnes), 3 offres à 49,50 €, 3 messages', JSON.stringify({ dem: dem.length, off: off.map((x) => x.offer && x.offer.price), msg: msg.length, vus }));
    // L'écart PROTÉGÉ de l'agent (CLAUDE.md §3, défaut jamais changé sans lui) : 3 à 12 min tirés au hasard, un MINIMUM (une garde
    //    de l'extension peut ajouter son attente) ; jamais la pause de 20–60 s de ses envois à la main.
    const tirages = (await import(path.join(racine, 'src', 'favorisAuto.js') + '?r=' + Math.random())).ecartAutoMs;
    const ech = Array.from({ length: 40 }, (_, k) => tirages('jeton-' + k));
    dit(ecarts.length === 2 && ecarts.every((x) => x >= 3 * 60000) && ech.every((x) => x >= 3 * 60000 && x <= 12 * 60000) && new Set(ech).size > 30, 'A1 espacés par l’écart protégé de l’agent : 3 à 12 min au hasard (jamais 20–60 s)', JSON.stringify({ ecarts, min: Math.min(...ech), max: Math.max(...ech) }));
    const ag = await m.f.ctx.agentFavorisPour(m.UID);
    dit(ag && ag.actif === true && ag.envoyes === 3 && ag.journal.length === 3 && ag.journal.every((x) => x.etat === 'envoye' && x.px === 49.5 && /il te plaît toujours/.test(x.t || '') && m.ACH.includes(x.qui) && m.ITEMS.includes(x.item)), 'A1 « 3 envoyés aujourd’hui » et le journal : heure, personne, article, offre 49,50 €, message', JSON.stringify(ag && { a: ag.actif, n: ag.envoyes, j: ag.journal.map((x) => [x.etat, x.px, x.qui, x.item, (x.t || '').slice(0, 20)]) }).slice(0, 700));
    console.log('\nA2. Les mêmes favoris revus : rien de plus');
    await tours(m, 8);
    dit(W(m, /inquiries$/).length === 3 && W(m, /replies$/).length === 3, 'A2 jamais deux fois : aucun nouvel envoi', JSON.stringify({ dem: W(m, /inquiries$/).length }));
    m.fin();

    console.log('\nA3. Son plafond de l’heure (2/h) : le 3ᵉ attend');
    const m3 = await nouveauMonde({ reglages: { parHeure: 2 } });
    // 2 réservations par heure au plus (une tentative compte à la réservation, même si l'extension la fait attendre).
    await tours(m3, 20, () => (m3.fileServeur() && (m3.fileServeur().autoEnvois || []).length >= 2) || W(m3, /replies$/).length >= 2);
    const avant3 = W(m3, /replies$/).length, t3 = m3.h.t;
    // Puis 5 tours d'une minute chacun (l'heure n'est pas finie) : rien ne part, le favori suivant ATTEND.
    const v3 = [];
    for (let k = 0; k < 5; k++) { m3.h.t += 60000; const st = m3.f.store.vrmPiloteFavoris; st.prochain = 0; const r = await m3.f.ctx.piloteFavorisTick(m3.h.t); v3.push(r && r.etat); }
    const st3 = m3.f.store.vrmPiloteFavoris || {};
    dit(avant3 >= 1 && avant3 <= 2 && W(m3, /replies$/).length === avant3 && v3.every((x) => x === 'quota_heure') && Number(st3.dernier && st3.dernier.jusqua) > m3.h.t && m3.h.t - t3 < 3600000, 'A3 son plafond de l’heure atteint : le favori suivant ATTEND (« quota_heure », l’heure de reprise posée), rien ne part, rien de refusé', JSON.stringify({ avant3, apres: W(m3, /replies$/).length, v3, d: st3.dernier }));
    m3.fin();

    console.log('\nA4. Une vérification de Vinted (captcha) : arrêt');
    const m4 = await nouveauMonde({ monde: {} });
    m4.f.store.vrmCaptcha = { [m4.UID]: { depuis: m4.h.t - 1000, quoi: 'captcha' } };
    const v4 = await tours(m4, 10);
    dit(W(m4, /inquiries$|replies$|offers$/).length === 0 && v4.some((x) => /verification|captcha|onglet/.test(String(x))), 'A4 rien ne part pendant la vérification', JSON.stringify(v4));
    m4.fin();

    console.log('\nA5. Éteint, « Arrêter », « Pause »');
    const m5 = await nouveauMonde({ allumer: false });
    const v5 = await tours(m5, 10);
    dit(W(m5, /inquiries$|replies$|offers$/).length === 0 && v5.includes('eteint') && !m5.vrmAppels.some((x) => /^auto:/.test(x)), 'A5 jamais allumé ⇒ rien ne part, l’agent ne demande même rien au serveur (son geste est l’autorisation)', JSON.stringify({ v5, appels: m5.vrmAppels.slice(0, 8) }));
    m5.fin();
    const m6 = await nouveauMonde();
    const sender = m6.sender;
    const p = await m6.f.envoyer({ from: 'vrm-badge', action: 'agentFavoris', quoi: 'pause' }, sender);
    const v6 = await tours(m6, 10);
    dit(p && p.ok && W(m6, /replies$/).length === 0 && v6.includes('pause_agent'), 'A5 « Pause » ⇒ rien ne part', JSON.stringify({ p, v6 }));
    await m6.f.envoyer({ from: 'vrm-badge', action: 'agentFavoris', quoi: 'reprendre' }, sender);
    await tours(m6, 30, () => W(m6, /replies$/).length >= 1);
    dit(W(m6, /replies$/).length >= 1, '« Reprendre » ⇒ il repart seul', W(m6, /replies$/).length);
    const off6 = await m6.f.envoyer({ from: 'vrm-badge', action: 'favorisAuto', actif: false }, sender);
    const n6 = W(m6, /replies$/).length; m6.f.store.vrmPiloteFavoris.relu = {}; await tours(m6, 10);
    dit(off6 && off6.ok && W(m6, /replies$/).length === n6, 'A5 « Arrêter » (l’interrupteur éteint chez VRM) ⇒ plus rien ne part', JSON.stringify({ off6, n6, apres: W(m6, /replies$/).length }));
    m6.fin();
  } catch (e) { ko++; console.log('  ❌ A0 a levé : ' + (e && e.stack || e)); }
  console.log(ko ? `❌ agent des favoris : ${ko} rouge(s), ${ok} vert(s)` : `✅ agent des favoris : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ A0 a levé : ' + (e && e.stack || e)); process.exit(1); });
