// ════════════════════════════════════════════════════════════════════════
//  LA CADENCE, SON RÉGLAGE PAR COMPTE (20 nov., ext. 5.410 — Julien : « vas-y fais »)
//  On EXÉCUTE le vrai `background.js` (scripts/_fond-vm.cjs). La cadence vit dans la ligne des réglages
//  `vrm_reglages_auto` (`cles.vinted_cadence.comptes[uid]`), lue par le moteur et par l'app. On juge :
//   1. DÉFAUTS INCHANGÉS (rien posé) : 45 gestes automatiques puis 5 clics = 50/h ; favoris 15/h ;
//   2. réglée à 60/h : 55 automatiques + 5 clics (la réserve de 5 reste) ; favoris réglés à 20/h ⇒ le 16e passe,
//      le 21e attend ;
//   3. BORNES (`reglageAutoNormalise` du vrai fichier) : 61 favoris/h refusé, 101 actions/h refusé, pause 19 s
//      refusée, pause sans plage refusée ; plus vite que le défaut sans `confirme` refusé ;
//   4. ARRÊT AU CAPTCHA toujours actif même à 60/h ; prudence (refus < 24 h) ramène à 20/h même réglé à 100 ;
//   5. ligne illisible ⇒ défauts (jamais plus vite) ;
//   6. la pause choisie part avec `lancer` en PLAGE (ms), tirée au hasard par le serveur (jamais deux fois la même).
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const args = process.argv.slice(2);
const SRC0 = process.env.BG_SRC ? path.resolve(process.env.BG_SRC) : path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
const MUTATIONS = {
  plafond: ["const capH = /^\\d{1,20}$/.test(String(uid)) ? cad.actionsHeure : ACTIONS_MAX_HEURE;", 'const capH = ACTIONS_MAX_HEURE;'],
  reserve: ['const max = Math.max(1, capH - decal);', 'const max = capH;'],
  captcha: ["if (decal > 0 && /^\\d{1,20}$/.test(String(uid))) {\n      const ta", "if (decal > 0 && capH <= 50 && /^\\d{1,20}$/.test(String(uid))) {\n      const ta"],
  bornes: ["const RA_CADENCE_BORNES = { favorisHeure: [1, 15],", "const RA_CADENCE_BORNES = { favorisHeure: [1, 60],"],
  confirme: ["if (plusVite && confirme !== true) return", "if (false) return"],
  favoris: ["if (cad.poses.includes('favorisHeure')) lim = cad.favorisHeure;", ''],
  plage: ['if (!(px > pm)) return', 'if (false) return'],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 300000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
let SRC = SRC0;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const [a, b] = MUTATIONS[mut]; const s = fs.readFileSync(SRC0, 'utf8');
  if (!s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); }
  SRC = path.join(os.tmpdir(), `bg-cadence-${mut}-${process.pid}.js`); fs.writeFileSync(SRC, s.split(a).join(b));
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 300) : '')); } };
const UID = '111', MIN = 60000;
const jourParis = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
const essai = async (nom, fn) => { try { await fn(); } catch (e) { dit(false, nom + ' — exception', e && e.stack); } };
const fond = (cad, extra = {}) => {
  const t = Date.now();
  const lignes = Object.assign({ main: { vinted_discretion: { parJour: 1000 } } }, cad ? { vrm_reglages_auto: { v: 1, rev: 1, cles: { vinted_cadence: { v: 1, comptes: { [UID]: cad } } } } } : {}, extra.lignes || {});
  return faireFond({ src: SRC, connecte: UID, lignes, store: Object.assign({ vrmJourTire: { [UID]: { d: jourParis(t), f: 1, at: t } } }, extra.store || {}) });
};
const compter = async (C, plafond, n) => { let k = 0; for (let i = 0; i < n; i++) { const r = await C.compterAction(UID, plafond); if (r.ok) k++; else return { k, code: r.code }; } return { k }; };

(async () => {
  await essai('defauts', async () => {
    const f = fond(null); const C = f.ctx;
    const a = await compter(C, 45, 120), b = await compter(C, 50, 120);
    dit(a.k === 45 && b.k === 5, 'défauts : rien posé ⇒ 45 automatiques puis 5 clics (50/h, réserve 5)', `${a.k} + ${b.k}`);
    const cad = await C.cadenceCompte(UID);
    dit(cad.favorisHeure === 15 && cad.actionsHeure === 50 && cad.pauseMin === 20 && cad.pauseMax === 60 && cad.parJour === null, 'défauts : 15 favoris/h, 50 actions/h, pause 20–60 s (5.419, sa demande du 21 nov.), plafond du jour de « Discrétion »', JSON.stringify(cad));
  });
  await essai('reglee', async () => {
    const f = fond({ actionsHeure: 60, favorisHeure: 10, at: 1 }); const C = f.ctx;
    const a = await compter(C, 45, 120), b = await compter(C, 50, 120);
    dit(a.k === 55 && b.k === 5, 'réglée à 60/h : 55 automatiques + 5 clics (la réserve reste)', `${a.k} + ${b.k}`);
    const t = Date.now();
    const s = fond({ favorisHeure: 10, at: 1 }, { store: { vrmSortes: { [UID]: { favori: Array.from({ length: 9 }, (_, i) => t - i * MIN), at: t } } } });
    dit((await s.ctx.porteDiscretion(UID, 'favori')) === null, 'favoris réglés à 10/h : le 10e passe');
    const s2 = fond({ favorisHeure: 10, at: 1 }, { store: { vrmSortes: { [UID]: { favori: Array.from({ length: 10 }, (_, i) => t - i * MIN), at: t } } } });
    const r2 = await s2.ctx.porteDiscretion(UID, 'favori');
    dit(r2 && r2.quoi === 'sorte', 'favoris réglés à 10/h : le 11e attend', JSON.stringify(r2));
    const s3 = fond(null, { store: { vrmSortes: { [UID]: { favori: Array.from({ length: 15 }, (_, i) => t - i * MIN), at: t } } } });
    const r3 = await s3.ctx.porteDiscretion(UID, 'favori');
    dit(r3 && r3.quoi === 'sorte', 'défaut : le 16e message aux favoris attend (15/h)', JSON.stringify(r3));
  });
  await essai('bornes', async () => {
    const C = fond(null).ctx, N = (v, c) => C.reglageAutoNormalise('vinted_cadence', Object.assign({ uid: UID }, v), null, c === true, 1);
    dit(N({ favorisHeure: 16 }, true).ok === false && N({ favorisHeure: 60 }, true).ok === false, 'bornes (5.437) : 16 et 60 messages aux favoris par heure refusés — 15 par heure, la limite de Vinted');
    dit(N({ favorisHeure: 15 }, true).ok === true, 'bornes : 15 messages aux favoris par heure accepté');
    dit(C.cadenceDe({ comptes: { [UID]: { favorisHeure: 20 } } }, UID).favorisHeure === 15, 'un réglage d’avant à 20/h retombe à 15/h (jamais au-dessus de la limite de Vinted)');
    dit(N({ actionsHeure: 101 }, true).ok === false && N({ actionsHeure: 9 }, true).ok === false, 'bornes : 101 et 9 actions par heure refusés');
    dit(N({ pauseMin: 19, pauseMax: 60 }, true).ok === false, 'bornes : une pause de 19 s refusée');
    dit(N({ pauseMin: 60, pauseMax: 60 }, true).ok === false, 'bornes : une pause fixe (pas une plage) refusée — toujours aléatoire');
    dit(N({ pauseMin: 20, pauseMax: 240 }, true).ok === true, 'bornes : 20 s à 4 min accepté');
    const sans = N({ actionsHeure: 80 }, false);
    dit(sans.ok === false && sans.code === 'confirmation', 'plus vite que le défaut sans « Oui, aller plus vite » : refusé', JSON.stringify(sans));
    dit(N({ actionsHeure: 30, favorisHeure: 10, pauseMin: 60, pauseMax: 120 }, false).ok === true, 'plus lent que le défaut : sans confirmation');
  });
  await essai('captcha', async () => {
    const t = Date.now();
    const f = fond({ actionsHeure: 60, favorisHeure: 15, at: 1 }, { store: { vrmCaptcha: { [UID]: { depuis: t - MIN, quoi: 'captcha' } } } });
    const r = await f.ctx.compterAction(UID, 45);
    dit(!r.ok && r.code === 'verification', 'captcha : à 60/h, AUCUN geste automatique tant qu’il n’a pas repris', JSON.stringify(r));
    const p = fond({ actionsHeure: 100, at: 1 }, { store: { vrmPrudence: { [UID]: { jusqua: t + 3600000, at: t } } } });
    const a = await compter(p.ctx, 50, 120);
    dit(a.k === 20, 'prudence (refus < 24 h) : 20/h au plus, même réglé à 100', a.k);
  });
  await essai('illisible', async () => {
    const f = fond({ actionsHeure: 100, at: 1 });
    const g = f.ctx;
    const orig = g.sbGet;
    // La ligne des réglages ne répond pas : les défauts, jamais plus vite.
    g.sbGet = async (q) => (/vrm_reglages_auto/.test(String(q)) ? null : orig(q));
    const cad = await g.cadenceCompte(UID);
    dit(cad.actionsHeure === 50, 'ligne illisible : les défauts (50/h), jamais plus vite', JSON.stringify(cad));
  });
  await essai('plage', async () => {
    const { plageValide, delaiRythme } = await import(path.join(__dirname, '..', 'api', '_lib', 'favoris-file.js'));
    dit(plageValide({ min: 19000, max: 60000 }) === null && plageValide({ min: 60000, max: 60000 }) === null && plageValide({ min: 20000, max: 241000 }) === null, 'serveur : une plage hors 20 s – 4 min ou fixe est ignorée');
    const p = plageValide({ min: 20000, max: 30000 }); let prev = null, meme = false; const vus = new Set();
    for (let i = 0; i < 80; i++) { const d = delaiRythme(p, 'j' + i, prev); if (d === prev) meme = true; vus.add(d); prev = d; }
    dit(!meme && [...vus].every((d) => d >= 20000 && d <= 30000) && vus.size > 5, 'serveur : pause tirée dans SA plage, jamais deux fois de suite la même', [...vus].slice(0, 6).join(','));
    dit(delaiRythme('normal', 'x', null) >= 40000 && delaiRythme('normal', 'x', null) <= 90000, 'serveur : sans réglage, toujours 40–90 s');
  });
  console.log(ko ? `\n❌ audit-cadence : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ audit-cadence : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})();
