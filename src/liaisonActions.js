// ══════════════════════════════════════════════════════════════════════════
// « RELIER MES ANNONCES » — LIRE, RELIER, DÉLIER (19 nov.)
//
// Ce que le parcours (src/LiaisonSites.jsx) FAIT, avec les règles de src/liaisonSites.js. Tout ce
// qui touche le navigateur, la base ou l'extension vient de l'app, PASSÉ en paramètre (`deps`) :
// ce module ne lit ni n'écrit rien lui-même — `scripts/audit-liaison-sites.cjs` l'exécute tel quel
// avec des lectures qui échouent, des cartes périmées et un écrivain qui note chaque opération.
// Chargé À LA DEMANDE (le démarrage ne le porte pas).
//
// `deps` :
//   pret()                 les données du nuage sont chargées (sinon : pas su, rien ne s'écrit)
//   proprio()              l'identifiant du compte VRM (un changement de compte abandonne le calcul)
//   lireCarte(k)           la valeur COURANTE d'une clé de liens ; `undefined` = PAS SU (lecture ratée)
//   geste(texte, ops, apres, options)   joue des opérations annulables (src/gesteAnnulable.js :
//                          chaque écriture relit la clé et n'y pose que SA sous-valeur)
//   memePhoto(force)       les propositions « même photo » (src/memePhoto.js), avec `autres`
//   annoncesAutres()       { autres, illisibles } — ses annonces Leboncoin / eBay / Vestiaire
//   pairesVinted()         { paires | null, toutesLues, sansNumero } — `[]` : un vendeur sans Vinted (ses annonces se relient entre elles)
//   pistes()               { Leboncoin: [N°], Vestiaire: [N°] } publiées par VRM, annonce pas retrouvée
//   douteux()              Set des N° portés par deux paires présentes
//   numerosConnus()        Set de tous les N° de fiches connus (null = pas su)
//   numeroVcDe(id)         le N° que VRM a donné à une annonce Vestiaire ('' sinon)
//   donnerNumero(annonce)  → { numero, servis } | { refus } : un N° NEUF par LA règle des numéros
//   refuserPhoto({ annonce, numero })   « Ce n'est pas la même » (src/memePhoto.js)
//   cleNum, marqueDe, tr, publier(etat), lire()
// ══════════════════════════════════════════════════════════════════════════
import { construireLiaison, compteurLiaison, propositionsDe, opsRelier, opsRelierLot, opsDelier, opsPlusTard, opsPropre, opsGarder, appliquerSurCartes, verifierLien, cleAnnonce, CLE_LIAISON, CLES_LIENS } from './liaisonSites.js';

export const DUREE_ANNULER_LIEN = 10000;   // ms : « Annuler » reste 10 s après un lien (puis « Délier », depuis l'annonce ou la fiche)

export function creerLiaison(deps) {
  const { pret, proprio, lireCarte, geste, memePhoto, annoncesAutres, pairesVinted, pistes, douteux, numerosConnus, numeroVcDe, donnerNumero, refuserPhoto, cleNum, marqueDe, tr, publier, lire } = deps;
  let enCours = null, at = 0, gen = 0;

  // Les cartes COURANTES, relues à chaque geste. Avant le nuage, ou une clé illisible : `undefined`
  // (pas su) — `opsRelier` refuse alors, rien n'est écrit.
  // `faits` : les N° que l'écran Annonces a donnés seul (src/articles/numerosSites.js) — le N° d'une annonce À ELLE, pas un lien.
  const CLE_FAITS = 'vrm_articles_sites';   // = CLE_ARTICLES (src/articles/modele.js)
  const cartes = () => (pret() ? { lbc: lireCarte(CLES_LIENS.Leboncoin), ebay: lireCarte(CLES_LIENS.eBay), vc: lireCarte(CLES_LIENS.Vestiaire), journal: lireCarte(CLE_LIAISON), faits: lireCarte(CLE_FAITS) } : { lbc: undefined, ebay: undefined, vc: undefined, journal: undefined, faits: undefined });
  const lus = () => { const e = lire(); return (e && e.autres) || []; };
  const sur = (f, defaut) => { try { return f(); } catch (_) { return defaut; } };

  // TOUT CALCULER (relu au plus toutes les 2 min, ou sur demande), publié dans src/liaisonEtat.js.
  async function charger(force = false) {
    if (!pret() || !proprio()) return null;
    if (enCours) return enCours;
    if (!force && Date.now() - at < 120000 && lire()) return lire();
    const depart = gen;
    enCours = (async () => {
      const qui = proprio();
      const [mp, vin, pi] = await Promise.all([memePhoto(force).catch(() => null), pairesVinted().catch(() => ({ paires: null })), pistes().catch(() => null)]);
      // Les annonces des autres sites : celles que « même photo » vient de lire, sinon lues ici.
      const ext = mp && Array.isArray(mp.autres) ? { autres: mp.autres, illisibles: mp.illisibles || [] } : await annoncesAutres().catch(() => null);
      if (proprio() !== qui) return null;
      const journal = lireCarte(CLE_LIAISON), faits = lireCarte(CLE_FAITS);
      const res = construireLiaison({ autres: ext ? ext.autres : null, paires: vin ? vin.paires : null, memePhoto: mp, journal: journal || {}, faits: faits || {}, numerosDouteux: sur(douteux, new Set()), numerosConnus: sur(numerosConnus, null), cle: cleNum, marqueDe, pistes: pi });
      // (20 nov.) LA proposition de chaque annonce « à relier », montrée sur sa rangée (src/liaisonSites.js `propositionsDe`).
      const propositions = Object.fromEntries(propositionsDe(res, { cle: cleNum, marqueDe, numerosDouteux: sur(douteux, new Set()) }));
      const etat = { ...res, propositions, compteurEntree: journal === undefined ? null : compteurLiaison(res), autres: ext ? ext.autres : null, paires: vin ? vin.paires : null, illisibles: ext ? ext.illisibles || [] : ['Leboncoin', 'eBay', 'Vestiaire'],
        vintedPartiel: !!(vin && vin.paires && vin.toutesLues === false), pairesSansNumero: (vin && vin.sansNumero) || 0, photosLues: !!(mp && mp.lu), at: Date.now(), gen: depart };
      at = Date.now();
      publier(etat);
      return etat;
    })().catch(() => null).finally(() => { enCours = null; });
    return enCours;
  }
  const relire = () => { gen++; at = 0; setTimeout(() => { charger(true); }, 60); };
  const jouer = (texte, ops, options = {}) => { gen++; at = 0; geste(texte, ops, () => relire(), { duree: DUREE_ANNULER_LIEN, ...options }); };

  // RELIER — sur SON toucher seulement (le parcours passe l'annonce et la candidate touchée).
  function relier({ annonce, paire, preuve = 'recherche', accepte = {} } = {}) {
    const r = opsRelier({ annonce, paire, preuve, cartes: cartes(), autres: lus(), numerosDouteux: sur(douteux, new Set()), cle: cleNum, marqueDe, accepte,
      numeroVc: annonce && annonce.plateforme === 'Vestiaire' ? sur(() => numeroVcDe(annonce.id), '') : '' });
    if (!r.ops) return r;
    // Un N° « à barrer » : celui que l'annonce Vestiaire portait, ou l'autre des deux N° en jeu.
    const de = r.barre || (annonce.plateforme === 'Vestiaire' ? String(((r.ops[0] || {}).apres || {}).de || '') : '');
    jouer(de ? tr('lia.fait.relieBarre', { numero: r.numero, de }) : tr('lia.fait.relie', { numero: r.numero }), r.ops);
    return { ok: true, numero: r.numero, de };
  }
  // LE LOT « Relier les N sûres » : après SA relecture photo contre photo, UN geste.
  function relierLot({ entrees } = {}) {
    const r = opsRelierLot({ entrees, cartes: cartes(), autres: lus(), numerosDouteux: sur(douteux, new Set()), cle: cleNum, marqueDe });
    if (r.refus || !r.ops.length) return { refus: r.refus || 'rien', faits: [], restes: r.restes || [] };
    jouer(tr('lia.fait.relieN', { n: r.faits.length }), r.ops);
    return { ok: true, faits: r.faits, restes: r.restes };
  }
  function delier({ annonce } = {}) {
    // (24 nov., lot ext-anciens-lots, repris de #1219) Reliée par la PHOTO D'ORIGINE (aucun lien posé, rien d'écrit) :
    // « délier » = « ce n'est pas la même » pour ce N° (sinon la photo la referait) ; son « Annuler » la remet.
    const parPhoto = annonce && Array.isArray(annonce.identites) ? annonce.identites.find((i) => i && i.sorte === 'photo-origine' && i.numero) : null;
    if (parPhoto && !(cartes().lbc || {})[String(annonce.id)]) {
      sur(() => refuserPhoto({ annonce, numero: parPhoto.numero }), null);
      relire();
      return { ok: true, numero: cleNum(parPhoto.numero) };
    }
    const r = opsDelier({ annonce, cartes: cartes(), cle: cleNum });
    if (!r.ops) return r;
    jouer(tr('lia.fait.delie', { numero: r.numero }), r.ops);
    return { ok: true, numero: r.numero };
  }
  // « C'est N°B » dans un lien qui se contredit : l'ancien lien est retiré et le nouveau posé, en UN geste.
  function remplacer({ annonce, paire } = {}) {
    const C = cartes();
    const d = opsDelier({ annonce, cartes: C, cle: cleNum });
    if (d.refus === 'pas-su') return d;
    const apres = d.ops ? appliquerSurCartes(C, d.ops) : C;
    const libre = { ...annonce, relie: false, numero: '', numeroSite: '' };
    const r = opsRelier({ annonce: libre, paire, preuve: 'relecture', cartes: apres, autres: lus().map((x) => (x && cleAnnonce(x) === cleAnnonce(annonce) ? libre : x)), numerosDouteux: sur(douteux, new Set()), cle: cleNum, marqueDe, accepte: { doutes: true },
      numeroVc: annonce.plateforme === 'Vestiaire' ? sur(() => numeroVcDe(annonce.id), '') : '' });
    if (!r.ops) return r;
    jouer(tr('lia.fait.relie', { numero: r.numero }), [...(d.ops || []), ...r.ops]);
    return { ok: true, numero: r.numero };
  }
  function plusTard({ annonce, annuler = false } = {}) {
    const r = opsPlusTard({ annonce, cartes: cartes(), annuler });
    if (!r.ops) return r;
    jouer(tr(annuler ? 'lia.fait.repris' : 'lia.fait.plusTard'), r.ops, { duree: 5000 });
    return { ok: true };
  }
  // « Elle n'est que sur ce site » : un article à elle seule. Une annonce Leboncoin sans N° reçoit le
  // SIEN (la règle des numéros, par l'app) ; `annuler` : elle revient dans la file.
  async function propre({ annonce, annuler = false } = {}) {
    const avant = cartes();
    if (!avant.journal || !avant.lbc) return { refus: 'pas-su' };
    if (annuler) { const r0 = opsPropre({ annonce, cartes: avant, annuler: true, cle: cleNum }); if (!r0.ops) return r0; jouer(tr('lia.fait.repris'), r0.ops, { duree: 5000 }); return { ok: true }; }
    let numero = '', servis = null;
    const deja = avant.journal['propre:Leboncoin:' + (annonce && annonce.id)];
    if (annonce && annonce.plateforme === 'Leboncoin' && !annonce.numeroSite && !(deja && deja.numero)) {
      const n = await donnerNumero(annonce);
      if (n && n.refus && n.refus !== 'sans-numero') return n;
      if (n && n.numero) { numero = n.numero; servis = n.servis || null; }
    }
    const r = opsPropre({ annonce, numero, cartes: cartes(), servis, cle: cleNum });
    if (!r.ops) return r;
    jouer(numero ? tr('lia.fait.propreNumero', { numero }) : tr('lia.fait.propre'), r.ops);
    return { ok: true, numero: r.numero };
  }
  function garder({ contradiction, choix = 'garder' } = {}) {
    const r = opsGarder({ contradiction, choix, cartes: cartes() });
    if (!r.ops) return r;
    jouer(tr('lia.fait.garde'), r.ops, { duree: 5000 });
    return { ok: true };
  }
  // « Aucune de celles-ci » : chaque candidate PAR PHOTO montrée est notée « pas la même ».
  function pasCellesCi({ entree } = {}) {
    for (const c of (entree && entree.candidats) || []) if (c.raison !== 'publiee' && c.paire && c.paire.numero) sur(() => refuserPhoto({ annonce: entree.annonce, numero: c.paire.numero }), null);
    return { ok: true };
  }
  // APRÈS le lien : l'annonce est RELUE avec les règles d'identité de l'app. 'verifie' · 'autre' · 'pas-su'.
  async function verifier({ cle, numero } = {}) {
    const voulu = gen;
    for (let i = 0; i < 4; i++) {
      await new Promise((ok) => setTimeout(ok, i ? 250 : 90));
      const e = await charger(true);
      if (!e || !e.lu) continue;
      if (e.gen < voulu) continue;
      return verifierLien({ entree: e.parCle.get(cle) || null, attendu: numero, cle: cleNum });
    }
    return 'pas-su';
  }
  // (20 nov.) RELIER DEPUIS LA LISTE — SON toucher sur la proposition montrée sur la rangée. La proposition est RELUE ici
  // (l'état courant) : elle doit être la même que celle qu'il a vue (`paireId`), sinon rien (« la liste a changé »). Puis
  // EXACTEMENT le geste du parcours (`relier` : `opsRelier`, toutes les gardes, annulable 10 s) — une question ou un refus
  // revient tel quel (l'écran ouvre alors le parcours sur cette annonce, où la question se pose).
  function relierProposition({ cle, paireId } = {}) {
    const e = lire();
    if (!e || !e.lu || !e.parCle || !e.propositions) return { refus: 'pas-su' };
    const entree = e.parCle.get(String(cle || '')) || null, prop = e.propositions[String(cle || '')] || null;
    if (!entree || entree.etat !== 'aRelier' || !prop || String(prop.paireId) !== String(paireId || '')) return { refus: 'proposition-perimee' };
    const paire = (e.articles || []).find((x) => String(x.id) === String(prop.paireId)) || null;
    if (!paire) return { refus: 'proposition-perimee' };
    return relier({ annonce: entree.annonce, paire, preuve: prop.niveau === 'sur' ? 'photo-sure' : prop.raison === 'photo' ? 'photo' : 'recherche' });
  }
  // « Elle n'est que sur ce site », depuis la rangée : le même geste que le parcours.
  function propreDepuisListe({ cle } = {}) {
    const e = lire();
    const entree = e && e.lu && e.parCle ? e.parCle.get(String(cle || '')) : null;
    if (!entree || entree.etat !== 'aRelier') return Promise.resolve({ refus: 'proposition-perimee' });
    return propre({ annonce: entree.annonce });
  }
  return { charger, relier, relierLot, delier, remplacer, plusTard, propre, garder, pasCellesCi, verifier, relierProposition, propreDepuisListe };
}
