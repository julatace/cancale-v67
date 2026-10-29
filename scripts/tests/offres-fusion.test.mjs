import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fusionnerConversation } from "../../src/conversations.js";
import {
  offreVintedEnAttente,
  etatOffreVinted,
} from "../../src/offresVinted.js";
import { suiviNegociationVinted } from "../../src/suiviMessagerieVinted.js";
const m = (status = 10, current = true, extra = {}) => ({
  id: 5,
  entity_type: "offer_request_message",
  entity: {
    transaction_id: 90,
    offer_request_id: 8,
    user_id: 2,
    status,
    current,
    price: { amount: "45", currency: "EUR" },
    ...extra,
  },
});
const c = (...messages) => ({
  id: 7,
  transaction: { id: 90 },
  opposite_user: { id: 2 },
  messages,
});
const worker = fs.readFileSync(
  new URL("../../vinted-sync-extension/background.js", import.meta.url),
  "utf8",
);
const code = worker
  .split("// BEGIN CONVERSATION PARTAGEE")[1]
  .split("// END CONVERSATION PARTAGEE")[0];
const ctx = vm.createContext({});
vm.runInContext(code, ctx);
for (const [nom, fusion] of [
  ["app", fusionnerConversation],
  ["extension", ctx.fusionnerConversation],
]) {
  test(
    nom +
      " : une capture périmée ne réouvre pas une offre acceptée, refusée ou précédente",
    () => {
      for (const offre of [m(20), m(30), m(10, false), m(10,true,{status_title:"Expirée"})]) {
        const avant = c(offre),
          snapshot = JSON.stringify(avant),
          r = fusion(avant, c(m()));
        assert.equal(offreVintedEnAttente(r), null);
        assert.notEqual(
          suiviNegociationVinted(r, 1, etatOffreVinted)?.libelle,
          "Offre reçue",
        );
        assert.equal(r.messages.length, 1);
        assert.equal(JSON.stringify(avant), snapshot);
      }
    },
  );
  test(nom + " : une vraie évolution en fin d’offre reste permise", () => {
    for (const status of [20, 30])
      assert.equal(
        fusion(c(m(10, false)), c(m(status))).messages[0].entity.status,
        status,
      );
  });
  test(nom + " : deux offres différentes restent distinctes", () => {
    const r = fusion(
      c(m(20)),
      c({ ...m(10, true, { offer_request_id: 9 }), id: 6 }),
    );
    assert.equal(offreVintedEnAttente(r).oid, "9");
    assert.equal(r.messages.length, 2);
  });
  test(
    nom + " : une identité contradictoire pour le même message est refusée",
    () => {
      for (const extra of [{ transaction_id: 91 }, { offer_request_id: 9 }])
        assert.equal(fusion(c(m(20)), c(m(10, true, extra))), null);
    },
  );
}
