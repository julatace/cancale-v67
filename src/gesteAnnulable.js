// ══════════════════════════════════════════════════════════════════════════════
//  « ANNULER » PARTOUT, GESTES INSTANTANÉS (6 nov. 2026, v36)
// ══════════════════════════════════════════════════════════════════════════════
// Un geste INTERNE à VRM (« J'ai retiré », « C'est écrit », « Colis fait »,
// « Plus tard »…) se voit TOUT DE SUITE à l'écran (optimiste) ; l'écriture part
// derrière ; une pilule en bas de l'écran (5 s) offre « Annuler ».
//
//   · « Annuler » avant le départ de l'écriture ⇒ rien n'est écrit ; après ⇒
//     l'INVERSE est écrit (la sous-valeur d'avant, jamais un « basculer ») ;
//   · l'écriture échoue (refusée, stockage plein, lecture ratée) ⇒ l'écran
//     REVIENT en arrière et la pilule dit « Pas enregistré » avec « Réessayer » —
//     jamais un faux « enregistré » ;
//   · « pas su » ≠ « oui » : la base n'a pas répondu (réseau coupé, 5xx, pas de
//     réponse à temps) ⇒ le geste reste sur l'appareil (la file d'envoi du
//     2 nov., src/fileEnvoi.js, décision de Julien : « rien ne se perd si le
//     réseau coupe ») et la pilule le DIT (« pas encore envoyé ») ;
//   · jamais deux écritures concurrentes pour la même clé : une FILE PAR CLÉ
//     (FIFO) ; chaque écriture relit la valeur COURANTE et n'y pose que SA
//     sous-valeur (deux gestes rapides sur la même clé ⇒ aucun n'est perdu) ;
//   · une lecture ratée n'écrit RIEN (§4, §5 « Lectures et écritures ») ; le
//     comparer-et-échanger sur `data.rev` reste celui de l'écrivain
//     (`cloudPush` pour la ligne `main`, `ecrireCas` ici pour une ligne dédiée).
//
// ⚠️ Rien ici pour un geste qui part CHEZ UN TIERS (Vinted, eBay, Leboncoin,
// Vestiaire, e-mail, facture) : il ne se défait pas, il garde sa confirmation.
// Un « Annuler » sur un message envoyé serait un mensonge (inventaire :
// docs/passation/2026-11-06-annuler.md).
//
// Module PUR (minuterie, horloge et écrivains passés en paramètre) : exécuté
// tel quel par `scripts/audit-geste-annulable.cjs`.

export const DUREE_PILULE = 5000;          // ms : le temps d'« Annuler »
export const DUREE_ECHEC = 8000;           // ms : « Pas enregistré — Réessayer » reste plus longtemps
export const DUREE_ANNULE = 1800;          // ms : « Annulé »
// (11 nov., lot DJ4 — Julien : « le bouton Annuler reste constamment sur l'app ») Une pause
// (survol, focus, onglet caché) ne dure JAMAIS plus que ça : au-delà, le temps reprend. Mesuré :
// le focus du bouton « Annuler » survivait à sa disparition (aucun `blur` quand l'élément
// focalisé quitte la page) ⇒ pause jamais levée ⇒ « Annulé » puis la pilule du geste SUIVANT
// restaient à l'écran pour toujours. La pilule relit aussi son focus réel (PiluleAnnuler.jsx).
export const PAUSE_MAX = 60000;            // ms

// ── La nature d'un échec de synchronisation ─────────────────────────────────
// `statut` : 'error' | 'refus' (l'état de `_emitSync`) · `raison` : son texte.
// 'definitif' = la base ou l'appareil a REFUSÉ (l'écran revient en arrière) ;
// 'passager' = pas de réponse (le geste attend sur l'appareil, il n'est pas
// défait : la file d'envoi le renverra).
export function natureEchec(statut, raison) {
  if (statut === 'refus') return 'definitif';
  const t = String(raison || '');
  if (/refus/i.test(t)) return 'definitif';                   // « a refusé l'envoi (401/403) », « lettre … refusée »
  if (/r[ée]pondu\s+4\d\d/i.test(t)) return 'definitif';       // « la base a répondu 400 »
  if (/stockage/i.test(t)) return 'definitif';                 // « le stockage de cet appareil a refusé »
  return 'passager';
}

// ── Les opérations : une SOUS-valeur posée, et son inverse ──────────────────
// op = { k, id, type, apres, avant }
//   type 'cle'      : valeur[id] = apres (undefined ⇒ la sous-clé est retirée)
//   type 'ensemble' : id présent (apres true) ou absent (apres false) d'une
//                     liste-ensemble (tableau, ou Set côté écran)
//   type 'champs'   : fusionne les champs `apres` dans valeur[id] (un objet) ;
//                     une fiche absente n'est jamais créée par ce geste ; un
//                     champ `undefined` est retiré.
// `sens` : 'apres' (le geste) ou 'avant' (son inverse). Les deux sont
// IDEMPOTENTS : rejouer une écriture ne change rien de plus.
const estObjet = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Set);
export function appliquerOp(valeur, op, sens = 'apres') {
  const id = String(op.id);
  const cible = sens === 'avant' ? op.avant : op.apres;
  if (op.type === 'ensemble') {
    const dedans = !!cible;
    if (valeur instanceof Set) { const n = new Set(valeur); if (dedans) n.add(id); else n.delete(id); return n; }
    const l = Array.isArray(valeur) ? valeur.map(String) : [];
    const a = l.filter((x) => x !== id);
    return dedans ? [...a, id] : a;
  }
  const base = estObjet(valeur) ? valeur : {};
  if (op.type === 'champs') {
    const f = base[id];
    if (!estObjet(f)) return base;                  // jamais une fiche créée par un « C'est écrit »
    const n = { ...f };
    for (const [c, v] of Object.entries(cible || {})) { if (v === undefined) delete n[c]; else n[c] = v; }
    return { ...base, [id]: n };
  }
  const n = { ...base };
  if (cible === undefined) delete n[id]; else n[id] = cible;
  return n;
}
export function appliquerOps(valeur, ops, sens = 'apres', k = null) {
  let v = valeur;
  for (const op of ops) if (k == null || op.k === k) v = appliquerOp(v, op, sens);
  return v;
}
// Les clés touchées par une liste d'opérations, dans l'ordre.
export const clesDe = (ops) => [...new Set(ops.map((o) => o.k))];

// ── Écrire des opérations : TOUT LIRE d'abord, puis écrire ─────────────────
// `lire(k)` rend la valeur courante, ou `undefined` = PAS SU (lecture ratée) ;
// `ecrire(k, v)` rend une promesse (ou une valeur) : { ok: true|false|null,
// raison?, definitif? } (null = pas su). Une lecture ratée ⇒ AUCUNE écriture,
// pas même des clés déjà lues (sinon un geste à deux clés serait écrit à moitié).
export async function ecrireOps({ ops, sens, lire, ecrire }) {
  const cles = clesDe(ops);
  const lues = {};
  for (const k of cles) {
    let v; try { v = await lire(k); } catch (_) { v = undefined; }
    if (v === undefined) return { ok: false, definitif: true, ecrit: false, raison: 'lecture' };
    lues[k] = v;
  }
  const res = [];
  for (const k of cles) {
    let r; try { r = await ecrire(k, appliquerOps(lues[k], ops, sens, k)); } catch (e) { r = { ok: false, definitif: true, raison: String((e && e.message) || e) }; }
    res.push(r || { ok: null });
  }
  return combiner(res);
}
// Plusieurs écritures ⇒ une issue : un refus l'emporte, puis « pas su », puis ok.
export function combiner(res) {
  const echec = res.find((r) => r && r.ok === false);
  if (echec) return { ok: false, definitif: echec.definitif !== false, ecrit: true, raison: echec.raison || '' };
  if (res.some((r) => !r || r.ok == null)) return { ok: null, ecrit: true };
  const conf = res.map((r) => r.confirmation).filter(Boolean);
  return conf.length ? { ok: true, ecrit: true, confirmation: Promise.all(conf).then(combiner) } : { ok: true, ecrit: true };
}

// ── Écrire une LIGNE dédiée en comparer-et-échanger sur `data.rev` ──────────
// `lire()` ⇒ { data, rev } ou `undefined` (pas su : rien n'est écrit) ou
// { absente: true } ; `ecrire(data, revAttendue)` ⇒ { ok: true } | { devance:
// true } (un autre a écrit : on relit) | { ok: false, raison }.
export async function ecrireCas({ lire, ecrire, patch, essais = 4 }) {
  for (let i = 0; i < essais; i++) {
    let l; try { l = await lire(); } catch (_) { l = undefined; }
    if (l === undefined) return { ok: false, definitif: true, ecrit: false, raison: 'lecture' };
    const d = l && !l.absente && estObjet(l.data) ? l.data : {};
    const rev = l && Number.isSafeInteger(l.rev) ? l.rev : null;
    const nouveau = { ...patch(d), rev: (rev == null ? 0 : rev) + 1 };
    let r; try { r = await ecrire(nouveau, rev); } catch (_) { r = { ok: null }; }
    if (r && r.devance) continue;
    return r && r.ok === true ? { ok: true, ecrit: true } : r && r.ok === false ? { ok: false, definitif: true, ecrit: true, raison: r.raison || '' } : { ok: null, ecrit: true };
  }
  return { ok: null, ecrit: true, raison: 'la ligne change sans cesse ailleurs' };
}

// ── LE MOTEUR ───────────────────────────────────────────────────────────────
// geste = { texte, cles: [k…], vue(sens), ecrire(sens) ⇒ Promise<issue> }
//   vue(sens)     : SYNCHRONE, met l'écran dans l'état 'apres' ou 'avant' ;
//   ecrire(sens)  : écrit durablement ; l'issue est { ok, definitif?, ecrit?,
//                   confirmation? } — avec `confirmation` (une promesse d'issue),
//                   la file de la clé est libérée dès l'écriture LOCALE faite et
//                   la confirmation (le nuage) est suivie à part.
// États d'un geste : 'envoi' · 'enregistre' · 'garde' (pas su : sur l'appareil)
// · 'echec' (écran revenu en arrière) · 'annulation' · 'annule' ·
// 'echec-annulation' (l'inverse n'a pas pris : l'écran revient au geste).
export function creerGestes({ minuterie = (f, ms) => setTimeout(f, ms), arreter = (t) => clearTimeout(t), dureePilule = DUREE_PILULE, dureeEchec = DUREE_ECHEC, dureeAnnule = DUREE_ANNULE, delaiConfirmation = 12000, pauseMax = PAUSE_MAX } = {}) {
  let suivant = 0;
  const gestes = new Map();
  const queues = new Map();          // k ⇒ promesse de fin de la dernière écriture de k
  const abonnes = new Set();
  let visible = null;                // id du geste dont la pilule est montrée
  let timer = null, pause = false, resteMs = 0, depuis = 0, garde = null;
  const horloge = () => Date.now();

  const instantane = () => {
    const g = visible != null ? gestes.get(visible) : null;
    if (!g) return { visible: null };
    return { visible: { id: g.id, etat: g.etat, texte: g.texte, raison: g.raison || '', peutAnnuler: ['envoi', 'enregistre', 'garde'].includes(g.etat), peutReessayer: g.etat === 'echec' || g.etat === 'echec-annulation' } };
  };
  const emettre = () => { const s = instantane(); for (const f of abonnes) { try { f(s); } catch (_) {} } };
  const dureeDe = (g) => (g.etat === 'annule' ? dureeAnnule : (g.etat === 'echec' || g.etat === 'echec-annulation') ? dureeEchec : dureePilule);
  const armer = (ms) => {
    if (timer) { arreter(timer); timer = null; }
    resteMs = ms; depuis = horloge();
    if (pause || visible == null) return;
    timer = minuterie(() => { timer = null; fermer(visible); }, ms);
  };
  const montrer = (g) => { gestes.set(g.id, g); visible = g.id; armer(dureeDe(g)); emettre(); };
  // Un changement d'état du geste VISIBLE relance son minuteur ; un échec d'un
  // geste caché le remontre (un refus n'est jamais tu).
  const changer = (g, etat, raison) => {
    g.etat = etat; if (raison !== undefined) g.raison = raison;
    if (g.id === visible) { if (etat === 'enregistre' || etat === 'garde') emettre(); else montrer(g); }
    else if (etat === 'echec' || etat === 'echec-annulation') montrer(g);
  };
  const fermer = (id) => {
    if (id == null || id !== visible) return;
    if (timer) { arreter(timer); timer = null; }
    visible = null; emettre();
    const g = gestes.get(id);
    if (g && !g.enCours) gestes.delete(id);
  };

  // Une écriture mise en file sur les clés du geste. `gen` : seule l'issue de
  // la DERNIÈRE intention du geste compte (un « Annuler » rend caduque l'issue
  // tardive du geste lui-même).
  const enfiler = (g, sens, gen, surIssue) => {
    const job = { g, sens, gen, parti: false, abandonne: false };
    const attendre = Promise.all(g.cles.map((k) => queues.get(k) || Promise.resolve()));
    g.enCours = (g.enCours || 0) + 1;
    const fin = attendre.then(async () => {
      if (job.abandonne) return;
      job.parti = true;
      let r; try { r = await g.ecrire(sens); } catch (e) { r = { ok: false, definitif: true, raison: String((e && e.message) || e) }; }
      r = r || { ok: null };
      if (r.ok === true && r.confirmation) {
        // La file est libérée (écriture locale faite) ; la confirmation suit à part.
        const conf = Promise.race([r.confirmation, new Promise((ok) => minuterie(() => ok({ ok: null }), delaiConfirmation))]);
        conf.then((c) => surIssue(c || { ok: null }, job)).catch(() => surIssue({ ok: null }, job));
        return;
      }
      surIssue(r, job);
    }).catch(() => {}).finally(() => { g.enCours--; });
    for (const k of g.cles) queues.set(k, fin);
    fin.then(() => { for (const k of g.cles) if (queues.get(k) === fin) queues.delete(k); });
    return job;
  };

  const issueGeste = (r, job) => {
    const g = job.g;
    if (job.gen !== g.gen) return;                       // caduque (annulé entre-temps)
    if (r.ok === true) changer(g, 'enregistre');
    else if (r.ok === false && r.definitif !== false) {
      // Refusé : l'écran revient en arrière. Si quelque chose a été écrit sur
      // l'appareil, l'inverse y est remis (lecture ratée ⇒ rien n'a été écrit,
      // rien n'est réécrit).
      g.gen++;
      try { g.vue('avant'); } catch (_) {}
      if (r.ecrit !== false) enfiler(g, 'avant', g.gen, () => {});
      changer(g, 'echec', r.raison || '');
    } else changer(g, 'garde');
  };
  const issueAnnulation = (r, job) => {
    const g = job.g;
    if (job.gen !== g.gen) return;
    if (r.ok === false && r.definitif !== false) {
      g.gen++;
      try { g.vue('apres'); } catch (_) {}
      if (r.ecrit !== false) enfiler(g, 'apres', g.gen, () => {});
      changer(g, 'echec-annulation', r.raison || '');
    } else changer(g, 'annule');
  };

  const api = {
    // Lance un geste : l'écran change TOUT DE SUITE, l'écriture part.
    lancer({ texte, cles, vue, ecrire }) {
      const id = ++suivant;
      const g = { id, texte: String(texte || ''), cles: [...new Set((cles || []).map(String))], vue, ecrire, etat: 'envoi', gen: 1, raison: '', enCours: 0, job: null };
      gestes.set(id, g);
      try { vue('apres'); } catch (_) {}
      g.job = enfiler(g, 'apres', g.gen, issueGeste);
      montrer(g);
      return id;
    },
    annuler(id) {
      const g = gestes.get(id);
      if (!g || !['envoi', 'enregistre', 'garde'].includes(g.etat)) return false;
      g.gen++;
      try { g.vue('avant'); } catch (_) {}
      if (g.job && !g.job.parti) {
        // Pas encore partie : on l'ôte de la file, rien n'est écrit.
        g.job.abandonne = true; g.etat = 'annule'; if (g.id === visible) montrer(g); return true;
      }
      g.job = enfiler(g, 'avant', g.gen, issueAnnulation);
      changer(g, 'annulation');
      return true;
    },
    reessayer(id) {
      const g = gestes.get(id);
      if (!g) return false;
      if (g.etat === 'echec') { g.gen++; try { g.vue('apres'); } catch (_) {} g.job = enfiler(g, 'apres', g.gen, issueGeste); changer(g, 'envoi', ''); return true; }
      if (g.etat === 'echec-annulation') { g.gen++; try { g.vue('avant'); } catch (_) {} g.job = enfiler(g, 'avant', g.gen, issueAnnulation); changer(g, 'annulation', ''); return true; }
      return false;
    },
    fermer,
    // Survol, focus clavier, onglet caché : le temps d'« Annuler » s'arrête.
    suspendre(oui) {
      if (!!oui === pause) return;
      pause = !!oui;
      if (garde) { arreter(garde); garde = null; }
      if (pause) {
        if (timer) { arreter(timer); timer = null; resteMs = Math.max(0, resteMs - (horloge() - depuis)); }
        // Jamais une pause sans fin (voir PAUSE_MAX) : le temps reprend tout seul.
        garde = minuterie(() => { garde = null; if (!pause) return; pause = false; if (visible != null) armer(Math.max(1200, resteMs)); }, pauseMax);
      }
      else if (visible != null) armer(Math.max(1200, resteMs));
    },
    abonner(f) { abonnes.add(f); try { f(instantane()); } catch (_) {} return () => abonnes.delete(f); },
    etat: instantane,
    etatDe: (id) => { const g = gestes.get(id); return g ? g.etat : null; },
    // Les écritures en vol ou en file (pour un banc, ou pour fermer proprement).
    enAttente: () => [...gestes.values()].reduce((n, g) => n + (g.enCours || 0), 0),
    vider: () => Promise.all([...queues.values()]),
  };
  return api;
}

// ── L'écran suit les opérations : un setter React par clé ───────────────────
// `setters` : { [k]: setState } ; chaque setter reçoit l'état précédent (une
// carte, une liste, un Set) et rend le nouveau.
export const vueDesOps = (ops, setters) => (sens) => {
  for (const k of clesDe(ops)) { const s = setters[k]; if (typeof s === 'function') s((p) => appliquerOps(p, ops, sens, k)); }
};

// ── L'écrivain des clés de l'appareil (la ligne `main` par `save`) ──────────
// `lire(k)` : la valeur courante (null = absente) ou undefined = PAS SU ;
// `sauver(k, v, quand)` : `save` de l'app, qui appelle `quand(true|false, raison)`
// une fois l'écriture LOCALE faite (ou refusée) ; `estSynchro(k)` : la clé part
// dans le nuage ; `revision()` / `confirme()` : le compteur des sauvegardes et
// celui que le nuage a ACCEPTÉ (`_settingsRevision` / `_settingsConfirmed`) ;
// `abonnerSync(fn(statut, raison))` : les états de `cloudPush`.
// La confirmation n'est « oui » que si le nuage a accepté une écriture partie
// APRÈS ce geste (confirme ≥ la révision de ce geste) — jamais sur le « synced »
// d'un envoi parti avant lui.
export function creerEcrivainLocal({ lire, sauver, estSynchro, revision, confirme, abonnerSync }) {
  const ecrire = (k, v) => new Promise((fini) => {
    let rev = null;
    const quand = (ok, raison) => {
      if (!ok) { fini({ ok: false, definitif: true, raison: raison || 'le stockage de cet appareil a refusé la modification' }); return; }
      if (!estSynchro(k)) { fini({ ok: true }); return; }
      const confirmation = new Promise((rendu) => {
        let fait = false, off = null;
        const finir = (r) => { if (fait) return; fait = true; if (typeof off === 'function') { try { off(); } catch (_) {} } rendu(r); };
        const regarder = (statut, raisonSync) => {
          if (rev != null && confirme() >= rev) { finir({ ok: true }); return; }
          if (statut === 'refus' || statut === 'error') finir(natureEchec(statut, raisonSync) === 'definitif' ? { ok: false, definitif: true, raison: raisonSync || '' } : { ok: null, raison: raisonSync || '' });
        };
        off = abonnerSync(regarder);
        if (fait && typeof off === 'function') { try { off(); } catch (_) {} }
        if (rev != null && confirme() >= rev) finir({ ok: true });
      });
      fini({ ok: true, confirmation });
    };
    try { sauver(k, v, quand); rev = revision(); }
    catch (e) { fini({ ok: false, definitif: true, raison: String((e && e.message) || e) }); }
  });
  const lireSur = (k) => { try { return lire(k); } catch (_) { return undefined; } };
  return { ecrire, lire: lireSur };
}
