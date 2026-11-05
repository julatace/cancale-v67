import { cleNum } from "../api/_lib/numerotation.js";
// Compare only confirmed rows of the same account/source. A first read is a baseline,
// an absent row is never inferred to be deleted from a paginated/partial capture.
const serialiser = (valeur) =>
  JSON.stringify(valeur, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
export function resumerLecture(avant, source) {
  const echecs = new Set((source.echecs || []).map(String));
  const next = new Map(avant || []),
    groupes = new Map();
  for (const c of source.comptes || []) {
    const uid = String(c.uid);
    groupes.set(uid, { uid, nom: c.nom || uid, lignes: [] });
  }
  for (const x of source.items || []) {
    const uid = String(x.compte || "");
    if (groupes.has(uid) && x.id != null) groupes.get(uid).lignes.push(x);
  }
  const resultats = [];
  for (const g of groupes.values()) {
    const k = source.id + ":" + g.uid;
    const uniques = new Map();
    let contradiction = false;
    for (const x of g.lignes) {
      const cle = String(x.id);
      if (
        uniques.has(cle) &&
        serialiser(uniques.get(cle).valeurs) !== serialiser(x.valeurs)
      )
        contradiction = true;
      uniques.set(cle, x);
    }
    g.lignes = [...uniques.values()];
    if (source.erreur || echecs.has(g.uid) || contradiction) {
      resultats.push({
        ...g,
        lignes: [],
        source: source.id,
        libelle: source.libelle,
        etat: "erreur",
        precedentConserve: next.has(k),
      });
      continue;
    }
    if (!Array.isArray(source.items) || source.charge) continue;
    const lignes = new Map(
      g.lignes.map((x) => [String(x.id), serialiser(x.valeurs)]),
    );
    const precedent = next.get(k),
      ajouts = [],
      modifies = [];
    if (precedent)
      for (const x of g.lignes) {
        const old = precedent.get(String(x.id));
        if (old == null) ajouts.push(x);
        else if (old !== lignes.get(String(x.id))) modifies.push(x);
      }
    // Retain known IDs when the native history is limited or paginated.
    next.set(k, new Map([...(precedent || []), ...lignes]));
    resultats.push({
      uid: g.uid,
      nom: g.nom,
      source: source.id,
      libelle: source.libelle,
      etat: precedent ? "compare" : "initial",
      connues: lignes.size,
      ajouts,
      modifies,
      partiel: source.partiel === true,
    });
  }
  return { next, resultats };
}
// ⚠️ (1er nov., audit des parcours A6) Les N° se comparent par leur CLÉ, la
// même que l'app (`cleNum` d'App.jsx et d'`api/_lib/numerotation.js`) :
// « 007 » = « 7 », « B 125 » = « b125 » = « B125 ». Un lot « 12+15 » désigne
// les DEUX cartons (comme `numerosDeVente`). Avant, la comparaison se faisait
// en minuscules sur le texte brut : une fiche saisie « 007 » vendue sur
// Leboncoin (réf « VRM-7 ») ne sortait jamais dans « Vendus ailleurs ».
// `cleNum` est celle du serveur (`api/_lib/numerotation.js`) ; `audit-flux-divers.cjs`
// la compare à celle de l'app.
export const cleNumSync = (v) => cleNum(v);
export const numerosSync = (v) => [
  ...new Set(String(v == null ? "" : v).split("+").map(cleNumSync).filter(Boolean)),
];
export function articlesVendusAilleurs({
  numeros = {},
  ventes = [],
  annonces = [],
}) {
  const parNum = new Map();
  for (const [id, e] of Object.entries(numeros))
    if (e?.numero != null && String(e.numero).trim())
      for (const n of numerosSync(e.numero)) {
        if (!parNum.has(n)) parNum.set(n, []);
        if (!parNum.get(n).includes(String(id))) parNum.get(n).push(String(id));
      }
  // Une clé seule : connue d'une fiche, et d'UNE paire (ou d'une chaîne de
  // recréation explicite). Sinon null (ambiguë ou inconnue).
  const groupeUn = (n) => {
    if (!n) return null;
    const ids = parNum.get(n) || [];
    if (!ids.length) return null;
    if (ids.length <= 1) return n;
    // Duplicate numbers are safe only with an explicit recreation chain.
    const roots = new Set();
    for (const id of ids) {
      const vus = new Set();
      let p = id;
      while (numeros[p]?.recreeDe) {
        if (vus.has(p)) return null;
        vus.add(p);
        p = String(numeros[p].recreeDe);
      }
      roots.add(p);
    }
    return roots.size === 1 ? n : null;
  };
  // Les clés d'un N° (un lot en porte plusieurs). Une seule clé ambiguë rend
  // TOUT le N° ambigu (null) : mieux vaut un blanc qu'un faux.
  const groupe = (v) => {
    const ks = numerosSync(v);
    if (!ks.length) return null;
    const g = ks.map(groupeUn);
    return g.every(Boolean) ? g : null;
  };
  const croise = (a, b) => !!a && !!b && a.some((k) => b.includes(k));
  const retour = [],
    vus = new Set();
  let ambigus = 0;
  for (const a of annonces) {
    if (a.active !== true) continue;
    const n = groupe(a.numero);
    if (!n) {
      if (a.numero) ambigus++;
      continue;
    }
    const ventesLiees = ventes.filter(
      (v) =>
        v.engagee === true &&
        v.plateforme !== a.plateforme &&
        croise(groupe(v.numero), n),
    );
    if (!ventesLiees.length) continue;
    const cle = [a.plateforme, a.compte, a.id].join(":");
    if (vus.has(cle)) continue;
    vus.add(cle);
    const remiseEnVente = ventesLiees.some((v) =>
      annonces.some(
        (x) =>
          x.active === true &&
          x.plateforme === v.plateforme &&
          String(x.id) !== String(v.id) &&
          croise(groupe(x.numero), groupe(v.numero)),
      ),
    );
    retour.push({
      ...a,
      numero: n.join("+"),
      ventes: ventesLiees,
      aConfirmer: remiseEnVente,
      observeAt: Date.now(),
    });
  }
  return { lignes: retour, ambigus };
}

// A partial history or a failed read must not silently clear a withdrawal alert.
export function conserverRetraitsNonConfirmes(precedents, nouveau, data) {
  const cle = (a) => [a.plateforme, a.compte, a.id].join(":");
  const resultat = new Map(nouveau.map((a) => [cle(a), a]));
  for (const a of precedents || []) {
    if (resultat.has(cle(a))) continue;
    const natif = (data.annonces || []).find((x) => cle(x) === cle(a));
    if (natif?.active === false) continue;
    const preuve = (data.completes || []).find(
      (x) =>
        x.plateforme === a.plateforme &&
        x.compte != null &&
        String(x.compte) === String(a.compte),
    );
    const capture =
      typeof a.capture === "number" ? a.capture : Date.parse(a.capture || "");
    const ancien = Number.isFinite(capture) ? capture : a.observeAt;
    if (
      !natif &&
      preuve &&
      Number.isFinite(ancien) &&
      Number.isFinite(preuve.at) &&
      preuve.at > ancien &&
      preuve.at <= Date.now() + 120000
    )
      continue;
    resultat.set(cle(a), { ...a, aConfirmer: true });
  }
  return [...resultat.values()];
}
