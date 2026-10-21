// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — 5.204 : LA VRAIE DATE D'ARRIVÉE, LA NOTIFICATION D'UN CODE NEUF, ET
//  LES COLIS À CONFIRMER AVANT LA DATE LIMITE (node scripts/audit-retrait-confirmer.cjs)
//
//  Le VRAI `background.js` dans un `vm` (`_fond-vm.cjs` : base à état, faux
//  Vinted qui compte, `chrome.storage.local` à état). Formes servies = celles
//  MESURÉES en lecture seule sur sa base le 21 octobre (`created_at_ts` en ISO
//  avec décalage ; « Confirmation nécessaire » : `event_group: return_shipment`,
//  actions `all_is_good`, `interpolation_values.subtitle.return_shipment_date`
//  « 21 sept. 15:59 »). Données inventées.
//  A. retraitDeConversation : `arriveLe` = l'heure du PREMIER message d'arrivée.
//  B. noterRetrait : range `arriveLe`, garde la plus ancienne, et un CODE NEUF
//     (et lui seul) part au serveur (`/api/push`, action « retrait », la
//     transaction seule) ; envoi raté ⇒ gardé en file, renvoyé ensuite.
//  C. confirmationDeConversation : la date limite, l'année lue sans deviner
//     (passage d'année compris), « pas su » sur un texte illisible, réglée
//     quand une action plus récente suit.
//  D. capterConfirmations : borné, garde, file Vinted ; lecture ratée ⇒ rien
//     écrit (lecture KO, écriture OK).
//  E. la règle de l'app (`src/aConfirmer.js`) : trois états.
//  `--src chemin` : un autre background.js (le code d'avant, §6.1).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const { faireFond } = require('./_fond-vm.cjs');

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d != null && !c ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { ko++; console.log(`❌ ${m} — a levé : ${String((e && e.message) || e).slice(0, 160)}`); } };
const pret = (f, n) => typeof f.ctx[n] === 'function';

// ── formes mesurées (inventées) ────────────────────────────────────────────
const msgArrivee = (ts, extra = '') => ({ entity_type: 'action_message', created_at_ts: ts,
  entity: { title: 'Ton colis est arrivé !', subtitle: `Rends-toi au point relais Consigne Banc, 1 RUE INVENTÉE, 35000 VILLE pour le récupérer. Scanne ton code de retrait ou saisis le code C65735${extra}` } });
const convRetrait = (msgs) => ({ conversation: { id: 900001, transaction: { id: 30000000001, item_id: 1, item_title: 'Baskets banc', current_user_side: 'buyer' }, messages: msgs } });
const msgConfirm = (ts, lim) => ({ entity_type: 'action_message', event_type: 'delivered', event_group: 'return_shipment', created_at_ts: ts,
  entity: { title: 'Confirmation nécessaire', subtitle: `Merci de vérifier d’ici le ${lim} que la commande est dans le même état…`,
    actions: [{ title: 'Tout est OK ', action: 'all_is_good', primary: true }, { title: "J'ai un problème", action: 'i_have_issues' }],
    interpolation_values: { subtitle: { username: 'acheteur_banc', return_shipment_date: lim } } } });
const convConfirm = (tx, msgs, side = 'seller') => ({ conversation: { id: 700000 + Number(String(tx).slice(-3)), transaction: { id: tx, item_id: 5, item_title: 'Paire en retour', current_user_side: side }, messages: msgs } });

(async () => {
  // ═══ A ═══
  console.log('── A. La vraie date d’arrivée (l’heure du message, pas de la lecture)');
  await essaie('A', async () => {
    const f = faireFond({});
    const r = f.ctx.retraitDeConversation(convRetrait([
      { entity_type: 'status_message', created_at_ts: '2026-10-10T09:00:00+02:00', entity: { title: 'Commande envoyée' } },
      msgArrivee('2026-10-13T10:08:35+02:00'),
      msgArrivee('2026-10-15T18:00:00+02:00', ' (rappel)'),
    ]));
    dit(r && r.code === 'C65735', 'le code est toujours lu', r && r.code);
    dit(r && r.arriveLe === '2026-10-13T08:08:35.000Z', 'arriveLe = l’heure du PREMIER message d’arrivée (pas le rappel, pas la lecture)', r && r.arriveLe);
    const r2 = f.ctx.retraitDeConversation(convRetrait([{ ...msgArrivee('pas une date'), created_at_ts: 'pas une date' }]));
    dit(r2 && !r2.arriveLe, 'heure illisible ⇒ aucune date inventée', r2 && r2.arriveLe);
    const r3 = f.ctx.retraitDeConversation(convRetrait([{ ...msgArrivee(''), created_at_ts: 1760342915 }]));
    dit(r3 && r3.arriveLe === new Date(1760342915000).toISOString(), 'une heure en secondes est lue aussi', r3 && r3.arriveLe);
  });

  // ═══ B ═══
  console.log('\n── B. noterRetrait : la date rangée, et un CODE NEUF prévient le serveur');
  await essaie('B', async () => {
    const lignes = {};
    const f = faireFond({ lignes });
    const appels = []; let statut = 200;
    const f0 = f.ctx.fetch;
    f.ctx.fetch = async (u, o = {}) => {
      if (/vrm\.center\/api\/push/.test(String(u))) { appels.push({ url: String(u), auth: (o.headers || {}).Authorization, body: JSON.parse(o.body || '{}') });
        return { ok: statut < 400, status: statut, json: async () => ({}) }; }
      return f0(u, o);
    };
    f.ctx.authToken = async () => ({ access_token: 'jeton.banc.x', expires_at: Date.now() + 3600000 });
    const base = { tx: '30000000001', item: '1', titre: 'Baskets banc', lieu: 'Consigne Banc', code: 'C65735', qr: '', transporteur: 'vinted', conv: '900001', url: 'u', at: new Date().toISOString() };
    const e1 = await f.ctx.noterRetrait({ ...base, arriveLe: '2026-10-13T08:08:35.000Z' }, '111');
    const l = (lignes.panel_colis_relais || {})['30000000001'] || {};
    dit(e1 === true && l.arriveLe === '2026-10-13T08:08:35.000Z', 'la ligne panel_colis_relais porte la date d’arrivée', JSON.stringify(l.arriveLe));
    dit(appels.length === 1 && appels[0].body.action === 'retrait' && appels[0].body.tx === '30000000001' && /^Bearer /.test(appels[0].auth || ''),
      'un code neuf ⇒ UN appel /api/push { action: retrait, tx } avec la session', JSON.stringify(appels));
    dit(appels.length === 1 && !('code' in appels[0].body) && !('lieu' in appels[0].body), 'l’extension n’envoie ni le code ni le lieu (le serveur relit SA ligne)', JSON.stringify(appels[0] && appels[0].body));
    await f.ctx.noterRetrait({ ...base, arriveLe: '2026-10-15T08:00:00.000Z', lieu: 'Consigne Banc (horaires)' }, '111');
    const l2 = (lignes.panel_colis_relais || {})['30000000001'] || {};
    dit(l2.arriveLe === '2026-10-13T08:08:35.000Z', 'une relecture plus tardive ne repousse pas la date d’arrivée', l2.arriveLe);
    dit(appels.length === 1, 'le même code relu (lieu changé) : aucun nouvel appel', appels.length);
    statut = 503;
    await f.ctx.noterRetrait({ ...base, tx: '30000000002', code: 'C22222' }, '111');
    const file = (f.store.vrmRetraitNotifs || {});
    dit(appels.length === 2 && !!file['30000000002'], 'envoi raté (503) ⇒ gardé dans la file', JSON.stringify(file));
    statut = 200;
    await f.ctx.envoyerNotifsRetrait();
    dit(appels.length === 3 && !(f.store.vrmRetraitNotifs || {})['30000000002'], 'renvoyé ensuite, puis sorti de la file', `${appels.length} ${JSON.stringify(f.store.vrmRetraitNotifs)}`);
    await f.ctx.noterRetrait({ ...base, tx: '30000000003', code: '' , lieu: 'Relais sans code' }, '111');
    dit(appels.length === 3, 'un lieu SANS code ne sonne pas', appels.length);
    f.ctx.authToken = async () => null;
    await f.ctx.noterRetrait({ ...base, tx: '30000000004', code: 'C44444' }, '111');
    dit(appels.length === 3 && !!(f.store.vrmRetraitNotifs || {})['30000000004'], 'sans session VRM ⇒ rien envoyé, gardé pour plus tard (pas su)', JSON.stringify(f.store.vrmRetraitNotifs));
  });

  // ═══ C ═══
  console.log('\n── C. « Confirmation nécessaire » : la date limite, l’année lue sans deviner');
  await essaie('C', async () => {
    const f = faireFond({});
    if (!pret(f, 'confirmationDeConversation')) { dit(false, 'confirmationDeConversation existe', 'absente'); return; }
    const c = f.ctx.confirmationDeConversation(convConfirm(21802559254, [
      { entity_type: 'action_message', created_at_ts: '2026-09-10T10:00:00+02:00', entity: { title: 'Vendu', actions: [] } },
      msgConfirm('2026-09-19T15:59:07+02:00', '21 sept. 15:59')]));
    dit(c && !c.resolu && c.tx === '21802559254', 'en attente (dernière action = « Tout est OK »)', JSON.stringify(c));
    dit(c && c.limite === '2026-09-21T15:59' && c.limiteMs === Date.parse('2026-09-21T13:59:00Z'), 'limite = 21 sept. 2026 15:59 heure de Paris', c && `${c.limite} ${c.limiteMs}`);
    dit(c && c.quoi === 'retour' && /inbox\//.test(c.url || ''), 'un RETOUR qui revient, avec le lien de sa conversation', c && `${c.quoi} ${c.url}`);
    const mAchat = { ...msgConfirm('2025-12-31T10:00:00+01:00', '02 janv. 10:00'), event_group: 'delivery' };
    const n = f.ctx.confirmationDeConversation(convConfirm(21802559255, [mAchat], 'buyer'));
    dit(n && n.limite === '2026-01-02T10:00' && n.quoi === 'achat', 'passage d’année : 2 janv. après un message du 31 déc. 2025 ⇒ 2026 (et côté acheteur : un achat)', n && `${n.limite} ${n.quoi}`);
    const p = f.ctx.confirmationDeConversation(convConfirm(21802559256, [msgConfirm('2026-09-19T15:59:07+02:00', 'bientôt')]));
    dit(p && !p.resolu && p.limiteMs === null && p.limite === null, 'texte illisible ⇒ « pas su » (aucune date inventée)', p && JSON.stringify({ l: p.limite, m: p.limiteMs }));
    const loin = f.ctx.confirmationDeConversation(convConfirm(21802559257, [msgConfirm('2026-09-19T15:59:07+02:00', '21 mars 15:59')]));
    dit(loin && loin.limiteMs === null, 'une date à 6 mois du message n’est pas crue (ni 2026, ni 2027) ⇒ pas su', loin && loin.limite);
    const r = f.ctx.confirmationDeConversation(convConfirm(21802559258, [msgConfirm('2026-09-19T15:59:07+02:00', '21 sept. 15:59'),
      { entity_type: 'action_message', created_at_ts: '2026-09-20T09:00:00+02:00', entity: { title: 'Ta vente est finalisée.', actions: [] } }]));
    dit(r && r.resolu === true, 'une action plus récente ⇒ réglée (l’entrée sortira)', JSON.stringify(r));
  });

  // ═══ D ═══
  console.log('\n── D. capterConfirmations : borné, garde, lecture ratée ⇒ rien écrit');
  const ventes = (n) => ({ type: 'orders_sold', payload: { my_orders: Array.from({ length: n }, (_, i) => ({ transaction_id: 4000000000 + i, conversation_id: 800000 + i, status: 'Retour initié', transaction_user_status: 'waiting', title: 'R' + i })) } });
  const achats = { type: 'orders_purchased', payload: { my_orders: [
    { transaction_id: 4100000000, conversation_id: 810000, status: 'Commande livrée ! ', transaction_user_status: 'needs_action', title: 'A' },
    { transaction_id: 4100000001, conversation_id: 810001, status: 'Commande livrée ! ', transaction_user_status: 'waiting', title: 'B (rien à faire)' },
    { transaction_id: 4100000002, conversation_id: 810002, status: 'Commande finalisée', transaction_user_status: 'completed', title: 'C' }] } };
  const vintedConv = (req) => {
    const m = /\/api\/v2\/conversations\/(\d+)/.exec(req.chemin); if (!m) return { status: 404, body: {} };
    const cid = Number(m[1]);
    const tx = cid >= 810000 ? 4100000000 + (cid - 810000) : 4000000000 + (cid - 800000);
    const ts = new Date(Date.now() - 3600000).toISOString();
    const lim = new Date(Date.now() + 86400000);
    const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(lim);
    const g = (t) => (p.find((x) => x.type === t) || {}).value;
    return { status: 200, body: { conversation: { id: cid, transaction: { id: tx, item_id: 9, item_title: 'X', current_user_side: cid >= 810000 ? 'buyer' : 'seller' },
      messages: [msgConfirm(ts, `${g('day')} ${MOIS[Number(g('month')) - 1]} ${g('hour')}:${g('minute')}`)] } } };
  };
  await essaie('D', async () => {
    const lignes = { harvest_111_orders_sold: ventes(5), harvest_111_orders_purchased: achats };
    const f = faireFond({ lignes, vinted: vintedConv });
    if (!pret(f, 'capterConfirmations')) { dit(false, 'capterConfirmations existe', 'absente'); return; }
    f.ctx.gardeLecture = async () => null;
    await f.ctx.capterConfirmations('111');
    const lus = f.j.vinted.filter((v) => /conversations/.test(v.chemin));
    dit(lus.length === 3, 'au plus 3 conversations lues par visite', lus.length);
    dit(!lus.some((v) => /810001|810002/.test(v.chemin)), 'jamais un achat sans geste attendu ni une commande finalisée', lus.map((v) => v.chemin).join(' '));
    dit(f.j.maxEnVol <= 1, 'une requête à la fois', f.j.maxEnVol);
    const pc = lignes.panel_a_confirmer || {};
    dit(Object.keys(pc).length === 3 && Object.values(pc).every((e) => e.limiteMs > Date.now() && e.uid === '111'), 'panel_a_confirmer porte les 3, avec leur date limite et le compte', JSON.stringify(Object.keys(pc)));
    await f.ctx.capterConfirmations('111');
    const lus2 = f.j.vinted.filter((v) => /conversations/.test(v.chemin));
    dit(lus2.length === 6 && !lus2.slice(3).some((v) => lus.map((x) => x.chemin).includes(v.chemin)), 'la visite suivante lit les suivantes (pas les mêmes avant 6 h)', lus2.length);
  });
  await essaie('D2', async () => {
    const lignes = { harvest_111_orders_sold: ventes(2), harvest_111_orders_purchased: achats, panel_a_confirmer: { '1': { tx: '1', limiteMs: Date.now() + 3600000, at: new Date().toISOString() } } };
    const f = faireFond({ lignes, vinted: vintedConv, lectureKO: (u) => /panel_a_confirmer/.test(u) });
    if (!pret(f, 'capterConfirmations')) { dit(false, 'capterConfirmations existe', 'absente'); return; }
    f.ctx.gardeLecture = async () => null;
    await f.ctx.capterConfirmations('111');
    dit(!f.j.posts.some((ids) => ids.includes('panel_a_confirmer')), 'lecture de la ligne ratée (écriture possible) ⇒ RIEN écrit', JSON.stringify(f.j.posts));
    dit(Object.keys(lignes.panel_a_confirmer).length === 1, 'l’entrée déjà là n’est pas effacée', JSON.stringify(lignes.panel_a_confirmer));
    const f2 = faireFond({ lignes: { harvest_111_orders_sold: ventes(2) }, vinted: vintedConv, lectureKO: (u) => /orders_purchased/.test(u) });
    f2.ctx.gardeLecture = async () => null;
    await f2.ctx.capterConfirmations('111');
    dit(f2.j.vinted.length === 0, 'achats illisibles ⇒ aucune requête Vinted (pas su)', f2.j.vinted.length);
    const f3 = faireFond({ lignes: { harvest_111_orders_sold: ventes(2), harvest_111_orders_purchased: achats }, vinted: vintedConv });
    f3.ctx.gardeLecture = async () => ({ error: 'autre compte', code: 'compte' });
    await f3.ctx.capterConfirmations('111');
    dit(f3.j.vinted.length === 0, 'la garde du compte connecté refuse ⇒ aucune requête', f3.j.vinted.length);
  });

  // ═══ E ═══
  console.log('\n── E. La règle de l’app (src/aConfirmer.js) : trois états, jamais un faux');
  await essaie('E', async () => {
    const m = await import('file://' + path.join(__dirname, '..', 'src', 'aConfirmer.js'));
    const now = Date.parse('2026-10-21T10:00:00Z');
    dit(m.aConfirmerVisibles(undefined).etat === 'encours', 'lecture en cours ⇒ « encours »');
    dit(m.aConfirmerVisibles(null).etat === 'passu', 'ligne illisible ⇒ « passu » (jamais « rien à confirmer »)');
    const d = { a: { tx: '1', limiteMs: now + 3600000, uid: '1' }, b: { tx: '2', limiteMs: now - 60000, uid: '1' }, c: { tx: '3', limiteMs: null, msgAt: '2026-10-20T10:00:00Z', limiteTexte: '22 oct. 10:00', uid: '1' },
      e: { tx: '4', limiteMs: null, msgAt: '2026-10-10T10:00:00Z', uid: '1' }, f: { tx: '5', limiteMs: now + 7200000, uid: '9' } };
    const v = m.aConfirmerVisibles(d, { uidsOk: new Set(['1']), maintenant: now });
    dit(v.etat === 'lu' && v.liste.map((x) => x.tx).join(',') === '1,3', 'délai passé, vieux sans année, compte retiré ⇒ écartés ; la plus proche en tête', v.liste.map((x) => x.tx).join(','));
    dit(m.texteLimite(v.liste[1]) === '22 oct. 10:00', 'sans année lue, le texte de Vinted est recopié tel quel', m.texteLimite(v.liste[1]));
  });

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
