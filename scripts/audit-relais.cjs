// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DU RELAIS DU TÉLÉPHONE (5.183) — node scripts/audit-relais.cjs
//  « Quand je suis sur mon téléphone et que l'extension est allumée sur mon
//  ordinateur, je veux pouvoir faire des actions » (Julien, 16 octobre).
//
//  Le VRAI `background.js` dans un `vm` (`_fond-vm.cjs`) : une fausse base À
//  ÉTAT qui connaît le PROPRIÉTAIRE d'une ligne et l'écriture conditionnelle
//  (`PATCH …&meta->>etat=eq.attente`), un faux Vinted qui compte les requêtes.
//  Il juge ce qui PART chez Vinted et ce qui est ÉCRIT dans la ligne, jamais une
//  phrase :
//    · une commande permise s'exécute UNE fois ;
//    · rejouée (ligne remise en attente, service worker redémarré) : jamais
//      deux fois ;
//    · expirée ou annulée : refusée, jamais exécutée en retard ;
//    · hors liste blanche (DELETE d'une annonce, une lecture, une commande
//      inconnue) : refusée ;
//    · ligne d'un AUTRE vendeur : rien ;
//    · compte du cookie ≠ compte visé : refusée, et la raison nomme le compte
//      ouvert (« Chrome est connecté sur X ») ;
//    · le plafond de 20 actions/heure tient ;
//    · accepter une offre sans confirmation : refusé ;
//    · lecture de la file ratée : rien n'est exécuté ;
//    · sans session VRM : AUCUNE requête, même vers notre base.
//  `--src chemin` : la preuve sur le code d'AVANT (§6.1).
//  Aucune donnée réelle (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const SRC = cheminSource();

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

const MOI = '0b0b0b0b-0000-4000-8000-00000000000a', AUTRE = '0c0c0c0c-0000-4000-8000-00000000000b';
const UID = '111', UID2 = '222';
const SESSION = { access_token: 'jeton.vrm.banc', refresh_token: 'rt-banc', expires_at: Date.now() + 3600e3, user_id: MOI, email: 'banc@exemple.fr' };
let seq = 0;
const nid = () => 'cmd_relais_' + (Date.now() + (seq++)).toString(36) + 'banc0000';
const cmdRow = (cmd, args, extra = {}, rowExtra = {}) => ({ id: nid(), owner: MOI,
  data: Object.assign({ cmd, args, pour: MOI, demandeLe: Date.now() - 5000, expire: Date.now() + 9 * 60000, etat: 'attente', par: 'telephone' }, extra), ...rowExtra });
const replyArgs = (conv = 5501, uid = UID) => ({ uid, method: 'POST', endpoint: `/api/v2/conversations/${conv}/replies`, body: { reply: { body: 'Bonjour', photo_temp_uuids: null } } });

// Un fond avec une base qui connaît `owner` et le PATCH conditionnel.
function monter({ rel = [], session = true, connecte = UID, lectureFileKO = false, store = null, actions = null } = {}) {
  const st = store || {};
  if (session) st.vrmSession = SESSION; else delete st.vrmSession;
  st.vrmCloisonne = true;
  if (actions) st.vrmActions = actions;
  const comptes = [{ vinted_user_id: UID, login: 'compte_un', domain: 'www.vinted.fr', access_token: 'jt1' },
    { vinted_user_id: UID2, login: 'compte_deux', domain: 'www.vinted.fr', access_token: 'jt2' }];
  const f = faireFond({ src: SRC, connecte, comptes, store: st, vinted: (req) => ({ status: 200, body: { ok: true } }) });
  const table = {};
  for (const r of rel) table[r.id] = JSON.parse(JSON.stringify(r));
  const reseau = { base: 0, patch: [], lectures: 0 };
  const orig = f.ctx.fetch;
  const rep = (status, body) => ({ ok: status >= 200 && status < 400, status, headers: { get: () => 'application/json' },
    json: async () => body, text: async () => JSON.stringify(body) });
  f.ctx.fetch = async (url, opts = {}) => {
    const u = decodeURIComponent(String(url));
    if (/\/rest\/v1\//.test(u)) reseau.base++;
    const m = (opts.method || 'GET').toUpperCase();
    if (/\/rest\/v1\/app_data\?/.test(u) && /cmd_relais_/.test(u)) {
      const eq = /[?&]id=eq\.([^&]+)/.exec(u), like = /[?&]id=like\.cmd_relais_/.test(u);
      if (m === 'GET') {
        reseau.lectures++;
        if (like && lectureFileKO) return rep(522, '<html>522</html>');
        let rows = like ? Object.values(table) : (eq && table[eq[1]] ? [table[eq[1]]] : []);
        // La fausse base sert ce qu'elle a À L'INSTANT où la lecture est faite,
        // `metaEtat` (si posé) simule une ligne dont l'état a changé après la lecture.
        if (/meta->>etat=eq\.attente/.test(u)) rows = rows.filter((r) => (r.metaEtat || r.data.etat) === 'attente');
        rows.sort((a, b) => a.id.localeCompare(b.id));
        const lim = /[?&]limit=(\d+)/.exec(u); if (lim) rows = rows.slice(0, Number(lim[1]));
        const sel = (/[?&]select=([^&]+)/.exec(u) || [])[1] || '';
        return rep(200, rows.map((r) => { const d = Object.assign(JSON.parse(JSON.stringify(r.data)), r.metaEtat ? { etat: r.metaEtat } : {}); return sel === 'data' ? { data: d } : { id: r.id, owner: r.owner, data: d }; }));
      }
      if (m === 'PATCH') {
        const own = (/[?&]owner=eq\.([^&]+)/.exec(u) || [])[1];
        const cond = (/meta->>etat=eq\.([^&]+)/.exec(u) || [])[1];
        const r = eq && table[eq[1]];
        let corps = {}; try { corps = JSON.parse(opts.body || '{}'); } catch (_) {}
        reseau.patch.push({ id: eq && eq[1], cond: cond || null, etat: corps.data && corps.data.etat });
        if (!r || (own && r.owner !== own) || (cond && r.data.etat !== cond)) return rep(200, []);
        r.data = corps.data; delete r.metaEtat;
        return rep(200, [{ id: r.id }]);
      }
    }
    return orig(url, opts);
  };
  return Object.assign(f, { table, reseau });
}
const tick = (f) => f.ctx.relaisTick('banc');
const replies = (f) => f.j.vinted.filter((v) => v.methode === 'POST' && /\/replies$/.test(v.chemin)).length;

(async () => {
  console.log('── 0. La fonction existe');
  {
    const f = monter();
    dit(typeof f.ctx.relaisTick === 'function' && typeof f.ctx.traiterRelais === 'function', "l'extension sait relever les commandes du téléphone (relaisTick, traiterRelais)");
  }

  console.log('── 1. Sans session VRM : rien, pas même une lecture de notre base');
  await essaie('sans session', async () => {
    const r1 = cmdRow('exec', replyArgs());
    const f = monter({ rel: [r1], session: false });
    if (typeof f.ctx.relaisTick !== 'function') { dit(false, 'sans session : aucune requête', 'relaisTick absent'); return; }
    const avant = f.reseau.base;
    const r = await tick(f);
    dit(f.reseau.base === avant && replies(f) === 0, 'sans session : aucune requête vers la base ni vers Vinted', `base=${f.reseau.base - avant}, réponses=${replies(f)}, ${JSON.stringify(r)}`);
  });

  console.log('── 2. Une commande permise s\'exécute UNE fois');
  const store = {};
  const r2 = cmdRow('exec', replyArgs());
  await essaie('une fois', async () => {
    const f = monter({ rel: [r2], store });
    await tick(f);
    dit(replies(f) === 1, 'la réponse part chez Vinted une fois', `réponses=${replies(f)}`);
    dit(f.table[r2.id].data.etat === 'fait' && f.table[r2.id].data.resultat && f.table[r2.id].data.resultat.ok === true, "la ligne dit « fait » (écrit par l'extension)", JSON.stringify(f.table[r2.id].data.etat));
    dit(f.reseau.patch.some((p) => p.id === r2.id && p.cond === 'attente' && p.etat === 'pris'), 'la commande est PRISE par une écriture conditionnelle (etat=attente)', JSON.stringify(f.reseau.patch));
    const bat = f.lignes.relais_ext;
    dit(!!(bat && bat.vUid === UID && bat.vLogin === 'compte_un' && /^\d+\.\d+\.\d+$/.test(bat.ver) && bat.atMs > 0), 'le signe de vie dit la version et le compte Vinted ouvert', JSON.stringify(bat));
    // Rejouée : la ligne revient en attente (un téléphone qui renvoie la même).
    f.table[r2.id].data.etat = 'attente';
    await tick(f);
    dit(replies(f) === 1, 'remise en attente : JAMAIS exécutée deux fois', `réponses=${replies(f)}`);
    const postsBat = f.j.posts.filter((ids) => ids.includes('relais_ext')).length;
    dit(postsBat === 1, 'le signe de vie part au plus une fois par minute', `écritures=${postsBat}`);
  });
  await essaie('redémarrage', async () => {
    // Le service worker redémarre : la mémoire du « déjà fait » vit dans chrome.storage.
    const copie = JSON.parse(JSON.stringify(r2)); copie.data.etat = 'attente';
    const f = monter({ rel: [copie], store });
    await tick(f);
    dit(replies(f) === 0, 'service worker redémarré : toujours pas rejouée', `réponses=${replies(f)}`);
  });

  console.log('── 3. Expirée ou annulée : refusée, jamais exécutée en retard');
  await essaie('expirée', async () => {
    const r = cmdRow('exec', replyArgs(5502), { demandeLe: Date.now() - 11 * 60000, expire: Date.now() + 60000 });
    const f = monter({ rel: [r] });
    await tick(f);
    dit(replies(f) === 0 && f.table[r.id].data.etat === 'expiree', 'demandée il y a 11 min : refusée (« expiree »), rien chez Vinted', `${f.table[r.id].data.etat}, réponses=${replies(f)}`);
  });
  await essaie('échéance dépassée', async () => {
    const r = cmdRow('exec', replyArgs(5503), { demandeLe: Date.now() - 3 * 60000, expire: Date.now() - 1000 });
    const f = monter({ rel: [r] });
    await tick(f);
    dit(replies(f) === 0, 'échéance dépassée : rien chez Vinted', `réponses=${replies(f)}`);
  });
  await essaie('annulée', async () => {
    const r = cmdRow('exec', replyArgs(5504), { etat: 'annulee' });
    const f = monter({ rel: [r] });
    await tick(f);
    dit(replies(f) === 0 && f.table[r.id].data.etat === 'annulee', 'annulée par le téléphone : rien', `${f.table[r.id].data.etat}`);
  });
  await essaie('annulée entre la lecture et la prise', async () => {
    // Lue « attente », annulée juste avant la prise : l'écriture conditionnelle échoue.
    const r = cmdRow('exec', replyArgs(5505), { etat: 'annulee' }, { metaEtat: 'attente' });
    const f = monter({ rel: [r] });
    await tick(f);
    dit(replies(f) === 0, 'annulée pendant la relève : la prise conditionnelle échoue, rien ne part', `réponses=${replies(f)}`);
  });

  console.log('── 4. Hors liste blanche : refusé');
  await essaie('liste blanche', async () => {
    const del = cmdRow('exec', { uid: UID, method: 'DELETE', endpoint: '/api/v2/items/123456', body: null });
    const del2 = cmdRow('exec', { uid: UID, method: 'POST', endpoint: '/api/v2/items/123456/delete', body: null });
    const lect = cmdRow('exec', { uid: UID, method: 'GET', endpoint: '/api/v2/conversations/77', body: null });
    const inconnue = cmdRow('ventes', {});
    const ebay = cmdRow('ebayPreparer', { id: '12' });
    const f = monter({ rel: [del, del2, lect, inconnue, ebay] });
    await tick(f);
    dit(f.j.vinted.length === 0, 'DELETE, /delete, une lecture, « ventes », « ebayPreparer » : rien chez Vinted', JSON.stringify(f.j.vinted.map((v) => v.methode + ' ' + v.chemin)));
    const etats = [del, del2, lect, inconnue, ebay].map((r) => f.table[r.id].data.etat);
    dit(etats.every((e) => e === 'refuse'), 'chacune est marquée « refuse » avec sa raison', etats.join(','));
    dit(String((f.table[del.id].data.resultat || {}).code) === 'non-autorise', 'la raison dit « non autorisée »', JSON.stringify(f.table[del.id].data.resultat));
  });

  console.log('── 5. Ligne d\'un AUTRE vendeur : rien');
  await essaie('autre vendeur', async () => {
    const a = cmdRow('exec', replyArgs(5506), {}, { owner: AUTRE });
    const b = cmdRow('exec', replyArgs(5507), { pour: AUTRE });
    const f = monter({ rel: [a, b] });
    await tick(f);
    dit(replies(f) === 0, "propriétaire de la ligne ou destinataire ≠ la session : rien chez Vinted", `réponses=${replies(f)}`);
    dit(f.table[a.id].data.etat === 'attente' && f.table[b.id].data.etat === 'attente', "et la ligne d'un autre n'est pas touchée", `${f.table[a.id].data.etat},${f.table[b.id].data.etat}`);
  });

  console.log('── 6. Le compte du cookie n\'est pas celui visé : refusé, et dit');
  await essaie('autre compte', async () => {
    const r = cmdRow('exec', replyArgs(5508, UID));
    const bord = cmdRow('bordereau', { uid: UID, tx: '880001' });
    const f = monter({ rel: [r, bord], connecte: UID2 });
    await tick(f);
    dit(replies(f) === 0 && f.j.vinted.length === 0, 'rien ne part au nom du mauvais compte', JSON.stringify(f.j.vinted.map((v) => v.chemin)));
    const res = f.table[r.id].data.resultat || {};
    dit(f.table[r.id].data.etat === 'refuse' && /Chrome est connecté sur compte_deux/.test(res.raison || ''), 'répondre : refusé, « Chrome est connecté sur compte_deux »', JSON.stringify(res));
    const rb = f.table[bord.id].data.resultat || {};
    dit(f.table[bord.id].data.etat === 'refuse' && /Chrome est connecté sur compte_deux/.test(rb.raison || ''), 'bordereau : refusé, la raison nomme le compte ouvert', JSON.stringify(rb));
  });

  console.log('── 7. Le plafond de 20 actions/heure tient');
  await essaie('plafond', async () => {
    const t = Date.now();
    const actions = { [UID]: Array.from({ length: 19 }, (_, i) => t - 60000 - i * 1000) };
    const rows = [cmdRow('exec', replyArgs(5601)), cmdRow('exec', replyArgs(5602)), cmdRow('exec', replyArgs(5603))];
    const f = monter({ rel: rows, actions });
    await tick(f);
    dit(replies(f) === 1, '19 actions déjà dans l\'heure : 1 seule réponse part sur 3', `réponses=${replies(f)}`);
    const codes = rows.map((r) => (f.table[r.id].data.resultat || {}).code || f.table[r.id].data.etat);
    dit(codes.filter((c) => c === 'plafond').length === 2, 'les deux autres : refusées « plafond »', codes.join(','));
  });

  console.log('── 8. Accepter une offre exige sa confirmation');
  await essaie('accepter', async () => {
    const sans = cmdRow('exec', { uid: UID, method: 'PUT', endpoint: '/api/v2/transactions/9901/offer_requests/77/accept', body: null });
    const avec = cmdRow('exec', { uid: UID, method: 'PUT', endpoint: '/api/v2/transactions/9902/offer_requests/78/accept', body: null }, { confirme: true });
    const f = monter({ rel: [sans, avec] });
    await tick(f);
    const acc = f.j.vinted.filter((v) => /\/accept$/.test(v.chemin)).map((v) => v.chemin);
    dit(acc.length === 1 && /9902/.test(acc[0]), 'sans confirmation : refusée ; avec : une seule acceptation, sur SON clic', JSON.stringify(acc));
    dit((f.table[sans.id].data.resultat || {}).code === 'confirmation', 'la raison dit « confirmation »', JSON.stringify(f.table[sans.id].data.resultat));
  });

  console.log('── 9. Lecture de la file ratée : rien n\'est exécuté');
  await essaie('lecture ratée', async () => {
    const r = cmdRow('exec', replyArgs(5701));
    const f = monter({ rel: [r], lectureFileKO: true });
    const res = await tick(f);
    dit(replies(f) === 0 && f.table[r.id].data.etat === 'attente', 'la base répond 522 : rien chez Vinted, la commande reste en attente', `réponses=${replies(f)}, ${JSON.stringify(res)}`);
    dit(f.j.diags.includes('relais_lecture_ratee'), 'et c\'est noté au diagnostic', JSON.stringify(f.j.diags));
  });

  console.log(`\n${ok} contrôle(s) conforme(s), ${ko} non conforme(s).`);
  process.exit(ko ? 1 : 0);
})();
