// ════════════════════════════════════════════════════════════════════════════
//  LES GESTES D'OFFRE VINTED (accepter · refuser · contre-offre) — 21 nov., ci-offres-panneau
//
//  Jusqu'au 20 nov., ce test extrayait `actionOffre` de src/App.jsx. Le geste a été RETIRÉ de l'app sur la
//  décision de Julien (20 nov. : « toute action doit être faite dans l'extension », docs/passation/
//  2026-11-20-actions-extension.md) : la carte d'offre de l'app ouvre le panneau de l'extension, et c'est
//  `offreCarte` (vinted-sync-extension/background.js) qui part. Les garanties sont reportées sur CE chemin :
//
//   A. l'app : aucune écriture d'offre vers Vinted ne part plus de src/App.jsx (ni écrans découpés) ; la carte
//      d'offre ouvre le panneau sur CETTE conversation (le lien porte son n°, le panneau la choisit) ;
//   B. le VRAI background.js (scripts/_fond-vm.cjs, faux Vinted qui compte les requêtes) :
//      1. une action à l'issue incertaine (5xx, délai dépassé) n'est pas renvoyée par un second toucher ;
//      2. ni par un double toucher pendant l'envoi (requête TENUE, jamais un délai fixe — §6.5) ;
//      3. une acceptation confirmée, arrivée après un changement de compte dans l'onglet, reste rattachée à SON
//         offre et à SON compte ;
//      4. une relecture des conversations qui n'a pas encore vu l'acceptation (ou qui a échoué) ne repasse pas
//         l'offre confirmée « à trancher » ; le moteur automatique ne la retraite pas ;
//      5. un refus métier en HTTP 200 (`code` ≠ 0) ne confirme rien, et un nouvel essai reste possible ;
//      6. « rien n'est parti » (VRM le sait) n'est pas une issue incertaine ; sans confirmation, rien ne part.
//   Ce qui est déjà jugé ailleurs, sur le même chemin : la bascule de compte PENDANT l'attente dans la file Vinted
//   ⇒ rien ne part (scripts/audit-argent-vinted.cjs V3) ; la garde anti double-vente et « pas su » ⇒ son second
//   toucher (scripts/audit-extension-porte-app.cjs G) ; plancher et contre-offre au-dessus de son offre (idem).
//
//  `BG_SRC=<arbre>/vinted-sync-extension/background.js` : la preuve sur une autre copie (le code d'avant, une
//  mutation). Tout est inventé (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { lienPanneau } from "../../src/ouvrirPanneau.js";
import { ACTIONS_EXTENSION } from "../../src/actionsExtension.js";
const require = createRequire(import.meta.url);
require("../_source-app.cjs").brancher(); // App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const { faireFond } = require("../_fond-vm.cjs");
const SRC = process.env.BG_SRC || new URL("../../vinted-sync-extension/background.js", import.meta.url).pathname;
const BADGE = fs.readFileSync(new URL("../../vinted-sync-extension/vrm-badge.js", import.meta.url), "utf8");

const ONGLET = { tab: { id: 7, url: "https://www.vinted.fr/inbox" } };
const OFFRE = { conv: "301", prix: 40, tx: "900", oid: "901", item: "5001", titre: "Paire synthétique", pseudo: "acheteur_banc" };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\'"`])\/\/[^\n]*/g, "$1");

// Un fond : le compte 111 dans l'onglet ; `vinted(e)` répond aux écritures (peut rendre une promesse : requête tenue).
function monde(repondre) {
  let compte = "111";
  const f = faireFond({ src: SRC, connecte: "111", lignes: { main: { vinted_annonce_numeros: {} } },
    vinted: (e) => (e.methode === "GET" ? { status: 200, body: {} } : repondre(e)) });
  f.ctx.compteConnecte = async () => compte;
  f.ctx.offresEnAttente = async () => [Object.assign({}, OFFRE)]; // la relecture des conversations : l'offre y est encore
  f.basculer = (u) => { compte = u; };
  f.ecritures = () => f.j.vinted.filter((x) => x.methode !== "GET");
  f.geste = (quoi, extra = {}) => f.envoyer({ from: "vrm-badge", action: "offreCarte", quoi, tx: OFFRE.tx, oid: OFFRE.oid, confirme: true, avisVu: true, ...extra }, ONGLET);
  return f;
}
const tenue = () => { let lacher; const p = new Promise((r) => (lacher = r)); return { p, lacher: (x) => lacher(x) }; };
const unTour = () => new Promise((r) => setTimeout(r, 0));
const attendreQue = async (fn, ms = 3000) => { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) return false; await new Promise((r) => setTimeout(r, 5)); } return true; };

// ── A. L'app ─────────────────────────────────────────────────────────────────
test("A1 — aucune écriture d'offre vers Vinted ne part plus de l'app", () => {
  const app = sansCommentaires(fs.readFileSync(new URL("../../src/App.jsx", import.meta.url), "utf8"));
  assert.ok(app.length > 100000, "src/App.jsx (et ses écrans) lus");
  assert.doesNotMatch(app, /offer_requests/, "aucun chemin d'acceptation / de refus d'offre");
  assert.doesNotMatch(app, /transactions\/\$\{[^}]*\}\/offers/, "aucune contre-offre");
  assert.doesNotMatch(app, /\bconst\s+actionOffre\s*=/, "le geste retiré n'est pas revenu");
});
test("A2 — la carte d'offre ouvre le panneau de l'extension sur CETTE conversation", () => {
  const app = fs.readFileSync(new URL("../../src/App.jsx", import.meta.url), "utf8");
  const i = app.indexOf("data-offre-panneau={String(openConv.convId");
  assert.ok(i > 0, "la carte d'offre porte le n° de la conversation ouverte");
  const bloc = app.slice(i, app.indexOf("</div>", i));
  assert.match(bloc, /<BoutonExtension[^>]*action="offres"[^>]*ids=\{\[String\(openConv\.convId\|\|''\)\]\}/, "le bouton ouvre le panneau avec CETTE conversation");
  const url = new URL(lienPanneau({ site: "vinted", page: ACTIONS_EXTENSION.offres.page, ids: ["301"], action: ACTIONS_EXTENSION.offres.action }));
  assert.equal(url.hostname, "www.vinted.fr");
  assert.equal(url.searchParams.get("vrm"), "panneau");
  assert.equal(url.searchParams.get("ids"), "301");
  // Le panneau : la page « offres » est Messages, et UN n° de conversation la CHOISIT (jugé rendu : bancs/grand-panneau.cjs).
  assert.match(BADGE, /PAGES_LIEN = \{[^}]*\boffres: 'messages'/);
  assert.match(sansCommentaires(BADGE), /lienPanneau\.page === 'messages' && lienPanneau\.ids\.length === 1[^\n]*convChoisie = lienPanneau\.ids\[0\]/);
});

// ── B. L'extension ───────────────────────────────────────────────────────────
test("B1 — une action incertaine (5xx, délai dépassé) n'est pas renvoyée par un second toucher", async () => {
  for (const panne of [{ status: 500, body: {} }, { status: 0, body: null }]) {
    const f = monde(() => panne);
    const a = await f.geste("accept");
    const b = await f.geste("accept");
    const c = await f.geste("reject"); // un autre geste sur la MÊME conversation non plus
    assert.equal(f.ecritures().length, 1, `une seule requête partie (${panne.status})`);
    assert.equal(a.ok, false);
    assert.equal(a.code, "incertaine");
    assert.match(a.raison, /PEUT-ÊTRE/);
    assert.equal(b.code, "incertaine");
    assert.equal(c.code, "incertaine");
    const faites = (f.store.vrmOffresFaites || {})[OFFRE.oid];
    assert.ok(faites > 0, "le moteur automatique ne la retraitera pas non plus");
  }
});
test("B2 — un double toucher pendant l'envoi ne fait pas partir une seconde requête", async () => {
  const t = tenue();
  const f = monde(() => t.p);
  const premier = f.geste("accept");
  assert.ok(await attendreQue(() => f.ecritures().length === 1), "la première requête est partie et TENUE");
  let secondFini = false;
  const secondP = f.geste("accept").then((x) => { secondFini = true; return x; });
  await attendreQue(() => secondFini || f.ecritures().length > 1);
  const ecritesPendant = f.ecritures().length;
  t.lacher({ status: 200, body: { code: 0 } }); // (lâche aussi une seconde requête, si elle était partie)
  const second = await secondP;
  assert.equal(ecritesPendant, 1, "aucune seconde requête pendant l'envoi");
  assert.equal(second.ok, false);
  assert.ok(["en-cours", "incertaine"].includes(second.code), JSON.stringify(second));
  const r = await premier;
  assert.equal(r.ok, true);
  assert.equal(f.ecritures().length, 1);
  // Deux touchers dans le même instant (avant toute écriture de VRM) : un seul part.
  const g = monde(() => ({ status: 200, body: { code: 0 } }));
  const [x, y] = await Promise.all([g.geste("accept"), g.geste("accept")]);
  assert.equal(g.ecritures().length, 1, "deux touchers simultanés ⇒ une seule requête : " + JSON.stringify([x, y]));
  assert.equal([x, y].filter((z) => z.ok).length, 1);
});
test("B3 — une acceptation confirmée après un changement de compte reste rattachée à son offre et à son compte", async () => {
  const t = tenue();
  const f = monde(() => t.p);
  const attente = f.geste("accept");
  assert.ok(await attendreQue(() => f.ecritures().length === 1));
  f.basculer("222"); // l'onglet passe sur un autre compte pendant que la réponse est en route
  t.lacher({ status: 200, body: { code: 0 } });
  assert.equal((await attente).ok, true);
  const memo = f.store.vrmOffresCarte || {};
  const cles = Object.keys(memo);
  assert.deepEqual(cles, ["111:900:901"], "la preuve porte le compte qui a agi, la transaction et le n° de l'offre");
  assert.equal(memo["111:900:901"].etat, "confirme");
  assert.equal(memo["111:900:901"].quoi, "accept");
  f.basculer("111");
  const encore = await f.geste("accept");
  assert.equal(encore.code, "deja");
  assert.equal(f.ecritures().length, 1, "rien n'est reparti");
});
test("B4 — une relecture qui n'a pas vu l'acceptation ne repasse pas l'offre confirmée en attente", async () => {
  const f = monde(() => ({ status: 200, body: { code: 0 } }));
  const listes = async () => (await f.envoyer({ from: "vrm-badge", action: "carteListes" }, ONGLET)) || {};
  const avant = await listes();
  assert.ok(Array.isArray(avant.offres) && avant.offres.some((x) => x.oid === OFFRE.oid), "l'offre est à trancher avant le geste : " + JSON.stringify(avant.offres));
  assert.equal((await f.geste("accept")).ok, true);
  // La relecture rend l'ancienne photo (l'offre « en attente ») — ou rate (rien de neuf) : la confirmation tient.
  const apres = await listes();
  assert.ok(Array.isArray(apres.offres), "la liste des offres est rendue");
  assert.ok(!apres.offres.some((x) => x.oid === OFFRE.oid), "l'offre confirmée ne revient pas « à trancher »");
  f.ctx.offresEnAttente = async () => { throw new Error("lecture ratée"); };
  const ratee = await listes();
  assert.ok(!(ratee.offres || []).some((x) => x.oid === OFFRE.oid));
  assert.ok((f.store.vrmOffresFaites || {})[OFFRE.oid] > 0, "le moteur automatique ne la retraite pas");
});
test("B5 — un refus métier en HTTP 200 ne confirme rien, et un nouvel essai reste possible", async () => {
  const f = monde(() => ({ status: 200, body: { code: 99, message: "Refus natif" } }));
  const r = await f.geste("accept");
  assert.equal(r.ok, false);
  assert.equal(r.raison, "Refus natif");
  const memo = f.store.vrmOffresCarte || {};
  assert.ok(!Object.values(memo).some((e) => e && e.etat === "confirme"), "aucune preuve d'acceptation");
  assert.ok(!(f.store.vrmOffresFaites || {})[OFFRE.oid], "l'offre n'est pas close pour le moteur");
  const r2 = await f.geste("accept");
  assert.equal(r2.raison, "Refus natif");
  assert.equal(f.ecritures().length, 2, "refusé ⇒ rien de fait chez Vinted ⇒ il peut réessayer");
  const listes = await f.envoyer({ from: "vrm-badge", action: "carteListes" }, ONGLET);
  assert.ok((listes.offres || []).some((x) => x.oid === OFFRE.oid), "l'offre reste à trancher");
});
test("B6 — « rien n'est parti » n'est pas incertain ; sans confirmation rien ne part", async () => {
  const f = monde(() => ({ status: 200, body: { code: 0 } }));
  const etat = f.ctx.etatGesteVinted;
  assert.equal(typeof etat, "function");
  assert.equal(etat({ ok: false, status: 0, rienParti: true }), "refuse");
  assert.equal(etat({ ok: false, code: "vinted-autre", error: "autre compte" }), "refuse");
  assert.equal(etat({ ok: false, status: 429 }), "refuse");
  assert.equal(etat({ ok: false, status: 0 }), "incertain");
  assert.equal(etat({ ok: false, status: 408 }), "incertain");
  assert.equal(etat({ ok: false, status: 502 }), "incertain");
  assert.equal(etat(null), "incertain");
  assert.equal(etat({ ok: true, status: 200, data: { code: 0 } }), "confirme");
  assert.equal(etat({ ok: true, status: 200, data: { code: 7 } }), "refuse");
  const r = await f.envoyer({ from: "vrm-badge", action: "offreCarte", quoi: "accept", tx: OFFRE.tx, oid: OFFRE.oid }, ONGLET);
  assert.equal(r.code, "confirmation");
  assert.equal(f.ecritures().length, 0);
});
