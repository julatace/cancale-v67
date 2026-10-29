// A completion belongs to the latest request of this view, owner and account set.
export function creerGardeLectures(ownerActuel, comptesActuels) {
  let version = 0,
    vivant = true;
  const commencer = () => {
    const n = ++version,
      owner = ownerActuel(),
      comptes = comptesActuels();
    return () =>
      vivant &&
      n === version &&
      owner === ownerActuel() &&
      comptes === comptesActuels();
  };
  commencer.invalider = () => {
    version++;
  };
  commencer.arreter = () => {
    vivant = false;
    version++;
  };
  commencer.reprendre = () => {
    vivant = true;
    version++;
  };
  return commencer;
}
export function garderConversationsNonLues(
  ancien,
  recues,
  echoues,
  autorises,
  retirees = new Set(),
) {
  const ids = new Set(
    recues.map((c) => String(c._acc?.vinted_user_id) + ":" + String(c.id)),
  );
  const garde = (Array.isArray(ancien) ? ancien : []).filter((c) => {
    const uid = String(c._acc?.vinted_user_id || "");
    return (
      autorises.has(uid) &&
      echoues.has(uid) &&
      !retirees.has(uid) &&
      !ids.has(uid + ":" + String(c.id))
    );
  });
  return [...recues, ...garde].sort(
    (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0),
  );
}
