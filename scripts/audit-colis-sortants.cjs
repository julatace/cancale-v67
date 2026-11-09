require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
// audit-colis-sortants.cjs — UN COLIS VENDU PRIS EN CHARGE CHEZ LE TRANSPORTEUR EST PARTI (8 nov. 2026)
//
// Julien (8 nov.) : « J'ai une commande qui est marquée comme non envoyée car je n'ai pas
// réactualisé Vestiaire Collective, mais tu as le numéro de suivi donc tu peux très bien
// regarder le statut du colis et voir qu'il a été expédié. Je te laisse faire ça pour tous
// les colis, comme ça il n'y a plus d'erreur. »
// La règle (api/_lib/depart-colis.js) et ce qu'elle protège (§5) :
//  1. la prise en charge se PROUVE : « étiquette créée » (Chronopost DC, Vinted Go created),
//     « inconnu », « incident », une lecture ratée ⇒ rien ;
//  2. l'identité est le n° de suivi EXACT : 50 ventes au même titre, une seule prise en
//     charge ⇒ UNE seule vente sort (la sienne) ; un n° sur deux ventes, ou sur une vente
//     ET un achat ⇒ ambigu ⇒ rien ; une prise en charge datée avant la vente ⇒ rien ;
//  3. « pas su » ne vaut pas « oui » : départs absents/illisibles ⇒ « à envoyer » inchangé ;
//  4. une prise en charge ne recule pas (une lecture plus pauvre ensuite la garde) ;
//  5. le cloisonnement : `depart_…` n'est jamais une ligne `transp_…` (le chemin de « à
//     retirer ») ; la sélection des achats (`suivisAInterroger`) n'a pas changé de règle ;
//  6. les comptes : Colis/Ma journée/cloche (app) et widget/rappels (serveur) lisent la
//     MÊME règle (`colisVcAPoster` + `txVintedParties`).
// Données INVENTÉES. Usage : node scripts/audit-colis-sortants.cjs (RACINE=<arbre> : l'arbre d'avant)
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const path = require('path'), fs = require('fs');
const RACINE = process.env.RACINE || path.join(__dirname, '..');
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) { ok++; console.log('  ✓ ' + m); } else { ko++; console.log('  ✗ ' + m + (d ? '\n      ' + d : '')); } };
const H = 3600000, NOW = Date.parse('2026-11-08T10:00:00Z');
const iso = (ms) => new Date(ms).toISOString();
const cpEv = (code, ms, libelle) => ({ code, ms, libelle });
const cpXml = (sky, evs) => `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns1:trackSkybillV2Response xmlns:ns1="http://cxf.tracking.soap.chronopost.fr/"><return><errorCode>0</errorCode><listEventInfoComp>${evs.map((e) => `<events><code>${e.code}</code><eventDate>${iso(e.ms)}</eventDate><eventLabel>${e.libelle}</eventLabel><officeLabel>VANNES - FR - TEST</officeLabel><zipCode>99999</zipCode></events>`).join('')}<skybillNumber>${sky}</skybillNumber></listEventInfoComp></return></ns1:trackSkybillV2Response></soap:Body></soap:Envelope>`;
const vgJson = (evs) => JSON.stringify({ tracking_events: evs.map((e, i) => ({ id: 'e' + i, message: e.group, timestamp: iso(e.ms), metadata: {}, group: e.group, state: 'delivery' })), meta: {} });
(async () => {
  let D = null, VC = null, T = null;
  try { D = await import('file://' + path.join(RACINE, 'api/_lib/depart-colis.js')); } catch (e) { dit(false, 'api/_lib/depart-colis.js existe', String(e.message).slice(0, 160)); }
  VC = await import('file://' + path.join(RACINE, 'api/_lib/vestiaire-regle.js'));
  T = await import('file://' + path.join(RACINE, 'api/_lib/transporteurs.js'));
  const fn = (o, k) => (o && typeof o[k] === 'function' ? o[k] : () => { throw new Error(k + ' absente'); });
  const essaie = (titre, f) => { console.log(titre); try { f(); } catch (e) { dit(false, titre + ' s’exécute', String(e && e.message).slice(0, 200)); } };

  essaie('§1 ce que prouve une lecture', () => {
    const lireCp = (n, evs) => T.lireReponseChronopost(200, 'text/xml', cpXml(n, evs), { suivi: n });
    const prise = fn(D, 'priseEnCharge');
    const dc = lireCp('XW000000001TS', [cpEv('DC', NOW - 30 * H, 'Envoi en cours de préparation')]);
    dit(prise(dc, 'chronopost') === null, 'Chronopost « en préparation » seul (DC) ⇒ rien de prouvé', JSON.stringify([dc.etat, dc.detail]));
    const db = lireCp('XW000000001TS', [cpEv('DC', NOW - 30 * H, 'Prépa'), cpEv('SM', NOW - 25 * H, 'Message'), cpEv('DB', NOW - 20 * H, 'Pris en charge'), cpEv('TT', NOW - 10 * H, 'Acheminement')]);
    dit(prise(db, 'chronopost') === NOW - 20 * H, 'DC → SM → DB → TT ⇒ pris en charge à la date du DB (le 1er évènement après l’étiquette)', String(prise(db, 'chronopost')));
    const ab = lireCp('XW000000001TS', [cpEv('DB', NOW - 20 * H, 'Pris en charge'), cpEv('AB', NOW - 2 * H, 'Disponible')]);
    dit(prise(ab, 'chronopost') === NOW - 20 * H, 'arrivé au point de l’ACHETEUR ⇒ parti (la date du dépôt)', String(prise(ab, 'chronopost')));
    const vgC = T.lireReponseVintedGo(200, 'application/json', vgJson([{ group: 'created', ms: NOW - 5 * H }]), { suivi: '1234567890123456' });
    dit(prise(vgC, 'vinted') === null, 'Vinted Go « created » seul (étiquette) ⇒ rien de prouvé', JSON.stringify([vgC.etat, vgC.detail]));
    const vgS = T.lireReponseVintedGo(200, 'application/json', vgJson([{ group: 'in_transit', ms: NOW - 2 * H }, { group: 'shipped', ms: NOW - 6 * H }, { group: 'created', ms: NOW - 9 * H }]), { suivi: '1234567890123456' });
    dit(prise(vgS, 'vinted') === NOW - 6 * H, 'Vinted Go created → shipped → in_transit ⇒ pris en charge au « shipped »', String(prise(vgS, 'vinted')));
    dit(prise({ res: 'ok', etat: 'inconnu', etatAt: iso(NOW) }, 'chronopost') === null && prise({ res: 'ok', etat: 'incident', detail: 'perdu', etatAt: iso(NOW) }, 'vinted') === null, '« inconnu » ou « incident » ⇒ rien');
    dit(prise({ res: 'introuvable' }, 'chronopost') === null && prise({ res: 'bloque' }, 'chronopost') === null && prise(null, 'chronopost') === null, 'introuvable, refus, rien lu ⇒ rien');
  });

  // Une ligne `depart_` telle que le serveur l'écrit, puis relue en scalaires.
  const ligne = (n, priseMs, o = {}) => fn(D, 'departDeMeta')({ id: `depart_chronopost_${n}`, suivi: n, carrier: 'chronopost', etat: 'en_route', priseAt: priseMs == null ? null : iso(priseMs), lu: iso(NOW - H), essai: iso(NOW - H), essaiRes: 'ok', essais: '0', fini: priseMs != null ? 'true' : 'false', ...o });
  const carte = (...l) => fn(D, 'departsParSuivi')(l.map((x) => x && ({ ...x, priseAt: x.priseAt })));

  essaie('§2 l’identité : le n° exact, jamais le titre', () => {
    const ventes = {};
    for (let i = 0; i < 50; i++) ventes['v' + i] = { aExpedier: true, suivi: `XW${String(100000000 + i).padStart(9, '0')}TS`, transporteur: 'Chronopost', date: iso(NOW - 48 * H), titre: 'Nike Dunk Low Panda 42', ref: '' };
    const avant = VC.colisVcAPoster({ ventes, liens: {} }, NOW);
    const dep = carte(ligne('XW100000017TS', NOW - 20 * H));
    const apres = VC.colisVcAPoster({ ventes, liens: {}, departs: dep }, NOW);
    dit(avant.length === 50 && apres.length === 49 && !apres.some((v) => v.id === 'v17'), '50 ventes au même titre, une prise en charge ⇒ UNE seule sort : celle de CE n° (v17)', `${avant.length} → ${apres.length} · sortie : ${avant.filter((v) => !apres.some((x) => x.id === v.id)).map((v) => v.id).join(',')}`);
    const partis = fn(VC, 'colisVcPartisLus')({ ventes, liens: {}, departs: dep }, NOW);
    dit(partis.length === 1 && partis[0].id === 'v17' && /^Chronopost l’a pris en charge le \d{1,2} \S+/.test(partis[0].depart.phrase), 'la raison est dite : « Chronopost l’a pris en charge le … »', partis[0] && partis[0].depart.phrase);
    const deux = { a: { aExpedier: true, suivi: 'XW000000500TS', date: iso(NOW - 48 * H) }, b: { aExpedier: true, suivi: 'XW000000500TS', date: iso(NOW - 48 * H) } };
    dit(VC.colisVcAPoster({ ventes: deux, departs: carte(ligne('XW000000500TS', NOW - 20 * H)) }, NOW).length === 2, 'un même n° sur DEUX ventes ⇒ ambigu ⇒ aucune ne sort');
    const achat = { a: { aExpedier: true, suivi: 'XW000000501TS', date: iso(NOW - 48 * H) } };
    dit(VC.colisVcAPoster({ ventes: achat, achats: { x: { suivi: 'xw 000000501ts' } }, departs: carte(ligne('XW000000501TS', NOW - 20 * H)) }, NOW).length === 1, 'le n° d’une vente porté aussi par un ACHAT ⇒ ambigu ⇒ rien');
    const avantVente = { a: { aExpedier: true, suivi: 'XW000000502TS', date: iso(NOW - 2 * H) } };
    dit(VC.colisVcAPoster({ ventes: avantVente, departs: carte(ligne('XW000000502TS', NOW - 72 * H)) }, NOW).length === 1, 'une prise en charge datée AVANT la vente (au-delà d’un jour) contredit l’identité ⇒ rien');
    const sansN = { a: { aExpedier: true, suivi: '', titre: 'Nike Dunk Low Panda 42', date: iso(NOW - 48 * H) } };
    dit(VC.colisVcAPoster({ ventes: sansN, departs: dep }, NOW).length === 1, 'une vente SANS n° de suivi n’est jamais reliée (pas par le titre)');
  });

  essaie('§3 « pas su » ne vaut pas « oui »', () => {
    const v = { a: { aExpedier: true, suivi: 'XW000000600TS', date: iso(NOW - 48 * H) } };
    dit(VC.colisVcAPoster({ ventes: v }, NOW).length === 1 && VC.colisVcAPoster({ ventes: v, departs: null }, NOW).length === 1, 'aucune lecture (départs absents ou illisibles) ⇒ toujours « à envoyer »');
    dit(VC.colisVcAPoster({ ventes: v, departs: carte(ligne('XW000000600TS', null)) }, NOW).length === 1, 'lu mais pas pris en charge (étiquette créée) ⇒ toujours « à envoyer »');
    dit(fn(D, 'departsParSuivi')(null) === null, 'une lecture de base ratée rend null (pas une carte vide)');
  });

  essaie('§4 une prise en charge ne recule pas, et ferme le n°', () => {
    const lap = fn(D, 'ligneDepartApresEssai');
    const l1 = lap(null, { res: 'ok', etat: 'en_route', etatAt: iso(NOW - 20 * H), evenements: [{ at: iso(NOW - 20 * H), code: 'DB' }] }, { carrier: 'chronopost', suivi: 'XW000000700TS', maintenant: NOW - H });
    const l2 = lap(l1, { res: 'ok', etat: 'en_route', detail: 'prepare', etatAt: iso(NOW - 30 * H), evenements: [{ at: iso(NOW - 30 * H), code: 'DC' }] }, { carrier: 'chronopost', suivi: 'XW000000700TS', maintenant: NOW });
    const l3 = lap(l2, { res: 'bloque' }, { carrier: 'chronopost', suivi: 'XW000000700TS', maintenant: NOW });
    dit(l1.priseAt === iso(NOW - 20 * H) && l1.fini === true, 'prise en charge prouvée ⇒ datée et le n° est fermé (plus relu)', JSON.stringify([l1.priseAt, l1.fini]));
    dit(l2.priseAt === l1.priseAt && l3.priseAt === l1.priseAt, 'une lecture plus pauvre (« en préparation ») ou un refus ensuite ne l’efface pas');
    dit(l1.sens === 'sortant' && !('notif' in l1) && !('notifEnAttente' in l1), 'la ligne de départ ne porte aucune notification');
    dit(fn(D, 'prochainEssaiDepart')(l1) === Infinity, 'fermée ⇒ prochain essai : jamais');
  });

  essaie('§5 le cloisonnement : un départ n’est jamais un colis à retirer', () => {
    const cle = fn(D, 'cleDepart')('chronopost', 'xw000000800ts');
    dit(cle === 'depart_chronopost_XW000000800TS' && !/^transp_/.test(cle), 'la ligne s’appelle `depart_…` (jamais `transp_…`)', cle);
    dit(T.ligneTranspDeMeta({ id: cle, suivi: 'XW000000800TS', carrier: 'chronopost', etat: 'disponible', lu: iso(NOW) }) === null, 'les lecteurs de « à retirer » (`ligneTranspDeMeta`) refusent une ligne de départ');
    const sel = T.suivisAInterroger({ lignes: [{ suivi: 'XW000000801TS', carrier: 'chronopost', status: 'transit', subject: 'Preuve de dépôt de votre colis', receivedAt: iso(NOW - 10 * H) }], envoyes: ['XW000000802TS'], vinted: [], maintenant: NOW });
    dit(!sel.some((x) => x.suivi === 'XW000000801TS' || x.suivi === 'XW000000802TS'), 'la sélection des ACHATS ne lit toujours aucun n° sortant (bordereau ou sens)', JSON.stringify(sel));
    const it = fn(D, 'departsAInterroger')({ sortants: [
      { cle: 'vc:1', suivi: 'XW000000810TS', transporteur: 'Chronopost', venteMs: NOW - 48 * H },
      { cle: 'vc:2', suivi: '87654321', transporteur: 'Mondial Relay', venteMs: NOW - 48 * H },
      { cle: 'vc:3', suivi: 'XW000000811TS', transporteur: 'Chronopost', venteMs: NOW - 48 * H },
      { cle: 'vc:4', suivi: '6A12345678901', transporteur: 'Colissimo', venteMs: NOW - 48 * H },
      { cle: 'vc:5', suivi: 'XW000000812TS', transporteur: 'Chronopost', venteMs: NOW - 40 * 24 * H },
    ], departs: new Map(), entrants: new Set(['XW000000811TS']), maintenant: NOW, max: 10, parTransporteur: 10 });
    dit(it.length === 1 && it[0].suivi === 'XW000000810TS' && it[0].carrier === 'chronopost', 'lus comme départ : Chronopost seulement ; ni Mondial Relay (code postal de l’acheteur), ni Colissimo, ni un n° d’achat, ni une vente de plus de 21 jours', JSON.stringify(it));
    const fin = fn(D, 'departsAInterroger')({ sortants: [{ cle: 'vc:1', suivi: 'XW000000810TS', transporteur: 'Chronopost' }], departs: carte(ligne('XW000000810TS', NOW - 20 * H)), maintenant: NOW });
    dit(fin.length === 0, 'pris en charge ⇒ plus jamais relu');
    const tot = fn(D, 'departsAInterroger')({ sortants: Array.from({ length: 20 }, (_, i) => ({ cle: 'vc:' + i, suivi: `XW${String(900000000 + i)}TS`, transporteur: 'Chronopost', venteMs: NOW - 48 * H })), maintenant: NOW, max: 3, parTransporteur: 3 });
    dit(tot.length === 3, 'borné : 3 lectures de départ par passage de l’app', String(tot.length));
  });

  essaie('§6 Vinted : le n° du bordereau de SA transaction', () => {
    const txp = fn(D, 'txVintedParties');
    const bords = { 111: { transaction: '111', suivi: 'XW000000901TS', receivedAt: iso(NOW - 30 * H) }, 222: { transaction: '222', suivi: 'XW000000902TS', receivedAt: iso(NOW - 30 * H) }, 333: { transaction: '333', suivi: 'XW000000903TS', receivedAt: iso(NOW - 30 * H) }, 444: { transaction: '444', suivi: 'XW000000903TS', receivedAt: iso(NOW - 30 * H) } };
    const m = txp(bords, carte(ligne('XW000000901TS', NOW - 20 * H), ligne('XW000000902TS', null), ligne('XW000000903TS', NOW - 20 * H)));
    dit(m.has('111') && !m.has('222') && !m.has('333') && !m.has('444') && m.size === 1, 'pris en charge ⇒ la transaction 111 seule ; « étiquette » ⇒ non ; un n° sur deux bordereaux ⇒ ambigu', JSON.stringify([...m.keys()]));
    dit(txp(bords, null).size === 0, 'départs illisibles ⇒ aucune transaction partie');
  });

  console.log('§7 une règle, partout où « à envoyer » est compté');
  const lit = (f) => { try { return fs.readFileSync(path.join(RACINE, f), 'utf8'); } catch (_) { return ''; } };
  const app = lit('src/App.jsx'), widget = lit('api/widget.js'), rappels = lit('api/ship-reminders.js'), lecture = lit('api/_lib/transporteurs-lecture.js');
  dit(/avecNumerosVc = \(d\)[^\n]*departs: departsCarte\(\)/.test(app), 'app : chaque lecture Vestiaire porte les départs (`avecNumerosVc`) — Colis, Ma journée, la cloche, Ventes');
  // (8 nov., « à envoyer » prouvé) La règle Vinted vit dans api/_lib/depart-vente.js (`ventesPartiesParPreuve`, qui appelle `departProuve`).
  dit(/partisVinted\.get\(String\(b\.transaction\)\)/.test(app) && /ventesPartiesParPreuve\(\{[\s\S]{0,400}departs: vcLoc0\.departs/.test(app), 'app : Vinted, `bordShipped` lit la même règle (`ventesPartiesParPreuve` → `departProuve`)');
  dit(/ventesPartiesParPreuve\([^)]*departs,/.test(widget) && /departs \}/.test(widget) && /like\.depart_\*/.test(widget), 'widget : Vinted et Vestiaire lisent les départs');
  dit(/ventesPartiesParPreuve\([\s\S]{0,300}departs: d\.departs/.test(rappels) && (rappels.match(/like\.depart_\*/g) || []).length >= 2, 'rappels (matin, soir, bilan) : Vinted et Vestiaire lisent les départs');
  dit(/passageDeparts\(/.test(lecture) && /MAX_DEPARTS_CRON/.test(rappels), 'le serveur lit les départs au passage de l’app ET au cron');
  // Aucun lecteur de « à retirer » ne lit une ligne de départ.
  const retrait = ['api/_lib/retrait-colis.js', 'api/_lib/suivi-colis.js', 'api/_lib/etat-colis.js', 'api/_lib/transporteurs-notif.js', 'src/retraitPreuves.js'].map((f) => [f, lit(f)]);
  dit(retrait.every(([, c]) => !/depart_|depart-colis/.test(c)), 'aucun module de « à retirer » ni des notifications ne lit `depart_`', retrait.filter(([, c]) => /depart_|depart-colis/.test(c)).map(([f]) => f).join(', '));

  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s) sur ${ok + ko}.` : `\n✅ ${ok} contrôles : un colis vendu pris en charge chez le transporteur est parti, prouvé par son n° — jamais « à retirer ».`);
  process.exit(ko ? 1 : 0);
})();
