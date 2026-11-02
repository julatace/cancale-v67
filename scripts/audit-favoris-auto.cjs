// ════════════════════════════════════════════════════════════════════════════
//  MODE AUTOMATIQUE DES MESSAGES AUX FAVORIS (2 novembre 2026, extension 5.309)
//
//  Julien, « Oui, mode auto » : VRM écrit tout seul à qui met une annonce en
//  favori, avec beaucoup de garde-fous. Cet audit EXÉCUTE :
//   · la VRAIE route `api/compte.js?mode=favoris` (fausse base Supabase à état,
//     projections `select=` appliquées, filtres `cs.` / `->>` évalués comme
//     PostgREST, ligne neutre en comparer-et-échanger) ;
//   · le VRAI `executerMessageFavori` de `background.js` (scripts/_fond-vm.cjs).
//  Il vérifie chaque garde-fou de sa liste : éteint par défaut, allumage
//  confirmé, conversation existante, 30 jours, une fois par couple, paire
//  réservée/vendue/en pause/vendue ailleurs, garde absente ⇒ rien, attente
//  aléatoire, horaires, quotas heure/jour, montée progressive, pause 24 h sur un
//  frein, Stop immédiat, journal, identité prouvée seulement, lecture ratée ⇒ rien.
//  Aucune donnée réelle : tout est inventé (le dépôt est public).
//
//  `--prouve` (§6.1) : copie le code d'AVANT (origin/main par défaut, ou
//  `--avant <ref>`) dans un dossier temporaire et y lance les mêmes contrôles :
//  ils doivent être ROUGES. Puis des MUTATIONS (une règle affaiblie à la fois,
//  dans une copie de l'arbre) : chacune doit rendre au moins un contrôle rouge.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const RACINE = process.env.FAV_AUTO_RACINE || path.join(__dirname, '..');

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? '  → ' + String(d).slice(0, 300) : '')); } };

const U = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', UID = '123', NEUTRE = '00000000-0000-0000-0000-000000000000';
const H = 3600000, MIN = 60000;
// Lundi 2 novembre 2026, 14 h à Paris (13 h UTC).
const T0 = Date.parse('2026-11-02T13:00:00Z');

// ── La fausse base ───────────────────────────────────────────────────────────
function lirChemin(v, expr) { for (const p of expr.split(/->>|->/).slice(1)) v = v == null ? undefined : (/^\d+$/.test(p) && Array.isArray(v) ? v[Number(p)] : v[p]); return v; }
function contient(a, b) {
  if (Array.isArray(b)) return Array.isArray(a) && b.every((x) => a.some((y) => contient(y, x)));
  if (b && typeof b === 'object') return a && typeof a === 'object' && Object.keys(b).every((k) => contient(a[k], b[k]));
  return a === b;
}
function filtre(row, k, v) {
  if (k === 'select' || k === 'limit' || k === 'order' || k === 'on_conflict') return true;
  const champ = k === 'id' || k === 'owner' ? row[k] : lirChemin(row.data, k);
  const texte = /->>/.test(k) ? (champ == null ? null : typeof champ === 'object' ? JSON.stringify(champ) : String(champ)) : champ;
  if (v.startsWith('eq.')) return String(texte) === v.slice(3);
  if (v.startsWith('in.(')) return v.slice(4, -1).split(',').includes(String(texte));
  if (v.startsWith('like.')) { const re = new RegExp('^' + v.slice(5).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/%/g, '.*') + '$'); return re.test(String(texte)); }
  if (v.startsWith('cs.')) return contient(champ, JSON.parse(v.slice(3)));
  if (v === 'is.null') return champ == null;
  throw new Error('filtre inconnu ' + k + '=' + v);
}
function projette(row, select) {
  if (!select) return row;
  const out = {};
  for (const c of select.split(',')) {
    const m = /^(?:([A-Za-z_]\w*):)?(.+)$/.exec(c.trim()); const alias = m[1], expr = m[2];
    if (['id', 'owner', 'data'].includes(expr)) { out[alias || expr] = row[expr]; continue; }
    let v = lirChemin(row.data, expr);
    if (/->>[^>]*$/.test(expr) && v != null && typeof v !== 'string') v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias || expr.split(/->>|->/).pop()] = v === undefined ? null : v;
  }
  return out;
}
function faireBase() {
  const lignes = new Map(); // `${owner}|${id}` → row
  const etat = { lectureKO: () => false, appels: [] };
  const json = (j, status = 200) => new Response(JSON.stringify(j), { status });
  const fetch = async (url, o = {}) => {
    const u = new URL(url); etat.appels.push(u);
    if (!/supabase\.co$/.test(u.hostname)) throw new Error('réseau inattendu ' + u.hostname);
    if (u.pathname.endsWith('/auth/v1/user')) return json({ id: U });
    if (u.pathname.endsWith('/vinted_accounts')) return json([{ owner: U, vinted_user_id: UID }]);
    const service = o.headers && (o.headers.apikey === 'sb_secret_banc');
    const m = o.method || 'GET';
    const params = [...u.searchParams.entries()];
    if (m === 'GET') {
      if (etat.lectureKO(u)) return json({ message: 'panne' }, 503);
      let rows = [...lignes.values()].filter((r) => params.every(([k, v]) => filtre(r, k, v)));
      if (!service) rows = rows.filter((r) => r.owner === U);
      const lim = Number(u.searchParams.get('limit')) || Infinity;
      return json(rows.slice(0, lim).map((r) => projette(r, u.searchParams.get('select'))));
    }
    if (!service) return json({}, 403);
    if (m === 'POST') { const [row] = JSON.parse(o.body); const k = row.owner + '|' + row.id; if (lignes.has(k)) return json({}, 409); lignes.set(k, structuredClone(row)); return new Response(null, { status: 201 }); }
    if (m === 'PATCH') {
      const rows = [...lignes.values()].filter((r) => params.every(([k, v]) => filtre(r, k, v)));
      for (const r of rows) r.data = JSON.parse(o.body).data;
      return json(rows.map((r) => ({ id: r.id })));
    }
    return json({}, 405);
  };
  const poser = (id, data, owner = U) => lignes.set(owner + '|' + id, { owner, id, data: structuredClone(data) });
  const lire = (id, owner = U) => lignes.get(owner + '|' + id)?.data;
  return { fetch, poser, lire, etat, lignes };
}

// ── Le monde du vendeur (inventé) ────────────────────────────────────────────
// Trois favoris RÉCENTS (arrivés après l'allumage), prouvés par la forme `user_id`
// (une création native sur l'article 101 pour la personne 201).
function monde(b, { maintenant, favoris, dressing, garde, boite, reglages = true, trace = true }) {
  const notif = (id, user, item, ilYa) => ({ id, user_id: user, body: 'Camille a ajouté ton article à ses favoris.', link: `/items/${item}/conversation/new?from_notification=true`, created_at: new Date(maintenant - ilYa).toISOString() });
  b.poser(`harvest_${UID}_notifications`, { uid: UID, type: 'notifications', domain: 'www.vinted.fr', payload: { notifications: favoris.map((f) => notif(...f)) } });
  if (trace) b.poser(`harvest_${UID}_wreq_api_v2_conversations`, { uid: UID, method: 'POST', path: '/api/v2/conversations', body: JSON.stringify({ initiator: 'native-banc', item_id: '101', opposite_user_id: '201' }) });
  if (reglages) b.poser(`vrm_favoris_reglages_${UID}`, { version: 1, envoisActifs: false, message: '{Bonjour|Salut} {username} !', pourcentage: 10, offreMode: 'pct', offreValeur: null, arrondi: false, intervalleMinutes: 0, intervalleMaxMinutes: null });
  const items = dressing || [101, 102, 103, 104, 105, 106].map((id) => ({ id, is_closed: false, is_hidden: false, is_draft: false, is_reserved: false }));
  b.poser(`harvest_${UID}_listings`, { capturedAt: new Date(maintenant - H).toISOString(), payload: { pagination: { total_entries: items.length }, items } });
  b.poser('main', { vinted_offres_garde: garde === undefined ? { v: 1, at: maintenant - H, items: [], complet: true, manques: [], ambigus: 0 } : garde });
  b.poser(`harvest_${UID}_inbox`, { capturedAt: new Date(maintenant - H).toISOString(), payload: { conversations: boite || [{ id: 9, opposite_user: { id: 999 } }] } });
}

async function chargerRoute() {
  const mod = await import(path.join(RACINE, 'api', 'compte.js'));
  const auto = await import(path.join(RACINE, 'src', 'favorisAuto.js')).catch(() => null);
  return { handler: mod.default, auto };
}
function appelant(handler, b) {
  return async (action, extra = {}, methode) => {
    let code, body; const res = { setHeader() {}, status(v) { code = v; return this; }, json(v) { body = v; return this; }, end() { return this; } };
    const corps = action ? JSON.stringify({ action, ...extra }) : undefined;
    const req = { method: methode || (action ? 'POST' : 'GET'), query: { uid: UID, mode: 'favoris' }, headers: { authorization: 'Bearer banc.session.jwt', 'content-type': 'application/json' }, body: action ? JSON.parse(corps) : undefined,
      on(ev, fn) { if (ev === 'data' && corps) fn(Buffer.from(corps)); if (ev === 'end') fn(); return this; }, [Symbol.asyncIterator]: async function* () { if (corps) yield Buffer.from(corps); } };
    await handler(req, res); return { code, body };
  };
}
const REGLAGES = { actif: true, attenteMin: 10, attenteMax: 60, heureDebut: 9, heureFin: 21, jours: [1, 2, 3, 4, 5, 6, 7], parJour: 30, parHeure: 12 };

async function scenarios() {
  const { handler } = await chargerRoute();
  const ancienFetch = global.fetch, ancienNow = Date.now;
  process.env.SUPABASE_SERVICE_KEY = 'sb_secret_banc';
  let horloge = T0; Date.now = () => horloge;
  const allumer = async (call, extra = {}) => call('auto_regler', { reglages: { ...REGLAGES, ...extra }, confirme: true });
  const neuf = () => { const b = faireBase(); global.fetch = b.fetch; return { b, call: appelant(handler, b) }; };
  const file = (b) => [...b.lignes.values()].find((r) => r.owner === NEUTRE && /^favoris_file_/.test(r.id))?.data;
  try {
    // 1. Éteint par défaut ; l'allumage exige la confirmation.
    { horloge = T0; const { b, call } = neuf();
      monde(b, { maintenant: T0 + 3 * H, favoris: [['n1', 201, 101, 0]] });
      const t = await call('auto');
      dit(t.code === 200 && t.body.etat === 'eteint' && t.body.ajoute === false, 'éteint par défaut : le tour ne pose rien', JSON.stringify(t.body).slice(0, 200));
      const sans = await call('auto_regler', { reglages: REGLAGES });
      dit(sans.code === 400, "l'allumage sans confirmation est refusé par le serveur", sans.code + ' ' + JSON.stringify(sans.body));
      const avec = await allumer(call);
      dit(avec.code === 200 && avec.body.vue?.auto?.reglages?.actif === true && avec.body.vue.auto.allumeLe === T0, "allumage confirmé : réglages validés et date d'allumage posée", JSON.stringify(avec.body).slice(0, 200));
      const bad = await call('auto_regler', { reglages: { ...REGLAGES, heureDebut: 22, heureFin: 9 } });
      dit(bad.code === 400, 'réglages incohérents (fin avant début) refusés par le serveur'); }

    // 2. Chemin complet : attente aléatoire, puis un message ; extension simulée.
    { horloge = T0; const { b, call } = neuf(); await allumer(call);
      horloge = T0 + 5 * MIN;
      monde(b, { maintenant: horloge, favoris: [['n1', 201, 101, 0]] });
      const tot = await call('auto');
      dit(tot.body.ajoute === false && tot.body.etat === 'attente_favori', "favori tout neuf : rien avant l'attente tirée au hasard", JSON.stringify(tot.body).slice(0, 160));
      horloge = T0 + 5 * MIN + 61 * MIN;
      const t = await call('auto');
      dit(t.body.ajoute === true, "après l'attente (≤ 60 min) : un message est posé dans la file", JSON.stringify(t.body).slice(0, 200));
      const s = await call('suivant');
      dit(!!s.body.travail && s.body.travail.itemId === '101' && s.body.travail.recipientId === '201', 'la file délivre le message au destinataire PROUVÉ (article 101, personne 201)', JSON.stringify(s.body).slice(0, 200));
      const vieux = await call('consommer', { jeton: s.body.travail.jeton, version: '5.308.0' });
      dit(vieux.code === 409, "une extension 5.308 (sans garde « conversation existante ») n'obtient pas l'autorisation d'un message automatique", vieux.code);
      const c = await call('consommer', { jeton: s.body.travail.jeton, version: '5.309.0' });
      dit(c.code === 200 && c.body.travail.auto === true && c.body.travail.message === '{Bonjour|Salut} {username} !' && c.body.travail.offre?.valeur === 10, "l'extension 5.309 reçoit un travail marqué « auto », son message à variantes et son offre", JSON.stringify(c.body).slice(0, 200));
      const fin = await call('terminer', { jeton: s.body.travail.jeton, resultat: 'envoye', raison: '', ecrits: 3 });
      const j = fin.body.vue?.auto?.journal || [];
      dit(j[0] && j[0].etat === 'envoye' && j[0].notificationId === 'n1', 'le journal dit à qui le message est parti', JSON.stringify(j).slice(0, 200));
      horloge += 20 * MIN;
      const encore = await call('auto');
      dit(encore.body.ajoute === false, "un seul message par personne et par article, pour toujours (aucun second envoi)", JSON.stringify(encore.body).slice(0, 160));
      dit(b.etat.appels.every((u) => !/vinted/.test(u.hostname)), "le serveur n'appelle jamais Vinted"); }

    // 3. Paire réservée, vendue, en pause, vendue ailleurs : jamais.
    for (const [nom, dressing, garde, raison] of [
      ['réservée', [{ id: 101, is_reserved: true }], undefined, 'reservee'],
      ['vendue sur Vinted', [{ id: 101, is_closed: true, item_closing_action: 'sold' }], undefined, 'vendue'],
      ['en pause / masquée', [{ id: 101, is_hidden: true }], undefined, 'en_pause'],
      ['vendue ailleurs (garde)', [{ id: 101 }], { v: 1, at: T0, items: ['101'], complet: true, manques: [], ambigus: 0 }, 'vendue'],
    ]) {
      horloge = T0; const { b, call } = neuf(); await allumer(call); horloge = T0 + 2 * H;
      monde(b, { maintenant: horloge, favoris: [['n1', 201, 101, 61 * MIN]], dressing, garde });
      const t = await call('auto');
      const j = t.body.vue?.auto?.journal || [];
      dit(t.body.ajoute === false && j.some((x) => x.raison === raison), `paire ${nom} : aucun message, et le journal dit pourquoi (${raison})`, JSON.stringify(t.body).slice(0, 220));
    }
    // 4. Garde absente / incomplète / périmée ; dressing ancien ; boîte ancienne : RIEN.
    for (const [nom, opts, etat] of [
      ['garde absente', { garde: null }, 'garde_absente'],
      ['garde incomplète', { garde: { v: 1, at: T0, items: [], complet: false, manques: ['eBay'], ambigus: 0 } }, 'garde_absente'],
      ['garde périmée (> 48 h)', { garde: { v: 1, at: T0 - 50 * H, items: [], complet: true, manques: [], ambigus: 0 } }, 'garde_absente'],
    ]) {
      horloge = T0; const { b, call } = neuf(); await allumer(call); horloge = T0 + 2 * H;
      monde(b, { maintenant: horloge, favoris: [['n1', 201, 101, 61 * MIN]], ...opts });
      const t = await call('auto');
      dit(t.body.ajoute === false && t.body.etat === etat, `${nom} : rien ne part (« pas su » ≠ « oui »)`, JSON.stringify(t.body).slice(0, 160));
    }
    { horloge = T0; const { b, call } = neuf(); await allumer(call); horloge = T0 + 2 * H;
      monde(b, { maintenant: horloge, favoris: [['n1', 201, 101, 61 * MIN]] });
      b.poser(`harvest_${UID}_listings`, { capturedAt: new Date(horloge - 30 * H).toISOString(), payload: { pagination: { total_entries: 1 }, items: [{ id: 101 }] } });
      const t = await call('auto');
      dit(t.body.ajoute === false && t.body.etat === 'dressing_ancien', 'dressing lu il y a plus de 24 h : rien ne part', JSON.stringify(t.body).slice(0, 160));
      b.poser(`harvest_${UID}_listings`, { capturedAt: new Date(horloge - H).toISOString(), payload: { pagination: { total_entries: 9 }, items: [{ id: 101 }] } });
      const t2 = await call('auto');
      dit(t2.body.ajoute === false && t2.body.etat === 'dressing_partiel', 'dressing partiel : rien ne part', JSON.stringify(t2.body).slice(0, 160)); }
    // 5. Conversation existante avec cette personne (n'importe quel article) : jamais.
    { horloge = T0; const { b, call } = neuf(); await allumer(call); horloge = T0 + 2 * H;
      monde(b, { maintenant: horloge, favoris: [['n1', 201, 101, 61 * MIN]], boite: [{ id: 55, opposite_user: { id: 201 } }] });
      const t = await call('auto');
      dit(t.body.ajoute === false && (t.body.vue?.auto?.journal || []).some((x) => x.raison === 'conversation_existante'), 'une conversation existe déjà avec cette personne : VRM n’écrit pas', JSON.stringify(t.body).slice(0, 200)); }
    // 6. Lecture ratée : rien.
    { horloge = T0; const { b, call } = neuf(); await allumer(call); horloge = T0 + 2 * H;
      monde(b, { maintenant: horloge, favoris: [['n1', 201, 101, 61 * MIN]] });
      b.etat.lectureKO = (u) => u.searchParams.get('id') === `eq.harvest_${UID}_inbox` && !u.searchParams.has(`data->payload->conversations`) ? false : /inbox/.test(u.search) && u.searchParams.has('data->payload->conversations');
      const t = await call('auto');
      dit(t.body.ajoute === false && t.body.etat === 'lecture', 'la recherche de conversation échoue : rien ne part', JSON.stringify(t.body).slice(0, 160)); }
    // 7. Destinataire non prouvé : sauté et journalisé ; il ne bloque pas les autres.
    { horloge = T0; const { b, call } = neuf(); await allumer(call); horloge = T0 + 3 * H;
      // n1 (avant l'allumage, jamais repris) est là pour que la forme `user_id` soit PROUVÉE
      // par la création native (101 → 201) ; n9 n'a pas d'identifiant de personne lisible.
      monde(b, { maintenant: horloge, favoris: [['n1', 201, 101, 10 * H], ['n9', 'pas-un-id', 109, 2 * H], ['n2', 202, 102, 61 * MIN]] });
      const t = await call('auto');
      const j = t.body.vue?.auto?.journal || [];
      const s = await call('suivant');
      dit(j.some((x) => x.notificationId === 'n9' && x.raison === 'destinataire_non_prouve') && t.body.ajoute === true && s.body.travail?.recipientId === '202', 'un favori sans destinataire prouvé est sauté (journal) et ne bloque pas le suivant', JSON.stringify({ j, t: t.body.ajoute, s: s.body.travail }).slice(0, 300)); }
    // 8. Déjà contactée ces 30 jours (autre article) : jamais.
    { horloge = T0; const { b, call } = neuf(); await allumer(call); horloge = T0 + 2 * H;
      monde(b, { maintenant: horloge, favoris: [['n1', 201, 101, 61 * MIN]] });
      await call('auto'); const s = await call('suivant'); await call('consommer', { jeton: s.body.travail.jeton, version: '5.309.0' }); await call('terminer', { jeton: s.body.travail.jeton, resultat: 'envoye', ecrits: 3 });
      horloge += 2 * H;
      monde(b, { maintenant: horloge, favoris: [['n1', 201, 101, 3 * H], ['n7', 201, 107, 61 * MIN]], dressing: [101, 107].map((id) => ({ id })) });
      const t = await call('auto');
      dit(t.body.ajoute === false && (t.body.vue?.auto?.journal || []).some((x) => x.notificationId === 'n7' && x.raison === 'contacte_30j'), 'même personne, autre article, moins de 30 jours : VRM n’écrit pas', JSON.stringify(t.body).slice(0, 220)); }
    // 8 bis. Même personne, MÊME article, plus de 30 jours après : toujours jamais
    //        (un seul message par couple, pour toujours — la règle des 30 jours ne
    //        suffit pas à la tenir).
    { horloge = T0; const { b, call } = neuf(); await allumer(call); horloge = T0 + 2 * H;
      monde(b, { maintenant: horloge, favoris: [['n1', 201, 101, 61 * MIN]] });
      await call('auto'); const s = await call('suivant'); await call('consommer', { jeton: s.body.travail.jeton, version: '5.309.0' }); await call('terminer', { jeton: s.body.travail.jeton, resultat: 'envoye', ecrits: 3 });
      horloge += 31 * 24 * H;
      monde(b, { maintenant: horloge, favoris: [['n1b', 201, 101, 2 * H], ['n2', 202, 102, 61 * MIN]] });
      const t = await call('auto'); const s2 = await call('suivant');
      dit(t.body.ajoute === true && s2.body.travail?.recipientId === '202', 'même personne, même article, 31 jours après : jamais un 2e message — et le favori suivant passe (pas bloqué derrière)', JSON.stringify({ t: t.body.ajoute, s: s2.body.travail }).slice(0, 200)); }
    // 9. Horaires et jours.
    { horloge = T0; const { b, call } = neuf(); await allumer(call);
      horloge = Date.parse('2026-11-02T21:30:00Z'); // 22 h 30 à Paris
      monde(b, { maintenant: horloge, favoris: [['n1', 201, 101, 61 * MIN]] });
      const t = await call('auto');
      dit(t.body.ajoute === false && t.body.etat === 'hors_horaires', 'hors des horaires (22 h 30 à Paris) : rien ne part', JSON.stringify(t.body).slice(0, 160));
      horloge = T0; await allumer(call, { jours: [2, 3] }); horloge = T0 + 2 * H;
      const t2 = await call('auto');
      dit(t2.body.ajoute === false && t2.body.etat === 'hors_horaires', 'un lundi décoché : rien ne part', JSON.stringify(t2.body).slice(0, 160)); }
    // 10. Quotas : par heure, par jour, montée progressive, espacement.
    { horloge = T0; const { b, call } = neuf(); await allumer(call, { parHeure: 2, parJour: 30 });
      const favs = [1, 2, 3, 4, 5, 6].map((i) => ['n' + i, 200 + i, 100 + i, 0]);
      horloge = T0 + 2 * H;
      const envoyer = async () => { const t = await call('auto'); if (!t.body.ajoute) return t.body; const s = await call('suivant'); await call('consommer', { jeton: s.body.travail.jeton, version: '5.309.0' }); await call('terminer', { jeton: s.body.travail.jeton, resultat: 'envoye', ecrits: 3 }); return { envoye: true }; };
      monde(b, { maintenant: horloge, favoris: favs.map((f) => [f[0], f[1], f[2], 70 * MIN]) });
      const r1 = await envoyer(); const r2 = await envoyer();
      dit(r1.envoye && r2.etat === 'espacement', 'entre deux messages : un écart tiré au hasard (3 à 12 min)', JSON.stringify(r2));
      horloge += 13 * MIN; const r3 = await envoyer(); horloge += 13 * MIN; const r4 = await envoyer();
      dit(r3.envoye && r4.etat === 'quota_heure', 'limite par heure (2 réglés) : le 3e attend', JSON.stringify(r4));
      const f = file(b);
      dit(Array.isArray(f.autoEnvois) && f.autoEnvois.length === 2, 'le quota est tenu côté serveur, dans la ligne neutre (pas dans le navigateur)'); }
    { horloge = T0; const { b, call } = neuf(); await allumer(call, { parHeure: 20, parJour: 30 });
      horloge = T0 + H; monde(b, { maintenant: horloge, favoris: [['n1', 201, 101, 61 * MIN]] });
      const f = file(b); f.autoEnvois = Array.from({ length: 10 }, (_, i) => horloge - 20 * H + i * MIN); b.poser([...b.lignes.values()].find((r) => r.owner === NEUTRE).id, f, NEUTRE);
      const t = await call('auto');
      dit(t.body.ajoute === false && t.body.etat === 'quota_jour' && t.body.vue?.auto, 'montée progressive : 10 par jour la 1re semaine, même réglé à 30', JSON.stringify(t.body).slice(0, 160));
      const f2 = file(b); f2.groupes[U].auto.allumeLe = horloge - 8 * 24 * H; b.poser([...b.lignes.values()].find((r) => r.owner === NEUTRE).id, f2, NEUTRE);
      const t2 = await call('auto');
      dit(t2.body.etat !== 'quota_jour', '2e semaine : la limite passe à 20 (10 messages ne bloquent plus)', JSON.stringify(t2.body).slice(0, 160)); }
    // 11. Frein de Vinted : pause 24 h du mode auto sur ce compte, dite.
    { horloge = T0; const { b, call } = neuf(); await allumer(call); horloge = T0 + 2 * H;
      monde(b, { maintenant: horloge, favoris: [['n1', 201, 101, 61 * MIN], ['n2', 202, 102, 61 * MIN]] });
      await call('auto'); const s = await call('suivant'); await call('consommer', { jeton: s.body.travail.jeton, version: '5.309.0' });
      const fin = await call('terminer', { jeton: s.body.travail.jeton, resultat: 'refuse', raison: 'vinted_robot', ecrits: 1 });
      dit(fin.body.vue?.auto?.pauseJusqua === horloge + 24 * H, 'un captcha / « activité automatisée » : pause de 24 h, heure de reprise rendue à l’app', JSON.stringify(fin.body.vue?.auto).slice(0, 200));
      horloge += 12 * MIN; const t = await call('auto');
      dit(t.body.ajoute === false && t.body.etat === 'pause', 'pendant la pause : rien ne part', JSON.stringify(t.body).slice(0, 160));
      horloge += 25 * H; const t2 = await call('auto');
      dit(t2.body.etat !== 'pause', 'après 24 h : la pause tombe d’elle-même', JSON.stringify(t2.body).slice(0, 160)); }
    // 12. Stop immédiat : le message posé mais pas parti est retiré.
    { horloge = T0; const { b, call } = neuf(); await allumer(call); horloge = T0 + 2 * H;
      monde(b, { maintenant: horloge, favoris: [['n1', 201, 101, 61 * MIN]] });
      await call('auto'); const st = await call('auto_stop');
      const s = await call('suivant');
      dit(st.code === 200 && st.body.vue?.auto?.reglages?.actif === false && !s.body.travail, 'Stop : éteint tout de suite, et le message pas encore parti ne part pas', JSON.stringify(s.body).slice(0, 160));
      await allumer(call); horloge += 13 * MIN;
      const t = await call('auto');
      dit(t.body.ajoute === false, "rallumé : un favori arrivé AVANT le nouvel allumage n'est jamais rattrapé", JSON.stringify(t.body).slice(0, 160)); }
    // 13. Une réservation auto qui trouve le mode éteint entre-temps : annulée.
    { horloge = T0; const { b, call } = neuf(); await allumer(call); horloge = T0 + 2 * H;
      monde(b, { maintenant: horloge, favoris: [['n1', 201, 101, 61 * MIN]] });
      await call('auto'); const s = await call('suivant');
      await call('auto_stop');
      const c = await call('consommer', { jeton: s.body.travail.jeton, version: '5.309.0' });
      dit(c.code === 409, 'Stop pendant la préparation : l’autorisation est refusée, rien ne part', c.code); }
  } finally { global.fetch = ancienFetch; Date.now = ancienNow; }
}

// ── L'extension : le vrai executerMessageFavori ──────────────────────────────
async function extension() {
  const { faireFond } = require(path.join(RACINE, 'scripts', '_fond-vm.cjs'));
  const run = async ({ auto = true, messages = [], statut = 200, corpsCreation = null } = {}) => {
    const conv = { id: 301, opposite_user: { id: 201, login: 'camille' }, transaction: { id: 5001, item_id: 101 }, allow_reply: true, messages };
    const f = faireFond({ src: path.join(RACINE, 'vinted-sync-extension', 'background.js'), connecte: '111',
      vinted: (e) => {
        if (e.methode === 'POST' && /\/api\/v2\/conversations$/.test(e.chemin)) return { status: statut, body: corpsCreation || { conversation: conv, code: 0 } };
        if (e.methode === 'GET' && /\/api\/v2\/conversations\/301$/.test(e.chemin)) return { status: 200, body: { conversation: conv } };
        if (e.methode === 'GET' && /\/api\/v2\/transactions\/\d+$/.test(e.chemin)) return { status: 200, body: { transaction: { id: 5001, item_id: 101, item: { id: 101, price: { amount: '50.0', currency_code: 'EUR' } } } } };
        if (e.methode === 'POST' && /offers$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
        if (e.methode === 'POST' && /replies$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
        return { status: 404, body: {} };
      } });
    const fetchFond = f.ctx.fetch;
    f.ctx.fetch = async (url, o = {}) => {
      if (String(url).startsWith('https://vrm.center/api/compte')) {
        const c = JSON.parse(o.body || '{}');
        const j = c.action === 'consommer' ? { ok: true, uid: '111', suivi: 's', travail: { ...(auto ? { auto: true } : {}), itemId: '101', recipientId: '201', initiator: 'native-banc', message: 'Bonjour {username} !' } } : { ok: true, autorise: true, uid: '111' };
        return { ok: true, status: 200, json: async () => j };
      }
      return fetchFond(url, o);
    };
    f.ctx.authToken = async () => ({ access_token: 'session' }); f.ctx.notifierApp = async () => {};
    let r = {}; try { r = await f.ctx.executerMessageFavori('111', { vinted_user_id: '111', domain: 'www.vinted.fr', access_token: 'j' }, { jeton: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }); } catch (e) { r = { erreur: String(e.message) }; }
    return { r, ecritures: f.j.vinted.filter((v) => v.methode === 'POST').map((v) => v.chemin) };
  };
  { const { r, ecritures } = await run({ messages: [{ entity_type: 'status_message' }] });
    dit(r.json && r.json.resultat === 'ignore' && r.json.raison === 'conversation_existante' && !ecritures.some((c) => /replies|offers/.test(c)), "extension : un message AUTO n'écrit rien dans une conversation qui porte déjà un message (même système)", JSON.stringify(r.json) + ' ' + ecritures.join(',')); }
  { const { r } = await run({ auto: false, messages: [{ entity_type: 'status_message' }] });
    dit(r.json && r.json.resultat === 'envoye', 'extension : sur SON clic, une conversation avec un simple message système reste permise (rien ne change)', JSON.stringify(r.json)); }
  { const { r, ecritures } = await run();
    dit(r.json && r.json.resultat === 'envoye' && r.json.ecrits === 2 && ecritures.length === 2, "extension : chemin positif sans offre, elle dit combien d'écritures sont parties (conversation + message = 2)", JSON.stringify(r.json)); }
  { const { r } = await run({ statut: 403, corpsCreation: { message: 'Please complete the captcha', code: 106 } });
    dit(r.json && r.json.raison === 'vinted_robot' && r.json.ecrits === 1, "extension : un captcha à la création ⇒ raison « vinted_robot » (pause 24 h côté serveur)", JSON.stringify(r.json)); }
  { const { r } = await run({ statut: 429, corpsCreation: {} });
    dit(r.json && ['vinted_frein', 'pause_vinted'].includes(r.json.raison), 'extension : un 429 ⇒ un frein dit au serveur', JSON.stringify(r.json)); }
}

async function principal() {
  try { await scenarios(); } catch (e) { dit(false, 'les scénarios serveur ont planté', e && e.stack); }
  try { await extension(); } catch (e) { dit(false, "les scénarios de l'extension ont planté", e && e.stack); }
  console.log(ko ? `\n❌ mode auto des favoris : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ mode auto des favoris : ${ok} contrôles`);
  return ko;
}

// ── §6.1 : le code d'AVANT doit être rouge, et chaque mutation aussi ─────────
const MUTATIONS = [
  ['api/_lib/favoris-auto.js', "if(!a?.reglages?.actif)return {etat:'eteint'};", "if(false)return {etat:'eteint'};", 'mode éteint ignoré'],
  ['api/_lib/favoris-auto.js', "if(pause>maintenant)return {etat:'pause',jusqua:pause};", '', 'pause 24 h ignorée'],
  ['api/_lib/favoris-auto.js', "if(!dansPlageAuto(a.reglages,maintenant))return {etat:'hors_horaires'};", '', 'horaires ignorés'],
  ['api/_lib/favoris-auto.js', "if(env.length>=lim)", "if(env.length>=a.reglages.parJour)", 'montée progressive retirée'],
  ['api/_lib/favoris-auto.js', "if(contacteRecemment(d,cible.recipientId,maintenant)){sauts.push({l,cible,raison:'contacte_30j'});continue;}", '', '30 jours ignorés'],
  ['api/_lib/favoris-auto.js', "if(coupleDejaTraite(d,cible.itemId,cible.recipientId))continue;", '', 'un message par couple oublié (tri)'],
  ['api/_lib/favoris-auto.js', "return Object.values(d?.groupes||{}).some(g=>(g.jobs||[]).some(j=>j.id===id&&", "return Object.values(d?.groupes||{}).some(g=>(g.jobs||[]).some(j=>false&&", 'un message par couple oublié (partout)'],
  ['api/_lib/favoris-auto.js', "if(quand>maintenant){", "if(false){", 'attente après le favori retirée'],
  ['api/_lib/favoris.js', "if(dansBoite.length||fil.length){sauts.push({...pr,raison:'conversation_existante'});continue;}", '', 'conversation existante ignorée'],
  ['api/_lib/favoris.js', "if(gTout&&gTout!=='vendue-ailleurs')return stop('garde_absente');", '', 'garde absente acceptée'],
  ['api/_lib/favoris.js', "const ed=etatDressingAuto(dr,maintenant);if(ed)return stop(ed);", '', 'dressing non vérifié'],
  ['src/favorisAuto.js', "if (it.is_reserved) return 'reservee';", '', 'paire réservée acceptée'],
  ['api/_lib/favoris-file.js', "if(AUTO_FREINS.includes(raison)){", "if(false){", 'frein de Vinted sans pause'],
  ['api/_lib/favoris-file.js', "if(j.auto&&!version5309)", "if(false)", 'vieille extension autorisée'],
  ['vinted-sync-extension/background.js', "if(body.auto===true&&(c.messages.length>0", "if(false&&(c.messages.length>0", 'extension : conversation existante écrite'],
  ['vinted-sync-extension/background.js', "if (/captcha|datadome|", "if (/xxcaptchaxx|", 'extension : captcha non reconnu'],
];
function copieArbre(dest, ref) {
  fs.mkdirSync(dest, { recursive: true });
  if (ref) cp.execSync(`git archive ${ref} | tar -x -C ${JSON.stringify(dest)}`, { cwd: path.join(__dirname, '..'), stdio: ['ignore', 'ignore', 'inherit'] });
  else for (const d of ['api', 'src', 'scripts', 'vinted-sync-extension', 'supabase', 'package.json']) cp.execSync(`cp -R ${JSON.stringify(path.join(__dirname, '..', d))} ${JSON.stringify(dest)}/`);
  try { fs.symlinkSync(path.join(__dirname, '..', 'node_modules'), path.join(dest, 'node_modules')); } catch (_) {}
  fs.copyFileSync(__filename, path.join(dest, 'scripts', 'audit-favoris-auto.cjs'));
}
function lancer(dest) { const r = cp.spawnSync(process.execPath, [path.join(dest, 'scripts', 'audit-favoris-auto.cjs')], { env: { ...process.env, FAV_AUTO_RACINE: dest }, encoding: 'utf8' }); return { code: r.status, sortie: (r.stdout || '') + (r.stderr || '') }; }
async function prouver() {
  const i = process.argv.indexOf('--avant'), ref = i > 0 ? process.argv[i + 1] : 'origin/main';
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fav-auto-'));
  let rouge = 0;
  { const dest = path.join(base, 'avant'); copieArbre(dest, ref); const r = lancer(dest);
    const n = (r.sortie.match(/^❌/gm) || []).length;
    console.log((r.code !== 0 && n > 0 ? '✅' : '❌') + ` §6.1 — sur ${ref} : ${n} contrôle(s) rouge(s)`); if (!(r.code !== 0 && n > 0)) rouge++; }
  for (const [f, avant, apres, nom] of MUTATIONS) {
    const dest = path.join(base, 'm' + MUTATIONS.findIndex((m) => m[3] === nom)); copieArbre(dest, null);
    const p = path.join(dest, f), s = fs.readFileSync(p, 'utf8');
    if (!s.includes(avant)) { console.log(`❌ mutation « ${nom} » : texte introuvable (${f})`); rouge++; continue; }
    fs.writeFileSync(p, s.replace(avant, apres));
    const r = lancer(dest); const n = (r.sortie.match(/^❌/gm) || []).length;
    console.log((n > 0 ? '✅' : '❌') + ` mutation « ${nom} » : ${n} rouge(s)`); if (!n) rouge++;
  }
  console.log(rouge ? `\n❌ preuve : ${rouge} échec(s)` : '\n✅ preuve : le code d’avant et chaque mutation sont rouges');
  return rouge;
}

(async () => {
  const k = process.argv.includes('--prouve') ? await prouver() : await principal();
  process.exit(k ? 1 : 0);
})();
