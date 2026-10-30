require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « COMMUNAUTÉ » — la carte des revendeurs (migration 018), RENDU,
//  à 1512 px (clair) et 390 px tactile (sombre).
//
//  La base garantit les règles (audit-communaute-sql.cjs, sur un vrai
//  Postgres) ; ce banc vérifie que l'APP les rend, avec DEUX personnes :
//    · opt-in : invisible par défaut, « Apparaître sur la carte » sur son geste,
//      « Me retirer » supprime la ligne ;
//    · zéro inscrit : la carte le dit et invite à être le premier (aucun chiffre
//      inventé) ;
//    · la position rangée est ARRONDIE (0,05°), jamais la valeur exacte ;
//      « me localiser » PROPOSE une ville, on confirme ;
//    · un coucou / un message envoyé arrive chez l'autre (texte brut : aucun
//      lien rendu) ; bloqué ⇒ rien ne passe, il ne le sait pas, il disparaît
//      de la carte de celui qui bloque ; le signalement est rangé ;
//    · base sans la 018 ⇒ « La carte de la communauté n'est pas encore activée
//      sur ta base » ; panne ⇒ « pas pu lire », jamais « personne » ;
//    · aucun email, aucun identifiant de compte, aucun compte Vinted d'autrui
//      dans le DOM ni dans les réponses ;
//    · la carte MapLibre (chargée à l'ouverture de l'écran) se dessine sur le
//      fond OpenFreeMap SOBRE — les VRAIS styles « positron » (clair) et
//      « dark » (sombre), une vraie TileJSON, de vraies tuiles vectorielles et
//      de vrais glyphes, servis par le banc (_carte-fond.cjs) — sans AUCUNE
//      requête vers un autre domaine de carte ; l'attribution exigée une fois
//      chacune ; ni rotation ni boussole ; contrôles de zoom 44 px ; « Ma
//      ville » recentre ; l'épingle est À SA PLACE et suit la carte sans
//      traîner ; une tuile en erreur ne fait pas tomber la carte ; une tuile
//      LENTE non plus (relecture du 22 oct. : elle faisait tomber en liste, au
//      bout de 12 s, une carte qui dessinait déjà le reste — et l'attribution
//      n'apparaissait qu'après « idle ») ; à 390 px l'attribution est VISIBLE à
//      l'ouverture et se replie en « i » au premier glisser (MapLibre) ; les
//      initiales des AUTRES ne sont pas en accent (§7 : l'accent plein est à SA
//      propre épingle) ; la source, le fond ou MapLibre injoignables ⇒ la même
//      communauté en liste.
//  Le faux PostgREST applique les RÈGLES de la 018 (§6.3). Le VRAI api/compte.js
//  est exécuté pour `?mode=communaute`. Aucune fixture : tout est inventé ici.
//  019 : le pseudo Discord (facultatif, validé, montré aux membres visibles) et
//  le CLASSEMENT opt-in (jour · semaine · mois · année) du nombre de ventes —
//  compté par la base : le navigateur n'envoie que la période ; zéro inscrit ⇒
//  « sois le premier » ; panne ⇒ « pas pu lire le classement » ; base sans la
//  019 ⇒ « pas encore activé », et aucune ligne Discord.
//  BANC_MUTATION=bloque-ecrit | opt-in | classement-tous | discord-cache :
//  le faux réaffaiblit une règle ⇒ ROUGE.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const { cspBanc, bilanCsp } = require('./_vercel.cjs');   // CSP de vercel.json servie et observée (21 oct.)
const { execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..', '..');
let chromium;
try { ({ chromium } = require(path.join(RACINE, 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const DIST = path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || 5031);
const MUTATION = process.env.BANC_MUTATION || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + String(d).slice(0, 200) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).split('\n')[0].slice(0, 180)); if (process.env.BANC_TRACE) console.log(String(e && e.message).slice(0, 1500)); } };

const { fixtureCarte } = require('./_carte-fond.cjs');
let FIX = null;

// ── Les personnes (inventées) ────────────────────────────────────────────────
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const Bu = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (id, email) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: id, email, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.c2ln`;
const USERS = { [A]: { id: A, email: 'alice.secret@exemple.test', login: 'alice_vinted_secret' }, [Bu]: { id: Bu, email: 'bruno.secret@exemple.test', login: 'bruno_vinted_secret' } };
const JETONS = {}; for (const u of Object.values(USERS)) JETONS[jwt(u.id, u.email)] = u;
const jetonDe = (id) => Object.keys(JETONS).find((k) => JETONS[k].id === id);
const session = (id) => ({ access_token: jetonDe(id), refresh_token: 'r-' + id, expires_at: Date.now() + 3600e3, user: { id, email: USERS[id].email } });
const SECRETS = [A, Bu, ...Object.values(USERS).flatMap((u) => [u.email, u.login])];

// ── La base : les RÈGLES de la 018, en JS ────────────────────────────────────
let B;
const reset = ({ installe = true, panne = false, installe19 = true, installe20 = true, panneClassement = false } = {}) => { B = { installe, panne, installe19, installe20, panneClassement, profils: {}, convs: [], msgs: [], blocages: [], signalements: [], journal: [], reponses: [], ventes: {}, argsClassement: [], groupes: [] }; };
const FONCTIONS_020 = ['vrm_communaute_groupe_creer', 'vrm_communaute_groupe_rejoindre', 'vrm_communaute_groupe_quitter', 'vrm_communaute_groupe_code', 'vrm_communaute_classement_groupe'];
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let nCode = 0;
const codeNeuf = () => { let c = ''; let x = 1234567 + 7919 * ++nCode; for (let i = 0; i < 8; i++) { c += ALPHA[x % 32]; x = Math.floor(x / 3) + 17 * i; } return c; };
const pidDe = (uid) => B.profils[uid] && B.profils[uid].pid;
const membresActifs = (g) => g.membres.filter((m) => !m.quitte).map((m) => m.pid);
const FONCTIONS_019 = ['vrm_communaute_discord', 'vrm_communaute_classement_inscrire', 'vrm_communaute_classement'];
const arr = (x) => Math.round(Math.round(Number(x) * 20) / 20 * 100) / 100;
let nId = 1;
const uuid = () => `00000000-0000-4000-8000-${String(nId++).padStart(12, '0')}`;
const bloque = (qui, cible) => B.blocages.some((b) => b.qui === qui && b.bloque === cible);
const autreDe = (c, moi) => (c.a === moi ? c.b : c.a);
function rpc(fn, args, uid) {
  if (!B.installe19 && FONCTIONS_019.includes(fn)) return undefined;
  if (!B.installe20 && FONCTIONS_020.includes(fn)) return undefined;
  if (fn === 'vrm_communaute_groupe_creer') {
    if (!B.profils[uid]) return { ok: false, raison: 'invisible' };
    const n = String(args.p_nom || '').trim();
    if (n.length < 2 || n.length > 40 || /[@<>]/.test(n)) return { ok: false, raison: 'nom-groupe' };
    const g = { id: uuid(), nom: n, code: codeNeuf(), cree_par: pidDe(uid), membres: [{ pid: pidDe(uid) }] }; B.groupes.push(g);
    return { ok: true, id: g.id, code: g.code, nom: n };
  }
  if (fn === 'vrm_communaute_groupe_rejoindre') {
    if (!B.profils[uid]) return { ok: false, raison: 'invisible' };
    const g = B.groupes.find((x) => x.code === String(args.p_code || ''));
    if (!g) return { ok: false, raison: 'code' };
    const m = g.membres.find((x) => x.pid === pidDe(uid));
    if (m && !m.quitte) return { ok: true, id: g.id, nom: g.nom, deja: true };
    if (m) m.quitte = false; else g.membres.push({ pid: pidDe(uid) });
    return { ok: true, id: g.id, nom: g.nom };
  }
  if (fn === 'vrm_communaute_groupe_quitter') {
    const g = B.groupes.find((x) => x.id === args.p_groupe); const m = g && g.membres.find((x) => x.pid === pidDe(uid) && !x.quitte);
    if (m) m.quitte = true; return { ok: true, quitte: !!m };
  }
  if (fn === 'vrm_communaute_groupe_code') {
    const g = B.groupes.find((x) => x.id === args.p_groupe);
    if (!g || g.cree_par !== pidDe(uid)) return { ok: false, raison: 'pas-createur' };
    g.code = codeNeuf(); return { ok: true, code: g.code };
  }
  if (fn === 'vrm_communaute_classement_groupe') {
    B.argsClassement.push(args);
    const g = B.groupes.find((x) => x.id === args.p_groupe);
    if (MUTATION !== 'groupe-non-membre' && (!g || !membresActifs(g).includes(pidDe(uid)))) return { acces: true, erreur: 'groupe' };
    const per = String(args.p_periode || '');
    const membres = Object.entries(B.profils).filter(([o, p]) => g && membresActifs(g).includes(p.pid))
      .map(([o, p]) => ({ o, p, ventes: ((B.ventes[o] || {})[per]) || 0 })).sort((x, y) => y.ventes - x.ventes);
    const rangs = membres.map((m) => ({ ...m, rang: 1 + membres.filter((z) => z.ventes > m.ventes).length }));
    const me = rangs.find((m) => m.o === uid);
    return { acces: true, periode: per, groupe: g && g.id, visible: true, inscrit: false, n: rangs.length, moi: me ? { rang: me.rang, ventes: me.ventes } : null,
      lignes: rangs.filter((m) => !bloque(uid, m.o)).map((m) => ({ rang: m.rang, pid: m.p.pid, pseudo: m.p.pseudo, ville: m.p.ville, pays: m.p.pays, ventes: m.ventes, moi: m.o === uid })) };
  }
  if (fn === 'vrm_communaute_discord') {
    if (!B.profils[uid]) return { ok: false, raison: 'invisible' };
    const d = String(args.p_discord || '').trim().toLowerCase();
    if (d && (!/^[a-z0-9._]{2,32}$/.test(d) || d.includes('..'))) return { ok: false, raison: 'discord' };
    B.profils[uid].discord = d || null; return { ok: true, discord: d || null };
  }
  if (fn === 'vrm_communaute_classement_inscrire') {
    if (!B.profils[uid]) return { ok: false, raison: 'invisible' };
    B.profils[uid].classement = args.p_oui === true; return { ok: true, classement: args.p_oui === true };
  }
  if (fn === 'vrm_communaute_classement') {
    B.argsClassement.push(args);
    const per = String(args.p_periode || '');
    if (!['jour', 'semaine', 'mois', 'annee'].includes(per)) return { acces: true, erreur: 'periode' };
    // Le CHIFFRE vient de la base (ici : B.ventes), jamais de l'appel.
    const membres = Object.entries(B.profils).filter(([o, p]) => MUTATION === 'classement-tous' || p.classement)
      .map(([o, p]) => ({ o, p, ventes: ((B.ventes[o] || {})[per]) || 0 })).sort((x, y) => y.ventes - x.ventes || (x.p.cree_le < y.p.cree_le ? -1 : 1));
    const rangs = membres.map((m) => ({ ...m, rang: 1 + membres.filter((z) => z.ventes > m.ventes).length }));
    const me = rangs.find((m) => m.o === uid);
    return { acces: true, periode: per, debut: '2026-10-20T00:00:00+02:00', fin: '2026-10-21T00:00:00+02:00', visible: !!B.profils[uid], inscrit: !!(B.profils[uid] && B.profils[uid].classement),
      n: rangs.length, moi: me ? { rang: me.rang, ventes: me.ventes } : null,
      lignes: rangs.filter((m) => !bloque(uid, m.o)).map((m) => ({ rang: m.rang, pid: m.p.pid, pseudo: m.p.pseudo, ville: m.p.ville, pays: m.p.pays, ventes: m.ventes, moi: m.o === uid })) };
  }
  if (fn === 'vrm_communaute_carte') {
    const moi = B.profils[uid];
    const tous = Object.entries(B.profils);
    if (MUTATION === 'opt-in') for (const u of Object.keys(USERS)) if (!B.profils[u]) tous.push([u, { pid: 'p-' + u.slice(0, 4), pseudo: 'Revendeur', ville: 'Cancale', pays: 'FR', lat: 48.7, lon: -1.85, cree_le: '2026-10-20T00:00:00Z' }]);
    const premier = (p) => !tous.some(([, q]) => q.pays === p.pays && q.ville.toLowerCase() === p.ville.toLowerCase() && q.cree_le < p.cree_le);
    const plus19 = (p, champs) => (B.installe19 ? Object.fromEntries(champs.map((k) => [k, k === 'classement' ? !!p[k] : (p[k] || null)])) : {});
    return { acces: true, moi: moi ? { pid: moi.pid, pseudo: moi.pseudo, ville: moi.ville, pays: moi.pays, lat: moi.lat, lon: moi.lon, depuis: moi.cree_le, ...plus19(moi, ['discord', 'classement']) } : null,
      profils: tous.filter(([o]) => !bloque(uid, o)).map(([o, p]) => ({ pid: p.pid, pseudo: p.pseudo, ville: p.ville, pays: p.pays, lat: p.lat, lon: p.lon, moi: o === uid, premier: premier(p), ...plus19(p, MUTATION === 'discord-cache' ? [] : ['discord']) })),
      ...(B.installe20 ? { groupes: B.groupes.filter((g) => moi && membresActifs(g).includes(moi.pid)).map((g) => ({ id: g.id, nom: g.nom, code: g.code, createur: g.cree_par === moi.pid,
        membres: membresActifs(g).filter((pid) => Object.entries(B.profils).some(([o, p]) => p.pid === pid && !bloque(uid, o))) })) } : {}) };
  }
  if (fn === 'vrm_communaute_rejoindre') {
    const ps = String(args.p_pseudo || '').trim() || 'Revendeur', vi = String(args.p_ville || '').trim();
    if (ps.length > 30 || /[@<>]/.test(ps)) return { ok: false, raison: 'pseudo' };
    if (!vi) return { ok: false, raison: 'ville' };
    if (Object.entries(B.profils).some(([o, p]) => o !== uid && p.pseudo.toLowerCase() === ps.toLowerCase())) return { ok: false, raison: 'pseudo-pris' };
    const anc = B.profils[uid];
    B.profils[uid] = { pid: anc ? anc.pid : uuid(), pseudo: ps, ville: vi, pays: String(args.p_pays || 'FR').toUpperCase(), lat: arr(args.p_lat), lon: arr(args.p_lon), cree_le: anc ? anc.cree_le : new Date(Date.now() + nId).toISOString() };
    return { ok: true, pid: B.profils[uid].pid };
  }
  if (fn === 'vrm_communaute_quitter') { const f = !!B.profils[uid]; delete B.profils[uid]; return f; }
  if (fn === 'vrm_communaute_ecrire') {
    const t = String(args.p_texte || '').trim();
    if (!t || t.length > 500) return { ok: false, raison: 'texte' };
    if (!B.profils[uid]) return { ok: false, raison: 'invisible' };
    const autre = Object.keys(B.profils).find((o) => B.profils[o].pid === args.p_pid);
    if (!autre) return { ok: false, raison: 'introuvable' };
    if (autre === uid) return { ok: false, raison: 'soi' };
    if (bloque(uid, autre)) return { ok: false, raison: 'tu-as-bloque' };
    let c = B.convs.find((x) => (x.a === uid && x.b === autre) || (x.a === autre && x.b === uid));
    if (!c) { c = { id: uuid(), a: uid, b: autre }; B.convs.push(c); }
    B.msgs.push({ id: nId++, conv: c.id, de: uid, texte: t, le: new Date().toISOString(), lu: false, masque: MUTATION === 'bloque-ecrit' ? false : bloque(autre, uid) });
    return { ok: true, conv: c.id };
  }
  const vus = (c) => B.msgs.filter((m) => m.conv === c.id && (m.de === uid || !m.masque));
  const pub = (o) => { const p = B.profils[o]; return p ? { pid: p.pid, pseudo: p.pseudo, ville: p.ville } : null; };
  if (fn === 'vrm_communaute_conversations') {
    return B.convs.filter((c) => c.a === uid || c.b === uid).map((c) => {
      const v = vus(c); if (!v.length) return null; const d = v[v.length - 1]; const o = autreDe(c, uid); const p = pub(o);
      return { conv: c.id, pid: p && p.pid, pseudo: p && p.pseudo, ville: p && p.ville, bloque: bloque(uid, o), dernier: d.texte, deMoi: d.de === uid, quand: d.le, nonLus: v.filter((m) => m.de !== uid && !m.lu).length };
    }).filter(Boolean);
  }
  const conv = B.convs.find((c) => c.id === args.p_conv && (c.a === uid || c.b === uid));
  if (fn === 'vrm_communaute_fil') {
    if (!conv) return null;
    for (const m of B.msgs) if (m.conv === conv.id && m.de !== uid && !m.masque) m.lu = true;
    const o = autreDe(conv, uid);
    return { conv: conv.id, autre: pub(o), bloque: bloque(uid, o), messages: vus(conv).map((m) => ({ id: m.id, moi: m.de === uid, texte: m.texte, le: m.le })) };
  }
  if (fn === 'vrm_communaute_bloquer') {
    if (!conv) return false; const o = autreDe(conv, uid);
    if (args.p_oui !== false) { if (!bloque(uid, o)) B.blocages.push({ qui: uid, bloque: o }); } else B.blocages = B.blocages.filter((b) => !(b.qui === uid && b.bloque === o));
    return true;
  }
  if (fn === 'vrm_communaute_signaler') {
    if (!conv) return false; const o = autreDe(conv, uid);
    B.signalements.push({ par: uid, contre: o, conv: conv.id, raison: String(args.p_raison || ''), extrait: B.msgs.filter((m) => m.conv === conv.id && m.de === o).slice(-5).map((m) => m.texte) });
    return true;
  }
  return undefined;
}

function fauxSupabase(urlBrut, methode, entetes, corps) {
  const u = decodeURIComponent(String(urlBrut));
  const h = {}; for (const [k, v] of Object.entries(entetes || {})) h[k.toLowerCase()] = v;
  const tok = String(h.authorization || '').replace(/^Bearer\s+/i, '');
  const qui = JETONS[tok];
  const uid = qui ? qui.id : null;
  const json = (b, status = 200, hh = {}) => ({ status, body: b === undefined ? '' : JSON.stringify(b), headers: { 'content-type': 'application/json', ...hh } });
  const [chemin] = u.split('?');
  if (/\/auth\/v1\/user/.test(chemin)) return qui ? json({ id: qui.id, email: qui.email, email_confirmed_at: '2026-10-01T00:00:00Z' }) : json({ msg: 'invalid' }, 401);
  if (/\/auth\/v1\//.test(chemin)) return json(qui ? { access_token: tok, refresh_token: 'r', expires_in: 3600, user: { id: qui.id, email: qui.email } } : {});
  const rest = /\/rest\/v1\/(.+)$/.exec(chemin);
  if (!rest) return json({}, 404);
  const cible = rest[1];
  B.journal.push({ u, depuis: corps && corps.__node ? 'serveur' : 'navigateur' });
  if (cible.startsWith('rpc/')) {
    const fn = cible.slice(4);
    if (fn === 'vrm_acces') return json({ obligatoire: false, proprietaire: false, acces: true });
    if (/^vrm_communaute_/.test(fn)) {
      if (!B.installe) return json({ code: 'PGRST202', message: `Could not find the function public.${fn}` }, 404);
      if (B.panne) return { status: 522, body: '<html>522 Connection timed out</html>', headers: { 'content-type': 'text/html' } };
      if (!uid) return json({ message: 'permission denied' }, 401);
      if (B.panneClassement && fn === 'vrm_communaute_classement') return { status: 522, body: '<html>522</html>', headers: { 'content-type': 'text/html' } };
      const args = (corps && corps.json) || {};
      const r = rpc(fn, args, uid);
      if (r === undefined) return json({ code: 'PGRST202' }, 404);
      return json(r);
    }
    return json({ code: 'PGRST202' }, 404);
  }
  if (cible.startsWith('vinted_accounts') && /owner\.neq\./.test(u))return json([]);
  if (cible.startsWith('vinted_accounts')) return json(uid ? [{ vinted_user_id: '1' + uid.slice(0, 3), login: USERS[uid].login, owner: uid }] : []);
  return json([], 200, { 'content-range': '0-0/0' });
}

const VILLES = {
  cancale: [{ lat: '48.676543', lon: '-1.851612', name: 'Cancale', address: { town: 'Cancale', county: 'Ille-et-Vilaine', state: 'Bretagne', country_code: 'fr' } }],
};
const fetchReel = global.fetch;
global.fetch = async (url, opts = {}) => {
  const s = String(url);
  if (/supabase\.co\//.test(s)) {
    const r = fauxSupabase(s, opts.method || 'GET', opts.headers || {}, { json: (() => { try { return JSON.parse(opts.body || '{}'); } catch (_) { return {}; } })(), __node: true });
    return new Response(r.body === '' ? null : r.body, { status: r.status, headers: r.headers });
  }
  if (/api-adresse\.data\.gouv\.fr\/search/.test(s)) {
    const q = new URL(s).searchParams.get('q').toLowerCase();
    if (process.env.BANC_BAN === 'panne') return new Response('<html>502</html>', { status: 502 });
    const villes = Object.entries(VILLES).filter(([k]) => k.startsWith(q.slice(0, 4))).flatMap(([, v]) => v);
    return new Response(JSON.stringify({ features: villes.map((v) => ({ geometry: { coordinates: [Number(v.lon), Number(v.lat)] }, properties: { city: v.name, name: v.name, context: '35, Ille-et-Vilaine, Bretagne', type: 'municipality' } })) }), { status: 200 });
  }
  if (/photon\.komoot\.io/.test(s)) return new Response(JSON.stringify({ features: [] }), { status: 200 });
  if (/nominatim\.openstreetmap\.org\/search/.test(s)) { const q = new URL(s).searchParams.get('q').toLowerCase(); return new Response(JSON.stringify(VILLES[q] || []), { status: 200 }); }
  if (/nominatim\.openstreetmap\.org\/reverse/.test(s)) return new Response(JSON.stringify(VILLES.cancale[0]), { status: 200 });
  if (/api\.stripe\.com/.test(s)) return new Response('{}', { status: 404 });
  return fetchReel(url, opts);
};

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

let compte = null;
// Le fond, servi par le banc (jamais le réseau réel) : _carte-fond.cjs.
// `hotes` : tout domaine EXTÉRIEUR que la page a demandé pendant le banc.
const OFM = { styles: [], tuiles: 0, tuilesKo: 0, tilejson: 0, glyphes: 0, interdit: [], hotes: new Set(), tenue: null, tenueRendue: false, lacher: null };
const CORS = { 'access-control-allow-origin': '*' };
const PNG_VIDE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
// Les domaines extérieurs qui NE SONT PAS la carte (base, villes, avatars Discord).
const hotesCarte = () => [...OFM.hotes].filter((h) => !/(^|\.)supabase\.co$|(^|\.)data\.gouv\.fr$|(^|\.)discord(app)?\.com$/.test(h));
async function ouvrir(nav, { qui, largeur = 1512, sombre = false, sansMoteur = false, sansFond = false, sourceKo = false, tuilesKo = false, tuileLente = false, reduit = false, fragment = '' }) {
  const mobile = largeur < 600;
  const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: sansMoteur ? 'block' : 'allow', reducedMotion: reduit ? 'reduce' : 'no-preference', permissions: ['geolocation'], geolocation: { latitude: 48.6781234, longitude: -1.8523456 } });
  await cspBanc(ctx, `http://localhost:${PORT}`, `communauté ${largeur}${sombre ? ' sombre' : ''}${sansMoteur ? ' sans moteur' : ''}`);
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  // Un morceau qui ne charge pas fait relire la page UNE fois (main.jsx) : on le marque déjà fait.
  if (sansMoteur) await pg.addInitScript(() => { try { sessionStorage.setItem('vrm_recharge_morceau', String(Date.now())); } catch (_) {} });
  await pg.addInitScript(({ s, sombre }) => {
    try { localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_bascule_mineral_v1', '1'); } catch (_) {}
    try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {}
  }, { s: session(qui), sombre });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, async (r) => {
    const rq = r.request(), u = rq.url();
    if (/supabase\.co\//.test(u)) {
      const x = fauxSupabase(u, rq.method(), rq.headers(), { json: (() => { try { return JSON.parse(rq.postData() || '{}'); } catch (_) { return {}; } })() });
      return r.fulfill({ status: x.status, headers: x.headers, body: x.body });
    }
    try { OFM.hotes.add(new URL(u).hostname); } catch (_) {}
    if (/cartocdn\.com|tile\.openstreetmap\.org|versatiles\.org|maptiler\.com|stadiamaps\.com|mapbox\.com/.test(u)) { OFM.interdit.push(u); return r.abort(); }
    if (/^https:\/\/tiles\.openfreemap\.org\//.test(u)) {
      if (sansFond) return r.abort();
      const chemin = new URL(u).pathname;
      const m = chemin.match(/^\/styles\/([a-z]+)$/);
      if (m) { OFM.styles.push(m[1]); return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(FIX.style(m[1] === 'dark')) }); }
      if (chemin === '/planet') { OFM.tilejson++; return sourceKo ? r.fulfill({ status: 503, headers: CORS, body: '' }) : r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(FIX.tilejson()) }); }
      const t = chemin.match(/^\/planet\/[^/]+\/(\d+)\/(\d+)\/(\d+)\.pbf$/);
      if (t) {
        // Une tuile LENTE : la première demandée reste sans réponse ni erreur
        // (30 s au plus, ou jusqu'à `OFM.lacher()`), toutes les autres servies.
        if (tuileLente && !OFM.tenue) {
          OFM.tenue = u; OFM.tenueRendue = false;
          await new Promise((x) => { OFM.lacher = x; setTimeout(x, 30000); });
          OFM.tenueRendue = true;
          try { return await r.fulfill({ status: 200, contentType: 'application/x-protobuf', headers: CORS, body: FIX.tuile(+t[1], +t[2], +t[3]) || Buffer.alloc(0) }); } catch (_) { return; }
        }
        // Une tuile sur trois en erreur serveur (500), les autres servies.
        if (tuilesKo && (+t[2] + +t[3]) % 3 === 0) { OFM.tuilesKo++; return r.fulfill({ status: 500, headers: CORS, body: '' }); }
        OFM.tuiles++; return r.fulfill({ status: 200, contentType: 'application/x-protobuf', headers: CORS, body: FIX.tuile(+t[1], +t[2], +t[3]) || Buffer.alloc(0) });
      }
      const g = chemin.match(/^\/fonts\/([^/]+)\/(\d+-\d+)\.pbf$/);
      if (g) { const b = FIX.glyphe(decodeURIComponent(g[1]), g[2]); if (b) { OFM.glyphes++; return r.fulfill({ status: 200, contentType: 'application/x-protobuf', headers: CORS, body: b }); } }
      // Icônes : le vrai service sert une planche ; le banc en sert une VALIDE
      // mais vide (aucune icône dessinée, aucune erreur de chargement).
      if (/^\/sprites\/.+\.json$/.test(chemin)) return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '{}' });
      if (/^\/sprites\/.+\.png$/.test(chemin)) return r.fulfill({ status: 200, contentType: 'image/png', headers: CORS, body: PNG_VIDE });
      return r.fulfill({ status: 404, headers: CORS, body: '' });
    }
    return ['image', 'media', 'font'].includes(rq.resourceType()) ? r.abort() : r.fulfill({ status: 404, body: '' });
  });
  // MapLibre est embarqué (morceau /assets/maplibre-gl-…) : « injoignable » = ce morceau refusé.
  // (le service worker de VRM, qui sert /assets/ lui-même, est coupé pour ce cas)
  if (sansMoteur) await ctx.route(/\/assets\/maplibre-gl[^/]*\.js/, (r) => r.fulfill({ status: 404, body: '' }));
  await pg.route('**/api/**', async (r) => {
    const rq = r.request(), u = new URL(rq.url());
    const mode = u.searchParams.get('mode');
    if (u.pathname === '/api/compte' && (mode === 'communaute' || mode === 'abonnement' || mode === 'discord-debut' || mode === 'confidentialite')) {
      let corps = null; try { corps = rq.postData() ? JSON.parse(rq.postData()) : null; } catch (_) {}
      const res = { code: 200, corps: null, setHeader() {}, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, end() { return this; } };
      const lecteur = corps ? (async function* () { yield Buffer.from(JSON.stringify(corps)); })() : null;
      const req = { method: rq.method(), query: Object.fromEntries(u.searchParams), headers: rq.headers(), body: corps || undefined, [Symbol.asyncIterator]() { return lecteur ? lecteur[Symbol.asyncIterator]() : (async function* () {})(); } };
      await compte(req, res);
      const body = JSON.stringify(res.corps);
      if (mode === 'communaute') B.reponses.push({ qui, body });
      return r.fulfill({ status: res.code, contentType: 'application/json', body });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=communaute${fragment}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { const e = document.querySelector('[data-communaute-etat]'); return e && e.getAttribute('data-communaute-etat') !== 'charge'; }, null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(800);
  return { ctx, pg, erreurs };
}
const etatDe = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-communaute-etat]'); return e ? e.getAttribute('data-communaute-etat') : null; });
const attr = (pg, sel, a) => pg.evaluate(([s, x]) => { const e = document.querySelector(s); return e ? e.getAttribute(x) : null; }, [sel, a]);
const texte = (pg) => pg.evaluate(() => document.body.innerText);
const sansSecret = (s) => SECRETS.filter((x) => s.includes(x));

async function rejoindreParNom(pg, ville) {
  await pg.click('[data-cm-apparaitre]');
  await pg.fill('[data-cm-ville-q]', ville);
  await pg.click('[data-cm-chercher]');
  await pg.waitForSelector(`[data-cm-ville-choix]`, { timeout: 8000 });
  await pg.click(`[data-cm-ville-choix]`);
  await pg.click('[data-cm-valider]');
  await pg.waitForSelector('[data-cm-moi="visible"]', { timeout: 8000 });
}

// ── 019 : Discord et classement ──────────────────────────────────────────────
const posePersonnes = () => {
  reset();
  B.profils[A] = { pid: uuid(), pseudo: 'Alice', ville: 'Cancale', pays: 'FR', lat: 48.7, lon: -1.85, cree_le: '2026-10-19T00:00:00Z' };
  B.profils[Bu] = { pid: uuid(), pseudo: 'Bruno', ville: 'Cancale', pays: 'FR', lat: 48.7, lon: -1.85, cree_le: '2026-10-20T00:00:00Z', discord: 'bruno.vrm', classement: true };
  B.ventes[A] = { jour: 2, semaine: 3, mois: 12, annee: 40 };
  B.ventes[Bu] = { jour: 5, semaine: 7, mois: 9, annee: 30 };
};
const vers = async (pg, vue) => { await pg.click(`[data-cm-vue="${vue}"]`); await pg.waitForSelector(`[data-cm-vue-active="${vue}"]`, { timeout: 8000 }); };
const classementLu = (pg) => pg.waitForFunction(() => { const e = document.querySelector('[data-cm-classement]'); return e && e.getAttribute('data-cm-classement') !== 'charge'; }, null, { timeout: 10000 });
async function partie019(nav) {
  for (const [largeur, sombre] of [[1512, false], [390, true]]) {
    console.log(`\n── 019 · ${largeur} px${sombre ? ' tactile, sombre' : ''} · le pseudo Discord`);
    await essaie(`discord ${largeur}`, async () => {
      posePersonnes();
      const { ctx, pg } = await ouvrir(nav, { qui: A, largeur, sombre });
      dit(await attr(pg, '[data-cm-mon-discord]', 'data-cm-mon-discord') === 'non', 'Discord est vide par défaut (facultatif)');
      await pg.click('[data-cm-discord-ajouter]');
      await pg.fill('[data-cm-discord-champ]', 'a..b');
      await pg.click('[data-cm-discord-valider]');
      await pg.waitForSelector('.vrm-cm-discord-moi .vrm-cm-msg', { timeout: 5000 });
      dit(!B.profils[A].discord, 'un pseudo Discord invalide est refusé (rien d’enregistré)', String(B.profils[A].discord));
      await pg.fill('[data-cm-discord-champ]', '@Alice.VRM');
      await pg.click('[data-cm-discord-valider]');
      await pg.waitForSelector('[data-cm-mon-discord="oui"]', { timeout: 8000 });
      dit(B.profils[A].discord === 'alice.vrm', 'un pseudo valide est enregistré (le @ de tête retiré, en minuscules)', String(B.profils[A].discord));
      await pg.waitForSelector('[data-cm-pin]', { timeout: 15000 }).catch(() => {});
      if (await pg.$('[data-cm-pin]')) {
        await pg.click('[data-cm-pin]');
        await pg.waitForSelector('[data-cm-personnes]', { timeout: 8000 });
        dit(!!(await pg.$('[data-cm-discord="bruno.vrm"]')), 'le pseudo Discord de Bruno est montré aux membres visibles');
        await pg.click('.vrm-cm-x');
      } else dit(false, 'la carte n’a pas d’épingle à toucher');
      await pg.click('[data-cm-discord-retirer]');
      await pg.waitForSelector('[data-cm-mon-discord="non"]', { timeout: 8000 });
      dit(B.profils[A].discord === null, '« Retirer » efface le pseudo Discord');
      const largeurPage = await pg.evaluate(() => document.documentElement.scrollWidth);
      dit(largeurPage <= largeur, 'aucun débordement horizontal', String(largeurPage));

      console.log(`── 019 · ${largeur} px · le classement`);
      await vers(pg, 'classement'); await classementLu(pg);
      dit(await attr(pg, '[data-cm-inscrit]', 'data-cm-inscrit') === 'non', 'opt-in : Alice n’est pas dans le classement par défaut');
      const lignes0 = await pg.$$eval('[data-cm-ligne]', (e) => e.map((x) => x.getAttribute('data-cm-ligne-moi')));
      dit(lignes0.length === 1 && lignes0[0] === 'non', 'elle voit Bruno (inscrit), pas elle-même', JSON.stringify(lignes0));
      dit((await pg.$eval('[data-cm-ligne]', (e) => e.getAttribute('data-cm-ligne-ventes'))) === '7', 'le chiffre est celui de la base (cette semaine : 7)');
      pg.once('dialog', (d) => d.accept());
      await pg.click('[data-cm-classement-entrer]');
      await pg.waitForSelector('[data-cm-inscrit="oui"]', { timeout: 8000 });
      await classementLu(pg);
      dit(B.profils[A].classement === true, 'elle entre dans le classement sur son geste (confirmé)');
      dit(await attr(pg, '[data-cm-rang-moi]', 'data-cm-rang-moi') === '2' && /Ta position\s*2ᵉ\s*\/ 2/.test(await texte(pg)), 'la carte de position affiche 2ᵉ / 2 cette semaine');
      dit(await attr(pg, '[data-cm-ligne-moi="oui"]', 'data-cm-ligne-ventes') === '3', 'sa ligne est mise en avant avec SES ventes (3)');
      await pg.click('[data-cm-periode="mois"]'); await classementLu(pg);
      await pg.waitForFunction(() => document.querySelector('[data-cm-rang-moi]') && document.querySelector('[data-cm-rang-moi]').getAttribute('data-cm-rang-moi') === '1', null, { timeout: 8000 }).catch(() => {});
      dit(await attr(pg, '[data-cm-rang-moi]', 'data-cm-rang-moi') === '1' && /1er/.test(await texte(pg)), 'ce mois : elle passe 1re (12 contre 9)');
      dit(B.argsClassement.length > 0 && B.argsClassement.every((a) => Object.keys(a).join() === 'p_periode'), 'le navigateur n’envoie QUE la période — jamais un chiffre', JSON.stringify(B.argsClassement.slice(-2)));
      dit(!/€/.test(await pg.$eval('[data-cm-classement]', (e) => e.innerText)), 'aucun montant dans le classement');
      const dom = await pg.evaluate(() => document.documentElement.outerHTML);
      dit(sansSecret(dom).length === 0, 'aucun email ni identifiant de compte dans le DOM', sansSecret(dom).join(', '));
      if (sombre) {
        const l = await pg.evaluate(() => { const c = document.querySelector('[data-cm-classement] .vrm-cm-carton'); const v = (getComputedStyle(c).backgroundColor.match(/[\d.]+/g) || []).map(Number); return (v[0] + v[1] + v[2]) / 3; });
        dit(l < 40, 'mode sombre : le classement est sombre', String(l));
      }
      const lp = await pg.evaluate(() => document.documentElement.scrollWidth);
      dit(lp <= largeur, 'classement : aucun débordement horizontal', String(lp));
      if (process.env.BANC_DEBUG) await pg.screenshot({ path: `${process.env.BANC_DEBUG}/classement${largeur}.png`, fullPage: true });
      await pg.click('[data-cm-classement-sortir]');
      await pg.waitForSelector('[data-cm-inscrit="non"]', { timeout: 8000 });
      dit(B.profils[A].classement === false, '« Me retirer du classement » sur son geste');
      await ctx.close();
    });
  }
  for (const [nom, prep, attendu, phrase] of [
    ['zéro inscrit', () => { posePersonnes(); B.profils[Bu].classement = false; }, 'lu', /Personne n’est encore dans le classement/],
    ['panne du classement', () => { posePersonnes(); B.panneClassement = true; }, 'pas-su', /pas pu lire le classement/],
    ['base sans la 019', () => { posePersonnes(); B.installe19 = false; }, 'non-installe', /Le classement n’est pas encore activé sur ta base/],
  ]) {
    console.log(`\n── 019 · 390 px · ${nom}`);
    await essaie(nom, async () => {
      prep();
      const { ctx, pg } = await ouvrir(nav, { qui: A, largeur: 390 });
      if (nom === 'base sans la 019') dit(!(await pg.$('[data-cm-mon-discord]')), 'sans la 019 : aucune ligne Discord (rien qu’on ne puisse enregistrer)');
      await vers(pg, 'classement'); await classementLu(pg);
      dit(await attr(pg, '[data-cm-classement]', 'data-cm-classement') === attendu, `${nom} : état « ${attendu} »`, await attr(pg, '[data-cm-classement]', 'data-cm-classement'));
      const t = await texte(pg);
      dit(phrase.test(t), `${nom} : la phrase est dite`, t.slice(0, 200).replace(/\n/g, ' '));
      dit((await pg.$$('[data-cm-ligne]')).length === 0, `${nom} : aucune ligne de classement affichée`);
      if (nom !== 'zéro inscrit') dit(!/Personne n’est encore dans le classement/.test(t), `${nom} : jamais « personne » sur un classement qu’on n’a pas lu`);
      await ctx.close();
    });
  }
}

(async () => {
  FIX = await fixtureCarte();
  try { compte = (await import('file://' + path.join(RACINE, 'api', 'compte.js'))).default; }
  catch (e) { console.log('❌ api/compte.js ne se charge pas : ' + e.message); process.exit(1); }
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  if (MUTATION) console.log(`(mutation « ${MUTATION} »)`);
  if (!FIX.pret) console.log('⚠️  styles OpenFreeMap / paquets du fond introuvables (réseau ?) : le fond du banc est un style minimal — le rendu réel n’est PAS jugé.');
  try {
    reset();
    console.log('\n── 1512 px · Alice, zéro inscrit');
    let A1;
    await essaie('zéro inscrit', async () => {
      A1 = await ouvrir(nav, { qui: A });
      const { pg } = A1;
      dit(await etatDe(pg) === 'lu', 'l’écran Communauté s’ouvre par ?tab=communaute (état « lu »)', await etatDe(pg));
      dit(await attr(pg, '[data-cm-moi]', 'data-cm-moi') === 'invisible', 'opt-in : Alice est INVISIBLE par défaut');
      dit(!!(await pg.$('[data-cm-vide]')) && /Personne n’est encore sur la carte/.test(await texte(pg)), 'zéro inscrit : la carte le dit et invite à être le premier');
      dit(!(await pg.$('[data-cm-chiffre]')), 'aucun chiffre affiché quand il n’y a personne');
      await pg.waitForSelector('[data-cm-carte="prete"]', { timeout: 15000 }).catch(() => {});
      dit(await attr(pg, '[data-cm-carte]', 'data-cm-carte') === 'prete', 'la carte (MapLibre) se dessine, chargée à l’ouverture de l’écran');
      await pg.waitForSelector('[data-cm-fond="openfreemap"]', { timeout: 20000 }).catch(() => {});
      dit(await attr(pg, '[data-cm-carte]', 'data-cm-fond') === 'openfreemap' && OFM.styles.includes('positron') && OFM.tuiles > 0, 'le fond OpenFreeMap « positron » (sobre) est demandé et dessiné, tuiles vectorielles', JSON.stringify({ styles: OFM.styles, tuiles: OFM.tuiles }));
      dit(!OFM.styles.includes('liberty'), 'le style coloré « liberty » n’est plus demandé', JSON.stringify(OFM.styles));
      const attrib = await pg.evaluate(() => { const e = document.querySelector('.vrm-cm-carte .maplibregl-ctrl-attrib'); return e ? e.textContent : ''; });
      const fois = (mot) => (attrib.match(new RegExp(mot, 'g')) || []).length;
      dit(fois('OpenFreeMap') === 1 && fois('OpenMapTiles') === 1 && fois('OpenStreetMap') === 1, 'l’attribution exigée est affichée, chaque mention UNE fois (OpenFreeMap · © OpenMapTiles · OpenStreetMap)', attrib);
      const attribVisible = await pg.evaluate(() => { const e = document.querySelector('.vrm-cm-carte .maplibregl-ctrl-attrib-inner'); const r = e && e.getBoundingClientRect(); return !!(r && r.width > 40 && r.height > 8); });
      dit(attribVisible, 'ordinateur : l’attribution est dépliée (lisible sans clic)');
      dit(!(await pg.$('.vrm-cm-carte .leaflet-container')) && !!(await pg.$('.vrm-cm-carte canvas.maplibregl-canvas')), 'MapLibre natif : un canvas, plus de Leaflet');
      dit(!(await pg.$('.vrm-cm-carte .maplibregl-ctrl-compass')), 'aucune boussole (la rotation est coupée)');
      const ctrl = await pg.$$eval('[data-cm-zoom]', (e) => e.map((b) => { const r = b.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); }));
      dit(ctrl.length === 2 && ctrl.every((x) => x >= 44), 'les contrôles de zoom font 44 px', JSON.stringify(ctrl));
      await pg.waitForTimeout(800);
      const img = await pg.locator('.vrm-cm-carte-fond').screenshot();
      dit(img.length > 12000, 'la carte porte un dessin (eau, terres, frontières) — pas une carte grise unie', img.length + ' octets');
      if (process.env.BANC_DEBUG) await pg.screenshot({ path: process.env.BANC_DEBUG + '/carte1512-clair.png' });
      dit(OFM.interdit.length === 0, 'aucune requête vers un autre fond de carte (CARTO, tile.openstreetmap.org, VersaTiles…)', OFM.interdit.slice(0, 2).join(' '));
      dit(hotesCarte().every((h) => h === 'tiles.openfreemap.org'), 'la carte n’appelle qu’UN domaine extérieur : tiles.openfreemap.org', [...OFM.hotes].join(' '));
      dit((await pg.$$('[data-cm-pin]')).length === 0, 'aucune épingle sur une carte vide (aucun faux utilisateur)');
    });

    console.log('\n── 1512 px · Alice apparaît sur la carte (sa ville, arrondie)');
    await essaie('rejoindre', async () => {
      const { pg } = A1;
      await rejoindreParNom(pg, 'Cancale');
      const p = B.profils[A];
      dit(p && p.lat === 48.7 && p.lon === -1.85, 'la position RANGÉE est arrondie à 0,05° (48,70 / −1,85), jamais 48,676543 / −1,851612', JSON.stringify(p));
      const t = await texte(pg);
      dit(/Tu es sur la carte à Cancale/.test(t), 'l’écran dit où on la voit');
      dit(/Personne d’autre que toi sur la carte/.test(t), 'seule sur la carte : elle le lit (aucun faux utilisateur)');
      dit(!B.reponses.some((x) => /48\.676|1\.8516/.test(x.body)), 'aucune réponse ne porte la position exacte');
      await pg.waitForSelector('[data-cm-pin]', { timeout: 8000 }).catch(() => {});
      const pins = await pg.$$eval('[data-cm-pin]', (e) => e.map((x) => x.className));
      dit(pins.length === 1 && /moi/.test(pins[0]), 'une épingle : la sienne', JSON.stringify(pins));
      const rc = await pg.$eval('[data-cm-recentrer]', (b) => { const r = b.getBoundingClientRect(); return { h: Math.round(r.height), t: b.getAttribute('aria-label') }; }).catch(() => null);
      dit(rc && rc.h >= 44 && /Cancale/.test(rc.t), '« Ma ville » recentre sur sa ville (44 px)', JSON.stringify(rc));
      // L'épingle est À SA PLACE : la carte vient de se centrer sur sa ville,
      // son épingle doit être au centre de la carte (pas décalée dans la page).
      await pg.waitForTimeout(1800);
      const place = async () => pg.evaluate(() => { const c = document.querySelector('.vrm-cm-carte-fond').getBoundingClientRect(); const p = document.querySelector('[data-cm-pin].moi').getBoundingClientRect(); return { dx: Math.round(p.x + p.width / 2 - (c.x + c.width / 2)), dy: Math.round(p.y + p.height / 2 - (c.y + c.height / 2)), px: p.x + p.width / 2, py: p.y + p.height / 2, cx: c.x, cy: c.y, cw: c.width, ch: c.height }; });
      const p0 = await place();
      dit(Math.abs(p0.dx) <= 6 && Math.abs(p0.dy) <= 6, 'son épingle est À SA PLACE : au centre de la carte centrée sur sa ville', JSON.stringify({ dx: p0.dx, dy: p0.dy }));
      // Elle suit la carte sans traîner : on fait glisser la carte de 120 × 60 px
      // (bouton maintenu), l'épingle doit avoir bougé d'autant 40 ms plus tard.
      const sx = p0.cx + p0.cw * 0.25, sy = p0.cy + p0.ch * 0.3;
      await pg.mouse.move(sx, sy); await pg.mouse.down();
      for (let i = 1; i <= 6; i++) { await pg.mouse.move(sx + 20 * i, sy + 10 * i); await pg.waitForTimeout(16); }
      await pg.waitForTimeout(40);
      const p1 = await place();
      await pg.mouse.up();
      const ddx = Math.round(p1.px - p0.px), ddy = Math.round(p1.py - p0.py);
      dit(Math.abs(ddx - 120) <= 6 && Math.abs(ddy - 60) <= 6, 'son épingle suit la carte qu’on déplace, sans traîner derrière (déplacement 120 × 60 px)', JSON.stringify({ ddx, ddy }));
      const trans = await pg.evaluate(() => { const m = document.querySelector('.vrm-cm-carte .maplibregl-marker'); return m ? getComputedStyle(m).transitionProperty : null; });
      dit(trans != null && !/transform|\ball\b/.test(trans), 'le marqueur de MapLibre n’a aucune transition sur sa position', trans);
      // (30 oct.) Communauté suit l'accent du THÈME (plus son bleu à elle) : on compare à la couleur que prend `var(--vrm-accent)`.
      const [fondMoi, accentTheme] = await pg.evaluate(() => { const b = document.querySelector('[data-cm-pin].moi'); const t = document.createElement('i'); const host = document.querySelector('.vrm-communaute') || document.body; t.style.background = 'var(--vrm-accent, rgb(36, 88, 230))'; host.appendChild(t); const a = getComputedStyle(t).backgroundColor; t.remove(); return [b ? getComputedStyle(b).backgroundColor : null, a]; });
      dit(fondMoi && fondMoi === accentTheme, 'son épingle est EN ACCENT (la seule couleur de la carte), même avec ses initiales', `${fondMoi} / ${accentTheme}`);
      if (process.env.BANC_DEBUG) await pg.screenshot({ path: process.env.BANC_DEBUG + '/a1512.png', fullPage: true });
      await A1.ctx.close();
    });

    console.log('\n── 390 px tactile, sombre · Bruno');
    let B1;
    await essaie('bruno voit, n’est pas vu', async () => {
      B1 = await ouvrir(nav, { qui: Bu, largeur: 390, sombre: true });
      const { pg } = B1;
      dit(await attr(pg, '[data-cm-moi]', 'data-cm-moi') === 'invisible', 'Bruno est invisible tant qu’il n’a pas choisi sa ville');
      const n = await pg.evaluate(() => [...document.querySelectorAll('[data-cm-chiffre="total"] b')].map((e) => e.textContent).join(''));
      dit(n === '1', 'il voit 1 revendeur sur la carte (Alice), pas lui-même', n);
      const m = await pg.evaluate(() => {
        const lum = (c) => { const v = (c.match(/[\d.]+/g) || []).map(Number); if (v.length === 4 && v[3] === 0) return null; const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2]); };
        const e = document.querySelector('.vrm-communaute'); const c = e && e.querySelector('.vrm-cm-carton');
        return { sombre: e && e.getAttribute('data-dark'), carton: c ? lum(getComputedStyle(c).backgroundColor) : null };
      });
      dit(m.sombre === 'true' && m.carton != null && m.carton < 0.05, 'mode sombre : les cartes sont sombres', JSON.stringify(m));
      const largeur = await pg.evaluate(() => document.documentElement.scrollWidth);
      dit(largeur <= 390, 'aucun débordement horizontal à 390 px', String(largeur));
      await pg.waitForSelector('[data-cm-pin]', { timeout: 15000 });
      const geo = await pg.evaluate(() => { const c = document.querySelector('[data-cm-carte]'); const r = c.getBoundingClientRect(); const cv = c.querySelector('canvas');
        return { zoom: getComputedStyle(c).zoom, haut: Math.round(r.top), vh: innerHeight, l: Math.round(r.width), cv: cv ? Math.round(cv.getBoundingClientRect().width) : null }; });
      dit(geo.zoom === '1' || geo.zoom === 'normal', 'téléphone : aucun zoom CSS posé sur le conteneur de la carte (MapLibre ne le compte pas, Safari surtout)', JSON.stringify(geo));
      dit(geo.haut < geo.vh * 0.6, 'téléphone : la carte est dans le premier écran, pas sous la barre du bas', JSON.stringify(geo));
      dit(geo.cv != null && Math.abs(geo.cv - (geo.l - 2)) <= 2, 'téléphone : le dessin remplit la carte (pas grossi, pas de bande grise)', JSON.stringify(geo));
      await pg.waitForSelector('[data-cm-fond="openfreemap"]', { timeout: 20000 }).catch(() => {});
      // (29 oct.) Julien : la carte garde ses couleurs claires en mode sombre.
      dit(OFM.styles.includes('positron') && !OFM.styles.includes('dark') && await attr(pg, '[data-cm-carte]', 'data-cm-fond') === 'openfreemap', 'sombre : la carte reste CLAIRE (style « positron », jamais « dark »)', JSON.stringify(OFM.styles));
      const pin = await pg.$eval('[data-cm-pin]', (b) => { const r = b.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); });
      dit(pin >= 44, 'téléphone : une épingle fait 44 px au doigt', String(pin));
      const nAttr = await pg.$$eval('.vrm-cm-carte .maplibregl-ctrl-attrib', (e) => e.length);
      dit(nAttr === 1, 'une seule attribution (jamais deux mentions empilées)', String(nAttr));
      const ib = await pg.evaluate(() => { const e = document.querySelector('.vrm-cm-carte .maplibregl-compact summary.maplibregl-ctrl-attrib-button'); if (!e) return null; const r = e.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), rep: getComputedStyle(e).backgroundRepeat }; });
      dit(ib && ib.h <= 28 && /no-repeat/.test(ib.rep), 'téléphone : l’attribution se replie derrière UN seul « i » (pas deux pictogrammes empilés)', JSON.stringify(ib));
      if (process.env.BANC_DEBUG) await pg.screenshot({ path: process.env.BANC_DEBUG + '/carte390-sombre.png' });
      dit(OFM.interdit.length === 0, 'sombre : aucune requête vers un autre fond de carte', OFM.interdit.slice(0, 2).join(' '));
      if (process.env.BANC_DEBUG) { console.log(await pg.evaluate(() => { const b = document.querySelector('[data-cm-pin]').getBoundingClientRect(); const e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return JSON.stringify(b) + ' ' + (e && e.outerHTML.slice(0, 200)); })); await pg.screenshot({ path: process.env.BANC_DEBUG + '/b390.png', fullPage: true }); }
      await pg.click('[data-cm-pin]');
      await pg.waitForSelector('[data-cm-personnes]', { timeout: 8000 });
      dit(/Mets-toi sur la carte pour lui écrire/.test(await texte(pg)) && !(await pg.$('[data-cm-ecrire]')), 'invisible, il ne peut écrire à personne (et l’écran le dit)');
      await pg.click('.vrm-cm-x');
    });
    await essaie('me localiser', async () => {
      const { pg } = B1;
      await pg.click('[data-cm-apparaitre]');
      await pg.fill('[data-cm-pseudo]', 'Bruno');
      await pg.click('[data-cm-localiser]');
      await pg.waitForSelector('[data-cm-ville-choix="Cancale"][aria-selected="true"]', { timeout: 8000 });
      dit(!B.profils[Bu], '« me localiser » PROPOSE la ville — rien n’est enregistré avant sa confirmation');
      await pg.click('[data-cm-valider]');
      await pg.waitForSelector('[data-cm-moi="visible"]', { timeout: 8000 });
      dit(B.profils[Bu] && B.profils[Bu].lat === 48.7 && B.profils[Bu].lon === -1.85, 'la ville confirmée est rangée arrondie, pas la position du téléphone (48,678 / −1,852)', JSON.stringify(B.profils[Bu]));
      const t = await texte(pg);
      dit(/1\s*autre à Cancale/.test(t.replace(/\n/g, ' ')), '« 1 autre à Cancale » (un chiffre lu, pas inventé)', (t.match(/\d+\s*autres? à \w+/) || [''])[0]);
    });
    await essaie('coucou', async () => {
      const { pg } = B1;
      await pg.waitForSelector('[data-cm-pin]');
      await pg.click('[data-cm-pin]');
      await pg.waitForSelector('[data-cm-personnes]', { timeout: 8000 });
      if (process.env.BANC_DEBUG) { await pg.waitForTimeout(600); console.log(await pg.evaluate(() => { const f = document.querySelector('[data-cm-personnes]'); const cs = getComputedStyle(f); const r = f.getBoundingClientRect(); const e = document.elementFromPoint(r.x + 20, r.y + r.height - 20); const v = f.closest('.vrm-cm-voile'); return JSON.stringify({ bg: cs.backgroundColor, filtre: cs.filter, op: cs.opacity, r, parent: v.parentElement.parentElement.tagName, voileZ: getComputedStyle(v).zIndex, voileBF: getComputedStyle(v).backdropFilter, dessus: e && e.outerHTML.slice(0, 120) }); })); await pg.screenshot({ path: process.env.BANC_DEBUG + '/personnes390.png' }); }
      dit(!!(await pg.$(`[data-cm-premier]`)), 'Alice porte le badge « premier de Cancale » (la première arrivée)');
      await pg.click('[data-cm-coucou]');
      // Le toast de SON arrivée sur la carte (3,5 s) peut encore être là : on
      // attend celui du coucou (ou son refus), jamais « un toast » quelconque —
      // sous charge, le contrôle lisait la base avant que le message parte.
      await pg.waitForFunction(() => { const t = document.querySelector('[data-cm-toast]'); return !!(t && /Coucou envoyé|pas pu|Réessaie/i.test(t.textContent)); }, null, { timeout: 8000 }).catch(() => {});
      dit(B.msgs.length === 1 && B.msgs[0].de === Bu && /Coucou/.test(B.msgs[0].texte), 'un coucou en un geste : le message part', JSON.stringify(B.msgs.map((m) => m.texte)));
      const dom = await pg.evaluate(() => document.documentElement.outerHTML);
      dit(sansSecret(dom).length === 0, 'aucun email, identifiant de compte ni compte Vinted d’autrui dans le DOM', sansSecret(dom).join(', '));
      await B1.ctx.close();
    });

    console.log('\n── 1512 px · Alice lit, répond, bloque, signale');
    let A2;
    await essaie('alice reçoit', async () => {
      A2 = await ouvrir(nav, { qui: A });
      const { pg } = A2;
      dit(await attr(pg, '[data-cm-nonlus]', 'data-cm-nonlus') === '1', 'le message arrive : 1 non lu');
      await pg.click('[data-cm-conv]');
      await pg.waitForSelector('[data-cm-bulle="autre"]', { timeout: 8000 });
      dit(/Coucou/.test(await pg.$eval('[data-cm-bulle="autre"]', (e) => e.innerText)), 'elle lit le coucou de Bruno');
      await pg.fill('[data-cm-texte]', 'Salut ! <a href="https://pirate.test">clique</a> https://pirate.test');
      await pg.click('[data-cm-envoyer]');
      await pg.waitForFunction(() => document.querySelectorAll('[data-cm-bulle="moi"]').length === 1, null, { timeout: 8000 });
      if (process.env.BANC_DEBUG) await pg.screenshot({ path: process.env.BANC_DEBUG + '/fil1512.png' });
      dit(!(await pg.$('.vrm-cm-bulles a')), 'aucun lien rendu dans une bulle : le texte est écrit tel quel');
      dit(/<a href=/.test(await pg.$eval('[data-cm-bulle="moi"]', (e) => e.innerText)), 'les chevrons sont affichés comme du texte');
      pg.once('dialog', (d) => d.accept());
      await pg.click('[data-cm-bloquer]');
      await pg.waitForSelector('[data-cm-bloque]', { timeout: 8000 });
      dit(B.blocages.length === 1 && B.blocages[0].qui === A, 'elle bloque Bruno (confirmé)');
      pg.once('dialog', (d) => d.accept('insistant'));
      await pg.click('[data-cm-signaler]');
      await pg.waitForFunction(() => /Signalement envoyé/.test(document.body.innerText), null, { timeout: 8000 });
      dit(B.signalements.length === 1 && B.signalements[0].raison === 'insistant' && B.signalements[0].contre === Bu, 'le signalement est rangé (raison, personne signalée, extrait)', JSON.stringify(B.signalements));
      await A2.ctx.close();
    });
    await essaie('bloqué ⇒ rien ne passe', async () => {
      // Bruno écrit encore (par la vraie route) : il ne sait pas qu'il est bloqué.
      const B2 = await ouvrir(nav, { qui: Bu, largeur: 390, sombre: true });
      await B2.pg.click('[data-cm-conv]');
      await B2.pg.waitForSelector('[data-cm-texte]', { timeout: 8000 });
      await B2.pg.fill('[data-cm-texte]', 'tu es là ?');
      await B2.pg.click('[data-cm-envoyer]');
      await B2.pg.waitForFunction(() => [...document.querySelectorAll('[data-cm-bulle="moi"]')].some((e) => /tu es là/.test(e.innerText)), null, { timeout: 8000 }).catch(() => {});
      dit(await B2.pg.evaluate(() => [...document.querySelectorAll('[data-cm-bulle="moi"]')].some((e) => /tu es là/.test(e.innerText))), 'Bruno voit son message parti (il ne sait pas qu’il est bloqué)');
      await B2.ctx.close();
      const A3 = await ouvrir(nav, { qui: A });
      dit(!(await A3.pg.$('[data-cm-nonlus]')), 'chez Alice : aucun non-lu');
      await A3.pg.click('[data-cm-conv]');
      await A3.pg.waitForSelector('[data-cm-messages]', { timeout: 8000 });
      dit(!/tu es là/.test(await A3.pg.$eval('[data-cm-messages]', (e) => e.innerText)), 'le message du bloqué n’arrive PAS chez Alice');
      await A3.pg.click('.vrm-cm-x');
      const n = await attr(A3.pg, '[data-cm-total]', 'data-cm-total');
      dit(n === '1', 'Bruno a disparu de la carte d’Alice (elle seule)', n);
      console.log('\n── 1512 px · Alice se retire');
      await A3.pg.click('[data-cm-quitter]');
      await A3.pg.waitForSelector('[data-cm-moi="invisible"]', { timeout: 8000 });
      dit(!B.profils[A], '« Me retirer de la carte » : sa ligne est SUPPRIMÉE');
      await A3.ctx.close();
    });

    await essaie('aucun secret dans les réponses', async () => {
      const fuites = B.reponses.flatMap((x) => sansSecret(x.body).map((s) => s.slice(0, 12)));
      dit(B.reponses.length > 5 && fuites.length === 0, `aucune réponse de la route (${B.reponses.length}) ne porte un email, un identifiant de compte ou un compte Vinted`, [...new Set(fuites)].join(', '));
    });

    for (const [nom, opts, attendu, phrase] of [
      ['base sans la 018', { installe: false }, 'non-installe', /La carte de la communauté n’est pas encore activée sur ta base/],
      ['panne', { panne: true }, 'pas-su', /pas pu lire la carte/],
    ]) {
      console.log(`\n── 390 px · ${nom}`);
      await essaie(nom, async () => {
        reset(opts);
        const { ctx, pg } = await ouvrir(nav, { qui: A, largeur: 390 });
        dit(await etatDe(pg) === attendu, `${nom} : l’écran est dans l’état « ${attendu} »`, await etatDe(pg));
        const t = await texte(pg);
        dit(phrase.test(t), `${nom} : la phrase est dite`, t.slice(0, 160).replace(/\n/g, ' '));
        dit(!/Personne n’est encore|Personne d’autre/.test(t), `${nom} : jamais « personne » sur une carte qu’on n’a pas lue`);
        await ctx.close();
      });
    }

    console.log('\n── les deux autres combinaisons : 1512 px sombre, 390 px clair');
    // (29 oct.) La carte reste claire en mode sombre (décision de Julien) : « positron » partout.
    for (const [largeur, sombre, style] of [[1512, true, 'positron'], [390, false, 'positron']]) {
      await essaie(`rendu ${largeur} ${sombre ? 'sombre' : 'clair'}`, async () => {
        reset();
        B.profils[Bu] = { pid: uuid(), pseudo: 'Bruno', ville: 'Cancale', pays: 'FR', lat: 48.7, lon: -1.85, cree_le: '2026-10-20T00:00:00Z' };
        OFM.styles = []; OFM.tuiles = 0;
        const { ctx, pg } = await ouvrir(nav, { qui: A, largeur, sombre });
        await pg.waitForSelector('[data-cm-fond="openfreemap"]', { timeout: 20000 }).catch(() => {});
        dit(await attr(pg, '[data-cm-carte]', 'data-cm-fond') === 'openfreemap' && OFM.styles.includes(style) && !OFM.styles.includes('dark') && OFM.tuiles > 0, `${largeur} px ${sombre ? 'sombre' : 'clair'} : le style « ${style} » est demandé et dessiné (jamais « dark »)`, JSON.stringify({ styles: OFM.styles, tuiles: OFM.tuiles }));
        const l = await pg.evaluate(() => document.documentElement.scrollWidth);
        dit(l <= largeur, `${largeur} px : aucun débordement horizontal`, String(l));
        const pin = await pg.$eval('[data-cm-pin]', (b) => { const r = b.getBoundingClientRect(); const c = b.closest('.vrm-cm-carte').getBoundingClientRect(); return { dedans: r.left >= c.left && r.right <= c.right && r.top >= c.top && r.bottom <= c.bottom, t: Math.round(Math.min(r.width, r.height)) }; }).catch(() => null);
        dit(pin && pin.dedans && pin.t >= 44, `${largeur} px : l’épingle de Bruno est dans la carte, 44 px`, JSON.stringify(pin));
        // §7 : l'accent est RARE — plein sur SA propre épingle, jamais sur les
        // initiales d'une autre personne (avec 50 vendeurs, 50 taches bleues).
        const coul = await pg.evaluate(() => {
          const b = document.querySelector('[data-cm-pin].profil'); if (!b) return null;
          const t = document.createElement('span'); t.style.color = 'var(--cm-accent)'; b.closest('.vrm-communaute').append(t);
          const accent = getComputedStyle(t).color; t.remove();
          const s = getComputedStyle(b); return { classes: b.className, color: s.color, bg: s.backgroundColor, accent };
        });
        dit(coul && !/\bmoi\b/.test(coul.classes) && coul.color !== coul.accent && coul.bg !== coul.accent, `${largeur} px ${sombre ? 'sombre' : 'clair'} : l’épingle d’une AUTRE personne (ses initiales) n’est ni écrite ni peinte en accent`, JSON.stringify(coul));
        if (process.env.BANC_DEBUG) { await pg.waitForTimeout(600); await pg.screenshot({ path: process.env.BANC_DEBUG + `/carte${largeur}-${sombre ? 'sombre' : 'clair'}-croise.png` }); }
        await ctx.close();
      });
    }

    console.log('\n── 390 px tactile · l’attribution : visible à l’ouverture, repliée en « i » au premier glisser');
    await essaie('attribution 390', async () => {
      reset();
      B.profils[Bu] = { pid: uuid(), pseudo: 'Bruno', ville: 'Cancale', pays: 'FR', lat: 48.7, lon: -1.85, cree_le: '2026-10-20T00:00:00Z' };
      const { ctx, pg } = await ouvrir(nav, { qui: A, largeur: 390, sombre: false });
      await pg.waitForSelector('[data-cm-fond="openfreemap"]', { timeout: 20000 }).catch(() => {});
      await pg.waitForTimeout(400);
      const etatAttr = () => pg.evaluate(() => {
        const at = document.querySelector('.vrm-cm-carte .maplibregl-ctrl-attrib'); if (!at) return null;
        const inner = at.querySelector('.maplibregl-ctrl-attrib-inner'); const r = inner && inner.getBoundingClientRect();
        const i = at.querySelector('summary.maplibregl-ctrl-attrib-button'); const ri = i && i.getBoundingClientRect();
        return { compact: at.classList.contains('maplibregl-compact'), ouverte: at.classList.contains('maplibregl-compact-show'), texte: !!(r && r.width > 40 && r.height > 8 && getComputedStyle(inner).display !== 'none'), i: !!(ri && ri.width > 0 && ri.height > 0) };
      });
      const a0 = await etatAttr();
      dit(a0 && a0.compact && a0.texte, 'téléphone : à l’ouverture, l’attribution est VISIBLE en entier (la licence veut la mention vue ; c’est le comportement de MapLibre)', JSON.stringify(a0));
      // Un glisser au doigt sur le fond (pas sur une épingle).
      const dep = await pg.evaluate(() => { const c = document.querySelector('.vrm-cm-carte-fond').getBoundingClientRect(); for (const [fx, fy] of [[0.3, 0.3], [0.7, 0.3], [0.3, 0.6], [0.7, 0.6]]) { const x = c.x + c.width * fx, y = c.y + c.height * fy; const e = document.elementFromPoint(x, y); if (e && e.tagName === 'CANVAS') return { x, y }; } return null; });
      const cdp = await ctx.newCDPSession(pg);
      if (dep) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: dep.x, y: dep.y }] });
        for (let k = 1; k <= 8; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: dep.x + 10 * k, y: dep.y + 4 * k }] }); await pg.waitForTimeout(16); }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
      await pg.waitForTimeout(500);
      const a1 = await etatAttr();
      dit(!!dep && a1 && a1.compact && !a1.ouverte && !a1.texte && a1.i, 'téléphone : après le premier glisser, elle se replie derrière le « i » (toujours là, un toucher la rouvre)', JSON.stringify({ dep: !!dep, a1 }));
      await ctx.close();
    });

    console.log('\n── 1512 px · UNE tuile lente (ni réponse ni erreur) ⇒ la carte qui dessine le reste RESTE');
    await essaie('tuile lente', async () => {
      reset();
      B.profils[Bu] = { pid: uuid(), pseudo: 'Bruno', ville: 'Cancale', pays: 'FR', lat: 48.7, lon: -1.85, cree_le: '2026-10-20T00:00:00Z' };
      OFM.styles = []; OFM.tuiles = 0; OFM.tuilesKo = 0; OFM.tenue = null; OFM.tenueRendue = false; OFM.lacher = null;
      const t0 = Date.now();
      const { ctx, pg } = await ouvrir(nav, { qui: A, tuileLente: true });
      try {
        await pg.waitForSelector('[data-cm-fond="openfreemap"], [data-cm-liste-secours]', { timeout: 9000 }).catch(() => {});
        const tot = { s: Math.round((Date.now() - t0) / 100) / 10, fond: await attr(pg, '[data-cm-carte]', 'data-cm-fond'), tenue: !!OFM.tenue, encoreTenue: !!OFM.tenue && !OFM.tenueRendue, servies: OFM.tuiles };
        dit(tot.fond === 'openfreemap' && tot.encoreTenue && tot.servies > 0, 'une tuile encore en attente : le fond est déclaré dessiné dès que les autres sont peintes (sans attendre « idle »)', JSON.stringify(tot));
        const at = await pg.evaluate(() => { const e = document.querySelector('.vrm-cm-carte .maplibregl-ctrl-attrib'); return e ? e.textContent : ''; });
        dit(/OpenFreeMap/.test(at) && /OpenStreetMap/.test(at), 'pendant ce temps, l’attribution exigée est déjà affichée', at.slice(0, 80));
        // Le délai de 12 s part quand le fond est demandé (après le chargement
        // de MapLibre) : on regarde 18 s après l'ouverture, bien au-delà.
        const reste = 18000 - (Date.now() - t0);
        if (reste > 0) await pg.waitForTimeout(reste);
        const tard = { s: Math.round((Date.now() - t0) / 100) / 10, fond: await attr(pg, '[data-cm-carte]', 'data-cm-fond'), liste: !!(await pg.$('[data-cm-liste-secours]')), pins: (await pg.$$('[data-cm-pin]')).length, encoreTenue: !!OFM.tenue && !OFM.tenueRendue };
        dit(tard.encoreTenue && !tard.liste && tard.fond === 'openfreemap' && tard.pins === 1, 'au-delà du délai de 12 s, la tuile toujours tenue : la carte RESTE (pas de repli liste), l’épingle aussi', JSON.stringify(tard));
        if (process.env.BANC_DEBUG) await pg.screenshot({ path: process.env.BANC_DEBUG + '/tuile-lente1512.png' });
      } finally { if (OFM.lacher) OFM.lacher(); await ctx.close(); }
    });

    console.log('\n── 1512 px · une tuile sur trois en erreur serveur ⇒ la carte RESTE');
    await essaie('tuiles en erreur', async () => {
      reset();
      B.profils[Bu] = { pid: uuid(), pseudo: 'Bruno', ville: 'Cancale', pays: 'FR', lat: 48.7, lon: -1.85, cree_le: '2026-10-20T00:00:00Z' };
      OFM.styles = []; OFM.tuiles = 0; OFM.tuilesKo = 0;
      const { ctx, pg } = await ouvrir(nav, { qui: A, tuilesKo: true });
      await pg.waitForSelector('[data-cm-fond="openfreemap"], [data-cm-liste-secours]', { timeout: 30000 }).catch(() => {});
      dit(await attr(pg, '[data-cm-carte]', 'data-cm-fond') === 'openfreemap' && OFM.tuilesKo > 0 && OFM.tuiles > 0, 'des tuiles isolées en erreur (500) : la carte se dessine quand même', JSON.stringify({ fond: await attr(pg, '[data-cm-carte]', 'data-cm-fond'), ok: OFM.tuiles, ko: OFM.tuilesKo }));
      dit((await pg.$$('[data-cm-pin]')).length === 1 && !(await pg.$('[data-cm-liste-secours]')), 'les épingles restent, pas de repli liste pour une tuile ratée');
      if (process.env.BANC_DEBUG) await pg.screenshot({ path: process.env.BANC_DEBUG + '/tuiles-ko1512.png' });
      await ctx.close();
    });
    console.log('\n── 1512 px · la carte injoignable ⇒ la même communauté en liste');
    await essaie('sans moteur', async () => {
      reset();
      B.profils[Bu] = { pid: uuid(), pseudo: 'Bruno', ville: 'Cancale', pays: 'FR', lat: 48.7, lon: -1.85, cree_le: '2026-10-20T00:00:00Z' };
      const { ctx, pg } = await ouvrir(nav, { qui: A, sansMoteur: true });
      await pg.waitForSelector('[data-cm-liste-secours]', { timeout: 20000 }).catch(() => {});
      dit(!!(await pg.$('[data-cm-liste-secours]')) && /Cancale/.test(await pg.$eval('[data-cm-liste-secours]', (e) => e.innerText)), 'MapLibre injoignable : la communauté est listée, rien n’est caché');
      await ctx.close();
    });
    await essaie('sans fond', async () => {
      reset();
      B.profils[Bu] = { pid: uuid(), pseudo: 'Bruno', ville: 'Cancale', pays: 'FR', lat: 48.7, lon: -1.85, cree_le: '2026-10-20T00:00:00Z' };
      const { ctx, pg } = await ouvrir(nav, { qui: A, sansFond: true });
      await pg.waitForSelector('[data-cm-liste-secours]', { timeout: 40000 }).catch(() => {});
      dit(!!(await pg.$('[data-cm-liste-secours]')) && /Cancale/.test(await pg.$eval('[data-cm-liste-secours]', (e) => e.innerText)), 'OpenFreeMap injoignable : la communauté est listée (jamais une carte grise)');
      await ctx.close();
    });
    await essaie('source injoignable', async () => {
      reset();
      B.profils[Bu] = { pid: uuid(), pseudo: 'Bruno', ville: 'Cancale', pays: 'FR', lat: 48.7, lon: -1.85, cree_le: '2026-10-20T00:00:00Z' };
      const { ctx, pg } = await ouvrir(nav, { qui: A, sourceKo: true });
      await pg.waitForSelector('[data-cm-liste-secours]', { timeout: 30000 }).catch(() => {});
      dit(!!(await pg.$('[data-cm-liste-secours]')) && /Cancale/.test(await pg.$eval('[data-cm-liste-secours]', (e) => e.innerText)), 'la source des tuiles (TileJSON) répond 503 : la communauté est listée');
      await ctx.close();
    });
    dit(OFM.interdit.length === 0, 'sur tout le banc : aucune requête vers un autre fond de carte (CARTO, tile.openstreetmap.org, VersaTiles…)', OFM.interdit.slice(0, 2).join(' '));
    dit(hotesCarte().every((h) => h === 'tiles.openfreemap.org'), 'sur tout le banc : un seul domaine extérieur pour la carte (tiles.openfreemap.org)', [...OFM.hotes].join(' '));
    await partie019(nav);
    await partie020(nav);
  } finally {
    await nav.close(); srv.close();
  }
  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  ko += bilanCsp();
  process.exit(ko ? 1 : 0);
})();

// ── 020 : les groupes à code ─────────────────────────────────────────────────
async function partie020(nav) {
  const C3 = '33333333-3333-4333-8333-333333333333', E5 = '55555555-5555-4555-8555-555555555555';
  for (const [largeur, sombre] of [[1512, false], [390, true]]) {
    console.log(`\n── 020 · ${largeur} px${sombre ? ' tactile, sombre' : ''} · les groupes à code`);
    await essaie(`groupes ${largeur}`, async () => {
      posePersonnes();
      B.profils[C3] = { pid: uuid(), pseudo: 'Chloé', ville: 'Rennes', pays: 'FR', lat: 48.1, lon: -1.7, cree_le: '2026-10-18T00:00:00Z' };
      B.profils[E5] = { pid: uuid(), pseudo: 'Émile', ville: 'Lyon', pays: 'FR', lat: 45.75, lon: 4.85, cree_le: '2026-10-17T00:00:00Z' };
      B.ventes[C3] = { semaine: 4 }; B.ventes[E5] = { semaine: 11 };
      const G = { id: uuid(), nom: 'Coaching Julien', code: 'ABCD2345', cree_par: B.profils[Bu].pid, membres: [{ pid: B.profils[Bu].pid }, { pid: B.profils[C3].pid }] };
      B.groupes.push(G);
      const { ctx, pg } = await ouvrir(nav, { qui: A, largeur, sombre });
      dit(!!(await pg.$('[data-cm-groupes]')), 'la carte propose « Groupe d’accompagnement »');
      dit(await attr(pg, '[data-communaute-etat]', 'data-cm-total') === '4', 'sans groupe : les 4 membres de la carte', await attr(pg, '[data-communaute-etat]', 'data-cm-total'));
      await pg.click('[data-cm-groupe-entrer]');
      await pg.fill('[data-cm-groupe-champ]', 'ZZZZ');
      await pg.click('[data-cm-groupe-valider]');
      await pg.waitForSelector('.vrm-cm-groupes .vrm-cm-msg', { timeout: 5000 });
      dit(!G.membres.some((m) => m.pid === B.profils[A].pid), 'un code mal formé n’entre nulle part');
      let dialogue = '';
      pg.once('dialog', (d) => { dialogue = d.message(); d.dismiss(); });
      await pg.fill('[data-cm-groupe-champ]', ' abcd-2345 ');
      await pg.click('[data-cm-groupe-valider]');
      await pg.waitForTimeout(400);
      dit(/NOMBRE de ventes/.test(dialogue) && !G.membres.some((m) => m.pid === B.profils[A].pid), 'le consentement est demandé AVANT ; « Annuler » n’entre pas', dialogue.slice(0, 80));
      pg.once('dialog', (d) => d.accept());
      await pg.click('[data-cm-groupe-valider]');
      await pg.waitForSelector(`[data-cm-groupe-actif="${G.id}"]`, { timeout: 8000 });
      dit(G.membres.some((m) => m.pid === B.profils[A].pid), 'le code tapé en minuscules avec tiret fait entrer Alice');
      await pg.waitForFunction(() => document.querySelector('[data-communaute-etat]').getAttribute('data-cm-total') === '3', null, { timeout: 8000 }).catch(() => {});
      dit(await attr(pg, '[data-communaute-etat]', 'data-cm-total') === '3', 'le groupe choisi : la carte ne montre que ses 3 membres (pas Émile)', await attr(pg, '[data-communaute-etat]', 'data-cm-total'));
      { const t = await texte(pg); dit(/3\s*membres dans « Coaching Julien »/.test(t) && /ABCD-2345/.test(t), 'les chiffres et le code lisible suivent le groupe', (t.match(/.{0,40}membres dans.{0,30}/) || [''])[0] + ' / ' + (t.match(/code.{0,15}/) || [''])[0]); }
      dit(!(await pg.$('[data-cm-groupe-nouveau-code]')), 'Alice n’a pas créé le groupe : pas de « Nouveau code »');
      await vers(pg, 'classement'); await classementLu(pg);
      const l = await pg.$$eval('[data-cm-ligne]', (e) => e.map((x) => x.getAttribute('data-cm-ligne-ventes')));
      dit(l.join(',') === '7,4,3' && !!(await pg.$('[data-cm-classement-de-groupe]')) && !(await pg.$('[data-cm-classement-entrer]')), 'le classement du groupe : ses 3 membres (7, 4, 3), même Alice qui n’est pas au classement public', l.join(','));
      const dernier = B.argsClassement[B.argsClassement.length - 1];
      dit(dernier && dernier.p_groupe === G.id && Object.keys(dernier).sort().join() === 'p_groupe,p_periode', 'le navigateur envoie la période et le groupe — jamais un chiffre', JSON.stringify(dernier));
      await pg.click('[data-cm-groupe-choix="tous"]'); await classementLu(pg);
      dit(!!(await pg.$('[data-cm-classement-entrer]')) && (await pg.$$('[data-cm-ligne]')).length === 1, '« Tous les membres » : le classement public (opt-in), comme avant');
      await vers(pg, 'carte');
      await pg.click(`[data-cm-groupe-choix="${G.id}"]`);
      pg.once('dialog', (d) => d.accept());
      await pg.click('[data-cm-groupe-quitter]');
      await pg.waitForFunction(() => !document.querySelector('[data-cm-groupe-actif]'), null, { timeout: 8000 }).catch(() => {});
      dit(G.membres.find((m) => m.pid === B.profils[A].pid).quitte === true && !(await pg.$('[data-cm-groupe-choix]')), 'quitter : le groupe disparaît, retour à tous les membres');
      await pg.click('[data-cm-groupe-creer]');
      await pg.fill('[data-cm-groupe-champ]', 'Mes élèves');
      await pg.click('[data-cm-groupe-valider]');
      await pg.waitForSelector('[data-cm-groupe-nouveau-code]', { timeout: 8000 });
      const cree = B.groupes.find((g) => g.nom === 'Mes élèves');
      dit(cree && await attr(pg, '[data-cm-groupe-code]', 'data-cm-groupe-code') === cree.code, 'créer un groupe : son code est affiché, avec « Nouveau code » pour le créateur');
      pg.once('dialog', (d) => d.accept());
      const avant = cree.code;
      await pg.click('[data-cm-groupe-nouveau-code]');
      await pg.waitForFunction((c) => document.querySelector('[data-cm-groupe-code]') && document.querySelector('[data-cm-groupe-code]').getAttribute('data-cm-groupe-code') !== c, avant, { timeout: 8000 }).catch(() => {});
      dit(cree.code !== avant && await attr(pg, '[data-cm-groupe-code]', 'data-cm-groupe-code') === cree.code, 'le créateur change le code, l’écran montre le nouveau');
      dit(sansSecret(await texte(pg)).length === 0, 'aucun identifiant de compte ni email à l’écran');
      const largeurPage = await pg.evaluate(() => document.documentElement.scrollWidth);
      dit(largeurPage <= largeur, 'aucun débordement horizontal', String(largeurPage));
      if (largeur < 600) {
        const petits = await pg.$$eval('.vrm-cm-groupes button', (bs) => bs.filter((b) => b.offsetParent && b.getBoundingClientRect().height < 43).map((b) => b.textContent.trim()));
        dit(petits.length === 0, 'au doigt : chaque bouton des groupes fait au moins 44 px', petits.join(' | '));
      }
      await ctx.close();
    });
  }
  console.log('\n── 020 · 390 px · la ville se propose pendant la frappe, le pseudo est unique');
  await essaie('ville et pseudo', async () => {
    reset();
    B.profils[Bu] = { pid: uuid(), pseudo: 'Bruno', ville: 'Cancale', pays: 'FR', lat: 48.7, lon: -1.85, cree_le: '2026-10-20T00:00:00Z' };
    const { ctx, pg } = await ouvrir(nav, { qui: A, largeur: 390 });
    await pg.click('[data-cm-apparaitre]');
    await pg.fill('[data-cm-pseudo]', 'BRUNO');
    await pg.fill('[data-cm-ville-q]', 'canc');
    await pg.waitForSelector('[data-cm-ville-choix="Cancale"]', { timeout: 8000 }).catch(() => {});
    dit(!!(await pg.$('[data-cm-ville-choix="Cancale"]')), 'taper « canc » propose Cancale, sans appuyer sur « Chercher »');
    await pg.click('[data-cm-ville-choix="Cancale"]');
    dit(await pg.$eval('[data-cm-ville-q]', (e) => e.value) === 'Cancale', 'toucher la ville la met dans le champ');
    await pg.click('[data-cm-valider]');
    await pg.waitForSelector('[data-cm-rejoindre] .vrm-cm-msg', { timeout: 8000 }).catch(() => {});
    const t = await pg.$eval('[data-cm-rejoindre]', (e) => e.innerText).catch(() => '');
    dit(/déjà pris/.test(t) && !B.profils[A], 'un pseudo déjà pris (« BRUNO ») est refusé et dit', t.slice(-90).replace(/\n/g, ' '));
    await pg.fill('[data-cm-pseudo]', 'Alice');
    await pg.click('[data-cm-valider]');
    await pg.waitForSelector('[data-cm-moi="visible"]', { timeout: 8000 }).catch(() => {});
    dit(B.profils[A] && B.profils[A].pseudo === 'Alice' && B.profils[A].ville === 'Cancale', 'avec un autre pseudo, Alice apparaît à Cancale');
    await ctx.close();
  });
  console.log('\n── 1512 px · « Se connecter avec Discord »');
  await essaie('discord oauth', async () => {
    const avant = { id: process.env.DISCORD_CLIENT_ID, s: process.env.DISCORD_CLIENT_SECRET };
    process.env.DISCORD_CLIENT_ID = '1562176038098702467'; process.env.DISCORD_CLIENT_SECRET = 'secret-de-banc-0123456789abcdef';
    try {
      posePersonnes();
      let o = await ouvrir(nav, { qui: A });
      dit(!!(await o.pg.$('[data-cm-discord-oauth]')), 'Discord réglé sur le serveur : le bouton « Se connecter avec Discord » est là');
      let partie = '';
      await o.pg.route('https://discord.com/**', (r) => { partie = r.request().url(); return r.fulfill({ status: 200, contentType: 'text/html', body: '<p>discord</p>' }); });
      await o.pg.click('[data-cm-discord-oauth]');
      await o.pg.waitForTimeout(1200);
      dit(/^https:\/\/discord\.com\/oauth2\/authorize\?/.test(partie) && /scope=identify/.test(partie), 'le clic part chez Discord (portée « identify » seule)', partie.slice(0, 120));
      await o.ctx.close();
      const { signerPreuve } = await import(path.join(__dirname, '../../api/_lib/discord.js'));
      const frag = '#discord=alice.discord&preuve=' + encodeURIComponent(signerPreuve(A, 'alice.discord'));
      o = await ouvrir(nav, { qui: A, fragment: frag });
      await o.pg.waitForFunction(() => document.querySelector('[data-cm-mon-discord="oui"]'), null, { timeout: 8000 }).catch(() => {});
      dit(B.profils[A].discord === 'alice.discord' && !/discord=/.test(await o.pg.evaluate(() => location.hash)), 'au retour de Discord : le pseudo est rangé, et le fragment effacé de l’adresse');
      await o.ctx.close();
      posePersonnes();
      o = await ouvrir(nav, { qui: A, fragment: '#discord=pirate.vrm&preuve=' + encodeURIComponent(signerPreuve(Bu, 'pirate.vrm')) });
      await o.pg.waitForTimeout(1500);
      dit(!B.profils[A].discord, 'une preuve faite pour un AUTRE compte VRM est refusée (rien n’est rangé)', String(B.profils[A].discord));
      await o.ctx.close();
      delete process.env.DISCORD_CLIENT_SECRET;
      posePersonnes();
      o = await ouvrir(nav, { qui: A });
      dit(!(await o.pg.$('[data-cm-discord-oauth]')) && !!(await o.pg.$('[data-cm-discord-ajouter]')), 'Discord pas réglé : pas de bouton, la saisie à la main reste');
      await o.ctx.close();
    } finally { process.env.DISCORD_CLIENT_ID = avant.id || ''; if (avant.s) process.env.DISCORD_CLIENT_SECRET = avant.s; else delete process.env.DISCORD_CLIENT_SECRET; }
  });
  console.log('\n── 020 · sans la 020 sur la base');
  await essaie('sans 020', async () => {
    posePersonnes(); B.installe20 = false;
    const { ctx, pg } = await ouvrir(nav, { qui: A });
    dit(await etatDe(pg) === 'lu' && !(await pg.$('[data-cm-groupes]')), 'base sans la 020 : la carte marche, aucun bloc de groupes (rien de cassé)');
    await ctx.close();
  });
}
