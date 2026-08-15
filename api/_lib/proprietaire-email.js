// ══════════════════════════════════════════════════════════════════════════════
// À QUEL VENDEUR APPARTIENT CET EMAIL ?
// ══════════════════════════════════════════════════════════════════════════════
// Un email arrive sans session : rien, dans le message, ne dit à qui il est
// destiné. Il faut donc le décider, et le décider SANS JAMAIS SE TROMPER — une
// erreur ici ne se voit pas (l'email part chez un autre vendeur, celui qui
// l'attendait ne verra jamais son bordereau).
//
// ── LA RÈGLE, EN UNE PHRASE ───────────────────────────────────────────────────
// C'est **l'adresse de réception** qui décide, jamais le contenu.
//
// Pourquoi : l'expéditeur, le sujet et le corps sont écrits par n'importe qui —
// il suffirait d'envoyer un email mentionnant « shopcancale35 » pour déposer des
// données dans le compte de quelqu'un d'autre. L'adresse à laquelle le message a
// été **livré**, elle, est décidée par le routage : le vendeur a créé lui-même
// cette adresse dans l'app, et il est le seul à l'avoir donnée à son
// transfert. C'est le seul champ que l'extérieur ne choisit pas.
//
// ── ET SI ON NE SAIT PAS ? ────────────────────────────────────────────────────
// On ne devine pas. On met en QUARANTAINE : l'email est conservé entier, marqué
// « non attribué » avec sa raison, et l'app le signale. Perdre un email est
// réparable (il est là, on le rattache d'un clic) ; le donner au mauvais vendeur
// ne l'est pas.
//
// ⚠️ NE JAMAIS « améliorer » ça en rattachant par le pseudo Vinted, le nom de
// l'expéditeur ou un mot du corps. C'est exactement la porte d'entrée qu'on
// referme ici.

// Une adresse email, réduite à sa forme comparable.
export const normAdresse = (a) => String(a || '')
  .trim().toLowerCase()
  // « Julien <recu@vrm.center> » → « recu@vrm.center »
  .replace(/^.*<([^>]+)>.*$/, '$1')
  .replace(/^mailto:/, '')
  .trim();

// Adresse sans son étiquette « + » : recu+julien@vrm.center → recu@vrm.center.
// Sert de repli SEULEMENT si l'adresse complète n'est pas enregistrée.
export const sansEtiquette = (a) => {
  const s = normAdresse(a);
  const i = s.indexOf('@'); if (i < 0) return s;
  const local = s.slice(0, i), dom = s.slice(i);
  const j = local.indexOf('+');
  return j < 0 ? s : local.slice(0, j) + dom;
};

// Toutes les adresses de LIVRAISON possibles, selon le service de réception.
// ⚠️ On ne lit QUE des champs d'enveloppe/en-tête de destination. Jamais le
// corps, jamais l'expéditeur.
export function adressesDeLivraison(body, mailNormalise) {
  const b = body || {}, m = mailNormalise || {};
  const brut = [
    m.to,
    b.to, b.To, b.recipient, b.Recipient,
    b.OriginalRecipient, b.original_recipient,
    b.envelope && (b.envelope.to || b.envelope.To),
    b.envelope_to, b['envelope-to'],
    b.deliveredTo, b['delivered-to'], b['Delivered-To'],
    b.cc, b.Cc, b.CC,
    b.headers && (b.headers['delivered-to'] || b.headers['Delivered-To'] || b.headers['x-forwarded-to'] || b.headers['X-Forwarded-To']),
    Array.isArray(b.ToFull) ? b.ToFull.map(x => x && x.Email).join(',') : '',
    Array.isArray(b.CcFull) ? b.CcFull.map(x => x && x.Email).join(',') : '',
  ];
  const out = [];
  for (const champ of brut) {
    if (!champ) continue;
    // Une enveloppe peut être une liste (JSON ou séparée par des virgules).
    const liste = Array.isArray(champ) ? champ : String(champ).split(/[,;]/);
    for (const a of liste) {
      const n = normAdresse(a);
      if (n && n.includes('@') && !out.includes(n)) out.push(n);
    }
  }
  return out;
}

// ── LA RÉSOLUTION (fonction PURE, donc testable exhaustivement) ───────────────
// `registre` : { "<adresse>": { owner, label } }  — écrit par l'app.
// `defaut`   : propriétaire de l'installation (VRM_OWNER_UID), ou ''.
//
// Renvoie { owner, via, adresse } ou { owner:'', via:'quarantaine', raison }.
export function resoudreProprietaire(adresses, registre, defaut) {
  const reg = {};
  for (const k in (registre || {})) {
    const cle = normAdresse(k);
    const v = registre[k];
    const owner = String((v && (v.owner || v.uid)) || (typeof v === 'string' ? v : '') || '').trim();
    if (cle && owner) reg[cle] = owner;
  }
  const liste = (adresses || []).map(normAdresse).filter(Boolean);

  // 1. Correspondance EXACTE sur l'adresse complète (le cas normal).
  const exacts = [];
  for (const a of liste) if (reg[a] && !exacts.includes(reg[a])) exacts.push(reg[a]);
  if (exacts.length === 1) return { owner: exacts[0], via: 'adresse', adresse: liste.find(a => reg[a]) };
  if (exacts.length > 1) {
    // Deux vendeurs en destinataires : personne ne peut trancher à leur place.
    return { owner: '', via: 'quarantaine', raison: 'plusieurs vendeurs destinataires' };
  }

  // 2. Repli : l'adresse SANS son étiquette « + ». Un vendeur qui a enregistré
  //    `recu@vrm.center` reçoit aussi ce qui arrive sur `recu+vinted@vrm.center`.
  const bases = [];
  for (const a of liste) { const b = sansEtiquette(a); if (reg[b] && !bases.includes(reg[b])) bases.push(reg[b]); }
  if (bases.length === 1) return { owner: bases[0], via: 'adresse-base', adresse: liste.find(a => reg[sansEtiquette(a)]) };
  if (bases.length > 1) return { owner: '', via: 'quarantaine', raison: 'plusieurs vendeurs destinataires' };

  // 3. Installation à un seul vendeur : tout lui appartient, c'est explicite et
  //    réglé par lui (VRM_OWNER_UID). Ce n'est PAS une devinette.
  if (defaut) return { owner: String(defaut), via: 'installation' };

  // 4. On ne sait pas → quarantaine. Jamais d'attribution au hasard.
  return { owner: '', via: 'quarantaine', raison: liste.length ? 'adresse de réception inconnue' : 'aucune adresse de réception lisible' };
}
