#!/usr/bin/env node
// AUDIT (10 nov.) — COLIS À RÉCEPTIONNER IRRÉPROCHABLES (docs/passation/2026-11-10-retraits-irreprochables.md)
// Julien : « il faut vraiment quelque chose de parfait, d'irréprochable, il doit y avoir aucune erreur,
// impossible que ce soit sur les messages, les mails et la lecture sur Vinted directement ».
// Mesuré sur sa base (lecture seule) puis reproduit ici sur des formes INVENTÉES de la vraie forme :
//   A. un « retiré » rangé par une règle d'avant (« Votre colis a changé de plan », « le colis semble
//      avoir été perdu ») ne retient plus l'état du colis (`retraitTenu`, `conserverRetrait`) ;
//   B. la VRAIE route (api/email-inbound.js, fausse base à état) : l'e-mail « disponible » au nouveau
//      point, reçu après un « changé de plan » rangé « livré », est rangé À RETIRER avec son code (avant :
//      absorbé par « un retiré reste retiré », relu « en route » — le colis arrivé n'était nulle part) ;
//   C. la relecture d'une ligne « perdu » rangée « livré » (`relireLigneSuivi`) ;
//   D. un colis redirigé est RELU chez le transporteur (`sensDeLigne`, `suivisAInterroger`) — avant, sans
//      sens, il n'était plus jamais lu (mesuré : « en route » lu 36 h plus tôt) ;
//   E. le transporteur qui le dit arrivé sans nommer le point ne fait plus perdre le NOUVEAU point lu dans
//      l'e-mail de ce n° (`fusionTransporteur`) ; le code de l'e-mail reste ;
//   F. d'où vient le code (src/sourcesRetrait.js) : sûr à deux voix, désaccord dit (jamais choisi), un
//      code plus récent du même n° remplace l'ancien, le code de la conversation de SA commande compte ;
//   G. le branchement : les cartes de Colis → À retirer portent les sources, l'heure, « sûr », « 2 codes ».
// `--prouve` : réaffaiblit chaque correction, chacune doit rendre ROUGE. §6.1 : sur l'arbre d'avant
// (AUDIT_RACINE=<arbre>), il est rouge. Aucune donnée réelle : n°, codes et adresses inventés.
require(require('path').join(__dirname, '_horloge-notif.cjs'));
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

const MUTATIONS = {
  'faux-retrait-tenu': ['api/_lib/etat-colis-email.js', ' if(retraitTenu(precedent))return {...nouveau,status:\'delivered\'', ' if(precedent?.status===\'delivered\')return {...nouveau,status:\'delivered\''],
  'perdu-tenu': ['api/_lib/etat-colis-email.js', ' if(colisPerdu(sj))return false;\n', ''],
  'route-sujet-faux': ['api/email-inbound.js', 'const sujetGarde = (retraitTenu(prevLigne) || garde.conserve)', 'const sujetGarde = (prevLigne?.status === \'delivered\' || garde.conserve)'],
  'relecture-perdu': ['api/_lib/suivi-colis.js', "  if (d.status === 'delivered' && colisPerdu(d.subject || d.sujet || '')) return", "  if (false) return"],
  'redirige-sans-sens': ['api/_lib/transporteurs.js', "  if (!so && (t.relaisChange || changementDeRelais(suj))) return 'entrant';", ''],
  'nouveau-point-perdu': ['api/_lib/suivi-colis.js', 'const lieuF = lieuTransp(t) || (l.relaisChange && l.lieu ? l.lieu : null);', 'const lieuF = lieuTransp(t) || null;'],
  'desaccord-tranche': ['src/sourcesRetrait.js', '  if (distincts.length > 1) {', '  if (false) {'],
  'sur-une-voix': ['src/sourcesRetrait.js', 'sur: voix.size >= 2', 'sur: voix.size >= 1'],
  'remplace-ignore': ['src/sourcesRetrait.js', '  if (!remplace) for (const x of autresDates)', '  if (true) for (const x of autresDates)'],
  'message-ignore': ['src/App.jsx', 'r: o ? relaisDe(o) : null, tr, vs', 'r: null, tr, vs'],
  'carte-sans-sources': ['src/CarteRelais.jsx', "'data-rp-sources': marques.join(',')", "'data-rp-sources': ''"],
  'alerte-ignore-transporteur': ['src/relaisChange.js', '    if (arriveApres(n, at)) continue;', ''],
  'alerte-lecture-ancienne': ['src/relaisChange.js', 'return e != null && (ligneMs == null || e > ligneMs);', 'return true;'],
  'hors-ligne-email-seul': ['src/App.jsx', "const code = desaccord ? '' : (codeRetrait(vC.code) || codeRetrait(t.code));", "const code = codeRetrait(t.code);"],
};
if (process.argv.includes('--prouve')) {
  let ok = 0;
  for (const [nom, [f, de, vers]] of Object.entries(MUTATIONS)) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-retraits-'));
    for (const x of ['api', 'src', 'package.json']) fs.cpSync(path.join(R, x), path.join(t, x), { recursive: true });
    fs.symlinkSync(fs.realpathSync(path.join(R, 'node_modules')), path.join(t, 'node_modules'));
    const src = fs.readFileSync(path.join(t, f), 'utf8');
    if (!src.includes(de)) { console.log(`❌ mutation ${nom} : ancre introuvable dans ${f}`); fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(path.join(t, f), src.replace(de, vers));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌/gm) || []).length;
    const tombe = r.status !== 0 && rouges > 0;
    if (tombe) ok++;
    console.log(`${tombe ? '✅' : '❌'} mutation « ${nom} » ⇒ ${tombe ? rouges + ' rouge(s)' : 'VERTE (le contrôle ne la voit pas)'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  const n = Object.keys(MUTATIONS).length;
  console.log(ok === n ? `\n✅ ${ok}/${n} mutations attrapées` : `\n❌ ${n - ok} mutation(s) non attrapée(s)`);
  process.exit(ok === n ? 0 : 1);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String(e && e.message || e).slice(0, 200)); } };
const importer = (p) => import('file://' + path.join(R, p));
const J = (o) => JSON.stringify(o);

// ── Une fausse base À ÉTAT (PostgREST minimal) pour EXÉCUTER la route ─────────
const A = '11111111-2222-3333-4444-555555555555';
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VRM_OWNER_UID = A;
process.env.EMAIL_INBOUND_SECRET = 'cle-banc-retraits';
delete process.env.VAPID_PRIVATE_KEY; delete process.env.AI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
const base = new Map();
const rep = (c, s = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
const chemin = (obj, ch) => { let v = obj; for (const seg of ch.split(/->>|->/)) v = v == null ? undefined : v[seg]; return v; };
const vraiFetch = global.fetch;
const fauxFetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
  if (u.pathname !== '/rest/v1/app_data') return rep([]);
  if (m === 'POST') {
    const prefer = String((opts.headers && (opts.headers.Prefer || opts.headers.prefer)) || '');
    const faites = [];
    for (const r of JSON.parse(opts.body || '[]')) { const cle = `${r.owner || A}|${r.id}`; if (/ignore-duplicates/.test(prefer) && base.has(cle)) continue; base.set(cle, r.data); faites.push({ id: r.id }); }
    return /return=representation/.test(prefer) ? rep(faites, 201) : new Response('', { status: 201 });
  }
  if (m === 'PATCH') {
    const id = (u.searchParams.get('id') || '').replace(/^eq\./, ''); const own = (u.searchParams.get('owner') || '').replace(/^eq\./, '') || A;
    const cle = `${own}|${id}`; if (!base.has(cle)) return rep([]);
    base.set(cle, JSON.parse(opts.body || '{}').data); return rep([{ id }]);
  }
  if (m !== 'GET') return rep([]);
  const sel = u.searchParams.get('select') || '';
  if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);
  const idp = u.searchParams.get('id') || '';
  const own = (u.searchParams.get('owner') || '').replace(/^eq\./, '') || null;
  const exact = idp.startsWith('eq.') ? idp.slice(3) : null;
  const like = idp.startsWith('like.') ? new RegExp('^' + idp.slice(5).replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$') : null;
  const filtresMeta = [...u.searchParams.entries()].filter(([k]) => /^meta->>/.test(k)).map(([k, v]) => [k.slice(7), v.replace(/^eq\./, '')]);
  const lignes = [...base.entries()].map(([k, d]) => { const i = k.indexOf('|'); return { owner: k.slice(0, i), id: k.slice(i + 1), data: d }; })
    .filter((l) => (!own || l.owner === own) && (exact ? l.id === exact : like ? like.test(l.id) : true))
    .filter((l) => filtresMeta.every(([k, v]) => String(l.data && l.data[k]) === v));
  if (sel && sel !== 'data' && sel !== 'id,data' && sel !== 'owner,data') {
    return rep(lignes.map((l) => { const o = {}; for (const part of sel.split(',')) { const [alias, ch] = part.includes(':') ? part.split(':') : [part.split(/->>|->/).pop(), part];
      if (ch === 'id' || ch === 'owner') { o[alias] = l[ch]; continue; }
      if (/^meta->>/.test(ch)) { const v = l.data ? l.data[ch.slice(7)] : undefined; o[alias] = v == null ? null : (typeof v === 'object' ? null : String(v)); continue; }
      const v = chemin(l.data, ch.replace(/^data(->>|->)/, '')); o[alias] = v === undefined ? null : v; } return o; }));
  }
  return rep(lignes);
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.send = () => r; r.end = () => r; return r; };

// Les formes RÉELLES (mesurées le 10 nov.), aux valeurs inventées.
const NOUVEAU_POINT = 'INTERMARCHE EXEMPLE, LE PORTAIL, 35350 ST MELOIR DES ONDES';
const SUJET_PLAN = 'Votre colis a changé de plan 📍';
const ligneFausseLivree = (suivi, o) => ({ type: 'suivi', carrier: 'mondialrelay', suivi, status: 'delivered', statusLabel: 'Livré / retiré', subject: SUJET_PLAN, code: '700001', lieu: NOUVEAU_POINT, limite: '2026-11-15', account: 'compte_a', emailAt: '2026-11-10T10:01:30.000Z', receivedAt: '2026-11-10T10:02:36.000Z', retireLe: '2026-11-09T23:55:34.000Z', consigne: false, ...o });

(async () => {
  console.log('§A un faux « retiré » ne retient plus le colis (api/_lib/etat-colis-email.js)');
  await essaie('A', async () => {
    const m = await importer('api/_lib/etat-colis-email.js');
    const dispo = { status: 'available', label: 'Arrivé au point de retrait' };
    const r1 = m.conserverRetrait(ligneFausseLivree('87650001'), dispo, true);
    dit(r1.status === 'available', '« changé de plan » rangé « livré », puis « disponible » au nouveau point ⇒ À RETIRER (jamais absorbé en « livré »)', r1.status);
    const r1b = m.conserverRetrait(ligneFausseLivree('87650001'), { status: 'transit', label: 'Point relais changé' }, true);
    dit(r1b.status === 'transit', 'un second « changé de plan » après le faux « livré » reste EN ROUTE', r1b.status);
    const vrai = { ...ligneFausseLivree('87650002'), subject: 'Votre colis 87650002 a été retiré' };
    dit(m.conserverRetrait(vrai, dispo, false).status === 'delivered', 'un VRAI retrait reste retiré (un rappel « disponible » plus ancien ne le ressuscite pas)');
    const perdu = { ...ligneFausseLivree('87650003'), subject: 'Action requise : le colis semble avoir été perdu — Baskets test' };
    dit(m.conserverRetrait(perdu, dispo, true).status === 'available', '« le colis semble avoir été perdu » rangé « livré » ne retient rien');
    dit(typeof m.retraitTenu === 'function' && m.retraitTenu({ status: 'delivered' }) === true, 'un « retiré » sans sujet connu reste retiré (pas su ≠ faux)');
    // Le même garde-fou sert aux SMS (même fonction, `conserverRetrait`) : un SMS « disponible » après un faux « livré ».
    const sms = m.conserverRetrait(ligneFausseLivree('87650004'), { status: 'available', label: 'Arrivé au point de retrait (SMS)' }, false);
    dit(sms.status === 'available', 'un SMS « disponible » après un faux « livré » ⇒ à retirer');
  });

  console.log('§B la VRAIE route : l’e-mail « disponible » au nouveau point, après un « changé de plan » rangé « livré »');
  await essaie('B', async () => {
    global.fetch = fauxFetch;
    try {
      base.clear();
      base.set(`${A}|vrm_email_owners`, { adresses: { 'boite@banc.test': { owner: A } } });
      base.set(`${A}|email_track_mondialrelay_87650010`, ligneFausseLivree('87650010'));
      const inbound = await importer('api/email-inbound.js');
      const recoit = async (subject, text, quand, sourceDate) => { const res = faireRes(); await inbound.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-retraits' }, __recuLe: quand, body: { from: 'Mondial Relay <noreply@mondialrelay.fr>', to: 'boite@banc.test', subject, text, html: '', attachments: [], ...(sourceDate ? { sourceDate } : {}) } }, res); return res; };
      const corps = "Bonjour,\nVotre colis 87650010 est disponible.\n\nPOINT RELAIS®\nINTERMARCHE EXEMPLE\nLE PORTAIL\n35350 ST MELOIR DES ONDES\n\nRETRAIT JUSQU'AU 20/11\n\nVotre code de retrait : 700001\n";
      const r = await recoit('Votre colis 87650010 est disponible', corps, '2026-11-11T09:00:05.000Z', '2026-11-11T09:00:00.000Z');
      const l = base.get(`${A}|email_track_mondialrelay_87650010`) || {};
      dit(r.code === 200, 'la route répond 200 (rangé)', String(r.code));
      dit(l.status === 'available', 'rangé « disponible » (avant : « livré », un retiré qui n’en était pas un)', l.status);
      dit(!/chang/i.test(l.subject || '') && /disponible/i.test(l.subject || ''), 'le sujet rangé est celui de l’e-mail d’arrivée (la relecture ne le redescend plus en route)', l.subject);
      dit(!l.retireLe, 'aucune date de retrait', String(l.retireLe));
      dit(l.code === '700001' && /35350/.test(l.lieu || ''), 'son code et son point (lus)', `${l.code} · ${l.lieu}`);
      const { relireLigneSuivi } = await importer('api/_lib/suivi-colis.js');
      const rl = relireLigneSuivi(l);
      dit(rl.status === 'available' && !rl.relaisChange, 'relu À RETIRER par l’app, le widget et le rappel du matin', `${rl.status} · ${rl.statusLabel}`);
      // Un second « changé de plan » (en route) après le faux « livré » : rangé en route.
      base.set(`${A}|email_track_mondialrelay_87650011`, ligneFausseLivree('87650011'));
      const plan = "Bonjour,\nVotre colis a changé de plan !\nPas d’inquiétude : votre colis n° 87650011 sera livré dans le Point Relais® suivant :\n\nVotre nouveau Point Relais®\nINTERMARCHE EXEMPLE\nLE PORTAIL\n35350 ST MELOIR DES ONDES\n";
      await recoit(SUJET_PLAN, plan, '2026-11-11T08:00:05.000Z', '2026-11-11T08:00:00.000Z');
      const l2 = base.get(`${A}|email_track_mondialrelay_87650011`) || {};
      dit(l2.status === 'transit', 'un nouveau « changé de plan » après le faux « livré » est rangé EN ROUTE', l2.status);
    } finally { global.fetch = vraiFetch; }
  });

  console.log('§C la relecture d’une ligne « perdu » rangée « livré »');
  await essaie('C', async () => {
    const { relireLigneSuivi } = await importer('api/_lib/suivi-colis.js');
    const d = relireLigneSuivi({ type: 'suivi', carrier: 'autre', suivi: '', status: 'delivered', statusLabel: 'Livré / retiré', subject: 'Action requise : le colis semble avoir été perdu — Baskets test', retireLe: '2026-11-02T23:01:34.000Z', account: 'compte_a' });
    dit(d.status !== 'delivered' && !d.retireLe, 'un colis « perdu » n’est ni livré ni retiré (plus de « ✅ livré » ni de date de retrait)', J({ s: d.status, l: d.statusLabel }));
    const v = relireLigneSuivi({ carrier: 'mondialrelay', suivi: '87650020', status: 'delivered', subject: 'Votre colis 87650020 a été retiré' });
    dit(v.status === 'delivered', 'un vrai retrait relu reste retiré', v.status);
  });

  console.log('§D un colis redirigé est RELU chez le transporteur (api/_lib/transporteurs.js)');
  await essaie('D', async () => {
    const T = await importer('api/_lib/transporteurs.js');
    const { relireLigneSuivi } = await importer('api/_lib/suivi-colis.js');
    const maintenant = Date.parse('2026-11-10T12:00:00.000Z');
    const ligne = relireLigneSuivi(ligneFausseLivree('87650030'));
    dit(T.sensDeLigne(ligne, new Set()) === 'entrant', '« changé de plan » : un colis qu’il REÇOIT (sens entrant)', String(T.sensDeLigne(ligne, new Set())));
    dit(T.sensDeLigne(ligne, new Set(['87650030'])) === 'sortant', '…sauf le n° d’un de SES bordereaux (son envoi)');
    const tr = { suivi: '87650030', carrier: 'mondialrelay', etat: 'en_route', etatAt: '2026-11-09T03:04:00.000Z', lu: '2026-11-08T22:00:00.000Z', essai: '2026-11-08T22:00:00.000Z', essaiRes: 'ok', cp: '35260', fini: false };
    const sel = T.suivisAInterroger({ lignes: [ligne], transp: new Map([['87650030', tr]]), manuels: [], vinted: [], envoyes: [], maintenant, max: 5, parTransporteur: 5 });
    dit(sel.some((x) => x.suivi === '87650030' && x.raison === 'actif'), 'relu chez Mondial Relay (« en route » lu il y a 14 h)', J(sel));
    const selE = T.suivisAInterroger({ lignes: [ligne], transp: new Map([['87650030', tr]]), manuels: [], vinted: [], envoyes: ['87650030'], maintenant, max: 5, parTransporteur: 5 });
    dit(!selE.length, 'jamais le n° d’un de ses envois', J(selE));
  });

  console.log('§E arrivé au nouveau point : le point LU dans l’e-mail du même n° reste (api/_lib/suivi-colis.js)');
  await essaie('E', async () => {
    const S = await importer('api/_lib/suivi-colis.js');
    const l = S.relireLigneSuivi(ligneFausseLivree('87650040'));
    const tr = { suivi: '87650040', carrier: 'mondialrelay', etat: 'disponible', etatAt: '2026-11-11T09:00:00.000Z', lu: '2026-11-11T09:10:00.000Z', lieuNom: '', lieuCp: '', limite: null, limiteSure: false };
    const f = S.fusionTransporteur(l, tr, Date.parse('2026-11-11T09:20:00.000Z'));
    dit(f.status === 'available', 'le transporteur le dit disponible ⇒ à retirer', f.status);
    dit(/INTERMARCHE EXEMPLE/.test(f.lieu || '') && /35350/.test(f.lieu || ''), 'le NOUVEAU point (lu dans l’e-mail de ce n°) reste — jamais « point pas encore connu »', String(f.lieu));
    dit(f.code === '700001', 'le code lu dans l’e-mail du même n° reste', String(f.code));
    dit(!f.relaisChange, 'plus d’alerte « point changé » (il est arrivé)');
    const sansPlan = S.fusionTransporteur({ suivi: '87650041', carrier: 'mondialrelay', status: 'transit', subject: 'Votre colis est en route', lieu: 'ANCIEN POINT, 35000 RENNES', receivedAt: '2026-11-10T09:00:00.000Z' }, { ...tr, suivi: '87650041' }, Date.parse('2026-11-11T09:20:00.000Z'));
    dit(!sansPlan.lieu, 'un e-mail « en route » ordinaire ne donne pas son lieu au colis arrivé (jamais deviné)', String(sansPlan.lieu));
  });

  console.log('§F d’où vient le code (src/sourcesRetrait.js)');
  await essaie('F', async () => {
    const m = await importer('src/sourcesRetrait.js');
    const v1 = m.verdictCode({ lignes: [{ source: 'email', emetteur: 'mondialrelay', code: '700001', at: 1 }], message: '700001' });
    dit(v1.code === '700001' && v1.sur === true && !v1.desaccord && J(v1.sources) === J(['email', 'message']), 'e-mail + message au même code ⇒ « sûr »', J(v1));
    const v2 = m.verdictCode({ lignes: [{ source: 'email', emetteur: 'mondialrelay', code: '700001', at: 1 }], message: 'B12345' });
    dit(!v2.code && Array.isArray(v2.desaccord) && v2.desaccord.length === 2 && v2.desaccord.some((d) => d.source === 'email' && d.code === '700001') && v2.desaccord.some((d) => d.source === 'message' && d.code === 'B12345'), 'e-mail et message en désaccord ⇒ AUCUN code choisi, les deux valeurs et leurs sources', J(v2));
    const v3 = m.verdictCode({ lignes: [{ source: 'email', emetteur: 'mondialrelay', code: '111111', at: 1000 }, { source: 'email', emetteur: 'mondialrelay', code: '222222', at: 2000 }] });
    dit(v3.code === '222222' && !v3.desaccord && v3.remplace && v3.remplace.code === '111111', 'deux e-mails DATÉS du même n° : le plus récent fait foi, l’ancien est dit « remplacé » (pas un désaccord)', J(v3));
    const v3b = m.verdictCode({ lignes: [{ source: 'email', emetteur: 'mondialrelay', code: '111111', at: null }, { source: 'sms', emetteur: 'mondialrelay', code: '222222', at: null }] });
    dit(!v3b.code && v3b.desaccord, 'deux codes SANS date : on ne sait pas lequel est le bon ⇒ désaccord dit', J(v3b));
    const v4 = m.verdictCode({ lignes: [{ source: 'email', emetteur: 'mondialrelay', code: '700001', at: 1 }, { source: 'email', emetteur: 'mondialrelay', code: '700001', at: 2 }] });
    dit(v4.code === '700001' && v4.sur === false, 'un rappel du même transporteur qui redit le code : UNE voix (pas « sûr »)', J(v4));
    const v5 = m.verdictCode({ lignes: [{ source: 'email', emetteur: 'mondialrelay', code: '700001', at: 1 }, { source: 'sms', emetteur: 'mondialrelay', code: '700001', at: 2 }] });
    dit(v5.sur === true, 'e-mail + SMS au même code ⇒ « sûr »', J(v5));
    // Les formes réelles : la consigne Vinted Go (`email_track_vinted_…`, carrier « vinted ») et la moitié Vinted
    // (`email_track_autre_conv-…`, source « vinted-commande »), fondues par leur code (`fusionnerParCode`).
    const consigne = { suivi: '1790000000000061', carrier: 'vinted', code: 'B12345', emailAt: '2026-11-06T10:00:00.000Z' };
    const moitie = { suivi: '', carrier: 'autre', source: 'vinted-commande', code: 'B12345', emailAt: '2026-11-06T10:05:00.000Z' };
    const v6 = m.verdictCode({ lignes: m.codesDesLignes({ ...consigne, codesLus: [m.codeLuDeLigne(consigne), m.codeLuDeLigne(moitie)] }) });
    dit(v6.sur === true, 'l’e-mail de Vinted et celui de la consigne au même code ⇒ « sûr »', J(v6));
    const v7 = m.verdictCode({ lignes: [], message: 'b 12345' });
    dit(v7.code === 'B12345' && v7.sur === false, 'seul le message porte le code ⇒ montré (avant : « code pas lu »), pas « sûr »', J(v7));
    const s = m.sourcesDuColis({ t: { suivi: '87650050', carrier: 'mondialrelay', code: '700001', emailAt: '2026-11-10T09:00:00.000Z', receivedAt: '2026-11-10T09:00:30.000Z' }, o: { transaction_id: 1 }, r: { code: '700001', lieu: 'X', at: '2026-11-10T09:30:00.000Z' }, tr: { lu: '2026-11-10T11:00:00.000Z', etat: 'disponible' }, capMs: Date.parse('2026-11-10T08:00:00.000Z'), codeValide: (c) => String(c || '') });
    dit(J(s.marques) === J(['vinted', 'email', 'message', 'transporteur']) && s.code.sur && s.verifieMs === Date.parse('2026-11-10T11:00:00.000Z'), 'les marques (Vinted · e-mail · message · transporteur) et la DERNIÈRE vérification (la lecture chez le transporteur)', J({ m: s.marques, v: s.verifieMs }));
    const sms = m.sourcesDuColis({ t: { suivi: '87650051', source: 'sms', carrier: 'mondialrelay', code: '700002', receivedAt: '2026-11-10T09:00:00.000Z' } });
    dit(J(sms.marques) === J(['sms']), 'un SMS se dit SMS', J(sms.marques));
    const rien = m.sourcesDuColis({});
    dit(rien.verifieMs === null && !rien.marques.length, 'rien de daté ⇒ pas d’heure (« — »), jamais une heure inventée', J(rien));
  });

  console.log('§H un colis redirigé ARRIVÉ n’est plus annoncé « pas encore arrivé » (src/relaisChange.js)');
  await essaie('H', async () => {
    const m = await importer('src/relaisChange.js');
    const ligne = { suivi: '87650060', carrier: 'mondialrelay', status: 'transit', relaisChange: true, lieu: 'INTERMARCHE EXEMPLE, 35350 ST MELOIR DES ONDES', emailAt: '2026-11-10T10:00:00.000Z', receivedAt: '2026-11-10T10:00:30.000Z' };
    const maintenant = Date.parse('2026-11-11T12:00:00.000Z');
    const dispo = new Map([['87650060', { etat: 'disponible', etatAt: '2026-11-11T09:00:00.000Z' }]]);
    dit(m.colisRelaisChange([ligne], { maintenant, transp: dispo }).length === 0, 'le transporteur le dit disponible APRÈS l’e-mail ⇒ plus d’alerte « en route »');
    const avant = new Map([['87650060', { etat: 'disponible', etatAt: '2026-11-09T09:00:00.000Z' }]]);
    dit(m.colisRelaisChange([ligne], { maintenant, transp: avant }).length === 1, 'une lecture « disponible » d’AVANT le changement (l’ancien point) ne fait pas taire l’alerte');
    dit(m.colisRelaisChange([ligne], { maintenant }).length === 1, 'sans lecture du transporteur : l’alerte reste');
  });

  console.log('§G le branchement (Colis → À retirer)');
  await essaie('G', async () => {
    const sansCom = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const app = sansCom(fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8'));
    dit((app.match(/\.\.\.champsSources\(sc[EVX]\)/g) || []).length === 3, 'les trois sortes de cartes (e-mail, vu par Vinted, à vérifier) portent leurs sources');
    dit(/r: o \? relaisDe\(o\) : null, tr, vs/.test(app), 'le code de la conversation de SA commande (identité) est une source');
    dit(/const codesLus = \[/.test(app) && /codesLus,\s*\n?\s*code: src\.code/.test(app), 'deux e-mails du même n° gardent chacun ce qu’ils disaient du code (fusion)');
    const carte = sansCom(fs.readFileSync(path.join(R, 'src/CarteRelais.jsx'), 'utf8'));
    dit(/'data-rp-sources': marques\.join\(','\)/.test(carte) && /data-rp-verifie-texte/.test(carte), 'la ligne dit ses sources et l’heure de la dernière vérification');
    dit(/data-rp-code-desaccord/.test(carte) && /data-rp-desaccord-valeur=\{d\.code\}/.test(carte) && /is-ambre/.test(carte), 'deux codes ⇒ bouton ambre « 2 codes » et les deux valeurs dans le détail');
    dit(/'data-rp-code-sur': x\.code && x\.codeSur/.test(carte), 'un code sûr est marqué');
    dit(/x\.code \|\| x\.qr \|\| x\.code2 \|\| \(Array\.isArray\(x\.codesDesaccord\)/.test(carte), 'deux codes en désaccord : rangé avec les colis prêts (jamais « code à venir »)');
    const relais = sansCom(fs.readFileSync(path.join(R, 'src/ModeRelais.jsx'), 'utf8'));
    dit(/data-relais-desaccord/.test(relais) && /desaccord: x\.codesDesaccord \|\| null/.test(app) && /desaccord: x\.desaccord \|\| null/.test(app), 'le mode relais (en ligne et hors ligne) montre les deux codes, jamais un seul');
    dit(/verdictCode\(\{ lignes: codesDesLignes\(t, codeRetrait\), message: rV \? codeRetrait\(rV\.code\) : '' \}\)/.test(app) && /const code = desaccord \? '' : \(codeRetrait\(vC\.code\) \|\| codeRetrait\(t\.code\)\)/.test(app), 'les codes gardés hors ligne suivent le même verdict que la carte (désaccord ⇒ aucun code seul)');
    dit(/<AlerteRelaisChange lignes=\{tracking\} C=\{C\} transp=\{transpMap\}\/>/.test(app), 'l’alerte « point changé » lit aussi le transporteur');
  });

  console.log(`\n${ok} vérifications, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
