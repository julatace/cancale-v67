// ═══════════════════════════════════════════════════════════════════════════
// UNE FAUSSE BASE À DEUX VENDEURS (A, B) + LE PROPRIÉTAIRE (P), pour les deux
// contrôles RGPD qui EXÉCUTENT le vrai serveur (§4.10) :
//   scripts/audit-supprimer-compte.cjs (la route `?mode=supprimer`)
//   scripts/audit-clients-partis.cjs   (le passage du cron, horloge simulée)
// Elle sert la VRAIE forme (§6.3) : filtres PostgREST honorés (owner=eq.,
// id=eq./in./like./not.like., data->>X=eq./lt.), `count=exact` en
// `Content-Range`, DELETE qui efface pour de vrai ce que le filtre désigne —
// un filtre propriétaire absent VIDE la table, pour que le contrôle le voie ;
// un filtre inconnu fait échouer la requête (jamais « vrai »).
// Aucune donnée réelle : tout est inventé ici.
// ═══════════════════════════════════════════════════════════════════════════
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const P = '99999999-9999-4999-8999-999999999999';
const NEUTRE = '00000000-0000-0000-0000-000000000000';
const SERVICE = 'sb_secret_banc';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
// Un jeton à la forme d'un JWT : `amr` dit quand la personne s'est prouvée.
const jeton = (qui, connecteIlYaMs) => `eyJhbGciOiJIUzI1NiJ9.${b64({ sub: qui, amr: [{ method: 'password', timestamp: Math.floor((Date.now() - connecteIlYaMs) / 1000) }] })}.sig${qui.slice(0, 4)}`;

// (13 nov., lot 51) `pannesMotif` : [{ re, m }] — UNE requête ciblée tombe (522), les autres passent
// (le cas « lecture KO, écriture OK » sur une seule ligne).
const etat = { base: null, deletes: [], ecritures: [], stripe: [], pannes: new Set(), pannesMotif: [], proprioRpc: null, proprioReglage: null, jetons: {} };
const MDP = { [A]: 'bon-mot-de-passe-A', [B]: 'bon-mot-de-passe-B', [P]: 'bon-mot-de-passe-P' };
const EMAIL = { [A]: 'vendeuse.a@exemple.test', [B]: 'b@exemple.test', [P]: 'proprio@exemple.test' };

function reset() {
  const ligne = (owner, id, data = {}) => ({ owner, id, data });
  etat.base = {
    app_data: [
      ligne(A, 'main'), ligne(A, 'harvest_11_orders_sold'), ligne(A, 'email_bord_1'), ligne(A, 'push_subs', { subs: [1] }),
      ligne(A, 'vrm_adresse_reception', { jeton: 'x' }), ligne(A, 'email_invoice_tx901', { number: 'FA-1' }), ligne(A, 'email_invoice_av902', { number: 'AV-1' }),
      ligne(B, 'main'), ligne(B, 'harvest_22_orders_sold'), ligne(B, 'email_invoice_tx77', { number: 'FB-1' }),
      ligne(NEUTRE, 'vrm_email_preuve_' + 'a'.repeat(40), { owner: A, adresse: EMAIL[A], etat: 'prouvee' }),
      ligne(NEUTRE, 'vrm_email_preuve_' + 'b'.repeat(40), { owner: B, adresse: EMAIL[B], etat: 'prouvee' }),
      ligne(NEUTRE, 'jeton_reception_' + 'a'.repeat(64), { owner: A, genre: 'reception' }),
      ligne(NEUTRE, 'jeton_widget_' + 'a'.repeat(64), { owner: A, genre: 'widget' }),
      ligne(NEUTRE, 'jeton_reception_' + 'b'.repeat(64), { owner: B, genre: 'reception' }),
      ligne(NEUTRE, 'email_quarantaine_1', { destinataires: '["vendeuse.a@exemple.test"]' }),
      ligne(P, 'signalement_2026110910_111111111111_1', { de: A, texte: 'souci' }),
      ligne(P, 'signalement_2026110910_222222222222_1', { de: B, texte: 'autre' }),
      ligne(P, 'main'),
    ],
    vinted_accounts: [{ owner: A, vinted_user_id: '11' }, { owner: B, vinted_user_id: '22' }],
    detourage_usage: [{ owner: A, mois: '2026-10' }, { owner: B, mois: '2026-10' }],
    abonnements: { [A]: { owner: A, statut: 'active', client_stripe: 'cus_A', abonnement_stripe: 'sub_A', mode_test: false }, [B]: { owner: B, statut: 'active', client_stripe: 'cus_B', abonnement_stripe: 'sub_B', mode_test: false } },
    stockage: [`${A}/aaa-v1.jpg`, `${B}/ccc-v1.jpg`],
    utilisateurs: new Set([A, B, P]),
    equipe: [{ id: 'e1', vendeur: A, membre: null }, { id: 'e2', vendeur: B, membre: null }],
    communaute: [{ owner: A }, { owner: B }],
    subs: { sub_A: { id: 'sub_A', customer: 'cus_A', status: 'active' }, sub_B: { id: 'sub_B', customer: 'cus_B', status: 'active' } },
  };
  etat.deletes = []; etat.ecritures = []; etat.stripe = []; etat.pannes = new Set(); etat.pannesMotif = []; etat.proprioRpc = null; etat.proprioReglage = P;
  etat.jetons = {};
  delete process.env.VRM_OWNER_UID;
}
// Un jeton de session pour `qui`, connecté il y a `ms`.
function session(qui, ms = 2 * 3600e3) { const j = jeton(qui, ms); etat.jetons[j] = qui; return j; }

const rep = (o, status = 200, h = {}) => new Response(o == null ? null : (typeof o === 'string' ? o : JSON.stringify(o)), { status, headers: { 'content-type': 'application/json', ...h } });
const echap = (k) => new RegExp('^' + k.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/_/g, '.') + '$');

// Le juge des filtres : (ligne) => bool, ou `null` si un filtre est inconnu.
function juge(qs) {
  const parts = qs.split('&').filter(Boolean);
  const tests = [];
  for (const f of parts) {
    let k;
    if (/^(select|limit|order|offset|on_conflict)=/.test(f)) continue;
    if ((k = /^owner=eq\.(.+)$/.exec(f))) { const o = k[1]; tests.push((l) => l.owner === o); continue; }
    if (/^owner=not\.is\.null$/.test(f)) { tests.push((l) => l.owner != null); continue; }
    if ((k = /^id=eq\.(.+)$/.exec(f))) { const v = k[1]; tests.push((l) => l.id === v); continue; }
    if ((k = /^id=in\.\((.*)\)$/.exec(f))) { const v = k[1].split(','); tests.push((l) => v.includes(l.id)); continue; }
    if ((k = /^id=like\.(.+)$/.exec(f))) { const re = echap(k[1]); tests.push((l) => re.test(l.id)); continue; }
    if ((k = /^id=not\.like\.(.+)$/.exec(f))) { const re = echap(k[1]); tests.push((l) => !re.test(l.id)); continue; }
    if ((k = /^data->>([a-zA-Z_]+)=eq\.(.*)$/.exec(f))) { const [, c, v] = k; tests.push((l) => !!(l.data && String(l.data[c]) === v)); continue; }
    if ((k = /^data->>([a-zA-Z_]+)=lt\.(.*)$/.exec(f))) { const [, c, v] = k; tests.push((l) => !!(l.data && l.data[c] != null && String(l.data[c]) < v)); continue; }
    if ((k = /^statut=in\.\((.*)\)$/.exec(f))) { const v = k[1].split(','); tests.push((l) => v.includes(l.statut)); continue; }
    if ((k = /^cle=eq\.(.+)$/.exec(f))) { const v = k[1]; tests.push((l) => l.cle === v); continue; }
    return null;
  }
  return (l) => tests.every((t) => t(l));
}

async function faux(url, opts = {}) {
  const base = etat.base;
  const u = decodeURIComponent(String(url)), m = opts.method || 'GET', h = opts.headers || {};
  const jwt = String(h.Authorization || h.authorization || '').replace(/^Bearer\s+/, '');
  const service = String(h.apikey || '') === SERVICE;
  if (etat.pannesMotif.some((x) => x.re.test(u) && (!x.m || x.m === m))) return rep('<html>522</html>', 522);
  if (u.includes('/auth/v1/user')) {
    if (etat.pannes.has('auth-user')) return rep('<html>522</html>', 522);
    const qui = etat.jetons[jwt];
    return qui && base.utilisateurs.has(qui) ? rep({ id: qui, email: EMAIL[qui], email_confirmed_at: '2026-10-01T00:00:00Z' }) : rep({ msg: 'invalid' }, 401);
  }
  if (u.includes('/auth/v1/token?grant_type=password')) {
    if (etat.pannes.has('mdp')) return rep('<html>522</html>', 522);
    const c = JSON.parse(opts.body || '{}');
    const qui = Object.keys(EMAIL).find((k) => EMAIL[k] === c.email);
    if (qui && base.utilisateurs.has(qui) && MDP[qui] === c.password) return rep({ access_token: 'x', user: { id: qui } });
    return rep({ error: 'invalid_grant', error_code: 'invalid_credentials' }, 400);
  }
  if (u.includes('/auth/v1/logout')) return rep(null, 204);
  if (u.includes('/auth/v1/admin/users/')) {
    const id = u.split('/admin/users/')[1];
    if (!service) return rep({ msg: 'no' }, 401);
    if (m === 'GET') return base.utilisateurs.has(id) ? rep({ id, email: EMAIL[id], email_confirmed_at: '2026-10-01T00:00:00Z' }) : rep({}, 404);
    if (m !== 'DELETE') return rep({}, 405);
    etat.deletes.push('auth:' + id);
    if (etat.pannes.has('auth')) return rep('<html>522</html>', 522);
    if (!base.utilisateurs.has(id)) return rep({ msg: 'User not found' }, 404);
    base.utilisateurs.delete(id); delete base.abonnements[id];   // la clé étrangère ON DELETE CASCADE (005)
    return rep({}, 200);
  }
  if (u.includes('/rest/v1/rpc/vrm_acces')) {
    if (etat.pannes.has('rpc')) return rep('<html>522</html>', 522);
    const qui = etat.jetons[jwt];
    if (!qui) return rep({ message: 'JWT' }, 401);
    return rep({ obligatoire: false, proprietaire: qui === etat.proprioRpc, acces: true });
  }
  if (u.includes('/rest/v1/vrm_reglages')) {
    if (etat.pannes.has('reglages')) return rep('<html>522</html>', 522);
    return rep(etat.proprioReglage ? [{ valeur: etat.proprioReglage }] : []);
  }
  if (u.includes('/rest/v1/abonnements')) {
    if (etat.pannes.has('abonnements')) return rep('<html>522</html>', 522);
    if (service) {
      const qs = u.split('?')[1] || '';
      const j = juge(qs.split('&').filter((x) => !/^owner=/.test(x)).join('&'));
      if (!j) return rep({ message: 'filtre inconnu du banc' }, 400);
      return rep(Object.values(base.abonnements).filter(j));
    }
    const qui = etat.jetons[jwt];
    return rep(qui && base.abonnements[qui] ? [base.abonnements[qui]] : []);
  }
  if (u.includes('/storage/v1/object/list/detourage')) {
    const pref = JSON.parse(opts.body).prefix;
    return rep(base.stockage.filter((x) => x.startsWith(pref + '/')).map((x) => ({ name: x.slice(pref.length + 1) })).slice(0, 100));
  }
  if (u.includes('/storage/v1/object/detourage') && m === 'DELETE') {
    const noms = JSON.parse(opts.body).prefixes;
    etat.deletes.push('stockage:' + noms.join(','));
    base.stockage = base.stockage.filter((x) => !noms.includes(x));
    return rep([]);
  }
  for (const [rpc, cle, champ] of [['vrm_equipe_effacer', 'equipe', 'vendeur'], ['vrm_communaute_effacer', 'communaute', 'owner']]) {
    if (u.includes('/rest/v1/rpc/' + rpc)) {
      if (!service || h.Authorization) return rep({ message: 'permission denied' }, 401);
      if (etat.pannes.has(cle)) return rep('<html>522</html>', 522);
      const o = JSON.parse(opts.body || '{}').p_owner;
      etat.deletes.push(cle + ':' + o);
      const avant = base[cle].length;
      base[cle] = base[cle].filter((x) => x[champ] !== o && x.membre !== o);
      return rep(avant - base[cle].length);
    }
  }
  if (m === 'GET' && u.includes('id=like.favoris_file_*')) return etat.pannes.has('favoris') ? rep({}, 503) : rep([]);
  const mr = /\/rest\/v1\/(app_data|vinted_accounts|detourage_usage)\?(.*)$/.exec(u);
  if (mr) {
    const [, table, qs] = mr;
    if (etat.pannes.has(table) || (etat.pannes.has('lecture-' + table) && m === 'GET')) return rep('<html>522</html>', 522);
    if (m === 'POST') {
      if (!service) return rep({ message: 'RLS' }, 401);
      const lignes = JSON.parse(opts.body || '[]');
      etat.ecritures.push(...lignes);
      for (const l of lignes) { base[table] = base[table].filter((x) => !(x.owner === l.owner && x.id === l.id)); base[table].push({ owner: l.owner, id: l.id, data: l.data }); }
      return rep(null, 201);
    }
    const j = juge(qs);
    if (!j) return rep({ message: 'filtre inconnu du banc : ' + qs }, 400);
    if (m === 'GET') {
      const t = base[table].filter(j);
      const sel = (/(?:^|&)select=([^&]*)/.exec(qs) || [])[1] || '';
      const lim = Number((/(?:^|&)limit=(\d+)/.exec(qs) || [])[1] || 1000);
      const proj = t.slice(0, lim).map((l) => sel === 'data' ? { data: l.data } : { id: l.id, owner: l.owner, o: l.data && l.data.owner, data: l.data });
      return rep(proj, 200, { 'content-range': t.length ? `0-${Math.min(lim, t.length) - 1}/${t.length}` : '*/0' });
    }
    if (m === 'DELETE') {
      etat.deletes.push(table + '?' + qs);
      const avant = base[table].length;
      base[table] = base[table].filter((l) => !j(l));
      return rep(null, 204, { 'content-range': `*/${avant - base[table].length}` });
    }
  }
  if (u.startsWith('https://api.stripe.com/v1/')) {
    const chemin = u.slice('https://api.stripe.com/v1/'.length).split('?')[0];
    etat.stripe.push({ m, chemin, corps: String(opts.body || '') });
    if (etat.pannes.has('stripe')) return rep({ error: { message: 'panne' } }, 500);
    const s = base.subs[chemin.split('/')[1]];
    if (!s) return rep({ error: { message: 'inconnu' } }, 404);
    if (m === 'POST' && /cancel_at_period_end=true/.test(String(opts.body))) s.cancel_at_period_end = true;
    if (m === 'POST' && /cancel_at_period_end=false/.test(String(opts.body))) s.cancel_at_period_end = false;   // (13 nov.) reprendre
    if (m === 'DELETE') s.status = 'canceled';
    return rep(s);
  }
  return rep({}, 404);
}

module.exports = { A, B, P, NEUTRE, SERVICE, MDP, EMAIL, etat, reset, session, faux };
