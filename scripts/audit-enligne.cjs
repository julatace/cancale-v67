// ════════════════════════════════════════════════════════════════════════════
//  « QUAND LES ANNONCES NE SONT PLUS EN LIGNE, ELLES DOIVENT ÊTRE ENLEVÉES.
//  AUTOMATIQUEMENT. » (Julien, 11 octobre — extension 5.166)
//
//  MESURÉ le 11 octobre (base en lecture seule) : l'écran Annonces montrait 27
//  annonces « en ligne », dont 16 d'une lecture du 8 octobre (arthuror2,
//  tomj683) — l'extension ne relisait le dressing QUE du compte connecté dans
//  Chrome. L'ancienne annonce supprimée + la republiée = la même paire deux ou
//  trois fois.
//
//  On EXÉCUTE le vrai code, sur des données inventées (le dépôt est public) :
//   A. LA RÈGLE (`<enligne-regle>`) : le bloc est IDENTIQUE dans l'app et dans
//      l'extension, et leurs SORTIES sont les mêmes sur les mêmes entrées (§11) :
//      la lecture complète la plus récente fait foi, une annonce absente d'une
//      lecture plus récente sort, une republiée entre, une vendue ne se rouvre
//      pas, une supprimée après la lecture sort, et au-delà de 24 h (ou sans
//      date) tout est « à confirmer » — ni en ligne, ni disparu ;
//   B. LA LECTURE PUBLIQUE DES AUTRES COMPTES (`relireAnnoncesAutresComptes`,
//      le vrai `background.js` dans un vm) : uniquement ses comptes liés, jamais
//      le connecté, un exclu ni un supprimé, jamais avec « pas su » sur ces
//      listes ; au plus 3 par visite, le plus ancien d'abord, aucun relu depuis
//      moins de 30 min ; une requête à la fois (la file), pause et frein
//      respectés, budget de LECTURE sans affamer l'argent et les colis ; toutes
//      les pages ou rien ; une ligne DÉDIÉE `harvest_{uid}_enligne`, jamais par-
//      dessus `harvest_{uid}_listings` ; l'app est prévenue ; la visite la fait
//      APRÈS la moisson du compte connecté ;
//   C. LES FILES Leboncoin et eBay de l'extension suivent la règle : la
//      republiée y entre, l'ancienne en sort, celles « à confirmer » ne sont ni
//      dans la file, ni « à retirer de Leboncoin ».
//   D. REVUE DE LA 5.167 (11 octobre) — les défauts reproduits par la relecture :
//      un 403 sur UN compte ne fait plus monter la pause (24 h pour ce compte,
//      coupure du jour sur un 429 ou un second compte) ; un onglet qui quitte
//      Vinted ne fait partir AUCUNE requête chez l'autre site ni de pause ; une
//      lecture « déchirée » (suppression, republication entre deux pages) ne
//      décide rien ; la relecture passe avant les photos dans le budget ; des
//      dressings illisibles ne font rien dire « à retirer » ; des lectures
//      publiques illisibles ne ressuscitent rien (dernière connue, sinon « à
//      confirmer »).
//  Usage : node scripts/audit-enligne.cjs [--mutation nom] (voir MUTATIONS)
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os');
const { faireFond } = require('./_fond-vm.cjs');
const { metaVersData } = require('./bancs/_meta.cjs');
const racine = path.join(__dirname, '..');
const F = { bg: fs.readFileSync(path.join(racine, 'vinted-sync-extension/background.js'), 'utf8'),
  app: fs.readFileSync(path.join(racine, 'src/App.jsx'), 'utf8') };

// ── RÉAFFAIBLIR UNE RÈGLE (§6.1) : le contrôle correspondant doit passer au rouge ──
const MUTATIONS = {
  // le dressing ANCIEN déciderait encore même quand une lecture publique plus récente existe
  plusrecente: [['bg', `  if (isFinite(capP) && !(isFinite(capL) && capL >= capP)) {`, `  if (false) {`],
                ['app', `  if (isFinite(capP) && !(isFinite(capL) && capL >= capP)) {`, `  if (false) {`]],
  // plus de « à confirmer » : une lecture de trois jours compterait en ligne
  ajourdhui: [['bg', `  if (isFinite(r.lu) && age <= ENLIGNE_FRAIS_MS && sur) r.enLigne = garde; else r.aConfirmer = garde;`, `  r.enLigne = garde;`],
              ['app', `  if (isFinite(r.lu) && age <= ENLIGNE_FRAIS_MS && sur) r.enLigne = garde; else r.aConfirmer = garde;`, `  r.enLigne = garde;`]],
  // l'app seule change le seuil : les deux côtés divergent
  divergence: [['app', `const ENLIGNE_FRAIS_MS = 24 * 60 * 60 * 1000;`, `const ENLIGNE_FRAIS_MS = 72 * 60 * 60 * 1000;`]],
  // une vente vue par son vendeur se rouvrirait d'un coup d'œil public
  vendue: [['bg', `      if (l && venduePourSonVendeur(l)) { r.fermees.push(l); continue; }\n`, ``], ['app', `      if (l && venduePourSonVendeur(l)) { r.fermees.push(l); continue; }\n`, ``]],
  // l'extension lirait aussi les comptes EXCLUS
  exclus: [['bg', `.filter((u) => u && u !== String(uidConnecte) && !noirs.has(u) && !off.has(u))`, `.filter((u) => u && u !== String(uidConnecte) && !noirs.has(u))`]],
  // « pas su » sur la liste des supprimés laisserait lire tout le monde
  passu: [['bg', `    const noirs = await blockedAccounts();\n    if (!noirs) { noterDiag('enligne_supprimes_pas_lus'); return 0; }      // pas su : on ne lit personne`, `    const noirs = (await blockedAccounts()) || new Set();`]],
  // plus de plafond par visite
  max3: [['bg', `const ENLIGNE_MAX_PAR_VISITE = 3;`, `const ENLIGNE_MAX_PAR_VISITE = 99;`]],
  // plus de délai de 30 min entre deux lectures d'un compte
  delai: [['bg', `      .filter((u) => !(t - Number(essais[u] || 0) < ENLIGNE_DELAI_MS))\n      .filter((u) => !(t - Number(lus.get(u) || 0) < ENLIGNE_DELAI_MS))\n`, ``]],
  // une lecture qui n'atteint pas le total annoncé serait rangée
  total: [['bg', `  if (complet && total != null && items.length < total) return { complet: false, raison: 'total', total, n: items.length };\n`, ``]],
  // une page qui échoue en route vaudrait la fin de la liste
  pageko: [['bg', `    if (!r || r.pause || !r.ok || !r.json || !Array.isArray(r.json.items)) return echec(r);\n    pages++;`, `    if (!r || r.pause || !r.ok || !r.json || !Array.isArray(r.json.items)) { if (r && r.pause) return echec(r); complet = true; break; }\n    pages++;`]],
  // plus de budget de lecture
  budget: [['bg', `      const lu = await lireDressingPublic(lire, pid, () => gardeLecture(uidConnecte, acc, 'enligne'));`, `      const lu = await lireDressingPublic(lire, pid, null);`]],
  // la lecture publique passerait hors de la file Vinted
  file: [['bg', `    return requeteVinted('public', async () => {\n      try {\n        const res = await chrome.scripting.executeScript({`, `    return (async () => {\n      try {\n        const res = await chrome.scripting.executeScript({`],
         ['bg', `        return o;\n      } catch (_) { return { status: 0, ok: false, json: null }; }\n    });\n  };\n}`, `        return o;\n      } catch (_) { return { status: 0, ok: false, json: null }; }\n    })();\n  };\n}`]],
  // la lecture publique écraserait le dressing du compte
  ecrase: [['bg', "const ok = await supabaseUpsert('app_data', [{ id: `harvest_${uid}_enligne`, data, updated_at: data.capturedAt }], 'id');", "const ok = await supabaseUpsert('app_data', [{ id: `harvest_${uid}_listings`, data, updated_at: data.capturedAt }], 'id');"]],
  // un article d'un autre membre serait rangé
  // une réponse sans total (page vide, forme inattendue) passerait pour « tout est parti »
  senstotal: [['bg', `  if (complet && total == null) return { complet: false, raison: 'sans-total', n: items.length };\n`, ``]],
  autremembre: [['bg', `      if (proprio != null && String(proprio) !== String(pid)) return { complet: false, raison: 'autre-membre' };\n`, ``]],
  // la file Leboncoin alerterait « à retirer » sur une paire à confirmer
  retirer: [['bg', `    if (aConfirmerIds.has(pid)) continue;              // à confirmer : on ne sait pas, on n'alerte pas\n`, ``]],
  // ── revue de la 5.167 ──
  // une vendue listée ouverte en public disparaîtrait de TOUTES les sorties
  vendue2: [['bg', `      if (l && venduePourSonVendeur(l)) { r.fermees.push(l); continue; }`, `      if (l && venduePourSonVendeur(l)) continue;`],
            ['app', `      if (l && venduePourSonVendeur(l)) { r.fermees.push(l); continue; }`, `      if (l && venduePourSonVendeur(l)) continue;`]],
  // une lecture PUBLIQUE postérieure annulerait une suppression vue en 2xx
  supprpublic: [['bg', `supprimeeApres(suppIds, it.id, r.source === 'public' ? -Infinity : r.lu)`, `supprimeeApres(suppIds, it.id, r.lu)`],
                ['app', `supprimeeApres(suppIds, it.id, r.source === 'public' ? -Infinity : r.lu)`, `supprimeeApres(suppIds, it.id, r.lu)`]],
  // « pas su » les lectures publiques : le vieux dressing redéciderait
  passupub: [['bg', `  const sur = !pubPasSu || age < ENLIGNE_SUR_MS;`, `  const sur = true;`],
             ['app', `  const sur = !pubPasSu || age < ENLIGNE_SUR_MS;`, `  const sur = true;`]],
  // un 403 public réessaierait dans 5 min (la pause monte à 4 h)
  frein: [['bg', `      .filter((u) => !(t - Number(freins[u] || 0) < ENLIGNE_FREIN_MS))             // freiné : pas avant demain\n`, ``],
          ['bg', `        if (lu.raison === 'frein') {`, `        if (false) {`]],
  // un 429 ne couperait pas la relecture du jour
  coupure: [['bg', `          if (Number(lu.statut) === 429 || autre) { freins._tous = Date.now(); noterDiag('enligne_coupee_frein'); }`, ``]],
  // un compte en échec récent resterait en tête
  tri: [['bg', `      .sort((a, b) => (Number(recent(a)) - Number(recent(b))) || (Number(lus.get(a) || 0) - Number(lus.get(b) || 0)));`, `      .sort((a, b) => Number(lus.get(a) || 0) - Number(lus.get(b) || 0));`]],
  // l'onglet choisi une fois pour toutes
  ongletfige: [['bg', `    const tab = await ongletVinted(tabId);`, `    const tab = { id: tabId };`]],
  // la page injectée ne vérifie plus où elle est
  hotepage: [['bg', `            if (!/(^|\\.)vinted\\.(fr|com|it|de|es|be|nl|lu|at|pt|pl|cz|lt|co\\.uk)$/i.test(hote)) return { status: 0, ok: false, json: null, horsVinted: true, origine };\n`, ``]],
  // … ni l'origine de la réponse (les deux défenses retirées)
  sansgarde: [['bg', `            if (!/(^|\\.)vinted\\.(fr|com|it|de|es|be|nl|lu|at|pt|pl|cz|lt|co\\.uk)$/i.test(hote)) return { status: 0, ok: false, json: null, horsVinted: true, origine };\n`, ``],
              ['bg', `        if (o.horsVinted || !VINTED_HOTE.test(hote)) { noterDiag('enligne_hors_vinted'); return { status: 0, ok: false, json: null, horsVinted: true }; }\n`, ``]],
  // la page 1 n'est plus relue à la fin
  relit: [['bg', `  if (pages > 1) {\n    const refus = avantPage ? await avantPage() : null;`, `  if (false) {\n    const refus = avantPage ? await avantPage() : null;`]],
  // le total de chaque page n'est plus comparé à celui de la page 1
  pagetotal: [['bg', `    else if (sig(pg) !== signature) return { complet: false, raison: 'mouvant' };   // la liste a bougé entre deux pages\n`, ``]],
  // la relecture retombe dans la classe des photos
  budget2: [['bg', `LECTURES_MAX_HEURE - (await reserveLectures(uid, classe === 'enligne' ? 'enligne' : 'photos'))`, `LECTURES_MAX_HEURE - (await reserveLectures(uid))`],
            ['bg', `    await noterLecturesDues(uidConnecte, 'enligne', candidats.length);\n`, ``]],
  // des dressings illisibles valent « aucun dressing »
  dressingsko: [['bg', `  if (!Array.isArray(lignesL)) { noterDiag('enligne_dressings_pas_lus'); return { echec: true, lignes: [], aConfirmer: new Map(), parCompte: new Map() }; }`, `  if (!Array.isArray(lignesL)) return enLigneDesLignes([], [], null, Date.now());`]],
  // des lectures publiques illisibles valent « aucune lecture publique »
  pubko: [['bg', `  else { noterDiag('enligne_lignes_pas_lues'); lignesP = _dernieresLecturesPubliques; }`, `  else { noterDiag('enligne_lignes_pas_lues'); lignesP = []; }`]],
};
const iM = process.argv.indexOf('--mutation');
const MUT = iM > 0 ? process.argv[iM + 1] : '';
if (MUT) {
  if (!MUTATIONS[MUT]) { console.log(`mutation inconnue : ${MUT} (${Object.keys(MUTATIONS).join(', ')})`); process.exit(2); }
  for (const [f, de, vers] of MUTATIONS[MUT]) {
    const n = F[f].split(de).length - 1;
    if (n !== 1) { console.log(`❌ mutation ${MUT} : ancre trouvée ${n} fois dans ${f} — mets la mutation à jour`); process.exit(1); }
    F[f] = F[f].replace(de, vers);
  }
  console.log(`(mutation « ${MUT} »)`);
}
const BG = path.join(os.tmpdir(), `vrm-enligne-bg-${process.pid}.js`);
fs.writeFileSync(BG, F.bg);

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`); return null; } };

// ════════════════════════════════════════════════════════════════════════════
// A. La règle, extraite des deux fichiers
// ════════════════════════════════════════════════════════════════════════════
const bloc = (texte, nom) => {
  const m = new RegExp(`\\/\\/ <${nom}>[^\\n]*\\n([\\s\\S]*?)\\/\\/ <\\/${nom}>`).exec(texte);
  if (!m) throw new Error(`bloc <${nom}> introuvable`);
  return m[1];
};
const sansCommentaires = (t) => t.split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '')).filter((l) => l.trim()).join('\n');
function regle(texte) {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(bloc(texte, 'supprimees-regle') + '\n' + bloc(texte, 'enligne-regle') + '\n;this.c = enLigneDuCompte; this.l = enLigneDesLignes;', ctx);
  return { compte: ctx.c, lignes: ctx.l };
}
const H = 3600e3, NOW = Date.parse('2026-10-11T09:30:00.000Z');
const art = (id, o) => Object.assign({ id, title: 'Paire ' + id, price: { amount: '50.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false }, o);
const ids = (l) => (l || []).map((x) => String(x.id)).sort().join(',');

console.log('── A. La règle « en ligne » : la même dans l\'app et dans l\'extension');
(async () => {
  await essaie('règle', async () => {
    const tA = sansCommentaires(bloc(F.app, 'enligne-regle')), tE = sansCommentaires(bloc(F.bg, 'enligne-regle'));
    dit(tA === tE, 'le bloc <enligne-regle> est IDENTIQUE (code) dans App.jsx et background.js', tA === tE ? '' : 'les deux textes diffèrent');
    const A = regle(F.app), E = regle(F.bg);
    const L = (items, h) => ({ items, cap: NOW - h * H });
    const P = (items, h, o) => Object.assign({ complet: true, ids: items.map((x) => String(x.id)), items, cap: NOW - h * H }, o);
    const cas = [
      // [nom, liste, pub, supp, attendu {en, ac, abs, src}]
      ['dressing lu il y a 2 h, seul', L([art(1), art(2), art(3, { is_closed: true, item_closing_action: 'sold' })], 2), null, null, { en: '1,2', ac: '', abs: '', src: 'dressing' }],
      ['dressing de 3 jours, aucune autre lecture ⇒ à confirmer (ni en ligne, ni disparues)', L([art(1), art(2)], 72), null, null, { en: '', ac: '1,2', abs: '', src: 'dressing' }],
      ['dressing sans date ⇒ à confirmer (« pas su »)', { items: [art(1)], cap: NaN }, null, null, { en: '', ac: '1', abs: '', src: '' }],
      ['dressing du 8, lecture publique de ce matin sans les anciennes ⇒ elles SORTENT', L([art(1), art(2), art(3)], 72), P([], 1), null, { en: '', ac: '', abs: '1,2,3', src: 'public' }],
      ['republiée à l\'instant (dans la lecture publique, pas dans le dressing) ⇒ EN LIGNE', L([art(1)], 72), P([art(9, { title: 'Paire republiée' })], 0.2), null, { en: '9', ac: '', abs: '1', src: 'public' }],
      ['le dressing plus récent que la lecture publique fait foi', L([art(1), art(2)], 1), P([art(1)], 3), null, { en: '1,2', ac: '', abs: '', src: 'dressing' }],
      ['lecture publique INCOMPLÈTE ⇒ ignorée', L([art(1), art(2)], 2), P([art(1)], 0.5, { complet: false }), null, { en: '1,2', ac: '', abs: '', src: 'dressing' }],
      ['vendue pour son vendeur, « ouverte » vue de l\'extérieur ⇒ ne se rouvre pas', L([art(1, { is_closed: true, item_closing_action: 'sold' })], 30), P([art(1)], 1), null, { en: '', ac: '', abs: '', src: 'public' }],
      ['supprimée APRÈS la lecture publique ⇒ sort', L([], 30), P([art(1), art(2)], 3), { '1': new Date(NOW - 1 * H).toISOString() }, { en: '2', ac: '', abs: '', src: 'public' }],
      // Revue de la 5.167 : une suppression vue en 2xx est DÉFINITIVE face à une lecture PUBLIQUE (Vinted ne
      // réutilise jamais un identifiant ; la vue publique n'est pas mesurée) — le DRESSING, lui, fait toujours foi (5.165).
      ['supprimée AVANT une lecture publique qui la montre encore ⇒ elle reste supprimée (la vue publique ne la rouvre pas)', L([], 30), P([art(1)], 1), { '1': new Date(NOW - 3 * H).toISOString() }, { en: '', ac: '', abs: '', src: 'public' }],
      ['supprimée AVANT un DRESSING relu qui la montre encore ⇒ le dressing fait foi (5.165)', L([art(1)], 1), null, { '1': new Date(NOW - 3 * H).toISOString() }, { en: '1', ac: '', abs: '', src: 'dressing' }],
      ['suppressions pas lues (null) ⇒ rien n\'est écarté', L([art(1)], 2), null, null, { en: '1', ac: '', abs: '', src: 'dressing' }],
      ['lecture publique de 30 h ⇒ à confirmer aussi', L([art(1)], 72), P([art(1)], 30), null, { en: '', ac: '1', abs: '', src: 'public' }],
    ];
    const diverge = [];
    for (const [nom, liste, pub, supp, att] of cas) {
      const a = A.compte(liste, pub, supp, NOW), e = E.compte(liste, pub, supp, NOW);
      const sig = (r) => `en[${ids(r.enLigne)}] ac[${ids(r.aConfirmer)}] abs[${ids(r.absentes)}] ${r.source}`;
      if (sig(a) !== sig(e)) diverge.push(nom);
      dit(ids(a.enLigne) === att.en && ids(a.aConfirmer) === att.ac && ids(a.absentes) === att.abs && a.source === att.src, nom, `app ${sig(a)} · extension ${sig(e)}`);
    }
    dit(!diverge.length, 'l\'app et l\'extension rendent la MÊME sortie sur tous les cas (§11)', diverge.join(' · '));
    // Revue de la 5.167 : une VENDUE (pour son vendeur) que la lecture publique montre encore ouverte reste parmi
    // les fermées — c'est la seule preuve sans ressemblance qu'une paire numérotée est partie.
    { const rv = A.compte(L([art(1, { is_closed: true, item_closing_action: 'sold' }), art(2)], 30), P([art(1), art(2)], 1), null, NOW);
      const ev = E.compte(L([art(1, { is_closed: true, item_closing_action: 'sold' }), art(2)], 30), P([art(1), art(2)], 1), null, NOW);
      dit(ids(rv.fermees) === '1' && ids(rv.enLigne) === '2' && ids(ev.fermees) === '1', 'une vendue listée ouverte par une lecture publique plus récente RESTE parmi les fermées (app = extension)', `app fermées[${ids(rv.fermees)}] · ext fermées[${ids(ev.fermees)}]`); }
    // La republiée porte ce que la lecture publique en sait (titre, prix, photo).
    const r9 = A.compte(L([art(1)], 72), P([art(9, { title: 'Nike neuve', price: { amount: '61.0' }, photo: { url: 'https://images1.vinted.net/x.jpg' } })], 0.2), null, NOW);
    const n9 = r9.enLigne[0] || {};
    dit(n9.title === 'Nike neuve' && n9.price && n9.price.amount === '61.0' && n9.photo && n9.photo.url, 'la republiée s\'affiche avec ce que la lecture publique sait (titre, prix, photo)', JSON.stringify(n9));
    // Une annonce connue des DEUX : la vue du dressing garde ses chiffres (vues), la lecture publique rafraîchit le prix.
    const r1 = A.compte(L([art(1, { view_count: 40, price: { amount: '70.0' } })], 30), P([art(1, { price: { amount: '55.0' } })], 1), null, NOW);
    dit(r1.enLigne[0] && r1.enLigne[0].view_count === 40 && r1.enLigne[0].price.amount === '55.0', 'connue des deux : les vues du dressing restent, le prix est celui de la lecture la plus récente', JSON.stringify(r1.enLigne[0]));

    // Les LIGNES (balayages : files Leboncoin/eBay, écran Leboncoin, recherche).
    console.log('── A2. La même règle appliquée aux lignes de tous les comptes');
    const lignesL = [
      { id: 'harvest_111_listings', data: { uid: '111', capturedAt: new Date(NOW - 2 * H).toISOString(), payload: { items: [art(10), art(11, { is_closed: true, item_closing_action: 'sold' })] } } },
      { id: 'harvest_222_listings', data: { uid: '222', capturedAt: new Date(NOW - 72 * H).toISOString(), payload: { items: [art(20), art(21)] } } },
      { id: 'harvest_333_listings', data: { uid: '333', capturedAt: new Date(NOW - 72 * H).toISOString(), payload: { items: [art(30)] } } },
    ];
    const lignesP = [
      { id: 'harvest_222_enligne', cap: new Date(NOW - 1 * H).toISOString(), complet: true, ids: ['22'], items: [art(22)] },
      { id: 'harvest_444_enligne', cap: new Date(NOW - 1 * H).toISOString(), complet: true, ids: ['40'], items: [art(40)] },
    ];
    const ra = A.lignes(lignesL, lignesP, null, NOW), re = E.lignes(lignesL, lignesP, null, NOW);
    const vue = (r) => JSON.stringify({ l: r.lignes.map((x) => [x.id, x.data.payload.items.map((it) => `${it.id}${it.is_closed ? (it._vrmAbsente ? 'a' : 'f') : ''}`)]).sort(), ac: [...r.aConfirmer.entries()].map(([u, l]) => [u, ids(l)]).sort() });
    dit(vue(ra) === vue(re), 'lignes : l\'app et l\'extension rendent la même chose', `app ${vue(ra)} · ext ${vue(re)}`);
    const parId = Object.fromEntries(ra.lignes.map((x) => [x.id, x.data.payload.items.map((it) => `${it.id}${it.is_closed ? (it._vrmAbsente ? 'a' : 'f') : ''}`).sort().join(',')]));
    dit(parId.harvest_111_listings === '10,11f', 'compte frais : son dressing tel quel', parId.harvest_111_listings);
    dit(parId.harvest_222_listings === '20a,21a,22', 'compte relu en public : les anciennes rendues FERMÉES (absentes), la republiée en ligne', parId.harvest_222_listings);
    dit(parId.harvest_444_listings === '40', 'un compte connu seulement par sa lecture publique a sa ligne', parId.harvest_444_listings);
    dit(!('harvest_333_listings' in parId) || parId.harvest_333_listings === '', 'compte figé depuis 3 jours : aucune annonce en ligne', parId.harvest_333_listings);
    dit(ra.aConfirmer.has('333') && ids(ra.aConfirmer.get('333')) === '30', 'et ses annonces sont rendues à part, « à confirmer »', JSON.stringify([...ra.aConfirmer.keys()]));

    // Revue de la 5.167 : les lectures publiques ILLISIBLES (`null`) ne laissent plus un vieux dressing redécider.
    console.log('── A3. Lectures publiques illisibles (« pas su ») : rien ne ressuscite');
    const lignesL3 = [
      { id: 'harvest_111_listings', data: { uid: '111', capturedAt: new Date(NOW - 10 * 60e3).toISOString(), payload: { items: [art(10)] } } },   // lu il y a 10 min
      { id: 'harvest_222_listings', data: { uid: '222', capturedAt: new Date(NOW - 10 * H).toISOString(), payload: { items: [art(20), art(21)] } } },  // lu il y a 10 h
    ];
    const lignesP3 = [{ id: 'harvest_222_enligne', cap: new Date(NOW - 1 * H).toISOString(), complet: true, ids: ['21'], items: [art(21)] }];
    const vu3 = (r) => JSON.stringify({ l: r.lignes.map((x) => [x.id, x.data.payload.items.filter((it) => !it.is_closed).map((it) => String(it.id)).sort()]).sort(), ac: [...r.aConfirmer.entries()].map(([u, l]) => [u, ids(l)]).sort() });
    const lu3 = A.lignes(lignesL3, lignesP3, null, NOW), ko3 = A.lignes(lignesL3, null, null, NOW), ko3e = E.lignes(lignesL3, null, null, NOW);
    dit(/"harvest_222_listings",\["21"\]/.test(vu3(lu3)), 'lecture publique lisible : 20 est partie, 21 en ligne', vu3(lu3));
    const en222 = (ko3.lignes.find((x) => x.id === 'harvest_222_listings') || { data: { payload: { items: [] } } }).data.payload.items.filter((it) => !it.is_closed).map((it) => String(it.id));
    dit(!en222.includes('20'), 'illisible : l’annonce qu’une lecture plus récente savait partie ne redevient PAS « en ligne »', vu3(ko3));
    dit(ko3.aConfirmer.has('222') && ids(ko3.aConfirmer.get('222')) === '20,21', 'ses annonces sont « à confirmer » (le dressing de 10 h ne décide plus seul)', vu3(ko3));
    dit(/"harvest_111_listings",\["10"\]/.test(vu3(ko3)), 'l’autre sens : un dressing de 10 min décide encore (aucune lecture plus récente ne peut exister)', vu3(ko3));
    dit(vu3(ko3) === vu3(ko3e), 'app = extension sur « pas su »', `app ${vu3(ko3)} · ext ${vu3(ko3e)}`);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // B. La lecture publique des autres comptes (le vrai background.js)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('── B. L\'extension relit le dressing PUBLIC de ses autres comptes');
  const iso = (h) => new Date(Date.now() - h * H).toISOString();
  // 111 connecté · 222, 333, 444, 555 : ses autres comptes · 666 exclu (masqué) ·
  // 777 supprimé définitivement · 888 un tiers (aucun compte lié).
  const PID = { '111': 9111, '222': 9222, '333': 9333, '444': 9444, '555': 9555, '666': 9666, '777': 9777, '888': 9888 };
  const COMPTES = ['111', '222', '333', '444', '555', '666', '777'].map((u) => ({ vinted_user_id: u, login: 'compte_' + u, domain: 'www.vinted.fr', access_token: 'jeton_' + u }));
  const AGE = { '111': 0.1, '222': 50, '333': 70, '444': 60, '555': 40, '666': 90, '777': 90 };   // heures depuis la dernière lecture
  const baseLignes = () => {
    const l = {
      main: { vinted_accounts_hidden: ['666'], vinted_accounts_blocked: [], vinted_annonce_numeros: {} },
      vrm_blocked_accounts: { uids: ['777'], logins: ['supprime'] },
    };
    for (const u of Object.keys(AGE)) {
      l[`harvest_${u}_profile`] = { type: 'profile', capturedAt: iso(AGE[u]), payload: { user: { id: PID[u], login: 'compte_' + u } } };
      l[`harvest_${u}_listings`] = { type: 'listings', uid: u, capturedAt: iso(AGE[u]), nItems: 2, payload: { items: [art(Number(u) * 10 + 1), art(Number(u) * 10 + 2)] } };
    }
    return l;
  };
  // Le faux Vinted : dressing public par profil, paginé, avec ses accidents.
  const dressingPublic = (pid) => {
    const u = Object.keys(PID).find((k) => PID[k] === Number(pid));
    if (u === '222') return Array.from({ length: 150 }, (_, i) => art(500000 + i, i === 3 ? { is_closed: true, item_closing_action: 'sold' } : {}));
    return [art(Number(u) * 100 + 7, { title: 'Republiée ' + u })];
  };
  const monter = (o = {}) => {
    const lignes = o.lignes || baseLignes();
    const f = faireFond({ src: BG, lignes, connecte: '111', comptes: COMPTES, store: o.store || {}, lectureKO: o.lectureKO,
      vinted: (r) => {
        const w = /\/api\/v2\/wardrobe\/(\d+)\/items\?page=(\d+)&per_page=(\d+)/.exec(r.chemin);
        if (!w) return o.autre ? o.autre(r) : { status: 404, body: {} };
        if (o.repondre) { const x = o.repondre(w[1], Number(w[2])); if (x) return x; }
        const tous = dressingPublic(w[1]); const per = Number(w[3]); const page = Number(w[2]);
        const items = tous.slice((page - 1) * per, page * per).map((it) => Object.assign({ user_id: Number(w[1]) }, it));
        return { status: 200, body: { items, pagination: { current_page: page, per_page: per, total_entries: tous.length, total_pages: Math.max(1, Math.ceil(tous.length / per)) } } };
      } });
    return f;
  };
  const lus = (f) => f.j.vinted.filter((x) => /\/wardrobe\//.test(x.chemin)).map((x) => /wardrobe\/(\d+)/.exec(x.chemin)[1]);
  const comptesLus = (f) => [...new Set(lus(f))].map((p) => Object.keys(PID).find((k) => String(PID[k]) === p));

  await essaie('B1', async () => {
    const f = monter();
    const avant = JSON.stringify(f.lignes.harvest_222_listings);
    const n = await f.ctx.relireAnnoncesAutresComptes('111');
    await new Promise((r) => setTimeout(r, 30));   // `notifierApp` n'est pas attendu : il part dans la foulée
    const c = comptesLus(f);
    dit(c.length === 3, 'au plus 3 comptes par visite', c.join(','));
    dit(c.join(',') === '333,444,222', 'le plus ancien d\'abord (333 lu il y a 70 h, 444 60 h, 222 50 h)', c.join(','));
    dit(!c.includes('111'), 'jamais le compte connecté (sa propre moisson le lit)', c.join(','));
    dit(!c.includes('666') && !c.includes('777'), 'jamais un compte exclu (666) ni supprimé définitivement (777)', c.join(','));
    dit(!lus(f).includes(String(PID['888'])), 'jamais un tiers : seulement les profils de SES comptes liés', lus(f).join(','));
    dit(f.j.maxEnVol === 1, 'une requête Vinted à la fois', `max en vol ${f.j.maxEnVol}`);
    dit(f.j.vinted.every((x) => x.origine === 'page' && x.methode === 'GET'), 'des LECTURES (GET), faites depuis la page Vinted ouverte', JSON.stringify([...new Set(f.j.vinted.map((x) => x.methode + ' ' + x.origine))]));
    const l222 = f.lignes.harvest_222_enligne;
    dit(!!l222 && l222.complet === true && l222.source === 'public' && l222.n === 149 && l222.ids.length === 149, 'toutes les pages lues (150 articles sur 2 pages de 96) : ligne dédiée, complète, les 149 ouvertes', l222 ? JSON.stringify({ n: l222.n, c: l222.complet, s: l222.source, lus: l222.lus }) : 'absente');
    dit(lus(f).filter((p) => p === String(PID['222'])).length === 3, 'deux pages, puis la page 1 RELUE (rien n’a bougé entre-temps) : trois requêtes pour ce compte', String(lus(f).filter((p) => p === String(PID['222'])).length));
    dit(JSON.stringify(f.lignes.harvest_222_listings) === avant, 'harvest_{uid}_listings n\'est PAS touché (la vue publique est plus pauvre)');
    dit(['222', '333', '444'].every((u) => f.j.evts.some((e) => e && e.type === 'maj' && e.quoi === 'annonces' && e.uid === u)), 'l\'app est prévenue (maj · annonces) pour chaque compte relu', JSON.stringify(f.j.evts));
    const lec = (f.store.vrmLectures || {})['111'] || [];
    dit(lec.length === lus(f).length, 'chaque page compte sur le budget de LECTURE du compte connecté', `${lec.length} lectures comptées pour ${lus(f).length} pages`);
    dit(n === 3, 'trois comptes rangés', String(n));
    // Visite suivante, 1 min plus tard : les trois ne sont pas relus, le 4e (555) l'est.
    f.j.vinted.length = 0;
    await f.ctx.relireAnnoncesAutresComptes('111');
    dit(comptesLus(f).join(',') === '555', 'visite suivante : aucun compte relu depuis moins de 30 min, le suivant l\'est', comptesLus(f).join(','));
    // Les lectures prioritaires (argent, colis) ne sont pas affamées.
    const g = await f.ctx.gardeLecture('111', COMPTES[0], 'argent');
    dit(g === null, 'après la lecture, l\'argent et les colis ont toujours du budget', JSON.stringify(g));
  });

  await essaie('B2 budget', async () => {
    const t = Date.now();
    const f = monter({ store: { vrmLectures: { '111': Array.from({ length: 10 }, () => t - 60e3) } } });
    await f.ctx.relireAnnoncesAutresComptes('111');
    dit(lus(f).length === 0 && !f.lignes.harvest_333_enligne, 'budget de lecture des « ordinaires » épuisé (réserve argent/colis) : AUCUNE requête, rien rangé', lus(f).join(','));
  });

  await essaie('B3 pause', async () => {
    const f = monter({ store: { vrmPauseVinted: { jusqua: Date.now() + 10 * 60e3, niveau: 1 } } });
    await f.ctx.relireAnnoncesAutresComptes('111');
    dit(f.j.vinted.length === 0, 'Vinted a demandé de ralentir : aucune requête', String(f.j.vinted.length));
  });

  await essaie('B4 frein', async () => {
    const f = monter({ repondre: () => ({ status: 429, body: {} }) });
    await f.ctx.relireAnnoncesAutresComptes('111');
    dit(lus(f).length === 1, 'un 429 : on s\'arrête à la première requête', lus(f).join(','));
    dit(!!(f.store.vrmPauseVinted && f.store.vrmPauseVinted.jusqua > Date.now()), 'et la pause est posée pour toutes les requêtes Vinted', JSON.stringify(f.store.vrmPauseVinted));
    dit(!Object.keys(f.lignes).some((k) => /_enligne$/.test(k)), 'rien n\'est rangé');
  });

  await essaie('B5 incomplet', async () => {
    const f = monter({ repondre: (pid, page) => (pid === String(PID['222']) && page === 2 ? { status: 500, body: {} } : null) });
    const avant = JSON.stringify(f.lignes.harvest_222_listings);
    await f.ctx.relireAnnoncesAutresComptes('111');
    dit(!f.lignes.harvest_222_enligne, 'une page qui échoue en route : la lecture n\'est PAS complète, rien n\'est rangé', JSON.stringify(f.lignes.harvest_222_enligne || null).slice(0, 80));
    dit(JSON.stringify(f.lignes.harvest_222_listings) === avant, 'et le dressing du compte est intact');
    dit(!!f.lignes.harvest_333_enligne, 'les autres comptes, lus en entier, sont rangés');
    dit(Number(((f.store.vrmEnLigneEssais || {})['222'] || 0)) < Date.now() - 30 * 60e3 + 6 * 60e3, 'le compte raté réessaie dans 5 min, pas dans 30', String((f.store.vrmEnLigneEssais || {})['222']));
    // La cause est la PAGE ratée, pas seulement le total : chaque garde tient seule
    // (sans ce contrôle, retirer l'arrêt sur page ratée resterait invisible derrière
    // la garde du total — deux gardes, deux preuves).
    dit(f.j.diags.includes('enligne_incomplet_lecture'), 'et la cause notée est la page ratée (`enligne_incomplet_lecture`), pas le total', JSON.stringify(f.j.diags.filter((d) => /enligne_incomplet/.test(d))));
  });

  await essaie('B6 total', async () => {
    const f = monter({ repondre: (pid, page) => (pid === String(PID['333']) ? { status: 200, body: { items: [art(1), art(2)].map((it) => Object.assign({ user_id: PID['333'] }, it)), pagination: { current_page: 1, total_pages: 1, total_entries: 5 } } } : null) });
    await f.ctx.relireAnnoncesAutresComptes('111');
    dit(!f.lignes.harvest_333_enligne, 'un total annoncé (5) que les pages n\'atteignent pas (2) : rien n\'est rangé', JSON.stringify(f.lignes.harvest_333_enligne || null).slice(0, 80));
  });

  await essaie('B6b sans total', async () => {
    // Une forme inattendue — page vide, aucune pagination — ne prouve pas que le
    // dressing est vide : rangée, elle ferait « disparaître » toutes ses annonces.
    const f = monter({ repondre: (pid) => (pid === String(PID['333']) ? { status: 200, body: { items: [] } } : null) });
    await f.ctx.relireAnnoncesAutresComptes('111');
    dit(!f.lignes.harvest_333_enligne, 'une réponse vide SANS total annoncé : rien n\'est rangé (aucune annonce ne disparaît sur une forme inattendue)', JSON.stringify(f.lignes.harvest_333_enligne || null).slice(0, 80));
    // L'autre sens : un dressing VIDE annoncé comme tel (total 0) est une réponse.
    const g = monter({ repondre: (pid) => (pid === String(PID['333']) ? { status: 200, body: { items: [], pagination: { current_page: 1, total_pages: 0, total_entries: 0 } } } : null) });
    await g.ctx.relireAnnoncesAutresComptes('111');
    dit(!!g.lignes.harvest_333_enligne && g.lignes.harvest_333_enligne.n === 0 && g.lignes.harvest_333_enligne.complet === true, 'l\'autre sens : un dressing vide annoncé (total 0) est rangé, complet', JSON.stringify(g.lignes.harvest_333_enligne || null).slice(0, 80));
  });

  await essaie('B7 autre membre', async () => {
    const f = monter({ repondre: (pid) => (pid === String(PID['333']) ? { status: 200, body: { items: [Object.assign({ user_id: 123456 }, art(1))], pagination: { current_page: 1, total_pages: 1, total_entries: 1 } } } : null) });
    await f.ctx.relireAnnoncesAutresComptes('111');
    dit(!f.lignes.harvest_333_enligne, 'un article d\'un AUTRE membre dans la réponse : rien n\'est rangé sous ce compte (§5)');
  });

  await essaie('B8 pas su', async () => {
    const f = monter({ lectureKO: (u) => /vrm_blocked_accounts/.test(u) });
    await f.ctx.relireAnnoncesAutresComptes('111');
    dit(f.j.vinted.length === 0, 'la liste des comptes SUPPRIMÉS illisible : personne n\'est lu', String(f.j.vinted.length));
    const g = monter({ lectureKO: (u) => /id=eq\.main/.test(u) });
    await g.ctx.relireAnnoncesAutresComptes('111');
    dit(g.j.vinted.length === 0, 'la liste des comptes EXCLUS illisible : personne n\'est lu', String(g.j.vinted.length));
    const h = monter();
    h.ctx.getStoredAccounts = async () => null;
    await h.ctx.relireAnnoncesAutresComptes('111');
    dit(h.j.vinted.length === 0, 'la liste de ses comptes illisible : personne n\'est lu', String(h.j.vinted.length));
    const s = monter();
    s.ctx.sansSessionPourEcrire = async () => true;
    await s.ctx.relireAnnoncesAutresComptes('111');
    dit(s.j.vinted.length === 0, 'sans session VRM (l\'écriture serait refusée) : rien ne part chez Vinted', String(s.j.vinted.length));
  });

  await essaie('B9 visite', async () => {
    // La VISITE entière : la moisson du compte connecté d'abord, puis les autres.
    const f = monter({ autre: (r) => {
      if (/\/api\/v2\/users\/current/.test(r.chemin)) return { status: 200, body: { user: { id: PID['111'], login: 'compte_111' } } };
      if (/\/api\/v2\/my_orders/.test(r.chemin)) return { status: 200, body: { my_orders: [], pagination: { total_entries: 0, total_pages: 0 } } };
      if (/\/api\/v2\/inbox/.test(r.chemin)) return { status: 200, body: { conversations: [], pagination: { current_page: 1 } } };
      return { status: 404, body: {} };
    } });
    await f.ctx.visiteVinted();
    const ch = f.j.vinted.map((x) => x.chemin);
    const iOwn = ch.findIndex((c) => c.includes(`/wardrobe/${PID['111']}/`));
    const iAutre = ch.findIndex((c) => /\/wardrobe\/(\d+)\//.test(c) && !c.includes(`/wardrobe/${PID['111']}/`));
    dit(iOwn >= 0 && iAutre > iOwn, 'la visite relit les autres comptes APRÈS la moisson du compte connecté', `propre ${iOwn} · autre ${iAutre}`);
    dit(!!f.lignes.harvest_333_enligne, 'et range leur lecture publique');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // C. Les files Leboncoin / eBay de l'extension suivent la règle
  // ══════════════════════════════════════════════════════════════════════════
  console.log('── C. Les files Leboncoin et eBay de l\'extension');
  await essaie('C', async () => {
    const T = Date.now();
    const NUM = { '1001': { numero: '101', title: 'Ancienne', mp: { lbc: true, ebay: true } }, '1009': { numero: '109', title: 'Republiée', mp: { lbc: true, ebay: true } },
      '3001': { numero: '301', title: 'Figée', mp: { lbc: true, ebay: true } } };
    const lignes = {
      main: { vinted_annonce_numeros: NUM, vinted_accounts_hidden: [], vinted_accounts: [{ vinted_user_id: '222', login: 'b' }, { vinted_user_id: '333', login: 'c' }] },
      vrm_blocked_accounts: { uids: [] },
      // 222 : dressing du 8 (l'ancienne 1001), lecture publique de ce matin (la republiée 1009)
      harvest_222_listings: { uid: '222', capturedAt: new Date(T - 72 * H).toISOString(), payload: { items: [art(1001)] } },
      harvest_222_enligne: { uid: '222', complet: true, source: 'public', capturedAt: new Date(T - 1 * H).toISOString(), ids: ['1009'], items: [art(1009, { title: 'Republiée' })] },
      // 333 : figé depuis 3 jours, personne ne l'a relu
      harvest_333_listings: { uid: '333', capturedAt: new Date(T - 72 * H).toISOString(), payload: { items: [art(3001)] } },
      vinted_lbc_posted: { ids: ['3001', '1001'] },
    };
    const f = faireFond({ src: BG, lignes, connecte: '111' });
    const lbc = await f.ctx.buildLbcData();
    const q = (lbc.queue || []).map((a) => String(a.numero)).sort().join(',');
    dit(q === '109', 'Leboncoin : la republiée est dans la file, l\'ancienne et celle « à confirmer » n\'y sont pas', q);
    const rem = (lbc.removals || []).map((r) => String(r.numero)).sort().join(',');
    dit(!rem.includes('301'), 'une paire « à confirmer » publiée sur Leboncoin n\'est PAS dite « à retirer » (on ne sait pas)', rem);
    dit(rem.includes('101'), 'l\'ancienne, absente de la lecture la plus récente, l\'est (« plus en ligne, à vérifier »)', JSON.stringify(lbc.removals));
    dit(lbc.stats && lbc.stats.aConfirmer === 1, 'le nombre « à confirmer » est rendu', JSON.stringify(lbc.stats && lbc.stats.aConfirmer));
    const eb = await faireFond({ src: BG, lignes: JSON.parse(JSON.stringify(lignes)), connecte: '111' }).ctx.buildEbayData();
    const qe = (eb.queue || []).map((a) => String(a.numero)).sort().join(',');
    dit(qe === '109' && eb.aConfirmer === 1, 'eBay : pareil', `${qe} · à confirmer ${eb.aConfirmer}`);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // D. Revue de la 5.167 — les défauts reproduits par la relecture
  // ══════════════════════════════════════════════════════════════════════════
  console.log('── D. Revue de la 5.167');
  // Une horloge pilotée DANS le vm (le service worker ne lit que `Date.now()`).
  const horloge = (f, t0) => { const h = { t: t0 }; f.ctx.__horloge = h; vm.runInContext('Date.now = function () { return globalThis.__horloge.t; };', f.ctx); return h; };
  const MIN = 60e3;

  await essaie('D1 frein sur UN compte', async () => {
    // 222 (le plus ancien) répond 403 à chaque lecture publique ; 333 et 444 répondent.
    const AGE4 = { '111': 0.1, '222': 90, '333': 40, '444': 30 };
    const l = { main: { vinted_accounts_hidden: [], vinted_accounts_blocked: [] }, vrm_blocked_accounts: { uids: [] } };
    for (const u of Object.keys(AGE4)) {
      l[`harvest_${u}_profile`] = { type: 'profile', capturedAt: iso(AGE4[u]), payload: { user: { id: PID[u] } } };
      l[`harvest_${u}_listings`] = { type: 'listings', uid: u, capturedAt: iso(AGE4[u]), payload: { items: [art(Number(u) * 10)] } };
    }
    const f = monter({ lignes: l, repondre: (pid) => (pid === String(PID['222']) ? { status: 403, body: {} } : null) });
    f.ctx.getStoredAccounts = async () => COMPTES.filter((c) => c.vinted_user_id in AGE4);
    const h = horloge(f, Date.now());
    const T0 = h.t; let paliers = [], enPause = 0;
    // Douze heures de visites : chaque fois à la fin de la pause (+6 min), sinon toutes les 31 min.
    while (h.t - T0 < 12 * H) {
      await f.ctx.relireAnnoncesAutresComptes('111');
      const p = f.store.vrmPauseVinted || {};
      const reste = Math.max(0, Number(p.jusqua || 0) - h.t);
      if (reste) paliers.push(p.niveau);
      enPause += reste;
      h.t += reste ? reste + 6 * MIN : 31 * MIN;
    }
    const n222 = lus(f).filter((p) => p === String(PID['222'])).length;
    dit(n222 === 1, 'un 403 sur le dressing public d’UN compte : ce compte n’est plus relu de la journée (une seule requête en 12 h)', `${n222} requête(s) vers 222`);
    dit(Math.max(0, ...paliers) <= 1, 'et la pause Vinted ne MONTE pas (palier 1, jamais 2 à 5)', JSON.stringify(paliers));
    dit(enPause <= 15 * MIN, 'au plus 15 min de pause sur 12 h — bordereaux et réponses ne sont pas bloqués', `${Math.round(enPause / MIN)} min de pause`);
    dit(comptesLus(f).includes('333') && comptesLus(f).includes('444'), 'les AUTRES comptes finissent par être relus', comptesLus(f).join(','));
    // Le lendemain, il est réessayé — une fois — et après les autres (échec récent).
    h.t = T0 + 25 * H;
    f.j.vinted.length = 0;
    await f.ctx.relireAnnoncesAutresComptes('111');
    const ordre = comptesLus(f);
    dit(ordre[0] !== '222' && ordre.includes('333') && ordre.includes('444'), 'le lendemain, le compte freiné passe APRÈS les autres (il ne prend plus leur place)', ordre.join(','));
  });

  await essaie('D1b 429 et second compte freiné', async () => {
    const f = monter({ repondre: () => ({ status: 429, body: {} }) });
    const h = horloge(f, Date.now());
    await f.ctx.relireAnnoncesAutresComptes('111');
    h.t += 20 * MIN; f.j.vinted.length = 0;
    await f.ctx.relireAnnoncesAutresComptes('111');
    dit(lus(f).length === 0, 'un 429 (« ralentis ») coupe TOUTE la relecture publique pour la journée', `${lus(f).length} requête(s) après la pause`);
    dit(f.j.diags.includes('enligne_coupee_frein'), 'et c’est noté (`enligne_coupee_frein`)', JSON.stringify(f.j.diags.filter((d) => /enligne_/.test(d))));
    // Deux comptes différents qui répondent 403 : c'est le lecteur, pas un compte.
    const g = monter({ repondre: (pid) => (pid === String(PID['333']) || pid === String(PID['444']) ? { status: 403, body: {} } : null) });
    const hg = horloge(g, Date.now());
    for (let i = 0; i < 4; i++) { await g.ctx.relireAnnoncesAutresComptes('111'); const p = g.store.vrmPauseVinted || {}; hg.t = Math.max(hg.t + 31 * MIN, Number(p.jusqua || 0) + 6 * MIN); }
    const freines = new Set(g.j.vinted.filter((x) => /wardrobe\/(9333|9444)\//.test(x.chemin)).map((x) => x.chemin.replace(/\?.*/, '')));
    dit(freines.size === 2 && !!((g.store.vrmEnLigneFreins || {})._tous), 'un second compte freiné dans les 24 h coupe la relecture du jour (au plus deux 403)', `${freines.size} compte(s) freiné(s) · coupure ${!!((g.store.vrmEnLigneFreins || {})._tous)}`);
  });

  // L'onglet quitte Vinted pendant la relecture (il clique vers Leboncoin dans cet onglet).
  const ongletQuiPart = (o = {}) => {
    const onglets = [{ id: 7, url: 'https://www.vinted.fr/', status: 'complete' }];
    const f = faireFond({ src: BG, lignes: baseLignes(), connecte: '111', comptes: COMPTES, store: {}, onglets,
      vinted: (r) => {
        const w = /\/api\/v2\/wardrobe\/(\d+)\/items\?page=(\d+)&per_page=(\d+)/.exec(r.chemin);
        if (!w) return { status: 404, body: {} };
        const tous = dressingPublic(w[1]); const per = Number(w[3]); const page = Number(w[2]);
        return { status: 200, body: { items: tous.slice((page - 1) * per, page * per).map((it) => Object.assign({ user_id: Number(w[1]) }, it)), pagination: { current_page: page, per_page: per, total_entries: tous.length, total_pages: Math.max(1, Math.ceil(tous.length / per)) } } };
      } });
    vm.runInContext(`lastCsrfByDomain['www.vinted.fr'] = 'CSRF-VINTED';`, f.ctx);
    const exec = f.ctx.chrome.scripting.executeScript;
    f.ctx.chrome.scripting.executeScript = async (x) => { const r = await exec(x); if (f.j.injections === 1) onglets[0].url = 'https://www.leboncoin.fr/'; return r; };
    if (o.menteur) f.ctx.chrome.tabs.get = async () => ({ id: 7, url: 'https://www.vinted.fr/', status: 'complete' });   // la navigation arrive APRÈS la vérification
    return f;
  };
  await essaie('D2 onglet qui quitte Vinted', async () => {
    const f = ongletQuiPart();
    await f.ctx.relireAnnoncesAutresComptes('111');
    dit(f.j.horsVinted.length === 0, 'l’onglet est passé sur leboncoin.fr : AUCUNE requête n’y part (ni jeton CSRF, ni identifiant Vinted)', JSON.stringify(f.j.horsVinted.map((x) => x.url)));
    dit(!(f.store.vrmPauseVinted && f.store.vrmPauseVinted.jusqua > Date.now()), 'aucune pause Vinted posée', JSON.stringify(f.store.vrmPauseVinted || null));
    dit(!!f.lignes.harvest_222_enligne && f.lignes.harvest_222_enligne.n === 149, 'la lecture se termine par le service worker (repli) : rangée, complète', JSON.stringify(f.lignes.harvest_222_enligne ? { n: f.lignes.harvest_222_enligne.n } : null));
    const g = ongletQuiPart({ menteur: true });
    await g.ctx.relireAnnoncesAutresComptes('111');
    dit(g.j.horsVinted.length === 0, 'la navigation arrive juste APRÈS la vérification : la page injectée refuse elle-même (aucune requête hors de Vinted)', JSON.stringify(g.j.horsVinted.map((x) => x.url)));
    const g2 = ongletQuiPart({ menteur: true });
    const st = g2.store;
    await g2.ctx.relireAnnoncesAutresComptes('111');
    dit(!(st.vrmPauseVinted && st.vrmPauseVinted.jusqua > Date.now()), 'et aucune pause Vinted : une réponse qui ne vient pas de Vinted ne freine pas Vinted', JSON.stringify(st.vrmPauseVinted || null));
    dit(!g2.lignes.harvest_222_enligne, 'rien n’est rangé sur une lecture coupée en route', JSON.stringify(Object.keys(g2.lignes).filter((k) => /_enligne$/.test(k))));
  });

  // Une lecture « déchirée » : la liste bouge entre deux pages.
  const dechire = (taille, quand, change) => {
    let L = Array.from({ length: taille }, (_, i) => art(1000 + i));
    let vues = 0;
    return monter({ repondre: (pid, page) => {
      if (pid !== String(PID['222'])) return null;
      vues++;
      if (vues === quand + 1) L = change(L);          // entre la page `quand` et la suivante
      const items = L.slice((page - 1) * 96, page * 96).map((it) => Object.assign({ user_id: PID['222'] }, it));
      return { status: 200, body: { items, pagination: { current_page: page, per_page: 96, total_entries: L.length, total_pages: Math.max(1, Math.ceil(L.length / 96)) } } };
    } });
  };
  await essaie('D3 lecture déchirée', async () => {
    const a = dechire(150, 1, (L) => L.filter((x) => x.id !== 1004));                       // suppression (page 1) entre p1 et p2
    await a.ctx.relireAnnoncesAutresComptes('111');
    dit(!a.lignes.harvest_222_enligne, 'une suppression entre la page 1 et la page 2 : la lecture n’est PAS complète, rien n’est rangé (l’annonce 1096, toujours en ligne, aurait manqué)', a.lignes.harvest_222_enligne ? `rangé n=${a.lignes.harvest_222_enligne.n}` : '');
    dit(a.j.diags.includes('enligne_incomplet_mouvant'), 'la cause est notée (`enligne_incomplet_mouvant`)', JSON.stringify(a.j.diags.filter((d) => /enligne_incomplet/.test(d))));
    const n222 = lus(a).filter((p) => p === String(PID['222'])).length;
    dit(n222 === 2, 'et elle s’arrête dès la page dont le total a changé (aucune requête Vinted de plus)', `${n222} requête(s) vers 222`);
    dit(Number(((a.store.vrmEnLigneEssais || {})['222'] || 0)) < Date.now() - 30 * 60e3 + 6 * 60e3, 'et ce compte réessaie dans 5 min', String((a.store.vrmEnLigneEssais || {})['222']));
    const b = dechire(150, 1, (L) => [art(5555)].concat(L.filter((x) => x.id !== 1004)));    // suppression + republication : même total
    await b.ctx.relireAnnoncesAutresComptes('111');
    dit(!b.lignes.harvest_222_enligne, 'une suppression ET une republication entre deux pages (même total) : la page 1 relue a changé, rien n’est rangé', b.lignes.harvest_222_enligne ? `rangé n=${b.lignes.harvest_222_enligne.n}, 5555 ${b.lignes.harvest_222_enligne.ids.includes('5555') ? 'présente' : 'ABSENTE'}` : '');
    const c = dechire(250, 2, (L) => L.filter((x) => x.id !== 1100));                       // 3 pages : suppression (page 2) entre p2 et p3
    await c.ctx.relireAnnoncesAutresComptes('111');
    dit(!c.lignes.harvest_222_enligne, 'trois pages, une suppression entre la page 2 et la page 3 (la page 1 ne bouge pas) : le total a changé, rien n’est rangé', c.lignes.harvest_222_enligne ? `rangé n=${c.lignes.harvest_222_enligne.n}` : '');
  });

  await essaie('D4 budget', async () => {
    // Il vient de republier : 30 annonces du compte connecté sans leurs photos.
    const l = baseLignes();
    l.vinted_item_details = {};
    l.harvest_111_listings = { type: 'listings', uid: '111', capturedAt: iso(0), nItems: 30, payload: { items: Array.from({ length: 30 }, (_, i) => art(110000 + i, { nPhotos: 6 })) } };
    const f = monter({ lignes: l, autre: (r) => (/^\/items\/\d+/.test(r.chemin) ? { status: 200, body: '<html><body>annonce</body></html>' } : { status: 404, body: {} }) });
    const h = horloge(f, Date.now());
    const T0 = h.t; let premiere = null; let photos0 = 0;
    for (let m = 0; m <= 20 && premiere == null; m++) {
      h.t = T0 + m * MIN;
      await f.ctx.tickPhotos();
      if (m === 0) photos0 = f.j.vinted.filter((x) => /^\/items\/\d+/.test(x.chemin)).length;
      if (m % 5 === 0) { const av = lus(f).length; await f.ctx.relireAnnoncesAutresComptes('111'); if (lus(f).length > av) premiere = m; }
    }
    dit(premiere != null && premiere <= 5, 'les photos à rattraper ne bloquent pas la relecture des autres comptes : elle part dans les 5 min', `première relecture à la minute ${premiere}`);
    dit(photos0 > 0, 'l’autre sens : les photos avancent quand même', `${photos0} page(s) photo à la minute 0`);
    const g = await f.ctx.gardeLecture('111', COMPTES[0], 'argent');
    dit(g === null, 'et l’argent et les colis gardent leur place', JSON.stringify(g));
  });

  await essaie('D5 lignes illisibles (files de l’extension)', async () => {
    const T = Date.now();
    const NUM = { '1001': { numero: '101', mp: { lbc: true, ebay: true } }, '1002': { numero: '102', mp: { lbc: true, ebay: true } },
      '2001': { numero: '201', mp: { lbc: true, ebay: true } }, '2002': { numero: '202', mp: { lbc: true, ebay: true } }, '2003': { numero: '203', mp: { lbc: true, ebay: true } } };
    // 111 (connecté, lu il y a 12 min) : 1001 (publiée sur Leboncoin), 1002.
    // 222 (dressing de 10 h) : 2001, 2002 (publiée), 2003 ; sa lecture publique d'il y a 30 min ne montre plus 2002.
    const lignes = () => ({
      main: { vinted_annonce_numeros: NUM, vinted_accounts_hidden: [], vinted_accounts: [{ vinted_user_id: '111' }, { vinted_user_id: '222' }] },
      vrm_blocked_accounts: { uids: [] },
      harvest_111_listings: { uid: '111', capturedAt: new Date(T - 0.2 * H).toISOString(), payload: { items: [art(1001), art(1002)] } },
      harvest_222_listings: { uid: '222', capturedAt: new Date(T - 10 * H).toISOString(), payload: { items: [art(2001), art(2002), art(2003)] } },
      harvest_222_enligne: { uid: '222', complet: true, source: 'public', capturedAt: new Date(T - 0.5 * H).toISOString(), ids: ['2001', '2003'], items: [art(2001), art(2003)] },
      vinted_lbc_posted: { ids: ['1001', '2002'] },
    });
    const q = (x) => (x.queue || []).map((a) => String(a.numero)).sort().join(',');
    const rm = (x) => (x.removals || []).map((r) => String(r.numero)).sort().join(',');
    // Témoin : tout est lisible.
    const t0 = await faireFond({ src: BG, lignes: lignes(), connecte: '111' }).ctx.buildLbcData();
    dit(q(t0) === '102,201,203' && rm(t0) === '202', 'témoin, tout lisible : file 102, 201, 203 · 202 (partie) « à retirer de Leboncoin »', `${q(t0)} · ${rm(t0)}`);
    // Dressings ILLISIBLES : ni file, ni « à retirer ».
    const f = faireFond({ src: BG, lignes: lignes(), connecte: '111', lectureKO: (u) => /harvest_\*_listings/.test(u) });
    const lbc = await f.ctx.buildLbcData();
    dit(rm(lbc) === '', 'dressings illisibles : aucune paire dite « à retirer de Leboncoin »', rm(lbc));
    dit(!!(lbc.stats && lbc.stats.lecturesKO) && q(lbc) === '', 'et la file le DIT (`lecturesKO`), sans rien proposer', JSON.stringify(lbc.stats));
    const eb = await f.ctx.buildEbayData();
    dit(!!eb.lecturesKO && q(eb) === '', 'eBay pareil', JSON.stringify({ k: eb.lecturesKO, q: q(eb) }));
    // Lectures publiques ILLISIBLES (service worker neuf, aucune connue) : le dressing de 10 h ne redécide pas.
    const g = faireFond({ src: BG, lignes: lignes(), connecte: '111', lectureKO: (u) => /harvest_\*_enligne/.test(u) });
    const lbc2 = await g.ctx.buildLbcData();
    dit(!/20/.test(q(lbc2)), 'lectures publiques illisibles : les annonces de 222 (dressing de 10 h) ne sont plus proposées — « à confirmer »', q(lbc2));
    dit(q(lbc2) === '102', 'l’autre sens : le compte lu il y a 12 min reste dans la file', q(lbc2));
    dit(rm(lbc2) === '', 'et rien de « à confirmer » n’est dit « à retirer »', rm(lbc2));
    dit(lbc2.stats && lbc2.stats.aConfirmer === 3, 'le nombre « à confirmer » est rendu', JSON.stringify(lbc2.stats && lbc2.stats.aConfirmer));
    // Une lecture réussie puis une ratée : la dernière connue sert.
    let ko = false;
    const k = faireFond({ src: BG, lignes: lignes(), connecte: '111', lectureKO: (u) => ko && /harvest_\*_enligne/.test(u) });
    await k.ctx.buildLbcData(); ko = true;
    const lbc3 = await k.ctx.buildLbcData();
    dit(q(lbc3) === '102,201,203' && rm(lbc3) === '202', 'une lecture ratée après une lecture réussie : la dernière connue sert (2002 reste partie)', `${q(lbc3)} · ${rm(lbc3)}`);
  });

  try { fs.unlinkSync(BG); } catch (_) {}
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
