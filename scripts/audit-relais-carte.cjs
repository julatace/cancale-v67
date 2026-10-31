// ════════════════════════════════════════════════════════════════════════════
//  LES COLIS PAR POINT RELAIS (31 octobre, 5.295)
//  Julien : « l'extension peut essayer de capter le nom des points relais où les
//  colis vont arriver, pour prévoir ; une carte avec les colis à aller chercher
//  par point relais, et des prévisions ».
//   A. La règle de l'extension (`<suivi-regle>`, le VRAI texte de background.js
//      exécuté dans un `vm`) : le point de RETRAIT, jamais le point de DÉPÔT ni
//      une personne ; deux points ⇒ pas su ; l'arrivée ESTIMÉE sous une clé qui
//      le dit, deux dates ⇒ pas su, une date limite n'en est pas une.
//   B. La règle de l'app (`src/relaisColis.js`) : des LIEUX regroupés (nom
//      normalisé + code postal), jamais des colis rapprochés ; un repère de carte
//      seulement s'il est sûr (adresse, score, même code postal).
//  Données INVENTÉES (le dépôt est public). `--src chemin` : une autre copie du
//  fond ; `--app chemin` : une autre copie de relaisColis.js (preuve sur l'avant).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path');
const argv = process.argv;
const bgPath = argv.includes('--src') ? path.resolve(argv[argv.indexOf('--src') + 1]) : path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
const appPath = argv.includes('--app') ? path.resolve(argv[argv.indexOf('--app') + 1]) : path.join(__dirname, '..', 'src', 'relaisColis.js');
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

(async () => {
  await essaie('A. la règle du suivi', async () => {
    const BG = fs.readFileSync(bgPath, 'utf8');
    const i = BG.indexOf('// <suivi-regle>'), j = BG.indexOf('// </suivi-regle>');
    const R = vm.runInContext(BG.slice(i, j) + '\n;({ relaisDestination: typeof relaisDestination === "function" ? relaisDestination : null, arriveeEstimeeSuivi: typeof arriveeEstimeeSuivi === "function" ? arriveeEstimeeSuivi : null, nettoyerRelaisSuivi: typeof nettoyerRelaisSuivi === "function" ? nettoyerRelaisSuivi : null })', vm.createContext({ console }));
    dit(!!R.relaisDestination && !!R.arriveeEstimeeSuivi, 'la règle sait lire la destination et l’arrivée estimée d’un suivi', JSON.stringify(Object.keys(R).filter((k) => R[k])));
    if (!R.relaisDestination) return;
    const JOUR = (d) => new Date(Date.now() + d * 86400000).toISOString();
    const suivi = {
      transaction_id: 30000000123,
      shipment: {
        recipient: { full_name: 'Jeanne Inventée', address: { line1: '12 rue des Lilas', postal_code: '29200', city: 'Brest' } },
        drop_off_point: { name: 'Bureau Dépôt', address_line1: '1 place du Vendeur', postal_code: '75001', city: 'Paris' },
        pickup_point: { name: 'Tabac du Port', address: { line1: '40 rue du Port', postal_code: '35260', city: 'Cancale' }, code: 'C48291', pickup_contact: { name: 'Marc Gérant' } },
        estimated_delivery_date: JOUR(2), pickup_deadline: JOUR(9),
        journey: [{ title: 'Commande expédiée', date: JOUR(-1) }],
      },
    };
    const r = R.relaisDestination(suivi);
    dit(!!r && r.nom === 'Tabac du Port' && r.rue === '40 rue du Port' && r.cp === '35260' && r.ville === 'Cancale', 'le point de RETRAIT (nom, rue, code postal, ville) — pas le point de dépôt du vendeur, pas le destinataire', JSON.stringify(r));
    dit(!JSON.stringify(r).includes('Marc') && !JSON.stringify(r).includes('C48291'), 'ni le contact du point relais, ni le code de retrait', JSON.stringify(r));
    dit(R.relaisDestination({ shipment: { drop_off_point: { name: 'Bureau Dépôt', postal_code: '75001' } } }) === null, 'seulement un point de DÉPÔT ⇒ `null` (ce n’est pas là qu’il arrive)', '');
    const vend = R.relaisDestination({ shipment: { sender_relay_point: { name: 'Relais du Vendeur', postal_code: '75001' }, return_pickup_point: { name: 'Relais Retour', postal_code: '69001' }, pickup_point: { name: 'Tabac du Port', postal_code: '35260' } } });
    dit(!!vend && vend.nom === 'Tabac du Port', 'le relais du VENDEUR ou d’un RETOUR (même nommé « relay » / « pickup ») n’est jamais la destination', JSON.stringify(vend));
    dit(R.relaisDestination({ a: { pickup_point: { name: 'Relais A', postal_code: '35000' } }, b: { pickup_point: { name: 'Relais B', postal_code: '35000' } } }) === null, 'deux points de retrait différents ⇒ `null` (on ne choisit pas)', '');
    dit(R.relaisDestination({ pickup_point: { name: 'Relais A', email: 'x@y.z', phone: '06 12 34 56 78', address: 'jeanne@exemple.test' } }).rue === '', 'une « adresse » qui est un e-mail n’est pas gardée', JSON.stringify(R.relaisDestination({ pickup_point: { name: 'Relais A', address: 'jeanne@exemple.test' } })));
    dit(R.relaisDestination({ shipment: { tracking: 'X' } }) === null, 'aucune clé de point de retrait ⇒ `null` (pas su, jamais deviné)', '');
    const e = R.arriveeEstimeeSuivi(suivi);
    dit(e === JOUR(2).slice(0, 10), 'l’arrivée ESTIMÉE (`estimated_delivery_date`) — jamais la date limite de retrait', String(e));
    dit(R.arriveeEstimeeSuivi({ estimatedDeliveryDate: JOUR(2), expected_arrival: JOUR(3) }) === null, 'deux estimations différentes ⇒ `null`', '');
    dit(R.arriveeEstimeeSuivi({ pickup_deadline: JOUR(3), expires_at: JOUR(4) }) === null, 'une date LIMITE seule n’est pas une arrivée estimée', '');
    dit(R.arriveeEstimeeSuivi({ drop_off_point: { estimated_date: JOUR(1) } }) === null, 'une estimation sous le point de DÉPÔT n’est pas l’arrivée chez toi', '');
    const n = R.nettoyerRelaisSuivi({ nom: 'Tabac du Port', rue: '40 rue du Port', cp: '35260', ville: 'Cancale', autre: 'Jeanne', contact: { name: 'Marc' } });
    dit(n && Object.keys(n).sort().join() === 'cp,nom,rue,ville', 'un point relais reçu d’une page est refait par la règle : quatre textes, rien d’autre', JSON.stringify(n));
  });

  await essaie('B. la règle de l’app', async () => {
    const src = fs.readFileSync(appPath, 'utf8').replace(/^export\s+(function|const)/gm, '$1');
    const noms = ['regrouperRelais', 'adresseGeocodable', 'repereDepuisBan', 'decouperAdresse', 'normNomRelais'];
    const M = vm.runInContext(src + '\n;({' + noms.map((k) => `${k}: typeof ${k} !== 'undefined' ? ${k} : null`).join(',') + '})', vm.createContext({}));
    dit(!!M.regrouperRelais, 'src/relaisColis.js porte la règle', '');
    if (!M.regrouperRelais) return;
    const g = M.regrouperRelais({
      arrives: [
        { id: 'e:MR1', nom: "TABA'VAP", adresse: '29 Rue Hoche, 56000 Vannes', transporteur: 'mondialrelay', aCode: true },
        { id: 'v:9401', nom: 'TABAVAP', adresse: '29 RUE HOCHE, 56000 VANNES', aCode: false, titre: 'Samba' },
        { id: 'e:MR2', nom: 'Tabac du Port', adresse: '40 Rue du Port, 35260 Cancale', aCode: true },
        { id: 'e:MR1', nom: "TABA'VAP", adresse: '29 Rue Hoche, 56000 Vannes', aCode: true },
      ],
      attendus: [
        { id: 'v:9500', nom: 'Tabavap', rue: '29 rue Hoche', cp: '56000', ville: 'Vannes', estimee: '2026-11-03', titre: 'Dunk' },
        { id: 'v:9501', nom: 'Tabac du Port', rue: '', cp: '29200', ville: 'Brest', estimee: null, titre: 'XT-6' },
        { id: 'v:9502', nom: 'Super U', rue: '', cp: '', ville: '', estimee: 'pas-une-date', titre: 'AF1' },
      ],
    });
    const par = Object.fromEntries(g.map((x) => [x.cle, x]));
    const vannes = par['tabavap|56000'];
    dit(!!vannes && vannes.nArrives === 2 && vannes.nAttendus === 1, "« TABA'VAP » (e-mail) et « TABAVAP » (conversation), même code postal : UN point — deux colis arrivés, un attendu", JSON.stringify(g.map((x) => [x.cle, x.nArrives, x.nAttendus])));
    dit(!!vannes && vannes.arrives.filter((c) => c.id === 'e:MR1').length === 1, 'un même colis (même identité) ne compte qu’une fois', JSON.stringify(vannes && vannes.arrives));
    dit(!!par['tabacduport|35260'] && !!par['tabacduport|29200'] && par['tabacduport|29200'].nAttendus === 1, 'le même NOM dans deux villes : deux points (jamais fusionnés à la ressemblance)', JSON.stringify(Object.keys(par)));
    dit(!!par['superu|'] && par['superu|'].attendus[0].estimee === null && par['superu|'].geocode === null, 'une date d’arrivée illisible n’est pas dite ; une adresse sans rue ni code postal n’a pas de repère', JSON.stringify(par['superu|']));
    dit(!!vannes && vannes.prochaineEstimee === '2026-11-03' && g[0].nArrives > 0 && g[g.length - 1].nArrives === 0, 'les points où des colis ATTENDENT d’abord ; la prochaine arrivée estimée est dite', JSON.stringify(g.map((x) => x.cle)));
    const seul = M.regrouperRelais({ arrives: [{ id: 'e:1', nom: 'Kusmi Tea', adresse: '13 Rue Saint-Vincent, 56000 Vannes' }], attendus: [{ id: 'v:2', nom: 'Kusmi Tea', rue: '', cp: '', ville: '' }] });
    dit(seul.length === 1 && seul[0].nArrives === 1 && seul[0].nAttendus === 1, 'un lieu sans code postal rejoint le SEUL point qui porte ce nom', JSON.stringify(seul.map((x) => x.cle)));
    const deux = M.regrouperRelais({ arrives: [{ id: 'e:1', nom: 'Kusmi Tea', adresse: '13 Rue X, 56000 Vannes' }, { id: 'e:2', nom: 'Kusmi Tea', adresse: '2 Rue Y, 35000 Rennes' }], attendus: [{ id: 'v:3', nom: 'Kusmi Tea' }] });
    dit(deux.length === 3, '…et reste à part quand DEUX points portent ce nom (on ne choisit pas)', JSON.stringify(deux.map((x) => x.cle)));
    dit(M.adresseGeocodable({ rue: '40 rue du Port', cp: '35260', ville: 'Cancale' }) === '40 rue du Port, 35260 Cancale' && M.adresseGeocodable({ rue: '', cp: '35260', ville: 'Cancale' }) === null && M.adresseGeocodable({ rue: 'Centre commercial', cp: '35260' }) === null, 'une adresse à chercher = une rue avec son numéro + code postal ou ville ; une ville seule, jamais (épingle au centre de la ville = faux)', '');
    const ban = (o) => ({ features: [{ geometry: { coordinates: [-1.85, 48.67] }, properties: Object.assign({ score: 0.9, type: 'housenumber', postcode: '35260' }, o) }] });
    dit(JSON.stringify(M.repereDepuisBan(ban({}), '35260')) === '{"lat":48.67,"lon":-1.85}', 'un résultat sûr de la Base Adresse Nationale donne le repère', '');
    dit(M.repereDepuisBan(ban({ postcode: '35400' }), '35260') === null && M.repereDepuisBan(ban({ score: 0.4 }), '35260') === null && M.repereDepuisBan(ban({ type: 'municipality' }), '35260') === null && M.repereDepuisBan({ features: [] }, '35260') === null, 'un autre code postal, un score faible, une commune, rien ⇒ PAS de repère (listé sans épingle)', '');
  });

  // ── C. (1er nov.) « IL N'Y A PAS TOUS LES POINTS RELAIS » ──────────────────
  // La colonne « À retirer » de Colis, par point : aucun colis écarté, un même
  // relais écrit de deux façons regroupé PAR IDENTITÉ (jamais deux relais
  // différents), le nom propre (pas le type, pas le transporteur, pas la ville),
  // la position que Vinted donne pour SON point (nom + code postal).
  await essaie('C. la colonne « À retirer » par point', async () => {
    const src = fs.readFileSync(appPath, 'utf8').replace(/^export\s+(function|const)/gm, '$1');
    const noms = ['pointsARetirer', 'nomRelaisPropre', 'repereDepuisPointsVinted', 'decouperAdresse', 'regrouperRelais', 'requetesBan', 'CLE_INCONNU'];
    const M = vm.runInContext(src + '\n;({' + noms.map((k) => `${k}: typeof ${k} !== 'undefined' ? ${k} : null`).join(',') + '})', vm.createContext({}));
    dit(!!M.pointsARetirer, 'src/relaisColis.js range la colonne « À retirer » par point (`pointsARetirer`)', '');
    if (!M.pointsARetirer) return;
    // Les formes RÉELLES des sources (historique colis-retraits), inventées pour le reste.
    const colis = [
      { id: 'e:MR1', nom: "TABA'VAP", adresse: '29 Rue Hoche, 56000 Vannes', transporteur: 'mondialrelay', jours: 3 },                // e-mail Mondial Relay
      { id: 'v:1', nom: 'Tabavap', adresse: '29 Rue Hoche, 56000 Vannes', jours: null },                                            // conversation (cleanLieu « point relais TABAVAP, TABAVAP… »)
      { id: 'e:VG1', nom: 'Kusmi Tea', adresse: '13 Rue Saint-Vincent', transporteur: 'vinted', jours: 4 },                        // Vinted Go sans code postal
      { id: 'v:2', nom: 'Kusmi Tea', adresse: '13 Rue Saint-Vincent, 56000 Vannes' },
      { id: 'e:VG2', nom: 'Speed Queen - Vannes', adresse: '24 Rue Hoche', transporteur: 'vinted', jours: 1 },                      // consigne « Speed Queen - Vannes »
      { id: 'v:3', nom: 'Speed Queen', adresse: '24 Rue Hoche, 56000 Vannes' },
      { id: 'e:CP1', nom: 'Votre Relais Pickup TERRA CBD', adresse: '11 Rue Hoche, 56000 Vannes', transporteur: 'chronopost' },   // phrase Chronopost
      { id: 'e:CP2', nom: 'TERRA CBD', adresse: '11 RUE HOCHE, 56000 VANNES', transporteur: 'chronopost' },
      { id: 'e:MR2', nom: 'Cancale', adresse: '40 Rue Du Port, 35260 Cancale', transporteur: 'mondialrelay' },                      // nom = la ville (cleanLieu)
      { id: 'e:T1', nom: 'TABAC DU PORT', adresse: '35260 CANCALE', transporteur: 'mondialrelay' },                                 // lieu du transporteur sans rue
      { id: 'e:CP3', nom: 'Chronopost', adresse: '', transporteur: 'chronopost', sansLieu: { raison: 'r', geste: 'g' } },           // « chez Chronopost »
      { id: 'e:CP4', nom: '', adresse: '', transporteur: 'chronopost', sansLieu: { raison: 'r', geste: 'g' } },                      // aucun lieu
      { id: 'e:LP1', nom: 'Carrefour City', adresse: '3 Rue de Brest, 35000 Rennes', transporteur: 'colissimo' },                   // même enseigne,
      { id: 'e:LP2', nom: 'Carrefour City', adresse: '8 Rue Nationale, 29200 Brest', transporteur: 'colissimo' },                   // deux villes
      { id: 'e:VX', nom: 'Super U', adresse: '1 Route de Rennes', horsCompte: true, aVerifier: true },
    ];
    const v = M.pointsARetirer({ colis, attendus: [{ id: 'v:9', nom: 'Tabavap', rue: '29 rue Hoche', cp: '56000', ville: 'Vannes', estimee: '2026-11-03' }],
      pointsVinted: [{ nom: 'Kusmi Tea', adresse: '13 Rue Saint-Vincent, 56000 Vannes', lat: 47.6571, lon: -2.757 }, { nom: 'Kusmi Tea', adresse: '2 Rue Lafayette, 35000 Rennes', lat: 48.11, lon: -1.68 },
        { nom: 'Carrefour City', adresse: '9 Rue Inconnue, 75011 Paris', lat: 48.86, lon: 2.37 }, { nom: 'Bar Vide', adresse: '1 Rue X, 56000 Vannes', lat: '', lon: '' }] });
    const par = Object.fromEntries(v.points.map((p) => [p.cle, p]));
    const ou = {}; for (const p of v.points) for (const c of p.arrives) ou[c.id] = p.cle;
    dit(colis.every((c) => ou[c.id]), 'AUCUN colis écarté : chacun est sous un point, ou sous « pas encore connu »', JSON.stringify(colis.filter((c) => !ou[c.id]).map((c) => c.id)));
    dit(v.nComptes === colis.filter((c) => !c.horsCompte).length && v.nHors === 1, 'le compte = les colis comptés ; le « à vérifier » est à part', `${v.nComptes} · ${v.nHors}`);
    dit(ou['e:MR1'] === 'tabavap|56000' && ou['v:1'] === 'tabavap|56000' && par['tabavap|56000'].nAttendus === 1, "« TABA'VAP » et « Tabavap », même code postal : UN point (et l'achat en route y est)", JSON.stringify([ou['e:MR1'], ou['v:1']]));
    dit(ou['e:VG1'] === 'kusmitea|56000' && ou['v:2'] === 'kusmitea|56000', 'Kusmi Tea SANS code postal (Vinted Go) rejoint le seul Kusmi Tea à code postal', JSON.stringify([ou['e:VG1'], ou['v:2']]));
    dit(ou['e:VG2'] === 'speedqueen|56000', '« Speed Queen - Vannes » (sans code postal) = « Speed Queen » à Vannes', ou['e:VG2']);
    dit(ou['e:CP1'] === 'terracbd|56000' && ou['e:CP2'] === 'terracbd|56000' && par['terracbd|56000'].nom === 'TERRA CBD', '« Votre Relais Pickup TERRA CBD » : le type n’est pas le nom — un point TERRA CBD', JSON.stringify([ou['e:CP1'], par['terracbd|56000'] && par['terracbd|56000'].nom]));
    dit(ou['e:MR2'] === 'adr:40rueduport|35260' && par['adr:40rueduport|35260'].nom === '', 'un « nom » qui n’est que la ville n’est pas un nom : le point est désigné par son adresse', JSON.stringify([ou['e:MR2']]));
    dit(ou['e:CP3'] === M.CLE_INCONNU && ou['e:CP4'] === M.CLE_INCONNU && par[M.CLE_INCONNU].arrives.every((c) => c.sansLieu), 'un transporteur n’est pas un lieu ; sans lieu ⇒ « pas encore connu », avec sa raison', JSON.stringify([ou['e:CP3'], ou['e:CP4']]));
    dit(ou['e:LP1'] === 'carrefourcity|35000' && ou['e:LP2'] === 'carrefourcity|29200', 'la même enseigne dans deux villes : DEUX points (jamais fusionnés à la ressemblance)', JSON.stringify([ou['e:LP1'], ou['e:LP2']]));
    dit(ou['e:VX'] === 'superu|' && par['superu|'].nComptes === 0, 'un « à vérifier » reste listé sous son point, sans compter', JSON.stringify(par['superu|'] && [par['superu|'].nArrives, par['superu|'].nComptes]));
    const kus = par['kusmitea|56000'];
    dit(!!kus && kus.repere && kus.repere.lat === 47.6571 && !kus.sansCarte, 'Kusmi Tea est placé par la position que Vinted donne pour CE point (même nom, même code postal) — pas l’homonyme de Rennes', JSON.stringify(kus && kus.repere));
    dit(!par['carrefourcity|35000'].repere && !par['carrefourcity|29200'].repere, 'un « Carrefour City » de la liste Vinted à Paris ne place AUCUN Carrefour City d’ailleurs (le nom seul n’est pas une identité)', '');
    dit(/rue du point n’a pas été donnée/.test(par['tabacduport|35260'].sansCarte || '') && par['tabacduport|35260'].adresse === '35260 Cancale', 'le lieu du transporteur sans rue : « 35260 Cancale », pas sur la carte, raison dite (plus « 35260 CANCALE, 35260 »)', JSON.stringify([par['tabacduport|35260'].adresse, par['tabacduport|35260'].sansCarte]));
    dit(par['speedqueen|56000'].urgent && v.points[0].cle === 'speedqueen|56000', 'le point au dernier jour est en tête, marqué urgent', JSON.stringify(v.points.map((p) => p.cle)));
    const connus = v.points.filter((p) => !p.inconnu);
    dit(connus.every((p, i) => p.numero === i + 1) && v.points[v.points.length - 1].inconnu && v.points[v.points.length - 1].numero === null, 'les points sont numérotés 1…N (le même numéro sur l’épingle), « pas encore connu » à la fin, sans numéro', JSON.stringify(v.points.map((p) => [p.cle, p.numero])));
    dit(M.nomRelaisPropre('Consigne Vinted Go') === '' && M.nomRelaisPropre('Point relais TABAVAP') === 'TABAVAP' && M.nomRelaisPropre('Mondial Relay') === '' && M.nomRelaisPropre('Bureau de Poste Cancale') === 'Bureau de Poste Cancale', 'le nom propre : sans le type ni le transporteur ; « Bureau de Poste » garde son nom', '');
    const rq = M.requetesBan({ rue: '29 Rue Hoche', cp: '56000', ville: 'Vannes' });
    dit(rq.length === 2 && rq[0].postcode === '56000' && /29 Rue Hoche, 56000 Vannes/.test(rq[0].q) && M.requetesBan({ rue: '', cp: '56000', ville: 'Vannes' }).length === 0, 'la recherche d’adresse : rue + code postal + ville, puis rue + ville ; jamais une ville seule', JSON.stringify(rq));
  });

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
