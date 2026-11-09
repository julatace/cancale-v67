// ══ LES VENTES ET LES ACHATS S'ENVOIENT LÉGERS (extension 5.326, 8 nov.) ═════
// Récit : `docs/passation/2026-11-08-ventes-envoi-leger.md`.
//
// LE PROBLÈME (son iPhone, 8 nov.) : la ligne `harvest_{uid}_orders_sold` d'un
// gros compte (2 000 ventes) partait EN ENTIER à chaque lecture — l'extension la
// relisait (≈ 0,7–0,9 Mo) puis la réécrivait (autant) pour y fusionner 320
// ventes relues. Sur iOS, le service worker de l'extension est suspendu vite et
// la liaison montante est lente : un `POST` de près d'un mégaoctet est coupé en
// route (`reseau`), rien n'arrive, et la même ligne repart à la visite suivante.
//
// CE QUI CHANGE : l'extension n'envoie plus que
//   · la FENÊTRE lue, en abrégé : « n° de transaction : empreinte » par commande
//     (≈ 25 octets chacune, dans l'ordre lu) ;
//   · les commandes du HAUT de la fenêtre en entier (les plus susceptibles d'être
//     neuves ou d'avoir changé), et sur demande celles que la base n'a pas ;
//   · les n° « à expédier / au point relais » de la fenêtre (la règle de
//     l'extension, `resumeCommandes`) et les transactions qui ne s'expédient plus.
// Le SERVEUR relit la ligne (centre de données ↔ base : pas de liaison montante
// de téléphone), reconstitue la fenêtre — chaque commande soit fournie, soit
// prise dans la base SI son empreinte y est la même — et la fusionne avec LA
// MÊME règle que l'extension (`src/commandesFusion.js`, recopiée au caractère
// près dans `background.js`). Il écrit la ligne de la même forme qu'avant :
// AUCUN lecteur ne change (app, widget, rappels, facture Pro, extension).
//
// LES RÈGLES TENUES :
//   · identité = n° de transaction (§5) ; une empreinte différente ou inconnue
//     ⇒ la commande est DEMANDÉE (`manquants`), jamais devinée ;
//   · une capture partielle n'écrase jamais une complète : fusion (loi 2) ; seule
//     une lecture COMPLÈTE dont toutes les commandes sont réunies remplace tout ;
//   · « relues le … » (`capturedAt`) n'avance que quand TOUTE la fenêtre est
//     appliquée ; une fenêtre incomplète écrit ce qu'elle a sans rajeunir la date ;
//   · une lecture de la base ratée n'écrit RIEN (503) ; deux écritures en même
//     temps : comparer-et-échanger sur `data.rev` et `data.capturedAt` (une
//     extension ancienne qui réécrit la ligne fait échouer l'échange ⇒ relu) ;
//   · AU NOM du vendeur (son jeton, RLS) : jamais la clé de service.
import { cleTxCommande, fusionnerCommandes, lectureDuHaut, empreinteCommande } from '../../src/commandesFusion.js';
import { vendeurExige, lireCommeVendeur, modifierCommeVendeur, insererCommeVendeur, baseCloisonnee } from './session.js';

export const FENETRE_MAX = 5000;          // commandes décrites dans un envoi (Vinted : 2 000 lues au plus)
export const COMMANDES_PAR_ENVOI_MAX = 400; // commandes ENTIÈRES dans un envoi (≈ 180 Ko)
const TYPES = new Set(['orders_sold', 'orders_purchased']);
const RE_TX = /^[0-9A-Za-z_-]{1,40}$/;
const RE_EMP = /^[0-9a-z]{2,16}$/;
const LU_RECUL_MAX_MS = 15 * 60 * 1000;

// « tx:emp,tx:emp,… » ⇒ [[tx, emp], …] (ordre lu, premier gardé) — `null` si illisible.
export function lireFenetre(texte) {
  if (typeof texte !== 'string' || !texte) return null;
  const out = [], vus = new Set();
  for (const morceau of texte.split(',')) {
    const i = morceau.indexOf(':');
    if (i <= 0) return null;
    const tx = morceau.slice(0, i), emp = morceau.slice(i + 1);
    if (!RE_TX.test(tx) || !RE_EMP.test(emp)) return null;
    if (vus.has(tx)) continue;
    vus.add(tx); out.push([tx, emp]);
    if (out.length > FENETRE_MAX) return null;
  }
  return out.length ? out : null;
}

const listeTx = (v, max = FENETRE_MAX) => (Array.isArray(v) && v.length <= max && v.every((t) => RE_TX.test(String(t))) ? v.map(String) : null);

// Ce que la ligne doit devenir. `avant` : null (pas de ligne) ou
// { cap, rev, pagination, my_orders, resume }. Rend
//   { erreur }                                          envoi illisible (400) ;
//   { ecrit:false, manquants }                          rien d'applicable ;
//   { ecrit:true, data, complet, manquants }            la ligne à écrire.
export function appliquerEnvoi(avant, envoi, maintenant = Date.now()) {
  const e = envoi && typeof envoi === 'object' ? envoi : null;
  if (!e || !TYPES.has(e.type)) return { erreur: 'type' };
  if (!/^\d{1,20}$/.test(String(e.uid || ''))) return { erreur: 'compte' };
  const fen = lireFenetre(e.fenetre);
  if (!fen) return { erreur: 'fenetre' };
  const empDe = new Map(fen);
  const commandes = Array.isArray(e.commandes) ? e.commandes : [];
  if (commandes.length > COMMANDES_PAR_ENVOI_MAX) return { erreur: 'trop' };
  const ae = listeTx(e.ae);
  if (!ae) return { erreur: 'ae' };
  const exclues = e.exclues == null ? null : listeTx(e.exclues, 50000);
  if (e.exclues != null && !exclues) return { erreur: 'exclues' };
  // Chaque commande fournie porte SON n° et l'empreinte annoncée pour lui :
  // une différence est un envoi incohérent, refusé en entier (rien n'est écrit).
  const fournies = new Map();
  for (const c of commandes) {
    const k = cleTxCommande(c);
    if (!k || !c || typeof c !== 'object' || Array.isArray(c)) return { erreur: 'commande' };
    if (empDe.get(k) !== empreinteCommande(c)) return { erreur: 'empreinte' };
    fournies.set(k, c);
  }
  const rangees = avant && Array.isArray(avant.my_orders) ? avant.my_orders : [];
  const base = new Map();
  for (const o of rangees) { const k = cleTxCommande(o); if (k && !base.has(k)) base.set(k, o); }
  const fenetre = [], manquants = [], appliquees = new Set();
  for (const [k, emp] of fen) {
    if (fournies.has(k)) { fenetre.push(fournies.get(k)); appliquees.add(k); continue; }
    const b = base.get(k);
    if (b && empreinteCommande(b) === emp) { fenetre.push(b); appliquees.add(k); }
    else manquants.push(k);
  }
  if (!fenetre.length) return { ecrit: false, manquants };
  const entiere = manquants.length === 0;
  // La règle « haut / page profonde » se juge sur la fenêtre LUE (sa longueur
  // réelle), pas sur la partie déjà réunie.
  const pagination = e.pagination && typeof e.pagination === 'object' && !Array.isArray(e.pagination) ? e.pagination : null;
  const haut = lectureDuHaut({ pagination, my_orders: { length: fen.length } });
  const neuf = { pagination: !entiere && haut && pagination ? Object.assign({}, pagination, { current_page: 1 }) : pagination, my_orders: fenetre };
  if (e.order_details_enabled !== undefined) neuf.order_details_enabled = e.order_details_enabled;
  let payload;
  if (e.complet === true && entiere) payload = { pagination: neuf.pagination, order_details_enabled: neuf.order_details_enabled, my_orders: fenetre };
  else payload = fusionnerCommandes(avant ? { pagination: avant.pagination || null, my_orders: rangees } : null, neuf);
  if (!payload) return { erreur: 'fenetre' };
  // Le résumé du widget et des rappels : la règle de l'EXTENSION pour chaque
  // commande de la fenêtre (`ae`), l'ancien résumé pour celles hors fenêtre
  // (elles n'ont pas bougé, la même règle a déjà été appliquée).
  const aeS = new Set(ae);
  const ancien = avant && avant.resume && Array.isArray(avant.resume.txns) ? new Set(avant.resume.txns.map(String)) : null;
  const ex = e.type === 'orders_sold' && exclues ? new Set(exclues) : null;
  const txns = [];
  // (9 nov., charge) La DATE de chaque vente à expédier, prise dans la même
  // commande que le n° (`o.date`, ce que lit `limiteExpedition`) : le widget et
  // les rappels datent leur limite estimée sans relire la liste entière (≈ 650 Ko
  // par rafraîchissement du widget, mesuré au banc `scripts/charge/`). Une vente
  // sans date lisible n'y est pas : le lecteur relit sa liste, comme avant.
  const dates = {};
  for (const o of payload.my_orders) {
    const k = cleTxCommande(o);
    if (!k) continue;
    const oui = appliquees.has(k) ? aeS.has(k) : !!(ancien && ancien.has(k));
    if (oui && !(ex && ex.has(k))) {
      txns.push(k);
      if (e.type === 'orders_sold' && o && typeof o.date === 'string' && Number.isFinite(Date.parse(o.date))) dates[k] = o.date;
    }
  }
  const lu = Number(e.luA);
  const luA = Number.isFinite(lu) && lu <= maintenant && lu >= maintenant - LU_RECUL_MAX_MS ? lu : maintenant;
  const capturedAt = entiere || !avant || !avant.cap ? new Date(luA).toISOString() : avant.cap;
  const data = {
    type: e.type, uid: String(e.uid), domain: typeof e.domain === 'string' && /^[a-z0-9.-]{1,60}$/i.test(e.domain) ? e.domain : 'www.vinted.fr',
    capturedAt, payload, nItems: payload.my_orders.length,
    resume: { n: payload.my_orders.length, txns, at: maintenant, ...(e.type === 'orders_sold' ? { dates } : {}) },
    rev: (Number(avant && avant.rev) || 0) + 1,
    envoi: 'leger',
  };
  return { ecrit: true, data, complet: entiere, manquants };
}

const SEL_AVANT = 'cap:data->>capturedAt,rev:data->>rev,pg:data->payload->pagination,mo:data->payload->my_orders,resume:data->resume';

// POST /api/compte?mode=commandes — corps : l'envoi (voir `appliquerEnvoi`).
// Réponses : 200 { ok, ecrit, complet, manquants, n } · 400 envoi illisible ·
// 401 session · 503 base injoignable (RIEN écrit) · 409 deux écritures en même
// temps, deux fois de suite (rien écrit, l'extension réessaie à la visite suivante).
export async function routeCommandes(req, res, { maintenant = () => Date.now() } = {}) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, erreur: 'POST seulement' });
  const u = await vendeurExige(req, res);
  if (!u) return;
  const envoi = req.body;
  if (!envoi || typeof envoi !== 'object' || !TYPES.has(envoi.type) || !/^\d{1,20}$/.test(String(envoi.uid || ''))) return res.status(400).json({ ok: false, erreur: 'envoi' });
  const rowId = `harvest_${envoi.uid}_${envoi.type}`;
  const cloison = await baseCloisonnee();
  const proprio = cloison ? `&owner=eq.${encodeURIComponent(u.id)}` : '';
  for (let tour = 0; tour < 2; tour++) {
    const rows = await lireCommeVendeur(req, `app_data?id=eq.${encodeURIComponent(rowId)}${proprio}&select=${SEL_AVANT}`);
    if (rows === null) return res.status(503).json({ ok: false, erreur: 'base' });   // pas su : rien écrit
    const r0 = rows[0] || null;
    const avant = r0 ? { cap: r0.cap || null, rev: r0.rev == null ? null : String(r0.rev), pagination: r0.pg || null, my_orders: Array.isArray(r0.mo) ? r0.mo : [], resume: r0.resume || null } : null;
    const t = maintenant();
    const r = appliquerEnvoi(avant, envoi, t);
    if (r.erreur) return res.status(400).json({ ok: false, erreur: r.erreur });
    if (!r.ecrit) return res.status(200).json({ ok: true, ecrit: false, complet: false, manquants: r.manquants, n: avant ? avant.my_orders.length : 0 });
    const quand = new Date(t).toISOString();
    let n;
    if (avant) {
      const cas = `&${avant.rev == null ? 'data->>rev=is.null' : `data->>rev=eq.${encodeURIComponent(avant.rev)}`}&${avant.cap == null ? 'data->>capturedAt=is.null' : `data->>capturedAt=eq.${encodeURIComponent(avant.cap)}`}`;
      n = await modifierCommeVendeur(req, `app_data?id=eq.${encodeURIComponent(rowId)}${proprio}${cas}&select=id`, { data: r.data, updated_at: quand });
    } else {
      n = await insererCommeVendeur(req, 'app_data', Object.assign({ id: rowId, data: r.data, updated_at: quand }, cloison ? { owner: u.id } : {}));
    }
    if (n === null) return res.status(503).json({ ok: false, erreur: 'base' });
    if (n >= 1) return res.status(200).json({ ok: true, ecrit: true, complet: r.complet, manquants: r.manquants, n: r.data.nItems });
    // 0 : quelqu'un a écrit entre la lecture et l'écriture ⇒ relire, une fois.
  }
  return res.status(409).json({ ok: false, erreur: 'concurrence' });
}
