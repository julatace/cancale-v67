// ════════════════════════════════════════════════════════════════════════════
//  CE QUE L'EXTENSION CAPTE APPARAÎT SANS RECHARGER (11 nov., second agent,
//  `claude/agent2-temps-reel`) — demande de Julien : « quand l'extension capte
//  de nouvelles infos, pas besoin de recharger VRM pour que ces données
//  apparaissent ».
// ════════════════════════════════════════════════════════════════════════════
//  Mesuré avant (origin/main) : l'app relisait ce que l'extension écrit
//    · au montage de l'écran ;
//    · au retour sur l'onglet (après ≥ 20 s d'absence) ;
//    · sur le signal `vrm:ext` — mais SEULEMENT si l'extension tourne dans CE
//      navigateur (rien sur l'iPhone, rien quand la capture vient d'un autre Mac) ;
//    · ventes seules : une sonde de 60 s sur Ventes/Journée/Colis/Messages.
//  ⇒ une annonce, un achat, une vente captés ailleurs n'arrivaient JAMAIS à un
//    écran resté ouvert et visible.
//
//  LA VEILLE (cette règle) : une petite lecture des VERSIONS des lignes du
//  vendeur écrites récemment — projection SCALAIRE (`SEL_VEILLE`, les mêmes
//  champs que la version du lot K, src/copieLignes.js ; jamais `select=data`,
//  §4.4), filtrée par `owner=eq.<uid>` et par date (`FENETRE_MS`). Une ligne dont
//  la version a changé ⇒ un signal `vrm:neuf` { ids, quoi } ; l'écran qui la
//  montre relit CETTE ligne par son chemin habituel (lot K : version ⇒ relecture
//  ciblée). Rien d'autre n'est relu.
//   · deux voies : Supabase Realtime (diffusion privée `vrm-lignes:<uid>`, posée
//     par la migration 040 — geste de Julien) quand elle répond, et le SONDAGE
//     (`PERIODE_MS`, onglet visible seulement, au rythme commun `rythmeLectures`)
//     en filet. Tant que Realtime n'a rien apporté, le sondage garde sa période ;
//     dès qu'il a PROUVÉ qu'il apporte (un message reçu), le sondage ralentit
//     (`PERIODE_REALTIME_MS`) mais ne s'arrête jamais ;
//   · budget : jamais plus d'un signal par ligne toutes les `BUDGET_LIGNE_MS`
//     (un second changement trop proche part à la fin du délai, regroupé) ;
//   · lecture ratée ⇒ RIEN : aucun signal, aucune version oubliée, rien vidé ;
//   · cloisonnée par compte VRM : l'uid est dans le filtre, le canal, et chaque
//     signal ; `arreter()` (déconnexion, autre vendeur) ferme tout ;
//   · elle n'écrit jamais rien et ne publie aucune notion : les publieurs restent
//     les mêmes, `listePlusRiche` et « lecture ratée n'écrit rien » restent ceux
//     des lecteurs qu'elle réveille.
// ════════════════════════════════════════════════════════════════════════════

export const PERIODE_MS = 25000;
export const PERIODE_REALTIME_MS = 120000;
export const BUDGET_LIGNE_MS = 10000;
export const FENETRE_MS = 10 * 60000;
export const SEL_VEILLE = 'id,updated_at,cap:meta->>capturedAt,rev:meta->>rev,sup:meta->>supprime,pg:meta->>purgedAt';
export const SUJET_CANAL = 'vrm-lignes:';
export const EVENEMENT = 'vrm:neuf';

// Une ligne ⇒ ce qu'elle porte pour les écrans (`quoi`, compte Vinted). `null` :
// une ligne que la veille ne signale pas (requêtes Vinted brutes, profils, URLs vues…).
const REGLES = [
  [/^harvest_(\d{1,20})_orders_sold$/, 'ventes'],
  [/^harvest_(\d{1,20})_txn_\d{1,20}$/, 'ventes'],
  [/^harvest_(\d{1,20})_orders_purchased$/, 'achats'],
  [/^harvest_(\d{1,20})_(listings|enligne)$/, 'annonces'],
  [/^harvest_(\d{1,20})_suivi_\d{1,20}$/, 'suivi'],
  [/^import_vinted_(\d{1,20})$/, 'import'],
  [/^actions_compte_(\d{1,20})_[A-Za-z0-9-]{1,64}$/, 'jauge'],
  [/^journal_vrm_(\d{1,20})_[A-Za-z0-9-]{1,64}$/, 'journal'],
  [/^transp_[a-z0-9]{1,30}_[A-Za-z0-9]{1,60}$/, 'transp'],
  // (16 nov., vitesse-lectures) Les familles qui manquaient (2026-11-11-temps-reel.md §7), seulement
  // celles dont l'écran a DÉJÀ un chemin de relecture sur signal :
  //   · la boîte Vinted d'un compte (`harvest_{uid}_inbox`) ⇒ Messages relit CE compte ;
  //   · Leboncoin et Vestiaire (les lignes que l'extension range et signale `maj · lbc / vestiaire`) ⇒
  //     leurs écrans relisent par le même signal (src/passerelleVeille.js) ;
  //   · un e-mail rangé (`email_reception_*`, écrit par le serveur) ⇒ la boîte e-mail montre
  //     « Actualiser » (aucune lecture de la route sans son geste).
  // Pas de `uid` pour ces trois-là (une ligne par vendeur, pas par compte).
  [/^harvest_(\d{1,20})_inbox$/, 'messages'],
  // ⚠️ Jamais une ligne que l'APP écrit elle-même (`lbc_a_retirer`, publiée par Ventes/Ma journée) : son
  // signal rejoué ferait relire, donc réécrire — une boucle, et la pastille allumée pour rien.
  [/^lbc_(?:listings|ventes|accounts|messages)$/, 'lbc'],
  [/^vc_(?:listings|ventes|session|offres|messages|achats)$/, 'vestiaire'],
  [/^email_reception_[0-9a-f]{16,64}$/, 'emails'],
  // (19 nov., retraits parfaits — Julien : « je dois voir dans l'app quand un nouveau QR code ou colis à retirer a été
  // détecté ») Un e-mail de colis rangé par le serveur (`email_track_*`) et un code de retrait lu dans une conversation
  // par l'extension (`panel_colis_relais`) : l'app relit CETTE famille (`lireSuivis`, `relireColisRelais`) ; la liste
  // « à retirer » se refait et ce qui est nouveau est annoncé (src/retraitsNouveaux.js). L'app n'écrit ni l'une ni l'autre
  // sur une relecture (aucune boucle).
  [/^email_track_[a-z0-9]{1,30}_[A-Za-z0-9_.-]{1,120}$/, 'colis'],
  [/^panel_colis_relais$/, 'retrait'],
  // (23 nov., « tous les colis en temps réel » — Julien) Un BORDEREAU reçu par e-mail (`email_bord_{tx}`, écrit par
  // api/email-inbound.js) : Colis / Ventes / Ma journée relisent la liste des bordereaux (`fetchEmailBordereaux`,
  // scalaires) — sans ceci, une vente à expédier arrivée pendant que l'écran est ouvert n'y paraissait qu'en
  // changeant d'écran. Relire n'écrit rien (aucune boucle).
  [/^email_bord_[A-Za-z0-9_.-]{3,80}$/, 'bordereaux'],
];
const SANS_COMPTE = new Set(['transp', 'lbc', 'vestiaire', 'emails', 'colis', 'retrait', 'bordereaux']);
export function quoiDe(id) {
  const s = String(id == null ? '' : id);
  for (const [re, quoi] of REGLES) { const m = re.exec(s); if (m) return { quoi, uid: SANS_COMPTE.has(quoi) ? null : m[1] }; }
  return null;
}

const n = (x) => (x === undefined || x === '' ? null : x);
export const versionVeille = (r) => JSON.stringify([n(r.updated_at), n(r.cap), n(r.rev), n(r.sup), n(r.pg)]);
const tsDe = (x) => { const t = Date.parse(x == null ? '' : String(x)); return Number.isFinite(t) ? t : null; };
const plusRecente = (r) => { let m = null; for (const t of [tsDe(r.updated_at), tsDe(r.cap), tsDe(r.pg)]) if (t != null && (m == null || t > m)) m = t; return m; };

// ── La veille ───────────────────────────────────────────────────────────────
// `lireDepuis(isoX)` → lignes `SEL_VEILLE` écrites depuis X (de CE vendeur) ou `null` (pas su).
// `diffuser({ ids, quoi:[{quoi,uid}], at })` reçoit les changements, au plus un par ligne / budget.
export function creerVeille({ uid, lireDepuis, diffuser, surLue = null, maintenant = Date.now, minuteur = setTimeout, annuler = clearTimeout, budgetMs = BUDGET_LIGNE_MS, fenetreMs = FENETRE_MS }) {
  const t0 = maintenant();
  const vus = new Map();          // id → version vue
  const dernier = new Map();      // id → heure du dernier signal
  const differes = new Map();     // id → { quoi }
  let timer = null, vivant = true, premier = true, maxVu = null, enCours = null;
  let realtimeProuve = false;
  const envoyer = (ids) => {
    if (!vivant || !ids.length) return;
    const at = maintenant();
    const quoi = []; const cles = new Set();
    for (const id of ids) { dernier.set(id, at); const q = quoiDe(id); if (q) { const k = q.quoi + '|' + q.uid; if (!cles.has(k)) { cles.add(k); quoi.push(q); } } }
    try { diffuser({ uid, ids, quoi, at }); } catch (_) {}
  };
  const planifier = () => {
    if (timer || !differes.size) return;
    const at = maintenant();
    let attente = budgetMs;
    for (const id of differes.keys()) attente = Math.min(attente, Math.max(0, (dernier.get(id) || 0) + budgetMs - at));
    timer = minuteur(() => {
      timer = null;
      const t = maintenant();
      const prets = [...differes.keys()].filter((id) => !dernier.has(id) || t - dernier.get(id) >= budgetMs);
      for (const id of prets) differes.delete(id);
      envoyer(prets);
      planifier();
    }, attente);
  };
  // Des versions arrivent (sondage ou Realtime) : ne garde que les lignes signalables qui ont CHANGÉ.
  const recevoir = (rows, { base = false } = {}) => {
    if (!vivant || !Array.isArray(rows)) return [];
    const at = maintenant();
    const maintenantIds = [];
    for (const r of rows) {
      if (!r || r.id == null) continue;
      const id = String(r.id);
      if (!quoiDe(id)) continue;
      const v = versionVeille(r);
      const avant = vus.get(id);
      vus.set(id, v);
      const ts = plusRecente(r);
      if (ts != null && (maxVu == null || ts > maxVu) && ts <= at + 60000) maxVu = ts;
      if (avant === v) continue;
      // Premier sondage : une ligne déjà là AVANT l'ouverture est celle que l'écran
      // vient de lire ; une ligne écrite depuis l'ouverture est du neuf.
      if (avant === undefined && base && !(ts != null && ts >= t0)) continue;
      const d = dernier.get(id);
      if ((d === undefined || at - d >= budgetMs) && !differes.has(id)) maintenantIds.push(id);
      else differes.set(id, true);
    }
    envoyer(maintenantIds);
    planifier();
    return maintenantIds;
  };
  const sonder = async () => {
    if (!vivant) return { ok: false };
    if (enCours) return enCours;
    enCours = (async () => {
      const at = maintenant();
      // La fenêtre part de l'heure de CET appareil : une ligne écrite par un appareil dont
      // l'horloge retarde de plus de `FENETRE_MS` n'est pas vue ici (elle l'est au retour
      // sur l'onglet, comme avant).
      const borne = new Date(at - fenetreMs).toISOString();
      const rows = await Promise.resolve().then(() => lireDepuis(borne)).catch(() => null);
      if (!vivant || !Array.isArray(rows)) return { ok: false };   // pas su ⇒ rien
      const base = premier; premier = false;
      // (22 nov. soir) La base a RÉPONDU : l'heure de cette lecture (« Mis à jour il y a 1 min » en tête d'Aujourd'hui).
      if (surLue) { try { surLue(at); } catch (_) {} }
      return { ok: true, signales: recevoir(rows, { base }) };
    })();
    try { return await enCours; } finally { enCours = null; }
  };
  return {
    sonder,
    // Un message Realtime : la même règle (version comparée, budget).
    recu(r) { if (!vivant || !r || r.id == null) return; realtimeProuve = true; recevoir([r]); },
    realtimeProuve: () => realtimeProuve,
    arreter() { vivant = false; if (timer) { annuler(timer); timer = null; } differes.clear(); vus.clear(); },
    _etat: () => ({ vus: vus.size, differes: differes.size, maxVu }),
  };
}

// ── Le canal Supabase Realtime (diffusion privée), écrit à la main ─────────────
// Protocole Phoenix v1 (JSON). Rien n'est envoyé d'autre que la jonction au sujet
// `vrm-lignes:<uid>` (avec le jeton du vendeur : la règle de `realtime.messages`
// ne laisse entrer que SON sujet) et le battement. Toute erreur ⇒ le canal se
// ferme et se retente plus tard ; la veille par sondage, elle, continue.
export function ouvrirCanal({ url, cleApi, jeton, uid, surLigne, surEtat = () => {}, WS = (typeof WebSocket !== 'undefined' ? WebSocket : null), minuteur = setTimeout, annuler = clearTimeout, intervalle = setInterval, arretIntervalle = clearInterval }) {
  if (!WS || !url || !cleApi || !uid) return { fermer() {}, etat: () => 'absent' };
  const sujet = `realtime:${SUJET_CANAL}${uid}`;
  let ws = null, ref = 0, battement = null, reprise = null, ferme = false, refuse = false, etat = 'ferme', essais = 0, jonction = null;
  const poser = (e) => { if (etat !== e) { etat = e; try { surEtat(e); } catch (_) {} } };
  const envoyer = (o) => { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); } catch (_) {} };
  const relancer = () => {
    if (ferme || refuse || reprise) return;
    essais++;
    const attente = Math.min(5 * 60000, 5000 * 2 ** Math.min(essais, 6));
    reprise = minuteur(() => { reprise = null; ouvrir(); }, attente);
  };
  const nettoyer = () => { if (battement) { arretIntervalle(battement); battement = null; } };
  function ouvrir() {
    if (ferme) return;
    const j = typeof jeton === 'function' ? jeton() : jeton;
    if (!j) { relancer(); return; }
    try { ws = new WS(`${String(url).replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(cleApi)}&vsn=1.0.0`); } catch (_) { ws = null; relancer(); return; }
    poser('connexion');
    ws.onopen = () => {
      jonction = String(++ref);
      envoyer({ topic: sujet, event: 'phx_join', ref: jonction, join_ref: jonction,
        payload: { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, postgres_changes: [], private: true }, access_token: j } });
      battement = intervalle(() => {
        envoyer({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) });
        const jt = typeof jeton === 'function' ? jeton() : jeton;
        if (jt && jt !== j) envoyer({ topic: sujet, event: 'access_token', payload: { access_token: jt }, ref: String(++ref), join_ref: jonction });
      }, 25000);
    };
    ws.onmessage = (ev) => {
      let m = null; try { m = JSON.parse(ev && ev.data); } catch (_) { return; }
      if (!m || m.topic !== sujet) return;
      if (m.event === 'phx_reply' && m.ref === jonction) {
        if (m.payload && m.payload.status === 'ok') { poser('joint'); essais = 0; }
        // Refusé (la migration 040 n'est pas posée, ou le sujet n'est pas le sien) :
        // on ne réessaie plus pendant cette ouverture ; le sondage suffit.
        else { refuse = true; poser('refuse'); try { ws.close(); } catch (_) {} }
        return;
      }
      if (m.event === 'phx_error' || m.event === 'phx_close') { try { ws.close(); } catch (_) {} return; }
      if (m.event !== 'broadcast') return;
      const p = m.payload || {};
      if (p.event && p.event !== 'ligne') return;
      const r = p.payload && typeof p.payload === 'object' ? p.payload : null;
      // Chaque message dit SON vendeur : un message d'un autre compte n'est jamais pris.
      if (!r || r.id == null || String(r.owner || '') !== String(uid)) return;
      try { surLigne(r); } catch (_) {}
    };
    ws.onclose = () => { nettoyer(); ws = null; if (!ferme && !refuse) { poser('ferme'); relancer(); } };
    ws.onerror = () => { try { ws && ws.close(); } catch (_) {} };
  }
  ouvrir();
  return {
    fermer() { ferme = true; nettoyer(); if (reprise) { annuler(reprise); reprise = null; } try { if (ws) ws.close(); } catch (_) {} ws = null; poser('ferme'); },
    etat: () => etat,
  };
}

// ── L'heure du dernier neuf, pour la pastille « Mis à jour à hh:mm » ─────────
const _ecoutes = new Set();
let _dernierNeuf = null;
export function noterNeuf(at) { _dernierNeuf = at; for (const f of _ecoutes) { try { f(at); } catch (_) {} } }
export function ecouterNeuf(f) { _ecoutes.add(f); return () => _ecoutes.delete(f); }
export const dernierNeuf = () => _dernierNeuf;
export function oublierNeuf() { _dernierNeuf = null; _derniereLue = null; }
// (22 nov. soir, maquettes de Julien) LA DERNIÈRE LECTURE RÉUSSIE de la veille : l'heure où la base a répondu (rien de deviné :
// pas encore de réponse ⇒ null, l'en-tête ne dit rien).
let _derniereLue = null; const _ecoutesLue = new Set();
export function noterLue(at) { _derniereLue = at; for (const f of _ecoutesLue) { try { f(at); } catch (_) {} } }
export function ecouterLue(f) { _ecoutesLue.add(f); return () => _ecoutesLue.delete(f); }
export const derniereLue = () => _derniereLue;
