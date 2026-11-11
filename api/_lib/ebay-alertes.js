// ── LES ALERTES D'ACHAT eBAY (11 novembre, lot alertes-ebay) ─────────────────
// Demande validée par Julien, pour eBay SEULEMENT : « préviens-moi quand une
// nouvelle annonce correspond à mes recherches ». Ses recherches sont les
// recherches enregistrées du fil (les « veilles », src/operations/metier.js,
// §11 : la MÊME liste) ; il allume l'alerte d'une recherche par SON clic
// (`veille.alerte`). Ici, le SERVEUR les relit sans l'app ouverte :
//
//   · le passage : `api/ship-reminders.js?moment=alertes`, appelé chaque heure
//     par GitHub (.github/workflows/alertes-ebay.yml, CRON_SECRET) — aucune
//     nouvelle fonction api/ (12 au plus) ;
//   · l'API Browse d'eBay (gratuite), le jeton D'APPLICATION de VRM
//     (client_credentials) : jamais une clé payante, jamais le jeton du vendeur
//     (§2.9) ; la même adresse et la même lecture que « Chercher »
//     (api/_lib/ebay-recherche.js `requeteBrowse`, `reduireResultats` : budget
//     PORT COMPRIS, port « calculé » = inconnu, jamais gratuit) ;
//   · LES QUOTAS, dits à l'écran : au plus `ALERTES_PAR_HEURE` recherches par
//     vendeur et par heure, chacune relue au plus une fois par heure (les plus
//     anciennes d'abord) ; chaque appel compte dans SES 200 recherches du jour,
//     dans la part automatique (fil + alertes ≤ 150 : les 50 dernières restent à
//     « Chercher ») ; au plus `MAX_APPELS_PASSAGE` appels à eBay par passage pour
//     toute l'application ; deux vendeurs aux mêmes critères = UN appel (cache du
//     passage) ; trois pannes d'eBay de suite ⇒ le passage s'arrête ;
//   · L'IDENTITÉ d'une annonce est son `itemId` (jamais un titre) : une annonce
//     n'est signalée qu'UNE fois, toutes recherches confondues (`dits`) ; la
//     PREMIÈRE lecture d'une recherche (ou de critères modifiés) ne signale
//     rien — on ne sait pas ce qu'il avait déjà vu ;
//   · une notification par vendeur et par passage (catégorie `alerteebay`,
//     famille « Alertes d'achat eBay »), par le canal existant : son réglage, les
//     heures calmes (rangée dans la cloche, rien ne sonne la nuit) et le
//     regroupement sont ceux d'api/_lib/push.js ;
//   · la liste « Nouvelles annonces pour tes recherches » (eBay → Achats) lit
//     l'état par la route `alertes` d'api/ebay.js (projection, jamais `vus`).
// Rien n'est acheté : VRM ne fait que LIRE ; le geste est « Voir sur eBay ».
// Aucun verdict : la marge POSSIBLE se calcule à l'écran avec SES chiffres
// (src/calculetteAchat.js) — jamais « bonne affaire » (refusé le 11 oct., §3).
//
// L'état vit sous `ebay_tokens_alertes` : la garde de la base
// (`vrm_garde_ebay_tokens`, migration 014) interdit à un navigateur de le créer,
// le réécrire ou l'effacer — seul le serveur (clé de service) l'écrit ; un
// vendeur ne peut ni effacer ses « déjà signalées » ni fabriquer une alerte.
// ⚠️ NON MESURÉ : aucun appel réel à eBay d'ici (formes de la documentation,
// servies par un faux eBay au banc `scripts/audit-alertes-ebay.cjs`).
import { criteresRecherche, reduireResultats, compterAppel, jourParis, ID_COMPTEUR, PLAFOND_VRM_JOUR, PLAFOND_FIL_JOUR, requeteBrowse } from './ebay-recherche.js';
import { veillesEnAlerte, criteresDeVeille } from '../../src/operations/metier.js';

export const ID_ETAT = 'ebay_tokens_alertes';
export const ID_OPERATIONS = 'vrm_operations_v1';
export const ALERTES_PAR_HEURE = 4;
export const INTERVALLE_MS = 60 * 60 * 1000;
export const MAX_APPELS_PASSAGE = 60;
export const MAX_VUS = 200;
export const MAX_NOUVELLES = 60;
export const MAX_DITS = 2000;
export const MAX_ECARTEES = 500;
export const GARDE_MS = 14 * 86400e3;
export const PANNES_DE_SUITE = 3;
export const CAT_NOTIF = 'alerteebay';
export const URL_NOTIF = '/?tab=plat_ebay&section=achats';
const ITEM_RE = /^[A-Za-z0-9|_.-]{1,80}$/;

const iso = (t) => new Date(t).toISOString();
const heureUTC = (t) => iso(t).slice(0, 13);
// Les critères tels qu'eBay les reçoit : la même recherche, la même signature.
export const signatureCriteres = (c) => JSON.stringify([c.mots, c.exclus, c.pointure, c.minimum, c.maximum, c.etat, c.pays, c.categorie, c.achatImmediat, c.livraisonFR]);

// L'état, toujours sous la même forme (une ligne absente ou abîmée repart à vide).
export function etatNormal(d) {
  const x = d && typeof d === 'object' && !Array.isArray(d) ? d : {};
  const obj = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
  const tab = (a) => (Array.isArray(a) ? a : []);
  return {
    v: 1,
    recherches: { ...obj(x.recherches) },
    vus: { ...obj(x.vus) },
    nouvelles: tab(x.nouvelles).filter((n) => n && typeof n === 'object' && ITEM_RE.test(String(n.itemId || ''))),
    dits: tab(x.dits).filter((i) => typeof i === 'string'),
    ecartees: tab(x.ecartees).filter((i) => typeof i === 'string'),
    heure: x.heure && typeof x.heure === 'object' ? x.heure : null,
    dernier: x.dernier && typeof x.dernier === 'object' ? x.dernier : null,
    ...(x.rev != null ? { rev: x.rev } : {}),
  };
}
const appelsHeure = (e, t) => (e.heure && e.heure.h === heureUTC(t) && Number.isSafeInteger(e.heure.n) && e.heure.n >= 0 ? e.heure.n : 0);
const compterHeure = (e, t) => { e.heure = { h: heureUTC(t), n: appelsHeure(e, t) + 1 }; };

// QUELLES recherches relire maintenant (pur). Une recherche aux critères refusés
// par la règle commune (metier.js `erreurCriteresEbay`) n'est jamais envoyée.
export function aRelireMaintenant(etat, veilles, t) {
  const e = etatNormal(etat);
  const faites = appelsHeure(e, t);
  const place = Math.max(0, ALERTES_PAR_HEURE - faites);
  const dues = [], refusees = [];
  for (const v of veillesEnAlerte(veilles)) {
    const cr = criteresRecherche(criteresDeVeille(v));
    if (!cr.ok) { refusees.push({ id: v.id, error: cr.error }); continue; }
    const sig = signatureCriteres(cr.c);
    const r = e.recherches[v.id];
    const at = r && r.sig === sig ? Date.parse(r.at || '') : NaN;
    if (Number.isFinite(at) && t - at < INTERVALLE_MS) continue;
    dues.push({ v, c: cr.c, sig, depuis: Number.isFinite(at) ? at : 0 });
  }
  dues.sort((a, b) => a.depuis - b.depuis || String(a.v.id).localeCompare(String(b.v.id)));
  return { dues: dues.slice(0, place), enAttente: Math.max(0, dues.length - place), place, faites, refusees };
}

// Une lecture RÉUSSIE d'une recherche (pur) : rend { e, nouvelles }.
export function integrer(d, { v, sig, items, t }) {
  const e = etatNormal(d);
  const at = iso(t);
  const r = e.recherches[v.id];
  const premiere = !r || r.sig !== sig || !Array.isArray(e.vus[v.id]);
  const vu = new Set(premiere ? [] : e.vus[v.id]);
  const dits = new Set(e.dits);
  const ecartees = new Set(e.ecartees);
  const nouvelles = [];
  const ids = [];
  for (const x of Array.isArray(items) ? items : []) {
    if (!x || !ITEM_RE.test(String(x.itemId || ''))) continue;
    ids.push(x.itemId);
    if (premiere || vu.has(x.itemId) || dits.has(x.itemId) || ecartees.has(x.itemId)) continue;
    dits.add(x.itemId);
    nouvelles.push({
      itemId: x.itemId, veille: v.id, recherche: String(v.titre || '').slice(0, 160),
      titre: String(x.titre || '').slice(0, 200), photo: x.photo || null, url: x.url,
      prix: x.prix, port: x.port, total: x.total, etat: String(x.etat || '').slice(0, 60),
      pays: String(x.pays || '').slice(0, 2), date: x.date || null, vueA: at,
    });
  }
  e.vus[v.id] = [...new Set([...(premiere ? [] : e.vus[v.id]), ...ids])].slice(-MAX_VUS);
  e.recherches[v.id] = { sig, at, n: ids.length, echec: null, premiere: premiere ? at : ((r && r.premiere) || at) };
  e.dits = [...e.dits, ...nouvelles.map((n) => n.itemId)].slice(-MAX_DITS);
  e.nouvelles = garder([...e.nouvelles, ...nouvelles], t);
  compterHeure(e, t);
  return { e, nouvelles };
}
// Une lecture RATÉE : elle attend une heure comme une lecture réussie (jamais
// relancée à chaque passage), rien de « vu » n'est perdu.
export function marquerEchec(d, { v, sig, t, raison }) {
  const e = etatNormal(d);
  const r = e.recherches[v.id] || {};
  e.recherches[v.id] = { ...r, sig: r.sig === sig ? sig : (r.sig || null), at: iso(t), echec: String(raison || 'ebay').slice(0, 40) };
  if (r.sig !== sig) e.recherches[v.id].sig = null;   // critères neufs pas encore lus : la prochaine lecture sera la première
  compterHeure(e, t);
  return e;
}
const garder = (liste, t) => liste.filter((n) => t - (Date.parse(n.vueA || '') || 0) < GARDE_MS).slice(-MAX_NOUVELLES);
// Fin du passage d'un vendeur : on oublie les recherches dont l'alerte est
// éteinte (rallumée, sa première lecture ne signalera rien), on dit le dernier.
export function cloturer(d, { alerte, t, raison, refusees }) {
  const e = etatNormal(d);
  const garde = new Set(alerte);
  for (const id of Object.keys(e.recherches)) if (!garde.has(id)) delete e.recherches[id];
  for (const id of Object.keys(e.vus)) if (!garde.has(id)) delete e.vus[id];
  for (const x of refusees || []) e.recherches[x.id] = { ...(e.recherches[x.id] || {}), sig: null, refus: String(x.error || '').slice(0, 200) };
  e.nouvelles = garder(e.nouvelles, t);
  e.dernier = { at: iso(t), raison: raison || null };
  return e;
}

// La notification d'un passage (pure) : une par vendeur, quel que soit le nombre.
const eur = (c) => (Number.isFinite(c) ? (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €' : '');
export function notifAlertes(nv) {
  const n = nv.length;
  const ligne = (x) => `${String(x.titre || '').slice(0, 60)} · ${x.total != null ? eur(x.total) + ' port compris' : eur(x.prix) + ' + port'}`;
  const recherches = [...new Set(nv.map((x) => x.recherche).filter(Boolean))];
  return {
    cat: CAT_NOTIF, tag: 'ebay-alerte', url: URL_NOTIF,
    cle: 'ebay-alerte-' + nv.map((x) => x.itemId).sort().join('.').slice(0, 200),
    title: n === 1 ? `Nouvelle annonce eBay · ${String(nv[0].recherche || '').slice(0, 50)}` : `${n} nouvelles annonces eBay`,
    body: (n === 1 ? ligne(nv[0]) : `${nv.slice(0, 2).map(ligne).join('\n')}${n > 2 ? `\net ${n - 2} autre${n - 2 > 1 ? 's' : ''}` : ''}${recherches.length > 1 ? ` · ${recherches.length} recherches` : ''}`).slice(0, 240),
  };
}

// ── LE PASSAGE (toutes les heures) ────────────────────────────────────────
// Dépendances passées par l'appelant (api/ship-reminders.js) : `lire` (paginé,
// `null` = pas su), `lireDonnee`, `modifierDonnee` (compare-et-échange),
// `jetonApplication`, `notifier(owner, nouvelles)`. La réponse ne porte que des NOMBRES.
export async function passageAlertesEbay({ lire, lireDonnee, modifierDonnee, jetonApplication, oublierJetonApplication = () => {}, notifier = async () => null, fetcher = (...a) => globalThis.fetch(...a), origine = 'https://api.ebay.com', maintenant = Date.now(), budgetMs = 90000, exclus = [], horloge = () => Date.now() } = {}) {
  const debut = horloge();
  // Seules les lignes qui portent une recherche en alerte (filtre `cs` sur le JSON).
  const rows = await lire(`app_data?id=eq.${ID_OPERATIONS}&data->veilles=cs.${encodeURIComponent('[{"alerte":true}]')}&select=owner,veilles:data->veilles`);
  if (!Array.isArray(rows)) return { fait: false, raison: 'pas-su' };
  const vendeurs = rows.filter((r) => r && typeof r.owner === 'string' && !exclus.includes(r.owner));
  const bilan = { fait: true, vendeurs: vendeurs.length, traites: 0, recherches: 0, appelsEbay: 0, regroupees: 0, nouvelles: 0, notifies: 0, echecs: 0, plafonds: 0, enAttente: 0, budgetAtteint: false, panne: null };
  const cache = new Map();
  let pannes = 0;
  const jour = jourParis(maintenant);
  for (const row of vendeurs) {
    if (bilan.panne || horloge() - debut > budgetMs || bilan.appelsEbay >= MAX_APPELS_PASSAGE) { bilan.budgetAtteint = bilan.budgetAtteint || !bilan.panne; break; }
    const owner = row.owner;
    const veilles = Array.isArray(row.veilles) ? row.veilles : [];
    const etat = await lireDonnee(ID_ETAT, owner);
    if (etat === undefined) { bilan.echecs++; continue; }
    bilan.traites++;
    const { dues, enAttente, refusees } = aRelireMaintenant(etat, veilles, maintenant);
    bilan.enAttente += enAttente;
    const nv = [];
    let raison = null;
    for (const due of dues) {
      if (horloge() - debut > budgetMs || bilan.appelsEbay >= MAX_APPELS_PASSAGE) { bilan.budgetAtteint = true; raison = 'budget'; break; }
      // Compter AVANT d'appeler (ses 200 du jour, part automatique) ; illisible ⇒ rien ne part.
      let refus = null;
      const w = await modifierDonnee(ID_COMPTEUR, owner, (d) => {
        const n = compterAppel(d, jour, PLAFOND_VRM_JOUR, 'alerte');
        if (n === undefined) { refus = 'plafond'; return undefined; }
        if (n === null) { refus = 'plafond-auto'; return undefined; }
        refus = null; return n;
      });
      if (w !== true) { raison = 'pas-su'; bilan.echecs++; break; }
      if (refus) { raison = refus; bilan.plafonds++; break; }
      bilan.recherches++;
      let res = cache.get(due.sig);
      if (res === undefined) {
        const jeton = await jetonApplication();
        if (!jeton) { bilan.panne = 'ebay-acces'; raison = 'ebay'; res = null; }
        else {
          bilan.appelsEbay++;
          try {
            const { r, txt } = await requeteBrowse({ origine, c: due.c, jeton, fetcher });
            if (r.status === 401) oublierJetonApplication();
            let j = null; try { j = JSON.parse(txt); } catch (_) { j = null; }
            res = r.ok ? reduireResultats(j, due.c) : null;
          } catch (_) { res = null; }
        }
        if (res) { pannes = 0; cache.set(due.sig, res); } else if (++pannes >= PANNES_DE_SUITE) bilan.panne = bilan.panne || 'ebay';
      } else bilan.regroupees++;
      let trouvees = [];
      const ecrit = res
        ? await modifierDonnee(ID_ETAT, owner, (d) => { const x = integrer(d, { v: due.v, sig: due.sig, items: res.items, t: maintenant }); trouvees = x.nouvelles; return x.e; })
        : await modifierDonnee(ID_ETAT, owner, (d) => marquerEchec(d, { v: due.v, sig: due.sig, t: maintenant, raison: 'ebay' }));
      // Signalée seulement une fois RANGÉE : une écriture ratée sera retrouvée au passage suivant.
      if (ecrit === true) nv.push(...trouvees); else bilan.echecs++;
      if (!res) raison = 'ebay';
      if (bilan.panne) break;
    }
    if (dues.length || refusees.length || raison || Object.keys(etatNormal(etat).recherches).some((id) => !veillesEnAlerte(veilles).some((v) => v.id === id))) {
      await modifierDonnee(ID_ETAT, owner, (d) => cloturer(d, { alerte: veillesEnAlerte(veilles).map((v) => v.id), t: maintenant, raison, refusees }));
    }
    if (nv.length) {
      bilan.nouvelles += nv.length;
      try { const r = await notifier(owner, nv); if (r && !r.erreur) bilan.notifies++; } catch (_) { /* la liste les garde */ }
    }
  }
  return bilan;
}

// ── LA ROUTE (api/ebay.js, action `alertes`) ──────────────────────────────
// `op: 'lire'` (défaut) : la liste et l'état de chaque recherche, sans `vus` ni
// `dits` (projection) ; `op: 'ecarter'` : retirer des annonces de la liste (elles
// ne reviendront pas). Session exigée par la route. Rien d'autre n'est écrit.
export function creerRouteAlertes({ lireProjection, modifierDonnee, maintenant = () => Date.now() }) {
  async function lireVue(owner) {
    const p = await lireProjection(ID_ETAT, owner, 'recherches:data->recherches,nouvelles:data->nouvelles,ecartees:data->ecartees,dernier:data->dernier');
    if (p === undefined) return { status: 503, body: { ok: false, reason: 'pas-su', error: 'Je n’ai pas pu lire tes alertes eBay — rien n’est perdu. Réessaie dans un moment.' } };
    const t = maintenant();
    const e = etatNormal(p || {});
    const cachees = new Set(e.ecartees);
    const recherches = {};
    for (const [id, r] of Object.entries(e.recherches)) if (r && typeof r === 'object') recherches[id] = { at: r.at || null, n: Number.isSafeInteger(r.n) ? r.n : null, echec: r.echec || null, premiere: r.premiere || null, refus: r.refus || null };
    const nouvelles = garder(e.nouvelles, t).filter((n) => !cachees.has(n.itemId)).sort((a, b) => String(b.vueA).localeCompare(String(a.vueA)));
    return { status: 200, body: { ok: true, lue: p !== null, nouvelles, recherches, dernier: e.dernier, limites: { parHeure: ALERTES_PAR_HEURE, intervalleMin: INTERVALLE_MS / 60000, partAuto: PLAFOND_FIL_JOUR, plafondJour: PLAFOND_VRM_JOUR } } };
  }
  async function route(b, owner) {
    const op = b && b.op === 'ecarter' ? 'ecarter' : 'lire';
    if (op === 'ecarter') {
      const ids = Array.isArray(b.itemIds) ? b.itemIds : [];
      if (!ids.length || ids.length > MAX_NOUVELLES || !ids.every((i) => typeof i === 'string' && ITEM_RE.test(i))) return { status: 400, body: { ok: false, reason: 'criteres', error: 'Annonce illisible : rien n’a été retiré.' } };
      const w = await modifierDonnee(ID_ETAT, owner, (d) => {
        if (!d) return undefined;
        const e = etatNormal(d);
        const s = new Set(ids);
        e.ecartees = [...new Set([...e.ecartees, ...ids])].slice(-MAX_ECARTEES);
        e.nouvelles = e.nouvelles.filter((n) => !s.has(n.itemId));
        return e;
      });
      if (w !== true) return { status: 503, body: { ok: false, reason: 'pas-su', error: 'Je n’ai pas pu retirer ces annonces de la liste. Réessaie.' } };
    }
    return lireVue(owner);
  }
  return { route };
}

// La lecture projetée d'une ligne du vendeur (clé de service, `owner=eq.` :
// `portee`). `undefined` = pas su · `null` = absente.
export function lectureProjetee({ portee, cle, sbCle, url = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co', fetcher = (...a) => globalThis.fetch(...a) }) {
  return async (id, owner, select) => {
    const p = await portee(owner);
    const k = cle();
    if (!p || !k || !/^[a-z0-9_]+$/i.test(id)) return undefined;
    try {
      const r = await fetcher(`${url}/rest/v1/app_data?id=eq.${id}${p.filtre}&select=${select}`, { headers: { ...sbCle(k) } });
      if (!r.ok) return undefined;
      const rows = await r.json();
      if (!Array.isArray(rows)) return undefined;
      return rows[0] || null;
    } catch (_) { return undefined; }
  };
}
