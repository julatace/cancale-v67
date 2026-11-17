require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « GROUPES : CRÉER EN TROIS ÉTAPES, LE COUCOU » (17 nov., migration 046)
//  RENDU à 390 px tactile (clair, sombre) et 1512 px (clair, sombre).
//  BANC_PORT=7991 CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/bancs/groupes-coucou.cjs
//  (CAPTURES=dossier : les captures ; BANC_MUTATION=… : le faux base réaffaiblit une règle ⇒ ROUGE)
//
//  Le VRAI api/compte.js (`?mode=communaute`, actions `accomp-…` et
//  `accomp-coucou-…`) est EXÉCUTÉ ; le faux PostgREST applique les RÈGLES de la
//  025 et de la 046 (prouvées sur un vrai Postgres par audit-accompagnement-sql
//  et audit-coucou-sql). Trois personnes INVENTÉES : Alice crée, Bruno rejoint,
//  Carla n'est dans rien. Ce que le banc juge :
//   · sans la 046 : créer marche (3 étapes), la photo, le Discord et le coucou
//     disent « bientôt disponible », rien n'est promis ;
//   · créer en TROIS étapes (au plus) : 1. nom + phrase + photo ; 2. qui entre
//     (sur invitation, il valide) et ce qu'on partage (RIEN par défaut, dit, aucun
//     réglage) ; 3. inviter : QR code, copier le lien, « Partager » s'il existe,
//     le lien Discord (refusé s'il n'est pas Discord) ;
//   · rejoindre par le lien : « Rien » coché par défaut (la règle de la 025) ;
//   · la page du groupe : demandes (Accepter / Refuser), membres, « Ouvrir sur
//     Discord » ;
//   · le COUCOU : un toucher, AUCUN champ de texte, la requête ne porte que le
//     groupe et la personne ; Bruno le voit avec UN geste : le salon du groupe,
//     puis « Pas de Discord lié » (lien retiré), puis le PROFIL d'Alice quand
//     elle a relié son Discord (signé) ; la notification part chez Bruno ;
//     Bruno ne peut pas le rendre dans les 24 h ; il coupe Alice : le coucou
//     disparaît et Alice ne passe plus ; Carla (hors du groupe) ne passe pas ;
//   · AIR : carte ≥ 20 px de marge (24 sur ordinateur), rangées ≥ 64 px, un
//     seul bouton plein par feuille, cibles ≥ 44, aucun débordement à 390 px ;
//     aucun compte ni email d'un autre dans les réponses.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs');
const RACINE = path.join(__dirname, '..', '..');
let chromium;
try { ({ chromium } = require(path.join(RACINE, 'node_modules', 'playwright'))); } catch (_) { ({ chromium } = require('playwright')); }
const DIST = path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || 7991);
const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const MUTATION = process.env.BANC_MUTATION || '';
const CAPTURES = process.env.CAPTURES || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
process.env.SUPABASE_SERVICE_KEY = 'eyJ.cle-de-service-du-banc';
process.env.DISCORD_CLIENT_SECRET = 'secret-discord-du-banc';

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d !== undefined && !c ? ' — ' + String(d).slice(0, 240) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).split('\n')[0].slice(0, 200)); } };

// ── Les personnes (inventées) ────────────────────────────────────────────────
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', Bu = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', Ca = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (id, email) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: id, email, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.c2ln`;
const USERS = { [A]: { id: A, email: 'alice.secret@exemple.test', login: 'alice_vinted_secret' }, [Bu]: { id: Bu, email: 'bruno.secret@exemple.test', login: 'bruno_vinted_secret' }, [Ca]: { id: Ca, email: 'carla.secret@exemple.test', login: 'carla_vinted_secret' } };
const JETONS = {}; for (const u of Object.values(USERS)) JETONS[jwt(u.id, u.email)] = u;
const jetonDe = (id) => Object.keys(JETONS).find((k) => JETONS[k].id === id);
const session = (id) => ({ access_token: jetonDe(id), refresh_token: 'r-' + id, expires_at: Date.now() + 3600e3, user: { id, email: USERS[id].email } });
const DID_A = '123456789012345678';
// Une petite image (PNG 8×8, inventée) pour la photo du groupe.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGNgYPhPBDKMmiIVAAD/fz8BBbfWtQAAAABJRU5ErkJggg==', 'base64');

// ── La base : les RÈGLES de la 025 et de la 046, en JS ───────────────────────
let B;
const reset = (o = {}) => { B = { installe: true, coucou: true, groupes: [], membres: [], partages: {}, habillage: {}, coucous: [], sourdines: [], ouverts: {}, discordComptes: {}, n: 1, reponses: [], envois: [], lectures: [], ...o }; };
const uuid = () => `00000000-0000-4000-8000-${String(B.n++).padStart(12, '0')}`;
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const codeNeuf = () => { let c = ''; for (let i = 0; i < 8; i++) c += ALPHA[(B.n * 7 + i * 13 + B.groupes.length * 3) % 32]; B.n++; return c; };
const niveau = (p) => (p === 'detail' ? 2 : p === 'chiffres' ? 1 : 0);
const gDe = (id) => B.groupes.find((g) => g.id === id);
const vue = (m) => ({ id: m.id, nom: m.nom, statut: m.statut, partage: m.partage, demande_le: m.demande_le, decide_le: m.decide_le, partage_le: m.partage_le, ...(m.statut === 'accepte' && niveau(m.partage) >= 1 ? { chiffres: null, chiffres_le: null } : {}) });
const H24 = 24 * 3600e3;
const role = (g, o) => { const x = gDe(g); if (!x || x.ferme) return null; if (x.cree_par === o) return 'createur'; return B.membres.some((m) => m.groupe === g && m.owner === o && m.statut === 'accepte') ? 'membre' : null; };
const ouvert = (mid) => B.ouverts[mid] === true;
const recent = (x, y) => B.coucous.some((c) => (MUTATION === 'paire-un-sens' ? (c.de === x && c.a === y) : ((c.de === x && c.a === y) || (c.de === y && c.a === x))) && Date.now() - c.t < H24);
const nomDans = (g, o) => { const x = gDe(g); if (x && x.cree_par === o) return x.createur; const m = B.membres.find((y) => y.groupe === g && y.owner === o); return m ? m.nom : ''; };
const muet = (qui, de) => B.sourdines.some((s) => s.owner === qui && s.muet === de && s.actif);
function rpc(fn, a, uid, service) {
  if (fn === 'vrm_communaute_carte') return { acces: true, moi: null, profils: [], groupes: [] };
  if (fn === 'vrm_communaute_conversations') return [];
  const now = new Date().toISOString();
  if (/^vrm_(coucou_|accomp_habiller)/.test(fn)) {
    if (!B.coucou) return undefined;
    if (fn === 'vrm_coucou_a_sonner') { if (!service) return 'refus'; const c = B.coucous.find((x) => x.id === a.p_coucou && x.de === a.p_de); return c ? { a: c.a, de_nom: nomDans(c.groupe, c.de), groupe_nom: gDe(c.groupe).nom } : null; }
    if (fn === 'vrm_coucou_auteurs') { if (!service) return 'refus'; return B.coucous.filter((c) => c.a === a.p_a).map((c) => ({ id: c.id, de: c.de })); }
    if (service) return 'refus';
    if (fn === 'vrm_coucou_lire') {
      const mes = [...B.groupes.filter((g) => g.cree_par === uid && !g.ferme).map((g) => ({ g, r: 'createur' })),
        ...B.membres.filter((m) => m.owner === uid && m.statut === 'accepte' && !gDe(m.groupe).ferme).map((m) => ({ g: gDe(m.groupe), r: 'membre', adh: m.id }))];
      return { acces: true, envoyes24h: B.coucous.filter((c) => c.de === uid && Date.now() - c.t < H24).length, plafond: 20,
        groupes: mes.map(({ g, r, adh }) => ({ groupe: g.id, discord: (B.habillage[g.id] || {}).discord || null, photo: (B.habillage[g.id] || {}).photo || null, ouvert: r === 'membre' ? ouvert(adh) : null,
          cibles: r === 'createur' ? B.membres.filter((m) => m.groupe === g.id && m.statut === 'accepte').map((m) => ({ cible: m.id, role: 'membre', nom: m.nom, deja: recent(uid, m.owner) }))
            : [{ cible: null, role: 'createur', nom: g.createur, deja: recent(uid, g.cree_par) }, ...(ouvert(adh) ? B.membres.filter((m) => m.groupe === g.id && m.statut === 'accepte' && m.owner !== uid && ouvert(m.id)).map((m) => ({ cible: m.id, role: 'membre', nom: m.nom, deja: recent(uid, m.owner) })) : [])] })),
        recus: B.coucous.filter((c) => c.a === uid && role(c.groupe, uid) && !(MUTATION !== 'sourdine-visible' && muet(uid, c.de))).sort((x, y) => y.t - x.t).map((c) => ({ id: c.id, groupe: c.groupe, groupe_nom: gDe(c.groupe).nom, de_nom: nomDans(c.groupe, c.de), le: new Date(c.t).toISOString(), discord_groupe: (B.habillage[c.groupe] || {}).discord || null })),
        sourdines: B.sourdines.filter((s) => s.owner === uid && s.actif).map((s) => { const c = B.coucous.find((x) => x.de === s.muet && x.a === uid); return { coucou: c.id, nom: nomDans(c.groupe, c.de) }; }) };
    }
    if (fn === 'vrm_coucou_envoyer') {
      B.envois.push({ uid, a });
      const r = role(a.p_groupe, uid); if (!r && MUTATION !== 'hors-groupe') return { ok: false, raison: 'groupe' };
      let cible;
      if (a.p_membre == null) { if (r === 'createur') return { ok: false, raison: 'soi' }; cible = gDe(a.p_groupe).cree_par; }
      else {
        const m = B.membres.find((x) => x.id === a.p_membre && x.groupe === a.p_groupe && x.statut === 'accepte'); if (!m) return { ok: false, raison: 'cible' };
        if (m.owner === uid) return { ok: false, raison: 'soi' };
        if (r === 'membre') { const moiM = B.membres.find((x) => x.groupe === a.p_groupe && x.owner === uid); if (!(ouvert(moiM.id) && ouvert(m.id))) return { ok: false, raison: 'cible' }; }
        cible = m.owner;
      }
      if (MUTATION !== 'sans-sourdine' && muet(cible, uid)) return { ok: false, raison: 'indisponible' };
      if (recent(uid, cible)) return { ok: false, raison: 'deja' };
      if (B.coucous.filter((c) => c.de === uid && Date.now() - c.t < H24).length >= 20) return { ok: false, raison: 'plafond' };
      const c = { id: uuid(), de: uid, a: cible, groupe: a.p_groupe, t: Date.now() }; B.coucous.push(c);
      return { ok: true, id: c.id };
    }
    if (fn === 'vrm_coucou_sourdine') { const c = B.coucous.find((x) => x.id === a.p_coucou && x.a === uid); if (!c) return { ok: false, raison: 'coucou' };
      let s = B.sourdines.find((x) => x.owner === uid && x.muet === c.de); if (!s) { s = { owner: uid, muet: c.de }; B.sourdines.push(s); } s.actif = a.p_oui === true; return { ok: true, sourdine: s.actif }; }
    if (fn === 'vrm_coucou_ouvrir') { const m = B.membres.find((x) => x.id === a.p_adhesion && x.owner === uid); if (!m) return { ok: false, raison: 'adhesion' }; B.ouverts[m.id] = a.p_oui === true; return { ok: true, ouvert: a.p_oui === true }; }
    if (fn === 'vrm_accomp_habiller') { const g = gDe(a.p_groupe); if (!g || g.cree_par !== uid) return { ok: false, raison: 'pas-createur' }; B.habillage[g.id] = { discord: a.p_discord || null, photo: a.p_photo || null }; return { ok: true }; }
    return undefined;
  }
  if (!fn.startsWith('vrm_accomp_') || !B.installe || service) return undefined;
  if (fn === 'vrm_accomp_lire') return { acces: true,
    crees: B.groupes.filter((g) => g.cree_par === uid && !g.ferme).map((g) => ({ id: g.id, nom: g.nom, description: g.description, code: g.code, createur: g.createur, cree_le: g.cree_le, membres: B.membres.filter((m) => m.groupe === g.id && ['attente', 'accepte'].includes(m.statut)).map(vue) })),
    rejoints: B.membres.filter((m) => m.owner === uid && m.statut !== 'parti').map((m) => { const g = gDe(m.groupe); return { id: m.id, groupe: g.id, nom: g.nom, description: g.description, createur: g.createur, moi: m.nom, statut: m.statut, partage: m.partage, demande_le: m.demande_le, decide_le: m.decide_le, ferme: !!g.ferme, membres: B.membres.filter((x) => x.groupe === g.id && x.statut === 'accepte').length }; }),
    niveau: 0, publie: null };
  if (fn === 'vrm_accomp_creer') { const g = { id: uuid(), nom: a.p_nom, description: a.p_description, code: codeNeuf(), cree_par: uid, createur: a.p_createur, cree_le: now }; B.groupes.push(g); return { ok: true, id: g.id, code: g.code, nom: g.nom }; }
  if (fn === 'vrm_accomp_apercu') { const g = B.groupes.find((x) => x.code === a.p_code && !x.ferme); if (!g) return { ok: false, raison: 'code' }; const m = B.membres.find((x) => x.groupe === g.id && x.owner === uid); return { ok: true, nom: g.nom, description: g.description, createur: g.createur, membres: B.membres.filter((x) => x.groupe === g.id && x.statut === 'accepte').length, createur_moi: g.cree_par === uid, statut: m ? m.statut : null }; }
  if (fn === 'vrm_accomp_demander') { const g = B.groupes.find((x) => x.code === a.p_code && !x.ferme); if (!g) return { ok: false, raison: 'code' }; const m = { id: uuid(), groupe: g.id, owner: uid, nom: a.p_nom, statut: 'attente', partage: a.p_partage, demande_le: now }; B.membres.push(m); return { ok: true, id: m.id, nom: g.nom, statut: 'attente' }; }
  if (fn === 'vrm_accomp_decider') { const m = B.membres.find((x) => x.id === a.p_membre); if (!m || gDe(m.groupe).cree_par !== uid) return { ok: false, raison: 'pas-createur' }; m.statut = a.p_oui === true ? 'accepte' : 'refuse'; m.decide_le = now; return { ok: true, statut: m.statut }; }
  if (fn === 'vrm_accomp_ce_que_voit') { const m = B.membres.find((x) => x.id === a.p_adhesion && x.owner === uid); return m ? { acces: true, vue: vue(m) } : { acces: true, erreur: 'adhesion' }; }
  if (fn === 'vrm_accomp_partage') { const m = B.membres.find((x) => x.id === a.p_adhesion && x.owner === uid); if (!m) return { ok: false, raison: 'adhesion' }; m.partage = a.p_partage; return { ok: true, partage: m.partage, niveau: niveau(m.partage) }; }
  return { ok: true };
}

function fauxSupabase(urlBrut, methode, entetes, corps) {
  const u = decodeURIComponent(String(urlBrut));
  const h = {}; for (const [k, v] of Object.entries(entetes || {})) h[k.toLowerCase()] = v;
  const tok = String(h.authorization || '').replace(/^Bearer\s+/i, '');
  const service = tok === process.env.SUPABASE_SERVICE_KEY;
  const qui = JETONS[tok]; const uid = qui ? qui.id : null;
  const json = (b, status = 200, hh = {}) => ({ status, body: b === undefined ? '' : JSON.stringify(b), headers: { 'content-type': 'application/json', ...hh } });
  const [chemin] = u.split('?');
  if (/\/auth\/v1\/admin\//.test(chemin)) return json({ id: 'x', user_metadata: {} });
  if (/\/auth\/v1\/user/.test(chemin)) return qui ? json({ id: qui.id, email: qui.email, email_confirmed_at: '2026-10-01T00:00:00Z', identities: [] }) : json({ msg: 'invalid' }, 401);
  if (/\/auth\/v1\//.test(chemin)) return json(qui ? { access_token: tok, refresh_token: 'r', expires_in: 3600, user: { id: qui.id, email: qui.email } } : {});
  const rest = /\/rest\/v1\/(.+)$/.exec(chemin);
  if (!rest) return json({}, 404);
  const cible = rest[1];
  if (cible.startsWith('rpc/')) {
    const fn = cible.slice(4);
    if (fn === 'vrm_acces' || fn === 'vrm_acces_pour') return json(fn === 'vrm_acces' ? { obligatoire: false, proprietaire: false, acces: true } : true);
    if (!uid && !service) return json({ message: 'permission denied' }, 401);
    const r = rpc(fn, (corps && corps.json) || {}, uid, service);
    if (r === undefined) return json({ code: 'PGRST202', message: `Could not find the function public.${fn}` }, 404);
    if (r === 'refus') return json({ message: 'permission denied' }, 403);
    return json(r);
  }
  if (service) B.lectures.push(u);
  if (service && cible.startsWith('app_data') && /id=eq\.vrm_discord/.test(u)) {
    const m = /owner=in\.\(([^)]*)\)/.exec(u); const ow = m ? m[1].split(',') : [];
    return json(ow.filter((o) => B.discordComptes[o]).map((o) => ({ owner: o, ...B.discordComptes[o] })));
  }
  if (cible.startsWith('vinted_accounts') && /owner\.neq\./.test(u)) return json([]);
  if (cible.startsWith('vinted_accounts')) return json(uid ? [{ vinted_user_id: '1' + uid.slice(0, 3), login: USERS[uid].login, owner: uid }] : []);
  return json([], 200, { 'content-range': '0-0/0' });
}
const fetchReel = global.fetch;
global.fetch = async (url, opts = {}) => {
  const s = String(url);
  if (/supabase\.co\//.test(s)) {
    const r = fauxSupabase(s, opts.method || 'GET', opts.headers || {}, { json: (() => { try { return JSON.parse(opts.body || '{}'); } catch (_) { return {}; } })() });
    return new Response(r.body === '' ? null : r.body, { status: r.status, headers: r.headers });
  }
  if (/api\.stripe\.com|discord|push|fcm|mozilla/.test(s)) return new Response('{}', { status: 404 });
  return fetchReel(url, opts);
};

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

let compte = null;
async function ouvrir(nav, { qui, largeur = 1512, sombre = false, chemin = '/?tab=communaute', partage = false }) {
  const mobile = largeur < 600;
  const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${PORT}` }).catch(() => {});
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  pg.on('dialog', (d) => d.accept());
  await pg.addInitScript(({ s, sombre, partage }) => {
    try { localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_bascule_mineral_v1', '1'); localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {}
    // La feuille de partage d'iOS : un faux qui note ce qu'on lui donne (le banc ne quitte pas la page).
    if (partage) { window.__partages = []; navigator.share = (d) => { window.__partages.push(d); return Promise.resolve(); }; }
    else { try { delete Navigator.prototype.share; } catch (_) {} try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); } catch (_) {} }
  }, { s: session(qui), sombre, partage });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, async (r) => {
    const rq = r.request(), u = rq.url();
    if (/supabase\.co\//.test(u)) {
      const x = fauxSupabase(u, rq.method(), rq.headers(), { json: (() => { try { return JSON.parse(rq.postData() || '{}'); } catch (_) { return {}; } })() });
      return r.fulfill({ status: x.status, headers: x.headers, body: x.body });
    }
    return r.abort();
  });
  await pg.route('**/api/**', async (r) => {
    const rq = r.request(), u = new URL(rq.url());
    const mode = u.searchParams.get('mode');
    if (u.pathname === '/api/compte' && (mode === 'communaute' || mode === 'abonnement' || mode === 'confidentialite')) {
      let corps = null; try { corps = rq.postData() ? JSON.parse(rq.postData()) : null; } catch (_) {}
      const res = { code: 200, corps: null, setHeader() {}, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, end() { return this; } };
      const lecteur = corps ? (async function* () { yield Buffer.from(JSON.stringify(corps)); })() : null;
      const req = { method: rq.method(), query: Object.fromEntries(u.searchParams), headers: rq.headers(), body: corps || undefined, [Symbol.asyncIterator]() { return lecteur ? lecteur[Symbol.asyncIterator]() : (async function* () {})(); } };
      await compte(req, res);
      const body = JSON.stringify(res.corps);
      if (mode === 'communaute') B.reponses.push({ qui, action: corps && corps.action, corps, body });
      return r.fulfill({ status: res.code, contentType: 'application/json', body });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}${chemin}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { const e = document.querySelector('[data-communaute-etat]'); return e && e.getAttribute('data-communaute-etat') !== 'charge'; }, null, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(400);
  return { ctx, pg, erreurs };
}
const aller = async (pg) => {
  if (!(await pg.$('[data-cm-vue-active="groupes"]'))) await pg.click('[data-cm-vue="groupes"]');
  await pg.waitForSelector('[data-cm-accomp]:not([data-cm-accomp="charge"])', { timeout: 10000 });
  await pg.waitForFunction(() => { const e = document.querySelector('[data-cm-coucou-etat]'); return !e || e.getAttribute('data-cm-coucou-etat') !== 'charge'; }, null, { timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(250);
};
const recharger = async (pg) => { await pg.goto(`http://localhost:${PORT}/?tab=communaute`, { waitUntil: 'domcontentloaded' }); await pg.waitForFunction(() => { const e = document.querySelector('[data-communaute-etat]'); return e && e.getAttribute('data-communaute-etat') !== 'charge'; }, null, { timeout: 25000 }).catch(() => {}); await aller(pg); };
const attr = (pg, sel, a) => pg.evaluate(([s, x]) => { const e = document.querySelector(s); return e ? e.getAttribute(x) : null; }, [sel, a]);
const texte = (pg) => pg.evaluate(() => document.body.innerText);
const capture = async (pg, nom) => { if (CAPTURES) { fs.mkdirSync(CAPTURES, { recursive: true }); await pg.waitForTimeout(350); await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } };
const cibles = (pg) => pg.$$eval('[data-cm-vue-active="groupes"] button, [data-cm-vue-active="groupes"] a, .vrm-gc-feuille button, .vrm-gc-feuille a, .vrm-cm-partage-option', (e) => e.filter((b) => b.offsetParent && !b.closest('.vrm-cm-onglets, .vrm-cm-tableau')).map((b) => { const r = b.getBoundingClientRect(); return { t: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 24), h: Math.round(r.height), w: Math.round(r.width) }; }).filter((x) => x.h < 44 || x.w < 44));
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const pleins = (pg, portee) => pg.$$eval(portee + ' .vrm-cm-primaire', (e) => e.filter((b) => b.offsetParent).length);
const air = (pg) => pg.evaluate(() => {
  const cartes = [...document.querySelectorAll('.vrm-gc-groupe')].filter((e) => e.offsetParent).map((e) => { const s = getComputedStyle(e); return Math.min(parseFloat(s.paddingLeft), parseFloat(s.paddingTop), parseFloat(s.paddingRight)); });
  const rangees = [...document.querySelectorAll('.vrm-gc-liste > li')].filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().height));
  return { carte: cartes.length ? Math.min(...cartes) : null, rangee: rangees.length ? Math.min(...rangees) : null };
});
const secretsDans = (s, autre) => [autre, USERS[autre].email, USERS[autre].login].filter((x) => s.includes(x));

(async () => {
  try { compte = (await import('file://' + path.join(RACINE, 'api', 'compte.js'))).default; }
  catch (e) { console.log('❌ api/compte.js ne se charge pas : ' + e.message); process.exit(1); }
  const AV = await import('file://' + path.join(RACINE, 'api', '_lib', 'avatar-discord.js')).catch(() => ({}));
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  if (MUTATION) console.log(`(mutation « ${MUTATION} »)`);
  try {
    console.log('\n── Base AVEC la 025, SANS la 046 · 390 px clair : créer marche, le reste est « bientôt »');
    reset({ coucou: false });
    await essaie('sans la 046', async () => {
      const { ctx, pg, erreurs } = await ouvrir(nav, { qui: A, largeur: 390 });
      await aller(pg);
      dit(await attr(pg, '[data-cm-accomp]', 'data-cm-accomp') === 'lu', 'les groupes (025) se lisent');
      dit(await attr(pg, '[data-cm-coucou-etat]', 'data-cm-coucou-etat') === 'non-installe', 'le coucou sait que la 046 manque (« non-installe »)', await attr(pg, '[data-cm-coucou-etat]', 'data-cm-coucou-etat'));
      await pg.click('[data-cm-accomp-creer]');
      await pg.waitForSelector('[data-cm-accomp-etape="1"]', { timeout: 5000 });
      dit(!!(await pg.$('[data-cm-accomp-photo-bientot]')) && !(await pg.$('[data-cm-accomp-photo]')), 'étape 1 : « Photo du groupe : bientôt disponible », aucun bouton photo');
      await pg.fill('[data-cm-accomp-nom]', 'Groupe sans 046');
      await pg.click('[data-cm-accomp-continuer]');
      await pg.fill('[data-cm-accomp-createur]', 'Coach Alice');
      await pg.click('[data-cm-accomp-valider]');
      await pg.waitForSelector('[data-cm-accomp-etape="3"]', { timeout: 8000 });
      dit(B.groupes.length === 1, 'le groupe est créé quand même');
      dit(!!(await pg.$('[data-cm-accomp-discord-bientot]')) && !(await pg.$('[data-cm-accomp-discord-champ]')), 'étape 3 : « Lier un serveur Discord : bientôt disponible », aucun champ');
      dit(!!(await pg.$('[data-cm-accomp-qr]')) && !!(await pg.$('[data-cm-accomp-copier-lien]')), 'l’invitation (QR, lien) marche sans la 046');
      await capture(pg, 'groupes-sans-046-390-clair');
      await pg.click('[data-cm-accomp-termine]');
      await pg.waitForTimeout(300);
      dit(!!(await pg.$('[data-cm-coucou-bientot]')) && /bientôt/.test(await texte(pg)), 'sur la page : « Le coucou arrive bientôt »');
      dit(!(await pg.$('[data-cm-coucou-faire]')), 'aucun bouton de coucou promis');
      dit(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | '));
      await ctx.close();
    });

    reset();
    let code = '', gid = '';
    for (const [largeur, sombre, nomTheme] of [[390, false, '390-clair'], [390, true, '390-sombre'], [1512, false, '1512-clair'], [1512, true, '1512-sombre']]) {
      console.log(`\n── ${nomTheme} · Alice crée son groupe en trois étapes`);
      reset();
      await essaie(`créer ${nomTheme}`, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { qui: A, largeur, sombre, partage: largeur < 600 });
        await aller(pg);
        dit(!!(await pg.$('[data-cm-accomp-vide]')) && await pleins(pg, '[data-cm-vue-active="groupes"]') === 1, 'aucun groupe : un état vide, UN bouton plein (« Créer un groupe »)');
        if (nomTheme === '390-clair') await capture(pg, 'groupes-vide-' + nomTheme);
        await pg.click('[data-cm-accomp-creer]');
        await pg.waitForSelector('[data-cm-accomp-etape="1"]', { timeout: 5000 });
        const etapes = await pg.$$eval('.vrm-gc-etapes li', (l) => l.length);
        dit(etapes === 3, 'TROIS étapes, dites (« étape 1 sur 3 »)', etapes);
        const champs1 = await pg.$$eval('[data-cm-accomp-etape="1"] input:not([type=file]), [data-cm-accomp-etape="1"] textarea', (l) => l.length);
        dit(champs1 === 2 && !!(await pg.$('[data-cm-accomp-photo]')), 'étape 1 : le nom, une phrase, la photo (facultative)', champs1);
        await pg.setInputFiles('[data-cm-accomp-photo]', { name: 'groupe.png', mimeType: 'image/png', buffer: PNG });
        await pg.waitForSelector('.vrm-gc-photo-choix img', { timeout: 5000 });
        await pg.fill('[data-cm-accomp-nom]', 'Accompagnement novembre');
        await pg.fill('[data-cm-accomp-description]', 'On suit les ventes ensemble, et on se parle sur Discord.');
        dit(await pleins(pg, '.vrm-gc-feuille') === 1, 'étape 1 : un seul bouton plein (« Continuer »)');
        await capture(pg, 'groupes-creer-1-' + nomTheme);
        await pg.click('[data-cm-accomp-continuer]');
        await pg.waitForSelector('[data-cm-accomp-etape="2"]', { timeout: 5000 });
        dit(await attr(pg, '[data-cm-accomp-regle-entree]', 'data-cm-accomp-regle-entree') === 'demande' && /Tu acceptes chaque personne/.test(await texte(pg)), 'étape 2 : sur invitation, il accepte chaque personne (la règle de la 025, dite)');
        dit(await attr(pg, '[data-cm-accomp-regle-partage]', 'data-cm-accomp-regle-partage') === 'rien' && /Rien, par défaut/.test(await texte(pg)), 'étape 2 : les membres partagent RIEN par défaut (dit)');
        dit(!(await pg.$('[data-cm-accomp-etape="2"] input[type=radio], [data-cm-accomp-etape="2"] select, [data-cm-accomp-etape="2"] [data-cm-accomp-niveau]')), 'et le créateur ne peut PAS changer ce défaut (c’est le membre qui choisit)');
        await capture(pg, 'groupes-creer-2-' + nomTheme);
        await pg.fill('[data-cm-accomp-createur]', 'Coach Alice');
        await pg.click('[data-cm-accomp-valider]');
        await pg.waitForSelector('[data-cm-accomp-etape="3"]', { timeout: 8000 });
        code = B.groupes[0] && B.groupes[0].code; gid = B.groupes[0] && B.groupes[0].id;
        dit(!!code && (B.habillage[gid] || {}).photo && /^data:image\/jpeg;base64,/.test(B.habillage[gid].photo), 'le groupe est créé, sa photo rangée (petit JPEG)');
        dit(await attr(pg, '[data-cm-accomp-qr]', 'data-cm-accomp-qr') === `http://localhost:${PORT}/?tab=communaute&groupe=${code}` && !!(await pg.$('[data-cm-accomp-qr] svg path')), 'étape 3 : le QR code du lien d’invitation', await attr(pg, '[data-cm-accomp-qr]', 'data-cm-accomp-qr'));
        await pg.click('[data-cm-accomp-copier-lien]');
        await pg.waitForSelector('[data-cm-accomp-copie]', { timeout: 3000 }).catch(() => {});
        const copie = await pg.evaluate(() => navigator.clipboard.readText().catch(() => ''));
        dit(copie.endsWith('/?tab=communaute&groupe=' + code), 'copier le lien', copie);
        if (largeur < 600) {
          await pg.click('[data-cm-accomp-partager]');
          const p = await pg.evaluate(() => window.__partages && window.__partages[0]);
          dit(p && p.url && p.url.endsWith('groupe=' + code) && /Accompagnement novembre/.test(p.title), '« Partager » ouvre la feuille de partage (le lien et le nom)', JSON.stringify(p));
        } else dit(!(await pg.$('[data-cm-accomp-partager]')), 'sans feuille de partage (ordinateur) : pas de bouton « Partager » qui ne ferait rien');
        dit(await pleins(pg, '.vrm-gc-feuille') === 1, 'étape 3 : un seul bouton plein');
        await pg.fill('[data-cm-accomp-discord-champ]', 'https://exemple.test/pas-discord');
        await pg.click('[data-cm-accomp-discord-enregistrer]');
        await pg.waitForTimeout(200);
        dit(/pas un lien Discord/.test(await texte(pg)) && !(B.habillage[gid] || {}).discord, 'un lien qui n’est pas Discord est refusé, dit, rien rangé');
        await pg.fill('[data-cm-accomp-discord-champ]', 'https://discord.gg/vrm-banc');
        await pg.click('[data-cm-accomp-discord-enregistrer]');
        await pg.waitForFunction(() => /enregistré/.test(document.body.innerText), null, { timeout: 5000 }).catch(() => {});
        dit((B.habillage[gid] || {}).discord === 'https://discord.gg/vrm-banc' && (B.habillage[gid] || {}).photo, 'le lien Discord du groupe est rangé (la photo gardée)');
        await capture(pg, 'groupes-creer-3-' + nomTheme);
        const pc = await cibles(pg);
        dit(pc.length === 0, 'feuille : cibles de 44 px au moins', JSON.stringify(pc));
        dit(await deborde(pg) <= 0, 'aucun débordement horizontal', await deborde(pg));
        await pg.click('[data-cm-accomp-termine]');
        await pg.waitForSelector('[data-cm-accomp-cree]', { timeout: 5000 });
        dit(!!(await pg.$('[data-cm-accomp-cree] .vrm-gc-vignette img')) && await attr(pg, '[data-cm-accomp-discord-ouvrir]', 'href') === 'https://discord.gg/vrm-banc', 'la page du groupe : sa photo et « Ouvrir sur Discord »');
        const a = await air(pg);
        dit(a.carte >= (largeur < 900 ? 20 : 24), `AIR : marge intérieure d’une carte ≥ ${largeur < 900 ? 20 : 24} px`, JSON.stringify(a));
        dit(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | '));
        await ctx.close();
      });
    }

    console.log('\n── 390 px sombre · Bruno ouvre le LIEN et demande (Rien coché)');
    let ctxB, pgB;
    await essaie('rejoindre', async () => {
      const o = await ouvrir(nav, { qui: Bu, largeur: 390, sombre: true, chemin: `/?tab=communaute&groupe=${code}` });
      ctxB = o.ctx; pgB = o.pg;
      await pgB.waitForSelector('[data-cm-accomp-apercu]', { timeout: 10000 });
      dit(await pgB.$eval('[data-cm-accomp-niveau="rien"]', (e) => e.checked), 'le partage « Rien » est coché par défaut (inchangé)');
      await pgB.fill('[data-cm-accomp-moi]', 'Bruno');
      await pgB.click('[data-cm-accomp-demander]');
      await pgB.waitForSelector('[data-cm-accomp-rejoint]', { timeout: 8000 });
      dit(B.membres[0] && B.membres[0].statut === 'attente' && B.membres[0].partage === 'rien', 'la demande part avec « rien », en attente');
      dit(!(await pgB.$('[data-cm-coucou-faire]')), 'en attente : aucun coucou possible');
    });

    console.log('\n── 390 px clair · Alice accepte, ouvre Bruno, lui fait coucou');
    let ctxA, pgA;
    await essaie('coucou', async () => {
      const o = await ouvrir(nav, { qui: A, largeur: 390 });
      ctxA = o.ctx; pgA = o.pg;
      await aller(pgA);
      dit(await attr(pgA, '[data-cm-accomp-a-valider]', 'data-cm-accomp-a-valider') === '1' && !!(await pgA.$('[data-cm-accomp-accepter]')) && !!(await pgA.$('[data-cm-accomp-refuser]')), 'la page du groupe : « 1 à valider », Accepter / Refuser');
      await capture(pgA, 'groupes-page-demande-390-clair');
      await pgA.click('[data-cm-accomp-accepter]');
      await pgA.waitForSelector('[data-cm-accomp-membre]', { timeout: 8000 });
      const a = await air(pgA);
      dit(a.rangee >= 64, 'AIR : une rangée de liste ≥ 64 px', JSON.stringify(a));
      await pgA.click('[data-cm-accomp-voir-membre]');
      await pgA.waitForSelector('[data-cm-coucou-faire]', { timeout: 5000 });
      dit(!(await pgA.$('.vrm-gc-feuille textarea, .vrm-gc-feuille input[type=text], .vrm-gc-feuille [contenteditable]')), 'la fiche du membre : AUCUN champ de texte à côté du coucou');
      await capture(pgA, 'groupes-membre-coucou-390-clair');
      await pgA.click('[data-cm-coucou-faire]');
      await pgA.waitForFunction(() => /Coucou envoyé/.test(document.body.innerText), null, { timeout: 5000 }).catch(() => {});
      const env = B.reponses.filter((r) => r.action === 'accomp-coucou');
      dit(B.coucous.length === 1 && B.coucous[0].de === A && B.coucous[0].a === Bu, 'le coucou est fait (de Alice, à Bruno)');
      dit(env.length === 1 && Object.keys(env[0].corps).sort().join(',') === 'action,groupe,membre', 'la requête ne porte QUE le groupe et la personne', env[0] && JSON.stringify(env[0].corps));
      dit(B.lectures.some((u) => /push_(subs|prefs|journal)/.test(u) && u.includes('owner=eq.' + Bu)) && !B.lectures.some((u) => /push_(subs|journal)/.test(u) && u.includes('owner=eq.' + A)), 'la notification part chez BRUNO (ses appareils, sa cloche)');
      await pgA.waitForFunction(() => document.querySelector('[data-cm-coucou-faire]')?.getAttribute('data-etat') === 'deja', null, { timeout: 5000 }).catch(() => {});
      dit(await attr(pgA, '[data-cm-coucou-faire]', 'data-etat') === 'deja', 'une deuxième fois : « Coucou fait ✓ », grisé (24 h)');
    });

    console.log('\n── 390 px sombre · Bruno reçoit le coucou');
    await essaie('recevoir', async () => {
      await recharger(pgB);
      dit(!!(await pgB.$('[data-cm-coucou-recu]')) && /Coach Alice t’a fait coucou/.test(await texte(pgB)), 'Bruno voit « Coach Alice t’a fait coucou »');
      dit(await attr(pgB, '[data-cm-coucou-ecrire]', 'data-cm-coucou-ecrire') === 'groupe' && await attr(pgB, '[data-cm-coucou-ecrire]', 'href') === 'https://discord.gg/vrm-banc', 'Alice n’a pas relié Discord ⇒ « Lui écrire sur Discord » ouvre le salon du GROUPE');
      const zone = await pgB.$$eval('[data-cm-coucou-recu]', (l) => l.map((e) => ({ champs: e.querySelectorAll('input, textarea, [contenteditable]').length, liens: e.querySelectorAll('a').length, boutons: e.querySelectorAll('button').length })));
      dit(zone.every((z) => z.champs === 0 && z.liens === 1 && z.boutons === 1), 'UN geste (le lien Discord) + « ⋯ » ; aucun champ, aucune réponse dans l’app', JSON.stringify(zone));
      dit(await attr(pgB, '[data-cm-coucou-faire="createur"]', 'data-etat') === 'deja', 'Bruno ne peut pas le rendre dans les 24 h (une paire, un coucou)');
      await capture(pgB, 'groupes-recu-groupe-390-sombre');
      const pc = await cibles(pgB);
      dit(pc.length === 0, 'cibles de 44 px', JSON.stringify(pc));
      dit(await deborde(pgB) <= 0, 'aucun débordement à 390 px', await deborde(pgB));
      // Alice retire le lien Discord ⇒ « Pas de Discord lié », rien d'autre.
      B.habillage[gid].discord = null;
      await recharger(pgB);
      dit(await attr(pgB, '[data-cm-coucou-ecrire]', 'data-cm-coucou-ecrire') === 'aucun' && /Pas de Discord lié/.test(await texte(pgB)) && !(await pgB.$('[data-cm-coucou-recu] a')), 'ni Discord relié ni salon ⇒ « Pas de Discord lié », AUCUN autre geste');
      await capture(pgB, 'groupes-recu-aucun-390-sombre');
      // Alice relie son Discord (ligne signée par le serveur) ⇒ son PROFIL.
      if (AV.signerIdDiscord) B.discordComptes[A] = { discord: 'alice_banc', did: DID_A, signatureId: AV.signerIdDiscord(A, 'alice_banc', DID_A), avatar: null, pid: '', signatureAvatar: null };
      B.habillage[gid].discord = 'https://discord.gg/vrm-banc';
      await recharger(pgB);
      dit(await attr(pgB, '[data-cm-coucou-ecrire]', 'data-cm-coucou-ecrire') === 'profil' && await attr(pgB, '[data-cm-coucou-ecrire]', 'href') === `https://discord.com/users/${DID_A}`, 'Alice a relié son Discord ⇒ son PROFIL (avant le salon)', await attr(pgB, '[data-cm-coucou-ecrire]', 'href'));
      await capture(pgB, 'groupes-recu-profil-390-sombre');
    });

    console.log('\n── Couper, hors du groupe, confidentialité');
    await essaie('couper', async () => {
      await pgB.click('[data-cm-coucou-plus]');
      await pgB.waitForSelector('[data-cm-coucou-sourdine]', { timeout: 5000 });
      await capture(pgB, 'groupes-couper-390-sombre');
      await pgB.click('[data-cm-coucou-sourdine]');
      await pgB.waitForFunction(() => !document.querySelector('[data-cm-coucou-recu]'), null, { timeout: 5000 }).catch(() => {});
      dit(!(await pgB.$('[data-cm-coucou-recu]')) && !!(await pgB.$('[data-cm-coucou-sourdines]')), 'Bruno coupe Alice : son coucou disparaît, la personne coupée est retrouvable');
      for (const c of B.coucous) c.t -= 25 * 3600e3;   // 25 h plus tard
      await recharger(pgA);
      await pgA.click('[data-cm-accomp-voir-membre]');
      await pgA.waitForSelector('[data-cm-coucou-faire]', { timeout: 5000 });
      await pgA.click('[data-cm-coucou-faire]');
      await pgA.waitForTimeout(500);
      dit(B.coucous.length === 1 && /ne peut pas partir/.test(await texte(pgA)), '25 h plus tard, le coucou d’Alice ne passe pas (refus neutre)');
      await pgA.click('.vrm-gc-feuille .vrm-cm-x').catch(() => {});
    });

    await essaie('hors du groupe', async () => {
      const { ctx, pg } = await ouvrir(nav, { qui: Ca, largeur: 390 });
      await aller(pg);
      const r = await pg.evaluate(async ([g, jeton]) => { const x = await fetch('/api/compte?mode=communaute', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + jeton }, body: JSON.stringify({ action: 'accomp-coucou', groupe: g, membre: null }) }); return { s: x.status, j: await x.json() }; }, [gid, jetonDe(Ca)]);
      dit(r.s === 404 && r.j.erreur === 'groupe' && B.coucous.length === 1, 'Carla (hors du groupe) ne fait coucou à personne', JSON.stringify(r));
      dit(!(await pg.$('[data-cm-coucou-faire]')), 'et l’écran ne lui en propose aucun');
      await ctx.close();
    });

    await essaie('confidentialité', async () => {
      const versA = B.reponses.filter((r) => r.qui === A).map((r) => r.body).join(' ');
      const versB = B.reponses.filter((r) => r.qui === Bu).map((r) => r.body).join(' ');
      dit(secretsDans(versA, Bu).length === 0 && secretsDans(versB, A).length === 0, 'aucune réponse ne porte le compte, l’email ou le login de l’autre', secretsDans(versA, Bu).concat(secretsDans(versB, A)).join(' '));
    });

    console.log('\n── 1512 px sombre · la page du groupe (Alice) et la page de Bruno');
    await essaie('1512', async () => {
      const { ctx, pg, erreurs } = await ouvrir(nav, { qui: A, sombre: true });
      await aller(pg);
      await capture(pg, 'groupes-page-1512-sombre');
      const a = await air(pg);
      dit(a.carte >= 24 && a.rangee >= 64, 'AIR à 1512 : carte ≥ 24 px, rangée ≥ 64 px', JSON.stringify(a));
      dit(await pleins(pg, '[data-cm-vue-active="groupes"]') <= 1, 'au plus UN bouton plein sur l’écran');
      dit(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | '));
      await ctx.close();
      const b = await ouvrir(nav, { qui: Bu, largeur: 1512 });
      await aller(b.pg);
      await capture(b.pg, 'groupes-membre-1512-clair');
      dit(!!(await b.pg.$('[data-cm-coucou-ouvrir="non"]')), 'côté membre : « Les autres membres peuvent me faire coucou » est NON par défaut');
      await b.ctx.close();
    });
    if (ctxA) await ctxA.close(); if (ctxB) await ctxB.close();
  } finally {
    await nav.close(); srv.close();
  }
  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
