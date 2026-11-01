// ════════════════════════════════════════════════════════════════════════════
//  L'ADRESSE D'UNE CONSIGNE VINTED GO, LUE DANS SON SUIVI (1er novembre)
//  Julien : « Kusmi Tea · 13 Rue Saint-Vincent · 4 colis à retirer — Pas sur la
//  carte : le message donne la rue du point mais ni son code postal ni sa
//  ville » ; « je sais que tu peux avoir les infos en regardant sur Vinted Go ».
//  La source : la réponse publique du suivi Vinted Go DU MÊME N°
//  (`carrier.vintedgo.com/public/v3/tracking_events/{n}`, déjà lue par le
//  serveur, relayée par l'extension en secours). Mesurée le 1er nov. sur une
//  vraie réponse : l'évènement `ready_for_pickup` porte
//  `metadata: { address: "<n° rue>, <Ville>, FR", point_id: <nombre> }` — rue,
//  ville, pays, JAMAIS de code postal ; les autres évènements `metadata: {}`.
//  La FORME ci-dessous est celle de la vraie réponse (clés, types, messages,
//  ordre) ; les valeurs sont refaites (n° de suivi, identifiants, horaires,
//  point) — le dépôt est public.
//   A. Le lecteur (`lireReponseVintedGo`) lit rue + ville + point_id.
//   B. La ligne rangée (`ligneApresEssai`) les garde ; les lecteurs scalaires
//      (`SELECT_TRANSP_META` → `ligneTranspDeMeta`) les relisent.
//   C. `lieuTransp` dit la rue ; Chronopost / Mondial Relay inchangés.
//   D. La règle de l'app (`lieuCompleteParTransporteur` + `pointsARetirer` +
//      `requetesBan`/`jugerBan`) : l'e-mail « Kusmi Tea, 13 Rue Saint-Vincent »
//      sans code postal, complété PAR LE N° ⇒ une adresse cherchable ⇒ une
//      épingle ; sans suivi lu ⇒ « pas sur la carte » + la raison et le geste ;
//      deux adresses ⇒ rien, dit ; Mondial Relay / Chronopost ⇒ rien de changé.
//   E. Colis branche la règle sur ses e-mails (« à retirer » et « à vérifier »).
//  `--racine chemin` : une autre copie du dépôt (preuve sur l'avant).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const argv = process.argv;
const R = argv.includes('--racine') ? path.resolve(argv[argv.indexOf('--racine') + 1]) : path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };
const importer = (p) => import('file://' + path.join(R, p));

// La forme de la vraie réponse (mesurée le 1er nov.), valeurs refaites.
const H = 3600000, NOW = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const evVg = (id, group, message, ms, metadata = {}) => ({ id, message, timestamp: iso(ms), metadata, banner_message: null, group_header: null, group, state: 'delivery' });
const reponseVg = (adresse, pointId = 900123, { retire = false } = {}) => JSON.stringify({
  tracking_events: [
    ...(retire ? [evVg(9000000012, 'delivered', 'Colis retiré par le destinataire', NOW - H)] : []),
    evVg(9000000011, 'ready_for_pickup', 'Le colis est prêt à être retiré en consigne', NOW - 20 * H, adresse == null ? {} : { address: adresse, point_id: pointId }),
    evVg(9000000010, 'in_transit', 'Le colis est en chemin vers le/la consigne', NOW - 30 * H),
    evVg(9000000009, 'in_transit', 'Colis arrivé au centre de tri: Paris, FR', NOW - 40 * H),
    evVg(9000000008, 'shipped', 'Le colis a été déposé en point relais', NOW - 60 * H),
    evVg(9000000007, 'created', "Bordereau d'envoi créé", NOW - 70 * H),
  ],
  meta: { banner: null, expiration_time: iso(NOW + 3 * 24 * H), contextual_faq: [{ question: 'Q ?', answer: 'R.' }] },
});
// Une réponse de la Base Adresse Nationale (la forme de api-adresse.data.gouv.fr).
const ban = (feats) => ({ type: 'FeatureCollection', features: feats.map((f) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [f.lon, f.lat] }, properties: { label: f.label, score: f.score, type: f.type || 'housenumber', name: f.name, postcode: f.postcode, city: f.city } })) });

(async () => {
  const T = await essaie('chargement de transporteurs.js', () => importer('api/_lib/transporteurs.js'));
  const S = await essaie('chargement de suivi-colis.js', () => importer('api/_lib/suivi-colis.js'));
  const M = await essaie('chargement de relaisColis.js', () => importer('src/relaisColis.js'));
  if (!T || !S || !M) { console.log(`\n${ok} ✅ · ${ko} ❌`); process.exit(1); }
  const SUIVI = 'VGS0000900000001';

  let lu = null;
  await essaie('A. le lecteur Vinted Go', async () => {
    lu = T.lireReponseVintedGo(200, 'application/json', reponseVg('13 Rue Saint-Vincent, Vannes, FR'), { suivi: SUIVI });
    dit(lu.res === 'ok' && lu.etat === 'disponible', 'la vraie forme (`ready_for_pickup` + `meta.expiration_time`) ⇒ disponible', `${lu.res} ${lu.etat}`);
    dit(lu.lieuRue === '13 Rue Saint-Vincent', 'la RUE du point est lue dans `metadata.address`', JSON.stringify(lu.lieuRue));
    dit(lu.lieuVille === 'Vannes' && lu.lieuCp === '', 'la VILLE est lue (« <rue>, <Ville>, FR ») ; aucun code postal inventé', `${lu.lieuVille} | ${lu.lieuCp}`);
    dit(lu.pointId === '900123', 'l’identifiant du point (`point_id`) est gardé', JSON.stringify(lu.pointId));
    const cp = T.lireReponseVintedGo(200, 'application/json', reponseVg('13 Rue Saint-Vincent, 56000 Vannes, FR'), { suivi: SUIVI });
    dit(cp.lieuRue === '13 Rue Saint-Vincent' && cp.lieuCp === '56000' && cp.lieuVille === 'Vannes', 'si un jour l’adresse porte « CP Ville », les deux sont lus', JSON.stringify([cp.lieuRue, cp.lieuCp, cp.lieuVille]));
    const sans = T.lireReponseVintedGo(200, 'application/json', reponseVg(null), { suivi: SUIVI });
    dit(sans.etat === 'disponible' && !sans.lieuRue && !sans.lieuVille && !sans.lieuCp, '`metadata: {}` ⇒ disponible, aucun lieu (rien deviné)', JSON.stringify([sans.lieuRue, sans.lieuVille]));
    const ret = T.lireReponseVintedGo(200, 'application/json', reponseVg('13 Rue Saint-Vincent, Vannes, FR', 900123, { retire: true }), { suivi: SUIVI });
    dit(ret.etat === 'retire' && ret.lieuRue === '13 Rue Saint-Vincent', 'un colis retiré garde le lieu où il attendait', `${ret.etat} ${ret.lieuRue}`);
  });

  await essaie('B. la ligne rangée et sa relecture scalaire', async () => {
    const apres = T.ligneApresEssai(null, lu, { carrier: 'vinted', suivi: SUIVI, source: 'serveur', statut: 200 });
    dit(apres.lieuRue === '13 Rue Saint-Vincent' && apres.lieuVille === 'Vannes' && apres.pointId === '900123', 'la ligne `transp_vinted_…` garde rue, ville et point', JSON.stringify([apres.lieuRue, apres.lieuVille, apres.pointId]));
    // `meta` = les scalaires de premier niveau (migration 004) ; le SELECT les projette.
    const meta = Object.fromEntries(Object.entries(apres).filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v)));
    const sel = T.SELECT_TRANSP_META.split(',').map((x) => x.split(':'));
    const proj = { id: T.cleTransp('vinted', SUIVI) };
    for (const [alias, src] of sel) { if (!src) continue; const k = src.replace(/^meta->>/, ''); proj[alias] = meta[k] == null ? null : String(meta[k]); }
    const relu = T.ligneTranspDeMeta(proj);
    dit(!!relu && relu.lieuRue === '13 Rue Saint-Vincent' && relu.lieuVille === 'Vannes' && relu.pointId === '900123', 'les lecteurs (app, widget, cron) relisent rue, ville et point par `meta->>` (jamais `select=data`)', JSON.stringify(relu && [relu.lieuRue, relu.lieuVille, relu.pointId]));
  });

  await essaie('C. le lieu dit par le transporteur', async () => {
    dit(S.lieuTransp({ lieuNom: '', lieuRue: '13 Rue Saint-Vincent', lieuCp: '', lieuVille: 'Vannes' }) === '13 Rue Saint-Vincent, Vannes', 'Vinted Go : « 13 Rue Saint-Vincent, Vannes »', S.lieuTransp({ lieuRue: '13 Rue Saint-Vincent', lieuVille: 'Vannes' }));
    dit(S.lieuTransp({ lieuNom: 'Relais Exemple', lieuCp: '35000', lieuVille: 'Rennes' }) === 'Relais Exemple, 35000 Rennes', 'Chronopost / Mondial Relay (nom + CP ville, sans rue) : inchangé', S.lieuTransp({ lieuNom: 'Relais Exemple', lieuCp: '35000', lieuVille: 'Rennes' }));
  });

  await essaie('D. la règle de l’app', async () => {
    if (typeof M.lieuCompleteParTransporteur !== 'function') { dit(false, 'la règle `lieuCompleteParTransporteur` existe', typeof M.lieuCompleteParTransporteur); return; }
    const tr = T.ligneTranspDeMeta({ id: T.cleTransp('vinted', SUIVI), ...T.ligneApresEssai(null, lu, { carrier: 'vinted', suivi: SUIVI, source: 'serveur', statut: 200 }) });
    const email = { lieuNom: 'Kusmi Tea', lieuAdresse: '13 Rue Saint-Vincent' };   // cleanLieu(« Consigne Vinted Go, Kusmi Tea, 13 Rue Saint-Vincent »)
    const c = M.lieuCompleteParTransporteur(email, tr);
    dit(c.lieuNom === 'Kusmi Tea' && c.lieuAdresse === '13 Rue Saint-Vincent, Vannes' && c.lieuComplete === 'transporteur', 'l’e-mail sans code postal ni ville est complété par le suivi DU MÊME N°', JSON.stringify(c));
    // Quatre colis au même point : complétés, ils font UNE épingle « 4 » cherchable.
    const colis = [1, 2, 3, 4].map((i) => ({ id: 'k' + i, transporteur: 'vinted', ...M.lieuCompleteParTransporteur(email, tr) })).map((x) => ({ ...x, nom: x.lieuNom, adresse: x.lieuAdresse }));
    const r = M.pointsARetirer({ colis });
    const p = r.points[0];
    dit(r.points.length === 1 && p.nom === 'Kusmi Tea' && p.ville === 'Vannes' && p.epingle.n === 4, 'un point « Kusmi Tea », à Vannes, épingle « 4 »', JSON.stringify(r.points.map((q) => [q.nom, q.ville, q.epingle])));
    dit(!!p.geocode && !p.sansCarte, 'le point a une adresse cherchable sur la carte — plus de « pas sur la carte »', JSON.stringify([p.geocode, p.sansCarte]));
    const q = M.requetesBan(p);
    dit(q.length === 1 && q[0].attendu && q[0].attendu.ville === 'Vannes', 'la Base Adresse est interrogée par rue + ville, la ville EXIGÉE dans la réponse', JSON.stringify(q));
    const pos = M.jugerBan(ban([{ lat: 47.6571, lon: -2.7581, label: '13 Rue Saint-Vincent 56000 Vannes', score: 0.93, name: '13 Rue Saint-Vincent', postcode: '56000', city: 'Vannes' }]), q[0].attendu);
    dit(pos && pos.lat === 47.6571, 'la réponse de la Base Adresse (même ville, score sûr) pose l’épingle', JSON.stringify(pos));
    const autreVille = M.jugerBan(ban([{ lat: 48.1, lon: -1.6, label: '13 Rue Saint-Vincent 35000 Rennes', score: 0.95, name: '13 Rue Saint-Vincent', postcode: '35000', city: 'Rennes' }]), q[0].attendu);
    dit(autreVille && autreVille.echec === 'ville', 'la même rue dans une AUTRE ville n’est jamais prise', JSON.stringify(autreVille));
    // La liste des points de Vinted : même nom + même rue ⇒ la position exacte et le code postal.
    const rv = M.pointsARetirer({ colis, pointsVinted: [{ nom: 'Kusmi Tea', adresse: '13 Rue Saint-Vincent, 56000 Vannes', lat: 47.657, lon: -2.758 }] });
    dit(rv.points[0].repere && rv.points[0].cp === '56000', 'avec la liste de points de Vinted (même nom, même rue) : sa position et son code postal', JSON.stringify([rv.points[0].repere, rv.points[0].cp]));

    // Source absente : le suivi Vinted Go pas encore lu (ou sans adresse).
    for (const [quoi, t] of [['aucun suivi lu', null], ['suivi lu sans adresse (`metadata: {}`)', T.ligneTranspDeMeta({ id: T.cleTransp('vinted', SUIVI), ...T.ligneApresEssai(null, T.lireReponseVintedGo(200, 'application/json', reponseVg(null), { suivi: SUIVI }), { carrier: 'vinted', suivi: SUIVI, source: 'serveur', statut: 200 }) })]]) {
      const x = M.lieuCompleteParTransporteur(email, t);
      const pa = M.pointsARetirer({ colis: [{ id: 'k1', transporteur: 'vinted', ...x, nom: x.lieuNom, adresse: x.lieuAdresse }] }).points[0];
      dit(!x.lieuComplete && x.lieuAdresse === '13 Rue Saint-Vincent' && !pa.geocode && pa.sansCarteCode === 'vintedgo-pas-lu' && /suivi Vinted Go/.test(pa.sansCarte) && /ouvre le suivi Vinted Go/.test(pa.sansCarte), `${quoi} ⇒ rien d’inventé, « pas sur la carte » + la raison et le geste`, JSON.stringify([x, pa.sansCarteCode, pa.sansCarte]));
    }
    // Deux adresses : l'e-mail dit une rue, le suivi une autre ⇒ rien, et c'est dit.
    const trAutre = { ...tr, lieuRue: '24 Rue Hoche' };
    const d = M.lieuCompleteParTransporteur(email, trAutre);
    const pd = M.pointsARetirer({ colis: [{ id: 'k1', transporteur: 'vinted', ...d, nom: d.lieuNom, adresse: d.lieuAdresse }] }).points[0];
    dit(!d.lieuComplete && !!d.lieuConflit && d.lieuAdresse === '13 Rue Saint-Vincent', 'deux rues différentes (e-mail / suivi) ⇒ aucune n’est prise', JSON.stringify(d));
    dit(!pd.geocode && pd.sansCarteCode === 'deux-adresses' && /deux adresses/.test(pd.sansCarte) && /24 Rue Hoche/.test(pd.sansCarte), '… et le point le dit (« deux adresses … aucune n’est choisie »)', JSON.stringify([pd.sansCarteCode, pd.sansCarte]));
    const dv = M.lieuCompleteParTransporteur({ lieuNom: 'Kusmi Tea', lieuAdresse: '13 Rue Saint-Vincent, 35000 Rennes' }, tr);
    dit(!!dv.lieuConflit && dv.lieuAdresse === '13 Rue Saint-Vincent, 35000 Rennes', 'deux villes différentes ⇒ rien de changé, conflit noté', JSON.stringify(dv));
    const pv2 = M.pointsARetirer({ colis: [{ id: 'k1', transporteur: 'vinted', ...dv, nom: dv.lieuNom, adresse: dv.lieuAdresse }], pointsVinted: [{ nom: 'Kusmi Tea', adresse: '13 Rue Saint-Vincent, 35000 Rennes', lat: 48.1, lon: -1.6 }] }).points[0];
    dit(!pv2.geocode && !pv2.repere && pv2.sansCarteCode === 'deux-adresses', '… même un e-mail complet n’est pas mis sur la carte quand le suivi dit ailleurs (ni Base Adresse, ni liste Vinted)', JSON.stringify([pv2.geocode, pv2.repere, pv2.sansCarteCode]));
    const abr = M.lieuCompleteParTransporteur({ lieuNom: 'Kusmi Tea', lieuAdresse: '13 rue St Vincent' }, tr);
    dit(abr.lieuComplete === 'transporteur', '« 13 rue St Vincent » = « 13 Rue Saint-Vincent » (abréviation, majuscules) : la même rue', JSON.stringify(abr));
    // Un suivi qui n'est pas « disponible » / « retiré » (en route) ne dit pas où le colis attend.
    dit(!M.lieuCompleteParTransporteur(email, { ...tr, etat: 'en_route' }).lieuComplete, 'un suivi « en route » ne complète rien (le colis n’attend nulle part)', '');
    // Mondial Relay / Chronopost : nom + CP + ville, sans rue ⇒ rien de changé.
    const mr = { lieuNom: 'Tabac Exemple', lieuAdresse: '' };
    const trMr = { carrier: 'mondialrelay', etat: 'disponible', lieuNom: 'TABAC EXEMPLE', lieuCp: '35260', lieuVille: 'CANCALE', lieuRue: '' };
    const m2 = M.lieuCompleteParTransporteur(mr, trMr);
    dit(JSON.stringify(m2) === JSON.stringify(mr), 'Mondial Relay / Chronopost (aucune rue) : le lieu de l’e-mail est rendu tel quel', JSON.stringify(m2));
    const complet = { lieuNom: 'Tabavap', lieuAdresse: '29 Rue Hoche, 56000 Vannes' };
    dit(JSON.stringify(M.lieuCompleteParTransporteur(complet, { ...tr, lieuRue: '29 Rue Hoche' })) === JSON.stringify(complet), 'un e-mail déjà complet (rue, CP, ville) n’est pas touché', '');
  });

  await essaie('E. Colis branche la règle', async () => {
    const A = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8').replace(/\/\/[^\n]*/g, '');
    dit(/const lieuDeLigne = \(t\) => \{[^}]*lieuCompleteParTransporteur\(lieuDe\(t && t\.lieu\), \(t && t\.transp\) \|\| \(tpmC && k \? tpmC\.get\(k\)/.test(A), 'les cartes « À retirer » complètent le lieu par la ligne `transp_` du MÊME n° (`suiviDeLigne`)', '');
    dit(/for \(const t of \(pickupUnion\.emailList \|\| \[\]\)\) \{\s*const a = achatDuColis\(t, buysBase, indexSuivisAchats\); const lu = lieuDeLigne\(t\);/.test(A), '… pour les e-mails « à retirer »', '');
    dit(/const lu = x\.kind === 'email' \? lieuDeLigne\(x\.t\)/.test(A), '… et pour les « à vérifier »', '');
    const C = fs.readFileSync(path.join(R, 'src', 'CarteRelais.jsx'), 'utf8');
    dit(/if \(p\.sansCarte\) return p\.sansCarteCode \|\| 'adresse';/.test(C), 'le code de la raison (`data-raison`) suit la règle (`deux-adresses`, `vintedgo-pas-lu`)', '');
  });

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
