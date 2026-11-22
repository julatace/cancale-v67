// ════════════════════════════════════════════════════════════════════════════
//  FAVORIS ET OFFRES « IRRÉPROCHABLES » (16 nov., lot favoris-offres-irreprochable,
//  extension 5.398) — Julien : « Pour les offres et messages aux favoris, je veux que
//  ça soit irréprochable : on ne peut pas se faire bloquer un compte Vinted. »
//
//  Revue adverse (récit : docs/passation/2026-11-16-favoris-offres-irreprochable.md).
//  Chaque correction est EXÉCUTÉE : le vrai `background.js` dans un vm
//  (`_fond-vm.cjs` : faux Vinted qui note chaque requête, fausse base à état) et la
//  vraie file serveur (`api/_lib/favoris-file.js`).
//    S1  un favori REFUSÉ après une écriture chez Vinted (conversation, offre) n'est
//        jamais re-préparé par une nouvelle file ;
//    S2  un refus AVANT toute écriture reste relançable (rien n'est parti) ;
//    S3  un temps FIXE entre deux favoris n'est jamais une minute ronde ;
//    E1  vérification anti-robot (captcha) : AUCUNE requête Vinted ne part, par
//        aucune voie (page, service worker, lecture) — l'arrêt est à la source ;
//    E2  la même chose pour la vérification vue par la couche de sécurité (DataDome) ;
//    E3  pendant le temps d'écriture : « Tout arrêter » et la vérification arrêtent
//        le message (rien ne part) ;
//    E4  offre auto : le fil est RELU depuis l'onglet juste avant le geste ; une offre
//        qui n'attend plus (traitée ailleurs, autre Chrome, retirée) ne reçoit rien ;
//    E5  …un autre prix ⇒ rien ;  E6  lecture ratée ⇒ rien, l'offre reste prévue ;
//    E7  chemin normal : GET du fil puis PUT, tout depuis la page, sans Authorization ;
//    E8  annonce réservée (dernier dressing capté) ⇒ jamais acceptée ;
//    E9  favori sur une annonce vendue (dressing) ⇒ RIEN ne part chez Vinted ;
//    E10 favori : la transaction relue dit « réservée » ⇒ ni offre ni message ;
//    E11 jamais deux fois de suite le même texte : seule la salutation change ;
//    E12 la règle, sur 60 envois d'une seule version : aucun texte identique au
//        précédent, et rien d'autre que la salutation ne bouge ;
//    E13 le message de refus d'une offre suit la même règle.
//  `--avant` : le même banc sur origin/main (background.js et file serveur) — rouge.
//  `--mutation=<nom>|toutes` : chaque correction réaffaiblie dans une copie ⇒ rouge.
//  Aucune donnée réelle : tout est inventé (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const RACINE = path.join(__dirname, '..');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? '  → ' + d : '')); } };
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const UID = '111', JETON = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ACC = { vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'jeton' };
const SRC = cheminSource();
const SRV = arg('--srv') || RACINE;

// ── Mutations : chaque correction réaffaiblie dans une copie ─────────────────
const MUTATIONS = {
  source: { f: 'bg', de: "const rb = await robotDeLaRequete(qui);\n    if (rb) {", vers: "const rb = '';\n    if (rb) {" },
  ecriture: { f: 'bg', de: "async function arretPendantEcriture(uid, mode) {", vers: "async function arretPendantEcriture(uid, mode) { return null;" },
  relecture: { f: 'bg', de: "      const fil = await relireOffre(acc, o);", vers: "      const fil = { etat: 'attend' };" },
  annonce: { f: 'bg', de: "function annonceIndisponible(it, suppIds, id) {", vers: "function annonceIndisponible(it, suppIds, id) { return '';" },
  texte: { f: 'bg', de: "function texteJamaisRepete(texte, pseudo, recents, hasard) {", vers: "function texteJamaisRepete(texte, pseudo, recents, hasard) { return String(texte == null ? '' : texte);" },
  dedoublon: { f: 'srv', de: "filter(x=>x.etat!=='annule'&&(x.etat!=='refuse'||Number.isInteger(x.ecrits)&&x.ecrits>0&&x.raison!=='vinted_robot'))", vers: "filter(x=>!['annule','refuse'].includes(x.etat))" },
  minute: { f: 'srv', de: "if(b===a)return a*60000+1000+Math.floor((h/4294967296)*29)*1000;", vers: "if(b===a)return a*60000;" },
};
function copieServeur(dir, depuisGit) {
  if (depuisGit) cp.execSync(`git archive ${depuisGit} api/_lib src | tar -x -C ${JSON.stringify(dir)}`, { cwd: RACINE, maxBuffer: 256 * 1024 * 1024 });
  else { fs.mkdirSync(path.join(dir, 'api', '_lib'), { recursive: true }); cp.execSync(`cp -r api/_lib/. ${JSON.stringify(path.join(dir, 'api', '_lib'))} && cp -r src ${JSON.stringify(dir)}`, { cwd: RACINE }); }
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
}
function lancer(args) { try { cp.execFileSync(process.execPath, [__filename, ...args], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 }); return 0; } catch (e) { return e.status || 1; } }

if (process.argv.includes('--avant')) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foi-avant-'));
  try {
    fs.writeFileSync(path.join(dir, 'bg.js'), cp.execSync('git show origin/main:vinted-sync-extension/background.js', { cwd: RACINE, maxBuffer: 64 * 1024 * 1024 }));
    copieServeur(dir, 'origin/main');
    const out = (() => { try { return cp.execFileSync(process.execPath, [__filename, '--src', path.join(dir, 'bg.js'), '--srv', dir], { maxBuffer: 64 * 1024 * 1024 }).toString(); } catch (e) { return String(e.stdout || ''); } })();
    const rouges = out.split('\n').filter((l) => l.startsWith('❌'));
    console.log(rouges.join('\n'));
    console.log(rouges.length ? `\n✅ preuve §6.1 : ${rouges.length} contrôle(s) rouge(s) sur origin/main — les corrections manquaient` : '\n❌ preuve §6.1 : rien ne rougit sur origin/main');
    process.exit(rouges.length ? 0 : 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
{
  const m = /^--mutation=(.+)$/.exec(process.argv.find((a) => /^--mutation=/.test(a)) || '');
  if (m) {
    const noms = m[1] === 'toutes' ? Object.keys(MUTATIONS) : [m[1]];
    let vus = 0;
    for (const nom of noms) {
      const mu = MUTATIONS[nom]; if (!mu) { console.log('❌ mutation inconnue ' + nom); process.exit(1); }
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foi-mut-'));
      try {
        let args;
        if (mu.f === 'bg') {
          const s = fs.readFileSync(SRC, 'utf8'); if (!s.includes(mu.de)) { console.log(`❌ mutation ${nom} : motif absent`); process.exit(1); }
          fs.writeFileSync(path.join(dir, 'bg.js'), s.replace(mu.de, mu.vers)); args = ['--src', path.join(dir, 'bg.js')];
        } else {
          copieServeur(dir, null);
          const p = path.join(dir, 'api', '_lib', 'favoris-file.js'), s = fs.readFileSync(p, 'utf8');
          if (!s.includes(mu.de)) { console.log(`❌ mutation ${nom} : motif absent`); process.exit(1); }
          fs.writeFileSync(p, s.replace(mu.de, mu.vers)); args = ['--srv', dir];
        }
        const rc = lancer(args);
        console.log(rc ? `✅ mutation « ${nom} » : l'audit rougit` : `❌ mutation « ${nom} » : l'audit reste vert`);
        if (rc) vus++;
      } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    }
    process.exit(vus === noms.length ? 0 : 1);
  }
}

// ── Les bancs ─────────────────────────────────────────────────────────────────
const nowISO = () => new Date().toISOString();
const GARDE_OK = () => ({ v: 1, at: Date.now(), items: [], complet: true, manques: [], ambigus: 0 });
function convOffre({ item = 444, tx = 9001, oid = 7001, price = 45, user = 500, status = 10, titre = '' } = {}) {
  return { id: '8' + oid, description: 'Paire', opposite_user: { id: user, login: 'acheteur', feedback_reputation: 0.96, review_count: 40 /* (22 nov.) 5.430 : la note LUE */ }, transaction: { item_id: String(item) },
    messages: [{ entity_type: 'offer_request_message', entity: { user_id: user, current: true, status, status_title: titre, price: { amount: String(price), currency_code: 'EUR' }, transaction_id: Number(tx), offer_request_id: Number(oid) } }] };
}
// Le moteur d'offres : `fil(e)` = ce que Vinted rend quand on relit la conversation.
function monterMoteur({ offre = { item: 444, tx: 9001, oid: 7001, price: 45 }, min = 40, refuse = null, msgRefus = '', fil = null, listings = null, store = {} } = {}) {
  const lignes = {};
  lignes[`harvest_${UID}_conv_${offre.oid}`] = { capturedAt: nowISO(), payload: { conversation: convOffre(offre) } };
  lignes.main = { capturedAt: nowISO(), vinted_offres_auto: true, vinted_annonce_numeros: { [String(offre.item)]: { num: '12', min, refuse } }, vinted_offre_refus_msg: msgRefus,
    vrm_securite_comptes: { plateformes: { vinted: { repos: { actif: false } } } }, vinted_offres_garde: GARDE_OK() };
  // (22 nov.) 5.432 (garde du prix) : une acceptation SEULE exige le prix actuel LU ⇒ le dressing lu sert l'annonce à 1,2 × l'offre.
  lignes[`harvest_${UID}_listings`] = { capturedAt: nowISO(), payload: { items: listings || [{ id: Number(offre.item), title: 'Paire', price: { amount: String(Math.round(Number(offre.price) * 120) / 100) } }] } };
  return faireFond({ src: SRC, lignes, connecte: UID, store,
    vinted: (e) => {
      if (e.methode === 'GET' && /^\/api\/v2\/conversations\/8\d+$/.test(e.chemin)) { const r = fil ? fil(e) : null; return r || { status: 200, body: { conversation: convOffre(offre) } }; }
      return { status: 200, body: {} };
    } });
}
async function deuxPassages(f) {
  await f.ctx.autoAccepterOffres(UID);
  const pv = f.store.vrmOffresPrevues || {}; for (const k in pv) if (pv[k]) pv[k].at = Date.now() - 1000;
  await f.ctx.autoAccepterOffres(UID);
}
const puts = (j) => j.vinted.filter((v) => v.methode === 'PUT' && /\/offer_requests\/\d+\/(accept|reject)$/.test(v.chemin));
// Les favoris : le faux Vinted des favoris (audit-favoris-vintex) + le faux serveur VRM.
function monterFavori({ txItem = null, listings = null, message = 'Bonjour !', pourcentage = 10, store = {}, login = undefined } = {}) {
  const conv = { id: 301, opposite_user: { id: 201, ...(login ? { login } : {}) }, transaction: { id: 5001, item_id: 101 }, allow_reply: true, messages: [] };
  const lignes = {};
  if (listings) lignes[`harvest_${UID}_listings`] = { capturedAt: nowISO(), payload: { items: listings } };
  const f = faireFond({ src: SRC, lignes, connecte: UID, store,
    vinted: (e) => {
      if (e.methode === 'POST' && /\/api\/v2\/conversations$/.test(e.chemin)) return { status: 200, body: { conversation: conv, code: 0 } };
      if (e.methode === 'GET' && /\/api\/v2\/conversations\/301$/.test(e.chemin)) return { status: 200, body: { conversation: conv } };
      if (e.methode === 'GET' && /\/api\/v2\/transactions\/\d+$/.test(e.chemin)) return { status: 200, body: { transaction: { id: 5001, item_id: 101, item: Object.assign({ id: 101, price: { amount: '50.0', currency_code: 'EUR' } }, txItem || {}) } } };
      if (e.methode === 'POST' && /\/offers$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
      if (e.methode === 'POST' && /\/replies$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
      return { status: 404, body: {} };
    } });
  const fetchFond = f.ctx.fetch;
  f.ctx.fetch = async (url, o = {}) => {
    if (String(url).startsWith('https://vrm.center/api/compte')) {
      const c = JSON.parse(o.body || '{}');
      const j = c.action === 'consommer' ? { ok: true, uid: UID, suivi: 's', travail: { itemId: '101', recipientId: '201', initiator: 'native-fixture', message, ...(pourcentage != null ? { pourcentage } : {}) } } : { ok: true, autorise: true, uid: UID };
      return { ok: true, status: 200, json: async () => j };
    }
    return fetchFond(url, o);
  };
  f.ctx.authToken = async () => ({ access_token: 'session', user_id: 'owner-banc' });   // la session du banc (sbGet filtre par propriétaire)
  f.ctx.notifierApp = async () => {};
  return f;
}
const seq = (j) => j.vinted.map((v) => /conversations$/.test(v.chemin) ? 'C' : /offers$/.test(v.chemin) ? 'O' : /replies$/.test(v.chemin) ? 'R' : /transactions\/\d+$/.test(v.chemin) ? 'T' : /conversations\/\d+$/.test(v.chemin) ? 'L' : '?').join('');
const corpsReponse = (j) => { const r = j.vinted.find((v) => /replies$/.test(v.chemin)); try { return JSON.parse(r.corps).reply.body; } catch (_) { return null; } };

(async () => {
  // ── S : la file serveur ────────────────────────────────────────────────────
  const F = await import(path.join(SRV, 'api', '_lib', 'favoris-file.js'));
  {
    const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', T = 1_800_000_000_000;
    const cible = { notificationId: 'n1', itemId: '101', recipientId: '201', initiator: 'x' };
    const lancerF = (d) => F.lancerFile(d, { owner, targets: [cible], message: 'Bonjour', intervalleMinutes: 2, maintenant: T });
    const essai = (ecrits, raison = 'offre_refusee') => {
      let d = lancerF(null).data;
      d = F.reserverFile(d, { owner, maintenant: T, jeton: 'j1' }).data;
      d = F.consommerFile(d, { owner, jeton: 'j1', maintenant: T + 10 }).data;
      d = F.terminerFile(d, { owner, jeton: 'j1', resultat: 'refuse', raison, ecrits, maintenant: T + 20 }).data;
      try { lancerF(d); return 'relance'; } catch (e) { return /déjà été préparés/.test(String(e.message)) ? 'refusee' : 'autre:' + e.message; }
    };
    dit(essai(1) === 'refusee', 'S1 — un favori refusé APRÈS une écriture chez Vinted (ecrits = 1) n’est jamais re-préparé par une nouvelle file', essai(1));
    dit(essai(1, 'vinted_robot') === 'relance', 'S3 — (21 nov.) un refus « vinted_robot » (faux anti-robot, aucun message parti) ne bloque pas le favori pour toujours', essai(1, 'vinted_robot'));
    dit(essai(0) === 'relance', 'S2 — un refus AVANT toute écriture (ecrits = 0) reste relançable par une nouvelle sélection', essai(0));
    const d = Array.from({ length: 300 }, (_, i) => F.delaiFavori(3, null, 'jeton-' + i));
    dit(d.every((x) => x % 60000 !== 0 && x > 3 * 60000 && x < 3 * 60000 + 30000), 'S3 — un temps FIXE de 3 min entre deux favoris n’est jamais une minute ronde (3 min + 1 à 29 s)', JSON.stringify(d.slice(0, 5)));
  }

  // ── E1/E2 : l'arrêt anti-robot à la source ─────────────────────────────────
  for (const [code, poser] of [['E1', async (f) => f.ctx.poserCaptcha(UID, 403)],
    ['E2', async (f) => f.ctx.secuObserver('vinted', UID, { status: 403, json: null, texte: '', entetes: { 'x-datadome': 'protected' } })]]) {
    const f = faireFond({ src: SRC, connecte: UID, vinted: () => ({ status: 200, body: { code: 0 } }) });
    await poser(f);
    const n0 = f.j.vinted.length;
    const a = await f.ctx.vintedPage(ACC, 'POST', '/api/v2/conversations/301/replies', { reply: { body: 'x' } }, { timeoutMs: 2000 });
    const b = await f.ctx.vintedSend(ACC, 'PUT', '/api/v2/transactions/1/offer_requests/2/reject', null, {});
    const c = await f.ctx.vintedGet(ACC, '/api/v2/conversations/301');
    dit(f.j.vinted.length === n0 && !a.ok && !b.ok && !c.ok, `${code} — vérification anti-robot ${code === 'E1' ? '(captcha)' : '(DataDome, couche de sécurité)'} : aucune requête Vinted ne part, ni de la page, ni du service worker, ni en lecture`, `requêtes parties : ${f.j.vinted.length - n0}`);
  }

  // ── E3 : pendant le temps d'écriture ───────────────────────────────────────
  {
    const f = faireFond({ src: SRC, connecte: UID });
    await f.ctx.poserToutArrete(true);
    const t0 = Date.now();
    const r = await f.ctx.attendreEcriture(UID, ACC, 'Bonjour, je te fais une offre.', 'serie');
    dit(r && r.ok === false && Date.now() - t0 < 4000, 'E3 — « Tout arrêter » pendant le temps d’écriture : le message ne part pas', JSON.stringify(r));
    const g = faireFond({ src: SRC, connecte: UID });
    await g.ctx.poserCaptcha(UID, 403);
    const r2 = await g.ctx.attendreEcriture(UID, ACC, 'Merci', 'clic');
    dit(r2 && r2.ok === false, 'E3 — vérification anti-robot pendant l’écriture (même sur son clic) : rien ne part', JSON.stringify(r2));
  }

  // ── E4–E8 : l'offre relue juste avant le geste ─────────────────────────────
  {
    const f = monterMoteur({ fil: () => ({ status: 200, body: { conversation: convOffre({ status: 30, titre: 'Offre acceptée' }) } }) });
    await deuxPassages(f);
    dit(puts(f.j).length === 0 && !!(f.store.vrmOffresFaites || {})['7001'], 'E4 — offre déjà traitée sur Vinted (autre Chrome, à la main) : le fil relu le dit, AUCUN geste ne part, l’offre est close', `PUT=${puts(f.j).length}`);
  }
  {
    const f = monterMoteur({ fil: () => ({ status: 200, body: { conversation: convOffre({ price: 60 }) } }) });
    await deuxPassages(f);
    dit(puts(f.j).length === 0, 'E5 — le fil relu porte un autre prix : rien ne part', `PUT=${puts(f.j).length}`);
  }
  {
    const f = monterMoteur({ fil: () => ({ status: 500, body: {} }) });
    await deuxPassages(f);
    dit(puts(f.j).length === 0 && !(f.store.vrmOffresFaites || {})['7001'] && !!(f.store.vrmOffresPrevues || {})['7001'], 'E6 — relecture du fil ratée : rien ne part, l’offre reste prévue (jamais « faite »)', `PUT=${puts(f.j).length}`);
  }
  {
    const f = monterMoteur({});
    await deuxPassages(f);
    const L = f.j.vinted.findIndex((v) => v.methode === 'GET' && /\/conversations\/87001$/.test(v.chemin)), P = f.j.vinted.findIndex((v) => v.methode === 'PUT');
    dit(L >= 0 && P > L && puts(f.j).length === 1 && f.j.vinted.every((v) => v.origine === 'page' && !Object.keys(v.entetes || {}).some((k) => /authorization/i.test(k))),
      'E7 — chemin normal : le fil est relu (GET) PUIS l’offre acceptée (PUT), tout depuis l’onglet vinted.fr, aucun Authorization', f.j.vinted.map((v) => v.methode + ' ' + v.chemin + ' ' + v.origine).join(' | '));
  }
  {
    const f = monterMoteur({ listings: [{ id: 444, is_closed: false, is_reserved: true, is_hidden: false }] });
    await deuxPassages(f);
    dit(puts(f.j).length === 0, 'E8 — annonce RÉSERVÉE dans le dernier dressing capté : l’offre n’est jamais acceptée', `PUT=${puts(f.j).length}`);
  }

  // ── E9–E10 : favori sur une annonce qui n'est plus disponible ──────────────
  {
    const f = monterFavori({ listings: [{ id: 101, is_closed: true, item_closing_action: 'sold' }] });
    const r = await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    dit(f.j.vinted.length === 0 && r && r.json && r.json.raison === 'annonce_indisponible' && r.json.ecrits === 0, 'E9 — favori sur une annonce VENDUE (dressing capté) : rien ne part chez Vinted, raison dite, 0 écriture', seq(f.j) + ' ' + JSON.stringify(r && r.json));
  }
  {
    const f = monterFavori({ txItem: { is_reserved: true } });
    const r = await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    dit(!/[OR]/.test(seq(f.j)) && r && r.json && r.json.raison === 'annonce_indisponible', 'E10 — la transaction relue dit l’annonce réservée : ni offre ni message', seq(f.j) + ' ' + JSON.stringify(r && r.json));
  }

  // ── E11–E13 : jamais deux fois de suite le même texte ──────────────────────
  {
    const f = monterFavori({ pourcentage: null, message: 'Bonjour ! Elle est toujours dispo.' });
    const e = f.ctx.empreinteMessage ? f.ctx.empreinteMessage('Bonjour ! Elle est toujours dispo.') : 'x';
    f.store.vrmTextesRecents = { [UID]: [e] };
    const r = await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    const b = corpsReponse(f.j);
    dit(r && r.ok && b && b !== 'Bonjour ! Elle est toujours dispo.' && /^(Bonjour|Salut|Hello) ! Elle est toujours dispo\.$/.test(b), 'E11 — le même texte vient de partir : seul « Bonjour » change (Salut, Hello), rien d’autre', JSON.stringify(b));
  }
  {
    const f = faireFond({ src: SRC, connecte: UID });
    const tj = f.ctx.texteJamaisRepete, em = f.ctx.empreinteMessage;
    let mauvais = 0, recents = [], autre = 0;
    const base = 'Je te fais -10 % sur cette paire, dis-moi !';
    for (let i = 0; i < 60; i++) {
      const t = typeof tj === 'function' ? tj(base, 'kiki_42', recents) : base;
      if (t == null || recents.includes(typeof em === 'function' ? em(t) : t)) mauvais++;
      if (t && !t.endsWith(base)) autre++;
      recents = recents.concat([typeof em === 'function' ? em(t) : t]).slice(-1);
    }
    dit(mauvais === 0 && autre === 0, 'E12 — 60 envois d’une seule version : jamais le texte du précédent, et le message lui-même n’est jamais touché', `répétés=${mauvais} modifiés=${autre}`);
  }
  {
    const f = monterMoteur({ min: null, refuse: 50, msgRefus: 'Désolé, trop bas pour moi.' });
    f.store.vrmTextesRecents = { [UID]: [f.ctx.empreinteMessage ? f.ctx.empreinteMessage('Désolé, trop bas pour moi.') : 'x'] };
    await deuxPassages(f);
    const b = corpsReponse(f.j);
    dit(b && b !== 'Désolé, trop bas pour moi.' && /^(Bonjour|Salut|Hello)( acheteur)? ! Désolé, trop bas pour moi\.$/.test(b), 'E13 — refus automatique : le même message de refus ne repart pas à l’identique (salutation ajoutée)', JSON.stringify(b));
  }

  console.log(ko ? `\n❌ favoris et offres irréprochables : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ favoris et offres irréprochables : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ banc en erreur : ' + (e && e.stack || e)); process.exit(1); });
