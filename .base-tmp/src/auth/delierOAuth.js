// ═══════════════════════════════════════════════════════════════════════════
// « DÉLIER GOOGLE / DISCORD » (11 nov., lot connexions-oauth)
// ═══════════════════════════════════════════════════════════════════════════
// Règles de Supabase Auth lues dans son code (`identity.go` DeleteIdentity,
// `user.go` UpdateUserEmailFromIdentities, lus le 11 nov.) :
//   · refus si le compte n'a qu'UNE identité (`single_identity_not_deletable`) ;
//   · après le retrait, si aucune identité restante ne porte l'e-mail du compte,
//     Supabase REMPLACE l'e-mail du compte par celui d'une identité restante
//     (vérifiée d'abord, puis la plus ancienne). Son e-mail de connexion (code,
//     mot de passe oublié) change donc : on le DIT avant son clic.
//   · une adresse déjà prise par un autre compte ⇒ `email_conflict_identity_not_deletable`.
// La fiche est RELUE au clic (`fiche` : réponse de `GET /auth/v1/user`) ;
// pas su ⇒ on ne délie pas (jamais sur une liste périmée).
const nomDe = (p) => (p === 'google' ? 'Google' : 'Discord');
const emailDe = (i) => String((i && ((i.identity_data && i.identity_data.email) || i.email)) || '').trim().toLowerCase();
const verifie = (i) => !!(i && i.identity_data && (i.identity_data.email_verified === true || i.identity_data.email_verified === 'true'));
const idDe = (i) => String((i && (i.identity_id || i.id)) || '');

export function planDelier(fiche, provider, id) {
  const nom = nomDe(provider);
  if (!fiche || !Array.isArray(fiche.identities)) return { ok: false, error: 'Je n’ai pas pu relire ton compte. Réessaie dans un instant.' };
  const ids = fiche.identities.filter(Boolean);
  const cible = ids.find((i) => i.provider === provider && (!id || idDe(i) === id)) || ids.find((i) => i.provider === provider);
  if (!cible || !idDe(cible)) return { ok: false, error: `${nom} n’est déjà plus relié. Recharge la page.` };
  const restent = ids.filter((i) => i !== cible);
  // (relecture du 11 nov.) Poser un mot de passe n'ajoute AUCUNE identité chez Supabase
  // (`single_identity_not_deletable` compte les identités) : ce conseil-là menait à un refus.
  // Le seul geste qui débloque : relier l'autre fournisseur d'abord.
  const autre = provider === 'google' ? 'Discord' : 'Google';
  if (!restent.length) return { ok: false, error: `${nom} est ta seule façon de te connecter. Relie d’abord ${autre}, puis délie ${nom}.` };
  const actuel = String(fiche.email || '').trim().toLowerCase();
  let nouveau = '';
  if (actuel && !restent.some((i) => emailDe(i) === actuel)) {
    const rang = (i) => (!emailDe(i) ? 2 : verifie(i) ? 0 : 1);
    const tri = restent.slice().sort((a, b) => rang(a) - rang(b) || (Date.parse(a.created_at || '') || 0) - (Date.parse(b.created_at || '') || 0));
    nouveau = emailDe(tri[0]);
  }
  const avertissement = nouveau
    ? `Tu ne pourras plus te connecter avec ${nom}. Ton e-mail de connexion deviendra ${nouveau}. Ton compte VRM et ses données ne changent pas.`
    : `Tu ne pourras plus te connecter avec ${nom}. Ton compte VRM ne change pas.`;
  return { ok: true, id: idDe(cible), nouveauEmail: nouveau, avertissement };
}

// Le refus du `DELETE /auth/v1/user/identities/{id}`, en français.
export function refusDelier(status, j, provider) {
  const nom = nomDe(provider);
  const code = String((j && j.error_code) || '');
  const t = String((j && (j.msg || j.message)) || '');
  if (code === 'single_identity_not_deletable' || /at least 1 identity/i.test(t)) return `${nom} est ta seule façon de te connecter. Relie d’abord ${provider === 'google' ? 'Discord' : 'Google'}, puis délie ${nom}.`;
  if (code === 'identity_not_found' || /identity doesn.t exist/i.test(t)) return `${nom} n’est déjà plus relié. Recharge la page.`;
  if (code === 'email_conflict_identity_not_deletable' || /email conflict/i.test(t)) return `Impossible de délier ${nom} : l’adresse restante est déjà prise par un autre compte VRM.`;
  if (status === 401) return 'Ta session a expiré. Reconnecte-toi avant de réessayer.';
  return 'Le retrait n’a pas pu être confirmé. Réessaie.';
}
