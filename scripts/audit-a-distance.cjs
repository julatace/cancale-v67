// ════════════════════════════════════════════════════════════════════════════
//  À DISTANCE (22 nov., extension 5.436 — capacité `adistance`) — EXÉCUTÉ
//      node scripts/audit-a-distance.cjs [--prouve] [--recopie] [--src background.js]
//
//  Julien : ses comptes à distance, « comme Bleam Cloud mais sans risque de ban » — le relais
//  est SON ordinateur (Chrome + l'extension), l'app commande. Ce qui tourne ici, jamais une phrase :
//   · la règle de l'app (src/aDistance.js), importée d'une copie mutable ;
//   · le VRAI background.js dans un vm (scripts/_fond-vm.cjs) : fausse base à état (propriétaire,
//     écriture conditionnelle), `chrome.storage.local` à état ; les chemins du CLIC (répondre,
//     prix, masquer…) remplacés par des espions qui COMPTENT chaque geste — ce banc juge la FILE
//     (qui part, quand, une fois, au nom de qui), les chemins ont leurs propres audits.
//
//   A  la règle : une commande permise a sa forme, son empreinte, sa clé ; refusées : geste hors
//      liste, site non permis, compte illisible, hausse, accepter sans confirmation, empreinte
//      qui ne correspond plus (un argument ou le compte changé après le dépôt) ;
//   B  la vue : périmée après 24 h même sans extension, « pas sûr » après 15 min prise, les
//      quatre groupes de la file, l'état des ordinateurs (allumé < 3 min), d'où partirait un geste ;
//   C  le miroir : boîte projetée champ par champ (jamais `select=data`), une offre « en attente »
//      = courante ET statut 10 (mesuré) ;
//   D  le bloc <a-distance-regle> de l'extension est la copie exacte de l'app ;
//   E  extension : sans session ⇒ aucune lecture de la file ; ligne d'un autre vendeur ⇒ rien ;
//   F  le bon compte connecté ⇒ prise conditionnelle, UN geste, « fait » avec avant → après,
//      présence publiée, notification demandée ; rejouée (ligne remise en attente) ⇒ JAMAIS deux fois ;
//   G  autre compte · pause · vérification · aucun compte ⇒ la ligne n'est PAS touchée, aucun geste,
//      la présence dit pourquoi ; partie au retour du bon compte ;
//   H  périmée ⇒ « expirée » sans geste ; empreinte modifiée ⇒ refusée sans geste ;
//   I  deux commandes ⇒ une seule par passage ; « plafond » ⇒ remise en attente (bornée) ;
//   J  Leboncoin : deux comptes ouverts ⇒ attend ; le bon seul ⇒ part ;
//   K  la présence : sa ligne `presence_{16 hex}` (jamais `main`), comptes, version ;
//   L  « Tout arrêter » ⇒ refusée et dite, jamais une attente.
//  `--prouve` : chaque mutation rougit au moins un contrôle ; sur le code d'avant (sans
//  `distanceTick`), E–L sont rouges. Aucune donnée réelle : tout est inventé (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const BG = path.join(RACINE, 'vinted-sync-extension', 'background.js');
const F_APP = path.join(RACINE, 'src', 'aDistance.js');
const BLOC_RE = /\/\/ <a-distance-regle>[^\n]*\n([\s\S]*?)\/\/ <\/a-distance-regle>/;

if (process.argv.includes('--recopie')) {
  const app = fs.readFileSync(F_APP, 'utf8'), bg = fs.readFileSync(BG, 'utf8');
  const m = BLOC_RE.exec(app);
  if (!m || !BLOC_RE.test(bg)) { console.error('bloc <a-distance-regle> introuvable'); process.exit(1); }
  fs.writeFileSync(BG, bg.replace(BLOC_RE, () => '// <a-distance-regle> — COPIE de src/aDistance.js (scripts/audit-a-distance.cjs --recopie). Ne pas modifier ici.\n' + m[1] + '// </a-distance-regle>'));
  console.log('bloc <a-distance-regle> recopié dans background.js');
  process.exit(0);
}
const { faireFond } = require('./_fond-vm.cjs');

async function chargerApp(texte) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a-distance-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(path.join(dir, 'aDistance.js'), texte);
  try { return await import(pathToFileURL(path.join(dir, 'aDistance.js')).href); }
  finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }
}

const MOI = '0b0b0b0b-0000-4000-8000-00000000000a', AUTRE = '0c0c0c0c-0000-4000-8000-00000000000b';
const UID = '111', UID2 = '222', ITEM = '91010001';
const H = 3600000;
let seq = 0;

function monterExt({ src, lignesCmd = [], session = true, connecte = UID, lbcOnglets = null, store = null, pause = false, captcha = false, table: tableDonnee = null, ws = false, recoMs = 0 } = {}) {
  const st = store || {};
  if (session) st.vrmSession = { access_token: 'jeton.vrm.banc', refresh_token: 'rt', expires_at: Date.now() + H, user_id: MOI, email: 'banc@exemple.fr' };
  else { delete st.vrmSession; st.__sansSession = true; }
  st.vrmCloisonne = true;
  if (pause) st.vrmPauseVinted = { jusqua: Date.now() + 30 * 60000, statut: 429, depuis: Date.now() };
  if (captcha) st.vrmCaptcha = { [UID]: { depuis: Date.now() - 60000, quoi: 'captcha' } };
  const onglets = [{ id: 7, url: 'https://www.vinted.fr/', status: 'complete' }];
  if (lbcOnglets) {
    const tr = {};
    lbcOnglets.forEach((c, i) => { const id = 40 + i; onglets.push({ id, url: 'https://www.leboncoin.fr/compte', status: 'complete' }); tr[id] = { compte: 'lbc-account:' + c, source: 'prive', at: Date.now() - i }; });
    st.vrmLbcTransport = tr;
  }
  const comptes = [{ vinted_user_id: UID, login: 'compte_un', domain: 'www.vinted.fr', access_token: 'j1' }, { vinted_user_id: UID2, login: 'compte_deux', domain: 'www.vinted.fr', access_token: 'j2' }];
  const f = faireFond({ src, lignes: {}, store: st, connecte, comptes, onglets });
  const etat = { connecte };
  f.ctx.activeAccountId = async () => etat.connecte;
  f.ctx.activeUidForDomain = async () => etat.connecte;
  try { f.ctx.compteConnecte = async () => etat.connecte; } catch (_) {}
  const table = tableDonnee || {}, presences = {};
  for (const r of lignesCmd) table[r.id] = JSON.parse(JSON.stringify(r));
  // Un faux WebSocket Phoenix (Supabase Realtime) : chaque prise ouverte est gardée ; le banc répond à la jonction, diffuse, coupe.
  const sockets = [];
  if (ws) {
    class FauxWS { constructor(url) { this.url = String(url); this.readyState = 0; this.envoyes = []; this.ouverteA = Date.now(); sockets.push(this); setTimeout(() => { this.readyState = 1; this.onopen && this.onopen(); }, 5); }
      send(t) { try { this.envoyes.push(JSON.parse(t)); } catch (_) {} }
      close() { if (this.readyState === 3) return; this.readyState = 3; setTimeout(() => this.onclose && this.onclose(), 0); }
      repondre(statut = 'ok') { const j = this.envoyes.find((m) => m.event === 'phx_join'); if (j) this.onmessage && this.onmessage({ data: JSON.stringify({ topic: j.topic, event: 'phx_reply', ref: j.ref, payload: { status: statut, response: {} } }) }); }
      diffuser(l) { const j = this.envoyes.find((m) => m.event === 'phx_join'); if (j) this.onmessage && this.onmessage({ data: JSON.stringify({ topic: j.topic, event: 'broadcast', payload: { event: 'ligne', type: 'broadcast', payload: l } }) }); }
      couper() { this.readyState = 3; this.onclose && this.onclose(); } }
    f.ctx.WebSocket = FauxWS;
  } else f.ctx.WebSocket = undefined;
  if (recoMs) f.ctx.__VRM_DIST_RECO_MS = recoMs;
  // Les minuteries du vm sont ramenées à 2 ms (_fond-vm.cjs) : on NOTE chaque délai demandé ; un délai d'1 s ou plus ne part
  // jamais ici (« long ») — c'est ce qui permet de juger le délai qui double et le réveil sans attendre.
  const delais = [];
  if (ws) { const st0 = f.ctx.setTimeout; f.ctx.setTimeout = (fn, ms) => { delais.push(Number(ms) || 0); return Number(ms) >= 1000 ? 0 : st0(fn, ms); }; }
  const reseau = { lecturesFile: 0, patch: [], push: [] };
  // Les chemins du CLIC, remplacés par des espions (le banc juge la file, pas Vinted).
  const gestes = [];
  const rep0 = { exec: { ok: true, status: 200 }, prix: { accepte: true, etape: 'fait', prixVu: 79 }, cmd: { accepte: true, etape: 'fait' }, masquer: { ok: true, faits: [{ id: ITEM, ok: true }] }, lbc: { accepte: true } };
  const reponses = Object.assign({}, rep0);
  f.ctx.executerPourApp = async (msg, sender) => { gestes.push({ quoi: 'exec', msg, sender, compte: etat.connecte }); return typeof reponses.exec === 'function' ? reponses.exec(msg) : reponses.exec; };
  f.ctx.prixAttExecuter = async (c, num) => { gestes.push({ quoi: 'prix', c, num, compte: etat.connecte }); return reponses.prix; };
  f.ctx.executerCommande = async (msg) => { gestes.push({ quoi: 'cmd', msg, compte: etat.connecte }); return reponses.cmd; };
  f.ctx.masquerCoeur = async (dom, ids, voulu) => { gestes.push({ quoi: 'masquer', ids, voulu }); return reponses.masquer; };
  f.ctx.repondreLeboncoin = async (msg) => { gestes.push({ quoi: 'lbc', msg }); return reponses.lbc; };
  f.ctx.travailDabord = async () => ({ tabId: 7 });
  const orig = f.ctx.fetch;
  const rep = (status, body) => ({ ok: status >= 200 && status < 400, status, headers: { get: () => 'application/json' }, json: async () => body, text: async () => JSON.stringify(body) });
  f.ctx.fetch = async (url, opts = {}) => {
    const u = decodeURIComponent(String(url));
    const m = (opts.method || 'GET').toUpperCase();
    if (/^https:\/\/vrm\.center\/api\/push/.test(u)) { let b = {}; try { b = JSON.parse(opts.body || '{}'); } catch (_) {} reseau.push.push(b); return rep(200, { ok: true }); }
    if (/\/rest\/v1\/app_data/.test(u) && m === 'POST' && /presence_/.test(String(opts.body || ''))) {
      let rows = []; try { rows = JSON.parse(opts.body); } catch (_) {}
      for (const r of rows) presences[r.id] = r;
      return rep(201, []);
    }
    if (/\/rest\/v1\/app_data\?/.test(u) && /cmd_dist_/.test(u)) {
      const eq = /[?&]id=eq\.([^&]+)/.exec(u), like = /[?&]id=like\.cmd_dist_/.test(u);
      if (m === 'GET') {
        reseau.lecturesFile++;
        let rows = like ? Object.values(table) : (eq && table[eq[1]] ? [table[eq[1]]] : []);
        if (/meta->>etat=eq\.attente/.test(u)) rows = rows.filter((r) => r.data.etat === 'attente');
        rows.sort((a, b) => a.id.localeCompare(b.id));
        return rep(200, rows.map((r) => ({ id: r.id, owner: r.owner, data: JSON.parse(JSON.stringify(r.data)) })));
      }
      if (m === 'PATCH') {
        const own = (/[?&]owner=eq\.([^&]+)/.exec(u) || [])[1];
        const cond = (/meta->>etat=eq\.([^&]+)/.exec(u) || [])[1];
        const r = eq && table[eq[1]];
        let corps = {}; try { corps = JSON.parse(opts.body || '{}'); } catch (_) {}
        reseau.patch.push({ id: eq && eq[1], cond: cond || null, etat: corps.data && corps.data.etat });
        if (!r || (own && r.owner !== own) || (cond && r.data.etat !== cond)) return rep(200, []);
        r.data = corps.data;
        return rep(200, [{ id: r.id }]);
      }
    }
    return orig(url, opts);
  };
  return Object.assign(f, { table, presences, reseau, gestes, reponses, etat, sockets, delais });
}
const tick = async (f) => (typeof f.ctx.distanceTick === 'function' ? f.ctx.distanceTick('banc') : { absent: true });
const sansEspace = (f) => { delete f.store.vrmDistSuivant; };

async function controles({ bg, appTexte, notif = path.join(RACINE, 'api', '_lib', 'distance-notif.js') }) {
  const res = [];
  const dit = (ok, m, d) => res.push({ ok: !!ok, m, d: d == null ? '' : (typeof d === 'string' ? d : JSON.stringify(d).slice(0, 400)) });
  const essaie = async (m, fn) => { try { await fn(); } catch (e) { dit(false, m + ' — a levé', String(e && e.stack || e).slice(0, 300)); } };
  let A = null;
  try { A = await chargerApp(appTexte); } catch (e) { dit(false, 'A0 src/aDistance.js se charge', e.message); }
  const cmd = (o) => A.nouvelleCommandeDistance(Object.assign({ owner: MOI, alea: 'banc' + String(++seq).padStart(4, '0'), maintenant: Date.now() - 5000 }, o));
  const ligne = (c, extra = {}) => ({ id: c.id, owner: extra.owner || MOI, data: Object.assign({}, c.data, extra.data || {}) });

  // ══ A : LA RÈGLE ══
  if (A) await essaie('A', async () => {
    const c = cmd({ geste: 'prix', site: 'vinted', compte: UID, args: { id: ITEM, prix: 79, prixAvant: 85 }, avant: 85 });
    dit(c && /^cmd_dist_[a-z0-9]{8,40}$/.test(c.id) && c.data.etat === 'attente' && c.data.pour === MOI && c.data.cle === `vinted:${UID}:prix:${ITEM}` && c.data.avant === 85,
      'A1 une baisse permise ⇒ une ligne `cmd_dist_*` en attente, au vendeur, avec sa clé et le prix d’avant', c && c.data);
    dit(c && !A.adistCommande(c.data).refus, 'A2 … que la règle accepte telle quelle', c && A.adistCommande(c.data));
    dit(cmd({ geste: 'supprimer', site: 'vinted', compte: UID, args: { id: ITEM } }) === null, 'A3 un geste hors liste (supprimer) ⇒ aucune ligne');
    dit(cmd({ geste: 'masquer', site: 'leboncoin', compte: 'abc', args: { id: ITEM } }) === null, 'A4 un site non permis pour ce geste ⇒ aucune ligne');
    dit(cmd({ geste: 'prix', site: 'vinted', compte: 'x y', args: { id: ITEM, prix: 79, prixAvant: 85 } }) === null, 'A5 un compte illisible ⇒ aucune ligne');
    dit(cmd({ geste: 'prix', site: 'vinted', compte: UID, args: { id: ITEM, prix: 90, prixAvant: 85 } }) === null, 'A6 une HAUSSE ⇒ aucune ligne');
    dit(cmd({ geste: 'accepter', site: 'vinted', compte: UID, args: { tx: '501', oid: '601' } }) === null, 'A7 accepter une offre SANS confirmation ⇒ aucune ligne');
    const acc = cmd({ geste: 'accepter', site: 'vinted', compte: UID, args: { tx: '501', oid: '601', prix: 70 }, confirme: true });
    dit(acc && !A.adistCommande(acc.data).refus, 'A8 accepter AVEC sa confirmation ⇒ permise', acc && acc.data);
    const t1 = JSON.parse(JSON.stringify(c.data)); t1.args.prix = 10;
    const t2 = JSON.parse(JSON.stringify(c.data)); t2.compte = UID2;
    dit(A.adistCommande(t1).refus === 'empreinte' && A.adistCommande(t2).refus === 'empreinte', 'A9 un argument ou le compte changé APRÈS le dépôt ⇒ refusée (empreinte)', [A.adistCommande(t1), A.adistCommande(t2)]);
    const t3 = Object.assign({}, c.data, { etat: 'pris', prisLe: 1, appareil: 'x', code: 'y' });
    dit(!A.adistCommande(t3).refus, 'A10 l’état écrit par l’extension ne casse pas l’empreinte');
    const r1 = cmd({ geste: 'repondre', site: 'vinted', compte: UID, args: { conv: '7001', texte: '  Bonjour, oui elle est dispo \r\n ' } });
    dit(r1 && r1.data.args.texte === 'Bonjour, oui elle est dispo', 'A11 une réponse : texte nettoyé avant l’empreinte', r1 && r1.data.args);
    dit(cmd({ geste: 'repondre', site: 'vinted', compte: UID, args: { conv: '7001', texte: '   ' } }) === null, 'A12 une réponse vide ⇒ aucune ligne');
  });

  // ══ B : LA VUE ══
  if (A) await essaie('B', async () => {
    const t = Date.now();
    const v = A.vueCommandeDistance({ id: 'cmd_dist_abcdefgh', etat: 'attente', demandeLe: String(t - 25 * H), expire: String(t - H) }, t);
    dit(v && v.etat === 'perimee', 'B1 en attente après 24 h ⇒ « périmée » même si aucun ordinateur ne l’a écrite', v);
    const p = A.vueCommandeDistance({ id: 'cmd_dist_abcdefgh', etat: 'pris', demandeLe: String(t - 20 * 60000), prisLe: String(t - 16 * 60000) }, t);
    dit(p && p.etat === 'incertain', 'B2 prise sans issue depuis 15 min ⇒ « pas sûr »', p);
    const g = A.groupesFile([{ id: 'a', etat: 'attente', demandeLe: t }, { id: 'b', etat: 'pris', demandeLe: t }, { id: 'c', etat: 'fait', demandeLe: t, finiLe: t }, { id: 'd', etat: 'refuse', demandeLe: t, finiLe: t }, { id: 'e', etat: 'annulee', demandeLe: t }], t);
    dit(g.attente.length === 1 && g.cours.length === 1 && g.fait.length === 1 && g.refuse.length === 1, 'B3 les quatre groupes de la file, une annulée n’y est pas', g);
    const pr = (id, age, comptes) => A.adistPresence({ id: 'presence_' + id, atMs: String(t - age), appareil: { nav: 'chrome', systeme: 'mac' }, comptes }, t);
    const p1 = pr('aaaaaaaaaaaaaaaa', 30000, [{ site: 'vinted', id: UID }]), p2 = pr('bbbbbbbbbbbbbbbb', 10 * 60000, [{ site: 'vinted', id: UID2 }]);
    dit(p1.allume && !p2.allume, 'B4 un navigateur vu il y a 30 s est allumé, il y a 10 min éteint', [p1.allume, p2.allume]);
    const e = A.etatOrdinateurs([p1, p2], t);
    dit(e.niveau === 'allume' && e.allumes.length === 1 && A.etatOrdinateurs([p2], t).niveau === 'eteint' && A.etatOrdinateurs([], t).niveau === 'aucun' && A.etatOrdinateurs(null, t).niveau === 'passu',
      'B5 l’état des ordinateurs : allumé · éteint · aucun · pas su (jamais deviné)', e.niveau);
    const o = A.ordinateurPour([p1, pr('cccccccccccccccc', 1000, [{ site: 'vinted', id: UID2 }])], 'vinted', UID2);
    dit(o && o.ouvert && o.p.id === 'cccccccccccccccc', 'B6 un geste part de l’ordinateur qui a CE compte ouvert', o);
    dit(A.ordinateurPour([p2], 'vinted', UID) === null, 'B7 aucun ordinateur allumé ⇒ personne (le geste attend)');
  });

  // ══ C : LE MIROIR ══
  if (A) await essaie('C', async () => {
    const sel = A.selectBoite(20);
    dit(!/(^|,)data(,|$)/.test(sel) && /i0:data->payload->conversations->0->>id/.test(sel) && /l19:/.test(sel), 'C1 la boîte : projetée champ par champ, jamais `select=data`', sel.slice(0, 120));
    const b = A.conversationsDe({ cap: '2026-11-22T08:00:00Z', i0: '7001', u0: true, t0: '2026-11-22T07:59:00Z', d0: 'Toujours dispo ?', l0: 'acheteuse_x', i1: null });
    dit(b && b.conversations.length === 1 && b.conversations[0].nonLu && b.conversations[0].qui === 'acheteuse_x', 'C2 une conversation lue, non lue dite', b);
    const f = A.filDe({ cap: '2026-11-22T08:00:00Z', tx: '501', msgs: [
      { entity_type: 'message', created_at_ts: 1795340000, entity: { id: 1, body: 'Bonjour', user_id: 999 } },
      { entity_type: 'offer_request_message', created_at_ts: 1795340100, entity: { offer_request_id: 601, transaction_id: 501, status: 10, current: true, price: { amount: '70.0' }, user_id: 999 } },
      { entity_type: 'offer_request_message', created_at_ts: 1795340200, entity: { offer_request_id: 602, transaction_id: 501, status: 30, current: true, price: { amount: '65.0' } } }] }, UID);
    const of = f.messages.filter((m) => m.sorte === 'offre');
    dit(of.length === 2 && of[0].enAttente === true && of[0].prix === 70 && of[1].enAttente === false, 'C3 une offre en attente = courante ET statut 10 (mesuré) ; 30 n’est pas en attente', of);
  });

  // ══ D : LE BLOC RECOPIÉ ══
  {
    const a = BLOC_RE.exec(appTexte), b = BLOC_RE.exec(fs.readFileSync(bg, 'utf8'));
    dit(a && b && a[1] === b[1], 'D1 le bloc <a-distance-regle> de l’extension est la copie exacte de l’app');
  }

  // ══ E–L : L'EXTENSION ══
  if (!A) return res;
  const prixL = (o = {}) => ligne(cmd(Object.assign({ geste: 'prix', site: 'vinted', compte: UID, args: { id: ITEM, prix: 79, prixAvant: 85 }, avant: 85, num: '134' }, o.cmd || {})), o);
  await essaie('E', async () => {
    const l = prixL();
    const f = monterExt({ src: bg, lignesCmd: [l], session: false });
    await tick(f);
    dit(f.reseau.lecturesFile === 0 && f.gestes.length === 0, 'E1 sans session VRM ⇒ aucune lecture de la file, aucun geste', f.reseau);
    const l2 = prixL({ owner: AUTRE });
    const g = monterExt({ src: bg, lignesCmd: [l2] });
    await tick(g);
    dit(typeof g.ctx.distanceTick === 'function' && g.gestes.length === 0 && g.table[l2.id].data.etat === 'attente', 'E2 la ligne d’un AUTRE vendeur ⇒ aucun geste, rien écrit', g.gestes);
    // Rangée sous SON compte mais annoncée pour un autre vendeur (`pour`) : jamais exécutée.
    const c3 = A.nouvelleCommandeDistance({ owner: AUTRE, geste: 'prix', site: 'vinted', compte: UID, args: { id: ITEM, prix: 79, prixAvant: 85 }, alea: 'pourautr', maintenant: Date.now() - 5000 });
    const h = monterExt({ src: bg, lignesCmd: [{ id: c3.id, owner: MOI, data: c3.data }] });
    await tick(h);
    dit(typeof h.ctx.distanceTick === 'function' && h.gestes.length === 0 && h.table[c3.id].data.etat === 'attente', 'E3 une ligne à lui qui annonce un AUTRE vendeur (`pour`) ⇒ aucun geste', h.gestes);
  });
  await essaie('F', async () => {
    const l = prixL();
    const f = monterExt({ src: bg, lignesCmd: [l] });
    await tick(f);
    const d = f.table[l.id].data;
    const g0 = f.gestes[0] || {};
    dit(f.gestes.length === 1 && g0.quoi === 'prix' && g0.c && g0.c.uid === UID && g0.c.vouluC === 7900 && g0.c.avantC === 8500 && g0.compte === UID,
      'F1 le bon compte connecté ⇒ UN geste, par le chemin de la baisse (compte, prix voulu, prix VU)', f.gestes);
    dit(f.reseau.patch.some((p) => p.cond === 'attente' && p.etat === 'pris'), 'F2 … pris par une écriture CONDITIONNELLE (attente → pris)', f.reseau.patch);
    dit(d.etat === 'fait' && d.avant === 85 && d.apres === 79 && d.finiLe > 0, 'F3 … « fait » avec avant → après (85 → 79)', d);
    const pres = Object.values(f.presences);
    dit(pres.length >= 1, 'F4 … la présence de ce navigateur est publiée', Object.keys(f.presences));
    dit(f.reseau.push.some((b) => b.action === 'distance' && b.id === l.id), 'F5 … une notification est demandée (relue par le serveur : l’identifiant seul)', f.reseau.push);
    // Rejouée : la même ligne remise en attente (base rejouée, worker redémarré) ⇒ jamais deux fois.
    f.table[l.id].data = JSON.parse(JSON.stringify(l.data));
    sansEspace(f);
    await tick(f);
    dit(f.gestes.length === 1, 'F6 rejouée (ligne remise en attente) ⇒ JAMAIS une seconde fois', f.gestes.length);
    // Réponse : par l'interface (`executerPourApp`, origine de l'app).
    const r = ligne(cmd({ geste: 'repondre', site: 'vinted', compte: UID, args: { conv: '7001', texte: 'Oui, dispo' } }));
    const g = monterExt({ src: bg, lignesCmd: [r] });
    await tick(g);
    const m = (g.gestes[0] || {}).msg || {};
    dit(g.gestes.length === 1 && m.uid === UID && m.method === 'POST' && m.endpoint === '/api/v2/conversations/7001/replies' && m.body && m.body.reply && m.body.reply.body === 'Oui, dispo' && g.table[r.id].data.etat === 'fait',
      'F7 répondre ⇒ le chemin du clic de l’app (liste blanche, interface de la page), « fait »', g.gestes);
    const ac = ligne(cmd({ geste: 'accepter', site: 'vinted', compte: UID, args: { tx: '501', oid: '601', conv: '7001', prix: 70 }, confirme: true }));
    const h = monterExt({ src: bg, lignesCmd: [ac] });
    await tick(h);
    const ma = (h.gestes[0] || {}).msg || {};
    dit(ma.method === 'PUT' && ma.endpoint === '/api/v2/transactions/501/offer_requests/601/accept' && ma.confirme === true && h.table[ac.id].data.apres === 70, 'F8 accepter ⇒ PUT …/accept avec SA confirmation, prix dit', ma);
  });
  await essaie('G', async () => {
    for (const [nom, o, code] of [['autre compte', { connecte: UID2 }, 'autre-compte'], ['pause Vinted', { pause: true }, 'pause'], ['vérification', { captcha: true }, 'verification'], ['aucun compte', { connecte: null }, 'absent']]) {
      const l = prixL();
      const f = monterExt(Object.assign({ src: bg, lignesCmd: [l] }, o));
      await tick(f);
      const pres = Object.values(f.presences)[0];
      const ret = pres && pres.data && Array.isArray(pres.data.retenues) ? pres.data.retenues : [];
      dit(f.gestes.length === 0 && f.table[l.id].data.etat === 'attente' && !f.reseau.patch.length && ret.some((x) => x.id === l.id && x.code === code),
        `G ${nom} ⇒ la ligne n’est PAS touchée, aucun geste, la présence dit « ${code} »`, { gestes: f.gestes.length, etat: f.table[l.id].data.etat, ret });
      if (nom === 'autre compte') { f.etat.connecte = UID; sansEspace(f); await tick(f); dit(f.gestes.length === 1 && f.table[l.id].data.etat === 'fait', 'G5 … partie au retour du bon compte, une fois', f.gestes.length); }
    }
  });
  await essaie('H', async () => {
    const c = cmd({ geste: 'prix', site: 'vinted', compte: UID, args: { id: ITEM, prix: 79, prixAvant: 85 }, maintenant: Date.now() - 25 * H });
    const l = ligne(c);
    const f = monterExt({ src: bg, lignesCmd: [l] });
    await tick(f);
    dit(f.gestes.length === 0 && f.table[l.id].data.etat === 'expiree', 'H1 périmée (24 h) ⇒ « expirée », aucun geste', f.table[l.id].data.etat);
    const l2 = prixL(); l2.data.args = Object.assign({}, l2.data.args, { prix: 10 });
    const g = monterExt({ src: bg, lignesCmd: [l2] });
    await tick(g);
    dit(g.gestes.length === 0 && g.table[l2.id].data.etat === 'refuse' && g.table[l2.id].data.code === 'empreinte', 'H2 un prix changé dans la ligne après le dépôt ⇒ refusée (empreinte), aucun geste', g.table[l2.id].data);
  });
  await essaie('I', async () => {
    const a = prixL(), b = ligne(cmd({ geste: 'masquer', site: 'vinted', compte: UID, args: { id: '91010002' } }));
    const f = monterExt({ src: bg, lignesCmd: [a, b] });
    await tick(f);
    dit(f.gestes.length === 1, 'I1 deux commandes ⇒ UNE seule par passage', f.gestes.length);
    sansEspace(f); await tick(f);
    dit(f.gestes.length === 2 && f.gestes[1].quoi === 'masquer' && f.gestes[1].voulu === true, 'I2 … la seconde au passage suivant (masquer)', f.gestes.map((x) => x.quoi));
    const c = prixL();
    const g = monterExt({ src: bg, lignesCmd: [c] });
    g.reponses.prix = { accepte: false, code: 'plafond', raison: 'plafond atteint' };
    await tick(g);
    const d = g.table[c.id].data;
    dit(d.etat === 'attente' && d.reports === 1 && d.pasAvant > Date.now() && d.attend === 'plafond', 'I3 « plafond » ⇒ REMISE en attente (bornée), jamais un refus', d);
  });
  await essaie('J', async () => {
    const l = ligne(cmd({ geste: 'repondre', site: 'leboncoin', compte: 'lbc1', args: { conv: 'conv-abc', texte: 'Bonjour' } }));
    const f = monterExt({ src: bg, lignesCmd: [l], lbcOnglets: ['lbc1', 'lbc2'] });
    await tick(f);
    dit(f.gestes.length === 0 && f.table[l.id].data.etat === 'attente', 'J1 Leboncoin : deux comptes ouverts ⇒ attend (jamais deux comptes à la fois)', f.gestes);
    const g = monterExt({ src: bg, lignesCmd: [ligne(cmd({ geste: 'repondre', site: 'leboncoin', compte: 'lbc1', args: { conv: 'conv-abc', texte: 'Bonjour' } }))], lbcOnglets: ['lbc1'] });
    await tick(g);
    dit(g.gestes.length === 1 && g.gestes[0].quoi === 'lbc' && g.gestes[0].msg.conv === 'conv-abc', 'J2 … le bon compte seul ⇒ part, par le chemin Leboncoin', g.gestes);
  });
  await essaie('K', async () => {
    const f = monterExt({ src: bg, lignesCmd: [] });
    await tick(f);
    const ids = Object.keys(f.presences);
    const p = ids[0] && f.presences[ids[0]].data;
    dit(ids.length === 1 && /^presence_[a-f0-9]{16}$/.test(ids[0]) && p && p.v === 1 && Array.isArray(p.comptes) && p.comptes.some((c) => c.site === 'vinted' && c.id === UID) && p.atMs > 0,
      'K1 la présence : SA ligne `presence_{16 hex}` (jamais `main`), le compte Vinted de ce navigateur, l’heure', { ids, p });
  });
  await essaie('L', async () => {
    const l = prixL();
    const f = monterExt({ src: bg, lignesCmd: [l] });
    f.reponses.prix = { accepte: false, code: 'tout-arrete', raison: 'tout est arrêté' };
    await tick(f);
    dit(f.table[l.id].data.etat === 'refuse', 'L1 « Tout arrêter » ⇒ refusée et dite, jamais une attente', f.table[l.id].data);
  });
  // ══ N : LA PRISE TEMPS RÉEL, ROBUSTE (MV3 : coupure, réveil, worker tué) ══
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const attendreQue = async (fn, ms = 2000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await dormir(10); } return !!fn(); };
  await essaie('N', async () => {
    const f = monterExt({ src: bg, lignesCmd: [], ws: true, recoMs: 40 });
    await tick(f);
    await attendreQue(() => f.sockets.length && f.sockets[0].envoyes.length);
    const s0 = f.sockets[0], j = s0 && s0.envoyes.find((m) => m.event === 'phx_join');
    dit(f.sockets.length === 1 && j && j.topic === 'realtime:vrm-lignes:' + MOI && j.payload && j.payload.config && j.payload.config.private === true && j.payload.access_token === 'jeton.vrm.banc' && /\/realtime\/v1\/websocket\?apikey=/.test(s0.url),
      'N1 un passage ouvre UNE prise sur SON sujet privé, avec SON jeton (rien d’autre envoyé)', s0 && s0.envoyes);
    // Déposée PENDANT que la prise se joint : la jonction relit la file (rattrapage), sans attendre l'alarme.
    const l = prixL(); f.table[l.id] = JSON.parse(JSON.stringify(l));
    s0.repondre('ok');
    await attendreQue(() => f.gestes.length === 1 && f.table[l.id].data.etat === 'fait', 3000);
    dit(f.gestes.length === 1 && f.table[l.id].data.etat === 'fait', 'N2 à la jonction, la file est RELUE : la commande déposée pendant la connexion part (rattrapage)', f.table[l.id].data.etat);
    // Une ligne diffusée par la base réveille la file tout de suite.
    delete f.store.vrmDistSuivant;
    const l2 = ligne(cmd({ geste: 'masquer', site: 'vinted', compte: UID, args: { id: '91010002' } })); f.table[l2.id] = JSON.parse(JSON.stringify(l2));
    s0.diffuser({ id: l2.id, owner: MOI });
    await attendreQue(() => f.gestes.length === 2, 3000);
    dit(f.gestes.length === 2 && f.gestes[1].quoi === 'masquer', 'N3 une ligne diffusée par la base réveille la file (sans alarme)', f.gestes.map((x) => x.quoi));
    // Un message d'un AUTRE vendeur n'est jamais pris.
    delete f.store.vrmDistSuivant;
    const l3 = prixL({ cmd: { args: { id: '91010003', prix: 79, prixAvant: 85 } } }); l3.owner = AUTRE; f.table[l3.id] = JSON.parse(JSON.stringify(l3));
    await dormir(200);
    const lu0 = f.reseau.lecturesFile;
    s0.diffuser({ id: l3.id, owner: AUTRE });
    await dormir(300);
    dit(f.gestes.length === 2 && f.reseau.lecturesFile === lu0, 'N4 une diffusion pour un autre vendeur ne réveille rien (pas même une lecture de la file)', { g: f.gestes.length, lectures: f.reseau.lecturesFile - lu0 });
    delete f.table[l3.id];
    // COUPURE : retentée après 40 ms, puis 80 ms (le délai DOUBLE), jamais en rafale.
    const der = () => f.sockets[f.sockets.length - 1];
    const couperEtAttendre = async () => { const n = f.sockets.length; der().couper(); await attendreQue(() => f.sockets.length > n, 2000); return f.sockets.length > n; };
    f.delais.length = 0;
    const r1 = await couperEtAttendre(); const d1 = f.delais.filter((x) => x >= 20);
    f.delais.length = 0;
    const r2 = await couperEtAttendre(); const d2 = f.delais.filter((x) => x >= 20);
    dit(r1 && r2 && d1.includes(40) && d2.includes(80) && !d2.includes(40), `N5 prise coupée ⇒ retentée, le délai DOUBLE (${d1.join(',')} puis ${d2.join(',')} ms)`, { d1, d2 });
    // Jointe ⇒ le délai repart à zéro.
    der().repondre('ok'); await dormir(30);
    f.delais.length = 0;
    const r3 = await couperEtAttendre(); const d3 = f.delais.filter((x) => x >= 20);
    dit(r3 && d3.includes(40) && !d3.includes(160), `N6 une prise jointe remet le délai à zéro (${d3.join(',')} ms)`, d3);
    // Le RÉVEIL : réseau revenu ⇒ tout de suite, même avec un délai de 10 min devant (il ne part pas ici).
    f.ctx.__VRM_DIST_RECO_MS = 600000;
    der().couper(); await dormir(60);
    const n0 = f.sockets.length;
    for (const fn of (f.j.globales.online || [])) fn();
    await attendreQue(() => f.sockets.length > n0, 2000);
    dit((f.j.globales.online || []).length >= 1 && f.sockets.length === n0 + 1, 'N7 « online » (réseau revenu) ⇒ la prise est rouverte TOUT DE SUITE, sans attendre le délai', { ecoute: (f.j.globales.online || []).length, n: f.sockets.length - n0 });
    // Refusée (migration absente) ⇒ pas de rafale : une tentative toutes les 5 min.
    f.ctx.__VRM_DIST_RECO_MS = 40;   // un délai court : une reprise en rafale se verrait
    const avantR = f.sockets.length; der().repondre('error'); await dormir(250);
    await tick(f); await dormir(50);
    dit(f.sockets.length === avantR, 'N8 jonction refusée ⇒ aucune nouvelle prise au passage suivant (5 min)', f.sockets.length - avantR);
  });
  await essaie('N9', async () => {
    // LE WORKER TUÉ : un nouveau background.js, le MÊME stockage, la MÊME base ⇒ l'alarme (un passage) rouvre la prise et rattrape la
    // file ; une commande déjà prise par le worker mort n'est JAMAIS rejouée.
    const store = {}, table = {};
    const a = prixL(), b = ligne(cmd({ geste: 'masquer', site: 'vinted', compte: UID, args: { id: '91010002' } }));
    const f1 = monterExt({ src: bg, lignesCmd: [a], ws: true, store, table });
    await tick(f1);
    const pris = f1.table[a.id].data.etat;
    // Le worker meurt ; pendant ce temps la ligne « a » est remise en attente (base rejouée), « b » est déposée.
    f1.table[a.id].data = JSON.parse(JSON.stringify(a.data));
    table[b.id] = JSON.parse(JSON.stringify(b));
    delete store.vrmDistSuivant;
    const f2 = monterExt({ src: bg, lignesCmd: [], ws: true, store, table });
    await tick(f2);   // l'alarme de 30 s
    await attendreQue(() => f2.sockets.length === 1, 1500);
    dit(pris === 'fait' && f2.gestes.length === 1 && f2.gestes[0].quoi === 'masquer' && f2.sockets.length === 1 && table[a.id].data.etat === 'attente',
      'N9 worker tué puis relancé (même stockage) : la prise est rouverte, la file rattrapée (« b » part), « a » déjà prise JAMAIS rejouée', { pris, gestes: f2.gestes.map((x) => x.quoi), sockets: f2.sockets.length });
    const src = fs.readFileSync(bg, 'utf8');
    dit(/onStartup\.addListener\(\(\) => \{[^\n]*distanceReveil\('demarrage'\)/.test(src) && /onInstalled\.addListener\(\(\) => \{[^\n]*distanceReveil\('installation'\)/.test(src) && /lance\('distance', \(\) => distanceTick\('alarme'\)\)/.test(src),
      'N10 réveil branché : démarrage de Chrome, installation / mise à jour, alarme de 30 s');
  });
  // ══ M : LA NOTIFICATION (api/_lib/distance-notif.js, EXÉCUTÉE) ══
  await essaie('M', async () => {
    process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'cle-de-banc';
    const N = await import(pathToFileURL(notif).href);
    const { contexteVendeur } = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'owner.js')).href);
    const jouer = (ligneBase, id = 'cmd_dist_abcdefgh1') => contexteVendeur.run({ owner: MOI }, async () => {
      const urls = [], envois = [];
      const fetcher = async (u) => { urls.push(decodeURIComponent(u)); return { ok: true, json: async () => (ligneBase ? [ligneBase] : []) }; };
      const r = await N.notifierDistance(id, { fetcher, envoyer: async (p) => { envois.push(p); return { sent: 1 }; } });
      return { r, urls, envois };
    });
    const a = await jouer({ id: 'cmd_dist_abcdefgh1', etat: 'fait', geste: 'prix', avant: '85', apres: '79', num: '134' });
    dit(a.envois.length === 1 && /85 € → 79 €/.test(a.envois[0].body) && /N°134/.test(a.envois[0].body) && a.envois[0].tag === 'vrm-dist-cmd_dist_abcdefgh1-fait' && /tab=adistance/.test(a.envois[0].url),
      'M1 une issue « fait » relue ⇒ UNE notification « 85 € → 79 € », étiquetée par issue, qui ouvre Mes comptes', a.envois);
    dit(a.urls.length === 1 && /owner=eq\.0b0b0b0b/.test(a.urls[0]) && !/select=data(&|$)/.test(a.urls[0]), 'M2 … la ligne relue au nom du vendeur de la session, projetée', a.urls);
    const b = await jouer({ id: 'cmd_dist_abcdefgh1', etat: 'attente', geste: 'prix' });
    dit(b.envois.length === 0, 'M3 sans issue écrite (encore en attente) ⇒ rien ne part, quoi que dise le corps', b.r);
    const c = await jouer(null, 'pas-une-commande');
    dit(c.r.status === 400 && c.envois.length === 0, 'M4 un identifiant hors famille ⇒ 400, rien envoyé', c.r);
  });
  return res;
}

const MUT = {
  'ext : sans rattrapage à la jonction': ['bg', "          distanceTick('rejoint').catch(() => {});        // le rattrapage", "          void 0;"],
  'ext : délai fixe': ['bg', "Math.min(DIST_RECO_MAX_MS, distRecoBase() * 2 ** Math.max(0, Math.min(10, essais - 1)))", 'distRecoBase()'],
  'ext : délai jamais remis à zéro': ['bg', "Object.assign(_distCanal, { etat: 'joint', essais: 0, pasAvant: 0 });", "Object.assign(_distCanal, { etat: 'joint', pasAvant: 0 });"],
  'ext : pas de reprise après coupure': ['bg', "      _distCanal.etat = 'ferme';\n      distCanalPlusTard();\n", "      _distCanal.etat = 'ferme';\n"],
  'ext : réseau revenu ignoré': ['bg', "try { addEventListener('online', () => { distanceReveil('reseau').catch(() => {}); }); } catch (_) {}", ''],
  'ext : refus en rafale': ['bg', "_distCanal.etat = 'refuse'; _distCanal.pasAvant = Date.now() + DIST_RECO_MAX_MS;", "_distCanal.etat = 'ferme';"],
  'ext : diffusion de tous': ['bg', "if (!r || String(r.owner || '') !== moi || !ADIST_RE_ID.test(String(r.id || ''))) return;\n      distanceTick('temps-reel')", "if (!r) return;\n      distanceTick('temps-reel')"],
  'ext : autre vendeur': ['bg', "if (String(row.owner || '') !== moi || String(d.pour || '') !== moi) { noterDiag('distance_autre_vendeur');", "if (false) { noterDiag('distance_autre_vendeur');"],
  'ext : rejouée': ['bg', "    if (vus[id]) { issues.push('deja'); continue; }                       // prise par ce navigateur", "    if (false) { issues.push('deja'); continue; }"],
  'ext : prise sans condition': ['bg', "const pris = await relaisEcrire(x.id, moi, dPris, 'attente');", 'const pris = await relaisEcrire(x.id, moi, dPris, null);'],
  'ext : périmée exécutée': ['bg', "if (!dem || !fin || t > fin || dem > t + 120000) { await finirDist(", "if (!dem || !fin) { await finirDist("],
  'ext : autre compte accepté': ['bg', "    if (ici[0].id !== c.compte) return { attend: 'autre-compte' };\n    // L'onglet", "    // L'onglet"],
  'ext : pause ignorée': ['bg', "    if (await pauseVinted()) return { attend: 'pause' };\n    const ar", "    const ar"],
  'ext : vérification ignorée': ['bg', "if (ar && ar.quoi === 'captcha') return { attend: 'verification' };", ''],
  'ext : deux comptes Leboncoin': ['bg', "if (ici.length > 1) return { attend: 'deux-comptes' };", ''],
  'ext : deux par passage': ['bg', "if (partie || (t < suivant && suivant - t < 10 * 60000))", 'if ((t < suivant && suivant - t < 10 * 60000))'],
  'ext : plafond = refus': ['bg', "if (i.etat === 'attendre' && reports < ADIST_REPORTS) {", 'if (false) {'],
  'ext : sans présence': ['bg', "const ok = await supabaseUpsert('app_data', [{ id: `presence_${id}`, data }], 'id');", 'const ok = false;'],
  'ext : sans notification': ['bg', "  if (etat !== 'attente' && etat !== 'pris') distanceAvertir(id);\n", ''],
  'règle : empreinte ignorée': ['les-deux', "  if (String(d.empreinte || '') !== adistEmpreinte(d)) return { refus: 'empreinte' };\n", ''],
  'règle : hausse permise': ['les-deux', "|| !(c < av)) return", ') return'],
  'règle : accepter sans confirmation': ['les-deux', "const ADIST_CONFIRMER = ['accepter', 'republier'];", "const ADIST_CONFIRMER = ['republier'];"],
  'règle : supprimer permis': ['les-deux', "  republier: ['vinted'],\n", "  republier: ['vinted'], supprimer: ['vinted'],\n"],
  'app : périmée jamais dite': ['app', "if (brut === 'attente' && fin && maintenant > fin) etat = 'perimee';\n  else if", 'if'],
  'app : allumé sans limite': ['les-deux', "allume: atMs > 0 && maintenant - atMs < ADIST_ALLUME_MS && atMs <= maintenant + 120000", 'allume: atMs > 0'],
  'app : offre 30 en attente': ['app', "enAttente: e.current === true && Number(e.status) === 10,", 'enAttente: e.current === true,'],
  'serveur : sans issue, notifie': ['api', "if (!l || !FINIS.includes(String(l.etat || ''))) return null;", 'if (!l) return null;'],
  'serveur : autre vendeur lu': ['api', "&owner=eq.${encodeURIComponent(owner)}&select=", '&select='],
  'app : boîte entière': ['app', "  const champs = ['cap:data->>capturedAt'];", "  const champs = ['cap:data->>capturedAt', 'data'];"],
};

(async () => {
  const tmp = (txt) => { const f = path.join(os.tmpdir(), `bg-dist-${process.pid}-${Math.random().toString(36).slice(2)}.js`); fs.writeFileSync(f, txt); return f; };
  const iSrc = process.argv.indexOf('--src');
  const bgBase = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : BG;
  const appBase = fs.readFileSync(F_APP, 'utf8');
  const base = await controles({ bg: bgBase, appTexte: appBase });
  let ko = 0;
  for (const c of base) { if (!c.ok) ko++; console.log((c.ok ? '✅ ' : '❌ ') + c.m + (c.ok || !c.d ? '' : '  → ' + c.d)); }
  console.log(`\n${base.length - ko}/${base.length} contrôles verts`);
  if (process.argv.includes('--prouve')) {
    console.log('\n── preuve : mutations (chacune doit faire rougir au moins un contrôle) ──');
    const bgSrc = fs.readFileSync(bgBase, 'utf8');
    let tenues = 0;
    for (const [nom, [portee, de, vers]] of Object.entries(MUT)) {
      let b = bgSrc, a = appBase, notif;
      if (portee === 'api') {
        const n0 = fs.readFileSync(path.join(RACINE, 'api', '_lib', 'distance-notif.js'), 'utf8');
        if (!n0.includes(de)) { console.log(`❌ mutation ${nom} : introuvable dans distance-notif.js`); continue; }
        notif = path.join(RACINE, 'api', '_lib', `.mut-distance-${process.pid}-${Math.random().toString(36).slice(2)}.js`);
        fs.writeFileSync(notif, n0.split(de).join(vers));
      }
      if (portee === 'bg' || portee === 'les-deux') { if (!b.includes(de)) { console.log(`❌ mutation ${nom} : introuvable dans background.js`); continue; } b = b.split(de).join(vers); }
      if (portee === 'app' || portee === 'les-deux') { if (!a.includes(de)) { console.log(`❌ mutation ${nom} : introuvable dans src/aDistance.js`); continue; } a = a.split(de).join(vers); }
      const f = tmp(b);
      const r = await controles({ bg: f, appTexte: a, ...(notif ? { notif } : {}) });
      try { fs.unlinkSync(f); } catch (_) {}
      if (notif) { try { fs.unlinkSync(notif); } catch (_) {} }
      const rouges = r.filter((x) => !x.ok && !/^D1 /.test(x.m));
      if (rouges.length) tenues++;
      console.log(`${rouges.length ? '✅' : '❌'} mutation ${nom} : ${rouges.length} rouge(s)${rouges.length ? ' — ' + rouges[0].m : ''}`);
    }
    console.log(`${tenues}/${Object.keys(MUT).length} mutations tenues`);
    if (tenues !== Object.keys(MUT).length) ko++;
  }
  process.exit(ko ? 1 : 0);
})();
