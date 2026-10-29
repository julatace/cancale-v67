import assert from "node:assert/strict";
import {
  resumerLecture,
  articlesVendusAilleurs,
  conserverRetraitsNonConfirmes,
} from "../../src/bilanSynchronisation.js";
let n = 0;
const eq = (a, b) => {
  assert.deepEqual(a, b);
  n++;
};
const comptes = [
  { uid: "a", nom: "Alice" },
  { uid: "b", nom: "Bob" },
];
const ligne = (id, compte, valeurs) => ({
  id,
  compte,
  valeurs,
  titre: "Article identique",
});
const source = {
  id: "ventes",
  comptes,
  libelle: "Ventes",
  items: [ligne("1", "a", [10]), ligne("1", "b", [20])],
};
let r = resumerLecture(new Map(), source);
eq(
  r.resultats.map((x) => x.etat),
  ["initial", "initial"],
);
eq(r.resultats[0].ajouts, []);
r = resumerLecture(r.next, {
  ...source,
  items: [ligne("1", "a", [12]), ligne("2", "a", [18]), ligne("1", "b", [20])],
});
eq(r.resultats[0].ajouts.length, 1);
eq(r.resultats[0].modifies.length, 1);
eq(r.resultats[1].modifies.length, 0);
const ancien = r.next;
r = resumerLecture(r.next, {
  ...source,
  echecs: ["a"],
  items: [ligne("1", "b", [20])],
});
eq(r.resultats[0].etat, "erreur");
eq(r.next.get("ventes:a"), ancien.get("ventes:a"));
r = resumerLecture(ancien, { ...source, partiel: true, items: [] });
eq(r.resultats[0].modifies.length, 0);
eq(r.next.get("ventes:a").size, 2);
r = resumerLecture(r.next, { ...source, items: [ligne("2", "a", [18])] });
eq(r.resultats[0].ajouts.length, 0);
eq(resumerLecture(ancien, { ...source, charge: true }).resultats, []);
const numeros = { 11: { numero: "7" } };
const annonce = {
  id: "555",
  numero: "7",
  plateforme: "eBay",
  compte: "a",
  active: true,
  capture: "2026-10-01T00:00:00Z",
};
const vente = { id: "11", numero: "7", plateforme: "Vinted", engagee: true };
let d = articlesVendusAilleurs({
  numeros,
  ventes: [vente],
  annonces: [annonce],
});
eq(d.lignes.length, 1);
eq(d.lignes[0].ventes[0].plateforme, "Vinted");
eq(
  articlesVendusAilleurs({ numeros: {}, ventes: [vente], annonces: [annonce] })
    .lignes.length,
  0,
);
eq(
  articlesVendusAilleurs({
    numeros,
    ventes: [{ ...vente, engagee: false }],
    annonces: [annonce],
  }).lignes.length,
  0,
);
eq(
  articlesVendusAilleurs({
    numeros,
    ventes: [{ ...vente, plateforme: "eBay" }],
    annonces: [annonce],
  }).lignes.length,
  0,
);
eq(
  articlesVendusAilleurs({
    numeros,
    ventes: [vente],
    annonces: [{ ...annonce, active: false }],
  }).lignes.length,
  0,
);
eq(
  articlesVendusAilleurs({
    numeros: { ...numeros, 12: { numero: "7" } },
    ventes: [vente],
    annonces: [annonce],
  }).lignes.length,
  0,
);
eq(
  articlesVendusAilleurs({
    numeros: { ...numeros, 12: { numero: "7", recreeDe: "11" } },
    ventes: [vente],
    annonces: [annonce],
  }).lignes.length,
  1,
);
eq(
  articlesVendusAilleurs({
    numeros: { ...numeros, 12: { numero: "7", recreeDe: "11" } },
    ventes: [vente],
    annonces: [annonce, { ...annonce, id: "12", plateforme: "Vinted" }],
  }).lignes[0].aConfirmer,
  true,
);
eq(
  articlesVendusAilleurs({
    numeros,
    ventes: [vente, vente],
    annonces: [annonce, annonce],
  }).lignes.length,
  1,
);
let garde = conserverRetraitsNonConfirmes(d.lignes, [], { annonces: [] });
eq(garde.length, 1);
eq(garde[0].aConfirmer, true);
eq(
  conserverRetraitsNonConfirmes(garde, [], {
    annonces: [{ ...annonce, active: false }],
  }).length,
  0,
);
eq(
  conserverRetraitsNonConfirmes(garde, [], {
    annonces: [],
    completes: [
      { plateforme: "eBay", compte: "a", at: Date.parse("2026-09-01") },
    ],
  }).length,
  1,
);
eq(
  conserverRetraitsNonConfirmes(garde, [], {
    annonces: [],
    completes: [
      { plateforme: "eBay", compte: "a", at: Date.parse("2026-10-02") },
    ],
  }).length,
  0,
);

const d1 = resumerLecture(new Map(), {
  ...source,
  items: [ligne("9", "a", [{ a: 1, b: 2 }])],
});
eq(
  resumerLecture(d1.next, {
    ...source,
    items: [ligne("9", "a", [{ b: 2, a: 1 }])],
  }).resultats[0].modifies.length,
  0,
);
eq(
  resumerLecture(d1.next, {
    ...source,
    items: [ligne("9", "a", [10]), ligne("9", "a", [20])],
  }).resultats[0].etat,
  "erreur",
);

const preuve = {
  plateforme: "eBay",
  compte: "a",
  at: Date.parse("2026-10-02"),
};
eq(
  conserverRetraitsNonConfirmes(garde, [], {
    annonces: [],
    completes: [{ ...preuve, compte: "autre" }],
  }).length,
  1,
);
eq(
  conserverRetraitsNonConfirmes(garde, [], {
    annonces: [annonce],
    completes: [preuve],
  }).length,
  1,
);
eq(
  conserverRetraitsNonConfirmes(garde, [], {
    annonces: [{ ...annonce, active: null }],
    completes: [preuve],
  }).length,
  1,
);
console.log(n + " contrôles bilan et retraits réussis");
