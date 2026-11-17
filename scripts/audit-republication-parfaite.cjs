// ════════════════════════════════════════════════════════════════════════════
//  REPUBLIER DE L'ANNONCE AU BROUILLON, DU BROUILLON À EN LIGNE — « PARFAIT »
//  (17 nov., extension 5.408 — `repubetapes`, `repubreprise`)
//
//  Julien : « tout doit être parfait, ça c'est pas du tout le cas, occupe-toi aussi de la
//  republication, de annonce à brouillon et de brouillon à en ligne ».
//  Mesuré en base (lecture seule, 17 nov.) : 10 republications, 10 brouillons, 10 anciennes
//  supprimées, 0 mise en ligne du premier coup (refus 400 « photos » à la mise en ligne) ;
//  5 restées « supprimée, brouillon prêt, jamais en ligne » 16 jours ; 4 « fait » qui
//  portaient encore « refuse-400 » ; 1 « a-publier » déjà en ligne (« Publier » n'écrivait
//  pas le coffre de l'ancienne).
//
//  On EXÉCUTE le vrai background.js (scripts/_fond-vm.cjs : faux Vinted à réponses de la
//  forme de Vinted, fausse base à état, chrome.storage.local à état) et la vraie règle de
//  l'app (src/repubEtapes.js, src/repriseNumero.js). Données inventées (dépôt public).
//    A  la suite complète, dans l'ordre ; chaque étape DATÉE sur sa preuve ; cause effacée
//    B  reprise après un service worker tué à CHAQUE étape (jamais deux mises en ligne)
//    C  aucun second brouillon
//    D  « Recréer depuis le coffre »
//    E  le N° passe sur la nouvelle (par identité)
//    F  les gardes : 50/h, le jour, REPUB_PAR_JOUR, le frein, la pause, le compte de l'onglet
//    G  ce qui est retiré reste retiré
//    H  la règle de l'app (chaîne, plan, bilan : un geste par problème)
//    I  l'écran plein sur vinted.fr suit l'étape de la paire
//  `--prouve` : rouge sur la branche de départ (origin/claude/extension-carte-v2) ET par
//  mutation (chaque règle réaffaiblie ⇒ rouge).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const RACINE = path.join(__dirname, '..');
const argSrc = (() => { const i = process.argv.indexOf('--bg'); return i > 0 ? process.argv[i + 1] : process.env.BG_SRC || ''; })();
const argApp = (() => { const i = process.argv.indexOf('--app'); return i > 0 ? process.argv[i + 1] : ''; })();
const BG = argSrc || path.join(RACINE, 'vinted-sync-extension', 'background.js');
const APP_ETAPES = argApp || path.join(RACINE, 'src', 'repubEtapes.js');

let ok = 0, ko = 0; const rouges = [];
const dit = (c, msg, det) => { if (c) { ok++; if (!process.env.SILENCE) console.log('✅ ' + msg); } else { ko++; rouges.push(msg); if (!process.env.SILENCE) console.log('❌ ' + msg + (det ? '  → ' + det : '')); } };
const nowISO = () => new Date().toISOString();
const MODELE = JSON.stringify({ item: { id: 9101, title: 'Basket test 42', description: 'Très bon état, boîte', price: '60.0', currency: 'EUR', catalog_id: 1234, brand_id: 53, color_ids: [1], item_attributes: [{ code: 'size', ids: [56] }, { code: 'condition', ids: [2] }], package_size_id: 1, assigned_photos: [{ id: 1 }] } });
const PHOTOS = ['https://images1.vinted.net/t/01_0121e_testAAAA0001/f800/1.jpeg', 'https://images1.vinted.net/t/02_02248_testBBBB0002/f800/2.jpeg'];
const CORPS_B = (draftId = 88001) => JSON.stringify({ draft: { id: draftId, title: 'Basket test 42', description: 'Très bon état, boîte', price: '54', currency: 'EUR', catalog_id: 1234, brand_id: 53, color_ids: [1], item_attributes: [{ code: 'size', ids: [56] }, { code: 'condition', ids: [2] }], package_size_id: 1, assigned_photos: [{ id: 501, orientation: 0 }, { id: 502, orientation: 0 }] }, feedback_id: null, parcel: null, push_up: false, upload_session_id: '00000000-0000-4000-8000-000000000000' });

// Un faux Vinted À ÉTAT : l'ancienne (9101) disparaît quand sa suppression est acceptée ;
// le brouillon (88001) passe « en ligne » quand sa mise en ligne est acceptée.
function monter(o = {}) {
  const v = { ancienne: o.ancienne || 'en-ligne', brouillon: o.brouillonVu || 'brouillon', nPhotos: 500 };
  const lignes = { main: { capturedAt: nowISO(), vinted_annonce_numeros: { '9101': { numero: '41' } } }, vinted_item_details: {}, vrm_vinted_modele: { '9101': { corps: MODELE, at: nowISO(), uid: '111' } } };
  if (o.coffre !== false) lignes.coffre_111_9101 = { id: '9101', uid: '111', title: 'Basket test 42', price: 60, desc: 'Très bon état, boîte', photos: PHOTOS, ...(o.vb ? { versBrouillon: o.vb } : {}) };
  if (o.brouillonLigne) lignes.vinted_brouillon_88001 = { id: '88001', uid: '111', corps: CORPS_B(), titre: 'Basket test 42', prix: 54, nPhotos: 2, parVRM: true, ancienId: '9101', etat: 'brouillon', at: nowISO() };
  if (o.extra) Object.assign(lignes, o.extra);
  const st = (x) => (typeof x === 'function' ? x() : x);
  const fond = faireFond({ src: o.src || BG, lignes, connecte: o.connecte || '111', store: o.store || {},
    cdn: () => ({ status: 200 }),
    vinted: (e) => {
      if (e.methode === 'GET' && /\/item_upload\/(colors)$/.test(e.chemin)) return { status: 404, body: {} };
      if (e.methode === 'POST' && /\/item_upload\/attributes$/.test(e.chemin)) return { status: 404, body: {} };
      if (e.methode === 'GET' && /\/api\/v2\/item_upload\/items\/9101$/.test(e.chemin)) return v.ancienne === 'en-ligne' ? { status: 200, body: { item: { id: 9101, is_draft: false } } } : v.ancienne === '5xx' ? { status: 503, body: {} } : { status: 404, body: {} };
      if (e.methode === 'GET' && /\/api\/v2\/item_upload\/items\/88001$/.test(e.chemin)) {
        if (o.lectureBrouillon) return st(o.lectureBrouillon);
        return v.brouillon === 'parti' ? { status: 404, body: {} } : { status: 200, body: { item: { id: 88001, is_draft: v.brouillon !== 'en-ligne' } } };
      }
      if (e.methode === 'GET' && /\/api\/v2\/item_upload\/items\/\d+$/.test(e.chemin)) return { status: 200, body: { item: { id: Number(e.chemin.split('/').pop()) } } };
      if (e.methode === 'POST' && /\/api\/v2\/photos$/.test(e.chemin)) return { status: 200, body: { id: ++v.nPhotos } };
      if (e.methode === 'POST' && /\/api\/v2\/item_upload\/drafts\/?$/.test(e.chemin)) { const s = st(o.brouillon || 200); return { status: s, body: s === 200 ? { draft: { id: 88001 } } : { code: 0 } }; }
      if (e.methode === 'POST' && /\/api\/v2\/item_upload\/drafts\/\d+\/completion$/.test(e.chemin)) { const s = st(o.completion || 200); if (s === 200) v.brouillon = 'en-ligne'; return { status: s, body: s === 200 ? { item: { id: 88001 } } : { code: 0, message: 'refus de test' } }; }
      if (e.methode === 'POST' && /\/api\/v2\/items\/9101\/delete$/.test(e.chemin)) { const s = st(o.suppression || 200); if (s === 200) v.ancienne = 'partie'; return { status: s, body: {} }; }
      return { status: 404, body: {} };
    } });
  fond.v = v;
  return fond;
}
const LECT = /\/item_upload\/(colors|attributes)$/;
const gestes = (j) => j.vinted.filter((x) => !LECT.test(x.chemin));
const seq = (j) => gestes(j).map((x) => x.methode === 'GET' && /items\/9101$/.test(x.chemin) ? 'A' : x.methode === 'GET' && /items\/88001$/.test(x.chemin) ? 'L' : x.methode === 'GET' ? 'G' : /photos$/.test(x.chemin) ? 'P' : /completion$/.test(x.chemin) ? 'M' : /drafts\/?$/.test(x.chemin) ? 'B' : /delete$/.test(x.chemin) ? 'S' : /item_upload\/items\/?$/.test(x.chemin) ? 'C' : '?').join('');
const n = (j, c) => seq(j).split('').filter((x) => x === c).length;
const vb = (f) => (f.lignes.coffre_111_9101 && f.lignes.coffre_111_9101.versBrouillon) || {};
const recreer = (f, extra = {}) => f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', num: '41', prix: 54, titre: 'Basket test 42', viaBrouillon: true, differer: true, confirme: true, ...extra }).catch((e) => ({ erreur: String(e && e.message) }));
const reprendre = (f, extra = {}) => (typeof f.ctx.reprendreRepub === 'function' ? f.ctx.reprendreRepub({ cmd: 'reprendreRepub', uid: '111', id: '9101', num: '41', confirme: true, ...extra }).catch((e) => ({ erreur: String(e && e.message) })) : Promise.resolve({ absent: true }));
const tick = async (f) => { try { await f.ctx.miseEnLigneTick(); } catch (_) {} };
const echeance = (f) => { const a = f.store.vrmRepubAttente || {}; for (const k of Object.keys(a)) a[k].du = 0; };
const finDe = (f) => f.j.evts.filter((e) => e && e.quoi === 'repub' && e.id === '9101' && e.etape === 'fin').map((e) => e.fin).pop() || null;
const VB = (x) => ({ corps: CORPS_B(), at: new Date(Date.now() - 20 * 60000).toISOString(), majAt: new Date(Date.now() - 15 * 60000).toISOString(), titre: 'Basket test 42', prix: 54, publier: true, uid: '111', ...x });
const jobInterrompu = (phase, ilYaMs) => ({ vrmRepubAttente: { '9101': { id: '9101', uid: '111', num: '41', draftId: '88001', titre: 'Basket test 42', prix: 54, nPhotos: 2, urls: PHOTOS, corpsCV: CORPS_B(), corps: '{}', description: 'Très bon état, boîte', sauve: null, tRes: Date.now() - 5 * 60000, du: Date.now() - 6 * 60000, enCoursLe: Date.now() - ilYaMs, ...(phase ? { phase } : {}) } } });

async function auditer() {
  // ── A — la suite complète, dans l'ordre (coffre → brouillon → suppression → mise en ligne planifiée)
  { const f = monter(); const r = await recreer(f);
    const s1 = seq(f.j);
    dit(r.etape === 'attente' && /^A?P+BS$/.test(s1), "A1 — lecture, photos, brouillon, PUIS la suppression ; la mise en ligne est planifiée (1 à 3 min)", `etape=${r.etape} seq=${s1} ${r.raison || r.erreur || ''}`);
    const e = vb(f).etapes || {};
    const t = (x) => Date.parse(x || '');
    dit(t(e.coffre) <= t(e.brouillon) && t(e.brouillon) <= t(e.supprimee) && Number(e.planifiee) === Number(r.jusqua), "A2 — chaque étape PROUVÉE est datée dans le coffre : coffre ≤ brouillon ≤ supprimée, mise en ligne prévue à l'heure dite", JSON.stringify(e));
    echeance(f); await tick(f);
    const fin = finDe(f), e2 = vb(f).etapes || {};
    dit(seq(f.j) === s1 + 'LM' && fin && fin.etape === 'fait' && vb(f).etat === 'fait' && e2.enLigne && !('cause' in vb(f)), "A3 — à l'heure : lecture du brouillon puis mise en ligne ; « fait », daté « en ligne », sans cause", `seq=${seq(f.j)} fin=${fin && fin.etape} vb=${JSON.stringify({ e: vb(f).etat, c: vb(f).cause, l: e2.enLigne })}`);
    // E — le N° passe sur la nouvelle, PAR IDENTITÉ (la table de l'app relit brouillon et coffre).
    const { tableRecrees, repriseNumerosRecreation } = await import(path.join(RACINE, 'src', 'repriseNumero.js'));
    const br = Object.entries(f.lignes).filter(([k]) => /^vinted_brouillon_/.test(k)).map(([k, d]) => ({ id: k, anc: d.ancienId, item: d.itemId }));
    const cf = Object.entries(f.lignes).filter(([k]) => /^coffre_/.test(k)).map(([k, d]) => ({ id: k, r: d.recreeDe }));
    const table = tableRecrees(br, cf);
    const rep = repriseNumerosRecreation({ enLigneIds: ['88001'], numeros: { '9101': { numero: '41' } }, recrees: table });
    dit(rep['88001'] && rep['88001'].numero === '41' && f.lignes.coffre_111_88001 && f.lignes.coffre_111_88001.recreeDe === '9101', "E1 — le N°41 passe sur la nouvelle annonce par son identifiant (brouillon → ancienne, coffre « recreeDe »)", JSON.stringify({ table, rep: rep['88001'] && rep['88001'].numero }));
    const n0 = gestes(f.j).length; await tick(f); const r2 = await reprendre(f);
    dit(gestes(f.j).length === n0 && r2 && r2.etape === 'fait' && r2.deja === true, "C1 — un réveil de plus, puis « Reprendre » sur une paire faite : rien n'est renvoyé (idempotent)", `n=${gestes(f.j).length - n0} r=${JSON.stringify(r2)}`); }

  // A4 — la cause d'un refus d'AVANT est effacée quand la paire finit (mesuré : 4 « fait » portaient « refuse-400 »).
  { let c = 400; const f = monter({ completion: () => c }); await recreer(f); echeance(f); await tick(f);
    const avant = { e: vb(f).etat, c: vb(f).cause };
    f.store.vrmFreinRepub = {}; c = 200;
    const r = await reprendre(f);
    dit(avant.e === 'a-publier' && /^refuse-400/.test(avant.c || '') && r && r.etape === 'fait' && vb(f).etat === 'fait' && !('cause' in vb(f)), "A4 — mise en ligne refusée (400) puis reprise : « fait » ne garde plus « refuse-400 »", JSON.stringify({ avant, apres: { e: vb(f).etat, c: vb(f).cause }, r: r && (r.etape || r.code), raison: r && r.raison }));
    dit(n(f.j, 'B') === 1 && n(f.j, 'S') === 1 && n(f.j, 'M') === 2, "C2 — la reprise met en ligne le brouillon EXISTANT : un seul brouillon, une seule suppression", `seq=${seq(f.j)}`); }

  // ── B — reprise après un service worker tué à chaque étape
  // B1 : tué avant le brouillon (coffre écrit, rien d'autre) — l'ancienne est encore là ⇒ rien ne part.
  { const f = monter({ vb: VB({ etat: 'enregistre' }) }); const r = await reprendre(f);
    dit(r && r.etape === 'intacte' && n(f.j, 'S') === 0 && n(f.j, 'B') === 0 && n(f.j, 'M') === 0 && vb(f).etat === 'fait', "B1 — tué avant le brouillon : l'ancienne est relue, toujours en ligne ⇒ rien n'est supprimé ni créé, et c'est dit", JSON.stringify({ r: r && (r.etape || r.code || r.absent), seq: seq(f.j), e: vb(f).etat })); }
  // B2 : tué après le brouillon, avant la suppression ⇒ « Reprendre » supprime (SON clic) puis met CE brouillon en ligne.
  { const f = monter({ vb: VB({ etat: 'brouillon-range', draftId: '88001', supprime: false }), brouillonLigne: true }); const r = await reprendre(f);
    const s = seq(f.j);
    dit(r && r.etape === 'fait' && s.indexOf('A') === 0 && s.indexOf('S') > 0 && s.indexOf('S') < s.indexOf('M') && n(f.j, 'B') === 0 && n(f.j, 'M') === 1, "B2 — tué entre brouillon et suppression : l'ancienne relue, supprimée, PUIS le brouillon existant en ligne (aucun second brouillon)", JSON.stringify({ r: r && (r.etape || r.code || r.absent), raison: r && r.raison, seq: s })); }
  // B3 : tué après la suppression, avant de planifier ⇒ le brouillon en ligne, sans rien supprimer de plus.
  { const f = monter({ ancienne: 'partie', vb: VB({ etat: 'brouillon-range', draftId: '88001', supprime: true }), brouillonLigne: true }); const r = await reprendre(f);
    dit(r && r.etape === 'fait' && n(f.j, 'S') === 0 && n(f.j, 'B') === 0 && n(f.j, 'M') === 1, "B3 — tué après la suppression : le brouillon existant mis en ligne, rien d'autre", JSON.stringify({ r: r && (r.etape || r.code || r.absent), raison: r && r.raison, seq: seq(f.j) })); }
  // B4 : tué pendant la mise en ligne planifiée, AVANT l'envoi ⇒ elle repart, une fois.
  { const f = monter({ ancienne: 'partie', vb: VB({ etat: 'brouillon-range', draftId: '88001', supprime: true }), brouillonLigne: true, store: jobInterrompu('lecture', 20000) }); await tick(f);
    const fin = finDe(f);
    dit(n(f.j, 'M') === 1 && fin && fin.etape === 'fait' && !Object.keys(f.store.vrmRepubAttente || {}).length, "B4 — tué avant d'envoyer la mise en ligne : elle repart et aboutit, une seule fois", JSON.stringify({ seq: seq(f.j), fin: fin && fin.etape })); }
  // B5 : tué APRÈS l'envoi ; le brouillon relu est en ligne ⇒ fait, rien de renvoyé.
  { const f = monter({ ancienne: 'partie', brouillonVu: 'en-ligne', vb: VB({ etat: 'brouillon-range', draftId: '88001', supprime: true }), brouillonLigne: true, store: jobInterrompu('envoi', 3 * 60000) }); await tick(f);
    const fin = finDe(f);
    dit(n(f.j, 'M') === 0 && n(f.j, 'L') === 1 && fin && fin.etape === 'fait' && vb(f).etat === 'fait', "B5 — tué après l'envoi, le brouillon relu est en ligne : « fait », rien n'est renvoyé", JSON.stringify({ seq: seq(f.j), fin: fin && fin.etape, e: vb(f).etat })); }
  // B6 : tué après l'envoi ; le brouillon relu est ENCORE un brouillon ⇒ la mise en ligne repart, une fois.
  { const f = monter({ ancienne: 'partie', vb: VB({ etat: 'brouillon-range', draftId: '88001', supprime: true }), brouillonLigne: true, store: jobInterrompu('envoi', 3 * 60000) }); await tick(f);
    const fin = finDe(f);
    dit(n(f.j, 'M') === 1 && fin && fin.etape === 'fait', "B6 — tué après l'envoi, le brouillon relu est encore un brouillon : la mise en ligne repart, une seule fois", JSON.stringify({ seq: seq(f.j), fin: fin && fin.etape })); }
  // B7 : tué il y a 30 s seulement : la requête peut encore aboutir ⇒ on attend, rien n'est lu ni renvoyé.
  { const f = monter({ ancienne: 'partie', vb: VB({ etat: 'brouillon-range', draftId: '88001', supprime: true }), brouillonLigne: true, store: jobInterrompu('envoi', 30000) }); await tick(f);
    dit(gestes(f.j).length === 0 && f.store.vrmRepubAttente && f.store.vrmRepubAttente['9101'], "B7 — tué il y a 30 s : on attend que la requête ait fini (rien lu, rien renvoyé, le job reste)", `seq=${seq(f.j)}`); }
  // B8 : tué après l'envoi ; la relecture ne dit rien de clair ⇒ « incertain », rien renvoyé (comme avant).
  { const f = monter({ ancienne: 'partie', lectureBrouillon: { status: 200, body: { item: { id: 88001 } } }, vb: VB({ etat: 'brouillon-range', draftId: '88001', supprime: true }), brouillonLigne: true, store: jobInterrompu('envoi', 3 * 60000) }); await tick(f);
    const fin = finDe(f);
    dit(n(f.j, 'M') === 0 && fin && fin.etape === 'incertain', "B8 — relecture sans réponse claire : « incertain », jamais une seconde mise en ligne", JSON.stringify({ seq: seq(f.j), fin: fin && fin.etape })); }
  // B9 : « mise en ligne incertaine » puis « Reprendre » : le brouillon relu est en ligne ⇒ fait, 0 envoi.
  { const f = monter({ ancienne: 'partie', brouillonVu: 'en-ligne', vb: VB({ etat: 'mise-en-ligne-incertaine', draftId: '88001', supprime: true }), brouillonLigne: true }); const r = await reprendre(f);
    dit(r && r.etape === 'fait' && n(f.j, 'M') === 0 && vb(f).etat === 'fait', "B9 — mise en ligne restée sans réponse : « Reprendre » relit le brouillon, il est en ligne ⇒ fait, rien renvoyé", JSON.stringify({ r: r && (r.etape || r.code || r.absent), seq: seq(f.j) })); }
  // B10 : l'alarme À L'HEURE est posée (un service worker endormi perd sa minuterie).
  { const f = monter(); const al = []; const c0 = f.ctx.chrome.alarms && f.ctx.chrome.alarms.create; if (f.ctx.chrome.alarms) f.ctx.chrome.alarms.create = (nom, o) => { al.push([nom, o]); };
    const r = await recreer(f); await new Promise((ok) => setTimeout(ok, 30));
    const a = al.find(([nom]) => nom === 'vrm-mise-en-ligne');
    dit(r.etape === 'attente' && a && Math.abs(Number(a[1].when) - Number(r.jusqua)) < 5000, "B10 — une alarme Chrome est posée à l'heure de la mise en ligne (pas seulement une minuterie)", JSON.stringify({ a, du: r.jusqua }));
    if (c0) f.ctx.chrome.alarms.create = c0; }

  // ── C — aucun second brouillon
  { const f = monter(); await recreer(f); const r2 = await recreer(f);
    dit(n(f.j, 'B') === 1 && r2 && r2.accepte === false, "C3 — relancer la même paire pendant sa republication : refusé, un seul brouillon", JSON.stringify({ seq: seq(f.j), code: r2 && r2.code })); }
  { const f = monter(); await recreer(f); const r2 = await reprendre(f);
    dit(r2 && r2.accepte === false && r2.code === 'planifiee' && n(f.j, 'M') === 0, "C4 — « Reprendre » une paire dont la mise en ligne est déjà programmée : refusé, rien envoyé", JSON.stringify(r2)); }

  // ── D — « Recréer depuis le coffre » : supprimée, brouillon disparu de Vinted ⇒ un brouillon refait depuis VRM, puis en ligne.
  { const t = new Date().toISOString();
    const f = monter({ ancienne: 'partie', vb: VB({ etat: 'a-publier', draftId: '88001', supprime: true, corps: CORPS_B() }), brouillonLigne: false,
      extra: { harvest_111_listings: { capturedAt: t, payload: { items: [], pagination: { total_entries: 0 } } } } });
    f.lignes.coffre_111_9101.versBrouillon.majAt = new Date(Date.now() - 30 * 60000).toISOString();
    const r = await reprendre(f);
    dit(r && r.etape === 'fait' && n(f.j, 'S') === 0 && n(f.j, 'B') === 1 && n(f.j, 'P') >= 1 && n(f.j, 'M') === 1, "D1 — brouillon disparu : « Recréer depuis le coffre » refait UN brouillon avec les photos du coffre et le met en ligne (l'ancienne déjà partie)", JSON.stringify({ r: r && (r.etape || r.code || r.absent), raison: r && r.raison, seq: seq(f.j) })); }

  // ── P — « Publier » / « Brouillons → en ligne » d'un brouillon de republication règle l'ancienne.
  { const f = monter({ ancienne: 'partie', vb: VB({ etat: 'a-publier', draftId: '88001', supprime: true }), brouillonLigne: true });
    const r = await f.ctx.publierBrouillon({ cmd: 'publierBrouillon', uid: '111', draftId: '88001', confirme: true }).catch((e) => ({ erreur: e.message }));
    dit(r && r.etape === 'fait' && vb(f).etat === 'fait' && vb(f).nouvelId === '88001' && f.lignes.coffre_111_88001 && f.lignes.coffre_111_88001.recreeDe === '9101', "P1 — mis en ligne par « Publier » : le coffre de l'ancienne dit « fait » (mesuré : 1 « a-publier » déjà en ligne) et la nouvelle a son lien", JSON.stringify({ r: r && (r.etape || r.code), e: vb(f).etat, nv: vb(f).nouvelId, c: f.lignes.coffre_111_88001 && f.lignes.coffre_111_88001.recreeDe })); }

  // ── F — les gardes
  { const f = monter({ vb: VB({ etat: 'brouillon-range', draftId: '88001', supprime: false }), brouillonLigne: true, store: { vrmActions: { '111': Array.from({ length: 45 }, () => Date.now() - 60000) } } }); const r = await reprendre(f);
    dit(r && r.accepte === false && n(f.j, 'S') === 0 && n(f.j, 'M') === 0, "F1 — 45 actions dans l'heure (50 − réserve 5) : « Reprendre » ne supprime rien", JSON.stringify({ r: r && (r.code || r.absent), seq: seq(f.j) })); }
  { const f = monter({ store: { vrmRepubJour: { '111': Array.from({ length: 50 }, (_, k) => Date.now() - k * 60000) } } }); const r = await recreer(f);
    const f2 = monter({ vb: VB({ etat: 'brouillon-range', draftId: '88001', supprime: false }), brouillonLigne: true, store: { vrmRepubJour: { '111': Array.from({ length: 50 }, (_, k) => Date.now() - k * 60000) } } }); const r2 = await reprendre(f2);
    dit(r.accepte === false && gestes(f.j).length === 0 && r2 && r2.accepte === false && n(f2.j, 'S') === 0, "F2 — 50 republications en 24 h : ni une nouvelle ni une reprise ne supprime quoi que ce soit", JSON.stringify({ r: r.code, r2: r2 && (r2.code || r2.absent), s2: seq(f2.j) })); }
  { const f = monter(); const lit = (k) => { try { return require('vm').runInContext(k, f.ctx); } catch (_) { return undefined; } };
    const c = { j: lit('REPUB_PAR_JOUR'), h: lit('ACTIONS_MAX_HEURE'), r: lit('RESERVE_GESTES') };
    dit(c.j === 50 && c.h === 50 && c.r === 5, "F3 — REPUB_PAR_JOUR 50, 50 actions/h, réserve 5 (ses décisions)", JSON.stringify(c)); }
  { const fr = { vrmFreinRepub: { '111': { jusqua: Date.now() + 1800000, status: 400, at: Date.now() } } };
    const f = monter({ vb: VB({ etat: 'brouillon-range', draftId: '88001', supprime: false }), brouillonLigne: true, store: fr }); const r = await reprendre(f);
    const f2 = monter({ store: { ...fr } }); const r2 = await recreer(f2);
    dit(r && r.code === 'frein-refus' && gestes(f.j).length === 0 && r2.code === 'frein-refus' && gestes(f2.j).length === 0, "F4 — frein après un refus de Vinted : ni republication ni reprise, aucune requête", JSON.stringify({ r: r && (r.code || r.absent), r2: r2.code })); }
  { const f = monter({ brouillon: 429 }); const r = await recreer(f); let p = null; try { p = await f.ctx.pauseVinted(); } catch (_) {}
    const f2 = monter({ store: { vrmPauseVinted: { jusqua: Date.now() + 600000, at: Date.now(), status: 429 } }, vb: VB({ etat: 'brouillon-range', draftId: '88001', supprime: false }), brouillonLigne: true }); const r2 = await reprendre(f2);
    dit(!!p && n(f.j, 'S') === 0 && n(f.j, 'M') === 0 && r2 && r2.accepte === false && gestes(f2.j).length === 0, "F5 — Vinted répond 429 au brouillon : la pause est posée, rien n'est supprimé ; pendant la pause, « Reprendre » n'envoie rien", JSON.stringify({ code: r.code, etape: r.etape, pause: !!p, seq: seq(f.j), r2: r2 && (r2.code || r2.absent) })); }
  { const f = monter({ connecte: '222', vb: VB({ etat: 'brouillon-range', draftId: '88001', supprime: false }), brouillonLigne: true }); const r = await reprendre(f);
    const f2 = monter({ connecte: '222', ancienne: 'partie', vb: VB({ etat: 'brouillon-range', draftId: '88001', supprime: true }), brouillonLigne: true, store: jobInterrompu('envoi', 3 * 60000) }); await tick(f2);
    dit(r && r.accepte === false && gestes(f.j).length === 0 && n(f2.j, 'M') === 0 && n(f2.j, 'L') === 0, "F6 — onglet sur un AUTRE compte : ni reprise, ni relecture, ni mise en ligne", JSON.stringify({ r: r && (r.code || r.absent), s2: seq(f2.j) })); }
  { const f = monter({ vb: VB({ etat: 'brouillon-range', draftId: '88001', supprime: false }), brouillonLigne: true }); const r = await f.ctx.reprendreRepub ? await f.ctx.reprendreRepub({ uid: '111', id: '9101' }) : { absent: true };
    dit(r && r.accepte === false && r.code === 'confirmation' && gestes(f.j).length === 0, "F7 — « Reprendre » sans SA confirmation : rien", JSON.stringify(r)); }

  // ── G — ce qui est retiré reste retiré
  { const src = fs.readFileSync(BG, 'utf8').replace(/\/\/[^\n]*/g, '');
    dit(!/function\s+(completionSecoursPhotos|photosNeuvesBrouillon|secoursTaille)\b/.test(src), "G1 — `completionSecoursPhotos`, `photosNeuvesBrouillon`, `secoursTaille` restent retirés");
    const f = monter(); await recreer(f); echeance(f); await tick(f);
    dit(n(f.j, 'C') === 0 && gestes(f.j).every((x) => x.origine === 'page' && !Object.keys(x.entetes || {}).some((k) => /^authorization$/i.test(k))), "G2 — jamais de création directe ; tout part de l'onglet vinted.fr, sans « Authorization »", seq(f.j));
    const rep = fs.readFileSync(path.join(RACINE, 'src', 'ecrans', 'Republier.jsx'), 'utf8').replace(/\/\/[^\n]*/g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    dit(!/['"`>]\s*Varier\b/.test(rep) && !/reglagesParAnnonce|regParAnnonce/.test(rep), "G3 — « Varier » et le réglage photo par annonce restent retirés de l'atelier"); }

  // ── H — la règle de l'app
  { let R = null; try { R = await import(APP_ETAPES + '?v=' + Date.now()); } catch (_) { R = null; }
    dit(!!R, "H0 — la règle de l'app (src/repubEtapes.js) existe");
    if (R) {
      const c1 = R.chaineRepub({ etat: 'planifiee', jusqua: 1e13 }, { etape: 'attente' });
      const c2 = R.chaineRepub({ etat: 'encours' }, { etape: 'suppression' });
      const c3 = R.chaineRepub({ etat: 'echec' }, null);
      dit(c1.faites === 3 && c1.etapes[3].etat === 'encours' && c1.enLigneA === 1e13 && c2.faites === 2 && c2.etapes[2].etat === 'encours' && c3.faites === 0 && c3.probleme === null && !c3.partie, "H1 — la chaîne : planifiée = 3 faites + « en ligne vers… » ; suppression en cours ; un échec sans étape annoncée n'a rien coché", JSON.stringify({ c1: c1.faites, c2: c2.faites, c3 }));
      const pl = R.planRepub({ n: 12, attentes: Array(11).fill(120), maintenant: 0 });
      dit(pl && pl.sec === 11 * 120 + 12 * R.PAIRE_S + R.MISE_EN_LIGNE_S && pl.fin === pl.sec * 1000, "H2 — le plan : ses attentes + le temps de chaque paire + la mise en ligne de la dernière", JSON.stringify(pl));
      const paires = ['1', '2', '3', '4', '5', '6'].map((id) => ({ id, titre: 'P' + id }));
      const st = { 1: { etat: 'fait' }, 2: { etat: 'planifiee', jusqua: 1 }, 3: { etat: 'echec', question: { champ: 'size', nom: 'la taille' } }, 4: { etat: 'a-refaire', draftId: '88001' }, 5: { etat: 'incertain' }, 6: { etat: 'echec', code: 'onglet-vinted' } };
      const b = R.resumeRepub(paires, st, { 5: { etape: 'en-ligne' } }, { reprendre: true, refaire: true, reessayer: true });
      const g = Object.fromEntries(b.aFinir.map((x) => [x.id, x.geste]));
      dit(b.enLigne === 1 && b.prevues === 1 && b.aFinir.length === 4 && g[3] === 'choisir' && g[4] === 'reprendre' && g[5] === 'reprendre' && g[6] === 'reessayer', "H3 — le bilan : 1 en ligne, 1 prévue, 4 à finir, UN geste chacune (choisir · reprendre · reprendre · réessayer) ; « pas su » n'est jamais « en ligne »", JSON.stringify(b));
      const g2 = R.gesteProbleme({ etat: 'a-refaire' }, null, { reprendre: true });
      dit(g2 && g2.geste === 'refaire', "H4 — supprimée sans brouillon connu : « Recréer depuis le coffre »", JSON.stringify(g2));
    } }

  // ── I — l'écran plein suit l'étape de la paire
  { const f = monter(); await f.ctx.avecActionPlein('republier', { uid: '111', id: '9101', num: '41', total: 3 }, () => recreer(f));
    await new Promise((ok) => setTimeout(ok, 50));
    const a = f.store.vrmActionEnCours || {};
    dit(a.repub && a.repub.id === '9101' && a.repub.fait === 3 && Number(a.repub.du) > Date.now(), "I1 — l'écran plein sur vinted.fr : coffre ✓ brouillon ✓ supprimée ✓, « en ligne dans … » à l'heure planifiée", JSON.stringify(a.repub)); }
  { const ui = fs.readFileSync(path.join(path.dirname(BG), 'vrm-action.js'), 'utf8');
    dit(/data-action-chaine/.test(ui) && /r_enligne_dans/.test(ui), "I2 — vrm-action.js dessine la chaîne de la paire (data-action-chaine)"); }
}

async function prouver() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'repub-parfaite-'));
  const lance = (args, env = {}) => { try { cp.execFileSync(process.execPath, [__filename, ...args], { env: { ...process.env, SILENCE: '1', ...env }, stdio: 'pipe' }); return 0; } catch (e) { return 1; } };
  let bons = 0, total = 0;
  // 1. La branche de départ.
  const base = path.join(tmp, 'bg-base.js');
  fs.writeFileSync(base, cp.execSync('git show origin/claude/extension-carte-v2:vinted-sync-extension/background.js', { cwd: RACINE, maxBuffer: 64 * 1024 * 1024 }));
  const rb = lance(['--bg', base, '--app', path.join(tmp, 'absent.js')]);
  total++; if (rb) bons++; console.log((rb ? '✅' : '❌') + ' §6.1 — rouge sur origin/claude/extension-carte-v2 (extension 5.406, sans repubEtapes)');
  // 2. Les mutations.
  const SRC = fs.readFileSync(BG, 'utf8'), APP = fs.readFileSync(APP_ETAPES, 'utf8');
  const M = [
    ['cause gardée', 'bg', "if (p.etat && p.etat !== v0.etat && !('cause' in p)) delete nv.cause;", ''],
    ['suppression pas datée', 'bg', "if (p.supprime === true && !e.supprimee) e.supprimee = p.supprimeLe || t;", ''],
    ['job « lecture » jamais repris', 'bg', "if (j.phase === 'lecture' && !j.repris) {", "if (false) {"],
    ['relecture qui dit toujours brouillon', 'bg', "return it.is_draft ? 'brouillon' : 'en-ligne';", "return 'brouillon';"],
    ['relecture sans attendre 2 min', 'bg', "if (t - Number(j.enCoursLe) < REPRISE_RELIRE_MS) continue;", ''],
    ['reprise sans relire l\'ancienne', 'bg', "if (vb.publier === true && vb.supprime !== true) {", "if (false) {"],
    ['reprise qui supprime sans brouillon', 'bg', "if (!draftId) {\n        await leverVerrouRecreer(id);", "if (false) {\n        await leverVerrouRecreer(id);"],
    ['reprise sans plafond', 'bg', "const stop = await gardeStricte(uid, acc, { reserve: RESERVE_GESTES, actions: 1, recu, sorte: 'republier', secu: { sorte: 'republication', mode: 'clic' } });", "const stop = null;"],
    ['reprise sans quota du jour', 'bg', "const jour = await gardeJourRepub(uid); if (jour) return { accepte: false, code: jour.code, raison: jour.raison };\n      const recu = {};", "const recu = {};"],
    ['reprise sans frein', 'bg', "{ const fr = await lireFreinRepub(uid); if (fr) return { accepte: false, code: 'frein-refus', jusqua: fr.jusqua, raison: phraseFreinRepub(fr) }; }\n  let rows; try { rows = await sbGet(`app_data?id=eq.coffre_${uid}_${id}&select=vb:data->versBrouillon`)", "let rows; try { rows = await sbGet(`app_data?id=eq.coffre_${uid}_${id}&select=vb:data->versBrouillon`)"],
    ['relecture d\'un autre compte', 'bg', "if (!actif || String(actif) !== String(job.uid)) return null;", ''],
    ['« Publier » ne règle pas l\'ancienne', 'bg', "try { await majVersBrouillon(uid, String(b.ancienId), { etat: 'fait', draftId: id, nouvelId: itemId }); } catch (_) {}", ''],
    ['nouvelle sans lien recreeDe', 'bg', "recreeDe: String(ancienId), savedAt: t", "savedAt: t"],
    ['écran plein sans étape', 'bg', "try { sansRejet(poserEtapeAction(String(id), etape, extra), 'etape_action'); } catch (_) {}", ''],
    ['pas d\'alarme à l\'heure', 'bg', "chrome.alarms.create(ALARME_MISE_EN_LIGNE, { when: Date.now() + ms + 1000 });", ''],
    ['REPUB_PAR_JOUR 60', 'bg', "const REPUB_PAR_JOUR = 50;", "const REPUB_PAR_JOUR = 60;"],
    ['« pas su » compté en ligne', 'app', "if (s.etat === 'fait') { enLigne++; continue; }", "if (s.etat === 'fait' || s.etat === 'incertain') { enLigne++; continue; }"],
    ['un échec sans étape coche le coffre', 'app', "faites = annoncees || 0;\n    probleme", "faites = annoncees || 1;\n    probleme"],
    ['sans brouillon : reprendre au lieu de recréer', 'app', "if (x.etat === 'a-refaire' && !x.draftId)", "if (false)"],
  ];
  for (const [nom, cible, de, vers] of M) {
    const s = cible === 'bg' ? SRC : APP;
    if (!s.includes(de)) { total++; console.log(`❌ mutation « ${nom} » : ancre absente`); continue; }
    const fichier = path.join(tmp, cible === 'bg' ? `bg-${total}.js` : `app-${total}.mjs`);
    fs.writeFileSync(fichier, s.replace(de, vers));
    const r = lance(cible === 'bg' ? ['--bg', fichier] : ['--app', fichier]);
    total++; if (r) bons++; console.log((r ? '✅' : '❌') + ` mutation « ${nom} » ⇒ ${r ? 'rouge' : 'VERT (le contrôle ne la voit pas)'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${bons === total ? '✅' : '❌'} preuve : ${bons}/${total} rouges`);
  process.exit(bons === total ? 0 : 1);
}

(async () => {
  if (process.argv.includes('--prouve')) return prouver();
  await auditer();
  if (!process.env.SILENCE) console.log(`\n${ko ? '❌' : '✅'} audit-republication-parfaite : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
