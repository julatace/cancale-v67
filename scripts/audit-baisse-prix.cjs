// ════════════════════════════════════════════════════════════════════════════
//  BAISSE DE PRIX EN SÉRIE (10 nov., lot C, extension 5.336) — EXÉCUTÉ
//
//  Le VRAI `baisserPrixVinted` de background.js tourne dans un vm (scripts/_fond-vm.cjs :
//  faux Vinted qui COMPTE chaque requête et combien sont en vol, fausse base à
//  état, `chrome.storage.local` à état). On exige :
//    A  tout prêt ⇒ GET (prix lu) → UN PUT (seul le prix change) → GET (relu) ;
//       « fait » avec le prix RELU ; tout part de la PAGE (aucun `Authorization`) ;
//    B  l'onglet sur un AUTRE compte ⇒ 0 requête, rien envoyé au nom d'un autre ;
//    C  plafond : 45 actions déjà dans l'heure (50 − réserve 5) ⇒ 0 requête ;
//       44 ⇒ elle part (la 45ᵉ) ; une baisse = UNE action comptée ;
//    D  un 429 ⇒ pause posée (`vrmPauseVinted`), rien de plus ; la suivante ⇒ 0 requête ;
//    E  relecture : Vinted montre un AUTRE prix ⇒ « écart » avec CE prix (jamais
//       le prix voulu) ; relecture ratée ⇒ « incertain », `prixVu` null ;
//    F  le prix sur Vinted n'est plus celui de l'aperçu ⇒ aucun PUT, prix lu dit ;
//    G  le modèle appris ne montre plus le même titre ⇒ aucun PUT ;
//    H  trois baisses lancées EN MÊME TEMPS ⇒ jamais deux requêtes en vol ;
//    I  sans confirmation · J  hausse · K  refus 422 ⇒ frein, la suivante n'envoie rien ;
//    L  une baisse arrêtée avant le PUT REND sa place dans l'heure ;
//    M  pas d'onglet Vinted ⇒ rien, place rendue.
//  Côté app, la règle PURE (src/baissePrix.js) : arrondi à l'euro, autre compte
//  bloqué (« Ouvre … sur Vinted »), sous le plancher ⇒ décochée, seul un prix RELU
//  s'affiche, la série s'arrête sur plafond/pause/frein/onglet.
//  `--prouve` : chaque mutation (dont « envoie pour un autre compte », « dépasse le
//  plafond », « prix supposé sans relecture ») doit faire rougir au moins un contrôle ;
//  et sur le background.js d'origin/main (sans `baisserPrixVinted`), A est rouge.
//  Aucune donnée réelle : tout est inventé (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const RACINE = path.join(__dirname, '..');
const BG = path.join(RACINE, 'vinted-sync-extension', 'background.js');
const REGLE = path.join(RACINE, 'src', 'baissePrix.js');

const ID = '91010001', UID = '111';
const MODELE = (titre = 'Nike Air Max 1 blanche') => JSON.stringify({ item: { id: Number(ID), title: titre, description: 'Très bon état', price: { amount: '60.0', currency_code: 'EUR' }, catalog_id: 1234, assigned_photos: [{ id: 501, orientation: 0 }, { id: 502, orientation: 0 }] } });
const LU = (prix, titre = 'Nike Air Max 1 blanche') => ({ item: { id: Number(ID), title: titre, description: 'Très bon état', price: { amount: String(prix), currency_code: 'EUR' }, photos: [{ id: 501 }, { id: 502 }] } });

function monter({ src, connecte = UID, comptes = null, actionsAvant = 0, lu = 60, relu = 'suivre', putStatus = 200, getStatus = 200, titreLu, modele = true, coffre = true, onglets } = {}) {
  const lignes = {};
  if (coffre) lignes[`coffre_${UID}_${ID}`] = { id: ID, photos: ['a', 'b'] };
  if (modele) lignes.vrm_vinted_modele = { [ID]: { corps: MODELE(), at: new Date().toISOString(), uid: UID } };
  const store = {};
  if (actionsAvant) { const t = Date.now() - 60000; store.vrmActions = { [UID]: Array.from({ length: actionsAvant }, (_, i) => t + i) }; }
  let prixVinted = lu, nGet = 0;
  const vinted = (e) => {
    if (e.methode === 'GET' && e.chemin === `/api/v2/item_upload/items/${ID}`) {
      nGet++;
      if (nGet === 1 && getStatus !== 200) return { status: getStatus, body: {} };
      if (nGet >= 2 && relu !== 'suivre') return relu === 'ko' ? { status: 500, body: {} } : { status: 200, body: LU(relu, titreLu) };
      return { status: 200, body: LU(prixVinted, titreLu) };
    }
    if (e.methode === 'PUT' && e.chemin === `/api/v2/item_upload/items/${ID}`) {
      if (putStatus !== 200) return { status: putStatus, body: { message: 'refus' } };
      try { const b = JSON.parse(e.corps); prixVinted = Number(b.item.price.amount); } catch (_) {}
      return { status: 200, body: {} };
    }
    return { status: 404, body: {} };
  };
  return faireFond({ src, lignes, store, vinted, connecte, comptes, ...(onglets ? { onglets } : {}) });
}
const puts = (j) => j.vinted.filter((v) => v.methode === 'PUT');
const appel = async (f, extra = {}) => {
  if (typeof f.ctx.baisserPrixVinted !== 'function') return { absent: true };
  try { return await f.ctx.baisserPrixVinted({ cmd: 'baisserPrixVinted', uid: UID, id: ID, prix: 54, prixAvant: 60, confirme: true, ...extra }); } catch (e) { return { erreur: String(e && e.message) }; }
};
const actions = (f) => ((f.store.vrmActions || {})[UID] || []).filter((x) => Date.now() - x < 3600000).length;

async function chargerRegle(src) {
  const f = path.join(os.tmpdir(), `baisse-regle-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

async function controles({ bgSrc, regleSrc }) {
  const res = [];
  const dit = (ok, m, d) => res.push({ ok: !!ok, m, d: d == null ? '' : String(d) });
  // ── A ──
  { const f = monter({ src: bgSrc }); const r = await appel(f);
    const p = puts(f.j);
    let prix = null, titre = null; try { const b = JSON.parse(p[0].corps); prix = b.item.price.amount; titre = b.item.title; } catch (_) {}
    dit(r.accepte === true && r.etape === 'fait' && r.prixVu === 54, 'A1 tout prêt : « fait » avec le prix RELU (54)', JSON.stringify(r));
    dit(p.length === 1 && prix === '54' && titre === 'Nike Air Max 1 blanche', 'A2 UN seul PUT, le prix baissé, le reste du corps appris inchangé', `puts=${p.length} prix=${prix}`);
    const ordre = f.j.vinted.map((v) => v.methode).join(',');
    dit(ordre === 'GET,PUT,GET', 'A3 lire le prix → modifier → RELIRE (dans cet ordre)', ordre);
    dit(f.j.vinted.every((v) => v.origine === 'page' && !Object.keys(v.entetes || {}).some((k) => /authorization/i.test(k))), 'A4 tout part de l’onglet vinted.fr, aucun `Authorization` (comme Republier)');
    dit(f.j.vinted.every((v) => !/delete|\/items\/?$/.test(v.chemin) || v.methode === 'GET'), 'A5 aucune suppression ni création');
    dit(actions(f) === 1, 'A6 une baisse = UNE action comptée dans l’heure du compte', actions(f)); }
  // ── B ──
  { const f = monter({ src: bgSrc, connecte: '999', comptes: [{ vinted_user_id: UID, login: 'compte_a', domain: 'www.vinted.fr', access_token: 'j' }] }); const r = await appel(f);
    dit(f.j.vinted.length === 0 && r.accepte === false && /autre/.test(r.code || ''), 'B1 onglet sur un AUTRE compte ⇒ 0 requête, rien envoyé au nom d’un autre', `req=${f.j.vinted.length} code=${r.code}`);
    dit(actions(f) === 0, 'B2 … et aucune action comptée', actions(f)); }
  // ── C ──
  { const f = monter({ src: bgSrc, actionsAvant: 45 }); const r = await appel(f);
    dit(f.j.vinted.length === 0 && r.accepte === false && /plafond/.test(r.code || ''), 'C1 45 actions dans l’heure (50 − réserve 5) ⇒ 0 requête, raison dite', `req=${f.j.vinted.length} code=${r.code} ${r.raison || ''}`); }
  { const f = monter({ src: bgSrc, actionsAvant: 44 }); const r = await appel(f);
    dit(r.etape === 'fait' && actions(f) === 45, 'C2 44 actions ⇒ la 45ᵉ part, puis le plafond de la série est atteint', `etape=${r.etape} actions=${actions(f)}`); }
  // ── D ──
  { const f = monter({ src: bgSrc, getStatus: 429 }); const r = await appel(f);
    const pause = f.store.vrmPauseVinted;
    dit(puts(f.j).length === 0 && pause && Number(pause.jusqua) > Date.now(), 'D1 un 429 de Vinted ⇒ pause posée, aucun PUT', `puts=${puts(f.j).length} pause=${JSON.stringify(pause)}`);
    const n0 = f.j.vinted.length; const r2 = await appel(f);
    dit(f.j.vinted.length === n0 && r2.accepte === false && /pause/.test(r2.code || ''), 'D2 pendant la pause, la baisse suivante n’envoie RIEN', `req=${f.j.vinted.length - n0} code=${r2.code}`);
    dit(actions(f) === 0, 'D3 les places réservées sont rendues (rien n’est parti)', actions(f)); }
  // ── E ──
  { const f = monter({ src: bgSrc, relu: 60 }); const r = await appel(f);
    dit(r.accepte === true && r.etape === 'ecart' && r.prixVu === 60, 'E1 Vinted montre un AUTRE prix ⇒ « écart » avec CE prix (jamais le prix voulu)', JSON.stringify(r)); }
  { const f = monter({ src: bgSrc, relu: 'ko' }); const r = await appel(f);
    dit(r.accepte === true && r.etape === 'incertain' && r.prixVu === null, 'E2 relecture ratée ⇒ « incertain », aucun prix supposé', JSON.stringify(r)); }
  // ── F ──
  { const f = monter({ src: bgSrc, lu: 58 }); const r = await appel(f);
    dit(puts(f.j).length === 0 && r.code === 'prix-change' && r.prixVu === 58, 'F1 le prix n’est plus celui de l’aperçu ⇒ aucun PUT, le prix lu est dit', JSON.stringify(r)); }
  // ── G ──
  { const f = monter({ src: bgSrc, titreLu: 'Nike Air Max 1 blanche — retouchée' }); const r = await appel(f);
    dit(puts(f.j).length === 0 && r.code === 'modele-ancien', 'G1 le modèle appris ne montre plus le même titre ⇒ aucun PUT (ses retouches ne sont pas effacées)', JSON.stringify(r)); }
  { const f = monter({ src: bgSrc, modele: false }); const r = await appel(f);
    dit(f.j.vinted.length === 0 && r.code === 'modele-absent', 'G2 format jamais appris ⇒ 0 requête, geste dit', r.code); }
  // ── H ──
  { const f = monter({ src: bgSrc });
    await Promise.all([appel(f), appel(f), appel(f)]);
    dit(f.j.maxEnVol === 1, 'H1 trois baisses lancées ensemble ⇒ jamais deux requêtes Vinted en vol', 'maxEnVol=' + f.j.maxEnVol);
    const ordre = f.j.vinted.map((v) => v.methode).join(',');
    dit(/^GET,PUT,GET/.test(ordre) && puts(f.j).length === 1, 'H2 … une par une : la 2ᵉ lit le nouveau prix (54 ≠ 60) et n’envoie rien', ordre); }
  // ── I, J ──
  { const f = monter({ src: bgSrc }); const r = await appel(f, { confirme: false });
    dit(f.j.vinted.length === 0 && r.code === 'confirmation', 'I1 sans son clic confirmé ⇒ rien', r.code); }
  { const f = monter({ src: bgSrc }); const r = await appel(f, { prix: 60 });
    dit(f.j.vinted.length === 0 && r.code === 'pas-une-baisse', 'J1 un prix qui ne baisse pas ⇒ rien', r.code); }
  // ── K ──
  { const f = monter({ src: bgSrc, putStatus: 422 }); const r = await appel(f);
    dit(r.etape === 'echec' && r.prixVu === 60, 'K1 Vinted refuse ⇒ « échec », le prix dit est celui LU (60)', JSON.stringify(r));
    const n0 = f.j.vinted.length; const r2 = await appel(f);
    dit(f.j.vinted.length === n0 && r2.code === 'frein-refus', 'K2 après un refus, le frein tient : la suivante n’envoie rien', `req=${f.j.vinted.length - n0} code=${r2.code}`); }
  // ── L, M ──
  { const f = monter({ src: bgSrc, lu: 58 }); await appel(f);
    dit(actions(f) === 0, 'L1 arrêtée avant le PUT ⇒ sa place dans l’heure est RENDUE', actions(f)); }
  { const f = monter({ src: bgSrc, onglets: [] }); const r = await appel(f);
    dit(f.j.vinted.length === 0 && r.code === 'onglet-vinted' && actions(f) === 0, 'M1 pas d’onglet vinted.fr ⇒ rien, place rendue', `${r.code} actions=${actions(f)}`); }
  // ── LE PONT : la commande arrive par le message de l'app (origine vrm.center) ──
  { const f = monter({ src: bgSrc });
    const r = await f.envoyer({ from: 'vmr-bridge', action: 'cmd', cmd: 'baisserPrixVinted', uid: UID, id: ID, prix: 54, prixAvant: 60, confirme: true });
    dit(r && r.etape === 'fait' && r.prixVu === 54, 'P1 la commande `baisserPrixVinted` de l’app est routée (origine vrm.center)', JSON.stringify(r)); }
  { const f = monter({ src: bgSrc });
    const r = await f.envoyer({ from: 'vmr-bridge', action: 'cmd', cmd: 'baisserPrixVinted', uid: UID, id: ID, prix: 54, prixAvant: 60, confirme: true }, { origin: 'https://cancale-v67.vercel.app', url: 'https://cancale-v67.vercel.app/' });
    dit(f.j.vinted.length === 0 && r && r.code === 'origine', 'P2 une autre origine que vrm.center ⇒ rien', JSON.stringify(r)); }

  // ── LA RÈGLE DE L'APP (pure) ──
  let R = null; try { R = await chargerRegle(regleSrc); } catch (e) { dit(false, 'R0 src/baissePrix.js se charge', e.message); }
  if (R && R.prixBaisse) {
    const b = (m, v) => R.baisseTapee(m, v);
    dit(R.prixBaisse(60, b('pct', '10')) === 54 && R.prixBaisse(59.9, b('eur', '5')) === 55 && R.prixBaisse(60, b('eur', '0,4')) === 59 && R.prixBaisse(3, b('eur', '5')) === null,
      'R1 arrondi à l’euro, toujours sous l’ancien prix, jamais sous 1 €', [R.prixBaisse(60, b('pct', '10')), R.prixBaisse(59.9, b('eur', '5')), R.prixBaisse(60, b('eur', '0,4')), R.prixBaisse(3, b('eur', '5'))].join(','));
    dit(!b('pct', '95').ok && !b('eur', '').ok && !b('eur', '-3').ok, 'R2 une baisse illisible, nulle ou au-delà de −90 % est refusée');
    const ann = [{ id: '1', uid: '111', compte: 'compte_a', prix: 60 }, { id: '2', uid: '222', compte: 'compte_b', prix: 80 }, { id: '3', uid: '111', compte: 'compte_a', prix: 40 }, { id: '4', uid: '111', compte: 'compte_a', prix: null }];
    const plancher = (a) => (a.id === '3' ? { etat: 'ok', plancher: 3800 } : a.id === '1' ? { etat: 'achat', plancher: null } : null);
    const L = R.lignesBaisse({ annonces: ann, baisse: b('eur', '5'), compteOnglet: '111', plancherDe: plancher });
    const l = Object.fromEntries(L.map((x) => [x.id, x]));
    dit(l['2'].bloque && /compte_b/.test(l['2'].bloque) && !l['2'].coche, 'R3 annonce d’un autre compte que l’onglet ⇒ « Ouvre compte_b sur Vinted », jamais cochée', l['2'].bloque);
    dit(l['3'].sousPlancher && !l['3'].coche && !l['3'].bloque, 'R4 sous le plancher (35 € < 38 €) ⇒ décochée par défaut (il peut la cocher)', JSON.stringify(l['3']));
    dit(l['1'].coche && l['1'].nouveau === 55 && !l['1'].plancher, 'R5 prix d’achat pas saisi ⇒ aucun plancher inventé, cochée', JSON.stringify(l['1']));
    dit(l['4'].bloque && !l['4'].coche, 'R6 prix pas lu ⇒ rien proposé', l['4'].bloque);
    const L2 = R.lignesBaisse({ annonces: ann, baisse: b('eur', '5'), compteOnglet: undefined, plancherDe: plancher });
    dit(L2.every((x) => !x.coche), 'R7 compte de l’onglet pas su ⇒ rien coché (pas su ≠ oui)');
    const i1 = R.issueBaisse({ accepte: true, etape: 'incertain', voulu: 54, prixVu: null });
    dit(i1.etat === 'incertain' && i1.prixVu === null, 'R8 envoyé pas relu ⇒ « incertain », aucun prix affiché (jamais le prix voulu)', JSON.stringify(i1));
    const i2 = R.issueBaisse({ accepte: true, etape: 'fait', prixVu: null, voulu: 54 });
    dit(i2.etat !== 'fait', 'R9 « fait » sans prix relu n’est pas « fait »', JSON.stringify(i2));
    dit(R.issueBaisse({ accepte: false, code: 'plafond-bordereaux' }).arret && R.issueBaisse({ accepte: false, code: 'vinted-pause' }).arret && R.issueBaisse({ accepte: false, code: 'frein-refus' }).arret && R.issueBaisse({ accepte: false, code: 'vinted-autre' }).arret && R.issueBaisse({ sansReponse: true }).arret,
      'R10 plafond, pause, frein, autre compte, pas de réponse ⇒ la série s’ARRÊTE');
    dit(!R.issueBaisse({ accepte: false, code: 'prix-change', prixVu: 58 }).arret && R.issueBaisse({ accepte: false, code: 'prix-change', prixVu: 58 }).prixVu === 58, 'R11 un refus propre à une annonce ⇒ la suivante continue, le prix lu est gardé');
  }
  return res;
}

const MUT_BG = {
  autre_compte: (s) => s.replace('const stop = await gardeStricte(uid, acc, { reserve: RESERVE_GESTES, recu });\n  if (stop) return { accepte: false, code: stop.code, actif: stop.actif, raison: stop.error };', 'const stop = null;')
    .replace("{ const s2 = await gardeStricte(uid, acc, { lecture: true }); if (s2) { await rendre(); return { accepte: false, code: s2.code, actif: s2.actif, raison: s2.error }; } }", ''),
  depasse_plafond: (s) => s.replace('const stop = await gardeStricte(uid, acc, { reserve: RESERVE_GESTES, recu });', 'const stop = await gardeStricte(uid, acc, { lecture: true, recu });'),
  sans_reserve: (s) => s.replace('const stop = await gardeStricte(uid, acc, { reserve: RESERVE_GESTES, recu });', 'const stop = await gardeStricte(uid, acc, { recu });'),
  prix_suppose: (s) => s.replace('const relue = rr && rr.ok ? annonceLueBaisse(rr.json) : null;', 'const relue = { prix: voulu / 100 };'),
  sans_lecture_avant: (s) => s.replace("if (centimesBaisse(lue.prix) !== avant) {", 'if (false) {'),
  pause_ignoree: (s) => s.replace('if (r && freinVinted(r.status)) await poserPauseVinted(r.status, quoi);', ''),
  place_gardee: (s) => s.replace("const rendre = async () => { if (recu.at) await rendreActions(uid, recu.at, 1); };", 'const rendre = async () => {};'),
  rafale: (s) => s.replace("  return await avecVinted(async () => {\n    // À SON TOUR dans la file", "  return await (async (fn) => fn())(async () => {\n    // À SON TOUR dans la file").replace("function requeteVinted(quoi, fn) {", "function requeteVinted(quoi, fn) { return (async () => { const r = await fn(); return r; })();"),
  modele_rejoue: (s) => s.replace('const juste = modeleEncoreJuste(modele.corps, lue);', 'const juste = { ok: true };'),
  frein_ignore: (s) => s.replace("{ const fr = await lireFreinRepub(uid); if (fr) { noterDiag('frein_repub_tenu_baisse');", "{ const fr = null; if (fr) { noterDiag('frein_repub_tenu_baisse');").replace("{ const fr = await lireFreinRepub(uid); if (fr) { await rendre(); return { accepte: false, code: 'frein-refus'", "{ const fr = null; if (fr) { await rendre(); return { accepte: false, code: 'frein-refus'"),
};
const MUT_REGLE = {
  autre_compte_coche: (s) => s.replace("else if (String(compteOnglet) !== uid) bloque = `Ouvre ${nom} sur Vinted`;", ''),
  plancher_coche: (s) => s.replace('coche: !bloque && nouveau != null && !sousPlancher', 'coche: !bloque && nouveau != null'),
  incertain_dit_fait: (s) => s.replace("return { etat: 'incertain', prixVu: null, raison: r.raison || 'Envoyé, pas relu", "return { etat: 'fait', prixVu: r.voulu, raison: r.raison || 'Envoyé, pas relu"),
  fait_sans_relu: (s) => s.replace("if (r.etape === 'fait' && vu != null)", "if (r.etape === 'fait')"),
  continue_apres_plafond: (s) => s.replace("'plafond', 'plafond-bordereaux', ", ''),
  arrondi_remonte: (s) => s.replace('if (n * 100 >= p) n = Math.ceil(p / 100) - 1;', ''),
  pas_su_vaut_oui: (s) => s.replace("else if (compteOnglet === undefined) bloque = 'VRM ne sait pas encore quel compte Vinted est ouvert';", 'else if (compteOnglet === undefined) {}'),
};

(async () => {
  const bgSrc = fs.readFileSync(BG, 'utf8'), regleSrc = fs.readFileSync(REGLE, 'utf8');
  const ecrire = (txt) => { const f = path.join(os.tmpdir(), `bg-baisse-${process.pid}-${Math.random().toString(36).slice(2)}.js`); fs.writeFileSync(f, txt); return f; };
  const bgFich = BG;
  const base = await controles({ bgSrc: bgFich, regleSrc });
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
      const r = await controles({ bgSrc: bgFich, regleSrc: muté });
      const rouges = r.filter((x) => !x.ok);
      if (rouges.length) tenues++; else ko++;
      console.log(`${rouges.length ? '✅' : '❌'} mutation règle ${nom} : ${rouges.length} rouge(s)${rouges.length ? ' — ' + rouges[0].m : ''}`);
    }
    // §6.1 : le code d'avant (origin/main) n'a pas la baisse — A doit être rouge.
    let avant = null;
    try { avant = cp.execSync('git show origin/main:vinted-sync-extension/background.js', { cwd: RACINE, maxBuffer: 64 * 1024 * 1024 }).toString(); } catch (_) { avant = null; }
    if (avant == null) console.log('— origin/main illisible ici : preuve sur le code d’avant non jouée (dit, pas conclu)');
    else if (/function baisserPrixVinted/.test(avant)) console.log('— origin/main porte déjà `baisserPrixVinted` (fusionné) : preuve d’avant sans objet');
    else {
      const f = ecrire(avant);
      const r = await controles({ bgSrc: f, regleSrc }); try { fs.unlinkSync(f); } catch (_) {}
      const rouges = r.filter((x) => !x.ok);
      console.log(`${rouges.length ? '✅' : '❌'} §6.1 sur le background.js d’origin/main : ${rouges.length} rouge(s)${rouges.length ? ' — ' + rouges[0].m : ''}`);
      if (!rouges.length) ko++;
    }
    console.log(`\n${tenues}/${Object.keys(MUT_BG).length + Object.keys(MUT_REGLE).length} mutations tenues`);
  }
  console.log(ko ? `\n❌ audit-baisse-prix : ${ko} rouge(s)` : `\n✅ audit-baisse-prix : ${base.length} contrôles — une baisse à la fois, au nom du compte de l’onglet, sous le plafond, prix relu`);
  process.exit(ko ? 1 : 0);
})();
