// ═════════════════════════════════════════════════════════════════════════════
//  « MODE ORDINATEUR ALLUMÉ » — L'ORDINATEUR QUI RESTE ALLUMÉ COMME UN SERVEUR (28 nov., ext. 5.457.0, capacité `serveur`)
// ═════════════════════════════════════════════════════════════════════════════
// Julien (28 nov.) : « Je vais laisser un ordinateur allumé toute la journée, comme un serveur. […] Aujourd'hui je ne
// suis prévenu d'un message que 15 minutes après, quand l'e-mail arrive. Je veux que l'extension rafraîchisse Vinted
// régulièrement pour que j'aie une notification dès qu'il y a vraiment un nouveau message, avec la vraie question de
// la personne et le nom du compte Vinted. Il faut que ce soit parfait, irréprochable, et que je puisse agir sur les
// différents comptes. »
//
// Ce qui ne change pas (§3, non négociable) : UN compte par profil Chrome (le cookie de CE profil), on n'agit qu'au
// nom du compte de l'onglet, jamais deux comptes au même moment, une requête à la fois, pause 403/429, arrêt au
// captcha, prudence. Ce module est la RÈGLE PURE, la même dans l'app, l'extension (bloc <serveur-regle> recopié tel
// quel dans vinted-sync-extension/background.js par `node scripts/audit-ordinateur-serveur.cjs --recopie`) et le
// serveur (api/_lib/push-serveur.js, api/_lib/tour-ecriture.js l'importent).
//
//   · LA VEILLE (lecture) : la boîte de réception du compte de CE profil, relue à un intervalle TIRÉ AU HASARD (jamais
//     deux fois le même), sur le budget de LECTURE du compte (20/h, partagé avec tout ce qui lit ; la veille s'arrête à
//     `SRV_PLAFOND_LECTURES` pour laisser l'argent, les colis et les photos passer). Rien n'est monté.
//   · CE QUI EST NEUF se juge par IDENTITÉ : conversation (id) + message (entity.id) ou offre (offer_request_id) ; la
//     1re lecture d'un compte est le point de départ (`depuis`), en silence ; un message plus ancien que `depuis`, sans
//     date, de moi, ou déjà vu ne sonne jamais.
//   · LE TOUR D'ÉCRITURE : une ligne `tour_ecriture` du vendeur (comparer-et-échanger côté serveur) — un seul profil
//     (donc un seul compte) écrit à la fois chez une plateforme ; un tour se prend pour `SRV_TOUR_MS`, se prolonge
//     pendant le travail, se rend après ; périmé, il est libre. Les lectures ne prennent pas le tour (décalées au hasard).
// ═════════════════════════════════════════════════════════════════════════════

// <serveur-regle>
const SRV_INTERVALLE_MIN_MS = 4 * 60000;      // la veille relit la boîte entre 4 et 7 min, au hasard (moyenne 5 min 30 s)
const SRV_INTERVALLE_MAX_MS = 7 * 60000;
const SRV_ECART_MIN_MS = 7000;                // deux intervalles de suite diffèrent d'au moins 7 s (« jamais deux fois le même temps »)
const SRV_PLAFOND_LECTURES = 14;              // la veille s'arrête à 14 des 20 lectures/h du compte (6 restent à l'argent, aux colis, aux photos)
// « VEILLE RAPIDE » (décision de Julien du 28 nov. : « vas-y veille rapide ») : 1 min 30 à 3 min au hasard ; le budget de
// LECTURE de CE compte monte à 40/h, SEULEMENT en mode ordinateur allumé avec la veille rapide (ailleurs : 20/h) ; la veille
// s'arrête à 34 des 40 (6 restent aux autres lectures). Allumée par défaut avec le mode ; éteinte ⇒ 4–7 min et 20/h.
const SRV_RAPIDE_MIN_MS = 90000;
const SRV_RAPIDE_MAX_MS = 3 * 60000;
const SRV_RAPIDE_LECTURES_HEURE = 40;
const SRV_RAPIDE_PLAFOND = 34;
const SRV_FILS_PAR_TOUR = 3;                  // au plus 3 conversations neuves ouvertes par relecture (chacune = 1 lecture)
const SRV_CONVS_LUES = 20;                    // la 1re page de la boîte (20 conversations)
const SRV_VUS_MAX = 3000;
const SRV_DECALAGE_MS = 20000;               // deux profils de l'ordinateur ne lisent jamais à moins de 20 s l'un de l'autre
const SRV_TOUR_MS = 60000;                    // le tour d'écriture dure 60 s, prolongé pendant le travail
const SRV_TOUR_MARGE_MS = 15000;              // on le prolonge quand il reste moins de 15 s
const SRV_TEXTE_MAX = 140;                    // le texte du message dans la notification
const SRV_EMAIL_FENETRE_MS = 45 * 60000;      // l'e-mail de Vinted arrive ~15 min après : 45 min de fenêtre par conversation
const SRV_ALLUME_MS = 3 * 60000;              // même seuil que la présence « À distance »
const SRV_RE_UID = /^\d{1,20}$/;
const SRV_RE_APPAREIL = /^[a-f0-9]{16}$/;

// L'intervalle suivant, tiré au hasard dans [4 ; 7] min ([1 min 30 ; 3 min] en veille rapide), jamais à moins de 7 s du
// précédent. `alea` : un nombre [0 ; 1[.
function srvBornes(rapide) { return rapide === true ? [SRV_RAPIDE_MIN_MS, SRV_RAPIDE_MAX_MS] : [SRV_INTERVALLE_MIN_MS, SRV_INTERVALLE_MAX_MS]; }
function srvIntervalle(alea, precedent, rapide) {
  const [MIN, MAX] = srvBornes(rapide);
  const a = Number(alea), span = MAX - MIN;
  let ms = MIN + Math.floor((Number.isFinite(a) && a >= 0 && a < 1 ? a : 0.5) * span);
  const p = Number(precedent);
  if (Number.isFinite(p) && p >= MIN && p <= MAX && Math.abs(ms - p) < SRV_ECART_MIN_MS) {
    const haut = p + SRV_ECART_MIN_MS, bas = p - SRV_ECART_MIN_MS;   // l'écart (90 s au moins) laisse toujours l'un des deux
    ms = haut <= MAX && (ms >= p || bas < MIN) ? haut : bas >= MIN ? bas : haut;
  }
  return ms;
}
// Le budget de LECTURE d'un compte par heure : 40 en veille rapide du mode ordinateur allumé (CE compte), sinon 20.
function srvLecturesHeure(reglage, uidVeille, uid) {
  return reglage && reglage.on === true && reglage.rapide !== false && String(uidVeille || '') !== '' && String(uidVeille) === String(uid) ? SRV_RAPIDE_LECTURES_HEURE : 20;
}
// Une date Vinted (secondes, millisecondes, ISO) en millisecondes ; illisible ⇒ 0 (« pas su » : rien ne sonne).
function srvMs(v) {
  if (v == null || v === '') return 0;
  const n = Number(v);
  if (Number.isFinite(n)) return n > 0 ? (n < 1e12 ? n * 1000 : n) : 0;
  const t = Date.parse(String(v));
  return Number.isFinite(t) && t > 0 ? t : 0;
}
// LA BOÎTE relue : quelles conversations ont bougé depuis la dernière lecture ? `base` = { depuis, convs: { id: updated_at } }
// ou null (jamais lue sur CE profil). Rend { base, changees, premiere }. La 1re lecture ne rend RIEN à ouvrir.
// Une conversation « a bougé » si son `updated_at` a changé ET qu'elle est NON LUE (un message de moi la rend lue).
function srvChangees(base, conversations, maintenant) {
  const l = (Array.isArray(conversations) ? conversations : []).slice(0, SRV_CONVS_LUES)
    .filter((c) => c && SRV_RE_UID.test(String(c.id == null ? '' : c.id)));
  const convs = {};
  for (const c of l) convs[String(c.id)] = String(c.updated_at == null ? '' : c.updated_at);
  const b = base && typeof base === 'object' && Number(base.depuis) > 0 && base.convs && typeof base.convs === 'object' ? base : null;
  if (!b) return { base: { depuis: Number(maintenant) || 0, convs }, changees: [], premiere: true };
  const changees = l.filter((c) => c.unread === true && String(b.convs[String(c.id)] == null ? '' : b.convs[String(c.id)]) !== convs[String(c.id)]).map((c) => String(c.id));
  // La mémoire garde aussi les conversations sorties de la 1re page (une conversation qui revient n'est pas « neuve » par erreur).
  const garde = Object.assign({}, b.convs, convs);
  const cles = Object.keys(garde);
  if (cles.length > 200) for (const k of cles.slice(0, cles.length - 200)) delete garde[k];
  return { base: { depuis: Number(b.depuis), convs: garde }, changees, premiere: false };
}
// La clé d'identité d'un événement (la même dans l'extension et le serveur).
function srvCle(e) {
  if (!e) return '';
  if (e.s === 'offre') return `offre|${e.c}|${e.conv}|${e.oid}`;
  if (e.s === 'message') return `message|${e.c}|${e.conv}|${e.mid}`;
  if (e.s === 'deconnecte') return `deconnecte|${e.c}|${e.at}`;
  return '';
}
// LE FIL d'une conversation (réponse de `/api/v2/conversations/{id}`) ⇒ les événements NEUFS : messages et offres de
// L'AUTRE personne (jamais de moi), datés après `depuis`, pas déjà `vus`. Un seul événement par conversation est rendu
// (le plus récent ; `n` compte les autres), toutes leurs clés sont dans `cles` (à marquer vues ensemble).
function srvNeufsDuFil(conversation, uid, vus, depuis) {
  const c = conversation && typeof conversation === 'object' ? (conversation.conversation || conversation) : null;
  if (!c || !SRV_RE_UID.test(String(c.id == null ? '' : c.id)) || !Array.isArray(c.messages) || !SRV_RE_UID.test(String(uid || ''))) return { evs: [], cles: [] };
  const conv = String(c.id), moi = String(uid);
  const opp = c.opposite_user && c.opposite_user.id != null ? String(c.opposite_user.id) : '';
  const v = vus && typeof vus === 'object' ? vus : {};
  const d0 = Number(depuis) || 0;
  const neufs = [];
  for (const m of c.messages) {
    const en = m && m.entity && typeof m.entity === 'object' ? m.entity : null;
    if (!en) continue;
    const de = en.user_id == null ? '' : String(en.user_id);
    if (!de || de === moi || (opp && de !== opp)) continue;                     // de moi, ou pas su de qui : jamais
    const at = srvMs(m.created_at_ts != null ? m.created_at_ts : en.created_at_ts != null ? en.created_at_ts : m.created_at != null ? m.created_at : en.created_at);
    if (!at || !(at > d0)) continue;                                            // l'historique d'avant la 1re lecture : jamais
    let e = null;
    if (m.entity_type === 'message' && SRV_RE_UID.test(String(en.id == null ? '' : en.id)) && typeof en.body === 'string' && en.body.trim()) e = { s: 'message', c: moi, conv, mid: String(en.id), at };
    else if (m.entity_type === 'offer_request_message' && SRV_RE_UID.test(String(en.offer_request_id == null ? '' : en.offer_request_id))
      && en.current !== false && Number(en.status) === 10) e = { s: 'offre', c: moi, conv, oid: String(en.offer_request_id), at };
    if (!e || v[srvCle(e)]) continue;
    neufs.push(e);
  }
  if (!neufs.length) return { evs: [], cles: [] };
  neufs.sort((a, b) => a.at - b.at);
  // Une offre passe avant un message (elle demande une réponse) ; sinon le plus récent.
  const offres = neufs.filter((e) => e.s === 'offre');
  const principal = Object.assign({}, offres.length ? offres[offres.length - 1] : neufs[neufs.length - 1], { n: neufs.length });
  return { evs: [principal], cles: neufs.map(srvCle) };
}
// Le texte d'un message pour la notification : sans balise, sans lien, sans caractère de contrôle, coupé PROPREMENT
// (à un espace, jamais au milieu d'un mot ni d'un emoji) avec « … ».
function srvTexte(t, n) {
  const max = Number(n) > 10 ? Number(n) : SRV_TEXTE_MAX;
  const s = String(t == null ? '' : t).replace(/<[^>]*>/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  const pts = Array.from(s);
  if (pts.length <= max) return s;
  let coupe = pts.slice(0, max - 1).join('');
  const i = coupe.lastIndexOf(' ');
  if (i > max * 0.6) coupe = coupe.slice(0, i);
  return coupe.replace(/[\s,.;:!?·-]+$/u, '') + '…';
}
// LE TOUR D'ÉCRITURE (côté serveur, sur la ligne `tour_ecriture` lue). `d` = la ligne (ou null), `q` = { action, appareil,
// compte, geste }. Rend { data } (à écrire par comparer-et-échanger), { ok, tour } (rien à écrire) ou { refus, tour }.
//   prendre : libre (aucun tour, périmé, ou déjà à MOI pour le même compte) ⇒ à moi pour SRV_TOUR_MS ;
//             tenu par un autre profil ou pour un autre compte ⇒ refus (il dit qui, et jusqu'à quand) ;
//   rendre  : seulement le mien (sinon rien).
function srvTour(d, q, maintenant) {
  const t = Number(maintenant) || 0;
  const app = String((q && q.appareil) || ''), compte = String((q && q.compte) || '');
  if (!SRV_RE_APPAREIL.test(app) || !/^[\w:.-]{1,80}$/.test(compte)) return { refus: 'forme' };
  const cur = d && typeof d === 'object' && d.par && Number(d.jusqua) > t ? { par: String(d.par), compte: String(d.compte || ''), jusqua: Number(d.jusqua), geste: String(d.geste || '') } : null;
  const action = String((q && q.action) || '');
  if (action === 'rendre') {
    if (!cur || cur.par !== app) return { ok: true, tour: cur };
    return { data: Object.assign({}, d, { par: '', compte: '', jusqua: 0, geste: '', rendu: t }) };
  }
  if (action !== 'prendre') return { refus: 'forme' };
  if (cur && (cur.par !== app || cur.compte !== compte)) return { refus: 'occupe', tour: cur };
  const geste = String((q && q.geste) || '').replace(/[^\w-]/g, '').slice(0, 30);
  return { data: Object.assign({}, d || {}, { par: app, compte, geste, depuis: cur ? Number(d.depuis) || t : t, jusqua: t + SRV_TOUR_MS }) };
}
// L'ÉTAT d'un profil (ce que la présence publie sous `serveur`) ⇒ la ligne de la page « Ordinateur serveur ».
// Rend { code, compte, nom, lu, prochain, actions, cap, jusqua } — code : eteint · off · deconnecte · captcha · pause ·
// prudence · budget · pret. Aucun « pas su » ne vaut « prêt ».
function srvLigne(p, maintenant) {
  const t = Number(maintenant) || 0;
  if (!p || typeof p !== 'object') return null;
  const s = p.serveur && typeof p.serveur === 'object' ? p.serveur : null;
  const allume = Number(p.atMs) > 0 && t - Number(p.atMs) < SRV_ALLUME_MS && Number(p.atMs) <= t + 120000;
  const n = (x) => { const v = Number(x); return Number.isFinite(v) && v > 0 ? v : null; };
  const base = { appareil: String(p.id || ''), compte: s && SRV_RE_UID.test(String(s.uid || '')) ? String(s.uid) : '', nom: s ? String(s.nom || '').slice(0, 60) : '',
    lu: s ? n(s.lu) : null, prochain: s ? n(s.prochain) : null, actions: s && Number.isInteger(Number(s.actions)) ? Number(s.actions) : null,
    cap: s ? n(s.cap) : null, jusqua: s ? n(s.jusqua) : null, atMs: n(p.atMs), rapide: !!(s && s.rapide === true) };
  if (!allume) return Object.assign(base, { code: 'eteint' });
  if (!s || s.on !== true) return Object.assign(base, { code: 'off' });
  if (s.deconnecte === true || !base.compte) return Object.assign(base, { code: 'deconnecte' });
  if (s.captcha === true) return Object.assign(base, { code: 'captcha' });
  if (base.jusqua && base.jusqua > t && s.pause === true) return Object.assign(base, { code: 'pause' });
  if (s.prudence === true) return Object.assign(base, { code: 'prudence' });
  if (s.budget === true) return Object.assign(base, { code: 'budget' });
  return Object.assign(base, { code: 'pret' });
}
// </serveur-regle>

export {
  SRV_INTERVALLE_MIN_MS, SRV_INTERVALLE_MAX_MS, SRV_ECART_MIN_MS, SRV_PLAFOND_LECTURES, SRV_FILS_PAR_TOUR, SRV_CONVS_LUES, SRV_VUS_MAX, SRV_TOUR_MS, SRV_DECALAGE_MS,
  SRV_TOUR_MARGE_MS, SRV_TEXTE_MAX, SRV_EMAIL_FENETRE_MS, SRV_ALLUME_MS, SRV_RAPIDE_MIN_MS, SRV_RAPIDE_MAX_MS, SRV_RAPIDE_LECTURES_HEURE, SRV_RAPIDE_PLAFOND,
  srvBornes, srvLecturesHeure, srvIntervalle, srvMs, srvChangees, srvCle, srvNeufsDuFil, srvTexte, srvTour, srvLigne,
};

// ── CÔTÉ APP ────────────────────────────────────────────────────────────────
// La latence de la veille, MESURÉE sur la règle (jamais une promesse) : détection au pire = l'intervalle le plus long ;
// en moyenne, un message arrive au milieu d'un intervalle moyen.
export const SRV_LATENCE = Object.freeze({
  moyenneMs: Math.round((SRV_INTERVALLE_MIN_MS + SRV_INTERVALLE_MAX_MS) / 4),
  pireMs: SRV_INTERVALLE_MAX_MS,
  lecturesHeure: Math.round(3600000 / ((SRV_INTERVALLE_MIN_MS + SRV_INTERVALLE_MAX_MS) / 2) * 10) / 10,
});
export const SRV_LATENCE_RAPIDE = Object.freeze({
  moyenneMs: Math.round((SRV_RAPIDE_MIN_MS + SRV_RAPIDE_MAX_MS) / 4),
  pireMs: SRV_RAPIDE_MAX_MS,
  lecturesHeure: Math.round(3600000 / ((SRV_RAPIDE_MIN_MS + SRV_RAPIDE_MAX_MS) / 2) * 10) / 10,
});
// Les lignes de la page « Ordinateur serveur » : une par profil (= un compte), le plus récent d'abord ; les profils
// muets depuis plus de 7 jours ne sont plus montrés. `presences` : undefined (on lit) · null (pas su) · lignes brutes.
export function lignesServeur(presences, maintenant = Date.now()) {
  if (presences === undefined) return undefined;
  if (!Array.isArray(presences)) return null;
  return presences.map((p) => srvLigne(p, maintenant)).filter((l) => l && l.atMs && maintenant - l.atMs < 7 * 86400000)
    .sort((a, b) => (b.atMs || 0) - (a.atMs || 0));
}
// « ordinateur allumé · compte X prêt » : la phrase de `peutAgir` pour un compte Vinted servi par un profil en mode serveur.
export function profilServeurDe(presences, compte, maintenant = Date.now()) {
  const l = lignesServeur(presences, maintenant);
  if (!Array.isArray(l)) return null;
  return l.find((x) => x.compte === String(compte) && x.code !== 'eteint' && x.code !== 'off') || null;
}
