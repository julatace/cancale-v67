// ════════════════════════════════════════════════════════════════════════════
//  MODE VACANCES (10 nov., lot O, extension 5.338) — EXÉCUTÉ
//
//  Le VRAI background.js tourne dans un vm (scripts/_fond-vm.cjs : faux Vinted
//  qui COMPTE chaque requête et combien sont en vol, fausse base à état,
//  `chrome.storage.local` à état). Le geste de Vinted n'ayant jamais été vu, la
//  recette de ce banc est INVENTÉE (comme toute donnée ici : dépôt public).
//    A  appris, onglet sur le compte, ouvert ⇒ GET (état lu) → UN PUT (seul le
//       réglage change, `{moi}` = le n° de profil LU) → GET (relu) ; « fait » ;
//       tout part de la page (aucun `Authorization`) ; UNE action comptée ;
//       l'état relu est rangé (`vinted_vacances_etat`) ;
//    B  l'onglet sur un AUTRE compte ⇒ 0 requête, rien au nom d'un autre ;
//    C  plafond : 45 actions dans l'heure (50 − réserve 5) ⇒ 0 requête ; 44 ⇒ part ;
//    D  un 429 ⇒ pause posée, aucun PUT ; la suivante ⇒ 0 requête ; place rendue ;
//    E  relu autre chose ⇒ « écart » avec l'état LU ; relecture ratée ⇒
//       « incertain », aucun état supposé ;
//    F  déjà dans l'état voulu ⇒ aucun PUT, place rendue ;
//    G  sens jamais appris ⇒ 0 requête, « fais-le une fois à la main » ;
//    H  trois clics ensemble ⇒ jamais deux requêtes en vol, un seul PUT ;
//    I  sans confirmation ⇒ rien ; K refus 422 ⇒ « échec », l'état dit est le LU ;
//    M  pas d'onglet vinted.fr ⇒ rien, place rendue ; P le pont (origine vrm.center) ;
//    L  APPRENDRE sur SON geste : rejouable seulement sur `/users/{current|son n°}`,
//       un seul booléen, sans date ; 403, cadre, autre chemin, n° inconnu ⇒ rien appris.
//  Côté app, la règle PURE (src/modeVacances.js) : trois états, le plus frais
//  gagne, un seul compte part (celui de l'onglet), « pas su » ≠ oui, « fait »
//  seulement relu.
//  `--prouve` : chaque mutation doit faire rougir au moins un contrôle ; et sur le
//  background.js d'origin/main (sans `mettreVacancesVinted`), A est rouge.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const RACINE = path.join(__dirname, '..');
const BG = path.join(RACINE, 'vinted-sync-extension', 'background.js');
const REGLE = path.join(RACINE, 'src', 'modeVacances.js');

const UID = '111', PROFIL = 5550001;
const CHEMIN_APPRIS = '/api/v2/users/{moi}/settings';
const CORPS_APPRIS = JSON.stringify({ user_settings: { is_on_holiday: true, notifications: false } });
const RECETTE = (sens = ['on', 'off']) => ({ recettes: Object.fromEntries(sens.map((s) => [s, { methode: 'PUT', chemin: CHEMIN_APPRIS, corps: CORPS_APPRIS.replace('true', s === 'on' ? 'true' : 'false'), cle: ['user_settings', 'is_on_holiday'], at: new Date().toISOString(), uid: UID }])) });

function monter({ src, connecte = UID, comptes = null, actionsAvant = 0, etat = false, relu = 'suivre', putStatus = 200, getStatus = 200, recette = RECETTE(), onglets, profil = true } = {}) {
  const lignes = {};
  if (recette) lignes.vinted_vacances_recette = recette;
  if (profil) lignes[`harvest_${UID}_profile`] = { uid: UID, type: 'profile', payload: { code: 0, user: { id: PROFIL, is_on_holiday: false } }, capturedAt: new Date().toISOString() };
  const store = {};
  if (actionsAvant) { const t = Date.now() - 60000; store.vrmActions = { [UID]: Array.from({ length: actionsAvant }, (_, i) => t + i) }; }
  let etatVinted = etat, nGet = 0;
  const vinted = (e) => {
    if (e.methode === 'GET' && e.chemin === '/api/v2/users/current') {
      nGet++;
      if (nGet === 1 && getStatus !== 200) return { status: getStatus, body: {} };
      if (relu !== 'suivre' && nGet >= 2) return relu === 'ko' ? { status: 500, body: {} } : { status: 200, body: { code: 0, user: { id: PROFIL, is_on_holiday: relu } } };
      return { status: 200, body: { code: 0, user: { id: PROFIL, is_on_holiday: etatVinted } } };
    }
    if (e.methode === 'PUT' && e.chemin === `/api/v2/users/${PROFIL}/settings`) {
      if (putStatus !== 200) return { status: putStatus, body: { message: 'refus' } };
      try { etatVinted = JSON.parse(e.corps).user_settings.is_on_holiday; } catch (_) {}
      return { status: 200, body: {} };
    }
    return { status: 404, body: {} };
  };
  return faireFond({ src, lignes, store, vinted, connecte, comptes, ...(onglets ? { onglets } : {}) });
}
const puts = (j) => j.vinted.filter((v) => v.methode !== 'GET');
const appel = async (f, extra = {}) => {
  if (typeof f.ctx.mettreVacancesVinted !== 'function') return { absent: true };
  try { return await f.ctx.mettreVacancesVinted({ cmd: 'vacancesVinted', uid: UID, vacances: true, confirme: true, ...extra }); } catch (e) { return { erreur: String(e && e.message) }; }
};
const actions = (f) => ((f.store.vrmActions || {})[UID] || []).filter((x) => Date.now() - x < 3600000).length;
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const geste = async (f, extra = {}, sender = { tab: { id: 7, url: 'https://www.vinted.fr/settings' }, frameId: 0 }) => {
  await f.envoyer({ from: 'cancale-content', kind: 'vacances', domain: 'www.vinted.fr', methode: 'PUT', chemin: `/api/v2/users/${PROFIL}/settings`, corps: CORPS_APPRIS, status: 200, ...extra }, sender);
  for (let i = 0; i < 40; i++) { await attendre(10); if (f.lignes.vinted_vacances_recette) break; }
  await attendre(30);
};

async function chargerRegle(src) {
  const f = path.join(os.tmpdir(), `vacances-regle-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

async function controles({ bgSrc, regleSrc }) {
  const res = [];
  const dit = (ok, m, d) => res.push({ ok: !!ok, m, d: d == null ? '' : String(d) });
  // ── A ──
  { const f = monter({ src: bgSrc }); const r = await appel(f);
    const p = puts(f.j);
    let corps = null; try { corps = JSON.parse(p[0].corps); } catch (_) {}
    dit(r.accepte === true && r.etape === 'fait' && r.vacances === true, 'A1 appris, compte de l’onglet, ouvert ⇒ « fait », état RELU (en vacances)', JSON.stringify(r));
    dit(p.length === 1 && p[0].methode === 'PUT' && p[0].chemin === `/api/v2/users/${PROFIL}/settings` && corps && corps.user_settings.is_on_holiday === true && corps.user_settings.notifications === false,
      'A2 UN seul PUT : le chemin appris, `{moi}` = le n° de profil LU, seul le réglage vacances changé', p.map((x) => x.methode + ' ' + x.chemin + ' ' + x.corps).join(' | '));
    const ordre = f.j.vinted.map((v) => v.methode).join(',');
    dit(ordre === 'GET,PUT,GET', 'A3 lire l’état → poser → RELIRE (dans cet ordre)', ordre);
    dit(f.j.vinted.length > 0 && f.j.vinted.every((v) => v.origine === 'page' && !Object.keys(v.entetes || {}).some((k) => /authorization/i.test(k))), 'A4 tout part de l’onglet vinted.fr, aucun `Authorization`');
    dit(actions(f) === 1, 'A5 un compte mis en vacances = UNE action comptée dans l’heure', actions(f));
    const e = f.lignes.vinted_vacances_etat;
    dit(e && e.comptes && e.comptes[UID] && e.comptes[UID].vacances === true && e.comptes[UID].via === 'relu', 'A6 l’état RELU est rangé pour l’app (`vinted_vacances_etat`)', JSON.stringify(e)); }
  // ── B ──
  { const f = monter({ src: bgSrc, connecte: '999', comptes: [{ vinted_user_id: UID, login: 'compte_a', domain: 'www.vinted.fr', access_token: 'j' }] }); const r = await appel(f);
    dit(f.j.vinted.length === 0 && r.accepte === false && /autre/.test(r.code || ''), 'B1 onglet sur un AUTRE compte ⇒ 0 requête, rien au nom d’un autre', `req=${f.j.vinted.length} code=${r.code}`);
    dit(actions(f) === 0, 'B2 … et aucune action comptée', actions(f)); }
  // ── C ──
  { const f = monter({ src: bgSrc, actionsAvant: 45 }); const r = await appel(f);
    dit(f.j.vinted.length === 0 && r.accepte === false && /plafond/.test(r.code || ''), 'C1 45 actions dans l’heure (50 − réserve 5) ⇒ 0 requête, raison dite', `req=${f.j.vinted.length} code=${r.code}`); }
  { const f = monter({ src: bgSrc, actionsAvant: 44 }); const r = await appel(f);
    dit(r.etape === 'fait' && actions(f) === 45, 'C2 44 actions ⇒ la 45ᵉ part', `etape=${r.etape} actions=${actions(f)}`); }
  // ── D ──
  { const f = monter({ src: bgSrc, getStatus: 429 }); const r = await appel(f);
    const pause = f.store.vrmPauseVinted;
    dit(puts(f.j).length === 0 && pause && Number(pause.jusqua) > Date.now(), 'D1 un 429 de Vinted ⇒ pause posée, aucun PUT', `puts=${puts(f.j).length} pause=${JSON.stringify(pause)} r=${JSON.stringify(r)}`);
    const n0 = f.j.vinted.length; const r2 = await appel(f);
    dit(f.j.vinted.length === n0 && r2.accepte === false && /pause/.test(r2.code || ''), 'D2 pendant la pause, le clic suivant n’envoie RIEN', `req=${f.j.vinted.length - n0} code=${r2.code}`);
    dit(actions(f) === 0, 'D3 la place réservée est rendue (rien n’est parti)', actions(f)); }
  // ── E ──
  { const f = monter({ src: bgSrc, relu: false }); const r = await appel(f);
    dit(r.accepte === true && r.etape === 'ecart' && r.vacances === false, 'E1 Vinted montre toujours « ouvert » ⇒ « écart » avec CET état (jamais l’état voulu)', JSON.stringify(r)); }
  { const f = monter({ src: bgSrc, relu: 'ko' }); const r = await appel(f);
    dit(r.accepte === true && r.etape === 'incertain' && r.vacances === null, 'E2 relecture ratée ⇒ « incertain », aucun état supposé', JSON.stringify(r));
    dit(!(f.lignes.vinted_vacances_etat && f.lignes.vinted_vacances_etat.comptes && f.lignes.vinted_vacances_etat.comptes[UID]), 'E3 … et rien n’est rangé comme lu', JSON.stringify(f.lignes.vinted_vacances_etat)); }
  // ── F ──
  { const f = monter({ src: bgSrc, etat: true }); const r = await appel(f);
    dit(puts(f.j).length === 0 && r.etape === 'deja' && r.vacances === true && actions(f) === 0, 'F1 déjà en vacances (LU) ⇒ aucun PUT, place rendue', `${JSON.stringify(r)} actions=${actions(f)}`); }
  // ── G ──
  { const f = monter({ src: bgSrc, recette: RECETTE(['on']) }); const r = await appel(f, { vacances: false });
    dit(f.j.vinted.length === 0 && r.code === 'pas-appris' && /à la main/.test(r.raison || '') && actions(f) === 0, 'G1 « rouvrir » jamais appris ⇒ 0 requête, « une fois à la main »', JSON.stringify(r)); }
  { const f = monter({ src: bgSrc, recette: null }); const r = await appel(f);
    dit(f.j.vinted.length === 0 && r.code === 'pas-appris', 'G2 rien appris ⇒ 0 requête', r.code); }
  // ── H ──
  { const f = monter({ src: bgSrc });
    await Promise.all([appel(f), appel(f), appel(f)]);
    dit(f.j.maxEnVol === 1, 'H1 trois clics ensemble ⇒ jamais deux requêtes Vinted en vol', 'maxEnVol=' + f.j.maxEnVol);
    dit(puts(f.j).length === 1, 'H2 … une par une : les suivantes LISENT « en vacances » et n’envoient rien', f.j.vinted.map((v) => v.methode).join(',')); }
  // ── I, K ──
  { const f = monter({ src: bgSrc }); const r = await appel(f, { confirme: false });
    dit(f.j.vinted.length === 0 && r.code === 'confirmation', 'I1 sans son clic confirmé ⇒ rien', r.code); }
  { const f = monter({ src: bgSrc, putStatus: 422 }); const r = await appel(f);
    dit(r.etape === 'echec' && r.vacances === false, 'K1 Vinted refuse ⇒ « échec », l’état dit est celui LU (ouvert)', JSON.stringify(r)); }
  // ── M ──
  { const f = monter({ src: bgSrc, onglets: [] }); const r = await appel(f);
    dit(f.j.vinted.length === 0 && r.code === 'onglet-vinted' && actions(f) === 0, 'M1 pas d’onglet vinted.fr ⇒ rien, place rendue', `${r.code} actions=${actions(f)}`); }
  // ── P ──
  { const f = monter({ src: bgSrc });
    const r = await f.envoyer({ from: 'vmr-bridge', action: 'cmd', cmd: 'vacancesVinted', uid: UID, vacances: true, confirme: true });
    dit(r && r.etape === 'fait' && r.vacances === true, 'P1 la commande `vacancesVinted` de l’app est routée (origine vrm.center)', JSON.stringify(r)); }
  { const f = monter({ src: bgSrc });
    const r = await f.envoyer({ from: 'vmr-bridge', action: 'cmd', cmd: 'vacancesVinted', uid: UID, vacances: true, confirme: true }, { origin: 'https://exemple.vercel.app', url: 'https://exemple.vercel.app/' });
    dit(f.j.vinted.length === 0 && r && r.code === 'origine', 'P2 une autre origine que vrm.center ⇒ rien', JSON.stringify(r)); }
  // ── L : APPRENDRE SUR SON GESTE ──
  { const f = monter({ src: bgSrc, recette: null }); await geste(f);
    const rc = f.lignes.vinted_vacances_recette, on = rc && rc.recettes && rc.recettes.on;
    dit(on && on.chemin === CHEMIN_APPRIS && on.methode === 'PUT' && JSON.stringify(on.cle) === '["user_settings","is_on_holiday"]' && rc.dernier && rc.dernier.rejouable === true,
      'L1 son geste 2xx sur `/users/{son n°}/…` ⇒ recette « mettre en vacances » apprise, le n° devenu `{moi}`', JSON.stringify(rc));
    dit(f.j.vinted.length === 0, 'L2 apprendre n’envoie AUCUNE requête à Vinted', f.j.vinted.length);
    const e = f.lignes.vinted_vacances_etat;
    dit(e && e.comptes && e.comptes[UID] && e.comptes[UID].vacances === true && e.comptes[UID].via === 'geste', 'L3 son geste accepté est rangé comme état (via « geste »)', JSON.stringify(e));
    const r = await appel(f, { vacances: false });
    dit(r.code === 'pas-appris' && f.j.vinted.length === 0, 'L4 l’autre sens (rouvrir) n’est PAS déduit : pas appris', r.code);
    const r2 = await appel(f);
    dit(r2.etape === 'fait' && puts(f.j).length === 1, 'L5 la recette apprise se rejoue (sur son clic)', JSON.stringify(r2)); }
  { const f = monter({ src: bgSrc, recette: null }); await geste(f, { chemin: '/api/v2/items/123456/update' });
    const rc = f.lignes.vinted_vacances_recette;
    dit(rc && !(rc.recettes && rc.recettes.on) && rc.dernier && rc.dernier.rejouable === false && /profil/.test(rc.dernier.raison), 'L6 un autre chemin (annonce) ⇒ rien de rejouable, la raison est gardée', JSON.stringify(rc)); }
  { const f = monter({ src: bgSrc, recette: null }); await geste(f, { chemin: '/api/v2/users/42/settings' });
    const rc = f.lignes.vinted_vacances_recette;
    dit(rc && !(rc.recettes && rc.recettes.on) && /numéro/.test((rc.dernier || {}).raison || ''), 'L7 un n° qui n’est pas son profil ⇒ rien de rejouable', JSON.stringify(rc)); }
  { const f = monter({ src: bgSrc, recette: null }); await geste(f, { corps: JSON.stringify({ user_settings: { is_on_holiday: true, holiday_end: '2026-12-01' } }) });
    const rc = f.lignes.vinted_vacances_recette;
    dit(rc && !(rc.recettes && rc.recettes.on) && /date/.test((rc.dernier || {}).raison || ''), 'L8 un corps qui porte une date ⇒ rien de rejouable (elle serait fausse demain)', JSON.stringify(rc)); }
  { const f = monter({ src: bgSrc, recette: null }); await geste(f, { status: 403 });
    dit(!f.lignes.vinted_vacances_recette, 'L9 un geste refusé (403) n’apprend rien', JSON.stringify(f.lignes.vinted_vacances_recette)); }
  { const f = monter({ src: bgSrc, recette: null }); await geste(f, {}, { tab: { id: 7 }, frameId: 2 });
    dit(!f.lignes.vinted_vacances_recette, 'L10 un message d’un cadre (pas la page) n’apprend rien', JSON.stringify(f.lignes.vinted_vacances_recette)); }

  // ── LA PAGE (inject.js) : ce qui est transmis de SON geste ──
  { const src = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'inject.js'), 'utf8');
    const m = /  const noteVacances = \(method, url, status, corps\) => \{[\s\S]*?\n  \};\n/.exec(src);
    if (!m) dit(false, 'N0 inject.js porte `noteVacances`');
    else {
      const vus = [];
      const fn = require('vm').runInNewContext(`(${m[0].replace('  const noteVacances = ', '').replace(/;\n$/, '')})`, { post: (x) => vus.push(x), location: { origin: 'https://www.vinted.fr' }, URL });
      fn('PUT', '/api/v2/users/5550001/settings', 200, CORPS_APPRIS);
      fn('PUT', '/api/v2/users/5550001/settings', 403, CORPS_APPRIS);
      fn('PUT', '/api/v2/users/5550001/settings', 200, '{"user":{"login":"x"}}');
      fn('GET', '/api/v2/users/current', 200, CORPS_APPRIS);
      fn('PUT', 'https://exemple.com/api/v2/users/1', 200, CORPS_APPRIS);
      dit(vus.length === 1 && vus[0].kind === 'vacances' && vus[0].chemin === '/api/v2/users/5550001/settings' && vus[0].corps === CORPS_APPRIS && vus[0].status === 200,
        'N1 la page transmet seulement une écriture 2xx de vinted dont le corps parle de vacances (ni 403, ni lecture, ni autre corps, ni autre site)', JSON.stringify(vus));
    } }

  // ── LA RÈGLE DE L'APP (pure) ──
  let R = null; try { R = await chargerRegle(regleSrc); } catch (e) { dit(false, 'R0 src/modeVacances.js se charge', e.message); }
  if (R && R.lignesVacances) {
    const comptes = [{ vinted_user_id: '111', login: 'compte_a' }, { vinted_user_id: '222', login: 'compte_b' }, { vinted_user_id: '333', login: 'compte_c' }];
    const t0 = '2026-11-10T10:00:00.000Z', t1 = '2026-11-10T12:00:00.000Z';
    const profils = [{ id: 'harvest_111_profile', h: false, at: t0 }, { id: 'harvest_222_profile', h: true, at: t1 }, { id: 'harvest_333_profile', h: null, at: t0 }];
    const L = R.lignesVacances({ comptes, profils, etats: { 111: { vacances: true, at: t1, via: 'relu' }, 222: { vacances: false, at: t0, via: 'relu' } }, onglet: '111' });
    const l = Object.fromEntries(L.map((x) => [x.uid, x]));
    dit(l['111'].vacances === true && l['222'].vacances === true, 'R1 le plus FRAIS gagne (relu après le profil, profil après le relu)', JSON.stringify(L));
    dit(l['333'].vacances === null, 'R2 champ absent ⇒ « — » (pas su), jamais « ouvert »', JSON.stringify(l['333']));
    const L0 = R.lignesVacances({ comptes, profils: null, etats: null, onglet: '111' });
    dit(L0.every((x) => x.vacances === null), 'R3 lecture ratée ⇒ tous « — »', JSON.stringify(L0));
    const Lb = R.lignesVacances({ comptes, profils: [{ id: 'harvest_111_profile', h: false, at: t0 }, { id: 'harvest_222_profile', h: false, at: t0 }, { id: 'harvest_333_profile', h: false, at: t0 }], etats: {}, onglet: '111' });
    const p = R.planVacances(Lb, { voulu: true, onglet: '111', sait: true });
    dit(p.envoyer === '111' && p.actions.filter((a) => a.action === 'envoyer').length === 1 && p.actions.find((a) => a.uid === '222').action === 'ouvrir', 'R4 un clic ⇒ UN compte part (celui de l’onglet) ; les autres « Ouvre vinted.fr sur ce compte »', JSON.stringify(p));
    const pu = R.planVacances(Lb, { voulu: true, onglet: undefined, sait: true });
    dit(pu.envoyer === null && pu.actions.every((a) => a.action === 'passu'), 'R5 compte de l’onglet pas su ⇒ rien ne part (pas su ≠ oui)', JSON.stringify(pu));
    const pa = R.planVacances(Lb, { voulu: true, onglet: '111', sait: false });
    dit(pa.envoyer === null && pa.actions.find((a) => a.uid === '111').action === 'apprendre', 'R6 jamais appris ⇒ rien ne part, « fais-le une fois à la main »', JSON.stringify(pa));
    const ps = R.planVacances(Lb, { voulu: true, onglet: '111', sait: null });
    dit(ps.envoyer === null, 'R7 ce que VRM a appris pas lu ⇒ rien ne part', JSON.stringify(ps));
    dit(R.issueVacances({ accepte: true, etape: 'incertain', vacances: null }, true).vacances === null && R.issueVacances({ accepte: true, etape: 'fait', vacances: null }, true).etat !== 'fait',
      'R8 « fait » seulement avec l’état RELU ; incertain n’affiche aucun état');
    dit(R.issueVacances({ sansReponse: true }, true).etat === 'incertain', 'R9 pas de réponse à temps ⇒ « pas relu », jamais « échec » ni « fait »');
    dit(R.recetteSait(undefined, true) === null && R.recetteSait({ on: '/api/v2/users/{moi}/x', off: null }, false) === false, 'R10 recette : pas lue ⇒ null ; un sens jamais vu ⇒ false');
  }
  return res;
}

const MUT_BG = {
  autre_compte: (s) => s.replace("  const stop = await gardeStricte(uid, acc, { reserve: RESERVE_GESTES, recu });\n  if (stop) return { accepte: false, code: stop.code, actif: stop.actif, raison: stop.error };\n  const rendre = async () => { if (recu.at) await rendreActions(uid, recu.at, 1); };\n  return await avecVinted(async () => {\n    // À SON TOUR dans la file : le compte de l'onglet est relu.\n    { const s2 = await gardeStricte(uid, acc, { lecture: true }); if (s2) { await rendre(); return { accepte: false, code: s2.code, actif: s2.actif, raison: s2.error }; } }",
    "  const stop = null;\n  const rendre = async () => { if (recu.at) await rendreActions(uid, recu.at, 1); };\n  return await avecVinted(async () => {"),
  depasse_plafond: (s) => s.replace("const stop = await gardeStricte(uid, acc, { reserve: RESERVE_GESTES, recu });\n  if (stop) return { accepte: false, code: stop.code, actif: stop.actif, raison: stop.error };\n  const rendre = async () => { if (recu.at) await rendreActions(uid, recu.at, 1); };\n  return await avecVinted(async () => {\n    // À SON TOUR",
    "const stop = await gardeStricte(uid, acc, { lecture: true, recu });\n  if (stop) return { accepte: false, code: stop.code, actif: stop.actif, raison: stop.error };\n  const rendre = async () => { if (recu.at) await rendreActions(uid, recu.at, 1); };\n  return await avecVinted(async () => {\n    // À SON TOUR"),
  etat_suppose: (s) => s.replace("const apres = rr && rr.ok ? vacancesDuProfil(rr.json) : null;", 'const apres = voulu;'),
  sans_lecture_avant: (s) => s.replace("if (avant === voulu) { await rendre(); await noterEtatVacances(uid, avant, 'relu'); return { accepte: true, etape: 'deja', vacances: avant }; }", ''),
  place_gardee: (s) => s.replace("const rendre = async () => { if (recu.at) await rendreActions(uid, recu.at, 1); };\n  return await avecVinted(async () => {\n    // À SON TOUR dans la file : le compte de l'onglet est relu.", "const rendre = async () => {};\n  return await avecVinted(async () => {\n    // À SON TOUR dans la file : le compte de l'onglet est relu."),
  rafale: (s) => s.replace("  return await avecVinted(async () => {\n    // À SON TOUR dans la file : le compte de l'onglet est relu.", "  return await (async (fn) => fn())(async () => {\n    // À SON TOUR dans la file : le compte de l'onglet est relu.").replace("function requeteVinted(quoi, fn) {", "function requeteVinted(quoi, fn) { return (async () => { const r = await fn(); return r; })();"),
  sens_deduit: (s) => s.replace("select=${voulu ? 'r:data->recettes->on' : 'r:data->recettes->off'}", "select=r:data->recettes->on"),
  sans_confirmation: (s) => s.replace("if (msg.confirme !== true) return { accepte: false, code: 'confirmation', raison: 'le mode vacances demande ton clic — rien n’est parti' };", ''),
  chemin_libre: (s) => s.replace("if (!m) return { ...base, rejouable: false, raison: 'chemin hors du profil' };", "if (!m) return { rejouable: true, raison: '', methode: mt, chemin: String(chemin), corps, cle: ['user_settings', 'is_on_holiday'], valeur: true };"),
  numero_inconnu: (s) => s.replace("if (!profilId || m[1] !== String(profilId)) return { ...base, rejouable: false, raison: 'numéro inconnu dans le chemin' };", ''),
  date_acceptee: (s) => s.replace("else if (RE_DATE_VACANCES.test(v)) obstacles.push('une date');", ''),
  apprend_refus: (s) => s.replace("if (!(st >= 200 && st < 300)) return false;\n      const uid = await activeAccountId(domain);", "const uid = await activeAccountId(domain);"),
};
const MUT_REGLE = {
  plus_vieux_gagne: (s) => s.replace('if (p && e) return e.at >= p.at ? e : p;', 'if (p && e) return p;'),
  pas_su_vaut_ouvert: (s) => s.replace("return e || p || { vacances: null, at: 0, source: '' };", "return e || p || { vacances: false, at: 0, source: '' };"),
  autre_compte_part: (s) => s.replace("if (!onglet || String(onglet) !== l.uid) return 'ouvrir';", ''),
  onglet_pas_su_oui: (s) => s.replace("if (onglet === undefined) return 'passu';", "if (onglet === undefined) return 'envoyer';"),
  pas_appris_part: (s) => s.replace("return sait ? 'envoyer' : 'apprendre';", "return 'envoyer';"),
  fait_sans_relu: (s) => s.replace("if ((r.etape === 'fait' || r.etape === 'deja') && v === voulu)", "if (r.etape === 'fait' || r.etape === 'deja')"),
};

(async () => {
  const bgSrc = fs.readFileSync(BG, 'utf8'), regleSrc = fs.readFileSync(REGLE, 'utf8');
  const ecrire = (txt) => { const f = path.join(os.tmpdir(), `bg-vacances-${process.pid}-${Math.random().toString(36).slice(2)}.js`); fs.writeFileSync(f, txt); return f; };
  const base = await controles({ bgSrc: BG, regleSrc });
  let ko = 0;
  for (const c of base) { if (!c.ok) ko++; console.log((c.ok ? '✅ ' : '❌ ') + c.m + (c.ok || !c.d ? '' : '  → ' + c.d)); }
  if (process.argv.includes('--prouve')) {
    console.log('\n── preuve : mutations (chacune doit faire rougir au moins un contrôle) ──');
    let tenues = 0;
    for (const [nom, m] of Object.entries(MUT_BG)) {
      const muté = m(bgSrc);
      if (muté === bgSrc) { console.log(`❌ mutation ${nom} : le texte visé est introuvable`); ko++; continue; }
      const f = ecrire(muté);
      const r = await controles({ bgSrc: f, regleSrc }); try { fs.unlinkSync(f); } catch (_) {}
      const rouges = r.filter((x) => !x.ok);
      if (rouges.length) tenues++; else ko++;
      console.log(`${rouges.length ? '✅' : '❌'} mutation extension ${nom} : ${rouges.length} rouge(s)${rouges.length ? ' — ' + rouges[0].m : ''}`);
    }
    for (const [nom, m] of Object.entries(MUT_REGLE)) {
      const muté = m(regleSrc);
      if (muté === regleSrc) { console.log(`❌ mutation ${nom} : le texte visé est introuvable`); ko++; continue; }
      const r = await controles({ bgSrc: BG, regleSrc: muté });
      const rouges = r.filter((x) => !x.ok);
      if (rouges.length) tenues++; else ko++;
      console.log(`${rouges.length ? '✅' : '❌'} mutation règle ${nom} : ${rouges.length} rouge(s)${rouges.length ? ' — ' + rouges[0].m : ''}`);
    }
    let avant = null;
    try { avant = cp.execSync('git show origin/main:vinted-sync-extension/background.js', { cwd: RACINE, maxBuffer: 64 * 1024 * 1024 }).toString(); } catch (_) { avant = null; }
    if (avant == null) console.log('— origin/main illisible ici : preuve sur le code d’avant non jouée (dit, pas conclu)');
    else if (/function mettreVacancesVinted/.test(avant)) console.log('— origin/main porte déjà `mettreVacancesVinted` (fusionné) : preuve d’avant sans objet');
    else {
      const f = ecrire(avant);
      const r = await controles({ bgSrc: f, regleSrc }); try { fs.unlinkSync(f); } catch (_) {}
      const rouges = r.filter((x) => !x.ok);
      console.log(`${rouges.length ? '✅' : '❌'} §6.1 sur le background.js d’origin/main : ${rouges.length} rouge(s)${rouges.length ? ' — ' + rouges[0].m : ''}`);
      if (!rouges.length) ko++;
    }
    console.log(`\n${tenues}/${Object.keys(MUT_BG).length + Object.keys(MUT_REGLE).length} mutations tenues`);
  }
  console.log(ko ? `\n❌ audit-mode-vacances : ${ko} rouge(s)` : `\n✅ audit-mode-vacances : ${base.length} contrôles — un compte à la fois, celui de l’onglet, sous le plafond, recette apprise sur son geste, état relu`);
  process.exit(ko ? 1 : 0);
})();
