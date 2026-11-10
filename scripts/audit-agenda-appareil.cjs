#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « AGENDA .ICS + NOUVEL APPAREIL » (10 nov., lot H) — EXÉCUTE la vraie
//  route `api/compte.js` (§4.10) contre une base simulée qui sert la VRAIE forme
//  (projections `select=a:data->>b`, filtres `owner=eq.`, `data->>rev=eq.`,
//  upsert `on_conflict`, `rpc/vrm_sessions_de`, `auth/v1/user`).
//   A. ?mode=agenda : jeton créé/régénéré/coupé par le serveur, calendrier par le
//      jeton seul, dates LUES seulement (URSSAF micro, envoi lu, retrait lu), rien
//      de personnel, lecture ratée ⇒ 503, cloisonnement par l'index.
//   B. ?mode=appareils {action:'verifier'} : première fois sans alerte, un
//      appareil jamais vu ⇒ UNE alerte « Nouvel appareil : … Ce n'est pas toi ? »
//      menant à SA session, pas deux fois, lecture ratée ⇒ rien, conflit ⇒ rien.
//  `--prouve` : rejoue l'audit sur une copie MUTÉE (chaque mutation réaffaiblit
//  une règle) et exige le ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'cle-service-banc';
const NEUTRE = '00000000-0000-0000-0000-000000000000';
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const UA_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

// ── La base simulée ─────────────────────────────────────────────────────────
function base() {
  const rows = [];   // { owner, id, data }
  const sessions = {};  // user → [{ id, user_agent, user_id? }]
  const ecrits = [];
  const pannes = new Set();   // 'main' · 'sessions' · 'registre' · 'cas'
  const get = (o, id) => rows.find((r) => r.owner === o && r.id === id);
  const chemin = (data, p) => {
    const m = /^data((?:->>?[A-Za-z0-9_"%-]+)*)$/.exec(p); if (!m) return undefined;
    let v = data; const pas = m[1].match(/->>?[^-]+/g) || [];
    for (const s of pas) { const k = decodeURIComponent(s.replace(/^->>?/, '')).replace(/^"|"$/g, ''); v = v && typeof v === 'object' ? v[k] : undefined; if (s.startsWith('->>') && v != null && typeof v === 'object') v = JSON.stringify(v); }
    return v === undefined ? null : v;
  };
  const projeter = (r, sel) => {
    if (!sel) return r;
    const o = {};
    for (const it of sel.split(',')) {
      const [al, p] = it.includes(':') ? it.split(':') : [it, it];
      if (p === 'data') o[al] = r.data; else if (p === 'owner' || p === 'id') o[al] = r[p]; else o[al] = chemin(r.data, p);
    }
    return o;
  };
  const filtrer = (u) => {
    const f = [];
    for (const [k, v] of u.searchParams) {
      if (['select', 'limit', 'on_conflict', 'order'].includes(k)) continue;
      const m = /^eq\.(.*)$/.exec(v); if (!m) continue;
      f.push((r) => (k === 'owner' || k === 'id' ? String(r[k]) === m[1] : String(chemin(r.data, k)) === m[1]));
    }
    return rows.filter((r) => f.every((g) => g(r)));
  };
  const rep = (status, corps) => ({ ok: status >= 200 && status < 300, status, json: async () => corps, text: async () => JSON.stringify(corps) });
  async function fetch(url, init = {}) {
    const u = new URL(String(url)); const meth = (init.method || 'GET').toUpperCase();
    const corps = init.body ? JSON.parse(init.body) : null;
    if (u.pathname === '/auth/v1/user') {
      const t = String((init.headers || {}).Authorization || '').replace(/^Bearer /, '');
      const id = t === 'jwt.a.x' ? A : t === 'jwt.b.x' ? B : null;
      return id ? rep(200, { id, email: 'banc@example.invalid' }) : rep(401, {});
    }
    if (u.pathname === '/rest/v1/rpc/vrm_sessions_de') {
      if (pannes.has('sessions')) return rep(522, '<html>');
      return rep(200, (sessions[corps.p_user] || []).map((s) => ({ cree_le: '2026-11-01T10:00:00Z', actif_le: '2026-11-10T10:00:00Z', aal: 'aal1', ...s })));
    }
    if (u.pathname.startsWith('/rest/v1/rpc/')) return rep(404, {});
    if (u.pathname !== '/rest/v1/app_data') return rep(404, {});
    const id = u.searchParams.get('id') || '';
    if (meth === 'GET') {
      if (pannes.has('main') && id === 'eq.main') return rep(500, { message: 'panne' });
      if (pannes.has('registre') && id === 'eq.vrm_appareils_vus') return rep(503, { message: 'panne' });
      return rep(200, filtrer(u).map((r) => projeter(r, u.searchParams.get('select'))));
    }
    ecrits.push({ meth, url: String(url), corps });
    if (meth === 'POST') {
      const upsert = /merge-duplicates/.test(String((init.headers || {}).Prefer || ''));
      for (const l of corps) {
        const ex = get(l.owner, l.id);
        if (ex && !upsert) return rep(409, { code: '23505' });
        if (ex) ex.data = l.data; else rows.push({ owner: l.owner, id: l.id, data: l.data });
      }
      return rep(201, null);
    }
    if (meth === 'PATCH') {
      if (pannes.has('cas')) return rep(200, []);
      const t = filtrer(u); for (const r of t) r.data = corps.data;
      return rep(200, t.map((r) => ({ owner: r.owner, id: r.id })));
    }
    if (meth === 'DELETE') { for (const r of filtrer(u)) rows.splice(rows.indexOf(r), 1); return rep(204, null); }
    return rep(405, {});
  }
  return { rows, sessions, ecrits, pannes, fetch, get };
}

function appeler(handler, { method = 'GET', query = {}, jwt = null, body = undefined }) {
  return new Promise((ok) => {
    const res = { statusCode: 200, headers: {}, corps: undefined,
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, getHeader(k) { return this.headers[k.toLowerCase()]; },
      status(c) { this.statusCode = c; return this; }, json(o) { this.corps = o; ok(this); return this; },
      end(t) { this.corps = t; ok(this); return this; }, send(t) { this.corps = t; ok(this); return this; } };
    const req = { method, query, headers: jwt ? { authorization: `Bearer ${jwt}` } : {}, body, url: '/api/compte' };
    Promise.resolve(handler(req, res)).catch((e) => { res.statusCode = 599; res.corps = String(e && e.stack); ok(res); });
  });
}

async function audit(racine, bavard) {
  let ko = 0;
  const dit = (bon, quoi, det) => { if (!bon) ko++; if (bavard) console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(det).slice(0, 300) : ''}`); };
  const db = base();
  globalThis.fetch = db.fetch;
  let handler;
  try { handler = (await import(pathToFileURL(path.join(racine, 'api/compte.js')).href + '?t=' + Date.now())).default; }
  catch (e) { dit(false, 'api/compte.js se charge', e.message); return ko; }
  const lib = await import(pathToFileURL(path.join(racine, 'api/_lib/agenda-ics.js')).href).catch(() => null);
  dit(!!lib, 'api/_lib/agenda-ics.js existe');

  // ════ A. L'AGENDA ════════════════════════════════════════════════════════
  const now = Date.now();
  const jourP = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
  const J2 = jourP(now + 2 * 86400000), J3 = jourP(now + 3 * 86400000), J4 = jourP(now + 4 * 86400000);
  const at10 = Date.parse(`${J2}T09:00:00Z`);   // 10 h (heure d'hiver à Paris)
  db.rows.push({ owner: A, id: 'main', data: {
    vinted_regime: 'micro', vinted_urssaf_freq: 'trimestriel', vrm_urssaf_declare: {},
    vrm_agenda_envoi: { v: 1, at: now - 3600000, colis: [['12', J2, '10:00', at10], ['', J3, '', Date.parse(`${J3}T22:59:59Z`)]] },
    vrm_colis_retirer: { at: now - 3600000, total: 2, colis: [[J4, now - 86400000, 'mondialrelay', 'e:XR123456789FR', 1, '', ''], ['', now - 86400000, 'vinted', 'v:9:777', 1, 'SUIVI999', '']], vus: ['k:Nike Air Max titre perso'] },
    vinted_sales_titles: 'Nike Air Max acheteur_pseudo 45 €',
  } });
  db.rows.push({ owner: B, id: 'main', data: { vinted_regime: 'micro', vrm_agenda_envoi: { at: now, colis: [['777', J2, '', 0]] } } });

  dit((await appeler(handler, { query: { mode: 'agenda' } })).statusCode === 401, 'A1 le réglage exige SA session (401 sans)');
  const g0 = await appeler(handler, { query: { mode: 'agenda' }, jwt: 'jwt.a.x' });
  dit(g0.statusCode === 200 && g0.corps && g0.corps.actif === false && g0.corps.url === '', 'A2 aucun lien tant qu’il ne l’a pas créé', JSON.stringify(g0.corps));
  const c1 = await appeler(handler, { method: 'POST', query: { mode: 'agenda' }, jwt: 'jwt.a.x', body: { action: 'creer' } });
  const url1 = c1.corps && c1.corps.url || '';
  const j1 = (/\/agenda\/([A-Za-z0-9_-]+)\.ics$/.exec(url1) || [])[1] || '';
  dit(c1.statusCode === 200 && j1.length >= 40 && /^https:\/\/vrm\.center\/agenda\//.test(url1), 'A3 « creer » rend un lien https://vrm.center/agenda/<jeton>.ics (jeton ≥ 40 car.)', JSON.stringify(c1.corps));
  dit(db.get(A, 'vrm_agenda') && db.get(A, 'vrm_agenda').data.jeton === j1, 'A4 le jeton est rangé dans SA ligne `vrm_agenda`');
  dit(db.rows.some((r) => r.owner === NEUTRE && /^jeton_agenda_[0-9a-f]{64}$/.test(r.id) && r.data.owner === A) && !db.rows.some((r) => r.owner === NEUTRE && r.id.includes(j1)), 'A5 indexé par EMPREINTE chez le neutre (jamais le jeton en clair)');
  const c1b = await appeler(handler, { method: 'POST', query: { mode: 'agenda' }, jwt: 'jwt.a.x', body: { action: 'creer' } });
  dit(c1b.corps && c1b.corps.url === url1, 'A6 « creer » une 2e fois rend LE MÊME lien');

  const ics = await appeler(handler, { query: { mode: 'agenda', f: j1 + '.ics' } });
  const t = String(ics.corps || '');
  dit(ics.statusCode === 200 && /^text\/calendar/.test(ics.headers['content-type'] || '') && t.startsWith('BEGIN:VCALENDAR\r\n') && t.endsWith('END:VCALENDAR\r\n'), 'A7 le jeton seul sert un text/calendar', ics.statusCode + ' ' + t.slice(0, 120));
  const lignes = t.split('\r\n');
  dit(lignes.every((l) => Buffer.byteLength(l, 'utf8') <= 75) && !/[^\r]\n/.test(t), 'A8 lignes ≤ 75 octets, fins CRLF (RFC 5545)');
  const deplie = t.replace(/\r\n /g, '');
  const sommaires = (deplie.match(/^SUMMARY:.*$/mg) || []).map((s) => s.slice(8));
  dit(sommaires.includes('Colis N°12 à déposer avant 10 h'), 'A9 « Colis N°12 à déposer avant 10 h » (date LUE avec son heure)', JSON.stringify(sommaires));
  const ev12 = deplie.split('BEGIN:VEVENT').find((x) => x.includes('N°12'));
  dit(ev12 && ev12.includes(`DTEND:${new Date(at10).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`), 'A10 l’événement finit à l’heure limite lue (UTC)', ev12);
  dit(sommaires.includes('Colis à déposer') && deplie.includes(`DTSTART;VALUE=DATE:${J3.replace(/-/g, '')}`), 'A11 sans heure lue ⇒ journée entière, sans N° inventé');
  dit(sommaires.filter((s) => /^Colis à retirer/.test(s)).length === 1 && sommaires.includes('Colis à retirer · Mondial Relay'), 'A12 UN retrait : celui dont la date limite est LUE (l’autre, sans date, n’entre pas)', JSON.stringify(sommaires));
  dit(sommaires.some((s) => /^Déclaration URSSAF (T[1-4]|[a-zé]+) \d{4}$/.test(s)), 'A13 la déclaration URSSAF (micro-entrepreneur)', JSON.stringify(sommaires));
  dit(!/XR123456789FR|SUIVI999|v:9:777|Nike|acheteur_pseudo|€|777/.test(t), 'A14 rien de personnel : ni suivi, ni identité, ni titre, ni pseudo, ni montant, ni l’autre vendeur');
  dit((deplie.match(/BEGIN:VALARM/g) || []).length === sommaires.length, 'A15 chaque échéance a son rappel');

  // URSSAF : régime, déclaré
  const m = db.get(A, 'main');
  m.data.vinted_regime = 'reel';
  let t2 = String((await appeler(handler, { query: { mode: 'agenda', f: j1 } })).corps || '');
  dit(!/Déclaration URSSAF/.test(t2), 'A16 pas micro-entrepreneur ⇒ aucune échéance URSSAF (le régime n’est jamais deviné)');
  m.data.vinted_regime = 'micro';
  const yms = []; for (let i = -14; i <= 14; i++) { const d = new Date(new Date(now).getFullYear(), new Date(now).getMonth() + i, 1); yms.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
  m.data.vrm_urssaf_declare = Object.fromEntries(yms.map((ym) => [ym, { ids: ['x'] }]));
  t2 = String((await appeler(handler, { query: { mode: 'agenda', f: j1 } })).corps || '');
  dit(!/Déclaration URSSAF/.test(t2), 'A17 période notée « déclarée » ⇒ plus d’échéance');
  m.data.vrm_urssaf_declare = {};

  // Panne, cloisonnement, jetons
  db.pannes.add('main');
  const p = await appeler(handler, { query: { mode: 'agenda', f: j1 } });
  dit(p.statusCode === 503 && !/BEGIN:VCALENDAR/.test(String(p.corps || '')), 'A18 `main` illisible ⇒ 503, jamais un calendrier vide', p.statusCode);
  db.pannes.delete('main');
  dit((await appeler(handler, { query: { mode: 'agenda', f: 'x'.repeat(43) } })).statusCode === 404, 'A19 un jeton inconnu ⇒ 404');
  const cb = await appeler(handler, { method: 'POST', query: { mode: 'agenda' }, jwt: 'jwt.b.x', body: { action: 'creer' } });
  const jb = (/\/agenda\/([A-Za-z0-9_-]+)\.ics$/.exec(cb.corps && cb.corps.url || '') || [])[1];
  const tb = String((await appeler(handler, { query: { mode: 'agenda', f: jb } })).corps || '');
  dit(jb && jb !== j1 && /N°777/.test(tb) && !/N°12/.test(tb), 'A20 chaque jeton sert SON vendeur seulement');
  const r1 = await appeler(handler, { method: 'POST', query: { mode: 'agenda' }, jwt: 'jwt.a.x', body: { action: 'regenerer' } });
  const j2 = (/\/agenda\/([A-Za-z0-9_-]+)\.ics$/.exec(r1.corps && r1.corps.url || '') || [])[1];
  dit(j2 && j2 !== j1 && (await appeler(handler, { query: { mode: 'agenda', f: j1 } })).statusCode === 404 && (await appeler(handler, { query: { mode: 'agenda', f: j2 } })).statusCode === 200, 'A21 « regenerer » : l’ancien lien meurt, le nouveau marche');
  const cp = await appeler(handler, { method: 'POST', query: { mode: 'agenda' }, jwt: 'jwt.a.x', body: { action: 'couper' } });
  dit(cp.corps && cp.corps.actif === false && (await appeler(handler, { query: { mode: 'agenda', f: j2 } })).statusCode === 404, 'A22 « couper » : plus aucun lien');
  const vj = JSON.parse(fs.readFileSync(path.join(racine, 'vercel.json'), 'utf8'));
  dit((vj.rewrites || []).some((x) => x.source === '/agenda/:fichier' && x.destination === '/api/compte?mode=agenda&f=:fichier'), 'A23 vercel.json : /agenda/<jeton>.ics → la route existante (aucune fonction neuve)');
  dit(fs.readdirSync(path.join(racine, 'api')).filter((f) => f.endsWith('.js')).length <= 12, 'A24 12 fonctions api/ au plus');

  // ════ B. NOUVEL APPAREIL ═════════════════════════════════════════════════
  const S1 = 'aaaaaaaa-0000-4000-8000-000000000001', S2 = 'aaaaaaaa-0000-4000-8000-000000000002', S3 = 'aaaaaaaa-0000-4000-8000-000000000003', S4 = 'aaaaaaaa-0000-4000-8000-000000000004';
  db.sessions[A] = [{ id: S1, user_agent: UA_MAC }, { id: S3, user_agent: 'node' }];
  const verif = () => appeler(handler, { method: 'POST', query: { mode: 'appareils' }, jwt: 'jwt.a.x', body: { action: 'verifier' } });
  const alertes = () => db.ecrits.filter((e) => /Nouvel appareil/.test(JSON.stringify(e.corps || '')));
  const v1 = await verif();
  dit(v1.statusCode === 200 && v1.corps.init === true && alertes().length === 0, 'B1 première fois : tout ce qui est connecté devient connu, SANS alerte', JSON.stringify(v1.corps));
  const reg = db.get(A, 'vrm_appareils_vus');
  dit(reg && reg.data.signatures['Mac · Chrome'] && !reg.data.signatures['Serveur VRM'] && !JSON.stringify(reg.data).includes('Mozilla'), 'B2 le registre garde la signature résumée (jamais le user agent brut ; « Serveur VRM » ignoré)', JSON.stringify(reg && reg.data));
  db.sessions[A].push({ id: S4, user_agent: UA_MAC });
  const v1b = await verif();
  dit(v1b.corps.nouveaux === 0 && alertes().length === 0, 'B3 une 2e session du même type d’appareil (« Mac · Chrome ») ⇒ rien');
  db.sessions[A].push({ id: S2, user_agent: UA_IPHONE });
  // panne de lecture : rien écrit, rien envoyé
  const avant = db.ecrits.length;
  db.pannes.add('sessions');
  const vp = await verif();
  db.pannes.delete('sessions'); db.pannes.add('registre');
  const vq = await verif();
  db.pannes.delete('registre');
  dit(vp.statusCode === 503 && vq.statusCode === 503 && db.ecrits.length === avant, 'B4 sessions ou registre illisibles ⇒ 503, rien écrit, rien envoyé');
  db.pannes.add('cas');
  const vc = await verif();
  db.pannes.delete('cas');
  dit(alertes().length === 0 && vc.corps && vc.corps.conflit === true, 'B5 un autre appareil a écrit entre-temps (rev changé) ⇒ PAS d’alerte ici (un seul écrivain alerte)', JSON.stringify(vc.corps));
  const v2 = await verif();
  const al = alertes();
  const txt = JSON.stringify(al.map((e) => e.corps));
  dit(v2.corps.nouveaux === 1 && al.length >= 1 && txt.includes("Safari sur iPhone. Ce n'est pas toi ?"), 'B6 appareil jamais vu ⇒ « Nouvel appareil : Safari sur iPhone. Ce n’est pas toi ? »', JSON.stringify(v2.corps) + ' ' + txt.slice(0, 200));
  dit(txt.includes(`section=appareils`) && txt.includes(`session=${S2}`), 'B7 son toucher mène à Paramètres → Appareils connectés, CETTE session');
  const n = al.length;
  await verif();
  dit(alertes().length === n, 'B8 pas deux fois pour le même appareil');
  db.sessions[A].push({ id: 'bbbbbbbb-0000-4000-8000-000000000009', user_agent: 'Mozilla/5.0 (Windows NT 10.0) Firefox/130.0', user_id: B });
  const vx = await verif();
  dit(vx.corps.nouveaux === 0 && alertes().length === n, 'B9 une session d’un AUTRE utilisateur rendue par erreur ne compte pas');
  const src = fs.readFileSync(path.join(racine, 'api/compte.js'), 'utf8');
  dit(/verifierNouvelAppareil\(\{[^}]*user: u,/.test(src), 'B10 l’identifiant vient du JETON vérifié (`vendeurExige`), jamais de la requête');
  return ko;
}

(async () => {
  const bavard = !process.argv.includes('--silence');
  const iR = process.argv.indexOf('--racine');
  const ko = await audit(iR > 0 ? process.argv[iR + 1] : RACINE, bavard);
  if (!process.argv.includes('--prouve')) { console.log(ko ? `\n${ko} échec(s)` : '\nAudit agenda + nouvel appareil : OK'); process.exit(ko ? 1 : 0); }
  if (ko) { console.log('\nL’audit est rouge sur le vrai code : pas de preuve par mutation.'); process.exit(1); }
  const MUT = [
    ['api/_lib/agenda-ics.js', "if (!jour || jour < aujourdhui) continue;            // sans date lue, ou passée : rien", 'if (false) continue;', 'un retrait sans date lue entre'],
    ['api/_lib/agenda-ics.js', "if (m.regime === 'micro') {", 'if (true) {', 'URSSAF pour tout régime'],
    ['api/_lib/agenda-ics.js', "if (!r || !r.ok) return { status: 503, type: 'texte', body: 'Réessaie dans un instant.' };", "if (!r || !r.ok) { main = {}; } else {", 'panne ⇒ calendrier vide', (s) => s.replace("      main = j[0] || {};\n", "      main = Array.isArray(j) ? (j[0] || {}) : {}; }\n").replace("      if (!Array.isArray(j)) return { status: 503, type: 'texte', body: 'Réessaie dans un instant.' };\n      main", "      main")],
    ['api/_lib/agenda-ics.js', "titre: `Colis à retirer${tr ? ' · ' + tr : ''}`", "titre: `Colis à retirer${tr ? ' · ' + tr : ''} ${ident}`", 'l’identité du colis dans le titre'],
    ['api/_lib/appareil-nouveau.js', 'if (signatures[sig]) continue;', '', 'un appareil connu re-alerte'],
    ['api/_lib/appareil-nouveau.js', 'ecrit = Array.isArray(j) && j.length === 1;', 'ecrit = true;', 'conflit ignoré'],
    ['api/_lib/appareil-nouveau.js', "sessions = sessions.filter((s) => s && (s.user_id == null || String(s.user_id) === String(user.id)));", '', 'session d’un autre comptée'],
    ['api/_lib/appareil-nouveau.js', 'return { init: true, nouveaux: [], registre: { v: 1, rev: 1, signatures } };', 'return { init: true, nouveaux: [...vues].map(([signature, id]) => ({ id, signature })), registre: { v: 1, rev: 1, signatures } };', 'alerte au premier passage', (s) => s.replace('if (calc.init) return', 'if (false) return')],
  ];
  let rouges = 0;
  for (const [f, de, vers, nom, plus] of MUT) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-agenda-'));
    for (const d of ['api', 'src']) fs.cpSync(path.join(RACINE, d), path.join(tmp, d), { recursive: true });
    for (const x of ['package.json', 'vercel.json']) fs.copyFileSync(path.join(RACINE, x), path.join(tmp, x));
    fs.symlinkSync(fs.realpathSync(path.join(RACINE, 'node_modules')), path.join(tmp, 'node_modules'));
    let s = fs.readFileSync(path.join(tmp, f), 'utf8');
    if (!s.includes(de)) { console.log(`KO  mutation « ${nom} » : texte introuvable`); rouges = -999; continue; }
    s = s.replace(de, vers); if (plus) s = plus(s);
    fs.writeFileSync(path.join(tmp, f), s);
    const { spawnSync } = require('child_process');
    const r = spawnSync(process.execPath, [__filename, '--racine', tmp, '--silence'], { encoding: 'utf8' });
    const rouge = r.status !== 0;
    console.log(`${rouge ? 'OK  ' : 'KO  '}mutation « ${nom} » ⇒ ${rouge ? 'ROUGE' : 'reste VERT'}`);
    if (rouge) rouges++;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(rouges === MUT.length ? '\nPreuve par mutation : chaque règle affaiblie fait rougir l’audit.' : '\nPreuve par mutation INCOMPLÈTE');
  process.exit(rouges === MUT.length ? 0 : 1);
})();
