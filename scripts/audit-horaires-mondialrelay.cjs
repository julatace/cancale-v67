require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
// scripts/audit-horaires-mondialrelay.cjs
// ─────────────────────────────────────────────────────────────────────────────
// (13 nov., lot 11 — point 11 de Julien) LES HORAIRES DES POINTS MONDIAL RELAY.
// L'e-mail Mondial Relay n'écrit pas les horaires (un lien de suivi opaque). La réponse
// de suivi que le SERVEUR lit déjà pour CE colis (`_mvc/…/RechercherJsonResponsive`,
// n° + code postal, écho contrôlé) porte, mesuré le 24 oct., le n° du point
// (`numeroTemp`, `codePaysTemp`) et son tableau d'horaires (`PCL_Details › detail-mag`).
// Aucune requête de plus ; jamais l'extension (décision de Julien) ; 7 jours au plus.
//
// Ce que l'audit EXÉCUTE (données INVENTÉES à la forme mesurée — aucun vrai n°, aucun
// vrai point) :
//   1. la règle pure `pointEtHorairesMr` (formes lues, formes qui ne doivent RIEN donner) ;
//   2. l'analyseur `lireReponseMondialRelayMvc` : horaires seulement « disponible » ;
//   3. `ligneApresEssai` : rangés par le SERVEUR seul, gardés 7 j du même point, effacés sinon ;
//   4. la lecture projetée (`SELECT_TRANSP_META`, `ligneTranspDeMeta`) ;
//   5. `fusionTransporteur` : posés sur la ligne « à retirer » seulement si le code postal
//      confirmé par Mondial Relay est celui du point affiché ; l'e-mail qui en a gagne ;
//   6. la VRAIE route api/relais.js (C5 puis C4) sur une fausse base à état et un faux
//      mondialrelay.fr : la ligne `transp_` porte les horaires, une seule requête par colis,
//      la réponse relayée par l'extension n'en pose jamais.
// `--prouve` : réaffaiblit la règle, chaque mutation doit rendre ROUGE.
// §6.1 : lancé depuis un arbre d'avant (AUDIT_RACINE), il est rouge.
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

const MUTATIONS = {
  'deux-points-acceptes': ['api/_lib/horaires-relais.js', "const pointId = ids.length === 1 && pays.length === 1 && pays[0] === 'FR' ? ids[0] : '';", "const pointId = ids.length >= 1 ? ids[0] : '';"],
  'tableaux-differents-acceptes': ['api/_lib/horaires-relais.js', 'const memes = !!k && lus.every((x) => x.h && JSON.stringify(x.h) === k);', 'const memes = !!k;'],
  'horaires-meme-en-route': ['api/_lib/transporteurs.js', "  const base = { evenements, cpRendu: c, libelle: propre(dernier.libelle, 160), etatAt: dernier.at, lieuNonLu: true, horairesForme: mrPoint.forme };", "  const base = { evenements, cpRendu: c, libelle: propre(dernier.libelle, 160), etatAt: dernier.at, lieuNonLu: true, horairesForme: mrPoint.forme, pointMr: mrPoint.pointId, horaires: mrPoint.horaires };"],
  'extension-acceptee': ['api/_lib/transporteurs.js', "const hLus = source === 'serveur' && lu.etat === 'disponible'", "const hLus = lu.etat === 'disponible'"],
  'jamais-expires': ['api/_lib/transporteurs.js', 'maintenant - hAvantMs < HORAIRES_TRANSP_VALIDES_MS && ', ''],
  'pas-relus-par-l-app': ['api/_lib/transporteurs.js', ',horaires:data->horaires,horairesPoint:meta->>horairesPoint,horairesAt:meta->>horairesAt', ''],
  'cp-ignore': ['api/_lib/suivi-colis.js', 'return cp && cps.length === 1 && cps[0] === cp ? t.horaires : null;', 'return t.horaires;'],
  'perime-affiche': ['api/_lib/suivi-colis.js', 'if (at == null || maintenant - at >= HORAIRES_TRANSP_VALIDES_MS || at - maintenant > 10 * 60000) return null;', 'if (at == null) return null;'],
  'email-ecrase': ['api/_lib/suivi-colis.js', '  if (horairesValides(out.horaires)) return out;\n', ''],
  'fusion-muette': ['api/_lib/suivi-colis.js', '    return avecHorairesDuTransporteur(out, t, maintenant);', '    return out;'],
};
const ARG_PROUVE = process.argv.find((x) => x.startsWith('--prouve'));
if (ARG_PROUVE) {
  let ok = 0;
  const seules = ARG_PROUVE.includes('=') ? ARG_PROUVE.split('=')[1].split(',') : null;
  const choisies = Object.entries(MUTATIONS).filter(([nom]) => !seules || seules.includes(nom));
  for (const [nom, [f, de, vers]] of choisies) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-hmr-'));
    for (const x of ['api', 'src', 'package.json']) fs.cpSync(path.join(R, x), path.join(t, x), { recursive: true });
    fs.symlinkSync(fs.realpathSync(path.join(R, 'node_modules')), path.join(t, 'node_modules'));
    const src = fs.readFileSync(path.join(t, f), 'utf8');
    if (src.split(de).length !== 2) { console.log(`❌ mutation ${nom} : ancre ${src.includes(de) ? 'pas unique' : 'introuvable'} dans ${f}`); fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(path.join(t, f), src.replace(de, vers));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8', timeout: 240000 });
    const rouges = (String(r.stdout || '').match(/^❌/gm) || []).length;
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
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String((e && e.stack) || e).split('\n').slice(0, 2).join(' ').slice(0, 260)); } };
const importer = (p) => import('file://' + path.join(R, p));

// ══ LES RÉPONSES INVENTÉES, À LA FORME MESURÉE (24 oct.) ══════════════════════
const N1 = '30000104', N2 = '30000105', CP1 = '35000';
const ent = (s) => s.replace(/é/g, '&#233;').replace(/è/g, '&#232;').replace(/à/g, '&#224;').replace(/'/g, '&#39;');
const ETAPES = ["Colis en préparation chez l'expéditeur", 'Colis remis à Mondial Relay', "Colis sur l'agence de livraison", 'Colis disponible au point de retrait', 'Colis livré au destinataire'];
// Le tableau d'horaires d'un point : une ligne par jour, une ou deux plages, « Fermé » sur deux colonnes.
const LUN_SAM = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const tableau = (lignes) => `<div class="points_relais PCL_Details hide"> <div class="detail-mag"> <p class="tittle-info"><strong>Horaires d&#39;ouverture :</strong></p> <table> <tbody> ${lignes.map(([j, a, b]) => (a === 'Fermé' ? `<tr> <td>${j}</td> <td colspan="2">Ferm&#233;</td> </tr>` : `<tr> <td>${j}</td> <td> ${a} </td> <td>${b || ''}</td> </tr>`)).join(' ')} </tbody> </table> <p>Impression Etiquette Point Relais</p> </div> </div>`;
const HORAIRES_STD = [...LUN_SAM.map((j) => [j, '09h00 - 12h00', '14h00 - 19h00']), ['dimanche', 'Fermé']];
const blocRelais = ({ point = '88001', pays = 'FR', lignes = HORAIRES_STD, double = null } = {}) => `<div class="step-suivi line-t"> <input type="hidden" id="numeroTemp" value=${point} /> <input type="hidden" id="codePaysTemp" value=${pays} /> ${tableau(lignes)} </div>${double ? `<div class="step-suivi line-t"> <input type="hidden" id="numeroTemp" value=${double.point || point} /> <input type="hidden" id="codePaysTemp" value=FR /> ${tableau(double.lignes || lignes)} </div>` : ''}`;
function fragment({ n = N1, cp = CP1, k = 4, jours = [], relais = blocRelais() } = {}) {
  const ul = `<ul class="timeline suivi center-element"> ${ETAPES.map((e, i) => `<li${i < k ? ' class="validate"' : ''}> <p>${ent(e)}</p> </li>`).join(' ')} </ul>`;
  const blocs = jours.map(([date, evs]) => `<div class="infos-account"> <div class="bloc mb-0 infos-colis suivre pt10"> <div class="col-xs-4 col-sm-2 col-md-2 col-lg-2 f-left"> <p>${date}</p> </div> <div class="col-xs-7"> <h5>${ent(evs[0] ? evs[0][1] : '')}</h5> </div> </div> <div class="bloc bg-white detail-infos"> ${evs.map(([h, l]) => `<div class="step-suivi"> <div class="col-xs-4 col-sm-3 col-md-3 "> <p class="center">${h}</p> </div> <div class="col-xs-8 col-sm-9 col-md-9"> <p>${ent(l)}</p> </div> </div>`).join(' ')} </div> </div>`).join(' ');
  const scripts = `<script type="text/javascript"> var culture = 'fr-FR'; var numeroExpedition = '${n}'; var token = 'JETONFACTICE'; </script> <script> window.dataLayer = window.dataLayer || [] dataLayer.push({ 'event': 'Suivi de Colis', 'CodePostal' : '${cp}', 'Pays' : 'FR' }); </script>`;
  return `<div class="grid"> <div class="row"> ${ul} </div> <div class="row"> ${blocs} ${relais} </div> </div> ${scripts}`;
}
const reponse = (frag) => JSON.stringify({ Success: true, ModelState: [], Message: frag, Action: 'ReplaceDiv', Data: false });
const J18 = ['18/10/2026', [['17:33', 'Colis pris en charge en Point Relais']]];
const J20 = ['20/10/2026', [['19:30', 'Colis expédié depuis le site HUBEXEMPLE']]];
const J21 = ['21/10/2026', [['14:43', '5 jours restants pour retirer le colis en Point Relais'], ['07:32', 'Colis en route vers le point de livraison']]];
const J21route = ['21/10/2026', [['07:32', 'Colis en route vers le point de livraison']]];
const J22 = ['22/10/2026', [['14:32', 'Colis livré au destinataire']]];
const ATTENDU = [{ jours: [1, 2, 3, 4, 5, 6], plages: [{ de: '09:00', a: '12:00' }, { de: '14:00', a: '19:00' }] }, { jours: [7], plages: [] }];
const egal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ══ UNE FAUSSE BASE À ÉTAT (forme de PostgREST) ET UN FAUX mondialrelay.fr ═══
const A = '11111111-2222-3333-4444-666666666666';
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VRM_OWNER_UID = A;
process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
process.env.CRON_SECRET = 'cle-banc-cron';
delete process.env.AI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
try { const webpush = require(path.join(R, 'node_modules', 'web-push')); webpush.setVapidDetails = () => {}; webpush.sendNotification = async () => ({ statusCode: 201 }); } catch (_) {}
const base = new Map();
const requetes = [];
let reponseMr = reponse(fragment({ jours: [J21, J20, J18] }));
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
const filtrer = (u) => {
  const conds = [];
  for (const [k, v] of u.searchParams) { if (['select', 'on_conflict', 'limit', 'order', 'offset'].includes(k)) continue; conds.push((l) => teste(valeur(l, k), v)); }
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
global.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  if (u.hostname === 'lgonxzrzjcqthjtbdpzo.supabase.co') {
    if (u.pathname === '/auth/v1/user') return rep({ id: A, email: 'banc@exemple.invalid', email_confirmed_at: '2026-01-01T00:00:00Z' });
    if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
    if (u.pathname !== '/rest/v1/app_data') return rep([]);
    if (m === 'POST') {
      const prefer = enTete(opts, 'Prefer'); const ins = [];
      for (const r of JSON.parse(opts.body || '[]')) { const cle = `${r.owner || A}|${r.id}`; if (/ignore-duplicates/.test(prefer) && base.has(cle)) continue; base.set(cle, r.data); ins.push({ id: r.id }); }
      return /return=representation/.test(prefer) ? rep(ins, 201) : new Response('', { status: 201 });
    }
    if (m === 'PATCH') { const corps = JSON.parse(opts.body || '{}'); const t = filtrer(u); for (const l of t) base.set(`${l.owner}|${l.id}`, corps.data); return rep(t.map((l) => ({ id: l.id }))); }
    if (m === 'DELETE') { for (const l of filtrer(u)) base.delete(`${l.owner}|${l.id}`); return new Response('', { status: 204 }); }
    const sel = u.searchParams.get('select') || '';
    if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);
    return rep(filtrer(u).map((l) => projeter(l, sel)));
  }
  if (/mondialrelay|chronopost|vintedgo/.test(u.hostname)) {
    requetes.push({ hote: u.hostname, chemin: u.pathname, n: u.searchParams.get('NumeroExpedition') || '', cp: u.searchParams.get('CodePostal') || '' });
    if (u.hostname === 'www.mondialrelay.fr' && u.pathname === '/_mvc/fr-FR/SuiviExpedition/RechercherJsonResponsive') {
      if (u.searchParams.get('NumeroExpedition') === N1 && u.searchParams.get('CodePostal') === CP1) return rep(reponseMr, 200, 'application/json; charset=utf-8');
      return rep(JSON.stringify({ Success: false, ModelState: [], Message: '<div>Il semble qu&#39;il y ait une erreur de saisie.</div>' }), 200, 'application/json; charset=utf-8');
    }
    return rep('<html>404</html>', 404, 'text/html');
  }
  throw new Error('réseau coupé au banc : ' + u.hostname);
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.send = () => r; r.end = () => r; return r; };
const appel = async (route, mode, { methode = 'POST', corps = {} } = {}) => { const res = faireRes(); await route({ method: methode, query: { mode }, headers: { authorization: 'Bearer aaa.bbb.ccc' }, body: corps }, res); return res; };

(async () => {
  let H = null, T = null, S = null;
  await essaie('modules', async () => {
    H = await importer('api/_lib/horaires-relais.js');
    T = await importer('api/_lib/transporteurs.js');
    S = await importer('api/_lib/suivi-colis.js');
    dit(typeof H.pointEtHorairesMr === 'function' && Number(H.HORAIRES_TRANSP_VALIDES_MS) === 7 * 864e5, 'la règle `pointEtHorairesMr` existe, et la validité des horaires lus chez le transporteur est de 7 jours');
  });

  // ══ 1. LA RÈGLE PURE ════════════════════════════════════════════════════════
  await essaie('règle pure', async () => {
    const r = H.pointEtHorairesMr(blocRelais());
    dit(r.pointId === '88001' && r.pays === 'FR' && egal(r.horaires, ATTENDU) && r.forme === '', 'un jour par ligne, deux plages, dimanche « Fermé » (colspan) ⇒ n° du point + lun.–sam. 9 h–12 h, 14 h–19 h, dimanche fermé', JSON.stringify(r));
    dit(H.texteHoraires(r.horaires) === 'Ouvert lun.–sam. 9 h–12 h, 14 h–19 h', 'ce que l’écran dit : « Ouvert lun.–sam. 9 h–12 h, 14 h–19 h » (les jours aux mêmes plages regroupés)', H.texteHoraires(r.horaires));
    const une = H.pointEtHorairesMr(blocRelais({ lignes: [['lundi', 'Fermé'], ...LUN_SAM.slice(1).map((j) => [j, '08h30 - 19h30']), ['dimanche', '09h00 - 12h30']] }));
    dit(egal(une.horaires, [{ jours: [1], plages: [] }, { jours: [2, 3, 4, 5, 6], plages: [{ de: '08:30', a: '19:30' }] }, { jours: [7], plages: [{ de: '09:00', a: '12:30' }] }]), 'une plage par jour, lundi fermé, dimanche matin', JSON.stringify(une.horaires));
    const sansDim = H.pointEtHorairesMr(blocRelais({ lignes: LUN_SAM.map((j) => [j, '09h00 - 19h00']) }));
    dit(egal(sansDim.horaires, [{ jours: [1, 2, 3, 4, 5, 6], plages: [{ de: '09:00', a: '19:00' }] }]), 'un jour que le tableau ne nomme pas (dimanche) reste INCONNU, jamais « fermé »', JSON.stringify(sansDim.horaires));
    const rien = [
      ['deux n° de point différents', blocRelais({ double: { point: '88002' } })],
      ['un point belge (codePaysTemp BE)', blocRelais({ pays: 'BE' })],
      ['deux tableaux différents pour le même point', blocRelais({ double: { lignes: LUN_SAM.map((j) => [j, '10h00 - 18h00']) } })],
      ['une ligne illisible (« sur rendez-vous »)', blocRelais({ lignes: [['lundi', 'sur rendez-vous'], ...LUN_SAM.slice(1).map((j) => [j, '09h00 - 19h00'])] })],
      ['une heure impossible (25h00)', blocRelais({ lignes: [['lundi', '09h00 - 25h00']] })],
      ['une plage à l’envers', blocRelais({ lignes: [['lundi', '19h00 - 09h00']] })],
      ['un jour dit deux fois', blocRelais({ lignes: [['lundi', '09h00 - 12h00'], ['lundi', '14h00 - 19h00']] })],
      ['tous les jours fermés', blocRelais({ lignes: [['lundi', 'Fermé'], ['mardi', 'Fermé']] })],
      ['un n° de point qui n’est pas un nombre', blocRelais({ point: 'ABC' })],
    ];
    for (const [nom, html] of rien) { const x = H.pointEtHorairesMr(html); dit(x.horaires === null, `${nom} ⇒ aucun horaire`, JSON.stringify(x.horaires)); }
    const ill = H.pointEtHorairesMr(blocRelais({ lignes: [['lundi', 'sur rendez-vous']] }));
    dit(/^mr-horaires:points=1,pays=FR,blocs=1,lignes=1,cellules=3$/.test(ill.forme) && !/rendez|lundi/i.test(ill.forme), 'un bloc illisible rend sa FORME (comptes), jamais son contenu', ill.forme);
    const sans = H.pointEtHorairesMr('<div class="step-suivi"><p>rien</p></div>');
    dit(sans.horaires === null && sans.pointId === '' && sans.forme === '', 'aucun bloc du point ⇒ rien, et aucune forme notée');
  });

  // ══ 2. L'ANALYSEUR DU FRAGMENT ════════════════════════════════════════════
  await essaie('analyseur _mvc', async () => {
    const lis = (frag) => T.lireReponseMondialRelayMvc(200, 'application/json; charset=utf-8', reponse(frag), { suivi: N1, cp: CP1 });
    const d = lis(fragment({ k: 4, jours: [J21, J20, J18] }));
    dit(d.res === 'ok' && d.etat === 'disponible' && d.pointMr === '88001' && egal(d.horaires, ATTENDU), 'colis DISPONIBLE ⇒ le n° du point (88001) et ses horaires', JSON.stringify({ e: d.etat, p: d.pointMr, h: d.horaires }));
    const r = lis(fragment({ k: 3, jours: [J21route, J20, J18] }));
    dit(r.res === 'ok' && r.etat === 'en_route' && !r.horaires && !r.pointMr, 'colis EN ROUTE (le point peut encore changer) ⇒ aucun horaire', JSON.stringify({ e: r.etat, h: r.horaires }));
    const x = lis(fragment({ k: 5, jours: [J22, J21, J20, J18] }));
    dit(x.res === 'ok' && x.etat === 'retire' && !x.horaires, 'colis RETIRÉ ⇒ aucun horaire', x.etat);
    const ill = lis(fragment({ k: 4, jours: [J21, J20, J18], relais: blocRelais({ lignes: [['lundi', 'sur rendez-vous']] }) }));
    dit(ill.res === 'ok' && ill.etat === 'disponible' && !ill.horaires && /^mr-horaires:/.test(ill.horairesForme || ''), 'un tableau illisible : le suivi est lu quand même, sans horaires, la forme notée', `${ill.etat} ${ill.horairesForme}`);
    const autre = T.lireReponseMondialRelayMvc(200, 'application/json', reponse(fragment({ n: '30000199', k: 4, jours: [J21] })), { suivi: N1, cp: CP1 });
    dit(autre.res === 'forme' && !autre.horaires, 'la réponse d’un AUTRE colis (écho) ⇒ rejetée, aucun horaire', autre.res);
  });

  // ══ 3. LA LIGNE APRÈS UN ESSAI ═══════════════════════════════════════════
  await essaie('ligneApresEssai', async () => {
    const t0 = Date.parse('2026-11-13T09:00:00Z');
    const lis = (frag) => T.lireReponseMondialRelayMvc(200, 'application/json', reponse(frag), { suivi: N1, cp: CP1 });
    const dispo = lis(fragment({ k: 4, jours: [J21, J20, J18] }));
    const sansBloc = lis(fragment({ k: 4, jours: [J21, J20, J18], relais: '' }));
    const autrePoint = lis(fragment({ k: 4, jours: [J21, J20, J18], relais: blocRelais({ point: '88009', lignes: LUN_SAM.map((j) => [j, '10h00 - 18h00']) }) }));
    const autreSans = lis(fragment({ k: 4, jours: [J21, J20, J18], relais: '<div class="step-suivi line-t"> <input type="hidden" id="numeroTemp" value=88009 /> <input type="hidden" id="codePaysTemp" value=FR /> </div>' }));
    const retire = lis(fragment({ k: 5, jours: [J22, J21, J20, J18] }));
    const o = { carrier: 'mondialrelay', suivi: N1, voie: 'mr-fr-mvc', cp: CP1, cpSource: 'email' };
    const l1 = T.ligneApresEssai(null, dispo, { ...o, source: 'serveur', maintenant: t0 });
    dit(egal(l1.horaires, ATTENDU) && l1.horairesPoint === '88001' && l1.horairesAt === new Date(t0).toISOString() && l1.cp === CP1, 'lu par le SERVEUR : horaires, n° du point et date de lecture rangés sur la ligne `transp_`', JSON.stringify({ h: !!l1.horaires, p: l1.horairesPoint, at: l1.horairesAt }));
    const lx = T.ligneApresEssai(null, dispo, { ...o, source: 'extension', maintenant: t0 });
    dit(!lx.horaires && !lx.horairesPoint, 'relayé par l’EXTENSION : aucun horaire (le serveur seul lit les sites des transporteurs)', JSON.stringify(lx.horaires));
    const l2 = T.ligneApresEssai(l1, sansBloc, { ...o, source: 'serveur', maintenant: t0 + 3 * 864e5 });
    dit(egal(l2.horaires, ATTENDU) && l2.horairesAt === l1.horairesAt, 'relu 3 jours plus tard sans le tableau : les horaires du même point restent (7 jours au plus), datés de leur lecture');
    const l3 = T.ligneApresEssai(l1, sansBloc, { ...o, source: 'serveur', maintenant: t0 + 8 * 864e5 });
    dit(!l3.horaires && !l3.horairesPoint && !l3.horairesAt, 'relu 8 jours plus tard sans le tableau : effacés (plus de 7 jours)', JSON.stringify(l3.horaires));
    const l4 = T.ligneApresEssai(l1, autreSans, { ...o, source: 'serveur', maintenant: t0 + 864e5 });
    dit(!l4.horaires, 'un AUTRE n° de point sans tableau : les horaires de l’ancien point sont effacés', JSON.stringify(l4.horaires));
    const l5 = T.ligneApresEssai(l1, autrePoint, { ...o, source: 'serveur', maintenant: t0 + 864e5 });
    dit(l5.horairesPoint === '88009' && egal(l5.horaires, [{ jours: [1, 2, 3, 4, 5, 6], plages: [{ de: '10:00', a: '18:00' }] }]), 'un autre point avec son tableau : ses horaires remplacent les anciens', JSON.stringify({ p: l5.horairesPoint }));
    const l6 = T.ligneApresEssai(l1, retire, { ...o, source: 'serveur', maintenant: t0 + 864e5 });
    dit(!l6.horaires && l6.etat === 'retire', 'retiré : les horaires sont effacés (le colis n’attend plus)', l6.etat);
    const l7 = T.ligneApresEssai(l1, { res: 'bloque' }, { ...o, source: 'serveur', maintenant: t0 + 864e5 });
    dit(egal(l7.horaires, ATTENDU), 'une lecture refusée ne change rien (horaires gardés tels quels)');
  });

  // ══ 4. LA LECTURE PROJETÉE ═══════════════════════════════════════════════
  await essaie('lecture projetée', async () => {
    const sel = T.SELECT_TRANSP_META;
    dit(/(^|,)horaires:data->horaires(,|$)/.test(sel) && /horairesPoint:meta->>horairesPoint/.test(sel) && /horairesAt:meta->>horairesAt/.test(sel) && !/(^|,)data(,|$)/.test(sel), 'la lecture des lignes `transp_` projette `horaires` par son chemin (jamais `select=data`)', sel.slice(-120));
    const at = '2026-11-13T09:00:00.000Z';
    const l = { id: `transp_mondialrelay_${N1}`, data: { v: 1, suivi: N1, carrier: 'mondialrelay', etat: 'disponible', cp: CP1, horaires: ATTENDU, horairesPoint: '88001', horairesAt: at } };
    const x = T.ligneTranspDeMeta(projeter(l, sel));
    dit(!!x && egal(x.horaires, ATTENDU) && x.horairesPoint === '88001' && x.horairesAt === at, 'relue par l’app : horaires, point et date', JSON.stringify(x && { h: !!x.horaires, p: x.horairesPoint }));
    const y = T.ligneTranspDeMeta(projeter({ ...l, data: { ...l.data, horaires: [{ jours: [9], plages: [] }] } }, sel));
    dit(!!y && !y.horaires, 'une valeur rangée hors forme n’est pas crue');
  });

  // ══ 5. LA FUSION AVEC LA LIGNE « À RETIRER » ═════════════════════════════
  await essaie('fusionTransporteur', async () => {
    const now = Date.parse('2026-11-13T09:19:00Z');
    const t = { suivi: N1, carrier: 'mondialrelay', etat: 'disponible', etatAt: '2026-11-12T13:43:00.000Z', lu: new Date(now - 3600e3).toISOString(), cp: CP1, horaires: ATTENDU, horairesPoint: '88001', horairesAt: new Date(now - 3600e3).toISOString() };
    const l = { suivi: N1, carrier: 'mondialrelay', status: 'available', emailAt: '2026-11-12T14:00:00.000Z', lieu: `TABAC EXEMPLE 3 PLACE INVENTEE ${CP1} VILLEXEMPLE`, code: '123456' };
    const f = S.fusionTransporteur(l, t, now);
    dit(egal(f.horaires, ATTENDU) && f.horairesDuTransporteur === true && f.horairesAt === t.horairesAt, 'la ligne « à retirer » du même n°, au code postal confirmé par Mondial Relay : horaires posés, datés de leur lecture', JSON.stringify({ h: !!f.horaires, d: f.horairesDuTransporteur }));
    const f2 = S.fusionTransporteur({ ...l, lieu: 'TABAC EXEMPLE 3 PLACE INVENTEE 35700 VILLEXEMPLE' }, t, now);
    dit(!f2.horaires, 'le point affiché a un AUTRE code postal ⇒ aucun horaire', JSON.stringify(f2.horaires));
    const f3 = S.fusionTransporteur({ ...l, lieu: 'TABAC EXEMPLE' }, t, now);
    dit(!f3.horaires, 'un point sans code postal lisible ⇒ aucun horaire');
    const f4 = S.fusionTransporteur(l, { ...t, horairesAt: new Date(now - 8 * 864e5).toISOString() }, now);
    dit(!f4.horaires, 'lus il y a 8 jours ⇒ plus dits');
    const H_MAIL = [{ jours: [1, 2, 3, 4, 5], plages: [{ de: '08:00', a: '20:00' }] }];
    const f5 = S.fusionTransporteur({ ...l, horaires: H_MAIL }, t, now);
    dit(egal(f5.horaires, H_MAIL) && !f5.horairesDuTransporteur, 'l’e-mail qui écrit des horaires garde les siens');
    const f6 = S.fusionTransporteur({ ...l, status: 'transit', emailAt: '2026-11-11T08:00:00.000Z', lieu: undefined, relaisChange: true }, t, now);
    dit(f6.status === 'available' && !f6.horaires, 'en transit dans l’e-mail, disponible chez Mondial Relay, sans lieu : aucun horaire (aucun point à comparer)', JSON.stringify({ s: f6.status, h: f6.horaires }));
    const f7 = S.fusionTransporteur({ ...l, status: 'transit', emailAt: '2026-11-11T08:00:00.000Z', lieu: `NOUVEAU RELAIS 1 RUE INVENTEE ${CP1} VILLEXEMPLE`, relaisChange: true }, t, now);
    dit(f7.status === 'available' && egal(f7.horaires, ATTENDU), 'en transit dans l’e-mail (point changé, nouveau lieu lu), disponible chez Mondial Relay au même code postal : horaires posés');
  });

  // ══ 6. LA VRAIE ROUTE ════════════════════════════════════════════════════
  await essaie('route api/relais.js', async () => {
    const L = await importer('api/_lib/transporteurs-lecture.js');
    if (typeof L._reglerPourBanc === 'function') L._reglerPourBanc({ ecartMs: 0 });
    const route = (await importer('api/relais.js')).default;
    base.clear(); requetes.length = 0;
    const h = new Date(Date.now() - 3600000).toISOString();
    base.set(`${A}|email_track_mondialrelay_${N1}`, { suivi: N1, carrier: 'mondialrelay', status: 'available', sens: 'entrant', subject: 'Votre colis est disponible', statusLabel: 'Arrivé au point de retrait', receivedAt: h, emailAt: h, lieu: `TABAC EXEMPLE 3 PLACE INVENTEE ${CP1} VILLEXEMPLE` });
    base.set(`${A}|main`, { vrm_points_relais: [] });
    reponseMr = reponse(fragment({ k: 4, jours: [J21, J20, J18] }));
    const r = await appel(route, 'transp');
    dit(r.code === 200, 'C5 répond 200', `${r.code}`);
    const ligne = base.get(`${A}|transp_mondialrelay_${N1}`);
    dit(!!ligne && ligne.etat === 'disponible' && egal(ligne.horaires, ATTENDU) && ligne.horairesPoint === '88001' && !!ligne.horairesAt, 'la ligne `transp_` rangée par le serveur porte les horaires du point et son n°', ligne ? JSON.stringify({ e: ligne.etat, p: ligne.horairesPoint, h: !!ligne.horaires }) : 'absente');
    const mr = requetes.filter((x) => /mondialrelay/.test(x.hote));
    dit(mr.length === 1 && mr[0].chemin === '/_mvc/fr-FR/SuiviExpedition/RechercherJsonResponsive', 'UNE requête : la lecture du suivi (aucune autre page de Mondial Relay pour les horaires)', mr.map((x) => x.chemin).join(' · '));
    const vu = T.ligneTranspDeMeta(projeter({ id: `transp_mondialrelay_${N1}`, owner: A, data: ligne || {} }, T.SELECT_TRANSP_META));
    const email = base.get(`${A}|email_track_mondialrelay_${N1}`);
    const f = vu && S.fusionTransporteur(email, vu, Date.now());
    dit(!!f && egal(f.horaires, ATTENDU) && H.texteHoraires(f.horaires) === 'Ouvert lun.–sam. 9 h–12 h, 14 h–19 h', 'relue comme l’app la lit et fondue à l’e-mail : « Ouvert lun.–sam. 9 h–12 h, 14 h–19 h »', f && H.texteHoraires(f.horaires));
    // C4 : la même réponse relayée par l'extension ne pose jamais d'horaires (un retrait les efface).
    const c4 = await appel(route, 'transp-brut', { corps: { v: 1, carrier: 'mondialrelay', suivi: N1, cp: CP1, voie: 'mr-fr-mvc', statut: 200, ctype: 'application/json', corps: reponse(fragment({ k: 5, jours: [J22, J21, J20, J18] })) } });
    const apres = base.get(`${A}|transp_mondialrelay_${N1}`);
    dit(c4.code === 200 && !!apres && apres.etat === 'retire' && !apres.horaires, 'C4 (extension) : retiré, horaires effacés', apres ? `${apres.etat} ${JSON.stringify(apres.horaires)}` : 'absente');
  });

  console.log(ko ? `\n❌ audit-horaires-mondialrelay : ${ko} rouge(s)` : '\n✅ audit-horaires-mondialrelay : tout est vert');
  process.exit(ko ? 1 : 0);
})();
