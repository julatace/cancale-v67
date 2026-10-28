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
const PHOTOS = ['https://images1.vinted.net/t/a/f800/1.jpeg', 'https://images1.vinted.net/t/a/f800/2.jpeg'];
const PHOTOS_D = ['https://images1.vinted.net/t/b/f800/1.jpeg', 'https://images1.vinted.net/t/b/f800/2.jpeg'];

function monter({ connecte = '111', comptes = null, coffre = true, modele = true, codes = null, photo = 200, photoSansId = false, creation = 200, creationSansId = false, suppression = 200, src, cdn = null, descDetails = null, lettreCoffre = null, brouillon = 200, brouillonSansId = false, completion = 200, extra = null, coffreEcritureKO = false, retardLecture = null, lecture = null } = {}) {
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
      if (e.methode === 'GET' && /\/api\/v2\/item_upload\/items\/9101$/.test(e.chemin) && lecture) return lecture;
      if (e.methode === 'POST' && /\/api\/v2\/photos$/.test(e.chemin)) return { status: photo, body: photoSansId ? { ok: true } : { id: ++n } };
      if (e.methode === 'POST' && /\/api\/v2\/item_upload\/items\/?$/.test(e.chemin)) return { status: creation, body: creationSansId ? { code: 0 } : { item: { id: 77001 } } };
      if (e.methode === 'POST' && /\/api\/v2\/item_upload\/drafts\/?$/.test(e.chemin)) return { status: typeof brouillon === 'function' ? brouillon() : brouillon, body: brouillonSansId ? { code: 0 } : { draft: { id: 88001 } } };
      if (e.methode === 'POST' && /\/api\/v2\/item_upload\/drafts\/\d+\/completion$/.test(e.chemin)) return { status: typeof completion === 'function' ? completion() : completion, body: { code: 0 } };
      if (e.methode === 'POST' && /\/api\/v2\/items\/9101\/delete$/.test(e.chemin)) return { status: suppression, body: {} };
      return { status: 404, body: {} };
    } });
}
const de = (j, re, m = 'POST') => j.vinted.filter((v) => v.methode === m && re.test(v.chemin));
const photosP = (j) => de(j, /\/api\/v2\/photos$/);
const creations = (j) => de(j, /\/item_upload\/items\/?$/);
const suppressions = (j) => de(j, /\/items\/\d+\/delete$/);
async function run(opts = {}) {
  const f = monter({ src: process.env.BG_SRC || undefined, ...opts });
  if (typeof f.ctx.recreerVinted !== 'function') return { f, r: {}, absent: true };
  let r = {}; try { r = await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: opts.prix != null ? opts.prix : 54, titre: opts.titre || 'Nike Air Max 1 — remise en ligne', plancher: opts.plancher, reglages: opts.reglages, lettre: opts.lettre, viaBrouillon: opts.viaBrouillon, versBrouillon: opts.versBrouillon, confirme: opts.confirme !== false }); } catch (e) { r = { erreur: String(e.message) }; }
  return { f, r };
}
const zero = (j) => j.vinted.length === 0;

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
    const seq = f.j.vinted.map((v) => /photos$/.test(v.chemin) ? 'P' : /item_upload/.test(v.chemin) ? 'C' : /delete$/.test(v.chemin) ? 'S' : '?').join('');
    dit(seq === 'PPCS' && r.etape === 'fait' && r.nouvelId === '77001', "tout prêt : photos ×2, PUIS création, PUIS suppression de l'ancienne", `seq=${seq} etape=${r.etape} code=${r.code || ''} ${r.raison || ''}`);
    let corps = {}; try { corps = JSON.parse(creations(f.j)[0].corps); } catch (_) {}
    const it = corps.item || {};
    dit(it.id === null && it.title === 'Nike Air Max 1 — remise en ligne' && it.price === '54', "la nouvelle annonce porte le titre et le prix choisis (id null : c'est une création)", JSON.stringify({ id: it.id, title: it.title, price: it.price }));
    dit(it.catalog_id === 1234 && it.package_size_id === 1 && JSON.stringify(it.item_attributes) === JSON.stringify([{ code: 'size', ids: [56] }, { code: 'condition', ids: [2] }]), "la recette est celle de CETTE annonce (catégorie, taille/état, colis)", JSON.stringify(it.item_attributes));
    dit(Array.isArray(it.assigned_photos) && it.assigned_photos.map((p) => p.id).join(',') === '501,502' && it.assigned_photos.every((p) => p.orientation === 0), "les photos sont les NOUVELLES (identifiants rendus par Vinted), dans l'ordre", JSON.stringify(it.assigned_photos));
    dit(typeof it.temp_uuid === 'string' && it.temp_uuid.length === 36 && corps.upload_session_id === it.temp_uuid && corps.push_up === false && corps.parcel === null, "forme mesurée : upload_session_id = temp_uuid, push_up false, parcel null", JSON.stringify({ u: corps.upload_session_id, t: it.temp_uuid, p: corps.push_up }));
    const fd = photosP(f.j)[0] && photosP(f.j)[0].corps;
    dit(fd && typeof fd.get === 'function' && fd.get('photo[type]') === 'item' && fd.get('photo[temp_uuid]') === it.temp_uuid && fd.get('photo[file]'), "chaque photo part en FormData photo[type]=item, photo[file], photo[temp_uuid] de l'annonce", fd && typeof fd.get === 'function' ? fd.get('photo[type]') : typeof fd);
    dit(f.lignes.vrm_vinted_modele && f.lignes.vrm_vinted_modele['77001'], "la recette de la NOUVELLE annonce est gardée (la prochaine recréation n'a rien à réapprendre)");
    dit(f.lignes['coffre_111_77001'] && f.lignes['coffre_111_77001'].recreeDe === '9101', "la nouvelle annonce a sa sauvegarde coffre (filet)"); }

  // B — une photo refusée : rien n'est créé, rien n'est supprimé.
  { const { f, r } = await run({ photo: 422 });
    dit(creations(f.j).length === 0 && suppressions(f.j).length === 0 && r.etape === 'echec', "photo refusée : AUCUNE création, AUCUNE suppression (l'annonce reste intacte)", `c=${creations(f.j).length} s=${suppressions(f.j).length} ${r.raison || ''}`); }
  // B2 — une photo acceptée mais sans identifiant lisible : pareil.
  { const { f } = await run({ photoSansId: true });
    dit(creations(f.j).length === 0 && suppressions(f.j).length === 0, "photo sans identifiant lisible : rien n'est créé ni supprimé", `c=${creations(f.j).length}`); }
  // C — création refusée : l'ancienne n'est JAMAIS supprimée.
  { const { f, r } = await run({ creation: 422 });
    dit(suppressions(f.j).length === 0 && r.etape === 'echec' && /intacte/.test(r.raison || ''), "création refusée : l'ancienne n'est JAMAIS supprimée, et c'est dit", `s=${suppressions(f.j).length} ${r.raison || ''}`); }
  // D — création « réussie » sans identifiant : on ne supprime rien, « incertain ».
  { const { f, r } = await run({ creationSansId: true });
    dit(suppressions(f.j).length === 0 && r.etape === 'incertain', "création sans identifiant lisible : RIEN n'est supprimé, « à vérifier »", `s=${suppressions(f.j).length} etape=${r.etape}`); }
  // E — suppression refusée : « double », jamais « fait ».
  { const { r } = await run({ suppression: 403 });
    dit(r.etape === 'double' && r.nouvelId === '77001' && /DEUX fois/.test(r.raison || ''), "suppression refusée : « en vente deux fois » dit en toutes lettres, jamais « fait »", `etape=${r.etape} ${r.raison || ''}`); }
  // E2 — suppression sans réponse claire (5xx, coupure) : « peut-être encore en ligne », jamais « refusé ».
  { const { r } = await run({ suppression: 500 });
    dit(r.etape === 'double' && /PEUT-ÊTRE/.test(r.raison || '') && !/refusé/.test(r.raison || ''), "suppression sans réponse claire : « peut-être encore en ligne », jamais « refusé »", `etape=${r.etape} ${r.raison || ''}`); }
  // J — création sans réponse claire (5xx) : « incertain », rien supprimé, et une
  //     seconde tentative sur la MÊME annonce est refusée sans aucune requête.
  { const f = monter({ src: process.env.BG_SRC || undefined, creation: 502 });
    const appel = () => f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike Air Max 1', confirme: true });
    const r1 = await appel(); const n1 = f.j.vinted.length; const r2 = await appel();
    dit(r1.etape === 'incertain' && suppressions(f.j).length === 0 && /PEUT-ÊTRE/.test(r1.raison || ''), "création sans réponse claire (5xx) : « peut-être créée », l'ancienne n'est PAS supprimée", `etape=${r1.etape} ${r1.raison || ''}`);
    dit(r2.accepte === false && r2.code === 'recreer-incertaine' && f.j.vinted.length === n1, "une seconde tentative juste après est REFUSÉE sans rien envoyer (pas de seconde copie)", `code=${r2.code} requêtes=${f.j.vinted.length - n1}`); }
  // J2 — une création REFUSÉE (4xx) ne bloque pas la tentative suivante.
  { const f = monter({ src: process.env.BG_SRC || undefined, creation: 422 });
    await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike', confirme: true });
    const r2 = await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike', confirme: true });
    dit(r2.code !== 'recreer-incertaine', "une création refusée nette ne bloque pas la suivante", `code=${r2.code || r2.etape}`); }
  // K — un lien de photo périmé : l'autre copie (fiche) prend le relais.
  { const { f, r } = await run({ cdn: (u) => /\/t\/b\//.test(u) ? { status: 200 } : { status: 404 } });
    dit(r.etape === 'fait' && photosP(f.j).length === 2, "un lien de photo périmé : l'autre copie de la même photo est prise", `etape=${r.etape} ${r.raison || ''}`); }
  // F — refus avant tout : 0 requête chez Vinted.
  { const { f, r } = await run({ confirme: false });
    dit(zero(f.j) && r.code === 'confirmation', "sans confirmation : aucune requête chez Vinted", `n=${f.j.vinted.length} code=${r.code}`); }
  { const { f, r } = await run({ connecte: '999', comptes: [{ vinted_user_id: '111', login: 'c', domain: 'www.vinted.fr', access_token: 'j' }] });
    dit(zero(f.j) && /autre/.test(r.code || ''), "autre compte Vinted dans Chrome : aucune requête (§3)", `n=${f.j.vinted.length} code=${r.code}`); }
  { const { f, r } = await run({ coffre: false });
    dit(zero(f.j) && r.code === 'coffre-absent', "aucune photo sauvegardée : aucune requête", `n=${f.j.vinted.length} code=${r.code}`); }
  { const { f, r } = await run({ modele: false });
    const lus = de(f.j, /\/api\/v2\/item_upload\/items\/9101$/, 'GET');
    dit(f.j.vinted.length === 1 && lus.length === 1 && r.code === 'recette-absente', "recette inconnue, Vinted refuse de la donner : UNE lecture, rien d'autre, et c'est dit", `n=${f.j.vinted.length} code=${r.code} raison=${r.raison}`); }
  // G3 — (28 oct., vu chez Julien) sans modèle ni codes : la recette est LUE chez
  //      Vinted (comme sa page « Modifier ») et la republication aboutit, sans geste.
  { const { f, r } = await run({ modele: false, lecture: { status: 200, body: { item: { id: 9101, description: 'Nickel, boîte d’origine', catalog_id: 88, brand_id: 9, brand: 'Dr. Martens', color_ids: [1], item_attributes: [{ code: 'size', ids: [55] }, { code: 'status', ids: [2] }], package_size_id: 2 } } } });
    let it = {}; try { it = JSON.parse(creations(f.j)[0].corps).item; } catch (_) {}
    const codes = ((f.lignes.vinted_item_details || {})['9101'] || {}).codes || {};
    dit(r.etape === 'fait' && it.catalog_id === 88 && it.package_size_id === 2 && codes.catalog_id === 88, "sans modèle ni codes : la recette est lue chez Vinted, gardée, et la republication aboutit", JSON.stringify({ e: r.etape, code: r.code, raison: r.raison, c: it.catalog_id, rangee: codes.catalog_id })); }
  { const { f, r } = await run({ modele: false, lecture: { status: 200, body: { item: { id: 9101, title: 'x', size_id: 3 } } } });
    dit(creations(f.j).length === 0 && suppressions(f.j).length === 0 && r.code === 'recette-absente', "réponse sans la recette sous une forme connue : rien n'est créé ni supprimé (jamais deviné)", JSON.stringify({ code: r.code })); }
  // G — sans modèle, avec les codes rangés de sa fiche : la recette vient d'eux.
  { const { f, r } = await run({ modele: false, codes: { catalog_id: 77, brand_id: 9, brand: 'Nike', color_ids: [3], item_attributes: [{ code: 'size', ids: [60] }], package_size_id: 2 } });
    let it = {}; try { it = JSON.parse(creations(f.j)[0].corps).item; } catch (_) {}
    dit(r.etape === 'fait' && it.catalog_id === 77 && it.package_size_id === 2 && it.description === 'Nickel, boîte d’origine', "sans modèle : la recette vient des codes de SA fiche, la description du coffre", JSON.stringify({ e: r.etape, c: it.catalog_id, d: it.description })); }
  // J — (28 oct.) la description part MOT POUR MOT ; la lettre en option va
  //     tout en bas, et la lettre d'une recréation précédente est retirée d'abord.
  { const longue = 'Paire portée 2 fois.\n\n- Boîte d’origine\n- Envoi rapide 📦  #nike';
    const { f, r } = await run({ descDetails: longue });
    let it = {}; try { it = JSON.parse(creations(f.j)[0].corps).item; } catch (_) {}
    dit(r.etape === 'fait' && it.description === longue, "sans lettre : la description part EXACTEMENT telle quelle (lignes, tirets, emoji)", JSON.stringify(it.description)); }
  { const { f, r } = await run({ descDetails: 'Nickel.\n\nx', lettreCoffre: 'x', lettre: 'q' });
    let it = {}; try { it = JSON.parse(creations(f.j)[0].corps).item; } catch (_) {}
    dit(r.etape === 'fait' && it.description === 'Nickel.\n\nq', "avec la lettre : « q » tout en bas, l'ancienne lettre « x » retirée (pas d'empilement)", JSON.stringify(it.description));
    dit(f.lignes['coffre_111_77001'] && f.lignes['coffre_111_77001'].lettreVRM === 'q', "la lettre posée est notée dans la sauvegarde de la nouvelle annonce", JSON.stringify(f.lignes['coffre_111_77001'] && f.lignes['coffre_111_77001'].lettreVRM)); }
  { const { f } = await run({ descDetails: 'Taille x', lettre: 'abc' });
    let it = {}; try { it = JSON.parse(creations(f.j)[0].corps).item; } catch (_) {}
    dit(it.description === 'Taille x', "une « lettre » invalide (plusieurs caractères) n'ajoute rien, et un texte qui finit par x sans lettre notée n'est pas touché", JSON.stringify(it.description)); }
  // H — plancher.
  { const { f } = await run({ prix: 20, plancher: 35 });
    let it = {}; try { it = JSON.parse(creations(f.j)[0].corps).item; } catch (_) {}
    dit(it.price === '35', "jamais sous le prix d'achat : 20 € demandé ⇒ 35 €", it.price); }
  // I — réglages photo que ce navigateur ne sait pas appliquer (le vm n'a pas
  //     OffscreenCanvas) : rien ne part, jamais l'original à la place.
  { const { f, r } = await run({ reglages: { rot: 0, bright: 1.2, contrast: 1, sat: 1, zoom: 1 } });
    dit(photosP(f.j).length === 0 && creations(f.j).length === 0 && suppressions(f.j).length === 0 && r.etape === 'echec', "réglages photo impossibles ici : rien ne part (jamais la photo d'origine en silence)", `p=${photosP(f.j).length} c=${creations(f.j).length} ${r.raison || ''}`); }


  // M — (28 oct.) « ça met en brouillon puis ça publie » : formes MESURÉES.
  const brouillonsP = (j) => de(j, /\/item_upload\/drafts\/?$/);
  const completions = (j) => de(j, /\/item_upload\/drafts\/\d+\/completion$/);
  { const { f, r } = await run({ viaBrouillon: true });
    const seq = f.j.vinted.map((v) => /photos$/.test(v.chemin) ? 'P' : /completion$/.test(v.chemin) ? 'M' : /drafts\/?$/.test(v.chemin) ? 'B' : /item_upload\/items/.test(v.chemin) ? 'C' : /delete$/.test(v.chemin) ? 'S' : '?').join('');
    const cf = f.lignes['coffre_111_9101'];
    dit(seq === 'PPSBM' && r.etape === 'fait' && r.nouvelId === '88001' && cf && cf.versBrouillon && cf.versBrouillon.publier === true, "republier (sa décision, « comme eux ») : photos, enregistrée dans VRM, PUIS suppression, PUIS brouillon, PUIS mise en ligne", `seq=${seq} etape=${r.etape} id=${r.nouvelId} ${r.raison || ''}`);
    let b = {}, c = {}; try { b = JSON.parse(brouillonsP(f.j)[0].corps); c = JSON.parse(completions(f.j)[0].corps); } catch (_) {}
    dit(b.draft && b.draft.id === null && !('push_up' in b) && !('push_up' in b.draft) && b.parcel === null && b.upload_session_id === b.draft.temp_uuid && b.draft.title === 'Nike Air Max 1 — remise en ligne' && b.draft.price === '54', "brouillon : forme mesurée {draft:{id:null,…}, parcel:null, upload_session_id}, sans push_up", JSON.stringify({ id: b.draft && b.draft.id, pu: 'push_up' in b }));
    dit(c.draft && c.draft.id === 88001 && c.push_up === false && c.parcel === null && /\/drafts\/88001\/completion$/.test(completions(f.j)[0].chemin) && c.draft.description === b.draft.description, "mise en ligne : POST …/drafts/88001/completion, même corps, draft.id posé, push_up false", JSON.stringify({ id: c.draft && c.draft.id, pu: c.push_up }));
    dit(f.lignes['vinted_brouillon_88001'] && f.lignes['vinted_brouillon_88001'].etat === 'publie' && f.lignes['vinted_brouillon_88001'].ancienId === '9101', "le brouillon est noté « publié » (avec l'annonce qu'il remplace)", JSON.stringify(f.lignes['vinted_brouillon_88001'] && f.lignes['vinted_brouillon_88001'].etat)); }
  { const { f, r } = await run({ viaBrouillon: true, completion: 422 });
    dit(suppressions(f.j).length === 1 && r.etape === 'brouillon-a-refaire' && /Brouillons → en ligne/.test(r.raison || '') && f.lignes['vinted_brouillon_88001'] && f.lignes['vinted_brouillon_88001'].etat === 'brouillon', "mise en ligne refusée : le brouillon reste rangé, et le geste pour le remettre en ligne est dit", `s=${suppressions(f.j).length} ${r.raison || ''}`); }
  { const { f, r } = await run({ viaBrouillon: true, completion: 502 });
    dit(r.etape === 'incertain' && /PEUT-ÊTRE en ligne/.test(r.raison || ''), "mise en ligne sans réponse claire : « incertain », dit", `s=${suppressions(f.j).length} etape=${r.etape}`); }
  { const { f, r } = await run({ viaBrouillon: true, brouillon: 422 });
    dit(completions(f.j).length === 0 && r.etape === 'brouillon-a-refaire' && /enregistrées dans VRM/.test(r.raison || ''), "brouillon refusé : aucune mise en ligne, tout est dit enregistré dans VRM", `m=${completions(f.j).length} s=${suppressions(f.j).length}`); }
  { const { f, r } = await run({ viaBrouillon: true, brouillonSansId: true });
    dit(completions(f.j).length === 0 && r.etape === 'brouillon-a-refaire', "brouillon sans identifiant lisible : on ne devine rien, aucune mise en ligne", `m=${completions(f.j).length}`); }
  { const { f, r } = await run({ viaBrouillon: true, suppression: 502 });
    dit(brouillonsP(f.j).length === 0 && completions(f.j).length === 0 && r.etape === 'incertain', "republier, suppression sans réponse claire : on s'arrête — jamais deux annonces en ligne", `b=${brouillonsP(f.j).length} m=${completions(f.j).length}`); }
  { const { f, r } = await run({ viaBrouillon: true, suppression: 403 });
    dit(brouillonsP(f.j).length === 0 && r.etape === 'echec' && /toujours en ligne/.test(r.raison || ''), "republier, suppression refusée : rien créé, elle est toujours en ligne", `b=${brouillonsP(f.j).length}`); }
  { const { f, r } = await run({ viaBrouillon: true, coffreEcritureKO: true });
    dit(suppressions(f.j).length === 0 && brouillonsP(f.j).length === 0 && r.etape === 'echec', "republier, enregistrement raté : rien supprimé", `s=${suppressions(f.j).length}`); }
  { const { f } = await run({});
    dit(brouillonsP(f.j).length === 0 && creations(f.j).length === 1, "sans l'option : création directe, comme avant", `b=${brouillonsP(f.j).length}`); }

  // P — (28 oct. au soir, sa décision) « en ligne → brouillon » : l'annonce est
  // ENREGISTRÉE dans VRM, PUIS supprimée, PUIS le brouillon créé — jamais de mise en ligne.
  const seqDe = (j) => j.vinted.map((v) => /photos$/.test(v.chemin) ? 'P' : /completion$/.test(v.chemin) ? 'M' : /drafts\/?$/.test(v.chemin) ? 'B' : /item_upload\/items/.test(v.chemin) ? 'C' : /delete$/.test(v.chemin) ? 'S' : '?').join('');
  { const { f, r } = await run({ versBrouillon: true });
    const seq = seqDe(f.j);
    dit(seq === 'PPSB' && r.etape === 'fait' && r.draftId === '88001' && r.brouillon === true, "en ligne → brouillon : photos, PUIS suppression, PUIS brouillon — aucune mise en ligne", `seq=${seq} etape=${r.etape} ${r.raison || ''}`);
    const c = f.lignes['coffre_111_9101'];
    dit(c && c.versBrouillon && /draft/.test(c.versBrouillon.corps || '') && c.title, "l'annonce est enregistrée dans le coffre (avec le corps du brouillon) avant d'être retirée", JSON.stringify(c && Object.keys(c)));
    dit(f.lignes['vinted_brouillon_88001'] && f.lignes['vinted_brouillon_88001'].etat === 'brouillon' && f.lignes['vinted_brouillon_88001'].ancienId === '9101' && f.lignes['vinted_brouillon_88001'].corps, "le brouillon est rangé « brouillon » avec son corps : il se remet en ligne d'ici", JSON.stringify(f.lignes['vinted_brouillon_88001'] && f.lignes['vinted_brouillon_88001'].etat)); }
  { const { f, r } = await run({ versBrouillon: true, suppression: 403 });
    dit(brouillonsP(f.j).length === 0 && r.etape === 'echec' && /toujours en ligne/.test(r.raison || ''), "en ligne → brouillon, suppression refusée : aucun brouillon, elle est dite toujours en ligne", `b=${brouillonsP(f.j).length} etape=${r.etape}`); }
  { const { f, r } = await run({ versBrouillon: true, suppression: 502 });
    dit(brouillonsP(f.j).length === 1 && r.etape === 'double' && /PEUT-ÊTRE/.test(r.raison || ''), "en ligne → brouillon, suppression sans réponse claire : le brouillon est créé quand même, « peut-être encore en ligne » dit", `b=${brouillonsP(f.j).length} etape=${r.etape}`); }
  { const { f, r } = await run({ versBrouillon: true, brouillon: 422 });
    dit(suppressions(f.j).length === 1 && brouillonsP(f.j).length === 2 && completions(f.j).length === 0 && r.etape === 'brouillon-a-refaire' && /enregistrées dans VRM/.test(r.raison || ''), "en ligne → brouillon, brouillon refusé : retenté une fois, puis dit — tout est enregistré dans VRM", `s=${suppressions(f.j).length} b=${brouillonsP(f.j).length} etape=${r.etape}`); }
  { const { f, r } = await run({ versBrouillon: true, brouillon: 502 });
    dit(brouillonsP(f.j).length === 1 && r.etape === 'brouillon-a-refaire', "en ligne → brouillon, brouillon sans réponse claire : jamais retenté (il existe peut-être)", `b=${brouillonsP(f.j).length}`); }
  { const { f, r } = await run({ versBrouillon: true, brouillonSansId: true });
    dit(r.etape === 'brouillon-a-refaire' && completions(f.j).length === 0, "en ligne → brouillon, brouillon sans identifiant : dit, rien deviné", `etape=${r.etape}`); }
  { const { f, r } = await run({ versBrouillon: true, coffreEcritureKO: true });
    dit(suppressions(f.j).length === 0 && brouillonsP(f.j).length === 0 && r.etape === 'echec', "en ligne → brouillon, enregistrement raté : rien supprimé, rien créé", `s=${suppressions(f.j).length} etape=${r.etape}`); }
  { const { f, r } = await run({ versBrouillon: true, confirme: false });
    dit(zero(f.j) && r.code === 'confirmation', "en ligne → brouillon sans confirmation : aucune requête", `code=${r.code}`); }

  // N — mettre en ligne SON brouillon depuis VRM (`publierBrouillon`).
  const CORPS_B = (o = {}) => JSON.stringify({ draft: { id: null, currency: 'EUR', temp_uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', title: 'Nike Air Max 1 dark teal', description: 'très bon état', brand_id: 53, brand: 'Nike', catalog_id: 1242, price: '65', package_size_id: 1, color_ids: [12], assigned_photos: [{ id: 1, orientation: 0 }], item_attributes: [{ code: 'size', ids: [785] }], ...o }, parcel: null, upload_session_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });
  const dressing = (ids) => ({ harvest_111_listings: { capturedAt: nowISO(), payload: { items: ids.map((x) => ({ id: x, is_draft: true })) } } });
  const pubB = async (opts = {}) => {
    const extra = { ...(opts.dressing === false ? {} : dressing(['10432342904'])), ...(opts.ligne === false ? {} : { vinted_brouillon_10432342904: { id: '10432342904', uid: opts.uid || '111', corps: opts.corps || CORPS_B(), etat: 'brouillon' } }) };
    const f = monter({ src: process.env.BG_SRC || undefined, extra, completion: opts.completion || 200 });
    if (typeof f.ctx.publierBrouillon !== 'function') return { f, r: { absent: true } };
    let r = {}; try { r = await f.ctx.publierBrouillon({ cmd: 'publierBrouillon', uid: '111', draftId: '10432342904', confirme: opts.confirme !== false }); } catch (e) { r = { erreur: e.message }; }
    return { f, r };
  };
  { const { f, r } = await pubB();
    let c = {}; try { c = JSON.parse(completions(f.j)[0].corps); } catch (_) {}
    dit(f.j.vinted.length === 1 && r.etape === 'fait' && c.draft && c.draft.id === 10432342904 && c.push_up === false && c.draft.title === 'Nike Air Max 1 dark teal' && /drafts\/10432342904\/completion$/.test(completions(f.j)[0].chemin), "brouillon complet de son dressing : UNE requête, la mise en ligne, avec SON corps tel quel", `n=${f.j.vinted.length} etape=${r.etape} ${r.raison || r.erreur || ''}`);
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

  // R — (28 oct., sa demande) « Refaire le brouillon » : depuis ce qui est
  //     enregistré dans VRM, sans JAMAIS retoucher l'annonce d'origine ; mise en
  //     ligne seulement si la suppression de l'ancienne est CERTAINE.
  const sansDelai = (p, ms = 60000) => Promise.race([p, new Promise((_, ko) => setTimeout(() => ko(new Error('bloqué (file Vinted ?)')), ms))]);
  const refaire = (f, o = {}) => typeof f.ctx.refaireBrouillon === 'function' ? sansDelai(f.ctx.refaireBrouillon({ cmd: 'refaireBrouillon', uid: '111', id: '9101', confirme: o.confirme !== false })).catch((e) => ({ erreur: e.message })) : Promise.resolve({ absent: true });
  const vb = (f) => (f.lignes['coffre_111_9101'] || {}).versBrouillon || {};
  { let st = 422; const f = monter({ src: process.env.BG_SRC || undefined, brouillon: () => st });
    const r1 = await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike Air Max 1', viaBrouillon: true, confirme: true });
    dit(r1.etape === 'brouillon-a-refaire' && r1.refaire === true && vb(f).etat === 'a-refaire' && vb(f).supprime === true, "republier, brouillon refusé : l'état « à refaire » est noté (ancienne retirée à coup sûr)", JSON.stringify({ e: r1.etape, v: vb(f).etat, s: vb(f).supprime }));
    st = 200; const n0 = f.j.vinted.length;
    const r = await refaire(f); const seq = seqDe({ vinted: f.j.vinted.slice(n0) });
    dit(seq === 'PPBM' && r.etape === 'fait' && vb(f).etat === 'fait', "Refaire : photos ×2 depuis VRM, PUIS brouillon, PUIS mise en ligne — l'ancienne n'est pas retouchée", `seq=${seq} etape=${r.etape} ${r.raison || r.erreur || ''}`);
    let b = {}; try { b = JSON.parse(brouillonsP({ vinted: f.j.vinted.slice(n0) })[0].corps); } catch (_) {}
    dit(b.draft && b.draft.id === null && b.draft.title === 'Nike Air Max 1' && b.draft.price === '54' && b.draft.assigned_photos && b.draft.assigned_photos.length === 2 && b.upload_session_id === b.draft.temp_uuid, "le brouillon refait porte le titre, le prix et les photos NEUVES enregistrés", JSON.stringify(b.draft && { t: b.draft.title, p: b.draft.price }));
    const n1 = f.j.vinted.length; const r2 = await refaire(f);
    dit(r2.code === 'deja' && f.j.vinted.length === n1, "refaire une seconde fois : refusé, aucune requête (jamais deux brouillons)", `code=${r2.code}`); }
  { const f = monter({ src: process.env.BG_SRC || undefined, brouillon: 502 });
    await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike', versBrouillon: true, confirme: true });
    dit(vb(f).etat === 'a-refaire' && vb(f).peutExister === true, "en ligne → brouillon sans réponse claire : « à refaire », et « il existe peut-être » noté", JSON.stringify(vb(f)).slice(0, 120)); }
  { let st = 200; const f = monter({ src: process.env.BG_SRC || undefined, brouillon: () => st }); st = 422;
    await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike', versBrouillon: true, confirme: true });
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
        return { status: 404, body: {} };
      } });
    let r = {}; try { r = await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: GID, prix: 110, titre: 'Jordan 3 Fear', viaBrouillon: true, confirme: true }); } catch (e) { r = { erreur: String(e.message) }; }
    dit(r.code !== 'fiche-lecture' && r.etape === 'fait', `identifiant d'annonce > 2 147 483 647 : la fiche se lit et la republication aboutit`, JSON.stringify({ code: r.code, etape: r.etape, raison: r.raison })); }

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
