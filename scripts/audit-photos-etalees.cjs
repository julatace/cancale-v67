// ════════════════════════════════════════════════════════════════════════════
//  LES PHOTOS DE FOND NE FONT PLUS FREINER VINTED (22 octobre)
//
//  MESURÉ chez Julien (`panel_diag_capture`, extension 5.211, lecture seule) :
//  `vinted_frein_429` = 23 = `photos_page_refuse_429` = 23 — tous les « trop de
//  demandes » venaient d'une page d'annonce lue pour ses photos ; paliers de
//  pause 1/2/3 : 24/2/1 ; `visite_en_pause` = 119 visites sautées. Cause : jusqu'à
//  20 pages d'affilée, sans écart, chaque minute ET à la fin de chaque visite.
//
//  On EXÉCUTE le vrai `background.js` (`_fond-vm.cjs`, horloge PILOTÉE) et on
//  COMPTE les pages `/items/{id}` qui partent chez Vinted :
//   1. l'alarme d'une minute ne lit qu'UNE page par tour, jamais deux à moins de
//      45 s (un écart FIXE, aucun hasard — §3) ; le total horaire ne monte pas ;
//   2. la visite ne lit plus aucune page photo ;
//   3. rien pendant qu'il navigue sur Vinted (2 min de calme, vu par les onglets) ;
//   4. un 429 / 403 sur une page photo : plus aucune page photo de fond pendant
//      24 h — et le reste de l'extension suit la pause habituelle (15 min) ;
//   5. le clic « Publier » reste prioritaire (ni écart, ni calme, ni frein photos) ;
//   6. les fiches lues partent en UNE écriture pour 5 pages (§4.4), et une base
//      qui ne répond pas ne perd rien (la file vit dans chrome.storage.local).
//  §6.1 : chaque règle est RÉAFFAIBLIE dans une copie du fichier et le contrôle
//  correspondant doit alors rougir (« la fonction n'existait pas » ne prouve rien).
//  Données inventées. Usage : node scripts/audit-photos-etalees.cjs [--src f]
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const SRC = cheminSource();
const TEXTE = fs.readFileSync(SRC, 'utf8');

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}${det ? ' — ' + det : ''}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

const UID = '111', PID = 9001, MIN = 60e3, H = 3600e3;
const html = (id) => '<!doctype html><script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({ props: { pageProps: { item: {
  id: Number(id), description: 'desc ' + id, catalog_id: 1, photos: [0, 1, 2, 3, 4].map((i) => ({ id: i, full_size_url: `https://images1.vinted.net/t/p${id}_${i}/f800/${id}${i}.jpg` })) } } } }) + '</script>';
const FINALISEE = "Commande finalisée - l'acheteur a validé la commande";
function lignes(n = 30) {
  return {
    [`harvest_${UID}_orders_sold`]: { capturedAt: new Date().toISOString(), payload: { my_orders: Array.from({ length: 3 }, (_, i) => ({ transaction_id: 5001 + i, title: 'Vente ' + i, status: FINALISEE })) } },
    [`harvest_${UID}_orders_purchased`]: { capturedAt: new Date().toISOString(), payload: { my_orders: [] } },
    panel_colis_relais: {},
    [`harvest_${UID}_profile`]: { payload: { user: { id: PID } } },
    [`harvest_${UID}_listings`]: { capturedAt: new Date().toISOString(), payload: { items: Array.from({ length: n }, (_, i) => ({ id: 800 + i, nPhotos: 5, is_closed: false, is_hidden: false })) } },
    vinted_item_details: {},
  };
}
function vintedOk(r) {
  const c = r.chemin; let m;
  if ((m = /^\/items\/(\d+)$/.exec(c))) return { status: 200, body: html(m[1]) };
  if ((m = /\/api\/v2\/transactions\/(\d+)$/.exec(c))) return { status: 200, body: { transaction: { id: Number(m[1]), status: 450, status_updated_at: '2026-10-01T10:00:00Z' } } };
  if (/\/api\/v2\/users\/current/.test(c)) return { status: 200, body: { user: { id: PID, login: 'compte_banc' } } };
  if (/\/my_orders/.test(c)) return { status: 200, body: { my_orders: [], pagination: { total_entries: 0 } } };
  if (/\/inbox/.test(c)) return { status: 200, body: { conversations: [] } };
  // Le dressing relu par la moisson : les mêmes 30 annonces (sinon la visite rangerait un dressing vide
  // et il n'y aurait plus rien à compléter — le contrôle de la visite serait vert pour une mauvaise raison).
  if (/\/wardrobe\//.test(c)) return { status: 200, body: { items: Array.from({ length: 30 }, (_, i) => ({ id: 800 + i, title: 'Paire ' + i, photos: [0, 1, 2, 3, 4].map((k) => ({ id: k, url: 'https://images1.vinted.net/t/c/f800/' + k })), is_closed: false, is_hidden: false, is_draft: false })), pagination: { total_pages: 1, total_entries: 30, current_page: 1 } } };
  return { status: 404, body: {} };
}
const pages = (j) => j.vinted.filter((x) => /^\/items\/\d+$/.test(x.chemin)).length;

// Le fond, sur une copie du fichier (mutation), avec l'horloge pilotée.
function monter(src, { lignesInit = lignes(), vinted = vintedOk, store = {}, t0 = Date.now(), duesNulles = true } = {}) {
  if (duesNulles) store.vrmLecturesDues = { [UID]: Object.fromEntries(['versement', 'releve', 'retrait', 'preuve', 'enligne'].map((k) => [k, { reste: 0, at: t0 }])) };
  const f = faireFond({ src, lignes: lignesInit, vinted, store, connecte: UID });
  f.h = { t: t0 }; f.ctx.__horloge = f.h;
  vm.runInContext('Date.now = function () { return globalThis.__horloge.t; };', f.ctx);
  return f;
}
// Une copie mutée du fichier (§6.1) ; `null` si le motif n'existe plus.
const COPIES = [];
function muter(motif, rempl) {
  if (!TEXTE.includes(motif)) return null;
  const p = path.join(os.tmpdir(), `bg-photos-mut-${process.pid}-${COPIES.length}.js`);
  fs.writeFileSync(p, TEXTE.split(motif).join(rempl));
  COPIES.push(p);
  return p;
}

// ── Les scénarios rendent ce qu'ils mesurent ; les contrôles jugent. ────────
async function scenarioEtalement(src) {
  const f = monter(src);
  const parTour = [];
  for (let m = 0; m < 30; m++) {
    f.h.t += MIN;
    const av = pages(f.j);
    await f.ctx.tickPhotos();
    await f.ctx.tickPhotos();                     // un réveil de plus dans la même minute (minuterie de secours)
    parTour.push(pages(f.j) - av);
  }
  return { parTour, total: pages(f.j), maxEnVol: f.j.maxEnVol, lectures: ((f.store.vrmLectures || {})[UID] || []).length };
}
async function scenarioVisite(src) {
  const f = monter(src, { duesNulles: false });
  await f.ctx.visiteVinted();
  return { pages: pages(f.j), requetes: f.j.vinted.length };
}
async function scenarioCalme(src) {
  const f = monter(src);
  const T0 = f.h.t;
  f.ongletMaj(7, { url: 'https://www.vinted.fr/catalog?search_text=nike' }, { id: 7, url: 'https://www.vinted.fr/catalog?search_text=nike' });
  await new Promise((r) => setTimeout(r, 10));
  const lus = [];
  for (const s of [30, 90, 125]) { f.h.t = T0 + s * 1000; const av = pages(f.j); await f.ctx.tickPhotos(); lus.push(pages(f.j) - av); }
  return { lus };
}
async function scenarioFrein(src, statut) {
  let refuse = true;
  const f = monter(src, { vinted: (r) => (/^\/items\/\d+$/.test(r.chemin) && refuse ? { status: statut, body: '<html>Too Many</html>' } : vintedOk(r)) });
  const T0 = f.h.t;
  await f.ctx.tickPhotos();
  const premier = pages(f.j);
  const pause = f.store.vrmPauseVinted || null;
  const frein = f.store.vrmPhotosFrein || null;
  refuse = false;                                  // Vinted répondrait de nouveau
  f.h.t = T0 + 16 * MIN;                           // la pause habituelle (15 min) est finie
  const av1 = pages(f.j);
  for (let i = 0; i < 5; i++) { f.h.t += MIN; await f.ctx.tickPhotos(); }
  const pendantFrein = pages(f.j) - av1;
  const avV = f.j.vinted.filter((x) => /\/transactions\//.test(x.chemin)).length;
  await f.ctx.capterDatesVersement(UID);
  const versements = f.j.vinted.filter((x) => /\/transactions\//.test(x.chemin)).length - avV;
  const avC = pages(f.j);
  const clic = await f.ctx.completerPhotos(UID, '829');
  const clicPages = pages(f.j) - avC;
  f.h.t = T0 + 24 * H + 2 * MIN;                   // 24 h plus tard
  f.store.vrmPhotosCooldown = {};
  const av2 = pages(f.j);
  await f.ctx.tickPhotos();
  const apres24h = pages(f.j) - av2;
  return { premier, pause, frein, pendantFrein, versements, clic, clicPages, apres24h, diags: f.j.diags };
}
async function scenarioClicPendantNavigation(src) {
  const f = monter(src);
  f.ongletMaj(7, { status: 'loading' }, { id: 7, url: 'https://www.vinted.fr/items/829' });
  await new Promise((r) => setTimeout(r, 10));
  const av = pages(f.j);
  const ok1 = await f.ctx.completerPhotos(UID, '829');
  return { ok: ok1, pages: pages(f.j) - av };
}
async function scenarioLot(src, { lectureKO = false } = {}) {
  let ko2 = lectureKO;
  const f = faireFond({ src, lignes: lignes(12), vinted: vintedOk, connecte: UID,
    lectureKO: (u) => ko2 && /vinted_item_details/.test(u) && !/listings/.test(u),
    store: { vrmLecturesDues: { [UID]: Object.fromEntries(['versement', 'releve', 'retrait', 'preuve', 'enligne'].map((k) => [k, { reste: 0, at: Date.now() }])) } } });
  // Le plan se lit une fois (base debout), puis les écritures ratent si `lectureKO`.
  if (lectureKO) { ko2 = false; await f.ctx.planPhotos(UID); ko2 = true; }
  const ecrits = () => f.j.posts.filter((ids) => ids.includes('vinted_item_details')).length;
  for (let i = 0; i < 5; i++) await f.ctx.capterPhotosAnnonces(UID);
  const res = { pages: pages(f.j), ecrituresApres5: ecrits(), rangees: Object.keys(f.lignes.vinted_item_details || {}).length,
    enAttente: (f.store.vrmFichesAttente || []).length };
  if (lectureKO) { ko2 = false; await f.ctx.viderFiches({ force: true }); res.rangeesApresRetour = Object.keys(f.lignes.vinted_item_details || {}).length; res.enAttenteApresRetour = (f.store.vrmFichesAttente || []).length; }
  return res;
}

(async () => {
  console.log('── 1. une page par minute, jamais deux à moins de 45 s, le total horaire ne monte pas');
  await essaie('étalement', async () => {
    const r = await scenarioEtalement(SRC);
    dit(Math.max(...r.parTour) <= 1, 'chaque tour d’alarme (et un réveil de plus dans la même minute) lit AU PLUS une page', `pages par minute : ${r.parTour.join(',')}`);
    dit(r.total === 20, 'sur 30 minutes, 20 pages : le budget de lecture (20/h) n’a pas bougé, il est seulement étalé', `${r.total} page(s)`);
    dit(r.lectures <= 20 && r.maxEnVol === 1, 'jamais plus de 20 lectures dans l’heure, jamais deux requêtes en vol', `lectures=${r.lectures} · en vol=${r.maxEnVol}`);
  });

  console.log('── 2. la visite ne lit plus de page photo');
  await essaie('visite', async () => {
    const r = await scenarioVisite(SRC);
    dit(r.requetes > 0 && r.pages === 0, 'une visite sur Vinted (ventes, moisson, lecteurs) : aucune page /items/{id}', `${r.pages} page(s) photo sur ${r.requetes} requête(s)`);
  });

  console.log('── 3. rien pendant qu’il navigue sur Vinted');
  await essaie('calme', async () => {
    const r = await scenarioCalme(SRC);
    dit(r.lus[0] === 0 && r.lus[1] === 0, 'une page Vinted vient de changer : aucune page photo à 30 s ni à 90 s', r.lus.join(','));
    dit(r.lus[2] === 1, 'l’autre sens : 2 min après sa dernière navigation, la capture reprend', r.lus.join(','));
  });

  console.log('── 4. un refus de Vinted sur une page photo : 24 h sans photo de fond');
  for (const statut of [429, 403]) {
    await essaie(`frein ${statut}`, async () => {
      const r = await scenarioFrein(SRC, statut);
      dit(r.premier === 1 && r.pause && r.pause.statut === statut, `${statut} : la pause habituelle est posée (le reste de l’extension la suit)`, JSON.stringify(r.pause));
      dit(!!(r.frein && r.frein.statut === statut) && r.diags.includes(`photos_frein_${statut}`), `et le frein des photos est rangé dans chrome.storage.local, et dit au diagnostic`, JSON.stringify(r.frein));
      dit(r.pendantFrein === 0, 'pause finie : AUCUNE page photo de fond tant que les 24 h ne sont pas passées', `${r.pendantFrein} page(s)`);
      dit(r.versements > 0, 'l’autre sens : les versements (le reste de l’extension) repartent dès la fin de la pause habituelle', `${r.versements} lecture(s)`);
      dit(r.clic === true && r.clicPages === 1, 'le clic « Publier » reste prioritaire : il lit SA page malgré le frein des photos', `rendu=${r.clic} · ${r.clicPages} page`);
      dit(r.apres24h === 1, '24 h plus tard, la capture de fond reprend (une page)', `${r.apres24h}`);
    });
  }

  console.log('── 5. le clic n’attend ni le calme ni l’écart');
  await essaie('clic', async () => {
    const r = await scenarioClicPendantNavigation(SRC);
    dit(r.ok === true && r.pages === 1, 'il navigue sur Vinted et clique « Publier » : sa page est lue tout de suite', `rendu=${r.ok} · ${r.pages} page`);
  });

  console.log('── 6. une écriture pour cinq pages, et rien de perdu si la base ne répond pas');
  await essaie('lot', async () => {
    const r = await scenarioLot(SRC);
    dit(r.pages === 5 && r.ecrituresApres5 === 1 && r.rangees === 5 && r.enAttente === 0, 'cinq pages lues : UNE écriture de vinted_item_details, avec les cinq fiches', JSON.stringify(r));
    const k = await scenarioLot(SRC, { lectureKO: true });
    dit(k.ecrituresApres5 === 0 && k.enAttente === 5, 'la ligne ne se relit pas au moment d’écrire : rien n’est écrit, les cinq fiches restent en file', JSON.stringify(k));
    dit(k.rangeesApresRetour === 5 && k.enAttenteApresRetour === 0, 'la base revenue : les cinq sont rangées, sans relire Vinted', JSON.stringify(k));
  });

  console.log('── 7. §6.1 — chaque règle, réaffaiblie, fait rougir son contrôle');
  const MUT = [
    { nom: 'sans écart fixe (deux pages dans la même minute)', motif: 'if (depuisPage >= 0 && depuisPage < PHOTOS_ECART_MS) return;', rempl: '',
      mord: async (s) => { const r = await scenarioEtalement(s); return Math.max(...r.parTour) > 1; } },
    { nom: 'vingt pages par tour (l’ancien débit)', motif: 'const PHOTOS_PAR_TOUR = 1;', rempl: 'const PHOTOS_PAR_TOUR = 20;',
      mord: async (s) => { const r = await scenarioEtalement(s); return Math.max(...r.parTour) > 1; } },
    { nom: 'sans le calme (lecture pendant qu’il navigue)', motif: "if (depuisNav >= 0 && depuisNav < PHOTOS_CALME_MS) { noterDiag('photos_attend_navigation'); return; }", rempl: '',
      mord: async (s) => { const r = await scenarioCalme(s); return r.lus[0] > 0 || r.lus[1] > 0; } },
    { nom: 'sans le frein de 24 h', motif: 'return (at > 0 && Date.now() - at < PHOTOS_FREIN_MS) ? f : null;', rempl: 'return null;',
      mord: async (s) => { const r = await scenarioFrein(s, 429); return r.pendantFrein > 0; } },
    { nom: 'les photos remises dans la visite', motif: '    await relireAnnoncesAutresComptes(uid);\n', rempl: '    await relireAnnoncesAutresComptes(uid);\n    await capterPhotosAnnonces(uid, 20);\n',
      mord: async (s) => { const r = await scenarioVisite(s); return r.pages > 0; } },
    { nom: 'le frein appliqué au clic', motif: "const refus = await gardeLecture(uid, acc, 'clic');", rempl: "if (await freinPhotos()) return false; const refus = await gardeLecture(uid, acc, 'clic');",
      mord: async (s) => { const r = await scenarioFrein(s, 429); return !(r.clic === true && r.clicPages === 1); } },
    { nom: 'une écriture par page (le lot retiré)', motif: 'file.length >= FICHES_LOT ||', rempl: 'file.length >= 1 ||',
      mord: async (s) => { const r = await scenarioLot(s); return r.ecrituresApres5 !== 1; } },
  ];
  for (const m of MUT) {
    await essaie(`mutation ${m.nom}`, async () => {
      const p = muter(m.motif, m.rempl);
      if (!p) { dit(false, `mutation « ${m.nom} » : motif introuvable — l’audit ne prouve plus rien`); return; }
      dit(await m.mord(p), `réaffaibli (${m.nom}) : le contrôle rougit`);
    });
  }

  // ── 8. Seul le tour d'alarme appelle la capture de fond (la règle tient par là).
  {
    // Les lignes de commentaire sont retirées (un commentaire qui CITE l'appel n'est pas un appel).
    const code = TEXTE.split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
    const appels = [...code.matchAll(/capterPhotosAnnonces\(/g)].length;
    dit(appels === 2, 'capterPhotosAnnonces n’est appelée QUE par tickPhotos (sa définition + un appel)', `${appels} occurrence(s) dans le code`);
  }

  for (const p of COPIES) { try { fs.unlinkSync(p); } catch (_) {} }
  console.log(`\n${ko ? '❌' : '✅'} photos étalées : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
