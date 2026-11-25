// ════════════════════════════════════════════════════════════════════════════
//  MISE À JOUR SANS RELANCER (25 nov. 2026) — Julien : « ça doit se mettre à jour
//  tout seul car je dois fermer l'app et la rouvrir pour avoir les nouvelles
//  infos » ; « elle doit se mettre à jour si elle reçoit un mail ou que quelque
//  chose se met à jour sur Vinted ». Il se sert de VRM surtout en app de l'écran
//  d'accueil de l'iPhone : la page reste en mémoire, gelée en arrière-plan.
//
//  La page Ventes est ouverte (390 px tactile, base inventée de `vitesse.cjs`), au
//  calme. Le banc tient AUSSI la prise Supabase Realtime (`routeWebSocket`) : il
//  répond à la jonction du sujet privé `vrm-lignes:<uid>` et, quand il écrit une
//  ligne, il diffuse ce qu'enverrait le déclencheur de la migration 040 (l'id et la
//  VERSION, jamais la ligne). Rien n'est rechargé. On juge :
//    1. VINTED : une vente neuve dans `harvest_{uid}_orders_sold` (ce qu'écrit
//       l'extension) ⇒ à l'écran ;
//    2. E-MAIL : le bordereau `email_bord_{tx}` de cette vente (ce qu'écrit
//       api/email-inbound.js) ⇒ la vente passe « à imprimer » à l'écran ;
//    3. IPHONE, RETOUR AU PREMIER PLAN : la page est cachée, sa prise Realtime coupée
//       (iOS gèle l'app ; le réseau la refuse tant qu'elle est cachée), une vente
//       arrive pendant 40 s d'absence, la page revient ⇒ la vente doit être là en
//       quelques secondes ;
//    4. SANS REALTIME (prise refusée) : une vente arrive, page visible ⇒ à l'écran
//       par la seule sonde des versions.
//  Mesuré aussi, page ouverte et laissée tranquille : lectures et octets par minute.
//  Rouge si une des quatre n'est pas à l'écran à temps (`MAJ_DELAI_MS`, 30 s ; le
//  retour au premier plan : `MAJ_RETOUR_MS`, 10 s).
//
//  Lancer : npm run build && NODE_OPTIONS=--require=./scripts/bancs/_garde-reseau.cjs \
//             node scripts/bancs/mise-a-jour-auto.cjs
//  Autres : `VITESSE_DIST=dossier` (le code d'avant : il doit être rouge) ·
//  `MAJ_REPOS_MS` (120 s) · `MAJ_JSON=fichier` · `MAJ_DETAIL=1` (les lectures au repos).
// ════════════════════════════════════════════════════════════════════════════
if (!process.env.VITESSE_CPU) process.env.VITESSE_CPU = '1';
const fs = require('fs');
const V = require('./vitesse.cjs');
const DELAI = Number(process.env.MAJ_DELAI_MS) || 30000;
const DELAI_RETOUR = Number(process.env.MAJ_RETOUR_MS) || 10000;
const REPOS_MS = Number(process.env.MAJ_REPOS_MS) || 120000;

// ── La base : ce qu'écrivent l'extension et la route des e-mails ──────────────
const ligneVentes = () => V.base.rows.find((r) => /_orders_sold$/.test(r.id));
function nouvelleVente(titre, tx) {
  const r = ligneVentes();
  const p = r.data.payload;
  const v = { ...p.my_orders[0], transaction_id: tx, item_id: tx + 5, title: titre, status: 'Bordereau d\'envoi envoyé à l\'acheteur', transaction_user_status: 'needs_action', date: new Date().toISOString(), price: { amount: '77.0', currency_code: 'EUR' } };
  // Une nouvelle capture ENTIÈRE (comme l'extension) : la liste + 1, l'heure de maintenant.
  r.data = { ...r.data, capturedAt: new Date().toISOString(), nItems: (r.data.nItems || p.my_orders.length) + 1, payload: { ...p, my_orders: [v, ...p.my_orders] } };
  return r;
}
function bordereauEmail(tx) {
  const modele = V.base.rows.find((r) => /^email_bord_/.test(r.id));
  const r = { id: `email_bord_${tx}`, updated_at: new Date().toISOString(), data: { ...modele.data, transaction: String(tx), filename: `bordereau-${tx}.pdf`, receivedAt: new Date().toISOString(), suivi: 'XW' + tx, numero: String(tx).slice(-3) } };
  V.base.rows.push(r);
  return r;
}

// ── La prise Realtime simulée (le serveur de Supabase avec la migration 040) ──
const RT = { ws: null, accepte: true, sujet: null, joints: 0 };
function diffuser(row) {
  if (!RT.ws || !RT.sujet) return false;
  const uid = RT.sujet.replace(/^realtime:vrm-lignes:/, '');
  const d = row.data || {};
  const payload = { id: row.id, owner: uid, updated_at: row.updated_at || null, cap: d.capturedAt || null, rev: d.rev != null ? String(d.rev) : null, sup: null, pg: null };
  try { RT.ws.send(JSON.stringify({ topic: RT.sujet, event: 'broadcast', payload: { type: 'broadcast', event: 'ligne', payload } })); return true; } catch (_) { return false; }
}
function couperPrise() { const w = RT.ws; RT.ws = null; try { if (w) w.close({ code: 4000, reason: 'banc' }); } catch (_) {} }
async function poserRealtime(pg) {
  await pg.route(/\/rest\/v1\/rpc\/vrm_temps_reel/, (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: 'true' }));
  await pg.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
    if (!RT.accepte) { ws.close({ code: 4001, reason: 'refusée' }); return; }
    RT.ws = ws;
    ws.onMessage((m) => {
      let o = null; try { o = JSON.parse(String(m)); } catch (_) { return; }
      if (o.event === 'phx_join') { RT.sujet = o.topic; RT.joints++; ws.send(JSON.stringify({ topic: o.topic, event: 'phx_reply', ref: o.ref, join_ref: o.join_ref, payload: { status: 'ok', response: {} } })); }
      else if (o.topic === 'phoenix' && o.event === 'heartbeat') ws.send(JSON.stringify({ topic: 'phoenix', event: 'phx_reply', ref: o.ref, payload: { status: 'ok', response: {} } }));
    });
    ws.onClose(() => { if (RT.ws === ws) RT.ws = null; });
  });
}

// ── La page ───────────────────────────────────────────────────────────────────
async function attendre(pg, fn, arg, ms) {
  const t0 = Date.now();
  try { await pg.waitForFunction(fn, arg, { timeout: ms, polling: 200 }); return Date.now() - t0; } catch (_) { return null; }
}
const venteVue = (titre) => new RegExp(titre).test(document.body.innerText);
// La vente est « à imprimer » : sa rangée porte un geste d'impression (`data-imprime`) ou le dit.
const venteAImprimer = (titre) => [...document.querySelectorAll('*')].some((e) => e.children.length === 0 && new RegExp(titre).test(e.textContent)
  && (() => { let p = e; for (let i = 0; i < 8 && p; i++, p = p.parentElement) { if (p.querySelector && (p.querySelector('[data-imprime]') || /imprimer|prêt à imprimer|bordereau prêt/i.test(p.textContent || ''))) return !/en attente du bordereau/i.test(p.textContent || ''); } return false; })());
async function cacher(pg, cache) {
  await pg.evaluate((c) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (c ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => c });
    document.dispatchEvent(new Event('visibilitychange'));
    if (!c) window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  }, cache);
}

(async () => {
  await V.demarrer();
  const b = await V.chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const res = {};
  let repos = null;
  const r = await V.ouvrir(b, { width: 390, height: 844 }, 'ventes', () => /vente/i.test(document.body.innerText), null, {
    avantGoto: poserRealtime,
    apres: async (pg) => {
      await pg.evaluate(() => { window.__majNeuf = []; window.addEventListener('vrm:neuf', (e) => window.__majNeuf.push((e.detail && e.detail.ids) || [])); });
      res.veille = await pg.evaluate(() => !!window.__vrmVeille);
      res.prise = await pg.evaluate(() => document.documentElement.getAttribute('data-temps-reel'));
      // 0. Au repos : la page ouverte, visible, personne n'y touche (ce que coûte la mise à jour).
      repos = [Date.now(), null];
      await pg.waitForTimeout(REPOS_MS);
      repos[1] = Date.now();
      // 1. Vinted (Realtime joint).
      diffuser(nouvelleVente('Zebulon Neuve Banc', 23999000001));
      res.vinted = await attendre(pg, venteVue, 'Zebulon Neuve Banc', DELAI);
      if (process.env.MAJ_DOM) fs.writeFileSync(process.env.MAJ_DOM, await pg.evaluate(() => { const l = [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && /Zebulon Neuve Banc/.test(e.textContent)).pop(); let p = l; for (let i = 0; i < 6 && p && p.parentElement; i++) p = p.parentElement; return p ? p.outerHTML : 'rien'; }).catch(() => 'rien'));
      // 2. E-mail : le bordereau de cette vente.
      res.emailAvant = await pg.evaluate(venteAImprimer, 'Zebulon Neuve Banc');
      diffuser(bordereauEmail(23999000001));
      res.email = await attendre(pg, venteAImprimer, 'Zebulon Neuve Banc', DELAI);
      // 3. iPhone : caché, prise coupée et refusée pendant l'absence, une vente arrive, retour.
      await cacher(pg, true);
      RT.accepte = false; couperPrise();
      await pg.waitForTimeout(3000);
      nouvelleVente('Yvonne Cachee Banc', 23999000002);
      await pg.waitForTimeout(40000);
      res.cacheVu = await pg.evaluate(venteVue, 'Yvonne Cachee Banc');
      RT.accepte = true;
      await cacher(pg, false);
      res.retour = await attendre(pg, venteVue, 'Yvonne Cachee Banc', Math.max(DELAI_RETOUR, 20000));
      // 4. Sans Realtime : la prise est refusée, page visible.
      await pg.waitForTimeout(3000);
      RT.accepte = false; couperPrise();
      await pg.waitForTimeout(5000);
      nouvelleVente('Xavier Sonde Banc', 23999000003);
      res.sonde = await attendre(pg, venteVue, 'Xavier Sonde Banc', DELAI);
      res.signaux = await pg.evaluate(() => window.__majNeuf.map((x) => x.join(' ')));
      return res;
    },
  });
  await b.close(); await V.fermer();
  const gets = r.req.filter((x) => x.m === 'GET');
  const enRepos = repos ? gets.filter((x) => x.debutAbs >= repos[0] && x.debutAbs < repos[1]) : [];
  const minutes = repos ? (repos[1] - repos[0]) / 60000 : 1;
  const parMin = enRepos.length / minutes, koParMin = enRepos.reduce((a, x) => a + x.octets, 0) / 1024 / minutes;
  const q = r.apres || {};
  console.log('MISE À JOUR SANS RELANCER — Ventes, 390 px');
  console.log(`  veille : ${q.veille ? 'en marche' : 'ABSENTE'} · prise Realtime : ${q.prise || '—'} (${RT.joints} jonction(s))`);
  console.log(`  au repos (${(Math.round(minutes * 10) / 10)} min, page visible) : ${parMin.toFixed(1)} lectures/min · ${koParMin.toFixed(1)} Ko/min`);
  if (process.env.MAJ_DETAIL) {
    const parAdr = new Map(); for (const x of enRepos) { const k = decodeURIComponent(x.url.replace(/^.*\/rest\/v1\//, '')).replace(/"[^"]*"/g, '"…"').slice(0, 150); const e = parAdr.get(k) || [0, 0]; e[0]++; e[1] += x.octets; parAdr.set(k, e); }
    for (const [k, [n, o]] of [...parAdr].sort((a, b) => b[1][0] - a[1][0])) console.log(`     ×${n} ${o} o  ${k}`);
  }
  let ko = 0;
  const s = (ms) => (ms / 1000).toFixed(1) + ' s';
  const dit = (ok, m) => { if (!ok) ko++; console.log((ok ? '  ✅ ' : '  ❌ ') + m); };
  dit(q.vinted != null, `1. Vinted (vente captée, Realtime) : ${q.vinted != null ? 'à l\'écran en ' + s(q.vinted) : 'pas à l\'écran en ' + s(DELAI)}`);
  dit(q.email != null && !q.emailAvant, `2. E-mail (bordereau rangé, Realtime) : ${q.emailAvant ? 'déjà « à imprimer » AVANT le bordereau (le banc ne mesure rien)' : q.email != null ? 'vente « à imprimer » en ' + s(q.email) : 'pas à l\'écran en ' + s(DELAI)}`);
  dit(q.retour != null && q.retour <= DELAI_RETOUR, `3. iPhone, retour au premier plan après 40 s (prise coupée) : ${q.retour != null ? 'vente vue ' + s(q.retour) + ' après le retour' : 'pas vue'}${q.cacheVu ? ' (déjà là pendant que la page était cachée)' : ''}`);
  dit(q.sonde != null, `4. Sans Realtime (sonde seule) : ${q.sonde != null ? 'à l\'écran en ' + s(q.sonde) : 'pas à l\'écran en ' + s(DELAI)}`);
  if (process.env.MAJ_DETAIL) console.log('  signaux vrm:neuf :', JSON.stringify(q.signaux || []));
  if (process.env.MAJ_JSON) fs.writeFileSync(process.env.MAJ_JSON, JSON.stringify({ ...q, parMin, koParMin }, null, 1));
  console.log(ko ? `❌ ${ko} mise(s) à jour manquée(s)` : '✅ l\'app se met à jour seule');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
