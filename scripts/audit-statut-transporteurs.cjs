#!/usr/bin/env node
// AUDIT (24 oct.) — LE STATUT PUBLIC D'UN COLIS, LU CHEZ SON TRANSPORTEUR.
// Julien : « tu as juste à regarder sur le site du transporteur, je ne te
// demande pas le code de retrait mais juste de regarder le statut ».
// Ce que ce contrôle EXÉCUTE (jamais une relecture du code) :
//   · les analyseurs purs (api/_lib/transporteurs.js) sur des réponses
//     INVENTÉES à la forme MESURÉE le 24 oct. : Chronopost trackSkybillV2 (XML),
//     Vinted Go v3 (JSON), Mondial Relay par la route `_mvc` de mondialrelay.fr
//     (JSON qui porte un fragment HTML — la voie du SERVEUR, et celle que C3
//     annonce à l'extension en secours) et par l'API .be (relayée en C4) ;
//   · la priorité (le transporteur fait monter, jamais descendre) et les fins
//     (api/_lib/suivi-colis.js) ;
//   · la sélection (jamais un n° sortant, jamais un sens « pas su »), le rythme,
//     la pause ;
//   · le RÉSEAU (api/_lib/transporteurs-lecture.js) et les vraies routes
//     api/relais (C3, C4, C5), api/widget, api/ship-reminders, sur une fausse
//     base À ÉTAT (comparer-et-échanger sur `data->>rev`) et de faux
//     transporteurs qui comptent ce qu'on leur envoie.
// Aucune donnée réelle : n° 12345678, XW000000001TS, 1234567890123456, points
// relais inventés (« TABAC TEST », 99999 Testville).
// `--prouve` : réaffaiblit la règle ; chaque mutation doit rendre ROUGE.
// §6.1 : lancé depuis un arbre d'avant (AUDIT_RACINE ou copié dedans), il est rouge.
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

const MUTATIONS = {
  // Les douze du plan (§5), puis celles de la route `_mvc` (24 oct., 11:51 UTC).
  'chrono-dernier-evenement': ['api/_lib/transporteurs.js', '  if (iR >= 0) {', '  if (false) {'],
  'en-route-fait-descendre': ['api/_lib/suivi-colis.js', "  if (t.etat !== 'disponible') return l;", "  if (t.etat === 'en_route' && (l.status != null ? l.status : l.s) === 'available') return { ...l, status: 'transit' };\n  if (t.etat !== 'disponible') return l;"],
  'passu-lu-vide': ['api/_lib/transporteurs.js', '    out.essais = (Number(a.essais) || 0) + 1;', "    out.essais = (Number(a.essais) || 0) + 1; if (res === 'passu') { out.etat = null; out.lu = null; }"],
  'sortant-interroge': ['api/_lib/transporteurs.js', '    if (envoyesN.has(e.k) || e.sortant || !e.entrant) continue;', '    if (!e.entrant && !e.sortant) continue;'],
  'cp-echo-be-ignore': ['api/_lib/transporteurs.js', '  if (numero !== n || !c || cpRendu !== c) return', '  if (numero !== n) return'],
  'vg-limite-apres-retrait': ['api/_lib/transporteurs.js', "    return rendu('ok', { ...base, etat: 'retire', lieuNom: nomPoint(), ...(pret ? lieuDe(pret.lieu) : {}) });", "    return rendu('ok', { ...base, etat: 'retire', lieuNom: nomPoint(), ...(pret ? lieuDe(pret.lieu) : {}), limite: msDe(j.meta && j.meta.expiration_time) ? jourParis(msDe(j.meta.expiration_time)) : null, limiteSure: true });"],
  'notif-sans-push-dedup': ['api/_lib/transporteurs-notif.js', '    if (ks.some((x) => exactes.includes(x) || prefixes.some((p) => x.startsWith(p)))) return undefined;\n', ''],
  'notif-sans-reservation': ['api/_lib/transporteurs-notif.js', 'keys: [...aEcrire.filter((x) => !ks.includes(x)), ...ks].slice(0, 300)', 'keys: ks'],
  'libelle-inconnu-en-route': ['api/_lib/transporteurs.js', "  if (dernier && !classeMr(dernier.libelle)) return rendu('ok', { ...base, etat: 'inconnu' });", ''],
  'mvc-libelle-inconnu-en-route': ['api/_lib/transporteurs.js', "  if (!classeMr(dernier.libelle)) return rendu('ok', { ...base, etat: 'inconnu' });", ''],
  'fermeture-notifie': ['api/_lib/transporteurs-lecture.js', "silence: it.raison === 'fermeture',", 'silence: false,'],
  'expire-lu-livre': ['api/_lib/transporteurs.js', '  if (s === 404) return rendu(', "  if (s === 404 && j && j.error_code === 'shipment_expired') return rendu('ok', { etat: 'livre', etatAt: isoDe(Date.now()) });\n  if (s === 404) return rendu("],
  'relecture-sans-intervalle': ['api/_lib/transporteurs.js', 'export function prochainEssai(t) {\n  if (!t) return 0;', 'export function prochainEssai(t) {\n  return 0;'],
  'pause-ignoree': ['api/_lib/transporteurs-lecture.js', 'const pauseEnCours = (p, carrier) => T.enPause(pauseConnue(p), carrier, Date.now());', 'const pauseEnCours = () => false;'],
  // ── Mondial Relay par le serveur (route `_mvc`) ──
  'mvc-echo-numero-ignore': ['api/_lib/transporteurs.js', '  if (!mN || numero !== n || !c || (mC && cpRendu !== c)) return', '  if (!c) return'],
  'mvc-echo-cp-ignore': ['api/_lib/transporteurs.js', '  if (!mN || numero !== n || !c || (mC && cpRendu !== c)) return', '  if (!mN || numero !== n || !c) return'],
  'mvc-voie-ignoree': ['api/_lib/transporteurs.js', "  if (carrier === 'mondialrelay') return opts && opts.voie === 'mr-fr-mvc' ?", "  if (carrier === 'mondialrelay') return false ?"],
  'mvc-frise-devinee': ['api/_lib/transporteurs.js', '  if (lis.length !== 5) return', '  if (!lis.length) return'],
  'mvc-refus-garde': ['api/_lib/transporteurs.js', "  const refusServeur = (t) => !!t && t.essaiRes === 'bloque' && t.essaiSource !== 'extension' && t.essaiSource !== 'page';", '  const refusServeur = (t) => false;'],
  'mvc-lieu-efface': ['api/_lib/transporteurs.js', "    if (lu.lieuNonLu) for (const k of ['lieuNom', 'lieuVille', 'lieuCp']) out[k] = a[k] == null ? '' : a[k];", ''],
  'mvc-entetes-retires': ['api/_lib/transporteurs-lecture.js', "  mondialrelay: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },", ''],
  'mr-serveur-eteint': ['api/_lib/transporteurs.js', 'export const LECTURE_SERVEUR_TRANSP = Object.freeze({ chronopost: true, vinted: true, mondialrelay: true });', 'export const LECTURE_SERVEUR_TRANSP = Object.freeze({ chronopost: true, vinted: true, mondialrelay: false });'],
  'c3-mr-toujours': ['api/_lib/transporteurs.js', '    if (!(refusServeur(t) || enPause(pause, it.carrier, maintenant))) continue;', "    if (it.carrier !== 'mondialrelay' && !(refusServeur(t) || enPause(pause, it.carrier, maintenant))) continue;"],
  // (29 oct.) La règle du code postal vit dans `resultatMondialRelay` (serveur ET C4).
  'essai-cp-compte-echec': ['api/_lib/transporteurs-lecture.js', "      if (carrier === 'mondialrelay') lu = T.resultatMondialRelay(lu, { cp, cpSource, cpEssaye, transp: b.transp.get(it.suivi) });", ''],
  // (fusion) C3 annonce à l'extension la route `_mvc` (`mr-fr-mvc`) : la seule
  // que l'extension 5.281 lit d'abord (de `mr-be`, elle ne passe à `_mvc` qu'en repli).
  'c3-voie-be': ['api/_lib/transporteurs.js', "export const VOIE_DE = { mondialrelay: 'mr-fr-mvc',", "export const VOIE_DE = { mondialrelay: 'mr-be',"],
  // (fusion) Le code postal de la page : un ESSAI (jamais « introuvable »), et
  // il suit le n° demandé seul jusqu'à l'extension.
  'cp-page-prouve': ['api/_lib/transporteurs-lecture.js', "if ((cpSource === 'essai' || cpSource === 'page') && !(t && t.cp === cp)) cpEssaye = cp;", "if (cpSource === 'essai' && !(t && t.cp === cp)) cpEssaye = cp;"],
  'c3-cp-page-ignore': ['api/_lib/transporteurs.js', "      const cp = it.cp || (seul && normaliserSuivi(seul) === it.suivi && /^\\d{5}$/.test(String(cpSeul || '')) ? String(cpSeul) : '');", '      const cp = it.cp;'],
  // ── Le widget suit la règle de l'app (§11, trouvé au banc `transporteurs.cjs`) ──
  'widget-transp-dispo-ignore': ['api/widget.js', '      return (dispoSuivi.has(k) || tDispo.has(k)) ? false : true;', '      return dispoSuivi.has(k) ? false : true;'],
  'widget-garde-non-levee': ['api/widget.js', ', leveDepuisTransp(suivisLus));', ');'],
  // ── (29 oct.) Tour 1 du chantier « règles, états, écran » (section 9) ──
  'vg-retour-annule': ['api/_lib/transporteurs.js', "const estRetourVg = (e) => VG_RETOUR_GROUPES.has(e.group) || (e.state === 'return' && VG_GROUPES_DE_ROUTE.has(e.group));", "const estRetourVg = (e) => e.state === 'return' || /^return/.test(e.group) || e.group === 'returned';"],
  'vg-heure-jetee': ['api/_lib/transporteurs.js', 'limiteSure: !!exp, limiteAt: exp ? isoDe(exp) : null });', 'limiteSure: !!exp, limiteAt: null });'],
  'heure-limite-ignoree': ['api/_lib/retrait-colis.js', "if (maintenant >= atMs) return { etat: 'delai_depasse', jours: j, heurePassee: true", "if (false) return { etat: 'delai_depasse', jours: j, heurePassee: true"],
  'rappel-sans-heure': ['api/_lib/suivi-colis.js', "  const heure = x.limiteAt ? heureParis(x.limiteAt) : '';", "  const heure = '';"],
  'mr-route-apres-arrivee': ['api/_lib/transporteurs.js', 'function apresArriveeMr(evs, arr) {\n  if (!arr || !Number.isFinite(arr.ms)) return null;', 'function apresArriveeMr(evs, arr) {\n  return null;'],
  'garde-vers-passee': ['api/_lib/suivi-colis.js', '  if (l.limiteVers) { const j = joursAvantLimite(l.limiteVers, aujourdhui || jourParis(maintenant)); if (j == null || j < 0) return e; }', ''],
  'mr-cp-saisi-introuvable': ['api/_lib/transporteurs.js', "  if (lu.res === 'introuvable' && (essaye || !prouve)) return", "  if (lu.res === 'introuvable' && essaye) return"],
  'mr-fini-jamais-relu': ['api/_lib/transporteurs.js', '  const mrRelisible = !!(t && t.fini &&', '  const mrRelisible = false && !!(t && t.fini &&'],
  'widget-fenetre-45j': ['api/widget.js', '  const transp = Array.isArray(transp0) ? transp0.map(ligneTranspDeMeta).filter(Boolean) : null;', '  const transp = Array.isArray(transp0) ? transp0.map(ligneTranspDeMeta).filter((t) => t && (!t.fini || Date.now() - Date.parse(t.lu || t.essai || 0) < 45 * 86400000)) : null;'],
  'cron-fenetre-45j': ['api/ship-reminders.js', '  const transp = transp0.map(ligneTranspDeMeta).filter(Boolean);', '  const transp = transp0.map(ligneTranspDeMeta).filter((t) => t && (!t.fini || Date.now() - Date.parse(t.lu || t.essai || 0) < 45 * 86400000));'],
  'widget-incident-sorti': ['api/widget.js', "  return so === 'retire' || so === 'reparti' ? true : (so === 'a_verifier' ? 'a_verifier' : null);", '  return so ? true : null;'],
  'widget-dispo-apres-photo': ['api/widget.js', "    if (!t || t.etat !== 'disponible') continue;", '    if (true) continue;'],
  'widget-en-verification': ['api/widget.js', ' || pubRetirer.enVerification > 0,', ','],
  'widget-borne-arrivee': ['api/widget.js', '  const so = sortiParSuivis(ks, fins, c && c[4] === 0 ? null : arr, { borne: arr });', '  const so = sortiParSuivis(ks, fins, arr);'],
  'rappel-synthetique': ['api/_lib/suivi-colis.js', '      const syn = ligneDuTransporteur(t, maintenant); if (syn) lignes.push(syn);', ''],
  'rappel-coche-ignoree': ['api/_lib/suivi-colis.js', '      if (nLignes.has(k) || envoyesN.has(k) || cocheN.has(k)) continue;', '      if (nLignes.has(k) || envoyesN.has(k)) continue;'],
  'cron-coche-non-lue': ['api/ship-reminders.js', "const MAIN_RETRAIT = ['vrm_colis_collected', 'vrm_colis_retirer', 'vinted_pickup_done'];", "const MAIN_RETRAIT = ['vrm_colis_collected', 'vrm_colis_retirer'];"],
  'repartis-sans-coupure': ['api/_lib/suivi-colis.js', 'export const repartiAffichable = (ms, maintenant = Date.now()) => !Number.isFinite(ms) || maintenant - ms <= REPARTIS_AGE_MAX_J * 86400000;', 'export const repartiAffichable = () => true;'],
  'vg-12-chiffres': ['api/_lib/transporteurs.js', '|[0-9A-Z]{13}|\\d{12})$/,', '|[0-9A-Z]{13})$/,'],
  'borne-inconnu': ['api/_lib/suivi-colis.js', ' || (!connue && borne != null && i.at >= borne)', ''],
};
const ARG_PROUVE = process.argv.find((x) => x.startsWith('--prouve'));
if (ARG_PROUVE) {
  let ok = 0;
  const seules = ARG_PROUVE.includes('=') ? ARG_PROUVE.split('=')[1].split(',') : null;
  const choisies = Object.entries(MUTATIONS).filter(([nom]) => !seules || seules.includes(nom));
  for (const [nom, [f, de, vers]] of choisies) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-transp-'));
    for (const x of ['api', 'src', 'package.json']) fs.cpSync(path.join(R, x), path.join(t, x), { recursive: true });
    fs.symlinkSync(fs.realpathSync(path.join(R, 'node_modules')), path.join(t, 'node_modules'));
    const src = fs.readFileSync(path.join(t, f), 'utf8');
    if (src.split(de).length !== 2) { console.log(`❌ mutation ${nom} : ancre ${src.includes(de) ? 'pas unique' : 'introuvable'} dans ${f}`); fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(path.join(t, f), src.replace(de, vers));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8', timeout: 240000 });
    const rouges = (String(r.stdout || '').match(/^❌.*$/gm) || []);
    const tombe = r.status !== 0 && rouges.length > 0;
    if (tombe) ok++;
    console.log(`${tombe ? '✅' : '❌'} mutation « ${nom} » ⇒ ${tombe ? rouges.length + ' rouge(s) — ' + rouges[0].slice(2, 110) : 'VERTE (le contrôle ne la voit pas)'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  const n = choisies.length;
  console.log(ok === n ? `\n✅ ${ok}/${n} mutations attrapées` : `\n❌ ${n - ok} mutation(s) non attrapée(s)`);
  process.exit(ok === n ? 0 : 1);
}

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String((e && e.stack) || e).split('\n').slice(0, 2).join(' ').slice(0, 260)); } };
const importer = (p) => import('file://' + path.join(R, p));

// ── L'environnement des routes ──────────────────────────────────────────────
const A = '11111111-2222-3333-4444-555555555555';
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VRM_OWNER_UID = A;
process.env.CRON_SECRET = 'cle-banc-cron';
process.env.EMAIL_INBOUND_SECRET = 'cle-banc-transp';
process.env.VAPID_PRIVATE_KEY = 'banc-cle-privee-factice';
delete process.env.AI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
const webpush = require(path.join(R, 'node_modules', 'web-push'));
const pushes = [];
webpush.setVapidDetails = () => {};
webpush.sendNotification = async (sub, body) => { pushes.push({ endpoint: sub.endpoint, ...JSON.parse(body) }); return { statusCode: 201 }; };

// ── Une fausse base à état, à la forme de PostgREST ────────────────────────
const base = new Map();
let pannes = new Set();
const rep = (c, s = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
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

// ── De faux transporteurs (on compte ce qui leur est ENVOYÉ) ──────────────
const appels = [];
let transporteur = () => null;   // (URL) ⇒ { status, ctype, body, headers } | null (réseau coupé)
const HOTES_TRANSP = /(^|\.)(chronopost\.fr|vintedgo\.com|mondialrelay\.(?:fr|be))$/;
global.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  const h = opts.headers || {};
  if (HOTES_TRANSP.test(u.hostname)) {
    appels.push({ host: u.hostname, url: String(url), path: u.pathname, ua: String(h['User-Agent'] || h['user-agent'] || ''), xrw: String(h['X-Requested-With'] || ''), accept: String(h.Accept || ''), cookie: String(h.Cookie || h.cookie || ''), redirect: opts.redirect });
    const r = transporteur(u);
    if (!r) throw new TypeError('fetch failed');
    return new Response(r.body, { status: r.status, headers: { 'content-type': r.ctype || 'application/json', ...(r.headers || {}) } });
  }
  if (u.pathname === '/auth/v1/user') return String(h.Authorization || '') === 'Bearer a.b.c' ? rep({ id: A, email: 'vendeur@banc.test', email_confirmed_at: '2026-01-01T00:00:00Z' }) : rep({ msg: 'jwt' }, 401);
  if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
  if (u.pathname === '/rest/v1/vinted_accounts') return rep([]);
  if (u.pathname !== '/rest/v1/app_data') return rep([]);
  const brut = decodeURIComponent(u.pathname + u.search);
  if (m === 'POST') {
    const prefer = String(h.Prefer || h.prefer || '');
    const faits = [];
    for (const r of JSON.parse(opts.body || '[]')) {
      if (pannes.has('ecrire:' + r.id)) return rep('<html>522</html>', 522);
      const cle = `${r.owner || A}|${r.id}`;
      if (/ignore-duplicates/.test(prefer) && base.has(cle)) continue;
      base.set(cle, r.data); faits.push({ id: r.id });
    }
    return /return=representation/.test(prefer) ? rep(faits, 201) : new Response('', { status: 201 });
  }
  if (m === 'PATCH') {
    const corps = JSON.parse(opts.body || '{}');
    const t = filtrer(u);
    if (t.some((l) => pannes.has('ecrire:' + l.id))) return rep('<html>522</html>', 522);
    for (const l of t) base.set(`${l.owner}|${l.id}`, corps.data);
    return rep(t.map((l) => ({ id: l.id })));
  }
  if (m === 'DELETE') { for (const l of filtrer(u)) base.delete(`${l.owner}|${l.id}`); return new Response('', { status: 204 }); }
  for (const p of pannes) if (p.startsWith('lire:') && brut.includes(p.slice(5))) return new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } });
  const sel = u.searchParams.get('select') || '';
  if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);   // base cloisonnée
  return rep(filtrer(u).map((l) => projeter(l, sel)));
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.send = () => r; r.end = () => r; return r; };

// ── Des réponses INVENTÉES à la forme MESURÉE ──────────────────────────────
const H = 3600000;
const _fmt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const paris = (ms) => { const p = {}; for (const x of _fmt.formatToParts(new Date(ms))) p[x.type] = x.value; return { jour: `${p.day}/${p.month}/${p.year}`, heure: `${p.hour}:${p.minute}`, iso: `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00` }; };
const iso = (ms) => new Date(ms).toISOString();
// Chronopost trackSkybillV2 : SOAP, préfixes d'espace de noms.
const cpEv = (code, ms, libelle, extra = {}) => ({ code, ms, libelle, office: extra.office || 'VANNES - FR - TABAC TEST', zip: extra.zip || '99999', infos: extra.infos || {} });
const cpXml = (sky, evs, { errorCode = '0' } = {}) => `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns1:trackSkybillV2Response xmlns:ns1="http://cxf.tracking.soap.chronopost.fr/"><return><errorCode>${errorCode}</errorCode><listEventInfoComp>${evs.map((e) => `<events><code>${e.code}</code><eventDate>${iso(e.ms)}</eventDate><eventLabel>${e.libelle}</eventLabel><officeLabel>${e.office}</officeLabel><zipCode>${e.zip}</zipCode>${Object.entries(e.infos).map(([k, v]) => `<infoCompList><name>${k}</name><value>${v}</value></infoCompList>`).join('')}</events>`).join('')}<skybillNumber>${sky}</skybillNumber></listEventInfoComp></return></ns1:trackSkybillV2Response></soap:Body></soap:Envelope>`;
// Vinted Go v3 : du plus récent au plus ancien.
const vgJson = (evs, meta = {}) => JSON.stringify({ tracking_events: evs.map((e, i) => ({ id: 'ev' + i, message: e.message || e.group, timestamp: iso(e.ms), metadata: { address: e.address || '' }, banner_message: null, group_header: null, group: e.group, state: e.state || 'delivery' })), meta });
// Mondial Relay .be /api/tracking (relayée par l'extension en C4, voie `mr-be`).
const mrBe = (numero, cp, k, evs, { deliveryMode = '24R' } = {}) => JSON.stringify({ Expedition: { Numero: Number(numero), DestinataireCodePostal: cp, DeliveryMode: deliveryMode, Evenements: evs.map((e) => ({ Date: paris(e.ms).iso, Libelle: e.libelle, ...(e.dpr ? { DetailPointRelais: { Numero: 99999, Adresse: { Libelle: 'TABAC TEST', CodePostal: '99999', Ville: 'TESTVILLE', CodePays: 'FR' } } } : {}) })), SuiviParEtapes: Object.fromEntries([1, 2, 3, 4, 5].map((i) => [String(i), { Numero: i, Libelle: 'Étape ' + i, ...(i <= k ? { Evenement: { Date: paris(evs[0] ? evs[0].ms : Date.now()).iso } } : {}) }])) }, status: [] });
// Mondial Relay `_mvc` (la voie du SERVEUR) : JSON qui porte un fragment HTML.
// Forme MESURÉE le 24 oct. : frise de 5 `<li>`, un `infos-account` par jour,
// `step-suivi` heure puis libellé (écrit deux fois), le bloc du point relais,
// l'écho dans deux scripts. Les jours et évènements, du plus récent au plus ancien.
const ETAPES_MR = ['Colis en pr&#233;paration chez l&#39;exp&#233;diteur', 'Colis remis &#224; Mondial Relay', 'Colis sur l&#39;agence de livraison', 'Colis disponible au point de retrait', 'Colis livr&#233; au destinataire'];
const mvcFragment = (numero, cp, k, evs, { etapes = ETAPES_MR, dataLayer = true, numeroEcrit = numero } = {}) => {
  const frise = `<ul class="timeline suivi center-element">${etapes.map((x, i) => `<li class="${i < k ? 'validate' : ''}"><p>${x}</p></li>`).join(' ')}</ul>`;
  const parJour = new Map();
  for (const e of [...evs].sort((a, b) => b.ms - a.ms)) { const p = paris(e.ms); if (!parJour.has(p.jour)) parJour.set(p.jour, []); parJour.get(p.jour).push([p.heure, e.libelle]); }
  const relais = '<div class="step-suivi line-t"><input type="hidden" id="numeroTemp" value=99999 /><input type="hidden" id="codePaysTemp" value=FR /><div class="points_relais PCL_Details hide"><div class="detail-mag"><p class="tittle-info"><strong>Horaires d&#39;ouverture :</strong></p><table><tbody><tr><td>lundi</td><td> 09h00 - 18h00 </td></tr></tbody></table><p>Impression Etiquette Point Relais</p></div></div></div>';
  const jours = [...parJour.entries()].map(([j, l], n) => `<div class="infos-account"><div class="bloc mb-0 infos-colis suivre pt10"><div class="col-xs-4"><p>${j}</p></div><div class="col-xs-7"><h5>${l[0][1]}</h5></div></div><div class="bloc bg-white detail-infos">${l.map(([hh, lib]) => `<div class="step-suivi"><div class="col-xs-4 "><p class="center">${hh}</p></div><div class="col-xs-8"><p>${lib}</p></div><div class="col-xs-4 "></div><div class="col-xs-8 "><p>${lib}</p></div></div>`).join('')}${n === 0 ? relais : ''}</div></div>`).join('');
  const scripts = `<script type="text/javascript"> var culture = 'fr-FR'; var codeMarque = 'V1'; var numeroExpedition = '${numeroEcrit}'; var token = 'FAUX'; </script>${dataLayer ? `<script> window.dataLayer = window.dataLayer || [] dataLayer.push({ 'event': 'Suivi de Colis', 'CodePostal' : '${cp}', 'Pays' : 'FR' }); </script>` : ''}`;
  return `<div class="grid"><div class="row">${frise}</div><div class="row">${jours}</div></div>${scripts}`;
};
const mvcJson = (numero, cp, k, evs, o) => JSON.stringify({ Success: true, ModelState: [], Message: mvcFragment(numero, cp, k, evs, o), Action: 'ReplaceDiv', Data: false });
const MVC_INTROUVABLE = JSON.stringify({ Success: false, ModelState: [], Message: '<div class="alert">Il semble qu&#39;il y ait une erreur de saisie. Merci de v&#233;rifier vos informations.</div>', Action: 'ReplaceDiv', Data: false });

(async () => {
  let T = null, S = null, L = null;
  await essaie('les modules du statut chez le transporteur', async () => {
    T = await importer('api/_lib/transporteurs.js');
    S = await importer('api/_lib/suivi-colis.js');
    L = await importer('api/_lib/transporteurs-lecture.js');
    dit(typeof T.lireReponse === 'function' && typeof L.passageTransporteurs === 'function', 'api/_lib/transporteurs.js et transporteurs-lecture.js existent');
  });
  const NOW = Date.now();

  // ══ 1. CHRONOPOST — trackSkybillV2 (XML) ═══════════════════════════════════
  await essaie('Chronopost', async () => {
    const lire = (evs, o) => T.lireReponseChronopost(200, 'text/xml', cpXml('XW000000001TS', evs, o), { suivi: 'XW000000001TS' });
    const t0 = NOW - 10 * 24 * H;
    const seq = [cpEv('AB', t0, 'Colis disponible au point de retrait'), cpEv('SM', t0 + H, 'Message'), cpEv('TT', t0 + 5 * 24 * H, 'Colis en cours d\'acheminement'), cpEv('R', t0 + 6 * 24 * H, 'Retour à l\'expéditeur'), cpEv('AB', t0 + 7 * 24 * H, 'Disponible', { office: 'LYON - FR - AGENCE' }), cpEv('D', t0 + 8 * 24 * H, 'Livré', { infos: { 'Type de retrait': 'Expéditeur' } })];
    const r1 = lire(seq);
    dit(r1.res === 'ok' && r1.etat === 'retour_expediteur' && r1.detail === 'rendu', 'AB → SM → TT → R → AB → D ⇒ « rendu à l\'expéditeur », jamais « retiré »', `${r1.etat}/${r1.detail}`);
    const r2 = lire([cpEv('AB', t0, 'Disponible', { infos: { 'Point de livraison': 'TABAC TEST - 1 RUE EXEMPLE - 99999 - TESTVILLE' } }), cpEv('TT', t0 + 5 * 24 * H, 'Colis en cours d\'acheminement')]);
    dit(r2.etat === 'incident' && r2.detail === 'quitte_relais', 'TT après AB, au même lieu ⇒ « a quitté le point relais »', `${r2.etat}/${r2.detail}`);
    const r3 = lire([cpEv('AB', t0, 'Disponible', { infos: { 'Point de livraison': 'TABAC TEST - 1 RUE EXEMPLE - 99999 - TESTVILLE' } }), cpEv('D', t0 + 24 * H, 'Livré', { infos: { 'Type de retrait': 'Destinataire' } })]);
    dit(r3.etat === 'retire' && r3.lieuCp === '99999' && r3.lieuNom === 'TABAC TEST', 'D + « Type de retrait » ⇒ retiré, au point lu', `${r3.etat} ${r3.lieuNom} ${r3.lieuCp}`);
    dit(lire([cpEv('AB', t0, 'x')], { errorCode: '3' }).res === 'introuvable', 'errorCode ≠ 0 ⇒ introuvable');
    const r5 = lire([cpEv('DB', t0, 'Pris en charge'), cpEv('ZZ', t0 + H, 'Un code jamais vu')]);
    dit(r5.etat === 'inconnu' && /jamais vu/.test(r5.libelle), 'un code inconnu en dernier ⇒ « inconnu », le libellé recopié', `${r5.etat} « ${r5.libelle} »`);
    const r6 = T.lireReponseChronopost(200, 'text/xml', cpXml('XW999999999TS', [cpEv('AB', t0, 'x')]), { suivi: 'XW000000001TS' });
    dit(r6.res === 'forme', 'un skybillNumber DIFFÉRENT est rejeté (l\'écho)', r6.forme);
    dit(T.lireReponseChronopost(403, 'text/html', '<html>Cloudflare</html>', { suivi: 'XW000000001TS' }).res === 'bloque' && T.lireReponseChronopost(200, 'text/html', '<!doctype html><html></html>', { suivi: 'XW000000001TS' }).res === 'bloque', '403 ou HTML ⇒ « bloqué » (une pause, jamais un état)');
  });

  // ══ 2. VINTED GO — public/v3/tracking_events (JSON) ════════════════════════
  await essaie('Vinted Go', async () => {
    const lire = (corps, s = 200) => T.lireReponseVintedGo(s, 'application/json', corps, { suivi: '1234567890123456' });
    const exp = NOW + 4 * 24 * H;
    const r1 = lire(vgJson([{ group: 'ready_for_pickup', ms: NOW - H, message: 'Ton colis t\'attend (Consigne TEST)', address: '1 Rue Exemple, 99999 Testville' }, { group: 'in_transit', ms: NOW - 20 * H }], { expiration_time: iso(exp) }));
    dit(r1.etat === 'disponible' && r1.limiteSure === true && r1.limite === T.jourParis(exp) && r1.lieuNom === 'Consigne TEST', '`ready_for_pickup` ⇒ disponible, limite = `expiration_time` (sûre), le point lu', `${r1.etat} ${r1.limite} ${r1.lieuNom}`);
    const r2 = lire(vgJson([{ group: 'delivered', ms: NOW - H }, { group: 'ready_for_pickup', ms: NOW - 30 * H }], { expiration_time: iso(exp) }));
    dit(r2.etat === 'retire' && !r2.limite, '`delivered` ⇒ retiré, et la limite (toujours présente) est IGNORÉE', `${r2.etat} limite=${r2.limite}`);
    const r3 = lire(vgJson([{ group: 'in_transit', state: 'return', ms: NOW - H }, { group: 'ready_for_pickup', ms: NOW - 50 * H }]));
    dit(r3.etat === 'retour_expediteur', '`state: return` ⇒ repart chez l\'expéditeur', r3.etat);
    dit(lire(JSON.stringify({ error: 'x', error_code: 'shipment_expired', message: 'expired' }), 404).res === 'expire', '404 `shipment_expired` ⇒ « expiré » (ni livré, ni perdu)');
    dit(lire('', 404).res === 'passu', '404 vide ⇒ « pas su »');
    const r6 = lire(JSON.stringify({ events: [] }));
    dit(r6.res === 'forme' && !!r6.forme, 'une forme inconnue ⇒ « forme », et la forme est GARDÉE (clés, jamais les valeurs)', r6.forme);
  });

  // ══ 3. MONDIAL RELAY — la route `_mvc` (SERVEUR, et l'extension en secours) et l'API .be (relayée) ══
  await essaie('Mondial Relay (_mvc, la voie du serveur)', async () => {
    const lire = (corps, o = {}) => T.lireReponse('mondialrelay', 200, 'application/json; charset=utf-8', corps, { suivi: '12345678', cp: '99999', voie: 'mr-fr-mvc', ...o });
    const d0 = NOW - 30 * H;
    const evs = [{ ms: d0, libelle: 'Colis exp&#233;di&#233; depuis le site TESTVILLE' }, { ms: d0 + 10 * H, libelle: 'Colis en route vers le point de livraison' }, { ms: d0 + 20 * H, libelle: '5 jours restants pour retirer le colis en Point Relais' }];
    const r4 = lire(mvcJson('12345678', '99999', 4, evs));
    const limite = T.jourParis(d0 + 20 * H + 5 * 24 * H);
    dit(r4.res === 'ok' && r4.etat === 'disponible' && r4.limite === limite && r4.limiteSure === false, 'étape 4 + « 5 jours restants » ⇒ disponible, limite DÉDUITE (« vers le »)', `${r4.etat} ${r4.limite} sûre=${r4.limiteSure}`);
    dit(r4.evenements.length === 3 && r4.evenements[0].libelle === 'Colis expédié depuis le site TESTVILLE' && r4.libelle === '5 jours restants pour retirer le colis en Point Relais', 'les évènements : jours et heures lus, ENTITÉS décodées, du plus ancien au plus récent, le libellé écrit deux fois compté une fois', JSON.stringify(r4.evenements.map((e) => e.libelle)));
    dit(r4.etatAt === T.isoParisVersUtc(paris(d0 + 20 * H).iso), 'l\'heure est celle de PARIS (hh:mm du fragment), rangée en UTC', `${r4.etatAt}`);
    const r5 = lire(mvcJson('12345678', '99999', 5, [...evs, { ms: d0 + 26 * H, libelle: 'Colis livr&#233; au destinataire' }]));
    dit(r5.etat === 'retire' && r5.etatAt === T.isoParisVersUtc(paris(d0 + 26 * H).iso), 'étape 5 après un point de retrait ⇒ retiré (à l\'heure du « livré »)', r5.etat);
    const r2 = lire(mvcJson('12345678', '99999', 2, [{ ms: d0, libelle: 'Prise en charge de votre colis sur notre site logistique de TESTVILLE.' }]));
    const r1 = lire(mvcJson('12345678', '99999', 1, [{ ms: d0, libelle: 'Colis en pr&#233;paration chez l&#39;exp&#233;diteur' }]));
    dit(r2.etat === 'en_route' && !r2.detail && r1.etat === 'en_route' && r1.detail === 'prepare', 'étapes 2 et 3 ⇒ en route ; étape 1 ⇒ pas encore remis au transporteur', `${r2.etat}/${r2.detail} · ${r1.etat}/${r1.detail}`);
    const ri = lire(mvcJson('12345678', '99999', 4, [...evs, { ms: d0 + 24 * H, libelle: 'Un libellé jamais vu' }]));
    dit(ri.etat === 'inconnu' && ri.libelle === 'Un libellé jamais vu', 'un libellé INCONNU après l\'étape 4 ⇒ « inconnu », recopié tel quel', `${ri.etat} « ${ri.libelle} »`);
    dit(lire(MVC_INTROUVABLE).res === 'introuvable', '`Success: false` (n° ou code postal faux, mesuré) ⇒ introuvable');
    const e1 = lire(mvcJson('12345678', '99999', 4, evs, { numeroEcrit: '87654321' }));
    const e2 = lire(mvcJson('12345678', '11111', 4, evs));
    const e3 = lire(mvcJson('12345678', '99999', 4, evs).replace(/var numeroExpedition = '12345678';/, ''));
    dit(e1.res === 'forme' && /numero-autre/.test(e1.forme) && e2.res === 'forme' && /cp-autre/.test(e2.forme) && e3.res === 'forme' && /numero-absent/.test(e3.forme), 'l\'ÉCHO : un autre n°, un autre code postal ou un n° absent du fragment ⇒ rejeté (« forme »)', `${e1.forme} · ${e2.forme} · ${e3.forme}`);
    const e4 = lire(mvcJson('12345678', '99999', 4, evs, { dataLayer: false }));
    dit(e4.res === 'ok' && e4.etat === 'disponible', 'sans dataLayer, le n° écrit suffit (Success:true prouve déjà le couple n° + code postal)', e4.res);
    const f1 = lire(mvcJson('12345678', '99999', 3, evs, { etapes: ETAPES_MR.slice(0, 4) }));
    const f2 = lire(JSON.stringify({ Success: true, ModelState: [], Message: '<p>autre chose</p>', Action: 'ReplaceDiv', Data: false }));
    const f3 = lire('{"Success": true, "Message": "<ul class=\\"timeline suivi\\"><li', {});
    dit(f1.res === 'forme' && /frise-4/.test(f1.forme) && f2.res === 'forme' && f3.res === 'forme', 'une autre forme (frise de 4 étapes, fragment sans frise, JSON tronqué) ⇒ « forme », JAMAIS devinée', `${f1.forme} · ${f2.forme} · ${f3.forme}`);
    dit(T.lireReponse('mondialrelay', 403, 'text/html', '<html>Sorry, you have been blocked</html>', { suivi: '12345678', cp: '99999', voie: 'mr-fr-mvc' }).res === 'bloque' && T.lireReponse('mondialrelay', 200, 'text/html', '<!DOCTYPE html><html><title>Just a moment...</title></html>', { suivi: '12345678', cp: '99999', voie: 'mr-fr-mvc' }).res === 'bloque', '403 (blocage) ou HTML au lieu du JSON (défi) ⇒ « bloqué »');
    // La ligne garde le lieu qu'elle avait : la route `_mvc` ne porte ni nom ni adresse du point.
    const avant = { v: 1, carrier: 'mondialrelay', suivi: '12345678', etat: 'en_route', lieuNom: 'TABAC TEST', lieuVille: 'TESTVILLE', lieuCp: '99999', essaiRes: 'ok', lu: iso(NOW - 3 * H) };
    const apres = T.ligneApresEssai(avant, r4, { carrier: 'mondialrelay', suivi: '12345678', voie: 'mr-fr-mvc', maintenant: NOW, cp: '99999', cpSource: 'email' });
    dit(apres.etat === 'disponible' && apres.lieuNom === 'TABAC TEST' && apres.lieuCp === '99999' && apres.voie === 'mr-fr-mvc' && apres.cp === '99999', 'rangée : la ligne garde le lieu qu\'elle avait (jamais effacé par un blanc), la voie et le code postal prouvé', `${apres.etat} ${apres.lieuNom} ${apres.voie} cp=${apres.cp}`);
  });
  await essaie('Mondial Relay (API .be, relayée par l\'extension sous `mr-be`)', async () => {
    const lire = (corps, o = {}) => T.lireReponse('mondialrelay', 200, 'application/json', corps, { suivi: '12345678', cp: '99999', voie: 'mr-be', ...o });
    const d0 = NOW - 30 * H;
    const evs = [{ ms: d0, libelle: 'Colis expédié depuis le site TESTVILLE' }, { ms: d0 + 20 * H, libelle: '5 jours restants pour retirer le colis en Point Relais', dpr: true }];
    const r4 = lire(mrBe('12345678', '99999', 4, evs));
    dit(r4.etat === 'disponible' && r4.limiteSure === false && r4.limite === T.jourParis(T.isoParisVersUtc(paris(d0 + 20 * H).iso) ? Date.parse(T.isoParisVersUtc(paris(d0 + 20 * H).iso)) + 5 * 24 * H : 0) && r4.lieuNom === 'TABAC TEST', '.be étape 4 + « 5 jours restants » ⇒ disponible « vers le », le point lu dans DetailPointRelais', `${r4.etat} ${r4.limite} ${r4.lieuNom}`);
    const r5 = lire(mrBe('12345678', '99999', 5, [...evs, { ms: d0 + 25 * H, libelle: 'Colis livré au destinataire', dpr: true }]));
    dit(r5.etat === 'retire', '.be étape 5 en point relais (24R) ⇒ retiré', r5.etat);
    const ri = lire(mrBe('12345678', '99999', 4, [...evs, { ms: d0 + 24 * H, libelle: 'Un libellé jamais vu' }]));
    dit(ri.etat === 'inconnu', '.be : un libellé inconnu après l\'étape 4 ⇒ « inconnu »', ri.etat);
    const e1 = lire(mrBe('87654321', '99999', 4, evs)), e2 = lire(mrBe('12345678', '11111', 4, evs));
    dit(e1.res === 'forme' && e2.res === 'forme', '.be : l\'écho (Numero, DestinataireCodePostal) faux ⇒ rejeté', `${e1.forme} · ${e2.forme}`);
    dit(lire(JSON.stringify({ status: [{ state: 'warn', message: "Il n'existe pas de colis pour ces critères de recherche" }] })).res === 'introuvable', '.be « pas de colis » ⇒ introuvable');
    dit(T.lireReponse('mondialrelay', 200, 'application/json', mvcJson('12345678', '99999', 4, [{ ms: d0, libelle: 'x' }]), { suivi: '12345678', cp: '99999', voie: 'mr-be' }).res === 'forme', 'chaque voie a SON analyseur : un corps `_mvc` relayé sous la voie .be n\'est pas lu');
  });
  await essaie('Mondial Relay : le code postal (jamais deviné)', async () => {
    dit(JSON.stringify(T.codesPostauxDe('Siège 59650 Villeneuve · TABAC TEST, 99999 Testville')) === '["99999"]', 'le code postal du SIÈGE (59650) est écarté');
    const jour = T.jourParis(NOW);
    const r = T.codePostalPourMondialRelay({ suivi: '12345678', transp: { cpJour: jour, cpEssayes: '11111,22222' }, prouves: ['33333'], maintenant: NOW });
    const r2 = T.codePostalPourMondialRelay({ suivi: '12345678', transp: { cpJour: jour, cpEssayes: '11111' }, prouves: ['11111', '33333'], maintenant: NOW });
    dit(r === null && r2 && r2.cp === '33333' && r2.source === 'essai', 'essai borné : au plus 2 codes postaux par n° et par jour, jamais deux fois le même', `${JSON.stringify(r)} · ${JSON.stringify(r2)}`);
  });

  // ══ 4. PRIORITÉ ET FINS (api/_lib/suivi-colis.js) ═════════════════════════
  await essaie('le transporteur fait monter, jamais descendre', async () => {
    const t = (o) => ({ v: 1, carrier: 'mondialrelay', suivi: '12345678', essaiRes: 'ok', lu: iso(NOW - H), ...o });
    const arr = NOW - 50 * H;
    const fins1 = S.finsDesLignes([{ suivi: '12345678', status: 'available', receivedAt: iso(arr) }], { transp: [t({ etat: 'retire', etatAt: iso(NOW - 2 * H) })] });
    dit(S.sortiParSuivis(['12345678'], fins1, arr) === 'retire', 'le transporteur dit retiré ⇒ le colis sort de « à retirer », même avec un e-mail « disponible »');
    const lT = { suivi: '12345678', carrier: 'mondialrelay', status: 'transit', receivedAt: iso(NOW - 30 * H) };
    const f = S.fusionTransporteur(lT, t({ etat: 'disponible', etatAt: iso(NOW - 3 * H), limite: '2099-01-02', limiteSure: false, lieuNom: 'TABAC TEST', lieuCp: '99999' }), NOW);
    dit(f.status === 'available' && f.limiteVers === '2099-01-02' && !f.limite && !f.code && /TABAC TEST/.test(f.lieu || ''), '« disponible » plus récent que l\'e-mail en transit ⇒ à retirer, le lieu et « vers le », sans code', `${f.status} limiteVers=${f.limiteVers} lieu=${f.lieu}`);
    const lA = { suivi: '12345678', carrier: 'mondialrelay', status: 'available', receivedAt: iso(NOW - 30 * H) };
    const g = S.fusionTransporteur(lA, t({ etat: 'en_route', etatAt: iso(NOW - H) }), NOW);
    dit(g.status === 'available', '« en route » ne fait JAMAIS redescendre un colis disponible', g.status);
    const old = S.fusionTransporteur(lT, t({ etat: 'disponible', etatAt: iso(NOW - 40 * H) }), NOW);
    dit(old.status === 'transit', 'un « disponible » plus ANCIEN que le dernier e-mail ne change rien', old.status);
    const finsR = S.finsDesLignes([], { transp: [t({ etat: 'retour_expediteur', etatAt: iso(arr - 10 * H) })] });
    dit(S.sortiParSuivis(['12345678'], finsR, arr) === null, 'un retour ANTÉRIEUR à l\'arrivée est ignoré (ce n\'est pas ce passage-là)');
    const finsI = S.finsDesLignes([], { transp: [t({ etat: 'incident', detail: 'quitte_relais', etatAt: iso(arr + 10 * H) })] });
    const finsU = S.finsDesLignes([], { transp: [t({ etat: 'inconnu', etatAt: iso(arr + 10 * H), libelle: 'x' })] });
    const finsU0 = S.finsDesLignes([], { transp: [t({ etat: 'inconnu', etatAt: iso(arr - 10 * H), libelle: 'x' })] });
    dit(S.sortiParSuivis(['12345678'], finsI, arr) === 'a_verifier' && S.sortiParSuivis(['12345678'], finsU, arr) === 'a_verifier' && S.sortiParSuivis(['12345678'], finsU0, arr) === null, 'incident ou statut inconnu APRÈS l\'arrivée ⇒ « à vérifier » ; inconnu avant ⇒ rien');
    const avant = t({ etat: 'disponible', etatAt: iso(NOW - 3 * H), lieuNom: 'TABAC TEST' });
    const apres = T.ligneApresEssai(avant, { res: 'passu' }, { carrier: 'mondialrelay', suivi: '12345678', maintenant: NOW });
    dit(apres.etat === 'disponible' && apres.lieuNom === 'TABAC TEST' && apres.lu === avant.lu && apres.essaiRes === 'passu', 'une lecture ratée (« pas su ») ne change RIEN : ni l\'état, ni le lieu, ni l\'heure de lecture', `${apres.etat} lu=${apres.lu === avant.lu}`);
  });

  // ══ 5. LA SÉLECTION ═══════════════════════════════════════════════════════
  await essaie('quels n° on interroge', async () => {
    const ligne = (o) => ({ status: 'transit', receivedAt: iso(NOW - 2 * H), sens: 'entrant', ...o });
    const sel = (o) => T.suivisAInterroger({ maintenant: NOW, ...o });
    const a = sel({ lignes: [ligne({ suivi: 'XW000000001TS', carrier: 'chronopost' }), ligne({ suivi: 'XW000000002TS', carrier: 'chronopost', sens: 'sortant' }), ligne({ suivi: 'XW000000003TS', carrier: 'chronopost' }), ligne({ suivi: 'XW000000004TS', carrier: 'chronopost', sens: null, subject: '' })], envoyes: ['XW000000003TS'] });
    const ns = a.map((x) => x.suivi);
    dit(ns.includes('XW000000001TS') && !ns.includes('XW000000002TS') && !ns.includes('XW000000003TS') && !ns.includes('XW000000004TS'), 'jamais un n° SORTANT (sens ou bordereau), jamais un sens « pas su »', ns.join(','));
    const tR = new Map([['XW000000001TS', { carrier: 'chronopost', suivi: 'XW000000001TS', etat: 'en_route', essaiRes: 'ok', essai: iso(NOW - 10 * 60000), etatAt: iso(NOW - H), lu: iso(NOW - 10 * 60000) }]]);
    const tV = new Map([['XW000000001TS', { carrier: 'chronopost', suivi: 'XW000000001TS', etat: 'en_route', essaiRes: 'ok', essai: iso(NOW - 3 * H), etatAt: iso(NOW - 3 * H), lu: iso(NOW - 3 * H) }]]);
    const tF = new Map([['XW000000001TS', { carrier: 'chronopost', suivi: 'XW000000001TS', etat: 'retire', fini: true, essaiRes: 'ok', essai: iso(NOW - 3 * H), etatAt: iso(NOW - 3 * H) }]]);
    const l1 = [ligne({ suivi: 'XW000000001TS', carrier: 'chronopost' })];
    dit(sel({ lignes: l1, transp: tR }).length === 0 && sel({ lignes: l1, transp: tV }).length === 1, 'le rythme : relu il y a 10 min ⇒ pas maintenant ; il y a 3 h ⇒ oui (en route : toutes les 2 h)');
    dit(sel({ lignes: l1, transp: tF }).length === 0, 'un état FINAL (retiré) ⇒ plus jamais relu');
    const beaucoup = Array.from({ length: 9 }, (_, i) => ligne({ suivi: `XW00000001${i}TS`, carrier: 'chronopost' }));
    dit(sel({ lignes: beaucoup, max: 50, parTransporteur: 6 }).length === 6, 'au plus 6 par transporteur et par passage');
    const vieux = [ligne({ suivi: 'XW000000009TS', carrier: 'chronopost', receivedAt: iso(NOW - 60 * 24 * H) })];
    const f1 = sel({ lignes: vieux });
    const f2 = sel({ lignes: vieux, transp: new Map([['XW000000009TS', { carrier: 'chronopost', suivi: 'XW000000009TS', essaiRes: 'ok', etat: 'en_route', essai: iso(NOW - 60 * 24 * H), etatAt: iso(NOW - 60 * 24 * H) }]]) });
    dit(f1.length === 1 && f1[0].raison === 'fermeture' && f2.length === 0, 'un ancien n° jamais fermé est lu UNE fois (« fermeture »), puis plus jamais', `${f1.map((x) => x.raison)} · ${f2.length}`);
    const mr = sel({ lignes: [ligne({ suivi: '12345678', carrier: 'mondialrelay', status: 'available', lieu: 'TABAC TEST, 1 Rue Exemple, 99999 Testville' })] });
    dit(mr.length === 1 && mr[0].cp === '99999' && mr[0].cpSource === 'email', 'Mondial Relay : le code postal vient du lieu de l\'e-mail « disponible »', JSON.stringify(mr[0] || null));
    // (fusion) La règle de C3 (`aLireParNavigateur`) : un n° Mondial Relay sans
    // code postal connu, demandé SEUL par la page avec son code postal, part à
    // l'extension avec ce code postal (pendant la pause) — jamais un autre n°.
    const pauseMr = T.pauseApresRefus({}, 'mondialrelay', { statut: 403, ctype: 'text/html', maintenant: NOW });
    const sansCp = [ligne({ suivi: '12345678', carrier: 'mondialrelay' })];
    const nav1 = T.aLireParNavigateur({ lignes: sansCp, pause: pauseMr, maintenant: NOW + 1000, seul: '12345678', cpSeul: '99999' });
    const nav2 = T.aLireParNavigateur({ lignes: sansCp, pause: pauseMr, maintenant: NOW + 1000 });
    dit(nav1.length === 1 && nav1[0].cp === '99999' && nav1[0].voie === 'mr-fr-mvc' && nav2.length === 0, 'C3 : sans code postal connu, le n° demandé seul part avec le code postal de la page ; sans lui, rien (jamais un code postal deviné)', `${JSON.stringify(nav1)} · ${JSON.stringify(nav2)}`);
  });

  // ══ 6. LE RÉSEAU : UN PASSAGE DU SERVEUR (C5), LA PAUSE, C3 ══════════════
  const { contexteVendeur } = await importer('api/_lib/owner.js').catch(() => ({}));
  const oublis = async () => {
    try { const p = await importer('api/_lib/push.js'); if (typeof p.oublierPrefsVues === 'function') p.oublierPrefsVues(); } catch (_) {}
    try { const a = await importer('api/_lib/abonnement.js'); if (typeof a.oublierAcces === 'function') a.oublierAcces(); } catch (_) {}
  };
  const resetBase = () => {
    base.clear(); pannes = new Set(); pushes.length = 0; appels.length = 0;
    if (L && typeof L._oublierPauseInstance === 'function') L._oublierPauseInstance();   // (29 oct.) la pause gardée par l'instance
    base.set(`${A}|main`, { vrm_colis_collected: [] });
    base.set(`${A}|push_subs`, { subs: [{ endpoint: 'https://web.push.apple.com/iphone' }] });
    base.set(`${A}|push_prefs`, { colis: true, suivi: true });
  };
  const ligneMr = (o = {}) => ({ type: 'suivi', carrier: 'mondialrelay', suivi: '12345678', status: 'transit', statusLabel: 'En transit', subject: 'Votre colis 12345678 est en route', receivedAt: iso(NOW - 40 * H), sens: 'entrant', ...o });
  const ligneCp = (o = {}) => ({ type: 'suivi', carrier: 'chronopost', suivi: 'XW000000001TS', status: 'transit', subject: 'Information sur votre colis XW000000001TS', receivedAt: iso(NOW - 40 * H), sens: 'entrant', ...o });
  const ligneVg = (o = {}) => ({ type: 'suivi', carrier: 'vinted', suivi: '1234567890123456', status: 'transit', subject: 'Ton colis est en route', receivedAt: iso(NOW - 40 * H), sens: 'entrant', ...o });
  const D0 = NOW - 30 * H;
  const EVS_MR = [{ ms: D0, libelle: 'Colis exp&#233;di&#233; depuis le site TESTVILLE' }, { ms: D0 + 26 * H, libelle: '5 jours restants pour retirer le colis en Point Relais' }];
  const repond = ({ mr = 'ok', cp = 'ok', vg = 'ok' } = {}) => (u) => {
    if (u.hostname === 'www.mondialrelay.fr') {
      if (mr === 'reseau') return null;
      if (mr === '403') return { status: 403, ctype: 'text/html', body: '<!DOCTYPE html><html><title>Attention Required! | Cloudflare</title>Sorry, you have been blocked</html>' };
      if (mr === '429') return { status: 429, ctype: 'text/html', body: '<html>Too Many Requests</html>', headers: { 'retry-after': '7200' } };
      if (mr === 'defi') return { status: 200, ctype: 'text/html', body: '<!DOCTYPE html><html><title>Just a moment...</title></html>', headers: { 'cf-mitigated': 'challenge' } };
      if (mr === 'introuvable') return { status: 200, ctype: 'application/json; charset=utf-8', body: MVC_INTROUVABLE };
      const n = u.searchParams.get('NumeroExpedition'), c = u.searchParams.get('CodePostal');
      if (c !== '99999') return { status: 200, ctype: 'application/json; charset=utf-8', body: MVC_INTROUVABLE };
      return { status: 200, ctype: 'application/json; charset=utf-8', body: mvcJson(n, c, 4, EVS_MR) };
    }
    if (u.hostname === 'www.mondialrelay.be') return { status: 403, ctype: 'text/html', body: '<html>blocked</html>' };
    if (u.hostname === 'ws.chronopost.fr') return cp === 'ok' ? { status: 200, ctype: 'text/xml', body: cpXml(u.searchParams.get('skybillNumber'), [cpEv('DB', NOW - 20 * H, 'Pris en charge'), cpEv('AB', NOW - 2 * H, 'Colis disponible au point de retrait', { infos: { 'Point de livraison': 'TABAC TEST - 1 RUE EXEMPLE - 99999 - TESTVILLE' } })]) } : null;
    if (u.hostname === 'carrier.vintedgo.com') return vg === 'ok' ? { status: 200, ctype: 'application/json', body: vgJson([{ group: 'in_transit', ms: NOW - 2 * H }, { group: 'shipped', ms: NOW - 20 * H }]) } : null;
    return null;
  };
  // (29 oct., revue n° 15) la pause est GLOBALE au transporteur : rangée au
  // propriétaire neutre (`transp_pause`), la ligne du vendeur en repli (code d'avant).
  const NEUTRE = '00000000-0000-0000-0000-000000000000';
  const lirePauseBanc = () => base.get(`${NEUTRE}|transp_pause`) || base.get(`${A}|transp_pause`) || {};
  const passage = (o = {}) => contexteVendeur.run({ owner: A }, () => L.passageTransporteurs({ max: 12, budgetMs: 20000, ...o }));
  const ligneT = (c, n) => base.get(`${A}|transp_${c}_${n}`) || null;
  if (L && typeof L._reglerPourBanc === 'function') L._reglerPourBanc({ ecartMs: 0 });

  await essaie('un passage du serveur : les trois transporteurs, Mondial Relay par la route `_mvc`', async () => {
    resetBase(); await oublis();
    base.set(`${A}|email_track_mondialrelay_12345678`, ligneMr({ status: 'available', statusLabel: 'Arrivé au point de retrait', subject: 'Votre colis 12345678 est disponible', lieu: 'TABAC TEST, 1 Rue Exemple, 99999 Testville', code: '123456' }));
    base.set(`${A}|email_track_chronopost_XW000000001TS`, ligneCp());
    base.set(`${A}|email_track_vinted_1234567890123456`, ligneVg());
    base.set(`${A}|push_dedup`, { keys: ['relais-12345678-code'] });   // l'e-mail l'a déjà annoncé
    transporteur = repond();
    const r = await passage();
    const mr = appels.filter((x) => x.host === 'www.mondialrelay.fr');
    const u0 = mr[0] ? new URL(mr[0].url) : null;
    dit(r.ok && mr.length === 1 && u0 && u0.pathname === '/_mvc/fr-FR/SuiviExpedition/RechercherJsonResponsive' && u0.searchParams.get('NumeroExpedition') === '12345678' && u0.searchParams.get('CodePostal') === '99999', 'Mondial Relay est lu PAR LE SERVEUR, route `_mvc`, avec le n° et le code postal du point relais', mr.map((x) => x.url).join(' · ') || 'aucun appel');
    dit(mr.length === 1 && mr[0].xrw === 'XMLHttpRequest' && /application\/json/.test(mr[0].accept) && !mr[0].cookie, 'les en-têtes de la mesure (Accept JSON, X-Requested-With), aucun cookie, aucun jeton', mr[0] && `${mr[0].accept} · ${mr[0].xrw}`);
    dit(appels.length > 0 && appels.every((x) => /^VRM-suivi\//.test(x.ua) && !/Mozilla|Chrome|Safari/i.test(x.ua)) && appels.every((x) => x.redirect === 'error'), 'un User-Agent HONNÊTE sur chaque requête (jamais celui d\'un navigateur), aucune redirection suivie', [...new Set(appels.map((x) => x.ua))].join(' · '));
    dit(!appels.some((x) => x.host === 'www.mondialrelay.be'), 'le serveur n\'appelle jamais l\'API .be (refusée au serveur)');
    const lm = ligneT('mondialrelay', '12345678'), lc = ligneT('chronopost', 'XW000000001TS'), lv = ligneT('vinted', '1234567890123456');
    dit(lm && lm.etat === 'disponible' && lm.voie === 'mr-fr-mvc' && lm.cp === '99999' && lm.source === 'serveur' && lm.essaiRes === 'ok', 'la ligne `transp_mondialrelay_12345678` : disponible, voie `mr-fr-mvc`, code postal prouvé', lm && `${lm.etat} ${lm.voie} ${lm.cp} ${lm.source}`);
    dit(lc && lc.etat === 'disponible' && lc.voie === 'cp-ws2' && lv && lv.etat === 'en_route' && lv.voie === 'vg-v3', 'Chronopost et Vinted Go lus et rangés', `${lc && lc.etat} · ${lv && lv.etat}`);
    dit((r.besoinNavigateur || []).length === 0, 'rien à demander à l\'extension quand le serveur a pu lire', JSON.stringify(r.besoinNavigateur));
    const titres = pushes.map((p) => p.title || '');
    dit(titres.filter((x) => /Chronopost/.test(x) && /disponible/.test(x)).length === 1 && !pushes.some((p) => /Mondial Relay|\b12345678\b/.test(JSON.stringify(p))), 'Chronopost « disponible » sonne une fois ; Mondial Relay, déjà annoncé par l\'e-mail (même n°), se TAIT', JSON.stringify(titres));
    const n0 = appels.length;
    await passage();
    dit(appels.length === n0, 'relancé tout de suite : aucune requête (le rythme : disponible toutes les 30 min, en route toutes les 2 h)', `${appels.length - n0} requête(s) de plus`);
  });

  await essaie('deux passages SIMULTANÉS ⇒ une seule notification', async () => {
    resetBase(); await oublis();
    base.set(`${A}|email_track_chronopost_XW000000001TS`, ligneCp());
    transporteur = repond();
    await Promise.all([passage(), passage()]);
    const n = pushes.filter((p) => /disponible|point/i.test(JSON.stringify(p))).length;
    dit(n === 1, 'deux passages en même temps : comparer-et-échanger, UNE notification', `${pushes.length} envoi(s)`);
  });

  await essaie('un même fait ne sonne qu\'une fois, et « pas su » ne le consomme pas', async () => {
    resetBase(); await oublis();
    base.set(`${A}|email_track_chronopost_XW000000001TS`, ligneCp());
    // (29 oct., revues n° 13-14) La vérification et la réservation sont UN
    // comparer-et-échanger sur `push_dedup` : tant qu'il ne s'écrit pas, rien ne
    // sonne et la notification reste EN ATTENTE dans la ligne ; dès qu'il
    // s'écrit, elle sonne UNE fois — et le même fait relu ne re-sonne jamais.
    base.set(`${A}|push_dedup`, { keys: [] }); pannes.add('ecrire:push_dedup');
    const ab = (ms) => cpEv('AB', ms, 'Colis disponible au point de retrait', { infos: { 'Point de livraison': 'TABAC TEST - 1 RUE EXEMPLE - 99999 - TESTVILLE' } });
    transporteur = (u) => u.hostname === 'ws.chronopost.fr' ? { status: 200, ctype: 'text/xml', body: cpXml('XW000000001TS', [ab(NOW - 5 * H)]) } : null;
    const vieillir = () => { const k = `${A}|transp_chronopost_XW000000001TS`; const d = base.get(k); if (d) base.set(k, { ...d, essai: iso(Date.now() - 3 * H) }); };
    const compte = () => pushes.filter((p) => /disponible/.test(p.title || '')).length;
    await passage();
    const l1 = ligneT('chronopost', 'XW000000001TS') || {};
    dit(compte() === 0 && l1.etat === 'disponible' && !!l1.notifEnAttente, 'la clé partagée ne s\'écrit pas : rien ne sonne, la notification reste EN ATTENTE dans la ligne', `${compte()} notification(s) · attente ${l1.notifEnAttente || '—'}`);
    pannes.delete('ecrire:push_dedup');
    vieillir(); await passage();
    vieillir(); await passage();
    vieillir(); await passage();
    const l2 = ligneT('chronopost', 'XW000000001TS') || {};
    dit(compte() === 1 && !l2.notifEnAttente, 'la base revenue : UNE notification, puis le même fait relu trois fois ne re-sonne pas', `${compte()} notification(s) · attente ${l2.notifEnAttente || '—'}`);
    const cles = ((base.get(`${A}|push_dedup`) || {}).keys || []);
    dit(cles.some((x) => /^relais-XW000000001TS-/.test(x)), 'la notification est RÉSERVÉE dans `push_dedup` (`relais-{n°}-…`) : l\'e-mail « disponible » du même n° se taira', JSON.stringify(cles));
  });

  await essaie('refusé par Mondial Relay : la pause, puis l\'extension (C3, voie de secours)', async () => {
    resetBase(); await oublis();
    base.set(`${A}|email_track_mondialrelay_12345678`, ligneMr({ status: 'available', lieu: 'TABAC TEST, 1 Rue Exemple, 99999 Testville' }));
    transporteur = repond({ mr: '403' });
    const r = await passage();
    const p = lirePauseBanc();
    const lm = ligneT('mondialrelay', '12345678');
    const b0 = (r.besoinNavigateur || [])[0] || {};
    dit(p.mondialrelay && Date.parse(p.mondialrelay.jusqua) > Date.now(), '403 ⇒ une PAUSE pour Mondial Relay (`transp_pause`)', JSON.stringify(p.mondialrelay || null));
    dit(lm && lm.essaiRes === 'bloque' && !lm.etat, 'la ligne dit « bloqué », sans état inventé', lm && `${lm.essaiRes} ${lm.etat}`);
    dit(b0.carrier === 'mondialrelay' && b0.voie === 'mr-fr-mvc' && b0.cp === '99999' && b0.suivi === '12345678', 'le n° part à l\'extension (secours) par la route `_mvc` (`mr-fr-mvc`, lue depuis le navigateur), avec son code postal', JSON.stringify(r.besoinNavigateur));
    // Dix minutes plus tard (la page relit un n° au plus toutes les 5 min) :
    const vieillir = () => { const k = `${A}|transp_mondialrelay_12345678`; const d = base.get(k); if (d) base.set(k, { ...d, essai: iso(Date.now() - 10 * 60000) }); };
    vieillir();
    const n0 = appels.filter((x) => /mondialrelay/.test(x.host)).length;
    const r2 = await passage({ suivi: '12345678', force: true });
    dit(appels.filter((x) => /mondialrelay/.test(x.host)).length === n0 && (r2.besoinNavigateur || []).some((x) => x.suivi === '12345678' && x.voie === 'mr-fr-mvc'), 'en pause : aucune requête à Mondial Relay, même forcée ; le n° reste pour l\'extension', `${appels.filter((x) => /mondialrelay/.test(x.host)).length - n0} requête(s)`);
    vieillir();
    const c3 = await contexteVendeur.run({ owner: A }, () => L.transpALire());
    dit(c3 && c3.items.some((x) => x.carrier === 'mondialrelay' && x.voie === 'mr-fr-mvc' && x.cp === '99999'), 'C3 (`transp-a-lire`) liste ce n° pour l\'extension, voie `mr-fr-mvc`, sans attendre le recul du serveur (30 min)', JSON.stringify(c3 && c3.items));
    for (const [cas, attendu] of [['429', 'bloque'], ['defi', 'bloque']]) {
      resetBase(); await oublis();
      base.set(`${A}|email_track_mondialrelay_12345678`, ligneMr({ status: 'available', lieu: 'TABAC TEST, 1 Rue Exemple, 99999 Testville' }));
      transporteur = repond({ mr: cas });
      const rr = await passage();
      const pp = lirePauseBanc().mondialrelay;
      dit((ligneT('mondialrelay', '12345678') || {}).essaiRes === attendu && pp && (rr.besoinNavigateur || []).length === 1, `${cas === '429' ? '429' : 'un défi (cf-mitigated)'} ⇒ pause et secours`, JSON.stringify(pp || null));
      if (cas === '429') dit(pp && Date.parse(pp.jusqua) - Date.now() >= 2 * H - 60000, '`Retry-After` plus long que la pause est respecté', pp && pp.jusqua);
    }
  });

  await essaie('C3 ne demande rien à l\'extension quand le serveur lit', async () => {
    resetBase(); await oublis();
    base.set(`${A}|email_track_mondialrelay_12345678`, ligneMr({ status: 'available', lieu: 'TABAC TEST, 1 Rue Exemple, 99999 Testville' }));
    const c3 = await contexteVendeur.run({ owner: A }, () => L.transpALire());
    dit(c3 && Array.isArray(c3.items) && c3.items.length === 0, 'ni refus ni pause : la liste C3 est VIDE (le serveur s\'en charge)', JSON.stringify(c3 && c3.items));
  });

  await essaie('lecture ratée, code postal essayé, fermeture', async () => {
    resetBase(); await oublis();
    base.set(`${A}|email_track_chronopost_XW000000001TS`, ligneCp());
    base.set(`${A}|transp_chronopost_XW000000001TS`, { v: 1, rev: 1, carrier: 'chronopost', suivi: 'XW000000001TS', etat: 'disponible', etatAt: iso(NOW - 3 * H), lu: iso(NOW - 3 * H), essai: iso(NOW - 3 * H), essaiRes: 'ok', lieuNom: 'TABAC TEST' });
    transporteur = repond({ cp: 'reseau' });
    await passage();
    const lc = ligneT('chronopost', 'XW000000001TS');
    dit(lc && lc.etat === 'disponible' && lc.lieuNom === 'TABAC TEST' && lc.essaiRes === 'passu' && pushes.length === 0, 'réseau coupé ⇒ « pas su » : l\'état et le lieu RESTENT, rien ne sonne', lc && `${lc.etat} ${lc.essaiRes} push=${pushes.length}`);
    // Un code postal ESSAYÉ (prouvé chez ce vendeur, pas pour CE colis) et refusé ⇒ cp-inconnu, sans échec compté.
    resetBase(); await oublis();
    base.set(`${A}|email_track_mondialrelay_12345678`, ligneMr());
    base.set(`${A}|transp_mondialrelay_87654321`, { v: 1, rev: 1, carrier: 'mondialrelay', suivi: '87654321', etat: 'retire', fini: true, lu: iso(NOW - 99 * H), cp: '11111', cpSource: 'email', essaiRes: 'ok', essai: iso(NOW - 99 * H), etatAt: iso(NOW - 99 * H) });
    transporteur = repond();
    await passage();
    const le = ligneT('mondialrelay', '12345678');
    const essayeMr = appels.filter((x) => x.host === 'www.mondialrelay.fr').map((x) => new URL(x.url).searchParams.get('CodePostal'));
    dit(essayeMr.join(',') === '11111' && le && le.essaiRes === 'cp-inconnu' && !(Number(le.essais) > 0) && /11111/.test(le.cpEssayes || ''), 'un code postal ESSAYÉ que Mondial Relay refuse ⇒ « code postal inconnu », l\'essai noté, aucun échec compté', le && `${le.essaiRes} essais=${le.essais} essayés=${le.cpEssayes}`);
    // Un code postal donné par la PAGE (C5) n'est pas prouvé : « pas de colis »
    // pour ce couple ne compte pas comme « introuvable » (qui fermerait le n°).
    resetBase(); await oublis();
    base.set(`${A}|email_track_mondialrelay_12345678`, ligneMr());
    transporteur = repond();
    await passage({ suivi: '12345678', force: true, cpPage: '11111' });
    const lp = ligneT('mondialrelay', '12345678');
    const essayeP = appels.filter((x) => x.host === 'www.mondialrelay.fr').map((x) => new URL(x.url).searchParams.get('CodePostal'));
    dit(essayeP.join(',') === '11111' && lp && lp.essaiRes === 'cp-inconnu' && !(Number(lp.essais) > 0) && /11111/.test(lp.cpEssayes || ''), 'un code postal donné par la PAGE et refusé ⇒ « code postal inconnu », l\'essai noté, aucun échec compté', lp && `${lp.essaiRes} essais=${lp.essais} essayés=${lp.cpEssayes}`);
    // Sans aucun code postal : rien ne part, et c'est DIT.
    resetBase(); await oublis();
    base.set(`${A}|email_track_mondialrelay_12345678`, ligneMr());
    transporteur = repond();
    await passage();
    dit(!appels.some((x) => /mondialrelay/.test(x.host)) && (ligneT('mondialrelay', '12345678') || {}).essaiRes === 'cp-inconnu', 'aucun code postal connu ⇒ aucune requête, la ligne dit « code postal inconnu »');
    // La fermeture d'un ancien n° : lue, rangée, SANS notification.
    resetBase(); await oublis();
    base.set(`${A}|email_track_chronopost_XW000000001TS`, ligneCp({ receivedAt: iso(NOW - 60 * 24 * H) }));
    transporteur = repond();
    await passage();
    dit((ligneT('chronopost', 'XW000000001TS') || {}).etat === 'disponible' && pushes.length === 0, 'un ancien n° lu pour le FERMER ne sonne pas', `push=${pushes.length}`);
    // Un évènement de plus de 72 h ne sonne pas.
    resetBase(); await oublis();
    base.set(`${A}|email_track_vinted_1234567890123456`, ligneVg());
    transporteur = (u) => u.hostname === 'carrier.vintedgo.com' ? { status: 200, ctype: 'application/json', body: vgJson([{ group: 'ready_for_pickup', ms: NOW - 80 * H, message: 'Prêt (Consigne TEST)' }]) } : null;
    await passage();
    dit((ligneT('vinted', '1234567890123456') || {}).etat === 'disponible' && pushes.length === 0, 'un « disponible » daté de plus de 72 h est rangé, mais ne sonne pas', `push=${pushes.length}`);
  });

  // ══ 7. LES ROUTES : api/relais (C4, C5) ═══════════════════════════════════
  await essaie('route api/relais (C4 : la réponse brute relayée par l\'extension)', async () => {
    const relais = (await importer('api/relais.js')).default;
    const appel = async (mode, body, { jeton = 'a.b.c', methode = 'POST', taille = null } = {}) => {
      const res = faireRes();
      const brut = JSON.stringify(body);
      await relais({ method: methode, query: { mode }, headers: { authorization: `Bearer ${jeton}`, 'content-length': String(taille == null ? Buffer.byteLength(brut) : taille) }, body: brut }, res);
      return res;
    };
    resetBase(); await oublis();
    base.set(`${A}|email_track_mondialrelay_12345678`, ligneMr({ status: 'available', lieu: 'TABAC TEST, 1 Rue Exemple, 99999 Testville' }));
    base.set(`${A}|email_track_mondialrelay_22222222`, ligneMr({ suivi: '22222222', sens: 'sortant', subject: 'Preuve de dépôt de votre colis' }));
    const d0 = NOW - 30 * H;
    const beOk = { v: 1, carrier: 'mondialrelay', suivi: '12345678', cp: '99999', voie: 'mr-be', statut: 200, ctype: 'application/json', corps: mrBe('12345678', '99999', 4, [{ ms: d0, libelle: '5 jours restants pour retirer le colis en Point Relais', dpr: true }]), at: iso(NOW), source: 'extension' };
    const r1 = await appel('transp-brut', beOk);
    dit(r1.code === 200 && r1.corps && r1.corps.res === 'ok' && (ligneT('mondialrelay', '12345678') || {}).voie === 'mr-be', 'C4 voie `mr-be` (l\'API .be relayée) : jugée par la même règle, rangée avec SA voie', `${r1.code} ${JSON.stringify(r1.corps)}`);
    const mvcOk = { ...beOk, voie: 'mr-fr-mvc', corps: mvcJson('12345678', '99999', 5, [{ ms: d0, libelle: '5 jours restants pour retirer le colis en Point Relais' }, { ms: d0 + 5 * H, libelle: 'Colis livr&#233; au destinataire' }]) };
    const r2 = await appel('transp-brut', mvcOk);
    dit(r2.code === 200 && r2.corps && r2.corps.etat === 'retire' && (ligneT('mondialrelay', '12345678') || {}).voie === 'mr-fr-mvc', 'C4 voie `mr-fr-mvc` acceptée elle aussi (jugée par l\'analyseur `_mvc`)', `${r2.code} ${JSON.stringify(r2.corps)}`);
    const r3 = await appel('transp-brut', { ...beOk, suivi: '22222222' });
    const r4 = await appel('transp-brut', { ...beOk, suivi: '33333333' });
    dit(r3.code === 409 && r4.code === 409, 'un n° qui n\'est pas un ACHAT de ce vendeur (sortant, ou inconnu) ⇒ 409', `${r3.code} · ${r4.code}`);
    const r5 = await appel('transp-brut', { ...beOk, voie: 'cp-ws2' });
    const r6 = await appel('transp-brut', { ...beOk, voie: 'mr-fr-autre' });
    dit(r5.code === 400 && r6.code === 400 && r5.corps.error === 'voie', 'une voie qui n\'est pas celle de ce transporteur ⇒ 400', `${r5.code} · ${r6.code}`);
    const r7 = await appel('transp-brut', { ...beOk, corps: 'x'.repeat(90 * 1024) });
    dit(r7.code === 413, 'un corps trop gros ⇒ 413', String(r7.code));
    const r8 = await appel('transp-brut', beOk, { jeton: 'faux' });
    dit(r8.code === 401, 'sans session ⇒ 401', String(r8.code));
    // C5 : un passage demandé par l'app (Mondial Relay lu par le serveur).
    resetBase(); await oublis();
    base.set(`${A}|email_track_mondialrelay_12345678`, ligneMr({ status: 'available', lieu: 'TABAC TEST, 1 Rue Exemple, 99999 Testville' }));
    transporteur = repond();
    const r9 = await appel('transp', {});
    dit(r9.code === 200 && r9.corps && r9.corps.lus.some((x) => x.carrier === 'mondialrelay' && x.res === 'ok') && appels.some((x) => x.host === 'www.mondialrelay.fr'), 'C5 (`mode=transp`) : un passage, Mondial Relay lu par le serveur', `${r9.code} ${JSON.stringify(r9.corps && r9.corps.lus)}`);
  });

  // ══ 8. LES LECTEURS : le widget et le cron du matin (§11) ═════════════════
  await essaie('route api/widget : le transporteur dit retiré ⇒ plus « à retirer »', async () => {
    const w = (await importer('api/widget.js')).default;
    const compte = async (avecTransp) => {
      resetBase(); await oublis();
      base.set(`${A}|main`, { vrm_widget_token: '', vinted_pickup_done: {}, vinted_ship_done: {}, vinted_bords_shipped: {}, vinted_sales_hidden: [], vinted_bords_hidden: {}, vrm_colis_collected: [],
        vrm_colis_retirer: { total: 1, aVerifier: 0, urgents: 0, at: NOW, colis: [['2099-01-01', NOW, 'mondialrelay', 'e:12345678']], vus: ['12345678'], vusTx: [] } });
      base.set(`${A}|email_track_mondialrelay_12345678`, ligneMr({ status: 'available', lieu: 'TABAC TEST, 1 Rue Exemple, 99999 Testville', limite: '2099-01-01', receivedAt: iso(NOW - 20 * H) }));
      if (avecTransp) base.set(`${A}|transp_mondialrelay_12345678`, { v: 1, rev: 1, carrier: 'mondialrelay', suivi: '12345678', etat: 'retire', etatAt: iso(NOW - 2 * H), lu: iso(NOW - H), essai: iso(NOW - H), essaiRes: 'ok', voie: 'mr-fr-mvc', fini: true });
      const res = faireRes(); await w({ method: 'GET', headers: {}, query: {} }, res);
      return res.corps || {};
    };
    const sans = await compte(false), avec = await compte(true);
    dit(sans.pickup === 1 && avec.pickup === 0, 'le widget lit la ligne du transporteur : retiré chez Mondial Relay ⇒ 0 à retirer (1 sans elle)', `sans=${sans.pickup} avec=${avec.pickup}`);
  });
  // Ce que l'app compte « à retirer » PARCE QUE le transporteur le dit (aucun
  // e-mail « disponible ») n'est pas « sorti » pour le widget ; et une lecture
  // « disponible » de moins de 6 h lève la garde de 5 j, comme dans l'app.
  await essaie('route api/widget : le transporteur dit « disponible » ⇒ toujours compté, la garde levée comme dans l\'app', async () => {
    const w = (await importer('api/widget.js')).default;
    const compte = async ({ email, arriveeMs, luMs, limite = '' }) => {
      resetBase(); await oublis();
      base.set(`${A}|main`, { vrm_widget_token: '', vinted_pickup_done: {}, vinted_ship_done: {}, vinted_bords_shipped: {}, vinted_sales_hidden: [], vinted_bords_hidden: {}, vrm_colis_collected: [],
        vrm_colis_retirer: { total: 1, aVerifier: 0, urgents: 0, at: NOW, colis: [[limite, arriveeMs, 'mondialrelay', 'e:12345678']], vus: ['12345678'], vusTx: [] } });
      base.set(`${A}|email_track_mondialrelay_12345678`, email);
      base.set(`${A}|transp_mondialrelay_12345678`, { v: 1, rev: 1, carrier: 'mondialrelay', suivi: '12345678', etat: 'disponible', etatAt: iso(arriveeMs), libelle: 'Colis disponible au Point Relais', lu: iso(luMs), essai: iso(luMs), essaiRes: 'ok', voie: 'mr-fr-mvc', fini: false });
      const res = faireRes(); await w({ method: 'GET', headers: {}, query: {} }, res);
      return res.corps || {};
    };
    const transit = await compte({ email: ligneMr(), arriveeMs: NOW - 10 * H, luMs: NOW - H });
    dit(transit.pickup === 1 && transit.pickupSortis === 0, 'un e-mail « en transit » que le transporteur dit disponible : le widget le compte encore (pas « sorti » faute d\'e-mail)', `pickup=${transit.pickup} sortis=${transit.pickupSortis}`);
    const vieux = ligneMr({ status: 'available', subject: 'Votre colis 12345678 est disponible 📦', lieu: 'TABAC TEST, 1 Rue Exemple, 99999 Testville', receivedAt: iso(NOW - 156 * H), arriveLe: iso(NOW - 156 * H) });
    const leve = await compte({ email: vieux, arriveeMs: NOW - 156 * H, luMs: NOW - H });
    dit(leve.pickup === 1, 'arrivé il y a 6,5 j (garde Mondial Relay : 5 j), lu « disponible » il y a 1 h : le widget le compte « à retirer », comme l\'app', `pickup=${leve.pickup} aVérifier=${leve.pickupAVerifier}`);
    const perime = await compte({ email: vieux, arriveeMs: NOW - 156 * H, luMs: NOW - 8 * H });
    dit(perime.pickup === 0 && perime.pickupAVerifier === 1, 'l\'autre sens : lu il y a 8 h ⇒ la garde n\'est PAS levée (« à vérifier »)', `pickup=${perime.pickup} aVérifier=${perime.pickupAVerifier}`);
  });
  await essaie('route api/ship-reminders : le cron lit les transporteurs (Mondial Relay par le serveur)', async () => {
    const cron = (await importer('api/ship-reminders.js')).default;
    resetBase(); await oublis();
    base.set(`${A}|email_track_mondialrelay_12345678`, ligneMr({ status: 'available', lieu: 'TABAC TEST, 1 Rue Exemple, 99999 Testville' }));
    transporteur = repond();
    const res = faireRes();
    await cron({ method: 'GET', headers: { authorization: 'Bearer cle-banc-cron' }, query: {} }, res);
    const lm = ligneT('mondialrelay', '12345678');
    dit(appels.some((x) => x.host === 'www.mondialrelay.fr') && lm && lm.etat === 'disponible' && lm.voie === 'mr-fr-mvc', 'le cron du matin : la ligne Mondial Relay est lue et rangée par le serveur', lm ? `${lm.etat} ${lm.voie}` : `code=${res.code}`);
  });

  // ══ 9. TOUR 1 DU 29 OCTOBRE : RÈGLES, ÉTATS, LECTEURS (revue n° 1-11) ════
  // Chaque contrôle est rouge sur 8f62e6f2 et sous SA mutation (`--prouve`).
  let RC = null;
  await essaie('n° 9 : Vinted Go, le retour seulement sur les valeurs relevées', async () => {
    const lire = (evs) => T.lireReponseVintedGo(200, 'application/json', vgJson(evs), { suivi: '1234567890123456' });
    const r1 = lire([{ group: 'return_cancelled', ms: NOW - H }, { group: 'ready_for_pickup', ms: NOW - 30 * H, message: 'Prêt (Consigne TEST)' }]);
    dit(r1.res === 'ok' && r1.etat !== 'retour_expediteur', 'n° 9 : `return_cancelled` (le retour ANNULÉ) en dernier ⇒ jamais « repart chez l\'expéditeur »', r1.etat);
    const r2 = lire([{ group: 'return_cancelled', ms: NOW - H }, { group: 'return_in_transit', ms: NOW - 5 * H }, { group: 'ready_for_pickup', ms: NOW - 50 * H }]);
    dit(r2.etat !== 'retour_expediteur', 'n° 9 : un retour ANNULÉ depuis (`return_cancelled` plus récent) ⇒ plus « reparti »', r2.etat);
    const r3 = lire([{ group: 'return_in_transit', ms: NOW - H }, { group: 'ready_for_pickup', ms: NOW - 50 * H }]);
    dit(r3.etat === 'retour_expediteur', 'n° 9, l\'autre sens : `return_in_transit` ⇒ repart chez l\'expéditeur', r3.etat);
  });
  await essaie('n° 11 : l\'HEURE de la limite Vinted Go (`expiration_time`)', async () => {
    RC = await importer('api/_lib/retrait-colis.js');
    const exp = '2026-10-28T09:34:00Z';                                  // 10 h 34 à Paris (heure d'hiver)
    const r = T.lireReponseVintedGo(200, 'application/json', vgJson([{ group: 'ready_for_pickup', ms: Date.parse('2026-10-26T08:00:00Z'), message: 'Prêt (Consigne TEST)' }], { expiration_time: exp }), { suivi: '1234567890123456' });
    dit(r.limite === '2026-10-28' && r.limiteAt === '2026-10-28T09:34:00.000Z', 'n° 11 : la limite garde son HEURE (`limiteAt`) ; le jour reste la clé', `${r.limite} ${r.limiteAt}`);
    const ap = T.ligneApresEssai(null, r, { carrier: 'vinted', suivi: '1234567890123456', voie: 'vg', maintenant: Date.parse('2026-10-27T08:00:00Z') });
    const scal = Object.fromEntries(Object.entries(ap).filter(([, v]) => v == null || typeof v !== 'object').map(([k, v]) => [k, v == null ? null : String(v)]));
    const meta = T.ligneTranspDeMeta({ id: 'transp_vinted_1234567890123456', ...scal });
    dit(!!meta && meta.limiteAt === '2026-10-28T09:34:00.000Z' && /limiteAt:meta->>limiteAt/.test(T.SELECT_TRANSP_META), 'n° 11 : rangée et relue en scalaire (`SELECT_TRANSP_META`)', meta && meta.limiteAt);
    const e9 = RC.etatRetrait({ limite: '2026-10-28', limiteAt: exp, transporteur: 'vinted' }, Date.parse('2026-10-28T08:00:00Z'), '2026-10-28');
    const e11 = RC.etatRetrait({ limite: '2026-10-28', limiteAt: exp, transporteur: 'vinted' }, Date.parse('2026-10-28T10:00:00Z'), '2026-10-28');
    dit(e9.etat === 'a_retirer' && e11.etat === 'delai_depasse' && e11.heurePassee === true, 'n° 11 : à 9 h « à retirer » ; à 11 h (après 10 h 34) délai passé, LE JOUR MÊME', `${e9.etat} · ${e11.etat}`);
    const pub = RC.retirerPublie({ at: Date.parse('2026-10-28T07:00:00Z'), colis: [['2026-10-28', Date.parse('2026-10-26T08:00:00Z'), 'vinted', 'e:1234567890123456', 1, '', exp]] }, Date.parse('2026-10-28T10:00:00Z'), '2026-10-28');
    dit(pub && pub.n === 0 && pub.aVerifier === 1, 'n° 11 : la photo publiée porte l\'heure (7e champ) — le widget la relit', pub && `n=${pub.n} aVérifier=${pub.aVerifier}`);
    const tx = S.texteRappelRetrait({ etat: 'dernier', suivi: '1234567890123456', transporteur: 'vinted', limite: '2026-10-28', limiteAt: exp, lieu: 'Consigne TEST' });
    dit(/avant 10 h 34/.test(tx.body), 'n° 11 : le rappel « dernier jour » dit l\'heure (« avant 10 h 34 »)', tx.body);
  });
  await essaie('n° 3 : Mondial Relay, une route APRÈS l\'arrivée ⇒ parti du point relais', async () => {
    const t18 = NOW - 6 * 24 * H, t21 = NOW - 3 * 24 * H;
    const evs = [{ ms: t18 - 48 * H, libelle: 'Colis remis &#224; Mondial Relay' }, { ms: t18, libelle: '5 jours restants pour retirer le colis en Point Relais' }, { ms: t21, libelle: 'Colis en route vers le point de livraison' }];
    const mvc = T.lireReponse('mondialrelay', 200, 'application/json; charset=utf-8', mvcJson('12345678', '99999', 4, evs), { suivi: '12345678', cp: '99999', voie: 'mr-fr-mvc' });
    dit(mvc.res === 'ok' && mvc.etat === 'incident' && mvc.detail === 'quitte_relais', 'n° 3 : « 5 jours restants » le 18, « en route vers le point de livraison » le 21 ⇒ a quitté le point relais (jamais « disponible »)', `${mvc.etat}/${mvc.detail}`);
    const be = T.lireReponseMondialRelay(200, 'application/json', mrBe('12345678', '99999', 4, evs.map((e) => ({ ...e, libelle: e.libelle.replace('&#224;', 'à'), dpr: /restants/.test(e.libelle) }))), { suivi: '12345678', cp: '99999' });
    dit(be.res === 'ok' && be.etat === 'incident' && be.detail === 'quitte_relais', 'n° 3 : la même règle pour l\'API .be', `${be.etat}/${be.detail}`);
    const re = T.lireReponse('mondialrelay', 200, 'application/json; charset=utf-8', mvcJson('12345678', '99999', 4, [...evs, { ms: t21 + 30 * H, libelle: '4 jours restants pour retirer le colis en Point Relais' }]), { suivi: '12345678', cp: '99999', voie: 'mr-fr-mvc' });
    dit(re.etat === 'disponible', 'n° 3, l\'autre sens : re-livré (un « N jours restants » plus récent) ⇒ disponible', re.etat);
    const g1 = S.leverGarde({ etat: 'trop_long', age: 6, garde: 5 }, { transpDispoLu: NOW - H, limiteVers: T.jourParis(NOW - 24 * H) }, NOW);
    const g2 = S.leverGarde({ etat: 'trop_long', age: 6, garde: 5 }, { transpDispoLu: NOW - H, limiteVers: T.jourParis(NOW + 48 * H) }, NOW);
    dit(g1.etat === 'trop_long' && g2.etat === 'a_retirer', 'n° 3 : une limite DÉDUITE (« vers le ») déjà passée ne lève jamais la garde (à venir : levée)', `${g1.etat} · ${g2.etat}`);
  });
  await essaie('n° 7 : un code postal saisi faux ne ferme jamais le n°', async () => {
    resetBase(); await oublis();
    base.set(`${A}|colis_suivi_mondialrelay_12345678`, { suivi: '12345678', transporteur: 'mondialrelay', codePostal: '35000', at: iso(NOW - 24 * H) });
    transporteur = repond();
    await passage({});
    const l1 = ligneT('mondialrelay', '12345678') || {};
    dit(l1.essaiRes === 'cp-inconnu' && !l1.fini && !(Number(l1.essais) > 0) && l1.cpRefuse === '35000', 'n° 7 : « introuvable » avec un code postal SAISI, jamais prouvé ⇒ « code postal inconnu » (le code refusé noté), aucun échec compté', `${l1.essaiRes} essais=${l1.essais} fini=${l1.fini} cpRefuse=${l1.cpRefuse}`);
    const carte = T.ligneTransporteur(T.ligneTranspDeMeta({ id: 'transp_mondialrelay_12345678', ...Object.fromEntries(Object.entries(l1).filter(([, v]) => v == null || typeof v !== 'object').map(([k, v]) => [k, v == null ? null : String(v)])) }), 'mondialrelay', NOW);
    dit(/35000/.test(carte.texte), 'n° 7 : la carte nomme le code postal refusé', carte.texte);
    base.set(`${A}|colis_suivi_mondialrelay_12345678`, { suivi: '12345678', transporteur: 'mondialrelay', codePostal: '99999', at: iso(NOW - 24 * H) });
    appels.length = 0;
    await passage({});
    const l2 = ligneT('mondialrelay', '12345678') || {};
    dit(appels.some((x) => x.host === 'www.mondialrelay.fr') && l2.etat === 'disponible', 'n° 7 : le code postal corrigé (99999) ⇒ relu tout de suite, « disponible »', `${l2.etat} appels=${appels.length}`);
    // Une ligne fermée par trois « introuvable » sous l'ancienne règle (jamais
    // prouvée à un code postal) : un code postal saisi depuis la fait relire.
    resetBase(); await oublis();
    base.set(`${A}|colis_suivi_mondialrelay_12345678`, { suivi: '12345678', transporteur: 'mondialrelay', codePostal: '99999', at: iso(NOW - 24 * H) });
    base.set(`${A}|transp_mondialrelay_12345678`, { v: 1, rev: 1, carrier: 'mondialrelay', suivi: '12345678', essai: iso(NOW - 10 * 24 * H), essaiRes: 'introuvable', essais: 3, fini: true, voie: 'mr-fr-mvc' });
    transporteur = repond();
    await passage({});
    const l3 = ligneT('mondialrelay', '12345678') || {};
    dit(l3.etat === 'disponible' && !l3.fini, 'n° 7 : un n° fermé par trois « introuvable » sans code postal prouvé se relit avec le code postal saisi', `${l3.etat} fini=${l3.fini}`);
  });
  const mainRetrait = (o = {}) => ({ vrm_widget_token: '', vinted_pickup_done: {}, vinted_ship_done: {}, vinted_bords_shipped: {}, vinted_sales_hidden: [], vinted_bords_hidden: {}, vrm_colis_collected: [], ...o });
  const widget = async () => { const w = (await importer('api/widget.js')).default; const res = faireRes(); await w({ method: 'GET', headers: {}, query: {} }, res); return res.corps || {}; };
  await essaie('n° 8 : une ligne « fini » ancienne reste lue (widget)', async () => {
    resetBase(); await oublis();
    base.set(`${A}|main`, mainRetrait({ vrm_colis_retirer: { total: 1, aVerifier: 0, urgents: 0, at: NOW, colis: [['2099-01-01', NOW - 70 * 24 * H, 'mondialrelay', 'e:12345678', 1, '']], vus: ['12345678'], vusTx: [] } }));
    base.set(`${A}|email_track_mondialrelay_12345678`, ligneMr({ status: 'available', lieu: 'TABAC TEST, 1 Rue Exemple, 99999 Testville', limite: '2099-01-01', receivedAt: iso(NOW - 70 * 24 * H) }));
    base.set(`${A}|transp_mondialrelay_12345678`, { v: 1, rev: 1, carrier: 'mondialrelay', suivi: '12345678', etat: 'retire', etatAt: iso(NOW - 60 * 24 * H), lu: iso(NOW - 60 * 24 * H), essai: iso(NOW - 60 * 24 * H), essaiRes: 'ok', voie: 'mr-fr-mvc', fini: true });
    const r = await widget();
    dit(r.pickup === 0, 'n° 8 : retiré il y a 60 jours (ligne finie, lue il y a 60 j) ⇒ jamais revenu « à retirer » au widget', `pickup=${r.pickup} aVérifier=${r.pickupAVerifier}`);
  });
  await essaie('n° 4 : le widget suit les fins du transporteur après la photo', async () => {
    resetBase(); await oublis();
    base.set(`${A}|main`, mainRetrait({ vrm_colis_retirer: { total: 1, aVerifier: 0, urgents: 0, at: NOW - 3 * H, colis: [['', NOW - 24 * H, 'chronopost', 'e:XW000000031TS', 1, '']], vus: ['XW000000031TS'], vusTx: [] } }));
    base.set(`${A}|transp_chronopost_XW000000031TS`, { v: 1, rev: 1, carrier: 'chronopost', suivi: 'XW000000031TS', etat: 'incident', detail: 'quitte_relais', etatAt: iso(NOW - H), lu: iso(NOW - H), essai: iso(NOW - H), essaiRes: 'ok', voie: 'cp-ws2', fini: false });
    const a = await widget();
    dit(a.pickup === 0 && a.pickupAVerifier === 1 && a.pickupSortis === 0, 'n° 4 : un incident APRÈS la photo ⇒ « à vérifier », jamais « sorti »', `pickup=${a.pickup} aVérifier=${a.pickupAVerifier} sortis=${a.pickupSortis}`);
    resetBase(); await oublis();
    base.set(`${A}|main`, mainRetrait({ vrm_colis_retirer: { total: 0, aVerifier: 0, urgents: 0, at: NOW - 3 * H, colis: [], vus: [], vusTx: [] } }));
    base.set(`${A}|transp_chronopost_XW000000061TS`, { v: 1, rev: 1, carrier: 'chronopost', suivi: 'XW000000061TS', etat: 'disponible', etatAt: iso(NOW - H), lu: iso(NOW - H / 2), essai: iso(NOW - H / 2), essaiRes: 'ok', voie: 'cp-ws2', limite: T.jourParis(NOW + 3 * 24 * H), limiteSure: true, fini: false });
    const b = await widget();
    dit(b.pickup === 1, 'n° 4 : un n° que le transporteur SEUL dit disponible depuis la photo (aucun e-mail) ⇒ compté', `pickup=${b.pickup} nouveaux=${b.pickupNouveaux}`);
    // Les achats Vinted LUS (un résumé capté) : rien d'autre ne fait dire « au moins ».
    const enVerif = async (n) => {
      resetBase(); await oublis();
      base.set(`${A}|main`, mainRetrait({ vrm_colis_retirer: { total: 0, aVerifier: 0, urgents: 0, enVerification: n, at: NOW - 3 * H, colis: [], vus: [], vusTx: [] } }));
      base.set(`${A}|harvest_111_orders_purchased`, { capturedAt: iso(NOW - H), resume: { txns: [], at: iso(NOW - H) }, payload: { my_orders: [] } });
      return widget();
    };
    const c = await enVerif(2), c0 = await enVerif(0);
    dit(c.pickupAuMoins === true && c.pickupEnVerification === 2 && c0.pickupAuMoins === false, 'n° 4 : des achats « en cours de vérification » (ni code ni n°) ⇒ « au moins », jamais un total présenté complet (sans eux : complet)', `auMoins=${c.pickupAuMoins} enVérif=${c.pickupEnVerification} · sans : auMoins=${c0.pickupAuMoins}`);
  });
  await essaie('n° 1 : l\'arrivée d\'un achat Vinted est une BORNE, jamais l\'arrivée', async () => {
    const fins = S.finsDesLignes([], { transp: [{ suivi: 'XW000000041TS', carrier: 'chronopost', etat: 'retour_expediteur', etatAt: iso(NOW - 48 * H) }] });
    dit(S.sortiParSuivis(['XW000000041TS'], fins, null, { borne: NOW - H }) === 'reparti', 'n° 1 : arrivée inconnue, borne = la capture ⇒ un retour d\'il y a 2 j compte (reparti)');
    const finsI = S.finsDesLignes([], { transp: [{ suivi: 'XW000000042TS', carrier: 'chronopost', etat: 'inconnu', etatAt: iso(NOW - 2 * H) }] });
    dit(S.sortiParSuivis(['XW000000042TS'], finsI, null, { borne: NOW - 5 * H }) === 'a_verifier' && S.sortiParSuivis(['XW000000042TS'], finsI, null, { borne: NOW - H }) == null, 'n° 1 : un statut inconnu compte s\'il suit la borne, pas avant');
    resetBase(); await oublis();
    base.set(`${A}|main`, mainRetrait({ vrm_colis_retirer: { total: 1, aVerifier: 0, urgents: 0, at: NOW - H, colis: [['', NOW - 2 * H, 'chronopost', 'v:111:9001', 0, 'XW000000041TS']], vus: [], vusTx: ['9001'] } }));
    base.set(`${A}|transp_chronopost_XW000000041TS`, { v: 1, rev: 1, carrier: 'chronopost', suivi: 'XW000000041TS', etat: 'retour_expediteur', etatAt: iso(NOW - 48 * H), lu: iso(NOW - H), essai: iso(NOW - H), essaiRes: 'ok', voie: 'cp-ws2', fini: true });
    const r = await widget();
    dit(r.pickup === 0 && r.pickupSortis === 1, 'n° 1 : achat Vinted publié avec une arrivée BORNE (la capture) ; le transporteur dit reparti avant ⇒ sorti au widget', `pickup=${r.pickup} sortis=${r.pickupSortis}`);
  });
  await essaie('n° 6 et n° 8 : le rappel du matin (la vraie route)', async () => {
    const cron = (await importer('api/ship-reminders.js')).default;
    const tourne = async () => { pushes.length = 0; const res = faireRes(); await cron({ method: 'GET', headers: { authorization: 'Bearer cle-banc-cron' }, query: {} }, res); return pushes.filter((p) => /Dernier jour|à vérifier/.test(p.title || '')); };
    const auj = T.jourParis(NOW);
    const synth = (coche) => {
      resetBase();
      base.set(`${A}|main`, mainRetrait({ vinted_pickup_done: coche ? { 9001: true } : {} }));
      base.set(`${A}|colis_suivi_chronopost_XW000000051TS`, { suivi: 'XW000000051TS', transporteur: 'chronopost', tx: '9001', at: iso(NOW - 24 * H) });
      base.set(`${A}|transp_chronopost_XW000000051TS`, { v: 1, rev: 1, carrier: 'chronopost', suivi: 'XW000000051TS', etat: 'disponible', etatAt: iso(NOW - 20 * H), lu: iso(NOW - H), essai: iso(NOW - H), essaiRes: 'ok', voie: 'cp-ws2', limite: auj, limiteSure: true, fini: false });
    };
    await oublis(); synth(false); transporteur = () => null;
    const p1 = await tourne();
    dit(p1.length === 1 && /XW000000051TS/.test(p1[0].body || ''), 'n° 6 : un n° ajouté à la main, que le TRANSPORTEUR SEUL dit disponible, dernier jour aujourd\'hui ⇒ le rappel part', p1.map((p) => p.title).join(' · ') || 'aucun');
    await oublis(); synth(true); transporteur = () => null;
    const p2 = await tourne();
    dit(p2.length === 0, 'n° 6 : sa commande cochée « Je l\'ai retiré » (reliée par le n°) ⇒ aucun rappel', p2.map((p) => p.title).join(' · ') || 'aucun');
    resetBase(); await oublis(); transporteur = () => null;
    base.set(`${A}|email_track_mondialrelay_12345678`, ligneMr({ status: 'available', lieu: 'TABAC TEST, 1 Rue Exemple, 99999 Testville', limite: auj, receivedAt: iso(NOW - 70 * 24 * H) }));
    base.set(`${A}|transp_mondialrelay_12345678`, { v: 1, rev: 1, carrier: 'mondialrelay', suivi: '12345678', etat: 'retire', etatAt: iso(NOW - 60 * 24 * H), lu: iso(NOW - 60 * 24 * H), essai: iso(NOW - 60 * 24 * H), essaiRes: 'ok', voie: 'mr-fr-mvc', fini: true });
    const p3 = await tourne();
    dit(p3.length === 0, 'n° 8 : retiré il y a 60 jours (ligne finie) ⇒ aucun « dernier jour » le matin', p3.map((p) => p.title).join(' · ') || 'aucun');
  });
  await essaie('n° 10 et constat e', async () => {
    dit(S.repartiAffichable(NOW - 10 * 24 * H, NOW) === true && S.repartiAffichable(NOW - 40 * 24 * H, NOW) === false && S.repartiAffichable(NaN, NOW) === true, 'n° 10 : un colis reparti se montre 30 jours (date inconnue : montré)');
    dit(T.carrierLisible('vinted', '123456789012') === 'vinted' && !S.transporteurDeForme('123456789012'), 'constat e : 12 chiffres = un n° Vinted Go lisible (ligne Vinted), jamais un transporteur deviné par la forme seule', `${T.carrierLisible('vinted', '123456789012')} · ${S.transporteurDeForme('123456789012')}`);
    const t = S.texteRappelRetrait({ etat: 'a_verifier', raison: 'trop_long', garde: 5, suivi: '12345678', transporteur: 'mondialrelay', lieu: 'TABAC TEST' });
    dit(/à vérifier/.test(t.title) && !/sans doute|reparti\b(?! ?\.)/i.test(t.title) && !/sans doute/i.test(t.body), 'constat : « à vérifier », jamais « sans doute reparti »', `${t.title} — ${t.body}`);
  });
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s).` : '\n✅ Le statut lu chez les transporteurs suit la règle (serveur, secours, pause, échos, fins, notifications).');
  process.exit(ko ? 1 : 0);
})();
