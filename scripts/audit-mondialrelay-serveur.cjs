// scripts/audit-mondialrelay-serveur.cjs
// ─────────────────────────────────────────────────────────────────────────────
// (24 oct.) MONDIAL RELAY LU PAR LE SERVEUR, PAR LA ROUTE `_mvc` DE
// mondialrelay.fr (voie `mr-fr-mvc`). Mesuré le 24 oct. depuis dub1 (sandbox
// Vercel), User-Agent honnête, sans cookie ni jeton : 200 JSON `{Success,
// ModelState, Message, Action, Data}`, `Message` = un fragment HTML (la frise
// `ul.timeline`, les jours `<p>JJ/MM/AAAA</p>`, les évènements `step-suivi`),
// l'écho `var numeroExpedition = '…'` et `'CodePostal' : '…'` ; un mauvais code
// postal rend `Success:false` (« Il semble qu'il y ait une erreur de saisie… »).
// L'API JSON de mondialrelay.be reste refusée au serveur (403). Sur refus du
// serveur (seulement alors), l'extension lit à sa place, depuis le navigateur
// de Julien : C3 lui annonce la MÊME route `_mvc` (`mr-fr-mvc`), et C4 accepte
// sa réponse relayée sous `mr-fr-mvc` (jugée par le même analyseur, écho exigé)
// comme sous `mr-be` (l'API .be) — jamais une voie inconnue.
//
// Ce que l'audit EXÉCUTE (données INVENTÉES à la forme mesurée — aucun vrai n°,
// aucun vrai point relais) :
//   1. l'analyseur `lireReponseMondialRelayMvc` (trouvé, disponible, en route,
//      préparation, inconnu, livré sans arrivée ; Success:false mesuré ⇒
//      introuvable, un autre ⇒ forme ; écho du n° et du code postal ; refus) ;
//   2. la VRAIE route api/relais.js (C5, C3, C4) sur une fausse base À ÉTAT et
//      un faux mondialrelay.fr : le serveur lit Mondial Relay lui-même, ne met
//      dans `besoinNavigateur` (et C3) que sur refus ou pendant la pause, sans
//      code postal aucune requête, C4 accepte `mr-fr-mvc` (écho exigé) et `mr-be`
//      et refuse une voie inconnue, un code postal ESSAYÉ ne compte jamais comme
//      « introuvable », un n° sortant n'est jamais lu, User-Agent honnête,
//      `redirect: 'error'`, jamais mondialrelay.be ni `/api/tracking` ;
//   3. l'app (rendue, React) : plus jamais « Mondial Relay ne se lit que depuis
//      ton ordinateur » quand le serveur le lit ; la carte d'un colis Mondial
//      Relay pas encore lu dit « pas encore lu » ; un refus du serveur est dit
//      UNE fois en tête, avec le geste selon l'extension de ce navigateur.
// `--prouve` : réaffaiblit la règle, chaque mutation doit rendre ROUGE.
// §6.1 : lancé depuis un arbre d'avant (AUDIT_RACINE, ou copié dedans), il est rouge.
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

const MUTATIONS = {
  'drapeau-faux': ['api/_lib/transporteurs.js', 'LECTURE_SERVEUR_TRANSP = Object.freeze({ chronopost: true, vinted: true, mondialrelay: true });', 'LECTURE_SERVEUR_TRANSP = Object.freeze({ chronopost: true, vinted: true, mondialrelay: false });'],
  'echo-numero-ignore': ['api/_lib/transporteurs.js', "if (!mN || numero !== n || !c || (mC && cpRendu !== c)) return rendu('forme'", "if (!c || (mC && cpRendu !== c)) return rendu('forme'"],
  'echo-cp-ignore': ['api/_lib/transporteurs.js', "if (!mN || numero !== n || !c || (mC && cpRendu !== c)) return rendu('forme'", "if (!mN || numero !== n || !c) return rendu('forme'"],
  'succes-false-tout-introuvable': ['api/_lib/transporteurs.js', "if (j.Success === false) return MVC_PAS_DE_COLIS.test(texteMvcErreur(j)) ? rendu('introuvable') : rendu('forme', { forme: `succes:false,${formeDe(j)}` });", "if (j.Success === false) return rendu('introuvable');"],
  'forme-inconnue-introuvable': ['api/_lib/transporteurs.js', "if (!j || typeof j !== 'object' || typeof j.Success !== 'boolean') return rendu('forme',", "if (!j || typeof j !== 'object' || typeof j.Success !== 'boolean') return rendu('introuvable',"],
  'libelle-livraison-inconnu': ['api/_lib/transporteurs.js', "[/^colis en route vers le point de (?:retrait|livraison)\\b/, 'route'],", "[/^colis en route vers le point de retrait\\b/, 'route'],"],
  'retire-sans-arrivee': ['api/_lib/transporteurs.js', "etat: (k >= 4 || arr) ? 'retire' : 'livre'", "etat: 'retire'"],
  'refus-carte-muet': ['api/_lib/transporteurs.js', "  if (t.essaiRes === 'bloque') return { etatAffiche: 'passu', texte: `${nom} refuse la lecture depuis le serveur pour l'instant — VRM réessaie plus tard`, consequence: '', ambre: false, age: null };\n", ''],
  // (fusion) C4 ACCEPTE `mr-fr-mvc` (l'extension 5.281 la lit depuis le navigateur) :
  // la retirer de `VOIES`, juger son corps comme du .be, ou accepter n'importe
  // quelle voie, doit rendre ROUGE.
  'c4-mvc-refusee': ['api/_lib/transporteurs.js', "export const VOIES = { 'mr-fr-mvc': 'mondialrelay', 'mr-be': 'mondialrelay',", "export const VOIES = { 'mr-be': 'mondialrelay',"],
  'c4-voie-ignoree': ['api/_lib/transporteurs-lecture.js', '  let lu = T.lireReponse(carrier, statut, ctype, x.corps, { suivi, cp, voie });', "  let lu = T.lireReponse(carrier, statut, ctype, x.corps, { suivi, cp, voie: 'mr-be' });"],
  'c4-voie-inconnue-acceptee': ['api/_lib/transporteurs-lecture.js', "  if (T.VOIES[String(x.voie || '')] !== carrier) return { status: 400, corps: { error: 'voie' } };", ''],
  // (fusion) C3 annonce `mr-fr-mvc` (la voie que l'extension 5.281 lit d'abord).
  'c3-voie-be': ['api/_lib/transporteurs.js', "export const VOIE_DE = { mondialrelay: 'mr-fr-mvc',", "export const VOIE_DE = { mondialrelay: 'mr-be',"],
  'mr-toujours-navigateur': ['api/_lib/transporteurs.js', "    if (!(refusServeur(t) || enPause(pause, it.carrier, maintenant))) continue;", "    if (it.carrier !== 'mondialrelay' && !(refusServeur(t) || enPause(pause, it.carrier, maintenant))) continue;"],
  'recul-serveur-retarde-extension': ['api/_lib/transporteurs.js', "vue.set(k, refusServeur(t) ? { ...t, essai: null } : t);", "vue.set(k, t);"],
  'refus-extension-sans-recul': ['api/_lib/transporteurs.js', "t.essaiRes === 'bloque' && t.essaiSource !== 'extension' && t.essaiSource !== 'page';", "t.essaiRes === 'bloque';"],
  'pause-ignoree': ['api/_lib/transporteurs-lecture.js', 'const pauseEnCours = (p, carrier) => T.enPause(pauseConnue(p), carrier, Date.now());', 'const pauseEnCours = () => false;'],
  'ua-navigateur': ['api/_lib/transporteurs-lecture.js', "headers: { 'User-Agent': UA_HONNETE,", "headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36',"],
  'redirection-suivie': ['api/_lib/transporteurs-lecture.js', "        redirect: 'error',", "        redirect: 'follow',"],
  'essai-compte-introuvable': ['api/_lib/transporteurs.js', "  if (lu.res === 'introuvable' && (essaye || !prouve)) return", "  if (lu.res === 'introuvable' && !essaye && !prouve) return"],
  'sans-cp-lu-quand-meme': ['api/_lib/transporteurs-lecture.js', "  if (carrier === 'mondialrelay') return /^\\d{5}$/.test(String(cp || '')) ? `https://www.mondialrelay.fr/_mvc/fr-FR/SuiviExpedition/RechercherJsonResponsive?NumeroExpedition=${n}&CodePostal=${cp}` : null;", "  if (carrier === 'mondialrelay') return `https://www.mondialrelay.fr/_mvc/fr-FR/SuiviExpedition/RechercherJsonResponsive?NumeroExpedition=${n}&CodePostal=${cp || '00000'}`;"],
  'phrase-ordinateur-toujours': ['src/App.jsx', "const mrSans = (transp === null || mrServeur) ? 0 :", "const mrSans = (transp === null) ? 0 :"],
  'carte-mr-cachee': ['src/App.jsx', "if (!t && c === 'mondialrelay' && !LECTURE_SERVEUR_TRANSP.mondialrelay && extSait('transp') !== 'ok') return null;", "if (!t && c === 'mondialrelay' && extSait('transp') !== 'ok') return null;"],
  'refus-pas-dit': ['src/App.jsx', "return !!t && t.essaiRes === 'bloque';", 'return false;'],
  'promesse-ordinateur': ['src/App.jsx', "{LECTURE_SERVEUR_TRANSP.mondialrelay ? '(Mondial Relay : avec le code postal du point relais).' : '(Mondial Relay : depuis ton ordinateur, avec l\\'extension).'}", "(Mondial Relay : depuis ton ordinateur, avec l'extension)."],
};
const ARG_PROUVE = process.argv.find((x) => x.startsWith('--prouve'));
if (ARG_PROUVE) {
  let ok = 0;
  const seules = ARG_PROUVE.includes('=') ? ARG_PROUVE.split('=')[1].split(',') : null;
  const choisies = Object.entries(MUTATIONS).filter(([nom]) => !seules || seules.includes(nom));
  for (const [nom, [f, de, vers]] of choisies) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-mr-'));
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

// ══ LES RÉPONSES INVENTÉES, À LA FORME MESURÉE ════════════════════════════════
const N1 = '30000004', N2 = '30000005', N3 = '30000006', N4 = '30000007', CP1 = '35000';
const ent = (s) => s.replace(/é/g, '&#233;').replace(/è/g, '&#232;').replace(/à/g, '&#224;').replace(/'/g, '&#39;');
const ETAPES = ["Colis en préparation chez l'expéditeur", 'Colis remis à Mondial Relay', "Colis sur l'agence de livraison", 'Colis disponible au point de retrait', 'Colis livré au destinataire'];
// `jours` : du plus récent au plus ancien, chacun [['HH:MM', libellé], …] du plus récent au plus ancien.
function fragment({ n = N1, cp = CP1, k = 4, jours = [], sansEcho = false, sansCp = false, sansFrise = false } = {}) {
  const ul = sansFrise ? '' : `<ul class="timeline suivi center-element"> ${ETAPES.map((e, i) => `<li${i < k ? ' class="validate"' : ''}> <p>${ent(e)}</p> </li>`).join(' ')} </ul>`;
  const blocs = jours.map(([date, evs]) => `<div class="infos-account"> <div class="bloc mb-0 infos-colis suivre pt10"> <div class="col-xs-2 col-sm-2 col-md-2 col-lg-2 f-right"> <a class="more-details " href="javascript:void(0)"><span class="icon-minus f-right"></span></a> </div> <div class="col-xs-4 col-sm-2 col-md-2 col-lg-2 f-left"> <p>${date}</p> </div> <div class="col-xs-7 col-sm-7 col-md-7 col-lg-7 f-left"> <h5>${ent(evs[0] ? evs[0][1] : '')}</h5> </div> </div> <div class="bloc bg-white detail-infos" style=""> <style>.x{color:red}</style> ${evs.map(([h, l]) => `<div class="step-suivi"> <div class="col-xs-4 col-sm-3 col-md-3 "> <p class="center">${h}</p> </div> <div class="col-xs-8 col-sm-9 col-md-9"> <p>${ent(l)}</p> </div> <div class="col-xs-4 col-sm-3 col-md-3 "></div> <div class="col-xs-8 col-sm-9 col-md-9 "> <p>${l}</p> </div> </div>`).join(' ')} </div> </div>`).join(' ');
  const relais = `<div class="step-suivi line-t"> <input type="hidden" id="numeroTemp" value=99999 /> <input type="hidden" id="codePaysTemp" value=FR /> <div class="points_relais PCL_Details hide"> <div class="detail-mag"> <p class="tittle-info"><strong>Horaires d&#39;ouverture :</strong></p> <table> <tbody> <tr> <td>lundi</td> <td> 08h00 - 19h00 </td> </tr> <tr> <td>dimanche</td> <td colspan="2">Ferm&#233;</td> </tr> </tbody> </table> </div> </div> </div>`;
  const scripts = (sansEcho ? '' : `<script type="text/javascript"> var culture = 'fr-FR'; var codeMarque = 'V1'; var numeroExpedition = '${n}'; var token = 'JETONFACTICE'; </script>`)
    + (sansCp ? '' : ` <script> window.dataLayer = window.dataLayer || [] dataLayer.push({ 'event': 'Suivi de Colis', 'CodePostal' : '${cp}', 'Pays' : 'FR' }); </script>`);
  return `<style>.grid{margin:0}</style> <div class="grid"> <div class="row"> <div class="col-xs-12 col-md-12 mb20 mt30"> ${ul} </div> </div> <div class="row"> <div class="col-xs-12 col-sm-12 col-md-12 mb30"> ${blocs} ${relais} </div> </div> </div> ${scripts}`;
}
const reponse = (frag) => JSON.stringify({ Success: true, ModelState: [], Message: frag, Action: 'ReplaceDiv', Data: false });
const PAS_DE_COLIS = JSON.stringify({ Success: false, ModelState: [{ Item1: '', Item2: "Il semble qu'il y ait une erreur de saisie. Merci de vérifier vos informations." }], Message: '<ul class="erreurs"><li class="Error">Il semble qu&#39;il y ait une erreur de saisie. Merci de v&#233;rifier vos informations.</li></ul>', Action: null, Data: null });
const J17 = ['17/10/2026', [['21:24', "Colis en préparation chez l'expéditeur"]]];
const J18 = ['18/10/2026', [['17:33', 'Colis pris en charge en Point Relais']]];
const J20 = ['20/10/2026', [['19:30', 'Colis expédié depuis le site HUBEXEMPLE']]];
const J21 = ['21/10/2026', [['14:43', '5 jours restants pour retirer le colis en Point Relais'], ['07:32', 'Colis en route vers le point de livraison'], ['01:17', 'Prise en charge de votre colis sur notre site logistique de VILLEXEMPLE.']]];
const J21route = ['21/10/2026', [['07:32', 'Colis en route vers le point de livraison'], ['01:17', 'Prise en charge de votre colis sur notre site logistique de VILLEXEMPLE.']]];
const J22 = ['22/10/2026', [['14:32', 'Colis livré au destinataire']]];
const RETIRE = fragment({ k: 5, jours: [J22, J21, J20, J18, J17] });
const DISPO = fragment({ k: 4, jours: [J21, J20, J18, J17] });
const ROUTE = fragment({ k: 3, jours: [J21route, J20, J18, J17] });
const CF_HTML = '<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title></head><body>cf</body></html>';

// ══ UNE FAUSSE BASE À ÉTAT (forme de PostgREST) ET UN FAUX mondialrelay.fr ═══
const A = '11111111-2222-3333-4444-555555555555';
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VRM_OWNER_UID = A;
process.env.VAPID_PRIVATE_KEY = 'banc-cle-privee-factice';
process.env.CRON_SECRET = 'cle-banc-cron';
delete process.env.AI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
try { const webpush = require(path.join(R, 'node_modules', 'web-push')); webpush.setVapidDetails = () => {}; webpush.sendNotification = async () => ({ statusCode: 201 }); } catch (_) {}

const base = new Map();
const transporteur = [];      // chaque requête vers un transporteur
const ailleurs = [];          // toute autre adresse hors de notre base
let mvc = 'ok';               // 'ok' · '403'
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
      const prefer = enTete(opts, 'Prefer');
      const ins = [];
      for (const r of JSON.parse(opts.body || '[]')) {
        const cle = `${r.owner || A}|${r.id}`;
        if (/ignore-duplicates/.test(prefer) && base.has(cle)) continue;
        base.set(cle, r.data); ins.push({ id: r.id });
      }
      return /return=representation/.test(prefer) ? rep(ins, 201) : new Response('', { status: 201 });
    }
    if (m === 'PATCH') {
      const corps = JSON.parse(opts.body || '{}');
      const t = filtrer(u); for (const l of t) base.set(`${l.owner}|${l.id}`, corps.data);
      return rep(t.map((l) => ({ id: l.id })));
    }
    if (m === 'DELETE') { for (const l of filtrer(u)) base.delete(`${l.owner}|${l.id}`); return new Response('', { status: 204 }); }
    const sel = u.searchParams.get('select') || '';
    if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);   // base cloisonnée
    return rep(filtrer(u).map((l) => projeter(l, sel)));
  }
  if (/mondialrelay|chronopost|vintedgo/.test(u.hostname)) {
    transporteur.push({ url: String(url), hote: u.hostname, chemin: u.pathname, n: u.searchParams.get('NumeroExpedition') || '', cp: u.searchParams.get('CodePostal') || '', ua: enTete(opts, 'User-Agent'), xrw: enTete(opts, 'X-Requested-With'), accept: enTete(opts, 'Accept'), redirect: opts.redirect || '', cookie: enTete(opts, 'Cookie') });
    if (u.hostname === 'www.mondialrelay.fr' && u.pathname === '/_mvc/fr-FR/SuiviExpedition/RechercherJsonResponsive') {
      if (mvc === '403') return rep(CF_HTML, 403, 'text/html; charset=UTF-8');
      const n = u.searchParams.get('NumeroExpedition'), cp = u.searchParams.get('CodePostal');
      if (n === N1 && cp === CP1) return rep(reponse(DISPO), 200, 'application/json; charset=utf-8');
      return rep(PAS_DE_COLIS, 200, 'application/json; charset=utf-8');
    }
    return rep('<html>404</html>', 404, 'text/html');
  }
  ailleurs.push(String(url));
  throw new Error('réseau coupé au banc : ' + u.hostname);
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.send = () => r; r.end = () => r; return r; };
const appel = async (route, mode, { methode = 'POST', corps = {} } = {}) => {
  const res = faireRes();
  await route({ method: methode, query: { mode }, headers: { authorization: 'Bearer aaa.bbb.ccc' }, body: corps }, res);
  return res;
};
// Les colis inventés : N1 arrivé (le lieu de l'e-mail porte le code postal), N2
// en route (aucun code postal connu), N3 un colis POSTÉ par lui (son bordereau).
function semer() {
  base.clear();
  const h = new Date(Date.now() - 3600000).toISOString();
  base.set(`${A}|email_track_mondialrelay_${N1}`, { suivi: N1, carrier: 'mondialrelay', status: 'available', sens: 'entrant', subject: 'Ton colis est disponible', statusLabel: 'Arrivé au point de retrait', receivedAt: h, emailAt: h, lieu: `RELAIS EXEMPLE 12 RUE INVENTEE ${CP1} VILLEXEMPLE` });
  base.set(`${A}|email_track_mondialrelay_${N2}`, { suivi: N2, carrier: 'mondialrelay', status: 'transit', sens: 'entrant', subject: 'Ton colis est en route', statusLabel: 'En transit', receivedAt: h, emailAt: h });
  base.set(`${A}|email_track_mondialrelay_${N3}`, { suivi: N3, carrier: 'mondialrelay', status: 'available', sens: 'entrant', subject: 'Ton colis est disponible', receivedAt: h, emailAt: h, lieu: `RELAIS EXEMPLE ${CP1} VILLEXEMPLE` });
  base.set(`${A}|email_bord_90000001`, { suivi: N3, filename: 'bordereau.pdf' });
  base.set(`${A}|main`, { vrm_points_relais: [] });
}
const ligneDe = (n) => base.get(`${A}|transp_mondialrelay_${n}`) || null;

(async () => {
  let T = null;
  // ══ 1. L'ANALYSEUR DU FRAGMENT `_mvc` ═════════════════════════════════════
  await essaie('analyseur _mvc', async () => {
    T = await importer('api/_lib/transporteurs.js');
    const f = T.lireReponseMondialRelayMvc;
    dit(typeof f === 'function', 'l’analyseur du fragment `_mvc` existe (lireReponseMondialRelayMvc)');
    const lis = (corps, o = {}) => f(o.statut || 200, o.ctype || 'application/json; charset=utf-8', corps, { suivi: o.suivi || N1, cp: o.cp == null ? CP1 : o.cp });
    const r1 = lis(reponse(RETIRE));
    dit(r1.res === 'ok' && r1.etat === 'retire', 'frise à 5 étapes, livré APRÈS « 5 jours restants » ⇒ retiré', `${r1.res}/${r1.etat}`);
    dit(r1.etatAt === '2026-10-22T12:32:00.000Z', 'la date de l’évènement : 22/10 14:32 à Paris ⇒ 12:32 UTC', r1.etatAt);
    dit(Array.isArray(r1.evenements) && r1.evenements.length === 7 && r1.evenements[0].at === '2026-10-17T19:24:00.000Z' && r1.evenements[6].at === '2026-10-22T12:32:00.000Z', 'les 7 évènements, du plus ancien au plus récent (le libellé écrit deux fois n’est compté qu’une fois)', (r1.evenements || []).length + ' évènements');
    dit(!r1.lieuNom && !r1.lieuCp, 'le fragment ne porte ni nom ni adresse du point relais : rien n’est inventé', `${r1.lieuNom}|${r1.lieuCp}`);
    const r2 = lis(reponse(DISPO));
    dit(r2.res === 'ok' && r2.etat === 'disponible', 'frise à 4 étapes, dernier « 5 jours restants » ⇒ disponible', `${r2.res}/${r2.etat}`);
    dit(r2.limite === '2026-10-26' && r2.limiteSure === false, 'la date limite est DÉDUITE (21/10 + 5 jours), jamais affirmée', `${r2.limite} sûre=${r2.limiteSure}`);
    const r3 = lis(reponse(ROUTE));
    dit(r3.res === 'ok' && r3.etat === 'en_route', '« Colis en route vers le point de livraison » (libellé vu sur `_mvc`) ⇒ en route', `${r3.res}/${r3.etat}`);
    const r4 = lis(reponse(fragment({ k: 1, jours: [J17] })));
    dit(r4.res === 'ok' && r4.etat === 'en_route' && r4.detail === 'prepare', 'une seule étape atteinte ⇒ en préparation', `${r4.etat}/${r4.detail}`);
    const r5 = lis(reponse(fragment({ k: 3, jours: [['21/10/2026', [['09:00', 'Colis en attente d’un créneau spécial']]], J20, J18, J17] })));
    dit(r5.res === 'ok' && r5.etat === 'inconnu' && /créneau spécial/.test(r5.libelle), 'un libellé que VRM ne connaît pas ⇒ « inconnu », recopié tel quel', `${r5.etat} « ${r5.libelle} »`);
    const r6 = lis(reponse(fragment({ k: 3, jours: [['21/10/2026', [['10:00', 'Colis livré au destinataire']]], J20, J18, J17] })));
    dit(r6.res === 'ok' && r6.etat === 'livre', 'livré sans arrivée au point relais (étape 4 jamais atteinte) ⇒ livré, pas « retiré »', `${r6.etat}`);
    const r7 = lis(PAS_DE_COLIS);
    dit(r7.res === 'introuvable', '`Success:false` avec le message mesuré (« erreur de saisie ») ⇒ introuvable', r7.res);
    const r8 = lis(JSON.stringify({ Success: false, ModelState: [], Message: '<li class="Error">Le service est momentan&#233;ment indisponible.</li>' }));
    dit(r8.res === 'forme', '`Success:false` avec un AUTRE message ⇒ forme (jamais « introuvable » deviné)', r8.res);
    dit(lis(JSON.stringify({ Message: 'x' })).res === 'forme' && lis('[1,2]').res === 'forme' && lis('null').res === 'forme', 'un JSON sans `Success` booléen ⇒ forme');
    const r9 = lis(reponse(fragment({ n: '30000099', k: 4, jours: [J21] })));
    dit(r9.res === 'forme', 'l’écho du n° est celui d’un AUTRE colis ⇒ rejeté (forme)', `${r9.res} ${r9.forme}`);
    dit(lis(reponse(fragment({ sansEcho: true, k: 4, jours: [J21] }))).res === 'forme', 'aucun écho du n° dans le fragment ⇒ rejeté');
    const r10 = lis(reponse(fragment({ cp: '22000', k: 4, jours: [J21] })));
    dit(r10.res === 'forme', 'l’écho du code postal en dit un autre ⇒ rejeté', `${r10.res} ${r10.forme}`);
    dit(lis(reponse(fragment({ sansCp: true, k: 4, jours: [J21] }))).res === 'ok', 'écho du code postal absent, n° juste : `Success:true` prouve le couple ⇒ lu');
    dit(lis(reponse(DISPO), { cp: '' }).res === 'forme', 'sans code postal demandé, rien n’est accepté');
    dit(lis(CF_HTML, { statut: 403, ctype: 'text/html' }).res === 'bloque' && lis('{}', { statut: 429 }).res === 'bloque' && lis(CF_HTML, { statut: 200, ctype: 'text/html' }).res === 'bloque', '403, 429, une page HTML à la place du JSON ⇒ refus (bloque)');
    dit(lis('', { statut: 503 }).res === 'passu', 'une panne (503) ⇒ pas su');
    dit(lis(reponse(fragment({ sansFrise: true, jours: [J21] }))).res === 'forme' && lis(reponse(fragment({ k: 4, jours: [] }))).res === 'forme', 'sans frise, ou sans aucun évènement daté ⇒ forme');
    dit(T.lireReponse('mondialrelay', 200, 'application/json', reponse(RETIRE), { suivi: N1, cp: CP1, voie: 'mr-fr-mvc' }).etat === 'retire' && T.lireReponse('mondialrelay', 200, 'application/json', reponse(RETIRE), { suivi: N1, cp: CP1, voie: 'mr-be' }).res !== 'ok', 'la voie choisit la forme jugée : `mr-fr-mvc` (serveur) · `mr-be` (secours de l’extension)');
    dit(T.LECTURE_SERVEUR_TRANSP && T.LECTURE_SERVEUR_TRANSP.mondialrelay === true, 'le serveur lit Mondial Relay (`LECTURE_SERVEUR_TRANSP.mondialrelay`, la valeur que lit l’app aussi)');
    dit(T.lireReponse('mondialrelay', 200, 'application/json', reponse(fragment({ n: '30000099', k: 4, jours: [J21] })), { suivi: N1, cp: CP1, voie: 'mr-fr-mvc' }).res === 'forme', 'par `lireReponse` (l’entrée de C4) aussi, `mr-fr-mvc` exige l’écho : un autre n° ⇒ rejeté');
    dit(T.VOIE_SERVEUR && T.VOIE_SERVEUR.mondialrelay === 'mr-fr-mvc' && T.VOIE_DE.mondialrelay === 'mr-fr-mvc' && T.VOIES['mr-fr-mvc'] === 'mondialrelay' && T.VOIES['mr-be'] === 'mondialrelay', 'contrat : le serveur range `mr-fr-mvc` ; l’extension reçoit `mr-fr-mvc` (C3, la même route depuis le navigateur) ; C4 connaît `mr-fr-mvc` ET `mr-be`');
    const lb = T.ligneTransporteur({ suivi: N1, carrier: 'mondialrelay', essaiRes: 'bloque', essai: new Date().toISOString() }, 'mondialrelay');
    dit(/refuse/.test(lb.texte) && !/n'a pas répondu/.test(lb.texte), 'la carte d’un colis refusé au serveur dit « refuse », pas « n’a pas répondu »', lb.texte);
  });

  // ══ 2. LA VRAIE ROUTE (C5, C3, C4) ════════════════════════════════════════
  let route = null, L = null, O = null;
  await essaie('route api/relais.js', async () => {
    L = await importer('api/_lib/transporteurs-lecture.js');
    O = await importer('api/_lib/owner.js');
    if (typeof L._reglerPourBanc === 'function') L._reglerPourBanc({ ecartMs: 0 });
    route = (await importer('api/relais.js')).default;
    dit(typeof L.urlTransporteur === 'function' && /^https:\/\/www\.mondialrelay\.fr\/_mvc\/fr-FR\/SuiviExpedition\/RechercherJsonResponsive\?NumeroExpedition=30000004&CodePostal=35000$/.test(String(L.urlTransporteur('mondialrelay', N1, CP1) || '')), 'l’adresse lue : mondialrelay.fr `_mvc`, le n° et le code postal, rien d’autre', String(L.urlTransporteur('mondialrelay', N1, CP1)));
    dit(L.urlTransporteur('mondialrelay', N1, '') === null && L.urlTransporteur('mondialrelay', N1, '3500') === null && L.urlTransporteur('mondialrelay', N1, '35000&x=1') === null, 'sans code postal à 5 chiffres, AUCUNE adresse');
  });
  await essaie('passage : le serveur lit Mondial Relay', async () => {
    semer(); transporteur.length = 0; mvc = 'ok';
    const c30 = await appel(route, 'transp-a-lire', { methode: 'GET' });
    dit(c30.code === 200 && c30.corps && Array.isArray(c30.corps.items) && c30.corps.items.length === 0, 'avant toute lecture : C3 ne confie RIEN à l’extension (le serveur lit Mondial Relay lui-même)', JSON.stringify(c30.corps && c30.corps.items));
    const r = await appel(route, 'transp');
    dit(r.code === 200 && r.corps && r.corps.ok, 'C5 répond 200', `${r.code} ${JSON.stringify(r.corps).slice(0, 160)}`);
    const mr = transporteur.filter((x) => /mondialrelay/.test(x.hote));
    const lus = mr.filter((x) => x.n === N1);
    dit(lus.length === 1 && lus[0].hote === 'www.mondialrelay.fr' && lus[0].cp === CP1, 'le serveur interroge mondialrelay.fr `_mvc` pour le colis arrivé, avec le code postal du lieu de l’e-mail', mr.map((x) => x.url).join(' · ') || 'aucune requête');
    dit(mr.length > 0 && mr.every((x) => x.ua === 'VRM-suivi/1.0 (+https://vrm.center)' && !/mozilla|chrome|safari/i.test(x.ua)), 'User-Agent honnête de VRM, jamais celui d’un navigateur', mr.map((x) => x.ua).join(' | '));
    dit(mr.length > 0 && mr.every((x) => x.redirect === 'error' && x.xrw === 'XMLHttpRequest' && /json/.test(x.accept) && !x.cookie), 'aucune redirection suivie, ni cookie ; la requête dit ce qu’elle attend (JSON, XMLHttpRequest)');
    dit(!transporteur.some((x) => /mondialrelay\.be/.test(x.hote) || /\/api\/tracking/.test(x.chemin)), 'jamais l’API de mondialrelay.be (refusée au serveur, mesuré)');
    dit(!transporteur.some((x) => x.n === N2 || x.url.includes(N2)), 'un colis sans code postal connu : AUCUNE requête');
    dit(!transporteur.some((x) => x.url.includes(N3)), 'un colis qu’il a POSTÉ (son bordereau) n’est jamais lu');
    dit(ailleurs.length === 0, 'aucune autre adresse contactée', ailleurs.join(' · '));
    const l1 = ligneDe(N1);
    dit(!!l1 && l1.etat === 'disponible' && l1.essaiRes === 'ok' && l1.voie === 'mr-fr-mvc' && l1.source === 'serveur' && l1.cp === CP1 && !!l1.lu, 'la ligne `transp_` rangée : disponible, voie `mr-fr-mvc`, source serveur, code postal prouvé', l1 ? `${l1.etat}/${l1.essaiRes}/${l1.voie}/${l1.source}/${l1.cp}` : 'absente');
    const l2 = ligneDe(N2);
    dit(!!l2 && l2.essaiRes === 'cp-inconnu', 'le colis sans code postal : « code postal inconnu » noté (la carte donne le geste)', l2 ? l2.essaiRes : 'absente');
    const besoin = (r.corps && r.corps.besoinNavigateur) || [];
    dit(Array.isArray(besoin) && besoin.length === 0, 'lu par le serveur ⇒ RIEN pour le navigateur (`besoinNavigateur` vide)', JSON.stringify(besoin));
    const c3 = await appel(route, 'transp-a-lire', { methode: 'GET' });
    dit(c3.code === 200 && c3.corps && Array.isArray(c3.corps.items) && c3.corps.items.length === 0, 'C3 : rien à lire depuis le navigateur', JSON.stringify(c3.corps).slice(0, 160));
    // C4 : l'extension relaie la route `_mvc` lue depuis le navigateur — jugée
    // par le MÊME analyseur, écho exigé ; une voie inconnue est refusée.
    const c4x = await appel(route, 'transp-brut', { corps: { v: 1, carrier: 'mondialrelay', suivi: N1, cp: CP1, voie: 'mr-fr-mvc', statut: 200, ctype: 'application/json', corps: reponse(fragment({ n: '30000099', k: 5, jours: [J22, J21, J20, J18, J17] })) } });
    const l1x = ligneDe(N1);
    dit(c4x.code === 200 && c4x.corps && c4x.corps.res === 'forme' && !!l1x && l1x.etat === 'disponible' && l1x.essaiRes === 'forme', 'C4 `mr-fr-mvc` dont l’écho est celui d’un AUTRE colis ⇒ rejeté (forme), l’état reste « disponible »', `${c4x.code} ${JSON.stringify(c4x.corps)} · ${l1x ? l1x.etat + '/' + l1x.essaiRes : 'absente'}`);
    const c4 = await appel(route, 'transp-brut', { corps: { v: 1, carrier: 'mondialrelay', suivi: N1, cp: CP1, voie: 'mr-fr-mvc', statut: 200, ctype: 'application/json', corps: reponse(RETIRE) } });
    const l1c = ligneDe(N1);
    dit(c4.code === 200 && c4.corps && c4.corps.res === 'ok' && c4.corps.etat === 'retire' && !!l1c && l1c.voie === 'mr-fr-mvc' && l1c.essaiSource === 'extension' && l1c.etat === 'retire', 'C4 accepte la route `_mvc` relayée par l’extension (`mr-fr-mvc`), jugée par le même analyseur, rangée avec SA voie', `${c4.code} ${JSON.stringify(c4.corps)} · ${l1c ? l1c.voie + '/' + l1c.essaiSource + '/' + l1c.etat : 'absente'}`);
    const c4v = await appel(route, 'transp-brut', { corps: { v: 1, carrier: 'mondialrelay', suivi: N1, cp: CP1, voie: 'mr-fr-autre', statut: 200, ctype: 'application/json', corps: reponse(DISPO) } });
    const c4w = await appel(route, 'transp-brut', { corps: { v: 1, carrier: 'mondialrelay', suivi: N1, cp: CP1, voie: 'cp-ws2', statut: 200, ctype: 'application/json', corps: reponse(DISPO) } });
    dit(c4v.code === 400 && c4v.corps && c4v.corps.error === 'voie' && c4w.code === 400 && c4w.corps && c4w.corps.error === 'voie', 'C4 refuse une voie inconnue, ou celle d’un autre transporteur (400 `voie`)', `${c4v.code} ${JSON.stringify(c4v.corps)} · ${c4w.code}`);
    // Un code postal ESSAYÉ (un autre colis de ce vendeur l'a prouvé) : « pas de
    // colis pour ce couple » n'est PAS « n° inconnu ».
    transporteur.length = 0;
    await O.contexteVendeur.run({ owner: A }, async () => { await L.passageTransporteurs({ max: 6, budgetMs: 12000, maintenant: Date.now() + 7 * 3600000 }); });
    const e2 = transporteur.filter((x) => x.n === N2);
    const l2b = ligneDe(N2);
    dit(e2.length === 1 && e2[0].cp === CP1, 'plus tard : le colis sans code postal est ESSAYÉ avec un code postal prouvé chez ce vendeur', e2.map((x) => x.url).join(' · ') || 'aucune requête');
    dit(!!l2b && l2b.essaiRes === 'cp-inconnu' && String(l2b.cpEssayes || '').split(',').includes(CP1) && l2b.essaiRes !== 'introuvable', '`Success:false` sur un code postal ESSAYÉ ⇒ « code postal inconnu » (l’essai noté), jamais « introuvable » (qui fermerait le n°)', l2b ? `${l2b.essaiRes} essayés=${l2b.cpEssayes}` : 'absente');
  });
  await essaie('passage : Mondial Relay refuse le serveur', async () => {
    semer(); transporteur.length = 0; mvc = '403';
    const r = await appel(route, 'transp');
    const besoin = (r.corps && r.corps.besoinNavigateur) || [];
    dit(r.code === 200 && besoin.some((b) => b.carrier === 'mondialrelay' && b.suivi === N1 && b.cp === CP1 && b.voie === 'mr-fr-mvc'), 'refusé (403) ⇒ le n° part au navigateur, avec son code postal, par la route `_mvc` (`mr-fr-mvc`, la voie que l’extension lit d’abord)', JSON.stringify(besoin));
    const p = base.get('00000000-0000-0000-0000-000000000000|transp_pause') || base.get(`${A}|transp_pause`);
    dit(!!(p && p.mondialrelay && Date.parse(p.mondialrelay.jusqua) > Date.now()), 'la pause de Mondial Relay est posée', JSON.stringify(p || null));
    const l1 = ligneDe(N1);
    dit(!!l1 && l1.essaiRes === 'bloque' && l1.voie === 'mr-fr-mvc', 'la ligne dit le refus (`bloque`), voie du serveur', l1 ? `${l1.essaiRes}/${l1.voie}` : 'absente');
    const c3 = await appel(route, 'transp-a-lire', { methode: 'GET' });
    const it = (c3.corps && c3.corps.items) || [];
    dit(c3.code === 200 && it.length === 1 && it[0].suivi === N1 && it[0].cp === CP1 && it[0].voie === 'mr-fr-mvc', 'C3 liste ce colis (refusé) pour l’extension, et lui seul', JSON.stringify(it));
    transporteur.length = 0;
    // Un AUTRE colis Mondial Relay arrive pendant la pause : jamais lu par le
    // serveur tant qu'elle dure — confié au navigateur.
    const h = new Date(Date.now() - 600000).toISOString();
    base.set(`${A}|email_track_mondialrelay_${N4}`, { suivi: N4, carrier: 'mondialrelay', status: 'available', sens: 'entrant', subject: 'Ton colis est disponible', receivedAt: h, emailAt: h, lieu: `AUTRE RELAIS ${CP1} VILLEXEMPLE` });
    const r2 = await appel(route, 'transp');
    dit(!transporteur.some((x) => /mondialrelay/.test(x.hote)), 'pendant la pause : AUCUNE requête à Mondial Relay (le colis arrivé entre-temps compris)', transporteur.map((x) => x.url).join(' · '));
    dit(((r2.corps && r2.corps.besoinNavigateur) || []).some((b) => b.suivi === N4 && b.cp === CP1 && b.voie === 'mr-fr-mvc'), 'pendant la pause : le nouveau colis est confié au navigateur, avec son code postal', JSON.stringify(r2.corps && r2.corps.besoinNavigateur));
    dit(((r2.corps && r2.corps.besoinNavigateur) || []).some((b) => b.suivi === N1 && b.voie === 'mr-fr-mvc'), 'pendant la pause : le n° reste confié au navigateur');
    // L'extension relaie SON refus (C4, voie `mr-fr-mvc`) : son essai suit le
    // recul, elle ne relit pas le n° à chaque passage.
    const c4 = await appel(route, 'transp-brut', { corps: { v: 1, carrier: 'mondialrelay', suivi: N1, cp: CP1, voie: 'mr-fr-mvc', statut: 403, ctype: 'text/html', corps: CF_HTML } });
    const l1b = ligneDe(N1);
    dit(c4.code === 200 && !!l1b && l1b.essaiRes === 'bloque' && l1b.essaiSource === 'extension', 'C4 : le refus relayé par l’extension est rangé comme SON essai', `${c4.code} ${l1b ? l1b.essaiRes + '/' + l1b.essaiSource : 'absente'}`);
    base.delete(`${A}|transp_pause`); base.delete('00000000-0000-0000-0000-000000000000|transp_pause');
    if (typeof L !== 'undefined' && L && typeof L._oublierPauseInstance === 'function') L._oublierPauseInstance();
    const c3b = await appel(route, 'transp-a-lire', { methode: 'GET' });
    dit(c3b.code === 200 && Array.isArray(c3b.corps.items) && !c3b.corps.items.some((x) => x.suivi === N1), 'après le refus relayé par l’extension (pause levée) : pas relu aussitôt — le recul s’applique à elle aussi', JSON.stringify(c3b.corps && c3b.corps.items));
  });

  // ══ 3. L'APP : LA PHRASE SUIT LE SERVEUR ═══════════════════════════════════
  await essaie('app : la phrase suit la lecture du serveur', async () => {
    const parser = require(path.join(R, 'node_modules', '@babel', 'parser'));
    const esbuild = require(path.join(R, 'node_modules', 'esbuild'));
    const React = require(path.join(R, 'node_modules', 'react'));
    const RDS = require(path.join(R, 'node_modules', 'react-dom', 'server'));
    const src = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
    const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
    const morceaux = {};
    for (const n of ast.program.body) {
      if (n.type === 'FunctionDeclaration' && n.id && ['LigneTransporteur', 'TeteTransporteurs'].includes(n.id.name)) morceaux[n.id.name] = src.slice(n.start, n.end);
      if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id && d.id.name === 'ligneTranspDe') morceaux.ligneTranspDe = 'const ' + src.slice(d.start, d.end) + ';';
    }
    // La promesse sous « N° de suivi ajoutés » : l'élément qui porte data-suivi-promesse.
    let promesse = null;
    (function marche(nd) {
      if (!nd || typeof nd !== 'object' || promesse) return;
      if (nd.type === 'JSXElement' && nd.openingElement.attributes.some((a) => a.type === 'JSXAttribute' && a.name && a.name.name === 'data-suivi-promesse')) { promesse = src.slice(nd.start, nd.end); return; }
      for (const k of Object.keys(nd)) { if (k === 'loc' || k === 'start' || k === 'end') continue; const v = nd[k]; if (Array.isArray(v)) v.forEach(marche); else if (v && typeof v === 'object' && v.type) marche(v); }
    })(ast.program);
    dit(!!morceaux.LigneTransporteur && !!morceaux.TeteTransporteurs && !!morceaux.ligneTranspDe && !!promesse, 'les composants de l’app sont lus (LigneTransporteur, TeteTransporteurs, la promesse)');
    const code = [morceaux.ligneTranspDe, morceaux.LigneTransporteur, morceaux.TeteTransporteurs, `const __promesse = () => (${promesse});`, 'this.LigneTransporteur = LigneTransporteur; this.TeteTransporteurs = TeteTransporteurs; this.__promesse = __promesse;'].join('\n');
    const js = esbuild.transformSync(code, { loader: 'jsx', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment' }).code;
    const { normaliserSuivi } = await importer('api/_lib/etat-colis-email.js');
    // La version à installer est celle que l'app tient pour `transp` (EXT_CAPACITES) : lue dans
    // la source, jamais recopiée (une montée de version ne fait pas mentir l'audit).
    const vTransp = ((/const EXT_CAPACITES\s*=\s*\{[^}]*\btransp:\s*'([0-9.]+)'/.exec(src)) || [])[1] || '?';
    const etat = { ext: 'absente', tel: true };
    const ctx = { React, C: { muted: '#777', warn: '#a60', text: '#111', border: '#ccc', card: '#fff' }, extSait: () => etat.ext, useSansSouris: () => etat.tel, vmrExtPresent: () => !etat.tel,
      normaliserSuivi, carrierLisible: T.carrierLisible, carrierNonLu: T.carrierNonLu, ligneTransporteur: T.ligneTransporteur, nomTransporteur: T.nomTransporteur, LECTURE_SERVEUR_TRANSP: T.LECTURE_SERVEUR_TRANSP, EXT_CAPACITES: { transp: vTransp }, Map, Set, Array, String, Number, Math, Object };
    vm.createContext(ctx); vm.runInContext(js, ctx);
    const rend = (el) => RDS.renderToStaticMarkup(el);
    const colis = [{ carrier: 'Mondial Relay', suivi: N1 }];
    const DIT_ORDINATEUR = /ne se lit que depuis ton ordinateur/;
    for (const [ext, tel, nom] of [['absente', true, 'iPhone sans extension'], ['retard', false, 'ordinateur, extension en retard'], ['ok', false, 'ordinateur, extension à jour']]) {
      etat.ext = ext; etat.tel = tel;
      const h = rend(React.createElement(ctx.TeteTransporteurs, { transp: new Map(), colis, relire: () => {} }));
      dit(!DIT_ORDINATEUR.test(h) && !/data-transp-mr=/.test(h), `en tête (${nom}) : plus jamais « Mondial Relay ne se lit que depuis ton ordinateur » — le serveur le lit`, h.slice(0, 160) || '(rien)');
      const c = rend(React.createElement(ctx.LigneTransporteur, { transp: new Map(), suivi: N1, carrier: 'Mondial Relay' }));
      dit(/data-transp="jamais"/.test(c) && /pas encore lu/.test(c), `la carte (${nom}) dit « pas encore lu chez le transporteur », comme pour les autres`, c.slice(0, 160) || '(rien)');
    }
    const refuse = new Map([[N1, { suivi: N1, carrier: 'mondialrelay', essaiRes: 'bloque', essai: new Date().toISOString() }]]);
    const deux = [...colis, { carrier: 'Mondial Relay', suivi: '30000004' }];   // le même n° deux fois : compté une fois
    etat.ext = 'ok'; etat.tel = false;
    let h = rend(React.createElement(ctx.TeteTransporteurs, { transp: refuse, colis: deux, relire: () => {} }));
    dit(/data-transp-mr-refus="ok"/.test(h) && /data-transp-mr-n="1"/.test(h) && /extension VRM de ce Chrome/.test(h), 'refus du serveur, extension à jour ici : dit UNE fois, compté par n°, « l’extension de ce Chrome les lit à la place »', h.slice(0, 220));
    dit((h.match(/data-transp-mr-refus=/g) || []).length === 1, 'la phrase du refus n’est écrite qu’une fois');
    etat.ext = 'retard';
    h = rend(React.createElement(ctx.TeteTransporteurs, { transp: refuse, colis, relire: () => {} }));
    dit(/data-transp-mr-refus="retard"/.test(h) && vTransp !== '?' && h.includes(vTransp), `refus du serveur, extension en retard : le geste nomme la version à installer (${vTransp})`, h.slice(0, 220));
    etat.ext = 'absente'; etat.tel = true;
    h = rend(React.createElement(ctx.TeteTransporteurs, { transp: refuse, colis, relire: () => {} }));
    dit(/data-transp-mr-refus="telephone"/.test(h) && /ordinateur où elle est installée/.test(h) && !/mets à jour/.test(h), 'refus du serveur, sur le téléphone : le geste se fait sur l’ordinateur (pas « mets à jour » ici)', h.slice(0, 220));
    const lu = new Map([[N1, { suivi: N1, carrier: 'mondialrelay', etat: 'disponible', lu: new Date().toISOString(), essaiRes: 'ok', libelle: '5 jours restants pour retirer le colis en Point Relais', etatAt: new Date().toISOString() }]]);
    etat.ext = 'ok'; etat.tel = false;
    h = rend(React.createElement(ctx.TeteTransporteurs, { transp: lu, colis, relire: () => {} }));
    dit(h === '', 'lu par le serveur : rien en tête de liste (aucune phrase de plus)', h.slice(0, 160));
    const p = rend(ctx.__promesse());
    dit(!/depuis ton ordinateur/.test(p) && /code postal du point relais/.test(p), 'la promesse sous « N° de suivi ajoutés » ne renvoie plus à l’ordinateur pour Mondial Relay', p.replace(/<[^>]+>/g, '').slice(0, 220));
  });

  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ Mondial Relay est lu par le serveur (route `_mvc`), l’extension n’est qu’un secours, et l’app le dit.');
  process.exit(ko ? 1 : 0);
})();
