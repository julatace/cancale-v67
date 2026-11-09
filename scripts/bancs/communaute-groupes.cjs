require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « COMMUNAUTÉ → GROUPES » — les groupes d'accompagnement (migration 025,
//  5 novembre), RENDU à 1512 px et 390 px tactile, clair et sombre.
//  BANC_PORT=7987 CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/bancs/communaute-groupes.cjs
//  (CAPTURES=dossier : les captures d'écran ; BANC_MUTATION=… : le faux réaffaiblit une règle ⇒ ROUGE)
//
//  Le VRAI api/compte.js (`?mode=communaute`, actions `accomp-…`) est EXÉCUTÉ ;
//  le faux PostgREST applique les RÈGLES de la 025 (prouvées sur un vrai
//  Postgres par audit-accompagnement-sql.cjs). Deux personnes INVENTÉES :
//  Alice crée, Bruno rejoint. Ce que le banc juge :
//   · base SANS la 025 ⇒ l'onglet Groupes le dit (« pas encore activés ») et ne
//     propose AUCUN bouton (rien de promis) ;
//   · créer (nom, description, son nom) ⇒ un code et un lien ;
//   · le LIEN ouvre Communauté → Groupes, code tapé : on voit ce qu'on rejoint
//     AVANT de demander, le partage est « Rien » coché par défaut ;
//   · demander ⇒ « En attente de validation » ; le créateur voit la demande
//     (ambre : un geste à faire), accepte ;
//   · partage « rien » ⇒ le créateur ne voit AUCUN chiffre ; « chiffres » ⇒
//     l'app de Bruno publie SES agrégats (vrm_benefice_jours, vrm_achats_jours),
//     jamais le détail ; le créateur voit les mêmes nombres ; « détail » ⇒ le
//     détail ; revenir à « rien » ⇒ plus rien, et c'est EFFACÉ côté base ;
//   · « Voir ce que voit Alice » montre à Bruno EXACTEMENT la vue d'Alice ;
//   · retirer ⇒ Bruno le voit ; aucun compte ni email de l'autre dans le DOM ni
//     dans les réponses ; cibles 44 px ; aucun débordement à 390 px.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs');
const RACINE = path.join(__dirname, '..', '..');
let chromium;
try { ({ chromium } = require(path.join(RACINE, 'node_modules', 'playwright'))); } catch (_) { ({ chromium } = require('playwright')); }
const DIST = path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || 7987);
const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const MUTATION = process.env.BANC_MUTATION || '';
const CAPTURES = process.env.CAPTURES || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d && !c ? ' — ' + String(d).slice(0, 220) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).split('\n')[0].slice(0, 200)); } };

// ── Les personnes (inventées) ────────────────────────────────────────────────
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', Bu = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (id, email) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: id, email, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.c2ln`;
const USERS = { [A]: { id: A, email: 'alice.secret@exemple.test', login: 'alice_vinted_secret' }, [Bu]: { id: Bu, email: 'bruno.secret@exemple.test', login: 'bruno_vinted_secret' } };
const JETONS = {}; for (const u of Object.values(USERS)) JETONS[jwt(u.id, u.email)] = u;
const jetonDe = (id) => Object.keys(JETONS).find((k) => JETONS[k].id === id);
const session = (id) => ({ access_token: jetonDe(id), refresh_token: 'r-' + id, expires_at: Date.now() + 3600e3, user: { id, email: USERS[id].email } });

// Les agrégats que l'app de Bruno a publiés (inventés) : 3 ventes en novembre, 2 achats.
const ici = new Date(); const jour = (dec) => { const d = new Date(ici); d.setDate(d.getDate() - dec); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const VENTES_B = { v: 2, plateformes: ['Vinted'], jours: { [jour(0)]: [2, 9000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [jour(1)]: [1, 4550, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, horsVestiaire: 2, at: Date.now() };
const ACHATS_B = { v: 1, jours: { [jour(0)]: [2, 5000] }, at: Date.now() };
const RELEVE_B = { v: 1, l: [['Vinted', 'compte_banc_b', 't-1', Date.now() - 3600e3, 45.5, 20, 1, 'Paire inventée du banc 42', '7', '']], at: Date.now() };
const ACH_REL_B = { v: 1, l: [[Date.now() - 7200e3, 'compte_banc_b', 'Achat inventé du banc', 25]], at: Date.now() };
const VENTES_MOIS = 3;   // ce que le créateur doit lire pour le mois en cours (si les deux jours y tombent)

// ── La base : les RÈGLES de la 025, en JS ────────────────────────────────────
let B;
const reset = (installe = true) => { B = { installe, groupes: [], membres: [], partages: {}, n: 1, reponses: [], publications: [] }; };
const uuid = () => `00000000-0000-4000-8000-${String(B.n++).padStart(12, '0')}`;
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const codeNeuf = () => { let c = ''; for (let i = 0; i < 8; i++) c += ALPHA[(B.n * 7 + i * 13 + B.groupes.length * 3) % 32]; B.n++; return c; };
const niveau = (p) => (p === 'detail' ? 2 : p === 'chiffres' ? 1 : 0);
const gDe = (id) => B.groupes.find((g) => g.id === id);
const elaguer = (o) => {
  const n = Math.max(0, ...B.membres.filter((m) => m.owner === o && ['attente', 'accepte'].includes(m.statut) && !gDe(m.groupe).ferme).map((m) => niveau(m.partage)));
  const s = B.partages[o]; if (!s) return n;
  if (n < 2) { s.detail = null; s.detail_le = null; }
  if (n < 1 && MUTATION !== 'revoquer-garde') { s.chiffres = null; s.chiffres_le = null; }
  return n;
};
const vue = (m) => {
  const s = B.partages[m.owner] || {};
  const v = { id: m.id, nom: m.nom, statut: m.statut, partage: m.partage, demande_le: m.demande_le, decide_le: m.decide_le, partage_le: m.partage_le };
  const voit = MUTATION === 'chiffres-sans-partage' ? 1 : niveau(m.partage);
  if (m.statut === 'accepte' && voit >= 1) { v.chiffres = s.chiffres || null; v.chiffres_le = s.chiffres_le || null; }
  if (m.statut === 'accepte' && voit >= 2) { v.detail = s.detail || null; v.detail_le = s.detail_le || null; }
  return v;
};
function rpc(fn, a, uid) {
  if (fn === 'vrm_communaute_carte') return { acces: true, moi: null, profils: [], groupes: [] };
  if (fn === 'vrm_communaute_conversations') return [];
  if (!fn.startsWith('vrm_accomp_')) return undefined;
  if (!B.installe) return undefined;
  const now = new Date().toISOString();
  if (fn === 'vrm_accomp_lire') {
    const actifs = B.membres.filter((m) => m.owner === uid && ['attente', 'accepte'].includes(m.statut) && !gDe(m.groupe).ferme);
    return { acces: true,
      crees: B.groupes.filter((g) => g.cree_par === uid && !g.ferme).map((g) => ({ id: g.id, nom: g.nom, description: g.description, code: g.code, createur: g.createur, cree_le: g.cree_le,
        membres: B.membres.filter((m) => m.groupe === g.id && ['attente', 'accepte'].includes(m.statut)).map(vue) })),
      rejoints: B.membres.filter((m) => m.owner === uid && m.statut !== 'parti').map((m) => { const g = gDe(m.groupe); return { id: m.id, groupe: g.id, nom: g.nom, description: g.description, createur: g.createur, moi: m.nom, statut: m.statut, partage: m.partage, demande_le: m.demande_le, decide_le: m.decide_le, ferme: !!g.ferme, membres: B.membres.filter((x) => x.groupe === g.id && x.statut === 'accepte').length }; }),
      niveau: Math.max(0, ...actifs.map((m) => niveau(m.partage))),
      publie: B.partages[uid] ? { chiffres_le: B.partages[uid].chiffres_le, detail_le: B.partages[uid].detail_le } : null };
  }
  if (fn === 'vrm_accomp_creer') { const g = { id: uuid(), nom: a.p_nom, description: a.p_description, code: codeNeuf(), cree_par: uid, createur: a.p_createur, cree_le: now }; B.groupes.push(g); return { ok: true, id: g.id, code: g.code, nom: g.nom }; }
  if (fn === 'vrm_accomp_apercu') {
    const g = B.groupes.find((x) => x.code === a.p_code && !x.ferme); if (!g) return { ok: false, raison: 'code' };
    const m = B.membres.find((x) => x.groupe === g.id && x.owner === uid);
    return { ok: true, nom: g.nom, description: g.description, createur: g.createur, membres: B.membres.filter((x) => x.groupe === g.id && x.statut === 'accepte').length, createur_moi: g.cree_par === uid, statut: m ? m.statut : null };
  }
  if (fn === 'vrm_accomp_demander') {
    const g = B.groupes.find((x) => x.code === a.p_code && !x.ferme); if (!g) return { ok: false, raison: 'code' };
    if (g.cree_par === uid) return { ok: false, raison: 'soi' };
    let m = B.membres.find((x) => x.groupe === g.id && x.owner === uid);
    if (m && ['attente', 'accepte'].includes(m.statut)) return { ok: true, id: m.id, nom: g.nom, statut: m.statut, deja: true };
    const statut = MUTATION === 'sans-validation' ? 'accepte' : 'attente';
    if (!m) { m = { id: uuid(), groupe: g.id, owner: uid }; B.membres.push(m); }
    Object.assign(m, { nom: a.p_nom, statut, partage: a.p_partage, demande_le: now, decide_le: null, partage_le: now });
    return { ok: true, id: m.id, nom: g.nom, statut };
  }
  if (fn === 'vrm_accomp_decider' || fn === 'vrm_accomp_retirer') {
    const m = B.membres.find((x) => x.id === a.p_membre); const g = m && gDe(m.groupe);
    if (!g || g.cree_par !== uid) return { ok: false, raison: 'pas-createur' };
    if (fn === 'vrm_accomp_decider') { if (m.statut !== 'attente') return { ok: false, raison: 'etat' }; m.statut = a.p_oui === true ? 'accepte' : 'refuse'; }
    else m.statut = 'retire';
    m.decide_le = now; elaguer(m.owner); return { ok: true, statut: m.statut };
  }
  if (fn === 'vrm_accomp_partage') {
    const m = B.membres.find((x) => x.id === a.p_adhesion && x.owner === uid && ['attente', 'accepte'].includes(x.statut)); if (!m) return { ok: false, raison: 'adhesion' };
    m.partage = a.p_partage; m.partage_le = now; return { ok: true, partage: m.partage, niveau: elaguer(uid) };
  }
  if (fn === 'vrm_accomp_quitter') { const m = B.membres.find((x) => x.id === a.p_adhesion && x.owner === uid); if (!m) return { ok: false, raison: 'adhesion' }; m.statut = 'parti'; m.partage = 'rien'; elaguer(uid); return { ok: true }; }
  if (fn === 'vrm_accomp_code') { const g = gDe(a.p_groupe); if (!g || g.cree_par !== uid) return { ok: false, raison: 'pas-createur' }; g.code = codeNeuf(); return { ok: true, code: g.code }; }
  if (fn === 'vrm_accomp_fermer') { const g = gDe(a.p_groupe); if (!g || g.cree_par !== uid) return { ok: false, raison: 'pas-createur' }; g.ferme = true; return { ok: true }; }
  if (fn === 'vrm_accomp_ce_que_voit') { const m = B.membres.find((x) => x.id === a.p_adhesion && x.owner === uid && x.statut !== 'parti'); return m ? { acces: true, vue: vue(m) } : { acces: true, erreur: 'adhesion' }; }
  if (fn === 'vrm_accomp_publier') {
    const n = elaguer(uid); if (n < 1) return { ok: false, raison: 'rien-a-partager' };
    B.publications.push({ uid, chiffres: a.p_chiffres, detail: a.p_detail });
    const s = B.partages[uid] || (B.partages[uid] = {});
    if (a.p_chiffres) { s.chiffres = a.p_chiffres; s.chiffres_le = now; }
    if (n >= 2 && a.p_detail) { s.detail = a.p_detail; s.detail_le = now; } else if (n < 2) { s.detail = null; s.detail_le = null; }
    return { ok: true, niveau: n, chiffres: !!a.p_chiffres, detail: n >= 2 && !!a.p_detail };
  }
  return undefined;
}

function fauxSupabase(urlBrut, methode, entetes, corps) {
  const u = decodeURIComponent(String(urlBrut));
  const h = {}; for (const [k, v] of Object.entries(entetes || {})) h[k.toLowerCase()] = v;
  const tok = String(h.authorization || '').replace(/^Bearer\s+/i, '');
  const qui = JETONS[tok]; const uid = qui ? qui.id : null;
  const json = (b, status = 200, hh = {}) => ({ status, body: b === undefined ? '' : JSON.stringify(b), headers: { 'content-type': 'application/json', ...hh } });
  const [chemin] = u.split('?');
  if (/\/auth\/v1\/user/.test(chemin)) return qui ? json({ id: qui.id, email: qui.email, email_confirmed_at: '2026-10-01T00:00:00Z' }) : json({ msg: 'invalid' }, 401);
  if (/\/auth\/v1\//.test(chemin)) return json(qui ? { access_token: tok, refresh_token: 'r', expires_in: 3600, user: { id: qui.id, email: qui.email } } : {});
  const rest = /\/rest\/v1\/(.+)$/.exec(chemin);
  if (!rest) return json({}, 404);
  const cible = rest[1];
  if (cible.startsWith('rpc/')) {
    const fn = cible.slice(4);
    if (fn === 'vrm_acces') return json({ obligatoire: false, proprietaire: false, acces: true });
    if (!uid) return json({ message: 'permission denied' }, 401);
    const r = rpc(fn, (corps && corps.json) || {}, uid);
    if (r === undefined) return json({ code: 'PGRST202', message: `Could not find the function public.${fn}` }, 404);
    return json(r);
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
  if (/api\.stripe\.com|discord/.test(s)) return new Response('{}', { status: 404 });
  return fetchReel(url, opts);
};

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

let compte = null;
async function ouvrir(nav, { qui, largeur = 1512, sombre = false, chemin = '/?tab=communaute', local = {} }) {
  const mobile = largeur < 600;
  const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${PORT}` }).catch(() => {});
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript(({ s, sombre, local }) => {
    try { localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_bascule_mineral_v1', '1'); localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {}
    try { if (!sessionStorage.getItem('banc_seme')) { for (const [k, v] of Object.entries(local)) localStorage.setItem(k, JSON.stringify(v)); sessionStorage.setItem('banc_seme', '1'); } } catch (_) {}
  }, { s: session(qui), sombre, local });
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
      if (mode === 'communaute') B.reponses.push({ qui, action: corps && corps.action, body });
      return r.fulfill({ status: res.code, contentType: 'application/json', body });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}${chemin}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { const e = document.querySelector('[data-communaute-etat]'); return e && e.getAttribute('data-communaute-etat') !== 'charge'; }, null, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(500);
  return { ctx, pg, erreurs };
}
// L'app nettoie l'adresse après l'ouverture : on revient par ?tab=communaute.
const recharger = async (pg) => { await pg.goto(`http://localhost:${PORT}/?tab=communaute`, { waitUntil: 'domcontentloaded' }); await pg.waitForFunction(() => { const e = document.querySelector('[data-communaute-etat]'); return e && e.getAttribute('data-communaute-etat') !== 'charge'; }, null, { timeout: 25000 }).catch(() => {}); };
const aller = async (pg) => { if (!(await pg.$('[data-cm-vue-active="groupes"]'))) await pg.click('[data-cm-vue="groupes"]'); await pg.waitForSelector('[data-cm-accomp]:not([data-cm-accomp="charge"])', { timeout: 10000 }); await pg.waitForTimeout(300); };
const attr = (pg, sel, a) => pg.evaluate(([s, x]) => { const e = document.querySelector(s); return e ? e.getAttribute(x) : null; }, [sel, a]);
const texte = (pg) => pg.evaluate(() => document.body.innerText);
const capture = async (pg, nom) => { if (CAPTURES) { fs.mkdirSync(CAPTURES, { recursive: true }); await pg.waitForTimeout(450); await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: true }); } };
// Les cibles de l'onglet : 44 px (§7), et aucun débordement horizontal.
const cibles = (pg) => pg.$$eval('[data-cm-vue-active="groupes"] button, .vrm-cm-feuille button, .vrm-cm-partage-option', (e) => e.filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return { t: (b.textContent || '').trim().slice(0, 24), h: Math.round(r.height) }; }).filter((x) => x.h < 44));
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const secretsDans = (s, autre) => [autre, USERS[autre].email, USERS[autre].login].filter((x) => s.includes(x));

(async () => {
  try { compte = (await import('file://' + path.join(RACINE, 'api', 'compte.js'))).default; }
  catch (e) { console.log('❌ api/compte.js ne se charge pas : ' + e.message); process.exit(1); }
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  if (MUTATION) console.log(`(mutation « ${MUTATION} »)`);
  const LOCAL_B = { vrm_benefice_jours: VENTES_B, vrm_achats_jours: ACHATS_B, vrm_stats_ventes: RELEVE_B, vrm_achats_releve: ACH_REL_B };
  try {
    console.log('\n── Base SANS la 025 · 1512 px clair');
    reset(false);
    await essaie('non installée', async () => {
      const { ctx, pg, erreurs } = await ouvrir(nav, { qui: A });
      dit(!!(await pg.$('[data-cm-vue="groupes"]')), 'Communauté a un onglet « Groupes »');
      await aller(pg);
      dit(await attr(pg, '[data-cm-accomp]', 'data-cm-accomp') === 'non-installe', 'sans la 025 : l’onglet est dans l’état « non-installe »', await attr(pg, '[data-cm-accomp]', 'data-cm-accomp'));
      dit(/pas encore activés sur ta base/.test(await texte(pg)), 'il le DIT (« pas encore activés sur ta base »)');
      dit(!(await pg.$('[data-cm-accomp-creer]')) && !(await pg.$('[data-cm-accomp-rejoindre]')), 'et ne propose RIEN (ni créer, ni rejoindre)');
      dit(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | '));
      await capture(pg, '0-non-installe-1512-clair');
      await ctx.close();
    });

    reset(true);
    let code = '';
    console.log('\n── 1512 px clair · Alice crée son groupe');
    await essaie('créer', async () => {
      const { ctx, pg, erreurs } = await ouvrir(nav, { qui: A });
      await aller(pg);
      dit(await attr(pg, '[data-cm-accomp]', 'data-cm-accomp') === 'lu' && !!(await pg.$('[data-cm-accomp-vide]')), 'aucun groupe : l’onglet le dit (rien d’inventé)');
      await pg.click('[data-cm-accomp-creer]');
      await pg.fill('[data-cm-accomp-nom]', 'Accompagnement novembre');
      await pg.fill('[data-cm-accomp-description]', 'Le groupe des élèves du banc : on suit les ventes ensemble.');
      await pg.fill('[data-cm-accomp-createur]', 'Coach Alice');
      await pg.click('[data-cm-accomp-valider]');
      await pg.waitForSelector('[data-cm-accomp-cree]', { timeout: 8000 });
      code = await attr(pg, '[data-cm-accomp-code]', 'data-cm-accomp-code');
      dit(/^[A-HJ-NP-Z2-9]{8}$/.test(code || '') && B.groupes.length === 1 && B.groupes[0].code === code, 'le groupe est créé, son code s’affiche', code);
      dit(!!(await pg.$('[data-cm-accomp-copier-lien]')) && !!(await pg.$('[data-cm-accomp-copier-code]')), 'le créateur peut copier le LIEN et le CODE d’invitation');
      await pg.click('[data-cm-accomp-copier-lien]');
      await pg.waitForSelector('[data-cm-accomp-copie]', { timeout: 3000 }).catch(() => {});
      const copie = await pg.evaluate(() => navigator.clipboard.readText().catch(() => ''));
      dit(copie.endsWith('/?tab=communaute&groupe=' + code), 'le lien copié ouvre Communauté avec le code', copie);
      dit(!!(await pg.$('[data-cm-accomp-aucun-membre]')), 'aucun membre : dit, et la marche à suivre');
      dit(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | '));
      await capture(pg, '1-createur-1512-clair');
      await ctx.close();
    });

    console.log('\n── 390 px tactile sombre · Bruno ouvre le LIEN');
    let ctxB, pgB;
    await essaie('rejoindre par le lien', async () => {
      const o = await ouvrir(nav, { qui: Bu, largeur: 390, sombre: true, chemin: `/?tab=communaute&groupe=${code}`, local: LOCAL_B });
      ctxB = o.ctx; pgB = o.pg;
      await pgB.waitForSelector('[data-cm-accomp-apercu]', { timeout: 10000 });
      dit(await attr(pgB, '[data-cm-vue-active]', 'data-cm-vue-active') === 'groupes', 'le lien ouvre directement l’onglet Groupes');
      const t = await texte(pgB);
      dit(/Accompagnement novembre/.test(t) && /Coach Alice/.test(t) && /on suit les ventes ensemble/.test(t), 'il voit CE QU’IL REJOINT avant de demander (nom, créateur, description)');
      dit(await pgB.$eval('[data-cm-accomp-niveau="rien"]', (e) => e.checked), 'le partage « Rien » est coché par défaut');
      const pc = await cibles(pgB);
      dit(pc.length === 0, 'feuille : cibles de 44 px au moins', JSON.stringify(pc));
      await capture(pgB, '2-rejoindre-390-sombre');
      await pgB.fill('[data-cm-accomp-moi]', 'Bruno élève');
      await pgB.click('[data-cm-accomp-demander]');
      await pgB.waitForSelector('[data-cm-accomp-rejoint]', { timeout: 8000 });
      const m = B.membres[0];
      dit(m && m.partage === 'rien' && m.statut === 'attente', 'la demande part avec « rien », statut « attente »', JSON.stringify(m));
      dit(await attr(pgB, '[data-cm-accomp-rejoint]', 'data-statut') === 'attente' && /En attente de validation/.test(await texte(pgB)), 'il voit « En attente de validation »');
      dit(B.publications.length === 0, 'il ne partage rien : RIEN n’est publié', JSON.stringify(B.publications).slice(0, 100));
      dit(await deborde(pgB) <= 0, 'aucun débordement horizontal à 390 px', await deborde(pgB));
    });

    console.log('\n── 1512 px sombre · Alice valide');
    let ctxA, pgA;
    await essaie('valider', async () => {
      const o = await ouvrir(nav, { qui: A, sombre: true });
      ctxA = o.ctx; pgA = o.pg;
      await aller(pgA);
      dit(await attr(pgA, '[data-cm-accomp-a-valider]', 'data-cm-accomp-a-valider') === '1', 'la demande attend SA validation (« 1 à valider »)');
      const coul = await pgA.$eval('[data-cm-accomp-a-valider]', (e) => getComputedStyle(e).color);
      dit(/255, 179, 64|178, 80, 0/.test(coul), 'en ambre : un geste à faire (§7)', coul);
      await capture(pgA, '3-demande-1512-sombre');
      await pgA.click('[data-cm-accomp-accepter]');
      await pgA.waitForSelector('[data-cm-accomp-membre]', { timeout: 8000 });
      dit(B.membres[0].statut === 'accepte', 'Accepter ⇒ membre');
      await pgA.click('[data-cm-accomp-voir-membre]');
      await pgA.waitForSelector('[data-cm-accomp-vue]', { timeout: 5000 });
      dit(await attr(pgA, '[data-cm-accomp-vue]', 'data-cm-accomp-vue') === 'rien' && !(await pgA.$('[data-cm-accomp-tableau]')), 'partage « rien » : le créateur ne voit AUCUN chiffre');
      await pgA.click('.vrm-cm-feuille .vrm-cm-x');
    });

    console.log('\n── Bruno partage ses chiffres (390 sombre)');
    await essaie('chiffres', async () => {
      await recharger(pgB);
      await aller(pgB);
      await pgB.click('[data-cm-accomp-niveau="chiffres"]');
      await pgB.waitForFunction(() => document.querySelector('[data-cm-accomp-niveau="chiffres"]')?.checked, null, { timeout: 5000 });
      await pgB.waitForFunction(() => document.querySelector('[data-cm-accomp-publie="oui"]'), null, { timeout: 10000 }).catch(() => {});
      const p = B.publications[B.publications.length - 1];
      dit(p && p.chiffres && p.chiffres.ventes === true && p.chiffres.achats === true, 'son app publie SES agrégats (ventes et achats connus)', JSON.stringify(p && p.chiffres).slice(0, 160));
      dit(p && (p.detail == null), 'au niveau « chiffres », le détail NE PART PAS', JSON.stringify(p && p.detail).slice(0, 80));
      const mois = Object.values((p && p.chiffres.mois) || {}).reduce((s, a) => s + a[0], 0);
      dit(mois === 3, 'les ventes publiées = celles de vrm_benefice_jours (3)', mois);
      await pgB.click('[data-cm-accomp-ce-que-voit]');
      await pgB.waitForSelector('[data-cm-accomp-vue]', { timeout: 5000 });
      dit(await attr(pgB, '[data-cm-accomp-vue]', 'data-cm-accomp-vue') === 'chiffres', 'Bruno voit ce que voit Alice : ses chiffres, pas de détail');
      await capture(pgB, '4-ce-que-voit-390-sombre');
      const pc = await cibles(pgB);
      dit(pc.length === 0, 'cibles de 44 px (feuille et onglet)', JSON.stringify(pc));
      dit(await deborde(pgB) <= 0, 'aucun débordement à 390 px (le tableau tient)', await deborde(pgB));
      await pgB.click('.vrm-cm-feuille .vrm-cm-x');
    });

    console.log('\n── Alice voit les chiffres de Bruno (1512 sombre)');
    let vueA = null;
    await essaie('créateur voit', async () => {
      await recharger(pgA);
      await aller(pgA);
      await pgA.click('[data-cm-accomp-voir-membre]');
      await pgA.waitForSelector('[data-cm-accomp-tableau]', { timeout: 5000 });
      const n = await pgA.$$eval('[data-cm-accomp-ligne]', (e) => e.reduce((s, x) => s + Number(x.getAttribute('data-n') || 0), 0));
      dit(n === 3, 'le créateur lit 3 ventes sur les mois montrés', n);
      dit(!(await pgA.$('[data-cm-accomp-detail]')) && !/Paire inventée du banc/.test(await texte(pgA)), 'aucun détail (pas autorisé)');
      // (5 nov., relecture) 2 ventes Vestiaire au montant pas sûr ne sont PAS dans ces totaux : la vue le dit (§5).
      dit(await attr(pgA, '[data-cm-accomp-hors-vc]', 'data-cm-accomp-hors-vc') === '2', 'le total est dit PARTIEL : « sans 2 ventes Vestiaire » (montant pas encore su)', await attr(pgA, '[data-cm-accomp-hors-vc]', 'data-cm-accomp-hors-vc'));
      vueA = await pgA.evaluate(() => document.querySelector('[data-cm-accomp-vue]').innerText);
      await capture(pgA, '5-chiffres-1512-sombre');
      await pgA.click('.vrm-cm-feuille .vrm-cm-x');
    });

    console.log('\n── Le membre voit EXACTEMENT la vue du créateur');
    await essaie('même vue', async () => {
      await pgB.click('[data-cm-accomp-ce-que-voit]');
      await pgB.waitForSelector('[data-cm-accomp-tableau]', { timeout: 5000 });
      const vueB = await pgB.evaluate(() => document.querySelector('[data-cm-accomp-vue]').innerText);
      const sans = (s) => s.replace(/^Voici, à l’identique[^\n]*\n/, '').replace(/\s+/g, ' ').trim();
      dit(sans(vueB) === sans(vueA || ''), 'même nom, même statut, mêmes nombres, mot pour mot', sans(vueB).slice(0, 120) + ' ≠ ' + sans(vueA || '').slice(0, 120));
      await pgB.click('.vrm-cm-feuille .vrm-cm-x');
    });

    console.log('\n── Détail autorisé, puis tout retiré');
    await essaie('détail puis rien', async () => {
      await pgB.click('[data-cm-accomp-niveau="detail"]');
      await pgB.waitForFunction(() => document.querySelector('[data-cm-accomp-niveau="detail"]')?.checked, null, { timeout: 5000 });
      for (let i = 0; i < 30 && !(B.partages[Bu] && B.partages[Bu].detail); i++) await pgB.waitForTimeout(200);
      dit(!!(B.partages[Bu] && B.partages[Bu].detail && B.partages[Bu].detail.ventes.length === 1), 'au niveau « détail », son app publie le détail');
      await recharger(pgA); await aller(pgA);
      await pgA.click('[data-cm-accomp-voir-membre]');
      await pgA.waitForSelector('[data-cm-accomp-detail]', { timeout: 5000 });
      dit(/Paire inventée du banc 42/.test(await texte(pgA)) && /Achat inventé du banc/.test(await texte(pgA)), 'le créateur voit les articles, prix et comptes');
      await capture(pgA, '6-detail-1512-sombre');
      await pgA.click('.vrm-cm-feuille .vrm-cm-x');
      await pgB.click('[data-cm-accomp-niveau="rien"]');
      await pgB.waitForFunction(() => document.querySelector('[data-cm-accomp-niveau="rien"]')?.checked, null, { timeout: 5000 });
      await pgB.waitForTimeout(400);
      dit(B.partages[Bu] && B.partages[Bu].chiffres == null && B.partages[Bu].detail == null, 'revenir à « rien » : chiffres et détail EFFACÉS côté base', JSON.stringify(B.partages[Bu]).slice(0, 120));
      await recharger(pgA); await aller(pgA);
      await pgA.click('[data-cm-accomp-voir-membre]');
      await pgA.waitForSelector('[data-cm-accomp-vue]', { timeout: 5000 });
      dit(await attr(pgA, '[data-cm-accomp-vue]', 'data-cm-accomp-vue') === 'rien' && !/Paire inventée/.test(await texte(pgA)), 'le créateur ne voit plus rien');
      await pgA.click('.vrm-cm-feuille .vrm-cm-x');
    });

    console.log('\n── Alice retire Bruno');
    await essaie('retirer', async () => {
      pgA.once('dialog', (d) => d.accept());
      await pgA.click('[data-cm-accomp-retirer]');
      await pgA.waitForSelector('[data-cm-accomp-aucun-membre]', { timeout: 5000 });
      dit(B.membres[0].statut === 'retire', 'Retirer ⇒ il n’est plus membre');
      await recharger(pgB); await aller(pgB);
      dit(await attr(pgB, '[data-cm-accomp-rejoint]', 'data-statut') === 'retire' && /Retiré par le créateur/.test(await texte(pgB)), 'Bruno le voit (« Retiré par le créateur »)');
      const restes = await pgB.$$eval('[data-cm-accomp-niveau]', (e) => e.map((x) => (x.closest('[data-cm-accomp-rejoint],[data-cm-accomp-feuille]') || {}).outerHTML?.slice(0, 160)));
      dit(restes.length === 0, 'et ne peut plus rien partager', JSON.stringify(restes));
      await capture(pgB, '8-retire-390-sombre');
    });

    console.log('\n── 390 px clair · Alice au téléphone');
    await essaie('créateur au téléphone', async () => {
      const { ctx, pg, erreurs } = await ouvrir(nav, { qui: A, largeur: 390 });
      await aller(pg);
      dit(!!(await pg.$('[data-cm-accomp-cree]')), 'son groupe s’affiche');
      const pc = await cibles(pg);
      dit(pc.length === 0, 'cibles de 44 px', JSON.stringify(pc));
      dit(await deborde(pg) <= 0, 'aucun débordement à 390 px', await deborde(pg));
      dit(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | '));
      await capture(pg, '7-createur-390-clair');
      await ctx.close();
    });

    console.log('\n── Confidentialité');
    await essaie('secrets', async () => {
      const versA = B.reponses.filter((r) => r.qui === A).map((r) => r.body).join(' ');
      const versB = B.reponses.filter((r) => r.qui === Bu).map((r) => r.body).join(' ');
      dit(secretsDans(versA, Bu).length === 0, 'aucune réponse à Alice ne porte le compte, l’email ou le login de Bruno', secretsDans(versA, Bu).join(' '));
      dit(secretsDans(versB, A).length === 0, 'aucune réponse à Bruno ne porte le compte, l’email ou le login d’Alice', secretsDans(versB, A).join(' '));
    });
    if (ctxA) await ctxA.close(); if (ctxB) await ctxB.close();
  } finally {
    await nav.close(); srv.close();
  }
  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
