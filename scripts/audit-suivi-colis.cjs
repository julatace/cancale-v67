#!/usr/bin/env node
// AUDIT (23 oct.) — LE SUIVI DES COLIS PAR N° ET PAR VINTED, LES NOTIFICATIONS.
// Julien : « quand on reçoit un mail comme quoi on a retiré un colis, le numéro
// de suivi est comparé à ceux dans les colis à retirer et ça retire les
// concernés » ; « enregistrer le numéro de suivi et tracer le colis » ; « que ça
// me prévienne dès qu'il y a une mise à jour d'un colis » ; « il ne doit plus y
// avoir de problème avec les retraits, je me suis déplacé pour rien ».
// MESURÉ (lecture seule, sa base, 23 oct.) — reproduit ici avec des valeurs
// INVENTÉES, à la même forme :
//   · le même n° vit sous plusieurs clés (`email_track_mondialrelay_N`,
//     `…_vinted_N`) : un « retiré » rangé sur l'une ne sortait le colis de
//     l'autre que si la ligne portait `suivi` — or 23 lignes n'ont leur n° QUE
//     dans le SUJET, après « # » (« Ton colis arrive aujourd'hui ! #… ») ;
//   · « Uw pakket is afgehaald door de ontvanger » (DPD, NL) était rangé « info » ;
//     « Tu envío ha sido recogido » (ES) est ambigu (6 lignes sur 8 portent le n°
//     d'une confirmation de DÉPÔT : la relève par le transporteur) ;
//   · le « retiré » ne sonnait jamais : le premier « en transit » consommait la
//     clé `track-N` ;
//   · la transaction Vinted ne porte AUCUN n° de suivi (0 sur 1 290) : la lecture
//     de `shipment.tracking_code` était morte ;
//   · Chronopost : l'adresse « tracking-no-cdn » est morte, « tracking-no-cms »
//     est celle que Leboncoin range.
// Il EXÉCUTE : la règle partagée (api/_lib/suivi-colis.js), les vraies règles de
// l'app (src/App.jsx par Babel, src/liensColis.js), la vraie route
// api/email-inbound, la vraie route api/ship-reminders (cron du matin) et la
// vraie route api/widget, sur une fausse base À ÉTAT (ce qui est écrit est relu,
// `meta` calculée comme la base : les scalaires de premier niveau).
// `--prouve` : réaffaiblit la règle, chaque mutation doit rendre ROUGE.
// §6.1 : lancé depuis un arbre d'avant (AUDIT_RACINE ou copié dedans), il est rouge.
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

const MUTATIONS = {
  'sujet-ignore': ['api/_lib/suivi-colis.js', "normaliserSuivi(l.suivi != null ? l.suivi : l.su) || suiviDuSujet(l.subject != null ? l.subject : (l.sujet != null ? l.sujet : l.sj))", "normaliserSuivi(l.suivi != null ? l.suivi : l.su)"],
  'nl-ignore': ['api/_lib/etat-colis-email.js', "const retireNl=/\\b(?:af|op)gehaald\\s+door\\s+de\\s+ontvanger\\b/.test(t);", "const retireNl=false;"],
  'espagnol-pris': ['api/_lib/etat-colis-email.js', "const retireNl=/\\b(?:af|op)gehaald\\s+door\\s+de\\s+ontvanger\\b/.test(t);", "const retireNl=/\\b(?:af|op)gehaald\\s+door\\s+de\\s+ontvanger\\b|ha\\s+sido\\s+recogido/.test(t);"],
  'retire-ignore': ['api/_lib/suivi-colis.js', "    if (f.retire) return 'retire';", ''],
  'retour-avant-arrivee': ['api/_lib/suivi-colis.js', "d == null || d >= arriveeMs)) reparti = true;", "d == null || true)) reparti = true;"],
  'chrono-mort': ['api/_lib/suivi-colis.js', 'tracking-no-cms/suivi-page', 'tracking-no-cdn/suivi-page'],
  'cp-devine': ['api/_lib/suivi-colis.js', "const cp = normaliserCodePostal(codePostal);", "const cp = normaliserCodePostal(codePostal) || '35260';"],
  'cle-retire-commune': ['api/email-inbound.js', "  if (t.status === 'delivered' && t.sens !== 'sortant') return `retire-${id}`;", ''],
  'notif-ailleurs-ignoree': ['api/email-inbound.js', 'if (!sortiAilleurs) try { await pushOnce({', 'try { await pushOnce({'],
  'sujet-pas-range': ['api/email-inbound.js', "  if (!suivi) { suivi = suiviDuSujet(mail.subject) || null; suiviDuSujetSeul = !!suivi; }", ''],
  'rappel-sans-memo': ['api/ship-reminders.js', 'const nouveaux = liste.filter((x) => !envoyes[x.cle]);', 'const nouveaux = liste;'],
  'rappel-memo-passu': ['api/ship-reminders.js', "  const deja = await getRow('colis_retrait_dedup');\n  if (deja === undefined) return 'mémo illisible — rien envoyé';", "  const deja = await getRow('colis_retrait_dedup');"],
  'rappel-memo-non-ecrit': ['api/ship-reminders.js', "  if (!(await ecrireDedup('colis_retrait_dedup', { envoyes: memo, at: new Date(maintenant).toISOString() }))) return 'mémo non écrit — rien envoyé';", "  await ecrireDedup('colis_retrait_dedup', { envoyes: memo, at: new Date(maintenant).toISOString() });"],
  'rappel-pref-ignoree': ['api/ship-reminders.js', "  if (!(await pushCategorieActive('colis'))) return 'désactivé par le vendeur';", ''],
  'rappel-main-passu': ['api/ship-reminders.js', 'if (!Array.isArray(lignes) || m === undefined || !Array.isArray(bords))', 'if (!Array.isArray(lignes) || !Array.isArray(bords))'],
  'rappel-coche-ignoree': ['api/_lib/suivi-colis.js', '    if (coches.has(brut) || cochesN.has(k)) continue;', ''],
  'rappel-garde-ignoree': ['api/_lib/suivi-colis.js', "    else if (e.etat === 'trop_long' && Number.isFinite(e.age) && e.age <= e.garde + 1 + RATTRAPAGE_J) etat = 'a_verifier';", ''],
  'rappel-finis-ignores': ['api/_lib/suivi-colis.js', "    if (finisS.has('e:' + k)) continue;", ''],
  'achat-champs-morts': ['src/liensColis.js', "return [...new Set([t.suivi,...(Array.isArray(t.suivis)?t.suivis:[])]", "return [...new Set([achat?.tracking_code,achat?.shipment?.tracking_code,t.suivi,...(Array.isArray(t.suivis)?t.suivis:[])]"],
  'achat-autre-compte': ['src/liensColis.js', " if(t.uid&&uid&&String(t.uid)!==uid)return [];", ''],
  'index-par-transaction': ['src/liensColis.js', "return (uid&&index[uid+':'+tx])||index[tx]||null;", "return index[tx]||(uid&&index[uid+':'+tx])||null;"],
  // ── revue du 23 oct. ──
  'arrivee-a-venir-ignoree': ['api/_lib/etat-colis-email.js', "if((FUTUR.test(t)||ARRIVEE_A_VENIR.test(t))&&", "if((FUTUR.test(t))&&"],
  'sujet-preuve-arrivee': ['api/email-inbound.js', "if (track.status === 'available' && track.suiviDuSujetSeul && !track.code", "if (false && track.status === 'available' && track.suiviDuSujetSeul && !track.code"],
  'cron-sans-relecture': ['api/_lib/suivi-colis.js', "  lignes = (Array.isArray(lignes) ? lignes : []).map((l) => relireLigneMeta(l));", "  lignes = (Array.isArray(lignes) ? lignes : []).map((l) => ligneDeMeta(l));"],
  'widget-sans-relecture': ['api/widget.js', "  const toutes = [...dispo0, ...partis0].map(relireLigneMeta).filter(Boolean);", "  const toutes = [...dispo0, ...partis0].filter(Boolean);"],
  'cron-commande-ignoree': ['api/_lib/suivi-colis.js', "      if (f === undefined || f) continue;", ""],
  'cron-relais-passu-envoie': ['api/ship-reminders.js', "  const relais = relaisRow === undefined ? null : objet(relaisRow);", "  const relais = objet(relaisRow);"],
  'cron-commandes-ratees-envoient': ['api/ship-reminders.js', "    if (!Array.isArray(a) || !Array.isArray(e)) return 'lecture ratée — rien envoyé';\n    achats = a;", "    achats = Array.isArray(a) ? a : [];"],
  'arrivee-heure-traitement': ['api/email-inbound.js', "const a = arriveLeAuRangement(prevLigne, subject, track.status, emailAt || now); return a ? { arriveLe: a } : {};", "const a = arriveLeAuRangement(prevLigne, subject, track.status, now); return a ? { arriveLe: a } : {};"],
  'notif-arrivee-heure-traitement': ['api/email-inbound.js', "          const a = arriveLeAuRangement(prevLigne, subject, 'available', emailAt || now);", "          const a = arriveLeAuRangement(prevLigne, subject, 'available', now);"],
  'retour-heure-traitement': ['api/_lib/suivi-colis.js', "    else e.retours.push(msDe(l.emailAt != null ? l.emailAt : l.ea) ?? msDe(l.receivedAt != null ? l.receivedAt : l.r));", "    else e.retours.push(msDe(l.receivedAt != null ? l.receivedAt : l.r));"],
  'vente-retiree-cle-neuve': ['api/email-inbound.js', "  if (t.status === 'delivered' && t.sens !== 'sortant') return `retire-${id}`;", "  if (t.status === 'delivered') return `retire-${id}`;"],
  'vente-bordereau-ignore': ['api/email-inbound.js', "          if ((Array.isArray(bordsK) && bordsK.length) || (Array.isArray(sortantsK) && sortantsK.length)) sensLigne = 'sortant';", ""],
};
const ARG_PROUVE = process.argv.find((x) => x.startsWith('--prouve'));
if (ARG_PROUVE) {
  let ok = 0;
  const seules = ARG_PROUVE.includes('=') ? ARG_PROUVE.split('=')[1].split(',') : null;
  const choisies = Object.entries(MUTATIONS).filter(([nom]) => !seules || seules.includes(nom));
  for (const [nom, [f, de, vers]] of choisies) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-suivi-'));
    for (const x of ['api', 'src', 'package.json']) fs.cpSync(path.join(R, x), path.join(t, x), { recursive: true });
    fs.symlinkSync(fs.realpathSync(path.join(R, 'node_modules')), path.join(t, 'node_modules'));
    const src = fs.readFileSync(path.join(t, f), 'utf8');
    if (src.split(de).length !== 2) { console.log(`❌ mutation ${nom} : ancre ${src.includes(de) ? 'pas unique' : 'introuvable'} dans ${f}`); fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(path.join(t, f), src.replace(de, vers));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌/gm) || []).length;
    const tombe = r.status !== 0 && rouges > 0;
    if (tombe) ok++;
    console.log(`${tombe ? '✅' : '❌'} mutation « ${nom} » ⇒ ${tombe ? rouges + ' rouge(s)' : 'VERTE (le contrôle ne la voit pas)'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  const n = choisies.length;
  console.log(ok === n ? `\n✅ ${ok}/${n} mutations attrapées` : `\n❌ ${n - ok} mutation(s) non attrapée(s)`);
  process.exit(ok === n ? 0 : 1);
}

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String((e && e.stack) || e).split('\n').slice(0, 2).join(' ').slice(0, 240)); } };
const importer = (p) => import('file://' + path.join(R, p));

// ── Une fausse base à état, à la forme de PostgREST ────────────────────────
const A = '11111111-2222-3333-4444-555555555555';
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VRM_OWNER_UID = A;
process.env.EMAIL_INBOUND_SECRET = 'cle-banc-suivi';
process.env.CRON_SECRET = 'cle-banc-cron';
process.env.VAPID_PRIVATE_KEY = 'banc-cle-privee-factice';
delete process.env.AI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
const webpush = require(path.join(R, 'node_modules', 'web-push'));
const pushes = [];
webpush.setVapidDetails = () => {};
webpush.sendNotification = async (sub, body) => { pushes.push({ endpoint: sub.endpoint, ...JSON.parse(body) }); return { statusCode: 201 }; };

const base = new Map();
let pannes = new Set(), acces = true;
const lus = [], ecrits = [];
const rep = (c, s = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
const chemin = (obj, ch) => { let v = obj; for (const seg of ch.split(/->>|->/)) v = v == null ? undefined : v[seg]; return v; };
// La colonne `meta` : les scalaires de premier niveau ≤ 600 caractères (vrm_meta).
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
global.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  const brut = decodeURIComponent(u.pathname + u.search);
  if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(acces);
  if (u.pathname === '/rest/v1/vinted_accounts') return rep([]);
  if (u.pathname !== '/rest/v1/app_data') return rep([]);
  if (m === 'POST') {
    const prefer = String((opts.headers && (opts.headers.Prefer || opts.headers.prefer)) || '');
    for (const r of JSON.parse(opts.body || '[]')) {
      ecrits.push({ id: r.id, owner: r.owner || A });
      if (pannes.has('ecrire:' + r.id)) return rep('<html>522</html>', 522);
      const cle = `${r.owner || A}|${r.id}`;
      if (/ignore-duplicates/.test(prefer) && base.has(cle)) continue;
      base.set(cle, r.data);
    }
    return /return=representation/.test(prefer) ? rep([], 201) : new Response('', { status: 201 });
  }
  if (m === 'PATCH') {
    const corps = JSON.parse(opts.body || '{}');
    const t = filtrer(u); for (const l of t) base.set(`${l.owner}|${l.id}`, corps.data);
    return rep(t.map((l) => ({ id: l.id })));
  }
  if (m === 'DELETE') { for (const l of filtrer(u)) base.delete(`${l.owner}|${l.id}`); return new Response('', { status: 204 }); }
  lus.push(brut);
  for (const p of pannes) if (p.startsWith('lire:') && brut.includes(p.slice(5))) return new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } });
  const sel = u.searchParams.get('select') || '';
  if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);   // base cloisonnée
  return rep(filtrer(u).map((l) => projeter(l, sel)));
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.send = () => r; r.end = () => r; return r; };

// ── Les règles de l'app, extraites telles quelles (Babel) ───────────────────
function chargeApp(noms, injecte) {
  const parser = require(path.join(R, 'node_modules', '@babel', 'parser'));
  const src = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
  const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  const t = {};
  for (const n of ast.program.body) {
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id && noms.includes(d.id.name)) t[d.id.name] = 'const ' + src.slice(d.start, d.end) + ';';
  }
  const ctx = { ...injecte }; vm.createContext(ctx);
  for (const nom of noms) { if (!t[nom]) { ctx['__absent_' + nom] = true; continue; } try { vm.runInContext(t[nom] + `\nthis.${nom}=${nom};`, ctx); } catch (e) { ctx['__err_' + nom] = e.message; } }
  return ctx;
}

(async () => {
  let S = null;
  // ══ 1. LA RÈGLE PARTAGÉE ══════════════════════════════════════════════════
  await essaie('règle partagée (api/_lib/suivi-colis.js)', async () => {
    S = await importer('api/_lib/suivi-colis.js');
    const { etatColisDepuisTexte } = await importer('api/_lib/etat-colis-email.js');
    dit(S.suiviDuSujet("Ton colis arrive aujourd'hui ! #1790000000000001") === '1790000000000001', 'le n° écrit après « # » dans le SUJET est lu (forme Vinted Go mesurée)');
    dit(S.suiviDuSujet('Libère de la place dans la consigne : récupère ton colis sans attendre ! #1UW1T3ABCD12') === '1UW1T3ABCD12' && S.suiviDuSujet('Ton colis est arrivé #VGS12345678055') === 'VGS12345678055', 'lettres et chiffres (« 1UW1T3… », « VGS… ») aussi');
    dit(S.suiviDuSujet('#PROMOTION') === '' && S.suiviDuSujet('Ton colis est arrivé') === '', 'pas de chiffre, ou pas de « # » ⇒ rien (jamais un mot pris pour un n°)');
    dit(S.suiviDeLigne({ suivi: '', subject: 'Ton colis a été retiré #30000001' }) === '30000001' && S.suiviDeLigne({ suivi: '30 000-002', subject: '#30000099' }) === '30000002', 'une ligne : son `suivi` d\'abord, sinon le n° du sujet');
    dit(etatColisDepuisTexte('Uw pakket is afgehaald door de ontvanger', '') === 'delivered', '« Uw pakket is afgehaald door de ontvanger » (NL) ⇒ retiré');
    dit(etatColisDepuisTexte('Tu envío ha sido recogido', '') !== 'delivered', '« Tu envío ha sido recogido » (ES) n\'est PAS un retrait : ambigu (la relève par le transporteur), sans preuve ⇒ rien');
    const L = (o) => ({ status: 'available', subject: '', receivedAt: '2026-10-20T08:00:00Z', ...o });
    const fins = S.finsDesLignes([
      L({ suivi: '', status: 'delivered', subject: 'Ton colis a été retiré #30000011', receivedAt: '2026-10-21T08:00:00Z' }),
      L({ suivi: '30000012', status: 'retour', receivedAt: '2026-10-22T08:00:00Z' }),
      L({ suivi: '30000013', status: 'retour', receivedAt: '2026-10-10T08:00:00Z' }),
      L({ suivi: '30000014', status: 'info', subject: 'Uw pakket is afgehaald door de ontvanger', receivedAt: '2026-10-21T08:00:00Z' }),
      L({ suivi: '30000015', status: 'retour', sens: 'sortant', receivedAt: '2026-10-22T08:00:00Z' }),
    ], { estSortant: (l) => l.sens === 'sortant' });
    const arr = Date.parse('2026-10-20T08:00:00Z');
    dit(S.sortiParSuivis(['30000011'], fins, arr) === 'retire', 'un « retiré » rangé SOUS UNE AUTRE CLÉ, n° dans le seul sujet ⇒ le colis est retiré');
    dit(S.sortiParSuivis(['30000011'], fins, Date.parse('2026-10-25T08:00:00Z')) === 'retire', 'UN RETIRÉ RESTE RETIRÉ : un « disponible » ou un rappel traité après ne le ressuscite pas');
    dit(S.sortiParSuivis(['30000012'], fins, arr) === 'reparti', 'un retour écrit APRÈS l\'arrivée, même n° ⇒ reparti');
    dit(S.sortiParSuivis(['30000013'], fins, arr) === null, 'un retour écrit AVANT l\'arrivée ne compte pas (ce n\'est pas ce passage-là)');
    dit(S.sortiParSuivis(['30000014'], fins, arr) === 'retire', 'une ligne « info » NL rangée avant ce jour est relue avec la règle d\'aujourd\'hui ⇒ retiré');
    dit(S.sortiParSuivis(['30000015'], fins, arr) === null, 'le retour d\'un colis QU\'IL A ENVOYÉ ne sort rien de « à retirer »');
    dit(S.transporteurDeForme('30000060') === 'mondialrelay' && S.transporteurDeForme('XW123456789FR') === 'chronopost' && S.transporteurDeForme('VGS12345678') === 'vinted' && S.transporteurDeForme('09440000000061') === null,
      'le transporteur se lit à la FORME du n° (8 chiffres · 2 lettres 9 chiffres 2 lettres · VGS…) ; ambigu ⇒ null (on demande)');
    const lc = S.lienSuivi('chronopost', 'XW123456789FR');
    dit(lc && /chronopost\.fr\/tracking-no-cms\/suivi-page\?listeNumerosLT=XW123456789FR$/.test(lc.url) && lc.site, 'Chronopost : « tracking-no-cms » (l\'adresse « tracking-no-cdn » est morte), n° pré-rempli', lc && lc.url);
    const lm = S.lienSuivi('mondialrelay', '30000060', '35260'), lm2 = S.lienSuivi('mondialrelay', '30000060', ''), lm3 = S.lienSuivi('mondialrelay', '30000060', 'Cancale');
    dit(lm && /numeroExpedition=30000060&codePostal=35260$/.test(lm.url) && lm2 && !/codePostal/.test(lm2.url) && lm3 && !/codePostal/.test(lm3.url), 'Mondial Relay : le code postal LU s\'ajoute ; absent ou illisible ⇒ rien (jamais deviné)', `${lm && lm.url} · ${lm2 && lm2.url}`);
    const lg = S.lienSuivi('dpd', '30000061');
    dit(lg && lg.site === false && /google\.com\/search\?q=30000061/.test(lg.url) && S.lienSuivi('mondialrelay', '') === null, 'transporteur sans page connue ⇒ une RECHERCHE du n°, dite comme telle ; sans n° ⇒ aucun lien');
    dit(S.codePostalLu({ lieu: "TABA'TEST, 12 Rue Exemple, 56000 Vannes" }) === '56000' && S.codePostalLu({ lieu: 'Consigne Vinted Go' }) === '', 'le code postal se LIT dans le lieu de l\'e-mail — sinon rien');
    const nv = S.nouvelleVinted({ dernier: { t: '  Ton colis   est arrivé au point relais ', at: '2026-10-22T08:00:00Z' }, capturedAt: '2026-10-22T09:00:00Z' });
    dit(nv && nv.t === 'Ton colis est arrivé au point relais' && nv.at === Date.parse('2026-10-22T08:00:00Z') && S.nouvelleVinted({ dernier: null }) === null && S.nouvelleVinted({ dernier: { t: '' } }) === null, 'la dernière nouvelle de Vinted : son texte TEL QUEL (espaces resserrés), sa date ; rien sans texte');
  });

  // ══ 2. LE RAPPEL DU MATIN : LA LISTE (pure) ═══════════════════════════════
  await essaie('rappel du matin (règle)', async () => {
    const T = Date.parse('2026-10-27T08:00:00Z');   // mardi, 9 h à Paris
    const ligne = (o) => ({ s: 'available', r: '2026-10-25T08:00:00Z', a: '2026-10-25T08:00:00Z', su: '', sj: 'Votre colis est disponible', c: 'mondialrelay', l: null, lieu: "Bar Test, 5 Rue Exemple, 56000 Vannes", ...o });
    const lignes = [
      ligne({ su: '30000021', l: '2026-10-27' }),                                                               // dernier jour
      ligne({ su: '09440000000022', c: 'chronopost', l: null, a: '2026-10-22T09:00:00Z', r: '2026-10-22T09:00:00Z' }), // 5 j > garde 4 ⇒ à vérifier
      ligne({ su: '30000023', l: '2026-10-27' }), { s: 'delivered', su: '', sj: 'Ton colis a été retiré #30000023', r: '2026-10-26T10:00:00Z' },
      ligne({ su: '30000024', l: '2026-10-27' }),                                                               // coché
      ligne({ su: '30000025', l: '2026-10-27' }),                                                               // l'app le sait fini
      ligne({ su: '30000026', l: '2026-10-27', se: 'sortant' }),                                                // un colis qu'il envoie
      ligne({ su: '', sj: 'Ton colis est arrivé à la consigne #VGS12345678027', c: 'vinted', l: '2026-10-27' }), // n° du sujet
      ligne({ su: '30000028', l: '2026-10-26' }),                                                               // limite hier ⇒ à vérifier
      ligne({ su: '30000029', l: '2026-10-20' }),                                                               // limite il y a 7 j ⇒ déjà dit
      ligne({ su: '30000030', l: '2026-10-30' }),                                                               // pas aujourd'hui
    ];
    const l = S.rappelsRetraitDuJour({ lignes, collectes: ['30000024'], finis: ['e:30000025'], envoyes: [], maintenant: T });
    const cles = l.map((x) => x.cle).sort();
    dit(JSON.stringify(cles) === JSON.stringify(['a_verifier-09440000000022', 'a_verifier-30000028', 'dernier-30000021', 'dernier-VGS12345678027']),
      'aujourd\'hui : « dernier jour » (limite LUE = aujourd\'hui, n° du sujet compris) et « à vérifier » (limite passée hier, garde Chronopost dépassée) — jamais un colis retiré ailleurs, coché, fini pour l\'app, envoyé', cles.join(' · '));
  });

  // ══ 3. LES RÈGLES DE L'APP ════════════════════════════════════════════════
  await essaie('règles de l\'app (src/App.jsx, Babel)', async () => {
    const etat = await importer('api/_lib/etat-colis-email.js');
    const app = chargeApp(['SUJET_SORTANT', 'SUJET_ENTRANT', 'colisKey', 'sensColis', 'finsColis', 'suivisRetires', 'colisRetireAilleurs', 'trackUrl'],
      { normaliserSuivi: etat.normaliserSuivi, finsDesLignes: S.finsDesLignes, suiviDeLigne: S.suiviDeLigne, lienSuivi: S.lienSuivi, sortiParSuivi: S.sortiParSuivi, sensDeLigne: S.sensDeLigne });
    const manque = ['finsColis', 'suivisRetires', 'colisRetireAilleurs', 'colisKey', 'trackUrl'].filter((n) => !app[n] || app['__err_' + n]);
    dit(!manque.length, 'les règles de l\'app se chargent', manque.join(', '));
    if (manque.length) return;
    const dispo = S.avecSuiviDuSujet({ status: 'available', suivi: '', subject: 'Ton colis est arrivé à la consigne #VGS12345678056', code: 'C56565' });
    const retireAilleurs = { status: 'delivered', suivi: 'VGS12345678056', subject: 'Ton colis a été retiré', carrier: 'vinted' };
    dit(app.colisRetireAilleurs(dispo, app.suivisRetires([dispo, retireAilleurs], null)), 'app : le colis dont le n° n\'est QUE dans le sujet sort de « à retirer » quand un « retiré » au même n° arrive sous une autre clé');
    dit(app.colisKey(dispo) === 'Ton colis est arrivé à la consigne #VGS12345678056', 'app : un n° lu dans le sujet ne change pas la clé de la coche « J\'ai retiré » (posée avant ce jour sur le sujet)', app.colisKey(dispo));
    dit(/tracking-no-cms/.test(app.trackUrl('chronopost', 'XW123456789FR')) && /codePostal=35260/.test(app.trackUrl('mondialrelay', '30000060', '35260')), 'app : le lien de suivi passe par la règle partagée (Chronopost « no-cms », code postal Mondial Relay)');
    const src = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
    dit(/avecSuiviDuSujet\(reclassifyTrack\(r\.data\)\)/.test(src) && /avecSuiviDuSujet\(reclassifyTrack\(r && r\.data\)\)/.test(src), 'app : le n° du sujet est relu pour Achats/Ma journée ET pour l\'écran d\'équipe');
    dit(!/tracking_code|tracking_number/.test(src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')), 'app : plus aucune lecture de `tracking_code` / `tracking_number` (0 transaction sur 1 290 en porte)');
    const { suivisAchat, achatDuColis } = await importer('src/liensColis.js');
    const a1 = { transaction_id: '9601', _acc: { vinted_user_id: '111' }, title: 'Asics Gel bleue taille 43', tracking_code: '30000099', shipment: { tracking_code: '30000098' } };
    const a2 = { transaction_id: '9602', _acc: { vinted_user_id: '111' }, title: 'Asics Gel bleue taille 43' };
    const idx = { '9601': { uid: '111', suivi: '30000057' }, '9602': { uid: '222', suivi: '30000058' } };
    dit(JSON.stringify(suivisAchat(a1, idx)) === '["30000057"]', 'achat : son n° vient de SA ligne de suivi Vinted — jamais des champs morts de la commande', JSON.stringify(suivisAchat(a1, idx)));
    dit(suivisAchat(a2, idx).length === 0 && achatDuColis({ suivi: '30000058' }, [a1, a2], idx) === null, 'achat : une ligne de suivi d\'un AUTRE compte ne relie rien (même titre, même transaction)');
    dit(achatDuColis({ suivi: '30000057' }, [a1, a2], idx) === a1 && achatDuColis({ artTitle: 'Asics Gel bleue taille 43' }, [a1, a2], idx) === null, 'achat : relié par le n° seulement, jamais par le titre');
    // Une transaction Vinted est vue des DEUX côtés : sa ligne de suivi se range
    // sous « compte:transaction », et la photo sous la transaction seule.
    const idx2 = { '9602': { photo: 'https://images.example.test/p.jpg' }, '222:9602': { uid: '222', suivi: '30000058' }, '111:9602': { uid: '111', suivis: ['30000071'] } };
    dit(JSON.stringify(suivisAchat(a2, idx2)) === '["30000071"]' && achatDuColis({ suivi: '30000071' }, [a1, a2], idx2) === a2 && achatDuColis({ suivi: '30000058' }, [a1, a2], idx2) === null,
      'achat : la même transaction portée par un AUTRE compte ne masque pas le n° relié à CE compte (index « compte:transaction »)', JSON.stringify(suivisAchat(a2, idx2)));
  });

  // ══ 4. LA ROUTE DES E-MAILS ═══════════════════════════════════════════════
  const mr = (sujet, corps, n) => ({ from: 'noreply@mondialrelay.fr', to: 'boite@banc.test', subject: sujet, text: corps, html: '', attachments: [], messageId: `<mr-${n}@banc>` });
  const vt = (sujet, corps, n) => ({ from: 'shipping@relay.vinted.com', to: 'boite@banc.test', subject: sujet, text: corps, html: '', attachments: [], messageId: `<vt-${n}@banc>` });
  let inbound = null;
  const resetBase = () => {
    base.clear(); pannes = new Set(); acces = true; pushes.length = 0; lus.length = 0; ecrits.length = 0;
    base.set(`${A}|main`, { vrm_colis_collected: [] });
    base.set(`${A}|push_subs`, { subs: [{ endpoint: 'https://web.push.apple.com/iphone' }] });
    base.set(`${A}|push_prefs`, { colis: true, suivi: true });
    base.set(`${A}|vrm_email_owners`, { adresses: { 'boite@banc.test': { owner: A } } });
  };
  const recoit = async (mail) => { const res = faireRes(); await inbound.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-suivi' }, body: JSON.parse(JSON.stringify(mail)) }, res); return res; };
  const oublis = async () => {
    try { const p = await importer('api/_lib/push.js'); if (typeof p.oublierPrefsVues === 'function') p.oublierPrefsVues(); } catch (_) {}
    try { const a = await importer('api/_lib/abonnement.js'); if (typeof a.oublierAcces === 'function') a.oublierAcces(); } catch (_) {}
    if (inbound && typeof inbound.oublierMemoEnAttente === 'function') inbound.oublierMemoEnAttente();
  };
  await essaie('route api/email-inbound', async () => {
    inbound = await importer('api/email-inbound.js');
    // A. Le n° du sujet est rangé dans `suivi` (une identité pour la suite).
    resetBase(); await oublis();
    const r0 = await recoit(vt("Ton colis arrive aujourd'hui ! #1790000000000043", 'Bonjour,\nTon colis Vinted Go arrive aujourd\'hui à la consigne.', 1));
    const ligneVgo = [...base.entries()].find(([k]) => /email_track_.*1790000000000043$/.test(k));
    dit(r0.code === 200 && ligneVgo && ligneVgo[1].suivi === '1790000000000043', 'un e-mail dont le n° n\'est QUE dans le sujet (« #… ») est rangé AVEC ce n°', `HTTP ${r0.code} · ${ligneVgo ? ligneVgo[0].split('|')[1] + ' suivi=' + ligneVgo[1].suivi : 'aucune ligne'}`);
    // B. « disponible » sans code, puis « retiré » sous une AUTRE clé (n° dans le sujet),
    //    puis un rappel AVEC le code sur la première clé : le rappel ne sonne pas « 📍 ».
    resetBase(); await oublis();
    await recoit(mr('Votre colis 30000041 est disponible 📦', 'Bonjour,\nVotre colis 30000041 est disponible dans votre Point Relais.\nPoint Relais\nBar Test\n5 Rue Exemple\n56000 Vannes', 2));
    const avant = pushes.length;
    await recoit(vt('Ton colis a été retiré #30000041', 'Bonjour,\nTon colis a été retiré. Bonne journée !', 3));
    const retire = pushes.slice(avant);
    dit(retire.length === 1 && /✅/.test(retire[0].title) && /30000041/.test(retire[0].body || ''), 'un « retiré » (autre clé, n° du sujet) sonne UNE fois, avec le n°', JSON.stringify(retire.map((p) => [p.title, p.body])));
    const ap = pushes.length;
    await recoit(mr('Votre colis 30000041 est disponible 📦', 'Bonjour,\nVotre colis 30000041 vous attend toujours.\nVotre code de retrait est 482913\nPoint Relais\nBar Test\n5 Rue Exemple\n56000 Vannes', 4));
    const apres = pushes.slice(ap).filter((p) => /📍|point de retrait/i.test(`${p.title} ${p.body}`));
    dit(apres.length === 0, 'UN RETIRÉ RESTE RETIRÉ : un rappel « disponible » (même avec un code neuf) reçu APRÈS ne sonne pas « 📍 à retirer »', JSON.stringify(apres.map((p) => p.title)));
    // C. « en transit » puis « retiré » (même clé) : le retiré sonne quand même.
    resetBase(); await oublis();
    await recoit(mr("Votre colis 30000042 est en cours d'acheminement", "Bonjour,\nVotre colis 30000042 est en cours d'acheminement vers votre Point Relais.", 5));
    const at = pushes.length;
    await recoit(mr('Votre colis 30000042 a été retiré', 'Bonjour,\nVotre colis 30000042 a été retiré. Merci.', 6));
    const r2 = pushes.slice(at);
    dit(r2.length === 1 && /✅/.test(r2[0].title) && /30000042/.test(r2[0].body || ''), '« en transit » PUIS « retiré » : le retiré sonne (le transit ne consomme plus sa clé), une fois, avec le n°', JSON.stringify(r2.map((p) => p.title)));
    await recoit(mr('Votre colis 30000042 a été retiré', 'Bonjour,\nVotre colis 30000042 a été retiré. Merci.', 7));
    dit(pushes.slice(at).length === 1, 'le même « retiré » reçu deux fois ne sonne qu\'UNE fois');
    // D. « retour » au même n° : une fois, avec le n°.
    resetBase(); await oublis();
    await recoit(mr("Votre colis 30000044 a été retourné à l'expéditeur", "Bonjour,\nVotre colis 30000044 n'a pas été retiré à temps : il a été retourné à l'expéditeur.", 8));
    const rr = pushes.filter((p) => /repart|retour/i.test(`${p.title} ${p.body}`));
    dit(rr.length === 1 && /30000044/.test(`${rr[0].title} ${rr[0].body}`), 'un « retour » sonne une fois, avec le n°', JSON.stringify(pushes.map((p) => p.title)));
    // E. La lecture des autres lignes ratée : on ne sait pas ⇒ comme avant (la notification part).
    resetBase(); await oublis();
    pannes.add('lire:meta->>suivi.eq.30000045');
    await recoit(mr('Votre colis 30000045 est disponible 📦', 'Bonjour,\nVotre colis 30000045 est disponible.\nVotre code de retrait est 111222\nPoint Relais\nBar Test\n5 Rue Exemple\n56000 Vannes', 9));
    dit(pushes.filter((p) => /📍/.test(p.title)).length === 1, 'lecture des autres lignes ratée ⇒ « pas su » ne fait pas taire « 📍 » (on ne sait pas qu\'il est retiré)');
  });

  // ══ 5. LE CRON DU MATIN ═══════════════════════════════════════════════════
  await essaie('route api/ship-reminders (rappel du matin)', async () => {
    const cron = (await importer('api/ship-reminders.js')).default;
    const T = Date.parse('2026-10-27T08:00:00Z');   // mardi, 9 h à Paris
    const vraiNow = Date.now;
    const lancer = async () => { Date.now = () => T; try { const r = faireRes(); await cron({ method: 'GET', headers: { authorization: 'Bearer cle-banc-cron' }, query: {} }, r); return r; } finally { Date.now = vraiNow; } };
    const prepare = () => {
      resetBase();
      base.set(`${A}|main`, { vrm_colis_collected: ['30000024'], vrm_colis_retirer: { finis: ['e:30000025'], at: T - 3600000 } });
      const tr = (cle, o) => base.set(`${A}|email_track_${cle}`, { status: 'available', subject: 'Votre colis est disponible', receivedAt: '2026-10-25T08:00:00Z', arriveLe: '2026-10-25T08:00:00Z', carrier: 'mondialrelay', lieu: 'Bar Test, 5 Rue Exemple, 56000 Vannes', ...o });
      tr('mondialrelay_30000021', { suivi: '30000021', limite: '2026-10-27' });
      tr('chronopost_09440000000022', { suivi: '09440000000022', carrier: 'chronopost', receivedAt: '2026-10-22T09:00:00Z', arriveLe: '2026-10-22T09:00:00Z' });
      tr('mondialrelay_30000023', { suivi: '30000023', limite: '2026-10-27' });
      base.set(`${A}|email_track_vinted_aa`, { status: 'delivered', suivi: '', subject: 'Ton colis a été retiré #30000023', receivedAt: '2026-10-26T10:00:00Z', carrier: 'vinted' });
      tr('mondialrelay_30000024', { suivi: '30000024', limite: '2026-10-27' });
      tr('mondialrelay_30000025', { suivi: '30000025', limite: '2026-10-27' });
      tr('vinted_bb', { suivi: '', subject: 'Ton colis est arrivé à la consigne #VGS12345678027', carrier: 'vinted', limite: '2026-10-27' });
    };
    const retraitDe = () => pushes.filter((p) => /^retrait-/.test(p.tag || ''));
    prepare(); await oublis();
    const r1 = await lancer();
    const p1 = retraitDe();
    const tags = p1.map((p) => p.tag).sort();
    dit(JSON.stringify(tags) === JSON.stringify(['retrait-a_verifier-09440000000022', 'retrait-dernier-30000021', 'retrait-dernier-VGS12345678027']),
      'cron : « dernier jour » (dont le n° lu dans le sujet) et « à vérifier » (garde Chronopost passée), jamais le colis retiré ailleurs, coché, ni fini pour l\'app', `HTTP ${r1.code} · ${tags.join(' · ')}`);
    const d = p1.find((p) => p.tag === 'retrait-dernier-30000021') || {};
    dit(/^📍 Dernier jour pour retirer /.test(d.title || '') && /30000021/.test(d.body || '') && /Bar Test/.test(`${d.title} ${d.body}`) && d.url === '/?tab=cat_achats', '« 📍 Dernier jour pour retirer <lieu> », le n° dans le texte, ouvre Achats', `${d.title} | ${d.body}`);
    const v = p1.find((p) => p.tag === 'retrait-a_verifier-09440000000022') || {};
    // (29 oct.) « sans doute reparti » ne s'écrit plus : un délai dépassé ne prouve
    // rien (mesuré le 29 : 5 « sans doute repartis » sur 5 avaient été RETIRÉS) —
    // seul le transporteur ou Vinted dit « reparti ». Jamais « perdu » non plus.
    dit(/^Colis à vérifier : n°09440000000022/.test(v.title || '') && !/perdu|sans doute reparti/i.test(`${v.title} ${v.body}`), '« Colis à vérifier : n°… », jamais « perdu » ni « sans doute reparti » (le délai ne prouve rien)', v.title);
    const lect = lus.filter((u) => /email_track_|colis_retrait_dedup|id=eq\.main/.test(u) && !/select=owner(&|$)/.test(u));
    dit(lect.length > 0 && lect.every((u) => /owner=eq\./.test(u)), 'cron : toutes les lectures du rappel portent owner=eq.<vendeur>', lect.filter((u) => !/owner=eq\./.test(u)).slice(0, 2).join(' | '));
    dit(!JSON.stringify((r1.corps && r1.corps.bilans) || r1.corps || {}).match(/30000021|Bar Test/), 'cron : la réponse ne contient ni n° ni lieu (des nombres)');
    // Une fois par colis et par état.
    pushes.length = 0;
    await lancer();
    dit(retraitDe().length === 0, 'relancé le même jour ⇒ rien (mémo `colis_retrait_dedup`)');
    // Mémo illisible ⇒ rien.
    prepare(); await oublis(); pannes.add('lire:id=eq.colis_retrait_dedup');
    await lancer();
    dit(retraitDe().length === 0 && !ecrits.some((e) => e.id === 'colis_retrait_dedup'), 'mémo illisible ⇒ rien envoyé, rien écrit');
    // Mémo non écrit ⇒ rien.
    prepare(); await oublis(); pannes.add('ecrire:colis_retrait_dedup');
    await lancer();
    dit(retraitDe().length === 0, 'mémo non écrit ⇒ rien envoyé (sinon il repartirait demain)');
    // Préférence « colis » coupée ⇒ rien.
    prepare(); await oublis(); base.set(`${A}|push_prefs`, { colis: false, suivi: true });
    await lancer();
    dit(retraitDe().length === 0, 'préférence « colis » coupée ⇒ rien');
    // Abonnement coupé ⇒ rien.
    prepare(); await oublis(); acces = false;
    await lancer();
    dit(retraitDe().length === 0, 'abonnement coupé ⇒ rien');
    // Lecture ratée (lignes de suivi, ou réglages) ⇒ rien.
    prepare(); await oublis(); pannes.add('lire:id=like.email_track_*&meta->>status=in.(available,delivered,retour,info)');
    await lancer();
    dit(retraitDe().length === 0, 'lignes de suivi illisibles ⇒ rien');
    prepare(); await oublis(); pannes.add('lire:vrm_colis_collected:data->vrm_colis_collected');
    await lancer();
    dit(retraitDe().length === 0, 'réglages (`main` : coches, colis finis) illisibles ⇒ rien — un colis coché ne doit jamais sonner');
  });

  // ══ 6. LE WIDGET ══════════════════════════════════════════════════════════
  await essaie('route api/widget', async () => {
    const w = (await importer('api/widget.js')).default;
    const T0 = Date.parse('2026-10-23T07:00:00Z');
    resetBase();
    base.set(`${A}|main`, { vrm_widget_token: '', vinted_pickup_done: {}, vinted_ship_done: {}, vinted_bords_shipped: {}, vinted_sales_hidden: [], vinted_bords_hidden: {}, vrm_colis_collected: [],
      vrm_colis_retirer: { total: 3, aVerifier: 0, urgents: 0, at: T0, colis: [['2099-01-01', T0, 'mondialrelay', 'e:30000031'], ['2099-01-01', T0, 'chronopost', 'e:XW000000032FR'], ['2099-01-01', T0, 'mondialrelay', 'e:30000033']], vus: ['30000031', 'XW000000032FR', '30000033'], vusTx: [] } });
    const tr = (cle, o) => base.set(`${A}|email_track_${cle}`, { status: 'available', subject: 'Votre colis est disponible', receivedAt: '2026-10-21T13:00:00Z', limite: '2099-01-01', ...o });
    tr('mondialrelay_30000031', { suivi: '30000031', carrier: 'mondialrelay' });
    base.set(`${A}|email_track_vinted_cc`, { status: 'delivered', suivi: '', subject: 'Ton colis a été retiré #30000031', receivedAt: '2026-10-24T09:00:00Z', carrier: 'vinted' });
    tr('chronopost_XW000000032FR', { suivi: 'XW000000032FR', carrier: 'chronopost' });
    base.set(`${A}|email_track_dpd_XW000000032FR`, { status: 'info', suivi: 'XW000000032FR', subject: 'Uw pakket is afgehaald door de ontvanger', receivedAt: '2026-10-24T09:00:00Z', carrier: 'dpd' });
    tr('mondialrelay_30000033', { suivi: '30000033', carrier: 'mondialrelay' });
    const vraiNow = Date.now; Date.now = () => Date.parse('2026-10-24T10:00:00Z');
    let c = {};
    try { const res = faireRes(); await w({ method: 'GET', headers: {}, query: {} }, res); c = res.corps || {}; } finally { Date.now = vraiNow; }
    dit(c.pickup === 1, 'widget : un « retiré » au n° du SUJET (autre clé) et un retiré NL (« info » relue) sortent du compte ; le colis toujours là reste', `pickup=${c.pickup} sortis=${c.pickupSortis}`);
  });

  // ══ 7. REVUE DU 23 OCTOBRE (n° 1, 2, 3, 4, 7) ══════════════════════════════
  // Chaque défaut a été REPRODUIT par un relecteur sur la vraie route ; chaque
  // contrôle ci-dessous est rouge sur 743585d (§6.1) et sous sa mutation.
  const chrono = (sujet, corps, n, extra = {}) => ({ from: 'noreply@chronopost.fr', to: 'boite@banc.test', subject: sujet, text: corps, html: '', attachments: [], messageId: `<ch-${n}@banc>`, ...extra });
  const vgo = (sujet, corps, n, extra = {}) => ({ from: 'noreply@vinted.fr', to: 'boite@banc.test', subject: sujet, text: corps, html: '', attachments: [], messageId: `<vg-${n}@banc>`, ...extra });
  const lignesTrack = () => [...base.entries()].filter(([k]) => /\|email_track_/.test(k)).map(([k, d]) => ({ id: k.split('|')[1], ...d }));
  await essaie('revue n° 1 — « Ton colis arrive aujourd\'hui ! #N » n\'est pas « à retirer »', async () => {
    resetBase(); await oublis();
    await recoit(vgo("Ton colis arrive aujourd'hui ! #1790000000000099", "Bonjour,\nBonne nouvelle : ton colis arrive aujourd'hui dans ta consigne Vinted Go.\nTu recevras ton code dès qu'il sera disponible.", 71));
    const l1 = lignesTrack().find((l) => /1790000000000099$/.test(l.id));
    dit(l1 && l1.status !== 'available' && l1.suivi === '1790000000000099' && !pushes.some((p) => /📍|point de retrait/.test(p.title || '')),
      'le n° du sujet reste une IDENTITÉ (rangé) mais ne prouve pas l\'arrivée : la ligne n\'est pas « disponible », rien ne sonne « 📍 »', l1 ? `status=${l1.status} · push=${JSON.stringify(pushes.map((p) => p.title))}` : 'aucune ligne');
    // L'annonce d'arrivée AVEC un lieu lu (le garde-fou du n° du sujet ne joue pas) : c'est la règle « arrive aujourd'hui » qui tranche.
    resetBase(); await oublis();
    await recoit(vgo("Ton colis arrive aujourd'hui ! #1790000000000098", "Bonjour,\nTon colis arrive aujourd'hui.\nPoint Relais\nBar Test\n5 Rue Exemple\n56000 Vannes", 72));
    const l2 = lignesTrack().find((l) => /1790000000000098$/.test(l.id));
    dit(l2 && l2.status === 'transit', '« arrive aujourd\'hui » (même avec un lieu) : l\'arrivée est ANNONCÉE ⇒ en route', l2 && `status=${l2.status}`);
    // Le n° du SEUL sujet, un corps qui dit « disponible » mais ni code, ni QR, ni lieu : pas une preuve d'arrivée.
    resetBase(); await oublis();
    await recoit(vgo('Rappel : ton colis #1790000000000097', 'Bonjour,\nTon colis est disponible.', 73));
    const l3 = lignesTrack().find((l) => /1790000000000097$/.test(l.id));
    dit(l3 && l3.status === 'info' && !pushes.some((p) => /📍/.test(p.title || '')), 'n° lu dans le seul SUJET, sans code, ni QR, ni lieu ⇒ « info » (comme avant que ce n° soit lu)', l3 && `status=${l3.status}`);
    // L'autre sens : le même n° du sujet AVEC un code ⇒ à retirer (la preuve est là).
    resetBase(); await oublis();
    await recoit(vgo('Libère de la place dans la consigne : récupère ton colis #1790000000000096', 'Bonjour,\nTon colis t\'attend.\nTon code de retrait est 482913', 74));
    const l4 = lignesTrack().find((l) => /1790000000000096$/.test(l.id));
    dit(l4 && l4.status === 'available', 'l\'autre sens : n° du sujet AVEC un code de retrait ⇒ disponible', l4 && `status=${l4.status}`);
  });

  await essaie('revue n° 2 — le cron, l\'app et le widget relisent la ligne de la MÊME façon', async () => {
    const cron = (await importer('api/ship-reminders.js')).default;
    const w = (await importer('api/widget.js')).default;
    const T = Date.parse('2026-10-27T08:00:00Z');
    resetBase(); await oublis();
    base.set(`${A}|main`, { vrm_colis_collected: [], vrm_widget_token: '', vinted_pickup_done: {}, vinted_ship_done: {}, vinted_bords_shipped: {}, vinted_sales_hidden: [], vinted_bords_hidden: {},
      vrm_colis_retirer: { total: 0, aVerifier: 0, urgents: 0, finis: [], at: T - 6 * 86400000, colis: [], vus: [], vusTx: [] } });
    // La forme MESURÉE des lignes Chronopost « Information sur votre colis » du 22-23 oct. (valeurs inventées).
    const ligne = { type: 'suivi', carrier: 'chronopost', suivi: 'XW000000101FR', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: 'Information sur votre colis XW000000101FR',
      receivedAt: '2026-10-22T09:58:23.030Z', code: null, code2: null, lieu: 'sera disponible dans les prochains jours dans votre Relais Pickup', limite: null, qrB64: null, qrUrl: null, consigne: false, account: '' };
    base.set(`${A}|email_track_chronopost_XW000000101FR`, ligne);
    const vraiNow = Date.now;
    let wc = {};
    try {
      Date.now = () => T;
      await cron({ method: 'GET', headers: { authorization: 'Bearer cle-banc-cron' }, query: {} }, faireRes());
      // Le widget le lendemain de l'e-mail (dans la garde Chronopost : un colis
      // vraiment arrivé y serait « à retirer ») — sinon le contrôle serait vacant.
      Date.now = () => Date.parse('2026-10-23T12:00:00Z');
      const res = faireRes(); await w({ method: 'GET', headers: {}, query: {} }, res); wc = res.corps || {};
    } finally { Date.now = vraiNow; }
    const retraitP = pushes.filter((p) => /^retrait-/.test(p.tag || ''));
    const etat = await importer('api/_lib/etat-colis-email.js'), retrait = await importer('api/_lib/retrait-colis.js'), cr = await importer('api/_lib/code-retrait-email.js');
    const app = chargeApp(['codeRetrait', 'reclassifyTrack'], { ...retrait, ...etat, ...cr, normaliserSuivi: etat.normaliserSuivi, relireLigneSuivi: S && S.relireLigneSuivi });
    const rc = app.reclassifyTrack ? app.reclassifyTrack({ ...ligne }) : null;
    dit(rc && rc.status === 'transit', 'app : « sera disponible dans les prochains jours », sans code ni QR ⇒ en transit', rc && rc.status);
    dit(retraitP.length === 0, 'cron : AUCUN « Colis à vérifier — sans doute reparti… va le chercher » sur ce colis en route (le même verdict que l\'app)', JSON.stringify(retraitP.map((p) => p.title)));
    dit(wc.pickup === 0, 'widget : ce colis arrivé APRÈS la photo de l\'app n\'est pas compté « à retirer » (le même verdict)', `pickup=${wc.pickup}`);
  });

  await essaie('revue n° 3 — « Dernier jour » : le cron lit lui-même la fin de l\'achat', async () => {
    const cron = (await importer('api/ship-reminders.js')).default;
    const T = Date.parse('2026-10-27T08:00:00Z');
    const lancer3 = async ({ pub, statut = 'Commande finalisée', lien = 'code', pannesLire = [] } = {}) => {
      resetBase(); await oublis();
      base.set(`${A}|main`, { vrm_colis_collected: [], ...(pub ? { vrm_colis_retirer: pub } : {}) });
      base.set(`${A}|email_track_mondialrelay_30000088`, { type: 'suivi', carrier: 'mondialrelay', suivi: '30000088', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: 'Votre colis 30000088 est disponible 📦', receivedAt: '2026-10-22T08:00:00Z', arriveLe: '2026-10-22T08:00:00Z', code: '482913', lieu: 'Bar Test, 5 Rue Exemple, 56000 Vannes', limite: '2026-10-27' });
      base.set(`${A}|panel_colis_relais`, lien === 'code' ? { '9900000001': { code: '482913', lieu: 'Bar Test', at: '2026-10-22T09:00:00Z' } } : {});
      if (lien === 'suivi') base.set(`${A}|harvest_111_suivi_9900000001`, { v: 1, tx: '9900000001', suivi: '30000088', source: 'journey', capturedAt: '2026-10-25T08:00:00Z', etapes: [], dernier: null });
      base.set(`${A}|harvest_111_orders_purchased`, { payload: { my_orders: [{ transaction_id: 9900000001, title: 'Nike', status: statut }] }, capturedAt: '2026-10-25T08:00:00Z' });
      for (const p of pannesLire) pannes.add('lire:' + p);
      const vraiNow = Date.now; Date.now = () => T;
      try { await cron({ method: 'GET', headers: { authorization: 'Bearer cle-banc-cron' }, query: {} }, faireRes()); } finally { Date.now = vraiNow; }
      return pushes.filter((p) => /^retrait-/.test(p.tag || '')).map((p) => p.title);
    };
    const a = await lancer3({ pub: null });
    dit(a.length === 0, 'publication de l\'app ABSENTE, commande reliée par le CODE de retrait FINALISÉE ⇒ rien ne sonne', JSON.stringify(a));
    const b = await lancer3({ pub: { finis: [], at: T - 4 * 86400000, total: 1 } });
    dit(b.length === 0, 'publication vieille de 4 jours sans ce colis dans `finis` ⇒ rien (la commande dit finalisée)', JSON.stringify(b));
    const c = await lancer3({ pub: null, lien: 'suivi' });
    dit(c.length === 0, 'commande reliée par le N° DE SUIVI (ligne de suivi Vinted) finalisée ⇒ rien', JSON.stringify(c));
    const d = await lancer3({ pub: null, statut: 'Colis déposé en point relais' });
    dit(d.length === 1 && /Dernier jour/.test(d[0]), 'l\'autre sens : la commande reliée dit encore « au point relais » ⇒ « 📍 Dernier jour » part', JSON.stringify(d));
    const e = await lancer3({ pub: null, pannesLire: ['id=eq.panel_colis_relais'] });
    dit(e.length === 0, 'les codes lus dans les conversations illisibles ⇒ « pas su » ⇒ rien (jamais « pas fini »)', JSON.stringify(e));
    const f = await lancer3({ pub: null, pannesLire: ['orders_purchased'] });
    dit(f.length === 0, 'les commandes illisibles alors qu\'un colis est relié ⇒ rien', JSON.stringify(f));
  });

  await essaie('revue n° 4 — l\'ordre se juge sur la date de l\'e-mail, pas sur l\'heure du traitement', async () => {
    resetBase(); await oublis();
    const RealDate = Date; let t = RealDate.parse('2026-10-28T09:00:00Z');
    global.Date = class extends RealDate { constructor(...a) { if (!a.length) super(t); else super(...a); } static now() { return t; } };
    try {
      await recoit({ from: 'shipping@relay.vinted.com', to: 'boite@banc.test', subject: "Ton colis 30000077 a été retourné à l'expéditeur", text: "Bonjour,\nTon colis 30000077 n'a pas été retiré à temps : il a été retourné à l'expéditeur.", html: '', attachments: [], messageId: '<r-77@banc>', sourceDate: '2026-10-27T08:00:00Z' });
      t += 5000;
      await recoit({ from: 'noreply@mondialrelay.fr', to: 'boite@banc.test', subject: 'Votre colis 30000077 est disponible 📦', text: "Bonjour,\nVotre colis 30000077 est disponible dans votre Point Relais.\nVotre code de retrait est 482913\nPoint Relais\nBar Test\n5 Rue Exemple\n56000 Vannes\nRETRAIT JUSQU'AU 30/10", html: '', attachments: [], messageId: '<d-77@banc>', sourceDate: '2026-10-20T08:00:00Z' });
    } finally { global.Date = RealDate; }
    const ls = lignesTrack();
    const dispo = ls.find((l) => l.status === 'available');
    const AR = await importer('api/_lib/arrivee-colis.js');
    const ar = dispo ? AR.arriveeColisEmail(dispo) : null;
    const sorti = dispo ? S.sortiParSuivi(dispo, S.finsDesLignes(ls), ar ? ar.ms : null) : null;
    dit(sorti === 'reparti', 'un « reparti » TRAITÉ avant l\'e-mail d\'arrivée (rejeu du plus récent au plus ancien), mais ÉCRIT après elle ⇒ le colis est reparti', `arriveLe=${dispo && dispo.arriveLe} · sortiParSuivi=${sorti}`);
    dit(!pushes.some((p) => /📍/.test(p.title || '')), 'et l\'arrivée traitée APRÈS ce retour ne sonne pas « 📍 »', JSON.stringify(pushes.map((p) => p.title)));
    // Un retour ÉCRIT avant l'arrivée (un autre passage) mais traité après elle ne la fait pas sortir.
    const fins = S.finsDesLignes([{ status: 'retour', suivi: '30000078', receivedAt: '2026-10-28T09:00:00Z', emailAt: '2026-10-18T08:00:00Z' }]);
    dit(S.sortiParSuivis(['30000078'], fins, Date.parse('2026-10-22T08:00:00Z')) === null, 'un retour ÉCRIT avant l\'arrivée mais traité après elle ne compte pas (sa date d\'e-mail fait foi)');
  });

  await essaie('revue n° 7 — le « retiré » d\'un colis qu\'il a VENDU ne sonne pas « Colis livré » (Achats)', async () => {
    resetBase(); await oublis();
    base.set(`${A}|email_bord_99000123`, { type: 'bordereau', transaction: '99000123', suivi: 'XW123456789FR', receivedAt: '2026-10-20T08:00:00Z' });
    await recoit(chrono('Confirmation du dépôt de votre colis', 'Bonjour,\nVotre colis XW123456789FR a bien été déposé.', 81));
    await recoit(chrono('Votre colis a été retiré', 'Bonjour,\nVotre colis XW123456789FR a été retiré.', 82));
    const livr = pushes.filter((p) => /livré|retiré/i.test(p.title || ''));
    dit(!livr.some((p) => /\/\?tab=cat_achats/.test(p.url || '') || /^✅ Colis livré$/.test(p.title || '')), 'n° d\'un de SES bordereaux : pas de « ✅ Colis livré » qui ouvre Achats', JSON.stringify(pushes.map((p) => [p.title, p.tag, p.url])));
    dit(pushes.length <= 1, 'pas de son en plus pour sa vente (la clé d\'avant)', JSON.stringify(pushes.map((p) => p.tag)));
    const l = lignesTrack().find((x) => /XW123456789FR$/.test(x.id));
    dit(l && l.sens === 'sortant', 'le sens « sortant » est RANGÉ sur la ligne (il ne l\'était jamais : 0 ligne sur 229)', l && `sens=${l.sens}`);
    // Sans transit avant : s'il sonne, il dit ce que c'est.
    resetBase(); await oublis();
    base.set(`${A}|email_bord_99000124`, { type: 'bordereau', transaction: '99000124', suivi: 'XW123456780FR', receivedAt: '2026-10-20T08:00:00Z' });
    await recoit(chrono('Votre colis a été retiré', 'Bonjour,\nVotre colis XW123456780FR a été retiré.', 83));
    dit(pushes.every((p) => /vente/i.test(p.title || '') && /cat_ventes/.test(p.url || '')), 's\'il sonne, c\'est « Ta vente : colis retiré par l\'acheteur », vers Ventes', JSON.stringify(pushes.map((p) => [p.title, p.url])));
    // L'autre sens : un ACHAT (aucun bordereau) retiré sonne toujours, une fois.
    resetBase(); await oublis();
    await recoit(chrono('Votre colis a été retiré', 'Bonjour,\nVotre colis XW123456781FR a été retiré.', 84));
    dit(pushes.length === 1 && /✅/.test(pushes[0].title) && /cat_achats/.test(pushes[0].url || ''), 'l\'autre sens : un achat retiré sonne « ✅ », vers Achats', JSON.stringify(pushes.map((p) => [p.title, p.url])));
  });

  // (revue du 24 oct., n° 10) « 3 par visite » à l'écran : le chiffre de
  // l'EXTENSION (`SUIVI_MAX_PAR_VISITE`, background.js), jamais un second.
  // Une extension qui n'a pas encore `capterSuivisAchats` (ce chantier-ci avant
  // sa fusion avec le chantier extension) n'a rien à comparer : c'est
  // audit-coherence qui est rouge alors (la capacité cite une fonction absente).
  await essaie('revue n° 10 — le rythme dit par l\'app est celui de l\'extension', async () => {
    const APP = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
    let EXT = ''; try { EXT = fs.readFileSync(process.env.AUDIT_EXT_BG || path.join(R, 'vinted-sync-extension', 'background.js'), 'utf8'); } catch (_) { EXT = ''; }
    const a = (/const SUIVI_PAR_VISITE = (\d+);/.exec(APP) || [])[1];
    dit(!!a, 'l\'app porte son rythme (`SUIVI_PAR_VISITE`)', a);
    if (!/function capterSuivisAchats\b/.test(EXT)) { console.log('⚠️ background.js n\'a pas encore `capterSuivisAchats` : rythme comparé à la fusion avec le chantier extension'); return; }
    const e = (/const SUIVI_MAX_PAR_VISITE = (\d+);/.exec(EXT) || [])[1];
    dit(a && e && a === e, `l'app dit « ${a} par visite », l'extension en lit ${e} (SUIVI_MAX_PAR_VISITE)`);
  });

  console.log(ko ? `\n❌ suivi des colis : ${ko} rouge(s)` : '\n✅ suivi des colis : tout est vert');
  process.exit(ko ? 1 : 0);
})();
