import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  etatActionVinted,
  cleActionOffreVinted,
} from "../../src/reponseVinted.js";
import { cleOffreVinted } from "../../src/offresVinted.js";
const source = fs.readFileSync(
    new URL("../../src/App.jsx", import.meta.url),
    "utf8",
  ),
  a = source.indexOf("  const actionOffre = async"),
  bloc = source.slice(
    a,
    source.indexOf("  const autoriserNouvelleActionOffre", a),
  );
function creer(mode = "panne") {
  const AUTH = { user: { id: "owner-a" } },
    oc = {
      owner: "owner-a",
      convId: "301",
      request: 1,
      acc: { vinted_user_id: "111" },
      conversation: { transaction: { id: "9001" } },
      header: { login: "Acheteur synthétique" },
    };
  const appels = [],
    incertaines = {},
    preuves = new Map(),
    etat = { busy: false, msg: null, prix: "40" },
    courante = { current: 1 };
  let finir;
  const off = { tx: "9001", oid: "77", prix: 45 },
    fil = { current: oc };
  const d = {
    openConv: oc,
    lectureConversationRequest: { current: 0 },
    fusionnerConversation: (a, b) => b,
    AUTH,
    offreBusy: false,
    verrouOffre: { current: false },
    actionsOffresIncertaines: incertaines,
    cleActionOffreVinted,
    askConfirm: async () => mode !== "annuler",
    prixOffre: "40",
    fmtE: (n) => n + " €",
    conversationRequest: courante,
    offreEnAttenteDe: () => off,
    filOffreActuel: fil,
    cleOffreVinted,
    offresConfirmees: { current: preuves },
    setOffreBusy: (v) => (etat.busy = v),
    setOffreMsg: (v) => (etat.msg = typeof v === "function" ? v(etat.msg) : v),
    vmrExec: async (r) => {
      appels.push(r);
      if (mode === "attendre")
        return await new Promise((resolve) => (finir = resolve));
      if (mode === "panne") return { ok: false, status: 500 };
      if (mode === "metier")
        return {
          ok: true,
          status: 200,
          data: { code: 99, message: "Refus natif" },
        };
      return { ok: true, status: 200, data: { code: 0 } };
    },
    etatActionVinted,
    setActionsOffresIncertaines: (f) => {
      const n = f({ ...incertaines });
      for (const k of Object.keys(incertaines)) delete incertaines[k];
      Object.assign(incertaines, n);
    },
    setOpenConv: (f) => f(oc),
    filAvecOffres: (c) => c,
    normalizeConversationMessages: () => [],
    setPrixOffre: (v) =>
      (etat.prix = typeof v === "function" ? v(etat.prix) : v),
    fetchVintedConversationDetail: async () => {
      if (mode === "relecture-ratee") throw Error("Lecture échouée");
      return { ok: false };
    },
  };
  const action = new Function(...Object.keys(d), bloc + ";return actionOffre;")(
    ...Object.values(d),
  );
  return {
    action,
    AUTH,
    appels,
    incertaines,
    preuves,
    etat,
    courante,
    off,
    finir: (r) => finir(r),
  };
}
test("une action incertaine ne peut pas être renvoyée automatiquement ou par double clic", async () => {
  const x = creer();
  await x.action("offre");
  await x.action("offre");
  assert.equal(x.appels.length, 1);
  assert.equal(x.etat.prix, "40");
  assert.equal(x.etat.busy, false);
  assert.equal(
    x.incertaines[cleActionOffreVinted("owner-a", "111", "301")],
    true,
  );
});
test("une acceptation confirmée arrivée après changement de fil reste rattachée à son offre", async () => {
  const x = creer("attendre");
  const attente = x.action("accept", x.off);
  await new Promise((r) => setTimeout(r, 0));
  x.courante.current = 2;
  x.finir({ ok: true, status: 200 });
  await attente;
  assert.equal(x.preuves.get(cleOffreVinted("111", x.off)), 20);
  assert.equal(x.etat.msg, null);
  assert.equal(Object.keys(x.incertaines).length, 0);
});
test("une offre déjà confirmée ne repasse pas en attente si la relecture échoue", async () => {
  const x = creer("relecture-ratee");
  await x.action("accept", x.off);
  assert.equal(x.preuves.get(cleOffreVinted("111", x.off)), 20);
  assert.equal(Object.keys(x.incertaines).length, 0);
  assert.ok(x.etat.msg.ok.includes("confirmé"));
  assert.equal(x.etat.busy, false);
});
test("un refus métier HTTP 200 ne confirme ni prix ni envoi", async () => {
  const x = creer("metier");
  await x.action("accept", x.off);
  assert.equal(x.preuves.size, 0);
  assert.equal(x.etat.msg.err, "Refus natif");
  assert.equal(Object.keys(x.incertaines).length, 0);
});
test("confirmation annulée : aucune requête envoyée", async () => {
  const x = creer("annuler");
  await x.action("accept", x.off);
  assert.equal(x.appels.length, 0);
});
test("une réponse tardive ne modifie pas le compte suivant", async () => {
  const x = creer("attendre");
  const attente = x.action("accept", x.off);
  await new Promise((r) => setTimeout(r, 0));
  x.AUTH.user.id = "owner-b";
  x.finir({ ok: true, status: 200 });
  await attente;
  assert.equal(x.preuves.size, 0);
  assert.equal(Object.keys(x.incertaines).length, 0);
  assert.equal(x.etat.msg, null);
});
test("le verrou couvre l’attente réseau et un nouveau prix saisi est conservé", async () => {
  const x = creer("attendre");
  const attente = x.action("offre");
  await x.action("offre");
  assert.equal(x.appels.length, 1);
  x.etat.prix = "41";
  x.finir({ ok: true, status: 200 });
  await attente;
  assert.equal(x.etat.prix, "41");
  assert.equal(x.etat.busy, false);
});
