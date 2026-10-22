// ════════════════════════════════════════════════════════════════════════════
//  La porte de confidentialité (src/PorteConfidentialite.jsx) ferme l'app tant
//  que `/api/compte?mode=confidentialite` ne répond pas `{ok:true, uid}` avec
//  l'uid de la session — elle échoue FERMÉE, c'est voulu, et on n'y touche pas.
//  La plupart des bancs servent un faux `/api/**` qui ne connaît pas cette
//  route : le cœur de l'app n'était plus jamais monté (rouges sur main depuis
//  ba317a6). Ce crochet répond, DANS LA PAGE, ce que répondrait un serveur
//  sain — `{ok:true, uid: <id de la session rangée>}` — et seulement si :
//   · le jeton envoyé est bien celui de la session rangée par l'app ;
//   · la réponse du banc ne tranche pas elle-même (un banc qui sert `ok:false`,
//     une `raison` ou le bon uid garde SA réponse : confidentialite.cjs teste
//     les refus, il doit continuer de les voir).
//
//  ⚠️ Et l'« accès direct » sans compte (`vrm_acces_direct`, code d'accès) a été
//  RETIRÉ de l'app pour l'isolation des boutiques (439081d) : une centaine de
//  bancs l'utilisaient encore et restaient sur l'écran de connexion. Quand un
//  banc pose ce drapeau sans session, on range à la place une session de banc
//  (un vendeur fictif, base NON cloisonnée — ce que servent ces bancs), et on
//  répond à `/auth/v1/*` pour CETTE session seulement. Un banc qui range sa
//  propre session garde la sienne.
//  Pour CETTE session seulement, la base servie est traduite en base cloisonnée
//  (la production l'est : l'app filtre toujours `owner=eq.` et exige que chaque
//  ligne de `main` porte SON owner, 439081d) : la sonde `select=owner&limit=1`
//  répond la colonne, `select=owner,data` est demandé au banc en `select=data`,
//  et chaque ligne rendue reçoit l'owner de la session — l'ancien « accès
//  direct » voulait dire « toutes les lignes sont à moi », c'est la même chose.
//  Posé une fois sur `playwright` (chromium.launch / launchPersistentContext) ;
//  `BANC_PORTE_STRICTE=1` le retire pour juger la porte elle-même.
// ════════════════════════════════════════════════════════════════════════════
const SCRIPT = `(() => {
  if (window.__vrmPorteBanc) return; window.__vrmPorteBanc = true;
  const SESS_BANC = { access_token: 'jeton-de-banc-direct', refresh_token: 'r', totp: [], expires_at: Date.now() + 864e5, user: { id: '__UID_BANC__', email: 'banc@vrm.test', totp: [] } };
  const ls = window.localStorage; const poserSess = () => {
    try { if (ls.getItem('vrm_acces_direct') === '1' && !ls.getItem('vrm_session')) { Storage.prototype.setItem.call(ls, 'vrm_session', JSON.stringify(SESS_BANC)); Storage.prototype.setItem.call(ls, 'vrm_local_owner', SESS_BANC.user.id); } } catch (_) {}
  };
  try { const si = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { si.call(this, k, v); if (this === ls && k === 'vrm_acces_direct') poserSess(); }; } catch (_) {}
  poserSess();
  // Un appareil où CE vendeur a déjà travaillé porte son identité : sans elle,
  // l'app efface les réglages de l'appareil comme pour un autre vendeur (voulu).
  const poserProprio = () => { try { const c = JSON.parse(ls.getItem('vrm_session') || 'null'); if (c && c.user && c.user.id && !ls.getItem('vrm_local_owner')) Storage.prototype.setItem.call(ls, 'vrm_local_owner', c.user.id); } catch (_) {} };
  try { const si2 = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { si2.call(this, k, v); if (this === ls && k === 'vrm_session') poserProprio(); }; } catch (_) {}
  poserProprio();
  const vrai = window.fetch.bind(window);
  window.fetch = async function (entree, init) {
    const url = typeof entree === 'string' ? entree : (entree && entree.url) || '';
    if (url.indexOf('/auth/v1/') >= 0) {
      let cur = null; try { cur = JSON.parse(ls.getItem('vrm_session') || 'null'); } catch (_) {}
      if (cur && cur.access_token === SESS_BANC.access_token) return new Response(JSON.stringify(url.indexOf('/auth/v1/user') >= 0 ? cur.user : { access_token: cur.access_token, refresh_token: 'r', expires_in: 86400, user: cur.user }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.indexOf('/rest/v1/') >= 0 && typeof entree === 'string') {
      let cur = null; try { cur = JSON.parse(ls.getItem('vrm_session') || 'null'); } catch (_) {}
      const meth = String((init && init.method) || 'GET').toUpperCase();
      const uid = cur && cur.user && cur.user.id;
      const synth = !!(cur && cur.access_token === SESS_BANC.access_token);
      if (uid && meth === 'GET') {
        if (synth && /[?&]select=owner&limit=1(&|$)/.test(url)) return new Response(JSON.stringify([{ owner: uid }]), { status: 200, headers: { 'content-type': 'application/json' } });
        // Lecture filtrée sur CET owner : un vrai PostgREST ne rendrait que ses
        // lignes, toutes à lui — celles qui n'en disent rien reçoivent son owner.
        const filtre = url.indexOf('owner=eq.' + encodeURIComponent(uid)) >= 0 || url.indexOf('owner=eq.' + uid) >= 0;
        if (filtre) {
          let r = await vrai(synth ? url.replace(/([?&]select=)owner,/, '$1') : url, init);
          // Un banc d'avant le 21 oct. répond 400 à tout « select=owner… » (sa sonde) :
          // la ligne lue avec l'owner se redemande sans lui.
          if (r.status === 400 && /[?&]select=owner,/.test(url)) r = await vrai(url.replace(/([?&]select=)owner,/, '$1'), init);
          let j = null; try { j = await r.clone().json(); } catch (_) { return r; }
          if (!r.ok || !Array.isArray(j)) return r;
          const rows = j.map((o) => (o && typeof o === 'object' && !Array.isArray(o) && (o.owner == null) ? Object.assign({}, o, { owner: uid }) : o));
          return new Response(JSON.stringify(rows), { status: r.status, headers: r.headers });
        }
      }
    }
    if (url.indexOf('mode=confidentialite') < 0) return vrai(entree, init);
    let s = null; try { s = JSON.parse(localStorage.getItem('vrm_session') || 'null'); } catch (_) {}
    const h = (init && init.headers) || {};
    const auth = (typeof h.get === 'function' ? h.get('Authorization') : (h.Authorization || h.authorization)) || '';
    const uid = s && s.user && s.user.id;
    const memeJeton = !!(s && s.access_token && auth === 'Bearer ' + s.access_token);
    let r = null, j = null;
    try { r = await vrai(entree, init); j = await r.clone().json(); } catch (_) {}
    const tranche = j && (j.ok === false || j.raison || (j.ok === true && j.uid));
    if (tranche || !uid || !memeJeton) return r || vrai(entree, init);
    return new Response(JSON.stringify({ ok: true, uid }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
})();`;
function poser(pw) {
  if (!pw || !pw.chromium || pw.chromium.__vrmPorte || process.env.BANC_PORTE_STRICTE === '1') return;
  const c = pw.chromium; c.__vrmPorte = true;
  // BANC_TRACE=1 : chaque réponse /rest/v1 ou /api en erreur est imprimée (diagnostic).
  const tracer = (ctx) => { if (process.env.BANC_TRACE !== '1') return; ctx.on('response', (r) => { const u = decodeURIComponent(r.url()); if (/\/rest\/v1\/|\/api\//.test(u) && (r.status() >= 400 || process.env.BANC_TRACE_TOUT)) console.log('TRACE', r.status(), u.slice(0, 200)); }); ctx.on('requestfailed', (r) => { if (/\/rest\/v1\/|\/api\//.test(r.url())) console.log('TRACE échec', r.url().slice(0, 200)); }); };
  // BANC_SESSION_UID : un banc qui déclare SON vendeur (owner explicite sur ses lignes) le donne ici.
  const script = () => SCRIPT.replace('__UID_BANC__', process.env.BANC_SESSION_UID || '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b');
  const surContexte = (ctx) => { try { ctx.addInitScript(script()); tracer(ctx); } catch (_) {} return ctx; };
  // Un banc écrit sur une autre machine vise parfois /usr/bin/chromium : absent,
  // on prend le Chromium installé ici (même moteur, rien d'autre ne change).
  const fs = require('fs'); const ICI = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const chemin = (o) => { if (o && o.executablePath && !fs.existsSync(o.executablePath) && fs.existsSync(ICI)) return Object.assign({}, o, { executablePath: ICI }); return o; };
  const launch0 = c.launch.bind(c); const launch = (o, ...r) => launch0(chemin(o), ...r);
  c.launch = async (...a) => {
    const b = await launch(...a);
    const nc = b.newContext.bind(b), np = b.newPage.bind(b);
    b.newContext = async (...x) => surContexte(await nc(...x));
    b.newPage = async (...x) => { const p = await np(...x); try { await p.addInitScript(script()); } catch (_) {} return p; };
    return b;
  };
  const lpc = c.launchPersistentContext.bind(c);
  c.launchPersistentContext = async (d, o, ...r) => surContexte(await lpc(d, chemin(o), ...r));
}
try { poser(require('playwright')); } catch (_) {}
module.exports = { SCRIPT_PORTE_BANC: SCRIPT, poserPorteBanc: poser };
