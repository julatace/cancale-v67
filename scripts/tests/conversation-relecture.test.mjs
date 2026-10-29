import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { fusionnerConversation } from "../../src/conversations.js";
import {
  retourReponseVinted,
  cleReponseVinted,
} from "../../src/reponseVinted.js";
const s = fs.readFileSync(
  new URL("../../src/App.jsx", import.meta.url),
  "utf8",
);
const extraire = (a, b) => s.slice(s.indexOf(a), s.indexOf(b, s.indexOf(a)));
const fil = (body = "ancien") => ({
  id: "91",
  messages: [{ id: "1", entity_type: "message", entity: { body } }],
});
function lecteur({
  harvest = () => ({ conversation: fil() }),
  exec = () => ({ ok: false }),
  proxy = () => ({ ok: false, status: 503 }),
  extension = "ok",
} = {}) {
  const d = {
    fetchHarvestConversation: harvest,
    vmrExec: exec,
    vintedApiCall: proxy,
    extSait: () => extension,
    fusionnerConversation,
  };
  return new Function(
    ...Object.keys(d),
    extraire(
      "const fetchVintedConversationDetail = async",
      "// Aplati les entites",
    ) + ";return fetchVintedConversationDetail;",
  )(...Object.values(d));
}
test("une lecture forcée repliée sur l’archive ne prétend pas être actualisée", async () => {
  const r = await lecteur()({ vinted_user_id: "7" }, "91", { force: true });
  assert.equal(r.ok, true);
  assert.equal(r.source, "harvest");
  assert.equal(r.actualisationNonConfirmee, true);
});
test("une extension interrompue conserve le fil archivé et signale la lecture non confirmée", async () => {
  const r = await lecteur({
    exec: () => {
      throw Error("Interruption");
    },
  })({ vinted_user_id: "7" }, "91", { force: true });
  assert.equal(r.ok, true);
  assert.equal(r.actualisationNonConfirmee, true);
  assert.equal(r.conversation.messages.length, 1);
});
test("une archive indisponible n’empêche pas une lecture native réussie", async () => {
  const r = await lecteur({
    harvest: () => {
      throw Error("Archive");
    },
    exec: () => ({ ok: true, data: { conversation: fil("natif") } }),
  })({ vinted_user_id: "7" }, "91", { force: true });
  assert.equal(r.ok, true);
  assert.equal(r.source, "extension");
  assert.ok(!r.actualisationNonConfirmee);
});
test("sans aucun canal disponible le lecteur rend une erreur exploitable", async () => {
  const r = await lecteur({
    harvest: () => null,
    exec: () => {
      throw Error("Interruption");
    },
    proxy: () => {
      throw Error("Réseau");
    },
  })({ vinted_user_id: "7" }, "91", { force: true });
  assert.equal(r.ok, false);
  assert.match(r.error, /conversation|lecture/i);
});
function interfaceFil(fetch) {
  const AUTH = { user: { id: "owner-a" } },
    lectureConversationRequest = { current: 0 };
  const state = {
    value: {
      owner: "owner-a",
      request: 1,
      acc: { vinted_user_id: "7" },
      convId: "91",
      loading: false,
      conversation: fil(),
      messages: ["ancien"],
    },
  };
  const d = {
    AUTH,
    lectureConversationRequest,
    fusionnerConversation,
    fetchVintedConversationDetail: fetch,
    filAvecOffres: (c) => c,
    normalizeConversationMessages: (c) => c.messages,
    setOpenConv: (f) => {
      state.value = typeof f === "function" ? f(state.value) : f;
    },
  };
  const lecture = () =>
    new Function(
      ...Object.keys(d),
      "openConv",
      extraire(
        "  const actualiserConversation=async()=>{",
        "  // Envoi d'une réponse",
      ) + ";return actualiserConversation;",
    )(...Object.values(d), state.value)();
  return { state, d, lecture };
}
test("deux actualisations croisées gardent la réponse la plus récente", async () => {
  const attentes = [];
  const x = interfaceFil(() => new Promise((r) => attentes.push(r)));
  const a = x.lecture(),
    b = x.lecture();
  attentes[1]({ ok: true, conversation: fil("récent") });
  await b;
  attentes[0]({ ok: true, conversation: fil("périmé") });
  await a;
  assert.equal(x.state.value.conversation.messages[0].entity.body, "récent");
  assert.equal(x.state.value.refreshing, false);
});
test("une panne d’actualisation garde le fil visible et annonce comment continuer", async () => {
  const x = interfaceFil(() => {
    throw Error("Panne");
  });
  await x.lecture();
  assert.equal(x.state.value.error, undefined);
  assert.equal(x.state.value.conversation.messages[0].entity.body, "ancien");
  assert.equal(x.state.value.refreshing, false);
  assert.match(x.state.value.refreshError, /actualis|relire|Vinted/i);
});
test("le retour d’une lecture ne se publie pas après changement de propriétaire", async () => {
  let fin;
  const x = interfaceFil(() => new Promise((r) => (fin = r)));
  const a = x.lecture();
  x.d.AUTH.user.id = "owner-b";
  fin({ ok: true, conversation: fil("privé-a") });
  await a;
  assert.equal(x.state.value.conversation.messages[0].entity.body, "ancien");
});
test("une nouvelle capture invalide une lecture plus ancienne du même fil", async () => {
  let fin;
  const x = interfaceFil(() => new Promise((r) => (fin = r)));
  const a = x.lecture();
  x.d.lectureConversationRequest.current++;
  x.state.value = {
    ...x.state.value,
    conversation: fil("capture récente"),
    refreshing: false,
  };
  fin({ ok: true, conversation: fil("périmé") });
  await a;
  assert.equal(
    x.state.value.conversation.messages[0].entity.body,
    "capture récente",
  );
});

test("un repli archivé ne rétrograde pas un fil déjà plus récent", async () => {
  const x = interfaceFil(() => ({
    ok: true,
    source: "harvest",
    actualisationNonConfirmee: true,
    conversation: fil("archive ancienne"),
  }));
  x.state.value = {
    ...x.state.value,
    conversation: fil("dernier message confirmé"),
  };
  await x.lecture();
  assert.equal(
    x.state.value.conversation.messages[0].entity.body,
    "dernier message confirmé",
  );
  assert.match(x.state.value.refreshError, /non confirmée/);
});
test("un fil dont l’identité contredit le fil demandé n’est jamais affiché", async () => {
  const autre = { ...fil("autre conversation"), id: "92" };
  const r = await lecteur({
    harvest: () => ({ conversation: autre }),
    exec: () => ({ ok: true, data: { conversation: autre } }),
    proxy: () => ({ ok: true, data: { conversation: autre } }),
  })({ vinted_user_id: "7" }, "91", { force: true });
  assert.equal(r.ok, false);
  assert.equal(r.conversation, null);
});
test("une réponse vide ou mal formée ne se fait pas passer pour un fil complet", async () => {
  for (const c of [{ id: "91" }, { id: "91", messages: null }]) {
    const r = await lecteur({
      harvest: () => ({ conversation: c }),
      exec: () => ({ ok: true, data: { conversation: c } }),
    })({ vinted_user_id: "7" }, "91", { force: true });
    assert.equal(r.ok, false);
  }
});

test("le repli conserve aussi un message confirmé pas encore recapturé avec son identifiant natif", async () => {
  const x = interfaceFil(() => ({
    ok: true,
    source: "harvest",
    actualisationNonConfirmee: true,
    conversation: fil(),
  }));
  x.state.value.messages.push({
    kind: "message",
    mine: true,
    body: "Réponse confirmée",
  });
  await x.lecture();
  assert.equal(x.state.value.messages.at(-1).body, "Réponse confirmée");
});
test("un accusé de réponse confirmé empêche une lecture antérieure de masquer le message", async () => {
  let fin;
  const x = interfaceFil(() => new Promise((r) => (fin = r)));
  const attente = x.lecture();
  const oc = x.state.value;
  const d = {
    ...x.d,
    openConv: oc,
    replyText: "Bonjour",
    replyBusy: false,
    verrouReponse: { current: false },
    cleReponseVinted,
    reponsesIncertaines: {},
    etatRelais: () => ({ niveau: "vivant" }),
    setReplyBusy: () => {},
    setReplyErr: () => {},
    setReplyNotice: () => {},
    vmrExec: async () => ({ ok: true, status: 200 }),
    retourReponseVinted,
    convs: { items: [] },
    setCapturesRepondues: () => {},
    brouillonsReponse: { current: { confirmer: () => {} } },
    filOffreActuel: { current: oc },
    setReplyText: () => {},
    conversationRequest: { current: 1 },
    setReponsesIncertaines: () => {},
  };
  const envoyer = new Function(
    ...Object.keys(d),
    extraire(
      "  const sendReply = async () => {",
      "  const autoriserNouvelleReponse=async()=>{",
    ) + ";return sendReply;",
  )(...Object.values(d));
  await envoyer();
  fin({ ok: true, conversation: fil() });
  await attente;
  assert.equal(x.state.value.messages.at(-1).body, "Bonjour");
  assert.equal(x.state.value.refreshing, false);
});

test("une autorisation de réenvoi confirmée après changement de propriétaire ne déverrouille rien", async () => {
  const AUTH = { user: { id: "a" } },
    oc = { owner: "a", request: 1, acc: { vinted_user_id: "7" }, convId: "91" };
  let changements = 0;
  const d = {
    AUTH,
    openConv: oc,
    cleReponseVinted,
    conversationRequest: { current: 1 },
    askConfirm: async () => {
      AUTH.user.id = "b";
      return true;
    },
    setReponsesIncertaines: () => changements++,
    setReplyErr: () => changements++,
    setReplyNotice: () => changements++,
  };
  const autoriser = new Function(
    ...Object.keys(d),
    extraire(
      "  const autoriserNouvelleReponse=async()=>{",
      "  // ── LES GESTES D'OFFRE",
    ) + ";return autoriserNouvelleReponse;",
  )(...Object.values(d));
  await autoriser();
  assert.equal(changements, 0);
});
