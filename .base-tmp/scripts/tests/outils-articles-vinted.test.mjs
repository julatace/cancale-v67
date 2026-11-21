import assert from "node:assert/strict";
import {
  chaineArticle,
  comparerComptes,
  diagnosticConnexion,
} from "../../src/outilsArticlesVinted.js";
// (11 nov., décision C10) L'ancien bilan d'Outils est FONDU dans src/annoncesACompleter.js (`manquesAnnonce`) :
// les mêmes règles (un manque LU est dit, un champ jamais lu est « pas su », jamais un manque) y sont jugées.
import { manquesAnnonce } from "../../src/annoncesACompleter.js";
const cles = (l) => l.map((m) => m.cle);
let n = 0;
const eg = (a, b) => {
  assert.deepEqual(a, b);
  n++;
};
eg(
  chaineArticle("3", [
    { item: "3", ancien: "2" },
    { item: "2", ancien: "1" },
  ]).ids.sort(),
  ["1", "2", "3"],
);
eg(chaineArticle("3", [], { 3: { numero: "5" }, 2: { numero: "5" } }).ids, [
  "3",
]);
eg(
  chaineArticle("3", [{ item: "3", ancien: "2" }], { 3: { recreeDe: "1" } })
    .conflit,
  true,
);
eg(
  chaineArticle("3", [
    { item: "3", ancien: "2" },
    { item: "2", ancien: "3" },
  ]).conflit,
  true,
);
eg(
  chaineArticle("3", [{ item: "3", ancien: "2" }], {
    3: { numero: "8" },
    2: { numero: "9" },
  }).ids,
  ["3"],
);
eg(chaineArticle("invalid").conflit, true);
eg(
  cles(manquesAnnonce({ titre: "Ordi", prix: 120, nPhotos: 0, descLen: 0, prixAchat: 40 }).manques),
  ["description", "photos"],
);
// Lu sans photos ni description : « pas su », jamais un manque inventé.
eg(manquesAnnonce({ titre: "Ordi", prix: 120, prixAchat: 40 }).manques, []);
eg(manquesAnnonce({ titre: "Ordi", prix: 120, prixAchat: 40 }).pasSu, ["photos", "marque", "taille", "etat"]);
// Titre et prix lus vides : manques nommés.
eg(cles(manquesAnnonce({ titre: "", prix: null, nPhotos: 6, desc: "Description", prixAchat: 40 }).manques), ["titre", "prix"]);
// Tout est là : rien à compléter.
eg(
  manquesAnnonce({ titre: "Ordi", prix: 100, nPhotos: 6, desc: "Description", marque: "X", taille: "42", etat: "Bon", champsLus: { marque: true, taille: true, etat: true }, prixAchat: 40 }).manques,
  [],
);
const acc = (uid) => ({ _acc: { vinted_user_id: uid } });
const rows = comparerComptes({
  comptes: [{ uid: "1" }, { uid: "2" }],
  ventes: [
    {
      ...acc("1"),
      date: "2026-10-01",
      price: { amount: "100.00" },
      done: true,
      meta: { buyPrice: "40", fraisComplets: true },
    },
    { ...acc("1"), date: "2026-10-01", price: "20", done: true, meta: {} },
    {
      ...acc("1"),
      date: "2026-10-01",
      price: "50",
      done: true,
      meta: { buyPrice: "55", fraisComplets: true },
    },
    { ...acc("2"), date: "2026-10-01", price: null, done: true, meta: {} },
    { ...acc("2"), date: "2026-09-01", price: "90", done: true, meta: {} },
    { ...acc("2"), done: false, price: 40 },
  ],
  stock: [acc("1"), acc("2")],
  dansPeriode: (o) => o.date === "2026-10-01",
  finalisee: (o) => o.done,
  masquee: () => false,
  meta: (o) => o.meta,
  aFaire: (o) => !o.done,
});
eg(rows[0].ca, 170);
eg(rows[0].benefice, 55);
eg(rows[0].couvertes, 2);
eg(rows[1].prixManquants, 1);
eg(rows[1].benefice, null);
eg(rows[1].taches, 1);
eg(rows[0].stock, 1);
const extension = {
  ok: true,
  vrm: { connecte: true, user_id: "a" },
  vinted: { uid: "1" },
};
eg(
  diagnosticConnexion({ uid: "2", owner: "a", extension }).titre,
  "Compte Vinted différent connecté",
);
eg(
  diagnosticConnexion({ uid: "1", owner: "b", extension }).titre,
  "Autre compte VRM connecté",
);
eg(
  diagnosticConnexion({ uid: "1", owner: "a", extension, reponse: "expiree" })
    .titre,
  "Session expirée (401)",
);
eg(
  diagnosticConnexion({
    uid: "1",
    owner: "a",
    extension,
    reponse: "incomplete",
  }).titre,
  "Lecture incomplète",
);
eg(
  diagnosticConnexion({
    uid: "1",
    owner: "a",
    extension: { ...extension, vinted: {} },
  }).titre,
  "Session Vinted non confirmée",
);
eg(
  diagnosticConnexion({ uid: "1", owner: "a", extension: null }).titre,
  "Extension non joignable",
);
eg(cles(manquesAnnonce({ titre: "Ordi", prix: "abc", nPhotos: 6, desc: "x", prixAchat: 40 }).manques).includes("prix"), true);
console.log(n + " contrôles articles et comparaison réussis");
