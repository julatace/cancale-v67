// ════════════════════════════════════════════════════════════════════════════
//  FIABILITÉ DE L'EXTENSION — trois défauts MESURÉS chez Julien le 19 octobre
//  (`panel_diag_capture`, lecture seule, extension 5.188) et reproduits ici en
//  EXÉCUTANT le vrai `background.js` (`_fond-vm.cjs`).
//
//  1. ÉCRIRE SANS SESSION SUR UNE BASE CLOISONNÉE.
//     `ecriture_ratee_vinted_accounts_400` ×82, `ecriture_ratee_harvest_*_400`
//     (txn 7, conv 11, inbox 9, seen_urls 11, profile 3…). Session VRM morte ou
//     en pause : `withOwner` n'ajoute pas `owner`, `sbHeaders` met la clé
//     publique et la cible d'upsert retombe sur `id` / `vinted_user_id` — qu'aucun
//     index unique ne porte une fois la base cloisonnée ⇒ 400 garanti, la
//     capture perdue, une requête pour rien. Et la session était relue PAR
//     LIGNE puis pour l'en-tête : une session qui change en route envoyait
//     `owner` d'un vendeur sous le jeton d'un autre (ou sous la clé publique).
//     ⇒ La session est lue UNE fois par envoi ; cloisonné sans session ⇒ rien
//     ne part, et le diagnostic dit `…_sans_session` (la cause, pas « 400 »).
//
//  2. UNE RÉPONSE D'ERREUR DE VINTED PRISE POUR UNE CONVERSATION.
//     `forme_inconnue_champ_conversation` ×246 avec `cles=[code,message,
//     message_code]` : le corps d'un refus de Vinted (code ≠ 0) jugé comme une
//     conversation dont `messages` aurait été renommé ⇒ FAUSSE ALERTE « Format
//     d'un site » dans Réglages, et `conversation_lecture_ou_forme_ratee` ×206.
//     ⇒ Un corps d'erreur Vinted n'est pas une capture : ignoré, compté
//     (`ignore_erreur_vinted_<type>`). Une VRAIE conversation sans `messages`
//     alerte toujours (l'autre sens).
//
//  3. LA CAPTURE PHOTO EFFAÇAIT CE QUI ÉTAIT ÉCRIT PENDANT SA BOUCLE.
//     `capterPhotosAnnonces` lit `vinted_item_details` au début, fait jusqu'à N
//     lectures Vinted (plusieurs secondes), puis réécrit la ligne ENTIÈRE depuis
//     sa copie : une fiche rangée entre-temps (`saveItemDetail`, la page
//     d'annonce ouverte, le clic « Publier ») était EFFACÉE. Et deux
//     `saveItemDetail` simultanés se marchaient dessus de la même façon.
//     ⇒ Toutes les écritures de cette ligne passent par une seule chaîne, et la
//     capture photo relit la ligne au moment d'écrire et ne pose que SES fiches.
//     22 oct. : ses fiches passent par une FILE dans `chrome.storage.local`
//     (une écriture pour 5 pages) ; une relecture ratée au moment d'écrire ne
//     fait plus relire Vinted : la fiche attend, et part quand la base revient.
//
//  `--src chemin` : lancer sur une autre copie (code d'avant, §6.1).
// ════════════════════════════════════════════════════════════════════════════
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const SRC = cheminSource();

// `--prouve` : chaque correctif réaffaibli seul doit faire rougir l'audit.
const MUTATIONS = {
  'sans-session': ["if (cl === true && !(s && s.access_token && s.user_id)) return 'sans_session';", ''],
  'erreur-vinted': ['function estErreurVinted(p) {', 'function estErreurVinted(p) { return false;'],
  'sans-chaine': ['function saveItemDetail(id, detail) { return unItemDetailsALaFois(() => saveItemDetailMaintenant(id, detail)); }', 'function saveItemDetail(id, detail) { return saveItemDetailMaintenant(id, detail); }'],
  'frein-photo': ['if (!rep.ok && memoApresEchec(memo, k, rep, PHOTOS_RETRY_MS)) break; ', ''],
  'sans-relecture': ['const cur = (rr[0] && rr[0].data) || {};\n        for (const kk of lues) cur[kk] = dej[kk];', 'const cur = dej;'],
};
if (process.argv.includes('--prouve')) {
  const brut = fs.readFileSync(SRC, 'utf8'); let tous = true;
  for (const [nom, [a, b]] of Object.entries(MUTATIONS)) {
    if (!brut.includes(a)) { console.log(`❌ mutation ${nom} : motif introuvable`); tous = false; continue; }
    const f = path.join(os.tmpdir(), `bg-mut-${nom}-${process.pid}.js`);
    fs.writeFileSync(f, brut.replace(a, b));
    const r = spawnSync(process.execPath, [__filename, '--src', f], { encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌/gm) || []).length;
    console.log(`${r.status && rouges ? '✅' : '❌'} mutation ${nom} : ${rouges} rouge(s)`);
    if (!(r.status && rouges)) tous = false;
    fs.unlinkSync(f);
  }
  process.exit(tous ? 0 : 1);
}

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}${det ? ' — ' + det : ''}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

// Enveloppe `fetch` pour voir les ÉCRITURES avec leur en-tête et leur cible.
function espionPosts(f) {
  const vrai = f.ctx.fetch, posts = [];
  f.ctx.fetch = async (url, opts = {}) => {
    if ((opts.method || 'GET') === 'POST' && /\/rest\/v1\//.test(String(url))) {
      let rows = []; try { rows = JSON.parse(opts.body || '[]'); } catch (_) {}
      posts.push({ url: String(url), auth: String((opts.headers || {}).Authorization || ''), rows });
    }
    return vrai(url, opts);
  };
  return posts;
}

(async () => {
  console.log('— 1. Écrire sans session sur une base cloisonnée —');
  await essaie('§1', async () => {
    // a) cloisonnée, pas de session ⇒ rien ne part.
    const f = faireFond({ src: SRC });
    f.ctx.isCloisonne = async () => true;
    f.ctx.authToken = async () => null;
    const posts = espionPosts(f);
    const r1 = await f.ctx.supabaseUpsert('app_data', [{ id: 'harvest_111_profile', data: { x: 1 } }], 'id');
    const r2 = await f.ctx.supabaseUpsert('vinted_accounts', [{ vinted_user_id: '111', login: 'a' }], 'vinted_user_id');
    dit(r1 === false && r2 === false, 'sans session : l\'écriture rend « pas écrit »', `r=${r1},${r2}`);
    dit(posts.length === 0, 'sans session : aucune requête vers la base (elle serait refusée en 400)', `${posts.length} POST : ${posts.map((p) => p.url.replace(/^.*rest\/v1\//, '')).join(' | ')}`);
    dit(f.j.diags.some((d) => /^ecriture_ratee_harvest_profile_sans_session$/.test(d)) && f.j.diags.some((d) => /^ecriture_ratee_vinted_accounts_sans_session$/.test(d)),
      'le diagnostic dit la CAUSE (`…_sans_session`), pas un code HTTP', f.j.diags.filter((d) => /^ecriture_ratee/.test(d)).join(','));

    // b) l'autre sens : avec une session, l'écriture part, avec owner, son jeton, la bonne cible.
    const g = faireFond({ src: SRC });
    g.ctx.isCloisonne = async () => true;
    g.ctx.authToken = async () => ({ user_id: 'owner-banc', access_token: 'jeton_A', user_id: 'vendeur_A', expires_at: Date.now() + 3600e3 });
    const pg = espionPosts(g);
    const r3 = await g.ctx.supabaseUpsert('app_data', [{ id: 'harvest_111_profile', data: { x: 1 } }, { id: 'harvest_111_inbox', data: {} }], 'id');
    const p = pg[0] || { rows: [], url: '', auth: '' };
    dit(r3 === true && pg.length === 1, 'avec session : une écriture part', `r=${r3}, ${pg.length} POST`);
    dit(p.rows.length === 2 && p.rows.every((x) => x.owner === 'vendeur_A') && /on_conflict=owner,id/.test(p.url) && p.auth === 'Bearer jeton_A',
      'avec session : owner sur chaque ligne, cible (owner,id), jeton du vendeur', `${p.url.replace(/^.*\?/, '')} · ${p.auth} · owners=${p.rows.map((x) => x.owner).join(',')}`);

    // c) la session lue UNE fois : un renouvellement en route ne mélange pas deux identités.
    const h = faireFond({ src: SRC });
    h.ctx.isCloisonne = async () => true;
    let n = 0;
    h.ctx.authToken = async () => (++n % 2 ? { access_token: 'jeton_A', user_id: 'vendeur_A', expires_at: Date.now() + 3600e3 } : null);
    const ph = espionPosts(h);
    await h.ctx.supabaseUpsert('app_data', [{ id: 'harvest_111_profile', data: {} }, { id: 'harvest_111_inbox', data: {} }], 'id');
    const melange = ph.some((q) => {
      const owners = new Set(q.rows.map((x) => x.owner || '∅'));
      const cible = /on_conflict=owner,id/.test(q.url), jeton = q.auth === 'Bearer jeton_A';
      return owners.size > 1 || (owners.has('vendeur_A') && !(cible && jeton)) || (owners.has('∅'));
    });
    dit(!melange, 'session qui change en route : jamais owner d\'un côté et clé publique / autre cible de l\'autre',
      ph.map((q) => `${q.url.replace(/^.*\?/, '')} ${q.auth.slice(0, 16)} [${q.rows.map((x) => x.owner || '∅')}]`).join(' | ') || 'aucun POST');

    // d) Même sans schéma de séparation, aucune écriture anonyme.
    const k = faireFond({ src: SRC });
    k.ctx.isCloisonne = async () => false;
    k.ctx.authToken = async () => null;
    const pk = espionPosts(k);
    const r4 = await k.ctx.supabaseUpsert('app_data', [{ id: 'harvest_111_profile', data: {} }], 'id');
    dit(r4 === false && pk.length === 0, 'base non cloisonnée : sans session, aucune écriture', `${pk.length} POST`);
  });

  console.log('— 2. Une réponse d\'erreur de Vinted n\'est pas une conversation —');
  await essaie('§2', async () => {
    const f = faireFond({ src: SRC, connecte: '111' });
    f.ctx.compteNonCapte = async () => false;
    const erreur = JSON.stringify({ code: 100, message: 'Introuvable', message_code: 'not_found' });
    await f.ctx.storeHarvest('www.vinted.fr', 'conversation', '25879858686', erreur);
    await f.ctx.storeHarvestRow('111', 'transaction', { code: 99, message: 'Erreurs trouvées', message_code: 'validation_error' }, 'www.vinted.fr');
    const fausses = f.j.diags.filter((d) => /^forme_inconnue_champ_/.test(d));
    dit(fausses.length === 0 && !f.j.tampon.rates.forme_champ_conversation && !f.j.tampon.rates.forme_champ_transaction,
      'corps d\'erreur Vinted : aucune alerte « format d\'un site »', fausses.join(',') || 'aucune');
    dit(!f.j.diags.includes('conversation_lecture_ou_forme_ratee'), 'corps d\'erreur Vinted : pas compté comme une lecture ratée', f.j.diags.join(','));
    dit(f.j.diags.includes('ignore_erreur_vinted_conversation') && f.j.diags.includes('ignore_erreur_vinted_transaction'), 'le refus de Vinted est compté pour ce qu\'il est', '');
    dit(!Object.keys(f.lignes).some((id) => /_conv_|_txn_|_transaction$/.test(id)), 'aucune ligne rangée pour un corps d\'erreur', Object.keys(f.lignes).join(','));
    // L'autre sens : une vraie conversation dont `messages` a disparu alerte toujours.
    const g = faireFond({ src: SRC, connecte: '111' });
    g.ctx.compteNonCapte = async () => false;
    await g.ctx.storeHarvest('www.vinted.fr', 'conversation', '42', JSON.stringify({ conversation: { id: 42, opposite_user: { id: 1 }, transaction: { id: 2 }, msgs: [] } }));
    dit(g.j.diags.includes('forme_inconnue_champ_conversation'), 'une vraie conversation sans `messages` alerte toujours (la sentinelle reste)', '');
  });

  console.log('— 3. La capture photo n\'efface pas ce qui est écrit pendant sa boucle —');
  await essaie('§3', async () => {
    const UID = '111';
    const nouvellesLignes = () => ({
      [`harvest_${UID}_listings`]: { payload: { items: [{ id: 501, nPhotos: 4 }, { id: 502, nPhotos: 4 }] } },
      vinted_item_details: { ANCIENNE: { description: 'déjà là', photos: ['p0'], codes: { catalog_id: 1 } } },
    });
    const f = faireFond({ src: SRC, connecte: UID, lignes: nouvellesLignes() });
    f.ctx.lireSupprimeesTous = async () => new Map();
    f.ctx.gardeLecture = async () => null;
    f.ctx.extraireDetailPage = (txt, id) => ({ photos: [`a${id}`, `b${id}`, `c${id}`, `d${id}`], description: 'd' + id, codes: { catalog_id: 9 }, photoIds: [], couleur: '' });
    let concurrent = null;
    f.ctx.vintedGetHtml = async (acc, chemin) => {
      // Pendant la PREMIÈRE lecture, la page d'une autre annonce est ouverte :
      // `saveItemDetail` range sa fiche (sans être attendu ici — il vit sa vie).
      if (!concurrent) concurrent = f.ctx.saveItemDetail('PAGE', { description: 'ouverte pendant la capture', photos: ['x1', 'x2'] });
      await new Promise((r) => setTimeout(r, 2));
      return { ok: true, status: 200, text: '<html></html>' };
    };
    const n = await f.ctx.capterPhotosAnnonces(UID, 2);   // deux pages dans ce tour (22 oct. : le fond n'en lit qu'une)
    if (concurrent) await concurrent;
    const det = f.lignes.vinted_item_details || {};
    dit(n === 2 && det['501'] && det['502'], 'la capture photo range ses deux fiches', `n=${n}, clés=${Object.keys(det).join(',')}`);
    dit(!!det.PAGE, 'la fiche rangée PENDANT la capture survit à son écriture', `clés=${Object.keys(det).join(',')}`);
    dit(!!det.ANCIENNE, 'la fiche d\'avant survit', '');
    dit(!!((f.store.vrmPhotosFaites || {})[`${UID}_501`]), 'écriture réussie : le mémo de 6 h est posé (l\'autre sens du contrôle suivant)', JSON.stringify(f.store.vrmPhotosFaites || {}));

    // Deux `saveItemDetail` simultanés : les deux fiches restent.
    const g = faireFond({ src: SRC, connecte: UID, lignes: { vinted_item_details: {} } });
    await Promise.all([g.ctx.saveItemDetail('A', { description: 'a', photos: ['1'] }), g.ctx.saveItemDetail('B', { description: 'b', photos: ['2'] })]);
    const d2 = g.lignes.vinted_item_details || {};
    dit(!!d2.A && !!d2.B, 'deux fiches rangées en même temps : les deux restent', `clés=${Object.keys(d2).join(',')}`);

    // Lecture ratée au moment d'écrire ⇒ on n'écrit pas, et les annonces seront relues.
    const h = faireFond({ src: SRC, connecte: UID, lignes: nouvellesLignes() });
    h.ctx.lireSupprimeesTous = async () => new Map();
    h.ctx.gardeLecture = async () => null;
    h.ctx.extraireDetailPage = f.ctx.extraireDetailPage;
    let lectures = 0;
    const vraiSbGet = h.ctx.sbGet;
    h.ctx.vintedGetHtml = async () => ({ ok: true, status: 200, text: '<html></html>' });
    h.ctx.sbGet = async (q) => { if (/vinted_item_details/.test(q) && ++lectures > 1) return null; return vraiSbGet(q); };
    await h.ctx.capterPhotosAnnonces(UID, 2);
    const d3 = h.lignes.vinted_item_details || {};
    dit(!!d3.ANCIENNE && !d3['501'], 'relecture ratée au moment d\'écrire : la ligne n\'est pas réécrite', `clés=${Object.keys(d3).join(',')}`);
    // 22 oct. : la fiche lue n'est pas perdue — elle attend dans chrome.storage.local
    // (avant : son mémo était retiré, et Vinted était relu pour la retrouver).
    const attente = (h.store.vrmFichesAttente || []).map((e) => e.id).sort().join(',');
    dit(attente === '501,502', 'relecture ratée : les fiches lues attendent dans chrome.storage.local (pas de nouvelle requête Vinted)', attente);
    h.ctx.sbGet = vraiSbGet;
    await h.ctx.viderFiches({ force: true });
    const d4 = h.lignes.vinted_item_details || {};
    dit(!!d4['501'] && !!d4['502'] && !!d4.ANCIENNE && !(h.store.vrmFichesAttente || []).length, 'la base revenue : elles sont rangées, et la fiche d\'avant reste', `clés=${Object.keys(d4).join(',')}`);
  });

  console.log('— 4. Un frein de Vinted ne pose pas le mémo de 6 h d\'une photo —');
  await essaie('§4', async () => {
    const UID = '111';
    const f = faireFond({ src: SRC, connecte: UID, lignes: {
      [`harvest_${UID}_listings`]: { payload: { items: [{ id: 601, nPhotos: 4 }, { id: 602, nPhotos: 4 }] } },
      vinted_item_details: {} } });
    f.ctx.lireSupprimeesTous = async () => new Map();
    f.ctx.gardeLecture = async () => null;
    let appels = 0;
    f.ctx.vintedGetHtml = async () => { appels++; return { ok: false, status: 429, text: '' }; };
    await f.ctx.capterPhotosAnnonces(UID);
    const memo = f.store.vrmPhotosFaites || {};
    dit(!memo[`${UID}_601`], '429 : l\'annonce sera relue après la pause, pas dans 6 h', JSON.stringify(memo));
    dit(appels === 1, '429 : la boucle s\'arrête (aucune autre requête après le frein)', `${appels} requête(s)`);
    // L'autre sens : un 404 (annonce disparue) garde son mémo.
    const g = faireFond({ src: SRC, connecte: UID, lignes: {
      [`harvest_${UID}_listings`]: { payload: { items: [{ id: 601, nPhotos: 4 }] } }, vinted_item_details: {} } });
    g.ctx.lireSupprimeesTous = async () => new Map();
    g.ctx.gardeLecture = async () => null;
    g.ctx.vintedGetHtml = async () => ({ ok: false, status: 404, text: '' });
    await g.ctx.capterPhotosAnnonces(UID);
    dit(!!((g.store.vrmPhotosFaites || {})[`${UID}_601`]), '404 : le mémo reste (pas de relecture immédiate d\'une annonce disparue)', '');
  });

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
