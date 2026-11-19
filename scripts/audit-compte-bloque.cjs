#!/usr/bin/env node
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
// ════════════════════════════════════════════════════════════════════════════
//  audit-compte-bloque — « VINTED A BLOQUÉ {COMPTE} » (19 nov., ext. 5.409)
//  node scripts/audit-compte-bloque.cjs [--recopie] [--mutation] [--src <bg.js>]
//
//  R. la règle (src/compteBloque.js) : la question, la pause, « plus tard » qui
//     revient, l'épisode, « remis » seulement après SA pause, pas su ⇒ rien ;
//     la notification une fois par blocage / par remise.
//  C. le bloc de l'extension est la COPIE exacte du bloc de src (`--recopie` le refait).
//  E. le VRAI background.js, dans un vm (scripts/_fond-vm.cjs), sur des réponses
//     Vinted INVENTÉES de la vraie forme (`/api/v2/users/current` → { user: {
//     is_account_banned, account_status, … } }) :
//       E1 bloqué : profil `is_account_banned: true` ⇒ « banni » + `depuis`, la route
//          `/api/push {action:'comptebloque'}` appelée ;
//       E2 un 403 SEUL (frein de republication) ⇒ jamais « banni », aucune pause ;
//       E3 absence : profil sans le champ, profil illisible ⇒ le verdict d'avant reste ;
//       E4 en pause (SON choix) : `garde`, `secuGeste` (auto, série), `gardeStricte`
//          (série) refusent « compte-bloque » ; un CLIC passe ; Leboncoin / Vestiaire
//          jamais ; « garder » ⇒ rien n'est refusé ;
//       E5 débloqué : profil `false` ⇒ « actif », nouvel épisode, la pause tombe
//          d'elle-même, la route rappelée ;
//       E6 base muette : jamais lu ⇒ pas de pause ; déjà lu ⇒ le dernier lu.
//  `--mutation` : chaque mutation (de la règle, du fond) doit rougir un contrôle,
//  et le background.js d'origin/main (sans la pause) doit rougir E.
//  Aucune donnée réelle : tout est inventé (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const REGLE = path.join(RACINE, 'src', 'compteBloque.js');
const BG = path.join(RACINE, 'vinted-sync-extension', 'background.js');
const DEBUT = '// <compte-bloque-regle>', FIN = '// </compte-bloque-regle>';
const argv = process.argv.slice(2);
const bloc = (txt) => { const a = txt.indexOf(DEBUT), b = txt.indexOf(FIN); return a >= 0 && b > a ? txt.slice(a, b + FIN.length) : null; };

if (argv.includes('--recopie')) {
  const s = bloc(fs.readFileSync(REGLE, 'utf8')); const bg = fs.readFileSync(BG, 'utf8'); const b = bloc(bg);
  if (!s || !b) { console.error('balises introuvables'); process.exit(1); }
  fs.writeFileSync(BG, bg.replace(b, s)); console.log('✓ bloc recopié dans background.js'); process.exit(0);
}

let ok = 0, ko = 0;
const muet = () => !!process.env.AUDIT_MUET;
const dit = (c, m, d) => { if (c) ok++; else ko++; if (!muet()) console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + String(d).slice(0, 300) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String((e && e.stack) || e).split('\n').slice(0, 3).join(' ')); } };
const H = 3600e3;
const iso = (t) => new Date(t).toISOString();

async function regle(fichier) {
  if (!muet()) console.log('\nR · la règle (src/compteBloque.js)');
  // Une copie dans un dossier à part (import ESM d'un fichier muté).
  const R = await import(pathToFileURL(fichier).href + '?v=' + Math.random());
  const T = Date.now();
  const banni = { etat: 'banni', at: iso(T - H), preuve: 'champ profil is_account_banned', depuis: iso(T - 2 * H) };
  const actif = { etat: 'actif', at: iso(T), preuve: 'champ profil is_account_banned', depuis: iso(T) };
  dit(R.cbPhase(undefined, undefined, T) === 'passu' && R.cbPhase(undefined, { etat: 'passu' }, T) === 'passu', 'R1 rien de lu ⇒ rien (pas su ne vaut pas « bloqué »)');
  dit(R.cbPhase(undefined, banni, T) === 'question', 'R2 bloqué, aucun choix ⇒ LA question');
  const p = R.choixPose('pause', banni, 3, T - 30 * 60e3);
  dit(p && p.episode === banni.depuis && p.n === 3, 'R3 son choix garde l’épisode et le nombre', JSON.stringify(p));
  dit(R.cbPhase(p, banni, T) === 'pause' && R.cbEnPause(p, banni) === true, 'R3b « pause » ⇒ en pause tant que bloqué');
  dit(R.cbEnPause(p, undefined) === false && R.cbEnPause(p, { etat: 'passu' }) === false, 'R3c état pas su ⇒ PAS en pause (rien retiré sur un doute)');
  const g = R.choixPose('garder', banni, 3, T);
  dit(R.cbPhase(g, banni, T) === 'garder' && R.cbEnPause(g, banni) === false, 'R4 « garder » ⇒ pas en pause, plus de question');
  const pt = R.choixPose('plus_tard', banni, 3, T - 2 * H);
  dit(R.cbPhase(pt, banni, T) === 'plus_tard' && R.cbPhase(pt, banni, T + 23 * H) === 'question', 'R5 « plus tard » ⇒ la question revient après 24 h');
  dit(R.cbPhase(p, { ...banni, depuis: iso(T + H) }, T + 2 * H) === 'question' && R.cbEnPause(p, { ...banni, depuis: iso(T + H) }) === false, 'R6 nouveau blocage (autre épisode) ⇒ nouvelle question, l’ancien choix ne vaut plus');
  dit(R.cbPhase(p, actif, T) === 'remis' && R.cbEnPause(p, actif) === false, 'R7 débloqué (actif lu) après SA pause ⇒ « remis », la pause tombe');
  dit(R.cbPhase(g, actif, T) === 'normal', 'R7b débloqué après « garder » ⇒ rien à dire');
  const clos = R.choixClos(p, T + 1);
  dit(R.cbPhase(clos, actif, T + 2) === 'normal' && R.cbPhase(clos, { etat: 'banni', at: iso(T + 3 * H) }, T + 3 * H) === 'question', 'R8 « OK » lu ⇒ clos ; un blocage plus tard (même sans `depuis`) redemande');
  dit(R.cbPhase(R.choixPose('pause', { etat: 'banni', at: iso(T - H) }, 2, T - 30 * 60e3), { etat: 'banni', at: iso(T) }, T) === 'pause', 'R9 extension d’avant (sans `depuis`) : le choix vaut pour le blocage en cours');
  const cartes = R.cartesComptesBloques({ choix: {}, etats: { 111: banni, 222: actif, 333: banni }, comptes: [{ vinted_user_id: 111 }, { vinted_user_id: 222 }], annonces: { 111: 7 }, maintenant: T });
  dit(cartes.length === 1 && cartes[0].uid === '111' && cartes[0].n === 7, 'R10 une carte par compte lié bloqué (un compte retiré, jamais)', JSON.stringify(cartes));
  dit(R.uidsEnPause({ 111: p }, { 111: banni, 222: actif }).size === 1 && R.uidsBloques({ 111: banni, 222: actif }).has('111'), 'R11 les ensembles « en pause » et « bloqués »');
  // La notification
  const n1 = R.aNotifierComptesBloques({ etats: { 111: banni }, choix: {}, uids: new Set(['111']), cles: {} });
  dit(n1.out.length === 1 && n1.out[0].sorte === 'bloque', 'R12 bloqué ⇒ UNE notification', JSON.stringify(n1));
  const cles = Object.fromEntries(n1.out.map((e) => [e.cle, T]));
  dit(R.aNotifierComptesBloques({ etats: { 111: banni }, choix: {}, uids: ['111'], cles }).out.length === 0, 'R12b déjà notifié ⇒ rien');
  dit(R.aNotifierComptesBloques({ etats: { 111: banni }, choix: {}, uids: ['999'], cles: {} }).out.length === 0, 'R12c compte qui n’est pas le sien / retiré ⇒ rien');
  const n2 = R.aNotifierComptesBloques({ etats: { 111: actif }, choix: { 111: p }, uids: ['111'], cles });
  dit(n2.out.length === 1 && n2.out[0].sorte === 'remis' && n2.out[0].n === 3, 'R13 débloqué après sa pause ⇒ « N annonces remises »', JSON.stringify(n2));
  const n3 = R.aNotifierComptesBloques({ etats: { 111: actif }, choix: {}, uids: ['111'], cles: { 'b:111:x': T } });
  dit(n3.oublier.includes('b:111:x'), 'R14 actif lu ⇒ l’ancienne marque sans épisode est oubliée (un nouveau blocage sonnera)');
  const tx = R.texteNotifComptesBloques(n1.out, () => 'shop_a');
  dit(/Vinted a bloqué shop_a/.test(tx.title) && tx.title.length <= 40 && tx.body.length <= 90, 'R15 le texte « Vinted a bloqué shop_a »', JSON.stringify(tx));
  const tr = R.texteNotifComptesBloques(n2.out, () => 'shop_a');
  dit(/shop_a est débloqué/.test(tr.title) && /3 annonces remises/.test(tr.body), 'R15b « shop_a est débloqué · 3 annonces remises »', JSON.stringify(tr));
}

function copie() {
  if (!muet()) console.log('\nC · la copie dans l’extension');
  const a = bloc(fs.readFileSync(REGLE, 'utf8')), b = bloc(fs.readFileSync(BG, 'utf8'));
  dit(!!a && a === b, 'C1 le bloc <compte-bloque-regle> de background.js est la copie exacte de src/compteBloque.js');
}

async function extension(src) {
  if (!muet()) console.log('\nE · le vrai background.js (vm)');
  const { faireFond } = require('./_fond-vm.cjs');
  const UID = '111';
  // La vraie forme de `/api/v2/users/current` (champs mesurés sur sa base, valeurs inventées).
  const profil = (banni) => ({ user: { id: 5, login: 'shop_a', is_account_banned: banni, account_status: banni ? 8 : 0, account_ban_date: null, is_on_holiday: false, is_deleted: false, action_restriction: null, soft_restricted_by_terms: false } });
  const monter = (x = {}) => faireFond({ src, connecte: UID, vrm: () => ({ status: 200, body: { ok: true, envoye: true } }), ...x });
  const pushs = (f) => f.j.vrmApi.filter((e) => /\/api\/push$/.test(e.url) && e.corps && e.corps.action === 'comptebloque');
  const etat = (f) => ((f.lignes.panel_comptes_etat || {}).comptes || {})[UID] || null;
  const oublier = async (f) => { await f.ctx.chrome.storage.local.remove('vrmPauseBloque'); };
  const refus = (r) => !!(r && r.code === 'compte-bloque');
  const attendre = () => new Promise((r) => setTimeout(r, 30));
  let fonds = null;
  await essaie('E1', async () => {
    const f = monter({ lignes: { panel_comptes_etat: { comptes: { [UID]: { etat: 'actif', at: iso(Date.now() - 5 * H), preuve: 'champ profil is_account_banned' } } } } });
    fonds = f;
    await f.ctx.noterEtatCompte(UID, profil(true));
    await attendre();
    const e = etat(f);
    dit(!!e && e.etat === 'banni' && typeof e.depuis === 'string' && Date.parse(e.depuis) > Date.now() - 60e3, 'E1 profil `is_account_banned: true` ⇒ « banni », daté `depuis`', JSON.stringify(e));
    dit(pushs(f).length === 1, 'E1b la route /api/push {action:"comptebloque"} appelée (le serveur relit tout)', JSON.stringify(f.j.vrmApi.map((x) => x.url)));
    dit(f.j.vinted.length === 0, 'E1c aucune requête Vinted de plus', String(f.j.vinted.length));
    // Sans SON choix : aucune pause (VRM demande, ne décide pas).
    dit(!refus(await f.ctx.garde(UID, { domain: 'www.vinted.fr' })), 'E1d bloqué SANS son choix ⇒ aucune pause posée par VRM');
  });
  await essaie('E2', async () => {
    const f = monter({ lignes: { panel_comptes_etat: { comptes: { [UID]: { etat: 'actif', at: iso(Date.now() - 5 * H), preuve: 'champ profil is_account_banned' } } }, main: { vrm_comptes_bloques: { [UID]: { choix: 'pause', at: iso(Date.now() - H), episode: null, n: 3 } } } } });
    // Le corps d'un refus 403 de Vinted (forme d'un refus : code + message_code), au frein, à la capture, au profil.
    const refus403 = { code: 106, message: 'Access denied', message_code: 'access_denied' };
    if (typeof f.ctx.poserFreinRepub === 'function') await f.ctx.poserFreinRepub(UID, { status: 403, json: refus403 });
    if (typeof f.ctx.storeHarvest === 'function') await f.ctx.storeHarvest('www.vinted.fr', 'profile', 'users_current', JSON.stringify(refus403), 'https://www.vinted.fr/api/v2/users/current', null, 'GET', 403).catch(() => {});
    await f.ctx.noterEtatCompte(UID, refus403);
    await attendre();
    const e = etat(f);
    dit(!!e && e.etat === 'actif', 'E2 un 403 SEUL ⇒ jamais « banni »', JSON.stringify(e));
    dit(!refus(await f.ctx.garde(UID, { domain: 'www.vinted.fr' })) && pushs(f).length === 0, 'E2b … ni pause, ni notification');
  });
  await essaie('E3', async () => {
    const f = monter({ lignes: { panel_comptes_etat: { comptes: { [UID]: { etat: 'actif', at: iso(Date.now() - 5 * H), preuve: 'champ profil is_account_banned' } } } } });
    await f.ctx.noterEtatCompte(UID, { user: { id: 5, login: 'shop_a' } });       // champ absent
    await f.ctx.noterEtatCompte(UID, { erreur: 'page' });                          // illisible
    await attendre();
    const e = etat(f);
    dit(!!e && e.etat === 'actif' && pushs(f).length === 0, 'E3 champ absent / profil illisible ⇒ le verdict d’avant reste, rien envoyé', JSON.stringify(e));
  });
  await essaie('E4', async () => {
    const f = fonds; if (!f) throw new Error('E1 n’a pas monté');
    const e = etat(f);
    f.lignes.main = { vrm_comptes_bloques: { [UID]: { choix: 'pause', at: iso(Date.now()), episode: e && e.depuis, n: 3 } } };
    await oublier(f);
    const g = await f.ctx.garde(UID, { domain: 'www.vinted.fr' });
    dit(refus(g) && /bloqué/.test(g.error || ''), 'E4 en pause (SON choix) : `garde` (gestes automatiques) refuse et le DIT', JSON.stringify(g));
    dit(refus(await f.ctx.secuGeste('vinted', UID, 'offre', 'auto')), 'E4b offre automatique refusée (`secuGeste` mode auto)');
    dit(refus(await f.ctx.secuGeste('vinted', UID, 'baisse', 'serie')), 'E4c baisse en série refusée');
    dit(refus(await f.ctx.gardeStricte(UID, { domain: 'www.vinted.fr' }, { sorte: 'favori' })), 'E4d favoris en série refusés (`gardeStricte` sorte)');
    dit(!refus(await f.ctx.secuGeste('vinted', UID, 'reponse', 'clic')), 'E4e un CLIC passe (répondre à un acheteur)');
    dit(!refus(await f.ctx.secuGeste('leboncoin', UID, 'baisse', 'serie')) && !refus(await f.ctx.secuGeste('vestiaire', UID, 'baisse', 'serie')), 'E4f Leboncoin et Vestiaire ne bougent pas');
    dit(!refus(await f.ctx.garde('222', { domain: 'www.vinted.fr' })), 'E4g un AUTRE compte n’est pas en pause');
    f.lignes.main = { vrm_comptes_bloques: { [UID]: { choix: 'garder', at: iso(Date.now()), episode: e && e.depuis, n: 3 } } };
    await oublier(f);
    dit(!refus(await f.ctx.garde(UID, { domain: 'www.vinted.fr' })), 'E4h « garder » ⇒ rien n’est refusé');
    f.lignes.main = { vrm_comptes_bloques: { [UID]: { choix: 'pause', at: iso(Date.now()), episode: e && e.depuis, n: 3 } } };
    await oublier(f);
  });
  await essaie('E5', async () => {
    const f = fonds; if (!f) throw new Error('E1 n’a pas monté');
    const avant = etat(f);
    const n0 = pushs(f).length;
    dit(refus(await f.ctx.garde(UID, { domain: 'www.vinted.fr' })), 'E5 (avant) en pause');
    await f.ctx.noterEtatCompte(UID, profil(false));
    await attendre();
    const e = etat(f);
    dit(!!e && e.etat === 'actif' && e.depuis && avant && e.depuis !== avant.depuis, 'E5b profil `false` ⇒ « actif », nouvel épisode', JSON.stringify(e));
    dit(!refus(await f.ctx.garde(UID, { domain: 'www.vinted.fr' })), 'E5c débloqué ⇒ la pause tombe d’elle-même (mémoire relue au changement)');
    dit(pushs(f).length === n0 + 1, 'E5d la route rappelée (« … est débloqué »)');
  });
  await essaie('E6', async () => {
    let casse = true;
    const lignes = { panel_comptes_etat: { comptes: { [UID]: { etat: 'banni', at: iso(Date.now()), depuis: iso(Date.now() - H) } } }, main: { vrm_comptes_bloques: { [UID]: { choix: 'pause', at: iso(Date.now()), episode: iso(Date.now() - H), n: 1 } } } };
    const f = monter({ lignes, lectureKO: (u) => casse && /id=eq\.main/.test(String(u)) });
    dit(!refus(await f.ctx.garde(UID, { domain: 'www.vinted.fr' })), 'E6 base muette, jamais lu ⇒ pas de pause (pas su ne retire rien)');
    casse = false; await oublier(f);
    dit(refus(await f.ctx.garde(UID, { domain: 'www.vinted.fr' })), 'E6b lu ⇒ en pause');
    casse = true;
    const st = await f.ctx.chrome.storage.local.get('vrmPauseBloque');
    if (st.vrmPauseBloque) { st.vrmPauseBloque.at = Date.now() - 10 * 60e3; await f.ctx.chrome.storage.local.set(st); }
    dit(refus(await f.ctx.garde(UID, { domain: 'www.vinted.fr' })), 'E6c base muette après une lecture ⇒ le dernier lu');
  });
}

// ── S. LA ROUTE /api/push, action « comptebloque », EXÉCUTÉE (§4.10) ─────────
async function serveur() {
  if (!muet()) console.log('\nS · la route /api/push, action « comptebloque », exécutée');
  const OWNER = '11111111-2222-3333-4444-555555555555';
  process.env.SUPABASE_URL = 'https://banc.supabase.test';
  process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
  process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
  const webpush = require(path.join(RACINE, 'node_modules', 'web-push'));
  const pushes = [];
  webpush.setVapidDetails = () => {};
  webpush.sendNotification = async (sub, body) => { pushes.push(JSON.parse(body)); return { statusCode: 201 }; };
  const { servirTable } = await import('file://' + path.join(RACINE, 'src', 'exempleBase.js'));
  let tables, casse = false;
  const ligne = (id, data) => ({ id, owner: OWNER, data, updated_at: new Date().toISOString() });
  const compte = (uid, login) => ({ id: Number(uid), vinted_user_id: String(uid), login, domain: 'www.vinted.fr', owner: OWNER, updated_at: new Date().toISOString() });
  const remettre = (rows, comptes) => { tables = { app_data: { lignes: rows }, vinted_accounts: { lignes: comptes } }; pushes.length = 0; casse = false; };
  const lectures = [];
  const fetchAvant = global.fetch;
  global.fetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    const rep = (b, st = 200) => new Response(typeof b === 'string' ? b : JSON.stringify(b), { status: st, headers: { 'content-type': 'application/json' } });
    if (u.pathname === '/auth/v1/user') return rep({ id: OWNER, email: 'vendeuse@exemple.test', created_at: '2025-01-10T10:00:00Z' });
    if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
    lectures.push(decodeURIComponent(u.search));
    if (casse && /panel_comptes_etat/.test(decodeURIComponent(u.search))) return rep('<html>522</html>', 522);
    const t = u.pathname.replace('/rest/v1/', '');
    if (!tables[t]) return rep([]);
    let corps = null; try { corps = opts.body ? JSON.parse(opts.body) : null; } catch (_) {}
    const pref = String((opts.headers || {}).Prefer || (opts.headers || {}).prefer || '');
    if ((opts.method || '').toUpperCase() === 'POST' && /ignore-duplicates/.test(pref) && Array.isArray(corps) && corps.every((l) => tables[t].lignes.some((x) => x.id === l.id))) return rep([], 201);
    const x = servirTable(tables[t], { methode: (opts.method || 'GET').toUpperCase(), url: u.pathname + u.search, entetes: opts.headers || {}, corps, owner: OWNER });
    return new Response(x.status === 204 || x.body == null ? null : JSON.stringify(x.body), { status: x.status, headers: x.headers });
  };
  try {
    const { default: handler } = await import('file://' + path.join(RACINE, 'api', 'push.js'));
    const appel = async () => {
      let st = 0, js = null;
      const res = { status(c) { st = c; return this; }, json(j) { js = j; return this; }, setHeader() {}, end() {} };
      await handler({ method: 'POST', headers: { authorization: 'Bearer aaa.bbb.ccc', origin: 'https://vrm.center' }, body: { action: 'comptebloque' } }, res);
      return { st, js };
    };
    const SUB = ligne('push_subs', { subs: [{ endpoint: 'https://fcm.googleapis.com/fcm/send/banc', keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' } }], rev: 1 });
    const T = Date.now();
    const etats = (e) => ligne('panel_comptes_etat', { comptes: { 111: e } });
    const BANNI = { etat: 'banni', at: iso(T - H), preuve: 'champ profil is_account_banned', depuis: iso(T - 2 * H) };
    await essaie('S1', async () => {
      remettre([SUB, etats(BANNI), ligne('main', { vinted_account_labels: {} })], [compte(111, 'shop_a')]);
      const r = await appel();
      dit(r.st === 200 && pushes.length === 1 && /Vinted a bloqué shop_a/.test(pushes[0].title), 'S1 bloqué ⇒ « ⛔ Vinted a bloqué shop_a »', JSON.stringify([r, pushes]));
      await appel();
      dit(pushes.length === 1, 'S2 rappelée ⇒ rien de plus (jamais deux fois)', String(pushes.length));
      dit(!lectures.some((q) => /id=eq\.main/.test(q) && /select=data(&|$)/.test(q)), 'S2b `main` lue en projection, jamais `select=data`', JSON.stringify(lectures.filter((q) => /main/.test(q))));
    });
    await essaie('S3', async () => {
      remettre([SUB, etats(BANNI)], [compte(111, 'shop_a')]);
      await Promise.all([appel(), appel(), appel()]);
      dit(pushes.length === 1, 'S3 trois appels en même temps ⇒ une seule', String(pushes.length));
    });
    await essaie('S4', async () => {
      remettre([SUB, etats({ etat: 'actif', at: iso(T), depuis: iso(T) }), ligne('main', { vrm_comptes_bloques: { 111: { choix: 'pause', at: iso(T - H), episode: BANNI.depuis, n: 4 } } })], [compte(111, 'shop_a')]);
      await appel();
      dit(pushes.length === 1 && /shop_a est débloqué/.test(pushes[0].title) && /4 annonces remises/.test(pushes[0].body), 'S4 débloqué après SA pause ⇒ « shop_a est débloqué · 4 annonces remises »', JSON.stringify(pushes));
    });
    await essaie('S5', async () => {
      remettre([SUB, etats(BANNI), ligne('vrm_blocked_accounts', { uids: ['111'] })], [compte(111, 'shop_a')]);
      await appel();
      dit(pushes.length === 0, 'S5 compte retiré ⇒ on ne lui en parle plus');
    });
    await essaie('S6', async () => {
      remettre([SUB, etats(BANNI)], [compte(111, 'shop_a')]); casse = true;
      const r = await appel();
      dit(r.st === 503 && pushes.length === 0, 'S6 lecture ratée ⇒ 503, rien envoyé (le service rejoue)', JSON.stringify(r));
    });
    await essaie('S7', async () => {
      remettre([SUB, etats({ etat: 'actif', at: iso(T) })], [compte(111, 'shop_a')]);
      await appel();
      dit(pushes.length === 0, 'S7 compte actif, aucune pause ⇒ rien');
    });
  } finally { global.fetch = fetchAvant; }
}

async function tout({ regleFichier = REGLE, src = BG, serveurAussi = true } = {}) {
  await regle(regleFichier);
  copie();
  await extension(src);
  if (serveurAussi) await serveur();
}

const MUTATIONS = [
  ['pause sans preuve', "return !!(e && e.etat === 'banni' && cbChoixVaut(choix, e) && choix.choix === 'pause');", "return !!(choix && choix.choix === 'pause');"],
  ['épisode ignoré', "if (choix.episode && ep && String(choix.episode) !== ep) return false;", ''],
  ['choix clos ignoré', "  if (choix.fin) return false;\n", ''],
  ['plus tard pour toujours', "if (choix.choix === 'plus_tard' && (t == null || maintenant - t >= CB_PLUS_TARD_MS)) return 'question';", ''],
  ['remis sans pause', "if (choix && typeof choix === 'object' && choix.choix === 'pause' && !choix.fin) {", "if (true) {"],
  ['notifié deux fois', "if (!cles[cle]) out.push({ cle, sorte: 'bloque', uid: String(uid) });", "out.push({ cle, sorte: 'bloque', uid: String(uid) });"],
  ['compte d’un autre notifié', "    if (!permis.has(String(uid))) continue;\n", ''],
];
const MUT_BG = [
  ['pause absente de garde', "  { const cb = await pauseCompteBloqueDit(uid); if (cb) return cb; }     // (5.409)", "  // (5.409)"],
  ['pause absente de secuGeste', "if (pf === 'vinted' && mode !== 'clic') { const cb = await pauseCompteBloqueDit(compte); if (cb) return cb; }", ''],
  ['clic bloqué aussi', "if (pf === 'vinted' && mode !== 'clic') { const cb", "if (pf === 'vinted') { const cb"],
  ['pas su = en pause', "if (m === null || !Array.isArray(rows)) { noterDiag('compte_bloque_lecture_ratee'); return mem; }", "if (m === null || !Array.isArray(rows)) { return { at: Date.now(), choix: { 111: { choix: 'pause' } }, etats: { 111: { etat: 'banni' } } }; }"],
  ['refus 403 = banni', "if (!u) return { etat: 'passu', preuve: 'profil illisible' };", "if (!u) return { etat: json && (json.code || json.message_code) ? 'banni' : 'passu', preuve: 'refus' };"],
  ['absence = banni', "return { etat: 'passu', preuve: 'champ profil is_account_banned absent' };", "return { etat: 'banni', preuve: 'absent' };"],
  ['sans épisode', "        if (depuis) comptes[k].depuis = depuis; }", "        }"],
  ['sans notification', "        signalerCompteBloque(true).catch(() => {});", ""],
  ['mémoire gardée au déblocage', "        try { await chrome.storage.local.remove(CB_MEMOIRE); } catch (_) {}", ""],
];
async function mutation() {
  process.env.AUDIT_MUET = '1';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-compte-bloque-'));
  let total = 0, rouges = 0;
  const base = fs.readFileSync(REGLE, 'utf8');
  const bg = fs.readFileSync(BG, 'utf8');
  for (const [nom, a, b] of MUTATIONS) {
    total++;
    if (!base.includes(a)) { console.log('  ❌ mutation introuvable : ' + nom); continue; }
    const r = path.join(tmp, `r-${total}.mjs`);
    const muteSrc = base.replace(a, b);
    fs.writeFileSync(r, muteSrc);
    // La règle mutée va AUSSI dans l'extension (la copie suit la source) : seule la règle change.
    const f = path.join(tmp, `bg-r-${total}.js`);
    fs.writeFileSync(f, bg.replace(bloc(bg), bloc(muteSrc)));
    ok = 0; ko = 0;
    await regle(r).catch(() => { ko++; });
    await extension(f).catch(() => { ko++; });
    const rouge = ko > 0; if (rouge) rouges++;
    console.log((rouge ? '  ✅ ' : '  ❌ ') + `mutation de la règle « ${nom} » ⇒ ${rouge ? 'rouge' : 'RESTE VERTE'}`);
  }
  for (const [nom, a, b] of MUT_BG) {
    total++;
    if (!bg.includes(a)) { console.log('  ❌ mutation introuvable : ' + nom); continue; }
    const f = path.join(tmp, `bg-${total}.js`);
    fs.writeFileSync(f, bg.replace(a, b));
    ok = 0; ko = 0;
    await extension(f).catch(() => { ko++; });
    const rouge = ko > 0; if (rouge) rouges++;
    console.log((rouge ? '  ✅ ' : '  ❌ ') + `mutation du fond « ${nom} » ⇒ ${rouge ? 'rouge' : 'RESTE VERTE'}`);
  }
  // Le code d'avant : background.js de la branche de départ (sans la pause ni `depuis`).
  total++;
  const ancien = path.join(tmp, 'background-avant.js');
  let lu = false;
  for (const ref of ['origin/claude/project-review-nsk5su', 'origin/main']) {
    try { fs.writeFileSync(ancien, cp.execFileSync('git', ['show', `${ref}:vinted-sync-extension/background.js`], { cwd: RACINE, maxBuffer: 64 << 20 })); lu = true; break; } catch (_) {}
  }
  if (lu) {
    ok = 0; ko = 0;
    await extension(ancien).catch(() => { ko++; });
    const rouge = ko > 0; if (rouge) rouges++;
    console.log((rouge ? '  ✅ ' : '  ❌ ') + `background.js d'avant ⇒ E ${rouge ? 'rouge' : 'RESTE VERT'}`);
  } else console.log('  ❌ code d’avant illisible');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  console.log(`\n${rouges}/${total} mutations rougissent l’audit.`);
  process.exit(rouges === total ? 0 : 1);
}

(async () => {
  if (argv.includes('--mutation')) return mutation();
  const i = argv.indexOf('--src');
  await tout({ src: i >= 0 ? path.resolve(argv[i + 1]) : BG });
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
