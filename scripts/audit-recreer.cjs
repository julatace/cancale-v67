// ════════════════════════════════════════════════════════════════════════════
//  REPUBLIER = SUPPRIMER ET RECRÉER L'ANNONCE (28 octobre, 5.248 — sa décision)
//
//  Julien : « je veux que ça supprime et recrée l'annonce », « en modifiant les
//  photos ». La FORME des trois gestes est mesurée (ses requêtes du 26 oct.) :
//  POST /api/v2/photos (FormData) · POST /api/v2/item_upload/items · POST
//  /api/v2/items/{id}/delete. On EXÉCUTE le vrai `recreerVinted` de
//  background.js dans un `vm` (faux Vinted qui note chaque requête, faux CDN,
//  fausse base à état) et on exige que L'ORDRE soit la sûreté :
//    · tout prêt ⇒ photos téléversées, PUIS la création, PUIS seulement la
//      suppression de l'ancienne ; le corps porte la recette de CETTE annonce,
//      les photos neuves, le prix et le titre choisis ;
//    · une photo refusée, une création refusée, une création SANS identifiant
//      lisible ⇒ AUCUNE suppression (l'ancienne reste en ligne) ;
//    · suppression refusée ⇒ « double », dit, jamais « fait » ;
//    · sans confirmation · autre compte · coffre absent · recette inconnue ⇒
//      AUCUNE requête chez Vinted ;
//    · des réglages photo que le navigateur ne sait pas appliquer ⇒ rien ne
//      part (jamais une photo d'origine envoyée à la place en silence).
//  §6.1 — `--prouve` : sur origin/main, `recreerVinted` n'existe pas.
// ════════════════════════════════════════════════════════════════════════════
const { faireFond } = require('./_fond-vm.cjs');

let ok = 0, ko = 0;
const dit = (c, msg, det) => { if (c) { ok++; console.log('✅ ' + msg); } else { ko++; console.log('❌ ' + msg + (det ? '  → ' + det : '')); } };
const nowISO = () => new Date().toISOString();
const MODELE = JSON.stringify({ item: { id: 9101, title: 'Nike Air Max 1', description: 'nickel', price: '60.0', currency: 'EUR', catalog_id: 1234, brand_id: 53, color_ids: [1], item_attributes: [{ code: 'size', ids: [56] }, { code: 'condition', ids: [2] }], package_size_id: 1, assigned_photos: [{ id: 1 }] } });
const PHOTOS = ['https://images1.vinted.net/t/01_0121e_hsUzFGeDP3Vk/f800/1.jpeg', 'https://images1.vinted.net/t/02_02248_Ka3jojtDMin8/f800/2.jpeg'];
const PHOTOS_D = ['https://images1.vinted.net/tc/01_0121e_hsUzFGeDP3Vk/aa1.jpeg', 'https://images1.vinted.net/tc/02_02248_Ka3jojtDMin8/bb2.jpeg'];

function monter({ connecte = '111', comptes = null, coffre = true, modele = true, codes = null, photo = 200, photoSansId = false, creation = 200, creationSansId = false, suppression = 200, src, cdn = null, descDetails = null, lettreCoffre = null, brouillon = 200, brouillonSansId = false, completion = 200, extra = null, coffreEcritureKO = false, retardLecture = null, lecture = null, completionCorps = null, couleursRep = null, attributsRep = null } = {}) {
  const lignes = { main: { capturedAt: nowISO(), vinted_annonce_numeros: { '9101': { numero: '41' } } }, vinted_item_details: {} };
  if (coffre) lignes['coffre_111_9101'] = { id: '9101', title: 'Nike Air Max 1', price: 60, desc: 'Nickel, boîte d’origine', photos: PHOTOS };
  if (modele) lignes['vrm_vinted_modele'] = { '9101': { corps: MODELE, at: nowISO(), uid: '111' } };
  if (codes) lignes.vinted_item_details['9101'] = { codes, description: 'Nickel, boîte d’origine' };
  if (descDetails != null) lignes.vinted_item_details['9101'] = { ...(lignes.vinted_item_details['9101'] || {}), description: descDetails };
  if (lettreCoffre && lignes['coffre_111_9101']) lignes['coffre_111_9101'].lettreVRM = lettreCoffre;
  if (cdn) lignes.vinted_item_details['9101'] = { ...(lignes.vinted_item_details['9101'] || {}), photos: PHOTOS_D };
  if (extra) Object.assign(lignes, extra);
  let n = 500;
  return faireFond({ src, lignes, connecte, comptes, retardLecture: retardLecture || (() => 0), ecritureKO: (id) => coffreEcritureKO && /^coffre_/.test(id), cdn: cdn || (() => ({ status: 200 })),
    vinted: (e) => {
      if (e.methode === 'GET' && /\/api\/v2\/item_upload\/colors$/.test(e.chemin)) return couleursRep || { status: 404, body: {} };
      if (e.methode === 'POST' && /\/api\/v2\/item_upload\/attributes$/.test(e.chemin)) return attributsRep || { status: 404, body: {} };
      if (e.methode === 'GET' && /\/api\/v2\/item_upload\/items\/9101$/.test(e.chemin) && lecture) return lecture;
      // 29 oct. : la page « Modifier » de l'annonce (et du brouillon) se lit, comme le site.
      if (e.methode === 'GET' && /\/api\/v2\/item_upload\/items\/\d+$/.test(e.chemin)) return { status: 200, body: { item: { id: Number(e.chemin.split('/').pop()) } } };
      if (e.methode === 'POST' && /\/api\/v2\/photos$/.test(e.chemin)) return { status: photo, body: photoSansId ? { ok: true } : { id: ++n } };
      if (e.methode === 'POST' && /\/api\/v2\/item_upload\/items\/?$/.test(e.chemin)) return { status: creation, body: creationSansId ? { code: 0 } : { item: { id: 77001 } } };
      if (e.methode === 'POST' && /\/api\/v2\/item_upload\/drafts\/?$/.test(e.chemin)) return { status: typeof brouillon === 'function' ? brouillon() : brouillon, body: brouillonSansId ? { code: 0 } : { draft: { id: 88001 } } };
      if (e.methode === 'POST' && /\/api\/v2\/item_upload\/drafts\/\d+\/completion$/.test(e.chemin)) return { status: typeof completion === 'function' ? completion() : completion, body: (typeof completionCorps === "function" ? completionCorps() : completionCorps) || { code: 0 } };
      if (e.methode === 'POST' && /\/api\/v2\/items\/9101\/delete$/.test(e.chemin)) return { status: suppression, body: {} };
      return { status: 404, body: {} };
    } });
}
const de = (j, re, m = 'POST') => j.vinted.filter((v) => v.methode === m && re.test(v.chemin));
const photosP = (j) => de(j, /\/api\/v2\/photos$/);
// (29 oct., « comme Vintex ») La création passe TOUJOURS par un brouillon : « la création » = le POST du brouillon.
const creations = (j) => de(j, /\/item_upload\/drafts\/?$/);
const directes = (j) => de(j, /\/item_upload\/items\/?$/);
const seqV = (j) => gestes(j).map((v) => v.methode === 'GET' && /item_upload\/items\/\d+$/.test(v.chemin) ? 'L' : /photos$/.test(v.chemin) ? 'P' : /completion$/.test(v.chemin) ? 'M' : /drafts\/?$/.test(v.chemin) ? 'B' : /item_upload\/items/.test(v.chemin) ? 'C' : /delete$/.test(v.chemin) ? 'S' : '?').join('');
const suppressions = (j) => de(j, /\/items\/\d+\/delete$/);
async function run(opts = {}) {
  const f = monter({ src: process.env.BG_SRC || undefined, ...opts });
  if (typeof f.ctx.recreerVinted !== 'function') return { f, r: {}, absent: true };
  let r = {}; try { r = await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: opts.prix != null ? opts.prix : 54, titre: opts.titre || 'Nike Air Max 1 — remise en ligne', plancher: opts.plancher, reglages: opts.reglages, lettre: opts.lettre, viaBrouillon: opts.viaBrouillon, versBrouillon: opts.versBrouillon, differer: opts.differer, confirme: opts.confirme !== false }); } catch (e) { r = { erreur: String(e.message) }; }
  return { f, r };
}
const LECTURE = /\/item_upload\/(colors|attributes)$/;   // lire la liste des couleurs ou des tailles n'est pas un geste
const gestes = (j) => j.vinted.filter((v) => !LECTURE.test(v.chemin));
const zero = (j) => gestes(j).length === 0;   // 5.266 : lire la liste des couleurs n'est pas un geste

(async () => {
  if (process.argv.includes('--prouve')) {
    const cp = require('child_process'), os = require('os'), fs = require('fs'), path = require('path');
    const avant = path.join(os.tmpdir(), 'bg-avant-recreer.js');
    fs.writeFileSync(avant, cp.execSync('git show origin/main:vinted-sync-extension/background.js', { cwd: path.join(__dirname, '..'), maxBuffer: 64 * 1024 * 1024 }));
    const { f, absent } = await run({ src: avant });
    dit(!absent && creations(f.j).length === 1, "§6.1 — sur origin/main : la recréation n'existe pas", `absent=${!!absent}`);
    console.log(ko ? `\n❌ preuve §6.1 : ${ko} rouge(s) sur le code d'avant` : '\n✅');
    process.exit(ko ? 1 : 0);
  }

  // A — tout prêt.
  { const { f, r } = await run();
    const seq = seqV(f.j);
    dit(seq === 'LPPBSLM' && r.etape === 'fait' && r.nouvelId === '88001', "comme Vintex : lecture de l'annonce, photos ×2, brouillon, suppression juste après, lecture du brouillon, mise en ligne", `seq=${seq} etape=${r.etape} code=${r.code || ''} ${r.raison || ''}`);
    const pg = gestes(f.j).concat(f.j.vinted.filter((v) => LECTURE.test(v.chemin)));
    dit(pg.length && pg.every((v) => v.origine === 'page' && v.credentials === 'include' && !Object.keys(v.entetes || {}).some((k) => /^authorization$/i.test(k))), "TOUTES les requêtes partent de la page Vinted, avec ses cookies, sans « Authorization » (comme le site)", JSON.stringify(pg.map((v) => [v.origine, v.credentials, Object.keys(v.entetes || {})])));
    let corps = {}; try { corps = JSON.parse(creations(f.j)[0].corps); } catch (_) {}
    const it = corps.draft || {};
    dit(it.id === null && it.title === 'Nike Air Max 1 — remise en ligne' && it.price === '54', "la nouvelle annonce porte le titre et le prix choisis (id null : c'est une création)", JSON.stringify({ id: it.id, title: it.title, price: it.price }));
    dit(it.catalog_id === 1234 && it.package_size_id === 1 && JSON.stringify(it.item_attributes) === JSON.stringify([{ code: 'size', ids: [56] }, { code: 'condition', ids: [2] }]), "la recette est celle de CETTE annonce (catégorie, taille/état, colis)", JSON.stringify(it.item_attributes));
    dit(Array.isArray(it.assigned_photos) && it.assigned_photos.map((p) => p.id).join(',') === '501,502' && it.assigned_photos.every((p) => p.orientation === 0), "les photos sont les NOUVELLES (identifiants rendus par Vinted), dans l'ordre", JSON.stringify(it.assigned_photos));
    dit(Array.isArray(it.assigned_photos) && it.assigned_photos.every((p) => JSON.stringify(Object.keys(p).sort()) === '["id","orientation"]') && 'feedback_id' in corps && corps.feedback_id === null, "forme de Vintex : photos {id, orientation} seulement, feedback_id null", JSON.stringify({ ph: it.assigned_photos && it.assigned_photos[0], fb: corps.feedback_id }));
    dit(typeof it.temp_uuid === 'string' && it.temp_uuid.length === 36 && corps.upload_session_id === it.temp_uuid && !('push_up' in corps) && corps.parcel === null, "forme mesurée : upload_session_id = temp_uuid, parcel null, pas de push_up dans le brouillon", JSON.stringify({ u: corps.upload_session_id, t: it.temp_uuid, p: corps.push_up }));
    const fd = photosP(f.j)[0] && photosP(f.j)[0].corps;
    dit(fd && typeof fd.get === 'function' && fd.get('photo[type]') === 'item' && fd.get('photo[temp_uuid]') === it.temp_uuid && fd.get('photo[file]'), "chaque photo part en FormData photo[type]=item, photo[file], photo[temp_uuid] de l'annonce", fd && typeof fd.get === 'function' ? fd.get('photo[type]') : typeof fd);
    dit(f.lignes.vrm_vinted_modele && f.lignes.vrm_vinted_modele['88001'], "la recette de la NOUVELLE annonce est gardée (la prochaine recréation n'a rien à réapprendre)");
    dit(f.lignes['coffre_111_88001'] && f.lignes['coffre_111_88001'].recreeDe === '9101', "la nouvelle annonce a sa sauvegarde coffre (filet)");
    dit(directes(f.j).length === 0, "plus jamais de création directe (POST item_upload/items) : le site, et Vintex, passent par un brouillon", `n=${directes(f.j).length}`); }
  // A2 — (29 oct.) sans onglet Vinted ouvert : RIEN ne part, et c'est dit.
  { const f = monter({ src: process.env.BG_SRC || undefined }); f.ctx.chrome.tabs.query = async () => [];
    let r = {}; try { r = await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike', confirme: true }); } catch (e) { r = { erreur: e.message }; }
    dit(r.accepte === false && r.code === 'onglet-vinted' && /ouvre vinted\.fr/.test(r.raison || '') && f.j.vinted.filter((v) => !LECTURE.test(v.chemin)).length === 0, "sans onglet Vinted ouvert : aucune requête chez Vinted, « ouvre vinted.fr » dit", JSON.stringify({ code: r.code, n: f.j.vinted.length, raison: r.raison })); }
  // A3 — (29 oct.) quelques paires par jour et par compte : au-delà, rien ne part.
  { const f = monter({ src: process.env.BG_SRC || undefined }); const t = Date.now();
    await f.ctx.chrome.storage.local.set({ vrmRepubJour: { '111': Array.from({ length: 10 }, (_, k) => t - k * 60000) } });
    let r = {}; try { r = await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike', confirme: true }); } catch (e) { r = { erreur: e.message }; }
    dit(r.code === 'quota-jour' && zero(f.j), "10 paires republiées en 24 h sur ce compte : la suivante est refusée, aucune requête", JSON.stringify({ code: r.code, n: f.j.vinted.length })); }

  // B — une photo refusée : rien n'est créé, rien n'est supprimé.
  { const { f, r } = await run({ photo: 422 });
    dit(creations(f.j).length === 0 && suppressions(f.j).length === 0 && r.etape === 'echec', "photo refusée : AUCUNE création, AUCUNE suppression (l'annonce reste intacte)", `c=${creations(f.j).length} s=${suppressions(f.j).length} ${r.raison || ''}`); }
  // B2 — une photo acceptée mais sans identifiant lisible : pareil.
  { const { f } = await run({ photoSansId: true });
    dit(creations(f.j).length === 0 && suppressions(f.j).length === 0, "photo sans identifiant lisible : rien n'est créé ni supprimé", `c=${creations(f.j).length}`); }
  // C — création refusée : l'ancienne n'est JAMAIS supprimée.
  { const { f, r } = await run({ brouillon: 422 });
    dit(suppressions(f.j).length === 0 && creations(f.j).length === 1 && r.etape === 'echec' && /toujours en ligne/.test(r.raison || ''), "brouillon refusé : UN envoi, jamais retenté, l'ancienne n'est JAMAIS supprimée, et c'est dit", `s=${suppressions(f.j).length} b=${creations(f.j).length} ${r.raison || ''}`); }
  // D — création « réussie » sans identifiant : on ne supprime rien, « incertain ».
  { const { f, r } = await run({ brouillonSansId: true });
    dit(suppressions(f.j).length === 0 && r.etape === 'echec' && /toujours en ligne/.test(r.raison || ''), "brouillon sans identifiant lisible : RIEN n'est supprimé, c'est dit", `s=${suppressions(f.j).length} etape=${r.etape}`); }
  // E — suppression refusée : « double », jamais « fait ».
  { const { f, r } = await run({ suppression: 403 });
    dit(r.etape === 'echec' && de(f.j, /completion$/).length === 0 && /toujours en ligne/.test(r.raison || '') && /brouillon/.test(r.raison || ''), "suppression refusée : rien mis en ligne (jamais deux annonces), le brouillon en trop est dit", `etape=${r.etape} ${r.raison || ''}`); }
  // E2 — suppression sans réponse claire (5xx, coupure) : « peut-être encore en ligne », jamais « refusé ».
  { const { f, r } = await run({ suppression: 500 });
    dit(r.etape === 'incertain' && de(f.j, /completion$/).length === 0 && /PEUT-ÊTRE/.test(r.raison || '') && !/refusé/.test(r.raison || ''), "suppression sans réponse claire : « peut-être encore en ligne », rien mis en ligne", `etape=${r.etape} ${r.raison || ''}`); }
  // J — création sans réponse claire (5xx) : « incertain », rien supprimé, et une
  //     seconde tentative sur la MÊME annonce est refusée sans aucune requête.
  { const f = monter({ src: process.env.BG_SRC || undefined, completion: 502 });
    const appel = () => f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike Air Max 1', confirme: true });
    const r1 = await appel(); const n1 = f.j.vinted.length; const r2 = await appel();
    dit(r1.etape === 'incertain' && /PEUT-ÊTRE/.test(r1.raison || ''), "mise en ligne sans réponse claire (5xx) : « peut-être en ligne », dit", `etape=${r1.etape} ${r1.raison || ''}`);
    dit(r2.accepte === false && r2.code === 'recreer-incertaine' && f.j.vinted.length === n1, "une seconde tentative juste après est REFUSÉE sans rien envoyer (pas de seconde copie)", `code=${r2.code} requêtes=${f.j.vinted.length - n1}`); }
  // J2 — une création REFUSÉE (4xx) ne bloque pas la tentative suivante.
  { const f = monter({ src: process.env.BG_SRC || undefined, brouillon: 422 });
    await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike', confirme: true });
    const r2 = await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike', confirme: true });
    dit(r2.code !== 'recreer-incertaine', "un brouillon refusé net ne bloque pas la suivante", `code=${r2.code || r2.etape}`); }
  // K — un lien de photo périmé : l'autre copie (fiche) prend le relais.
  { const { f, r } = await run({ cdn: (u) => /\/t\//.test(u) ? { status: 200 } : { status: 404 } });
    dit(r.etape === 'fait' && photosP(f.j).length === 2, "un lien de photo périmé : l'autre copie de la même photo est prise", `etape=${r.etape} ${r.raison || ''}`); }
  // K2 — (28 oct., Jordan 3) le coffre porte la MÊME photo sous plusieurs formes
  //      (75 liens pour 15 photos) : chaque photo part UNE fois, jamais en double.
  { const dbl = [...PHOTOS, ...PHOTOS_D, ...PHOTOS.map((u) => u + '?s=1'), 'https://images1.vinted.net/t/01_0121e_hsUzFGeDP3Vk/f1200/x.webp'];
    const { f, r } = await run({ viaBrouillon: true, extra: { coffre_111_9101: { id: '9101', title: 'Nike Air Max 1', price: 60, desc: 'Nickel, boîte d’origine', photos: dbl } } });
    let cb = {}; try { cb = JSON.parse(de(f.j, /\/item_upload\/drafts\/?$/)[0].corps).draft; } catch (_) {}
    dit(r.etape === 'fait' && photosP(f.j).length === 2 && cb.assigned_photos && cb.assigned_photos.length === 2, "même photo sous plusieurs liens : 2 photos envoyées (pas 7), le brouillon en porte 2", JSON.stringify({ e: r.etape, p: photosP(f.j).length, b: cb.assigned_photos && cb.assigned_photos.length, raison: r.raison })); }
  // F — refus avant tout : 0 requête chez Vinted.
  { const { f, r } = await run({ confirme: false });
    dit(zero(f.j) && r.code === 'confirmation', "sans confirmation : aucune requête chez Vinted", `n=${f.j.vinted.length} code=${r.code}`); }
  { const { f, r } = await run({ connecte: '999', comptes: [{ vinted_user_id: '111', login: 'c', domain: 'www.vinted.fr', access_token: 'j' }] });
    dit(zero(f.j) && /autre/.test(r.code || ''), "autre compte Vinted dans Chrome : aucune requête (§3)", `n=${f.j.vinted.length} code=${r.code}`); }
  { const { f, r } = await run({ coffre: false });
    dit(zero(f.j) && r.code === 'coffre-absent', "aucune photo sauvegardée : aucune requête", `n=${f.j.vinted.length} code=${r.code}`); }
  { const { f, r } = await run({ modele: false });
    const lus = de(f.j, /\/api\/v2\/item_upload\/items\/9101$/, 'GET');
    dit(f.j.vinted.length === 1 && lus.length === 1 && lus[0].origine === 'page' && r.code === 'recette-absente', "recette inconnue, Vinted refuse de la donner : UNE lecture, rien d'autre, et c'est dit", `n=${f.j.vinted.length} code=${r.code} raison=${r.raison}`); }
  // G3 — (28 oct., vu chez Julien) sans modèle ni codes : la recette est LUE chez
  //      Vinted (comme sa page « Modifier ») et la republication aboutit, sans geste.
  { const { f, r } = await run({ modele: false, lecture: { status: 200, body: { item: { id: 9101, description: 'Nickel, boîte d’origine', catalog_id: 88, brand_id: 9, brand: 'Dr. Martens', color_ids: [1], item_attributes: [{ code: 'size', ids: [55] }, { code: 'status', ids: [2] }], package_size_id: 2 } } } });
    let it = {}; try { it = JSON.parse(creations(f.j)[0].corps).draft; } catch (_) {}
    const codes = ((f.lignes.vinted_item_details || {})['9101'] || {}).codes || {};
    dit(r.etape === 'fait' && it.catalog_id === 88 && it.package_size_id === 2 && codes.catalog_id === 88, "sans modèle ni codes : la recette est lue chez Vinted, gardée, et la republication aboutit", JSON.stringify({ e: r.etape, code: r.code, raison: r.raison, c: it.catalog_id, rangee: codes.catalog_id })); }
  { const { f, r } = await run({ modele: false, lecture: { status: 200, body: { item: { id: 9101, title: 'x', size_id: 3 } } } });
    dit(creations(f.j).length === 0 && suppressions(f.j).length === 0 && r.code === 'recette-absente', "réponse sans la recette sous une forme connue : rien n'est créé ni supprimé (jamais deviné)", JSON.stringify({ code: r.code })); }
  // C1 — (28 oct., N°72 restée en brouillon) Vinted range un brouillon SANS
  //      couleur mais REFUSE de le mettre en ligne (« 400 : Erreurs trouvées »).
  //      Couleur inconnue partout ⇒ rien n'est supprimé ni créé, et c'est dit.
  for (const via of [false, true]) {
    const { f, r } = await run({ modele: false, viaBrouillon: via, lecture: { status: 200, body: { item: { id: 9101, catalog_id: 88, brand_id: 9, item_attributes: [{ code: 'size', ids: [55] }], package_size_id: 2 } } } });
    dit(suppressions(f.j).length === 0 && creations(f.j).length === 0 && de(f.j, /\/item_upload\/drafts/).length === 0 && photosP(f.j).length === 0 && r.code === 'couleur-absente' && /couleur/.test(r.raison || ''), `couleur inconnue (${via ? 'par brouillon' : 'directe'}) : rien n'est supprimé ni créé, la couleur est nommée`, JSON.stringify({ s: suppressions(f.j).length, c: creations(f.j).length, code: r.code })); }
  // C2 — la couleur sous `color1_id` (objet) est lue, et part dans le brouillon ET sa mise en ligne.
  { const { f, r } = await run({ modele: false, viaBrouillon: true, lecture: { status: 200, body: { item: { id: 9101, catalog_id: 88, brand_id: 9, color1_id: { id: 1, title: 'Noir' }, item_attributes: [{ code: 'size', ids: [55] }], package_size_id: 2 } } } });
    let cb = {}, cc = {}; try { cb = JSON.parse(de(f.j, /\/item_upload\/drafts\/?$/)[0].corps).draft; cc = JSON.parse(de(f.j, /\/completion$/)[0].corps).draft; } catch (_) {}
    dit(r.etape === 'fait' && JSON.stringify(cb.color_ids) === '[1]' && JSON.stringify(cc.color_ids) === '[1]', "couleur lue sous color1_id : brouillon et mise en ligne la portent, la republication aboutit", JSON.stringify({ e: r.etape, code: r.code, b: cb.color_ids, c: cc.color_ids, raison: r.raison })); }
  // C3 — un modèle SANS couleur : la couleur est lue chez Vinted, jamais envoyée vide.
  { const sansCouleur = JSON.stringify({ item: { ...JSON.parse(MODELE).item, color_ids: [] } });
    const { f, r } = await run({ extra: { vrm_vinted_modele: { '9101': { corps: sansCouleur, at: nowISO(), uid: '111' } } }, lecture: { status: 200, body: { item: { id: 9101, catalog_id: 1234, color_ids: [7], item_attributes: [{ code: 'size', ids: [56] }], package_size_id: 1 } } } });
    let it = {}; try { it = JSON.parse(creations(f.j)[0].corps).draft; } catch (_) {}
    dit(r.etape === 'fait' && JSON.stringify(it.color_ids) === '[7]', "modèle sans couleur : elle est lue chez Vinted, l'annonce part avec", JSON.stringify({ e: r.etape, code: r.code, c: it.color_ids })); }
  // C4 — la barre de progression : chaque étape est annoncée à l'app, dans l'ordre.
  { const { f, r } = await run({ viaBrouillon: true });
    const et = f.j.evts.filter((e) => e && e.quoi === 'repub' && e.id === '9101' && e.etape).map((e) => e.etape);
    const ordre = [...new Set(et)].join(',');
    dit(r.etape === 'fait' && ordre === 'lecture,photos,enregistrement,brouillon,suppression,attente,en-ligne', "les étapes (lecture, photos, enregistrement, brouillon, suppression, attente, mise en ligne) sont annoncées à l'app, dans l'ordre", ordre);
    const ph = f.j.evts.filter((e) => e && e.quoi === 'repub' && e.etape === 'photos');
    dit(ph.length === 2 && ph[1].fait === 1 && ph[1].total === 2, "l'envoi des photos dit « photo n sur N »", JSON.stringify(ph)); }
  // G — sans modèle, avec les codes rangés de sa fiche : la recette vient d'eux.
  { const { f, r } = await run({ modele: false, codes: { catalog_id: 77, brand_id: 9, brand: 'Nike', color_ids: [3], item_attributes: [{ code: 'size', ids: [60] }], package_size_id: 2 } });
    let it = {}; try { it = JSON.parse(creations(f.j)[0].corps).draft; } catch (_) {}
    dit(r.etape === 'fait' && it.catalog_id === 77 && it.package_size_id === 2 && it.description === 'Nickel, boîte d’origine', "sans modèle : la recette vient des codes de SA fiche, la description du coffre", JSON.stringify({ e: r.etape, c: it.catalog_id, d: it.description })); }
  // J — (28 oct.) la description part MOT POUR MOT ; la lettre en option va
  //     tout en bas, et la lettre d'une recréation précédente est retirée d'abord.
  { const longue = 'Paire portée 2 fois.\n\n- Boîte d’origine\n- Envoi rapide 📦  #nike';
    const { f, r } = await run({ descDetails: longue });
    let it = {}; try { it = JSON.parse(creations(f.j)[0].corps).draft; } catch (_) {}
    dit(r.etape === 'fait' && it.description === longue, "sans lettre : la description part EXACTEMENT telle quelle (lignes, tirets, emoji)", JSON.stringify(it.description)); }
  { const { f, r } = await run({ descDetails: 'Nickel.\n\nx', lettreCoffre: 'x', lettre: 'q' });
    let it = {}; try { it = JSON.parse(creations(f.j)[0].corps).draft; } catch (_) {}
    dit(r.etape === 'fait' && it.description === 'Nickel.\n\nq', "avec la lettre : « q » tout en bas, l'ancienne lettre « x » retirée (pas d'empilement)", JSON.stringify(it.description));
    dit(f.lignes['coffre_111_88001'] && f.lignes['coffre_111_88001'].lettreVRM === 'q', "la lettre posée est notée dans la sauvegarde de la nouvelle annonce", JSON.stringify(f.lignes['coffre_111_88001'] && f.lignes['coffre_111_88001'].lettreVRM)); }
  { const { f } = await run({ descDetails: 'Taille x', lettre: 'abc' });
    let it = {}; try { it = JSON.parse(creations(f.j)[0].corps).draft; } catch (_) {}
    dit(it.description === 'Taille x', "une « lettre » invalide (plusieurs caractères) n'ajoute rien, et un texte qui finit par x sans lettre notée n'est pas touché", JSON.stringify(it.description)); }
  // H — plancher.
  { const { f } = await run({ prix: 20, plancher: 35 });
    let it = {}; try { it = JSON.parse(creations(f.j)[0].corps).draft; } catch (_) {}
    dit(it.price === '35', "jamais sous le prix d'achat : 20 € demandé ⇒ 35 €", it.price); }
  // I — réglages photo que ce navigateur ne sait pas appliquer (le vm n'a pas
  //     OffscreenCanvas) : rien ne part, jamais l'original à la place.
  { const { f, r } = await run({ reglages: { rot: 0, bright: 1.2, contrast: 1, sat: 1, zoom: 1 } });
    dit(photosP(f.j).length === 0 && creations(f.j).length === 0 && suppressions(f.j).length === 0 && r.etape === 'echec', "réglages photo impossibles ici : rien ne part (jamais la photo d'origine en silence)", `p=${photosP(f.j).length} c=${creations(f.j).length} ${r.raison || ''}`); }


  // M — (28 oct.) « ça met en brouillon puis ça publie » : formes MESURÉES.
  const brouillonsP = (j) => de(j, /\/item_upload\/drafts\/?$/);
  const completions = (j) => de(j, /\/item_upload\/drafts\/\d+\/completion$/);
  { const { f, r } = await run({ viaBrouillon: true });
    const seq = seqV(f.j);
    const cf = f.lignes['coffre_111_9101'];
    dit(seq === 'LPPBSLM' && r.etape === 'fait' && r.nouvelId === '88001' && cf && cf.versBrouillon && cf.versBrouillon.publier === true, "republier (« comme Vintex ») : enregistrée dans VRM, brouillon, PUIS suppression, PUIS mise en ligne", `seq=${seq} etape=${r.etape} id=${r.nouvelId} ${r.raison || ''}`);
    let b = {}, c = {}; try { b = JSON.parse(brouillonsP(f.j)[0].corps); c = JSON.parse(completions(f.j)[0].corps); } catch (_) {}
    dit(b.draft && b.draft.id === null && !('push_up' in b) && !('push_up' in b.draft) && b.parcel === null && b.upload_session_id === b.draft.temp_uuid && b.draft.title === 'Nike Air Max 1 — remise en ligne' && b.draft.price === '54', "brouillon : forme mesurée {draft:{id:null,…}, parcel:null, upload_session_id}, sans push_up", JSON.stringify({ id: b.draft && b.draft.id, pu: 'push_up' in b }));
    dit(c.draft && c.draft.id === 88001 && c.push_up === false && c.parcel === null && /\/drafts\/88001\/completion$/.test(completions(f.j)[0].chemin) && c.draft.description === b.draft.description, "mise en ligne : POST …/drafts/88001/completion, même corps, draft.id posé, push_up false", JSON.stringify({ id: c.draft && c.draft.id, pu: c.push_up }));
    dit(f.lignes['vinted_brouillon_88001'] && f.lignes['vinted_brouillon_88001'].etat === 'publie' && f.lignes['vinted_brouillon_88001'].ancienId === '9101', "le brouillon est noté « publié » (avec l'annonce qu'il remplace)", JSON.stringify(f.lignes['vinted_brouillon_88001'] && f.lignes['vinted_brouillon_88001'].etat)); }
  { const { f, r } = await run({ viaBrouillon: true, completion: 422 });
    dit(suppressions(f.j).length === 1 && r.etape === 'brouillon-a-refaire' && /Brouillons → en ligne/.test(r.raison || '') && f.lignes['vinted_brouillon_88001'] && f.lignes['vinted_brouillon_88001'].etat === 'brouillon', "mise en ligne refusée : le brouillon reste rangé, et le geste pour le remettre en ligne est dit", `s=${suppressions(f.j).length} ${r.raison || ''}`); }
  { const { f, r } = await run({ viaBrouillon: true, completion: 502 });
    dit(r.etape === 'incertain' && /PEUT-ÊTRE en ligne/.test(r.raison || ''), "mise en ligne sans réponse claire : « incertain », dit", `s=${suppressions(f.j).length} etape=${r.etape}`); }
  { const { f, r } = await run({ viaBrouillon: true, brouillon: 422 });
    dit(completions(f.j).length === 0 && suppressions(f.j).length === 0 && r.etape === 'echec' && /toujours en ligne/.test(r.raison || ''), "brouillon refusé : rien supprimé, aucune mise en ligne", `m=${completions(f.j).length} s=${suppressions(f.j).length}`); }
  { const { f, r } = await run({ viaBrouillon: true, brouillonSansId: true });
    dit(completions(f.j).length === 0 && suppressions(f.j).length === 0 && r.etape === 'echec', "brouillon sans identifiant lisible : on ne devine rien, rien supprimé, aucune mise en ligne", `m=${completions(f.j).length}`); }
  { const { f, r } = await run({ viaBrouillon: true, suppression: 502 });
    dit(brouillonsP(f.j).length === 1 && completions(f.j).length === 0 && r.etape === 'incertain', "republier, suppression sans réponse claire : on s'arrête — jamais deux annonces en ligne", `b=${brouillonsP(f.j).length} m=${completions(f.j).length}`); }
  { const { f, r } = await run({ viaBrouillon: true, suppression: 403 });
    dit(brouillonsP(f.j).length === 1 && completions(f.j).length === 0 && r.etape === 'echec' && /toujours en ligne/.test(r.raison || ''), "republier, suppression refusée : rien mis en ligne, elle est toujours en ligne", `b=${brouillonsP(f.j).length}`); }
  { const { f, r } = await run({ viaBrouillon: true, coffreEcritureKO: true });
    dit(suppressions(f.j).length === 0 && brouillonsP(f.j).length === 0 && r.etape === 'echec', "republier, enregistrement raté : rien supprimé", `s=${suppressions(f.j).length}`); }
  { const { f } = await run({ viaBrouillon: false });
    dit(brouillonsP(f.j).length === 1 && directes(f.j).length === 0, "même sans l'option : par brouillon (plus de création directe)", `b=${brouillonsP(f.j).length} c=${directes(f.j).length}`); }

  // P — (28 oct. au soir, sa décision) « en ligne → brouillon » : l'annonce est
  // ENREGISTRÉE dans VRM, PUIS supprimée, PUIS le brouillon créé — jamais de mise en ligne.
  const seqDe = (j) => gestes(j).map((v) => /photos$/.test(v.chemin) ? 'P' : /completion$/.test(v.chemin) ? 'M' : /drafts\/?$/.test(v.chemin) ? 'B' : /item_upload\/items/.test(v.chemin) ? 'C' : /delete$/.test(v.chemin) ? 'S' : '?').join('');
  { const { f, r } = await run({ versBrouillon: true });
    const seq = seqDe(f.j);
    dit(seqV(f.j) === 'LPPBS' && r.etape === 'fait' && r.draftId === '88001' && r.brouillon === true, "en ligne → brouillon : photos, brouillon, PUIS suppression — aucune mise en ligne", `seq=${seqV(f.j)} etape=${r.etape} ${r.raison || ''}`);
    const c = f.lignes['coffre_111_9101'];
    dit(c && c.versBrouillon && /draft/.test(c.versBrouillon.corps || '') && c.title, "l'annonce est enregistrée dans le coffre (avec le corps du brouillon) avant d'être retirée", JSON.stringify(c && Object.keys(c)));
    dit(f.lignes['vinted_brouillon_88001'] && f.lignes['vinted_brouillon_88001'].etat === 'brouillon' && f.lignes['vinted_brouillon_88001'].ancienId === '9101' && f.lignes['vinted_brouillon_88001'].corps, "le brouillon est rangé « brouillon » avec son corps : il se remet en ligne d'ici", JSON.stringify(f.lignes['vinted_brouillon_88001'] && f.lignes['vinted_brouillon_88001'].etat)); }
  { const { f, r } = await run({ versBrouillon: true, suppression: 403 });
    dit(brouillonsP(f.j).length === 1 && r.etape === 'echec' && /toujours en ligne/.test(r.raison || ''), "en ligne → brouillon, suppression refusée : elle est dite toujours en ligne, le brouillon en trop nommé", `b=${brouillonsP(f.j).length} etape=${r.etape}`); }
  { const { f, r } = await run({ versBrouillon: true, suppression: 502 });
    dit(brouillonsP(f.j).length === 1 && r.etape === 'double' && /PEUT-ÊTRE/.test(r.raison || ''), "en ligne → brouillon, suppression sans réponse claire : le brouillon est créé quand même, « peut-être encore en ligne » dit", `b=${brouillonsP(f.j).length} etape=${r.etape}`); }
  { const { f, r } = await run({ versBrouillon: true, brouillon: 422 });
    dit(suppressions(f.j).length === 0 && brouillonsP(f.j).length === 1 && completions(f.j).length === 0 && r.etape === 'echec' && /toujours en ligne/.test(r.raison || ''), "en ligne → brouillon, brouillon refusé : jamais retenté, rien supprimé", `s=${suppressions(f.j).length} b=${brouillonsP(f.j).length} etape=${r.etape}`); }
  { const { f, r } = await run({ versBrouillon: true, brouillon: 502 });
    dit(brouillonsP(f.j).length === 1 && suppressions(f.j).length === 0 && r.etape === 'incertain', "en ligne → brouillon, brouillon sans réponse claire : jamais retenté (il existe peut-être), rien supprimé", `b=${brouillonsP(f.j).length}`); }
  { const { f, r } = await run({ versBrouillon: true, brouillonSansId: true });
    dit(r.etape === 'echec' && completions(f.j).length === 0 && suppressions(f.j).length === 0, "en ligne → brouillon, brouillon sans identifiant : dit, rien deviné, rien supprimé", `etape=${r.etape}`); }
  { const { f, r } = await run({ versBrouillon: true, coffreEcritureKO: true });
    dit(suppressions(f.j).length === 0 && brouillonsP(f.j).length === 0 && r.etape === 'echec', "en ligne → brouillon, enregistrement raté : rien supprimé, rien créé", `s=${suppressions(f.j).length} etape=${r.etape}`); }
  { const { f, r } = await run({ versBrouillon: true, confirme: false });
    dit(zero(f.j) && r.code === 'confirmation', "en ligne → brouillon sans confirmation : aucune requête", `code=${r.code}`); }

  // N — mettre en ligne SON brouillon depuis VRM (`publierBrouillon`).
  const CORPS_B = (o = {}) => JSON.stringify({ draft: { id: null, currency: 'EUR', temp_uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', title: 'Nike Air Max 1 dark teal', description: 'très bon état', brand_id: 53, brand: 'Nike', catalog_id: 1242, price: '65', package_size_id: 1, color_ids: [12], assigned_photos: [{ id: 1, orientation: 0 }], item_attributes: [{ code: 'size', ids: [785] }], ...o }, parcel: null, upload_session_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });
  const dressing = (ids) => ({ harvest_111_listings: { capturedAt: nowISO(), payload: { items: ids.map((x) => ({ id: x, is_draft: true })) } } });
  const pubB = async (opts = {}) => {
    const extra = { ...(opts.dressing === false ? {} : dressing(['10432342904'])), ...(opts.ligne === false ? {} : { vinted_brouillon_10432342904: { id: '10432342904', uid: opts.uid || '111', corps: opts.corps || CORPS_B(), etat: 'brouillon' } }) };
    const f = monter({ src: process.env.BG_SRC || undefined, extra, completion: opts.completion || 200, completionCorps: opts.completionCorps || null, couleursRep: opts.couleursRep || null });
    if (typeof f.ctx.publierBrouillon !== 'function') return { f, r: { absent: true } };
    let r = {}; try { r = await f.ctx.publierBrouillon({ cmd: 'publierBrouillon', uid: '111', draftId: '10432342904', confirme: opts.confirme !== false, couleur: opts.couleur }); } catch (e) { r = { erreur: e.message }; }
    return { f, r };
  };
  { const { f, r } = await pubB();
    let c = {}; try { c = JSON.parse(completions(f.j)[0].corps); } catch (_) {}
    dit(gestes(f.j).length === 1 && r.etape === 'fait' && c.draft && c.draft.id === 10432342904 && c.push_up === false && c.draft.title === 'Nike Air Max 1 dark teal' && /drafts\/10432342904\/completion$/.test(completions(f.j)[0].chemin), "brouillon complet de son dressing : UNE requête, la mise en ligne, avec SON corps tel quel", `n=${f.j.vinted.length} etape=${r.etape} ${r.raison || r.erreur || ''}`);
    dit(f.lignes.vinted_brouillon_10432342904.etat === 'publie' && f.lignes.vrm_vinted_modele && f.lignes.vrm_vinted_modele['10432342904'], "noté « publié », et sa recette gardée pour une prochaine republication"); }
  { const { f, r } = await pubB({ corps: CORPS_B({ price: 0 }) });
    dit(zero(f.j) && r.code === 'incomplet' && /prix/.test(r.raison || ''), "brouillon sans prix : refusé, aucune requête, il est nommé ce qui manque", `n=${f.j.vinted.length} ${r.raison || ''}`); }
  { const { f, r } = await pubB({ dressing: false });
    dit(zero(f.j) && r.code === 'pas-dans-dressing', "un brouillon absent de son dressing lu : refusé, aucune requête", `code=${r.code}`); }
  { const { f, r } = await pubB({ ligne: false });
    dit(zero(f.j) && r.code === 'brouillon-inconnu' && /Enregistrer/.test(r.raison || ''), "contenu inconnu : refusé, aucune requête, et le geste qui l'apprend", `code=${r.code}`); }
  { const { f, r } = await pubB({ uid: '222' });
    dit(zero(f.j) && r.code === 'autre-compte', "brouillon d'un autre compte : refusé", `code=${r.code}`); }
  { const { f, r } = await pubB({ confirme: false });
    dit(zero(f.j) && r.code === 'confirmation', "sans confirmation : aucune requête", `code=${r.code}`); }
  { const { f, r } = await pubB({ completion: 422 });
    dit(r.etape === 'echec' && f.lignes.vinted_brouillon_10432342904.etat === 'brouillon', "mise en ligne refusée : le brouillon reste un brouillon, c'est dit", `etape=${r.etape}`); }
  { const { f, r } = await pubB({ corps: CORPS_B({ color_ids: [] }) });
    dit(zero(f.j) && r.code === 'couleur-absente' && /couleur/.test(r.raison || '') && r.couleurs && r.couleurs[1] === 'Noir', "brouillon sans couleur : refusé AVANT d'envoyer (Vinted le refuserait), et les couleurs que VRM sait poser sont proposées", `n=${f.j.vinted.length} code=${r.code} ${r.raison || ''}`); }
  // (28 oct., N°72) Il CHOISIT la couleur dans VRM : la mise en ligne part avec elle.
  { const { f, r } = await pubB({ corps: CORPS_B({ color_ids: [] }), couleur: 1 });
    let c = {}; try { c = JSON.parse(completions(f.j)[0].corps); } catch (_) {}
    dit(r.etape === 'fait' && JSON.stringify(c.draft && c.draft.color_ids) === '[1]', "couleur choisie dans VRM (Noir) : la mise en ligne part avec color_ids [1]", JSON.stringify({ e: r.etape, code: r.code, c: c.draft && c.draft.color_ids })); }
  { const { f, r } = await pubB({ corps: CORPS_B({ color_ids: [] }), couleur: 999 });
    dit(zero(f.j) && r.code === 'couleur-absente', "une couleur que VRM ne connaît pas n'est jamais envoyée", `n=${f.j.vinted.length} code=${r.code}`); }
  // 5.266 — la liste des couleurs de VINTED (GET item_upload/colors) : id et nom
  //  de Vinted, proposés au choix ; la couleur choisie part, aucune n'est devinée.
  const COUL = { status: 200, body: { colors: [{ id: 1, title: 'Noir', hex: '000000' }, { id: 3, title: 'Gris' }, { id: 12, title: 'Blanc' }, { id: 27, title: 'Beige' }] } };
  { const { f, r } = await pubB({ corps: CORPS_B({ color_ids: [] }), couleursRep: COUL });
    dit(zero(f.j) && r.code === 'couleur-absente' && r.couleurs && r.couleurs[12] === 'Blanc' && r.couleurs[27] === 'Beige' && r.couleurs[1] === 'Noir', "liste des couleurs lue chez Vinted : toutes proposées avec LEUR nom, rien n'est envoyé avant le choix", JSON.stringify(r.couleurs)); }
  { const { f, r } = await pubB({ corps: CORPS_B({ color_ids: [] }), couleursRep: COUL, couleur: 12 });
    let c = {}; try { c = JSON.parse(completions(f.j)[0].corps); } catch (_) {}
    dit(r.etape === 'fait' && JSON.stringify(c.draft && c.draft.color_ids) === '[12]', "couleur choisie dans la liste de Vinted (Blanc) : la mise en ligne part avec color_ids [12]", JSON.stringify({ e: r.etape, code: r.code, c: c.draft && c.draft.color_ids })); }
  { const { f, r } = await pubB({ corps: CORPS_B({ color_ids: [] }), couleursRep: { status: 200, body: { colors: [{ id: 1, title: 'Blanc' }, { id: 2, title: 'Rouge' }, { id: 3, title: 'Vert' }] } }, couleur: 2 });
    dit(zero(f.j) && r.code === 'couleur-absente' && !r.couleurs[2], "une liste dont le n°1 n'est pas « Noir » n'est pas la liste des couleurs : refusée, rien n'est posé", JSON.stringify(r.couleurs)); }
  { const f = monter({ src: process.env.BG_SRC || undefined });
    const okR = typeof f.ctx.rangerCouleursVinted === 'function' ? await f.ctx.rangerCouleursVinted('www.vinted.fr', [{ id: 1, title: 'Noir' }, { id: 5, title: 'Marron' }, { id: 9, title: 'Bleu marine' }, { id: 44, title: '<img src=x>' }]) : false;
    const st = okR ? (await f.ctx.chrome.storage.local.get('vrmCouleursVinted')).vrmCouleursVinted : null;
    const c = typeof f.ctx.couleursConnues === 'function' ? await f.ctx.couleursConnues('111', null) : {};
    dit(okR && st && st.liste && st.liste[5] === 'Marron' && !st.liste[44] && c[9] === 'Bleu marine' && f.j.vinted.length === 0, "liste captée en passant par la page de dépôt : rangée (un libellé qui n'est pas un nom de couleur est écarté), sans aucune requête", JSON.stringify(st)); }
  { const { r } = await pubB({ completion: 400, completionCorps: { code: 99, message: 'Erreurs trouvées', message_code: 'validation_error', errors: [{ field: 'color_ids', value: 'Choisis une couleur' }] } });
    dit(r.etape === 'echec' && /couleur/.test(r.raison || '') && /Choisis une couleur/.test(r.raison || ''), "un refus de Vinted dit QUEL champ il réclame (plus seulement « Erreurs trouvées »)", r.raison || ''); }
  // (28 oct.) Un brouillon fait par VRM avec des photos EN DOUBLE (avant 5.261) :
  //  ses doublons sont retirés à la mise en ligne, d'après les liens du coffre.
  { const corps = CORPS_B({ assigned_photos: [{ id: 11, orientation: 0 }, { id: 12, orientation: 0 }, { id: 13, orientation: 0 }, { id: 14, orientation: 0 }] });
    const extra = { ...dressing(['10432342904']), vinted_brouillon_10432342904: { id: '10432342904', uid: '111', corps, etat: 'brouillon', parVRM: true, ancienId: '9555' },
      coffre_111_9555: { id: '9555', photos: [PHOTOS[0], PHOTOS[1], PHOTOS_D[0], PHOTOS_D[1]] } };
    const f = monter({ src: process.env.BG_SRC || undefined, extra });
    let r = {}; try { r = await f.ctx.publierBrouillon({ cmd: 'publierBrouillon', uid: '111', draftId: '10432342904', confirme: true }); } catch (e) { r = { erreur: e.message }; }
    let c = {}; try { c = JSON.parse(completions(f.j)[0].corps); } catch (_) {}
    dit(r.etape === 'fait' && c.draft && JSON.stringify(c.draft.assigned_photos.map((p) => p.id)) === '[11,12]', "brouillon VRM aux photos en double : la mise en ligne ne garde qu'UNE photo par photo", JSON.stringify({ e: r.etape, ids: c.draft && c.draft.assigned_photos && c.draft.assigned_photos.map((p) => p.id), raison: r.raison || r.erreur })); }
  // (28 oct., N°2 Jordan 3) Vinted refuse les PHOTOS d'un brouillon fait par VRM
  //  (« Erreur lors du chargement de la photo ») : VRM renvoie les photos du
  //  coffre, remplace celles du brouillon, et réessaie UNE fois.
  { const corps = CORPS_B({ assigned_photos: [{ id: 11, orientation: 0 }, { id: 12, orientation: 0 }] });
    const extra = { ...dressing(['10432342904']), vinted_brouillon_10432342904: { id: '10432342904', uid: '111', corps, etat: 'brouillon', parVRM: true, ancienId: '9555' },
      coffre_111_9555: { id: '9555', photos: [PHOTOS[0], PHOTOS[1], PHOTOS_D[0]] } };
    let nC = 0;
    const f = monter({ src: process.env.BG_SRC || undefined, extra, completion: () => (++nC <= 1 ? 400 : 200),
      completionCorps: { code: 99, message: 'Erreurs trouvées', errors: [{ field: 'assigned_photos', value: 'Erreur lors du chargement de la photo' }] } });
    let r = {}; try { r = await f.ctx.publierBrouillon({ cmd: 'publierBrouillon', uid: '111', draftId: '10432342904', confirme: true }); } catch (e) { r = { erreur: e.message }; }
    const cs = completions(f.j);
    let c3 = {}; try { c3 = JSON.parse(cs[1].corps); } catch (_) {}
    const ids3 = c3.draft && Array.isArray(c3.draft.assigned_photos) ? c3.draft.assigned_photos.map((p) => p.id) : [];
    // (29 oct., « comme Vintex ») plus AUCUN renvoi automatique : un refus = une seule mise en ligne, et le geste dit.
    dit(r.etape === 'echec' && cs.length === 1 && photosP(f.j).length === 0 && /rajoute les photos/.test(r.raison || '') && /brouillon est intact/.test(r.raison || ''), "photos refusées : UNE seule mise en ligne, aucun renvoi de photos en rafale, le geste sur Vinted est dit", JSON.stringify({ e: r.etape, m: cs.length, p: photosP(f.j).length, raison: r.raison || r.erreur })); }
  // (29 oct.) Photos renvoyées, puis refus pour la TAILLE : les nouvelles photos
  //  sont gardées dans le brouillon enregistré, et le geste de la taille est dit.
  { const corps = CORPS_B({ assigned_photos: [{ id: 11, orientation: 0 }, { id: 12, orientation: 0 }] });
    const extra = { ...dressing(['10432342904']), vinted_brouillon_10432342904: { id: '10432342904', uid: '111', corps, etat: 'brouillon', parVRM: true, ancienId: '9555' },
      coffre_111_9555: { id: '9555', photos: [PHOTOS[0], PHOTOS[1]] } };
    let nC = 0;
    const f = monter({ src: process.env.BG_SRC || undefined, extra, completion: () => 400,
      completionCorps: () => (++nC <= 1 ? { code: 99, message: 'Erreurs trouvées', errors: [{ field: 'assigned_photos', value: 'Erreur lors du chargement de la photo' }] } : { code: 99, message: 'Erreurs trouvées', errors: [{ field: 'size', value: 'Le champ Taille doit être renseigné' }] }) });
    let r = {}; try { r = await f.ctx.publierBrouillon({ cmd: 'publierBrouillon', uid: '111', draftId: '10432342904', confirme: true }); } catch (e) { r = { erreur: e.message }; }
    let gard = {}; try { gard = JSON.parse(f.lignes.vinted_brouillon_10432342904.corps); } catch (_) {}
    const idsG = gard.draft && Array.isArray(gard.draft.assigned_photos) ? gard.draft.assigned_photos.map((p) => p.id) : [];
    dit(r.etape === 'echec' && completions(f.j).length === 1 && photosP(f.j).length === 0 && JSON.stringify(idsG) === '[11,12]', "photos refusées (une taille refusée derrière) : rien renvoyé, le brouillon enregistré reste tel quel", JSON.stringify({ e: r.etape, idsG, raison: (r.raison || '').slice(0, 160) })); }
  // (29 oct., Spezial 38) Vinted refuse la TAILLE : VRM lit la grille de tailles
  //  de la catégorie, pose la taille au libellé EXACT de la paire (coffre), et
  //  réessaie UNE fois ; jamais deux options au même libellé, jamais devinée.
  const GRILLE = (opts) => ({ status: 200, body: { attributes: [{ code: 'condition', configuration: { options: [{ id: 2, title: 'Très bon état' }] } }, { code: 'size', configuration: { groups: [{ id: 4, title: 'Femmes', options: opts }] } }] } });
  const tailleKO = { code: 99, message: 'Erreurs trouvées', errors: [{ field: 'size', value: 'Le champ Taille doit être renseigné' }] };
  const pubT = async ({ coffreSize = '38', grille = GRILLE([{ id: 1196, title: '37,5' }, { id: 1197, title: '38' }, { id: 1198, title: '38,5' }]), toujoursKO = false } = {}) => {
    const corps = CORPS_B({ item_attributes: [{ code: 'condition', ids: [2] }, { code: 'size', ids: [2033] }] });
    const extra = { ...dressing(['10432342904']), vinted_brouillon_10432342904: { id: '10432342904', uid: '111', corps, etat: 'brouillon', parVRM: true, ancienId: '9557' },
      coffre_111_9557: { id: '9557', photos: [PHOTOS[0]], ...(coffreSize ? { size: coffreSize } : {}) } };
    let nC = 0;
    const f = monter({ src: process.env.BG_SRC || undefined, extra, attributsRep: grille, completion: () => (toujoursKO ? 400 : 200), completionCorps: () => tailleKO });
    let r = {}; try { r = await f.ctx.publierBrouillon({ cmd: 'publierBrouillon', uid: '111', draftId: '10432342904', confirme: true }); } catch (e) { r = { erreur: e.message }; }
    return { f, r, att: f.j.vinted.filter((x) => /item_upload\/attributes$/.test(x.chemin)) };
  };
  { const { f, r, att } = await pubT();
    const cs = completions(f.j); let c2 = {}; try { c2 = JSON.parse(cs[0].corps); } catch (_) {}
    const sz = c2.draft && (c2.draft.item_attributes || []).find((a) => a.code === 'size');
    let gard = {}; try { gard = JSON.parse(f.lignes.vinted_brouillon_10432342904.corps); } catch (_) {}
    const szG = gard.draft && (gard.draft.item_attributes || []).find((a) => a.code === 'size');
    const cond = c2.draft && (c2.draft.item_attributes || []).find((a) => a.code === 'condition');
    let corpsA = {}; try { corpsA = JSON.parse(att[0].corps); } catch (_) {}
    dit(r.etape === 'fait' && att.length === 1 && JSON.stringify(corpsA) === JSON.stringify({ attributes: [{ code: 'category', value: [1242] }] }) && cs.length === 1 && sz && JSON.stringify(sz.ids) === '[1197]' && cond && JSON.stringify(cond.ids) === '[2]' && szG && JSON.stringify(szG.ids) === '[1197]',
      "code de taille plus dans la grille : vérifié AVANT d'envoyer, taille « 38 » de la paire posée (1197), l'état gardé, UNE mise en ligne qui passe, brouillon enregistré à jour", JSON.stringify({ e: r.etape, att: att.length, sz, szG, raison: r.raison || r.erreur })); }
  { const { f, r, att } = await pubT({ grille: GRILLE([{ id: 1197, title: '38' }, { id: 1290, title: 'EU 38' }]) });
    dit(r.code === 'incomplet' && completions(f.j).length === 0 && /plusieurs tailles/.test(r.raison || '') && /Modifier/.test(r.raison || ''), "deux options au même libellé : VRM ne choisit pas, RIEN n'est envoyé, c'est dit avec le geste", JSON.stringify({ e: r.etape, raison: (r.raison || '').slice(0, 200) })); }
  { const { f, r, att } = await pubT({ coffreSize: '', grille: GRILLE([{ id: 1197, title: '38' }]) });
    dit(r.code === 'incomplet' && completions(f.j).length === 0 && /ne connaît pas la taille/.test(r.raison || ''), "taille de la paire inconnue et code plus dans la grille : rien n'est deviné (pas même le titre), RIEN n'est envoyé", JSON.stringify({ e: r.etape, att: att.length, raison: (r.raison || '').slice(0, 160) })); }
  { const { f, r } = await pubT({ grille: GRILLE([{ id: 1196, title: '37,5' }]) });
    dit(r.code === 'incomplet' && completions(f.j).length === 0 && /ne propose pas de taille « 38 »/.test(r.raison || ''), "aucune taille au libellé exact : rien n'est posé ni envoyé, c'est dit", (r.raison || '').slice(0, 160)); }
  { const { f, r } = await pubT({ toujoursKO: true, grille: { status: 200, body: { foo: [1, 2] } } });
    dit(r.etape === 'echec' && completions(f.j).length === 1 && /choisis la taille/.test(r.raison || ''), "grille d'une forme inconnue puis taille refusée : un seul essai, le geste de la taille est dit", (r.raison || '').slice(0, 160)); }
  { const { f, r } = await pubT({ toujoursKO: true });
    dit(r.etape === 'echec' && completions(f.j).length === 1 && /choisis la taille/.test(r.raison || ''), "taille de la grille posée et Vinted la refuse quand même : aucun essai de plus, c'est dit", JSON.stringify({ m: completions(f.j).length, raison: (r.raison || '').slice(0, 160) })); }
  // (29 oct., « que toutes les catégories obligatoires soient remplies avant de
  //  valider ») Un attribut que Vinted marque obligatoire (matière) et absent ⇒
  //  rien n'est envoyé, il est NOMMÉ ; l'état exigé par la grille aussi.
  { const g = { status: 200, body: { attributes: [{ code: 'size', configuration: { options: [{ id: 1197, title: '38' }] } }, { code: 'material', required: true, configuration: { options: [{ id: 44, title: 'Cuir' }] } }, { code: 'condition', configuration: { options: [{ id: 2, title: 'Très bon état' }] } }] } };
    const { f, r } = await pubT({ grille: g });
    dit(r.code === 'incomplet' && completions(f.j).length === 0 && /la matière/.test(r.raison || ''), "attribut marqué obligatoire par Vinted (matière) et absent : rien n'est envoyé, il est nommé", (r.raison || '').slice(0, 160));
    const corps = CORPS_B({ item_attributes: [{ code: 'size', ids: [1197] }] });
    const extra = { ...dressing(['10432342904']), vinted_brouillon_10432342904: { id: '10432342904', uid: '111', corps, etat: 'brouillon' } };
    const f2 = monter({ src: process.env.BG_SRC || undefined, extra, attributsRep: { status: 200, body: { attributes: [{ code: 'size', configuration: { options: [{ id: 1197, title: '38' }] } }, { code: 'condition', configuration: { options: [{ id: 2, title: 'Très bon état' }] } }] } } });
    let r2 = {}; try { r2 = await f2.ctx.publierBrouillon({ cmd: 'publierBrouillon', uid: '111', draftId: '10432342904', confirme: true }); } catch (e) { r2 = { erreur: e.message }; }
    dit(r2.code === 'incomplet' && completions(f2.j).length === 0 && /l'état/.test(r2.raison || ''), "brouillon sans état alors que la catégorie en a un : rien n'est envoyé, « l'état » est nommé", (r2.raison || r2.erreur || '').slice(0, 160)); }
  // (29 oct., « il ne doit pas y avoir d'erreur possible ») La taille est
  //  vérifiée AVANT de toucher à l'annonce (Republier, par brouillon ou direct).
  const coffreT = (size) => ({ coffre_111_9101: { id: '9101', title: 'Nike Air Max 1', price: 60, desc: 'Nickel, boîte d’origine', photos: PHOTOS, size } });
  const GRILLE_A = (opts) => ({ status: 200, body: { attributes: [{ code: 'size', configuration: { options: opts } }] } });
  for (const via of [false, true]) {
    { const { f, r } = await run({ viaBrouillon: via, extra: coffreT('38'), attributsRep: GRILLE_A([{ id: 1197, title: '38' }, { id: 1198, title: '38,5' }]) });
      const c = via ? brouillonsP(f.j)[0] : creations(f.j)[0]; let o = {}; try { o = JSON.parse(c.corps); } catch (_) {}
      const it = o.item || o.draft || {}; const sz = (it.item_attributes || []).find((a) => a.code === 'size'); const cond = (it.item_attributes || []).find((a) => a.code === 'condition');
      dit(r.etape === 'fait' && sz && JSON.stringify(sz.ids) === '[1197]' && cond && JSON.stringify(cond.ids) === '[2]', `${via ? 'par brouillon' : 'direct'} : code de taille plus dans la grille ⇒ la taille « 38 » de la grille est posée AVANT d'envoyer, l'état gardé`, JSON.stringify({ e: r.etape, sz, raison: r.raison || r.erreur })); }
    { const { f, r } = await run({ viaBrouillon: via, extra: coffreT('38'), attributsRep: GRILLE_A([{ id: 1196, title: '37,5' }]) });
      dit(r.code === 'incomplet' && suppressions(f.j).length === 0 && creations(f.j).length === 0 && brouillonsP(f.j).length === 0 && photosP(f.j).length === 0 && /Rien n'a été touché/.test(r.raison || ''), `${via ? 'par brouillon' : 'direct'} : taille absente de la grille ⇒ arrêt AVANT tout geste (ni photo, ni suppression, ni création)`, JSON.stringify({ code: r.code, s: suppressions(f.j).length, raison: (r.raison || '').slice(0, 140) })); }
    { const { f, r } = await run({ viaBrouillon: via, extra: coffreT('38'), attributsRep: GRILLE_A([{ id: 56, title: '38' }]) });
      dit(r.etape === 'fait', `${via ? 'par brouillon' : 'direct'} : code déjà juste ⇒ rien ne change`, r.raison || ''); }
    { const { f, r } = await run({ viaBrouillon: via, extra: coffreT('38'), attributsRep: { status: 500, body: {} } });
      dit(r.etape === 'fait', `${via ? 'par brouillon' : 'direct'} : grille illisible ⇒ comme avant (le secours après refus reste)`, r.raison || ''); }
  }
  // … sans coffre lisible : rien n'est renvoyé, c'est dit avec le geste Vinted.
  { const corps = CORPS_B();
    const extra = { ...dressing(['10432342904']), vinted_brouillon_10432342904: { id: '10432342904', uid: '111', corps, etat: 'brouillon', parVRM: true, ancienId: '9556' } };
    const f = monter({ src: process.env.BG_SRC || undefined, extra, completion: 400,
      completionCorps: { code: 99, message: 'Erreurs trouvées', errors: [{ field: 'assigned_photos', value: 'Erreur lors du chargement de la photo' }] } });
    let r = {}; try { r = await f.ctx.publierBrouillon({ cmd: 'publierBrouillon', uid: '111', draftId: '10432342904', confirme: true }); } catch (e) { r = { erreur: e.message }; }
    dit(r.etape === 'echec' && completions(f.j).length === 1 && photosP(f.j).length === 0 && /rajoute les photos/.test(r.raison || ''), "photos refusées sans photo dans VRM : aucun essai inutile, et le geste sur Vinted est dit", JSON.stringify({ e: r.etape, m: completions(f.j).length, raison: r.raison })); }
  // Une photo d'origine en WEBP part en JPEG (son nom est « photo-N.jpg »).
  { const f = monter({ src: process.env.BG_SRC || undefined });
    f.ctx.createImageBitmap = async () => ({ width: 4, height: 4, close() {} });
    f.ctx.OffscreenCanvas = class { constructor() {} getContext() { return { fillRect() {}, drawImage() {}, translate() {}, rotate() {}, scale() {}, filter: '' }; } async convertToBlob(o) { return new Blob(['j'], { type: o.type }); } };
    let t1 = '', t2 = '';
    try { const neutre = f.ctx.reglagesPhotoSurs({}); t1 = (await f.ctx.photoReglee(new Blob(['w'], { type: 'image/webp' }), neutre)).type; t2 = (await f.ctx.photoReglee(new Blob(['j'], { type: 'image/jpeg' }), neutre)).type; } catch (e) { t1 = 'erreur ' + e.message; }
    dit(t1 === 'image/jpeg' && t2 === 'image/jpeg', "une photo WEBP, réglages neutres : réencodée en JPEG avant l'envoi (un JPEG part tel quel)", JSON.stringify({ t1, t2 })); }
  // O — le brouillon qu'il enregistre sur Vinted est appris (corps accepté, id).
  { const f = monter({ src: process.env.BG_SRC || undefined });
    let ok1 = false, ok2 = true;
    if (typeof f.ctx.noterBrouillonVinted === 'function') {
      ok1 = await f.ctx.noterBrouillonVinted('10432342904', 200, CORPS_B(), 'www.vinted.fr', { tab: { url: 'https://www.vinted.fr/items/new' } });
      ok2 = await f.ctx.noterBrouillonVinted('10432342905', 200, CORPS_B({ id: 99 }), 'www.vinted.fr', { tab: { url: 'https://www.vinted.fr/items/new' } });
    }
    const l = f.lignes.vinted_brouillon_10432342904;
    dit(ok1 && l && l.uid === '111' && l.titre === 'Nike Air Max 1 dark teal' && l.prix === 65 && l.nPhotos === 1 && l.etat === 'brouillon', "un brouillon enregistré sur Vinted est appris (compte du cookie, titre, prix, photos)", JSON.stringify(l && { uid: l.uid, t: l.titre, p: l.prix }));
    dit(!ok2 && !f.lignes.vinted_brouillon_10432342905, "un corps qui contredit l'identifiant n'est pas rangé"); }

  // P2 — (28 oct., SA demande : « va beaucoup plus doucement », « aléatoire »)
  //  Une pause tirée au hasard entre chaque photo, avant le brouillon et avant la
  //  mise en ligne, chacune dans sa plage (le banc ramène le temps à 2 ms).
  { const tirages = [];
    for (let k = 0; k < 2; k++) {
      const f = monter({ src: process.env.BG_SRC || undefined }); f.ctx.__vrmPausesVues = [];
      try { await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike', viaBrouillon: true, confirme: true }); } catch (_) {}
      tirages.push(f.ctx.__vrmPausesVues);
    }
    const P = tirages[0] || []; const dans = (q, a, b) => P.filter((x) => x[0] === q).every((x) => x[1] >= a && x[1] <= b);
    const nb = (q) => P.filter((x) => x[0] === q).length;
    dit(nb('lecture') === 1 && nb('photo') === PHOTOS.length - 1 && nb('brouillon') === 1 && nb('suppression') === 1 && nb('enLigne') === 1 && dans('lecture', 1500, 4000) && dans('photo', 2000, 4500) && dans('brouillon', 800, 2000) && dans('suppression', 400, 800) && dans('enLigne', 60000, 180000), "republier (« comme Vintex », délais mesurés) : 1,5–4 s après la lecture, 2–4,5 s entre deux photos, ~1 s avant le brouillon, 0,4–0,8 s avant la suppression, 1 à 3 min avant la mise en ligne", JSON.stringify(P));
    dit(JSON.stringify(tirages[0]) !== JSON.stringify(tirages[1]), "deux republications ne font jamais les mêmes pauses (tirées au hasard)", JSON.stringify(tirages)); }
  // D — (28 oct., Air Max 1 et zoom fly) « Le champ Description doit comprendre
  //     au moins 5 caractères » : la description vide (ou réduite à la lettre)
  //     est reprise sur Vinted AVANT de supprimer ; introuvable ⇒ rien n'est touché.
  { const sansDesc = { coffre_111_9101: { id: '9101', title: 'Nike Air Max 1', price: 60, desc: 'q', photos: PHOTOS } };
    const { f, r } = await run({ coffre: false, extra: sansDesc, viaBrouillon: true });
    dit(suppressions(f.j).length === 0 && brouillonsP(f.j).length === 0 && r.code === 'description-absente', "description vide (la lettre seule) et introuvable : refusé AVANT de supprimer, rien créé", JSON.stringify({ s: suppressions(f.j).length, b: brouillonsP(f.j).length, code: r.code, e: r.etape }));
    const g = await run({ coffre: false, extra: sansDesc, viaBrouillon: true, lettre: true, lecture: { status: 200, body: { item: { id: 9101, description: 'Très bon état, boîte d’origine', catalog_id: 88, brand_id: 9, color_ids: [1], item_attributes: [{ code: 'size', ids: [55] }], package_size_id: 2 } } } });
    let b = {}; try { b = JSON.parse(brouillonsP(g.f.j)[0].corps); } catch (_) {}
    const d = (b.draft && b.draft.description) || '';
    dit(g.r.etape === 'fait' && /^Très bon état, boîte d’origine/.test(d) && !/^q\b/.test(d), "description vide : reprise sur l'annonce Vinted, le brouillon part avec elle (et la lettre en bas)", JSON.stringify({ e: g.r.etape, d, raison: g.r.raison || g.r.erreur })); }
  // D2 — « Refaire le brouillon » d'un passage enregistré avec la lettre seule
  //      comme description (les Air Max 1 et zoom fly du 28 oct.).
  { const corps = JSON.stringify({ draft: { id: null, title: 'Nike Air Max 1', price: '54', catalog_id: 88, brand_id: 9, color_ids: [1], description: '\n\nq', item_attributes: [{ code: 'size', ids: [55] }], package_size_id: 2, assigned_photos: [] }, parcel: null, upload_session_id: 'x' });
    const coffreVb = (extraDesc) => ({ coffre_111_9101: { id: '9101', title: 'Nike Air Max 1', price: 60, desc: extraDesc, photos: PHOTOS, versBrouillon: { etat: 'a-refaire', supprime: true, corps, majAt: new Date(Date.now() - 3600e3).toISOString() } } });
    const f1 = monter({ src: process.env.BG_SRC || undefined, coffre: false, extra: coffreVb('q') });
    let r1 = {}; if (typeof f1.ctx.refaireBrouillon === 'function') { try { r1 = await f1.ctx.refaireBrouillon({ cmd: 'refaireBrouillon', uid: '111', id: '9101', confirme: true }); } catch (e) { r1 = { erreur: e.message }; } }
    dit(r1.code === 'description-absente' && f1.j.vinted.length === 0, "Refaire, description vide et introuvable : refusé, aucune requête", JSON.stringify({ code: r1.code, n: f1.j.vinted.length, e: r1.etape }));
    const f2 = monter({ src: process.env.BG_SRC || undefined, coffre: false, extra: coffreVb('q'), descDetails: 'Très bon état, boîte d’origine' });
    let r2 = {}; if (typeof f2.ctx.refaireBrouillon === 'function') { try { r2 = await f2.ctx.refaireBrouillon({ cmd: 'refaireBrouillon', uid: '111', id: '9101', confirme: true }); } catch (e) { r2 = { erreur: e.message }; } }
    let b2 = {}; try { b2 = JSON.parse(de(f2.j, /\/item_upload\/drafts\/?$/)[0].corps); } catch (_) {}
    const d2 = (b2.draft && b2.draft.description) || '';
    dit(r2.etape === 'fait' && d2 === 'Très bon état, boîte d’origine\n\nq', "Refaire, description vide : reprise sur la fiche de l'annonce, la lettre gardée en bas", JSON.stringify({ e: r2.etape, d: d2, raison: r2.raison || r2.erreur })); }
  // P2 — (28 oct., « de brouillon à en ligne ça marche pas ») Republier et
  //      Refaire : la mise en ligne refusée pour les photos est réessayée.
  { const erreurPhotos = { code: 99, message: 'Erreurs trouvées', errors: [{ field: 'assigned_photos', value: 'Erreur lors du chargement de la photo' }] };
    let nC = 0;
    const f = monter({ src: process.env.BG_SRC || undefined, completion: () => (++nC === 1 ? 400 : 200), completionCorps: erreurPhotos });
    let r = {}; try { r = await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike Air Max 1', viaBrouillon: true, confirme: true }); } catch (e) { r = { erreur: e.message }; }
    dit(r.etape === 'brouillon-a-refaire' && nC === 1 && photosP(f.j).length === 2 && /pas de nouvel essai en rafale/.test(r.raison || ''), "republier, mise en ligne refusée : UN essai, rien renvoyé en rafale, le brouillon reste à mettre en ligne", JSON.stringify({ e: r.etape, n: nC, raison: r.raison || r.erreur }));
    dit((f.lignes['coffre_111_9101'] || {}).versBrouillon && f.lignes['coffre_111_9101'].versBrouillon.etat === 'a-publier', "… et le coffre dit « brouillon à mettre en ligne » (Refaire le met en ligne, sans en créer un second)", JSON.stringify((f.lignes['coffre_111_9101'] || {}).versBrouillon || {}).slice(0, 120)); }
  // S — (28 oct., « on ne suit pas vraiment l'avancée ») Chaque pause est annoncée
  //     à l'app avec sa durée ; Refaire annonce ses étapes.
  const planterARefaire = (f) => { const c = f.lignes['coffre_111_9101']; if (c && c.versBrouillon) { c.versBrouillon.etat = 'a-refaire'; c.versBrouillon.supprime = true; c.versBrouillon.publier = true; c.versBrouillon.majAt = new Date(Date.now() - 3600e3).toISOString(); } };
  { let st = 422; const f = monter({ src: process.env.BG_SRC || undefined, brouillon: () => st });
    await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike', viaBrouillon: true, confirme: true });
    const pauses = f.j.evts.filter((e) => e && e.quoi === 'repub' && e.pause);
    dit(pauses.length >= 2 && pauses.every((e) => e.id === '9101' && e.ms > 0 && e.jusqua > 0), "chaque pause est annoncée à l'app (quoi, durée) : elle peut afficher le compte à rebours", JSON.stringify(pauses.map((e) => [e.pause, e.ms])));
    planterARefaire(f); st = 200; const n0 = f.j.evts.length;
    if (typeof f.ctx.refaireBrouillon === 'function') await f.ctx.refaireBrouillon({ cmd: 'refaireBrouillon', uid: '111', id: '9101', confirme: true });
    const et = [...new Set(f.j.evts.slice(n0).filter((e) => e && e.quoi === 'repub' && e.etape).map((e) => e.etape))].join(',');
    dit(et === 'photos,brouillon,attente,en-ligne', "Refaire annonce ses étapes (photos, brouillon, pause, mise en ligne)", et); }
  // R — (28 oct., sa demande) « Refaire le brouillon » : depuis ce qui est
  //     enregistré dans VRM, sans JAMAIS retoucher l'annonce d'origine ; mise en
  //     ligne seulement si la suppression de l'ancienne est CERTAINE.
  const sansDelai = (p, ms = 60000) => Promise.race([p, new Promise((_, ko) => setTimeout(() => ko(new Error('bloqué (file Vinted ?)')), ms))]);
  const refaire = (f, o = {}) => typeof f.ctx.refaireBrouillon === 'function' ? sansDelai(f.ctx.refaireBrouillon({ cmd: 'refaireBrouillon', uid: '111', id: '9101', confirme: o.confirme !== false })).catch((e) => ({ erreur: e.message })) : Promise.resolve({ absent: true });
  const vb = (f) => (f.lignes['coffre_111_9101'] || {}).versBrouillon || {};
  { let st = 422; const f = monter({ src: process.env.BG_SRC || undefined, brouillon: () => st });
    const r1 = await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike Air Max 1', viaBrouillon: true, confirme: true });
    dit(r1.etape === 'echec' && suppressions(f.j).length === 0 && vb(f).supprime !== true, "republier, brouillon refusé : l'ancienne n'est PAS supprimée (jamais « à refaire » sur une annonce encore en ligne)", JSON.stringify({ e: r1.etape, v: vb(f).etat, s: vb(f).supprime }));
    planterARefaire(f); st = 200; const n0 = f.j.vinted.length;
    const r = await refaire(f); const seq = seqDe({ vinted: f.j.vinted.slice(n0) });
    dit(seq === 'PPBM' && r.etape === 'fait' && vb(f).etat === 'fait', "Refaire : photos ×2 depuis VRM, PUIS brouillon, PUIS mise en ligne — l'ancienne n'est pas retouchée", `seq=${seq} etape=${r.etape} ${r.raison || r.erreur || ''}`);
    let b = {}; try { b = JSON.parse(brouillonsP({ vinted: f.j.vinted.slice(n0) })[0].corps); } catch (_) {}
    dit(b.draft && b.draft.id === null && b.draft.title === 'Nike Air Max 1' && b.draft.price === '54' && b.draft.assigned_photos && b.draft.assigned_photos.length === 2 && b.upload_session_id === b.draft.temp_uuid, "le brouillon refait porte le titre, le prix et les photos NEUVES enregistrés", JSON.stringify(b.draft && { t: b.draft.title, p: b.draft.price }));
    const n1 = f.j.vinted.length; const r2 = await refaire(f);
    dit(r2.code === 'deja' && f.j.vinted.length === n1, "refaire une seconde fois : refusé, aucune requête (jamais deux brouillons)", `code=${r2.code}`); }
  { const f = monter({ src: process.env.BG_SRC || undefined, brouillon: 502 });
    await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike', versBrouillon: true, confirme: true });
    dit(suppressions(f.j).length === 0 && vb(f).etat !== 'a-refaire', "en ligne → brouillon sans réponse claire : rien supprimé, rien « à refaire » (il existe peut-être)", JSON.stringify(vb(f)).slice(0, 120)); }
  { let st = 200; const f = monter({ src: process.env.BG_SRC || undefined, brouillon: () => st }); st = 422;
    await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike', versBrouillon: true, confirme: true });
    planterARefaire(f); f.lignes['coffre_111_9101'].versBrouillon.publier = false;
    st = 200; const n0 = f.j.vinted.length; const r = await refaire(f);
    dit(seqDe({ vinted: f.j.vinted.slice(n0) }) === 'PPB' && r.etape === 'fait' && r.brouillon === true, "en ligne → brouillon refait : un brouillon, jamais de mise en ligne", `seq=${seqDe({ vinted: f.j.vinted.slice(n0) })} ${r.raison || r.erreur || ''}`); }
  { const f = monter({ src: process.env.BG_SRC || undefined, brouillon: 422 });
    await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike', viaBrouillon: true, confirme: true });
    f.lignes['coffre_111_9101'].versBrouillon.supprime = false;   // suppression pas confirmée
    f.lignes['coffre_111_9101'].versBrouillon.etat = 'a-refaire';
    const n0 = f.j.vinted.length;
    const brOk = monter({ src: process.env.BG_SRC || undefined }); // pour lire la séquence attendue
    void brOk;
    // Le même fond, brouillon accepté cette fois : on remplace la réponse.
    f.lignes['coffre_111_9101'].versBrouillon.peutExister = false;
    const r = await (async () => { const ff = monter({ src: process.env.BG_SRC || undefined, extra: { coffre_111_9101: f.lignes['coffre_111_9101'] } }); const rr = await refaire(ff); return { rr, seq: seqDe(ff.j) }; })();
    dit(r.seq === 'PPB' && r.rr.etape === 'fait' && /PAS mis en ligne/.test(r.rr.raison || ''), "suppression de l'ancienne PAS confirmée : le brouillon est refait mais JAMAIS mis en ligne, et c'est dit", `seq=${r.seq} ${r.rr.raison || r.rr.erreur || ''}`); void n0; }
  { let st = 422; const f = monter({ src: process.env.BG_SRC || undefined, completion: () => st });
    await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike', viaBrouillon: true, confirme: true });
    dit(vb(f).etat === 'a-publier' && vb(f).draftId === '88001', "mise en ligne refusée : « à mettre en ligne », le brouillon rangé est noté", JSON.stringify({ e: vb(f).etat, d: vb(f).draftId }));
    st = 200; const n0 = f.j.vinted.length; const r = await refaire(f);
    dit(seqDe({ vinted: f.j.vinted.slice(n0) }) === 'M' && r.etape === 'fait' && vb(f).etat === 'fait', "Refaire : le brouillon EXISTANT est mis en ligne — aucune photo, aucun second brouillon", `seq=${seqDe({ vinted: f.j.vinted.slice(n0) })} ${r.raison || r.erreur || ''}`); }
  // (28 oct., N°72) Le brouillon rangé n'est PLUS sur Vinted (une lecture complète
  //  de son dressing, faite après, ne le montre pas) : Refaire en crée un neuf.
  for (const garde of [false, true]) {
    let st = 422; const f = monter({ src: process.env.BG_SRC || undefined, completion: () => st });
    await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike', viaBrouillon: true, confirme: true });
    const items = garde ? [{ id: 88001, is_draft: true }, { id: 5 }] : [{ id: 5 }];
    f.lignes.harvest_111_listings = { capturedAt: new Date(Date.now() + 1000).toISOString(), payload: { items, pagination: { total_entries: items.length } } };
    st = 200; const n0 = f.j.vinted.length; const r = await refaire(f);
    const seq = seqDe({ vinted: f.j.vinted.slice(n0) });
    if (garde) dit(seq === 'M' && r.etape === 'fait', "brouillon encore dans son dressing : Refaire met CE brouillon en ligne (aucun second)", `seq=${seq} ${r.raison || r.erreur || ''}`);
    else dit(seq === 'PPBM' && r.etape === 'fait' && vb(f).etat === 'fait', "brouillon disparu de Vinted (dressing complet lu après) : Refaire en crée un NEUF depuis VRM, puis le met en ligne", `seq=${seq} ${r.raison || r.erreur || ''}`); }
  { for (const [etat, code, msg] of [['fait', 'deja', 'déjà fait'], ['mise-en-ligne-incertaine', 'incertaine', 'mise en ligne sans réponse claire'], ['enregistre', 'en-cours', 'passage commencé il y a moins de 10 min']]) {
      const f = monter({ src: process.env.BG_SRC || undefined, extra: { coffre_111_9101: { id: '9101', title: 'Nike', price: 60, photos: PHOTOS, versBrouillon: { corps: JSON.stringify({ draft: { title: 'Nike', price: '60', catalog_id: 1, description: 'x' } }), etat, at: nowISO(), uid: '111', publier: true, supprime: true } } } });
      const r = await refaire(f);
      dit(zero(f.j) && r.code === code, `${msg} : refusé, aucune requête`, `n=${f.j.vinted.length} code=${r.code}`); } }
  { const f = monter({ src: process.env.BG_SRC || undefined, brouillon: 422 });
    await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike', viaBrouillon: true, confirme: true });
    const n0 = f.j.vinted.length; const r = await refaire(f, { confirme: false });
    dit(r.code === 'confirmation' && f.j.vinted.length === n0, "refaire sans confirmation : aucune requête", `code=${r.code}`); }
  // R2 — l'archivage du dressing ne fait plus disparaître ce que VRM a rangé
  //      (la lettre ajoutée, l'état du brouillon) : sinon la lettre s'empilait.
  { const f = monter({ src: process.env.BG_SRC || undefined, lettreCoffre: 'q', extra: {} });
    f.lignes['coffre_111_9101'].versBrouillon = { corps: '{}', etat: 'a-refaire' };
    let okA = false; try { okA = await f.ctx.archiverAnnonce('111', { id: '9101', title: 'Nike Air Max 1', price: { amount: '60' }, photos: [] }, null); } catch (_) {}
    const c = f.lignes['coffre_111_9101'];
    dit(okA && c.lettreVRM === 'q' && c.versBrouillon && c.versBrouillon.etat === 'a-refaire', "archiver une annonce garde la lettre ajoutée et l'état du brouillon", JSON.stringify({ ok: okA, l: c.lettreVRM, v: c.versBrouillon && c.versBrouillon.etat }));
    let okL = false; try { okL = await f.ctx.archiverLot('111', [{ id: '9101', title: 'Nike Air Max 1 bis', price: { amount: '61' }, photos: [] }], []); } catch (_) {}
    const c2 = f.lignes['coffre_111_9101'];
    dit(okL && c2.title === 'Nike Air Max 1 bis' && c2.lettreVRM === 'q' && c2.versBrouillon && c2.versBrouillon.etat === 'a-refaire', "archiver le dressing (en lot) garde aussi la lettre et l'état", JSON.stringify({ ok: okL, t: c2.title, l: c2.lettreVRM })); }
  { const { f } = await run({ viaBrouillon: true });
    dit(f.lignes['coffre_111_88001'] && !f.lignes['coffre_111_88001'].versBrouillon && vb(f).etat === 'fait', "la nouvelle annonce ne reprend pas l'état du brouillon de l'ancienne ; l'ancienne est notée « fait »", JSON.stringify({ n: f.lignes['coffre_111_88001'] && Object.keys(f.lignes['coffre_111_88001']), v: vb(f).etat })); }

  // R3 — (28 oct., fiabilité) l'archivage du dressing et un passage en brouillon
  //      écrivent la MÊME ligne du coffre. Une lecture lente de l'archivage, faite
  //      AVANT l'écriture du passage et rendue APRÈS, réécrivait la ligne d'avant :
  //      l'état reculait, ou la sauvegarde (« tout est enregistré dans VRM »)
  //      disparaissait. Une seule écriture du coffre à la fois.
  { const f = monter({ src: process.env.BG_SRC || undefined, retardLecture: (u) => (/id=like\.coffre_111_/.test(u) ? 300 : 0) });
    f.lignes['coffre_111_9101'].versBrouillon = { corps: '{}', etat: 'enregistre', uid: '111' };
    const pa = f.ctx.archiverLot('111', [{ id: '9101', title: 'Nike Air Max 1', price: { amount: '62' }, photos: [] }], []).catch(() => false);
    await new Promise((r) => setTimeout(r, 50));
    let okM = false; try { okM = await f.ctx.majVersBrouillon('111', '9101', { etat: 'supprime', supprime: true }); } catch (_) {}
    await pa;
    const v = f.lignes['coffre_111_9101'].versBrouillon || {};
    dit(okM && v.etat === 'supprime' && v.supprime === true, "archivage lent + passage en brouillon : l'état écrit par le passage n'est pas effacé", JSON.stringify({ ok: okM, etat: v.etat, supprime: v.supprime })); }
  { const f = monter({ src: process.env.BG_SRC || undefined, retardLecture: (u) => (/id=like\.coffre_111_/.test(u) ? 600 : 0) });
    const pa = f.ctx.archiverLot('111', [{ id: '9101', title: 'Nike Air Max 1', price: { amount: '62' }, photos: [] }], []).catch(() => false);
    let r = {}; try { r = await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike Air Max 1 — remise en ligne', viaBrouillon: true, confirme: true }); } catch (e) { r = { erreur: e.message }; }
    await pa;
    const v = f.lignes['coffre_111_9101'].versBrouillon;
    dit(r.etape === 'fait' && v && typeof v.corps === 'string' && v.etat === 'fait', "archivage lent pendant une republication : la sauvegarde du passage reste dans VRM (rien de perdu)", JSON.stringify({ etape: r.etape, vb: v ? v.etat : 'PERDUE' })); }

  // G2 — (28 oct., vu chez Julien) un identifiant d'annonce au-delà de 2 147 483 647
  //      (« 10312441750 ») : la base répondait 400 à `data->10312441750` (lu comme un
  //      index de tableau) ⇒ « je n'ai pas pu lire la fiche — on ne touche à rien ».
  { const GID = '10312441750';
    const lignes = { main: { capturedAt: nowISO(), vinted_annonce_numeros: { [GID]: { numero: '2' } } }, vinted_item_details: { [GID]: { description: 'Jordan 3 Fear', photos: PHOTOS_D } },
      ['coffre_111_' + GID]: { id: GID, title: 'Jordan 3', price: 120, desc: 'Jordan 3 Fear', photos: PHOTOS },
      vrm_vinted_modele: { [GID]: { corps: MODELE.replace('9101', GID), at: nowISO(), uid: '111' } } };
    let n = 500;
    const f = faireFond({ src: process.env.BG_SRC || undefined, lignes, connecte: '111', retardLecture: () => 0, cdn: () => ({ status: 200 }),
      vinted: (e) => {
        if (e.methode === 'POST' && /\/api\/v2\/photos$/.test(e.chemin)) return { status: 200, body: { id: ++n } };
        if (e.methode === 'POST' && /\/item_upload\/items\/?$/.test(e.chemin)) return { status: 200, body: { item: { id: 77002 } } };
        if (e.methode === 'POST' && /\/item_upload\/drafts\/?$/.test(e.chemin)) return { status: 200, body: { draft: { id: 88002 } } };
        if (e.methode === 'POST' && /\/drafts\/\d+\/completion$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
        if (e.methode === 'POST' && new RegExp('/items/' + GID + '/delete$').test(e.chemin)) return { status: 200, body: {} };
        if (e.methode === 'GET' && /\/item_upload\/items\/\d+$/.test(e.chemin)) return { status: 200, body: { item: { id: Number(e.chemin.split('/').pop()) } } };
        return { status: 404, body: {} };
      } });
    let r = {}; try { r = await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: GID, prix: 110, titre: 'Jordan 3 Fear', viaBrouillon: true, confirme: true }); } catch (e) { r = { erreur: String(e.message) }; }
    dit(r.code !== 'fiche-lecture' && r.etape === 'fait', `identifiant d'annonce > 2 147 483 647 : la fiche se lit et la republication aboutit`, JSON.stringify({ code: r.code, etape: r.etape, raison: r.raison })); }

  // N — « à la suite, comme Vintex » (29 oct., 5.279) : la mise en ligne est
  //     PLANIFIÉE (1 à 3 min après le brouillon) et ne bloque plus la file Vinted ;
  //     l'extension la fait à son heure et rend le résultat (`maj · repub · fin`).
  { const { f, r } = await run({ differer: true });
    dit(r.etape === 'attente' && seqV(f.j) === 'LPPBS' && Number(r.jusqua) - Date.now() > 55000, "à la suite : brouillon et suppression faits, la mise en ligne est planifiée 1 à 3 min plus tard (rien n'attend dans la file)", `etape=${r.etape} seq=${seqV(f.j)} dans=${Math.round((Number(r.jusqua) - Date.now()) / 1000)}s`);
    const att = (f.store.vrmRepubAttente || {})['9101'];
    dit(att && att.draftId === '88001' && typeof att.corpsCV === 'string', "la mise en ligne à faire est rangée dans chrome.storage.local (survit à l'endormissement du service worker)", JSON.stringify(att && { d: att.draftId, du: att.du }));
    let libre = false; try { libre = (await Promise.race([f.ctx.avecVinted(async () => 'ok'), new Promise((ok) => setTimeout(() => ok('bloquee'), 200))])) === 'ok'; } catch (_) {}
    dit(libre, "pendant l'attente, la file Vinted est LIBRE : la paire suivante peut passer");
    if (att) { f.store.vrmRepubAttente['9101'].du = 0; }
    try { await f.ctx.miseEnLigneTick(); } catch (_) {}
    const fin = f.j.evts.find((e) => e && e.quoi === 'repub' && e.id === '9101' && e.etape === 'fin');
    dit(seqV(f.j) === 'LPPBSLM' && fin && fin.fin && fin.fin.etape === 'fait' && fin.fin.nouvelId === '88001', "à l'heure : lecture du brouillon, mise en ligne, et le résultat part à l'app", `seq=${seqV(f.j)} fin=${JSON.stringify(fin && fin.fin)}`);
    dit(!Object.keys(f.store.vrmRepubAttente || {}).length && f.store.vrmRepubFins && f.store.vrmRepubFins['9101'], "faite une seule fois : retirée de l'attente, résultat gardé 24 h");
    const n0 = gestes(f.j).length; try { await f.ctx.miseEnLigneTick(); } catch (_) {}
    dit(gestes(f.j).length === n0, "un second réveil ne remet rien en ligne (jamais deux mises en ligne du même brouillon)"); }
  { const { f, r } = await run({ differer: true, completion: 400 });
    if (f.store.vrmRepubAttente && f.store.vrmRepubAttente['9101']) f.store.vrmRepubAttente['9101'].du = 0;
    try { await f.ctx.miseEnLigneTick(); } catch (_) {}
    const fin = f.j.evts.find((e) => e && e.quoi === 'repub' && e.id === '9101' && e.etape === 'fin');
    dit(r.etape === 'attente' && fin && fin.fin && fin.fin.refaire === true && de(f.j, /completion$/).length === 1, "mise en ligne planifiée refusée : un seul envoi, le brouillon reste « à mettre en ligne » et l'app le sait", JSON.stringify(fin && fin.fin && { e: fin.fin.etape, r: fin.fin.refaire })); }
  { const { f, r } = await run({ differer: true, versBrouillon: true });
    dit(r.etape === 'fait' && r.brouillon === true && !Object.keys(f.store.vrmRepubAttente || {}).length, "En ligne → brouillon : rien n'est planifié (aucune mise en ligne)", `etape=${r.etape}`); }

  // L — côté app : une annonce et SA recréation au même N° (la suppression de
  //     l'ancienne a échoué) ne déclenchent AUCUNE renumérotation automatique
  //     (le carton porte ce N°) ; deux paires sans lien, si.
  { const fs = require('fs'), path = require('path'), vm = require('vm');
    const APP = fs.readFileSync(process.env.APP_SRC || path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');
    const iC = APP.indexOf('const cleNum = (v) => {'); const cle = iC < 0 ? '' : APP.slice(iC, APP.indexOf('\n};', iC) + 3);
    const iD = APP.indexOf('function doublonsAReattribuer('); const dbl = iD < 0 ? '' : APP.slice(iD, APP.indexOf('\n}\n', iD) + 2);
    const ctx = {}; try { vm.runInNewContext(cle + '\n' + dbl + '\nthis.f = doublonsAReattribuer;', ctx); } catch (e) { ctx.err = e.message; }
    const conf = [{ numero: '41', porteurs: [{ type: 'annonce', id: '9101' }, { type: 'annonce', id: '77001' }] }];
    const lie = ctx.f ? ctx.f(conf, { '9101': { numero: '41', numberedAt: '2026-10-01' }, '77001': { numero: '41', numberedAt: '2026-10-01', recreeDe: '9101' } }) : null;
    const sans = ctx.f ? ctx.f(conf, { '9101': { numero: '41', numberedAt: '2026-10-01' }, '77001': { numero: '41', numberedAt: '2026-10-02' } }) : null;
    dit(Array.isArray(lie) && lie.length === 0 && Array.isArray(sans) && sans.length === 1, "N° : une annonce et SA recréation ne sont jamais renumérotées ; deux paires sans lien le sont toujours", JSON.stringify({ lie, sans, err: ctx.err })); }

  console.log(ko ? `\n❌ audit-recreer : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-recreer : ${ok} contrôles — republier par brouillon : enregistrée, supprimée, brouillon, mise en ligne ; création directe : l'ancienne supprimée après la nouvelle`);
  process.exit(ko ? 1 : 0);
})();
