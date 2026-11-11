// ════════════════════════════════════════════════════════════════════════════
//  SÉCURITÉ DES COMPTES (Vinted ET Vestiaire) — 11 nov., lot securite-vinted, ext. 5.366
//  Julien : « améliore la sécurité des comptes Vinted pour faire comme Vintex, pour ne
//  pas se faire bannir » + Vestiaire. L'audit EXÉCUTE la règle (src/securiteComptes.js)
//  ET le vrai background.js dans un vm (scripts/_fond-vm.cjs) :
//    R  la règle pure : repos de nuit par compte (23 h → 8 h, décalé chaque jour), réveil
//       étalé, plafond/jour, plafond par type, pas de rafale, délais jamais ronds,
//       prudence, arrêt anti-robot, « n'agir que si tu es là », journée calme, rodage,
//       Retry-After, « Tout arrêter » (le dernier geste fait foi) ;
//    E  l'extension : moteur d'offres arrêté la nuit / sans lui / Tout arrêter ; captcha
//       DataDome ⇒ plus RIEN ne part pour ce compte (même un clic), lecture normale ⇒
//       reprise ; Retry-After plus long que le palier ⇒ pause allongée ; 429 ⇒ prudence ;
//       Vestiaire (répondre, offre) branché ; le plafond 50/h et la réserve inchangés ;
//    C  la copie du bloc dans background.js est EXACTE.
//  `--recopie` : réécrit le bloc de l'extension depuis l'app.
//  `--src <background.js>` : rejoue E sur une autre copie (preuve sur l'avant, §6.1).
//  `--mutation=<nom>|toutes` : réaffaiblit une règle ⇒ doit être ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const BLOC_RE = /\/\/ <securite-comptes-regle>[^\n]*\n([\s\S]*?)\/\/ <\/securite-comptes-regle>/;
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
const iSrc = process.argv.indexOf('--src');
const SRC_BG = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(R, 'vinted-sync-extension', 'background.js');

if (process.argv.includes('--recopie')) {
  const app = fs.readFileSync(path.join(R, 'src', 'securiteComptes.js'), 'utf8');
  const m = BLOC_RE.exec(app); if (!m) { console.log('❌ bloc absent de src/securiteComptes.js'); process.exit(1); }
  const f = path.join(R, 'vinted-sync-extension', 'background.js');
  const bg = fs.readFileSync(f, 'utf8');
  if (!BLOC_RE.test(bg)) { console.log('❌ marques absentes de background.js'); process.exit(1); }
  fs.writeFileSync(f, bg.replace(BLOC_RE, () => '// <securite-comptes-regle> — COPIE de src/securiteComptes.js (scripts/audit-securite-comptes.cjs --recopie). Ne pas modifier ici.\n' + m[1] + '// </securite-comptes-regle>'));
  console.log('✅ bloc recopié dans background.js'); process.exit(0);
}

// Les mutations : chacune réaffaiblit UNE règle (dans une copie) ⇒ l'audit doit rougir.
const MUTATIONS = {
  repos: ['src/securiteComptes.js', 'if (rp.repos) return non(\'repos\', rp.repos.jusqua);', ''],
  presence: ['src/securiteComptes.js', "if (!p || now - p > reg.presence.min * 60000) return non('absent', null);", ''],
  robot: ['src/securiteComptes.js', "if (etat.robot) return non('robot', null);", ''],
  arret: ['src/securiteComptes.js', "if (x.arret && mode !== 'clic') return non('arret', null);", ''],
  jour: ['src/securiteComptes.js', "if (n >= reg.parJour) {", 'if (false) {'],
  rafale: ['src/securiteComptes.js', 'if (reste > 0) {', 'if (false) {'],
  rond: ['src/securiteComptes.js', 'if (reste < 1500 || reste > 58500) v += 2300 + r() * 4100;', ''],
  decalage: ['src/securiteComptes.js', 'if (!v) return 0;', 'return 0;'],
  defi: ['src/securiteComptes.js', "if (st >= 400 && (/protected|blocked/i.test(String(e['x-datadome'] || ''))", "if ((/protected|blocked/i.test(String(e['x-datadome'] || ''))"],
  retry: ['vinted-sync-extension/background.js', 'const minutes = Math.max(PAUSE_PALIERS_MIN[niveau - 1], Math.ceil((Number(retryMs) || 0) / 60000));', 'const minutes = PAUSE_PALIERS_MIN[niveau - 1];'],
  moteur: ['vinted-sync-extension/background.js', "if (await secuGeste('vinted', uid, 'offre', 'auto')) break;", ''],
  observer: ['vinted-sync-extension/background.js', "        c.robot = { depuis: t };", ''],
  vc: ['vinted-sync-extension/background.js', "{ const rbVc = await secuRobotDit('vestiaire', o.compte); if (rbVc) return { accepte: false, code: rbVc.code, raison: rbVc.error }; }\n    const secuVc = await secuGeste('vestiaire', o.compte, 'reponse', 'clic');", 'const secuVc = null;'],
  lecture: ['vinted-sync-extension/background.js', "secuLectureNormale('vinted', String(uid)).catch(() => {});", ''],
};
if (MUT) {
  const noms = MUT === 'toutes' ? Object.keys(MUTATIONS) : [MUT];
  let rouges = 0;
  for (const n of noms) {
    const [f, a, b] = MUTATIONS[n];
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'secu-mut-'));
    for (const d of ['src', 'vinted-sync-extension', 'scripts']) fs.cpSync(path.join(R, d), path.join(tmp, d), { recursive: true, filter: (s) => !/node_modules|bancs[\\/]captures/.test(s) });
    const cible = path.join(tmp, f), t = fs.readFileSync(cible, 'utf8');
    if (!t.includes(a)) { console.log(`⚠️ mutation ${n} : texte introuvable`); rouges += 0; continue; }
    fs.writeFileSync(cible, t.replace(a, b));
    if (f.startsWith('src/')) spawnSync(process.execPath, [path.join(tmp, 'scripts', 'audit-securite-comptes.cjs'), '--recopie'], { encoding: 'utf8' });
    const r = spawnSync(process.execPath, [path.join(tmp, 'scripts', 'audit-securite-comptes.cjs')], { encoding: 'utf8', timeout: 240000 });
    const rouge = r.status !== 0;
    console.log(`${rouge ? '✅' : '❌'} mutation ${n} ⇒ ${rouge ? 'ROUGE' : 'reste vert (contrôle trop faible)'}`);
    if (rouge) rouges++;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\n${rouges}/${noms.length} mutations rougissent l'audit`);
  process.exit(rouges === noms.length ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d !== undefined ? '  → ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : ''}`); };
// Une heure de Paris en novembre (UTC+1) : '2026-11-11T23:30' ⇒ 22:30Z.
const paris = (s) => Date.parse(s + ':00+01:00');

(async () => {
  const S = await import(pathToFileURL(path.join(R, 'src', 'securiteComptes.js')).href);
  console.log('── R. la règle');
  const D = S.SECU_DEFAUT;
  const reg = S.secuNet({});
  dit(reg.repos.actif && reg.repos.debut === 1380 && reg.repos.fin === 480 && reg.parJour === 0 && reg.presence.actif && reg.presence.min === 30, 'R1 défaut : repos 23 h → 8 h, pas de plafond/jour (son choix), « si tu es là » 30 min');
  const nuit = S.secuDecision({ mode: 'auto', reg, maintenant: paris('2026-11-11T23:40'), compte: '111', presenceAt: paris('2026-11-11T23:39') });
  dit(!nuit.ok && nuit.code === 'repos' && nuit.jusqua > paris('2026-11-12T07:50') && nuit.jusqua < paris('2026-11-12T08:10'), 'R2 23 h 40 : un geste automatique attend la fin du repos (~8 h, décalé)', nuit);
  const prog = S.secuDecision({ mode: 'programme', reg, maintenant: paris('2026-11-12T03:00'), compte: '111' });
  dit(!prog.ok && prog.code === 'repos', 'R3 une mise en ligne programmée ne part pas la nuit non plus', prog);
  const serie = S.secuDecision({ mode: 'serie', reg, maintenant: paris('2026-11-12T03:00'), compte: '111' });
  const suite = S.secuDecision({ mode: 'suite', reg, maintenant: paris('2026-11-12T03:00'), compte: '111' });
  dit(serie.ok && suite.ok, 'R4 ce qu’il lance lui-même (série) et la fin d’une paire déjà commencée partent même tard');
  // Décalage : différent selon le jour et le compte, jamais une minute ronde, borné.
  const decs = ['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'].map((j) => S.secuDecalage(j, '111', 'debut', 9));
  dit(new Set(decs).size >= 3 && decs.every((d) => Math.abs(d) <= 9) && S.secuDecalage('2026-11-11', '222', 'debut', 9) !== decs[0], 'R5 les plages bougent chaque jour et par compte (±9 min)', decs);
  const perso = S.secuReglages({ comptes: { 'vinted:111': { repos: { debut: 22 * 60, fin: 9 * 60 } } } }, 'vinted', '111');
  const perso2 = S.secuReglages({ comptes: { 'vinted:111': { repos: { debut: 22 * 60, fin: 9 * 60 } } } }, 'vinted', '222');
  dit(perso.repos.debut === 1320 && perso2.repos.debut === 1380, 'R6 le repos se règle PAR COMPTE (l’autre compte garde le défaut)');
  // Réveil : juste après le repos, un geste toutes les 4 à 7 min (rien ne se rattrape d'un coup).
  const fin = S.secuRepos(reg, paris('2026-11-12T07:00'), '111').repos.jusqua;
  const apres = fin + 5 * 60000;
  const rv1 = S.secuDecision({ mode: 'auto', reg, maintenant: apres, compte: '111', presenceAt: apres - 1000, etat: { dernier: apres - 90 * 1000 } });
  const rv2 = S.secuDecision({ mode: 'auto', reg, maintenant: paris('2026-11-12T12:00'), compte: '111', presenceAt: paris('2026-11-12T11:59'), etat: { dernier: paris('2026-11-12T12:00') - 90 * 1000 } });
  dit(!rv1.ok && rv1.code === 'reveil' && rv1.jusqua - apres >= 2.4 * 60000 && rv2.ok, 'R7 au réveil, les gestes en retard sont étalés (4–7 min), pas d’un coup ; à midi, 90 s suffisent', { rv1, rv2 });
  // Plafond du jour (option), plafond par type.
  const midi = paris('2026-11-12T12:00');
  const g = (n, s = 'offre', m = 'auto', pas = 120000) => Array.from({ length: n }, (_, i) => ({ t: midi - (i + 1) * pas, s, m }));
  const regJ = S.secuNet({ parJour: 5 });
  const j1 = S.secuDecision({ mode: 'auto', reg: regJ, maintenant: midi, compte: '1', presenceAt: midi, gestes: g(5, 'offre', 'auto', 600000), etat: { dernier: midi - 600000 } });
  const j2 = S.secuDecision({ mode: 'auto', reg: regJ, maintenant: midi, compte: '1', presenceAt: midi, gestes: g(4, 'offre', 'auto', 600000), etat: { dernier: midi - 600000 } });
  const j3 = S.secuDecision({ mode: 'clic', reg: regJ, maintenant: midi, compte: '1', gestes: g(5, 'offre', 'auto', 600000), etat: { dernier: midi - 600000 } });
  dit(!j1.ok && j1.code === 'jour' && j2.ok && j3.ok, 'R8 plafond du jour (son réglage) : le 6e geste automatique attend demain ; son clic passe', { j1, j2 });
  const regT = S.secuNet({ parType: { favori: 3 } });
  const t1 = S.secuDecision({ mode: 'serie', sorte: 'favori', reg: regT, maintenant: midi, compte: '1', gestes: g(3, 'favori', 'serie', 300000), etat: { dernier: midi - 300000 } });
  const t2 = S.secuDecision({ mode: 'serie', sorte: 'offre', reg: regT, maintenant: midi, compte: '1', gestes: g(3, 'favori', 'serie', 300000), etat: { dernier: midi - 300000 } });
  dit(!t1.ok && t1.code === 'type' && t2.ok, 'R9 plafond PAR TYPE dans l’heure : 3 favoris ⇒ le 4e attend, une offre passe', { t1, t2 });
  dit(S.secuNet({ parType: { favori: 80 } }).parType.favori === 50, 'R10 un plafond par type ne dépasse jamais les 50/h');
  // Pas de rafale.
  const r0 = S.secuDecision({ mode: 'auto', reg, maintenant: midi, compte: '1', presenceAt: midi, etat: { dernier: midi - 5000 } });
  const r0b = S.secuDecision({ mode: 'auto', reg, maintenant: midi, compte: '1', presenceAt: midi, etat: { dernier: midi - 39000 } });
  const r1 = S.secuDecision({ mode: 'serie', reg, maintenant: midi, compte: '1', etat: { dernier: midi - 2000 } });
  const r2 = S.secuDecision({ mode: 'clic', reg, maintenant: midi, compte: '1', etat: { dernier: midi - 1000 } });
  dit(!r0.ok && r0.code === 'espace' && r0.jusqua - midi >= 35000 && (r0b.ok ? r0b.attendreMs > 0 : true) && r1.ok && r1.attendreMs >= 6000 && r1.attendreMs <= 25000 && r2.ok && r2.attendreMs === 2000,
    'R11 jamais de rafale : 40 s (+ tirage) entre deux gestes automatiques, 8–14 s dans une série qu’il lance, 3 s entre deux clics ; l’extension n’attend jamais plus de 25 s', { r0, r1, r2 });
  const cibles = [1, 2, 3, 4, 5, 6].map((k) => S.secuCible(40000, midi + k * 77777));
  dit(new Set(cibles).size === 6 && cibles.every((c) => c >= 40000 && c <= 72000), 'R12 l’espacement varie d’un geste à l’autre (jamais régulier)', cibles);
  let rondes = 0; for (let i = 0; i < 400; i++) { const v = S.secuDelaiVariable(60000, 120000 + (i % 3) * 60000, () => (i % 7) / 7); if (v % 60000 < 1500 || v % 60000 > 58500) rondes++; }
  dit(rondes === 0, 'R13 délais variables : jamais une minute ronde', rondes);
  // Prudence / robot / arrêt.
  const p1 = S.secuDecision({ mode: 'auto', reg, maintenant: midi, compte: '1', presenceAt: midi, etat: { prudence: { jusqua: midi + 3600000 } } });
  const p2 = S.secuDecision({ mode: 'clic', reg, maintenant: midi, compte: '1', etat: { prudence: { jusqua: midi + 3600000 }, dernier: midi - 5000 } });
  dit(!p1.ok && p1.code === 'prudence' && p1.jusqua === midi + 3600000 && p2.ok && p2.attendreMs === 15000, 'R14 prudence : l’automatique s’arrête jusqu’à l’heure dite ; un clic passe, plus lentement (20 s)', { p1, p2 });
  const b1 = S.secuDecision({ mode: 'clic', reg, maintenant: midi, compte: '1', etat: { robot: { depuis: midi - 1 } } });
  dit(!b1.ok && b1.code === 'robot', 'R15 contrôle anti-robot : même un clic ne part plus', b1);
  const a1 = S.secuDecision({ mode: 'serie', reg, maintenant: midi, compte: '1', arret: true });
  const a2 = S.secuDecision({ mode: 'clic', reg, maintenant: midi, compte: '1', arret: true });
  dit(!a1.ok && a1.code === 'arret' && a2.ok, 'R16 « Tout arrêter » coupe tout l’automatique (séries comprises), pas son clic');
  dit(S.secuArretEffectif([{ s: 'arret', at: 10 }, { s: 'relance', at: 20 }]).arrete === false && S.secuArretEffectif([{ s: 'relance', at: 10 }, { s: 'arret', at: 30 }]).arrete === true, 'R17 arrêt / relance : le dernier geste fait foi, d’où qu’il vienne');
  // Présence.
  const pr1 = S.secuDecision({ mode: 'auto', reg, maintenant: midi, compte: '1', presenceAt: midi - 31 * 60000 });
  const pr2 = S.secuDecision({ mode: 'auto', reg, maintenant: midi, compte: '1', presenceAt: midi - 10 * 60000 });
  const pr3 = S.secuDecision({ mode: 'auto', reg, maintenant: midi, compte: '1' });
  dit(!pr1.ok && pr1.code === 'absent' && pr2.ok && !pr3.ok, 'R18 « n’agir que si tu es là » : onglet utilisé il y a 31 min ⇒ rien ; 10 min ⇒ oui ; jamais vu ⇒ rien');
  // Journée calme.
  const regC = S.secuNet({ calme: [S.secuParis(midi).dow] });
  const c1 = S.secuDecision({ mode: 'auto', reg: regC, maintenant: midi, compte: '1', presenceAt: midi });
  const c2 = S.secuDecision({ mode: 'auto', reg: S.secuNet({ calmeDates: [S.secuParis(midi).jour] }), maintenant: midi, compte: '1', presenceAt: midi });
  dit(!c1.ok && c1.code === 'calme' && !c2.ok && c2.code === 'calme', 'R19 journée calme (jour de la semaine, ou une date posée) : rien d’automatique');
  // Rodage.
  const ro = S.secuRodage({ ventes: 2, ageJours: null }, reg), ro2 = S.secuRodage({ ventes: 50, ageJours: 400 }, reg), ro3 = S.secuRodage({}, reg);
  const rod = S.secuDecision({ mode: 'serie', reg, maintenant: midi, compte: '1', profil: { ventes: 1 }, gestes: g(10, 'baisse', 'serie', 200000), etat: { dernier: midi - 200000 } });
  dit(ro && ro.heure === 10 && ro2 === null && ro3 === null && !rod.ok && rod.code === 'rodage', 'R20 compte récent (LU) : 10/h au plus ; ancien : rien ; pas lu : rien d’inventé', { ro, rod });
  // Retry-After et détection.
  dit(S.secuRetryAfterMs('120', 0) === 120000 && S.secuRetryAfterMs('n’importe quoi', 0) === 0 && S.secuRetryAfterMs('999999', 0) === 24 * 3600000, 'R21 Retry-After lu en secondes (ou date), borné à 24 h');
  dit(S.secuDefi({ status: 403, json: { url: 'https://geo.captcha-delivery.com/captcha/?initialCid=x' } }) === 'robot'
    && S.secuDefi({ status: 403, entetes: { 'x-datadome': 'protected' } }) === 'robot'
    && S.secuDefi({ status: 200, entetes: { 'x-datadome': 'protected', 'content-type': 'application/json' }, json: { ok: 1 } }) === ''
    && S.secuDefi({ status: 403, json: { message: 'Ton compte est restreint pour activité automatisée' } }) === 'restreint'
    && S.secuDefi({ status: 200, json: { item: { description: 'pas de captcha ici' } } }) === ''
    && S.secuDefi({ status: 429, json: {} }) === '', 'R22 contrôle anti-robot reconnu (DataDome, captcha), restriction reconnue, une annonce qui dit « captcha » ne l’est pas');
  // La phrase.
  const ph = S.secuPhrase({ plateforme: 'vinted', compte: '1', etat: { robot: { depuis: 1 } }, maintenant: midi });
  const ph2 = S.secuPhrase({ plateforme: 'vestiaire', compte: '1', etat: {}, maintenant: midi, aujourdhui: 4 });
  dit(ph.niveau === 'robot' && S.secuTexte(S.SECU_PHRASES, ph.cle, ph.v) === 'Vinted vérifie ton compte · fais la vérification toi-même sur vinted.fr' && S.secuTexte(S.SECU_PHRASES, ph2.cle, ph2.v) === 'Calme · 4 gestes de VRM aujourd’hui', 'R23 une phrase par compte (vérification, calme)');
  // La phrase de l'app = celle de l'extension = celle de fr.js.
  const fr = (await import(pathToFileURL(path.join(R, 'src', 'i18n', 'langues', 'fr.js')).href)).default;
  const ecarts = Object.keys(S.SECU_PHRASES).filter((k) => fr['securite.phrase.' + k] !== S.SECU_PHRASES[k]);
  dit(!ecarts.length, 'R24 les phrases de fr.js sont celles de la règle (une seule source)', ecarts);

  console.log('\n── C. la copie dans l’extension');
  const app = BLOC_RE.exec(fs.readFileSync(path.join(R, 'src', 'securiteComptes.js'), 'utf8'));
  const ext = BLOC_RE.exec(fs.readFileSync(SRC_BG, 'utf8'));
  dit(!!app && !!ext && app[1].trim() === ext[1].trim(), 'C1 le bloc <securite-comptes-regle> de background.js est la copie exacte de src/securiteComptes.js', !ext ? 'absent de l’extension' : 'différent : --recopie');

  console.log('\n── E. le vrai background.js (vm)');
  const { faireFond } = require('./_fond-vm.cjs');
  const UID = '111';
  const conv = (oid, price) => ({ capturedAt: new Date().toISOString(), payload: { conversation: { id: 'c' + oid, description: 'Paire', opposite_user: { id: 500 }, transaction: { item_id: '9' + oid },
    messages: [{ entity_type: 'offer_request_message', entity: { user_id: 500, current: true, status: 10, status_title: '', price: { amount: String(price) }, transaction_id: 7000 + oid, offer_request_id: oid } }] } } });
  const monter = ({ reglages, store = {}, presence = Date.now() - 60000, vinted } = {}) => {
    const lignes = { main: { capturedAt: new Date().toISOString(), vinted_offres_auto: true, vinted_annonce_numeros: { '91': { min: 10 } }, vinted_offres_garde: { v: 1, at: Date.now(), items: [], complet: true }, ...(reglages ? { vrm_securite_comptes: reglages } : {}) },
      [`harvest_${UID}_conv_1`]: conv(1, 50) };
    if (presence) store.vrmSecu = Object.assign({ presence: { vinted: presence } }, store.vrmSecu || {});
    // L'offre a déjà été vue (délai aléatoire passé) : elle est due.
    store.vrmOffresPrevues = { '1': { at: Date.now() - 1000, uid: UID, quoi: 'accept' } };
    return faireFond({ src: SRC_BG, lignes, store, vinted: vinted || ((r) => ({ status: 200, body: {} })) });
  };
  const accepts = (f) => f.j.vinted.filter((x) => /offer_requests\/1\/accept$/.test(x.chemin)).length;
  // Repos toute la journée (début = fin - 1 min : 24 h de repos moins 1 min, décalage 0).
  const p = S.secuParis(Date.now());
  const toujours = { plateformes: { vinted: { repos: { actif: true, debut: Math.floor((p.min + 2) % 1440), fin: Math.floor((p.min + 1) % 1440) }, varierMin: 0 } } };
  let f = monter({ reglages: toujours });
  if (typeof f.ctx.secuGeste !== 'function') { dit(false, 'E0 secuGeste existe dans background.js'); }
  try { await f.ctx.autoAccepterOffres(UID); } catch (_) {}
  dit(accepts(f) === 0, 'E1 repos en cours : le moteur d’offres n’accepte RIEN', accepts(f));
  f = monter({ reglages: { plateformes: { vinted: { repos: { actif: false } } } } });
  try { await f.ctx.autoAccepterOffres(UID); } catch (_) {}
  dit(accepts(f) === 1, 'E2 hors repos, lui présent : l’offre part (une fois)', accepts(f));
  f = monter({ reglages: { plateformes: { vinted: { repos: { actif: false } } } }, presence: Date.now() - 3 * 3600000 });
  try { await f.ctx.autoAccepterOffres(UID); } catch (_) {}
  dit(accepts(f) === 0, 'E3 onglet pas utilisé depuis 3 h : rien d’automatique', accepts(f));
  f = monter({ reglages: { plateformes: { vinted: { repos: { actif: false } } }, evts: [{ s: 'arret', at: Date.now() - 1000, par: 'app' }] } });
  try { await f.ctx.autoAccepterOffres(UID); } catch (_) {}
  dit(accepts(f) === 0, 'E4 « Tout arrêter » posé dans VRM : le moteur s’arrête', accepts(f));
  // Captcha DataDome sur un clic : le compte s'arrête, plus rien ne part, même un clic.
  f = monter({ reglages: { plateformes: { vinted: { repos: { actif: false } } } }, vinted: (r) => (/replies$/.test(r.chemin) ? { status: 403, body: { url: 'https://geo.captcha-delivery.com/captcha/?initialCid=abc' } } : { status: 200, body: {} }) });
  let r = null;
  try { r = await f.ctx.executerPourApp({ method: 'POST', endpoint: '/api/v2/conversations/55/replies', uid: UID, body: { message: 'Bonjour' } }, { origin: 'https://vrm.center' }); } catch (e) { r = { err: String(e) }; }
  const etat = (f.store.vrmSecu && f.store.vrmSecu.comptes && f.store.vrmSecu.comptes['vinted:' + UID]) || {};
  dit(!!etat.robot, 'E5 réponse DataDome (captcha) : le compte passe en « vérification »', { r, etat });
  const avant = f.j.vinted.length;
  let rb = null;
  try { rb = await f.ctx.executerPourApp({ method: 'POST', endpoint: '/api/v2/conversations/56/replies', uid: UID, body: { message: 'Re' } }, { origin: 'https://vrm.center' }); } catch (e) { rb = { err: String(e) }; }
  dit(f.j.vinted.length === avant && rb && rb.ok === false && /vérifie ton compte/.test(String(rb.error || '')), 'E6 après le contrôle anti-robot, AUCUNE nouvelle tentative (même un clic), et c’est dit', { rb, n: f.j.vinted.length - avant });
  try { await f.ctx.storeHarvest('www.vinted.fr', 'profile', UID, JSON.stringify({ user: { id: 111, login: 'x' } })); } catch (_) {}
  await new Promise((ok) => setTimeout(ok, 30));
  const etat2 = (f.store.vrmSecu.comptes['vinted:' + UID]) || {};
  dit(!etat2.robot && Number(etat2.prudence && etat2.prudence.jusqua) > Date.now(), 'E7 une lecture normale (sa page Vinted) lève l’arrêt ; une prudence le remplace', etat2);
  // Retry-After : le 429 qui demande 3 h ⇒ pause d'au moins 3 h (le palier dit 15 min) + prudence.
  f = monter({ reglages: { plateformes: { vinted: { repos: { actif: false } } } }, vinted: (q) => (/replies$/.test(q.chemin) ? { status: 429, body: {}, headers: { 'Retry-After': '10800' } } : { status: 200, body: {} }) });
  try { await f.ctx.executerPourApp({ method: 'POST', endpoint: '/api/v2/conversations/57/replies', uid: UID, body: { message: 'Re' } }, { origin: 'https://vrm.center' }); } catch (_) {}
  await new Promise((ok) => setTimeout(ok, 30));
  const pz = f.store.vrmPauseVinted || {};
  const pr = ((f.store.vrmSecu.comptes || {})['vinted:' + UID] || {}).prudence || {};
  dit(Number(pz.jusqua) - Date.now() > 2.9 * 3600000 && Number(pr.jusqua) - Date.now() > 2.9 * 3600000, 'E8 Retry-After 3 h respecté (pause ≥ 3 h, palier 15 min) et prudence sur ce compte', { pause: pz.jusqua && Math.round((pz.jusqua - Date.now()) / 60000), prudence: pr.jusqua && Math.round((pr.jusqua - Date.now()) / 60000) });
  // Le plafond horaire est inchangé.
  const bgTxt = fs.readFileSync(SRC_BG, 'utf8');
  dit(/const ACTIONS_MAX_HEURE = 50;/.test(bgTxt) && /const RESERVE_GESTES = 5;/.test(bgTxt) && /const LECTURES_MAX_HEURE = 20;/.test(bgTxt), 'E9 50 actions/h, réserve 5, 20 lectures/h : inchangés');
  // Vestiaire : répondre passe par la sécurité (contrôle anti-robot ⇒ rien ne part).
  f = monter({});
  f.store.vrmSecu = { comptes: { 'vestiaire:4242': { robot: { depuis: Date.now() - 1000 } } } };
  f.store.vcEnvoiRecette = undefined;
  let vc = null;
  try {
    f.ctx.ongletVestiaire = async () => ({ ok: true, compte: '4242', tabId: 9 });
    f.lignes['vc_fil_conv1'] = { compte: '4242' };
    f.store.vrmVcRecette = { recette: { rejouable: true } };
    vc = await f.ctx.repondreVestiaire({ conv: 'conv1', texte: 'Bonjour' });
  } catch (e) { vc = { err: String(e) }; }
  dit(vc && vc.accepte === false && /vérifie ton compte/.test(String(vc.raison || '')), 'E10 Vestiaire : après un contrôle anti-robot, « Envoyer sur Vestiaire » ne part plus, dit', vc);

  console.log(`\n${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ exception', e && e.stack); process.exit(1); });
