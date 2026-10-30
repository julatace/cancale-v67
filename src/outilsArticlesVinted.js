import { centimes, beneficePaire } from "./beneficePaire.js";
export const identifiantVinted = (v) =>
  /^\d{1,20}$/.test(String(v || "")) ? String(v) : null;
// Only explicit native recreation edges establish identity. Numbers and titles never do.
export function chaineArticle(id, archives = [], numeros = {}) {
  const depart = identifiantVinted(id);
  if (!depart) return { ids: [], conflit: true };
  const parents = new Map(),
    conflits = new Set();
  const ajouter = (enfant, parent) => {
    enfant = identifiantVinted(enfant);
    parent = identifiantVinted(parent);
    if (!enfant || !parent) return;
    if (enfant === parent) {
      conflits.add(enfant);
      return;
    }
    if (parents.has(enfant) && parents.get(enfant) !== parent)
      conflits.add(enfant);
    else parents.set(enfant, parent);
  };
  archives.forEach((r) => ajouter(r.item, r.ancien));
  Object.entries(numeros).forEach(([k, v]) => ajouter(k, v?.recreeDe));
  const ids = new Set([depart]);
  let change = true;
  while (change) {
    change = false;
    for (const [e, p] of parents)
      if (!conflits.has(e) && (ids.has(e) || ids.has(p))) {
        if (!ids.has(e) || !ids.has(p)) change = true;
        ids.add(e);
        ids.add(p);
      }
  }
  let conflit = [...ids].some((x) => conflits.has(x));
  for (const x of ids) {
    const vus = new Set();
    let p = x;
    while (parents.has(p)) {
      if (vus.has(p)) {
        conflit = true;
        break;
      }
      vus.add(p);
      p = parents.get(p);
    }
  }
  const ns = new Set(
    [...ids].map((x) => String(numeros[x]?.numero || "")).filter(Boolean),
  );
  if (ns.size > 1) conflit = true;
  return { ids: conflit ? [depart] : [...ids], conflit };
}
export function bilanAnnonce(it, draft) {
  const d = String(draft?.id) === String(it.id) ? draft : null;
  const manque = [],
    inconnu = [];
  const titre = d?.title ?? it.title;
  if (!String(titre || "").trim()) manque.push("Titre");
  const prix =
    d && Object.prototype.hasOwnProperty.call(d, "price")
      ? d.price
      : typeof it.price === "object"
        ? it.price?.amount
        : it.price;
  if (centimes(prix) == null || centimes(prix) <= 0) manque.push("Prix");
  const photos =
    d?.photos?.length ??
    it.photoCount ??
    (it.photos?.length || it.photosDetail?.length || (it.photo ? 1 : null));
  if (photos === 0) manque.push("Photos");
  else if (photos == null) inconnu.push("Photos");
  const desc = d?.desc ?? it.desc ?? it.description;
  if (typeof desc === "string") {
    if (!desc.trim()) manque.push("Description");
  } else if (it.descLen === 0) manque.push("Description");
  else if (it.descLen == null) inconnu.push("Description");
  // Applicability of dimensions/brand/size depends on category: never require them globally.
  if (!d?.caracteristiques && !it.brand && !it.size)
    inconnu.push("Caractéristiques");
  return { manque, inconnu, prepare: !!d };
}
export function comparerComptes({
  comptes,
  ventes,
  stock,
  dansPeriode,
  finalisee,
  masquee,
  meta,
  aFaire,
}) {
  return comptes.map((c) => {
    const uid = String(c.uid),
      appartient = (o) =>
        String(o?._acc?.vinted_user_id || o?._uid || "") === uid;
    const lignes = ventes.filter(
      (o) => appartient(o) && !masquee(o) && finalisee(o) && dansPeriode(o),
    );
    let ca = 0,
      prixManquants = 0,
      benefice = 0,
      couvertes = 0;
    for (const o of lignes) {
      const p =
        typeof o.price === "object"
          ? (o.price?.amount ?? o.price?.value)
          : o.price;
      const b = beneficePaire(p, meta(o));
      if (b.vente == null) prixManquants++;
      else ca += b.vente;
      if (b.benefice != null && b.complet) {
        benefice += Math.round(b.benefice * 100);
        couvertes++;
      }
    }
    return {
      ...c,
      ventes: lignes.length,
      ca: ca / 100,
      prixManquants,
      benefice: couvertes ? benefice / 100 : null,
      couvertes,
      stock: stock.filter(appartient).length,
      taches: ventes.filter((o) => appartient(o) && !masquee(o) && aFaire(o))
        .length,
    };
  });
}
export function diagnosticConnexion({ uid, owner, extension, reponse }) {
  if (!extension?.ok)
    return {
      titre: "Extension non joignable",
      action: "Recharge l’extension puis actualise cet état.",
    };
  if (extension.vrm?.connecte !== true)
    return {
      titre: "Connexion VRM requise",
      action: "Ouvre l’extension et connecte-la à VRM.",
    };
  if (String(extension.vrm?.user_id || "") !== String(owner))
    return {
      titre: "Autre compte VRM connecté",
      action: "Dans l’extension, connecte le même compte VRM que cette page.",
    };
  if (extension.vinted?.uid && String(extension.vinted.uid) !== String(uid))
    return {
      titre: "Compte Vinted différent connecté",
      action: "Sur Vinted, connecte le compte indiqué sur cette ligne.",
    };
  if (!extension.vinted?.uid)
    return {
      titre: "Session Vinted non confirmée",
      action: "Ouvre Vinted et vérifie la connexion de ce compte.",
    };
  if (reponse === "expiree")
    return {
      titre: "Session expirée (401)",
      action:
        "Reconnecte ce compte sur Vinted, puis actualise les données dans VRM.",
    };
  if (reponse === "incomplete")
    return {
      titre: "Lecture incomplète",
      action:
        "Ouvre ce compte sur Vinted avec l’extension, puis actualise les données.",
    };
  return { titre: "Compte connecté confirmé", action: "" };
}
