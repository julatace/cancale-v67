// ════════════════════════════════════════════════════════════════════════
//  UNE PAIRE « EN VÉRIFICATION » CHEZ VINTED ⇒ TOUTE LA SÉRIE ATTEND (22 nov., ext. 5.437)
//  Le VRAI background.js dans un vm (scripts/_fond-vm.cjs), la série de l'atelier (manuelle ou programmée : même tick) :
//   V1. la forme mesurée : `is_hidden: true` = masquée ; `false` = visible ; absent = « pas su » (jamais visible) ;
//   V2. la paire 1 faite, son annonce neuve relue MASQUÉE ⇒ aucune paire de plus (aucun `recreerVinted`), la pause est
//       dite (état `verif`, journal), l'ordre et l'avancement intacts ;
//   V3. relue après 5, puis 10, 20, 30 min (jamais avant) ; démasquée ⇒ la série reprend AVEC LA PAIRE SUIVANTE ;
//   V4. « pas su » pendant une pause ⇒ la pause reste (jamais « démasquée » sans preuve) ;
//   V5. toujours masquée après 24 h ⇒ en pause, SON geste demandé ; « Reprendre la série » (confirmé) ⇒ la suite part ;
//   V6. la lecture passe par le budget de lecture (`gardeLecture`) ; le dressing capté plus récent sert sans requête.
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const args = process.argv.slice(2);
const BG0 = process.env.BG_SRC ? path.resolve(process.env.BG_SRC) : cheminSource();
const MUTATIONS = {
  pause: ["    { const pv = await atelierVerifAvantSuite(a, maintenant); if (pv) return pv; }", ''],
  backoff: ['  if (Number(v.prochaine) > maintenant) return { etat: \'pause-verif\', verif: v };', ''],
  passu: ["    if (v.depuis) { v.prochaine = maintenant + 5 * 60000; a.verif = v; await chrome.storage.local.set({ [ATELIER_CLE]: a }); return { etat: 'pause-verif', verif: v }; }", ''],
  h24: ['    if (maintenant - v.depuis >= VERIF_MAX_MS) {', '    if (false) {'],
  dernier: ["      if (r && r.nouvelId) a2.dernier = { id, nouvelId: String(r.nouvelId), titre: String(r.nouveauTitre || r.titre || '').slice(0, 80), at: Date.now() };", ''],
  forme: ["  if (it.is_hidden === false) return 'visible';\n  return 'pas-su';", "  return 'visible';"],
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
  const [a, b] = MUTATIONS[mut]; const s = fs.readFileSync(BG0, 'utf8');
  if (!s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); }
  BG = path.join(os.tmpdir(), `rv-${mut}-${process.pid}.js`); fs.writeFileSync(BG, s.split(a).join(b));
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + JSON.stringify(d).slice(0, 400) : '')); } };
const UID = '111', MIN = 60000;

(async () => {
  try {
    const T0 = Date.now();
    const atelier = { v: 1, etat: 'cours', uid: UID, ids: ['1001', '1002', '1003'], i: 0, paires: {}, espacement: { mode: 'fixe', min: 1, max: 1 }, prochain: 0, lanceLe: T0, photo: {} };
    const f = faireFond({ src: BG, connecte: UID, lignes: { main: { vinted_annonce_numeros: {} } }, store: { vrmAtelierRepub: atelier } });
    const C = f.ctx;
    const E = C.etatVerifAnnonce;
    dit(typeof E === 'function' && E({ is_hidden: true }) === 'masquee' && E({ is_hidden: false }) === 'visible' && E({ id: 1 }) === 'pas-su' && E(null) === 'pas-su', 'V1 forme mesurée : is_hidden vrai = masquée ; faux = visible ; absent = pas su (jamais « visible »)');
    // Le geste et la lecture : simulés (le formulaire est jugé par ses propres audits) — on compte les paires lancées.
    const lancees = [];
    let n = 2000;
    C.executerCommande = async (m) => { lancees.push(m.id); n++; return { accepte: true, etape: 'fait', nouvelId: String(n), nouveauTitre: 'Paire ' + m.id }; };
    let etatLu = 'masquee'; const lectures = [];
    C.lireVerifAnnonce = async (uid, id) => { lectures.push(id); return etatLu; };
    C.filePausee = async () => false;
    C.preuvesDuBilan = async () => ({});
    let t = T0;
    const tick = async (dt = 0) => { t += dt; return C.atelierRepubTick(t); };
    const etat = async () => (await C.chrome.storage.local.get('vrmAtelierRepub')).vrmAtelierRepub;
    await tick();                                   // paire 1 (1001) faite
    dit(lancees.join() === '1001', 'la 1re paire est faite', lancees);
    const r2 = await tick(2 * MIN);                 // avant la 2e : l'annonce neuve relue MASQUÉE
    let a = await etat();
    dit(r2 && r2.etat === 'pause-verif' && lancees.length === 1 && a.verif && a.verif.depuis > 0 && a.i === 1 && a.ids.join() === '1001,1002,1003', 'V2 annonce neuve relue masquée ⇒ AUCUNE paire de plus, pause dite, ordre et avancement intacts', { r2, a });
    const nl = lectures.length;
    await tick(4 * MIN);                            // 4 min : pas encore relue (5 min)
    dit(lectures.length === nl && lancees.length === 1, 'V3 pas relue avant 5 min', lectures);
    await tick(2 * MIN);                            // 6 min : relue, toujours masquée ⇒ prochaine dans 10 min
    a = await etat();
    dit(lectures.length === nl + 1 && a.verif.n === 2 && a.verif.prochaine - t === 10 * MIN, 'V3 relue à 5 min, puis la suivante dans 10 min (5 → 10 → 20 → 30)', a.verif);
    etatLu = 'pas-su'; await tick(11 * MIN);
    a = await etat();
    dit(lancees.length === 1 && a.verif && !a.verif.aToi, 'V4 « pas su » pendant la pause ⇒ la pause reste (jamais démasquée sans preuve)', a.verif);
    etatLu = 'visible'; await tick(6 * MIN);
    a = await etat();
    dit(!a.verif && lancees.join() === '1001,1002' && a.i === 2, 'V3 démasquée ⇒ la série reprend AVEC LA PAIRE SUIVANTE (1002), dans son ordre', { lancees, i: a.i });
    // 24 h
    etatLu = 'masquee';
    await tick(2 * MIN);                            // la 1002 neuve relue masquée
    for (let k = 0; k < 60; k++) await tick(30 * MIN);
    a = await etat();
    dit(a.verif && a.verif.aToi === true && lancees.length === 2 && a.etat === 'cours', 'V5 toujours masquée après 24 h ⇒ la série reste en pause et attend SON geste', a.verif);
    const sans = await C.atelierVerifReprendre({}, { tab: { url: 'https://www.vinted.fr/' } });
    dit(sans.ok === false && (await etat()).verif, 'V5 « Reprendre la série » sans confirmation : rien ne change');
    const avec = await C.atelierVerifReprendre({ confirme: true }, { tab: { url: 'https://www.vinted.fr/' } });
    await tick(1 * MIN);
    dit(avec.ok && lancees.join() === '1001,1002,1003', 'V5 « Reprendre la série » (confirmé) ⇒ la paire suivante part', lancees);
    const s = fs.readFileSync(BG, 'utf8');
    dit(/const g = await gardeLecture\(String\(uid\), acc, 'enligne'\)/.test(s) && /harvest_\$\{uid\}_listings&select=cap:data->>capturedAt/.test(s), 'V6 la relecture passe par le budget de lecture ; le dressing capté plus récent sert sans requête');
  } catch (e) { dit(false, 'exception', e && e.stack); }
  console.log(`\n${ko ? '❌' : '✅'} audit-repub-verification : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
