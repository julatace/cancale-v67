#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  MESSAGES AUX FAVORIS : LE FAVORI N'EST PAS DANS LA LISTE DE LA CLOCHE (22 nov., production)
//
//  Julien, 22 nov. au soir : « Vinted a changé le bouton notif », puis « Une file d'envoi est en pause : 3 en attente ».
//  La cloche de Vinted était ouverte et marchait : elle ne listait que des baisses de prix (les dernières notifications,
//  tous types mêlés). VRM cherchait la ligne du favori dans cette liste courte, ne la trouvait pas, réessayait deux fois,
//  demandait d'« apprendre » le bouton, puis rendait « refusé » — et un refus met TOUTE la file en pause.
//  On EXÉCUTE le vrai `background.js` (scripts/_fond-vm.cjs) ; la page est la fausse page des audits
//  (scripts/_fausse-page-vinted.cjs, `__vrmPage.cloche`) — le vrai vrm-formulaire.js est jugé contre une cloche de la
//  forme de sa capture par scripts/bancs/cloche-favoris.cjs. On juge :
//   K1  témoin : la ligne est dans la cloche ⇒ conversation, message, offre (rien n'a changé) ;
//   K2  la ligne n'est pas dans la liste de la cloche ⇒ VRM ouvre la page complète (« Voir tout », dans l'onglet de
//       travail, sur vinted.fr) et l'y trouve : le message part, UNE conversation ;
//   K3  nulle part ⇒ ce favori est SAUTÉ (`ignore`, « trop ancien pour Vinted ») : rien n'est écrit, aucune pause de
//       Vinted, aucun bouton « à apprendre », l'étape n'est PAS réessayée — la file continue ;
//   K4  le chemin de « Voir tout » rendu par la page n'est jamais suivi hors des notifications de vinted.fr ;
//   K5  la cloche VRAIMENT introuvable reste un arrêt dit (rien n'est écrit) ;
//   K6  le champ du message introuvable ⇒ « élément introuvable » (PAS « Vinted a refusé »), l'ÉTAPE et la CAUSE sur la
//       ligne, la file CONTINUE ; K7 pareil pour la cloche, et pour l'accusé d'une extension déjà installée ;
//   K8  trois de suite ⇒ la file s'arrête et dit quoi faire ; K9 les causes globales arrêtent toujours.
//  `--bg <background.js>` : une autre copie ; `--mutation nom` ; `--prouve`. Données inventées.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const RACINE = path.join(__dirname, '..');
const argBg = (() => { const i = process.argv.indexOf('--bg'); return i > 0 ? process.argv[i + 1] : ''; })();
let BG = argBg ? path.resolve(argBg) : path.join(RACINE, 'vinted-sync-extension', 'background.js');
const MUTATIONS = {
  // La page complète n'est plus ouverte : un favori absent de la liste courte est refusé (la file se met en pause).
  'sans-voir-tout': ['  if(creation.rienParti&&creation.absent===true&&!creation.pause){', '  if(false){'],
  // Une ligne absente est réessayée comme une page pas prête.
  'absent-reessaye': ['  if (o.absent === true) return false;\n', ''],
  // Le chemin rendu par la page est suivi tel quel.
  // 5.440 : plus de passage par l'accueil de Vinted quand la messagerie ne montre pas la cloche.
  'sans-accueil': ["  if(creation.rienParti&&!creation.pause&&creation.sansPage==='element'&&/^cloche/.test(String(creation.manque||''))){", '  if(false){'],
  // 5.440 : la cloche attendue par la couche de repérage est réessayée deux fois de plus (30 s perdues par favori).
  'cloche-reessayee': ["  if (o.code === 'selecteur' && /^cloche/.test(String(o.manque || ''))) return false;\n", ''],
  // 5.440 : la page complète n'est plus le dernier recours quand la cloche est introuvable dans l'en-tête.
  'sans-liste-finale': ["{noterDiag('favori_cloche_liste');creation=Object.assign({},creation,{absent:true,voirTout:await pageNotifsConnue()});}", "{noterDiag('favori_cloche_liste');}"],
  'chemin-suivi': ["return /^\\/[\\w\\-/]{1,80}$/.test(c) && /notif/i.test(c) && !/\\.\\./.test(c) ? c : '/member/notifications'; }", "return c || '/member/notifications'; }"],
};
// Les mutations de la RÈGLE (src/favorisProgression.js) : une copie mutée à côté, lue par `PROGRESSION`.
const MUT_REGLE = {
  // « élément introuvable » n'est plus une raison connue : il redevient « Vinted a refusé ».
  'element-inconnu': ["export const RAISONS_FAVORIS={element_introuvable:'", "export const RAISONS_FAVORIS={element_introuvable_x:'"],
  // L'étape et la cause ne passent plus.
  'sans-etape': ["...(etape?{etape}:{}),...(cause?{cause}:{})};\n}", "};\n}"],
};
const argMut = (() => { const a = process.argv.find((x) => x.startsWith('--mutation=')); return a ? a.slice(11) : ''; })();
if (process.argv.includes('--prouve')) {
  let rate = 0;
  for (const m of [...Object.keys(MUTATIONS), ...Object.keys(MUT_REGLE)]) {
    const r = cp.spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouge = r.status === 1 && /❌ K/.test(r.stdout || '');
    console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ⇒ ${rouge ? 'rouge' : 'PAS rouge : ' + String(r.stdout || '').split('\n').slice(-3).join(' ')}`);
    if (!rouge) rate++;
  }
  process.exit(rate ? 1 : 0);
}
if (argMut && MUT_REGLE[argMut]) {
  const src = path.join(RACINE, 'src', 'favorisProgression.js'), s0 = fs.readFileSync(src, 'utf8'), M = MUT_REGLE[argMut];
  if (!s0.includes(M[0])) { console.log('mutation introuvable : ' + argMut); process.exit(2); }
  const dest = path.join(RACINE, 'src', `.favorisProgression-mut-${process.pid}.js`);
  fs.writeFileSync(dest, s0.split(M[0]).join(M[1])); process.env.PROGRESSION = dest;
  process.on('exit', () => { try { fs.unlinkSync(dest); } catch (_) {} });
} else if (argMut) {
  const M = MUTATIONS[argMut]; if (!M) { console.log('mutation inconnue'); process.exit(2); }
  const s = fs.readFileSync(BG, 'utf8');
  if (!s.includes(M[0])) { console.log('mutation introuvable : ' + argMut); process.exit(2); }
  BG = path.join(os.tmpdir(), `bg-cloche-favoris-${argMut}-${process.pid}.js`);
  fs.writeFileSync(BG, s.split(M[0]).join(M[1]));
  process.on('exit', () => { try { fs.unlinkSync(BG); } catch (_) {} });
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 600) : '')); } };

const UID = '111', JETON = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ACC = { vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'jeton' };
function monter(page) {
  const conv = { id: 301, opposite_user: { id: 201, login: 'pseudo_banc' }, transaction: { id: 5001, item_id: 101 }, allow_reply: true, messages: [] };
  const lignes = { main: { vinted_annonce_numeros: { '101': { numero: '41', min: '40' } } } };
  const f = faireFond({ src: BG, connecte: UID, comptes: [ACC], lignes, store: { __commeBleamDefaut: true },
    vinted: (e) => {
      if (e.methode === 'GET' && /\/inbox-notifications\/v1\/notifications$/.test(e.chemin)) return { status: 200, body: { notifications: [{ id: 'n-banc', entry_type: 20 }, { id: 'n-autre', entry_type: 20 }] } };
      if (e.methode === 'POST' && /\/api\/v2\/conversations$/.test(e.chemin)) return { status: 200, body: { conversation: conv, code: 0 } };
      if (e.methode === 'GET' && /\/api\/v2\/conversations\/\d+$/.test(e.chemin)) return { status: 200, body: { conversation: conv } };
      if (e.methode === 'GET' && /\/api\/v2\/transactions\/\d+$/.test(e.chemin)) return { status: 200, body: { transaction: { id: 5001, item_id: 101, item: { id: 101, price: { amount: '50.0', currency_code: 'EUR' }, photos: [{ id: 1, is_suspicious: false }] } } } };
      if (e.methode === 'POST' && /\/offers$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
      if (e.methode === 'POST' && /\/replies$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
      return { status: 404, body: {} };
    } });
  const fetchFond = f.ctx.fetch;
  f.accuses = [];
  f.ctx.fetch = async (url, o = {}) => {
    if (String(url).startsWith('https://vrm.center/api/compte')) {
      const c = JSON.parse(o.body || '{}');
      if (c.action === 'terminer') f.accuses.push(c.brut || c);
      const j = c.action === 'consommer' ? { ok: true, uid: UID, suivi: 's', travail: { notificationId: 'n-banc', itemId: '101', recipientId: '201', initiator: 'native-fixture', aimes: 1, message: 'Bonjour {username} !', offre: { mode: 'pct', valeur: 10, arrondi: false } } } : { ok: true, autorise: true, uid: UID };
      return { ok: true, status: 200, json: async () => j };
    }
    return fetchFond(url, o);
  };
  f.ctx.notifierApp = async () => {};
  f.ctx.__vrmPausesVues = [];
  if (page) f.ctx.__vrmPage = page;
  return f;
}
const seq = (f) => f.j.vinted.filter((v) => v.methode !== 'GET').map((v) => (/conversations$/.test(v.chemin) ? 'C' : /replies$/.test(v.chemin) ? 'M' : /offers$/.test(v.chemin) ? 'O' : '?')).join('');
const pas = (f) => (f.j.etapesPage || []).map((x) => x.etape).filter((e) => /^favori/.test(e));
const navs = (f) => (f.j.navigations || []).map((x) => x.url);
const jouer = (f) => f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON }).catch((e) => ({ erreur: String(e && e.stack || e) }));

(async () => {
  { const f = monter(); const r = await jouer(f);
    dit(r && r.json && r.json.resultat === 'envoye' && seq(f) === 'CMO' && pas(f).join() === 'favoriOuvrir', 'K1 témoin : la ligne est dans la cloche ⇒ conversation, message, offre', `${seq(f)} ${pas(f)} ${JSON.stringify(r && (r.json || r.erreur)).slice(0, 200)}`); }

  { const f = monter({ cloche: 'absente' }); const r = await jouer(f);
    dit(r && r.json && r.json.resultat === 'envoye' && seq(f) === 'CMO', 'K2 absente de la liste de la cloche ⇒ trouvée sur la page complète : le message et l’offre partent, UNE conversation', `${seq(f)} ${JSON.stringify(r && (r.json || r.erreur)).slice(0, 300)}`);
    dit(pas(f).join() === 'favoriOuvrir,favoriListe', 'K2 la cloche est lue UNE fois, puis la page complète (aucun réessai de la liste courte)', pas(f).join());
    dit(navs(f).some((u) => u === 'https://www.vinted.fr/member/notifications'), 'K2 la page complète est ouverte dans l’onglet de travail, sur vinted.fr', JSON.stringify(navs(f))); }

  { const f = monter({ cloche: 'nulle-part' }); const r = await jouer(f);
    dit(r && r.json && r.json.resultat === 'ignore' && r.json.raison === 'favori_trop_ancien' && seq(f) === '', 'K3 nulle part ⇒ ce favori est SAUTÉ (« ignore »), rien n’est écrit chez Vinted', `${seq(f)} ${JSON.stringify(r && (r.json || r.erreur)).slice(0, 300)}`);
    dit(pas(f).join() === 'favoriOuvrir,favoriListe', 'K3 la liste puis la page complète, chacune UNE fois (une ligne absente n’est pas « une page pas prête »)', pas(f).join());
    dit(!f.store.vrmPauseVinted && !(f.store.vrmCaptcha || {})[UID] && !Object.keys((f.store.vrmAppris || {}).el || {}).length && !f.j.diags.some((d) => /appris|apprendre/.test(d)), 'K3 aucune pause de Vinted, aucune vérification, aucun bouton « à apprendre »', JSON.stringify({ p: f.store.vrmPauseVinted, d: f.j.diags.filter((d) => /appr|pause/.test(d)) }));
    // Ce résultat, rendu à la VRAIE file du serveur (api/_lib/favoris-file.js) : la file reste ACTIVE, les autres attendent.
    const { pathToFileURL } = require('url');
    const F = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'favoris-file.js')).href);
    const P = await import(pathToFileURL(path.join(RACINE, 'src', 'favorisProgression.js')).href);
    const file = (resultatBrut) => {
      const now = Date.now(); let d = null; const maj = (x) => { if (x.data) d = x.data; return x.valeur; };
      maj(F.lancerFile(d, { owner: 'o', targets: ['n1', 'n2', 'n3', 'n4'].map((n, i) => ({ itemId: String(101 + i), recipientId: String(201 + i), notificationId: n, initiator: 'favourite' })), message: 'Bonjour', intervalleMinutes: 0, maintenant: now, lot: 'lot1' }));
      const jeton = '00000000-0000-4000-8000-000000000001';
      maj(F.reserverFile(d, { owner: 'o', maintenant: now, jeton, suivi: 's' })); maj(F.consommerFile(d, { owner: 'o', jeton, maintenant: now })); maj(F.verifierReservation(d, { owner: 'o', jeton, maintenant: now }));
      const t = P.traduireResultatFavori(resultatBrut);
      return maj(F.terminerFile(d, { owner: 'o', jeton, resultat: t.resultat, raison: t.raison, maintenant: now + 1000, ecrits: Number.isInteger(t.ecrits) ? t.ecrits : null }));
    };
    const vSaute = file({ ok: !!r.ok, status: r.status, data: r.json }), vRefus = file({ ok: false, status: 0, data: { resultat: 'refuse', raison: 'onglet_vinted', ecrits: 0 } });
    const attente = (v) => (v.jobs || []).filter((j) => j.etat === 'attente').length;
    dit(vSaute.active === true && attente(vSaute) === 3, 'K3 rendu à la vraie file du serveur : ce favori est sauté, la file reste ACTIVE, les 3 autres attendent toujours', JSON.stringify({ a: vSaute.active, n: attente(vSaute), r: vSaute.raison }));
    dit(vRefus.active === false, 'K3 (témoin) une cause GLOBALE (onglet de travail fermé) met bien la file en pause', JSON.stringify({ a: vRefus.active, r: vRefus.raison })); }

  for (const mauvais of ['//evil.example/notifications', '/../admin/notifications', 'https://evil.example/notif', '/settings/profile', '/member/notifications?x=<script>']) {
    const f = monter({ cloche: 'absente', voirTout: mauvais }); await jouer(f);
    const ailleurs = navs(f).filter((u) => !/^https:\/\/www\.vinted\.fr\/(inbox(\/\d+)?|member\/notifications)$/.test(u));
    dit(ailleurs.length === 0 && navs(f).includes('https://www.vinted.fr/member/notifications'), `K4 « Voir tout » = ${JSON.stringify(mauvais)} ⇒ jamais suivi : la page connue des notifications de vinted.fr`, JSON.stringify(navs(f)));
  }
  { const f = monter({ cloche: 'absente', voirTout: '/notifications' }); await jouer(f);
    dit(navs(f).includes('https://www.vinted.fr/notifications'), 'K4 un chemin de notifications propre de vinted.fr (« /notifications ») est suivi', JSON.stringify(navs(f))); }

  // 5.440 : une cloche en double sur la messagerie n'arrête plus tout (l'accueil et la page complète sont essayés) ; en double PARTOUT ⇒ arrêt dit.
  { const f = monter({ manque: 'cloche-ambigue' }); const r = await jouer(f);
    dit(r && r.json && r.json.resultat === 'refuse' && seq(f) === '' && r.json.ecrits === 0, 'K5 la cloche en double partout ⇒ arrêt dit, rien n’est écrit', `${seq(f)} ${pas(f)} ${JSON.stringify(r && (r.json || r.erreur)).slice(0, 200)}`); }

  // ── K6–K9 : « 0 envoyé · 2 refusés : autre refus » (Julien, 22 nov.) — la classe du refus, l'étape, et la file qui continue.
  const { pathToFileURL } = require('url');
  const F = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'favoris-file.js')).href);
  const P = await import(pathToFileURL(process.env.PROGRESSION || path.join(RACINE, 'src', 'favorisProgression.js')).href);
  // La vraie file : 5 favoris ; `accuses` = ce que l'extension rend pour le 1er, le 2e… ; rend la vue après chacun.
  const derouler = (accuses) => {
    let now = Date.now(), d = null, n = 0; const vues = []; const maj = (x) => { if (x.data) d = x.data; return x.valeur; };
    maj(F.lancerFile(d, { owner: 'o', targets: ['n1', 'n2', 'n3', 'n4', 'n5'].map((x, i) => ({ itemId: String(101 + i), recipientId: String(201 + i), notificationId: x, initiator: 'favourite' })), message: 'Bonjour', intervalleMinutes: 0, maintenant: now, lot: 'lot1' }));
    for (const brut of accuses) {
      now += 60000; const jeton = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
      let res = null; try { res = maj(F.reserverFile(d, { owner: 'o', maintenant: now, jeton, suivi: 's' })); } catch (_) { res = null; }
      if (!res || !res.travail) { vues.push(null); continue; }
      maj(F.consommerFile(d, { owner: 'o', jeton, maintenant: now })); maj(F.verifierReservation(d, { owner: 'o', jeton, maintenant: now }));
      const t = P.traduireResultatFavori(brut);
      vues.push(maj(F.terminerFile(d, { owner: 'o', jeton, resultat: t.resultat, raison: t.raison, maintenant: now + 1000, ecrits: Number.isInteger(t.ecrits) ? t.ecrits : null, etape: t.etape || null, cause: t.cause || null })));
    }
    return vues;
  };
  const attente = (v) => (v.jobs || []).filter((j) => j.etat === 'attente').length;
  const brutDe = (r) => ({ ok: !!r.ok, data: r.json });

  { // K6 — le champ du message est introuvable sur la page de la conversation.
    const f = monter({ manque: 'message-champ', manqueEtape: 'message' }); const r = await jouer(f); const j = (r && r.json) || {};
    dit(j.resultat === 'refuse' && j.raison === 'element_introuvable' && j.raison !== 'vinted_refus', 'K6 champ du message introuvable ⇒ « élément introuvable » — PAS « Vinted a refusé »', JSON.stringify(j));
    dit(j.etape === 'envoi' && j.cause === 'element_absent:message-champ' && !/M|O/.test(seq(f)), 'K6 l’accusé dit l’ÉTAPE (envoi) et la CAUSE (élément absent : message-champ) ; ni message ni offre ne sont partis', `${seq(f)} ${JSON.stringify(j)}`);
    const t = P.traduireResultatFavori(brutDe(r));
    dit(t.raison === 'element_introuvable' && t.etape === 'envoi' && t.cause === 'element_absent:message-champ', 'K6 la règle du serveur garde la raison, l’étape et la cause (liste blanche)', JSON.stringify(t));
    const v = derouler([brutDe(r)])[0]; const job = (v.jobs || []).find((x) => x.etat === 'refuse') || {};
    dit(v.active === true && attente(v) === 4 && job.etape === 'envoi' && job.cause === 'element_absent:message-champ', 'K6 la file CONTINUE (4 en attente) ; la ligne du favori porte l’étape et la cause', JSON.stringify({ a: v.active, n: attente(v), job })); }

  { // K7 — la cloche introuvable : classe et étape ; un accusé d'une extension d'AVANT (sans étape ni cause) continue aussi.
    // 5.440 : « introuvable » = introuvable PARTOUT (messagerie, accueil, page complète) — sinon VRM passe par le chemin suivant (K10, K11).
    const f = monter({ manque: 'cloche' }); const r = await jouer(f); const j = (r && r.json) || {};
    dit(j.resultat === 'refuse' && j.raison === 'element_introuvable' && j.etape === 'conversation' && j.cause === 'element_absent:cloche' && j.ecrits === 0, 'K7 cloche introuvable partout ⇒ élément introuvable, étape « conversation », cause « element_absent:cloche », rien d’écrit', JSON.stringify(j));
    dit(pas(f).join() === 'favoriOuvrir,favoriAccueil,favoriListe' && !f.j.diags.some((d) => /appris|apprendre/.test(d)) && !Object.keys((f.store.vrmAppris || {}).el || {}).length, 'K7 (5.440) messagerie, puis accueil, puis page complète — jamais « touche le bouton » (aucun apprentissage)', pas(f).join() + ' ' + f.j.diags.filter((d) => /appr/.test(d)).join());
    const ancien = { ok: false, data: { resultat: 'refuse', raison: 'element_introuvable', ecrits: 0 } };
    const va = derouler([ancien])[0];
    dit(va.active === true && attente(va) === 4 && !/Vinted a refusé/.test(va.raison || ''), 'K7 l’accusé d’une extension déjà installée (raison seule) : la file continue, sans « Vinted a refusé »', JSON.stringify({ a: va.active, r: va.raison })); }

  { // K10 (5.440, Julien 23 nov. : « l'app doit s'adapter toute seule ») — la cloche absente de la MESSAGERIE (nouvelle page de Vinted) :
    //    l'accueil (en-tête complet) la montre ⇒ le message part, sans aucune question ni apprentissage.
    const f = monter({ manque: 'cloche', manqueEtape: 'favoriOuvrir' }); const r = await jouer(f);
    dit(r && r.json && r.json.resultat === 'envoye' && seq(f) === 'CMO' && pas(f).join() === 'favoriOuvrir,favoriAccueil', 'K10 cloche absente de la messagerie ⇒ l’accueil de Vinted : conversation, message, offre', `${seq(f)} ${pas(f)} ${JSON.stringify(r && (r.json || r.erreur)).slice(0, 200)}`);
    dit(navs(f).some((u) => u === 'https://www.vinted.fr/'), 'K10 l’onglet de travail va sur l’accueil de vinted.fr', JSON.stringify(navs(f)));
    dit(!f.j.diags.some((d) => /appris|apprendre/.test(d)) && !Object.keys((f.store.vrmAppris || {}).el || {}).length, 'K10 aucun « touche le bouton » demandé', f.j.diags.filter((d) => /appr/.test(d)).join()); }
  { // K11 (5.440) — la cloche nulle part dans l'en-tête (messagerie ET accueil) ⇒ la page complète des notifications, où le favori est trouvé.
    const f = monter({ manque: 'cloche', manqueEtape: 'favoriOuvrir' }); f.ctx.__vrmPage.manqueEtape2 = 'favoriAccueil';
    const orig = f.ctx.__vrmPage; f.ctx.__vrmPage = new Proxy(orig, { get: (o, k) => (k === 'manqueEtape' ? undefined : k === 'manque' ? undefined : o[k]) });
    // la fausse page : cloche absente des deux premières étapes (rendu à la main)
    const em0 = f.ctx.__vrmFormulaire;
    void em0;
    const r = await (async () => { const P0 = f.ctx.__vrmPage; f.ctx.__vrmPage = { manque: 'cloche', manqueEtape: 'favoriOuvrir' }; const bg = f.ctx.interfaceVinted; let n = 0;
      f.ctx.interfaceVinted = async (acc, geste, d, o) => { if (geste === 'favoriAccueil') { n++; f.ctx.__vrmPage = { manque: 'cloche', manqueEtape: 'favoriAccueil' }; const x = await bg(acc, geste, d, o); f.ctx.__vrmPage = P0; return x; } return bg(acc, geste, d, o); };
      const x = await jouer(f); f.ctx.interfaceVinted = bg; return x; })();
    dit(r && r.json && r.json.resultat === 'envoye' && seq(f) === 'CMO' && pas(f).join() === 'favoriOuvrir,favoriAccueil,favoriListe', 'K11 cloche nulle part dans l’en-tête ⇒ la page complète des notifications : le message part', `${seq(f)} ${pas(f)} ${JSON.stringify(r && (r.json || r.erreur)).slice(0, 200)}`); }

  { // K8 — trois de suite ⇒ la file s'arrête et dit quoi faire ; un envoi réussi remet le compteur à zéro.
    const el = { ok: false, data: { resultat: 'refuse', raison: 'element_introuvable', ecrits: 0, etape: 'conversation', cause: 'element_absent:cloche' } }, okE = { ok: true, data: { resultat: 'envoye', ecrits: 2 } };
    const v3 = derouler([el, el, el]);
    dit(v3[0].active && v3[1].active && v3[2].active === false && /Reprendre/.test(v3[2].raison || '') && attente(v3[2]) === 2, 'K8 trois favoris de suite introuvables ⇒ la file s’arrête, dit quoi regarder et « Reprendre » ; les 2 restants attendent', JSON.stringify(v3.map((v) => v && [v.active, attente(v), v.raison])).slice(0, 400));
    const vm = derouler([el, el, okE, el, el]);
    dit(vm.every((v) => v && (v.active === true || attente(v) === 0)), 'K8 un envoi réussi entre deux remet le compteur à zéro : la file va au bout', JSON.stringify(vm.map((v) => v && [v.active, attente(v)]))); }

  { // K9 — les causes GLOBALES arrêtent toujours ; un 4xx propre à CE favori continue.
    const g = (data) => derouler([{ ok: false, data: Object.assign({ resultat: 'refuse', ecrits: 0 }, data) }])[0];
    const stop = [['pause_vinted', 'http_429'], ['vinted_robot', 'captcha'], ['compte_vinted_different', 'compte'], ['onglet_vinted', 'onglet'], ['vinted_refus', 'http_403'], ['vinted_refus', 'garde'], ['vinted_refus', '']].map(([raison, cause]) => [raison + '/' + cause, g({ raison, cause, etape: 'conversation' }).active]);
    dit(stop.every((x) => x[1] === false), 'K9 vérification, 403/429, mauvais compte, onglet fermé, garde, refus sans cause ⇒ la file S’ARRÊTE', JSON.stringify(stop));
    const v404 = g({ raison: 'vinted_refus', cause: 'http_404', etape: 'conversation' });
    dit(v404.active === true && attente(v404) === 4, 'K9 un 404 de Vinted pour CE favori (rien d’écrit) ⇒ sauté, la file continue', JSON.stringify({ a: v404.active }));
    const ecrit = derouler([{ ok: false, data: { resultat: 'refuse', raison: 'element_introuvable', ecrits: 2, etape: 'envoi', cause: 'element_absent:message-envoyer' } }])[0];
    dit(ecrit.active === false, 'K9 un refus APRÈS une écriture chez l’acheteur (offre partie) arrête la file, comme avant', JSON.stringify({ a: ecrit.active })); }

  console.log(`\n${ko ? '❌' : '✅'} favori absent de la cloche : ${ok} bon(s), ${ko} défaut(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
