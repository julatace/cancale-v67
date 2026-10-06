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

// ── LE REGISTRE DE TOUS LES VENDEURS (fonction PURE) ──────────────────────────
// ⚠️⚠️ Base cloisonnée = UNE ligne `vrm_email_owners` PAR VENDEUR (chacun écrit
// la sienne, sous RLS). Le serveur la lisait avec la clé de service et ne
// gardait que `j[0]` : les adresses des autres vendeurs n'existaient pas pour
// lui. Un email arrivé sur l'adresse d'un second vendeur tombait alors dans le
// repli « installation » — et partait chez Julien. Ici on lit TOUTES les lignes.
//
// ⚠️ Et le vendeur d'une adresse est celui de la LIGNE (colonne `owner`, posée
// par la base sous RLS), JAMAIS le champ `owner` rangé dans le JSON : celui-là
// est écrit par le navigateur, n'importe qui y met l'identifiant qu'il veut.
// Sans ça, un vendeur déclarerait dans SA ligne « julien@… → moi » et
// recevrait ses bordereaux.
//
// Une adresse déclarée par DEUX vendeurs ne désigne personne : elle part dans
// `conflits`, et l'email qui y arrive est mis de côté (jamais l'un des deux au
// hasard — §5 : mieux vaut un blanc qu'un faux).
//
// `lignes` : [{ owner?, data }] tels que rendus par PostgREST.
// `cloisonnee` : la base sait-elle séparer les vendeurs ? Sans colonne
//   `owner`, il n'y a qu'une boutique : on garde le champ du JSON, comme avant.
export function fusionnerRegistres(lignes, cloisonnee) {
  const registre = {}, conflits = new Set();
  for (const l of (Array.isArray(lignes) ? lignes : [])) {
    const d = (l && l.data && typeof l.data === 'object') ? l.data : {};
    const adresses = (d.adresses && typeof d.adresses === 'object') ? d.adresses : d;
    const proprioLigne = String((l && l.owner) || '').trim();
    if (cloisonnee && !proprioLigne) continue;            // ligne sans vendeur : elle ne désigne personne
    for (const k in adresses) {
      const cle = normAdresse(k);
      if (!cle || !cle.includes('@')) continue;           // `updatedAt` et autres clés qui ne sont pas des adresses
      const v = adresses[k];
      const declare = String((v && (v.owner || v.uid)) || (typeof v === 'string' ? v : '') || '').trim();
      const owner = cloisonnee ? proprioLigne : declare;
      if (!owner) continue;
      if (registre[cle] && registre[cle] !== owner) { conflits.add(cle); continue; }
      registre[cle] = owner;
    }
  }
  for (const c of conflits) delete registre[c];
  return { registre, conflits: [...conflits] };
}

// ── LA RÉSOLUTION (fonction PURE, donc testable exhaustivement) ───────────────
// `registre` : { "<adresse>": { owner, label } } ou { "<adresse>": owner }.
// `defaut`   : propriétaire de l'installation (VRM_OWNER_UID), ou ''.
// `conflits` : adresses déclarées par plusieurs vendeurs (voir plus haut).
//
// Renvoie { owner, via, adresse } ou { owner:'', via:'quarantaine', raison }.
export function resoudreProprietaire(adresses, registre, defaut, conflits) {
  const reg = {};
  for (const k in (registre || {})) {
    const cle = normAdresse(k);
    const v = registre[k];
    const owner = String((v && (v.owner || v.uid)) || (typeof v === 'string' ? v : '') || '').trim();
    if (cle && owner) reg[cle] = owner;
  }
  const liste = (adresses || []).map(normAdresse).filter(Boolean);

  // 0. Une adresse revendiquée par deux vendeurs : personne ne tranche à leur
  //    place, et surtout pas le repli « installation » plus bas.
  const disputees = new Set((conflits || []).map(normAdresse));
  //    (Le repli sur l'adresse sans « +étiquette » ne compte que si l'adresse
  //    exacte n'est déclarée par personne — l'exacte gagne toujours.)
  if (liste.some((a) => disputees.has(a) || (!reg[a] && disputees.has(sansEtiquette(a))))) {
    return { owner: '', via: 'quarantaine', raison: 'adresse de réception déclarée par plusieurs vendeurs' };
  }

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

  // 3. Installation à UN SEUL vendeur : tout lui appartient, c'est explicite et
  //    réglé par lui (VRM_OWNER_UID). Ce n'est PAS une devinette.
  //
  // ⚠️⚠️ MAIS « un seul vendeur » N'EST VRAI QUE TANT QU'IL EST SEUL. Le jour
  //    où l'app accueille quelqu'un d'autre, ce repli devient exactement la
  //    devinette que tout ce fichier interdit : un email arrivé sur une adresse
  //    que le NOUVEAU vendeur n'a pas encore déclarée partirait chez le
  //    propriétaire de l'installation — son bordereau, son code de retrait, sa
  //    vente, dans la boutique d'un autre. Et ça ne se voit pas : celui qui
  //    l'attendait ne saura jamais qu'il a existé.
  //    ⇒ Dès que le registre déclare un propriétaire AUTRE que celui de
  //      l'installation, il y a démonstrablement plus d'un vendeur : le repli
  //      s'éteint et on passe en quarantaine (réparable d'un clic).
  //    ⚠️ Et il ne s'éteint PAS avant : tant que Julien est seul — registre
  //      vide, ou ne portant que ses propres adresses — rien ne change. C'est
  //      l'incident du 16 au 22 août (593 emails en quarantaine, zéro traité,
  //      ses codes de retrait perdus) qu'on ne refait pas.
  const dft = String(defaut || '').trim();
  const autresVendeurs = Object.keys(reg).some((a) => reg[a] && reg[a] !== dft);
  if (dft && !autresVendeurs) return { owner: dft, via: 'installation' };
  if (dft && autresVendeurs) {
    return { owner: '', via: 'quarantaine',
      raison: 'adresse de réception inconnue, et l’app compte plusieurs vendeurs' };
  }

  // 4. On ne sait pas → quarantaine. Jamais d'attribution au hasard.
  return { owner: '', via: 'quarantaine', raison: liste.length ? 'adresse de réception inconnue' : 'aucune adresse de réception lisible' };
}

// ── LA QUARANTAINE N'APPARTIENT À AUCUN VENDEUR ──────────────────────────────
// ⚠️⚠️ Un email mis de côté était rangé sous le propriétaire de l'INSTALLATION
// (Julien). Tant qu'il est seul, c'est sans conséquence. Le jour où un second
// vendeur arrive, ses emails non attribués (vente, bordereau, nom et adresse de
// l'acheteur) atterrissaient dans la boutique de Julien — et l'autre ne les
// voyait jamais. Base cloisonnée ⇒ la quarantaine vit sous ce propriétaire
// NEUTRE : aucune session ne porte cet identifiant (Supabase n'en émet jamais
// de nul), donc RLS ne la montre à PERSONNE. Seul le serveur (clé de service)
// la lit, et ne la rend qu'à celui qui prouve que l'email est à lui (ci-dessous).
// Aucune clé étrangère ne pèse sur `app_data.owner` (mesuré le 6 octobre) :
// l'identifiant nul s'écrit comme n'importe quel autre.
export const PROPRIETAIRE_NEUTRE = '00000000-0000-0000-0000-000000000000';

// ── QUI PEUT RÉCLAMER UN EMAIL MIS DE CÔTÉ ? (fonction PURE) ─────────────────
// EXACTEMENT la règle d'arrivée (§11 : une seule règle), rejouée avec le
// registre d'AUJOURD'HUI : l'email est à toi si l'adresse où il est arrivé est
// une adresse que TU as déclarée, et que personne d'autre n'a déclarée. C'est le
// cas normal — l'email est arrivé AVANT que tu déclares ton adresse.
// ⚠️ SANS le repli « installation » (`defaut = ''`) : il désignerait le
//    propriétaire de l'installation pour TOUT email dont l'adresse n'est à
//    personne — la devinette que ce fichier interdit, appliquée à tout le tas.
// ⚠️ Deux vendeurs destinataires, une adresse déclarée par deux vendeurs, aucune
//    adresse lisible ⇒ PERSONNE. Mieux vaut un blanc qu'un faux (§5).
export function peutReclamer(adresses, registre, conflits, vendeur) {
  const v = String(vendeur || '').trim();
  if (!v || v === PROPRIETAIRE_NEUTRE) return false;
  const r = resoudreProprietaire(Array.isArray(adresses) ? adresses : [], registre || {}, '', conflits || []);
  return !!r.owner && r.owner === v;
}
