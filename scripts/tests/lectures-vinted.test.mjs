import test from "node:test";
import assert from "node:assert/strict";
import {
  creerGardeLectures,
  garderConversationsNonLues,
} from "../../src/lecturesVinted.js";
test("une lecture ancienne, un autre propriétaire ou un autre jeu de comptes ne peut pas publier", () => {
  let owner = "a",
    comptes = "1,2";
  const lecture = creerGardeLectures(
    () => owner,
    () => comptes,
  );
  const ancienne = lecture(),
    recente = lecture();
  assert.equal(ancienne(), false);
  assert.equal(recente(), true);
  owner = "b";
  assert.equal(recente(), false);
  owner = "a";
  comptes = "1";
  assert.equal(recente(), false);
  const active = lecture();
  lecture.invalider();
  assert.equal(active(), false);
});
test("seules les conversations des comptes échoués encore autorisés sont conservées", () => {
  const c = (uid, id) => ({ id, _acc: { vinted_user_id: uid } });
  const old = [c("1", "9"), c("2", "9"), c("3", "9")],
    nouv = [c("1", "10")];
  const r = garderConversationsNonLues(
    old,
    nouv,
    new Set(["2", "3"]),
    new Set(["1", "2"]),
  );
  assert.deepEqual(
    r.map((x) => [x._acc.vinted_user_id, x.id]),
    [
      ["1", "10"],
      ["2", "9"],
    ],
  );
  assert.deepEqual(
    garderConversationsNonLues(
      old,
      nouv,
      new Set(["2"]),
      new Set(["1", "2"]),
      new Set(["2"]),
    ),
    nouv,
  );
  assert.deepEqual(
    garderConversationsNonLues(
      old,
      [c("2", "9")],
      new Set(["2"]),
      new Set(["2"]),
    ).map((x) => x.id),
    ["9"],
  );
});
test("une vue arrêtée ne redémarre pas une ancienne lecture programmée", () => {
  const lire = creerGardeLectures(
    () => "a",
    () => "1",
  );
  const ancien = lire();
  lire.arreter();
  assert.equal(ancien(), false);
  assert.equal(lire()(), false);
  lire.reprendre();
  assert.equal(ancien(), false);
  assert.equal(lire()(), true);
});
