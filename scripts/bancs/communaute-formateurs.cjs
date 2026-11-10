require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « COMMUNAUTÉ → L'ESPACE FORMATEUR » (lot AR, 10 nov., migration 032),
//  posé sur les groupes d'accompagnement (025). RENDU 1512 / 390 tactile, clair et sombre,
//  ET la page publique vrm.center/f/<adresse> (public/formateur.html + .js, SANS session).
//  BANC_PORT=… CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/bancs/communaute-formateurs.cjs
//  Ce que le banc juge (en plus du socle de communaute-groupes.cjs, dont il reprend le faux) :
//   · base sans la 032 ⇒ dit, rien proposé ; page créée PAS en ligne, publiée sur SON geste ;
//   · groupe montré sur la page seulement sur SON geste ; la page publique se lit sans compte,
//     page retirée ⇒ « introuvable » ; « Demander à rejoindre » ⇒ demande « attente », « rien » ;
//   · suivi : un élève qui ne partage pas ⇒ « Ne partage pas », total « — » (jamais 0) ;
//     étapes « privées » sans SON accord, visibles avec, re-privées dès qu'il le retire ;
//   · aucune donnée d'un autre compte dans les réponses ; 44 px ; aucun débordement.
//  ── Le socle (repris de communaute-groupes.cjs) ──
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
const PORT = Number(process.env.BANC_PORT || 7991);
const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const MUTATION = process.env.BANC_MUTATION || '';
const CAPTURES = process.env.CAPTURES || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d && !c ? ' — ' + String(d).slice(0, 220) : '')); };
let PAGES_OUVERTES = [];
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).split('\n')[0].slice(0, 200)); if (CAPTURES) for (const [i, p] of PAGES_OUVERTES.entries()) await p.screenshot({ path: path.join(CAPTURES, 'echec-' + nom.replace(/\W+/g, '-') + '-' + i + '.png') }).catch(() => {}); } };

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
  if (fn.startsWith('vrm_form_')) return rpcForm(fn, a, uid);
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
    if (!uid && fn !== 'vrm_form_page') return json({ message: 'permission denied' }, 401);
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
  let f = q.url.split('?')[0]; if (/^\/f\/[a-z0-9-]+$/.test(f)) f = '/formateur.html'; else if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

let compte = null;
async function ouvrir(nav, { qui, largeur = 1512, sombre = false, chemin = '/?tab=communaute', local = {} }) {
  const mobile = largeur < 600;
  const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${PORT}` }).catch(() => {});
  const pg = await ctx.newPage(); PAGES_OUVERTES.push(pg);
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript(({ s, sombre, local }) => {
    try { localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_bascule_mineral_v1', '1'); localStorage.setItem('vrm_session', JSON.stringify(s)); /* vendeur déjà configuré : « Ma configuration » ne couvre pas l'écran */ localStorage.setItem('vrm_configuration', JSON.stringify({ etat: 'fait', at: '2026-11-01T10:00:00.000Z', statut: null, version: 1 })); } catch (_) {}
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


// ── (lot AR) Les RÈGLES de la 032, en JS (prouvées sur un vrai Postgres par audit-formateurs-sql.cjs) ──
let F;
const resetForm = (installe = true) => { F = { installe, pages: {}, vitrine: {}, etapes: [], progres: {}, accords: {}, annonces: [] }; };
resetForm(false);
const accepte = (id) => B.membres.find((m) => m.id === id && m.statut === 'accepte' && !gDe(m.groupe).ferme);
const etapesDe = (g) => F.etapes.filter((e) => e.groupe === g && !e.retiree).map((e) => ({ id: e.id, titre: e.titre, ordre: e.ordre }));
const annoncesDe = (g) => F.annonces.filter((x) => x.groupe === g && !x.retiree).sort((a, b) => b.n - a.n).map((x) => ({ id: x.id, texte: x.texte, le: x.le }));
const faitsDe = (m) => Object.entries(F.progres[m] || {}).filter(([e, f]) => f && F.etapes.some((x) => x.id === e && !x.retiree)).map(([e]) => e);
const pageDe = (a) => Object.entries(F.pages).find(([, p]) => p.adresse === a);
function rpcForm(fn, a, uid) {
  if (!F.installe) return undefined;
  const now = new Date().toISOString();
  if (fn === 'vrm_form_page') {
    const x = pageDe(String(a.p_adresse || '').toLowerCase());
    if (!x || !x[1].publiee) return { ok: false, raison: 'page' };
    const [owner, p] = x;
    return { ok: true, adresse: p.adresse, nom: p.nom, presentation: p.presentation,
      groupes: B.groupes.filter((g) => g.cree_par === owner && !g.ferme && F.vitrine[g.id]).map((g) => ({ id: g.id, nom: g.nom, description: g.description })) };
  }
  if (!uid) return undefined;
  if (fn === 'vrm_form_lire') return { acces: true, page: F.pages[uid] ? { ...F.pages[uid] } : null,
    crees: B.groupes.filter((g) => g.cree_par === uid && !g.ferme).map((g) => ({ groupe: g.id, vitrine: !!F.vitrine[g.id], etapes: etapesDe(g.id), annonces: annoncesDe(g.id),
      progres: B.membres.filter((m) => m.groupe === g.id && m.statut === 'accepte').map((m) => (F.accords[m.id] || MUTATION === 'progres-sans-accord') ? { membre: m.id, faits: faitsDe(m.id) } : { membre: m.id }) })),
    rejoints: B.membres.filter((m) => m.owner === uid && m.statut === 'accepte' && !gDe(m.groupe).ferme).map((m) => ({ adhesion: m.id, groupe: m.groupe, accord: !!F.accords[m.id], etapes: etapesDe(m.groupe), annonces: annoncesDe(m.groupe), faits: faitsDe(m.id) })) };
  if (fn === 'vrm_form_page_ranger') {
    const pris = pageDe(a.p_adresse); if (pris && pris[0] !== uid) return { ok: false, raison: 'adresse-prise' };
    F.pages[uid] = { adresse: a.p_adresse, nom: a.p_nom, presentation: a.p_presentation, publiee: a.p_publiee === true, maj_le: now };
    return { ok: true, adresse: a.p_adresse, publiee: a.p_publiee === true };
  }
  const monG = (g) => { const x = gDe(g); return x && x.cree_par === uid && !x.ferme; };
  if (fn === 'vrm_form_vitrine_regler') { if (!monG(a.p_groupe)) return { ok: false, raison: 'pas-createur' }; F.vitrine[a.p_groupe] = a.p_montre === true; return { ok: true, montre: a.p_montre === true }; }
  if (fn === 'vrm_form_demander') {
    const x = pageDe(a.p_adresse); const g = gDe(a.p_groupe);
    if (!x || !x[1].publiee || !g || g.cree_par !== x[0] || g.ferme || !F.vitrine[g.id]) return { ok: false, raison: 'page' };
    return rpc('vrm_accomp_demander', { p_code: g.code, p_nom: a.p_nom, p_partage: a.p_partage || 'rien' }, uid);
  }
  if (fn === 'vrm_form_etape') { if (!monG(a.p_groupe)) return { ok: false, raison: 'pas-createur' }; const e = { id: uuid(), groupe: a.p_groupe, titre: a.p_titre, ordre: F.etapes.length + 1 }; F.etapes.push(e); return { ok: true, id: e.id }; }
  if (fn === 'vrm_form_etape_retirer') { const e = F.etapes.find((x) => x.id === a.p_etape); if (!e || !monG(e.groupe)) return { ok: false, raison: 'pas-createur' }; e.retiree = true; return { ok: true }; }
  if (fn === 'vrm_form_annonce') { if (!monG(a.p_groupe)) return { ok: false, raison: 'pas-createur' }; const x = { id: uuid(), groupe: a.p_groupe, texte: a.p_texte, le: now, n: B.n }; F.annonces.push(x); return { ok: true, id: x.id }; }
  if (fn === 'vrm_form_annonce_retirer') { const x = F.annonces.find((y) => y.id === a.p_annonce); if (!x || !monG(x.groupe)) return { ok: false, raison: 'pas-createur' }; x.retiree = true; return { ok: true }; }
  if (fn === 'vrm_form_cocher') { const m = accepte(a.p_adhesion); if (!m || m.owner !== uid) return { ok: false, raison: 'adhesion' }; (F.progres[m.id] = F.progres[m.id] || {})[a.p_etape] = a.p_fait === true; return { ok: true, fait: a.p_fait === true }; }
  if (fn === 'vrm_form_accord') { const m = B.membres.find((x) => x.id === a.p_adhesion && x.owner === uid); if (!m) return { ok: false, raison: 'adhesion' }; F.accords[m.id] = a.p_etapes === true; return { ok: true, etapes: a.p_etapes === true }; }
  return undefined;
}

(async () => {
  try { compte = (await import('file://' + path.join(RACINE, 'api', 'compte.js'))).default; }
  catch (e) { console.log('❌ api/compte.js ne se charge pas : ' + e.message); process.exit(1); }
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  if (MUTATION) console.log(`(mutation « ${MUTATION} »)`);
  const LOCAL_B = { vrm_benefice_jours: VENTES_B, vrm_achats_jours: ACHATS_B };
  const publique = async (largeur, sombre, chemin) => {
    const mobile = largeur < 600;
    const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light', serviceWorkers: 'block' });
    const pg = await ctx.newPage(); const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
    await pg.route('**/api/**', async (r) => {
      const u = new URL(r.request().url());
      const res = { code: 200, corps: null, setHeader() {}, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, end() { return this; } };
      const req = { method: 'GET', query: Object.fromEntries(u.searchParams), headers: {}, [Symbol.asyncIterator]() { return (async function* () {})(); } };
      await compte(req, res);
      B.reponses.push({ qui: 'anon', action: 'page', body: JSON.stringify(res.corps) });
      return r.fulfill({ status: res.code, contentType: 'application/json', body: JSON.stringify(res.corps) });
    });
    await pg.goto(`http://localhost:${PORT}${chemin}`, { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => document.querySelector('main')?.getAttribute('data-formateur-etat') !== 'chargement', null, { timeout: 10000 }).catch(() => {});
    return { ctx, pg, erreurs };
  };
  const ongletForm = async (pg, k) => { await pg.click(`[data-form-onglet="${k}"]`); await pg.waitForTimeout(200); };
  try {
    console.log('\n── Base AVEC la 025, SANS la 032 · 1512 clair');
    reset(true); resetForm(false);
    await essaie('032 absente', async () => {
      const { ctx, pg, erreurs } = await ouvrir(nav, { qui: A });
      await aller(pg);
      await pg.waitForSelector('[data-form-etat]', { timeout: 8000 }).catch(() => {});
      dit(await attr(pg, '[data-form-etat]', 'data-form-etat') === 'non-installe', 'sans la 032 : « Espace formateur : pas encore activé » (dit, rien promis)');
      dit(!(await pg.$('[data-form-page]')) && !(await pg.$('[data-form-groupe]')), 'aucune page, aucun outil proposé');
      dit(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | '));
      await ctx.close();
    });

    reset(true); resetForm(true);
    const g0 = rpc('vrm_accomp_creer', { p_nom: 'Formation Sneakers', p_description: 'Revendre des sneakers, pas à pas.', p_createur: 'Coach Alice' }, A);
    let G = g0.id;
    console.log('\n── 1512 clair · Alice crée sa page');
    let ctxA, pgA;
    await essaie('créer la page', async () => {
      const o = await ouvrir(nav, { qui: A }); ctxA = o.ctx; pgA = o.pg;
      await aller(pgA);
      await pgA.waitForSelector('[data-form-page]', { timeout: 8000 });
      dit(await attr(pgA, '[data-form-page]', 'data-form-page') === 'aucune', 'pas encore de page : « Créer ma page »');
      await pgA.click('[data-form-page-creer]');
      await pgA.fill('[data-form-nom]', 'Coach Alice');
      dit(await pgA.$eval('[data-form-adresse]', (e) => e.value) === 'coach-alice', 'l’adresse est PROPOSÉE depuis le nom');
      await pgA.fill('[data-form-presentation]', 'Je forme des revendeurs depuis 2022.');
      await capture(pgA, '1-page-feuille-1512-clair');
      await pgA.click('[data-form-page-valider]');
      await pgA.waitForSelector('[data-form-page="brouillon"]', { timeout: 8000 });
      dit(F.pages[A] && F.pages[A].publiee === false, 'la page est rangée PAS en ligne (son geste pour publier)');
      await pgA.click('[data-form-page-publier="publier"]');
      await pgA.waitForSelector('[data-form-page="publiee"]', { timeout: 8000 });
      dit(F.pages[A].publiee === true, '« Mettre en ligne » la publie');
      dit(await attr(pgA, '[data-form-vitrine]', 'data-form-vitrine') === 'non', 'le groupe n’est PAS sur la page par défaut');
      await pgA.click('[data-form-vitrine] input');
      await pgA.waitForSelector('[data-form-vitrine="oui"]', { timeout: 8000 });
      dit(F.vitrine[G] === true, '« Sur ma page publique » le montre');
      await capture(pgA, '2-createur-1512-clair');
      // (1512, souris : les segments font 36 px comme Carte/Classement/Groupes ; au doigt, 44 — jugé à 390.)
      const pc = (await cibles(pgA)).filter((x) => !['Carte', 'Classement', 'Groupes', 'Suivi', 'Programme', 'Annonces'].includes(x.t)); dit(pc.length === 0, 'cibles de 44 px (hors segments à la souris)', JSON.stringify(pc));
    });

    console.log('\n── La page publique, SANS compte');
    for (const [l, s, nom] of [[1512, false, '3-page-publique-1512-clair'], [390, true, '3-page-publique-390-sombre']]) {
      await essaie('page publique ' + l, async () => {
        const { ctx, pg, erreurs } = await publique(l, s, '/f/coach-alice');
        dit(await attr(pg, 'main', 'data-formateur-etat') === 'lu', `[${l}] la page se lit sans compte`, await attr(pg, 'main', 'data-formateur-etat'));
        const t = await texte(pg);
        dit(/Coach Alice/.test(t) && /depuis 2022/.test(t) && /Formation Sneakers/.test(t), `[${l}] nom, présentation, groupe montré`);
        const href = await attr(pg, '[data-formateur-rejoindre]', 'href');
        dit(href === `/?tab=communaute&formateur=coach-alice&g=${G}`, `[${l}] « Demander à rejoindre » ouvre VRM sur CE groupe`, href);
        const h = await pg.$eval('[data-formateur-rejoindre]', (e) => e.getBoundingClientRect().height);
        dit(h >= 44, `[${l}] bouton de 44 px`, h);
        dit(await deborde(pg) <= 0, `[${l}] aucun débordement`, await deborde(pg));
        dit(erreurs.length === 0, `[${l}] aucune erreur de page`, erreurs.join(' | '));
        await capture(pg, nom);
        await ctx.close();
      });
    }
    await essaie('page retirée', async () => {
      F.pages[A].publiee = false;
      const { ctx, pg } = await publique(1512, false, '/f/coach-alice');
      dit(await attr(pg, 'main', 'data-formateur-etat') === 'introuvable' && !/Formation Sneakers/.test(await texte(pg)), 'pas en ligne ⇒ « Page introuvable », rien de montré');
      F.pages[A].publiee = true;
      await ctx.close();
    });

    console.log('\n── 390 tactile sombre · Bruno suit le lien de la page');
    let ctxB, pgB;
    await essaie('rejoindre', async () => {
      const o = await ouvrir(nav, { qui: Bu, largeur: 390, sombre: true, chemin: `/?tab=communaute&formateur=coach-alice&g=${G}`, local: LOCAL_B }); ctxB = o.ctx; pgB = o.pg;
      await pgB.waitForSelector('[data-form-rejoindre]', { timeout: 10000 });
      dit(await attr(pgB, '[data-form-rejoindre]', 'data-form-rejoindre') === G, 'la feuille montre le groupe de la page');
      dit(await pgB.$eval('[data-cm-accomp-niveau="rien"]', (e) => e.checked), 'partage « Rien » coché par défaut');
      await capture(pgB, '4-rejoindre-390-sombre');
      await pgB.fill('[data-cm-accomp-moi]', 'Bruno élève');
      await pgB.click('[data-form-demander]');
      await pgB.waitForSelector('[data-cm-accomp-rejoint]', { timeout: 8000 });
      const m = B.membres[0];
      dit(m && m.statut === 'attente' && m.partage === 'rien', 'demande « en attente », partage « rien »', JSON.stringify(m));
      dit(!(await pgB.$('[data-form-eleve-groupe]')), 'en attente : ni programme ni annonce');
    });

    console.log('\n── Alice valide, écrit le programme et une annonce (1512 sombre)');
    await essaie('programme', async () => {
      rpc('vrm_accomp_decider', { p_membre: B.membres[0].id, p_oui: true }, A);
      await ctxA.close();
      const o = await ouvrir(nav, { qui: A, sombre: true }); ctxA = o.ctx; pgA = o.pg;
      await aller(pgA); await pgA.waitForSelector('[data-form-groupe]', { timeout: 8000 });
      await ongletForm(pgA, 'programme');
      for (const t of ['Installer l’extension', 'Première vente']) { await pgA.fill('[data-form-etape-titre]', t); await pgA.click('[data-form-etape-ajouter]'); await pgA.waitForFunction((n) => document.querySelectorAll('[data-form-etape]').length === n, F.etapes.length, { timeout: 8000 }); }
      dit(F.etapes.length === 2, 'deux étapes au programme');
      await ongletForm(pgA, 'annonces');
      await pgA.fill('[data-form-annonce-texte]', 'Live jeudi 20 h : les prix de fin d’année.');
      await pgA.click('[data-form-annonce-envoyer]');
      await pgA.waitForSelector('[data-form-annonce]', { timeout: 8000 });
      dit(F.annonces.length === 1, 'annonce publiée');
      await ongletForm(pgA, 'suivi');
      const l = `[data-form-eleve="${B.membres[0].id}"]`;
      dit(await attr(pgA, l, 'data-chiffres') === 'prive' && /Ne partage pas/.test(await pgA.$eval(l, (e) => e.innerText)), 'Bruno ne partage rien : « Ne partage pas », aucun chiffre');
      dit(await attr(pgA, l, 'data-etapes') === 'prive', 'sans son accord : « Étapes privées »');
      dit(await attr(pgA, '[data-form-total-ventes]', 'data-form-total-ventes') === '' && await attr(pgA, '[data-form-couverture]', 'data-form-couverture') === '0/1', 'total « — » · 0 élève sur 1 partage (jamais 0 vente)');
      await capture(pgA, '5-suivi-prive-1512-sombre');
    });

    console.log('\n── Bruno coche, donne son accord, partage ses chiffres (390 sombre)');
    await essaie('élève', async () => {
      await recharger(pgB); await aller(pgB);
      await pgB.waitForSelector('[data-form-eleve-groupe]', { timeout: 8000 });
      dit(/Live jeudi 20 h/.test(await texte(pgB)), 'il lit l’annonce');
      dit(await attr(pgB, '[data-form-accord]', 'data-form-accord') === 'non', 'son accord est NON par défaut');
      await pgB.click(`[data-form-cocher="${F.etapes[0].id}"]`);
      await pgB.waitForSelector('[data-form-eleve-programme="1/2"]', { timeout: 8000 });
      await pgB.click('[data-form-accord] input');
      await pgB.waitForSelector('[data-form-accord="oui"]', { timeout: 8000 });
      await pgB.click('[data-cm-accomp-niveau="chiffres"]');
      for (let i = 0; i < 30 && !(B.partages[Bu] && B.partages[Bu].chiffres); i++) await pgB.waitForTimeout(200);
      dit(!!(B.partages[Bu] && B.partages[Bu].chiffres), 'ses chiffres partent (règle de la 025)');
      const pc = await cibles(pgB); dit(pc.length === 0, 'cibles de 44 px', JSON.stringify(pc));
      dit(await deborde(pgB) <= 0, 'aucun débordement à 390 px', await deborde(pgB));
      await capture(pgB, '6-eleve-390-sombre');
    });

    console.log('\n── Alice voit ce que Bruno a accepté (390 clair)');
    await essaie('suivi', async () => {
      const { ctx, pg, erreurs } = await ouvrir(nav, { qui: A, largeur: 390 });
      await aller(pg); await pg.waitForSelector('[data-form-groupe]', { timeout: 8000 });
      const l = `[data-form-eleve="${B.membres[0].id}"]`;
      dit(await attr(pg, l, 'data-etapes') === 'lu' && await attr(pg, `${l} [data-form-faits]`, 'data-form-faits') === '1', 'avec son accord : 1/2 étapes');
      dit(await attr(pg, l, 'data-chiffres') === 'lu' && await attr(pg, '[data-form-total-ventes]', 'data-form-total-ventes') === String(VENTES_MOIS), `ses ventes du mois (${VENTES_MOIS}), 1 élève sur 1`, await attr(pg, '[data-form-total-ventes]', 'data-form-total-ventes'));
      const pc = await cibles(pg); dit(pc.length === 0, 'cibles de 44 px', JSON.stringify(pc));
      dit(await deborde(pg) <= 0, 'aucun débordement à 390 px', await deborde(pg));
      dit(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | '));
      await capture(pg, '7-suivi-390-clair');
      await ctx.close();
    });
    await essaie('accord retiré', async () => {
      await pgB.click('[data-form-accord] input');
      await pgB.waitForSelector('[data-form-accord="non"]', { timeout: 8000 });
      await recharger(pgA); await aller(pgA); await pgA.waitForSelector('[data-form-groupe]', { timeout: 8000 });
      dit(await attr(pgA, `[data-form-eleve="${B.membres[0].id}"]`, 'data-etapes') === 'prive', 'accord retiré ⇒ « Étapes privées » tout de suite');
    });

    console.log('\n── Confidentialité');
    await essaie('secrets', async () => {
      const versA = B.reponses.filter((r) => r.qui === A || r.qui === 'anon').map((r) => r.body).join(' ');
      const versB = B.reponses.filter((r) => r.qui === Bu).map((r) => r.body).join(' ');
      dit(secretsDans(versA, Bu).length === 0, 'rien du compte de Bruno chez Alice ni sur la page publique', secretsDans(versA, Bu).join(' '));
      dit(secretsDans(versB, A).length === 0, 'rien du compte d’Alice chez Bruno', secretsDans(versB, A).join(' '));
      const pub = B.reponses.filter((r) => r.qui === 'anon').map((r) => r.body).join(' ');
      dit(!pub.includes(A) && !/"code"|owner|email/.test(pub), 'la page publique ne porte ni compte, ni code, ni email');
    });
    if (ctxA) await ctxA.close(); if (ctxB) await ctxB.close();
  } finally {
    await nav.close(); srv.close();
  }
  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
