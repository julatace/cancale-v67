// ════════════════════════════════════════════════════════════════════════════
//  LES AUTOMATISMES eBAY, CÔTÉ SERVEUR (28 nov. 2026, lot ebay-automatismes)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « copie tous les concurrents, fais pareil pour eBay ». Les règles sont dans src/ebay/automatismes.js
// (PURES, la même source pour l'app et le serveur) ; ce module les APPLIQUE à ce qu'eBay rend, par l'API officielle :
//   · la route `api/ebay.js` (actions autolire · autoregler · autolancer · masse · similaire), sur SA session ;
//   · le passage horaire `api/ship-reminders.js?moment=ebayauto` (GitHub chaque heure, .github/workflows/
//     ebay-automatismes.yml) : seuls les vendeurs dont un moteur est ALLUMÉ sont visités — aucune 13e fonction.
//
// CE QUI NE CHANGE JAMAIS (chaque point tenu par scripts/audit-ebay-automatismes.cjs, faux eBay, mutations) :
//   · chaque moteur est ÉTEINT par défaut ; l'allumer exige SA confirmation (la route la vérifie) ;
//   · L'IDENTITÉ d'une annonce = SON SKU `VRM-{n°}` lu chez eBay (traduit par la numérotation 013) ; sans SKU,
//     rien (§5 : jamais un titre) ;
//   · LE PLANCHER (prix mini, sinon achat + 10 %, remonté de la majoration eBay) n'est JAMAIS franchi ; sans
//     plancher, ou publication de plus de 72 h, RIEN ;
//   · LE PRIX VU : l'annonce est RELUE chez eBay (GetItem) avant tout geste — prix différent de la liste, autre
//     devise, variantes, terminée ⇒ rien ; après le geste, relue encore : « fait » seulement si eBay tient le prix ;
//   · MARQUÉ AVANT, ÉCRIT APRÈS : le geste est noté « en cours » AVANT l'appel (une note ratée ⇒ rien ne part), puis
//     « fait », « incertain » (eBay n'a pas répondu clairement) ou « refusé » ; une note « en cours » bloque toute
//     reprise automatique (jamais deux baisses, deux offres ou deux remises en vente pour un hoquet) ;
//   · UNE offre aux observateurs par annonce et par PÉRIODE (son réglage, 7 à 30 j), et jamais pendant une offre de
//     son clic (le journal `ebay_offres_envoyees`, le même que l'action `offre`) ;
//   · une CONTRE-offre par palier et par négociation (annonce + acheteur), Action « Counter » SEULEMENT : VRM
//     n'accepte ni ne refuse jamais (§3 : c'est eBay qui accepte, à SON seuil `BestOfferAutoAcceptPrice`) ;
//   · une REMISE EN VENTE seulement d'une paire prouvée chez lui (en vente ailleurs : `presents` publié par l'app),
//     jamais déjà en ligne sur ce compte, et (par défaut) seulement si eBay dit 0 € de frais ; le SKU est recopié
//     par eBay et RELU sur la nouvelle annonce ;
//   · §2.8 : aucun champ de livraison n'est jamais envoyé (ni « livraison gratuite », ni étiquette) — les corps
//     XML ne portent que l'identifiant et le prix ;
//   · PLAFONDS : au plus `GESTES_PASSAGE` gestes par compte et par passage (et par moteur), `parJour` remises en
//     vente par 24 h ; le passage entier est borné dans le temps ;
//   · L'ÉTAT vit sous `ebay_tokens_automatismes` : la garde de la base (`vrm_garde_ebay_tokens`, migration 014)
//     interdit à un navigateur de l'écrire — seul le serveur (clé de service) le range ; l'app le lit par la route.
// ⚠️ NON MESURÉ : aucun appel réel à eBay d'ici — les formes viennent de la documentation d'eBay (Trading, Negotiation)
//    et des modules déjà en place (ebay-relance, ebay-offre, ebay-gestion), servies par un faux eBay au banc.
// ════════════════════════════════════════════════════════════════════════════
import { lireItemRelance, jugerRelance, xmlRelance, numDeSkuRelance, centimes, ID_ANNONCE_EBAY } from './ebay-relance.js';
import { jugerOffre, offreEnCours, noterOffre } from './ebay-offre.js';
import { gardePrixRegle } from './garde-prix-regle.js';
import { cleNum, numeroExterne } from './numerotation.js';
import { offresEbay, lireXmlEbay } from './ebay-gestion.js';
import { marcheDuCompte, lienAnnonce } from './ebay-marches.js';
import { regleBaisseDe, baisseDue } from '../../src/reglesAuto.js';
import { palierSuivant } from '../../src/negociationPaliers.js';
import { reglagesCompte, avecReglages, allumes, unAllume, regleBaissePour, reglagesPaliersPour, planchersDit, plancherEbay, presente, majorationDe,
  ligneMasse, MASSE_MAX, JOURNAL_MAX, PLANCHERS_CLE, MAJORATION_CLE } from '../../src/ebay/automatismes.js';

export const ID_AUTO = 'ebay_tokens_automatismes';
export const JOURNAL_OFFRES = 'ebay_offres_envoyees';
export const GESTES_PASSAGE = 12;                 // tous moteurs confondus, par compte et par passage
export const GESTES_MOTEUR = { baisse: 6, offres: 6, paliers: 8 };
export const TEMPS_COMPTE_MS = 45000;
const DELAI_LECTURE_MS = 10000, DELAI_ECRITURE_MS = 25000;
const SAUTE_REDIT_MS = 24 * 3600000;              // un même « sauté » n'est redit qu'une fois par jour
const SAUTES_MAX = 40;
const NUM_OK = /^([A-Z]{1,3})?\d{1,6}$/;

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const refDe = (compte) => (compte && !compte.principal && compte.cle ? String(compte.cle) : 'principal');
const xmlEsc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const montantXml = (c) => (c / 100).toFixed(2);
const balise = (src, t) => { const m = new RegExp('<' + t + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + t + '>').exec(String(src || '')); return m ? m[1].trim() : ''; };

// ── LES APPELS À eBAY (Trading en XML, Negotiation en JSON) ─────────────────
// `fetcher` : fetch (le banc sert un faux eBay). `marche` : SiteID, marketplace, devise, langue du compte.
export function clientEbay({ fetcher = (...a) => globalThis.fetch(...a), token, marche, origine = 'https://api.ebay.com' }) {
  const classe = (xml) => { const errs = []; const re = /<Errors>([\s\S]*?)<\/Errors>/g; let m; while ((m = re.exec(xml))) errs.push({ sev: /warning/i.test(balise(m[1], 'SeverityCode')) ? 'Warning' : 'Error', cl: balise(m[1], 'ErrorClassification'), msg: balise(m[1], 'LongMessage') || balise(m[1], 'ShortMessage') }); const e = errs.filter((x) => x.sev === 'Error'); return { refus: e.length > 0 && e.every((x) => x.cl === 'RequestError'), msg: (e[0] && e[0].msg) || '' }; };
  async function trading(appel, inner, ecrit = false) {
    const body = '<?xml version="1.0" encoding="utf-8"?>' + `<${appel}Request xmlns="urn:ebay:apis:eBLBaseComponents">${inner}</${appel}Request>`;
    try {
      const r = await fetcher(`${origine}/ws/api.dll`, { method: 'POST', headers: { 'X-EBAY-API-CALL-NAME': appel, 'X-EBAY-API-SITEID': String(marche.siteId), 'X-EBAY-API-COMPATIBILITY-LEVEL': '1149', 'X-EBAY-API-IAF-TOKEN': token, 'Content-Type': 'text/xml' },
        body, signal: AbortSignal.timeout(ecrit ? DELAI_ECRITURE_MS : DELAI_LECTURE_MS) });
      const xml = await r.text();
      const ack = balise(xml, 'Ack');
      const ok = r.ok && /^(Success|Warning)$/i.test(ack);
      const c = ok ? { refus: false, msg: '' } : classe(xml);
      return { status: r.status, ok, ack, xml, refus: !ok && !!ack && c.refus, err: c.msg.slice(0, 200) };
    } catch (_) { return { status: 0, ok: false, ack: '', xml: '', refus: false, err: '' }; }
  }
  async function nego(chemin, { method = 'GET', corps = null } = {}) {
    try {
      const r = await fetcher(`${origine}/sell/negotiation/v1/${chemin}`, { method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'X-EBAY-C-MARKETPLACE-ID': marche.marketplace, ...(corps ? { 'Content-Type': 'application/json', 'Content-Language': marche.langue || 'fr-FR' } : {}) },
        ...(corps ? { body: JSON.stringify(corps) } : {}), signal: AbortSignal.timeout(method === 'GET' ? DELAI_LECTURE_MS : DELAI_ECRITURE_MS) });
      const txt = await r.text().catch(() => '');
      let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (_) { data = null; }
      return { status: r.status, ok: r.ok, data, coupe: false };
    } catch (_) { return { status: 0, ok: false, data: null, coupe: true }; }
  }
  return { trading, nego };
}

// ── CE QU'eBAY REND ────────────────────────────────────────────────────────
// Les annonces d'un conteneur de GetMyeBaySelling (ActiveList, UnsoldList) : la lecture de la remise en vente
// (`lireItemRelance`, une identité, jamais un titre) + les observateurs.
export function annoncesDe(xml, nom) {
  const c = new RegExp('<' + nom + '>([\\s\\S]*?)</' + nom + '>').exec(String(xml || ''));
  if (!c) return /<UnsoldList\s*\/>/.test(String(xml || '')) && nom === 'UnsoldList' ? [] : null;
  const out = []; const re = /<Item>([\s\S]*?)<\/Item>/g; let m;
  while ((m = re.exec(c[1])) && out.length < 400) {
    const lu = lireItemRelance('<Item>' + m[1] + '</Item>');
    if (!lu || !ID_ANNONCE_EBAY.test(lu.itemId)) continue;
    const wc = balise(m[1], 'WatchCount');
    out.push({ ...lu, observateurs: /^\d+$/.test(wc) ? Number(wc) : null, photo: balise(m[1], 'GalleryURL') || '' });
  }
  return out;
}
// Les frais d'une remise en vente (VerifyRelist…) : le total `ListingFee`, en centimes ; null = pas dit.
export function fraisListing(xml) {
  const bloc = balise(xml, 'Fees');
  if (!bloc) return null;
  const re = /<Fee>([\s\S]*?)<\/Fee>/g; let m;
  while ((m = re.exec(bloc))) {
    if (!/^ListingFee$/i.test(balise(m[1], 'Name'))) continue;
    const v = (/<Fee\b[^>]*>\s*([\d.]+)/.exec(m[1]) || [])[1];   // le montant (la balise intérieure ; la regex non gourmande s'arrête à sa fermeture)
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
  }
  return null;
}
// Le N° que désigne une annonce : son SKU lu chez eBay, traduit par la numérotation 013 (date de mise en ligne).
export function numDeAnnonce(a, mk) {
  const k = numDeSkuRelance(a && a.sku);
  if (!k) return '';
  const t = Date.parse((a && a.debut) || '');
  const n = numeroExterne(k, String(a.itemId || ''), 'ebayAnnonces', Number.isFinite(t) ? t : null, mk);
  return n && NUM_OK.test(n) ? n : '';
}

// ── L'ÉTAT (une ligne par vendeur, un bloc par compte eBay) ─────────────────
export function etatNormal(d) {
  const x = obj(d) || {};
  const comptes = {};
  for (const [ref, c] of Object.entries(obj(x.comptes) || {})) {
    const b = obj(c) || {};
    comptes[ref] = { reglages: reglagesCompte(b.reglages), baisses: { ...(obj(b.baisses) || {}) }, offres: { ...(obj(b.offres) || {}) }, vusEligibles: { ...(obj(b.vusEligibles) || {}) },
      paliers: { ...(obj(b.paliers) || {}) }, relances: { ...(obj(b.relances) || {}) }, sautes: { ...(obj(b.sautes) || {}) }, dernier: obj(b.dernier) || null };
  }
  return { v: 1, actif: Object.values(comptes).some((c) => unAllume(c.reglages)), comptes, journal: (Array.isArray(x.journal) ? x.journal : []).filter((e) => obj(e)).slice(0, JOURNAL_MAX), ...(x.rev != null ? { rev: x.rev } : {}) };
}
// Le modificateur (rejouable : il ne dépend que de ce qu'il reçoit) : `f(c, noter)` change le bloc du compte, `noter(e)`
// ajoute une ligne au journal (la plus récente d'abord).
export function surCompte(ref, f) {
  return (d) => {
    const e = etatNormal(d);
    const c = e.comptes[ref] || etatNormal({ comptes: { [ref]: {} } }).comptes[ref];
    const ajouts = [];
    const r = f(c, (x) => ajouts.push({ ...x, compte: ref }));
    if (r === false) return undefined;
    e.comptes[ref] = c;
    const { rev, ...sans } = e; void rev;
    return { ...sans, actif: Object.values(e.comptes).some((x) => unAllume(x.reglages)), journal: [...ajouts.reverse(), ...e.journal].slice(0, JOURNAL_MAX) };
  };
}

// ── LE PASSAGE D'UN COMPTE ─────────────────────────────────────────────────
// `k` : { client, marche, reglages, planchers, maj, mk, reglesOffre, journalOffres, noterEtat(f), noterOffreJournal(f),
//         maintenant, horloge, finA }. Rend le bilan (des NOMBRES et des raisons, jamais un montant ni un acheteur).
export async function passageCompte(k) {
  const t = k.maintenant;
  const R = reglagesCompte(k.reglages);
  const bilan = { lu: false, gestes: 0, baisse: 0, offres: 0, paliers: 0, relance: 0, incertains: 0, refus: 0, raison: null, scope: false };
  if (!unAllume(R)) { bilan.raison = 'eteint'; return bilan; }
  const pd = planchersDit(k.planchers, t);
  const tropTard = () => (k.horloge ? k.horloge() : Date.now()) > k.finA;
  // Une note ratée arrête TOUT le compte (on ne fait plus rien qu'on ne pourrait pas noter).
  let arret = false;
  const noter = async (f) => { const w = await k.noterEtat(f); if (w !== true) { arret = true; bilan.raison = 'note'; } return w === true; };
  // Ce qui a été SAUTÉ (et pourquoi) : gardé en mémoire, rangé en UNE écriture à la fin du passage ; une même raison
  // pour une même annonce n'est redite qu'une fois par jour (au plus `SAUTES_MAX` lignes par passage).
  const sautes = [];
  const saute = async (moteur, id, num, raison) => { if (sautes.length < SAUTES_MAX) sautes.push({ moteur, id, num, raison }); };
  const fin = async (moteur, id, num, etat, raison, plus) => { if (etat === 'incertain') bilan.incertains++; if (etat === 'refuse') bilan.refus++; if (etat === 'fait') { bilan[moteur]++; } bilan.gestes++; };
  const peut = (moteur) => !arret && !tropTard() && bilan.gestes < GESTES_PASSAGE && (GESTES_MOTEUR[moteur] == null || bilan[moteur] + (bilan['_' + moteur] || 0) < GESTES_MOTEUR[moteur]);
  const tente = (moteur) => { bilan['_' + moteur] = (bilan['_' + moteur] || 0) + 1; };

  // 1. LA LISTE DE SES ANNONCES (en ligne, et les invendues si la remise en vente est allumée).
  const pag = '<Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>1</PageNumber></Pagination>';
  const ls = await k.client.trading('GetMyeBaySelling', `<ActiveList><Include>true</Include>${pag}</ActiveList>` + (R.relance.actif ? `<UnsoldList><Include>true</Include><DurationInDays>60</DurationInDays>${pag}</UnsoldList>` : ''));
  if (!ls.ok) { bilan.raison = 'liste-pas-lue'; return bilan; }
  const actives = annoncesDe(ls.xml, 'ActiveList') || [];
  const invendues = R.relance.actif ? annoncesDe(ls.xml, 'UnsoldList') : null;
  bilan.lu = true;
  const parId = new Map(actives.map((a) => [a.itemId, a]));
  const devise = k.marche.devise;
  // Relire UNE annonce chez eBay (GetItem) : la vérité au moment du geste.
  const relire = async (id) => { const g = await k.client.trading('GetItem', `<ItemID>${id}</ItemID><DetailLevel>ReturnAll</DetailLevel>`); return g.ok ? lireItemRelance(g.xml) : null; };
  const identite = (a) => { const num = numDeAnnonce(a, k.mk); return num; };
  const plancherDe = (num) => (pd ? null : plancherEbay(k.planchers, num, k.maj));

  // 2. E1 — LA BAISSE PAR RÈGLE (la même que Vinted : `baisseDue`).
  if (R.baisse.actif) {
    const regle = regleBaisseDe(regleBaissePour(R), 'ebay');
    for (const a of actives) {
      if (!peut('baisse')) break;
      const num = identite(a);
      if (!num) { await saute('baisse', a.itemId, '', 'sans-identite'); continue; }
      if (pd) { await saute('baisse', a.itemId, num, 'plancher-' + pd); continue; }
      const pl = plancherDe(num);
      if (!pl) { await saute('baisse', a.itemId, num, 'sans-plancher'); continue; }
      if (a.devise && a.devise !== devise) continue;
      const prixC = centimes(a.prix);
      const der = obj(k.etat.baisses[a.itemId]);
      if (der && der.etat === 'en-cours') continue;                       // un geste pas fini n'est jamais refait seul
      const depuis = Math.max(Date.parse(a.debut || '') || 0, der ? Number(der.at) || 0 : 0);
      const d = baisseDue({ prixC, depuis, regle, plancher: pl, maintenant: t });
      if (!d.vouluC) continue;
      if (obj(k.reglesOffre && k.reglesOffre[a.itemId]) && (k.reglesOffre[a.itemId].accepte != null || k.reglesOffre[a.itemId].refuse != null)) { await saute('baisse', a.itemId, num, 'regle-offre'); continue; }
      tente('baisse');
      const lu = await relire(a.itemId);
      if (!lu || lu.itemId !== a.itemId) { await saute('baisse', a.itemId, num, 'pas-relue'); continue; }
      if (!/^Active$/i.test(lu.statut) || lu.variantes || (lu.devise && lu.devise !== devise) || numDeSkuRelance(lu.sku) !== numDeSkuRelance(a.sku)) { await saute('baisse', a.itemId, num, 'annonce-changee'); continue; }
      if (centimes(lu.prix) !== prixC) { await saute('baisse', a.itemId, num, 'prix-change'); continue; }
      const g = gardePrixRegle({ prixC: d.vouluC, actuelC: prixC, plancher: pl, mode: 'auto' });
      if (!g.ok || d.vouluC < pl.c) { await saute('baisse', a.itemId, num, 'garde'); continue; }
      if (!(await noter((c) => { c.baisses[a.itemId] = { at: t, etat: 'en-cours', de: prixC, a: d.vouluC }; }))) break;
      const w = await k.client.trading('ReviseInventoryStatus', `<InventoryStatus><ItemID>${a.itemId}</ItemID><StartPrice>${montantXml(d.vouluC)}</StartPrice></InventoryStatus>`, true);
      let etat, raison = '';
      if (w.ok) { const apres = await relire(a.itemId); etat = apres && centimes(apres.prix) === d.vouluC ? 'fait' : 'incertain'; if (etat === 'incertain') raison = 'pas-relu'; }
      else if (w.refus) { etat = 'refuse'; raison = w.err || 'refus'; }
      else { etat = 'incertain'; raison = 'sans-reponse'; }
      await noter((c, j) => { c.baisses[a.itemId] = { at: t, etat, de: prixC, a: d.vouluC }; j({ at: t, moteur: 'baisse', itemId: a.itemId, num, avantC: prixC, apresC: d.vouluC, plancherC: pl.c, etat, raison }); });
      await fin('baisse', a.itemId, num, etat, raison);
    }
  }

  // 3. E2 — L'OFFRE AUX OBSERVATEURS (une par annonce et par période).
  if (R.offres.actif && !arret && !tropTard()) {
    const ids = []; let complet = true; let chemin = 'find_eligible_items?limit=200';
    for (let p = 0; p < 3 && chemin; p++) {
      const r = await k.client.nego(chemin);
      if (r.status === 204) { chemin = ''; break; }
      if (r.status === 403 || r.status === 401) { bilan.scope = r.status === 403; complet = false; chemin = ''; ids.length = 0; bilan.raison = bilan.raison || (r.status === 403 ? 'scope' : 'jeton'); break; }
      if (!r.ok || !obj(r.data)) { complet = false; chemin = ''; break; }
      for (const e of (Array.isArray(r.data.eligibleItems) ? r.data.eligibleItems : [])) if (e && ID_ANNONCE_EBAY.test(String(e.listingId))) ids.push(String(e.listingId));
      chemin = typeof r.data.next === 'string' && r.data.next.includes('/sell/negotiation/v1/') ? r.data.next.split('/sell/negotiation/v1/')[1] : '';
    }
    if (chemin) complet = false;
    // La 1re fois qu'une annonce est vue éligible : l'heure (« des observateurs depuis N heures »).
    const vus = { ...k.etat.vusEligibles };
    let change = false;
    for (const id of ids) if (!(Number(vus[id]) > 0)) { vus[id] = t; change = true; }
    if (complet) for (const id of Object.keys(vus)) if (!ids.includes(id)) { delete vus[id]; change = true; }
    if (change && !(await noter((c) => { c.vusEligibles = vus; }))) return bilan;
    for (const id of ids) {
      if (!peut('offres')) break;
      if (t - Number(vus[id]) < R.offres.heures * 3600000) continue;
      const der = obj(k.etat.offres[id]);
      if (der && (der.etat === 'en-cours' || t - Number(der.at) < R.offres.periode * 864e5)) continue;
      // Son clic (action `offre`) : une offre en cours, ou partie dans la période, bloque aussi.
      if (k.journalOffres === undefined) { await saute('offres', id, '', 'journal-pas-su'); break; }
      const jm = obj(obj(k.journalOffres) && obj(k.journalOffres.items) && k.journalOffres.items[id]);
      if (offreEnCours(k.journalOffres, id, t) || (jm && t - Date.parse(String(jm.at || '')) < R.offres.periode * 864e5)) continue;
      const a = parId.get(id);
      if (!a) continue;
      const num = identite(a);
      if (!num) { await saute('offres', id, '', 'sans-identite'); continue; }
      if (pd) { await saute('offres', id, num, 'plancher-' + pd); continue; }
      const pl = plancherDe(num);
      if (!pl) { await saute('offres', id, num, 'sans-plancher'); continue; }
      tente('offres');
      const lu = await relire(id);
      const jg = jugerOffre(lu, { listingId: id, prixVu: a.prix, remise: R.offres.pct }, { devise });
      if (!jg.ok) { await saute('offres', id, num, jg.body.reason || 'refus'); continue; }
      if (jg.offreCents < pl.c) { await saute('offres', id, num, 'sous-plancher'); continue; }
      if (!(await noter((c) => { c.offres[id] = { at: t, etat: 'en-cours', pct: R.offres.pct, offreC: jg.offreCents }; }))) break;
      const r = await k.client.nego('send_offer_to_interested_buyers', { method: 'POST', corps: { allowCounterOffer: false, offerDuration: { unit: 'DAY', value: 2 }, offeredItems: [{ listingId: id, discountPercentage: String(R.offres.pct), quantity: 1 }] } });
      const etat = r.ok ? 'fait' : r.coupe || r.status >= 500 ? 'incertain' : 'refuse';
      const n = r.ok && obj(r.data) && Array.isArray(r.data.offers) ? r.data.offers.length : null;
      await noter((c, j) => { c.offres[id] = { at: t, etat, pct: R.offres.pct, offreC: jg.offreCents }; j({ at: t, moteur: 'offres', itemId: id, num, avantC: jg.prixCents, apresC: jg.offreCents, plancherC: pl.c, pct: R.offres.pct, n, etat, raison: etat === 'refuse' ? 'ebay' : etat === 'incertain' ? 'sans-reponse' : '' }); });
      if (etat !== 'refuse') await k.noterOffreJournal(noterOffre({ listingId: id, at: new Date(t).toISOString(), remise: R.offres.pct, prixCents: jg.prixCents, offreCents: jg.offreCents, envoyees: n, etat: etat === 'fait' ? 'envoyee' : 'incertaine' }));
      await fin('offres', id, num, etat);
    }
  }

  // 4. E3 — LA CONTRE-OFFRE PAR PALIERS (la règle `palierSuivant`, Action « Counter » seulement).
  if (R.paliers.actif && !arret && !tropTard()) {
    const g = await k.client.trading('GetBestOffers', `<BestOfferStatus>Active</BestOfferStatus><Pagination><EntriesPerPage>50</EntriesPerPage><PageNumber>1</PageNumber></Pagination>`);
    const root = g.ok ? lireXmlEbay(g.xml, 'GetBestOffers') : null;
    const offres = root ? offresEbay(root) : [];
    const reg = reglagesPaliersPour(R);
    for (const o of offres) {
      if (!peut('paliers')) break;
      if (!['Active', 'Pending'].includes(o.status)) continue;
      if (o.expiresAt && !(Date.parse(o.expiresAt) > t)) continue;
      const a = parId.get(o.itemId);
      if (!a) continue;
      const num = identite(a);
      if (!num) { await saute('paliers', o.itemId, '', 'sans-identite'); continue; }
      if (pd) { await saute('paliers', o.itemId, num, 'plancher-' + pd); continue; }
      const pl = plancherDe(num);
      if (!pl) { await saute('paliers', o.itemId, num, 'sans-plancher'); continue; }
      if (o.currency !== devise || (a.devise && a.devise !== devise)) continue;
      const prixC = centimes(a.prix), offreC = centimes(o.price);
      if (prixC == null || offreC == null || !(Number.isInteger(o.quantity) && o.quantity >= 1)) continue;
      const cle = o.itemId + '|' + String(o.buyer || '').slice(0, 64);
      const neg = obj(k.etat.paliers[cle]) || { joues: [], offres: [] };
      if ((neg.offres || []).includes(o.id) || neg.etat === 'en-cours') continue;   // déjà répondu à CETTE offre
      const r = palierSuivant({ prix: prixC / 100, mini: pl.c / 100, achat: null, offre: offreC / 100, joues: neg.joues || [], reglages: reg });
      // Rien à proposer, ou « accepter » : VRM n'accepte jamais (c'est eBay, à SON seuil) — on laisse l'offre à son toucher.
      if (!r || r.accepter) continue;
      const contreC = Math.round(Number(r.prix) * 100);
      if (!(contreC >= pl.c) || !(contreC > offreC) || !(contreC < prixC)) continue;
      tente('paliers');
      const joues = [...(neg.joues || []), r.i];
      const ids = [...(neg.offres || []), o.id].slice(-12);
      if (!(await noter((c) => { c.paliers[cle] = { joues, offres: ids, at: t, etat: 'en-cours' }; }))) break;
      const w = await contreOffrePalier(k.client, { itemId: o.itemId, offreId: o.id, devise, contreC, quantite: o.quantity });
      const etat = w.ok ? 'fait' : w.refus ? 'refuse' : 'incertain';
      await noter((c, j) => { c.paliers[cle] = { joues, offres: ids, at: t, etat }; j({ at: t, moteur: 'paliers', itemId: o.itemId, num, avantC: offreC, apresC: contreC, plancherC: pl.c, palier: r.i + 1, finale: !!r.finale, etat, raison: etat === 'refuse' ? (w.err || 'refus') : etat === 'incertain' ? 'sans-reponse' : '' }); });
      await fin('paliers', o.itemId, num, etat);
    }
  }

  // 5. E4 — LA REMISE EN VENTE DES INVENDUS (RelistFixedPriceItem : eBay recopie l'annonce, SKU compris).
  if (R.relance.actif && Array.isArray(invendues) && !arret && !tropTard()) {
    const jour = Object.values(k.etat.relances).filter((x) => obj(x) && t - Number(x.at) < 864e5).length;
    let reste = R.relance.parJour - jour;
    const enLigne = new Set(actives.map((a) => identite(a)).filter(Boolean));
    for (const a of invendues) {
      if (reste <= 0 || arret || tropTard() || bilan.gestes >= GESTES_PASSAGE) break;
      if (obj(k.etat.relances[a.itemId]) || a.relanceeEn) continue;
      const num = identite(a);
      if (!num) { await saute('relance', a.itemId, '', 'sans-identite'); continue; }
      const pr = presente(k.planchers, num, t);
      if (pr !== true) { await saute('relance', a.itemId, num, pr === null ? 'presence-pas-sue' : 'pas-prouvee'); continue; }
      if (enLigne.has(num)) { await saute('relance', a.itemId, num, 'deja-en-ligne'); continue; }
      reste--;
      const g = await k.client.trading('GetItem', `<ItemID>${a.itemId}</ItemID><DetailLevel>ReturnAll</DetailLevel>`);
      const lu = g.ok ? lireItemRelance(g.xml) : null;
      const j = jugerRelance(lu, { itemId: a.itemId, numero: num, prixVu: a.prix }, { mk: k.mk, devise });
      if (!j.ok) { await saute('relance', a.itemId, num, j.body.reason || 'refus'); continue; }
      if (R.relance.gratuitSeul) {
        const v = await k.client.trading('VerifyRelistFixedPriceItem', xmlRelance(a.itemId));
        const frais = v.ok ? fraisListing(v.xml) : null;
        if (frais == null) { await saute('relance', a.itemId, num, 'frais-pas-sus'); continue; }
        if (frais > 0) { await saute('relance', a.itemId, num, 'frais'); continue; }
      }
      if (!(await noter((c) => { c.relances[a.itemId] = { at: t, etat: 'en-cours' }; }))) break;
      const w = await k.client.trading('RelistFixedPriceItem', xmlRelance(a.itemId), true);
      const neuf = w.ok ? balise(w.xml, 'ItemID') : '';
      let etat, raison = '';
      if (w.ok && ID_ANNONCE_EBAY.test(neuf)) {
        const l2 = await relire(neuf);
        etat = l2 && l2.itemId === neuf && l2.sku === j.sku && centimes(l2.prix) === centimes(a.prix) && l2.gratuite !== true ? 'fait' : 'incertain';
        if (etat === 'incertain') raison = 'pas-relu';
      } else if (w.refus) { etat = 'refuse'; raison = w.err || 'refus'; }
      else { etat = 'incertain'; raison = 'sans-reponse'; }
      await noter((c, jn) => { c.relances[a.itemId] = { at: t, etat, neuf: neuf || null }; jn({ at: t, moteur: 'relance', itemId: a.itemId, neuf: neuf || null, num, avantC: centimes(a.prix), apresC: centimes(a.prix), sku: j.sku, etat, raison }); });
      await fin('relance', a.itemId, num, etat);
      if (etat === 'fait') enLigne.add(num);
    }
  }
  for (const m of ['baisse', 'offres', 'paliers']) delete bilan['_' + m];
  if (sautes.length && !arret) {
    await noter((c, j) => {
      let n = 0;
      for (const s of Object.keys(c.sautes)) if (!(Number(c.sautes[s]) > t - 7 * 864e5)) delete c.sautes[s];
      for (const x of sautes) { const cle = x.moteur + '|' + x.id + '|' + x.raison; if (Number(c.sautes[cle]) > t - SAUTE_REDIT_MS) continue; c.sautes[cle] = t; n++; j({ at: t, moteur: x.moteur, itemId: x.id, num: x.num, etat: 'saute', raison: x.raison }); }
      return n ? undefined : false;
    });
    bilan.sautes = sautes.length;
  }
  return bilan;
}
// La contre-offre : Action « Counter » et RIEN d'autre (jamais Accept, jamais Decline — §3), le prix et la quantité
// de l'offre ; aucun champ de livraison. Une fonction à part : `audit-offres-auto.cjs` §5 la lit telle quelle.
export async function contreOffrePalier(client, { itemId, offreId, devise, contreC, quantite }) {
  if (!ID_ANNONCE_EBAY.test(String(itemId)) || !/^\d{1,24}$/.test(String(offreId)) || !/^[A-Z]{3}$/.test(String(devise)) || !(Number.isInteger(contreC) && contreC >= 100) || !(Number.isInteger(quantite) && quantite >= 1)) return { ok: false, refus: true, err: 'invalide' };
  return client.trading('RespondToBestOffer', `<ItemID>${itemId}</ItemID><BestOfferID>${offreId}</BestOfferID><Action>Counter</Action><CounterOfferPrice currencyID="${devise}">${montantXml(contreC)}</CounterOfferPrice><CounterOfferQuantity>${quantite}</CounterOfferQuantity>`, true);
}

// ── CE QUE LE PASSAGE ET LA ROUTE LISENT CHEZ LE VENDEUR ───────────────────
// `lireReglageVendeur` rend le texte d'une clé de `main` (`->>`) : undefined = pas su.
const json = (t) => { if (t === undefined) return undefined; if (!t) return null; try { return JSON.parse(t); } catch (_) { return null; } };
export async function lectureVendeur({ owner, lireReglageVendeur }) {
  const [pl, maj, num] = await Promise.all([lireReglageVendeur(PLANCHERS_CLE, owner), lireReglageVendeur(MAJORATION_CLE, owner), lireReglageVendeur('vrm_numerotation', owner)]);
  const mk = json(num);
  return { planchers: json(pl), majoration: json(maj), mk: mk === undefined ? undefined : (obj(mk) || null) };
}

// Un compte : passer ses moteurs, avec SES réglages et SON jeton. Utilisé par le passage horaire ET par « Lancer
// maintenant » (son clic). `deps` : { owner, compte, lireDonnee, modifierDonnee, lireReglageVendeur, accessToken,
// fetcher, maintenant, horloge, finA, suffixe }.
export async function passerUnCompte(deps) {
  const r = await passerUnCompteBrut(deps);
  // Pourquoi rien n'a tourné (jeton, marché, devise, numérotation) : dit sur la page, au « dernier passage ».
  if (r.raison && !['eteint', 'etat-pas-su'].includes(r.raison) && !('lu' in r)) {
    await deps.modifierDonnee(ID_AUTO, deps.owner, surCompte(r.ref, (x) => { x.dernier = { at: deps.maintenant || Date.now(), lu: false, gestes: 0, raison: r.raison }; })).catch(() => null);
  }
  return r;
}
async function passerUnCompteBrut(deps) {
  const { owner, compte, lireDonnee, modifierDonnee, lireReglageVendeur, accessToken, fetcher, maintenant = Date.now(), horloge = () => Date.now() } = deps;
  const ref = refDe(compte), suffixe = deps.suffixe != null ? deps.suffixe : (compte && compte.suffixe) || '';
  const etatBrut = await lireDonnee(ID_AUTO, owner);
  if (etatBrut === undefined) return { ref, raison: 'etat-pas-su' };
  const etat = etatNormal(etatBrut);
  const c = etat.comptes[ref];
  if (!c || !unAllume(c.reglages)) return { ref, raison: 'eteint' };
  const marche = marcheDuCompte(compte);
  if (!marche || compte.siteInconnu) return { ref, raison: 'marche' };
  // L'argent de VRM est en euros (le plancher aussi) : un compte en livres ou en dollars n'est jamais touché seul.
  if (marche.devise !== 'EUR') return { ref, raison: 'devise' };
  const lv = await lectureVendeur({ owner, lireReglageVendeur });
  if (lv.mk === undefined) return { ref, raison: 'numerotation-pas-sue' };
  const at = await accessToken(owner, suffixe);
  if (!at || !at.ok) return { ref, raison: (at && at.reason) || 'jeton' };
  const [reglesOffre, journalOffres] = await Promise.all([lireDonnee('ebay_offres' + suffixe, owner), lireDonnee(JOURNAL_OFFRES + suffixe, owner)]);
  const client = clientEbay({ fetcher, token: at.token, marche });
  let courant = c;
  const noterEtat = async (f) => {
    let apres = null;
    const w = await modifierDonnee(ID_AUTO, owner, (d) => { const x = surCompte(ref, f)(d); apres = x === undefined ? etatNormal(d).comptes[ref] : etatNormal(x).comptes[ref]; return x; });
    if (w === true && apres) { courant = apres; k.etat = courant; }
    return w;
  };
  const k = { client, marche, reglages: c.reglages, planchers: lv.planchers, maj: majorationDe(lv.majoration, ref), mk: lv.mk, reglesOffre: obj(reglesOffre) && obj(reglesOffre.items) ? reglesOffre.items : {},
    journalOffres, etat: courant, noterEtat, noterOffreJournal: (f) => modifierDonnee(JOURNAL_OFFRES + suffixe, owner, f), maintenant, horloge, finA: deps.finA || (horloge() + TEMPS_COMPTE_MS) };
  const bilan = await passageCompte(k);
  await modifierDonnee(ID_AUTO, owner, surCompte(ref, (x) => { x.dernier = { at: maintenant, ...bilan }; })).catch(() => null);
  return { ref, ...bilan };
}

// ── LE PASSAGE HORAIRE (api/ship-reminders.js?moment=ebayauto) ──────────────
// Seules les lignes dont un moteur est allumé (`data->>actif=eq.true`). La réponse ne porte que des NOMBRES.
export async function passageAutomatismesEbay({ lire, lireDonnee, modifierDonnee, lireReglageVendeur, accessToken, lireComptes, comptesActifs, acces = async () => true,
  fetcher = (...a) => globalThis.fetch(...a), maintenant = Date.now(), budgetMs = 100000, exclus = [], horloge = () => Date.now() } = {}) {
  const debut = horloge();
  const rows = await lire(`app_data?id=eq.${ID_AUTO}&data->>actif=eq.true&select=owner`);
  if (!Array.isArray(rows)) return { fait: false, raison: 'pas-su' };
  const vendeurs = [...new Set(rows.map((r) => r && r.owner).filter((o) => typeof o === 'string' && !exclus.includes(o)))];
  const b = { fait: true, vendeurs: vendeurs.length, traites: 0, comptes: 0, gestes: 0, baisse: 0, offres: 0, paliers: 0, relance: 0, incertains: 0, refus: 0, echecs: 0, budgetAtteint: false };
  for (const owner of vendeurs) {
    if (horloge() - debut > budgetMs) { b.budgetAtteint = true; break; }
    if ((await acces(owner)) === false) continue;
    const reg = await lireComptes(owner);
    if (reg === undefined) { b.echecs++; continue; }
    b.traites++;
    for (const compte of comptesActifs(reg)) {
      if (horloge() - debut > budgetMs) { b.budgetAtteint = true; break; }
      const r = await passerUnCompte({ owner, compte, lireDonnee, modifierDonnee, lireReglageVendeur, accessToken, fetcher, maintenant, horloge, finA: Math.min(debut + budgetMs, horloge() + TEMPS_COMPTE_MS) });
      if (r.raison === 'eteint') continue;
      b.comptes++;
      for (const n of ['gestes', 'baisse', 'offres', 'paliers', 'relance', 'incertains', 'refus']) b[n] += Number(r[n]) || 0;
      if (r.raison && !['eteint'].includes(r.raison) && !r.lu) b.echecs++;
    }
  }
  return b;
}

// ── LA ROUTE (api/ebay.js) ─────────────────────────────────────────────────
// `d` : { lireDonnee, modifierDonnee, lireReglageVendeur, accessToken, fetcher, marche: () => marché courant,
//         reviser(b, ctx), terminer(b, ctx) } — `reviser` est `handleRevise` (prix vu, garde, règle d'offre),
//         `terminer` la fin d'annonce de SON clic : la modification en masse passe par les MÊMES chemins.
export function creerAutomatismesEbay(d) {
  const refus = (status, reason, error, plus) => ({ status, body: { ok: false, reason, error, ...(plus || {}) } });
  const etatDe = async (owner) => { const e = await d.lireDonnee(ID_AUTO, owner); return e === undefined ? undefined : etatNormal(e); };
  const clientDe = async (ctx) => { const at = await d.accessToken(ctx.owner, ctx.compte.suffixe || ''); return at && at.ok ? { client: clientEbay({ fetcher: d.fetcher, token: at.token, marche: d.marche() }) } : { ko: at || {} }; };
  const vue = (e, ref) => {
    const c = e.comptes[ref];
    return { reglages: reglagesCompte(c && c.reglages), dernier: (c && c.dernier) || null, journal: e.journal.filter((x) => x.compte === ref).slice(0, 80) };
  };

  // LIRE : les réglages de CE compte, son journal, la fraîcheur du plancher, et ses annonces en ligne (avec leur N°
  // et leur plancher) pour la modification en masse.
  async function lire(b, ctx) {
    const ref = refDe(ctx.compte);
    const e = await etatDe(ctx.owner);
    if (e === undefined) return refus(503, 'pas-su', 'Je n\'ai pas pu relire tes automatismes eBay — rien n\'a changé. Réessaie dans un moment.');
    const lv = await lectureVendeur({ owner: ctx.owner, lireReglageVendeur: d.lireReglageVendeur });
    const pd = lv.planchers === undefined ? 'pas-su' : planchersDit(lv.planchers);
    const maj = majorationDe(lv.majoration, ref);
    const enEuros = d.marche().devise === 'EUR';
    let annonces = null, raisonAnnonces = null;
    if (b.annonces === true) {
      const c = await clientDe(ctx);
      if (!c.client) raisonAnnonces = c.ko.reason || 'jeton';
      else {
        const ls = await c.client.trading('GetMyeBaySelling', '<ActiveList><Include>true</Include><Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>1</PageNumber></Pagination></ActiveList>');
        const l = ls.ok ? annoncesDe(ls.xml, 'ActiveList') : null;
        if (!l) raisonAnnonces = 'pas-lu';
        else annonces = l.map((a) => { const num = lv.mk === undefined ? '' : numDeAnnonce(a, lv.mk); const pl = num && !pd && enEuros ? plancherEbay(lv.planchers, num, maj) : null;
          return { itemId: a.itemId, titre: a.titre, prixC: centimes(a.prix), devise: a.devise || '', num, plancherC: pl ? pl.c : null, observateurs: a.observateurs, photo: a.photo, debut: a.debut, url: lienAnnonce(d.marche(), a.itemId) }; });
      }
    }
    return { status: 200, body: { ok: true, ...vue(e, ref), planchers: { etat: pd || 'ok', at: lv.planchers && Number(lv.planchers.at) ? Number(lv.planchers.at) : null, n: lv.planchers && obj(lv.planchers.parNum) ? Object.keys(lv.planchers.parNum).length : 0 }, majoration: maj, enEuros, annonces, raisonAnnonces } };
  }

  // RÉGLER : SON geste. Allumer un moteur exige `confirme: true` (vérifié ICI, pas seulement à l'écran).
  async function regler(b, ctx) {
    const ref = refDe(ctx.compte);
    if (!obj(b.reglages)) return refus(400, 'reglages', 'Réglages illisibles — rien n\'a changé.');
    const e = await etatDe(ctx.owner);
    if (e === undefined) return refus(503, 'pas-su', 'Je n\'ai pas pu relire tes automatismes eBay — rien n\'a changé.');
    const avant = e.comptes[ref] ? e.comptes[ref].reglages : reglagesCompte(null);
    const apres = avecReglages(avant, b.reglages);
    const neufs = allumes(avant, apres);
    if (neufs.length && b.confirme !== true) return refus(400, 'confirmation', 'Confirme pour allumer cet automatisme — rien n\'a changé.', { allumes: neufs });
    const w = await d.modifierDonnee(ID_AUTO, ctx.owner, surCompte(ref, (c, j) => { c.reglages = apres; j({ at: Date.now(), moteur: 'reglage', etat: 'fait', allumes: neufs, eteints: allumes(apres, avant) }); }));
    if (w !== true) return refus(503, 'note', 'Je n\'ai pas pu ranger ce réglage — rien n\'a changé. Réessaie dans un moment.');
    return { status: 200, body: { ok: true, reglages: apres, allumes: neufs } };
  }

  // LANCER MAINTENANT : le même passage que l'heure, sur SON clic, pour CE compte.
  async function lancer(b, ctx) {
    const r = await passerUnCompte({ owner: ctx.owner, compte: ctx.compte, suffixe: ctx.compte.suffixe || '', lireDonnee: d.lireDonnee, modifierDonnee: d.modifierDonnee, lireReglageVendeur: d.lireReglageVendeur, accessToken: d.accessToken, fetcher: d.fetcher, maintenant: Date.now(), finA: Date.now() + 40000 });
    return { status: 200, body: { ok: true, bilan: r } };
  }

  // LA MODIFICATION EN MASSE (E6). `op` : 'pct' | 'prix' | 'fin' ; `lignes` : [{ itemId, prixVu }] (ce qu'il a VU).
  // Chaque ligne passe par `reviser` (prix vu relu chez eBay, garde du prix) ou `terminer` ; sous son plancher ⇒ refusée.
  async function masse(b, ctx) {
    if (b.confirme !== true) return refus(400, 'confirmation', 'Confirme la modification — rien n\'a été envoyé à eBay.');
    const op = String(b.op || '');
    if (!['pct', 'prix', 'fin'].includes(op)) return refus(400, 'op', 'Modification inconnue — rien n\'a été envoyé.');
    const lignes = Array.isArray(b.lignes) ? b.lignes : [];
    if (!lignes.length || lignes.length > MASSE_MAX) return refus(400, 'lignes', `Choisis de 1 à ${MASSE_MAX} annonces — rien n'a été envoyé.`);
    const ids = new Set();
    for (const l of lignes) { if (!obj(l) || !ID_ANNONCE_EBAY.test(String(l.itemId)) || ids.has(String(l.itemId))) return refus(400, 'lignes', 'Une annonce est illisible ou en double — rien n\'a été envoyé.'); ids.add(String(l.itemId)); }
    const ref = refDe(ctx.compte);
    if (op !== 'fin' && d.marche().devise !== 'EUR') return refus(409, 'devise', 'Ce compte eBay n\'est pas en euros : VRM ne change pas ses prix en série (son plancher est en euros). Fais-le sur eBay.');
    let lv = null, sku = null;
    if (op !== 'fin') {
      lv = await lectureVendeur({ owner: ctx.owner, lireReglageVendeur: d.lireReglageVendeur });
      if (lv.mk === undefined || lv.planchers === undefined) return refus(503, 'pas-su', 'Je n\'ai pas pu relire tes numéros et tes planchers — rien n\'a été envoyé à eBay.');
      // L'identité de chaque annonce (son SKU, lu chez eBay) : le plancher de SON N°.
      const c = await clientDe(ctx);
      if (!c.client) return refus(c.ko.status || 502, c.ko.reason || 'jeton', c.ko.error || 'Compte eBay indisponible.');
      const ls = await c.client.trading('GetMyeBaySelling', '<ActiveList><Include>true</Include><Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>1</PageNumber></Pagination></ActiveList>');
      const l = ls.ok ? annoncesDe(ls.xml, 'ActiveList') : null;
      if (!l) return refus(503, 'pas-su', 'eBay n\'a pas rendu tes annonces — rien n\'a été envoyé.');
      sku = new Map(l.map((a) => [a.itemId, a]));
    }
    const maj = lv ? majorationDe(lv.majoration, ref) : 0;
    const pd = lv ? planchersDit(lv.planchers) : null;
    const res = [];
    for (const l of lignes) {
      const id = String(l.itemId);
      if (op === 'fin') {
        const r = await d.terminer({ itemId: id, confirme: true }, ctx);
        res.push({ itemId: id, ok: !!(r && r.body && r.body.ok), etat: r && r.body && r.body.ok ? 'fait' : r && r.body && r.body.reason === 'incertain' ? 'incertain' : 'refuse', raison: r && r.body && !r.body.ok ? (r.body.reason || 'refus') : '' });
        continue;
      }
      const a = sku.get(id);
      const prixC = centimes(l.prixVu);
      if (!a) { res.push({ itemId: id, ok: false, etat: 'refuse', raison: 'plus-en-ligne' }); continue; }
      const num = numDeAnnonce(a, lv.mk);
      const pl = num && !pd ? plancherEbay(lv.planchers, num, maj) : null;
      const lm = ligneMasse({ op, prixC, valeur: op === 'pct' ? b.pct : b.prix, plancher: pl });
      if (!lm.ok) { res.push({ itemId: id, num, ok: false, etat: 'refuse', raison: lm.raison, apresC: lm.apresC ?? null, plancherC: pl ? pl.c : null }); continue; }
      const r = await d.reviser({ itemId: id, price: montantXml(lm.apresC), prixVu: montantXml(prixC), confirme: true, gardeConfirmeC: lm.apresC }, ctx);
      const okR = !!(r && r.body && r.body.ok);
      res.push({ itemId: id, num, ok: okR, etat: okR ? 'fait' : r && r.status === 504 ? 'incertain' : 'refuse', raison: okR ? '' : (r && r.body && (r.body.reason || 'refus')) || 'refus', avantC: prixC, apresC: lm.apresC, plancherC: pl ? pl.c : null });
    }
    const t = Date.now();
    await d.modifierDonnee(ID_AUTO, ctx.owner, surCompte(ref, (c, j) => { for (const x of res) j({ at: t, moteur: 'masse', op, itemId: x.itemId, num: x.num || '', avantC: x.avantC ?? null, apresC: x.apresC ?? null, etat: x.etat, raison: x.raison }); })).catch(() => null);
    return { status: 200, body: { ok: true, op, lignes: res, faites: res.filter((x) => x.ok).length } };
  }

  // « VENDRE UN SIMILAIRE » (E4) : l'annonce RELUE chez eBay devient un BROUILLON (`ebay_brouillons`) — sans N° ni
  // paire (il choisit la paire, donc un nouveau N° et son SKU à la publication) ; la pointure est retirée des
  // caractéristiques (à reposer). Rien n'est publié ici.
  async function similaire(b, ctx) {
    const id = String(b.itemId || '');
    if (!ID_ANNONCE_EBAY.test(id)) return refus(400, 'invalide', 'Annonce inconnue.');
    const c = await clientDe(ctx);
    if (!c.client) return refus(c.ko.status || 502, c.ko.reason || 'jeton', c.ko.error || 'Compte eBay indisponible.');
    const g = await c.client.trading('GetItem', `<ItemID>${id}</ItemID><DetailLevel>ReturnAll</DetailLevel><IncludeItemSpecifics>true</IncludeItemSpecifics>`);
    if (!g.ok) return refus(503, 'pas-su', 'eBay n\'a pas rendu cette annonce — aucun brouillon créé.');
    const lu = lireItemRelance(g.xml);
    if (!lu || lu.itemId !== id) return refus(503, 'pas-su', 'eBay n\'a pas rendu cette annonce — aucun brouillon créé.');
    if (lu.variantes) return refus(409, 'variantes', 'Une annonce à variantes ne se copie pas ici — fais-le sur eBay.');
    const x = g.xml;
    const dex = (s) => String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
    const photos = []; const pre = /<PictureURL[^>]*>([\s\S]*?)<\/PictureURL>/g; let pm;
    while ((pm = pre.exec(x)) && photos.length < 24) { const u = dex(pm[1]).trim(); if (/^https:\/\//.test(u)) photos.push(u); }
    const aspects = {}; const sre = /<NameValueList>([\s\S]*?)<\/NameValueList>/g; let sm;
    while ((sm = sre.exec(x))) { const n = dex(balise(sm[1], 'Name')); const v = dex(balise(sm[1], 'Value')); if (n && !/pointure|size|taille|größe|taglia|talla/i.test(n)) aspects[n.slice(0, 65)] = v.slice(0, 65); }
    const cat = (/<PrimaryCategory>([\s\S]*?)<\/PrimaryCategory>/.exec(x) || [])[1] || '';
    const bid = 'b-sim-' + id.slice(-8) + '-' + Date.now().toString(36);
    const t = Date.now();
    const brouillon = { id: bid, titre: lu.titre, prix: centimes(lu.prix) != null ? String(centimes(lu.prix) / 100) : '', quantite: '1', etat: balise(x, 'ConditionID') || '3000',
      description: dex(balise(x, 'Description')).slice(0, 100000), photos, aspects, categorie: balise(cat, 'CategoryID') ? { id: balise(cat, 'CategoryID'), nom: dex(balise(cat, 'CategoryName')), requis: [] } : null,
      compte: refDe(ctx.compte), creeLe: t, majLe: t, etatBrouillon: 'brouillon', verif: null, envoi: null, similaireDe: id };
    const w = await d.modifierDonnee('ebay_brouillons', ctx.owner, (row) => { const items = { ...((obj(row) && obj(row.items)) || {}) }; items[bid] = brouillon; return { ...(obj(row) || {}), items, majAt: t }; });
    if (w !== true) return refus(503, 'note', 'Je n\'ai pas pu ranger le brouillon — rien n\'a été créé. Réessaie dans un moment.');
    await d.modifierDonnee(ID_AUTO, ctx.owner, surCompte(refDe(ctx.compte), (c0, j) => { j({ at: t, moteur: 'similaire', itemId: id, etat: 'fait', brouillon: bid }); })).catch(() => null);
    return { status: 200, body: { ok: true, brouillon: bid, photos: photos.length } };
  }

  return { lire, regler, lancer, masse, similaire };
}
// (pour les bancs)
export { refDe, cleNum };
