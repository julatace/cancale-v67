// ════════════════════════════════════════════════════════════════════════════
//  LES FAMILLES DE DÉFAUTS DU SERVEUR (11 nov., second agent) — les défauts
//  MOYENS et BAS de la revue `docs/passation/robustesse/serveur.md`, réglés UNE
//  fois par famille dans `api/_lib/`, et gardés ici :
//   F1 DÉLAI : aucun `fetch` nu dans api/ (un seul `fetchAvecDelai`,
//      api/_lib/fetch-delai.js) ; EXÉCUTÉ : un réseau qui ne répond jamais coupe
//      (fetchAvecDelai, accesVendeur, stripeApi, une route avec session) ;
//   F2 PAGINATION : chaque lecture `Range` s'arrête proprement à un 416 de
//      frontière (`finALaFrontiere`) et porte un ordre ; EXÉCUTÉ : la liste des
//      clients partis lue PAR CLÉ ne saute aucune ligne quand des lignes
//      disparaissent pendant la lecture ; 1 000 lignes sans `limit` = « pas su » ;
//   F3 PROJECTION : le widget ne relit plus les ventes e-mail entières, l'action
//      « agent » eBay ne relit plus les commandes entières ;
//   F4 COMPARER-ET-ÉCHANGER / « PAS SU » : `conditionRev` compare la version sous
//      sa forme lue (entier, chaîne) ; EXÉCUTÉ : deux écritures concurrentes
//      gardent les deux entrées, deux réservations ⇒ une seule gagne, un `rev`
//      chaîne ne bloque plus `modifierCas` ; `vinted-pris` pas su ⇒ 503 ;
//      mémos du cron et journal e-mails par comparer-et-échanger ;
//   F5 IDENTIFIANTS : empreinte 64 bits, l'ancienne relue seulement ; aucune clé
//      de ligne e-mail (vente, achat, offre, inconnu, quarantaine) tirée du
//      hachage 31 bits, de l'heure ou du hasard.
//  `node scripts/audit-familles-serveur.cjs [--prouve]`
//  `--prouve` : ROUGE sur origin/main (git archive) et sur chaque mutation.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const { pathToFileURL } = require('url');
const ICI = path.join(__dirname, '..');
const R = process.env.AUDIT_RACINE || ICI;

const MUTATIONS = {
  'délai retiré de fetchAvecDelai': [['api/_lib/fetch-delai.js', 'return globalThis.fetch(url, { ...opts, signal });', 'return globalThis.fetch(url, opts);']],
  'un fetch nu revient': [['api/_lib/abonnement.js', 'const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/rpc/vrm_acces_pour`', 'const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/vrm_acces_pour`']],
  '416 de frontière = panne': [['api/_lib/ordre-stable.js', 'return !!m && Number(m[1]) === debut;', 'return false;']],
  'une boucle Range sans fin de liste': [['api/widget.js', '    if (finALaFrontiere(r, from)) break;   // (11 nov.) 416 à une frontière exacte = fin de liste\n', '']],
  'clients partis par offset': [['api/_lib/clients-partis.js', "${apres ? `&owner=gt.${encodeURIComponent(apres)}` : ''}&select=owner,statut,client_stripe,abonnement_stripe,mode_test&order=owner.asc&limit=1000`", "&select=owner,statut,client_stripe,abonnement_stripe,mode_test&order=owner.asc&offset=${n * 1000}&limit=1000`"]],
  'liste tronquée prise pour entière': [['api/_lib/session.js', "    if (j.length >= PLAFOND_SUPABASE && !/(^|[?&])limit=\\d+/.test(chemin)) return null;\n", '']],
  'widget relit les ventes entières': [['api/widget.js', "export const SELECT_VENTES_EMAIL = 'receivedAt:data->>receivedAt,uid:data->>uid,prix:data->>prix';", "export const SELECT_VENTES_EMAIL = 'data';"]],
  'rev chaîne = is.null': [['api/_lib/cas.js', "  const texte = typeof rev === 'object' ? JSON.stringify(rev) : String(rev);", "  if (!Number.isSafeInteger(rev)) return 'data->>rev=is.null';\n  const texte = String(rev);"]],
  'PATCH sans condition de version': [['api/_lib/cas.js', 'const w = await fetcher(`${base}?${filtre}&${conditionRev(d)}&select=id`, {', 'const w = await fetcher(`${base}?${filtre}&select=id`, {']],
  'vinted-pris : pas su = libre': [['api/compte.js', "  const pasSu = () => repondre(res, 503, { ok: false, pris: null, raison: 'pas-su' });", "  const pasSu = () => repondre(res, 200, { ok: true, pris: false });"]],
  'mémo d’expédition illisible = jamais envoyé': [['api/ship-reminders.js', "    const dedupLu = await getRow('ship_reminder_dedup');", "    const dedupLu = (await getRow('ship_reminder_dedup')) || {};"]],
  'empreinte trop courte': [['api/_lib/empreinte.js', 'export const LONGUEUR_EMPREINTE = 16;', 'export const LONGUEUR_EMPREINTE = 5;']],
  'clé de vente au hachage 31 bits': [['api/email-inbound.js', "const nouvelleVente = data.transaction ? `tx${data.transaction}` : mail.messageId ? 'm' + empreinte(String(mail.messageId)) : empreinte(texteCleVente);", 'const nouvelleVente = shortHash(texteCleVente);']],
};

if (process.argv.includes('--prouve')) {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-familles-'));
  cp.execSync(`git -C "${ICI}" archive origin/main api src package.json | tar -x -C "${t}"`);
  let nm = ICI; while (!fs.existsSync(path.join(nm, 'node_modules')) && path.dirname(nm) !== nm) nm = path.dirname(nm);
  fs.symlinkSync(fs.realpathSync(path.join(nm, 'node_modules')), path.join(t, 'node_modules'));
  const r = cp.spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8', timeout: 300000 });
  const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
  console.log(`${r.status && rouges ? '✅' : '❌'} sur origin/main : ${rouges} rouge(s)`);
  for (const l of (r.stdout || '').split('\n').filter((x) => x.startsWith('❌')).slice(0, 14)) console.log('     ' + l.slice(0, 170));
  fs.rmSync(t, { recursive: true, force: true });
  if (!(r.status && rouges)) process.exit(1);
  require('./_mutations-audit.cjs').prouver(__filename, ICI, MUTATIONS);
  return;
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300) : '')); } };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const existe = (f) => fs.existsSync(path.join(R, f));
const importer = (f) => import(pathToFileURL(path.join(R, f)).href);
const fichiersApi = () => { const out = []; const marche = (d) => { for (const e of fs.readdirSync(path.join(R, d), { withFileTypes: true })) { const p = d + '/' + e.name; if (e.isDirectory()) marche(p); else if (e.name.endsWith('.js')) out.push(p); } }; marche('api'); return out; };
// Retire commentaires ET chaînes (un `fetch(` dans un texte n'est pas un appel).
function code(t) {
  let o = '', i = 0, q = null;
  while (i < t.length) {
    const c = t[i], n = t[i + 1];
    if (q) { if (c === '\\') { o += '  '; i += 2; continue; } if (c === q) { q = null; o += c; i++; continue; } if (q === '`' && c === '$' && n === '{') { let p = 1, j = i + 2; while (j < t.length && p) { if (t[j] === '{') p++; else if (t[j] === '}') p--; j++; } o += code(t.slice(i, j)); i = j; continue; } o += c === '\n' ? '\n' : ' '; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; o += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < t.length && t[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { const f = t.indexOf('*/', i + 2); const b = t.slice(i, f < 0 ? t.length : f + 2); o += b.replace(/[^\n]/g, ' '); i = f < 0 ? t.length : f + 2; continue; }
    o += c; i++;
  }
  return o;
}
const avant = (p, ms, quoi) => Promise.race([p.then((v) => ({ v }), (e) => ({ e })), new Promise((ok2) => setTimeout(() => ok2({ pend: true, quoi }), ms))]);
const rep = (o, status = 200, h = {}) => new Response(typeof o === 'string' ? o : JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...h } });
// Un réseau qui ne répond JAMAIS (sauf si un `signal` l'arrête) : la vraie forme d'un service bloqué.
const suspendu = (url, o = {}) => new Promise((_, ko2) => { const s = o && o.signal; if (s) { if (s.aborted) return ko2(s.reason || new Error('abort')); s.addEventListener('abort', () => ko2(s.reason || new Error('abort'))); } });

(async () => {
  process.env.VRM_DELAI_SORTANT_MAX_MS = '200';
  process.env.SUPABASE_URL = 'https://banc.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = 'cle-service-banc';
  process.env.SUPABASE_KEY = 'cle-anon-banc';
  process.env.STRIPE_SECRET_KEY = 'sk_test_banc';

  // ── F1 DÉLAI ─────────────────────────────────────────────────────────────
  console.log('\nF1 — chaque appel sortant a un délai');
  const nus = [];
  for (const f of fichiersApi()) {
    if (f === 'api/_lib/fetch-delai.js') continue;
    code(lire(f)).split('\n').forEach((l, i) => { if (/(^|[^\w$.])fetch(?![\w$])/.test(l)) nus.push(`${f}:${i + 1}`); });
  }
  dit(nus.length === 0, 'aucun `fetch` nu dans api/ (appel ou valeur par défaut) : tout passe par fetchAvecDelai', `${nus.length} : ${nus.slice(0, 6).join(', ')}`);
  globalThis.fetch = suspendu;
  if (!existe('api/_lib/fetch-delai.js')) dit(false, 'api/_lib/fetch-delai.js existe');
  else {
    const { fetchAvecDelai, delaiPour } = await importer('api/_lib/fetch-delai.js');
    const t0 = Date.now(); const r = await avant(fetchAvecDelai('https://api.stripe.com/v1/x', {}), 3000);
    dit(r.e && Date.now() - t0 < 2500, 'un service qui ne répond jamais : fetchAvecDelai coupe (rejette) au délai', r.pend ? 'toujours en attente à 3 s' : r.e && r.e.name);
    dit(delaiPour('https://overpass-api.de/api/interpreter') <= 8000 && delaiPour('https://api.anthropic.com/v1/messages') <= 25000 && delaiPour('https://x.supabase.co/rest/v1/a') <= 10000, 'un délai par service (Overpass 8 s, Anthropic 25 s, Supabase 10 s)');
    const ctrl = new AbortController(); setTimeout(() => ctrl.abort(new Error('appelant')), 20);
    const r2 = await avant(fetchAvecDelai('https://x.supabase.co/a', { signal: ctrl.signal }), 3000);
    dit(r2.e && /appelant/.test(String(r2.e.message)), 'le signal de l’appelant est GARDÉ (combiné au délai)', r2.e && r2.e.message);
  }
  try {
    const { accesVendeur, oublierAcces } = await importer('api/_lib/abonnement.js');
    if (oublierAcces) oublierAcces();
    const r = await avant(accesVendeur('11111111-1111-4111-8111-111111111111'), 3000);
    dit(!r.pend && r.v === null, 'accesVendeur sur une base muette : « pas su » (null) en moins de 3 s', r.pend ? 'bloqué' : r.v);
  } catch (e) { dit(false, 'accesVendeur se charge', e.message); }
  try {
    const { stripeApi } = await importer('api/_lib/stripe.js');
    const r = await avant(stripeApi('GET', 'customers/cus_x'), 3000);
    dit(!r.pend, 'stripeApi sur un Stripe muet répond en moins de 3 s', r.pend ? 'bloqué' : '');
  } catch (e) { dit(false, 'stripe.js se charge', e.message); }
  try {
    const relais = (await importer('api/relais.js')).default;
    const res = { code: null, corps: null, h: {}, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader(a, b) { this.h[a] = b; }, end() { return this; } };
    const r = await avant(relais({ method: 'GET', query: { city: 'Rennes' }, headers: { authorization: 'Bearer a.b.c' } }, res), 3000);
    dit(!r.pend && res.code === 503, 'une route avec session (relais) sur un service de connexion muet : 503 « réessaie » en moins de 3 s', r.pend ? 'bloquée' : res.code);
  } catch (e) { dit(false, 'api/relais.js se charge', e.message); }

  // ── F2 PAGINATION ────────────────────────────────────────────────────────
  console.log('\nF2 — lectures paginées : ordre stable, fin à 416, « pas su » au plafond');
  const sansFin = [], sansOrdre = [];
  for (const f of fichiersApi()) {
    // Les lignes BRUTES, commentaires `//` retirés (l'en-tête `Range` est dans une chaîne).
    const lignes = lire(f).split('\n').map((l) => (/^\s*(\/\/|\*)/.test(l) ? '' : l.replace(/\s\/\/ .*$/, '')));
    lignes.forEach((l, i) => {
      if (!/\bRange\s*:\s*`/.test(l)) return;
      const fenetre = lignes.slice(Math.max(0, i - 6), i + 10).join('\n');
      if (!/finALaFrontiere\s*\(|status\s*===\s*416/.test(fenetre)) sansFin.push(`${f}:${i + 1}`);
      const appel = lignes.slice(Math.max(0, i - 3), i + 1).join('\n');
      if (!/ordreStable\s*\(|order=/.test(appel)) sansOrdre.push(`${f}:${i + 1}`);
    });
  }
  const uniq = (a) => [...new Set(a)];
  dit(uniq(sansFin).length === 0, 'chaque lecture `Range` d’api/ s’arrête proprement à un 416 de frontière', uniq(sansFin).join(', '));
  dit(uniq(sansOrdre).length === 0, 'chaque lecture `Range` d’api/ porte un ordre (ordreStable ou order=)', uniq(sansOrdre).join(', '));
  try {
    const { finALaFrontiere } = await importer('api/_lib/ordre-stable.js');
    const r416 = (cr) => ({ status: 416, headers: new Headers({ 'content-range': cr }) });
    dit(typeof finALaFrontiere === 'function' && finALaFrontiere(r416('*/1000'), 1000) === true && finALaFrontiere(r416('*/999'), 1000) === false && finALaFrontiere(r416('*/0'), 0) === false && finALaFrontiere({ status: 500, headers: new Headers() }, 1000) === false,
      'finALaFrontiere : seul un 416 « */N » au début exact de la page est une fin (une panne reste une panne)');
  } catch (e) { dit(false, 'finALaFrontiere existe (api/_lib/ordre-stable.js)', e.message); }
  try {
    // 2 500 abonnements finis ; 10 lignes de la 1re page disparaissent APRÈS sa lecture (effacées
    // par le passage). Une lecture par `offset` saute 10 lignes de la page suivante.
    let abos = Array.from({ length: 2500 }, (_, i) => ({ owner: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, statut: 'canceled', client_stripe: 'c', abonnement_stripe: 's', mode_test: false }));
    let pages = 0;
    globalThis.fetch = async (url) => {
      const u = new URL(String(url)); const q = u.searchParams;
      if (!u.pathname.endsWith('/abonnements')) return rep([]);
      let rows = abos.slice().sort((a, b) => (a.owner < b.owner ? -1 : 1));
      const gt = q.get('owner'); if (gt && gt.startsWith('gt.')) rows = rows.filter((x) => x.owner > gt.slice(3));
      const off = Number(q.get('offset') || 0), lim = Number(q.get('limit') || 1000);
      const page = rows.slice(off, off + lim);
      if (++pages === 1) abos = abos.filter((x) => !page.slice(0, 10).includes(x));
      return rep(page);
    };
    const { listerFinis } = await importer('api/_lib/clients-partis.js');
    const l = await avant(listerFinis('https://banc.supabase.co', 'cle'), 5000);
    const vus = new Set((l.v || []).map((x) => x.owner));
    dit(Array.isArray(l.v) && vus.size === 2500, 'clients partis : lus PAR CLÉ, aucune ligne ne saute quand le passage en efface pendant la lecture', l.v ? `${vus.size} / 2500` : l);
  } catch (e) { dit(false, 'clients-partis se charge', e.message); }
  try {
    globalThis.fetch = async (url) => { const u = String(url); if (u.includes('/auth/v1/')) return rep({ id: '11111111-1111-4111-8111-111111111111' }); return rep(Array.from({ length: 1000 }, (_, i) => ({ id: 'l' + i }))); };
    const { lireCommeVendeur } = await importer('api/_lib/session.js');
    const req = { headers: { authorization: 'Bearer a.b.c' } };
    const plein = await lireCommeVendeur(req, 'app_data?owner=eq.x&select=id');
    const borne = await lireCommeVendeur(req, 'app_data?owner=eq.x&select=id&limit=1000');
    dit(plein === null && Array.isArray(borne), 'lireCommeVendeur : 1 000 lignes sans `limit` = peut-être tronqué ⇒ « pas su » ; avec `limit` posé ⇒ la liste', [plein === null, Array.isArray(borne)]);
  } catch (e) { dit(false, 'session.js se charge', e.message); }

  // ── F3 PROJECTION ────────────────────────────────────────────────────────
  console.log('\nF3 — jamais la ligne entière quand quelques champs suffisent');
  const w = code(lire('api/widget.js'));
  const selVentes = (/SELECT_VENTES_EMAIL\s*=\s*'([^']*)'/.exec(lire('api/widget.js')) || [])[1];
  const ventesWidget = /email_sale_\*?&select=\$\{SELECT_VENTES_EMAIL\}/.test(lire('api/widget.js')) && selVentes && !selVentes.split(',').some((x) => /(^|:)data$/.test(x.trim()));
  dit(ventesWidget, 'widget : les ventes e-mail lues projetées (date, compte, prix), jamais `select=data`', selVentes || 'lecture introuvable');
  dit(!/rows\('email_sale_\*'\)/.test(w), 'widget : plus aucune lecture entière de `email_sale_*`');
  const ag = (/agent\s*:\s*async[^\n]*/.exec(code(lire('api/ebay.js'))) || [''])[0] + (lire('api/ebay.js').split('agent:async')[1] || '').slice(0, 300);
  dit(!/lireDonnee\(ligneDe\('ebay_orders'/.test(ag), 'eBay : l’action « agent » (arrêtée) ne relit plus `ebay_orders` entière', ag.slice(0, 120));

  // ── F4 COMPARER-ET-ÉCHANGER / PAS SU ─────────────────────────────────────
  console.log('\nF4 — écritures concurrentes et « pas su »');
  if (!existe('api/_lib/cas.js')) dit(false, 'api/_lib/cas.js existe (la règle de version du serveur)');
  else {
    const { conditionRev, modifierLigneCas, reserverMemo } = await importer('api/_lib/cas.js');
    dit(conditionRev({ rev: 3 }) === 'data->>rev=eq.3' && conditionRev({ rev: 'a1b2-c3' }) === 'data->>rev=eq.a1b2-c3' && conditionRev({}) === 'data->>rev=is.null',
      'conditionRev compare la version SOUS SA FORME LUE (entier, chaîne ; absente ⇒ is.null)', [conditionRev({ rev: 3 }), conditionRev({ rev: 'a1b2-c3' })]);
    // Une fausse base À ÉTAT : PATCH conditionnel sur data->>rev, INSERT 409 si la clé existe.
    const fausseBase = () => {
      const lignes = new Map();
      const f = async (url, o = {}) => {
        const u = new URL(String(url)); const q = u.searchParams; const m = (o.method || 'GET').toUpperCase();
        const cle = (q.get('owner') || '').replace(/^eq\./, '') + '|' + (q.get('id') || '').replace(/^eq\./, '');
        await new Promise((r) => setTimeout(r, 2));
        if (m === 'GET') { const d = lignes.get(cle); return rep(d === undefined ? [] : [{ data: JSON.parse(JSON.stringify(d)) }]); }
        if (m === 'POST') { const [l] = JSON.parse(o.body); const k = l.owner + '|' + l.id; if (lignes.has(k)) return rep({ code: '23505' }, 409); lignes.set(k, l.data); return rep('', 201); }
        if (m === 'PATCH') {
          const d = lignes.get(cle); if (d === undefined) return rep([]);
          const c = q.get('data->>rev'); const lu = d.rev == null ? null : (typeof d.rev === 'object' ? JSON.stringify(d.rev) : String(d.rev));
          if (c != null && (c === 'is.null' ? lu !== null : c !== 'eq.' + lu)) return rep([]);
          lignes.set(cle, JSON.parse(o.body).data); return rep([{ id: 'x' }]);
        }
        return rep([]);
      };
      return { f, lignes };
    };
    const b = fausseBase();
    const ligne = { url: 'https://banc.supabase.co', entetes: {}, owner: 'o1', id: 'email_journal', fetcher: b.f };
    const ajout = (x) => modifierLigneCas({ ...ligne, modifier: (d) => ({ entries: [x, ...((d && d.entries) || [])] }) });
    const rs = await Promise.all(['a', 'b', 'c', 'd'].map(ajout));
    const fin = b.lignes.get('o1|email_journal');
    dit(rs.every((x) => x === true) && fin && fin.entries.length === 4, 'quatre écritures concurrentes sur une même ligne : les QUATRE entrées restent', fin && fin.entries);
    const b2 = fausseBase();
    const res2 = await Promise.all([1, 2, 3].map(() => reserverMemo({ url: 'https://banc.supabase.co', entetes: {}, owner: 'o1', id: 'ship_reminder_dedup', fetcher: b2.f, deja: (d) => !!d && d.date === 'J', nouveau: () => ({ date: 'J' }) })));
    dit(res2.filter((x) => x.reserve).length === 1, 'trois passages réservent le même mémo en même temps : UN SEUL envoie', res2);
    const res3 = await reserverMemo({ url: 'https://banc.supabase.co', entetes: {}, owner: 'o1', id: 'm', fetcher: async () => rep('<html>522</html>', 522), deja: () => false, nouveau: () => ({}) });
    dit(res3.reserve === false && res3.raison === 'pas-su', 'mémo illisible : rien n’est réservé, rien ne part (« pas su » ≠ « jamais envoyé »)', res3);
  }
  try {
    const b = new Map([['o2|vc_ventes', { rev: 'b7e1-uuid', n: 1 }]]);
    globalThis.fetch = async (url, o = {}) => {
      const u = new URL(String(url)); const q = u.searchParams; const m = (o.method || 'GET').toUpperCase();
      const cle = (q.get('owner') || '').replace(/^eq\./, '') + '|' + (q.get('id') || '').replace(/^eq\./, '');
      if (m === 'GET') { const d = b.get(cle); return rep(d ? [{ data: d }] : []); }
      if (m === 'PATCH') { const d = b.get(cle); const c = q.get('data->>rev'); const lu = d && d.rev != null ? String(d.rev) : null; if (!d || (c === 'is.null' ? lu !== null : c !== 'eq.' + lu)) return rep([]); b.set(cle, JSON.parse(o.body).data); return rep([{ id: 'x' }]); }
      return rep([]);
    };
    const { modifierCas } = await importer('api/_lib/suivi-vinted.js');
    const r = await avant(modifierCas('vc_ventes', (d) => ({ ...d, n: 2 }), 3, { owner: 'o2' }), 5000);
    dit(r.v === true && b.get('o2|vc_ventes').n === 2, 'modifierCas sur une ligne dont `rev` est une CHAÎNE : écrit (plus de 503 permanent)', r.v);
  } catch (e) { dit(false, 'suivi-vinted.js se charge', e.message); }
  try {
    globalThis.fetch = async (url) => { const u = String(url); if (u.includes('/auth/v1/user')) return rep({ id: '11111111-1111-4111-8111-111111111111', email: 'a@b.fr' }); if (u.includes('vinted_accounts')) return rep('<html>522</html>', 522); return rep([]); };
    const compte = (await importer('api/compte.js')).default;
    const res = { code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; }, send(o) { this.corps = o; return this; } };
    await avant(compte({ method: 'GET', query: { mode: 'vinted-pris', id: '123456' }, headers: { authorization: 'Bearer a.b.c' } }, res), 5000);
    dit(res.code === 503 && !(res.corps && res.corps.pris === false), '« ce compte Vinted est-il pris ? » sur une base muette : 503, jamais « libre »', [res.code, res.corps]);
  } catch (e) { dit(false, 'api/compte.js se charge', e.message); }
  const sr = code(lire('api/ship-reminders.js'));
  dit(!/\(await getRow\('(ship|urssaf)_reminder_dedup'\)\)\s*\|\|\s*\{\}/.test(lire('api/ship-reminders.js').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')), 'cron : un mémo de dédoublonnage illisible n’est jamais lu « jamais envoyé » (`|| {}`)');
  const srBrut = lire('api/ship-reminders.js');
  const avantEnvoi = (cat) => { const i = srBrut.indexOf(`sendPushToAll({ cat: '${cat}'`); const j = srBrut.lastIndexOf('reserverDedup(', i); return i > 0 && j > 0 && i - j < 900; };
  dit(avantEnvoi('expedier') && avantEnvoi('urssaf'), 'cron : le mémo « à expédier » et le rappel URSSAF sont RÉSERVÉS (comparer-et-échanger) avant l’envoi');
  const ei = code(lire('api/email-inbound.js'));
  const logE = (ei.split('async function logEmail')[1] || '').slice(0, 1400);
  dit(/modifierLigneCas\(/.test(logE), 'journal des e-mails : comparer-et-échanger (deux e-mails en parallèle ne perdent plus l’entrée de l’autre)');
  const det = (ei.split('async function detectAccount')[1] || '').slice(0, 1200);
  dit(!/res\.ok\s*\?\s*await res\.json\(\)\s*:\s*\[\]/.test(det) && /acc === null/.test(ei), 'compte de l’e-mail : une lecture ratée ⇒ 503 (rejoué), jamais rangé « sans compte »');
  const re = code(lire('api/_lib/relances-essai.js'));
  dit(/reserverMemo\(/.test(re), 'relances d’essai : l’étape est réservée par comparer-et-échanger (deux passages ⇒ un seul e-mail)');

  // ── F5 IDENTIFIANTS ──────────────────────────────────────────────────────
  console.log('\nF5 — identifiants assez longs, clés déterministes');
  if (!existe('api/_lib/empreinte.js')) dit(false, 'api/_lib/empreinte.js existe');
  else {
    const { empreinte, ancienneEmpreinte, cleCompatible } = await importer('api/_lib/empreinte.js');
    const e = empreinte('vente|x');
    dit(/^[0-9a-f]{16,}$/.test(e) && empreinte('vente|x') === e && empreinte('vente|y') !== e, 'empreinte : 64 bits au moins (16 hex), stable', e);
    let h = 0; const s = 'pseudo|25|Nike'; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    dit(ancienneEmpreinte(s) === Math.abs(h).toString(36), 'l’ancienne empreinte est recalculée À L’IDENTIQUE (relire les lignes déjà rangées)');
    const lireF = (rows) => async (id) => (id in rows ? rows[id] : null);
    const a = await cleCompatible({ prefixe: 'email_sale_', ancienne: 'old', nouvelle: 'tx9', lire: lireF({ email_sale_old: { tx: '9' } }), memeChose: (l) => l.tx === '9' });
    const n = await cleCompatible({ prefixe: 'email_sale_', ancienne: 'old', nouvelle: 'tx9', lire: lireF({ email_sale_old: { tx: '8' } }), memeChose: (l) => l.tx === '9' });
    const u = await cleCompatible({ prefixe: 'email_sale_', ancienne: 'old', nouvelle: 'tx9', lire: async () => undefined, memeChose: () => true });
    dit(a === 'email_sale_old' && n === 'email_sale_tx9' && u === undefined, 'clé compatible : la ligne d’avant (même vente) garde sa clé ; une autre vente prend la neuve ; lecture ratée ⇒ rien', [a, n, u]);
  }
  const brut = lire('api/email-inbound.js');
  const cleDe = (prefixe) => { const i = brut.indexOf(`id: \`${prefixe}\${key}\``); return i < 0 ? '' : brut.slice(Math.max(0, brut.lastIndexOf('const key', i) - 1500), i); };
  for (const [p, nom] of [['email_sale_', 'vente'], ['email_achat_', 'achat']]) {
    const bloc = cleDe(p); const decl = (/const key = [^\n]*/.exec(bloc.slice(bloc.lastIndexOf('const key'))) || [''])[0];
    dit(bloc && !/const key = shortHash\(/.test(decl) && /empreinte\(/.test(bloc), `clé de ligne « ${nom} » : jamais le hachage 31 bits (empreinte 64 bits ou identité lue)`, decl.slice(0, 140));
  }
  const vente = brut.slice(brut.indexOf('const texteCleVente'), brut.indexOf("id: `email_sale_${key}`"));
  dit(/data\.transaction\s*\?\s*`tx\$\{data\.transaction\}`/.test(vente) && /mail\.messageId/.test(vente), 'clé de vente : SA transaction quand elle est lue, sinon le Message-ID (deux paires identiques au même acheteur = deux ventes)');
  const inc = (brut.split('email_inconnu_${cle}')[0] || '').slice(-900);
  dit(!/Date\.now\(\)/.test((/const cle = [^\n]*/.exec(inc.slice(inc.lastIndexOf('const cle'))) || [''])[0]) && /empreinte\(/.test(inc), 'e-mail inconnu : clé stable (un rejeu réécrit la même ligne), jamais l’heure dans la clé');
  const q = (brut.split('async function mettreEnQuarantaine')[1] || '').slice(0, 1500);
  dit(!/Math\.random\(\)/.test(q) && !/Date\.now\(\)\.toString\(36\)/.test(q), 'quarantaine sans Message-ID : clé déterministe (ni heure, ni hasard)');

  console.log(`\n${ko ? '❌' : '✅'} audit-familles-serveur : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ l’audit a levé : ' + (e && e.stack || e)); process.exit(1); });
