// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE DÉTOURAGE PHOTOROOM CÔTÉ SERVEUR (node scripts/bancs/detourage.cjs)
// ═══════════════════════════════════════════════════════════════════════════
// §4.10 — une route serveur n'est vérifiée que si un banc l'EXÉCUTE. On importe
// la vraie api/ai.js (mode `detourage`) avec un faux `fetch` qui joue Supabase
// (session, abonnement, cache privé, compteur atomique) et Photoroom, et on
// compte ce qui part chez Photoroom — c'est là que l'argent de Julien se dépense.
// Aucune donnée réelle : une « photo » de quelques octets JPEG inventés.
const path = require('path');
const crypto = require('crypto');
const RACINE = path.join(__dirname, '..', '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

const PROPRIO = '11111111-1111-1111-1111-111111111111';
const AUTRE = '22222222-2222-2222-2222-222222222222';
const JETON = { [PROPRIO]: 'a.b.proprio', [AUTRE]: 'a.b.autre' };
const photo = (n) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('photo-inventee-' + n), Buffer.alloc(32, n)]);
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const DETOUREE = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xdb]), Buffer.from('detouree')]);

let etat;
let oublier = () => {};
function base(over = {}) {
  oublier();
  etat = Object.assign({ cache: new Map(), compteur: new Map(), plafond: null, compteurKO: false, photoroom: [], reponsePR: 200, acces: true, cacheKO: false, abo: {}, aboKO: false, coupure: false }, over);
  global.fetch = async (url, opts = {}) => {
    const u = String(url); const m = (opts.method || 'GET').toUpperCase();
    const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
    if (/\/auth\/v1\/user/.test(u)) {
      const tok = String((opts.headers || {}).Authorization || '').replace(/^Bearer\s+/, '');
      const id = Object.keys(JETON).find((k) => JETON[k] === tok);
      return id ? J({ id, email: id === PROPRIO ? 'p@test' : 'a@test' }) : J({ msg: 'no' }, 401);
    }
    if (/rpc\/vrm_acces_pour/.test(u)) return J(etat.acces);
    if (/\/rest\/v1\/abonnements/.test(u)) {
      if (etat.aboKO) return new Response('<html>522</html>', { status: 522 });
      const o = decodeURIComponent((u.match(/owner=eq\.([^&]+)/) || [])[1] || '');
      return J(etat.abo[o] ? [etat.abo[o]] : []);
    }
    if (/storage\/v1\/object\/detourage\//.test(u)) {
      const cle = u.split('/storage/v1/object/detourage/')[1];
      if (m === 'GET') { if (etat.cacheKO) return new Response('x', { status: 522 }); return etat.cache.has(cle) ? new Response(etat.cache.get(cle), { status: 200 }) : J({ error: 'not_found' }, 400); }
      etat.cache.set(cle, Buffer.from(opts.body)); return J({ Key: cle });
    }
    if (/rpc\/vrm_detourage_reserver/.test(u)) {
      if (etat.compteurKO) return new Response('<html>522</html>', { status: 522 });
      const b = JSON.parse(opts.body); const k = b.u + ':' + b.m; const n = etat.compteur.get(k) || 0;
      if (n >= b.plafond) return J(null);
      etat.compteur.set(k, n + 1); return J(n + 1);
    }
    if (/rpc\/vrm_detourage_rendre/.test(u)) { const b = JSON.parse(opts.body); const k = b.u + ':' + b.m; etat.compteur.set(k, Math.max(0, (etat.compteur.get(k) || 0) - 1)); return J(null); }
    if (/detourage_usage/.test(u)) { const o = (u.match(/owner=eq\.([^&]+)/) || [])[1]; const mo = decodeURIComponent((u.match(/mois=eq\.([^&]+)/) || [])[1] || ''); const n = etat.compteur.get(decodeURIComponent(o) + ':' + mo); return J(n == null ? [] : [{ n }]); }
    if (/sdk\.photoroom\.com/.test(u)) {
      etat.photoroom.push({ headers: opts.headers, corps: JSON.parse(opts.body) });
      if (etat.reponsePR !== 200) return J({ detail: 'refus' }, etat.reponsePR);
      // La coupure APRÈS un 200 : l'image est produite (facturée), le corps ne
      // nous arrive jamais.
      if (etat.coupure) return { ok: true, status: 200, headers: new Headers({ 'content-type': 'image/jpeg' }), arrayBuffer: async () => { throw new Error('socket hang up'); } };
      return new Response(DETOUREE, { status: 200, headers: { 'content-type': 'image/jpeg' } });
    }
    return J([]);
  };
}

let mod;
async function appeler({ methode = 'POST', qui = PROPRIO, corps = {}, query = {} } = {}) {
  if (!mod) mod = await import('file://' + path.join(RACINE, 'api', 'ai.js'));
  const res = { code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } };
  const headers = qui ? { authorization: 'Bearer ' + JETON[qui] } : {};
  await mod.default({ method: methode, headers, query: Object.assign({ mode: 'detourage' }, query), body: corps }, res);
  return res;
}

(async () => {
  process.env.SUPABASE_SERVICE_KEY = 'eyJ.service.cle';
  // La règle d'accès garde sa réponse une minute : chaque scénario repart à neuf.
  oublier = (await import('file://' + path.join(RACINE, 'api', '_lib', 'abonnement.js'))).oublierAcces;
  process.env.VRM_OWNER_UID = PROPRIO;
  delete process.env.PHOTOROOM_POUR;
  try {
    const p1 = photo(1), h1 = sha(p1);
    // ── Sans clé ─────────────────────────────────────────────────────────
    delete process.env.PHOTOROOM_API_KEY; base();
    let r = await appeler({ methode: 'GET', qui: null });
    dit(r.code === 200 && r.corps.ready === false, 'GET sans clé : « pas prêt », sans erreur', JSON.stringify(r.corps));
    r = await appeler({ corps: { sha: h1, b64: p1.toString('base64') } });
    dit(r.code === 503 && r.corps.reason === 'no-key' && etat.photoroom.length === 0, 'POST sans clé : 503 « no-key », jamais un 200 menteur', `${r.code} ${JSON.stringify(r.corps)}`);

    process.env.PHOTOROOM_API_KEY = 'pr_test_cle';
    // ── Qui a le droit ───────────────────────────────────────────────────
    base();
    r = await appeler({ qui: null, corps: { sha: h1 } });
    dit(r.code === 401, 'sans session : 401 (la clé de Julien ne se dépense pas pour un anonyme)', String(r.code));
    base({ acces: false });
    r = await appeler({ corps: { sha: h1, b64: p1.toString('base64') } });
    dit(r.code === 402 && etat.photoroom.length === 0, 'abonnement coupé : 402, aucun appel', String(r.code));
    base();
    r = await appeler({ qui: AUTRE, corps: { sha: h1, b64: p1.toString('base64') } });
    dit(r.code === 403 && etat.photoroom.length === 0, 'un AUTRE vendeur : 403 tant que Julien ne l’a pas ouvert à tous (PHOTOROOM_POUR)', String(r.code));
    process.env.PHOTOROOM_POUR = 'tous';
    // ⚠️ Revue adverse du 4 octobre : « tous » ouvrait la clé à TOUT compte
    //    inscrit (l'abonnement n'est pas obligatoire aujourd'hui, la règle
    //    d'accès laisse passer). Un compte GRATUIT ne dépense pas sa clé.
    base();
    r = await appeler({ qui: AUTRE, corps: { sha: h1, b64: p1.toString('base64') } });
    dit(r.code === 403 && etat.photoroom.length === 0, '« tous » + un compte GRATUIT (aucun abonnement) : 403, aucun appel payé', String(r.code));
    base({ abo: { [AUTRE]: { statut: 'active' } } });
    r = await appeler({ qui: AUTRE, corps: { sha: h1, b64: p1.toString('base64') } });
    dit(r.code === 200 && etat.photoroom.length === 1, '« tous » + un abonné qui PAIE : détouré', String(r.code));
    base({ abo: { [AUTRE]: { statut: 'past_due', impaye_depuis: new Date(Date.now() - 20 * 864e5).toISOString() } } });
    r = await appeler({ qui: AUTRE, corps: { sha: h1, b64: p1.toString('base64') } });
    dit(r.code === 403 && etat.photoroom.length === 0, '« tous » + impayé depuis 20 jours : 403', String(r.code));
    base({ aboKO: true });
    r = await appeler({ qui: AUTRE, corps: { sha: h1, b64: p1.toString('base64') } });
    dit(r.code === 503 && etat.photoroom.length === 0, '« tous » + abonnement illisible : 503, on ne dépense pas à l’aveugle', String(r.code));
    delete process.env.PHOTOROOM_POUR;

    // ── L'argent : ce qui ne se repaie pas, ce qui ne se rend pas ─────────
    base({ cacheKO: true });
    r = await appeler({ corps: { sha: h1, b64: p1.toString('base64') } });
    dit(r.code === 503 && r.corps.reason === 'cache' && etat.photoroom.length === 0, 'cache ILLISIBLE : 503, on ne repaie pas une photo peut-être déjà détourée', `${r.code} ${etat.photoroom.length} appel(s)`);
    base({ compteur: new Map([[PROPRIO + ':' + new Date().toISOString().slice(0, 7), 150]]) });
    r = await appeler({ corps: { sha: h1 } });
    dit(r.code === 429 && r.corps.reason === 'plafond', 'plafond atteint : la SONDE le dit déjà (pas d’octets envoyés pour rien)', String(r.code));
    base({ coupure: true });
    r = await appeler({ corps: { sha: h1, b64: p1.toString('base64') } });
    const kc = PROPRIO + ':' + new Date().toISOString().slice(0, 7);
    dit(r.code >= 500 && etat.compteur.get(kc) === 1 && etat.cache.size === 0,
      'coupure APRÈS le 200 de Photoroom : l’unité reste COMPTÉE (l’image a pu être facturée)', `${r.code} · compteur ${etat.compteur.get(kc)}`);

    // ── L'argent : le cache ──────────────────────────────────────────────
    base();
    r = await appeler({ corps: { sha: h1 } });
    dit(r.code === 200 && r.corps.hit === false && !r.corps.b64 && etat.photoroom.length === 0, 'une sonde sans octets ne paie rien', JSON.stringify(r.corps));
    r = await appeler({ corps: { sha: h1, b64: 'data:image/jpeg;base64,' + p1.toString('base64') } });
    dit(r.code === 200 && r.corps.hit === false && r.corps.type === 'image/jpeg' && Buffer.from(r.corps.b64, 'base64').equals(DETOUREE), 'première fois : Photoroom détoure, le JPEG revient', `${r.code}`);
    const appel = etat.photoroom[0] || {};
    dit(appel.headers && appel.headers['x-api-key'] === 'pr_test_cle' && appel.corps && appel.corps.image_file_b64 === p1.toString('base64') && appel.corps.format === 'jpg', 'l’appel porte la clé et l’image SANS préfixe data-URL, en JPEG', JSON.stringify({ k: appel.headers && appel.headers['x-api-key'], f: appel.corps && appel.corps.format }));
    r = await appeler({ corps: { sha: h1 } });
    dit(r.code === 200 && r.corps.hit === true && etat.photoroom.length === 1, 'deuxième fois (sonde) : servie par le cache, AUCUN nouvel appel payé', `${etat.photoroom.length} appel(s)`);
    dit([...etat.compteur.values()].reduce((a, b) => a + b, 0) === 1, 'le compteur n’a compté qu’UNE photo', JSON.stringify([...etat.compteur]));
    const cles = [...etat.cache.keys()];
    dit(cles.length === 1 && cles[0].startsWith(PROPRIO + '/' + h1), 'le cache est rangé sous le dossier du vendeur, par empreinte exacte', cles.join());

    // ── Les refus qui protègent ──────────────────────────────────────────
    base();
    const p2 = photo(2);
    r = await appeler({ corps: { sha: h1, b64: p2.toString('base64') } });
    dit(r.code === 400 && etat.photoroom.length === 0 && etat.cache.size === 0, 'une empreinte qui ne correspond pas aux octets : 400 (pas de cache empoisonné)', String(r.code));
    r = await appeler({ corps: { sha: sha(Buffer.from('pas une image du tout')), b64: Buffer.from('pas une image du tout').toString('base64') } });
    dit(r.code === 415 && etat.photoroom.length === 0, 'des octets qui ne sont pas une image : 415', String(r.code));
    r = await appeler({ corps: { sha: h1, b64: 'A'.repeat(3000001) } });
    dit(r.code === 413 && etat.photoroom.length === 0, 'une photo trop lourde pour une fonction Vercel : 413', String(r.code));

    // ── Le plafond ───────────────────────────────────────────────────────
    process.env.PHOTOROOM_PLAFOND_MOIS = '1';
    base();
    r = await appeler({ corps: { sha: h1, b64: p1.toString('base64') } });
    const p3 = photo(3);
    const r2 = await appeler({ corps: { sha: sha(p3), b64: p3.toString('base64') } });
    dit(r.code === 200 && r2.code === 429 && r2.corps.reason === 'plafond' && etat.photoroom.length === 1, 'plafond du mois atteint : 429, et ZÉRO appel de plus', `${r.code}/${r2.code} · ${etat.photoroom.length} appel(s)`);
    delete process.env.PHOTOROOM_PLAFOND_MOIS;
    base({ compteurKO: true });
    r = await appeler({ corps: { sha: h1, b64: p1.toString('base64') } });
    dit(r.code === 503 && r.corps.reason === 'compteur' && etat.photoroom.length === 0, 'compteur illisible : 503, on ne paie PAS à l’aveugle', `${r.code} · ${etat.photoroom.length} appel(s)`);

    // ── Photoroom refuse ─────────────────────────────────────────────────
    for (const s of [402, 403, 500]) {
      base({ reponsePR: s });
      r = await appeler({ corps: { sha: h1, b64: p1.toString('base64') } });
      const attendu = s >= 500 ? 502 : s;
      const total = [...etat.compteur.values()].reduce((a, b) => a + b, 0);
      dit(r.code === attendu && r.corps.ok === false && total === 0 && etat.cache.size === 0, `Photoroom répond ${s} : ${attendu}, l’unité est RENDUE et rien n’est mis en cache`, `${r.code} · compteur ${total}`);
    }

    // ── Deux demandes simultanées de la même photo ───────────────────────
    base();
    const [a, b] = await Promise.all([appeler({ corps: { sha: h1, b64: p1.toString('base64') } }), appeler({ corps: { sha: h1, b64: p1.toString('base64') } })]);
    dit(a.code === 200 && b.code === 200 && etat.photoroom.length === 1, 'deux demandes simultanées de la même photo : UN seul appel payé', `${etat.photoroom.length} appel(s)`);

    // ── Le compteur se lit, jamais inventé ───────────────────────────────
    r = await appeler({ methode: 'GET', query: { usage: '1' } });
    dit(r.code === 200 && r.corps.n === 1 && r.corps.plafond === 150 && r.corps.ready === true, 'GET ?usage=1 : ce qu’il a détouré ce mois-ci, et le plafond', JSON.stringify(r.corps));

    // ── L'IA, elle, ne bouge pas ─────────────────────────────────────────
    base();
    const res = { code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; } };
    await mod.default({ method: 'GET', headers: {}, query: {} }, res);
    dit(res.code === 200 && 'model' in res.corps, 'GET /api/ai sans mode répond comme avant (santé de l’IA)', JSON.stringify(res.corps));
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.stack || e).slice(0, 300)); }
  console.log(`\n${ko ? `❌ ${ko} échec(s)` : '✅ tout est vert'}`);
  process.exit(ko ? 1 : 0);
})();
