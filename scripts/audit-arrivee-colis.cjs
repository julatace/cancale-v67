#!/usr/bin/env node
// AUDIT (21 oct.) — LA DATE D'ARRIVÉE D'UN COLIS À RETIRER.
// Julien : « je veux que l'on voie la date à laquelle il est arrivé ».
// MESURÉ (lecture seule) : la ligne `email_track_*` est réécrite par CHAQUE
// email du transporteur ; les rappels (« Le temps file… », « Libère de la place
// dans la consigne… ») arrivent après l'arrivée, et `receivedAt` prenait leur
// date (6 colis « disponibles » sur 30). Exige :
//   1. la règle pure (api/_lib/arrivee-colis.js) : arrivée ⇒ sûre, rappel /
//      transfert ⇒ borne, la date gardée n'est pas remplacée par un rappel ;
//   2. la VRAIE route api/email-inbound : « disponible » le 16, rappel le 20
//      ⇒ la ligne garde `arriveLe` = le 16 (et `receivedAt` = le 20).
// Données inventées. §6.1 : lancé depuis un arbre d'avant, il est rouge.
const path = require('path');
const RACINE = path.join(__dirname, '..');
const A = '11111111-2222-3333-4444-555555555555';
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };

process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VRM_OWNER_UID = A;
delete process.env.EMAIL_INBOUND_SECRET;
delete process.env.VAPID_PRIVATE_KEY;
delete process.env.AI_API_KEY; delete process.env.ANTHROPIC_API_KEY;

const base = new Map();                     // `${owner}|${id}` → data
const pannes = new Set();                   // ids dont la LECTURE répond 522
let sondeKO = 0;                            // nombre de sondes `select=owner&limit=1` qui répondront 522
const lectures = [];                        // URLs GET app_data
const appels = [];                          // tout ce qui sort
const rep = (c, s = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
const r522 = () => new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } });
const filtreOwner = (u) => { const v = u.searchParams.get('owner'); return v ? decodeURIComponent(v.replace(/^eq\./, '')) : null; };
let fetchSpecial = null;

global.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  appels.push({ url: String(url), m, headers: opts.headers || {}, body: opts.body });
  if (fetchSpecial) { const r = await fetchSpecial(u, m, opts); if (r) return r; }
  if (u.pathname === '/auth/v1/user') {
    const t = String((opts.headers && (opts.headers.Authorization || opts.headers.authorization)) || '').replace(/^Bearer\s+/, '');
    const sub = JSON.parse(Buffer.from(t.split('.')[1] || 'e30', 'base64url').toString() || '{}').sub;
    return sub ? rep({ id: sub, email: 'v@banc.test' }) : rep({}, 401);
  }
  if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
  if (u.pathname !== '/rest/v1/app_data') return rep([]);
  if (m === 'POST') {
    for (const r of JSON.parse(opts.body || '[]')) base.set(`${r.owner || A}|${r.id}`, r.data);
    return new Response('', { status: 201 });
  }
  if (m !== 'GET') return rep([]);
  const sel = u.searchParams.get('select') || '';
  if (sel === 'owner' && u.searchParams.get('limit') === '1') { if (sondeKO > 0) { sondeKO--; return r522(); } return rep([]); }
  lectures.push(String(url));
  const idp = u.searchParams.get('id') || '';   // déjà décodé (un second décodage lève sur « %_ »)
  const own = filtreOwner(u);
  const exact = idp.startsWith('eq.') ? idp.slice(3) : null;
  if (exact && pannes.has(exact)) return r522();
  const like = idp.startsWith('like.') ? new RegExp('^' + idp.slice(5).replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$') : null;
  const lignes = [...base.entries()].map(([k, d]) => { const [o, id] = k.split('|'); return { owner: o, id, data: d }; })
    .filter((l) => (!own || l.owner === own) && (exact ? l.id === exact : like ? like.test(l.id) : true));
  // projections simples `x:data->k` / `x:data->>k` / `data->k`
  if (sel && sel !== 'data' && sel !== 'id,data' && sel !== 'owner,data') {
    return rep(lignes.map((l) => {
      const o = {};
      for (const part of sel.split(',')) {
        const [alias, chemin] = part.includes(':') ? part.split(':') : [part.replace(/^data->>?/, ''), part];
        if (chemin === 'id' || chemin === 'owner') { o[alias] = l[chemin]; continue; }
        const k = chemin.replace(/^data->>?/, '');
        o[alias] = l.data ? l.data[k] : undefined;
      }
      return o;
    }));
  }
  return rep(lignes);
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.send = () => r; r.end = () => r; return r; };
const importer = (p) => import('file://' + path.join(RACINE, p));


(async () => {
  try {
    let M = null;
    try { M = await importer('api/_lib/arrivee-colis.js'); } catch (e) { dit(false, 'la règle de la date d’arrivée existe (api/_lib/arrivee-colis.js)', String(e.message).slice(0, 100)); }
    if (M) {
      dit(M.estEmailArrivee('Votre colis 11110001 est disponible 📦') && M.estEmailArrivee('Votre colis VINTED est arrivé en relais Pickup'), 'un email d’arrivée est reconnu (Mondial Relay, Chronopost)');
      dit(!M.estEmailArrivee('Le temps file : votre colis vous attend avec impatience ⏳') && !M.estEmailArrivee('Libère de la place dans la consigne : récupère ton colis sans attendre'), 'un rappel n’est JAMAIS une arrivée');
      dit(!M.estEmailArrivee('TR :  Votre colis 57902665 est disponible 📦'), 'un email transféré à la main n’est pas daté de l’arrivée');
      const t = (o) => ({ status: 'available', ...o });
      const r1 = M.arriveeColisEmail(t({ subject: 'Le temps file : votre colis vous attend', receivedAt: '2026-10-20T08:00:00Z' }));
      dit(r1 && r1.sur === 'borne', 'rappel sans date gardée ⇒ une borne (« au plus tard »)', JSON.stringify(r1));
      const r2 = M.arriveeColisEmail(t({ subject: 'Le temps file', receivedAt: '2026-10-20T08:00:00Z', arriveLe: '2026-10-16T08:00:00Z' }));
      dit(r2 && r2.sur === 'oui' && new Date(r2.ms).toISOString().startsWith('2026-10-16'), 'date d’arrivée gardée ⇒ c’est elle, sûre', JSON.stringify(r2));
      dit(M.arriveeColisEmail(t({ subject: 'x', receivedAt: 'n’importe quoi' })) === null && M.arriveeColisEmail({ status: 'delivered', receivedAt: '2026-10-20T08:00:00Z' }) === null, 'date illisible ou colis pas au relais ⇒ inconnue (null), jamais une date inventée');
      const v = M.arriveeColisVinted({ at: '2026-10-19T10:00:00Z' });
      dit(v && v.sur === 'borne', 'colis vu dans la conversation : l’heure de LECTURE n’est qu’une borne', JSON.stringify(v));
      dit(M.arriveeColisVinted(null) === null, 'aucune conversation lue ⇒ inconnue');
      dit(M.arriveLeAuRangement({ status: 'available', subject: 'Votre colis 1 est disponible', receivedAt: '2026-10-16T08:00:00Z' }, 'Le temps file', 'available', '2026-10-20T08:00:00Z') === '2026-10-16T08:00:00Z', 'au rangement d’un rappel : la date de l’email d’arrivée d’avant est reprise');
      dit(M.arriveLeAuRangement(null, 'Le temps file', 'available', '2026-10-20T08:00:00Z') === null, 'au rangement d’un rappel sans ligne d’avant : aucune date inventée');
    }

    // ── La vraie route ──
    const inbound = await importer('api/email-inbound.js');
    const mail = (subject) => ({ from: 'noreply@mondialrelay.fr', to: 'boite@banc.test', subject,
      text: `${subject}\nVotre colis 87654321 vous attend au Point Relais.\nCode de retrait : 482913\nNuméro de suivi : 87654321\n`, html: '', attachments: [] });
    const recoit = async (subject, quand) => { const res = faireRes(); await inbound.default({ method: 'POST', query: {}, headers: {}, __recuLe: quand, body: mail(subject) }, res); return res; };
    const r1 = await recoit('Votre colis 87654321 est disponible 📦', '2026-10-16T08:00:00.000Z');
    const r2 = await recoit('Le temps file : votre colis vous attend avec impatience ⏳', '2026-10-20T08:00:00.000Z');
    const lignes = [...base.entries()].filter(([k]) => k.includes('|email_track_')).map(([, d]) => d);
    const l = lignes[0];
    dit(r1.code === 200 && r2.code === 200 && lignes.length === 1, 'les deux emails du même colis rangés sur UNE ligne', `HTTP ${r1.code}/${r2.code} · ${lignes.length} ligne(s)`);
    dit(l && l.status === 'available' && String(l.receivedAt).startsWith('2026-10-20'), 'la ligne garde le statut « disponible », receivedAt = le rappel', l && `${l.status} ${l.receivedAt}`);
    dit(l && String(l.arriveLe || '').startsWith('2026-10-16'), 'la DATE D’ARRIVÉE (le 16) survit au rappel du 20', l && `arriveLe=${l.arriveLe}`);
  } catch (e) { dit(false, 'l’audit a pu s’exécuter', String(e && e.stack || e).slice(0, 300)); }
  console.log(ko ? `\n❌ date d'arrivée : ${ko} rouge(s)` : `\n✅ date d'arrivée : tout est vert`);
  process.exit(ko ? 1 : 0);
})();
