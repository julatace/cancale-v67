// ══ 5.414 (`toutinterface`, 21 nov.) — PLUS AUCUNE ÉCRITURE PAR REQUÊTE : TOUT PAR L'INTERFACE ═══════════════
// Julien, 21 nov., mot pour mot : « tout doit être absolument parfait et irréprochable, surtout l'extension lorsqu'elle
// republie et envoie des messages aux favoris : elle ne doit pas se tromper, elle a le contrôle du clavier et de la
// souris. Comme on a dit, on ne fait plus les requêtes. »
// ⇒ Une ÉCRITURE chez Vinted (message, offre, réponse à une offre, ouverture d'une conversation, masquer/afficher,
//   prix, suppression, brouillon, mise en ligne) ne part JAMAIS d'une requête fabriquée par VRM : VRM ouvre la bonne
//   page dans l'ONGLET DE TRAVAIL, VÉRIFIE qu'elle montre le bon destinataire / la bonne annonce (identifiants dans
//   l'adresse, jamais un titre), clique et tape lettre à lettre (`vrm-formulaire.js`, clics `isTrusted:false` ASSUMÉS,
//   aucun maquillage), puis LIT la réponse que la PAGE a reçue de Vinted et la PREUVE à l'écran (message apparu,
//   offre affichée). Les LECTURES (GET) restent permises dans leurs budgets. `vintedPage` et `vintedSend` refusent
//   désormais toute méthode ≠ GET (filet : rien ne part, c'est dit) ; `audit-tout-interface.cjs` le tient.
// Garde-fous inchangés : compte de l'onglet (`pageVintedPour` + revérifié juste avant le geste), une requête / un geste
// à la fois (`requeteVinted`), pause 403/429, arrêt au captcha VISIBLE, écran plein et voile de l'onglet de travail.
const GESTES_INTERFACE = Object.freeze({
  ouvrir: { route: (d) => `/inbox/${d.conv}`, re: (d) => new RegExp(`^/inbox/${d.conv}/?$`) },
  message: { route: (d) => `/inbox/${d.conv}`, re: (d) => new RegExp(`^/inbox/${d.conv}/?$`) },
  offre: { route: (d) => `/inbox/${d.conv}`, re: (d) => new RegExp(`^/inbox/${d.conv}/?$`) },
  repondreOffre: { route: (d) => `/inbox/${d.conv}`, re: (d) => new RegExp(`^/inbox/${d.conv}/?$`) },
  favoriOuvrir: { route: () => '/inbox', re: () => /^\/inbox(\/|$)/ },
  masquer: { route: (d) => `/items/${d.id}`, re: (d) => new RegExp(`^/items/${d.id}(?:-[^/]*)?/?$`) },
  supprimer: { route: (d) => `/items/${d.id}`, re: (d) => new RegExp(`^/items/${d.id}(?:-[^/]*)?/?$`) },
  prix: { route: (d) => `/items/${d.id}/edit`, re: (d) => new RegExp(`^/items/${d.id}/edit/?$`) },
});
const ID_INTERFACE = /^[1-9]\d{0,19}$/;
const PHRASE_ELEMENT = (m) => `Vinted a changé sa page (élément « ${String(m || '?')} » introuvable ou en double) : VRM s'arrête proprement, rien n'est parti.`;
const PHRASE_IDENTITE = "la page de Vinted ne montre pas la bonne conversation / la bonne annonce : VRM s'arrête, rien n'est parti.";
// Les codes d'une étape qui s'arrête AVANT le geste (rien n'a été cliqué) : certain, « rien n'est parti ».
const AVANT_LE_GESTE = new Set(['selecteur', 'identite', 'captcha', 'etape', 'valeur', 'hors-vinted', 'script', 'onglet', 'photos-absentes']);
let _cleInterface = 0;
function cleInterface(geste) { _cleInterface = (_cleInterface + 1) % 1e6; return `i${String(geste || '').slice(0, 12)}${Date.now().toString(36)}${_cleInterface}`; }
// Le résultat d'une étape de page, rendu sous la forme d'une réponse de Vinted (celle que la PAGE a reçue) :
// les appelants gardent leurs règles (code 0, 4xx, 5xx…), plus `vu` (la preuve à l'écran) et `rienParti`.
function resultatInterface(o, geste) {
  const base = { viaPage: true, interface: true, geste };
  if (!o || typeof o !== 'object') return { ...base, status: 0, ok: false, json: null, incertain: true };
  if (o.ok && o.rep && typeof o.rep === 'object') return { ...base, status: Number(o.rep.status) || 0, ok: !!o.rep.ok, json: o.rep.json == null ? null : o.rep.json, vu: o.vu === true, conv: o.conv || '', envoye: o.envoye !== false, autre: !!o.autre };
  if (o.ok) return { ...base, status: 200, ok: true, json: null, sansRequete: true, vu: o.vu === true, conv: o.conv || '', envoye: false };
  const avant = !o.parti && AVANT_LE_GESTE.has(String(o.code || ''));
  if (o.code === 'captcha') return { ...base, status: 0, ok: false, json: null, captcha: true, robot: true, ...(avant ? { pause: true, rienParti: true } : { incertain: true }), raison: PHRASE_CAPTCHA };
  if (avant) return { ...base, status: 0, ok: false, json: null, rienParti: true, sansPage: o.code === 'identite' ? 'identite' : 'element', manque: o.manque || o.code, raison: o.code === 'identite' ? PHRASE_IDENTITE : PHRASE_ELEMENT(o.manque || o.code) };
  return { ...base, status: 0, ok: false, json: null, incertain: true, code: o.code || 'perdu' };
}
// UN geste par l'interface, dans la file Vinted (un à la fois), depuis l'onglet de travail du compte de l'onglet.
async function interfaceVinted(acc, geste, d, opts = {}) {
  const g = GESTES_INTERFACE[geste];
  const uid = String((acc && acc.vinted_user_id) || '');
  const x = d && typeof d === 'object' ? d : {};
  const ids = ['conv', 'tx', 'oid', 'itemId', 'receiverId'].filter((k) => x[k] != null);
  if (!g || !/^\d{1,20}$/.test(uid) || ids.some((k) => !ID_INTERFACE.test(String(x[k]))) || (x.id != null && !/^\d{4,15}$/.test(String(x.id)))) return { status: 0, ok: false, json: null, rienParti: true, sansPage: 'element', manque: 'geste', raison: PHRASE_ELEMENT('geste') };
  const domaine = (acc && acc.domain) || 'www.vinted.fr';
  return requeteVinted('page', async () => {
    const pg = await pageVintedPour(acc);
    if (pg.refus) { noterDiag('interface_' + pg.refus); return { status: 0, ok: false, json: null, rienParti: true, sansPage: pg.refus }; }
    const ot = await ongletTravailVinted(acc, uid, { chemin: g.route(x) });
    if (ot.refus) return { status: 0, ok: false, json: null, rienParti: true, sansPage: ot.refus === 'travail-ferme' ? 'onglet' : ot.refus, travailFerme: ot.refus === 'travail-ferme' };
    const tab = ot.tabId;
    let chemin = ''; try { chemin = new URL(String((await chrome.tabs.get(tab)).url || '')).pathname; } catch (_) { chemin = ''; }
    if (!g.re(x).test(chemin)) {
      if (!(await naviguerTravail(tab, `https://${domaine}${g.route(x)}`, g.re(x)))) { noterDiag('interface_navigation_ratee'); return { status: 0, ok: false, json: null, rienParti: true, sansPage: 'identite', raison: PHRASE_IDENTITE }; }
      await wait(900 + Math.round(Math.random() * 1600));   // la page de Vinted finit de se montrer
    } else if (ot.cree) await wait(1500 + Math.round(Math.random() * 1500));
    // Le compte de l'onglet, revérifié JUSTE avant le geste (il a pu basculer pendant la navigation).
    { const actif = await compteConnecte(domaine); if (!actif || String(actif) !== uid) { noterDiag('interface_compte_change'); return { status: 0, ok: false, json: null, rienParti: true, sansPage: 'compte' }; } }
    const o = await etapeFormulaire(acc, tab, geste, { ...x, cle: opts.cle || cleInterface(geste) });
    const r = resultatInterface(o, geste);
    // La conversation ouverte par la page (favori) : l'adresse de l'onglet la dit quand la réponse ne la porte pas.
    if (geste === 'favoriOuvrir' && r.ok && !r.conv) { try { const m = /^\/inbox\/([1-9]\d{0,19})\/?$/.exec(new URL(String((await chrome.tabs.get(tab)).url || '')).pathname); if (m) r.conv = m[1]; } catch (_) {} }
    if (r.ok && r.json && r.json.conversation && ID_INTERFACE.test(String(r.json.conversation.id)) && !r.conv) r.conv = String(r.json.conversation.id);
    noterDiag(`interface_${geste}_${r.ok ? (r.vu === false && ['message', 'offre'].includes(geste) ? 'pas_vu' : 'ok') : r.rienParti ? 'rien_' + String(r.manque || r.sansPage || 'parti').replace(/[^a-z-]/g, '').slice(0, 30) : 'incertain'}`);
    if (r.rienParti && r.raison) { try { await marquerOngletTravail(tab, r.raison); } catch (_) {} }
    return r;
  }, acc);
}
// « Marquer lue » comme le site : la conversation OUVERTE dans l'onglet de travail (Vinted la marque lue lui-même).
async function ouvrirConversationTravail(acc, conv) {
  if (!ID_INTERFACE.test(String(conv || ''))) return null;
  const r = await interfaceVinted(acc, 'ouvrir', { conv: String(conv), chemin: `^/inbox/${String(conv)}/?$` });
  if (r && typeof r === 'object') r.luAt = r.ok ? Date.now() : 0;
  return r;
}
// La conversation d'une transaction (pour une offre ou sa réponse) : par IDENTITÉ seulement — la conversation captée
// qui porte CETTE transaction, sinon la commande captée (`conversation_id`). Rien ⇒ '' (rien ne part).
async function convDeTransaction(uid, tx) {
  if (!/^\d{1,20}$/.test(String(uid || '')) || !ID_INTERFACE.test(String(tx || ''))) return '';
  try { const o = (await offresEnAttente(String(uid))).find((x) => String(x.tx) === String(tx)); if (o && ID_INTERFACE.test(String(o.conv))) return String(o.conv); } catch (_) {}
  try {
    const rows = await sbGetTout(`app_data?id=like.harvest_${uid}_conv_*&select=cid:data->payload->conversation->>id,tx:data->payload->conversation->transaction->>id`);
    const l = (Array.isArray(rows) ? rows : []).filter((r) => r && String(r.tx || '') === String(tx) && ID_INTERFACE.test(String(r.cid || '')));
    const cs = [...new Set(l.map((r) => String(r.cid)))];
    if (cs.length === 1) return cs[0];
  } catch (_) {}
  for (const k of ['orders_sold', 'orders_purchased']) {
    try {
      const r = await sbGet(`app_data?id=eq.harvest_${uid}_${k}&select=v:data->payload->my_orders`);
      const os = r && r[0] && Array.isArray(r[0].v) ? r[0].v : [];
      const cs = [...new Set(os.filter((o) => o && String(o.transaction_id) === String(tx) && o.conversation_id != null).map((o) => String(o.conversation_id)))].filter((c) => ID_INTERFACE.test(c));
      if (cs.length === 1) return cs[0];
    } catch (_) {}
  }
  return '';
}
// Répondre à une offre PAR L'INTERFACE : le fil est d'abord RELU (une lecture) — l'offre en attente qu'il montre doit
// être CETTE offre (identifiant), et une seule ; sinon rien ne part (le bouton « Accepter » de la page serait un autre).
async function repondreOffreInterface(acc, { conv, tx, oid, accepter }) {
  if (!ID_INTERFACE.test(String(conv || ''))) return { status: 0, ok: false, json: { message: 'conversation inconnue — rien n’est parti' }, rienParti: true, sansPage: 'identite', raison: 'la conversation de cette offre n’est pas connue de VRM : rien n’est parti.' };
  const lu = await vintedPage(acc, 'GET', `/api/v2/conversations/${conv}`, null, { timeoutMs: 12000, travail: true });
  if (lu && (lu.sansPage || lu.pause)) return { ...lu, rienParti: true };
  const c = lu && lu.ok && lu.json && lu.json.conversation;
  const d = c && Array.isArray(c.messages) ? derniereOffreEnAttente(c.messages, c.opposite_user && c.opposite_user.id) : null;
  if (!c || String(c.id) !== String(conv) || !d || String(d.oid) !== String(oid) || String(d.tx) !== String(tx)) { noterDiag('interface_offre_pas_la_bonne'); return { status: 0, ok: false, json: { message: 'offre plus en attente' }, rienParti: true, sansPage: 'identite', raison: "le fil relu ne montre pas CETTE offre en attente : rien n'est parti." }; }
  const r = await interfaceVinted(acc, 'repondreOffre', { conv: String(conv), tx: String(tx), oid: String(oid), accepter: !!accepter });
  if (r.ok && r.autre) { noterDiag('interface_offre_autre'); return { ...r, ok: false, incertain: true }; }
  return r;
}
