// scripts/audit-transp-notif.cjs
// ─────────────────────────────────────────────────────────────────────────────
// (29 oct.) LE STATUT LU CHEZ LE TRANSPORTEUR : CE QUI SONNE, LA CONCURRENCE,
// LE RYTHME, LA PAUSE, LES BORNES — les défauts n° 12 à 21 de la relecture du
// 24 octobre, rejoués sur les VRAIES routes (api/relais.js C5/C3/C4,
// api/push.js { action: suivi }, api/email-inbound.js, api/ship-reminders.js)
// dans une fausse base PostgREST À ÉTAT (plusieurs vendeurs, le propriétaire
// neutre), de faux transporteurs (Chronopost, Vinted Go) et un faux Web Push.
// Données INVENTÉES, à la forme de mesures.json — aucun vrai n°, aucun vrai lieu.
//   N1  (n° 12) une NOUVELLE arrivée sonne (autre point, retour au point après
//       « a quitté le point relais ») ; la même arrivée relue, jamais deux fois ;
//   N2  (n° 13) un hoquet de la base au moment de sonner ne perd rien : la
//       notification part au passage suivant, une fois ;
//   N3  (n° 14) le suivi Vinted et le transporteur, même évènement : une seule ;
//   N4  (n° 15) la pause est celle du SERVEUR : un 403 arrête les requêtes de
//       TOUS les vendeurs (même instance, et une autre instance) ;
//   N5  (n° 16) un e-mail « disponible » traité pendant le passage : une seule ;
//   N6  (n° 17) deux passages simultanés : une requête par n°, la pause ne monte
//       pas d'un palier pour deux refus simultanés ;
//   N7  (n° 18) C4 : un ancien n° (« fermeture ») ne sonne pas ;
//   N8  (n° 19) C4 : une réponse plus ancienne que la dernière lecture ne fait
//       pas redescendre un colis retiré ; un état final ne redescend jamais ;
//   N9  (n° 20) les bornes : le relais répond dans son budget, le cron ne lit,
//       n'écrit et ne sonne plus rien après sa réponse ;
//   N10 (n° 21) la garde des 72 h juge la date de l'évènement qui fait l'état.
// Tour 2 (revue du 29 oct.) :
//   N11 (n° 15) l'e-mail « retiré » et le transporteur en même temps : un seul
//       « retiré », et l'e-mail d'un AUTRE colis n'efface pas la clé posée ;
//   N12 (n° 16) le suivi Vinted « disponible » et le transporteur en même
//       temps : une seule notification ;
//   N13 (n° 18) un ancien n° dont la 1re lecture rate est relu après son recul ;
//   N14 (n° 17) Mondial Relay : la même arrivée lue par le serveur (sans lieu)
//       puis par l'extension (avec lieu) ne sonne qu'une fois.
// `--prouve` : réaffaiblit chaque règle, chaque mutation doit rendre ROUGE.
// `--seul=N1,N3` : seulement ces scénarios. §6.1 : lancé depuis l'arbre d'avant
// (AUDIT_RACINE, ou copié dedans), il est rouge.
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

const MUTATIONS = {
  'arrivee-cle-unique': ['N1', 'api/_lib/transporteurs.js', "    if (estNouvelleArrivee(avant, apres)) return { etat: e, etape: 'relais', jour, fait: `${fait}|${occ}`, categorie: 'colis', cle: `relais-${k}-r${empreinte(occ)}`, prefixesSilence: [], nouvelleArrivee: true };\n", ''],
  // (tour 2 n° 17) Le lieu d'une arrivée « disponible → disponible » se compare
  // désormais dans `etatAChange` (seulement s'il est connu des deux côtés) :
  // c'est LÀ que vit la règle « un autre point relais, même détail, sonne ».
  'change-sans-lieu': ['N1', 'api/_lib/transporteurs.js', '    return !!(a && b && a !== b);', '    return false;'],
  'pas-su-consomme': ['N2', 'api/_lib/transporteurs-lecture.js', "  if (r.raison === 'pas-su') return r;\n", ''],
  'transp-ignore-vinted': ['N3', 'api/_lib/transporteurs-notif.js', '    if (c.vinted) exactes.push(c.vinted);\n', ''],
  'vinted-ignore-transp': ['N3', 'api/_lib/suivi-vinted.js', "    const bloquantes = [c.transp, ...(numero && etape !== 'track' ? [`${etape}-${numero}`] : [])].filter(Boolean);", '    const bloquantes = [];'],
  'pause-sans-memoire': ['N4', 'api/_lib/transporteurs-lecture.js', "    if (pauseEnCours(null, carrier)) return { echec: 'pause' };\n", ''],
  'pause-par-vendeur': ['N4', 'api/_lib/transporteurs-lecture.js', '&owner=eq.${PROPRIETAIRE_NEUTRE}&select=data`', '&owner=eq.${proprietaireCourant()}&select=data`'],
  'cas-sans-reverification': ['N5', 'api/_lib/transporteurs-notif.js', '    if (ks.some((x) => exactes.includes(x) || prefixes.some((p) => x.startsWith(p)))) return undefined;\n', ''],
  'sans-bail': ['N6', 'api/_lib/transporteurs-lecture.js', '      if (!(await prendreBail(b, it, Date.now()))) continue;\n', ''],
  'pause-monte': ['N6', 'api/_lib/transporteurs.js', '  if (enPause(p, carrier, maintenant)) return undefined;\n', ''],
  'c4-fermeture-sonne': ['N7', 'api/_lib/transporteurs-lecture.js', "  const silence = raisonDu(b, carrier, suivi, ici) === 'fermeture';", '  const silence = false;'],
  'c4-at-ignore': ['N8', 'api/_lib/transporteurs-lecture.js', '  const now = Number.isFinite(atMs) ? Math.min(atMs, ici) : ici;', '  const now = ici;'],
  'final-redescend': ['N8', 'api/_lib/transporteurs.js', '  if (res === \'ok\' && finalEtat(a) && !finalEtat(lu)) { out.essais = 0; out.fini = finiApres(out); return out; }\n', ''],
  'borne-avant-element': ['N9', 'api/_lib/transporteurs-lecture.js', '      if (Date.now() + _delaiMs + _ecartMs + MARGE_RANGEMENT_MS > fin) break;', '      if (Date.now() > fin) break;'],
  'cron-sans-arret': ['N9', 'api/ship-reminders.js', '  finally { clearTimeout(minuteur); arret.abort(); }', '  finally { clearTimeout(minuteur); }'],
  '72h-dernier-chrono': ['N10', 'api/_lib/transporteurs.js', "etatAt: (dApres || evs[iR]).at, dernierAt: dernier.at });", 'etatAt: dernier.at, dernierAt: dernier.at });'],
  '72h-dernier-vg': ['N10', 'api/_lib/transporteurs.js', "etatAt: /^(?:returned|return_returned)$/.test(d.group) ? isoDe(d.ms) : (isoDe(debut.ms) || base.etatAt), dernierAt: base.etatAt });", 'etatAt: base.etatAt, dernierAt: base.etatAt });'],
  // (29 oct., tour 2) — N11 à N14 : les courses et les relectures de la revue.
  'email-sans-reverif': ['N11', 'api/email-inbound.js', '    if (cles.some((k) => ks.includes(k))) return undefined;\n', ''],
  'email-ecrase': ['N11', 'api/email-inbound.js', '    return { ...(d || {}), keys: [...ecrites.filter((k) => !ks.includes(k)), ...enPlus, ...ks].slice(0, 300) };', '    return { ...(d || {}), keys: [...ecrites, ...enPlus].slice(0, 300) };'],
  'vinted-relais-aveugle': ['N12', 'api/_lib/suivi-vinted.js', '      deja = keys.some((k) => prefixes.some((p) => k.startsWith(p)) || (cleCode && k === cleCode));', '      deja = false;'],
  'fermeture-jamais-relue': ['N13', 'api/_lib/transporteurs.js', 'export const jamaisLueAvecSucces = (t) => !!t && !t.lu', 'export const jamaisLueAvecSucces = (t) => false && !t.lu'],
  // Deux gardes indépendantes (l'état n'a pas changé · la même occurrence) : les
  // retirer ENSEMBLE refait le défaut ; chacune seule est rattrapée par l'autre.
  'enrichissement-sonne': ['N14', [['api/_lib/transporteurs.js', '  return !lx || !ly || lx === ly;\n}', '  return lx === ly;\n}'], ['api/_lib/transporteurs.js', '    return !!(a && b && a !== b);', '    return a !== b;']]],
};
const ARG_PROUVE = process.argv.find((x) => x.startsWith('--prouve'));
if (ARG_PROUVE) {
  let ok = 0;
  const seules = ARG_PROUVE.includes('=') ? ARG_PROUVE.split('=')[1].split(',') : null;
  const choisies = Object.entries(MUTATIONS).filter(([nom]) => !seules || seules.includes(nom));
  for (const [nom, def] of choisies) {
    const scen = def[0];
    const changes = Array.isArray(def[1]) ? def[1] : [def.slice(1)];
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-tn-'));
    for (const x of ['api', 'src', 'package.json']) fs.cpSync(path.join(R, x), path.join(t, x), { recursive: true });
    fs.symlinkSync(fs.realpathSync(path.join(R, 'node_modules')), path.join(t, 'node_modules'));
    let ancreKo = '';
    for (const [f, de, vers] of changes) {
      const src = fs.readFileSync(path.join(t, f), 'utf8');
      if (src.split(de).length !== 2) { ancreKo = `ancre ${src.includes(de) ? 'pas unique' : 'introuvable'} dans ${f}`; break; }
      fs.writeFileSync(path.join(t, f), src.replace(de, vers));
    }
    if (ancreKo) { console.log(`❌ mutation ${nom} : ${ancreKo}`); fs.rmSync(t, { recursive: true, force: true }); continue; }
    const r = spawnSync(process.execPath, [__filename, `--seul=${scen}`], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8', timeout: 300000 });
    const rouges = (String(r.stdout || '').match(/^❌/gm) || []).length;
    const tombe = r.status !== 0 && rouges > 0;
    if (tombe) ok++;
    console.log(`${tombe ? '✅' : '❌'} mutation « ${nom} » (${scen}) ⇒ ${tombe ? rouges + ' rouge(s)' : 'VERTE (le contrôle ne la voit pas)'}`);
    if (!tombe) console.log(String(r.stdout || '').split('\n').filter((l) => /^[✅❌]/.test(l)).slice(-8).join('\n'));
    fs.rmSync(t, { recursive: true, force: true });
  }
  const n = choisies.length;
  console.log(ok === n ? `\n✅ ${ok}/${n} mutations attrapées` : `\n❌ ${n - ok} mutation(s) non attrapée(s)`);
  process.exit(ok === n ? 0 : 1);
}
const SEUL = (() => { const a = process.argv.find((x) => x.startsWith('--seul=')); return a ? a.split('=')[1].split(',') : null; })();
const veut = (n) => !SEUL || SEUL.includes(n);

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String((e && e.stack) || e).split('\n').slice(0, 2).join(' ').slice(0, 300)); } };

// ══ LE BANC : fausse PostgREST à état, faux transporteurs, faux Web Push ══════
const A = '11111111-2222-3333-4444-555555555555';
const B = '99999999-8888-7777-6666-555555555555';
const NEUTRE = '00000000-0000-0000-0000-000000000000';
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VRM_OWNER_UID = A;
process.env.VAPID_PRIVATE_KEY = 'banc-cle-privee-factice';
process.env.CRON_SECRET = 'cle-banc-cron';
process.env.EMAIL_INBOUND_SECRET = 'cle-banc-suivi';
delete process.env.AI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
const webpush = require(path.join(R, 'node_modules', 'web-push'));
const pushes = [];
webpush.setVapidDetails = () => {};
webpush.sendNotification = async (sub, body) => { pushes.push({ endpoint: sub.endpoint, ...JSON.parse(body), _t: Date.now() }); return { statusCode: 201 }; };
const base = new Map();
const H = { pannes: new Set(), pannesN: {}, gates: [], gatesApres: [], ecrits: [], transporteur: [], carrier: null, latence: 0, comptes: [] };
const rep = (c, s = 200, ct = 'application/json') => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: s, headers: { 'content-type': ct } });
const chemin = (obj, ch) => { let v = obj; for (const seg of ch.split(/->>|->/)) v = v == null ? undefined : v[seg]; return v; };
const metaDe = (d) => { const m = {}; if (d && typeof d === 'object') for (const [k, v] of Object.entries(d)) { if (v == null || typeof v === 'object') continue; const s = String(v); if (s.length <= 600) m[k] = s; } return m; };
const valeur = (l, k) => {
  if (k === 'id') return l.id; if (k === 'owner') return l.owner;
  if (k.startsWith('meta->>')) return metaDe(l.data)[k.slice(7)];
  if (k.startsWith('data->>') || k.startsWith('data->')) { const v = chemin(l.data, k.replace(/^data(->>|->)/, '')); return v == null ? undefined : (typeof v === 'object' ? JSON.stringify(v) : String(v)); }
  return undefined;
};
const teste = (x, op) => {
  const i = op.indexOf('.'); const o = op.slice(0, i), v = op.slice(i + 1);
  if (o === 'eq') return x === v;
  if (o === 'neq') return x !== v;
  if (o === 'like' || o === 'ilike') { const re = new RegExp('^' + v.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$', o === 'ilike' ? 'i' : ''); return x != null && re.test(x); }
  if (o === 'in') return v.replace(/^\(|\)$/g, '').split(',').map((y) => y.replace(/^"|"$/g, '')).includes(x);
  if (o === 'is') return v === 'null' ? x == null : true;
  if (o === 'not') return !teste(x, v);
  return true;
};
const decoupeOr = (s) => { const out = []; let p = 0, cur = ''; for (const ch of s.replace(/^\(|\)$/g, '')) { if (ch === '(') p++; if (ch === ')') p--; if (ch === ',' && !p) { out.push(cur); cur = ''; } else cur += ch; } if (cur) out.push(cur); return out; };
const filtrer = (u) => {
  const conds = [];
  for (const [k, v] of u.searchParams) {
    if (['select', 'on_conflict', 'limit', 'order', 'offset'].includes(k)) continue;
    if (k === 'or') { const alts = decoupeOr(v).map((e) => { const j = e.indexOf('.'); return [e.slice(0, j), e.slice(j + 1)]; }); conds.push((l) => alts.some(([kk, op]) => teste(valeur(l, kk), op))); continue; }
    conds.push((l) => teste(valeur(l, k), v));
  }
  return [...base.entries()].map(([cle, d]) => { const i = cle.indexOf('|'); return { owner: cle.slice(0, i), id: cle.slice(i + 1), data: d }; }).filter((l) => conds.every((c) => c(l)));
};
const projeter = (l, sel) => {
  if (!sel || sel === '*') return { owner: l.owner, id: l.id, data: l.data };
  const o = {};
  for (const part of sel.split(',')) {
    const [alias, ch] = part.includes(':') ? part.split(/:(.+)/) : [part.split(/->>|->/).pop(), part];
    if (ch === 'id' || ch === 'owner') { o[alias] = l[ch]; continue; }
    if (ch === 'data') { o[alias] = l.data; continue; }
    if (ch.startsWith('meta->>')) { const v = metaDe(l.data)[ch.slice(7)]; o[alias] = v == null ? null : v; continue; }
    const v = chemin(l.data, ch.replace(/^data(->>|->)/, ''));
    o[alias] = v === undefined ? null : (/->>[^>]*$/.test(ch) && v != null && typeof v !== 'object' ? String(v) : v);
  }
  return o;
};
const enTete = (opts, k) => { const h = (opts && opts.headers) || {}; for (const [kk, v] of Object.entries(h)) if (kk.toLowerCase() === k.toLowerCase()) return String(v); return ''; };
const JETONS = { 'aaa.bbb.ccc': A, 'bbb.ccc.ddd': B };
const attendreGate = async (liste, quoi) => { for (const g of liste) if (!g.fini && g.test(quoi)) { g.compte = (g.compte || 0) + 1; if (g.compte < (g.rang || 1)) continue; g.vu = true; g.fini = g.une; await g.p; } };
global.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  if (u.hostname === 'lgonxzrzjcqthjtbdpzo.supabase.co') {
    if (u.pathname === '/auth/v1/user') { const a = enTete(opts, 'Authorization').replace(/^Bearer /, ''); const id = JETONS[a]; return id ? rep({ id, email: 'banc@exemple.invalid', email_confirmed_at: '2026-01-01T00:00:00Z' }) : rep({ msg: 'non' }, 401); }
    if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
    if (u.pathname === '/rest/v1/vinted_accounts') {
      const own = (u.searchParams.get('owner') || '').replace(/^eq\./, ''), vid = (u.searchParams.get('vinted_user_id') || '').replace(/^eq\./, '');
      return rep((H.comptes || []).filter((c) => (!own || c.owner === own) && (!vid || c.vinted_user_id === vid)).map((c) => ({ vinted_user_id: c.vinted_user_id })));
    }
    if (u.pathname !== '/rest/v1/app_data') return rep([]);
    const brut = decodeURIComponent(u.pathname + u.search);
    if (H.latence) await new Promise((r) => setTimeout(r, H.latence));
    if (m === 'POST') {
      const prefer = enTete(opts, 'Prefer');
      const ins = [];
      for (const r of JSON.parse(opts.body || '[]')) {
        H.ecrits.push({ id: r.id, owner: r.owner || A, at: Date.now(), m: 'POST' });
        if (H.pannes.has('ecrire:' + r.id)) return rep('<html>522</html>', 522, 'text/html');
        const cle = `${r.owner || A}|${r.id}`;
        if (/ignore-duplicates/.test(prefer) && base.has(cle)) continue;
        base.set(cle, r.data); ins.push({ id: r.id });
      }
      return /return=representation/.test(prefer) ? rep(ins, 201) : new Response('', { status: 201 });
    }
    if (m === 'PATCH') {
      const corps = JSON.parse(opts.body || '{}');
      const t = filtrer(u);
      for (const l of t) { H.ecrits.push({ id: l.id, owner: l.owner, at: Date.now(), m: 'PATCH' }); if (H.pannes.has('ecrire:' + l.id)) return rep('<html>522</html>', 522, 'text/html'); base.set(`${l.owner}|${l.id}`, corps.data); }
      return rep(t.map((l) => ({ id: l.id })));
    }
    if (m === 'DELETE') { for (const l of filtrer(u)) base.delete(`${l.owner}|${l.id}`); return new Response('', { status: 204 }); }
    await attendreGate(H.gates, 'lire:' + brut);
    for (const p of H.pannes) if (p.startsWith('lire:') && brut.includes(p.slice(5))) { if (H.pannesN[p] != null) { if (H.pannesN[p] <= 0) continue; H.pannesN[p]--; } return new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } }); }
    const sel = u.searchParams.get('select') || '';
    if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);
    const corps = filtrer(u).map((l) => projeter(l, sel));
    // Une réponse CALCULÉE puis retenue (une lecture « en vol » qui arrive tard).
    await attendreGate(H.gatesApres, 'lire:' + brut);
    return rep(corps);
  }
  if (/mondialrelay|chronopost|vintedgo/.test(u.hostname)) {
    const n = u.searchParams.get('NumeroExpedition') || u.searchParams.get('skybillNumber') || (u.pathname.match(/tracking_events\/([^/]+)/) || [])[1] || '';
    const e = { url: String(url), hote: u.hostname, n, at: Date.now() };
    H.transporteur.push(e);
    if (H.carrier) return H.carrier(u, n, e);
    return rep('<html>404</html>', 404, 'text/html');
  }
  throw new Error('réseau coupé : ' + u.hostname);
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.send = () => r; r.end = () => r; return r; };
const importer = (p) => import('file://' + path.join(R, p));
const iso = (ms) => new Date(ms).toISOString();
const cpEv = (code, ms, libelle, extra = {}) => ({ code, ms, libelle, office: extra.office || 'VANNES - FR - TABAC TEST', zip: extra.zip || '99999', infos: extra.infos || {} });
const cpXml = (sky, evs) => `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns1:trackSkybillV2Response xmlns:ns1="http://cxf.tracking.soap.chronopost.fr/"><return><errorCode>0</errorCode><listEventInfoComp>${evs.map((e) => `<events><code>${e.code}</code><eventDate>${iso(e.ms)}</eventDate><eventLabel>${e.libelle}</eventLabel><officeLabel>${e.office}</officeLabel><zipCode>${e.zip}</zipCode>${Object.entries(e.infos).map(([k, v]) => `<infoCompList><name>${k}</name><value>${v}</value></infoCompList>`).join('')}</events>`).join('')}<skybillNumber>${sky}</skybillNumber></listEventInfoComp></return></ns1:trackSkybillV2Response></soap:Body></soap:Envelope>`;
const vgJson = (evs, meta = {}) => JSON.stringify({ tracking_events: evs.map((e, i) => ({ id: 'ev' + i, message: e.message || e.group, timestamp: iso(e.ms), metadata: { address: e.address || '' }, banner_message: null, group_header: null, group: e.group, state: e.state || 'delivery' })), meta });
const gate = (re, { apres = false, une = true, rang = 1 } = {}) => { let ouvrir; const p = new Promise((r) => { ouvrir = r; }); const g = { test: (q) => re.test(q), p, ouvrir, vu: false, une, fini: false, rang }; (apres ? H.gatesApres : H.gates).push(g); return g; };
const reset = () => {
  base.clear(); H.pannes = new Set(); H.pannesN = {}; H.gates = []; H.gatesApres = []; pushes.length = 0; H.ecrits.length = 0; H.transporteur.length = 0; H.carrier = null; H.latence = 0; H.comptes = [];
  for (const o of [A, B]) {
    base.set(`${o}|main`, { vrm_points_relais: [], vrm_colis_collected: [] });
    base.set(`${o}|push_subs`, { subs: [{ endpoint: `https://web.push.apple.com/${o === A ? 'iphoneA' : 'iphoneB'}` }] });
    base.set(`${o}|push_prefs`, { colis: true, suivi: true });
  }
};
let L = null;
const oublis = async () => {
  try { const p = await importer('api/_lib/push.js'); if (typeof p.oublierPrefsVues === 'function') p.oublierPrefsVues(); } catch (_) {}
  try { const a = await importer('api/_lib/abonnement.js'); if (typeof a.oublierAcces === 'function') a.oublierAcces(); } catch (_) {}
  try { const i = await importer('api/email-inbound.js'); if (typeof i.oublierMemoEnAttente === 'function') i.oublierMemoEnAttente(); } catch (_) {}
  if (L && typeof L._oublierPauseInstance === 'function') L._oublierPauseInstance();
};
const pause = (o) => base.get(`${NEUTRE}|transp_pause`) || base.get(`${o || A}|transp_pause`) || null;
const AUTH_A = { authorization: 'Bearer aaa.bbb.ccc' }, AUTH_B = { authorization: 'Bearer bbb.ccc.ddd' };
const lignEmail = (N, carrier, o = {}) => { const t0 = o.t0 || iso(Date.now() - 60 * 3600000); return { suivi: N, carrier, status: 'transit', sens: 'entrant', subject: 'Votre colis est en route', statusLabel: 'En transit', receivedAt: t0, emailAt: t0, ...o }; };
const vieillir = (owner, id, h = 3) => { const k = `${owner}|${id}`; const d = base.get(k); if (d) base.set(k, { ...d, essai: iso(Date.now() - h * 3600000) }); };

(async () => {
  L = await importer('api/_lib/transporteurs-lecture.js');
  const T = await importer('api/_lib/transporteurs.js');
  const relais = (await importer('api/relais.js')).default;
  const ecart0 = () => { if (typeof L._reglerPourBanc === 'function') L._reglerPourBanc({ ecartMs: 0 }); };
  const ecartProd = () => { if (typeof L._reglerPourBanc === 'function') L._reglerPourBanc({ ecartMs: L.ECART_MS || 1500 }); };
  const C5 = async (auth = AUTH_A, body = { v: 1 }) => { const res = faireRes(); await relais({ method: 'POST', query: { mode: 'transp' }, headers: auth, body }, res); return res; };
  const C4 = async (body, auth = AUTH_A) => { const res = faireRes(); await relais({ method: 'POST', query: { mode: 'transp-brut' }, headers: auth, body }, res); return res; };
  const now = Date.now(), h = (x) => now - x * 3600000;
  ecart0();

  // ══ N1 — UNE NOUVELLE ARRIVÉE SONNE (revue n° 12) ═════════════════════════
  if (veut('N1')) await essaie('N1 · nouvelle arrivée', async () => {
    const N = 'XW000000101TS', id = `transp_chronopost_${N}`;
    const AB_A = cpEv('AB', h(10), 'Colis disponible dans le point relais', { office: 'VANNES - FR - TABAC A', infos: { 'Point de livraison': 'TABAC A - 1 RUE EXEMPLE - 56000 - VANNES - FR' } });
    const prelude = [cpEv('DC', h(48), 'Envoi en cours de préparation'), cpEv('TT', h(30), "Colis en cours d'acheminement", { office: 'HUB - FR - CHILLY' })];
    const cas = {
      'autre point (« différent de celui prévu »)': [cpEv('TT', h(3), "Colis en cours d'acheminement", { office: 'HUB - FR - RENNES' }), cpEv('AB', h(1), 'Colis livré dans un point relais différent de celui prévu', { office: 'SAINT-MALO - FR - TABAC B', infos: { 'Point de livraison': 'TABAC B - 9 RUE AUTRE - 35400 - SAINT-MALO - FR' } })],
      'autre point, même libellé (seul le LIEU change)': [cpEv('TT', h(3), "Colis en cours d'acheminement", { office: 'HUB - FR - RENNES' }), cpEv('AB', h(1), 'Colis disponible dans le point relais', { office: 'SAINT-MALO - FR - TABAC C', infos: { 'Point de livraison': 'TABAC C - 3 RUE AUTRE - 35400 - SAINT-MALO - FR' } })],
    };
    for (const [nom, suite] of Object.entries(cas)) {
      reset(); await oublis();
      base.set(`${A}|email_track_chronopost_${N}`, lignEmail(N, 'chronopost'));
      let evs = [...prelude, AB_A];
      H.carrier = () => rep(cpXml(N, evs), 200, 'text/xml');
      await C5();
      const p1 = pushes.length;
      evs = [...prelude, AB_A, ...suite];
      vieillir(A, id); await oublis();
      await C5();
      const l = base.get(`${A}|${id}`) || {};
      const neuf = pushes.slice(p1).filter((p) => /disponible/.test(p.title || ''));
      dit(p1 === 1 && neuf.length === 1 && /TABAC [BC]/.test(neuf[0].body || ''), `${nom} : la NOUVELLE arrivée sonne (avec son lieu)`, `1re ${p1}, ensuite ${neuf.length} — ligne ${l.etat}/${l.detail} « ${l.lieuNom} »`);
      // La MÊME arrivée relue ne sonne pas une seconde fois.
      vieillir(A, id); await oublis();
      const p2 = pushes.length;
      await C5();
      dit(pushes.length === p2, `${nom} : la même arrivée relue ne sonne pas deux fois`, `${pushes.length - p2} de plus`);
    }
    // Retour au point après « a quitté le point relais — ne te déplace pas ».
    reset(); await oublis();
    base.set(`${A}|email_track_chronopost_${N}`, lignEmail(N, 'chronopost'));
    let evs = [...prelude, AB_A];
    H.carrier = () => rep(cpXml(N, evs), 200, 'text/xml');
    await C5();
    evs = [...prelude, AB_A, cpEv('TT', h(5), "Colis en cours d'acheminement", { office: 'VANNES - FR - TABAC A' })];
    vieillir(A, id); await oublis(); await C5();
    const pQuitte = pushes.filter((p) => /quitté/.test(p.title || '')).length;
    evs = [...prelude, AB_A, cpEv('TT', h(5), "Colis en cours d'acheminement", { office: 'VANNES - FR - TABAC A' }), cpEv('AB', h(1), 'Colis disponible dans le point relais', { office: 'VANNES - FR - TABAC A', infos: { 'Point de livraison': 'TABAC A - 1 RUE EXEMPLE - 56000 - VANNES - FR' } })];
    vieillir(A, id); await oublis();
    const p3 = pushes.length;
    await C5();
    const dispo = pushes.slice(p3).filter((p) => /disponible/.test(p.title || '')).length;
    dit(pQuitte === 1 && dispo === 1, 'revenu au point après « a quitté le point relais — ne te déplace pas » : il l\'APPREND', `quitté ${pQuitte}, de nouveau disponible ${dispo}`);
    // La première arrivée se tait toujours devant l'e-mail qui l'a annoncée.
    reset(); await oublis();
    base.set(`${A}|email_track_chronopost_${N}`, lignEmail(N, 'chronopost', { status: 'available', code: '123456' }));
    base.set(`${A}|push_dedup`, { keys: [`relais-${N}-code`, 'retrait-code-123456'] });
    H.carrier = () => rep(cpXml(N, [...prelude, AB_A]), 200, 'text/xml');
    await C5();
    dit(pushes.length === 0, 'la PREMIÈRE arrivée, déjà annoncée par l\'e-mail (même n°), se tait', `${pushes.length} notification(s)`);
  });

  // ══ N2 — « PAS SU » NE CONSOMME RIEN (revue n° 13) ════════════════════════
  if (veut('N2')) await essaie('N2 · hoquet au moment de sonner', async () => {
    const N = 'XW000000202TS', id = `transp_chronopost_${N}`;
    reset(); await oublis();
    base.set(`${A}|email_track_chronopost_${N}`, lignEmail(N, 'chronopost'));
    H.carrier = () => rep(cpXml(N, [cpEv('DC', h(48), 'Envoi en cours de préparation'), cpEv('AB', h(2), 'Colis disponible dans le point relais', { office: 'VANNES - FR - TABAC A', infos: { 'Point de livraison': 'TABAC A - 1 RUE EXEMPLE - 56000 - VANNES - FR' } })]), 200, 'text/xml');
    H.pannes.add('lire:id=eq.push_dedup');
    const r1 = await C5();
    const l1 = base.get(`${A}|${id}`) || {};
    dit(r1.code === 200 && l1.etat === 'disponible' && pushes.length === 0, 'la base hoquette sur `push_dedup` : la ligne est rangée, rien ne sonne encore', `HTTP ${r1.code}, ${l1.etat}, ${pushes.length} notif`);
    H.pannes.clear(); await oublis();
    vieillir(A, id, 1);
    await C5();
    const n2 = pushes.filter((p) => /disponible/.test(p.title || '')).length;
    dit(n2 === 1, 'base revenue : la notification « disponible » part au passage suivant', `${n2}`);
    vieillir(A, id, 1); await oublis();
    await C5(); await C5();
    const n3 = pushes.filter((p) => /disponible/.test(p.title || '')).length;
    const l3 = base.get(`${A}|${id}`) || {};
    dit(n3 === 1 && !l3.notifEnAttente, 'et une seule fois (plus rien en attente dans la ligne)', `${n3} · attente ${l3.notifEnAttente || 'aucune'}`);
  });

  // ══ N3 — SUIVI VINTED ET TRANSPORTEUR : UN ÉVÈNEMENT, UNE NOTIFICATION (n° 14)
  if (veut('N3')) await essaie('N3 · suivi Vinted et transporteur', async () => {
    const push = (await importer('api/push.js')).default;
    const cas = [
      ['retiré', 'VGS1234567890441', '30000000441', 'Ton colis a été récupéré', [{ group: 'delivered', state: 'delivery', ms: h(1), message: 'Colis récupéré' }, { group: 'ready_for_pickup', ms: h(20), message: 'Arrivé (Consigne Test)', address: '1 rue Test, 56000 Vannes' }]],
      ['en route', 'VGS1234567890442', '30000000442', 'Ton colis est en route', [{ group: 'in_transit', ms: h(1), message: 'Colis en transit' }, { group: 'created', ms: h(30), message: 'Créé' }]],
      ['repart', 'VGS1234567890443', '30000000443', 'Ton colis est retourné à l’expéditeur', [{ group: 'returned', state: 'return', ms: h(1), message: 'Retourné' }, { group: 'ready_for_pickup', ms: h(80), message: 'Arrivé (Consigne Test)' }]],
    ];
    for (const ordre of ['Vinted puis transporteur', 'transporteur puis Vinted']) {
      for (const [nom, N, TX, etape, evs] of cas) {
        reset(); await oublis();
        H.comptes = [{ owner: A, vinted_user_id: '111' }];
        base.set(`${A}|harvest_111_orders_purchased`, { payload: { my_orders: [{ transaction_id: Number(TX), title: 'Baskets banc', status: 'Colis expédié' }] } });
        base.set(`${A}|harvest_111_suivi_${TX}`, { v: 1, tx: TX, source: 'journey', capturedAt: iso(h(0.5)), etapes: [{ t: etape, at: iso(h(1)) }], dernier: { t: etape, at: iso(h(1)), code: 'x' }, transporteur: 'Vinted Go', suivi: N, forme: {} });
        H.carrier = () => rep(vgJson(evs), 200, 'application/json');
        const vinted = async () => { const r = faireRes(); await push({ method: 'POST', query: {}, headers: AUTH_A, body: { action: 'suivi', tx: TX, uid: '111' } }, r); return r; };
        if (ordre === 'Vinted puis transporteur') { await vinted(); await C5(); } else { await C5(); await vinted(); }
        dit(pushes.length === 1, `${ordre} · ${nom} : UNE notification pour un évènement`, pushes.map((p) => p.title).join(' | ') || 'aucune');
      }
    }
  });

  // ══ N4 — LA PAUSE EST CELLE DU SERVEUR (revue n° 15) ══════════════════════
  if (veut('N4')) await essaie('N4 · pause du serveur', async () => {
    const cron = (await importer('api/ship-reminders.js')).default;
    reset(); await oublis();
    const owners = [A, B, '22222222-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000005'];
    owners.forEach((o, i) => {
      base.set(`${o}|main`, { vrm_points_relais: [], vrm_colis_collected: [] });
      for (let j = 0; j < 3; j++) { const N = `XW${String(i * 10 + j).padStart(9, '0')}TS`; base.set(`${o}|email_track_chronopost_${N}`, lignEmail(N, 'chronopost', { t0: iso(h(20)) })); }
    });
    const CF = '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>cf</body></html>';
    H.carrier = () => rep(CF, 403, 'text/html');
    const r = faireRes();
    await cron({ method: 'GET', headers: { authorization: 'Bearer cle-banc-cron' }, query: {} }, r);
    const cp = H.transporteur.filter((x) => /chronopost/.test(x.hote));
    dit(cp.length === 1, 'cron, 5 vendeurs, Chronopost refuse (403) : UNE requête — les suivantes ne partent plus', `${cp.length} requête(s)`);
    const pn = base.get(`${NEUTRE}|transp_pause`);
    dit(!!(pn && pn.chronopost && Date.parse(pn.chronopost.jusqua) > Date.now()), 'la pause est rangée UNE fois, au propriétaire neutre (le refus vient de l\'adresse du serveur)', JSON.stringify(pn && pn.chronopost || null));
    // Une AUTRE instance (sa mémoire vide) : l'app d'un autre vendeur.
    if (typeof L._oublierPauseInstance === 'function') L._oublierPauseInstance();
    for (const k of [...base.keys()].filter((k) => k.startsWith(`${B}|transp_`))) base.delete(k);
    const avant = H.transporteur.length;
    await C5(AUTH_B);
    dit(H.transporteur.length === avant, 'une autre instance, un autre vendeur, juste après : aucune requête à Chronopost', `${H.transporteur.length - avant} de plus`);
  });

  // ══ N5 — COURSE E-MAIL / PASSAGE (revue n° 16) ════════════════════════════
  if (veut('N5')) await essaie('N5 · e-mail pendant le passage', async () => {
    const inbound = await importer('api/email-inbound.js');
    const N = 'VGS1234567890123';
    reset(); await oublis();
    base.set(`${A}|vrm_email_owners`, { adresses: { 'boite@banc.test': { owner: A } } });
    base.set(`${A}|email_track_vinted_${N}`, { suivi: N, carrier: 'vinted', status: 'transit', sens: 'entrant', subject: `Ton colis est en route #${N}`, receivedAt: iso(h(40)), emailAt: iso(h(40)) });
    H.carrier = () => rep(vgJson([{ group: 'ready_for_pickup', ms: h(0.5), message: 'Ton colis est arrivé (Consigne Test)', address: '1 rue Test, 56000 Vannes' }, { group: 'in_transit', ms: h(20) }], { expiration_time: iso(now + 4 * 86400000) }), 200, 'application/json');
    // La lecture de `push_dedup` par le passage est CALCULÉE (vide), puis
    // retenue ; l'e-mail passe ; puis on la relâche.
    const g = gate(/lire:.*id=eq\.push_dedup/, { apres: true });
    const pas = C5();
    for (let i = 0; i < 300 && !g.vu; i++) await new Promise((r) => setTimeout(r, 10));
    const res2 = faireRes();
    await inbound.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-suivi' }, body: { from: 'shipping@relay.vinted.com', to: 'boite@banc.test', subject: `Ton colis est arrivé à la consigne #${N}`, text: 'Bonjour,\nTon colis est arrivé à la consigne.\nCode de retrait : C65735\nAdresse\nConsigne Vinted Go\nConsigne Test\n1 rue Test\n56000 Vannes', html: '', attachments: [], messageId: '<vg-n5@banc>' } }, res2);
    g.ouvrir(); await pas;
    const dispo = pushes.filter((p) => /disponible|arrivé|retirer/i.test(`${p.title} ${p.body}`));
    dit(g.vu && dispo.length === 1, 'l\'e-mail « disponible » traité PENDANT le passage : une seule notification', `${g.vu ? '' : '(la lecture n\'a pas été retenue) '}${dispo.map((p) => p.tag).join(' | ')}`);
  });

  // ══ N6 — DEUX PASSAGES SIMULTANÉS (revue n° 17) ═══════════════════════════
  if (veut('N6')) await essaie('N6 · deux passages simultanés', async () => {
    const N = 'XW000000606TS';
    reset(); await oublis(); H.latence = 30;
    base.set(`${A}|email_track_chronopost_${N}`, lignEmail(N, 'chronopost', { t0: iso(h(20)) }));
    H.carrier = () => rep(cpXml(N, [cpEv('DC', h(30), 'Envoi en cours de préparation'), cpEv('TT', h(5), "Colis en cours d'acheminement", { office: 'HUB - FR - CHILLY' })]), 200, 'text/xml');
    ecartProd();
    await Promise.all([C5(), C5()]);
    ecart0();
    const n = H.transporteur.filter((x) => x.n === N).length;
    dit(n === 1, 'deux passages en même temps (iPhone + Mac) : UNE requête pour le même n° (le bail)', `${n} requête(s)`);
    const p0 = { v: 1, chronopost: { jusqua: iso(now + 30 * 60000), palier: 0, dernier: { statut: 403, ctype: 'text/html', at: iso(now - 1000) } } };
    const p1 = T.pauseApresRefus(p0, 'chronopost', { statut: 403, ctype: 'text/html', maintenant: now });
    dit(p1 === undefined || (p1.chronopost && p1.chronopost.palier === 0 && p1.chronopost.jusqua === p0.chronopost.jusqua), 'un second refus PENDANT la pause ne la fait pas monter d\'un palier', JSON.stringify(p1 && p1.chronopost || null));
  });

  // ══ N7 — C4 : UN ANCIEN N° NE SONNE PAS (revue n° 18) ═════════════════════
  if (veut('N7')) await essaie('N7 · C4 et la fermeture', async () => {
    const N = 'XW000000707TS';
    reset(); await oublis();
    base.set(`${A}|email_track_chronopost_${N}`, lignEmail(N, 'chronopost', { t0: iso(h(40 * 24)) }));
    const pz = { v: 1, chronopost: { jusqua: iso(now + 3600000), palier: 0, dernier: { statut: 403, ctype: 'text/html', at: iso(now - 60000) } } };
    base.set(`${NEUTRE}|transp_pause`, pz); base.set(`${A}|transp_pause`, pz);
    const corps = cpXml(N, [cpEv('DC', h(41 * 24), 'Envoi en cours de préparation'), cpEv('AB', h(30 * 24), 'Colis disponible dans le point relais', { office: 'VANNES - FR - TABAC A' }), cpEv('R', h(20), "Retour à l'expéditeur", { office: 'VANNES - FR - TABAC A' })]);
    const c4 = await C4({ v: 1, carrier: 'chronopost', suivi: N, voie: 'cp-ws2', statut: 200, ctype: 'text/xml', corps, at: iso(Date.now()), source: 'extension' });
    const l = base.get(`${A}|transp_chronopost_${N}`) || {};
    dit(c4.code === 200 && l.etat === 'retour_expediteur' && pushes.length === 0, 'un ANCIEN n° jamais fermé, lu par l\'extension (C4) : rangé, SANS notification (comme par le serveur)', `HTTP ${c4.code} ${l.etat} · ${pushes.map((p) => p.title).join(' | ') || 'aucune'}`);
  });

  // ══ N8 — C4 PÉRIMÉ, ÉTAT FINAL (revue n° 19) ══════════════════════════════
  if (veut('N8')) await essaie('N8 · C4 périmé, état final', async () => {
    const S = await importer('api/_lib/suivi-colis.js');
    const N = 'XW000000808TS', id = `transp_chronopost_${N}`;
    reset(); await oublis();
    base.set(`${A}|email_track_chronopost_${N}`, lignEmail(N, 'chronopost', { t0: iso(h(30)), status: 'available', subject: 'Votre colis est disponible', lieu: 'TABAC A, 1 rue Exemple, 56000 Vannes', code: '123456' }));
    const AB = cpEv('AB', h(28), 'Colis disponible dans le point relais', { office: 'VANNES - FR - TABAC A', infos: { 'Point de livraison': 'TABAC A - 1 RUE EXEMPLE - 56000 - VANNES - FR' } });
    const D = cpEv('D', h(0.2), 'Livraison effectuée', { office: 'VANNES - FR - TABAC A', infos: { 'Type de retrait': 'Retrait par le destinataire' } });
    H.carrier = () => rep(cpXml(N, [cpEv('DC', h(48), 'prépa'), AB, D]), 200, 'text/xml');
    await C5();
    const essai0 = (base.get(`${A}|${id}`) || {}).essai;
    const c4 = await C4({ v: 1, carrier: 'chronopost', suivi: N, voie: 'cp-ws2', statut: 200, ctype: 'text/xml', corps: cpXml(N, [cpEv('DC', h(48), 'prépa'), AB]), at: iso(h(1)), source: 'extension' });
    const l = base.get(`${A}|${id}`) || {};
    const t = T.ligneTranspDeMeta({ id, ...metaDe(l) });
    const fins = S.finsDesLignes([base.get(`${A}|email_track_chronopost_${N}`)], { transp: [t] });
    dit(l.etat === 'retire' && l.fini === true && S.sortiParSuivis([N], fins, h(30)) === 'retire', 'une réponse relayée lue AVANT la lecture du serveur : le colis retiré RESTE retiré', `HTTP ${c4.code} ${JSON.stringify(c4.corps)} · ${l.etat}`);
    dit(c4.code === 409 && l.essai === essai0, 'elle est refusée (« périmée »), rien n\'est réécrit', `HTTP ${c4.code} · essai ${l.essai === essai0 ? 'inchangé' : 'réécrit'}`);
    const fin = T.ligneApresEssai({ v: 1, carrier: 'chronopost', suivi: N, etat: 'retire', etatAt: iso(h(1)), essaiRes: 'ok', lu: iso(h(1)), fini: true }, { res: 'ok', etat: 'disponible', etatAt: iso(h(20)), evenements: [] }, { carrier: 'chronopost', suivi: N, maintenant: now });
    dit(fin.etat === 'retire' && fin.fini === true, 'la règle de la ligne : un état FINAL (retiré, livré, rendu) ne redescend jamais sur une lecture plus pauvre', `${fin.etat} fini=${fin.fini}`);
  });

  // ══ N9 — LES BORNES (revue n° 20) ═════════════════════════════════════════
  if (veut('N9')) await essaie('N9 · bornes de temps', async () => {
    const cron = (await importer('api/ship-reminders.js')).default;
    const seme = () => { for (let i = 1; i <= 8; i++) { const N = `XW00000090${i}TS`; base.set(`${A}|email_track_chronopost_${N}`, lignEmail(N, 'chronopost', { t0: iso(h(20)) })); } };
    const lent = (ms) => async (u, n) => { await new Promise((r) => setTimeout(r, ms)); return rep(cpXml(n, [cpEv('DC', h(30), 'prépa'), cpEv('TT', h(5), 'acheminement', { office: 'HUB - FR - X' })]), 200, 'text/xml'); };
    ecartProd();
    reset(); await oublis(); seme(); H.carrier = lent(4500); H.latence = 250;
    await new Promise((r) => setTimeout(r, 2000));   // l'écart du scénario d'avant est passé
    let t = Date.now();
    await C5();
    const dur = (Date.now() - t) / 1000;
    dit(dur <= 12.2, 'le relais (C5, budget 12 s) répond dans son budget — transporteur lent, base lente', `${dur.toFixed(1)} s, ${H.transporteur.length} lecture(s)`);
    // Le cron : la lecture de la ligne au moment de RANGER est retenue au-delà
    // des 20 s du filet ; le cron répond ; on relâche — plus rien ne doit partir.
    reset(); await oublis(); H.latence = 0;
    const N = 'XW000000909TS';
    base.set(`${A}|email_track_chronopost_${N}`, lignEmail(N, 'chronopost', { t0: iso(h(20)) }));
    H.carrier = () => rep(cpXml(N, [cpEv('DC', h(30), 'prépa'), cpEv('TT', h(5), 'acheminement', { office: 'HUB - FR - X' })]), 200, 'text/xml');
    const g = gate(new RegExp(`lire:.*id=eq\\.transp_chronopost_${N}&`), { rang: 2 });
    t = Date.now();
    const rc = faireRes();
    await cron({ method: 'GET', headers: { authorization: 'Bearer cle-banc-cron' }, query: {} }, rc);
    const tRep = Date.now();
    const eRep = H.ecrits.filter((e) => /^transp_|^push_dedup/.test(e.id)).length, pRep = pushes.length;
    g.ouvrir();
    await new Promise((r) => setTimeout(r, 2500));
    const apres = { ecritures: H.ecrits.filter((e) => /^transp_|^push_dedup/.test(e.id)).length - eRep, notifs: pushes.length - pRep };
    const bilan = JSON.stringify(rc.corps || {});
    dit(g.vu && apres.ecritures === 0 && apres.notifs === 0, 'le cron a répondu (filet des 20 s) : plus aucune écriture ni notification ne part ensuite', `${g.vu ? '' : '(rien retenu) '}réponse à ${((tRep - t) / 1000).toFixed(1)} s · après : ${JSON.stringify(apres)}`);
    dit(/"transporteurs":\{"fait":false,"reason":"delai"\}/.test(bilan), 'et son bilan le dit (« délai »)', (bilan.match(/"transporteurs":\{[^}]*\}/) || [''])[0]);
    ecart0();
  });

  // ══ N10 — LES 72 H JUGENT L'ÉVÈNEMENT QUI FAIT L'ÉTAT (revue n° 21) ══════
  if (veut('N10')) await essaie('N10 · garde des 72 h', async () => {
    reset(); await oublis();
    const N = 'XW000001010TS';
    base.set(`${A}|email_track_chronopost_${N}`, lignEmail(N, 'chronopost', { t0: iso(h(9 * 24 + 2)), status: 'available', subject: 'Votre colis est disponible', lieu: 'TABAC A, 1 rue Exemple, 56000 Vannes' }));
    base.set(`${A}|push_dedup`, { keys: [`relais-${N}-code`] });
    H.carrier = () => rep(cpXml(N, [cpEv('AB', h(9 * 24), 'Colis disponible dans le point relais', { office: 'VANNES - FR - TABAC A' }), cpEv('R', h(6 * 24), "Retour à l'expéditeur", { office: 'VANNES - FR - TABAC A' }), cpEv('TT', h(20), "Colis en cours d'acheminement", { office: 'HUB - FR - CHILLY' })]), 200, 'text/xml');
    await C5();
    const l = base.get(`${A}|transp_chronopost_${N}`) || {};
    dit(l.etat === 'retour_expediteur' && pushes.length === 0, 'Chronopost : R il y a 6 jours, dernier TT hier ⇒ PAS de « repart » comme neuf', `${l.etat} etatAt ${l.etatAt} · ${pushes.map((p) => p.title).join(' | ') || 'aucune'}`);
    reset(); await oublis();
    const V = 'VGS1234567891010';
    base.set(`${A}|email_track_vinted_${V}`, { suivi: V, carrier: 'vinted', status: 'available', sens: 'entrant', subject: `Ton colis est arrivé #${V}`, receivedAt: iso(h(8 * 24)), emailAt: iso(h(8 * 24)) });
    base.set(`${A}|push_dedup`, { keys: [`relais-${V}-code`] });
    H.carrier = () => rep(vgJson([{ group: 'return_in_transit', state: 'return', ms: h(18), message: 'Retour en cours' }, { group: 'return_created', state: 'return', ms: h(5 * 24), message: 'Retour créé' }, { group: 'ready_for_pickup', ms: h(8 * 24), message: 'Arrivé (Consigne Test)' }]), 200, 'application/json');
    await C5();
    const l2 = base.get(`${A}|transp_vinted_${V}`) || {};
    dit(l2.etat === 'retour_expediteur' && pushes.length === 0, 'Vinted Go : retour créé il y a 5 jours, dernier évènement hier ⇒ PAS de « repart » comme neuf', `${l2.etat} etatAt ${l2.etatAt} · ${pushes.map((p) => p.title).join(' | ') || 'aucune'}`);
    // L'autre sens : un retour d'il y a 2 h sonne.
    reset(); await oublis();
    const N2 = 'XW000001011TS';
    base.set(`${A}|email_track_chronopost_${N2}`, lignEmail(N2, 'chronopost', { t0: iso(h(50)), status: 'available', subject: 'Votre colis est disponible' }));
    base.set(`${A}|push_dedup`, { keys: [`relais-${N2}-code`] });
    H.carrier = () => rep(cpXml(N2, [cpEv('AB', h(48), 'Colis disponible dans le point relais', { office: 'VANNES - FR - TABAC A' }), cpEv('R', h(2), "Retour à l'expéditeur", { office: 'VANNES - FR - TABAC A' })]), 200, 'text/xml');
    await C5();
    dit(pushes.filter((p) => /repart/.test(p.title || '')).length === 1, 'l\'autre sens : un retour d\'il y a 2 h sonne', pushes.map((p) => p.title).join(' | ') || 'aucune');
  });

  // ══ TOUR 2 (29 oct.) — LES COURSES ENTRE VOIES, LES RELECTURES ══════════
  const attendre = async (f, n = 500) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 10)); return f(); };
  const inbound = await importer('api/email-inbound.js');
  const routePush = (await importer('api/push.js')).default;
  const email = async (subject, text, mid) => { const r = faireRes(); await inbound.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-suivi' }, body: { from: 'shipping@relay.vinted.com', to: 'boite@banc.test', subject, text, html: '', attachments: [], messageId: mid } }, r); return r; };
  const prepDispoVg = (N, code) => {
    base.set(`${A}|vrm_email_owners`, { adresses: { 'boite@banc.test': { owner: A } } });
    base.set(`${A}|email_track_vinted_${N}`, { suivi: N, carrier: 'vinted', status: 'available', sens: 'entrant', subject: `Ton colis est arrivé à la consigne #${N}`, receivedAt: iso(h(30)), emailAt: iso(h(30)), arriveLe: iso(h(30)), code });
    base.set(`${A}|transp_vinted_${N}`, { v: 1, suivi: N, carrier: 'vinted', etat: 'disponible', etatAt: iso(h(29)), lu: iso(h(3)), essai: iso(h(3)), essaiRes: 'ok', essais: 0, lieuNom: 'Consigne Test', arrivees: [] });
  };
  const vgRetire = () => rep(vgJson([{ group: 'delivered', state: 'delivery', ms: h(0.2), message: 'Delivered' }, { group: 'ready_for_pickup', ms: h(29), message: 'Ready (Consigne Test)', address: '1 rue Test, 56000 Vannes' }]), 200);

  // ══ N11 — L'E-MAIL « RETIRÉ » PENDANT LE PASSAGE DU TRANSPORTEUR (n° 15) ══
  if (veut('N11')) await essaie('N11 · e-mail et transporteur, même retrait', async () => {
    const N = 'VGS1234567890501';
    reset(); await oublis(); prepDispoVg(N, 'C11111');
    let lacher; const tenu = new Promise((r) => { lacher = r; }); let appele = false;
    H.carrier = async () => { appele = true; await tenu; return vgRetire(); };
    const pas = C5();
    await attendre(() => appele);
    const g = gate(/lire:.*id=eq\.push_dedup/, { apres: true });
    const em = email(`Ton colis a été récupéré #${N}`, 'Bonjour,\nTon colis a été récupéré par le destinataire.', '<n11@banc>');
    await attendre(() => g.vu);
    lacher(); await pas;
    g.ouvrir(); await em;
    const retires = pushes.filter((p) => /retir|récup|livr/i.test(p.title || ''));
    dit(g.vu && appele && retires.length === 1, 'l\'e-mail « retiré » lu pendant que le transporteur annonce « retiré » : UN seul « retiré »', `${retires.length} notification(s)`);
    // Un e-mail sur un AUTRE colis, écrit depuis une lecture d'avant le passage, n'efface pas la clé du transporteur.
    const M = 'VGS1234567890503';
    reset(); await oublis(); prepDispoVg(N, 'C22222');
    let lacher2; const tenu2 = new Promise((r) => { lacher2 = r; }); let appele2 = false;
    H.carrier = async () => { appele2 = true; await tenu2; return vgRetire(); };
    const pas2 = C5();
    await attendre(() => appele2);
    const g2 = gate(/lire:.*id=eq\.push_dedup/, { apres: true });
    const em2 = email(`Ton colis a été récupéré #${M}`, 'Bonjour,\nTon colis a été récupéré par le destinataire.', '<n11b@banc>');
    await attendre(() => g2.vu);
    lacher2(); await pas2;
    g2.ouvrir(); await em2;
    const keys = (base.get(`${A}|push_dedup`) || {}).keys || [];
    const p0 = pushes.length;
    await email(`Ton colis a été récupéré #${N}`, 'Bonjour,\nTon colis a été récupéré par le destinataire.', '<n11c@banc>');
    const encore = pushes.slice(p0).filter((p) => (p.tag || '').includes(N) || /retir|récup/i.test(p.title || ''));
    dit(keys.some((k) => k.includes(N)) && encore.length === 0, 'l\'e-mail d\'un AUTRE colis n\'efface pas la clé posée par le transporteur', `clé ${keys.some((k) => k.includes(N)) ? 'présente' : 'EFFACÉE'}, puis le « retiré » de ce colis sonne ${encore.length} fois de plus`);
    // L'autre sens : un e-mail « retiré » seul sonne.
    reset(); await oublis(); prepDispoVg(N, 'C33333');
    await email(`Ton colis a été récupéré #${N}`, 'Bonjour,\nTon colis a été récupéré par le destinataire.', '<n11d@banc>');
    dit(pushes.filter((p) => /retir|récup|livr/i.test(p.title || '')).length === 1, 'l\'autre sens : l\'e-mail « retiré » seul sonne une fois', pushes.map((p) => p.title).join(' | ') || 'aucune');
  });

  // ══ N12 — LE SUIVI VINTED ET LE TRANSPORTEUR, LA MÊME ARRIVÉE (n° 16) ═════
  if (veut('N12')) await essaie('N12 · suivi Vinted « disponible » et transporteur', async () => {
    const N = 'VGS1234567890601', TX = '30000000601';
    reset(); await oublis();
    H.comptes = [{ owner: A, vinted_user_id: '111' }];
    base.set(`${A}|harvest_111_orders_purchased`, { payload: { my_orders: [{ transaction_id: Number(TX), title: 'Baskets banc', status: 'Colis déposé au point relais' }] } });
    base.set(`${A}|harvest_111_suivi_${TX}`, { v: 1, tx: TX, source: 'journey', capturedAt: iso(h(0.3)), etapes: [{ t: 'Ton colis est disponible au point relais', at: iso(h(0.5)) }], dernier: { t: 'Ton colis est disponible au point relais', at: iso(h(0.5)), code: 'x' }, transporteur: 'Vinted Go', suivi: N, forme: {} });
    H.carrier = () => rep(vgJson([{ group: 'ready_for_pickup', ms: h(0.5), message: 'Ready (Consigne Test)', address: '1 rue Test, 56000 Vannes' }, { group: 'in_transit', ms: h(20), message: 'In transit' }], { expiration_time: iso(now + 5 * 86400000) }), 200);
    const g = gate(/lire:.*id=eq\.panel_colis_relais/, { apres: true });
    const vinted = (async () => { const r = faireRes(); await routePush({ method: 'POST', query: {}, headers: AUTH_A, body: { action: 'suivi', tx: TX, uid: '111' } }, r); return r; })();
    await attendre(() => g.vu);
    await C5();
    g.ouvrir(); await vinted;
    dit(g.vu && pushes.length === 1, 'suivi Vinted et transporteur, la même arrivée, en même temps : UNE notification', `${pushes.length} · ${pushes.map((p) => p.title).join(' | ')}`);
  });

  // ══ N13 — UN ANCIEN N° DONT LA 1RE LECTURE RATE EST RELU (n° 18) ══════════
  if (veut('N13')) await essaie('N13 · fermeture relue après un raté', async () => {
    const N = 'XW000000909TS';
    reset(); await oublis();
    base.set(`${A}|email_track_chronopost_${N}`, lignEmail(N, 'chronopost', { status: 'available', subject: 'Votre colis est disponible', t0: iso(h(40 * 24)), lieu: 'Tabac test 56000 Vannes' }));
    let n = 0;
    H.carrier = () => { n++; if (n === 1) return rep('', 503, 'text/plain'); return rep(cpXml(N, [cpEv('AB', h(39 * 24), 'Colis disponible dans le point relais'), cpEv('D', h(38 * 24), 'Livraison effectuée', { infos: { 'Type de retrait': 'Relais' } })]), 200, 'text/xml'); };
    await C5();
    vieillir(A, `transp_chronopost_${N}`, 24); await oublis();
    await C5();
    const l2 = base.get(`${A}|transp_chronopost_${N}`) || {};
    dit(n >= 2 && l2.etat === 'retire', 'un ancien n° dont la 1re lecture a raté (503) est relu après son recul', `${n} lecture(s), état ${l2.etat || '—'} (${l2.essaiRes})`);
    dit(pushes.length === 0, 'et il ne sonne pas (un ancien colis, fermeture)', pushes.map((p) => p.title).join(' | ') || 'aucune');
    // L'autre sens : un n° qui a raté 5 fois n'est plus relu.
    const t5 = { lu: null, etat: null, fini: false, essaiRes: 'passu', essais: T.FERMETURE_ESSAIS_MAX || 5 };
    dit(T.jamaisLueAvecSucces(t5) === false && T.jamaisLueAvecSucces({ ...t5, essais: 1 }) === true, 'l\'autre sens : au bout de 5 essais ratés, il n\'est plus relu', `5 → ${T.jamaisLueAvecSucces(t5)}, 1 → ${T.jamaisLueAvecSucces({ ...t5, essais: 1 })}`);
  });

  // ══ N14 — MONDIAL RELAY : _mvc PUIS .be, LA MÊME ARRIVÉE (n° 17) ══════════
  if (veut('N14')) await essaie('N14 · même arrivée Mondial Relay, deux voies', async () => {
    const N = '30000004', CP = '35000';
    reset(); await oublis();
    base.set(`${A}|email_track_mondialrelay_${N}`, { suivi: N, carrier: 'mondialrelay', status: 'available', sens: 'entrant', subject: 'Votre colis est disponible', receivedAt: iso(h(3)), emailAt: iso(h(3)), arriveLe: iso(h(3)), lieu: 'Tabac test 35000 Rennes' });
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(h(2))).map((x) => [x.type, x.value]));
    const ET = ["Colis en préparation chez l'expéditeur", 'Colis remis à Mondial Relay', "Colis sur l'agence de livraison", 'Colis disponible au point de retrait', 'Colis livré au destinataire'];
    const frag = `<div><ul class="timeline suivi">${ET.map((e, i) => `<li${i < 4 ? ' class="validate"' : ''}><p>${e}</p></li>`).join('')}</ul><div class="infos-account"><div><p>${p.day}/${p.month}/${p.year}</p></div><div class="detail-infos"><div class="step-suivi"><div class="c"><p class="center">${p.hour}:${p.minute}</p></div><div class="d"><p>5 jours restants pour retirer le colis en Point Relais</p></div></div></div></div><script>var numeroExpedition = '${N}';</script><script>dataLayer.push({ 'CodePostal' : '${CP}' });</script></div>`;
    H.carrier = () => rep({ Success: true, ModelState: [], Message: frag, Action: 'ReplaceDiv', Data: false }, 200);
    await C5();
    const p1 = pushes.length;
    const isoLocal = `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.316`;
    const be = JSON.stringify({ Expedition: { Numero: N, DestinataireCodePostal: CP, DeliveryMode: '24R', SuiviParEtapes: { 4: { Evenement: { Date: isoLocal } } }, Evenements: [{ Date: isoLocal, Libelle: '5 jours restants pour retirer le colis en Point Relais ', DetailPointRelais: { Adresse: { Libelle: 'TABAC TEST', CodePostal: CP, Ville: 'RENNES' } } }] } });
    await new Promise((r) => setTimeout(r, 20));
    const c4 = await C4({ v: 1, carrier: 'mondialrelay', suivi: N, cp: CP, voie: 'mr-be', statut: 200, ctype: 'application/json', corps: be, at: new Date().toISOString(), source: 'extension' });
    const l = base.get(`${A}|transp_mondialrelay_${N}`) || {};
    dit(p1 === 1 && pushes.length === 1, 'la même arrivée Mondial Relay (serveur sans lieu, puis extension avec lieu) ne sonne qu\'une fois', `serveur ${p1}, extension ${pushes.length - p1} de plus · C4 ${c4.code}`);
    dit(/tabac/i.test(String(l.lieuNom || l.lieu || '')), 'et le lieu apporté par l\'extension est gardé (un enrichissement)', `lieu « ${l.lieuNom || l.lieu || ''} »`);
  });

  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ tout est vert');
  process.exit(ko ? 1 : 0);
})();
