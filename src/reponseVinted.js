// HTTP success can still carry a native business refusal (Vinted's success code is 0).
export function etatActionVinted(r) {
  const statut = Number(r?.status),
    code = r?.data?.code;
  const refusNatif = code != null && String(code) !== "0";
  if (
    r?.ok === true &&
    (r.status == null || (statut >= 200 && statut < 300)) &&
    !refusNatif
  )
    return "confirme";
  if (
    (refusNatif && statut >= 200 && statut < 300) ||
    ["plusieurs", "perime"].includes(r?.code) ||
    (statut >= 400 && statut < 500 && statut !== 408)
  )
    return "refuse";
  return "incertain";
}
export const cleActionOffreVinted = (owner, uid, conversation) =>
  JSON.stringify([String(owner), String(uid), String(conversation)]);
// Une réponse absente ou une panne serveur ne prouve pas que Vinted n’a rien reçu.
export function retourReponseVinted(r) {
  if (etatActionVinted(r) === "confirme")
    return { etat: "confirme", texte: "Message envoyé sur Vinted." };
  const status = Number(r?.status);
  if (etatActionVinted(r) === "refuse")
    return {
      etat: "refuse",
      texte:
        r?.error ||
        (typeof r?.data?.message === "string" ? r.data.message : "") ||
        `Vinted a refusé l’envoi${status >= 400 ? " (" + status + ")" : ""}. Ton texte est conservé.`,
    };
  return {
    etat: "incertain",
    texte:
      "Envoi non confirmé. Ton texte est conservé. Vérifie la conversation sur Vinted avant de renvoyer : le message a peut-être déjà été reçu.",
  };
}
export const cleReponseVinted = (uid, conversation) => `${uid}:${conversation}`;

// Brouillons uniquement en mémoire. Aucun texte n’est enregistré dans le navigateur.
// Le propriétaire courant est relu à chaque accès, y compris pour un accusé tardif.
export function creerBrouillonsReponses(ownerActuel) {
  let scope = "";
  const textes = new Map();
  const autorise = (owner) => {
    const actuel = String(ownerActuel() || "");
    if (scope !== actuel) {
      textes.clear();
      scope = actuel;
    }
    return !!actuel && String(owner || "") === actuel;
  };
  const cle = (uid, conv) => JSON.stringify([String(uid), String(conv)]);
  return {
    lire(owner, uid, conv) {
      return autorise(owner) ? textes.get(cle(uid, conv)) || "" : "";
    },
    ecrire(owner, uid, conv, texte) {
      if (!autorise(owner)) return;
      const k = cle(uid, conv);
      if (typeof texte === "string" && texte.trim()) textes.set(k, texte);
      else textes.delete(k);
    },
    confirmer(owner, uid, conv, texte) {
      if (!autorise(owner)) return;
      const k = cle(uid, conv);
      if (textes.get(k)?.trim() === texte.trim()) textes.delete(k);
    },
  };
}
