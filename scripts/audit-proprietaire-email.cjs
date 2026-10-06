// ════════════════════════════════════════════════════════════════════════════
//  À QUI APPARTIENT CET EMAIL ? — la règle exécutée, pas relue.
//
//  `api/_lib/proprietaire-email.js` porte en commentaire « fonction PURE, donc
//  testable exhaustivement »… et RIEN ne l'exécutait. C'est §4.10 mot pour mot
//  (« une fonction serverless n'est vérifiée que si un banc l'EXÉCUTE ») sur la
//  règle qui décide dans quelle boutique atterrit un bordereau.
//
//  Une erreur ici ne se voit pas : l'email part chez un autre vendeur, et celui
//  qui l'attendait ne saura jamais qu'il a existé.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => {
  if (bon) { ok++; console.log(`✅ ${quoi}`); }
  else { ko++; console.log(`❌ ${quoi}${detail ? ' — ' + detail : ''}`); }
};

const J = '11111111-1111-1111-1111-111111111111';   // le propriétaire de l'installation
const B = '22222222-2222-2222-2222-222222222222';   // un second vendeur

(async () => {
  const mod = await import(path.join(__dirname, '..', 'api', '_lib', 'proprietaire-email.js'));
  const { resoudreProprietaire: r, adressesDeLivraison: adr, normAdresse, sansEtiquette } = mod;

  // ── L'adresse de réception décide, et elle seule ──────────────────────────
  const regJ = { 'recu@vrm.center': { owner: J } };
  const regJB = { 'recu@vrm.center': { owner: J }, 'sophie@vrm.center': { owner: B } };

  dit(r(['recu@vrm.center'], regJB, J).owner === J, 'une adresse déclarée désigne SON vendeur');
  dit(r(['sophie@vrm.center'], regJB, J).owner === B, 'et l’autre adresse désigne l’autre vendeur');

  // ⚠️ Deux vendeurs en destinataires : personne ne tranche à leur place.
  dit(r(['recu@vrm.center', 'sophie@vrm.center'], regJB, J).via === 'quarantaine',
    'deux vendeurs destinataires : quarantaine, jamais un des deux au hasard');

  // L'étiquette « + » n'est qu'un repli, et seulement si l'exacte est inconnue.
  dit(r(['recu+vinted@vrm.center'], regJ, '').owner === J,
    'l’étiquette « + » retombe sur l’adresse de base');
  dit(r(['recu+vinted@vrm.center'], { 'recu+vinted@vrm.center': { owner: B }, 'recu@vrm.center': { owner: J } }, '').owner === B,
    'mais l’adresse EXACTE gagne toujours sur le repli');

  // ── ⚠️⚠️ LE REPLI « INSTALLATION » S'ÉTEINT QUAND ON N'EST PLUS SEUL ──────
  // Tant que Julien est seul, tout lui appartient : c'est explicite, réglé par
  // lui, et c'est ce qui a évité de refaire l'incident du 16 au 22 août.
  dit(r(['inconnue@vrm.center'], {}, J).via === 'installation',
    'seul vendeur, registre vide : l’email lui revient (pas de quarantaine inutile)');
  dit(r(['inconnue@vrm.center'], regJ, J).via === 'installation',
    'seul vendeur qui a déclaré SES adresses : rien ne change');
  // Le jour où quelqu'un d'autre est là, ce repli devient une devinette — et
  // celle qui coûte le plus cher : le bordereau d'un vendeur chez un autre.
  const deux = r(['inconnue@vrm.center'], regJB, J);
  dit(deux.via === 'quarantaine' && !deux.owner,
    'DEUX vendeurs, adresse inconnue : quarantaine — le repli ne devine plus',
    JSON.stringify(deux));
  dit(/plusieurs vendeurs/i.test(deux.raison || ''),
    'et la raison dit pourquoi, pour que ça se répare', deux.raison);

  // Sans propriétaire d'installation réglé, rien ne s'invente non plus.
  dit(r(['inconnue@vrm.center'], {}, '').via === 'quarantaine',
    'aucun propriétaire réglé : quarantaine');
  dit(r([], {}, '').via === 'quarantaine', 'aucune adresse lisible : quarantaine');

  // ── Ce qui NE doit jamais décider ─────────────────────────────────────────
  // Le corps, le sujet et l'expéditeur sont écrits par n'importe qui.
  const corps = {
    from: 'sophie@vrm.center', subject: 'Bordereau pour sophie@vrm.center',
    text: 'livré à sophie@vrm.center', to: 'recu@vrm.center',
  };
  const vues = adr(corps, { to: 'recu@vrm.center' });
  dit(!vues.includes('sophie@vrm.center'),
    'ni l’expéditeur, ni le sujet, ni le corps ne comptent comme adresse de livraison',
    vues.join(', '));
  dit(r(vues, regJB, J).owner === J, 'un email qui NOMME un autre vendeur reste chez le bon');

  // ── Les formes d'adresse ──────────────────────────────────────────────────
  dit(normAdresse('Julien <Recu@VRM.center> ') === 'recu@vrm.center', 'une adresse se compare normalisée');
  dit(sansEtiquette('recu+a+b@vrm.center') === 'recu@vrm.center', 'l’étiquette est retirée en entier');
  // Un registre écrit avec des majuscules ou des espaces doit marcher : c'est
  // Julien qui le saisit à la main dans Réglages.
  dit(r(['recu@vrm.center'], { ' Recu@VRM.center ': { owner: J } }, '').owner === J,
    'un registre saisi à la main (majuscules, espaces) marche quand même');

  // ════════════════════════════════════════════════════════════════════════
  // ⚠️⚠️ LE REGISTRE DE PLUSIEURS VENDEURS — la règle pure, puis la VRAIE route.
  // Base cloisonnée = une ligne `vrm_email_owners` PAR vendeur. La route ne
  // lisait que `j[0]` : l'adresse d'un second vendeur n'existait pas pour elle,
  // et son bordereau tombait dans le repli « installation », chez Julien.
  // ════════════════════════════════════════════════════════════════════════
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 160)); } };
  const LIGNE_J = { owner: J, data: { adresses: { 'recu@vrm.center': { owner: J } }, updatedAt: '2026-10-05T10:00:00Z' } };
  const LIGNE_B = { owner: B, data: { adresses: { 'sophie@vrm.center': { owner: B } } } };

  await essaie('fusion des registres', () => {
    const f = mod.fusionnerRegistres;
    dit(typeof f === 'function', 'le registre se lit sur TOUTES les lignes (une par vendeur)', typeof f);
    if (typeof f !== 'function') return;
    const u = f([LIGNE_J, LIGNE_B], true);
    dit(u.registre['recu@vrm.center'] === J && u.registre['sophie@vrm.center'] === B,
      'deux vendeurs, deux lignes : les deux adresses sont connues', JSON.stringify(u.registre));
    // Le champ `owner` rangé dans le JSON est écrit par le NAVIGATEUR.
    const forge = f([{ owner: B, data: { adresses: { 'sophie@vrm.center': { owner: J } } } }], true);
    dit(forge.registre['sophie@vrm.center'] === B,
      'le vendeur d’une adresse est celui de la LIGNE (posé par la base), jamais le champ écrit par le navigateur',
      JSON.stringify(forge.registre));
    const dispute = f([LIGNE_J, { owner: B, data: { adresses: { 'recu@vrm.center': { owner: B } } } }], true);
    dit(!dispute.registre['recu@vrm.center'] && dispute.conflits.includes('recu@vrm.center'),
      'une adresse déclarée par DEUX vendeurs ne désigne personne', JSON.stringify(dispute));
    const q = r(['recu@vrm.center'], dispute.registre, J, dispute.conflits);
    dit(q.via === 'quarantaine' && !q.owner,
      'et l’email qui y arrive est mis de côté — surtout pas le repli « installation »', JSON.stringify(q));
    dit(f([{ owner: '', data: { adresses: { 'x@vrm.center': { owner: B } } } }], true).registre['x@vrm.center'] === undefined,
      'base cloisonnée : une ligne sans vendeur ne désigne personne');
    // Base sans colonne `owner` (une seule boutique) : le comportement d'avant.
    dit(f([{ data: { adresses: { 'recu@vrm.center': { owner: J } } } }], false).registre['recu@vrm.center'] === J,
      'base non cloisonnée : le registre se lit comme avant');
    dit(Object.keys(f([LIGNE_J], true).registre).length === 1, '« updatedAt » n’est pas une adresse');
  });

  // ── La VRAIE route, exécutée : chaque écriture est notée avec son vendeur ──
  process.env.VRM_OWNER_UID = J;
  const ecrites = [];
  let etat = {};
  const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps),
    { status, headers: { 'content-type': status >= 500 ? 'text/html' : 'application/json' } });
  global.fetch = async (url, opts = {}) => {
    const u = decodeURIComponent(String(url));
    if (!u.includes('/rest/v1/')) return rep({});
    if ((opts.method || 'GET') === 'POST') {
      try { JSON.parse(opts.body || '[]').forEach((x) => ecrites.push({ id: x.id, owner: x.owner || '', data: x.data, url: u })); } catch (_) {}
      return rep('', 201);
    }
    if (/select=owner&limit=1/.test(u)) return etat.sondeKO ? rep('<html>502</html>', 502) : etat.sansColonne ? rep({ code: '42703' }, 400) : rep([{ owner: J }]);
    if (/id=eq\.vrm_email_owners/.test(u)) return etat.registreKO ? rep('<html>522</html>', 522) : rep(etat.lignes || []);
    return rep([]);
  };
  const faireRes = () => { const x = { code: null, corps: null }; x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; }; x.setHeader = () => {}; x.end = () => x; return x; };
  const vente = (to) => ({ method: 'POST', query: {}, body: {
    from: 'no-reply@vinted.fr', to, subject: 'Ton article est vendu !',
    text: "acheteur-de-banc a acheté [Paire de banc] n°9001 42,00 €\nPrépare ton colis.", html: '<p>vendu</p>', attachments: [] } });
  const envoyer = async (route, to, e) => {
    etat = e; ecrites.length = 0;
    const res = faireRes();
    await route.default(vente(to), res);
    return { code: res.code, corps: res.corps, ecrites: ecrites.slice() };
  };
  const metier = (w) => w.filter((x) => !/^email_quarantaine_/.test(x.id));
  const quar = (w) => w.filter((x) => /^email_quarantaine_/.test(x.id));
  const nouvelle = async (tag) => import('file://' + path.join(__dirname, '..', 'api', 'email-inbound.js') + '?' + tag);

  await essaie('route : second vendeur', async () => {
    const route = await nouvelle('deux');
    const o = await envoyer(route, 'sophie@vrm.center', { lignes: [LIGNE_J, LIGNE_B] });
    const chezJ = metier(o.ecrites).filter((x) => x.owner === J);
    dit(chezJ.length === 0, 'route : le bordereau du SECOND vendeur ne part pas chez Julien',
      chezJ.length ? `${chezJ.length} ligne(s) écrite(s) chez Julien : ${chezJ.map((x) => x.id).join(', ')}` : '');
    dit(metier(o.ecrites).some((x) => x.owner === B), 'route : il arrive bien chez SON vendeur',
      JSON.stringify(o.ecrites));
  });
  await essaie('route : adresse revendiquée', async () => {
    const route = await nouvelle('forge');
    // L'autre vendeur déclare, dans SA ligne, l'adresse de Julien — et sa ligne est lue en premier.
    const o = await envoyer(route, 'recu@vrm.center', { lignes: [{ owner: B, data: { adresses: { 'recu@vrm.center': { owner: B } } } }, LIGNE_J] });
    const chezB = metier(o.ecrites).filter((x) => x.owner === B);
    dit(chezB.length === 0, 'route : déclarer l’adresse d’un autre ne détourne pas ses emails',
      chezB.length ? `${chezB.length} ligne(s) de Julien écrite(s) chez l’autre vendeur` : '');
    dit(quar(o.ecrites).length === 1 && metier(o.ecrites).length === 0, 'route : l’email disputé est mis de côté, entier',
      JSON.stringify(o.ecrites));
  });
  await essaie('route : registre illisible', async () => {
    const route = await nouvelle('registreKO');
    const o = await envoyer(route, 'sophie@vrm.center', { registreKO: true, lignes: [LIGNE_J, LIGNE_B] });
    dit(o.code >= 500 && o.ecrites.length === 0,
      'route : registre illisible → « renvoie-le » (5xx), et rien n’est rangé au hasard',
      `HTTP ${o.code} · ${o.ecrites.length} écriture(s) ${o.ecrites.map((x) => x.id + '@' + (x.owner === J ? 'J' : x.owner === B ? 'B' : '?')).join(', ')}`);
  });
  await essaie('route : sonde ratée', async () => {
    const route = await nouvelle('sondeKO');
    const a = await envoyer(route, 'inconnue@vrm.center', { sondeKO: true, lignes: [LIGNE_J, LIGNE_B] });
    dit(a.code >= 500 && metier(a.ecrites).length === 0,
      'route : sonde de cloisonnement ratée → « renvoie-le », jamais « une seule boutique »',
      `HTTP ${a.code} · ${a.ecrites.map((x) => x.id).join(', ')}`);
    // Et l'échec n'est pas mémorisé : l'email suivant, base revenue, est jugé pour de bon.
    const b = await envoyer(route, 'inconnue@vrm.center', { lignes: [LIGNE_J, LIGNE_B] });
    dit(metier(b.ecrites).filter((x) => x.owner === J).length === 0 && quar(b.ecrites).length === 1,
      'route : un échec de sonde n’est pas mémorisé — l’email suivant (adresse inconnue, deux vendeurs) est mis de côté',
      `HTTP ${b.code} · ${JSON.stringify(b.ecrites)}`);
  });
  // ════════════════════════════════════════════════════════════════════════
  // ⚠️⚠️ LA QUARANTAINE N'EST À PERSONNE (6 octobre). Rangée sous le
  // propriétaire de l'installation, l'email non attribué d'un AUTRE vendeur
  // (sa vente, son bordereau, son acheteur) atterrissait chez Julien.
  // ════════════════════════════════════════════════════════════════════════
  const NEUTRE = '00000000-0000-0000-0000-000000000000';
  const C = '33333333-3333-3333-3333-333333333333';
  await essaie('qui peut réclamer', () => {
    const p = mod.peutReclamer;
    dit(typeof p === 'function' && mod.PROPRIETAIRE_NEUTRE === NEUTRE,
      'le propriétaire NEUTRE et la règle de réclamation existent', `${typeof p} · ${mod.PROPRIETAIRE_NEUTRE}`);
    if (typeof p !== 'function') return;
    const reg = { 'sophie@vrm.center': B, 'recu@vrm.center': J };
    dit(p(['sophie@vrm.center'], reg, [], B) === true, 'réclamer : B reprend un email arrivé sur SON adresse déclarée');
    dit(p(['sophie@vrm.center'], reg, [], C) === false && p(['sophie@vrm.center'], reg, [], J) === false,
      'réclamer : ni un troisième vendeur, ni Julien ne prennent l’email arrivé chez B');
    // ⚠️ Le cas qui coûte : l'autre vendeur est PARTI (registre réduit à
    // Julien, ou vide). À l'arrivée, le repli « installation » se rallumerait —
    // mais sur le TAS, il donnerait à Julien les emails mis de côté de l'autre.
    dit(p(['inconnue@vrm.center'], reg, [], J) === false
      && p(['inconnue@vrm.center'], { 'recu@vrm.center': J }, [], J) === false
      && p(['inconnue@vrm.center'], {}, [], J) === false,
      'réclamer : une adresse à personne ne revient pas au propriétaire de l’installation — même quand il est redevenu seul (pas de repli sur le tas)');
    dit(p(['disputee@vrm.center'], reg, ['disputee@vrm.center'], B) === false,
      'réclamer : une adresse déclarée par deux vendeurs ne se réclame par personne');
    dit(p(['sophie@vrm.center', 'recu@vrm.center'], reg, [], B) === false && p(['sophie@vrm.center', 'recu@vrm.center'], reg, [], J) === false,
      'réclamer : deux vendeurs destinataires — personne ne tranche à leur place');
    dit(p(['sophie+vinted@vrm.center'], reg, [], B) === true, 'réclamer : la même règle qu’à l’arrivée (l’étiquette « + »)');
    dit(p([], reg, [], B) === false && p(undefined, reg, [], B) === false, 'réclamer : aucune adresse lisible → personne');
    dit(p(['x@vrm.center'], { 'x@vrm.center': NEUTRE }, [], NEUTRE) === false, 'réclamer : le propriétaire neutre ne réclame rien');
  });
  await essaie('route : quarantaine sous le neutre', async () => {
    const route = await nouvelle('neutre');
    const o = await envoyer(route, 'inconnue@vrm.center', { lignes: [LIGNE_J, LIGNE_B] });
    const q = quar(o.ecrites);
    dit(o.code === 200 && q.length === 1 && q[0].owner === NEUTRE,
      'route : base cloisonnée, l’email mis de côté est rangé sous le propriétaire NEUTRE — jamais chez Julien',
      `HTTP ${o.code} · ${q.map((x) => x.id + '@' + (x.owner === J ? 'J (Julien)' : x.owner || '(aucun)')).join(', ')}`);
    dit(q.length === 1 && /on_conflict=owner,id/.test(q[0].url || ''),
      'route : et il s’écrit sur la clé (owner, id) de la base cloisonnée', q[0] && q[0].url);
    dit(q.length === 1 && q[0].data && Array.isArray(q[0].data.adresses) && q[0].data.destinataires === JSON.stringify(q[0].data.adresses),
      'route : ses adresses d’arrivée sont gardées — en liste, et en une chaîne (JSON, la même liste) que la base copie dans `meta`',
      q[0] && JSON.stringify({ adresses: q[0].data.adresses, destinataires: q[0].data.destinataires }));
    // ⚠️ Une adresse de livraison peut contenir une espace (un To mal formé) :
    //    jointe par des espaces, la chaîne se relisait en DEUX adresses, et la
    //    liste proposait ce que la réclamation refusait. Elle doit se relire à
    //    l'identique de `data.adresses` (§11).
    const route2 = await nouvelle('espace');
    const o2 = await envoyer(route2, 'x@inconnu.fr b@vrm.center', { lignes: [LIGNE_J, LIGNE_B] });
    const q2 = quar(o2.ecrites);
    let relue = null; try { relue = JSON.parse(q2[0].data.destinataires); } catch (_) {}
    dit(q2.length === 1 && Array.isArray(relue) && JSON.stringify(relue) === JSON.stringify(q2[0].data.adresses),
      'route : la chaîne des destinataires se relit EXACTEMENT comme `data.adresses` — une adresse avec une espace reste une adresse',
      q2[0] && JSON.stringify({ adresses: q2[0].data.adresses, destinataires: q2[0].data.destinataires }));
  });
  // ── Pourquoi PERSONNE ne peut réclamer, et le repli qui s'éteint ─────────
  await essaie('pourquoi personne', () => {
    const pp = mod.pourquoiPersonne, ri = mod.repliInstallation;
    dit(typeof pp === 'function' && typeof ri === 'function', 'la cause d’un email que personne ne peut réclamer, et l’état du repli, se calculent', `${typeof pp} · ${typeof ri}`);
    if (typeof pp !== 'function' || typeof ri !== 'function') return;
    const reg = { 'sophie@vrm.center': B, 'recu@vrm.center': J };
    // §11 : `pourquoiPersonne` est l'envers EXACT de `peutReclamer` — sur une
    // grille de cas, jamais l'un sans l'autre.
    const cas = [['sophie@vrm.center'], ['inconnue@vrm.center'], ['disputee@vrm.center'], ['sophie@vrm.center', 'recu@vrm.center'],
      ['sophie+vinted@vrm.center'], [], ['x@inconnu.fr sophie@vrm.center'], ['b+y@autre.fr sophie@vrm.center']];
    const ecarts = cas.filter((a) => {
      const quelquun = [B, J, C].some((v) => mod.peutReclamer(a, reg, ['disputee@vrm.center'], v));
      return quelquun === !!pp(a, reg, ['disputee@vrm.center']);
    });
    dit(ecarts.length === 0, '« personne ne peut réclamer » est exactement l’envers de la réclamation (§11)', ecarts.map((a) => JSON.stringify(a)).join(' · '));
    dit(pp(['inconnue@vrm.center'], reg, []) === 'inconnue' && pp(['disputee@vrm.center'], reg, ['disputee@vrm.center']) === 'disputee'
      && pp(['sophie@vrm.center', 'recu@vrm.center'], reg, []) === 'plusieurs' && pp([], reg, []) === 'aucune',
      'et la cause est nommée : adresse non déclarée · disputée · deux vendeurs · aucune adresse',
      [pp(['inconnue@vrm.center'], reg, []), pp(['disputee@vrm.center'], reg, ['disputee@vrm.center']), pp(['sophie@vrm.center', 'recu@vrm.center'], reg, []), pp([], reg, [])].join(','));
    // Le repli : allumé tant que personne d'autre n'a déclaré, éteint dès qu'un
    // autre compte déclare UNE adresse — exactement ce que fait l'arrivée.
    dit(ri({}, J) === true && ri({ 'recu@vrm.center': J }, J) === true && ri({ 'essai@vrm.center': { owner: B } }, J) === false && ri({}, '') === false,
      'le repli « installation » : allumé seul, éteint dès qu’un autre compte déclare, jamais sans propriétaire réglé');
    const arrivee = (regX) => r(['inconnue@vrm.center'], regX, J).via === 'installation';
    dit([{}, { 'recu@vrm.center': J }, { 'essai@vrm.center': B }].every((regX) => arrivee(regX) === ri(regX, J)),
      'et c’est LA règle de l’arrivée (§11) — l’écran ne peut pas dire autre chose que ce qui se passe');
  });
  await essaie('route : base non cloisonnée', async () => {
    const route = await nouvelle('sansColonne');
    const o = await envoyer(route, 'inconnue@vrm.center', { sansColonne: true, lignes: [{ data: { adresses: { 'sophie@vrm.center': { owner: B } } } }] });
    dit(o.code === 200 && quar(o.ecrites).length === 0 && !o.ecrites.some((x) => x.owner === NEUTRE) && metier(o.ecrites).length > 0,
      'l’autre sens : base non cloisonnée (une seule boutique) — pas de quarantaine, rien sous le neutre, l’email est traité comme avant',
      `HTTP ${o.code} · ${JSON.stringify(o.ecrites.map((x) => x.id + '@' + (x.owner === J ? 'J' : x.owner || '-')))}`);
  });
  await essaie('route : seul vendeur', async () => {
    const route = await nouvelle('seul');
    const o = await envoyer(route, 'recu@vrm.center', { lignes: [] });
    dit(o.code === 200 && metier(o.ecrites).length > 0 && metier(o.ecrites).every((x) => x.owner === J),
      'l’autre sens : seul vendeur, registre vide — l’email lui revient comme avant (incident du 16 août)',
      `HTTP ${o.code} · ${JSON.stringify(o.ecrites)}`);
  });

  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert${ok > 1 ? 's' : ''}, ${ko} rouge${ko > 1 ? 's' : ''} — un email ne part jamais chez le mauvais vendeur.`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ l’audit est tombé :', e && e.message); process.exit(1); });
