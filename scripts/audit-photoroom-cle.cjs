// ════════════════════════════════════════════════════════════════════════════
//  LA CLÉ PHOTOROOM DU VENDEUR, ROUTE EXÉCUTÉE (29 octobre)
//        node scripts/audit-photoroom-cle.cjs [--src dossier]
//
//  Julien : « fais un meilleur visuel pour la clé API Photoroom des personnes
//  qui utilisent VRM ». §2.9 : un détourage se paie — avec la clé DU VENDEUR,
//  rangée côté serveur, chiffrée, jamais relue par le navigateur. §4.10 : une
//  fonction serverless n'est vérifiée que si on l'EXÉCUTE : on charge la VRAIE
//  route `/api/compte?mode=photoroom` ET la vraie route du détourage
//  (`/api/ai?mode=detourage`), devant une fausse base à état (filtre owner,
//  projection select=, upsert, DELETE) et un FAUX Photoroom. Aucun appel réel :
//  toute adresse inconnue LÈVE. Données INVENTÉES (dépôt public).
//
//  Ce qui est exigé :
//    · sans session ⇒ 401, zéro appel à Photoroom, zéro lecture de la clé ;
//    · la clé ne ressort JAMAIS (ni GET, ni POST, ni en clair dans la base) ;
//      seuls ses 4 derniers caractères et la date reviennent ;
//    · un autre vendeur ne la voit pas, et un chiffré recopié ne se lit pas ;
//    · Photoroom refuse la clé (401/403) ⇒ rien n'est rangé ; 402 / muet ⇒
//      rangée, et DIT (sans forfait · pas encore vérifiée) ;
//    · lecture ratée ⇒ 503, jamais « aucune clé » ;
//    · retirer exige la confirmation, efface les DEUX lignes, et le détourage
//      ne s'en sert plus ; base muette ⇒ 503, jamais « retirée » ;
//    · l'ancienne ligne EN CLAIR (26 oct.) est déplacée dans le coffre puis
//      effacée ; le détourage utilise la clé du vendeur, jamais celle de
//      Julien pour un autre vendeur.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const NON_CLOISONNEE = process.argv.includes('--non-cloisonnee');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 160)); } };

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const JWT = { A: 'eyJh.jeton-de-A.sig', B: 'eyJh.jeton-de-B.sig', C: 'eyJh.jeton-de-C.sig' };
const QUI = { [JWT.A]: A, [JWT.B]: B, [JWT.C]: C };
process.env.SUPABASE_SERVICE_KEY = 'cle-service-de-banc';
process.env.VRM_OWNER_UID = C;            // le propriétaire de l'installation n'est NI A NI B
delete process.env.PHOTOROOM_API_KEY;     // la clé « de Julien » : absente ici
delete process.env.PHOTOROOM_POUR;
process.env.PHOTOROOM_VERIF_DELAI_MS = '1500';
const SB = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
// Des clés INVENTÉES.
const CLE_A = 'prA0123456789abcdef0123456789zz1A';
const CLE_A2 = 'prA2bbbbbbbbbbbbbbbbbbbbbbbbbb9Q7';
const CLE_ANC = 'prANCIENNEcccccccccccccccccccccK4X';
const CLES_OK = new Set([CLE_A, CLE_A2, CLE_ANC]);

// ── LA FAUSSE BASE ───────────────────────────────────────────────────────────
let lignes = [], journal = [], mode = {};
const projette = (r, sel) => {
  if (!sel) return r;
  const out = {};
  for (const part of decodeURIComponent(sel).split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id' || src === 'owner') { out[alias] = r[src]; continue; }
    if (src === 'data') { out[alias] = r.data; continue; }
    let v = r.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    if (v != null && /->>/.test(src) && typeof v !== 'string') v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias] = v == null ? null : v;
  }
  return out;
};
const rep = (corps, status = 200, type = 'application/json') => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': type } });
const DETOUREE = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xdb]), Buffer.from('detouree-de-banc')]);

globalThis.fetch = async (url, opts = {}) => {
  const u = String(url), m = (opts.method || 'GET').toUpperCase();
  const h = opts.headers || {};
  if (u === 'https://image-api.photoroom.com/v2/account') {
    journal.push({ ou: 'pr-compte', cle: h['x-api-key'] });
    if (mode.compte === 'coupe') throw new Error('réseau');
    if (mode.compte === 402) return rep({ detail: 'no active plan' }, 402);
    if (mode.compte === 503) return rep('<html>503</html>', 503, 'text/html');
    if (!CLES_OK.has(h['x-api-key'])) return rep({ detail: 'invalid api key' }, 401);
    return rep({ images: { available: 83, subscription: 100 } });
  }
  if (/^https:\/\/sdk\.photoroom\.com\//.test(u)) {
    journal.push({ ou: 'pr-segment', cle: h['x-api-key'] });
    if (!CLES_OK.has(h['x-api-key'])) return rep({ detail: 'invalid api key' }, 403);
    return new Response(DETOUREE, { status: 200, headers: { 'content-type': 'image/jpeg' } });
  }
  if (u === `${SB}/auth/v1/user`) {
    const j = String(h.Authorization || h.authorization || '').replace(/^Bearer /, '');
    return QUI[j] ? rep({ id: QUI[j], email: 'x@exemple.test', email_confirmed_at: 'x' }) : rep({ msg: 'bad jwt' }, 401);
  }
  if (u === `${SB}/rest/v1/app_data?select=owner&limit=1`) return mode.nonCloisonnee ? rep({ message: 'column app_data.owner does not exist' }, 400) : rep([]);
  if (/\/rest\/v1\/rpc\/vrm_acces_pour/.test(u)) { const b = JSON.parse(opts.body || '{}'); return rep(!(mode.coupe && b.u === mode.coupe)); }
  if (/\/rest\/v1\/abonnements/.test(u)) return rep([]);
  if (/\/storage\/v1\/object\/detourage\//.test(u)) {
    if (m === 'GET') return rep({ error: 'not_found' }, 400);
    return rep({ Key: 'x' });
  }
  if (/\/rest\/v1\/rpc\/vrm_detourage_/.test(u)) return rep(1);
  if (/\/rest\/v1\/detourage_usage/.test(u)) return rep([]);
  if (u.startsWith(`${SB}/rest/v1/app_data`)) {
    const q = decodeURIComponent(u.slice(u.indexOf('?') + 1));
    const id = (/(?:^|&)id=eq\.([^&]*)/.exec(q) || [])[1];
    const own = (/(?:^|&)owner=eq\.([^&]*)/.exec(q) || [])[1];
    journal.push({ ou: 'base', m, id, own, corps: String(opts.body || '') });
    if (m === 'GET' && mode.lectureKo && /photoroom/.test(id || '')) return rep({ message: 'boom' }, 500);
    if (m === 'DELETE' && mode.effacerKo && /photoroom/.test(id || '')) return rep({ message: 'boom' }, 500);
    if (m === 'GET') {
      const sel = (/(?:^|&)select=([^&]*)/.exec(q) || [])[1];
      return rep(lignes.filter((r) => (!id || r.id === id) && (!own || r.owner === own)).map((r) => projette(r, sel)));
    }
    if (m === 'DELETE') { lignes = lignes.filter((r) => !((!id || r.id === id) && (!own || r.owner === own))); return new Response(null, { status: 204 }); }
    if (mode.ecrireKo) return rep({ message: 'boom' }, 500);
    let rows = []; try { rows = [].concat(JSON.parse(opts.body || '[]')); } catch (_) {}
    for (const r of rows) { const i = lignes.findIndex((x) => x.id === r.id && x.owner === r.owner); if (i >= 0) lignes[i] = { ...lignes[i], ...r }; else lignes.push({ ...r }); }
    return rep('', 201);
  }
  throw new Error('appel réseau non prévu par le banc : ' + u);
};

const faireRes = () => { const x = { code: null, corps: null }; x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; }; x.setHeader = () => {}; x.send = () => x; x.end = () => x; return x; };

(async () => {
  let compte, ai, oublierAcces = () => {};
  await essaie('chargement', async () => {
    compte = await import('file://' + path.join(RACINE, 'api', 'compte.js'));
    ai = await import('file://' + path.join(RACINE, 'api', 'ai.js'));
    // La règle d'accès garde sa réponse une minute : chaque scénario repart à neuf.
    oublierAcces = (await import('file://' + path.join(RACINE, 'api', '_lib', 'abonnement.js'))).oublierAcces || oublierAcces;
  });
  if (!compte || !ai) { console.log('\n❌ audit-photoroom-cle : les routes n\'ont pas pu être chargées'); process.exit(1); }
  const appel = async (qui, methode, corps) => {
    journal.length = 0; oublierAcces();
    const res = faireRes();
    await compte.default({ method: methode, query: { mode: 'photoroom' }, headers: qui ? { authorization: 'Bearer ' + JWT[qui] } : {}, body: corps }, res);
    return { code: res.code, corps: res.corps || {}, txt: JSON.stringify(res.corps || {}), journal: journal.slice() };
  };
  const PHOTO = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('photo-inventee-de-banc'), Buffer.alloc(32, 7)]);
  const SHA = require('crypto').createHash('sha256').update(PHOTO).digest('hex');
  const detourer = async (qui) => {
    journal.length = 0; oublierAcces();
    const res = faireRes();
    await ai.default({ method: 'POST', query: { mode: 'detourage' }, headers: { authorization: 'Bearer ' + JWT[qui] }, body: { sha: SHA, b64: PHOTO.toString('base64') } }, res);
    return { code: res.code, corps: res.corps || {}, segments: journal.filter((x) => x.ou === 'pr-segment') };
  };
  const pr = (j) => j.filter((x) => /^pr-/.test(x.ou));
  const ligne = (id, o) => lignes.find((r) => r.id === id && r.owner === o);
  const sansCle = (txt, ...cles) => cles.every((k) => !txt.includes(k) && !txt.includes(k.slice(0, -4)));

  if (NON_CLOISONNEE) {
    mode = { nonCloisonnee: true };
    const r = await appel('A', 'POST', { action: 'poser', cle: CLE_A });
    dit(r.code === 503 && !lignes.length && !pr(r.journal).length, 'base PAS cloisonnée ⇒ 503, aucune clé rangée, Photoroom pas appelé', `HTTP ${r.code}`);
    console.log(`${ko ? '❌' : '✅'} non-cloisonnée : ${ok} ok, ${ko} ko`); process.exit(ko ? 1 : 0);
  }

  await essaie('sans session', async () => {
    const g = await appel(null, 'GET'), p = await appel(null, 'POST', { action: 'poser', cle: CLE_A });
    const touche = [...g.journal, ...p.journal].some((x) => /^pr-/.test(x.ou) || /photoroom/.test(x.id || ''));
    dit(g.code === 401 && p.code === 401 && !touche, 'sans session ⇒ 401, zéro appel à Photoroom, zéro lecture de la clé', `GET ${g.code} · POST ${p.code}`);
    dit(!lignes.length, 'sans session ⇒ rien n\'est rangé');
  });

  await essaie('aucune clé', async () => {
    const r = await appel('A', 'GET');
    dit(r.code === 200 && r.corps.etat === 'aucune' && r.corps.coffre === true && r.corps.fin == null, 'aucune clé ⇒ « aucune » (LU), coffre prêt', r.txt.slice(0, 140));
    dit(!pr(r.journal).length, 'lire le statut n\'appelle pas Photoroom');
  });

  await essaie('clé mal formée', async () => {
    const r = await appel('A', 'POST', { action: 'poser', cle: 'courte' });
    dit(r.code === 400 && !pr(r.journal).length && !ligne('photoroom_cle', A), 'une clé mal formée ⇒ 400, Photoroom n\'est pas appelé, rien rangé', `HTTP ${r.code}`);
  });

  await essaie('clé refusée', async () => {
    const faux = 'prFAUXffffffffffffffffffffffff0000';
    const r = await appel('A', 'POST', { action: 'poser', cle: faux });
    dit(r.code === 400 && r.corps.erreur === 'refusee' && !ligne('photoroom_cle', A), 'Photoroom refuse la clé (401) ⇒ 400 « refusée », RIEN rangé', `HTTP ${r.code}`);
    dit(sansCle(r.txt, faux), 'la clé refusée ne revient pas dans la réponse');
  });

  await essaie('poser A', async () => {
    const r = await appel('A', 'POST', { action: 'poser', cle: '  ' + CLE_A + '  ' });
    dit(r.code === 200 && r.corps.etat === 'posee' && r.corps.fin === CLE_A.slice(-4), 'clé acceptée ⇒ 200 « rangée », ses 4 derniers caractères seulement', r.txt.slice(0, 160));
    dit(r.corps.verif === 'ok' && r.corps.restant === 83, 'la vérification chez Photoroom est rendue (acceptée, 83 images restantes)', `${r.corps.verif} · ${r.corps.restant}`);
    const c = pr(r.journal).find((x) => x.ou === 'pr-compte');
    dit(!!c && c.cle === CLE_A, 'la vérification lit le COMPTE Photoroom (gratuit) avec la clé collée, sans espaces', c && c.cle === CLE_A ? 'ok' : JSON.stringify(c));
    dit(!pr(r.journal).some((x) => x.ou === 'pr-segment'), 'ranger la clé ne détoure aucune photo (aucune image dépensée)');
    dit(sansCle(r.txt, CLE_A) && !/chiffre|v1\./.test(r.txt), 'la réponse ne contient ni la clé ni le chiffré', r.txt.slice(0, 160));
    const l = ligne('photoroom_cle', A), brut = JSON.stringify(l || {});
    dit(!!l && /^v1\./.test(l.data.chiffre || '') && !brut.includes(CLE_A), 'rangée chez A, CHIFFRÉE (la clé n\'est jamais en clair dans la base)', brut.slice(0, 100));
    dit(!ligne('vrm_photoroom_cle', A), 'aucune ligne en clair (l\'ancienne forme) n\'est écrite');
  });

  await essaie('statut A', async () => {
    const r = await appel('A', 'GET');
    dit(r.code === 200 && r.corps.etat === 'posee' && r.corps.fin === CLE_A.slice(-4) && !!r.corps.at, 'statut ⇒ rangée · 4 derniers caractères · date', r.txt.slice(0, 160));
    dit(sansCle(r.txt, CLE_A) && !/chiffre/.test(r.txt) && !r.txt.includes(ligne('photoroom_cle', A).data.chiffre), 'le statut ne renvoie JAMAIS la clé, ni le chiffré');
    dit(!pr(r.journal).length, 'lire le statut n\'appelle pas Photoroom');
  });

  await essaie('un autre vendeur', async () => {
    const r = await appel('B', 'GET');
    dit(r.code === 200 && r.corps.etat === 'aucune' && !r.txt.includes(CLE_A.slice(-4)), 'B ne voit pas la clé de A (« aucune »)', r.txt.slice(0, 120));
    const d = await detourer('B');
    dit(d.code === 403 && !d.segments.length, 'B (ni clé à lui, ni propriétaire) ⇒ 403, aucune photo envoyée à Photoroom', `HTTP ${d.code} · ${d.segments.length} appel(s)`);
    // Un chiffré recopié chez B ne se déchiffre pas (l'identifiant du vendeur est
    // la donnée associée).
    const copie = JSON.parse(JSON.stringify(ligne('photoroom_cle', A)));
    lignes.push({ ...copie, owner: B });
    const r2 = await appel('B', 'GET');
    dit(r2.code === 200 && r2.corps.etat === 'illisible', 'le chiffré de A recopié chez B ne se lit pas (« illisible »)', r2.txt.slice(0, 120));
    const d2 = await detourer('B');
    dit(!d2.segments.some((x) => x.cle === CLE_A), 'le détourage de B ne part JAMAIS avec la clé de A', JSON.stringify(d2.segments));
    lignes = lignes.filter((x) => x.owner !== B);
  });

  await essaie('détourage avec SA clé', async () => {
    const d = await detourer('A');
    dit(d.code === 200 && d.segments.length === 1 && d.segments[0].cle === CLE_A, 'le détourage de A part avec SA clé (déchiffrée côté serveur)', `HTTP ${d.code} · ${JSON.stringify(d.segments)}`);
    dit(!JSON.stringify(d.corps).includes(CLE_A), 'la réponse du détourage ne contient pas la clé');
  });

  await essaie('lecture ratée', async () => {
    mode = { lectureKo: true };
    const r = await appel('A', 'GET');
    mode = {};
    dit(r.code === 503 && r.corps.etat === undefined, 'la base ne répond pas ⇒ 503 « pas su », jamais « aucune clé »', `HTTP ${r.code} ${r.txt.slice(0, 80)}`);
  });

  await essaie('verifier', async () => {
    mode = { compte: 402 };
    const r = await appel('A', 'POST', { action: 'verifier' });
    mode = {};
    dit(r.code === 200 && r.corps.verif === 'sans-forfait' && r.corps.restant === null, 'vérifier : Photoroom 402 ⇒ « sans forfait », aucun nombre inventé', r.txt.slice(0, 140));
    const r2 = await appel('A', 'GET');
    dit(r2.corps.verif === 'sans-forfait', 'la réponse de Photoroom est notée (relue au statut)');
  });

  await essaie('poser : Photoroom 402 / muet', async () => {
    mode = { compte: 402 };
    const r = await appel('A', 'POST', { action: 'poser', cle: CLE_A2 });
    mode = { compte: 'coupe' };
    const r2 = await appel('A', 'POST', { action: 'poser', cle: CLE_A2 });
    mode = { compte: 503 };
    const r3 = await appel('A', 'POST', { action: 'poser', cle: CLE_A2 });
    mode = {};
    dit(r.code === 200 && r.corps.verif === 'sans-forfait', 'Photoroom 402 ⇒ rangée, et dite « sans forfait API »', r.txt.slice(0, 120));
    dit(r2.code === 200 && r2.corps.verif === 'pas-su' && r3.code === 200 && r3.corps.verif === 'pas-su', 'Photoroom muet (coupure, 503) ⇒ rangée, « pas encore vérifiée » — jamais « acceptée »', `${r2.corps.verif} · ${r3.corps.verif}`);
    dit(r3.corps.fin === CLE_A2.slice(-4), 'remplacer : la nouvelle clé prend la place (ses 4 derniers caractères)');
  });

  await essaie('base qui n\'écrit pas', async () => {
    mode = { ecrireKo: true };
    const r = await appel('A', 'POST', { action: 'poser', cle: CLE_A });
    mode = {};
    dit(r.code === 503 && r.corps.etat === undefined, 'l\'écriture échoue ⇒ 503, jamais « rangée »', `HTTP ${r.code}`);
  });

  await essaie('abonnement coupé', async () => {
    mode = { coupe: A };
    const r = await appel('A', 'POST', { action: 'poser', cle: CLE_A });
    mode = {};
    dit(r.code === 402 && !pr(r.journal).length, 'abonnement coupé ⇒ poser refusé (402), Photoroom pas appelé', `HTTP ${r.code}`);
  });

  await essaie('retirer', async () => {
    const r0 = await appel('A', 'POST', { action: 'retirer' });
    dit(r0.code === 400 && !!ligne('photoroom_cle', A), 'retirer SANS confirmation ⇒ 400, la clé reste', `HTTP ${r0.code}`);
    mode = { effacerKo: true };
    const r1 = await appel('A', 'POST', { action: 'retirer', confirme: true });
    mode = {};
    dit(r1.code === 503 && r1.corps.etat !== 'aucune', 'base muette au retrait ⇒ 503, jamais « retirée »', `HTTP ${r1.code}`);
    // Une ancienne ligne EN CLAIR restée (son effacement avait échoué) : retirer
    // doit l'effacer aussi, sinon le détourage s'en servirait encore.
    lignes.push({ owner: A, id: 'vrm_photoroom_cle', data: { cle: CLE_A, at: '2026-10-28T22:50:01.924Z' } });
    mode = { coupe: A };
    const r = await appel('A', 'POST', { action: 'retirer', confirme: true });
    mode = {};
    dit(r.code === 200 && r.corps.etat === 'aucune' && !ligne('photoroom_cle', A) && !ligne('vrm_photoroom_cle', A), 'retirer (même abonnement coupé) ⇒ les lignes de la clé sont EFFACÉES', `HTTP ${r.code}`);
    const g = await appel('A', 'GET');
    dit(g.corps.etat === 'aucune', 'après le retrait, le statut dit « aucune »');
    const d = await detourer('A');
    dit(!d.segments.length && d.code !== 200, 'après le retrait, le détourage ne se sert PLUS de la clé', `HTTP ${d.code} · ${d.segments.length} appel(s)`);
  });

  await essaie('ancienne ligne en clair', async () => {
    lignes.push({ owner: A, id: 'vrm_photoroom_cle', data: { cle: CLE_ANC, at: '2026-10-28T22:50:01.924Z' } });
    const d0 = await detourer('A');
    dit(d0.code === 200 && d0.segments[0] && d0.segments[0].cle === CLE_ANC, 'tant qu\'elle n\'est pas déplacée, l\'ancienne clé sert encore au détourage', `HTTP ${d0.code}`);
    const r = await appel('A', 'GET');
    dit(r.code === 200 && r.corps.etat === 'posee' && r.corps.migree === true && r.corps.fin === CLE_ANC.slice(-4), 'à la première lecture, elle est DÉPLACÉE dans le coffre (« migrée »)', r.txt.slice(0, 160));
    dit(!ligne('vrm_photoroom_cle', A), 'puis la ligne en clair est EFFACÉE');
    const l = ligne('photoroom_cle', A);
    dit(!!l && !JSON.stringify(l).includes(CLE_ANC) && l.data.at === '2026-10-28T22:50:01.924Z', 'rangée chiffrée, avec sa date d\'origine');
    dit(sansCle(r.txt, CLE_ANC), 'la migration ne renvoie pas la clé');
    const d = await detourer('A');
    dit(d.code === 200 && d.segments[0] && d.segments[0].cle === CLE_ANC, 'le détourage continue avec SA clé, lue dans le coffre');
  });

  await essaie('sans coffre', async () => {
    const s = process.env.SUPABASE_SERVICE_KEY; delete process.env.SUPABASE_SERVICE_KEY; delete process.env.VRM_COFFRE_CLE;
    const r = await appel('B', 'POST', { action: 'poser', cle: CLE_A2 });
    process.env.SUPABASE_SERVICE_KEY = s;
    dit(r.code === 503 && r.corps.erreur === 'coffre' && !ligne('photoroom_cle', B) && !ligne('vrm_photoroom_cle', B), 'sans clé de coffre ⇒ 503, RIEN rangé (jamais en clair)', `HTTP ${r.code} ${r.corps.erreur}`);
  });

  await essaie('base non cloisonnée', async () => {
    // La sonde de cloisonnement est mémorisée par instance : un processus neuf.
    const out = require('child_process').spawnSync(process.execPath, [__filename, '--non-cloisonnee', ...(iSrc > 0 ? ['--src', RACINE] : [])], { encoding: 'utf8' });
    dit(out.status === 0, 'base PAS cloisonnée ⇒ 503, aucune clé rangée (processus neuf)', (out.stdout || '').trim().split('\n').pop());
  });

  console.log(`\n${ko ? '❌' : '✅'} audit-photoroom-cle : ${ok} contrôles ok, ${ko} ko`);
  process.exit(ko ? 1 : 0);
})();

