// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DU SUIVI LU CHEZ LES TRANSPORTEURS (5.290) — node scripts/audit-transp-ext.cjs
//  Julien, 24 octobre : « tu as juste à regarder sur le site du transporteur,
//  je ne te demande pas le code de retrait mais juste de regarder le statut ».
//
//  Le VRAI `background.js` dans un `vm` (`_fond-vm.cjs`) : un faux transporteur
//  (Mondial Relay, Chronopost, Vinted Go) qui note chaque requête, un faux VRM
//  (C3 `transp-a-lire`, C4 `transp-brut`, C5 `transp`), l'API `permissions`, un
//  faux Vinted qui compte les siennes. On juge ce qui PART (adresses, en-têtes,
//  ordre, écarts) et ce qui est RELAYÉ (corps tel quel, borné), jamais une phrase :
//    · sans session VRM, ou sans permission : AUCUNE requête (ni VRM, ni site) ;
//    · seuls les n° de C3 sont lus (6 au plus, forme vérifiée), un à la fois,
//      2 s d'écart FIXE, l'adresse exacte de la liste blanche ;
//    · Vinted n'est jamais touché : ni requête, ni budget, ni pause — et une
//      pause Vinted n'arrête pas la lecture d'un transporteur ;
//    · 12 requêtes par heure et par transporteur au plus ;
//    · pause sur 403, 429, défi, HTML au lieu de JSON/XML, 401 Mondial Relay :
//      30 min, palier qui monte, `Retry-After` respecté, levée au succès ;
//    · aucune autre adresse que la liste blanche ;
//    · corps relayé TEL QUEL et borné (64 Ko, POST ≤ 80 Ko) ;
//    · `transpVu` : le n° vient de `sender.url`, jamais du message ; mauvais
//      site refusé ; une fois par n° toutes les 5 min.
//  `--src chemin` : la preuve sur le code d'AVANT (§6.1).
//  `--mutation NOM` : réaffaiblit une règle (dans une copie) ; `--prouve` les
//  joue toutes et exige que chacune fasse rougir l'audit.
//  Aucune donnée réelle (le dépôt est public) : n°, codes postaux, corps inventés
//  à la FORME mesurée.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { execFileSync } = require('child_process');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');

// ── LES MUTATIONS (§6.1 : un contrôle doit attraper la RÈGLE fautive) ────────
const MUTATIONS = {
  // « passe par requeteVinted » : la lecture d'un transporteur prise dans la file Vinted.
  requeteVinted: ["const r = await fetch(url, Object.assign({}, init, { signal: ctrl.signal, redirect: 'error', cache: 'no-store' }));",
    "const r = await requeteVinted('transp', () => fetch(url, Object.assign({}, init, { signal: ctrl.signal, redirect: 'error', cache: 'no-store' })));"],
  // « pause ignorée »
  pause: ["if (await pauseTransp(voie)) return { echec: 'pause' };", ''],
  // « n° pris dans le message »
  message: ['const vu = transpDeAdresse(sender.url || sender.tab.url);',
    "const vu = (msg && msg.suivi) ? { carrier: String(msg.carrier || ''), suivi: String(msg.suivi), cp: String(msg.cp || '') } : transpDeAdresse(sender.url || sender.tab.url);"],
  // « autre hôte permis »
  hote: ["const urlTranspPermise = (u) => TRANSP_URL_PERMISES.some((re) => re.test(String(u || '')));", 'const urlTranspPermise = (u) => /^https:\\/\\//.test(String(u || \'\'));'],
  // permission ignorée
  permission: ['if (!Object.values(permis).some(Boolean)) { noterDiag(\'transp_sans_permission\'); return { saute: \'permission\' }; }', ''],
  // budget sans plafond
  budget: ['const TRANSP_MAX_HEURE = 12;', 'const TRANSP_MAX_HEURE = 100000;'],
  // écart fixe retiré
  ecart: ['if (_transpDernierA && reste > 0) await dormirTransp(reste);', ''],
  // corps non borné
  borne: ['const TRANSP_CORPS_MAX = 65536;', 'const TRANSP_CORPS_MAX = 1e9;'],
  // sans session
  session: ["  const s0 = await loadSession();\n  if (!s0 || s0.mort || !(s0.access_token || s0.refresh_token)) return { saute: 'session' };", ''],
  // deux à la fois
  file: ['function unTranspALaFois(fn) {\n  const suite = _chaineTransp.then(() => fn(), () => fn());', 'function unTranspALaFois(fn) {\n  const suite = Promise.resolve().then(() => fn());'],
  // un défi Cloudflare pris pour une réponse
  defi: ["  if (rep && rep.cfMitigated) return 'defi';", ''],
  // (tour 2 n° 11) « lu » compté sur un 2xx du transporteur, quoi qu'ait jugé le serveur
  'lu-sans-jugement': ["    if (j.res === 'ok') noterDiag(`transp_lu_${it.carrier}`);", "    if (rep && rep.statut >= 200 && rep.statut < 300) noterDiag(`transp_lu_${it.carrier}`);"],
  // (tour 2 n° 10) la forme Vinted Go du serveur oubliée par l'extension
  'forme-vg-12': ['  vinted: /^(?:\\d{16}|VGS\\d{13}|[0-9A-Z]{13}|\\d{12})$/,', '  vinted: /^(?:\\d{16}|VGS\\d{13}|[0-9A-Z]{13})$/,'],
};

const argv = process.argv;
const iMut = argv.indexOf('--mutation');
const MUT = iMut > 0 ? argv[iMut + 1] : '';
const PROUVE = argv.includes('--prouve');

if (PROUVE) {
  let tient = 0, rate = 0;
  for (const nom of Object.keys(MUTATIONS)) {
    let rouge = false, sortie = '';
    try { sortie = execFileSync(process.execPath, [__filename, '--mutation', nom].concat(argv.includes('--src') ? ['--src', argv[argv.indexOf('--src') + 1]] : []), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { rouge = true; sortie = String(e.stdout || ''); }
    const n = (sortie.match(/^❌/gm) || []).length;
    if (rouge && n > 0) { tient++; console.log(`✅ mutation « ${nom} » : ${n} rouge(s)`); }
    else { rate++; console.log(`❌ mutation « ${nom} » : l'audit reste VERT — la règle n'est pas gardée`); }
  }
  console.log(`\n${tient} mutation(s) attrapée(s) sur ${Object.keys(MUTATIONS).length}.`);
  process.exit(rate ? 1 : 0);
}

let SRC = cheminSource();
if (MUT) {
  const m = MUTATIONS[MUT];
  if (!m) { console.log(`❌ mutation inconnue « ${MUT} »`); process.exit(2); }
  const texte = fs.readFileSync(SRC, 'utf8');
  if (!texte.includes(m[0])) { console.log(`❌ mutation « ${MUT} » : le texte visé est introuvable (le code a changé, l'ancre aussi)`); process.exit(1); }
  const dest = path.join(os.tmpdir(), `audit-transp-ext-${MUT}-${process.pid}.js`);
  fs.writeFileSync(dest, texte.replace(m[0], m[1]));
  SRC = dest;
  console.log(`⚠️  MUTATION « ${MUT} » : des contrôles doivent rougir.\n`);
}

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det !== undefined ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// ── LES FORMES MESURÉES, AVEC DES VALEURS INVENTÉES ─────────────────────────
const MR = '12345678', MR2 = '87654321', CP_MR = '35260';
const CP = 'XW000000001TS', CP2 = 'XW000000002TS';
const VG = '1234567890123456', VG2 = 'VGS0000000000001';
const JETON_MR = 'QUFBQUFBQUE:QkJCQkJCQkI';
const PAGE_MR = `<!doctype html><html><head><title>Suivi de colis</title></head><body><div class="suivi" id="tracking" data-langue="fr" token="${JETON_MR}"></div></body></html>`;
const JSON_MR = JSON.stringify({ Numero: MR, CodePostal: CP_MR, Evenements: [{ Libelle: 'Colis disponible au Point Relais — Épicerie inventée', Date: '2026-10-20T10:00:00' }] });
const JSON_MVC = JSON.stringify({ Success: true, Message: null, Data: { NumeroExpedition: MR, Evenements: [{ Libelle: 'Pris en charge' }] } });
const XML_CP = `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns1:trackSkybillV2Response xmlns:ns1="http://cxf.tracking.soap.chronopost.fr/"><return><errorCode>0</errorCode><listEventInfoComp><events><eventLabel>Colis livré — à l'expéditeur (é, ü, 漢)</eventLabel></events></listEventInfoComp><skybillNumber>${CP}</skybillNumber></return></ns1:trackSkybillV2Response></soap:Body></soap:Envelope>`;
const JSON_VG = JSON.stringify({ tracking_number: VG, events: [{ group: 'in_transit', title: 'En route' }] });
const ENTETES = {
  html: { 'content-type': 'text/html; charset=utf-8' },
  json: { 'content-type': 'application/json; charset=utf-8' },
  xml: { 'content-type': 'text/xml;charset=UTF-8' },
};
const URL_MR_API = (n = MR, c = CP_MR) => `https://www.mondialrelay.be/api/tracking?shipment=${n}&postcode=${c}&brand=&codePays=`;
const URL_MR_PAGE = 'https://www.mondialrelay.be/fr-be/suivi-de-colis/';
const URL_MVC = (n = MR, c = CP_MR) => `https://www.mondialrelay.fr/_mvc/fr-FR/SuiviExpedition/RechercherJsonResponsive?NumeroExpedition=${n}&CodePostal=${c}`;
const URL_CP = (n = CP) => `https://ws.chronopost.fr/tracking-cxf/TrackingServiceWS/trackSkybillV2?language=fr_FR&skybillNumber=${n}`;
const URL_VG = (n = VG) => `https://carrier.vintedgo.com/public/v3/tracking_events/${n}`;

// Un transporteur qui répond comme mesuré, sauf ce que `sur` remplace par adresse.
function transporteurFaux(sur = {}) {
  return (req) => {
    for (const cle of Object.keys(sur)) if (req.url.startsWith(cle)) { const r = sur[cle]; return typeof r === 'function' ? r(req) : r; }
    if (req.url === URL_MR_PAGE) return { status: 200, body: PAGE_MR, headers: ENTETES.html };
    if (req.url.startsWith('https://www.mondialrelay.be/api/tracking')) {
      if (req.headers.RequestVerificationToken !== JETON_MR) return { status: 400, body: '{"error":"jeton"}', headers: ENTETES.json };
      return { status: 200, body: JSON_MR, headers: ENTETES.json };
    }
    if (req.url.startsWith('https://www.mondialrelay.fr/_mvc/')) return { status: 200, body: JSON_MVC, headers: ENTETES.json };
    if (req.url.startsWith('https://ws.chronopost.fr/')) return { status: 200, body: XML_CP, headers: ENTETES.xml };
    if (req.url.startsWith('https://carrier.vintedgo.com/')) return { status: 200, body: JSON_VG, headers: ENTETES.json };
    return { status: 404, body: '' };
  };
}
const ITEM = {
  mr: { carrier: 'mondialrelay', suivi: MR, cp: CP_MR, voie: 'mr-be' },
  cp: { carrier: 'chronopost', suivi: CP, cp: null, voie: 'cp-ws2' },
  vg: { carrier: 'vinted', suivi: VG, cp: null, voie: 'vg-v3' },
};
const SESSION = { access_token: 'jeton.vrm.transp', refresh_token: 'rt-transp', expires_at: Date.now() + 3600e3, user_id: '0d0d0d0d-0000-4000-8000-00000000000a', email: 'banc@exemple.fr' };

function monter({ items = [], session = true, permis = true, store = {}, sur = {}, vrm = {}, onglets } = {}) {
  const st = JSON.parse(JSON.stringify(store));
  if (session === true) st.vrmSession = SESSION;
  else if (session === 'morte') st.vrmSession = Object.assign({}, SESSION, { mort: true });
  else st.__sansSession = true;
  const brut = [];
  const fauxVrm = (req) => {
    if (vrm.reseau && vrm.reseau[req.mode]) return { reseau: true };
    if (req.mode === 'transp-a-lire') return vrm.aLire || { status: 200, body: { v: 1, items, pause: {} } };
    if (req.mode === 'transp-brut') { brut.push(req.corps); const r = typeof vrm.brut === 'function' ? vrm.brut(req) : vrm.brut; return r || { status: 200, body: { ok: true, res: vrm.res || 'ok', etat: 'transit', change: !!vrm.change } }; }
    if (req.mode === 'transp') return typeof vrm.transp === 'function' ? vrm.transp(req) : { status: 200, body: { ok: true, lus: [], besoinNavigateur: [], pause: {} } };
    return { status: 404, body: { error: 'introuvable' } };
  };
  // `permis: 'absente'` : l'API des permissions n'existe pas dans ce navigateur.
  const f = faireFond({ src: SRC, store: st, permis: permis === 'absente' ? undefined : permis, transporteur: transporteurFaux(sur), vrm: fauxVrm,
    vinted: () => ({ status: 200, body: {} }), onglets: onglets || [{ id: 9, url: 'https://vrm.center/', status: 'complete' }] });
  f.attentes = [];
  f.brut = brut;
  // L'écart se MESURE (l'horloge du banc ne dort pas) : ce que le fond demande d'attendre.
  if (typeof f.ctx.dormirTransp === 'function') f.ctx.dormirTransp = (ms) => { f.attentes.push(ms); return Promise.resolve(); };
  return f;
}
const tick = async (f, force = true) => (typeof f.ctx.transpTick === 'function' ? f.ctx.transpTick('audit', force) : Promise.reject(new Error('transpTick absent du fond')));
const urls = (f) => f.j.transp.map((r) => r.url);
const modes = (f) => f.j.vrmApi.map((r) => r.mode);
const enVinted = (f) => f.j.vinted.length;
const evtsTransp = (f) => f.j.evts.filter((e) => e && e.quoi === 'transp');
const section = (() => {
  const t = fs.readFileSync(SRC, 'utf8');
  const a = t.indexOf('// <transporteurs>'), b = t.indexOf('// </transporteurs>');
  return a >= 0 && b > a ? t.slice(a, b) : '';
})();
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

(async () => {
  // ── 0. CE QUI EST ÉCRIT ─────────────────────────────────────────────────────
  await essaie('le code', async () => {
    dit(!!section, 'une section `<transporteurs>` existe dans le fond', section ? '' : 'absente');
    const code = sansCommentaires(section);
    for (const interdit of ['requeteVinted(', 'gardeLecture(', 'compterLecture(', 'compterAction(', 'avecVinted(', 'gardeStricte(']) {
      dit(!!code && !code.includes(interdit), `la lecture d'un transporteur n'appelle pas ${interdit.slice(0, -1)} (le budget et la file Vinted ne sont pas touchés)`, code.includes(interdit) ? 'trouvé' : '');
    }
    dit(!!code && !/Math\.random/.test(code), "aucun délai au hasard (l'écart est FIXE)");
    dit(!!code && !/user-agent/i.test(code), 'aucun User-Agent fabriqué (celui du navigateur, jamais changé)');
    const fondTexte = fs.readFileSync(SRC, 'utf8');
    dit(/'vrm-transp':\s*30\b/.test(fondTexte), 'une alarme `vrm-transp` de 30 min (PERIODES)');
    const corpsVisite = (/async function visiteVinted\(\)[\s\S]*?\n}\n/.exec(fondTexte) || [''])[0];
    dit(/transpTick\('visite'\)/.test(corpsVisite), 'la lecture part aussi à chaque visite Vinted');
    let v = '';
    try { v = vm.runInNewContext(`${(/const CODE_VERSION = '[^']+';/.exec(fondTexte) || [''])[0]} CODE_VERSION`); } catch (_) {}
    // La version du manifeste (celle du zip), jamais recopiée ici : une montée de version ne fait pas mentir l'audit.
    let vMan = ''; try { vMan = JSON.parse(fs.readFileSync(path.join(path.dirname(cheminSource()), 'manifest.json'), 'utf8')).version; } catch (_) {}
    dit(!!v && v === vMan, `CODE_VERSION = la version du manifeste (${vMan || '?'})`, v);
  });

  // ── 1. SANS SESSION, SANS PERMISSION : RIEN NE PART ──────────────────────
  await essaie('sans session', async () => {
    const f = monter({ items: [ITEM.cp], session: false });
    const r = await tick(f);
    dit(f.j.transp.length === 0 && f.j.vrmApi.length === 0, 'sans session VRM : aucune requête, ni VRM ni transporteur', JSON.stringify({ transp: urls(f), vrm: modes(f), r }));
    dit(f.store.vrmTranspTick === undefined && f.j.permisContains.length === 0, 'et rien n\'est consommé (ni la garde des 5 min, ni une question de permission) : la session revenue lit tout de suite', JSON.stringify({ tick: f.store.vrmTranspTick, permis: f.j.permisContains.length }));
  });
  await essaie('session morte', async () => {
    const f = monter({ items: [ITEM.cp], session: 'morte' });
    await tick(f);
    dit(f.j.transp.length === 0 && f.j.vrmApi.length === 0, 'session VRM morte : aucune requête', JSON.stringify({ transp: urls(f), vrm: modes(f) }));
  });
  await essaie('sans permission', async () => {
    const f = monter({ items: [ITEM.cp, ITEM.mr], permis: false });
    await tick(f);
    dit(f.j.transp.length === 0 && f.j.vrmApi.length === 0, 'permission refusée : aucune requête', JSON.stringify({ transp: urls(f), vrm: modes(f) }));
    dit(f.j.diags.includes('transp_sans_permission'), 'et c\'est noté (`transp_sans_permission`)', JSON.stringify(f.j.diags));
  });
  await essaie('API des permissions absente', async () => {
    const f = monter({ items: [ITEM.cp], permis: 'absente' });
    await tick(f);
    dit(f.j.transp.length === 0 && f.j.vrmApi.length === 0, "l'API des permissions manque (« pas su ») : aucune requête", JSON.stringify({ transp: urls(f), vrm: modes(f) }));
  });
  await essaie('API muette', async () => {
    const f = monter({ items: [ITEM.cp], permis: 'muet' });
    await tick(f);
    dit(f.j.transp.length === 0 && f.j.vrmApi.length === 0, "l'API des permissions ne répond pas : aucune requête", JSON.stringify({ transp: urls(f), vrm: modes(f) }));
  });
  await essaie('Chronopost seul permis', async () => {
    const f = monter({ items: [ITEM.mr, ITEM.cp, ITEM.vg], permis: (o) => o === 'https://ws.chronopost.fr/*' });
    await tick(f);
    dit(JSON.stringify(urls(f)) === JSON.stringify([URL_CP()]), 'un seul site permis : seul lui est lu', JSON.stringify(urls(f)));
  });

  // ── 2. LE PASSAGE NOMINAL ──────────────────────────────────────────────────
  await essaie('passage nominal', async () => {
    const items = [
      ITEM.mr,
      { carrier: 'chronopost', suivi: CP2, cp: null, voie: 'vg-v3' },        // voie d'un autre transporteur
      ITEM.cp,
      { carrier: 'mondialrelay', suivi: MR2, cp: null, voie: 'mr-be' },       // Mondial Relay sans code postal
      ITEM.vg,
      { carrier: 'chronopost', suivi: 'ABC', cp: null, voie: 'cp-ws2' },     // hors forme
      { carrier: 'vinted', suivi: VG2, cp: null, voie: 'vg-v3' },            // 7ᵉ : au-delà de 6
    ];
    const f = monter({ items, vrm: { change: true } });
    await tick(f);
    const attendu = [URL_MR_PAGE, URL_MR_API(), URL_CP(), URL_VG()];
    dit(JSON.stringify(urls(f)) === JSON.stringify(attendu), 'seuls les n° valides de C3 sont lus, dans l\'ordre, aux adresses exactes', JSON.stringify(urls(f)));
    dit(!urls(f).some((u) => u.includes(VG2)), 'le 7ᵉ n° n\'est pas lu (6 au plus par passage)');
    dit(!urls(f).some((u) => u.includes(CP2) || u.includes(MR2)), 'un n° sur une voie qui n\'est pas la sienne, ou Mondial Relay sans code postal : pas lu');
    dit(f.j.transpMaxEnVol === 1, 'une seule requête de transporteur à la fois', String(f.j.transpMaxEnVol));
    const ecarts = f.attentes;
    dit(ecarts.length === f.j.transp.length - 1 && ecarts.every((ms) => ms >= 1900 && ms <= 2000), 'un écart de 2 s entre deux requêtes (FIXE)', JSON.stringify(ecarts));
    dit(enVinted(f) === 0, 'aucune requête chez Vinted', String(enVinted(f)));
    dit(f.store.vrmActions === undefined && f.store.vrmLectures === undefined && f.store.vrmPauseVinted === undefined, 'le budget et la pause de Vinted ne sont pas touchés', JSON.stringify({ a: f.store.vrmActions, l: f.store.vrmLectures, p: f.store.vrmPauseVinted }));
    const req = (u) => f.j.transp.find((r) => r.url === u) || {};
    dit(req(URL_MR_API()).headers && req(URL_MR_API()).headers.RequestVerificationToken === JETON_MR && req(URL_MR_API()).credentials === 'include', 'Mondial Relay : le jeton lu dans la page, les cookies du navigateur', JSON.stringify(req(URL_MR_API())));
    dit(req(URL_MR_PAGE).credentials === 'include', 'la page Mondial Relay est lue avec les cookies du navigateur');
    dit(req(URL_CP()).credentials === 'omit' && req(URL_VG()).credentials === 'omit', 'Chronopost et Vinted Go : sans cookie');
    dit(f.j.transp.every((r) => r.redirect === 'error' && r.methode === 'GET'), 'jamais une redirection suivie, toujours un GET');
    dit(f.j.transp.every((r) => !Object.keys(r.headers || {}).some((k) => /user-agent|cookie|referer/i.test(k))), 'aucun User-Agent, cookie ni Referer fabriqué');
    const c3 = f.j.vrmApi.find((r) => r.mode === 'transp-a-lire') || {};
    dit(c3.methode === 'GET' && c3.headers && c3.headers.Authorization === `Bearer ${SESSION.access_token}`, 'C3 lu avec la session du vendeur', JSON.stringify(c3.headers));
    const b = f.brut;
    dit(b.length === 3, 'trois réponses relayées (C4)', String(b.length));
    const mr = b.find((x) => x && x.carrier === 'mondialrelay') || {}, cp = b.find((x) => x && x.carrier === 'chronopost') || {}, vg = b.find((x) => x && x.carrier === 'vinted') || {};
    dit(mr.v === 1 && mr.suivi === MR && mr.cp === CP_MR && mr.voie === 'mr-be' && mr.statut === 200 && /json/.test(mr.ctype) && mr.corps === JSON_MR && mr.source === 'extension' && !isNaN(Date.parse(mr.at)), 'Mondial Relay : la réponse relayée TELLE QUELLE, à la forme de C4', JSON.stringify(Object.assign({}, mr, { corps: (mr.corps || '').slice(0, 40) })));
    dit(cp.corps === XML_CP && cp.voie === 'cp-ws2' && cp.cp === undefined && /xml/.test(cp.ctype), 'Chronopost : le XML relayé tel quel (accents compris), sans code postal', JSON.stringify(Object.assign({}, cp, { corps: (cp.corps || '').length })));
    dit(vg.corps === JSON_VG && vg.voie === 'vg-v3', 'Vinted Go : relayé tel quel');
    const ev = evtsTransp(f);
    dit(ev.length === 3 && ev.every((e) => e.type === 'maj' && ['mondialrelay', 'chronopost', 'vinted'].includes(e.carrier) && e.suivi), 'chaque `change:true` prévient l\'app (maj · transp)', JSON.stringify(ev));
    dit(f.j.diags.includes('transp_lu_chronopost') && f.j.diags.includes('transp_lu_mondialrelay') && f.j.diags.includes('transp_lu_vinted'), 'le diagnostic compte les lectures (`transp_lu_*`)', JSON.stringify(f.j.diags));
  });
  await essaie('sans changement', async () => {
    const f = monter({ items: [ITEM.cp], vrm: { change: false } });
    await tick(f);
    dit(f.brut.length === 1 && evtsTransp(f).length === 0, "l'autre sens : `change:false` ne prévient pas l'app", JSON.stringify(evtsTransp(f)));
  });
  // (tour 2 n° 11) Une réponse 2xx que le SERVEUR n'a pas pu juger (`forme` :
  // tronquée, inattendue) n'est pas comptée « lue ».
  await essaie('jugée « forme » par le serveur', async () => {
    const f = monter({ items: [ITEM.cp], vrm: { res: 'forme' } });
    await tick(f);
    dit(f.brut.length === 1 && !f.j.diags.some((d) => /^transp_lu_/.test(d)) && f.j.diags.includes('transp_relaye_forme_chronopost'), 'n° 11 : une réponse que le serveur juge « forme » n\'est jamais comptée `transp_lu_*` (comptée `transp_relaye_forme_*`)', JSON.stringify(f.j.diags));
  });

  // ── 3. VINTED N'EST PAS DANS LA BOUCLE ─────────────────────────────────────
  await essaie('pause Vinted', async () => {
    const pv = { jusqua: Date.now() + 3600e3, niveau: 1, statut: 429, depuis: Date.now() - 60000, quoi: 'api' };
    const f = monter({ items: [ITEM.cp], store: { vrmPauseVinted: pv } });
    await tick(f);
    dit(JSON.stringify(urls(f)) === JSON.stringify([URL_CP()]) && f.brut.length === 1, 'une pause Vinted n\'arrête pas la lecture d\'un transporteur', JSON.stringify({ u: urls(f), b: f.brut.length }));
    dit(JSON.stringify(f.store.vrmPauseVinted) === JSON.stringify(pv), 'et la pause Vinted n\'est pas touchée');
  });
  await essaie('403 transporteur', async () => {
    const f = monter({ items: [ITEM.cp], sur: { 'https://ws.chronopost.fr/': { status: 403, body: '<html>Forbidden</html>', headers: ENTETES.html } } });
    await tick(f);
    dit(f.store.vrmPauseVinted === undefined, 'un 403 d\'un transporteur ne pose JAMAIS la pause Vinted', JSON.stringify(f.store.vrmPauseVinted));
    const p = (f.store.vrmTranspPause || {})['cp-ws2'] || {};
    const reste = Number(p.jusqua || 0) - Date.now();
    dit(reste > 29 * 60000 && reste <= 30 * 60000 && p.palier === 0, 'il pose la pause de CETTE voie : 30 min', JSON.stringify(p));
    dit(f.j.diags.includes('transp_bloque_chronopost_403'), 'noté `transp_bloque_chronopost_403`', JSON.stringify(f.j.diags));
    dit(f.brut.length === 1 && f.brut[0].statut === 403, 'le refus est relayé au serveur (il note « bloqué »)', JSON.stringify(f.brut.map((x) => x && x.statut)));
  });

  // ── 4. LE BUDGET PROPRE ──────────────────────────────────────────────────
  await essaie('budget plein', async () => {
    const t = Date.now() - 60000;
    const f = monter({ items: [ITEM.cp], store: { vrmTranspCompte: { chronopost: Array(12).fill(t) } } });
    await tick(f);
    dit(f.j.transp.length === 0, '12 requêtes dans l\'heure : la 13ᵉ ne part pas', JSON.stringify(urls(f)));
    dit(f.j.diags.includes('transp_budget_chronopost'), 'noté `transp_budget_chronopost`');
  });
  await essaie('budget presque plein', async () => {
    const t = Date.now() - 60000;
    const f = monter({ items: [ITEM.cp, { carrier: 'chronopost', suivi: CP2, cp: null, voie: 'cp-ws2' }, ITEM.vg], store: { vrmTranspCompte: { chronopost: Array(11).fill(t) } } });
    await tick(f);
    dit(JSON.stringify(urls(f)) === JSON.stringify([URL_CP(), URL_VG()]), 'il reste UNE requête Chronopost : une seule part — le budget est PAR transporteur (Vinted Go lu)', JSON.stringify(urls(f)));
  });
  await essaie('budget sur 13 passages', async () => {
    const f = monter({ items: [ITEM.cp] });
    for (let i = 0; i < 14; i++) await tick(f);
    dit(f.j.transp.length === 12, '14 passages forcés dans l\'heure : 12 requêtes au plus', String(f.j.transp.length));
  });

  // ── 5. LA PAUSE ────────────────────────────────────────────────────────────
  await essaie('pause en cours', async () => {
    const f = monter({ items: [ITEM.cp, ITEM.vg], store: { vrmTranspPause: { 'cp-ws2': { jusqua: Date.now() + 600000, palier: 0 } } } });
    await tick(f);
    dit(JSON.stringify(urls(f)) === JSON.stringify([URL_VG()]), 'une voie en pause n\'est pas lue — les autres, si', JSON.stringify(urls(f)));
  });
  await essaie('palier', async () => {
    const f = monter({ items: [ITEM.cp], store: { vrmTranspPause: { 'cp-ws2': { jusqua: Date.now() - 3600e3, palier: 0 } } }, sur: { 'https://ws.chronopost.fr/': { status: 429, body: '', headers: {} } } });
    await tick(f);
    const p = (f.store.vrmTranspPause || {})['cp-ws2'] || {};
    const reste = Number(p.jusqua || 0) - Date.now();
    dit(p.palier === 1 && reste > 59 * 60000 && reste <= 60 * 60000, 'refusé de nouveau moins de 24 h après : le palier monte (1 h)', JSON.stringify(p));
  });
  await essaie('Retry-After', async () => {
    const f = monter({ items: [ITEM.cp], sur: { 'https://ws.chronopost.fr/': { status: 429, body: '', headers: { 'Retry-After': '7200' } } } });
    await tick(f);
    const p = (f.store.vrmTranspPause || {})['cp-ws2'] || {};
    const reste = Number(p.jusqua || 0) - Date.now();
    dit(reste > 119 * 60000 && reste <= 120 * 60000, '`Retry-After` plus long que le palier : respecté (2 h)', JSON.stringify(p));
  });
  await essaie('défi', async () => {
    const f = monter({ items: [ITEM.vg], sur: { 'https://carrier.vintedgo.com/': { status: 200, body: '{}', headers: { 'content-type': 'application/json', 'cf-mitigated': 'challenge' } } } });
    await tick(f);
    const p = (f.store.vrmTranspPause || {})['vg-v3'] || {};
    dit(Number(p.jusqua || 0) > Date.now() && p.dernier && p.dernier.raison === 'defi', 'un défi (`cf-mitigated`) : la voie se met en pause, rien n\'est contourné', JSON.stringify(p));
  });
  await essaie('page « Just a moment »', async () => {
    const f = monter({ items: [ITEM.vg], sur: { 'https://carrier.vintedgo.com/': { status: 503, body: '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>challenge-platform</body></html>', headers: ENTETES.html } } });
    await tick(f);
    const p = (f.store.vrmTranspPause || {})['vg-v3'] || {};
    dit(Number(p.jusqua || 0) > Date.now() && p.dernier && p.dernier.raison === 'defi', 'une page de défi : pause', JSON.stringify(p));
  });
  await essaie('HTML au lieu de JSON', async () => {
    const f = monter({ items: [ITEM.vg], sur: { 'https://carrier.vintedgo.com/': { status: 200, body: '<html><body>Maintenance</body></html>', headers: ENTETES.html } } });
    await tick(f);
    const p = (f.store.vrmTranspPause || {})['vg-v3'] || {};
    dit(Number(p.jusqua || 0) > Date.now() && p.dernier && p.dernier.raison === 'html', 'du HTML là où on attend du JSON : pause', JSON.stringify(p));
  });
  await essaie('levée au succès', async () => {
    const f = monter({ items: [ITEM.cp], store: { vrmTranspPause: { 'cp-ws2': { jusqua: Date.now() - 1000, palier: 2 } } } });
    await tick(f);
    dit(!(f.store.vrmTranspPause || {})['cp-ws2'], 'une lecture réussie lève la pause de sa voie', JSON.stringify(f.store.vrmTranspPause));
  });
  await essaie('404 n\'est pas un refus', async () => {
    const f = monter({ items: [ITEM.vg], sur: { 'https://carrier.vintedgo.com/': { status: 404, body: '{"error_code":"shipment_expired"}', headers: ENTETES.json } } });
    await tick(f);
    dit(!(f.store.vrmTranspPause || {})['vg-v3'] && f.brut.length === 1 && f.brut[0].statut === 404, 'un 404 JSON n\'est pas un blocage : relayé, le serveur le juge', JSON.stringify({ p: f.store.vrmTranspPause, b: f.brut.map((x) => x && x.statut) }));
  });

  // ── 6. MONDIAL RELAY : LE REPLI ET LE JETON ─────────────────────────────────
  await essaie('repli mvc', async () => {
    const f = monter({ items: [ITEM.mr], sur: { 'https://www.mondialrelay.be/api/': { status: 403, body: '<html>Forbidden</html>', headers: ENTETES.html } } });
    await tick(f);
    dit(JSON.stringify(urls(f)) === JSON.stringify([URL_MR_PAGE, URL_MR_API(), URL_MVC()]), '.be refusée : le repli .fr (`_mvc`) est lu, à son adresse exacte', JSON.stringify(urls(f)));
    const m = f.j.transp.find((r) => r.url === URL_MVC()) || {};
    dit(m.credentials === 'include' && m.headers && m.headers['X-Requested-With'] === 'XMLHttpRequest', 'le repli part avec les cookies du navigateur et X-Requested-With');
    dit(f.brut.length === 1 && f.brut[0].voie === 'mr-fr-mvc' && f.brut[0].corps === JSON_MVC, 'seule la dernière réponse est relayée, sur sa voie `mr-fr-mvc`', JSON.stringify(f.brut.map((x) => x && x.voie)));
    dit(((f.store.vrmTranspPause || {})['mr-be'] || {}).jusqua > Date.now() && !(f.store.vrmTranspPause || {})['mr-fr-mvc'], 'la pause porte sur la voie .be seulement');
  });
  await essaie('page sans jeton', async () => {
    const f = monter({ items: [ITEM.mr], sur: { [URL_MR_PAGE]: { status: 200, body: '<html><body>nouvelle page</body></html>', headers: ENTETES.html } } });
    await tick(f);
    dit(JSON.stringify(urls(f)) === JSON.stringify([URL_MR_PAGE, URL_MVC()]), 'page .be sans jeton : pas d\'appel à l\'API au hasard, le repli .fr', JSON.stringify(urls(f)));
    dit(f.j.diags.includes('transp_forme_mondialrelay_page'), 'et la forme est notée');
  });
  await essaie('jeton gardé', async () => {
    const f = monter({ items: [ITEM.mr] });
    await tick(f); await tick(f);
    dit(urls(f).filter((u) => u === URL_MR_PAGE).length === 1 && urls(f).filter((u) => u === URL_MR_API()).length === 2, 'le jeton de la page sert 10 min (une page pour deux lectures)', JSON.stringify(urls(f)));
  });
  await essaie('voie refusée par le serveur', async () => {
    const f = monter({ items: [ITEM.mr], sur: { 'https://www.mondialrelay.be/api/': { status: 403, body: '<html>Forbidden</html>', headers: ENTETES.html } },
      vrm: { brut: (req) => (req.corps && req.corps.voie === 'mr-fr-mvc' ? { status: 400, body: { error: 'voie' } } : null) } });
    await tick(f);
    dit(Number(((f.store.vrmTranspVoiesRefusees || {})['mr-fr-mvc']) || 0) > 0, 'le serveur refuse la voie `mr-fr-mvc` (400 voie) : elle est notée', JSON.stringify(f.store.vrmTranspVoiesRefusees));
    const n0 = f.j.transp.length;
    f.store.vrmTranspPause = {};
    await tick(f);
    dit(!f.j.transp.slice(n0).some((r) => r.url.startsWith('https://www.mondialrelay.fr/')), 'et n\'est plus essayée (24 h)', JSON.stringify(f.j.transp.slice(n0).map((r) => r.url)));
  });

  // ── 7. LA LISTE BLANCHE ─────────────────────────────────────────────────────
  await essaie('liste blanche', async () => {
    const f = monter({ items: [] });
    const essais = [
      ['https://evil.example/api/tracking?shipment=12345678', 'cp-ws2'],
      ['https://ws.chronopost.fr.evil.example/tracking-cxf/TrackingServiceWS/trackSkybillV2?language=fr_FR&skybillNumber=XW000000001TS', 'cp-ws2'],
      ['https://ws.chronopost.fr/tracking-cxf/TrackingServiceWS/trackSkybillV2?language=fr_FR&skybillNumber=XW000000001TS&x=1', 'cp-ws2'],
      ['https://carrier.vintedgo.com/public/v3/tracking_events/../../admin', 'vg-v3'],
      ['https://www.mondialrelay.be/api/tracking?shipment=12345678&postcode=35260&brand=&codePays=&rappel=https://evil.example', 'mr-be'],
      ['http://ws.chronopost.fr/tracking-cxf/TrackingServiceWS/trackSkybillV2?language=fr_FR&skybillNumber=XW000000001TS', 'cp-ws2'],
    ];
    const rendus = [];
    for (const [u, voie] of essais) rendus.push(await f.ctx.appelTransp(u, { method: 'GET' }, voie));
    dit(rendus.every((r) => r && r.echec === 'url'), 'une adresse hors de la liste blanche est refusée', JSON.stringify(rendus));
    dit(f.j.transp.length === 0 && f.j.ailleurs.length === 0, 'et rien ne part (ni chez le transporteur, ni ailleurs)', JSON.stringify({ t: urls(f), a: f.j.ailleurs }));
    const bonne = await f.ctx.appelTransp(URL_CP(), { method: 'GET' }, 'cp-ws2');
    dit(bonne && bonne.statut === 200 && f.j.transp.length === 1, "l'autre sens : l'adresse exacte passe", JSON.stringify(bonne && bonne.statut));
  });

  // ── 8. LE CORPS, BORNÉ ──────────────────────────────────────────────────────
  await essaie('corps borné', async () => {
    const gros = JSON.stringify({ tracking_number: VG, bourrage: 'é'.repeat(60000) + 'x'.repeat(40000) });
    const f = monter({ items: [ITEM.vg], sur: { 'https://carrier.vintedgo.com/': { status: 200, body: gros, headers: ENTETES.json } } });
    await tick(f);
    const b = f.brut[0] || {};
    const octets = Buffer.byteLength(String(b.corps || ''));
    dit(octets > 60000 && octets <= 65536, 'un corps de 160 Ko est relayé borné à 64 Ko', String(octets));
    dit(gros.startsWith(String(b.corps || '').slice(0, -2)), 'et c\'est le DÉBUT du corps, tel quel');
    const envoi = (f.j.vrmApi.find((r) => r.mode === 'transp-brut') || {}).octets || 0;
    dit(envoi > 0 && envoi <= 80 * 1024, 'le POST vers VRM tient sous 80 Ko', String(envoi));
  });

  // ── 9. LES GARDES DU PASSAGE ────────────────────────────────────────────────
  await essaie('route absente', async () => {
    const f = monter({ vrm: { aLire: { status: 404, body: { error: 'introuvable' } } } });
    await tick(f); await tick(f);
    dit(modes(f).filter((m) => m === 'transp-a-lire').length === 1, 'C3 absent (404, serveur ancien) : on se tait 6 h', JSON.stringify(modes(f)));
  });
  await essaie('5 min', async () => {
    const f = monter({ items: [ITEM.cp] });
    await tick(f, false); await tick(f, false);
    dit(modes(f).filter((m) => m === 'transp-a-lire').length === 1, 'deux passages ordinaires rapprochés : un seul C3', JSON.stringify(modes(f)));
  });
  await essaie('C3 illisible', async () => {
    const f = monter({ vrm: { aLire: { status: 503, body: { error: 'pas-su' } } } });
    await tick(f);
    dit(f.j.transp.length === 0, 'C3 « pas su » : rien n\'est lu', JSON.stringify(urls(f)));
  });

  // ── 10. LA PAGE DE SUIVI OUVERTE (transpVu) ─────────────────────────────────
  const msgVu = (extra = {}) => Object.assign({ from: 'vrm-transp', action: 'transpVu' }, extra);
  const onglet = (url, frameId = 0) => ({ tab: { id: 31, url }, url, frameId });
  await essaie('transpVu Chronopost', async () => {
    const f = monter();
    const r = await f.envoyer(msgVu({ carrier: 'chronopost', suivi: CP2 }), onglet(`https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${CP}`));
    const c5 = f.j.vrmApi.filter((x) => x.mode === 'transp');
    dit(c5.length === 1 && c5[0].corps && c5[0].corps.suivi === CP && c5[0].corps.carrier === 'chronopost' && c5[0].corps.v === 1, 'le n° est lu dans l\'ADRESSE de l\'onglet, jamais dans le message', JSON.stringify(c5.map((x) => x.corps)));
    dit(f.j.diags.includes('transp_vu_chronopost'), 'noté `transp_vu_chronopost`');
    await f.envoyer(msgVu(), onglet(`https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${CP}`));
    dit(f.j.vrmApi.filter((x) => x.mode === 'transp').length === 1, 'la même page rouverte dans les 5 min : rien de plus', JSON.stringify(r));
  });
  await essaie('transpVu Mondial Relay', async () => {
    const f = monter();
    await f.envoyer(msgVu(), onglet(`https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=${MR}&codePostal=${CP_MR}`));
    const c5 = f.j.vrmApi.filter((x) => x.mode === 'transp');
    dit(c5.length === 1 && c5[0].corps.suivi === MR && c5[0].corps.cp === CP_MR && c5[0].corps.carrier === 'mondialrelay', 'Mondial Relay : n° et code postal tirés de l\'adresse', JSON.stringify(c5.map((x) => x.corps)));
  });
  await essaie('transpVu Vinted Go', async () => {
    const f = monter();
    await f.envoyer(msgVu(), onglet(`https://vintedgo.com/fr/tracking/${VG}`));
    const c5 = f.j.vrmApi.filter((x) => x.mode === 'transp');
    dit(c5.length === 1 && c5[0].corps.suivi === VG && c5[0].corps.carrier === 'vinted', 'Vinted Go : le n° du chemin `/fr/tracking/{n}`', JSON.stringify(c5.map((x) => x.corps)));
  });
  await essaie('transpVu refusé', async () => {
    const f = monter();
    const cas = [
      onglet(`https://evil.example/tracking-no-cms/suivi-page?listeNumerosLT=${CP}`),
      onglet(`https://www.chronopost.fr.evil.example/tracking-no-cms/suivi-page?listeNumerosLT=${CP}`),
      onglet(`https://www.chronopost.fr/autre/suivi-page?listeNumerosLT=${CP}`),
      onglet(`https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${CP},${CP2}`),
      onglet(`https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=ABC&codePostal=${CP_MR}`),
      onglet(`https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${CP}`, 3),
      { url: `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${CP}` },   // pas un onglet
    ];
    for (const s of cas) await f.envoyer(msgVu({ carrier: 'chronopost', suivi: CP, cp: CP_MR }), s);
    dit(f.j.vrmApi.length === 0, 'mauvais site, lien d\'aspect proche, plusieurs n°, n° hors forme, cadre intérieur : rien ne part — même si le message porte un n°', JSON.stringify(f.j.vrmApi.map((x) => x.corps)));
  });
  await essaie('transpVu sans session', async () => {
    const f = monter({ session: false });
    await f.envoyer(msgVu(), onglet(`https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${CP}`));
    dit(f.j.vrmApi.length === 0, 'page de suivi ouverte sans session VRM : rien ne part');
  });
  await essaie('transpVu besoin du navigateur', async () => {
    const f = monter({ vrm: { change: true, transp: () => ({ status: 200, body: { ok: true, lus: [], besoinNavigateur: [ITEM.mr, Object.assign({}, ITEM.mr, { suivi: MR2 })], pause: {} } }) } });
    await f.envoyer(msgVu(), onglet(`https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=${MR}&codePostal=${CP_MR}`));
    await attendre(30);
    dit(JSON.stringify(urls(f)) === JSON.stringify([URL_MR_PAGE, URL_MR_API()]), 'le serveur dit « lis-le » : CE n° est lu tout de suite (pas un autre)', JSON.stringify(urls(f)));
    dit(f.brut.length === 1 && f.brut[0].source === 'page', 'relayé avec `source: page`', JSON.stringify(f.brut.map((x) => x && x.source)));
  });
  await essaie('transpVu notifie', async () => {
    const f = monter({ vrm: { transp: () => ({ status: 200, body: { ok: true, lus: [{ carrier: 'chronopost', suivi: CP, res: 'lu', etat: 'disponible', change: true }], besoinNavigateur: [], pause: {} } }) } });
    await f.envoyer(msgVu(), onglet(`https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${CP}`));
    await attendre(20);
    const ev = evtsTransp(f);
    dit(ev.length === 1 && ev[0].carrier === 'chronopost' && ev[0].suivi === CP, 'C5 `change:true` : l\'app est prévenue', JSON.stringify(ev));
  });

  // ── 11. UNE À LA FOIS, MÊME QUAND TOUT ARRIVE ENSEMBLE ──────────────────────
  await essaie('concurrence', async () => {
    const f = monter({ items: [ITEM.cp, ITEM.vg], vrm: { transp: () => ({ status: 200, body: { ok: true, lus: [], besoinNavigateur: [ITEM.mr], pause: {} } }) } });
    // Chaque départ dans sa promesse : sur le code d'avant, une fonction absente
    // devient un contrôle ROUGE, jamais un rejet qui tue l'audit avant le bilan.
    await Promise.all([
      Promise.resolve().then(() => tick(f)),
      Promise.resolve().then(() => f.envoyer(msgVu(), onglet(`https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=${MR}&codePostal=${CP_MR}`))),
      Promise.resolve().then(() => f.ctx.lireTransporteurNavigateur(ITEM.vg, 'extension')),
    ].map((p) => p.catch((e) => { throw e; })));
    await attendre(40);
    dit(f.j.transp.length >= 4 && f.j.transpMaxEnVol === 1, 'un passage, une page ouverte et une lecture en même temps : jamais deux requêtes en vol', JSON.stringify({ n: f.j.transp.length, max: f.j.transpMaxEnVol }));
  });

  // ── 12. L'ÉTAT DIT AU NAVIGATEUR (C9, nav.indispo) ──────────────────────────
  await essaie('état du navigateur', async () => {
    const a = monter({ permis: false });
    const ea = typeof a.ctx.etatNavigateur === 'function' ? await a.ctx.etatNavigateur() : null;
    dit(!!ea && Array.isArray(ea.indispo) && ea.indispo.includes('transporteurs'), 'permission refusée : `nav.indispo` dit « transporteurs »', JSON.stringify(ea));
    const b = monter({ permis: 'absente' });
    const eb = typeof b.ctx.etatNavigateur === 'function' ? await b.ctx.etatNavigateur() : null;
    dit(!!eb && eb.indispo.includes('transporteurs-passu'), 'API absente : « transporteurs-passu » (pas su, pas non)', JSON.stringify(eb));
    const c = monter({ permis: true });
    const ec = typeof c.ctx.etatNavigateur === 'function' ? await c.ctx.etatNavigateur() : undefined;
    dit(ec === null || !(ec.indispo || []).some((x) => /^transporteurs/.test(x)), "l'autre sens : tout permis, rien n'est dit", JSON.stringify(ec));
  });
  await essaie('la fenêtre demande la permission', async () => {
    const f = monter({ permis: false });
    const r = await f.envoyer({ from: 'cancale-popup', action: 'transpPermis' });
    dit(!!r && r.ok === true && r.permis === false && Array.isArray(r.origines) && r.origines.length === 4 && r.origines.every((o) => /^https:\/\/[a-z.]+\/\*$/.test(o)), 'la fenêtre apprend « pas permis » et les quatre sites à demander', JSON.stringify(r));
    const g = monter({ permis: true });
    const rg = await g.envoyer({ from: 'cancale-popup', action: 'transpPermis' });
    dit(!!rg && rg.permis === true, "l'autre sens : tout permis ⇒ `permis: true`", JSON.stringify(rg));
    dit(f.j.permisAjout.length === 1, 'une permission accordée relance la lecture (`permissions.onAdded`)', String(f.j.permisAjout.length));
  });

  // ── (tour 2 n° 10) DE BOUT EN BOUT : TOUT N° QUE C3 ANNONCE EST LU ─────────
  // Le serveur (`aLireParNavigateur`, la vraie règle) annonce, après un refus,
  // des n° de chaque forme qu'IL accepte ; l'extension doit les lire (une
  // requête chez le transporteur), jamais les refuser en silence
  // (`transp_item_refuse`). Avant : un Vinted Go à 12 chiffres annoncé, refusé.
  await essaie('de bout en bout : un n° annoncé par C3 est accepté', async () => {
    const T = await import('file://' + path.join(__dirname, '..', 'api', '_lib', 'transporteurs.js'));
    const NOW = Date.now(), iso = (ms) => new Date(ms).toISOString();
    const cas = [['vinted', '123456789012'], ['vinted', '1234567890123456'], ['vinted', 'VGS0000000000001'], ['chronopost', 'XW000000003TS'], ['chronopost', '12345678901234'], ['chronopost', '12345678901234A']];
    for (const [carrier, n] of cas) {
      const lignes = [{ suivi: n, carrier, status: 'available', subject: 'Ton colis est disponible', receivedAt: iso(NOW - 3600e3) }];
      const transp = new Map([[n, { suivi: n, carrier, essai: iso(NOW - 60e3), essaiRes: 'bloque', essaiSource: 'serveur', essais: 1 }]]);
      const items = T.aLireParNavigateur({ lignes, transp, maintenant: NOW });
      const it = items.find((x) => x.suivi === n);
      if (!it) { dit(false, `C3 annonce le n° ${carrier} ${n}`, JSON.stringify(items)); continue; }
      const f = monter({ items: [it] });
      await tick(f);
      dit(urls(f).length >= 1, `C3 annonce ${carrier} ${n} (voie ${it.voie}) ⇒ l'extension le lit chez le transporteur`, JSON.stringify(urls(f)));
    }
  });

  console.log(`\n${ok} contrôle(s) conforme(s), ${ko} non conforme(s).`);
  if (MUT) { try { fs.unlinkSync(SRC); } catch (_) {} }
  process.exit(ko ? 1 : 0);
})();
