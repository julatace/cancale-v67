// ════════════════════════════════════════════════════════════════════════
//  LA NUIT AUSSI (22 nov., ext. 5.437 — Julien : « le blocage automatique la nuit est REFUSÉ »)
//  Horloge à 3 h du matin (heure de Paris). On juge, sur le VRAI code :
//   N1. la sécurité des comptes (vm, background.js) : un geste automatique et une mise en ligne programmée PARTENT à
//       3 h (dans les plafonds), même avec un ancien réglage « repos 23 h → 8 h » et personne derrière l'écran ;
//       l'espacement entre deux gestes est le même que le jour (aucune rafale) ;
//   N2. le moteur des offres EXÉCUTÉ à 3 h (horloge du vm) : l'offre au-dessus du prix mini est acceptée, une fois ;
//       le délai avant le geste est le même que le jour (3–20 min) ;
//   N3. l'Agent VRM répond à 3 h (aucune heure calme par défaut) ; ses heures posées à lui restent les siennes ;
//   N4. les messages aux favoris en mode auto : plage par défaut 0 h → 24 h (src/favorisAuto.js, partagé avec le serveur) ;
//   N5. le cycle de vie : créneau par défaut toute la journée ;
//   N6. l'ordinateur gardé éveillé : une automatisation allumée ⇒ `chrome.power.requestKeepAwake('system')` ; son réglage
//       éteint ou plus rien d'allumé ⇒ `releaseKeepAwake` ; permission « power » au manifeste ; dit dans Paramètres.
//  `--prouve` : chaque mutation (une porte horaire remise) doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const { filCapte } = require('./_fil-capte-vm.cjs');
const args = process.argv.slice(2);
const R = path.join(__dirname, '..');
const BG0 = process.env.BG_SRC ? path.resolve(process.env.BG_SRC) : cheminSource();
const MUTATIONS = {
  repos: ['bg', "    // 5.437 : aucun repos de nuit (REFUSÉ par Julien) — `secuRepos` n'est plus consulté pour décider.\n", "    { const rp0 = secuRepos(Object.assign({}, reg, { repos: Object.assign({}, reg.repos, { actif: true }) }), now, x.compte); if (rp0.repos) return non('repos', rp0.repos.jusqua); }\n"],
  presence: ['bg', "if (false && mode === 'auto' && reg.presence && reg.presence.actif) {", "if (mode === 'auto' && reg.presence) {"],
  delai: ['bg', 'const nuit = false && heureParis(t) < 7;', 'const nuit = heureParis(t) < 7;'],
  agent: ['bg', "heuresCalmes: de != null && a != null && de !== a ? { de, a } : null,", "heuresCalmes: de != null && a != null && de !== a ? { de, a } : { de: 22, a: 8 },"],
  cycle: ['bg', 'const hd = bleamEnt(r.heureDebut, 0, 23, 0), hf = bleamEnt(r.heureFin, 1, 24, 24);', 'const hd = bleamEnt(r.heureDebut, 0, 23, 9), hf = bleamEnt(r.heureFin, 1, 24, 21);'],
  eveil: ['bg', "try { if (p) { if (garder) p.requestKeepAwake('system'); else p.releaseKeepAwake(); } } catch (_) {}", ''],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 300000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`); if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
let BG = BG0;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const [, a, b] = MUTATIONS[mut]; const s = fs.readFileSync(BG0, 'utf8');
  if (!s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); }
  BG = path.join(os.tmpdir(), `nuit-${mut}-${process.pid}.js`); fs.writeFileSync(BG, s.split(a).join(b));
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + JSON.stringify(d).slice(0, 400) : '')); } };
// Le dernier 3 h du matin à Paris (avant maintenant).
const heureP = (t) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: 'numeric', hourCycle: 'h23' }).format(new Date(t)));
let T = Date.now() - (Date.now() % 3600000);
while (heureP(T) !== 3) T -= 3600000;
const DEPART = Date.now();
const horloge = (f) => { const RD = vm.runInContext('Date', f.ctx); class FD extends RD { constructor(...a) { if (a.length) super(...a); else super(T + (Date.now() - DEPART)); } static now() { return T + (Date.now() - DEPART); } } f.ctx.__FD = FD; vm.runInContext('Date = globalThis.__FD;', f.ctx); };

(async () => {
  const UID = '111';
  // N1 — la sécurité des comptes
  try {
    const f = faireFond({ src: BG }); const C = f.ctx;
    const reg = C.secuNet({});
    const a = C.secuDecision({ mode: 'auto', reg, maintenant: T, compte: UID });
    const p = C.secuDecision({ mode: 'programme', reg, maintenant: T, compte: UID });
    const vieux = C.secuNet({ repos: { actif: true, debut: 23 * 60, fin: 8 * 60 }, presence: { actif: true, min: 30 } });
    const v = C.secuDecision({ mode: 'auto', reg: vieux, maintenant: T, compte: UID, presenceAt: T - 5 * 3600000 });
    dit(a.ok && p.ok && v.ok, 'N1 à 3 h : un geste automatique et une mise en ligne programmée partent, même avec un ancien « repos 23 h → 8 h » et personne devant l’écran', { a, p, v });
    const nuit = C.secuDecision({ mode: 'auto', reg, maintenant: T, compte: UID, etat: { dernier: T - 5000 } });
    const jour = C.secuDecision({ mode: 'auto', reg, maintenant: T + 9 * 3600000, compte: UID, etat: { dernier: T + 9 * 3600000 - 5000 } });
    dit(!nuit.ok && !jour.ok && nuit.code === jour.code, 'N1 à 3 h, le même espacement qu’à midi entre deux gestes (aucune rafale)', { nuit, jour });
  } catch (e) { dit(false, 'N1 — exception', e && e.stack); }
  // N2 — le moteur des offres exécuté à 3 h
  try {
    const conv = { capturedAt: new Date(T).toISOString(), payload: { conversation: { id: '81', description: 'Paire', opposite_user: { id: 500, feedback_reputation: 0.96, review_count: 40 }, transaction: { item_id: '91' },
      messages: [{ entity_type: 'offer_request_message', entity: { user_id: 500, current: true, status: 10, status_title: '', price: { amount: '50' }, transaction_id: 7001, offer_request_id: 1 } }] } } };
    const lignes = { main: { capturedAt: new Date(T).toISOString(), vinted_offres_auto: true, vinted_annonce_numeros: { '91': { min: 10 } }, vinted_offres_garde: { v: 1, at: T, items: [], complet: true }, vrm_securite_comptes: { plateformes: { vinted: { repos: { actif: true, debut: 1380, fin: 480 } } } } },
      [`harvest_${UID}_conv_1`]: conv, [`harvest_${UID}_listings`]: { capturedAt: new Date(T).toISOString(), payload: { items: [{ id: 91, title: 'Paire', price: { amount: '60' } }] } } };
    const store = { vrmSecu: { presence: { vinted: T - 4 * 3600000 } }, vrmOffresPrevues: { '1': { at: T - 1000, uid: UID, quoi: 'accept' } } };
    const f = faireFond({ src: BG, lignes, store, vinted: filCapte(lignes, () => ({ status: 200, body: {} })) });
    horloge(f);
    try { await f.ctx.autoAccepterOffres(UID); } catch (_) {}
    const acc = f.j.vinted.filter((x) => /offer_requests\/1\/accept$/.test(x.chemin)).length;
    dit(acc === 1, 'N2 moteur des offres exécuté à 3 h (ancien repos réglé, personne depuis 4 h) : l’offre au-dessus du prix mini est acceptée, une fois', acc);
    const d = Array.from({ length: 100 }, () => f.ctx.delaiOffreMs(T) / 60000);
    dit(d.every((x) => x >= 3 && x <= 20), 'N2 à 3 h, le délai avant le geste est celui du jour (3 à 20 min au hasard)', [Math.min(...d), Math.max(...d)]);
  } catch (e) { dit(false, 'N2 — exception', e && e.stack); }
  // N3 — l'Agent VRM
  try {
    const f = faireFond({ src: BG }); const C = f.ctx;
    const Rg = C.agReglage({ actif: true });
    const Rg2 = C.agReglage({ actif: true, heuresCalmes: { de: 1, a: 6 } });
    dit(Rg.heuresCalmes === null && !vm.runInContext('agHeureCalme', f.ctx)(Rg.heuresCalmes, 3) && vm.runInContext('agHeureCalme', f.ctx)(Rg2.heuresCalmes, 3), 'N3 Agent VRM : aucune heure calme par défaut (il répond à 3 h) ; celles qu’IL pose restent les siennes', { Rg: Rg.heuresCalmes, Rg2: Rg2.heuresCalmes });
  } catch (e) { dit(false, 'N3 — exception', e && e.stack); }
  // N4 — favoris en mode auto (règle partagée app / serveur)
  try {
    const A = await import(pathToFileURL(path.join(R, 'src/favorisAuto.js')).href);
    const v = A.validerAutoFavoris({ actif: true });
    dit(v.heureDebut === 0 && v.heureFin === 24 && A.dansPlageAuto(v, T) === true, 'N4 messages aux favoris (mode auto) : plage par défaut 0 h → 24 h, ouverte à 3 h', v);
  } catch (e) { dit(false, 'N4 — exception', e && e.stack); }
  // N5 — cycle de vie
  try {
    const f = faireFond({ src: BG }); const C = f.ctx;
    const c = C.bleamSection('cycle', { actif: true });
    dit(C.creneauOuvert(c.rythme, T), 'N5 cycle de vie : créneau par défaut toute la journée, ouvert à 3 h', c.rythme);
  } catch (e) { dit(false, 'N5 — exception', e && e.stack); }
  // N6 — l'ordinateur gardé éveillé
  try {
    const appels = [];
    const lignes = { main: { vinted_offres_auto: true } };
    const f = faireFond({ src: BG, lignes });
    f.ctx.chrome.power = { requestKeepAwake: (n) => appels.push(['garde', n]), releaseKeepAwake: () => appels.push(['relache']) };
    const r1 = await f.ctx.eveilTick();
    dit(r1.garde === true && appels.some((a) => a[0] === 'garde' && a[1] === 'system'), 'N6 une automatisation allumée ⇒ requestKeepAwake(\'system\')', { r1, appels });
    await f.ctx.poserReglagesCommeBleam({ eveil: false });
    const r2 = await f.ctx.eveilTick();
    dit(r2.garde === false && appels[appels.length - 1][0] === 'relache', 'N6 son réglage éteint ⇒ releaseKeepAwake', { r2, appels });
    const g = faireFond({ src: BG, lignes: { main: { vinted_offres_auto: false } } });
    const ap2 = []; g.ctx.chrome.power = { requestKeepAwake: () => ap2.push('garde'), releaseKeepAwake: () => ap2.push('relache') };
    const r3 = await g.ctx.eveilTick();
    dit(r3.garde === false && ap2.includes('relache') && !ap2.includes('garde'), 'N6 plus rien d’allumé ⇒ relâché', { r3, ap2 });
    const man = JSON.parse(fs.readFileSync(path.join(R, 'vinted-sync-extension/manifest.json'), 'utf8'));
    dit(man.permissions.includes('power'), 'N6 permission « power » au manifeste');
    const ui = fs.readFileSync(path.join(R, 'vinted-sync-extension/vrm-ui.js'), 'utf8'), badge = fs.readFileSync(path.join(R, 'vinted-sync-extension/vrm-badge.js'), 'utf8');
    dit(/cb_eveil: \{ fr: "Garde l’ordinateur éveillé tant qu’une automatisation est allumée"/.test(ui) && /data-cb-eveil\$\{g\.eveil !== false \? ' checked' : ''\}/.test(badge), 'N6 dit dans Paramètres (allumé par défaut, réglable), 5 langues');
  } catch (e) { dit(false, 'N6 — exception', e && e.stack); }
  console.log(`\n${ko ? '❌' : '✅'} audit-nuit : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
