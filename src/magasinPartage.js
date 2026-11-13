// ════════════════════════════════════════════════════════════════════════════
//  UNE SEULE COPIE DES DONNÉES LUES, PARTAGÉE PAR TOUS LES MOTEURS (13 nov., source unique)
//
//  Ventes monte deux `Comptabilite` (À expédier + la liste), Achats trois : chacun lisait,
//  fusionnait, triait et gardait SA copie des 20 000 ventes. Ce magasin garde UNE valeur
//  par clé (ex. « les ventes Vinted de ce vendeur »), servie à chaque instance abonnée ;
//  une écriture (`poser`) la change pour toutes dans le même rendu.
//
//  Ce que ce module NE fait PAS : il ne lit rien, n'écrit rien en base. Les règles de
//  lecture restent celles de l'appelant (lecture ratée ⇒ « pas su », liste partielle qui
//  n'écrase jamais une complète, etc.). Il ne garde que l'état et la lecture EN COURS.
//
//  · `lire(cle, init)`      : la valeur (créée par `init()` la première fois).
//  · `poser(cle, v | f)`    : remplace (ou `f(avant)`), prévient les abonnés.
//  · `abonner(cle, f, init)`: un moteur monté ; le dernier parti, la clé est OUBLIÉE (au
//                             prochain tour) ⇒ un écran remonté plus tard repart de `init`,
//                             exactement comme un `useState` neuf.
//  · `numero(cle)` / `estCourant(cle, n)` : un numéro de lecture PARTAGÉ — deux lectures
//                             qui se croisent, seule la plus récente écrit (tous moteurs).
//  · `partager(cle, sig, lancer)` : une lecture identique (même `sig`) déjà EN COURS est
//                             rejointe au lieu d'être relancée ; finie, elle est oubliée.
// ════════════════════════════════════════════════════════════════════════════

export function creerMagasinPartage(options = {}) {
  const planifier = options.planifier || ((f) => setTimeout(f, 0));
  const entrees = new Map();
  const entree = (cle, init) => {
    let e = entrees.get(cle);
    if (!e) {
      e = { v: typeof init === 'function' ? init() : init, abonnes: new Set(), seq: 0, enCours: new Map() };
      entrees.set(cle, e);
    }
    return e;
  };
  return {
    lire(cle, init) { return entree(cle, init).v; },
    poser(cle, suite) {
      const e = entrees.get(cle);
      if (!e) return;
      const v = typeof suite === 'function' ? suite(e.v) : suite;
      if (Object.is(v, e.v)) return;
      e.v = v;
      for (const f of [...e.abonnes]) { try { f(); } catch (_) { /* un abonné ne casse pas les autres */ } }
    },
    abonner(cle, f, init) {
      const e = entree(cle, init);
      e.abonnes.add(f);
      return () => {
        e.abonnes.delete(f);
        if (e.abonnes.size) return;
        planifier(() => { if (!e.abonnes.size && entrees.get(cle) === e) entrees.delete(cle); });
      };
    },
    numero(cle) { const e = entree(cle); e.seq += 1; return e.seq; },
    estCourant(cle, n) { const e = entrees.get(cle); return !!e && e.seq === n; },
    partager(cle, sig, lancer) {
      const e = entree(cle);
      const deja = e.enCours.get(sig);
      if (deja) return deja;
      let p;
      try { p = Promise.resolve(lancer()); } catch (err) { p = Promise.reject(err); }
      const fin = () => { if (e.enCours.get(sig) === p) e.enCours.delete(sig); };
      e.enCours.set(sig, p);
      p.then(fin, fin);
      return p;
    },
    abonnes(cle) { const e = entrees.get(cle); return e ? e.abonnes.size : 0; },
    oublier(cle) { if (cle == null) entrees.clear(); else entrees.delete(cle); },
  };
}
