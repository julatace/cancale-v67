#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  « ON FAIT ABSOLUMENT TOUT COMME BLEAM » (décision de Julien du 20 nov., ext. 5.410.3)
//  — `repubformulaire` (republication par le formulaire de Vinted) et `favorisbleam`.
//
//  Le VRAI background.js dans un vm (scripts/_fond-vm.cjs, minuteries écrasées : les
//  pauses se COMPTENT, elles ne se vivent pas). La page de Vinted est un FAUX formulaire
//  (`__vrmFormulaire`, la même interface que vinted-sync-extension/vrm-formulaire.js) qui
//  note chaque étape et bâtit son brouillon à partir des champs QUE VRM A SAISIS — jamais
//  le vrai Vinted. Données inventées (dépôt public). Le formulaire réel est jugé, lui, par
//  scripts/bancs/repub-formulaire.cjs (Playwright, fausse page vinted.fr).
//    R1–R14  la republication par le formulaire (méthode par défaut)
//    F1–F9   les favoris « comme Bleam » (séquence par défaut)
//  `--prouve` : rouge sur origin/main (la fonction n'y est pas) ET par mutation (chaque
//  règle réaffaiblie dans une copie de background.js ⇒ rouge).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const RACINE = path.join(__dirname, '..');
const argBg = (() => { const i = process.argv.indexOf('--bg'); return i > 0 ? process.argv[i + 1] : process.env.BG_SRC || ''; })();
const BG = argBg ? path.resolve(argBg) : path.join(RACINE, 'vinted-sync-extension', 'background.js');
const SILENCE = !!process.env.SILENCE;
let ok = 0, ko = 0; const rouges = [];
const dit = (c, m, d) => { if (c) { ok++; if (!SILENCE) console.log('✅ ' + m); } else { ko++; rouges.push(m); if (!SILENCE) console.log('❌ ' + m + (d ? '  → ' + String(d).slice(0, 400) : '')); } };
const nowISO = () => new Date().toISOString();
const UID = '111';
const MODELE = JSON.stringify({ item: { id: 9101, title: 'Basket test 42', description: 'Très bon état, boîte', price: '60.0', currency: 'EUR', catalog_id: 1234, brand_id: 53, brand: 'Marque test', color_ids: [1], item_attributes: [{ code: 'size', ids: [56] }, { code: 'condition', ids: [2] }], package_size_id: 1, assigned_photos: [{ id: 1 }] } });
const PHOTOS = ['https://images1.vinted.net/t/01_0121e_testAAAA0001/f800/1.jpeg', 'https://images1.vinted.net/t/02_02248_testBBBB0002/f800/2.jpeg'];
const CATALOGUE = JSON.stringify({ catalogs: [{ id: 1, title: 'Hommes', catalogs: [{ id: 1234, title: 'Baskets test' }] }] });

// ── LA FAUSSE PAGE DU FORMULAIRE ────────────────────────────────────────────
// o.page(etape, d, f) peut remplacer une réponse (captcha, élément absent, refus…).
function monterRepub(o = {}) {
  const v = { ancienne: 'en-ligne', brouillon: null };
  const lignes = { main: { capturedAt: nowISO(), vinted_annonce_numeros: { '9101': { numero: '41' } } }, vinted_item_details: {}, vrm_vinted_modele: { '9101': { corps: MODELE, at: nowISO(), uid: UID } }, vinted_catalogue: { corps: CATALOGUE } };
  lignes.coffre_111_9101 = { id: '9101', uid: UID, title: 'Basket test 42', price: 60, desc: 'Très bon état, boîte', photos: PHOTOS, ...(o.vb ? { versBrouillon: o.vb } : {}) };
  const store = o.store || (o.defaut === false ? {} : { __commeBleamDefaut: true });
  const f = faireFond({ src: BG, lignes, connecte: o.connecte || UID, store, cdn: () => ({ status: 200 }),
    vinted: (e) => {
      if (e.methode === 'GET' && /\/item_upload\/(colors)$/.test(e.chemin)) return { status: 404, body: {} };
      if (e.methode === 'POST' && /\/item_upload\/attributes$/.test(e.chemin)) return { status: 404, body: {} };
      if (e.methode === 'GET' && /\/api\/v2\/item_upload\/items\/9101$/.test(e.chemin)) return v.ancienne === 'en-ligne' ? { status: 200, body: { item: { id: 9101, is_draft: false } } } : { status: 404, body: {} };
      if (e.methode === 'GET' && /\/api\/v2\/item_upload\/items\/88001$/.test(e.chemin)) return { status: 200, body: { item: { id: 88001, is_draft: v.brouillon !== 'en-ligne', photos: [{ id: 701 }, { id: 702 }] } } };
      if (e.methode === 'POST' && /\/api\/v2\/photos$/.test(e.chemin)) return { status: 200, body: { id: 501 } };
      if (e.methode === 'POST' && /\/api\/v2\/item_upload\/drafts\/?$/.test(e.chemin)) return { status: 200, body: { draft: { id: 88001 } } };
      if (e.methode === 'POST' && /\/drafts\/\d+\/completion$/.test(e.chemin)) { v.brouillon = 'en-ligne'; return { status: 200, body: { item: { id: 88001 } } }; }
      if (e.methode === 'POST' && /\/api\/v2\/items\/9101\/delete$/.test(e.chemin)) { v.ancienne = 'partie'; return { status: 200, body: {} }; }
      return { status: 404, body: {} };
    } });
  f.v = v; f.pas = []; f.saisis = {};
  f.ctx.__vrmPausesVues = [];
  f.ctx.__vrmFormulaire = async (etape, d) => {
    const chemin = (f.ctx.location && f.ctx.location.pathname) || '';
    f.pas.push({ etape, quoi: d && d.quoi, chemin, d: d && d.quoi ? d : undefined, nPhotos: d && Array.isArray(d.photos) ? d.photos.length : undefined });
    if (o.page) { const x = await o.page(etape, d, f); if (x !== undefined) return x; }
    if (etape === 'ouvrirVente') { const t = f.ctx.chrome.tabs; void t; return { ok: true, chemin: '/items/new' }; }
    if (etape === 'photos') return { ok: true, n: d.photos.length };
    if (etape === 'champ') { f.saisis[d.quoi] = d; return { ok: true }; }
    if (etape === 'brouillon') {
      const s = f.saisis;
      const draft = { id: null, title: s.titre && s.titre.valeur, description: s.description && s.description.valeur, price: s.prix && String(s.prix.valeur), catalog_id: s.categorie && s.categorie.id, brand_id: s.marque && s.marque.id, color_ids: s.couleurs && s.couleurs.ids, package_size_id: s.colis && s.colis.id, item_attributes: [{ code: 'size', ids: s.taille ? [s.taille.id] : [] }, { code: 'condition', ids: s.etat ? [s.etat.id] : [] }] };
      return { ok: true, rep: { status: 200, ok: true, json: { draft: { id: 88001 } }, corps: JSON.stringify({ draft }) } };
    }
    if (etape === 'supprimer') { v.ancienne = 'partie'; return { ok: true, rep: { status: 200, ok: true, json: { code: 0 } } }; }
    if (etape === 'formulairePret') return { ok: true };
    if (etape === 'publier') { v.brouillon = 'en-ligne'; return { ok: true, rep: { status: 200, ok: true, json: { item: { id: 88001 } } } }; }
    if (etape === 'reponse') return { ok: false, code: 'sans-reponse' };
    return { ok: false, code: 'etape' };
  };
  return f;
}
const recreer = (f, x = {}) => f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: UID, id: '9101', num: '41', prix: 54, titre: 'Basket test 42', confirme: true, ...x }).catch((e) => ({ erreur: String(e && e.stack || e) }));
const reprendre = (f, x = {}) => f.ctx.reprendreRepub({ cmd: 'reprendreRepub', uid: UID, id: '9101', num: '41', confirme: true, ...x }).catch((e) => ({ erreur: String(e && e.stack || e) }));
const vb = (f) => (f.lignes.coffre_111_9101 && f.lignes.coffre_111_9101.versBrouillon) || {};
const pasNoms = (f) => f.pas.map((p) => p.etape === 'champ' ? p.quoi : p.etape);
const gestesDirects = (f) => f.j.vinted.filter((x) => x.methode === 'POST' && /drafts|delete|completion|\/photos$/.test(x.chemin));
const places = (f) => ((f.store.vrmActions || {})[UID] || []).filter((t) => Date.now() - Number(t) < 3600000).length;
const pausesChamp = (f) => (f.ctx.__vrmPausesVues || []).filter((x) => x[0] === 'formulaire:champ').map((x) => x[1]);

async function auditerRepub() {
  // R1 — l'ordre exact, tout par la page (aucune requête-geste du service worker)
  { const f = monterRepub(); const r = await recreer(f);
    const s = pasNoms(f).join(' > ');
    const attendu = 'ouvrirVente > photos > categorie > titre > description > marque > taille > couleurs > colis > etat > prix > brouillon > supprimer > formulairePret > publier';
    dit(r && r.etape === 'fait' && r.methode === 'formulaire' && s === attendu, 'R1 — par défaut, le formulaire : Vends tes articles, photos, catégorie, titre, description, marque, taille, couleurs, colis, état, prix, brouillon, suppression, Ajouter', `${s} | ${JSON.stringify(r).slice(0, 300)}`);
    dit(gestesDirects(f).length === 0, 'R1b — aucun brouillon / suppression / mise en ligne / photo envoyé par le service worker : c’est la page qui envoie', JSON.stringify(gestesDirects(f).map((x) => x.chemin)));
    const nav = (f.j.navigations || []).map((x) => new URL(x.url).pathname);
    dit(JSON.stringify(nav) === JSON.stringify(['/items/9101/edit', '/items/9101', '/items/88001/edit']), 'R2 — les pages : « Modifier » de l’ancienne (lecture), l’ancienne (Supprimer), le brouillon (Ajouter)', JSON.stringify(nav));
    const iB = f.pas.findIndex((p) => p.etape === 'brouillon'), iS = f.pas.findIndex((p) => p.etape === 'supprimer'), iP = f.pas.findIndex((p) => p.etape === 'publier');
    const e = vb(f).etapes || {}; const t = (x) => Date.parse(x || '');
    dit(iB < iS && iS < iP && t(e.coffre) <= t(e.brouillon) && t(e.brouillon) <= t(e.supprimee) && t(e.supprimee) <= t(e.enLigne) && vb(f).etat === 'fait' && vb(f).methode === 'formulaire', 'R3 — coffre → brouillon → suppression → mise en ligne, chaque étape datée sur sa preuve (jamais inversé)', JSON.stringify({ iB, iS, iP, e, etat: vb(f).etat }));
    const p = pausesChamp(f);
    const egales = p.some((x, i) => i > 0 && Math.round(x / 250) === Math.round(p[i - 1] / 250));
    dit(p.length >= 11 && p.every((x) => x >= 5000 && x <= 15000) && !egales, `R4 — ${p.length} pauses entre deux champs, toutes entre 5 et 15 s, jamais deux fois la même`, JSON.stringify(p));
    const ph = f.pas.find((x) => x.etape === 'photos');
    dit(ph && ph.nPhotos === 2, 'R5 — les photos du coffre (2) déposées dans le champ de fichiers', JSON.stringify(ph));
    const sai = f.saisis;
    dit(sai.categorie && sai.categorie.id === 1234 && sai.categorie.nom === 'Baskets test' && sai.taille.id === 56 && sai.etat.id === 2 && sai.colis.id === 1 && JSON.stringify(sai.couleurs.ids) === '[1]' && sai.prix.valeur === 54 && sai.titre.valeur === 'Basket test 42' && sai.marque.id === 53, 'R6 — tous les champs de la fiche recopiés (catégorie par son identifiant et son nom du catalogue, taille, état, colis, couleur, marque, prix, titre)', JSON.stringify(sai));
    dit(places(f) === 3, 'R7 — la paire compte 3 gestes (brouillon, suppression, mise en ligne), réservés d’un coup', places(f));
    const ot = f.store.vrmOngletTravail; const cree = (f.j.ongletsCrees || [])[0];
    dit(cree && cree.active === false && ot && ot.tabId === cree.id && (f.j.fichiers || []).every((x) => x.tabId === cree.id && x.files[0] === 'vrm-formulaire.js'), 'R8 — un onglet vinted.fr en arrière-plan travaille (nommé : vrmOngletTravail), le script n’est injecté que là', JSON.stringify({ cree, ot }));
    const n0 = f.pas.length; const r2 = await reprendre(f);
    dit(r2 && r2.deja === true && f.pas.length === n0, 'R9 — « Reprendre » une paire faite : rien n’est refait', JSON.stringify(r2)); }

  // R10 — captcha pendant le titre : arrêt net, rien d'écrit chez Vinted, l'arrêt est posé
  { const f = monterRepub({ page: (e, d) => (e === 'champ' && d.quoi === 'titre' ? { ok: false, code: 'captcha' } : undefined) });
    const r = await recreer(f);
    const cap = (f.store.vrmCaptcha || {})[UID];
    dit(r && r.code === 'verification' && !pasNoms(f).includes('brouillon') && !pasNoms(f).includes('supprimer') && cap && cap.quoi === 'captcha' && places(f) === 0, 'R10 — captcha / DataDome ⇒ arrêt + alerte, aucun brouillon, aucune suppression, places rendues', JSON.stringify({ r, cap, p: places(f), s: pasNoms(f) }));
    const f2 = f; const n0 = f2.pas.length; const r2 = await recreer(f2);
    dit(r2 && r2.accepte === false && f2.pas.length === n0, 'R10b — tant que la vérification n’est pas faite, la paire suivante ne touche plus la page', JSON.stringify(r2)); }

  // R11 — un sélecteur introuvable : arrêt propre, la raison dite, l'ancienne intacte
  { const f = monterRepub({ page: (e, d) => (e === 'champ' && d.quoi === 'taille' ? { ok: false, code: 'selecteur', manque: 'taille-option' } : undefined) });
    const r = await recreer(f);
    dit(r && r.etape === 'echec' && r.code === 'selecteur' && /Vinted a changé sa page/.test(r.raison) && /taille-option/.test(r.raison) && /intacte/.test(r.raison) && !pasNoms(f).includes('brouillon') && f.v.ancienne === 'en-ligne' && places(f) === 0, 'R11 — élément introuvable ⇒ « Vinted a changé sa page (taille-option) », rien créé ni supprimé', JSON.stringify(r)); }

  // R12 — le brouillon de la page ne ressemble pas à la fiche : arrêt AVANT la suppression
  { const f = monterRepub({ page: (e, d, ff) => { if (e === 'champ' && d.quoi === 'categorie') { ff.saisis.categorie = { ...d, id: 9999 }; return { ok: true }; } return undefined; } });
    const r = await recreer(f);
    dit(r && r.etape === 'echec' && /la catégorie/.test(r.raison) && !pasNoms(f).includes('supprimer') && f.v.ancienne === 'en-ligne' && vb(f).cause === 'formulaire-ecart', 'R12 — un champ pris autrement que la fiche ⇒ VRM s’arrête, l’ancienne n’est pas supprimée', JSON.stringify(r)); }

  // R13 — suppression sans réponse claire : jamais deux en ligne
  { const f = monterRepub({ page: (e) => (e === 'supprimer' ? { ok: true, rep: { status: 503, ok: false, json: null } } : undefined) });
    const r = await recreer(f);
    dit(r && r.etape === 'incertain' && !pasNoms(f).includes('publier') && vb(f).etat === 'a-publier', 'R13 — suppression incertaine ⇒ pas de mise en ligne (jamais deux en ligne)', JSON.stringify(r)); }

  // R14 — reprise après interruption entre le brouillon et la suppression : l'ancienne relue, supprimée, puis Ajouter (une fois chacun)
  { const f = monterRepub({ vb: { corps: '{}', at: new Date(Date.now() - 20 * 60000).toISOString(), majAt: new Date(Date.now() - 15 * 60000).toISOString(), titre: 'Basket test 42', prix: 54, publier: true, uid: UID, methode: 'formulaire', etat: 'brouillon-range', draftId: '88001', supprime: false } });
    const r = await reprendre(f);
    const n = (x) => pasNoms(f).filter((y) => y === x).length;
    dit(r && r.etape === 'fait' && r.reprise === true && n('supprimer') === 1 && n('publier') === 1 && n('brouillon') === 0 && vb(f).etat === 'fait', 'R14 — « Reprendre » : l’ancienne supprimée par sa page puis « Ajouter » sur le brouillon EXISTANT (aucun second brouillon)', JSON.stringify({ r, s: pasNoms(f) }));
    const r2 = await reprendre(f);
    dit(r2 && r2.deja === true && n('publier') === 1, 'R14b — reprise une seconde fois : rien ne repart', JSON.stringify(r2)); }

  // R15 — le compte de l'onglet : un autre compte connecté ⇒ la page n'est jamais touchée
  { const f = monterRepub({ connecte: '222' }); const r = await recreer(f);
    dit(r && r.accepte === false && f.pas.length === 0 && !(f.j.ongletsCrees || []).length, 'R15 — autre compte dans l’onglet ⇒ rien n’est ouvert ni rempli', JSON.stringify(r)); }

  // R16 — « Tout arrêter » touché pendant le remplissage : on s'arrête au champ suivant
  { const f = monterRepub({ page: (e, d, ff) => { if (e === 'champ' && d.quoi === 'description') ff.store.vrmToutArrete = { on: true, at: Date.now() }; return undefined; } });
    const r = await recreer(f);
    dit(r && r.accepte === false && r.code === 'tout-arrete' && !pasNoms(f).includes('brouillon') && places(f) === 0, '« Tout arrêter » ⇒ R16 — le champ suivant n’est pas saisi, aucun brouillon, places rendues', JSON.stringify({ r, s: pasNoms(f) })); }

  // R17 — un 429 sur le brouillon : la pause de Vinted est posée, rien n'est supprimé
  { const f = monterRepub({ page: (e) => (e === 'brouillon' ? { ok: true, rep: { status: 429, ok: false, json: {} } } : undefined) });
    const r = await recreer(f);
    const pause = f.store.vrmPauseVinted;
    dit(r && r.etape === 'echec' && !pasNoms(f).includes('supprimer') && pause && Number(pause.jusqua || pause.until || pause.fin || 0) > Date.now(), 'R17 — 429 au brouillon ⇒ pause de Vinted posée, l’ancienne n’est pas touchée', JSON.stringify({ r, pause })); }

  // R18 — ⚠️ 5.414 (`toutinterface`, Julien, 21 nov. : « on ne fait plus les requêtes ») : l'ancienne méthode « directe »
  //    est RETIRÉE. Un réglage « directe » enregistré, ou une commande qui la demande, est IGNORÉ : le formulaire, et c'est noté.
  { const f = monterRepub({ store: { vrmCommeBleam: { methode: 'directe' } } }); const r = await recreer(f, { differer: true, methode: 'directe' });
    dit(r && r.etape === 'fait' && f.pas.some((p) => p.etape === 'brouillon') && gestesDirects(f).length === 0 && f.j.diags.includes('repub_directe_ignoree'), 'R18 — « Directe » enregistrée ou demandée ⇒ IGNORÉE : le formulaire, aucune requête du service worker, et c’est noté', JSON.stringify({ r: r && (r.etape || r.code), n: f.pas.length, g: gestesDirects(f).length })); }
}

// ── LES FAVORIS ─────────────────────────────────────────────────────────────
const JETON = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ACC = { vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'jeton' };
function monterFav({ offre = true, aimes = 1, fiche = { numero: '41', min: '40' }, achat = null, message = 'Bonjour {username} !', store, apresReponse, prixFil = false, cloche = ['n-banc', 'n-autre'] } = {}) {
  // 5.410.5 : la VRAIE forme mesurée le 20 nov. — chaque photo porte `is_suspicious: false` (réponse normale, 200).
  const photosVraies = [{ id: 1, is_suspicious: false }, { id: 2, is_suspicious: false }];
  const conv = { id: 301, opposite_user: { id: 201, login: 'pseudo_banc' }, transaction: { id: 5001, item_id: 101, ...(prixFil ? { item: { id: 101, price: { amount: '50.0', currency_code: 'EUR' }, photos: photosVraies } } : {}) }, allow_reply: true, messages: [] };
  const lignes = { main: { vinted_annonce_numeros: { '101': fiche }, ...(achat ? { vinted_buyprice_by_num: { '41': achat } } : {}) } };
  const f = faireFond({ src: BG, connecte: UID, comptes: [ACC], lignes, store: store || { __commeBleamDefaut: true },
    vinted: (e) => {
      if (e.methode === 'GET' && /\/inbox-notifications\/v1\/notifications$/.test(e.chemin)) return { status: 200, body: { notifications: cloche.map((id) => ({ id, entry_type: 20 })) } };   // 5.410.8 : la cloche
      if (e.methode === 'POST' && /\/api\/v2\/conversations$/.test(e.chemin)) return { status: 200, body: { conversation: conv, code: 0 } };
      if (e.methode === 'PUT' && /\/mark_as_read$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
      if (e.methode === 'GET' && /\/api\/v2\/conversations\/\d+$/.test(e.chemin)) return { status: 200, body: { conversation: conv } };
      if (e.methode === 'GET' && /\/api\/v2\/transactions\/\d+$/.test(e.chemin)) return { status: 200, body: { transaction: { id: 5001, item_id: 101, item: { id: 101, price: { amount: '50.0', currency_code: 'EUR' }, photos: photosVraies } } } };
      if (e.methode === 'POST' && /\/offers$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
      if (e.methode === 'POST' && /\/replies$/.test(e.chemin)) { if (apresReponse) apresReponse(f); return { status: 200, body: { code: 0 } }; }
      return { status: 404, body: {} };
    } });
  const fetchFond = f.ctx.fetch;
  f.ctx.fetch = async (url, o = {}) => {
    if (String(url).startsWith('https://vrm.center/api/compte')) {
      const c = JSON.parse(o.body || '{}');
      const j = c.action === 'consommer' ? { ok: true, uid: UID, suivi: 's', travail: { notificationId: 'n-banc', itemId: '101', recipientId: '201', initiator: 'native-fixture', aimes, message, ...(offre ? { offre: { mode: 'pct', valeur: 10, arrondi: false } } : {}) } } : { ok: true, autorise: true, uid: UID };
      return { ok: true, status: 200, json: async () => j };
    }
    return fetchFond(url, o);
  };
  f.ctx.notifierApp = async () => {};
  f.ctx.__vrmPausesVues = [];
  return f;
}
const seqFav = (f) => f.j.vinted.filter((v) => !(v.methode === 'GET')).map((v) => /conversations$/.test(v.chemin) ? 'C' : /mark_as_read$/.test(v.chemin) ? 'L' : /replies$/.test(v.chemin) ? 'M' : /offers$/.test(v.chemin) ? 'O' : '?').join('');
const corpsDe = (f, re) => f.j.vinted.filter((v) => re.test(v.chemin)).map((v) => { try { return JSON.parse(v.corps); } catch (_) { return null; } });
async function auditerFavoris() {
  { const f = monterFav(); const r = await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    const c = corpsDe(f, /conversations$/)[0] || {};
    const off = (f.ctx.__vrmPausesVues || []).filter((x) => x[0] === 'favori:offreBleam');
    const o = corpsDe(f, /offers$/)[0];
    dit(r && r.json && r.json.resultat === 'envoye' && seqFav(f) === 'CMO' && c.initiator === 'seller_enters_notification', 'F1 — conversation (`seller_enters_notification`) → message → offre, dans cet ordre, sans `mark_as_read` (Bleam ne le fait pas pour un favori)', `${seqFav(f)} ${JSON.stringify(c)} ${JSON.stringify(r && r.json)}`);
    dit(off.length === 1 && off[0][1] >= 11000 && off[0][1] <= 18000, 'F2 — l’offre part 11 à 18 s après le message (jamais plus tôt que chez Bleam, 11,0 s) (dans la même conversation)', JSON.stringify(off));
    dit(o && o.offer && o.offer.price === '45', 'F3 — au prix de SA règle (−10 % de 50 € = 45 €), au-dessus du prix mini (40 €)', JSON.stringify(o));
    dit(((f.store.vrmActions || {})[UID] || []).length === 3, 'F4 — 3 écritures comptées (conversation, message, offre) ; la lecture marquée ne compte pas', JSON.stringify(f.store.vrmActions)); }
  { const f = monterFav({ aimes: 2 }); await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    const m = (corpsDe(f, /replies$/)[0] || {}).reply || {};
    dit(/plusieurs de mes articles/.test(m.body || '') && /pseudo_banc/.test(m.body || ''), 'F5 — la personne aime 2 articles de ce compte ⇒ le message « lot » (son pseudo posé)', m.body);
    const f2 = monterFav({ aimes: 2, store: JSON.parse(JSON.stringify(f.store)) }); await f2.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    const m2 = (corpsDe(f2, /replies$/)[0] || {}).reply || {};
    dit(m2.body && !/plusieurs de mes articles/.test(m2.body), 'F5b — une seule fois par personne : la fois suivante, le message choisi', m2.body); }
  { const f = monterFav({ fiche: { numero: '41' } }); const r = await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    const o6 = corpsDe(f, /offers$/)[0];
    dit(r.json.resultat === 'envoye' && seqFav(f) === 'CMO' && o6 && o6.offer.price === '45', 'F6 — 5.410.8 (Julien : « comme Bleam ») : ni prix mini ni achat ⇒ l’offre part QUAND MÊME, au % réglé (45 €), après le message', `${seqFav(f)} ${JSON.stringify(o6)}`); }
  { const f = monterFav({ fiche: { numero: '41', min: '48' } }); await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    const o7 = corpsDe(f, /offers$/)[0];
    dit(seqFav(f) === 'CMO' && o7 && o7.offer.price === '48', 'F7 — l’offre de sa règle (45 €) sous le prix mini (48 €) ⇒ REMONTÉE à 48 €, jamais dessous', `${seqFav(f)} ${JSON.stringify(o7)}`); }
  { const f = monterFav({ fiche: { numero: '41', min: '50' } }); const r = await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    dit(r.json.resultat === 'envoye' && seqFav(f) === 'CM', 'F17 — prix mini au prix de l’annonce (50 €) ⇒ aucune offre possible (le message, qui ne l’annonce pas, part)', seqFav(f)); }
  { const f = monterFav({ message: 'Bonjour {username}, je te propose une offre dessus !' }); await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    dit(seqFav(f) === 'COM', 'F18 — un texte qui ANNONCE une offre ⇒ l’offre part AVANT lui (jamais une offre annoncée qui n’existe pas)', seqFav(f)); }
  { const f = monterFav({ fiche: { numero: '41', min: '50' }, message: 'Bonjour {username}, je te propose une offre dessus !' }); const r = await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    dit(r.json.resultat === 'ignore' && !/[MO]/.test(seqFav(f)), 'F18b — texte qui annonce une offre, offre impossible (plancher au prix) ⇒ ni offre ni message', `${seqFav(f)} ${JSON.stringify(r.json)}`); }
  { const f = monterFav({ cloche: ['n-autre'] }); const r = await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    dit(r.json.resultat === 'ignore' && r.json.raison === 'favori_trop_ancien' && seqFav(f) === '', 'F19 — le favori n’est plus dans la cloche de Vinted (trop ancien) ⇒ rien n’est écrit, sauté et dit', `${seqFav(f)} ${JSON.stringify(r.json)}`); }
  { const f = monterFav({ fiche: { numero: '41' }, achat: '30' }); await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    const f2 = monterFav({ fiche: { numero: '41' }, achat: '42' }); await f2.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    const o8 = corpsDe(f, /offers$/)[0], o8b = corpsDe(f2, /offers$/)[0];
    dit(o8 && o8.offer.price === '45' && o8b && o8b.offer.price === '46.20', 'F8 — sans prix mini, le plancher est l’achat + 10 % (30 € ⇒ 33 € : offre à 45 € ; 42 € ⇒ 46,20 € : offre remontée à 46,20 €)', `${JSON.stringify(o8)} / ${JSON.stringify(o8b)}`); }
  { const f = monterFav({ message: 'Je vous propose {prix} !' }); await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    dit(seqFav(f) === 'COM', 'F9 — un message qui annonce le prix de l’offre ({prix}) garde l’ordre d’avant : offre puis message (jamais un prix annoncé pour une offre pas faite)', seqFav(f)); }
  { const f = monterFav({ apresReponse: (ff) => { ff.store.vrmToutArrete = { on: true, at: Date.now() }; } }); await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    dit(seqFav(f) === 'CM', 'F10 — « Tout arrêter » pendant l’attente de l’offre ⇒ l’offre ne part pas', seqFav(f)); }
  { const f = monterFav({ store: { vrmCommeBleam: { favoris: false } } }); await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    const c = corpsDe(f, /conversations$/)[0] || {};
    // 5.414 : la conversation est ouverte PAR LA PAGE (la ligne du favori cliquée dans la cloche) — c'est Vinted qui écrit
    //    sa requête (son `initiator` à lui) ; l'ordre d'avant reste (conversation, offre, message).
    dit(seqFav(f) === 'COM' && (f.j.etapesPage || []).some((x) => x.etape === 'favoriOuvrir'), 'F11 — séquence « comme Bleam » éteinte (Paramètres) ⇒ l’ordre d’avant ; la conversation ouverte par la page', `${seqFav(f)} ${c.initiator}`); }
  // F12 — 5.410.5 : les requêtes de Bleam, dans son ordre (export de l'Observateur) : POST conversations → GET conversations/{id}
  //        → POST replies → POST offers ; le fil porte le prix ⇒ AUCUNE lecture de la transaction, aucun PUT.
  { const f = monterFav({ prixFil: true }); const r = await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    const seq = f.j.vinted.map((v) => `${v.methode} ${String(v.chemin).replace(/\d+/g, '#')}`).join(' | ');
    const pc = (f.ctx.__vrmPausesVues || []).find((x) => x[0] === 'favori:cloche');
    dit(r.json.resultat === 'envoye' && seq === 'GET /inbox-notifications/v#/notifications | POST /api/v#/conversations | GET /api/v#/conversations/# | POST /api/v#/conversations/#/replies | POST /api/v#/transactions/#/offers' && pc && pc[1] >= 3800, 'F12 — exactement les 5 requêtes de Bleam, dans son ordre (la cloche, ≥ 3,8 s, la conversation, sa relecture, le message, l’offre)', seq + ' ' + JSON.stringify(pc)); }
  // F15 — 5.410.5 : comme Bleam (« il ouvre un onglet tout petit, le sien, et c'est là qu'il fait ses actions ») : TOUTES les
  //        requêtes de la séquence partent de l'ONGLET DE TRAVAIL VRM, jamais de l'onglet où il navigue (7).
  { const f = monterFav({ prixFil: true });
    const ex = f.ctx.chrome.scripting.executeScript;
    f.ctx.chrome.scripting.executeScript = async (o) => { const n = f.j.vinted.length; const r = await ex(o); for (let i = n; i < f.j.vinted.length; i++) Object.defineProperty(f.j.vinted[i], 'tab', { value: o && o.target && o.target.tabId, enumerable: false }); return r; };
    const r = await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    const cree = (f.j.ongletsCrees || [])[0];
    const tabs = f.j.vinted.map((v) => v.tab);
    dit(r.json.resultat === 'envoye' && cree && cree.active === false && tabs.length === 5 && tabs.every((t) => t === cree.id) && /\/inbox$/.test(cree.url) && (f.store.vrmOngletTravail || {}).tabId === cree.id, 'F15 — les 5 requêtes (cloche comprise) partent de l’onglet de travail VRM (ouvert sur /inbox en arrière-plan, retenu), aucune de son onglet', JSON.stringify({ cree, tabs })); }
  // F16 — l'onglet de travail FERMÉ pendant une série (vu par Chrome) ⇒ rien ne part, dit ; la fois suivante, un neuf s'ouvre.
  { const f = monterFav({ store: { __commeBleamDefaut: true, vrmOngletTravail: { tabId: 999, uid: UID, maj: Date.now() - 20000, fermeAt: Date.now() - 1000 } } });
    const r = await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    const n1 = f.j.vinted.length;
    const r2 = await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    dit(r.json.resultat === 'refuse' && r.json.raison === 'onglet_vinted' && n1 === 0 && r2.json.resultat === 'envoye' && (f.j.ongletsCrees || []).length === 1, 'F16 — onglet de travail fermé pendant la série ⇒ arrêt dit (rien n’est parti la 1re fois), puis un onglet neuf à la suivante', JSON.stringify({ r: r.json, r2: r2.json, n: f.j.vinted.length, crees: (f.j.ongletsCrees || []).length })); }
  // F13 — LE DÉFAUT DU 20 NOV. 22:29 : une réponse NORMALE (200) qui porte `is_suspicious: false` n'est pas un contrôle anti-robot.
  { const f = monterFav(); const r = await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    const f2 = monterFav({ store: { vrmCommeBleam: { favoris: false } } }); const r2 = await f2.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    dit(r.json.resultat === 'envoye' && r.json.raison !== 'vinted_robot' && r2.json.resultat === 'envoye' && r2.json.raison !== 'vinted_robot', 'F13 — transaction relue en 200 avec `is_suspicious: false` ⇒ le message part (plus de fausse « vérification »), Bleam ou pas', JSON.stringify([r.json, r2.json]));
    dit(f.ctx.freinFavoriAuto({ status: 403, ok: false, json: { url: 'https://geo.captcha-delivery.com/captcha/?x=1' } }) === 'vinted_robot' && f.ctx.freinFavoriAuto({ status: 200, ok: true, json: { captcha: true } }) === '' && f.ctx.freinFavoriAuto({ status: 422, ok: false, json: { item: { photos: [{ is_suspicious: false }] } } }) === '', 'F14 — un VRAI refus captcha (403 + captcha-delivery) reste un arrêt ; une réponse 200 ne l’est jamais, ni une clé `is_suspicious` dans un refus', ''); }
}

async function auditer() { await auditerRepub(); await auditerFavoris(); }

// ── --prouve : rouge sur origin/main et par mutation ────────────────────────
const MUTATIONS = [
  ['ordre-champs', "    ['categorie', { id: attendu.categorie,", "    ['prix', { valeur: attendu.prix }],\n    ['categorie', { id: attendu.categorie,"],
  ['pauses-fixes', "for (let i = 0; i < 8; i++) { ms = Math.round((p[0] + Math.random() * (p[1] - p[0])) * f);", "for (let i = 0; i < 8; i++) { ms = Math.round(p[0] * f);"],
  ['captcha-ignore', "  if (o.code === 'captcha') { noterDiag('formulaire_captcha'); await poserCaptcha(acc, 0); }", "  if (o.code === 'captcha') { noterDiag('formulaire_captcha'); }"],
  ['sans-ecart', "  if (!ecarts || ecarts.length) {\n    noterDiag('formulaire_brouillon_ecart');", "  if (false) {\n    noterDiag('formulaire_brouillon_ecart');"],
  ['suppression-incertaine-publie', "  if (!rd.ok) return fin(rd.r);", "  if (!rd.ok && !/incertain/.test(String(rd.r && rd.r.etape))) return fin(rd.r);"],
  ['sans-arret', "  try { if ((await toutArreteDepuis(null)) > 0) return { code: 'tout-arrete', raison: \"« Tout arrêter » a été touché\" }; } catch (_) {}", ''],
  ['sans-remontee', "  if (pl && c < pl.c) { c = pl.c; noterDiag('favori_offre_remontee_plancher'); }", ''],
  ['sans-cloche', "    if(liste&&!liste.some(n=>n&&String(n.id)===String(body.notificationId))){noterDiag('favori_trop_ancien');return rep('ignore',cl.status,'favori_trop_ancien');}", ''],
  ['offre-apres-annonce', "    if(versionB&&!(offre&&(prixRequisFavori(versionB.texte)||annonceOffreFavori(versionB.texte)))){", "    if(versionB&&!(offre&&prixRequisFavori(versionB.texte))){"],
  // (5.414) « initiateur » retirée : la conversation est ouverte par la PAGE (son `initiator` à elle).
  ['fil-pas-relu', "  if(seqBleam||!cc||!filVerifiable(c)||String(cc.id)!==convId){", "  if(!cc||!filVerifiable(c)||String(cc.id)!==convId){"],
  ['tx-toujours-lue', "  if(seqBleam&&(prFil||!offre)){", "  if(false){"],
  ['frein-sur-200', "  if (r.ok === true || (st >= 200 && st < 400)) return '';", ''],
  ['onglet-de-l-utilisateur', "    if (!pg.refus && travail) {", "    if (false) {"],
  ['ferme-ignore', "    if (!t && Number(mem.fermeAt) > 0 && !mem.fermeDit", "    if (false && Number(mem.fermeAt) > 0 && !mem.fermeDit"],
  ['mot-sans-bord', "\\bsuspicious/i.test(txt)", "suspicious/i.test(txt)"],
];
function lancerSur(src) { const r = cp.spawnSync(process.execPath, [__filename, '--bg', src], { env: { ...process.env, SILENCE: '1', VRM_PROUVE_ENFANT: '1' }, encoding: 'utf8', timeout: 600000 }); return r.status; }
async function prouver() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'comme-bleam-'));
  let bien = true;
  const avant = path.join(tmp, 'avant.js');
  try { fs.writeFileSync(avant, cp.execSync('git show origin/main:vinted-sync-extension/background.js', { cwd: RACINE, maxBuffer: 64 << 20 })); const s = lancerSur(avant); console.log(`${s !== 0 ? '✅' : '❌'} origin/main ⇒ ${s !== 0 ? 'rouge' : 'VERT (le contrôle ne prouve rien)'}`); if (s === 0) bien = false; } catch (e) { console.log('❌ origin/main illisible : ' + e.message); bien = false; }
  const src = fs.readFileSync(BG, 'utf8');
  for (const [nom, de, vers] of MUTATIONS) {
    if (!src.includes(de)) { console.log(`❌ mutation ${nom} : motif introuvable`); bien = false; continue; }
    const p = path.join(tmp, nom + '.js'); fs.writeFileSync(p, src.replace(de, vers));
    const s = lancerSur(p); console.log(`${s !== 0 ? '✅' : '❌'} mutation ${nom} ⇒ ${s !== 0 ? 'rouge' : 'VERT'}`); if (s === 0) bien = false;
  }
  process.exit(bien ? 0 : 1);
}
(async () => {
  if (process.argv.includes('--prouve')) { await auditer(); console.log(`\n${ko ? '❌' : '✅'} passage vert : ${ok} verts, ${ko} rouges`); if (ko) process.exit(1); return prouver(); }
  await auditer();
  console.log(`\n${ko ? '❌' : '✅'} audit-comme-bleam : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
