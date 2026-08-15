// ── À QUI APPARTIENT UNE LIGNE ÉCRITE PAR LE SERVEUR ? ────────────────────────
// Les routes `api/*` tournent sans vendeur connecté : un email qui arrive, un
// rappel d'expédition, un abonnement aux notifications. Tant que la base n'est
// pas cloisonnée, la question ne se pose pas — il n'y a qu'un jeu de données.
//
// ⚠️ Dès que la migration multi-vendeurs est passée (colonne `owner` + RLS),
// une ligne écrite SANS propriétaire n'appartient à personne : le vendeur ne la
// verra jamais, et l'email arrivé pendant la nuit sera silencieusement perdu.
// La clé de service contourne bien RLS pour ÉCRIRE, mais elle ne devine pas à
// qui la ligne est destinée.
//
// Réglage : `VRM_OWNER_UID` (variable d'environnement Vercel) = l'identifiant du
// vendeur propriétaire de cette installation. Tant qu'elle n'est pas définie, on
// n'ajoute rien et le comportement reste EXACTEMENT celui d'aujourd'hui.
//
// ⚠️ Limite assumée, à dire clairement : ceci couvre **une installation, un
// vendeur**. Pour héberger plusieurs vendeurs sur la même instance, il faudra
// rattacher chaque email entrant à un vendeur (par l'adresse de réception) —
// c'est un chantier à part, pas une variable d'environnement.
const OWNER = process.env.VRM_OWNER_UID || '';

// Ajoute le propriétaire à une ligne à écrire (sans effet s'il n'est pas réglé).
export const withOwner = (row) => (OWNER ? { owner: OWNER, ...row } : row);

// Idem pour un lot de lignes.
export const withOwnerAll = (rows) => (Array.isArray(rows) ? rows.map(withOwner) : rows);

// La cible d'upsert change avec la clé primaire : `(owner, id)` une fois migré.
export const conflictTarget = (base = 'id') => (OWNER ? `owner,${base}` : base);

export const ownerConfigured = () => !!OWNER;
